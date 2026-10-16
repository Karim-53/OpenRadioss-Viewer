import React from 'react'
import { Slide, Head } from '../components'
import { PhoneGraph } from '../charts'

// Column 6: future work = what I would do next to the report (the HTML) and the skill that builds it, grouped
// by the report page the change goes to, in the report's own order. From the review notes
// ("future work and fixes"). The v0.2 decisions are backup slides (PhoneV02, BumperV02).
const K = 'Future work'

const GROUPS = [
  {
    page: 'Every page',
    items: [
      <>Every number in the reader's <strong>own units</strong>, with a switch (g or kg, not deck units).</>,
      <>One switch, <strong>three views</strong> of each item: the picture · what I need to know · the full table.</>,
      <><strong>Right-click</strong> to add notes about anything (text or figure).</>,
    ],
  },
  {
    page: '2 Geometry',
    items: [
      <>Show and monitor the <strong>dimensions</strong> and the <strong>distances between the parts</strong>.</>,
      <>Show the <strong>cells the floor watches</strong>.</>,
    ],
  },
  {
    page: '4 Connections',
    graph: true,
    items: [<>A <strong>connection graph</strong> next to the table, like the ones in this talk.</>],
  },
  {
    page: '6 Results',
    items: [
      <>The path of the <strong>centre of mass</strong>, and the <strong>speed of the 4 corners</strong> at the start and at the end.</>,
      <>A button to <strong>integrate or differentiate</strong> any result curve (impulse ↔ force).</>,
      <>A <strong>crack video</strong>, once the glass can fail.</>,
    ],
  },
]

export default function FutureWork() {
  return (
    <Slide
      cue="~1.5 min · at 36:45"
      src="review notes (future work and fixes) · README 'Future work'"
      notes={
        <>
          <p>"Future work is what I would do next to the report and to the skill that builds it. Page by page, in the report's own order."</p>
          <p>"On every page: every number in the reader's own units, with a switch; today the Geometry table still shows masses in the deck's units. One switch per item between three views: the picture, the two lines you need to know, and the full table; you saw it working on the phone's Engineering slide. And a right-click anywhere, on a number or on a figure, to add a note; the notes go into the same interaction.txt as the answers, so the engineer's AI agent reads them too."</p>
          <p>"Geometry: show and monitor the key dimensions and the distances between the parts, and which cells the floor actually watches. Connections: the graph you saw today, next to the table. Results: the path of the centre of mass and the speed of the four corners at the start and at the end, which shows the rotation towards the second hit; a button to integrate or differentiate any curve, for example to turn the bumper's stored impulses into forces; and, once the glass has a failure rule, a video of the screen cracking."</p>
          <p>If asked what the checks would be in external aero: residual convergence, a settled averaging window for the force coefficients, y-plus at the wall. Same pattern: reconcile with the solver's own output, check conservation, show the finding where it occurs.</p>
        </>
      }
    >
      <Head kicker={K + ' · the report, page by page'} title="Next: a report that is faster to read" />
      <div className="fw-groups">
        {GROUPS.map((g) => (
          <div className={`fw-g ${g.graph ? 'with-graph' : ''}`} key={g.page}>
            <div className="fw-body">
              <div className="gt">{g.page}</div>
              <div className="say tight">
                {g.items.map((it, i) => <p key={i}>{it}</p>)}
              </div>
            </div>
            {g.graph && <div className="fw-thumb"><PhoneGraph width={214} /></div>}
          </div>
        ))}
      </div>
    </Slide>
  )
}
