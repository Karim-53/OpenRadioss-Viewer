import React from 'react'

const GLYPH = { error: '✕', warning: '!', info: 'i', fixed: '✓' }
const MEANING = {
  error: ['error', 'a number from this run would be wrong or missing'],
  warning: ['warning', 'it would mislead'],
  info: ['note', 'worth knowing before editing the deck'],
  fixed: ['fixed in v0.1', 'hover shows the exact edit'],
}

/** The report's inline severity badge. */
export function Mark({ sev = 'error' }) {
  return <span className={`mk ${sev}`}>{GLYPH[sev]}</span>
}

/** The ✕ / ! / i / ✓ key. `short` drops the explanations. */
export function Legend({ items = ['error', 'warning', 'info'], short = false, stack = false }) {
  return (
    <div className={`legend ${stack ? 'stack' : ''}`}>
      {items.map((k) => (
        <span className="it" key={k}>
          <Mark sev={k} />
          <b>{MEANING[k][0]}</b>
          {!short && <span>= {MEANING[k][1]}</span>}
        </span>
      ))}
    </div>
  )
}
