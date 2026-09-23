# OpenRadioss-to-html

**Read an explicit crash-simulation deck and explain it to an engineer who has never opened it.**

The tool parses an OpenRadioss / Altair Radioss impact model (`*_0000.rad` + `*_0001.rad`) and
builds one interactive HTML report. The report covers what hits what, how fast and with what mass,
how the model is assembled, and which settings will shape the answer before the physics does.
It lists what is wrong with the model, builds a corrected version, runs both and compares them.

### ▶ [Open the live report](https://karim-53.github.io/OpenRadioss-to-html/)

The report covers two public OpenRadioss example models: a bumper beam hitting a rigid pole, and
a phone dropped onto a floor. It runs from `file://` with no server and no network, so GitHub
Pages serves it unchanged.

| Bumper beam into a pole, peak stress | Phone drop, first contact |
|---|---|
| ![Bumper beam at peak stress](docs/Bumper_Beam/media/still_v0.1_peak_stress.png) | ![Phone at first contact with the floor](docs/Cell_Phone_Drop/media/still_v0.1_first_contact.png) |

---

## What the report does

Nine steps, grouped by the file they read:

* **Model file (`_0000.rad`)**
  * **Overview:** the scenario in one sentence, the units, and a glossary.
  * **Geometry:** the 3D assembly. You can switch parts off and colour them by thickness, mass,
    mesh size or, after a run, peak stress, plastic strain and displacement.
  * **Materials:** laws, failure criteria and their presets.
  * **Connections:** ties, contacts and rigid bodies, computed from the mesh rather than read off
    the interface names.
* **Run file (`_0001.rad`)**
  * **Run settings:** how long the run is, what it saves, and what would stop a run that goes
    wrong.
* **Results**
  * The energy balance, how trustworthy the run is, the video and the key moments.
* **Review**
  * **Engineering:** the dimensions that decide the answer, manufacturability and tolerances.
  * **Findings:** what is wrong, why, what it means, and choices for fixing it.
  * **v0 vs v0.1:** the original model against the corrected one.

Each problem is marked where it appears (✕ error, ! warning, i note). Hovering over a marker shows
a summary; clicking it opens the finding. You can answer each finding in the page and save the
answers as `interaction.txt`. The next build then applies your answers instead of the
recommended defaults.

## What it found in the two models

**Bumper beam** (519 kg at 5 m/s into a 254 mm rigid pole, 100 ms). Four fixes:
* The force channels were being read as impulses. Adding `/TH/TITLE` fixed that.
* The run had no open-format 3D output. Adding `/ANIM` produced it; the video comes from this.
* The run had no safety stop. `/STOP` was added.
* The DP1000 sheets used the DP600 failure setting. It was switched to the ultra-high-strength
  steel (UHSS) rule, `/FAIL/BIQUAD` `M_Flag` 2 → 3.

In both runs the impact takes out all the motion energy, about 95 % of it into deformation. The
corrected run shows a peak stress of 0.7 GPa and a largest permanent stretch of 35 %.

**Phone drop** (1.5 m equivalent drop onto a rigid floor). Seven fixes:
* The run lasted 0.1 ms, which ends before the impact does. It now runs for 2 ms.
* The curves were sampled once. They are now sampled 200 times.
* The floor has a force sensor, and energy is recorded per part.
* One general contact (`/INTER/TYPE24`) now covers all parts.
* The safety stop can actually trigger.
* `/PARITH/ON` makes the arithmetic repeatable across thread counts.
* The rigid wall watches the whole phone.

What the 2 ms run shows:
* **The first hit is over at 0.67 ms.** It takes out 44 % of the motion energy. The phone then
  pivots on its corner towards a second hit.
* **The rear cover absorbs 69 % of the blow**, the screen 10 % and the battery 6 %.
* **The solver's energy error of 6.8 % is fully explained.** It is friction in the new contact
  (3.4 %) plus hourglass energy (2.2 %). Counting both, the balance closes to 0.3 %.
* **Hourglass energy reaches 15 % of the internal energy**, above the usual 10 % limit. The thin
  plates are meshed with less than one solid element through their thickness. The fix is a
  re-mesh with shells, not a deck edit.

**Design study: bumper sheet thickness.** Every sheet was scaled by 0.8, 1.0 and 1.2, starting
from the corrected model:

| Thickness | Mean gauge | Motion energy taken out in 100 ms | Largest movement | Highest stress | Largest permanent stretch |
|---|---|---|---|---|---|
| × 0.8 | 1.53 mm | 92 %, **not stopped** | 690 mm | 782 MPa | 31 % |
| × 1.0 | 1.91 mm | 100 % | 311 mm | 705 MPa | 35 % |
| × 1.2 | 2.30 mm | 100 % | 262 mm | 695 MPa | 27 % |

The response is strongly one-sided. With 20 % less steel the structure travels more than twice as
far into the pole and is not stopped within the 100 ms. With 20 % more steel it travels only 16 %
less. That is the kind of cliff a tolerance study exists to find, and it sits on the thin side of
the nominal design.

## How the analysis is built

* **Fields are read by name, not by position.** Starter decks are fixed width on a
  ten-character ruler, and every card carries a `#` comment that names its fields. The parser
  reads the column layout from that line instead of hard-coding it per keyword, so a new keyword
  costs nothing. Splitting on whitespace would shift every value after a blank field. In these
  decks that silently turns a rate-independent steel into a rate-hardening one.
* **The Engine deck is parsed separately.** It is whitespace-delimited, and several of its cards
  (including `/RUN`) have no header at all.
* **The numbers are checked against the solver.** Node and element counts and the mass of every
  part are compared with the Starter's own listing. Both models reconcile to 0.000 %.
* **Presets and flags are checked against the solver's own definitions** (`hm_cfg_files`), not
  against memory. That check corrected one table: `/FAIL/BIQUAD` preset 5 is aluminium
  AA6082-T6, not a plastic.
* **The originals are never edited.** Every fix is a named edit of one field, applied to a copy
  and recorded as a unified diff (`deck.diff`) and in `edits.json` with its reason. A version can
  be restored byte-for-byte from its diff. Tests check both.
* **Each patched deck is smoke-tested before the long run:** the Starter plus a few hundred
  cycles. That caught a real error: a contact surface over solid parts must be `/SURF/PART/EXT`.
* **Design studies use the same mechanism, aimed at a design variable.** Each run writes one row
  of inputs and outcomes (`report/global_features.json`), which is the shape a surrogate model
  trains on.

## Skills this project shows

* **Explicit FE crash simulation:** elasto-plastic steels with failure (`/FAIL/BIQUAD`), ties
  versus contacts (`/INTER/TYPE2`, `TYPE7`, `TYPE24`), rigid walls and rigid bodies, initial
  velocity and gravity. Also time step and added mass, the energy balance, and hourglass control.
* **Engineering judgement over keyword dumps:** finding what decides the answer, spotting what
  is physically wrong, and quantifying a fix by running it.
* **Python engineering:** a fixed-width parser, mesh boundary extraction with numpy, interactive
  3D with plotly, video rendering, and a pytest suite that checks results against the solver's
  own output.
* **Automation and AI workflows:** one command from deck to report, a reproducible
  fix → run → compare loop, and an agent skill that runs the same workflow on a deck nobody has
  seen.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt

python src/fetch_models.py           # download the two example decks and verify their SHA-256
python src/main.py --check           # what is installed and what is missing
python src/main.py                   # read the decks, write index.html (~1 min)
python -m pytest -q                  # the tests
python src/build_site.py             # copy the built report into docs/ for GitHub Pages
```

This needs Python 3.12 or newer. It was developed on Windows 11 with Python 3.12.10.

Any folder next to `src/` that holds a `*_0000.rad` is treated as a model. To analyse another
deck pair, put it in its own folder and it gets the same report.

### With the solver (optional)

The report is built from the decks alone. Running the solver adds the Results step, the video,
the corrected version and the comparison. Point `OPENRADIOSS_PATH` at an unpacked
[OpenRadioss release](https://github.com/OpenRadioss/OpenRadioss/releases), then:

```bash
python src/main.py --run --media        # run the original decks, render stills and video
python src/main.py --v01 --run --media  # build the corrected decks (v0.1), run and compare them
python src/main.py --model Bumper_Beam --sweep thickness_scale=0.8,1.2 --run   # a design study
```

Runs behind the published report, on a 6-core laptop CPU:

| Run | Starter | Engine | Result |
|---|---|---|---|
| Bumper beam, original | 26.5 s | 501 s, 100 000 cycles | normal termination |
| Bumper beam, corrected | 1.7 s | 1 345 s, 100 000 cycles | normal termination |
| Phone drop, original | 30.2 s | 631 s, 2 676 cycles | normal termination |
| Phone drop, corrected | 14.6 s | 5 660 s, 53 513 cycles | normal termination, 2 ms instead of 0.1 ms |
| Bumper beam, thickness × 0.8 and × 1.2 | — | 1 116 s and 1 033 s | normal termination |

### The agent skill

[`skill/openradioss-explore/SKILL.md`](skill/openradioss-explore/SKILL.md) is written for an AI
coding agent, following the `SKILL.md` convention, and also reads as a plain playbook for a
person. Given a new deck pair, it goes through these steps:
* Read the decks cold.
* Check the environment, and ask before installing anything.
* Build the report and run the solver.
* Propose fixes, then build and smoke-test v0.1.
* Ship v0 while v0.1 runs.

## Repository layout

| Path | What it is |
|---|---|
| `docs/` | The published report, served by GitHub Pages |
| `src/main.py` | The one command; the other files in `src/` are modules it calls |
| `src/fetch_models.py` | Downloads the example decks and verifies them |
| `src/build_site.py` | Copies the built report into `docs/` |
| `src/web/` | The report's page, script and styles |
| `skill/openradioss-explore/` | The agent skill |
| `tests/` | Parser, Engine-deck, pipeline and output checks |

## Licence and credits

* **Code:** MIT, see [LICENSE](LICENSE).
* **Models:** *Bumper Beam* and *Cell Phone Drop Test* are © 2022 Altair Engineering Inc.,
  published as [OpenRadioss example models](https://openradioss.org/models/) under
  [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). They are not stored in this
  repository: `src/fetch_models.py` downloads them from the OpenRadioss wiki. The report in
  `docs/` contains geometry and results derived from them, and is shared under the same
  licence.
* This project is independent. It is not affiliated with or endorsed by Altair or the OpenRadioss
  project.

## About me

I'm Mohamed Karim Belaid, a data scientist. For six years I worked inside Porsche's
passive-safety department on the frontal crash-test programme, as a consultant with IDIADA.
There I built models that catch failed sensor channels, reconstruct lost signals, and predict
untested occupant configurations from physical tests and simulation output. I also built an LLM
agent that answers engineers' crash-data questions. I'm finishing my PhD at LMU Munich on
machine learning.

This project is the simulation-side counterpart: reading the model itself and explaining it the
way a crash engineer would want it explained.

[LinkedIn](https://www.linkedin.com/in/mohamedkarim-belaid) ·
[Google Scholar](https://scholar.google.com/citations?hl=en&user=F8QtCPIAAAAJ) ·
[GitHub](https://github.com/Karim-53)
