import React from 'react'
import { Slide, Stack, Head, Say, Shot, Legend, Mark, Callout, F, Fis, More, Views } from '../components'
import { FileOrderMap, PhoneGraph, BendFigure, WedgeFigure, RunFile, EnergySplit, StressBars, PartShares, EnergyBooks } from '../charts'
import { ThinVisual, ThinTable, ToleranceVisual, HistoryVisual } from '../charts/EngVisuals.jsx'

// Column 3: the Cell Phone, walked page by page; the live report sits on the right half of the screen.
// Every error or warning is explained once, led by its id. What sits under a "more details:" rule stays on the
// slide but is not presented (cut for the 60 minutes). The v0.1 fixes, the energy books, the findings table and
// the v0.2 decisions are backup slides (exported below, rendered by 12_Backup.jsx).
// Numbers: kb/01, kb/02 and the report's model*.json; each slide lists its sources in the notes.
const K = 'Cell Phone'
const BACKUP_CUE = 'backup · only if asked'

// What I built, in four steps: shown on the Overview, where the first finding (F-01) is met.
const STEPS = [
  { t: <><strong>Report</strong> every error and warning</>, d: <>where it appears in the deck, in plain words: 19 on the two decks (phone 12, bumper 7)</> },
  { t: <><strong>Suggest two fixes</strong> or more for each</>, d: <>each with what it costs: run time, new data, a new mesh</> },
  { t: <><strong>Recommend one</strong> of them</>, d: <>the engineer keeps it or picks another with one click</> },
  { t: <><strong>Compare</strong> the current run (v0) with a fixed one (v0.1)</>, d: <>both really run in the solver, then side by side</> },
]

// A real interaction.txt block saved from the page: a reader overriding the recommended 2 ms with 5 ms.
const INTERACTION = `# interaction.txt
model: Cell_Phone_Drop
finding: F-01
severity: error
answer: lengthen to 5.0 ms
deck_edit: |
  /RUN/Cell_Phone_Drop/1/
                 5e-3`

const WHERE = [
  ['1 Overview', [['F-01', 'error'], ['F-10', 'warning']]],
  ['2 Geometry', [['F-06', 'error'], ['F-09', 'warning']]],
  ['3 Materials', [['F-05', 'error']]],
  ['4 Connections', [['F-04', 'error'], ['F-11', 'warning']]],
  ['5 Run settings', [['F-02', 'error'], ['F-03', 'error'], ['F-07', 'warning'], ['F-08', 'warning']]],
  ['only in this list', [['F-12', 'info']]],
]

// v0 finding -> how v0.1 fixed it -> what that showed -> what v0.1 raised in turn (F-08 left out: it sits under
// "more details:" on Run settings, so it is not presented; the backup slide of the seven fixes lists it)
const REVEALED = [
  { f: 'F-01', sev: 'error', what: 'run too short', fix: '2 ms', saw: <>first hit over at <b>0.665 ms</b></>, next: ['F-01', 'error', 'still moving: 5 ms'] },
  { f: 'F-03', sev: 'error', what: 'nothing measured', fix: 'floor + part sensors', saw: <>rear cover takes <b>69 %</b> of the blow</>, next: ['F-02', 'error', 'channels unnamed'] },
  { f: 'F-04', sev: 'error', what: 'no contact', fix: 'one contact, all parts', saw: <>battery, ic_02 finally loaded: <b>31 / 75 MPa</b></>, next: ['F-07', 'warning', 'stabiliser 15.5 %'] },
  { f: 'F-02', sev: 'error', what: '1 data point', fix: '200 points', saw: <>curves over the whole 2 ms</> },
  { f: 'F-11', sev: 'warning', what: 'floor too short-sighted', fix: 'watches 117.3 mm', saw: <>nothing falls through the floor</> },
  { f: 'F-07', sev: 'warning', what: 'stop can never fire', fix: 'stop at 10 %', saw: <>armed, never tripped</> },
]

// v0.2: what I would decide as the engineer for each finding v0.1 left open, with v0.1's ids (v0 id when renumbered).
// Read after delivery from Cell_Phone_Drop/v0.1: run_metadata.json (2 ms = 5,660 s on 8 threads), the restart file
// Cell_Phone_Drop_0001_0001.rst (382 MB, written at 2 ms), the T01 hourglass energy per part (battery 67 %, boards 31 %,
// screen 0 %) and the Starter listing (the ~400 smallest nodal time steps are all screen nodes; its added-mass table:
// 1 % mass holds 37.4 ns, 5 % only 41.2 ns). Density: 27.0 g in 58 × 104 × 9 mm = 54.3 cm³ → 0.5 g/cm³.
const V02 = [
  {
    k: 'F-01', sev: 'error',
    v: <>Run <b>5 ms</b> to include the second hit: about 4 h from scratch. Faster, with the same answer:</>,
    sub: [
      <><b>Restart</b> from v0.1's saved state at 2 ms: only 3 ms left, about 2.4 h.</>,
      <><b>More cores</b>: with <code>/PARITH/ON</code>, the answer no longer depends on the core count.</>,
      <>Not worth it: <b>more added mass</b>. 5 % instead of 1 % gives only a 10 % longer step.</>,
    ],
  },
  {
    k: 'F-04', v0: 'F-06', sev: 'error',
    v: <>Re-mesh the boards, chips and screen as <b>shells</b> (plate elements).</>,
    sub: [
      <><b>Accuracy</b>: a shell bends through its own thickness, so the boards stop relying on the solver's artificial stiffness.</>,
      <><b>Link to F-07</b>: the boards take 31 % of the energy spent on that artificial stiffness; shells remove that share.</>,
      <><b>Speed</b>: the screen's small glass tets set today's 37 ns time step; as shells they would not (gain to be measured).</>,
      <><b>Cost</b>: a pre-processor job (mid-surface, shell mesh, re-tie the chips). Routine for a CAE engineer, not an edit for a script.</>,
    ],
  },
  {
    k: 'battery', sev: 'new',
    v: <>Glue it where the real adhesive is. Today it is loose and rattles inside the phone: of the energy the solver spends on artificial stiffness (F-07), <b>67 %</b> is spent in the battery. Sure fix: fully integrated bricks, which need none (2–4× its cost).</>,
  },
  { k: 'ic_02', sev: 'new', v: <>It has two holes: model <b>two screws</b> through them, so the chip passes its load to the board.</> },
  {
    k: 'F-06', v0: 'F-10', sev: 'warning',
    v: <>Ask for the real weight and add the missing mass as non-structural mass, to go from the current <b>0.5 g/cm³</b> to <b>2.0 g/cm³</b>, closer to real phones.</>,
  },
  {
    k: 'F-03', v0: 'F-05', sev: 'error',
    v: <>Compare the glass's peak tensile stress with its strength to see how close it is to cracking. If a measured failure strain is available, add it to the model so the crack appears in the simulation.</>,
  },
]

// All twelve v0 findings: the backup slide "the phone in one table" (PhoneTable below).
const ALL = [
  ['F-01', 'error', 'run stops at 0.1 ms, mid-impact', '✓ 2 ms'],
  ['F-02', 'error', 'curves every 1 ms in a 0.1 ms run: 1 point', '✓ 200 points'],
  ['F-03', 'error', 'nothing measured: no floor force, no part energy', '✓ sensors'],
  ['F-04', 'error', 'only glue, no contact; 2 parts attached to nothing', '✓ one contact'],
  ['F-05', 'error', 'nothing can break: no failure limit', 'left: ★ stress margin'],
  ['F-06', 'error', '11 thin parts cannot bend (one element across)', 'left: ★ shells'],
  ['F-07', 'warning', 'safety stop at 99 % can never trigger', '✓ 10 %'],
  ['F-08', 'warning', 'answer depends on the core count', '✓ /PARITH/ON'],
  ['F-09', 'warning', '468 elements squashed into wedges', 'left: ★ accept, report'],
  ['F-10', 'warning', '27 g, about 17 % of a real phone', 'left: ★ add the mass'],
  ['F-11', 'warning', 'floor sees 32.6 of 97.7 mm', '✓ 117.3 mm'],
  ['F-12', 'info', 'unused curves', 'left: ★ keep, annotate'],
]

export default function Phone() {
  return (
    <Stack>
      {/* P0 · how the report reads ------------------------------------------------------- */}
      <Slide
        cue="~1.5 min · at 4:15"
        src="index.html · assets/app.js (STEPS, mark()) · README 'How to read the report'"
        notes={
          <>
            <p>"The report is one offline page, index.html: no server, no network, both models in it. It has nine steps, grouped by the file they read, because that is the order in which you meet a Radioss simulation. The model file, _0000.rad, is the object: mesh, materials, joins, starting speed; the Starter reads and checks it. The run file, _0001.rad, says how long to run, what to save and when to stop; the Engine executes it. Results exist only after a run. And the review is judgement."</p>
            <p>"Problems are marked where they appear, not in a list you have to remember: a red cross is an error, a number from this run would be wrong or missing; an exclamation mark is a warning, it would mislead; an 'i' is a note. Hover shows the summary, click opens the finding. The v0/v0.1 switch at the top shows the same pages after the fixes, and a green tick marks every place a fix changed."</p>
            <p>On the right: show the nav bar, hover one marker, click it once, come back.</p>
            <p><b>Checkpoints:</b> Connections (4) by 12:15 · v0.1 results by 21:00 · Bumper by 24:30 · The agent skill by 35:15 · Q&amp;A by 42:15. These clocks are speech only: the live report on the right adds 5 to 10 minutes, so <b>being up to 5 minutes behind them is on track</b> (Q&amp;A around 48–50 min). Cut only if you are not at The agent skill by 41:00. <b>Never present what sits under "more details:"</b> unless someone asks. <b>Behind? Cut, in this order:</b> (1) Engineering in one view; (2) the bumper connections graph in 30 s; (3) the bumper findings table in one line; (4) Related work in one minute (the three gaps only); (5) the skill in 45 s. <b>Ahead?</b> The first backup slide is the phone's v0.2.</p>
          </>
        }
      >
        <Head kicker={K + ' · how the report reads'} title="Nine steps, in the order an engineer meets a deck" />
        <FileOrderMap />
        <div className="row mt-l" style={{ gap: 16, alignItems: 'flex-start' }}>
          <Legend items={['error', 'warning', 'info', 'fixed']} stack short />
          <Shot file="phone_v0_02_geometry_marker_tip_crop.png" width={360}
            caption="Hover a marker: the summary. Click: the finding, with its fixes." />
        </div>
        <Say tight style={{ marginTop: 10 }}>
          <p>Markers sit <strong>where the problem appears</strong>. Severity = <strong>what the result is worth</strong>: ✕ a number would be wrong or missing, ! it would mislead.</p>
        </Say>
      </Slide>

      {/* P1 · 1 Overview: what I built, shown on the first finding (F-01) ---------------------- */}
      <Slide
        cue="~2.5 min · at 5:45"
        src="README (What is here) · Cell_Phone_Drop/report/model.json · scenario, velocity, reference_mass, findings F-01 (choices, recommended), F-10 · v0.1/edits.json · v0.1 T01 (centre-of-mass velocity, checked after delivery)"
        notes={
          <>
            <p>On the right: the report's Overview page. "Page one answers one sentence: what hits what, how fast, how heavy, for how long. 27 grams of structure hit a rigid floor at 5.42 m/s, 19.5 km/h: exactly a 1.5 m drop. It lands on a corner, and one node of the rear cover already touches the floor at t = 0: the simulation starts at the moment of impact."</p>
            <p>"Before the details, what to look for. On every deck my tool does four things. It reports every error and warning, at the place where it appears. For each one it suggests at least two fixes, with what each costs. It recommends one, and the engineer can keep it or pick another with a click. And it compares the current run, v0, with a fixed one, v0.1: both actually run in the solver."</p>
            <p>"Here is the first finding, on this very page. F-01: the run stops at 0.1 ms, in the middle of the first hit. The choices are 0.5, 2 or 5 ms; 2 ms is recommended, and v0.1 ran it. Why it matters more than it looks: after a corner hit, the phone rotates about that corner and its far end slaps down, flatter, and that second hit can load the screen more than the first. The 2 ms run shows it coming: after about 1 ms the floor force is zero, yet the centre of mass still moves toward the floor at about 2.3 m/s."</p>
            <p>"F-10, a warning: 27 g is about 17 % of a real phone of these outside dimensions, 58 by 104 by 9 mm ships at roughly 140 to 175 g, so it lands with about a sixth of the energy: 0.40 J."</p>
            <p>If asked 'why 1.5 m': v = 5.425 m/s; v²/2g = 5425² / (2 × 9810) = 1,500 mm. If asked why 0.40 J here and 401.5 mJ later: 0.398 J is ½mv² of the 27 g; the solver's 401.5 mJ includes the ~1 % mass it adds at t = 0 (mass scaling, run settings). If asked about units: Radioss has none built in; this deck is Mg-mm-s (N, MPa, mJ), the bumper kg-mm-ms (kN, GPa, J); the report reads /BEGIN (backup slide "units").</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 · 1 Overview'} title="On every deck: report the problems, suggest fixes, recommend one, then re-run and compare" />
        <div className="focus">
          {STEPS.map((s, i) => (
            <div className="it" key={i}>
              <div className="num">{i + 1}</div>
              <div>
                <div className="tt">{s.t}</div>
                <div className="dd">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="card-demo mt-l">
          <div className="h"><Mark sev="error" /> <span className="fid">F-01</span> The run stops at 0.1 ms, in the middle of the first hit</div>
          <div className="opt"><span className="rb" />lengthen to 0.5 ms</div>
          <div className="opt rec"><span className="rb" />lengthen to 2.0 ms ★ recommended</div>
          <div className="opt"><span className="rb" />lengthen to 5.0 ms</div>
          <div className="opt"><span className="rb" />other (type your own)</div>
          <div className="foot">v0.1 ran the recommended 2 ms: the first hit is over at 0.665 ms, but the phone is still moving; a second hit (its far end slapping down) needs about 5 ms.</div>
        </div>
        <Fis style={{ marginTop: 16 }}>
          <F id="F-10" sev="warning" title="27 g is about 17 % of a real phone this size">
            A 58 × 104 × 9 mm phone weighs about 160 g, so this one lands with a sixth of the energy (0.40 J).
          </F>
        </Fis>
      </Slide>

      {/* P2 · 2 Geometry -------------------------------------------------------------------- */}
      <Slide
        cue="~3 min · at 8:15"
        src="Cell_Phone_Drop/report/model.json · assembly (through_thickness, collapsed_elements), findings F-06, F-09 · v0.1 T01 (hourglass per part) · node levels counted in Cell_Phone_Drop_0000.rad after delivery"
        notes={
          <>
            <p><b>Lightweight view.</b> The web view compresses the 130,000 solid elements into a lightweight browser view.</p>
            <p><b>Untick parts to look inside</b>, hide the floor, and <b>colour by thickness, mass, mesh size, or peak stress</b> after a run. The colour bar always carries its unit.</p>
            <p><b>Error F-06 (v0) / F-04 (v0.1): "11 thin parts are less than one element thick, so they cannot bend properly".</b> The two circuit boards are the phone's biggest modelling problem. They are only 0.4 mm thick and are meshed with a single layer of elements. When a plate bends, one face stretches and the other face is squeezed, so the simulation must "see" both faces. Each of these elements checks its state at one point only, in the middle, and from there it can't tell the two faces apart. As a result, the boards would barely resist bending. (That blindness has a name: the hourglass effect; the solver then adds an artificial stiffness, the hourglass stabiliser, which we will meet again in v0.1.) The fix is to re-mesh the boards as <b>shells</b>, a plate-type element that bends correctly with a single layer. Shells are also cheaper to compute. This needs a new mesh rather than a number edit, so v0.1 leaves it as a choice for the user.</p>
            <p><b>Warning F-09 (v0 F-09, v0.1 F-05): 468 mesh elements are squashed into a wedge shape.</b> All of them are in the two boards. A brick has eight corners; in these 468, some corners are listed twice, so the brick collapses into a wedge. The solver accepts that, but a wedge is less accurate. It is also smaller, and a smaller element needs a shorter time step, so the solver adds a little artificial mass there to keep the step. They are legal elements, so the recommended choice is to accept and report them.</p>
            <p>If asked for precision: the report's 'elements across' is thickness divided by mean edge length, a screening ratio, not a layer count; counted by node levels, the boards and ic chips have one layer, the micro-chips and the battery two. The screen and the camera connector are quadratic tets with four integration points: no hourglass modes, but one tet across, so under-resolved rather than hourglassing. Where the added mass actually sits I did not trace; the listing reports the total (1.02 % in v0). The smallest element in the model would need 26.5 ns; the deck spends 1 % mass to run at 37.4 ns.</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 · 2 Geometry'} title="Geometry: a light 3D view, and two mesh problems" />
        <div className="chips">
          <span className="chip2 acc">lightweight view</span>
          <span className="chip2 acc">untick parts to look inside</span>
          <span className="chip2 acc">colour by thickness, mass, mesh size, or peak stress</span>
        </div>
        <div className="mt">
          <F id="F-06" v01="F-04" sev="error" title="11 thin parts are less than one element thick, so they cannot bend properly" />
        </div>
        <BendFigure width={600} />
        <div className="mt">
          <F id="F-09" v01="F-05" sev="warning" title="468 mesh elements are squashed into a wedge shape" />
        </div>
        <WedgeFigure width={600} />
      </Slide>

      {/* P3 · 3 Materials ------------------------------------------------------------------- */}
      <Slide
        cue="~1 min · at 11:15 (below 'more details:' only if asked)"
        src="Cell_Phone_Drop/report/model.json · materials (law, youngs_modulus, rate_dependent), orphans, findings F-05, F-12"
        notes={
          <>
            <p>"This page says in words what each part is made of: how stiff it is, whether it resists more when hit fast, and whether it can break. The phone is a simple story: 16 of its 17 parts are perfect springs, LAW1: they never yield and never break. Only the rear cover, a plastic with a measured curve, LAW36, from 50 MPa yield to 65 MPa, can deform permanently."</p>
            <p>"F-05, an error: there is no failure rule anywhere. So 'does the screen crack?', the question a drop test is for, cannot be answered. I did not invent a failure strain. The recommended choice is to report the stress margin: compare the peak stress with a strength quoted separately. For glass the right quantity would be the maximum tensile stress, not von Mises, because glass breaks in tension."</p>
            <p><b>More details (only if asked).</b> The orange 'no' in the 'faster = stronger' column, on the rear cover: the impact is fast, and plastics get noticeably stiffer and stronger at high rates, so the cover's response is probably a little too soft. F-12, a note: two curves, a steel and a glass-fibre plastic, are defined and never used, and material ids 2, 3, 6 and 7 are missing: this deck was cut down from a richer model.</p>
            <p>If asked about the Poisson column: it shows '–' for the four elastic materials although the deck says 0.3; the field is spelled 'nu' in lowercase there and my extractor looked for 'Nu' (a one-line fix: match field names case-insensitively). If asked about '/FAIL/BRITTLE' in the choice text: the realistic cards for solid glass are /FAIL/TENSSTRAIN or /FAIL/ALTER; I'd verify solid support first.</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 · 3 Materials'} title="Materials: 16 of 17 parts never yield, and nothing can break" />
        <table className="tb big">
          <thead><tr><th>parts</th><th>behaves like</th><th className="num">stiffness</th><th>yields?</th><th>breaks?</th></tr></thead>
          <tbody>
            <tr><td><b>screen</b></td><td>glass, a perfect spring</td><td className="num">70 GPa</td><td>no</td><td>no</td></tr>
            <tr className="hl"><td><b>rear cover</b></td><td>plastic, measured curve</td><td className="num">2 GPa</td><td>yes, 50 → 65 MPa</td><td>no</td></tr>
            <tr><td><b>2 boards</b></td><td>a perfect spring</td><td className="num">15 GPa</td><td>no</td><td>no</td></tr>
            <tr><td><b>battery</b></td><td>a perfect spring</td><td className="num">2 GPa</td><td>no</td><td>no</td></tr>
            <tr><td><b>12 chips, camera…</b></td><td>a perfect spring</td><td className="num">2 GPa</td><td>no</td><td>no</td></tr>
          </tbody>
        </table>
        <Fis style={{ marginTop: 16 }}>
          <F id="F-05" sev="error" title="Nothing in the model can break: no failure limit anywhere">
            So "does the screen crack?" cannot be answered. ★ Report the stress margin; the other fix needs a measured failure strain for the glass.
          </F>
        </Fis>
        <More />
        <Fis>
          <F badge={'"no"'} sev="warning" title="The rear cover ignores impact speed (the report's 'faster = stronger' column)">
            The impact is fast, and plastics get noticeably stiffer and stronger at high rates, so the cover's response is probably a little too soft.
          </F>
          <F id="F-12" sev="info" title="Two curves are defined but never used">
            A steel and a glass-fibre plastic; material ids 2, 3, 6 and 7 are missing: the deck was cut down from a richer model.
          </F>
        </Fis>
      </Slide>

      {/* P4 · 4 Connections ----------------------------------------------------------------- */}
      <Slide
        cue="~2.5 min · at 12:15 · CHECKPOINT: here by 12:15"
        src="Cell_Phone_Drop/report/model.json · starter.interface_parts, unattached_parts, rigid_wall (d_search, friction, nodes_inside_search) · node distances to the floor counted from Cell_Phone_Drop_0000.rad after delivery"
        notes={
          <>
            <p>"The report lists the joins as a table; here they are as a graph, because the question is simply: what holds on to what? A solid line is glue, a tie: two surfaces stuck together from the start. A dashed line pushes without gluing: here only the floor, a rigid wall with friction 0.3. The 'joins' are computed from the mesh, not read off the interface names: every group is resolved down to mesh points and to the parts that own them."</p>
            <p>"The chain is striking: the two boards and all the chips hang on the housing only through the camera connector and the camera. And two red boxes have no line at all. F-04, an error: the battery and a big chip, ic_02, 6.6 g, a quarter of the mass, are glued to nothing, and there is no contact anywhere. Nothing stops them: they keep their starting speed and pass through whatever is in their way. You will see the proof in v0's stresses: essentially zero in those two parts."</p>
            <p>"F-11, a warning, the floor box at the bottom. A rigid wall only watches the mesh points that start within its search distance, and that list is never updated. Here it is 32.6 mm, but the phone is 97.7 mm deep along the fall direction. Only two of the phone's four corners are inside the watched zone: the impact corner and its neighbour on the short edge. After the phone tips, the far end could fall through the floor unnoticed, and ic_02, with none of its mesh points watched, eventually would. The battery is 74 % watched. v0.1 widens it to 117.3 mm, the depth plus 20 %."</p>
            <p>If asked 'are all nodes now watched?': no, the Starter still removes 10,480 tied nodes from the wall, because a node cannot obey two kinematic constraints; they are held by their main surface. If asked about the trap: node-group ids and surface ids are separate namespaces, both starting at 1; looking an id up in both makes every interface touch every part.</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 · 4 Connections'} title="Connections: only glue, no contact, and a quarter of the mass is attached to nothing" />
        <PhoneGraph width={600} />
        <Fis style={{ marginTop: 8 }}>
          <F id="F-04" sev="error" title="The battery and ic_02 (6.6 g, 24 % of the mass) are glued to nothing">
            And there is no contact anywhere: nothing stops them, they keep their starting speed.
          </F>
          <F id="F-11" sev="warning" title="The floor only watches what starts within 32.6 mm of it">
            The phone is 97.7 mm deep: only <b>2 of its 4 corners</b> are watched. After the phone tips, the far end could pass through the floor, and ic_02 (none of it watched) eventually would.
          </F>
        </Fis>
      </Slide>

      {/* P5 · 5 Run settings ---------------------------------------------------------------- */}
      <Slide
        cue="~1.5 min · at 14:45 (F-08 below 'more details:' only if asked)"
        src="Cell_Phone_Drop/Cell_Phone_Drop_0001.rad · report/model.json engine.cards, findings F-01, F-02, F-03, F-07, F-08"
        notes={
          <>
            <p>"The run file is thirty lines, and it decides whether any result can answer the question. Here are the lines that matter, as they are in the deck. The 0.1 ms on top we already met."</p>
            <p>"F-02, an error: the curves are recorded every 1 ms, ten times longer than the whole run, so the curves file has exactly one row, and the solver says nothing about it. F-03, an error: there are no time-history cards at all: no force on the floor, no energy per part, so 'how hard does the floor hit back' and 'which part absorbs the blow' are unanswerable however long you run."</p>
            <p>"F-07, a warning: the safety stop is set at 99 % energy error, and the solver caps that number at 99 %, so it can never trigger."</p>
            <p>"One more line looks harmless: the third number of /DT/NODA/CST, 0.01, is an added-mass budget. The solver adds about 1 % of mass at the start to keep the time step at 37 nanoseconds: that is the mechanism behind the wedge warning."</p>
            <p>"None of these is in Radioss's own 287-check catalogue: it has no rows for the run file. Coming from crash tests, this page felt familiar: a /TH card is a sensor channel."</p>
            <p><b>More details (only if asked).</b> F-08: parallel arithmetic is off, so four cores and eight cores give slightly different answers; for a surrogate training set that is label noise.</p>
            <p>If someone has seen the report's tile '0 µs smallest allowed time step … 0 means never': misleading for the phone, for exactly the added-mass reason (it is on my list of warts). The /STOP flag NERR_POSIT = 1 means only a positive energy error (energy created) trips it: the right instability alarm.</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 · 5 Run settings'} title="The run file: 30 lines that stop the clock at 0.1 ms and record almost nothing" />
        <RunFile title="Cell_Phone_Drop_0001.rad, the lines that matter" lines={[
          { code: '/RUN/Cell_Phone_Drop/1/' },
          { code: '               1e-4', sev: 'seen', tag: 'F-01', note: '0.1 ms (page 1)' },
          { code: '/TFILE/4' },
          { code: '0.001000', sev: 'error', tag: 'F-02', note: 'curves every 1 ms' },
          { code: '(no /TH card at all)', sev: 'error', tag: 'F-03', note: 'nothing measured', missing: true },
          { code: '/STOP' },
          { code: '0.99 0.05 0 1 1 1', sev: 'warning', tag: 'F-07', note: 'stop at 99 %' },
          { code: '/PARITH/OFF', sev: 'warning', tag: 'F-08', note: 'core count' },
          { code: '/DT/NODA/CST/0' },
          { code: '0.9 0 1e-2', sev: 'info', tag: 'note', note: '1 % mass added' },
        ]} />
        <Fis style={{ marginTop: 14 }}>
          <F id="F-02" sev="error" title="Curves every 1 ms in a 0.1 ms run: 1 data point, no curve" />
          <F id="F-03" sev="error" title="Nothing is measured over time: no floor force, no energy per part" />
          <F id="F-07" sev="warning" title="Safety stop at 99 % energy error: the solver caps that number at 99 %, so it can never trigger" />
        </Fis>
        <More />
        <Fis>
          <F id="F-08" sev="warning" title="/PARITH/OFF: the answer changes slightly with the number of CPU cores" />
        </Fis>
      </Slide>

      {/* P6 · 6 Results (v0) ---------------------------------------------------------------- */}
      <Slide
        cue="~45 s · at 16:15 (below 'more details:' only if asked)"
        src="Cell_Phone_Drop/report/model.json · run.energy_split_end, ke_removed_fraction, energy_error_max_pct, mass_error_final · v0/Cell_Phone_Drop_0001.out"
        notes={
          <>
            <p>"For v0 the bar says it all: when the run stops, 93 % of the impact energy is still motion, 6.5 % is stored in the phone, 0.5 % went into the floor. The impact has barely started."</p>
            <p><b>More details (only if asked).</b> Every peak, force, deceleration, stress, comes after 0.1 ms, so all v0 values are too low. 'Normal termination' only means the solver did not crash, so this page asks four questions a usable run must pass. Is the impact over? No (93 % still motion). Do the energy books close? Yes, 0.0 %, but only because almost nothing has happened yet. Is the added mass small? Yes, 1 %, under the usual 5 % limit. Is the stabiliser energy small? We cannot know: nothing was recorded, that is F-03.</p>
            <p>Precision if asked: the energy curves come from the Engine listing (one row every 100 cycles), the energy table from the T01 curves file; that is why v0 still has a curve although its T01 file has a single row. Cycles: the tile says 2,600 because the report reads the last printed listing row; the exact total is 2,676, in 11 minutes on 8 threads. The report's 'below about 2 % is harmless' added-mass tile is its conservative display threshold; Altair's guidance and the /STOP mass limit are 5 %.</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 · 6 Results'} title="Results v0: the run stops with 93 % of the energy still in motion" />
        <EnergySplit rows={[{ name: 'v0', sub: 'at 0.1 ms', phone: 6.5, floor: 0.5, motion: 93 }]} />
        <More style={{ marginTop: 20 }} />
        <div className="kicker">The four checks of a usable run</div>
        <table className="tb checks">
          <tbody>
            <tr><td><b>1 · Is the impact over?</b></td><td className="st no">✕ no</td><td>93 % of the energy is still motion (F-01)</td></tr>
            <tr><td><b>2 · Do the energy books close?</b></td><td className="st ok">✓ yes</td><td>0.0 %: almost nothing has happened yet</td></tr>
            <tr><td><b>3 · Is the added mass small?</b></td><td className="st ok">✓ yes</td><td>1.0 % (limit 5 %)</td></tr>
            <tr><td><b>4 · Is the stabiliser energy small?</b></td><td className="st na">? unknown</td><td>not recorded (F-03)</td></tr>
          </tbody>
        </table>
        <Say tight style={{ marginTop: 14 }}>
          <p>"Normal termination" only means <strong>the solver did not crash</strong>.</p>
          <p>Every peak (force, stress) comes after 0.1 ms: <strong>all v0 values are too low</strong>.</p>
        </Say>
      </Slide>

      {/* P7 · 7 Engineering ----------------------------------------------------------------- */}
      <Slide
        cue="~2 min · at 17:00 (behind? one view only: 'What I need to know')"
        src="Cell_Phone_Drop/report/model.json · engineering_review (critical_dimensions, tolerances), assembly.through_thickness · layers counted in Cell_Phone_Drop_0000.rad after delivery · materials (boards: LAW1, 15 GPa)"
        notes={
          <>
            <p>The switch at the top shows each answer three ways: the picture, what you need to know, the full table. It is the "three views" item of future work, shown working here. Click it with the mouse (it never takes the keyboard focus, so Space still advances).</p>
            <p>"The Engineering page asks the questions a design engineer asks before trusting a model. First: what will the engineer look at? The goal of this simulation is to see how each part resists a phone drop, so the engineer looks at how the thinnest parts bend: the 0.30 mm chips and the 0.40 mm boards. Nine of the eleven thin parts are one-point bricks, which run under hourglass control, the artificial stiffness from page two; in the boards and the two ic chips, one layer thick, it is what bends them. So exactly where the engineer looks, the results are hard to trust."</p>
            <p>"Did we model the manufacturing errors? No: every dimension is one exact number. Real parts vary, so real drops scatter around this answer, and one deck cannot say by how much."</p>
            <p>"Did we model the manufacturing history? No. A part that was bent or pressed is thinner and harder at the bend; here thickness and material are uniform everywhere. The boards are one uniform material, while a real board is layers of copper and glass-fibre epoxy."</p>
            <p>If asked how to measure the scatter: the deck is plain text, so a tolerance study is N copies with slightly different sizes, each run once; the bumper's thickness study (every sheet ±20 %) does exactly that. If spotted on the page: the red numbers are the same 'elements across' screening ratio as on Geometry; 'Can it be made?' is empty for the phone and the tolerance text mentions pressing and welding: templated text written for sheet metal. On the bumper this page measures the spot-weld pitch, 18 to 20 mm.</p>
          </>
        }
      >
        <Head kicker={K + ' · 7 Engineering'} title="Engineering: would a real, manufactured phone behave like this one?" />
        <Views items={[
          {
            q: 'What will the engineer look at?',
            visual: <ThinVisual width={600} />,
            know: <>The goal of this simulation is to see how each part resists a phone drop. The engineer looks at how the thinnest parts bend: <b>0.30 mm</b> chips and <b>0.40 mm</b> boards. Hourglass control affects most of them, so their <b>results are hard to trust</b>.</>,
            table: <ThinTable />,
          },
          {
            q: 'Did we model the manufacturing errors?',
            visual: <ToleranceVisual width={600} />,
            know: <><span className="no">No.</span> Every size is one exact number. Real parts vary, so real drops scatter around this answer, and one deck cannot say by how much.</>,
            table: (
              <table className="tb">
                <thead><tr><th style={{ width: 112 }} /><th>in the deck</th><th>in a real phone</th></tr></thead>
                <tbody>
                  <tr><td><b>sizes</b></td><td>one exact value (board 0.40 mm)</td><td>vary within a tolerance</td></tr>
                  <tr><td><b>tolerances</b></td><td className="bad">none</td><td>on the supplier's drawings</td></tr>
                  <tr><td><b>the answer</b></td><td>one number per output</td><td>a scatter, of unknown width</td></tr>
                </tbody>
              </table>
            ),
          },
          {
            q: 'Did we model the manufacturing history?',
            visual: <HistoryVisual width={600} />,
            know: <><span className="no">No.</span> A bent or pressed part is thinner and harder at the bend; here thickness and material are uniform. The boards are one uniform material; a real board is layers of copper and glass-fibre epoxy.</>,
            table: (
              <table className="tb">
                <thead><tr><th style={{ width: 112 }} /><th>in the deck</th><th>as made</th></tr></thead>
                <tbody>
                  <tr><td><b>board material</b></td><td>one uniform material, 15 GPa</td><td>copper + glass-fibre epoxy layers</td></tr>
                  <tr><td><b>thickness</b></td><td>the same everywhere</td><td>thinner where bent or pressed</td></tr>
                  <tr><td><b>at a bend</b></td><td>unchanged</td><td>harder where it was bent</td></tr>
                </tbody>
              </table>
            ),
          },
        ]} />
      </Slide>

      {/* P8 · 8 Findings -------------------------------------------------------------------- */}
      <Slide
        frame="mid"
        cue="~2 min · at 19:00"
        src="report Findings step (phone v0) · src/findings.py detect() (sort: severity, then rule order) · src/main.py, src/fixes.py build_v01() · a real interaction.txt saved from the page"
        notes={
          <>
            <p>"Everything we have met is collected on the Findings page, sorted from the most important to fix: errors first, then warnings, then notes. The table shows where each one appeared on the pages we just walked; only the note F-12 has no marker on a page."</p>
            <p>On the right: open one card on the Findings page. "Every card has the same four parts: where we saw it, with the file and card; why it happens; what it means for the numbers; and two to four concrete fixes with their cost. One is recommended. Hovering a fix shows its reason and cost: for the run length, 'lengthen to 2.0 ms: about 20 times the v0 run'."</p>
            <p>"How the answers are used: v0.1 applies every recommended fix with a script, because nobody had answered yet. If you disagree, you click another fix, a radio button, and 'Save interaction.txt' writes your answers. That file builds the next version: here a reader picked 5 ms instead of 2 ms, so this file would build a 5 ms v0.2. An answer the builder cannot interpret, or a dismissal, lands in edits.json under not_applied, with the reason. Nothing is silently dropped."</p>
            <p>If asked who chose the recommendations: I did, with the AI, from mechanism and cost; the README states it as an assumption, and the reader's answer overrides it (a test pins that). If asked about the command: python src/main.py --v01 builds v0.1 from interaction.txt when the file exists, and from the recommended answers otherwise; --build v0.2 builds the next one.</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 · 8 Findings'} title="Findings: sorted from the most important to fix, each with fixes to choose from" />
        <Say tight>
          <p>Sorted by importance: <strong>errors first</strong>, then warnings, then notes.</p>
          <p>Each card: where · why · what it means · <strong>2+ fixes</strong>, one recommended ★.</p>
        </Say>
        <div className="row mt" style={{ gap: 14 }}>
          <div className="col" style={{ flex: 1, gap: 4 }}>
            <div className="kicker">Where each one was met</div>
            <table className="tb where">
              <tbody>
                {WHERE.map(([page, ids]) => (
                  <tr key={page}>
                    <td>{page}</td>
                    <td><span className="fx">{ids.map(([id, sev]) => <span key={id} className={sev}>{id}</span>)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <figure className="code-fig" style={{ width: 296 }}>
            <pre className="code">{INTERACTION}</pre>
            <figcaption>A reader picked <b>5 ms</b> instead of ★ 2 ms.</figcaption>
          </figure>
        </div>
        <div className="say tight mt">
          <p><strong>v0.1</strong> = every ★ fix, applied by a script (nobody had answered yet).</p>
          <p><strong>Your clicks</strong> → Save interaction.txt → they build the <strong>next version</strong> (v0.2).</p>
        </div>
      </Slide>

      {/* P10 · v0.1 results: what each fix revealed ----------------------------------------- */}
      <Slide
        cue="~2 min · at 21:00 · CHECKPOINT: here by 21:00"
        src="Cell_Phone_Drop/report/model_v0.1.json · run (t_ke_min 0.665 ms, ke_removed_fraction, energy_split_end), energy_sources.parts, assembly.peak_von_mises, findings F-01, F-02, F-07"
        notes={
          <>
            <p>"v0.1 applies the recommended fix of seven findings, with a script, to copies of the decks, and runs them in the solver; the list of the seven is a backup slide. The 2 ms run answers questions the original could not. The bars: at 0.1 ms, 93 % of the energy was still motion; at 2 ms, 57 % of the impact energy is still motion energy, so the phone is still moving: 23 % has gone into the floor, 15 % is stored in the phone, and about 5 % went to friction and the stabiliser."</p>
            <p>"Read the table row by row: the v0 finding, the fix, what it showed, and the new finding it raised. F-01: with 2 ms, the first hit is over at 0.665 ms, the slowest moment; but the phone still moves at 2 ms, so v0.1 raises its own F-01: run 5 ms for the second hit. F-03: with sensors, we learn that the rear cover takes 69 % of the blow; but I added the sensors without the card that names them, so the channels came out as unnamed impulses, and v0.1 flagged that itself as a new F-02; the builder now adds both. F-04: with contact, the battery and ic_02 finally carry load; and the loose battery shows the hourglass effect, the new warning F-07 (its energy books are a backup slide, "can we trust v0.1")."</p>
            <p>Nuance if asked: 'share' is each part's peak deformation energy divided by the sum of all parts' peaks; the peaks happen at different times, so it ranks how much each part had to carry at its worst. Why the floor takes more than the phone keeps: a rigid wall removes the normal velocity of each node that reaches it and books it as external work; it idealises the local crush. The two moments: at 0.665 ms the phone holds 22 % and the floor has taken 20 %; the 15 / 23 / 57 split is at 2 ms. Floor-force peak ≈ 149 N at ≈ 0.23 ms (differentiated from the impulse channel after delivery).</p>
          </>
        }
      >
        <Head kicker={K + ' · v0.1 · 6 Results'} title="v0.1 results: what each fix showed, and what it raised next" />
        <EnergySplit rows={[
          { name: 'v0', sub: 'at 0.1 ms', phone: 6.5, floor: 0.5, motion: 93 },
          { name: 'v0.1', sub: 'at 2 ms', phone: 15, floor: 23, lost: 5, motion: 57 },
        ]} />
        <div className="note">At 2 ms, 57 % of the impact energy is still motion energy: the phone is still moving.</div>
        <table className="tb small mt" style={{ fontSize: 13.5 }}>
          <thead><tr><th>v0 finding</th><th>fixed by</th><th>what it showed</th><th>new in v0.1</th></tr></thead>
          <tbody>
            {REVEALED.map((r) => (
              <tr key={r.f}>
                <td><Mark sev={r.sev} /><b>{r.f}</b> {r.what}</td>
                <td>{r.fix}</td>
                <td>{r.saw}</td>
                <td>{r.next ? <><Mark sev={r.next[1]} /><b>{r.next[0]}</b> {r.next[2]}</> : <span style={{ color: 'var(--muted)' }}>–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Slide>

      {/* P11 · v0.1 results: stress and energy per part ------------------------------------- */}
      <Slide
        cue="~1.5 min · at 23:00 · last phone slide"
        src="Cell_Phone_Drop/report/model.json vs model_v0.1.json · assembly.peak_von_mises, peak_time · model_v0.1.json run.energy_sources.parts (share_of_peaks)"
        notes={
          <>
            <p>"Two charts answer the drop-test question. Highest stress per part, v0 in grey, v0.1 in teal. The screen goes from 60 to 84 MPa, the rear cover stays around 85. The battery and ic_02 read zero in v0, because nothing loads a part that is attached to nothing; with contact and a longer run they carry 31 and 75 MPa. The camera connector jumps from 0.3 to 117 MPa: that is the longer run, not the contact; it was glued all along and peaks at 1.28 ms."</p>
            <p>"And which part absorbs the blow? v0 could not say: no part had an energy sensor. v0.1 records it: the rear cover takes 69 %, the screen 10 %, the battery 6 %. That makes sense: the cover is the part that hits, and the only one that can deform permanently."</p>
            <p>If asked about the camera connector: my reading, plausible, not proven: the whole board stack hangs on the housing only through the camera and its connector (the connections graph), so the stack whips on that link; I'd check the element location before trusting the number. If asked 'the rear cover reads 84 to 86 MPa, above its own flat 65 MPa curve': most likely an overshoot from extrapolating stress to the nodes (/ANIM/GPS); the element-mean output would settle it.</p>
            <p>Hand-over: "That is the full loop on one model; what I would decide for v0.2 is in the backup. The bumper uses the same nine pages, so I'll only show what is new there."</p>
          </>
        }
      >
        <Head kicker={K + ' · v0.1 · 6 Results'} title="v0.1 answers the drop-test question: where the blow goes" />
        <StressBars width={600} />
        <div className="mt" />
        <PartShares width={600} />
      </Slide>
    </Stack>
  )
}

// Backup 1 (the first backup slide): the v0.2 decisions, moved out of the main path.
export function PhoneV02() {
  return (
    <>
      {/* P14 · v0.2: the engineer's decisions ------------------------------------------------ */}
      <Slide
        uncounted
        cue={BACKUP_CUE}
        src="Cell_Phone_Drop/report/model_v0.1.json findings (v0.1 ids) · v0.1/run_metadata.json (5,660 s, 8 threads) · v0.1/Cell_Phone_Drop_0001_0001.rst (382 MB) · v0.1 T01 hourglass per part · v0.1/Cell_Phone_Drop_0000.out (nodal time steps, added-mass table) · all read after delivery"
        notes={
          <>
            <p>"v0.1 applied what a script may decide. Here is what I would decide as the engineer for v0.2, with v0.1's ids; where a finding was renumbered, its v0 id is under it."</p>
            <p>"F-01, the 5 ms run for the second hit. From scratch that is about four hours: 47 minutes per simulated millisecond on 8 threads. Two ways to get the same answer faster. The 2 ms run saved its whole state in a restart file, 382 MB, so a restart computes only the last 3 ms: about 2.4 hours. And since v0.1 sets /PARITH/ON, the answer no longer depends on the core count, so the run can go on more cores without changing a digit. What does not pay: more added mass. The listing's own table says 5 % added mass instead of 1 % lengthens the time step by only 10 %, from 37.4 to 41.2 ns."</p>
            <p>"F-04, the old F-06: shells for the boards, the chips and the screen. The gain is accuracy first: a shell bends through its own thickness, so the boards stop relying on the artificial stiffness from page 2. That is the link to F-07: of the energy the solver spends on that artificial stiffness, the boards take 31 %, and shells remove it. There is a speed gain too: the time step is set by the screen, all of the 400 smallest nodal time steps are glass nodes; as shells they would no longer set it. I have not measured by how much. The cost: a pre-processor job, a mid-surface, a shell mesh, the chips re-tied to it. Routine for a CAE engineer, but not something a script should do to a text file."</p>
            <p>"The battery: it is loose and rattles inside the phone, and of all the energy the solver spends on artificial stiffness, 67 % is spent in the battery. So: glue it where the real adhesive is. The sure fix: fully integrated bricks, which need no artificial stiffness, at two to four times the cost of that part. ic_02 has two holes in the model: two screws through them pass its load to the board."</p>
            <p>"F-06, the mass: 27 g in a 58 by 104 by 9 mm phone is 0.5 g per cubic centimetre; real phones are around 2.0. I'd ask the customer for the real weight and add the difference as non-structural mass. F-03, failure: compare the glass's peak tensile stress with its strength to see how close it is to cracking; with a measured failure strain, add it to the model so the crack appears in the simulation."</p>
            <p>If asked about shells first, then 5 ms: a new mesh cannot restart from v0.1's state, so it is a choice: the restart gives the second hit today; the shell mesh gives a better and faster model for every later run. If asked how 2.0 g/cm³ squares with the report's ~160 g: 2.0 g/cm³ × 54.3 cm³ ≈ 110 g, so 27 g is about a quarter of a real phone this size; the report's 140–175 g range comes from larger phones. If asked how much F-07 drops with shell boards: about a third of it, 15.5 % → roughly 10.5 %, if the battery's share stays as it is.</p>
          </>
        }
      >
        <Head kicker={'Backup · ' + K + ' · v0.2 · ids as in v0.1'} title="v0.2: the decisions I would take as the engineer" />
        <div className="dec">
          {V02.map(({ k, v0, sev, v, sub }) => (
            <React.Fragment key={k}>
              <div className={`k ${sev}`}>{k}{v0 && <span className="v0">v0 {v0}</span>}</div>
              <div className="v">
                {v}
                {sub && <div className="sub">{sub.map((s, i) => <div key={i}>{s}</div>)}</div>}
              </div>
            </React.Fragment>
          ))}
        </div>
      </Slide>
    </>
  )
}

// Backup: the seven v0.1 fixes (the v0.1 results slide shows what each one revealed).
export function PhoneFixes() {
  return (
    <>
      {/* P9 · v0.1: the fixes --------------------------------------------------------------- */}
      <Slide
        uncounted
        cue={BACKUP_CUE}
        src="Cell_Phone_Drop/v0.1/edits.json · deck.diff (71 lines) · README 'v0 and v0.1' run table (631 s / 5,660 s)"
        notes={
          <>
            <p>"v0.1 is not me editing the decks by hand. A script applies each recommended answer to copies of the pristine files and writes edits.json and the exact deck.diff; the originals are checked by SHA-256 on every test run."</p>
            <p>"Seven fixes. F-01: the run goes from 0.1 to 2 ms. That covers the whole first hit, which is over at 0.665 ms, for 94 minutes of computer time instead of 11; 5 ms would take about four hours. F-02: curves every 0.01 ms, 200 points instead of one. F-03: a force sensor on the floor and the energy of every part. F-04: one contact over all 17 parts, friction 0.1. F-07: a safety stop that can actually trigger, at 10 %. F-08: repeatable arithmetic. F-11: a floor that watches the whole phone."</p>
            <p>"Five are left for the engineer, on purpose. Each needs information the deck does not contain, or a new mesh: a failure strain for the glass, the real mass of the phone, a shell mesh for the boards. A script must not invent those; the engineer's answer builds v0.2. The wedges and the unused curves are legal as they are."</p>
            <p>"And before any long run, each patched deck was smoke-tested: the Starter plus a few hundred cycles. That one-minute check caught a real error before a 94-minute run: a contact surface over solid parts must be /SURF/PART/EXT, the outer skin; plain /SURF/PART stops the Starter with ERROR 1104. That rule is now written into the agent skill."</p>
            <p>On the right: the v0.1 switch; every place a fix changed carries a green tick, and hovering it shows the edit.</p>
          </>
        }
      >
        <Head kicker={'Backup · ' + K + ' · v0.1 · 9 v0 vs v0.1'} title="v0.1: seven fixes applied by a script, five left for the engineer" />
        <div className="kicker">Applied automatically: the ★ fix of each finding</div>
        <Fis style={{ gap: 7, marginTop: 4 }}>
          <F id="F-01" sev="fixed" title="Run 0.1 → 2 ms">covers the whole first hit (over at 0.665 ms) for 94 min of computer time instead of 11; 5 ms would take ~4 h</F>
          <F id="F-02" sev="fixed" title="Curves every 0.01 ms: 200 points instead of 1" />
          <F id="F-03" sev="fixed" title="Sensors: force on the floor, energy of every part" />
          <F id="F-04" sev="fixed" title="One contact over all 17 parts (friction 0.1)" />
          <F id="F-07" sev="fixed" title="Safety stop at 10 % energy error (was 99 %)" />
          <F id="F-08" sev="fixed" title="/PARITH/ON: the same answer on any number of cores" />
          <F id="F-11" sev="fixed" title="The floor watches 117.3 mm: the whole phone + 20 %" />
        </Fis>
        <div className="kicker mt-l">Left for the engineer: F-05 · F-06 · F-09 · F-10 · F-12</div>
        <Say tight style={{ marginTop: 4 }}>
          <p>They need what the deck does not hold: a <strong>failure strain</strong> for the glass, the <strong>real mass</strong>, a <strong>shell mesh</strong>. A script must not invent them: the engineer's answer builds v0.2. (Wedges and unused curves are legal as they are.)</p>
        </Say>
        <Callout title="Smoke test before the long run" style={{ marginTop: 12 }}>
          Starter + a few hundred cycles on every patched deck: it caught <code>/SURF/PART</code> vs <code>/SURF/PART/EXT</code> (ERROR 1104) <b>before</b> a 94-minute run. The rule is now in the skill.
        </Callout>
      </Slide>
    </>
  )
}

// Backup: can we trust v0.1? The energy books of the 2 ms run.
export function PhoneTrust() {
  return (
    <>
      {/* P12 · can we trust v0.1 ------------------------------------------------------------ */}
      <Slide
        uncounted
        cue={BACKUP_CUE}
        src="v0.1 Engine listing (ERROR column, -6.8 %) · Cell_Phone_Drop/report/model_v0.1.json energy_sources (balance_raw_pct -5.26, friction 3.36, hourglass 2.17, balance_closed_pct +0.28, hourglass_to_internal_max 0.155) · v0.1 T01 (hourglass per part)"
        notes={
          <>
            <p>"Can we trust v0.1? The solver keeps energy books. At 2 ms: the phone hit the floor with 401.5 mJ, and the floor took 91.5 of them, so 310 mJ should still be in the phone, as motion or as deformation. The solver finds 288.9 mJ. About 21 mJ are missing."</p>
            <p>"Now the two percentages, which are the same 21 mJ. The solver's error column divides by what should be left, 310 mJ: 6.8 %. The report divides by the impact energy, 401.5 mJ: 5.3 %, and that is the scale of the chart, which is why it starts at −5.3 and not −6.8."</p>
            <p>"Where are the 21 mJ? The error column does not count two sinks. Friction in the new contact took 13.5 mJ: that is physics. The hourglass stabiliser took 8.7 mJ: that is numerical. Put both back and 1.1 mJ are left over, +0.3 %: the books close. And the sign matters: negative means energy lost, not created, so this is not an instability; the safety stop only trips on a positive error."</p>
            <p>"The stabiliser is the hourglass effect from page two: one-point elements that cannot see their own bending. It holds 15.5 % of the deformation energy at its peak, above the usual 10 %: a new warning, F-07, raised by v0.1 itself. Two thirds of it sits in the loose battery, a block of two-layer bricks, the rest in the one-layer boards, none in the tetrahedral parts. The fix is the one from F-06: shells, plus a real attachment for the battery."</p>
            <p>Formula if asked: ERROR = (motion + deformation) ÷ (energy at the start + work of the external forces) − 1; the floor's work is negative (it takes energy). Altair's divergence hints: a positive error, or a negative error beyond −15 %.</p>
          </>
        }
      >
        <Head kicker={'Backup · ' + K + ' · v0.1 · 6 Results'} title="Can we trust v0.1? 21 mJ are missing from the energy books, and we can name them" />
        <div className="eq">
          <div>at impact <span className="hl">401.5</span> − taken by the floor <span className="hl">91.5</span> = <b>310.0 mJ</b> should be left</div>
          <div>found in the phone (motion + deformation) = <b>288.9 mJ</b></div>
          <div>missing = 310.0 − 288.9 = <span className="or">21.1 mJ</span></div>
        </div>
        <div className="row mt" style={{ gap: 10, alignItems: 'stretch' }}>
          <Callout tone="plain" title="the solver's error column" style={{ flex: 1 }}>21.1 ÷ 310 = <b>6.8 %</b> of what should be left</Callout>
          <Callout tone="plain" title="the report, and this chart" style={{ flex: 1 }}>21.1 ÷ 401.5 = <b>5.3 %</b> of the impact energy</Callout>
        </div>
        <EnergyBooks width={600} height={226} />
        <Fis style={{ marginTop: 6, gap: 8 }}>
          <F id="F-09" sev="info" title="(new in v0.1) The books drift by up to 6.8 %: all of it is friction + stabiliser" />
          <F id="F-07" sev="warning" title="(new in v0.1) The stabiliser holds 15.5 % of the deformation energy (usual limit 10 %)">
            The hourglass effect of F-06 (page 2); two thirds of it in the loose battery. Same fix: shells, and attach the battery.
          </F>
        </Fis>
      </Slide>
    </>
  )
}

// Backup: the phone in one table.
export function PhoneTable() {
  return (
    <>
      {/* P13 · the phone in one table ------------------------------------------------------- */}
      <Slide
        uncounted
        cue={BACKUP_CUE}
        src="Cell_Phone_Drop/report/model.json and model_v0.1.json findings · v0.1/edits.json"
        notes={
          <>
            <p>"The phone in one table: twelve findings on the deck as delivered, six errors, five warnings, one note. Seven fixed by v0.1 from the recommended answers; five left for the engineer because they need new data or a new mesh, each with its recommended choice. v0.1 keeps F-01, now 'run 5 ms for the second hit', and raises three new ones itself: the unnamed sensor channels, the stabiliser share, and the 6.8 % drift in the energy books, all explained. After v0.1: four errors, three warnings, two notes."</p>
          </>
        }
      >
        <Head kicker={'Backup · ' + K + ' · all findings'} title="The phone in one table: 12 findings, 7 fixed by v0.1, 5 left for the engineer" />
        <table className="tb small fl">
          <thead><tr><th style={{ width: 48 }}>id</th><th>finding (v0)</th><th style={{ width: 150 }}>v0.1</th></tr></thead>
          <tbody>
            {ALL.map(([id, sev, t, fix]) => (
              <tr key={id}>
                <td><Mark sev={sev} /><b>{id}</b></td>
                <td>{t}</td>
                <td>{fix.startsWith('✓') ? <span className="fx">{fix}</span> : <span className="left">{fix}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="new-row">
          <b>Raised by v0.1 itself (v0.1 ids):</b>
          <span><Mark sev="error" /> <b>F-01</b> stays: still moving at 2 ms <i>→ ★ run 5 ms</i></span>
          <span><Mark sev="error" /> <b>F-02</b> new: sensor channels unnamed <i>→ the builder now adds /TH/TITLE</i></span>
          <span><Mark sev="warning" /> <b>F-07</b> new: stabiliser 15.5 % <i>→ ★ shells</i></span>
          <span><Mark sev="info" /> <b>F-09</b> new: books drift 6.8 %, all explained <i>→ ★ accept and state it</i></span>
        </div>
      </Slide>
    </>
  )
}
