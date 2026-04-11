import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadZone from '../components/UploadZone'
import { useUpload } from '../hooks/useUpload'
import { fmtNum } from '../utils/format'

const STAT_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '16px 20px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
}

export default function Home({ onSessionCreated }) {
  const { status, summary, sessionId, error, upload } = useUpload()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'success' && sessionId) {
      onSessionCreated(sessionId, summary)
    }
  }, [status, sessionId])

  const handleFile = async (file) => {
    try {
      await upload(file)
    } catch (_) {}
  }

  const handleProceed = () => navigate('/dashboard')

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>

      <div style={{ width: '100%', maxWidth: 580 }}>

        {/* Header */}
        <div style={{ marginBottom: 40, animation: 'fadeUp 0.5s ease both' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            background: 'var(--amber-glow)',
            border: '1px solid var(--amber-dim)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Demand Intelligence
            </span>
          </div>

          <h1 style={{
            fontSize: 36,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.15,
            marginBottom: 14,
          }}>
            Adaptive Demand<br />
            <span style={{ color: 'var(--amber)' }}>Forecasting System</span>
          </h1>

          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 460 }}>
            Upload retail sales data. The system segments products by demand behaviour,
            trains ensemble ML models, and generates forecasts with confidence intervals.
          </p>
        </div>

        {/* Upload zone */}
        <div style={{ animation: 'fadeUp 0.5s ease 0.1s both' }}>
          {status !== 'success' ? (
            <>
              <UploadZone onFile={handleFile} disabled={status === 'uploading'} />

              {status === 'uploading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', animation: 'pulse 1s infinite' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Validating and processing dataset...</span>
                </div>
              )}

              {status === 'error' && (
                <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontSize: 13, color: 'var(--red)' }}>{error}</p>
                </div>
              )}
            </>
          ) : (
            <div style={{ animation: 'fadeIn 0.4s ease both' }}>
              {/* Summary card */}
              <div style={{
                padding: '20px 24px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--amber)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-amber)',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
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
                    <div key={label} style={STAT_STYLE}>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
                      <span style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
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
                onClick={handleProceed}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--bg-base)',
                  background: 'var(--amber)',
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--amber-dim)'}
                onMouseLeave={(e) => e.target.style.background = 'var(--amber)'}
              >
                Open Dashboard →
              </button>
            </div>
          )}
        </div>

        {/* Pipeline tags */}
        {status !== 'success' && (
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 8, animation: 'fadeUp 0.5s ease 0.2s both' }}>
            {['Demand Segmentation', 'Holt-Winters', 'Random Forest', 'XGBoost', 'LightGBM', 'NNLS Ensemble', 'Quantile Intervals'].map((tag) => (
              <span key={tag} style={{
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: 'var(--font-display)',
                color: 'var(--text-tertiary)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                letterSpacing: '0.04em',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
