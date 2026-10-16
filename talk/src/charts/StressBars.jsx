import React from 'react'
import { phoneStress } from '../data/numbers.js'
import { roundedRight } from './PartShares.jsx'

// Highest stress per part, v0 (grey, 0.1 ms, no contact) vs v0.1 (teal, 2 ms, with contact), MPa.
// Two series -> legend + a value on every bar end (only 12 bars).
export default function StressBars({ width = 600 }) {
  const labelW = 130
  const top = 48
  const rowH = 40
  const max = 125
  const barMax = width - labelW - 44
  const height = top + phoneStress.length * rowH
  const x = (v) => (v / max) * barMax
  return (
    <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="Highest von Mises stress per part, v0 versus v0.1">
      <text className="ttl" x={0} y={13}>Highest stress per part (von Mises, MPa)</text>
      <g transform="translate(0, 24)">
        <rect x={0} y={0} width={12} height={12} rx={3} fill="var(--neutral)" /><text className="lbl muted" x={17} y={11}>v0: 0.1 ms, no contact</text>
        <rect x={190} y={0} width={12} height={12} rx={3} fill="var(--series-1)" /><text className="lbl muted" x={207} y={11}>v0.1: 2 ms, with contact</text>
      </g>
      {phoneStress.map((d, i) => {
        const y = top + i * rowH + 4
        const w0 = Math.max(x(d.v0), 1.5)
        const w1 = Math.max(x(d.v01), 2)
        return (
          <g className="mark" key={d.part}>
            <title>{`${d.label}: v0 ${d.v0} MPa → v0.1 ${d.v01} MPa`}</title>
            <text className="lbl" x={labelW - 9} y={y + 13} textAnchor="end" style={{ fontWeight: 600 }}>{d.label}</text>
            {d.note && <text className="lbl muted" x={labelW - 9} y={y + 29} textAnchor="end" style={{ fontSize: 11.5 }}>{d.note}</text>}
            <path className="bar" d={roundedRight(labelW, y, w0, 14, 3)} fill="var(--neutral)" />
            <text className="val" x={labelW + w0 + 5} y={y + 11} fill="var(--muted)" style={{ fontSize: 12.5 }}>{d.v0}</text>
            <path className="bar" d={roundedRight(labelW, y + 16, w1, 14, 3)} fill="var(--series-1)" />
            <text className="val" x={labelW + w1 + 5} y={y + 27}>{d.v01}</text>
          </g>
        )
      })}
      <line className="axis" x1={labelW} x2={labelW} y1={top} y2={height - 8} />
    </svg>
  )
}
