import React from 'react'
import { Mark } from './Legend.jsx'

/**
 * A finding, always led by its id: marker, id (with the v0.1 id when it was renumbered), title in bold,
 * then the body. Karim's rule: an error or warning is explained once; a later slide only points back to it (e.g. a dimmed run-file row).
 *
 *   <F id="F-06" v01="F-04" sev="error" title="11 thin parts cannot bend properly">body</F>
 *   <F badge='"no"' sev="warning" title="...">  for a remark the report marks without an id
 */
export function F({ id, v01, sev = 'error', badge, title, children }) {
  return (
    <div className="fi">
      <Mark sev={sev} />
      <div className="ft">
        {id && (
          <span className={`fid ${sev}`}>
            {id}{v01 && <span className="v"> (v0) / {v01} (v0.1)</span>}
          </span>
        )}
        {!id && badge && <span className={`fid ${sev}`}>{badge}</span>}{' '}
        {title}
      </div>
      {children && <div className="fb">{children}</div>}
    </div>
  )
}

/** A list of findings with even spacing. */
export function Fis({ children, style }) {
  return <div className="fis" style={style}>{children}</div>
}

/** A discreet pointer back to where a finding was already explained (unused at the moment). */
export function Seen({ id, sev = 'error', where, children }) {
  return (
    <span className="seen">
      <Mark sev={sev} /><b>{id}</b>{children ? <> {children}</> : null}{where && <> · already met on {where}</>}
    </span>
  )
}

/** Plain question -> answer pairs (unused since the Engineering slide moved to <Views>). */
export function QA({ items }) {
  return (
    <div className="qa2">
      {items.map(({ q, a, tag, tone }) => (
        <div key={q}>
          <div className="q">{q}</div>
          <div className="a">{tag && <span className={tone || 'no'}>{tag} </span>}{a}</div>
        </div>
      ))}
    </div>
  )
}
