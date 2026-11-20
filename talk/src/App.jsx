import React, { useEffect, useRef, useState } from 'react'
import Reveal from 'reveal.js'
import RevealNotes from 'reveal.js/plugin/notes/notes.esm.js'

// Fonts are bundled (no network): Inter 400/500/600/700.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'

import 'reveal.js/dist/reveal.css'
import './intro/intro.css' // the intro slides' theme: tokens, type scale, panels
import './theme.css' // this deck's additions on top of it (8:9 canvas)

import Title from './slides/00_Title.jsx'
import Models from './slides/03_Models.jsx'
import Phone from './slides/04_Phone.jsx'
import Bumper from './slides/05_Bumper.jsx'
import Skill from './slides/06_Skill.jsx'
import FutureWork from './slides/07_FutureWork.jsx'
import RelatedWork from './slides/08_RelatedWork.jsx'
import Contribution from './slides/10_Contribution.jsx'
import QA from './slides/11_QA.jsx'
import { Stack } from './components'
import Narration from './components/Narration.jsx'

// 8:9 = half of a 16:9 screen: the talk on one half, the live report on the other.
// 640 x 720 keeps text as large on half a screen as the old 1280 x 720 deck was on a full one.
const CONFIG = {
  width: 640,
  height: 720,
  margin: 0.04,
  center: false,
  hash: true,
  // 2D navigation: ↓ walks down a stack, → jumps to the next column.
  // Space / PageDown (= a clicker's "next") walk every slide in reading order, down each stack.
  slideNumber: 'c/t',
  showSlideNumber: 'all',
  controls: true,
  controlsLayout: 'bottom-right',
  controlsTutorial: false,
  progress: true,
  transition: 'fade',
  transitionSpeed: 'fast',
  backgroundTransition: 'none',
  autoPlayMedia: null, // honour data-autoplay on each <video>
  plugins: [RevealNotes],
}

// One label per column, in the same order as the sections in <App/> below. Shown above each
// column in the Esc overview (reveal.js draws no column titles of its own).
const COLUMN_TITLES = [
  'How to watch', 'The two models', 'Cell Phone', 'Bumper Beam',
  'The agent skill', 'Future work', 'Related work + gap, contribution', 'Backup',
]

/**
 * The 60-minute talk. Columns go right (→), stacks go down (↓):
 * 0 title · 1 about me ↓ PhD ↓ 3 papers · 2 the two models · 3 Cell Phone ↓ (how the report reads, then the Overview
 * with what I built, on F-01, …) · 4 Bumper Beam ↓ · 5 the agent skill · 6 future work · 7 related work + gap ↓
 * contribution · 8 Q&A ↓ backup
 * Backup slides sit below the Q&A slide and are not counted (the phone's v0.2 opens the backup; the bumper's is 5th).
 */
export default function App() {
  const deckRef = useRef(null)
  const titlesRef = useRef(null)
  const [deck, setDeck] = useState(null)

  useEffect(() => {
    const deck = new Reveal(deckRef.current, CONFIG)
    deck.initialize().then(() => setDeck(deck))

    // Column titles for the overview: HTML labels laid over the page, so they stay readable at the
    // overview's small scale. Each one sits above the first slide of its column and follows it while
    // the slides animate into place.
    const layer = titlesRef.current
    let raf = 0
    const place = () => {
      if (!deck.isOverview()) {
        layer.style.display = 'none'
        return
      }
      layer.style.display = 'block'
      const origin = deckRef.current.getBoundingClientRect()
      const columns = deck.getSlidesElement().querySelectorAll(':scope > section')
      columns.forEach((column, i) => {
        const first = column.querySelector(':scope > section') || column
        const r = first.getBoundingClientRect()
        const label = layer.children[i]
        if (!label) return
        label.style.left = `${r.left - origin.left}px`
        label.style.width = `${r.width}px`
        // the label's bottom edge sits 4px above the slide (CSS: translateY(-100%)); never above the screen
        label.style.top = `${Math.max(r.top - origin.top - 4, 44)}px`
      })
    }
    const track = () => {
      cancelAnimationFrame(raf)
      const until = performance.now() + 900 // the overview animates for well under a second
      const step = () => {
        place()
        if (performance.now() < until) raf = requestAnimationFrame(step)
      }
      step()
    }
    deck.on('overviewshown', track)
    deck.on('overviewhidden', track)
    deck.on('slidechanged', track)
    deck.on('resize', track)

    return () => {
      setDeck(null)
      cancelAnimationFrame(raf)
      try {
        deck.destroy()
      } catch {
        // React StrictMode unmounts before reveal finished initialising: nothing to clean up.
      }
    }
  }, [])

  return (
    <div className="reveal" ref={deckRef}>
      <div className="slides">
        <Title />
        <Models />
        <Phone />
        <Bumper />
        <Skill />
        <FutureWork />
        <Stack>
          <RelatedWork />
          <Contribution />
        </Stack>
        <QA />
      </div>
      <div className="col-titles" ref={titlesRef}>
        {COLUMN_TITLES.map((t, i) => (
          <div className="col-title" key={t}><span>{i}</span> {t}</div>
        ))}
      </div>
      {deck && <Narration deck={deck} />}
    </div>
  )
}
