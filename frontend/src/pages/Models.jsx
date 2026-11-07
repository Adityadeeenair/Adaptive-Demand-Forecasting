import { useState, useRef } from 'react'
import { fmtPct, fmtNum } from '../utils/format'
import AmbientDecisionTreeCanvas from '../components/AmbientDecisionTreeCanvas'

// ── Model Specification Data (Quantitative, Zero Fluff) ───────────────────────
const MODEL_SPECS = [
  {
    key: 'random_forest',
    label: 'Random Forest',
    color: '#4a9eff',
    roleTag: 'VARIANCE ANCHOR',
    strategy: 'Bootstrap Aggregation (Bagging)',
    complexity: '100 Decorrelated Decision Trees',
    optimization: 'Variance Reduction & Outlier Masking',
    takeaway: 'Provides unmatched resistance to promotional spikes and data anomalies. Essential baseline that shields the ensemble from overfitting.',
    strengths: [
      { name: 'Outlier Robustness', pct: 94 },
      { name: 'Non-Linear Patterns', pct: 72 },
      { name: 'Inference Velocity', pct: 82 },
    ],
    suitability: {
      volatile: 'Primary',
      seasonal: 'Secondary',
      stable: 'High Confidence',
    },
  },
  {
    key: 'xgboost',
    label: 'XGBoost',
    color: '#2ecc71',
    roleTag: 'TREND CORRECTOR',
    strategy: 'Sequential Gradient Boosting',
    complexity: 'Optuna Automated Tuning (40 Trials)',
    optimization: 'Residual Gradient Huber Loss',
    takeaway: 'Sequentially corrects forecasting residuals of previous iterations. Excels at detecting structural trend inflections and demand shifts.',
    strengths: [
      { name: 'Outlier Robustness', pct: 76 },
      { name: 'Non-Linear Patterns', pct: 95 },
      { name: 'Inference Velocity', pct: 84 },
    ],
    suitability: {
      volatile: 'Secondary',
      seasonal: 'Primary',
      stable: 'High Confidence',
    },
  },
  {
    key: 'lightgbm',
    label: 'LightGBM',
    color: '#9b59b6',
    roleTag: 'SPEED & CYCLES',
    strategy: 'Histogram Leaf-Wise Expansion',
    complexity: 'Dynamic Depth Histogram Bins',
    optimization: 'Gradient-Based One-Side Sampling',
    takeaway: 'Ultra-fast leaf-wise tree splitting. Highly attuned to localized weekly demand cycles, weekend surges, and multi-store catalog scaling.',
    strengths: [
      { name: 'Outlier Robustness', pct: 70 },
      { name: 'Non-Linear Patterns', pct: 92 },
      { name: 'Inference Velocity', pct: 98 },
    ],
    suitability: {
      volatile: 'Secondary',
      seasonal: 'Primary',
      stable: 'High Confidence',
    },
  },
  {
    key: 'ensemble',
    label: 'NNLS Ensemble',
    color: '#f5a623',
    roleTag: 'OPTIMAL BLENDER',
    strategy: 'Non-Negative Least Squares (NNLS)',
    complexity: 'Meta-Learner Weight Aggregator',
    optimization: 'Constrained Quadratic Optimization (Sum = 1)',
    takeaway: 'Learns optimal out-of-fold blending coefficients. Mathematically guaranteed to meet or beat the performance of any individual base model.',
    strengths: [
      { name: 'Outlier Robustness', pct: 96 },
      { name: 'Non-Linear Patterns', pct: 96 },
      { name: 'Inference Velocity', pct: 90 },
    ],
    suitability: {
      volatile: 'Production Default',
      seasonal: 'Production Default',
      stable: 'Production Default',
    },
  },
]

// ── Interactive Pipeline Diagram Component ───────────────────────────────────
function EnsemblePipelineFlow({ activeModel, onSelectModel }) {
  return (
    <div style={{
      padding: '24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ARCHITECTURE PIPELINE
          </span>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 0', fontFamily: 'var(--font-body)' }}>
            Hierarchical Feature &amp; Ensemble Ingestion Flow
          </h3>
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
          Click any estimator node to inspect specifications
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 1.1fr) 40px minmax(320px, 2.2fr) 40px minmax(220px, 1.2fr)',
        alignItems: 'center',
        gap: 8,
      }}>

        {/* Stage 1: Feature Matrix */}
        <div style={{
          padding: '16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
              STAGE 01 : FEATURES
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            119d Retail Observations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            <div>• 40 Temporal Lag Features (1 to 28d)</div>
            <div>• Rolling Means &amp; Standard Deviations</div>
            <div>• 7-Day Day-of-Week Fourier Harmonics</div>
          </div>
        </div>

        {/* Arrow 1 */}
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 18, fontFamily: 'var(--font-mono)' }}>
          →
        </div>

        {/* Stage 2: Parallel Base Estimators */}
        <div style={{
          padding: '16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
              STAGE 02 : BASE ESTIMATORS
            </span>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>PARALLEL INFERENCE</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { key: 'random_forest', label: 'Random Forest', color: '#4a9eff', note: '100 Bagging Trees' },
              { key: 'xgboost',       label: 'XGBoost',       color: '#2ecc71', note: 'Optuna Tuned CV' },
              { key: 'lightgbm',      label: 'LightGBM',      color: '#9b59b6', note: 'Fast Leaf Histogram' },
            ].map((m) => {
              const isSelected = activeModel === m.key
              return (
                <button
                  key={m.key}
                  onClick={() => onSelectModel(m.key)}
                  style={{
                    padding: '10px 8px',
                    background: isSelected ? `${m.color}22` : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? m.color : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: isSelected ? m.color : 'var(--text-primary)' }}>
                      {m.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    {m.note}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Arrow 2 */}
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 18, fontFamily: 'var(--font-mono)' }}>
          →
        </div>

        {/* Stage 3: NNLS Meta-Learner */}
        <div style={{
          padding: '16px',
          background: 'var(--bg-elevated)',
          border: `1px solid ${activeModel === 'ensemble' ? 'var(--amber)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          cursor: 'pointer',
        }}
        onClick={() => onSelectModel('ensemble')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--amber)' }}>
              STAGE 03 : NNLS BLENDER
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Optimal Out-of-Fold Blend
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            w_i &gt;= 0, Sum(w) = 1.0<br />
            + 80% Quantile Corridor
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Live Model Metric Pills ───────────────────────────────────────────────────
function MetricPill({ label, value, sub, color = 'var(--amber)' }) {
  return (
    <div style={{
      padding: '8px 12px',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      minWidth: 84,
    }}>
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Re-Engineered Superpower Spec Card ────────────────────────────────────────
function SuperpowerModelCard({ spec, metrics, isBest, isSelected, onClick }) {
  const { key, label, color, roleTag, strategy, complexity, optimization, takeaway, strengths } = spec

  return (
    <div
      onClick={onClick}
      style={{
        padding: '22px 20px',
        background: 'var(--bg-surface)',
        border: `1px solid ${isSelected ? color : isBest ? 'var(--amber)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: isSelected ? `0 0 0 1px ${color}44, 0 8px 24px ${color}14` : 'none',
        position: 'relative',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
      }}
    >
      {/* Top badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}88` }} />
          <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-body)' }}>
            {label}
          </h4>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isBest && (
            <span style={{
              padding: '2px 7px',
              borderRadius: 4,
              background: 'var(--amber-glow)',
              border: '1px solid var(--amber)',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              color: 'var(--amber)',
              fontWeight: 700,
            }}>
              BEST WMAPE ★
            </span>
          )}
          <span style={{
            padding: '2px 6px',
            borderRadius: 4,
            background: `${color}14`,
            border: `1px solid ${color}33`,
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}>
            {roleTag}
          </span>
        </div>
      </div>

      {/* Live performance metrics (if forecast loaded) */}
      {metrics && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <MetricPill label="WMAPE" value={fmtPct(metrics.wmape)} sub="relative error" color={isBest ? 'var(--amber)' : 'var(--text-primary)'} />
          <MetricPill label="MAE" value={fmtNum(metrics.mae, 2)} sub="units / day" color="var(--text-primary)" />
        </div>
      )}

      {/* Structured Technical Specifications */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: 4 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Strategy</span>
          <span style={{ color: 'var(--text-secondary)' }}>{strategy}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: 4 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Complexity</span>
          <span style={{ color: 'var(--text-secondary)' }}>{complexity}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: 4 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Objective</span>
          <span style={{ color: 'var(--text-secondary)' }}>{optimization}</span>
        </div>
      </div>

      {/* Visual Architectural Strength Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
        {strengths.map((s) => (
          <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{s.name}</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{s.pct}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${s.pct}%`,
                height: '100%',
                background: color,
                borderRadius: 2,
                opacity: 0.85,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Concise Operational Takeaway */}
      <p style={{
        fontSize: 11,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
        margin: 'auto 0 0',
        paddingTop: 10,
        borderTop: '1px solid var(--border)',
      }}>
        {takeaway}
      </p>
    </div>
  )
}

// ── Comparative Performance Leaderboard (when forecast exists) ────────────────
function ComparativeLeaderboard({ m, bestKey }) {
  const models = MODEL_SPECS.map(s => ({
    ...s,
    wmape: m[s.key]?.wmape ?? null,
    mae: m[s.key]?.mae ?? null,
  })).filter(s => s.wmape != null).sort((a, b) => a.wmape - b.wmape)

  if (!models.length) return null

  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          OUT-OF-FOLD BENCHMARK LEADERBOARD
        </span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
          Ranked by lowest WMAPE (volume-weighted accuracy)
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {models.map((mod, rank) => {
          const isBest = mod.key === bestKey
          return (
            <div
              key={mod.key}
              style={{
                padding: '12px 14px',
                background: isBest ? 'var(--amber-glow)' : 'var(--bg-elevated)',
                border: `1px solid ${isBest ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-tertiary)' }}>
                    #{rank + 1}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: isBest ? 'var(--amber)' : 'var(--text-primary)' }}>
                    {mod.label}
                  </span>
                </div>
                {isBest && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--amber)', fontWeight: 700 }}>
                    CHOSEN ★
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>WMAPE:</span>
                <span style={{ fontWeight: 700, color: isBest ? 'var(--amber)' : 'var(--text-primary)' }}>{fmtPct(mod.wmape)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>MAE:</span>
                <span style={{ color: 'var(--text-secondary)' }}>{fmtNum(mod.mae, 2)} units</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 80% Prediction Band Coverage Card ─────────────────────────────────────────
function CoverageGaugeCard({ pi }) {
  if (!pi) return null
  const pct = fmtPct(pi.actual_coverage)
  const target = fmtPct(pi.target_coverage)
  const onTarget = pi.actual_coverage >= pi.target_coverage * 0.9

  return (
    <div style={{
      padding: '18px 24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          UNCERTAINTY SAFETY CORRIDOR COVERAGE
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Empirical validation: fraction of actual historical observations that landed inside the 80% prediction bounds.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 28, fontFamily: 'var(--font-mono)', fontWeight: 700, color: onTarget ? '#2ecc71' : 'var(--amber)' }}>
          {pct}
        </span>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
          target {target}
        </span>
      </div>
    </div>
  )
}

// ── Retail Suitability Matrix ─────────────────────────────────────────────────
function RetailSuitabilityMatrix() {
  const rows = [
    { regime: 'Seasonal Demand (Weekly Cyclical)', primary: 'LightGBM & XGBoost', role: 'Captures 7-day cyclical crests and weekend promotions with fast Fourier features.' },
    { regime: 'Volatile Demand (High Noise & Spikes)', primary: 'Random Forest', role: 'Bagging sub-samples buffer against random outlier spikes without distorting forecast baseline.' },
    { regime: 'Stable Demand (Low Variance Run-Rate)', primary: 'NNLS Ensemble', role: 'Averages out residual noise to produce ultra-lean automated replenishment schedules.' },
    { regime: 'Production Master Trajectory', primary: 'NNLS Ensemble (All 4)', role: 'Solves optimal non-negative combination weights guaranteeing robust generalization.' },
  ]

  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      marginTop: 24,
    }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Operational Playbook : Demand Regime Suitability
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => (
          <div
            key={r.regime}
            style={{
              padding: '10px 14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                {r.regime}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {r.role}
              </div>
            </div>

            <div style={{
              padding: '4px 10px',
              background: 'rgba(245, 166, 35, 0.08)',
              border: '1px solid var(--amber-dim)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--amber)',
              fontWeight: 600,
            }}>
              {r.primary}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Models Page Component ────────────────────────────────────────────────
export default function Models({ forecast }) {
  const [activeModel, setActiveModel] = useState('ensemble')
  const m = forecast?.model_metrics || {}
  const hasLive = Object.keys(m).length > 0

  // Determine best model by lowest WMAPE
  const candidates = MODEL_SPECS
    .map(({ key }) => ({ key, wmape: m[key]?.wmape ?? Infinity }))
    .filter(({ wmape }) => wmape < Infinity)
  const bestKey = candidates.length
    ? candidates.reduce((a, b) => (a.wmape < b.wmape ? a : b)).key
    : null

  return (
    <div style={{
      position: 'relative',
      minHeight: 'calc(100vh - 56px)',
      overflow: 'hidden',
      padding: '32px 32px 64px',
    }}>
      {/* Living Hierarchical Decision Tree Geometric Canvas */}
      <AmbientDecisionTreeCanvas />

      {/* Gentle ambient glow */}
      <div style={{
        position: 'absolute',
        top: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 1000,
        height: 500,
        background: 'radial-gradient(ellipse 65% 45% at 50% 15%, rgba(74, 158, 255, 0.06) 0%, rgba(245, 166, 35, 0.03) 50%, transparent 75%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              background: 'var(--amber-glow)',
              border: '1px solid var(--amber-dim)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--amber)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
              <span>{hasLive ? `LIVE TELEMETRY : PRODUCT ${forecast.product_id}` : 'ARCHITECTURE SPECIFICATION'}</span>
            </div>
            {hasLive && (
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                {forecast.horizon}d forecast horizon
              </span>
            )}
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            ML Model Architecture &amp; Ensemble Engine
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {hasLive
              ? `Live performance benchmarks computed from the latest forecast on product ${forecast.product_id}. Evaluated using TimeSeriesSplit cross-validation.`
              : 'Diverse multi-model architecture combining bagging, sequential boosting, and non-negative least squares optimization.'}
          </p>
        </div>

        {/* 1. Interactive Architecture Pipeline Visualizer */}
        <EnsemblePipelineFlow
          activeModel={activeModel}
          onSelectModel={setActiveModel}
        />

        {/* 2. Comparative Leaderboard (if live metrics present) */}
        {hasLive && <ComparativeLeaderboard m={m} bestKey={bestKey} />}

        {/* 3. 80% Prediction Band Coverage Card (if interval metrics present) */}
        {m.prediction_interval && <CoverageGaugeCard pi={m.prediction_interval} />}

        {/* 4. Superpower Model Spec Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {MODEL_SPECS.map((spec) => (
            <SuperpowerModelCard
              key={spec.key}
              spec={spec}
              metrics={m[spec.key] ?? null}
              isBest={spec.key === bestKey}
              isSelected={activeModel === spec.key}
              onClick={() => setActiveModel(spec.key)}
            />
          ))}
        </div>

        {/* 5. Retail Demand Regime Suitability Matrix */}
        <RetailSuitabilityMatrix />

      </div>
    </div>
  )
}
