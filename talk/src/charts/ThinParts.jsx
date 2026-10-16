import React from 'react'
import { thinParts } from '../data/numbers.js'
import { Mark } from '../components'

// The 11 thin parts of the phone (F-06), with the report's screening ratio next to the real layer count.
export default function ThinParts() {
  return (
    <table className="tb thin">
      <thead>
        <tr>
          <th>parts</th><th>element</th><th className="num">mm</th>
          <th className="num">thickness<br />/ edge</th><th className="num">layers</th><th>what bends it</th>
        </tr>
      </thead>
      <tbody>
        {thinParts.map((r) => (
          <tr key={r.parts} className={r.bad ? 'bad' : ''}>
            <td><b>{r.parts}</b></td><td>{r.elem}</td><td className="num">{r.t}</td>
            <td className="num">{r.ratio}</td><td className="num"><b>{r.layers}</b></td>
            <td>{r.bad && <><Mark sev="error" />{" "}</>}{r.bend}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
