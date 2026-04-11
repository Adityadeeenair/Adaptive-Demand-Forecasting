import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { fmtShortDate, fmtNum } from '../utils/format'
import { MODELS } from './ModelToggle'

const MODEL_COLORS = Object.fromEntries(MODELS.map(m => [m.key, m.color]))

const CustomTooltip = ({ active, payload, label, showAll, activeModel }) => {
  if (!active || !payload?.length) return null
  const actual = payload.find(p => p.dataKey === 'actual')
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      boxShadow: 'var(--shadow-md)',
      minWidth: 170,
    }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', marginBottom: 8 }}>{label}</p>
      {actual?.value != null && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Actual <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmtNum(actual.value)}</span>
        </p>
      )}
      {showAll
        ? MODELS.map(({ key, label: mLabel, color }) => {
            const entry = payload.find(p => p.dataKey === key)
            if (!entry?.value) return null
            return (
              <p key={key} style={{ fontSize: 12, color }}>
                {mLabel} <span style={{ fontWeight: 600 }}>{fmtNum(entry.value)}</span>
              </p>
            )
          })
        : payload.filter(p => p.dataKey === 'forecast').map(p => (
            <p key="f" style={{ fontSize: 12, color: MODEL_COLORS[activeModel] || 'var(--amber)' }}>
              Forecast <span style={{ fontWeight: 600 }}>{fmtNum(p.value)}</span>
            </p>
          ))
      }
      {(() => {
        const lo = payload.find(p => p.dataKey === 'lower')
        const hi = payload.find(p => p.dataKey === 'upper')
        if (lo?.value && hi?.value) return (
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            80% band {fmtNum(lo.value)} – {fmtNum(hi.value)}
          </p>
        )
      })()}
    </div>
  )
}

export default function ForecastChart({ forecast, activeModel = 'ensemble', showAll = false }) {
  if (!forecast) return (
    <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.06em' }}>
      NO FORECAST YET — RUN A PREDICTION ABOVE
    </div>
  )

  const mp = forecast.model_predictions || {}
  const activePreds = mp[activeModel] || forecast.point_forecast

  const historyData = forecast.history_dates.map((d, i) => ({
    date: fmtShortDate(d), actual: forecast.history_sales[i],
  }))

  const forecastData = forecast.forecast_dates.map((d, i) => {
    const row = {
      date:     fmtShortDate(d),
      forecast: activePreds[i],
      lower:    forecast.lower_bound[i],
      upper:    forecast.upper_bound[i],
    }
    if (showAll) {
      MODELS.forEach(({ key }) => { if (mp[key]) row[key] = mp[key][i] })
    }
    return row
  })

  const splitDate = fmtShortDate(forecast.history_dates.at(-1))
  const data = [...historyData, { date: splitDate, isDivider: true }, ...forecastData]
  const activeColor = MODEL_COLORS[activeModel] || 'var(--amber)'

  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={activeColor} stopOpacity={0.15} />
              <stop offset="95%" stopColor={activeColor} stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4a9eff" stopOpacity={0.14} />
              <stop offset="95%" stopColor="#4a9eff" stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={42} />

          <Tooltip content={<CustomTooltip showAll={showAll} activeModel={activeModel} />} />

          <ReferenceLine x={splitDate} stroke="var(--border-light)" strokeDasharray="4 4"
            label={{ value: 'TODAY', position: 'top', fontSize: 9, fill: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }} />

          <Area dataKey="actual" fill="url(#histGrad)" stroke="#4a9eff" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#4a9eff' }} />
          <Area dataKey="band" fill="url(#bandGrad)" stroke="none" activeDot={false} />
          <Line dataKey="upper" stroke={activeColor} strokeWidth={0.8} strokeDasharray="3 4" dot={false} activeDot={false} opacity={0.45} />
          <Line dataKey="lower" stroke={activeColor} strokeWidth={0.8} strokeDasharray="3 4" dot={false} activeDot={false} opacity={0.45} />

          {showAll
            ? MODELS.map(({ key, color }) => mp[key] ? (
                <Line key={key} dataKey={key} stroke={color}
                  strokeWidth={key === 'ensemble' ? 2.5 : 1.5}
                  strokeDasharray={key === 'ensemble' ? undefined : '4 3'}
                  dot={false} activeDot={{ r: 3, fill: color }}
                  opacity={key === 'ensemble' ? 1 : 0.75}
                />
              ) : null)
            : <Line dataKey="forecast" stroke={activeColor} strokeWidth={2} dot={false}
                activeDot={{ r: 4, fill: activeColor, stroke: 'var(--bg-base)', strokeWidth: 2 }} />
          }
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
