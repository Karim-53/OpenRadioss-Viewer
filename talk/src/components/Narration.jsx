import React, { useEffect, useRef, useState } from 'react'
import NARRATION from '../data/narration.json'

// The voice-over. narration.json lists one or more versions (e.g. a short phone-only version and the
// full talk); each version is one audio clip per slide it covers. Press play once: each clip plays with
// its slide and the deck moves on when the clip ends. Navigating by hand while it plays (arrows,
// clicker, overview) switches to that slide's clip; a slide outside the version stops the playback.

const key = (h, v) => `${h}-${v}`
const VERSIONS = (NARRATION.versions || []).map((ver) => ({
  ...ver,
  index: new Map(ver.slides.map((c, i) => [key(c.h, c.v), i])),
  total: ver.slides.reduce((s, c) => s + c.dur, 0),
}))

const fmt = (s) => {
  s = Math.max(0, Math.round(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Narration({ deck }) {
  const audio = useRef(null)
  const playing = useRef(false)
  const verRef = useRef(VERSIONS[0])
  const [verId, setVerId] = useState(VERSIONS[0] && VERSIONS[0].id)
  const [state, setState] = useState({ on: false, i: 0, t: 0 })
  const ver = VERSIONS.find((x) => x.id === verId) || VERSIONS[0]
  verRef.current = ver

  const current = () => {
    const { h, v } = deck.getIndices()
    const V = verRef.current
    return V && V.index.has(key(h, v)) ? V.index.get(key(h, v)) : -1
  }

  const stop = () => {
    if (audio.current) audio.current.pause()
    playing.current = false
    setState((s) => ({ ...s, on: false }))
  }

  const load = (i, autoplay) => {
    const a = audio.current
    if (i < 0) return stop()
    const file = verRef.current.slides[i].file
    if (!a.src.endsWith(file)) a.src = file
    setState((s) => ({ ...s, i }))
    // blocked by the browser (no click yet): show Play again, not Pause. A clip swapped mid-load (AbortError) is fine.
    if (autoplay) a.play().catch((e) => { if (e && e.name === 'NotAllowedError') stop() })
    return undefined
  }

  useEffect(() => {
    const a = audio.current
    if (!a) return undefined // no narration: the player is not rendered
    const onSlide = () => {
      const i = current()
      if (playing.current) load(i, true)
      else if (i >= 0) setState((s) => ({ ...s, i, t: 0 }))
    }
    const onEnded = () => {
      const i = current()
      const next = verRef.current.slides[i + 1]
      if (i >= 0 && next) deck.slide(next.h, next.v)
      else stop()
    }
    const onTime = () => setState((s) => ({ ...s, t: a.currentTime }))
    deck.on('slidechanged', onSlide)
    onSlide()
    a.addEventListener('ended', onEnded)
    a.addEventListener('timeupdate', onTime)
    return () => {
      deck.off('slidechanged', onSlide)
      a.removeEventListener('ended', onEnded)
      a.removeEventListener('timeupdate', onTime)
    }
  }, [deck])

  const toggle = () => {
    if (playing.current) return stop()
    let i = current()
    if (i < 0) {
      // outside this version (title or backup slide): start from its first slide
      i = 0
      const first = verRef.current.slides[0]
      deck.slide(first.h, first.v)
    }
    playing.current = true
    setState((s) => ({ ...s, on: true }))
    return load(i, true)
  }

  const step = (d) => {
    const V = verRef.current
    const i = Math.min(V.slides.length - 1, Math.max(0, (current() < 0 ? 0 : current()) + d))
    deck.slide(V.slides[i].h, V.slides[i].v)
  }

  const choose = (id) => {
    stop()
    audio.current.removeAttribute('src')
    verRef.current = VERSIONS.find((x) => x.id === id)
    setVerId(id)
    setState({ on: false, i: Math.max(0, current()), t: 0 })
  }

  if (!ver) return null
  const here = current() >= 0
  const done = here ? ver.slides.slice(0, state.i).reduce((s, c) => s + c.dur, 0) + state.t : 0

  return (
    <div className={`narration${state.on ? ' is-on' : ''}`} role="region" aria-label="Narration">
      <audio ref={audio} preload="none" />
      <button type="button" className="narration__btn" onClick={() => step(-1)} aria-label="Previous slide">⏮</button>
      <button type="button" className="narration__play" onClick={toggle}>
        {state.on ? '⏸ Pause' : here && done > 0 ? '▶ Resume' : '▶ Play'}
      </button>
      <button type="button" className="narration__btn" onClick={() => step(1)} aria-label="Next slide">⏭</button>
      {VERSIONS.length > 1 && (
        <select className="narration__ver" value={ver.id} onChange={(e) => choose(e.target.value)} aria-label="Narration version">
          {VERSIONS.map((x) => (
            <option key={x.id} value={x.id}>{x.label} · {fmt(x.total)}</option>
          ))}
        </select>
      )}
      <span className="narration__time">
        {here ? `${state.i + 1}/${ver.slides.length} · ${fmt(done)} / ` : ''}{fmt(ver.total)}
      </span>
      <span className="narration__bar" style={{ width: `${(100 * done) / ver.total}%` }} />
    </div>
  )
}
