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

    // Construct a subtle geometric decision-tree branching lattice
    // Level 0: Root node at top-center
    // Level 1: 3 ensemble branch nodes
    // Level 2: 6 leaf / sub-estimator nodes
    const getNodes = () => {
      const centerX = width * 0.5
      const rootY = height * 0.12
      const midY = height * 0.42
      const leafY = height * 0.82

      return {
        root: { x: centerX, y: rootY, label: 'INPUT FEATURE MATRIX' },
        mid: [
          { x: centerX - width * 0.28, y: midY, label: 'RF BAGGING', color: '#4a9eff' },
          { x: centerX, y: midY + 15, label: 'XGB BOOSTING', color: '#2ecc71' },
          { x: centerX + width * 0.28, y: midY, label: 'LGB HISTOGRAM', color: '#9b59b6' },
        ],
        leafs: [
          { x: centerX - width * 0.36, y: leafY, color: '#4a9eff' },
          { x: centerX - width * 0.20, y: leafY, color: '#4a9eff' },
          { x: centerX - width * 0.08, y: leafY + 10, color: '#2ecc71' },
          { x: centerX + width * 0.08, y: leafY + 10, color: '#2ecc71' },
          { x: centerX + width * 0.20, y: leafY, color: '#9b59b6' },
          { x: centerX + width * 0.36, y: leafY, color: '#9b59b6' },
        ],
      }
    }

    const render = () => {
      t += 0.012
      ctx.clearRect(0, 0, width, height)

      const nodes = getNodes()

      // 1. Draw subtle connecting branch vector lines
      ctx.lineWidth = 1
      nodes.mid.forEach((m, idx) => {
        // Root to mid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
        ctx.setLineDash([3, 6])
        ctx.beginPath()
        ctx.moveTo(nodes.root.x, nodes.root.y)
        ctx.bezierCurveTo(
          nodes.root.x, (nodes.root.y + m.y) * 0.5,
          m.x, (nodes.root.y + m.y) * 0.5,
          m.x, m.y
        )
        ctx.stroke()

        // Mid to respective leaves
        const l1 = nodes.leafs[idx * 2]
        const l2 = nodes.leafs[idx * 2 + 1]
        ;[l1, l2].forEach((leaf) => {
          if (!leaf) return
          ctx.beginPath()
          ctx.moveTo(m.x, m.y)
          ctx.bezierCurveTo(
            m.x, (m.y + leaf.y) * 0.5,
            leaf.x, (m.y + leaf.y) * 0.5,
            leaf.x, leaf.y
          )
          ctx.stroke()
        })
      })
      ctx.setLineDash([])

      // 2. Animate sliding feature pulses along branches
      nodes.mid.forEach((m, idx) => {
        const pulseFrac = (t * 0.6 + idx * 0.33) % 1
        const px = nodes.root.x + (m.x - nodes.root.x) * pulseFrac
        const py = nodes.root.y + (m.y - nodes.root.y) * pulseFrac

        ctx.fillStyle = m.color
        ctx.globalAlpha = Math.sin(pulseFrac * Math.PI) * 0.25
        ctx.beginPath()
        ctx.arc(px, py, 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      })

      // 3. Draw Nodes (faint geometric rings)
      // Root
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.12)'
      ctx.beginPath()
      ctx.arc(nodes.root.x, nodes.root.y, 5 + Math.sin(t) * 1, 0, Math.PI * 2)
      ctx.stroke()

      // Mid nodes
      nodes.mid.forEach((m) => {
        ctx.strokeStyle = `${m.color}22`
        ctx.beginPath()
        ctx.arc(m.x, m.y, 4, 0, Math.PI * 2)
        ctx.stroke()
      })

      // Leaf nodes
      nodes.leafs.forEach((leaf) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
        ctx.beginPath()
        ctx.arc(leaf.x, leaf.y, 2, 0, Math.PI * 2)
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
