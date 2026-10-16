import React from 'react'
import { phoneParts } from '../data/numbers.js'

// Which part absorbs the blow. v0 could not answer (no per-part energy sensor: F-03); v0.1 records it
// with /TH/PART. Single series -> one hue, no legend box; the v0 row says "not recorded" instead of a bar.
export default function PartShares({ width = 600 }) {
  const rowH = 24
  const labelW = 130
  const top = 84
  const max = 70
  const barMax = width - labelW - 60
  const height = top + phoneParts.length * rowH + 2
  const x = (v) => (v / max) * barMax
  return (
    <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="Share of each part's peak deformation energy: not recorded in v0, recorded in v0.1">
      <text className="ttl" x={0} y={13}>Share of each part's peak deformation energy (%)</text>
      <text x={labelW - 9} y={41} textAnchor="end" style={{ fontSize: 14, fontWeight: 700 }}>v0</text>
      <rect x={labelW} y={24} width={barMax + 50} height={25} rx={6} fill="none" stroke="var(--neutral)" strokeWidth={1.5} strokeDasharray="5 4" />
      <text className="lbl muted" x={labelW + 10} y={41}>not recorded: no energy sensor on any part (F-03)</text>
      <text x={labelW - 9} y={74} textAnchor="end" style={{ fontSize: 14, fontWeight: 700 }}>v0.1</text>
      <text className="lbl muted" x={labelW + 2} y={74}>recorded by the new per-part sensors</text>
      {phoneParts.map((d, i) => {
        const y = top + i * rowH
        const w = Math.max(x(d.share), 3)
        const hl = i < 3
        return (
          <g className="mark" key={d.part}>
            <title>{`${d.label}: ${d.share} %`}</title>
            <rect className="hit" x={0} y={y} width={width} height={rowH} />
            <text className="lbl" x={labelW - 9} y={y + 15} textAnchor="end" style={{ fontWeight: hl ? 600 : 400 }}>{d.label}</text>
            <path className="bar" d={roundedRight(labelW, y + 4, w, 15, 3)} fill={hl ? 'var(--series-1)' : 'var(--neutral)'} />
            <text className="val" x={labelW + w + 6} y={y + 16}>{d.share.toFixed(1)} %</text>
          </g>
        )
      })}
      <line className="axis" x1={labelW} x2={labelW} y1={top} y2={height - 2} />
    </svg>
  )
}

// bar with a rounded data end and a square baseline
export function roundedRight(x, y, w, h, r) {
  const rr = Math.min(r, w, h / 2)
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`
}

export function roundedTop(x, y, w, h, r) {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}
