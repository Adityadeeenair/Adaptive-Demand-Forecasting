const MODELS = [
  { key: 'ensemble',      label: 'Ensemble',      color: 'var(--amber)' },
  { key: 'random_forest', label: 'Random Forest', color: '#4a9eff' },
  { key: 'xgboost',       label: 'XGBoost',       color: '#2ecc71' },
  { key: 'lightgbm',      label: 'LightGBM',      color: '#9b59b6' },
]

export { MODELS }

export default function ModelToggle({ activeModel, onModelChange, showAll, onToggleAll }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {MODELS.map(({ key, label, color }) => {
          const active = activeModel === key && !showAll
          return (
            <button
              key={key}
              onClick={() => { onModelChange(key); if (showAll) onToggleAll(false) }}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: active ? 'var(--bg-base)' : 'var(--text-secondary)',
                background: active ? color : 'var(--bg-elevated)',
                border: `1px solid ${active ? color : 'var(--border)'}`,
                transition: 'var(--transition)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {!active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />}
              {label}
            </button>
          )
        })}
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

      <button
        onClick={() => onToggleAll(!showAll)}
        style={{
          padding: '5px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: showAll ? 'var(--bg-base)' : 'var(--text-tertiary)',
          background: showAll ? 'var(--text-secondary)' : 'var(--bg-elevated)',
          border: `1px solid ${showAll ? 'var(--text-secondary)' : 'var(--border)'}`,
          transition: 'var(--transition)',
          cursor: 'pointer',
        }}
      >
        Compare All
      </button>
    </div>
  )
}
