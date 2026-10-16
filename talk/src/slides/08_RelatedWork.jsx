import React from 'react'
import { Slide, Head } from '../components'

// Column 7, slide 1 of 2 (related work + the gap ↓ the contribution), from ai/related_work_top3.md. Each card says
// what the work does, then the gap it leaves, which the contribution slide below answers (the separate gap slide
// was folded in here for time).
// The NVIDIA demo is linked, not embedded (it is NVIDIA's video: youtube.com/watch?v=Oq2Mpi5pF1w, about
// 1:05-1:35): sliders move the fin heights of a heat sink and the simulated temperature and flow update at once.

/** A related-work card: what they do, then the gap it leaves; `side` sits to the right of the two lines. */
function Rw({ n, title, theirs, gap, side }) {
  return (
    <div className="card2 rw">
      <div className="t"><span className="n">{n}</span>{title}</div>
      <div className="rw-body">
        <div className="rw-lines">
          <div className="d"><span className="who">Theirs</span>{theirs}</div>
          <div className="d"><span className="who gap">Gap</span>{gap}</div>
        </div>
        {side}
      </div>
    </div>
  )
}

export default function RelatedWork() {
  return (
    <Slide
      cue="~2.5 min · at 38:15 (behind? one minute: the three gaps only)"
      src="ai/related_work_top3.md · ai/research/related_work.md (Altair's 287 checks: no run-file rows) · NVIDIA PhysicsNeMo video (youtube.com/watch?v=Oq2Mpi5pF1w) · findings: phone F-01, F-02, F-05; bumper F-03"
      notes={
        <>
          <p>"Where does this sit? Before building, I asked: has anyone already read an OpenRadioss deck programmatically and explained it to a person? Solvers, converters, result readers: many. A tool that explains a deck to a human: none. Three sources, and the gap each one leaves, which is the gap we decided to work on."</p>
          <p>"One: NVIDIA PhysicsNeMo. The link opens NVIDIA's own demo: move a slider, here the fin heights of a heat sink, and the temperature and the flow update at once. That is the side I work on: a variation you can see, not a table of numbers. Their OpenRadioss example even starts from these two decks. The gap: the picture shows how a result changes, never what is wrong in the deck that produced it."</p>
          <p>"Two: the commercial checkers. Oasys PRIMER advertises over 10,000 checks for LS-DYNA; Altair's Model Checker has 287 for Radioss, 81 of them with an automatic fix. The gap: they check the model file. Altair's catalogue has zero rows for /RUN, /STOP, /ANIM, /H3D or /TFILE, yet those twenty or thirty lines decide whether any result can answer the question: you saw it on both decks. And for OpenRadioss, nothing open closes the loop from 'here is what is wrong' to 'here is a corrected deck' to 'here is a run that proves it'."</p>
          <p>"Three: pyNastran: one flat summary that everything downstream reads, and it never raises on an unknown card. It reads and links the cards; but no published tool checks whether the values agree, with each other and with what the engineer wants to learn. Every line of these decks is legal on its own: curves every millisecond in a run of a tenth of a millisecond; a beam named DP1000 with the tear limit of DP600; a drop test, whose question is 'does the screen crack?', in a model where nothing can break. Both decks run to 'normal termination' anyway."</p>
          <p>If asked whether those checks overlap with my findings: Altair's 287 (106 errors, 166 warnings, 15 info; 72 of them are HyperMesh ID and include bookkeeping) are model-file checks; element quality and initial penetration live in separate HyperMesh tools, so they would overlap with the wedges (phone F-09) and the initial overlaps (bumper F-06). They have no rows for the run file, units, energy balance or added mass: no overlap with the run-file findings (phone F-01, F-02, F-07, F-08; bumper F-01, F-02, F-04) or with anything checked after a run. Commercial pre-processors like PRIMER do have fix-and-re-check; the gap is an open, scriptable one for this solver. If asked about the 135 runs: NVIDIA's generator mutates the two decks 135 times for training data; it edits the text with regex and copies the run file without reading it. If asked about Vortex-Radioss: used to read binary results, installed from GitHub because the pip name returns 404.</p>
        </>
      }
    >
      <Head kicker="Related work · the gap we decided to work on" title="Many tools solve or convert Radioss decks; none explains one to a person" />
      <div className="cards">
        <Rw n={1} title="NVIDIA PhysicsNeMo · see the variations"
          theirs={<>move a slider (here, the fin heights of a heat sink) and the simulated temperature and flow update at once. Their OpenRadioss example starts from <b>these two decks</b>.</>}
          gap={<>the picture shows how a result <b>changes</b>, never what is <b>wrong in the deck</b> that produced it.</>}
          side={<a className="rw-link" href="https://www.youtube.com/watch?v=Oq2Mpi5pF1w&t=65s" target="_blank" rel="noreferrer">▶ NVIDIA's demo<br /><span>YouTube, 1:05–1:35</span></a>}
        />
        <Rw n={2} title="Oasys PRIMER · Altair's Radioss Model Checker"
          theirs={<>commercial checkers of the <b>model file</b>. PRIMER advertises over 10,000 checks for LS-DYNA; Altair's has 287 for Radioss, 81 with an automatic fix.</>}
          gap={<><b>zero rows for the run file</b>, which decides whether any result can answer the question; and for OpenRadioss, no open loop <b>finding → corrected deck → a run that proves it</b> (PRIMER has one for LS-DYNA).</>}
        />
        <Rw n={3} title="pyNastran · 406 Nastran cards"
          theirs={<>a deck parser whose output is <b>one flat summary</b> that everything downstream reads; it never raises on an unknown card.</>}
          gap={<>it reads and links the cards; no published tool checks that the <b>values agree</b> with each other and with the question: curves every <b>1 ms</b> in a <b>0.1 ms</b> run; a <b>DP1000</b> beam with a <b>DP600</b> tear limit; a drop test for cracks where <b>nothing can break</b>.</>}
        />
      </div>
      <div className="note mt" style={{ maxWidth: 500 }}>
        Both decks run to <b>"normal termination"</b>: the problems show only when the values are read together, against the question.
      </div>
    </Slide>
  )
}
