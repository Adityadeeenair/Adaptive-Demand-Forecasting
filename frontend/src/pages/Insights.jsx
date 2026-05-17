import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts'
import { fmtShortDate, fmtNum, segmentColor, segmentLabel } from '../utils/format'
import { api } from '../api/client'

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, highlight }) {
  return (
    <div style={{
      padding: '20px 22px',
      background: 'var(--bg-surface)',
      border: `1px solid ${highlight ? 'var(--amber)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      boxShadow: highlight ? '0 0 0 1px rgba(245,166,35,0.15)' : 'none',
    }}>
      <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 700, color: highlight ? 'var(--amber)' : 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</p>}
    </div>
  )
}

// ── Segment distribution ──────────────────────────────────────────────────────
function SegmentBreakdown({ counts }) {
  if (!counts || !Object.keys(counts).length) return null
  const total   = Object.values(counts).reduce((a, b) => a + b, 0)
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])

  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: 16,
    }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>
        Segment Distribution — {total} products
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map(([seg, count]) => {
          const pct = (count / total * 100).toFixed(0)
          const color = segmentColor(seg)
          return (
            <div key={seg} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 90, fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>
                {segmentLabel(seg)}
              </div>
              <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ width: 52, fontSize: 11, fontFamily: 'var(--font-display)', color, flexShrink: 0 }}>
                {count} <span style={{ color: 'var(--text-tertiary)' }}>({pct}%)</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Top products table ────────────────────────────────────────────────────────
function TopProductsTable({ products }) {
  if (!products?.length) return null
  const maxSales = Math.max(...products.map(p => p.mean_sales))

  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: 16,
    }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>
        Top Products by Avg Daily Sales
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {products.map((p, i) => {
          const color = segmentColor(p.final_segment)
          const barW  = (p.mean_sales / maxSales * 100).toFixed(1)
          return (
            <div key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 18, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', textAlign: 'right', flexShrink: 0 }}>
                {i + 1}
              </span>
              <span style={{ width: 90, fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.product_id}
              </span>
              <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${barW}%`, height: '100%', background: color, borderRadius: 3 }} />
              </div>
              <span style={{ width: 52, fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', textAlign: 'right', flexShrink: 0 }}>
                {fmtNum(p.mean_sales)} <span style={{ color: 'var(--text-tertiary)', fontSize: 9 }}>u/d</span>
              </span>
              <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 9, fontFamily: 'var(--font-display)', background: `${color}18`, color, border: `1px solid ${color}44`, flexShrink: 0 }}>
                {segmentLabel(p.final_segment)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── History chart ─────────────────────────────────────────────────────────────
function HistoryChart({ forecast }) {
  if (!forecast) return (
    <div style={{ padding: '32px', background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
        RUN A FORECAST ON THE DASHBOARD TO SEE PRODUCT SALES HISTORY
      </p>
    </div>
  )

  const data = forecast.history_dates.map((isoDate, i) => ({
    idx: i, isoDate, sales: forecast.history_sales[i],
  }))

  const n        = data.length
  const tickStep = Math.max(1, Math.floor(n / 8))
  const ticks    = [...new Set([0, ...Array.from({ length: 8 }, (_, i) => Math.min(i * tickStep, n - 1)), n - 1])].sort((a, b) => a - b)

  return (
    <div style={{ padding: '20px 24px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Sales History — {forecast.product_id}
        </p>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
          last {data.length} days
        </span>
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="insightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--amber)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--amber)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="idx" type="number"
              domain={[0, n - 1]} ticks={ticks}
              tickFormatter={(idx) => { const r = data[idx]; return r ? fmtShortDate(r.isoDate) : '' }}
              tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }}
              axisLine={false} tickLine={false} width={40}
              tickFormatter={(v) => fmtNum(v, 0)}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 12 }}
              labelFormatter={(idx) => { const r = data[idx]; return r ? fmtShortDate(r.isoDate) : '' }}
              formatter={(v) => [fmtNum(v, 1), 'Sales']}
            />
            <Line dataKey="sales" stroke="var(--amber)" strokeWidth={1.8} dot={false}
              activeDot={{ r: 3, fill: 'var(--amber)', stroke: 'var(--bg-base)', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, textAlign: 'center' }}>
        Switch to any product on the Dashboard and run a forecast to update this chart
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Insights({ summary, forecast, sessionId }) {
  const [insights, setInsights] = useState(null)

  // Load session-level insights when sessionId is available
  useEffect(() => {
    if (!sessionId) return
    api.getInsights(sessionId)
      .then(setInsights)
      .catch(() => {})
  }, [sessionId])

  if (!summary) return (
    <div style={{ padding: 64, textAlign: 'center' }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
        UPLOAD A DATASET TO SEE INSIGHTS
      </p>
    </div>
  )

  const spanDays  = summary.date_span_days
  const spanYears = (spanDays / 365).toFixed(1)

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Dataset</p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Dataset Insights</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{summary.date_min} → {summary.date_max}</p>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Rows"    value={summary.rows.toLocaleString()} sub="daily records"      highlight />
        <StatCard label="Products"      value={summary.products}              sub="store-item pairs" />
        <StatCard label="Stores"        value={summary.stores}                sub="retail locations" />
        <StatCard label="Items"         value={summary.items}                 sub="distinct SKUs" />
        <StatCard label="Date Span"     value={`${spanYears}y`}              sub={`${spanDays} days`} />
        <StatCard label="Avg Sales/Day" value={fmtNum(summary.avg_daily_sales, 1)} sub="units per day" />
      </div>

      {/* Thin products warning */}
      {summary.thin_products > 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 'var(--radius-md)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--amber)', fontSize: 14 }}>⚠</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {summary.thin_products} product(s) have fewer than 30 days of history and may be excluded from forecasting.
          </span>
        </div>
      )}

      {/* Two-column layout: segment dist + top products */}
      {insights && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
          <SegmentBreakdown counts={insights.segment_counts} />
          <TopProductsTable products={insights.top_products} />
        </div>
      )}

      {/* Sample products (shown when insights not yet loaded) */}
      {!insights && (
        <div style={{ padding: '20px 24px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Sample Products</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {summary.sample_products.map(p => (
              <span key={p} style={{ padding: '4px 12px', fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--amber)', background: 'var(--amber-glow)', border: '1px solid var(--amber-dim)', borderRadius: 'var(--radius-sm)' }}>{p}</span>
            ))}
            {summary.products > summary.sample_products.length && (
              <span style={{ padding: '4px 12px', fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                +{summary.products - summary.sample_products.length} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* History chart */}
      <HistoryChart forecast={forecast} />
    </div>
  )
}
