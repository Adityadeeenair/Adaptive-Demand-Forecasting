export const fmtDate = (str) =>
  new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export const fmtShortDate = (str) =>
  new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

export const fmtNum = (n, decimals = 1) =>
  n == null ? '—' : Number(n).toFixed(decimals)

export const fmtPct = (n) =>
  n == null ? '—' : `${(n * 100).toFixed(1)}%`

export const segmentLabel = (s) => ({
  stable:            'Stable',
  seasonal_stable:   'Seasonal',
  seasonal_volatile: 'Seasonal+',
  trending:          'Trending',
  volatile:          'Volatile',
  intermittent:      'Sparse',
  unknown:           'Unknown',
}[s] ?? s)

export const segmentColor = (s) => ({
  stable:            '#2ecc71',
  seasonal_stable:   '#4a9eff',
  seasonal_volatile: '#9b59b6',
  trending:          '#f5a623',
  volatile:          '#e74c3c',
  intermittent:      '#95a5a6',
  unknown:           '#555',
}[s] ?? '#888')
