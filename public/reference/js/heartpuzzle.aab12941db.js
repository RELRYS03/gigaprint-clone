/* Expressarte heart keychain puzzle: a heart split into N interlocking pieces.
   Every piece includes part of the outer edge and a reinforced key-ring hole,
   and each piece can carry a raised or engraved name. Two-color Bambu 3MF. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);

  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    count: 10, size: 110, thick: 3.2, clear: 0.25, hole: 4.5, round: 0.5,
    raise: 0.8, style: 'raised', font: 'round', names: '',
    cut: 'classic', edge: 'rounded', orient: 'heart', autoSize: true, border: false, pattern: 'none', icon: 'none', alt: false, look: 'classic',
    colors: { base: PZ.pink, text: PZ.ink, alt: PZ.lavender },
    bed: [256, 256], bambu: 'A1', detail: 'hd', seed: 1, gap: 5, view: 'assembled'
  };
  // minCap: smallest letter (cap) height we call readable on a keychain; maxCap: the biggest a name grows.
  // goodCap: the letter height auto size grows the heart for.
  const LIMITS = { minCount: 4, maxCount: 16, minSize: 60, maxSize: 250, freeCount: 4, maxName: 18, minCap: 4, goodCap: 4.5, maxCap: 9 };
  const CUTS = { classic: 'Classic knobs', wavy: 'Smooth waves', geometric: 'Geometric dovetails' };
  const EDGES = { flat: 'Flat', rounded: 'Rounded', beveled: 'Beveled', puffy: 'Puffy' };
  const PATTERNS = { none: 'Smooth', dots: 'Dots', hearts: 'Little hearts', stripes: 'Stripes', hammered: 'Hammered' };
  const ICONS = { none: 'None', heart: 'Heart', star: 'Star' };
  // Look presets: a complete style in one click. Every look keeps the names fitting (the fitter accounts for the
  // edge, the border, the icon and the font), so presets only change how the set looks.
  const LOOKS = [
    { id: 'classic', label: 'Classic', cut: 'classic', edge: 'rounded', orient: 'heart', autoSize: true, border: false, pattern: 'none', icon: 'none', font: 'round', alt: false, colors: { base: '#C8102E', text: '#F7F7F2' } },
    { id: 'sweet', label: 'Sweetheart', cut: 'wavy', edge: 'puffy', border: false, pattern: 'hearts', icon: 'heart', font: 'soft', alt: false, colors: { base: '#E891B0', text: '#C8102E' } },
    { id: 'modern', label: 'Modern', cut: 'geometric', edge: 'beveled', border: false, pattern: 'stripes', icon: 'none', font: 'wide', alt: false, colors: { base: '#1A1A1A', text: '#D4A72C' } },
    { id: 'framed', label: 'Framed', cut: 'classic', edge: 'rounded', border: true, pattern: 'dots', icon: 'star', font: 'chunky', alt: false, colors: { base: '#4A90D9', text: '#F7F7F2' } },
    { id: 'hammered', label: 'Hammered', cut: 'geometric', edge: 'beveled', border: false, pattern: 'hammered', icon: 'none', font: 'chunky', alt: false, colors: { base: '#D4A72C', text: '#1A1A1A' } },
    { id: 'twotone', label: 'Two-tone', cut: 'wavy', edge: 'rounded', border: false, pattern: 'none', icon: 'heart', font: 'round', alt: true, colors: { base: '#C8102E', alt: '#E891B0', text: '#F7F7F2' } }
  ];
  const PALETTE = [
    { name: 'Red', hex: '#C8102E' }, { name: 'White', hex: '#F7F7F2' }, { name: 'Black', hex: '#1A1A1A' },
    { name: 'Gold', hex: '#D4A72C' }, { name: 'Pink', hex: '#E891B0' }, { name: 'Sky', hex: '#4A90D9' },
    { name: 'Forest', hex: '#1E7B46' }, { name: 'Orange', hex: '#E07A3A' }
  ];
  const SAMPLE_NAMES = ['Alex', 'Sam', 'Riley', 'Jordan', 'Casey', 'Quinn', 'Avery', 'Jamie', 'Reese', 'Drew',
    'Morgan', 'Parker', 'Cameron', 'Rowan', 'Skyler', 'Hayden'];

  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    o.count = Math.round(Math.max(LIMITS.minCount, Math.min(LIMITS.maxCount, +o.count || DEFAULTS.count)));
    o.size = Math.max(LIMITS.minSize, Math.min(LIMITS.maxSize, +o.size || DEFAULTS.size));
    o.thick = Math.max(1.8, Math.min(8, +o.thick || DEFAULTS.thick));
    o.clear = Math.max(0.1, Math.min(0.6, +o.clear || DEFAULTS.clear));
    o.hole = Math.max(3, Math.min(8, +o.hole || DEFAULTS.hole));
    o.round = Math.max(0, Math.min(1.2, +o.round || 0));
    o.raise = Math.max(0.4, Math.min(1.6, +o.raise || DEFAULTS.raise));
    o.colors = Object.assign({}, DEFAULTS.colors, o.colors || {});
    if (!Bubble.FONTS[o.font]) o.font = 'round';
    if (o.style !== 'engraved') o.style = 'raised';
    if (!CUTS[o.cut]) o.cut = 'classic';
    if (!EDGES[o.edge]) o.edge = 'rounded';
    if (!PATTERNS[o.pattern]) o.pattern = 'none';
    if (!ICONS[o.icon]) o.icon = 'none';
    o.border = !!o.border; o.alt = !!o.alt; o.autoSize = o.autoSize !== false;
    if (o.orient !== 'hanging') o.orient = 'heart';
    o.seed = (o.seed >>> 0) || 1;
    o.names = parseNames(o.names, o.count);
    return o;
  }
  function parseNames(text, count) {
    const n = count || LIMITS.maxCount;
    const rows = (Array.isArray(text) ? text.map(String) : String(text || '').split(/\r?\n/)).map(s => s.replace(/\s+/g, ' ').trim()).slice(0, LIMITS.maxCount);
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = (rows[i] || '').slice(0, LIMITS.maxName);
      out.push(s);
    }
    return out;
  }
  function rawHeart(t) {
    const s = Math.sin(t);
    return [16 * s * s * s, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)];
  }
  function heartOutline(size, n) {
    n = n || 256;
    const raw = [];
    for (let i = 0; i < n; i++) raw.push(rawHeart(i / n * Math.PI * 2));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of raw) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const sc = size / (y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const out = raw.map(p => [(p[0] - cx) * sc, (p[1] - cy) * sc]);
    // t=0 is the top cleft; the parametric curve walks clockwise, so reverse
    // the rest and keep the cleft first so splits can start there.
    if (!areaCCW(out)) return [out[0]].concat(out.slice(1).reverse());
    return out;
  }
  function ringLen(L) {
    let s = 0;
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length];
      s += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return s;
  }
  function pointAt(L, dist) {
    const per = ringLen(L);
    let d = ((dist % per) + per) % per;
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= seg || i === L.length - 1) {
        const t = seg ? d / seg : 0;
        return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], i, t, next: (i + 1) % L.length };
      }
      d -= seg;
    }
    return { p: L[0].slice(), i: 0, t: 0, next: 1 };
  }
  function outlineArc(L, i0, t0, i1, t1) {
    // Walk CCW from split 0 to split 1, inclusive of both ends.
    const start = [
      L[i0][0] + (L[(i0 + 1) % L.length][0] - L[i0][0]) * t0,
      L[i0][1] + (L[(i0 + 1) % L.length][1] - L[i0][1]) * t0
    ];
    const end = [
      L[i1][0] + (L[(i1 + 1) % L.length][0] - L[i1][0]) * t1,
      L[i1][1] + (L[(i1 + 1) % L.length][1] - L[i1][1]) * t1
    ];
    const out = [start];
    let i = (t0 > 1e-9) ? (i0 + 1) % L.length : i0;
    const stop = (t1 < 1 - 1e-9) ? i1 : (i1 + 1) % L.length;
    let guard = 0;
    while (i !== stop && guard++ < L.length + 2) {
      out.push(L[i].slice());
      i = (i + 1) % L.length;
    }
    out.push(end);
    return out;
  }
  function centroid(L) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i], q = L[(i + 1) % L.length], c = p[0] * q[1] - q[0] * p[1];
      a += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c;
    }
    if (Math.abs(a) < 1e-12) {
      let x = 0, y = 0;
      for (const p of L) { x += p[0]; y += p[1]; }
      return [x / L.length, y / L.length];
    }
    return [cx / (3 * a), cy / (3 * a)];
  }
  function tipIndex(L) {
    // Bottom tip: lowest y, then closest to x=0.
    let k = 0;
    for (let i = 1; i < L.length; i++) {
      if (L[i][1] < L[k][1] - 1e-9 || (Math.abs(L[i][1] - L[k][1]) < 1e-9 && Math.abs(L[i][0]) < Math.abs(L[k][0]))) k = i;
    }
    return k;
  }
  function distToRing(p, L) {
    let d = Infinity;
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      d = Math.min(d, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
    }
    return d;
  }
  function outerLen(poly, outline, tol) {
    const R = poly[0] && poly[0].outer;
    if (!R || R.length < 2) return 0;
    let s = 0;
    for (let i = 0; i < R.length; i++) {
      const a = R[i], b = R[(i + 1) % R.length];
      if (distToRing(a, outline) <= tol && distToRing(b, outline) <= tol) s += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return s;
  }
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  function distToSeg(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function edgeTabSpec(C, P, neighbors, outline, clear) {
    const len = Math.hypot(P[0] - C[0], P[1] - C[1]) || 1;
    const u = [(C[0] - P[0]) / len, (C[1] - P[1]) / len];
    let bestS = len / 2, bestAvail = -1;
    for (let k = 0; k <= 14; k++) {
      const s = len * (0.28 + 0.44 * k / 14);
      const q = [P[0] + u[0] * s, P[1] + u[1] * s];
      let avail = distToRing(q, outline);
      for (const N of neighbors) avail = Math.min(avail, distToSeg(q, C, N));
      if (avail > bestAvail) { bestAvail = avail; bestS = s; }
    }
    const room = Math.max(0, bestAvail - clear - 0.7);
    // puzzleTabs: knob sticks out by hc+kr = 0.30\u00b7m; cap so tabs stay in proportion
    const m = Math.max(0, Math.min(len, room / 0.30, 20));
    return { m, shift: bestS - len / 2, avail: bestAvail, len };
  }
  function chooseFocus(outline, count) {
    const bb = { y0: Infinity, y1: -Infinity };
    for (const p of outline) { bb.y0 = Math.min(bb.y0, p[1]); bb.y1 = Math.max(bb.y1, p[1]); }
    const mid = centroid(outline);
    // Search along the mid-axis for a focus that maximizes the shortest radial
    // to N equal-arc split points, so tabbed cuts stay wide enough.
    const per = ringLen(outline);
    const pts = [];
    for (let k = 0; k < count; k++) pts.push(pointAt(outline, k / count * per).p);
    let best = mid, bestMin = -1;
    const lo = bb.y0 + 0.22 * (bb.y1 - bb.y0), hi = Math.min(mid[1] + 4, bb.y1 - 18);
    for (let i = 0; i <= 16; i++) {
      const y = lo + (hi - lo) * i / 16, C = [0, y];
      let m = Infinity;
      for (const p of pts) m = Math.min(m, Math.hypot(p[0] - C[0], p[1] - C[1]));
      if (m > bestMin) { bestMin = m; best = C; }
    }
    return best;
  }
  function equalAreaSplits(L, C, count) {
    // Blend of fan area and arc length: pure area would give the lobes very long arcs and the tip none.
    const n = L.length, A = [0], S = [0];
    for (let i = 0; i < n; i++) {
      const a = L[i], b = L[(i + 1) % n];
      A.push(A[i] + Math.abs((a[0] - C[0]) * (b[1] - C[1]) - (b[0] - C[0]) * (a[1] - C[1])) / 2);
      S.push(S[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const W = A.map((x, i) => 0.8 * x / A[n] + 0.2 * S[i] / S[n]);
    const out = [];
    for (let k = 0, i = 0; k < count; k++) {
      const target = k / count;
      while (i < n - 1 && W[i + 1] < target) i++;
      const t = W[i + 1] > W[i] ? Math.max(0, Math.min(1, (target - W[i]) / (W[i + 1] - W[i]))) : 0;
      const a = L[i], b = L[(i + 1) % n];
      out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], i, t, next: (i + 1) % n });
    }
    return out;
  }
  function layout(o) {
    o = options(o);
    const samples = o.detail === 'draft' ? 180 : 360;
    const outline = heartOutline(o.size, samples);
    const C = chooseFocus(outline, o.count);
    const per = ringLen(outline);
    // Start splits at the top cleft (outline[0]) so no piece has to swallow the dent. Splitting by equal area (seen
    // from the focus) instead of equal arc keeps the pieces beside the cleft and the tip from becoming slivers, and
    // the heart's symmetry keeps left and right matching for even counts.
    const splits = equalAreaSplits(outline, C, o.count);
    const radials = splits.map(s => Math.hypot(s.p[0] - C[0], s.p[1] - C[1]));
    const minM = (T.PUZZLE_MIN_NECK + o.clear) / 0.15 + 0.5;
    const rnd = rng(o.seed);
    const signs = [];
    for (let k = 0; k < o.count; k++) signs.push(rnd() < 0.5 ? 1 : -1);
    const edgeTabs = splits.map((s, k) => {
      const neigh = [splits[(k - 1 + o.count) % o.count].p, splits[(k + 1) % o.count].p];
      return edgeTabSpec(C, s.p, neigh, outline, o.clear);
    });
    const m = Math.min(...edgeTabs.map(e => e.m), ...radials);
    if (edgeTabs.some(e => e.m < minM)) {
      const need = minM / Math.min(...edgeTabs.map(e => e.m)) * o.size;
      return { error: 'small', minSize: Math.ceil(need + 1), layout: { outline, C, splits, m, tabs: T.puzzleTabs(minM), edgeTabs, count: o.count } };
    }
    const edges = splits.map((s, k) => {
      const tabs = T.puzzleTabs(edgeTabs[k].m);
      const shift = edgeTabs[k].shift + (rnd() - 0.5) * 2 * tabs.jit;
      return cutEdge(o.cut, s.p, C, signs[k], edgeTabs[k].m, shift);
    });
    const tabs = T.puzzleTabs(Math.min(...edgeTabs.map(e => e.m)));
    const pieces = [];
    for (let k = 0; k < o.count; k++) {
      const a = splits[k], b = splits[(k + 1) % o.count];
      const arc = outlineArc(outline, a.i, a.t, b.i, b.t);
      const eNext = edges[(k + 1) % o.count], eThis = edges[k];
      const cut = arc.concat(eNext.slice(1), [C], eThis.slice(1).reverse());
      const mid = pointAt(arc.concat([arc[0]]), ringLen(arc) / 2).p;
      pieces.push({ i: k, cut, wedge: arc.concat([C]), outerArc: arc, outerMid: mid, radial: (radials[k] + radials[(k + 1) % o.count]) / 2 });
    }
    return { outline, C, splits, radials, m, tabs, edgeTabs, signs, pieces, count: o.count, per, minM, cut: o.cut };
  }
  // The cut from a split point on the outline toward the focus. All three styles stick out at most 0.30\u00b7m (like the
  // classic knob), so the tab room measured by edgeTabSpec holds for every style.
  //   classic: round knob on a neck; geometric: a straight-sided dovetail; wavy: one smooth S wave (no undercut).
  function dovetail(m) { return { neck: 0.085 * m, head: 0.155 * m, h: 0.27 * m }; }
  function cutEdge(kind, p0, p1, sign, m, shift) {
    if (kind === 'classic') return T.puzzleEdge(p0, p1, sign, T.puzzleTabs(m), shift);
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy), u = [dx / len, dy / len], n = [-u[1] * sign, u[0] * sign];
    const s0 = len / 2 + shift, at = (s, t) => [p0[0] + u[0] * s + n[0] * t, p0[1] + u[1] * s + n[1] * t];
    if (kind === 'geometric') {
      const d = dovetail(m), r = Math.min(0.03 * m, 0.6), L = [p0];
      // Straight flanks with tiny fillets at the head corners so the slicer does not leave blobs.
      const pts = [[s0 - d.neck, 0], [s0 - d.head, d.h - r], [s0 - d.head + r * 0.7, d.h], [s0 + d.head - r * 0.7, d.h], [s0 + d.head, d.h - r], [s0 + d.neck, 0]];
      for (const q of pts) L.push(at(q[0], q[1]));
      return L;
    }
    // wavy: sin(\u03c0x)\u00b7(1+cos \u03c0x)/2 on x \u2208 [-1, 1] peaks at about 0.65, with zero slope where it meets the straight cut.
    const W = Math.max(0.5 * m, Math.min(1.15 * m, s0 - 0.08 * len, len * 0.92 - s0)), a = 0.42 * m, N = 40, L = [p0];
    for (let k = 0; k <= N; k++) {
      const x = -1 + 2 * k / N, t = a * Math.sin(Math.PI * x) * (1 + Math.cos(Math.PI * x)) / 2;
      L.push(at(s0 + x * W, t));
    }
    return L;
  }

  function shrinkPiece(cut, clear) {
    const ring = areaCCW(cut) ? cut : cut.slice().reverse();
    const sh = clear > 0 ? T.offset([{ outer: ring, holes: [] }], -clear / 2, true) : [{ outer: ring, holes: [] }];
    return sh;
  }
  function areaCCW(L) {
    let a = 0;
    for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return a > 0;
  }
  function outwardAt(ring, p) {
    // Outward normal of a CCW ring at the vertex closest to p (or along the containing segment).
    let best = 0, bd = Infinity, tBest = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
      if (d < bd) { bd = d; best = i; tBest = t; }
    }
    const a = ring[best], b = ring[(best + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    // CCW outer: interior is left, outward is right = (dy, -dx)
    return { p: [a[0] + dx * tBest, a[1] + dy * tBest], n: [dy / len, -dx / len] };
  }
  function addLoop(poly, mid, hole, outline) {
    const ring = poly[0].outer;
    const at = outwardAt(ring, mid);
    // Prefer the side that points away from the heart interior: if the normal aims inward, flip it.
    const probe = [at.p[0] + at.n[0] * 1.2, at.p[1] + at.n[1] * 1.2];
    if (distToRing(probe, outline) < distToRing(at.p, outline) - 0.2) at.n = [-at.n[0], -at.n[1]];
    const hr = hole / 2, rim = hr + 2.4;
    const cx = at.p[0] + at.n[0] * (rim * 0.45), cy = at.p[1] + at.n[1] * (rim * 0.45);
    const segs = Math.max(24, Math.round(rim * 6));
    let body = T.unionPolys(poly.concat([{ outer: T.circle(cx, cy, rim, segs), holes: [] }]));
    body = T.diffPolys(body, [{ outer: T.circle(cx, cy, hr, segs), holes: [] }]);
    return { poly: body, hole: [cx, cy], hr, rim };
  }

  // ---------------------------------------------------------------- names
  // Characters the font lacks fall back to their unaccented letter (so a rare accent never drops a letter); anything
  // still missing is skipped and reported.
  function glyphFor(font, ch) {
    let g = Bubble.glyphPolys(font, ch, 1);
    if (g && g.polys.length) return { g, ch };
    const plain = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (plain && plain !== ch) { g = Bubble.glyphPolys(font, plain, 1); if (g && g.polys.length) return { g, ch: plain, fallback: true }; }
    return null;
  }
  function iconPolys(kind) {
    // Unit cap height (1), sitting on the baseline. Rounded so the points print cleanly at 4 mm.
    if (kind === 'heart') {
      const L = []; for (let i = 0; i < 64; i++) L.push(rawHeart(i / 64 * Math.PI * 2));
      const sc = 0.92 / 29.2; // raw heart spans about 29 units tall
      let y0 = Infinity; for (const p of L) y0 = Math.min(y0, p[1]);
      const ring = L.map(p => [p[0] * sc, (p[1] - y0) * sc + 0.02]);
      return { polys: [{ outer: areaCCW(ring) ? ring : ring.reverse(), holes: [] }], advance: 1.02 };
    }
    if (kind === 'star') {
      const L = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.24 : 0.54, t = Math.PI / 2 + i * Math.PI / 5; L.push([0.55 + r * Math.cos(t), 0.47 + r * Math.sin(t)]); }
      let P = [{ outer: areaCCW(L) ? L : L.reverse(), holes: [] }];
      const soft = T.offset(T.offset(P, -0.06, true), 0.06, true);
      if (soft.length) P = soft;
      return { polys: P, advance: 1.1 };
    }
    return null;
  }
  // Shape the name at cap height 1: one or two centered lines, with the optional icon after the last line.
  // Returns polygons centered on their bounding box, plus that box (bw \u00d7 bh, in cap heights).
  function shapeName(lines, font, icon) {
    const out = [], skipped = [], fallback = [], LS = 1.32;
    const ic = iconPolys(icon);
    const rows = lines.map((line, li) => {
      const items = []; let w = 0;
      for (const ch of [...line]) {
        if (ch === ' ') { w += 0.32; continue; }
        const f = glyphFor(font, ch);
        if (!f) { skipped.push(ch); continue; }
        if (f.fallback) fallback.push(ch);
        items.push({ polys: f.g.polys, at: w }); w += (f.g.advance || 0.7) * 1.03;
      }
      if (ic && li === lines.length - 1 && items.length) { w += 0.28; items.push({ polys: ic.polys, at: w }); w += ic.advance; }
      return { items, w };
    });
    rows.forEach((r, li) => {
      const y = -li * LS, x0 = -r.w / 2;
      for (const it of r.items) for (const P of it.polys) out.push({
        outer: P.outer.map(q => [q[0] + it.at + x0, q[1] + y]),
        holes: (P.holes || []).map(h => h.map(q => [q[0] + it.at + x0, q[1] + y]))
      });
    });
    if (!out.length) return null;
    const bb = T.polysBBox(out), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    for (const P of out) { P.outer = P.outer.map(q => [q[0] - cx, q[1] - cy]); P.holes = P.holes.map(h => h.map(q => [q[0] - cx, q[1] - cy])); }
    return { polys: out, bw: bb.x1 - bb.x0, bh: bb.y1 - bb.y0, lines: lines.length, skipped, fallback };
  }
  function nameLayouts(name) {
    const out = [[name]], words = name.split(' ').filter(Boolean);
    if (words.length >= 2) {
      let best = null;
      for (let k = 1; k < words.length; k++) {
        const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '), w = Math.max(a.length, b.length);
        if (!best || w < best.w) best = { w, l: [a, b] };
      }
      out.push(best.l);
    }
    return out;
  }
  // Densely sampled boundary (outer rings and holes) of the safe area, so a box that holds no boundary sample and
  // whose center is inside holds no boundary at all (to within the 0.35 mm sample spacing, which the margin covers).
  function sampleRings(polys, step) {
    const xs = [], ys = [];
    for (const P of polys) for (const R of [P.outer].concat(P.holes || [])) {
      for (let i = 0; i < R.length; i++) {
        const a = R[i], b = R[(i + 1) % R.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
        for (let k = 0; k < n; k++) { xs.push(a[0] + (b[0] - a[0]) * k / n); ys.push(a[1] + (b[1] - a[1]) * k / n); }
      }
    }
    return { xs: Float64Array.from(xs), ys: Float64Array.from(ys) };
  }
  // Largest scale s at which a bw\u00b7s \u00d7 bh\u00b7s box centered at (cx, cy), with its baseline along v, misses every sample.
  function boxScale(S, cx, cy, v, bw, bh, stop) {
    let best = Infinity; const hw = bw / 2, hh = bh / 2, vx = v[0], vy = v[1], xs = S.xs, ys = S.ys, lim = stop || 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - cx, dy = ys[i] - cy, x = Math.abs(dx * vx + dy * vy) / hw, y = Math.abs(dy * vx - dx * vy) / hh;
      const m = x > y ? x : y; if (m < best) { best = m; if (best < lim) return best; }
    }
    return best;
  }
  function nearest(S, cx, cy) {
    let d = Infinity; for (let i = 0; i < S.xs.length; i++) { const dx = S.xs[i] - cx, dy = S.ys[i] - cy, q = dx * dx + dy * dy; if (q < d) d = q; }
    return Math.sqrt(d);
  }
  // Fit a name into the safe area: try one line and (for two or more words) two lines, every rotation that keeps the
  // letters upright when the keychain hangs from its ring, and every center on a grid; keep the biggest letters,
  // with a gentle preference for level text and a single line.
  // With a target cap height, any placement that reaches it wins, and among those the most level single line.
  function fitName(name, font, icon, safe, up, draft, target) {
    if (!name || !safe.length) return null;
    const S = sampleRings(safe, 0.35), bb = T.polysBBox(safe);
    const area = Math.abs(T.polysArea(safe)), g = Math.max(0.6, Math.sqrt(area) / (draft ? 10 : 16));
    const centers = [];
    for (let x = bb.x0 + g / 2; x < bb.x1; x += g) for (let y = bb.y0 + g / 2; y < bb.y1; y += g) if (safe.some(P => T.pointIn([x, y], P))) centers.push([x, y]);
    if (!centers.length) return null;
    // A box holding its center keeps its shorter half-side within the distance to the nearest boundary: that bounds
    // the scale at each center, so most centers are skipped once a good placement is known. Best centers first.
    for (const c of centers) c.d = nearest(S, c[0], c[1]);
    centers.sort((a, b) => b.d - a.d);
    const level = [up[1], -up[0]], A0 = Math.atan2(level[1], level[0]);
    const steps = draft ? 12 : 24;
    const scoreOf = (sc, d, pref) => target && sc >= target ? 100 + pref * 4 - Math.abs(Math.sin(d)) * 3 + Math.min(sc / target, 1.5) * 0.1 : sc * pref * (1 - 0.12 * Math.sin(d) * Math.sin(d));
    let best = null;
    for (const lines of nameLayouts(name)) {
      const sh = shapeName(lines, font, icon); if (!sh) continue;
      const pref = lines.length === 1 ? 1 : 0.92;
      const half = Math.min(sh.bw, sh.bh) / 2;
      const tryAt = (d, c) => {
        const ub = c.d / half;
        if (best) { if (target ? (best.score >= 100 && ub < target) || scoreOf(ub, 0, pref) <= best.score && !(target && ub >= target) : scoreOf(ub, 0, pref) <= best.score) return; }
        const t = A0 + d, v = [Math.cos(t), Math.sin(t)];
        const need = best && !target ? best.score / (pref * (1 - 0.12 * Math.sin(d) * Math.sin(d))) : 0;
        const sc = boxScale(S, c[0], c[1], v, sh.bw, sh.bh, need);
        const score = scoreOf(sc, d, pref);
        if (!best || score > best.score) best = { score, cap: sc, d, c, v, sh, lines };
      };
      for (let k = 0; k <= steps; k++) { const d = -Math.PI / 2 + Math.PI * k / steps; for (const c of centers) tryAt(d, c); }
    }
    if (!best) return null;
    if (!draft) {
      // refine around the winner
      const { sh, lines } = best, pref = lines.length === 1 ? 1 : 0.92, d0 = best.d, c0 = best.c, step = Math.PI / steps;
      for (let dd = -1; dd <= 1; dd += 0.25) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        const d = d0 + dd * step, c = [c0[0] + i * g / 4, c0[1] + j * g / 4];
        if (!safe.some(P => T.pointIn(c, P))) continue;
        const t = A0 + d, v = [Math.cos(t), Math.sin(t)], sc = boxScale(S, c[0], c[1], v, sh.bw, sh.bh);
        const score = scoreOf(sc, d, pref);
        if (score > best.score) best = { score, cap: sc, d, c, v, sh, lines };
      }
    }
    return best;
  }
  function placeFit(fit, cap) {
    const v = fit.v, w = [-v[1], v[0]], c = fit.c;
    const map = q => [c[0] + (q[0] * v[0] + q[1] * w[0]) * cap, c[1] + (q[0] * v[1] + q[1] * w[1]) * cap];
    return fit.sh.polys.map(P => ({ outer: P.outer.map(map), holes: P.holes.map(h => h.map(map)) }));
  }

  // ---------------------------------------------------------------- edge profile, border and surface patterns
  function edgeProfile(o) {
    const r = o.round;
    if (o.edge === 'flat') return { kind: 'flat', top: 0, bottom: 0 };
    if (o.edge === 'beveled') return { kind: 'bevel', top: Math.max(0.6, Math.min(1.2, r * 1.6 || 0.8, o.thick * 0.35)), bottom: Math.min(0.3, r) };
    if (o.edge === 'puffy') return { kind: 'round', top: Math.max(0.6, Math.min(1.6, o.thick * 0.5 - 0.3)), bottom: 0.3 };
    return { kind: 'round', top: Math.min(r, o.thick / 2 - 0.15), bottom: Math.min(r, 0.4) };
  }
  // A solid with a shaped top and bottom edge and shallow pockets cut into the top (engraved names, patterns).
  // cuts: [{ depth, polys }], all inside the flat top.
  function profiledSolid(poly, thick, prof, cuts, draft) {
    const rt = prof.top < 0.12 ? 0 : prof.top, rb = prof.bottom < 0.12 ? 0 : prof.bottom;
    const steps = draft ? 2 : (prof.kind === 'bevel' ? 3 : 5);
    const zs = new Set([0, thick]);
    for (let i = 1; i < steps; i++) { if (rb) zs.add(rb * i / steps); if (rt) zs.add(thick - rt + rt * i / steps); }
    if (rb) zs.add(rb); if (rt) zs.add(thick - rt);
    for (const c of cuts) if (c.polys.length) zs.add(+(thick - c.depth).toFixed(4));
    const Z = [...zs].filter(z => z >= 0 && z <= thick).sort((a, b) => a - b);
    const cache = new Map();
    const inset = k => { if (k < 0.04) return poly; const key = k.toFixed(3); if (!cache.has(key)) { const q = T.offset(poly, -k, true); cache.set(key, q.length ? q : poly); } return cache.get(key); };
    const kOf = t => prof.kind === 'bevel' ? t : 1 - Math.sqrt(Math.max(0, 1 - t * t));
    const layers = [];
    for (let i = 0; i < Z.length - 1; i++) {
      const z0 = Z[i], z1 = Z[i + 1], zm = (z0 + z1) / 2;
      let k = 0;
      if (rb && zm < rb) k = rb * kOf((rb - zm) / rb);
      else if (rt && zm > thick - rt) k = rt * kOf((zm - (thick - rt)) / rt);
      let polys = inset(k);
      const rm = []; for (const c of cuts) if (zm > thick - c.depth) rm.push(...c.polys);
      if (rm.length) { const d = T.diffPolys(polys, rm); if (d.length) polys = d; }
      layers.push({ z0, z1, polys });
    }
    const p = T.steppedExtrude(layers);
    if (p && p.length && Core.checkClosed(p).closed) return p;
    if (cuts.length) return profiledSolid(poly, thick, prof, [], draft);
    return T.extrude(poly, 2, 0, thick);
  }
  function heartShape(cx, cy, h) {
    const L = []; for (let i = 0; i < 28; i++) L.push(rawHeart(i / 28 * Math.PI * 2));
    const sc = h / 29.2, ring = L.map(p => [cx + p[0] * sc, cy + (p[1] + 2.5) * sc]);
    return areaCCW(ring) ? ring : ring.reverse();
  }
  // Pattern elements in heart coordinates, so the texture flows across the pieces when they are assembled.
  // Each element: { polys, r (bounding radius), depth }.
  function patternElements(kind, outline, seed, thick) {
    const bb = T.polysBBox([{ outer: outline, holes: [] }]), out = [], depth = Math.min(0.4, thick * 0.14);
    if (kind === 'dots' || kind === 'hearts') {
      const pitch = kind === 'dots' ? 4.4 : 6.2, rowH = pitch * Math.sqrt(3) / 2;
      for (let j = 0, y = bb.y0; y <= bb.y1; y += rowH, j++) for (let x = bb.x0 + (j % 2) * pitch / 2; x <= bb.x1; x += pitch) {
        if (kind === 'dots') out.push({ c: [x, y], r: 0.85, polys: [{ outer: T.circle(x, y, 0.85, 18), holes: [] }], depth });
        else out.push({ c: [x, y], r: 1.75, polys: [{ outer: heartShape(x, y, 3.2), holes: [] }], depth });
      }
    } else if (kind === 'stripes') {
      const pitch = 3.4, w = 1.0, D = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
      const u = [Math.SQRT1_2, Math.SQRT1_2], n = [-Math.SQRT1_2, Math.SQRT1_2];
      for (let t = -D / 2; t <= D / 2; t += pitch) {
        const a = [cx + n[0] * t - u[0] * D / 2, cy + n[1] * t - u[1] * D / 2], b = [cx + n[0] * t + u[0] * D / 2, cy + n[1] * t + u[1] * D / 2];
        const o = [n[0] * w / 2, n[1] * w / 2];
        out.push({ stripe: true, depth, polys: [{ outer: [[a[0] - o[0], a[1] - o[1]], [b[0] - o[0], b[1] - o[1]], [b[0] + o[0], b[1] + o[1]], [a[0] + o[0], a[1] + o[1]]], holes: [] }] });
      }
    } else if (kind === 'hammered') {
      // Poisson-style scatter of terraced dimples (two depths read as a hand-hammered surface).
      const r0 = rng(seed * 7919 + 13), pts = [], W = bb.x1 - bb.x0, H = bb.y1 - bb.y0;
      for (let k = 0; k < 9000 && pts.length < 2600; k++) {
        const r = 0.9 + r0() * 0.9, c = [bb.x0 + r0() * W, bb.y0 + r0() * H];
        if (pts.some(q => Math.hypot(q.c[0] - c[0], q.c[1] - c[1]) < q.r + r + 0.45)) continue;
        pts.push({ c, r });
      }
      for (const q of pts) {
        out.push({ c: q.c, r: q.r, depth: depth * 0.5, polys: [{ outer: T.circle(q.c[0], q.c[1], q.r, 20), holes: [] }] });
        out.push({ c: q.c, r: q.r, depth, polys: [{ outer: T.circle(q.c[0], q.c[1], q.r * 0.55, 14), holes: [] }] });
      }
    }
    return out;
  }
  function patternCuts(els, region) {
    if (!els.length || !region.length) return [];
    const byDepth = new Map(), add = (d, P) => { if (!byDepth.has(d)) byDepth.set(d, []); byDepth.get(d).push(...P); };
    const shrunk = new Map();
    const inside = (c, r) => { const k = r.toFixed(2); if (!shrunk.has(k)) shrunk.set(k, T.offset(region, -r, true)); return shrunk.get(k).some(P => T.pointIn(c, P)); };
    const stripes = [];
    for (const e of els) {
      if (e.stripe) { stripes.push(e); continue; }
      if (inside(e.c, e.r + 0.05)) add(e.depth, e.polys);
    }
    if (stripes.length) {
      const cut = T.interPolys(stripes.flatMap(e => e.polys), region).filter(P => Math.abs(T.polysArea([P])) > 2.5);
      if (cut.length) add(stripes[0].depth, cut);
    }
    return [...byDepth.entries()].map(([depth, polys]) => ({ depth, polys }));
  }

  function buildPiece(pc, L, o, pattern) {
    const sh = shrinkPiece(pc.cut, o.clear);
    if (!sh.length) return { error: 'split' };
    const looped = addLoop(sh, pc.outerMid, o.hole, L.outline);
    if (!looped.poly.length) return { error: 'loop' };
    const poly = looped.poly, draft = o.detail === 'draft', thick = o.thick, raise = o.raise;
    const prof = edgeProfile(o), flatIn = prof.top + 0.6;
    // Border: a 1.2 mm rim just inside the shaped edge, following the outline and the ring hole.
    const rimW = 1.2;
    const border = o.border ? T.diffPolys(T.offset(poly, -flatIn, true), T.offset(poly, -(flatIn + rimW), true)) : [];
    // Safe area for the name: inside the piece and its straight wedge (so never on a tab), clear of the edge
    // (and the border), and clear of the ring and its rim.
    const margin = o.border ? flatIn + rimW + 1.0 : Math.max(1.6, flatIn + 0.9);
    const wedge = T.offset([{ outer: areaCCW(pc.wedge) ? pc.wedge : pc.wedge.slice().reverse(), holes: [] }], -(o.clear / 2 + margin), true);
    let safe = T.interPolys(T.offset(poly, -margin, true), wedge);
    safe = T.diffPolys(safe, [{ outer: T.circle(looped.hole[0], looped.hole[1], looped.rim + 1.0, 40), holes: [] }]);
    if (safe.length > 1) safe = [safe.reduce((a, b) => Math.abs(T.polysArea([b])) > Math.abs(T.polysArea([a])) ? b : a)];
    // 'heart': names read upright on the assembled heart (never upside down); 'hanging': upright when the keychain
    // hangs from its ring.
    const up = o.orient === 'heart' ? [0, 1] : (() => { const c = centroid(poly[0].outer), dx = looped.hole[0] - c[0], dy = looped.hole[1] - c[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; })();
    const name = (o.names[pc.i] || '').trim();
    const fit = name ? fitName(name, o.font, o.icon, safe, up, draft) : null;
    return { pc, looped, poly, prof, border, safe, up, name, fit, flatIn, draft, thick, raise };
  }
  function finishPiece(st, cap, o, pattern) {
    const { pc, looped, poly, prof, border, name, flatIn, draft, thick, raise } = st;
    let fit = st.fit;
    // A name with room to spare is re-placed at the set's size in its most level, single-line spot.
    if (fit && cap < fit.cap - 0.05) { const f2 = fitName(name, o.font, o.icon, st.safe, st.up, draft, cap); if (f2 && f2.cap >= cap - 1e-6) fit = Object.assign(f2, { cap: fit.cap }); }
    // Grow the letters by 0.1 mm so thin joins and accent marks print as solid lines with a 0.4 mm nozzle (the safe
    // area's margin is far wider than this).
    const text = fit && cap > 0 ? T.offset(T.unionPolys(placeFit(fit, cap)), 0.1, true) : [];
    const marks = text.concat(border);
    const engraved = o.style === 'engraved';
    const depth = Math.min(raise, thick * 0.42, 1.0);
    const cuts = [];
    if (engraved && marks.length) cuts.push({ depth, polys: marks });
    if (pattern.length) {
      let region = T.offset(poly, -(o.border ? flatIn + rimWidth + 0.8 : flatIn + 0.9), true);
      if (text.length) region = T.diffPolys(region, T.offset(text, 1.3, true));
      region = T.diffPolys(region, [{ outer: T.circle(looped.hole[0], looped.hole[1], looped.rim + 0.6, 40), holes: [] }]);
      cuts.push(...patternCuts(pattern, region));
    }
    const baseMesh = profiledSolid(poly, thick, prof, cuts, draft);
    let textMesh = null;
    if (marks.length) {
      const z0 = engraved ? thick - depth : thick - 0.05, z1 = engraved ? thick : thick + raise;
      textMesh = T.extrude(T.unionPolys(marks), 2, z0, z1);
    }
    const color = o.alt && pc.i % 2 ? o.colors.alt : o.colors.base;
    return {
      i: pc.i, name, poly, cut: pc.cut, hole: looped.hole, hr: looped.hr, rim: looped.rim,
      base: baseMesh, text: textMesh, style: o.style, textPolys: text, border, safe: st.safe,
      fit: fit ? { cap, maxCap: fit.cap, lines: fit.sh.lines, text: fit.lines, angle: Math.round(fit.d * 180 / Math.PI) } : null,
      parts: pieceParts(pc, name, baseMesh, textMesh, o, color)
    };
  }
  const rimWidth = 1.2;
  function pieceParts(pc, name, base, text, o, color) {
    const label = name || `Piece ${pc.i + 1}`;
    const parts = [{ kind: 'base', name: label, p: base, color: color || o.colors.base, extruder: 1, index: pc.i }];
    if (text && text.length) parts.push({ kind: 'text', name: o.border && !name ? `${label} border` : `${label} name`, p: text, color: o.colors.text, extruder: 2, index: pc.i });
    return parts;
  }
  function moveP(p, dx, dy, dz) {
    const q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); }
    return q;
  }
  function rotZ90(p) {
    const q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { q[i] = -p[i + 1]; q[i + 1] = p[i]; q[i + 2] = p[i + 2]; }
    return q;
  }
  function rotZ(p, a) {
    if (!a) return p;
    const c = Math.cos(a), sn = Math.sin(a), q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { q[i] = p[i] * c - p[i + 1] * sn; q[i + 1] = p[i] * sn + p[i + 1] * c; q[i + 2] = p[i + 2]; }
    return q;
  }
  // Raster nesting: each piece, grown by half the gap plus half a cell diagonal, is stamped into a grid; two pieces
  // whose stamps do not share a cell are at least the gap apart. Biggest first, every 15\u00b0 (30\u00b0 for drafts), lowest
  // top edge wins, then leftmost. Returns per piece the rotation a and the shift (x, y) applied after rotating.
  function nestPieces(polys, bed, gap, draft) {
    const cell = draft ? 2 : 1, W = Math.floor(bed[0] / cell), H = Math.floor(bed[1] / cell), edge = Math.max(2, gap);
    const e0 = Math.ceil(edge / cell), grow = gap / 2 + cell * 0.71;
    const order = polys.map((P, i) => ({ i, a: Math.abs(T.polysArea(P)) })).sort((x, y) => y.a - x.a);
    const sheets = [], place = new Array(polys.length);
    const newSheet = () => { const g = new Uint8Array(W * H); sheets.push(g); return g; };
    const rotStep = draft ? Math.PI / 6 : Math.PI / 12;
    const masks = P => {
      const out = [], grown = T.offset(P, grow, true);
      for (let a = 0; a < 2 * Math.PI - 1e-6; a += rotStep) {
        const c = Math.cos(a), sn = Math.sin(a);
        const R = grown.map(Q => ({ outer: Q.outer.map(q => [q[0] * c - q[1] * sn, q[0] * sn + q[1] * c]), holes: Q.holes.map(h => h.map(q => [q[0] * c - q[1] * sn, q[0] * sn + q[1] * c])) }));
        const bb = T.polysBBox(R), x0 = Math.floor(bb.x0 / cell), y0 = Math.floor(bb.y0 / cell), mw = Math.ceil(bb.x1 / cell) - x0 + 1, mh = Math.ceil(bb.y1 / cell) - y0 + 1;
        const cells = [], rings = []; for (const Q of R) rings.push(Q.outer, ...Q.holes);
        for (let j = 0; j < mh; j++) {
          const yc = (y0 + j + 0.5) * cell, xs = [];
          for (const L of rings) for (let k = 0, n = L.length; k < n; k++) {
            const a = L[k], b = L[(k + 1) % n];
            if ((a[1] > yc) !== (b[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
          }
          xs.sort((p, q) => p - q);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            const i0 = Math.max(0, Math.ceil(xs[k] / cell - 0.5) - x0), i1 = Math.min(mw - 1, Math.floor(xs[k + 1] / cell - 0.5) - x0);
            for (let i = i0; i <= i1; i++) cells.push(j * W + i);
          }
        }
        out.push({ a, x0, y0, mw, mh, cells: Int32Array.from(cells) });
      }
      return out;
    };
    for (const { i } of order) {
      const M = masks(polys[i]);
      let done = false;
      for (let si = 0; si <= sheets.length && !done; si++) {
        const g = sheets[si] || newSheet();
        let best = null;
        for (const m of M) {
          // Stamps are grown by half the gap; keep them a further half gap inside the plate edge.
          const lo = Math.max(0, e0 - Math.ceil(gap / 2 / cell));
          for (let y = lo; y + m.mh <= H - lo; y++) {
            if (best && y + m.mh > best.top) break;
            for (let x = lo; x + m.mw <= W - lo; x++) {
              const base = y * W + x; let hit = false;
              for (let k = 0; k < m.cells.length; k++) if (g[base + m.cells[k]]) { hit = true; break; }
              if (!hit) { const top = y + m.mh; if (!best || top < best.top || (top === best.top && x < best.x)) best = { top, x, y, m }; break; }
            }
          }
        }
        if (best) {
          const base = best.y * W + best.x; for (const k of best.m.cells) g[base + k] = 1;
          place[i] = { a: best.m.a, x: (best.x - best.m.x0) * cell, y: (best.y - best.m.y0) * cell, plate: si, unfit: false };
          done = true;
        } else if (!sheets[si].some(v => v)) {
          // too big for an empty plate: leave it on its own plate, flagged
          place[i] = { a: 0, x: edge, y: edge, plate: si, unfit: true }; sheets[si].fill(1); done = true;
        }
      }
    }
    return { place, plates: sheets.length };
  }
  function arrange(items, bed, gap) {
    const placed = T.pack(items, bed[0], bed[1], gap, gap);
    return items.map((it, i) => {
      const pl = placed.place[i];
      if (!pl || pl.sheet < 0) return { x: gap, y: gap, plate: 0, rot: false, unfit: true };
      return { x: pl.x, y: pl.y, plate: pl.sheet, rot: !!pl.rot, unfit: false };
    });
  }

  // Auto size: grow the heart (never shrink it) until every name gets readable letters, within the size limit.
  function build(raw) {
    const o = options(raw);
    if (!o.autoSize) return buildAt(o);
    const want = o.size, at = (size, full) => buildAt(Object.assign({}, o, { size }), !full);
    const good = R => !R.error && (!R.stats.named || R.stats.minCap >= LIMITS.goodCap - 1e-6);
    let R = at(want);
    if (R.error === 'small' && R.minSize) R = at(Math.min(LIMITS.maxSize, Math.ceil(R.minSize / 5) * 5));
    if (R.error || good(R)) return finishAuto(at(R.options.size, true), want);
    // Letters grow a little faster than the heart (the margins stay fixed), so aim with a 0.8 power, then bisect
    // on a 5 mm grid for the smallest heart that passes.
    let lo = R.options.size, best = null, hi = Math.min(LIMITS.maxSize, Math.ceil(lo * Math.pow(LIMITS.goodCap / Math.max(0.5, R.stats.minCap), 0.8) / 5) * 5);
    for (let k = 0; k < 6; k++) {
      const T2 = at(hi);
      if (good(T2)) { best = T2; break; }
      lo = hi; R = T2;
      if (hi >= LIMITS.maxSize) break;
      hi = Math.min(LIMITS.maxSize, Math.ceil(hi * 1.12 / 5) * 5);
    }
    if (!best) return finishAuto(at(R.options.size, true), want);
    while (best.options.size - lo > 5) {
      const mid = Math.round((lo + best.options.size) / 10) * 5;
      if (mid <= lo || mid >= best.options.size) break;
      const M = at(mid);
      if (good(M)) best = M; else lo = mid;
    }
    return finishAuto(at(best.options.size, true), want);
  }
  function finishAuto(R, want) {
    if (!R.error && R.options.size > want) { R.autoSized = { from: want, to: R.options.size }; R.warnings.unshift(`Heart grown to ${R.options.size} mm so every name fits.`); }
    return R;
  }
  function buildAt(raw, probe) {
    const o = options(raw), warnings = [];
    const L = layout(o);
    if (L.error) return { error: L.error, minSize: L.minSize, options: o, warnings: [`This heart is too small for ${o.count} interlocking pieces. Try at least ${L.minSize} mm, or fewer pieces.`] };
    const pattern = o.pattern === 'none' ? [] : patternElements(o.pattern, L.outline, o.seed, o.thick);
    const staged = [];
    for (const pc of L.pieces) {
      const b = buildPiece(pc, L, o, pattern);
      if (b.error) return { error: b.error, options: o, warnings: ['A piece could not be built. Try a larger heart, a smaller hole, or fewer pieces.'] };
      staged.push(b);
    }
    // One letter size for the set where possible: names never exceed their own fit, and the biggest is held to
    // 1.35\u00d7 the smallest so a short name does not shout next to a long one.
    const fits = staged.filter(b => b.fit).map(b => b.fit.cap);
    const smallest = fits.length ? Math.min(...fits) : 0;
    if (probe) return { options: o, warnings, stats: { named: fits.length, minCap: smallest } };
    const ceiling = Math.min(LIMITS.maxCap, o.size * 0.085, Math.max(LIMITS.minCap, smallest) * 1.35);
    const built = staged.map(b => finishPiece(b, b.fit ? Math.min(b.fit.cap, ceiling) : 0, o, pattern));
    const nameFits = built.map(b => b.name ? { name: b.name, cap: b.fit ? +b.fit.cap.toFixed(2) : 0, lines: b.fit ? b.fit.lines : 0, ok: !!b.fit && b.fit.cap >= LIMITS.minCap - 1e-6 } : null);
    const small = nameFits.map((f, i) => f && !f.ok ? i : -1).filter(i => i >= 0);
    if (small.length) warnings.push(...small.map(i => `"${nameFits[i].name}" (piece ${i + 1}) only fits ${nameFits[i].cap.toFixed(1)} mm tall. Shorten it, use a bigger heart, or fewer pieces.`));
    const skipped = new Set(); staged.forEach(b => b.fit && b.fit.sh.skipped.forEach(c => skipped.add(c)));
    if (skipped.size) warnings.push(`Skipped ${[...skipped].map(c => `"${c}"`).join(', ')}: not in this letter style.`);
    // Assembled parts stay in heart coordinates (already on z=0).
    const assembled = [];
    built.forEach(b => { for (const q of b.parts) assembled.push({ ...q, p: q.p, view: 'assembled' }); });
    // Nest the pieces on the build plate by their true outlines (wedges interleave head to tail), not their boxes.
    const nest = nestPieces(built.map(b => b.poly), o.bed, o.gap, o.detail === 'draft');
    const plateParts = [];
    built.forEach((b, i) => {
      const pl = nest.place[i]; b.place = pl;
      for (const q of b.parts) plateParts.push({ ...q, p: moveP(rotZ(q.p, pl.a), pl.x, pl.y), plate: pl.plate, rot: pl.a !== 0 });
      if (pl.unfit) warnings.push(`${b.name || 'A piece'} is larger than the build plate.`);
    });
    const pos = nest.place;
    const plates = Math.max(0, ...pos.map(p => p.plate)) + 1;
    if (plates > 1) warnings.push(`The pieces fill ${plates} build plates.`);
    if (o.count > LIMITS.freeCount) warnings.push(`${o.count} pieces (free: up to ${LIMITS.freeCount}).`);
    const assy = T.concat(assembled.map(q => q.p)), abb = Core.bbox(assy);
    const plat = T.concat(plateParts.map(q => q.p)), pbb = Core.bbox(plat);
    return {
      layout: L, pieces: built, options: o, warnings, plates,
      assembled, plateParts,
      filaments: [{ role: 'base', color: o.colors.base }].concat(o.alt ? [{ role: 'alt', color: o.colors.alt }] : [], [{ role: 'text', color: o.colors.text }]),
      names: o.names, fits: nameFits,
      size: [abb.max[0] - abb.min[0], abb.max[1] - abb.min[1], abb.max[2] - abb.min[2]],
      plateSize: [pbb.max[0] - pbb.min[0], pbb.max[1] - pbb.min[1], pbb.max[2] - pbb.min[2]],
      stats: {
        count: o.count, plates, named: o.names.filter(Boolean).length, style: o.style, size: o.size, thick: o.thick,
        minCap: fits.length ? +Math.min(...nameFits.filter(Boolean).map(f => f.cap)).toFixed(2) : 0,
        look: { cut: o.cut, edge: o.edge, border: o.border, pattern: o.pattern, icon: o.icon, alt: o.alt, font: o.font },
        tris: assembled.reduce((s, q) => s + q.p.length / 9, 0),
        sizeMM: [abb.max[0] - abb.min[0], abb.max[1] - abb.min[1], abb.max[2] - abb.min[2]]
      }
    };
  }

  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'piece'; }
  function export3MF(res, o) {
    o = o || {};
    const bed = o.bed || res.options.bed || DEFAULTS.bed, name = o.name || 'Heart keychain puzzle', n = res.plates || 1;
    // Filament slots follow the tool's order (pieces, second piece color, names), then any extra color.
    const cols = [];
    for (const f of res.filaments || []) if (!cols.includes(f.color)) cols.push(f.color);
    for (const q of res.plateParts) if (!cols.includes(q.color)) cols.push(q.color);
    const objects = [], plates = Array.from({ length: n }, () => []);
    res.plateParts.forEach(pt => {
      const org = T.bambuPlateOrigin(pt.plate || 0, n, bed[0], bed[1]);
      plates[pt.plate || 0].push(objects.length);
      objects.push({ name: pt.name, p: moveP(pt.p, org[0], org[1]), color: pt.color, extruder: cols.indexOf(pt.color) + 1 });
    });
    return T.threeMF(objects, { title: name, plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function assembledSTL(res) { return new Uint8Array(Core.writeSTL(T.concat(res.assembled.map(q => q.p)), 'heart assembled')); }
  function readme(res, name) {
    const s = res.stats, o = res.options, L = [`Expressarte heart keychain puzzle: ${name}`, '',
      `${s.count} interlocking pieces that form a ${o.size} mm heart \u00b7 ${s.plates} plate${s.plates === 1 ? '' : 's'}`,
      `${o.thick} mm thick \u00b7 ${o.clear} mm gap \u00b7 ${o.hole} mm ring hole`,
      `Look: ${CUTS[o.cut].toLowerCase()} \u00b7 ${EDGES[o.edge].toLowerCase()} edge \u00b7 ${PATTERNS[o.pattern].toLowerCase()} surface${o.border ? ' \u00b7 border' : ''}${o.icon !== 'none' ? ` \u00b7 ${ICONS[o.icon].toLowerCase()} icon` : ''}${o.alt ? ' \u00b7 two-tone pieces' : ''} \u00b7 ${(Bubble.FONTS[o.font] || {}).label || o.font} font, ${o.style}`];
    if (res.autoSized) L.push(`Auto size grew the heart from ${res.autoSized.from} mm to ${o.size} mm so every name fits.`);
    L.push('Names (letter height):');
    res.names.forEach((n, i) => { const f = res.fits && res.fits[i]; L.push(`  ${i + 1}. ${n || '(no name)'}${f ? ` (${f.cap.toFixed(1)} mm${f.lines > 1 ? ', two lines' : ''}${f.ok ? '' : ', small'})` : ''}`); });
    L.push('', 'Filaments'); res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}  ${f.role}`));
    L.push('', 'Printing',
      '  - Print the pieces flat, as laid out in the 3MF. The assembled STL is a preview only; do not print it or the pieces will fuse.',
      '  - The 3MF opens with the pieces and the names on separate filaments.',
      '  - Each piece has a reinforced ring hole on the outer edge for a key ring.',
      '  - The pieces lock together into a heart when you are not using them as keychains.');
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, o) {
    o = o || {}; const name = o.name || 'Heart keychain puzzle', base = safe(o.fileBase || 'heart-keychain-puzzle');
    const list = [{ name: `${base}.3mf`, data: export3MF(res, o) }];
    // One combined STL per piece (base + name) plus separate color STLs, plus assembled preview.
    res.pieces.forEach((pc, i) => {
      const tag = String(i + 1).padStart(2, '0') + '_' + safe(pc.name || `piece_${i + 1}`);
      const plate = res.plateParts.filter(q => q.index === i);
      list.push({ name: `stl/${tag}.stl`, data: new Uint8Array(Core.writeSTL(T.concat(plate.map(q => q.p)), pc.name || `piece ${i + 1}`)) });
      plate.forEach(q => list.push({ name: `stl/${tag}_${q.kind}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }));
    });
    list.push({ name: 'stl/assembled_preview.stl', data: assembledSTL(res) });
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }

  const api = {
    DEFAULTS, LIMITS, PALETTE, SAMPLE_NAMES, CUTS, EDGES, PATTERNS, ICONS, LOOKS, options, parseNames,
    heartOutline, layout, build, export3MF, files, readme, assembledSTL,
    outerLen, distToRing, fitName, shapeName, cutEdge, dovetail, edgeProfile
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPHeartPuzzle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
