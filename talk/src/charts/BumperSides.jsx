import React from 'react'
import data from '../data/bumper.json'

// Left vs right in v0.1, a mirror-image model. Left panel: top view at 0 ms (grey) and 100 ms, pole at the
// top, driver's left on the left; dots = the 65 torn elements (shells the solver deleted once their stretch reached the
// tear limit of /FAIL/BIQUAD, F-03), drawn where they are at 100 ms and coloured by the half of the bumper each one STARTED
// in (tools/bumper_figures.py: side of the centre line at 0 ms). By 100 ms the apex has slid right, so most of the
// left-half pieces sit just right of the pole's line: the colour, not the position, tells the halves apart. Right panel:
// how much each crash box has shortened over time (frames every 4 ms). Source: tools/bumper_figures.py.
const T = data.top
const C = data.crush
const TORN_L = 'var(--series-3)' // violet: pieces from the left half
const TORN_R = 'var(--err)' // red: pieces from the right half
const tearsL = T.tears.filter((t) => t.side === 'L').length
const tearsR = T.tears.length - tearsL

function TopView({ x0, w, h }) {
  const ymin = -1030
  const ymax = 1030
  const xmin = -305
  const s = w / (ymax - ymin) // px per mm
  const P = ([y, x]) => `${(x0 + (y - ymin) * s).toFixed(1)},${(22 + (x - xmin) * s).toFixed(1)}`
  const poly = (pts) => pts.map(P).join(' ')
  const band = (t) => poly([...t.front, ...[...t.rear].reverse()])
  const cx = x0 + (T.pole.y - ymin) * s
  const cy = 22 + (T.pole.x - xmin) * s
  const ty = (yx) => 22 + (yx[1] - xmin) * s
  const tx = (yx) => x0 + (yx[0] - ymin) * s
  // the tears near the pole, left and right of the apex (82 % of them sit within 150 mm of the pole line)
  const mid = (side) => {
    const pts = T.tears.filter((t) => t.side === side && Math.abs(t.yx[0]) < 200).map((t) => t.yx)
    return [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length]
  }
  const apexL = mid('L')
  const apexR = mid('R')
  return (
    <g>
      <text className="ttl" x={x0} y={12}>Seen from above: the start in grey, 100 ms in colour</text>
      <circle cx={cx} cy={cy} r={T.pole.r * s} fill="#e8edf1" stroke="var(--muted)" strokeWidth={1} />
      <polygon points={band(T.t0)} fill="#eef2f5" stroke="#c5ced6" strokeWidth={1} />
      <polygon points={poly(T.t0.boxL)} fill="#eef2f5" stroke="#c5ced6" strokeWidth={1} />
      <polygon points={poly(T.t0.boxR)} fill="#eef2f5" stroke="#c5ced6" strokeWidth={1} />
      <polygon points={band(T.t100)} fill="#5b84b1" stroke="#3f6690" strokeWidth={0.8} strokeLinejoin="round" />
      <polygon points={poly(T.t100.boxL)} fill="var(--series-2)" stroke="#fff" strokeWidth={0.8} />
      <polygon points={poly(T.t100.boxR)} fill="var(--rest)" stroke="#fff" strokeWidth={0.8} />
      {T.tears.map((t, i) => (
        <circle key={i} cx={tx(t.yx)} cy={ty(t.yx)} r={1.9} fill={t.side === 'L' ? TORN_L : TORN_R} stroke="#fff" strokeWidth={0.5}>
          <title>{`torn at ${t.t} ms, ${t.part} (from the ${t.side === 'L' ? 'left' : 'right'} half)`}</title>
        </circle>
      ))}
      <text className="lbl" x={cx - 30} y={h - 2} textAnchor="end"><tspan style={{ fontWeight: 700, fill: TORN_L }}>{tearsL} torn</tspan> from the left half</text>
      <text className="lbl" x={cx + 30} y={h - 2}><tspan style={{ fontWeight: 700, fill: TORN_R }}>{tearsR} torn</tspan> from the right half</text>
      <line x1={cx - 36} y1={h - 15} x2={tx(apexL) - 1} y2={ty(apexL) + 3} stroke={TORN_L} strokeWidth={1.2} />
      <line x1={cx + 36} y1={h - 15} x2={tx(apexR) + 1} y2={ty(apexR) + 3} stroke={TORN_R} strokeWidth={1.2} />
    </g>
  )
}

function Crush({ x0, w, h }) {
  const left = x0 + 40
  const top = 22
  const plotW = w - 40 - 62
  const plotH = h - top - 36
  const X = (t) => left + (t / 100) * plotW
  const Y = (mm) => top + plotH - (mm / 30) * plotH
  const line = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${X(C.t[i]).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const nL = C.L[C.L.length - 1]
  const nR = C.R[C.R.length - 1]
  return (
    <g>
      <text className="ttl" x={x0} y={12}>How much each crash box folds</text>
      <text className="lbl muted" transform={`translate(${x0 + 9}, ${top + plotH / 2}) rotate(-90)`} textAnchor="middle"
        style={{ fontSize: 11.5 }}>shortening (mm)</text>
      <text className="lbl muted" x={left + plotW / 2} y={h - 2} textAnchor="middle" style={{ fontSize: 11.5 }}>time (ms)</text>
      {[0, 10, 20, 30].map((v) => (
        <g key={v}>
          <line className={v === 0 ? 'axis' : 'grid'} x1={left} x2={left + plotW} y1={Y(v)} y2={Y(v)} />
          <text className="lbl muted" x={left - 5} y={Y(v) + 4} textAnchor="end">{v}</text>
        </g>
      ))}
      {[0, 50, 100].map((t) => (
        <text key={t} className="lbl muted" x={X(t)} y={top + plotH + 15} textAnchor="middle">{t}</text>
      ))}
      <line x1={X(36)} x2={X(36)} y1={top} y2={Y(0)} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
      <text className="lbl muted" x={X(36) - 4} y={top + 10} textAnchor="end" style={{ fontSize: 11.5 }}>split</text>
      <text className="lbl muted" x={X(36) - 4} y={top + 23} textAnchor="end" style={{ fontSize: 11.5 }}>at 36 ms</text>
      <path d={line(C.R)} fill="none" stroke="var(--rest)" strokeWidth={2} />
      <path d={line(C.L)} fill="none" stroke="var(--series-2)" strokeWidth={2.5} />
      <text className="val" x={X(100) + 5} y={Y(nL) + 4}>left {nL}</text>
      <text className="val" x={X(100) + 5} y={Y(nR) + 4} fill="var(--muted)">right {nR}</text>
      {C.t.map((t, i) => (
        <g className="mark" key={t}>
          <title>{`${t} ms: left ${C.L[i]} mm, right ${C.R[i]} mm`}</title>
          <rect className="hit" x={X(t) - 4} y={top} width={8} height={plotH} />
        </g>
      ))}
    </g>
  )
}

export default function BumperSides({ width = 600, height = 196 }) {
  const split = 372
  return (
    <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Mirror-image model, not a mirror-image result: the left crash box shortens ${C.L[C.L.length - 1]} mm, the right ${C.R[C.R.length - 1]} mm; ${tearsL} torn elements from the left half, ${tearsR} from the right half`}>
      <TopView x0={0} w={split - 14} h={height} />
      <Crush x0={split + 6} w={width - split - 6} h={height} />
    </svg>
  )
}
