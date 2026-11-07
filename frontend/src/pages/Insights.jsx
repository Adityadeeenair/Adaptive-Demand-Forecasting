import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { fmtShortDate, fmtNum, segmentColor, segmentLabel } from '../utils/format'
import { api } from '../api/client'

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, highlight }) {
  return (
    <div style={{
      padding: '18px 20px',
      background: 'var(--bg-surface)',
      border: `1px solid ${highlight ? 'var(--amber)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      boxShadow: highlight ? '0 0 0 1px rgba(245, 166, 35, 0.15)' : 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <p style={{
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label}
      </p>
      <p style={{
        fontSize: 24,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color: highlight ? 'var(--amber)' : 'var(--text-primary)',
        lineHeight: 1.1,
        marginBottom: 4,
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Segment Distribution ──────────────────────────────────────────────────────
function SegmentBreakdown({ counts }) {
  if (!counts || !Object.keys(counts).length) return null
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])

  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          Demand Segments
        </p>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {total} products total
        </span>
      </div>

      {/* Proportional composite bar */}
      <div style={{
        display: 'flex',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        background: 'var(--bg-elevated)',
        marginBottom: 20,
      }}>
        {entries.map(([seg, count]) => {
          const widthPct = (count / total) * 100
          const color = segmentColor(seg)
          return (
            <div
              key={seg}
              style={{
                width: `${widthPct}%`,
                height: '100%',
                background: color,
                transition: 'width 0.4s ease',
              }}
              title={`${segmentLabel(seg)}: ${count} (${widthPct.toFixed(0)}%)`}
            />
          )
        })}
      </div>

      {/* Segment row list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {entries.map(([seg, count]) => {
          const pct = ((count / total) * 100).toFixed(0)
          const color = segmentColor(seg)
          return (
            <div key={seg} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 120, flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {segmentLabel(seg)}
                </span>
              </div>

              <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>

              <div style={{ width: 68, fontSize: 11, fontFamily: 'var(--font-mono)', color, textAlign: 'right', flexShrink: 0 }}>
                {count} <span style={{ color: 'var(--text-tertiary)' }}>({pct}%)</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Top Products by Sales Velocity ────────────────────────────────────────────
function TopProductsTable({ products }) {
  if (!products?.length) return null
  const maxSales = Math.max(...products.map(p => p.mean_sales))

  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          Top Products by Volume
        </p>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          Avg Daily Sales
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {products.map((p, i) => {
          const color = segmentColor(p.final_segment)
          const barW = (p.mean_sales / maxSales * 100).toFixed(1)
          const rankStr = String(i + 1).padStart(2, '0')
          return (
            <div key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 20, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0 }}>
                {rankStr}
              </span>
              <span style={{ width: 75, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flexShrink: 0 }}>
                {p.product_id}
              </span>
              <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${barW}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
              <span style={{ width: 85, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right', flexShrink: 0 }}>
                {fmtNum(p.mean_sales, 1)} <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>u/day</span>
              </span>
              <span style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                background: `${color}18`,
                color,
                border: `1px solid ${color}40`,
                flexShrink: 0,
                width: 65,
                textAlign: 'center',
              }}>
                {segmentLabel(p.final_segment)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Historical Demand Timeline ────────────────────────────────────────────────
function HistoryChart({ forecast }) {
  if (!forecast) {
    return (
      <div style={{
        padding: '32px 24px',
        background: 'var(--bg-surface)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          Select any product on the Forecast Dashboard to display historical daily demand timeline
        </p>
      </div>
    )
  }

  const data = forecast.history_dates.map((isoDate, i) => ({
    idx: i,
    isoDate,
    sales: forecast.history_sales[i],
  }))

  const n = data.length
  const tickStep = Math.max(1, Math.floor(n / 8))
  const ticks = [...new Set([0, ...Array.from({ length: 8 }, (_, i) => Math.min(i * tickStep, n - 1)), n - 1])].sort((a, b) => a - b)
  const color = segmentColor(forecast.segment)

  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            Historical Daily Sales: Product {forecast.product_id}
          </p>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Observed demand across the last {data.length} recorded days
          </span>
        </div>
        <span style={{
          padding: '3px 10px',
          borderRadius: 4,
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          background: `${color}18`,
          color,
          border: `1px solid ${color}40`,
        }}>
          {segmentLabel(forecast.segment)}
        </span>
      </div>

      <div style={{ height: 230 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--amber)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
            <XAxis
              dataKey="idx"
              type="number"
              domain={[0, n - 1]}
              ticks={ticks}
              tickFormatter={(idx) => { const r = data[idx]; return r ? fmtShortDate(r.isoDate) : '' }}
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
              width={45}
              tickFormatter={(v) => fmtNum(v, 0)}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 12 }}
              labelFormatter={(idx) => { const r = data[idx]; return r ? fmtShortDate(r.isoDate) : '' }}
              formatter={(v) => [fmtNum(v, 1), 'Daily Units']}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="var(--amber)"
              strokeWidth={1.8}
              fill="url(#historyFill)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--amber)', stroke: 'var(--bg-base)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function Insights({ summary, forecast, sessionId }) {
  const [insights, setInsights] = useState(null)

  useEffect(() => {
    if (!sessionId) return
    api.getInsights(sessionId)
      .then(setInsights)
      .catch(() => {})
  }, [sessionId])

  if (!summary) return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
        UPLOAD A DATASET TO VIEW INSIGHTS
      </p>
    </div>
  )

  const spanDays = summary.date_span_days
  const spanYears = (spanDays / 365).toFixed(1)

  return (
    <div style={{ padding: '32px', maxWidth: 1140, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 10px',
          background: 'var(--amber-glow)',
          border: '1px solid var(--amber-dim)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 10,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Catalog Diagnostics
          </span>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
          Dataset Insights
        </h2>

        <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', margin: 0 }}>
          Timeline: {summary.date_min} to {summary.date_max} ({spanDays} days · {spanYears} years)
        </p>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <MetricCard label="Total Records" value={summary.rows.toLocaleString()} sub="daily observations" highlight />
        <MetricCard label="Products" value={summary.products} sub="store-item pairs" />
        <MetricCard label="Stores" value={summary.stores} sub="retail locations" />
        <MetricCard label="Items" value={summary.items} sub="distinct SKUs" />
        <MetricCard label="History Depth" value={`${spanDays}d`} sub={`${spanYears} years`} />
        <MetricCard label="Avg Daily Sales" value={fmtNum(summary.avg_daily_sales, 1)} sub="units / day" />
      </div>

      {/* Warning on thin products if present */}
      {summary.thin_products > 0 && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(245, 166, 35, 0.06)',
          border: '1px solid rgba(245, 166, 35, 0.25)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ color: 'var(--amber)', fontSize: 14 }}>!</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {summary.thin_products} product(s) have fewer than 30 days of records and were excluded from heavy ML training.
          </span>
        </div>
      )}

      {/* Two-Column Analytics: Segments + Top Products */}
      {insights && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
          <SegmentBreakdown counts={insights.segment_counts} />
          <TopProductsTable products={insights.top_products} />
        </div>
      )}

      {/* Fallback Sample SKUs when insights not loaded */}
      {!insights && summary.sample_products?.length > 0 && (
        <div style={{
          padding: '20px 24px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <p style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            Sample Catalog Products
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {summary.sample_products.map((p) => (
              <span
                key={p}
                style={{
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--amber)',
                  background: 'var(--amber-glow)',
                  border: '1px solid var(--amber-dim)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Historical Sales Curve */}
      <HistoryChart forecast={forecast} />
    </div>
  )
}
