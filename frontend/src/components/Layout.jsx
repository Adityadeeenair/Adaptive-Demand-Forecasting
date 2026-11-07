import { Link, useLocation } from 'react-router-dom'

const NAV = [
  { path: '/',          label: 'Home' },
  { path: '/upload',    label: 'Upload' },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/models',    label: 'Models' },
  { path: '/insights',  label: 'Insights' },
]

export default function Layout({ children, apiStatus }) {
  const { pathname } = useLocation()
  const isActive = (p) => p === '/' ? pathname === '/' : pathname.startsWith(p)

  const isLive = apiStatus === true || apiStatus === 'online'
  const isWakingUp = apiStatus === 'waking_up'

  const statusColor = isLive
    ? 'var(--green)'
    : isWakingUp
    ? 'var(--amber)'
    : 'var(--red)'

  const statusText = isLive
    ? 'LIVE'
    : isWakingUp
    ? 'WAKING UP'
    : 'OFFLINE'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {isWakingUp && (
        <div style={{
          background: 'rgba(245, 166, 35, 0.12)',
          borderBottom: '1px solid rgba(245, 166, 35, 0.3)',
          color: 'var(--amber)',
          fontSize: 12,
          padding: '8px 24px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', animation: 'pulse 1.2s infinite' }} />
          <span>Backend container is spinning up on Render free-tier (~30-40s on first visit). Automatically reconnecting...</span>
        </div>
      )}

      <nav style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        height: 56,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: 32,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--amber)' }}>ADF</span>
          <span style={{ width: 1, height: 16, background: 'var(--border-light)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Adaptive Demand Forecasting</span>
        </Link>

        <div style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}>
          {NAV.map(({ path, label }) => {
            const active = isActive(path)
            return (
              <Link key={path} to={path} style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 500,
                color: active ? 'var(--amber)' : 'var(--text-secondary)',
                background: active ? 'var(--amber-glow)' : 'transparent',
                transition: 'var(--transition)',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </Link>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} title={isWakingUp ? 'Render free tier container waking up' : ''}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 8px ${statusColor}`,
          }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: isWakingUp ? 'var(--amber)' : 'var(--text-tertiary)' }}>
            {statusText}
          </span>
        </div>
      </nav>

      <main style={{ flex: 1 }}>{children}</main>
    </div>
  )
}
