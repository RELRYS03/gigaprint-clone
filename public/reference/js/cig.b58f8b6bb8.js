/* Expressarte cigarette expander (a novelty multi-holder).
   N sockets for cigarettes, all feeding one hollow plenum that funnels into one mouthpiece. One printed piece.

   Print orientation (as exported): the socket plate lies on the bed (z = 0) with the sockets opening downward, so the
   filter ends go in from below. Each socket is a straight bore (cigarette diameter + clearance) for the grip depth,
   then a 45 degree cone narrows it to an air hole that runs up through the rest of the plate. Above the plate a hollow
   shell of revolution rises a little, then a cone (default 50 degrees from the bed) funnels to the mouthpiece tube.
   Every overhang is 45 degrees or steeper, so it prints without supports.

   The mesh is built from shared rings: a revolved profile (outer wall, mouthpiece, bore, inner cone, plenum wall),
   the bottom face (outer ring with N socket holes) and the plenum floor (inner ring with N air holes), both
   triangulated with earcut on exactly the ring vertices, and one revolved tube per socket. Every edge is shared by
   exactly two triangles, so the solid is watertight and manifold by construction.

   Layouts fill progressively and stay centred for every count: honeycomb takes the N lattice points nearest the
   best of three centres (a lattice point, an edge midpoint or a triangle centre), shells in balanced angle order;
   rings fill a centre plus full rings and spread the last ring evenly. */
(function (G) {
  'use strict';
  const earcut = G.earcut || (typeof require === 'function' ? require('earcut') : null);
  const TAU = Math.PI * 2;

  const SIZES = {
    king: { label: 'King / regular', d: 7.9, len: 84, filter: 27 },
    slim: { label: 'Superslim', d: 5.4, len: 98, filter: 25 },
    custom: { label: 'Custom', d: 7.9, len: 84, filter: 25 }
  };
  const DEFAULTS = { n: 20, d: 7.9, clearance: 0.3, wall: 1.6, grip: 10, layout: 'hex', mouth: 'taper', shell: 2, rim: 3, angle: 50, collar: 3, seg: 24 };
  const MAX_ABS = 20000;

  function opts(o) {
    const r = Object.assign({}, DEFAULTS, o || {});
    r.n = Math.max(1, Math.min(MAX_ABS, Math.round(r.n) || 1));
    r.d = Math.max(3, Math.min(20, +r.d || 7.9));
    r.clearance = Math.max(-0.5, Math.min(2, +r.clearance || 0));
    r.wall = Math.max(0.8, Math.min(6, +r.wall || 1.6));
    r.grip = Math.max(3, Math.min(30, +r.grip || 10));
    r.angle = Math.max(45, Math.min(75, +r.angle || 50));
    return r;
  }
  // socket sizes: bore radius, air hole radius, pitch between centres, plate thickness
  function sock(o) {
    const rs = (o.d + o.clearance) / 2;
    const ra = Math.max(1.0, Math.min(rs - 1.0, rs * 0.55));
    const pitch = 2 * rs + o.wall;
    const tp = o.grip + (rs - ra) + 1.6;
    return { rs, ra, pitch, tp };
  }

  // ---- layouts (unit pitch, centred on the origin)
  function vdcOrder(m) { // van der Corput order of 0..m-1: each pick lands in the biggest gap left
    const out = [], seen = new Uint8Array(m);
    for (let i = 0; out.length < m && i < 4 * m + 8; i++) {
      let f = 0, b = 0.5, k = i; while (k) { if (k & 1) f += b; b /= 2; k >>= 1; }
      const j = Math.floor(f * m); if (!seen[j]) { seen[j] = 1; out.push(j); }
    }
    for (let j = 0; j < m; j++) if (!seen[j]) out.push(j);
    return out;
  }
  function hexPoints(n) {
    if (n === 1) return [[0, 0]];
    const R = Math.ceil(Math.sqrt(n / 2.6)) + 3, s3 = Math.sqrt(3) / 2;
    const lat = [];
    for (let j = -R; j <= R; j++) for (let i = -R - Math.abs(j); i <= R + Math.abs(j); i++) lat.push([i + j / 2, j * s3]);
    let best = null;
    for (const c of [[0.5, 0], [0, 0], [0.5, s3 / 3]]) {
      const pts = lat.map(p => { const x = p[0] - c[0], y = p[1] - c[1]; return { x, y, d: Math.round(Math.hypot(x, y) * 1e6), a: Math.atan2(y, x) }; });
      pts.sort((p, q) => p.d - q.d || p.a - q.a);
      const sel = [];
      for (let i = 0; i < pts.length && sel.length < n;) {
        let j = i; while (j < pts.length && pts[j].d === pts[i].d) j++;
        const shell = pts.slice(i, j), need = n - sel.length;
        if (shell.length <= need) sel.push(...shell);
        else { const ord = vdcOrder(shell.length); for (let k = 0; k < need; k++) sel.push(shell[ord[k]]); }
        i = j;
      }
      let cx = 0, cy = 0; for (const p of sel) { cx += p.x; cy += p.y; } cx /= n; cy /= n;
      const out = sel.map(p => [p.x - cx, p.y - cy]);
      const r = Math.max(...out.map(p => Math.hypot(p[0], p[1])));
      if (!best || r < best.r - 1e-9) best = { r, out };
    }
    return best.out;
  }
  function ringPoints(n) {
    if (n === 1) return [[0, 0]];
    if (n <= 6) { const r = 0.5 / Math.sin(Math.PI / n); return Array.from({ length: n }, (_, i) => [r * Math.cos(TAU * i / n + Math.PI / 2), r * Math.sin(TAU * i / n + Math.PI / 2)]); }
    const caps = []; let left = n - 1;
    for (let k = 1; left > 0; k++) { const c = Math.floor(TAU * k); caps.push(Math.min(c, left)); left -= Math.min(c, left); }
    let centre = true;
    if (caps[caps.length - 1] === 1) { centre = false; caps[caps.length - 1] = 2; }
    const out = centre ? [[0, 0]] : [];
    caps.forEach((m, i) => { const k = i + 1, off = (k % 2) * Math.PI / m; for (let j = 0; j < m; j++) out.push([k * Math.cos(TAU * j / m + off), k * Math.sin(TAU * j / m + off)]); });
    return out;
  }
  function layout(n, kind) { return kind === 'rings' ? ringPoints(n) : hexPoints(n); }

  // ---- overall sizes for a count (no mesh)
  function dims(o0) {
    const o = opts(o0), s = sock(o);
    const pts = layout(o.n, o.layout).map(p => [p[0] * s.pitch, p[1] * s.pitch]);
    let rc = 0; for (const p of pts) rc = Math.max(rc, Math.hypot(p[0], p[1]));
    const A = o.angle * Math.PI / 180, tanA = Math.tan(A), sinA = Math.sin(A), t = o.shell;
    const filter = o.mouth === 'filter';
    const rb = filter ? Math.max(1.5, Math.min(2.2, o.d / 2 - 1.6)) : 2.6;          // bore radius
    const Rm0 = filter ? Math.max(o.d / 2, rb + 1.6) : Math.max(7, rb + t / sinA);    // mouth outer radius at the base
    const Rm1 = filter ? Rm0 : 5.5;                                                   // at the tip
    const L = filter ? 24 : 30;
    let Rb = Math.max(rc + s.rs + o.rim, Rm0 + 0.6);
    const Ri = Rb - t;
    const zA = s.tp + o.collar;                              // top of the inner collar, where the inner cone starts
    const zc = zA + Math.max(0, Ri - rb) * tanA;             // inner cone meets the bore
    const zo1 = zA + (t / sinA - t) * tanA;                  // outer collar top
    const zo2 = zA + (Ri + t / sinA - Rm0) * tanA;           // outer cone meets the mouth tube
    const zt = Math.max(zc, zo2) + L;                        // mouth tip
    return { o, s, pts, rc, rb, Rm0, Rm1, L, Rb, Ri, zA, zc, zo1, zo2, zt, tanA, sinA, t, diameter: 2 * Rb, height: zt };
  }
  function fits(D, bedXY, bedZ) { return D.diameter <= bedXY + 1e-9 && D.height <= bedZ + 1e-9; }
  // largest count that prints as one piece on a bed (bedXY: the free circle's diameter, bedZ: build height)
  function maxCount(bedXY, bedZ, o0) {
    const base = Object.assign({}, o0 || {});
    const ok = n => fits(dims(Object.assign(base, { n })), bedXY, bedZ);
    if (!ok(1)) return 0;
    const s = sock(opts(base));
    let hi = Math.min(MAX_ABS, Math.ceil(Math.pow(bedXY / 2 / s.pitch + 1, 2) * 3.7) + 8), lo = 1;
    while (hi > lo + 1 && !ok(hi) && hi > 1) { const m = Math.floor((lo + hi) / 2); if (ok(m)) lo = m; else hi = m; }
    if (ok(hi)) lo = hi;
    // layouts are not strictly monotone: walk on while the next counts still fit, and back off if needed
    for (let k = lo + 1; k <= Math.min(MAX_ABS, lo + 12); k++) if (ok(k)) lo = k;
    while (lo > 1 && !ok(lo)) lo--;
    return lo;
  }

  function milestone(n, max) {
    if (max && n === max && n > 20) return 'Bed full. No more room.';
    if (n >= 1000) return 'Why.';
    if (n >= 500) return 'Industrial.';
    if (n >= 200) return 'A whole carton (and then some)';
    if (n >= 100) return 'Triple digits';
    if (n > 20) return 'Beyond the standard';
    if (n === 20) return 'Standard (one pack)';
    if (n >= 10) return 'Half a pack';
    if (n >= 2) return 'Sharing is caring';
    return 'Just the one';
  }

  // ---- mesh
  function build(o0) {
    const D = dims(o0), o = D.o, s = D.s;
    const k = Math.max(12, o.seg | 0);
    const M = 4 * Math.max(16, Math.min(90, Math.round(TAU * D.Rb / 8)));
    const V = [], T = [];
    const vtx = (x, y, z) => (V.push(x, y, z), V.length / 3 - 1);
    const tri = (a, b, c) => T.push(a, b, c);
    const ring = (cx, cy, r, z, m) => { const ids = []; for (let i = 0; i < m; i++) ids.push(vtx(cx + r * Math.cos(TAU * i / m), cy + r * Math.sin(TAU * i / m), z)); return ids; };
    // revolved band between rings A (lower in the profile order) and B; out = +1: normal away from the axis
    const band = (A, B, out) => { const m = A.length; for (let i = 0; i < m; i++) { const j = (i + 1) % m; if (out > 0) { tri(A[i], A[j], B[j]); tri(A[i], B[j], B[i]); } else { tri(A[i], B[j], A[j]); tri(A[i], B[i], B[j]); } } };
    // the profile: outer wall up, mouthpiece, tip, bore down, inner cone, plenum wall down to the floor
    const prof = [[D.Rb, 0], [D.Rb, D.zo1]];
    if (D.zo2 > D.zo1 + 1e-6) prof.push([D.Rm0, D.zo2]);
    const ch = Math.min(0.8, (D.Rm1 - D.rb) / 3);
    prof.push([D.Rm1, D.zt - ch], [D.Rm1 - ch, D.zt], [D.rb, D.zt]);
    if (D.zc > D.zA + 1e-6) prof.push([D.rb, D.zc]);
    prof.push([D.Ri, D.zA], [D.Ri, s.tp]);
    const clean = [prof[0]];
    for (const p of prof.slice(1)) { const q = clean[clean.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) clean.push(p); }
    const rings = clean.map(p => ring(0, 0, p[0], p[1], M));
    for (let i = 0; i + 1 < rings.length; i++) band(rings[i], rings[i + 1], +1);
    const bottomOuter = rings[0], floorOuter = rings[rings.length - 1];
    // sockets: bore, 45 degree cone, air hole
    const bot = [], top = [];
    for (const [x, y] of D.pts) {
      const sp = [[s.rs, 0], [s.rs, o.grip], [s.ra, o.grip + (s.rs - s.ra)], [s.ra, s.tp]];
      const sr = sp.map(p => ring(x, y, p[0], p[1], k));
      for (let i = 0; i + 1 < sr.length; i++) band(sr[i], sr[i + 1], -1);
      bot.push(sr[0]); top.push(sr[sr.length - 1]);
    }
    // flat faces with holes; want: +1 normal +z, -1 normal -z
    const face = (outer, holes, want) => {
      const flat = [], idx = [], hs = [];
      for (const v of outer) { flat.push(V[3 * v], V[3 * v + 1]); idx.push(v); }
      for (const h of holes) { hs.push(idx.length); for (const v of h) { flat.push(V[3 * v], V[3 * v + 1]); idx.push(v); } }
      const tr = earcut(flat, hs.length ? hs : null, 2);
      for (let i = 0; i < tr.length; i += 3) {
        const a = tr[i], b = tr[i + 1], c = tr[i + 2];
        const ar = (flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]) - (flat[2 * c] - flat[2 * a]) * (flat[2 * b + 1] - flat[2 * a + 1]);
        if ((ar > 0) === (want > 0)) tri(idx[a], idx[b], idx[c]); else tri(idx[a], idx[c], idx[b]);
      }
    };
    face(bottomOuter, bot, -1);
    face(floorOuter, top, +1);
    const p = new Float64Array(T.length * 3);
    for (let i = 0; i < T.length; i++) { const v = T[i]; p[3 * i] = V[3 * v]; p[3 * i + 1] = V[3 * v + 1]; p[3 * i + 2] = V[3 * v + 2]; }
    return { p, dims: D, centers: D.pts, rs: s.rs, ra: s.ra, pitch: s.pitch, plate: s.tp, grip: o.grip, diameter: D.diameter, height: D.height, n: o.n,
      plenumR: D.Ri, bore: 2 * D.rb, mouthOD: 2 * D.Rm0, mouthLen: D.L, tris: T.length / 3 };
  }

  function readme(r, extra) {
    const f = v => (Math.round(v * 10) / 10).toString(), o = r.dims.o;
    return [
      `Expressarte cigarette expander: ${r.n} socket${r.n === 1 ? '' : 's'} into one ${o.mouth === 'filter' ? 'filter-size tip' : 'tapered mouthpiece'}.`,
      'A novelty item, made for a laugh. For adults only. It is not a health product and we make no health claims.', '',
      `Size: ${f(r.diameter)} mm across, ${f(r.height)} mm tall, one piece.`,
      `Sockets: ${f(2 * r.rs)} mm bore (${f(o.d)} mm cigarette + ${f(o.clearance)} mm clearance), ${f(o.grip)} mm deep, ${f(r.pitch)} mm apart (${o.layout === 'rings' ? 'rings' : 'honeycomb'}).`,
      `Mouthpiece: ${f(r.mouthOD)} mm outside, ${f(r.bore)} mm bore.`, '',
      'Print it as it comes: the socket plate on the bed, sockets facing down. No supports are needed (every overhang is 45 degrees or steeper).',
      'Use 2 or more walls and any infill. If the cigarettes are loose, lower the clearance; if they crush, raise it.',
      ...(extra || [])
    ].join('\n');
  }

  const api = { SIZES, DEFAULTS, opts, sock, layout, hexPoints, ringPoints, dims, maxCount, milestone, build, readme };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPCigarette = api;
})(globalThis);
