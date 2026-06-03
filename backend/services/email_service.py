import os
import io
import csv
import smtplib
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text      import MIMEText
from email.mime.base      import MIMEBase
from email               import encoders
from datetime            import datetime

from backend.services.logger import get_logger

log = get_logger(__name__)


def _smtp_cfg() -> dict:
    return {
        "host":     os.getenv("SMTP_HOST",     "smtp.gmail.com"),
        "port":     int(os.getenv("SMTP_PORT", "587")),
        "user":     os.getenv("SMTP_USER",     ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from":     os.getenv("EMAIL_FROM",    os.getenv("SMTP_USER", "")),
    }



_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

def validate_email(address: str) -> None:
    """Raise ValueError if address is not a valid email."""
    if not address or not address.strip():
        raise ValueError("Email address is required.")
    if not _EMAIL_RE.match(address.strip()):
        raise ValueError(f"'{address}' is not a valid email address.")



def build_forecast_csv(forecasts: list[dict]) -> bytes:

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "store", "item", "predicted_sales", "lower_bound", "upper_bound"])

    for fc in forecasts:
        store = fc.get("store", "1")
        item  = fc.get("item",  "1")
        for i, date in enumerate(fc.get("forecast_dates", [])):
            writer.writerow([
                date,
                store,
                item,
                round(fc["point_forecast"][i],  2),
                round(fc["lower_bound"][i],      2),
                round(fc["upper_bound"][i],      2),
            ])

    return buf.getvalue().encode("utf-8")



def send_forecast_email(
    to_address: str,
    forecasts:  list[dict],
    session_id: str,
) -> None:
    
    cfg = _smtp_cfg()

    if not cfg["user"] or not cfg["password"]:
        raise RuntimeError(
            "SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD "
            "environment variables to enable email export."
        )

    validate_email(to_address)

    n_products = len({f.get("product_id") for f in forecasts})
    horizons   = sorted({f.get("horizon", 0) for f in forecasts})
    horizon_str = ", ".join(f"{h}d" for h in horizons)
    total_rows  = sum(len(f.get("forecast_dates", [])) for f in forecasts)
    generated   = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    csv_bytes = build_forecast_csv(forecasts)
    filename  = f"forecast_export_{session_id[:8]}_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    msg = MIMEMultipart("mixed")
    msg["Subject"] = f"ForecastIQ — Demand Forecast Report ({n_products} product{'s' if n_products != 1 else ''})"
    msg["From"]    = cfg["from"]
    msg["To"]      = to_address

    body_html = f"""
<div style="font-family:sans-serif;max-width:560px;color:#333">
  <div style="background:#111;padding:20px 28px;border-radius:8px 8px 0 0">
    <h1 style="color:#f5a623;font-size:18px;margin:0">ForecastIQ</h1>
    <p style="color:#888;font-size:12px;margin:4px 0 0">Adaptive Demand Forecasting</p>
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

    <p style="font-size:12px;color:#999;margin:20px 0 0">
      The attached CSV contains daily predicted sales with 80% confidence bounds
      for all products in your session. Open it in Excel, Google Sheets, or any
      data tool.
    </p>
  </div>
  <div style="background:#f0f0f0;padding:12px 28px;border-radius:0 0 8px 8px;font-size:11px;color:#aaa">
    Sent by ForecastIQ · Do not reply to this email
  </div>
</div>
""".strip()

    msg.attach(MIMEText(body_html, "html"))

    # Attach CSV
    part = MIMEBase("application", "octet-stream")
    part.set_payload(csv_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(part)

    # ── Send via SMTP ─────────────────────────────────────────────────────────
    log.info("Sending forecast email", extra={
        "to": to_address, "products": n_products, "rows": total_rows,
    })
    
    import socket
    
    log.info(f"SMTP_HOST={cfg['host']}")
    log.info(f"SMTP_PORT={cfg['port']}")
    
    try:
        ip = socket.gethostbyname(cfg["host"])
        log.info(f"DNS OK: {ip}")
    except Exception as e:
        log.error(f"DNS FAILED: {repr(e)}")
    
    try:
        sock = socket.create_connection((cfg["host"], int(cfg["port"])), timeout=10)
        log.info("TCP CONNECTION SUCCESS")
        sock.close()
    except Exception as e:
        log.error(f"TCP CONNECTION FAILED: {repr(e)}")

    with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as smtp:
        smtp.ehlo()
        log.info("STEP 2: EHLO success")
        smtp.starttls()
        log.info("STEP 3: TLS success")
        smtp.login(cfg["user"], cfg["password"])
        log.info("STEP 4: Login success")
        smtp.sendmail(cfg["from"], to_address, msg.as_string())
        log.info("STEP 5: Email sent")

    log.info("Email sent successfully", extra={"to": to_address})
