// Numbers drawn in the charts. Each one is copied from the analysis notes (kb/, not in this repository),
// which cite the output file it was read from (paths relative to the repository root, after src/main.py --run).
// [MY] = computed after delivery from the shipped files; not shown in the shipped report.
// The Bumper's overview picture, force-vs-crush curves, top view and crush come from src/data/bumper.json,
// written by tools/bumper_figures.py straight from the shipped files (all [MY]).

// Cell_Phone_Drop/report/model_v0.1.json -> run.energy_sources.parts[*].share_of_peaks
// (each part's peak internal energy / sum of all parts' peaks); '11 other parts' = ic_02 1.8 + camera 1.7 + 9 small parts 1.0
export const phoneParts = [
  { part: 'cover_rear', label: 'rear cover', share: 69.1 },
  { part: 'lcd_screen', label: 'screen', share: 10.3 },
  { part: 'battery', label: 'battery', share: 6.1 },
  { part: 'camera_conn', label: 'camera connector', share: 3.9 },
  { part: 'top_pcb', label: 'top board', share: 3.1 },
  { part: 'bottom_pcb', label: 'bottom board', share: 3.0 },
  { part: 'other', label: '11 other parts', share: 4.5 },
]

// Cell_Phone_Drop v0.1 at 2 ms, in mJ and in % of the impact energy (401.5 mJ):
// balance_raw_pct -5.26 (-21.1 mJ), friction 3.36 (13.5 mJ), hourglass 2.17 (8.7 mJ), balance_closed_pct +0.28 (+1.1 mJ)
// (model_v0.1.json energy_sources). The listing's ERROR column reads -6.8 %: the same 21 mJ divided by
// 310 mJ (401.5 mJ at impact minus the 91.5 mJ the floor took) instead of 401.5 mJ.
export const phoneBooks = [
  { step: 'missing', sub: 'from the books', mj: -21.1, pct: -5.3, kind: 'start' },
  { step: '+ friction', sub: 'new contact, physics', mj: 13.5, pct: 3.4, kind: 'add' },
  { step: '+ stabiliser', sub: 'hourglass, numerical', mj: 8.7, pct: 2.2, kind: 'add' },
  { step: 'left over', sub: 'after both', mj: 1.1, pct: 0.3, kind: 'end' },
]

// Highest nodal von Mises per part, MPa (model.json / model_v0.1.json assembly.peak_von_mises).
// battery and ic_02 read 3.9e-11 and 4.3e-10 MPa in v0: shown as 0, because nothing loads a part attached to nothing.
export const phoneStress = [
  { part: 'lcd_screen', label: 'screen', v0: 59.6, v01: 83.7 },
  { part: 'cover_rear', label: 'rear cover', v0: 84.2, v01: 86.2 },
  { part: 'camera', label: 'camera', v0: 0.8, v01: 17.7 },
  { part: 'camera_conn', label: 'camera connector', v0: 0.3, v01: 116.8 },
  { part: 'battery', label: 'battery', v0: 0, v01: 30.7, note: 'attached to nothing' },
  { part: 'ic_02', label: 'ic_02 (chip)', v0: 0, v01: 74.5, note: 'attached to nothing' },
]

// Bumper: energy missing from the solver's books vs the T01 contact-energy channel, J at 100 ms [MY]
// (Engine listings + T01 CSVs of v0, v0.1 and both sweep points; kb/03_bumper.md §4.3)
export const bumperBooks = [
  { run: 'v0', missing: 18.2, contact: 19.5, err: '−0.3 %' },
  { run: 'v0.1', missing: 63.4, contact: 60.6, err: '−1.0 %' },
  { run: 'thickness ×0.8', missing: 83.6, contact: 80.4, err: '−1.3 %' },
  { run: 'thickness ×1.2', missing: 49.3, contact: 45.6, err: '−0.8 %' },
]

// Thickness sweep from v0.1 (Bumper_Beam/sweep/thickness_scale.json; travel of the 500 kg body [MY]
// from the T01 X-momentum, kb/03_bumper.md §3.2). NOT the report's "largest movement" (a single node).
export const sweep = [
  { scale: '×0.8', gauge: '1.53 mm', travel: 322, stopped: false, note: 'not stopped in 100 ms: still 1.4 m/s, 8 % of the energy left' },
  { scale: '×1.0', gauge: '1.91 mm', travel: 249, stopped: true, note: 'stopped at 95.6 ms' },
  { scale: '×1.2', gauge: '2.30 mm', travel: 190, stopped: true, note: 'stopped at 77.4 ms, then rebounds' },
]

// kb/04_keywords.md §1.2: lines starting with "/" in the four deck files (keyword + subtype)
export const keywordTop15 = [
  ['/PART', 20, 17], ['/GRNOD/NODE', 18, 16], ['/INTER/TYPE2', 12, 14], ['/FUNCT', 13, 4], ['/PROP/SOLID', 0, 17],
  ['/SHELL', 14, 0], ['/SURF/SEG', 0, 14], ['/SURF/PART', 13, 0], ['/BRICK', 0, 10], ['/SH3N', 10, 0],
  ['/TETRA10', 0, 7], ['/PROP/SPR_BEAM', 6, 0], ['/SPRING', 6, 0], ['/SUBSET', 5, 0], ['/GRAV', 1, 3],
]

// Phone v0, the 11 parts the report flags as "less than one element across" (F-06), grouped.
// ratio = the report's "elements across" = thickness / mean element edge (model.json assembly.through_thickness).
// layers = brick layers through the thickness, counted from the node levels in Cell_Phone_Drop_0000.rad [MY];
// TETRA10: share of tets whose corners span the full thickness (screen 99.4 %, connector 99.5 %) [MY].
export const thinParts = [
  { parts: 'top_pcb, bottom_pcb', elem: '1-point brick', t: '0.40', ratio: '0.88 · 0.83', layers: '1', bend: 'the hourglass stabiliser', bad: true },
  { parts: 'ic, ic_01', elem: '1-point brick', t: '0.40 · 0.56', ratio: '0.66 · 0.84', layers: '1', bend: 'the hourglass stabiliser', bad: true },
  { parts: '5 micro-chips', elem: '1-point brick', t: '0.30', ratio: '0.38 – 0.87', layers: '2 × 0.15 mm', bend: 'material, coarsely (3–4 layers is usual)' },
  { parts: 'lcd_screen', elem: 'quadratic tet (TETRA10)', t: '0.56', ratio: '0.58', layers: '1 tet', bend: 'material, under-resolved (no hourglass)' },
  { parts: 'camera_conn', elem: 'quadratic tet (TETRA10)', t: '0.80', ratio: '0.74', layers: '1 tet', bend: 'material, under-resolved (no hourglass)' },
]

// Bumper v0 time history, the pole's two X channels "TH RWALL 1 ... var 35" (normal force) + "var 38" (friction)
// (Bumper_Beam/v0/Bumper_Beam_AP_meshedT01.csv; v0.1 names them RWALL FNX, FTX), sampled every 1 ms, sign flipped.
// As delivered each is a running total (impulse); here in kN·s (the deck's kN·ms / 1000). Their sum is exactly the
// model's X-momentum change, 3,007 N·s. Force = its time derivative over a centred 1 ms window [MY], the same window
// as BumperCrush, so both slides peak at 50.6 kN at 4 ms. (var 35 alone peaks at 51.9 kN.)
export const bumperImpulse = [0.000, 0.024, 0.060, 0.094, 0.138, 0.184, 0.220, 0.264, 0.305, 0.339, 0.378, 0.412, 0.444, 0.477, 0.507, 0.535, 0.562, 0.588, 0.612, 0.635, 0.658, 0.680, 0.702, 0.723, 0.745, 0.767, 0.789, 0.812, 0.836, 0.860, 0.887, 0.914, 0.944, 0.975, 1.008, 1.042, 1.078, 1.116, 1.154, 1.191, 1.227, 1.263, 1.299, 1.333, 1.368, 1.402, 1.436, 1.470, 1.503, 1.537, 1.570, 1.603, 1.635, 1.668, 1.700, 1.733, 1.765, 1.797, 1.829, 1.861, 1.892, 1.924, 1.956, 1.987, 2.019, 2.050, 2.082, 2.113, 2.144, 2.176, 2.207, 2.238, 2.269, 2.300, 2.332, 2.363, 2.394, 2.425, 2.456, 2.487, 2.518, 2.549, 2.580, 2.612, 2.642, 2.673, 2.703, 2.733, 2.761, 2.789, 2.815, 2.841, 2.865, 2.888, 2.910, 2.930, 2.949, 2.966, 2.981, 2.995, 3.007]
export const bumperForce = [0.0, 45.2, 20.3, 47.0, 50.6, 38.4, 39.8, 44.3, 35.4, 37.9, 36.8, 31.8, 33.6, 31.0, 29.1, 27.5, 26.5, 24.5, 23.8, 23.0, 22.1, 21.8, 22.0, 21.3, 21.9, 22.0, 22.2, 23.8, 24.2, 25.4, 26.9, 28.3, 30.1, 31.9, 33.8, 35.5, 36.9, 37.9, 37.4, 37.2, 35.6, 35.8, 34.8, 34.8, 34.4, 34.0, 34.0, 33.5, 33.4, 33.3, 32.9, 33.0, 32.7, 32.5, 32.5, 32.2, 32.2, 31.9, 31.9, 31.8, 31.7, 31.7, 31.5, 31.5, 31.5, 31.4, 31.4, 31.3, 31.3, 31.3, 31.2, 31.2, 31.2, 31.2, 31.2, 31.1, 31.2, 31.1, 31.1, 31.1, 31.1, 31.1, 31.1, 31.0, 30.8, 30.4, 29.8, 29.0, 28.0, 27.1, 26.1, 25.0, 23.7, 22.4, 21.0, 19.5, 17.8, 16.2, 14.5, 12.7, 11.9]
