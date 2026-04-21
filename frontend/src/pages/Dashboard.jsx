import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductSelector from '../components/ProductSelector'
import ForecastChart from '../components/ForecastChart'
import MetricsPanel from '../components/MetricsPanel'
import HistoryPanel from '../components/HistoryPanel'
import StatusBadge from '../components/StatusBadge'
import ModelToggle from '../components/ModelToggle'
import { useForecast } from '../hooks/useForecast'
import { fmtNum } from '../utils/format'

const PANEL = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }
const PH    = { padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const PT    = { fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }

function downloadCSV(forecast, activeModel) {
  const preds = forecast.model_predictions?.[activeModel] || forecast.point_forecast
  const rows = [
    ['date', 'forecast', 'lower_bound', 'upper_bound'],
    ...forecast.forecast_dates.map((d, i) => [d, preds[i], forecast.lower_bound[i], forecast.upper_bound[i]]),
  ]
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `forecast_${forecast.product_id}_${activeModel}_${forecast.horizon}d.csv`
  a.click()
}

export default function Dashboard({ sessionId, summary, onForecastUpdate }) {
  const navigate = useNavigate()
  const { products, forecast, history, loading, error, loadProducts, runForecast, selectFromHistory, removeFromHistory } = useForecast(sessionId)
  const [activeTab,   setActiveTab]   = useState('products')
  const [activeModel, setActiveModel] = useState('ensemble')
  const [showAll,     setShowAll]     = useState(false)

  useEffect(() => {
    if (!sessionId) { navigate('/'); return }
    loadProducts()
  }, [sessionId])

  if (!sessionId) return null

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1500, margin: '0 auto' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, animation: 'fadeUp 0.4s ease both' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Forecast Dashboard</h2>
          {summary && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
              {summary.products} products · {summary.stores} stores · {summary.date_min} → {summary.date_max}
            </p>
          )}
        </div>

        {error && (
          <div style={{ marginLeft: 'auto', padding: '8px 14px', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--red)', maxWidth: 360 }}>
            {error}
          </div>
        )}

        {forecast && (
          <button
            onClick={() => downloadCSV(forecast, activeModel)}
            style={{ marginLeft: error ? 0 : 'auto', padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', transition: 'var(--transition)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--amber)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            ↓ Export CSV
          </button>
        )}
      </div>

      {/* 3-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 260px', gap: 16, alignItems: 'start', animation: 'fadeUp 0.4s ease 0.1s both' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={PANEL}>
            <div style={PH}>
              <span style={PT}>Configure</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>{products.length} products</span>
            </div>
            <div style={{ padding: 16 }}>
              <ProductSelector products={products} onForecast={async (s, i, h) => { try { const fc = await runForecast(s, i, h); if(fc && onForecastUpdate) onForecastUpdate(fc); setActiveModel('ensemble'); setShowAll(false) } catch(_) {} }} loading={loading} />
            </div>
          </div>

          <div style={PANEL}>
            <div style={PH}>
              <div style={{ display: 'flex', gap: 12 }}>
                {['products', 'history'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: 'none', fontSize: 11, fontFamily: 'var(--font-display)', color: activeTab === tab ? 'var(--amber)' : 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: activeTab === tab ? '1px solid var(--amber)' : '1px solid transparent', paddingBottom: 2, transition: 'var(--transition)', cursor: 'pointer' }}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: 12, maxHeight: 340, overflowY: 'auto' }}>
              {activeTab === 'products' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {products.map(p => (
                    <div key={p.product_id} style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-secondary)' }}>{p.product_id}</span>
                      <StatusBadge segment={p.segment} size="sm" />
                    </div>
                  ))}
                </div>
              ) : (
                <HistoryPanel history={history} onSelect={selectFromHistory} onDelete={removeFromHistory} activeForecastId={forecast?.forecast_id} />
              )}
            </div>
          </div>
        </div>

        {/* Centre */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {forecast && (
            <div style={{ padding: '14px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 4 }}>PRODUCT</p>
                <p style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>{forecast.product_id}</p>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 4 }}>AVG FORECAST</p>
                <p style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--amber)' }}>
                  {fmtNum((forecast.model_predictions?.[activeModel] || forecast.point_forecast).reduce((a, b) => a + b, 0) / forecast.horizon)} <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>units/day</span>
                </p>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />
              <StatusBadge segment={forecast.segment} />
              <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
                {forecast.forecast_dates[0]} → {forecast.forecast_dates.at(-1)}
              </div>
            </div>
          )}

          <div style={PANEL}>
            <div style={PH}>
              <span style={PT}>{forecast ? `${forecast.horizon}d Demand Forecast` : 'Demand Forecast'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {!showAll && <LegendLine color="#4a9eff" label="Historical" />}
                {!showAll && <LegendLine color="var(--amber)" label="Forecast" />}
                {!showAll && <LegendLine color="var(--amber)" label="80% Band" dim />}
              </div>
            </div>

            {forecast && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <ModelToggle
                  activeModel={activeModel}
                  onModelChange={setActiveModel}
                  showAll={showAll}
                  onToggleAll={setShowAll}
                />
              </div>
            )}

            <div style={{ padding: '20px 12px 12px' }}>
              {loading ? (
                <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', animation: 'pulse 0.8s infinite' }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>RUNNING MODEL...</span>
                </div>
              ) : (
                <ForecastChart forecast={forecast} activeModel={activeModel} showAll={showAll} />
              )}
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={PANEL}>
          <div style={PH}><span style={PT}>Model Metrics</span></div>
          <div style={{ padding: 16 }}>
            <MetricsPanel forecast={forecast} />
          </div>
        </div>
      </div>
    </div>
  )
}

function LegendLine({ color, label, dim }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 20, height: 2, background: dim ? 'none' : color, borderRadius: 1, ...(dim ? { backgroundImage: `repeating-linear-gradient(90deg, ${color}55 0, ${color}55 4px, transparent 4px, transparent 8px)` } : {}) }} />
      <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  )
}
