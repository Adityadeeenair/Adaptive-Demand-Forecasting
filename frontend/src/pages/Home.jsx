import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadZone from '../components/UploadZone'
import { useUpload } from '../hooks/useUpload'

const SCHEMA_SPECS = [
  {
    field: 'date',
    status: 'Required',
    alts: 'timestamp · day · week',
    desc: 'Parsed to continuous daily sequence',
  },
  {
    field: 'sales',
    status: 'Required',
    alts: 'demand · quantity · units',
    desc: 'Target variable for ML forecast models',
  },
  {
    field: 'store',
    status: 'Optional',
    alts: 'location · branch · outlet',
    desc: 'Defaults to Store 1 if omitted',
  },
  {
    field: 'item',
    status: 'Optional',
    alts: 'sku · product · code',
    desc: 'Defaults to Item 1 if omitted',
  },
]

const PIPELINE_LOGS = [
  'Reading raw CSV byte stream...',
  'Universal adapter mapping column headers...',
  'Validating daily time-series continuity...',
  'Partitioning hierarchical store-item series...',
  'Mounting session into high-speed memory...',
]

function IngestionProgress() {
  const [logIndex, setLogIndex] = useState(0)
  const [progress, setProgress] = useState(15)

  useEffect(() => {
    const timer = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % PIPELINE_LOGS.length)
      setProgress((prev) => Math.min(prev + 18, 92))
    }, 600)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{
      marginTop: 16,
      padding: '20px 24px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: 'var(--amber)',
            boxShadow: '0 0 10px var(--amber)',
            animation: 'pulse 1s infinite',
          }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Ingesting Time Series
          </span>
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {progress}%
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: 4,
        background: 'var(--bg-elevated)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--amber-dim), var(--amber))',
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>

      <p style={{
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ color: 'var(--amber)' }}>&gt;</span> {PIPELINE_LOGS[logIndex]}
      </p>
    </div>
  )
}

function AmbientNetworkCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationId
    let width = 0
    let height = 0

    const resize = () => {
      if (!canvas) return
      width = canvas.width = canvas.offsetWidth || window.innerWidth
      height = canvas.height = canvas.offsetHeight || window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Ambient floating particles
    const count = 45
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * (width || 800),
      y: Math.random() * (height || 600),
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.6 + 0.8,
      alpha: Math.random() * 0.28 + 0.08,
      amber: Math.random() > 0.35,
    }))

    let scanY = 0

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // 1. Subtle background CAD coordinate grid
      const gridSize = 56
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.018)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
      }
      ctx.stroke()

      // 2. Slow telemetry scan bar
      scanY += 0.35
      if (scanY > height) scanY = 0
      const scanGrad = ctx.createLinearGradient(0, scanY - 35, 0, scanY)
      scanGrad.addColorStop(0, 'rgba(245, 166, 35, 0)')
      scanGrad.addColorStop(1, 'rgba(245, 166, 35, 0.045)')
      ctx.fillStyle = scanGrad
      ctx.fillRect(0, Math.max(0, scanY - 35), width, 35)

      // 3. Connect close particles with faint data mesh lines
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 100) {
            const lineAlpha = (1 - dist / 100) * 0.08
            ctx.strokeStyle = particles[i].amber
              ? `rgba(245, 166, 35, ${lineAlpha})`
              : `rgba(74, 158, 255, ${lineAlpha})`
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // 4. Update and render particle positions
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        ctx.fillStyle = p.amber
          ? `rgba(245, 166, 35, ${p.alpha})`
          : `rgba(74, 158, 255, ${p.alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      })

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}

export default function Home({ onSessionCreated }) {
  const { status, summary, sessionId, error, upload, reset } = useUpload()
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

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      position: 'relative',
      overflow: 'hidden',
      padding: '48px 24px 64px',
    }}>
      <style>{`
        @keyframes auroraBreath {
          0%, 100% {
            transform: translateX(-50%) scale(1);
            opacity: 0.14;
          }
          50% {
            transform: translateX(-50%) scale(1.15);
            opacity: 0.24;
          }
        }
      `}</style>

      {/* Living Ambient Canvas (CAD Grid + Floating Data Particles + Telemetry Scan) */}
      <AmbientNetworkCanvas />

      {/* Breathing Ambient Radial Aurora */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        width: 900,
        height: 520,
        background: 'radial-gradient(ellipse 65% 50% at 50% 15%, rgba(245, 166, 35, 0.16) 0%, rgba(74, 158, 255, 0.05) 50%, transparent 75%)',
        pointerEvents: 'none',
        animation: 'auroraBreath 9s ease-in-out infinite',
        zIndex: 0,
      }} />

      {/* Secondary soft cool glow at the bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '20%',
        width: 600,
        height: 300,
        background: 'radial-gradient(circle at 50% 100%, rgba(74, 158, 255, 0.04) 0%, transparent 60%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ maxWidth: 840, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            background: 'var(--amber-glow)',
            border: '1px solid var(--amber-dim)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 12,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Data Pipeline : Stage 01
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
            margin: '0 0 10px',
            letterSpacing: '-0.02em',
          }}>
            Ingest Retail Sales Data
          </h1>

          <p style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            maxWidth: 540,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            Upload any standard retail sales CSV. The universal schema adapter maps columns,
            validates timestamp continuity, and builds an in-memory session.
          </p>
        </div>

        {/* Upload Terminal */}
        {status !== 'success' ? (
          <div>
            <UploadZone onFile={handleFile} disabled={status === 'uploading'} />

            {status === 'uploading' && <IngestionProgress />}

            {status === 'error' && (
              <div style={{
                marginTop: 16,
                padding: '14px 18px',
                background: 'rgba(231, 76, 60, 0.08)',
                border: '1px solid rgba(231, 76, 60, 0.3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ color: 'var(--red)', fontWeight: 700 }}>✕</span>
                <p style={{ fontSize: 13, color: 'var(--red)', margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Quick Sample Dataset Reference */}
            {status === 'idle' && (
              <div style={{
                marginTop: 20,
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--text-tertiary)',
              }}>
                <span>Need a ready-to-test file? </span>
                <a
                  href="/sample_dataset.csv"
                  download="sample_dataset.csv"
                  style={{
                    color: 'var(--amber)',
                    textDecoration: 'underline',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Download sample_dataset.csv
                </a>
                <span> (10 products · 180 days)</span>
              </div>
            )}

            {/* Schema Normalization Grid */}
            <div style={{
              marginTop: 40,
              paddingTop: 32,
              borderTop: '1px solid var(--border)',
            }}>
              <p style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 16,
                textAlign: 'center',
              }}>
                Universal Schema Adapter : Accepted Columns
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}>
                {SCHEMA_SPECS.map(({ field, status: reqStatus, alts, desc }) => (
                  <div
                    key={field}
                    style={{
                      padding: '14px 16px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <code style={{
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        color: reqStatus === 'Required' ? 'var(--amber)' : 'var(--text-primary)',
                        fontWeight: 700,
                      }}>
                        {field}
                      </code>
                      <span style={{
                        fontSize: 9,
                        fontFamily: 'var(--font-mono)',
                        padding: '1px 6px',
                        borderRadius: 3,
                        color: reqStatus === 'Required' ? 'var(--amber)' : 'var(--text-tertiary)',
                        background: reqStatus === 'Required' ? 'var(--amber-glow)' : 'var(--bg-elevated)',
                        border: `1px solid ${reqStatus === 'Required' ? 'var(--amber-dim)' : 'var(--border)'}`,
                        textTransform: 'uppercase',
                      }}>
                        {reqStatus}
                      </span>
                    </div>

                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {alts}
                    </span>

                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 2 }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Post-Upload Success Ingestion Report */
          <div style={{
            padding: '28px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-amber)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: 'var(--green)',
                  boxShadow: '0 0 10px var(--green)',
                  flexShrink: 0,
                }} />
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Dataset Mounted to Session Store
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    Session ID: {sessionId?.slice(0, 8)}...
                  </span>
                </div>
              </div>

              <span style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
                padding: '4px 10px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}>
                {summary?.date_min} to {summary?.date_max}
              </span>
            </div>

            {/* Ingested Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}>
              {[
                { label: 'Total Rows', val: summary?.rows?.toLocaleString() },
                { label: 'Products', val: summary?.products },
                { label: 'Stores', val: summary?.stores },
                { label: 'SKU Items', val: summary?.items },
              ].map(({ label, val }) => (
                <div
                  key={label}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <p style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    margin: '0 0 4px',
                  }}>
                    {label}
                  </p>
                  <p style={{
                    fontSize: 22,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}>
                    {val}
                  </p>
                </div>
              ))}
            </div>

            {/* Thin products notice */}
            {summary?.thin_products > 0 && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(245, 166, 35, 0.08)',
                border: '1px solid rgba(245, 166, 35, 0.25)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 20,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}>
                Notice: {summary.thin_products} product(s) have fewer than 30 observations and were isolated.
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: '14px 24px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--bg-base)',
                  background: 'var(--amber)',
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  transition: 'var(--transition)',
                  boxShadow: '0 0 24px rgba(245, 166, 35, 0.25)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--amber-dim)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--amber)' }}
              >
                Launch Forecast Dashboard →
              </button>

              <button
                onClick={reset}
                style={{
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                Upload Different File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
