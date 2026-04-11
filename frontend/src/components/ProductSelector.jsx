import { useState, useEffect } from 'react'
import StatusBadge from './StatusBadge'

const HORIZONS = [7, 14, 30, 60, 90]

const selectStyle = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 36,
  transition: 'var(--transition)',
}

export default function ProductSelector({ products, onForecast, loading }) {
  const [store, setStore]     = useState('')
  const [item, setItem]       = useState('')
  const [horizon, setHorizon] = useState(30)

  const stores = [...new Set(products.map((p) => p.store))].sort((a, b) => a - b)
  const items  = products.filter((p) => !store || p.store === Number(store))
                         .map((p) => p.item)
  const selected = products.find((p) => p.store === Number(store) && p.item === Number(item))

  useEffect(() => { setItem('') }, [store])

  const handleSubmit = () => {
    if (!store || !item) return
    onForecast(Number(store), Number(item), horizon)
  }

  const label = (text) => (
    <label style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
      {text}
    </label>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div>
        {label('Store')}
        <select value={store} onChange={(e) => setStore(e.target.value)} style={selectStyle}>
          <option value="">Select store...</option>
          {stores.map((s) => <option key={s} value={s}>Store {s}</option>)}
        </select>
      </div>

      <div>
        {label('Item')}
        <select value={item} onChange={(e) => setItem(e.target.value)} style={selectStyle} disabled={!store}>
          <option value="">Select item...</option>
          {items.map((i) => <option key={i} value={i}>Item {i}</option>)}
        </select>
      </div>

      {selected && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Segment</span>
          <StatusBadge segment={selected.segment} size="sm" />
        </div>
      )}

      <div>
        {label('Horizon')}
        <div style={{ display: 'flex', gap: 6 }}>
          {HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: horizon === h ? 'var(--bg-base)' : 'var(--text-secondary)',
                background: horizon === h ? 'var(--amber)' : 'var(--bg-elevated)',
                border: `1px solid ${horizon === h ? 'var(--amber)' : 'var(--border)'}`,
                transition: 'var(--transition)',
              }}
            >
              {h}d
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!store || !item || loading}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--font-body)',
          color: (!store || !item || loading) ? 'var(--text-tertiary)' : 'var(--bg-base)',
          background: (!store || !item || loading) ? 'var(--bg-elevated)' : 'var(--amber)',
          border: `1px solid ${(!store || !item || loading) ? 'var(--border)' : 'var(--amber)'}`,
          transition: 'var(--transition)',
          cursor: (!store || !item || loading) ? 'not-allowed' : 'pointer',
          letterSpacing: '0.02em',
        }}
      >
        {loading ? 'Generating...' : 'Run Forecast →'}
      </button>
    </div>
  )
}
