import { Link } from 'react-router-dom'

const FEATURES = [
  { icon: '⬡', title: 'Demand Segmentation', desc: 'Automatically classifies products into stable, seasonal, volatile, and intermittent demand patterns.' },
  { icon: '◈', title: 'Ensemble ML Models', desc: 'Random Forest, XGBoost, and LightGBM combined via non-negative least squares for optimal accuracy.' },
  { icon: '◎', title: 'Confidence Intervals', desc: '80% prediction bands via quantile regression — know the range, not just the point estimate.' },
  { icon: '⊕', title: 'Model Comparison', desc: 'Compare all models side-by-side on the same chart. See which model fits your data best.' },
  { icon: '◇', title: 'Dataset Insights', desc: 'Segment distribution, top products by volume, and data quality diagnostics at a glance.' },
  { icon: '↓', title: 'Export Ready', desc: 'Download forecasts as CSV for use in any downstream planning or inventory system.' },
]

const PIPELINE = [
  { step: '01', label: 'Upload', desc: 'Drop a CSV with date, store, item, sales columns' },
  { step: '02', label: 'Segment', desc: 'System analyses demand patterns per product' },
  { step: '03', label: 'Train',  desc: 'Three ML models trained with Optuna tuning' },
  { step: '04', label: 'Forecast', desc: 'Ensemble predictions with confidence bands' },
]

const STACK = ['Random Forest', 'XGBoost', 'LightGBM', 'NNLS Ensemble', 'Holt-Winters', 'Optuna Tuning', 'Quantile Regression', 'TimeSeriesSplit CV']

export default function Landing() {
  return (
    <div style={{ color: 'var(--text-primary)' }}>

      {/* Hero */}
      <section style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,166,35,0.07) 0%, transparent 70%)',
        }} />

        <div style={{ textAlign: 'center', maxWidth: 720, position: 'relative', animation: 'fadeUp 0.6s ease both' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', background: 'var(--amber-glow)', border: '1px solid var(--amber-dim)', borderRadius: 'var(--radius-sm)', marginBottom: 28 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Production-Grade Forecasting</span>
          </div>

          <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontFamily: 'var(--font-display)', fontWeight: 700, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-0.01em' }}>
            Adaptive Demand<br />
            <span style={{ color: 'var(--amber)' }}>Forecasting System</span>
          </h1>

          <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 560, margin: '0 auto 40px' }}>
            Upload retail sales data. Get demand segmentation, multi-model ML forecasts,
            and confidence intervals — in minutes, not months.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/upload" style={{
              padding: '13px 28px',
              background: 'var(--amber)',
              color: 'var(--bg-base)',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
              transition: 'var(--transition)',
              display: 'inline-block',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--amber-dim)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--amber)'}
            >
              Get Started →
            </Link>
            <Link to="/models" style={{
              padding: '13px 28px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 500,
              transition: 'var(--transition)',
              display: 'inline-block',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              View Models
            </Link>
          </div>
        </div>

        {/* Floating stat chips */}
        <div style={{ display: 'flex', gap: 12, marginTop: 56, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeUp 0.6s ease 0.15s both' }}>
          {[
            { val: '11.1%', lab: 'WMAPE — Ensemble' },
            { val: '80%',   lab: 'Interval Coverage' },
            { val: '500+',  lab: 'Products Supported' },
            { val: '4',     lab: 'Models Compared' },
          ].map(({ val, lab }) => (
            <div key={lab} style={{ padding: '12px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: 110 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--amber)', marginBottom: 2 }}>{val}</p>
              <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>{lab}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' }}>How It Works</p>
          <h2 style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 700, textAlign: 'center', marginBottom: 48 }}>
            From raw data to forecast in four steps
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, position: 'relative' }}>
            {PIPELINE.map(({ step, label, desc }, i) => (
              <div key={step} style={{ padding: '28px 24px', background: 'var(--bg-base)', border: '1px solid var(--border)', position: 'relative', ...(i === 0 ? { borderRadius: '12px 0 0 12px' } : i === 3 ? { borderRadius: '0 12px 12px 0' } : {}) }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--amber)', letterSpacing: '0.1em', marginBottom: 10 }}>{step}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{label}</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</p>
                {i < 3 && (
                  <span style={{ position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--border-light)', zIndex: 1 }}>→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' }}>Platform Features</p>
          <h2 style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 700, textAlign: 'center', marginBottom: 48 }}>
            Everything for production forecasting
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} style={{ padding: '24px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', transition: 'var(--transition)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
              >
                <span style={{ fontSize: 22, marginBottom: 14, display: 'block', color: 'var(--amber)' }}>{icon}</span>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '0.02em' }}>{title}</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section style={{ padding: '60px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>
            Built with
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {STACK.map(tag => (
              <span key={tag} style={{ padding: '6px 14px', fontSize: 12, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', letterSpacing: '0.04em' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid var(--border)', textAlign: 'center', background: 'var(--bg-base)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 14 }}>
            Ready to forecast demand?
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.7 }}>
            Upload your CSV and get multi-model forecasts with confidence intervals in under a minute.
          </p>
          <Link to="/upload" style={{
            padding: '14px 36px',
            background: 'var(--amber)',
            color: 'var(--bg-base)',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
            display: 'inline-block',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--amber-dim)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--amber)'}
          >
            Upload Dataset →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '24px 32px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
          ADF · Adaptive Demand Forecasting System
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[['/', 'Home'], ['/upload', 'Upload'], ['/dashboard', 'Dashboard'], ['/models', 'Models'], ['/insights', 'Insights']].map(([path, label]) => (
            <Link key={path} to={path} style={{ fontSize: 12, color: 'var(--text-tertiary)', transition: 'var(--transition)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
              {label}
            </Link>
          ))}
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
          v1.0 · FastAPI + React
        </span>
      </footer>
    </div>
  )
}
