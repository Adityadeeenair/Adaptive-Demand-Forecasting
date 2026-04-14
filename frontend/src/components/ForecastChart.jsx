import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { fmtShortDate, fmtNum } from '../utils/format'
import { MODELS } from './ModelToggle'

const MODEL_COLORS = Object.fromEntries(MODELS.map(m => [m.key, m.color]))


const buildChartData = (forecast, activeModel, showAll) => {
  const mp          = forecast.model_predictions || {}
  const activePreds = mp[activeModel] || forecast.point_forecast
  const rows        = []

  // History rows
  forecast.history_dates.forEach((isoDate, i) => {
    rows.push({
      idx:     i,
      isoDate,
      actual:  forecast.history_sales[i],
      segment: 'history',
    })
  })

  const splitIdx = rows.length - 1 // index of last history point

  // Forecast rows — start AFTER last history index, no duplicate date
  forecast.forecast_dates.forEach((isoDate, i) => {
    const row = {
      idx:      rows.length,
      isoDate,
      forecast: activePreds[i],
      lower:    forecast.lower_bound[i],
      upper:    forecast.upper_bound[i],
      segment:  'forecast',
    }
    if (showAll) {
      MODELS.forEach(({ key }) => { if (mp[key]) row[key] = mp[key][i] })
    }
    rows.push(row)
  })

  return { rows, splitIdx }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const row    = payload[0]?.payload
  const actual = payload.find(p => p.dataKey === 'actual')

  return (
    <div style={{
      background:   'var(--bg-elevated)',
      border:       '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      padding:      '10px 14px',
      boxShadow:    'var(--shadow-md)',
      minWidth:     170,
    }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', marginBottom: 8 }}>
        {row?.isoDate ? fmtShortDate(row.isoDate) : label}
      </p>

      {actual?.value != null && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Actual <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmtNum(actual.value)}</span>
        </p>
      )}

      {payload.filter(p => p.dataKey === 'forecast').map(p => (
        <p key="f" style={{ fontSize: 12, color: 'var(--amber)' }}>
          Forecast <span style={{ fontWeight: 600 }}>{fmtNum(p.value)}</span>
        </p>
      ))}

      {MODELS.filter(({ key }) => key !== 'actual').map(({ key, label: mLabel, color }) => {
        const entry = payload.find(p => p.dataKey === key)
        if (!entry?.value) return null
        return (
          <p key={key} style={{ fontSize: 12, color }}>
            {mLabel} <span style={{ fontWeight: 600 }}>{fmtNum(entry.value)}</span>
          </p>
        )
      })}

      {(() => {
        const lo = payload.find(p => p.dataKey === 'lower')
        const hi = payload.find(p => p.dataKey === 'upper')
        if (lo?.value != null && hi?.value != null) return (
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

  const { rows, splitIdx } = buildChartData(forecast, activeModel, showAll)
  const activeColor        = MODEL_COLORS[activeModel] || 'var(--amber)'

  // Determine how many ticks to show based on data length
  const tickCount  = Math.min(10, rows.length)
  const tickStep   = Math.floor(rows.length / tickCount)
  const tickIdxs   = new Set(
    Array.from({ length: tickCount }, (_, i) => Math.min(i * tickStep, rows.length - 1))
  )
  tickIdxs.add(0)
  tickIdxs.add(rows.length - 1)
  const ticks = [...tickIdxs].sort((a, b) => a - b)

  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
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

          {/* Integer index as dataKey — ordering is always array-position, never string */}
          <XAxis
            dataKey="idx"
            type="number"
            domain={[0, rows.length - 1]}
            ticks={ticks}
            tickFormatter={(idx) => {
              const row = rows[idx]
              return row ? fmtShortDate(row.isoDate) : ''
            }}
            tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }}
            axisLine={false}
            tickLine={false}
            width={42}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Divider at the last history point */}
          <ReferenceLine
            x={splitIdx}
            stroke="var(--border-light)"
            strokeDasharray="4 4"
            label={{ value: 'TODAY', position: 'top', fontSize: 9, fill: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}
          />

          <Area dataKey="actual" fill="url(#histGrad)" stroke="#4a9eff" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#4a9eff' }} />
          <Area dataKey="band"   fill="url(#bandGrad)" stroke="none"    activeDot={false} />
          <Line dataKey="upper"  stroke={activeColor} strokeWidth={0.8} strokeDasharray="3 4" dot={false} activeDot={false} opacity={0.45} />
          <Line dataKey="lower"  stroke={activeColor} strokeWidth={0.8} strokeDasharray="3 4" dot={false} activeDot={false} opacity={0.45} />

          {showAll
            ? MODELS.map(({ key, color }) => (forecast.model_predictions || {})[key] ? (
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
