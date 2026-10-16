import React from 'react'
import { Slide, Head, Say, Shot, Callout, Stat, Stats, Card } from '../components'
import { KeywordBars, ThinParts, BumperBooks, Flow } from '../charts'
import { PhoneV02, PhoneFixes, PhoneTrust, PhoneTable } from './04_Phone.jsx'
import { BumperV02 } from './05_Bumper.jsx'
import { SkillBuiltOn } from './06_Skill.jsx'

// Backup slides, stacked below the Q&A slide (11_QA.jsx renders <Backup /> inside its stack).
// All are data-visibility="uncounted", so the slide number ends at the Q&A slide.
// The first six were cut from the main path for the 60 minutes and live with their columns (04_Phone, 05_Bumper,
// 06_Skill): the phone's v0.2 decisions open the backup, as the first slide to show if there is time left.
// Numbers: kb/04_keywords.md (glossary, units, keyword counts), README (runs, assumptions, left out),
// kb/02_phone.md §2-4, kb/03_bumper.md §2-4 (§4: the bumper's energy error).
const K = 'Backup'
const BACKUP_CUE = 'backup · only if asked'

// B1 glossary: plain meaning, then where it shows up in these two decks (kb/04 §5 "Plain" + "In these decks").
const GLOSSARY_MODEL = [
  ['Node · element · mesh', 'the part cut into small simple pieces (elements) joined at corner points (nodes)', 'bumper 13,832 nodes, 13,704 elements; phone 257,099 / 130,218'],
  ['Explicit solver', 'many tiny, cheap time steps; the smallest, stiffest element sets the pace', 'bumper 100,000 steps of 1 µs; phone steps of 37 ns'],
  ['Starter · Engine', 'the Starter reads and checks the model file; the Engine runs the clock', 'model files: 28,629 / 629,265 lines; run files: ~20 / 30 lines'],
  ['Shell · solid', 'shell = a flat tile with a thickness number; solid = a small 3D block', 'bumper: shells only; phone: solids only, even 0.3 mm plates'],
  ['Triangle · quad shell', 'a 3-corner tile can only stretch uniformly, so it is stiffer', '28 triangles vs 13,598 quads'],
  ['Thin plate, one element thick', 'to bend, one face stretches, the other squeezes; one brick across cannot tell them apart', 'phone boards: exactly one brick layer (F-06)'],
  ['Property · material', 'material = what the stuff is; property = how this piece is modelled (thickness, points)', 'DP1000 at 1.8 mm on 10 beam parts; DP600 at 2.2 mm on 4'],
  ['Spring · spot weld', 'a welded dot every ~2 cm along a flange, as a 2-node connector', '78 welds, pitch 18–20 mm, never break'],
  ['Rigid body · lumped mass', 'nodes welded into one block, plus weight for what is not modelled', 'the "car": 108 nodes + 500 kg'],
]
const GLOSSARY_PHYSICS = [
  ['Stress', 'how hard the material is pulled or pushed, per unit area', 'phone cover 84.2 MPa (v0); bumper 0.7 GPa (v0.1)'],
  ['Strain · plastic strain', 'stretch relative to length; plastic = the part that stays', 'bumper v0.1 peak 34.6 %'],
  ['Von Mises stress', 'one number for how close a metal is to yielding', 'for glass: the max principal stress'],
  ['Elastic · plastic · yield', 'a ruler springs back, a paper clip stays bent; yield is the switch', 'phone LAW1 = elastic only; cover 50 → 65 MPa'],
  ['Failure · element deletion', 'too much stretch and the element tears; the solver removes it', 'bumper v0.1: 0 → 65 torn; phone: none'],
  ['Tie · contact', 'tie = glue from t = 0; contact = parts cannot pass through each other', 'phone: 14 ties, 0 contacts; bumper: 12 ties + 1 contact'],
  ['Hourglass energy', 'zig-zag modes a one-point element cannot see; the stabiliser\'s energy', 'phone v0.1: 15.5 % (rule: 10 %)'],
  ['Added mass', 'make the tiniest elements heavier so they do not force a tiny step', 'phone 1.02 % → 1.56 %; bumper 0.02 %'],
  ['Energy error', 'the solver\'s books: motion + deformation vs start + outside work', 'negative = lost, uncounted; positive = created'],
  ['Time history · animation', 'a few sensors recorded often (/TH) vs the 3D field rarely (/ANIM, /H3D)', 'bumper v0: 1,001 rows, frames only as .h3d'],
]

function Glossary({ rows }) {
  return (
    <table className="tb gl">
      <thead><tr><th style={{ width: 128 }}>term</th><th>in plain words</th><th style={{ width: 196 }}>in these decks</th></tr></thead>
      <tbody>
        {rows.map(([t, p, d]) => (
          <tr key={t}><td><b>{t}</b></td><td>{p}</td><td className="deck">{d}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Backup() {
  return (
    <>
      <PhoneV02 />
      <PhoneFixes />
      <PhoneTrust />
      <PhoneTable />
      <BumperV02 />
      <SkillBuiltOn />

      {/* B0 · how I used AI (was the last slide of the skill column) -------------- */}
      <Slide uncounted cue={BACKUP_CUE}
        src="the planning notes (Intro, Sprint 1, Sprint 2) and the steering notes · assets/app.js header"
        notes={
          <>
            <p>"How I used AI. Claude Code did most of the typing; I did the framing, the steering and the acceptance. A fixed loop: an intro note that restates the task and plans tickets, then I stop and decide, then sprints, each ending with a check against the task."</p>
            <p>"Where I overruled it: the first plan only described the decks; I said they clearly had defects and asked for a corrected v0.1, and that decision produced most of the findings you saw. I had the solver prose rewritten for a first-time reader, and the skill now asks before installing anything."</p>
            <p>"I treat the agent like a very fast junior engineer: its output is a proposal until a check passes, and every number is checked against the solver, never against the model's own claims."</p>
          </>
        }
      >
        <Head kicker={K + ' · how I used AI'} title="Claude Code wrote most of the code; I set the architecture, the rules and the checks" />
        <Flow vertical small nodes={[
          { t: 'Intro.md', s: 'the task, the domain, a plan as tickets' },
          { t: 'STOP · I decide', s: 'steering notes', ask: true },
          { t: 'Sprint 1', s: 'parser, report' },
          { t: 'Sprint 1.1', s: 'markers where the problem is' },
          { t: 'Sprint 2', s: 'v0.1, runs, skill' },
          { t: 'Final check', s: 'against the task', hl: true },
        ]} />
        <div className="cards mt-l">
          <div className="card2">
            <div className="t">Where I overruled the agent</div>
            <div className="d">
              <b>Scope:</b> "the decks have defects": build a corrected v0.1, not a description.<br />
              <b>Reader:</b> solver prose rewritten for a first-time reader.<br />
              <b>Safety:</b> the skill asks before every install.
            </div>
          </div>
          <div className="card2">
            <div className="t">What stays mine</div>
            <div className="d">
              <b>Architecture:</b> one command; the truth lives in <code>model.json</code>, the page only draws it.<br />
              <b>Acceptance:</b> every number against the solver, every flag against <code>hm_cfg_files</code>.
            </div>
          </div>
        </div>
      </Slide>

      {/* B1 -------------------------------------------------------------------- */}
      <Slide uncounted cue={BACKUP_CUE} notes={<><p>Glossary, part 1: the model. Plain words first, then where each term shows up in these two decks.</p><p>If asked "what decides the mesh size": accuracy (a fold cannot be shorter than about one element; the bumper's elements are about 10 mm, 4.4 to 5.5 times the sheet thickness) against cost (a smaller element means more elements and a smaller time step).</p></>}
        src="FEA glossary of the prep notes · counts from report/model.json (Starter listing)">
        <Head kicker={K + ' · glossary 1/2'} title="FEA words, part 1: how a model is built" />
        <Glossary rows={GLOSSARY_MODEL} />
      </Slide>

      <Slide uncounted cue={BACKUP_CUE} notes={<><p>Glossary, part 2: the physics and the solver's bookkeeping.</p><p>Von Mises caveat: glass breaks in tension at flaws, so the right quantity is the maximum principal stress. Hourglass: an artificial force; its energy is not physics, so a high share distorts where the deformation goes even when the books close.</p></>}
        src="FEA glossary of the prep notes · values from report/model*.json and the Engine listings">
        <Head kicker={K + ' · glossary 2/2'} title="FEA words, part 2: what the solver computes and how to trust it" />
        <Glossary rows={GLOSSARY_PHYSICS} />
      </Slide>

      {/* B2 -------------------------------------------------------------------- */}
      <Slide uncounted cue={BACKUP_CUE}
        src="README run table · Engine listings (…_0001.out) · run_metadata.json · official OpenRadioss release for Windows x64, double precision"
        notes={<><p>"Six runs on a six-core laptop: about 2.9 hours of solver time, mostly the 94-minute phone v0.1 run, in the background while I worked on the report."</p><p>Estimate against actual: F-01 estimated the 2 ms phone run at about 20 times v0. Cycles did scale by 20 (53,513 / 2,676), computer time only by 9: v0 spent 3 of its 11 minutes writing 100 frames of 29.5 MB.</p><p>Why 2 ms and not 5 ms: 2 ms was the recommended choice; 5 ms is about 4 h from scratch, or about 2.4 h as a restart from the saved 2 ms state (the phone's v0.2 slide).</p></>}>
        <Head kicker={K + ' · run times'} title="Six solver runs, about 2.9 hours of solver time on a 6-core laptop" />
        <table className="tb big">
          <thead><tr><th>run</th><th className="num">Starter</th><th className="num">Engine</th><th className="num">cycles</th><th className="num">threads</th></tr></thead>
          <tbody>
            <tr><td><b>Bumper v0</b></td><td className="num">&lt; 1 min</td><td className="num">8 min</td><td className="num">100,000</td><td className="num">8</td></tr>
            <tr><td><b>Bumper v0.1</b></td><td className="num">&lt; 1 min</td><td className="num">22 min</td><td className="num">100,000</td><td className="num">4</td></tr>
            <tr><td><b>Cell Phone v0</b></td><td className="num">&lt; 1 min</td><td className="num">11 min</td><td className="num">2,676</td><td className="num">8</td></tr>
            <tr className="hl"><td><b>Cell Phone v0.1</b></td><td className="num">&lt; 1 min</td><td className="num">94 min</td><td className="num">53,513</td><td className="num">8</td></tr>
            <tr><td><b>Bumper ×0.8 · ×1.2</b></td><td className="num">–</td><td className="num">19 · 17 min</td><td className="num">100,000</td><td className="num">4</td></tr>
          </tbody>
        </table>
        <Stats cols={1} style={{ marginTop: 16 }}>
          <Stat n="≈ 2.9 h" l="all Starter + Engine times above" />
          <Stat n="1 µs · 37 ns" l="time step: bumper · phone (held by mass scaling)" />
          <Stat n="×20 cycles, ×9 time" l="phone 0.1 → 2 ms: v0 was dominated by writing 100 frames" />
        </Stats>
      </Slide>

      {/* B3 -------------------------------------------------------------------- */}
      <Slide uncounted cue={BACKUP_CUE} src="README 'Assumptions'"
        notes={<><p>The four assumptions the README states, each with the reason and what happens if it is wrong. The one people ask about: running the solver although the question is about the decks. The question is the model's expected behaviour, the Starter proves the parser against the solver's own listing, and every run-derived number sits in its own step, so the deck analysis stands on its own.</p></>}>
        <Head kicker={K + ' · assumptions'} title="Four stated assumptions, each with what happens if it is wrong" />
        <div className="cards">
          <Card title="Running the solver is welcome">
            Why: the question is the model's expected behaviour; the runs validate the parser. <b>If wrong:</b> every run-derived number sits in its own step; the rest stands alone.
          </Card>
          <Card title="A real phone this size weighs about 160 g">
            Why: 58 × 104 × 9 mm ships at 140–175 g. <b>If wrong:</b> the ratio changes; the model is still far lighter than a real device.
          </Card>
          <Card title="The recommended answer is a fair default for v0.1">
            Why: nobody had answered the findings yet. <b>If wrong:</b> answer them in the report, save interaction.txt, rebuild.
          </Card>
          <Card title="SKILL.md is a fair shape for an 'agent skill'">
            Why: a documented, portable convention that also reads as a playbook. <b>If wrong:</b> rename it; the content does not change.
          </Card>
        </div>
      </Slide>

      {/* B4 -------------------------------------------------------------------- */}
      <Slide uncounted cue={BACKUP_CUE} src="README 'What I left out, and why' · 'What is left out of this folder'"
        notes={<><p>Two kinds of "left out". From the analysis: changes that need new data or a new mesh, offered as choices with their cost; and a full design study, because neither deck is parameterised. Also dropped for time: a time slider in the 3D view and the 5 ms phone run.</p><p>From the folder: about 6.2 GB of raw solver output. Every picture, video and number taken from it ships; the slim copy is 76 MB, 19 MB zipped, and rebuilds losslessly: same findings, same stresses, tests pass.</p></>}>
        <Head kicker={K + ' · what was left out'} title="Left out on purpose: edits that need new data, and 6.2 GB of raw solver output" />
        <div className="cards">
          <Card title="From the analysis">
            <b>Edits that need new data or a new mesh</b>: shells for the phone's plates, a failure strain for the glass, rate constants for the steels, the missing phone mass. Each is a choice in the findings, with its cost.<br /><br />
            <b>A full design study</b>: neither deck is parameterised. One variable run: the bumper's sheet thickness; speed, pole and drop angle use the same mechanism.<br /><br />
            <b>For time</b>: the 5 ms phone run (~4 h, a v0.2 decision) and a time slider in the 3D view.
          </Card>
          <Card title="From the folder">
            <b>≈ 6.2 GB</b> of raw output (animation frames, restart files, deck copies): every picture, video and number taken from it ships, and <code>--run --rerun --media</code> regenerates it (~2.5 h).<br /><br />
            <b>Slim copy: 76 MB, 19 MB zipped</b>: same report, rebuilds losslessly (tested: same findings, same stresses, all tests pass).
          </Card>
        </div>
      </Slide>

      {/* B5 -------------------------------------------------------------------- */}
      <Slide uncounted cue={BACKUP_CUE} src="Lines starting with '/' in the four deck files, keyed by keyword + subtype"
        notes={<><p>Keyword frequency across the two model files. Groups, parts and ties dominate both decks. Keyword counts are not entity counts: /SHELL appears 14 times in the bumper, once per block, and one block holds 1,632 elements.</p><p>Where the phone's 629,265 lines go: /NODE 40.9 %, /TETRA10 34.8 % (two lines per element), /SURF/SEG 12.6 %. About 13 % of the file is exact duplicates, e.g. the same board surface seven times: typical of a pre-processor export.</p></>}>
        <Head kicker={K + ' · keyword frequency'} title="Top 15 keywords: groups, parts and glue dominate both decks" />
        <KeywordBars width={600} />
        <Callout tone="plain" title="Keyword count ≠ entity count" style={{ marginTop: 10 }}>
          <code>/SHELL/9</code> opens a block of <b>1,632</b> elements: "14 × /SHELL" means 14 blocks, one per part. About <b>13 %</b> of the phone file is exact duplicates.
        </Callout>
      </Slide>

      {/* B6 -------------------------------------------------------------------- */}
      <Slide uncounted cue={BACKUP_CUE}
        src="Cell_Phone_Drop/report/model.json assembly (element_types, through_thickness) · node levels counted in Cell_Phone_Drop_0000.rad after delivery · v0.1 T01 hourglass per part"
        notes={<><p>For a CAE question on element types: the phone uses two solid element types and no shells. BRICK is the 8-node hexahedron with one integration point in the centre (the default formulation): cheap, no locking, but blind to hourglass modes. TETRA10 is the 10-node quadratic tetrahedron with 4 integration points (Itetra10 = 2): no hourglass modes. The bumper is shells (4-node quads, 28 triangles) plus 2-node springs.</p><p>The report's 'elements across' is thickness ÷ mean edge, a screening ratio; the layer column is counted from node levels. Two thirds of the v0.1 stabiliser energy sits in the battery (two brick layers, loose), the rest in the one-layer boards, none in the TETRA10 parts.</p></>}>
        <Head kicker={K + ' · the 11 thin parts'} title="Which element, how many layers: the 11 thin parts of the phone" />
        <ThinParts />
        <Say tight style={{ marginTop: 14 }}>
          <p><strong>BRICK</strong>: 8 nodes, one check point in the middle (cheap, blind to bending in one layer). <strong>TETRA10</strong>: 10 nodes, 4 check points (no hourglass modes).</p>
          <p>The bumper: <strong>shells</strong> (4-node quads, 28 triangles) and 2-node <strong>springs</strong> (the welds).</p>
        </Say>
      </Slide>

      {/* B6b: the bumper's energy error (was in the Bumper column) --------------------- */}
      <Slide uncounted cue={BACKUP_CUE}
        src="Bumper_Beam/report/model*.json run.history.error_pct, energy_sources.balance_closed_pct · Engine listings and T01 CSVs of v0, v0.1 and both sweep points (checked after delivery)"
        notes={
          <>
            <p>(The phone's energy books are the backup slide "can we trust v0.1"; this is the same method.) "I asked myself the question you might ask: why does the bumper's energy error keep going down? It reaches −0.3 % in v0 and −1.0 % in v0.1, never positive, and it stops moving once the sliding stops."</p>
            <p>"In v0 at 100 ms: the start energy plus the work of the outside forces says 6,350 J should be in the bumper; the solver finds 6,332 J, motion plus deformation. 18 J are missing: −0.3 %. The self-contact loses energy to friction, and that is not in the sum. The time history has a contact-energy channel: 19.5 J. The chart shows the same in all four bumper runs: missing energy and contact energy agree within about 4 J; v0.1 drifts more because the torn beam slides more. Counted in, the books close to within 0.05 %."</p>
            <p>"A positive error, energy created, would worry me, and v0.1's stop trips on it. A negative one is not automatically safe either: contact damping or deleted elements would also show up negative. That is why I did not stop at the sign: I accounted for it."</p>
            <p>If asked for the threshold: Altair's own divergence hint is a positive error, or a drift beyond about −15 %; we are at −0.3 to −1.3 %. Ruled out: hourglass (shells with QEPH book it inside internal energy), spring damping (C = 0), mass scaling (0.006 kg added during the run), gravity and pole friction (both in the external work).</p>
          </>
        }
      >
        <Head kicker={K + ' · bumper energy error'} title="Why the bumper's energy error drifts negative: friction in the self-contact, accounted for within 4 J" />
        <div className="eq">
          <div><span className="c">v0, at 100 ms (J): start + outside work vs what is found</span></div>
          <div>start + outside work = 6,492 − 142 = <b>6,350</b> should be there</div>
          <div>found (motion + deformation) = <b>6,332</b> → missing <span className="or">18 J</span> = −0.3 %</div>
          <div>contact (friction) channel = <span className="hl">19.5 J</span> → counted in: <b>+0.02 %</b></div>
        </div>
        <BumperBooks width={600} height={262} />
        <Say tight style={{ marginTop: 6 }}>
          <p>Negative = energy <strong>lost</strong>, benign once accounted for. Positive = energy <strong>created</strong>: an instability, and v0.1's stop trips on it.</p>
        </Say>
      </Slide>

      {/* B7 -------------------------------------------------------------------- */}
      <Slide uncounted cue={BACKUP_CUE} src="/BEGIN cards of both _0000.rad files · report/model.json units (consistent: true)"
        notes={<><p>"Radioss has no built-in units: it multiplies the numbers it reads. The two decks use different consistent systems. E = 210 in the bumper is 210 GPa; E = 70,000 in the phone is 70,000 MPa. One value in the wrong system is off by a thousand and nothing warns you, which is why the report reads /BEGIN first and converts the headline numbers."</p></>}>
        <Head kicker={K + ' · units'} title="Two decks, two unit systems: E = 210 means GPa in one and would mean MPa in the other" />
        <table className="tb units">
          <thead><tr><th /><th>Bumper Beam</th><th>Cell Phone</th></tr></thead>
          <tbody>
            <tr className="hl"><td><b>mass, length, time</b></td><td><b>kg · mm · ms</b></td><td><b>Mg (tonne) · mm · s</b></td></tr>
            <tr><td><b>force</b></td><td>kN</td><td>N</td></tr>
            <tr><td><b>stress, stiffness</b></td><td><b>GPa</b></td><td><b>MPa</b></td></tr>
            <tr><td><b>energy</b></td><td><b>J</b></td><td><b>mJ</b></td></tr>
            <tr><td><b>velocity</b></td><td>mm/ms = m/s</td><td>mm/s</td></tr>
            <tr><td><b>gravity, 1 g</b></td><td>0.00981 mm/ms²</td><td>9810 mm/s²</td></tr>
            <tr><td><b>in the deck</b></td><td><code>E = 210</code> (steel)</td><td><code>E = 70000</code> (glass)</td></tr>
            <tr><td><b>density</b></td><td>7.85e-6 = 7,850 kg/m³</td><td>1.1e-9 = 1,100 kg/m³</td></tr>
          </tbody>
        </table>
        <Say style={{ marginTop: 14 }}>
          <p>Both are <strong>consistent</strong> (F = m·a with no factor). A solver never converts: one value in the wrong system is <strong>×1000 off</strong>, and no error is raised.</p>
        </Say>
      </Slide>

      {/* B8 -------------------------------------------------------------------- */}
      <Slide uncounted cue={BACKUP_CUE} src="<Model>/report/onepager.html (prints to one A4 page)"
        notes={<><p>The two one-pagers: self-contained HTML that prints to one A4 page, generated from the same model.json as the report, nothing typed by hand. HTML rather than PDF on purpose: a person or an AI can check its text.</p></>}>
        <Head kicker={K + ' · one-pagers'} title="One page per model, generated from the same data as the report" />
        <div className="row" style={{ gap: 12, justifyContent: 'center' }}>
          <Shot file="phone_onepager.png" width={294} caption="Cell Phone" />
          <Shot file="bumper_onepager.png" width={294} caption="Bumper Beam" />
        </div>
      </Slide>
    </>
  )
}
