import React from 'react'

// The lines of a run file (_0001.rad) that matter, as they are in the deck, each tagged with its finding.
// lines: [{ code: '/RUN/...', sev: 'error'|'warning'|'info'|'seen'|undefined, tag: 'F-01', note: '0.1 ms' }]
const GLYPH = { error: '✕', warning: '!', info: 'i', seen: '✕', fixed: '✓' }

export default function RunFile({ lines, title }) {
  return (
    <div className="runfile">
      {title && <div className="rf-title">{title}</div>}
      {lines.map((l, i) => (
        <div className={`rf-line ${l.sev || ''} ${l.missing ? 'missing' : ''}`} key={i}>
          <span className="rf-code">{l.code}</span>
          {l.tag && (
            <span className={`rf-tag ${l.sev || ''}`}>
              <span className="g">{GLYPH[l.sev] || ''}</span> <b>{l.tag}</b>{l.note && <> · {l.note}</>}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
