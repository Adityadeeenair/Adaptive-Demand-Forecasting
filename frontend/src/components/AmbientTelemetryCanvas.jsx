import { useEffect, useRef } from 'react'

export default function AmbientTelemetryCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationId
    let width = 0
    let height = 0
    let phase = 0

    // Drifting data particles along demand trajectories
    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * 1200,
      yRatio: 0.25 + Math.random() * 0.6,
      speed: 0.35 + Math.random() * 0.45,
      size: 1.2 + Math.random() * 1.8,
      opacity: 0.15 + Math.random() * 0.35,
      color: Math.random() > 0.4 ? 'rgba(245, 166, 35,' : 'rgba(74, 158, 255,',
    }))

    const resize = () => {
      if (!canvas) return
      width = canvas.width = canvas.offsetWidth || window.innerWidth
      height = canvas.height = canvas.offsetHeight || window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let sweepX = 0

    const render = () => {
      ctx.clearRect(0, 0, width, height)
      phase += 0.006
      sweepX += 0.5
      if (sweepX > width) sweepX = 0

      // 1. Faint horizontal coordinate grid lines with engineering datum ticks
      const datumLines = [
        { ratio: 0.18, label: 'CV THRESHOLD (0.25)' },
        { ratio: 0.45, label: 'AUTOCORRELATION LAG-7' },
        { ratio: 0.72, label: 'BASELINE RUN-RATE μ' },
        { ratio: 0.90, label: 'MINIMUM DENSITY FLOOR' },
      ]

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.022)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 8])
      ctx.font = '8px monospace'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'

      datumLines.forEach(({ ratio, label }) => {
        const y = height * ratio
        ctx.beginPath()
        ctx.moveTo(30, y)
        ctx.lineTo(width - 30, y)
        ctx.stroke()
        ctx.fillText(label, width - 180, y - 4)
      })
      ctx.setLineDash([])

      // 2. Primary Harmonic Demand Wave (Amber 7-Day Cycle)
      const centerY1 = height * 0.62
      ctx.beginPath()
      ctx.moveTo(0, centerY1)
      for (let x = 0; x <= width; x += 14) {
        const y = centerY1 +
          Math.sin(x * 0.0032 + phase) * 28 +
          Math.cos(x * 0.0018 - phase * 0.5) * 16
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.08)'
      ctx.lineWidth = 1.8
      ctx.stroke()

      // Gradient glow beneath primary wave
      ctx.lineTo(width, height)
      ctx.lineTo(0, height)
      ctx.closePath()
      const grad1 = ctx.createLinearGradient(0, centerY1 - 30, 0, height)
      grad1.addColorStop(0, 'rgba(245, 166, 35, 0.025)')
      grad1.addColorStop(1, 'rgba(245, 166, 35, 0)')
      ctx.fillStyle = grad1
      ctx.fill()

      // 3. Secondary Adaptive Wave (Steel Cyan)
      const centerY2 = height * 0.65
      ctx.beginPath()
      ctx.moveTo(0, centerY2)
      for (let x = 0; x <= width; x += 12) {
        const y = centerY2 +
          Math.sin(x * 0.006 - phase * 0.8) * 18 +
          Math.cos(x * 0.012 + phase * 0.4) * 8
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.06)'
      ctx.lineWidth = 1.4
      ctx.stroke()

      // 4. Subtle Upper Wave (High-Frequency Variance)
      const centerY3 = height * 0.26
      ctx.beginPath()
      ctx.moveTo(0, centerY3)
      for (let x = 0; x <= width; x += 16) {
        const y = centerY3 +
          Math.cos(x * 0.004 + phase * 0.7) * 14 +
          Math.sin(x * 0.008) * 8
      }
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.04)'
      ctx.lineWidth = 1
      ctx.stroke()

      // 5. Ambient Data Particles drifting horizontally
      particles.forEach((p) => {
        p.x += p.speed
        if (p.x > width + 20) {
          p.x = -20
          p.yRatio = 0.25 + Math.random() * 0.6
        }

        const baseY = height * p.yRatio
        const waveOffset = Math.sin(p.x * 0.0035 + phase) * 22
        const py = baseY + waveOffset

        ctx.fillStyle = `${p.color} ${p.opacity})`
        ctx.beginPath()
        ctx.arc(p.x, py, p.size, 0, Math.PI * 2)
        ctx.fill()
      })

      // 6. Vertical Telemetry Time-Cursor
      const gradSweep = ctx.createLinearGradient(0, 0, 0, height)
      gradSweep.addColorStop(0, 'rgba(245, 166, 35, 0)')
      gradSweep.addColorStop(0.5, 'rgba(245, 166, 35, 0.06)')
      gradSweep.addColorStop(1, 'rgba(245, 166, 35, 0)')

      ctx.strokeStyle = gradSweep
      ctx.lineWidth = 1
      ctx.setLineDash([3, 7])
      ctx.beginPath()
      ctx.moveTo(sweepX, 0)
      ctx.lineTo(sweepX, height)
      ctx.stroke()
      ctx.setLineDash([])

      // Telemetry badge along scrubber
      ctx.fillStyle = 'rgba(245, 166, 35, 0.22)'
      ctx.font = '8px monospace'
      ctx.fillText('SIGNAL SWEEP', sweepX + 6, 22)

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
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
