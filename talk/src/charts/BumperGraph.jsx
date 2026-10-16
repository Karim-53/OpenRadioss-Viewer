import React from 'react'

// How the bumper holds together, drawn as a graph (the report only has the interface table).
// The beam's 10 DP1000 parts share mesh points: one continuous sheet. Each crash box is two pressed halves
// held only by spot welds (2-node springs, each end glued by a TYPE2 tie): 21 between the halves, 9 + 9 to the
// beam. The car is a 500 kg rigid block on the crash boxes' rear ends. The pole (rigid wall) and the
// self-contact over all 14 sheets push without gluing, friction 0.2. Masses: Starter listing.
// Orange = F-06: the self-contact's initial overlaps all sit where sheets are stacked for welding, i.e. on
// these six weld edges (recomputed from the mesh after delivery: 944 on 466 points vs the solver's 942 on
// 464; 638 between the two halves of a crash box, 306 between a crash box and the beam; none elsewhere).
// Source: Bumper_Beam/report/model.json (assembly, starter.interface_parts, setup.constraints, rigid_wall);
// shared mesh points counted from Bumper_Beam_AP_meshed_0000.rad after delivery; tools/bumper_figures.py.
const W = 600
const H = 470

export default function BumperGraph({ width = W }) {
  const beam = { x: 300, y: 170, w: 470, h: 46 }
  const bw = 118
  const bh = 46
  const by = 290
  const boxes = [
    { x: 68, t: 'upper half', s: 'crash box · 0.98 kg' },
    { x: 214, t: 'lower half', s: 'crash box · 0.86 kg' },
    { x: 386, t: 'upper half', s: 'crash box · 0.98 kg' },
    { x: 532, t: 'lower half', s: 'crash box · 0.86 kg' },
  ]
  const carY = 402
  const beamBottom = beam.y + beam.h / 2
  return (
    <svg className="chart" width={width} height={(width / W) * H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Bumper connection graph: pole pushes the beam; the beam is one continuous mesh; each crash box is two halves joined by 21 spot welds and welded to the beam by 9 plus 9; a 500 kg rigid block holds the crash boxes' rear ends; the F-06 initial overlaps all sit on the six weld edges">
      {/* legend */}
      <g transform="translate(0, 10)">
        <line x1={0} x2={30} y1={6} y2={6} stroke="var(--warn-c)" strokeWidth={3} />
        <text className="lbl" x={36} y={10}>spot welds (count); orange = F-06</text>
        <line x1={262} x2={292} y1={6} y2={6} stroke="var(--muted)" strokeWidth={2.5} strokeDasharray="6 5" />
        <text className="lbl" x={298} y={10}>pushes, not glued</text>
        <line x1={428} x2={458} y1={6} y2={6} stroke="var(--accent)" strokeWidth={5} />
        <text className="lbl" x={464} y={10}>rigid link</text>
      </g>

      {/* pole */}
      <rect x={210} y={34} width={180} height={42} rx={21} fill="#e8edf1" stroke="var(--ink)" strokeWidth={1.5} />
      <text x={300} y={53} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700 }}>pole (rigid wall)</text>
      <text x={300} y={69} textAnchor="middle" className="muted" style={{ fontSize: 12.5 }}>Ø 254 mm, fixed</text>
      <line x1={300} x2={300} y1={76} y2={beam.y - beam.h / 2} stroke="var(--muted)" strokeWidth={2.5} strokeDasharray="6 5" />
      <text x={308} y={96} className="lbl muted">friction 0.2</text>

      {/* self-contact: a dashed frame around every sheet */}
      <rect x={4} y={104} width={592} height={226} rx={16} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="6 5" />
      <text x={16} y={124} className="lbl muted">self-contact over all 14 sheets, friction 0.2</text>
      <rect x={398} y={110} width={186} height={20} rx={5} fill="var(--warn-c)" />
      <text x={491} y={124} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: '#fff' }}>! F-06 942 overlaps at t = 0</text>

      {/* beam */}
      <rect x={beam.x - beam.w / 2} y={beam.y - beam.h / 2} width={beam.w} height={beam.h} rx={10} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
      <text x={beam.x} y={beam.y - 3} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700 }}>beam: 10 DP1000 parts, 1.8 mm, one mesh</text>
      <text x={beam.x} y={beam.y + 14} textAnchor="middle" className="muted" style={{ fontSize: 12.5 }}>15.39 kg (the parts share mesh points)</text>

      {/* welds: each crash-box half up to the beam (9 each), and the two halves together (21) */}
      {boxes.map((b, i) => (
        <g key={i}>
          <line x1={b.x} x2={b.x} y1={by - bh / 2} y2={beamBottom} stroke="var(--warn-c)" strokeWidth={3} />
          <text x={b.x + 7} y={(by - bh / 2 + beamBottom) / 2 + 5} className="lbl" style={{ fontWeight: 800 }}>9</text>
        </g>
      ))}
      {[[0, 1], [2, 3]].map(([a, c]) => {
        const x1 = boxes[a].x + bw / 2
        const x2 = boxes[c].x - bw / 2
        return (
          <g key={a}>
            <line x1={x1} x2={x2} y1={by} y2={by} stroke="var(--warn-c)" strokeWidth={3} />
            <text x={(x1 + x2) / 2} y={by - 7} textAnchor="middle" className="lbl" style={{ fontWeight: 800 }}>21</text>
          </g>
        )
      })}

      {boxes.map((b, i) => (
        <g key={'b' + i}>
          <rect x={b.x - bw / 2} y={by - bh / 2} width={bw} height={bh} rx={9} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
          <text x={b.x} y={by - 4} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700 }}>{b.t}</text>
          <text x={b.x} y={by + 13} textAnchor="middle" className="muted" style={{ fontSize: 12 }}>{b.s}</text>
          <line x1={b.x} x2={b.x} y1={by + bh / 2} y2={carY - 24} stroke="var(--accent)" strokeWidth={5} />
        </g>
      ))}

      {/* the car: a rigid block */}
      <rect x={30} y={carY - 24} width={540} height={50} rx={10} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.5} />
      <text x={300} y={carY - 2} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700 }}>car: a 500 kg rigid block on the crash boxes' rear ends</text>
      <text x={300} y={carY + 15} textAnchor="middle" className="muted" style={{ fontSize: 12.5 }}>moves only straight ahead, at 5 m/s</text>
      <text x={300} y={H - 22} textAnchor="middle" className="lbl muted">519.2 kg = 500 block + 15.39 beam + 3.69 crash boxes + 0.16 welds</text>
      <text x={300} y={H - 5} textAnchor="middle" className="lbl muted">78 spot welds in total; they cannot break</text>
    </svg>
  )
}
