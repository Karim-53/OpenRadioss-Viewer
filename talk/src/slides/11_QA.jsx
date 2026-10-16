import React from 'react'
import { Slide, Stack } from '../components'
import Backup from './12_Backup.jsx'

// Column 8: thank you / Q&A. The backup slides (12_Backup.jsx) are stacked below it (press ↓).
export default function QA() {
  return (
    <Stack>
      <Slide
        frame="qa"
        cue="at ~42:15 planned (≈ 50–55 min with the live report) · then questions"
        notes={
          <>
            <p>"To sum up: read the decks cold, verify against the solver, findings with fixes to choose from, a v0.1 that runs and compares, and every lesson goes back into the skill for the next deck. Thank you. I'm happy to go into any part of it, in the live report or in the backup slides."</p>
            <p>Backup below this slide (↓, or O and click): the phone's v0.2 decisions (first), the phone's seven v0.1 fixes, can we trust v0.1 (energy books), the phone in one table, the bumper's v0.2 decisions, the skills the skill builds on, how I used AI, glossary (2), run times, assumptions, what was left out, keyword frequency, the 11 thin parts, the bumper's energy error, units, one-pagers. Backups are not counted in the slide number.</p>
          </>
        }
      >
        <div className="kicker">Thank you</div>
        <h2>Questions?</h2>
        <div className="qa-steps">
          <span>read cold</span><i>▼</i>
          <span>verify against the solver</span><i>▼</i>
          <span>findings with fixes to choose from</span><i>▼</i>
          <span>v0.1, run, compare</span><i>▼</i>
          <span className="acc">Update the skill</span>
        </div>
        <div className="down">Backup slides below ↓<br />phone v0.2 · v0.1 fixes · can we trust v0.1 · phone findings · bumper v0.2 · skills it builds on · how I used AI · glossary · run times · assumptions · left out · keywords · thin parts · bumper energy error · units · one-pagers</div>
      </Slide>
      <Backup />
    </Stack>
  )
}
