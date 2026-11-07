import { useState, useEffect, useRef } from 'react'
import StatusBadge from './StatusBadge'

// ── Synthetic Waveform Oscilloscope Radar ──────────────────────────────────────
export function StandbyWaveformRadar() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationId
    let width = 0
    let height = 0
    let t = 0

    const resize = () => {
      if (!canvas) return
      width = canvas.width = canvas.offsetWidth || 640
      height = canvas.height = canvas.offsetHeight || 150
    }
    resize()
    window.addEventListener('resize', resize)

    // Precompute a synthetic 7-day cyclical retail demand series for Store 2 / Item 2
    const totalDays = 60
    const historyDays = 42
    const baseline = Array.from({ length: totalDays }, (_, i) => {
      const dayOfWeek = i % 7
      // Weekend peak on Friday/Saturday
      const weekendBump = (dayOfWeek === 5 || dayOfWeek === 6) ? 22 : 0
      const trend = Math.sin(i * 0.12) * 8
      const noise = Math.sin(i * 2.3) * 3
      return 58 + weekendBump + trend + noise
    })

    const render = () => {
      t += 0.02
      ctx.clearRect(0, 0, width, height)

      const splitX = width * 0.65
      const minY = 30
      const maxY = 110
      const scaleY = (val) => {
        const norm = (val - 35) / (105 - 35)
        return height - 25 - norm * (height - 50)
      }

      // 1. Subtle horizontal datum grids
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
      ctx.lineWidth = 1
      ;[45, 65, 85].forEach((val) => {
        const y = scaleY(val)
        ctx.beginPath()
        ctx.moveTo(10, y)
        ctx.lineTo(width - 10, y)
        ctx.stroke()
      })

      // 2. Dual-zone division line (History vs Forecast)
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.35)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(splitX, 10)
      ctx.lineTo(splitX, height - 15)
      ctx.stroke()
      ctx.setLineDash([])

      // 3. Zone Labels
      ctx.font = '9px monospace'
      ctx.fillStyle = 'rgba(74, 158, 255, 0.65)'
      ctx.fillText('OBSERVED HISTORY (119D)', 16, 20)

      ctx.fillStyle = 'rgba(245, 166, 35, 0.75)'
      ctx.fillText('PROJECTED ENVELOPE (80% CORRIDOR)', splitX + 14, 20)

      // 4. Draw History Curve (Cyan line with subtle dots)
      ctx.beginPath()
      ctx.strokeStyle = '#4a9eff'
      ctx.lineWidth = 1.8
      for (let i = 0; i <= historyDays; i++) {
        const x = 16 + (i / historyDays) * (splitX - 24)
        const y = scaleY(baseline[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // History points
      for (let i = 0; i <= historyDays; i += 3) {
        const x = 16 + (i / historyDays) * (splitX - 24)
        const y = scaleY(baseline[i])
        ctx.fillStyle = '#4a9eff'
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // 5. Draw Forecast Confidence Band & Trajectory
      const lastHistX = splitX - 8
      const lastHistY = scaleY(baseline[historyDays])

      const forecastPoints = []
      const remainingDays = totalDays - historyDays
      for (let j = 0; j <= remainingDays; j++) {
        const frac = j / remainingDays
        const x = lastHistX + frac * (width - lastHistX - 16)
        const baseVal = baseline[historyDays + j] || 64
        // Breathing confidence envelope
        const spread = (10 + frac * 16) * (1 + Math.sin(t + frac * 2) * 0.08)
        forecastPoints.push({
          x,
          mid: scaleY(baseVal),
          upper: scaleY(baseVal + spread),
          lower: scaleY(baseVal - spread),
        })
      }

      // 80% Confidence Band Gradient Fill
      ctx.fillStyle = 'rgba(245, 166, 35, 0.12)'
      ctx.beginPath()
      ctx.moveTo(forecastPoints[0].x, forecastPoints[0].upper)
      for (let k = 1; k < forecastPoints.length; k++) {
        ctx.lineTo(forecastPoints[k].x, forecastPoints[k].upper)
      }
      for (let k = forecastPoints.length - 1; k >= 0; k--) {
        ctx.lineTo(forecastPoints[k].x, forecastPoints[k].lower)
      }
      ctx.closePath()
      ctx.fill()

      // Confidence Band upper/lower dashed strokes
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.3)'
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      forecastPoints.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.upper)
        else ctx.lineTo(p.x, p.upper)
      })
      ctx.stroke()

      ctx.beginPath()
      forecastPoints.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.lower)
        else ctx.lineTo(p.x, p.lower)
      })
      ctx.stroke()
      ctx.setLineDash([])

      // Forecast center point trajectory (amber line)
      ctx.strokeStyle = '#f5a623'
      ctx.lineWidth = 2
      ctx.beginPath()
      forecastPoints.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.mid)
        else ctx.lineTo(p.x, p.mid)
      })
      ctx.stroke()

      // Scanning reticle cursor moving across forecast horizon
      const scanFrac = (Math.sin(t * 1.5) + 1) / 2
      const scanIdx = Math.floor(scanFrac * (forecastPoints.length - 1))
      const targetPoint = forecastPoints[scanIdx]
      if (targetPoint) {
        ctx.strokeStyle = 'rgba(245, 166, 35, 0.7)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(targetPoint.x, targetPoint.mid, 4 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2)
        ctx.stroke()

        ctx.fillStyle = '#f5a623'
        ctx.beginPath()
        ctx.arc(targetPoint.x, targetPoint.mid, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div style={{
      width: '100%',
      height: 150,
      background: 'rgba(0, 0, 0, 0.25)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  )
}

// ── Standby Forecast Deck (Center Panel) ──────────────────────────────────────
export function ForecastStandbyDeck({ products = [], onSelectAndRun }) {
  // Select top representative products across different demand segments
  const sampleProducts = products.slice(0, 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '14px 18px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: 'var(--amber)',
            boxShadow: '0 0 10px var(--amber)',
            animation: 'pulse 1.4s infinite',
          }} />
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-body)' }}>
              Inference Engine Primed
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
              Awaiting target SKU selection to compute ensemble trajectory
            </p>
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
        }}>
          <span>HORIZON: 30D DEFAULT</span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span style={{ color: 'var(--amber)' }}>4 MODELS READY</span>
        </div>
      </div>

      {/* Synthetic Waveform Oscilloscope preview */}
      <StandbyWaveformRadar />

      {/* Quick Launch Recommendations */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Quick Run Recommendations
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
            1-Click Multi-Model Forecast
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {sampleProducts.map((p) => (
            <div
              key={p.product_id}
              style={{
                padding: '12px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'border-color 0.2s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--amber-dim)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {p.product_id}
                </span>
                <StatusBadge segment={p.segment} size="sm" />
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Store {p.store} · Item {p.item}
              </div>

              <button
                onClick={() => onSelectAndRun && onSelectAndRun(p.store, p.item, 30)}
                style={{
                  marginTop: 4,
                  padding: '7px 10px',
                  background: 'var(--amber-glow)',
                  border: '1px solid var(--amber-dim)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  color: 'var(--amber)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--amber)'
                  e.currentTarget.style.color = '#000'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--amber-glow)'
                  e.currentTarget.style.color = 'var(--amber)'
                }}
              >
                <span>Launch 30d Forecast</span>
                <span>→</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Model Readiness Matrix */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        paddingTop: 8,
        borderTop: '1px solid var(--border)',
      }}>
        {[
          { name: 'NNLS Ensemble', status: 'Primed', color: 'var(--amber)', note: 'Meta-Learner' },
          { name: 'LightGBM', status: 'Primed', color: '#2ecc71', note: 'Fast Boosting' },
          { name: 'XGBoost', status: 'Primed', color: '#9b59b6', note: 'Optuna CV' },
          { name: 'Random Forest', status: 'Primed', color: '#4a9eff', note: 'Bagging Trees' },
        ].map((m) => (
          <div
            key={m.name}
            style={{
              padding: '10px 12px',
              background: 'rgba(255, 255, 255, 0.015)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {m.name}
              </span>
            </div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              {m.note} · {m.status}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}

// ── Active Inference Telemetry Deck (Loading State) ───────────────────────────
export function InferenceTelemetryDeck() {
  const [logIdx, setLogIdx] = useState(0)
  const [pct, setPct] = useState(18)

  const steps = [
    'Parsing 119-day retail sales time series...',
    'Engineering 40 rolling lag, mean and weekly cyclical features...',
    'Fitting LightGBM, XGBoost and Random Forest quantile estimators...',
    'Optimizing non-negative least squares ensemble weighting matrix...',
    'Computing empirical 80% safety corridor...',
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setLogIdx((prev) => (prev + 1) % steps.length)
      setPct((prev) => Math.min(prev + 16, 94))
    }, 550)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{
      height: 380,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 32px',
      background: 'rgba(0, 0, 0, 0.2)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      position: 'relative',
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px',
        background: 'var(--amber-glow)',
        border: '1px solid var(--amber-dim)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 16,
      }}>
        <span style={{
          width: 7, height: 7,
          borderRadius: '50%',
          background: 'var(--amber)',
          boxShadow: '0 0 8px var(--amber)',
          animation: 'pulse 0.9s infinite',
        }} />
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Executing Machine Learning Pipeline
        </span>
      </div>

      <div style={{ width: '100%', maxWidth: 440, marginBottom: 14 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          marginBottom: 6,
        }}>
          <span>Training 4 Parallel Estimators</span>
          <span style={{ color: 'var(--amber)' }}>{pct}%</span>
        </div>
        <div style={{
          height: 4,
          background: 'var(--bg-elevated)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--amber-dim), var(--amber))',
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      <div style={{
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ color: 'var(--amber)' }}>&gt;</span>
        <span>{steps[logIdx]}</span>
      </div>
    </div>
  )
}

// ── Standby Metrics Deck (Right Panel) ─────────────────────────────────────────
export function MetricsStandbyDeck() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Evaluation Blueprint
        </span>
      </div>

      {/* Target Metric Specifications */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Primary Retail Metric
        </div>
        <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          WMAPE
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Weighted Mean Absolute Percentage Error. Scales error proportionally to sales volume.
        </div>
      </div>

      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a9eff', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Secondary Metric
        </div>
        <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          MAE
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Mean Absolute Error. Direct unit deviation per day against actual observations.
        </div>
      </div>

      {/* Validation Methodology */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Validation Protocol
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Cross-Val:</span>
            <span>TimeSeriesSplit (5-Fold)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Corridor:</span>
            <span style={{ color: '#2ecc71' }}>80% Coverage (q0.10, q0.90)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Lookahead:</span>
            <span>Zero Leakage Mask</span>
          </div>
        </div>
      </div>

      {/* Solver Info */}
      <div style={{
        padding: '10px 12px',
        background: 'rgba(245, 166, 35, 0.05)',
        border: '1px solid var(--amber-dim)',
        borderRadius: 'var(--radius-md)',
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}>
        <span style={{ color: 'var(--amber)', fontWeight: 600 }}>NNLS Solver:</span> Combines model predictions with non-negative constraints ensuring bounded ensemble risk.
      </div>
    </div>
  )
}

