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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: apiStatus === false ? 'var(--red)' : 'var(--green)',
            boxShadow: `0 0 8px ${apiStatus === false ? 'var(--red)' : 'var(--green)'}`,
          }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>
            {apiStatus === false ? 'OFFLINE' : 'LIVE'}
          </span>
        </div>
      </nav>

      <main style={{ flex: 1 }}>{children}</main>

      <footer style={{
        padding: '20px 32px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
          ADF · Adaptive Demand Forecasting System
        </span>
        <div style={{ display: 'flex', gap: 16 }}>
          {['RF', 'XGB', 'LGB', 'NNLS Ensemble', 'Quantile Intervals'].map(t => (
            <span key={t} style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>{t}</span>
          ))}
        </div>
      </footer>
    </div>
  )
}
