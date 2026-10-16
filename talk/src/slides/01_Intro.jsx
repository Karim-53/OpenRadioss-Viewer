import React from 'react'
import { Stack } from '../components'
import about from '../intro/about.html?raw'
import phd0 from '../intro/phd_0.html?raw'
import phd1 from '../intro/phd_1.html?raw'
import phd2 from '../intro/phd_2.html?raw'
import phd3 from '../intro/phd_3.html?raw'

// Column 1: the intro slides from an earlier talk, same words, re-flowed for the 8:9 half-screen canvas:
// About me, then the PhD overview with its three paper slides below it. From the PhD overview,
// → skips the papers and goes on; ↓ (or Space) walks through them.
// The HTML (including its own <aside class="notes">) is injected as is; a second notes block adds the timing.
function Ported({ html, cue, extra }) {
  return (
    <section>
      <aside className="notes">
        <p><b>{cue}</b></p>
        {extra && <p>{extra}</p>}
        <p><i>Original notes from the ported slide follow.</i></p>
      </aside>
      <div className="ported" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  )
}

export default function Intro() {
  return (
    <Stack>
      <Ported html={about} cue="~1.25 min · at 0:30"
        extra="Keep it short. Land on the last sentence of the original notes: crash models, explained to engineers." />
      <Ported html={phd0} cue="~1.5 min · at 1:45 → press → (not ↓) to skip the three paper slides; be on 'The two models' by 3:15"
        extra={'Bridge to the talk, last sentence here: "Six years of crash data taught me what a model is worth when you cannot trust its inputs, and that is what this project is about." The three paper slides below are optional: only if someone asks.'} />
      <Ported html={phd1} cue="optional · PhD paper 1/3 · only if asked"
        extra="If asked: explainers tested like software. The same instinct shows up in the report: every claim is checked against a ground truth (the solver's own listing), not against itself." />
      <Ported html={phd2} cue="optional · PhD paper 2/3 · only if asked"
        extra="If asked: uncertainty without an ensemble. Applied here: a surrogate that says 'I don't know' on the thin side of the bumper sweep, where the outcome changes fastest, is worth more than one that is confidently wrong." />
      <Ported html={phd3} cue="optional · PhD paper 3/3 · only if asked"
        extra="If asked: an agent that learns an undocumented engineering method from its own cases. That is the same shape as the agent skill in this project: a written, repeatable workflow an agent follows on a deck nobody has seen." />
    </Stack>
  )
}
