import { fmtPct, fmtNum } from '../utils/format'

const MODEL_DEFS = [
  {
    key:   'random_forest',
    label: 'Random Forest',
    color: '#4a9eff',
    type:  'Bagging Ensemble',
    desc:  'Trains hundreds of decision trees on random subsets of data and features, then averages predictions. Robust to outliers and noisy data. Serves as a stable baseline that rarely overfits.',
    bullets: ['Handles missing values', 'Robust to outliers', 'No scaling required'],
    footer:  'Baseline tree model: highest stability, moderate accuracy.',
  },
  {
    key:   'xgboost',
    label: 'XGBoost',
    color: '#2ecc71',
    type:  'Gradient Boosting',
    desc:  'Builds trees sequentially where each tree corrects errors of the previous one. Optimised with Optuna hyperparameter tuning across 40 trials using TimeSeriesSplit cross-validation.',
    bullets: ['Tuned with Optuna', 'Handles non-linearity', 'Fast training'],
    footer:  'Strong on complex seasonal patterns.',
  },
  {
    key:   'lightgbm',
    label: 'LightGBM',
    color: '#9b59b6',
    type:  'Fast Gradient Boosting',
    desc:  'Leaf-wise tree growth strategy makes it faster and more memory-efficient than XGBoost on large datasets. Typically achieves the best individual WMAPE on retail demand data.',
    bullets: ['Best single WMAPE', 'Memory efficient', 'Handles 500+ products'],
    footer:  'Usually the best-performing individual model.',
  },
  {
    key:   'ensemble',
    label: 'NNLS Ensemble',
    color: '#f5a623',
    type:  'Non-Negative Least Squares',
    desc:  'Learns optimal non-negative weights for combining all three base models using out-of-fold predictions. Weights sum to 1 and are always ≥ 0, guaranteeing performance at least as good as the best base model.',
    bullets: ['Learned weights', 'No negative coefficients', 'Best generalisation'],
    footer:  'Default model. Combines strengths of all three.',
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────
function MetricPill({ label, value, sub }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--bg-base)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      minWidth: 90,
    }}>
      <p style={{ fontSize: 9, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--amber)', lineHeight: 1, marginBottom: 2 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{sub}</p>}
    </div>
  )
}

function ModelCard({ def, metrics, isBest }) {
  const { label, color, type, desc, bullets, footer } = def

  return (
    <div style={{
      padding: '24px 22px',
      background: 'var(--bg-surface)',
      border: `1px solid ${isBest ? color : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      boxShadow: isBest ? `0 0 0 1px ${color}33, 0 4px 24px ${color}18` : 'none',
      position: 'relative',
      transition: 'border-color 0.2s',
    }}>
      {/* BEST badge */}
      {isBest && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          padding: '2px 8px', borderRadius: 4,
          background: `${color}22`, border: `1px solid ${color}55`,
          fontSize: 9, fontFamily: 'var(--font-display)',
          color, letterSpacing: '0.1em', fontWeight: 700,
        }}>BEST ★</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}88` }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      </div>

      {/* Type tag */}
      <p style={{ fontSize: 9, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{type}</p>

      {/* Live metrics row — only when data available */}
      {metrics && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <MetricPill label="WMAPE" value={fmtPct(metrics.wmape)} sub="lower is better" />
          <MetricPill label="MAE"   value={fmtNum(metrics.mae, 2)} sub="mean abs. error" />
        </div>
      )}

      {/* Description */}
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{desc}</p>

      {/* Bullet points */}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {bullets.map((b) => (
          <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {b}
          </li>
        ))}
      </ul>

      {/* Footer */}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 'auto' }}>{footer}</p>
    </div>
  )
}

// ── Band coverage card ────────────────────────────────────────────────────────
function CoverageCard({ pi }) {
  if (!pi) return null
  const pct     = fmtPct(pi.actual_coverage)
  const target  = fmtPct(pi.target_coverage)
  const onTarget = pi.actual_coverage >= pi.target_coverage * 0.9

  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 16,
    }}>
      <div>
        <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          80% Prediction Band Coverage
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Fraction of actual values that fell inside the confidence band on the test set
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 32, fontFamily: 'var(--font-display)', fontWeight: 700, color: onTarget ? '#2ecc71' : 'var(--amber)' }}>{pct}</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>target {target}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Models({ forecast }) {
  const m        = forecast?.model_metrics || {}
  const hasLive  = Object.keys(m).length > 0

  // Find the best model by lowest WMAPE
  const candidates = MODEL_DEFS
    .map(({ key }) => ({ key, wmape: m[key]?.wmape ?? Infinity }))
    .filter(({ wmape }) => wmape < Infinity)
  const bestKey = candidates.length
    ? candidates.reduce((a, b) => (a.wmape < b.wmape ? a : b)).key
    : null

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
          Model Insights
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          ML Model Architecture
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {hasLive
            ? `Live performance metrics from forecast on product ${forecast.product_id} (${forecast.horizon}d horizon).`
            : 'Run a forecast on the dashboard to see live performance metrics here.'}
        </p>
      </div>

      {/* Model cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}>
        {MODEL_DEFS.map((def) => (
          <ModelCard
            key={def.key}
            def={def}
            metrics={m[def.key] ?? null}
            isBest={def.key === bestKey}
          />
        ))}
      </div>

      {/* Band coverage */}
      {m.prediction_interval && <CoverageCard pi={m.prediction_interval} />}
    </div>
  )
}
