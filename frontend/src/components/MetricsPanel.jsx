import { fmtNum, fmtPct } from '../utils/format'
import { MODELS } from './ModelToggle'

const MODEL_DESCRIPTIONS = {
  random_forest: 'Bagging — baseline tree model',
  xgboost:       'Gradient boosting — XGBoost',
  lightgbm:      'Fast boosting — LightGBM',
  ensemble:      'NNLS weighted combination',
}

export default function MetricsPanel({ forecast }) {
  if (!forecast) return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-display)' }}>
      RUN A FORECAST<br />TO SEE METRICS
    </div>
  )

  const m = forecast.model_metrics || {}
  const pi = m.prediction_interval

  const modelsWithMetrics = MODELS.filter(({ key }) => m[key])
  const bestKey = modelsWithMetrics.reduce((best, { key }) =>
    !best || (m[key]?.wmape < m[best]?.wmape) ? key : best, null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Model Performance
      </p>

      {MODELS.map(({ key, label, color }) => {
        const metrics = m[key]
        if (!metrics) return null
        const isBest = key === bestKey

        return (
          <div key={key} style={{
            padding: '12px 14px',
            background: isBest ? 'var(--amber-glow)' : 'var(--bg-elevated)',
            border: `1px solid ${isBest ? 'var(--amber)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, color: isBest ? 'var(--amber)' : 'var(--text-primary)', letterSpacing: '0.04em' }}>
                  {label}
                </span>
              </div>
              {isBest && (
                <span style={{ fontSize: 9, fontFamily: 'var(--font-display)', color: 'var(--amber)', letterSpacing: '0.08em' }}>BEST ★</span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <p style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em', marginBottom: 2 }}>WMAPE</p>
                <p style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, color: isBest ? 'var(--amber)' : 'var(--text-primary)' }}>
                  {fmtPct(metrics.wmape)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em', marginBottom: 2 }}>MAE</p>
                <p style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {fmtNum(metrics.mae, 2)}
                </p>
              </div>
            </div>

            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {MODEL_DESCRIPTIONS[key]}
            </p>
          </div>
        )
      })}

      {pi && (
        <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>80% band coverage</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>
            {fmtPct(pi.actual_coverage)}
          </span>
        </div>
      )}

      <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Horizon</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--amber)', fontWeight: 700 }}>{forecast.horizon}d</span>
      </div>
    </div>
  )
}
