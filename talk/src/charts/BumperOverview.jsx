import React from 'react'
import data from '../data/bumper.json'

// The bumper as one annotated picture, so the slide does not repeat the report's Overview page.
// The 3D view is rendered from the deck's own mesh by tools/bumper_figures.py, seen from behind the car
// (picture left = driver's left); every label points at a projected point of that same view, and the
// 78 dots are the 78 spot-weld springs at their real positions. Below: the left crash box, magnified.
const O = data.overview
const IN = O.inset
const W = 600
const IMG_Y = 80 // where the main picture starts
const INSET = { x: 0, y: IMG_Y + O.height + 14, w: 150 }
const INSET_SCALE = INSET.w / IN.width
const INSET_H = IN.height * INSET_SCALE
const H = INSET.y + INSET_H + 2

const at = (p) => [p[0], p[1] + IMG_Y]
const ins = (p) => [INSET.x + p[0] * INSET_SCALE, INSET.y + p[1] * INSET_SCALE]

function Arrow({ from, to }) {
  return <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="var(--ink)" strokeWidth={1.3} markerEnd="url(#bo-head)" />
}

function Label({ x, y, title, lines = [] }) {
  return (
    <text x={x} y={y}>
      <tspan style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</tspan>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={17} style={{ fontSize: 13 }} className="muted">{l}</tspan>
      ))}
    </text>
  )
}

// the weld nearest to a target point (in inset pixels), so an arrow ends on a real dot
function nearest(pts, [x, y]) {
  return pts.reduce((b, q) => (Math.hypot(q[0] - x, q[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? q : b))
}

export default function BumperOverview({ width = W }) {
  const p = (k) => at(O.points[k])
  const [rl, rr] = [p('rearL'), p('rearR')]
  const bx = IN.box // the left crash box in the main picture: x0, y0, x1, y1
  const seam = IN.welds.filter((w) => w.part === 13).map((w) => ins(w.xy))
  const flange = IN.welds.filter((w) => w.part !== 13).map((w) => ins(w.xy))
  const seamDot = nearest(seam, [INSET.x + 110, INSET.y + 95])
  const flangeDot = nearest(flange, [INSET.x + 125, INSET.y + 30])
  const barAt = (x) => [x, rl[1] + ((x - rl[0]) / (rr[0] - rl[0])) * (rr[1] - rl[1])]
  return (
    <svg className="chart" width={width} height={(width / W) * H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="The bumper seen from behind the car: a 2 m DP1000 beam, two DP600 crash boxes held by 78 spot welds, a 500 kg rigid block on their rear ends, driving at 18 km/h into a rigid pole of 254 mm">
      <defs>
        <marker id="bo-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ink)" />
        </marker>
      </defs>

      <image href={O.image} x={0} y={IMG_Y} width={O.width} height={O.height} />

      {/* the 78 spot welds, at their real positions */}
      {O.welds.map((w, i) => {
        const [x, y] = at(w.xy)
        return <circle key={i} cx={x} cy={y} r={1.8} fill="var(--ink)" stroke="#fff" strokeWidth={0.7} />
      })}

      {/* the car: a rigid block holding the crash boxes' rear ends (same symbol as the connection graph) */}
      <line x1={rl[0]} y1={rl[1]} x2={rr[0]} y2={rr[1]} stroke="var(--accent)" strokeWidth={5} strokeLinecap="round" opacity={0.85} />

      {/* top labels */}
      <Label x={6} y={20} title="beam: 2 m of DP1000 steel" lines={['shells 1.8 mm thin, 15.4 kg']} />
      <Arrow from={[96, 44]} to={[p('beamTopL')[0], p('beamTopL')[1] - 3]} />
      <Label x={398} y={20} title="pole" lines={['Ø 254 mm, rigid, fixed', '3 mm in front of the beam']} />
      <Arrow from={[400, 60]} to={[p('poleSide')[0] + 4, p('poleSide')[1] - 8]} />

      {/* the left crash box, magnified */}
      <rect x={bx[0] - 3} y={bx[1] + IMG_Y - 3} width={bx[2] - bx[0] + 6} height={bx[3] - bx[1] + 6} rx={5}
        fill="none" stroke="var(--muted)" strokeWidth={1.2} strokeDasharray="4 3" />
      <line x1={(bx[0] + bx[2]) / 2} y1={bx[3] + IMG_Y + 3} x2={INSET.x + INSET.w / 2} y2={INSET.y} stroke="var(--muted)" strokeWidth={1.2} strokeDasharray="4 3" />
      <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET_H} rx={8} fill="#fff" stroke="var(--line)" strokeWidth={1.2} />
      <image href={IN.image} x={INSET.x} y={INSET.y} width={INSET.w} height={INSET_H} />
      {IN.welds.map((w, i) => {
        const [x, y] = ins(w.xy)
        return <circle key={i} cx={x} cy={y} r={2.6} fill="var(--ink)" stroke="#fff" strokeWidth={0.9} />
      })}

      <Label x={168} y={INSET.y + 14} title="78 spot welds (dots), 39 a side" lines={['9 + 9 weld a crash box to the beam,', '21 join its two halves;', 'springs that cannot break']} />
      <Arrow from={[164, INSET.y + 27]} to={[flangeDot[0] + 4, flangeDot[1] + 1]} />
      <Arrow from={[164, INSET.y + 44]} to={[seamDot[0] + 4, seamDot[1]]} />
      <Label x={168} y={INSET.y + 128} title="crash box: DP600, 2.2 mm" lines={['two pressed halves, dark and light']} />
      <Arrow from={[164, INSET.y + 140]} to={[INSET.x + 84, INSET.y + 152]} />

      {/* the car */}
      <Label x={418} y={INSET.y + 14} title="car: a 500 kg rigid block" lines={['the green bar: it holds the', 'crash boxes’ rear ends and', 'drives straight ahead', 'at 18 km/h (5 m/s)']} />
      <Arrow from={[452, INSET.y - 4]} to={[barAt(452)[0], barAt(452)[1] + 5]} />
    </svg>
  )
}
