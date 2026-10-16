import React from 'react'

// F-06 in one picture. Left: a single one-point brick under bending - the top face is squeezed, the bottom
// face stretched, but its only check point sits in the middle where bending stretches nothing, so the element
// offers no resistance (the hourglass effect; drawn after the classic one-element hourglassing figure).
// Right: the recommended fix, a shell, checks the stress at five points through the thickness, so the points
// near the two faces feel the bending.
const W = 600
const H = 232

export default function BendFigure({ width = W }) {
  return (
    <svg className="chart" width={width} height={(width / W) * H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Left: one brick bent into a trapezoid, its single centre check point sees no strain (hourglass effect). Right: a shell with five check points through the thickness feels the bending.">
      <defs>
        <marker id="bfArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ink)" />
        </marker>
      </defs>

      {/* ---- left: one element across ---- */}
      <text x={0} y={15} style={{ fontSize: 14, fontWeight: 700 }}>Today: one brick across the board</text>
      <rect x={72} y={52} width={146} height={96} fill="none" stroke="var(--neutral)" strokeWidth={1.5} />
      <path d="M90,52 L200,52 L236,148 L54,148 Z" fill="rgba(37, 99, 235, 0.08)" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" />
      <line x1={63} x2={227} y1={100} y2={100} stroke="#2563eb" strokeWidth={1.2} strokeDasharray="5 4" />
      <line x1={145} x2={145} y1={52} y2={148} stroke="#2563eb" strokeWidth={1.2} strokeDasharray="5 4" />
      <path d="M145,100 h10 v-10" fill="none" stroke="var(--ink)" strokeWidth={1.2} />
      <circle cx={145} cy={100} r={6} fill="var(--err)" />
      {/* bending moments */}
      <path d="M38,132 C22,112 24,86 40,66" fill="none" stroke="var(--ink)" strokeWidth={2} markerEnd="url(#bfArrow)" />
      <path d="M252,132 C268,112 266,86 250,66" fill="none" stroke="var(--ink)" strokeWidth={2} markerEnd="url(#bfArrow)" />
      <text x={14} y={104} style={{ fontSize: 13, fontWeight: 700 }}>M</text>
      <text x={266} y={104} style={{ fontSize: 13, fontWeight: 700 }}>M</text>
      <text x={145} y={44} textAnchor="middle" className="lbl" style={{ fontWeight: 600 }}>top face squeezed</text>
      <text x={145} y={166} textAnchor="middle" className="lbl" style={{ fontWeight: 600 }}>bottom face stretched</text>
      <text x={0} y={190} className="lbl">Its only check point (<tspan style={{ fill: 'var(--err)', fontWeight: 800 }}>●</tspan>) is in the middle,</text>
      <text x={0} y={207} className="lbl">where bending stretches nothing: no resistance.</text>
      <text x={0} y={226} style={{ fontSize: 14, fontWeight: 800, fill: 'var(--err)' }}>= the hourglass effect</text>

      {/* ---- right: the fix, a shell ---- */}
      <line x1={300} x2={300} y1={6} y2={H - 6} stroke="var(--line)" strokeWidth={1} />
      <text x={318} y={15} style={{ fontSize: 14, fontWeight: 700 }}>Fix ★: re-mesh it as a shell</text>
      <path d="M326,58 Q458,118 590,58 L590,98 Q458,158 326,98 Z" fill="#eef2f5" stroke="var(--ink)" strokeWidth={1.5} />
      {/* the five check points through the thickness at mid-span (faces at y=88 and y=128 there) */}
      {[92, 100, 108, 116, 124].map((y, i) => (
        <circle key={y} cx={458} cy={y} r={4.2}
          fill={i === 0 || i === 1 ? 'var(--series-2)' : i === 2 ? 'var(--neutral)' : 'var(--series-1)'} />
      ))}
      <path d="M470,92 h8 M470,124 h8 M474,92 v32" fill="none" stroke="var(--ink)" strokeWidth={1.2} />
      <text x={484} y={101} className="lbl" style={{ fontWeight: 600, fontSize: 12 }}>two faces,</text>
      <text x={484} y={114} className="lbl" style={{ fontWeight: 600, fontSize: 12 }}>0.4 mm apart</text>
      <text x={458} y={76} textAnchor="middle" className="lbl" style={{ fill: 'var(--series-2)', fontWeight: 700 }}>squeezed</text>
      <text x={458} y={148} textAnchor="middle" className="lbl" style={{ fill: 'var(--series-1)', fontWeight: 700 }}>stretched</text>
      <text x={318} y={190} className="lbl">5 check points through the thickness: the</text>
      <text x={318} y={207} className="lbl">outer ones feel the squeeze and the stretch.</text>
      <text x={318} y={226} style={{ fontSize: 14, fontWeight: 800, fill: 'var(--accent)' }}>Bends correctly with one layer, and cheaper</text>
    </svg>
  )
}
