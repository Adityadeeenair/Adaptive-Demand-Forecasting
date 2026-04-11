import { segmentLabel, segmentColor } from '../utils/format'

export default function StatusBadge({ segment, size = 'md' }) {
  const color = segmentColor(segment)
  const label = segmentLabel(segment)
  const px = size === 'sm' ? '6px 10px' : '5px 12px'
  const fs = size === 'sm' ? '10px' : '11px'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: px,
      fontSize: fs,
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      borderRadius: 'var(--radius-sm)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  )
}
