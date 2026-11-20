# Short narration: the phone drop (about 12 minutes)

One section per slide, in deck order (`h-v` = reveal.js column-slide). Spoken text only: numbers are
written the way they are said. Rendered by `talk/narration/render_short.py` with VibeVoice.

## 1-0

This talk is about two crash simulations: a car bumper hitting a pole, and a phone dropped on the floor. In this short version, I walk through the phone. I wrote everything for a newcomer, someone who opens a crash simulation file for the first time. So every page of the report gives one picture, a plain description, and a few numbers in everyday units, like grams and milliseconds. The solver keyword comes after, in brackets, for the expert. I came to these files the same way that reader does, cold, so every page had to pass my own first read.

## 2-0

The report is one offline web page, with both models in it. It has nine steps, grouped by the file they read, because that is the order in which you meet a Radioss simulation. The model file is the object: the mesh, the materials, the joins and the starting speed. The run file says how long to run, what to save, and when to stop. Results exist only after a run. And the review at the end is judgement. Problems are marked where they appear, not in a list you have to remember. A red cross is an error: a number from this run would be wrong or missing. An exclamation mark is a warning: it would mislead. And an i is a note. You hover a marker to see a summary, and click it to open the finding.

## 2-1

Page one answers one sentence: what hits what, how fast, how heavy, and for how long. Twenty-seven grams of structure hit a rigid floor at five point four metres per second. That is exactly a one and a half metre drop. On every model, the tool does four things. It reports every error and warning where it appears. For each one, it suggests at least two fixes, with what each costs. It recommends one, and the engineer can keep it or pick another with a click. And it compares the original run with a fixed one, and both really run in the solver. The first finding is right on this page: the run stops at zero point one milliseconds, in the middle of the first hit. And a warning: twenty-seven grams is only about a sixth of what a real phone of this size weighs.

## 2-2

The geometry page shows the phone in a light 3D view. You can switch parts off to look inside, and colour them by thickness, mass or mesh size. This page found the phone's biggest modelling problem. The two circuit boards are only zero point four millimetres thick, and they are meshed with a single layer of brick elements. When a plate bends, one face stretches and the other is squeezed, but each of these bricks checks its state at one point only, in the middle. So it cannot tell the two faces apart, and the board barely resists bending. The solver then adds an artificial stiffness to hold it together. The fix is to re-mesh the boards as shells, a plate element that bends correctly with one layer, and is cheaper too. That needs a new mesh, not a number edit, so the tool leaves it as a choice for the engineer.

## 2-3

The materials page says in words what each part is made of: how stiff it is, and whether it can break. The phone is a simple story. Sixteen of its seventeen parts are perfect springs: they never yield and never break. Only the rear cover, a plastic, can deform permanently. That leads to an error: there is no failure rule anywhere. So the question a drop test exists for, does the screen crack, cannot be answered. I did not invent a failure value. The recommended choice is to report the stress margin instead: compare the peak stress with a strength measured separately.

## 2-4

The connections page asks one question: what holds on to what? A solid line is glue, two surfaces stuck together from the start. A dashed line only pushes, and here that is just the floor. The joins are computed from the mesh itself, not read from the names in the file. The picture is striking. The boards and the chips hang on the housing only through the camera and its connector. And two parts have no line at all: the battery and a big chip, about a quarter of the phone's mass, are glued to nothing, and there is no contact anywhere. Nothing stops them, so they pass through whatever is in their way. There is a second problem: the floor only watches the mesh points that start close to it, and here that zone covers just two of the phone's four corners. The fixed version widens it to the whole phone.

## 2-5

The run file is only thirty lines, and it decides whether any result can answer the question. Three lines matter. First, the curves are recorded every millisecond, ten times longer than the whole run, so the curve file has exactly one row, and the solver does not complain. Second, there are no sensors at all: no force on the floor, and no energy per part. So how hard the floor hits back, and which part absorbs the blow, cannot be answered, however long you run. Third, the safety stop is set at ninety-nine percent energy error, and the solver caps that number at ninety-nine percent, so it can never trigger. None of these problems is in Radioss's own catalogue of model checks, because it has no checks for the run file.

## 2-6

The results of the original run fit in one bar. When the run stops, ninety-three percent of the impact energy is still motion. The impact has barely started. So every peak, force or stress you read from this run is too low. Normal termination only means that the solver did not crash. It does not mean the simulation answered anything.

## 2-7

The engineering page asks what a design engineer asks before trusting a model. First, what will the engineer look at? In a phone drop, how the thinnest parts bend: the chips and the boards. And exactly there, the elements are one layer thick and held by artificial stiffness, so the results are hard to trust. Second, did we model the manufacturing tolerances? No: every dimension is one exact number, so real drops will scatter around this answer, and one simulation cannot say by how much. Third, did we model how the parts were made? No: a real board is layers of copper and glass fibre, and here it is one uniform material.

## 2-8

Everything we have met is collected on the findings page, sorted from the most important to fix. Every card has the same four parts: where we saw it, why it happens, what it means for the numbers, and two to four concrete fixes with their cost. One is recommended. If you disagree, you click another fix, or write your own note, and save your answers to a small text file. That file builds the next version of the model. An answer the builder cannot apply is logged with the reason, so nothing is silently dropped.

## 2-9

The fixed version, v zero point one, applies seven recommended fixes with a script, to copies of the files, and runs them in the solver. The run now lasts two milliseconds. The first hit is over after about two thirds of a millisecond, but at two milliseconds more than half of the energy is still motion: the phone pivots on its corner towards a second hit. So the fixed version raises its own next finding: run five milliseconds to include that second hit. With the new sensors, we learn that the rear cover takes most of the blow. And with contact switched on, the battery and the loose chip finally carry load. Each fix answered a question, and each one raised the next.

## 2-10

Two charts answer the drop-test question. First, the highest stress in each part, before and after the fixes. The screen goes from sixty to eighty-four megapascals. The battery and the loose chip read zero in the original, because nothing loads a part that is attached to nothing. With contact and a longer run, they carry thirty-one and seventy-five megapascals. Second, which part absorbs the blow? The original could not say, because no part had an energy sensor. The fixed run records it: the rear cover takes sixty-nine percent, the screen ten, and the battery six. That makes sense: the cover is the part that hits the floor. That is the full loop on one model: read it cold, find what is wrong, fix it, run it again, and compare. Thank you for watching.
