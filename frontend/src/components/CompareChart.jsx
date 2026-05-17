/**
 * frontend/src/components/CompareChart.jsx
 *
 * Plots two product forecasts on the same chart.
 * Uses the same idx-based XAxis pattern as ForecastChart to prevent
 * date ordering bugs. Merges both products onto a shared date axis.
 */
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { fmtShortDate, fmtNum } from '../utils/format'

const COLOR_A = '#4a9eff'   // product 1 — blue
const COLOR_B = '#f5a623'   // product 2 — amber

// Build a merged date → row lookup from both forecasts
function buildMergedData(fcA, fcB) {
  // Map each date → { actual_a, actual_b, forecast_a, forecast_b, lower_a, upper_a, lower_b, upper_b }
  const map = {}

  const upsert = (date) => { if (!map[date]) map[date] = { rawDate: date } }

  fcA.history_dates.forEach((d, i) => { upsert(d); map[d].actual_a = fcA.history_sales[i] })
  fcB.history_dates.forEach((d, i) => { upsert(d); map[d].actual_b = fcB.history_sales[i] })

  fcA.forecast_dates.forEach((d, i) => {
    upsert(d)
    map[d].forecast_a = fcA.point_forecast[i]
    map[d].lower_a    = fcA.lower_bound[i]
    map[d].upper_a    = fcA.upper_bound[i]
  })
  fcB.forecast_dates.forEach((d, i) => {
    upsert(d)
    map[d].forecast_b = fcB.point_forecast[i]
    map[d].lower_b    = fcB.lower_bound[i]
    map[d].upper_b    = fcB.upper_bound[i]
  })

  // Sort chronologically and assign sequential idx
  const sorted = Object.keys(map).sort()
  return sorted.map((d, i) => ({ idx: i, ...map[d] }))
}

// Custom tooltip
function CompareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  const get = (key) => payload.find(p => p.dataKey === key)?.value

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)', padding: '10px 14px',
      boxShadow: 'var(--shadow-md)', minWidth: 180,
    }}>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', marginBottom: 8 }}>
        {row.rawDate ? fmtShortDate(row.rawDate) : ''}
      </p>
      {get('actual_a')   != null && <p style={{ fontSize: 12, color: COLOR_A, marginBottom: 2 }}>History A  <span style={{ fontWeight: 600 }}>{fmtNum(get('actual_a'))}</span></p>}
      {get('forecast_a') != null && <p style={{ fontSize: 12, color: COLOR_A, marginBottom: 2 }}>Forecast A <span style={{ fontWeight: 600 }}>{fmtNum(get('forecast_a'))}</span></p>}
      {get('actual_b')   != null && <p style={{ fontSize: 12, color: COLOR_B, marginBottom: 2 }}>History B  <span style={{ fontWeight: 600 }}>{fmtNum(get('actual_b'))}</span></p>}
      {get('forecast_b') != null && <p style={{ fontSize: 12, color: COLOR_B, marginBottom: 2 }}>Forecast B <span style={{ fontWeight: 600 }}>{fmtNum(get('forecast_b'))}</span></p>}
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 22, height: 2, background: color, borderRadius: 1 }} />
      <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  )
}

export default function CompareChart({ forecastA, forecastB }) {
  if (!forecastA || !forecastB) return null

  const data       = buildMergedData(forecastA, forecastB)
  const n          = data.length
  const splitDate  = forecastA.history_dates.at(-1)
  const splitIdx   = data.findIndex(r => r.rawDate === splitDate)

  // Evenly-spaced ticks
  const tickStep = Math.max(1, Math.floor(n / 10))
  const ticks    = [...new Set([0, ...Array.from({ length: 10 }, (_, i) => Math.min(i * tickStep, n - 1)), n - 1])].sort((a, b) => a - b)

  return (
    <div>
      {/* Product labels */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 14, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 6, background: `${COLOR_A}15`, border: `1px solid ${COLOR_A}44` }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR_A }} />
          <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: COLOR_A, fontWeight: 600 }}>{forecastA.product_id}</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({forecastA.segment})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 6, background: `${COLOR_B}15`, border: `1px solid ${COLOR_B}44` }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR_B }} />
          <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: COLOR_B, fontWeight: 600 }}>{forecastB.product_id}</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({forecastB.segment})</span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 6, right: 20, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cmpHistA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={COLOR_A} stopOpacity={0.14} />
                <stop offset="100%" stopColor={COLOR_A} stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="cmpHistB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={COLOR_B} stopOpacity={0.14} />
                <stop offset="100%" stopColor={COLOR_B} stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="cmpBandA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={COLOR_A} stopOpacity={0.18} />
                <stop offset="100%" stopColor={COLOR_A} stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="cmpBandB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={COLOR_B} stopOpacity={0.18} />
                <stop offset="100%" stopColor={COLOR_B} stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />

            <XAxis
              dataKey="idx" type="number"
              domain={[0, n - 1]} ticks={ticks}
              tickFormatter={(idx) => { const r = data[idx]; return r ? fmtShortDate(r.rawDate) : '' }}
              tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: 'var(--font-display)', fill: 'var(--text-tertiary)' }}
              axisLine={false} tickLine={false} width={46}
              tickFormatter={(v) => fmtNum(v, 0)}
            />

            <Tooltip content={<CompareTooltip />} />

            {splitIdx >= 0 && (
              <ReferenceLine x={splitIdx} stroke="var(--border-light)" strokeWidth={1.5} strokeDasharray="4 4"
                label={{ value: 'TODAY', position: 'insideTopRight', fontSize: 9, fill: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', dy: -4 }}
              />
            )}

            {/* Product A: history area + forecast line + band */}
            <Area dataKey="actual_a" fill="url(#cmpHistA)" stroke={COLOR_A} strokeWidth={1.8}
              dot={false} activeDot={{ r: 3, fill: COLOR_A, stroke: 'var(--bg-base)', strokeWidth: 2 }} connectNulls />

            <Area dataKey="upper_a" stroke={`${COLOR_A}44`} strokeWidth={0.6} fill="url(#cmpBandA)"
              dot={false} activeDot={false} connectNulls />
            <Area dataKey="lower_a" stroke={`${COLOR_A}44`} strokeWidth={0.6} fill="var(--bg-base)"
              dot={false} activeDot={false} connectNulls />

            <Line dataKey="forecast_a" stroke={COLOR_A} strokeWidth={2.2}
              dot={false} activeDot={{ r: 4, fill: COLOR_A, stroke: 'var(--bg-base)', strokeWidth: 2 }}
              connectNulls strokeDasharray="none" />

            {/* Product B: history area + forecast line + band */}
            <Area dataKey="actual_b" fill="url(#cmpHistB)" stroke={COLOR_B} strokeWidth={1.8}
              dot={false} activeDot={{ r: 3, fill: COLOR_B, stroke: 'var(--bg-base)', strokeWidth: 2 }} connectNulls />

            <Area dataKey="upper_b" stroke={`${COLOR_B}44`} strokeWidth={0.6} fill="url(#cmpBandB)"
              dot={false} activeDot={false} connectNulls />
            <Area dataKey="lower_b" stroke={`${COLOR_B}44`} strokeWidth={0.6} fill="var(--bg-base)"
              dot={false} activeDot={false} connectNulls />

            <Line dataKey="forecast_b" stroke={COLOR_B} strokeWidth={2.2}
              dot={false} activeDot={{ r: 4, fill: COLOR_B, stroke: 'var(--bg-base)', strokeWidth: 2 }}
              connectNulls strokeDasharray="6 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, padding: '10px 6px 0', flexWrap: 'wrap', borderTop: '1px solid var(--border)', marginTop: 10 }}>
        <LegendDot color={COLOR_A} label={`${forecastA.product_id} — History`} />
        <LegendDot color={COLOR_A} label={`${forecastA.product_id} — Forecast`} />
        <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
        <LegendDot color={COLOR_B} label={`${forecastB.product_id} — History`} />
        <LegendDot color={COLOR_B} label={`${forecastB.product_id} — Forecast (dashed)`} />
      </div>
    </div>
  )
}
