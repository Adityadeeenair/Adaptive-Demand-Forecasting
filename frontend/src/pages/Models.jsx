import { fmtPct, fmtNum } from '../utils/format'

const MODEL_INFO = [
  {
    key: 'random_forest',
    label: 'Random Forest',
    color: '#4a9eff',
    type: 'Bagging Ensemble',
    desc: 'Trains hundreds of decision trees on random subsets of data and features, then averages predictions. Robust to outliers and noisy data. Serves as a stable baseline that rarely overfits.',
    strengths: ['Handles missing values', 'Robust to outliers', 'No scaling required'],
    note: 'Baseline tree model — highest stability, moderate accuracy.',
  },
  {
    key: 'xgboost',
    label: 'XGBoost',
    color: '#2ecc71',
    type: 'Gradient Boosting',
    desc: 'Builds trees sequentially where each tree corrects errors of the previous one. Optimised with Optuna hyperparameter tuning across 40 trials using TimeSeriesSplit cross-validation.',
    strengths: ['Tuned with Optuna', 'Handles non-linearity', 'Fast training'],
    note: 'Strong on complex seasonal patterns.',
  },
  {
    key: 'lightgbm',
    label: 'LightGBM',
    color: '#9b59b6',
    type: 'Fast Gradient Boosting',
    desc: 'Leaf-wise tree growth strategy makes it faster and more memory-efficient than XGBoost on large datasets. Typically achieves the best individual WMAPE on retail demand data.',
    strengths: ['Best single WMAPE', 'Memory efficient', 'Handles 500+ products'],
    note: 'Usually the best-performing individual model.',
  },
  {
    key: 'ensemble',
    label: 'NNLS Ensemble',
    color: 'var(--amber)',
    type: 'Non-Negative Least Squares',
    desc: 'Learns optimal non-negative weights for combining all three base models using out-of-fold predictions. Weights sum to 1 and are always ≥ 0 — guaranteed at least as good as the best base model.',
    strengths: ['Learned weights', 'No negative coefficients', 'Best generalisation'],
    note: 'Default model. Combines strengths of all three.',
  },
]

function Bar({ value, max, color }) {
  return (
    <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${(value / max) * 100}%`,
        background: color,
        borderRadius: 3,
        transition: 'width 0.6s ease',
      }} />
    </div>
  )
}

export default function Models({ forecast }) {
  const m = forecast?.model_metrics || {}
  const hasMetrics = Object.keys(m).length > 0

  const maxWmape = hasMetrics
    ? Math.max(...MODEL_INFO.map(({ key }) => m[key]?.wmape || 0)) * 1.1
    : 0.15

  const bestKey = hasMetrics
    ? MODEL_INFO.reduce((b, { key }) => !b || (m[key]?.wmape < m[b]?.wmape) ? key : b, null)
    : null

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>

      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Model Insights</p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>ML Model Architecture</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {hasMetrics
            ? 'Performance metrics from the last forecast run. Run a forecast on the dashboard to populate live values.'
            : 'Run a forecast on the dashboard to see live performance metrics here.'}
        </p>
      </div>

      {/* Performance comparison bar chart */}
      {hasMetrics && (
        <div style={{
          padding: '24px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 24,
        }}>
          <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>WMAPE Comparison — lower is better</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {MODEL_INFO.map(({ key, label, color }) => {
              const metrics = m[key]
              if (!metrics) return null
              const isBest = key === bestKey
              return (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: isBest ? 600 : 400, color: isBest ? 'var(--amber)' : 'var(--text-primary)' }}>{label}</span>
                      {isBest && <span style={{ fontSize: 9, fontFamily: 'var(--font-display)', color: 'var(--amber)', letterSpacing: '0.08em' }}>BEST</span>}
                    </div>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: isBest ? 'var(--amber)' : 'var(--text-primary)' }}>
                      {fmtPct(metrics.wmape)}
                    </span>
                  </div>
                  <Bar value={metrics.wmape} max={maxWmape} color={color} />
                </div>
              )
            })}
          </div>

          {m.prediction_interval && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>80% prediction band coverage</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
                {fmtPct(m.prediction_interval.actual_coverage)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Model cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {MODEL_INFO.map(({ key, label, color, type, desc, strengths, note }) => {
          const metrics = m[key]
          const isBest  = key === bestKey
          return (
            <div key={key} style={{
              padding: '24px',
              background: 'var(--bg-surface)',
              border: `1px solid ${isBest ? 'var(--amber)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
              boxShadow: isBest ? 'var(--shadow-amber)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: isBest ? 'var(--amber)' : 'var(--text-primary)' }}>{label}</span>
                  </div>
                  {isBest && <span style={{ fontSize: 9, fontFamily: 'var(--font-display)', color: 'var(--amber)', letterSpacing: '0.08em' }}>★ BEST</span>}
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{type}</span>
              </div>

              {metrics && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[['WMAPE', fmtPct(metrics.wmape)], ['MAE', fmtNum(metrics.mae, 2)]].map(([l, v]) => (
                    <div key={l} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 9, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 4 }}>{l}</p>
                      <p style={{ fontSize: 17, fontFamily: 'var(--font-display)', fontWeight: 700, color: isBest && l === 'WMAPE' ? 'var(--amber)' : 'var(--text-primary)' }}>{v}</p>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{desc}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {strengths.map(s => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s}</span>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', paddingTop: 4, borderTop: '1px solid var(--border)' }}>{note}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
