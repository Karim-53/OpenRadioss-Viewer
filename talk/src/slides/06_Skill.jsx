import React from 'react'
import { Slide, Head } from '../components'

// Column 5: the agent skill (SKILL.md): its workflow, step by step, marked AI agent or script. The skills it builds on
// (SkillBuiltOn below) and "how I used AI" are backup slides (12_Backup.jsx).
const K = 'The agent skill'
const BACKUP_CUE = 'backup · only if asked'

/** A sparkle: a step the AI agent does (reads, judges, asks). */
function AiIcon() {
  return (
    <svg className="who-ic ai" viewBox="0 0 24 24" role="img" aria-label="AI agent">
      <path d="M11 2.5C11.8 7.4 14.6 10.2 19.5 11 14.6 11.8 11.8 14.6 11 19.5 10.2 14.6 7.4 11.8 2.5 11 7.4 10.2 10.2 7.4 11 2.5Z" fill="currentColor" />
      <path d="M19 14.5C19.3 16.4 20.1 17.2 22 17.5 20.1 17.8 19.3 18.6 19 20.5 18.7 18.6 17.9 17.8 16 17.5 17.9 17.2 18.7 16.4 19 14.5Z" fill="currentColor" />
    </svg>
  )
}

/** A terminal: a step a script does on its own (same input, same output). */
function ScriptIcon() {
  return (
    <svg className="who-ic script" viewBox="0 0 24 24" role="img" aria-label="script run">
      <rect x="2" y="3.5" width="20" height="17" rx="3.2" fill="currentColor" />
      <path d="M6.5 9 10 12 6.5 15" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 15.5H17.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// The workflow of SKILL.md (steps 0 to 9), each step done either by the agent or by one script run.
const STEPS = [
  { who: 'ai', t: 'Read cold', s: 'model file vs run file, told apart by their content' },
  { who: 'script', t: 'Check the tools', cmd: ['python src/main.py --check'] },
  { who: 'ai', t: 'Ask', s: 'before any install, one item at a time', ask: true },
  {
    who: 'script', t: 'Report v0', cmd: ['python src/main.py --run --media'],
    s: <><b>model.json</b> holds every number and finding with its source; the page and the one-pagers only draw it</>,
  },
  { who: 'script', t: 'Fixed decks v0.1', cmd: ['python src/main.py --v01'], s: 'the ★ fixes, or your saved answers' },
  { who: 'ai', t: 'Smoke test', s: 'Starter + a few hundred cycles on a scratch copy' },
  { who: 'script', t: 'Run v0.1', cmd: ['python src/main.py --v01 --run --media'] },
  { who: 'ai', t: 'Ship v0', s: 'while v0.1 still runs', hl: true },
  { who: 'script', t: 'Next versions', cmd: ['--build v0.2 --answer "…"', '--sweep thickness_scale=0.8,1.2'] },
]

function Steps({ steps }) {
  return (
    <div className="sk-steps">
      {steps.map((st, i) => (
        <div key={i} className={`sk-step ${st.who} ${st.ask ? 'ask' : ''} ${st.hl ? 'hl' : ''}`}>
          {st.who === 'ai' ? <AiIcon /> : <ScriptIcon />}
          <div className="sk-t">{st.t}</div>
          <div className="sk-b">
            {st.cmd && <div className="sk-cmds">{st.cmd.map((c) => <code key={c}>{c}</code>)}</div>}
            {st.s && <div className="sk-s">{st.s}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// What the skill builds on. Popularity: GitHub stars read on 2026-10-06 (obra/superpowers 295,946;
// mattpocock/skills 277,872) and claude.com/plugins installs (superpowers 1,009,371). mattpocock-skills shows only
// 1,745 installs there, because most people install it with skills.sh: so its card shows stars only.
const BUILT_ON = [
  {
    name: 'superpowers', by: 'Jesse Vincent', pop: '★ 296k · 1.0 M installs',
    why: 'brainstorm → plan → test first → review → verify before claiming anything is done',
    here: <>a smoke test before every long run, about 90 tests, and the 4 public decks checked by SHA-256 on every test run.</>,
  },
  {
    name: "Matt Pocock's skills", by: '"Skills for Real Engineers"', pop: '★ 278k',
    why: 'small, composable skills: a grilling session to agree with the agent before it builds, one shared vocabulary for the project, test first (red-green-refactor)',
    here: <>the skill asks before every install, one item at a time; the report speaks one plain vocabulary, the solver keyword only in brackets: "glue (tie, /INTER/TYPE2)".</>,
  },
]

export default function Skill() {
  return (
    <Slide
      cue="~1.5 min · at 35:15 · CHECKPOINT: here by 35:15 (behind? 45 s)"
      src="skill/openradioss-explore/SKILL.md (steps 0-9) · src/main.py (--check, --run, --media, --v01, --build, --sweep) · report/model.json · README 'Using the skill'"
      notes={
        <>
          <p>"The agent skill, SKILL.md, is the same workflow written for an AI coding agent, and it reads as a plain playbook for a person. Each step is done either by the agent, the sparkle, or by one script run, the terminal: same input, same output."</p>
          <p>"The agent reads the two decks cold and tells the model file from the run file by their content. A script checks the tools; then the agent asks before installing anything: Python packages, the 350 MB OpenRadioss download, ffmpeg, one item at a time. A declined install is a scope decision, not a failure."</p>
          <p>"One command builds the report and runs v0. Everything it finds lands in model.json: every number and every finding, with the file and line it came from. The page and the one-pagers only draw model.json, so a person or an agent can check any number without the browser. A second command writes the fixed decks, v0.1; the agent smoke-tests them, a Starter and a few hundred cycles, before the long run; then v0.1 runs, and the agent ships v0 while it is still running. Later versions and design studies are the same command with --build or --sweep."</p>
          <p>"It does not reinvent the discipline: it was built with two widely used skill sets, Jesse Vincent's superpowers and Matt Pocock's skills." (Details: backup slide "what it builds on". If asked whether SKILL.md calls them: "No: I developed it in Claude Code with both skill sets loaded; SKILL.md encodes the same habits rather than calling them.")</p>
          <p>If asked where it would break: /INCLUDE files or /PARAMETER (neither deck has them), keywords outside the decoded set (it prints the undecoded list as the extension backlog: 148 fields on the bumper, 82 on the phone), and other solver families: the pattern holds, the checks change.</p>
        </>
      }
    >
      <Head kicker={K + ' · SKILL.md'} title="The skill: the same workflow for a deck nobody has seen, and it asks before it installs" />
      <div className="who-legend">
        <span><AiIcon /> the AI agent: reads, judges, asks</span>
        <span><ScriptIcon /> a script run: same input, same output</span>
      </div>
      <Steps steps={STEPS} />
      <div className="note mt">Built with two well-established skill sets: Jesse Vincent's <b>superpowers</b> (★ 296k) and <b>Matt Pocock's skills</b> (★ 278k).</div>
    </Slide>
  )
}

// Backup: the well-established skills the agent skill builds on (was the second slide of this column).
export function SkillBuiltOn() {
  return (
    <Slide
      uncounted
      cue={BACKUP_CUE}
      src="github.com/obra/superpowers · github.com/mattpocock/skills (README: 'Why These Skills Exist') · claude.com/plugins/superpowers (stars and installs read 2026-10-06)"
      notes={
        <>
          <p>"The skill does not reinvent the engineering discipline: it leans on two skill sets that many engineers already use, each praised for a concrete reason."</p>
          <p>"First, superpowers, by Jesse Vincent: about 296 thousand GitHub stars and a million installs. Brainstorm, plan, test first, review, and verify before you claim anything is done. The same discipline is in this deliverable: a smoke test before every long run, about ninety tests, and your four decks checked by SHA-256 on every test run."</p>
          <p>"Second, Matt Pocock's skills, 'Skills for Real Engineers': about 278 thousand stars. Small skills you compose yourself instead of a process that owns you: a grilling session so the agent and you agree before it builds, one shared vocabulary for the project, and test first, red-green-refactor. The same habits show here: the skill asks before every install, one item at a time, and the report speaks one plain vocabulary, with the solver keyword only in brackets."</p>
          <p>If asked about the review of the findings: six hunter agents proposed 46 candidate findings and a second agent was told to refute them (9 of 36 verdicts refuted; the bumper's F-03 objection is on its Materials slide). If asked about the format: SKILL.md is the Agent Skills format, now an open standard read by Claude Code, Codex, Gemini CLI, Cursor and Copilot.</p>
        </>
      }
    >
      <Head kicker={'Backup · ' + K + ' · what it builds on'} title="Built with well-established skills instead of reinventing them" />
      <div className="bo-list">
        {BUILT_ON.map((b) => (
          <div className="bo" key={b.name}>
            <div className="bo-h">
              <span className="nm">{b.name}</span>
              <span className="by">{b.by}</span>
              <span className="pop">{b.pop}</span>
            </div>
            <div className="bo-r"><span className="lb">praised for</span>{b.why}</div>
            <div className="bo-r here"><span className="lb">here</span><span>{b.here}</span></div>
          </div>
        ))}
      </div>
      <div className="note mt">Stars and installs as of 6 Oct 2026 (github.com, claude.com/plugins).</div>
    </Slide>
  )
}
