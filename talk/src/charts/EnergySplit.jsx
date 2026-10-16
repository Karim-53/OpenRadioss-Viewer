import React from 'react'

// Where the impact energy is at the end of a run: one 100 % bar per run, direct-labelled.
// Order: stored in the phone (teal) | taken by the floor (orange) | friction + stabiliser (violet) | still motion (grey rest).
// Phone v0 at 0.1 ms: model.json run.energy_split_end (93.0 / 6.5 / 0.5 %).
// Phone v0.1 at 2 ms: model_v0.1.json energy_split_end and energy_sources.fractions_end (57 / 15 / 23 / 5 %, rounded).
const SEG = [
  { k: 'phone', label: 'stored in the phone', color: 'var(--series-1)' },
  { k: 'floor', label: 'taken by the floor', color: 'var(--series-2)' },
  { k: 'lost', label: 'friction + stabiliser', color: 'var(--series-3)' },
  { k: 'motion', label: 'still motion energy', color: 'var(--rest)' },
]

export default function EnergySplit({ rows, width = 600, title = 'Where the impact energy (401.5 mJ) is when the run stops' }) {
  const labelW = 104
  const barH = 30
  const rowH = 74
  const top = 46
  const plotW = width - labelW - 4
  const height = top + rows.length * rowH - 6
  return (
    <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      <text className="ttl" x={0} y={13}>{title}</text>
      <g transform="translate(0, 22)">
        {SEG.map((s, i) => (
          <g key={s.k} transform={`translate(${i * 150}, 0)`}>
            <rect x={0} y={0} width={12} height={12} rx={3} fill={s.color} />
            <text className="lbl muted" x={17} y={11}>{s.label}</text>
          </g>
        ))}
      </g>
      {rows.map((r, i) => {
        const y = top + i * rowH + 8
        let x = labelW
        let lastSmall = -999
        let stagger = 0
        return (
          <g key={r.name}>
            <text x={labelW - 10} y={y + 14} textAnchor="end" style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</text>
            <text x={labelW - 10} y={y + 30} textAnchor="end" className="lbl muted">{r.sub}</text>
            {SEG.map((s) => {
              const v = r[s.k] || 0
              if (!v) return null
              const w = (v / 100) * plotW
              const x0 = x
              x += w
              const inside = w > 44
              if (!inside) {
                stagger = x0 - lastSmall < 48 ? stagger + 15 : 0
                lastSmall = x0
              }
              const dy = inside ? 0 : stagger
              return (
                <g className="mark" key={s.k}>
                  <title>{`${r.name}: ${s.label} ${v} %`}</title>
                  <rect className="bx" x={x0} y={y} width={Math.max(w - 2, 1.5)} height={barH} rx={3} fill={s.color} />
                  {inside
                    ? <text className="val" x={x0 + w / 2} y={y + 20} textAnchor="middle" style={{ fill: '#fff' }}>{v} %</text>
                    : <text className="val" x={x0 + 1} y={y + barH + 15 + dy} textAnchor="start">{v} %</text>}
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
