import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

// ── useInView ────────────────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function FadeSection({ children, delay = 0 }) {
  const [ref, visible] = useInView()
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(30px)',
      transition: `opacity .7s ease ${delay}ms, transform .7s ease ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

// ── useBreakpoint — read-only, no layout side-effects ────────────────────────
function useBreakpoint() {
  const [bp, setBp] = useState({ isMobile: false, isTablet: false })
  useEffect(() => {
    const update = () => setBp({
      isMobile: window.innerWidth < 640,
      isTablet: window.innerWidth >= 640 && window.innerWidth < 1024,
    })
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])
  return bp
}

// ── Data ─────────────────────────────────────────────────────────────────────
const SEGS = [
  { label: 'Stable',   color: '#2ecc71', bars: [60,62,58,61,60,63,59,62,60,61,59,62], desc: 'Flat demand. Tight confidence bands.',     detail: 'Products with consistent, predictable sales. Low forecast error. Random Forest tends to dominate here due to its stability on low-variance signals.' },
  { label: 'Trending', color: '#f5a623', bars: [38,43,48,52,56,60,64,68,72,76,80,84], desc: 'Clear slope. Trend continuation applied.', detail: 'Sustained upward or downward movement. XGBoost and LightGBM capture the slope well. NNLS ensemble weights them higher for these products.' },
  { label: 'Seasonal', color: '#9b59b6', bars: [44,72,50,82,44,70,52,80,46,74,50,76], desc: 'Recurring cycles. Pattern preserved.',     detail: 'Regular peaks and troughs tied to time of year or week. Lag features encode the cycle. All three models contribute, ensemble reduces overfitting.' },
  { label: 'Volatile', color: '#e74c3c', bars: [80,26,90,18,76,46,88,20,72,54,84,22], desc: 'High variance. Wide confidence bands.',    detail: 'Erratic demand with no clear pattern. Confidence bands widen significantly. Ensemble averaging smooths extremes. Plan conservatively.' },
]

const PIPELINE = [
  { num: '01', label: 'Upload',   desc: 'Drop a CSV. Column names detected automatically.' },
  { num: '02', label: 'Segment',  desc: 'System analyses demand patterns per product.' },
  { num: '03', label: 'Train',    desc: 'Three ML models trained with Optuna tuning.' },
  { num: '04', label: 'Forecast', desc: 'Ensemble predictions with confidence bands.' },
]

const FEATURES = [
  { icon: '⬡', title: 'Demand segmentation',  desc: 'Automatically classifies products into stable, seasonal, volatile, and intermittent demand patterns.' },
  { icon: '◈', title: 'Ensemble ML models',    desc: 'Random Forest, XGBoost, and LightGBM combined via non-negative least squares for optimal accuracy.' },
  { icon: '◎', title: 'Confidence intervals',  desc: '80% prediction bands via quantile regression. Know the range, not just the point estimate.' },
  { icon: '⊕', title: 'Model comparison',      desc: 'Compare all models side-by-side on the same chart. See which fits your data best.' },
  { icon: '◇', title: 'Dataset insights',      desc: 'Segment distribution, top products by volume, and data quality diagnostics at a glance.' },
  { icon: '↓', title: 'Export ready',          desc: 'Download forecasts as CSV for use in any downstream planning or inventory system.' },
]

const MODELS = [
  { label: 'XGBoost',       short: 'XGB',  color: '#f5a623' },
  { label: 'LightGBM',      short: 'LGB',  color: '#2ecc71' },
  { label: 'Random Forest', short: 'RF',   color: '#9b59b6' },
  { label: 'NNLS Ensemble', short: 'NNLS', color: '#64b5f6' },
]

const TYPEWRITER_WORDS = ['Before it spikes.','Before it shifts.','Before it sells out.','Before it disappears.','Before it crashes.']

// ── Forecast data ─────────────────────────────────────────────────────────────
function generateForecastData() {
  const hist = [], fc = [], up = [], lo = []
  let v = 55
  for (let i = 0; i < 90; i++) {
    v += (Math.random() - 0.47) * 3.5 + Math.sin(i * 0.2) * 2.5
    v = Math.max(18, Math.min(90, v)); hist.push({ x: i, y: v })
  }
  let fv = v
  for (let i = 0; i < 55; i++) {
    fv += (Math.random() - 0.44) * 3 + Math.sin((90 + i) * 0.2) * 2
    fv = Math.max(18, Math.min(95, fv))
    const b = 3 + i * 0.22
    fc.push({ x: 90 + i, y: fv })
    up.push({ x: 90 + i, y: Math.min(100, fv + b) })
    lo.push({ x: 90 + i, y: Math.max(5, fv - b) })
  }
  return { hist, fc, up, lo }
}

// ── AnimatedChart — memoized so parent state (activeCard) never re-renders it ─
const AnimatedChart = React.memo(function AnimatedChart() {
  const canvasRef = useRef(null), fdataRef = useRef(generateForecastData()), rafRef = useRef(null)
  const sizeRef = useRef({ W: 0, H: 0 }), revealRef = useRef(0), waveTRef = useRef(0)
  const particlesRef = useRef([]), nodesRef = useRef([])
  const phaseRef = useRef('drawing'), holdTimerRef = useRef(0), fadeAlphaRef = useRef(1)

  const initScene = useCallback((W, H) => {
    particlesRef.current = Array.from({ length: 65 }, () => ({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*.14, vy:(Math.random()-.5)*.09, r:.5+Math.random()*1.6, a:.04+Math.random()*.14, phase:Math.random()*Math.PI*2, col:Math.random()>.6?'245,166,35':'100,181,246' }))
    nodesRef.current = Array.from({ length: 22 }, () => ({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*.028, vy:(Math.random()-.5)*.018 }))
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); const { W, H } = sizeRef.current
    if (!W || !H) { rafRef.current = requestAnimationFrame(draw); return }
    const fdata = fdataRef.current, total = fdata.hist.length + fdata.fc.length
    waveTRef.current += 0.004; const waveT = waveTRef.current, now = Date.now()
    if (phaseRef.current==='drawing') { revealRef.current=Math.min(total,revealRef.current+.55); if(revealRef.current>=total){phaseRef.current='holding';holdTimerRef.current=now;fadeAlphaRef.current=1} }
    else if (phaseRef.current==='holding') { if(now-holdTimerRef.current>1800) phaseRef.current='fading' }
    else if (phaseRef.current==='fading') { fadeAlphaRef.current=Math.max(0,fadeAlphaRef.current-.018); if(fadeAlphaRef.current<=0) phaseRef.current='resetting' }
    else { fdataRef.current=generateForecastData(); revealRef.current=0; fadeAlphaRef.current=1; phaseRef.current='drawing' }
    const ca=fadeAlphaRef.current, hR=Math.min(Math.floor(revealRef.current),fdata.hist.length), fR=Math.max(0,Math.floor(revealRef.current)-fdata.hist.length)
    ctx.clearRect(0,0,W,H)
    ;[{x:W*.15,y:H*.35,r:W*.42,col:'rgba(245,166,35,.025)'},{x:W*.85,y:H*.65,r:W*.36,col:'rgba(100,181,246,.018)'},{x:W*.5,y:H*.5,r:W*.5,col:'rgba(155,89,182,.014)'},{x:W*.3,y:H*.8,r:W*.28,col:'rgba(46,204,113,.012)'}].forEach(a=>{const g=ctx.createRadialGradient(a.x+Math.sin(waveT*.9)*28,a.y+Math.cos(waveT*.65)*18,0,a.x,a.y,a.r);g.addColorStop(0,a.col);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,Math.PI*2);ctx.fill()})
    const nodes=nodesRef.current
    for(let i=0;i<nodes.length;i++){nodes[i].x+=nodes[i].vx;nodes[i].y+=nodes[i].vy;if(nodes[i].x<0||nodes[i].x>W)nodes[i].vx*=-1;if(nodes[i].y<0||nodes[i].y>H)nodes[i].vy*=-1;for(let j=i+1;j<nodes.length;j++){const dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y,dist=Math.sqrt(dx*dx+dy*dy);if(dist<160){ctx.strokeStyle=`rgba(245,166,35,${(1-dist/160)*.07})`;ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);ctx.stroke()}}ctx.beginPath();ctx.arc(nodes[i].x,nodes[i].y,1.1,0,Math.PI*2);ctx.fillStyle='rgba(245,166,35,.12)';ctx.fill()}
    const t=now*.001;particlesRef.current.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<-5)p.x=W+5;if(p.x>W+5)p.x=-5;if(p.y<-5)p.y=H+5;if(p.y>H+5)p.y=-5;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(${p.col},${p.a*(0.4+0.6*Math.sin(t+p.phase))})`;ctx.fill()})
    const padL=W*.07,padR=W*.05,padT=H*.18,padB=H*.12,cw=W-padL-padR,ch=H-padT-padB
    const toX=xi=>padL+(xi/(total-1))*cw, toY=yi=>padT+ch-(yi/100)*ch
    ctx.strokeStyle=`rgba(245,166,35,${.03*ca})`;ctx.lineWidth=.5
    for(let g=0;g<=5;g++){const gy=padT+(g/5)*ch;ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(padL+cw,gy);ctx.stroke()}
    for(let g=0;g<=10;g++){const gx=padL+(g/10)*cw;ctx.beginPath();ctx.moveTo(gx,padT);ctx.lineTo(gx,padT+ch);ctx.stroke()}
    if(fR>0){const tx=toX(fdata.hist.length-1);ctx.strokeStyle=`rgba(245,166,35,${.22*ca})`;ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(tx,padT);ctx.lineTo(tx,padT+ch);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=`rgba(245,166,35,${.3*ca})`;ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText('TODAY',tx,padT-6)}
    if(fR>1){const bl=Math.min(fR,fdata.up.length);ctx.beginPath();ctx.moveTo(toX(fdata.up[0].x),toY(fdata.up[0].y));for(let i=1;i<bl;i++)ctx.lineTo(toX(fdata.up[i].x),toY(fdata.up[i].y));for(let i=Math.min(fR,fdata.lo.length)-1;i>=0;i--)ctx.lineTo(toX(fdata.lo[i].x),toY(fdata.lo[i].y));ctx.closePath();const bg=ctx.createLinearGradient(toX(90),0,toX(144),0);bg.addColorStop(0,`rgba(245,166,35,${.1*ca})`);bg.addColorStop(1,`rgba(245,166,35,${.02*ca})`);ctx.fillStyle=bg;ctx.fill();ctx.setLineDash([3,6]);ctx.strokeStyle=`rgba(245,166,35,${.14*ca})`;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(toX(fdata.up[0].x),toY(fdata.up[0].y));for(let i=1;i<bl;i++)ctx.lineTo(toX(fdata.up[i].x),toY(fdata.up[i].y));ctx.stroke();ctx.beginPath();ctx.moveTo(toX(fdata.lo[0].x),toY(fdata.lo[0].y));for(let i=1;i<Math.min(fR,fdata.lo.length);i++)ctx.lineTo(toX(fdata.lo[i].x),toY(fdata.lo[i].y));ctx.stroke();ctx.setLineDash([])}
    if(hR>1){ctx.beginPath();ctx.moveTo(toX(fdata.hist[0].x),toY(fdata.hist[0].y));for(let i=1;i<hR;i++)ctx.lineTo(toX(fdata.hist[i].x),toY(fdata.hist[i].y));ctx.lineTo(toX(fdata.hist[hR-1].x),padT+ch);ctx.lineTo(toX(fdata.hist[0].x),padT+ch);ctx.closePath();const ag=ctx.createLinearGradient(0,padT,0,padT+ch);ag.addColorStop(0,`rgba(100,181,246,${.08*ca})`);ag.addColorStop(1,`rgba(100,181,246,${.005*ca})`);ctx.fillStyle=ag;ctx.fill();const lg=ctx.createLinearGradient(toX(0),0,toX(fdata.hist.length),0);lg.addColorStop(0,`rgba(120,190,255,${.2*ca})`);lg.addColorStop(1,`rgba(120,190,255,${.65*ca})`);ctx.strokeStyle=lg;ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(toX(fdata.hist[0].x),toY(fdata.hist[0].y));for(let i=1;i<hR;i++)ctx.lineTo(toX(fdata.hist[i].x),toY(fdata.hist[i].y));ctx.stroke()}
    if(fR>1){const bx=toX(fdata.hist[fdata.hist.length-1].x),by=toY(fdata.hist[fdata.hist.length-1].y);const fg=ctx.createLinearGradient(bx,0,toX(144),0);fg.addColorStop(0,`rgba(245,166,35,${.9*ca})`);fg.addColorStop(1,`rgba(245,166,35,${.18*ca})`);ctx.strokeStyle=fg;ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(bx,by);for(let i=0;i<Math.min(fR,fdata.fc.length);i++)ctx.lineTo(toX(fdata.fc[i].x),toY(fdata.fc[i].y));ctx.stroke()}
    const rInt=Math.floor(revealRef.current)
    if(phaseRef.current==='drawing'&&rInt>2&&rInt<total){const fp=rInt<fdata.hist.length?fdata.hist[Math.min(rInt-1,fdata.hist.length-1)]:fdata.fc[Math.min(fR-1,fdata.fc.length-1)];if(fp){const col=rInt<fdata.hist.length?'120,190,255':'245,166,35';const fx=toX(fp.x),fy=toY(fp.y);const pulse=.5+.5*Math.sin(now*.003);ctx.globalAlpha=ca;for(let ring=1;ring<=3;ring++){const rp=(pulse+ring*.33)%1;ctx.beginPath();ctx.arc(fx,fy,4+rp*14,0,Math.PI*2);ctx.strokeStyle=`rgba(${col},${(1-rp)*.2})`;ctx.lineWidth=.8;ctx.stroke()}ctx.beginPath();ctx.arc(fx,fy,2.8,0,Math.PI*2);ctx.fillStyle=`rgba(${col},.95)`;ctx.fill();ctx.globalAlpha=1}}
    const scanY=((now*.000035)%1)*H;const sg=ctx.createLinearGradient(0,scanY-80,0,scanY+80);sg.addColorStop(0,'rgba(245,166,35,0)');sg.addColorStop(.5,'rgba(245,166,35,.012)');sg.addColorStop(1,'rgba(245,166,35,0)');ctx.fillStyle=sg;ctx.fillRect(0,scanY-80,W,160)
    rafRef.current=requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    let debounceTimer = null
    const ro = new ResizeObserver(() => {
      // debounce: only act after resize settles, never during card-expansion reflow
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        const W=canvas.offsetWidth,H=canvas.offsetHeight
        if (!W || !H) return
        canvas.width=W*devicePixelRatio; canvas.height=H*devicePixelRatio
        const ctx=canvas.getContext('2d'); ctx.scale(devicePixelRatio,devicePixelRatio)
        const isFirstInit = sizeRef.current.W === 0
        sizeRef.current={W,H}
        if (isFirstInit) initScene(W,H)
      }, 50)
    })
    ro.observe(canvas); rafRef.current=requestAnimationFrame(draw)
    return () => { clearTimeout(debounceTimer); ro.disconnect(); if(rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw, initScene])

  return <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:0.9 }} />
}) // end React.memo

// ── MiniSparkline ─────────────────────────────────────────────────────────────
function MiniSparkline({ bars, color, tall = false }) {
  const max = Math.max(...bars), h = tall ? 44 : 28
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:h }}>
      {bars.map((v,i) => (
        <div key={i} style={{ flex:1, minWidth:4, height:`${Math.round((v/max)*h)}px`, background:color, opacity:0.35+(i/bars.length)*0.65, borderRadius:'1px 1px 0 0', transition:`height .35s cubic-bezier(.34,1.3,.64,1) ${i*18}ms` }} />
      ))}
    </div>
  )
}

// ── SegmentCard — touch support added via onClick ─────────────────────────────
function SegmentCard({ seg, isActive, onEnter, onLeave, onTap, delay = 0 }) {
  const [ref, visible] = useInView()
  return (
    <div
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onTap}
      className="seg-card"
      style={{
        flex: isActive ? '2 1 220px' : '1 1 140px',
        padding: isActive ? '20px 22px' : '16px 18px',
        background: isActive ? `${seg.color}0d` : 'var(--bg-surface)',
        border: `1px solid ${isActive ? seg.color+'40' : seg.color+'1a'}`,
        borderRadius: 'var(--radius-lg)',
        transition: 'flex .45s cubic-bezier(.4,0,.2,1), padding .35s ease, background .3s ease, border-color .3s ease, opacity .65s ease, transform .65s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transitionDelay: visible ? `${delay}ms` : '0ms',
        cursor: 'default',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
        <span style={{ fontSize:10, letterSpacing:'.1em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontWeight:700, color:isActive?seg.color:`${seg.color}99`, transition:'color .25s' }}>{seg.label}</span>
        {isActive && <span style={{ width:5, height:5, borderRadius:'50%', background:seg.color, display:'inline-block', animation:'pulse-dot 1.4s ease-in-out infinite' }} />}
      </div>
      <MiniSparkline bars={seg.bars} color={seg.color} tall={isActive} />
      <p style={{ marginTop:8, fontSize:11, color:isActive?'var(--text-secondary)':'var(--text-tertiary)', lineHeight:1.5, transition:'color .25s' }}>{seg.desc}</p>
      <div style={{ maxHeight:isActive?'100px':'0px', opacity:isActive?1:0, overflow:'hidden', transition:'max-height .45s cubic-bezier(.4,0,.2,1), opacity .3s ease', marginTop:isActive?10:0 }}>
        <div style={{ width:24, height:1, background:seg.color, opacity:0.4, marginBottom:8 }} />
        <p style={{ fontSize:11, color:'var(--text-tertiary)', lineHeight:1.65, fontFamily:'var(--font-display)' }}>{seg.detail}</p>
      </div>
    </div>
  )
}

// ── Typewriter ────────────────────────────────────────────────────────────────
function TypewriterText() {
  const [wordIndex,setWordIndex]=useState(0),[displayed,setDisplayed]=useState(''),[isDeleting,setIsDeleting]=useState(false)
  useEffect(()=>{const current=TYPEWRITER_WORDS[wordIndex];let timeout;if(!isDeleting&&displayed.length<current.length)timeout=setTimeout(()=>setDisplayed(current.slice(0,displayed.length+1)),72);else if(!isDeleting&&displayed.length===current.length)timeout=setTimeout(()=>setIsDeleting(true),2200);else if(isDeleting&&displayed.length>0)timeout=setTimeout(()=>setDisplayed(current.slice(0,displayed.length-1)),40);else{setIsDeleting(false);setWordIndex((wordIndex+1)%TYPEWRITER_WORDS.length)}return()=>clearTimeout(timeout)},[displayed,isDeleting,wordIndex])
  return <span style={{color:'var(--amber)'}}>{displayed}<span style={{display:'inline-block',width:3,height:'0.82em',background:'var(--amber)',marginLeft:2,verticalAlign:'middle',animation:'blink 1s step-end infinite'}}/></span>
}

// ── GitHub badge ──────────────────────────────────────────────────────────────
function GitHubBadge() {
  return (
    <a href="https://github.com/Adityadeeenair/Adaptive-Demand-Forecasting" target="_blank" rel="noopener noreferrer" className="gh-badge"
      style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'6px 14px', background:'rgba(245,166,35,.07)', border:'1px solid rgba(245,166,35,.22)', borderRadius:100, fontSize:11, fontFamily:'var(--font-display)', fontWeight:700, color:'var(--amber)', textDecoration:'none', letterSpacing:'.04em', transition:'background .2s, border-color .2s' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.6.113.793-.26.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
      View on GitHub
    </a>
  )
}

// ── 3D Pipeline ───────────────────────────────────────────────────────────────
function Pipeline3D() {
  const sectionRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const { isMobile, isTablet } = useBreakpoint()

  useEffect(() => {
    const handler = () => {
      if (!sectionRef.current) return
      const rect = sectionRef.current.getBoundingClientRect()
      const p = Math.max(0, Math.min(1, (-rect.top) / (rect.height - window.innerHeight * 0.6)))
      setProgress(p)
    }
    window.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // On mobile/tablet: disable 3D perspective tilt (causes clipping), keep step reveal
  const use3D = !isMobile && !isTablet

  return (
    <section ref={sectionRef} style={{ padding: isMobile ? '60px 16px' : '88px 24px', borderTop:'1px solid var(--border)', background:'var(--bg-surface)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(245,166,35,.04) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ maxWidth:960, margin:'0 auto' }}>
        <FadeSection>
          <p style={{ fontSize:10, color:'var(--text-tertiary)', fontFamily:'var(--font-display)', letterSpacing:'.14em', textTransform:'uppercase', textAlign:'center', marginBottom:12 }}>How it works</p>
          <h2 style={{ fontSize: isMobile ? 22 : 28, fontFamily:'var(--font-heading)', fontWeight:700, textAlign:'center', color:'var(--text-primary)', marginBottom: isMobile ? 40 : 64, letterSpacing:'-.01em' }}>From raw data to forecast in four steps</h2>
        </FadeSection>

        {/* Desktop + tablet-landscape: 4-column 3D grid */}
        {!isMobile && (
          <div style={{ perspective: use3D ? '900px' : 'none', perspectiveOrigin:'50% 40%' }}>
            <div style={{ display:'grid', gridTemplateColumns: isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isTablet ? '1px' : 0, position:'relative', transform: use3D ? `rotateX(${Math.max(0,22-progress*28)}deg) translateZ(${progress*40}px)` : 'none', transformStyle: use3D ? 'preserve-3d' : 'flat', transition:'transform .05s linear' }}>
              {!isTablet && <div style={{ position:'absolute', top:22, left:'calc(12.5% + 12px)', right:'calc(12.5% + 12px)', height:1, background:'linear-gradient(90deg,transparent,rgba(245,166,35,.35) 20%,rgba(245,166,35,.35) 80%,transparent)', pointerEvents:'none' }} />}
              {PIPELINE.map((p, i) => {
                const stepActive = progress > i * 0.22
                return (
                  <div key={p.num} className="pipe-step" style={{ padding:'28px 20px 32px', textAlign:'center', position:'relative', borderRight: isTablet ? (i%2===0?'1px solid var(--border)':'none') : (i<3?'1px solid var(--border)':'none'), borderBottom: isTablet ? (i<2?'1px solid var(--border)':'none') : 'none', transform:stepActive?'translateZ(0px) scale(1)':'translateZ(-30px) scale(0.94)', opacity:stepActive?1:0.35, transition:`transform .6s cubic-bezier(.34,1.2,.64,1) ${i*80}ms, opacity .5s ease ${i*80}ms` }}>
                    <div className="pipe-num-box" style={{ width:40, height:40, borderRadius:12, background:stepActive?'rgba(245,166,35,.14)':'rgba(245,166,35,.05)', border:`1px solid ${stepActive?'rgba(245,166,35,.55)':'rgba(245,166,35,.15)'}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', transition:'all .4s ease', boxShadow:stepActive?'0 0 20px rgba(245,166,35,.12)':'none' }}>
                      <span style={{ fontSize:11, fontFamily:'var(--font-display)', color:'var(--amber)', fontWeight:700, letterSpacing:'.06em' }}>{p.num}</span>
                    </div>
                    <p style={{ fontSize:14, fontFamily:'var(--font-display)', fontWeight:700, color:stepActive?'var(--text-primary)':'var(--text-tertiary)', marginBottom:8, transition:'color .4s' }}>{p.label}</p>
                    <p style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>{p.desc}</p>
                    {stepActive && <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:32, height:2, background:'linear-gradient(90deg,transparent,var(--amber),transparent)', borderRadius:2 }} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Mobile: vertical stack */}
        {isMobile && (
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {PIPELINE.map((p, i) => {
              const stepActive = progress > i * 0.22
              return (
                <div key={p.num} style={{ display:'flex', alignItems:'flex-start', gap:16, padding:'20px 16px', borderBottom:'1px solid var(--border)', opacity:stepActive?1:0.4, transition:`opacity .5s ease ${i*80}ms` }}>
                  <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:stepActive?'rgba(245,166,35,.14)':'rgba(245,166,35,.05)', border:`1px solid ${stepActive?'rgba(245,166,35,.55)':'rgba(245,166,35,.15)'}`, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .4s', boxShadow:stepActive?'0 0 16px rgba(245,166,35,.12)':'none' }}>
                    <span style={{ fontSize:10, fontFamily:'var(--font-display)', color:'var(--amber)', fontWeight:700 }}>{p.num}</span>
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontFamily:'var(--font-display)', fontWeight:700, color:stepActive?'var(--text-primary)':'var(--text-tertiary)', marginBottom:4, transition:'color .4s' }}>{p.label}</p>
                    <p style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>{p.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ── ComparisonChart — canvas with ResizeObserver for orientation changes ──────
function ComparisonChart({ type }) {
  const canvasRef = useRef(null), rafRef = useRef(null)
  const [ref, visible] = useInView(0.15)
  const startedRef = useRef(false), progressRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return

    const points = []
    if (type === 'before') {
      let v = 50
      for (let i = 0; i < 60; i++) { v += (Math.random()-.45)*14+(i%12===0?-18:0); v=Math.max(8,Math.min(88,v)); points.push(v) }
    } else {
      let v = 50
      for (let i = 0; i < 60; i++) { v += (Math.random()-.47)*4+Math.sin(i*.22)*3; v=Math.max(22,Math.min(78,v)); points.push(v) }
    }
    const ac = type==='before' ? '231,76,60' : '46,204,113'

    const resize = () => {
      const W = canvas.offsetWidth, H = canvas.offsetHeight
      canvas.width = W*devicePixelRatio; canvas.height = H*devicePixelRatio
      canvas.getContext('2d').scale(devicePixelRatio, devicePixelRatio)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      if (startedRef.current) progressRef.current = Math.min(1, progressRef.current+0.012)
      const W = canvas.offsetWidth, H = canvas.offsetHeight
      const ctx = canvas.getContext('2d')
      const vis = Math.floor(progressRef.current * points.length)
      ctx.clearRect(0,0,W,H)
      const padL=12,padR=12,padT=14,padB=14,cw=W-padL-padR,ch=H-padT-padB
      const toX=i=>padL+(i/(points.length-1))*cw, toY=v=>padT+ch-((v-0)/100)*ch
      ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=.5
      for(let g=0;g<=4;g++){const gy=padT+(g/4)*ch;ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(padL+cw,gy);ctx.stroke()}
      if(vis>1){ctx.beginPath();ctx.moveTo(toX(0),toY(points[0]));for(let i=1;i<vis;i++)ctx.lineTo(toX(i),toY(points[i]));ctx.lineTo(toX(vis-1),padT+ch);ctx.lineTo(toX(0),padT+ch);ctx.closePath();const ag=ctx.createLinearGradient(0,padT,0,padT+ch);ag.addColorStop(0,`rgba(${ac},.12)`);ag.addColorStop(1,`rgba(${ac},.01)`);ctx.fillStyle=ag;ctx.fill();ctx.beginPath();ctx.moveTo(toX(0),toY(points[0]));for(let i=1;i<vis;i++)ctx.lineTo(toX(i),toY(points[i]));ctx.strokeStyle=`rgba(${ac},.8)`;ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();if(progressRef.current<.99){const lx=toX(vis-1),ly=toY(points[vis-1]);const pulse=.5+.5*Math.sin(Date.now()*.004);ctx.beginPath();ctx.arc(lx,ly,2.5+pulse*3,0,Math.PI*2);ctx.strokeStyle=`rgba(${ac},${.25*(1-pulse)})`;ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(lx,ly,2.2,0,Math.PI*2);ctx.fillStyle=`rgba(${ac},.95)`;ctx.fill()}}
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { ro.disconnect(); if(rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [type])

  useEffect(() => { if (visible) startedRef.current = true }, [visible])

  return (
    <div ref={ref} style={{ flex:1, minWidth:0 }}>
      <canvas ref={canvasRef} style={{ width:'100%', height:110, display:'block' }} />
    </div>
  )
}

function ComparisonSection() {
  const { isMobile } = useBreakpoint()
  return (
    <section style={{ padding: isMobile ? '56px 16px' : '80px 24px', borderTop:'1px solid var(--border)', background:'var(--bg-base)' }}>
      <div style={{ maxWidth:860, margin:'0 auto' }}>
        <FadeSection>
          <p style={{ fontSize:10, color:'var(--text-tertiary)', fontFamily:'var(--font-display)', letterSpacing:'.14em', textTransform:'uppercase', textAlign:'center', marginBottom:12 }}>The difference</p>
          <h2 style={{ fontSize: isMobile ? 22 : 28, fontFamily:'var(--font-heading)', fontWeight:700, textAlign:'center', color:'var(--text-primary)', marginBottom:isMobile?36:52, letterSpacing:'-.01em' }}>Reactive vs predictive</h2>
        </FadeSection>
        <FadeSection delay={80}>
          {/* Stack vertically on mobile, side-by-side on tablet+ */}
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 12 : 2 }}>
            <div style={{ padding: isMobile ? '20px 16px' : '28px 28px 24px', background:'rgba(231,76,60,.03)', borderRadius: isMobile ? 'var(--radius-lg)' : 'var(--radius-lg) 0 0 var(--radius-lg)', borderTop:'2px solid rgba(231,76,60,.18)' }}>
              <span style={{ fontSize:9, letterSpacing:'.16em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontWeight:700, color:'rgba(231,76,60,.7)', display:'block', marginBottom:6 }}>Without forecasting</span>
              <p style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:20, lineHeight:1.6, fontFamily:'var(--font-display)' }}>Reacting after the fact. Stockouts, overstock, and guesswork.</p>
              <ComparisonChart type="before" />
              <div style={{ display:'flex', gap:20, marginTop:18, flexWrap:'wrap' }}>
                {[['Stockouts','frequent'],['Overstock','common'],['Planning','reactive']].map(([k,v])=>(
                  <div key={k}><p style={{ fontSize:9, color:'var(--text-tertiary)', fontFamily:'var(--font-display)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:2 }}>{k}</p><p style={{ fontSize:12, color:'rgba(231,76,60,.75)', fontFamily:'var(--font-display)', fontWeight:700 }}>{v}</p></div>
                ))}
              </div>
            </div>
            <div style={{ padding: isMobile ? '20px 16px' : '28px 28px 24px', background:'rgba(46,204,113,.03)', borderRadius: isMobile ? 'var(--radius-lg)' : '0 var(--radius-lg) var(--radius-lg) 0', borderTop:'2px solid rgba(46,204,113,.22)' }}>
              <span style={{ fontSize:9, letterSpacing:'.16em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontWeight:700, color:'rgba(46,204,113,.8)', display:'block', marginBottom:6 }}>With ADF</span>
              <p style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:20, lineHeight:1.6, fontFamily:'var(--font-display)' }}>Knowing what comes next. Confident, proactive inventory decisions.</p>
              <ComparisonChart type="after" />
              <div style={{ display:'flex', gap:20, marginTop:18, flexWrap:'wrap' }}>
                {[['Stockouts','minimised'],['Overstock','reduced'],['Planning','proactive']].map(([k,v])=>(
                  <div key={k}><p style={{ fontSize:9, color:'var(--text-tertiary)', fontFamily:'var(--font-display)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:2 }}>{k}</p><p style={{ fontSize:12, color:'rgba(46,204,113,.85)', fontFamily:'var(--font-display)', fontWeight:700 }}>{v}</p></div>
                ))}
              </div>
            </div>
          </div>
        </FadeSection>
      </div>
    </section>
  )
}

// ── Landing ───────────────────────────────────────────────────────────────────
export default function Landing() {
  const [activeCard, setActiveCard] = useState(null)
  const { isMobile, isTablet } = useBreakpoint()

  const handleCardTap = (i) => {
    setActiveCard(prev => prev === i ? null : i)
  }

  return (
    <div style={{ color:'var(--text-primary)', overflowX:'hidden' }}>
      <style>{`
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bob       { from{transform:rotate(45deg) translateY(-3px)} to{transform:rotate(45deg) translateY(3px)} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.6)} }
        .a1{animation:fadeUp .65s ease .05s both}
        .a2{animation:fadeUp .65s ease .15s both}
        .a3{animation:fadeUp .65s ease .25s both}
        .a4{animation:fadeUp .65s ease .35s both}
        .a5{animation:fadeUp .65s ease .45s both}
        .a6{animation:fadeUp .65s ease .55s both}
        .a7{animation:fadeUp .65s ease .65s both}
        .pipe-step:hover .pipe-num-box { background:rgba(245,166,35,.18)!important; border-color:rgba(245,166,35,.55)!important; }
        .feat-card:hover { border-color:var(--border-light)!important; background:var(--bg-elevated)!important; }
        .btn-primary:hover  { background:var(--amber-dim)!important; }
        .btn-secondary:hover { border-color:var(--amber)!important; color:var(--amber)!important; }
        .gh-badge:hover { background:rgba(245,166,35,.14)!important; border-color:rgba(245,166,35,.44)!important; }

        /* ── Responsive overrides ── */

        /* Hero: use dvh on mobile to avoid address-bar clip */
        @media (max-width: 639px) {
          .hero-section {
            min-height: calc(100dvh - 56px) !important;
            padding: 60px 16px 80px !important;
          }
          .hero-overline { font-size: 9px !important; }
          .hero-sub { font-size: 14px !important; max-width: 100% !important; }
          .hero-btns { flex-direction: column !important; align-items: center !important; }
          .hero-btns a { width: 100% !important; max-width: 280px !important; text-align: center !important; }
        }

        /* Segment cards: wrap on mobile */
        @media (max-width: 639px) {
          .seg-cards-wrap {
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          .seg-card {
            flex: 1 1 calc(50% - 8px) !important;
            min-width: 0 !important;
          }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .seg-cards-wrap {
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          .seg-card {
            flex: 1 1 calc(50% - 8px) !important;
            min-width: 0 !important;
          }
        }

        /* Features grid */
        @media (max-width: 639px) {
          .features-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .features-grid { grid-template-columns: repeat(2,1fr) !important; }
        }

        /* Model indicators: wrap on small screens */
        @media (max-width: 639px) {
          .model-indicators {
            flex-wrap: wrap !important;
            justify-content: flex-start !important;
            gap: 0 !important;
          }
          .model-indicator-item {
            flex: 0 0 50% !important;
            border-right: none !important;
            padding: 0 16px 16px !important;
          }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .model-indicators { flex-wrap: wrap !important; }
          .model-indicator-item { flex: 0 0 50% !important; border-right: none !important; padding: 0 20px 16px !important; }
        }

        /* CTA section */
        @media (max-width: 639px) {
          .cta-section { min-height: 80vh !important; padding: 60px 0 !important; }
          .cta-btn { padding: 14px 32px !important; font-size: 14px !important; }
        }
      `}</style>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        className="hero-section"
        style={{
          minHeight: 'calc(100vh - 56px)',
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          padding:'80px 24px 60px',
          position:'relative', overflow:'hidden',
        }}
      >
        <AnimatedChart />
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:.022, backgroundImage:'linear-gradient(var(--amber) 1px,transparent 1px),linear-gradient(90deg,var(--amber) 1px,transparent 1px)', backgroundSize:'52px 52px' }} />
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse 80% 70% at 50% 44%, rgba(0,0,0,.58) 0%, transparent 80%)' }} />

        <div style={{ position:'relative', zIndex:5, textAlign:'center', maxWidth:720, width:'100%' }}>
          <div className="a1 hero-overline" style={{ fontSize:10, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--amber)', fontFamily:'var(--font-display)', fontWeight:700, marginBottom:22, display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
            <span style={{ width:40, height:1, background:'var(--amber)', opacity:.35, flexShrink:0 }} />
            Adaptive Demand Forecasting
            <span style={{ width:40, height:1, background:'var(--amber)', opacity:.35, flexShrink:0 }} />
          </div>
          <h1 className="a2" style={{ fontSize:'clamp(32px,5.5vw,62px)', fontFamily:'var(--font-heading)', fontWeight:700, lineHeight:1.08, letterSpacing:'-.02em', color:'var(--text-primary)', marginBottom:12 }}>
            Predict demand.<br /><TypewriterText />
          </h1>
          <p className="a3 hero-sub" style={{ fontSize:16, color:'var(--text-secondary)', lineHeight:1.78, maxWidth:480, margin:'18px auto 36px' }}>
            Upload retail sales history. The system classifies demand patterns, trains three ML models, blends them via NNLS, and delivers confidence-bounded forecasts.
          </p>
          <div className="a4 hero-btns" style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:18 }}>
            <Link to="/upload" className="btn-primary" style={{ padding:'13px 30px', background:'var(--amber)', color:'var(--bg-base)', borderRadius:'var(--radius-md)', fontSize:14, fontWeight:600, letterSpacing:'.03em', textDecoration:'none', display:'inline-block', transition:'var(--transition)' }}>Upload dataset</Link>
            <Link to="/models" className="btn-secondary" style={{ padding:'13px 30px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border-light)', borderRadius:'var(--radius-md)', fontSize:14, fontWeight:500, textDecoration:'none', display:'inline-block', transition:'var(--transition)' }}>View models</Link>
          </div>
          <div className="a5" style={{ marginBottom:52 }}><GitHubBadge /></div>
          <p className="a6" style={{ fontSize:10, color:'var(--text-tertiary)', fontFamily:'var(--font-display)', letterSpacing:'.12em', textTransform:'uppercase', fontWeight:600, marginBottom:14 }}>Demand segments detected automatically</p>

          {/* Segment cards — className enables responsive CSS */}
          <div className="a7 seg-cards-wrap" style={{ display:'flex', gap:10, flexWrap:'nowrap', justifyContent:'center', width:'100%', maxWidth:900, margin:'0 auto' }}>
            {SEGS.map((seg,i) => (
              <SegmentCard
                key={seg.label} seg={seg}
                isActive={activeCard===i}
                onEnter={() => setActiveCard(i)}
                onLeave={() => setActiveCard(null)}
                onTap={() => handleCardTap(i)}
                delay={i*80}
              />
            ))}
          </div>
        </div>

        <div style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:6, zIndex:5 }}>
          <span style={{ fontSize:10, color:'var(--text-tertiary)', fontFamily:'var(--font-display)', letterSpacing:'.12em', textTransform:'uppercase' }}>scroll</span>
          <div style={{ width:18, height:18, borderRight:'1px solid var(--text-tertiary)', borderBottom:'1px solid var(--text-tertiary)', transform:'rotate(45deg)', animation:'bob .9s ease-in-out infinite alternate' }} />
        </div>
      </section>

      {/* ── 3D Pipeline ───────────────────────────────────────────────── */}
      <Pipeline3D />

      {/* ── Reactive vs predictive ────────────────────────────────────── */}
      <ComparisonSection />

      {/* ── Platform features ─────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? '56px 16px' : '88px 24px', borderTop:'1px solid var(--border)', background:'var(--bg-surface)' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <FadeSection>
            <p style={{ fontSize:10, color:'var(--text-tertiary)', fontFamily:'var(--font-display)', letterSpacing:'.14em', textTransform:'uppercase', textAlign:'center', marginBottom:12 }}>Platform features</p>
            <h2 style={{ fontSize: isMobile ? 22 : 28, fontFamily:'var(--font-heading)', fontWeight:700, textAlign:'center', color:'var(--text-primary)', marginBottom:36, letterSpacing:'-.01em' }}>Everything for production forecasting</h2>
          </FadeSection>

          {/* Model indicators */}
          <FadeSection delay={60}>
            <div className="model-indicators" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0, marginBottom:52, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
              {MODELS.map((m, i) => (
                <div key={m.label} className="model-indicator-item" style={{ display:'flex', alignItems:'center', gap:10, padding:'0 28px 18px', borderRight: i < MODELS.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width:2, height:18, background:m.color, borderRadius:2, opacity:.8, flexShrink:0 }} />
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:9, color:'var(--text-tertiary)', fontFamily:'var(--font-display)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:2 }}>{m.short}</p>
                    <p style={{ fontSize:12, color:m.color, fontFamily:'var(--font-display)', fontWeight:700, letterSpacing:'.02em', whiteSpace:'nowrap' }}>{m.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeSection>

          <FadeSection delay={120}>
            <div className="features-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
              {FEATURES.map(f => (
                <div key={f.title} className="feat-card" style={{ padding:24, background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', transition:'var(--transition)' }}>
                  <span style={{ fontSize:22, color:'var(--amber)', marginBottom:14, display:'block' }}>{f.icon}</span>
                  <p style={{ fontSize:13, fontFamily:'var(--font-display)', fontWeight:700, color:'var(--text-primary)', marginBottom:8, letterSpacing:'.02em' }}>{f.title}</p>
                  <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.65 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Cinematic CTA ─────────────────────────────────────────────── */}
      <section className="cta-section" style={{ minHeight:'70vh', display:'flex', alignItems:'center', justifyContent:'center', borderTop:'1px solid var(--border)', position:'relative', overflow:'hidden', background:'var(--bg-base)' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 80% 65% at 50% 55%, rgba(245,166,35,.11) 0%, rgba(245,166,35,.04) 40%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', inset:0, opacity:.018, backgroundImage:'linear-gradient(var(--amber) 1px,transparent 1px),linear-gradient(90deg,var(--amber) 1px,transparent 1px)', backgroundSize:'44px 44px', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'38%', left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(245,166,35,.12) 30%,rgba(245,166,35,.12) 70%,transparent)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'62%', left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(245,166,35,.07) 30%,rgba(245,166,35,.07) 70%,transparent)', pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:5, textAlign:'center', maxWidth:600, padding:'0 24px' }}>
          <FadeSection>
            <p style={{ fontSize:10, color:'rgba(245,166,35,.6)', fontFamily:'var(--font-display)', letterSpacing:'.18em', textTransform:'uppercase', marginBottom:20 }}>Get started</p>
            <h2 style={{ fontSize:'clamp(32px,6vw,68px)', fontFamily:'var(--font-heading)', fontWeight:700, color:'var(--text-primary)', marginBottom:18, letterSpacing:'-.025em', lineHeight:1.05 }}>
              Ready to see<br />what comes next?
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 16, color:'var(--text-secondary)', lineHeight:1.75, maxWidth:400, margin:'0 auto 40px' }}>
              Upload your CSV. Get forecasts with confidence intervals in under a minute.
            </p>
            <Link to="/upload" className="btn-primary cta-btn" style={{ padding:'16px 52px', background:'var(--amber)', color:'var(--bg-base)', borderRadius:'var(--radius-md)', fontSize:15, fontWeight:700, letterSpacing:'.04em', textDecoration:'none', display:'inline-block', transition:'var(--transition)', boxShadow:'0 0 40px rgba(245,166,35,.25)' }}>
              Upload dataset
            </Link>
          </FadeSection>
        </div>
      </section>
    </div>
  )
}
