import React from 'react'
import { keywordTop15 } from '../data/numbers.js'

// Top-15 keywords across the four deck files, split bumper / phone (kb/04_keywords.md §1.2).
export default function KeywordBars({ width = 600 }) {
  const rowH = 28
  const labelW = 170
  const top = 30
  const max = 37
  const barMax = width - labelW - 50
  const height = top + keywordTop15.length * rowH + 4
  const x = (v) => (v / max) * barMax
  return (
    <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Keyword frequency, top 15">
      <g>
        <rect x={0} y={4} width={12} height={12} rx={3} fill="var(--series-1)" /><text className="lbl muted" x={18} y={15}>bumper _0000.rad</text>
        <rect x={160} y={4} width={12} height={12} rx={3} fill="var(--series-2)" /><text className="lbl muted" x={178} y={15}>phone _0000.rad</text>
      </g>
      {keywordTop15.map(([k, b, p], i) => {
        const y = top + i * rowH
        const wb = x(b)
        const wp = x(p)
        return (
          <g className="mark" key={k}>
            <title>{`${k}: bumper ${b}, phone ${p}`}</title>
            <text x={labelW - 10} y={y + 17} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 15 }}>{k}</text>
            {b > 0 && <rect x={labelW} y={y + 5} width={wb} height={16} fill="var(--series-1)" />}
            {p > 0 && <rect x={labelW + wb + (b > 0 ? 2 : 0)} y={y + 5} width={wp} height={16} rx={3} fill="var(--series-2)" />}
            <text className="val" x={labelW + wb + wp + 8} y={y + 18}>{b + p}</text>
          </g>
        )
      })}
    </svg>
  )
}
