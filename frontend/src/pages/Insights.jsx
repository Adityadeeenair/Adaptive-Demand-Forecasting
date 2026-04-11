import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fmtShortDate, fmtNum } from '../utils/format'

function StatCard({ label, value, sub, highlight }) {
  return (
    <div style={{
      padding: '20px 22px',
      background: 'var(--bg-surface)',
      border: `1px solid ${highlight ? 'var(--amber)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      boxShadow: highlight ? 'var(--shadow-amber)' : 'none',
    }}>
      <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 700, color: highlight ? 'var(--amber)' : 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</p>}
    </div>
  )
}

export default function Insights({ summary, forecast }) {
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    if (!forecast) return
    const history = forecast.history_dates.map((d, i) => ({
      date: fmtShortDate(d),
      sales: forecast.history_sales[i],
    }))
    setChartData(history)
  }, [forecast])

  if (!summary) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
        UPLOAD A DATASET TO SEE INSIGHTS
      </p>
    </div>
  )

  const spanDays = summary.date_span_days
  const spanYears = (spanDays / 365).toFixed(1)

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>

      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Dataset</p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Dataset Insights</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{summary.date_min} → {summary.date_max}</p>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Rows"   value={summary.rows.toLocaleString()} sub="daily records" highlight />
        <StatCard label="Products"     value={summary.products}  sub="store-item pairs" />
        <StatCard label="Stores"       value={summary.stores}    sub="retail locations" />
        <StatCard label="Items"        value={summary.items}     sub="distinct SKUs" />
        <StatCard label="Date Span"    value={`${spanYears}y`}   sub={`${spanDays} days`} />
        <StatCard label="Avg Sales/Day" value={fmtNum(summary.avg_daily_sales, 1)} sub="units per day" />
      </div>

      {/* Thin products warning */}
      {summary.thin_products > 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 'var(--radius-md)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--amber)', fontSize: 14 }}>⚠</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {summary.thin_products} product(s) have fewer than 60 days of history and may be excluded from forecasting.
          </span>
        </div>
      )}

      {/* Sample products */}
      <div style={{ padding: '20px 24px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 24 }}>
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

      {/* Sales chart — only shown after a forecast is run */}
      {chartData.length > 0 && (
        <div style={{ padding: '20px 24px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
            Sales History — {forecast?.product_id} (last 90 days)
          </p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', fontSize: 10 }}
                />
                <Line dataKey="sales" stroke="var(--amber)" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: 'var(--amber)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, textAlign: 'center' }}>
            Run a forecast on the Dashboard to update this chart for any product
          </p>
        </div>
      )}

      {!chartData.length && (
        <div style={{ padding: '32px', background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
            RUN A FORECAST ON THE DASHBOARD TO SEE PRODUCT SALES HISTORY
          </p>
        </div>
      )}
    </div>
  )
}
