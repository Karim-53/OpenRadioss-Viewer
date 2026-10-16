import React from 'react'
import { bumperImpulse, bumperForce } from '../data/numbers.js'

// Two small panels, same time axis: what the delivered /TH columns hold (a running total that only rises) and its
// time derivative (the force you actually want, with a peak). Bumper v0, the pole's normal + friction channels
// ("var 35" + "var 38"): their slope is the same force as on the next slide's crash curve (BumperCrush).
function Panel({ x0, w, h, data, max, ticks, title, ytitle, color, peak }) {
  const left = 48
  const top = 30
  const plotW = w - left - 8
  const plotH = h - top - 40
  const X = (i) => x0 + left + (i / (data.length - 1)) * plotW
  const Y = (v) => top + plotH - (v / max) * plotH
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  return (
    <g>
      <text x={x0} y={14} style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</text>
      {ticks.map((t) => (
        <g key={t}>
          <line className={t === 0 ? 'axis' : 'grid'} x1={x0 + left} x2={x0 + left + plotW} y1={Y(t)} y2={Y(t)} />
          <text className="lbl muted" x={x0 + left - 6} y={Y(t) + 5} textAnchor="end">{t.toLocaleString('en-US')}</text>
        </g>
      ))}
      <text className="lbl muted" transform={`translate(${x0 + 11}, ${top + plotH / 2}) rotate(-90)`} textAnchor="middle"
        style={{ fontSize: 12 }}>{ytitle}</text>
      {[0, 50, 100].map((t) => (
        <text key={t} className="lbl muted" x={X(t)} y={top + plotH + 16} textAnchor="middle">{t}</text>
      ))}
      <text className="lbl muted" x={x0 + left + plotW / 2} y={h - 3} textAnchor="middle" style={{ fontSize: 12 }}>time (ms)</text>
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {peak && (
        <g>
          <circle cx={X(peak.i)} cy={Y(data[peak.i])} r={4.5} fill={color} />
          <text className="val" x={X(peak.i) + 8} y={Y(data[peak.i]) + 4}>{peak.label}</text>
        </g>
      )}
    </g>
  )
}

export default function ImpulseForce({ width = 600, height = 216 }) {
  const gap = 22
  const w = (width - gap) / 2
  return (
    <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="Bumper v0, the pole's channels: as delivered they only rise, to 3.0 kN·s; their derivative is a force peaking at 51 kN at 4 ms">
      <Panel x0={0} w={w} h={height} data={bumperImpulse} max={3.5} ticks={[0, 1, 2, 3]}
        title="Impulse, as stored: it only rises" ytitle="impulse (kN·s)" color="var(--neutral)" />
      <Panel x0={w + gap} w={w} h={height} data={bumperForce} max={60} ticks={[0, 20, 40, 60]}
        title="Force = its slope: it has a peak" ytitle="force (kN)" color="var(--series-2)" peak={{ i: 4, label: '51 kN at 4 ms' }} />
    </svg>
  )
}
