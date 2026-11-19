/* Expressarte sign and nameplate maker: text (bubble fonts) on a shaped backplate with an optional frame and built-in
   icons or an uploaded SVG, plus stand / keyhole / screw / corner / hang-hole / magnet / adhesive mounts.
   Text always stays on the plate: it is fitted inside the plate shape minus the frame, margin and any mounting holes
   (shrink to fit, fill the plate, or grow the plate). Raised, engraved or flush-inlay letters. Multicolor 3MF:
   backplate, text and frame on separate filaments. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);

  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    text: 'OPEN', font: 'round', textH: 28, fit: 'shrink', wrap: true, align: 'center', lineGap: 0.25, tracking: 0, subScale: 100,
    margin: 4, style: 'raised', raise: 1.0, depth: 0.8,
    shape: 'rounded', width: 120, height: 50, corner: 6, baseT: 2.4,
    borderStyle: 'line', borderW: 2.2, borderInset: 2, borderRaise: 0.8,
    icon: 'none', iconSize: 18, iconPos: 'left', svg: null,
    mount: 'none', screwD: 4.5, magD: 6, magT: 3,
    colors: { base: PZ.cream, text: '#1A1A1A', border: PZ.babyBlue },
    bed: [256, 256], bambu: 'A1', detail: 'hd'
  };
  const LIMITS = { freeMaxMM: 120, freeMaxChars: 12, minLetterMM: 6 };
  const SHAPES = {
    rounded: { label: 'Rounded rectangle' }, rectangle: { label: 'Rectangle' }, pill: { label: 'Pill' }, oval: { label: 'Oval' },
    circle: { label: 'Circle' }, hex: { label: 'Hexagon' }, octagon: { label: 'Octagon' }, arch: { label: 'Arch' },
    banner: { label: 'Banner' }, shield: { label: 'Shield' }
  };
  const ICONS = {
    none: { label: 'None' }, star: { label: 'Star' }, heart: { label: 'Heart' }, house: { label: 'House' },
    leaf: { label: 'Leaf' }, bolt: { label: 'Bolt' }, check: { label: 'Check' }, smile: { label: 'Smile' },
    paw: { label: 'Paw' }, arrow: { label: 'Arrow' }, music: { label: 'Music note' }
  };
  const MOUNTS = {
    none: { label: 'None' }, stand: { label: 'Shelf stand' }, keyhole: { label: 'Wall keyholes' }, screws: { label: 'Screw holes' },
    corners: { label: 'Corner holes' }, hang: { label: 'Hanging holes' }, magnets: { label: 'Magnet pockets' }, adhesive: { label: 'Adhesive strip pockets' }
  };
  const FITS = { shrink: { label: 'Shrink to fit' }, fill: { label: 'Fill the plate' }, grow: { label: 'Grow the plate' } };
  const STYLES = { raised: { label: 'Raised' }, engraved: { label: 'Engraved' }, inlay: { label: 'Flush inlay' } };
  const BORDERS = { none: { label: 'None' }, line: { label: 'Single' }, double: { label: 'Double' } };
  // common sign sizes (mm); a preset only sets the plate, the text still fits itself
  const PRESETS = {
    door: { label: 'Door sign', width: 150, height: 50, shape: 'rounded' },
    desk: { label: 'Desk nameplate', width: 200, height: 55, shape: 'rectangle', mount: 'stand' },
    nametag: { label: 'Name tag', width: 76, height: 25, shape: 'rounded', mount: 'magnets' },
    label: { label: 'Shelf or bin label', width: 80, height: 25, shape: 'rounded', mount: 'adhesive' },
    house: { label: 'House number', width: 220, height: 90, shape: 'rounded', mount: 'screws' },
    mailbox: { label: 'Mailbox', width: 160, height: 45, shape: 'pill', mount: 'adhesive' },
    room: { label: 'Kids room', width: 180, height: 80, shape: 'arch', mount: 'keyhole' },
    round: { label: 'Round plaque', width: 120, height: 120, shape: 'circle', mount: 'hang' }
  };
  const PALETTE = [
    { name: 'White', hex: '#F7F7F2' }, { name: 'Black', hex: '#1A1A1A' }, { name: 'Navy', hex: '#1E3A5F' },
    { name: 'Red', hex: '#C8102E' }, { name: 'Forest', hex: '#1E7B46' }, { name: 'Gold', hex: '#D4A72C' },
    { name: 'Sky', hex: '#4A90D9' }, { name: 'Orange', hex: '#E07A3A' }
  ];
  const clamp = (v, lo, hi, d) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };

  function options(raw) {
    raw = raw || {};
    const o = Object.assign({}, DEFAULTS, raw);
    o.text = String(o.text == null ? '' : o.text);
    o.textH = clamp(o.textH, 4, 150, DEFAULTS.textH);
    if (!FITS[o.fit]) o.fit = 'shrink';
    o.wrap = o.wrap !== false && o.wrap !== 'false';
    if (!['left', 'center', 'right'].includes(o.align)) o.align = 'center';
    o.lineGap = clamp(o.lineGap, 0, 1.5, DEFAULTS.lineGap);
    o.tracking = clamp(o.tracking, -15, 80, 0);
    o.subScale = clamp(o.subScale, 30, 100, 100);
    o.margin = clamp(raw.margin != null ? raw.margin : raw.pad != null ? raw.pad : o.margin, 1, 30, DEFAULTS.margin);
    if (!STYLES[o.style]) o.style = 'raised';
    o.raise = clamp(o.raise, 0.4, 5, DEFAULTS.raise);
    o.depth = clamp(o.depth, 0.4, 3, DEFAULTS.depth);
    if (!SHAPES[o.shape]) o.shape = 'rounded';
    o.width = clamp(o.width, 20, 300, DEFAULTS.width);
    o.height = clamp(o.height, 12, 300, DEFAULTS.height);
    if (o.shape === 'circle') o.height = o.width; // the circle's size is its diameter
    o.corner = clamp(o.corner, 0, 60, 0);
    o.baseT = clamp(o.baseT, 1.2, 10, DEFAULTS.baseT);
    if (raw.borderStyle == null && raw.border != null) o.borderStyle = raw.border ? 'line' : 'none';
    if (!BORDERS[o.borderStyle]) o.borderStyle = 'line';
    o.border = o.borderStyle !== 'none';
    o.borderW = clamp(o.borderW, 0.8, 10, DEFAULTS.borderW);
    o.borderInset = clamp(o.borderInset, 0, 20, DEFAULTS.borderInset);
    if (o.style !== 'raised') o.borderInset = Math.max(1.2, o.borderInset); // an engraved frame keeps a wall to the edge
    o.borderRaise = clamp(o.borderRaise, 0.3, 4, DEFAULTS.borderRaise);
    o.iconSize = clamp(o.iconSize, 6, 80, DEFAULTS.iconSize);
    if (!ICONS[o.icon]) o.icon = 'none';
    if (!['left', 'right', 'above', 'both'].includes(o.iconPos)) o.iconPos = 'left';
    if (!MOUNTS[o.mount]) o.mount = 'none';
    o.screwD = clamp(o.screwD, 2, 8, DEFAULTS.screwD);
    o.magD = clamp(o.magD, 3, 20, DEFAULTS.magD);
    o.magT = clamp(o.magT, 1, 6, DEFAULTS.magT);
    o.colors = Object.assign({}, DEFAULTS.colors, o.colors || {});
    if (!Bubble.FONTS[o.font]) o.font = 'round';
    o.bed = Array.isArray(o.bed) && o.bed[0] > 0 && o.bed[1] > 0 ? o.bed : DEFAULTS.bed;
    return o;
  }

  // ---------------------------------------------------------------- plate shapes
  function plateLoop(shape, w, h, corner) {
    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
    if (shape === 'circle') return T.circle(0, 0, w / 2, 120);
    if (shape === 'oval') { const L = []; for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; L.push([w / 2 * Math.cos(a), h / 2 * Math.sin(a)]); } return L; }
    if (shape === 'hex') { // flat-top hexagon stretched to the box: pointed left and right ends
      const n = Math.min(w * 0.25, h * 0.5);
      return [[x0, 0], [x0 + n, y0], [x1 - n, y0], [x1, 0], [x1 - n, y1], [x0 + n, y1]];
    }
    if (shape === 'octagon') { const c = Math.min(w, h) * 0.24; return [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]]; }
    if (shape === 'pill') return T.roundRect(x0, y0, x1, y1, Math.min(w, h) / 2, 24);
    if (shape === 'banner') { const n = Math.min(h * 0.32, w * 0.1); return [[x0, y0], [x1, y0], [x1 - n, 0], [x1, y1], [x0, y1], [x0 + n, 0]]; }
    if (shape === 'shield') { // flat top, straight sides, curved point at the bottom
      const L = [[x0, y1], [x0, y0 + h * 0.45]], N = 24;
      for (let i = 1; i < N; i++) { const t = i / N, a = Math.PI * (1 - t); L.push([w / 2 * Math.cos(a) * (1 - 0.15 * Math.sin(a)), y0 + h * 0.45 - h * 0.45 * Math.sin(a) * 1]); }
      L.push([x1, y0 + h * 0.45], [x1, y1]);
      return L;
    }
    if (shape === 'arch') { // straight sides and bottom (small rounded corners), round arch on top
      const a = Math.min(h * 0.4, w * 0.5), N = 40, rc = Math.max(0, Math.min(corner, w / 4, (h - a) / 2 - 0.5)), L = [];
      const n = rc > 0.5 ? 8 : 0;
      if (n) { for (let i = 0; i <= n; i++) { const t = Math.PI + Math.PI / 2 * i / n; L.push([x0 + rc + rc * Math.cos(t), y0 + rc + rc * Math.sin(t)]); }
        for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + Math.PI / 2 * i / n; L.push([x1 - rc + rc * Math.cos(t), y0 + rc + rc * Math.sin(t)]); } }
      else L.push([x0, y0], [x1, y0]);
      for (let i = 0; i <= N; i++) { const t = Math.PI * i / N; const p = [w / 2 * Math.cos(t), y1 - a + a * Math.sin(t)]; const q = L[L.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) L.push(p); }
      if (Math.hypot(L[0][0] - L[L.length - 1][0], L[0][1] - L[L.length - 1][1]) < 1e-6) L.pop();
      return L;
    }
    const r = shape === 'rectangle' ? 0 : Math.min(corner, w / 2 - 0.2, h / 2 - 0.2);
    return T.roundRect(x0, y0, x1, y1, r);
  }
  function platePoly(o) { return [{ outer: plateLoop(o.shape, o.width, o.height, o.corner), holes: [] }]; }

  // ---------------------------------------------------------------- 2D helpers
  function area2(L) { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; }
  function inLoop(p, L) { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function inPolys(p, polys) { for (const P of polys) if (inLoop(p, P.outer) && !P.holes.some(h => inLoop(p, h))) return true; return false; }
  function bboxOf(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const P of polys) for (const q of P.outer) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  const xf = (polys, f) => polys.map(P => ({ outer: P.outer.map(f), holes: P.holes.map(h => h.map(f)) }));
  const move = (polys, dx, dy, s) => xf(polys, p => [p[0] * (s || 1) + dx, p[1] * (s || 1) + dy]);
  const areaOf = polys => T.polysArea(polys);

  // ---------------------------------------------------------------- text and icons
  function glyphFor(font, ch, H) {
    let g = Bubble.glyphPolys(font, ch, H);
    if ((!g || !g.polys.length) && ch.normalize) { const b = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); if (b && b !== ch) g = Bubble.glyphPolys(font, b, H); }
    if ((!g || !g.polys.length) && ch.toUpperCase() !== ch) g = Bubble.glyphPolys(font, ch.toUpperCase(), H);
    return g && g.polys.length ? g : null;
  }
  function splitLines(text) { return String(text || '').split(/\n|\//).map(s => s.trim()).filter(Boolean); }
  // the text block at its nominal size, lines aligned, bbox not yet centered
  function textBlock(o) {
    const lines = splitLines(o.text), rows = [], skipped = new Set();
    for (let li = 0; li < lines.length; li++) {
      const H = o.textH * (li === 0 ? 1 : o.subScale / 100), track = H * o.tracking / 100;
      let pen = 0; const polys = [];
      for (const ch of [...lines[li]]) {
        if (/\s/.test(ch)) { pen += H * 0.35 + track; continue; }
        const g = glyphFor(o.font, ch, H); if (!g) { skipped.add(ch); continue; }
        polys.push(...move(g.polys, pen, 0));
        pen += (g.advance || H * 0.7) * 1.05 + track;
      }
      if (polys.length) rows.push({ polys, H, bb: bboxOf(polys) });
    }
    if (!rows.length) return { polys: [], rows: 0, skipped: [...skipped] };
    const W = Math.max(...rows.map(r => r.bb.w)), out = [];
    let base = 0;
    rows.forEach((r, i) => {
      if (i) base -= r.H + o.lineGap * Math.max(r.H, rows[i - 1].H);
      const dx = o.align === 'left' ? -r.bb.x0 : o.align === 'right' ? W - r.bb.x1 : (W - r.bb.w) / 2 - r.bb.x0;
      out.push(...move(r.polys, dx, base));
    });
    return { polys: out, rows: rows.length, skipped: [...skipped] };
  }
  // legacy helper (kept for callers/tests): the text polys centered at the origin, unfitted
  function textPolys(o) { const t = textBlock(options(o)); if (!t.polys.length) return []; const b = bboxOf(t.polys); return move(t.polys, -b.cx, -b.cy); }

  function iconPolys(id, s, cx, cy) {
    const m = (L) => L.map(p => [p[0] * s + cx, p[1] * s + cy]);
    const P = L => ({ outer: m(L), holes: [] });
    const ell = (x, y, rx, ry, n) => { const L = []; n = n || 32; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; L.push([x + rx * Math.cos(a), y + ry * Math.sin(a)]); } return L; };
    if (id === 'star') return [P([[0, 1], [0.22, 0.3], [1, 0.3], [0.36, -0.12], [0.6, -0.9], [0, -0.4], [-0.6, -0.9], [-0.36, -0.12], [-1, 0.3], [-0.22, 0.3]])];
    if (id === 'heart') { const L = []; for (let i = 0; i < 64; i++) { const t = i / 64 * Math.PI * 2; L.push([16 * Math.sin(t) ** 3 / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 + 0.1]); } return [P(L)]; }
    if (id === 'house') return [P([[-0.9, -0.2], [0, 0.9], [0.9, -0.2], [0.9, -0.9], [0.25, -0.9], [0.25, -0.2], [-0.25, -0.2], [-0.25, -0.9], [-0.9, -0.9]])];
    if (id === 'leaf') return [P([[0, -1], [0.7, -0.2], [0.2, 1], [-0.5, 0.2]])];
    if (id === 'bolt') return [P([[0.2, 1], [-0.5, 0.1], [0.05, 0.1], [-0.2, -1], [0.5, -0.1], [-0.05, -0.1]])];
    if (id === 'check') return [P([[-0.9, 0.1], [-0.3, -0.5], [0.9, 0.7], [0.7, 0.95], [-0.3, 0], [-0.7, 0.35]])];
    if (id === 'arrow') return [P([[-1, -0.25], [0.3, -0.25], [0.3, -0.65], [1, 0], [0.3, 0.65], [0.3, 0.25], [-1, 0.25]])];
    if (id === 'paw') return T.unionPolys([ell(0, -0.38, 0.5, 0.4), ell(-0.66, 0.2, 0.2, 0.25), ell(-0.25, 0.62, 0.2, 0.26), ell(0.25, 0.62, 0.2, 0.26), ell(0.66, 0.2, 0.2, 0.25)].map(P));
    if (id === 'music') return T.unionPolys([P(ell(-0.3, -0.68, 0.36, 0.27)), P([[-0.02, -0.68], [0.12, -0.68], [0.12, 0.95], [-0.02, 0.95]]), P([[0.12, 0.95], [0.62, 0.55], [0.62, 0.25], [0.12, 0.6]])]);
    if (id === 'smile') {
      const face = T.circle(cx, cy, s, 48), eyeL = T.circle(cx - s * 0.35, cy + s * 0.25, s * 0.12, 16), eyeR = T.circle(cx + s * 0.35, cy + s * 0.25, s * 0.12, 16);
      const mouth = []; for (let i = 0; i <= 12; i++) { const a = Math.PI + i / 12 * Math.PI; mouth.push([cx + Math.cos(a) * s * 0.45, cy + Math.sin(a) * s * 0.35 - s * 0.05]); }
      return T.diffPolys([{ outer: face, holes: [] }], [{ outer: eyeL, holes: [] }, { outer: eyeR, holes: [] }, { outer: mouth, holes: [] }]);
    }
    return [];
  }
  function svgPolys(loops, s, cx, cy) {
    if (!loops || !loops.length) return [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const L of loops) for (const p of L) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const k = s / Math.max(1e-6, x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    return T.unionPolys(loops.map(L => ({ outer: L.map(p => [(p[0] - mx) * k + cx, (p[1] - my) * k + cy]), holes: [] })), 'evenodd');
  }
  // text + icon as one group, centered on the origin, at the nominal letter height
  function contentGroup(o) {
    const t = textBlock(o); let polys = t.polys.slice();
    const hasIcon = (o.svg && o.svg.length) || o.icon !== 'none';
    if (hasIcon) {
      const S = o.iconSize, tb = polys.length ? bboxOf(polys) : { x0: 0, x1: 0, y0: 0, y1: 0, cx: 0, cy: 0 }, gap = polys.length ? Math.max(2, o.textH * 0.25) : 0;
      const one = (cx, cy) => (o.svg && o.svg.length) ? svgPolys(o.svg, S, cx, cy) : iconPolys(o.icon, S / 2, cx, cy);
      const at = [];
      if (!polys.length) at.push([0, 0]);
      else if (o.iconPos === 'above') at.push([tb.cx, tb.y1 + gap + S / 2]);
      else {
        if (o.iconPos === 'left' || o.iconPos === 'both') at.push([tb.x0 - gap - S / 2, tb.cy]);
        if (o.iconPos === 'right' || o.iconPos === 'both') at.push([tb.x1 + gap + S / 2, tb.cy]);
      }
      for (const [x, y] of at) polys.push(...one(x, y));
    }
    if (!polys.length) return { polys: [], skipped: t.skipped, rows: 0 };
    polys = T.unionPolys(polys);
    const b = bboxOf(polys);
    return { polys: move(polys, -b.cx, -b.cy), skipped: t.skipped, rows: t.rows, w: b.w, h: b.h };
  }

  // ---------------------------------------------------------------- plate layout: holes, frame, the room the text may use
  function frameEdge(o) { return o.borderStyle === 'none' ? 0 : o.borderInset + o.borderW * (o.borderStyle === 'double' ? 2.4 : 1); }
  function frameRings(plate, o) {
    if (o.borderStyle === 'none') return [];
    const ring = (a, b) => T.diffPolys(a <= 0 ? plate : T.offset(plate, -a), T.offset(plate, -b));
    const i = o.borderInset, w = o.borderW;
    return o.borderStyle === 'double' ? ring(i, i + w).concat(ring(i + w * 1.8, i + w * 2.4)) : ring(i, i + w);
  }
  // nudge a hole center toward the middle until a circle of radius r fits inside region
  function placeIn(region, x, y, r) {
    const R = T.offset(region, -r);
    for (let k = 0; k <= 50; k++) { const t = 1 - k / 50, p = [x * t, y * t]; if (inPolys(p, R)) return p; }
    return null;
  }
  function layoutPlate(o, w, h) {
    const outer = plateLoop(o.shape, w, h, o.corner), plate = [{ outer, holes: [] }];
    const edge = frameEdge(o), holeRoom = T.offset(plate, -(edge + 1.6)), holes = [], pockets = [], notes = [];
    let pocketDepth = 0, bottomBand = 0;
    const hole = (x, y, r) => { const p = placeIn(holeRoom, x, y, r); if (p) holes.push({ outer: T.circle(p[0], p[1], r, 32), holes: [] }); return p; };
    if (o.mount === 'keyhole') {
      const span = Math.min(w * 0.3, 45);
      for (const sx of [-1, 1]) {
        const p = placeIn(holeRoom, sx * span, h / 2 - edge - 6, 4.2); if (!p) continue;
        const pS = placeIn(holeRoom, p[0], p[1] - 7, 2.2); if (!pS) continue;
        holes.push(...T.unionPolys([{ outer: T.circle(p[0], p[1], 4.2, 32), holes: [] }, { outer: T.roundRect(p[0] - 2.2, pS[1], p[0] + 2.2, p[1], 2.1), holes: [] }]));
      }
    }
    if (o.mount === 'screws') for (const sx of [-1, 1]) hole(sx * (w / 2 - edge - 4 - o.screwD / 2), 0, o.screwD / 2);
    if (o.mount === 'corners') for (const sx of [-1, 1]) for (const sy of [-1, 1]) hole(sx * (w / 2 - edge - 4 - o.screwD / 2), sy * (h / 2 - edge - 4 - o.screwD / 2), o.screwD / 2);
    if (o.mount === 'hang') for (const sx of [-1, 1]) hole(sx * Math.min(w * 0.32, 60), h / 2 - edge - 4, 2.5);
    if (o.mount === 'magnets') {
      const r = (o.magD + 0.3) / 2, back = T.offset(plate, -1.6), at = w >= h ? [[-w * 0.3, 0], [w * 0.3, 0]] : [[0, -h * 0.3], [0, h * 0.3]];
      if (w >= 150 && h >= 70) at.push(...at.map(p => [p[0], p[1] + h * 0.25]).map(p => [p[0], p[1]]), ...at.map(p => [p[0], p[1] - h * 0.25])), at.splice(0, 2);
      for (const [x, y] of at) { const p = placeIn(back, x, y, r); if (p && !pockets.some(q => Math.hypot(q.c[0] - p[0], q.c[1] - p[1]) < 2 * r + 2)) pockets.push({ loop: T.circle(p[0], p[1], r, 32), c: p }); }
      pocketDepth = o.magT + 0.2;
    }
    if (o.mount === 'adhesive') {
      const back = T.offset(plate, -2.5), sw = Math.min(20, w * 0.25), sh = Math.max(6, Math.min(h * 0.6, 50));
      for (const sx of w >= 60 ? [-1, 1] : [0]) {
        const cx = sx * w * 0.27, cut = T.interPolys([{ outer: [[cx - sw / 2, -sh / 2], [cx + sw / 2, -sh / 2], [cx + sw / 2, sh / 2], [cx - sw / 2, sh / 2]], holes: [] }], back);
        for (const P of cut) if (Math.abs(area2(P.outer)) > 20) pockets.push({ loop: P.outer, c: [cx, 0] });
      }
      pocketDepth = 1.0;
    }
    if (o.mount === 'stand') bottomBand = 7; // hidden by the stand's front lip
    // the room for text: inside the frame and margin, clear of holes by the margin
    let safe = T.offset(plate, -(edge + o.margin));
    const keep = holes.length ? T.offset(holes, o.margin) : [];
    if (bottomBand) keep.push({ outer: [[-w, -h], [w, -h], [w, -h / 2 + bottomBand + o.margin * 0.5], [-w, -h / 2 + bottomBand + o.margin * 0.5]], holes: [] });
    if (keep.length) safe = T.diffPolys(safe, keep);
    return { w, h, outer, plate, edge, holes, pockets, pocketDepth, safe, notes };
  }

  // largest scale (\u2264 hi) at which the group fits inside the safe region, centered on it
  function fits(group, safe, s, cx, cy) {
    const g = move(group, cx, cy, s);
    return areaOf(T.diffPolys(g, safe)) < 1e-3;
  }
  function fitScale(group, gw, gh, L, hi) {
    if (!group.length || !L.safe.length) return null;
    // pick the safe piece with the most area; center the group on its bbox
    let best = L.safe[0]; for (const P of L.safe) if (areaOf([P]) > areaOf([best])) best = P;
    const sb = bboxOf([best]), cx = sb.cx, cy = sb.cy;
    let up = Math.min(hi, sb.w / Math.max(1e-6, gw), sb.h / Math.max(1e-6, gh));
    if (up <= 0) return null;
    if (fits(group, L.safe, up, cx, cy)) return { s: up, cx, cy };
    let lo = 0, top = up;
    for (let k = 0; k < 18; k++) { const m = (lo + top) / 2; if (fits(group, L.safe, m, cx, cy)) lo = m; else top = m; }
    return lo > 0.01 ? { s: lo, cx, cy } : null;
  }

  // ---------------------------------------------------------------- watertight stepped plate
  // plate polys (through holes included) with bottom pockets K (loops, depth kz) and top recesses E (polys, depth ez)
  function stepSolid(P, K, kz, E, ez, z0, z2) {
    const out = [];
    const tri = (A, B, C, n) => {
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * n[0] + cy * n[1] + cz * n[2] < 0) out.push(...A, ...C, ...B); else out.push(...A, ...B, ...C);
    };
    const wall = (L, outward, za, zb) => { // outward: solid lies to the left of a CCW loop
      const loop = (area2(L) > 0) === outward ? L : L.slice().reverse();
      for (let i = 0; i < loop.length; i++) {
        const p0 = loop[i], p1 = loop[(i + 1) % loop.length], n = [p1[1] - p0[1], -(p1[0] - p0[0]), 0];
        const A = [p0[0], p0[1], za], B = [p1[0], p1[1], za], C = [p1[0], p1[1], zb], D = [p0[0], p0[1], zb];
        tri(A, B, C, n); tri(A, C, D, n);
      }
    };
    const cap = (polys, z, dir) => {
      const norm = polys.map(Q => ({ outer: area2(Q.outer) > 0 ? Q.outer : Q.outer.slice().reverse(), holes: Q.holes.map(h => area2(h) < 0 ? h : h.slice().reverse()) }));
      Core.triangulatePolys(norm, 2, z, dir, out, [], 0);
    };
    // nest loops by containment: even depth = material boundary (outer), odd = void
    const nest = (loops) => {
      const items = loops.map(L => ({ L, a: Math.abs(area2(L)), parent: null, kids: [] }));
      for (const it of items) {
        let par = null;
        for (const o of items) if (o !== it && o.a > it.a && inLoop(it.L[0], o.L) && (!par || o.a < par.a)) par = o;
        it.parent = par; if (par) par.kids.push(it);
      }
      const depth = it => { let d = 0; for (let p = it.parent; p; p = p.parent) d++; return d; };
      return items.filter(it => depth(it) % 2 === 0).map(it => ({ outer: it.L, holes: it.kids.map(k => k.L) }));
    };
    const pl = []; for (const Q of P) pl.push(Q.outer, ...Q.holes);
    const el = []; for (const Q of E) el.push(Q.outer, ...Q.holes);
    const z1 = z0 + kz, zt = z2 - ez;
    // caps
    cap(nest(pl.concat(el)), z2, +1);
    cap(nest(pl.concat(K)), z0, -1);
    if (E.length) cap(E, zt, +1);
    if (K.length) cap(K.map(L => ({ outer: L, holes: [] })), z1, -1);
    // walls: plate outline and through holes
    for (const Q of P) { wall(Q.outer, true, z0, z2); for (const h of Q.holes) wall(h, false, z0, z2); }
    for (const L of K) wall(L, false, z0, z1);
    for (const Q of E) { wall(Q.outer, false, zt, z2); for (const h of Q.holes) wall(h, true, zt, z2); }
    let mesh = Float64Array.from(out);
    if (!Core.checkClosed(mesh).closed && Core.fixTJunctions) { // a cap triangle spanning collinear pocket corners
      for (const tol of [1e-4, 1e-3]) { const r = Core.fixTJunctions(Array.from(mesh), null, tol), m = Float64Array.from(r.p); if (Core.checkClosed(m).closed) { mesh = m; break; } }
    }
    return mesh;
  }

  // a slotted foot: the sign drops in and leans back 8 degrees
  function standMesh(o, w, slotW) {
    const D = Math.max(22, slotW + 16), Hb = 14, Hf = 8, f = 3, tilt = Math.tan(8 * Math.PI / 180), y0 = -D / 2 + 6;
    const L = [[-D / 2, 0], [D / 2, 0], [D / 2, Hb], [y0 + slotW + (Hb - f) * tilt, Hb], [y0 + slotW, f], [y0, f], [y0 + (Hf - f) * tilt, Hf], [-D / 2, Hf]];
    return { p: T.extrude([{ outer: L, holes: [] }], 0, -w / 2, w / 2), D };
  }

  // ---------------------------------------------------------------- build
  // balanced breaks of one line of words into n lines
  function wrapInto(words, n) {
    if (words.length < n) return null;
    const len = w => w.length, total = words.reduce((a, w) => a + len(w), 0) + words.length - 1;
    let best = null;
    const rec = (start, left, acc) => {
      if (left === 1) { const L = acc.concat([words.slice(start).join(' ')]); const worst = Math.max(...L.map(x => x.length)); if (!best || worst < best.worst) best = { L, worst }; return; }
      for (let i = start + 1; i <= words.length - left + 1; i++) rec(i, left - 1, acc.concat([words.slice(start, i).join(' ')]));
    };
    if (words.length > 14) return null; void total;
    rec(0, n, []);
    return best && best.L.join('\n');
  }
  function build(raw) {
    const o = options(raw), warnings = [];
    let C = contentGroup(o);
    // one long line on a short plate: try two or three lines and keep whichever gives the biggest letters
    if (o.wrap && o.fit !== 'grow' && splitLines(o.text).length === 1 && C.polys.length) {
      const words = splitLines(o.text)[0].split(/\s+/).filter(Boolean), L0 = layoutPlate(o, o.width, o.height);
      const f0 = fitScale(C.polys, C.w, C.h, L0, o.fit === 'fill' ? 50 : 1);
      if (words.length > 1 && (!f0 || f0.s < 0.98 || o.fit === 'fill')) {
        let bestS = f0 ? f0.s : 0, bestC = C, bestText = null;
        for (const n of [2, 3]) {
          const t = wrapInto(words, n); if (!t) continue;
          const o2 = Object.assign({}, o, { text: t }), C2 = contentGroup(o2), f2 = fitScale(C2.polys, C2.w, C2.h, L0, o.fit === 'fill' ? 50 : 1);
          if (f2 && f2.s > bestS * 1.08) { bestS = f2.s; bestC = C2; bestText = t; }
        }
        if (bestText) { C = bestC; o.wrapped = bestText; }
      }
    }
    const bedW = Math.max(30, (o.bed[0] || 256) - 6), bedH = Math.max(30, (o.bed[1] || 256) - 6);
    let L = layoutPlate(o, o.width, o.height), fit = null, grew = false;
    if (C.polys.length) {
      if (o.fit === 'grow') {
        fit = fitScale(C.polys, C.w, C.h, L, 1);
        if (!fit || fit.s < 0.999) {
          // grow from the size the text needs, then step up until it fits at full size (capped by the bed and 300 mm);
          // a long single line may also break into two or three lines when that makes a smaller plate
          const capW = Math.min(300, bedW), capH = o.shape === 'circle' ? capW : Math.min(300, bedH);
          const grow = Cc => {
            const need = 2 * (frameEdge(o) + o.margin) + (o.mount === 'screws' || o.mount === 'corners' ? 2 * (o.screwD + 2 * o.margin + 4) : 0);
            let w = Math.max(o.width, Cc.w + need), h = Math.max(o.height, Cc.h + need + (o.mount === 'stand' ? 9 : 0) + (o.mount === 'keyhole' || o.mount === 'hang' ? 14 : 0));
            if (o.shape === 'circle') w = h = Math.max(w, h, Math.hypot(Cc.w, Cc.h) + need);
            const w0 = Math.min(w, capW), h0 = Math.min(h, capH);
            if (w <= capW && h <= capH) for (let k = 0; k < 40; k++) {
              const Lk = layoutPlate(o, w, h), f = fitScale(Cc.polys, Cc.w, Cc.h, Lk, 1);
              if (f && f.s >= 0.999) return { L: Lk, fit: f, C: Cc, full: true };
              if (w >= capW && h >= capH) break;
              w = Math.min(capW, w * 1.04); h = Math.min(capH, h * 1.04);
            }
            const Lc = layoutPlate(o, w0, h0); return { L: Lc, fit: fitScale(Cc.polys, Cc.w, Cc.h, Lc, 1), C: Cc, full: false };
          };
          const cands = [C];
          const ls = splitLines(o.text);
          if (o.wrap && ls.length === 1) { const words = ls[0].split(/\s+/).filter(Boolean); for (const n of [2, 3]) { const t = wrapInto(words, n); if (t) cands.push(Object.assign(contentGroup(Object.assign({}, o, { text: t })), { text: t })); } }
          let pick = null;
          for (const Cc of cands) {
            const g = grow(Cc);
            if (g.full) { pick = g; break; }
            if (!pick || (g.fit ? g.fit.s : 0) > (pick.fit ? pick.fit.s : 0)) pick = g;
          }
          L = pick.L; fit = pick.fit; if (pick.C !== C) { C = pick.C; o.wrapped = pick.C.text; }
          grew = Math.abs(L.w - o.width) > 0.05 || Math.abs(L.h - o.height) > 0.05;
          if (grew) warnings.push(`The plate grew to ${L.w.toFixed(0)} \u00d7 ${L.h.toFixed(0)} mm to fit the text.`);
        }
      } else fit = fitScale(C.polys, C.w, C.h, L, o.fit === 'fill' ? 50 : 1);
      if (!fit) warnings.push('There is no room for text on this plate. Make the plate bigger, or reduce the margin or frame.');
    }
    const s = fit ? fit.s : 0;
    if (o.wrapped) warnings.push(`Split into ${C.rows} lines so the letters can be bigger. Turn off Auto line breaks to keep one line.`);
    const content = fit ? move(C.polys, fit.cx, fit.cy, s) : [];
    const letterH = o.textH * s;
    if (fit && s < 0.995 && o.fit === 'shrink') warnings.push(`Letters shrank to ${letterH.toFixed(1)} mm (from ${o.textH} mm) to fit the plate. Pick Grow the plate to keep the size.`);
    if (fit && s < 0.995 && o.fit === 'grow') warnings.push(`Letters shrank to ${letterH.toFixed(1)} mm (from ${o.textH} mm): the plate is as big as your printer allows.`);
    if (fit && letterH < LIMITS.minLetterMM && C.rows) warnings.push(`Letters are only ${letterH.toFixed(1)} mm tall and may lose detail. Use fewer words or a bigger plate.`);
    if (C.skipped.length) warnings.push(`This letter style has no ${C.skipped.join(' ')}; those characters were left out.`);
    if (L.w > bedW + 6 || L.h > bedH + 6) warnings.push(`The plate (${L.w.toFixed(0)} \u00d7 ${L.h.toFixed(0)} mm) is larger than the build plate.`);

    // thickness: engraving and back pockets need solid plastic between them
    const engr = o.style !== 'raised', needT = (engr ? o.depth : 0) + L.pocketDepth + 0.8;
    let baseT = o.baseT;
    if (needT > baseT) { baseT = +needT.toFixed(1); warnings.push(`The backplate is ${baseT} mm thick so the ${engr ? 'engraving' : 'pockets'} and back stay solid.`); }
    const rings = frameRings([{ outer: L.outer, holes: [] }], o);
    const plate = L.holes.length ? T.diffPolys(L.plate, L.holes) : L.plate;
    const K = L.pockets.map(q => q.loop);
    const E = engr ? content.concat(rings) : [];
    const baseMesh = stepSolid(plate, K, L.pocketDepth, E, o.depth, 0, baseT);
    let textMesh = null, borderMesh = null;
    if (o.style === 'raised') {
      if (content.length) textMesh = T.extrude(content, 2, baseT - 0.05, baseT + o.raise);
      if (rings.length) borderMesh = T.extrude(rings, 2, baseT - 0.05, baseT + o.borderRaise);
    } else if (o.style === 'inlay') {
      if (content.length) textMesh = T.extrude(content, 2, baseT - o.depth, baseT);
      if (rings.length) borderMesh = T.extrude(rings, 2, baseT - o.depth, baseT);
    }
    const parts = [{ kind: 'base', name: 'Backplate', p: baseMesh, color: o.colors.base, extruder: 1, plate: 0 }];
    if (textMesh) parts.push({ kind: 'text', name: 'Text and icons', p: textMesh, color: o.colors.text, extruder: 2, plate: 0 });
    if (borderMesh) parts.push({ kind: 'border', name: 'Border', p: borderMesh, color: o.colors.border, extruder: 3, plate: 0 });
    if (o.mount === 'stand') {
      const st = standMesh(o, Math.min(L.w * 0.5, 70), baseT + 0.5), gap = 6;
      const p = st.p; for (let i = 1; i < p.length; i += 3) p[i] += -L.h / 2 - gap - st.D / 2;
      parts.push({ kind: 'stand', name: 'Shelf stand', p, color: o.colors.base, extruder: 1, plate: 0 });
    }
    const filaments = [];
    for (const q of parts) if (!filaments.some(f => f.color === q.color)) filaments.push({ role: q.kind === 'stand' ? 'base' : q.kind, color: q.color });
    const colIndex = {}; filaments.forEach((f, i) => { colIndex[f.color] = i + 1; });
    for (const q of parts) q.extruder = colIndex[q.color] || 1;
    const all = T.concat(parts.map(q => q.p)), bb = Core.bbox(all);
    const size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
    const chars = [...String(o.text || '').replace(/\s+|\//g, '')].length;
    if (Math.max(L.w, L.h) > LIMITS.freeMaxMM) warnings.push(`This sign is ${Math.round(Math.max(L.w, L.h))} mm (free: up to ${LIMITS.freeMaxMM} mm).`);
    const tb = content.length ? bboxOf(content) : null;
    return {
      parts, options: o, warnings, filaments, size, plates: 1,
      layout: { outer: L.outer, plate, safe: L.safe, holes: L.holes, pockets: K, content, rings, edge: L.edge, margin: o.margin },
      stats: {
        size, plateW: +L.w.toFixed(1), plateH: +L.h.toFixed(1), baseT, shape: o.shape, mount: o.mount, style: o.style, fit: o.fit, chars, lines: C.rows,
        letterH: +letterH.toFixed(2), scale: +s.toFixed(4), shrunk: !!fit && s < 0.995, grew, textBox: tb && { x0: tb.x0, y0: tb.y0, x1: tb.x1, y1: tb.y1 },
        tris: parts.reduce((n, q) => n + q.p.length / 9, 0), border: o.border, borderStyle: o.borderStyle, icon: o.svg && o.svg.length ? 'svg' : o.icon, skipped: C.skipped
      }
    };
  }

  function moveP(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  function placed(res, bed) {
    const all = T.concat(res.parts.map(q => q.p)), bb = Core.bbox(all);
    const dx = bed[0] / 2 - (bb.min[0] + bb.max[0]) / 2, dy = bed[1] / 2 - (bb.min[1] + bb.max[1]) / 2, dz = -bb.min[2];
    return res.parts.map(q => ({ ...q, p: moveP(q.p, dx, dy, dz) }));
  }
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  function export3MF(res, o) {
    o = o || {}; const bed = o.bed || res.options.bed || DEFAULTS.bed, name = o.name || 'Sign';
    const parts = placed(res, bed).map(q => ({ name: q.name, p: q.p, extruder: q.extruder || 1, color: q.color }));
    return T.threeMF([{ name, parts }], { title: name, plates: [[0]], bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: res.filaments });
  }
  function readme(res, name) {
    const s = res.stats, o = res.options, L = [`Expressarte sign: ${name}`, '',
      `Shape: ${SHAPES[o.shape].label} \u00b7 plate ${s.plateW} \u00d7 ${s.plateH} \u00d7 ${s.baseT} mm \u00b7 overall ${s.size[0].toFixed(1)} \u00d7 ${s.size[1].toFixed(1)} \u00d7 ${s.size[2].toFixed(1)} mm`,
      `Text: "${o.text.replace(/\n/g, ' / ')}" \u00b7 ${Bubble.FONTS[o.font].label} \u00b7 ${s.letterH} mm letters \u00b7 ${STYLES[o.style].label.toLowerCase()} \u00b7 ${o.align}`,
      `Frame: ${BORDERS[o.borderStyle].label} \u00b7 Mount: ${MOUNTS[o.mount].label}${s.icon !== 'none' ? ` \u00b7 icon: ${s.icon === 'svg' ? 'your SVG' : ICONS[s.icon].label}` : ''}`, '', 'Filaments'];
    res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}  ${f.role}`));
    L.push('', 'Printing', '  - Print flat on the bed, no supports. The 3MF opens with backplate, text and frame on separate filaments.',
      '  - 0.2 mm layers, 3 walls. A dark text on a light plate reads best.');
    if (o.style === 'engraved') L.push(`  - Letters are engraved ${o.depth} mm deep. Fill them with paint or wax for contrast.`);
    if (o.style === 'inlay') L.push('  - Flush inlay: letters fill their pockets level with the plate. Two colors, one smooth face.');
    if (o.mount === 'stand') L.push('  - The stand prints flat next to the sign. Slide the sign into its slot; it leans back slightly.');
    if (o.mount === 'keyhole') L.push('  - Keyholes: drive screws so the heads stand about 3 mm off the wall, hang and slide down.');
    if (o.mount === 'screws' || o.mount === 'corners') L.push(`  - Screw holes are ${o.screwD} mm; use matching wood or drywall screws.`);
    if (o.mount === 'hang') L.push('  - Thread a cord, ribbon or S-hooks through the top holes.');
    if (o.mount === 'magnets') L.push(`  - Magnet pockets fit ${o.magD} \u00d7 ${o.magT} mm round magnets; press in with a drop of glue.`);
    if (o.mount === 'adhesive') L.push('  - Back pockets 1 mm deep hold double-sided foam tape or removable mounting strips.');
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, o) {
    o = o || {}; const name = o.name || 'Sign', base = safe(o.fileBase || name.toLowerCase()) || 'sign';
    const list = [{ name: `${base}.3mf`, data: export3MF(res, o) }];
    placed(res, o.bed || res.options.bed || DEFAULTS.bed).forEach((q, i) => list.push({ name: `stl/${String(i + 1).padStart(2, '0')}_${safe(q.name)}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }));
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }

  const api = { DEFAULTS, LIMITS, SHAPES, ICONS, MOUNTS, FITS, STYLES, BORDERS, PRESETS, PALETTE, FONTS: Bubble.FONTS, options, build, export3MF, files, readme, textPolys, iconPolys, platePoly, layoutPlate, splitLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPSign = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
