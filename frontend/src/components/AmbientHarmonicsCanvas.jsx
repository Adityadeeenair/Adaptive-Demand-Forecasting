import { useEffect, useRef } from 'react'

export default function AmbientHarmonicsCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationId
    let width = 0
    let height = 0
    let phase = 0

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
      phase += 0.008
      sweepX += 0.4
      if (sweepX > width) sweepX = 0

      // 1. Horizontal Amplitude Datum Guides
      const guides = [
        { ratio: 0.38, label: 'AMPLITUDE SIGMA +1.5 (PEAK)' },
        { ratio: 0.58, label: 'MEAN RUN-RATE (HISTORICAL)' },
        { ratio: 0.78, label: 'AMPLITUDE SIGMA -1.5 (FLOOR)' },
      ]

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 7])
      ctx.font = '8px monospace'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.045)'

      guides.forEach(({ ratio, label }) => {
        const y = height * ratio
        ctx.beginPath()
        ctx.moveTo(40, y)
        ctx.lineTo(width - 40, y)
        ctx.stroke()
        ctx.fillText(label, width - 210, y - 5)
      })
      ctx.setLineDash([])

      // 2. Primary Macro Seasonal Wave (Warm Amber)
      const centerY1 = height * 0.65
      ctx.beginPath()
      ctx.moveTo(0, centerY1)
      for (let x = 0; x <= width; x += 12) {
        const y = centerY1 +
          Math.sin(x * 0.0035 + phase) * 36 +
          Math.cos(x * 0.0015 - phase * 0.6) * 18
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.07)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Gradient under primary wave
      ctx.lineTo(width, height)
      ctx.lineTo(0, height)
      ctx.closePath()
      const grad1 = ctx.createLinearGradient(0, centerY1 - 40, 0, height)
      grad1.addColorStop(0, 'rgba(245, 166, 35, 0.025)')
      grad1.addColorStop(1, 'rgba(245, 166, 35, 0)')
      ctx.fillStyle = grad1
      ctx.fill()

      // 3. Secondary Cyclical Rhythm Wave (Steel Cyan)
      const centerY2 = height * 0.68
      ctx.beginPath()
      ctx.moveTo(0, centerY2)
      for (let x = 0; x <= width; x += 10) {
        const y = centerY2 +
          Math.sin(x * 0.007 - phase * 1.2) * 22 +
          Math.sin(x * 0.014 + phase) * 8
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.05)'
      ctx.lineWidth = 1.4
      ctx.stroke()

      // 4. Subtle Upper Wave (High-Horizon Projection)
      const centerY3 = height * 0.28
      ctx.beginPath()
      ctx.moveTo(0, centerY3)
      for (let x = 0; x <= width; x += 14) {
        const y = centerY3 +
          Math.cos(x * 0.004 + phase * 0.8) * 16 +
          Math.sin(x * 0.002) * 10
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.04)'
      ctx.lineWidth = 1.2
      ctx.stroke()

      // 5. Vertical Time-Cursor Scrubber Line
      const gradSweep = ctx.createLinearGradient(0, 0, 0, height)
      gradSweep.addColorStop(0, 'rgba(245, 166, 35, 0)')
      gradSweep.addColorStop(0.5, 'rgba(245, 166, 35, 0.06)')
      gradSweep.addColorStop(1, 'rgba(245, 166, 35, 0)')

      ctx.strokeStyle = gradSweep
      ctx.lineWidth = 1
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(sweepX, 0)
      ctx.lineTo(sweepX, height)
      ctx.stroke()
      ctx.setLineDash([])

      // Time tick label
      ctx.fillStyle = 'rgba(245, 166, 35, 0.18)'
      ctx.font = '8px monospace'
      ctx.fillText('INFERENCE CLOCK', sweepX + 6, 24)

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
