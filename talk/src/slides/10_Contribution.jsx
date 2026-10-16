import React from 'react'
import { Slide, Head, Card } from '../components'

// Column 7, slide 2 of 2: the contribution; each card answers the gaps named on the related-work slide above it.
export default function Contribution() {
  return (
    <Slide
      cue="~1.5 min · at 40:45"
      src="README (run table, v0 and v0.1) · report/model.json findings · v0.1/edits.json · assets/app.js (choices, free answer, Save interaction.txt) · tests/test_deck_parser.py (SHA-256)"
      notes={
        <>
          <p>"Our answer to those gaps, point by point. One: the findings cover both files, the model file the Starter reads and the run file the Engine runs, line by line and as a whole: do the values agree with each other and with the question? 19 findings on the two decks, 12 on the phone and 7 on the bumper."</p>
          <p>"Two: every finding comes with at least two fixes and their cost, one recommended. A script applies the recommended ones to copies of the decks and runs them in the solver: v0.1 previews what the fixes change, side by side with v0. 11 fixes, 7 and 4; six solver runs, including two points of a thickness study. And the numbers are checked against the solver: every part's mass agrees with the Starter's own listing to about one part in 100,000, and the four public decks are never modified: the tests check their SHA-256 on every run."</p>
          <p>"Three: the report is the UI. The engineer confirms an issue or picks another fix with one click, types a note in the free field, and saves interaction.txt. That file is the hand-over to their AI agent, which builds the next version from it."</p>
          <p>"And for a surrogate team, that is the intake check before training: a deck that stops at 0.1 ms, records one data point, or saves its fields only in a format you cannot read gives rows you cannot train on."</p>
        </>
      }
    >
      <Head kicker="Contribution" title="Our answer to those gaps" />
      <div className="cards">
        <Card n={1} title="Findings on both files, line by line and as a whole">
          Errors and warnings in the <b>model file</b> (Starter) and the <b>run file</b> (Engine), one line at a time and for the coherence of the whole: do the values agree with each other and with the question? <b>19</b> on the two decks.
        </Card>
        <Card n={2} title="Quick fixes, and a v0.1 that previews them">
          Each finding comes with <b>2+ fixes</b>, one recommended. A script applies the recommended ones and runs them in the solver: <b>v0.1</b> shows what the fixes change, next to v0 (11 fixes, 6 runs).
        </Card>
        <Card n={3} title="A UI to confirm, note and hand over">
          In the report, the engineer confirms an issue or picks another fix in <b>one click</b>, types a note, and saves <code>interaction.txt</code>: the <b>hand-over to their AI agent</b>, which builds the next version.
        </Card>
      </div>
      <div className="intake-line">
        A run that stops at 0.1 ms, records one data point, or saves its fields only as <code>.h3d</code> gives rows you cannot train on. This is the <b>intake check before training</b>.
      </div>
    </Slide>
  )
}
