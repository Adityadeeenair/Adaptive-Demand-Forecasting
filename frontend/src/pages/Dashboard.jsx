import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductSelector from '../components/ProductSelector'
import ForecastChart from '../components/ForecastChart'
import CompareChart from '../components/CompareChart'
import MetricsPanel from '../components/MetricsPanel'
import HistoryPanel from '../components/HistoryPanel'
import StatusBadge from '../components/StatusBadge'
import AmbientHarmonicsCanvas from '../components/AmbientHarmonicsCanvas'
import {
  ForecastStandbyDeck,
  InferenceTelemetryDeck,
  MetricsStandbyDeck,
} from '../components/DashboardStandby'
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

// ── CSV download ──────────────────────────────────────────────────────────────
function downloadCSV(forecast) {
  const rows = [
    ['date', 'store', 'item', 'predicted_sales', 'lower_bound', 'upper_bound'],
    ...forecast.forecast_dates.map((d, i) => [
      d, forecast.store, forecast.item,
      forecast.point_forecast[i], forecast.lower_bound[i], forecast.upper_bound[i],
    ]),
  ]
  const csv  = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `forecast_${forecast.product_id}_${forecast.horizon}d.csv`
  a.click()
}

// ── Email modal ───────────────────────────────────────────────────────────────
function EmailModal({ sessionId, forecast, onClose }) {
  const [email, setEmail]     = useState('')
  const [status, setStatus]   = useState('idle')
  const [message, setMessage] = useState('')

  const send = async () => {
    if (!email.trim()) { setMessage('Please enter an email address.'); setStatus('error'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMessage('Invalid email address.'); setStatus('error'); return }
    setStatus('sending'); setMessage('')
    try {
      await api.sendEmail(sessionId, email)
      setStatus('success'); setMessage('Forecast sent! Check your inbox.')
    } catch (err) {
      setStatus('error'); setMessage(err.message || 'Failed to send email.')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 28, width: 380, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Email Forecast Report</h3>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--text-tertiary)', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', marginBottom: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div><span style={{ color: 'var(--text-tertiary)' }}>Product:</span> {forecast.product_id}</div>
          <div><span style={{ color: 'var(--text-tertiary)' }}>Horizon:</span> {forecast.horizon} days</div>
          <div><span style={{ color: 'var(--text-tertiary)' }}>Avg forecast:</span> {fmtNum(forecast.point_forecast.reduce((a, b) => a + b, 0) / forecast.point_forecast.length)} units/day</div>
        </div>
        <label style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>EMAIL ADDRESS</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="you@example.com" disabled={status === 'sending' || status === 'success'}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', marginBottom: 14 }} />
        {message && (
          <p style={{ fontSize: 12, marginBottom: 12, color: status === 'success' ? '#2ecc71' : '#e74c3c', padding: '8px 12px', borderRadius: 6, background: status === 'success' ? 'rgba(46,204,113,0.08)' : 'rgba(231,76,60,0.08)', border: `1px solid ${status === 'success' ? 'rgba(46,204,113,0.25)' : 'rgba(231,76,60,0.25)'}` }}>{message}</p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={send} disabled={status === 'sending' || status === 'success'}
            style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none', background: status === 'success' ? '#2ecc71' : 'var(--amber)', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: status === 'sending' ? 0.6 : 1, transition: 'all 0.2s' }}>
            {status === 'sending' ? 'Sending…' : status === 'success' ? '✓ Sent' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Forecast Takeaway Banner ──────────────────────────────────────────────────
function ForecastTakeaway({ forecast }) {
  if (!forecast || !forecast.point_forecast?.length) return null

  const pf = forecast.point_forecast
  const hs = forecast.history_sales || []
  const avgFc = pf.reduce((a, b) => a + b, 0) / pf.length
  const recentHist = hs.slice(-Math.min(hs.length, pf.length))
  const avgHist = recentHist.length ? recentHist.reduce((a, b) => a + b, 0) / recentHist.length : avgFc
  const pct = avgHist > 0 ? ((avgFc - avgHist) / avgHist) * 100 : 0

  const maxFc = Math.max(...pf)
  const peakIdx = pf.indexOf(maxFc)
  const peakDate = forecast.forecast_dates?.[peakIdx] ? fmtShortDate(forecast.forecast_dates[peakIdx]) : null

  let tone = '#f5a623'
  let label = 'Steady Run-Rate'
  let actionAdvice = ''

  if (pct >= 5) {
    tone = '#2ecc71'
    label = `Trending Up (+${pct.toFixed(1)}%)`
    actionAdvice = `Expect volume expansion vs recent run-rate. Peak load projected on ${peakDate} (~${fmtNum(maxFc)} units). Place replenishment orders 2 to 3 days ahead to prevent stockouts.`
  } else if (pct <= -5) {
    tone = '#4a9eff'
    label = `Trending Down (${pct.toFixed(1)}%)`
    actionAdvice = `Projected order pace is easing (~${fmtNum(avgFc)} units/day). Maintain lean safety stock to avoid tied-up working capital.`
  } else {
    tone = 'var(--amber)'
    label = 'Consistent Run-Rate'
    actionAdvice = `Demand stays balanced near baseline (~${fmtNum(avgFc)} units/day). Suitable for automated scheduled reordering with standard safety buffer.`
  }

  return (
    <div style={{
      padding: '12px 18px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: `1px solid ${tone}33`,
      borderLeft: `3px solid ${tone}`,
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{
        fontSize: 9,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        color: tone,
        background: `${tone}18`,
        border: `1px solid ${tone}44`,
        padding: '3px 8px',
        borderRadius: 4,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
        {actionAdvice}
      </p>
    </div>
  )
}

// ── Compact compare product selector ─────────────────────────────────────────
function CompareSelector({ products, sessionId, horizon, onCompare, onClear, loading, compareForecast }) {
  const [store, setStore] = useState('')
  const [item, setItem]   = useState('')

  const stores = [...new Set(products.map(p => String(p.store)))].sort((a, b) => {
    const na = Number(a), nb = Number(b)
    return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b)
  })
  const items = products.filter(p => !store || String(p.store) === store).map(p => String(p.item))

  const sel = { fontSize: 12, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', cursor: 'pointer', appearance: 'none', width: '100%' }

  const handleRun = () => {
    if (!store || !item) return
    onCompare(store, item, horizon)
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: '#4a9eff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Compare With</p>
        <button onClick={onClear} style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>✕ Clear</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select value={store} onChange={e => { setStore(e.target.value); setItem('') }} style={sel}>
          <option value="">Store...</option>
          {stores.map(s => <option key={s} value={s}>Store {s}</option>)}
        </select>
        <select value={item} onChange={e => setItem(e.target.value)} style={sel} disabled={!store}>
          <option value="">Item...</option>
          {items.map(i => <option key={i} value={i}>Item {i}</option>)}
        </select>
        <button onClick={handleRun} disabled={!store || !item || loading}
          style={{ padding: '8px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', color: (!store || !item || loading) ? 'var(--text-tertiary)' : '#000', background: (!store || !item || loading) ? 'var(--bg-elevated)' : '#4a9eff', border: `1px solid ${(!store || !item || loading) ? 'var(--border)' : '#4a9eff'}`, cursor: (!store || !item || loading) ? 'not-allowed' : 'pointer', transition: 'var(--transition)' }}>
          {loading ? 'Loading…' : compareForecast ? '↺ Update' : 'Compare →'}
        </button>
      </div>
      {compareForecast && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 'var(--radius-md)', fontSize: 11, color: '#4a9eff', fontFamily: 'var(--font-display)' }}>
          Comparing: {compareForecast.product_id}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard({ sessionId, summary, onForecastUpdate }) {
  const navigate = useNavigate()
  const {
    products, forecast, history, loading, error,
    loadProducts, runForecast, selectFromHistory, removeFromHistory,
  } = useForecast(sessionId)

  const [activeTab,       setActiveTab]       = useState('products')
  const [showEmail,       setShowEmail]       = useState(false)
  // Compare state
  const [compareMode,     setCompareMode]     = useState(false)
  const [compareForecast, setCompareForecast] = useState(null)
  const [compareLoading,  setCompareLoading]  = useState(false)
  const [horizon,         setHorizon]         = useState(30)
  const [selectedStore,   setSelectedStore]   = useState('')
  const [selectedItem,    setSelectedItem]    = useState('')

  useEffect(() => {
    if (!sessionId) { navigate('/'); return }
    loadProducts()
  }, [sessionId])

  // Clear comparison when main forecast changes (different product)
  useEffect(() => {
    setCompareForecast(null)
  }, [forecast?.product_id])

  if (!sessionId) return null

  const handleForecast = async (store, item, h) => {
    setHorizon(h)
    setSelectedStore(String(store))
    setSelectedItem(String(item))
    try {
      const data = await runForecast(store, item, h)
      if (data && onForecastUpdate) onForecastUpdate(data)
    } catch (_) {}
  }

  const handleSelectProduct = (store, item) => {
    setSelectedStore(String(store))
    setSelectedItem(String(item))
  }

  const handleSelectAndRun = (store, item, h = 30) => {
    setSelectedStore(String(store))
    setSelectedItem(String(item))
    handleForecast(store, item, h)
  }

  const handleCompare = async (store, item, h) => {
    setCompareLoading(true)
    try {
      const data = await api.forecast(sessionId, store, item, h || horizon)
      setCompareForecast(data)
    } catch (err) {
      console.error('Compare forecast failed:', err.message)
    } finally {
      setCompareLoading(false)
    }
  }

  const handleClearCompare = () => {
    setCompareForecast(null)
    setCompareMode(false)
  }

  const showCompareChart = compareMode && compareForecast && forecast

  return (
    <div style={{
      position: 'relative',
      minHeight: 'calc(100vh - 56px)',
      overflow: 'hidden',
      padding: '24px 32px 48px',
    }}>
      {/* Living Harmonic Waveform Canvas (Mathematical Time-Series Flow) */}
      <AmbientHarmonicsCanvas />

      {/* Gentle center radial aura */}
      <div style={{
        position: 'absolute',
        top: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 960,
        height: 480,
        background: 'radial-gradient(ellipse 65% 45% at 50% 20%, rgba(245, 166, 35, 0.08) 0%, rgba(74, 158, 255, 0.03) 50%, transparent 75%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, animation: 'fadeUp 0.4s ease both' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', margin: 0 }}>
                Forecast Dashboard
              </h2>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                background: 'var(--amber-glow)',
                border: '1px solid var(--amber-dim)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--amber)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
                <span>INFERENCE DESK</span>
              </div>
            </div>
            {summary && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                {summary.products} products · {summary.stores} stores · {summary.date_min} to {summary.date_max}
              </p>
            )}
          </div>

          {error && (
            <div style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              background: 'rgba(231,76,60,0.08)',
              border: '1px solid rgba(231,76,60,0.3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--red)',
              maxWidth: 420,
            }}>
              <span>{error}</span>
              <button
                onClick={() => navigate('/upload')}
                style={{
                  padding: '3px 8px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Re-upload dataset →
              </button>
            </div>
          )}

          {forecast && (
            <div style={{ marginLeft: error ? 0 : 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Compare toggle */}
              <ActionButton
                icon="⇄"
                label={compareMode ? 'Single View' : 'Compare Products'}
                onClick={() => { setCompareMode(v => !v); if (compareMode) setCompareForecast(null) }}
                active={compareMode}
              />
              <ActionButton icon="↓" label="Export CSV" onClick={() => downloadCSV(forecast)} />
              <ActionButton icon="✉" label="Email Report" onClick={() => setShowEmail(true)} amber />
            </div>
          )}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr 270px', gap: 18, alignItems: 'start', animation: 'fadeUp 0.4s ease 0.1s both' }}>

          {/* Left column: controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={PANEL_STYLE}>
              <div style={PANEL_HEADER}>
                <span style={PANEL_TITLE}>Configure</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{products.length} products</span>
              </div>
              <div style={{ padding: 16 }}>
                <ProductSelector
                  products={products}
                  onForecast={handleForecast}
                  loading={loading}
                  selectedStore={selectedStore}
                  selectedItem={selectedItem}
                  onStoreChange={(s) => setSelectedStore(s)}
                  onItemChange={(i) => setSelectedItem(i)}
                />
                {/* Compare selector: shown only when compare mode is on and main forecast exists */}
                {compareMode && forecast && (
                  <CompareSelector
                    products={products}
                    sessionId={sessionId}
                    horizon={horizon}
                    onCompare={handleCompare}
                    onClear={handleClearCompare}
                    loading={compareLoading}
                    compareForecast={compareForecast}
                  />
                )}
              </div>
            </div>

            <div style={PANEL_STYLE}>
              <div style={PANEL_HEADER}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {['products', 'history'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: 'none', fontSize: 11, fontFamily: 'var(--font-display)', color: activeTab === tab ? 'var(--amber)' : 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: activeTab === tab ? '1px solid var(--amber)' : '1px solid transparent', paddingBottom: 2, transition: 'var(--transition)' }}>{tab}</button>
                  ))}
                </div>
              </div>
              <div style={{ padding: 12, maxHeight: 360, overflowY: 'auto' }}>
                {activeTab === 'products' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {products.map(p => {
                      const isCurrent = forecast?.product_id === p.product_id
                      const isSelected = String(selectedStore) === String(p.store) && String(selectedItem) === String(p.item)
                      return (
                        <div
                          key={p.product_id}
                          onClick={() => handleSelectProduct(p.store, p.item)}
                          style={{
                            padding: '9px 12px',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            background: isCurrent ? 'var(--amber-glow)' : isSelected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                            border: `1px solid ${isCurrent ? 'var(--amber)' : isSelected ? 'var(--amber-dim)' : 'var(--border)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: isCurrent ? 'var(--amber)' : 'var(--text-tertiary)',
                            }} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--amber)' : 'var(--text-primary)' }}>
                              {p.product_id}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StatusBadge segment={p.segment} size="sm" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectAndRun(p.store, p.item, horizon)
                              }}
                              title="Run forecast for this SKU"
                              style={{
                                padding: '3px 7px',
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                borderRadius: 4,
                                fontSize: 10,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--amber)'
                                e.currentTarget.style.color = '#000'
                                e.currentTarget.style.borderColor = 'var(--amber)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                                e.currentTarget.style.color = 'var(--text-secondary)'
                                e.currentTarget.style.borderColor = 'var(--border)'
                              }}
                            >
                              Run →
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <HistoryPanel history={history} onSelect={selectFromHistory} onDelete={removeFromHistory} activeForecastId={forecast?.forecast_id} />
                )}
              </div>
            </div>
          </div>

          {/* Centre column: chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {forecast && !showCompareChart && (
              <div style={{ padding: '14px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 4 }}>PRODUCT</p>
                  <p style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>{forecast.product_id}</p>
                </div>
                <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 4 }}>AVG FORECAST</p>
                  <p style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--amber)' }}>
                    {fmtNum(forecast.point_forecast.reduce((a, b) => a + b, 0) / forecast.point_forecast.length)}{' '}
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

            {forecast && !showCompareChart && (
              <ForecastTakeaway forecast={forecast} />
            )}

            {showCompareChart && (
              <div style={{ padding: '14px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a9eff' }} />
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>{forecast.product_id}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>avg {fmtNum(forecast.point_forecast.reduce((a,b)=>a+b,0)/forecast.point_forecast.length)}</span>
                </div>
                <span style={{ color: 'var(--border)' }}>vs</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f5a623' }} />
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>{compareForecast.product_id}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>avg {fmtNum(compareForecast.point_forecast.reduce((a,b)=>a+b,0)/compareForecast.point_forecast.length)}</span>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
                  {forecast.horizon}d horizon
                </span>
              </div>
            )}

            <div style={PANEL_STYLE}>
              <div style={PANEL_HEADER}>
                <span style={PANEL_TITLE}>
                  {showCompareChart ? 'Product Comparison' : forecast ? `${forecast.horizon}d Demand Forecast` : 'Demand Forecast'}
                </span>
                {forecast && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    {forecast.product_id} · {forecast.horizon}d horizon
                  </span>
                )}
              </div>
              <div style={{ padding: '16px' }}>
                {(loading || compareLoading) ? (
                  <InferenceTelemetryDeck />
                ) : showCompareChart ? (
                  <CompareChart forecastA={forecast} forecastB={compareForecast} />
                ) : forecast ? (
                  <ForecastChart forecast={forecast} />
                ) : (
                  <ForecastStandbyDeck
                    products={products}
                    onSelectAndRun={handleSelectAndRun}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right column: metrics */}
          <div style={PANEL_STYLE}>
            <div style={PANEL_HEADER}>
              <span style={PANEL_TITLE}>Model Metrics</span>
              {forecast && (
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.06em' }}>
                  ACTIVE
                </span>
              )}
            </div>
            <div style={{ padding: 16 }}>
              {forecast ? (
                <MetricsPanel forecast={forecast} />
              ) : (
                <MetricsStandbyDeck />
              )}
            </div>
          </div>
        </div>

        {showEmail && forecast && (
          <EmailModal sessionId={sessionId} forecast={forecast} onClose={() => setShowEmail(false)} />
        )}
      </div>
    </div>
  )
}

function ActionButton({ icon, label, onClick, amber, active }) {
  const [hover, setHover] = useState(false)
  const isActive = active || amber
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: '8px 14px', background: isActive ? (hover ? 'rgba(245,166,35,0.15)' : 'rgba(245,166,35,0.08)') : 'var(--bg-elevated)', border: `1px solid ${isActive ? (hover ? 'var(--amber)' : 'rgba(245,166,35,0.4)') : (hover ? 'var(--amber)' : 'var(--border)')}`, borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500, color: isActive ? 'var(--amber)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.15s' }}>
      <span>{icon}</span> {label}
    </button>
  )
}
