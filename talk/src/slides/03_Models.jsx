import React from 'react'
import { Slide, Head } from '../components'

// Column 2: the two models and the reader they are explained to.
export default function Models() {
  return (
    <Slide
      cue="~1 min · at 3:15"
      src="model previews: media/*_preview.png · line counts: the model files as delivered (report Overview)"
      notes={
        <>
          <p>"Two models: a car bumper hitting a pole, and a phone dropped on a floor. I wrote everything for a newcomer, someone who opens a crash deck for the first time. So every page of the report gives one picture, a plain description, and a few numbers in everyday units: 0.1 ms, 27 g, 6,490 J. The solver keyword comes after, in brackets, for the expert: 'glue (a tie, /INTER/TYPE2)'."</p>
          <p>"I came to these decks the way that reader does, cold, so every page had to pass my own first read."</p>
          <p>"From here on, the slides on the left give the overview, and I'll show the actual page on the right."</p>
        </>
      }
    >
      <Head kicker="Two public models" title="Two crash models, explained to someone who opens one for the first time" />
      <div className="col" style={{ gap: 12 }}>
        <figure className="brief-model">
          <img src="media/bumper_preview.png" alt="Bumper Beam preview" />
          <figcaption><b>Bumper Beam</b> · a car bumper hits a rigid pole · 28,629 lines</figcaption>
        </figure>
        <figure className="brief-model">
          <img src="media/phone_preview.png" alt="Cell Phone preview" />
          <figcaption><b>Cell Phone</b> · a phone lands on a rigid floor · 629,265 lines</figcaption>
        </figure>
      </div>
      <div className="newcomer mt-l">
        <div className="t">The reader is a <strong>newcomer</strong>. Each page gives:</div>
        <ul>
          <li>one visual</li>
          <li>a text description, in plain words</li>
          <li>a few numbers, in everyday units (0.1 ms, 27 g, 6,490 J)</li>
        </ul>
      </div>
      <div className="split-hint mt">
        <div><b>Left: these slides</b><br />the overview</div>
        <div><b>Right: the live report</b><br />the actual page and sentence</div>
      </div>
    </Slide>
  )
}
