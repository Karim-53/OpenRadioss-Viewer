import React from 'react'
import { phoneBooks } from '../data/numbers.js'

// Waterfall, phone v0.1 at 2 ms, in mJ: 21.1 mJ are missing from the solver's books; friction (13.5) and the
// hourglass stabiliser (8.7) account for them; 1.1 mJ are left over. Each bar also gives its share of the
// 401.5 mJ impact energy, which is where the report's -5.3 % comes from.
export default function EnergyBooks({ width = 600, height = 250 }) {
  const left = 44
  const plotTop = 16
  const plotH = height - plotTop - 58
  const vMax = 4
  const vMin = -24
  const y = (v) => plotTop + ((vMax - v) / (vMax - vMin)) * plotH
  const slot = (width - left) / phoneBooks.length
  const barW = Math.min(70, slot * 0.5)

  let run = 0
  const bars = phoneBooks.map((d) => {
    let from, to
    if (d.kind === 'start') { from = 0; to = d.mj; run = d.mj }
    else if (d.kind === 'add') { from = run; to = run + d.mj; run = to }
    else { from = 0; to = d.mj }
    return { ...d, from, to }
  })
  const color = (d) => (d.kind === 'start' ? 'var(--err)' : d.kind === 'add' ? 'var(--series-1)' : 'var(--ink)')
  const ticks = [0, -10, -20]

  return (
    <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="Phone v0.1 energy books at 2 ms: 21.1 mJ missing; friction 13.5 mJ and stabiliser 8.7 mJ account for it; 1.1 mJ left">
      {ticks.map((t) => (
        <g key={t}>
          <line className={t === 0 ? 'axis' : 'grid'} x1={left} x2={width} y1={y(t)} y2={y(t)} style={t === 0 ? { stroke: 'var(--muted)' } : null} />
          <text className="lbl muted" x={left - 7} y={y(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
      <text className="lbl muted" x={0} y={plotTop - 4}>mJ</text>
      {bars.map((d, i) => {
        const cx = left + slot * i + slot / 2
        const top = y(Math.max(d.from, d.to))
        const bottom = y(Math.min(d.from, d.to))
        const next = bars[i + 1]
        const below = d.to < d.from
        return (
          <g className="mark" key={d.step}>
            <title>{`${d.step}: ${d.mj > 0 ? '+' : ''}${d.mj} mJ (${d.pct > 0 ? '+' : ''}${d.pct} % of 401.5 mJ)`}</title>
            <rect className="bx" x={cx - barW / 2} y={top} width={barW} height={Math.max(bottom - top, 2)} rx={4} fill={color(d)} />
            {next && (
              <line x1={cx + barW / 2} x2={cx + slot - barW / 2} y1={y(d.to)} y2={y(d.to)} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
            )}
            <text className="val" x={cx} y={below ? bottom + 16 : top - 18} textAnchor="middle" style={{ fontSize: 14 }}>{d.mj > 0 ? '+' : ''}{d.mj} mJ</text>
            <text className="lbl muted" x={cx} y={below ? bottom + 31 : top - 4} textAnchor="middle" style={{ fontSize: 12 }}>{d.pct > 0 ? '+' : ''}{d.pct} %</text>
            <text className="lbl" x={cx} y={height - 30} textAnchor="middle" style={{ fontWeight: 700 }}>{d.step}</text>
            <text className="lbl muted" x={cx} y={height - 13} textAnchor="middle" style={{ fontSize: 12 }}>{d.sub}</text>
          </g>
        )
      })}
    </svg>
  )
}
