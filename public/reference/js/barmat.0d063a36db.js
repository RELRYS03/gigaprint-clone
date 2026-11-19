/* Expressarte bar mat: a custom rubber-style bar mat for printing in TPU. Raised nubs or ridges (round, square, hex,
   diamond, crosses, basket weave, ribs, waves, honeycomb, grid, chevrons) with height, size, spacing, taper and
   stagger; a raised rim (flat, rounded, beveled, ribbed, rope or none) with an optional drip lip or channel; a raised
   center panel (rectangle, rounded, oval, circle, banner or none) with an optional frame line; up to 3 lines of text,
   each with its own font, size and color, plus an optional traced logo in one or two colors. Text is always fitted
   inside the panel (shrink, then wrap at a space) and never leaves it. Mats bigger than the bed split into tiles with
   the drawer mat's flat-locking dovetail joints; seams avoid the center panel and the pattern runs across them.
   Every body is a closed, watertight shell; the 3MF has one object per tile with a part per color.
   American spelling. No brand names. */
(function (G) {
  'use strict';
  const C = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const DM = () => G.GPDrawerMat || (typeof require === 'function' ? require('./drawermat.js') : null);
  const ST = () => G.GPStamp || (typeof require === 'function' ? require('./stamp.js') : null);

  const PATTERNS = [
    { id: 'round', label: 'Round nubs', kind: 'stud' },
    { id: 'square', label: 'Square nubs', kind: 'stud' },
    { id: 'hex', label: 'Hex nubs', kind: 'stud' },
    { id: 'diamond', label: 'Diamond studs', kind: 'stud' },
    { id: 'cross', label: 'Crosses', kind: 'stud' },
    { id: 'weave', label: 'Basket weave', kind: 'stud' },
    { id: 'ribs', label: 'Ribs', kind: 'line' },
    { id: 'waves', label: 'Waves', kind: 'line' },
    { id: 'honeycomb', label: 'Honeycomb ridges', kind: 'line' },
    { id: 'grid', label: 'Grid ridges', kind: 'line' },
    { id: 'chevron', label: 'Chevrons', kind: 'line' }
  ];
  const RIMS = [
    { id: 'flat', label: 'Flat' }, { id: 'rounded', label: 'Rounded' }, { id: 'beveled', label: 'Beveled' },
    { id: 'ribbed', label: 'Ribbed' }, { id: 'rope', label: 'Rope' }, { id: 'none', label: 'No rim' }
  ];
  const EDGES = [{ id: 'none', label: 'None' }, { id: 'lip', label: 'Drip lip' }, { id: 'channel', label: 'Drip channel' }];
  const PANELS = [
    { id: 'rounded', label: 'Rounded rectangle' }, { id: 'rect', label: 'Rectangle' }, { id: 'oval', label: 'Oval' },
    { id: 'circle', label: 'Circle' }, { id: 'banner', label: 'Banner' }, { id: 'none', label: 'None (text on the mat)' }
  ];
  const FONTS = [
    { id: 'script', label: 'Script' }, { id: 'slab', label: 'Bold slab' }, { id: 'block', label: 'Block' },
    { id: 'tall', label: 'Tall' }, { id: 'round', label: 'Rounded' }, { id: 'chunky', label: 'Chunky' }, { id: 'western', label: 'Western' }
  ];
  const LOGO_POS = [{ id: 'above', label: 'Above the text' }, { id: 'below', label: 'Below the text' }, { id: 'left', label: 'Left of the text' }, { id: 'right', label: 'Right of the text' }];
  const PZ = (C && C.PASTELS) || {};
  const INK = PZ.ink || '#2B2D31';
  const PALETTE = [
    { name: 'Mint', hex: PZ.mint || '#A8E6CF' }, { name: 'Sage', hex: PZ.sage || '#B5C9A8' }, { name: 'Baby blue', hex: PZ.babyBlue || '#A7C7E7' },
    { name: 'Lavender', hex: PZ.lavender || '#C8B6E2' }, { name: 'Pink', hex: PZ.pink || '#F4B6C2' }, { name: 'Peach', hex: PZ.peach || '#F9C6A8' },
    { name: 'Butter', hex: PZ.butter || '#F8E7A1' }, { name: 'Cream', hex: PZ.cream || '#F6EFDC' }, { name: 'White', hex: '#F7F4EE' },
    { name: 'Gold', hex: '#D4A72C' }, { name: 'Slate', hex: '#4A4E55' }, { name: 'Charcoal', hex: INK }, { name: 'Black', hex: '#1C1C1E' }
  ];
  // Free: mats up to 320 x 320 mm (a square mat on any common bed), up to 3 filament colors, text included.
  // Pro: bigger mats (the 60 cm bar rail), 4+ colors and an uploaded logo. Same pattern as the drawer mat.
  const FREE = { maxW: 320, maxD: 320, maxColors: 3, logo: false };
  const LIMITS = { minCap: 4, minNub: 3, minRidge: 1.2, minGap: 1.5, maxRows: 4 };
  const SIZES = {
    square: { label: 'Square (fits your printer)', w: 300, d: 300, fit: true },
    rail: { label: 'Bar rail 60 \u00d7 15 cm', w: 600, d: 150 },
    coaster: { label: 'Coaster 10 \u00d7 10 cm', w: 100, d: 100 },
    custom: { label: 'Custom size' }
  };
  const line = (text, font, cap, color) => ({ text, font, cap, color });
  const DEFAULTS = {
    size: 'square', width: 245, depth: 245, baseT: 2.4, radius: 8,
    pattern: 'round', nubH: 5, nubD: 6, spacing: 10, taper: 25, stagger: true,
    rimStyle: 'rounded', rimW: 12, rimFlush: true, rimH: 5, edge: 'none',
    panelShape: 'rounded', panelW: 62, panelD: 46, panelFlush: true, panelH: 5, frame: true, frameW: 1.6, frameInset: 4,
    textMargin: 4, textRaise: 1.2,
    lines: [line("The James's Bar", 'script', 18, INK), line('', 'slab', 12, INK), line('EST. 2026', 'slab', 7, INK)],
    logo: null, logo2: null, logoPos: 'above', logoSize: 30,
    colors: { base: PZ.mint || '#A8E6CF', rim: PZ.mint || '#A8E6CF', panel: PZ.cream || '#F6EFDC', frame: INK, logo: INK, logo2: PZ.pink || '#F4B6C2' },
    detail: 'hd', bed: [256, 256, 256], bambu: 'A1'
  };
  const PRESETS = {
    pastel: { label: 'Pastel', size: 'square', pattern: 'round', nubH: 5, nubD: 6, spacing: 10, taper: 25, stagger: true, rimStyle: 'rounded', rimW: 12, edge: 'none',
      panelShape: 'rounded', panelW: 62, panelD: 46, frame: true,
      lines: [line("The James's Bar", 'script', 18, INK), line('', 'slab', 12, INK), line('EST. 2026', 'slab', 7, INK)],
      colors: { base: PZ.mint || '#A8E6CF', rim: PZ.mint || '#A8E6CF', panel: PZ.cream || '#F6EFDC', frame: INK } },
    pub: { label: 'Classic pub', size: 'square', pattern: 'round', nubH: 5, nubD: 5.5, spacing: 9, taper: 20, stagger: false, rimStyle: 'flat', rimW: 12, edge: 'lip',
      panelShape: 'banner', panelW: 84, panelD: 34, frame: false,
      lines: [line('Welcome to', 'script', 10, '#1C1C1E'), line('YOUR BAR NAME', 'slab', 16, '#1C1C1E'), line('Cheers!', 'script', 9, '#D4A72C')],
      colors: { base: '#1C1C1E', rim: '#1C1C1E', panel: '#F7F4EE', frame: '#1C1C1E' } },
    homebar: { label: 'Home bar name', size: 'rail', pattern: 'round', nubH: 7, nubD: 7, spacing: 11, taper: 30, stagger: false, rimStyle: 'beveled', rimW: 10, edge: 'none',
      panelShape: 'rect', panelW: 38, panelD: 70, frame: true,
      lines: [line("The James's Bar", 'script', 22, '#F7F4EE'), line('', 'slab', 12, '#F7F4EE'), line('EST. 2026', 'slab', 8, '#F7F4EE')],
      colors: { base: INK, rim: INK, panel: '#4A4E55', frame: '#F7F4EE' } },
    coaster: { label: 'Coaster', size: 'coaster', pattern: 'hex', nubH: 3, nubD: 4.5, spacing: 7.5, taper: 20, stagger: true, rimStyle: 'rounded', rimW: 6, edge: 'none',
      panelShape: 'circle', panelW: 60, panelD: 60, frame: true,
      lines: [line('', 'slab', 10, INK), line('Cheers', 'script', 14, INK), line('', 'slab', 6, INK)],
      colors: { base: PZ.peach || '#F9C6A8', rim: PZ.peach || '#F9C6A8', panel: PZ.cream || '#F6EFDC', frame: INK } },
    mono: { label: 'Classic black and white', size: 'square', pattern: 'square', nubH: 5, nubD: 5.5, spacing: 9.5, taper: 20, stagger: false, rimStyle: 'flat', rimW: 12, edge: 'channel',
      panelShape: 'rect', panelW: 70, panelD: 40, frame: true,
      lines: [line('', 'script', 12, '#F7F4EE'), line('YOUR BAR NAME', 'block', 16, '#F7F4EE'), line('EST. 2026', 'slab', 7, '#F7F4EE')],
      colors: { base: '#1C1C1E', rim: '#1C1C1E', panel: '#1C1C1E', frame: '#F7F4EE' } }
  };

  const clamp = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  const hex = (c, d) => /^#[0-9a-f]{6}$/i.test(c || '') ? String(c).toUpperCase() : d;
  const has = (list, id) => list.some(x => x.id === id);
  function usable(o) { return { w: Math.max(50, o.bed[0] - 8), d: Math.max(50, o.bed[1] - 8), z: Math.max(20, (o.bed[2] || 256) - 4) }; }
  // the square preset: as close to 30 x 30 cm as the bed allows on one plate
  function squareFor(bed) { const b = Array.isArray(bed) ? bed : DEFAULTS.bed, s = Math.min(300, b[0] - 8, b[1] - 8); return Math.max(60, Math.floor(s / 5) * 5); }
  function sizeFor(id, bed) { const s = SIZES[id]; if (!s || !s.w) return null; return s.fit ? { w: squareFor(bed), d: squareFor(bed) } : { w: s.w, d: s.d }; }

  function options(raw) {
    raw = raw || {};
    const o = Object.assign({}, DEFAULTS, raw);
    o.bed = Array.isArray(o.bed) && o.bed[0] > 0 && o.bed[1] > 0 ? o.bed.map(Number) : DEFAULTS.bed.slice();
    if (!o.bed[2]) o.bed[2] = 256;
    o.size = SIZES[o.size] ? o.size : 'custom';
    o.width = clamp(o.width, 60, 1200, DEFAULTS.width);
    o.depth = clamp(o.depth, 60, 1200, DEFAULTS.depth);
    o.baseT = clamp(o.baseT, 1.6, 6, DEFAULTS.baseT);
    o.radius = clamp(o.radius, 1, 40, DEFAULTS.radius);
    o.pattern = has(PATTERNS, o.pattern) ? o.pattern : 'round';
    o.nubH = clamp(o.nubH, 2, 10, DEFAULTS.nubH);
    o.nubD = clamp(o.nubD, LIMITS.minNub, 16, DEFAULTS.nubD);
    o.spacing = clamp(o.spacing, 5, 30, DEFAULTS.spacing);
    o.taper = clamp(o.taper, 0, 60, DEFAULTS.taper);
    o.stagger = o.stagger !== false && o.stagger !== 'false';
    o.rimStyle = has(RIMS, o.rimStyle) ? o.rimStyle : 'rounded';
    o.rimW = clamp(o.rimW, 4, 30, DEFAULTS.rimW);
    o.rimFlush = o.rimFlush !== false && o.rimFlush !== 'false';
    o.rimH = clamp(o.rimH, 1, 12, DEFAULTS.rimH);
    o.edge = has(EDGES, o.edge) ? o.edge : 'none';
    o.panelShape = has(PANELS, o.panelShape) ? o.panelShape : 'rounded';
    o.panelW = clamp(o.panelW, 15, 95, DEFAULTS.panelW);
    o.panelD = clamp(o.panelD, 15, 95, DEFAULTS.panelD);
    o.panelFlush = o.panelFlush !== false && o.panelFlush !== 'false';
    o.panelH = clamp(o.panelH, 0.6, 10, DEFAULTS.panelH);
    o.frame = o.frame !== false && o.frame !== 'false';
    o.frameW = clamp(o.frameW, 0.8, 4, DEFAULTS.frameW);
    o.frameInset = clamp(o.frameInset, 1.5, 12, DEFAULTS.frameInset);
    o.textMargin = clamp(o.textMargin, 1.5, 20, DEFAULTS.textMargin);
    o.textRaise = clamp(o.textRaise, 0.6, 3, DEFAULTS.textRaise);
    const src = Array.isArray(raw.lines) ? raw.lines : DEFAULTS.lines;
    o.lines = [0, 1, 2].map(i => {
      const l = src[i] || {}, d = DEFAULTS.lines[i];
      return { text: String(l.text == null ? '' : l.text).replace(/[\r\n]+/g, ' ').slice(0, 60), font: has(FONTS, l.font) ? l.font : d.font, cap: clamp(l.cap, 4, 60, d.cap), color: hex(l.color, d.color) };
    });
    const polysOk = v => Array.isArray(v) && v.length && v.every(P => P && Array.isArray(P.outer) && P.outer.length >= 3);
    o.logo = polysOk(raw.logo) ? raw.logo : null;
    o.logo2 = o.logo && polysOk(raw.logo2) ? raw.logo2 : null;
    o.logoPos = has(LOGO_POS, o.logoPos) ? o.logoPos : 'above';
    o.logoSize = clamp(o.logoSize, 6, 200, DEFAULTS.logoSize);
    const c = Object.assign({}, DEFAULTS.colors, raw.colors || {});
    o.colors = {}; for (const k of Object.keys(DEFAULTS.colors)) o.colors[k] = hex(c[k], DEFAULTS.colors[k]);
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    o.bambu = o.bambu || 'A1';
    // printable in TPU: a gap of at least 1.5 mm between nubs, ridges at least 1.2 mm wide
    o.pitch = Math.max(o.spacing, o.nubD + LIMITS.minGap);
    o.ridgeW = clamp(o.nubD * 0.32, LIMITS.minRidge, 5, 1.6);
    o.rimTop = o.rimFlush ? o.nubH : o.rimH;
    o.panelTop = o.panelFlush ? o.nubH : o.panelH;
    o.edgeH = 1.6; o.lipW = Math.min(2.4, o.rimW * 0.35); o.chanW = Math.min(5, Math.max(3, o.rimW * 0.4)); o.chanD = Math.min(1.2, o.baseT - 1);
    return o;
  }
  // a preset merged over the defaults (UI and tests share it)
  function presetOptions(id, bed) {
    const p = PRESETS[id] || PRESETS.pastel, o = JSON.parse(JSON.stringify(Object.assign({}, DEFAULTS, p)));
    o.colors = Object.assign({}, DEFAULTS.colors, p.colors || {});
    const s = sizeFor(p.size, bed || DEFAULTS.bed); if (s) { o.width = s.w; o.depth = s.d; }
    if (bed) o.bed = bed;
    // on a small printer a long mat splits into more tiles: narrow the preset's panel until a seam no longer crosses it
    for (let k = 0; k < 14; k++) {
      const q = options(o), U = usable(q); if (!panelOn(q) || (q.width <= U.w + 1e-6 && q.depth <= U.d + 1e-6)) break;
      const L = layout(q, studLayout(q, allowedRegion(q, layoutText(q))));
      if (L.tiles.length === 1 || L.panelClear || o.panelW <= 24) break;
      o.panelW = Math.max(24, o.panelW - 3);
    }
    return o;
  }

  // ---------------------------------------------------------------- 2D helpers
  function area2(L) { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; }
  function inLoop(p, L) { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function inPolys(p, polys) { for (const P of polys) if (inLoop(p, P.outer) && !P.holes.some(h => inLoop(p, h))) return true; return false; }
  function bboxOf(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const P of polys) for (const q of P.outer) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  const xf = (polys, f) => polys.map(P => ({ outer: P.outer.map(f), holes: (P.holes || []).map(h => h.map(f)) }));
  const movePolys = (polys, dx, dy, s) => xf(polys, p => [p[0] * (s || 1) + dx, p[1] * (s || 1) + dy]);
  const poly = L => ({ outer: L, holes: [] });
  const areaOf = polys => T.polysArea(polys);
  // remove features thinner than 2*r (slivers) and specks smaller than minA
  function open(polys, r, minA) {
    if (!polys.length) return polys;
    let p = r > 0 ? T.offset(T.offset(polys, -r), r) : polys;
    if (minA) p = p.filter(P => Math.abs(area2(P.outer)) - P.holes.reduce((s, h) => s + Math.abs(area2(h)), 0) >= minA);
    return p;
  }
  function ring(o, d) { // the mat outline inset by d: same vertex count for every d so profiles can be swept
    const seg = o.detail === 'hd' ? 8 : 4, W = o.width, D = o.depth;
    return T.roundRect(d, d, W - d, D - d, Math.max(0.6, o.radius - d), seg);
  }
  function outlinePolys(o) { return [poly(ring(o, 0))]; }
  function rimOn(o) { return o.rimStyle !== 'none'; }
  function fieldPolys(o) { // the area inside the rim
    if (!rimOn(o)) return outlinePolys(o);
    return [poly(ring(o, o.rimW))];
  }
  function fieldBox(o) { const r = rimOn(o) ? o.rimW : 0; return { x0: r, y0: r, x1: o.width - r, y1: o.depth - r, w: o.width - 2 * r, h: o.depth - 2 * r }; }

  // ---------------------------------------------------------------- center panel
  function panelLoop(shape, w, h, cx, cy, detail) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, n = detail === 'hd' ? 96 : 48;
    if (shape === 'circle') return T.circle(cx, cy, Math.min(w, h) / 2, n);
    if (shape === 'oval') { const L = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; L.push([cx + w / 2 * Math.cos(a), cy + h / 2 * Math.sin(a)]); } return L; }
    if (shape === 'banner') { const k = Math.min(h * 0.34, w * 0.1); return [[x0, y0], [x1, y0], [x1 - k, cy], [x1, y1], [x0, y1], [x0 + k, cy]]; }
    if (shape === 'rect') return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    return T.roundRect(x0, y0, x1, y1, Math.min(w, h) * 0.16, detail === 'hd' ? 10 : 5);
  }
  function panelSize(o) {
    const F = fieldBox(o), w = F.w * o.panelW / 100, h = F.h * o.panelD / 100;
    return o.panelShape === 'circle' ? { w: Math.min(w, h), h: Math.min(w, h) } : { w, h };
  }
  function panelPolys(o) {
    const s = panelSize(o);
    return [poly(panelLoop(o.panelShape === 'none' ? 'rect' : o.panelShape, s.w, s.h, o.width / 2, o.depth / 2, o.detail))];
  }
  function panelOn(o) { return o.panelShape !== 'none'; }
  function frameRing(o) {
    if (!panelOn(o) || !o.frame) return [];
    const P = panelPolys(o), a = o.frameInset, b = a + o.frameW;
    return open(T.diffPolys(T.offset(P, -a), T.offset(P, -b)), 0.2, 1);
  }
  // where the text and logo may go
  function safeRegion(o) {
    const P = panelPolys(o), m = o.textMargin + (panelOn(o) && o.frame ? o.frameInset + o.frameW : 0);
    return T.offset(P, -m);
  }

  // ---------------------------------------------------------------- text
  const LC = new Map();
  function lineShape(text, font) { // glyph outlines at a 10 mm cap height, baseline y = 0
    const key = font + '|' + text; if (LC.has(key)) return LC.get(key);
    const dropped = new Set(), r = ST().textLine(text, font, 10, font === 'script' ? 0 : 0.03, dropped);
    const out = { polys: r.polys, b: r.polys.length ? bboxOf(r.polys) : null, dropped: [...dropped] };
    if (LC.size > 3000) LC.clear(); LC.set(key, out); return out;
  }
  // split a line at the space that best balances the two halves
  function wrapLine(text, font) {
    const words = text.split(/\s+/).filter(Boolean); if (words.length < 2) return null;
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
      const wa = (lineShape(a, font).b || { w: 0 }).w, wb = (lineShape(b, font).b || { w: 0 }).w, m = Math.max(wa, wb);
      if (!best || m < best.m) best = { m, parts: [a, b] };
    }
    return best.parts;
  }
  function logoPieces(o) {
    if (!o.logo) return null;
    const all = o.logo.concat(o.logo2 || []), b = bboxOf(all), k = o.logoSize / Math.max(1e-6, b.w, b.h);
    const f = P => movePolys(P, -b.cx * k, -b.cy * k, k);
    return { pieces: [{ polys: f(o.logo), color: o.colors.logo, role: 'logo', name: 'Logo' }].concat(o.logo2 ? [{ polys: f(o.logo2), color: o.colors.logo2, role: 'logo2', name: 'Logo shade 2' }] : []), w: b.w * k, h: b.h * k };
  }
  // the text block (and logo) at nominal size, centered on the origin: [{ polys, color, role, cap }]
  function composeBlock(rows, o) {
    const items = [], placed = [];
    let y = 0, prev = null;
    for (const r of rows) {
      const g = lineShape(r.text, r.font); if (!g.b) continue;
      const s = r.cap / 10, b = { x0: g.b.x0 * s, x1: g.b.x1 * s, y0: g.b.y0 * s, y1: g.b.y1 * s };
      if (prev) y -= 0.3 * Math.max(prev.cap, r.cap);
      const dy = y - b.y1;
      placed.push({ polys: movePolys(g.polys, -((b.x0 + b.x1) / 2), dy, s), color: r.color, role: 'text' + (r.idx + 1), name: 'Text line ' + (r.idx + 1), cap: r.cap, text: r.text, font: r.font });
      y = b.y0 + dy; prev = r;
    }
    const L = logoPieces(o);
    let polys = placed.flatMap(p => p.polys);
    if (L) {
      const tb = polys.length ? bboxOf(polys) : { x0: 0, x1: 0, y0: 0, y1: 0, cx: 0, cy: 0, w: 0, h: 0 };
      const capMax = Math.max(6, ...rows.map(r => r.cap)), gap = polys.length ? Math.max(2, capMax * 0.35) : 0;
      let cx = 0, cy = 0;
      if (!polys.length) { cx = 0; cy = 0; }
      else if (o.logoPos === 'above') { cx = tb.cx; cy = tb.y1 + gap + L.h / 2; }
      else if (o.logoPos === 'below') { cx = tb.cx; cy = tb.y0 - gap - L.h / 2; }
      else if (o.logoPos === 'left') { cx = tb.x0 - gap - L.w / 2; cy = tb.cy; }
      else { cx = tb.x1 + gap + L.w / 2; cy = tb.cy; }
      for (const p of L.pieces) items.push({ ...p, polys: movePolys(p.polys, cx, cy), cap: Infinity });
    }
    items.push(...placed);
    const all = items.flatMap(i => i.polys); if (!all.length) return { items: [], w: 0, h: 0 };
    const b = bboxOf(all);
    return { items: items.map(i => ({ ...i, polys: movePolys(i.polys, -b.cx, -b.cy) })), w: b.w, h: b.h };
  }
  function overflow(items, s, cx, cy, S) {
    const g = items.flatMap(i => movePolys(i.polys, cx, cy, s));
    return g.length ? areaOf(T.diffPolys(g, S)) : 0;
  }
  function fitScale(block, S) {
    if (!block.items.length || !S.length) return null;
    let best = S[0]; for (const P of S) if (areaOf([P]) > areaOf([best])) best = P;
    const sb = bboxOf([best]), cx = sb.cx, cy = sb.cy;
    const up = Math.min(1, sb.w / Math.max(1e-6, block.w), sb.h / Math.max(1e-6, block.h));
    if (up <= 0) return null;
    // the search tests outline points (fast); the exact clipped-area test confirms the answer, stepping down if a
    // concave corner of the panel cuts between two points
    const pts = []; for (const it of block.items) for (const P of it.polys) for (const q of P.outer) pts.push(q);
    const quick = s => pts.every(q => inPolys([cx + q[0] * s, cy + q[1] * s], S));
    const exact = s => overflow(block.items, s, cx, cy, S) < 1e-5;
    if (quick(up) && exact(up)) return { s: up, cx, cy };
    let lo = 0, hi = up;
    for (let k = 0; k < 22 && hi - lo > up * 2e-4; k++) { const m = (lo + hi) / 2; if (quick(m)) lo = m; else hi = m; }
    lo *= 0.995; // a hair of clearance so rounding never touches the edge
    for (let k = 0; k < 40 && lo > 1e-3; k++, lo *= 0.985) if (exact(lo)) return { s: lo, cx, cy };
    return null;
  }
  // Fit the lines (and logo) inside the panel: shrink to fit, and if that leaves the smallest line under the
  // printable minimum, try wrapping one line at a space. Returns positioned 2D pieces in mat coordinates.
  function layoutText(o) {
    const S = safeRegion(o), dropped = new Set();
    const base = o.lines.map((l, idx) => ({ ...l, idx })).filter(l => l.text.trim());
    base.forEach(l => lineShape(l.text, l.font).dropped.forEach(c => dropped.add(c)));
    const cands = [{ rows: base, wrapped: null }];
    base.forEach((l, i) => {
      if (base.length >= LIMITS.maxRows) return;
      const w = wrapLine(l.text, l.font); if (!w) return;
      cands.push({ rows: base.slice(0, i).concat(w.map(t => ({ ...l, text: t }))).concat(base.slice(i + 1)), wrapped: l.idx });
    });
    let best = null;
    for (const c of cands) {
      const block = composeBlock(c.rows, o); if (!block.items.length) continue;
      const f = fitScale(block, S); if (!f) continue;
      const caps = block.items.filter(i => Number.isFinite(i.cap)).map(i => i.cap * f.s), minCap = caps.length ? Math.min(...caps) : Infinity;
      const score = Number.isFinite(minCap) ? minCap : f.s * 100;
      if (!best || score > best.score + 0.05) best = { c, block, f, minCap, score };
      // as typed reads best: wrap only when the typed lines would get small (under 1.25x the printable minimum) or squeezed
      if (c === cands[0] && (f.s >= 0.999 || (minCap >= LIMITS.minCap * 1.25 && f.s >= 0.55))) break;
    }
    if (!best) {
      const any = base.length || o.logo;
      return { pieces: [], minCap: null, scale: 0, wrapped: null, small: !!any, empty: !any, rows: [], dropped: [...dropped], overflow: 0, region: S };
    }
    const { f, block } = best;
    const pieces = block.items.map(i => ({ polys: movePolys(i.polys, f.cx, f.cy, f.s), color: i.color, role: i.role, name: i.name, cap: Number.isFinite(i.cap) ? +(i.cap * f.s).toFixed(2) : null, text: i.text, font: i.font }));
    const minCap = Number.isFinite(best.minCap) ? +best.minCap.toFixed(2) : null;
    return {
      pieces, scale: +f.s.toFixed(4), minCap, wrapped: best.c.wrapped, small: minCap != null && minCap < LIMITS.minCap, empty: false,
      rows: pieces.filter(p => p.text).map(p => ({ text: p.text, font: p.font, cap: p.cap })), dropped: [...dropped],
      overflow: overflow(block.items, f.s, f.cx, f.cy, S), region: S
    };
  }
  // independent check used by the fit audit: every outline point inside the panel's text area and inside the mat
  function fitCheck(o, tl) {
    tl = tl || layoutText(o);
    const S = T.offset(tl.region || safeRegion(o), 0.02), mat = outlinePolys(o), panel = T.offset(panelPolys(o), 0.02);
    let outPts = 0, pts = 0;
    for (const p of tl.pieces) for (const P of p.polys) for (const L of [P.outer, ...P.holes]) for (const q of L) { pts++; if (!inPolys(q, S) || !inPolys(q, mat) || !inPolys(q, panel)) outPts++; }
    const all = tl.pieces.flatMap(p => p.polys), area = all.length ? areaOf(T.diffPolys(all, tl.region || safeRegion(o))) : 0;
    return { points: pts, outside: outPts, area, ok: outPts === 0 && area < 1e-3 };
  }

  // ---------------------------------------------------------------- 3D helpers
  function loftCapped(loops, zs, c) { // star-shaped loops (same vertex count, CCW), fan caps from c
    const n = loops[0].length, out = [];
    const P = (L, i, z) => [L[i][0], L[i][1], z];
    const tri = (a, b, d) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]);
    for (let k = 0; k + 1 < loops.length; k++) for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, A = P(loops[k], i, zs[k]), B = P(loops[k], j, zs[k]), Cc = P(loops[k + 1], j, zs[k + 1]), D = P(loops[k + 1], i, zs[k + 1]);
      tri(A, B, Cc); tri(A, Cc, D);
    }
    const z0 = zs[0], z1 = zs[zs.length - 1], L0 = loops[0], L1 = loops[loops.length - 1];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri([c[0], c[1], z0], P(L0, j, z0), P(L0, i, z0)); tri([c[0], c[1], z1], P(L1, i, z1), P(L1, j, z1)); }
    return Float64Array.from(out);
  }
  function sweepClosed(rings, zs) { // a closed profile swept around the mat: rings[k] at height zs[k], cyclic
    const n = rings[0].length, m = rings.length, out = [];
    for (let k = 0; k < m; k++) {
      const A = rings[k], B = rings[(k + 1) % m], za = zs[k], zb = zs[(k + 1) % m];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        out.push(A[i][0], A[i][1], za, A[j][0], A[j][1], za, B[j][0], B[j][1], zb);
        out.push(A[i][0], A[i][1], za, B[j][0], B[j][1], zb, B[i][0], B[i][1], zb);
      }
    }
    let p = Float64Array.from(out);
    if (C.signedVolume(p) < 0) p = C.flip(p);
    return dropDegenerate(p);
  }
  function dropDegenerate(p) {
    const out = [];
    for (let i = 0; i < p.length; i += 9) {
      const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2], vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * cx + cy * cy + cz * cz > 1e-18) for (let k = 0; k < 9; k++) out.push(p[i + k]);
    }
    return Float64Array.from(out);
  }
  function extrude(polys, z0, z1) { return polys.length && z1 > z0 ? T.extrude(polys, 2, z0, z1) : new Float64Array(0); }
  function moveP(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  function concat(arr) { const n = arr.reduce((s, p) => s + (p ? p.length : 0), 0), q = new Float64Array(n); let k = 0; for (const p of arr) if (p && p.length) { q.set(p, k); k += p.length; } return q; }
  function man(M, p) { const { V, F } = C.weld(p), mm = new M.Mesh({ numProp: 3, vertProperties: Float32Array.from(V), triVerts: Uint32Array.from(F) }); mm.merge(); return new M.Manifold(mm); }
  function soup(m) { const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float64Array(F.length * 3); for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; } return p; }
  // fuse same-color shells (base + nubs + rim, or a same-color panel) so the exported STL/3MF is one
  // solid, not stacked bodies that share the base-top plane and become non-manifold after weld
  function unionMeshes(M, meshes) {
    const live = meshes.filter(p => p && p.length >= 36);
    if (!live.length) return new Float64Array(0);
    if (!M || live.length === 1) return live.length === 1 ? live[0] : concat(live);
    let acc = man(M, live[0]);
    try {
      for (let i = 1; i < live.length; i++) {
        const nxt = man(M, live[i]);
        const u = acc.add(nxt);
        acc.delete(); nxt.delete(); acc = u;
        if (acc.status() !== 'NoError') { acc.delete(); return concat(live); }
      }
      const p = soup(acc); acc.delete(); acc = null;
      return p.length >= 36 ? p : concat(live);
    } catch (e) {
      try { if (acc) acc.delete(); } catch (e2) {}
      return concat(live);
    }
  }

  // ---------------------------------------------------------------- raised pattern
  function studLoop(kind, cx, cy, d, rot, segs) {
    const r = d / 2;
    if (kind === 'round') return T.circle(cx, cy, r, segs);
    if (kind === 'square') { const a = r * 0.86; return [[cx - a, cy - a], [cx + a, cy - a], [cx + a, cy + a], [cx - a, cy + a]]; }
    if (kind === 'hex') { const L = []; for (let i = 0; i < 6; i++) { const t = Math.PI / 6 + i * Math.PI / 3; L.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return L; }
    if (kind === 'diamond') return [[cx, cy - r], [cx + r * 0.78, cy], [cx, cy + r], [cx - r * 0.78, cy]];
    if (kind === 'cross') { const a = r, b = Math.max(0.75, r * 0.34); return [[cx - b, cy - a], [cx + b, cy - a], [cx + b, cy - b], [cx + a, cy - b], [cx + a, cy + b], [cx + b, cy + b], [cx + b, cy + a], [cx - b, cy + a], [cx - b, cy + b], [cx - a, cy + b], [cx - a, cy - b], [cx - b, cy - b]]; }
    if (kind === 'pill') { // rot 0: along x; length d, width rot-independent (passed in segs as {w})
      const w = segs.w, n = segs.n, L = [], hl = Math.max(0, d / 2 - w / 2);
      for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + Math.PI * i / n; L.push([hl + w / 2 * Math.cos(t), w / 2 * Math.sin(t)]); }
      for (let i = 0; i <= n; i++) { const t = Math.PI / 2 + Math.PI * i / n; L.push([-hl + w / 2 * Math.cos(t), w / 2 * Math.sin(t)]); }
      return L.map(p => rot ? [cx - p[1], cy + p[0]] : [cx + p[0], cy + p[1]]);
    }
    return T.circle(cx, cy, r, segs);
  }
  // one tapered stud: the footprint scaled toward its center, with a small chamfer on top (no overhangs)
  function studMesh(loop, cx, cy, z0, h, taper, half) {
    const top = Math.max(0.25, 1 - taper / 100), f = Math.min(0.6, h * 0.12, half * 0.25), k2 = Math.max(0.2, top - f / Math.max(0.5, half));
    const sc = k => loop.map(p => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
    return loftCapped([loop, sc(top), sc(k2)], [z0, z0 + h - f, z0 + h], [cx, cy]);
  }
  // stud centers inside the allowed region (whole footprint inside: no nub is ever cut by the panel or rim)
  function studLayout(o, allowed) {
    const F = fieldBox(o), out = [], p = o.pitch, d = o.nubD;
    if (o.pattern === 'weave') {
      const q = p * 1.3, w = Math.max(1.6, Math.min(d * 0.5, q / 2 - 1.2)), len = q - LIMITS.minGap - 0.2, foot = len / 2 + 0.2;
      const A = T.offset(allowed, -Math.min(foot, w + 0.75));
      const nx = Math.max(1, Math.floor((F.w - 2) / q)), ny = Math.max(1, Math.floor((F.h - 2) / q));
      const x0 = F.x0 + (F.w - nx * q) / 2 + q / 2, y0 = F.y0 + (F.h - ny * q) / 2 + q / 2;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const cx = x0 + i * q, cy = y0 + j * q; if (!inPolys([cx, cy], A)) continue;
        const rot = (i + j) % 2 === 1, off = w / 2 + 0.75;
        const two = [-1, 1].map(s => ({ kind: 'pill', x: cx + (rot ? s * off : 0), y: cy + (rot ? 0 : s * off), rot, d: len, w, foot: len / 2 }));
        // the pair is wider than the cell circle checked above: keep it only when both pills sit wholly inside
        const loops = two.map(s => ({ outer: studLoop('pill', s.x, s.y, s.d, s.rot, { w: s.w, n: 6 }), holes: [] }));
        if (T.polysArea(T.diffPolys(loops, allowed)) > 1e-4) continue;
        out.push(...two);
      }
      return out;
    }
    const foot = o.pattern === 'square' ? d / 2 * 0.86 * Math.SQRT2 : d / 2;
    const A = T.offset(allowed, -foot);
    const py = o.stagger ? p * Math.sqrt(3) / 2 : p;
    const nx = Math.max(1, Math.floor((F.w - d) / p) + 1), ny = Math.max(1, Math.floor((F.h - d) / py) + 1);
    const x0 = F.x0 + (F.w - (nx - 1) * p) / 2, y0 = F.y0 + (F.h - (ny - 1) * py) / 2;
    for (let j = 0; j < ny; j++) {
      const sh = o.stagger && j % 2 ? p / 2 : 0, n = o.stagger && j % 2 ? nx - 1 : nx;
      for (let i = 0; i < n; i++) { const x = x0 + sh + i * p, y = y0 + j * py; if (inPolys([x, y], A)) out.push({ kind: o.pattern, x, y, d, foot }); }
    }
    return out;
  }
  function studGeometry(s, o) {
    const segs = o.detail === 'hd' ? (s.d >= 8 ? 32 : 24) : 12;
    const loop = s.kind === 'pill' ? studLoop('pill', s.x, s.y, s.d, s.rot, { w: s.w, n: o.detail === 'hd' ? 10 : 5 }) : studLoop(s.kind, s.x, s.y, s.d, 0, segs);
    return studMesh(loop, s.x, s.y, o.baseT, o.nubH, o.taper, s.kind === 'pill' ? s.w / 2 : s.d / 2);
  }
  function linePolys(o) { // continuous ridges, laid out over the whole field in mat coordinates
    const F = fieldBox(o), p = Math.max(o.pitch, o.ridgeW + 2), w = o.ridgeW, out = [];
    const X0 = F.x0 - p, X1 = F.x1 + p, Y0 = F.y0 - p, Y1 = F.y1 + p;
    const rect = (a, b, c, d) => poly([[a, b], [c, b], [c, d], [a, d]]);
    if (o.pattern === 'ribs') {
      const n = Math.floor((F.h - w) / p), y0 = F.y0 + (F.h - n * p) / 2;
      for (let j = 0; j <= n; j++) { const y = y0 + j * p; out.push(rect(X0, y - w / 2, X1, y + w / 2)); }
    } else if (o.pattern === 'grid') {
      const q = p * 1.25, nx = Math.floor(F.w / q), ny = Math.floor(F.h / q), xs = F.x0 + (F.w - nx * q) / 2, ys = F.y0 + (F.h - ny * q) / 2;
      for (let i = 0; i <= nx; i++) { const x = xs + i * q; out.push(rect(x - w / 2, Y0, x + w / 2, Y1)); }
      for (let j = 0; j <= ny; j++) { const y = ys + j * q; out.push(rect(X0, y - w / 2, X1, y + w / 2)); }
    } else if (o.pattern === 'waves') {
      const amp = p * 0.32, per = p * 2.4, step = o.detail === 'hd' ? 1 : 2, n = Math.floor(F.h / p), y0 = F.y0 + (F.h - n * p) / 2;
      for (let j = -1; j <= n + 1; j++) {
        const yc = y0 + j * p, top = [], bot = [];
        for (let x = X0; x <= X1 + 1e-9; x += step) { const y = yc + amp * Math.sin((x - o.width / 2) / per * Math.PI * 2); top.push([x, y + w / 2]); bot.push([x, y - w / 2]); }
        out.push(poly(bot.concat(top.reverse())));
      }
    } else if (o.pattern === 'chevron') {
      const amp = p * 0.55, per = p * 1.6, n = Math.floor(F.h / p), y0 = F.y0 + (F.h - n * p) / 2, x00 = o.width / 2 - Math.ceil((o.width / 2 - X0) / per) * per;
      for (let j = -1; j <= n + 1; j++) {
        const yc = y0 + j * p, top = [], bot = [], hw = w / 2 / Math.cos(Math.atan2(amp, per / 2));
        for (let x = x00, k = 0; x <= X1 + per; x += per / 2, k++) { const y = yc + (k % 2 ? amp / 2 : -amp / 2); top.push([x, y + hw]); bot.push([x, y - hw]); }
        out.push(poly(bot.concat(top.reverse())));
      }
    } else if (o.pattern === 'honeycomb') {
      const R = p * 0.62, hR = R * Math.sqrt(3), cw = R * 1.5;
      const ring6 = (cx, cy, r) => { const L = []; for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; L.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return L; };
      const cx0 = o.width / 2, cy0 = o.depth / 2, ni = Math.ceil((X1 - X0) / cw / 2) + 1, nj = Math.ceil((Y1 - Y0) / hR / 2) + 1;
      for (let i = -ni; i <= ni; i++) for (let j = -nj; j <= nj; j++) {
        const cx = cx0 + i * cw, cy = cy0 + j * hR + (i % 2 ? hR / 2 : 0);
        const outer = ring6(cx, cy, R + w / 2 / Math.cos(Math.PI / 6) * 0.5), inner = ring6(cx, cy, R - w / 2 / Math.cos(Math.PI / 6) * 1.5).reverse();
        out.push({ outer, holes: [inner] });
      }
    }
    return T.unionPolys(out);
  }
  // the area a pattern may cover: inside the rim (clear of a drip channel) and clear of the panel, text and logo
  function allowedRegion(o, tl) {
    const edge = rimOn(o) ? (o.edge === 'channel' ? o.chanW + 1.2 : 1.2) : 2.5;
    let A = T.offset(fieldPolys(o), -edge);
    let keep = [];
    if (panelOn(o)) keep = T.offset(panelPolys(o), 2.5);
    else if (tl && tl.pieces.length) keep = T.offset(T.unionPolys(tl.pieces.flatMap(p => p.polys)), 2.2);
    if (keep.length) A = T.diffPolys(A, keep);
    return A;
  }

  // ---------------------------------------------------------------- rim
  function rimProfile(o) { // [d (inset from the outer edge), z] from the outer bottom, over the top, to the inner bottom
    const w = o.rimW, z0 = o.baseT, top = z0 + o.rimTop - (o.rimStyle === 'ribbed' || o.rimStyle === 'rope' ? Math.min(1, o.rimTop * 0.3) : 0);
    const lip = o.edge === 'lip', inner = lip ? w - o.lipW : w, h = top - z0, P = [[0, z0]];
    if (o.rimStyle === 'rounded') {
      const r = Math.min(h * 0.9, inner * 0.45, 4), n = o.detail === 'hd' ? 6 : 3;
      for (let i = 0; i <= n; i++) { const t = Math.PI - Math.PI / 2 * i / n; P.push([r + r * Math.cos(t), top - r + r * Math.sin(t)]); }
      if (lip) P.push([inner, top]);
      else for (let i = 0; i <= n; i++) { const t = Math.PI / 2 - Math.PI / 2 * i / n; P.push([w - r + r * Math.cos(t), top - r + r * Math.sin(t)]); }
    } else if (o.rimStyle === 'beveled') {
      const c = Math.min(h * 0.6, inner * 0.35, 3);
      P.push([0, top - c], [c, top]);
      if (lip) P.push([inner, top]); else P.push([w - c, top], [w, top - c]);
    } else {
      P.push([0, top]); if (lip) P.push([inner, top]); else P.push([w, top]);
    }
    if (lip) P.push([inner, top + o.edgeH], [w, top + o.edgeH]);
    P.push([w, z0]);
    return { P, top };
  }
  function rimMesh(o) {
    if (!rimOn(o)) return null;
    const { P } = rimProfile(o), rings = [], zs = [];
    for (const [d, z] of P) { const L = rings[rings.length - 1], z1 = zs[zs.length - 1]; if (L && Math.abs(L.d - d) < 1e-9 && Math.abs(z1 - z) < 1e-9) continue; rings.push({ d, L: ring(o, d) }); zs.push(z); }
    return sweepClosed(rings.map(r => r.L), zs);
  }
  function rimDeco(o) { // ribbed / rope: raised bars across the rim top
    if (o.rimStyle !== 'ribbed' && o.rimStyle !== 'rope') return [];
    const w = o.rimW - (o.edge === 'lip' ? o.lipW : 0), mid = ring(o, w / 2), bw = 1.6, pitch = o.rimStyle === 'rope' ? 3.2 : 4.2, bars = [];
    let acc = pitch / 2;
    for (let i = 0; i < mid.length; i++) {
      const a = mid[i], b = mid[(i + 1) % mid.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-9) continue;
      const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L, nx = ty, ny = -tx;
      while (acc <= L) {
        const cx = a[0] + tx * acc, cy = a[1] + ty * acc, hw = w / 2 + 1.5, sk = o.rimStyle === 'rope' ? hw * 0.9 : 0;
        bars.push(poly([[cx - tx * bw / 2 + nx * hw + tx * sk, cy - ty * bw / 2 + ny * hw + ty * sk], [cx + tx * bw / 2 + nx * hw + tx * sk, cy + ty * bw / 2 + ny * hw + ty * sk], [cx + tx * bw / 2 - nx * hw - tx * sk, cy + ty * bw / 2 - ny * hw - ty * sk], [cx - tx * bw / 2 - nx * hw - tx * sk, cy - ty * bw / 2 - ny * hw - ty * sk]]));
        acc += pitch;
      }
      acc -= L;
    }
    const band = T.diffPolys([poly(ring(o, 0.8))], [poly(ring(o, w - 0.8))]);
    return open(T.interPolys(T.unionPolys(bars), band), 0.3, 0.8);
  }

  // ---------------------------------------------------------------- tiles
  function jointSpec() { const J = DM().jointSpec({ material: 'tpu' }); return J; }
  // split a length into tiles no longer than F, keeping every seam out of [b0, b1] (the panel band) when possible
  function seams(L, F, b0, b1, gaps) {
    if (L <= F + 1e-6) return { sizes: [L], clear: true };
    const ok = s => { const cuts = [0, ...s, L]; for (let i = 1; i < cuts.length; i++) { const g = cuts[i] - cuts[i - 1]; if (g > F + 1e-6 || g < 30) return false; } return true; };
    const n0 = Math.ceil(L / F);
    for (let n = n0; n <= n0 + 3; n++) {
      let s = []; for (let k = 1; k < n; k++) s.push(L * k / n);
      s = s.map(x => (x > b0 && x < b1) ? (x - b0 < b1 - x ? b0 : b1) : x);
      if (gaps && gaps.length) s = s.map(x => { let best = x, bd = Infinity; for (const g of gaps) { const dd = Math.abs(g - x); if (dd < bd && !(g > b0 && g < b1)) { bd = dd; best = g; } } return bd < 8 ? best : x; });
      s = [...new Set(s.map(x => +x.toFixed(4)))].sort((a, b) => a - b);
      if (s.length === n - 1 && ok(s)) return { sizes: [0, ...s, L].slice(1).map((x, i, a) => +(x - (i ? a[i - 1] : 0)).toFixed(4)), clear: true };
    }
    const n = n0, sizes = []; for (let k = 0; k < n; k++) sizes.push(+(L / n).toFixed(4));
    return { sizes, clear: false };
  }
  function layout(o, studs) {
    const J = jointSpec(), U = usable(o), W = o.width, D = o.depth;
    const maxW = Math.max(30, U.w - J.depth), maxD = Math.max(30, U.d - J.depth);
    const ps = panelSize(o), pad = 3;
    const bx0 = W / 2 - ps.w / 2 - pad, bx1 = W / 2 + ps.w / 2 + pad, by0 = D / 2 - ps.h / 2 - pad, by1 = D / 2 + ps.h / 2 + pad;
    // seam snap targets: midway between stud columns / rows
    const colsX = studs && studs.length && !o.stagger ? [...new Set(studs.map(s => +s.x.toFixed(3)))].sort((a, b) => a - b) : [];
    const rowsY = studs && studs.length ? [...new Set(studs.map(s => +s.y.toFixed(3)))].sort((a, b) => a - b) : [];
    const mids = v => v.slice(1).map((x, i) => (x + v[i]) / 2);
    // a mat that fits the bed prints in one piece (no tabs); otherwise the tabs' depth has to fit too
    const X = W <= U.w + 1e-6 ? { sizes: [W], clear: true } : seams(W, maxW, bx0, bx1, mids(colsX));
    const Y = D <= U.d + 1e-6 ? { sizes: [D], clear: true } : seams(D, maxD, by0, by1, o.stagger ? [] : mids(rowsY));
    const cols = X.sizes, rows = Y.sizes, tiles = [];
    let y = 0;
    for (let j = 0; j < rows.length; j++) {
      let x = 0;
      for (let i = 0; i < cols.length; i++) {
        tiles.push({ ix: i, iy: j, x, y, fieldW: cols[i], fieldD: rows[j], xm: i > 0 ? 'female' : 'none', xp: i < cols.length - 1 ? 'male' : 'none', ym: j > 0 ? 'female' : 'none', yp: j < rows.length - 1 ? 'male' : 'none', r00: i === 0 && j === 0, r10: i === cols.length - 1 && j === 0, r01: i === 0 && j === rows.length - 1, r11: i === cols.length - 1 && j === rows.length - 1 });
        x += cols[i];
      }
      y += rows[j];
    }
    return { W, D, cols, rows, tiles, joint: J, panelClear: cols.length * rows.length === 1 || (X.clear && Y.clear) };
  }
  function tileOutlineGlobal(t, o, J) {
    const loop = DM().tileOutline(t, { radius: o.radius, detail: o.detail }, J);
    return loop.map(p => [p[0] + t.x, p[1] + t.y]);
  }

  // ---------------------------------------------------------------- build
  function colorList(o, tl) {
    const cols = [], add = c => { if (c && !cols.includes(c)) cols.push(c); };
    add(o.colors.base); if (rimOn(o)) add(o.colors.rim); if (panelOn(o)) add(o.colors.panel);
    if (panelOn(o) && o.frame) add(o.colors.frame);
    for (const p of (tl ? tl.pieces : [])) add(p.color);
    return cols;
  }
  function build(raw, M) {
    const o = options(raw), warnings = [], tl = layoutText(o);
    const allowed = allowedRegion(o, tl);
    const pat = PATTERNS.find(p => p.id === o.pattern);
    const studs = pat.kind === 'stud' ? studLayout(o, allowed) : [];
    const L = layout(o, studs), J = L.joint, multi = L.tiles.length > 1;
    if (multi && !M) throw new Error('The 3D engine is still loading. Try again in a moment.');
    // global (mat coordinate) geometry, built once
    const zPanel = o.baseT + o.panelTop, zText0 = panelOn(o) ? zPanel : o.baseT, zText1 = panelOn(o) ? zPanel + o.textRaise : o.baseT + Math.max(o.nubH, o.textRaise);
    const studMeshes = studs.map(s => ({ s, p: studGeometry(s, o) }));
    let lines2D = [];
    if (pat.kind === 'line') lines2D = open(T.interPolys(linePolys(o), allowed), Math.min(0.4, o.ridgeW * 0.3), 2);
    const rim = rimMesh(o), deco = rimDeco(o), rimTopZ = rimProfile(o).top;
    const panel = panelOn(o) ? panelPolys(o) : [], frame = frameRing(o);
    const chanRing = rimOn(o) && o.edge === 'channel' && o.chanD >= 0.6 ? T.diffPolys([poly(ring(o, o.rimW - 0.01))], [poly(ring(o, o.rimW + o.chanW))]) : [];
    if (rimOn(o) && o.edge === 'channel' && o.chanD < 0.6) warnings.push('A drip channel needs a base at least 1.6 mm thick. The channel was left out.');
    const ridge = (polys, z0, z1) => { // tapered ridges: three stacked steps narrowing toward the top
      if (!polys.length) return new Float64Array(0);
      if (o.taper < 5) return extrude(polys, z0, z1);
      const h = z1 - z0, inset = Math.min(o.ridgeW * 0.3, o.ridgeW * o.taper / 100 * 0.5);
      const l1 = T.offset(polys, -inset * 0.5), l2 = T.offset(polys, -inset);
      return T.steppedExtrude([{ z0, z1: z0 + h * 0.6, polys }, { z0: z0 + h * 0.6, z1: z0 + h * 0.85, polys: l1.length ? l1 : polys }, { z0: z0 + h * 0.85, z1, polys: l2.length ? l2 : (l1.length ? l1 : polys) }]);
    };
    // flat shapes to solids; a glyph whose holes touch its outline (or another hole) can triangulate with a crack, so a
    // shape that does not come out closed is cleaned (a hair-thin opening) and extruded again
    const solid2 = (polys, z0, z1) => {
      let p = extrude(polys, z0, z1);
      if (p.length && !C.checkClosed(p).closed) { const q = extrude(T.offset(T.offset(polys, -0.01), 0.01), z0, z1); if (C.checkClosed(q).closed) p = q; }
      return p;
    };
    const parts = [], placed = [];
    for (const t of L.tiles) {
      const outline = [poly(tileOutlineGlobal(t, o, J))];
      const fullyInside = (polys, pad) => {
        if (!polys.length) return true;
        const S = pad ? T.offset(outline, -pad) : outline;
        if (!S.length) return false;
        for (const P of polys) for (const L of [P.outer, ...(P.holes || [])]) for (const q of L) if (!inPolys(q, S)) return false;
        return true;
      };
      // clip only shapes that actually cross a tile edge; a no-op intersection can still
      // drop holes if the logo's hole winding was wrong, so leave fully-inside shapes alone
      const clip2 = polys => {
        if (!multi || fullyInside(polys, 0.4)) return polys;
        return open(T.interPolys(polys, outline), 0.3, 0.8);
      };
      const pieces = [];
      const add = (role, name, color, p) => { if (p && p.length >= 36) pieces.push({ role, name, color, p }); };
      // base (with a drip channel groove)
      if (chanRing.length) add('base', 'Base', o.colors.base, T.steppedExtrude([{ z0: 0, z1: o.baseT - o.chanD, polys: outline }, { z0: o.baseT - o.chanD, z1: o.baseT, polys: T.diffPolys(outline, chanRing) }]));
      else add('base', 'Base', o.colors.base, solid2(outline, 0, o.baseT));
      // studs: whole inside the tile, or clipped to it (the pieces meet again when the tiles snap together)
      if (studMeshes.length) {
        const tb = bboxOf(outline), keep = [];
        let prism = null;
        try {
          for (const { s, p } of studMeshes) {
            const r = s.foot + 0.6;
            if (s.x + r < tb.x0 || s.x - r > tb.x1 || s.y + r < tb.y0 || s.y - r > tb.y1) continue;
            if (!multi) { keep.push(p); continue; }
            const inside = [[s.x - r, s.y - r], [s.x + r, s.y - r], [s.x + r, s.y + r], [s.x - r, s.y + r]].every(q => inPolys(q, outline));
            if (inside) { keep.push(p); continue; }
            if (!inPolys([s.x, s.y], T.offset(outline, r)) ) continue;
            if (!prism) prism = man(M, extrude(outline, o.baseT - 0.5, o.baseT + o.nubH + 0.5));
            const a = man(M, p), d = a.intersect(prism);
            if (d.status() === 'NoError' && !d.isEmpty()) { const q = soup(d), b = C.bbox(q); if (Math.min(b.max[0] - b.min[0], b.max[1] - b.min[1]) >= 0.8) keep.push(q); }
            d.delete(); a.delete();
          }
        } finally { if (prism) prism.delete(); }
        add('nubs', 'Nubs', o.colors.base, concat(keep));
      }
      if (lines2D.length) add('nubs', 'Ridges', o.colors.base, ridge(clip2(lines2D), o.baseT, o.baseT + o.nubH));
      // rim
      if (rim) {
        let rp = rim;
        if (multi) { const pr = man(M, extrude(outline, o.baseT - 1, o.baseT + o.rimTop + o.edgeH + 2)), a = man(M, rim), d = a.intersect(pr); rp = d.status() === 'NoError' && !d.isEmpty() ? soup(d) : new Float64Array(0); d.delete(); a.delete(); pr.delete(); }
        add('rim', 'Rim', o.colors.rim, rp);
        if (deco.length) add('rim', 'Rim pattern', o.colors.rim, solid2(clip2(deco), rimTopZ, o.baseT + o.rimTop));
      }
      // panel, frame, text, logo
      if (panel.length) add('panel', 'Center panel', o.colors.panel, solid2(clip2(panel), o.baseT, zPanel));
      if (frame.length) add('frame', 'Panel frame', o.colors.frame, solid2(clip2(frame), zPanel, zPanel + o.textRaise));
      for (const tp of tl.pieces) add(tp.role, tp.name, tp.color, solid2(clip2(tp.polys), zText0, zText1));
      // merge pieces of the same color into one fused solid per color (base + nubs + rim, etc.)
      const byColor = [];
      for (const pc of pieces) { let g = byColor.find(b => b.color === pc.color); if (!g) { g = { color: pc.color, names: [], roles: [], bits: [] }; byColor.push(g); } g.names.push(pc.name); g.roles.push(pc.role); g.bits.push(pc.p); }
      const name = multi ? `Tile ${t.ix + 1},${t.iy + 1}` : 'Bar mat';
      const colorParts = byColor.map(g => ({ name: `${name} ${partLabel(g.roles)}`, color: g.color, roles: [...new Set(g.roles)], p: moveP(unionMeshes(M, g.bits), -t.x, -t.y, 0) }));
      const local = concat(colorParts.map(c => c.p)), b = C.bbox(local), sz = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
      const U = usable(o), fits = ((sz[0] <= U.w + 0.05 && sz[1] <= U.d + 0.05) || (sz[1] <= U.w + 0.05 && sz[0] <= U.d + 0.05)) && sz[2] <= U.z;
      if (!fits) warnings.push(`${name} (${Math.round(sz[0])} \u00d7 ${Math.round(sz[1])} mm) is bigger than your bed.`);
      parts.push({ kind: 'tile', name, tile: t, colorParts, pieces: pieces.map(pc => ({ role: pc.role, name: pc.name, color: pc.color, p: moveP(pc.p, -t.x, -t.y, 0) })), local, size: sz, fits });
      for (const pc of pieces) placed.push({ p: pc.p, color: pc.color, name: `${name} ${pc.name.toLowerCase()}`, role: pc.role });
    }
    // notes and warnings
    if (tl.small) warnings.push(`The smallest text is ${tl.minCap} mm tall, under the ${LIMITS.minCap} mm that prints crisply in TPU. Shorten the text, use fewer lines or make the panel bigger.`);
    if (tl.dropped.length) warnings.push(`These characters are not in the chosen font and were left out: ${tl.dropped.join(' ')}`);
    if (multi && !L.panelClear && panelOn(o)) warnings.push('The center panel is wider than one tile on this printer, so a seam crosses it. Make the panel narrower or pick a bigger printer to keep it in one piece.');
    if (o.nubH > o.nubD * 2.2 && pat.kind === 'stud') warnings.push('Tall, thin nubs wobble in TPU. Keep the height under about twice the nub size, or add taper.');
    let vol = 0; for (const pt of parts) for (const c of pt.colorParts) vol += Math.abs(C.signedVolume(c.p));
    const fils = colorList(o, tl);
    const stats = {
      tiles: parts.length, cols: L.cols.length, rows: L.rows.length, width: o.width, depth: o.depth,
      height: +(Math.max(o.baseT + o.nubH, o.baseT + o.rimTop + (o.edge === 'lip' && rimOn(o) ? o.edgeH : 0), zText1, panelOn(o) && o.frame ? zPanel + o.textRaise : 0)).toFixed(2),
      nubs: studs.length, ridgeArea: Math.round(lines2D ? T.polysArea(lines2D) : 0), pattern: o.pattern, colors: fils.length, grams: Math.round(vol / 1000 * 1.21),
      tris: parts.reduce((s, p) => s + p.local.length / 9, 0), minCap: tl.minCap, textScale: tl.scale, wrapped: tl.wrapped
    };
    return { options: o, layout: L, parts, placed, stats, warnings, text: tl, filaments: fils.map(c => ({ color: c })) };
  }
  function partLabel(roles) {
    const u = [...new Set(roles)];
    if (u.every(r => r === 'base' || r === 'nubs')) return 'base';
    if (u.length === 1) return u[0].replace(/^text(\d)$/, 'text $1').replace('logo2', 'logo shade 2');
    return u.map(r => r.replace(/^text(\d)$/, 'text $1').replace('logo2', 'logo shade 2')).filter((r, i, a) => a.indexOf(r) === i).join(' + ');
  }

  function gateInfo(raw, tlIn) {
    const o = options(raw), reasons = [];
    if (o.width > FREE.maxW || o.depth > FREE.maxD) reasons.push(`a mat bigger than ${FREE.maxW / 10} \u00d7 ${FREE.maxD / 10} cm`);
    const n = colorList(o, tlIn || { pieces: [].concat(o.lines.filter(l => l.text.trim()).map(l => ({ color: l.color })), o.logo ? [{ color: o.colors.logo }] : [], o.logo2 ? [{ color: o.colors.logo2 }] : []) }).length;
    if (n > FREE.maxColors) reasons.push(`${n} colors (free: up to ${FREE.maxColors})`);
    if (o.logo) reasons.push('an uploaded logo');
    return { pro: reasons.length > 0, reasons, colors: n, width: o.width, depth: o.depth };
  }

  // ---------------------------------------------------------------- plates and files
  function printList(res) { return res.parts.map(pt => ({ name: pt.name, p: pt.local, color: pt.colorParts[0] ? pt.colorParts[0].color : res.options.colors.base, parts: pt.colorParts.map(c => ({ name: c.name, p: c.p, color: c.color })) })); }
  function arrangePlates(res) {
    const U = usable(res.options), src = printList(res);
    const A = PL.arrange(src.map(it => ({ name: it.name, p: it.p, color: it.color, _parts: it.parts })), U.w, U.d, { gap: 4, maxZ: U.z });
    for (const list of A.plates) for (const it of list) {
      const s = src.find(q => q.name === it.name && !q._used); if (s) s._used = true;
      const parts = (s || it)._parts || it._parts || (s && s.parts); if (!parts) continue;
      const bb = C.bbox(s ? s.p : it.p);
      it.parts = parts.map(q => { let p = moveP(q.p, -bb.min[0], -bb.min[1], -bb.min[2]); if (it.rot) p = PL.turn(p); return { name: q.name, p: PL.move(p, it.x, it.y), color: q.color }; });
    }
    return A;
  }
  function export3MF(res, eo) {
    eo = eo || {};
    const cols = res.filaments.map(f => f.color), A = arrangePlates(res), objs = [], plates = [];
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, parts: (it.parts || [{ name: it.name, p: it.p, color: it.color }]).map(q => ({ name: q.name, p: q.p, color: q.color, extruder: cols.indexOf(q.color) + 1 })) }); }); plates.push(ids); });
    A.unfit.forEach(u => { const s = res.parts.find(p => p.name === u.name); plates.push([objs.length]); objs.push({ name: u.name, parts: (s ? s.colorParts : []).map(q => ({ name: q.name, p: q.p, color: q.color, extruder: cols.indexOf(q.color) + 1 })) }); });
    return T.threeMF(objs, { title: eo.name || 'Bar mat', plates, bambu: eo.bambu === undefined ? res.options.bambu : eo.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const o = res.options, st = res.stats, L = ['Expressarte bar mat', ''];
    L.push(`Mat ${o.width} \u00d7 ${o.depth} mm, ${st.height} mm tall overall, ${st.tiles === 1 ? 'one piece' : st.tiles + ' tiles (' + st.cols + ' \u00d7 ' + st.rows + ') that snap together'}.`);
    L.push(`Pattern: ${PATTERNS.find(p => p.id === o.pattern).label.toLowerCase()}, ${o.nubH} mm tall, ${o.nubD} mm, ${o.pitch} mm spacing, ${o.taper}% taper. Rim: ${RIMS.find(r => r.id === o.rimStyle).label.toLowerCase()}${o.edge !== 'none' && rimOn(o) ? ' with a ' + EDGES.find(e => e.id === o.edge).label.toLowerCase() : ''}. Panel: ${PANELS.find(p => p.id === o.panelShape).label.toLowerCase()}.`);
    if (res.text.rows.length) L.push(`Text: ${res.text.rows.map(r => `"${r.text}" ${r.cap} mm`).join(', ')}.`);
    L.push('', 'Filaments'); res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}`));
    L.push('', 'Print these'); for (const pt of res.parts) L.push(`  ${pt.name}  ${Math.round(pt.size[0])} \u00d7 ${Math.round(pt.size[1])} \u00d7 ${pt.size[2].toFixed(1)} mm  (${pt.colorParts.length} color${pt.colorParts.length === 1 ? '' : 's'})`);
    L.push('', 'Printing',
      '  - TPU 95A is recommended: it grips the bar, stays quiet and flexes. PLA, PETG or another plastic also works for a stiffer mat.',
      '  - Print flat as exported, no supports. Every nub and edge is tapered or vertical, with no overhangs.',
      '  - TPU: 0.2 mm layers, 2-3 walls, 15% infill, slow outer walls (about 25-40 mm/s), retraction low, a dry spool.',
      '  - The 3MF opens with each color on its own filament. Text and logo are separate bodies stacked on the panel for multicolor printing.');
    if (st.tiles > 1) L.push('  - Tiles snap together along flat-locking dovetail edges. Start at one end and press each joint down.');
    if (res.warnings.length) { L.push('', 'Notes'); res.warnings.forEach(w => L.push('  - ' + w)); }
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, eo) {
    eo = eo || {}; const base = eo.fileBase || 'bar_mat', slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase(), out = [];
    out.push({ name: `${base}.3mf`, data: export3MF(res, eo) });
    for (const pt of res.parts) for (const c of pt.colorParts) out.push({ name: `stl/${base}_${slug(c.name)}.stl`, data: new Uint8Array(C.writeSTL(c.p, c.name)) });
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }

  const api = { PATTERNS, RIMS, EDGES, PANELS, FONTS, LOGO_POS, PALETTE, FREE, LIMITS, SIZES, DEFAULTS, PRESETS, options, presetOptions, squareFor, sizeFor, usable,
    panelPolys, panelSize, safeRegion, frameRing, layoutText, fitCheck, allowedRegion, studLayout, linePolys, rimProfile, rimMesh, layout, seams, build, gateInfo, colorList,
    printList, arrangePlates, export3MF, notes, files };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPBarMat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
