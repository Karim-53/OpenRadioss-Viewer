import React from 'react'
import { Slide } from '../components'

// Column 0: the title on white, nothing else (slide number and progress bar hidden).
export default function Title() {
  return (
    <Slide
      frame="logo-frame"
      state="no-number"
      bg="#ffffff"
      cue="0:00 · ~30 s (About me has slack)"
      notes={
        <>
          <p>Stand, breathe, smile. Laptop on: this deck on the left half of the screen, the live report (docs/index.html) on the right half.</p>
          <p>"Thank you for having me. The slides on the left give the overview; on the right is the report itself, and I'll show you each sentence there. In about 50 minutes: what I found in the two decks, how I checked it against the solver, what I fixed, and what I'd do next. I'll keep the end for your questions."</p>
          <p>Next = Space, →, ↓ or the clicker; back = ← or ↑. Every press is one slide in reading order, down each stack. To jump into a backup slide: O, then click it. S = speaker view, O = overview, F = full screen (of this half), B = black.</p>
        </>
      }
    >
      <div className="title-block">
        <div className="kicker">OpenRadioss Viewer</div>
        <h1>Reading a crash deck cold</h1>
        <p className="title-sub">Two public OpenRadioss models, explained to an engineer who opens one for the first time</p>
        <p className="title-by">Mohamed Karim Belaid</p>
      </div>
    </Slide>
  )
}
