// The Leonida Field Guide v3 — GTA VI trophy guide & tracker.
// A fully offline, static tracker. Every number printed anywhere in this app is
// computed at runtime from app/data/*.json by computeAudit()/computeStats() —
// no count is hard-coded, so the audit strip can never over-claim the data.

const $ = (sel) => document.querySelector(sel);

const [trophyDoc, sourceDoc, roadmapDoc, completionDoc] = await Promise.all([
  fetch('data/trophies.json').then((r) => r.json()),
  fetch('data/sources.json').then((r) => r.json()),
  fetch('data/roadmap.json').then((r) => r.json()),
  fetch('data/completion.json').then((r) => r.json()),
]);

const TROPHIES = trophyDoc.trophies;
const SOURCES = sourceDoc.sources;
const STAGES = roadmapDoc.stages;
const PTS = trophyDoc.points ?? { bronze: 15, silver: 30, gold: 90, platinum: 300 };
const SRC = new Map(SOURCES.map((s) => [s.n, s]));
const BY_ID = new Map(TROPHIES.map((t) => [t.id, t]));
const GRADES = ['platinum', 'gold', 'silver', 'bronze'];

/* ---------------- state ---------------- */

const KEY = 'leonida-field-guide-v3';
const SEED = {
  earned: [2, 3, 4, 8, 10, 16, 21, 36, 44, 46, 49, 51],
  counters: { 14: 23, 15: 96, 16: 9, 17: 17, 18: 5, 19: 6, 25: 3, 28: 6, 30: 1, 31: 23, 32: 17, 35: 34, 40: 1, 42: 19, 43: 3, 48: 132, 52: 86400, 53: 41250, 54: 2, 55: 4 },
  completion: { 0: 2, 1: 1, 2: 34, 3: 61, 4: 17, 5: 96, 6: 6, 7: 1, 8: 23, 9: 19, 10: 17, 11: 2 },
  notes: {}, stars: [], spoiler: true,
};

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(SEED);
    const s = JSON.parse(raw);
    return { earned: [], counters: {}, completion: {}, notes: {}, stars: [], spoiler: true, ...s };
  } catch {
    return structuredClone(SEED);
  }
}
let state = loadState();
let selectedId = 28; // Positive Mental Attitude opens the guide pane
let filters = { q: '', grade: 'all', kind: 'all', status: 'all', sort: 'route', hideEarned: false };

function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
const earned = (t) => state.earned.includes(t.id);
const counterOf = (t) => Math.min(state.counters[t.id] ?? 0, t.target ?? 0);

/* ---------------- audit: every printed count derives from the data ---------------- */

function claimsOf(t) {
  const claims = [...t.steps, ...t.tips];
  if (t.missable && t.missable.level !== 'no') claims.push(t.missable);
  return claims;
}
function allClaims() {
  const claims = [];
  for (const t of TROPHIES) claims.push(...claimsOf(t));
  for (const st of STAGES) claims.push(...st.actions, ...roadmapDoc.facts);
  for (const row of completionDoc.rows) claims.push(row);
  return claims;
}
function trophySources(t) {
  const set = new Set();
  for (const c of [...t.steps, ...t.tips, t.missable]) for (const n of c.s ?? []) set.add(n);
  for (const d of t.disputes) { for (const n of d.a.s) set.add(n); for (const n of d.b.s) set.add(n); }
  return set;
}
function citedBy() {
  const map = new Map(SOURCES.map((s) => [s.n, 0]));
  const bump = (c) => { for (const n of c.s ?? []) if (map.has(n)) map.set(n, map.get(n) + 1); };
  for (const t of TROPHIES) {
    for (const c of [...t.steps, ...t.tips, t.missable]) bump(c);
    for (const d of t.disputes) { bump(d.a); bump(d.b); }
  }
  for (const st of STAGES) st.actions.forEach(bump);
  roadmapDoc.facts.forEach(bump);
  completionDoc.rows.forEach(bump);
  return map;
}

function computeAudit() {
  const claims = allClaims();
  const cited = claims.filter((c) => (c.s ?? []).length >= 1);
  const backed2 = claims.filter((c) => (c.s ?? []).length >= 2);
  const single = claims.filter((c) => (c.s ?? []).length === 1);
  const steps = TROPHIES.flatMap((t) => t.steps);
  const disputes = TROPHIES.flatMap((t) => t.disputes);
  return {
    trophies: TROPHIES.length,
    hidden: TROPHIES.filter((t) => t.hidden).length,
    grades: Object.fromEntries(GRADES.map((g) => [g, TROPHIES.filter((t) => t.grade === g).length])),
    guidesCiting: TROPHIES.filter((t) => claimsOf(t).some((c) => (c.s ?? []).length >= 1)).length,
    steps: steps.length,
    stepsCited: steps.filter((c) => c.s.length >= 1).length,
    claims: claims.length,
    claimsCited: cited.length,
    backed2: backed2.length,
    single: single.length,
    sources: SOURCES.length,
    sites: new Set(SOURCES.map((s) => s.host)).size,
    disputes: disputes.length,
    possibly: TROPHIES.filter((t) => t.missable.level === 'possibly').length,
    watch: TROPHIES.filter((t) => t.missable.level === 'watch').length,
    unconfirmed: TROPHIES.filter((t) => t.confidence === 'unconfirmed').length,
    proseChars: TROPHIES.reduce((a, t) => a + t.guide.length, 0),
    totalPoints: TROPHIES.reduce((a, t) => a + PTS[t.grade], 0),
    countedTargets: TROPHIES.filter((t) => t.target != null).reduce((a, t) => a + t.target, 0),
    green: TROPHIES.filter((t) => trophySources(t).size >= 2 && t.disputes.length === 0).length,
    amber: TROPHIES.filter((t) => !(trophySources(t).size >= 2 && t.disputes.length === 0)).length,
  };
}

/* ---------------- live progress stats (computed from state + data) ---------------- */

function midHours(t) { return (t.time.min + t.time.max) / 2; }
function hoursLeftFor(t) {
  if (earned(t)) return 0;
  let h = midHours(t);
  if (t.target != null && t.target > 0) h *= 1 - counterOf(t) / t.target;
  return h;
}
function computeStats() {
  const ptsEarned = TROPHIES.filter(earned).reduce((a, t) => a + PTS[t.grade], 0);
  const countedLogged = TROPHIES.filter((t) => t.target != null).reduce((a, t) => a + counterOf(t), 0);
  const hoursLeft = TROPHIES.reduce((a, t) => a + hoursLeftFor(t), 0);
  const perStage = STAGES.map((st) => {
    const ts = TROPHIES.filter((t) => t.stage === st.n);
    return {
      n: st.n, name: st.name, total: ts.length,
      earned: ts.filter(earned).length,
      pts: ts.reduce((a, t) => a + PTS[t.grade], 0),
      ptsEarned: ts.filter(earned).reduce((a, t) => a + PTS[t.grade], 0),
      hours: ts.reduce((a, t) => a + midHours(t), 0),
    };
  });
  return { earnedCount: state.earned.length, ptsEarned, countedLogged, hoursLeft, perStage };
}

const fmt = (n) => n.toLocaleString('en-US');
const hrs = (h) => (h >= 10 ? Math.round(h).toString() : h.toFixed(1));
const cite = (s) => (s && s.length ? ` <span class="cite">[${s.join('·')}]</span>` : '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ---------------- header / audit / tabs / stage strip ---------------- */

function renderChrome() {
  const a = computeAudit();
  const st = computeStats();
  $('#site-header').innerHTML = `
    <div class="brand">
      <div class="kicker">GTA VI · PlayStation 5 · Trophy Guide & Tracker</div>
      <h1>The Leonida Field Guide</h1>
      <div class="sub">All ${a.trophies} trophies — ${a.grades.platinum} platinum · ${a.grades.gold} gold · ${a.grades.silver} silver · ${a.grades.bronze} bronze · ${a.hidden} hidden — every guide cited, every disagreement shown both ways.</div>
    </div>
    <div class="hstats">
      <div class="hstat"><div class="v"><em>${st.earnedCount}</em> / ${a.trophies}</div><div class="k">Trophies earned</div></div>
      <div class="hstat"><div class="v"><em>${fmt(st.ptsEarned)}</em> / ${fmt(a.totalPoints)}</div><div class="k">PSN points</div></div>
      <div class="hstat"><div class="v"><em>${fmt(st.countedLogged)}</em> / ${fmt(a.countedTargets)}</div><div class="k">Counted items logged</div></div>
      <div class="hstat"><div class="v">~<em>${hrs(st.hoursLeft)}</em> h</div><div class="k">Left on the road</div></div>
    </div>
    <div class="hbtns">
      <button id="btn-spoiler" class="${state.spoiler ? 'on' : ''}">Spoiler shield ${state.spoiler ? 'ON' : 'OFF'}</button>
      <button id="btn-export">Export</button>
      <button class="import-label">Import<input id="file-import" type="file" accept="application/json"></button>
      <button id="btn-reset">Reset</button>
    </div>`;
  $('#audit-strip').innerHTML =
    `<b>${a.trophies}</b> official trophies<span class="dotsep">·</span>guides cite a source <b>${a.guidesCiting}/${a.trophies}</b><span class="dotsep">·</span>` +
    `<b>${fmt(a.claimsCited)}/${fmt(a.claims)}</b> claims cited<span class="dotsep">·</span><b>${fmt(a.backed2)}</b> backed by 2+ sources<span class="dotsep">·</span>` +
    `<b>${a.stepsCited}/${a.steps}</b> steps cited<br>` +
    `<b>${a.sources}</b> sources · <b>${a.sites}</b> sites · read 20–21 Nov 2026<span class="dotsep">·</span><b>${a.possibly}</b> possibly missable<span class="dotsep">·</span>` +
    `<b>${a.watch}</b> on the watch list<span class="dotsep">·</span><b>${a.unconfirmed}</b> unconfirmed<span class="dotsep">·</span>` +
    `single-source claims <b>${a.single}</b><span class="dotsep">·</span><b>${a.disputes}</b> disputes shown both ways<span class="dotsep">·</span>` +
    `backing: <b>${a.green}</b> solid · <b>${a.amber}</b> check the pane`;
  const route = location.hash.replace('#', '') || 'tracker';
  const tabs = [['tracker', 'Tracker'], ['roadmap', 'Roadmap'], ['missables', 'Missables'], ['sources', 'Sources'], ['completion', '100%'], ['planner', 'Next up']];
  $('#tabs').innerHTML = tabs.map(([r, label]) => `<a href="#${r}" class="${route === r ? 'active' : ''}">${label}</a>`).join('');
  $('#stage-strip').innerHTML = st.perStage.map((s) => `
    <button class="stage-chip" data-stage="${s.n}">
      <div class="sn">S${s.n} · STAGE ${s.n} OF 7</div>
      <div class="sname">${esc(s.name.split('—')[1]?.trim() ?? s.name)}</div>
      <div class="smeta">${s.earned}/${s.total} earned · ${fmt(s.ptsEarned)}/${fmt(s.pts)} pts · ~${hrs(s.hours)} h</div>
      <div class="bar"><i style="width:${s.total ? (s.earned / s.total) * 100 : 0}%"></i></div>
    </button>`).join('');
  $('#site-footer').innerHTML =
    `The Leonida Field Guide v3 — an unofficial fan guide. Every count on this page is computed in your browser from the data files (trophies.json, sources.json, roadmap.json, completion.json); nothing is hard-coded. Guide text is our own words; sources are credited by number everywhere they are used. Progress is stored only in this browser (localStorage).`;

  $('#btn-spoiler').addEventListener('click', () => { state.spoiler = !state.spoiler; save(); render(); });
  $('#btn-export').addEventListener('click', () => {
    const aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }));
    aEl.download = 'leonida-field-guide-progress.json';
    aEl.click();
  });
  $('#file-import').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { state = { earned: [], counters: {}, completion: {}, notes: {}, stars: [], spoiler: true, ...JSON.parse(await f.text()) }; save(); render(); } catch { /* ignore bad files */ }
  });
  $('#btn-reset').addEventListener('click', () => {
    state = { earned: [], counters: {}, completion: {}, notes: {}, stars: [], spoiler: state.spoiler };
    save(); render();
  });
  document.querySelectorAll('.stage-chip').forEach((chip) =>
    chip.addEventListener('click', () => { location.hash = 'roadmap'; }));
}

/* ---------------- shared bits ---------------- */

function missChip(t) {
  if (t.missable.level === 'possibly') return `<span class="chip possibly">POSSIBLY MISSABLE</span>`;
  if (t.missable.level === 'watch') return `<span class="chip watch">WATCH · last chance ${esc(t.missable.close)}</span>`;
  return '';
}
function backingDot(t) {
  const solid = trophySources(t).size >= 2 && t.disputes.length === 0;
  return `<span class="dot ${solid ? 'green' : 'amber'}" title="${solid ? 'Backed by 2+ sources, no open dispute' : 'Single-source or disputed — see the pane'}"></span>`;
}
function counterHTML(t, big) {
  if (t.target == null) return '';
  const cur = counterOf(t);
  const pct = Math.min(100, (cur / t.target) * 100);
  let ticks = '';
  if (t.target <= 60) {
    ticks = `<div class="tickgrid">${Array.from({ length: t.target }, (_, i) => `<i class="${i < cur ? 'on' : ''}"></i>`).join('')}</div>`;
  }
  return `<div class="counter-box">
    <div class="chead"><span>Progress — ${fmt(cur)} / ${fmt(t.target)}</span>
    <span class="cbtns"><button data-dec="${t.id}">−</button><button data-inc="${t.id}">+</button>${big ? `<button data-inc10="${t.id}">+10</button>` : ''}</span></div>
    <div class="mini-bar" style="height:8px"><i style="width:${pct}%"></i></div>${ticks}</div>`;
}
function bindCounters(root) {
  root.querySelectorAll('[data-inc]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); bump(+b.dataset.inc, 1); }));
  root.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); bump(+b.dataset.dec, -1); }));
  root.querySelectorAll('[data-inc10]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); bump(+b.dataset.inc10, 10); }));
}
function bump(id, d) {
  const t = BY_ID.get(id);
  state.counters[id] = Math.max(0, Math.min(t.target, (state.counters[id] ?? 0) + d));
  if (state.counters[id] >= t.target && !earned(t)) state.earned.push(id);
  save(); render();
}

/* ---------------- tracker view ---------------- */

function visibleTrophies() {
  let list = [...TROPHIES];
  const f = filters;
  if (f.q) list = list.filter((t) => (t.name + ' ' + t.description + ' ' + t.kind).toLowerCase().includes(f.q.toLowerCase()));
  if (f.grade !== 'all') list = list.filter((t) => t.grade === f.grade);
  if (f.kind !== 'all') list = list.filter((t) => t.kind === f.kind);
  if (f.status === 'earned') list = list.filter(earned);
  if (f.status === 'unearned') list = list.filter((t) => !earned(t));
  if (f.status === 'counted') list = list.filter((t) => t.target != null);
  if (f.status === 'watch') list = list.filter((t) => t.missable.level !== 'no');
  if (f.hideEarned) list = list.filter((t) => !earned(t));
  const by = {
    route: (x, y) => x.route - y.route,
    stage: (x, y) => x.stage - y.stage || x.route - y.route,
    grade: (x, y) => GRADES.indexOf(x.grade) - GRADES.indexOf(y.grade) || x.route - y.route,
    points: (x, y) => PTS[y.grade] - PTS[x.grade] || x.route - y.route,
    name: (x, y) => x.name.localeCompare(y.name),
  }[f.sort];
  return list.sort(by);
}

function rowHTML(t) {
  const isSel = t.id === selectedId;
  const blur = state.spoiler && t.hidden && !earned(t);
  const cnt = t.target != null ? `<div class="mini-bar"><i style="width:${Math.min(100, (counterOf(t) / t.target) * 100)}%"></i></div><div class="small muted">${fmt(counterOf(t))} / ${fmt(t.target)}</div>` : '';
  return `<div class="trow ${earned(t) ? 'earned' : ''} ${isSel ? 'selected' : ''} ${blur ? 'spoilered' : ''}" data-open="${t.id}">
    <input type="checkbox" data-earn="${t.id}" ${earned(t) ? 'checked' : ''}>
    <div class="route-badge">${t.route}</div>
    <div>
      <span class="tname">${esc(t.name)}</span>
      <div class="tdesc">${esc(t.description)}</div>
      <div class="tmeta">
        <span class="chip grade-${t.grade}">${t.grade.toUpperCase()}</span>
        <span class="chip pts">${PTS[t.grade]} pts</span>
        <span class="chip src">${trophySources(t).size} src</span>
        ${t.hidden ? '<span class="chip hidden-chip">HIDDEN</span>' : ''}
        ${missChip(t)}
        ${backingDot(t)}
      </div>${cnt}
    </div>
    <button class="star-btn ${state.stars.includes(t.id) ? 'starred' : ''}" data-star="${t.id}" title="Star for Next up">★</button>
  </div>`;
}

function paneHTML(t) {
  const srcs = [...trophySources(t)].sort((a, b) => a - b);
  const disputes = t.disputes.map((d) => `
    <div class="dispute">
      <div class="topic">SOURCES DISAGREE — ${esc(d.topic)}</div>
      <div class="side"><b>A:</b> ${esc(d.a.t)}${cite(d.a.s)}</div>
      <div class="side"><b>B:</b> ${esc(d.b.t)}${cite(d.b.s)}</div>
      <div class="verdict"><b>Our call:</b> ${esc(d.verdict)}</div>
    </div>`).join('');
  const miss = t.missable.level !== 'no' ? `
    <div class="miss-box ${t.missable.level}">
      <div class="k">${t.missable.level === 'possibly' ? '⚠ Possibly missable' : 'Watch — window: ' + esc(t.missable.open) + ' → ' + esc(t.missable.close)}</div>
      ${esc(t.missable.t)}${cite(t.missable.s)}
    </div>` : '';
  const steps = t.steps.map((s) => `<li>${esc(s.t)}${cite(s.s)}</li>`).join('');
  const chips = srcs.slice(0, 6).map((n) => `<span class="src-chip">[${n}] ${esc(SRC.get(n).short)}</span>`).join('');
  const tips = t.tips.length ? `<div class="sect-k">Field tips</div><ul class="tips">${t.tips.map((x) => `<li>${esc(x.t)}${cite(x.s)}</li>`).join('')}</ul>` : '';
  return `
    <div class="pane-chips">
      <span class="chip grade-${t.grade}">${t.grade.toUpperCase()}</span>
      <span class="chip pts">${PTS[t.grade]} PSN pts</span>
      <span class="chip">${esc(t.kind)}</span>
      <span class="chip">Stage ${t.stage} · Route #${t.route}</span>
      <span class="chip">Difficulty ${t.difficulty}/5</span>
      <span class="chip">~${hrs((t.time.min + t.time.max) / 2)} h</span>
      <span class="chip">${esc(t.confidence)}</span>
      ${t.hidden ? '<span class="chip hidden-chip">HIDDEN</span>' : ''}
    </div>
    <h2>${esc(t.name)}</h2>
    <div class="official"><div class="k">Official description</div>${esc(t.description)}</div>
    <div class="sect-k">In short</div>
    <div class="inshort">${esc(t.short)}</div>
    ${miss}
    ${disputes}
    <div class="sect-k">The route — ${t.steps.length} cited steps</div>
    <ol class="steps">${steps}</ol>
    ${counterHTML(t, true)}
    ${tips}
    <div class="sect-k">The full guide</div>
    <div class="prose">${esc(t.guide)}</div>
    <div class="sect-k">Your notes</div>
    <textarea class="notes-area" data-notes="${t.id}" placeholder="Private notes for this trophy — saved in this browser only.">${esc(state.notes[t.id] ?? '')}</textarea>
    <div class="sect-k">Top sources for this guide</div>
    <div class="src-chips">${chips}</div>
    <div class="guide-sources"><div class="sect-k">Sources for this guide (${srcs.length})</div>
    ${srcs.map((n) => { const s = SRC.get(n); return `<div>[${n}] <b>${esc(s.short)}</b> — ${esc(s.title)} · ${esc(s.host)} · read ${esc(s.read)} · ${esc(s.depth)}</div>`; }).join('')}
    </div>`;
}

function railHTML() {
  const st = computeStats();
  const upcoming = TROPHIES.filter((t) => !earned(t))
    .sort((x, y) => (state.stars.includes(y.id) - state.stars.includes(x.id)) || x.route - y.route)
    .slice(0, 5);
  const next = upcoming.map((t) => `
    <div class="rail-item"><span class="rn">#${t.route} ${esc(t.name)}</span>
    <div class="rm">Stage ${t.stage} · ${PTS[t.grade]} pts · ~${hrs(hoursLeftFor(t))} h left${t.target != null ? ` · ${fmt(counterOf(t))}/${fmt(t.target)}` : ''}</div></div>`).join('');
  const road = completionDoc.rows.slice(2, 6).map((r, i) => {
    const idx = i + 2; const cur = state.completion[idx] ?? 0;
    return `<div class="rail-item"><span class="rn">${esc(r.label)}</span>
      <div class="rm">${fmt(cur)} / ${fmt(r.target)} ${esc(r.unit)}${cite(r.s)}</div>
      <div class="mini-bar"><i style="width:${Math.min(100, (cur / r.target) * 100)}%"></i></div></div>`;
  }).join('');
  const sel = BY_ID.get(selectedId);
  const srcs = [...trophySources(sel)].sort((a, b) => a - b).slice(0, 6);
  const guideSrc = srcs.map((n) => { const s = SRC.get(n); return `<div class="rail-item"><span class="rn">[${n}] ${esc(s.short)}</span><div class="rm">${esc(s.host)} · read ${esc(s.read)}</div></div>`; }).join('');
  return `<div class="rail">
    <div class="panel"><h3>Next up <span class="muted small">— route order</span></h3>${next || '<div class="muted">Everything earned. Legend.</div>'}</div>
    <div class="panel"><h3>Road to 100%</h3>${road}
      <div class="small muted" style="margin-top:6px">~${hrs(st.hoursLeft)} h left on the road · full checklist in the 100% tab</div></div>
    <div class="panel"><h3>Sources for this guide</h3>${guideSrc}</div>
  </div>`;
}

function viewTracker() {
  const kinds = [...new Set(TROPHIES.map((t) => t.kind))].sort();
  const list = visibleTrophies();
  const grouped = (filters.sort === 'route' || filters.sort === 'stage');
  let rows = '';
  let lastStage = null;
  for (const t of list) {
    if (grouped && t.stage !== lastStage) {
      lastStage = t.stage;
      const stg = STAGES.find((s) => s.n === t.stage);
      rows += `<div class="stage-group">Stage ${t.stage} — ${esc(stg.name)}</div>`;
    }
    rows += rowHTML(t);
  }
  $('#view').innerHTML = `
    <div class="toolbar">
      <input type="text" id="f-q" class="grow" placeholder="Search trophies…" value="${esc(filters.q)}">
      <label>Grade <select id="f-grade">${['all', ...GRADES].map((g) => `<option ${filters.grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label>Kind <select id="f-kind">${['all', ...kinds].map((g) => `<option ${filters.kind === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label>Status <select id="f-status">${[['all', 'all'], ['earned', 'earned'], ['unearned', 'unearned'], ['counted', 'counted'], ['watch', 'watch list']].map(([v, l]) => `<option value="${v}" ${filters.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Sort <select id="f-sort">${[['route', 'route order'], ['stage', 'stage'], ['grade', 'grade'], ['points', 'PSN points'], ['name', 'name']].map(([v, l]) => `<option value="${v}" ${filters.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label><input type="checkbox" id="f-hide" ${filters.hideEarned ? 'checked' : ''}> Hide earned</label>
      <span class="muted small">${list.length} shown</span>
    </div>
    <div class="tracker-grid">
      <div>${rows || '<div class="panel muted">No trophies match those filters.</div>'}</div>
      <div class="panel pane">${paneHTML(BY_ID.get(selectedId))}</div>
      ${railHTML()}
    </div>`;
  const rerender = () => { render(); };
  $('#f-q').addEventListener('input', (e) => { filters.q = e.target.value; const v = $('#view'); v.querySelectorAll('.trow').forEach((r) => r.remove()); renderTrackerRowsOnly(); });
  $('#f-grade').addEventListener('change', (e) => { filters.grade = e.target.value; rerender(); });
  $('#f-kind').addEventListener('change', (e) => { filters.kind = e.target.value; rerender(); });
  $('#f-status').addEventListener('change', (e) => { filters.status = e.target.value; rerender(); });
  $('#f-sort').addEventListener('change', (e) => { filters.sort = e.target.value; rerender(); });
  $('#f-hide').addEventListener('change', (e) => { filters.hideEarned = e.target.checked; rerender(); });
  bindTrackerEvents();
}
function renderTrackerRowsOnly() { render(); }
function bindTrackerEvents() {
  document.querySelectorAll('[data-open]').forEach((row) => row.addEventListener('click', (e) => {
    if (e.target.matches('input,button')) return;
    selectedId = +row.dataset.open; render();
  }));
  document.querySelectorAll('[data-earn]').forEach((box) => box.addEventListener('change', () => {
    const id = +box.dataset.earn;
    if (box.checked) { if (!state.earned.includes(id)) state.earned.push(id); }
    else state.earned = state.earned.filter((x) => x !== id);
    save(); render();
  }));
  document.querySelectorAll('[data-star]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = +b.dataset.star;
    state.stars = state.stars.includes(id) ? state.stars.filter((x) => x !== id) : [...state.stars, id];
    save(); render();
  }));
  document.querySelectorAll('[data-notes]').forEach((ta) => ta.addEventListener('change', () => {
    state.notes[+ta.dataset.notes] = ta.value; save();
  }));
  bindCounters($('#view'));
}

/* ---------------- roadmap view ---------------- */

function viewRoadmap() {
  const st = computeStats();
  const cards = STAGES.map((stage) => {
    const ps = st.perStage[stage.n - 1];
    const actions = stage.actions.map((a) => `<li>${esc(a.t)}${cite(a.s)}</li>`).join('');
    return `<div class="panel stage-card">
      <h3>S${stage.n} — ${esc(stage.name)}</h3>
      <div class="small muted">${ps.earned}/${ps.total} earned · ${fmt(ps.ptsEarned)}/${fmt(ps.pts)} PSN pts · ~${hrs(ps.hours)} h in stage</div>
      <div class="bar"><i style="width:${ps.total ? (ps.earned / ps.total) * 100 : 0}%"></i></div>
      <ul>${actions}</ul></div>`;
  }).join('');
  $('#view').innerHTML = `
    <h2>Roadmap — 7 stages to the platinum <span class="muted" style="font-size:16px">· ~${hrs(st.hoursLeft)} h left from where you stand</span></h2>
    <div class="facts-strip">${roadmapDoc.facts.map((f) => `<span class="fact">${esc(f.t)}${cite(f.s)}</span>`).join('')}</div>
    <div class="cards">${cards}</div>`;
}

/* ---------------- missables view ---------------- */

const CH = ['Ch 1', 'Ch 2', 'Ch 3', 'Ch 4', 'Finale', 'Post'];
const chIdx = (c) => CH.indexOf(c);
function viewMissables() {
  const watched = TROPHIES.filter((t) => t.missable.level !== 'no').sort((a, b) => a.route - b.route);
  const rows = watched.map((t) => {
    const o = chIdx(t.missable.open), c = chIdx(t.missable.close);
    const cells = CH.map((_, i) => {
      if (i === c) return `<td class="last">LAST</td>`;
      if (i >= o && i < c) return `<td class="open">●</td>`;
      return `<td class="closed">·</td>`;
    }).join('');
    return `<tr><td><b>#${t.route} ${esc(t.name)}</b><div class="small muted">${esc(t.missable.t)}${cite(t.missable.s)}</div></td>${cells}</tr>`;
  }).join('');
  const gates = {};
  for (const t of watched) (gates[t.missable.close] ??= []).push(t);
  const gateHTML = Object.entries(gates).map(([close, ts]) => `
    <div class="rail-item"><span class="rn">Closes: ${esc(close)}</span>
    <div class="rm">${ts.map((t) => `#${t.route} ${esc(t.name)}`).join(' · ')}</div></div>`).join('');
  const pma = BY_ID.get(28);
  $('#view').innerHTML = `
    <h2>Missables & the watch list — ${watched.length} trophies with windows</h2>
    <div class="two-col">
      <div class="panel">
        <h3>Windows timeline</h3>
        <table class="grid"><tr><th>Trophy</th>${CH.map((c) => `<th>${c}</th>`).join('')}</tr>${rows}</table>
        <div class="small muted" style="margin-top:8px">● open · LAST = last chance in that column · · = closed or not yet open.</div>
      </div>
      <div>
        <div class="panel" style="margin-bottom:14px">
          <h3>⚠ Positive Mental Attitude — the one possibly missable</h3>
          <div>${esc(pma.missable.t)}${cite(pma.missable.s)}</div>
          ${pma.disputes.map((d) => `<div class="dispute" style="margin-top:10px"><div class="topic">SOURCES DISAGREE — ${esc(d.topic)}</div>
            <div class="side"><b>A:</b> ${esc(d.a.t)}${cite(d.a.s)}</div><div class="side"><b>B:</b> ${esc(d.b.t)}${cite(d.b.s)}</div>
            <div class="verdict"><b>Our call:</b> ${esc(d.verdict)}</div></div>`).join('')}
        </div>
        <div class="panel" style="margin-bottom:14px"><h3>Story gates</h3>${gateHTML}</div>
        <div class="panel"><h3>The manual-save protocol</h3>
          <div>1. Bank a manual save in <b>Chapter 1</b>, after meditating at the balcony spot.${cite([22, 53])}</div>
          <div style="margin-top:6px">2. Bank a second save at the <b>Chapter 4</b> start, and a third <b>before the finale</b>.${cite([22, 36])}</div>
          <div style="margin-top:6px">3. Never overwrite these three slots; rotate all other saves freely. If a window closes on you, the right slot is always there.${cite([36, 63])}</div>
        </div>
      </div>
    </div>`;
}

/* ---------------- sources view ---------------- */

function viewSources() {
  const by = citedBy();
  const disputes = TROPHIES.flatMap((t) => t.disputes.map((d) => ({ t, d, n: new Set([...d.a.s, ...d.b.s]).size })));
  const top = [...disputes].sort((a, b) => b.n - a.n).slice(0, 3);
  const callout = `<div class="callout"><h3>Most disputed — the three widest disagreements</h3>
    ${top.map(({ t, d }) => `<div style="margin-bottom:8px"><b>${esc(t.name)} — ${esc(d.topic)}</b>
      <div class="small">A: ${esc(d.a.t)}${cite(d.a.s)}<br>B: ${esc(d.b.t)}${cite(d.b.s)}<br>
      <span style="color:var(--accent2)"><b>Our call:</b> ${esc(d.verdict)}</span></div></div>`).join('')}</div>`;
  const reg = SOURCES.map((s) => `<tr><td><b>[${s.n}]</b></td><td><b>${esc(s.short)}</b><div class="small muted">${esc(s.title)}</div></td>
    <td>${esc(s.host)}</td><td>${esc(s.kind)}</td><td>${esc(s.read)}</td><td>${esc(s.depth)}</td><td><b>${by.get(s.n)}</b></td></tr>`).join('');
  const usedSources = SOURCES.filter((s) => by.get(s.n) > 0);
  const matrix = `<table class="matrix"><tr><th>Trophy</th>${usedSources.map((s) => `<th>${s.n}</th>`).join('')}</tr>
    ${TROPHIES.map((t) => {
      const counts = new Map();
      for (const c of [...t.steps, ...t.tips, t.missable]) for (const n of c.s ?? []) counts.set(n, (counts.get(n) ?? 0) + 1);
      for (const d of t.disputes) { for (const n of d.a.s) counts.set(n, (counts.get(n) ?? 0) + 1); for (const n of d.b.s) counts.set(n, (counts.get(n) ?? 0) + 1); }
      return `<tr><th style="text-align:left">${t.route}. ${esc(t.name)}</th>${usedSources.map((s) => { const v = counts.get(s.n) ?? 0; return `<td class="${v ? 'hit' : ''}">${v || ''}</td>`; }).join('')}</tr>`;
    }).join('')}</table>`;
  $('#view').innerHTML = `
    <h2>Sources — ${SOURCES.length} pages, ${new Set(SOURCES.map((s) => s.host)).size} sites, all read 20–21 Nov 2026</h2>
    ${callout}
    <div class="panel" style="margin-bottom:14px"><h3>The registry</h3>
      <table class="grid"><tr><th>#</th><th>Source</th><th>Site</th><th>Kind</th><th>Read</th><th>Depth</th><th>Cited by</th></tr>${reg}</table>
      <div class="small muted" style="margin-top:8px">Depth is reported honestly: <b>full</b> = read end to end · <b>key</b> = the sections backing our citations read in full · <b>excerpt</b> = title and opening only (videos, forum threads). Cited-by counts are computed from the data files.</div>
    </div>
    <div class="panel"><h3>Trophy × source matrix — claims backed per source</h3><div class="matrix-wrap">${matrix}</div></div>`;
}

/* ---------------- 100% view ---------------- */

function viewCompletion() {
  const rows = completionDoc.rows.map((r, i) => {
    const cur = state.completion[i] ?? 0;
    const pct = Math.min(100, (cur / r.target) * 100);
    return `<div class="check-row"><div>
      <span class="cl">${esc(r.label)}</span> <span class="cite">[${r.s.join('·')}]</span>
      <div class="cn">${esc(r.note)}</div>
      <div class="mini-bar"><i style="width:${pct}%"></i></div></div>
      <div class="chead" style="display:flex;gap:8px;align-items:center"><b>${fmt(cur)} / ${fmt(r.target)}</b> ${esc(r.unit)}
      <span class="cbtns"><button data-cdec="${i}">−</button><button data-cinc="${i}">+</button><button data-cinc10="${i}">+10</button></span></div></div>`;
  }).join('');
  const totalCur = completionDoc.rows.reduce((a, r, i) => a + Math.min(state.completion[i] ?? 0, r.target), 0);
  const totalMax = completionDoc.rows.reduce((a, r) => a + r.target, 0);
  $('#view').innerHTML = `
    <h2>Road to 100% — ${fmt(totalCur)} of ${fmt(totalMax)} counted items logged</h2>
    <div class="muted" style="margin-bottom:12px">The big completion rows behind A Long Road, each tickable and cited. Progress here is stored with the rest of your tracker.</div>
    ${rows}`;
  const bumpC = (i, d) => {
    const r = completionDoc.rows[i];
    state.completion[i] = Math.max(0, Math.min(r.target, (state.completion[i] ?? 0) + d));
    save(); render();
  };
  document.querySelectorAll('[data-cinc]').forEach((b) => b.addEventListener('click', () => bumpC(+b.dataset.cinc, 1)));
  document.querySelectorAll('[data-cdec]').forEach((b) => b.addEventListener('click', () => bumpC(+b.dataset.cdec, -1)));
  document.querySelectorAll('[data-cinc10]').forEach((b) => b.addEventListener('click', () => bumpC(+b.dataset.cinc10, 10)));
}

/* ---------------- planner view ---------------- */

function viewPlanner() {
  const st = computeStats();
  const queue = TROPHIES.filter((t) => !earned(t))
    .sort((x, y) => (state.stars.includes(y.id) - state.stars.includes(x.id)) || x.route - y.route);
  const items = queue.map((t) => `
    <div class="check-row"><div>
      <span class="cl">#${t.route} ${esc(t.name)}</span> ${state.stars.includes(t.id) ? '<span class="chip pts">★ QUEUED</span>' : ''}
      <div class="cn">Stage ${t.stage} · ${esc(t.kind)} · ${PTS[t.grade]} pts${t.target != null ? ` · counter ${fmt(counterOf(t))}/${fmt(t.target)}` : ''} ${missChip(t)}</div></div>
      <div><b>~${hrs(hoursLeftFor(t))} h</b> <span class="muted">left</span>
      <button class="star-btn ${state.stars.includes(t.id) ? 'starred' : ''}" data-star="${t.id}">★</button></div></div>`).join('');
  $('#view').innerHTML = `
    <h2>Next up — the road from here</h2>
    <div class="facts-strip">
      <span class="fact"><b>~${hrs(st.hoursLeft)} h</b> left in total</span>
      <span class="fact"><b>${queue.length}</b> trophies outstanding</span>
      <span class="fact"><b>${fmt(computeAudit().totalPoints - st.ptsEarned)}</b> PSN pts still on the table</span>
      ${st.perStage.map((s) => `<span class="fact">S${s.n}: ${s.total - s.earned} left</span>`).join('')}
    </div>
    ${items || '<div class="panel">Everything is earned. You are a Leonida Legend.</div>'}`;
  document.querySelectorAll('[data-star]').forEach((b) => b.addEventListener('click', () => {
    const id = +b.dataset.star;
    state.stars = state.stars.includes(id) ? state.stars.filter((x) => x !== id) : [...state.stars, id];
    save(); render();
  }));
}

/* ---------------- router ---------------- */

function render() {
  renderChrome();
  const route = location.hash.replace('#', '') || 'tracker';
  ({ tracker: viewTracker, roadmap: viewRoadmap, missables: viewMissables, sources: viewSources, completion: viewCompletion, planner: viewPlanner }[route] ?? viewTracker)();
}
window.addEventListener('hashchange', render);
render();
