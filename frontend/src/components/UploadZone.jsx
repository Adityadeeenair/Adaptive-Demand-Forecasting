import { useState, useRef } from 'react'

export default function UploadZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState(false)
  const inputRef = useRef()

  const handle = (file) => {
    if (!file || !file.name.endsWith('.csv')) return
    onFile(file)
  }

  const active = (dragging || hover) && !disabled

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1.5px dashed ${active ? 'var(--amber)' : 'rgba(255, 255, 255, 0.12)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '52px 36px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragging
          ? 'rgba(245, 166, 35, 0.08)'
          : active
          ? 'rgba(245, 166, 35, 0.03)'
          : 'var(--bg-surface)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: disabled ? 0.5 : 1,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: active
          ? '0 0 0 1px rgba(245, 166, 35, 0.2), 0 12px 48px rgba(0, 0, 0, 0.6), inset 0 0 40px rgba(245, 166, 35, 0.05)'
          : '0 4px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Corner HUD accent brackets */}
      <div style={{ position: 'absolute', top: 12, left: 12, width: 8, height: 8, borderTop: `2px solid ${active ? 'var(--amber)' : 'var(--border)'}`, borderLeft: `2px solid ${active ? 'var(--amber)' : 'var(--border)'}`, transition: 'border-color 0.2s' }} />
      <div style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderTop: `2px solid ${active ? 'var(--amber)' : 'var(--border)'}`, borderRight: `2px solid ${active ? 'var(--amber)' : 'var(--border)'}`, transition: 'border-color 0.2s' }} />
      <div style={{ position: 'absolute', bottom: 12, left: 12, width: 8, height: 8, borderBottom: `2px solid ${active ? 'var(--amber)' : 'var(--border)'}`, borderLeft: `2px solid ${active ? 'var(--amber)' : 'var(--border)'}`, transition: 'border-color 0.2s' }} />
      <div style={{ position: 'absolute', bottom: 12, right: 12, width: 8, height: 8, borderBottom: `2px solid ${active ? 'var(--amber)' : 'var(--border)'}`, borderRight: `2px solid ${active ? 'var(--amber)' : 'var(--border)'}`, transition: 'border-color 0.2s' }} />

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files[0])}
      />

      {/* Modern SVG Upload Icon */}
      <div style={{
        width: 56,
        height: 56,
        margin: '0 auto 20px',
        borderRadius: 14,
        background: active ? 'rgba(245, 166, 35, 0.12)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'rgba(245, 166, 35, 0.5)' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.25s ease',
        transform: active ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: active ? '0 0 20px rgba(245, 166, 35, 0.25)' : 'none',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--amber)' : 'var(--text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.2s' }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>

      <p style={{
        fontSize: 18,
        fontWeight: 600,
        fontFamily: 'var(--font-display)',
        color: 'var(--text-primary)',
        margin: '0 0 8px',
        letterSpacing: '-0.01em',
      }}>
        Drop your retail CSV file here
      </p>

      <p style={{
        fontSize: 13,
        color: 'var(--text-tertiary)',
        margin: '0 0 24px',
      }}>
        Drag and drop from your file manager, or{' '}
        <span style={{ color: 'var(--amber)', textDecoration: 'underline', fontWeight: 500 }}>
          browse local files
        </span>
      </p>

      {/* Pill: Accepted schemas */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
      }}>
        <span style={{ color: 'var(--text-tertiary)' }}>Expected fields:</span>
        <span style={{ color: 'var(--amber)' }}>date</span>
        <span style={{ color: 'var(--text-tertiary)' }}>·</span>
        <span style={{ color: 'var(--amber)' }}>sales</span>
        <span style={{ color: 'var(--text-tertiary)' }}>·</span>
        <span style={{ color: 'var(--text-secondary)' }}>store</span>
        <span style={{ color: 'var(--text-tertiary)' }}>·</span>
        <span style={{ color: 'var(--text-secondary)' }}>item</span>
      </div>
    </div>
  )
}
