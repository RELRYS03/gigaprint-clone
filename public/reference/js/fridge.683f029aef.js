/* Expressarte refrigerator organizer: a fridge shelf laid out on a grid of cells, each cell (or merged block of
   cells) holding a module: a stackable egg tray, a gravity-fed soda can dispenser (sloped lanes, front stop,
   optional top-loading return), a lay-down bottle rack, a condiment tray, cup bins, a produce bin with a raised
   drainage floor, a deli bin, a butter tray, a stackable bin with a handle cutout, a turntable, or a plain bin.
   Neighbors lock together with small I-shaped connector keys that drop into sockets under the floor, and any
   module bigger than the build plate is split into pieces joined the same way. Everything prints upright with
   no supports. American spelling. No brand names. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);

  const IN = 25.4;
  const CANS = { '12oz': { d: 66, l: 122.7, name: '12 oz can' }, slim: { d: 58, l: 146, name: '12 oz slim can' }, '16oz': { d: 66, l: 157, name: '16 oz can' } };
  const PRESETS = [
    { id: 'topfreezer', name: 'Top-freezer fridge, 30 in', w: 686, d: 406, h: 230 },
    { id: 'french', name: 'French-door fridge, 36 in', w: 813, d: 457, h: 254 },
    { id: 'sidebyside', name: 'Side-by-side, fresh food side', w: 381, d: 432, h: 230 },
    { id: 'bottom', name: 'Bottom-freezer fridge, 30 in', w: 700, d: 430, h: 240 },
    { id: 'compact', name: 'Compact or dorm fridge', w: 432, d: 356, h: 203 },
    { id: 'door', name: 'Door shelf, 20 \u00d7 4 in', w: 500, d: 95, h: 180 },
    { id: 'small', name: 'Small shelf, 24 \u00d7 16 in', w: 600, d: 400, h: 230 }
  ];
  const TYPES = {
    egg: { name: 'Egg tray', short: 'Eggs', h: 0 },
    soda: { name: 'Soda can dispenser', short: 'Cans', h: 0 },
    bottle: { name: 'Bottle rack', short: 'Bottles', h: 0 },
    condiment: { name: 'Condiment tray', short: 'Condiments', h: 90 },
    cups: { name: 'Yogurt and cup bin', short: 'Cups', h: 60 },
    produce: { name: 'Produce bin', short: 'Produce', h: 120 },
    deli: { name: 'Deli and cheese bin', short: 'Deli', h: 70 },
    butter: { name: 'Butter tray', short: 'Butter', h: 45 },
    stack: { name: 'Stackable bin', short: 'Stack bin', h: 100 },
    turntable: { name: 'Turntable', short: 'Turntable', h: 0 },
    bin: { name: 'Plain bin', short: 'Bin', h: 80 },
    empty: { name: 'Empty space', short: '', h: 0 }
  };
  const TYPE_ORDER = ['egg', 'soda', 'bottle', 'condiment', 'cups', 'produce', 'deli', 'butter', 'stack', 'turntable', 'bin', 'empty'];
  const MOD_DEFAULTS = {
    egg: { count: '12', stack: true, trays: 1 },
    soda: { can: '12oz', slope: 5, loader: false },
    bottle: { bottleD: 80 },
    cups: { cupD: 95 },
    turntable: { rim: 15 }
  };
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    shelfW: 600, shelfD: 400, shelfH: 230, cols: 4, rows: 3,
    wall: 2.4, floor: 2, gap: 1.2, edge: 2, keyClear: 0.2, labels: false,
    colors: { body: '#E8F1F5', accent: PZ.babyBlue },
    bed: [256, 256, 256], bambu: 'A1', detail: 'hd', modules: null
  };
  const PALETTE = {
    body: [
      { name: 'Frost', hex: '#E8F1F5' }, { name: 'White', hex: '#F5F5F2' }, { name: 'Light gray', hex: '#C9CCCF' },
      { name: 'Aqua', hex: '#9FD3E0' }, { name: 'Mint', hex: '#BFE3C8' }, { name: 'Charcoal', hex: '#3A3D42' }
    ],
    accent: [
      { name: 'Ocean', hex: '#3A8FB7' }, { name: 'Green', hex: '#4FB286' }, { name: 'Coral', hex: '#E0705A' },
      { name: 'Lemon', hex: '#E8C547' }, { name: 'White', hex: '#F5F5F2' }, { name: 'Charcoal', hex: '#3A3D42' }
    ]
  };
  const FREE_MAX_MODULES = 6;
  // connector key (an I shape across the seam) and its sockets under the floor
  const KEY = { nl: 3.5, hl: 4, a: 3, b: 6, t: 3 };
  const SOCK_D = KEY.t + 0.3, PAD_H = SOCK_D + 1.5, PAD_M = 2.4;
  const EGG = { pitch: 46, top: 22, ring: 1.6, H: 24, postR: 5, pinR: 3, pinH: 4, sockR: 3.35, sockH: 4.6, post: 44 };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, d) => (v !== '' && v !== null && v !== undefined && Number.isFinite(+v) ? +v : d);
  const rectP = (x0, y0, x1, y1) => ({ outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], holes: [] });
  const rrP = (x0, y0, x1, y1, r) => ({ outer: T.roundRect(x0, y0, x1, y1, r), holes: [] });
  const ring = (cx, cy, r, n) => ({ outer: T.circle(cx, cy, r, n), holes: [] });

  // ---------------------------------------------------------------- options and layout
  // stepped extrude, then close the T-junctions where cut outlines meet a step a fraction of a micron off the edge
  function extrude(layers) {
    let p = T.steppedExtrude(layers);
    for (let it = 0; it < 6 && Core.fixTJunctions && p.length && !Core.checkClosed(p).closed; it++) {
      const f = Core.fixTJunctions(p, new Array(p.length / 9).fill(0), 2e-3);
      if (!f || !f.p || f.p.length === p.length) break;
      p = Float64Array.from(f.p);
    }
    return p;
  }
  function defaultLayout(cols, rows, dims) {
    const M = [], used = new Set(), put = (c0, r0, c1, r1, type) => {
      c1 = Math.min(c1, cols); r1 = Math.min(r1, rows); if (c0 >= c1 || r0 >= r1) return;
      for (let c = c0; c < c1; c++) for (let r = r0; r < r1; r++) if (used.has(c + ',' + r)) return;
      for (let c = c0; c < c1; c++) for (let r = r0; r < r1; r++) used.add(c + ',' + r);
      M.push({ c0, r0, c1, r1, type });
    };
    const d = dims && num(dims.d, 0);
    // a door shelf is too shallow for a can dispenser or a lay-down bottle rack
    const door = d > 0 && d < 160;
    if (door) {
      const mid = Math.max(1, Math.ceil(cols / 2));
      put(0, 0, mid, rows, 'condiment');
      if (cols > mid) put(mid, 0, cols, Math.min(1, rows), 'cups');
      if (cols > mid && rows > 1) put(mid, 1, cols, rows, 'butter');
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) put(c, r, c + 1, r + 1, 'bin');
      return M;
    }
    if (cols >= 2) put(0, 0, 1, rows, 'soda');
    const e = cols >= 2 ? 1 : 0;
    put(e, 0, e + 1, Math.min(2, rows), 'egg');
    if (rows > 2) put(e, 2, e + 1, rows, 'butter');
    if (cols > e + 1) put(e + 1, 0, cols, Math.min(2, rows), 'produce');
    if (cols > e + 1 && rows > 2) put(e + 1, 2, cols, rows, 'condiment');
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) put(c, r, c + 1, r + 1, 'bin');
    return M;
  }
  function normLayout(cols, rows, mods) {
    const out = [], used = new Set();
    for (const m of Array.isArray(mods) ? mods : []) {
      const c0 = Math.round(clamp(num(m.c0, 0), 0, cols - 1)), r0 = Math.round(clamp(num(m.r0, 0), 0, rows - 1));
      const c1 = Math.round(clamp(num(m.c1, c0 + 1), c0 + 1, cols)), r1 = Math.round(clamp(num(m.r1, r0 + 1), r0 + 1, rows));
      let ok = true;
      for (let c = c0; c < c1 && ok; c++) for (let r = r0; r < r1; r++) if (used.has(c + ',' + r)) { ok = false; break; }
      if (!ok) continue;
      for (let c = c0; c < c1; c++) for (let r = r0; r < r1; r++) used.add(c + ',' + r);
      const type = TYPES[m.type] ? m.type : 'bin';
      out.push({ c0, r0, c1, r1, type, o: Object.assign({}, MOD_DEFAULTS[type] || {}, m.o || {}) });
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!used.has(c + ',' + r)) { used.add(c + ',' + r); out.push({ c0: c, r0: r, c1: c + 1, r1: r + 1, type: 'empty', o: {} }); }
    return out;
  }
  function autoGrid(w, d) { return { cols: clamp(Math.round(w / 150), 1, 12), rows: clamp(Math.round(d / 135), 1, 10) }; }
  function options(raw) {
    const r = Object.assign({}, DEFAULTS, raw || {});
    const o = {
      shelfW: clamp(num(r.shelfW, 600), 150, 1200), shelfD: clamp(num(r.shelfD, 400), 120, 800), shelfH: clamp(num(r.shelfH, 230), 50, 500),
      cols: Math.round(clamp(num(r.cols, 4), 1, 12)), rows: Math.round(clamp(num(r.rows, 3), 1, 10)),
      wall: clamp(num(r.wall, 2.4), 1.6, 4), floor: clamp(num(r.floor, 2), 1.2, 4), gap: clamp(num(r.gap, 1.2), 0.4, 3), edge: clamp(num(r.edge, 2), 0, 15),
      keyClear: clamp(num(r.keyClear, 0.2), 0.05, 0.6), labels: !!r.labels,
      colors: Object.assign({}, DEFAULTS.colors, r.colors || {}),
      bed: Array.isArray(r.bed) ? r.bed.slice(0, 3) : DEFAULTS.bed.slice(),
      bambu: r.bambu === undefined ? DEFAULTS.bambu : r.bambu,
      detail: r.detail === 'draft' ? 'draft' : 'hd'
    };
    o.modules = normLayout(o.cols, o.rows, r.modules || defaultLayout(o.cols, o.rows, { w: o.shelfW, d: o.shelfD }));
    return o;
  }
  function usableBed(bed) {
    const [bx, by, bz] = bed || [256, 256, 256];
    return { w: Math.max(60, bx - 8), d: Math.max(60, by - 8), z: Math.max(40, (bz || Math.min(bx, by)) - 4) };
  }
  const fitsBed = (w, d, B) => (w <= B.w + 1e-6 && d <= B.d + 1e-6) || (w <= B.d + 1e-6 && d <= B.w + 1e-6);

  // ---------------------------------------------------------------- small geometry helpers
  function move(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + dz; } return q; }
  function toOrigin(p) { const b = Core.bbox(p); return move(p, -b.min[0], -b.min[1], -b.min[2]); }
  function rotZ90(p) { // (x, y) -> (-y, x): a proper rotation, winding kept
    const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = -p[i + 1]; q[i + 1] = p[i]; q[i + 2] = p[i + 2]; } return q;
  }
  const sig = polys => polys.map(P => [P.outer, ...P.holes].map(R => R.map(q => (Math.round(q[0] * 1000)) + ',' + Math.round(q[1] * 1000)).join(' ')).join('|')).join('/');
  // layers between breakpoints; consecutive identical regions merge into one taller layer
  function layersFrom(zs, at) {
    zs = Array.from(new Set(zs.map(z => Math.round(z * 1e4) / 1e4))).filter(z => z >= 0).sort((a, b) => a - b);
    const out = [];
    let last = null, lastSig = '';
    for (let i = 0; i + 1 < zs.length; i++) {
      const z0 = zs[i], z1 = zs[i + 1]; if (z1 - z0 < 1e-4) continue;
      const polys = T.unionPolys(at(z0, z1));
      if (!polys.length) { last = null; lastSig = ''; continue; }
      const s = sig(polys);
      if (last && s === lastSig && Math.abs(last.z1 - z0) < 1e-9) { last.z1 = z1; continue; }
      last = { z0, z1, polys }; lastSig = s; out.push(last);
    }
    return out;
  }
  function steps(z0, z1, dz) { const out = []; if (!(z1 > z0)) return out; const n = Math.max(1, Math.ceil((z1 - z0) / dz)); for (let i = 0; i <= n; i++) out.push(z0 + (z1 - z0) * i / n); return out; }
  // {y : top(y) >= z} for a polyline top = [[y, z], ...] (y ascending; equal y gives a vertical step)
  function above(top, z) {
    const iv = [];
    let cur = null;
    for (let k = 0; k + 1 < top.length; k++) {
      const [ya, za] = top[k], [yb, zb] = top[k + 1];
      if (yb - ya < 1e-9) continue;
      let s0 = null, s1 = null;
      if (za >= z - 1e-9 && zb >= z - 1e-9) { s0 = ya; s1 = yb; }
      else if (za >= z - 1e-9) { s0 = ya; s1 = ya + (yb - ya) * (za - z) / (za - zb); }
      else if (zb >= z - 1e-9) { s0 = ya + (yb - ya) * (z - za) / (zb - za); s1 = yb; }
      if (s0 === null) { if (cur) { iv.push(cur); cur = null; } continue; }
      if (cur && Math.abs(cur[1] - s0) < 1e-6) cur[1] = s1; else { if (cur) iv.push(cur); cur = [s0, s1]; }
      if (s1 < yb - 1e-9) { iv.push(cur); cur = null; }
    }
    if (cur) iv.push(cur);
    return iv.filter(([a, b]) => b - a > 0.05);
  }
  const maxOf = top => top.reduce((m, q) => Math.max(m, q[1]), 0);

  // ---------------------------------------------------------------- connector keys
  // A key on a seam: axis 'x' = a seam along x = const (key points across x), at coordinate s, centered at v.
  function keyRects(axis, s, v, side, grow) {
    // rectangles of the half key on one side (side = +1: the part with coordinate > s)
    const g = grow || 0, { nl, hl, a, b } = KEY, R = [];
    const u = (u0, u1) => side > 0 ? [s + u0, s + u1] : [s - u1, s - u0];
    const neck = u(0, nl + g), head = u(nl - g, nl + hl + g);
    R.push([neck, [v - a - g, v + a + g]], [head, [v - b - g, v + b + g]]);
    return R.map(([U, V]) => axis === 'x' ? rectP(U[0], V[0], U[1], V[1]) : rectP(V[0], U[0], V[1], U[1]));
  }
  function padRect(axis, s, v, side, gap) {
    const { nl, hl, b } = KEY, m = PAD_M, u0 = gap / 2 - 0.01, u1 = nl + hl + 0.3 + m;
    const U = side > 0 ? [s + u0, s + u1] : [s - u1, s - u0], V = [v - b - 0.3 - m, v + b + 0.3 + m];
    return axis === 'x' ? rectP(U[0], V[0], U[1], V[1]) : rectP(V[0], U[0], V[1], U[1]);
  }
  function keyMesh(o) {
    const c = 0; // the key is the nominal size; the sockets carry the clearance
    const { nl, hl, a, b, t } = KEY;
    const poly = T.unionPolys([rectP(-nl - c, -a, nl + c, a), rectP(-nl - hl, -b, -nl, b), rectP(nl, -b, nl + hl, b)]);
    // a 0.4 mm chamfer-free key; tiny corner relief keeps it sliding into the sockets
    const sm = T.offset(T.offset(poly, -0.3, true), 0.3, true);
    void o;
    return extrude([{ z0: 0, z1: t, polys: sm }]);
  }

  // ---------------------------------------------------------------- the plan: modules in millimeters, pieces, seams
  function plan(raw) {
    const o = raw && raw._planned ? raw : options(raw);
    const B = usableBed(o.bed), warnings = [];
    const W = o.shelfW, D = o.shelfD, X0 = -W / 2 + o.edge, Y0 = -D / 2 + o.edge;
    const cw = (W - 2 * o.edge) / o.cols, cd = (D - 2 * o.edge) / o.rows, g2 = o.gap / 2;
    const Havail = o.shelfH - 8;
    const mods = o.modules.map((m, i) => {
      const x0 = X0 + m.c0 * cw + (m.c0 > 0 ? g2 : 0), x1 = X0 + m.c1 * cw - (m.c1 < o.cols ? g2 : 0);
      const y0 = Y0 + m.r0 * cd + (m.r0 > 0 ? g2 : 0), y1 = Y0 + m.r1 * cd - (m.r1 < o.rows ? g2 : 0);
      return Object.assign({}, m, { i, x0, y0, x1, y1, w: x1 - x0, d: y1 - y0, sx0: X0 + m.c0 * cw, sx1: X0 + m.c1 * cw, sy0: Y0 + m.r0 * cd, sy1: Y0 + m.r1 * cd, warn: [] });
    });
    for (const m of mods) planModule(o, B, m, Havail);
    for (const m of mods) for (const w of m.warn) warnings.push(`${TYPES[m.type].name} ${m.i + 1}: ${w}`);
    return { o, B, W, D, X0, Y0, cw, cd, mods, warnings, Havail };
  }
  // pick each module's size rules, then split it to the plate
  function planModule(o, B, m, Havail) {
    const t = o.wall;
    if (m.type === 'soda') {
      const can = CANS[m.o.can] || CANS['12oz'], need = can.l + 4 + 2 * t;
      if (m.w < need - 1e-6 || m.d < 2.6 * can.d) { m.warn.push(`needs at least ${Math.ceil(need)} mm of width and ${Math.ceil(2.6 * can.d)} mm of depth; built as a plain bin. Merge cells side by side to fit a lane.`); m.type = 'bin'; m.o = {}; }
    }
    if (m.type === 'egg' && (m.w < EGG.pitch + 2 * t + 2 || m.d < EGG.pitch + 2 * t + 2)) { m.warn.push('too small for one egg; built as a plain bin.'); m.type = 'bin'; m.o = {}; }
    if (m.type === 'bottle') {
      const bD = clamp(num(m.o.bottleD, 80), 50, 130);
      if (m.w < bD + 30 || m.d < 140) { m.warn.push(`needs at least ${Math.ceil(bD + 30)} \u00d7 140 mm; built as a plain bin.`); m.type = 'bin'; m.o = {}; }
    }
    if (m.type === 'turntable' && Math.min(m.w, m.d, B.w, B.d) < 100) { m.warn.push('needs at least 100 \u00d7 100 mm; built as a plain bin.'); m.type = 'bin'; m.o = {}; }
    m.closed = !['soda', 'bottle'].includes(m.type);
    m.keyMode = m.type === 'stack' || m.type === 'empty' ? 'none' : ['soda', 'bottle', 'turntable'].includes(m.type) ? 'solid' : 'pad';
    // height
    const def = TYPES[m.type].h;
    if (def) {
      let h = num(m.o.h, 0) > 0 ? num(m.o.h, 0) : def;
      if (h > Havail) h = Havail;
      if (h > B.z) { m.warn.push(`trimmed to ${Math.round(B.z)} mm tall to fit the printer.`); h = B.z; }
      m.h = clamp(h, 20, 400);
      if (m.h < 20 + 1e-6 && Havail < 20) m.warn.push('the shelf is very low.');
    }
    if (m.type === 'empty') { m.pieces = []; return; }
    // split into pieces that fit the plate
    if (m.type === 'turntable') { m.pieces = [{ x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1, ix: 0, iy: 0 }]; m.xs = []; m.ys = []; return; }
    const lim = [[B.w, B.d], [B.d, B.w]];
    let best = null;
    for (const [bw, bd] of lim) {
      const xs = splitX(o, m, bw), ys = splitY(o, m, bd);
      if (!xs || !ys) continue;
      const n = (xs.length + 1) * (ys.length + 1);
      if (!best || n < best.n) best = { xs, ys, n };
    }
    if (!best) { best = { xs: [], ys: [], n: 1 }; m.warn.push('could not be split to fit this plate.'); }
    m.xs = best.xs; m.ys = best.ys;
    const ex = [m.x0, ...m.xs, m.x1], ey = [m.y0, ...m.ys, m.y1], g2 = o.gap / 2;
    m.pieces = [];
    for (let iy = 0; iy + 1 < ey.length; iy++) for (let ix = 0; ix + 1 < ex.length; ix++)
      m.pieces.push({ ix, iy, x0: ex[ix] + (ix > 0 ? g2 : 0), x1: ex[ix + 1] - (ix + 2 < ex.length ? g2 : 0), y0: ey[iy] + (iy > 0 ? g2 : 0), y1: ey[iy + 1] - (iy + 2 < ey.length ? g2 : 0) });
    if (m.type === 'soda') sodaLanes(o, m);
  }
  const even = (a, b, n) => Array.from({ length: n - 1 }, (_, k) => a + (b - a) * (k + 1) / n);
  function splitX(o, m, max) {
    if (m.w <= max + 1e-6) return [];
    if (m.type === 'soda') { // only through an interior wall: greedy lane groups
      const can = CANS[m.o.can] || CANS['12oz'], lw = can.l + 4, t = o.wall, sw = 2 * t + o.gap;
      const n = Math.max(1, Math.floor((m.w - 2 * t + t) / (lw + t)));
      // widths when split: outer t, lanes, split walls sw
      const per = Math.floor((max - 2 * t + sw / 2 - t / 2) / (lw + t)); // rough capacity per piece
      if (per < 1) return null;
      const groups = Math.ceil(n / per), out = [];
      const pitch = m.w / n;
      for (let k = 1; k < groups; k++) out.push(m.x0 + pitch * Math.round(k * n / groups));
      m.soda = { n, groups };
      return out.every((x, k) => (k ? x - out[k - 1] : x - m.x0) <= max + 1e-6) && m.x1 - (out.at(-1) || m.x0) <= max + 1e-6 ? out : null;
    }
    if (m.type === 'bottle') {
      const bD = clamp(num(m.o.bottleD, 80), 50, 130), p = bD + 14, n = Math.max(1, Math.floor((m.w - 12) / p));
      const xs = Array.from({ length: n - 1 }, (_, k) => m.x0 + m.w / 2 + (k + 1 - n / 2) * p);
      const out = []; let s = m.x0;
      while (m.x1 - s > max + 1e-6) { const c = xs.filter(x => x > s + 10 && x - s <= max - 1); if (!c.length) return null; s = c[c.length - 1]; out.push(s); }
      return out;
    }
    const n = Math.ceil(m.w / (max - 0.5));
    return even(m.x0, m.x1, n);
  }
  function splitY(o, m, max) {
    if (m.d <= max + 1e-6) return [];
    const n = Math.ceil(m.d / (max - 0.5));
    return even(m.y0, m.y1, n);
  }
  // soda: lane walls across the width (split walls are double)
  function sodaLanes(o, m) {
    const can = CANS[m.o.can] || CANS['12oz'], t = o.wall, sw = 2 * t + o.gap;
    const splits = m.xs.slice();
    // lanes per group from the split positions
    const ex = [m.x0, ...splits, m.x1], walls = [], lanes = [];
    for (let k = 0; k + 1 < ex.length; k++) {
      const a = ex[k] + (k > 0 ? sw / 2 : t), b = ex[k + 1] - (k + 2 < ex.length ? sw / 2 : t);
      const avail = b - a, n = Math.max(1, Math.floor((avail + t) / (can.l + 4 + t)));
      const lw = Math.min(can.l + 10, (avail - (n - 1) * t) / n), used = n * lw + (n - 1) * t, pad = (avail - used) / 2;
      // outer walls absorb the leftover
      let x = a + pad;
      walls.push([k > 0 ? ex[k] - sw / 2 : m.x0, x, k > 0 ? 'split' : 'outer']);
      for (let j = 0; j < n; j++) {
        lanes.push([x, x + lw]);
        x += lw;
        if (j + 1 < n) { walls.push([x, x + t, 'inner']); x += t; }
      }
      if (k + 2 >= ex.length) walls.push([x, m.x1, 'outer']);
      else walls.push([x, ex[k + 1] + sw / 2, 'split']);
    }
    // merge the two halves of a split wall
    const W2 = [];
    for (const w of walls) { const p = W2[W2.length - 1]; if (p && Math.abs(p[1] - w[0]) < 1e-6 && (p[2] === 'split' || w[2] === 'split')) { p[1] = w[1]; p[2] = 'split'; } else W2.push(w.slice()); }
    m.lanes = lanes; m.walls = W2;
  }

  // ---------------------------------------------------------------- keys on every seam
  function seamKeys(P) {
    const { o, mods } = P, keys = [];
    const can = (m, side, axis, s, v) => {
      if (m.keyMode === 'none') return false;
      const pr = padRect(axis, s, v, side, o.gap), bb = T.polysBBox([pr]);
      const pc = m.pieces.find(p => bb.x0 >= p.x0 - 0.02 && bb.x1 <= p.x1 + 0.02 && bb.y0 >= p.y0 - 0.02 && bb.y1 <= p.y1 + 0.02);
      if (!pc) return false;
      if (m.keyMode === 'solid') { const base = baseSolid(P, m); return T.polysArea(T.diffPolys([pr], base)) < 0.5; }
      const ko = keepout(P, m); return !ko.length || T.polysArea(T.interPolys([pr], ko)) < 0.5;
    };
    const place = (A, sa, Bm, sb, axis, s, lo, hi) => {
      const len = hi - lo; if (len < 2 * KEY.b + 12) return;
      const n = Math.max(1, Math.round(len / 120));
      for (let k = 1; k <= n; k++) {
        const t0 = lo + len * k / (n + 1);
        let ok = null;
        for (let d = 0; d <= 60 && ok === null; d += 2) for (const v of d ? [t0 - d, t0 + d] : [t0]) {
          if (v < lo + KEY.b + 6 || v > hi - KEY.b - 6) continue;
          if (can(A, sa, axis, s, v) && (!Bm || can(Bm, sb, axis, s, v)) && !keys.some(q => q.axis === axis && Math.abs(q.s - s) < 0.01 && Math.abs(q.v - v) < 2 * KEY.b + 6)) { ok = v; break; }
        }
        if (ok !== null) keys.push({ axis, s, v: ok, a: A.i, b: Bm ? Bm.i : A.i });
      }
    };
    // between modules (the seam sits halfway in the gap)
    for (const A of mods) for (const Bm of mods) {
      if (A === Bm || A.pieces.length === 0 || Bm.pieces.length === 0) continue;
      if (A.c1 === Bm.c0) { const lo = Math.max(A.sy0, Bm.sy0), hi = Math.min(A.sy1, Bm.sy1); if (hi > lo) place(A, -1, Bm, +1, 'x', A.sx1, Math.max(lo, A.y0, Bm.y0), Math.min(hi, A.y1, Bm.y1)); }
      if (A.r1 === Bm.r0) { const lo = Math.max(A.sx0, Bm.sx0), hi = Math.min(A.sx1, Bm.sx1); if (hi > lo) place(A, -1, Bm, +1, 'y', A.sy1, Math.max(lo, A.x0, Bm.x0), Math.min(hi, A.x1, Bm.x1)); }
    }
    // inside a module: the seams between its pieces
    for (const m of mods) {
      if (!m.pieces || m.pieces.length < 2) continue;
      for (const s of m.xs) place(m, -1, m, +1, 'x', s, m.y0, m.y1);
      for (const s of m.ys) place(m, -1, m, +1, 'y', s, m.x0, m.x1);
    }
    return keys;
  }
  // sockets and pads that land in module m
  function keyBits(P, m, keys) {
    const socks = [], pads = [];
    for (const k of keys) for (const side of [-1, 1]) {
      const pr = padRect(k.axis, k.s, k.v, side, P.o.gap), bb = T.polysBBox([pr]);
      if (bb.x0 < m.x0 - 0.05 || bb.x1 > m.x1 + 0.05 || bb.y0 < m.y0 - 0.05 || bb.y1 > m.y1 + 0.05) continue;
      if (k.a !== m.i && k.b !== m.i) continue;
      socks.push(...keyRects(k.axis, k.s, k.v, side, P.o.keyClear));
      if (m.keyMode === 'pad') pads.push(pr);
    }
    return { socks, pads };
  }
  function withKeys(at, pads, socks) {
    return (z0, z1) => {
      let polys = at(z0, z1);
      if (pads.length && z1 <= PAD_H + 1e-6) polys = T.unionPolys(polys.concat(pads));
      if (socks.length && z1 <= SOCK_D + 1e-6 && polys.length) polys = T.diffPolys(polys, socks);
      return polys;
    };
  }

  // ---------------------------------------------------------------- bins (one closed bin per piece)
  function binSpec(P, m) {
    const t = P.o.wall, f = P.o.floor;
    return { t, f, h: m.h, R: 5 };
  }
  // the front-wall finger notch: half width at height z (an arc 66 mm wide, 22 mm deep)
  function notchHalf(h, z, depth, R) { const zc = h + R - depth; const dz = zc - z; return dz >= R ? 0 : Math.sqrt(R * R - dz * dz); }
  function binModel(P, m, pc, extra) {
    const { o } = P, { t, f, R } = binSpec(P, m), h = m.h, x0 = pc.x0, y0 = pc.y0, x1 = pc.x1, y1 = pc.y1;
    const O = rrP(x0, y0, x1, y1, R), I = rrP(x0 + t, y0 + t, x1 - t, y1 - t, Math.max(0.5, R - t));
    const iw = x1 - x0 - 2 * t, id = y1 - y0 - 2 * t, cx = (x0 + x1) / 2;
    const type = m.type, dz = o.detail === 'draft' ? 2 : 0.5;
    const zs = [0, f, h, PAD_H, SOCK_D];
    const divs = []; // [rect, top]
    let notch = null, label = null, foot = 0, frontLow = 0, produce = false, info = {};
    if (type === 'condiment') {
      frontLow = Math.max(28, 0.38 * h);
      const lanes = Math.max(1, Math.round(iw / 80));
      for (let k = 1; k < lanes; k++) { const x = x0 + t + iw * k / lanes; divs.push([rectP(x - 0.8, y0 + t - 0.01, x + 0.8, y1 - t + 0.01), frontLow]); }
      info.lanes = lanes;
    }
    if (type === 'cups') {
      const cd = clamp(num(m.o.cupD, 95), 40, 160) + 6, nc = Math.max(1, Math.floor(iw / cd)), nr = Math.max(1, Math.floor(id / cd)), dh = Math.max(25, 0.6 * h);
      for (let k = 1; k < nc; k++) { const x = x0 + t + iw * k / nc; divs.push([rectP(x - 0.8, y0 + t - 0.01, x + 0.8, y1 - t + 0.01), dh]); }
      for (let k = 1; k < nr; k++) { const y = y0 + t + id * k / nr; divs.push([rectP(x0 + t - 0.01, y - 0.8, x1 - t + 0.01, y + 0.8), dh]); }
      info.cells = nc * nr;
    }
    if (type === 'butter') {
      const n = Math.max(1, Math.floor(iw / 36));
      for (let k = 1; k < n; k++) { const x = x0 + t + iw * k / n; divs.push([rectP(x - 0.8, y0 + t - 0.01, x + 0.8, y1 - t + 0.01), Math.min(h, 28)]); }
      info.sticks = n;
      if (id < 122) m.warn.push('a stick of butter is about 4\u00be in (121 mm) long; this tray is shorter.');
    }
    if (['deli', 'stack', 'produce'].includes(type) && iw > 90 && h >= 40) notch = { depth: Math.min(22, h * 0.35), R: 36 };
    if (type === 'stack') foot = t + 0.4;
    if (type === 'produce') produce = true;
    if (o.labels && ['bin', 'deli', 'stack', 'produce', 'cups', 'butter', 'condiment'].includes(type) && h >= 40 && iw >= 70 && pc.iy === 0) {
      const lw = Math.min(90, iw * 0.6), lh = 22, top = type === 'condiment' ? frontLow : h;
      if (top >= 40) {
        let lx0 = cx - lw / 2, lx1 = cx + lw / 2;
        if (notch) { const nh = notchHalf(h, h, notch.depth, notch.R); if (type !== 'condiment') { lx0 = cx - lw / 2; lx1 = cx + lw / 2; label = null; } void nh; }
        if (!notch || type === 'condiment') label = { x0: lx0, x1: lx1, zl: top - lh - 2, top };
      }
    }
    if (notch) zs.push(...steps(h - notch.depth, h, dz));
    if (frontLow) zs.push(...steps(frontLow, h, dz));
    if (label) zs.push(label.zl, label.zl + 5);
    if (foot) zs.push(...steps(3, 3 + foot, 0.4));
    if (produce) zs.push(2, 6, 8);
    for (const [, top] of divs) zs.push(top);
    const sideTaper = z => { // condiment: side walls step down toward the front over 60% of the depth
      if (!frontLow || z <= frontLow) return y0;
      return y0 + R + 1 + Math.max(0, (y1 - y0) * 0.6 - R - 1) * clamp((z - frontLow) / (h - frontLow), 0, 1);
    };
    const at = (za, zb) => {
      const zm = zb; const out = [];
      if (zb <= f + 1e-9) {
        if (foot && zb <= 3 + foot + 1e-9) { const ins = zb <= 3 + 1e-9 ? foot : Math.max(0, foot - (zb - 3)); out.push(rrP(x0 + ins, y0 + ins, x1 - ins, y1 - ins, Math.max(0.5, R - ins))); }
        else out.push(O);
        return out;
      }
      let wallsP = T.diffPolys([O], [I]);
      if (foot && zm <= 3 + foot + 1e-9) {
        const ins = zm <= 3 + 1e-9 ? foot : Math.max(0, foot - (zm - 3));
        const Oi = rrP(x0 + ins, y0 + ins, x1 - ins, y1 - ins, Math.max(0.5, R - ins));
        wallsP = T.diffPolys([Oi], [rrP(x0 + Math.max(t, ins + 1.2), y0 + Math.max(t, ins + 1.2), x1 - Math.max(t, ins + 1.2), y1 - Math.max(t, ins + 1.2), 1)]);
        if (zm <= f + 3) wallsP = [Oi]; // the floor inside the foot
      }
      if (produce && zm <= 8 + 1e-9) {
        if (zm <= 2 + 1e-9) wallsP = [O];
        else if (zm <= 6 + 1e-9) { const ribs = []; for (let x = x0 + t - 2 + 24; x < x1 - t - 10; x += 24) ribs.push(rectP(x - 1.2, y0 + 1, x + 1.2, y1 - 1)); wallsP = T.unionPolys(wallsP.concat(T.interPolys(ribs, [I]))); }
        else {
          const slots = []; let row = 0;
          // two slots between each pair of ribs, never over a rib
          for (let y = y0 + t + 10; y + 26 < y1 - t - 6; y += 36, row++) for (let xr = x0 + t - 2; xr < x1 - t; xr += 24) for (const dx of [4, 15]) { const x = xr + dx; if (x > x0 + t + 3 && x + 5 < x1 - t - 3) slots.push(rrP(x, y, x + 5, y + 26, 2.4)); }
          wallsP = T.unionPolys(wallsP.concat(T.diffPolys([I], slots)));
        }
      }
      if (frontLow && zm > frontLow + 1e-9) { // the front (and the front of the sides) is lower
        const yc = sideTaper(zm);
        wallsP = T.diffPolys(wallsP, [rectP(x0 - 1, y0 - 1, x1 + 1, yc)]);
      }
      if (notch) { const hw = notchHalf(h, zm, notch.depth, notch.R); if (hw > 0.05) wallsP = T.diffPolys(wallsP, [rectP(cx - hw, y0 - 1, cx + hw, y0 + t + 0.6)]); }
      if (label && zm <= label.top + 1e-9) {
        const thick = rectP(label.x0 - 3, y0, label.x1 + 3, y0 + 2.2 + t);
        wallsP = T.unionPolys(wallsP.concat(T.interPolys([thick], [O])));
        if (zm > label.zl + 1e-9) {
          wallsP = T.diffPolys(wallsP, [rectP(label.x0, y0 + 1.2, label.x1, y0 + 2.2)]);
          if (zm > label.zl + 5 + 1e-9) wallsP = T.diffPolys(wallsP, [rectP(label.x0 + 3, y0 - 1, label.x1 - 3, y0 + 1.25)]);
        }
      }
      out.push(...wallsP);
      for (const [r, top] of divs) if (zm <= top + 1e-9) out.push(...T.interPolys([r], [I]));
      return out;
    };
    const kb = extra || { pads: [], socks: [] };
    const layers = layersFrom(zs, withKeys(at, kb.pads, kb.socks));
    const p = extrude(layers);
    const pv = [];
    if (type === 'butter') { const n = info.sticks, sw = iw / n; for (let k = 0; k < n; k++) pv.push({ kind: 'stick', x: x0 + t + sw * (k + 0.5), y: (y0 + y1) / 2, z: f, w: Math.min(32, sw - 3), d: Math.min(121, id - 4), h: 32 }); }
    if (type === 'cups') { const cd = clamp(num(m.o.cupD, 95), 40, 160) + 6, nc = Math.max(1, Math.floor(iw / cd)), nr = Math.max(1, Math.floor(id / cd)); for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) pv.push({ kind: 'cup', x: x0 + t + iw * (i + 0.5) / nc, y: y0 + t + id * (j + 0.5) / nr, z: f, r: Math.min(iw / nc, id / nr) / 2 - 5, h: Math.min(h + 10, 70) }); }
    // preview only (never exported): what each bin holds, sized to its slots and the room above the shelf
    const room = Math.max(40, o.shelfH - f - 12);
    if (type === 'condiment') { const n = info.lanes; for (let k = 0; k < n; k++) for (let j = 0; j < Math.max(1, Math.floor(id / 75)); j++) { const x = x0 + t + iw * (k + 0.5) / n, y = y0 + t + 38 + j * 75; pv.push({ kind: 'condiment', style: ['ketchup', 'mayo', 'mustard'][((Math.round(x / 70) + Math.round(y / 75)) % 3 + 3) % 3], x, y, z: f, r: Math.min(30, iw / n / 2 - 4), h: Math.min(room, 195) }); } }
    if (type === 'deli' && iw >= 60 && id >= 60) {
      const pw = Math.min(iw - 10, 170), pd = Math.min(id * 0.5 - 8, 120);
      pv.push({ kind: 'deli', x: cx, y: y0 + t + 6 + pd / 2, z: f, w: pw, d: pd, h: Math.min(Math.max(14, h - 8), 26) });
      if (id - pd - 20 >= 40) pv.push({ kind: 'cheese', x: cx, y: y1 - t - 6 - Math.min(60, id - pd - 26) / 2, z: f, w: Math.min(iw - 16, 110), d: Math.min(60, id - pd - 26), h: Math.min(room, 42) });
    }
    if (type === 'stack' && iw >= 60 && id >= 60) pv.push({ kind: 'tub', x: cx, y: (y0 + y1) / 2, z: f, w: Math.min(iw - 10, 190), d: Math.min(id - 10, 140), h: Math.min(room, Math.max(40, h - 10), 75) });
    if (type === 'bin') {
      const cw = 98, nc = Math.max(1, Math.floor(iw / cw)), nr = Math.max(1, Math.floor(id / cw));
      if (iw >= 75 && id >= 75) { let q = Math.round((x0 + y0) / 41); for (let i = 0; i < Math.min(nc, 3); i++) for (let j = 0; j < Math.min(nr, 2); j++) { const s = Math.min(iw / nc, id / nr, cw) - 8; pv.push({ kind: 'carton', style: ['milk', 'juice'][(q++ % 2 + 2) % 2], x: x0 + t + iw * (i + 0.5) / nc, y: y0 + t + id * (j + 0.5) / nr, z: f, w: s, h: Math.min(room, 250) }); } }
      else if (iw >= 40 && id >= 40) pv.push({ kind: 'drink', x: cx, y: (y0 + y1) / 2, z: f, r: Math.min(32, iw / 2 - 4, id / 2 - 4), h: Math.min(room, 230) });
    }
    if (type === 'produce') { for (let x = x0 + t + 40; x < x1 - t - 30; x += 72) for (let y = y0 + t + 40; y < y1 - t - 30; y += 72) pv.push({ kind: 'fruit', x, y, z: 8, r: 32 }); }
    return { p, info, pv };
  }

  // ---------------------------------------------------------------- egg tray (one tray per piece; stackable)
  // the cup: a straight 21.5 mm radius for the top 9 mm, then a round bottom
  function eggCupR(d) { return d <= 9 ? 21.5 : Math.sqrt(Math.max(0, 21.5 * 21.5 - (d - 9) * (d - 9))); }
  function eggGrid(pc, t, want) {
    const iw = pc.x1 - pc.x0 - 2 * t - 2, id = pc.y1 - pc.y0 - 2 * t - 2, p = EGG.pitch;
    const capC = Math.max(0, Math.floor(iw / p)), capR = Math.max(0, Math.floor(id / p));
    let nc = capC, nr = capR;
    if (want && want < capC * capR) {
      let best = null;
      for (let a = 1; a <= capC; a++) for (let b = 1; b <= capR; b++) if (a * b >= want) { const s = a * b * 10 + Math.abs(a / b - iw / id); if (!best || s < best.s) best = { a, b, s }; }
      if (best) { nc = best.a; nr = best.b; }
    }
    const cx = (pc.x0 + pc.x1) / 2, cy = (pc.y0 + pc.y1) / 2, cups = [];
    for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) cups.push([cx + (i - (nc - 1) / 2) * p, cy + (j - (nr - 1) / 2) * p]);
    return { nc, nr, cups, cap: capC * capR };
  }
  function eggPosts(g) {
    if (g.nc < 2 || g.nr < 2) return [];
    const xs = [...new Set(g.cups.map(c => c[0]))].sort((a, b) => a - b), ys = [...new Set(g.cups.map(c => c[1]))].sort((a, b) => a - b);
    const gx = [(xs[0] + xs[1]) / 2, (xs[xs.length - 2] + xs[xs.length - 1]) / 2], gy = [(ys[0] + ys[1]) / 2, (ys[ys.length - 2] + ys[ys.length - 1]) / 2];
    const out = []; for (const x of gx) for (const y of gy) if (!out.some(q => Math.abs(q[0] - x) < 1 && Math.abs(q[1] - y) < 1)) out.push([x, y]);
    return out;
  }
  function eggPlan(P, m) {
    const t = P.o.wall, want = m.o.count === 'fit' ? 0 : Math.round(num(m.o.count, 12));
    let left = want || Infinity; const per = [];
    for (const pc of m.pieces) {
      const cap = eggGrid(pc, t, 0).cap;
      const take = Math.min(cap, left); left -= take;
      per.push(eggGrid(pc, t, take >= cap ? 0 : take));
    }
    const total = per.reduce((s, g) => s + g.cups.length, 0);
    if (want && total < want) m.warn.push(`room for ${total} eggs, not ${want}. Merge more cells or make the grid cells bigger.`);
    return per;
  }
  function eggModel(P, m, pc, g, kb) {
    const { o } = P, t = o.wall, x0 = pc.x0, y0 = pc.y0, x1 = pc.x1, y1 = pc.y1, H = EGG.H, n = o.detail === 'draft' ? 28 : 48;
    const O = rrP(x0, y0, x1, y1, 5), I = rrP(x0 + t, y0 + t, x1 - t, y1 - t, Math.max(0.5, 5 - t));
    const posts = m.o.stack !== false ? eggPosts(g) : [];
    const topPost = H + EGG.post;
    const dz = o.detail === 'draft' ? 3.5 : 1.5;
    const zs = [0, EGG.ring, H - 9, H - 2, H, EGG.sockH, PAD_H, SOCK_D, ...steps(EGG.ring, H - 9, dz)];
    if (posts.length) zs.push(topPost, topPost + EGG.pinH);
    // support ribs under the deck outside the cup block (the deck never bridges more than about 20 mm)
    let ribs = [];
    if (g.cups.length) {
      const bx0 = Math.min(...g.cups.map(c => c[0])) - 23.6, bx1 = Math.max(...g.cups.map(c => c[0])) + 23.6, by0 = Math.min(...g.cups.map(c => c[1])) - 23.6, by1 = Math.max(...g.cups.map(c => c[1])) + 23.6;
      const out = T.diffPolys([I], [rectP(bx0 + 2, by0 + 2, bx1 - 2, by1 - 2)]);
      if (T.polysArea(out) > 50) {
        const lines = [];
        for (let x = x0 + t + 18; x < x1 - t - 4; x += 20) lines.push(rectP(x - 0.8, y0, x + 0.8, y1));
        for (let y = y0 + t + 18; y < y1 - t - 4; y += 20) lines.push(rectP(x0, y - 0.8, x1, y + 0.8));
        ribs = T.interPolys(lines, out);
      }
    } else ribs = [];
    const at = (za, zb) => {
      const out = [];
      if (zb <= H + 1e-9) {
        out.push(...T.diffPolys([O], [I]));
        const d = H - zb;
        const voids = g.cups.map(([x, y]) => ring(x, y, eggCupR(d), n));
        if (zb <= EGG.ring + 1e-9) { for (const [x, y] of g.cups) out.push(ring(x, y, eggCupR(H - EGG.ring) + EGG.ring, n)); }
        else {
          for (const [x, y] of g.cups) out.push(ring(x, y, eggCupR(d) + EGG.ring, n));
          if (zb > H - 2 + 1e-9) out.push(I);
        }
        out.push(...ribs);
        for (const [x, y] of posts) out.push(ring(x, y, EGG.postR, 40));
        let P2 = T.unionPolys(out);
        if (zb > EGG.ring + 1e-9) P2 = T.diffPolys(P2, voids);
        if (posts.length && zb <= EGG.sockH + 1e-9) P2 = T.diffPolys(P2, posts.map(([x, y]) => ring(x, y, EGG.sockR, 32)));
        return P2;
      }
      if (zb <= topPost + 1e-9) return posts.map(([x, y]) => ring(x, y, EGG.postR, 40));
      return posts.map(([x, y]) => ring(x, y, EGG.pinR, 32));
    };
    const layers = layersFrom(zs, withKeys(at, kb.pads, kb.socks));
    return { p: extrude(layers), posts: posts.length, height: posts.length ? topPost : H };
  }

  // ---------------------------------------------------------------- soda can dispenser (built once, clipped per piece)
  function sodaGeom(P, m) {
    const can = CANS[m.o.can] || CANS['12oz'], L = m.d, A = clamp(num(m.o.slope, 5), 3, 10) * Math.PI / 180, tanA = Math.tan(A);
    const f0 = 7, lipT = 5, lipH = Math.round(0.33 * can.d), backT = 4, trayT = 3, tabH = 6, tabL = 16;
    const zf = y => f0 + y * tanA;
    const g = { can, L, A, tanA, f0, lipT, lipH, backT, trayT, tabH, tabL, zf, loader: !!m.o.loader };
    const guide = 0.55 * can.d;
    if (g.loader) {
      const yF = can.d + 12, yB = L - backT - (can.d + 8);
      if (yB - yF < 1.5 * can.d) { m.warn.push('too short for the top-loading return; built without it.'); g.loader = false; }
      else {
        const zUB = zf(yB) + can.d + 5, zU = y => zUB + (yB - y) * tanA, zBack = zUB + trayT + 0.8 * can.d;
        Object.assign(g, { yF, yB, zU, zBack });
        g.totalH = zU(yF) + trayT + can.d + 3;
        if (g.totalH > P.o.shelfH - 2) m.warn.push(`the top-loading return needs about ${Math.ceil(g.totalH)} mm of height above the shelf; the shelf has ${Math.round(P.o.shelfH)} mm.`);
      }
    }
    if (!g.loader) { g.back = zf(L) + guide; g.top = [[0, zf(0) + guide], [L, zf(L) + guide]]; g.totalH = g.back; }
    return g;
  }
  function sodaTray(P, m, g) { // tray pieces along the slope and the wall tabs that hold them
    const Ls = (g.yB - g.yF) / Math.cos(g.A), B = P.B, maxL = Math.max(B.w, B.d) - 2;
    const n = Math.max(1, Math.ceil(Ls / maxL)), parts = [];
    for (let k = 0; k < n; k++) parts.push({ s0: Ls * k / n + (k ? 0.3 : 0), s1: Ls * (k + 1) / n - (k + 1 < n ? 0.3 : 0) });
    const tabs = [];
    for (const pt of parts) {
      let yc = g.yF + (pt.s0 + pt.s1) / 2 * Math.cos(g.A);
      // keep the tab off the body seams
      for (const s of m.ys) { const ys = s - m.y0; if (Math.abs(ys - yc) < g.tabL / 2 + 4) yc = ys + (yc < ys ? -1 : 1) * (g.tabL / 2 + 4); }
      pt.tab = [yc - g.tabL / 2, yc + g.tabL / 2]; tabs.push(pt.tab);
    }
    return { parts, tabs, Ls };
  }
  function sodaTop(g, tabs) {
    if (!g.loader) return g.top;
    const front = y => g.zf(y) + 0.55 * g.can.d, pts = [[0, front(0)], [g.yF, front(g.yF)], [g.yF, g.zU(g.yF)]];
    const T2 = tabs.slice().sort((a, b) => a[0] - b[0]);
    for (const [a, b] of T2) { pts.push([a, g.zU(a)], [a, g.zU(a) + g.tabH], [b, g.zU(b) + g.tabH], [b, g.zU(b)]); }
    pts.push([g.yB, g.zU(g.yB)], [g.yB, g.zBack], [g.L, g.zBack]);
    return pts;
  }
  function sodaModel(P, m, keys) {
    const { o } = P, g = sodaGeom(P, m), tray = g.loader ? sodaTray(P, m, g) : null;
    const top = sodaTop(g, tray ? tray.tabs : []);
    const back = g.loader ? g.zBack : g.back, lipTop = g.f0 + g.lipH;
    const dz = o.detail === 'draft' ? 2 : 0.25;
    const zmax = Math.max(maxOf(top), back);
    const zs = [0, g.f0, lipTop, back, PAD_H, SOCK_D, ...steps(0, zmax, dz)];
    for (const q of top) zs.push(q[1]);
    const Y = y => m.y0 + y;
    const at = (za, zb) => {
      const out = [];
      // the ramp: solid under the sloped floor
      const yz = zb <= g.f0 ? 0 : (zb - g.f0) / g.tanA;
      if (yz < g.L) out.push(rectP(m.x0, Y(yz), m.x1, m.y1));
      if (zb <= lipTop + 1e-9) out.push(rectP(m.x0, m.y0, m.x1, Y(g.lipT)));
      if (zb <= back + 1e-9) out.push(rectP(m.x0, Y(g.L - g.backT), m.x1, m.y1));
      for (const [a, b] of above(top, zb)) for (const w of m.walls) out.push(rectP(w[0], Y(a), w[1], Y(b)));
      return out;
    };
    const kb = keyBits(P, m, keys);
    const layers = layersFrom(zs, withKeys(at, [], kb.socks));
    const pieces = m.pieces.map(pc => T.withClip([rectP(pc.x0, pc.y0, pc.x1, pc.y1)], () => extrude(layers)));
    // the return tray: flat plates with lane ribs and slots for the wall tabs, laid on the sloped wall tops
    const trays = [];
    if (tray) {
      const groups = [];
      const ex = [m.x0, ...m.xs, m.x1];
      for (let k = 0; k + 1 < ex.length; k++) groups.push([ex[k] + (k ? o.gap / 2 : 0.5), ex[k + 1] - (k + 2 < ex.length ? o.gap / 2 : 0.5)]);
      const t = o.wall, ribH = Math.round(0.45 * g.can.d);
      for (const [gx0, gx1] of groups) {
        const bands = [];
        for (const w of m.walls) {
          if (w[1] < gx0 - 0.1 || w[0] > gx1 + 0.1) continue;
          const lo = Math.max(w[0], gx0), hi = Math.min(w[1], gx1);
          if (w[2] === 'outer') bands.push(lo < m.x0 + 0.1 + (w[1] - w[0]) && w[0] <= m.x0 + 0.01 ? [hi - t, hi] : [lo, lo + t]);
          else if (w[2] === 'split') bands.push(lo > w[0] + 0.01 ? [lo, lo + t] : [hi - t, hi]);
          else bands.push([w[0], w[1]]);
        }
        for (const pt of tray.parts) {
          const sTab = [(pt.tab[0] - g.yF) / Math.cos(g.A), (pt.tab[1] - g.yF) / Math.cos(g.A)];
          const plate = rectP(gx0, pt.s0, gx1, pt.s1);
          const slots = bands.map(([a, b]) => rectP(a - 0.3, sTab[0] - 0.4, b + 0.3, sTab[1] + 0.4));
          const ribs = bands.map(([a, b]) => rectP(Math.max(gx0, a), pt.s0, Math.min(gx1, b), pt.s1));
          const L2 = [{ z0: 0, z1: g.trayT, polys: T.diffPolys([plate], slots) }, { z0: g.trayT, z1: g.tabH + 0.6, polys: T.diffPolys(ribs, slots) }, { z0: g.tabH + 0.6, z1: g.trayT + ribH, polys: ribs }];
          const local = extrude(L2);
          // assembled: tilted down toward the back on the wall tops
          const ca = Math.cos(g.A), sa = Math.sin(g.A), zU0 = g.zU(g.yF), as = new Float64Array(local.length);
          for (let i = 0; i < local.length; i += 3) { const x = local[i], s = local[i + 1], z = local[i + 2]; as[i] = x; as[i + 1] = m.y0 + g.yF + s * ca + z * sa; as[i + 2] = zU0 - s * sa + z * ca; }
          trays.push({ assembled: as, local: toOrigin(local) });
        }
      }
    }
    // cans for the preview
    const pv = [], cd = g.can.d;
    for (const [a, b] of m.lanes) {
      const xc = (a + b) / 2;
      for (let y = g.lipT + cd / 2 + 0.5; y + cd / 2 <= g.L - g.backT - (g.loader ? cd + 8 : 0) + 1e-6; y += cd + 0.5) pv.push({ kind: 'can', x: xc, y: Y(y), z: g.zf(y) + cd / 2, r: cd / 2, len: g.can.l });
      if (g.loader) for (let s = cd / 2 + 6; s + cd / 2 < tray.Ls - 2; s += cd + 0.5) { const y = g.yF + s * Math.cos(g.A); pv.push({ kind: 'can', x: xc, y: Y(y), z: g.zU(y) + g.trayT + cd / 2, r: cd / 2, len: g.can.l }); }
    }
    return { pieces, trays, pv, g, lanes: m.lanes.length, cans: pv.length, height: zmax };
  }

  // ---------------------------------------------------------------- bottle rack (built once, clipped per piece)
  function bottleGeom(P, m) {
    const bD = clamp(num(m.o.bottleD, 80), 50, 130), rc = bD / 2 + 1.5, p = bD + 14;
    const n = Math.max(1, Math.floor((m.w - 12) / p)), cx = (m.x0 + m.x1) / 2;
    const xs = Array.from({ length: n }, (_, k) => cx + (k - (n - 1) / 2) * p);
    const base = 4, zc = base + rc, sTop = base + rc * 0.85, rail = 14, railH = 8, sad = 22;
    const ys = [m.y0, m.y1 - sad]; if (m.d > 300) ys.splice(1, 0, (m.y0 + m.y1) / 2 - sad / 2);
    return { bD, rc, p, n, xs, base, zc, sTop, rail, railH, sad, ys };
  }
  function baseSolid(P, m) {
    if (m.type === 'bottle') {
      const b = bottleGeom(P, m), out = [rectP(m.x0, m.y0, m.x0 + b.rail, m.y1), rectP(m.x1 - b.rail, m.y0, m.x1, m.y1)];
      for (const y of b.ys) out.push(rectP(m.x0, y, m.x1, y + b.sad));
      return T.unionPolys(out);
    }
    if (m.type === 'turntable') { const s = turnGeom(P, m); return [rectP(s.bx0, s.by0, s.bx1, s.by1)]; }
    return [rectP(m.x0, m.y0, m.x1, m.y1)];
  }
  function keepout(P, m) {
    if (m.type !== 'egg') return [];
    if (!m.eggGrids) m.eggGrids = eggPlan(P, m);
    const out = [];
    m.eggGrids.forEach(g => { for (const [x, y] of g.cups) out.push(ring(x, y, 16.5, 24)); for (const [x, y] of (m.o.stack !== false ? eggPosts(g) : [])) out.push(ring(x, y, EGG.postR + 0.5, 16)); });
    // and the seams between egg tray pieces (each piece has its own wall there)
    return out;
  }
  function bottleModel(P, m, keys) {
    const { o } = P, b = bottleGeom(P, m), dz = o.detail === 'draft' ? 2 : 0.6, n = o.detail === 'draft' ? 32 : 72;
    const zs = [0, b.base, b.railH, b.sTop, PAD_H, SOCK_D, ...steps(b.base, b.sTop, dz)];
    const at = (za, zb) => {
      const out = [];
      if (zb <= b.railH + 1e-9) out.push(rectP(m.x0, m.y0, m.x0 + b.rail, m.y1), rectP(m.x1 - b.rail, m.y0, m.x1, m.y1));
      if (zb <= b.sTop + 1e-9) {
        let sad = b.ys.map(y => rrP(m.x0, y, m.x1, y + b.sad, 3));
        if (zb > b.base + 1e-9) {
          const dzc = zb - b.zc, cuts = [];
          const hw = Math.sqrt(Math.max(0, b.rc * b.rc - dzc * dzc));
          if (hw > 0.05) for (const x of b.xs) cuts.push(rectP(x - hw, m.y0 - 1, x + hw, m.y1 + 1));
          if (cuts.length) sad = T.diffPolys(sad, cuts);
        }
        out.push(...sad);
      }
      return out;
    };
    void n;
    const kb = keyBits(P, m, keys);
    const layers = layersFrom(zs, withKeys(at, [], kb.socks));
    const pieces = m.pieces.map(pc => T.withClip([rectP(pc.x0, pc.y0, pc.x1, pc.y1)], () => extrude(layers)));
    const pv = b.xs.map(x => ({ kind: 'bottle', x, y: (m.y0 + m.y1) / 2 - 20, z: b.zc - 1.5, r: b.bD / 2, len: Math.min(320, m.d + 60) }));
    return { pieces, pv, bottles: b.n, height: b.sTop };
  }

  // ---------------------------------------------------------------- turntable: a base with a track and a pivot, and a platter that rides on it
  function turnGeom(P, m) {
    const B = P.B, side = Math.min(m.w, m.d, B.w, B.d), cx = (m.x0 + m.x1) / 2, cy = (m.y0 + m.y1) / 2;
    const bw = Math.min(m.w, B.w, B.d), bd = Math.min(m.d, B.w, B.d);
    const Dp = side - 4, rt = Dp * 0.36;
    return { cx, cy, Dp, rt, bx0: cx - bw / 2, bx1: cx + bw / 2, by0: cy - bd / 2, by1: cy + bd / 2, baseT: 4, trackW: 6, trackH: 4, postR: 6, plT: 6, groove: 3.5, rim: clamp(num(m.o.rim, 15), 0, 60) };
  }
  function turntableModel(P, m, keys) {
    const { o } = P, s = turnGeom(P, m), n = o.detail === 'draft' ? 64 : 180;
    const zTop = s.baseT + s.trackH, postTop = s.baseT + s.trackH - s.groove + 0.5 + s.plT - 1;
    const kb = keyBits(P, m, keys);
    const at = (za, zb) => {
      if (zb <= s.baseT + 1e-9) return [rrP(s.bx0, s.by0, s.bx1, s.by1, 5)];
      const out = [];
      if (zb <= zTop + 1e-9) out.push({ outer: T.circle(s.cx, s.cy, s.rt + s.trackW / 2, n), holes: [T.circle(s.cx, s.cy, s.rt - s.trackW / 2, n).reverse()] });
      if (zb <= postTop + 1e-9) out.push(ring(s.cx, s.cy, s.postR, 48));
      return out;
    };
    const base = extrude(layersFrom([0, s.baseT, zTop, postTop, PAD_H, SOCK_D], withKeys(at, [], kb.socks)));
    const R = s.Dp / 2, gw = s.trackW / 2 + 0.6;
    const disk = { outer: T.circle(0, 0, R, n), holes: [T.circle(0, 0, s.postR + 0.6, 48).reverse()] };
    const groove = { outer: T.circle(0, 0, s.rt + gw, n), holes: [T.circle(0, 0, s.rt - gw, n).reverse()] };
    const L2 = [{ z0: 0, z1: s.groove, polys: T.diffPolys([disk], [groove]) }, { z0: s.groove, z1: s.plT, polys: [disk] }];
    if (s.rim > 0) L2.push({ z0: s.plT, z1: s.plT + s.rim, polys: [{ outer: T.circle(0, 0, R, n), holes: [T.circle(0, 0, R - 3, n).reverse()] }] });
    const platter = extrude(L2);
    const pz = zTop - s.groove + 0.5;
    return { base, platter: { local: toOrigin(platter), assembled: move(platter, s.cx, s.cy, pz) }, height: pz + s.plT + s.rim, g: s,
      pv: [{ kind: 'jar', style: 'pickle', x: s.cx - R * 0.35, y: s.cy, z: pz + s.plT, r: Math.min(32, R * 0.25), h: Math.min(110, o.shelfH - pz - 20) }, { kind: 'jar', style: 'jam', x: s.cx + R * 0.3, y: s.cy + R * 0.2, z: pz + s.plT, r: Math.min(26, R * 0.2), h: Math.min(90, o.shelfH - pz - 20) },
        { kind: 'sauce', x: s.cx + R * 0.05, y: s.cy - R * 0.5, z: pz + s.plT, r: Math.min(18, R * 0.14), h: Math.min(150, o.shelfH - pz - 20) }] };
  }

  // ---------------------------------------------------------------- build
  function build(raw) {
    const o = options(raw), P = plan(Object.assign(o, { _planned: true })), warnings = P.warnings;
    const keys = seamKeys(P), parts = [], previews = [];
    const cx = 0, cy = 0;
    const dirOf = (x, y, up) => { const L = Math.hypot(x - cx, y - cy) || 1; return [(x - cx) / L * 0.45, (y - cy) / L * 0.45, up || 0.15]; };
    let eggs = 0, cans = 0, lanes = 0, bottles = 0, maxH = 0;
    const modInfo = [];
    for (const m of P.mods) {
      const name = TYPES[m.type].name, label = `${TYPES[m.type].short || name} ${m.i + 1}`;
      const info = { i: m.i, type: m.type, name, w: Math.round(m.w), d: Math.round(m.d), h: 0, pieces: m.pieces.length, warn: m.warn.slice() };
      modInfo.push(info);
      if (m.type === 'empty') continue;
      const pieceName = (k, n) => n > 1 ? `${name} ${m.i + 1}${String.fromCharCode(97 + k)}` : `${name} ${m.i + 1}`;
      const add = (pt) => { parts.push(Object.assign({ module: m.i, color: o.colors.body, spread: 0.3 }, pt)); };
      if (m.type === 'soda') {
        const r = sodaModel(P, m, keys);
        r.pieces.forEach((p, k) => { const b = Core.bbox(p); add({ name: pieceName(k, r.pieces.length), kind: 'soda', label, p, assembled: p, local: toOrigin(p), dir: dirOf((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2) }); });
        r.trays.forEach((t2, k) => add({ name: `Return tray ${m.i + 1}${r.trays.length > 1 ? String.fromCharCode(97 + k) : ''}`, kind: 'tray', label: 'Tray', color: o.colors.accent, p: t2.assembled, assembled: t2.assembled, local: t2.local, dir: [0, 0, 0.9], spread: 0.5 }));
        previews.push(...r.pv); cans += r.cans; lanes += r.lanes; info.h = Math.round(r.height); info.lanes = r.lanes; info.cans = r.cans; info.loader = r.g.loader;
        maxH = Math.max(maxH, r.height);
        if (r.height > P.B.z) warnings.push(`${name} ${m.i + 1}: ${Math.ceil(r.height)} mm tall, more than this printer's ${Math.round(P.B.z)} mm.`);
        continue;
      }
      if (m.type === 'bottle') {
        const r = bottleModel(P, m, keys);
        r.pieces.forEach((p, k) => { const b = Core.bbox(p); add({ name: pieceName(k, r.pieces.length), kind: 'bottle', label, p, assembled: p, local: toOrigin(p), dir: dirOf((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2) }); });
        previews.push(...r.pv); bottles += r.bottles; info.h = Math.round(r.height); info.bottles = r.bottles; maxH = Math.max(maxH, r.height);
        continue;
      }
      if (m.type === 'turntable') {
        const r = turntableModel(P, m, keys);
        add({ name: `Turntable base ${m.i + 1}`, kind: 'turnbase', label, p: r.base, assembled: r.base, local: toOrigin(r.base), dir: dirOf(r.g.cx, r.g.cy) });
        add({ name: `Turntable platter ${m.i + 1}`, kind: 'platter', label: 'Platter', color: o.colors.accent, p: r.platter.assembled, assembled: r.platter.assembled, local: r.platter.local, dir: [0, 0, 1], spread: 0.6 });
        previews.push(...r.pv); info.h = Math.round(r.height); info.diameter = Math.round(r.g.Dp); maxH = Math.max(maxH, r.height);
        if (r.g.Dp + 4 < Math.min(m.w, m.d) - 1) warnings.push(`Turntable ${m.i + 1}: the platter is ${Math.round(r.g.Dp)} mm across to fit the printer.`);
        continue;
      }
      if (m.type === 'egg') {
        const grids = m.eggGrids || (m.eggGrids = eggPlan(P, m));
        m.pieces.forEach((pc, k) => {
          const kb = keyBits(P, Object.assign({}, m, { x0: pc.x0, y0: pc.y0, x1: pc.x1, y1: pc.y1 }), keys);
          const r = eggModel(P, m, pc, grids[k], kb);
          const trays = Math.round(clamp(num(m.o.trays, 1), 1, 4));
          for (let s = 0; s < (m.o.stack !== false ? trays : 1); s++) {
            const as = s ? move(r.p, 0, 0, s * (EGG.H + EGG.post)) : r.p;
            add({ name: pieceName(k, m.pieces.length) + (s ? ` (stack ${s + 1})` : ''), kind: 'egg', label, p: as, assembled: as, local: toOrigin(r.p), dir: dirOf((pc.x0 + pc.x1) / 2, (pc.y0 + pc.y1) / 2, 0.15 + 0.5 * s), copyOf: s ? pieceName(k, m.pieces.length) : null });
            for (const [x, y] of grids[k].cups) previews.push({ kind: 'egg', x, y, z: s * (EGG.H + EGG.post) + EGG.H - 13 });
          }
          eggs += grids[k].cups.length * (m.o.stack !== false ? trays : 1);
          info.h = Math.round(r.height); maxH = Math.max(maxH, r.height);
        });
        info.eggs = grids.reduce((s, g) => s + g.cups.length, 0); info.grid = grids.map(g => `${g.nc} \u00d7 ${g.nr}`).join(' + ');
        continue;
      }
      // bins
      m.pieces.forEach((pc, k) => {
        const kb = keyBits(P, Object.assign({}, m, { x0: pc.x0, y0: pc.y0, x1: pc.x1, y1: pc.y1 }), keys);
        const r = binModel(P, m, pc, kb);
        add({ name: pieceName(k, m.pieces.length), kind: m.type, label, p: r.p, assembled: r.p, local: toOrigin(r.p), dir: dirOf((pc.x0 + pc.x1) / 2, (pc.y0 + pc.y1) / 2) });
        previews.push(...r.pv); Object.assign(info, r.info);
      });
      for (const w of m.warn) if (!info.warn.includes(w)) { info.warn.push(w); warnings.push(`${m.i + 1}. ${name}: ${w}`); }
      info.h = Math.round(m.h); maxH = Math.max(maxH, m.h);
    }
    // keys
    const keyLocal = keys.length ? keyMesh(o) : null;
    keys.forEach((k, i) => {
      let p = move(keyLocal, 0, 0, 0);
      if (k.axis === 'y') p = rotZ90(p);
      // center the key on the seam
      const b = Core.bbox(p), cxk = (b.min[0] + b.max[0]) / 2, cyk = (b.min[1] + b.max[1]) / 2;
      const a = k.axis === 'x' ? move(p, k.s - cxk, k.v - cyk, 0) : move(p, k.v - cxk, k.s - cyk, 0);
      parts.push({ name: `Connector key ${i + 1}`, kind: 'key', label: 'Key', module: -1, color: o.colors.accent, p: a, assembled: a, local: toOrigin(keyLocal), dir: [0, 0, -0.6], spread: 0.6 });
    });
    const all = parts.length ? T.concat(parts.map(p => p.assembled)) : new Float64Array(0);
    let plates = 0, unfit = [];
    if (PL && PL.arrange && parts.length) {
      try { const A = PL.arrange(printList(parts), P.B.w, P.B.d, { gap: 5, maxZ: P.B.z }); plates = A.plates.length; unfit = A.unfit.map(u => u.name); } catch (_) {}
    }
    if (unfit.length) warnings.push(`Too big for this plate: ${unfit.slice(0, 4).join(', ')}${unfit.length > 4 ? '\u2026' : ''}.`);
    if (maxH > P.Havail + 1e-6) warnings.push(`The tallest piece is ${Math.ceil(maxH)} mm; the shelf has ${Math.round(o.shelfH)} mm of room.`);
    const filaments = [{ role: 'organizer', color: o.colors.body }];
    if (String(o.colors.accent).toUpperCase() !== String(o.colors.body).toUpperCase()) filaments.push({ role: 'keys and trays', color: o.colors.accent });
    const used = P.mods.filter(m => m.type !== 'empty');
    return {
      parts, options: o, plan: P, warnings, filaments, keys, modules: modInfo,
      preview: { shelf: [o.shelfW, o.shelfD, o.shelfH], items: previews },
      stats: {
        shelfW: o.shelfW, shelfD: o.shelfD, shelfH: o.shelfH, cols: o.cols, rows: o.rows,
        modules: used.length, pieces: parts.filter(p => p.kind !== 'key' && !p.copyOf).length, keys: keys.length, plates,
        eggs, cans, lanes, bottles, maxH: Math.round(maxH), tris: all.length / 9, parts: parts.length,
        turntables: used.filter(m => m.type === 'turntable').length, loaders: used.filter(m => m.type === 'soda' && m.o.loader).length
      },
      plate: all, assembled: all
    };
  }
  // the parts to print: one of each copy (stacked egg trays print as separate copies, so they stay)
  function printList(parts) { return parts.map(pt => ({ name: pt.name, p: pt.local, color: pt.color })); }

  function writeOBJ(p, name) {
    const { V, F } = Core.weld(p);
    let s = `# Expressarte\no ${String(name || 'part').replace(/\s+/g, '_')}\n`;
    for (let i = 0; i < V.length; i += 3) s += `v ${V[i]} ${V[i + 1]} ${V[i + 2]}\n`;
    for (let i = 0; i < F.length; i += 3) s += `f ${F[i] + 1} ${F[i + 1] + 1} ${F[i + 2] + 1}\n`;
    return new TextEncoder().encode(s);
  }
  function export3MF(res, o) {
    o = o || {};
    const cols = [];
    res.parts.forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const ext = c => cols.indexOf((c || '').toUpperCase()) + 1;
    const B = usableBed(res.options.bed);
    const A = PL.arrange(printList(res.parts), B.w, B.d, { gap: 5, maxZ: B.z });
    const objs = [], plates = [];
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, p: it.p, color: it.color, extruder: ext(it.color) }); }); plates.push(ids); });
    for (const u of A.unfit) { objs.push({ name: u.name, p: u.p, color: u.color, extruder: ext(u.color) }); plates.push([objs.length - 1]); }
    return T.threeMF(objs, { title: o.name || 'Refrigerator organizer', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function files(res, o) {
    o = o || {};
    const base = o.fileBase || 'fridge_organizer', out = [];
    const slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    let keyN = 0, keyPart = null;
    const copies = new Map();
    for (const pt of res.parts) if (pt.copyOf) copies.set(pt.copyOf, (copies.get(pt.copyOf) || 1) + 1);
    for (const pt of res.parts) {
      if (pt.kind === 'key') { keyN++; keyPart = pt; continue; }
      if (pt.copyOf) continue;
      const n = copies.get(pt.name) || 1;
      out.push({ name: `${base}_${slug(pt.name)}${n > 1 ? `_print_${n}` : ''}.stl`, data: new Uint8Array(Core.writeSTL(pt.local, pt.name)) });
    }
    if (keyPart) {
      out.push({ name: `${base}_connector_key_print_${keyN}.stl`, data: new Uint8Array(Core.writeSTL(keyPart.local, 'connector key')) });
      out.push({ name: `${base}_connector_key_print_${keyN}.obj`, data: writeOBJ(keyPart.local, 'connector key') });
    }
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    const s = res.stats, L = [];
    const inch = v => (v / IN).toFixed(1).replace(/\.0$/, '') + ' in';
    L.push('Expressarte refrigerator organizer', '',
      `Shelf: ${s.shelfW} \u00d7 ${s.shelfD} mm, ${s.shelfH} mm of height (${inch(s.shelfW)} \u00d7 ${inch(s.shelfD)}, ${inch(s.shelfH)})`,
      `Grid: ${s.cols} \u00d7 ${s.rows} cells, ${s.modules} modules, ${s.pieces} printed pieces, ${s.keys} connector keys`, '', 'Modules');
    for (const m of res.modules) if (m.type !== 'empty') L.push(`  ${m.i + 1}. ${m.name}: ${m.w} \u00d7 ${m.d} mm${m.h ? `, ${m.h} mm tall` : ''}${m.pieces > 1 ? `, in ${m.pieces} pieces` : ''}${m.eggs ? `, ${m.eggs} eggs (${m.grid})` : ''}${m.lanes ? `, ${m.lanes} lane${m.lanes > 1 ? 's' : ''}, about ${m.cans} cans${m.loader ? ' with the top-loading return' : ''}` : ''}${m.bottles ? `, ${m.bottles} bottles` : ''}`);
    L.push('', 'Printing',
      '  - Print in PETG for the fridge: it handles cold and damp and wipes clean. Use a food-contact-rated filament and a stainless nozzle if food touches the plastic directly, and wash parts by hand (not in the dishwasher).',
      '  - Every piece prints upright as it sits on the shelf, with no supports. 2 to 3 walls and 10 to 15% infill are plenty; the can dispenser ramp is mostly infill inside.',
      '  - Connector keys print flat. Return trays print flat, ribs up. The turntable platter prints with its rim up.',
      '', 'Assembly',
      '  - Set the pieces on the shelf front row first. Tip two neighbors up, press a connector key into the sockets under their floors where they meet, and set them down; repeat along every seam.',
      '  - Stack egg trays on their corner posts. Stackable bins nest on top of each other and lift out.',
      '  - Can dispenser: load cans at the back (or on the top tray, which rolls them to the back and down into the lower lane); take them from the front.',
      ...(res.warnings || []).map(w => '  - ' + w));
    out.push({ name: `${base}_NOTES.txt`, data: new TextEncoder().encode(L.join('\n') + '\n') });
    return out;
  }
  function gateInfo(raw, res) {
    const o = options(raw), why = [];
    const used = o.modules.filter(m => m.type !== 'empty');
    if (used.length > FREE_MAX_MODULES) why.push(`${used.length} modules (free: up to ${FREE_MAX_MODULES})`);
    if (used.some(m => m.type === 'soda' && m.o.loader)) why.push('top-loading can return (Pro)');
    if (used.some(m => m.type === 'turntable')) why.push('turntable (Pro)');
    if (o.labels) why.push('label slots (Pro)');
    void res;
    return why;
  }

  const api = { DEFAULTS, TYPES, TYPE_ORDER, MOD_DEFAULTS, PRESETS, CANS, PALETTE, KEY, EGG, SOCK_D, PAD_H, FREE_MAX_MODULES,
    options, plan, build, files, export3MF, gateInfo, usableBed, defaultLayout, normLayout, autoGrid, eggCupR, above, fitsBed, writeOBJ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPFridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
