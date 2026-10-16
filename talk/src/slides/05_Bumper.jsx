import React from 'react'
import { Slide, Stack, Head, Say, Mark, Callout, F, Fis, More } from '../components'
import { BumperOverview, BumperGraph, RunFile, ImpulseForce, BumperCrush, BumperSides, SweepTravel } from '../charts'

// Column 4: the Bumper Beam, only what is new compared with the phone. What sits under a "more details:" rule stays
// on the slide but is not presented; the v0.2 decisions are a backup slide (BumperV02 below, rendered by 12_Backup.jsx). Numbers: kb/03_bumper.md and the
// the report's Bumper_Beam/report/model*.json; the pictures and curves come from tools/bumper_figures.py
// (computed after delivery from the shipped mesh, time histories and /ANIM frames). Each slide lists its
// sources in the notes. The energy-error slide moved to the backup (12_Backup.jsx).
const K = 'Bumper Beam'
const BACKUP_CUE = 'backup · only if asked'

const ALL = [
  ['F-01', 'error', '"forces" are running totals (impulses) named "var N"', '✓ /TH/TITLE'],
  ['F-02', 'error', '3D results only in .h3d: no open, scriptable reader', '✓ /ANIM, 51 snapshots'],
  ['F-03', 'error', 'DP1000 uses the DP600 tear limit', '✓ UHSS preset'],
  ['F-04', 'warning', 'nothing stops a run that goes wrong', '✓ /STOP 10 % · 5 %'],
  ['F-05', 'warning', 'steels behave as if loaded slowly (c = 0)', 'left: ★ state it'],
  ['F-06', 'warning', '942 overlaps on 464 mesh points at t = 0', 'left: ★ keep, report'],
  ['F-07', 'info', 'one material defined, never used', 'left: ★ keep, annotate'],
]

// v0.2: what I would decide as the engineer, with the v0 ids met on the bumper's pages. The 150 ms estimate is the
// rough one from the thickness study (535 J left against the ~20 kN the pole still pushes ≈ 3 cm more); the welds'
// SPOTWELD_NO_RUPTURE title is in the deck; the reviewer's objection to F-03 is in ai/findings_raw.json.
const V02 = [
  { k: '×0.8', sev: 'new', v: <>Run the thin variant <b>150 ms</b> to see where the car stops: one number in the run file (rough estimate: about 350 mm).</> },
  { k: 'welds', sev: 'new', v: <>Give the <b>78 spot welds</b> a failure rule: the deck names them SPOTWELD_NO_RUPTURE, so today they can never break.</> },
  { k: 'tests', sev: 'new', v: <>Ask the steel supplier for <b>coupon tests</b>: DP1000's real curve and tear limit settle the reviewer's objection to F-03; tests at several speeds give the strain-rate factor that F-05 lacks (c = 0).</> },
  { k: 'left/right', sev: 'new', v: <>Re-run with the nodes <b>renumbered</b>: if the fold moves to the other crash box, the asymmetry is numerical, not physics.</> },
]

export default function Bumper() {
  return (
    <Stack>
      {/* B0 · 1 Overview: one annotated picture ------------------------------------------- */}
      <Slide
        cue="~1.5 min · at 24:30 · CHECKPOINT: here by 24:30"
        src="Bumper_Beam/report/model.json · scenario, assembly, setup.constraints, units · picture and the 78 weld dots drawn from Bumper_Beam_AP_meshed_0000.rad by tools/bumper_figures.py (after delivery)"
        notes={
          <>
            <p>"The second model is a car's front bumper, seen here from behind the car, as the driver would: left is the driver's left. A curved steel beam, 2 m wide, carried by two crash boxes, driving at 18 km/h, 5 m/s, into a rigid pole of 254 mm, placed exactly in the middle, 3 mm in front of the beam at the start. The car behind it is not modelled: it is a 500 kg rigid block holding the crash boxes' rear ends, the green bar, allowed to move only straight ahead. 19.2 kg of steel plus 500 kg: 6,490 J of motion energy; the solver follows the first 100 ms."</p>
            <p>"The dots are the 78 spot welds, at their real positions, 39 a side. Bottom left, one crash box magnified: two pressed halves, light and dark; 21 welds join the halves along the seam, 9 + 9 weld them to the beam. They are two-node springs and they cannot break: the property is titled SPOTWELD_NO_RUPTURE."</p>
            <p>"New compared with the phone: the sheets are shells, thin-plate elements, the kind we recommended for the phone's boards: the thickness is a number on the property card, 1.8 mm for the DP1000 beam, 2.2 mm for the DP600 crash boxes. And the units: kilogram-millimetre-millisecond, so E = 210 means 210 GPa."</p>
            <p>If asked why the springs are welds: part titles CONNECTION_SPOTWELD, property SPOTWELD_NO_RUPTURE, each end glued to a sheet by a TYPE2 tie with the spot-weld flag, rows along the flanges every 18 to 20 mm. If asked about the 500 kg: a demo value; a real car is 1.2 to 2 t, so 3 to 4 times the energy. The picture is rendered from the deck's own mesh; the block is drawn as a bar because in the deck it is no geometry, only a rigid body on 108 rear nodes plus a 500 kg point mass.</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 · 1 Overview'} title="The bumper: a 2 m steel beam on two crash boxes hits a pole, pushed by a 500 kg block" />
        <BumperOverview width={600} />
        <Say tight style={{ marginTop: 10 }}>
          <p><strong>19.2 kg</strong> of steel + <strong>500 kg</strong> at 5 m/s: <strong>6,490 J</strong> of motion energy; <strong>100 ms</strong> simulated.</p>
          <p>New compared with the phone: <strong>shells</strong> (the thickness is a number on the card, not in the mesh) and units <strong>kg-mm-ms</strong> (<code>E = 210</code> means 210 GPa).</p>
        </Say>
      </Slide>

      {/* B1 · 3 Materials: the physics fix -------------------------------------------------- */}
      <Slide
        cue="~1.5 min · at 26:00 (F-05, F-07 below 'more details:' only if asked)"
        src="Bumper_Beam/report/model.json materials, failures, findings F-03, F-05, F-07 · v0/ and v0.1/Bumper_Beam_AP_meshed_0000.out (BIQUAD 'PLASTIC STRAINS AT FAILURE': C3 simple tension 0.50 with M-FLAG 2, 0.12 with M-FLAG 3) · v0.1/edits.json · ai/findings_raw.json (the refuting verdict)"
        notes={
          <>
            <p>"The one physics fix. F-03, an error. /FAIL/BIQUAD decides when a piece of sheet tears: the element is deleted once its permanent stretch reaches a limit. With no measured data it uses a built-in preset. The beam's steel is DP1000, a high-strength steel, but both its cards use preset 2, the DP600 class. Read in the solver's own listing: pulled straight, the tear limit is 0.50, 50 % of permanent stretch. Preset 3, ultra-high-strength steel: 0.12. Logical: a stronger steel stretches about four times less before it tears. With 0.50 the beam would tear too late and look safer than it is. v0.1 switches to preset 3; what it changes, you will see on the Results page: 65 elements tear."</p>
            <p>"And in fairness: one of the adversarial AI reviewers in my pipeline rejected this premise. Its argument: the deck's own stress-strain curve for this card, 500 + 500 times the square root of the plastic strain in MPa, peaks at about 600 MPa, which is DP600 territory. So by the numbers, the preset fits, and the name could be the mistake. I kept the finding, because the author named it DP1000 and gave it a clearly stronger curve than the DP600 crash boxes, so DP1000 was meant. But the reviewer has a point: both the curve and the tear limit are placeholders. Only the supplier's test data settles it."</p>
            <p><b>More details (only if asked).</b> F-05, a warning: steels get stronger when hit fast, but the strain-rate factor c is 0. Kept, and stated as a lower bound, because the constant needs test data. F-07, a note: one material is defined and never used.</p>
            <p>Ready answers. The reviewer's number: σ = 500 + 500·ε^0.5 MPa; necking (Considère) at ε = 0.134, true peak 683 MPa, engineering 597 MPa. The "DP600" card (300 + 300·ε^0.3) peaks at about 407 MPa: both are round placeholders (a = b = n). The other preset values, from the listings: plane strain 0.30 → 0.096, shear 0.70 → 0.37, biaxial 0.80 → 0.42. For design I'd fit the flow curve and C1..C5 from coupon tests. Element deletion is mesh dependent and the deck's regularisation fields are 0 with ~10 mm elements: the next check I'd add. The crash boxes (DP600) have no failure card at all: they can never tear.</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 → v0.1 · 3 Materials'} title="The one physics fix: the beam's strong steel had the tear limit of a softer one" />
        <F id="F-03" sev="error" title="The DP1000 beam uses the tear limit set for DP600, a softer steel">
          <p>DP1000 is high-strength steel, so its tear limit should not be <b>0.50</b> (preset 2, "DP600 class") but <b>0.12</b> (preset 3, ultra-high-strength). <i>Logical: stronger steel, about 4× less stretch before it tears.</i></p>
          <p>★ v0.1 uses preset 3. What it changes: on 6 Results.</p>
        </F>
        <div className="note" style={{ marginTop: 6, paddingLeft: 32 }}>
          Tear limit = how far a pulled piece of sheet stretches for good before the solver deletes it (0.50 = 50 %). Values from the solver's own listing.
        </div>
        <Callout tone="warn" title="An adversarial AI reviewer rejected this premise" style={{ marginTop: 12 }}>
          The deck's own stress–strain curve for this steel peaks near <b>600 MPa</b>, so the name may be the mistake, not the preset. I kept the fix: the author named it DP1000 and made it stronger than the DP600 boxes. Only test data settles it.
        </Callout>
        <More />
        <Fis>
          <F id="F-05" sev="warning" title="The steels behave as if loaded slowly (strain-rate factor c = 0) at 5 m/s">
            Steels get stronger when hit fast. Kept, and stated as a lower bound: the constant needs test data.
          </F>
          <F id="F-07" sev="info" title="One material is defined and never used" />
        </Fis>
      </Slide>

      {/* B2 · 4 Connections ----------------------------------------------------------------- */}
      <Slide
        cue="~1.5 min · at 27:30 (behind? 30 s: 'one beam, crash boxes hanging on 78 welds, a rigid block behind')"
        src="Bumper_Beam/report/model.json · assembly (mass_starter), starter.interface_parts, setup.constraints (/RBODY, /BCS), rigid_wall, findings F-06 · shared mesh points counted from Bumper_Beam_AP_meshed_0000.rad after delivery · overlap locations recomputed from the mesh by tools/bumper_figures.py"
        notes={
          <>
            <p>"The same kind of graph as for the phone. At the top, the pole: a rigid wall that pushes the beam without gluing, friction 0.2. The beam is ten DP1000 parts, but they share mesh points: one continuous sheet, 15.4 kg. Each crash box is two pressed halves, held together only by spot welds, 21 each, and each half hangs on the beam by 9 more. 78 welds in total. At the bottom, the car: a 500 kg rigid block holding the crash boxes' rear ends, allowed to move only straight ahead."</p>
            <p>"The dashed frame is one self-contact over all 14 sheets, friction 0.2: it stops folds passing through each other. F-06, a warning: 942 overlaps on 464 mesh points already exist at the start. The listing does not say where; I recomputed them from the mesh, and they all sit on the orange edges: where sheets are stacked for welding. Two thirds between the two halves of a crash box, one third where a crash box meets the beam, none anywhere else. The solver is told to ignore them, Inacti = 6. That is legal; the recommended choice is to keep it and report it, because cleaning the mesh is a pre-processing job."</p>
            <p>If asked how: a node closer to another sheet than half the two thicknesses (at least the 1 mm minimum gap), the rule of the contact's variable gap, Igap = 2. My count: 944 on 466 points against the solver's 942 on 464 (638 between the halves, 306 against the beam). The welds cannot break (SPOTWELD_NO_RUPTURE): fine for this question; a design model would need a weld failure rule. Weld masses: 0.002 kg per weld from the property card, 0.156 kg in total.</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 · 4 Connections'} title="How the bumper holds together: one beam, four crash-box halves, 78 spot welds" />
        <BumperGraph width={600} />
        <Fis style={{ marginTop: 8 }}>
          <F id="F-06" sev="warning" title="942 overlaps on 464 mesh points before the impact starts">
            All on the welded flanges (orange): two thirds between crash-box halves, one third against the beam. The solver ignores them (<code>Inacti = 6</code>): legal. ★ Keep, report.
          </F>
        </Fis>
      </Slide>

      {/* B3 · 5 Run settings ---------------------------------------------------------------- */}
      <Slide
        cue="~1.5 min · at 29:00 (F-02, F-04 below 'more details:' only if asked)"
        src="Bumper_Beam/Bumper_Beam_AP_meshed_0001.rad · report/model.json engine.cards, findings F-01, F-02, F-04 · v0/…T01.csv (var 35 = RWALL FNX, var 38 = RWALL FTX; their sum = the X-momentum change) · OpenRadioss Tools README (th_to_csv)"
        notes={
          <>
            <p>"The bumper's run file is long enough, 100 ms, but it fails the other way: you cannot check what you did not save. F-01, an error: five time histories are requested, but there is no /TH/TITLE card. Radioss stores force channels as impulse, force added up over time; the converter is meant to turn them back into forces and name the columns when that card exists. So every 'force' column is a running total called 'var N'. The left chart: the pole's channels as delivered only rise, to 3.0 kilonewton-seconds. The right chart is their slope, the force you actually want: a peak of 51 kN at 4 ms, then about 31 kN while the beam wraps round the pole. A plot of the raw columns has no peak at all."</p>
            <p><b>More details (only if asked).</b> F-02, an error: the 3D results, stresses and the deformed shape, were computed but saved only in Altair's .h3d format, with no /ANIM. For an open, scriptable pipeline that means no picture and no stress field: that is why v0 has no video. The fix is five /ANIM lines. F-04, a warning: no /STOP at all, so 'normal termination' says nothing about the quality of the run.</p>
            <p>Ready answers. The chart sums the pole's normal-force channel (var 35) and its friction channel (var 38), both along the direction of travel: together they are exactly the car's momentum change (3,007 N·s = 3.0 kN·s), so the slope is the same force as the crash curve on the next slide, 51 kN at 4 ms. The normal channel alone peaks at 52 kN. If someone says 'HyperView Player is free': right, 'no free tool' is too strong; the precise claim is no open, scriptable reader; /ANIM → anim_to_vtk → VTK is the open path. Sign, if someone opens the CSV: the columns are stored negative (the pole pushes along −X; var 35 alone ends at −3,132 kN·ms); the chart flips the sign and adds the friction column. Caveat if asked: in v0.1 the columns are named, but when I re-checked the values they are still cumulative; the report never plots them, so no wrong number shipped; I differentiate them myself, as in this chart (computed after delivery).</p>
          </>
        }
      >
        <Head kicker={K + ' · v0 · 5 Run settings'} title="You can't check what you didn't save: every 'force' column is a running total" />
        <RunFile title="Bumper_Beam_AP_meshed_0001.rad, the lines that matter" lines={[
          { code: '/RUN/…/0/   100', tag: '100 ms', note: 'long enough' },
          { code: '(no /TH/TITLE card)', sev: 'error', tag: 'F-01', note: 'running totals', missing: true },
          { code: '/H3D/SHELL/VONM, /EPSP', sev: 'error', tag: 'F-02', note: 'only .h3d' },
          { code: '(no /ANIM card)', sev: 'error', tag: 'F-02', note: 'no open frames', missing: true },
          { code: '(no /STOP card)', sev: 'warning', tag: 'F-04', note: 'nothing stops it', missing: true },
        ]} />
        <div style={{ marginTop: 12 }}>
          <F id="F-01" sev="error" title={'Every "force" column is a running total (impulse), named "var N"'} />
        </div>
        <figure className="chart-fig" style={{ marginTop: 8 }}>
          <ImpulseForce width={600} height={206} />
          <figcaption>The pole's two channels ("var 35" + "var 38", normal + friction): as delivered, and their slope (computed after delivery).</figcaption>
        </figure>
        <More />
        <Fis style={{ gap: 8 }}>
          <F id="F-02" sev="error" title="3D results saved only in Altair's .h3d: no open, scriptable reader, so no stress field and no video in v0" />
          <F id="F-04" sev="warning" title="No safety stop: nothing ends a run that goes wrong" />
        </Fis>
      </Slide>

      {/* B4 · 6 Results: the crash in curves ------------------------------------------------- */}
      <Slide
        cue="~2 min · at 30:30"
        src="Bumper_Beam/v0/ and v0.1/…T01.csv (X-MOMENTUM, MASS, every 0.1 ms) · media/frames_v0.1_every2.npz (node positions every 4 ms) · v0.1/engine_stdout.txt (65 × 'RUPTURE (BIQUAD)') · all computed after delivery by tools/bumper_figures.py"
        notes={
          <>
            <p>"The crash itself, which the report shows only as a video and a few numbers. The classic crash curve: the force of the pole on the car, up, against how far the car has moved into the pole, across. Grey is v0, teal v0.1 with the tear limit fixed. The dots are the four moments that matter, on both curves."</p>
            <p>"First contact, then the peak: 51 kN at 4 ms, the same force as on the previous slide: the beam hits the pole. Then the beam's walls buckle at the pole and the force drops to its minimum: 21 kN in v0; in v0.1 the beam has started tearing, so it falls further, to 13 kN. The beam then wraps round the pole and the force climbs again. Last, the rebound, where the car's speed is zero: v0 at 206 mm; v0.1 pushes less hard for longer and stops at 249 mm. Same energy, different shape: the area under each curve is 6,491 J, the whole impact energy, which is also my check that the curves are right."</p>
            <p>"Below, seen from above: the start in grey, 100 ms in colour, the beam wrapped into a V round the pole. The dots are torn elements: pieces of sheet the solver deleted once their stretch reached the tear limit we fixed in F-03, 65 in all: 24 from the left half of the bumper, 41 from the right half. The model is a perfect mirror image, but the result is not: from 36 ms the left crash box starts to fold, 27.5 mm in the end, while the right one folds much less, 4.2 mm. And the beam tears more on the right."</p>
            <p>If asked why left and right differ: buckling and tearing are bifurcations: a tiny numerical difference (node order, contact search order, round-off) picks a side and the load path follows. That is my reading, not tested; a mirrored mesh or a renumbered run would settle it. For a surrogate it matters: a symmetric input can have an asymmetric label.</p>
            <p>Ready answers. Force here = rate of change of the model's momentum over 1 ms windows: the pole's whole push, normal plus friction, 51 kN at 4 ms, the same curve as the slope on the run-settings slide (the normal-force channel alone would read 52 kN). The moments, if asked: first contact at 0.6 ms (the 3 mm gap closes); peak 50.6 kN at 4 ms; minimum at 23 ms (the box section at the pole is squeezed from 80 to 61 mm deep by 20 ms; v0.1 starts tearing at 5.7 ms); rebound v0 at 82.5 ms (it then moves back a few mm), v0.1 at 95.6 ms. Tears: the 24 / 41 split counts the 65 'RUPTURE (BIQUAD)' elements of the v0.1 Engine log by the half each one STARTED in (left or right of the centre line at 0 ms); by 100 ms the apex has slid right, so most left-half pieces sit just right of the pole's line, which is why the dots are coloured by half. 12 of the 65 are at the crash-box ends of the beam (2 left, 10 right). Travel = the model's centre of mass, as on every slide (206 / 249 mm); the 500 kg block alone travels 209 / 252 mm. The crash boxes barely fold because a centre-pole hit loads the beam in bending: they are designed for full-width hits.</p>
          </>
        }
      >
        <Head kicker={K + ' · v0.1 · 6 Results'} title="What does the crash look like? The beam buckles at the pole, wraps round it, and stops the car after 249 mm" />
        <BumperCrush width={600} />
        <div className="note" style={{ marginTop: 2 }}>
          Area under each curve, up to its rebound: <b>6,491 J</b>, the whole impact energy. That is also the check that the curves are right.
        </div>
        <div style={{ marginTop: 14 }}>
          <BumperSides width={600} />
        </div>
        <div className="note" style={{ marginTop: 6, maxWidth: 520 }}>
          <b>A mirror-image model, but not a mirror-image result</b>: from 36 ms the left crash box folds, the right one much less; the beam tears more on the right (<b>torn</b> = deleted by the solver at the tear limit, F-03; colour = the half it came from).
        </div>
      </Slide>

      {/* B5 · 8 Findings: the bumper in one table -------------------------------------------- */}
      <Slide
        cue="~45 s · at 32:30"
        src="Bumper_Beam/report/model.json and model_v0.1.json findings · v0.1/edits.json · src/findings.py thresholds"
        notes={
          <>
            <p>"The bumper in one table: seven findings, three errors, three warnings, one note. v0.1 fixed the four that change what can be checked or the physics; three stay open, each with its recommended choice. And v0.1 raised no new finding."</p>
            <p>If asked why none: the drift rule fires above 5 % (v0.1 reaches 1.0 %), the stabiliser rule above 10 % (the shells book none). v0.1 renumbers the open ones (v0.1 F-01 = v0 F-05, F-02 = F-06, F-03 = F-07).</p>
          </>
        }
      >
        <Head kicker={K + ' · 8 Findings'} title="The bumper in one table: 7 findings, 4 fixed by v0.1, none new" />
        <table className="tb small fl">
          <thead><tr><th style={{ width: 48 }}>id</th><th>finding (v0)</th><th style={{ width: 160 }}>v0.1</th></tr></thead>
          <tbody>
            {ALL.map(([id, sev, t, fix]) => (
              <tr key={id}>
                <td style={{ whiteSpace: 'nowrap' }}><Mark sev={sev} /><b>{id}</b></td>
                <td>{t}</td>
                <td>{fix.startsWith('✓') ? <span className="fx">{fix}</span> : <span className="left">{fix}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Say tight style={{ marginTop: 16 }}>
          <p>v0.1 raised <strong>no new finding</strong>.</p>
        </Say>
      </Slide>

      {/* B6 · 7 Engineering: the thickness study -------------------------------------------- */}
      <Slide
        cue="~2 min · at 33:15 · last bumper slide"
        src="Bumper_Beam/sweep/thickness_scale.json · body travel from each run's T01 X-momentum (checked after delivery)"
        notes={
          <>
            <p>"The Engineering page asked how much one nominal geometry can say; here is the answer in practice. The deck is text, so a design study is N edited copies. I ran the smallest one: every sheet thickness at 0.8, 1.0 and 1.2 times the original, from v0.1, with the same --sweep mechanism the build uses."</p>
            <p>"The response is one-sided. 20 % thicker: the car stops at 190 mm instead of 249, at 77 ms, and bounces back. 20 % thinner: the car is not stopped within the 100 ms I simulated: the block has travelled at least 322 mm and still moves at 1.4 m/s. Going thinner changes the outcome; going thicker only shortens the stroke. Whatever pushes a real part thinner, coil scatter, local thinning from pressing, is on the dangerous side."</p>
            <p>"For a surrogate that is the lesson: the response is non-linear and one-sided, so a model trained only near nominal misses the steep side. You sample densely where the output changes fastest; at Porsche I used active learning to choose the next test for exactly this reason."</p>
            <p>Ready answer to 'you stopped simulating, not the car': "Right. Rough estimate, not run: 535 J left against the ~20 kN the pole still pushes is about 3 cm more, so roughly 350 mm. A 150 ms run settles it: one flag." If someone quotes the README's '690 mm, more than doubles': that is the largest displacement of any single node, a torn piece flung aside; the robust metric is the travel of the block, shown here. Confound: thicker sheets add mass, ±3.8 kg, so impact energy moves by ±0.7 %. 17–22 minutes per run on 4 threads. If asked for the dataset view: each run writes one row of inputs and outcomes (report/global_features.json); v0 cannot fill its stresses (.h3d only, F-02): a run you cannot read is a row you cannot train on.</p>
            <p>Hand-over: "What I would decide for the bumper's v0.2 is in the backup. Now, how the agent does all of this on a deck nobody has seen."</p>
          </>
        }
      >
        <Head kicker={K + ' · v0.1 · 7 Engineering'} title="Design study: 20 % thinner steel does not stop the car within 100 ms; 20 % thicker only shortens the stroke" />
        <SweepTravel width={600} />
        <Say style={{ marginTop: 10 }}>
          <p>Every sheet ×0.8 / ×1.0 / ×1.2, from v0.1: <strong>one command</strong> (<code>--sweep</code>).</p>
          <p><strong>One-sided</strong>: thinner changes the outcome, thicker only shortens the stroke. Sample densely <strong>where the output changes fastest</strong>.</p>
        </Say>
        <div className="note mt">Metric: travel of the 500 kg block, not the largest single-node movement (at ×0.8 that is a torn piece flung aside).</div>
      </Slide>
    </Stack>
  )
}

// Backup: the bumper's v0.2 decisions (B7), moved out of the main path (rendered by 12_Backup.jsx).
export function BumperV02() {
  return (
    <Slide
      uncounted
      cue={BACKUP_CUE}
      src="Bumper_Beam/report/model_v0.1.json findings · sweep/thickness_scale.json (×0.8: ≥ 322 mm, 1.4 m/s at 100 ms) · Bumper_Beam_AP_meshed_0000.rad (SPOTWELD_NO_RUPTURE) · ai/findings_raw.json (the objection to F-03) · tools/bumper_figures.py (left 27.5 mm, right 4.2 mm)"
      notes={
        <>
          <p>"For the bumper, v0.1 fixed what changes the physics or what can be checked; three findings stay open as recommended. As the engineer, for v0.2 I would decide four things."</p>
          <p>"One: run the thin variant to 150 ms. At 100 ms the car was not stopped; a rough estimate, 535 J left against the 20 kN the pole still pushes, gives about 3 cm more, so around 350 mm. One number in the run file settles it."</p>
          <p>"Two: a failure rule for the 78 spot welds. The deck calls them SPOTWELD_NO_RUPTURE: a deliberate choice, fine for this question, but in a real crash welds can let go."</p>
          <p>"Three: coupon tests. The reviewer's objection to F-03 was that the curve looks like DP600; only test data settles which is wrong, the name or the numbers. Tests at several speeds also give the strain-rate factor that F-05 says is missing."</p>
          <p>"Four: the left/right asymmetry. Renumber the nodes and re-run: if the folding moves to the other crash box, it is numerical, a bifurcation decided by round-off, not physics. For a surrogate that matters: a symmetric input with an asymmetric label."</p>
          <p>If asked why not a mirrored mesh: mirroring moves a real geometric asymmetry to the other side too, so it cannot tell the two causes apart; renumbering keeps the geometry and changes only the order of the arithmetic.</p>
        </>
      }
    >
      <Head kicker={'Backup · ' + K + ' · v0.2'} title="v0.2: the decisions I would take as the engineer" />
      <div className="dec big">
        {V02.map(({ k, sev, v }) => (
          <React.Fragment key={k}>
            <div className={`k ${sev}`}>{k}</div>
            <div className="v">{v}</div>
          </React.Fragment>
        ))}
      </div>
    </Slide>
  )
}
