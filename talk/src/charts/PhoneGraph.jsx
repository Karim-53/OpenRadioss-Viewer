import React from 'react'

// How the phone's 17 parts hold together (v0), drawn as a graph instead of the report's interface table.
// Solid line = glue (/INTER/TYPE2 tie); dashed line = pushes but is not glued (the floor, a rigid wall with
// friction 0.3); red box with no line = attached to nothing (F-04). Masses: Starter listing, in grams.
// Source: Cell_Phone_Drop/report/model.json (assembly mass_starter, starter.interface_parts, unattached_parts, rigid_wall).
const W = 600
const H = 392

const BOX = {
  bottom_pcb: { x: 300, y: 62, t: 'bottom board', g: '2.31 g' },
  small: { x: 486, y: 62, t: '7 small parts', g: 'chips, connectors · 0.40 g', w: 172 },
  top_pcb: { x: 300, y: 122, t: 'top board', g: '2.31 g' },
  chips: { x: 486, y: 122, t: '2 micro-chips', g: '0.07 g', w: 168 },
  camera_conn: { x: 300, y: 182, t: 'camera connector', g: '0.56 g' },
  camera: { x: 300, y: 242, t: 'camera', g: '3.14 g' },
  cover: { x: 300, y: 302, t: 'rear cover', g: '4.66 g' },
  screen: { x: 112, y: 302, t: 'screen (glass)', g: '7.00 g' },
  battery: { x: 112, y: 92, t: 'battery', g: '4.47 g', loose: true },
  ic_02: { x: 112, y: 182, t: 'ic_02 (chip)', g: '2.11 g', loose: true },
}
const TIES = [
  ['bottom_pcb', 'small'], ['bottom_pcb', 'top_pcb'], ['top_pcb', 'chips'], ['top_pcb', 'camera_conn'],
  ['camera_conn', 'camera'], ['camera', 'cover'], ['screen', 'cover'],
]
const BW = 140
const BH = 44

function Box({ b }) {
  const w = b.w || BW
  const x = b.x - w / 2
  const y = b.y - BH / 2
  return (
    <g>
      <rect x={x} y={y} width={w} height={BH} rx={9}
        fill={b.loose ? 'var(--err-soft)' : '#fff'} stroke={b.loose ? 'var(--err)' : 'var(--ink)'} strokeWidth={b.loose ? 2 : 1.5} />
      <text x={b.x} y={b.y - 4} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: b.loose ? 'var(--err)' : 'var(--ink)' }}>{b.t}</text>
      <text x={b.x} y={b.y + 14} textAnchor="middle" className="muted" style={{ fontSize: 12.5 }}>{b.g}</text>
      {b.loose && (
        <g>
          <rect x={x + w - 58} y={y - 22} width={58} height={19} rx={5} fill="var(--err)" />
          <text x={x + w - 29} y={y - 8} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: '#fff' }}>✕ F-04</text>
        </g>
      )}
    </g>
  )
}

function edge(a, b) {
  const A = BOX[a]
  const B = BOX[b]
  if (A.y === B.y) {
    const [l, r] = A.x < B.x ? [A, B] : [B, A]
    return { x1: l.x + (l.w || BW) / 2, y1: l.y, x2: r.x - (r.w || BW) / 2, y2: r.y }
  }
  const [t, u] = A.y < B.y ? [A, B] : [B, A]
  return { x1: t.x, y1: t.y + BH / 2, x2: u.x, y2: u.y - BH / 2 }
}

export default function PhoneGraph({ width = W }) {
  const floorY = 350
  return (
    <svg className="chart" width={width} height={(width / W) * H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Phone connection graph: a chain of glued parts from the rear cover through the camera to the two boards; battery and ic_02 attached to nothing; the floor pushes the cover and screen">
      {/* legend */}
      <g transform="translate(0, 10)">
        <line x1={0} x2={30} y1={6} y2={6} stroke="var(--ink)" strokeWidth={2.5} />
        <text className="lbl" x={36} y={10}>glued (tie)</text>
        <line x1={128} x2={158} y1={6} y2={6} stroke="var(--muted)" strokeWidth={2.5} strokeDasharray="6 5" />
        <text className="lbl" x={164} y={10}>pushes, not glued</text>
        <rect x={300} y={-1} width={16} height={14} rx={3} fill="var(--err-soft)" stroke="var(--err)" strokeWidth={1.5} />
        <text className="lbl" x={322} y={10}>attached to nothing</text>
      </g>
      {TIES.map(([a, b]) => {
        const e = edge(a, b)
        return <line key={a + b} {...e} stroke="var(--ink)" strokeWidth={2.5} />
      })}
      {/* the floor pushes the two outer parts it can reach: dashed, with its friction */}
      {['cover', 'screen'].map((k) => (
        <line key={k} x1={BOX[k].x} x2={BOX[k].x} y1={BOX[k].y + BH / 2} y2={floorY} stroke="var(--muted)" strokeWidth={2.5} strokeDasharray="6 5" />
      ))}
      <text className="lbl muted" x={BOX.cover.x + 8} y={floorY - 12}>friction 0.3</text>
      <text className="lbl muted" x={BOX.screen.x + 8} y={floorY - 12}>friction 0.3</text>
      {Object.entries(BOX).map(([k, b]) => <Box key={k} b={b} />)}
      {/* the floor: a rigid wall, at the bottom, with its warning */}
      <rect x={20} y={floorY} width={560} height={34} rx={8} fill="#e8edf1" stroke="var(--warn-c)" strokeWidth={1.5} />
      <text x={36} y={floorY + 22} style={{ fontSize: 14, fontWeight: 700 }}>floor (rigid wall)</text>
      <rect x={416} y={floorY + 7} width={154} height={20} rx={5} fill="var(--warn-c)" />
      <text x={493} y={floorY + 21} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: '#fff' }}>! F-11 sees 32.6 mm</text>
    </svg>
  )
}
