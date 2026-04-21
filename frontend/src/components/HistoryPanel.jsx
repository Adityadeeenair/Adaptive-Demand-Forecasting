import StatusBadge from './StatusBadge'
import { fmtNum, fmtDate } from '../utils/format'

export default function HistoryPanel({ history, onSelect, onDelete, activeForecastId }) {
  if (!history.length) return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-display)' }}>
      NO HISTORY YET
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {history.map((f) => {
        const isActive = f.forecast_id === activeForecastId
        return (
          <div
            key={f.forecast_id}
            onClick={() => onSelect(f.forecast_id)}
            style={{
              padding: '12px 14px',
              background: isActive ? 'var(--amber-glow)' : 'var(--bg-surface)',
              border: `1px solid ${isActive ? 'var(--amber)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'var(--transition)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: isActive ? 'var(--amber)' : 'var(--text-primary)' }}>
                  {f.product_id}
                </span>
                <StatusBadge segment={f.segment} size="sm" />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {f.horizon}d horizon
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  avg {fmtNum(f.avg_forecast)} units
                </span>
              </div>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onDelete(f.forecast_id) }}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                fontSize: 12,
                borderRadius: 'var(--radius-sm)',
                transition: 'var(--transition)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.target.style.color = 'var(--red)'; e.target.style.background = 'rgba(231,76,60,0.1)' }}
              onMouseLeave={(e) => { e.target.style.color = 'var(--text-tertiary)'; e.target.style.background = 'transparent' }}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
