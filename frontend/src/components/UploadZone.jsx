import { useState, useRef } from 'react'

export default function UploadZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handle = (file) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) return
    onFile(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handle(e.dataTransfer.files[0])
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragging ? 'var(--amber)' : 'var(--border-light)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '52px 40px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragging ? 'var(--amber-glow)' : 'var(--bg-surface)',
        transition: 'var(--transition)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files[0])}
      />

      <div style={{
        width: 48, height: 48,
        margin: '0 auto 20px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>
        📂
      </div>

      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        Drop your CSV file here
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        or click to browse
      </p>

      <div style={{
        display: 'inline-flex',
        gap: 12,
        padding: '8px 16px',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
      }}>
        {['date', 'store', 'item', 'sales'].map((col) => (
          <code key={col} style={{
            fontSize: 11,
            fontFamily: 'var(--font-display)',
            color: 'var(--amber)',
          }}>
            {col}
          </code>
        ))}
      </div>
    </div>
  )
}
