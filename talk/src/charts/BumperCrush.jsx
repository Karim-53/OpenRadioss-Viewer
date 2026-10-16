import React from 'react'
import data from '../data/bumper.json'

// Force vs crush, the classic crash curve: the pole's push on the car (kN) against how far the car has
// moved into the pole (mm), v0 (grey) vs v0.1 (teal), one point per ms. Force = rate of change of the
// model's X-momentum over a centred 1 ms window (the same force as the F-01 chart on the run-settings slide);
// travel = its centre of mass. Up to the furthest point the area under each curve is 6,491 J, the impact
// energy (tools/bumper_figures.py asserts it). The dots mark the four moments the script finds on each
// curve: first contact, peak, minimum, rebound (speed 0). v0 is drawn up to its rebound only (it then moves back a few
// mm; the label says so): a tail after the dot read as an arrow on the earlier version.
const { v0, 'v0.1': v1 } = data.curves

export default function BumperCrush({ width = 600, height = 304 }) {
  const left = 52
  const right = 12
  const top = 40
  const bottom = 42
  const plotW = width - left - right
  const plotH = height - top - bottom
  const X = (mm) => left + (mm / 260) * plotW
  const Y = (kN) => top + plotH - (kN / 60) * plotH
  const pts = (c, a, b) => c.travel.slice(a, b).map((x, i) => [X(x), Y(c.force[a + i])])
  const path = (p) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const at = (c, i) => [X(c.travel[i]), Y(c.force[i])]
  const e0 = v0.events
  const e1 = v1.events
  const contact = [X(e1.contact.travel), Y(0)]
  const peak = at(v1, e1.peak.i)
  const min0 = at(v0, e0.min.i)
  const min1 = at(v1, e1.min.i)
  const reb0 = at(v0, e0.rebound.i)
  const reb1 = at(v1, e1.rebound.i)
  const kN = (c, i) => Math.round(c.force[i])
  // a dot on one curve, or a teal dot ringed in grey where both curves share the moment
  const Dot = ({ p, run }) => (
    run === 'both'
      ? <g><circle cx={p[0]} cy={p[1]} r={6} fill="var(--neutral)" /><circle cx={p[0]} cy={p[1]} r={3.6} fill="var(--series-1)" stroke="#fff" strokeWidth={1} /></g>
      : <circle cx={p[0]} cy={p[1]} r={4.6} fill={run === 'v0' ? 'var(--rest)' : 'var(--series-1)'} stroke="#fff" strokeWidth={1.3} />
  )
  return (
    <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Pole force against car travel. Both runs: first contact at ${e1.contact.t} ms, peak ${kN(v1, e1.peak.i)} kN at 4 ms. Minimum: v0 ${kN(v0, e0.min.i)} kN, v0.1 ${kN(v1, e1.min.i)} kN at 23 ms. Rebound at speed 0: v0 at 206 mm and 82.5 ms, then moves back a few mm; v0.1 at 249 mm and 95.6 ms. Both areas equal the 6,491 J impact energy`}>
      <defs>
        <marker id="bcArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ink)" />
        </marker>
      </defs>
      {/* legend */}
      <g transform="translate(0, 4)">
        <line x1={left} x2={left + 22} y1={8} y2={8} stroke="var(--neutral)" strokeWidth={2.5} />
        <text className="lbl muted" x={left + 28} y={12}>v0: nothing tears</text>
        <line x1={left + 150} x2={left + 172} y1={8} y2={8} stroke="var(--series-1)" strokeWidth={2.5} />
        <text className="lbl muted" x={left + 178} y={12}>v0.1: 65 elements tear (F-03 fixed)</text>
      </g>
      {/* axes */}
      {[0, 20, 40, 60].map((t) => (
        <g key={t}>
          <line className={t === 0 ? 'axis' : 'grid'} x1={left} x2={left + plotW} y1={Y(t)} y2={Y(t)} />
          <text className="lbl muted" x={left - 6} y={Y(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
      {[0, 50, 100, 150, 200, 250].map((m) => (
        <text key={m} className="lbl muted" x={X(m)} y={top + plotH + 16} textAnchor="middle">{m}</text>
      ))}
      <text className="lbl" transform={`translate(13, ${top + plotH / 2}) rotate(-90)`} textAnchor="middle"
        style={{ fontSize: 12.5, fontWeight: 600 }}>force of the pole on the car (kN)</text>
      <text className="lbl" x={left + plotW / 2} y={height - 4} textAnchor="middle"
        style={{ fontSize: 12.5, fontWeight: 600 }}>how far the car has moved into the pole (mm)</text>

      {/* curves: v0 up to its rebound */}
      <path d={path(pts(v0, 0, e0.rebound.i + 1))} fill="none" stroke="var(--neutral)" strokeWidth={2} strokeLinejoin="round" />
      <path d={path(pts(v1, 0, v1.t.length))} fill="none" stroke="var(--series-1)" strokeWidth={2.5} strokeLinejoin="round" />

      {/* 1 · first contact (both runs) */}
      <Dot p={contact} run="both" />
      <text className="lbl" x={contact[0] + 10} y={contact[1] - 7}>
        <tspan style={{ fontWeight: 700 }}>first contact</tspan>, {e1.contact.t} ms (both)
      </text>

      {/* 2 · peak (both runs) */}
      <Dot p={peak} run="both" />
      <text className="lbl" x={peak[0] + 10} y={peak[1] - 6}>
        <tspan style={{ fontWeight: 700 }}>peak {kN(v1, e1.peak.i)} kN</tspan>, {v1.t[e1.peak.i]} ms (both): the beam hits the pole
      </text>

      {/* 3 · minimum: the walls have buckled */}
      <Dot p={min0} run="v0" />
      <line x1={min0[0]} x2={min0[0]} y1={Y(30.2)} y2={min0[1] - 6} stroke="var(--ink)" strokeWidth={1} />
      <text className="lbl" x={min0[0]} y={Y(31)} textAnchor="middle" style={{ fill: 'var(--rest)' }}>
        <tspan style={{ fontWeight: 700 }}>min {kN(v0, e0.min.i)} kN</tspan>, {v0.t[e0.min.i]} ms
      </text>
      <Dot p={min1} run="v0.1" />
      <text className="lbl" x={min1[0] + 9} y={min1[1] + 19} style={{ fill: 'var(--series-1)' }}>
        <tspan style={{ fontWeight: 700 }}>min {kN(v1, e1.min.i)} kN</tspan>, {v1.t[e1.min.i]} ms: the walls have buckled
      </text>

      {/* 4 · rebound, speed 0: dark leaders, so they never read as part of a curve */}
      <Dot p={reb0} run="v0" />
      <text className="lbl" x={X(190)} y={Y(46.4)} textAnchor="end"><tspan style={{ fontWeight: 700 }}>v0 rebound</tspan> (v = 0):</text>
      <text className="lbl" x={X(190)} y={Y(42)} textAnchor="end"><tspan style={{ fontWeight: 700 }}>206 mm</tspan>, {e0.rebound.t} ms, then back</text>
      <line x1={X(191)} y1={Y(43)} x2={reb0[0] - 4} y2={reb0[1] - 5} stroke="var(--ink)" strokeWidth={1.3} markerEnd="url(#bcArrow)" />
      <Dot p={reb1} run="v0.1" />
      <text className="lbl" x={X(259)} y={Y(57)} textAnchor="end"><tspan style={{ fontWeight: 700 }}>v0.1 rebound</tspan> (v = 0):</text>
      <text className="lbl" x={X(259)} y={Y(52.6)} textAnchor="end"><tspan style={{ fontWeight: 700 }}>249 mm</tspan>, {e1.rebound.t} ms</text>
      <line x1={X(252)} y1={Y(51)} x2={reb1[0]} y2={reb1[1] - 7} stroke="var(--ink)" strokeWidth={1.3} markerEnd="url(#bcArrow)" />
    </svg>
  )
}
