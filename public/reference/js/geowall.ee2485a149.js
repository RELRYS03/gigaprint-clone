/* Expressarte geometric wall panels: decorative relief panels (hexagon, triangle, diamond, square, brick, plank)
   with 16 face patterns, a layout planner, back clips or puzzle edges, hidden hangers, screws or adhesive strips,
   optional backlight spacers and multicolor. Generic names only. American spelling. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const S3 = Math.sqrt(3), TAU = Math.PI * 2, SUN_R0 = 9;
  const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  const SHAPES = {
    hex: { label: 'Hexagon', free: true, size: 150 },
    triangle: { label: 'Triangle', free: false, size: 170 },
    diamond: { label: 'Diamond', free: false, size: 170 },
    square: { label: 'Square', free: true, size: 140 },
    brick: { label: 'Brick', free: false, size: 200 },
    plank: { label: 'Plank', free: false, size: 240 }
  };
  const SHAPE_KEYS = Object.keys(SHAPES);
  const PATTERNS = {
    flat: { label: 'Flat', free: true },
    pyramid: { label: 'Pyramid', free: true },
    crystal: { label: '3D faceted', free: true },
    wave: { label: 'Wave', free: true, rep: true },
    cube: { label: '3D cube', free: false },
    hollow: { label: 'Inverted pyramid', free: false },
    steps: { label: 'Steps', free: false },
    pillow: { label: 'Pillow', free: false },
    dish: { label: 'Dish', free: false },
    ripple: { label: 'Ripple', free: false, rep: true },
    honeycomb: { label: 'Honeycomb', free: false, rep: true },
    flutes: { label: 'Fluted', free: false, rep: true },
    chevron: { label: 'Chevron', free: false, rep: true },
    studs: { label: 'Dots', free: false, rep: true },
    sunburst: { label: 'Sunburst', free: false },
    weave: { label: 'Weave', free: false, rep: true }
  };
  const PATTERN_KEYS = Object.keys(PATTERNS);
  const JOINTS = { clip: 'Back clips', puzzle: 'Puzzle edges', none: 'None' };
  const MOUNTS = { hanger: 'Hidden hanger', screw: 'Screw', adhesive: 'Adhesive strips' };
  const LAYOUTS = { grid: 'Grid', cluster: 'Cluster', fill: 'Fill a wall area' };
  const COLOR_MODES = { one: 'One color', alternate: 'Alternate', random: 'Random mix', rows: 'Rows (ombre)', cube: 'By direction' };
  const PALETTE = [
    { name: 'Warm white', hex: '#F2EFE8' }, { name: 'Light gray', hex: '#C9C9C4' }, { name: 'Charcoal', hex: '#3A3B3D' }, { name: 'Black', hex: '#161616' },
    { name: 'Sage', hex: '#9FB59A' }, { name: 'Forest', hex: '#2F5D46' }, { name: 'Sand', hex: '#D9C3A0' }, { name: 'Terracotta', hex: '#C2633F' },
    { name: 'Navy', hex: '#24395C' }, { name: 'Sky', hex: '#8EB6CC' }, { name: 'Gold', hex: '#C9A24A' }, { name: 'Blush', hex: '#E3B5AE' }
  ];
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    shape: 'hex', size: 150, pattern: 'pyramid', depth: 8, base: 4, bevel: 2, scale: 30, angle: 0, seed: 7,
    layout: 'cluster', cols: 4, rows: 3, count: 9, wallW: 900, wallH: 600, offset: true,
    joint: 'clip', mount: 'hanger', backlight: false, gap: 10, spacer: 15,
    colorMode: 'alternate', colors: [PZ.cream, PZ.sage, PZ.babyBlue, PZ.peach], hwColor: '#3A3B3D',
    detail: 'hd', preview: false, bed: [256, 256, 256], bambu: 'A1', fullSet: true
  };
  const CELL = { hd: 0.45, standard: 0.7, preview: 0.95 };
  const CLIP = { neckW: 5.0, headW: 9.0, near: 4.2, far: 10.8, t: 2.0, tol: 0.2, depth: 2.4 };
  const MAX_PANELS = 120;

  const num = (v, d, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  function options(raw) {
    const r = raw || {}, o = Object.assign({}, DEFAULTS);
    o.shape = SHAPES[r.shape] ? r.shape : DEFAULTS.shape;
    o.size = num(r.size, SHAPES[o.shape].size, 60, 400);
    o.pattern = PATTERNS[r.pattern] ? r.pattern : DEFAULTS.pattern;
    o.depth = num(r.depth, DEFAULTS.depth, 0, 30);
    o.base = num(r.base, DEFAULTS.base, 3, 10);
    o.bevel = num(r.bevel, DEFAULTS.bevel, 0, 12);
    o.scale = num(r.scale, DEFAULTS.scale, 8, 120);
    o.angle = num(r.angle, 0, -180, 180);
    o.seed = Math.round(num(r.seed, DEFAULTS.seed, 1, 9999));
    o.layout = LAYOUTS[r.layout] ? r.layout : DEFAULTS.layout;
    o.cols = Math.round(num(r.cols, DEFAULTS.cols, 1, 20)); o.rows = Math.round(num(r.rows, DEFAULTS.rows, 1, 20));
    o.count = Math.round(num(r.count, DEFAULTS.count, 1, MAX_PANELS));
    o.wallW = num(r.wallW, DEFAULTS.wallW, 100, 6000); o.wallH = num(r.wallH, DEFAULTS.wallH, 100, 4000);
    o.offset = r.offset === undefined ? DEFAULTS.offset : !!r.offset;
    o.backlight = !!r.backlight;
    o.joint = JOINTS[r.joint] ? r.joint : DEFAULTS.joint;
    if (o.backlight && o.joint === 'puzzle') o.joint = 'clip';
    if (o.joint === 'puzzle' && !edgeToEdge(o)) o.joint = 'clip';
    o.mount = MOUNTS[r.mount] ? r.mount : DEFAULTS.mount;
    o.gap = o.backlight ? num(r.gap, DEFAULTS.gap, 2, 40) : 0;
    o.spacer = num(r.spacer, DEFAULTS.spacer, 8, 40);
    if (o.mount === 'hanger' && !o.backlight) o.base = Math.max(o.base, 4.2);
    if (o.joint === 'clip') o.base = Math.max(o.base, CLIP.depth + 1.2);
    o.colorMode = COLOR_MODES[r.colorMode] ? r.colorMode : DEFAULTS.colorMode;
    const cs = Array.isArray(r.colors) ? r.colors : DEFAULTS.colors;
    o.colors = [0, 1, 2, 3].map(i => /^#[0-9a-f]{6}$/i.test(cs[i] || '') ? cs[i].toUpperCase() : DEFAULTS.colors[i]);
    o.hwColor = /^#[0-9a-f]{6}$/i.test(r.hwColor || '') ? r.hwColor.toUpperCase() : DEFAULTS.hwColor;
    o.detail = CELL[r.detail] ? r.detail : 'hd';
    o.preview = !!r.preview;
    const bed = Array.isArray(r.bed) ? r.bed : DEFAULTS.bed; o.bed = [0, 1, 2].map(a => num(bed[a], 256, 60, 2000));
    o.bambu = r.bambu || 'A1';
    o.fullSet = r.fullSet === undefined ? true : !!r.fullSet;
    return o;
  }
  // stacked layouts only: puzzle knobs need edges that meet end to end
  function edgeToEdge(o) { return !((o.shape === 'square' || o.shape === 'brick' || o.shape === 'plank') && o.offset); }
  function colorCount(o) { return o.colorMode === 'one' ? 1 : o.colorMode === 'alternate' ? 2 : o.colorMode === 'cube' ? 3 : o.colorMode === 'rows' ? 4 : 3; }

  // ---------------------------------------------------------------- outlines (CCW, centered)
  function outline(shape, size) {
    if (shape === 'hex') { const R = size / 2; return [0, 1, 2, 3, 4, 5].map(i => [R * Math.cos(i * Math.PI / 3), R * Math.sin(i * Math.PI / 3)]); }
    if (shape === 'triangle') { const s = size, h = s * S3 / 2; return [[-s / 2, -h / 3], [s / 2, -h / 3], [0, 2 * h / 3]]; }
    if (shape === 'diamond') { const b = size / 2, a = b / S3; return [[0, -a], [b, 0], [0, a], [-b, 0]]; }
    const w = size, h = shape === 'square' ? size : shape === 'brick' ? size / 2 : size / 4;
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  }
  function edges(P) { // outward normal and distance from the center for each edge i (P[i] -> P[i+1])
    return P.map((a, i) => { const b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), n = [dy / L, -dx / L]; return { a, b, L, n, t: [dx / L, dy / L], ap: a[0] * n[0] + a[1] * n[1] }; });
  }
  function gauge(E, x, y) { let g = -1e9, k = 0; for (let i = 0; i < E.length; i++) { const v = (x * E[i].n[0] + y * E[i].n[1]) / E[i].ap; if (v > g) { g = v; k = i; } } return [g, k]; }
  function edgeDist(E, x, y) { let d = 1e9; for (const e of E) d = Math.min(d, e.ap - (x * e.n[0] + y * e.n[1])); return d; }

  // ---------------------------------------------------------------- face patterns: h in 0..1
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function heightFn(o, P) {
    const E = edges(P), n = P.length, pat = o.pattern, sc = o.scale, ca = Math.cos(o.angle * Math.PI / 180), sa = Math.sin(o.angle * Math.PI / 180);
    const rot = (x, y) => [x * ca + y * sa, -x * sa + y * ca];
    const minAp = Math.min(...E.map(e => e.ap));
    let crystal = null;
    if (pat === 'crystal') {
      const R = rng(o.seed * 7919 + n), Rm = Math.max(...P.map(p => Math.hypot(p[0], p[1]))), m = 7, th = [];
      const A = [(R() - 0.5) * 0.5 * minAp, (R() - 0.5) * 0.5 * minAp];
      for (let k = 0; k < m; k++) th.push((k + 0.25 + R() * 0.5) / m * TAU);
      crystal = { A, planes: th.map(t => ({ d: [Math.cos(t), Math.sin(t)], s: Rm * (0.55 + R() * 0.5) })) };
    }
    const vh = P.map((_, i) => (n % 2 === 0 ? (i % 2 === 0 ? 0.5 : 0) : 0)); // corner heights for the 3D cube look
    const hexDist = (x, y, s) => { // distance to the nearest edge of a hex cell lattice (flat-to-flat s)
      const q = rot(x, y); let px = q[0] / s, py = q[1] / s;
      const r = py * 2 / S3, qq = px - py / S3; let rx = Math.round(qq), rz = Math.round(r), ry = Math.round(-qq - r);
      const dx = Math.abs(rx - qq), dz = Math.abs(rz - r), dy = Math.abs(ry + qq + r);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dz > dy) rz = -rx - ry;
      const cx = (rx + rz / 2) * s, cy = rz * S3 / 2 * s, ux = q[0] - cx, uy = q[1] - cy;
      let m = 0, mk = 0; for (let k = 0; k < 3; k++) { const a = Math.PI / 6 + k * Math.PI / 3, v = ux * Math.cos(a) + uy * Math.sin(a); if (Math.abs(v) > m) { m = Math.abs(v); mk = v < 0 ? k + 3 : k; } }
      hexCell = rx + ',' + rz + ',' + mk;
      return s / 2 - m;
    };
    let hexCell = '';
    const hfn = (x, y) => {
      const gk = gauge(E, x, y), g = gk[0], lc = 1 - g; // lc: 1 at the center, 0 on the outline
      if (lc <= 0) return 0;
      let h;
      switch (pat) {
        case 'flat': h = 0.5; break;
        case 'pyramid': h = lc; break;
        case 'hollow': h = 1 - lc; break;
        case 'steps': { // flat terraces joined by short steep risers (crisp, printable, no torn vertical walls)
          const v = lc * 5, k = Math.floor(v + 1e-6), rw = Math.min(0.5, 0.45 / (E[gk[1]].ap / 5)), fr = v - k;
          h = Math.min(1, (k + (fr > 1 - rw ? (fr - (1 - rw)) / rw : 0)) / 4); break;
        }
        case 'pillow': h = Math.sqrt(Math.max(0, 1 - (1 - lc) * (1 - lc))); break;
        case 'dish': h = (1 - lc) * (1 - lc); break;
        case 'cube': {
          if (n % 2) { h = lc; break; }
          const i = gk[1], a = P[i], b = P[(i + 1) % n]; // barycentric in the fan triangle (center, a, b)
          const det = a[0] * b[1] - a[1] * b[0], wa = (x * b[1] - y * b[0]) / det, wb = (a[0] * y - a[1] * x) / det;
          h = (1 - wa - wb) + wa * vh[i] + wb * vh[(i + 1) % n]; break;
        }
        case 'crystal': {
          const c = crystal; let m = 1;
          for (const p of c.planes) m = Math.min(m, 1 - ((x - c.A[0]) * p.d[0] + (y - c.A[1]) * p.d[1]) / p.s);
          h = Math.max(0, Math.min(m, lc * 1.7)); break;
        }
        case 'wave': { const q = rot(x, y); h = 0.5 + 0.5 * Math.sin(TAU * q[1] / sc); break; }
        case 'ripple': h = 0.5 + 0.5 * Math.cos(TAU * Math.hypot(x, y) / sc); break;
        case 'honeycomb': h = Math.max(0, Math.min(1, hexDist(x, y, sc) / Math.max(1.2, sc * 0.12))); break;
        case 'flutes': { const q = rot(x, y), u = ((q[0] / sc) % 1 + 1) % 1 * 2 - 1; h = Math.sqrt(Math.max(0, 1 - u * u)); break; }
        case 'chevron': { const q = rot(x, y), u = (Math.abs(q[0]) * 0.75 + q[1]) / sc, f = ((u % 1) + 1) % 1; h = 1 - Math.abs(f * 2 - 1); break; }
        case 'studs': { const q = rot(x, y), ux = ((q[0] / sc) % 1 + 1) % 1 - 0.5, uy = ((q[1] / sc) % 1 + 1) % 1 - 0.5, r = Math.hypot(ux, uy) / 0.36; h = r < 1 ? Math.sqrt(1 - r * r) : 0; break; }
        case 'sunburst': { // rays fade out toward the middle, where 16 rays would crowd into noise
          const a = Math.atan2(y, x) - o.angle * Math.PI / 180, fade = sstep(SUN_R0, SUN_R0 * 2.2, Math.hypot(x, y));
          h = Math.sqrt(lc) * (0.5 + 0.5 * (1 - fade) + 0.5 * fade * Math.cos(a * 16)); break;
        }
        case 'weave': {
          const q = rot(x, y), ci = Math.floor(q[0] / sc), cj = Math.floor(q[1] / sc), along = (ci + cj) % 2 === 0 ? q[1] : q[0];
          const f = ((along / (sc / 3)) % 1 + 1) % 1, ux = q[0] / sc - ci, uy = q[1] / sc - cj;
          const edge = Math.min(ux, 1 - ux, uy, 1 - uy) * sc; // strands tuck down at the cell edges: no torn walls
          h = Math.sin(Math.PI * f) * sstep(0, Math.max(0.8, sc * 0.08), edge); break;
        }
        default: h = 0.5;
      }
      if (o.bevel > 0) { const d = lc * (gk[1] != null ? E[gk[1]].ap : minAp); if (d < o.bevel) h *= d / o.bevel; }
      return h;
    };
    // which smooth piece of the surface (x, y) is on: the relief is smooth inside a piece and creased or stepped
    // where the label changes, so the mesh puts vertices exactly on those lines (crisp ridges, no stair-steps)
    const fanPat = ['pyramid', 'hollow', 'steps', 'pillow', 'dish', 'cube', 'crystal', 'sunburst'].includes(pat);
    const label = (x, y) => {
      const gk = gauge(E, x, y), lc = 1 - gk[0];
      if (lc <= 0) return 'o';
      let s = '';
      const inBevel = o.bevel > 0 && lc * E[gk[1]].ap < o.bevel;
      if (fanPat || inBevel) s += gk[1];
      if (inBevel) s += 'b';
      switch (pat) {
        case 'steps': { const v = lc * 5, k = Math.floor(v + 1e-6), rw = Math.min(0.5, 0.45 / (E[gk[1]].ap / 5)); s += '|' + k + (v - k > 1 - rw ? 'r' : ''); break; }
        case 'sunburst': { const r = Math.hypot(x, y); if (r > SUN_R0 * 1.4) s += '|' + Math.floor((Math.atan2(y, x) - o.angle * Math.PI / 180) * 16 / Math.PI + 64); break; }
        case 'crystal': {
          const c = crystal; let m = 1, k = -1;
          c.planes.forEach((p, i) => { const v = 1 - ((x - c.A[0]) * p.d[0] + (y - c.A[1]) * p.d[1]) / p.s; if (v < m) { m = v; k = i; } });
          if (lc * 1.7 < m) { m = lc * 1.7; k = 'c'; }
          s += '|' + (m <= 0 ? 'z' : k); break;
        }
        case 'honeycomb': { const w = Math.max(1.2, sc * 0.12), d = hexDist(x, y, sc); s += '|' + (d >= w ? hexCell.split(',').slice(0, 2).join(',') + 't' : hexCell); break; }
        case 'flutes': { const q = rot(x, y); s += '|' + Math.floor(q[0] / sc); break; }
        case 'chevron': { const q = rot(x, y), u = (Math.abs(q[0]) * 0.75 + q[1]) / sc; s += '|' + (q[0] < 0 ? 'l' : 'r') + Math.floor(u * 2); break; }
        case 'studs': { const q = rot(x, y), ci = Math.floor(q[0] / sc), cj = Math.floor(q[1] / sc), ux = q[0] / sc - ci - 0.5, uy = q[1] / sc - cj - 0.5; s += '|' + (Math.hypot(ux, uy) < 0.36 ? ci + ',' + cj : 'f'); break; }
        case 'weave': { const q = rot(x, y), ci = Math.floor(q[0] / sc), cj = Math.floor(q[1] / sc), along = (ci + cj) % 2 === 0 ? q[1] : q[0], ux = q[0] / sc - ci, uy = q[1] / sc - cj; s += '|' + ci + ',' + cj + ',' + Math.floor(along / (sc / 3)) + (Math.min(ux, 1 - ux, uy, 1 - uy) * sc < Math.max(0.8, sc * 0.08) ? 'e' : ''); break; }
        default: break;
      }
      return s;
    };
    const fn = (x, y) => hfn(x, y);
    fn.label = label;
    return fn;
  }

  // ---------------------------------------------------------------- the relief slab
  // The top is a Delaunay mesh of: points along the outline, points placed exactly on every crease and step of the
  // pattern (found where the surface label changes, refined by bisection), and an even lattice everywhere else that
  // keeps clear of those lines. Ridges, valleys and step walls come out as straight crisp edges instead of the
  // stair-steps a plain grid gives. Walls follow the outline and the back is one fan, so the slab is closed.
  const Dln = () => { const D = G.Delaunator || (typeof require === 'function' ? require('delaunator') : null); return (D && D.default) || D; };
  function slab(o, P, scaleOut) {
    const n = P.length, Q = P.map(p => [p[0] * scaleOut, p[1] * scaleOut]), hf = heightFn(o, P), lab = hf.label;
    const EQ = edges(Q), inside = (x, y, m) => edgeDist(EQ, x, y) >= (m || 0);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of Q) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const area = edgesArea(Q);
    let cell = CELL[o.preview ? 'preview' : o.detail];
    cell = Math.max(cell, Math.sqrt(area / 0.866 / 260000)); // keep huge panels to a sane size
    const pts = [], hash = new Map(), H = cell * 0.5;
    const key = (x, y) => Math.floor(x / H) + ',' + Math.floor(y / H);
    const near = (x, y, r) => { const i = Math.floor(x / H), j = Math.floor(y / H), k = Math.ceil(r / H); for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) { const L = hash.get((i + a) + ',' + (j + b)); if (L) for (const q of L) if (Math.hypot(q[0] - x, q[1] - y) < r) return true; } return false; };
    const add = (x, y, f) => { pts.push(x, y); if (f) { const k = key(x, y); let L = hash.get(k); if (!L) hash.set(k, L = []); L.push([x, y]); } };
    // 1. the outline
    for (let i = 0; i < n; i++) { const a = Q[i], b = Q[(i + 1) % n], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / cell)); for (let k = 0; k < m; k++) add(a[0] + (b[0] - a[0]) * k / m, a[1] + (b[1] - a[1]) * k / m, true); }
    // 1b. the edge bevel: rows parallel to each edge, lined up with the outline points, so the ramp is even quads
    if (o.bevel > 0) {
      const EP = edges(P), rows = [o.bevel / 3, o.bevel * 2 / 3, o.bevel - 0.002, o.bevel + 0.002];
      for (let i = 0; i < n; i++) {
        const a = Q[i], b = Q[(i + 1) % n], e = EQ[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(2, Math.ceil(len / cell));
        for (const d of rows) for (let k = 0; k <= m; k++) {
          const x = a[0] + (b[0] - a[0]) * k / m - e.n[0] * d, y = a[1] + (b[1] - a[1]) * k / m - e.n[1] * d;
          if (!inside(x, y, 0.001) || gauge(EP, x, y)[1] !== i || near(x, y, cell * 0.3)) continue;
          add(x, y, true);
        }
      }
    }
    // 2. creases and steps
    const f = cell * 0.5, nx = Math.ceil((x1 - x0) / f) + 1, ny = Math.ceil((y1 - y0) / f) + 1, L = new Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + i * f, y = y0 + j * f; L[j * nx + i] = inside(x, y, 0) ? lab(x, y) : null; }
    const z = (x, y) => o.depth * hf(x, y), rim = cell * 0.35, sep = cell * 0.42;
    const cross = (ax, ay, bx, by, la) => {
      let lo = 0, hi = 1; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (lab(ax + (bx - ax) * m, ay + (by - ay) * m) === la) lo = m; else hi = m; }
      const t = (lo + hi) / 2, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      const de = edgeDist(EQ, x, y); if (de < rim || near(x, y, o.bevel > 0 && de < o.bevel + cell * 0.6 ? cell * 0.62 : sep)) return;
      const ux = (bx - ax) / f, uy = (by - ay) / f, e = 0.03, ea = Math.hypot(ux, uy) || 1;
      const xa = x - ux / ea * e, ya = y - uy / ea * e, xb = x + ux / ea * e, yb = y + uy / ea * e;
      if (Math.abs(z(xa, ya) - z(xb, yb)) > 0.12) { add(xa, ya, false); add(xb, yb, false); const k = key(x, y); let Lh = hash.get(k); if (!Lh) hash.set(k, Lh = []); Lh.push([x, y]); }
      else add(x, y, true);
    };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const la = L[j * nx + i]; if (la === null) continue;
      const x = x0 + i * f, y = y0 + j * f;
      if (i + 1 < nx) { const lb = L[j * nx + i + 1]; if (lb !== null && lb !== la) cross(x, y, x + f, y, la); }
      if (j + 1 < ny) { const lb = L[(j + 1) * nx + i]; if (lb !== null && lb !== la) cross(x, y, x, y + f, la); }
    }
    // 3. an even lattice in the smooth parts
    const rowH = cell * 0.866;
    for (let j = 0, y = y0; y <= y1; j++, y = y0 + j * rowH) for (let x = x0 + (j % 2 ? cell / 2 : 0); x <= x1; x += cell) {
      if (!inside(x, y, cell * 0.45) || near(x, y, cell * 0.55)) continue;
      add(x, y, false);
    }
    // 4. triangulate (the outline is convex, so the hull is the outline)
    const D = new (Dln())(Float64Array.from(pts)), T3 = D.triangles, np = pts.length / 2;
    const top = [];
    for (let t = 0; t < T3.length; t += 3) {
      const a = T3[t], b = T3[t + 1], c = T3[t + 2];
      const ar = (pts[2 * b] - pts[2 * a]) * (pts[2 * c + 1] - pts[2 * a + 1]) - (pts[2 * b + 1] - pts[2 * a + 1]) * (pts[2 * c] - pts[2 * a]);
      if (Math.abs(ar) < 1e-10) continue;
      if (ar > 0) top.push(a, b, c); else top.push(a, c, b); // counter-clockwise seen from above
    }
    // boundary edges (used by one triangle), in order around the outline
    const cnt = new Map(); for (let t = 0; t < top.length; t += 3) for (let k = 0; k < 3; k++) { const a = top[t + k], b = top[t + (k + 1) % 3], kk = a < b ? a + ',' + b : b + ',' + a; cnt.set(kk, (cnt.get(kk) || 0) + 1); }
    const nextOf = new Map(); for (let t = 0; t < top.length; t += 3) for (let k = 0; k < 3; k++) { const a = top[t + k], b = top[t + (k + 1) % 3], kk = a < b ? a + ',' + b : b + ',' + a; if (cnt.get(kk) === 1) nextOf.set(a, b); }
    const X = new Float32Array((np * 2 + 1) * 3);
    for (let v = 0; v < np; v++) { const x = pts[2 * v], y = pts[2 * v + 1]; X[v * 3] = x; X[v * 3 + 1] = y; X[v * 3 + 2] = o.base + o.depth * hf(x, y); X[(v + np) * 3] = x; X[(v + np) * 3 + 1] = y; X[(v + np) * 3 + 2] = 0; }
    const bc = np * 2; X[bc * 3] = 0; X[bc * 3 + 1] = 0; X[bc * 3 + 2] = 0;
    const F = top.slice();
    for (const [a, b] of nextOf) { F.push(a + np, b, a); F.push(a + np, b + np, b); F.push(bc, b + np, a + np); }
    const used = new Int32Array(np * 2 + 1).fill(-1), out = []; let m = 0;
    for (const v of F) if (used[v] < 0) used[v] = m++;
    const XV = new Float32Array(m * 3); for (let v = 0; v < np * 2 + 1; v++) if (used[v] >= 0) { XV[used[v] * 3] = X[v * 3]; XV[used[v] * 3 + 1] = X[v * 3 + 1]; XV[used[v] * 3 + 2] = X[v * 3 + 2]; }
    for (const v of F) out.push(used[v]);
    return { V: XV, F: Uint32Array.from(out), hf, cell };
  }

  // ---------------------------------------------------------------- 2D helpers (CrossSection)
  function cs(M, pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return new M.CrossSection([a < 0 ? pts.slice().reverse() : pts], 'Positive'); }
  function circlePts(cx, cy, r, k) { const out = []; k = k || 40; for (let i = 0; i < k; i++) { const a = i / k * TAU; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; }
  function rectPts(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  // local edge frame: u along the edge from its midpoint-relative position, w inward (negative = outward)
  function frame(e, t) { const px = e.a[0] + (e.b[0] - e.a[0]) * t, py = e.a[1] + (e.b[1] - e.a[1]) * t; return (u, w) => [px + e.t[0] * u - e.n[0] * w, py + e.t[1] * u - e.n[1] * w]; }
  function clipSpots(o, E) { // positions (fraction along each edge) of the clip channels
    const rect = o.shape === 'square' || o.shape === 'brick' || o.shape === 'plank';
    return E.map(e => (rect || e.L > 95) && e.L > 46 ? [0.25, 0.75] : [0.5]);
  }
  function knobPts(f, out, tol) { // a jigsaw knob: a neck then a round head; out=true sticks outward, else a socket inward
    const s = out ? -1 : 1, nw = 3.6 + tol, hr = 5.6 + tol, hc = 8.4, pts = [f(-nw, -s * 0.6), f(nw, -s * 0.6)];
    const a0 = Math.asin(Math.min(0.999, nw / hr));
    for (let i = 0; i <= 32; i++) { const a = a0 + (TAU - 2 * a0) * i / 32; pts.push(f(hr * Math.sin(a), s * (hc - hr * Math.cos(a)))); }
    return pts;
  }

  // ---------------------------------------------------------------- Manifold kit
  function kit(M) {
    const all = [], k = x => { all.push(x); return x; };
    const fromIdx = (V, F) => k(new M.Manifold(new M.Mesh({ numProp: 3, vertProperties: V, triVerts: F })));
    const cyl = (r, z0, z1, x, y, r2) => k(k(M.Manifold.cylinder(z1 - z0, r, r2 == null ? r : r2, Math.max(36, Math.min(120, Math.round(r * 5))))).translate([x || 0, y || 0, z0]));
    const prism = (pts, z0, z1) => { const c = cs(M, pts); const m = k(k(c.extrude(z1 - z0)).translate([0, 0, z0])); c.delete(); return m; };
    const union = a => { a = a.filter(Boolean); return a.length === 1 ? a[0] : k(M.Manifold.union(a)); };
    const sub = (a, b) => { b = b.filter(Boolean); return b.length ? k(a.subtract(union(b))) : a; };
    const soup = m => { const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float32Array(F.length * 3); for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; } return p; };
    const free = () => { for (const x of all) { try { x.delete(); } catch (e) {} } all.length = 0; };
    return { fromIdx, cyl, prism, union, sub, soup, free, k };
  }
  // keyhole cut from the back (z=0 is the wall side): entry hole, then a slot up toward +dir with an undercut for the screw head
  function keyhole(K, cx, cy, dir, zTop) {
    const ux = Math.cos(dir), uy = Math.sin(dir), L = 10, at = (s, w) => [cx + ux * s - uy * w, cy + uy * s + ux * w];
    const slot = [at(0, -2.6), at(L, -2.6), at(L, 2.6), at(0, 2.6)], wide = [at(0, -5.2), at(L, -5.2), at(L, 5.2), at(0, 5.2)];
    return [K.cyl(5.2, -1, zTop, cx, cy), K.prism(slot, -1, 1.8), K.prism(wide, 1.8, zTop), K.cyl(5.2, 1.8, zTop, at(L, 0)[0], at(L, 0)[1])];
  }
  function mountSpots(o, P) { // where hangers, screws, strips and spacers go (panel frame)
    if (o.shape === 'brick' || o.shape === 'plank') return [[-o.size / 4, 0], [o.size / 4, 0]];
    const c = [0, 0]; if (o.shape === 'triangle') c[1] = 0; return [c];
  }

  // ---------------------------------------------------------------- layout planner
  function lattice(o) {
    const s = o.size, g = o.gap, out = []; // {x, y, rot, v (variant), i, j}
    const span = 26;
    if (o.shape === 'hex') {
      const H = s / 2 * S3 + g, dx = H * S3 / 2;
      for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) out.push({ x: i * dx, y: j * H + (Math.abs(i) % 2 ? H / 2 : 0), rot: 0, v: 0, i, j });
    } else if (o.shape === 'triangle') {
      const s2 = s + g * S3, h = s2 * S3 / 2;
      for (let j = -span; j <= span; j++) for (let i = -span * 2; i <= span * 2; i++) { const up = ((i + j) % 2 + 2) % 2 === 0; out.push({ x: i * s2 / 2, y: j * h + (up ? 0 : h / 3), rot: up ? 0 : Math.PI, v: up ? 0 : 1, i, j }); }
    } else if (o.shape === 'diamond') { // tumbling blocks: three diamonds make a hexagon
      const side = s / S3 + g / (S3 / 2), dx = side * S3, dy = side * 1.5;
      for (let j = -span; j <= span; j++) for (let i = -span; i <= span; i++) {
        const cx = i * dx + (Math.abs(j) % 2 ? dx / 2 : 0), cy = j * dy;
        for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + k * TAU / 3; out.push({ x: cx + side / 2 * Math.cos(a), y: cy + side / 2 * Math.sin(a), rot: k * TAU / 3, v: k, i: i * 3 + k, j }); }
      }
    } else {
      const w = s + g, h = (o.shape === 'square' ? s : o.shape === 'brick' ? s / 2 : s / 4) + g;
      for (let j = -span * 2; j <= span * 2; j++) for (let i = -span; i <= span; i++) out.push({ x: i * w + (o.offset && Math.abs(j) % 2 ? w / 2 : 0), y: j * h, rot: 0, v: 0, i, j });
    }
    return out;
  }
  function placedOutline(P, c) { const ca = Math.cos(c.rot), sa = Math.sin(c.rot); return P.map(p => [c.x + p[0] * ca - p[1] * sa, c.y + p[0] * sa + p[1] * ca]); }
  function plan(o) {
    const P = outline(o.shape, o.size), L = lattice(o); let pick = [];
    const rowStep = o.shape === 'hex' ? 1 : 1;
    void rowStep;
    if (o.layout === 'fill') {
      const W = o.wallW / 2, H = o.wallH / 2;
      for (const c of L) { const q = placedOutline(P, c); if (q.every(p => Math.abs(p[0]) <= W + 0.01 && Math.abs(p[1]) <= H + 0.01)) pick.push(c); }
    } else if (o.layout === 'grid') {
      if (o.shape === 'diamond') { // cols x rows of whole hexagons
        const c0 = Math.floor((o.cols - 1) / 2), r0 = Math.floor((o.rows - 1) / 2);
        pick = L.filter(c => { const ii = Math.floor(c.i / 3); return ii >= -c0 && ii < o.cols - c0 && c.j >= -r0 && c.j < o.rows - r0; });
      } else if (o.shape === 'triangle') {
        const c0 = Math.floor((o.cols - 1) / 2), r0 = Math.floor((o.rows - 1) / 2);
        pick = L.filter(c => c.i >= -c0 * 2 && c.i < (o.cols - c0) * 2 && c.j >= -r0 && c.j < o.rows - r0);
      } else {
        const c0 = Math.floor((o.cols - 1) / 2), r0 = Math.floor((o.rows - 1) / 2);
        pick = L.filter(c => c.i >= -c0 && c.i < o.cols - c0 && c.j >= -r0 && c.j < o.rows - r0);
      }
    } else { // cluster: an organic blob grown from the middle
      const R = rng(o.seed * 31 + 5), sc = o.size;
      const scored = L.map(c => ({ c, d: Math.hypot(c.x * 0.8, c.y) / sc + R() * 0.9 }));
      scored.sort((a, b) => a.d - b.d);
      // grow connected: take the closest-scored that touches what is already picked
      const took = [scored[0].c], lim = (o.size + o.gap) * 1.05;
      const touch = c => took.some(t => Math.hypot(t.x - c.x, t.y - c.y) < lim);
      const rest = scored.slice(1).map(s => s.c);
      while (took.length < o.count && rest.length) { const k = rest.findIndex(touch); if (k < 0) break; took.push(rest.splice(k, 1)[0]); }
      pick = took;
    }
    if (pick.length > MAX_PANELS) pick = pick.slice(0, MAX_PANELS);
    if (!pick.length) pick = [L.reduce((a, b) => (Math.hypot(a.x, a.y) <= Math.hypot(b.x, b.y) ? a : b))];
    // center the arrangement
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of pick) for (const p of placedOutline(P, c)) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const panels = pick.map((c, k) => ({ x: c.x - mx, y: c.y - my, rot: c.rot, v: c.v, i: c.i, j: c.j, k }));
    // colors
    const nc = colorCount(o), R = rng(o.seed * 131 + 17), ys = panels.map(p => p.y), ylo = Math.min(...ys), yhi = Math.max(...ys);
    for (const p of panels) {
      if (o.colorMode === 'one') p.c = 0;
      else if (o.colorMode === 'alternate') p.c = o.shape === 'triangle' ? p.v : o.shape === 'diamond' ? (p.v === 0 ? 0 : 1) : ((p.i + p.j) % 2 + 2) % 2;
      else if (o.colorMode === 'cube') p.c = o.shape === 'diamond' ? p.v : o.shape === 'triangle' ? p.v : ((p.i % 3) + 3) % 3;
      else if (o.colorMode === 'rows') p.c = Math.min(3, Math.floor((p.y - ylo) / Math.max(1, yhi - ylo + 1e-6) * 4));
      else p.c = Math.floor(R() * nc);
    }
    // joints between neighbors: matching clip channels across a seam
    const E = edges(P), spots = clipSpots(o, E), pts = [];
    panels.forEach((p, pi) => { const ca = Math.cos(p.rot), sa = Math.sin(p.rot); E.forEach((e, ei) => spots[ei].forEach(t => { const f = frame(e, t)(0, 0); pts.push({ pi, x: p.x + f[0] * ca - f[1] * sa, y: p.y + f[0] * sa + f[1] * ca }); })); });
    let links = 0; const tol = o.gap + 0.6, seen = new Set();
    for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
      if (pts[a].pi === pts[b].pi) continue;
      if (Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y) <= tol) { const kk = a + ',' + b; if (!seen.has(kk)) { seen.add(kk); links++; } }
    }
    const wx = x1 - x0, wy = y1 - y0;
    return { panels, links, width: wx, height: wy, P };
  }

  // ---------------------------------------------------------------- parts
  function panelPart(o, M, variant, rot) {
    const P = outline(o.shape, o.size), E = edges(P), K = kit(M);
    try {
      const puzzle = o.joint === 'puzzle', minAp = Math.min(...E.map(e => e.ap));
      const grow = puzzle ? 1 + 16 / minAp : 1;
      const sl = slab(o, P, grow);
      let body = K.fromIdx(sl.V, sl.F);
      if (puzzle) {
        const zt = o.base + o.depth + 2;
        let shape = K.prism(P, -1, zt);
        const add = [], cut = [];
        E.forEach(e => { add.push(K.prism(knobPts(frame(e, 0.3), true, 0), -1, zt)); cut.push(K.prism(knobPts(frame(e, 0.7), false, 0.22), -2, zt + 1)); });
        shape = K.sub(K.union([shape, ...add]), cut);
        body = K.k(body.intersect(shape));
      }
      const cuts = [], spotsM = mountSpots(o, P), up = Math.PI / 2 - rot; // "up" on the wall, in the panel's own frame
      if (o.joint === 'clip') {
        const sp = clipSpots(o, E), d = CLIP.depth, hw = CLIP.headW / 2 + CLIP.tol, nw = CLIP.neckW / 2 + CLIP.tol;
        E.forEach((e, ei) => sp[ei].forEach(t => {
          const f = frame(e, t);
          cuts.push(K.prism([f(-nw, -1), f(nw, -1), f(nw, CLIP.near + 0.1), f(-nw, CLIP.near + 0.1)], -1, d));
          cuts.push(K.prism([f(-hw, CLIP.near - 0.2), f(hw, CLIP.near - 0.2), f(hw, CLIP.far + CLIP.tol), f(-hw, CLIP.far + CLIP.tol)], -1, d));
        }));
      }
      if (o.backlight) {
        for (const s of spotsM) cuts.push(K.cyl(7.25, -1, 2.9, s[0], s[1]));
      } else if (o.mount === 'hanger') {
        for (const s of spotsM) cuts.push(...keyhole(K, s[0], s[1] - 5 * Math.sin(up), up, 3.0));
      } else if (o.mount === 'screw') {
        for (const s of spotsM) { const zt = o.base + o.depth * sl.hf(s[0], s[1]); cuts.push(K.cyl(2.3, -1, zt + 1, s[0], s[1]), K.cyl(2.3, zt - 2.4, zt + 0.02, s[0], s[1], 4.7), K.cyl(4.7, zt, zt + 5, s[0], s[1])); }
      } else if (o.mount === 'adhesive') {
        const L = Math.min(48, minAp * 1.1), W = 16.6;
        for (const s of spotsM) { const ux = Math.cos(up), uy = Math.sin(up); const at = (a, b) => [s[0] + ux * a - uy * b, s[1] + uy * a + ux * b]; cuts.push(K.prism([at(-L / 2, -W / 2), at(L / 2, -W / 2), at(L / 2, W / 2), at(-L / 2, W / 2)], -1, 0.8)); }
      }
      if (cuts.length) body = K.sub(body, cuts);
      const p = K.soup(body);
      return { p, tris: p.length / 9 };
    } finally { K.free(); }
  }
  function clipPart(o, M) {
    const K = kit(M);
    try {
      const g2 = o.gap / 2, nw = CLIP.neckW / 2, hw = CLIP.headW / 2, a = g2 + CLIP.near, b = g2 + CLIP.far;
      const pts = [[-b, -hw], [-a, -hw], [-a, -nw], [a, -nw], [a, -hw], [b, -hw], [b, hw], [a, hw], [a, nw], [-a, nw], [-a, hw], [-b, hw]];
      const m = K.prism(pts, 0, CLIP.t); return { p: K.soup(m) };
    } finally { K.free(); }
  }
  function spacerPart(o, M) {
    const K = kit(M);
    try {
      const S = o.spacer, ring = K.sub(K.cyl(7, S - 0.01, S + 2.5), [K.cyl(5, S - 1, S + 3)]);
      let m = K.union([K.cyl(12, 0, S), ring]);
      const cut = [];
      if (o.mount === 'screw') cut.push(K.cyl(2.3, -1, S + 3), K.cyl(4.8, 3, S + 3));
      else if (o.mount === 'hanger') cut.push(...keyhole(K, 0, -5, Math.PI / 2, 3.0), K.cyl(4.6, 3, S + 3));
      else cut.push(K.cyl(4.6, 3, S + 3)); // lighter
      m = K.sub(m, cut);
      return { p: K.soup(m) };
    } finally { K.free(); }
  }

  function rotZ(p, a, dx, dy, dz) { const c = Math.cos(a), s = Math.sin(a), q = new Float32Array(p.length); for (let i = 0; i < p.length; i += 3) { const x = p[i], y = p[i + 1]; q[i] = x * c - y * s + dx; q[i + 1] = x * s + y * c + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  function usable(o) { return { w: Math.max(50, o.bed[0] - 8), d: Math.max(50, o.bed[1] - 8), z: Math.max(30, o.bed[2] - 4) }; }

  function build(raw, M) {
    const o = options(raw), lay = plan(o), P = lay.P, warnings = [];
    if (!M) throw new Error('Manifold is not loaded');
    // variants: geometry differs only when a hanger or strip must point up on a rotated panel
    const orient = !o.backlight && (o.mount === 'hanger' || o.mount === 'adhesive');
    const vkey = p => orient ? Math.round(((p.rot % TAU) + TAU) % TAU * 1000) : 0;
    const geo = new Map();
    for (const p of lay.panels) { const k = vkey(p); if (!geo.has(k)) geo.set(k, panelPart(o, M, p.v, orient ? p.rot : 0)); }
    const parts = [], counts = {};
    const groups = new Map();
    for (const p of lay.panels) { const gk = vkey(p) + '|' + p.c; if (!groups.has(gk)) groups.set(gk, { key: vkey(p), c: p.c, rot: p.rot, list: [] }); groups.get(gk).list.push(p); }
    let gi = 0;
    const names = 'ABCDEFGHIJKL';
    for (const gr of groups.values()) {
      const g = geo.get(gr.key), color = o.colors[gr.c], nm = `Panel ${names[gi++] || gi}`;
      counts[nm] = gr.list.length;
      const shown = gr.list.map(p => rotZ(g.p, p.rot, p.x, p.y, 0));
      const assembled = new Float32Array(shown.reduce((s, q) => s + q.length, 0)); { let k = 0; for (const q of shown) { assembled.set(q, k); k += q.length; } }
      parts.push({ name: nm, kind: 'panel', color, count: gr.list.length, local: g.p, assembled, colorIndex: gr.c, tris: g.tris });
    }
    if (o.joint === 'clip' && lay.links) {
      const cp = clipPart(o, M);
      parts.push({ name: 'Clip', kind: 'clip', color: o.hwColor, count: lay.links, local: cp.p, assembled: new Float32Array(0) });
    }
    if (o.backlight) {
      const sp = spacerPart(o, M), spots = mountSpots(o, P), n = lay.panels.length * spots.length;
      const shown = [];
      for (const p of lay.panels) for (const s of spots) { const ca = Math.cos(p.rot), sa = Math.sin(p.rot); shown.push(rotZ(sp.p, 0, p.x + s[0] * ca - s[1] * sa, p.y + s[0] * sa + s[1] * ca, 0)); }
      const assembled = new Float32Array(shown.reduce((s, q) => s + q.length, 0)); { let k = 0; for (const q of shown) { assembled.set(q, k); k += q.length; } }
      parts.push({ name: 'Spacer', kind: 'spacer', color: o.hwColor, count: n, local: sp.p, assembled });
    }
    // the panels sit on the spacers (the wall is z=0, the face points +z)
    const lift = o.backlight ? o.spacer : 0;
    if (lift) for (const pt of parts) if (pt.kind === 'panel') for (let i = 2; i < pt.assembled.length; i += 3) pt.assembled[i] += lift;
    const U = usable(o);
    for (const pt of parts) { const bb = Core.bbox(pt.local); pt.size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]]; pt.fits = (pt.size[0] <= U.w && pt.size[1] <= U.d) || (pt.size[1] <= U.w && pt.size[0] <= U.d); }
    if (parts.some(pt => pt.kind === 'panel' && !pt.fits)) warnings.push('A panel is bigger than your printer. Make the panels smaller.');
    const E = edges(P);
    if (o.joint === 'puzzle' && Math.min(...E.map(e => e.L)) < 50) warnings.push('The edges are short for puzzle knobs. Use bigger panels or back clips.');
    if (o.pattern === 'steps' || o.pattern === 'studs' || o.pattern === 'honeycomb') if (o.depth > 10) warnings.push('Deep steps and dots print slower. 4 to 8 mm of relief looks best.');
    if (o.layout === 'cluster' && lay.panels.length < o.count) warnings.push('Not every panel fit the cluster.');
    const area = edgesArea(P) / 1e6;
    const grams = Math.round(parts.reduce((s, pt) => s + (pt.kind === 'panel' ? Core.volume ? 0 : 0 : 0), 0));
    void grams;
    let vol = 0; for (const pt of parts) vol += Math.abs(signedVol(pt.local)) * pt.count;
    const stats = {
      panels: lay.panels.length, width: Math.round(lay.width), height: Math.round(lay.height), clips: o.joint === 'clip' ? lay.links : 0,
      spacers: o.backlight ? lay.panels.length * mountSpots(o, P).length : 0, mounts: o.backlight ? 0 : lay.panels.length * mountSpots(o, P).length,
      grams: Math.round(vol / 1000 * 1.24), area: +(area * lay.panels.length).toFixed(2), depth: +(o.base + o.depth + (o.backlight ? o.spacer : 0)).toFixed(1),
      colors: [...new Set(lay.panels.map(p => p.c))].length, tris: parts.reduce((s, pt) => s + pt.local.length / 9, 0), variants: geo.size
    };
    return { options: o, parts, panels: lay.panels, outline: P, stats, warnings, counts };
  }
  function edgesArea(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
  function signedVol(p) { let v = 0; for (let i = 0; i < p.length; i += 9) v += (p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7]) - p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6]) + p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6])) / 6; return v; }

  function gateInfo(raw) {
    const o = options(raw), reasons = [];
    if (!SHAPES[o.shape].free) reasons.push(`${SHAPES[o.shape].label} panels`);
    if (!PATTERNS[o.pattern].free) reasons.push(`the ${PATTERNS[o.pattern].label} pattern`);
    return { shape: SHAPES[o.shape].label, pattern: PATTERNS[o.pattern].label, pro: reasons.length > 0, reasons };
  }
  // every printed piece, one object per copy when the set is small enough, else one of each
  function printList(res) {
    const o = res.options, tot = res.parts.reduce((s, pt) => s + pt.count * pt.local.length / 9, 0), full = o.fullSet && tot <= 3.2e6 && res.parts.reduce((s, pt) => s + pt.count, 0) <= 400;
    const out = [];
    for (const pt of res.parts) { const n = full ? pt.count : 1; for (let i = 0; i < n; i++) out.push({ name: n > 1 ? `${pt.name} ${i + 1}` : full || pt.count === 1 ? pt.name : `${pt.name} (print ${pt.count})`, p: pt.local, color: pt.color }); }
    return { list: out, full };
  }
  function arrangePlates(res) { const U = usable(res.options); return PL.arrange(printList(res).list, U.w, U.d, { gap: 4, maxZ: U.z }); }
  function export3MF(res, o) {
    o = o || {};
    const cols = []; res.parts.forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const ext = c => cols.indexOf((c || '').toUpperCase()) + 1;
    const A = arrangePlates(res), objs = [], plates = [];
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, p: it.p, color: it.color, extruder: ext(it.color) }); }); plates.push(ids); });
    A.unfit.forEach(u => { plates.push([objs.length]); objs.push({ name: u.name, p: PL.normalize(u.p), color: u.color, extruder: ext(u.color) }); });
    return T.threeMF(objs, { title: o.name || 'Geometric wall panels', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const o = res.options, st = res.stats, L = [];
    L.push(`Expressarte geometric wall panels: ${SHAPES[o.shape].label}, ${PATTERNS[o.pattern].label}`, '');
    L.push(`${st.panels} panels, ${o.size} mm wide, covering about ${st.width} x ${st.height} mm. Relief ${o.depth} mm on a ${o.base} mm base.`);
    L.push('', 'Print these');
    for (const pt of res.parts) L.push(`  ${pt.name} x${pt.count}  ${pt.color}  ${Math.round(pt.size[0])} x ${Math.round(pt.size[1])} x ${Math.round(pt.size[2])} mm`);
    L.push('', 'Printing', '  - Panels print face up, flat back on the bed, no supports. 0.2 mm layers, 3 walls, 15% infill.',
      '  - Matte filament shows the facets best. A raking light from the side makes the relief pop.');
    if (o.joint === 'clip') L.push('  - Clips print flat. Press one into the channels on the back of two panels that touch, across the seam.');
    if (o.joint === 'puzzle') L.push('  - Puzzle edges: press each new panel straight down onto its neighbor so the knobs drop into the sockets.');
    L.push('', 'Hanging');
    if (o.backlight) {
      L.push(`  - Backlight: each panel stands on ${o.spacer} mm spacers with a ${o.gap} mm gap between panels. Run an LED strip on the wall behind the panels; the light glows out through the gaps.`);
      if (o.mount === 'screw') L.push('  - Screw each spacer to the wall (up to 4 mm screws, with wall anchors), then press the panel onto the spacer rings.');
      if (o.mount === 'hanger') L.push('  - Hang each spacer on a screw through its keyhole, then press the panel onto the spacer rings.');
      if (o.mount === 'adhesive') L.push('  - Stick each spacer to the wall with a removable mounting strip, then press the panel onto the spacer rings.');
    } else {
      if (o.mount === 'hanger') L.push('  - Hidden hanger: drive a screw (head up to 9.5 mm) until it stands 2.5 mm out of the wall, slide the keyhole over it and push down.');
      if (o.mount === 'screw') L.push('  - Screw through the countersunk hole (up to 4 mm screws, with wall anchors).');
      if (o.mount === 'adhesive') L.push('  - Removable mounting strips (about 16 mm wide) fit the recesses on the back. Press for 30 seconds and wait an hour before adding the next panel.');
    }
    L.push('  - Start with a level line in the middle and build out from there.');
    if (res.warnings.length) { L.push('', 'Notes'); res.warnings.forEach(w => L.push('  - ' + w)); }
    return L.join('\n');
  }
  function files(res, o) {
    o = o || {}; const base = o.fileBase || 'wall_panels', out = [];
    const slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    for (const pt of res.parts) out.push({ name: `${base}_${slug(pt.name)}_x${pt.count}.stl`, data: new Uint8Array(Core.writeSTL(pt.local, pt.name)) });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }
  // a small heightmap for the pattern buttons (-1 outside)
  function icon(shape, pattern, W, H) {
    const o = options({ shape, pattern, size: 100, scale: pattern === 'honeycomb' ? 22 : pattern === 'studs' ? 18 : 24, bevel: 1.5, depth: 8 });
    const P = outline(shape, 100), hf = heightFn(o, P), out = new Float32Array(W * H), E = edges(P);
    const Rm = Math.max(...P.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1])))) * 1.08;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = (x + 0.5 - W / 2) / (W / 2) * Rm, py = (H / 2 - y - 0.5) / (H / 2) * Rm;
      if (edgeDist(E, px, py) < 0) { out[y * W + x] = -1; continue; }
      const e = 0.6, dx = hf(px + e, py) - hf(px - e, py), dy = hf(px, py + e) - hf(px, py - e);
      out[y * W + x] = Math.max(0, Math.min(1, 0.62 + (-dx * 0.7 + dy * 0.9) * 5 + 0.12 * hf(px, py)));
    }
    return out;
  }
  const api = { SHAPES, SHAPE_KEYS, PATTERNS, PATTERN_KEYS, JOINTS, MOUNTS, LAYOUTS, COLOR_MODES, PALETTE, DEFAULTS, CLIP, MAX_PANELS, options, outline, edges, heightFn, plan, lattice, build, gateInfo, printList, arrangePlates, export3MF, notes, files, icon, usable, colorCount, edgeToEdge, slab };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPGeoWall = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
