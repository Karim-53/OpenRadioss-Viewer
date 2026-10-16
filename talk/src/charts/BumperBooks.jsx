import React from 'react'
import { bumperBooks } from '../data/numbers.js'
import { roundedTop } from './PartShares.jsx'

// Grouped columns: energy missing from the solver's error sum vs the contact-energy channel (J, at 100 ms).
export default function BumperBooks({ width = 600, height = 300 }) {
  const left = 40
  const top = 56
  const bottom = 58
  const plotH = height - top - bottom
  const max = 90
  const y = (v) => top + plotH - (v / max) * plotH
  const slot = (width - left) / bumperBooks.length
  const bw = 34
  const ticks = [0, 30, 60, 90]
  return (
    <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="Missing energy equals contact energy in every bumper run">
      <text className="ttl" x={0} y={12}>Energy at 100 ms (J), out of 6,490 J of impact energy</text>
      <g transform={`translate(${left}, 24)`}>
        <rect x={0} y={0} width={12} height={12} rx={3} fill="var(--series-1)" /><text className="lbl muted" x={18} y={11}>missing from the error sum</text>
        <rect x={210} y={0} width={12} height={12} rx={3} fill="var(--series-2)" /><text className="lbl muted" x={228} y={11}>contact channel (T01, mostly friction)</text>
      </g>
      {ticks.map((t) => (
        <g key={t}>
          <line className={t === 0 ? 'axis' : 'grid'} x1={left} x2={width} y1={y(t)} y2={y(t)} />
          <text className="lbl muted" x={left - 8} y={y(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
      {bumperBooks.map((d, i) => {
        const cx = left + slot * i + slot / 2
        const a = cx - bw - 4
        const b = cx + 4
        return (
          <g className="mark" key={d.run}>
            <title>{`${d.run}: missing ${d.missing} J, contact ${d.contact} J, energy error ${d.err}`}</title>
            <rect className="hit" x={cx - slot / 2} y={top} width={slot} height={plotH} />
            <path className="bar" d={roundedTop(a, y(d.missing), bw, y(0) - y(d.missing), 4)} fill="var(--series-1)" />
            <path className="bar" d={roundedTop(b, y(d.contact), bw, y(0) - y(d.contact), 4)} fill="var(--series-2)" />
            <text className="val" x={a + bw / 2} y={y(d.missing) - 6} textAnchor="middle" style={{ fontSize: 14 }}>{d.missing}</text>
            <text className="val" x={b + bw / 2} y={y(d.contact) - 6} textAnchor="middle" style={{ fontSize: 14 }}>{d.contact}</text>
            <text className="lbl" x={cx} y={height - 36} textAnchor="middle" style={{ fontWeight: 600 }}>{d.run}</text>
            <text className="lbl muted" x={cx} y={height - 16} textAnchor="middle">error {d.err}</text>
          </g>
        )
      })}
    </svg>
  )
}
