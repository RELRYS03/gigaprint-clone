/* Expressarte Christmas ornament maker: heat-formed mesh ornaments.
   You print a flat lattice disc (a mesh with a design in a second color), warm it with a heat gun and press it in a
   printed two-part press: a cavity block (female) and a plunger (male). It comes out as half an ornament; make a
   second half the same way, then press the halves together on the pins in their rims and hang it by the ear.

   What this file builds (units: mm; every part is one closed, outward-facing solid):
   - the ornament outline (in the plane of the seam: x right, y up toward the hanger) and the outer surface of one
     half as a depth u(x, y) >= 0 below the flat mesh (0 outside the outline): a revolved half (ball, egg, onion
     finial, bell) or a pillow over the outline (star, heart; depth from the exact distance to the outline);
   - the mesh disc: lattice of thickness t inside a thicker rim (rimT) that stays cold and stiff, a flat flange
     between the outline and the rim, press-fit join pins and matching holes round the rim (one press makes both
     halves: a pin at angle \u03b8 meets a hole at 180\u00b0 \u2212 \u03b8 when one half is turned over), and a hanger ear;
   - the design (motif, text or a traced image) as its own part: inlaid through the lattice (same thickness) or
     raised on top, mirrored so it reads right from the outside (the bed face becomes the outside), and pre-distorted
     so it looks right from the front after forming (radial arc-length model, see arcTables);
   - the cavity block: a pocket the disc drops into (pins through the rim holes keep the rim from creeping in), the
     cavity = the outline pressed down by u, and three keyed guide posts;
   - the plunger: its press surface is the cavity surface offset by the gap g = t + clearance along the surface
     normal (a ball dilation computed per vertex), a boss that reaches the lattice, sockets for the pins,
     through-holes for the guide posts, a flange that bottoms out on the block top (the depth stop) and a scalloped
     grip edge.
   Every solid is a "terrace" heightfield: one constrained Delaunay triangulation of non-crossing feature loops
   (plus Steiner points where the surface curves), a top height per cell, vertical walls along the loops where the
   height steps, and a flat bottom. No 3D booleans, so the parts are closed by construction. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const CL = G.ClipperLib || (typeof require === 'function' ? require('clipper-lib') : null);
  const dflt = m => (m && typeof m !== 'function' && m.default) || m;
  const Delaunator = dflt(G.Delaunator || (typeof require === 'function' ? require('delaunator') : null));
  const Constrainautor = dflt(G.Constrainautor || (typeof require === 'function' ? require('@kninnug/constrainautor') : null));
  const bubble = () => G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);
  const SC = 1000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- options
  const SHAPES = {
    ball: { label: 'Ball', kind: 'revolve', aspect: 1, note: 'A round bauble. Two halves make a ball.' },
    egg: { label: 'Egg', kind: 'revolve', aspect: 0.76, note: 'Taller than wide, a little narrower at the top.' },
    finial: { label: 'Onion finial', kind: 'revolve', aspect: 0.6, note: 'A round bulb that tapers to a point at the top, like a teardrop.' },
    bell: { label: 'Bell', kind: 'revolve', aspect: 0.9, note: 'A flared bell with a rounded crown.' },
    star: { label: 'Star', kind: 'pillow', note: 'A puffy five-point star, pressed shallow.' },
    heart: { label: 'Heart', kind: 'pillow', note: 'A puffy heart, pressed shallow.' },
    tree: { label: 'Christmas tree', kind: 'pillow', radial: false, close: 6, note: 'A three-tier tree with a trunk, pressed shallow so the tips don\'t over-stretch.' },
    cane: { label: 'Candy cane', kind: 'pillow', radial: false, close: 7, asym: true, flatBack: true, aspect: 0.6,
      note: 'A puffy hooked cane. The front is pressed like a half tube; the back is a flat mesh that clicks onto it, so the hook stays the right way round. Try red and white stripes.' },
    duck: { label: 'Duck', kind: 'pillow', radial: false, close: 5, asym: true, flatBack: true, hangTop: true, face: 'duck',
      note: 'A puffy bath-toy duck seen from the side. The front is pressed; the back is a flat mesh that clicks onto it, so the beak stays the right way round. Try the duck face design in yellow and black.' },
    pig: { label: 'Pig', kind: 'pillow', radial: false, close: 6, face: 'pig',
      note: 'A round pig face with two pointy ears, puffed like a bauble. It is mirror-symmetric, so both halves come from the same press. Try the pig face design in pink and black.' }
  };
  const SIZES = { mini: 60, medium: 80, large: 100 };
  const PATTERNS = {
    hex: { label: 'Honeycomb', note: 'Spreads the stretch three ways. The best all-rounder for domes.' },
    diamond: { label: 'Diamond', note: 'A classic diamond lattice.' },
    round: { label: 'Round holes', note: 'Round holes packed tight, like lace.' },
    square: { label: 'Square grid', note: 'A plain grid. It stretches most along the diagonals.' },
    triangle: { label: 'Triangles', note: 'A stiff triangle lattice with fine detail.' }
  };
  const MOTIFS = {
    snowflake: 'Snowflake', star: 'Star', tree: 'Tree', heart: 'Heart', cane: 'Candy cane', bell: 'Bell', gift: 'Gift',
    snowman: 'Snowman', duck: 'Duck face', pig: 'Pig face', merry: 'Merry Christmas', joy: 'Joy', noel: 'Noel', stripes: 'Candy stripes', text: 'Your text', image: 'Your image', none: 'Plain lattice'
  };
  const PALETTE = [
    { name: 'Red', hex: '#C8102E' }, { name: 'White', hex: '#F7F7F2' }, { name: 'Gold', hex: '#D4A72C' }, { name: 'Green', hex: '#1E7B46' },
    { name: 'Silver', hex: '#B9BDC2' }, { name: 'Ice blue', hex: '#8CC8E8' }, { name: 'Purple', hex: '#6B3FA0' }, { name: 'Black', hex: '#1E1E1E' },
    { name: 'Yellow', hex: '#F5C518' }, { name: 'Pink', hex: '#F2A0B5' }
  ];
  const DEFAULTS = {
    shape: 'ball', size: 80, depth: 0.7, pattern: 'hex', thickness: 1.2, line: 1.2, gap: 5, clearance: 0.3,
    design: 'snowflake', designSize: 0.7, designMode: 'inlay', raise: 0.6, predistort: true, text: 'Merry Christmas', name: '', font: 'round', image: null,
    back: 'same', join: 'pins', hanger: true, colors: { lattice: '#C8102E', design: '#F7F7F2', mold: '#2E8B57' }, bed: [256, 256], detail: 'hd', bambu: 'A1'
  };
  // fixed geometry (mm), shown in the UI and README
  const SPEC = {
    rimW: 7, rimT: 2.4, flange: 1.5, pocketClear: 0.3, pocketExtra: 0.1, pinD: 3.0, pinH: 2.0, holeD: 3.2, pocketPinD: 2.8, pocketPinUp: 1.2,
    socketD: 3.8, socketDepth: 2.6, postD: 8, postH: 7, postClear: 0.3, plungerT: 10, floor: 3, wall: 5, bossClear: 0.3, earR: 5.5, earHoleD: 3.6
  };
  const LIMITS = { free: { size: 100 } };
  const HOWTO = [
    ['Print', 'Print the mesh disc flat, twice (one for each half). The bed side becomes the smooth outside. Print the cavity block and the plunger once in PLA, with 2 walls and 10 to 15% infill.'],
    ['Load the press', 'Stand the cavity block opening up. Drop the disc into the pocket on top, bed side down, so the small pins go through the holes in its rim.'],
    ['Heat', 'Warm the middle of the mesh with a heat gun on low, kept moving 15 to 20 cm away (or a hair dryer on hot, 10 to 15 cm away), until it goes limp but not glossy. Keep the heat off the rim.'],
    ['Press', 'Flip the plunger over side to side, like turning a page, line its holes up with the three posts and push it straight down until it sits flat on the block. Hold it for about a minute, until the mesh is cold.'],
    ['Repeat and join', 'Lift the formed half out and make the second half the same way. Turn one half over and press the halves rim to rim so the pins go into the holes (a drop of glue makes it permanent). Thread a ribbon or hook through the ear.']
  ];
  const SAFETY = 'Heat guns get hot enough to burn skin and scorch plastic. Use the lowest setting, keep it moving, work on a heat-safe surface and let the nozzle cool before you put it down. Keep fingers off the mesh while it is warm, and supervise kids. PLA softens around 60 \u00b0C and has a narrow window (too hot and it sags or goes brittle); PETG softens around 80 \u00b0C and is more forgiving.';

  function options(o) {
    const r = { ...DEFAULTS, ...(o || {}) };
    r.colors = { ...DEFAULTS.colors, ...((o && o.colors) || {}) };
    if (!SHAPES[r.shape]) r.shape = 'ball';
    if (!PATTERNS[r.pattern]) r.pattern = 'hex';
    if (!MOTIFS[r.design]) r.design = 'snowflake';
    r.size = clamp(+r.size || 80, 40, 150); r.depth = clamp(+r.depth || 0.7, 0.3, 1);
    r.thickness = clamp(+r.thickness || 1.2, 0.6, 2); r.line = clamp(+r.line || 1.2, 0.8, 3); r.gap = clamp(+r.gap || 5, 2, 12);
    r.clearance = clamp(isFinite(+r.clearance) ? +r.clearance : 0.3, 0, 1); r.designSize = clamp(+r.designSize || 0.7, 0.3, 0.95); r.raise = clamp(+r.raise || 0.6, 0.4, 1.6);
    if (r.designMode !== 'raised') r.designMode = 'inlay';
    if (r.back !== 'plain') r.back = 'same';
    if (r.join !== 'flat') r.join = 'pins';
    r.hanger = r.hanger !== false;
    for (const k of ['lattice', 'design', 'mold']) { if (!/^#[0-9a-f]{6}$/i.test(r.colors[k] || '')) r.colors[k] = DEFAULTS.colors[k]; r.colors[k] = r.colors[k].toUpperCase(); }
    r.bed = [clamp(+(r.bed && r.bed[0]) || 256, 100, 1000), clamp(+(r.bed && r.bed[1]) || 256, 100, 1000)];
    return r;
  }

  // ---------------------------------------------------------------- 2D: clipper helpers (polys: [{outer, holes}])
  const toC = L => L.map(p => ({ X: Math.round(p[0] * SC), Y: Math.round(p[1] * SC) }));
  const fromC = P => P.map(q => [q.X / SC, q.Y / SC]);
  const area = L => { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; };
  const ccw = L => area(L) > 0 ? L : L.slice().reverse();
  function treePolys(tree, minArea) {
    const out = [], ma = minArea || 0.05;
    const walk = nd => { for (const c of nd.Childs()) { if (c.IsHole()) continue; const outer = fromC(c.Contour()); if (Math.abs(area(outer)) < ma) { for (const h of c.Childs()) walk(h); continue; }
      const holes = []; for (const h of c.Childs()) { const hl = fromC(h.Contour()); if (Math.abs(area(hl)) >= ma) holes.push(hl); walk(h); }
      out.push({ outer: ccw(outer), holes: holes.map(h => ccw(h).reverse()) }); } };
    walk(tree); return out;
  }
  const tidyC = P => { const c = CL.Clipper.CleanPolygon(P, 3); return c.length >= 3 ? c : P; };
  const pathsOf = ps => { const o = []; for (const P of ps) { o.push(tidyC(toC(P.outer))); for (const h of P.holes) o.push(tidyC(toC(h))); } return o; };
  const isLoopList = a => a.length && Array.isArray(a[0]) && Array.isArray(a[0][0]);
  function offset(ps, d, arc) {
    const co = new CL.ClipperOffset(2, (arc || 0.01) * SC), tr = new CL.PolyTree();
    co.AddPaths(pathsOf(ps), CL.JoinType.jtRound, CL.EndType.etClosedPolygon); co.Execute(tr, d * SC); return treePolys(tr);
  }
  function bool(type, a, b, fa) {
    const c = new CL.Clipper(), tr = new CL.PolyTree();
    c.AddPaths(isLoopList(a) ? a.map(toC) : pathsOf(a), CL.PolyType.ptSubject, true);
    if (b && b.length) c.AddPaths(pathsOf(b), CL.PolyType.ptClip, true);
    const ft = fa === 'eo' ? CL.PolyFillType.pftEvenOdd : CL.PolyFillType.pftNonZero;
    c.Execute(type, tr, ft, CL.PolyFillType.pftNonZero); return treePolys(tr);
  }
  const unionLoops = (loops, fill) => bool(CL.ClipType.ctUnion, loops.map(L => fill === 'eo' ? L : ccw(L)), null, fill || 'nz');
  const union = ps => bool(CL.ClipType.ctUnion, ps, null);
  const diff = (a, b) => b && b.length ? bool(CL.ClipType.ctDifference, a, b) : union(a);
  const inter = (a, b) => bool(CL.ClipType.ctIntersection, a, b);
  const polysArea = ps => ps.reduce((s, P) => s + area(P.outer) + P.holes.reduce((t, h) => t + area(h), 0), 0);
  const loopsOf = ps => { const o = []; for (const P of ps) { o.push(P.outer); for (const h of P.holes) o.push(h); } return o; };
  const mapPolys = (ps, f) => ps.map(P => ({ outer: P.outer.map(f), holes: P.holes.map(h => h.map(f)) }));
  const poly = L => [{ outer: ccw(L), holes: [] }];
  function bboxL(loops) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const L of loops) for (const p of L) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return { x0, y0, x1, y1 }; }
  const pip = (q, L) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  function circle(cx, cy, r, s) { const n = Math.max(12, Math.ceil(2 * Math.PI * r / (s || 0.4))), L = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; L.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return L; }
  function ellipse(cx, cy, rx, ry, s) { const n = Math.max(24, Math.ceil(Math.PI * (rx + ry) / (s || 0.4))), L = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; L.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } return L; }
  function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  function capsule(a, b, hw) {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = [], n = 10;
    for (let i = 0; i <= n; i++) { const t = ang + Math.PI / 2 + i / n * Math.PI; L.push([a[0] + hw * Math.cos(t), a[1] + hw * Math.sin(t)]); }
    for (let i = 0; i <= n; i++) { const t = ang - Math.PI / 2 + i / n * Math.PI; L.push([b[0] + hw * Math.cos(t), b[1] + hw * Math.sin(t)]); }
    return L;
  }
  // split long edges so no segment is longer than s (keeps every corner)
  function densify(L, s) {
    const out = [];
    for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / s));
      for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    return out;
  }
  // even resample of a closed loop (spacing about s)
  function resample(L, s) {
    const n = L.length, seg = new Float64Array(n); let per = 0;
    for (let i = 0; i < n; i++) { const a = L[i], b = L[(i + 1) % n]; seg[i] = Math.hypot(b[0] - a[0], b[1] - a[1]); per += seg[i]; }
    const m = Math.max(8, Math.round(per / s)), step = per / m, out = []; let i = 0, acc = 0;
    for (let k = 0; k < m; k++) { const t = k * step; while (i < n - 1 && acc + seg[i] < t) { acc += seg[i]; i++; }
      const a = L[i], b = L[(i + 1) % n], u = seg[i] > 0 ? (t - acc) / seg[i] : 0; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
    return out;
  }
  function perimeter(L) { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += Math.hypot(L[i][0] - L[j][0], L[i][1] - L[j][1]); return s; }
  const mainOuter = ps => ps.reduce((b, P) => !b || area(P.outer) > area(b.outer) ? P : b, null);
  function hull(pts) {
    const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  // first hit of the ray c + t\u00b7(cos a, sin a) with a closed loop (t > 0)
  function rayHit(L, c, a) {
    const dx = Math.cos(a), dy = Math.sin(a); let best = Infinity;
    for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
      const p = L[j], q = L[i], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
      const wx = p[0] - c[0], wy = p[1] - c[1], t = (wx * ey - wy * ex) / den, s = (wx * dy - wy * dx) / den;
      if (t > 1e-9 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
    }
    return best;
  }

  // ---------------------------------------------------------------- the ornament shape: outline and depth u(x, y)
  function catmull(ts, rs, t) {
    let i = 0; while (i < ts.length - 2 && t > ts[i + 1]) i++;
    const t0 = ts[i], t1 = ts[i + 1], u = clamp((t - t0) / (t1 - t0), 0, 1);
    const p0 = rs[Math.max(0, i - 1)], p1 = rs[i], p2 = rs[i + 1], p3 = rs[Math.min(rs.length - 1, i + 2)];
    const m1 = (p2 - p0) / 2, m2 = (p3 - p1) / 2, u2 = u * u, u3 = u2 * u;
    return Math.max(0, (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2);
  }
  const BELL_T = [0, 0.012, 0.04, 0.09, 0.2, 0.35, 0.5, 0.65, 0.78, 0.88, 0.95, 0.985, 1];
  const BELL_R = [0, 0.8, 0.97, 1, 0.84, 0.7, 0.63, 0.59, 0.54, 0.45, 0.32, 0.17, 0];
  // half-width profile r(t), t = 0 at the bottom, 1 at the top
  const PROFILES = {
    ball: t => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)),
    egg: t => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) * (1 - 0.17 * (2 * t - 1)),
    finial: t => Math.sqrt(Math.max(0, t)) * Math.pow(Math.max(0, 1 - t), 1.55),
    bell: t => catmull(BELL_T, BELL_R, t)
  };
  function revolveShape(id, S, k) {
    const sh = SHAPES[id], H = S, W = S * sh.aspect, prof = PROFILES[id];
    let pk = 0, tPk = 0.5; for (let i = 0; i <= 2000; i++) { const v = prof(i / 2000); if (v > pk) { pk = v; tPk = i / 2000; } }
    const R = t => W / 2 * prof(clamp(t, 0, 1)) / pk, y0 = -H / 2;
    const Rofy = y => (y <= y0 || y >= y0 + H) ? 0 : R((y - y0) / H);
    const right = [], N = 1600;
    for (let i = 0; i <= N; i++) { const t = (1 - Math.cos(Math.PI * i / N)) / 2; right.push([R(t), y0 + t * H]); }
    const loop = right.concat(right.slice(1, -1).reverse().map(p => [-p[0], p[1]]));
    const outline = ccw(resample(mainOuter(union(poly(loop))).outer, 0.25));
    const u = (x, y) => { const r = Rofy(y), v = r * r - x * x; return v > 0 ? k * Math.sqrt(v) : 0; };
    const cy = id === 'bell' ? y0 + 0.3 * H : y0 + tPk * H;
    return { id, kind: 'revolve', outline, u, uMax: k * W / 2, c: [0, cy], W, H, k, Rref: W / 2 };
  }
  // raw outlines (about 100 units across, front view, y up) for the duck and the pig, and their face designs
  function animalRaw(id) {
    if (id === 'duck') { // a bath-toy duck facing right: round body with a perky tail, a head and a short rounded beak
      const body = poly(ellipse(-4, -16, 40, 25))[0], head = poly(circle(17, 17, 18, 0.4))[0], beak = poly(ellipse(39, 12, 13, 6.5))[0];
      const tail = poly([[-30, -20], [-50, 8], [-44, 12], [-18, 0]])[0], chest = poly(ellipse(16, -6, 18, 16))[0];
      let P = union([body, head, beak, tail, chest]); P = offset(offset(P, -3), 3); return offset(offset(P, 2.5), -2.5);
    }
    // pig: a wide round face and two pointy ears that tip outward
    const head = poly(ellipse(0, -2, 44, 40))[0], ear = sg => poly([[sg * 16, 30], [sg * 42, 22], [sg * 44, 54]].map(p => p))[0];
    let P = union([head, ear(-1), ear(1)]); P = offset(offset(P, -3.5), 3.5); return offset(offset(P, 2.5), -2.5);
  }
  function animalFace(id) {
    if (id === 'duck') { // eye, a wing curve on the body, the line of the beak
      const qb = (p0, p1, p2, n) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([(1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * p1[1] + t * t * p2[1]]); } return o; };
      const wing = qb([8, -10], [-12, -6], [-30, -4], 12).concat(qb([-30, -4], [-20, -30], [2, -26], 14).slice(1), qb([2, -26], [12, -20], [8, -10], 8).slice(1)), segs = [];
      for (let i = 0; i + 1 < wing.length; i++) segs.push([wing[i], wing[i + 1]]);
      for (const [a0, a1] of [[[-6, -14], [-20, -10]], [[-4, -19], [-16, -18]]]) segs.push([a0, a1]); // two feather lines
      return union(strokes(segs, 1.6).concat(poly(circle(23, 22, 3.6, 0.3)), strokes([[[33, 12.5], [47, 12.5]]], 1.3)));
    }
    const snout = { outer: ccw(ellipse(0, -12, 16, 11)), holes: [ccw(ellipse(0, -12, 12.6, 7.6)).reverse()] };
    const nost = [ellipse(-5.5, -12, 2.8, 4.6), ellipse(5.5, -12, 2.8, 4.6)].map(L => poly(L)[0]);
    const eyes = [circle(-17, 11, 4.4, 0.3), circle(17, 11, 4.4, 0.3)].map(L => poly(L)[0]);
    const inner = sg => { const tri = [[sg * 24, 32], [sg * 38, 27], [sg * 39, 46]]; return strokes([[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]], 1.4); };
    return union([snout, ...nost, ...eyes, ...inner(-1), ...inner(1)]);
  }
  // where the face design's name line goes (raw units): under the wing for the duck, the chin for the pig
  const FACE_NAME = { duck: [-4, -33, 46, 8], pig: [0, -30, 40, 8] };
  function rawFrame(P, S) { const O = mainOuter(P).outer, b = bboxL([O]), s = S / Math.max(b.x1 - b.x0, b.y1 - b.y0); return { O, s, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 }; }
  function pillowOutline(id, S) {
    let P;
    if (id === 'star') { const L = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.5 : 1; L.push([r * Math.cos(a) * 50, r * Math.sin(a) * 50]); } P = offset(offset(poly(L), -4.5), 4.5); P = offset(offset(P, 2), -2); }
    else if (id === 'tree') { // three overlapping tiers and a trunk (height 100, symmetric about x = 0)
      const tier = (yb, wb, yt, wt) => poly([[-wb, yb], [wb, yb], [wt, yt], [-wt, yt]]);
      P = union([...tier(-36, 40, -4, 13), ...tier(-14, 31, 18, 9), ...tier(8, 22, 50, 0.01), ...poly(rect(-7.5, -50, 7.5, -30))]);
      P = offset(offset(P, -2.5), 2.5); P = offset(offset(P, 1.5), -1.5); }
    else if (id === 'cane') { // a hooked cane: tube width w along a shaft and a half-circle hook (hook to the left)
      const w = 20, R = 22, yh = 26, y0 = -50 + w / 2, parts = [poly(rect(R - w / 2, y0, R + w / 2, yh))[0], poly(circle(R, y0, w / 2, 0.4))[0], poly(rect(-R - w / 2, yh - 10, -R + w / 2, yh))[0], poly(circle(-R, yh - 10, w / 2, 0.4))[0]];
      const ring = []; for (let i = 0; i <= 90; i++) { const a = i / 90 * Math.PI; ring.push([(R + w / 2) * Math.cos(a), yh + (R + w / 2) * Math.sin(a)]); } for (let i = 90; i >= 0; i--) { const a = i / 90 * Math.PI; ring.push([(R - w / 2) * Math.cos(a), yh + (R - w / 2) * Math.sin(a)]); }
      parts.push(poly(ring)[0]); P = union(parts); P = offset(offset(P, 1.5), -1.5); }
    else if (id === 'duck' || id === 'pig') P = animalRaw(id);
    else { const L = []; for (let i = 0; i < 720; i++) { const t = i / 720 * Math.PI * 2; L.push([16 * Math.sin(t) ** 3 * 3, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 3]); } P = offset(offset(poly(L), -5), 5); P = offset(offset(P, 3), -3); }
    const { O, s, cx, cy } = rawFrame(P, S);
    return ccw(resample(O.map(p => [(p[0] - cx) * s, (p[1] - cy) * s]), 0.25));
  }
  // exact distance to the outline on a grid (bucketed segments), then u = k\u00b7dm\u00b7sin(\u03c0/2\u00b7d/dm)
  function pillowShape(id, S, k, h) {
    const outline = pillowOutline(id, S), b = bboxL([outline]), m = 3, n = outline.length;
    const x0 = b.x0 - m, y0 = b.y0 - m, nx = Math.ceil((b.x1 - b.x0 + 2 * m) / h) + 1, ny = Math.ceil((b.y1 - b.y0 + 2 * m) / h) + 1;
    const B = 2, bx = Math.ceil((nx * h) / B) + 1, by = Math.ceil((ny * h) / B) + 1, buckets = Array.from({ length: bx * by }, () => []);
    for (let i = 0; i < n; i++) { const p = outline[i], q = outline[(i + 1) % n], i0 = Math.floor((Math.min(p[0], q[0]) - x0) / B), i1 = Math.floor((Math.max(p[0], q[0]) - x0) / B), j0 = Math.floor((Math.min(p[1], q[1]) - y0) / B), j1 = Math.floor((Math.max(p[1], q[1]) - y0) / B);
      for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) buckets[j * bx + ii].push(i); }
    const segD = (px, py, i) => { const a = outline[i], c = outline[(i + 1) % n], dx = c[0] - a[0], dy = c[1] - a[1], l2 = dx * dx + dy * dy, t = l2 > 0 ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l2, 0, 1) : 0; return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); };
    const D = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      const y = y0 + j * h, xs = []; for (let i = 0; i < n; i++) { const a = outline[i], c = outline[(i + 1) % n]; if ((a[1] > y) !== (c[1] > y)) xs.push(a[0] + (y - a[1]) * (c[0] - a[0]) / (c[1] - a[1])); } xs.sort((u, v) => u - v);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const ia = Math.max(0, Math.ceil((xs[q] - x0) / h)), ib = Math.min(nx - 1, Math.floor((xs[q + 1] - x0) / h));
        for (let i = ia; i <= ib; i++) { const x = x0 + i * h, ci = Math.floor((x - x0) / B), cj = Math.floor((y - y0) / B); let best = Infinity;
          for (let r = 0; r < Math.max(bx, by); r++) { if (best <= (r - 1) * B) break;
            for (let jj = cj - r; jj <= cj + r; jj++) for (let ii = ci - r; ii <= ci + r; ii++) { if (Math.max(Math.abs(jj - cj), Math.abs(ii - ci)) !== r || jj < 0 || ii < 0 || jj >= by || ii >= bx) continue; for (const s of buckets[jj * bx + ii]) { const d = segD(x, y, s); if (d < best) best = d; } } }
          D[j * nx + i] = best; }
      }
    }
    let dm = 0, ci = 0; for (let i = 0; i < D.length; i++) if (D[i] > dm) { dm = D[i]; ci = i; }
    const U = new Float32Array(nx * ny); for (let i = 0; i < D.length; i++) U[i] = D[i] > 0 ? k * dm * Math.sin(Math.PI / 2 * Math.min(1, D[i] / dm)) : 0;
    const u = (x, y) => { const fx = (x - x0) / h, fy = (y - y0) / h; if (fx < 0 || fy < 0 || fx >= nx - 1 || fy >= ny - 1) return 0; const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, a = j * nx + i;
      return (U[a] * (1 - tx) + U[a + 1] * tx) * (1 - ty) + (U[a + nx] * (1 - tx) + U[a + nx + 1] * tx) * ty; };
    const S0 = SHAPES[id], cx = S0.asym ? x0 + (ci % nx) * h : 0;
    return { id, kind: 'pillow', outline, u, uMax: k * dm, c: [cx, y0 + Math.floor(ci / nx) * h], W: b.x1 - b.x0, H: b.y1 - b.y0, k, dm, Rref: dm, radial: S0.radial !== false, grid: { x0, y0, nx, ny, h },
      frame: S0.face ? (() => { const f = rawFrame(animalRaw(id), S); return { s: f.s, cx: f.cx, cy: f.cy, face: S0.face }; })() : null };
  }
  // the same shape seen from the other side (the print frame of an asymmetric shape: the bed face is the outside)
  function mirrorShape(s) { return { ...s, outline: ccw(s.outline.map(p => [-p[0], p[1]])), u: (x, y) => s.u(-x, y), c: [-s.c[0], s.c[1]] }; }
  // formed surface area over flat area on a grid over the outline (any outline, not just star-shaped ones)
  function gridStretch(shape, h) {
    const b = bboxL([shape.outline]); let A3 = 0, n = 0;
    for (let y = b.y0 + h / 2; y < b.y1; y += h) for (let x = b.x0 + h / 2; x < b.x1; x += h) { if (!pip([x, y], shape.outline)) continue; const e = h / 2, ux = (shape.u(x + e, y) - shape.u(x - e, y)) / h, uy = (shape.u(x, y + e) - shape.u(x, y - e)) / h; A3 += Math.hypot(ux, uy, 1); n++; }
    return n ? A3 / n : 1;
  }
  function makeShape(o) { return SHAPES[o.shape].kind === 'revolve' ? revolveShape(o.shape, o.size, o.depth) : pillowShape(o.shape, o.size, o.depth, o.detail === 'draft' ? 0.5 : 0.25); }

  // ---------------------------------------------------------------- flat \u2194 formed: arc-length model along rays from c
  // A point at fraction \u03c1 of the way from c to the outline on the flat disc ends up at the same fraction of the arc
  // length of the formed surface along that ray (the clamped rim keeps the outline fixed and the mesh stretches
  // evenly along each meridian). Pre-distortion is the inverse: a design point meant to be seen (from the front) at
  // fraction s of the ray is printed at \u03c1 = A(s)/A(1).
  function arcTables(shape, NA, NS) {
    NA = NA || 720; NS = NS || 240; const c = shape.c, Bd = new Float64Array(NA), A = new Float64Array(NA * (NS + 1));
    for (let i = 0; i < NA; i++) {
      const a = i / NA * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a), B = rayHit(shape.outline, c, a); Bd[i] = B;
      let acc = 0, pz = shape.u(c[0], c[1]), px = 0; A[i * (NS + 1)] = 0;
      for (let k = 1; k <= NS; k++) { const r = k / NS * B, z = shape.u(c[0] + dx * r, c[1] + dy * r); acc += Math.hypot(r - px, z - pz); px = r; pz = z; A[i * (NS + 1) + k] = acc; }
      for (let k = 1; k <= NS; k++) A[i * (NS + 1) + k] /= acc || 1;
    }
    const at = (x, y) => { const dx = x - c[0], dy = y - c[1], r = Math.hypot(dx, dy); let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI * 2; const f = a / (Math.PI * 2) * NA, i0 = Math.floor(f) % NA, i1 = (i0 + 1) % NA, w = f - Math.floor(f); return { r, dx, dy, i0, i1, w }; };
    const sToRho = (i, s) => { if (s >= 1) return 1; const f = s * NS, k = Math.floor(f), w = f - k; return A[i * (NS + 1) + k] * (1 - w) + A[i * (NS + 1) + k + 1] * w; };
    const rhoToS = (i, rho) => { if (rho >= 1) return 1; let lo = 0, hi = NS; const base = i * (NS + 1); while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[base + m] < rho) lo = m; else hi = m; } const a0 = A[base + lo], a1 = A[base + hi]; return (lo + (a1 > a0 ? (rho - a0) / (a1 - a0) : 0)) / NS; };
    // projected (front view) point -> flat print point
    function toFlat(x, y) { const q = at(x, y); if (q.r < 1e-9) return [x, y]; const B = Bd[q.i0] * (1 - q.w) + Bd[q.i1] * q.w, s = q.r / B; if (s >= 1) return [x, y];
      const rho = sToRho(q.i0, s) * (1 - q.w) + sToRho(q.i1, s) * q.w, k = rho * B / q.r; return [c[0] + q.dx * k, c[1] + q.dy * k]; }
    // flat print point -> projected point on the formed half
    function toFormed(x, y) { const q = at(x, y); if (q.r < 1e-9) return [x, y]; const B = Bd[q.i0] * (1 - q.w) + Bd[q.i1] * q.w, rho = q.r / B; if (rho >= 1) return [x, y];
      const s = rhoToS(q.i0, rho) * (1 - q.w) + rhoToS(q.i1, rho) * q.w, k = s * B / q.r; return [c[0] + q.dx * k, c[1] + q.dy * k]; }
    return { toFlat, toFormed, B: Bd };
  }
  // formed surface area over flat area of the outline (polar sampling): the mesh thins by about this factor
  function stretch(shape, NA, NS) {
    NA = NA || 360; NS = NS || 160; const c = shape.c, P = [];
    for (let i = 0; i < NA; i++) { const a = i / NA * Math.PI * 2, B = rayHit(shape.outline, c, a), row = []; for (let k = 0; k <= NS; k++) { const r = (k / NS) * B, x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r; row.push([x, y, shape.u(x, y)]); } P.push(row); }
    const triA = (a, b, d) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2]; return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2; };
    const f = p => [p[0], p[1], 0]; let A3 = 0, A2 = 0;
    for (let i = 0; i < NA; i++) { const R0 = P[i], R1 = P[(i + 1) % NA]; for (let k = 0; k < NS; k++) { A3 += triA(R0[k], R0[k + 1], R1[k + 1]) + triA(R0[k], R1[k + 1], R1[k]); A2 += triA(f(R0[k]), f(R0[k + 1]), f(R1[k + 1])) + triA(f(R0[k]), f(R1[k + 1]), f(R1[k])); } }
    return A3 / A2;
  }

  // ---------------------------------------------------------------- lattice patterns (hole loops over a box)
  function patternHoles(id, line, gap, b) {
    const out = [], p = gap + line;
    if (id === 'hex' || id === 'round') {
      const dy = p * Math.sqrt(3) / 2, rh = gap / Math.sqrt(3);
      for (let j = Math.floor(b.y0 / dy) - 1, jm = Math.ceil(b.y1 / dy) + 1; j <= jm; j++) for (let i = Math.floor(b.x0 / p) - 1, im = Math.ceil(b.x1 / p) + 1; i <= im; i++) {
        const cx = i * p + (j & 1 ? p / 2 : 0), cy = j * dy;
        if (id === 'round') out.push(circle(cx, cy, gap / 2, 0.45));
        else { const L = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 2 + k * Math.PI / 3; L.push([cx + rh * Math.cos(a), cy + rh * Math.sin(a)]); } out.push(L); }
      }
    } else if (id === 'diamond' || id === 'square') {
      const rot = id === 'diamond' ? Math.PI / 4 : 0, cr = Math.cos(rot), sr = Math.sin(rot), R = Math.max(Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.y0), Math.abs(b.y1)) * 1.5, n = Math.ceil(R / p) + 1, h = gap / 2;
      for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const u = i * p, v = j * p, cx = u * cr - v * sr, cy = u * sr + v * cr; if (cx < b.x0 - p || cx > b.x1 + p || cy < b.y0 - p || cy > b.y1 + p) continue;
        out.push([[-h, -h], [h, -h], [h, h], [-h, h]].map(q => [cx + q[0] * cr - q[1] * sr, cy + q[0] * sr + q[1] * cr])); }
    } else { // triangles: an equilateral grid of side a, each cell inset by half a strut
      const a = gap + line * Math.sqrt(3), hgt = a * Math.sqrt(3) / 2, rin = a / (2 * Math.sqrt(3)), rc = 2 * (rin - line / 2);
      for (let j = Math.floor(b.y0 / hgt) - 1, jm = Math.ceil(b.y1 / hgt) + 1; j <= jm; j++) for (let i = Math.floor(b.x0 / a) - 2, im = Math.ceil(b.x1 / a) + 2; i <= im; i++) for (const up of [true, false]) {
        const x = i * a + (j & 1 ? a / 2 : 0) + (up ? 0 : a / 2), y = j * hgt + (up ? rin : hgt - rin), L = [];
        for (let k = 0; k < 3; k++) { const ang = (up ? Math.PI / 2 : -Math.PI / 2) + k * 2 * Math.PI / 3; L.push([x + rc * Math.cos(ang), y + rc * Math.sin(ang)]); } out.push(L); }
    }
    return out;
  }

  // ---------------------------------------------------------------- designs (front view, about 100 units across)
  const strokes = (segs, hw) => unionLoops(segs.map(([a, b]) => capsule(a, b, hw)));
  function snowflake() {
    const segs = [], P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
    for (let k = 0; k < 6; k++) { const a = Math.PI / 2 + k * Math.PI / 3; segs.push([P(9, a), P(47, a)]);
      for (const [f, len] of [[22, 14], [34, 10]]) for (const sg of [-1, 1]) { const b = a + sg * 0.95, base = P(f, a); segs.push([base, [base[0] + len * Math.cos(b), base[1] + len * Math.sin(b)]]); }
      segs.push([P(9, a), P(9, a + Math.PI / 3)]); }
    return strokes(segs, 2.7);
  }
  function starPoly(R, ri) { const L = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * ri : R; L.push([r * Math.cos(a), r * Math.sin(a)]); } return L; }
  function heartLoop(s) { const L = []; for (let i = 0; i < 360; i++) { const t = i / 360 * Math.PI * 2; L.push([16 * Math.sin(t) ** 3 * s, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s]); } return L; }
  const ring = (cx, cy, R, r) => ({ outer: ccw(circle(cx, cy, R)), holes: [ccw(circle(cx, cy, r)).reverse()] });
  function motif(id) {
    if (id === 'snowflake') return snowflake();
    if (id === 'star') return offset(offset(poly(starPoly(48, 0.45)), -2), 2);
    if (id === 'heart') return offset(offset(poly(heartLoop(2.8)), -2), 2);
    if (id === 'tree') {
      const tiers = [[[0, 40], [-20, 14], [20, 14]], [[0, 26], [-29, -8], [29, -8]], [[0, 8], [-38, -30], [38, -30]]];
      const D = unionLoops(tiers.map(t => [t[1], t[2], t[0]]).concat([rect(-6, -46, 6, -29), starPoly(10, 0.45).map(p => [p[0], p[1] + 42])]));
      return offset(offset(D, -1.2), 1.2);
    }
    if (id === 'cane') {
      const pts = [[10, -46], [10, 16]]; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; pts.push([-8 + 18 * Math.cos(a), 16 + 18 * Math.sin(a)]); } pts.push([-26, 6]);
      const segs = []; for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1]]);
      const cane = strokes(segs, 6.5), bands = []; for (let k = -8; k <= 8; k++) { const y = k * 11; bands.push([[-60, y - 43.6], [60, y + 40.4], [60, y + 43.6], [-60, y - 40.4]]); }
      return diff(cane, unionLoops(bands));
    }
    if (id === 'bell') {
      const right = []; for (let i = 0; i <= 60; i++) { const t = i / 60; right.push([38 * catmull(BELL_T, BELL_R, t), -34 + t * 70]); }
      const L = right.concat(right.slice(1, -1).reverse().map(p => [-p[0], p[1]]));
      return union([{ outer: ccw(L), holes: [] }, { outer: ccw(circle(0, -38, 6.5)), holes: [] }, ring(0, 41, 7, 3.4)]);
    }
    if (id === 'gift') {
      const box = union([{ outer: ccw(rect(-34, -42, 34, 14)), holes: [] }, { outer: ccw(rect(-39, 16, 39, 28)), holes: [] }]);
      const cut = diff(box, poly(rect(-4, -50, 4, 30)));
      return union(cut.concat([ring(-10, 38, 10, 4.5), ring(10, 38, 10, 4.5)]));
    }
    if (id === 'snowman') {
      const body = union([poly(circle(0, -24, 24))[0], poly(circle(0, 12, 17))[0], poly(circle(0, 38, 12))[0]]);
      const dots = [circle(-4.5, 40, 2.2), circle(4.5, 40, 2.2), circle(0, 16, 2.4), circle(0, 7, 2.4), circle(0, -16, 2.6), circle(0, -27, 2.6)].map(L => poly(L)[0]);
      return diff(body, dots);
    }
    if (id === 'duck' || id === 'pig') { // a small outline of the animal with its face cut out (chips, and on other shapes)
      const R = animalRaw(id); return diff(diff(R, offset(R, -3.2)).concat(animalFace(id)), []);
    }
    return [];
  }
  function textDesign(lines, font) {
    const B = bubble(); if (!B) return [];
    const out = [], h = 30; let y = 0;
    for (const s of lines.filter(s => s && s.trim()).slice(0, 3)) {
      let x = 0; const row = [];
      for (const ch of [...s.trim()]) { if (/\s/.test(ch)) { x += h * 0.35; continue; } const g = B.supported(font, ch) ? B.glyphPolys(font, ch, h) : null; if (!g) continue; row.push(...mapPolys(g.polys, p => [p[0] + x, p[1]])); x += g.advance + h * 0.04; }
      const bb = bboxL(loopsOf(row)); if (!isFinite(bb.x0)) continue;
      out.push(...mapPolys(row, p => [p[0] - (bb.x0 + bb.x1) / 2, p[1] - y]));
      y += h * 1.22;
    }
    return out.length ? union(out) : [];
  }
  // diagonal candy-cane stripes over the whole outline (a circle when there is none, for the picker chip)
  function candyStripes(shape) {
    const O = shape.outline ? poly(shape.outline) : poly(circle(shape.c[0], shape.c[1], Math.min(shape.W, shape.H) * 0.45, 0.5)), b = bboxL(loopsOf(O));
    const sz = Math.max(b.x1 - b.x0, b.y1 - b.y0), w = Math.max(3.5, 0.07 * sz), per = w * 2.1, a = 38 * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, L = sz;
    const bands = []; for (let t = -L; t <= L; t += per) { const q = [[t, -L], [t + w, -L], [t + w, L], [t, L]].map(p => [cx + p[0] * ca - p[1] * sa, cy + p[0] * sa + p[1] * ca]); bands.push(poly(q)[0]); }
    return inter(union(bands), O);
  }
  // the design in the front view, scaled into designSize of the outline and centered on c
  function designPolys(o, shape) {
    let D = [];
    if (o.design === 'merry') D = textDesign(['Merry', 'Christmas'], o.font);
    else if (o.design === 'joy') D = textDesign(['Joy'], o.font);
    else if (o.design === 'noel') D = textDesign(['Noel'], o.font);
    else if (o.design === 'text') D = textDesign(String(o.text || '').split(/\n|\s*\/\s*/), o.font);
    else if (o.design === 'image') D = o.image && o.image.length ? unionLoops(o.image.map(L => L.map(p => [p[0] * 100, p[1] * 100])), 'eo') : [];
    else if (o.design === 'stripes') return candyStripes(shape);
    else if ((o.design === 'duck' || o.design === 'pig') && shape.frame && shape.frame.face === o.design) { // drawn on the animal itself, in its own frame
      const f = shape.frame, map = p => [(p[0] - f.cx) * f.s, (p[1] - f.cy) * f.s], Fc = mapPolys(animalFace(o.design), map);
      const name = String(o.name || '').trim(), N = name ? textDesign([name], o.font) : []; if (!N.length) return Fc;
      const nb = FACE_NAME[o.design], b = bboxL(loopsOf(N)), k = Math.min(nb[2] / (b.x1 - b.x0), nb[3] / (b.y1 - b.y0)) * f.s, c0 = map([nb[0], nb[1]]);
      return union(Fc.concat(mapPolys(N, p => [c0[0] + (p[0] - (b.x0 + b.x1) / 2) * k, c0[1] + (p[1] - (b.y0 + b.y1) / 2) * k])));
    }
    else if (o.design !== 'none') D = motif(o.design);
    const name = String(o.name || '').trim(), N = name ? textDesign([name], o.font) : [];
    if (!D.length && !N.length) return [];
    const bw = shape.W * o.designSize, bh = shape.H * o.designSize, c = shape.c;
    const fit = (P, w, h, cx, cy) => { const b = bboxL(loopsOf(P)); if (!isFinite(b.x0)) return []; const s = Math.min(w / (b.x1 - b.x0), h / (b.y1 - b.y0)); return mapPolys(P, p => [cx + (p[0] - (b.x0 + b.x1) / 2) * s, cy + (p[1] - (b.y0 + b.y1) / 2) * s]); };
    if (D.length && N.length) return union(fit(D, bw * 0.9, bh * 0.64, c[0], c[1] + bh * 0.17).concat(fit(N, bw * 0.92, bh * 0.24, c[0], c[1] - bh * 0.36)));
    if (N.length) return fit(N, bw, bh * 0.4, c[0], c[1]);
    return fit(D, bw, bh, c[0], c[1]);
  }

  // ---------------------------------------------------------------- terrace solid builder
  // loops: [{ L, tag, bottom }] closed, non-crossing, non-touching (already densified); rule(inTag) -> cell (>= 0) or
  // -1 (empty), from the parity of the loops of each tag around a point; height(cell, x, y) -> top z; steiner: extra
  // interior points; zb: the flat bottom. A wall drops along a loop wherever the top steps down to the cell beyond.
  function terrace(loops, rule, height, steiner, zb, minGap) {
    zb = zb || 0; minGap = minGap || 0.2;
    const LB = loops.map(l => ({ ...l, b: bboxL([l.L]) }));
    const classify = (x, y) => { const cnt = {}; for (const l of LB) { if (x < l.b.x0 || x > l.b.x1 || y < l.b.y0 || y > l.b.y1) continue; if (pip([x, y], l.L)) cnt[l.tag] = (cnt[l.tag] || 0) + 1; } return rule(t => (cnt[t] || 0) % 2 === 1); };
    const all = bboxL(loops.map(l => l.L));
    const cdt = (useLoops, extra) => {
      const xy = [], cons = [];
      for (const l of useLoops) { const i0 = xy.length / 2; for (const p of l.L) xy.push(p[0], p[1]); for (let i = 0; i < l.L.length; i++) cons.push([i0 + i, i0 + (i + 1) % l.L.length]); }
      if (extra && extra.length) { // drop Steiner points too close to a loop segment, and repeats
        const cs = Math.max(minGap * 4, 0.6), hx = new Map(), key = (i, j) => i * 100003 + j;
        for (const [a, b] of cons) { const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1];
          for (let i = Math.floor(Math.min(ax, bx) / cs) - 1; i <= Math.floor(Math.max(ax, bx) / cs) + 1; i++) for (let j = Math.floor(Math.min(ay, by) / cs) - 1; j <= Math.floor(Math.max(ay, by) / cs) + 1; j++) { const k = key(i, j); let v = hx.get(k); if (!v) hx.set(k, v = []); v.push(a, b); } }
        const seen = new Set();
        for (const p of extra) {
          if (p[0] < all.x0 || p[0] > all.x1 || p[1] < all.y0 || p[1] > all.y1) continue;
          const v = hx.get(key(Math.floor(p[0] / cs), Math.floor(p[1] / cs))); let ok = true;
          if (v) for (let q = 0; q < v.length && ok; q += 2) { const a = v[q], b = v[q + 1], ax = xy[2 * a], ay = xy[2 * a + 1], dx = xy[2 * b] - ax, dy = xy[2 * b + 1] - ay, l2 = dx * dx + dy * dy, t = l2 > 0 ? clamp(((p[0] - ax) * dx + (p[1] - ay) * dy) / l2, 0, 1) : 0; if (Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy) < minGap) ok = false; }
          if (!ok) continue;
          const sk = Math.round(p[0] * 2000) + ',' + Math.round(p[1] * 2000); if (seen.has(sk)) continue; seen.add(sk);
          xy.push(p[0], p[1]);
        }
      }
      const m = 10 + Math.max(all.x1 - all.x0, all.y1 - all.y0) * 0.2; xy.push(all.x0 - m, all.y0 - m, all.x1 + m, all.y0 - m * 1.07, all.x1 + m * 1.03, all.y1 + m, all.x0 - m * 1.05, all.y1 + m * 1.02);
      const XY = Float64Array.from(xy), del = new Delaunator(XY), con = new Constrainautor(del);
      if (G.ORN_DEBUG) { const seen = new Map(); for (let i = 0; i < xy.length / 2; i++) { const k = xy[2 * i] + ',' + xy[2 * i + 1]; if (seen.has(k)) console.log('dup point', k, 'loops', seen.get(k)); seen.set(k, i); } }
      const owner = []; useLoops.forEach((l, li) => { for (let i = 0; i < l.L.length; i++) owner.push(li); });
      for (const e of cons) { try { con.constrainOne(e[0], e[1]); } catch (err) { const l = useLoops[owner[e[0]]]; const m = new Error(`ornament mesh: loops touch near ${xy[2 * e[0]].toFixed(2)}, ${xy[2 * e[0] + 1].toFixed(2)} (${l && l.tag})`); m.at = [xy[2 * e[0]], xy[2 * e[0] + 1]]; m.tag = l && l.tag; if (G.ORN_DEBUG) m.cross = crossInfo(useLoops, owner[e[0]]); throw m; } }
      const Tr = del.triangles, Hh = del.halfedges, nt = Tr.length / 3, comp = new Int32Array(nt).fill(-1), cellOf = [];
      let nc = 0;
      for (let t0 = 0; t0 < nt; t0++) { if (comp[t0] >= 0) continue; const st = [t0]; comp[t0] = nc;
        while (st.length) { const t = st.pop(); for (let k = 0; k < 3; k++) { const e = 3 * t + k, op = Hh[e]; if (op < 0 || con.isConstrained(e)) continue; const u = (op / 3) | 0; if (comp[u] < 0) { comp[u] = nc; st.push(u); } } }
        const a = Tr[3 * t0], b = Tr[3 * t0 + 1], c = Tr[3 * t0 + 2];
        cellOf.push(classify((XY[2 * a] + XY[2 * b] + XY[2 * c]) / 3, (XY[2 * a + 1] + XY[2 * b + 1] + XY[2 * c + 1]) / 3)); nc++; }
      return { XY, Tr, Hh, nt, cell: t => cellOf[comp[t]] };
    };
    const out = [], push = (A, B, C) => out.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
    const top = cdt(loops, steiner), { XY, Tr, Hh, nt } = top, zc = new Map();
    const Z = (v, c) => { const k = v * 16 + c; let z = zc.get(k); if (z === undefined) { z = height(c, XY[2 * v], XY[2 * v + 1]); zc.set(k, z); } return z; };
    const P3 = (v, z) => [XY[2 * v], XY[2 * v + 1], z];
    for (let t = 0; t < nt; t++) {
      const c = top.cell(t); if (c < 0) continue;
      const a = Tr[3 * t], b = Tr[3 * t + 1], d = Tr[3 * t + 2];
      const isCCW = (XY[2 * b] - XY[2 * a]) * (XY[2 * d + 1] - XY[2 * a + 1]) - (XY[2 * b + 1] - XY[2 * a + 1]) * (XY[2 * d] - XY[2 * a]) > 0;
      const A = P3(a, Z(a, c)), B = P3(b, Z(b, c)), D = P3(d, Z(d, c));
      if (isCCW) push(A, B, D); else push(A, D, B);
      for (let k = 0; k < 3; k++) {
        const e = 3 * t + k, op = Hh[e], u = Tr[e], v = Tr[k === 2 ? 3 * t : e + 1];
        const oc = op < 0 ? -1 : top.cell((op / 3) | 0); if (oc === c) continue;
        const uh = Z(u, c), vh = Z(v, c), ul = oc < 0 ? zb : Z(u, oc), vl = oc < 0 ? zb : Z(v, oc);
        if (oc >= 0 && (uh < ul - 1e-9 || vh < vl - 1e-9)) continue; // the higher side builds the wall
        if (uh - ul < 1e-9 && vh - vl < 1e-9) continue;
        let U0 = P3(u, ul), U1 = P3(u, uh), V0 = P3(v, vl), V1 = P3(v, vh);
        if (isCCW) { [U0, V0] = [V0, U0]; [U1, V1] = [V1, U1]; } // outward is left of u->v for a clockwise triangle
        if (U1[2] - U0[2] > 1e-9) push(U0, U1, V1);
        if (V1[2] - V0[2] > 1e-9) push(U0, V1, V0);
      }
    }
    const bot = cdt(loops.filter(l => l.bottom), null);
    for (let t = 0; t < bot.nt; t++) { if (bot.cell(t) < 0) continue; const X = bot.XY, a = bot.Tr[3 * t], b = bot.Tr[3 * t + 1], d = bot.Tr[3 * t + 2];
      const cr = (X[2 * b] - X[2 * a]) * (X[2 * d + 1] - X[2 * a + 1]) - (X[2 * b + 1] - X[2 * a + 1]) * (X[2 * d] - X[2 * a]);
      const A = [X[2 * a], X[2 * a + 1], zb], B = [X[2 * b], X[2 * b + 1], zb], D = [X[2 * d], X[2 * d + 1], zb];
      if (cr > 0) push(A, D, B); else push(A, B, D); }
    return Float64Array.from(out);
  }
  function crossInfo(loops, li) { // debug: which loops cross loop li
    const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), A = loops[li].L, out = [];
    loops.forEach((l, k) => { const B = l.L; for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) { if (k === li && (Math.abs(i - j) < 2 || Math.abs(i - j) === A.length - 1)) continue; const a = A[i], b = A[(i + 1) % A.length], c = B[j], d = B[(j + 1) % B.length]; if (cr(a, b, c) * cr(a, b, d) < -1e-12 && cr(c, d, a) * cr(c, d, b) < -1e-12) out.push({ k, tag: l.tag, a, b, c, d }); } });
    return out.slice(0, 6);
  }
  // drop points closer than 30 \u00b5m to the last one and spikes (turns back of more than ~170\u00b0): Clipper's integer
  // rounding leaves micro zigzags that would cross themselves in the triangulation
  function cleanLoop(L) {
    let A = L.slice(), changed = true, guard = 0;
    while (changed && A.length > 3 && guard++ < 20) { changed = false; const out = [];
      for (let i = 0; i < A.length; i++) { const a = out.length ? out[out.length - 1] : A[A.length - 1], b = A[i], c = A[(i + 1) % A.length];
        const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1], lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
        if (lu < 0.03 || (lv > 1e-9 && (ux * vx + uy * vy) / (lu * lv) < -0.985)) { changed = true; continue; }
        out.push(b); }
      A = out; }
    return A.length >= 3 ? A : L;
  }
  const L_ = (L, tag, bottom, s) => ({ L: densify(ccw(cleanLoop(L)), s), tag, bottom: !!bottom });
  function hexGrid(polys, s) { // Steiner points on a triangular grid inside polys
    const pts = [], b = bboxL(loopsOf(polys)), dy = s * Math.sqrt(3) / 2;
    for (let j = Math.floor(b.y0 / dy), jm = Math.ceil(b.y1 / dy); j <= jm; j++) { const y = j * dy, xo = j & 1 ? s / 2 : 0; for (let i = Math.floor(b.x0 / s) - 1, im = Math.ceil(b.x1 / s) + 1; i <= im; i++) { const x = i * s + xo; if (polys.some(P => pip([x, y], P.outer) && !P.holes.some(h => pip([x, y], h)))) pts.push([x, y]); } }
    return pts;
  }
  function ringPts(outline, dists, s) { const pts = []; for (const d of dists) { const P = Math.abs(d) < 1e-9 ? poly(outline) : offset(poly(outline), -d, 0.005); for (const L of loopsOf(P)) for (const p of resample(L, s)) pts.push(p); } return pts; }
  // distances in from the outline where a revolved surface is steep (u ~ \u221a\u03b4 near the edge): even height steps
  function steepRings(shape, s) {
    if (shape.kind !== 'revolve') return [0, 0.15, 0.4];
    const a = 0.7 * s / (shape.k * Math.sqrt(2 * shape.Rref)), out = [], lim = Math.min(shape.Rref * 0.6, shape.k * shape.k * shape.Rref / 2 + 1);
    for (let k = 0; ; k++) { const d = (a * k) ** 2; if (d > lim) break; out.push(d); }
    return out;
  }

  // ---------------------------------------------------------------- parts
  function rimCenterAt(rimMid, c, ang) { const t = rayHit(rimMid, c, ang); return [c[0] + Math.cos(ang) * t, c[1] + Math.sin(ang) * t]; }
  function layout(o, shape) {
    const sp = SPEC, t = o.thickness, g = t + o.clearance, es = o.detail === 'draft' ? 0.9 : 0.4, Om = poly(shape.outline);
    const inner = mainOuter(offset(Om, sp.flange)).outer, rimMid = mainOuter(offset(Om, sp.flange + sp.rimW / 2)).outer;
    const cl = (SHAPES[shape.id] || {}).close || 0; // fill narrow notches (between tree tiers, inside the cane hook) with rim
    let outerP = cl ? offset(offset(offset(Om, sp.flange + sp.rimW + cl), -cl), 0) : offset(Om, sp.flange + sp.rimW), ear = null;
    if (o.hanger) {
      const ex = (SHAPES[shape.id] || {}).hangTop ? shape.outline.reduce((b, p) => p[1] > b[1] ? p : b)[0] : shape.c[0], yTop = rayHit(mainOuter(outerP).outer, [ex, shape.c[1]], Math.PI / 2) + shape.c[1];
      ear = [ex, yTop + 2.6];
      outerP = offset(offset(union(outerP.concat([poly(circle(ear[0], ear[1], sp.earR, 0.3))[0], poly(rect(ex - 4.6, yTop - 4, ex + 4.6, ear[1]))[0]])), 1.6), -1.6);
    }
    const outer = mainOuter(outerP).outer, pins = [], holes = [];
    if (o.join === 'pins' && (SHAPES[shape.id] || {}).flatBack) { // evenly round the rim (the flat back is a mirror, so any spacing meets)
      const R = resample(rimMid, 0.5), n = R.length, i0 = R.reduce((b, p, i) => p[1] < R[b][1] ? i : b, 0);
      for (let k = 0; k < 6; k++) (k % 2 ? holes : pins).push(R[(i0 + Math.round(k * n / 6)) % n]);
    } else if (o.join === 'pins') for (const deg of [0, 120, 240]) { pins.push(rimCenterAt(rimMid, shape.c, deg * Math.PI / 180)); holes.push(rimCenterAt(rimMid, shape.c, (180 - deg) * Math.PI / 180)); }
    return { t, g, es, inner, outer, rimMid, ear, pins, holes };
  }
  const nearest = (pts, x, y) => { let d = Infinity; for (const p of pts) d = Math.min(d, Math.hypot(x - p[0], y - p[1])); return d; };
  function latticePart(o, lay, D) {
    const sp = SPEC, es = lay.es, loops = [L_(lay.outer, 'outer', true, es), L_(lay.inner, 'inner', false, es)];
    if (lay.ear) loops.push(L_(circle(lay.ear[0], lay.ear[1], sp.earHoleD / 2, 0.3), 'earHole', true, es));
    for (const p of lay.pins) loops.push(L_(circle(p[0], p[1], sp.pinD / 2, 0.3), 'pin', false, es));
    for (const p of lay.holes) loops.push(L_(circle(p[0], p[1], sp.holeD / 2, 0.3), 'rimHole', true, es));
    // the pattern inside the zone (a strut in from the rim), kept a strut away from the design
    const zone = poly(lay.inner);
    let H = inter(unionLoops(patternHoles(o.pattern, o.line, o.gap, bboxL([lay.inner]))), offset(zone, -o.line));
    H = offset(offset(H, -0.25), 0.25);
    if (D.length) H = diff(H, offset(D, o.designMode === 'inlay' ? o.line : o.line * 0.6));
    H = offset(offset(H, -0.2), 0.2).filter(P => Math.abs(area(P.outer)) > 0.6);
    for (const L of loopsOf(H)) loops.push(L_(L, 'hole', true, es));
    if (o.designMode === 'inlay') for (const L of loopsOf(D)) loops.push(L_(L, 'design', true, es));
    const pinTop = sp.rimT + sp.pinH, ch = 0.4, st = [];
    for (const p of lay.pins) { st.push(p); for (const q of circle(p[0], p[1], sp.pinD / 2 - ch, 0.4)) st.push(q); }
    const rule = inn => { if (!inn('outer') || inn('earHole') || inn('rimHole')) return -1; if (inn('pin')) return 2; if (inn('inner')) return inn('design') || inn('hole') ? -1 : 0; return 1; };
    const height = (c, x, y) => c === 0 ? lay.t : c === 1 ? sp.rimT : pinTop - Math.max(0, nearest(lay.pins, x, y) - (sp.pinD / 2 - ch));
    return { p: terrace(loops, rule, height, st, 0, 0.12), holes: H.length };
  }
  function designPart(o, lay, D) {
    const loops = loopsOf(D).map(L => L_(L, 'design', true, lay.es));
    const z0 = o.designMode === 'inlay' ? 0 : lay.t, z1 = o.designMode === 'inlay' ? lay.t : lay.t + o.raise;
    return terrace(loops, inn => inn('design') ? 0 : -1, () => z1, null, z0);
  }
  function postSites(pocket, c, sp) {
    const near = edgeDist(pocket, 4), need = sp.postD / 2 + 3;
    return [45, 135, 270].map(deg => { const a = deg * Math.PI / 180; let r = rayHit(pocket, c, a) + need, q;
      for (let k = 0; k < 400; k++, r += 0.5) { q = [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]; if (!pip(q, pocket) && near(q[0], q[1], need + 1).d >= need) break; }
      return q; });
  }
  function blockOutline(pocket, posts, sp) {
    const pts = pocket.slice(); for (const p of posts) for (const q of circle(p[0], p[1], sp.postD / 2, 1)) pts.push(q);
    return mainOuter(offset(poly(hull(pts)), sp.wall)).outer;
  }
  function cavityPart(o, shape, lay) {
    const sp = SPEC, es = lay.es, s = o.detail === 'draft' ? 1.6 : 0.6;
    const pocket = mainOuter(offset(poly(lay.outer), sp.pocketClear)).outer, posts = postSites(pocket, shape.c, sp), outline = blockOutline(pocket, posts, sp);
    const P = sp.rimT + sp.pocketExtra, Hb = P + shape.uMax + sp.floor;
    const loops = [L_(outline, 'outer', true, es), L_(pocket, 'pocket', false, es)];
    for (const p of lay.holes) loops.push(L_(circle(p[0], p[1], sp.pocketPinD / 2, 0.3), 'ppin', false, es));
    for (const p of posts) loops.push(L_(circle(p[0], p[1], sp.postD / 2, 0.4), 'post', false, es));
    const st = hexGrid(offset(poly(shape.outline), 0.2), s).concat(ringPts(shape.outline, steepRings(shape, s), s * 0.8));
    for (const p of posts) { st.push(p); for (const q of circle(p[0], p[1], sp.postD / 2 - 1.2, 0.6)) st.push(q); }
    for (const p of lay.holes) { st.push(p); for (const q of circle(p[0], p[1], sp.pocketPinD / 2 - 0.5, 0.4)) st.push(q); }
    const rule = inn => { if (!inn('outer')) return -1; if (inn('post')) return 3; if (inn('pocket')) return inn('ppin') ? 2 : 1; return 0; };
    const height = (c, x, y) => {
      if (c === 0) return Hb; if (c === 1) return Hb - P - shape.u(x, y);
      if (c === 2) return Hb + sp.pocketPinUp - Math.max(0, nearest(lay.holes, x, y) - (sp.pocketPinD / 2 - 0.5));
      return Hb + sp.postH - Math.max(0, nearest(posts, x, y) - (sp.postD / 2 - 1.2));
    };
    return { p: terrace(loops, rule, height, st, 0, 0.1), Hb, P, pocket, posts, outline };
  }
  // the press surface: the cavity surface offset by g (ball dilation of the solid under it), as a height above the
  // pocket floor: zp(p) = max over |q - p| <= g of (sqrt(g\u00b2 - |q - p|\u00b2) - u(q)); g on the flat, lower over the dome
  // nearest point on a closed loop (bucketed segments): near(x, y, rmax) -> { d, q }
  function edgeDist(L, B) {
    const n = L.length, b = bboxL([L]), x0 = b.x0 - 1, y0 = b.y0 - 1, bx = Math.ceil((b.x1 - b.x0 + 2) / B) + 1, by = Math.ceil((b.y1 - b.y0 + 2) / B) + 1, bk = Array.from({ length: bx * by }, () => []);
    for (let i = 0; i < n; i++) { const p = L[i], q = L[(i + 1) % n]; for (let j = Math.floor((Math.min(p[1], q[1]) - y0) / B); j <= Math.floor((Math.max(p[1], q[1]) - y0) / B); j++) for (let k = Math.floor((Math.min(p[0], q[0]) - x0) / B); k <= Math.floor((Math.max(p[0], q[0]) - x0) / B); k++) bk[j * bx + k].push(i); }
    return (x, y, rmax) => {
      let d = Infinity, q = null; const ci = Math.floor((x - x0) / B), cj = Math.floor((y - y0) / B), R = Math.ceil(rmax / B) + 1;
      for (let j = cj - R; j <= cj + R; j++) for (let k = ci - R; k <= ci + R; k++) { if (j < 0 || k < 0 || j >= by || k >= bx) continue;
        for (const i of bk[j * bx + k]) { const a = L[i], c = L[(i + 1) % n], dx = c[0] - a[0], dy = c[1] - a[1], l2 = dx * dx + dy * dy, t = l2 > 0 ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1) : 0, px = a[0] + t * dx, py = a[1] + t * dy, dd = Math.hypot(x - px, y - py); if (dd < d) { d = dd; q = [px, py]; } } }
      return { d, q };
    };
  }
  function dilation(shape, g, NR) {
    NR = NR || 10; const K = [];
    for (let j = 0; j <= NR; j++) { const r = g * j / NR, na = j === 0 ? 1 : 8 * j; for (let a = 0; a < na; a++) { const t = a / na * Math.PI * 2; K.push([r * Math.cos(t), r * Math.sin(t), Math.sqrt(Math.max(0, g * g - r * r))]); } }
    const bb = bboxL([shape.outline]), near = edgeDist(shape.outline, 2);
    const f = (x, y, dx, dy) => { const r2 = dx * dx + dy * dy; return r2 > g * g ? -Infinity : Math.sqrt(g * g - r2) - shape.u(x + dx, y + dy); };
    return (x, y) => {
      if (x < bb.x0 - g || x > bb.x1 + g || y < bb.y0 - g || y > bb.y1 + g) return g;
      let best = -Infinity, bx = 0, by = 0; for (const k of K) { const v = k[2] - shape.u(x + k[0], y + k[1]); if (v > best) { best = v; bx = k[0]; by = k[1]; } }
      if (best >= g - 1e-9) return g;
      // the mouth edge itself (u = 0 there): the arc round the corner of the cavity
      const e = near(x, y, g); if (e.d < g) { const v = Math.sqrt(g * g - e.d * e.d); if (v > best) { best = v; bx = e.q[0] - x; by = e.q[1] - y; } }
      // pattern search around the best sample (the surface is steep near the mouth, so the grid alone undershoots)
      for (let st = g / NR / 2; st > 0.004; st /= 2) { let moved = true, guard = 0; while (moved && guard++ < 24) { moved = false;
        for (let a = 0; a < 8; a++) { const dx = bx + st * Math.cos(a * Math.PI / 4), dy = by + st * Math.sin(a * Math.PI / 4), v = f(x, y, dx, dy); if (v > best + 1e-12) { best = v; bx = dx; by = dy; moved = true; } } } }
      return Math.min(g, best);
    };
  }
  function plungerPart(o, shape, lay, cav) {
    const sp = SPEC, es = lay.es, s = o.detail === 'draft' ? 1.6 : 0.6, g = lay.g, P = cav.P, F = sp.plungerT;
    const mx = p => [-p[0], p[1]]; // printed dome up, then flipped side to side into the press: x is mirrored
    const posts = cav.posts.map(mx), sockets = lay.pins.concat(lay.holes).map(mx);
    // grip: shallow scallops round the edge, kept away from the post holes
    let outline = ccw(cav.outline.map(mx)); const per = perimeter(outline), notch = [];
    for (const q of resample(outline, per / Math.max(8, Math.round(per / 15)))) { if (nearest(posts, q[0], q[1]) < sp.postD / 2 + 9) continue; notch.push(poly(circle(q[0], q[1], 3.2, 0.4))[0]); }
    outline = mainOuter(offset(offset(diff(poly(outline), notch), -0.8), 0.8)).outer;
    const boss = mainOuter(offset(poly(lay.inner.map(mx)), -sp.bossClear)).outer;
    const loops = [L_(outline, 'outer', true, es), L_(boss, 'boss', false, es)];
    for (const p of posts) loops.push(L_(circle(p[0], p[1], sp.postD / 2 + sp.postClear, 0.4), 'postHole', true, es));
    for (const p of sockets) loops.push(L_(circle(p[0], p[1], sp.socketD / 2, 0.3), 'socket', false, es));
    const dil = dilation(shape, g, o.detail === 'draft' ? 5 : 10), mOut = ccw(shape.outline.map(mx));
    const rings = []; for (let d = 0; d <= g + 1e-9; d += 0.15) rings.push(d); for (const d of steepRings(shape, s)) rings.push(g + d);
    const st = hexGrid(offset(poly(mOut), 0.2), s).concat(ringPts(mOut, rings, s * 0.8));
    const rule = inn => { if (!inn('outer') || inn('postHole')) return -1; if (inn('socket')) return 2; if (inn('boss')) return 1; return 0; };
    const height = (c, x, y) => c === 0 ? F : c === 2 ? F - sp.socketDepth : F + P - dil(-x, y);
    return { p: terrace(loops, rule, height, st, 0, 0.1), F, outline, boss, dil };
  }

  // ---------------------------------------------------------------- build
  function build(o) {
    o = options(o);
    // shapeF: the shape seen from the front (outside); shape: in the print frame (the same for mirror-symmetric shapes)
    const SD = SHAPES[o.shape], shapeF = makeShape(o), shape = SD.asym ? mirrorShape(shapeF) : shapeF, sp = SPEC, draft = o.detail === 'draft', warnings = [];
    const lay = layout(o, shape), arcs = arcTables(shapeF, draft ? 360 : 720, draft ? 120 : 240);
    // design: front view -> pre-distorted for the dome -> mirrored (the bed face is the outside) -> inside the dome, thin bits dropped
    let D = designPolys(o, shapeF);
    if (D.length) {
      const fine = draft ? 0.8 : 0.35;
      D = D.map(P => ({ outer: resample(P.outer, fine), holes: P.holes.map(h => resample(h, fine)) }));
      if (o.predistort && shapeF.radial !== false) D = mapPolys(D, p => arcs.toFlat(p[0], p[1]));
      D = union(mapPolys(D, p => [-p[0], p[1]]).map(P => ({ outer: ccw(P.outer), holes: P.holes.map(h => ccw(h).reverse()) })));
      D = inter(D, offset(poly(shape.outline), -1.2));
      const before = polysArea(D);
      D = offset(offset(D, -0.4), 0.4).filter(P => Math.abs(area(P.outer)) > 1.5);
      if (!D.length) warnings.push('The design came out too small or too thin to print. Make it bigger.');
      else if (before > 0 && polysArea(D) < before * 0.93) warnings.push('Some details of the design were thinner than 0.8 mm and were left out. Make the design bigger to keep them.');
    }
    const lat = latticePart(o, lay, D), cav = cavityPart(o, shape, lay), plg = plungerPart(o, shape, lay, cav);
    const parts = [{ name: 'Front half mesh lattice', obj: 'front', kind: 'lattice', p: lat.p, color: o.colors.lattice }];
    const Dp = D.length ? designPart(o, lay, D) : null;
    if (Dp) parts.push({ name: 'Front half mesh design', obj: 'front', kind: 'design', p: Dp, color: o.colors.design });
    let layB = null;
    if (SD.flatBack) { // the back is a flat mesh (not pressed): the front mirrored about c, pins and holes swapped, so it meets the front face to face
      const c0 = shape.c[0], mL = L => ccw(L.map(p => [2 * c0 - p[0], p[1]])), mP = p => [2 * c0 - p[0], p[1]];
      layB = { ...lay, inner: mL(lay.inner), outer: mL(lay.outer), rimMid: mL(lay.rimMid), ear: lay.ear && mP(lay.ear), pins: lay.holes.map(mP), holes: lay.pins.map(mP) };
      const Db = D.length && o.back !== 'plain' ? union(mapPolys(D, mP).map(P => ({ outer: ccw(P.outer), holes: P.holes.map(h => ccw(h).reverse()) }))) : [];
      parts.push({ name: 'Back mesh lattice (flat)', obj: 'back', kind: 'lattice', p: latticePart(o, layB, Db).p, color: o.colors.lattice });
      if (Db.length) parts.push({ name: 'Back mesh design (flat)', obj: 'back', kind: 'design', p: designPart(o, layB, Db), color: o.colors.design });
    } else if (o.back === 'plain' && Dp) parts.push({ name: 'Back half mesh lattice', obj: 'back', kind: 'lattice', p: latticePart(o, lay, []).p, color: o.colors.lattice });
    else { parts.push({ name: 'Back half mesh lattice', obj: 'back', kind: 'lattice', p: lat.p, color: o.colors.lattice }); if (Dp) parts.push({ name: 'Back half mesh design', obj: 'back', kind: 'design', p: Dp, color: o.colors.design }); }
    parts.push({ name: 'Press cavity block', obj: 'cavity', kind: 'cavity', p: cav.p, color: o.colors.mold });
    parts.push({ name: 'Press plunger', obj: 'plunger', kind: 'plunger', p: plg.p, color: o.colors.mold });
    // the mesh grows by this factor in area over the dome, so it thins by the same factor
    const st = shapeF.kind === 'pillow' ? gridStretch(shapeF, draft ? 1 : 0.5) : stretch(shapeF, draft ? 180 : 360, draft ? 80 : 160), tf = lay.t / st;
    if (tf < 0.6) warnings.push(`The mesh stretches about ${Math.round((st - 1) * 100)}% to fill this shape, so a ${lay.t} mm mesh ends up about ${tf.toFixed(2)} mm thick. Under about 0.6 mm the struts tend to snap: make the mesh thicker or the shape shallower.`);
    const items = ['front', 'back', 'cavity', 'plunger'].map(id => { const ps = parts.filter(q => q.obj === id), b = Core.bbox(ps.length > 1 ? T.concat(ps.map(q => q.p)) : ps[0].p); return { id, w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], b }; });
    const big = items.filter(it => it.w > o.bed[0] - 4 || it.h > o.bed[1] - 4);
    if (big.length) warnings.push(`${big.map(it => ({ front: 'The mesh', back: 'The mesh', cavity: 'The cavity block', plunger: 'The plunger' })[it.id]).filter((v, i, a) => a.indexOf(v) === i).join(' and ')} ${big.length > 1 ? 'are' : 'is'} bigger than your build plate. Pick a smaller size or a bigger printer.`);
    const plates = arrange(items, o.bed, 8);
    const ob = bboxL([cav.outline]), db = bboxL([lay.outer]);
    const stats = {
      shape: o.shape, size: [shape.W, shape.H], depth: shape.uMax, ornamentDepth: (SD.flatBack ? 1 : 2) * shape.uMax + 2 * sp.rimT, flatBack: !!SD.flatBack, predistorted: !!(D.length && o.predistort && shapeF.radial !== false), thickness: lay.t, formedThickness: tf, stretch: st, gap: lay.g,
      clearance: o.clearance, rimT: sp.rimT, holes: lat.holes, design: !!D.length, tris: parts.reduce((a, q) => a + (q.obj === 'back' && o.back !== 'plain' ? 0 : q.p.length / 9), 0), plates: Math.max(...plates.map(q => q.plate)) + 1,
      blockH: cav.Hb + sp.postH, plungerH: plg.F + cav.P + shape.uMax - lay.g, block: [ob.x1 - ob.x0, ob.y1 - ob.y0], disc: [db.x1 - db.x0, db.y1 - db.y0], pins: lay.pins.length
    };
    return { options: o, shape: { id: shape.id, kind: shape.kind, W: shape.W, H: shape.H, uMax: shape.uMax, c: shape.c, outline: shape.outline }, _shape: shapeF, arcs, lay, layB, cav: { Hb: cav.Hb, P: cav.P, posts: cav.posts, outline: cav.outline }, plg: { F: plg.F, dil: plg.dil }, D, parts, items, plates, stats, warnings };
  }
  // shelf packing; the mesh discs and the press go on separate plates
  function arrange(items, bed, gap) {
    const W = bed[0] - 2 * gap, Dd = bed[1] - 2 * gap, pos = []; let x = 0, y = 0, rowH = 0, plate = 0, prev = null;
    for (const it of items) {
      const grp = it.id === 'front' || it.id === 'back' ? 'mesh' : 'press';
      if (prev && grp !== prev) { plate++; x = 0; y = 0; rowH = 0; } prev = grp;
      if (x > 0 && x + it.w > W) { x = 0; y += rowH + gap; rowH = 0; }
      if (y > 0 && y + it.h > Dd) { plate++; x = 0; y = 0; rowH = 0; }
      pos.push({ id: it.id, x: gap + Math.max(0, (W - it.w) / 2 * (x === 0 && it.w > W / 2 ? 1 : 0)) + x, y: bed[1] - gap - y - it.h, plate }); x += it.w + gap; rowH = Math.max(rowH, it.h);
    }
    return pos;
  }
  function moveP(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  // every part at its place on its plate (with slicer plate offsets when plateOrigins)
  function placed(res, plateOrigins) {
    const n = Math.max(...res.plates.map(q => q.plate)) + 1, bed = res.options.bed;
    return res.parts.map(pt => { const it = res.items.find(q => q.id === pt.obj), ps = res.plates.find(q => q.id === pt.obj);
      const org = plateOrigins ? T.bambuPlateOrigin(ps.plate, n, bed[0], bed[1]) : [0, 0];
      return { ...pt, plate: ps.plate, p: moveP(pt.p, ps.x - it.b.min[0] + org[0], ps.y - it.b.min[1] + org[1], 0) }; });
  }

  // ---------------------------------------------------------------- previews
  function normalAt(u, x, y) { const h = 0.08, ux = (u(x + h, y) - u(x - h, y)) / (2 * h), uy = (u(x, y + h) - u(x, y - h)) / (2 * h), l = Math.hypot(ux, uy, 1); return [ux / l, uy / l, 1 / l]; }
  // a flat mesh part formed into the dome (own frame: rim plane z 0..rimT, dome toward -z). The mesh is mirrored in
  // the print, so the formed outer face reads right; preview only (not exported)
  function formP(res, p) {
    const sh = res._shape, ar = res.arcs, thin = res.stats.formedThickness / res.lay.t, b = bboxL([res.lay.inner]), out = new Float32Array(p.length), cache = new Map();
    const u = (x, y) => sh.u(-x, y), n = (x, y) => { const v = normalAt(sh.u, -x, y); return [-v[0], v[1], v[2]]; };
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2], key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4);
      let m = cache.get(key);
      if (m === undefined) { m = null; if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) { const q = sh.radial === false ? [-x, y] : ar.toFormed(-x, y), qq = [-q[0], q[1]], uu = u(qq[0], qq[1]); if (uu > 1e-6) m = { q: qq, uu, n: n(qq[0], qq[1]) }; } cache.set(key, m); }
      if (!m) { out[i] = x; out[i + 1] = y; out[i + 2] = z; continue; }
      const zz = z * thin; out[i] = m.q[0] + m.n[0] * zz; out[i + 1] = m.q[1] + m.n[1] * zz; out[i + 2] = -m.uu + m.n[2] * zz;
    }
    return out;
  }
  const toWorld = (p, f) => { const q = new Float32Array(p.length); for (let i = 0; i < p.length; i += 3) { const w = f(p[i], p[i + 1], p[i + 2]); q[i] = w[0]; q[i + 1] = w[1]; q[i + 2] = w[2]; } return q; };
  function torus(cx, cy, cz, R, r) { // a ribbon loop in the x-z plane
    const out = [], N = 48, M = 12, P = (i, j) => { const a = i / N * Math.PI * 2, b = j / M * Math.PI * 2, rr = R + r * Math.cos(b); return [cx + rr * Math.cos(a), cy + r * Math.sin(b), cz + rr * Math.sin(a)]; };
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1); out.push(...A, ...B, ...C, ...A, ...C, ...D); }
    return Float32Array.from(out);
  }
  // the finished ornament (both halves joined, hanging) next to the press opened up (block, the flat mesh lifted out
  // of its pocket, the plunger turned over above it); side by side, or stacked (press under the ornament) for phones
  function combo(res, stack) {
    const ca = Math.cos(-0.5), sa = Math.sin(-0.5), rot = m => ({ ...m, p: toWorld(m.p, (x, y, z) => [x * ca - y * sa, x * sa + y * ca, z]) }); // turned about 30\u00b0 so the seam and the back half show
    const orn = scene(res, 'ornament').map(rot), sp = SPEC, Hb = res.cav.Hb, F = res.plg.F, P = res.cav.P, d = res.stats.depth;
    const cav = res.parts.find(q => q.obj === 'cavity'), plg = res.parts.find(q => q.obj === 'plunger'), front = res.parts.filter(q => q.obj === 'front');
    const L1 = Math.max(16, d * 0.6 + 12), L2 = L1 + Math.max(d, 8) + sp.rimT + sp.pinH + 28, press = [];
    press.push({ name: cav.name, kind: 'cavity', color: cav.color, p: Float32Array.from(cav.p) });
    for (const q of front) press.push({ name: q.name + ' (flat, before pressing)', kind: q.kind, color: q.color, p: Float32Array.from(moveP(q.p, 0, 0, Hb - P + L1)) });
    press.push({ name: plg.name + ' (turned over)', kind: 'plunger', color: plg.color, p: toWorld(plg.p, (x, y, z) => [-x, y, Hb + F - z + L2]) });
    const bb = list => { const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; for (const m of list) for (let i = 0; i < m.p.length; i += 3) for (let a = 0; a < 3; a++) { const v = m.p[i + a]; if (v < b.min[a]) b.min[a] = v; if (v > b.max[a]) b.max[a] = v; } return b; };
    const bo = bb(orn), bp = bb(press), gap = 18, out = [];
    const cO = [(bo.min[0] + bo.max[0]) / 2, (bo.min[1] + bo.max[1]) / 2], cP = [(bp.min[0] + bp.max[0]) / 2, (bp.min[1] + bp.max[1]) / 2];
    let oS, pS; // shifts
    if (stack) { pS = [-cP[0], -cP[1], -bp.min[2]]; oS = [-cO[0], -cO[1], bp.max[2] - bp.min[2] + gap - bo.min[2]]; }
    else { const wO = bo.max[0] - bo.min[0], wP = bp.max[0] - bp.min[0], x0 = -(wO + gap + wP) / 2;
      oS = [x0 - bo.min[0], -cO[1], -bo.min[2]]; pS = [x0 + wO + gap - bp.min[0], -cP[1] + (bp.max[1] - bp.min[1]) * 0.15, -bp.min[2]]; }
    for (const m of orn) out.push({ ...m, name: 'Ornament: ' + m.name, p: Float32Array.from(moveP(m.p, ...oS)) });
    for (const m of press) out.push({ ...m, name: 'Press: ' + m.name, p: Float32Array.from(moveP(m.p, ...pS)) });
    return out;
  }
  // view: 'combo' (finished ornament + the opened press, the default), 'flat' (the mesh as printed), 'mold' (press pair with the disc in the pocket), 'formed' (one half), 'ornament' (both halves)
  function scene(res, view, opt) {
    if (view === 'combo' || view === 'combo-stack') return combo(res, view === 'combo-stack' || !!(opt && opt.stack));
    const sp = SPEC, list = [], c = res.shape.c;
    const front = res.parts.filter(q => q.obj === 'front'), back = res.parts.filter(q => q.obj === 'back');
    if (view === 'flat') { for (const q of front) list.push({ name: q.name, kind: q.kind, color: q.color, p: Float32Array.from(moveP(q.p, -c[0], -c[1], 0)) }); return list; }
    if (view === 'mold') {
      const cav = res.parts.find(q => q.obj === 'cavity'), plg = res.parts.find(q => q.obj === 'plunger'), b1 = Core.bbox(cav.p), b2 = Core.bbox(plg.p), gap = 16;
      const w1 = b1.max[0] - b1.min[0], w2 = b2.max[0] - b2.min[0], x1 = -(w1 + w2 + gap) / 2 - b1.min[0], x2 = -(w1 + w2 + gap) / 2 + w1 + gap - b2.min[0];
      const y1 = -(b1.min[1] + b1.max[1]) / 2, y2 = -(b2.min[1] + b2.max[1]) / 2;
      list.push({ name: cav.name, kind: 'cavity', color: cav.color, p: Float32Array.from(moveP(cav.p, x1, y1, 0)) });
      list.push({ name: plg.name, kind: 'plunger', color: plg.color, p: Float32Array.from(moveP(plg.p, x2, y2, 0)) });
      for (const q of front) list.push({ name: q.name + ' (in the press)', kind: q.kind, color: q.color, p: Float32Array.from(moveP(q.p, x1, y1, res.cav.Hb - res.cav.P)) });
      return list;
    }
    const rimT = sp.rimT, A = (x, y, z) => [-(x - c[0]), z, y - c[1]]; // half A: dome toward the viewer (-y), hanging up (+z)
    const B = (x, y, z) => A(-x + 2 * c[0], y, 2 * rimT - z); // half B: the same half turned over about the vertical axis
    for (const q of front) list.push({ name: q.name.replace('Front half ', 'Formed ') , kind: q.kind, color: q.color, p: toWorld(formP(res, q.p), A) });
    if (view === 'ornament') {
      for (const q of back) list.push({ name: q.name.replace('Back half ', 'Formed back ') , kind: q.kind, color: q.color, p: toWorld(res.stats.flatBack ? q.p : formP(res, q.p), B) });
      if (res.lay.ear) { const e = A(res.lay.ear[0], res.lay.ear[1], rimT); list.push({ name: 'Ribbon loop', kind: 'ribbon', color: '#D4A72C', p: torus(e[0], e[1], e[2] + 5, 7, 0.9) }); }
    }
    return list;
  }

  // ---------------------------------------------------------------- export
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  // filament slots: 1 lattice, 2 design (when there is one), then the press
  function filaments(res) { const o = res.options, list = [{ role: 'lattice', color: o.colors.lattice }]; if (res.D.length) list.push({ role: 'design', color: o.colors.design }); list.push({ role: 'press', color: o.colors.mold }); return list; }
  const slotOf = (res, kind) => { const f = filaments(res); return f.findIndex(x => x.role === (kind === 'lattice' ? 'lattice' : kind === 'design' ? 'design' : 'press')) + 1; };
  const OBJ_NAMES = { front: 'Ornament mesh, front half', back: 'Ornament mesh, back half', cavity: 'Press cavity block', plunger: 'Press plunger' };
  function export3MF(res, o) {
    o = o || {}; const P = placed(res, true), objs = [], plates = [];
    for (const id of ['front', 'back', 'cavity', 'plunger']) {
      const ps = P.filter(q => q.obj === id); if (!ps.length) continue;
      (plates[ps[0].plate] = plates[ps[0].plate] || []).push(objs.length);
      if (ps.length > 1) objs.push({ name: OBJ_NAMES[id], parts: ps.map(q => ({ name: q.kind === 'design' ? 'Design' : 'Lattice', p: q.p, color: q.color, extruder: slotOf(res, q.kind) })) });
      else objs.push({ name: OBJ_NAMES[id], p: ps[0].p, color: ps[0].color, extruder: slotOf(res, ps[0].kind) });
    }
    for (let i = 0; i < plates.length; i++) plates[i] = plates[i] || [];
    return T.threeMF(objs, { title: o.name || 'Christmas ornament', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: filaments(res).map(f => ({ color: f.color })) });
  }
  function readme(res, name) {
    const s = res.stats, o = res.options, sp = SPEC, f = v => (Math.round(v * 10) / 10).toString();
    const L = [`Expressarte Christmas ornament: ${name}`, '',
      `Shape: ${SHAPES[o.shape].label}, ${f(s.size[0])} \u00d7 ${f(s.size[1])} mm, ${s.flatBack ? "the front" : "each half"} ${f(s.depth)} mm deep (about ${f(s.ornamentDepth)} mm front to back when joined)`,
      `Mesh: ${PATTERNS[o.pattern].label.toLowerCase()} lattice, ${o.thickness} mm thick, ${o.line} mm struts, ${o.gap} mm holes, in a ${sp.rimT} mm rim. It stretches about ${Math.round((s.stretch - 1) * 100)}% and ends up about ${s.formedThickness.toFixed(2)} mm thick.`,
      `Design: ${MOTIFS[o.design]}${o.name ? ` + "${o.name}"` : ''}${res.D.length ? `, ${o.designMode === 'inlay' ? 'inlaid through the lattice' : `raised ${o.raise} mm on top`}${s.predistorted ? ', pre-distorted so it looks right on the dome' : ''}` : ' (none)'}`,
      `Press: the gap between the plunger and the cavity is ${f(s.gap)} mm everywhere (mesh ${o.thickness} mm + ${o.clearance} mm clearance), measured along the surface. The plunger flange bottoms out on the block top at full depth.`,
      '', 'Filament slots in the 3MF'];
    filaments(res).forEach((x, i) => L.push(`  ${i + 1}: ${x.color}  ${{ lattice: 'mesh lattice', design: 'mesh design', press: 'press (cavity block and plunger)' }[x.role]}`));
    if (s.flatBack) L.push('', 'Flat back: only the front mesh goes in the press. The back mesh stays flat (it is the front mirrored, so the hook lines up); push its pins into the front rim holes after forming.');
    L.push('', 'How to make it'); HOWTO.forEach(([h, t], i) => L.push(`  ${i + 1}. ${h}: ${t}`));
    L.push('', 'Printing', '  - Mesh: 0.2 mm layers, printed flat. The bed side becomes the smooth outside, and the design is mirrored in the file so it reads right from the outside. PETG forms most easily; PLA works with gentler heat.',
      '    The 3MF has the lattice and the design as parts of one object, each on its own filament slot, so it opens ready for a two-color print.',
      '  - Press: PLA is fine (it only touches warm plastic for seconds). 2 walls, 10 to 15% infill, no supports. Print the plunger dome up.',
      `  - Fits: join pins ${sp.pinD} mm into ${sp.holeD} mm holes (snug; a drop of glue makes it permanent). Guide posts ${sp.postD} mm into ${f(sp.postD + 2 * sp.postClear)} mm holes.`,
      '', 'Heat and safety', '  ' + SAFETY);
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, o) {
    o = o || {}; const name = o.name || 'Christmas ornament', base = safe(o.fileBase || name.toLowerCase()) || 'ornament', list = [{ name: `${base}.3mf`, data: export3MF(res, o) }], seen = new Set();
    const same = res.options.back !== 'plain' && !res.stats.flatBack;
    for (const pt of res.parts) { if (pt.obj === 'back' && same) continue; const nm = pt.obj === 'front' && same ? pt.name.replace('Front half ', '') : pt.name; if (seen.has(nm)) continue; seen.add(nm);
      list.push({ name: `stl/${safe(nm.toLowerCase())}.stl`, data: new Uint8Array(Core.writeSTL(pt.p, nm)) }); }
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }

  const api = { combo, mirrorShape, gridStretch, candyStripes, SHAPES, SIZES, PATTERNS, MOTIFS, PALETTE, DEFAULTS, SPEC, LIMITS, HOWTO, SAFETY, options, build, scene, export3MF, files, readme, placed, filaments, makeShape, arcTables, stretch, motif, designPolys, patternHoles, dilation, terrace,
    _dbg: { offset, union, diff, inter, densify, rayHit, pip, bboxL, area, loopsOf, layout } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPOrnament = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
