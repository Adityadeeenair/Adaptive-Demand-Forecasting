import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductSelector from '../components/ProductSelector'
import ForecastChart from '../components/ForecastChart'
import MetricsPanel from '../components/MetricsPanel'
import HistoryPanel from '../components/HistoryPanel'
import StatusBadge from '../components/StatusBadge'
import { useForecast } from '../hooks/useForecast'
import { fmtNum, fmtShortDate } from '../utils/format'
import { api } from '../api/client'

const PANEL_STYLE = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
}
const PANEL_HEADER = {
  padding: '14px 20px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}
const PANEL_TITLE = {
  fontSize: 11,
  fontFamily: 'var(--font-display)',
  color: 'var(--text-tertiary)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

// ── CSV download (local, no backend) ────────────────────────────────────────
function downloadCSV(forecast) {
  const rows = [
    ['date', 'store', 'item', 'predicted_sales', 'lower_bound', 'upper_bound'],
    ...forecast.forecast_dates.map((d, i) => [
      d,
      forecast.store,
      forecast.item,
      forecast.point_forecast[i],
      forecast.lower_bound[i],
      forecast.upper_bound[i],
    ]),
  ]
  const csv  = rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `forecast_${forecast.product_id}_${forecast.horizon}d.csv`
  a.click()
}

// ── Email modal ──────────────────────────────────────────────────────────────
function EmailModal({ sessionId, forecast, onClose }) {
  const [email, setEmail]     = useState('')
  const [status, setStatus]   = useState('idle') // idle | sending | success | error
  const [message, setMessage] = useState('')

  const send = async () => {
    if (!email.trim()) { setMessage('Please enter an email address.'); setStatus('error'); return }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!re.test(email)) { setMessage('Invalid email address.'); setStatus('error'); return }
    setStatus('sending')
    setMessage('')
    try {
      await api.sendEmail(sessionId, email)
      setStatus('success')
      setMessage('Forecast sent! Check your inbox.')
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Failed to send email.')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 28,
        width: 380,
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Email Forecast Report
          </h3>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--text-tertiary)', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        {/* Summary */}
        <div style={{
          padding: '10px 14px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 18,
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}>
          <div><span style={{ color: 'var(--text-tertiary)' }}>Product:</span> {forecast.product_id}</div>
          <div><span style={{ color: 'var(--text-tertiary)' }}>Horizon:</span> {forecast.horizon} days</div>
          <div><span style={{ color: 'var(--text-tertiary)' }}>Avg forecast:</span> {fmtNum(forecast.point_forecast.reduce((a,b)=>a+b,0)/forecast.point_forecast.length)} units/day</div>
        </div>

        {/* Email input */}
        <label style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
          EMAIL ADDRESS
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="you@example.com"
          disabled={status === 'sending' || status === 'success'}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
            marginBottom: 14,
          }}
        />

        {/* Status message */}
        {message && (
          <p style={{
            fontSize: 12,
            marginBottom: 12,
            color: status === 'success' ? '#2ecc71' : '#e74c3c',
            padding: '8px 12px',
            borderRadius: 6,
            background: status === 'success' ? 'rgba(46,204,113,0.08)' : 'rgba(231,76,60,0.08)',
            border: `1px solid ${status === 'success' ? 'rgba(46,204,113,0.25)' : 'rgba(231,76,60,0.25)'}`,
          }}>{message}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13, cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            onClick={send}
            disabled={status === 'sending' || status === 'success'}
            style={{
              flex: 1, padding: '10px 0',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: status === 'success' ? '#2ecc71' : 'var(--amber)',
              color: '#000',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: status === 'sending' ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {status === 'sending' ? 'Sending…' : status === 'success' ? '✓ Sent' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({ sessionId, summary, onForecastUpdate }) {
  const navigate = useNavigate()
  const {
    products, forecast, history, loading, error,
    loadProducts, runForecast, selectFromHistory, removeFromHistory,
  } = useForecast(sessionId)

  const [activeTab,   setActiveTab]   = useState('products')
  const [showEmail,   setShowEmail]   = useState(false)

  useEffect(() => {
    if (!sessionId) { navigate('/'); return }
    loadProducts()
  }, [sessionId])

  if (!sessionId) return null

  const handleForecast = async (store, item, horizon) => {
    try {
      const data = await runForecast(store, item, horizon)
      if (data && onForecastUpdate) onForecastUpdate(data)
    } catch (_) {}
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, animation: 'fadeUp 0.4s ease both' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', marginBottom: 2 }}>
            Forecast Dashboard
          </h2>
          {summary && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
              {summary.products} products · {summary.stores} stores · {summary.date_min} → {summary.date_max}
            </p>
          )}
        </div>

        {error && (
          <div style={{
            marginLeft: 'auto',
            padding: '8px 14px',
            background: 'rgba(231,76,60,0.08)',
            border: '1px solid rgba(231,76,60,0.3)',
            borderRadius: 'var(--radius-md)',
            fontSize: 12, color: 'var(--red)', maxWidth: 360,
          }}>{error}</div>
        )}

        {forecast && (
          <div style={{ marginLeft: error ? 0 : 'auto', display: 'flex', gap: 8 }}>
            {/* Download CSV button */}
            <ActionButton icon="↓" label="Export CSV" onClick={() => downloadCSV(forecast)} />
            {/* Email button */}
            <ActionButton icon="✉" label="Email Report" onClick={() => setShowEmail(true)} amber />
          </div>
        )}
      </div>

      {/* Main grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 260px',
        gap: 16,
        alignItems: 'start',
        animation: 'fadeUp 0.4s ease 0.1s both',
      }}>

        {/* Left — controls + products/history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={PANEL_STYLE}>
            <div style={PANEL_HEADER}>
              <span style={PANEL_TITLE}>Configure</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>
                {products.length} products
              </span>
            </div>
            <div style={{ padding: 16 }}>
              <ProductSelector products={products} onForecast={handleForecast} loading={loading} />
            </div>
          </div>

          <div style={PANEL_STYLE}>
            <div style={PANEL_HEADER}>
              <div style={{ display: 'flex', gap: 12 }}>
                {['products', 'history'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      background: 'none',
                      fontSize: 11,
                      fontFamily: 'var(--font-display)',
                      color: activeTab === tab ? 'var(--amber)' : 'var(--text-tertiary)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      borderBottom: activeTab === tab ? '1px solid var(--amber)' : '1px solid transparent',
                      paddingBottom: 2,
                      transition: 'var(--transition)',
                    }}
                  >{tab}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: 12, maxHeight: 340, overflowY: 'auto' }}>
              {activeTab === 'products' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {products.map((p) => (
                    <div key={p.product_id} style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                    }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-secondary)' }}>
                        {p.product_id}
                      </span>
                      <StatusBadge segment={p.segment} size="sm" />
                    </div>
                  ))}
                </div>
              ) : (
                <HistoryPanel
                  history={history}
                  onSelect={selectFromHistory}
                  onDelete={removeFromHistory}
                  activeForecastId={forecast?.forecast_id}
                />
              )}
            </div>
          </div>
        </div>

        {/* Centre — chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {forecast && (
            <div style={{
              padding: '14px 20px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <div>
                <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 4 }}>PRODUCT</p>
                <p style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>{forecast.product_id}</p>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 4 }}>AVG FORECAST</p>
                <p style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--amber)' }}>
                  {fmtNum(forecast.point_forecast.reduce((a,b)=>a+b,0)/forecast.point_forecast.length)}{' '}
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>units/day</span>
                </p>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />
              <StatusBadge segment={forecast.segment} />
              <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
                {fmtShortDate(forecast.forecast_dates[0])} → {fmtShortDate(forecast.forecast_dates.at(-1))}
              </div>
            </div>
          )}

          <div style={PANEL_STYLE}>
            <div style={PANEL_HEADER}>
              <span style={PANEL_TITLE}>
                {forecast ? `${forecast.horizon}d Demand Forecast` : 'Demand Forecast'}
              </span>
            </div>
            <div style={{ padding: '16px 12px 12px' }}>
              {loading ? (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', animation: 'pulse 0.8s infinite' }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>RUNNING MODEL...</span>
                </div>
              ) : (
                <ForecastChart forecast={forecast} />
              )}
            </div>
          </div>
        </div>

        {/* Right — metrics */}
        <div style={PANEL_STYLE}>
          <div style={PANEL_HEADER}><span style={PANEL_TITLE}>Model Metrics</span></div>
          <div style={{ padding: 16 }}>
            {forecast ? (
              <MetricsPanel forecast={forecast} />
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-display)' }}>
                RUN A FORECAST<br />TO SEE METRICS
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email modal */}
      {showEmail && forecast && (
        <EmailModal
          sessionId={sessionId}
          forecast={forecast}
          onClose={() => setShowEmail(false)}
        />
      )}
    </div>
  )
}

function ActionButton({ icon, label, onClick, amber }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '8px 14px',
        background: amber ? (hover ? 'rgba(245,166,35,0.15)' : 'rgba(245,166,35,0.08)') : 'var(--bg-elevated)',
        border: `1px solid ${amber ? (hover ? 'var(--amber)' : 'rgba(245,166,35,0.4)') : (hover ? 'var(--amber)' : 'var(--border)')}`,
        borderRadius: 'var(--radius-md)',
        fontSize: 12, fontWeight: 500,
        color: amber ? 'var(--amber)' : 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: 6,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <span>{icon}</span> {label}
    </button>
  )
}
