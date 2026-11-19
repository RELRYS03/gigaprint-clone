// Stackable cabinet organizer (backer-exclusive): enter a cabinet's inside size, door hinge clearance, face-frame lip,
// an optional sink-pipe cutout and blind corner, and it fills the space with interlocking modules that fit:
//  - stackable open-front bins (a nesting foot locks into the bin below), with optional patterned lids and knobs
//  - pull-out drawer units (a drawer in a sleeve; sleeves stack on pins), split front to back to fit the bed
//  - shelf risers (printed upside down, stacked with loose pins) and step shelves for jars and spices
//  - blind-corner pull-out sleds or step shelves instead of a lazy Susan
// Label fronts are flush color inlays; lid and drawer-front patterns and knobs reuse the cubby lid designs.
// Every part fits the printer bed; long parts split with pin seams (1.75 mm filament pins). Colored 3MF.
(function (G) {
  'use strict';
  const C = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const CBm = () => G.GPCubbies || (typeof require === 'function' ? require('./cubbies.js') : null);
  const H = () => CBm().helpers;
  const FEATURE = 'cabinet', LID_FEATURE = 'cubby-lids';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => { const n = +v; return Number.isFinite(n) && v !== '' && v != null ? n : d; };
  const hex = (v, d) => /^#[0-9a-f]{6}$/i.test(v || '') ? String(v).toUpperCase() : d;
  const P = L => ({ outer: L, holes: [] });
  const R = (x0, y0, x1, y1) => P([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

  const FILLS = { bins: 'Stackable bins', drawers: 'Pull-out drawers', risers: 'Shelf risers', steps: 'Step shelves', none: 'Leave empty' };
  const CORNERS = { sleds: 'Pull-out corner sleds', steps: 'Step shelves', none: 'Leave empty' };
  const HINGES = { both: 'Both sides (double doors)', left: 'Left side', right: 'Right side', none: 'None in the way' };
  const LIDS = { none: 'No lids', top: 'Top bin of each stack', all: 'Every bin' };
  const KNOB_H = { round: 11, mushroom: 12, square: 10, tbar: 13, bar: 20, arch: 16, notch: 0 };
  // Cabinet types people organize most (pull-outs, stackable risers and bins, under-sink U shapes around the pipes,
  // blind-corner pull-outs instead of a lazy Susan, step shelves for spices).
  const PRESETS = {
    pantry: { label: 'Pantry or upper cabinet: stackable bins', w: 760, d: 300, h: 330, hingeSide: 'both', fill: 'bins', binW: 140, binH: 105, labels: 'PASTA, RICE, SNACKS, BAKING, TEA, CEREAL, SAUCES, CANS, SPICES, KIDS' },
    dishes: { label: 'Upper cabinet: shelf risers for dishes', w: 760, d: 300, h: 290, hingeSide: 'both', fill: 'risers', riserH: 130, labels: 'PLATES, BOWLS, MUGS, GLASSES' },
    spices: { label: 'Narrow upper cabinet: step shelves for spices', w: 380, d: 300, h: 280, hingeSide: 'left', fill: 'steps', stepRise: 38, stepTiers: 3, labels: 'SPICES, OILS' },
    base: { label: 'Base cabinet: pull-out drawers', w: 560, d: 520, h: 330, hingeSide: 'right', fill: 'drawers', drawerH: 100, labels: 'FOIL AND WRAP, BAGS, CONTAINERS, LIDS, TOWELS, BAKING' },
    sink: { label: 'Under the kitchen sink: U shape around the pipes', w: 760, d: 520, h: 460, hingeSide: 'both', pipe: true, pipeX: 380, pipeW: 240, pipeD: 230, sideFill: 'drawers', frontFill: 'bins', drawerH: 110, binH: 90, labels: 'SPONGES, SPRAYS, BAGS, CLOTHS, GLOVES, BRUSHES, DISH SOAP, PODS' },
    vanity: { label: 'Bathroom vanity: bins around the drain', w: 560, d: 430, h: 480, hingeSide: 'both', pipe: true, pipeX: 280, pipeW: 190, pipeD: 170, sideFill: 'bins', frontFill: 'steps', binW: 160, binH: 110, stepRise: 40, labels: 'HAIR, TOWELS, SOAP, FIRST AID, CLEANERS, TISSUES, SHAVING, TRAVEL' },
    corner: { label: 'Blind corner base cabinet: pull-out sleds', w: 1000, d: 560, h: 330, hingeSide: 'right', corner: 'sleds', cornerSide: 'left', blindW: 420, fill: 'drawers', drawerH: 105, labels: 'POTS, PANS, LIDS, TRAYS, MIXING BOWLS, APPLIANCES' }
  };
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    w: 760, d: 300, h: 330, lip: 20, hinge: 22, hingeSide: 'both', doorGap: 15, backGap: 5, topGap: 15,
    pipe: false, pipeX: 380, pipeW: 240, pipeD: 230,
    corner: 'none', cornerSide: 'left', blindW: 400,
    fill: 'bins', sideFill: 'drawers', frontFill: 'bins', gap: 3,
    binW: 150, binH: 105, drawerH: 100, riserH: 130, stepRise: 38, stepTiers: 3, maxStack: 4, sledH: 70,
    labels: '', labelStyle: 'inlay', font: 'block', labelSize: 9,
    lids: 'none', lidPattern: 'none', patternScale: 14, frontPattern: false, knob: 'round',
    unitColor: PZ.cream, frontColor: PZ.babyBlue, labelColor: '#2B2D31', lidColor: PZ.mint, patternColor: PZ.lavender, patternColor2: PZ.butter, knobColor: '#2B2D31',
    bed: [256, 256, 256], bambu: 'A1'
  };
  const COLOR_KEYS = ['unitColor', 'frontColor', 'labelColor', 'lidColor', 'patternColor', 'patternColor2', 'knobColor'];

  function options(raw) {
    raw = raw || {};
    const o = Object.assign({}, DEFAULTS);
    if (raw.preset && PRESETS[raw.preset]) { const pr = PRESETS[raw.preset]; for (const k of Object.keys(pr)) if (k !== 'label') o[k] = pr[k]; }
    for (const [k, v] of Object.entries(raw)) if (v !== undefined && k !== 'preset') o[k] = v;
    o.preset = PRESETS[raw.preset] ? raw.preset : null;
    o.w = clamp(num(o.w, 760), 150, 2400); o.d = clamp(num(o.d, 300), 100, 900); o.h = clamp(num(o.h, 330), 60, 1500);
    o.lip = clamp(num(o.lip, 20), 0, 100); o.hinge = clamp(num(o.hinge, 22), 0, 80); o.hingeSide = HINGES[o.hingeSide] ? o.hingeSide : 'both';
    o.doorGap = clamp(num(o.doorGap, 15), 0, 120); o.backGap = clamp(num(o.backGap, 5), 0, 120); o.topGap = clamp(num(o.topGap, 15), 0, 200);
    o.pipe = !!o.pipe; o.pipeW = clamp(num(o.pipeW, 240), 40, o.w); o.pipeX = clamp(num(o.pipeX, o.w / 2), 0, o.w); o.pipeD = clamp(num(o.pipeD, 230), 30, o.d);
    o.corner = CORNERS[o.corner] && o.corner !== 'none' ? o.corner : 'none'; o.cornerSide = o.cornerSide === 'right' ? 'right' : 'left'; o.blindW = clamp(num(o.blindW, 400), 100, o.w - 150);
    for (const k of ['fill', 'sideFill', 'frontFill']) o[k] = FILLS[o[k]] ? o[k] : 'bins';
    o.gap = clamp(num(o.gap, 3), 1, 30);
    o.binW = clamp(num(o.binW, 150), 60, 400); o.binH = clamp(num(o.binH, 105), 30, 400); o.drawerH = clamp(num(o.drawerH, 100), 50, 300); o.riserH = clamp(num(o.riserH, 130), 50, 400);
    o.stepRise = clamp(num(o.stepRise, 38), 15, 80); o.stepTiers = Math.round(clamp(num(o.stepTiers, 3), 2, 5)); o.maxStack = Math.round(clamp(num(o.maxStack, 4), 1, 8)); o.sledH = clamp(num(o.sledH, 70), 30, 200);
    o.labels = String(o.labels || '').slice(0, 600); o.labelStyle = o.labelStyle === 'none' ? 'none' : 'inlay';
    o.font = ['block', 'slab', 'round', 'chunky'].includes(o.font) ? o.font : 'block'; o.labelSize = clamp(num(o.labelSize, 9), 4, 20);
    const CB = CBm();
    o.lids = LIDS[o.lids] ? o.lids : 'none'; o.lidPattern = CB.PATTERNS[o.lidPattern] ? o.lidPattern : 'none'; o.patternScale = clamp(num(o.patternScale, 14), 5, 60);
    o.frontPattern = !!o.frontPattern; o.knob = CB.KNOBS[o.knob] ? o.knob : 'round';
    for (const k of COLOR_KEYS) o[k] = hex(o[k], DEFAULTS[k]);
    o.bed = Array.isArray(o.bed) ? o.bed.map(Number) : [256, 256, 256];
    return o;
  }
  const usable = o => ({ w: Math.max(60, o.bed[0] - 8), d: Math.max(60, o.bed[1] - 8), z: Math.max(40, o.bed[2] - 4) });
  const labelList = o => o.labels.split(/[,\n;]+/).map(s => s.trim().toUpperCase().slice(0, 18)).filter(Boolean);

  // ------------------------------------------------------------------ layout: zones, then modules in each zone
  function zones(o) {
    const out = [], warnings = [];
    const hl = ['left', 'both'].includes(o.hingeSide) ? o.hinge : 0, hr = ['right', 'both'].includes(o.hingeSide) ? o.hinge : 0;
    let xa = o.lip + hl, xb = o.w - o.lip - hr;
    const ya = o.doorGap, yb = o.d - o.backGap, zH = o.h - o.topGap;
    if (o.corner !== 'none') {
      const grab = 60;
      if (o.cornerSide === 'left') { out.push({ id: 'corner', name: 'Blind corner', x0: 3, x1: Math.min(o.blindW + grab, xb - 60), y0: ya, y1: yb, fill: o.corner, corner: true }); xa = Math.max(xa, out[0].x1 + o.gap + hl); }
      else { out.push({ id: 'corner', name: 'Blind corner', x0: Math.max(o.w - o.blindW - grab, xa + 60), x1: o.w - 3, y0: ya, y1: yb, fill: o.corner, corner: true }); xb = Math.min(xb, out[0].x0 - o.gap - hr); }
    }
    if (o.pipe) {
      const p0 = o.pipeX - o.pipeW / 2 - 10, p1 = o.pipeX + o.pipeW / 2 + 10, py = o.d - o.pipeD - 10;
      if (p0 - xa >= 60) out.push({ id: 'left', name: 'Left of the pipes', x0: xa, x1: Math.min(xb, p0), y0: ya, y1: yb, fill: o.sideFill });
      if (xb - p1 >= 60) out.push({ id: 'right', name: 'Right of the pipes', x0: Math.max(xa, p1), x1: xb, y0: ya, y1: yb, fill: o.sideFill });
      const f0 = Math.max(xa, p0 + (p0 - xa >= 60 ? o.gap : 0)), f1 = Math.min(xb, p1 - (xb - p1 >= 60 ? o.gap : 0));
      if (f1 - f0 >= 60 && py - ya >= 60) out.push({ id: 'front', name: 'In front of the pipes', x0: p0 - xa >= 60 ? Math.max(f0, p0) : f0, x1: xb - p1 >= 60 ? Math.min(f1, p1) : f1, y0: ya, y1: py, fill: o.frontFill });
      if (py - ya < 60) warnings.push('The pipes reach almost to the door, so nothing fits in front of them.');
    } else if (xb - xa >= 60) out.push({ id: 'main', name: 'Cabinet', x0: xa, x1: xb, y0: ya, y1: yb, fill: o.fill });
    if (xb - xa < 60) warnings.push('The opening is too narrow after the hinge clearance and face-frame lip. Check the measurements.');
    for (const z of out) z.zH = zH;
    return { zones: out, warnings, opening: [xa, xb], hinge: [hl, hr] };
  }
  function split(len, max, gap) { const n = Math.max(1, Math.ceil((len + gap) / (max + gap))); const w = (len - (n - 1) * gap) / n; return Array.from({ length: n }, (_, i) => ({ a: i * (w + gap), w })); }
  function layout(o) {
    const Ub = usable(o), Z = zones(o), units = [], warnings = Z.warnings.slice();
    const lidH = o.lids !== 'none' ? 2.4 + (KNOB_H[o.knob] || 0) + 2 : 0;
    for (const z of Z.zones) {
      const rw = z.x1 - z.x0, rd = z.y1 - z.y0, H0 = z.zH, t = z.fill;
      if (t === 'none') continue;
      const add = (u) => units.push(Object.assign({ zone: z.id }, u));
      if (z.corner && t === 'sleds') {   // long trays that slide sideways out of the blind corner
        const rows = split(rd, Math.min(Ub.d, 160), o.gap), sh = Math.min(o.sledH, H0, Ub.z);
        rows.forEach((r, j) => add({ type: 'sled', x: z.x0, y: z.y0 + r.a, z: 0, w: rw, d: r.w, h: sh, row: j, level: 0, handle: o.cornerSide === 'left' ? 'right' : 'left' }));
        continue;
      }
      if (t === 'bins') {
        const cols = split(rw, Math.min(Ub.w, o.binW), o.gap), rows = split(rd, Ub.d, o.gap);
        let bh = Math.min(o.binH, Ub.z), k = Math.floor((H0 - lidH - 4) / (bh - 4));
        if (k < 1) { bh = Math.max(30, Math.min(Ub.z, H0 - lidH)); k = 1; if (H0 - lidH < 30) { warnings.push(`${z.name}: not enough height for bins.`); continue; } }
        k = Math.min(k, o.maxStack);
        rows.forEach((r, j) => cols.forEach((c, i) => { for (let l = 0; l < k; l++) add({ type: 'bin', x: z.x0 + c.a, y: z.y0 + r.a, z: l * (bh - 4), w: c.w, d: r.w, h: bh, row: j, col: i, level: l, top: l === k - 1 }); }));
      } else if (t === 'drawers') {
        const cols = split(rw, Math.min(Ub.w, 300), o.gap);
        let dh = Math.min(o.drawerH, Ub.z), k = Math.floor((H0 - 3.5) / dh);
        if (k < 1) { dh = Math.min(Ub.z, H0 - 3.5); k = 1; if (dh < 50) { warnings.push(`${z.name}: not enough height for drawers.`); continue; } }
        k = Math.min(k, o.maxStack);
        cols.forEach((c, i) => { for (let l = 0; l < k; l++) add({ type: 'drawer', x: z.x0 + c.a, y: z.y0, z: l * dh, w: c.w, d: rd, h: dh, row: 0, col: i, level: l, top: l === k - 1 }); });
      } else if (t === 'risers') {
        const cols = split(rw, Math.min(Ub.w, 320), o.gap), rows = split(rd, Ub.d, o.gap);
        let rh = Math.min(o.riserH, Ub.z), k = Math.min(2, o.maxStack, Math.floor(H0 / rh));
        if (k < 1) { rh = Math.min(Ub.z, H0); k = 1; if (rh < 50) { warnings.push(`${z.name}: not enough height for shelf risers.`); continue; } }
        rows.forEach((r, j) => cols.forEach((c, i) => { for (let l = 0; l < k; l++) add({ type: 'riser', x: z.x0 + c.a, y: z.y0 + r.a, z: l * rh, w: c.w, d: r.w, h: rh, row: j, col: i, level: l, top: l === k - 1, stack: k }); }));
      } else if (t === 'steps' || t === 'sleds') {
        const cols = split(rw, Ub.w, o.gap), dd = Math.min(rd, Ub.d, o.stepTiers * 90);
        let n = o.stepTiers, rise = o.stepRise; while (n * rise + 4 > Math.min(H0, Ub.z) && n > 2) n--; if (n * rise + 4 > Math.min(H0, Ub.z)) rise = Math.max(15, (Math.min(H0, Ub.z) - 4) / n);
        cols.forEach((c, i) => add({ type: 'steps', x: z.x0 + c.a, y: z.y0, z: 0, w: c.w, d: dd, h: n * rise + 4, tiers: n, rise, row: 0, col: i, level: 0 }));
        if (rd - dd > 80 && !z.corner) warnings.push(`${z.name}: the step shelves leave ${Math.round(rd - dd)} mm free behind them.`);
      }
    }
    // labels: front row first, left to right, bottom to top
    const L = labelList(o); let li = 0;
    const order = units.map((u, i) => i).sort((a, b) => (units[a].row - units[b].row) || (units[a].x - units[b].x) || (units[a].level - units[b].level));
    for (const i of order) { const u = units[i]; u.label = o.labelStyle === 'none' ? '' : (L[li++] || ''); }
    for (const u of units) u.lid = u.type === 'bin' && (o.lids === 'all' || (o.lids === 'top' && u.top));
    return { units, zones: Z.zones, opening: Z.opening, hinge: Z.hinge, warnings };
  }

  // ------------------------------------------------------------------ geometry helpers
  const del = (...ms) => ms.forEach(m => m && m.delete && m.delete());
  const box = (M, x0, y0, z0, x1, y1, z1) => M.Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0]);
  const tx = (m, f) => { const r = f(m); m.delete(); return r; };
  // 2D outlines drawn in (x, z) become a solid between y0 and y1 (front faces)
  const faceSolid = (M, polys, y0, y1) => { const m = H().ext(M, polys, 0, y1 - y0); return m ? tx(m, a => a.rotate([90, 0, 0]).translate([0, y1, 0])) : null; };
  // 2D outlines drawn in (y, z) become a solid between x0 and x1 (side faces)
  const sideSolid = (M, polys, x0, x1) => { const m = H().ext(M, polys, 0, x1 - x0); return m ? tx(m, a => a.rotate([90, 0, 90]).translate([x0, 0, 0])) : null; };
  const U = (M, list) => H().unionAll(M, list.filter(Boolean));
  const sub = (M, a, b) => (b ? H().cut(M, a, b) : a);
  const pinHole = (M, axis, cx, cy, cz) => { const c = M.Manifold.cylinder(16, 0.95, 0.95, 16).translate([0, 0, -8]); return tx(c, m => (axis === 'y' ? m.rotate([90, 0, 0]) : axis === 'x' ? m.rotate([0, 90, 0]) : m).translate([cx, cy, cz])); };
  function labelAt(o, text, cx, cy, maxW, size) { return text && o.labelStyle !== 'none' ? H().labelPolys({ labels: 'inlay', font: o.font, labelSize: size }, text, cx, cy, maxW) : []; }
  function inlayFront(M, cuts, colors, role, polys, y0) { if (!polys.length) return; cuts.push(faceSolid(M, polys, y0 - 1, y0 + 0.6)); colors.push({ role, m: faceSolid(M, polys, y0, y0 + 0.6) }); }
  function patternIn(o, region, w, h, x0, z0, reserved) {
    if (o.lidPattern === 'none') return { a: [], b: [] };
    const pat = CBm().patternPolys(o.lidPattern, w, h, o.patternScale), mv = ps => ps.map(Q => ({ outer: Q.outer.map(([x, y]) => [x + x0, y + z0]), holes: Q.holes.map(L => L.map(([x, y]) => [x + x0, y + z0])) }));
    const area = reserved.length ? T.diffPolys(region, T.unionPolys(reserved)) : region;
    const keep = ps => ps.length ? T.interPolys(mv(ps), area).filter(Q => T.polysArea([Q]) > 0.5) : [];
    return { a: keep(pat.a), b: keep(pat.b) };
  }
  const knobSpotsX = (o, cx, w) => (o.knob === 'notch' ? [] : ['bar', 'arch'].includes(o.knob) && w >= 100 ? [cx - 32, cx + 32] : [cx]);
  const knobKind = (o, w) => (['bar', 'arch'].includes(o.knob) && w < 100 ? 'round' : o.knob);

  // ------------------------------------------------------------------ modules (local coordinates: x across, y front to back, z up)
  const BIN = { F: 4, wall: 2, floor: 1.6, r: 5 };
  function binSolids(o, M, u) {
    const { w, d, h } = u, { F, wall, floor, r } = BIN, O = [P(H().rrect(w / 2, d / 2, w, d, r))];
    let body = U(M, [H().ext(M, O, F, h), H().ext(M, T.offset(O, -(wall + 0.4), true), 0, F + 0.01)]);
    const cuts = [H().ext(M, T.offset(O, -wall, true), F + floor, h + 1)], colors = [];
    const nd = Math.min((h - F) * 0.42, 60), nw = Math.max(30, w * 0.6);    // open front: reach in while bins are stacked
    cuts.push(faceSolid(M, [P(H().rrect(w / 2, h, nw, nd * 2, Math.min(12, nd - 0.5)))], -1, wall + 1));
    const zl0 = F + floor + 1.5, zl1 = h - nd - 2;
    if (zl1 - zl0 >= 6) inlayFront(M, cuts, colors, 'label', labelAt(o, u.label, w / 2, (zl0 + zl1) / 2, w * 0.8, Math.min(o.labelSize, (zl1 - zl0) * 0.7)), 0);
    body = sub(M, body, U(M, cuts));
    return { solids: [{ role: 'body', m: body }].concat(colors) };
  }
  function lidSolids(o, M, u) {   // modeled top up: top face at z = t, nesting ring below
    const { w, d } = u, t = 2.4, O = [P(H().rrect(w / 2, d / 2, w, d, BIN.r))], ring = T.diffPolys(T.offset(O, -(BIN.wall + 0.4), true), T.offset(O, -(BIN.wall + 2), true));
    let plate = U(M, [H().ext(M, O, 0, t), H().ext(M, ring, -3, 0.01)]);
    const kk = knobKind(o, w), spots = knobSpotsX({ knob: kk }, w / 2, w).map(x => [x, d / 2]), cuts = [], colors = [];
    for (const [x, y] of spots) cuts.push(M.Manifold.cylinder(t + 2, 3.25, 3.25, 28).translate([x, y, -1]));
    if (kk === 'notch') cuts.push(M.Manifold.cylinder(t + 2, 11, 11, 40).translate([w / 2, -2, -1]));
    const region = T.offset(O, -4, true), reserved = spots.map(([x, y]) => P(H().circ(x, y, 9, 32)));
    if (kk === 'notch') reserved.push(P(H().circ(w / 2, 0, 15, 32)));
    const lab = T.interPolys(labelAt(o, u.label, w / 2, d * 0.22, w * 0.8, Math.min(o.labelSize, d * 0.12)), region);
    const top = (ps, role) => { if (!ps.length) return; cuts.push(H().ext(M, ps, t - 0.6, t + 1)); colors.push({ role, m: H().ext(M, ps, t - 0.6, t) }); };
    top(lab, 'lidlabel'); if (lab.length) reserved.push(...T.offset(lab, 1.6, true));
    const pat = patternIn(o, region, w, d, 0, 0, reserved); top(pat.a, 'pattern'); top(pat.b, 'pattern2');
    plate = sub(M, plate, U(M, cuts));
    return { solids: [{ role: 'lid', m: plate }].concat(colors), knob: kk === 'notch' ? null : { kind: kk, spots: spots.map(([x, y]) => [x, y, t]) } };
  }
  const DR = { Fh: 4, fl: 2, sw: 2.4, bw: 2, rail: 8, rh: 6, c: 0.6, FT: 3 };
  const pinSpots = (w, d) => [[4, 12], [4, d - 12], [w - 4, 12], [w - 4, d - 12]];
  function housingSolids(o, M, u) {   // open-top sleeve: floor, sides, back, top rails with stacking pins; feet with pin holes
    const { w, d, h } = u, { Fh, fl, sw, bw, rail, rh } = DR, ch = rail - sw;
    const railP = [P([[0, h - rh - ch], [sw, h - rh - ch], [rail, h - rh], [rail, h], [0, h]])], railR = [P([[w, h - rh - ch], [w, h], [w - rail, h], [w - rail, h - rh], [w - sw, h - rh - ch]])];
    const parts = [box(M, 0, 0, Fh, w, d, Fh + fl), box(M, 0, 0, Fh, sw, d, h - rh - ch + 0.01), box(M, w - sw, 0, Fh, w, d, h - rh - ch + 0.01), box(M, 0, d - bw, Fh, w, d, h),
      faceSolid(M, railP, 0, d), faceSolid(M, railR, 0, d)];
    for (const [x, y] of pinSpots(w, d)) { parts.push(box(M, x < w / 2 ? 0 : w - rail, y - 8, 0, x < w / 2 ? rail : w, y + 8, Fh + 0.01)); parts.push(M.Manifold.cylinder(3.5, 3, 2.7, 24).translate([x, y, h - 0.01])); }
    let body = U(M, parts);
    const holes = pinSpots(w, d).map(([x, y]) => M.Manifold.cylinder(3.8 + 1, 3.3, 3.3, 24).translate([x, y, -1]));
    body = sub(M, body, U(M, holes));
    return { solids: [{ role: 'body', m: body }], seam: c => ({ blocks: [box(M, w * 0.3 - 6, c - 8, 0.01, w * 0.3 + 6, c + 8, Fh + 0.01), box(M, w * 0.7 - 6, c - 8, 0.01, w * 0.7 + 6, c + 8, Fh + 0.01)], holes: [pinHole(M, 'y', w * 0.3, c, Fh / 2), pinHole(M, 'y', w * 0.7, c, Fh / 2), pinHole(M, 'y', 4, c, h - 3), pinHole(M, 'y', w - 4, c, h - 3)] }) };
  }
  function drawerGeom(u) { const { w, d, h } = u, { Fh, fl, bw, rail, c, FT } = DR; return { bx0: rail + c, bx1: w - rail - c, by1: d - bw - 1, bz0: Fh + fl, bz1: h + 2, fz1: h + Fh - 0.5, FT }; }
  function drawerSolids(o, M, u) {
    const { w } = u, g = drawerGeom(u), wl = 1.6;
    let body = U(M, [box(M, g.bx0, 0, g.bz0, g.bx1, g.by1, g.bz1), box(M, 0.5, -g.FT, g.bz0, w - 0.5, 0.01, g.fz1)]);
    const cuts = [box(M, g.bx0 + wl, wl, g.bz0 + wl, g.bx1 - wl, g.by1 - wl, g.bz1 + 1)], colors = [];
    const fw = w - 1, fh = g.fz1 - g.bz0, kk = knobKind(o, fw), zc = g.bz0 + fh * 0.42, spots = knobSpotsX({ knob: kk }, w / 2, fw).map(x => [x, zc]);
    for (const [x, z] of spots) cuts.push(tx(M.Manifold.cylinder(g.FT + 2, 3.25, 3.25, 28), m => m.rotate([90, 0, 0]).translate([x, 1, z])));
    if (kk === 'notch') cuts.push(faceSolid(M, [P(H().rrect(w / 2, g.fz1, 64, 40, 12))], -g.FT - 1, wl + 1));
    const fr = [R(3.5, g.bz0 + 3, w - 3.5, g.fz1 - 3)], reserved = spots.map(([x, z]) => P(H().circ(x, z, 10, 32)));
    if (kk === 'notch') reserved.push(P(H().rrect(w / 2, g.fz1, 76, 52, 14)));
    const lz = g.bz0 + fh * 0.78, ls = Math.min(o.labelSize, fh * 0.16), lab = T.interPolys(labelAt(o, u.label, w / 2, kk === 'notch' ? g.bz0 + fh * 0.3 : lz, fw * 0.8, ls), fr);
    inlayFront(M, cuts, colors, 'label', lab, -g.FT); if (lab.length) reserved.push(...T.offset(lab, 1.6, true));
    if (o.frontPattern) { const pat = patternIn(o, fr, w, fh, 0, g.bz0, reserved); inlayFront(M, cuts, colors, 'pattern', pat.a, -g.FT); inlayFront(M, cuts, colors, 'pattern2', pat.b, -g.FT); }
    body = sub(M, body, U(M, cuts));
    return { solids: [{ role: 'front', m: body }].concat(colors), knob: kk === 'notch' ? null : { kind: kk, front: true, spots: spots.map(([x, z]) => [x, -g.FT, z]) },
      seam: c => { const zb = g.bz0 + wl; return { blocks: [box(M, g.bx0 + wl - 0.01, c - 8, zb - 0.01, g.bx0 + wl + 8, c + 8, zb + 8), box(M, g.bx1 - wl - 8, c - 8, zb - 0.01, g.bx1 - wl + 0.01, c + 8, zb + 8)], holes: [pinHole(M, 'y', g.bx0 + wl + 4, c, zb + 4), pinHole(M, 'y', g.bx1 - wl - 4, c, zb + 4)] }; } };
  }
  const RS = { pt: 8, top: 4, rib: 12 };
  const riserPins = (w, d) => [[RS.pt / 2, d * 0.2], [RS.pt / 2, d * 0.8], [w - RS.pt / 2, d * 0.2], [w - RS.pt / 2, d * 0.8]];
  function riserSolids(o, M, u) {   // two side panels and a shelf with front and back ribs; pin holes top and bottom
    const { w, d, h } = u, { pt, top, rib } = RS, colors = [];
    let body = U(M, [box(M, 0, 0, 0, pt, d, h), box(M, w - pt, 0, 0, w, d, h), box(M, 0, 0, h - top, w, d, h), box(M, 0, 0, h - rib, w, 4, h), box(M, 0, d - 4, h - rib, w, d, h)]);
    const cuts = [];
    for (const [x, y] of riserPins(w, d)) { cuts.push(M.Manifold.cylinder(5.5, 2.75, 2.75, 24).translate([x, y, -1])); cuts.push(M.Manifold.cylinder(5.5, 2.75, 2.75, 24).translate([x, y, h - 4.5])); }
    inlayFront(M, cuts, colors, 'label', labelAt(o, u.label, w / 2, h - rib / 2, w * 0.7, Math.min(o.labelSize, rib * 0.6)), 0);
    body = sub(M, body, U(M, cuts));
    return { solids: [{ role: 'body', m: body }].concat(colors) };
  }
  function stepsSolids(o, M, u) {   // solid stair with a lip on each tier, extruded across
    const { w, d } = u, n = u.tiers, rise = u.rise, run = d / n, L = [[0, 0], [d, 0]];
    for (let i = n - 1; i >= 0; i--) { const zt = (i + 1) * rise; L.push([(i + 1) * run, zt + (i === n - 1 ? 0 : 0)]); L.push([i * run + 2.4, zt]); L.push([i * run + 2.4, zt + 4]); L.push([i * run, zt + 4]); if (i > 0) L.push([i * run, i * rise]); }
    L[2] = [d, n * rise]; const prof = [P(L)];
    let body = sideSolid(M, prof, 0, w); const cuts = [], colors = [];
    inlayFront(M, cuts, colors, 'label', labelAt(o, u.label, w / 2, rise / 2 + 1, w * 0.8, Math.min(o.labelSize, rise * 0.55)), 0);
    body = sub(M, body, U(M, cuts));
    return { solids: [{ role: 'body', m: body }].concat(colors) };
  }
  function sledSolids(o, M, u) {   // open tray along x with a grip notch in the end wall that faces the door
    const { w, d, h } = u, wl = 2, fl = 2, O = [P(H().rrect(w / 2, d / 2, w, d, 4))], hx = u.handle === 'right' ? w : 0;
    let body = H().ext(M, O, 0, h); const cuts = [H().ext(M, T.offset(O, -wl, true), fl, h + 1)], colors = [];
    const nW = Math.min(70, d * 0.55), nD = Math.min(28, h * 0.45);
    cuts.push(sideSolid(M, [P(H().rrect(d / 2, h, nW, nD * 2, 10))], hx - wl - 1 + (hx ? 0 : 0), hx + wl + 1 - (hx ? 0 : 0)));
    const zl0 = fl + 1.5, zl1 = h - nD - 2;
    if (zl1 - zl0 >= 6 && u.label) {
      const size = Math.min(o.labelSize, (zl1 - zl0) * 0.7), lab = labelAt(o, u.label, d / 2, (zl0 + zl1) / 2, d * 0.85, size);
      const ps = hx ? lab : lab.map(Q => ({ outer: Q.outer.map(([a, b]) => [d - a, b]).reverse(), holes: Q.holes.map(Lh => Lh.map(([a, b]) => [d - a, b]).reverse()) }));
      if (ps.length) { if (hx) { cuts.push(sideSolid(M, ps, w - 0.6, w + 1)); colors.push({ role: 'label', m: sideSolid(M, ps, w - 0.6, w) }); } else { cuts.push(sideSolid(M, ps, -1, 0.6)); colors.push({ role: 'label', m: sideSolid(M, ps, 0, 0.6) }); } }
    }
    body = sub(M, body, U(M, cuts));
    return { solids: [{ role: 'body', m: body }].concat(colors), axis: 'x', seam: c => ({ blocks: [box(M, c - 8, wl - 0.01, fl - 0.01, c + 8, wl + 8, fl + 8), box(M, c - 8, d - wl - 8, fl - 0.01, c + 8, d - wl + 0.01, fl + 8)], holes: [pinHole(M, 'x', c, wl + 4, fl + 4), pinHole(M, 'x', c, d - wl - 4, fl + 4)] }) };
  }
  // cut one module into pieces that fit the bed along its long axis; pin holes across every seam
  function pieces(M, mod, axis, len, max) {
    const n = Math.max(1, Math.ceil(len / max)); if (n === 1 || !mod.seam) return [mod.solids];
    const cutsAt = Array.from({ length: n - 1 }, (_, i) => len * (i + 1) / n);
    const body = mod.solids[0];
    for (const c of cutsAt) { const s = mod.seam(c); body.m = U(M, [body.m, ...s.blocks]); body.m = sub(M, body.m, U(M, s.holes)); }
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = k ? cutsAt[k - 1] : -1e4, b = k < n - 1 ? cutsAt[k] : 1e4;
      const cb = axis === 'x' ? box(M, a, -1e4, -1e4, b, 1e4, 1e4) : box(M, -1e4, a, -1e4, 1e4, b, 1e4);
      out.push(mod.solids.map(s => ({ role: s.role, m: s.m.intersect(cb) })).filter(s => !s.m.isEmpty()));
      cb.delete();
    }
    mod.solids.forEach(s => s.m.delete());
    return out;
  }

  // ------------------------------------------------------------------ build everything
  const soupOf = m => { const p = H().soup(m); m.delete(); return p; };
  const rotX90 = p => { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i]; q[i + 1] = -p[i + 2]; q[i + 2] = p[i + 1]; } return q; };
  const TYPE_NAMES = { bin: 'Stackable bin', lid: 'Bin lid', housing: 'Drawer sleeve', drawer: 'Drawer', riser: 'Shelf riser', steps: 'Step shelf', sled: 'Corner sled', pin: 'Stacking pin', knob: 'Knob' };
  function build(raw, M) {
    if (!M) throw new Error('The 3D engine is still loading. Try again in a moment.');
    const o = options(raw), Ub = usable(o), lay = layout(o), warnings = lay.warnings.slice(), notes = [];
    const roleColor = { body: o.unitColor, front: o.frontColor, label: o.labelColor, lid: o.lidColor, lidlabel: o.labelColor, pattern: o.patternColor, pattern2: o.patternColor2, knob: o.knobColor };
    const cache = new Map(), parts = [], preview = [];
    const fitsBed = (a, b, c) => c <= Ub.z + 0.01 && ((a <= Ub.w + 0.01 && b <= Ub.d + 0.01) || (b <= Ub.w + 0.01 && a <= Ub.d + 0.01));
    const r1 = v => Math.round(v * 10) / 10;
    function getPart(kind, u, extra) {
      const key = JSON.stringify([kind, r1(u.w), r1(u.d), r1(u.h), u.label || '', u.tiers || 0, r1(u.rise || 0), u.handle || '', extra || '']);
      if (cache.has(key)) { const e = cache.get(key); e.forEach(pt => pt.count++); return e; }
      let mod, axis = 'y', len = u.d, max = Ub.d;
      if (kind === 'bin') mod = binSolids(o, M, u);
      else if (kind === 'lid') mod = lidSolids(o, M, u);
      else if (kind === 'housing') mod = housingSolids(o, M, u);
      else if (kind === 'drawer') mod = drawerSolids(o, M, u);
      else if (kind === 'riser') mod = riserSolids(o, M, u);
      else if (kind === 'steps') mod = stepsSolids(o, M, u);
      else if (kind === 'sled') { mod = sledSolids(o, M, u); axis = 'x'; len = u.w; }
      const across = axis === 'x' ? u.d : u.w;
      if (across > Ub.w + 0.01) max = Math.min(Ub.w, Ub.d);
      const knob = mod.knob, pcs = pieces(M, mod, axis, len, axis === 'x' ? (u.d <= Ub.d ? Ub.w : Ub.d) : (u.w <= Ub.w ? Ub.d : Ub.w));
      const nm = TYPE_NAMES[kind] + (u.label ? ` "${u.label}"` : '') + ` ${Math.round(u.w)} \u00d7 ${Math.round(u.d)} \u00d7 ${Math.round(u.h)}`;
      const list = pcs.map((ss, i) => ({ kind, name: pcs.length > 1 ? `${nm}, piece ${i + 1} of ${pcs.length}` : nm, parts: ss.map(s => ({ name: s.role === 'body' || s.role === 'front' || s.role === 'lid' ? TYPE_NAMES[kind] : `${TYPE_NAMES[kind]} ${s.role.replace('2', ' 2').replace('lidlabel', 'label')}`, role: s.role, color: roleColor[s.role], p: soupOf(s.m) })).filter(s => s.p.length), count: 1, pieces: pcs.length, knob }));
      for (const pt of list) { const b = H().bboxOf(pt.parts.map(s => s.p)); pt.size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]; }
      if (pcs.length > 1) notes.push(`${TYPE_NAMES[kind]}s ${Math.round(len)} mm long print in ${pcs.length} pieces. Join them with 1.75 mm filament pins (16 mm long) in the seam holes and a little glue.`);
      cache.set(key, list); parts.push(...list); return list;
    }
    const knobCache = new Map();
    function knobPart(kind) {
      if (knobCache.has(kind)) { const k = knobCache.get(kind); return k; }
      const m = H().buildKnob({ knob: kind, lidT: 3 }, M), pt = { kind: 'knob', name: CBm().KNOBS[kind], knobKind: kind, parts: [{ name: CBm().KNOBS[kind], role: 'knob', color: o.knobColor, p: soupOf(m) }], count: 0 };
      knobCache.set(kind, pt); parts.push(pt); return pt;
    }
    const place = (list, u, dz, dy, lift) => { for (const pt of list) for (const s of pt.parts) preview.push({ p: H().moveP(s.p, u.x, u.y + (dy || 0), u.z + (dz || 0) + (lift || 0)), color: s.color, name: s.name }); };
    const addKnobs = (kn, u, dy, dz) => { if (!kn) return; const kp = knobPart(kn.kind), n = kn.kind === 'bar' || kn.kind === 'arch' ? 1 : kn.spots.length; kp.count += n;
      const cx = kn.spots.reduce((s, q) => s + q[0], 0) / kn.spots.length, ref = kn.spots[0];
      const kpP = kn.front ? rotX90(kp.parts[0].p) : kp.parts[0].p;
      for (let i = 0; i < n; i++) { const sx = n === 1 ? cx : kn.spots[i][0]; preview.push({ p: H().moveP(kpP, u.x + sx, u.y + ref[1] + (dy || 0), u.z + ref[2] + (dz || 0)), color: o.knobColor, name: kp.name }); } };
    let pins = 0, pulled = false;
    for (const u of lay.units) {
      if (u.type === 'bin') { place(getPart('bin', u), u); if (u.lid) { const lp = getPart('lid', u); place(lp, u, u.h + 0.2 + 2.4 - 2.4, 0); addKnobs(lp[0].knob, u, 0, u.h + 0.2); } }
      else if (u.type === 'drawer') {
        place(getPart('housing', u), u);
        const out = !pulled && u.level === 0 && u.col === 0 ? Math.min(u.d * 0.45, 160) : 0; if (out) pulled = true;
        const dp = getPart('drawer', u); place(dp, u, 0, -out); addKnobs(dp[0].knob, u, -out, 0);
      }
      else if (u.type === 'riser') { place(getPart('riser', u), u); if (u.level > 0) pins += 4; }
      else if (u.type === 'steps') place(getPart('steps', u), u);
      else if (u.type === 'sled') place(getPart('sled', u), u, 0, 0, 0);
    }
    if (pins) { const m = M.Manifold.cylinder(8, 2.45, 2.45, 24); parts.push({ kind: 'pin', name: TYPE_NAMES.pin, parts: [{ name: TYPE_NAMES.pin, role: 'body', color: o.unitColor, p: soupOf(m) }], count: pins }); }
    for (const pt of parts) if (pt.size && !fitsBed(...pt.size)) warnings.push(`${pt.name} (${pt.size.map(v => Math.round(v)).join(' \u00d7 ')} mm) is bigger than your printer. Use smaller units or a bigger printer.`);
    // cabinet ghost for the preview: floor, back wall and the pipes
    const ghost = '#D8CDB8';
    preview.push({ p: soupOf(box(M, 0, 0, -6, o.w, o.d, -1)), color: ghost, name: 'Cabinet floor (not printed)' });
    preview.push({ p: soupOf(box(M, 0, o.d + 1, -6, o.w, o.d + 6, o.h)), color: ghost, name: 'Cabinet back (not printed)' });
    if (o.pipe) { const pc = '#9AA0A6'; preview.push({ p: soupOf(M.Manifold.cylinder(o.h * 0.75, 20, 20, 32).translate([o.pipeX - o.pipeW * 0.25, o.d - o.pipeD * 0.45, o.h * 0.25])), color: pc, name: 'Drain pipe (not printed)' }); preview.push({ p: soupOf(M.Manifold.cylinder(o.h * 0.6, 8, 8, 24).translate([o.pipeX + o.pipeW * 0.3, o.d - 30, o.h * 0.4])), color: pc, name: 'Supply line (not printed)' }); }
    // stats
    let vol = 0; for (const pt of parts) for (const s of pt.parts) { const V = Math.abs(C.signedVolume(s.p)), A = H().area(s.p), shell = Math.min(V, A * 0.6); vol += (shell + (V - shell) * 0.15) * pt.count; }
    const colorsUsed = []; for (const pt of parts) for (const s of pt.parts) if (!colorsUsed.includes(s.color)) colorsUsed.push(s.color);
    const byType = {}; for (const u of lay.units) byType[u.type] = (byType[u.type] || 0) + 1;
    const printed = parts.reduce((s, pt) => s + pt.count, 0);
    const stats = { units: lay.units.length, byType, lids: lay.units.filter(u => u.lid).length, printed, colors: colorsUsed.length, grams: Math.round(vol / 1000 * 1.24), size: [Math.round(o.w), Math.round(o.d), Math.round(o.h)], opening: lay.opening.map(v => Math.round(v)), zones: lay.zones.length, splits: parts.filter(p => p.pieces > 1).length };
    if (!lay.units.length) warnings.push('Nothing fits yet. Check the cabinet size, the clearances and the fill choices.');
    return { options: o, units: lay.units, zones: lay.zones, opening: lay.opening, hinge: lay.hinge, parts, preview, stats, warnings, notes: [...new Set(notes)] };
  }
  // what the export needs: the cabinet entitlement, plus the lids entitlement for patterned lids or drawer fronts
  function gateInfo(raw) { const o = options(raw); const patterned = o.lidPattern !== 'none' && (o.lids !== 'none' || o.frontPattern); return { features: patterned ? [FEATURE, LID_FEATURE] : [FEATURE], exclusive: true }; }

  // ------------------------------------------------------------------ print list, plates, files
  const flipX = p => H().flipX(p);
  function printList(res) {
    const out = [];
    for (const pt of res.parts) for (let k = 0; k < pt.count; k++) {
      let ps = pt.parts.map(s => s.p);
      if (pt.kind === 'lid' || pt.kind === 'riser') ps = ps.map(flipX);        // lids top down; risers upside down (no bridges)
      if (pt.kind === 'knob') ps = ps.map(p => pt.knobKind === 'arch' ? (() => { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i]; q[i + 1] = p[i + 2]; q[i + 2] = -p[i + 1]; } return q; })() : flipX(p));
      const b = H().bboxOf(ps), sb = pt.parts.map((s, i) => ({ name: s.name, color: s.color, p: H().moveP(ps[i], -b.min[0], -b.min[1], -b.min[2]) }));
      out.push({ name: pt.count > 1 ? `${pt.name} (${k + 1})` : pt.name, parts: sb, color: sb[0].color, p: sb.length === 1 ? sb[0].p : H().concat(sb.map(s => s.p)) });
    }
    return out;
  }
  function arrangePlates(res) {
    const Ub = usable(res.options), list = printList(res), A = PL.arrange(list.map(it => ({ name: it.name, p: it.p, color: it.color, _it: it })), Ub.w, Ub.d, { gap: 5, maxZ: Ub.z });
    const fix = q => { const it = q._it; let ps = it.parts.map(s => s.p); if (q.rot) ps = ps.map(H().rotZ); const b = H().bboxOf(ps); return { name: it.name, color: it.color, p: q.p, parts: it.parts.map((s, i) => ({ name: s.name, color: s.color, p: H().moveP(ps[i], q.x - b.min[0], q.y - b.min[1], -b.min[2]) })) }; };
    return { plates: A.plates.map(l => l.map(fix)), unfit: A.unfit.map(u => ({ name: u._it.name, parts: u._it.parts, p: u._it.p, color: u._it.color })) };
  }
  function export3MF(res, o) {
    o = o || {}; const cols = []; for (const pt of res.parts) for (const s of pt.parts) if (!cols.includes(s.color)) cols.push(s.color);
    const A = arrangePlates(res), objs = [], plates = [];
    const obj = it => ({ name: it.name, parts: it.parts.map(s => ({ name: s.name, p: s.p, color: s.color, extruder: cols.indexOf(s.color) + 1 })) });
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push(obj(it)); }); plates.push(ids); });
    A.unfit.forEach(u => { plates.push([objs.length]); objs.push(obj(u)); });
    return T.threeMF(objs, { title: o.name || 'Stackable cabinet organizer', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notesText(res) {
    const o = res.options, st = res.stats, L = ['Expressarte stackable cabinet organizer', ''];
    L.push(`Cabinet inside ${st.size[0]} \u00d7 ${st.size[1]} \u00d7 ${st.size[2]} mm; usable opening ${st.opening[0]}\u2013${st.opening[1]} mm from the left.`);
    L.push(`${st.units} modules: ${Object.entries(st.byType).map(([k, n]) => `${n} ${TYPE_NAMES[k === 'drawer' ? 'drawer' : k].toLowerCase()}${n === 1 ? '' : 's'}`).join(', ')}.`);
    L.push('', 'Parts to print');
    for (const pt of res.parts) L.push(`  ${pt.count} \u00d7 ${pt.name}`);
    L.push('', 'Assembly',
      '  - Bins stack: the foot of each bin drops into the bin below. The open front lets you reach in while they are stacked.',
      '  - Drawer sleeves stack on the pins on their top rails. Slide each drawer into its sleeve; the front panel stops it.',
      '  - Shelf risers print upside down (no supports). Stack them with the loose stacking pins.',
      '  - Corner sleds slide sideways out of the blind corner by the grip in their end wall.',
      '  - Knobs press into the holes in lids and drawer fronts; a drop of glue makes them permanent.');
    if (res.warnings.length) { L.push('', 'Notes'); res.warnings.forEach(w => L.push('  - ' + w)); }
    res.notes.forEach(n => L.push('  - ' + n));
    return L.join('\n');
  }
  function files(res, o) {
    o = o || {}; const base = o.fileBase || 'cabinet_organizer', out = [], slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    const seen = new Set();
    for (const it of printList(res)) { const n = `${base}_${slug(it.name.replace(/ \(\d+\)$/, ''))}.stl`; if (seen.has(n)) continue; seen.add(n); out.push({ name: n, data: new Uint8Array(C.writeSTL(it.p, it.name)) }); }
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    out.push({ name: `${base}_NOTES.txt`, data: notesText(res) });
    return out;
  }
  const api = { FEATURE, LID_FEATURE, FILLS, CORNERS, HINGES, LIDS, PRESETS, DEFAULTS, TYPE_NAMES, options, zones, layout, build, gateInfo, printList, arrangePlates, export3MF, notes: notesText, files, usable, labelList };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPCabinet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
