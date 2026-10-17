import React from 'react'
import about from '../intro/about.html?raw'

// Column 1: About me, ported from an earlier talk with the same words, re-flowed for the 8:9 half-screen canvas.
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
    <Ported html={about} cue="~1.5 min · at 0:30 · be on 'The two models' by 2:00"
      extra={'Keep it short. Bridge to the talk, last sentence here: "Six years of crash data taught me what a model is worth when you cannot trust its inputs, and that is what this project is about."'} />
  )
}
