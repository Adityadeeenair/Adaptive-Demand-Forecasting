"""
backend/services/email_service.py
===================================
Sends forecast reports via email with a CSV attachment.

Supported delivery methods:
1. Resend HTTP API (Recommended for Render & cloud platforms):
   - Works over standard HTTPS port 443 (never blocked by Render's free tier).
   - Works across IPv4 and IPv6 without connection timeout issues.
   - Configure: RESEND_API_KEY=re_... and optional EMAIL_FROM="ForecastIQ <onboarding@resend.dev>"

2. Brevo HTTP API:
   - Also runs over HTTPS port 443.
   - Configure: BREVO_API_KEY=xkeysib-... and SENDER_EMAIL

3. Standard SMTP (Localhost / unblocked VPS):
   - Configure: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM
   - Note: Render free tier blocks outbound SMTP ports 25, 465, and 587.
     On Render, use RESEND_API_KEY instead.
"""

import os
import io
import csv
import smtplib
import socket
import re
import json
import base64
import urllib.request
import urllib.error
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime

from backend.services.logger import get_logger

log = get_logger(__name__)

# ── Validation ─────────────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_email(address: str) -> None:
    """Raise ValueError if address is not a valid email."""
    if not address or not address.strip():
        raise ValueError("Email address is required.")
    if not _EMAIL_RE.match(address.strip()):
        raise ValueError(f"'{address}' is not a valid email address.")


# ── CSV builder ────────────────────────────────────────────────────────────────

def build_forecast_csv(forecasts: list[dict]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "store", "item", "predicted_sales", "lower_bound", "upper_bound"])

    for fc in forecasts:
        store = fc.get("store", "1")
        item = fc.get("item", "1")
        for i, date in enumerate(fc.get("forecast_dates", [])):
            writer.writerow([
                date,
                store,
                item,
                round(fc["point_forecast"][i], 2),
                round(fc["lower_bound"][i], 2),
                round(fc["upper_bound"][i], 2),
            ])

    return buf.getvalue().encode("utf-8")


# ── Provider Send Implementations ──────────────────────────────────────────────

def _send_via_resend(
    api_key: str,
    from_address: str,
    to_address: str,
    subject: str,
    body_html: str,
    csv_bytes: bytes,
    filename: str,
) -> None:
    """Send email via Resend HTTP REST API over port 443 (Render-safe)."""
    b64_content = base64.b64encode(csv_bytes).decode("utf-8")
    payload = {
        "from": from_address or "ForecastIQ <onboarding@resend.dev>",
        "to": [to_address],
        "subject": subject,
        "html": body_html,
        "attachments": [
            {
                "filename": filename,
                "content": b64_content,
            }
        ],
    }

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
            "User-Agent": "ForecastIQ/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            log.info("Email sent successfully via Resend API", extra={"id": data.get("id"), "to": to_address})
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        log.error("Resend API error", extra={"code": e.code, "error": err_msg})
        try:
            err_json = json.loads(err_msg)
            message = err_json.get("message", err_msg)
        except Exception:
            message = err_msg
        raise RuntimeError(f"Resend email delivery failed: {message}")
    except Exception as e:
        log.error("Resend connection error", extra={"error": str(e)})
        raise RuntimeError(f"Could not connect to Resend API: {e}")


def _send_via_brevo(
    api_key: str,
    from_address: str,
    to_address: str,
    subject: str,
    body_html: str,
    csv_bytes: bytes,
    filename: str,
) -> None:
    """Send email via Brevo (Sendinblue) HTTP API over port 443 (Render-safe)."""
    b64_content = base64.b64encode(csv_bytes).decode("utf-8")
    sender_email = from_address if "@" in from_address else "noreply@forecastiq.app"
    payload = {
        "sender": {"name": "ForecastIQ", "email": sender_email},
        "to": [{"email": to_address}],
        "subject": subject,
        "htmlContent": body_html,
        "attachment": [
            {
                "name": filename,
                "content": b64_content,
            }
        ],
    }

    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "api-key": api_key.strip(),
            "Content-Type": "application/json",
            "User-Agent": "ForecastIQ/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            log.info("Email sent successfully via Brevo API", extra={"to": to_address})
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Brevo email delivery failed: {err_msg}")
    except Exception as e:
        raise RuntimeError(f"Could not connect to Brevo API: {e}")


def _send_via_smtp(
    host: str,
    port: int,
    user: str,
    password: str,
    from_address: str,
    to_address: str,
    subject: str,
    body_html: str,
    csv_bytes: bytes,
    filename: str,
) -> None:
    """Send email via standard SMTP (local/VPS)."""
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = from_address or user
    msg["To"] = to_address
    msg.attach(MIMEText(body_html, "html"))

    part = MIMEBase("application", "octet-stream")
    part.set_payload(csv_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(part)

    try:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(user, password)
            smtp.sendmail(msg["From"], to_address, msg.as_string())
        log.info("Email sent successfully via SMTP", extra={"to": to_address})
    except (socket.timeout, TimeoutError, OSError) as e:
        log.error("SMTP socket timeout/network error", extra={"error": str(e), "host": host, "port": port})
        raise RuntimeError(
            f"SMTP connection to {host}:{port} timed out or is blocked. "
            "Note: Cloud platforms like Render block raw outbound SMTP ports (25/465/587). "
            "To send emails reliably on Render, set RESEND_API_KEY in environment variables."
        )
    except smtplib.SMTPException as e:
        log.error("SMTP error", extra={"error": str(e)})
        raise RuntimeError(f"SMTP error: {e}")


# ── Main Entrypoint ────────────────────────────────────────────────────────────

def send_forecast_email(
    to_address: str,
    forecasts: list[dict],
    session_id: str,
) -> None:
    """
    Send forecast results to `to_address` with a CSV attachment.
    Automatically selects the best provider:
    1. Resend API (if RESEND_API_KEY set) -> Render-safe (port 443)
    2. Brevo API (if BREVO_API_KEY set) -> Render-safe (port 443)
    3. SMTP (if SMTP_USER and SMTP_PASSWORD set)
    """
    validate_email(to_address)

    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    brevo_key = os.getenv("BREVO_API_KEY", "").strip()
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    email_from = os.getenv("EMAIL_FROM", "").strip()

    if not resend_key and not brevo_key and (not smtp_user or not smtp_password):
        raise RuntimeError(
            "Email service is not configured. "
            "For Render, set RESEND_API_KEY in your Render environment variables. "
            "For local dev, you can set SMTP_USER and SMTP_PASSWORD."
        )

    # ── Summary metrics ────────────────────────────────────────────────────────
    n_products = len({f.get("product_id") for f in forecasts})
    horizons = sorted({f.get("horizon", 0) for f in forecasts})
    horizon_str = ", ".join(f"{h}d" for h in horizons)
    total_rows = sum(len(f.get("forecast_dates", [])) for f in forecasts)
    generated = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    # ── Build CSV attachment ──────────────────────────────────────────────────
    csv_bytes = build_forecast_csv(forecasts)
    filename = f"forecast_export_{session_id[:8]}_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    # ── Compose HTML ──────────────────────────────────────────────────────────
    subject = f"ForecastIQ — Demand Forecast Report ({n_products} product{'s' if n_products != 1 else ''})"
    body_html = f"""
<div style="font-family:sans-serif;max-width:560px;color:#333;margin:0 auto">
  <div style="background:#111;padding:20px 28px;border-radius:8px 8px 0 0">
    <h1 style="color:#f5a623;font-size:18px;margin:0">ForecastIQ</h1>
    <p style="color:#888;font-size:12px;margin:4px 0 0">Adaptive Demand Forecasting Platform</p>
  </div>
  <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #eee">
    <h2 style="font-size:15px;color:#111;margin:0 0 16px">Your forecast report is ready</h2>

    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:8px 0;color:#888">Products</td>
        <td style="padding:8px 0;font-weight:600">{n_products}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:8px 0;color:#888">Forecast horizon(s)</td>
        <td style="padding:8px 0;font-weight:600">{horizon_str}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:8px 0;color:#888">Total forecast rows</td>
        <td style="padding:8px 0;font-weight:600">{total_rows:,}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#888">Generated at</td>
        <td style="padding:8px 0;font-weight:600">{generated}</td>
      </tr>
    </table>

    <p style="font-size:12px;color:#666;margin:20px 0 0;line-height:1.6">
      The attached CSV contains daily predicted sales with 80% confidence bounds
      for all products in your session. Open it in Excel, Google Sheets, or any planning tool.
    </p>
  </div>
  <div style="background:#f0f0f0;padding:12px 28px;border-radius:0 0 8px 8px;font-size:11px;color:#aaa">
    Sent by ForecastIQ · Adaptive Demand Forecasting
  </div>
</div>
""".strip()

    log.info("Dispatching forecast email", extra={
        "to": to_address, "products": n_products, "rows": total_rows,
        "provider": "resend" if resend_key else ("brevo" if brevo_key else "smtp"),
    })

    if resend_key:
        _send_via_resend(resend_key, email_from, to_address, subject, body_html, csv_bytes, filename)
    elif brevo_key:
        _send_via_brevo(brevo_key, email_from, to_address, subject, body_html, csv_bytes, filename)
    else:
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        _send_via_smtp(
            smtp_host, smtp_port, smtp_user, smtp_password, email_from,
            to_address, subject, body_html, csv_bytes, filename,
        )
