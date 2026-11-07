import { useEffect, useRef } from 'react'

export default function AmbientDecisionTreeCanvas() {
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
      width = canvas.width = canvas.offsetWidth || window.innerWidth
      height = canvas.height = canvas.offsetHeight || window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Precompute a full-viewport decision-tree and ensemble neural network
    // Distributed across left flank, top canopy, right flank, and center
    const buildBranches = () => {
      const branches = []

      // Left Tree Flank (Framing the left side of the screen)
      const lRoot = { x: width * 0.12, y: height * 0.08, label: 'INPUT : LAG MATRIX' }
      const lMid1 = { x: width * 0.05, y: height * 0.32, label: 'SPLIT : LAG_7' }
      const lMid2 = { x: width * 0.19, y: height * 0.36, label: 'SPLIT : ROLL_14' }
      const lLeaf1 = { x: width * 0.03, y: height * 0.68, label: 'LEAF : Q0.10' }
      const lLeaf2 = { x: width * 0.08, y: height * 0.72, label: 'LEAF : Q0.50' }
      const lLeaf3 = { x: width * 0.15, y: height * 0.76, label: 'LEAF : Q0.90' }
      const lLeaf4 = { x: width * 0.22, y: height * 0.80, label: 'LEAF : RESIDUAL' }

      // Right Tree Flank (Framing the right side of the screen)
      const rRoot = { x: width * 0.88, y: height * 0.08, label: 'INPUT : FOURIER CYCLES' }
      const rMid1 = { x: width * 0.81, y: height * 0.36, label: 'SPLIT : DOW_SIN' }
      const rMid2 = { x: width * 0.95, y: height * 0.32, label: 'SPLIT : PROMO_FLAG' }
      const rLeaf1 = { x: width * 0.78, y: height * 0.80, label: 'LEAF : WEEKEND' }
      const rLeaf2 = { x: width * 0.85, y: height * 0.76, label: 'LEAF : WEEKDAY' }
      const rLeaf3 = { x: width * 0.92, y: height * 0.72, label: 'LEAF : SURGE' }
      const rLeaf4 = { x: width * 0.97, y: height * 0.68, label: 'LEAF : BASELINE' }

      // Center Canopy Convergence (Connecting canopy behind the header and cards)
      const cRoot = { x: width * 0.50, y: height * 0.05, label: 'FEATURE BUS' }
      const cMidL = { x: width * 0.34, y: height * 0.22, label: 'RF BAGGING' }
      const cMidC = { x: width * 0.50, y: height * 0.24, label: 'XGB BOOST' }
      const cMidR = { x: width * 0.66, y: height * 0.22, label: 'LGB HIST' }
      const cEnsemble = { x: width * 0.50, y: height * 0.58, label: 'NNLS SOLVER' }

      // Left pathways
      branches.push({ p0: lRoot, p1: lMid1, color: '#4a9eff' })
      branches.push({ p0: lRoot, p1: lMid2, color: '#f5a623' })
      branches.push({ p0: lMid1, p1: lLeaf1, color: '#4a9eff' })
      branches.push({ p0: lMid1, p1: lLeaf2, color: '#4a9eff' })
      branches.push({ p0: lMid2, p1: lLeaf3, color: '#f5a623' })
      branches.push({ p0: lMid2, p1: lLeaf4, color: '#f5a623' })

      // Right pathways
      branches.push({ p0: rRoot, p1: rMid1, color: '#2ecc71' })
      branches.push({ p0: rRoot, p1: rMid2, color: '#9b59b6' })
      branches.push({ p0: rMid1, p1: rLeaf1, color: '#2ecc71' })
      branches.push({ p0: rMid1, p1: rLeaf2, color: '#2ecc71' })
      branches.push({ p0: rMid2, p1: rLeaf3, color: '#9b59b6' })
      branches.push({ p0: rMid2, p1: rLeaf4, color: '#9b59b6' })

      // Cross-canopy arches (Luminous connections across the top header)
      branches.push({ p0: lRoot, p1: cRoot, color: '#f5a623' })
      branches.push({ p0: rRoot, p1: cRoot, color: '#2ecc71' })
      branches.push({ p0: cRoot, p1: cMidL, color: '#4a9eff' })
      branches.push({ p0: cRoot, p1: cMidC, color: '#2ecc71' })
      branches.push({ p0: cRoot, p1: cMidR, color: '#9b59b6' })

      // Convergence down to NNLS ensemble
      branches.push({ p0: cMidL, p1: cEnsemble, color: '#4a9eff' })
      branches.push({ p0: cMidC, p1: cEnsemble, color: '#2ecc71' })
      branches.push({ p0: cMidR, p1: cEnsemble, color: '#9b59b6' })

      // Flank-to-center bridge fibers
      branches.push({ p0: lMid2, p1: cMidL, color: '#4a9eff' })
      branches.push({ p0: rMid1, p1: cMidR, color: '#9b59b6' })

      return branches
    }

    // Dynamic data packets traveling along branches
    const packetCount = 20
    const packets = Array.from({ length: packetCount }, (_, i) => ({
      branchIdx: i % 18,
      progress: (i / packetCount),
      speed: 0.003 + (i % 5) * 0.0018,
    }))

    const render = () => {
      t += 0.015
      ctx.clearRect(0, 0, width, height)

      const branches = buildBranches()

      // 1. Draw Geometric Grid & Horizon Guides
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.018)'
      ctx.lineWidth = 1
      const stepY = 120
      for (let y = stepY; y < height; y += stepY) {
        ctx.beginPath()
        ctx.moveTo(20, y)
        ctx.lineTo(width - 20, y)
        ctx.stroke()
      }

      // 2. Draw Branch Vectors with Luminous Beziers
      branches.forEach(({ p0, p1, color }) => {
        const midY = (p0.y + p1.y) * 0.5
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.bezierCurveTo(p0.x, midY, p1.x, midY, p1.x, p1.y)

        // Visible glowing stroke
        ctx.strokeStyle = `${color}18`
        ctx.lineWidth = 1.4
        ctx.stroke()

        // Faint core stroke
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
        ctx.lineWidth = 0.8
        ctx.stroke()
      })

      // 3. Draw Traveling Glowing Synaptic Data Packets (With Tail)
      packets.forEach((pkt) => {
        pkt.progress += pkt.speed
        if (pkt.progress > 1) {
          pkt.progress = 0
          pkt.branchIdx = (pkt.branchIdx + 3) % branches.length
        }

        const b = branches[pkt.branchIdx]
        if (!b) return
        const { p0, p1, color } = b
        const midY = (p0.y + p1.y) * 0.5

        // Cubic bezier interpolation formula
        const getBezierPoint = (u) => {
          const inv = 1 - u
          const cx1 = p0.x
          const cy1 = midY
          const cx2 = p1.x
          const cy2 = midY

          const x = inv * inv * inv * p0.x +
                    3 * inv * inv * u * cx1 +
                    3 * inv * u * u * cx2 +
                    u * u * u * p1.x
          const y = inv * inv * inv * p0.y +
                    3 * inv * inv * u * cy1 +
                    3 * inv * u * u * cy2 +
                    u * u * u * p1.y
          return { x, y }
        }

        const pos = getBezierPoint(pkt.progress)

        // Glowing packet head
        ctx.save()
        ctx.shadowBlur = 12
        ctx.shadowColor = color
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2)
        ctx.fill()

        // Trailing fading particle 1
        if (pkt.progress > 0.04) {
          const t1 = getBezierPoint(pkt.progress - 0.03)
          ctx.fillStyle = color
          ctx.globalAlpha = 0.45
          ctx.beginPath()
          ctx.arc(t1.x, t1.y, 2, 0, Math.PI * 2)
          ctx.fill()
        }

        // Trailing fading particle 2
        if (pkt.progress > 0.08) {
          const t2 = getBezierPoint(pkt.progress - 0.06)
          ctx.fillStyle = color
          ctx.globalAlpha = 0.2
          ctx.beginPath()
          ctx.arc(t2.x, t2.y, 1.2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      })

      // 4. Draw Decision Nodes with Concentric Breathing Halos
      const renderedNodes = new Set()
      branches.forEach(({ p0, p1, color }) => {
        ;[p0, p1].forEach((node) => {
          const key = `${Math.round(node.x)}_${Math.round(node.y)}`
          if (renderedNodes.has(key)) return
          renderedNodes.add(key)

          // Breathing outer ring
          const breathe = Math.sin(t * 2 + node.x * 0.01) * 2.5
          ctx.save()
          ctx.strokeStyle = `${color}35`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(node.x, node.y, 6 + breathe, 0, Math.PI * 2)
          ctx.stroke()

          // Solid core dot
          ctx.fillStyle = color
          ctx.shadowBlur = 8
          ctx.shadowColor = color
          ctx.beginPath()
          ctx.arc(node.x, node.y, 2.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()

          // Technical monospace label on key flank nodes (visible outside cards)
          if (node.label && (node.x < width * 0.24 || node.x > width * 0.76)) {
            ctx.font = '8px monospace'
            ctx.fillStyle = `${color}75`
            const isLeft = node.x < width * 0.24
            const textX = isLeft ? node.x + 12 : node.x - 100
            ctx.fillText(node.label, textX, node.y + 3)
          }
        })
      })

      // 5. Ambient Vertical Laser Sweep Line (Sweeps across every 8 seconds)
      const sweepCycle = (t * 0.25) % 1
      const sweepX = sweepCycle * width

      const sweepGrad = ctx.createLinearGradient(sweepX - 40, 0, sweepX + 40, 0)
      sweepGrad.addColorStop(0, 'rgba(74, 158, 255, 0)')
      sweepGrad.addColorStop(0.5, 'rgba(245, 166, 35, 0.055)')
      sweepGrad.addColorStop(1, 'rgba(74, 158, 255, 0)')

      ctx.fillStyle = sweepGrad
      ctx.fillRect(sweepX - 40, 0, 80, height)

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
