/* Expressarte "Combine": Boolean operations between two solids, and raised or engraved text on a model.
   A is the loaded model, B is a second model, a primitive (box, cylinder, sphere) or extruded text. B is placed
   relative to A's bounding box (centered, on top, underneath, plus an offset, a scale and a turn), then the two are
   joined, cut or intersected with Manifold (WebAssembly), which always returns a closed, manifold solid.
   Text: the outline comes in as 2D polygons (from a canvas font in the browser, or the 3x5 pixel font), is extruded,
   turned onto one face of A (top, front, back, left, right) and set on the actual surface: rays sample the surface
   under the text, so raised letters sink into it and engraved letters cut at least `depth` everywhere. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);

  const OPS = { union: 'Join', subtract: 'Cut away', intersect: 'Keep the overlap' };
  // face frames: R (text right), U (text up), N (outward). R x U = N, so the text is never mirrored.
  const FACES = {
    top: { R: [1, 0, 0], U: [0, 1, 0], N: [0, 0, 1] },
    front: { R: [1, 0, 0], U: [0, 0, 1], N: [0, -1, 0] },
    back: { R: [-1, 0, 0], U: [0, 0, 1], N: [0, 1, 0] },
    right: { R: [0, 1, 0], U: [0, 0, 1], N: [1, 0, 0] },
    left: { R: [0, -1, 0], U: [0, 0, 1], N: [-1, 0, 0] }
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  function bbox(p) { const b = Core.bbox(p); return { min: b.min.slice(), max: b.max.slice(), c: [0, 1, 2].map(a => (b.min[a] + b.max[a]) / 2), d: [0, 1, 2].map(a => b.max[a] - b.min[a]) }; }
  function fixSign(p) { return Core.signedVolume(p) < 0 ? Core.flip(p) : p; }

  // ---------------------------------------------------------------- primitives (closed, outward, centered on the origin)
  function box(w, d, h) { return fixSign(T.box(-w / 2, -d / 2, -h / 2, w / 2, d / 2, h / 2)); }
  function circle(r, n) { const L = []; for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; L.push([r * Math.cos(t), r * Math.sin(t)]); } return L; }
  function cylinder(dia, h, n) { return fixSign(T.extrude([{ outer: circle(dia / 2, n || 64), holes: [] }], 2, -h / 2, h / 2)); }
  function sphere(dia, n) {
    n = n || 24; const r = dia / 2, m = n * 2, out = [];
    const P = (i, j) => { const th = Math.PI * i / n, ph = 2 * Math.PI * (j % m) / m; return [r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      if (i > 0) out.push(...a, ...b, ...d);
      if (i < n - 1) out.push(...b, ...c, ...d);
    }
    return fixSign(Float64Array.from(out));
  }

  // ---------------------------------------------------------------- placing B against A
  // o: { scale (1 = as is), rot: [x, y, z] degrees, at: 'center' | 'top' | 'bottom', offset: [x, y, z] mm, embed (mm) }
  function place(B, A, o) {
    o = o || {};
    const s = o.scale || 1, rot = (o.rot || [0, 0, 0]).map(v => (v || 0) * Math.PI / 180), off = o.offset || [0, 0, 0];
    const bb0 = bbox(B), q = new Float64Array(B.length);
    const cx = Math.cos(rot[0]), sx = Math.sin(rot[0]), cy = Math.cos(rot[1]), sy = Math.sin(rot[1]), cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);
    for (let i = 0; i < B.length; i += 3) {
      let x = (B[i] - bb0.c[0]) * s, y = (B[i + 1] - bb0.c[1]) * s, z = (B[i + 2] - bb0.c[2]) * s, t;
      t = y * cx - z * sx; z = y * sx + z * cx; y = t;           // about X
      t = x * cy + z * sy; z = -x * sy + z * cy; x = t;          // about Y
      t = x * cz - y * sz; y = x * sz + y * cz; x = t;           // about Z
      q[i] = x; q[i + 1] = y; q[i + 2] = z;
    }
    const bq = bbox(q), ba = bbox(A), emb = o.embed == null ? 0.4 : o.embed;
    const tx = ba.c[0] - bq.c[0] + (off[0] || 0), ty = ba.c[1] - bq.c[1] + (off[1] || 0);
    let tz = ba.c[2] - bq.c[2];
    if (o.at === 'top') tz = ba.max[2] - emb - bq.min[2];
    else if (o.at === 'bottom') tz = ba.min[2] + emb - bq.max[2];
    tz += off[2] || 0;
    for (let i = 0; i < q.length; i += 3) { q[i] += tx; q[i + 1] += ty; q[i + 2] += tz; }
    return s < 0 ? Core.flip(q) : q;
  }

  // ---------------------------------------------------------------- text
  // polys from the 3x5 pixel font (Node tests, and the fallback when there is no canvas)
  function pixelTextPolys(str) {
    const tl = Core.textLoops(String(str).toUpperCase().replace(/[^0-9A-Z\- ]/g, ''));
    return T.unionPolys(tl.loops.map(L => ({ outer: L, holes: [] })), 'evenodd');
  }
  function scalePolys(polys, heightMM) {
    const b = T.polysBBox(polys), k = heightMM / Math.max(1e-9, b.h), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const f = q => [(q[0] - cx) * k, (q[1] - cy) * k];
    return polys.map(P => ({ outer: P.outer.map(f), holes: P.holes.map(h => h.map(f)) }));
  }
  // polys: text outline centred on (0,0) in mm. o: { face, mode: 'emboss' | 'engrave', height (raised), depth (cut),
  // offset: [right, up] mm on the face }. Returns { p: the letters solid (B), op, info: { hits, samples, sag, sIn, sOut } }.
  function textSolid(A, polys, o) {
    const F = FACES[o.face || 'top']; if (!F) throw new Error('unknown face ' + o.face);
    const ba = bbox(A), bvh = Core.buildBVH(A);
    // face centre: A's bbox center projected onto the face's in-plane axes, plus the offset
    const off = o.offset || [0, 0];
    const cR = dot(ba.c, F.R) + (off[0] || 0), cU = dot(ba.c, F.U) + (off[1] || 0);
    // the outside plane along N (just beyond A's bbox)
    const corners = []; for (const x of [ba.min[0], ba.max[0]]) for (const y of [ba.min[1], ba.max[1]]) for (const z of [ba.min[2], ba.max[2]]) corners.push([x, y, z]);
    const outN = Math.max(...corners.map(c => dot(c, F.N))) + 5;
    const pb = T.polysBBox(polys);
    // sample the surface under the text: a grid over its outline box, keeping points inside the letters' box
    const hits = [], NX = 9, NY = 5; let samples = 0;
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const u = pb.x0 + pb.w * (i + 0.5) / NX, w = pb.y0 + pb.h * (j + 0.5) / NY; samples++;
      const pR = cR + u, pU = cU + w;
      const org = [0, 1, 2].map(a => F.R[a] * pR + F.U[a] * pU + F.N[a] * outN), dir = F.N.map(v => -v);
      const ts = Core.rayAll(bvh, org, dir);
      if (ts.length) hits.push(outN - ts[0]);
    }
    if (hits.length < samples * 0.5) throw new Error('the text is not over the model on that side; move it or make it smaller');
    const sIn = Math.min(...hits), sOut = Math.max(...hits), sag = sOut - sIn;
    const mode = o.mode === 'engrave' ? 'engrave' : 'emboss';
    // conform: a prism spanning the whole surface under the text (textCombine trims it to follow the surface);
    // otherwise a flat-topped (emboss) or flat-bottomed (engrave) slab
    const h0 = o.conform ? sIn - (mode === 'engrave' ? (o.depth || 1) : 0) - 0.5 : mode === 'emboss' ? sIn - Math.max(0.4, Math.min(2, sag + 0.4)) : sIn - (o.depth || 1);
    const h1 = o.conform ? sOut + (mode === 'emboss' ? (o.height || 1) : 0) + 0.5 : mode === 'emboss' ? sOut + (o.height || 1) : sOut + 1;
    // extrude in a local frame (x = R, y = U, z = N), then turn onto the face
    const L = T.extrude(polys, 2, h0, h1), q = new Float64Array(L.length);
    for (let i = 0; i < L.length; i += 3) {
      const x = L[i] + cR, y = L[i + 1] + cU, z = L[i + 2];
      for (let a = 0; a < 3; a++) q[i + a] = F.R[a] * x + F.U[a] * y + F.N[a] * z;
    }
    return { p: fixSign(q), op: mode === 'emboss' ? 'union' : 'subtract', info: { hits: hits.length, samples, sag, sIn, sOut, h0, h1 } };
  }

  // ---------------------------------------------------------------- Manifold
  function toManifold(M, p) {
    const { V, F } = Core.weld(p);
    const mesh = new M.Mesh({ numProp: 3, vertProperties: Float32Array.from(V), triVerts: Uint32Array.from(F) });
    mesh.merge();
    const m = new M.Manifold(mesh);
    if (m.status && m.status() !== 'NoError') { const st = m.status(); m.delete(); throw new Error(st); }
    return m;
  }
  function solid(M, p, label) {
    try { return toManifold(M, p); } catch (e) {}
    try { return toManifold(M, Core.clean(Float64Array.from(p))); } catch (e) {}
    throw new Error(`${label} is not a closed solid (holes or loose edges). Run it through Repair STL first.`);
  }
  function fromManifold(m) {
    const mesh = m.getMesh(), V = mesh.vertProperties, F = mesh.triVerts, np = mesh.numProp || 3, out = new Float64Array(F.length * 3);
    const same = (a, b) => V[a] === V[b] && V[a + 1] === V[b + 1] && V[a + 2] === V[b + 2];
    let n = 0;
    for (let t = 0; t < F.length; t += 3) {
      const a = F[t] * np, b = F[t + 1] * np, c = F[t + 2] * np; if (same(a, b) || same(b, c) || same(a, c)) continue;
      for (const v of [a, b, c]) { out[n++] = V[v]; out[n++] = V[v + 1]; out[n++] = V[v + 2]; }
    }
    return n === out.length ? out : out.slice(0, n);
  }
  // op: union | subtract | intersect. Returns { p, volume, volA, volB, bodies, genus, closed, empty, unchanged }
  function combine(A, B, op, M) {
    if (!OPS[op]) throw new Error('unknown operation ' + op);
    const a = solid(M, A, 'The model'), b = solid(M, B, 'The second shape');
    return combineM(M, a, b, op);
  }
  // raised or engraved text that follows the surface: every letter point is exactly `height` above (or `depth` below)
  // the surface along the face normal, however curved or stepped the surface is.
  //   emboss: A \u222a (prism \u2229 A shifted out by height)      engrave: A \u2212 (prism \u2212 A shifted in by depth)
  // shape of a solid that matters for "did the cut go through": printable bodies, the genus of each (holes
  // through it) and sealed voids over 1 mm\u00b3; crumbs are ignored like in combineM
  function topo(m) {
    const cs = m.decompose(); let bodies = 0, holes = 0, voids = 0;
    for (const c of cs) { const v = c.volume(); if (v > SPECK_MAX) { bodies++; holes += Math.max(0, c.genus()); } else if (v < -VOID_MAX) voids++; c.delete(); }
    return { bodies, holes, voids };
  }
  // engraving must leave at least MIN_WALL of material behind the letters; a cut that would pierce a thin wall
  // (new hole, new loose piece, or an opened hollow) is made shallower, and refused when even a shallow cut would
  const MIN_WALL = 0.8, DEPTH_STEPS = [1, 0.75, 0.5, 0.35, 0.25];
  function textCombine(A, polys, o, M) {
    const mode = o.mode === 'engrave' ? 'engrave' : 'emboss', amt = mode === 'engrave' ? (o.depth || 1) : (o.height || 1);
    const t = textSolid(A, polys, { ...o, depth: mode === 'engrave' ? amt + MIN_WALL : o.depth, conform: true }), N = FACES[o.face || 'top'].N;
    const a = solid(M, A, 'The model'); let P, sh, B, used = amt, thin = false;
    try { P = toManifold(M, t.p); } catch (e) { a.delete(); throw new Error('the letters could not be made solid; try a simpler font or larger text'); }
    try {
      if (mode === 'engrave') {
        const t0 = topo(a); used = 0;
        const pierces = d => { const s2 = a.translate(N.map(v => -d * v)), cut = P.subtract(s2), r2 = a.subtract(cut), t1 = topo(r2);
          s2.delete(); cut.delete(); r2.delete(); return !(t1.bodies <= t0.bodies && t1.holes <= t0.holes && t1.voids >= t0.voids); };
        for (const f of DEPTH_STEPS) if (!pierces(amt * f + MIN_WALL)) { used = amt * f; break; }
        // no depth leaves the full margin: take the deepest that still does not go through, and say the wall is thin
        if (!used) for (const f of DEPTH_STEPS) if (!pierces(amt * f + 0.2)) { used = amt * f; thin = true; break; }
        if (!used) throw new Error('part of the model behind the letters is too thin to engrave without cutting through; move the text, use another side or use raised text');
      }
      sh = a.translate(N.map(v => v * (mode === 'emboss' ? amt : -used)));
      B = mode === 'emboss' ? P.intersect(sh) : P.subtract(sh);
      if (mode === 'emboss') {
        // a wall thinner than the letter height leaves a gap between the shifted copy and the model, so the
        // letters would float; sweep the copy up in steps under the wall instead (only when that happens)
        const t0 = topo(a), j = a.add(B), t1 = topo(j); j.delete();
        if (t1.bodies > t0.bodies) {
          const k = Math.ceil(amt / 0.3);
          for (let i = 1; i < k; i++) { const si = a.translate(N.map(v => v * amt * i / k)), bi = P.intersect(si), u = B.add(bi); si.delete(); bi.delete(); B.delete(); B = u; }
        }
      }
    } catch (e) { a.delete(); throw e; } finally { P.delete(); if (sh) sh.delete(); }
    const r = combineM(M, a, B, t.op);
    r.info = t.info; r.op = t.op;
    if (mode === 'engrave') { r.depth = used; if (used < amt - 1e-9 || thin) r.limited = { asked: amt, used, minWall: MIN_WALL, thin }; }
    return r;
  }
  // crumbs: sealed bubbles under 1 mm\u00b3 (left where a cut grazes a surface) are filled, and loose specks under
  // 0.5 mm\u00b3 are dropped; neither can be printed and both would be miscounted as separate pieces
  const VOID_MAX = 1, SPECK_MAX = 0.5;
  function combineM(M, a, b, op) {
    let r;
    try { r = op === 'union' ? a.add(b) : op === 'subtract' ? a.subtract(b) : a.intersect(b); }
    catch (e) { a.delete(); b.delete(); throw e; }
    const volA = a.volume(), volB = b.volume();
    let comps = r.decompose(), crumbs = 0;
    const big = comps.some(c => c.volume() > SPECK_MAX);
    const keep = comps.filter(c => { const v = c.volume(), ok = !(v < 0 && v > -VOID_MAX) && !(big && v >= 0 && v <= SPECK_MAX); if (!ok) crumbs++; return ok; });
    if (crumbs && keep.length) { const k = M.Manifold.compose(keep); r.delete(); r = k; }
    comps.forEach(c => c.delete());
    const volume = r.volume();
    const solids = r.decompose(), nb = solids.filter(c => c.volume() > 0).length; solids.forEach(c => c.delete());
    const genus = r.genus(), p = fromManifold(r);
    r.delete(); a.delete(); b.delete();
    const empty = !p.length || volume < 1e-6;
    const unchanged = !empty && Math.abs(volume - (op === 'intersect' ? Math.min(volA, volB) : volA)) < Math.max(1e-6, volA * 1e-6) && op !== 'union';
    return { p, volume, volA, volB, bodies: nb, crumbs, genus, closed: empty ? false : Core.checkClosed(p).closed, empty, unchanged };
  }

  const api = { OPS, FACES, box, cylinder, sphere, place, pixelTextPolys, scalePolys, textSolid, textCombine, combine, MIN_WALL, toManifold, fromManifold };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPCombine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
