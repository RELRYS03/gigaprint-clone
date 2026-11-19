/* Expressarte "Suspended print": an object floating inside a frame, held by thin strings, printed as one piece.
   Coordinates (display): X right, Y depth, Z up. A flat frame lies in the XZ plane (its depth along Y) and stands on its
   base; a sphere cage is centred on the object. Strings lie in planes: Y = const for flat frames (so laid flat on the bed
   every string prints as a bridge), Z = const for the cage (horizontal bridges when it prints upright).
   Every string is made by casting a ray from a point on the frame's inner wall towards the object (SplitCore BVH): the
   first hit is the anchor, so a string never passes through the object, and it is pushed a little past the hit (into
   the object) and into the frame wall so both ends are embedded. union() joins everything with Manifold (WASM). */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);

  const SHAPES = { circle: 'Circle / ring', oval: 'Egg / oval', square: 'Square', rounded: 'Rounded rectangle', hexagon: 'Hexagon', arch: 'Arch / portal', heart: 'Heart', cage: 'Sphere cage (3D)', cube: 'Cube cage (3D)' };
  const PATTERNS = { radial: 'Radial (nearest frame point)', spokes: 'Spokes from the center', grid: 'Straight (horizontal + vertical)', web: 'Crisscross web', pendant: 'Hanging from the top', random: 'Random organic' };
  const ANCHORS = { flared: 'Flared (wider on the same layer)', plain: 'Plain (embedded)' };
  const BASES = { stand: 'Stand (foot)', flat: 'Flat bottom', loop: 'Hanging loop', none: 'None' };
  const DEFAULTS = { shape: 'circle', fit: true, margin: 12, innerW: 0, thick: 6, depth: 0, base: 'stand', layout: 'flat', pattern: 'radial', count: 12, layers: 2,
    lineW: 0.42, layerH: 0.2, firstH: 0.2, strands: 1, tall: 2, /* engine default; the tool's Strand width menu starts at 2 lines (recommended) */ anchor: 'flared', embed: 1.0, turn: 0, seed: 1, ribs: 3, rot: [0, 0, 0], off: [0, 0, 0], minString: 0.8, edits: null };
  const MIN_FDM = 0.8;
  const deg = Math.PI / 180;

  // ---------------------------------------------------------------- small vector helpers
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------------------------------------------------------------- 2D polygon helpers (points [x, z])
  const area2 = L => { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; };
  function pip(q, L) { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  const inPolys = (q, polys) => polys.some(P => pip(q, P.outer) && !P.holes.some(h => pip(q, h)));
  function nearestOn(q, L) { // closest point of the closed polyline L to q
    let best = Infinity, bp = L[0];
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
      const t = l2 ? clamp(((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / l2, 0, 1) : 0, x = a[0] + t * dx, z = a[1] + t * dz, d = (q[0] - x) ** 2 + (q[1] - z) ** 2;
      if (d < best) { best = d; bp = [x, z]; }
    }
    return { p: bp, d: Math.sqrt(best) };
  }
  function rayPoly(o, d, L) { // first crossing of the ray o + t d (t > 1e-7) with the closed polyline L
    let best = Infinity;
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], ex = b[0] - a[0], ez = b[1] - a[1], den = d[0] * ez - d[1] * ex;
      if (Math.abs(den) < 1e-12) continue;
      const wx = a[0] - o[0], wz = a[1] - o[1], t = (wx * ez - wz * ex) / den, u = (wx * d[1] - wz * d[0]) / den;
      if (t > 1e-7 && u >= 0 && u <= 1 && t < best) best = t;
    }
    return best;
  }
  function hull(points) { // monotone chain, CCW
    const P = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (P.length < 3) return P;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  const bbox2 = L => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const q of L) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[0]); z1 = Math.max(z1, q[1]); } return { x0, z0, x1, z1, w: x1 - x0, h: z1 - z0 }; };

  // ---------------------------------------------------------------- frame outlines (inner opening, centred on 0,0, CCW)
  // A drawn heart: two round lobes (overlapping, so the dip between them is shallow) and straight sides tangent to them
  // down to the point. The textbook parametric heart has a deep dip and a long thin V, which made the frame for an
  // upright object almost twice the size of a circle; this one wraps an object much more closely.
  const HEART = { aspect: 0.9 };
  function heartOutline(W, H) {
    const r = W / 3.1, a = 0.55 * r, h = Math.max(0.6 * r, H - r), L = [], dipY = Math.sqrt(r * r - a * a);
    const T = [0, -h], C = [a, 0], dx = T[0] - C[0], dy = T[1] - C[1], d = Math.hypot(dx, dy), phi = Math.atan2(dy, dx), be = Math.acos(Math.min(1, r / d));
    const t0 = phi + be, t1 = Math.atan2(dipY, -a); // outer tangent point (the one on the right) round to the dip
    L.push(T.slice());
    const n = 64; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; L.push([C[0] + r * Math.cos(t), C[1] + r * Math.sin(t)]); }
    for (let i = n - 1; i >= 0; i--) { const q = L[1 + i]; L.push([-q[0], q[1]]); }
    const ym = (r - h) / 2; return L.map(q => [q[0], q[1] - ym]); // centred on its box
  }
  const FIXED = { circle: 1, square: 1, hexagon: Math.sqrt(3) / 2, heart: HEART.aspect }; // H / W for shapes that keep their proportions
  function outline(kind, W, H) {
    const L = [];
    switch (kind) {
      case 'circle': for (let i = 0; i < 144; i++) { const t = 2 * Math.PI * i / 144; L.push([W / 2 * Math.cos(t), W / 2 * Math.sin(t)]); } break;
      case 'oval': for (let i = 0; i < 144; i++) { const t = 2 * Math.PI * i / 144, s = Math.sin(t); L.push([W / 2 * Math.cos(t) * (1 - 0.12 * s), H / 2 * s]); } break; // an egg: a little narrower at the top
      case 'square': L.push([-W / 2, -W / 2], [W / 2, -W / 2], [W / 2, W / 2], [-W / 2, W / 2]); break;
      case 'rounded': { const r = 0.2 * Math.min(W, H), c = [[W / 2 - r, -H / 2 + r, -90], [W / 2 - r, H / 2 - r, 0], [-W / 2 + r, H / 2 - r, 90], [-W / 2 + r, -H / 2 + r, 180]];
        for (const [cx, cz, a0] of c) for (let i = 0; i <= 12; i++) { const t = (a0 + 90 * i / 12) * deg; L.push([cx + r * Math.cos(t), cz + r * Math.sin(t)]); } break; }
      case 'hexagon': for (let i = 0; i < 6; i++) { const t = i * 60 * deg; L.push([W / 2 * Math.cos(t), W / 2 * Math.sin(t)]); } break;
      case 'arch': { const r = W / 2, zc = H / 2 - r; L.push([-W / 2, -H / 2], [W / 2, -H / 2]); for (let i = 0; i <= 48; i++) { const t = Math.PI * i / 48; L.push([r * Math.cos(t), zc + r * Math.sin(t)]); } break; }
      case 'heart': L.push(...heartOutline(W, H)); break;
      default: throw new Error('unknown frame shape ' + kind);
    }
    return area2(L) < 0 ? L.reverse() : L;
  }
  // Smallest opening of this shape that holds every hull point at least `margin` from the wall (or the given width).
  function fitOpening(kind, hullPts, margin, innerW) {
    const b = bbox2(hullPts), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    let W0 = 1, H0 = FIXED[kind];
    if (H0 == null) { W0 = b.w + 2 * margin; H0 = b.h + 2 * margin; if (kind === 'arch') H0 = Math.max(H0, W0 * 0.75); if (kind === 'oval') { W0 *= 1.06; } }
    // a heart keeps its look but may be up to 30% taller or 20% squatter, whichever wraps the object in the least area
    const aspects = kind === 'heart' ? [1, 0.8, 0.9, 1.1, 1.2, 1.3].map(k => H0 * k) : [H0];
    const test = (s, dz) => {
      const L = outline(kind, s * W0, s * H0).map(q => [q[0] + cx, q[1] + cz + dz]);
      for (const q of hullPts) { if (!pip(q, L) || nearestOn(q, L).d < margin - 1e-6) return null; }
      return L;
    };
    let best = null; const H00 = H0;
    const F0 = kind === 'heart' || kind === 'arch' || kind === 'oval' ? [0, -0.06, 0.06, -0.12, 0.12, -0.18, 0.18, -0.24, 0.24, -0.3, 0.3] : [0, -0.08, 0.08, -0.16, 0.16];
    for (const hA of aspects) { H0 = hA;
      // the classic proportions try every shift; stretched hearts only the shifts next to the best one so far
      const fs = hA === H00 || !best ? F0 : [best.f, best.f - 0.06, best.f + 0.06];
      for (const f of fs) {
        let lo = 0.01, hi = Math.max(b.w, b.h, 1) * 4 / Math.min(W0, H0) + 4 * margin;
        const dzOf = s => f * s * H0;
        if (!test(hi, dzOf(hi))) continue;
        for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; if (test(m, dzOf(m))) hi = m; else lo = m; }
        // a stretched heart has to win by a clear margin (3%) over the classic one
        const area = hi * hi * W0 * H0 * (hA === H00 ? 1 : 1.03);
        if (!best || area < best.area) best = { s: hi, dz: dzOf(hi), H0: hA, area, f };
      }
    }
    if (!best) best = { s: Math.max(b.w, b.h) * 2 / Math.min(W0, H00), dz: 0, H0: H00 };
    H0 = best.H0;
    let s = best.s;
    if (innerW > 0) s = innerW / W0;
    const W = s * W0, H = s * H0;
    let poly = outline(kind, W, H).map(q => [q[0] + cx, q[1] + cz + best.dz]);
    if (kind === 'heart') { // round the dip at the top: a sharp inward point has no wall behind it for a string to sink into
      const r = Math.max(2, W * 0.03), cl = T.offset(T.offset([{ outer: poly, holes: [] }], r, true), -r, true);
      if (cl.length) poly = cl.sort((a, b) => Math.abs(area2(b.outer)) - Math.abs(area2(a.outer)))[0].outer;
      if (area2(poly) < 0) poly = poly.slice().reverse();
    }
    return { kind, W, H, cx, cz: cz + best.dz, poly, autoW: best.s * W0 };
  }

  // ---------------------------------------------------------------- object preparation (rotate, centre, BVH, silhouette)
  function prepareObject(soup, rot) {
    const p = Float64Array.from(soup), r = (rot || [0, 0, 0]).map(x => (x || 0) * deg);
    const bb0 = Core.bbox(p), c0 = [0, 1, 2].map(a => (bb0.min[a] + bb0.max[a]) / 2);
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    for (let i = 0; i < p.length; i += 3) {
      let x = p[i] - c0[0], y = p[i + 1] - c0[1], z = p[i + 2] - c0[2], t;
      t = y * cx - z * sx; z = y * sx + z * cx; y = t;   // about X
      t = x * cy + z * sy; z = -x * sy + z * cy; x = t;  // about Y
      t = x * cz - y * sz; y = x * sz + y * cz; x = t;   // about Z
      p[i] = x; p[i + 1] = y; p[i + 2] = z;
    }
    const bb = Core.bbox(p), c = [0, 1, 2].map(a => (bb.min[a] + bb.max[a]) / 2);
    for (let i = 0; i < p.length; i += 3) { p[i] -= c[0]; p[i + 1] -= c[1]; p[i + 2] -= c[2]; }
    const bbc = Core.bbox(p);
    // silhouette hull in XZ and the largest radius (for the cage), from the vertices (thinned on huge meshes)
    const n = p.length / 3, step = Math.max(1, Math.floor(n / 300000)), seen = new Set(), pts = [];
    let maxR = 0;
    for (let i = 0; i < n; i += step) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]; maxR = Math.max(maxR, Math.hypot(x, y, z));
      const k = Math.round(x * 20) + ',' + Math.round(z * 20); if (seen.has(k)) continue; seen.add(k); pts.push([x, z]);
    }
    return { p, bvh: Core.buildBVH(p), hull: hull(pts), bb: bbc, maxR, tris: p.length / 9 };
  }

  // ---------------------------------------------------------------- solids
  function hexa(P) { // 8 corners like StudioTools.box: bottom 0-3, top 4-7, each counter-clockwise from below
    const f = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], out = [];
    for (const q of f) { const [a, b, c, d] = q.map(i => P[i]); out.push(...a, ...b, ...c, ...a, ...c, ...d); }
    let s = Float64Array.from(out); if (Core.signedVolume(s) < 0) s = Core.flip(s); return s;
  }
  // a bar from P0 to P1, w0 / w1 wide (along s) at its ends and h tall (along u)
  function bar(P0, P1, s, u, w0, w1, h) {
    const c = (P, w, sg, ug) => add(add(P, mul(s, sg * w / 2)), mul(u, ug * h / 2));
    return hexa([c(P0, w0, -1, -1), c(P1, w1, -1, -1), c(P1, w1, 1, -1), c(P0, w0, 1, -1), c(P0, w0, -1, 1), c(P1, w1, -1, 1), c(P1, w1, 1, 1), c(P0, w0, 1, 1)]);
  }
  function ball(C, r) { // icosphere (80 triangles)
    const t = (1 + Math.sqrt(5)) / 2; let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const mid = new Map(), m = (a, b) => { const k = a < b ? a + ':' + b : b + ':' + a; if (!mid.has(k)) { mid.set(k, V.length); V.push(norm(add(V[a], V[b]))); } return mid.get(k); };
    F = F.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
    const out = []; for (const f of F) for (const i of f) out.push(C[0] + V[i][0] * r, C[1] + V[i][1] * r, C[2] + V[i][2] * r);
    let s = Float64Array.from(out); if (Core.signedVolume(s) < 0) s = Core.flip(s); return s;
  }
  const toUW = polys => polys.map(P => ({ outer: P.outer.map(q => [q[1], q[0]]), holes: P.holes.map(h => h.map(q => [q[1], q[0]])) })); // (x, z) -> extrude's (u, w) on axis Y
  // Extrude a region in the XZ plane through Y in [y0, y1]. The region is turned by a small odd angle first and the solid
  // turned back: outlines whose corners line up exactly (a square opening inside its rounded offset) can trip earcut's
  // hole bridging into a cap that does not meet the walls; off-axis coordinates never line up.
  const TW = 0.0123;
  function extrudeXZ(polys, y0, y1) {
    const c = Math.cos(TW), s = Math.sin(TW), f = q => [q[0] * c - q[1] * s, q[0] * s + q[1] * c];
    const sol = T.extrude(toUW(polys.map(P => ({ outer: P.outer.map(f), holes: P.holes.map(h => h.map(f)) }))), 1, y0, y1);
    for (let i = 0; i < sol.length; i += 3) { const x = sol[i], z = sol[i + 2]; sol[i] = x * c + z * s; sol[i + 2] = -x * s + z * c; }
    return sol;
  }
  function rotZ(p, a) { const c = Math.cos(a), s = Math.sin(a), o = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { o[i] = p[i] * c - p[i + 1] * s; o[i + 1] = p[i] * s + p[i + 1] * c; o[i + 2] = p[i + 2]; } return o; }
  const disc = (r, n) => { const L = []; for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; L.push([r * Math.cos(t), r * Math.sin(t)]); } return L; };

  // A flat frame: 2D ring (opening + wall) with its base, extruded through the depth; in the upright layout the stand also
  // gets a deeper foot block so it does not tip.
  function flatFrame(open, o, D) {
    const Tk = o.thick, inner = [{ outer: open.poly, holes: [] }];
    const outerP = T.offset(inner, Tk, true), ob = bbox2(outerP[0].outer);
    let region = T.diffPolys(outerP, inner);
    const info = { outer: outerP[0].outer, ob, footW: 0, footH: 0, cut: 0, loop: null };
    if (o.base === 'stand') {
      const fw = Math.max(Math.min(ob.w, 40), ob.w * 0.55), fh = Math.max(4, Tk * 0.8), top = ob.z0 + Tk * 0.6;
      const foot = [{ outer: [[-fw / 2 + open.cx, ob.z0 - fh], [fw / 2 + open.cx, ob.z0 - fh], [fw / 2 + open.cx, top], [-fw / 2 + open.cx, top]], holes: [] }];
      region = T.diffPolys(T.unionPolys(region.concat(foot)), inner);
      Object.assign(info, { footW: fw, footH: fh, footZ0: ob.z0 - fh, footTop: top });
    } else if (o.base === 'flat') {
      // cut the bottom flat where it is wide enough to stand on (round shapes); flat-bottomed shapes are left alone
      const want = Math.min(ob.w * 0.4, 50); let c = 0;
      for (; c <= Tk * 0.6; c += 0.1) { const xs = []; const L = info.outer; for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], z = ob.z0 + c; if ((a[1] - z) * (b[1] - z) < 0) xs.push(a[0] + (z - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } if (xs.length >= 2 && Math.max(...xs) - Math.min(...xs) >= want) break; }
      c = Math.min(c, Tk * 0.6);
      if (c > 0.05) region = T.diffPolys(region, [{ outer: [[ob.x0 - 5, ob.z0 - 5], [ob.x1 + 5, ob.z0 - 5], [ob.x1 + 5, ob.z0 + c], [ob.x0 - 5, ob.z0 + c]], holes: [] }]);
      info.cut = c;
    } else if (o.base === 'loop') {
      const r = Math.max(5, Tk * 1.2), ri = Math.max(2.5, r - Math.max(2.5, Tk * 0.6)), zc = ob.z1 + r * 0.55;
      // the loop is a thin ring on the back face (so laid flat it starts on the plate), sunk into the top of the frame
      const ringL = [{ outer: disc(r, 48).map(q => [q[0] + open.cx, q[1] + zc]), holes: [disc(ri, 48).map(q => [q[0] + open.cx, q[1] + zc]).reverse()] }];
      info.loop = { r, ri, zc, polys: T.diffPolys(ringL, inner), depth: Math.min(D, Math.max(3, Tk * 0.7)) };
    }
    const solids = [extrudeXZ(region, -D / 2, D / 2)];
    if (info.loop) solids.push(extrudeXZ(info.loop.polys, -D / 2, -D / 2 + info.loop.depth));
    if (o.base === 'stand' && o.layout === 'upright') {
      const all = bbox2(region.flatMap(P => P.outer)), H = all.h, Df = Math.max(D, Math.min(H * 0.38, 90));
      if (Df > D + 0.5) { solids.push(T.box(open.cx - info.footW / 2, -Df / 2, info.footZ0, open.cx + info.footW / 2, Df / 2, info.footZ0 + info.footH)); info.footD = Df; }
    }
    info.region = region;
    return { solids, info };
  }
  // A sphere cage: `ribs` great circles through the vertical axis, an equator ring and a round foot.
  function cageFrame(obj, o) {
    const Tk = o.thick, Rin = obj.maxR + o.margin, Rout = Rin + Tk, wr = Math.max(2, Tk * 0.8), k = Math.max(2, Math.round(o.ribs || 3)), solids = [];
    const ann = [{ outer: disc(Rout, 128), holes: [disc(Rin, 128).reverse()] }];
    const merid = extrudeXZ(ann, -wr / 2, wr / 2);
    for (let j = 0; j < k; j++) solids.push(rotZ(merid, (o.turn || 0) * deg + Math.PI * j / k));
    solids.push(T.extrude(ann, 2, -wr / 2, wr / 2)); // equator (axis Z: u = x, w = y)
    let foot = null;
    if (o.base !== 'none' && o.base !== 'loop') {
      const rb = Math.max(Rout * 0.45, 22), fh = Math.max(4, Tk * 0.8), top = -Rout + Tk * 0.6;
      solids.push(T.extrude([{ outer: disc(rb, 72), holes: [] }], 2, -Rout - fh, top)); foot = { rb, fh, z0: -Rout - fh };
    }
    if (o.base === 'loop') { const r = Math.max(5, Tk * 1.2), ri = Math.max(2.5, r - Math.max(2.5, Tk * 0.6)), zc = Rout + r * 0.55; solids.push(extrudeXZ([{ outer: disc(r, 48).map(q => [q[0], q[1] + zc]), holes: [disc(ri, 48).map(q => [q[0], q[1] + zc]).reverse()] }], -wr / 2, wr / 2)); }
    return { solids, info: { Rin, Rout, wr, ribs: k, foot } };
  }
  // A cube (box) cage: 12 square edge beams, T x T, round an inner box fitted to the object with the gap (or a fixed
  // cube of edge innerW). It stands on its 4 bottom beams, flat on the bed. Strings start on the beam centre lines.
  // mids: face-centre posts to add (0..3: the faces at -Y, +X, +Y, -X), upright from the bottom beam to the top one, for
  // strings the corner posts have no room for (a narrow object pulls every corner string to the same few spots).
  const MID_FACES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function cubeFrame(obj, o, mids) {
    const Tk = o.thick, bb = obj.bb, off = o.off;
    const h = o.fit === false && o.innerW > 0 ? [0, 1, 2].map(() => o.innerW / 2) : [0, 1, 2].map(a => Math.max(Math.abs(bb.min[a] + off[a]), Math.abs(bb.max[a] + off[a])) + o.margin);
    const c = h.map(x => x + Tk / 2), solids = [], segs = [];
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) segs.push([[-c[0], sy * c[1], sz * c[2]], [c[0], sy * c[1], sz * c[2]], 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) segs.push([[sx * c[0], -c[1], sz * c[2]], [sx * c[0], c[1], sz * c[2]], 1]);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) segs.push([[sx * c[0], sy * c[1], -c[2]], [sx * c[0], sy * c[1], c[2]], 2]);
    for (const k of mids || []) { const [fx, fy] = MID_FACES[k]; segs.push([[fx * c[0], fy * c[1], -c[2]], [fx * c[0], fy * c[1], c[2]], 2, k]); }
    for (const [A, B, ax] of segs) { // every beam runs the full outer length, so the corners are solid
      const d = ax === 0 ? X : ax === 1 ? Y : Z, e = mul(d, Tk / 2), sd = ax === 0 ? Y : X, up = ax === 2 ? Y : Z;
      solids.push(bar(sub(A, e), add(B, e), sd, up, Tk, Tk, Tk));
    }
    return { solids, info: { h, c, T: Tk, segs, span: 2 * Math.max(c[0], c[1]) } };
  }
  function nearestSeg(segs, P) {
    let best = null, bd = Infinity;
    for (const [A, B] of segs) { const ab = sub(B, A), t = clamp(dot(sub(P, A), ab) / dot(ab, ab), 0, 1), Q = add(A, mul(ab, t)), dd = len(sub(P, Q)); if (dd < bd) { bd = dd; best = Q; } }
    return best;
  }
  function slideSeg(segs, P, by) { // the nearest beam point to P, moved `by` mm along its beam (stays on the beam)
    let best = null, bd = Infinity;
    for (const [A, B] of segs) { const ab = sub(B, A), L2 = dot(ab, ab), t = clamp(dot(sub(P, A), ab) / L2, 0, 1), Q = add(A, mul(ab, t)), dd = len(sub(P, Q)); if (dd < bd) { bd = dd; best = add(A, mul(ab, clamp(t + by / Math.sqrt(L2), 0, 1))); } }
    return best;
  }
  function segPoint(segs, u) { // a point a fraction u of the way round all the beams
    const L = segs.map(([A, B]) => len(sub(B, A))), tot = L.reduce((a, b) => a + b, 0); let x = ((u % 1) + 1) % 1 * tot;
    for (let i = 0; i < segs.length; i++) { if (x <= L[i] || i === segs.length - 1) { const [A, B] = segs[i]; return add(A, mul(sub(B, A), Math.min(1, x / L[i]))); } x -= L[i]; }
  }

  // ---------------------------------------------------------------- strings
  // cast from frame point F (3D) along unit d towards the object (offset `off`): first hit, and how far the object goes on
  // A hit that only grazes the surface (under MIN_THROUGH of material along the ray) ends no string. Aim-point searches (skip) go
  // on to the next entry. So every anchor has room to embed, and no string touches the object on its way in.
  const MIN_THROUGH = 0.8;
  // A string itself never skips (it would touch the object on the way); finding aim points may (skip = true).
  // Ray hits are cached per object (keyed by the ray in object coordinates), so a rebuild after a thickness, anchor,
  // base or frame tweak re-casts almost nothing. Cached without a length limit; maxT is applied afterwards (same result).
  function castObj(obj, off, F, d, maxT, skip) {
    const o0 = sub(F, off), key = (skip ? 's' : 'n') + o0.join(',') + '|' + d.join(','), cache = obj._hits || (obj._hits = new Map());
    let r = cache.get(key);
    if (r === undefined) {
      r = null; let o = o0, base = 0;
      for (let k = 0; k < (skip ? 6 : 1); k++) {
        const t = Core.rayNearest(obj.bvh, o, d); if (!isFinite(t)) break;
        const hit = add(o, mul(d, t)), t2 = Core.rayNearest(obj.bvh, add(hit, mul(d, 1e-4)), d), th = isFinite(t2) ? t2 + 1e-4 : 0;
        if (th >= MIN_THROUGH) { r = { t: base + t, through: th }; break; }
        if (!isFinite(t2)) break;
        base += t + th + 1e-4; o = add(hit, mul(d, th + 1e-4)); // past the sliver, on to the next entry
      }
      if (cache.size > 300000) cache.clear();
      cache.set(key, r);
    }
    return r && r.t < maxT ? { t: r.t, A: add(F, mul(d, r.t)), through: r.through } : null;
  }
  function surfaceFrom(obj, off, Pc, dir, R, perp) { // outermost surface point of the object seen from far out along dir (in a plane)
    // straight at the centre first; past a gap (between fingers, under an arm) try parallel lines a little to each side
    for (const k of perp ? [0, 0.12, -0.12, 0.25, -0.25, 0.4, -0.4] : [0]) {
      const far = add(add(Pc, mul(dir, R)), perp ? mul(perp, k * obj.maxR) : [0, 0, 0]), h = castObj(obj, off, far, mul(dir, -1), R * 2, true); if (h) return h.A;
    }
    return null;
  }
  // How much of the object a string plane Y = y would catch: hits of a fan of in-plane rays (8 directions x 4 lines).
  function planeScore(obj, off, y, c2, R) {
    let n = 0;
    for (let i = 0; i < 8; i++) {
      const th = Math.PI * 2 * (i + 0.5) / 8, u = [Math.cos(th), 0, Math.sin(th)], v = [-u[2], 0, u[0]];
      for (const k of [-0.45, -0.15, 0.15, 0.45]) { const P = add(add([c2[0], y, c2[1]], mul(u, R)), mul(v, k * obj.maxR)); if (castObj(obj, off, P, mul(u, -1), R * 2, true)) n++; }
    }
    return n;
  }
  // String planes: the depths where the object has the most to hold on to, spread apart (a hand's fingers, a figure's
  // body), not blindly evenly spaced through planes that may cut almost nothing.
  function pickPlanes(obj, off, by0, by1, layers, w, c2, R) {
    if (!(by1 > by0)) return [(by0 + by1) / 2];
    const M = 15, cand = Array.from({ length: M }, (_, j) => by0 + (by1 - by0) * (0.08 + 0.84 * j / (M - 1)));
    const score = cand.map(y => planeScore(obj, off, y, c2, R)), best = Math.max(...score);
    const even = Array.from({ length: layers }, (_, L) => by0 + (by1 - by0) * (layers === 1 ? 0.5 : 0.15 + 0.7 * L / (layers - 1)));
    if (best <= 0) return even;
    const sep = Math.max(3 * w + 1.5, (by1 - by0) / (layers + 1)), out = [];
    const order = cand.map((y, j) => j).sort((a, b) => score[b] - score[a] || Math.abs(cand[a] - (by0 + by1) / 2) - Math.abs(cand[b] - (by0 + by1) / 2));
    for (const j of order) { if (out.length >= layers) break; if (score[j] < best * 0.35) break; if (out.every(y => Math.abs(y - cand[j]) >= sep)) out.push(cand[j]); }
    for (const y of even) { if (out.length >= layers) break; if (out.every(q => Math.abs(q - y) >= sep * 0.6)) out.push(y); }
    return out.sort((a, b) => a - b);
  }
  // a closed polyline measured by arc length: point at s, and the arc position of the nearest point to q
  function perimeter(L) {
    const cum = [0]; for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const P = cum[L.length];
    const at = s => { s = ((s % P) + P) % P; let lo = 0, hi = L.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= s) lo = m; else hi = m - 1; }
      const a = L[lo], b = L[(lo + 1) % L.length], f = (s - cum[lo]) / Math.max(1e-12, cum[lo + 1] - cum[lo]); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
    const of = q => { let best = Infinity, bs = 0; for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
      const t = l2 ? clamp(((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / l2, 0, 1) : 0, d = (q[0] - a[0] - t * dx) ** 2 + (q[1] - a[1] - t * dz) ** 2; if (d < best) { best = d; bs = cum[i] + t * (cum[i + 1] - cum[i]); } } return bs; };
    return { P, at, of };
  }
  // Every pattern is a list of string slots. A slot tries its ideal spot first, then a few nearby ones (a little round,
  // along or up and down), and takes the first that sinks into a thick enough bit of the object (else the thickest it
  // found) and keeps both of its ends at least 3 string thicknesses from every other string's ends. Straight,
  // crisscross and hanging strings are placed a whole evenly spaced set at a time (the set is slid and squeezed
  // together, never broken up). Flat frames also retry slots that found nothing in extra string planes between the
  // layers, so thin or spread-out objects (fingers, arms) still get the count asked for wherever it is physically possible.
  // Which generated strings an edit belongs to: same pattern, count, layers, turn and seed means the same slots.
  function stringSig(o) { return [o.pattern, Math.round(o.count), Math.round(o.layers), +(o.turn || 0), o.seed].join('|'); }
  // Dragged strings. An edit is { F, A, sig, base }: F the frame end (world), A the object end relative to the object
  // (so it moves with the object), sig the pattern it was dragged in, base the whole string when it was dragged.
  // In the same pattern it replaces its own slot; after the pattern, count, layers or turn change it stays as a pinned
  // extra string. Each is rebuilt against the current frame and object (the frame end slides to the nearest frame
  // point); one that no longer reaches is left out and listed in out.lost.
  function applyEdits(out, edits, o, sig, rebuild) {
    const off = o.off; out.lost = [];
    for (const [id, e] of Object.entries(edits)) {
      const k = out.findIndex(s => s.id === id), same = !e.sig || e.sig === sig, s0 = same && k >= 0 ? out[k] : null, base = e.base;
      if (!s0 && !base) continue;
      const F = e.F || (s0 ? s0.F : base.F), A = add(e.A || (s0 ? sub(s0.A, off) : base.A), off);
      const r = rebuild(F, A, s0 ? s0.plane : base.plane, e);
      if (s0) { if (r) out[k] = Object.assign({}, s0, r, { edited: true, editId: id }); else { out.splice(k, 1); out.lost.push(id); } }
      else if (r) out.push(Object.assign({ id: 'p:' + id, layer: base.layer || 0 }, r, { edited: true, pinned: true, editId: id }));
      else out.lost.push(id);
    }
  }
  // the cage's ribs: meridian half-circles of radius Rin at the angles phis; nearest rib point to P
  function nearestRib(phis, Rin, P) {
    let best = null, bd = Infinity;
    for (const phi of phis) {
      const c = Math.cos(phi), s = Math.sin(phi), u = P[0] * c + P[1] * s, v = P[2]; if (u <= 0) continue;
      const r = Math.hypot(u, v), Q = [Rin * u / r * c, Rin * u / r * s, Rin * v / r], dd = len(sub(P, Q)); if (dd < bd) { bd = dd; best = Q; }
    }
    return best;
  }
  function makeStrings(obj, frame, o) {
    const out = [], off = o.off, N = Math.max(1, Math.round(o.count)), layers = Math.max(1, Math.round(o.layers)), w = o.string, R = obj.maxR * 2 + 50;
    const edits = o.edits || {}, thick = Math.max(1.5, 2 * w), sig = stringSig(o), sep = Math.max(1.2, 3 * w); // ends this far apart at least (3 strand widths: a clear gap of 2 lines)
    let requested = 0;
    const push = (id, layer, plane, F, A, d, hit, extra) => out.push(Object.assign({ id, layer, plane, F, A, d, t: hit.t, through: hit.through }, extra || {}));
    const far = (P, key, list) => { for (const s of list) if (len(sub(P, s[key])) < sep) return false; return true; };
    // same layer: the whole span keeps the gap too, so two strands never run together into a wider bead; a clean crossing
    // (at least 25 degrees apart, like a woven grid) is fine, it is one line meeting another on that layer
    const ua = frame.upAxis, pa = [0, 1, 2].filter(k => k !== ua), seg2 = (P, Q, R, S) => {
      const p = [P[pa[0]], P[pa[1]]], r = [Q[pa[0]] - p[0], Q[pa[1]] - p[1]], q = [R[pa[0]], R[pa[1]]], u = [S[pa[0]] - q[0], S[pa[1]] - q[1]];
      const cr = r[0] * u[1] - r[1] * u[0], lr = Math.hypot(...r), lu = Math.hypot(...u), qp = [q[0] - p[0], q[1] - p[1]];
      if (Math.abs(cr) > 1e-12) { const t = (qp[0] * u[1] - qp[1] * u[0]) / cr, v = (qp[0] * r[1] - qp[1] * r[0]) / cr; if (t > 0 && t < 1 && v > 0 && v < 1) return Math.abs(cr) / (lr * lu) > Math.sin(15 * Math.PI / 180) ? Infinity : 0; }
      const pd = (a, b, d) => { const L2 = d[0] * d[0] + d[1] * d[1], t = Math.max(0, Math.min(1, ((a[0] - b[0]) * d[0] + (a[1] - b[1]) * d[1]) / L2)); return Math.hypot(a[0] - b[0] - d[0] * t, a[1] - b[1] - d[1] * t); };
      return Math.min(pd(p, q, u), pd([p[0] + r[0], p[1] + r[1]], q, u), pd(q, p, r), pd([q[0] + u[0], q[1] + u[1]], p, r)); };
    const surf = s => s.d && s.t > 0 ? [s.F[0] + s.d[0] * s.t, s.F[1] + s.d[1] * s.t, s.F[2] + s.d[2] * s.t] : s.A; // the free span ends at the object's surface
    const spanOk = (F, S, list) => { for (const s of list) if (Math.abs(s.F[ua] - F[ua]) < 1e-6 && seg2(F, S, s.F, surf(s)) < sep) return false; return true; };
    const fits = (F, A, list, S) => far(F, 'F', list) && far(A, 'A', list) && spanOk(F, S || A, list);
    const cast = q => { if (!q || !(len(q.d) > 0.5)) return null; const h = castObj(obj, off, q.F, q.d, q.maxT); return h ? { q, h } : null; };
    // cands: functions returning { F, d, maxT, plane, extra } or null. Returns true when the slot was placed.
    // rescue: a wide search (limit = how many more candidates to look at once one fits; a per-build budget of casts)
    const budget = { left: 9000 };
    const place = (id, L, cands, limit) => {
      let best = null, after = 0, seen = 0;
      for (const c of cands) {
        if (limit) { if (best && ++after > limit) break; if (--budget.left < 0 || ++seen > 1500) break; }
        const x = cast(c()); if (!x || !fits(x.q.F, x.h.A, out, surf({ F: x.q.F, d: x.q.d, t: x.h.t, A: x.h.A }))) continue;
        if (!best || x.h.through > best.h.through) best = x;
        if (x.h.through >= thick) break;
      }
      if (!best) return false;
      push(id, L, best.q.plane, best.q.F, best.h.A, best.q.d, best.h, best.q.extra); return true;
    };
    // a set of strings placed together: each candidate set is a list of member specs (functions, or null); the set that
    // places the most members (ties: the earlier, more ideal one) wins. Returns the members that found nothing.
    const placeSet = (ids, L, sets) => {
      let best = null;
      for (const set of sets) {
        const got = [];
        set.forEach((m, i) => { const x = m && cast(m()); const S = x && surf({ F: x.q.F, d: x.q.d, t: x.h.t, A: x.h.A }); if (x && fits(x.q.F, x.h.A, out, S) && fits(x.q.F, x.h.A, got.map(g => ({ F: g.x.q.F, A: g.x.h.A, d: g.x.q.d, t: g.x.h.t })), S)) got.push({ i, x }); });
        if (!best || got.length > best.got.length) best = { got, set, k: sets.indexOf(set) };
        if (got.length === set.length) break;
      }
      const done = new Set();
      if (best) for (const { i, x } of best.got) { push(ids[i], L, x.q.plane, x.q.F, x.h.A, x.q.d, x.h, x.q.extra); done.add(i); }
      const left = ids.map((id, i) => ({ id, i })).filter(e => !done.has(e.i)); left.k = best ? best.k : 0; return left;
    };
    const slot = (id, L, cands) => { requested++; return place(id, L, cands); };
    // Every slot also gets a wide fallback search (want): other anchor points on the object (round the outline, from
    // other planes), other frame points along the wall, jittered heights and angles. The rescue pass runs it for every
    // slot still empty after the ideal pass, so tight models (fingers, limbs) still get the count asked for, with the
    // ends kept 3 thicknesses apart.
    const want = [];
    const rescue = () => { const have = new Set(out.map(s => s.id)); for (const wt of want) if (!have.has(wt.id) && place(wt.id, wt.L, wt.more(), 24)) { have.add(wt.id); out[out.length - 1].rescued = true; } };
    function* sweep(c, lo, hi, step) { if (c >= lo && c <= hi) yield c; for (let k = 1; k < 4000; k++) { const a = c + k * step, b = c - k * step; if (a > hi && b < lo) return; if (a <= hi) yield a; if (b >= lo) yield b; } }
    const angGap = (a, b) => { const x = Math.abs(a - b) % (2 * Math.PI); return Math.min(x, 2 * Math.PI - x); };
    const spread = [0, 0.25, -0.25, 0.5, -0.5];
    // Cages print standing up, so every string there is level (horizontal) on one layer: the layer heights (snapped to
    // the printer's layer grid) are spread through the object, or for hanging strings through its top part, where it
    // hangs from bridges at the top. Strings sharing a post or rib on a layer start side by side across it, 3 widths apart.
    const layerZs = (a, b) => {
      const hang = o.pattern === 'pendant', zs = [];
      for (let L = 0; L < layers; L++) {
        const f = hang ? (layers === 1 ? 0.86 : 0.9 - 0.3 * L / (layers - 1)) : (layers === 1 ? 0.5 : 0.2 + 0.6 * L / (layers - 1));
        let z = frame.snap(a + (b - a) * f); while (zs.some(q => Math.abs(q - z) < frame.strH - frame.layerH * 0.5)) z = frame.snap(z + frame.layerH * (hang ? -1 : 1));
        zs.push(z);
      }
      return zs;
    };
    const across = half => { const g = sep * 1.02, r = [0]; for (let k = 1; k * g <= half + 1e-9; k++) r.push(k * g, -k * g); return r; }; // offsets across a post or rib
    const turnA = clamp((((o.turn || 0) + 180) % 360 + 360) % 360 - 180, -35, 35) * deg; // a cube's strings can only swing so far from a post
    if (frame.kind === 'cube') {
      const { segs, T: Tk } = frame.info, z0 = obj.bb.min[2] + off[2], z1 = obj.bb.max[2] + off[2], ctr = [off[0], off[1], (z0 + z1) / 2];
      const posts = segs.filter(q => q[2] === 2), offs = across(Math.max(0, Tk * 0.45 - w / 2)), zs = layerZs(z0, z1);
      const postF = (j, z, oo) => { const q = posts[j][0], u0 = norm([ctr[0] - q[0], ctr[1] - q[1], 0]); return [q[0] - u0[1] * oo, q[1] + u0[0] * oo, z]; };
      const inward = j => { const q = posts[j][0]; return Math.atan2(ctr[1] - q[1], ctr[0] - q[0]); };
      const lvl = (F, a, pj) => () => ({ F, d: [Math.cos(a), Math.sin(a), 0], maxT: R * 2, plane: { axis: 2, v: F[2] }, extra: { fr: 'post', post: pj || 0 } });
      const toP = (F, P, pj) => () => { if (!P) return null; const v = [P[0] - F[0], P[1] - F[1], 0], l = len(v); return l < 0.5 ? null : { F, d: mul(v, 1 / l), maxT: l + 2, plane: { axis: 2, v: F[2] }, extra: { fr: 'post', post: pj || 0 } }; };
      const mids = posts.map((q, k) => k).filter(k => k >= 4); // face-centre posts: only the rescue uses them
      const r = rng(o.seed * 6007 + 3);
      zs.forEach((z, L) => {
        for (let n = 0; n < N; n++) {
          const j = (n + L) % 4, m = Math.floor(n / 4), a0 = inward(j);
          const id = `q${L}:${j}:${m}`, rnd = (r() - 0.5) * 70 * deg;
          const aimAt = (F2, da, jj = j) => { // the object point seen from the centre towards this post (a little round), at this height
            const th = inward(jj) + Math.PI + da, u = [Math.cos(th), Math.sin(th), 0]; return toP(F2, surfaceFrom(obj, off, [ctr[0], ctr[1], z], u, R, [-u[1], u[0], 0]), jj); };
          // side by side on one post the strings fan out a little (left of the post's inward line turns left), so they never
          // run together on their layer
          const angs = (F2, o2) => { const c2 = a0 + (o2 || 0) / sep * 7 * deg;
            switch (o.pattern) {
              case 'grid': case 'spokes': return [0, 6, -6, 12, -12, 20, -20].map(e => lvl(F2, c2 + turnA + e * deg));
              case 'web': { const sg = (m + L) % 2 ? -1 : 1; return [15, 10, 20, 6, 26].map(e => lvl(F2, c2 + turnA + sg * e * deg)); }
              case 'random': return [0, 8, -8, 16, -16].map(e => lvl(F2, c2 + rnd + e * deg));
              default: return [0, 0.2, -0.2, 0.4, -0.4].map(e => aimAt(F2, e + turnA + (o2 || 0) / sep * 0.12)).concat([lvl(F2, c2)]);
            } };
          slot(id, L, offs.slice(m % offs.length).concat(offs.slice(0, m % offs.length)).flatMap(o2 => angs(postF(j, z, o2), o2)));
          // the face-centre posts nearest this corner come after the corner posts
          const midOrder = mids.slice().sort((a, b) => angGap(inward(a), a0) - angGap(inward(b), a0));
          want.push({ id, L, more: function* () { for (const jj of [j, (j + 1) % 4, (j + 3) % 4, (j + 2) % 4].concat(midOrder)) for (const o2 of offs) { const F2 = postF(jj, z, o2), c2 = inward(jj) + o2 / sep * 7 * deg;
            for (const e of sweep(0, -32, 32, 4)) yield lvl(F2, c2 + e * deg, jj); for (const e of [0, 0.3, -0.3, 0.6, -0.6]) yield aimAt(F2, e, jj); } } });
        }
      });
      rescue();
      applyEdits(out, edits, o, sig, (F0, A, plane, e) => { // level again: at the dragged end's layer, from the nearest post (across it), aimed at the object end
        const z = frame.snap(e && e.F && !e.A ? F0[2] : A[2]);
        let j = 0, bd = Infinity; posts.forEach((q, k) => { const dd = Math.hypot(q[0][0] - F0[0], q[0][1] - F0[1]); if (dd < bd) { bd = dd; j = k; } });
        const q = posts[j][0], u0 = norm([ctr[0] - q[0], ctr[1] - q[1], 0]), oo = clamp((F0[0] - q[0]) * -u0[1] + (F0[1] - q[1]) * u0[0], -Math.max(0, Tk * 0.45 - w / 2), Math.max(0, Tk * 0.45 - w / 2));
        const F = postF(j, z, oo), v = [A[0] - F[0], A[1] - F[1], 0], l = len(v); if (l < 0.5) return null;
        const d = mul(v, 1 / l), h = castObj(obj, off, F, d, R * 2); if (!h) return null;
        return { F, A: h.A, d, t: h.t, through: h.through, plane: { axis: 2, v: z }, fr: 'post', post: j };
      });
      out.requested = requested; return out;
    }
    if (frame.kind === 'cage') {
      const { Rin, ribs, wr } = frame.info, bz0 = obj.bb.min[2] + off[2], bz1 = obj.bb.max[2] + off[2], ctr = [off[0], off[1]];
      const dirs = []; for (let j = 0; j < 2 * ribs; j++) dirs.push((o.turn || 0) * deg + Math.PI * j / ribs);
      const nd = dirs.length, order = Array.from({ length: nd }, (_, i) => i).sort((a, b) => { // spread round: 0, half way, quarters...
        const key = i => { let v = 0, f = 0.5, x = i; for (let b = nd; b > 1; b >>= 1) { v += (x & 1) * f; x >>= 1; f /= 2; } return v; }; return key(a) - key(b) || a - b; });
      const ribOf = i => dirs[order[i % nd] % nd], rowOf = i => Math.floor(i / nd), offs = across(Math.max(0, wr / 2 - w / 2 - 0.05));
      const r = rng(o.seed * 7919 + 13), zs = layerZs(bz0, bz1).filter(z => Math.abs(z) < Rin - 1);
      // a level string from the rib at angle phi, height z, offset oo across the rib, turned jit from straight in
      const ring = (phi, z, oo, jit, spoke) => () => {
        const ri = Math.sqrt(Math.max(0, Rin * Rin - z * z)); if (ri < 1) return null;
        const c = Math.cos(phi), s2 = Math.sin(phi), F = [ri * c - s2 * oo, ri * s2 + c * oo, z];
        const d = spoke ? norm([ctr[0] - F[0], ctr[1] - F[1], 0]) : norm([-Math.cos(phi + jit), -Math.sin(phi + jit), 0]);
        return { F, d, maxT: ri * 2, plane: { axis: 2, v: z }, extra: { fr: 'rib' } };
      };
      zs.forEach((z, L) => {
        for (let i = 0; i < N; i++) {
          let phi = ribOf(i), m = rowOf(i), oo = offs[m % offs.length], jits;
          switch (o.pattern) {
            case 'spokes': jits = [[0, 1], [0.12, 0], [-0.12, 0], [0.25, 0], [-0.25, 0]]; break;
            case 'grid': jits = [[0, 0], [0.06, 0], [-0.06, 0], [0.12, 0], [-0.12, 0]]; break;
            case 'web': { const sg = (m + L + i) % 2 ? -1 : 1; jits = [0.3, 0.22, 0.38, 0.15].map(j => [sg * j, 0]); break; }
            case 'random': phi = dirs[Math.floor(r() * nd)]; oo = offs[Math.floor(r() * offs.length)]; { const j0 = (r() - 0.5) * 0.8; jits = [j0, j0 + 0.1, j0 - 0.1, 0].map(j => [j, 0]); } break;
            default: jits = [[0, 0], [0.12, 0], [-0.12, 0], [0.25, 0], [-0.25, 0]];
          }
          const id = `c${L}:${i}`, p0 = phi, o0 = oo;
          slot(id, L, [o0].concat(offs.filter(x => x !== o0)).flatMap(o2 => jits.map(([j, sp]) => ring(p0, z, o2, j, sp))));
          want.push({ id, L, more: function* () { // the same layer: the nearest ribs first, every spot across them, aimed a little to either side
            for (const ph of dirs.slice().sort((a, b) => angGap(a, p0) - angGap(b, p0))) for (const o2 of offs) for (const j of [0, 0.12, -0.12, 0.25, -0.25, 0.4, -0.4]) yield ring(ph, z, o2, j, false); } });
        }
      });
      rescue();
      applyEdits(out, edits, o, sig, (F0, A, plane, e) => { // level again: at the dragged end's layer, from the nearest rib (across it), aimed at the object end
        const z = frame.snap(e && e.F && !e.A ? F0[2] : A[2]); if (Math.abs(z) >= Rin - 1) return null;
        let phi = dirs[0], bd = Infinity; for (const p of dirs) { const g = angGap(p, Math.atan2(F0[1], F0[0])); if (g < bd) { bd = g; phi = p; } }
        const om = Math.max(0, wr / 2 - w / 2 - 0.05), oo = clamp(-F0[0] * Math.sin(phi) + F0[1] * Math.cos(phi), -om, om);
        const q = ring(phi, z, oo, 0, false)(); if (!q) return null; const F = q.F, v = [A[0] - F[0], A[1] - F[1], 0], l = len(v); if (l < 0.5) return null;
        const d = mul(v, 1 / l), h = castObj(obj, off, F, d, R * 2); if (!h) return null;
        return { F, A: h.A, d, t: h.t, through: h.through, plane: { axis: 2, v: z }, fr: 'rib' };
      });
      out.requested = requested; return out;
    }
    // flat frames: string planes at Y = y_k through the object's depth
    // string planes keep clear of the frame's faces by wm (at least 2 mm, in 0.5 mm steps): a thickness tweak keeps the
    // same planes, so its rebuild reuses the cached ray hits
    const wm = Math.max(2, Math.ceil(w * 2) / 2), D = frame.D, inner = frame.open.poly, by0 = Math.max(obj.bb.min[1] + off[1], -D / 2 + wm), by1 = Math.min(obj.bb.max[1] + off[1], D / 2 - wm);
    const c2 = [off[0], off[2]], hp = obj.hull.map(q => [q[0] + off[0], q[1] + off[2]]);
    const pk = [off, by0, by1, layers, wm].join('|'), cache = obj._planes || (obj._planes = new Map()); // same object and placement: same planes
    if (!cache.has(pk)) { if (cache.size > 40) cache.clear(); cache.set(pk, pickPlanes(obj, off, by0, by1, layers, wm, c2, R)); }
    // laid flat, every plane is one layer of the print: each snaps to the layer grid (a string is exactly one layer high)
    const ys = []; for (const y0 of cache.get(pk)) { let y = frame.snap(y0); while (ys.some(q => Math.abs(q - y) < frame.strH - frame.layerH * 0.5)) y = frame.snap(y + frame.layerH); if (y >= by0 - frame.layerH && y <= by1 + frame.layerH) ys.push(y); }
    if (!ys.length) ys.push(frame.snap((by0 + by1) / 2));
    const at = (q, y) => [q[0], y, q[1]], d3 = v => norm([v[0], 0, v[1]]);
    const span = (u, ext) => { const v = [-u[1], u[0]]; let a = Infinity, b = -Infinity; for (const q of hp) { const s = (q[0] - c2[0]) * v[0] + (q[1] - c2[1]) * v[1]; a = Math.min(a, s); b = Math.max(b, s); } return [a * ext, b * ext, v]; };
    const spec = (y, F2, dir2, maxT, extra) => ({ F: at(F2, y), d: d3(dir2), maxT, plane: { axis: 1, v: y }, extra });
    const turn = (o.turn || 0) * deg, per0 = perimeter(inner);
    const work = []; // { id, L, y, cands } single slots, or { set: true, ids, L, y, sets(yy) }, in placement order
    // evenly spaced sets: k positions centred on mid + c, g apart; slid (c) and squeezed (g) as one, never below sep
    const evenSets = (k, mid, g0, W) => {
      const gs = k === 1 ? [0] : [1, 0.85, 0.7, 0.55, 0.42].map(f => g0 * f).filter((g, i) => i === 0 || g >= sep * 1.2), out2 = [];
      for (const g of gs) for (const c of k === 1 ? [0, 0.15, -0.15, 0.3, -0.3].map(f => f * W) : [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75].map(f => f * g)) out2.push(Array.from({ length: k }, (_, j) => mid + c + (j - (k - 1) / 2) * g));
      return out2;
    };
    const planesNear = y0 => [y0]; // a slot keeps its layer: 'Layers' is how many layer heights carry strings
    const tieTo = (P2, F2, yy) => () => { const v = [P2[0] - F2[0], P2[1] - F2[1]], l = Math.hypot(v[0], v[1]); return l < 0.3 ? null : spec(yy, F2, [v[0] / l, v[1] / l], l + 2); };
    function* aroundMore(th0, y0) { // object points round the outline near the ideal angle (any plane), each from its nearest wall point or slid along the wall
      const dth = 2 * Math.PI / Math.max(24, N * 4);
      for (const yy of planesNear(y0)) for (const th of sweep(th0, th0 - Math.PI, th0 + Math.PI - 1e-9, dth)) {
        const u = [Math.cos(th), Math.sin(th)], P = surfaceFrom(obj, off, [c2[0], yy, c2[1]], [u[0], 0, u[1]], R, [-u[1], 0, u[0]]); if (!P) continue;
        const P2 = [P[0], P[2]]; if (!pip(P2, inner)) continue;
        const s0 = per0.of(nearestOn(P2, inner).p);
        for (const m of [0, 1, -1, 2, -2, 3, -3]) yield tieTo(P2, per0.at(s0 + m * sep * 1.25), yy);
      }
    }
    ys.forEach((y, L) => {
      const r = rng(o.seed * 104729 + L * 977 + 1), sh = (L % 2) * 0.5, add1 = (id, cands, th0) => { work.push({ id, L, y, cands }); want.push({ id, L, more: () => aroundMore(th0, y) }); };
      const lines = dirs => { // straight lines across the object, evenly spaced: one string from each end of every line
        const per = Math.max(1, Math.round(N / (2 * dirs.length))); let n = 0;
        dirs.forEach((ang, di) => {
          const u = [Math.cos(ang), Math.sin(ang)], [a, b, v] = span(u, 0.8), g0 = per === 1 ? 0 : (b - a) / (per - 1);
          const sets = evenSets(per, (a + b) / 2 + (di % 2 ? 0.5 * Math.min(g0 || (b - a) * 0.3, sep * 2) : 0), g0, b - a), ids = [];
          for (let j = 0; j < per; j++) for (let e = 0; e < 2; e++) ids.push(`s${L}:${n++}`);
          const member = (s, end) => yy => () => {
            const X0 = [c2[0] + v[0] * s, c2[1] + v[1] * s]; if (!pip(X0, inner)) return null;
            const tl = rayPoly(X0, [-u[0], -u[1]], inner), tr = rayPoly(X0, u, inner); if (!isFinite(tl) || !isFinite(tr)) return null;
            return end === 0 ? spec(yy, [X0[0] - u[0] * tl, X0[1] - u[1] * tl], u, tl + tr) : spec(yy, [X0[0] + u[0] * tr, X0[1] + u[1] * tr], [-u[0], -u[1]], tl + tr);
          };
          work.push({ set: true, ids, L, y, sets: yy => sets.map(pos => pos.flatMap(s => [member(s, 0)(yy), member(s, 1)(yy)])), member: (i, set) => member(sets[set][i >> 1], i & 1) });
          { const [lo, hi] = span(u, 1); ids.forEach((id, i) => want.push({ id, L, more: function* () { // the same direction (still parallel), anywhere across, any plane
            for (const yy of planesNear(y)) for (const s of sweep(sets[0][i >> 1], lo, hi, sep * 0.45)) yield member(s, i & 1)(yy); } })); }
        });
      };
      switch (o.pattern) {
        case 'grid': lines([turn, turn + Math.PI / 2]); break;
        case 'web': lines([turn + Math.PI / 4, turn - Math.PI / 4]); break;
        case 'pendant': { // evenly spaced drops from the top of the opening
          const b = bbox2(hp), n = Math.max(1, Math.min(N, Math.floor(b.w * 0.7 / Math.max(4, sep)) + 1)), g0 = n === 1 ? 0 : b.w * 0.7 / (n - 1);
          const sets = evenSets(n, c2[0], g0, b.w), ids = Array.from({ length: n }, (_, i) => `s${L}:${i}`);
          const member = x => yy => () => {
            const X0 = [x, c2[1]]; if (!pip(X0, inner)) return null;
            const tu = rayPoly(X0, [0, 1], inner), td = rayPoly(X0, [0, -1], inner); if (!isFinite(tu)) return null;
            return spec(yy, [x, c2[1] + tu], [0, -1], tu + (isFinite(td) ? td : R));
          };
          work.push({ set: true, ids, L, y, sets: yy => sets.map(pos => pos.map(x => member(x)(yy))), member: (i, set) => member(sets[set][i]) });
          ids.forEach((id, i) => want.push({ id, L, more: function* () { // still straight down, anywhere across the object, any plane
            for (const yy of planesNear(y)) for (const x of sweep(sets[0][i], b.x0 + 0.3, b.x1 - 0.3, sep * 0.45)) yield member(x)(yy); } }));
          break;
        }
        case 'spokes': for (let i = 0; i < N; i++) add1(`s${L}:${i}`, yy => spread.flatMap(e => {
          const th = turn + 2 * Math.PI * (i + sh + e * 0.6) / N, u = [Math.cos(th), Math.sin(th)], tF = rayPoly(c2, u, inner); if (!isFinite(tF)) return [];
          const F2 = [c2[0] + u[0] * tF, c2[1] + u[1] * tF];
          return [() => spec(yy, F2, [-u[0], -u[1]], tF + 1), () => { // past a gap: aim from the same frame point at the object's nearest real surface that way
            const P = surfaceFrom(obj, off, [c2[0], yy, c2[1]], [u[0], 0, u[1]], R, [-u[1], 0, u[0]]); if (!P) return null; const v = [P[0] - F2[0], P[2] - F2[1]], l = Math.hypot(v[0], v[1]); return l > 0.5 ? spec(yy, F2, [v[0] / l, v[1] / l], l + 2) : null; }];
        }), turn + 2 * Math.PI * (i + sh) / N); break;
        case 'random': for (let i = 0; i < N; i++) { const seeds = Array.from({ length: 8 }, () => [r(), r()]); add1(`s${L}:${i}`, yy => seeds.map(([a1, a2]) => () => {
          const th = 2 * Math.PI * a1, u3 = [Math.cos(th), 0, Math.sin(th)], P = surfaceFrom(obj, off, [c2[0], yy, c2[1]], u3, R, [-u3[2], 0, u3[0]]); if (!P) return null;
          const ph = th + (a2 - 0.5) * 75 * deg, u = [Math.cos(ph), Math.sin(ph)], P2 = [P[0], P[2]];
          if (!pip(P2, inner)) return null; const tF = rayPoly(P2, u, inner); if (!isFinite(tF)) return null;
          return spec(yy, [P2[0] + u[0] * tF, P2[1] + u[1] * tF], [-u[0], -u[1]], tF + 2);
        }), 2 * Math.PI * seeds[0][0]); } break;
        default: { // radial: object points round the layer, each tied to the frame; the frame ends are spread evenly
          // along the frame by arc length (a heart's dip or an arch's corners would otherwise collect most of them)
          const memo = new Map(), Pstep = per0.P / N;
          const layout = yy => {
            if (memo.has(yy)) return memo.get(yy);
            const pts = Array.from({ length: N }, (_, i) => { const th = turn + 2 * Math.PI * (i + sh) / N, P = surfaceFrom(obj, off, [c2[0], yy, c2[1]], [Math.cos(th), 0, Math.sin(th)], R, [-Math.sin(th), 0, Math.cos(th)]); return P && pip([P[0], P[2]], inner) ? [P[0], P[2]] : null; });
            const s = pts.map(p => p && per0.of(nearestOn(p, inner).p)), cd = (a, b) => { const x = Math.abs(a - b) % per0.P; return Math.min(x, per0.P - x); };
            let base = 0, bestCost = Infinity; // even targets base + i P / N, slid to sit closest to the nearest points
            for (let i = 0; i < N; i++) if (s[i] != null) { const b0 = s[i] - i * Pstep; let c = 0; for (let k = 0; k < N; k++) if (s[k] != null) c += cd(s[k], b0 + k * Pstep) ** 2; if (c < bestCost) { bestCost = c; base = b0; } }
            const res = { pts, t: pts.map((p, i) => base + i * Pstep) }; memo.set(yy, res); return res;
          };
          for (let i = 0; i < N; i++) add1(`s${L}:${i}`, yy => { const lay = layout(yy), P2 = lay.pts[i]; if (!P2) return [];
            const tie = F2 => () => { const v = [P2[0] - F2[0], P2[1] - F2[1]], l = Math.hypot(v[0], v[1]); return l < 0.3 ? null : spec(yy, F2, [v[0] / l, v[1] / l], l + 2); };
            return [0, 0.2, -0.2, 0.4, -0.4].map(e => tie(per0.at(lay.t[i] + e * Pstep))).concat([tie(nearestOn(P2, inner).p)]); }, turn + 2 * Math.PI * (i + sh) / N);
        }
      }
    });
    for (const wk of work) {
      if (!wk.set) { requested++; place(wk.id, wk.L, wk.cands(wk.y)); continue; }
      requested += wk.ids.length; placeSet(wk.ids, wk.L, wk.sets(wk.y)); // members left out get the rescue search on their own layer
    }
    rescue();
    // dragged ends: a frame end slides along the opening; an object end becomes the point the string aims at
    applyEdits(out, edits, o, sig, (F0, A, plane) => {
      const y = frame.snap(Math.max(-D / 2 + w, Math.min(D / 2 - w, plane && plane.axis === 1 ? plane.v : F0[1])));
      const F2 = nearestOn([F0[0], F0[2]], inner).p, Q2 = [A[0], A[2]], v = [Q2[0] - F2[0], Q2[1] - F2[1]], l = Math.hypot(v[0], v[1]); if (l < 0.5) return null;
      const F = at(F2, y), d = d3([v[0] / l, v[1] / l]), h = castObj(obj, off, F, d, Math.max(l, rayPoly(F2, [v[0] / l, v[1] / l], inner)) + 1);
      return h ? { F, A: h.A, d, t: h.t, through: h.through, plane: { axis: 1, v: y } } : null;
    });
    out.requested = requested; return out;
  }

  // ---------------------------------------------------------------- layout (print orientation)
  // flat: rotate +90 deg about X so the frame's back face (Y = -D/2) is on the bed and every Y-plane string is horizontal
  const PRINT = { flat: (x, y, z) => [x, -z, y], upright: (x, y, z) => [x, y, z] };
  function toPrint(p, layout, shift) {
    const f = PRINT[layout] || PRINT.upright, o = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { const q = f(p[i], p[i + 1], p[i + 2]); o[i] = q[0] - shift[0]; o[i + 1] = q[1] - shift[1]; o[i + 2] = q[2] - shift[2]; }
    return o;
  }

  // ---------------------------------------------------------------- build everything
  function build(obj, opt) {
    const o = Object.assign({}, DEFAULTS, opt || {}); o.off = (o.off || [0, 0, 0]).map(x => +x || 0);
    o.thick = Math.max(1.2, +o.thick || 6); o.margin = Math.max(1, +o.margin || 12);
    // a string is single extrusions: `strands` lines wide (line width of the nozzle) and exactly `tall` whole layers high
    // (2 by default: Bambu Studio can drop a bead only one layer high)
    o.lineW = clamp(+o.lineW || 0.42, 0.2, 1.2); o.layerH = clamp(+o.layerH || 0.2, 0.04, 0.6); o.firstH = clamp(+o.firstH || o.layerH, 0.04, 0.8);
    o.strands = clamp(Math.round(+o.strands || 1), 1, 4); o.string = o.lineW * o.strands; o.tall = clamp(Math.round(+o.tall || DEFAULTS.tall), 1, 4); o.strH = o.layerH * o.tall; if (!ANCHORS[o.anchor]) o.anchor = 'flared';
    const cube = o.shape === 'cube', cage = o.shape === 'cage' || cube;
    o.layout = cage ? 'upright' : 'flat'; // flat frames print lying flat (every string level on its layer); the cages standing up
    const warnings = [], w = o.string, hgt = o.strH, lh = o.layerH, solids = { frame: [], strings: [], joints: [] };
    let frame;
    const hp = obj.hull.map(q => [q[0] + o.off[0], q[1] + o.off[2]]);
    if (cube) {
      const cf = cubeFrame(obj, o, o.midPosts === false ? [] : [0, 1, 2, 3]); frame = { kind: 'cube', info: cf.info, open: { W: 2 * cf.info.h[0], H: 2 * cf.info.h[2] }, D: 2 * cf.info.h[1] }; solids.frame = cf.solids;
      const bb = obj.bb; frame.clearance = Math.min(...[0, 1, 2].map(a => cf.info.h[a] - Math.max(Math.abs(bb.min[a] + o.off[a]), Math.abs(bb.max[a] + o.off[a]))));
    } else if (cage) {
      const cf = cageFrame(obj, o); frame = { kind: 'cage', info: cf.info }; solids.frame = cf.solids;
      const rk = o.off.join(','), rmax = obj._rmax && obj._rmax.k === rk ? obj._rmax.r : (() => { let m = 0; const p = obj.p; for (let i = 0; i < p.length; i += 3) m = Math.max(m, Math.hypot(p[i] + o.off[0], p[i + 1] + o.off[1], p[i + 2] + o.off[2])); obj._rmax = { k: rk, r: m }; return m; })();
      frame.clearance = cf.info.Rin - rmax;
    } else {
      const fk = [o.shape, o.margin, o.fit ? 0 : o.innerW].join('|'), fc = obj._fit || (obj._fit = new Map()); // the fit only depends on the silhouette
      if (!fc.has(fk)) { if (fc.size > 60) fc.clear(); fc.set(fk, fitOpening(o.shape, obj.hull, o.margin, o.fit ? 0 : o.innerW)); }
      const open = fc.get(fk);
      const D = o.depth > 0 ? o.depth : Math.max(6, obj.bb.max[1] - obj.bb.min[1]);
      const ff = flatFrame(open, o, D); frame = { kind: 'flat', open, D, info: ff.info }; solids.frame = ff.solids;
      let clr = Infinity, out = 0; for (const q of hp) { if (!pip(q, open.poly)) out++; clr = Math.min(clr, nearestOn(q, open.poly).d * (pip(q, open.poly) ? 1 : -1)); }
      frame.clearance = clr; frame.outside = out;
      if (o.layout === 'flat' && obj.bb.min[1] + o.off[1] < -D / 2 - 0.05) warnings.push({ k: 'depth', t: `The object reaches ${(-D / 2 - obj.bb.min[1] - o.off[1]).toFixed(1)} mm out of the back of the frame: laid flat it would go below the plate. Use auto depth or move it forward.` });
    }
    // the printer's layer grid, from the bottom of the print (the first layer, then layer after layer): a string's plane
    // snaps so its bottom is on a layer line and it is exactly `tall` whole layers high (its middle is half that up)
    { const ax = o.layout === 'flat' ? 1 : 2; let z0 = obj.bb.min[ax] + o.off[ax];
      for (const p of solids.frame) for (let i = ax; i < p.length; i += 3) if (p[i] < z0) z0 = p[i];
      const fh = o.firstH;
      Object.assign(frame, { z0, layerH: lh, strH: hgt, firstH: fh, upAxis: ax, snap: v => z0 + fh + Math.max(0, Math.round((v - z0 - fh - hgt / 2) / lh)) * lh + hgt / 2 }); }
    if (frame.clearance < 2) warnings.push({ k: 'touch', t: frame.clearance < 0 ? 'The object pokes into the frame. Make the frame bigger (margin or width) or move the object.' : `Only ${frame.clearance.toFixed(1)} mm between the object and the frame: strings need room. Raise the margin.` });
    let strings = makeStrings(obj, frame, o);
    if (cube) { // keep only the face-centre posts a string starts on (none when the corner posts hold them all)
      const used = [...new Set(strings.filter(s => s.post >= 4).map(s => frame.info.segs.filter(q => q[2] === 2)[s.post][3]))].sort();
      const cf = cubeFrame(obj, o, used), oldPosts = frame.info.segs.filter(q => q[2] === 2), newPosts = cf.info.segs.filter(q => q[2] === 2);
      for (const s of strings) if (s.post >= 4) s.post = newPosts.findIndex(q => q[3] === oldPosts[s.post][3]);
      frame.info = cf.info; solids.frame = cf.solids; frame.midPosts = used.length;
    }
    // ends: embedded into the object (never past half its thickness there) and into the frame wall
    const eF = cube ? 0 : cage ? o.thick * 0.5 : Math.min(o.thick * 0.5, 3); // cube strings already start on the beam centre line
    const kept = [];
    for (const s of strings) {
      let eo = Math.min(Math.max(0.2, o.embed), Math.max(0.15, s.through * 0.45));
      let ef = eF;
      if (!cage) { // into the wall, never out of its back, and only where there is wall behind the frame point
        const F2 = [s.F[0], s.F[2]], b2 = [-s.d[0], -s.d[2]], tOut = rayPoly(F2, b2, frame.info.outer); if (isFinite(tOut)) ef = Math.min(eF, tOut * 0.5);
        while (ef > 0.3 && !inPolys([F2[0] + b2[0] * ef, F2[1] + b2[1] * ef], frame.info.region)) ef *= 0.6;
        if (!inPolys([F2[0] + b2[0] * ef, F2[1] + b2[1] * ef], frame.info.region)) continue;
      }
      if (cage && s.fr === 'rib') { // a string aimed in at a slant: its frame end must stay inside the rib's width, not poke out of its side
        const { ribs: k, wr } = frame.info, lim = wr / 2 - 0.05;
        let n = null, bd = Infinity; for (let j = 0; j < k; j++) { const ph = (o.turn || 0) * deg + Math.PI * j / k, nn = [-Math.sin(ph), Math.cos(ph)], g = Math.abs(nn[0] * s.F[0] + nn[1] * s.F[1]); if (g < bd) { bd = g; n = nn; } }
        const lat = e => Math.abs(n[0] * (s.F[0] - s.d[0] * e) + n[1] * (s.F[1] - s.d[1] * e));
        while (ef > 0.3 && lat(ef) > lim) ef *= 0.6;
        if (lat(ef) > lim) continue;
      }
      if (s.t < 1) { continue; } // object (almost) touching the wall here: no string needed
      const up0 = s.plane.axis === 1 ? [0, 1, 0] : s.plane.axis === 2 ? [0, 0, 1] : null;
      let u = up0; if (!u || Math.abs(dot(u, s.d)) > 0.9) u = Math.abs(s.d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const side = norm(cross(u, s.d)), upv = norm(cross(s.d, side)); s.side = side; s.up = upv;
      // a clean object end: where the string meets the surface at a slant, sink it deeper until the whole end face (all
      // four corners) is inside the object, so no corner of the string's tip pokes out beside the joint (never more than
      // 3 thicknesses past the asked-for depth, or 60% of the way through the object there)
      if (Math.abs(s.d[frame.upAxis]) > 1e-9 || Math.abs(upv[frame.upAxis]) < 1 - 1e-9) { continue; } // never a sloping string (none is made; a guard)
      { const hs = w * 0.475, hu = hgt * 0.475, inObj = P => Core.inside(obj.bvh, sub(P, o.off));
        const clean = e => { const P = add(s.A, mul(s.d, e)); return [[1, 1], [1, -1], [-1, 1], [-1, -1]].every(([a, b]) => inObj(add(P, add(mul(side, a * hs), mul(upv, b * hu))))); };
        const cap = Math.min(Math.max(eo, o.embed + 3 * w), Math.max(0.15, s.through * 0.6));
        while (eo < cap - 1e-9 && !clean(eo)) eo = Math.min(cap, eo + 0.25 * w); }
      s.P1 = add(s.A, mul(s.d, eo)); s.P0 = sub(s.F, mul(s.d, ef)); s.eo = eo; s.ef = ef; s.len = s.t;
      // print angle: flat layout turns Y up; upright keeps Z up
      const dp = (PRINT[o.layout] || PRINT.upright)(...s.d); s.tilt = Math.asin(Math.min(1, Math.abs(dp[2]))) / deg;
      s.print = s.tilt <= 5 ? 'bridge' : s.tilt >= 45 ? 'column' : 'steep';
      kept.push(s);
    }
    for (const s of kept) {
      solids.strings.push(bar(s.P0, s.P1, s.side, s.up, w, w, hgt)); // a flat bead: w wide, `tall` layers high
      if (o.anchor === 'flared') { // the ends widen in the same layer (never thicker), so they grip the surface they bridge from
        const Lf = Math.min(2.5 * w + 0.6, s.len * 0.3);
        solids.joints.push(bar(s.P1, sub(s.A, mul(s.d, Lf)), s.side, s.up, 2.2 * w, w, hgt));
        solids.joints.push(bar(s.P0, add(s.F, mul(s.d, Lf)), s.side, s.up, 2.2 * w, w, hgt));
      }
    }
    // object, placed
    const ok = o.off.join(','); if (!obj._objP || obj._objP.k !== ok) { const q = new Float64Array(obj.p.length); for (let i = 0; i < q.length; i += 3) { q[i] = obj.p[i] + o.off[0]; q[i + 1] = obj.p[i + 1] + o.off[1]; q[i + 2] = obj.p[i + 2] + o.off[2]; } obj._objP = { k: ok, p: q }; }
    const objP = obj._objP.p; // the placed object, shared between rebuilds at the same position (never modified)
    // checks and warnings
    const counts = { bridge: 0, column: 0, steep: 0 }; kept.forEach(s => counts[s.print]++);
    const lost = strings.lost || [];
    if (lost.length) warnings.push({ k: 'lost', t: `${lost.length} dragged string${lost.length > 1 ? 's' : ''} no longer reach${lost.length > 1 ? '' : 'es'} the object from the frame and ${lost.length > 1 ? 'are' : 'is'} left out. Undo the change, drag ${lost.length > 1 ? 'them' : 'it'} again, or reset dragged ends.` });
    const requested = Math.max(kept.length - kept.filter(s => s.pinned).length, strings.requested || 0);
    if (kept.length - kept.filter(s => s.pinned).length < requested && kept.length >= 3) warnings.push({ k: 'short', t: `${kept.length - kept.filter(s => s.pinned).length} of ${requested} strings placed: the rest found no solid spot on the object on their layer (it is thin or gappy there)${cage && !cube ? ', or no room across the ribs' : cube ? ', or no room across the corner posts' : ''}. Try ${cage && !cube ? 'more ribs, ' : ''}more layers, turn the pattern, or another pattern.` });
    if (kept.length < 3) warnings.push({ k: 'few', t: kept.length ? `Only ${kept.length} string${kept.length > 1 ? 's' : ''} reach the object: it may swing or snap off. Add strings or try another pattern.` : 'No string reaches the object. Try another pattern, more strings or move the object.' });
    if (counts.steep) warnings.push({ k: 'steep', t: `${counts.steep} string${counts.steep > 1 ? 's are' : ' is'} angled between 5\u00b0 and 45\u00b0 in this layout and would need supports. ${cube ? 'Use straight or crisscross strings (level, from the corner posts) or hanging strings.' : cage ? 'Use radial or hanging strings.' : 'Lay the frame flat, or use straight or hanging strings.'}` });
    if (cube && frame.info.span > 60) warnings.push({ k: 'bridge', t: `The top beams bridge ${frame.info.span.toFixed(0)} mm between the corner posts: over about 60 mm, turn on supports for the top of the cube (or make it smaller).` });
    if (cube) warnings.push({ k: 'cube', t: 'The cube prints standing on its bottom beams. Turn on supports under the object (it floats above the plate until the strings reach it).' });
    if (cage && !cube) warnings.push({ k: 'cage', t: 'The cage prints upright: its ribs arch over at the top, so turn on supports (or tree supports) for the top of the cage in your slicer.' });
    // where the print sits: print-layout bounds of everything
    // (the layouts only swap and flip axes, so the object's part is exactly its bounding box corners: no pass over a big mesh)
    const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    const f = PRINT[o.layout] || PRINT.upright, grow = q => { for (let a = 0; a < 3; a++) { if (q[a] < box.min[a]) box.min[a] = q[a]; if (q[a] > box.max[a]) box.max[a] = q[a]; } };
    for (const p of [].concat(solids.frame, solids.strings, solids.joints)) for (let i = 0; i < p.length; i += 3) grow(f(p[i], p[i + 1], p[i + 2]));
    const ob = obj.bb, corners = []; for (const x of [ob.min[0], ob.max[0]]) for (const y of [ob.min[1], ob.max[1]]) for (const z of [ob.min[2], ob.max[2]]) corners.push(f(x + o.off[0], y + o.off[1], z + o.off[2]));
    corners.forEach(grow);
    const dims = [0, 1, 2].map(a => box.max[a] - box.min[a]);
    const objPrintMinZ = Math.min(...corners.map(q => q[2])) - box.min[2];
    if (objPrintMinZ > 0.3 && !cage) warnings.push({ k: 'float', t: `In this layout the object starts ${objPrintMinZ.toFixed(1)} mm above the plate: turn on supports for its underside (the strings hold it once printed).` });
    return { o, frame, strings: kept, requested, placed: kept.filter(s => !s.pinned).length, pinned: kept.filter(s => s.pinned).length, lost, sig: stringSig(o), solids, objP, warnings, counts, printBox: box, dims, objFloat: objPrintMinZ, layout: o.layout };
  }

  // every solid of a build in print orientation, sitting on z = 0 with its corner at x = y = 0
  function printSolids(res) {
    const sh = res.printBox.min, L = res.layout;
    return { frame: res.solids.frame.map(p => toPrint(p, L, sh)), strings: res.solids.strings.map(p => toPrint(p, L, sh)), joints: res.solids.joints.map(p => toPrint(p, L, sh)), object: toPrint(res.objP, L, sh) };
  }
  function fitsBed(dims, bed, turn) {
    const ok = (a, b) => a <= bed[0] + 1e-6 && b <= bed[1] + 1e-6;
    return (ok(dims[0], dims[1]) || (turn !== false && ok(dims[1], dims[0]))) && (!bed[2] || dims[2] <= bed[2] + 1e-6);
  }

  // ---------------------------------------------------------------- one watertight solid (Manifold boolean union)
  function toManifold(M, p) {
    const { V, F } = Core.weld(p);
    const mesh = new M.Mesh({ numProp: 3, vertProperties: Float32Array.from(V), triVerts: Uint32Array.from(F) });
    mesh.merge();
    const m = new M.Manifold(mesh);
    if (m.status && m.status() !== 'NoError') { const st = m.status(); m.delete(); throw new Error(st); }
    return m;
  }
  function fromManifold(m) { // drops needle triangles whose corners coincide in float32 (they only pair with themselves)
    const mesh = m.getMesh(), V = mesh.vertProperties, F = mesh.triVerts, np = mesh.numProp || 3, out = new Float64Array(F.length * 3);
    const same = (a, b) => V[a] === V[b] && V[a + 1] === V[b + 1] && V[a + 2] === V[b + 2];
    let n = 0;
    for (let t = 0; t < F.length; t += 3) {
      const a = F[t] * np, b = F[t + 1] * np, c = F[t + 2] * np; if (same(a, b) || same(b, c) || same(a, c)) continue;
      for (const v of [a, b, c]) { out[n++] = V[v]; out[n++] = V[v + 1]; out[n++] = V[v + 2]; }
    }
    return n === out.length ? out : out.slice(0, n);
  }
  // parts: { frame:[soup], strings:[soup], joints:[soup], object: soup }. Returns { p, manifold, bodies, genus, volume, objectJoined }
  function union(parts, M, onProgress) {
    const made = [], bad = [];
    const total = parts.frame.length + parts.strings.length + parts.joints.length + 1; let done = 0;
    const take = (p, name) => { let ok = true; try { made.push(toManifold(M, p)); } catch (e) { bad.push(name); ok = false; } if (onProgress && (++done % 8 === 0 || done === total)) onProgress(0.05 + 0.3 * done / total, 'Preparing the parts'); return ok; };
    parts.frame.forEach((p, i) => take(p, 'frame ' + i));
    parts.strings.forEach((p, i) => take(p, 'string ' + i));
    parts.joints.forEach((p, i) => take(p, 'joint ' + i));
    if (onProgress) onProgress(0.35, 'Joining into one solid');
    let objOK = take(parts.object, 'object');
    if (!objOK) { // a messy input mesh: try it once more after a light clean
      try { made.push(toManifold(M, Core.clean(Float64Array.from(parts.object)))); objOK = true; bad.pop(); } catch (e) {}
    }
    const u = M.Manifold.union(made);
    if (onProgress) onProgress(0.85, 'Checking the solid');
    const comps = u.decompose(), bodies = comps.length; comps.forEach(c => c.delete());
    let p = fromManifold(u);
    const res = { manifold: true, bodies, genus: u.genus(), volume: u.volume(), objectJoined: objOK, failed: bad, tris: p.length / 9 };
    u.delete(); made.forEach(m => m.delete());
    if (!objOK) { const q = new Float64Array(p.length + parts.object.length); q.set(p); q.set(parts.object, p.length); p = q; res.manifold = false; res.bodies += 1; }
    res.p = p; res.closed = Core.checkClosed(p).closed;
    return res;
  }
  // without Manifold (offline copy, no WebAssembly): all bodies in one file; slicers merge overlapping bodies
  function multiBody(parts) { return T.concat([].concat(parts.frame, parts.strings, parts.joints, [parts.object])); }

  // ---------------------------------------------------------------- printability checks (slicing logic)
  // Every string solid, in print orientation: exactly `tall` layers high (z extent = tall x layer height), its bottom on
  // the layer grid (first layer, then every layer height), level, and one strand wide.
  function checkStrands(res) {
    const sh = res.printBox.min, L = res.layout, h = res.o.layerH, sH = res.o.strH || h, f0 = res.o.firstH, w = res.o.string, P = PRINT[L] || PRINT.upright, bad = [];
    res.solids.strings.forEach((p0, i) => {
      const s = res.strings[i], p = toPrint(p0, L, sh), side = P(...s.side); let z0 = Infinity, z1 = -Infinity, a = Infinity, b = -Infinity;
      for (let k = 0; k < p.length; k += 3) { z0 = Math.min(z0, p[k + 2]); z1 = Math.max(z1, p[k + 2]); const t = p[k] * side[0] + p[k + 1] * side[1] + p[k + 2] * side[2]; a = Math.min(a, t); b = Math.max(b, t); }
      const kk = (z0 - f0) / h, grid = z0 >= f0 - 1e-6 && Math.abs(kk - Math.round(kk)) < 1e-5;
      if (Math.abs(z1 - z0 - sH) > 1e-6 || !grid || Math.abs(b - a - w) > 1e-6 || Math.abs(side[2]) > 1e-9) bad.push({ id: s.id, z0, z1, width: b - a });
    });
    return { n: res.solids.strings.length, bad, layerH: h, height: sH, tall: Math.round(sH / h), width: w, layers: [...new Set(res.strings.map(s => ((P(...s.P1)[2] - sh[2] - f0 - sH / 2) / h).toFixed(3)))].length };
  }
  // The exported mesh, probed like a slicer: across the middle of every string's free span, solid inside its band of
  // `tall` layers and one strand width, empty just above and below the band and just beside it.
  function probeExport(res, p) {
    const bvh = Core.buildBVH(p), sh = res.printBox.min, L = res.layout, h = res.o.layerH, sH = res.o.strH || h, f0 = res.o.firstH, w = res.o.string, P = PRINT[L] || PRINT.upright, fails = [];
    const tp = q => { const r = P(...q); return [r[0] - sh[0], r[1] - sh[1], r[2] - sh[2]]; }, ins = q => Core.inside(bvh, q);
    let pass = 0;
    for (const s of res.strings) {
      const F = tp(s.F), A = tp(s.A), side = P(...s.side), zb = f0 + Math.round((F[2] - f0 - sH / 2) / h) * h;
      const ok = [0.4, 0.5, 0.6, 0.45, 0.55].some(t => {
        const M = [F[0] + (A[0] - F[0]) * t, F[1] + (A[1] - F[1]) * t], at = (z, k) => [M[0] + side[0] * k, M[1] + side[1] * k, z];
        return ins(at(zb + 0.1 * h, 0)) && ins(at(zb + sH - 0.1 * h, 0)) && !ins(at(zb - 0.2 * h, 0)) && !ins(at(zb + sH + 0.2 * h, 0)) &&
          ins(at(zb + 0.5 * sH, 0.4 * w)) && ins(at(zb + 0.5 * sH, -0.4 * w)) && !ins(at(zb + 0.5 * sH, 0.5 * w + 0.12)) && !ins(at(zb + 0.5 * sH, -0.5 * w - 0.12));
      });
      if (ok) pass++; else fails.push(s.id);
    }
    return { n: res.strings.length, pass, fails };
  }

  const api = { SHAPES, PATTERNS, ANCHORS, BASES, DEFAULTS, MIN_FDM, outline, fitOpening, prepareObject, build, printSolids, toPrint, fitsBed, union, multiBody, stringSig, checkStrands, probeExport, _dbg: { hull, rayPoly, nearestOn, pip, bar, ball, perimeter } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPSuspend = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
