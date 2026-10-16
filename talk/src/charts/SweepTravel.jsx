import React from 'react'
import { sweep } from '../data/numbers.js'
import { roundedRight } from './PartShares.jsx'

// How far the 500 kg body travels into the pole, per sheet-thickness scale.
export default function SweepTravel({ width = 600 }) {
  const labelW = 130
  const top = 34
  const rowH = 86
  const max = 360
  const barMax = width - labelW - 20
  const height = top + sweep.length * rowH + 24
  const x = (v) => labelW + (v / max) * barMax
  const ticks = [0, 100, 200, 300]
  return (
    <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="Body travel: x0.8 at least 322 mm and not stopped, x1.0 249 mm, x1.2 190 mm">
      <text className="ttl" x={0} y={14}>How far the 500 kg car travels into the pole (mm), 100 ms simulated</text>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={x(t)} x2={x(t)} y1={top} y2={height - 22} />
          <text className="lbl muted" x={x(t)} y={height - 6} textAnchor="middle">{t}</text>
        </g>
      ))}
      {sweep.map((d, i) => {
        const y = top + i * rowH + 12
        const w = x(d.travel) - labelW
        const fill = d.stopped ? 'var(--series-1)' : 'var(--err)'
        return (
          <g className="mark" key={d.scale}>
            <title>{`${d.scale} (${d.gauge}): ${d.stopped ? '' : '≥ '}${d.travel} mm, ${d.note}`}</title>
            <text x={labelW - 14} y={y + 17} textAnchor="end" style={{ fontSize: 18, fontWeight: 700 }}>{d.scale}</text>
            <text className="lbl muted" x={labelW - 14} y={y + 36} textAnchor="end">gauge {d.gauge}</text>
            <path className="bar" d={roundedRight(labelW, y, w, 24, 4)} fill={fill} />
            {!d.stopped && (
              <g>
                <line x1={x(d.travel) + 4} x2={x(max) - 8} y1={y + 12} y2={y + 12} stroke="var(--err)" strokeWidth={2} strokeDasharray="5 4" />
                <path d={`M${x(max) - 10},${y + 5} L${x(max)},${y + 12} L${x(max) - 10},${y + 19} Z`} fill="var(--err)" />
              </g>
            )}
            <text className="val" x={labelW + 8} y={y + 17} fill="#fff" style={{ fontSize: 15 }}>{d.stopped ? '' : '≥ '}{d.travel} mm</text>
            <text className="lbl" x={labelW} y={y + 46} fill={d.stopped ? 'var(--muted)' : 'var(--err)'} style={{ fontWeight: d.stopped ? 400 : 700 }}>
              {d.stopped ? '✓ ' : '✕ '}{d.note}
            </text>
          </g>
        )
      })}
      <line className="axis" x1={labelW} x2={labelW} y1={top} y2={height - 22} />
    </svg>
  )
}
