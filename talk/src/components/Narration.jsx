import React, { useEffect, useRef, useState } from 'react'
import NARRATION from '../data/narration.json'

// The voice-over: one audio clip per slide of the main path (backup slides have none).
// Press play once; each clip plays with its slide and the deck moves on when the clip ends.
// Navigating by hand while it plays (arrows, clicker, overview) switches to that slide's clip.

const key = (h, v) => `${h}-${v}`
const CLIPS = NARRATION.slides
const INDEX = new Map(CLIPS.map((c, i) => [key(c.h, c.v), i]))
const TOTAL = CLIPS.reduce((s, c) => s + c.dur, 0)

const fmt = (s) => {
  s = Math.max(0, Math.round(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Narration({ deck }) {
  const deckRef = useRef(deck)
  deckRef.current = deck
  const audio = useRef(null)
  const playing = useRef(false)
  const [state, setState] = useState({ on: false, i: 0, t: 0 })

  const current = () => {
    const deck = deckRef.current
    if (!deck) return -1
    const { h, v } = deck.getIndices()
    return INDEX.has(key(h, v)) ? INDEX.get(key(h, v)) : -1
  }

  const load = (i, autoplay) => {
    const a = audio.current
    if (i < 0) {
      a.pause()
      playing.current = false
      setState((s) => ({ ...s, on: false }))
      return
    }
    if (!a.src.endsWith(CLIPS[i].file)) a.src = CLIPS[i].file
    setState((s) => ({ ...s, i }))
    if (autoplay) a.play().catch(() => {})
  }

  useEffect(() => {
    const a = audio.current
    if (!a) return undefined // no narration clips: the player is not rendered
    const onSlide = () => {
      const i = current()
      if (playing.current) load(i, true)
      else if (i >= 0) setState((s) => ({ ...s, i, t: 0 }))
    }
    const onEnded = () => {
      const i = current()
      const next = CLIPS[i + 1]
      if (i >= 0 && next) deck.slide(next.h, next.v)
      else {
        playing.current = false
        setState((s) => ({ ...s, on: false }))
      }
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
    const a = audio.current
    if (playing.current) {
      a.pause()
      playing.current = false
      setState((s) => ({ ...s, on: false }))
      return
    }
    let i = current()
    if (i < 0) {
      // on a backup slide: start again from the top
      i = 0
      deckRef.current.slide(CLIPS[0].h, CLIPS[0].v)
    }
    playing.current = true
    setState((s) => ({ ...s, on: true }))
    load(i, true)
  }

  const step = (d) => {
    const i = Math.min(CLIPS.length - 1, Math.max(0, (current() < 0 ? 0 : current()) + d))
    deckRef.current.slide(CLIPS[i].h, CLIPS[i].v)
  }

  if (!CLIPS.length) return null
  const done = CLIPS.slice(0, state.i).reduce((s, c) => s + c.dur, 0) + state.t
  const here = current() >= 0

  return (
    <div className={`narration${state.on ? ' is-on' : ''}`} role="region" aria-label="Narration">
      <audio ref={audio} preload="none" />
      <button type="button" className="narration__btn" onClick={() => step(-1)} aria-label="Previous slide">⏮</button>
      <button type="button" className="narration__play" onClick={toggle}>
        {state.on ? '⏸ Pause' : here && done > 0 ? '▶ Resume' : '▶ Play the narrated talk'}
      </button>
      <button type="button" className="narration__btn" onClick={() => step(1)} aria-label="Next slide">⏭</button>
      <span className="narration__time">
        {here ? `${state.i + 1}/${CLIPS.length} · ` : ''}
        {fmt(done)} / {fmt(TOTAL)}
      </span>
      <span className="narration__bar" style={{ width: `${(100 * done) / TOTAL}%` }} />
    </div>
  )
}
