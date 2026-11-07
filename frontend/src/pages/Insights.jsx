import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { fmtShortDate, fmtNum, segmentColor, segmentLabel } from '../utils/format'
import { api } from '../api/client'

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, hint, highlight }) {
  return (
    <div style={{
      padding: '20px 22px',
      background: 'var(--bg-surface)',
      border: `1px solid ${highlight ? 'var(--amber)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      boxShadow: highlight ? '0 0 0 1px rgba(245,166,35,0.15)' : 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 700, color: highlight ? 'var(--amber)' : 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</p>}
      {hint && <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, opacity: 0.8 }}>{hint}</p>}
    </div>
  )
}

// ── Plain-English Executive Takeaways ─────────────────────────────────────────
function ExecutiveSummary({ summary, insights }) {
  if (!insights || !insights.segment_counts) return null

  const counts = insights.segment_counts
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1

  const seasonalPct = Math.round(((counts.seasonal_stable || 0) + (counts.seasonal_volatile || 0)) / total * 100)
  const stablePct = Math.round((counts.stable || 0) / total * 100)
  const volatilePct = Math.round(((counts.volatile || 0) + (counts.seasonal_volatile || 0)) / total * 100)
  const topProduct = insights.top_products?.[0]

  return (
    <div style={{
      padding: '24px 28px',
      background: 'linear-gradient(135deg, rgba(245,166,35,0.05) 0%, rgba(20,20,23,0.9) 100%)',
      border: '1px solid rgba(245,166,35,0.25)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: 24,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: '50%', background: 'var(--amber-glow)',
          color: 'var(--amber)', fontSize: 13, fontWeight: 700,
        }}>💡</span>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Executive Demand Briefing
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            Plain-English analysis synthesized from your historical sales patterns
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Rhythm takeaway */}
        <div style={{ background: 'var(--bg-elevated)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--amber)', fontWeight: 700, textTransform: 'uppercase' }}>
              Weekly Rhythm
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
            {seasonalPct > 20 ? (
              <>
                <strong>{seasonalPct}% of your catalog</strong> displays strong 7-day cyclical demand (recurring weekend/weekday peaks). Models apply Holt-Winters & LightGBM to protect against weekend stockouts.
              </>
            ) : (
              <>
                Weekly seasonality is mild across this catalog. Sales flow relatively evenly throughout the week with minimal weekend surges.
              </>
            )}
          </p>
        </div>

        {/* Predictability takeaway */}
        <div style={{ background: 'var(--bg-elevated)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase' }}>
              Restock Predictability
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
            <strong>{stablePct}% of items</strong> have highly stable, low-variance sales. These products can be safely placed on automated replenishment with low safety-stock buffers.
          </p>
        </div>

        {/* Risk / Volatility takeaway */}
        <div style={{ background: 'var(--bg-elevated)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: volatilePct > 25 ? 'var(--red)' : 'var(--blue)', fontWeight: 700, textTransform: 'uppercase' }}>
              Uncertainty & Buffer
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
            {volatilePct > 0 ? (
              <>
                <strong>{volatilePct}% of items</strong> show volatile spikes or drops. The system generates wider 80% confidence bands for these items to ensure adequate inventory buffers.
              </>
            ) : (
              <>
                No erratic demand spikes detected. All products fall within predictable or seasonal boundaries.
              </>
            )}
          </p>
        </div>

        {/* Top driver takeaway */}
        {topProduct && (
          <div style={{ background: 'var(--bg-elevated)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-amber)', fontWeight: 700, textTransform: 'uppercase' }}>
                Primary Volume Driver
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
              Product <strong>{topProduct.product_id}</strong> is your highest-volume SKU, averaging <strong>{fmtNum(topProduct.mean_sales, 1)} units/day</strong> ({segmentLabel(topProduct.final_segment)}). Priority replenishment advised.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Behavioral Playbook ───────────────────────────────────────────────────────
function SegmentPlaybook({ counts }) {
  if (!counts || !Object.keys(counts).length) return null
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1

  const SEGMENT_GUIDE = {
    stable: {
      label: 'Stable Demand',
      color: '#2ecc71',
      meaning: 'Consistent sales volume with low daily variance. Predictable like clockwork.',
      action: 'Automated weekly replenishment. Minimal safety buffer required (5–10%).',
    },
    seasonal_stable: {
      label: 'Seasonal (Predictable)',
      color: '#9b59b6',
      meaning: 'Follows consistent weekly cycles (e.g., Saturday spikes, Monday lulls).',
      action: 'Batch orders to arrive 24–48 hours ahead of peak cycle days (e.g. Thursday delivery).',
    },
    volatile: {
      label: 'Volatile Demand',
      color: '#e74c3c',
      meaning: 'Unpredictable spikes and valleys caused by promos, stockouts, or external events.',
      action: 'Maintain a 20–25% safety stock buffer. Use quantile upper bounds for reorders.',
    },
    seasonal_volatile: {
      label: 'Seasonal + Volatile',
      color: '#e67e22',
      meaning: 'Exhibits cyclical trends but with erratic, high-variance spikes.',
      action: 'Combine peak-day scheduling with a dynamic buffer for surge protection.',
    },
    trending: {
      label: 'Trending',
      color: '#f5a623',
      meaning: 'Clear upward or downward trajectory over recent months.',
      action: 'Adjust inventory quantities forward each month to match slope (avoid obsolete stock).',
    },
    intermittent: {
      label: 'Intermittent',
      color: '#3498db',
      meaning: 'Sporadic purchases with many zero-sales days.',
      action: 'Order on-demand or use central regional hub fulfillment instead of store stocking.',
    },
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])

  return (
    <div style={{
      padding: '24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: 24,
    }}>
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
          Operational Playbook & Segmentation Guide
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          What each detected pattern means and the recommended retail inventory action
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
        {entries.map(([key, count]) => {
          const guide = SEGMENT_GUIDE[key] || {
            label: segmentLabel(key),
            color: segmentColor(key),
            meaning: 'General demand pattern classified by behavioral analysis.',
            action: 'Monitor regular sales trends and align with ML forecasts.',
          }
          const pct = Math.round((count / total) * 100)

          return (
            <div key={key} style={{
              padding: '16px 18px',
              background: 'var(--bg-elevated)',
              border: `1px solid ${guide.color}35`,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: guide.color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: guide.color, fontFamily: 'var(--font-display)' }}>
                      {guide.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {count} items ({pct}%)
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                  {guide.meaning}
                </p>
              </div>

              <div style={{
                padding: '8px 12px',
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-sm)',
                borderLeft: `3px solid ${guide.color}`,
              }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: guide.color, display: 'block', textTransform: 'uppercase', marginBottom: 2 }}>
                  Recommended Action:
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {guide.action}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Segment distribution bars ─────────────────────────────────────────────────
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
      marginBottom: 16,
    }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>
        Segment Distribution — {total} products
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {entries.map(([seg, count]) => {
          const pct = (count / total * 100).toFixed(0)
          const color = segmentColor(seg)
          return (
            <div key={seg} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 110, fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>
                {segmentLabel(seg)}
              </div>
              <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ width: 65, fontSize: 11, fontFamily: 'var(--font-mono)', color, flexShrink: 0 }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {products.map((p, i) => {
          const color = segmentColor(p.final_segment)
          const barW = (p.mean_sales / maxSales * 100).toFixed(1)
          return (
            <div key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 18, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0 }}>
                {i + 1}
              </span>
              <span style={{ width: 85, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.product_id}
              </span>
              <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${barW}%`, height: '100%', background: color, borderRadius: 3 }} />
              </div>
              <span style={{ width: 65, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right', flexShrink: 0 }}>
                {fmtNum(p.mean_sales)} <span style={{ color: 'var(--text-tertiary)', fontSize: 9 }}>u/d</span>
              </span>
              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontFamily: 'var(--font-mono)', background: `${color}18`, color, border: `1px solid ${color}44`, flexShrink: 0 }}>
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
    <div style={{ padding: '36px', background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', textAlign: 'center', marginTop: 16 }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', margin: 0 }}>
        RUN A FORECAST ON THE DASHBOARD TO VIEW DETAILED HISTORICAL TIME-SERIES CURVES HERE
      </p>
    </div>
  )

  const data = forecast.history_dates.map((isoDate, i) => ({
    idx: i, isoDate, sales: forecast.history_sales[i],
  }))

  const n = data.length
  const tickStep = Math.max(1, Math.floor(n / 8))
  const ticks = [...new Set([0, ...Array.from({ length: 8 }, (_, i) => Math.min(i * tickStep, n - 1)), n - 1])].sort((a, b) => a - b)

  return (
    <div style={{ padding: '20px 24px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
            Sales History — Product {forecast.product_id}
          </p>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Observed demand across the last {data.length} days
          </span>
        </div>
        <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--amber-glow)', color: 'var(--amber)', border: '1px solid var(--amber-dim)' }}>
          {segmentLabel(forecast.segment)}
        </span>
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
            <XAxis
              dataKey="idx" type="number"
              domain={[0, n - 1]} ticks={ticks}
              tickFormatter={(idx) => { const r = data[idx]; return r ? fmtShortDate(r.isoDate) : '' }}
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-tertiary)' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-tertiary)' }}
              axisLine={false} tickLine={false} width={45}
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
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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
      <p style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
        UPLOAD A DATASET TO UNLOCK EXECUTIVE DEMAND INSIGHTS
      </p>
    </div>
  )

  const spanDays = summary.date_span_days
  const spanYears = (spanDays / 365).toFixed(1)

  return (
    <div style={{ padding: '36px 32px', maxWidth: 1140, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'var(--amber-glow)', border: '1px solid var(--amber-dim)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Catalog Analytics</span>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          Dataset Insights & Strategy
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Historical span: {summary.date_min} → {summary.date_max} ({spanDays} days · {spanYears} years)
        </p>
      </div>

      {/* Executive Summary Briefing */}
      <ExecutiveSummary summary={summary} insights={insights} />

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Rows" value={summary.rows.toLocaleString()} sub="daily observations" hint="Full historical depth" highlight />
        <StatCard label="Products" value={summary.products} sub="store-item pairs" hint="Individually forecasted" />
        <StatCard label="Stores" value={summary.stores} sub="retail locations" hint="Spatial distribution" />
        <StatCard label="Items" value={summary.items} sub="distinct SKUs" hint="Unique catalog articles" />
        <StatCard label="History Depth" value={`${spanYears}y`} sub={`${spanDays} days`} hint="Temporal duration" />
        <StatCard label="Avg Daily Sales" value={fmtNum(summary.avg_daily_sales, 1)} sub="units / day" hint="Catalog-wide average" />
      </div>

      {/* Thin products warning */}
      {summary.thin_products > 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 'var(--radius-md)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--amber)', fontSize: 14 }}>⚠</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {summary.thin_products} product(s) have fewer than 30 days of records and were excluded from heavy ML training.
          </span>
        </div>
      )}

      {/* Operational Playbook */}
      {insights && <SegmentPlaybook counts={insights.segment_counts} />}

      {/* Two-column layout: segment distribution + top products */}
      {insights && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <SegmentBreakdown counts={insights.segment_counts} />
          <TopProductsTable products={insights.top_products} />
        </div>
      )}

      {/* History chart */}
      <HistoryChart forecast={forecast} />
    </div>
  )
}
