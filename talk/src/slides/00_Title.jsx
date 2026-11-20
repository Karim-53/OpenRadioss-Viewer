import React from 'react'
import { Slide } from '../components'

// Column 0: what this talk covers and how to watch it (slide number and progress bar hidden).
const SEE = [
  ['The two models', 'how the report reads a deck, in nine steps'],
  ['Phone drop', 'what is wrong, the fixes, and what the corrected v0.1 shows'],
  ['Bumper crash', 'the wrong tear limit, the crash in curves, a design study'],
  ['The agent skill', 'the same workflow on a deck nobody has seen'],
  ['Next steps', 'and where the tool sits among existing tools'],
]

const KEYS = [
  [<b key="p" className="watch-play">▶ Play</b>, 'bottom-left: the narrated talk plays by itself; pick the short version (8 min, the phone drop) or the long version (the full talk)'],
  [<kbd key="f">F</kbd>, 'full screen'],
  [<><kbd>Space</kbd> <kbd>→</kbd></>, 'next slide'],
  [<kbd key="l">←</kbd>, 'previous slide'],
  [<kbd key="e">Esc</kbd>, 'every slide at a glance'],
]

export default function Title() {
  return (
    <Slide
      frame="watch-frame"
      state="no-number"
      bg="#ffffff"
      notes="How to watch: the Play button (bottom-left) plays the narration and moves on by itself; F for full screen; Space for the next slide."
    >
      <div className="watch-top"><span className="kicker">OpenRadioss Viewer</span><span className="watch-date">2026-11-11</span></div>
      <h1 className="watch-title">Reading a crash deck cold</h1>
      <p className="watch-sub">
        Two public crash models, a dropped phone and a bumper hitting a pole, read from their decks and explained to an
        engineer who opens one for the first time.
      </p>

      <p className="watch-me">
        <b>I'm Mohamed Karim Belaid</b>, a data scientist in the automotive field: six years in Porsche's passive-safety
        department on the frontal crash-test programme, as a consultant with IDIADA, and finishing my PhD in machine
        learning at LMU Munich. These slides present a tool I built that reads a crash simulation the way a crash
        engineer would want it explained.
      </p>

      <h3 className="watch-h">What you will see</h3>
      <ol className="watch-see">
        {SEE.map(([b, t]) => (
          <li key={b}><b>{b}:</b> {t}</li>
        ))}
      </ol>

      <h3 className="watch-h">How to watch</h3>
      <table className="watch-keys">
        <tbody>
          {KEYS.map(([k, t], i) => (
            <tr key={i}><td>{k}</td><td>{t}</td></tr>
          ))}
        </tbody>
      </table>

      <p className="watch-foot">The live report and the code: karim-53.github.io/OpenRadioss-Viewer</p>
    </Slide>
  )
}
