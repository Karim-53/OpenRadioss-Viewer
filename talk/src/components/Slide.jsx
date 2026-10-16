import React from 'react'

/**
 * One reveal.js slide. The layout lives in an inner .frame (640 x 720, flex column), so reveal can
 * keep controlling the <section>'s display. `notes` become the speaker notes (press S); `cue` is the
 * timing line shown first, e.g. "~2 min · at 12:30"; `src` (the deliverable files a number comes from)
 * goes to the notes too, so the half-width slide stays clean. `uncounted` keeps a backup slide out of
 * the n/total count.
 */
export function Slide({ children, notes, cue, src, frame = '', state, id, bg, uncounted = false }) {
  return (
    <section data-state={state} id={id} data-background-color={bg} data-visibility={uncounted ? 'uncounted' : undefined}>
      <div className={`frame ${frame}`}>{children}</div>
      {(notes || cue || src) && (
        <aside className="notes">
          {cue && <p><b>{cue}</b></p>}
          {typeof notes === 'string' ? <p>{notes}</p> : notes}
          {src && <p><i>Sources: {src}</i></p>}
        </aside>
      )}
    </section>
  )
}

/** A vertical stack (reveal: ↓ inside one column). */
export function Stack({ children }) {
  return <section>{children}</section>
}

/** Kicker (which page of the live report to show next to the slide) + a title that states the point. */
export function Head({ kicker, title, size }) {
  return (
    <div className="head">
      {kicker && <div className="kicker">{kicker}</div>}
      <h2 className={`title ${size || ''}`}>{title}</h2>
    </div>
  )
}

/** A few short lines of what matters. */
export function Say({ children, tight, plain, style }) {
  return <div className={`say ${tight ? 'tight' : ''} ${plain ? 'plain' : ''}`} style={style}>{children}</div>
}

/** A small source line pinned to the bottom-left of the slide (kept for the backup slides). */
export function Src({ children }) {
  return <div className="src">{children}</div>
}
