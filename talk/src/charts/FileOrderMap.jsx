import React from 'react'

// The report's nav bar, redrawn top to bottom as the order in which an engineer meets a Radioss simulation.
// Group labels and step names are the report's own (assets/app.js STEPS; README "How to read the report").
const GROUPS = [
  {
    label: 'Model file', file: '_0000.rad', by: 'read + checked by the Starter',
    steps: ['1 Overview', '2 Geometry', '3 Materials', '4 Connections'],
    q: 'What is it, what is it made of, how is it held together?',
  },
  {
    label: 'Run file', file: '_0001.rad', by: 'run by the Engine',
    steps: ['5 Run settings'], q: 'How long, what is saved, what stops a bad run?',
  },
  {
    label: 'Results', file: '.out · T01 · A001…', by: 'exist only after a run',
    steps: ['6 Results'], q: 'Did the impact happen? Can the numbers be trusted?',
  },
  {
    label: 'Review', file: 'judgement', by: 'on top of the three above',
    steps: ['7 Engineering', '8 Findings', '9 v0 vs v0.1'], q: 'Is it right, what is wrong, what did the fixes change?',
  },
]

export default function FileOrderMap() {
  return (
    <div className="fom">
      {GROUPS.map((g, i) => (
        <React.Fragment key={g.label}>
          <div className="fom-box">
            <div className="fom-label">{g.label}</div>
            <div className="fom-steps">
              {g.steps.map((s) => <span key={s} className="fom-step">{s}</span>)}
            </div>
            <div className="fom-file">{g.file}</div>
            <div className="fom-by">{g.by}</div>
            <div className="fom-q">{g.q}</div>
          </div>
          {i < GROUPS.length - 1 && <div className="fom-arrow">▼</div>}
        </React.Fragment>
      ))}
    </div>
  )
}
