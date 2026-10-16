import React from 'react'

/** A headline number with its label. tone: '' | 'bad' | 'warn' | 'ok' */
export function Stat({ n, l, tone = '', big = false }) {
  return (
    <div className={`stat2 ${tone} ${big ? 'big' : ''}`}>
      <div className="n">{n}</div>
      <div className="l">{l}</div>
    </div>
  )
}

/** A grid of Stat tiles. */
export function Stats({ cols = 2, children, style }) {
  return (
    <div className="stats" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, ...style }}>
      {children}
    </div>
  )
}

/** A boxed remark. tone: '' (teal) | 'warn' | 'bad' | 'plain' */
export function Callout({ title, tone = '', children, style }) {
  return (
    <div className={`cal ${tone}`} style={style}>
      {title && <div className="ct">{title}</div>}
      <div className="cb">{children}</div>
    </div>
  )
}

/** One of the report's videos; reveal starts it when the slide opens (data-autoplay).
 *  `poster` (a still in public/media) shows if autoplay does not start (file://, power saving, projector switch). */
export function Video({ src, width = 480, caption, poster }) {
  return (
    <figure className="vid" style={{ width }}>
      <video src={`media/${src}`} poster={poster ? `media/${poster}` : undefined} width={width}
        muted loop playsInline controls data-autoplay="" preload="auto" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

/** "more details:" and a rule: what sits below it stays on the slide but is not presented (cut for time). */
export function More({ style }) {
  return <div className="more" style={style}><span>more details:</span></div>
}

/**
 * One switch, three views of each item: the picture · what I need to know · the full table.
 * items: [{ q, visual, know, table }]. The buttons never take the focus, so Space still advances the deck.
 */
const VIEWS = [['visual', 'Visual'], ['know', 'What I need to know'], ['table', 'Table']]
export function Views({ items, initial = 'visual' }) {
  const [mode, setMode] = React.useState(initial)
  return (
    <div className="views">
      <div className="vw-switch" role="tablist">
        {VIEWS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''}
            onMouseDown={(e) => e.preventDefault()} onClick={() => setMode(k)}>{label}</button>
        ))}
      </div>
      <div className={`vw-items ${mode}`}>
        {items.map((it) => (
          <div className="vw-it" key={it.q}>
            <div className="vw-q">{it.q}</div>
            <div className="vw-a">{it[mode]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A numbered card (related work, future work, ...). */
export function Card({ n, title, children, meta, style }) {
  return (
    <div className="card2" style={style}>
      <div className="t">{n != null && <span className="n">{n}</span>}{title}</div>
      {children && <div className="d">{children}</div>}
      {meta && <div className="m">{meta}</div>}
    </div>
  )
}
