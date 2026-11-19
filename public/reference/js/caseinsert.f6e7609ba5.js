/* Hard case inserts: divider trays, modular bins, a 42 mm grid floor and a lid organizer panel that fit the inside of
 * popular hard equipment cases exactly. Each case's interior comes from the maker's published CAD files: the cavity is
 * stored as stacked bands, each a measured outline at a height above the floor plus the rate the walls grow (draft)
 * up to the next band, so floor fillets, wheel wells, handle housings and bosses are all in the outline.
 * Inserts are built from stepped layers (StudioTools.steppedExtrude), each layer cut to the cavity at its lowest
 * height (the tightest spot), so the part fits everywhere and splits to the bed with dovetails (GPPlates).
 * The case mockup (shell, lid, latches, hinge, handle, wheels) is preview-only and never exported.
 */
(function (G) {
  'use strict';
  const C = G.SplitCore || require('./core'), T = G.StudioTools || require('./tools'), PL = G.GPPlates || require('./plates');
  const storageApi = () => G.GPCaseStorage || (typeof require === 'function' ? (() => { try { return require('./case-storage.js'); } catch (e) { return null; } })() : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };
  let DATA = G.GP_CASE_DATA || null;
  function setData(d) { DATA = d; BY = null; SEC.clear(); PROF.clear(); }
  let BY = null;
  function cases() { return DATA && DATA.cases || []; }
  function byId(id) { if (!BY) { BY = {}; for (const c of cases()) BY[c.id] = c; } return BY[id] || null; }
  const IN = 25.4;
  const PALETTE = [
    { name: 'Pastel peach', hex: '#F4B9A0' }, { name: 'Pastel mint', hex: '#A9DCC6' }, { name: 'Pastel sky', hex: '#A9C9EA' }, { name: 'Pastel lavender', hex: '#C8B9E6' },
    { name: 'Graphite', hex: '#3B4048' }, { name: 'Black', hex: '#1E1F22' }, { name: 'Slate gray', hex: '#6B7280' }, { name: 'Light gray', hex: '#C9CDD2' },
    { name: 'Olive drab', hex: '#5B6236' }, { name: 'Coyote tan', hex: '#B49A6C' }, { name: 'Safety orange', hex: '#E86A1E' }, { name: 'Signal yellow', hex: '#F2C230' },
    { name: 'Red', hex: '#C8322E' }, { name: 'Blue', hex: '#2F5FA7' }, { name: 'Forest green', hex: '#2F6B4F' }, { name: 'White', hex: '#F2F2EE' }
  ];
  const TYPES = { tray: 'Divider tray', bins: 'Separate bins', grid: '42 mm grid floor', mgrid: '25 mm multipoint grid', none: 'Nothing in the base' };
  const FREE = { maxPieces: 4 };
  const MG_THICK = [4.8, 6.4, 8, 10];
  const DEFAULTS = {
    caseId: '1510', type: 'tray', tol: 1.0, height: 0, cols: 3, rows: 2, merges: [], floor: 2.0, wall: 2.4, divider: 1.8,
    notches: true, notchDepth: 0, liftNotches: true, binWall: 1.6, binGap: 0.6,
    lid: false, lidHeight: 22, lidCols: 3, lidRows: 1, lidMerges: [],
    mgThick: 6.4, mgSpacer: 0, mgTol: 0.3, mgLid: false, mgWalls: false, mgWallH: 0, mgSample: true,
    colors: { insert: '#F4B9A0', lid: '#A9C9EA', grid: '#F4B9A0', mgrid: '#F4B9A0', body: '#E86A1E', cap: '#3B4048' }, detail: 'hd', bed: [256, 256], bambu: 'A1', preset: 'A1',
    storage: null
  };
  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    o.colors = Object.assign({}, DEFAULTS.colors, raw && raw.colors || {});
    o.tol = clamp(num(o.tol, 1), 0, 4);
    o.cols = clamp(Math.round(num(o.cols, 3)), 1, 12); o.rows = clamp(Math.round(num(o.rows, 2)), 1, 12);
    o.lidCols = clamp(Math.round(num(o.lidCols, 3)), 1, 12); o.lidRows = clamp(Math.round(num(o.lidRows, 1)), 1, 12);
    o.floor = clamp(num(o.floor, 2), 1.2, 6); o.wall = clamp(num(o.wall, 2.4), 1.2, 8); o.divider = clamp(num(o.divider, 1.8), 1.2, 6);
    o.binWall = clamp(num(o.binWall, 1.6), 1.2, 4); o.binGap = clamp(num(o.binGap, 0.6), 0.2, 3);
    o.merges = Array.isArray(o.merges) ? o.merges : []; o.lidMerges = Array.isArray(o.lidMerges) ? o.lidMerges : [];
    if (!TYPES[o.type]) o.type = 'tray';
    o.mgThick = MG_THICK.includes(+o.mgThick) ? +o.mgThick : 6.4; o.mgSpacer = clamp(num(o.mgSpacer, 0), 0, 80); o.mgTol = clamp(num(o.mgTol, 0.3), 0, 1.5);
    o.mgWallH = clamp(num(o.mgWallH, 0), 0, 300); o.mgLid = !!o.mgLid; o.mgWalls = !!o.mgWalls; o.mgSample = o.mgSample !== false;
    if (o.storage && typeof o.storage === 'object') o.storage = o.storage; else o.storage = o.storage || null;
    o.bed = Array.isArray(o.bed) ? [num(o.bed[0], 256), num(o.bed[1], num(o.bed[0], 256))] : [256, 256];
    return o;
  }

  // ---------------------------------------------------------------- the cavity
  const SEC = new Map();
  const dec = a => { const L = []; for (let i = 0; i < a.length; i += 2) L.push([a[i] / 10, a[i + 1] / 10]); return L; };
  function tubBands(tub) {
    if (!tub._bands) tub._bands = tub.b.map(b => ({ h: b[0], s: b[1], poly: { outer: dec(b[2]), holes: b.slice(3).map(dec) } }));
    return tub._bands;
  }
  // The cavity outline z mm above the floor, shrunk by the fit clearance. Cached.
  function section(tub, z, tol, key) {
    const k = `${key}|${z.toFixed(3)}|${tol}`;
    if (SEC.has(k)) return SEC.get(k);
    const B = tubBands(tub); let b = B[0];
    for (const q of B) if (q.h <= z + 1e-9) b = q;
    const grow = Math.max(0, z - b.h) * b.s - tol;
    let P = Math.abs(grow) < 1e-6 ? [b.poly] : T.offset([b.poly], grow, false); // mitre: every layer keeps the band's vertices, so steps stay clean
    if (P.length > 1) P = [P.reduce((a, q) => (T.polysArea([q]) > T.polysArea([a]) ? q : a))];
    if (SEC.size > 4000) SEC.clear();
    SEC.set(k, P); return P;
  }
  let NEST = 0.005; // kept for layeredPart's retry loop (the clean profile has no near-coincident layers)
  // Layer heights from z0 to z1: every band start, and steps short enough that the draft adds < 0.25 mm per step.
  function layerCuts(tub, z0, z1, detail, extra) {
    const B = tubBands(tub), cuts = new Set([z0, z1]);
    for (const b of B) if (b.h > z0 + 1e-6 && b.h < z1 - 1e-6) cuts.add(b.h);
    const maxStep = detail === 'draft' ? 14 : 8, drift = detail === 'draft' ? 0.6 : 0.25;
    for (let i = 0; i < B.length; i++) {
      const a = Math.max(z0, B[i].h), e = Math.min(z1, i + 1 < B.length ? B[i + 1].h : Infinity);
      if (e <= a) continue;
      const step = clamp(B[i].s > 1e-6 ? drift / B[i].s : maxStep, detail === 'draft' ? 1 : 0.5, maxStep), n = Math.ceil((e - a) / step - 1e-9);
      for (let k = 1; k < n; k++) cuts.add(a + (e - a) * k / n);
    }
    for (const z of extra || []) if (z > z0 + 1e-6 && z < z1 - 1e-6) cuts.add(z);
    const L = [...cuts].sort((a, b) => a - b), out = [];
    for (let i = 0; i + 1 < L.length; i++) if (L[i + 1] - L[i] > 0.05) out.push([L[i], L[i + 1]]);
    return out;
  }
  // ---------------------------------------------------------------- the clean profile
  // The raw CAD bands are coarse polygons that change shape every few millimeters, so following them layer by layer
  // gives stair-stepped, faceted walls. Instead every printed part follows one clean profile per case side:
  //   - a few straight-walled tiers: the main wall outline (the tightest outline from the top of the floor fillet up
  //     to the rim, convex corners rounded), widened only where the cavity really opens up (above a wheel well or a
  //     handle housing; a growth under 3 mm thick or one that starts in the top 12 mm is ignored), never more than
  //     one tier per 6 mm of height;
  //   - a true 45\u00b0 chamfer at the bottom that clears the floor fillet (fine 0.4 mm layers, the same as print layers).
  // Every outline is inside the cavity at its height and at every height above it (the part slides in from the top).
  const PROF = new Map();
  // drop vertices within e of the outline (closed rings; Ramer-Douglas-Peucker on the two halves)
  function simpRing(R, e) {
    if (R.length < 8) return R;
    const rdp = pts => {
      const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
      while (st.length) {
        const [a, b] = st.pop(); let best = -1, bd = e; const [ax, ay] = pts[a], [bx, by] = pts[b], L = Math.hypot(bx - ax, by - ay) || 1e-9;
        for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > bd) { bd = d; best = i; } }
        if (best > 0) { keep[best] = 1; st.push([a, best], [best, b]); }
      }
      return pts.filter((_, i) => keep[i]);
    };
    const h = Math.floor(R.length / 2), A = rdp(R.slice(0, h + 1)), Bq = rdp(R.slice(h).concat([R[0]]));
    const out = A.concat(Bq.slice(1, -1));
    return out.length >= 3 ? out : R;
  }
  const simp = (P, e) => P.map(q => ({ outer: simpRing(q.outer, e || 0.02), holes: (q.holes || []).map(hh => simpRing(hh, e || 0.02)) }));
  const opening = (P, r) => (r > 0.01 && P.length ? T.offset(T.offset(P, -r, true), r, true) : P);
  const biggest = P => (P.length > 1 ? [P.reduce((a, q) => (T.polysArea([q]) > T.polysArea([a]) ? q : a))] : P);
  const outside = (A, B) => { const d = T.diffPolys(A, B); return d.length ? Math.abs(T.polysArea(d)) : 0; };
  // the profile for a fit clearance: the bare cavity profile (computed once per case) shrunk by the clearance, so the
  // case preview and every insert share the same tiers
  function profile(tub, key, tol) {
    tol = +tol || 0;
    if (!tol) return profile0(tub, key);
    const pk = `${key}|${tol}`;
    if (PROF.has(pk)) return PROF.get(pk);
    const p0 = profile0(tub, key), memo = new Map();
    const at = z => { const k = z.toFixed(3); if (!memo.has(k)) { if (memo.size > 3000) memo.clear(); memo.set(k, simp(biggest(T.offset(p0.at(z), -tol, true)))); } return memo.get(k); };
    const res = Object.assign({}, p0, { at, tol });
    if (PROF.size > 40) PROF.clear();
    PROF.set(pk, res);
    return res;
  }
  function profile0(tub, key) {
    const tol = 0.05, pk = `${key}|0`; // 0.05 mm inside the bare cavity: slivers from simplifying never poke past it
    if (PROF.has(pk)) return PROF.get(pk);
    const B = tubBands(tub), rim = tub.F - 0.01;
    // F(z): the tightest section from z up to the rim, on a sampled set of heights (fine near the floor)
    const zs = new Set([0, rim]);
    for (const b of B) if (b.h < rim) zs.add(b.h);
    for (let z = 0; z < Math.min(rim, 30); z += 0.25) zs.add(+z.toFixed(2));
    for (let z = 0; z < rim; z += 2) zs.add(z);
    const Z = [...zs].sort((a, b) => b - a), Fz = new Map();
    let above = section(tub, rim, tol, key);
    for (const z of Z) { let P = biggest(simp(T.interPolys(section(tub, z, tol, key), above), 0.01)); if (!P.length) P = above; Fz.set(z, P); above = P; }
    const asc = Z.slice().reverse(), F = z => { let best = asc[0]; for (const q of asc) if (q <= z + 1e-9) best = q; return Fz.get(best); };
    // top of the floor fillet: the first band that rises gently
    let zc = 0; for (const b of B) { if (b.s < 0.3) { zc = b.h; break; } zc = b.h + 1; }
    zc = Math.min(zc, rim * 0.4);
    const rCorner = clamp(Math.min(...(() => { const bb = bboxOf(F(zc)); return [bb[2] - bb[0], bb[3] - bb[1]]; })()) * 0.04, 3, 8);
    const O1 = simp(biggest(opening(F(zc), rCorner)));
    // the bottom: the least inset of O1 that fits F(z) at each height under the fillet top, made never to grow
    // upward, so the part rounds down into the floor fillet (or a lid's dome) in fine layers; at least a 0.6 mm
    // chamfer so there's no elephant foot.
    const inset = z => {
      const Fq = F(z); if (outside(O1, Fq) < 0.5) return 0;
      let lo = 0, hi = 90; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (outside(T.offset(O1, -m, true), Fq) < 0.5) hi = m; else lo = m; }
      return hi;
    };
    const gz = [], top = Math.min(rim, zc + 8);
    for (let z = 0; z <= top + 1e-9; z += 0.25) gz.push([z, inset(z)]);
    for (let i = gz.length - 2; i >= 0; i--) gz[i][1] = Math.max(gz[i][1], gz[i + 1][1]);
    for (const q of gz) q[1] = Math.max(q[1], 0.6 - q[0]);
    // its least concave majorant (upper hull): a few straight chamfer facets instead of a wobbly fillet, so the
    // bottom edge reads as one clean bevel
    { const H = []; for (const q of gz) { while (H.length >= 2) { const [a1, b1] = [H[H.length - 2], H[H.length - 1]]; if ((b1[0] - a1[0]) * (q[1] - a1[1]) - (b1[1] - a1[1]) * (q[0] - a1[0]) >= 0) H.pop(); else break; } H.push(q.slice()); }
      for (const q of gz) { for (let i = 0; i + 1 < H.length; i++) if (q[0] >= H[i][0] - 1e-9 && q[0] <= H[i + 1][0] + 1e-9) { const t = (q[0] - H[i][0]) / Math.max(1e-9, H[i + 1][0] - H[i][0]); q[1] = Math.max(q[1], H[i][1] + (H[i + 1][1] - H[i][1]) * t); break; } } }
    let c = 0; for (const q of gz) if (q[1] > 1e-6) c = q[0] + 0.25;
    const g = z => { let v = 0; for (const q of gz) { if (q[0] > z + 1e-9) break; v = q[1]; } return v; };
    // tiers above the bottom: compare against the corner-rounded outline so the corners never count as growth
    const tiers = [{ z: 0, O: O1 }];
    let cur = O1, last = 0;
    for (const z of asc) {
      if (z < Math.max(zc, c) + 2 || z > rim - 12 || z - last < 6) continue;
      const Fr = biggest(opening(F(z), rCorner));
      const G = opening(T.diffPolys(Fr, cur), 2.5).filter(q => Math.abs(T.polysArea([q])) > 300);
      if (!G.length) continue;
      const U = simp(biggest(opening(T.unionPolys(cur.concat(G)), 2)));
      if (outside(U, F(z)) > 0.5 || Math.abs(T.polysArea(U)) - Math.abs(T.polysArea(cur)) < 300) continue;
      tiers.push({ z, O: U }); cur = U; last = z;
    }
    const at = z => {
      let t = tiers[0]; for (const q of tiers) if (q.z <= z + 1e-9) t = q;
      if (t === tiers[0] && z < c - 1e-9) { const d = g(z); return d > 1e-6 ? simp(biggest(T.offset(O1, -d, true))) : O1; }
      return t.O;
    };
    // layer breaks between z0 and z1: tier starts, the chamfer in 0.4 mm steps (1 mm in draft), and any extra heights
    const breaks = (z0, z1, detail, extra) => {
      const s = new Set([z0, z1]), st = detail === 'draft' ? 1 : 0.4;
      for (let z = 0; z < c; z += st) if (z > z0 + 1e-6 && z < z1 - 1e-6) s.add(+z.toFixed(3));
      if (c > z0 && c < z1) s.add(c);
      for (const q of tiers) if (q.z > z0 + 1e-6 && q.z < z1 - 1e-6) s.add(q.z);
      for (const z of extra || []) if (z > z0 + 1e-6 && z < z1 - 1e-6) s.add(z);
      const L = [...s].sort((a, b) => a - b), out = [];
      for (let i = 0; i + 1 < L.length; i++) if (L[i + 1] - L[i] > 0.05) out.push([L[i], L[i + 1]]);
      return out;
    };
    const res = { zc, c, tiers, at, breaks, F, tol: 0 };
    if (PROF.size > 40) PROF.clear();
    PROF.set(pk, res);
    return res;
  }
  // layers [z0, z1, outline] of the clean profile for the cuts
  // Without the 3D engine the parts are stepped extrusions, which need every layer a hair inside the one above
  // (no near-coincident edges between layers).
  function fitted(tub, cuts, tol, key) {
    const P = profile(tub, key, tol), out = cuts.map(([z0, z1]) => [z0, z1, P.at(z0)]);
    if (!MF) for (let i = out.length - 2; i >= 0; i--) { const q = biggest(T.interPolys(out[i][2], T.offset(out[i + 1][2], -NEST, false))); if (q.length) out[i][2] = q; }
    return out;
  }
  // a flat board on the floor (or lid): the tightest outline from z up, rounded, not chamfered (it fills the floor)
  function boardOutline(tub, key, tol, z) { const p0 = profile(tub, key, 0); return simp(biggest(opening(T.offset(p0.F(z), -tol, true), 4))); }
  function cleanCuts(tub, key, tol, z0, z1, detail, extra) { return profile(tub, key, tol).breaks(z0, z1, detail, extra); }
  function bboxOf(P) { const b = T.polysBBox(P); return [b.x0, b.y0, b.x1, b.y1]; }
  const rect = (x0, y0, x1, y1) => ({ outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], holes: [] });
  const rrect = (x0, y0, x1, y1, r) => ({ outer: T.roundRect(x0, y0, x1, y1, r, 6), holes: [] });
  const shift = (P, dx, dy) => P.map(q => ({ outer: q.outer.map(p => [p[0] + dx, p[1] + dy]), holes: q.holes.map(h => h.map(p => [p[0] + dx, p[1] + dy])) }));
  // round inside corners of pockets (an opening of the region)
  const soften = (P, r) => r > 0.05 && P.length ? T.offset(T.offset(P, -r), r) : P;

  // ---------------------------------------------------------------- cell layout (grid + merges, like the drawer organizer)
  // merges: [[c0, r0, c1, r1]] inclusive cell ranges joined into one compartment
  function cellRects(cols, rows, merges) {
    const owner = Array.from({ length: rows }, () => new Array(cols).fill(-1)), cells = [];
    for (const m of merges || []) {
      const c0 = clamp(Math.min(m[0], m[2]), 0, cols - 1), c1 = clamp(Math.max(m[0], m[2]), 0, cols - 1), r0 = clamp(Math.min(m[1], m[3]), 0, rows - 1), r1 = clamp(Math.max(m[1], m[3]), 0, rows - 1);
      let free = true; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (owner[r][c] >= 0) free = false;
      if (!free) continue;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) owner[r][c] = cells.length;
      cells.push({ c0, c1: c1 + 1, r0, r1: r1 + 1 });
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (owner[r][c] < 0) { owner[r][c] = cells.length; cells.push({ c0: c, c1: c + 1, r0: r, r1: r + 1 }); }
    return { cells, owner };
  }
  // inner divider segments between differently owned neighbors: [{axis:'x'|'y', at, a, b}] in cell units
  function dividerSegments(cols, rows, owner) {
    const segs = [];
    for (let c = 1; c < cols; c++) { let start = null; for (let r = 0; r <= rows; r++) { const wall = r < rows && owner[r][c - 1] !== owner[r][c]; if (wall && start === null) start = r; if (!wall && start !== null) { segs.push({ axis: 'x', at: c, a: start, b: r }); start = null; } } }
    for (let r = 1; r < rows; r++) { let start = null; for (let c = 0; c <= cols; c++) { const wall = c < cols && owner[r - 1][c] !== owner[r][c]; if (wall && start === null) start = c; if (!wall && start !== null) { segs.push({ axis: 'y', at: r, a: start, b: c }); start = null; } } }
    return segs;
  }

  // ---------------------------------------------------------------- printable parts
  // A divider tray: floor and outer wall follow the cavity; divider walls on the grid; U finger notches in the tops.
  function trayLayers(tub, key, o, spec) {
    const H = spec.height, tol = o.tol, top = profile(tub, key, tol).at(H), bb = bboxOf(top), smooth = !!MF;
    const { cells, owner } = cellRects(spec.cols, spec.rows, spec.merges);
    const segs = dividerSegments(spec.cols, spec.rows, owner);
    const X = c => bb[0] + (bb[2] - bb[0]) * c / spec.cols, Y = r => bb[1] + (bb[3] - bb[1]) * r / spec.rows, half = o.divider / 2, BIG = 60;
    const notchR = spec.notches ? clamp(spec.notchDepth || Math.min(28, H * 0.45), 6, Math.max(6, H - o.floor - 2)) : 0;
    // each divider run is split where another divider crosses it, so every compartment wall gets its own notch in
    // its middle (never on a crossing)
    const pieces = [];
    for (const sg of segs) {
      const cut = new Set([sg.a, sg.b]);
      for (const t of segs) if (t.axis !== sg.axis && t.at > sg.a && t.at < sg.b && sg.at >= t.a && sg.at <= t.b) cut.add(t.at);
      const L = [...cut].sort((p, q) => p - q); for (let i = 0; i + 1 < L.length; i++) pieces.push({ axis: sg.axis, at: sg.at, a: L[i], b: L[i + 1] });
    }
    const notchSegs = notchR ? pieces.filter(s => (s.axis === 'x' ? Y(s.b) - Y(s.a) : X(s.b) - X(s.a)) > notchR * 2 + 16) : [];
    const lift = spec.lift && notchR ? [[bb[0], 'x'], [bb[2], 'x']] : [];
    // finger notches: with the 3D engine, true round cuts after the walls are built; without it, fine layers
    const notchCuts = [];
    if (notchR && !smooth) for (let k = 1; k <= 24; k++) notchCuts.push(H - notchR * (1 - Math.cos(Math.PI / 2 * k / 24)));
    const layers = [], rIn = 4;
    for (const [z0, z1, O] of fitted(tub, cleanCuts(tub, key, tol, 0, H, o.detail, [o.floor, ...notchCuts]), tol, key)) {
      if (z1 <= o.floor + 1e-6) { layers.push({ z0, z1, polys: O }); continue; }
      const inner = simp(T.offset(O, -o.wall, true));
      // pockets: every corner rounded (where a divider meets a wall too), one clean wall all the way round
      const pockets = cells.map(c => {
        const x0 = c.c0 === 0 ? bb[0] - BIG : X(c.c0) + half, x1 = c.c1 === spec.cols ? bb[2] + BIG : X(c.c1) - half;
        const y0 = c.r0 === 0 ? bb[1] - BIG : Y(c.r0) + half, y1 = c.r1 === spec.rows ? bb[3] + BIG : Y(c.r1) - half;
        return simp(opening(T.interPolys([{ outer: T.roundRect(x0, y0, x1, y1, rIn, 12), holes: [] }], inner), rIn));
      }).flat();
      let solid = T.diffPolys(O, pockets);
      // finger notches: a U (half circle of radius notchR) dropped into every long divider and the two end walls
      if (notchR && !smooth && z0 >= H - notchR - 1e-6) {
        const w = Math.sqrt(Math.max(0, notchR * notchR - (H - z1) * (H - z1)));
        const cut = [];
        for (const s of notchSegs) {
          if (s.axis === 'x') { const x = X(s.at), m = (Y(s.a) + Y(s.b)) / 2; cut.push(rect(x - half - 3, m - w, x + half + 3, m + w)); }
          else { const y = Y(s.at), m = (X(s.a) + X(s.b)) / 2; cut.push(rect(m - w, y - half - 3, m + w, y + half + 3)); }
        }
        const my = (bb[1] + bb[3]) / 2;
        for (const [x] of lift) cut.push(rect(x - o.wall - 8, my - w, x + o.wall + 8, my + w));
        if (cut.length && w > 0.3) solid = T.diffPolys(solid, cut);
      }
      layers.push({ z0, z1, polys: solid });
    }
    const cyl = [];
    if (notchR && smooth) {
      for (const s of notchSegs) {
        if (s.axis === 'x') cyl.push({ ax: 'x', x: X(s.at), y: (Y(s.a) + Y(s.b)) / 2, len: o.divider + 6 });
        else cyl.push({ ax: 'y', x: (X(s.a) + X(s.b)) / 2, y: Y(s.at), len: o.divider + 6 });
      }
      const my = (bb[1] + bb[3]) / 2;
      for (const [x] of lift) cyl.push({ ax: 'x', x, y: my, len: 2 * (o.wall + 8) });
      for (const q of cyl) { q.z = H; q.r = notchR; }
    }
    return { layers, bb, cells, segs, notch: notchR, lift: lift.length > 0, cyl };
  }
  // Separate bins: each compartment is its own bin, cut to the cavity where it meets the case wall.
  function binLayers(tub, key, o, spec, cell) {
    const H = spec.height, tol = o.tol, top = profile(tub, key, tol).at(H), bb = bboxOf(top), g = o.binGap / 2, BIG = 60, smooth = !!MF;
    const X = c => bb[0] + (bb[2] - bb[0]) * c / spec.cols, Y = r => bb[1] + (bb[3] - bb[1]) * r / spec.rows;
    const x0 = cell.c0 === 0 ? bb[0] - BIG : X(cell.c0) + g, x1 = cell.c1 === spec.cols ? bb[2] + BIG : X(cell.c1) - g;
    const y0 = cell.r0 === 0 ? bb[1] - BIG : Y(cell.r0) + g, y1 = cell.r1 === spec.rows ? bb[3] + BIG : Y(cell.r1) - g;
    const notchR = spec.notches ? clamp(Math.min(22, H * 0.4), 6, Math.max(6, H - o.floor - 2)) : 0;
    const notchCuts = []; if (notchR && !smooth) for (let k = 1; k <= 24; k++) notchCuts.push(H - notchR * (1 - Math.cos(Math.PI / 2 * k / 24)));
    const layers = []; let foot = null, front = null;
    for (const [z0, z1, O] of fitted(tub, cleanCuts(tub, key, tol, 0, H, o.detail, [o.floor, ...notchCuts]), tol, key)) {
      const cellP = [{ outer: T.roundRect(x0, y0, x1, y1, 5, 14), holes: [] }], F = smooth ? simp(biggest(opening(T.interPolys(cellP, O), 5))) : T.interPolys(cellP, O);
      if (!F.length) continue;
      if (!foot) foot = F;
      if (z1 <= o.floor + 1e-6) { layers.push({ z0, z1, polys: F }); continue; }
      let solid = T.diffPolys(F, simp(T.offset(F, -o.binWall, true)));
      if (z1 >= H - 1e-6) front = F;
      if (notchR && !smooth && z0 >= H - notchR - 1e-6) {
        const w = Math.sqrt(Math.max(0, notchR * notchR - (H - z1) * (H - z1))), b = bboxOf(F), m = (b[0] + b[2]) / 2;
        if (w > 0.3 && b[2] - b[0] > notchR * 2 + 12) solid = T.diffPolys(solid, [rect(m - w, b[1] - 2, m + w, b[1] + o.binWall + 2)]);
      }
      layers.push({ z0, z1, polys: solid });
    }
    const cyl = [];
    if (notchR && smooth && front) { const b = bboxOf(front); if (b[2] - b[0] > notchR * 2 + 12) cyl.push({ ax: 'y', x: (b[0] + b[2]) / 2, y: b[1] + o.binWall / 2, len: o.binWall + 4, z: H, r: notchR }); }
    return { layers, foot, notch: notchR, cyl };
  }
  // 42 mm grid floor: a plate that follows the floor (fillet and all) with a socket for every whole cell.
  // 42 mm grid floor sockets are the female of the shared Expressarte foot in bin-features.js
  // (footBot 35.6, footMid 37.2, footTop 41.5, baseH 4.75), with 0.25 mm clearance per side.
  const GRID = { pitch: 42, floor: 1.2, depth: 4.75, clear: 0.25, footBot: 35.6, footMid: 37.2, footTop: 41.5, baseH: 4.75 };
  function gridLayers(tub, key, o) {
    const tol = o.tol, H = GRID.floor + GRID.depth, PR = profile(tub, key, tol), top = PR.at(H), bb = bboxOf(top);
    const room = T.offset(PR.at(0), -1.6, true), nx = Math.floor((bb[2] - bb[0] - 2) / GRID.pitch), ny = Math.floor((bb[3] - bb[1] - 2) / GRID.pitch);
    const ox = (bb[0] + bb[2]) / 2 - nx * GRID.pitch / 2, oy = (bb[1] + bb[3]) / 2 - ny * GRID.pitch / 2, socks = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = rect(ox + i * GRID.pitch, oy + j * GRID.pitch, ox + (i + 1) * GRID.pitch, oy + (j + 1) * GRID.pitch);
      if (Math.abs(T.polysArea(T.diffPolys([c], room))) < 0.5) socks.push([ox + (i + 0.5) * GRID.pitch, oy + (j + 0.5) * GRID.pitch]);
    }
    // female, from the socket floor up: short 45\u00b0 (0.8 mm, 35.6\u219237.2 + clear), 1.8 mm straight, long 45\u00b0 (2.15 mm, 37.2\u219241.5 + clear)
    const prof = [], zf = GRID.floor, c2 = 2 * GRID.clear;
    const n1 = o.detail === 'draft' ? 4 : 8, n2 = o.detail === 'draft' ? 4 : 12;
    for (let k = 0; k < n1; k++) prof.push([zf + 0.8 * k / n1, zf + 0.8 * (k + 1) / n1, GRID.footBot + c2 + (GRID.footMid - GRID.footBot) * (k + 0.5) / n1]);
    prof.push([zf + 0.8, zf + 2.6, GRID.footMid + c2]);
    for (let k = 0; k < n2; k++) prof.push([zf + 2.6 + 2.15 * k / n2, zf + 2.6 + 2.15 * (k + 1) / n2, GRID.footMid + c2 + (GRID.footTop - GRID.footMid) * (k + 0.5) / n2]);
    const layers = [];
    const cuts = cleanCuts(tub, key, tol, 0, H, o.detail, prof.flatMap(p => [p[0], p[1]]));
    for (const [z0, z1, O] of fitted(tub, cuts, tol, key)) {
      const band = prof.find(p => z0 >= p[0] - 1e-6 && z1 <= p[1] + 1e-6);
      if (!band || !socks.length) { layers.push({ z0, z1, polys: O }); continue; }
      const s = band[2] / 2, r = Math.max(0.8, 4 - (42 - band[2]) / 2);
      const holes = socks.map(([cx, cy]) => ({ outer: T.roundRect(cx - s, cy - s, cx + s, cy + s, r, 12), holes: [] }));
      layers.push({ z0, z1, polys: T.diffPolys(O, holes) });
    }
    return { layers, bb, nx, ny, sockets: socks.length, snapX: socks.length ? Array.from({ length: nx - 1 }, (_, k) => ox + (k + 1) * GRID.pitch) : [], snapY: socks.length ? Array.from({ length: ny - 1 }, (_, k) => oy + (k + 1) * GRID.pitch) : [] };
  }

  // Build a layered part, whole or split to the bed with dovetails. layersFn() is called again per piece.
  function usable(bed, preset) { const offY = ['P1S', 'P1P', 'X1 Carbon'].includes(preset) ? 24 : 0; return [bed[0] - 2 * 6 - 1, bed[1] - offY - 2 * 6 - 1]; }
  function closeMesh(p) {
    let m = p;
    if (!C.checkClosed(m).closed && C.fixTJunctions) for (const t of [1e-4, 1e-3, 5e-3]) { const f = C.fixTJunctions(m, new Array(m.length / 9).fill(0), t); if (f && f.p) m = Float64Array.from(f.p); if (C.checkClosed(m).closed) break; }
    if (!C.checkClosed(m).closed) m = fillSmallHoles(m);
    return m;
  }
  // A sliver step between two layers can lose its few cap triangles; close such small flat holes with a fan
  // (each open edge a\u2192b needs a face with b\u2192a).
  function fillSmallHoles(p) {
    const key = (i) => `${Math.round(p[i] * 1e4)},${Math.round(p[i + 1] * 1e4)},${Math.round(p[i + 2] * 1e4)}`, pos = new Map(), cnt = new Map();
    for (let i = 0; i < p.length; i += 9) {
      const k = [key(i), key(i + 3), key(i + 6)];
      if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue;
      for (let e = 0; e < 3; e++) { pos.set(k[e], i + e * 3); const a = k[e], b = k[(e + 1) % 3], r = b + '|' + a; if (cnt.get(r)) { const v = cnt.get(r) - 1; v ? cnt.set(r, v) : cnt.delete(r); } else cnt.set(a + '|' + b, (cnt.get(a + '|' + b) || 0) + 1); }
    }
    if (!cnt.size || cnt.size > 400) return p;
    if ([...cnt.values()].some(v => v > 1)) { // the same sliver triangle emitted twice by two caps: drop both copies, else flip one
      const tk = i => [key(i), key(i + 3), key(i + 6)], dup = new Map(), keep = [];
      for (let i = 0; i < p.length; i += 9) { const k = tk(i); if ((cnt.get(k[0] + '|' + k[1]) || 0) > 1 && (cnt.get(k[1] + '|' + k[2]) || 0) > 1 && (cnt.get(k[2] + '|' + k[0]) || 0) > 1) { const s = [...k].sort().join(';'); (dup.get(s) || dup.set(s, []).get(s)).push(i); } }
      const drop = new Set(), flip = new Set(); for (const L of dup.values()) if (L.length >= 2) { drop.add(L[0]); drop.add(L[1]); flip.add(L[1]); }
      const build = (mode) => { const out = []; for (let i = 0; i < p.length; i += 9) { if (mode === 'drop' && drop.has(i)) continue; if (mode === 'flip' && flip.has(i)) out.push(p[i], p[i + 1], p[i + 2], p[i + 6], p[i + 7], p[i + 8], p[i + 3], p[i + 4], p[i + 5]); else for (let j = 0; j < 9; j++) out.push(p[i + j]); } return Float64Array.from(out); };
      for (const mode of ['drop', 'flip']) { const q = build(mode); if (C.checkClosed(q).closed) return q; }
      return p;
    }
    const next = new Map(); for (const e of cnt.keys()) { const [a, b] = e.split('|'); if (next.has(a)) return p; next.set(a, b); }
    const add = [], seen = new Set();
    for (const st of next.keys()) {
      if (seen.has(st)) continue;
      const loop = []; let v = st;
      while (v && !seen.has(v)) { seen.add(v); loop.push(v); v = next.get(v); }
      if (v !== st || loop.length < 3 || loop.length > 60) return p;
      const P = loop.map(k => pos.get(k)), zs = P.map(i => p[i + 2]);
      if (Math.max(...zs) - Math.min(...zs) > 1e-3) return p;
      for (let j = 1; j + 1 < P.length; j++) for (const i of [P[0], P[j + 1], P[j]]) add.push(p[i], p[i + 1], p[i + 2]);
    }
    const q = new Float64Array(p.length + add.length); q.set(p); q.set(add, p.length);
    return C.checkClosed(q).closed ? q : p;
  }
  // round finger notches: horizontal cylinders taken out of a closed layered part with Manifold (smooth, 128 sides)
  let MF = null;
  function cutCylinders(p, cyl, dx, dy) {
    const Mf = MF, bin = [], k = m => { bin.push(m); return m; };
    try {
      const { V, F } = C.weld(p), mm = new Mf.Mesh({ numProp: 3, vertProperties: Float32Array.from(V), triVerts: Uint32Array.from(F) }); mm.merge();
      let m = k(new Mf.Manifold(mm));
      const cs = cyl.map(q => { let c = k(Mf.Manifold.cylinder(q.len, q.r, q.r, 128, true)); c = k(c.rotate(q.ax === 'x' ? [0, 90, 0] : [90, 0, 0])); return k(c.translate([q.x + dx, q.y + dy, q.z])); });
      m = k(m.subtract(k(Mf.Manifold.union(cs))));
      if (m.isEmpty()) return p;
      const g = m.getMesh(), np = g.numProp, vp = g.vertProperties, tv = g.triVerts, q = new Float64Array(tv.length * 3);
      for (let n = 0; n < tv.length; n++) { const s2 = tv[n] * np; q[n * 3] = vp[s2]; q[n * 3 + 1] = vp[s2 + 1]; q[n * 3 + 2] = vp[s2 + 2]; }
      return q;
    } catch (e) { return p; } finally { for (const m of bin) { try { m.delete(); } catch (e) { /* gone */ } } }
  }
  // the layered part built with Manifold: each layer a prism (cut to the piece being built), all fused, the round
  // notches taken out; always a closed solid. null when there's no engine or it fails (stepped extrude takes over).
  function manifoldPart(layers, cyl, dx, dy) {
    const Mf = MF, bin = [], k = m => { bin.push(m); return m; };
    try {
      const L = T.clipLayers ? T.clipLayers(layers) : layers; if (!L.length) return new Float64Array(0);
      const ps = L.map(l => k(k(k(new Mf.CrossSection(l.polys.flatMap(q => [q.outer, ...(q.holes || [])]), 'EvenOdd')).extrude(l.z1 - l.z0)).translate([0, 0, l.z0])));
      let m = k(Mf.Manifold.union(ps));
      if (cyl.length) {
        const cs = cyl.map(q => { let c = k(Mf.Manifold.cylinder(q.len, q.r, q.r, 128, true)); c = k(c.rotate(q.ax === 'x' ? [0, 90, 0] : [90, 0, 0])); return k(c.translate([q.x + dx, q.y + dy, q.z])); });
        m = k(m.subtract(k(Mf.Manifold.union(cs))));
      }
      if (m.isEmpty()) return new Float64Array(0);
      const g = m.getMesh(), np = g.numProp, vp = g.vertProperties, tv = g.triVerts, q = new Float64Array(tv.length * 3);
      for (let n = 0; n < tv.length; n++) { const s2 = tv[n] * np; q[n * 3] = vp[s2]; q[n * 3 + 1] = vp[s2 + 1]; q[n * 3 + 2] = vp[s2 + 2]; }
      return q;
    } catch (e) { return null; } finally { for (const m of bin) { try { m.delete(); } catch (e) { /* gone */ } } }
  }
  function layeredPart(name, layersFn, o, extra) {
    const L0 = layersFn(); const bb = L0.bb || bboxOf(L0.layers[L0.layers.length - 1].polys);
    const dx = -bb[0], dy = -bb[1], w = bb[2] - bb[0], d = bb[3] - bb[1];
    let strict = true;
    const build = () => {
      const L = layersFn(), lay = L.layers.map(l => ({ z0: l.z0, z1: l.z1, polys: shift(l.polys, dx, dy) }));
      let m = MF ? manifoldPart(lay, L.cyl || [], dx, dy) : null;
      if (!m) m = closeMesh(T.steppedExtrude(lay));
      if (strict && !C.checkClosed(m).closed) throw new Error('open piece'); // let the split move its seams and retry
      return m;
    };
    const [W, D] = usable(o.bed, o.preset || o.bambu), fits = PL.fits(w, d, W, D);
    const so = Object.assign({ edge: 30, tabZ: o.floor }, extra || {}, { snapX: (extra && extra.snapX || []).map(v => v + dx), snapY: (extra && extra.snapY || []).map(v => v + dy) });
    let split = null, whole = null;
    // a stubborn sliver between two layers goes away when the layers nest a little further apart (still microns)
    try {
      for (const nest of [0.005, 0.02, 0.06]) {
        NEST = nest;
        try { if (fits) whole = build(); else split = PL.buildSplit(w, d, W, D, build, so); break; } catch (e) { if (nest === 0.06) throw e; }
      }
    } catch (e) { strict = false; if (fits) whole = build(); else split = PL.buildSplit(w, d, W, D, build, so); }
    finally { NEST = 0.005; }
    const pieces = split ? split.pieces.map(pc => ({ local: PL.dropCrumbs(pc.built), index: pc.index, of: split.pieces.length })) : [{ local: whole, index: 0, of: 1 }];
    return { name, pieces, dx, dy, w, d, split: split ? { count: split.pieces.length, nx: split.plan.nx, ny: split.plan.ny, tabs: split.tabs, straight: split.straight } : null };
  }

  // ---------------------------------------------------------------- the case mockup (preview only, never exported)
  function rotX(p, ang, y0, z0) { const c = Math.cos(ang), s = Math.sin(ang), q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { const y = p[i + 1] - y0, z = p[i + 2] - z0; q[i] = p[i]; q[i + 1] = y0 + y * c - z * s; q[i + 2] = z0 + y * s + z * c; } return q; }
  function mirrorZ(p, zc) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 9) for (let v = 0; v < 3; v++) { const s = i + (v === 1 ? 6 : v === 2 ? 3 : 0), d = i + v * 3; q[d] = p[s]; q[d + 1] = p[s + 1]; q[d + 2] = 2 * zc - p[s + 2]; } return q; }
  function boxMesh(x0, y0, z0, x1, y1, z1, r) { return T.steppedExtrude([{ z0, z1, polys: [r ? rrect(x0, y0, x1, y1, r) : rect(x0, y0, x1, y1)] }]); }
  function cylY(cx, cz, r, y0, y1, n) { // cylinder along y
    n = n || 28; const out = [];
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * i / n, b = 2 * Math.PI * (i + 1) / n, p = t => [cx + r * Math.cos(t), cz + r * Math.sin(t)];
      const [ax, az] = p(a), [bx, bz] = p(b);
      out.push(ax, y0, az, bx, y0, bz, cx, y0, cz, bx, y1, bz, ax, y1, az, cx, y1, cz, ax, y0, az, ax, y1, az, bx, y1, bz, ax, y0, az, bx, y1, bz, bx, y0, bz);
    }
    return Float64Array.from(out);
  }
  function cylX(cy, cz, r, x0, x1, n) { const m = cylY(cy, cz, r, x0, x1, n), q = new Float64Array(m.length); for (let i = 0; i < m.length; i += 3) { q[i] = m[i + 1]; q[i + 1] = m[i]; q[i + 2] = m[i + 2]; } for (let i = 0; i < q.length; i += 9) for (let k = 0; k < 3; k++) { const t = q[i + 3 + k]; q[i + 3 + k] = q[i + 6 + k]; q[i + 6 + k] = t; } return q; }
  // extrusions of a 2D profile along x (profile in y,z) or y (profile in z,x); both are cyclic axis swaps, so the
  // triangle winding stays outward
  function prismX(polys, x0, x1) { const m = T.steppedExtrude([{ z0: x0, z1: x1, polys }]), q = new Float64Array(m.length); for (let i = 0; i < m.length; i += 3) { q[i] = m[i + 2]; q[i + 1] = m[i]; q[i + 2] = m[i + 1]; } return q; }
  function prismY(polys, y0, y1) { const m = T.steppedExtrude([{ z0: y0, z1: y1, polys }]), q = new Float64Array(m.length); for (let i = 0; i < m.length; i += 3) { q[i] = m[i + 1]; q[i + 1] = m[i + 2]; q[i + 2] = m[i]; } return q; }
  const ring = (cx, cy, r, n) => T.circle(cx, cy, r, n || 28);
  // A rolling or carry hard case around the measured interior: thick drafted shell with molded vertical ribs, a
  // parting-line flange with a gasket, a deep lid with stiffening ridges, double-throw latches, padlock hasps, a
  // purge valve, rubber-gripped handles, and on rolling cases wheels in molded wells and a telescoping pull handle.
  // No logos or text. Preview only: none of this is ever exported.
  function mockup(cs, o, lidAngle) {
    const base = cs.base, lid = cs.lid, Fb = base.F, Fl = lid.F, key = cs.id + 'b', lkey = cs.id + 'l';
    const W = 8, floorT = 14, topT = 13, FL = 6, out = []; // shell, floor and lid top sized to the real 1510 outside (559 \u00d7 351 \u00d7 229 mm)
    const shell = '#18191B', trim = '#232427', steel = '#B9BDC3', rubber = '#121314', hub = '#45484E', gasket = '#0B0B0C';
    const push = (name, p, color, mat) => { if (p && p.length) out.push({ name, p, color, mat, kind: 'case' }); };
    const tb = bboxOf(section(base, Fb - 0.01, 0, key)), L = tb[2] - tb[0], D = tb[3] - tb[1], cx = (tb[0] + tb[2]) / 2, cy = (tb[1] + tb[3]) / 2;
    const exR = clamp(Math.min(L, D) * 0.09, 18, 34);
    const X0 = tb[0] - W, X1 = tb[2] + W, Y0 = tb[1] - W, Y1 = tb[3] + W; // outside of the shell at the rim
    // walls taper in toward the bottom (molding draft) and round over at the bottom edge
    const ext = (z, inset) => { const g = 0.014 * Math.max(0, Fb - z) + (inset || 0); return [rrect(X0 + g, Y0 + g, X1 - g, Y1 - g, Math.max(6, exR - g))]; };
    const wheels = !!cs.wheels, wr = clamp(Fb * 0.2 + 6, 28, 42), wx = X0 + wr * 0.72, wz = -floorT - 5 + wr, ww = 30;
    const wy = [Y0 + 6, Y1 - 6 - ww];
    const wellCut = z => {
      if (!wheels || z > wz + wr + 4) return null;
      const r = [rect(X0 - 20, Y0 - 20, wx + wr + 5, wy[0] + ww + 4), rect(X0 - 20, wy[1] - 4, wx + wr + 5, Y1 + 20)];
      return T.diffPolys(r, T.offset(section(base, Math.max(0, z), 0, key), 3, false)); // never through to the cavity
    };
    // ---- base tub: real interior inside the shell
    const BL = [{ z0: -floorT, z1: -floorT + 2.5, polys: ext(-floorT, 3) }, { z0: -floorT + 2.5, z1: 0, polys: ext(0, 0.8) }];
    for (const [z0, z1] of layerCuts(base, 0, Fb, 'draft')) BL.push({ z0, z1, polys: T.diffPolys(ext(z0), section(base, z0, 0, key)) });
    for (const l of BL) { const c = wellCut(l.z0); if (c && c.length) l.polys = T.diffPolys(l.polys, c); }
    push('Case', T.steppedExtrude(BL), shell, 'caseshell');
    // parting-line flange (tongue side) on the base
    const flangeRing = (inset, grow) => T.diffPolys([rrect(X0 - grow, Y0 - grow, X1 + grow, Y1 + grow, exR + grow)], [rrect(X0 + inset, Y0 + inset, X1 - inset, Y1 - inset, Math.max(4, exR - inset))]);
    push('Rim', T.steppedExtrude([{ z0: Fb - 16, z1: Fb - 13, polys: flangeRing(1, FL - 2) }, { z0: Fb - 13, z1: Fb - 0.01, polys: flangeRing(1, FL) }]), shell, 'caseshell');
    // molded vertical ribs on the base walls, clear of the latches and handles
    const ribs = [];
    const ribX = (x, y0, y1, z0, z1) => ribs.push(boxMesh(x - 3.2, y0, z0, x + 3.2, y1, z1, 1.4));
    const ribY = (y, x0, x1, z0, z1) => ribs.push(boxMesh(x0, y - 3.2, z0, x1, y + 3.2, z1, 1.4));
    const nLat = L < 520 ? 2 : L < 640 ? 4 : 4, latX = Array.from({ length: nLat }, (_, k) => tb[0] + L * (k + 0.5) / nLat);
    const endLatch = L >= 640;
    const zr0 = 10, zr1 = Fb - 16;
    const zs = x => wheels && x < wx + wr + 8 ? wz + wr + 6 : zr0;
    for (const x of [X0 + exR + 8, X0 + exR + 22, X1 - exR - 8, X1 - exR - 22]) { ribX(x, Y0 - 3, Y0 + 2, zs(x), zr1); ribX(x, Y1 - 2, Y1 + 3, zs(x), zr1); }
    for (const y of [Y0 + exR + 8, Y1 - exR - 8]) { if (!wheels || y > wy[0] + ww + 6 && y < wy[1] - 6) ribY(y, X0 - 3, X0 + 2, zr0, zr1); ribY(y, X1 - 2, X1 + 3, zr0, zr1); }
    if (wheels) for (const y of [wy[0] + ww + 10, wy[1] - 10]) ribY(y, X0 - 3, X0 + 2, wz + wr + 6, zr1);
    push('Ribs', T.concat(ribs), shell, 'caseshell');
    // feet
    const feet = []; for (const [x, y] of [[X0 + 45, Y0 + 32], [X1 - 45, Y0 + 32], [X0 + 45, Y1 - 32], [X1 - 45, Y1 - 32]]) { if (wheels && x < cx) continue; feet.push(boxMesh(x - 18, y - 12, -floorT - 5, x + 18, y + 12, -floorT + 0.5, 6)); }
    if (wheels) for (const y of [Y0 + 60, Y1 - 60]) feet.push(boxMesh(X0 + wr * 2 + 20, y - 12, -floorT - 5, X0 + wr * 2 + 56, y + 12, -floorT + 0.5, 6));
    push('Feet', T.concat(feet), rubber, 'rubber');
    // ---- lid: built with its outside top at z = 0 and the rim at Fl + topT, then flipped onto the base and swung open
    const lt = bboxOf(section(lid, Math.max(0, Fl - 0.01), 0, lkey)), sx = Math.min(1, L / Math.max(1, lt[2] - lt[0])), sy = Math.min(1, D / Math.max(1, lt[3] - lt[1]));
    const lidSec = z => section(lid, z, 0, lkey).map(q => ({ outer: q.outer.map(p => [p[0] * sx, p[1] * sy]), holes: q.holes.map(h => h.map(p => [p[0] * sx, p[1] * sy])) }));
    const H = Fl + topT, lext = (z, inset) => { const g = 0.014 * Math.max(0, H - z) * 0.6 + (inset || 0); return [rrect(X0 + g, Y0 + g, X1 - g, Y1 - g, Math.max(6, exR - g))]; };
    const LL = [{ z0: 0, z1: 2.5, polys: lext(0, 3) }, { z0: 2.5, z1: topT, polys: lext(2.5, 0.8) }];
    for (const [z0, z1] of layerCuts(lid, 0, Fl, 'draft')) LL.push({ z0: topT + z0, z1: topT + z1, polys: T.diffPolys(lext(topT + z0), lidSec(z0)) });
    // stiffening ridges on the outside of the lid: a raised frame and long ribs between
    const ridges = [], inS = Math.min(30, D * 0.1);
    ridges.push(T.diffPolys([rrect(X0 + inS, Y0 + inS, X1 - inS, Y1 - inS, exR * 0.7)], [rrect(X0 + inS + 9, Y0 + inS + 9, X1 - inS - 9, Y1 - inS - 9, exR * 0.5)]));
    const nR = D > 330 ? 3 : 2; for (let k = 1; k <= nR; k++) { const y = Y0 + inS + 9 + (D + 2 * W - 2 * inS - 18) * k / (nR + 1); ridges.push([rrect(X0 + inS + 30, y - 4, X1 - inS - 30, y + 4, 3.5)]); }
    const lidTop = T.steppedExtrude([{ z0: -3, z1: 0.01, polys: T.unionPolys(ridges.flat()) }]);
    const lidRim = T.steppedExtrude([{ z0: H - 13, z1: H - 10, polys: flangeRing(1, FL - 2) }, { z0: H - 10, z1: H, polys: flangeRing(1, FL) }]);
    const lr = []; for (const x of [X0 + exR + 8, X0 + exR + 22, X1 - exR - 8, X1 - exR - 22]) { lr.push(boxMesh(x - 3.2, Y0 - 3, 6, x + 3.2, Y0 + 2, H - 13, 1.4), boxMesh(x - 3.2, Y1 - 2, 6, x + 3.2, Y1 + 3, H - 13, 1.4)); }
    for (const y of [Y0 + exR + 8, Y1 - exR - 8]) lr.push(boxMesh(X0 - 3, y - 3.2, 6, X0 + 2, y + 3.2, H - 13, 1.4), boxMesh(X1 - 2, y - 3.2, 6, X1 + 3, y + 3.2, H - 13, 1.4));
    // gasket: the dark O-ring line in the lid's rim
    const gk = T.steppedExtrude([{ z0: H - 0.01, z1: H + 1.6, polys: T.diffPolys([rrect(X0 + 1.4, Y0 + 1.4, X1 - 1.4, Y1 - 1.4, exR - 1.4)], [rrect(X0 + 4.6, Y0 + 4.6, X1 - 4.6, Y1 - 4.6, exR - 4.6)]) }]);
    const toClosed = m => { const q = mirrorZ(m, 0); for (let i = 2; i < q.length; i += 3) q[i] += Fb + H; return q; };
    const hingeY = Y1 + FL + 3, hingeZ = Fb, ang = lidAngle == null ? -1.88 : lidAngle;
    const open = m => rotX(toClosed(m), ang, hingeY, hingeZ);
    push('Case lid', open(T.concat([T.steppedExtrude(LL), lidTop, lidRim, T.concat(lr)])), shell, 'caseshell');
    push('Gasket', open(gk), gasket, 'rubber');
    // ---- hinge along the back: alternating knuckles and a steel pin
    const nK = Math.max(4, Math.round(L / 70) * 2);
    for (let k = 0; k < nK; k++) { const x0 = X0 + exR + (L + 2 * W - 2 * exR) * k / nK, x1 = x0 + (L + 2 * W - 2 * exR) / nK - 1.5; push('Hinge', cylX(hingeY, hingeZ, 6.5, x0, x1, 20), trim, 'caseshell'); }
    push('Hinge pin', cylX(hingeY, hingeZ, 2.2, X0 + exR - 4, X1 - exR + 4, 12), steel, 'frame');
    // ---- double-throw latches on the front (and the ends of big cases), shown thrown open; keepers on the lid
    const fy = Y0 - FL, latch = [], keep = [], bosses = [];
    const oneLatch = (x) => {
      const lw = clamp(L * 0.075, 26, 46), pl = clamp(Fb * 0.42, 30, 52), pz = Fb - 0.75 * pl - 1;
      bosses.push(boxMesh(x - lw / 2 - 5, fy - 4, pz - 10, x + lw / 2 + 5, Y0 + 1, Fb - 14, 3));
      let plate = T.concat([
        prismY([rrect(pz - 2, x - lw / 2, pz + pl, x + lw / 2, 6)], fy - 11, fy - 4),                 // the throw plate
        prismY([rrect(pz + pl - 8, x - lw / 2 + 4, pz + pl - 2, x + lw / 2 - 4, 2)], fy - 4, fy + 2),         // the hook lip
        prismY([rrect(pz + 6, x - 6, pz + pl * 0.58, x + 6, 3)], fy - 13.5, fy - 11)                         // finger ridge
      ]);
      plate = rotX(plate, 2.75, fy - 6, pz); // swung down and out on its pivot
      latch.push(plate, cylX(fy - 6, pz, 4.2, x - lw / 2 - 2, x + lw / 2 + 2, 14));
      keep.push(boxMesh(x - lw / 2 + 2, Y0 - FL - 6, H - 22, x + lw / 2 - 2, Y0 - FL + 1, H - 13, 2.5));
    };
    latX.forEach(oneLatch);
    push('Latch mounts', T.concat(bosses), shell, 'caseshell');
    push('Latches', T.concat(latch), trim, 'caseshell');
    if (endLatch) { // one latch on each end, built on the front and turned to the end faces
      const x = cx, one = []; const save = latch.length; oneLatch(x); const p = T.concat(latch.splice(save)); bosses.length = 0;
      for (const [s, ex0] of [[1, X1], [-1, X0]]) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { const dx = p[i] - x, dy = p[i + 1] - fy; q[i] = ex0 + s * (FL - dy) - s * 0; q[i + 1] = cy + s * dx; q[i + 2] = p[i + 2]; } one.push(q); }
      push('End latches', T.concat(one), trim, 'caseshell'); keep.splice(-1, 1);
    }
    push('Latch keepers', open(T.concat(keep)), shell, 'caseshell');
    // ---- padlock hasps outside the outer latches: a steel-lined tab on the base and its partner on the lid
    const hasp = [], haspS = [], haspL = [], haspLS = [];
    for (const x of [latX[0] - L / nLat * 0.32, latX[nLat - 1] + L / nLat * 0.32]) {
      const prof = { outer: T.roundRect(Fb - 26, x - 9, Fb - 1, x + 9, 4), holes: [ring(Fb - 9, x, 3.6, 18).reverse()] };
      hasp.push(prismY([prof], fy - 14, fy + 1));
      haspS.push(prismY([{ outer: ring(Fb - 9, x, 5.2, 20), holes: [ring(Fb - 9, x, 3.6, 18).reverse()] }], fy - 14.6, fy - 13.4));
      const lp = { outer: T.roundRect(H - 26, x - 9, H - 1, x + 9, 4), holes: [ring(H - 9, x, 3.6, 18).reverse()] };
      haspL.push(prismY([lp], Y0 - FL - 14, Y0 - FL + 1));
      haspLS.push(prismY([{ outer: ring(H - 9, x, 5.2, 20), holes: [ring(H - 9, x, 3.6, 18).reverse()] }], Y0 - FL - 14.6, Y0 - FL - 13.4));
    }
    push('Padlock hasps', T.concat(hasp), shell, 'caseshell'); push('Hasp liners', T.concat(haspS), steel, 'frame');
    push('Lid hasps', open(T.concat(haspL)), shell, 'caseshell'); push('Lid hasp liners', open(T.concat(haspLS)), steel, 'frame');
    // ---- purge valve on the front of the base
    const pvx = nLat === 2 ? cx + L * 0.3 : (latX[0] + latX[1]) / 2, pvz = Fb * 0.5;
    push('Purge valve', T.concat([prismY([{ outer: ring(pvz, pvx, 15, 32), holes: [] }], fy + FL - 2.5, fy + FL + 1), prismY([{ outer: ring(pvz, pvx, 10, 24), holes: [] }], fy + FL - 9, fy + FL - 2.5)]), trim, 'caseshell');
    push('Purge valve cap', prismY([{ outer: ring(pvz, pvx, 7, 6), holes: [] }], fy + FL - 10.5, fy + FL - 8.9), hub, 'caseshell');
    // ---- carry handles: rubber over-molded grips on pivot blocks (front, and the end opposite the wheels)
    const hw = clamp(L * 0.3, 70, 160), hz = Fb - clamp(Fb * 0.25, 22, 30);
    push('Handle mounts', T.concat([boxMesh(cx - hw / 2 - 14, Y0 - 12, hz - 20, cx - hw / 2 + 2, Y0 + 1, hz + 10, 4), boxMesh(cx + hw / 2 - 2, Y0 - 12, hz - 20, cx + hw / 2 + 14, Y0 + 1, hz + 10, 4)]), trim, 'caseshell');
    push('Handle', prismX([rrect(Y0 - 27, hz - 34, Y0 - 13, hz - 20, 6)], cx - hw / 2 - 2, cx + hw / 2 + 2), rubber, 'rubber');
    push('Handle arms', T.concat([boxMesh(cx - hw / 2 - 10, Y0 - 24, hz - 30, cx - hw / 2, Y0 - 6, hz - 6, 3), boxMesh(cx + hw / 2, Y0 - 24, hz - 30, cx + hw / 2 + 10, Y0 - 6, hz - 6, 3)]), trim, 'caseshell');
    const ew = clamp(D * 0.42, 60, 150), ez = wheels ? Fb - 26 : Fb - 30;
    push('End handle mounts', T.concat([boxMesh(X1 - 1, cy - ew / 2 - 14, ez - 18, X1 + 12, cy - ew / 2 + 2, ez + 10, 4), boxMesh(X1 - 1, cy + ew / 2 - 2, ez - 18, X1 + 12, cy + ew / 2 + 14, ez + 10, 4)]), trim, 'caseshell');
    push('End handle', prismY([rrect(ez - 8, X1 + 6, ez + 6, X1 + 20, 6)], cy - ew / 2 - 2, cy + ew / 2 + 2), rubber, 'rubber');
    if (wheels) {
      // telescoping pull handle out of the end opposite the wheels: two tube stages and a rubber grip
      const tw = clamp(D * 0.55, 120, 200), tz = 24, ty = [cy - tw / 2, cy + tw / 2], ext1 = 4, ext2 = 4; // retracted: the grip rests just off the end
      push('Pull handle housing', T.concat(ty.map(y => boxMesh(X1 - 2, y - 11, tz - 13, X1 + 7, y + 11, tz + 13, 4))), trim, 'caseshell');
      push('Pull handle tubes', T.concat(ty.flatMap(y => [cylX(y, tz, 7, X1 + 6, X1 + 6 + ext1, 20), cylX(y, tz, 5.6, X1 + 6 + ext1 - 2, X1 + 6 + ext1 + ext2, 20)])), steel, 'frame');
      push('Pull handle grip', T.concat([prismY([rrect(tz - 12, X1 + 6 + ext1 + ext2 - 4, tz + 12, X1 + 6 + ext1 + ext2 + 16, 8)], ty[0] - 10, ty[1] + 10)]), rubber, 'rubber');
      // polyurethane wheels with hub caps in the molded wells, on a steel axle
      for (const y of wy) {
        push('Wheel', cylY(wx, wz, wr, y, y + ww, 40), rubber, 'rubber');
        push('Wheel hub', T.concat([cylY(wx, wz, wr * 0.62, y - 1.2, y + ww + 1.2, 28)]), hub, 'caseshell');
        push('Axle', cylY(wx, wz, 4, y - 2.5, y + ww + 2.5, 12), steel, 'frame');
      }
    }
    const openLid = m => open(PL.move(m, 0, 0, topT));
    return { parts: out.map(q => Object.assign(q, { preview: true })), open, openLid, toClosed, hinge: [hingeY, hingeZ], ang, lidDepth: H };
  }

  // ---------------------------------------------------------------- build
  // the published bottom depth is the cap where the CAD floor reads deeper (1535 Air); 1 mm below the rim
  function heightFor(cs, o) { const spec = cs.spec && cs.spec[3] ? cs.spec[3] * 25.4 + 0.5 : Infinity, max = Math.floor(Math.min(cs.base.F, spec) - 1); return clamp(num(o.height, 0) > 0 ? +o.height : max, 8, max); }
  // ---------------------------------------------------------------- 25 mm multipoint grid boards
  // The board the device holster bolts to: big threaded holes on a 25 mm grid with small threaded holes at every
  // grid corner, the same threads the holster's printed bolts use (holster.js THREADS, cut with its threadCutter).
  // A floor panel cut to the case floor (tight friction fit, no drilling), optional lid and wall panels; the hole
  // pattern is centered so the edges come out even. Bed-sized tiles join with dovetails along a big-hole line (those
  // big holes are left out so the seam runs through solid board). Built with Manifold.
  const holsterApi = () => G.GPHolster || (typeof require === 'function' ? (() => { try { return require('./holster.js'); } catch (e) { return null; } })() : null);
  const MG = { pitch: 25, edge: 1.6, tab: 0.15 };
  function inPolys(x, y, P) {
    const pip = r => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    return P.some(q => pip(q.outer) && !(q.holes || []).some(pip));
  }
  // hole centers for an outline (2D polys), the pattern centered on its box: big at cell centers, small at corners
  function mgHoles(P, TH, skipX, skipY) {
    const b = bboxOf(P), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, p = MG.pitch;
    const rB = TH.large.major / 2 + 0.5 + MG.edge, rS = TH.small.major / 2 + 0.5 + MG.edge;
    const inB = T.offset(P, -rB, false), inS = T.offset(P, -rS, false), big = [], small = [];
    const nx = Math.ceil((b[2] - b[0]) / p / 2) + 1, ny = Math.ceil((b[3] - b[1]) / p / 2) + 1;
    const near = (v, L) => L.some(s => Math.abs(s - v) < 1);
    for (let i = -nx; i <= nx; i++) for (let j = -ny; j <= ny; j++) {
      const x = cx + p * i, y = cy + p * j;
      if (!near(x, skipX) && !near(y, skipY) && inPolys(x, y, inB) && inPolys(x + rB * 0.7, y + rB * 0.7, inB) && inPolys(x - rB * 0.7, y - rB * 0.7, inB)) big.push([x, y]);
      const xs = x + p / 2, ys = y + p / 2;
      if (inPolys(xs, ys, inS)) small.push([xs, ys]);
    }
    return { big, small, cx, cy };
  }
  // seams on big-hole lines near an even split of the span into n tiles
  function mgSeams(a, b, c, n) {
    const out = []; for (let k = 1; k < n; k++) { const t = a + (b - a) * k / n; out.push(c + MG.pitch * Math.round((t - c) / MG.pitch)); }
    return [...new Set(out)].filter(v => v > a + 30 && v < b - 30).sort((x, y) => x - y);
  }
  // a dovetail tab across a seam; dir +1 sticks out toward +x (or +y)
  function mgTab(axis, s, t, dir, grow) {
    const g = grow || 0, a = [[-1.5, -3 - g], [2 + g, -3 - g], [7 + g, -5.5 - g], [7 + g, 5.5 + g], [2 + g, 3 + g], [-1.5, 3 + g]];
    const pts = a.map(([u, v]) => axis === 'x' ? [s + dir * u, t + v] : [t + v, s + dir * u]);
    if ((axis === 'x') !== (dir > 0)) pts.reverse();
    return { outer: T.polysArea([{ outer: pts, holes: [] }]) < 0 ? pts.slice().reverse() : pts, holes: [] };
  }
  // one panel: outline P (2D, panel frame), z from 0 to thick (+ spacer ribs under it); returns tiles in the panel frame
  function mgPanel(Mf, P, o, W, D, label, spacer) {
    const H = holsterApi(); if (!H || !H.threadCutter) throw Error('The multipoint grid needs the holster module.');
    const TH = H.THREADS, bb = bboxOf(P), t = o.mgThick, S = spacer || 0, bin = [], k = m => { bin.push(m); return m; };
    try {
      const b0 = mgHoles(P, TH, [], []);
      const nx = Math.ceil((bb[2] - bb[0]) / (W - 4)), ny = Math.ceil((bb[3] - bb[1]) / (D - 4));
      const sx = mgSeams(bb[0], bb[2], b0.cx, nx), sy = mgSeams(bb[1], bb[3], b0.cy, ny);
      const hs = mgHoles(P, TH, sx, sy);
      const xs = [bb[0] - 20, ...sx, bb[2] + 20], ys = [bb[1] - 20, ...sy, bb[3] + 20];
      // tabs: one per big-hole row along each seam (clear of the crossing seams), alternating sides
      const rowsY = [], rowsX = []; for (let j = -40; j <= 40; j++) { rowsY.push(hs.cy + MG.pitch * j); rowsX.push(hs.cx + MG.pitch * j); }
      const tabs = [];
      for (const s of sx) rowsY.forEach((y, i) => { if (y > bb[1] + 12 && y < bb[3] - 12 && !sy.some(v => Math.abs(v - y) < 13) && inPolys(s, y, T.offset(P, -9, false))) tabs.push({ axis: 'x', s, t: y, dir: i % 2 ? 1 : -1 }); });
      for (const s of sy) rowsX.forEach((x, i) => { if (x > bb[0] + 12 && x < bb[2] - 12 && !sx.some(v => Math.abs(v - x) < 13) && inPolys(x, s, T.offset(P, -9, false))) tabs.push({ axis: 'y', s, t: x, dir: i % 2 ? 1 : -1 }); });
      const zb = S, zt = S + t;
      const slab = k(k(new Mf.CrossSection(P.flatMap(q => [q.outer, ...(q.holes || [])]), 'EvenOdd')).extrude(t)).translate([0, 0, zb]);
      let solid = k(slab);
      if (S > 0) { // spacer: a perimeter ring and ribs on every other corner line (between the small holes' columns)
        const ring = T.diffPolys(P, T.offset(P, -5, false)), ribs = [];
        for (let i = -40; i <= 40; i += 2) { const x = hs.cx + MG.pitch * (i + 0.5); if (x > bb[0] && x < bb[2]) ribs.push(rect(x - 1.5, bb[1] - 5, x + 1.5, bb[3] + 5)); }
        for (let i = -40; i <= 40; i += 2) { const y = hs.cy + MG.pitch * (i + 0.5); if (y > bb[1] && y < bb[3]) ribs.push(rect(bb[0] - 5, y - 1.5, bb[2] + 5, y + 1.5)); }
        const under = T.unionPolys([...ring, ...T.interPolys(T.unionPolys(ribs), P)]);
        solid = k(Mf.Manifold.union([solid, k(k(new Mf.CrossSection(under.flatMap(q => [q.outer, ...(q.holes || [])]), 'EvenOdd')).extrude(S + 0.01))]));
      }
      const cut = soup => { const { V, F } = C.weld(soup), mm = new Mf.Mesh({ numProp: 3, vertProperties: Float32Array.from(V), triVerts: Uint32Array.from(F) }); mm.merge(); return k(new Mf.Manifold(mm)); };
      const cB = cut(H.threadCutter(TH.large, zb, zt, o.detail)), cS = cut(H.threadCutter(TH.small, zb, zt, o.detail));
      const tiles = [];
      for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
        let R = [rect(xs[i], ys[j], xs[i + 1], ys[j + 1])];
        const mine = [], theirs = [];
        for (const tb of tabs) {
          const lo = tb.axis === 'x' ? xs[i] : ys[j], hi = tb.axis === 'x' ? xs[i + 1] : ys[j + 1], along = tb.axis === 'x' ? [ys[j], ys[j + 1]] : [xs[i], xs[i + 1]];
          if (tb.t < along[0] || tb.t > along[1]) continue;
          if (Math.abs(tb.s - hi) < 1e-6) (tb.dir > 0 ? mine : theirs).push(tb);
          else if (Math.abs(tb.s - lo) < 1e-6) (tb.dir < 0 ? mine : theirs).push(tb);
        }
        if (mine.length) R = T.unionPolys([...R, ...mine.map(q => mgTab(q.axis, q.s, q.t, q.dir, 0))]);
        if (theirs.length) R = T.diffPolys(R, theirs.map(q => mgTab(q.axis, q.s, q.t, q.dir, MG.tab)));
        R = T.interPolys(R, T.offset(P, 0.3, false));
        if (!R.length || T.polysArea(R) < 200) continue;
        const reg = k(k(new Mf.CrossSection(R.flatMap(q => [q.outer, ...(q.holes || [])]), 'EvenOdd')).extrude(zt + 2)).translate([0, 0, -1]);
        let m = k(solid.intersect(reg));
        const rb = bboxOf(R), inside = ([x, y], r) => x > rb[0] - r && x < rb[2] + r && y > rb[1] - r && y < rb[3] + r && inPolys(x, y, R);
        const hc = [...hs.big.filter(h => inside(h, 0)).map(h => k(cB.translate([h[0], h[1], 0]))), ...hs.small.filter(h => inside(h, 0)).map(h => k(cS.translate([h[0], h[1], 0])))];
        if (hc.length) m = k(m.subtract(k(Mf.Manifold.compose(hc))));
        if (m.isEmpty()) continue;
        const g = m.getMesh(), np = g.numProp, vp = g.vertProperties, tv = g.triVerts, q = new Float64Array(tv.length * 3);
        for (let n = 0; n < tv.length; n++) { const s2 = tv[n] * np; q[n * 3] = vp[s2]; q[n * 3 + 1] = vp[s2 + 1]; q[n * 3 + 2] = vp[s2 + 2]; }
        tiles.push({ p: q, holes: hs.big.filter(h => inside(h, 0)).length + hs.small.filter(h => inside(h, 0)).length });
      }
      return { tiles, holes: hs, seams: [sx, sy], top: zt, label };
    } finally { for (const m of bin) { try { m && m.delete(); } catch (e) { /* gone */ } } }
  }
  // print pose: a board with a spacer prints face down (turned half a turn about x, never mirrored: the threads keep their hand)
  function mgPrint(p, flip) {
    let q = p;
    if (flip) { q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i]; q[i + 1] = -p[i + 1]; q[i + 2] = -p[i + 2]; } }
    return PL.normalize(q);
  }
  // Holster parts in the holster's preview frame (x across, its board side at the largest y, z up) bolted onto the
  // board at anchor: the first bolt lands on the anchor's small hole; every other bolt is a whole number of grid
  // steps away, so it lands on a small hole too. Only moves and quarter turns (never mirrored).
  function mountHolster(anchor, parts) {
    const body = parts.filter(q => q.kind === 'body' || q.kind === 'cap'), all = T.concat((body.length ? body : parts).map(q => q.p)), bx = C.bbox(all);
    const bolts = parts.filter(q => q.kind === 'bolt').map(q => C.bbox(q.p)), Do = bx.max[1];
    const b0 = bolts.length ? [(bolts[0].min[0] + bolts[0].max[0]) / 2, (bolts[0].min[2] + bolts[0].max[2]) / 2] : [(bx.min[0] + bx.max[0]) / 2, bx.min[2] + 12.5];
    const map = anchor.mode === 'wall' ? (x, y, z) => [x - b0[0] + anchor.x, y - Do + anchor.face, z - b0[1] + anchor.z]
      : (x, y, z) => [x - b0[0] + anchor.x, z - b0[1] + anchor.y, anchor.top + (Do - y)];
    return parts.map(q => { const a = q.p, r = new Float32Array(a.length); for (let i = 0; i < a.length; i += 3) { const v = map(a[i], a[i + 1], a[i + 2]); r[i] = v[0]; r[i + 1] = v[1]; r[i + 2] = v[2]; } return Object.assign({}, q, { p: r }); });
  }
  // Floor (and optional lid and wall) panels for the case, in the assembled insert frame, plus a sample holster.
  function mgridParts(cs, o, Mf, Mk) {
    const key = cs.id + 'b', lkey = cs.id + 'l', [W, D] = usable(o.bed, o.preset || o.bambu), out = [], info = { panels: [] };
    const S = Math.min(o.mgSpacer, Math.max(0, cs.base.F - o.mgThick - 10)), zb = S, zt = S + o.mgThick;
    const floorP = boardOutline(cs.base, key, o.mgTol, 0);
    const F = mgPanel(Mf, floorP, o, W, D, 'floor', S);
    F.tiles.forEach((t, i) => out.push({ name: F.tiles.length > 1 ? `Grid floor tile ${i + 1} of ${F.tiles.length}` : 'Grid floor', kind: 'mgrid', color: o.colors.mgrid, p: t.p, local: mgPrint(t.p, S > 0) }));
    info.panels.push({ name: 'floor', tiles: F.tiles.length, big: F.holes.big.length, small: F.holes.small.length, size: (() => { const b = bboxOf(floorP); return [b[2] - b[0], b[3] - b[1]]; })(), spacer: S });
    let wallInfo = null;
    if (o.mgWalls) { // front and back wall panels standing on the floor board, along the straight run of each long wall
      const h = clamp(o.mgWallH || Math.min(120, cs.base.F - zt - 6), 30, cs.base.F - zt - 2), z0 = zt + 0.2, z1 = z0 + h;
      const sec = fitted(cs.base, [[z0, z1]], o.mgTol, key)[0][2], b = bboxOf(sec);
      for (const side of [1, -1]) {
        // the run where the wall stays within 1 mm of its line
        const yw = side > 0 ? b[3] : b[1], xsOn = [];
        for (let x = b[0]; x <= b[2]; x += 2) if (inPolys(x, yw - side * 1.0, sec)) xsOn.push(x);
        if (xsOn.length < 20) continue;
        let best = [xsOn[0], xsOn[0]], run = [xsOn[0], xsOn[0]];
        for (let i = 1; i < xsOn.length; i++) { if (xsOn[i] - xsOn[i - 1] > 2.5) run = [xsOn[i], xsOn[i]]; else run[1] = xsOn[i]; if (run[1] - run[0] > best[1] - best[0]) best = run.slice(); }
        const L = best[1] - best[0] - 6; if (L < 60) continue;
        const Pw = [rect(0, 0, L, h)], Wp = mgPanel(Mf, Pw, o, W, D, side > 0 ? 'back' : 'front', 0), xa = best[0] + 3;
        // panel frame (u along the wall, v up, w through) -> case; proper rotations only
        const place = p => { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { const u = p[i], v = p[i + 1], w = p[i + 2];
          if (side > 0) { q[i] = xa + u; q[i + 1] = yw - w; q[i + 2] = z0 + v; } else { q[i] = xa + L - u; q[i + 1] = yw + w; q[i + 2] = z0 + v; } } return q; };
        Wp.tiles.forEach((t, i) => out.push({ name: `Grid ${side > 0 ? 'back' : 'front'} wall panel${Wp.tiles.length > 1 ? ` ${i + 1} of ${Wp.tiles.length}` : ''}`, kind: 'mgrid', color: o.colors.mgrid, p: place(t.p), local: mgPrint(t.p, false) }));
        info.panels.push({ name: side > 0 ? 'back wall' : 'front wall', tiles: Wp.tiles.length, big: Wp.holes.big.length, small: Wp.holes.small.length, size: [L, h] });
        if (side > 0) wallInfo = { xa, L, yw, z0, h, holes: Wp.holes, t: o.mgThick };
      }
    }
    let lidPanel = null;
    if (o.mgLid) {
      const lp = boardOutline(cs.lid, lkey, o.mgTol, 0), Lp = mgPanel(Mf, lp, o, W, D, 'lid', 0);
      lidPanel = Lp;
      Lp.tiles.forEach((t, i) => out.push({ name: Lp.tiles.length > 1 ? `Grid lid tile ${i + 1} of ${Lp.tiles.length}` : 'Grid lid panel', kind: 'mglid', color: o.colors.mgrid, p: t.p, local: mgPrint(t.p, false) }));
      info.panels.push({ name: 'lid', tiles: Lp.tiles.length, big: Lp.holes.big.length, small: Lp.holes.small.length, size: (() => { const b = bboxOf(lp); return [b[2] - b[0], b[3] - b[1]]; })() });
    }
    // a sample holster on the back wall panel (or lying on the floor board), bolted into small holes: preview only
    // where a holster bolts on: a small hole near the left of the back wall panel, else on the floor board
    const pick = (holes, cx, cy) => holes.reduce((a, h) => (Math.hypot(h[0] - cx, h[1] - cy) < Math.hypot(a[0] - cx, a[1] - cy) ? h : a), holes[0]);
    let anchor = null;
    if (wallInfo && wallInfo.holes.small.length) { const Wi = wallInfo, h = pick(Wi.holes.small, Wi.L * 0.3, Wi.h * 0.3); anchor = { mode: 'wall', x: Wi.xa + h[0], z: Wi.z0 + h[1], face: Wi.yw - Wi.t }; }
    else if (F.holes.small.length) { const fb = bboxOf(floorP), h = pick(F.holes.small, fb[0] + (fb[2] - fb[0]) * 0.3, (fb[1] + fb[3]) / 2); anchor = { mode: 'floor', x: h[0], y: h[1], top: zt }; }
    // a sample holster on it, bolted into small holes: preview only
    const sample = [];
    const H = holsterApi();
    if (o.mgSample && anchor && H && H.build) {
      try {
        const R = H.build({ detail: 'draft', bed: o.bed, mount: 'grid25', boardT: o.mgThick, device: true }, Mf);
        for (const q of mountHolster(anchor, R.parts.filter(q => q.assembled && q.assembled.length).map(q => ({ name: q.name, kind: q.kind, p: q.assembled }))))
          sample.push({ name: `Sample holster: ${q.name}`, kind: 'case', color: q.kind === 'bolt' ? '#E07A3A' : q.kind === 'device' ? '#C9D1D8' : '#2F5FA7', mat: q.kind === 'device' ? 'frame' : undefined, p: q.p, preview: true });
      } catch (e) { /* the sample is only a picture */ }
    }
    return { parts: out, sample, info, top: zt, lidPanel, anchor };
  }

  // ---- the shared hard case (case-mockup.js, same look as the handle tool) hollowed out with the measured interior.
  // Built with Manifold when it is loaded (the browser worker), cached per case; mockup() above is the fallback.
  const mockApi = () => G.GPCaseMock || (typeof require === 'function' ? (() => { try { return require('./case-mockup.js'); } catch (e) { return null; } })() : null);
  const MOCK_KEY = { 1150: 'p1150', 1200: 'p1200', 1300: 'p1300', 1400: 'p1400', 1450: 'p1450', 1500: 'p1500', 1510: 'p1510', 1520: 'p1520', 1525: 'p1525air', 1535: 'p1535air', 1550: 'p1550', 1555: 'p1555air', 1560: 'p1560', 1600: 'p1600', 1605: 'p1605air', 1607: 'p1607air', 1610: 'p1610', 1615: 'p1615air', 1620: 'p1620', 1637: 'p1637air', 1650: 'p1650' };
  const MOCK_CACHE = new Map();
  function mockSpec(cs, CM) {
    const key = cs.id + 'b', tb = bboxOf(section(cs.base, cs.base.F - 0.01, 0, key)), fb = bboxOf(section(cs.base, 0, 0, key));
    const L = Math.max(tb[2], fb[2]) - Math.min(tb[0], fb[0]), Wd = Math.max(tb[3], fb[3]) - Math.min(tb[1], fb[1]);
    const front = !cs.wheels, sp = MOCK_KEY[cs.id] ? CM.spec(MOCK_KEY[cs.id]) : { wheels: !!cs.wheels, latches: L > 600 ? 3 : 2, layout: front ? 'front' : 'end' };
    // never thinner than a real shell around the measured cavity
    const along = L + 46, across = Wd + 56, lidD = cs.lid.F + 15.5, D = lidD + cs.base.F + 21;
    if (sp.layout === 'front') { sp.H = Math.max(sp.H || 0, across); sp.W = Math.max(sp.W || 0, along); } else { sp.H = Math.max(sp.H || 0, along); sp.W = Math.max(sp.W || 0, across); }
    sp.lidD = Math.max(sp.lidD || 0, lidD); sp.D = Math.max(sp.D || 0, sp.lidD + cs.base.F + 21, D);
    sp.wheels = !!cs.wheels;
    return { sp, cx: (tb[0] + tb[2]) / 2, cy: (tb[1] + tb[3]) / 2 };
  }
  function sharedMockup(cs, o, Mf, lidAngle) {
    const CM = mockApi(); if (!CM || !Mf || !Mf.Manifold) return null;
    const ck = cs.id + ':' + (lidAngle == null ? '' : lidAngle);
    if (MOCK_CACHE.has(ck)) return MOCK_CACHE.get(ck);
    const { sp, cx, cy } = mockSpec(cs, CM), front = sp.layout === 'front', Fb = cs.base.F, Fl = cs.lid.F, Hs = sp.H;
    const y0 = -sp.D / 2, yp = y0 + sp.lidD, key = cs.id + 'b', lkey = cs.id + 'l';
    // case frame (upright, lid on -y) <-> insert frame (lying, lid up): both proper rotations
    const toCase = (X, Y, Z) => front ? [cx - X, yp + Fb - Z, cy - Y - Hs / 2] : [cy - Y, yp + Fb - Z, X - cx - Hs / 2];
    const toMine = (x, y, z) => front ? [cx - x, cy - z - Hs / 2, yp + Fb - y] : [z + Hs / 2 + cx, cy - x, yp + Fb - y];
    const bin = [], k = m => { bin.push(m); return m; };
    // a stack of layers in the insert frame (each prism a little taller so they fuse), then turned into the case frame
    const solid = layers => {
      const ps = [];
      for (const l of layers) {
        if (!l.polys.length) continue;
        const cs2 = k(new Mf.CrossSection(l.polys.flatMap(q => [q.outer, ...(q.holes || [])]), 'EvenOdd'));
        ps.push(k(k(cs2.extrude(l.z1 - l.z0 + 0.02)).translate([0, 0, l.z0 - 0.01])));
      }
      const u = k(Mf.Manifold.union(ps));
      return k(u.warp(v => { const r = toCase(v[0], v[1], v[2]); v[0] = r[0]; v[1] = r[1]; v[2] = r[2]; }));
    };
    try {
      const BL = [], LL = [];
      // the cavity is the same clean profile the inserts follow (no clearance): straight walls, rounded corners, a
      // smooth floor fillet, so the preview reads like the real molded case and the inserts line up with it
      const pb = profile(cs.base, key, 0), pl = profile(cs.lid, lkey, 0);
      for (const [z0, z1] of pb.breaks(0, Fb, 'hd')) BL.push({ z0, z1, polys: pb.at(z0) });
      BL.push({ z0: Fb, z1: Fb + 40, polys: pb.at(Fb - 0.01) });
      for (const [z0, z1] of pl.breaks(0, Fl, 'hd')) LL.push({ z0, z1, polys: pl.at(z0) });
      LL.push({ z0: Fl, z1: Fl + 40, polys: pl.at(Fl - 0.01) });
      const cutBase = solid(BL);
      // lid data: z up from the lid floor to its rim; closed it sits upside down over the base (Z = Fb + Fl - z)
      const cutLid = solid(LL.map(l => ({ z0: Fb + Fl - l.z1, z1: Fb + Fl - l.z0, polys: l.polys })));
      const keep = solid([{ z0: -3, z1: 0, polys: T.offset(section(cs.base, 0, 0, key), 3, false) }].concat(BL.map(l => ({ z0: l.z0, z1: l.z1, polys: T.offset(l.polys, 3, false) }))));
      const opt = { y0, handle: true, cutBase, cutLid, keep };
      if (sp.wheels && !front) opt.trolley = [-Math.min(130, sp.W / 2 - 40), Math.min(130, sp.W / 2 - 40)];
      if (front) opt.keepX = [-90, 90];
      const raw = CM.build(Mf, sp, opt);
      // hinge line in the insert frame; the lid parts swing open about it
      const hY = front ? cy + Hs / 2 - 3.2 + 4 : cy + (sp.W - 6.4) / 2 + 6, hZ = Fb, ang = lidAngle == null ? -1.88 : lidAngle;
      const toMineP = p => { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { const r = toMine(p[i], p[i + 1], p[i + 2]); q[i] = r[0]; q[i + 1] = r[1]; q[i + 2] = r[2]; } return q; };
      const out = [];
      for (const q of raw) {
        const p = toMineP(q.p), lidSide = q.name === 'Case lid' ? true : q.name === 'Case base' ? false : null;
        const groups = lidSide == null ? splitByZ(p, Fb + 1) : lidSide ? [null, p] : [p, null];
        if (groups[0] && groups[0].length) out.push({ name: q.name, kind: 'case', mat: q.mat, color: q.color, p: groups[0] });
        if (groups[1] && groups[1].length) out.push({ name: lidSide ? q.name : q.name + ' (lid)', kind: 'case', mat: q.mat, color: q.color, p: rotX(groups[1], ang, hY, hZ) });
      }
      const toClosed = m => { const q = mirrorZ(m, 0); for (let i = 2; i < q.length; i += 3) q[i] += Fb + Fl; return q; };
      const open = m => rotX(m, ang, hY, hZ);
      const res = { parts: out.map(q => Object.assign(q, { preview: true })), open, openLid: m => open(toClosed(m)), toClosed, hinge: [hY, hZ], ang, lidDepth: Fl, shared: true };
      if (MOCK_CACHE.size > 6) MOCK_CACHE.clear();
      MOCK_CACHE.set(ck, res);
      return res;
    } finally { for (const m of bin) { try { m.delete(); } catch (e) { /* gone */ } } }
  }
  // connected pieces of a triangle soup, sorted by which side of the parting plane (z = zp) they sit on: [base, lid]
  function splitByZ(p, zp) {
    const n = p.length / 9, id = new Map(), par = [], vk = i => `${Math.round(p[i] * 100)},${Math.round(p[i + 1] * 100)},${Math.round(p[i + 2] * 100)}`;
    const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (let t = 0; t < n; t++) {
      par[t] = t;
      for (let v = 0; v < 3; v++) { const key = vk(t * 9 + v * 3); if (id.has(key)) { const a = find(id.get(key)), b = find(t); if (a !== b) par[a] = b; } else id.set(key, t); }
    }
    const sum = new Map();
    for (let t = 0; t < n; t++) { const r = find(t); const s = sum.get(r) || [0, 0]; s[0] += p[t * 9 + 2] + p[t * 9 + 5] + p[t * 9 + 8]; s[1] += 3; sum.set(r, s); }
    const base = [], lid = [];
    for (let t = 0; t < n; t++) { const s = sum.get(find(t)), dst = s[0] / s[1] > zp ? lid : base; for (let j = 0; j < 9; j++) dst.push(p[t * 9 + j]); }
    return [Float64Array.from(base), Float64Array.from(lid)];
  }
  function build(raw, Mf) {
    MF = Mf && Mf.Manifold ? Mf : null;
    const o = options(raw), cs = byId(o.caseId);
    if (!cs && o.type !== 'storage') throw Error(cases().length ? 'Pick a case model.' : 'The case measurements are still loading.');
    if (!cs && o.type === 'storage') {
      const ST = storageApi(); if (!ST) throw Error('The screw-on storage module did not load. Reload the page and try again.');
      const so = Object.assign({}, o.storage || {}, { detail: o.detail, bed: o.bed, bambu: o.bambu, preset: o.preset || o.bambu, colors: { body: o.colors.body || o.colors.insert, cap: o.colors.cap || o.colors.lid }, boardT: o.mgThick || 6.4 });
      const stor = ST.build(so);
      stor.parts.forEach(q => { if (!q.local) q.local = q.p; q.p = q.p || q.local; });
      const [W, D] = usable(o.bed, o.preset || o.bambu);
      const ar = PL.arrange(stor.parts.map(q => ({ name: q.name, p: q.local, color: q.color })), W, D, { gap: 5 });
      const cols = []; stor.parts.forEach(q => { const c = (q.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
      const stats = { caseId: o.caseId || '', caseName: 'Custom case', wheels: false, type: 'storage', height: stor.stats.height || 0, baseDepth: 0, lidDepth: 0, lidHeight: 0, topSize: [0, 0], floorSize: [0, 0], pieces: stor.parts.length, plates: ar.plates.length, tris: stor.stats.tris, colors: cols.length, grid: null, notch: 0, tol: 0, bed: o.bed, split: null, mgrid: null, storage: stor.stats };
      return { options: o, case: null, parts: stor.parts, mockup: [], plates: ar.plates, filaments: cols.map(c => ({ color: c })), warnings: stor.warnings || [], stats };
    }
    const warnings = [], parts = [], key = cs.id + 'b', lkey = cs.id + 'l';
    const H = heightFor(cs, o);
    const spec = { height: H, cols: o.cols, rows: o.rows, merges: o.merges, notches: o.notches, notchDepth: o.notchDepth, lift: o.liftNotches };
    const add = (P, kind, color, label) => P.pieces.forEach(pc => parts.push({ name: P.pieces.length > 1 ? `${label} piece ${pc.index + 1} of ${P.pieces.length}` : label, kind, color, local: pc.local, dx: P.dx, dy: P.dy, w: P.w, d: P.d, split: P.split, pieceIndex: pc.index }));
    let gridInfo = null, trayInfo = null;
    if (o.type === 'tray') {
      const P = layeredPart('Divider tray', () => trayLayers(cs.base, key, o, spec), o);
      trayInfo = trayLayers(cs.base, key, o, spec);
      add(P, 'tray', o.colors.insert, `${cs.name} divider tray`);
    } else if (o.type === 'bins') {
      const { cells } = cellRects(o.cols, o.rows, o.merges);
      cells.forEach((cell, i) => {
        const P = layeredPart(`Bin ${i + 1}`, () => { const L = binLayers(cs.base, key, o, spec, cell); return { layers: L.layers }; }, o);
        add(P, 'bin', o.colors.insert, `${cs.name} bin ${i + 1}`);
      });
    } else if (o.type === 'grid') {
      gridInfo = gridLayers(cs.base, key, o);
      if (!gridInfo.sockets) warnings.push('No whole 42 mm cells fit this case floor.');
      const P = layeredPart('42 mm grid floor', () => gridLayers(cs.base, key, o), Object.assign({}, o, { floor: GRID.floor }), { snapX: gridInfo.snapX, snapY: gridInfo.snapY, edge: 24 });
      add(P, 'grid', o.colors.grid, `${cs.name} 42 mm grid floor`);
    }
    let mg = null, stor = null;
    if (o.type === 'mgrid') {
      if (!Mf) throw Error('The multipoint grid needs the 3D engine. Reload the page and try again.');
      mg = mgridParts(cs, o, Mf);
      for (const q of mg.parts) parts.push({ name: `${cs.name} ${q.name.charAt(0).toLowerCase()}${q.name.slice(1)}`, kind: q.kind, color: q.color, local: q.local, fixed: q.p, dx: 0, dy: 0 });
    }
    if (o.type === 'storage') {
      const ST = storageApi(); if (!ST) throw Error('The screw-on storage module did not load. Reload the page and try again.');
      const so = Object.assign({}, o.storage || {}, { detail: o.detail, bed: o.bed, bambu: o.bambu, preset: o.preset || o.bambu, colors: { body: o.colors.body || o.colors.insert, cap: o.colors.cap || o.colors.lid }, boardT: o.mgThick || 6.4 });
      stor = ST.build(so);
      // sit the packed set on the case floor, centered; lids/bolts already in preview pose
      const top = section(cs.base, 0, o.tol, key), tb = bboxOf(top);
      const cx = (tb[0] + tb[2]) / 2, cy = (tb[1] + tb[3]) / 2;
      const ox = cx - (stor.width || 0) / 2, oy = cy - (stor.depth || 0) / 2;
      const z0 = so.mount === 'grid25' || so.mount === 'grid25big' ? (o.mgThick || 6.4) : 0;
      stor.parts.forEach(q => {
        const local = q.local, src = q.p || q.local, p = new Float64Array(src.length);
        for (let i = 0; i < src.length; i += 3) { p[i] = src[i] + ox; p[i + 1] = src[i + 1] + oy; p[i + 2] = src[i + 2] + z0; }
        parts.push({ name: q.name, kind: q.kind || 'storage', color: q.color, local, fixed: p, dx: 0, dy: 0 });
      });
      if (stor.warnings) warnings.push(...stor.warnings);
      const maxH = heightFor(cs, o);
      if (stor.stats && stor.stats.height && stor.stats.height + z0 > maxH) warnings.push(`This set is ${Math.round(stor.stats.height + z0)} mm tall; the case base is ${maxH} mm deep. Pick a shorter size or leave it for a bigger case.`);
    }
    let lidH = 0;
    if (o.lid && o.type !== 'storage' && !(mg && o.mgLid)) {
      lidH = clamp(num(o.lidHeight, 22), 8, Math.floor(cs.lid.F - 2));
      const ls = { height: lidH, cols: o.lidCols, rows: o.lidRows, merges: o.lidMerges, notches: o.notches, lift: false };
      const P = layeredPart('Lid organizer', () => trayLayers(cs.lid, lkey, o, ls), o);
      add(P, 'lid', o.colors.lid, `${cs.name} lid organizer`);
    }
    // assembled positions: inserts sit on the case floor (x, y centered like the cavity data); lid panel in the open lid
    let M = null;
    if (Mf) { try { M = sharedMockup(cs, o, Mf); } catch (e) { M = null; } }
    if (!M) M = mockup(cs, o);
    for (const pt of parts) {
      let p = pt.fixed || PL.move(pt.local, -pt.dx, -pt.dy, 0);
      if (pt.kind === 'lid' || pt.kind === 'mglid') p = M.openLid(p);
      delete pt.fixed;
      pt.p = p;
    }
    const closed = parts.filter(q => q.local && q.local.length).map(q => C.checkClosed(q.local).closed);
    if (closed.some(c => !c)) warnings.push('A part did not close cleanly; try a slightly larger clearance.');
    const [W, D] = usable(o.bed, o.preset || o.bambu);
    const ar = PL.arrange(parts.map(q => ({ name: q.name, p: q.local, color: q.color })), W, D, { gap: 5 });
    const tris = parts.reduce((s, q) => s + q.local.length / 9, 0);
    const cols = []; parts.forEach(q => { const c = (q.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const top = section(cs.base, H, o.tol, key), tb = bboxOf(top), fl = bboxOf(section(cs.base, 0, o.tol, key));
    const stats = {
      caseId: cs.id, caseName: cs.name, wheels: cs.wheels, type: o.type, height: H, baseDepth: cs.base.F, lidDepth: cs.lid.F, lidHeight: lidH,
      topSize: [tb[2] - tb[0], tb[3] - tb[1]], floorSize: [fl[2] - fl[0], fl[3] - fl[1]], pieces: parts.length, plates: ar.plates.length, tris: Math.round(tris), colors: cols.length,
      grid: gridInfo ? { nx: gridInfo.nx, ny: gridInfo.ny, sockets: gridInfo.sockets } : null, notch: trayInfo ? trayInfo.notch : 0, tol: o.type === 'mgrid' ? o.mgTol : o.tol, bed: o.bed,
      split: parts.find(q => q.split) ? parts.find(q => q.split).split : null,
      mgrid: mg ? Object.assign({ thick: o.mgThick, anchor: mg.anchor }, mg.info) : null,
      storage: stor ? stor.stats : null
    };
    if (ar.unfit.length) warnings.push(`${ar.unfit.length} piece${ar.unfit.length === 1 ? ' is' : 's are'} too big for this printer.`);
    return { options: o, case: cs, parts, mockup: mg ? M.parts.concat(mg.sample) : M.parts, plates: ar.plates, filaments: cols.map(c => ({ color: c })), warnings, stats };
  }
  function gateInfo(res) {
    const why = [];
    if (res.stats.pieces > FREE.maxPieces) why.push(`${res.stats.pieces} printed pieces (free: up to ${FREE.maxPieces})`);
    if (res.options.lid && res.options.type !== 'none') why.push('base insert and lid organizer together (Pro)');
    return why;
  }
  function export3MF(res, o) {
    o = o || {};
    const [W, D] = usable(res.options.bed, res.options.preset || res.options.bambu);
    const bed = res.options.bed, off = [(bed[0] - W) / 2, (bed[1] - D) / 2];
    return PL.plates3MF(res.plates, { title: o.name || (res.stats.type === 'storage' ? 'Expressarte case storage' : 'Expressarte case insert'), bambu: o.bambu === undefined ? res.options.bambu : o.bambu, bed, offset: off, filaments: res.filaments });
  }
  function files(res, o) {
    o = o || {};
    const base = o.fileBase || 'case_insert', out = [], seen = new Set();
    res.parts.forEach(pt => {
      let n = `${base}_${pt.name.replace(res.stats.caseName, '').replace(/[^\w]+/g, '_').toLowerCase()}`.replace(/_+/g, '_').replace(/_+$/, ''); while (seen.has(n)) n += '_b'; seen.add(n);
      out.push({ name: `${n}.stl`, data: new Uint8Array(C.writeSTL(pt.local, pt.name)) });
    });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    const s = res.stats, f = v => (Math.round(v * 10) / 10).toString();
    const L = ['Expressarte hard case insert', `Case: ${s.caseName} \u00b7 base depth ${f(s.baseDepth)} mm \u00b7 lid depth ${f(s.lidDepth)} mm`,
      s.type === 'storage' && s.storage ? `Storage: ${s.storage.typeLabel} \u00b7 mount: ${s.storage.mountLabel} \u00b7 ${s.pieces} pieces` : `Insert: ${TYPES[s.type]}${s.type !== 'none' && s.type !== 'storage' ? ` \u00b7 ${f(s.height)} mm tall \u00b7 top ${f(s.topSize[0])} \u00d7 ${f(s.topSize[1])} mm \u00b7 floor ${f(s.floorSize[0])} \u00d7 ${f(s.floorSize[1])} mm` : ''}`,
      `Fit clearance: ${f(s.tol)} mm per side, measured from the case maker's CAD interior (draft, corner and floor radii, wheel wells and handle housings included).`,
      `Pieces: ${s.pieces} on ${s.plates} build plate${s.plates === 1 ? '' : 's'}`, '', 'Filaments'];
    res.filaments.forEach((x, i) => L.push(`  ${i + 1}: ${x.color}`));
    L.push('', 'Printing', '  - Print every piece flat, floor down. PETG or ASA handles a hot car better than PLA.',
      '  - Split pieces push together from above with dovetails; a drop of glue in each joint makes it one rigid tray.',
      '  - Print one corner piece first and test the fit; raise the clearance if your printer runs large.', ...(res.warnings || []).map(w => '  - ' + w));
    out.push({ name: `${base}_NOTES.txt`, data: L.join('\n') });
    return out;
  }
  const api = { setData, cases, byId, PALETTE, TYPES, FREE, DEFAULTS, GRID, options, section, layerCuts, profile, cleanCuts, cellRects, dividerSegments, trayLayers, binLayers, gridLayers, mockup, sharedMockup, mountHolster, build, gateInfo, export3MF, files, heightFor };
  api._fill = fillSmallHoles;
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPCaseInsert = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
