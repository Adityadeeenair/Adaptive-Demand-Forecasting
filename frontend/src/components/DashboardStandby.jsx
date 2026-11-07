import { useState, useEffect, useRef } from 'react'

// ── Synthetic Waveform Oscilloscope Radar (Spacious, Unboxed) ──────────────────
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
      width = canvas.width = canvas.offsetWidth || 720
      height = canvas.height = canvas.offsetHeight || 220
    }
    resize()
    window.addEventListener('resize', resize)

    // Precompute a synthetic 7-day cyclical retail demand series for Store 2 / Item 2
    const totalDays = 64
    const historyDays = 44
    const baseline = Array.from({ length: totalDays }, (_, i) => {
      const dayOfWeek = i % 7
      // Weekend peak on Friday/Saturday
      const weekendBump = (dayOfWeek === 5 || dayOfWeek === 6) ? 22 : 0
      const trend = Math.sin(i * 0.11) * 9
      const noise = Math.sin(i * 2.1) * 3.5
      return 58 + weekendBump + trend + noise
    })

    const render = () => {
      t += 0.018
      ctx.clearRect(0, 0, width, height)

      const splitX = width * 0.64
      const scaleY = (val) => {
        const norm = (val - 30) / (105 - 30)
        return height - 32 - norm * (height - 68)
      }

      // 1. Subtle horizontal datum grids & Y-axis labels
      ctx.font = '9px monospace'
      ;[90, 70, 50, 30].forEach((val) => {
        const y = scaleY(val)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(38, y)
        ctx.lineTo(width - 16, y)
        ctx.stroke()

        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
        ctx.fillText(`${val}u`, 8, y + 3)
      })

      // 2. Dual-zone division line (History vs Forecast)
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.35)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(splitX, 16)
      ctx.lineTo(splitX, height - 20)
      ctx.stroke()
      ctx.setLineDash([])

      // 3. Zone Header Labels (Direct on canvas, crisp & clean)
      ctx.font = '10px monospace'
      ctx.fillStyle = 'rgba(74, 158, 255, 0.7)'
      ctx.fillText('OBSERVED HISTORY (119D)', 42, 24)

      ctx.fillStyle = 'rgba(245, 166, 35, 0.85)'
      ctx.fillText('PROJECTED ENVELOPE (80% CORRIDOR)', splitX + 16, 24)

      // 4. Draw History Curve (Cyan line with data nodes)
      ctx.beginPath()
      ctx.strokeStyle = '#4a9eff'
      ctx.lineWidth = 1.8
      for (let i = 0; i <= historyDays; i++) {
        const x = 42 + (i / historyDays) * (splitX - 52)
        const y = scaleY(baseline[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // History data nodes
      for (let i = 0; i <= historyDays; i += 3) {
        const x = 42 + (i / historyDays) * (splitX - 52)
        const y = scaleY(baseline[i])
        ctx.fillStyle = '#4a9eff'
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // 5. Draw Forecast Confidence Band & Trajectory
      const lastHistX = splitX - 10
      const lastHistY = scaleY(baseline[historyDays])

      const forecastPoints = []
      const remainingDays = totalDays - historyDays
      for (let j = 0; j <= remainingDays; j++) {
        const frac = j / remainingDays
        const x = lastHistX + frac * (width - lastHistX - 24)
        const baseVal = baseline[historyDays + j] || 64
        // Breathing confidence envelope
        const spread = (12 + frac * 18) * (1 + Math.sin(t + frac * 2) * 0.08)
        forecastPoints.push({
          x,
          mid: scaleY(baseVal),
          upper: scaleY(baseVal + spread),
          lower: scaleY(baseVal - spread),
        })
      }

      // 80% Confidence Band Gradient Fill
      ctx.fillStyle = 'rgba(245, 166, 35, 0.10)'
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
      ctx.setLineDash([2, 4])
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
      const scanFrac = (Math.sin(t * 1.4) + 1) / 2
      const scanIdx = Math.floor(scanFrac * (forecastPoints.length - 1))
      const targetPoint = forecastPoints[scanIdx]
      if (targetPoint) {
        ctx.strokeStyle = 'rgba(245, 166, 35, 0.75)'
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
      height: 220,
      position: 'relative',
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

// ── Standby Forecast Deck (Center Panel: Clean, Spacious, Unboxed) ────────────
export function ForecastStandbyDeck() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Spacious Header with zero nested boxes */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '6px 4px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 7, height: 7,
            borderRadius: '50%',
            background: 'var(--amber)',
            boxShadow: '0 0 8px var(--amber)',
            animation: 'pulse 1.4s infinite',
          }} />
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-body)' }}>
              Awaiting Target Selection
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
              Select any SKU from the catalog on the left to compute demand trajectory
            </p>
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          background: 'var(--bg-elevated)',
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
        }}>
          <span>HORIZON: 30D DEFAULT</span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span style={{ color: 'var(--amber)' }}>NNLS ENSEMBLE PRIMED</span>
        </div>
      </div>

      {/* Hero Waveform Oscilloscope (Airy, Unboxed) */}
      <StandbyWaveformRadar />

      {/* Minimal Monospace Pipeline Indicator Strip */}
      <div style={{
        paddingTop: 12,
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Pipeline
          </span>
          {[
            { name: 'NNLS Ensemble', color: 'var(--amber)' },
            { name: 'LightGBM', color: '#2ecc71' },
            { name: 'XGBoost', color: '#9b59b6' },
            { name: 'Random Forest', color: '#4a9eff' },
          ].map((m) => (
            <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.color }} />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {m.name}
              </span>
            </div>
          ))}
        </div>

        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.04em' }}>
          ESTIMATORS READY
        </span>
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
      height: 320,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 32px',
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

// ── Standby Metrics Deck (Right Panel: Structured Model Scorecard) ────────────
export function MetricsStandbyDeck() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Target Objectives: 2 cleanly aligned KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}>
          <span style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: 4,
          }}>
            PRIMARY TARGET
          </span>
          <span style={{
            fontSize: 16,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: 'var(--amber)',
            display: 'block',
            marginBottom: 2,
          }}>
            WMAPE
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            Volume error
          </span>
        </div>

        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}>
          <span style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: 4,
          }}>
            UNIT VARIANCE
          </span>
          <span style={{
            fontSize: 16,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: '#4a9eff',
            display: 'block',
            marginBottom: 2,
          }}>
            MAE
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            Units / day
          </span>
        </div>
      </div>

      {/* Ensemble Model Pipeline Standby Roster */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          Ensemble Roster : 4 Models
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { name: 'NNLS Ensemble', type: 'Optimal Weights', color: 'var(--amber)' },
            { name: 'LightGBM',      type: 'Histogram Trees', color: '#2ecc71' },
            { name: 'XGBoost',       type: 'Optuna CV Folds', color: '#9b59b6' },
            { name: 'Random Forest', type: 'Bagging Baseline', color: '#4a9eff' },
          ].map((m) => (
            <div
              key={m.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</span>
              </div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{m.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Validation Protocol specs (Cleanly aligned key-value pairs) */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
      }}>
        <div style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 2,
        }}>
          Validation Protocol
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Cross-Validation</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>5-Fold TimeSeries</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Safety Corridor</span>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>80% Empirical</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Temporal Mask</span>
          <span style={{ color: 'var(--text-primary)' }}>Zero Leakage</span>
        </div>
      </div>

      {/* Clean status pill */}
      <div style={{
        padding: '8px 12px',
        background: 'rgba(245, 166, 35, 0.05)',
        border: '1px solid var(--amber-dim)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
        textAlign: 'center',
      }}>
        Run a forecast to compute live out-of-fold scores
      </div>

    </div>
  )
}
