import React from 'react'

// F-09 in one picture: a brick (8 corners) whose corners are listed twice collapses into a wedge (6 corners).
// It is legal, but smaller and less accurate; a smaller element needs a shorter time step, and with mass
// scaling the solver keeps the step by adding mass there. Mechanism only: where the phone's added mass
// actually sits was not traced (the listing reports the total, 1.02 % in v0, 1.56 % in v0.1).
const W = 600
const H = 200

function Brick({ dx }) {
  const f = [[0, 72], [80, 72], [80, 142], [0, 142]].map(([x, y]) => [x + dx, y])
  const b = f.map(([x, y]) => [x + 30, y - 22])
  const P = (pts) => pts.map(([x, y]) => `${x},${y}`).join(' ')
  return (
    <g>
      <polygon points={P(b)} fill="#f4f7f9" stroke="var(--muted)" strokeWidth={1.2} />
      {f.map((p, i) => <line key={i} x1={p[0]} y1={p[1]} x2={b[i][0]} y2={b[i][1]} stroke="var(--muted)" strokeWidth={1.2} />)}
      <polygon points={P(f)} fill="rgba(13, 148, 136, 0.10)" stroke="var(--ink)" strokeWidth={1.8} />
      {[...f, ...b].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.8} fill="var(--ink)" />)}
    </g>
  )
}

function Wedge({ dx, filled }) {
  // a doorstop: the top-right edge of the brick squashed down onto the bottom-right edge
  const f = [[0, 72], [80, 142], [0, 142]].map(([x, y]) => [x + dx, y])
  const b = f.map(([x, y]) => [x + 30, y - 22])
  const P = (pts) => pts.map(([x, y]) => `${x},${y}`).join(' ')
  return (
    <g>
      <polygon points={P(b)} fill={filled ? 'rgba(235, 104, 52, 0.25)' : '#f4f7f9'} stroke="var(--muted)" strokeWidth={1.2} />
      {f.map((p, i) => <line key={i} x1={p[0]} y1={p[1]} x2={b[i][0]} y2={b[i][1]} stroke="var(--muted)" strokeWidth={1.2} />)}
      <polygon points={P(f)} fill={filled ? 'rgba(235, 104, 52, 0.45)' : 'rgba(13, 148, 136, 0.10)'} stroke="var(--ink)" strokeWidth={1.8} />
      {[...f, ...b].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.8} fill="var(--ink)" />)}
    </g>
  )
}

export default function WedgeFigure({ width = W }) {
  return (
    <svg className="chart" width={width} height={(width / W) * H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="A brick with 8 corners; the same brick with corners merged into a 6-corner wedge; the wedge needs a shorter time step, so the solver adds mass there">
      <text x={0} y={14} style={{ fontSize: 14, fontWeight: 700 }}>A brick: 8 corners</text>
      <Brick dx={22} />

      <text x={206} y={14} style={{ fontSize: 14, fontWeight: 700 }}>Squashed: a wedge</text>
      <Wedge dx={226} />
      <circle cx={306} cy={142} r={10} fill="none" stroke="var(--err)" strokeWidth={2} />
      <circle cx={336} cy={120} r={10} fill="none" stroke="var(--err)" strokeWidth={2} />
      <text x={300} y={168} textAnchor="middle" className="lbl" style={{ fill: 'var(--err)', fontWeight: 700 }}>corners listed twice:</text>
      <text x={300} y={185} textAnchor="middle" className="lbl" style={{ fill: 'var(--err)', fontWeight: 700 }}>8 corners → 6</text>

      <text x={412} y={14} style={{ fontSize: 14, fontWeight: 700 }}>Why it matters</text>
      <Wedge dx={426} filled />
      <text x={476} y={104} className="lbl" style={{ fontWeight: 800, fill: 'var(--err)' }}>+ mass</text>
      <text x={414} y={168} className="lbl">smaller → shorter time step</text>
      <text x={414} y={185} className="lbl">→ the solver adds mass there</text>
      <text x={0} y={168} className="lbl muted">the normal element</text>
    </svg>
  )
}
