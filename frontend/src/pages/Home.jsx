import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadZone from '../components/UploadZone'
import { useUpload } from '../hooks/useUpload'

const STEPS = [
  'Reading CSV structure...',
  'Detecting column types...',
  'Validating date ranges...',
  'Processing time series...',
  'Building session...',
]

const WHAT_WORKS = [
  { col: 'date',  alts: 'timestamp · day · week',     required: true  },
  { col: 'sales', alts: 'demand · quantity · revenue', required: true  },
  { col: 'store', alts: 'location · branch · region',  required: false },
  { col: 'item',  alts: 'product · sku · category',    required: false },
]

const TAGS = ['Demand Segmentation', 'Random Forest', 'XGBoost', 'LightGBM', 'NNLS Ensemble', 'Quantile Intervals']

function UploadingState() {
  const textRef = useRef(null)
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i = (i + 1) % STEPS.length
      if (textRef.current) textRef.current.textContent = STEPS[i]
    }, 900)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {[0,1,2].map(i => (
          <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)', animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />
        ))}
      </div>
      <span ref={textRef} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{STEPS[0]}</span>
    </div>
  )
}

export default function Home({ onSessionCreated }) {
  const { status, summary, sessionId, error, upload } = useUpload()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'success' && sessionId) onSessionCreated(sessionId, summary)
  }, [status, sessionId])

  const handleFile = async (file) => { try { await upload(file) } catch (_) {} }

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Background depth — amber glow behind the upload side */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 72% 45%, rgba(245,166,35,0.07) 0%, transparent 55%)',
      }} />
      {/* Secondary cool glow on the left */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 20% 60%, rgba(74,158,255,0.04) 0%, transparent 50%)',
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',    /* asymmetric — not centred */
        padding: '72px 56px 56px',
        maxWidth: 1120, margin: '0 auto',
        gap: 80,
        position: 'relative',
      }}>

        {/* ── Left: context ─────────────────────────────────────────────── */}
        <div style={{
          flex: '0 0 380px',
          paddingTop: 16,             /* slight downward offset = asymmetry */
          animation: 'fadeUp 0.5s ease both',
        }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 12px', background: 'var(--amber-glow)', border: '1px solid var(--amber-dim)', borderRadius: 'var(--radius-sm)', marginBottom: 28 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Demand Intelligence</span>
          </div>

          <h1 style={{ fontSize: 38, fontFamily: 'var(--font-heading)', fontWeight: 700, lineHeight: 1.12, marginBottom: 18, letterSpacing: '-0.02em' }}>
            Adaptive Demand<br />
            <span style={{ color: 'var(--amber)' }}>Forecasting System</span>
          </h1>

          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.8, marginBottom: 52, maxWidth: 340, opacity: 0.75 }}>
            Upload retail sales data. The system segments products by demand behaviour,
            trains ensemble ML models, and generates forecasts with confidence intervals.
          </p>

          {/* Column guide — visually secondary */}
          <div style={{ marginBottom: 44 }}>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, opacity: 0.7 }}>
              Accepted column names
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {WHAT_WORKS.map(({ col, alts, required }) => (
                <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <code style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                    color: required ? 'var(--amber)' : 'var(--text-secondary)',
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${required ? 'var(--amber-dim)' : 'var(--border)'}`,
                    padding: '2px 8px', borderRadius: 3,
                    minWidth: 44, textAlign: 'center', flexShrink: 0,
                  }}>{col}</code>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.75 }}>{alts}</span>
                  {!required && (
                    <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 2, flexShrink: 0, opacity: 0.6 }}>optional</span>
                  )}
                </div>
              ))}
            </div>
            <p style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.6, lineHeight: 1.5 }}>
              Column names detected automatically — exact match not required.
            </p>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TAGS.map(tag => (
              <span key={tag} style={{ padding: '3px 9px', fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', letterSpacing: '0.03em', opacity: 0.7 }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right: upload — the main action ───────────────────────────── */}
        <div style={{
          flex: 1,
          paddingTop: 0,              /* sits higher than left = asymmetry */
          animation: 'fadeUp 0.5s ease 0.1s both',
        }}>

          {status !== 'success' ? (
            <>
              <UploadZone onFile={handleFile} disabled={status === 'uploading'} />

              {status === 'uploading' && <UploadingState />}

              {status === 'error' && (
                <div style={{ marginTop: 12, padding: '11px 15px', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontSize: 13, color: 'var(--red)' }}>{error}</p>
                </div>
              )}

              {status === 'idle' && (
                <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', opacity: 0.75 }}>
                  No dataset?{' '}
                  <a href="/sample_dataset.csv" download="sample_dataset.csv"
                    style={{ color: 'var(--amber)', textDecoration: 'underline', cursor: 'pointer' }}>
                    Download sample CSV
                  </a>
                  {' '}— 10 products, 180 days, mixed segments.
                </p>
              )}
            </>
          ) : (
            <div style={{ animation: 'fadeUp 0.4s ease both' }}>
              <div style={{ padding: '22px 26px', marginBottom: 14, background: 'var(--bg-surface)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-amber)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Dataset loaded successfully</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>
                    {summary?.date_min} → {summary?.date_max}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { label: 'ROWS',     value: summary?.rows?.toLocaleString() },
                    { label: 'PRODUCTS', value: summary?.products },
                    { label: 'STORES',   value: summary?.stores },
                    { label: 'ITEMS',    value: summary?.items },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
                      <span style={{ fontSize: 22, fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
                    </div>
                  ))}
                </div>
                {summary?.thin_products > 0 && (
                  <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                    ⚠ {summary.thin_products} product(s) have limited history and may be excluded from forecasting.
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600, color: 'var(--bg-base)', background: 'var(--amber)', border: 'none', cursor: 'pointer', letterSpacing: '0.02em', transition: 'var(--transition)' }}
                onMouseEnter={e => e.target.style.background = 'var(--amber-dim)'}
                onMouseLeave={e => e.target.style.background = 'var(--amber)'}
              >
                Open Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
