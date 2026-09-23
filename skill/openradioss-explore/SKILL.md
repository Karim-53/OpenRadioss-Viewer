---
name: openradioss-explore
description: Investigate an unfamiliar OpenRadioss or Altair Radioss impact deck and explain it to an engineer who has never seen it. Use when handed a *_0000.rad / *_0001.rad pair (bumper, drop test, crash, any explicit-dynamics impact model) and asked what the model is, how it is built, what will shape its answer, or what is wrong with it. Produces an interactive HTML report, a findings list with concrete fixes, and a corrected v0.1 of the decks.
---

# Explore an OpenRadioss model

A deck dump is not an explanation. The job is to turn two text files into the
answer an engineer actually needs: **what is hitting what, how fast, with what
mass - and which settings will decide the result before any physics does.**

## The one command

Everything this skill produces comes from one script. The other files in
`src/` are modules it calls; nobody runs them directly.

```bash
python src/main.py --check          # 1. what is installed, what is missing (changes nothing)
python src/main.py                  # 2. read the decks, build index.html
python src/main.py --run --media    # 3. run the solver, render stills and the video
python src/main.py --v01 --run --media   # 4. build the fixed decks (v0.1), run them, compare
python src/main.py --all            # 2 + 3 + 4 in one go
python src/main.py --model M --build v0.2 --run --answer "run_ends_before_the_physics=lengthen to 5.0 ms"
                                    # 5. another version: v0.1's fixes with one answer changed
python src/main.py --model M --sweep thickness_scale=0.8,1.2 --run
                                    # 6. a design study from v0.1: one run per value
```

Run it from the folder that holds `src/` - two levels above this file. A
"model" is any sub-folder of it that holds a `*_0000.rad`; drop a new pair of
decks into its own folder and it is picked up. `--model <folder>` limits a run
to one model; the entry point `index.html` still lists all of them.

The steps below are what the script does and why, so the output can be
checked, extended to a keyword it does not know yet, or reproduced by hand.
Work in this order: each step is cheap and the early ones often settle the
question.

---

## 0 - Cold read: find the decks, and know which half you are reading

```
<Run>_0000.rad    the model file ("Starter" deck): units, mesh, materials, contacts, loads.
<Run>_0001.rad    the run file ("Engine" deck): how long, what is saved, what stops it.
<Run>_0000.out    Starter listing (after a run): the solver's own check of the model.
<Run>_0001.out    Engine listing: one line per 100 cycles. Run quality lives here.
<Run>T01          curves over time (binary).  <Run>A001..  3D snapshots.  <Run>.h3d  Altair only.
```

Read both decks before touching any tool: `/BEGIN`, the census (step 2), the
`/RUN` line, and whether results are saved as `/ANIM` (open) or `/H3D` only.

**The two decks do not use the same syntax, and this is the trap.**

- A **Starter** deck is *fixed width* on a ten-character ruler, and Altair
  writes a `#` comment above every card naming its fields. Read the field
  layout off that header line - a name's end column rounded up to the next
  multiple of ten *is* its field boundary - instead of hard-coding offsets per
  keyword. **Never `line.split()`**: blank fields are common and a whitespace
  split shifts every value after the gap. In a Johnson-Cook card that silently
  moves `Chard` into `c`, turning a rate-independent steel into a rate-hardening
  one. **Write edits the same way**: locate a field by its header name, never
  by "field N of 10" - `/FAIL/BIQUAD`'s `M_Flag` sits after a 20-wide field, in
  columns 21-30, and an offset-based edit lands in the neighbouring field.
- An **Engine** deck is *whitespace delimited*, and several cards carry no
  header at all - including `/RUN`, whose unlabelled second line is the
  termination time, and `/DT/NODA/CST`, whose third field decides whether the
  model is mass scaled. Applying the Starter's rules to it does not fail; it
  returns `TSTART = "0.000000 1"`.

Detect which you have from the content (`/BEGIN` means Starter), not the
filename, which anyone can change. Keep the file's own line endings when
writing a copy (one of the reference decks is CRLF).

---

## 0.5 - Check the tools. Ask before installing anything.

```bash
python src/main.py --check
```

It lists three tiers and, for each missing piece, the exact command that would
install it:

| Tier | What | Needed for | If missing |
|---|---|---|---|
| required | Python >= 3.12 and the pinned packages in `requirements.txt` | everything | nothing runs |
| solver | OpenRadioss (found via `--openradioss`, `OPENRADIOSS_PATH`, `PATH`, or the usual unpack folders) | `--run`, `--media` | report is built from the decks alone |
| video | the ffmpeg bundled by `imageio-ffmpeg` | the MP4 | stills only |

**Never install, download or change the environment without the user's
explicit yes, one item at a time.** For each missing piece, say what it is,
what it unlocks, its size, and the command - then wait:

- **Python** missing or older than 3.12: ask to install it from python.org
  (or the system package manager). Do not pick a version silently.
- **Packages** missing: ask before `python -m pip install -r requirements.txt`,
  and suggest a virtual environment (`python -m venv .venv`) first.
- **OpenRadioss** not found: first ask whether it is installed somewhere
  already (then set `OPENRADIOSS_PATH` to the folder holding `exec/` and
  `hm_cfg_files/`). Otherwise ask before downloading the release zip for the
  platform from `https://github.com/OpenRadioss/OpenRadioss/releases`
  (about 350 MB), unpacking it, and setting `OPENRADIOSS_PATH`, following
  `https://github.com/OpenRadioss/OpenRadioss/blob/main/INSTALL.md`.
- **ffmpeg**: ask before `python -m pip install imageio-ffmpeg`.

If the user declines, carry on with what is there and say in the report what
is missing and why (no Results step without the solver, no video without
frames). A declined install is a scope decision, not a failure.

---

## 1 - Read `/BEGIN` first. It decodes the whole deck.

Radioss has **no built-in unit system**. `/BEGIN` declares one, and every other
number in the file is meaningless until you have it.

```
/BEGIN
Cell_Phone_Drop
      2022         0
                  Mg                  mm                   s     <- input units
                  Mg                  mm                   s     <- work units
```

| Declared | Force | Stress | Energy | Density |
|---|---|---|---|---|
| kg-mm-ms | kN | GPa | J | kg/mm³ |
| Mg-mm-s | N | MPa | mJ | Mg/mm³ |

Quote every later number in these units, and convert the headline ones into
everyday units: speed in m/s and km/h, mass in g or kg, time in ms. For a
drop test, the equivalent drop height `v²/2g` turns `-3200.9, -3511.2,
-2618.3` into **"as if dropped from 1.5 m"** - but only when the motion is
along gravity: a car hitting a pole at 5 m/s is not "a 1.27 m drop".

**Gravity is a vector, not a flag.** A `/GRAV` card applies `Fscale_Y x
function(t)` along `DIR`: the bumper deck writes `Fscale_Y = -1` on a function
holding `0.00981` mm/ms², i.e. standard gravity pointing down Z. Read the
sign and the function, or "is this standard g?" gets the wrong answer.

---

## 2 - The census, then the scenario

```bash
grep '^/' <deck> | cut -c2- | cut -d/ -f1 | sort | uniq -c | sort -rn
```

One command, and you know what kind of model it is. Then answer, in one
sentence: **what mass, hitting what, how fast, for how long.** Everything else
in the report supports that sentence.

Derive and state: total mass, impact speed, impact energy in joules, the gap
between the structure and the impactor at t = 0, the simulated time, and -
when the motion is along gravity - the equivalent drop height.

Check whether the deck is one scenario or a family: look for `/PARAMETER`,
`&NAME` substitutions, `#include` and sensors. Neither reference deck has any:
each is one deterministic case, and variation has to be created by rewriting
the text (step 9).

---

## 3 - Run the Starter. It is free and it is the truth.

`python src/main.py --run` runs the Starter and the Engine into `<model>/v0/`
with the environment `INSTALL.md` prescribes (`RAD_CFG_PATH`, `RAD_H3D_PATH`,
a 400 MB OpenMP stack, the bundled runtime libraries on the path) and writes
`run_metadata.json` (executables, threads, timings, SHA-256 of the decks run).
By hand, on Windows:

```bash
set OPENRADIOSS_PATH=...\OpenRadioss
set RAD_CFG_PATH=%OPENRADIOSS_PATH%\hm_cfg_files
set RAD_H3D_PATH=%OPENRADIOSS_PATH%\extlib\h3d\lib\win64
set KMP_STACKSIZE=400m
set PATH=%OPENRADIOSS_PATH%\extlib\hm_reader\win64;%OPENRADIOSS_PATH%\extlib\intelOneAPI_runtime\win64;%PATH%
starter_win64.exe -i <Run>_0000.rad -nt 8 -np 1
engine_win64.exe  -i <Run>_0001.rad -nt 8
```

The Starter takes seconds to a minute. If `RAD_CFG_PATH` is unset it fails
**inside the reader** with an error that looks like a deck problem - set it
before diagnosing anything. Never run in the model folder: the solver writes
next to the deck, so copy the decks into `<model>/v0/` first.

**Then check your parser against it.** The listing prints the node count, the
element count by type, and the mass of every part. Compute each part's mass
yourself - area x thickness x density for shells, volume x density for solids -
and compare. Agreement to three decimals proves the geometry, the property and
the density were all read correctly, at once. Disagreement means your parser is
wrong, not the deck.

Harvest from the listing: `TOTAL MASS AND MASS CENTER`, `PART MASS & INERTIA`,
the time-step tables, `INITIAL ADDED MASS ESTIMATION`, every `WARNING ID` with
its text, and the final tally - take the **last** occurrence of `n WARNING(S)`,
because each section box prints its own count.

---

## 4 - Resolve the groups, or the model is a pile of parts

Interfaces, loads and constraints never name parts. They name **groups**, and
groups nest: `/GRNOD/GRNOD` lists other groups, `/GRNOD/PART` lists parts,
`/SURF/SEG` lists segments whose *first* column is a segment id and the rest are
nodes. Resolve them all the way down to nodes, map nodes to the elements that
own them, and you can say which parts each interface joins.

**Node-group ids and surface ids are separate namespaces and both start at 1.**
Looking an id up in both makes every interface appear to touch every part.

Two checks that pay for the effort immediately:

- **Does the computed part pair match the interface's own title?** If
  `bottom_pcb_ic` resolves to `[ic, bottom_pcb]`, the resolution is right.
- **Is any part named by no interface at all?** Such a part is held by nothing
  and stopped by nothing: it rides its initial velocity through whatever is in
  the way. Report its share of the model mass.

---

## 5 - Decode the flags into English

`Inacti=6` is a number. *"Overlaps at the start are accepted and the contact is
softened there, instead of pushing the points apart"* is an explanation. Build
a table keyed by `(keyword, field)` and:

- **Fall back cleanly.** An unknown keyword still renders with its raw fields,
  marked undecoded. A deck the table has never seen must degrade to a census,
  never fail.
- **Report what you could not decode.** Print the `(keyword, field)` pairs the
  deck used that the table does not cover. That list is the extension backlog.
- **Do not scope the table to the deck in front of you.** The next deck will
  use keywords these two do not. Extend on demand; never lock the tool to the
  ~25 keywords one pair of decks happens to use.
- **Check every preset table against the solver's own definitions**
  (`hm_cfg_files/config/CFG/<version>/...`), not memory: `/FAIL/BIQUAD M_Flag`
  runs 1 mild, 2 HSS, 3 UHSS, 4 AA5182, 5 AA6082-T6, 6-7 plastics, 99 user.

---

## 6 - The checks worth running

Work from the physics, not from a checklist of keywords. In rough order of how
often they matter:

| Check | The question | Where the evidence is |
|---|---|---|
| Run length | Is the impact over? | Engine cycle table. Over = the object has **stopped** (at most 2 % of the initial kinetic energy left, i.e. under ~14 % of the speed — 90 % taken out is not enough: a thin-bumper sweep point had 92 % taken out and was still doing 1.4 m/s) or has **bounced** (kinetic energy passed a minimum well before the end and rises again). **Not** "internal energy ÷ initial kinetic": a rigid wall stops the points that hit it outright and books that as external work — in the phone drop the floor takes out more than the phone absorbs — and elastic parts give the energy back. Tell apart "still slowing down" (the first hit is unfinished) from "slowest moment early, then flat" (between hits: a phone pivoting on its corner towards a slap-down). |
| Energy balance | Does the run's energy book close? | The listing's ERROR column leaves out friction, contact damping and hourglass energy. Convert the T01 file with the solver's `th_to_csv` (it names the global channels even without `/TH/TITLE`) and add them back: if the balance closes to within ~1 %, a drifting error is explained, not a fault — and a safety stop set on that column can end a sound run. Found this way on the phone: −6.8 % = friction 3.4 % + hourglass 2.2 %. |
| Hourglass | How much of the answer is the stabiliser? | T01: HOURGLASS ENERGY ÷ INTERNAL ENERGY. Above ~10 %, thin solid parts are bending through numerical modes (phone v0.1: 15 %). |
| Who absorbs the blow | Which component takes the energy? | With `/TH/PART`, the T01 file has each part's internal energy: rank the peaks. The question a drop test is run for (phone: rear cover 69 %, screen 10 %, battery 6 %). |
| Output cadence | Is anything actually recorded? | `/TFILE dT_HIS` against `/RUN` Tstop. A cadence longer than the run writes one row. |
| Instrumentation | Can the model answer its own question? | Count `/TH`, `/ACCEL`, `/SECT`. None means no force, no per-part energy. |
| Forces or impulses | Is that "force" plot really a force? | T01 stores **impulses**. `/TH/TITLE` (an **Engine** card) writes `<Run>T01_TITLES`, which the converter needs to name and differentiate them. |
| Readability | Can anyone open the results? | `/H3D` with no `/ANIM` means no open-source reader exists for the field output. |
| Abort guards | Would a diverging run stop? | `/STOP`. Absent means thresholds of 1e30. `Emax` near 0.99 cannot fire. |
| Reproducibility | Same answer on 4 and 8 threads? | `/PARITH/OFF` means no. |
| Contact vs tie | Can parts pass through each other? | A model whose interfaces are all `/INTER/TYPE2` has glue, not contact. |
| Failure | Can anything break? | No `/FAIL` and elastic materials: "does it crack" is unanswerable by construction. Key the check on the law (`ELAST`), never on a display name. |
| Through-thickness | Can plate-like parts bend? | thickness / mean element size. Below 1, bending is carried by hourglass control, not by material. |
| Rate dependence | Impact properties, or handbook ones? | Johnson-Cook `c = 0`. |
| Mass scaling | What did the time step cost? | `/DT/NODA/CST`, then `MAS.ERR` in the Engine listing. |
| Mesh degeneracy | Collapsed elements? | A hexahedron with a repeated corner node. |
| Wall reach | Does the floor leak? | `/RWALL D_search` against the depth of the body along the wall normal. |
| Orphans | Was this cut down from a bigger model? | Materials, properties and functions nothing references. |

**Every finding needs four things**: the **evidence** (file and card, or the
listing line), **why it happens**, **what it means for the results**, and **2-4
concrete choices** with their reasons and their compute cost. The labels of
the choices are parsed when v0.1 is built ("lengthen to 2.0 ms", "sample 200
points", "10 % energy and 5 % mass"), so keep the numbers in them.

Severity is about what the result is worth, not how unusual the setting is:
`error` = a number from this run would be wrong or missing; `warning` = it would
mislead; `info` = worth knowing before editing the deck.

**Disproving a suspicion is a result.** Keep a "checked and found sound"
section.

---

## 7 - Also answer the questions a mechanical engineer asks on a Tuesday

- **Critical dimensions** - sheet gauges and which parts carry them, wall
  thicknesses, the impactor diameter, the overall envelope. Say why each
  drives the answer.
- **Manufacturability** - spot-weld pitch (nearest-neighbour spacing of the
  spring elements), gauge against grade and formability, element size against
  gauge. Measurements as measurements, comparisons as opinion.
- **Tolerance and variation** - a deck holds exactly **one** nominal geometry.
  Say so, say what it means against a test, and say how a tolerance study
  would be run: N copies of the deck with sampled values.

---

## 8 - Build the report, for a reader who has never opened a deck

`python src/main.py` writes one entry point, `index.html`, working from
`file://` with no server and no network.

**Write for a first-time reader.** The report exists to help someone who has
never opened this deck, and dense solver prose is what loses them first. So:

- Say what a thing *is* before naming it; keep the keyword in brackets as a
  reference: "the starting speed (/INIVEL)", "glue (tie, /INTER/TYPE2)".
- Every step opens with one **"In short:"** line in plain words.
- Everyday units in headlines: "0.1 ms", "27 g", "519 kg", "6,490 J" - never
  `1.000e-4 s` or `6490.385`.
- Findings read "why it happens / what it means / where we saw it", in that
  order; the evidence line may stay technical.
- Keep a glossary on page one (model file, run file, mesh, shell, tie,
  contact, kinetic and internal energy, added mass, energy error, von Mises,
  plastic strain, v0 / v0.1).

**Page one shows the video when there is one, otherwise the preview image.**
A moving picture explains an impact faster than any number. The video comes
from step 9's `--media`; the still is always rendered as the fallback.

Structure and behaviour:

- **Load data as `<script src>`, never `fetch`.** A page opened from `file://`
  cannot fetch a sibling file. Each model's data is a `.js` file that assigns
  onto a global; later versions (`data_v0.1.js`) carry only their analysis and
  reuse v0's geometry.
- **Nothing outside the project folder may be named.** No absolute paths, no
  parent directory names, anywhere in the generated artefacts. Test for it.
- **Layout:** `src/`, `skill/`, `tests/` are shared because they are
  deck-agnostic. `report/`, `media/`, `v0/`, `v0.1/` live **inside each model's
  folder**, because their contents belong to that model.
- **Steps, grouped by the file they read:** model file (Overview, Geometry,
  Materials, Connections) - run file (Run settings) - Results - Review
  (Engineering, Findings, v0 vs v0.1).
- **The 3D view:** boundary faces only (faces belonging to one element, found
  by hashing sorted node tuples with numpy). Draw the rigid wall too - it is an
  analytical surface, not part of the mesh. Per-part toggles plus a toggle for
  the wall, a colour-by selector with a colour bar carrying units (including
  peak stress, plastic strain and displacement once a run has frames), and a
  camera that is **preserved across redraws**.
- **Camera: gravity down, viewer behind the moving object.** Gravity decides
  "down" when the deck has it (the travel direction otherwise). For a drop,
  the fall reads downward; for a car hitting a pole, the road stays flat and
  the beam wraps round the pole across the picture. The same rule drives the
  3D view, the preview and the video.
- **Surface problems where they occur.** A bad number gets a severity marker
  next to it (✕ error, ! warning, i note), a tooltip on hover, and a click that
  jumps to the finding - consistently, for every finding, not one inline and
  the rest in a list. Cross-links (a material name in the parts table) jump to
  the related row and make it blink.
- **Let the reader answer.** Each finding offers its choices as buttons plus a
  free-form box, and an ✕ to hide one that is dealt with (like resolving a file
  in a pull request). The answers download as `interaction.txt`:

  ```
  model: Cell_Phone_Drop
  finding: F-01
  rule: run_ends_before_the_physics
  severity: error
  warning: The cell phone drop simulation is too short: it stops after 0.1 ms ...
  answer: lengthen to 2.0 ms
  ```

---

## 9 - v0, then v0.1. Never edit the original.

**v0** is the original deck, byte for byte, and its run. **v0.1** is the same deck
with the chosen fixes applied, generated from the pristine file by
`python src/main.py --v01` into its own folder, with `deck.diff` and
`edits.json` (what was applied, what was left alone and why). Answers come
from `interaction.txt` when it is next to `src/`, from each finding's
recommended choice otherwise. The originals are never touched; a test asserts
their SHA-256.

```
<model>/  <Run>_0000.rad  <Run>_0001.rad     original, never modified
          v0/    a copy of those decks + their run
          v0.1/  patched decks + deck.diff + edits.json + their run
          report/  media/
```

**Smoke-test a patched deck before the long run.** Run the Starter and a few
hundred Engine cycles (shorten `/RUN` on a scratch copy) and read the Starter's
error box. It is how this skill learned that a surface over solid parts must
be `/SURF/PART/EXT` (plain `/SURF/PART` is ERROR 1104), that a new
`/INTER/TYPE24` self-contact needs `Irem_i2 = 1` to leave the existing ties
alone, and that `/TH/TITLE` belongs in the Engine deck. A minute of smoke test
protects hours of run.

**`deck.diff` is the record of a version.** A copy can ship without the
patched decks: the next build replays the diff onto the pristine decks and
checks that the result diffs back to exactly the recorded hunks (byte-identical
to what ran, tested). Regenerating from the answers instead is not the same —
the builder may have changed since.

**Ship v0 first and say v0.1 is running**, then rebuild the same `index.html`
when the re-runs finish: the report marks v0.1 as "still running" until its
Engine listing shows normal termination, and `--media` skips an unfinished run.

Then show the correction on the same pages as the problem: in v0.1, a place
where v0 had a finding that the fixes removed carries a green ✓ with the edit
that removed it, and the "v0 vs v0.1" step lists the edits, the unchanged
findings, the before/after numbers, both videos and the exact diff.

**Further versions** are built the same way: `--build v0.2 --answer
"rule=answer"` takes v0.1's answers and overrides one (the phone at 5 ms, to
see the bounce and any second impact). Every version folder with decks and no
output is run by `--run`, and the report grows a column per version.

**A design study is the same mechanism pointed at a design variable.** The
mutation points in an impact deck are `/INIVEL` (speed), `/PROP/SHELL`
(thickness), `/RWALL` (diameter, origin, orientation), `/NODE` (geometry
scale) and per-material constants. `--sweep thickness_scale=0.8,1.2` writes
one folder per value under `<model>/sweep/`, starting from v0.1 so every point
inherits its fixes, runs each, and collects one row per run into
`sweep/<variable>.json`; the Engineering step shows it as a table and a chart.
Each row carries the inputs and the outcomes side by side
(`src/features.py`, also written per version as `report/global_features.json`):
that is the shape a surrogate model trains on. Say plainly that two different
models are not a dataset - many runs of one model with its variables moved
are.

---

## 10 - Before you ship

- [ ] `python src/main.py --check` passes, and every install was asked for.
- [ ] Parser counts and per-part masses reconcile with the Starter listing.
- [ ] Every number in the report carries the command, file:line or plot that
      produced it. Anything not regenerable is deleted, not caveated.
- [ ] No absolute path and no parent folder name in any shipped file.
- [ ] Every claim about a flag traces to the Radioss reference, the
      `hm_cfg_files` definitions or the solver source - never to a forum post,
      and never invented. Say **UNVERIFIED** rather than guess.
- [ ] The undecoded-fields list is printed, so the tool's limits are visible.
- [ ] Page one opens on the video if there is one, the preview otherwise.
- [ ] A first-time reader can follow every page: "In short" lines, plain
      units, the glossary.
- [ ] Someone else can run it: pinned `requirements.txt`, a README with setup
      and one command, and every import real and used.
- [ ] A shared copy leaves out what is regenerable and large (animation
      frames, restart files, `.h3d`, deck working copies, patched decks that
      `deck.diff` restores, frame caches whose numbers are in `model*.json`) —
      and it is rehearsed: unpack it elsewhere, rebuild, run the tests.

## Things that do not exist. Never cite them.

An open-source Python reader for `.h3d` (the format is not publicly disclosed;
the maintainers say so). Radioss support in `meshio`. A repository at
`github.com/OpenRadioss/OpenRadioss-examples`. And `pip install vortex-radioss`
returns 404 - Vortex-Radioss installs from GitHub only.
