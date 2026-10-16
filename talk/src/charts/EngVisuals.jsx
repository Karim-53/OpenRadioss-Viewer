import React from 'react'

// The "Visual" view of the phone's Engineering slide: one small picture per question.
// Thicknesses and layer counts: data/numbers.js thinParts (model.json assembly.through_thickness, layers counted
// in Cell_Phone_Drop_0000.rad after delivery); board material: report Materials page (LAW1, 15 GPa).
// The tolerance and history pictures are schematic: the deck holds no tolerance or process data to draw.

// The "Table" view of the first question: the 11 thin parts, one line each (the backup slide "the 11 thin parts"
// has the full table, with the report's thickness / edge screening ratio).
const THIN_ROWS = [
  ['2 boards (top_pcb, bottom_pcb)', '0.40', 'one-point brick', '1', 'the hourglass stabiliser', true],
  ['ic, ic_01', '0.40 · 0.56', 'one-point brick', '1', 'the hourglass stabiliser', true],
  ['5 micro-chips', '0.30', 'one-point brick', '2', 'the material, coarsely', false],
  ['screen', '0.56', 'quadratic tet', '1', 'the material (no hourglass)', false],
  ['camera connector', '0.80', 'quadratic tet', '1', 'the material (no hourglass)', false],
]
export function ThinTable() {
  return (
    <table className="tb">
      <thead><tr><th>parts</th><th className="num">mm</th><th>element</th><th className="num">layers</th><th>what bends it</th></tr></thead>
      <tbody>
        {THIN_ROWS.map(([part, mm, el, n, bend, bad]) => (
          <tr key={part}>
            <td><b>{part}</b></td><td className="num">{mm}</td><td>{el}</td><td className="num">{n}</td>
            <td className={bad ? 'bad' : ''}>{bend}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const H = 132

// ---------------------------------------------------------------- 1 · the thin parts, thickness to scale
// [label, plates: [thickness mm, width px], layers, brick (one-point, needs hourglass control) or tet]
// same order as the Table view (THIN_ROWS): the one-layer parts the stabiliser bends first
const THIN = [
  ['2 boards', [[0.40, 112]], 1, 'brick', ['0.40 mm', '1 layer']],
  ['ic · ic_01', [[0.40, 52], [0.56, 52]], 1, 'brick', ['0.40 · 0.56 mm', '1 layer']],
  ['5 micro-chips', [[0.30, 112]], 2, 'brick', ['0.30 mm', '2 layers']],
  ['screen', [[0.56, 112]], 1, 'tet', ['0.56 mm', '1 tet']],
  ['camera connector', [[0.80, 112]], 1, 'tet', ['0.80 mm', '1 tet']],
]

function Plate({ x, w, t, layers, kind }) {
  const h = t * 45 // px per mm
  const y = 52 - h / 2
  const cell = 16
  const n = Math.round(w / cell)
  const cw = w / n
  const brick = kind === 'brick'
  const lines = []
  for (let i = 1; i < n; i++) lines.push(<line key={`v${i}`} x1={x + i * cw} x2={x + i * cw} y1={y} y2={y + h} />)
  if (layers === 2) lines.push(<line key="mid" x1={x} x2={x + w} y1={y + h / 2} y2={y + h / 2} />)
  if (!brick) for (let i = 0; i < n; i++) lines.push(<line key={`d${i}`} x1={x + i * cw} x2={x + (i + 1) * cw} y1={y + h} y2={y} />)
  const dots = []
  if (brick) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < layers; j++) {
        dots.push(<circle key={`${i}-${j}`} cx={x + (i + 0.5) * cw} cy={y + ((j + 0.5) * h) / layers} r={1.7} fill="var(--err)" />)
      }
    }
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={brick ? 'var(--warn-bg)' : '#eef2f5'} stroke={brick ? 'var(--warn-c)' : 'var(--rest)'} strokeWidth={1.4} />
      <g stroke={brick ? 'var(--warn-c)' : 'var(--rest)'} strokeWidth={0.7} opacity={0.75}>{lines}</g>
      {dots}
    </g>
  )
}

export function ThinVisual({ width = 600 }) {
  const col = 112
  const gap = 10
  const h = 146
  return (
    <svg className="chart" width={width} height={(width / 600) * h} viewBox={`0 0 600 ${h}`} role="img"
      aria-label="The phone's thin parts drawn to the same thickness scale: micro-chips 0.30 mm, boards 0.40 mm, ic chips 0.40 and 0.56 mm are one-point bricks that need hourglass control; the screen 0.56 mm and the camera connector 0.80 mm are tets with no hourglass modes">
      {THIN.map(([label, plates, layers, kind, sub], i) => {
        const x0 = i * (col + gap)
        let x = x0
        const brick = kind === 'brick'
        return (
          <g key={label}>
            <text x={x0 + col / 2} y={14} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700 }}>{label}</text>
            {plates.map(([t, w], k) => {
              const g = <Plate key={k} x={x} w={w} t={t} layers={layers} kind={kind} />
              x += w + 8
              return g
            })}
            <text x={x0 + col / 2} y={87} textAnchor="middle" className="lbl muted" style={{ fontSize: 12 }}>{sub[0]}</text>
            <text x={x0 + col / 2} y={101} textAnchor="middle" className="lbl muted" style={{ fontSize: 12 }}>{sub[1]}</text>
            <text x={x0 + col / 2} y={117} textAnchor="middle"
              style={{ fontSize: 12, fontWeight: 700, fill: brick ? 'var(--warn-c)' : 'var(--rest)' }}>
              {brick ? 'hourglass control' : 'no hourglass'}
            </text>
          </g>
        )
      })}
      <text x={0} y={141} style={{ fontSize: 13 }}>
        <tspan style={{ fill: 'var(--err)', fontWeight: 800 }}>●</tspan> one check point per brick: <tspan style={{ fontWeight: 700 }}>9 of the 11 thin parts</tspan> run under hourglass control
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------- 2 · manufacturing errors: one value vs a spread
const ARROW_ID = 'engArrow'
function Arrow({ x1, x2, y }) {
  return <line x1={x1} x2={x2} y1={y} y2={y} stroke="var(--muted)" strokeWidth={1.8} markerEnd={`url(#${ARROW_ID})`} />
}
function ArrowDefs() {
  return (
    <defs>
      <marker id={ARROW_ID} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
      </marker>
    </defs>
  )
}

// a fixed, symmetric-looking scatter (no randomness: the deck renders the same every time)
const SCATTER = [[-52, 58], [-38, 74], [-30, 50], [-22, 82], [-14, 64], [-8, 46], [0, 72], [6, 56], [13, 84], [20, 62], [27, 48], [35, 76], [44, 60], [55, 70]]

export function ToleranceVisual({ width = 600 }) {
  const P = [0, 212, 424]
  const w = 176
  const axisY = 90
  const bell = (cx) => {
    const pts = []
    for (let i = 0; i <= 40; i++) {
      const u = -3 + (6 * i) / 40
      pts.push(`${(cx + u * 24).toFixed(1)},${(axisY - 58 * Math.exp(-0.5 * u * u)).toFixed(1)}`)
    }
    return `M${pts.join(' L')} Z`
  }
  return (
    <svg className="chart" width={width} height={(width / 600) * H} viewBox={`0 0 600 ${H}`} role="img"
      aria-label="In the deck every size is one exact value; real parts spread around it; so the real drop result is a scatter around the deck's single answer, of unknown width">
      <ArrowDefs />
      {/* the deck: one exact value */}
      <text x={P[0]} y={14} style={{ fontSize: 13, fontWeight: 700 }}>In the deck: one size</text>
      <line className="axis" x1={P[0] + 6} x2={P[0] + w - 6} y1={axisY} y2={axisY} />
      <line x1={P[0] + 88} x2={P[0] + 88} y1={axisY} y2={34} stroke="var(--accent)" strokeWidth={3.5} strokeLinecap="round" />
      <text x={P[0] + 88} y={axisY + 17} textAnchor="middle" className="lbl">board <tspan style={{ fontWeight: 700 }}>0.40 mm</tspan>, exactly</text>
      <Arrow x1={P[0] + w + 2} x2={P[1] - 6} y={62} />
      {/* the factory: a spread */}
      <text x={P[1]} y={14} style={{ fontSize: 13, fontWeight: 700 }}>Made in a factory: a spread</text>
      <path d={bell(P[1] + 88)} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.6} />
      <line className="axis" x1={P[1] + 6} x2={P[1] + w - 6} y1={axisY} y2={axisY} />
      <line x1={P[1] + 88} x2={P[1] + 88} y1={axisY} y2={34} stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="3 3" />
      <text x={P[1] + 88} y={axisY + 17} textAnchor="middle" className="lbl">0.40 mm ± a tolerance</text>
      <Arrow x1={P[1] + w + 2} x2={P[2] - 6} y={62} />
      {/* the result: a scatter of unknown width */}
      <text x={P[2]} y={14} style={{ fontSize: 13, fontWeight: 700 }}>So the real drop result</text>
      <line className="axis" x1={P[2] + 6} x2={P[2] + w - 6} y1={axisY} y2={axisY} />
      {SCATTER.map(([dx, y], i) => (
        <circle key={i} cx={P[2] + 88 + dx} cy={y} r={3.4} fill="var(--neutral)" />
      ))}
      <circle cx={P[2] + 88} cy={64} r={6} fill="var(--series-2)" stroke="#fff" strokeWidth={1.5} />
      <text x={P[2] + 88} y={axisY + 17} textAnchor="middle" className="lbl">
        <tspan style={{ fill: 'var(--series-2)', fontWeight: 800 }}>●</tspan> this deck: one point
      </text>
      <text x={0} y={127} style={{ fontSize: 13 }}>
        How wide the real scatter is, <tspan style={{ fontWeight: 700 }}>one deck cannot say</tspan>: it holds no tolerance at all.
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------- 3 · manufacturing history: uniform vs as made
export function HistoryVisual({ width = 600 }) {
  const P = [0, 212, 424]
  const layers = [
    ['cu', 3], ['ep', 7], ['cu', 3], ['ep', 7], ['cu', 3],
  ]
  let y = 40
  return (
    <svg className="chart" width={width} height={(width / 600) * H} viewBox={`0 0 600 ${H}`} role="img"
      aria-label="In the deck a board is one uniform material of one thickness; a real board is layers of copper and glass-fibre epoxy; a bent or pressed part is thinner and harder at the bend">
      {/* in the deck */}
      <text x={P[0]} y={14} style={{ fontSize: 13, fontWeight: 700 }}>In the deck: a board</text>
      <rect x={P[0] + 8} y={40} width={150} height={23} fill="#dfe5ea" stroke="var(--rest)" strokeWidth={1.2} />
      <text x={P[0] + 83} y={56} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700 }}>one material · 15 GPa</text>
      <text x={P[0] + 8} y={93} className="lbl">same thickness and material</text>
      <text x={P[0] + 8} y={108} className="lbl">everywhere</text>
      <line x1={198} x2={198} y1={4} y2={112} stroke="var(--line)" strokeWidth={1} />
      {/* a real board */}
      <text x={P[1]} y={14} style={{ fontSize: 13, fontWeight: 700 }}>As made: a real board</text>
      {layers.map(([k, h], i) => {
        const r = <rect key={i} x={P[1] + 4} y={y} width={120} height={h} fill={k === 'cu' ? '#c8823f' : '#cfe3c4'} stroke="none" />
        y += h
        return r
      })}
      <rect x={P[1] + 4} y={40} width={120} height={23} fill="none" stroke="var(--rest)" strokeWidth={1} />
      <text x={P[1] + 130} y={45} style={{ fontSize: 11.5, fill: '#9a5a1f', fontWeight: 700 }}>copper</text>
      <text x={P[1] + 130} y={61} style={{ fontSize: 11.5, fill: '#4d7a3f', fontWeight: 700 }}>glass-fibre</text>
      <text x={P[1] + 130} y={74} style={{ fontSize: 11.5, fill: '#4d7a3f', fontWeight: 700 }}>epoxy</text>
      <text x={P[1] + 4} y={93} className="lbl">layers with very different</text>
      <text x={P[1] + 4} y={108} className="lbl">stiffness</text>
      {/* a bent or pressed part */}
      <text x={P[2]} y={14} style={{ fontSize: 13, fontWeight: 700 }}>As made: a bent part</text>
      <path d={`M${P[2] + 10},36 H${P[2] + 84}`} stroke="var(--rest)" strokeWidth={10} fill="none" />
      <path d={`M${P[2] + 84},36 Q${P[2] + 110},36 ${P[2] + 110},62`} stroke="var(--series-2)" strokeWidth={6} fill="none" />
      <path d={`M${P[2] + 110},62 V104`} stroke="var(--rest)" strokeWidth={10} fill="none" />
      <circle cx={P[2] + 103} cy={43} r={15} fill="none" stroke="var(--series-2)" strokeWidth={1.2} strokeDasharray="3 2" />
      <text x={P[2] + 122} y={42} style={{ fontSize: 12, fill: 'var(--series-2)', fontWeight: 700 }}>thinner</text>
      <text x={P[2] + 122} y={57} style={{ fontSize: 12, fill: 'var(--series-2)', fontWeight: 700 }}>and harder</text>
      <text x={P[2] + 122} y={72} style={{ fontSize: 12, fill: 'var(--series-2)', fontWeight: 700 }}>at the bend</text>
      <text x={0} y={127} style={{ fontSize: 13 }}>
        The deck holds <tspan style={{ fontWeight: 700 }}>no manufacturing history</tspan>: no layers, no thinning, no hardening.
      </text>
    </svg>
  )
}
