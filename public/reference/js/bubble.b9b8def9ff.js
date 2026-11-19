/* Expressarte bubble letters: puffy, fully rounded letters and numbers with a flat back, a surface texture (fuzzy by
   default), back mounts (keyholes, sawtooth recess, adhesive strip pad, magnet pockets, or a slot-in shelf stand),
   each character its own part, auto-arranged on the build plate.
   How a letter is built (no booleans, so every part is closed by construction):
   1. The glyph outline (SIL OFL fonts, bubble-fonts.js) is flattened, rounded and puffed outward with Clipper offsets;
      counters (the holes in O, A, D...) shrink only as far as keeps them open at the minimum counter size.
   2. Points are laid on inward offset rings of that outline, so every point's distance d to the edge is exact. The
      height is a quarter-ellipse profile of d (vertical at the edge, flat back) and the rings are packed tighter where
      the profile is steep, so the rounded edge is smooth.
   3. A constrained Delaunay triangulation of all points, with the outline edges forced in, is the front surface. The
      texture moves each front point along its normal (planar patterns for knits and grids, 3D noise for fuzz).
   4. The outline drops straight to the flat back (a short lip), and the back face is the outline with the mount
      pockets cut in as holes; every pocket is a stack of strictly nested layers with walls, ledges and a ceiling.
   Units: mm. Letter local frame: x right, y up (reading direction), z out of the front; back at z = 0. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const CL = G.ClipperLib || (typeof require === 'function' ? require('clipper-lib') : null);
  const FONTS = G.GPBubbleFonts || (typeof require === 'function' ? require('./bubble-fonts.js') : null);
  const dflt = m => (m && typeof m !== 'function' && m.default) || m;
  const Delaunator = dflt(G.Delaunator || (typeof require === 'function' ? require('delaunator') : null));
  const Constrainautor = dflt(G.Constrainautor || (typeof require === 'function' ? require('@kninnug/constrainautor') : null));
  const earcut = dflt(G.earcut || (typeof require === 'function' ? require('earcut') : null));
  const SC = 1000; // clipper scale: \u00b5m

  // Reference-style felt palette (filament-like colors)
  const PALETTE = [
    { name: 'Red', hex: '#D0312D' }, { name: 'Sky blue', hex: '#7CC4E8' }, { name: 'Yellow', hex: '#F4C931' },
    { name: 'Brown', hex: '#7B4A2D' }, { name: 'Olive', hex: '#7E8B3D' }, { name: 'Cream', hex: '#F1E4C3' }, { name: 'White', hex: '#F7F7F2' }
  ];
  // scale: repeat size (mm); depth: relief (mm); bias: 0 = raised only, 0.5 = centered, 1 = pressed in only
  const TEXTURES = {
    fuzzy: { label: 'Fuzzy felt', scale: 0.8, depth: 0.35, bias: 0.5, smin: 0.3, smax: 3, dmax: 0.8, note: 'Fine random fuzz like felt, plus the slicer\'s fuzzy skin on the outer walls.' },
    knit: { label: 'Knitted', scale: 5, depth: 0.9, bias: 0.5, smin: 2, smax: 10, dmax: 1.6, note: 'Sweater stockinette: columns of interlocking V stitches.' },
    cable: { label: 'Cable knit', scale: 4.5, depth: 1.3, bias: 0.5, smin: 2, smax: 10, dmax: 2.2, note: 'Twisted cables between narrow knit columns, like an Aran sweater.' },
    terry: { label: 'Boucl\u00e9 loops', scale: 2.2, depth: 0.55, bias: 0.3, smin: 1, smax: 6, dmax: 1.2, note: 'Little curly yarn loops, like terry cloth or boucl\u00e9.' },
    ribbed: { label: 'Ribbed knit', scale: 3, depth: 0.7, bias: 0.5, smin: 1.5, smax: 8, dmax: 1.5, note: 'Knit ribs: raised V-stitch columns between purl troughs.' },
    corduroy: { label: 'Corduroy', scale: 1.6, depth: 0.45, bias: 0.5, smin: 0.8, smax: 5, dmax: 1, note: 'Soft parallel wales with a faint nap.' },
    quilted: { label: 'Quilted', scale: 12, depth: 1.1, bias: 0.6, smin: 5, smax: 30, dmax: 2.2, note: 'Puffy diamond cushions with stitched seams.' },
    waffle: { label: 'Waffle', scale: 6, depth: 0.9, bias: 0.6, smin: 3, smax: 15, dmax: 1.8, note: 'Square pockets between raised ridges.' },
    polka: { label: 'Polka dots', scale: 8, depth: 0.9, bias: 0, smin: 4, smax: 20, dmax: 2, note: 'Round raised dots on a staggered grid.' },
    pebbled: { label: 'Pebbled', scale: 2.4, depth: 0.5, bias: 0.2, smin: 1, smax: 8, dmax: 1.2, note: 'Rounded little pebbles, like leather grain.' },
    hammered: { label: 'Hammered', scale: 5, depth: 0.5, bias: 1, smin: 2, smax: 14, dmax: 1.2, note: 'Shallow hammer-dent facets.' },
    smooth: { label: 'Smooth', scale: 1, depth: 0, bias: 0, smin: 1, smax: 1, dmax: 0, note: 'Glossy smooth balloon surface.' }
  };
  const MOUNTS = { none: 'None', stand: 'Shelf stand', keyhole: 'Keyhole slots', sawtooth: 'Sawtooth hanger recess', strip: 'Adhesive strip pad', magnet: 'Magnet pockets' };
  const DEFAULTS = {
    text: 'HELLO', font: 'round', height: 80, thickness: 14, inflate: 0.55, texture: 'fuzzy', texScale: null, texDepth: null,
    detail: 'hd', mount: 'stand', keyholes: 'auto', tolerance: 0.2, lean: 10, standT: 3.2, magnetD: 8, magnetH: 3, magnets: 2,
    stripW: 46, stripH: 16, gap: 6, bed: [256, 256], colors: null, fuzzySkin: true, view: 'plate'
  };
  const LIMITS = { free: { chars: 3, height: 100 } };
  const SLICER_FUZZY = { fuzzy_skin: 'external', fuzzy_skin_thickness: '0.3', fuzzy_skin_point_distance: '0.8' };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- 2D: clipper helpers (polys: [{outer, holes}] in mm)
  const toC = L => L.map(p => ({ X: Math.round(p[0] * SC), Y: Math.round(p[1] * SC) }));
  const fromC = P => P.map(q => [q.X / SC, q.Y / SC]);
  const area = L => { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; };
  function treePolys(tree, minArea) {
    const out = [], ma = (minArea || 0.05);
    const walk = nd => { for (const c of nd.Childs()) { if (c.IsHole()) continue; const outer = fromC(c.Contour()); if (Math.abs(area(outer)) < ma) { for (const h of c.Childs()) walk(h); continue; }
      const holes = []; for (const h of c.Childs()) { const hl = fromC(h.Contour()); if (Math.abs(area(hl)) >= ma * 0.5) holes.push(hl); walk(h); }
      out.push({ outer: area(outer) < 0 ? outer.reverse() : outer, holes: holes.map(h => area(h) > 0 ? h.reverse() : h) }); } };
    walk(tree); return out;
  }
  // Clipper results carry 1 \u00b5m staircase steps (integer rounding of fine round joins). Offsetting such a loop again by
  // a large amount leaves a zero-width slit as deep as the offset at each tiny reversal (Clipper adds the source
  // vertex at concave joins), which became a crater in the puffed surface (the J's dent). So every path is cleaned of
  // near-duplicate and near-collinear points (within CLEAN \u00b5m) before it goes into an offset or a boolean.
  const CLEAN = 4;
  const tidyC = P => { const c = CL.Clipper.CleanPolygon(P, CLEAN); return c.length >= 3 ? c : P; };
  const pathsOf = ps => { const o = []; for (const P of ps) { o.push(tidyC(toC(P.outer))); for (const h of P.holes) o.push(tidyC(toC(h))); } return o; };
  function cOffset(ps, d, arc) {
    const co = new CL.ClipperOffset(2, (arc || 0.004) * SC), tr = new CL.PolyTree();
    co.AddPaths(pathsOf(ps), CL.JoinType.jtRound, CL.EndType.etClosedPolygon); co.Execute(tr, d * SC); return treePolys(tr);
  }
  // remove spikes and slits from a loop: a vertex whose path goes out and comes straight back (turn of nearly 180\u00b0),
  // repeated until none is left, then drop exact duplicates
  function despike(L) {
    let A = L.slice(), changed = true, guard = 0;
    while (changed && A.length > 3 && guard++ < 50) { changed = false; const out = [];
      for (let i = 0; i < A.length; i++) { const a = out.length ? out[out.length - 1] : A[A.length - 1], b = A[i], c = A[(i + 1) % A.length];
        const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1], lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
        if (lu < 1e-6 || (lv > 1e-9 && (ux * vx + uy * vy) / (lu * lv) < -0.94)) { changed = true; continue; } // duplicate, or a turn back of more than ~160\u00b0
        out.push(b); }
      A = out; }
    return A.length >= 3 ? A : L;
  }
  const despikePolys = ps => ps.map(P => ({ outer: despike(P.outer), holes: P.holes.map(despike) }));
  function cBool(type, a, b, fill) {
    const c = new CL.Clipper(), tr = new CL.PolyTree(), ft = fill === 'nz' ? CL.PolyFillType.pftNonZero : CL.PolyFillType.pftEvenOdd;
    c.AddPaths(Array.isArray(a[0]) ? a.map(toC) : pathsOf(a), CL.PolyType.ptSubject, true);
    if (b && b.length) c.AddPaths(pathsOf(b), CL.PolyType.ptClip, true);
    c.Execute(type, tr, ft, CL.PolyFillType.pftNonZero); return treePolys(tr);
  }
  const union = (loops, nz) => cBool(CL.ClipType.ctUnion, loops, null, nz ? 'nz' : 'eo');
  const diff = (a, b) => cBool(CL.ClipType.ctDifference, a, b, 'nz');
  const polysArea = ps => ps.reduce((s, P) => s + area(P.outer) + P.holes.reduce((t, h) => t + area(h), 0), 0);
  const loopsOf = ps => { const o = []; for (const P of ps) { o.push(P.outer); for (const h of P.holes) o.push(h); } return o; };
  function bboxOf(ps) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const L of loopsOf(ps)) for (const p of L) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return { x0, y0, x1, y1 }; }
  const pip = (q, L) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const inPolys = (ps, q) => ps.some(P => pip(q, P.outer) && !P.holes.some(h => pip(q, h)));
  const shift = (ps, dx, dy) => ps.map(P => ({ outer: P.outer.map(p => [p[0] + dx, p[1] + dy]), holes: P.holes.map(h => h.map(p => [p[0] + dx, p[1] + dy])) }));
  function circle(cx, cy, r, n) { n = n || Math.max(24, Math.ceil(2 * Math.PI * r / 0.35)); const L = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; L.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return L; }
  function stadium(x, y0, y1, hw) { // vertical slot from (x, y0) to (x, y1), half width hw, round ends
    const L = [], n = Math.max(12, Math.ceil(Math.PI * hw / 0.3));
    for (let i = 0; i <= n; i++) { const t = Math.PI + i / n * Math.PI; L.push([x + hw * Math.cos(t), y0 + hw * Math.sin(t)]); }
    for (let i = 0; i <= n; i++) { const t = i / n * Math.PI; L.push([x + hw * Math.cos(t), y1 + hw * Math.sin(t)]); }
    return L;
  }
  function roundRect(cx, cy, w, h, r) {
    r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3); const L = [], n = Math.max(3, Math.ceil(r * Math.PI / 2 / 0.3));
    const C = [[cx + w / 2 - r, cy + h / 2 - r, 0], [cx - w / 2 + r, cy + h / 2 - r, 1], [cx - w / 2 + r, cy - h / 2 + r, 2], [cx + w / 2 - r, cy - h / 2 + r, 3]];
    for (const [x, y, q] of C) for (let i = 0; i <= n; i++) { const t = (q + i / n) * Math.PI / 2; L.push([x + r * Math.cos(t), y + r * Math.sin(t)]); }
    return L;
  }
  // resample a closed loop to about `s` spacing (keeps orientation)
  function resample(L, s) {
    const n = L.length, seg = new Float64Array(n); let per = 0;
    for (let i = 0; i < n; i++) { const a = L[i], b = L[(i + 1) % n]; seg[i] = Math.hypot(b[0] - a[0], b[1] - a[1]); per += seg[i]; }
    const m = Math.max(8, Math.round(per / s)), step = per / m, out = []; let i = 0, acc = 0;
    for (let k = 0; k < m; k++) {
      const t = k * step; while (i < n - 1 && acc + seg[i] < t) { acc += seg[i]; i++; }
      const a = L[i], b = L[(i + 1) % n], u = seg[i] > 0 ? (t - acc) / seg[i] : 0; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
    return out;
  }


  // ---------------------------------------------------------------- exact distance to an outline (bucketed segments)
  function distField(loops, cell) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const L of loops) for (const p of L) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    cell = cell || 2; const nx = Math.max(1, Math.ceil((x1 - x0) / cell) + 1), ny = Math.max(1, Math.ceil((y1 - y0) / cell) + 1);
    const segs = []; for (const L of loops) for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; segs.push(a[0], a[1], b[0], b[1]); }
    const S = Float64Array.from(segs), ns = S.length / 4, buckets = Array.from({ length: nx * ny }, () => []);
    for (let k = 0; k < ns; k++) { const ax = S[4 * k], ay = S[4 * k + 1], bx = S[4 * k + 2], by = S[4 * k + 3];
      const i0 = Math.floor((Math.min(ax, bx) - x0) / cell), i1 = Math.floor((Math.max(ax, bx) - x0) / cell), j0 = Math.floor((Math.min(ay, by) - y0) / cell), j1 = Math.floor((Math.max(ay, by) - y0) / cell);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) buckets[j * nx + i].push(k); }
    const segDist2 = (k, x, y) => { const ax = S[4 * k], ay = S[4 * k + 1], dx = S[4 * k + 2] - ax, dy = S[4 * k + 3] - ay, l2 = dx * dx + dy * dy; let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = x - ax - t * dx, ey = y - ay - t * dy; return ex * ex + ey * ey; };
    function dist(x, y) {
      const ci = Math.floor((x - x0) / cell), cj = Math.floor((y - y0) / cell); let best = Infinity;
      for (let r = 0; r < Math.max(nx, ny) + 2; r++) {
        for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || i < 0 || j < 0 || i >= nx || j >= ny) continue;
          for (const k of buckets[j * nx + i]) { const d2 = segDist2(k, x, y); if (d2 < best) best = d2; }
        }
        // everything outside ring r is at least r cells away
        if (best < Infinity && Math.sqrt(best) <= r * cell) break;
      }
      return Math.sqrt(best);
    }
    return { dist, x0, y0, x1, y1 };
  }
  // x where the loops cross the row y, sorted (inside = between pairs, even-odd)
  function rowCross(loops, y) { const xs = []; for (const L of loops) for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); } return xs.sort((u, v) => u - v); }
  // grid points inside the loops (rows every gy, columns every gx, odd rows shifted by sx)
  function gridInside(loops, bb, gx, gy, sx, fn) {
    for (let j = 0, y = bb.y0 + gy / 2; y < bb.y1; y += gy, j++) { const xs = rowCross(loops, y), off = j & 1 ? sx : 0;
      for (let k = 0; k + 1 < xs.length; k += 2) { const a = xs[k], b = xs[k + 1]; let x = bb.x0 + off + Math.ceil((a - bb.x0 - off) / gx) * gx; for (; x < b; x += gx) fn(x, y); } }
  }
  // largest inscribed circle radius: a coarse grid, then a local refine round the best points
  function maxInscribed(ps, g) {
    const loops = loopsOf(ps), df = distField(loops, 2), bb = bboxOf(ps); g = Math.max(g || 1.2, Math.min(bb.x1 - bb.x0, bb.y1 - bb.y0) / 40);
    const c = []; gridInside(loops, bb, g, g, 0, (x, y) => c.push([df.dist(x, y), x, y]));
    c.sort((a, b) => b[0] - a[0]); let best = c.length ? c[0][0] : 0;
    for (const [d0, x0, y0] of c.slice(0, 6)) { let x = x0, y = y0, d = d0;
      for (let st = g / 2; st > 0.02; st /= 2) { let moved = true; while (moved) { moved = false; for (const [ax, ay] of [[st, 0], [-st, 0], [0, st], [0, -st]]) { const nx = x + ax, ny = y + ay; if (!inPolys(ps, [nx, ny])) continue; const nd = df.dist(nx, ny); if (nd > d) { d = nd; x = nx; y = ny; moved = true; } } } }
      if (d > best) best = d; }
    return best;
  }
  // ---------------------------------------------------------------- glyphs
  function parsePath(d, s, tol) {
    const loops = []; let cur = null, x = 0, y = 0; const re = /([MLQCZ])([^MLQCZ]*)/g; let m;
    const push = (px, py) => { cur.push([px * s, py * s]); };
    while ((m = re.exec(d))) {
      const c = m[1], v = (m[2].match(/-?\d+(\.\d+)?/g) || []).map(Number);
      if (c === 'M') { if (cur && cur.length > 2) loops.push(cur); cur = []; x = v[0]; y = v[1]; push(x, y); }
      else if (c === 'L') { x = v[0]; y = v[1]; push(x, y); }
      else if (c === 'Q') { const len = Math.hypot(v[0] - x, v[1] - y) + Math.hypot(v[2] - v[0], v[3] - v[1]), n = Math.max(2, Math.ceil(Math.sqrt(len * s / tol) * 0.6)); for (let k = 1; k <= n; k++) { const t = k / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, e = t * t; push(a * x + b * v[0] + e * v[2], a * y + b * v[1] + e * v[3]); } x = v[2]; y = v[3]; }
      else if (c === 'C') { const len = Math.hypot(v[0] - x, v[1] - y) + Math.hypot(v[2] - v[0], v[3] - v[1]) + Math.hypot(v[4] - v[2], v[5] - v[3]), n = Math.max(3, Math.ceil(Math.sqrt(len * s / tol) * 0.6)); for (let k = 1; k <= n; k++) { const t = k / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, e = 3 * (1 - t) * t * t, f = t ** 3; push(a * x + b * v[0] + e * v[2] + f * v[4], a * y + b * v[1] + e * v[3] + f * v[5]); } x = v[4]; y = v[5]; }
      else if (c === 'Z') { if (cur && cur.length > 2) loops.push(cur); cur = null; }
    }
    if (cur && cur.length > 2) loops.push(cur);
    return loops;
  }
  // characters the chosen style can make (others are skipped with a note)
  function supported(font, ch) { const F = FONTS[font] || FONTS.round; return !!F.glyphs[ch]; }
  function glyphPolys(font, ch, height) {
    const F = FONTS[font] || FONTS.round, g = F.glyphs[ch]; if (!g) return null;
    const s = height / F.cap, loops = parsePath(g[1], s, 0.01);
    return { polys: union(loops, true), advance: g[0] * s };
  }
  // largest inscribed radius (binary search on inward offsets)
  function inradius(ps, hi) {
    let lo = 0; hi = hi || 200;
    for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (cOffset(ps, -m, 0.05).length) lo = m; else hi = m; }
    return lo;
  }
  // The bubble outline: rounded, puffed out by the inflation, counters kept open.
  function bubbleOutline(glyph, o) {
    const H = o.height, inf = clamp(o.inflate, 0, 1);
    const fill = glyph.map(P => ({ outer: P.outer, holes: [] }));
    const A = Math.abs(polysArea(glyph)), per = loopsOf(glyph).reduce((s, L) => s + L.reduce((t, p, i) => t + Math.hypot(L[(i + 1) % L.length][0] - p[0], L[(i + 1) % L.length][1] - p[1]), 0), 0);
    const stroke = 2 * A / Math.max(1e-6, per); // mean stroke width
    const puff = H * (0.004 + 0.032 * inf), rc = Math.max(H * (0.008 + 0.01 * inf), puff * 0.6), ro = Math.min(H * (0.015 + 0.035 * inf), stroke * 0.4);
    // dilate (rounds convex corners), close concave ones. The closing radius grows with the puff (at least 0.6 of it),
    // so where puffing fuses two strokes (a tail meeting its bowl, as in 6, 9, y) the seam is a soft fillet and not a
    // sharp cusp that drops to the lip as a cliff; real openings (c, e, @) stay open.
    let outer = cOffset(cOffset(fill, puff + rc, 0.01), -rc, 0.01);
    if (ro > 0.05) { const op = cOffset(cOffset(outer, -ro, 0.01), ro, 0.01); if (op.length && Math.abs(polysArea(op)) > Math.abs(polysArea(outer)) * 0.7) outer = op; }
    const rMin = Math.max(2.5, H * 0.085), holes = [], notes = [];
    for (const P of glyph) for (const h of P.holes) {
      const hp = [{ outer: h.slice().reverse(), holes: [] }], rh = maxInscribed(hp, 0.5);
      let e = rh > rMin ? Math.min(puff, rh - rMin) : 0; if (e < puff * 0.5 && rh > 0) notes.push('narrowed');
      const rr = Math.max(0, Math.min(H * 0.03, 0.45 * (rh - e)));
      let sh = cOffset(hp, -(e + rr), 0.01); if (rr > 0 && sh.length) sh = cOffset(sh, rr, 0.01);
      if (!sh.length) sh = hp; // never close a counter
      holes.push(...sh);
    }
    let shape = holes.length ? diff(outer, holes) : outer;
    shape = despikePolys(shape).filter(P => Math.abs(area(P.outer)) > 2);
    return { shape, stroke, counters: holes.length, narrowed: notes.length };
  }

  // ---------------------------------------------------------------- textures (h in [0, 1])
  const fract = x => x - Math.floor(x);
  function hash3(i, j, k) { let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function vnoise3(x, y, z) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = x - i, v = y - j, w = z - k;
    const fu = u * u * (3 - 2 * u), fv = v * v * (3 - 2 * v), fw = w * w * (3 - 2 * w);
    const L = (a, b, t) => a + (b - a) * t;
    return L(L(L(hash3(i, j, k), hash3(i + 1, j, k), fu), L(hash3(i, j + 1, k), hash3(i + 1, j + 1, k), fu), fv),
      L(L(hash3(i, j, k + 1), hash3(i + 1, j, k + 1), fu), L(hash3(i, j + 1, k + 1), hash3(i + 1, j + 1, k + 1), fu), fv), fw);
  }
  function worley3(x, y, z) { // F1, F2 in cell units
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z); let f1 = 9, f2 = 9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const I = i + a, J = j + b, K = k + c, px = I + hash3(I, J, K), py = J + hash3(J, K, I + 17), pz = K + hash3(K, I + 5, J + 29);
      const d = Math.hypot(px - x, py - y, pz - z); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return [f1, f2];
  }
  // distance from p to segment ab, and the parameter along it
  function segD(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0; return [Math.hypot(px - ax - t * dx, py - ay - t * dy), t]; }
  // stockinette: each stitch is a V of two plump slanted legs; the V's of a column nest into one another
  function knitV(x, y, w) {
    const h = w * 0.78, cu = Math.floor(x / w), x0 = cu * w, r0 = Math.floor(y / h); let best = 0;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      const yb = r * h, yt = yb + h * 1.18;
      for (const side of [0, 1]) {
        const ax = side ? x0 + w * 0.93 : x0 + w * 0.07, [d, t] = segD(x, y, ax, yt, x0 + w * 0.5, yb + h * 0.06);
        const rad = w * 0.235 * (0.62 + 0.38 * Math.sin(Math.PI * clamp(t * 0.92 + 0.04, 0, 1))); // plump middle, tapered ends: a loop of yarn
        const b = d < rad ? Math.pow(1 - (d / rad) ** 2, 0.9) : 0;
        // the leg dips where it passes under the stitch above (the interlock)
        const lift = 1 - 0.28 * smooth01(1 - Math.abs(t - 0.08) / 0.18);
        if (b * lift > best) best = b * lift;
      }
    }
    return best;
  }
  function yarnFuzz(x, y, z, s) { return vnoise3(x / s, y / s, z / s) - 0.5; }
  const TEX = {
    smooth: () => 0,
    fuzzy: (x, y, z, s) => { const a = vnoise3(x / s, y / s, z / s), b = vnoise3(x / (s * 0.43) + 31.7, y / (s * 0.43) - 7.1, z / (s * 0.43) + 3.3); return clamp(a * 0.62 + b * 0.38 + (hash3(Math.round(x / s * 3), Math.round(y / s * 3), Math.round(z / s * 3)) - 0.5) * 0.25, 0, 1); },
    knit: (x, y, z, s) => clamp(knitV(x, y, s) * 0.92 + yarnFuzz(x, y, z, 0.45) * 0.16 + 0.04, 0, 1),
    cable: (x, y, z, s) => {
      const P = s * 4.2, c = Math.floor(x / P) * P + P / 2, xl = x - c, ax = Math.abs(xl);
      if (ax < s * 1.45) { // the cable: two strands twisting over and under
        const per = s * 3.6, ph = 2 * Math.PI * y / per, a = s * 0.62, rr = s * 0.66, k = a * 2 * Math.PI / per;
        const st = sg => { const xi = sg * a * Math.sin(ph), slope = sg * k * Math.cos(ph), d = Math.abs(xl - xi) / Math.sqrt(1 + slope * slope); return d < rr ? Math.pow(1 - (d / rr) ** 2, 0.8) : 0; };
        const over = Math.cos(ph), h1 = st(1) * (0.74 + 0.26 * over), h2 = st(-1) * (0.74 - 0.26 * over);
        const strand = Math.max(h1, h2), knit = knitV(xl + s * 10, y, s * 0.6);
        return clamp(strand * (0.86 + 0.14 * knit) + yarnFuzz(x, y, z, 0.45) * 0.1, 0, 1);
      }
      if (ax < s * 1.75) return clamp(0.05 + yarnFuzz(x, y, z, 0.5) * 0.15, 0, 1); // purl trough
      return clamp(0.6 * knitV(xl + s * 20 + s * 0.4, y, s * 0.85) + yarnFuzz(x, y, z, 0.45) * 0.1, 0, 1); // side knit columns
    },
    ribbed: (x, y, z, s) => { const P = 2 * s, u = fract(x / P) * P - P / 2, hw = s * 0.62; const rib = Math.abs(u) < hw ? Math.pow(1 - (u / hw) ** 2, 0.8) : 0;
      return clamp(rib * (0.78 + 0.22 * knitV(u + hw + s * 7, y, hw * 2)) + (rib ? 0 : 0.08 * Math.abs(Math.sin(Math.PI * y / (s * 0.5)))) + yarnFuzz(x, y, z, 0.45) * 0.1, 0, 1); },
    corduroy: (x, y, z, s) => clamp(Math.pow(Math.abs(Math.sin(Math.PI * x / s)), 0.45) * 0.9 + yarnFuzz(x, y, z, 0.3) * 0.18 + 0.05, 0, 1),
    quilted: (x, y, z, s) => { const p = (x + y) / Math.SQRT2 / s, q = (x - y) / Math.SQRT2 / s, a = Math.sin(Math.PI * fract(p)), b = Math.sin(Math.PI * fract(q)); return clamp(Math.pow(a * b, 0.42) + yarnFuzz(x, y, z, 0.6) * 0.05, 0, 1); },
    waffle: (x, y, z, s) => { const fx = Math.abs(fract(x / s) - 0.5) * 2, fy = Math.abs(fract(y / s) - 0.5) * 2, m = Math.max(fx, fy); return smooth01((m - 0.6) / 0.24) * 0.85 + 0.15 * m * m; },
    polka: (x, y, z, s) => { const r = s * 0.3, h = s * Math.sqrt(3) / 2, row = Math.round(y / h), ox = (row & 1) ? s / 2 : 0; let best = 0;
      for (const rr of [row - 1, row, row + 1]) { const o = (rr & 1) ? s / 2 : 0, cx = Math.round((x - o) / s) * s + o, d = Math.hypot(x - cx, y - rr * h); if (d < r) best = Math.max(best, Math.pow(1 - (d / r) ** 2, 0.7)); }
      void ox; return best; },
    terry: (x, y, z, s) => { // little loops of yarn, jittered and of random size
      const i0 = Math.floor(x / s), j0 = Math.floor(y / s); let best = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const I = i0 + a, J = j0 + b, cx = (I + 0.2 + 0.6 * hash3(I, J, 3)) * s, cy = (J + 0.2 + 0.6 * hash3(J, I, 7)) * s;
        const r0 = s * (0.26 + 0.16 * hash3(I, J, 11)), w = s * 0.11, d = Math.hypot(x - cx, y - cy), g = Math.exp(-(((d - r0) / w) ** 2)) * (0.7 + 0.3 * hash3(I, J, 13));
        if (g > best) best = g;
      }
      return clamp(best * 0.9 + yarnFuzz(x, y, z, 0.35) * 0.22 + 0.05, 0, 1);
    },
    pebbled: (x, y, z, s) => { const [f1] = worley3(x / s, y / s, z / s); return clamp(1 - (f1 / 0.62) ** 2, 0, 1); },
    hammered: (x, y, z, s) => { const [f1, f2] = worley3(x / s, y / s, z / s); return clamp(0.15 + 0.85 * Math.min(1, (f1 / 0.7) ** 2) + 0.2 * (1 - smooth01((f2 - f1) / 0.12)), 0, 1); }
  };
  function texParams(o) {
    const t = TEXTURES[o.texture] ? o.texture : 'fuzzy', D = TEXTURES[t];
    const scale = clamp(o.texScale == null ? D.scale : +o.texScale, D.smin, D.smax), depth = t === 'smooth' ? 0 : clamp(o.texDepth == null ? D.depth : +o.texDepth, 0, D.dmax);
    return { id: t, scale, depth, bias: D.bias, fn: TEX[t] };
  }

  // ---------------------------------------------------------------- profile
  function profile(o, dMax) {
    const inf = clamp(o.inflate, 0, 1), depth = Math.max(2, o.thickness * (1 + 0.8 * inf)), lip = Math.min(0.8, depth * 0.08);
    const D = Math.max(0.6, Math.min(dMax, dMax * lerp(0.32, 1, Math.pow(inf, 0.85)))), Hh = depth - lip;
    const z = d => { const u = Math.min(1, d / D); return lip + Hh * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))); };
    const slope = d => { if (d >= D) return 0; const u = d / D, q = Math.sqrt(Math.max(1e-9, 1 - (1 - u) * (1 - u))); return Hh * (1 - u) / q / D; };
    const dFor = zz => { if (zz <= lip) return 0; if (zz >= depth) return Infinity; const t = (zz - lip) / Hh; return D * (1 - Math.sqrt(1 - t * t)); };
    return { depth, lip, D, z, slope, dFor };
  }

  // ---------------------------------------------------------------- triangulation helpers
  function pushT(out, A, B, C) { out.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]); }
  // earcut a region (outer + holes, 2D) at height z; up: normal +z
  function capRegion(out, outer, holes, z, up) {
    const flat = [], hi = []; for (const p of outer) flat.push(p[0], p[1]);
    for (const h of holes) { hi.push(flat.length / 2); for (const p of h) flat.push(p[0], p[1]); }
    const idx = earcut(flat, hi.length ? hi : null);
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2], ax = flat[2 * a], ay = flat[2 * a + 1], bx = flat[2 * b], by = flat[2 * b + 1], cx = flat[2 * c], cy = flat[2 * c + 1];
      const cr = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if ((ax === bx && ay === by) || (bx === cx && by === cy) || (ax === cx && ay === cy)) continue;
      const A = [ax, ay, z], B = [bx, by, z], C = [cx, cy, z];
      if ((cr > 0) === up) pushT(out, A, B, C); else pushT(out, A, C, B);
    }
  }
  // the same flat cap as a constrained Delaunay triangulation: keeps every outline point (earcut drops collinear ones
  // and makes doubled slivers on long, nearly straight runs, which left open edges in the flat back)
  function capCDT(out, outer, holes, z, up) {
    const xy = [], cons = [], loops = [outer, ...holes]; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const L of loops) { const i0 = xy.length / 2; for (const p of L) { xy.push(p[0], p[1]); if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } for (let i = 0; i < L.length; i++) cons.push([i0 + i, i0 + (i + 1) % L.length]); }
    const m = 5 + Math.max(x1 - x0, y1 - y0) * 0.1; xy.push(x0 - m, y0 - m, x1 + m, y0 - m * 1.07, x1 + m * 1.03, y1 + m, x0 - m * 1.05, y1 + m * 1.02);
    const XY = Float64Array.from(xy), del = new Delaunator(XY), con = new Constrainautor(del); for (const e of cons) con.constrainOne(e[0], e[1]);
    const Tr = del.triangles, Hh = del.halfedges, nt = Tr.length / 3, par = new Int8Array(nt).fill(-1), q = new Int32Array(nt); let qh = 0, qt = 0;
    for (let e = 0; e < Tr.length; e++) if (Hh[e] < 0) { const t = (e / 3) | 0; if (par[t] < 0) { par[t] = 0; q[qt++] = t; } }
    while (qh < qt) { const t = q[qh++]; for (let k = 0; k < 3; k++) { const e = 3 * t + k, op = Hh[e]; if (op < 0) continue; const u = (op / 3) | 0; if (par[u] >= 0) continue; par[u] = par[t] ^ (con.isConstrained(e) ? 1 : 0); q[qt++] = u; } }
    for (let t = 0; t < nt; t++) if (par[t] === 1) { const a = Tr[3 * t], b = Tr[3 * t + 1], c = Tr[3 * t + 2], A = [XY[2 * a], XY[2 * a + 1], z], Bp = [XY[2 * b], XY[2 * b + 1], z], C = [XY[2 * c], XY[2 * c + 1], z];
      if (up) pushT(out, A, C, Bp); else pushT(out, A, Bp, C); } // delaunator triangles are clockwise (y up)
  }
  // vertical wall along loop L from z0 to z1; solidLeft: the solid is to the left of the loop direction
  function wall(out, L, z0, z1, solidLeft) {
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], a0 = [a[0], a[1], z0], b0 = [b[0], b[1], z0], a1 = [a[0], a[1], z1], b1 = [b[0], b[1], z1];
      // outward (away from solid) normal is to the right of a->b when the solid is on the left
      if (solidLeft) { pushT(out, a0, b0, b1); pushT(out, a0, b1, a1); } else { pushT(out, a0, b1, b0); pushT(out, a0, a1, b1); }
    }
  }
  const ccw = L => area(L) > 0 ? L : L.slice().reverse();

  // ---------------------------------------------------------------- one letter
  // shape: bubble outline polys; pockets: [{ layers: [{ loop, z0, z1 }] }] (loops CCW, strictly nested)
  function letterMesh(shape, o, pockets, tex, prof) {
    const s = o.detail === 'draft' ? 1.0 : o.detail === 'fine' ? 0.32 : clamp(tex.id === 'smooth' ? 0.5 : tex.scale / 2, 0.38, 0.5);
    const sb = s * 0.75;
    // boundary: resampled outline, solid on the left (outer CCW, holes CW)
    // (each point nudged a hair (under 0.25 \u00b5m) off straight runs, so no three outline points are collinear for earcut or
    // the constrained triangulation; long straight runs of the cleaned outline otherwise trip its orientation tests)
    const wob = L => L.map((p, i) => { const a = L[(i + L.length - 1) % L.length], c = L[(i + 1) % L.length], tx = c[0] - a[0], ty = c[1] - a[1], l = Math.hypot(tx, ty) || 1, e = ((i * 7919) % 13 - 6) * 4e-5; return [p[0] - ty / l * e, p[1] + tx / l * e]; });
    const bnd = shape.map(P => ({ outer: wob(ccw(resample(P.outer, sb))), holes: P.holes.map(h => wob(ccw(resample(h, sb)).reverse())) }));
    const xy = [], zz = [], dd = [], cons = [], loops = [];
    const cell = s * 0.5, hashM = new Map(), key = (x, y) => Math.floor(x / cell) * 73856093 ^ Math.floor(y / cell) * 19349663;
    const addP = (x, y, d) => { const k = xy.length / 2; xy.push(x, y); dd.push(d); const h = key(x, y); let a = hashM.get(h); if (!a) hashM.set(h, a = []); a.push(k); return k; };
    const near = (x, y, r) => { const r2 = r * r, ci = Math.floor(x / cell), cj = Math.floor(y / cell), R = Math.ceil(r / cell);
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const l = hashM.get((ci + a) * 73856093 ^ (cj + b) * 19349663); if (l) for (const k of l) { const dx = xy[2 * k] - x, dy = xy[2 * k + 1] - y; if (dx * dx + dy * dy < r2) return true; } } return false; };
    for (const P of bnd) for (const L of [P.outer, ...P.holes]) { const i0 = xy.length / 2; for (const p of L) addP(p[0], p[1], 0); for (let i = 0; i < L.length; i++) cons.push([i0 + i, i0 + (i + 1) % L.length]); loops.push({ L, i0 }); }
    // interior: a staggered grid (exact distance to the outline); near the edge: rows following the outline, packed
    // tighter where the profile is steep. Every point keeps its exact distance d.
    const allL = []; for (const P of bnd) allL.push(P.outer, ...P.holes);
    const df = distField(allL, Math.max(1, s * 4)), bb = bboxOf(bnd);
    const levels = []; { let d = 0; for (let k = 0; k < 2000; k++) { const sl = prof.slope(d + 0.02); let step = clamp(s / Math.sqrt(1 + sl * sl), Math.max(0.035, s * 0.06), s); if (d === 0) step = Math.max(0.06, step); d += step; if (step >= s * 0.92 || d > prof.D) break; levels.push([d, step]); } }
    const bandEnd = levels.length ? levels[levels.length - 1][0] : 0;
    // inward normals at the outline points (solid on the left: rotate the averaged direction +90\u00b0)
    const NRM = loops.map(({ L }) => { const n = L.length; return L.map((b, i) => { const a = L[(i + n - 1) % n], c = L[(i + 1) % n]; let tx = c[0] - a[0], ty = c[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; return [-ty / tl, tx / tl]; }); });
    for (const [lv, step] of levels) {
      const thr = Math.min(0.42 * s, 0.6 * step);
      const tryP = (px, py) => { const dt = df.dist(px, py); if (Math.abs(dt - lv) > 0.3 * step + 1e-4) return; if (!near(px, py, thr)) addP(px, py, dt); }; // off = folded (tight convex turn)
      loops.forEach(({ L }, li) => { const n = L.length, N = NRM[li];
        for (let i = 0; i < n; i++) { const b = L[i], c = L[(i + 1) % n], nb = N[i], nc = N[(i + 1) % n];
          tryP(b[0] + nb[0] * lv, b[1] + nb[1] * lv);
          // fan out round inside corners: the rows spread there, so fill between the two rays
          const gap = Math.hypot(c[0] + nc[0] * lv - b[0] - nb[0] * lv, c[1] + nc[1] * lv - b[1] - nb[1] * lv), m = Math.ceil(gap / s);
          for (let k = 1; k < m; k++) { const t = k / m; let nx = nb[0] + (nc[0] - nb[0]) * t, ny = nb[1] + (nc[1] - nb[1]) * t; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
            tryP(b[0] + (c[0] - b[0]) * t + nx * lv, b[1] + (c[1] - b[1]) * t + ny * lv); }
        } });
    }
    const gs = s, gh = gs * Math.sqrt(3) / 2;
    gridInside(allL, bb, gs, gh, gs / 2, (x, y) => { const dt = df.dist(x, y); if (dt < bandEnd + 0.45 * s) return; if (!near(x, y, 0.45 * s)) addP(x, y, dt); });
    const rings = levels.length;
    // four frame points well outside the letter, so no outline edge lies on the triangulation's convex hull (long
    // straight hull runs of nearly collinear points make the constraint insertion fail); their triangles are outside
    { const m = 5 + Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * 0.1; for (const [x, y] of [[bb.x0 - m, bb.y0 - m], [bb.x1 + m, bb.y0 - m * 1.07], [bb.x1 + m * 1.03, bb.y1 + m], [bb.x0 - m * 1.05, bb.y1 + m * 1.02]]) addP(x, y, 0); }
    const np = xy.length / 2, XY = Float64Array.from(xy);
    const del = new Delaunator(XY), con = new Constrainautor(del);
    for (const e of cons) con.constrainOne(e[0], e[1]);
    // inside = odd number of outline crossings from the hull (flood fill across non-constrained edges)
    const Tr = del.triangles, Hh = del.halfedges, nt = Tr.length / 3, par = new Int8Array(nt).fill(-1), q = new Int32Array(nt); let qh = 0, qt = 0;
    for (let e = 0; e < Tr.length; e++) if (Hh[e] < 0) { const t = (e / 3) | 0; if (par[t] < 0) { par[t] = con.isConstrained(e) ? 1 : 0; q[qt++] = t; } }
    while (qh < qt) { const t = q[qh++]; for (let k = 0; k < 3; k++) { const e = 3 * t + k, op = Hh[e]; if (op < 0) continue; const u = (op / 3) | 0; if (par[u] >= 0) continue; par[u] = par[t] ^ (con.isConstrained(e) ? 1 : 0); q[qt++] = u; } }
    // heights and normals
    const P3 = new Float64Array(np * 3); for (let k = 0; k < np; k++) { P3[3 * k] = XY[2 * k]; P3[3 * k + 1] = XY[2 * k + 1]; P3[3 * k + 2] = prof.z(dd[k]); }
    const tris = []; for (let t = 0; t < nt; t++) if (par[t] === 1) tris.push(Tr[3 * t], Tr[3 * t + 2], Tr[3 * t + 1]); // delaunator is clockwise (y up): flip to face +z
    // soften the creases where the rounding meets over the middle of a stroke (distance fields fold there): a few
    // passes of neighbor averaging on the inner part only, so the edge profile stays exact
    { const nb = Array.from({ length: np }, () => []); for (let i = 0; i < tris.length; i += 3) { const a = tris[i], b = tris[i + 1], c = tris[i + 2]; nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b); }
      const w = new Float64Array(np); for (let k = 0; k < np; k++) w[k] = smooth01((dd[k] - prof.D * 0.35) / (prof.D * 0.4));
      const Z = new Float64Array(np); for (let it = 0; it < (o.detail === 'draft' ? 6 : 14); it++) { for (let k = 0; k < np; k++) { if (!w[k]) { Z[k] = P3[3 * k + 2]; continue; } let sm = 0; const l = nb[k]; for (const j of l) sm += P3[3 * j + 2]; Z[k] = l.length ? P3[3 * k + 2] + (sm / l.length - P3[3 * k + 2]) * 0.6 * w[k] : P3[3 * k + 2]; } for (let k = 0; k < np; k++) P3[3 * k + 2] = Z[k]; } }
    if (tex.depth > 0) {
      const N = new Float64Array(np * 3);
      for (let i = 0; i < tris.length; i += 3) { const a = tris[i] * 3, b = tris[i + 1] * 3, c = tris[i + 2] * 3;
        const ux = P3[b] - P3[a], uy = P3[b + 1] - P3[a + 1], uz = P3[b + 2] - P3[a + 2], vx = P3[c] - P3[a], vy = P3[c + 1] - P3[a + 1], vz = P3[c + 2] - P3[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const v of [a, b, c]) { N[v] += nx; N[v + 1] += ny; N[v + 2] += nz; } }
      const fadeW = Math.max(0.5, Math.min(1.6, prof.D * 0.35));
      for (let k = 0; k < np; k++) { if (dd[k] <= 0) continue;
        const f = smooth01(dd[k] / fadeW); if (f <= 0) continue;
        let nx = N[3 * k], ny = N[3 * k + 1], nz = N[3 * k + 2]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const x = P3[3 * k], y = P3[3 * k + 1], z = P3[3 * k + 2], h = tex.fn(x, y, z, tex.scale), disp = tex.depth * (h - tex.bias) * f;
        P3[3 * k] = x + nx * disp; P3[3 * k + 1] = y + ny * disp; P3[3 * k + 2] = Math.max(prof.lip * 0.5, z + nz * disp); }
    }
    const out = [];
    const V = k => [P3[3 * k], P3[3 * k + 1], P3[3 * k + 2]];
    for (let i = 0; i < tris.length; i += 3) pushT(out, V(tris[i]), V(tris[i + 1]), V(tris[i + 2]));
    // lip wall from the back up to the front's edge (boundary points sit at z = lip, never displaced)
    for (const { L } of loops) wall(out, L, 0, prof.lip, true);
    // back face with the pocket openings cut in
    for (const P of bnd) {
      const own = pockets.filter(pk => pip(pk.layers[0].loop[0], P.outer) && !P.holes.some(h => pip(pk.layers[0].loop[0], h)));
      capCDT(out, P.outer, [...P.holes, ...own.map(pk => pk.layers[0].loop.slice().reverse())], 0, false);
    }
    for (const pk of pockets) pocketMesh(out, pk);
    return { p: Float64Array.from(out), points: np, rings, spacing: s };
  }
  function pocketMesh(out, pk) {
    const Ls = pk.layers;
    for (let i = 0; i < Ls.length; i++) {
      const { loop, z0, z1 } = Ls[i];
      wall(out, loop, z0, z1, false); // the void is inside the loop: solid on the right of a CCW loop
      const nxt = Ls[i + 1];
      if (!nxt) { capRegion(out, loop, [], z1, false); break; } // ceiling faces down into the pocket
      if (Math.abs(area(nxt.loop)) > Math.abs(area(loop))) capRegion(out, nxt.loop, [loop.slice().reverse()], z1, true); // ledge (wider chamber above): faces up
      else capRegion(out, loop, [nxt.loop.slice().reverse()], z1, false); // narrower above: shoulder faces down
    }
  }

  // ---------------------------------------------------------------- mounts
  // Each mount kind gives pocket templates centered at (0, 0): { layers: [{ loop, z0, z1 }], need } where need is the
  // front height the letter must have over the pocket.
  function keyholeTpl() {
    const re = 4.75, ws = 2.3, Ls = 9, z1 = 2.2, z2 = 5.6;
    const A = union([circle(0, 0, re), stadium(0, 0, Ls, ws)], true)[0].outer, B = union([circle(0, 0, re + 0.6), stadium(0, 0, Ls, re - 0.2)], true)[0].outer;
    return { kind: 'keyhole', layers: [{ loop: ccw(A), z0: 0, z1 }, { loop: ccw(B), z0: z1, z1: z2 }], depth: z2, label: 'keyhole slot (screw or nail head up to 8.5 mm, shank up to 4 mm)' };
  }
  function sawtoothTpl() {
    const w = 36, h = 7, pitch = 3, tooth = 1.6, L = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2]];
    const n = Math.round(w / pitch); for (let i = 1; i < n * 2; i++) { const x = w / 2 - i * (w / (2 * n)); L.push([x, i % 2 ? h / 2 + tooth : h / 2]); }
    L.push([-w / 2, h / 2]);
    return { kind: 'sawtooth', layers: [{ loop: ccw(L), z0: 0, z1: 3.6 }], depth: 3.6, label: 'sawtooth hanger recess (hang on a nail; the teeth let it sit level)' };
  }
  function stripTpl(o) { const w = o.stripW + 2, h = o.stripH + 2; return { kind: 'strip', layers: [{ loop: ccw(roundRect(0, 0, w, h, 2)), z0: 0, z1: 0.8 }], depth: 0.8, label: `adhesive strip pad (${o.stripW} \u00d7 ${o.stripH} mm strip)` }; }
  function magnetTpl(o) { const r = o.magnetD / 2 + o.tolerance; return { kind: 'magnet', layers: [{ loop: ccw(circle(0, 0, r)), z0: 0, z1: o.magnetH + 0.2 }], depth: o.magnetH + 0.2, label: `magnet pocket (${o.magnetD} \u00d7 ${o.magnetH} mm magnet)` }; }
  // the shelf stand: a socket on the back, sized for the stand's tab with the tolerance on every side
  function standSpec(o, H) {
    const t = clamp(o.standT || 3.2, 2, 6), tol = clamp(o.tolerance, 0, 0.8), tab = clamp(H * 0.22, 10, 22), Ds = 5;
    return { t, tol, tab, socketW: t + 2 * tol, socketL: tab + 2 * tol, socketD: Ds, tabD: Ds - 0.4, lean: clamp(o.lean, 2, 25) };
  }
  function socketTpl(sp) { return { kind: 'socket', layers: [{ loop: ccw(roundRect(0, 0, sp.socketW, sp.socketL, 0.3)), z0: 0, z1: sp.socketD }], depth: sp.socketD, label: 'stand socket' }; }
  function translateTpl(tpl, x, y) { return { kind: tpl.kind, depth: tpl.depth, at: [x, y], layers: tpl.layers.map(l => ({ loop: l.loop.map(p => [p[0] + x, p[1] + y]), z0: l.z0, z1: l.z1 })) }; }
  // find a spot for each template near its target (fractions of the letter box), inside the part of the letter thick
  // enough over it, away from the edge and from pockets already placed.
  const biggest = tpl => tpl.layers.reduce((a, l) => Math.abs(area(l.loop)) > Math.abs(area(a)) ? l.loop : a, tpl.layers[0].loop);
  function placePockets(shape, prof, tex, wants) {
    const bb = bboxOf(shape), placed = [], notes = [], skin = 1.4;
    const name = k => ({ socket: 'stand socket', strip: 'adhesive strip pad', magnet: 'magnet pocket', keyhole: 'keyhole slot', sawtooth: 'sawtooth recess' }[k] || k);
    for (const w of wants) {
      let got = null, why = 'no room', tpl = null;
      for (const t of [w.tpl, w.alt].filter(Boolean)) {
        tpl = t; const need = tpl.depth + skin + tex.depth * Math.max(tex.bias, 0.3), inset = Math.max(1.6, prof.dFor(need));
        if (!isFinite(inset)) { why = 'too thin'; continue; }
        let ok = cOffset(shape, -inset, 0.02);
        for (const pk of placed) ok = diff(ok, cOffset([{ outer: biggest(pk), holes: [] }], 2.5, 0.05));
        if (!ok.length) continue;
        const big = { outer: biggest(tpl), holes: [] }, tx = lerp(bb.x0, bb.x1, w.fx), ty = w.fy == null ? null : lerp(bb.y0, bb.y1, w.fy), cands = [];
        const g = Math.max(0.8, Math.min(2, (bb.x1 - bb.x0) / 60)), okL = loopsOf(ok);
        gridInside(okL, bb, g, g, 0, (x, y) => cands.push([x, y, (x - tx) ** 2 * (w.wx || 1) + (ty == null ? (y - bb.y0) * (w.wy || 1) : (y - ty) ** 2 * (w.wy || 1))]));
        cands.sort((a, b) => a[2] - b[2]);
        for (let i = 0; i < cands.length && i < 400; i++) { const [x, y] = cands[i]; if (Math.abs(polysArea(diff(shift([big], x, y), ok))) < 1e-3) { got = [x, y]; break; } }
        if (got) break;
      }
      if (!got) { notes.push(`${why === 'too thin' ? 'too thin' : 'no room'} for a ${name(w.tpl.kind)}`); continue; }
      placed.push(translateTpl(tpl, got[0], got[1]));
    }
    return { placed, notes };
  }
  function mountWants(o, shape, H, sp) {
    const bb = bboxOf(shape), W = bb.x1 - bb.x0, m = o.mount;
    if (m === 'keyhole') { const two = o.keyholes === 2 || o.keyholes === '2' || (o.keyholes !== 1 && o.keyholes !== '1' && W > Math.max(60, H * 0.95)); const t = keyholeTpl();
      return two ? [{ tpl: t, fx: 0.27, fy: 0.68, wy: 0.5 }, { tpl: t, fx: 0.73, fy: 0.68, wy: 0.5 }] : [{ tpl: t, fx: 0.5, fy: 0.66, wy: 0.5 }]; }
    if (m === 'sawtooth') return [{ tpl: sawtoothTpl(), fx: 0.5, fy: 0.72, wy: 0.3 }];
    if (m === 'strip') { const t = stripTpl(o), r = { ...t, layers: t.layers.map(l => ({ ...l, loop: ccw(l.loop.map(p => [-p[1], p[0]])) })) }; return [{ tpl: t, alt: r, fx: 0.5, fy: 0.5, wy: 1 }]; }
    if (m === 'magnet') { const t = magnetTpl(o), n = clamp(Math.round(o.magnets || 2), 1, 4); return n === 1 ? [{ tpl: t, fx: 0.5, fy: 0.5 }] : Array.from({ length: n }, (_, i) => ({ tpl: t, fx: n === 2 ? (i ? 0.72 : 0.28) : (i + 0.5) / n, fy: n > 2 && i % 2 ? 0.62 : 0.4 })); }
    if (m === 'stand') return [{ tpl: socketTpl(sp), fx: 0.5, fy: null, wx: 4, wy: 1.2 }];
    return [];
  }
  // The kickstand: a triangle in the plane across the letter (p up the back from the floor contact, q behind the back),
  // printed flat, with the tab that slides into the socket. lean: how far the letter tips back (degrees).
  function standPolys(sp, socketP0, letterH) {
    const a = sp.lean * Math.PI / 180, top = socketP0 + sp.tol + sp.tab + 4, foot = clamp(letterH * 0.42, 24, 90);
    const A = [0, 0], B = [top, 0], C = [foot * Math.sin(a), foot * Math.cos(a)];
    // p along the back, q behind it: the triangle A (floor, against the letter), B (up the back), C (floor, behind)
    let tri = union([[A, C, B]], true); tri = cOffset(cOffset(tri, -1.2, 0.02), 1.2, 0.02);
    const win = cOffset(cOffset(union([[A, C, B]], true), -6, 0.02), 2, 0.02);
    const p0 = socketP0 + sp.tol, tab = [[p0, 0.6], [p0 + sp.tab, 0.6], [p0 + sp.tab, -sp.tabD], [p0, -sp.tabD]];
    let poly = union([...loopsOf(tri), ccw(tab)], true); // same winding as the triangle: a clockwise tab cancelled the overlap (nonzero 0), leaving the tab hanging by its two corners
    if (win.length && Math.abs(polysArea(win)) > 40) poly = diff(poly, win);
    return { poly, top, foot, C };
  }
  function extrude(polys, z0, z1) {
    const out = [];
    for (const P of polys) { const outer = ccw(P.outer), holes = P.holes.map(h => ccw(h).reverse());
      capRegion(out, outer, holes, z1, true); capRegion(out, outer, holes, z0, false);
      wall(out, outer, z0, z1, true); for (const h of holes) wall(out, h, z0, z1, true); }
    return Float64Array.from(out);
  }

  // ---------------------------------------------------------------- build
  function options(o) { const r = { ...DEFAULTS, ...(o || {}) }; r.height = clamp(+r.height || 80, 15, 400); r.thickness = clamp(+r.thickness || 14, 3, 80); r.inflate = clamp(+r.inflate, 0, 1); r.tolerance = clamp(+r.tolerance, 0, 0.8); return r; }
  function chars(text) { return [...String(text || '')].filter(c => !/\s/.test(c)).slice(0, 40); }
  function letter(ch, o, opt) {
    opt = opt || {};
    const g = glyphPolys(o.font, ch, o.height); if (!g || !g.polys.length) return null;
    const bo = bubbleOutline(g.polys, o); if (!bo.shape.length) return null;
    // local frame: bottom-left of the outline at (0, 0)
    let bb = bboxOf(bo.shape); const shape = shift(bo.shape, -bb.x0, -bb.y0); bb = bboxOf(shape);
    const dMax = maxInscribed(shape, 1), prof = profile(o, dMax), tex = texParams(o), sp = standSpec(o, bb.y1);
    const { placed, notes } = placePockets(shape, prof, tex, mountWants(o, shape, o.height, sp));
    const m = letterMesh(shape, o, placed, tex, prof);
    const socket = placed.find(p => p.kind === 'socket');
    let stand = null;
    if (o.mount === 'stand' && socket) {
      const y0 = socket.at[1] - sp.socketL / 2; // socket bottom edge, from the letter's lowest point (y = 0)
      const st = standPolys(sp, y0, bb.y1);
      stand = { polys: st.poly, p: extrude(st.poly, 0, sp.t), socketAt: socket.at, socketY0: y0, top: st.top, foot: st.foot, spec: sp };
    }
    return { ch, shape, mesh: m.p, size: [bb.x1, bb.y1, prof.depth], prof: { depth: prof.depth, lip: prof.lip, D: prof.D, dMax }, pockets: placed, notes, stand, counters: bo.counters, narrowed: bo.narrowed, points: m.points, spacing: m.spacing };
  }
  // shelf-pack parts in reading order on the bed; returns offsets and plate index
  function arrange(items, bed, gap) {
    const W = bed[0] - 2 * gap, D = bed[1] - 2 * gap, pos = []; let x = 0, y = 0, rowH = 0, plate = 0;
    for (const it of items) {
      if (x > 0 && x + it.w > W) { x = 0; y += rowH + gap; rowH = 0; }
      if (y > 0 && y + it.h > D) { plate++; x = 0; y = 0; rowH = 0; }
      pos.push({ x: gap + x, y: bed[1] - gap - y - it.h, plate }); x += it.w + gap; rowH = Math.max(rowH, it.h);
    }
    return pos;
  }
  function moveP(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  function colorFor(o, i) { const c = o.colors && o.colors[i]; if (c && /^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase(); return PALETTE[i % PALETTE.length].hex; }
  function build(o, onProgress) {
    o = options(o);
    const list = chars(o.text), letters = [], warnings = [], skipped = [];
    list.forEach((ch, i) => {
      if (!supported(o.font, ch)) { skipped.push(ch); return; }
      const L = letter(ch, o); if (!L) { skipped.push(ch); return; }
      L.index = i; L.color = colorFor(o, i); letters.push(L);
      for (const n of L.notes) warnings.push(`${ch}: ${n}${o.mount === 'stand' ? '; it prints without a stand' : ''}.`);
      if (onProgress) onProgress((letters.length) / list.length);
    });
    if (skipped.length) warnings.push(`Skipped ${[...new Set(skipped)].map(c => `"${c}"`).join(', ')}: not in the ${FONTS[o.font] ? FONTS[o.font].label : ''} style.`);
    if (letters.some(L => L.narrowed)) warnings.push('Some counters (the holes in letters like O, A and D) were narrowed to stay open at this inflation.');
    // parts: letters then stands
    const parts = [];
    for (const L of letters) parts.push({ kind: 'letter', name: `${L.ch === L.ch.toLowerCase() && L.ch !== L.ch.toUpperCase() ? 'lower_' : ''}${/[A-Za-z0-9]/.test(L.ch) ? L.ch : 'symbol' + L.index}_${L.index + 1}`, ch: L.ch, p: L.mesh, w: L.size[0], h: L.size[1], color: L.color, L });
    for (const L of letters) if (L.stand) { const bb = Core.bbox(L.stand.p); parts.push({ kind: 'stand', name: `stand_${/[A-Za-z0-9]/.test(L.ch) ? L.ch : 'symbol'}_${L.index + 1}`, p: moveP(L.stand.p, -bb.min[0], -bb.min[1]), w: bb.max[0] - bb.min[0], h: bb.max[1] - bb.min[1], color: L.color, L }); }
    const pos = arrange(parts, o.bed, o.gap);
    parts.forEach((pt, i) => { pt.plate = pos[i].plate; pt.offset = [pos[i].x, pos[i].y]; pt.p = moveP(pt.p, pos[i].x, pos[i].y); });
    const plates = Math.max(0, ...parts.map(pt => pt.plate)) + 1;
    if (plates > 1) warnings.push(`The parts fill ${plates} build plates at this size.`);
    let tris = 0; for (const pt of parts) tris += pt.p.length / 9;
    const tex = texParams(o);
    return { parts: parts.map(pt => ({ kind: pt.kind, name: pt.name, ch: pt.ch, p: pt.p, color: pt.color, plate: pt.plate, offset: pt.offset, size: pt.kind === 'letter' ? pt.L.size : [pt.w, pt.h, pt.L.stand.spec.t] })),
      letters: letters.map(L => ({ ch: L.ch, size: L.size, color: L.color, prof: L.prof, pockets: L.pockets.map(p => ({ kind: p.kind, at: p.at, depth: p.depth })), stand: L.stand ? { socketAt: L.stand.socketAt, socketY0: L.stand.socketY0, top: L.stand.top, foot: L.stand.foot, spec: L.stand.spec } : null, counters: L.counters, points: L.points, spacing: L.spacing })),
      warnings, plates, stats: { tris, letters: letters.length, texture: tex.id, texScale: tex.scale, texDepth: tex.depth, mount: o.mount, height: o.height, depth: letters.length ? Math.max(...letters.map(L => L.prof.depth)) : 0 },
      options: o };
  }
  // the letters standing up in a row with their stands in place (for the preview only); Z up, front toward -Y
  function displayScene(res) {
    const o = res.options, out = []; let x = 0;
    const lean = (o.lean || 10) * Math.PI / 180, ca = Math.cos(lean), sa = Math.sin(lean);
    const map = (lx, ly, lz) => { const Wy = -lz, Wz = ly; return [lx, Wy * ca + Wz * sa, -Wy * sa + Wz * ca]; };
    for (const L of res.letters) {
      const pt = res.parts.find(q => q.kind === 'letter' && q.ch === L.ch && Math.abs(q.size[0] - L.size[0]) < 1e-9 && !out.some(u => u.src === q));
      if (!pt) continue;
      const p = new Float64Array(pt.p.length), ox = pt.offset[0], oy = pt.offset[1], useLean = !!L.stand;
      for (let i = 0; i < p.length; i += 3) { const lx = pt.p[i] - ox + x, ly = pt.p[i + 1] - oy, lz = pt.p[i + 2]; const w = useLean ? map(lx, ly, lz) : [lx, -lz, ly]; p[i] = w[0]; p[i + 1] = w[1]; p[i + 2] = w[2]; }
      out.push({ src: pt, name: pt.name, p, color: pt.color, kind: 'letter' });
      if (L.stand) {
        const sp = res.parts.find(q => q.kind === 'stand' && q.name.endsWith('_' + (pt.name.split('_').pop())));
        if (sp) {
          // stand part coordinates: x = p - minp, y = q - minq (flat), z = 0..t; rebuild the p, q from the stored offset
          const sx = L.stand.socketAt[0] + x - L.stand.spec.t / 2, q = new Float64Array(sp.p.length);
          const bbS = standBounds(L, o);
          for (let i = 0; i < q.length; i += 3) {
            const pp = sp.p[i] - sp.offset[0] + bbS.minp, qq = sp.p[i + 1] - sp.offset[1] + bbS.minq, e = sp.p[i + 2];
            const w = map(sx + e, pp, -qq); q[i] = w[0]; q[i + 1] = w[1]; q[i + 2] = w[2];
          }
          out.push({ src: sp, name: sp.name, p: q, color: sp.color, kind: 'stand' });
        }
      }
      x += L.size[0] + 8;
    }
    // lift everything so the lowest point is on the floor (z = 0)
    let zmin = Infinity; for (const m of out) for (let i = 2; i < m.p.length; i += 3) if (m.p[i] < zmin) zmin = m.p[i];
    for (const m of out) for (let i = 2; i < m.p.length; i += 3) m.p[i] -= zmin;
    return out.map(m => ({ name: m.name, p: m.p, color: m.color, kind: m.kind }));
  }
  function standBounds(L, o) { const sp = L.stand.spec, st = standPolys(sp, L.stand.socketY0, L.size[1]); const bb = bboxOf(st.poly); return { minp: bb.x0, minq: bb.y0 }; }

  // per-corner normals for a triangle soup: faces round a vertex are averaged when within `crease` degrees of the
  // corner's own face, so the puffy surface shades smooth and the flat back keeps its sharp edge (preview only)
  function smoothNormals(p, crease) {
    const n = p.length / 9, FN = new Float32Array(n * 3), cosT = Math.cos((crease || 50) * Math.PI / 180), map = new Map(), Q = 1e4, key = i => Math.round(p[i] * Q) + ',' + Math.round(p[i + 1] * Q) + ',' + Math.round(p[i + 2] * Q);
    const vid = new Int32Array(n * 3);
    for (let t = 0; t < n; t++) { const b = t * 9; const ux = p[b + 3] - p[b], uy = p[b + 4] - p[b + 1], uz = p[b + 5] - p[b + 2], vx = p[b + 6] - p[b], vy = p[b + 7] - p[b + 1], vz = p[b + 8] - p[b + 2];
      let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1; FN[3 * t] = x / l; FN[3 * t + 1] = y / l; FN[3 * t + 2] = z / l;
      for (let c = 0; c < 3; c++) { const k = key(b + 3 * c); let id = map.get(k); if (id === undefined) map.set(k, id = map.size); vid[3 * t + c] = id; } }
    const fan = Array.from({ length: map.size }, () => []); for (let i = 0; i < n * 3; i++) fan[vid[i]].push((i / 3) | 0);
    const out = new Float32Array(n * 9);
    for (let i = 0; i < n * 3; i++) { const t = (i / 3) | 0, f = fan[vid[i]]; let x = 0, y = 0, z = 0;
      for (const u of f) { const d = FN[3 * t] * FN[3 * u] + FN[3 * t + 1] * FN[3 * u + 1] + FN[3 * t + 2] * FN[3 * u + 2]; if (d >= cosT) { x += FN[3 * u]; y += FN[3 * u + 1]; z += FN[3 * u + 2]; } }
      const l = Math.hypot(x, y, z) || 1; out[3 * i] = x / l; out[3 * i + 1] = y / l; out[3 * i + 2] = z / l; }
    return out;
  }

  // ---------------------------------------------------------------- exports
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  function export3MF(res, o) {
    o = o || {}; const n = res.plates, bed = res.options.bed, fuzzy = res.options.fuzzySkin !== false && res.options.texture === 'fuzzy';
    const cols = []; for (const pt of res.parts) if (!cols.includes(pt.color)) cols.push(pt.color);
    const objects = [], plates = Array.from({ length: n }, () => []);
    res.parts.forEach(pt => {
      const org = T.bambuPlateOrigin(pt.plate, n, bed[0], bed[1]);
      const ob = { name: pt.name, p: moveP(pt.p, org[0], org[1]), color: pt.color, extruder: cols.indexOf(pt.color) + 1 };
      if (fuzzy && pt.kind === 'letter') ob.settings = { ...SLICER_FUZZY };
      plates[pt.plate].push(objects.length); objects.push(ob);
    });
    return T.threeMF(objects, { title: o.name || 'Bubble letters', plates, bambu: o.bambu === undefined ? 'A1' : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function readme(res, name) {
    const s = res.stats, o = res.options, L = [`Expressarte bubble letters: ${name}`, '',
      `Letters: ${res.letters.map(l => l.ch).join(' ')} \u00b7 ${o.height} mm tall \u00b7 up to ${s.depth.toFixed(1)} mm deep \u00b7 texture: ${TEXTURES[s.texture].label}${s.texDepth ? ` (${s.texScale} mm, ${s.texDepth} mm deep)` : ''}`,
      `Mount: ${MOUNTS[o.mount] || 'None'}`, '', 'Parts (color):'];
    res.parts.forEach(pt => L.push(`  ${pt.name}: ${pt.color}${pt.kind === 'stand' ? ' (stand)' : ''}`));
    L.push('', 'Printing', '  - Print every letter with its flat back on the bed. No supports needed (mount pockets have flat bridged ceilings).',
      '  - 0.2 mm layers, 3 walls, 10 to 15% gyroid infill. Letters are solid shells, so they print fast and light.');
    if (s.texture === 'fuzzy') L.push('  - Fuzzy felt look: the 3MF turns on the slicer\'s fuzzy skin (outer walls only, 0.3 mm thickness, 0.8 mm point distance) for each letter.',
      '    Using the STLs instead: in your slicer, select the letters, open Object settings and set Fuzzy skin to "Outer wall" (or Contour), thickness 0.3, point distance 0.8.');
    if (o.mount === 'stand') { const sp = res.letters.find(l => l.stand); if (sp) L.push(`  - Stands print flat. Push each stand's tab straight into the slot on the back of its letter; the slot is ${sp.stand.spec.socketW.toFixed(2)} \u00d7 ${sp.stand.spec.socketL.toFixed(2)} mm for a ${sp.stand.spec.t} mm tab (${sp.stand.spec.tol} mm clearance a side). The letter leans back ${sp.stand.spec.lean}\u00b0.`,
      '    Too tight? Rebuild with more tolerance. Too loose? Less, or add a drop of glue.'); }
    if (o.mount === 'keyhole') L.push('  - Keyhole slots: drive a screw or nail so its head stands about 3 mm off the wall, slip the letter over it and slide it down.');
    if (o.mount === 'sawtooth') L.push('  - Sawtooth recess: hang it on a nail; the teeth hold it level.');
    if (o.mount === 'strip') L.push(`  - Adhesive strip pad: a shallow ${o.stripW} \u00d7 ${o.stripH} mm recess locates a removable mounting strip.`);
    if (o.mount === 'magnet') L.push(`  - Magnet pockets: ${o.magnetD} \u00d7 ${o.magnetH} mm magnets press in from the back (${o.tolerance} mm clearance); a drop of glue keeps them in.`);
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Letter styles use SIL Open Font License fonts (Sniglet, Titan One, Coiny, Chango, Modak).', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, o) {
    o = o || {}; const name = o.name || 'Bubble letters', base = safe(o.fileBase || name.toLowerCase()) || 'bubble_letters';
    const list = [{ name: `${base}.3mf`, data: export3MF(res, o) }];
    res.parts.forEach((pt, i) => list.push({ name: `stl/${String(i + 1).padStart(2, '0')}_${safe(pt.name)}.stl`, data: new Uint8Array(Core.writeSTL(pt.p, pt.name)) }));
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }

  const api = { DEFAULTS, LIMITS, PALETTE, TEXTURES, MOUNTS, SLICER_FUZZY, FONTS, build, letter, smoothNormals, export3MF, files, readme, displayScene, texParams, profile, standSpec, standPolys, bubbleOutline, glyphPolys, supported, chars, arrange, TEX, _dbg: { cOffset, despike, diff, union, polysArea, inradius, keyholeTpl, sawtoothTpl, magnetTpl, socketTpl, bboxOf } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPBubble = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
