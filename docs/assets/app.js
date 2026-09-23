/* The report's whole behaviour. No build step, no framework, no network.
 *
 * Everything shown is read from window.RADIOSS[<model>] (v0, with the
 * geometry) and window.RADIOSS_VERSIONS[<model>][<version>] (later versions,
 * analysis only), which src/report.py writes. This file decides only how to
 * draw it, never what is true: if a number is wrong, it is wrong in model.json
 * and the fix belongs in analyze.py.
 *
 * Wording rule: the reader may be opening a Radioss model for the first time.
 * Say what a thing is before naming it, keep solver keywords as a reference
 * in brackets, and explain a term the first time it appears (the glossary on
 * page one holds the rest).
 */
'use strict';

/* [label, section id, tooltip, group] - the group says which file a step reads. */
const STEPS = [
  ['Overview',    'step-model',       'what this simulation is',                    'Model file  _0000.rad'],
  ['Geometry',    'step-geometry',    'the parts and the mesh, in 3D',              'Model file  _0000.rad'],
  ['Materials',   'step-materials',   'what each part is made of',                  'Model file  _0000.rad'],
  ['Connections', 'step-contacts',    'how parts are joined, and what starts the motion', 'Model file  _0000.rad'],
  ['Run settings','step-run',         'how long to simulate, what to save',         'Run file  _0001.rad'],
  ['Results',     'step-results',     'what the solver produced',                   'Results'],
  ['Engineering', 'step-engineering', 'dimensions, manufacturing, tolerances',      'Review'],
  ['Findings',    'step-findings',    'what is wrong, and what to do about it',     'Review'],
  ['v0 vs v0.1',  'step-compare',     'what the fixes changed',                     'Review'],
];

const PALETTE = ['#4c9aff','#ffb454','#5bc8af','#ff6b6b','#b18aff','#8fd14f','#ff9ecd',
                 '#4ecdc4','#f4a261','#7aa2f7','#e0af68','#9ece6a','#bb9af7','#f7768e',
                 '#73daca','#ff9e64','#7dcfff','#c0caf5','#a9b1d6','#41a6b5'];

let state = { model: null, step: 0, version: 'v0', answers: {}, dismissed: {},
               visible: {}, colorBy: 'part', camera: {} };

/* ------------------------------------------------------------- utilities */
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const n = document.createElement(tag);
  if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; };
const esc = (s) => String(s === null || s === undefined ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function fmt(v, digits) {
  if (v === null || v === undefined || v === '') return '–';
  if (typeof v !== 'number') return esc(v);
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (Number.isInteger(v) && a < 1e12) return v.toLocaleString();
  if (a >= 1e5 || a < 1e-3) return v.toExponential(digits === undefined ? 3 : digits);
  return v.toLocaleString(undefined, { maximumFractionDigits: digits === undefined ? 3 : digits });
}
/* Three significant figures: 6490.385 -> "6,490". */
const sig = (v, n) => typeof v === 'number' ? fmt(Number(v.toPrecision(n || 3))) : '–';
/* A time a person can read: 1e-4 s -> "0.1 ms". */
function dur(value, unit) {
  if (value === null || value === undefined) return '–';
  const s = value * ({ s: 1, ms: 1e-3, us: 1e-6 }[unit] || 1);
  if (s >= 1) return fmt(s, 3) + ' s';
  if (s >= 1e-5) return fmt(s * 1e3, 3) + ' ms';      // ms read best down to 0.01 ms
  return fmt(s * 1e6, 3) + ' µs';
}

const data = () => window.RADIOSS[state.model];
const versionData = (name, v) => v === 'v0'
  ? ((window.RADIOSS[name] || {}).analysis)
  : ((((window.RADIOSS_VERSIONS || {})[name] || {})[v] || {}).analysis);
const A = () => versionData(state.model, state.version) || data().analysis;
const A0 = () => data().analysis;
const hasVersion = (name, v) => !!versionData(name, v);
/* Every version any model has, in order: v0, v0.1, v0.2, ... */
const allVersions = () => ['v0'].concat([...new Set(Object.values(window.RADIOSS_VERSIONS || {})
  .flatMap(o => Object.keys(o)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
const laterVersions = (name) => allVersions().filter(v => v !== 'v0' && hasVersion(name, v));
function versionLabel(name, v) {
  if (v === 'v0') return 'v0 — original';
  const an = versionData(name, v);
  return an ? `${v} — fixed, ${dur((an.engine.run || {}).Tstop, an.units.work[2])}` : `${v} — fixed`;
}
const answerKey = (fid, model, version) =>
  fid + '@' + model + (version && version !== 'v0' ? '@' + version : '');

function kpi(value, label, note, anchor, id) {
  return `<div class="kpi"><div class="v">${value}${anchor ? mark(anchor, id) : ''}</div>` +
         `<div class="l">${label}</div>` +
         (note ? `<div class="n">${note}</div>` : '') + '</div>';
}

function table(headers, rows, opts) {
  opts = opts || {};
  const th = headers.map((h, i) =>
    `<th class="${opts.num && opts.num.includes(i) ? 'num' : ''}" data-col="${i}"
         ${opts.tips && opts.tips[i] ? `title="${esc(opts.tips[i])}"` : ''}>${esc(h)}</th>`).join('');
  const tb = rows.map((r, ri) => {
    const key = opts.rowKey && opts.rowKey[ri] ? ` data-row="${esc(opts.rowKey[ri])}"` : '';
    return `<tr${key}>` + r.map((c, i) =>
      `<td class="${opts.num && opts.num.includes(i) ? 'num' : ''}">${c}</td>`).join('') + '</tr>';
  }).join('');
  return `<div class="tablewrap"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`;
}

/* Sort any table by clicking a header. Numeric columns sort numerically. */
document.addEventListener('click', (e) => {
  const th = e.target.closest('th[data-col]');
  if (!th) return;
  const tbl = th.closest('table'), idx = +th.dataset.col;
  const body = tbl.tBodies[0], rows = Array.from(body.rows);
  const dir = th.dataset.dir === 'asc' ? -1 : 1;
  Array.from(tbl.tHead.rows[0].cells).forEach(c => delete c.dataset.dir);
  th.dataset.dir = dir === 1 ? 'asc' : 'desc';
  const num = th.classList.contains('num');
  rows.sort((a, b) => {
    const x = a.cells[idx].textContent.trim(), y = b.cells[idx].textContent.trim();
    if (num) {
      const nx = parseFloat(x.replace(/[^\d.eE+-]/g, '')), ny = parseFloat(y.replace(/[^\d.eE+-]/g, ''));
      return ((isNaN(nx) ? -Infinity : nx) - (isNaN(ny) ? -Infinity : ny)) * dir;
    }
    return x.localeCompare(y) * dir;
  });
  rows.forEach(r => body.appendChild(r));
});


/* ---------------------------------------------- inline severity markers
 * A finding is useless if the reader has to remember it while looking at a
 * table. Every finding carries `anchors` (where in the page it belongs) and
 * optionally `anchor_ids` (which rows), so the bad number is marked where it
 * appears: hover for the summary, click to open it in Findings.
 *
 * In v0.1, a place where v0 had a finding that the fixes removed gets a green
 * tick instead, so the corrections show up on the same pages as the problems.
 */
const SEV_GLYPH = { error: '✕', warning: '!', info: 'i', fixed: '✓' };
const SEV_RANK = { error: 0, warning: 1, info: 2 };
const SEV_WORD = { error: 'error', warning: 'warning', info: 'note' };

function findingsFor(anchor, id, fs) {
  fs = (fs || A().findings || []).filter(f => (f.anchors || []).includes(anchor));
  if (id === undefined || id === null) return fs;
  return fs.filter(f => !(f.anchor_ids || []).length || f.anchor_ids.includes(id));
}
/* v0 findings at this place that the current version no longer raises. */
function fixedFor(anchor, id) {
  if (state.version === 'v0') return [];
  const now = new Set((A().findings || []).map(f => f.rule));
  return findingsFor(anchor, id, A0().findings).filter(f => !now.has(f.rule));
}

function mark(anchor, id) {
  const fs = findingsFor(anchor, id);
  if (fs.length) {
    const worst = fs.slice().sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])[0];
    return `<span class="mark ${esc(worst.severity)}" data-fid="${esc(fs.map(f => f.id).join(','))}"
       role="button" tabindex="0" aria-label="${esc(SEV_WORD[worst.severity])}: ${esc(worst.title)}"
       >${SEV_GLYPH[worst.severity] || '!'}</span>`;
  }
  const fixed = fixedFor(anchor, id);
  if (fixed.length) {
    return `<span class="mark fixed" data-fixed="${esc(fixed.map(f => f.rule).join(','))}"
       role="button" tabindex="0" aria-label="fixed in ${esc(state.version)}: ${esc(fixed[0].title)}"
       >${SEV_GLYPH.fixed}</span>`;
  }
  return '';
}

let tipNode = null;
function tipEl() {
  if (!tipNode) { tipNode = el('div'); tipNode.id = 'tip'; document.body.appendChild(tipNode); }
  return tipNode;
}
function appliedFor(rule) {
  return ((A().changes || {}).applied || []).find(c => c.rule === rule);
}
document.addEventListener('mouseover', (e) => {
  const m = e.target.closest('.mark');
  if (!m) return;
  const tip = tipEl();
  if (m.dataset.fixed) {
    const rules = m.dataset.fixed.split(',');
    const fs = (A0().findings || []).filter(f => rules.includes(f.rule));
    tip.innerHTML = fs.map(f => {
      const c = appliedFor(f.rule) || {};
      return `<div class="ttitle"><span class="badge fixed">fixed in ${esc(state.version)}</span>
        ${esc(f.title)}</div>
        <div>Answer applied: <b>${esc(c.answer || '')}</b></div>
        <div class="tmeta">${esc((c.edits || []).join(' · '))}</div>
        <div class="tmeta">Click to see every change on the "v0 vs v0.1" page.</div>`;
    }).join('<hr style="border:0;border-top:1px solid var(--line);margin:9px 0">');
  } else {
    const ids = m.dataset.fid.split(',');
    const fs = (A().findings || []).filter(f => ids.includes(f.id));
    if (!fs.length) return;
    tip.innerHTML = fs.map(f => `
      <div class="ttitle"><span class="badge ${esc(f.severity)}">${esc(SEV_WORD[f.severity])}</span>
        ${esc(f.title)}</div>
      <div>${esc(f.consequence)}</div>
      <div class="tmeta">Click to open ${esc(f.id)} in Findings, with the ways to fix it.</div>`)
      .join('<hr style="border:0;border-top:1px solid var(--line);margin:9px 0">');
  }
  tip.style.display = 'block';
  place(tip, m);
});
document.addEventListener('mouseout', (e) => {
  if (e.target.closest('.mark')) tipEl().style.display = 'none';
});
function place(tip, anchorEl) {
  const r = anchorEl.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = r.left, y = r.bottom + 8;
  if (x + w > innerWidth - 12) x = Math.max(12, innerWidth - w - 12);
  if (y + h > innerHeight - 12) y = Math.max(12, r.top - h - 8);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
document.addEventListener('click', (e) => {
  const m = e.target.closest('.mark');
  if (m) {
    tipEl().style.display = 'none';
    if (m.dataset.fixed) jump('compare:' + m.dataset.fixed.split(',')[0]);
    else jumpToFinding(m.dataset.fid.split(',')[0]);
    return;
  }
  const j = e.target.closest('[data-jump]');
  if (j) jump(j.dataset.jump);
});

const FINDINGS_STEP = 7;
function jumpToFinding(fid) {
  show(FINDINGS_STEP);
  requestAnimationFrame(() => highlight(`.finding[data-fid="${CSS.escape(fid)}"]`));
}
/* "materials:5" -> Materials step, blink the row for material 5. */
const JUMP_STEPS = { model: 0, geometry: 1, materials: 2, contacts: 3, run: 4,
                     results: 5, engineering: 6, findings: 7, compare: 8 };
function jump(target) {
  const [where, key] = String(target).split(':');
  const step = JUMP_STEPS[where];
  if (step === undefined) return;
  show(step);
  if (key) requestAnimationFrame(() => highlight(`[data-row="${where}:${CSS.escape(key)}"]`));
}
function highlight(selector) {
  const node = document.querySelector('.step.on ' + selector) || document.querySelector(selector);
  if (!node) return;
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  node.classList.remove('blink');
  void node.offsetWidth;            // restart the animation
  node.classList.add('blink');
  setTimeout(() => node.classList.remove('blink'), 2600);
}

/* A strip at the top of every step while looking at a later version. */
function versionBanner() {
  if (state.version === 'v0') return '';
  const a = A(), ch = a.changes || {}, run = a.run || {};
  const n = (ch.applied || []).length;
  const running = !run.history;
  return `<div class="banner">
    <b>You are looking at ${esc(state.version)}</b>: the same model with ${n} fix(es) applied to the
    decks. Places that were fixed carry a green ${SEV_GLYPH.fixed}.
    ${running ? '<br><b>The v0.1 simulation is still running</b>; its results appear here when the report is rebuilt.' : ''}
    <span class="jump" data-jump="compare">See every change →</span></div>`;
}

/* --------------------------------------------------------------- step 0 */
function renderModel() {
  const a = A(), s = a.scenario, u = a.units, w = a.rigid_wall || {};
  const tu = u.work[2];
  const cards = [];
  if (s.impact_speed_ms) cards.push(kpi(fmt(s.impact_speed_ms, 2) + ' m/s',
    'impact speed', `${fmt(s.impact_speed_kmh,1)} km/h &middot; set by /INIVEL (initial velocity), line ${a.velocity.line}`));
  if (s.equivalent_drop_height_mm) cards.push(kpi(fmt(s.equivalent_drop_height_mm/1000, 2) + ' m',
    'the same as a drop from', 'height a free fall needs to reach this speed (v&sup2;/2g)'));
  cards.push(kpi(massLabel(a), 'total mass',
    s.lumped_mass ? `of which ${fmt(s.lumped_mass)} ${u.work[0]} is one rigid block (/RBODY) standing in for the rest of the vehicle` : 'sum of every part',
    'scenario.mass'));
  if (s.kinetic_energy_J) cards.push(kpi(sig(s.kinetic_energy_J) + ' J', 'energy of the impact',
    'motion energy at the start, &frac12;&middot;mass&middot;speed&sup2;'));
  cards.push(kpi(dur(s.termination, s.termination_unit), 'simulated time',
    'how long the solver simulates (/RUN in the run file)', 'scenario.termination'));
  if (w.diameter) cards.push(kpi(fmt(w.diameter) + ' mm', 'pole diameter', 'an ideal rigid cylinder (/RWALL)'));
  if (w.node_distance_min !== undefined) cards.push(kpi(fmt(w.node_distance_min, 3) + ' mm',
    'gap to the floor at the start', fmt(w.nodes_touching_at_t0) + ' mesh point(s) already touching it'));

  const counts = a.starter.counts;
  const census = Object.entries(a.starter.census).sort((x, y) => y[1] - x[1]);

  /* The video when there is one, the still otherwise: a moving picture
     explains an impact faster than any number on this page. */
  const med = a.media || {};
  const hero = med.video
    ? `<div class="preview"><video src="${esc(med.video)}" autoplay loop muted playsinline controls></video>
         <div class="cap">The simulation as the solver computed it, coloured by stress (von Mises, in
         ${esc(u.derived.stress)}). Rotate the model yourself on the Geometry page.</div></div>`
    : (a.preview
      ? `<div class="preview"><img src="${esc(a.preview)}" alt="${esc(a.title)}">
           <div class="cap">The parts and the rigid ${w.type === 'CYL' ? 'pole' : 'wall'} they hit, seen with the direction
           of travel pointing down the screen. Rotate it on the Geometry page.</div></div>`
      : `<div class="pending">Preview image not rendered${a.preview_error ? ': ' + esc(a.preview_error) : ''}.</div>`);

  $('step-model').innerHTML = `
    ${versionBanner()}
    <h2>${esc(a.title || a.name)}</h2>
    <p class="sub">${headline(a)}</p>
    <div class="hero">
      ${hero}
      <div class="grid">${cards.join('')}</div>
    </div>

    <details class="panel howto" ${state.seenHowto ? '' : 'open'}>
      <summary><b>How to read this report</b></summary>
      <p>A Radioss simulation is two text files. The <b>model file</b> (<code>${esc(a.starter.file)}</code>)
      describes the object: its shape cut into small elements (the <i>mesh</i>), its materials, how the parts
      are joined and how it starts moving. The <b>run file</b> (<code>${esc(a.engine.file || '')}</code>) says how
      long to simulate and what to save. The steps above follow that order: model file, run file, results,
      then a review.</p>
      <p>Problems are marked where they appear:
      <span class="mark error">${SEV_GLYPH.error}</span> an error (a result would be wrong or missing),
      <span class="mark warning">${SEV_GLYPH.warning}</span> a warning (a result would mislead),
      <span class="mark info">${SEV_GLYPH.info}</span> a note. Hover for a summary, click to open the details and
      the ways to fix it. The <b>v0 / v0.1</b> switch at the top right shows the same model with the fixes
      applied (<span class="mark fixed">${SEV_GLYPH.fixed}</span> marks what changed). Blue underlined words jump
      to related rows elsewhere. Arrow keys move between steps.</p>
    </details>

    <h3>What needs attention</h3>
    ${findingStrip()}

    <h3>Units &mdash; read from the first card of the model file (/BEGIN)</h3>
    <div class="panel">
      <p class="note" style="margin-top:0">Radioss has no built-in units: each file declares its own, and every
      number in it is in those units. This one uses <b>${esc(u.work.join(', '))}</b> (mass, length, time), which
      makes the other quantities:</p>
      <div class="grid">
        ${kpi(esc(u.derived.force), 'force')}
        ${kpi(esc(u.derived.stress), 'stress')}
        ${kpi(esc(u.derived.energy), 'energy')}
        ${kpi(esc(u.derived.density), 'density')}
      </div>
    </div>

    <h3>What is in the model file</h3>
    <div class="grid">
      ${kpi(fmt(counts.nodes), 'mesh points (nodes)')}
      ${kpi(Object.entries(counts.elements).map(([k,v]) => fmt(v)+' '+elementWord(k)).join('<br>') || '–', 'elements')}
      ${kpi(fmt(counts.parts), 'parts')}
      ${kpi(fmt(counts.materials), 'materials')}
      ${kpi(fmt(counts.properties), 'properties', 'thickness or element settings per part')}
      ${kpi(fmt(a.starter.lines), 'lines of text', esc(a.starter.file))}
    </div>

    <details class="panel"><summary><b>Words used in this report</b></summary>${glossary()}</details>

    <h3>Every card type in the model file, and what it does</h3>
    ${table(['Card','How many','Kind','What it does'],
      census.map(([k, n]) => {
        const r = (a.keyword_roles || []).find(x => x.keyword === k) || {};
        return ['<code>/' + esc(k) + '</code>', fmt(n), `<span class="pill">${esc(r.category||'')}</span>`, esc(r.role||'')];
      }), { num: [1] })}
  `;
  const d = $('step-model').querySelector('details.howto');
  if (d) d.addEventListener('toggle', () => { state.seenHowto = !d.open; });
}

const wallWord = (a) => ((a.rigid_wall || {}).type === 'CYL' ? 'pole' : (a.rigid_wall || {}).type === 'PLANE' ? 'floor' : 'wall');
function massGrams(a) {
  const m = a.scenario.total_mass_deck || 0;
  return m * ({ Mg: 1e6, kg: 1e3, g: 1, t: 1e6 }[a.units.work[0]] || 1);
}
/* "27.1 g" for a phone, "1,120 kg" for a car: the unit a person would use. */
function massLabel(a) {
  const g = massGrams(a);
  return g >= 1000 ? fmt(g / 1000, 1) + ' kg' : fmt(g, 1) + ' g';
}
function elementWord(k) {
  return ({ SHELL: 'shells (thin plates)', SH3N: 'triangular shells', BRICK: 'bricks (solids)',
            TETRA4: 'tetrahedra', TETRA10: 'tetrahedra (10-node)', SPRING: 'springs (spot welds)',
            BEAM: 'beams', TRUSS: 'trusses' })[k] || k;
}

const GLOSSARY = [
  ['Model file (_0000.rad)', 'Called the "Starter" deck by Radioss: the mesh, materials, connections and starting conditions.'],
  ['Run file (_0001.rad)', 'Called the "Engine" deck: how long to simulate, what to save, when to stop.'],
  ['Mesh, element, node', 'The shape is cut into small elements (bricks, triangles, quads); their corners are the nodes.'],
  ['Shell / solid', 'A shell element is a thin plate with a thickness value (sheet metal). A solid is a 3D brick.'],
  ['Part', 'A set of elements sharing one material and one property, e.g. "bumper beam" or "screen".'],
  ['Rigid wall', 'An ideal surface that cannot deform or move: the floor, or the pole.'],
  ['Tie (glue)', 'An interface (/INTER/TYPE2) that glues two surfaces that touch at the start.'],
  ['Contact', 'An interface (/INTER/TYPE7, TYPE24) that lets parts push on each other without passing through.'],
  ['Kinetic / internal energy', 'Motion energy, and the energy the structure absorbs by deforming. In an impact the first turns into the second.'],
  ['Time step, cycle', 'The solver advances in tiny time steps (millionths of a second); one step is one cycle.'],
  ['Added mass (mass scaling)', 'Mass the solver adds to the smallest elements so it can take bigger steps. Below about 2 % it is harmless.'],
  ['Energy error', 'How far the solver\'s energy bookkeeping is out. A few percent is normal.'],
  ['Von Mises stress', 'One number for how hard the material is loaded at a point; compare it with the material\'s yield strength.'],
  ['Plastic strain', 'Permanent stretch: 0 means the material springs back; 0.1 means 10 % permanently stretched.'],
  ['Time history (T01) / animation (A001...)', 'Curves over time, and 3D snapshots of the whole model.'],
  ['v0 / v0.1', 'The original model, and the same model with the fixes chosen on the Findings page.'],
];
function glossary() {
  return '<dl class="gloss">' + GLOSSARY.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('') + '</dl>';
}

/* A compact, clickable summary of the findings, so page one already says what
   is wrong instead of leaving it seven steps away. */
function findingStrip() {
  const fs = (A().findings || []);
  const fixed = state.version === 'v0' ? [] : (A0().findings || [])
    .filter(f => !new Set(fs.map(x => x.rule)).has(f.rule));
  if (!fs.length && !fixed.length) return '<div class="panel note">No findings on this model.</div>';
  return '<div class="panel">' + fs.map(f =>
    `<div class="strip" onclick="jumpToFinding('${esc(f.id)}')">
       <span class="badge ${esc(f.severity)}">${esc(SEV_WORD[f.severity])}</span>
       <span class="jump">${esc(f.title)}</span>
       <span class="spacer" style="flex:1"></span>
       <span class="pill">${esc(f.id)}</span>
     </div>`).join('') + fixed.map(f =>
    `<div class="strip" onclick="jump('compare:${esc(f.rule)}')">
       <span class="badge fixed">fixed</span>
       <span class="jump" style="text-decoration:line-through;opacity:.8">${esc(f.title)}</span>
     </div>`).join('') + '</div>';
}

function headline(a) {
  const s = a.scenario, w = a.rigid_wall || {};
  const bits = [];
  if (s.impact_speed_ms) bits.push(`${fmt(s.impact_speed_ms,2)} m/s (${fmt(s.impact_speed_kmh,1)} km/h)`);
  if (s.equivalent_drop_height_mm) bits.push(`as if dropped from ${fmt(s.equivalent_drop_height_mm/1000,2)} m`);
  const what = w.type === 'CYL' ? `a rigid pole ${fmt(w.diameter)} mm across`
             : w.type === 'PLANE' ? 'a rigid floor' : 'a rigid wall';
  return `<b>In one sentence:</b> ${massLabel(a)} of structure hits ${what} at ${bits.join(', ')}, `
       + `and the solver follows it for ${dur(s.termination, s.termination_unit)}.`;
}

/* --------------------------------------------------------------- step 1 */
const COLOR_MODES = [
  ['part', 'part (one colour each)', ''],
  ['material', 'material', ''],
  ['thickness_mm', 'wall / sheet thickness', 'mm'],
  ['element_size_mean_mm', 'mean element size', 'mm'],
  ['mass_computed', 'mass', '@mass'],
  ['through_thickness', 'elements across the thickness', 'count'],
  ['n_elements', 'number of elements', 'count'],
  ['volume_mm3', 'volume', 'mm^3'],
  ['area_mm2', 'surface area', 'mm^2'],
  ['peak_von_mises', 'peak stress during the run (von Mises)', '@stress'],
  ['peak_plastic_strain', 'peak permanent stretch (plastic strain)', 'strain'],
  ['peak_displacement', 'largest movement (includes the fall itself)', 'mm'],
];
const COLOR_UNIT = (key) => {
  const row = COLOR_MODES.find(m => m[0] === key);
  const u = row ? row[2] : '';
  if (u === '@mass') return A().units.work[0];
  if (u === '@stress') return A().units.derived.stress;
  return u;
};
const RESULT_MODES = ['peak_von_mises', 'peak_plastic_strain', 'peak_displacement'];

function renderGeometry() {
  const a = A(), g = data().geometry;
  if (!Object.keys(state.visible).length) {
    a.assembly.forEach(p => { state.visible[p.id] = true; });
    state.visible.__wall = true;
  }
  const toggles = a.assembly.map((p, i) => `
    <label class="toggle">
      <input type="checkbox" data-part="${p.id}" ${state.visible[p.id] !== false ? 'checked' : ''}>
      <span class="sw" style="background:${PALETTE[i % PALETTE.length]}"></span>
      <span class="t" title="${esc(p.title)}">${esc(p.title)}</span>
    </label>`).join('');

  /* Result-based colourings exist only when this version's run saved frames. */
  const available = COLOR_MODES.filter(([k]) =>
    !RESULT_MODES.includes(k) || a.assembly.some(p => typeof p[k] === 'number'));
  if (!available.some(m => m[0] === state.colorBy)) state.colorBy = 'part';
  const missingResults = RESULT_MODES.filter(k => !available.some(m => m[0] === k));

  const wallName = (a.rigid_wall || {}).type === 'CYL' ? 'the pole' : 'the floor';
  $('step-geometry').innerHTML = `
    ${versionBanner()}
    <h2>Geometry and parts</h2>
    <p class="sub"><b>In short:</b> every part, drawn from its own mesh. Untick parts to look inside. "Colour by"
    paints each part with one value &mdash; its thickness, its mass, or (once the simulation has run) the highest
    stress it reached &mdash; with the scale on the right.</p>
    <div class="viewer">
      <div class="controls">
        <h4>Colour by</h4>
        <select id="colorBy">${available.map(([k, l]) =>
          `<option value="${k}" ${state.colorBy === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
        ${missingResults.length ? `<div class="note" style="margin-top:6px">Stress colours need the saved 3D
          results of a run${!a.engine.census.ANIM && a.engine.census.H3D
            ? `; this run saved them only in Altair's format${mark('engine.ANIM')}` : ''}.</div>` : ''}
        <div class="row"><button class="mini" id="showAll">show all</button>
          <button class="mini" id="hideAll">hide all</button></div>
        <hr>
        <h4>Rigid ${(a.rigid_wall || {}).type === 'CYL' ? 'pole' : 'wall'}</h4>
        <label class="toggle"><input type="checkbox" data-part="__wall" ${state.visible.__wall !== false ? 'checked' : ''}>
          <span class="sw" style="background:#8892a0"></span><span class="t">${esc(wallName)}</span></label>
        <hr>
        <h4>Parts (${a.assembly.length})</h4>
        ${toggles}
      </div>
      <div class="plot" id="plot3d"></div>
    </div>

    <h3>The mesh, part by part</h3>
    <p class="note">"Elements across" counts how many elements sit across the thinnest dimension of a solid part.
    Below one, the part cannot bend properly (marked ${SEV_GLYPH.error}). For sheet-metal (shell) parts the
    thickness is a number on the card rather than a mesh dimension, so this does not apply.</p>
    ${table(['#','Part','Material','Elements','Type','Thickness mm','Element size mm','Elements across','Mass','Squashed'],
      a.assembly.map(p => [
        fmt(p.id), esc(p.title),
        p.material_id ? `<span class="jump" data-jump="materials:${p.material_id}"
            title="see this material">${esc(p.material_title || '–')}</span>` : '–',
        fmt(p.n_elements), Object.keys(p.element_types || {}).map(elementWord).join(', '),
        fmt(p.thickness_mm, 2), fmt(p.element_size_mean_mm, 2),
        (p.through_thickness === null || p.is_shell ? '–' :
          `<span style="color:${p.through_thickness < 1 ? 'var(--error)' : 'inherit'}">${fmt(p.through_thickness, 2)}</span>`)
          + mark('assembly.through_thickness', p.id),
        fmt(p.mass_computed, 4),
        (p.collapsed_elements ? `<span style="color:var(--warning)">${fmt(p.collapsed_elements)}</span>` : '0')
          + mark('assembly.collapsed', p.id),
      ]), { num: [0, 3, 5, 6, 7, 8, 9], rowKey: a.assembly.map(p => 'geometry:' + p.id),
            tips: { 8: 'in ' + a.units.work[0] + ', computed from the mesh and the material density',
                    9: 'elements with two corners on the same point (wedges)' } })}
  `;
  $('colorBy').onchange = (e) => { state.colorBy = e.target.value; draw3d(); };
  $('showAll').onclick = () => { a.assembly.forEach(p => state.visible[p.id] = true); state.visible.__wall = true; renderGeometry(); };
  $('hideAll').onclick = () => { a.assembly.forEach(p => state.visible[p.id] = false); renderGeometry(); };
  $('step-geometry').querySelectorAll('input[data-part]').forEach(cb => {
    cb.onchange = () => { state.visible[cb.dataset.part === '__wall' ? '__wall' : +cb.dataset.part] = cb.checked; draw3d(); };
  });
  draw3d();
}

function draw3d() {
  const a = A(), g = data().geometry;
  const byId = {}; a.assembly.forEach(p => byId[p.id] = p);
  const mode = state.colorBy;
  const unit = COLOR_UNIT(mode);

  let scale = null;
  if (mode !== 'part' && mode !== 'material') {
    const vals = a.assembly.map(p => p[mode]).filter(v => typeof v === 'number');
    if (vals.length) scale = { lo: Math.min(...vals), hi: Math.max(...vals) };
  }
  const materials = [...new Set(a.assembly.map(p => p.material_title))];
  const shown = g.parts.filter(p => state.visible[p.id] !== false);
  let scaleShown = false;

  const traces = shown.map((p) => {
    const meta = byId[p.id] || {};
    const base = {
      type: 'mesh3d', name: meta.title || ('part ' + p.id),
      x: p.x, y: p.y, z: p.z, i: p.i, j: p.j, k: p.k,
      flatshading: true, opacity: 1, showlegend: false, hoverinfo: 'name+text',
    };
    if (mode === 'part') {
      base.color = PALETTE[g.parts.indexOf(p) % PALETTE.length];
      base.text = `${esc(meta.title)}<br>${fmt(meta.n_elements)} elements<br>${esc(meta.material_title || '')}`;
      return base;
    }
    if (mode === 'material') {
      base.color = PALETTE[materials.indexOf(meta.material_title) % PALETTE.length];
      base.text = `${esc(meta.title)}<br>${esc(meta.material_title || 'no material')}`;
      return base;
    }
    const v = meta[mode];
    if (typeof v !== 'number' || !scale) {
      base.color = '#4a5260';
      base.text = `${esc(meta.title)}<br>${esc(modeLabel(mode))}: not applicable`;
      return base;
    }
    /* A real colour bar, not a legend of swatches: every vertex of a part
       carries that part's value, the scale is shared across parts, and plotly
       draws the bar with its unit. One trace owns the bar so it is drawn once. */
    base.intensity = new Array(p.x.length).fill(v);
    base.colorscale = COLORSCALE;
    base.cmin = scale.lo; base.cmax = scale.hi === scale.lo ? scale.lo + 1 : scale.hi;
    base.showscale = !scaleShown;
    if (!scaleShown) {
      base.colorbar = {
        title: { text: unit ? `${modeLabel(mode)}<br>[${unit}]` : modeLabel(mode), side: 'right',
                 font: { size: 11, color: '#9aa4b2' } },
        thickness: 13, len: 0.62, x: 1.0, outlinewidth: 0,
        tickfont: { size: 10, color: '#9aa4b2' },
      };
      scaleShown = true;
    }
    base.text = `${esc(meta.title)}<br>${esc(modeLabel(mode))}: ${fmt(v, 3)} ${esc(unit)}`;
    return base;
  });

  if (g.rigid_wall && state.visible.__wall !== false && g.rigid_wall.x) {
    traces.push({
      type: 'mesh3d', name: 'rigid wall',
      x: g.rigid_wall.x, y: g.rigid_wall.y, z: g.rigid_wall.z,
      i: g.rigid_wall.i, j: g.rigid_wall.j, k: g.rigid_wall.k,
      color: '#8892a0', opacity: 0.35, flatshading: true,
      hoverinfo: 'name', showlegend: false, showscale: false,
    });
  }

  Plotly.react('plot3d', traces, {
    paper_bgcolor: '#171b21', plot_bgcolor: '#171b21',
    margin: { l: 0, r: 0, t: 0, b: 0 },
    uirevision: state.model,          // keep the user's camera across redraws
    scene: {
      aspectmode: 'data',
      xaxis: axis('X mm'), yaxis: axis('Y mm'), zaxis: axis('Z mm'),
      camera: cameraFor(a),
    },
  }, { displaylogo: false, responsive: true }).then(attachCameraMemory);
}

const modeLabel = (key) => (COLOR_MODES.find(m => m[0] === key) || [, key])[1];
const COLORSCALE = [[0, '#4c9aff'], [0.5, '#5bc8af'], [0.75, '#ffb454'], [1, '#ff6b6b']];

/* The camera must survive a redraw. Changing "colour by" re-sends the traces,
   and plotly resets the view to the layout's camera unless it is told
   otherwise - so the current camera is captured on every user interaction and
   handed straight back. */
function cameraFor(a) {
  const key = state.model;
  if (state.camera[key]) return state.camera[key];
  state.camera[key] = defaultCamera(a);
  return state.camera[key];
}

/* The default view is not arbitrary: gravity points down the screen (the
   direction of travel stands in when the deck has no gravity), and the viewer
   stands behind the moving object, a little to one side and above. A dropped
   phone then falls downward; a car's beam hits the pole with the road flat. */
function defaultCamera(a) {
  const norm = (v) => { const n = Math.hypot(...v); return n ? v.map(c => c / n) : v; };
  const cross = (u, v) => [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
  const dot = (u, v) => u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
  const g = (a.gravity || {}).direction, v = (a.velocity || {}).direction;
  const down = (g && g.length === 3) ? g : ((v && v.length === 3) ? v : null);
  if (!down) return { eye: { x: 1.5, y: 1.5, z: 1.0 } };
  const up = norm(down.map(c => -c));
  let back = v ? v.map(c => -c) : [1, 0, 0];
  const along = dot(back, up);
  back = back.map((c, i) => c - along * up[i]);         // the part of "behind" across the screen
  let eye;
  if (Math.hypot(...back) < 0.2) {                       // moving along gravity: a drop
    const helper = Math.abs(up[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1 = norm(cross(up, helper)), e2 = norm(cross(up, e1));
    eye = [0, 1, 2].map(i => 1.55 * e1[i] + 0.95 * e2[i] + 0.55 * up[i]);
  } else {
    back = norm(back);
    const side = norm(cross(up, back));
    eye = [0, 1, 2].map(i => 1.35 * back[i] + 0.75 * side[i] + 1.0 * up[i]);
  }
  return { up: { x: up[0], y: up[1], z: up[2] },
           eye: { x: eye[0], y: eye[1], z: eye[2] },
           center: { x: 0, y: 0, z: 0 } };
}

let cameraBound = false;
function attachCameraMemory() {
  const gd = document.getElementById('plot3d');
  if (!gd || cameraBound) return;
  cameraBound = true;
  gd.on('plotly_relayout', (ev) => {
    const cam = ev['scene.camera'];
    if (cam) state.camera[state.model] = cam;
  });
}

const axis = (t) => ({ title: t, color: '#9aa4b2', gridcolor: '#2b323c',
  zerolinecolor: '#3a424e', backgroundcolor: '#171b21', showbackground: true });

/* --------------------------------------------------------------- step 2 */
function renderMaterials() {
  const a = A();
  const used = {};
  a.assembly.forEach(p => { (used[p.material_id] = used[p.material_id] || []).push(p); });
  const rows = a.materials.map(m => [
    fmt(m.id), esc(m.title || ''), esc(m.law),
    fmt(m.density), fmt(m.youngs_modulus), fmt(m.poisson),
    (m.rate_dependent === null ? '–' :
      (m.rate_dependent ? 'yes' : '<span style="color:var(--warning)">no</span>'))
      + mark('materials.rate', m.id),
    (used[m.id] && used[m.id].length
      ? [...new Map(used[m.id].map(p => [p.id, p])).values()].map(p =>
          `<span class="jump" data-jump="geometry:${p.id}">${esc(p.title)}</span>`).join(', ')
      : '<span style="color:var(--warning)">no part uses it</span>' + mark('orphans')),
  ]);
  const fails = a.failures.map(f => [
    fmt(f.id), esc(f.model),
    f.material_id ? `<span class="jump" data-jump="materials:${f.material_id}">${esc(f.material_title || '–')}</span>` : '–',
    fmt(f.M_Flag), esc(f.preset_name || '–') + mark('materials.failure_preset', f.id),
    `line ${fmt(f.line)}`,
  ]);
  const u = a.units.derived;
  $('step-materials').innerHTML = `
    ${versionBanner()}
    <h2>Materials</h2>
    <p class="sub"><b>In short:</b> what each part is made of. <b>Stiffness</b> (Young's modulus E) says how
    hard the material is to stretch; <b>faster = stronger</b> says whether it resists more when hit fast, as
    real metals do in a crash. Density is in ${esc(u.density)}, stiffness and stresses in ${esc(u.stress)} &mdash;
    the units declared at the top of the model file.</p>
    ${table(['#','Name','Behaviour','Density','Stiffness E','Poisson','Faster = stronger','Used by'], rows,
      { num: [0,3,4,5], rowKey: a.materials.map(m => 'materials:' + m.id),
        tips: { 5: 'how much it narrows when stretched; about 0.3 for metals' } })}
    <h3>How each material behaves</h3>
    ${a.materials.map(m => `<div class="panel"><b>${esc(m.title)}</b> &mdash; ${esc(m.law)}
      <div class="note" style="margin-top:6px">${esc(m.formula)}</div>
      ${m.law_key === 'PLAS_JOHNS' ? `<div class="note" style="margin-top:6px">Johnson-Cook constants:
        yield a = ${fmt(m.yield_a)}, hardening b = ${fmt(m.hardening_b)}, exponent n = ${fmt(m.hardening_n)},
        speed factor c = ${fmt(m.rate_coefficient_c)}${mark('materials.rate', m.id)}</div>` : ''}
      </div>`).join('')}
    <h3>Failure rules &mdash; when a material breaks</h3>
    ${fails.length ? table(['#','Rule','Attached to','Setting (M_Flag)','Calibrated for','Where'], fails, { num: [0,3] })
      : `<div class="pending">No failure rule anywhere in this model: no part can crack, tear or be removed,
           however hard it is hit.${mark('materials.failure')}</div>`}
  `;
}

/* --------------------------------------------------------------- step 3 */
function renderContacts() {
  const a = A();
  const byId = {}; a.assembly.forEach(p => byId[p.id] = p.title);
  const ifp = {}; (a.starter.interface_parts || []).forEach(i => ifp[i.id] = i);
  const rows = a.starter.interfaces.map(i => {
    const parts = (ifp[i.id] || {}).parts || [];
    return [
      fmt(i.id), esc(i.type), esc(i.title || ''),
      (i.tied ? '<span class="pill">glue (tie)</span>' : '<span class="pill">contact</span>')
        + (i.id === (a.starter.interfaces[0] || {}).id ? mark('contacts.kinds') : ''),
      fmt(i.friction), fmt(i.gapmin) + mark('contacts.penetrations', i.id),
      parts.length
        ? parts.map(p => `<span class="jump" data-jump="geometry:${p}">${esc(byId[p] || p)}</span>`).join(', ')
        : '–',
      Object.entries(i.decoded || {}).map(([k, v]) => `<b>${esc(k)}</b>: ${esc(v)}`).join('<br>') || '–',
    ];
  });
  const un = a.starter.unattached_parts || [];
  const kinds = new Set(a.starter.interfaces.map(i => i.tied));
  $('step-contacts').innerHTML = `
    ${versionBanner()}
    <h2>Connections, supports and loading</h2>
    <p class="sub"><b>In short:</b> how the parts are held together and what can touch what. A <b>tie</b> glues
    two surfaces that touch at the start; a <b>contact</b> lets parts push on each other without passing through.
    ${kinds.has(true) && !kinds.has(false) ? 'This model has <b>only ties</b>.' + mark('contacts.kinds') : ''}
    The "Joins" column is worked out from the mesh itself (which parts own the points each interface uses), not
    copied from the interface's name.</p>
    ${table(['#','Type','Name','Kind','Friction','Min. gap','Joins','Settings, in words'], rows,
      { num: [0,4,5], rowKey: a.starter.interfaces.map(i => 'contacts:' + i.id) })}
    ${un.length ? `<div class="panel" style="border-color:var(--error)">
      <b style="color:var(--error)">${un.length} part(s) are not connected to anything.</b>${mark('contacts.unattached')}
      <div class="note" style="margin-top:6px">${un.map(u =>
        `<span class="jump" data-jump="geometry:${u.id}">${esc(u.title)}</span> (${(u.mass_fraction*100).toFixed(1)}% of the mass)`).join(', ')}
        &mdash; nothing glues them to the rest and no contact stops them, so they keep their starting speed and
        pass through whatever is in their way.</div></div>` : ''}
    <div class="two">
      <div><h3>What it hits, and what holds it</h3>${constraintPanel(a)}</div>
      <div><h3>What starts the motion</h3>${loadPanel(a)}</div>
    </div>
  `;
}
function constraintPanel(a) {
  const out = [];
  const w = a.rigid_wall || {};
  ((a.setup || {}).constraints || []).forEach(c => out.push(`<div class="panel"><b>${
    c.kind === 'rigid body' ? 'Rigid block' : 'Fixed directions'}</b> (${esc(c.keyword)}, "${esc(c.title)}", line ${fmt(c.line)})
    <div class="note">${esc(c.plain)}</div></div>`));
  if (w.type) out.push(`<div class="panel"><b>Rigid ${w.type === 'CYL' ? 'pole' : 'wall'}</b> (/RWALL/${esc(w.type)})
    <div class="note">An ideal surface that never deforms. ${esc(w.slide_meaning || '')}${w.friction ? `, friction ${fmt(w.friction)}` : ''}.
    It watches every mesh point that starts within ${fmt(w.d_search)} mm of it${mark('contacts.wall_dsearch')}${w.required_reach ?
    `; the model extends ${fmt(w.required_reach,1)} mm from it` : ''}.
    ${w.nodes_inside_search !== undefined ? `${fmt(w.nodes_inside_search)} points are watched.` : ''}</div></div>`);
  if (!out.length) out.push('<div class="pending">No rigid wall, rigid block or fixed support in this model.</div>');
  return out.join('');
}
/* "-Z" for an axis-aligned direction, "(-0.59, -0.65, -0.48)" otherwise. */
function directionWord(d) {
  if (!d) return '';
  const i = d.findIndex(c => Math.abs(c) > 0.99);
  return i >= 0 ? (d[i] < 0 ? '−' : '+') + 'XYZ'[i] : '(' + d.map(c => fmt(c, 2)).join(', ') + ')';
}
function loadPanel(a) {
  const out = [];
  const drop = !!a.scenario.equivalent_drop_height_mm;
  if (a.velocity && a.velocity.speed_ms) out.push(`<div class="panel"><b>Starting speed</b> (/INIVEL, line ${fmt(a.velocity.line)})
    <div class="note">Every point starts moving at ${fmt(a.velocity.speed_ms, 3)} m/s (${fmt(a.velocity.speed_kmh, 1)} km/h)
    along ${directionWord(a.velocity.direction)} &mdash; in the file, (${a.velocity.vector.map(v => fmt(v, 2)).join(', ')})
    ${esc(a.velocity.unit)}. The simulation starts at the moment of impact${drop ? ', not at the top of the fall' : ''}.</div></div>`);
  if (a.gravity && a.gravity.n_cards) {
    const L = { mm: 1e-3, cm: 1e-2, m: 1 }[a.units.work[1]] || 1e-3;
    const T = { s: 1, ms: 1e-3, us: 1e-6 }[a.units.work[2]] || 1;
    const g = (a.gravity.magnitude_deck || 0) * L / (T * T);
    out.push(`<div class="panel"><b>Gravity</b> (/GRAV &times; ${fmt(a.gravity.n_cards)})
    <div class="note">${fmt(g, 3)} m/s&sup2; towards ${directionWord(a.gravity.direction)}${a.gravity.matches_standard_g
      ? ' &mdash; normal Earth gravity' + (drop ? ', pointing the way the object falls' : '') : ''}.</div></div>`);
  }
  if (!out.length) out.push('<div class="pending">No load or starting speed in this model.</div>');
  return out.join('');
}

/* --------------------------------------------------------------- step 4 */
function renderRun() {
  const a = A(), e = a.engine, tu = a.units.work[2];
  const c = e.cards || {};
  const rows = (e.card_list || []).map(card => [
    `<code>${esc(card.keyword)}</code>`, `<span class="pill">${esc(card.category)}</span>`,
    esc(card.role), Object.entries(card.fields || {}).map(([k, v]) =>
      `${esc(k)} = <b>${fmt(v)}</b>`).join(', ') || '–', fmt(card.line),
  ]);
  const animEvery = e.census.ANIM ? (c.ANIM || {}).TFREQ : (e.census.H3D ? (c.H3D || {}).TFREQ : null);
  $('step-run').innerHTML = `
    ${versionBanner()}
    <h2>Run settings &mdash; the run file</h2>
    <p class="sub"><b>In short:</b> <code>${esc(e.file || '')}</code> (${fmt(e.lines)} lines) tells the solver how
    long to simulate, what to save and when to give up. These few lines decide whether the results can answer
    the question at all.</p>
    <div class="grid">
      ${kpi(dur((e.run||{}).Tstop, tu), 'simulated time', '/RUN', 'scenario.termination')}
      ${kpi(fmt((c.DT||{}).Tsca), 'time-step safety factor', 'the solver uses this fraction of the largest stable step (/DT)')}
      ${kpi(dur((c.DT||{}).Tmin, tu), 'smallest allowed time step',
        'below this, the solver adds mass instead of shrinking the step; 0 means never')}
      ${kpi(dur((c.TFILE||{}).dT_HIS, tu), 'curves recorded every', '/TFILE: one row of the time-history file', 'engine.TFILE')}
      ${kpi(animEvery ? dur(animEvery, tu) : '–', '3D snapshot every',
        e.census.ANIM ? '/ANIM &mdash; open format, readable by free tools' : (e.census.H3D ? '/H3D &mdash; Altair format only' : 'none saved'),
        'engine.ANIM')}
      ${kpi(e.census.STOP ? 'yes' : '<span style="color:var(--warning)">none</span>', 'safety stop',
        e.census.STOP ? `stops if the energy error passes ${fmt((c.STOP||{}).Emax * 100)} % or the added mass ${fmt((c.STOP||{}).Mmax * 100)} %`
                      : 'no limit: a run that goes wrong still finishes "normally"', 'engine.STOP')}
      ${kpi(e.census.PARITH ? esc(c.PARITH_mode || '') : 'default', 'same answer on any machine?',
        '/PARITH: ON makes the result independent of the number of CPU cores', 'engine.PARITH')}
      ${kpi(fmt(a.starter.census.TH || 0), 'measurement requests',
        '/TH cards: forces and energies recorded over time', 'engine.TH')}
    </div>
    <h3>What is measured over time${mark('outputs.th')}</h3>
    ${((a.setup || {}).time_history || []).length
      ? table(['Card', 'Records', 'Line'], a.setup.time_history.map(t =>
          [`<code>${esc(t.keyword)}</code>`, esc(t.plain), fmt(t.line)]), { num: [2] })
        + `<p class="note">These are the model file's /TH cards: the sensors of the simulation. Everything they
          record lands in the T01 file every ${dur((c.TFILE || {}).dT_HIS, tu)}.</p>`
      : '<div class="pending">Nothing: the model file has no /TH card, so no force, acceleration or energy per part is recorded over time.</div>'}
    <h3>Every card in the run file</h3>
    ${table(['Card','Kind','What it does','Values','Line'], rows, { num: [4] })}
  `;
}

/* --------------------------------------------------------------- step 5 */
function renderResults() {
  const a = A(), r = a.run || {}, tu = a.units.work[2];
  if (!r.history) {
    $('step-results').innerHTML = `${versionBanner()}<h2>Results</h2>
      <div class="pending">${state.version === 'v0' ? `No solver output found for this model.
      Run <code>python src/main.py --run</code> and open this page again.`
      : `The ${esc(state.version)} simulation has not finished yet. Its results appear here when the report is
         rebuilt (<code>python src/main.py</code>).`}</div>`;
    return;
  }
  const h = r.history, u = a.units.derived.energy;
  const removed = r.ke_removed_fraction || 0;
  const split = r.energy_split_end || {};
  const over = !!r.impact_over;
  $('step-results').innerHTML = `
    ${versionBanner()}
    <h2>What the solver produced</h2>
    <p class="sub"><b>In short:</b> did the impact happen, and can the numbers be trusted? "Finished normally"
    only means the solver did not crash; the five numbers below are the real check. Read from
    <code>${esc(r.engine_out_file || '')}</code>.</p>
    <div class="grid">
      ${kpi(r.normal_termination ? 'normally' : '<span style="color:var(--error)">stopped early</span>', 'the run finished',
        fmt(r.n_cycles) + ' time steps in ' + fmt(r.elapsed_s, 0) + ' s of computer time')}
      ${kpi(fmt(removed * 100, 0) + '%', 'motion energy taken out by the impact',
        `at the slowest moment (${dur(r.t_ke_min, tu)}). At the end: ${fmt(split.deformation * 100, 0)} % in
        deformation, ${fmt(split.walls_and_contact * 100, 0)} % taken by the ${wallWord(a)} and contacts,
        ${fmt(split.motion * 100, 0)} % still motion.` +
        (over ? `<br><b style="color:var(--ok)">${r.rebound ? 'it has bounced back: the impact is over'
                                                              : 'it has stopped: the impact is over'}</b>`
              : `<br><b style="color:var(--error)">${betweenHits(r)
                  ? 'first hit over, but still moving towards the next one'
                  : 'still slowing down: the impact is not over'}</b>`),
        'results.converted')}
      ${kpi(fmt(r.energy_error_max_pct, 2) + '%', 'largest energy error', 'a few percent is normal', 'results.energy_error')}
      ${kpi(fmt(r.mass_error_final * 100, 3) + '%', 'mass added by the solver', 'below about 2 % is harmless')}
      ${kpi(fmt(r.animation_files), '3D snapshots saved', r.animation_files ? 'readable with free tools' : 'none in an open format', r.animation_files ? null : 'engine.ANIM')}
    </div>
    <div class="two">
      <div class="panel"><div id="plotEnergy" style="height:340px"></div>
        <div class="note">Blue: the motion energy. Orange: the energy the structure absorbs by deforming. Green:
        the energy the ${wallWord(a)} and the contacts take out (a rigid wall stops the points that hit it
        outright). The impact is over when the blue curve reaches its lowest point.</div></div>
      <div class="panel"><div id="plotQuality" style="height:340px"></div>
        <div class="note">How trustworthy the run is: both lines should stay close to zero.</div></div>
    </div>
    ${energyPanel(a)}
    ${videoPanel(a)}`;
  const t = h.time;
  Plotly.react('plotEnergy', [
    { x: t, y: h.kinetic_energy, name: 'motion (kinetic)', mode: 'lines', line: { color: '#4c9aff', width: 2 } },
    { x: t, y: h.internal_energy, name: 'absorbed (internal)', mode: 'lines', line: { color: '#ffb454', width: 2 } },
    { x: t, y: h.external_work.map(v => -v), name: `taken by the ${wallWord(a)} and contacts`, mode: 'lines',
      line: { color: '#5bc8af', width: 1.5, dash: 'dot' } },
  ], chartLayout('Where the energy goes', 'time [' + tu + ']', 'energy [' + u + ']'),
     { displaylogo: false, responsive: true });
  Plotly.react('plotQuality', [
    { x: t, y: h.error_pct, name: 'energy error %', mode: 'lines', line: { color: '#ff6b6b', width: 2 } },
    { x: t, y: h.mass_error.map(v => v * 100), name: 'added mass %', mode: 'lines',
      yaxis: 'y2', line: { color: '#b18aff', width: 2 } },
  ], Object.assign(chartLayout('Run quality', 'time [' + tu + ']', 'energy error [%]'),
     { yaxis2: { title: 'added mass [%]', overlaying: 'y', side: 'right', color: '#9aa4b2', gridcolor: '#2b323c' } }),
     { displaylogo: false, responsive: true });
}
/* Where the energy went, from the curves file (T01): the channels the
   listing's error column does not count, and - when the deck records energy
   per part - which component absorbs the blow. */
function energyPanel(a) {
  const r = a.run || {}, es = r.energy_sources;
  if (!es) return '';
  const f = es.fractions_end || {}, split = r.energy_split_end || {};
  const pct = (v) => v === undefined || v === null ? '–' : fmt(v * 100, 1) + ' %';
  const rows = [
    ['absorbed by deformation', pct(split.deformation), 'energy stored or spent in bending, crushing, stretching'],
    ['&nbsp;&nbsp;of which permanent (plastic work)', pct(f.plastic_work), 'will not come back: the part stays bent'],
    [`taken by the ${wallWord(a)}`, pct(split.walls_and_contact), 'a rigid wall stops the points that hit it'],
    ['lost to friction between parts', pct(f.friction), 'real, but not in the solver\'s error sum'],
    ['held by the hourglass stabiliser' + mark('results.hourglass'), pct(f.hourglass),
     'numerical, not material: should stay below 10 % of the deformation energy'],
    ['still motion at the end', pct(split.motion), ''],
    ['not accounted for' + mark('results.energy_error'),
     fmt(es.balance_closed_pct, 2) + ' %', 'after counting friction and the stabiliser'],
  ];
  const parts = Object.entries(es.parts || {});
  const partTable = parts.length ? `
    <h3>Which part absorbs the blow</h3>
    <p class="note">Each part's highest deformation energy during the run, as a share of all of them together &mdash;
    recorded by the /TH/PART sensors. This is the question a drop test is run to answer.</p>
    ${table(['Part', 'share', ''], parts.map(([name, p]) => [
      `<span class="jump" data-jump="geometry:${(a.assembly.find(x => x.title === name) || {}).id || ''}">${esc(name)}</span>`,
      fmt(p.share_of_peaks * 100, 1) + ' %',
      `<div class="bar"><span style="width:${Math.max(1, p.share_of_peaks * 100).toFixed(1)}%"></span></div>`]),
      { num: [1] })}` : '';
  return `<h3>Where the energy went</h3>
    <p class="note">Shares of the impact energy at the end of the run, from the curves file
    (<code>${esc(es.file)}</code>). The solver's own "energy error" leaves out friction and the stabiliser; counting
    them tells whether the run's books really close.</p>
    ${table(['', 'share of the impact energy', 'what it means'], rows, { num: [1] })}
    ${partTable}`;
}

/* The deformed shape over time. A per-node animation in the browser would be
   tens of megabytes; the rendered video is a tenth of one and shows the same
   thing, so the report embeds it rather than replaying the mesh. */
function videoPanel(a) {
  const m = a.media || {}, fr = a.field_results;
  if (!m.video) {
    return `<h3>Deformation over time</h3>
      <div class="pending">No video for this run. Its run file saves the 3D results only in Altair's .h3d format,
      which free tools cannot open.${mark('engine.ANIM')}
      ${hasVersion(a.name, 'v0.1') && state.version === 'v0' ? '<br>Switch to <b>v0.1</b> at the top right: it saves them in the open format too.' : ''}</div>`;
  }
  const stills = (m.stills || []).map(s =>
    `<figure><img src="${esc(s.file)}" alt="${esc(s.label)}"><figcaption>${esc(s.label)}</figcaption></figure>`).join('');
  return `<h3>Deformation over time</h3>
    <div class="two">
      <div class="panel" style="padding:0;overflow:hidden">
        <video src="${esc(m.video)}" controls loop muted playsinline style="display:block;width:100%"></video>
      </div>
      <div>
        <div class="grid">
          ${fr ? kpi(fmt(fr.peak_von_mises, 1) + ' ' + esc(fr.unit), 'highest stress anywhere',
            'von Mises, on the surface, over every saved snapshot') : ''}
          ${fr && fr.peak_plastic_strain ? kpi(fmt(fr.peak_plastic_strain * 100, 1) + ' %', 'largest permanent stretch',
            'plastic strain; 0 would mean everything springs back') : ''}
          ${fr ? kpi(fmt(fr.n_frames), 'snapshots in the video',
            `from ${dur(fr.t_first, a.units.work[2])} to ${dur(fr.t_last, a.units.work[2])}`) : ''}
        </div>
        <div class="panel note" style="margin-top:12px">
          Colour = stress. ${fr ? esc(fr.stress_source || '') : ''}; converted snapshot by snapshot with
          the solver's own anim_to_vtk tool. On the Geometry page, colour the model by
          <b>peak stress</b> to see which part carries it.
        </div>
      </div>
    </div>
    ${stills ? `<h3>Key moments</h3><div class="stills">${stills}</div>` : ''}`;
}

const chartLayout = (title, xt, yt) => ({
  title: { text: title, font: { size: 13, color: '#e6e9ee' } },
  paper_bgcolor: '#171b21', plot_bgcolor: '#171b21',
  font: { color: '#9aa4b2', size: 11 },
  margin: { l: 58, r: 58, t: 34, b: 44 },
  xaxis: { title: xt, gridcolor: '#2b323c', zerolinecolor: '#3a424e' },
  yaxis: { title: yt, gridcolor: '#2b323c', zerolinecolor: '#3a424e' },
  legend: { orientation: 'h', y: -0.2 },
});

/* --------------------------------------------------------------- step 6 */
function renderEngineering() {
  const a = A(), r = a.engineering_review || {};
  $('step-engineering').innerHTML = `
    ${versionBanner()}
    <h2>Engineering review</h2>
    <p class="sub"><b>In short:</b> the questions a design engineer asks before trusting a model: which
    dimensions decide the answer, can the part actually be made, and what a single ideal geometry can and
    cannot tell you about real, varying parts.</p>
    <h3>Dimensions that decide the answer</h3>
    ${table(['Dimension','Where','Why it matters'],
      (r.critical_dimensions || []).map(d => [esc(d.dimension), esc(d.where), esc(d.why)]))}
    <h3>Can it be made?</h3>
    ${(r.manufacturability || []).map(m => `<div class="panel"><b>${esc(m.topic)}</b>
      <div class="mono" style="margin:4px 0">${esc(m.measured)}</div>
      <div class="note">${esc(m.comment)}</div></div>`).join('')}
    <h3>Tolerances and variation</h3>
    ${(r.tolerances || []).map(t => `<div class="panel"><b>${esc(t.topic)}</b>
      <div class="note" style="margin-top:4px">${esc(t.detail)}</div>
      <div class="note" style="margin-top:6px"><b>So:</b> ${esc(t.consequence)}</div></div>`).join('')}
    ${sweepPanels(a)}
  `;
  (a.sweeps || []).forEach((sw, i) => drawSweep(sw, i, a));
}

/* A design study: the same model run several times with one thing changed. */
function sweepPanels(a) {
  const sws = (a.sweeps || []).filter(sw => (sw.rows || []).length > 1);
  if (!sws.length) return '';
  return sws.map((sw, i) => `
    <h3>Design study: ${esc(sw.meaning)}</h3>
    <p class="note">The same model (starting from v0.1) run ${sw.rows.length} times with only this changed.
    It answers "how sensitive is the result to this dimension?" &mdash; the first question of a tolerance study,
    and one row per run of the table a surrogate model would learn from (<code>sweep/${esc(sw.variable)}.json</code>).</p>
    ${table(['value', 'mean sheet thickness mm', 'energy taken out', 'into deformation', 'highest stress MPa',
             'permanent stretch', 'largest movement mm', 'computer time s'],
      sw.rows.map(r => [fmt(r.value) + (r.value === 1 ? ' (as v0.1)' : ''), fmt(r.shell_thickness_mean_mm, 3),
        r.energy_taken_out_fraction == null ? '–' : fmt(r.energy_taken_out_fraction * 100, 0) + ' %',
        r.deformation_energy_fraction_end == null ? '–' : fmt(r.deformation_energy_fraction_end * 100, 0) + ' %',
        fmt(r.peak_von_mises_MPa, 0),
        r.peak_plastic_strain == null ? '–' : fmt(r.peak_plastic_strain * 100, 1) + ' %',
        fmt(r.peak_displacement_mm, 0), fmt(r.compute_s, 0)]), { num: [0, 1, 2, 3, 4, 5, 6, 7] })}
    <div class="panel"><div id="plotSweep${i}" style="height:300px"></div></div>`).join('');
}
function drawSweep(sw, i, a) {
  const node = $('plotSweep' + i);
  if (!node) return;
  /* Two panels, not two axes on one: stress and movement move almost in step,
     and on a shared plot one line hides the other. */
  const x = sw.rows.map(r => r.value);
  const name = sw.variable.replace(/_/g, ' ');
  const layout = Object.assign(chartLayout('What changes when ' + name + ' changes', '', ''), {
    xaxis: { domain: [0, 0.45], title: name, gridcolor: '#2b323c', zerolinecolor: '#3a424e' },
    yaxis: { title: 'highest stress [MPa]', gridcolor: '#2b323c', zerolinecolor: '#3a424e' },
    xaxis2: { domain: [0.55, 1], anchor: 'y2', title: name, gridcolor: '#2b323c', zerolinecolor: '#3a424e' },
    yaxis2: { anchor: 'x2', title: 'largest movement [mm]', gridcolor: '#2b323c', zerolinecolor: '#3a424e' },
    showlegend: false,
  });
  Plotly.react(node, [
    { x, y: sw.rows.map(r => r.peak_von_mises_MPa), mode: 'lines+markers', name: 'highest stress',
      line: { color: '#ff6b6b', width: 2 }, marker: { size: 8 } },
    { x, y: sw.rows.map(r => r.peak_displacement_mm), mode: 'lines+markers', name: 'largest movement',
      xaxis: 'x2', yaxis: 'y2', line: { color: '#4c9aff', width: 2 }, marker: { size: 8 } },
  ], layout, { displaylogo: false, responsive: true });
}

/* --------------------------------------------------------------- step 7 */
function renderFindings() {
  const a = A(), fs = a.findings || [];
  const counts = { error: 0, warning: 0, info: 0 };
  let done = 0;
  fs.forEach(f => {
    if (state.dismissed[answerKey(f.id, state.model, state.version)]) { done++; return; }
    counts[f.severity] = (counts[f.severity] || 0) + 1;
  });
  const nowRules = new Set(fs.map(f => f.rule));
  const fixed = state.version === 'v0' ? [] : (A0().findings || []).filter(f => !nowRules.has(f.rule));
  $('step-findings').innerHTML = `
    ${versionBanner()}
    <h2>Findings &mdash; what is wrong, and what to do</h2>
    <p class="sub"><b>In short:</b> each card says what we saw, why it happens and what it means for the results,
    then offers ways to fix it. Click the answer you want (or type your own), then <b>save interaction.txt</b>:
    that file is what the next version of the model is built from
    (<code>python src/main.py --v01</code>). The ${'✕'} button hides a card you have dealt with.</p>
    <div class="grid">
      ${kpi(`<span style="color:var(--error)">${counts.error||0}</span>`, 'errors', 'a result would be wrong or missing')}
      ${kpi(`<span style="color:var(--warning)">${counts.warning||0}</span>`, 'warnings', 'a result would mislead')}
      ${kpi(`<span style="color:var(--info)">${counts.info||0}</span>`, 'notes', 'worth knowing before editing the model')}
      ${kpi(fmt(done), 'dealt with', 'hidden; click ↺ on a card to bring it back')}
      ${fixed.length ? kpi(`<span style="color:var(--ok)">${fixed.length}</span>`, 'fixed in ' + esc(state.version), 'listed at the bottom') : ''}
    </div>
    ${fs.map(findingCard).join('')}
    ${fixed.length ? `<h3>Fixed in ${esc(state.version)}</h3>` + fixed.map(f => {
      const c = appliedFor(f.rule) || {};
      return `<div class="finding fixed"><div class="head"><span class="badge fixed">fixed</span>
        <span class="title">${esc(f.title)}</span><span class="spacer" style="flex:1"></span>
        <span class="jump" data-jump="compare:${esc(f.rule)}">what changed</span></div>
        <div class="note" style="margin-top:6px">Answer applied: <b>${esc(c.answer || '')}</b> &mdash;
        ${esc((c.edits || []).join('; '))}</div></div>`;
    }).join('') : ''}
    <div class="answerbar">
      <span id="answerCount" class="note"></span>
      <div class="spacer" style="flex:1"></div>
      <button class="ghost" id="clearAnswers">clear</button>
      <button id="saveAnswers">save interaction.txt</button>
    </div>`;
  $('step-findings').querySelectorAll('.choices button').forEach(b => {
    b.onclick = () => pickChoice(b.dataset.fid, b.dataset.label, b);
  });
  $('step-findings').querySelectorAll('[data-dismiss]').forEach(b => {
    b.onclick = () => {
      const key = answerKey(b.dataset.dismiss, state.model, state.version);
      if (state.dismissed[key]) delete state.dismissed[key]; else state.dismissed[key] = true;
      persist(); renderFindings();
    };
  });
  $('step-findings').querySelectorAll('.freeform input').forEach(inp => {
    inp.oninput = () => { state.answers[inp.dataset.key] = inp.value; persist(); updateAnswerCount(); };
  });
  $('saveAnswers').onclick = saveInteraction;
  $('clearAnswers').onclick = () => {
    state.answers = {}; state.dismissed = {}; persist(); renderFindings();
  };
  updateAnswerCount();
}

function findingCard(f) {
  const key = answerKey(f.id, state.model, state.version);
  const chosen = state.answers[key];
  const gone = !!state.dismissed[key];
  const custom = chosen && !(f.choices || []).some(c => c.label === chosen);
  return `<div class="finding ${esc(f.severity)} ${gone ? 'dismissed' : ''}" data-fid="${esc(f.id)}">
    <div class="head">
      <span class="badge ${esc(f.severity)}">${esc(SEV_WORD[f.severity])}</span>
      <span class="title">${esc(f.title)}</span>
      <span class="spacer" style="flex:1"></span>
      <span class="pill">${esc(f.id)}</span><span class="pill">${esc(f.category)}</span>
      <button class="dismiss" data-dismiss="${esc(f.id)}"
        title="${gone ? 'bring this finding back' : 'mark as dealt with and hide it'}">${gone ? '↺' : '✕'}</button>
    </div>
    <dl>
      <dt>Why it happens</dt><dd>${esc(f.mechanism)}</dd>
      <dt>What it means</dt><dd>${esc(f.consequence)}</dd>
      <dt>Where we saw it</dt><dd class="evidence">${esc(f.evidence)}</dd>
    </dl>
    <div class="choices"><span class="note" style="align-self:center">What to do:</span>${(f.choices || []).map(c => {
      const rec = c.label === f.recommended;
      const picked = chosen === c.label || (c.label.startsWith('other') && custom);
      return `<button data-fid="${esc(f.id)}" data-label="${esc(c.label)}"
        class="${rec ? 'rec' : ''} ${picked ? 'picked' : ''}"
        title="${esc(c.rationale || '')}${c.cost ? ' — cost: ' + esc(c.cost) : ''}">${esc(c.label)}</button>`;
    }).join('')}</div>
    <div class="freeform ${custom ? 'on' : ''}">
      <input data-key="${esc(key)}" placeholder="type your own answer" value="${custom ? esc(chosen) : ''}">
    </div>
  </div>`;
}

function pickChoice(fid, label, btn) {
  const key = answerKey(fid, state.model, state.version);
  const card = btn.closest('.finding');
  card.querySelectorAll('.choices button').forEach(b => b.classList.remove('picked'));
  btn.classList.add('picked');
  if (label.startsWith('other')) {
    card.querySelector('.freeform').classList.add('on');
    card.querySelector('.freeform input').focus();
    return;
  }
  card.querySelector('.freeform').classList.remove('on');
  state.answers[key] = label;
  persist(); updateAnswerCount();
}

function updateAnswerCount() {
  const n = Object.values(state.answers).filter(v => v && String(v).trim()).length;
  const node = $('answerCount');
  if (node) node.textContent = n ? `${n} answer(s) recorded` : 'no answers yet';
}

/* Answers and dismissals are a per-reader convenience, so they live in
   localStorage and the page must work without it: a private window, blocked
   site data or a thumbnail capture all make these throw. */
function persist() {
  try {
    localStorage.setItem('radioss.answers', JSON.stringify(state.answers));
    localStorage.setItem('radioss.dismissed', JSON.stringify(state.dismissed));
  } catch (e) { /* nothing to do: the session simply is not remembered */ }
}
function restore() {
  try { state.answers = JSON.parse(localStorage.getItem('radioss.answers') || '{}'); }
  catch (e) { state.answers = {}; }
  try { state.dismissed = JSON.parse(localStorage.getItem('radioss.dismissed') || '{}'); }
  catch (e) { state.dismissed = {}; }
}

function saveInteraction() {
  const lines = [];
  lines.push('# interaction.txt - answers given in the OpenRadioss model report');
  lines.push('# one blank-line-separated block per answered finding;');
  lines.push('# put this file next to src/ and run: python src/main.py --v01');
  lines.push('');
  window.MODEL_NAMES.forEach(name => {
    allVersions().forEach(version => {
      const an = versionData(name, version);
      if (!an) return;
      (an.findings || []).forEach(f => {
        const key = answerKey(f.id, name, version);
        const ans = state.answers[key];
        const head = ['model: ' + name].concat(version !== 'v0' ? ['version: ' + version] : [],
          ['finding: ' + f.id, 'rule: ' + (f.rule || ''), 'severity: ' + f.severity, 'warning: ' + f.title]);
        if (state.dismissed[key] && !ans) {
          lines.push(...head, 'answer: dismissed - reviewed, no change wanted', '');
          return;
        }
        if (!ans || !String(ans).trim()) return;
        const choice = (f.choices || []).find(c => c.label === ans);
        lines.push(...head, 'answer: ' + ans);
        if (choice && choice.deck_edit) {
          lines.push('deck_edit: |');
          String(choice.deck_edit).split('\n').forEach(l => lines.push('  ' + l));
        }
        lines.push('');
      });
    });
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'interaction.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* --------------------------------------------------------------- step 8 */
function renderCompare() {
  const name = state.model;
  const later = laterVersions(name);
  /* The version whose changes are listed: the one selected, or the first fixed one. */
  const focus = state.version !== 'v0' && hasVersion(name, state.version) ? state.version : later[0];
  const a0 = A0(), a1 = versionData(name, focus);
  if (!a1) {
    $('step-compare').innerHTML = `<h2>v0 against v0.1</h2>
      <div class="pending"><b>v0.1 has not been built for this model yet.</b><br><br>
      v0.1 is the same model with the fixes chosen on the Findings page, written by
      <code>python src/main.py --v01 --run</code> from the original files, which are never edited.</div>`;
    return;
  }
  const ch = a1.changes || {}, r1 = a1.run || {};
  const tu = a0.units.work[2], su = a0.units.derived.stress;
  const ran = !!r1.history;
  const versions = ['v0'].concat(later);
  const an = versions.map(v => versionData(name, v));
  const count = (fs, s) => (fs || []).filter(f => f.severity === s).length;
  /* One row per quantity, one column per version: each cell reads its own run. */
  const cell = (a, fn) => {
    const r = a.run || {};
    if (!r.history) return a.version === 'v0' ? '–' : 'running…';
    return fn(r, a.field_results || {}, a);
  };
  const ROWS = [
    ['simulated time', a => dur((a.engine.run || {}).Tstop, tu), ''],
    ['motion energy taken out by the impact', a => cell(a, r => fmt((r.ke_removed_fraction || 0) * 100, 0) + ' %'),
     'at the slowest moment; the rest is still motion'],
    ['impact over at the end?', a => cell(a, r => overWord(r)), 'over = stopped, or bounced back'],
    ['absorbed by deformation (end)', a => cell(a, r => fmt(((r.energy_split_end || {}).deformation || 0) * 100, 0) + ' %'), ''],
    ['highest stress', a => cell(a, (r, f) => f.peak_von_mises ? fmt(f.peak_von_mises, 1) + ' ' + su
                                           : (a.engine.census.ANIM ? 'not converted yet' : 'not readable')), ''],
    ['largest permanent stretch', a => cell(a, (r, f) => f.peak_plastic_strain ? fmt(f.peak_plastic_strain * 100, 1) + ' %' : '–'), ''],
    ['largest energy error', a => cell(a, r => fmt(r.energy_error_max_pct, 2) + ' %'), 'a few percent is normal'],
    ['mass added by the solver', a => cell(a, r => fmt((r.mass_error_final || 0) * 100, 3) + ' %'), ''],
    ['time steps', a => cell(a, r => fmt(r.n_cycles)), ''],
    ['computer time', a => cell(a, r => fmt(r.elapsed_s, 0) + ' s'), ''],
    ['3D snapshots', a => cell(a, r => fmt(r.animation_files)), ''],
    ['findings: errors / warnings', a => count(a.findings, 'error') + ' / ' + count(a.findings, 'warning'), ''],
  ];
  const rows = ROWS.map(([label, fn, note]) => [label, ...an.map(fn), note]);
  const parts = a0.assembly.map(p => [esc(p.title), ...an.map(a =>
    fmt(((a.assembly || []).find(x => x.id === p.id) || {}).peak_von_mises, 1))]);
  /* Titles come from the current v0 findings, not from edits.json, so a
     reworded finding reads the same on every page. */
  const titleOf = (c) => ((a0.findings || []).find(f => f.rule === c.rule) || c).title;
  const applied = (ch.applied || []).map(c => [
    `<span data-row="compare:${esc(c.rule)}">${esc(titleOf(c))}</span>`,
    `<b>${esc(c.answer)}</b><div class="note">${c.source === 'interaction.txt' ? 'your answer' : c.source === '--answer' ? 'set for this version' : 'recommended answer'}</div>`,
    (c.edits || []).map(esc).join('<br>')]);
  const kept = (ch.not_applied || []).map(c => [esc(titleOf(c)), esc(c.answer), esc(c.why)]);
  const diff = String(ch.diff || '').split('\n').map(l => {
    const cls = l.startsWith('+++') || l.startsWith('---') ? 'hd' : l.startsWith('+') ? 'add'
              : l.startsWith('-') ? 'del' : l.startsWith('@@') ? 'at' : '';
    return `<span class="${cls}">${esc(l)}</span>`;
  }).join('\n');

  $('step-compare').innerHTML = `
    <h2>v0 against v0.1 &mdash; what the fixes changed</h2>
    <p class="sub"><b>In short:</b> v0.1 is the original model with ${(ch.applied || []).length} fix(es)
    applied by a script to copies of the original files (the originals are never edited). Below: what was
    changed, what was deliberately left alone, and how the answer moved.
    ${ran ? '' : '<br><b>The v0.1 simulation is still running</b>: the "v0.1" column fills in when the report is rebuilt.'}</p>
    ${table(['', ...versions.map(v => versionLabel(name, v)), 'how to read it'], rows)}
    <div class="videos" style="margin-top:12px">${an.map((a, i) => {
      const m = a.media || {};
      return `<div class="panel"><b>${esc(versionLabel(name, versions[i]))}</b>${m.video
        ? `<video src="${esc(m.video)}" controls loop muted playsinline></video>`
        : `<div class="pending">${a.engine.census.ANIM ? ((a.run || {}).history ? 'video not rendered yet' : 'running…')
                                                    : 'no video: results saved in Altair format only'}</div>`}</div>`;
    }).join('')}</div>
    ${an.filter(a => (a.run || {}).history).length > 1 ? '<div class="panel"><div id="plotCompare" style="height:330px"></div></div>' : ''}
    <h3>What was changed in ${esc(focus)}</h3>
    ${table(['Finding', 'Answer applied', 'Exact edit'], applied, { rowKey: (ch.applied || []).map(c => 'compare:' + c.rule) })}
    ${kept.length ? `<h3>Left as it was</h3>${table(['Finding', 'Answer', 'Why not changed'], kept)}` : ''}
    ${parts.some(p => p.slice(1).some(c => c !== '–')) ? `<h3>Highest stress per part [${esc(su)}]</h3>
      ${table(['Part', ...versions], parts, { num: versions.map((_, i) => i + 1) })}` : ''}
    <details class="panel"><summary><b>The exact text changes in the two files</b> (a "diff": red lines removed, green lines added)</summary>
      <pre class="diff">${diff}</pre></details>
  `;
  if ($('plotCompare')) {
    const dash = ['dot', 'dash', 'solid', 'longdash'];
    const traces = [];
    an.forEach((a, i) => {
      const h = (a.run || {}).history;
      if (!h) return;
      traces.push({ x: h.time, y: h.kinetic_energy, name: versions[i] + ' motion', mode: 'lines',
                    line: { color: '#4c9aff', width: 1.5 + i, dash: dash[i % 4] } });
      traces.push({ x: h.time, y: h.internal_energy, name: versions[i] + ' absorbed', mode: 'lines',
                    line: { color: '#ffb454', width: 1.5 + i, dash: dash[i % 4] } });
    });
    Plotly.react('plotCompare', traces, chartLayout('Where the energy goes, version by version',
      'time [' + tu + ']', 'energy [' + a0.units.derived.energy + ']'), { displaylogo: false, responsive: true });
  }
}

/* Slowest moment well before the end, and no bounce: the first hit is over
   and the object moves on (a phone pivoting on its corner towards the next). */
const betweenHits = (r) => !r.impact_over && r.t_ke_min < 0.9 * r.t_end;
function overWord(r) {
  if (!r || r.ke_removed_fraction === undefined) return '–';
  if (r.rebound) return 'yes, bounced back';
  if (r.stopped) return 'yes, stopped';
  return betweenHits(r) ? 'no: first hit over, still moving' : 'no, still slowing down';
}

/* ------------------------------------------------------------------ shell */
const RENDERERS = [renderModel, renderGeometry, renderMaterials, renderContacts,
                   renderRun, renderResults, renderEngineering, renderFindings, renderCompare];

function show(step) {
  state.step = step;
  document.querySelectorAll('.step').forEach(s => s.classList.toggle('on', +s.dataset.step === step));
  document.querySelectorAll('nav.steps button').forEach(b => b.classList.toggle('on', +b.dataset.step === step));
  RENDERERS[step]();
  window.scrollTo(0, 0);
  document.querySelector('main').scrollTop = 0;
}

function refreshVersionSwitch() {
  document.querySelectorAll('#versionSwitch button').forEach(b => {
    const ok = hasVersion(state.model, b.dataset.v);
    b.disabled = !ok;
    b.title = ok ? '' : 'not built for this model yet';
    b.innerHTML = esc(versionLabel(state.model, b.dataset.v));
    b.classList.toggle('on', b.dataset.v === state.version);
  });
}

function selectModel(name) {
  state.model = name;
  state.visible = {};
  cameraBound = false;
  if (!hasVersion(name, state.version)) state.version = 'v0';
  document.querySelectorAll('#modelSwitch button').forEach(b =>
    b.classList.toggle('on', b.dataset.m === name));
  $('subtitle').textContent = '— ' + A().title;
  refreshVersionSwitch();
  show(state.step);
}

function boot() {
  restore();
  const ms = $('modelSwitch');
  window.MODEL_NAMES.forEach(n => {
    const b = el('button', '', esc(n.replace(/_/g, ' ')));
    b.dataset.m = n; b.onclick = () => selectModel(n); ms.appendChild(b);
  });
  const nav = $('steps');
  let group = null;
  STEPS.forEach(([label, , hint, g], i) => {
    if (g !== group) { nav.appendChild(el('span', 'group', esc(g))); group = g; }
    const b = el('button', '', `<b>${i + 1}</b>${esc(label)}`);
    b.title = hint; b.dataset.step = i; b.onclick = () => show(i); nav.appendChild(b);
  });
  /* One button per version that exists, whatever the page template listed. */
  const vs = $('versionSwitch');
  vs.innerHTML = '';
  allVersions().forEach(v => {
    const b = el('button'); b.dataset.v = v; vs.appendChild(b);
  });
  document.querySelectorAll('#versionSwitch button').forEach(b => {
    b.onclick = () => {
      if (b.disabled) return;
      state.version = b.dataset.v;
      refreshVersionSwitch();
      show(state.step);
    };
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') show(Math.min(STEPS.length - 1, state.step + 1));
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') show(Math.max(0, state.step - 1));
  });
  selectModel(window.MODEL_NAMES[0]);
}
document.addEventListener('DOMContentLoaded', boot);
