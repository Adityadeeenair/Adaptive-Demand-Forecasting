import { useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { fmtShortDate, fmtNum } from '../utils/format'

// ── Constants ─────────────────────────────────────────────────────────────────
const BLUE    = '#4a9eff'
const AMBER   = '#f5a623'
const GREEN   = '#2ecc71'
const C_BAND  = 'rgba(245,166,35,0.12)'
const C_BAND_STROKE = 'rgba(245,166,35,0.35)'

// ── Model toggle button ───────────────────────────────────────────────────────
const MODEL_OPTIONS = [
  { key: 'ensemble',      label: 'Ensemble',      color: AMBER },
  { key: 'random_forest', label: 'Random Forest', color: BLUE },
  { key: 'xgboost',       label: 'XGBoost',       color: '#9b59b6' },
  { key: 'lightgbm',      label: 'LightGBM',      color: GREEN },
]

function ModelToggle({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {MODEL_OPTIONS.map(({ key, label, color }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            fontSize: 11,
            fontFamily: 'var(--font-display)',
            border: `1px solid ${active === key ? color : 'var(--border)'}`,
            background: active === key ? `${color}22` : 'var(--bg-elevated)',
            color: active === key ? color : 'var(--text-tertiary)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{
            display: 'inline-block',
            width: 7, height: 7,
            borderRadius: '50%',
            background: color,
            opacity: active === key ? 1 : 0.4,
          }} />
          {label}
        </button>
      ))}
      <button
        onClick={() => onChange('compare')}
        style={{
          padding: '5px 12px',
          borderRadius: 6,
          fontSize: 11,
          fontFamily: 'var(--font-display)',
          border: `1px solid ${active === 'compare' ? 'var(--text-secondary)' : 'var(--border)'}`,
          background: active === 'compare' ? 'var(--bg-elevated)' : 'transparent',
          color: active === 'compare' ? 'var(--text-secondary)' : 'var(--text-tertiary)',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        Compare All
      </button>
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, activeModel }) {
  if (!active || !payload?.length) return null

  const get = (key) => payload.find((p) => p.dataKey === key)?.value

  const actual   = get('actual')
  const lower    = get('lower')
  const upper    = get('upper')
  const trend    = get('trend')

  // collect all model forecasts visible in payload
  const modelKeys = ['ensemble','random_forest','xgboost','lightgbm']
  const forecasts = modelKeys
    .map((k) => ({ key: k, val: get(k), opt: MODEL_OPTIONS.find((o) => o.key === k) }))
    .filter((x) => x.val != null)

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      boxShadow: 'var(--shadow-md)',
      minWidth: 170,
    }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', marginBottom: 8 }}>
        {payload[0]?.payload?.rawDate ? fmtShortDate(payload[0].payload.rawDate) : ''}
      </p>
      {actual != null && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 3 }}>
          Actual <span style={{ color: BLUE, fontWeight: 600 }}>{fmtNum(actual)}</span>
        </p>
      )}
      {forecasts.map(({ key, val, opt }) => (
        <p key={key} style={{ fontSize: 13, color: opt?.color ?? AMBER, marginBottom: 2 }}>
          {opt?.label ?? key} <span style={{ fontWeight: 600 }}>{fmtNum(val)}</span>
        </p>
      ))}
      {trend != null && (
        <p style={{ fontSize: 11, color: GREEN, marginBottom: 2 }}>
          Trend <span style={{ fontWeight: 600 }}>{fmtNum(trend)}</span>
        </p>
      )}
      {lower != null && upper != null && (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          80% band: {fmtNum(lower)} – {fmtNum(upper)}
        </p>
      )}
    </div>
  )
}

// ── Rolling mean helper ───────────────────────────────────────────────────────
function computeRollingMean(values, window = 7) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v) => v != null)
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null
  })
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ForecastChart({ forecast }) {
  const [activeModel, setActiveModel]     = useState('ensemble')
  const [showTrend, setShowTrend]         = useState(false)
  const [showBand, setShowBand]           = useState(true)

  if (!forecast) return (
    <div style={{
      height: 400,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-tertiary)',
      fontFamily: 'var(--font-display)',
      fontSize: 12,
      letterSpacing: '0.06em',
    }}>
      NO FORECAST YET — RUN A PREDICTION ABOVE
    </div>
  )

  const mp = forecast.model_predictions || {}
  const hasModels = Object.keys(mp).length > 0

  // ── Build data array ───────────────────────────────────────────────────────
  // History rows
  const rollingMean = computeRollingMean(forecast.history_sales, 7)

  const historyRows = forecast.history_dates.map((d, i) => ({
    idx:    i,
    rawDate: d,
    actual: forecast.history_sales[i],
    trend:  showTrend ? rollingMean[i] : undefined,
    _zone: 'history',
  }))

  // Bridge point: last history value injected into the forecast zone
  // so the lines connect without a visual gap
  const lastHist = historyRows.at(-1)
  const splitIdx = lastHist.idx
  const bridgePoint = {
    idx:      splitIdx,
    rawDate:  lastHist.rawDate,
    actual:   lastHist.actual,
    // seed every model's forecast key with the last actual so lines start from same point
    ensemble:      lastHist.actual,
    random_forest: lastHist.actual,
    xgboost:       lastHist.actual,
    lightgbm:      lastHist.actual,
    lower: forecast.lower_bound[0],
    upper: forecast.upper_bound[0],
    _zone: 'bridge',
  }

  // Forecast rows — idx continues from after bridge point
  const forecastRows = forecast.forecast_dates.map((d, i) => {
    const row = {
      idx:     splitIdx + 1 + i,
      rawDate: d,
      lower:   forecast.lower_bound[i],
      upper:   forecast.upper_bound[i],
      _zone:   'forecast',
    }
    // Add all model predictions if available
    if (hasModels) {
      for (const [key, vals] of Object.entries(mp)) {
        if (vals?.[i] != null) row[key] = vals[i]
      }
    } else {
      row.ensemble = forecast.point_forecast[i]
    }
    return row
  })

  const data = [...historyRows, bridgePoint, ...forecastRows]
  const totalPoints = data.length

  // Compute ~10 evenly-spaced tick positions across the full range
  const tickCount = Math.min(10, totalPoints)
  const tickStep  = Math.floor(totalPoints / tickCount)
  const ticks = Array.from({ length: tickCount }, (_, i) => i * tickStep)
  if (!ticks.includes(totalPoints - 1)) ticks.push(totalPoints - 1)

  // Which forecast lines to render
  const isCompare = activeModel === 'compare'
  const modelsToShow = isCompare
    ? MODEL_OPTIONS.filter((m) => mp[m.key])
    : MODEL_OPTIONS.filter((m) => m.key === activeModel && (mp[m.key] || m.key === 'ensemble'))

  return (
    <div>
      {/* Controls row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 14,
        padding: '0 4px',
      }}>
        {hasModels && (
          <ModelToggle active={activeModel} onChange={setActiveModel} />
        )}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <ToggleChip label="80% Band"   active={showBand}  onClick={() => setShowBand((v) => !v)}  color={AMBER} />
          <ToggleChip label="Trend Line" active={showTrend} onClick={() => setShowTrend((v) => !v)} color={GREEN} />
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 6, right: 20, bottom: 0, left: 0 }}>

            <defs>
              {/* Confidence band gradient */}
              <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={AMBER} stopOpacity={0.22} />
                <stop offset="100%" stopColor={AMBER} stopOpacity={0.04} />
              </linearGradient>
              {/* History area gradient */}
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={BLUE} stopOpacity={0.16} />
                <stop offset="100%" stopColor={BLUE} stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="3 6"
              vertical={false}
            />

            <XAxis
              dataKey="idx"
              type="number"
              scale="linear"
              domain={[0, totalPoints - 1]}
              ticks={ticks}
              tickFormatter={(idx) => {
                const row = data[idx]
                return row ? fmtShortDate(row.rawDate) : ''
              }}
              tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
              width={46}
              tickFormatter={(v) => fmtNum(v, 0)}
            />

            <Tooltip content={<CustomTooltip activeModel={activeModel} />} />

            {/* TODAY reference line */}
            <ReferenceLine
              x={splitIdx}
              stroke="var(--border-light)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: 'TODAY',
                position: 'insideTopRight',
                fontSize: 9,
                fill: 'var(--text-tertiary)',
                fontFamily: 'var(--font-display)',
                dy: -4,
              }}
            />

            {/* Historical area + line */}
            <Area
              dataKey="actual"
              fill="url(#histGrad)"
              stroke={BLUE}
              strokeWidth={1.8}
              dot={false}
              activeDot={{ r: 3, fill: BLUE, stroke: 'var(--bg-base)', strokeWidth: 2 }}
              connectNulls
            />

            {/* Trend / rolling mean line (history only) */}
            {showTrend && (
              <Line
                dataKey="trend"
                stroke={GREEN}
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
                activeDot={false}
                connectNulls
                opacity={0.85}
              />
            )}

            {/* 80% confidence band (shaded area between lower/upper) */}
            {showBand && (
              <Area
                dataKey="upper"
                stroke={C_BAND_STROKE}
                strokeWidth={0.8}
                fill="url(#bandGrad)"
                dot={false}
                activeDot={false}
                connectNulls
              />
            )}
            {showBand && (
              <Area
                dataKey="lower"
                stroke={C_BAND_STROKE}
                strokeWidth={0.8}
                fill="var(--bg-base)"
                dot={false}
                activeDot={false}
                connectNulls
              />
            )}

            {/* Forecast model lines */}
            {modelsToShow.map(({ key, color }, idx) => (
              <Line
                key={key}
                dataKey={key}
                stroke={color}
                strokeWidth={isCompare ? 1.5 : 2.2}
                strokeDasharray={isCompare && idx > 0 ? `${6 + idx * 2} 3` : undefined}
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: 'var(--bg-base)', strokeWidth: 2 }}
                connectNulls
                opacity={isCompare ? 0.85 : 1}
              />
            ))}

          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend row */}
      <div style={{
        display: 'flex',
        gap: 18,
        padding: '10px 6px 0',
        flexWrap: 'wrap',
        borderTop: '1px solid var(--border)',
        marginTop: 10,
      }}>
        <LegendItem color={BLUE}  style="solid" label="Historical" />
        {modelsToShow.map(({ key, label, color }, idx) => (
          <LegendItem key={key} color={color}
            style={isCompare && idx > 0 ? 'dashed' : 'solid'}
            label={isCompare ? label : 'Forecast'} />
        ))}
        {showBand && <LegendItem color={AMBER} style="area" label="80% Band" />}
        {showTrend && <LegendItem color={GREEN} style="dashed" label="7d Trend" />}
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function ToggleChip({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 5,
        fontSize: 10,
        fontFamily: 'var(--font-display)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? `${color}18` : 'transparent',
        color: active ? color : 'var(--text-tertiary)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function LegendItem({ color, style, label }) {
  const lineStyle = {
    width: 22,
    height: 2,
    borderRadius: 1,
    background: style === 'area'
      ? `linear-gradient(${color}55, ${color}11)`
      : color,
    ...(style === 'dashed' ? {
      background: 'none',
      backgroundImage: `repeating-linear-gradient(90deg, ${color} 0, ${color} 5px, transparent 5px, transparent 9px)`,
    } : {}),
    ...(style === 'area' ? { height: 8, borderRadius: 2, opacity: 0.6 } : {}),
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={lineStyle} />
      <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>
        {label}
      </span>
    </div>
  )
}