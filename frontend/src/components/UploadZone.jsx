import { useState, useRef } from 'react'

export default function UploadZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false)
  const [hover, setHover]       = useState(false)
  const inputRef = useRef()

  const handle = (file) => {
    if (!file || !file.name.endsWith('.csv')) return
    onFile(file)
  }

  const active = dragging || hover

  return (
    <div
      onClick={() => !disabled && inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `2px dashed ${active ? 'var(--amber)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 16,
        padding: '180px 240px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragging
          ? 'rgba(245,166,35,0.06)'
          : active
            ? 'rgba(245,166,35,0.03)'
            : 'var(--bg-surface)',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        transform: active && !disabled ? 'scale(1.015)' : 'scale(1)',
        boxShadow: active && !disabled
          ? '0 0 0 1px rgba(245,166,35,0.2), 0 8px 40px rgba(245,166,35,0.1), inset 0 0 32px rgba(245,166,35,0.06)'
          : '0 4px 20px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,165,0,0.03)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle inner glow when active */}
      {active && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(245,166,35,0.08) 0%, transparent 70%)',
          borderRadius: 16,
        }} />
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files[0])}
      />

      {/* Icon */}
      <div style={{
        width: 64, height: 64,
        margin: '0 auto 24px',
        borderRadius: 14,
        background: active ? 'rgba(245,166,35,0.12)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'rgba(245,166,35,0.4)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28,
        transition: 'all 0.2s ease',
      }}>
        📂
      </div>

      <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.01em' }}>
        Drop your CSV file here
      </p>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 28 }}>
        or click to browse
      </p>

      <div style={{
        display: 'inline-flex', gap: 14,
        padding: '10px 20px',
        background: 'var(--bg-elevated)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        {['date', 'store', 'item', 'sales'].map((col) => (
          <code key={col} style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--amber)',
            letterSpacing: '0.04em',
          }}>
            {col}
          </code>
        ))}
      </div>
    </div>
  )
}
