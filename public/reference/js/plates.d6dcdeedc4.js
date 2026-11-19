/* Build plates: split parts that are bigger than the bed into pieces with dovetail joints, lay parts out on the
 * printer's plates, and write plate-matched files (one 3MF with a plate per bed load, or an STL folder per plate).
 *
 * Splitting works on anything built from stepped layers (StudioTools.steppedExtrude): each piece is rebuilt with
 * its layers cut to the piece's region, a rectangle with dovetail tabs on its seams. Tabs belong to the piece on the
 * left (or in front) and lock into a matching socket in the next piece, so the pieces push together from above and
 * cannot pull apart sideways. The gap between a tab and its socket is the joint clearance, split evenly.
 */
(function (G) {
  'use strict';
  const C = G.SplitCore || require('./core'), T = G.StudioTools || require('./tools');
  const JOINT = { clear: 0.2, neck: 9, head: 14, depth: 8, spacing: 80, margin: 10 };
  const EPS = 1e-6;
  const fits = (w, d, W, D) => (w <= W + EPS && d <= D + EPS) || (w <= D + EPS && d <= W + EPS);
  const jointOf = o => Object.assign({}, JOINT, o && o.joint || {});

  // How many pieces along x and y so every piece (plus the tab it carries) fits a W \u00d7 D area. count: optional
  // manual piece count (along the long side); it is raised to the smallest count that fits.
  function plan(w, d, W, D, o) {
    o = o || {}; const J = jointOf(o), L = J.depth;
    const want = Math.max(1, Math.round(+o.count || 0));
    if (fits(w, d, W, D) && want <= 1) return { nx: 1, ny: 1, n: 1, fits: true };
    let best = null;
    for (let nx = 1; nx <= 16; nx++) for (let ny = 1; ny <= 16; ny++) {
      const pw = w / nx + (nx > 1 ? L : 0), pd = d / ny + (ny > 1 ? L : 0);
      if (!fits(pw, pd, W, D) || Math.min(w / nx, d / ny) < 2 * J.head + 6) continue;
      const n = nx * ny, seam = (nx - 1) * d + (ny - 1) * w;
      if (!best || n < best.n || (n === best.n && seam < best.seam)) best = { nx, ny, n, seam };
    }
    if (!best) return { nx: 1, ny: 1, n: 1, fits: false };
    if (want > best.n) { // manual override: more pieces along the long side (shorter pieces print faster, fit smaller beds)
      const along = w >= d ? 'nx' : 'ny', other = along === 'nx' ? 'ny' : 'nx', k = Math.max(1, Math.round(want / best[other]));
      const span = along === 'nx' ? w : d;
      if (span / k >= 2 * J.head + 6) best = Object.assign({}, best, { [along]: Math.max(best[along], k) });
      best.n = best.nx * best.ny;
    }
    return { nx: best.nx, ny: best.ny, n: best.n, fits: true };
  }
  // Seam positions: equal steps, or snapped to a nearby wall (o.snapX / o.snapY: candidate positions) when that still fits.
  function cuts(len, n, snap, maxPiece) {
    const out = []; for (let k = 1; k < n; k++) out.push(len * k / n);
    if (snap && snap.length) for (let k = 0; k < out.length; k++) {
      const lo = k ? out[k - 1] : 0, hi = k + 1 < out.length ? out[k + 1] : len;
      const c = snap.filter(s => s > lo + 20 && s < hi - 20 && s - lo <= maxPiece && hi - s <= maxPiece).sort((a, b) => Math.abs(a - out[k]) - Math.abs(b - out[k]))[0];
      if (c != null && Math.abs(c - out[k]) < len / n * 0.25) out[k] = c;
    }
    return out;
  }
  const rectPoly = (x0, y0, x1, y1) => ({ outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], holes: [] });
  // dovetail tab on a seam at s (along axis 'x' means the seam is the line x = s), centred at t, pointing to +axis
  function tab(axis, s, t, J) {
    const n = J.neck / 2, h = J.head / 2, L = J.depth;
    const pts = [[s - 0.6, t - n], [s, t - n], [s + L, t - h], [s + L, t + h], [s, t + n], [s - 0.6, t + n]];
    return { outer: axis === 'x' ? pts : pts.map(([a, b]) => [b, a]).reverse(), holes: [] };
  }
  // tab centres along a seam segment [a, b]; ends that are the part's outside edge keep `edge` clear (corner radius,
  // wall), ends where another seam crosses keep clear of that seam's tabs
  function tabSites(a, b, aEdge, bEdge, J, edge, shift) {
    const lo = a + (aEdge ? edge : J.depth + 3) + J.head / 2, hi = b - (bEdge ? edge : J.depth + 3) - J.head / 2;
    if (hi < lo - EPS || shift === false) return [];
    const n = Math.max(1, Math.min(6, Math.round((hi - lo) / J.spacing) + 1)), cl = t => Math.max(lo, Math.min(hi, t + (shift || 0)));
    if (n === 1) return [cl((lo + hi) / 2)];
    return Array.from({ length: n }, (_, k) => lo + (hi - lo) * k / (n - 1)).map((t, k) => k === 0 || k === n - 1 ? t : cl(t));
  }
  // The regions (polygon sets) of every piece of a w \u00d7 d part split nx \u00d7 ny. o.edge: how far tabs stay from the
  // part's outside (default 12 mm: past a wall and its corner radius).
  function regions(w, d, P, o) {
    o = o || {}; const J = jointOf(o), M = J.margin, edge = o.edge == null ? 12 : o.edge;
    const W = o.maxPiece || Infinity;
    const xc = cuts(w, P.nx, o.snapX, W), yc = cuts(d, P.ny, o.snapY, W);
    const X = [-M, ...xc, w + M], Y = [-M, ...yc, d + M];
    const own = {}, into = {}, key = (i, j) => i + ',' + j, add = (m, k, p) => (m[k] = m[k] || []).push(p);
    let tabs = 0;
    for (let k = 1; k < P.nx; k++) for (let j = 0; j < P.ny; j++) {
      const a = Math.max(0, Y[j]), b = Math.min(d, Y[j + 1]);
      for (const t of tabSites(a, b, j === 0, j === P.ny - 1, J, edge, o.shift)) { const tp = tab('x', X[k], t, J); add(own, key(k - 1, j), tp); add(into, key(k, j), tp); tabs++; }
    }
    for (let k = 1; k < P.ny; k++) for (let i = 0; i < P.nx; i++) {
      const a = Math.max(0, X[i]), b = Math.min(w, X[i + 1]);
      for (const t of tabSites(a, b, i === 0, i === P.nx - 1, J, edge, o.shift)) { const tp = tab('y', Y[k], t, J); add(own, key(i, k - 1), tp); add(into, key(i, k), tp); tabs++; }
    }
    const pieces = [];
    for (let j = 0; j < P.ny; j++) for (let i = 0; i < P.nx; i++) {
      const k = key(i, j);
      let R = T.unionPolys([rectPoly(X[i], Y[j], X[i + 1], Y[j + 1])].concat(own[k] || []));
      if (into[k]) R = T.diffPolys(R, into[k]);
      R = T.offset(R, -J.clear / 2, false);
      const S = T.offset([rectPoly(X[i], Y[j], X[i + 1], Y[j + 1])], -J.clear / 2, false);
      pieces.push({ i, j, region: o.tabZ != null ? { low: R, high: S, z: o.tabZ } : R, tabbed: R, straight: S, rect: [Math.max(0, X[i]), Math.max(0, Y[j]), Math.min(w, X[i + 1]), Math.min(d, Y[j + 1])], tabs: (own[k] || []).length });
    }
    return { pieces, xCuts: xc, yCuts: yc, tabs, joint: J };
  }
  // Build a part in pieces. build() makes the whole part from stepped layers; it is called once per piece with the
  // layers cut to that piece. Returns null when the part fits the W \u00d7 D area whole (and no count was asked for).
  function buildSplit(w, d, W, D, build, o) {
    o = o || {}; const P = plan(w, d, W, D, o);
    if (P.n <= 1) return null;
    // A dovetail that lands on a fine feature (a blade slot, a divider end) can leave a sliver the solid cannot close
    // around: move the inner dovetails along the seam and try again; as a last resort cut straight (glue the seam).
    let err = null;
    for (const shift of [0, 11, -11, 23, -23, 37, false]) {
      try {
        const R = regions(w, d, P, Object.assign({ maxPiece: Math.max(W, D) }, o, { shift }));
        const pieces = R.pieces.map((pc, k) => Object.assign(pc, { index: k, of: R.pieces.length, built: T.withClip(shift === false ? pc.straight : pc.region, build) }));
        return { plan: P, pieces, tabs: R.tabs, xCuts: R.xCuts, yCuts: R.yCuts, joint: R.joint, straight: shift === false };
      } catch (e) { err = e; }
    }
    throw err;
  }

  // A seam can leave a crumb of a feature near a wall (a corner of a label ledge) cut off from its piece; such
  // loose crumbs (tiny bodies not joined to the piece) are dropped. Bodies above the limit are always kept.
  function dropCrumbs(p, maxVol) {
    if (!p || !p.length) return p;
    const comps = C.components({ p, t: new Array(p.length / 9).fill(0) });
    if (comps.length < 2) return p;
    const total = Math.abs(C.signedVolume(p)), lim = Math.min(maxVol == null ? 80 : maxVol, total * 0.002), keep = [];
    for (const c of comps) {
      const q = new Float64Array(c.tris.length * 9); c.tris.forEach((t, k) => q.set(p.subarray(t * 9, t * 9 + 9), k * 9));
      if (Math.abs(C.signedVolume(q)) >= lim) keep.push(q);
    }
    return keep.length === comps.length ? p : T.concat(keep);
  }
  // ------------------------------------------------------------------ plate layout
  function move(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  // to the origin: min x, y and z at 0
  function normalize(p) { const b = C.bbox(p); return move(p, -b.min[0], -b.min[1], -b.min[2]); }
  function turn(p) { // 90 degrees about z, kept in the positive quadrant (keeps triangle winding)
    const b = C.bbox(p), h = b.max[1] - b.min[1], q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { const x = p[i] - b.min[0], y = p[i + 1] - b.min[1]; q[i] = h - y; q[i + 1] = x; q[i + 2] = p[i + 2] - b.min[2]; }
    return q;
  }
  // parts: [{ name, p, color }] in print orientation (any position). W \u00d7 D: the usable area. Returns plates, each a
  // list of { name, color, p (placed, 0..W \u00d7 0..D), w, d, h, x, y, rot }, and the parts too big for the area.
  function arrange(parts, W, D, o) {
    o = o || {}; const gap = o.gap == null ? 5 : o.gap;
    const items = parts.map(pt => { const b = C.bbox(pt.p); return { w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], z: b.max[2] - b.min[2] }; });
    const pk = T.pack(items, W, D, gap, 0), plates = Array.from({ length: pk.sheets }, () => []), unfit = [];
    parts.forEach((pt, i) => {
      const pl = pk.place[i], it = items[i];
      if (pl.sheet < 0 || (o.maxZ && it.z > o.maxZ + EPS)) { unfit.push(Object.assign({}, pt, { w: it.w, d: it.h, h: it.z })); return; }
      const q = pl.rot ? turn(pt.p) : normalize(pt.p);
      plates[pl.sheet].push(Object.assign({}, pt, { p: move(q, pl.x, pl.y), x: pl.x, y: pl.y, rot: !!pl.rot, w: pl.rot ? it.h : it.w, d: pl.rot ? it.w : it.h, h: it.z }));
    });
    return { plates: plates.filter(p => p.length), unfit };
  }
  // the bounding box of each item on a plate must sit inside the usable area (a check for tests and the view)
  function checkPlates(plates, W, D, tol) {
    const bad = []; tol = tol == null ? 0.01 : tol;
    plates.forEach((list, k) => list.forEach(it => { const b = C.bbox(it.p); if (b.min[0] < -tol || b.min[1] < -tol || b.max[0] > W + tol || b.max[1] > D + tol) bad.push({ plate: k, name: it.name }); }));
    return bad;
  }
  // One 3MF, a Bambu Studio plate per bed load. off: where the usable area starts on the real bed (margin, exclusion
  // corner); bed: the real bed [x, y] (sets where slicers put plate 2, 3, ...).
  function plates3MF(plates, o) {
    o = o || {}; const off = o.offset || [0, 0], bed = o.bed || [256, 256], objs = [], lists = [];
    plates.forEach((list, k) => {
      const org = T.bambuPlateOrigin(k, plates.length, bed[0], bed[1]), ids = [];
      for (const it of list) { ids.push(objs.length); const mv = m => move(m, off[0] + org[0], off[1] + org[1]); objs.push(it.parts ? { name: it.name, parts: it.parts.map(q => ({ ...q, p: mv(q.p) })) } : { name: it.name, p: mv(it.p), color: it.color }); }
      lists.push(ids);
    });
    return T.threeMF(objs, { title: o.title || 'Expressarte plates', plates: lists, bambu: o.bambu, filaments: o.filaments, project: o.project });
  }
  // STL files in a folder per plate (each STL at its spot on that plate), for slicers without plates
  function platesFiles(plates, o) {
    o = o || {}; const off = o.offset || [0, 0], base = o.folder || 'plates', files = [], seen = new Set();
    plates.forEach((list, k) => list.forEach(it => {
      let n = String(it.name || 'part').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'part', m = n, c = 2;
      while (seen.has(`${k}/${m}`)) m = `${n}_${c++}`; seen.add(`${k}/${m}`);
      files.push({ name: `${base}/plate_${k + 1}/${m}.stl`, data: new Uint8Array(C.writeSTL(move(it.p, off[0], off[1]), m)) });
    }));
    return files;
  }
  // a short sentence for the UI
  function splitNote(name, s, bedLabel) {
    if (!s) return '';
    return `${name} is too big for your ${bedLabel || 'bed'}, so it is split into ${s.pieces.length} pieces with ${s.tabs} dovetail joint${s.tabs === 1 ? '' : 's'}.`;
  }
  const api = { dropCrumbs, JOINT, fits, plan, regions, buildSplit, arrange, checkPlates, plates3MF, platesFiles, normalize, turn, move, splitNote };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPPlates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
