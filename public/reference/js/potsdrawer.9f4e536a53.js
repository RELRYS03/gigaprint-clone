/* Expressarte pots and pans drawer organizer: a pegboard for a deep kitchen drawer,
   tiled into plate-sized dovetail tiles, with removable pegs, an upright pan rack
   (vertical slots for frying pans, sheet pans and cutting boards), an upright lid
   rack sized by lid diameter, and optional low cradles for stacked pots.
   Modeled on how popular deep-drawer peg systems are built: a hole grid on a
   2.5 in pitch, 1.25 in pegs about 6 in tall, and racks that lock into the same
   holes. American spelling. No brand names. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);

  const IN = 25.4;
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    drawerW: 762, drawerD: 533, drawerH: 254, // inside of a typical 30 in base-cabinet pots drawer
    fitGap: 3,            // board is this much smaller than the drawer, each direction (total)
    pitch: 63.5,          // 2.5 in hole grid
    boardT: 10, ribbed: true,
    pegD: 32, pegH: 0,    // 0 = auto (about 6 in, lower in short drawers)
    clearance: 0.3,       // radial, peg to hole
    jointClear: 0.2,      // dovetail socket clearance
    panRack: true, panSlots: 5, panSpacing: 55, panFinH: 0, panDepth: 300,
    lidRack: true, lids: 6, lidD: 230, lidSpacing: 40, lidFinH: 0,
    potSpots: 2, potD: 240, extraPegs: 0,
    cradles: false,
    colors: { board: PZ.cream, accent: PZ.sage },
    bed: [256, 256, 256], bambu: 'A1', detail: 'hd'
  };
  const PITCHES = [50.8, 63.5, 76.2];
  const PALETTE = {
    board: [
      { name: 'Oat', hex: '#EDE6D6' }, { name: 'White', hex: '#F5F5F2' }, { name: 'Light gray', hex: '#C9CCCF' },
      { name: 'Charcoal', hex: '#3A3D42' }, { name: 'Maple', hex: '#D8B27A' }, { name: 'Black', hex: '#1A1A1A' }
    ],
    accent: [
      { name: 'Sage', hex: '#2F6F5A' }, { name: 'Walnut', hex: '#6B4A2E' }, { name: 'Black', hex: '#1A1A1A' },
      { name: 'White', hex: '#F5F5F2' }, { name: 'Terracotta', hex: '#C0603A' }, { name: 'Navy', hex: '#1F3A5F' }
    ]
  };
  const FREE_MAX_PEGS = 12;
  const RAIL_W = 44, RAIL_T = 6, FIN_T = 6, LID_FIN_T = 5, CS_DEPTH = 4, TAB = { a: 7, b: 11, d: 10 };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, d) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : d);

  function options(raw) {
    const r = Object.assign({}, DEFAULTS, raw || {});
    const o = {
      drawerW: clamp(num(r.drawerW, 762), 200, 1500), drawerD: clamp(num(r.drawerD, 533), 200, 900), drawerH: clamp(num(r.drawerH, 254), 60, 600),
      fitGap: clamp(num(r.fitGap, 3), 0, 20),
      pitch: clamp(num(r.pitch, 63.5), 45, 110),
      boardT: clamp(num(r.boardT, 10), 8, 20), ribbed: r.ribbed !== false,
      pegD: clamp(num(r.pegD, 32), 20, 45), pegH: clamp(num(r.pegH, 0), 0, 400),
      clearance: clamp(num(r.clearance, 0.3), 0.1, 1), jointClear: clamp(num(r.jointClear, 0.2), 0.05, 0.8),
      panRack: !!r.panRack, panSlots: Math.round(clamp(num(r.panSlots, 5), 1, 30)), panSpacing: clamp(num(r.panSpacing, 55), 20, 160),
      panFinH: clamp(num(r.panFinH, 0), 0, 400), panDepth: clamp(num(r.panDepth, 300), 120, 800),
      lidRack: !!r.lidRack, lids: Math.round(clamp(num(r.lids, 6), 1, 30)), lidD: clamp(num(r.lidD, 230), 100, 450),
      lidSpacing: clamp(num(r.lidSpacing, 40), 15, 120), lidFinH: clamp(num(r.lidFinH, 0), 0, 300),
      potSpots: Math.round(clamp(num(r.potSpots, 2), 0, 8)), potD: clamp(num(r.potD, 240), 80, 450),
      extraPegs: Math.round(clamp(num(r.extraPegs, 0), 0, 60)),
      cradles: !!r.cradles,
      colors: Object.assign({}, DEFAULTS.colors, r.colors || {}),
      bed: Array.isArray(r.bed) ? r.bed.slice(0, 3) : DEFAULTS.bed.slice(),
      bambu: r.bambu === undefined ? DEFAULTS.bambu : r.bambu,
      detail: r.detail === 'draft' ? 'draft' : 'hd'
    };
    if (raw && raw.panRack === undefined) o.panRack = DEFAULTS.panRack;
    if (raw && raw.lidRack === undefined) o.lidRack = DEFAULTS.lidRack;
    if (!raw) { o.panRack = DEFAULTS.panRack; o.lidRack = DEFAULTS.lidRack; }
    return o;
  }
  function usableBed(bed) {
    const [bx, by, bz] = bed || [256, 256, 256];
    return { w: Math.max(60, bx - 8), d: Math.max(60, by - 8), z: Math.max(40, (bz || Math.min(bx, by)) - 4) };
  }
  const fitsBed = (w, d, B) => (w <= B.w + 1e-6 && d <= B.d + 1e-6) || (w <= B.d + 1e-6 && d <= B.w + 1e-6);

  // ---------------------------------------------------------------- the plan (numbers only; no meshes)
  function geom(o) {
    const pr = o.pegD / 2, c = o.clearance;
    const sr = Math.max(5, pr - CS_DEPTH);           // straight spigot under the 45\u00b0 seat
    const holeR = sr + c, csR = pr + c;               // through hole and countersink rim
    const seat = o.boardT - 1;                        // the peg sits 1 mm above the drawer bottom
    return { pr, sr, holeR, csR, seat, padE: csR + 6, pinGap: 2 * (csR + 3) };
  }
  // Place a rack of `slots` slots along one grid axis (`grid` = hole lines along the rack), starting at or after uMin.
  // Its two lock pins drop through the rails into board holes: on a grid line between two fins when the slots
  // are wide enough, otherwise in a short pad past the last fin. Returns the shortest placement.
  function placeRack(g, pitch, grid, slots, sp, finT, uMin, uMax) {
    const F = slots * sp + finT, need = g.csR + finT / 2 + 1, cands = [uMin + 4];
    for (const h of grid) for (let k = 0; k < slots; k++) cands.push(h - k * sp - (sp + finT) / 2);
    let best = null;
    for (const f0 of cands) {
      if (f0 < uMin + 4 - 1e-6) continue;
      const lines = grid.filter(h => h > f0 && h < f0 + F && Array.from({ length: slots + 1 }, (_, k) => f0 + k * sp + finT / 2).every(fc => Math.abs(h - fc) >= need - 1e-6));
      let u0 = f0 - 4, u1 = f0 + F + 4, pins;
      if (lines.length) pins = [lines[0], lines[lines.length - 1]];
      else {
        const h = grid.find(h => h - (f0 + F) >= g.csR + 1 - 1e-6);
        if (h === undefined) continue;
        u1 = h + g.padE; pins = [h, h];
      }
      if (u1 > uMax + 1e-6) continue;
      if (!best || u1 < best.u1 - 1e-6 || (Math.abs(u1 - best.u1) < 1e-6 && pins[1] - pins[0] > best.pins[1] - best.pins[0])) best = { u0, u1, f0, F, pins };
    }
    return best;
  }
  function maxSlots(ok, n) { for (let s = n; s >= 1; s--) if (ok(s)) return s; return 1; }
  function plan(raw) {
    const o = raw && raw._planned ? raw : options(raw);
    const g = geom(o), B = usableBed(o.bed), warnings = [];
    const bw = o.drawerW - o.fitGap, bd = o.drawerD - o.fitGap, edge = g.csR + 4;
    const nx = Math.max(2, Math.floor((bw - 2 * edge) / o.pitch) + 1), ny = Math.max(2, Math.floor((bd - 2 * edge) / o.pitch) + 1);
    const hx = Array.from({ length: nx }, (_, i) => -(nx - 1) * o.pitch / 2 + i * o.pitch);
    const hy = Array.from({ length: ny }, (_, j) => -(ny - 1) * o.pitch / 2 + j * o.pitch);
    const clearH = o.drawerH - o.boardT; // room above the board
    const pegH = o.pegH > 0 ? o.pegH : clamp(Math.min(152, clearH - 30), 40, 200);
    if (o.boardT + pegH > o.drawerH - 5) warnings.push(`The pegs stand ${Math.round(o.boardT + pegH)} mm tall, more than the ${Math.round(o.drawerH)} mm drawer. Lower the peg height so the drawer closes.`);
    const occupied = new Set(); // hole keys "i,j" under racks
    const key = (i, j) => i + ',' + j;
    const racks = [], pegs = [], pots = [];
    const occupy = (x0, y0, x1, y1) => { for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (hx[i] > x0 - g.pr && hx[i] < x1 + g.pr && hy[j] > y0 - g.pr && hy[j] < y1 + g.pr) occupied.add(key(i, j)); };
    let xCur = -bw / 2 + 3;
    // ---- pan rack: fins front to back, slots side by side
    if (o.panRack) {
      const sp = Math.max(o.panSpacing, FIN_T + 8);
      const finH = o.panFinH > 0 ? o.panFinH : clamp(0.5 * clearH, 60, 140);
      let m = Math.max(1, Math.min(ny - 1, Math.round((o.panDepth - RAIL_W) / o.pitch)));
      while (m > 1 && !fitsBed(FIN_T + 2 * sp, m * o.pitch + RAIL_W, B)) m--;
      const rd = m * o.pitch + RAIL_W, j0 = ny - 1 - m, v0 = hy[j0] - RAIL_W / 2; // at the back; handles point to the front
      let left = o.panSlots, placed = 0, nseg = 0, total = 0;
      while (left > 0) {
        let s = left, Q = null;
        if (!total) { const smax = maxSlots(s0 => { const q = placeRack(g, o.pitch, hx, s0, sp, FIN_T, -bw / 2 + 3, Infinity); return q && fitsBed(q.u1 - q.u0, rd, B); }, left); total = Math.ceil(left / Math.max(1, smax)); }
        s = Math.min(left, Math.ceil(left / Math.max(1, total - nseg)));
        for (; s >= 1; s--) { Q = placeRack(g, o.pitch, hx, s, sp, FIN_T, xCur, bw / 2 - 2); if (Q && fitsBed(Q.u1 - Q.u0, rd, B)) break; Q = null; }
        if (!Q) { warnings.push(placed ? `Only ${placed} pan slots fit across this drawer.` : 'The pan rack does not fit this drawer or plate. Choose a bigger printer or fewer, closer slots.'); break; }
        racks.push({ type: 'pan', slots: s, spacing: sp, finH, finT: FIN_T, fins: s + 1, axis: 'x', u0: Q.u0, u1: Q.u1, f0: Q.f0, F: Q.F, v0, v1: v0 + rd,
          center: [(Q.u0 + Q.u1) / 2, v0 + rd / 2], pins: [[Q.pins[0], hy[j0]], [Q.pins[1], hy[ny - 1]]] });
        occupy(Q.u0, v0, Q.u1, v0 + rd);
        xCur = Q.u1 + 3; left -= s; placed += s; nseg++;
      }
      if (nseg > 1) warnings.push(`The pan rack is split into ${nseg} racks so each fits your plate.`);
      if (rd < o.panDepth - o.pitch / 2) warnings.push(`The pan rack is ${Math.round(rd)} mm deep so it fits your plate and drawer.`);
    }
    // ---- lid rack: fins side to side, lids stand on edge one behind the other
    if (o.lidRack) {
      const sp = Math.max(o.lidSpacing, LID_FIN_T + 8);
      const finH = o.lidFinH > 0 ? o.lidFinH : clamp(Math.min(0.32 * o.lidD, clearH - 30), 40, 120);
      let m = Math.max(1, Math.round((0.55 * o.lidD - RAIL_W) / o.pitch));
      while (m > 1 && !fitsBed(m * o.pitch + RAIL_W, LID_FIN_T + 2 * sp, B)) m--;
      const rw = m * o.pitch + RAIL_W;
      let left = o.lids, placed = 0, nseg = 0, yCur = -bd / 2 + 3, c = null, total = 0;
      const colAt = x => { for (let i = 0; i + m < nx; i++) if (hx[i] - RAIL_W / 2 >= x) return i; return null; };
      c = colAt(xCur);
      while (left > 0 && c !== null) {
        let s = left, Q = null;
        if (!total) { const smax = maxSlots(s0 => { const q = placeRack(g, o.pitch, hy, s0, sp, LID_FIN_T, -bd / 2 + 3, bd / 2 - 2); return q && fitsBed(rw, q.u1 - q.u0, B); }, left); total = Math.ceil(left / Math.max(1, smax)); }
        s = Math.min(left, Math.ceil(left / Math.max(1, total - nseg)));
        for (; s >= 1; s--) { Q = placeRack(g, o.pitch, hy, s, sp, LID_FIN_T, yCur, bd / 2 - 2); if (Q && fitsBed(rw, Q.u1 - Q.u0, B)) break; Q = null; }
        if (!Q) {
          if (yCur > -bd / 2 + 3) { c = colAt(hx[c + m] + RAIL_W / 2 + 3); yCur = -bd / 2 + 3; continue; }
          break;
        }
        const v0 = hx[c] - RAIL_W / 2;
        racks.push({ type: 'lid', slots: s, spacing: sp, finH, finT: LID_FIN_T, fins: s + 1, axis: 'y', u0: Q.u0, u1: Q.u1, f0: Q.f0, F: Q.F, v0, v1: v0 + rw,
          center: [v0 + rw / 2, (Q.u0 + Q.u1) / 2], pins: [[hx[c], Q.pins[0]], [hx[c + m], Q.pins[1]]] });
        occupy(v0, Q.u0, v0 + rw, Q.u1);
        xCur = Math.max(xCur, v0 + rw + 3); yCur = Q.u1 + 3; left -= s; placed += s; nseg++;
      }
      if (left > 0) warnings.push(placed ? `Only ${placed} of ${o.lids} lids fit in the lid rack in this drawer.` : 'The lid rack does not fit this drawer or plate. Choose a bigger printer, fewer lids or closer spacing.');
      if (nseg > 1) warnings.push(`The lid rack is split into ${nseg} racks so each fits your plate.`);
      const up = clearH - RAIL_T - 6;
      if (o.lidD > up) warnings.push(`Lids wider than ${Math.round(up)} mm will not stand upright in a ${Math.round(o.drawerH)} mm tall drawer; they lean in the rack instead.`);
    }
    // ---- pot spots: pegs ring each pot in the open area
    const R = o.potD / 2, pegRing = R + g.pr + 1.5;
    const cand = [];
    const wallX = o.drawerW / 2, wallY = o.drawerD / 2;
    for (let i = -2; i < 4 * nx + 2; i++) for (let j = -2; j < 4 * ny + 2; j++) cand.push([hx[0] + i * o.pitch / 4, hy[0] + j * o.pitch / 4]);
    cand.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const pegSet = new Map();
    for (const c of cand) {
      if (pots.length >= o.potSpots) break;
      if (racks.some(rk => { const [x0, x1, y0, y1] = rk.axis === 'x' ? [rk.u0, rk.u1, -wallY, rk.v1] : [rk.v0, rk.v1, rk.u0, rk.u1]; /* pan handles reach to the front */ return Math.hypot(Math.max(x0 - c[0], 0, c[0] - x1), Math.max(y0 - c[1], 0, c[1] - y1)) < R + 3; })) continue;
      if (c[0] - R < -wallX + 1 || c[0] + R > wallX - 1 || c[1] - R < -wallY + 1 || c[1] + R > wallY - 1) continue;
      if (pots.some(p => Math.hypot(p.x - c[0], p.y - c[1]) < R + p.R + 8)) continue;
      // candidate holes for this pot's pegs
      const ring = [];
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        if (occupied.has(key(i, j))) continue;
        const d = Math.hypot(hx[i] - c[0], hy[j] - c[1]);
        if (d < pegRing || d > pegRing + o.pitch * 0.85) continue;
        if (pots.some(p => Math.hypot(hx[i] - p.x, hy[j] - p.y) < p.R + g.pr + 1.5)) continue;
        ring.push({ i, j, d, a: Math.atan2(hy[j] - c[1], hx[i] - c[0]) });
      }
      if (ring.length < 3) continue;
      const pick = [];
      for (let t = 0; t < 6; t++) {
        const a0 = -Math.PI + (t + 0.5) * Math.PI / 3;
        let best = null, bs = Infinity;
        for (const h of ring) {
          if (pick.includes(h)) continue;
          let da = Math.abs(h.a - a0); da = Math.min(da, 2 * Math.PI - da);
          const sc = da * 60 + (h.d - pegRing);
          if (sc < bs) { bs = sc; best = h; }
        }
        if (best && bs < 70) pick.push(best);
      }
      if (pick.length < 3) continue;
      pots.push({ x: c[0], y: c[1], R });
      for (const h of pick) pegSet.set(key(h.i, h.j), [h.i, h.j]);
    }
    if (o.potSpots > pots.length) warnings.push(pots.length ? `Only ${pots.length} pot spot${pots.length > 1 ? 's' : ''} fit next to the racks.` : 'No pot spot fits next to the racks. Make the drawer wider, the pots smaller or the racks narrower.');
    for (const [k, h] of [...pegSet]) if (pots.some(p => Math.hypot(hx[h[0]] - p.x, hy[h[1]] - p.y) < p.R + g.pr + 1.5)) pegSet.delete(k); // a later pot covers it
    for (const [, h] of pegSet) pegs.push({ x: hx[h[0]], y: hy[h[1]], i: h[0], j: h[1] });
    // extra pegs go in the free holes along the back
    if (o.extraPegs) {
      const free = [];
      for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
        const k = key(i, j); if (occupied.has(k) || pegSet.has(k)) continue;
        if (pots.some(p => Math.hypot(hx[i] - p.x, hy[j] - p.y) < p.R + g.pr + 1.5)) continue;
        free.push([i, j]);
      }
      for (let n = 0; n < o.extraPegs && n < free.length; n++) { const [i, j] = free[n]; pegSet.set(key(i, j), [i, j]); pegs.push({ x: hx[i], y: hy[j], i, j, extra: true }); }
    }
    if (B.z < o.boardT + pegH - o.boardT + g.seat + 2) warnings.push(`The pegs are ${Math.round(pegH + g.seat)} mm tall, taller than this printer's ${Math.round(B.z + 4)} mm build height.`);
    return { o, g, B, bw, bd, nx, ny, hx, hy, pegH, racks, pegs, pots, warnings, clearH };
  }

  // ---------------------------------------------------------------- mesh helpers
  function tri(out, A, B, C) { out.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]); }
  function lathe(profile, seg, cx, cy, z0) {
    const out = [], n = seg;
    const pt = (r, z, k) => { const t = 2 * Math.PI * (k % n) / n; return [cx + r * Math.cos(t), cy + r * Math.sin(t), z0 + z]; };
    for (let s = 0; s + 1 < profile.length; s++) {
      const [r0, za] = profile[s], [r1, zb] = profile[s + 1];
      for (let k = 0; k < n; k++) {
        const A = pt(r0, za, k), B = pt(r0, za, k + 1), C = pt(r1, zb, k + 1), D = pt(r1, zb, k);
        if (r0 > 1e-9) tri(out, A, B, C);
        if (r1 > 1e-9) tri(out, A, C, D);
      }
    }
    // the profile starts and ends on the axis, so the caps are the fans above
    let p = Float64Array.from(out);
    if (Core.signedVolume(p) < 0) p = Core.flip(p);
    return p;
  }
  function move(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + dz; } return q; }
  function toOrigin(p) { const b = Core.bbox(p); return move(p, -b.min[0], -b.min[1], -b.min[2]); }
  const rectP = (x0, y0, x1, y1) => ({ outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], holes: [] });
  const ring = (cx, cy, r, n) => ({ outer: T.circle(cx, cy, r, n), holes: [] });
  const segs = (o, r) => o.detail === 'draft' ? Math.max(20, Math.min(40, Math.round(r * 1.4))) : Math.max(48, Math.min(96, Math.round(r * 3.2)));

  // ---- the peg: spigot, 45\u00b0 seat, round post with a rounded top. Prints standing on the spigot.
  function pegProfile(P, bodyTop, cap) {
    const { pr, sr } = P.g, sH = P.g.seat - (pr - sr), f = Math.min(5, pr * 0.3);
    const pts = [[0, 0], [sr - 0.6, 0], [sr, 0.6], [sr, sH], [pr, sH + (pr - sr)]];
    if (!cap) {
      pts.push([pr, bodyTop - f]);
      for (let k = 1; k <= 6; k++) { const a = k / 6 * Math.PI / 2; pts.push([pr - f + f * Math.cos(a), bodyTop - f + f * Math.sin(a)]); }
      pts[pts.length - 1][0] = 0; pts.pop(); pts.push([pr - f + f * Math.cos(Math.PI / 2 * 5 / 6), bodyTop - f + f * Math.sin(Math.PI / 2 * 5 / 6)]);
      pts.push([0, bodyTop]);
    } else {
      // lock pin: body through the rack rail, then a 45\u00b0 collar that holds the rack down
      pts.push([pr, bodyTop], [pr + 3, bodyTop + 3], [pr + 3, bodyTop + 4.5], [pr + 2, bodyTop + 5.5], [0, bodyTop + 5.5]);
    }
    return pts;
  }
  function pegMesh(P, cap) {
    const o = P.o, top = P.g.seat + (cap ? RAIL_T + 0.4 : P.pegH);
    return lathe(pegProfile(P, top, cap), segs(o, P.g.pr + 3), 0, 0, 0);
  }

  // ---- board tiles with dovetail seams
  function seamsFor(len, hs, pitch, max, tab) {
    // candidate seams halfway between hole lines; tiles from -len/2 to len/2
    const cand = hs.slice(0, -1).map(h => h + pitch / 2), a = -len / 2, b = len / 2;
    const ok = cuts => { const e = [a, ...cuts, b]; for (let k = 0; k + 1 < e.length; k++) if (e[k + 1] - e[k] + (k + 2 < e.length ? tab : 0) > max + 1e-6) return false; return true; };
    if (ok([])) return [];
    const greedy = []; let s = a;
    while (b - s > max + 1e-6) {
      const fit = cand.filter(c => c > s + 1 && c - s + tab <= max + 1e-6);
      if (!fit.length) return null;
      s = fit[fit.length - 1]; greedy.push(s);
    }
    const n = greedy.length + 1, even = [];
    for (let k = 1; k < n; k++) {
      const t = a + k * len / n; let best = null;
      for (const c of cand) if (!even.includes(c) && (best === null || Math.abs(c - t) < Math.abs(best - t))) best = c;
      even.push(best);
    }
    even.sort((x, y) => x - y);
    return ok(even) && new Set(even).size === even.length ? even : greedy;
  }
  function tabPoly(s, at, axis, sign, grow) {
    // a dovetail on seam s (x = s for axis 'x', y = s for 'y') centered at `at`, pointing +sign
    const { a, b, d } = TAB, g = grow || 0, base = s - sign * (1 + g), neck = s, head = s + sign * (d + g);
    const pts = [[base, at - a - g], [neck, at - a - g], [head, at - b - g], [head, at + b + g], [neck, at + a + g], [base, at + a + g]];
    const P = axis === 'x' ? pts : pts.map(([u, v]) => [v, u]);
    return { outer: T.circle ? P : P, holes: [] };
  }
  function tabSpots(lo, hi, mids, seams) {
    const inside = mids.filter(m => m > lo + 14 && m < hi - 14 && !seams.some(s => Math.abs(s - m) < 1));
    if (!inside.length) return [];
    if (inside.length <= 2) return [inside[Math.floor(inside.length / 2)]];
    return [inside[Math.round((inside.length - 1) / 3)], inside[Math.round(2 * (inside.length - 1) / 3)]].filter((v, i, A) => A.indexOf(v) === i);
  }
  function boardTiles(P) {
    const { o, g, B, bw, bd, hx, hy } = P, warnings = [];
    const sx = seamsFor(bw, hx, o.pitch, B.w, TAB.d), sy = seamsFor(bd, hy, o.pitch, B.d, TAB.d);
    if (!sx || !sy) { return { tiles: [], error: `The ${Math.round(o.pitch)} mm hole grid is too coarse to tile on this plate. Choose a bigger printer or a smaller hole spacing.` }; }
    const ex = [-bw / 2, ...sx, bw / 2], ey = [-bd / 2, ...sy, bd / 2];
    const midX = hx.slice(0, -1).map(h => h + o.pitch / 2), midY = hy.slice(0, -1).map(h => h + o.pitch / 2);
    const outline = [{ outer: T.roundRect(-bw / 2, -bd / 2, bw / 2, bd / 2, 8), holes: [] }];
    const hc = o.jointClear / 2;
    // tabs: each vertical seam gets tabs pointing +x, each horizontal seam tabs pointing +y
    const vt = [], ht = [];
    for (let k = 1; k + 1 < ex.length; k++) for (let r = 0; r + 1 < ey.length; r++) for (const at of tabSpots(ey[r], ey[r + 1], midY, sy)) vt.push({ s: ex[k], at, col: k - 1, row: r });
    for (let r = 1; r + 1 < ey.length; r++) for (let k = 0; k + 1 < ex.length; k++) for (const at of tabSpots(ex[k], ex[k + 1], midX, sx)) ht.push({ s: ey[r], at, col: k, row: r - 1 });
    const missing = [];
    for (let k = 1; k + 1 < ex.length; k++) for (let r = 0; r + 1 < ey.length; r++) if (!vt.some(t => t.col === k - 1 && t.row === r)) missing.push(1);
    for (let r = 1; r + 1 < ey.length; r++) for (let k = 0; k + 1 < ex.length; k++) if (!ht.some(t => t.col === k && t.row === r - 1)) missing.push(1);
    if (missing.length) warnings.push('Some tile edges are too short for a dovetail and simply butt together; a dab of glue holds them.');
    const tiles = [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r + 1 < ey.length; r++) for (let k = 0; k + 1 < ex.length; k++) {
      const x0 = ex[k] + (k > 0 ? hc : 0), x1 = ex[k + 1] - (k + 2 < ex.length ? hc : 0);
      const y0 = ey[r] + (r > 0 ? hc : 0), y1 = ey[r + 1] - (r + 2 < ey.length ? hc : 0);
      let poly = [rectP(x0, y0, x1, y1)];
      const mine = vt.filter(t => t.col === k && t.row === r).map(t => tabPoly(t.s - hc, t.at, 'x', +1, 0))
        .concat(ht.filter(t => t.col === k && t.row === r).map(t => tabPoly(t.s - hc, t.at, 'y', +1, 0)));
      if (mine.length) poly = T.unionPolys(poly.concat(mine));
      // sockets: the neighbor's tab grown evenly by the joint clearance on every face
      const theirs = T.offset(T.unionPolys(vt.filter(t => t.col === k - 1 && t.row === r).map(t => tabPoly(t.s - hc, t.at, 'x', +1, 0))
        .concat(ht.filter(t => t.col === k && t.row === r - 1).map(t => tabPoly(t.s - hc, t.at, 'y', +1, 0)))), o.jointClear, false);
      if (theirs.length) poly = T.diffPolys(poly, theirs);
      poly = T.interPolys(poly, outline);
      const bb = T.polysBBox(poly);
      tiles.push({ name: `Board tile ${letters[r] || r + 1}${k + 1}`, row: r, col: k, poly, box: [x0, y0, x1, y1], bb,
        tabs: mine.length, sockets: theirs.length });
    }
    return { tiles, sx, sy, ex, ey, warnings, vt, ht };
  }
  function tileMesh(P, tile, seamsX, seamsY) {
    const { o, g, hx, hy } = P, n = segs(o, g.csR);
    const bb = tile.bb, near = [];
    for (const x of hx) for (const y of hy) if (x > bb.x0 - g.csR && x < bb.x1 + g.csR && y > bb.y0 - g.csR && y < bb.y1 + g.csR) near.push([x, y]);
    const holes = r => near.map(([x, y]) => ring(x, y, r, n));
    // pockets under the top skin between holes, not in cells a seam runs through
    let pockets = [];
    if (o.ribbed) {
      const rc = 10, keep = g.csR + 0.2 + 3;
      const s = Math.min(o.pitch - 12, 2 * (o.pitch / 2 + rc - (keep + rc) / Math.SQRT2));
      if (s >= 16) {
        const [x0, y0, x1, y1] = tile.box;
        for (let i = 0; i + 1 < hx.length; i++) for (let j = 0; j + 1 < hy.length; j++) {
          const cx = hx[i] + o.pitch / 2, cy = hy[j] + o.pitch / 2;
          if (seamsX.some(sx => Math.abs(sx - cx) < 1) || seamsY.some(sy => Math.abs(sy - cy) < 1)) continue;
          if (cx - s / 2 < x0 + 6 || cx + s / 2 > x1 - 6 || cy - s / 2 < y0 + 6 || cy + s / 2 > y1 - 6) continue;
          pockets.push({ outer: T.roundRect(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2, rc), holes: [] });
        }
      }
    }
    const t = o.boardT, skin = 3, layers = [];
    const cut = (z0, z1, r, withPockets) => layers.push({ z0, z1, polys: T.diffPolys(tile.poly, holes(r).concat(withPockets ? pockets : [])) });
    const zc = t - CS_DEPTH; // countersink starts here
    const zp = t - skin;     // pocket ceiling
    // layers from the bottom: through hole, then 1 mm countersink steps (peg radius + clearance at each step's top)
    const steps = [];
    for (let k = 0; k < CS_DEPTH; k++) steps.push({ z0: zc + k, z1: zc + k + 1, r: g.pr - (CS_DEPTH - 1 - k) + o.clearance });
    // the straight hole runs up to zc; pockets reach zp
    const zs = [0, Math.min(zc, zp), Math.max(zc, zp)].filter((v, i, A) => A.indexOf(v) === i).sort((a, b) => a - b);
    if (zc <= zp) {
      cut(0, zc, g.holeR, true);
      for (const st of steps) {
        if (st.z1 <= zp) cut(st.z0, st.z1, st.r, true);
        else if (st.z0 >= zp) cut(st.z0, st.z1, st.r, false);
        else { cut(st.z0, zp, st.r, true); cut(zp, st.z1, st.r, false); }
      }
    } else {
      cut(0, zp, g.holeR, true); cut(zp, zc, g.holeR, false);
      for (const st of steps) cut(st.z0, st.z1, st.r, false);
    }
    void zs;
    const p = T.steppedExtrude(layers);
    return { p, pockets: pockets.length, holes: near.length };
  }

  // ---- racks (pan and lid): rails on two grid lines, fins between end pads, lock-pin holes in the pads
  function rackMesh(P, rk) {
    const { o, g } = P, n = segs(o, g.csR);
    const L = rk.u1 - rk.u0, Wv = rk.v1 - rk.v0;
    // local frame: u along the rack, v across; built at origin, mapped below
    const f0 = rk.f0 - rk.u0;
    const fins = [];
    for (let k = 0; k < rk.fins; k++) { const u = f0 + k * rk.spacing; fins.push({ outer: T.roundRect(u, 0, u + rk.finT, Wv, Math.min(2, rk.finT / 2 - 0.1)), holes: [] }); }
    const rails = [rectP(0, 0, L, RAIL_W), rectP(0, Wv - RAIL_W, L, Wv)];
    if (Wv > 2 * RAIL_W + 140) rails.push(rectP(f0, Wv / 2 - 10, f0 + rk.F, Wv / 2 + 10)); // a middle tie for long fins
    const base = [{ outer: T.roundRect(0, 0, L, Wv, 6), holes: [] }];
    let rail = T.interPolys(T.unionPolys(rails.concat(fins)), base);
    // pin holes: one on each rail, over a board hole
    const pinUV = rk.pins.map((pn, k) => [(rk.axis === 'x' ? pn[0] : pn[1]) - rk.u0, k ? Wv - RAIL_W / 2 : RAIL_W / 2]);
    rail = T.diffPolys(rail, pinUV.map(([u, v]) => ring(u, v, g.csR, n)));
    let p = T.steppedExtrude([{ z0: 0, z1: RAIL_T, polys: rail }, { z0: RAIL_T, z1: rk.finH, polys: fins }]);
    // map local (u, v) to the drawer
    const q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      const u = p[i], v = p[i + 1];
      if (rk.axis === 'x') { q[i] = rk.u0 + u; q[i + 1] = rk.v0 + v; }
      else { q[i] = rk.v0 + v; q[i + 1] = rk.u0 + u; }
      q[i + 2] = p[i + 2];
    }
    if (rk.axis !== 'x') { for (let i = 0; i < q.length; i += 9) { for (let k = 0; k < 3; k++) { const t = q[i + 3 + k]; q[i + 3 + k] = q[i + 6 + k]; q[i + 6 + k] = t; } } } // swapping u/v mirrors, so flip winding
    return q;
  }
  function cradleMeshes(P, pot) {
    const { o } = P, Rin = pot.R + 1.5, Rout = pot.R + 8, h = 12, n = o.detail === 'draft' ? 72 : 160;
    const full = { outer: T.circle(pot.x, pot.y, Rout, n), holes: [T.circle(pot.x, pot.y, Rin, n).reverse()] };
    if (fitsBed(2 * Rout, 2 * Rout, P.B)) return [T.steppedExtrude([{ z0: 0, z1: h, polys: [full] }])];
    const halves = [];
    for (const s of [-1, 1]) halves.push(T.steppedExtrude([{ z0: 0, z1: h, polys: T.interPolys([full], [rectP(s < 0 ? pot.x - Rout - 1 : pot.x + 0.4, pot.y - Rout - 1, s < 0 ? pot.x - 0.4 : pot.x + Rout + 1, pot.y + Rout + 1)]) }]));
    return halves;
  }

  // ---------------------------------------------------------------- build
  function build(raw) {
    const o = options(raw), P = plan(Object.assign(o, { _planned: true })), warnings = P.warnings.slice();
    const t = o.boardT, parts = [];
    const BT = boardTiles(P);
    if (BT.error) warnings.push(BT.error);
    warnings.push(...(BT.warnings || []));
    let pockets = 0;
    BT.tiles.forEach((tl, i) => {
      const m = tileMesh(P, tl, BT.sx, BT.sy); pockets += m.pockets;
      const cx = (tl.bb.x0 + tl.bb.x1) / 2, cy = (tl.bb.y0 + tl.bb.y1) / 2, L = Math.hypot(cx, cy) || 1;
      parts.push({ name: tl.name, kind: 'tile', color: o.colors.board, p: m.p, assembled: m.p, local: toOrigin(m.p), tileIndex: i,
        dir: [cx / L * 0.5, cy / L * 0.5, -0.05], spread: 0.25, size: [tl.bb.w, tl.bb.h, t] });
    });
    const pegLocal = pegMesh(P, false);
    P.pegs.forEach((pg, i) => {
      const a = move(pegLocal, pg.x, pg.y, 1);
      parts.push({ name: `Peg ${i + 1}`, kind: 'peg', color: o.colors.accent, p: a, assembled: a, local: pegLocal, dir: [0, 0, 1], spread: 0.55 });
    });
    const pinLocal = pegMesh(P, true);
    let pinN = 0;
    P.racks.forEach((rk, i) => {
      const a = rackMesh(P, rk), am = move(a, 0, 0, t);
      const nm = `${rk.type === 'pan' ? 'Pan rack' : 'Lid rack'} ${P.racks.filter((r, k) => k <= i && r.type === rk.type).length}`;
      parts.push({ name: nm, kind: rk.type + 'rack', color: o.colors.accent, p: am, assembled: am, local: toOrigin(a), dir: [0, 0, 0.75], spread: 0.45, slots: rk.slots });
      for (const [x, y] of rk.pins) {
        const pa = move(pinLocal, x, y, 1); pinN++;
        parts.push({ name: `Lock pin ${pinN}`, kind: 'pin', color: o.colors.accent, p: pa, assembled: pa, local: pinLocal, dir: [0, 0, 1.25], spread: 0.6 });
      }
    });
    if (o.cradles) P.pots.forEach((pot, i) => {
      cradleMeshes(P, pot).forEach((m, k, A) => {
        const am = move(m, 0, 0, t);
        parts.push({ name: `Pot cradle ${i + 1}${A.length > 1 ? (k ? 'b' : 'a') : ''}`, kind: 'cradle', color: o.colors.accent, p: am, assembled: am, local: toOrigin(m), dir: [0, 0, 0.9], spread: 0.4 });
      });
    });
    const all = parts.length ? T.concat(parts.map(p => p.assembled)) : new Float64Array(0);
    // plates: pack the printable parts on the selected plate
    let plates = 0, unfit = [];
    if (PL && PL.arrange && parts.length) {
      try { const A = PL.arrange(parts.map(pt => ({ name: pt.name, p: pt.local, color: pt.color })), P.B.w, P.B.d, { gap: 5, maxZ: P.B.z }); plates = A.plates.length; unfit = A.unfit.map(u => u.name); } catch (_) {}
    }
    if (unfit.length) warnings.push(`Too big for this plate: ${unfit.slice(0, 4).join(', ')}${unfit.length > 4 ? '\u2026' : ''}.`);
    const filaments = [{ role: 'board', color: o.colors.board }];
    if (String(o.colors.accent).toUpperCase() !== String(o.colors.board).toUpperCase()) filaments.push({ role: 'pegs and racks', color: o.colors.accent });
    const pans = [], lids = [];
    for (const rk of P.racks) {
      const f0 = rk.f0;
      for (let k = 0; k < rk.slots; k++) {
        const u = f0 + rk.finT + k * rk.spacing + (rk.spacing - rk.finT) / 2;
        if (rk.type === 'pan') pans.push({ x: u, y: rk.center[1], gap: rk.spacing - rk.finT, z: t + RAIL_T, depth: rk.v1 - rk.v0, y0: rk.v0, y1: rk.v1 });
        else lids.push({ x: rk.center[0], y: u, gap: rk.spacing - rk.finT, z: t + RAIL_T, width: rk.v1 - rk.v0, x0: rk.v0, x1: rk.v1 });
      }
    }
    const pegsN = P.pegs.length;
    return {
      parts, options: o, plan: P, warnings, filaments,
      preview: { drawer: [o.drawerW, o.drawerD, o.drawerH], boardT: t, pans, lids, pots: P.pots.map(p => ({ x: p.x, y: p.y, R: p.R, z: t })), lidD: o.lidD, clearH: P.clearH,
        racks: P.racks.map(rk => rk.axis === 'x' ? { type: rk.type, x0: rk.u0, x1: rk.u1, y0: rk.v0, y1: rk.v1 } : { type: rk.type, x0: rk.v0, x1: rk.v1, y0: rk.u0, y1: rk.u1 }) },
      split: { tiles: BT.tiles.length, cols: (BT.ex || [0, 0]).length - 1, rows: (BT.ey || [0, 0]).length - 1, tabs: (BT.vt || []).length + (BT.ht || []).length },
      stats: {
        drawerW: o.drawerW, drawerD: o.drawerD, drawerH: o.drawerH, boardW: +P.bw.toFixed(1), boardD: +P.bd.toFixed(1), boardT: t,
        pitch: o.pitch, holes: P.nx * P.ny, cols: P.nx, rows: P.ny, tiles: BT.tiles.length, pockets,
        pegs: pegsN, pegH: Math.round(P.pegH), pegD: o.pegD, pins: pinN,
        panRacks: P.racks.filter(r => r.type === 'pan').length, panSlots: P.racks.filter(r => r.type === 'pan').reduce((s, r) => s + r.slots, 0),
        lidRacks: P.racks.filter(r => r.type === 'lid').length, lidSlots: P.racks.filter(r => r.type === 'lid').reduce((s, r) => s + r.slots, 0),
        pots: P.pots.length, cradles: parts.filter(p => p.kind === 'cradle').length, plates,
        tris: all.length / 9, parts: parts.length
      },
      plate: all, assembled: all
    };
  }

  // Display-only cookware for the drawer preview. Never exported: sizes each
  // sample pot, pan and lid to its slot and to the free space around it so
  // neighboring items and rack fins do not intersect.
  const CW_GAP = 3, CW_RIM = 2.2, CW_LIDRIM = 2, CW_HANDLE_R = 6.5, CW_POT_HW = 7, CW_POT_HH = 18;
  function cwAabb(x0, y0, z0, x1, y1, z1) { return { x0, y0, z0, x1, y1, z1 }; }
  function cwOverlap(a, b, eps) {
    const e = eps == null ? 0.6 : eps;
    return a.x0 < b.x1 - e && a.x1 > b.x0 + e && a.y0 < b.y1 - e && a.y1 > b.y0 + e && a.z0 < b.z1 - e && a.z1 > b.z0 + e;
  }
  function cookwareBoxes(item) {
    const boxes = [];
    if (item.kind === 'pan') {
      const cz = item.z + item.R, t = item.t, R = item.R;
      boxes.push(cwAabb(item.x - t / 2, item.y - R - CW_RIM, item.z - CW_RIM, item.x + t / 2 + CW_RIM, item.y + R + CW_RIM, cz + R + CW_RIM));
      if (item.handleLen > 4) {
        const hy = item.y - R + 4, hz = item.z + R + 6, hl = item.handleLen;
        boxes.push(cwAabb(item.x - CW_HANDLE_R, hy - hl, hz - CW_HANDLE_R, item.x + CW_HANDLE_R, hy, hz + CW_HANDLE_R));
      }
    } else if (item.kind === 'lid') {
      const t = item.t, R = item.R, kr = item.knobR || 0, cz = item.z + R;
      boxes.push(cwAabb(item.x - R - CW_LIDRIM, item.y - t / 2 - CW_LIDRIM, item.z - CW_LIDRIM, item.x + R + CW_LIDRIM, item.y + t / 2 + CW_LIDRIM, cz + R + CW_LIDRIM));
      const ky = item.knobY == null ? 4 : item.knobY;
      if (kr > 0) boxes.push(cwAabb(item.x - kr, item.y - kr + ky, cz - kr, item.x + kr, item.y + kr + ky, cz + kr));
    } else if (item.kind === 'pot') {
      const R = item.R, h = item.h;
      boxes.push(cwAabb(item.x - R - 2.4, item.y - R - 2.4, item.z, item.x + R + 2.4, item.y + R + 2.4, item.z + h + 2.4));
      for (const hd of item.handles || []) {
        const reach = hd.reach, mid = item.R + reach / 2 - 6, ca = Math.cos(hd.angle), sa = Math.sin(hd.angle);
        const cx = item.x + ca * mid, cy = item.y + sa * mid, len = reach + 12, hz = item.z + h - 18;
        const hx = Math.abs(ca) * len / 2 + Math.abs(sa) * CW_POT_HW, hy = Math.abs(sa) * len / 2 + Math.abs(ca) * CW_POT_HW;
        boxes.push(cwAabb(cx - hx, cy - hy, hz - 4, cx + hx, cy + hy, hz + 4));
      }
    }
    return boxes.map(b => Object.assign(b, { item }));
  }
  function cookwarePreview(pv) {
    if (!pv) return { pans: [], lids: [], pots: [] };
    const room = pv.clearH - 6, wallX = pv.drawer[0] / 2, wallY = pv.drawer[1] / 2, front = -pv.drawer[1] / 2 + 8;
    const racks = pv.racks || [];
    const panScale = [1, 0.92, 0.84, 0.78, 0.88], lidScale = [1, 0.94, 0.88, 0.82, 0.9, 0.86];
    const pans = [];
    for (let i = 0; i < (pv.pans || []).length; i++) {
      const p = pv.pans[i], y0 = p.y0 != null ? p.y0 : p.y - p.depth / 2, y1 = p.y1 != null ? p.y1 : p.y + p.depth / 2;
      const maxR = Math.min(130, (room - 8) / 2, p.y - y0 - CW_GAP, y1 - p.y - CW_GAP);
      if (maxR < 12) continue;
      const R = Math.min(maxR, Math.max(12, maxR * panScale[i % panScale.length]));
      const t = Math.max(5, Math.min(24, p.gap - 2 * CW_GAP));
      pans.push({ kind: 'pan', x: p.x, y: p.y, z: p.z, R, t, handleLen: 0, y0, y1, gap: p.gap });
    }
    const pots = (pv.pots || []).map(p => ({ kind: 'pot', x: p.x, y: p.y, z: p.z, R: Math.max(18, p.R - 2), h: Math.max(40, Math.min(150, pv.clearH - 25)), handles: [] }));
    const yBand = (y0, y1, a, b) => y0 < b && y1 > a;
    function shrinkLidR(l, y0, y1, maxR) {
      let R = Math.min(maxR, l.x - (-wallX + CW_GAP), wallX - CW_GAP - l.x);
      const block = (ox0, ox1) => {
        if (ox1 <= l.x) R = Math.min(R, l.x - ox1 - CW_GAP);
        else if (ox0 >= l.x) R = Math.min(R, ox0 - l.x - CW_GAP);
        else R = Math.min(R, 8);
      };
      for (const p of pans) if (yBand(y0, y1, p.y - p.R - CW_RIM, p.y + p.R + CW_RIM)) block(p.x - p.t / 2, p.x + p.t / 2 + CW_RIM);
      for (const p of pots) {
        const dy = Math.max(0, Math.abs(((y0 + y1) / 2) - p.y) - (y1 - y0) / 2);
        if (dy >= p.R) continue;
        const half = Math.sqrt(Math.max(0, p.R * p.R - dy * dy));
        block(p.x - half, p.x + half);
      }
      for (const rk of racks) {
        if (rk.type === 'lid') continue;
        if (yBand(y0, y1, rk.y0, rk.y1)) block(rk.x0, rk.x1);
      }
      return R;
    }
    const lids = [];
    for (let i = 0; i < (pv.lids || []).length; i++) {
      const l = pv.lids[i], t = Math.max(3, Math.min(6, l.gap - 2 * CW_GAP));
      const knobR = Math.min(10, Math.max(0, l.gap / 2 - t / 2 - 2));
      const knobY = Math.min(4, Math.max(0, l.gap / 2 - t / 2 - knobR - 1));
      const y0 = l.y - t / 2 - CW_LIDRIM, y1 = l.y + t / 2 + CW_LIDRIM;
      const maxR = shrinkLidR(l, y0, Math.max(y1, l.y + knobY + knobR), Math.min(pv.lidD / 2, (room - 4) / 2));
      if (maxR < 12) continue;
      const R = Math.min(maxR, Math.max(12, maxR * lidScale[i % lidScale.length]));
      lids.push({ kind: 'lid', x: l.x, y: l.y, z: l.z, R, t, knobR, knobY });
    }
    for (const p of pans) {
      let hl = Math.min(180, Math.max(0, p.y - p.R - front));
      const hx0 = p.x - CW_HANDLE_R, hx1 = p.x + CW_HANDLE_R, startY = p.y - p.R + 4;
      const clip = (ox0, ox1, oy0, oy1) => {
        if (hx0 >= ox1 - 0.5 || hx1 <= ox0 + 0.5) return;
        if (oy1 < startY && startY - hl < oy1) hl = Math.min(hl, Math.max(0, startY - (oy1 + CW_GAP)));
        if (oy0 <= startY && oy1 >= startY) hl = 0;
      };
      for (const l of lids) clip(l.x - l.R - CW_LIDRIM, l.x + l.R + CW_LIDRIM, l.y - l.t / 2 - CW_LIDRIM, l.y + l.t / 2 + (l.knobY || 0) + l.knobR);
      for (const pot of pots) {
        if (Math.abs(p.x - pot.x) < pot.R + CW_HANDLE_R) {
          const span = Math.sqrt(Math.max(0, pot.R * pot.R - Math.min(pot.R, Math.abs(p.x - pot.x)) ** 2));
          clip(pot.x - pot.R, pot.x + pot.R, pot.y - span, pot.y + span);
        }
      }
      for (const rk of racks) if (rk.type !== 'pan') clip(rk.x0, rk.x1, rk.y0, rk.y1);
      clip(-wallX, wallX, -wallY, front);
      p.handleLen = hl;
    }
    function rayHitRect(ox, oy, ca, sa, start, want, x0, y0, x1, y1, pad) {
      let max = want;
      for (let s = 0; s <= Math.max(0, want) + pad; s += 1) {
        const px = ox + ca * (start + s), py = oy + sa * (start + s);
        if (px + pad > x0 && px - pad < x1 && py + pad > y0 && py - pad < y1) { max = Math.min(max, s - CW_GAP); break; }
      }
      return max;
    }
    function rayHitCircle(ox, oy, ca, sa, start, want, qx, qy, rad) {
      const fx = ox + ca * start - qx, fy = oy + sa * start - qy, b = fx * ca + fy * sa, c = fx * fx + fy * fy - rad * rad;
      if (c <= 0) return -1;
      const disc = b * b - c; if (disc <= 0) return want;
      const s = -b - Math.sqrt(disc);
      return s >= 0 ? Math.min(want, s - CW_GAP) : want;
    }
    function handleSeg(pot, h) {
      const ca = Math.cos(h.angle), sa = Math.sin(h.angle);
      return { x0: pot.x + ca * (pot.R - 12), y0: pot.y + sa * (pot.R - 12), x1: pot.x + ca * (pot.R + h.reach), y1: pot.y + sa * (pot.R + h.reach), z: pot.z + pot.h - 18 };
    }
    function reachAt(pot, a, want, others) {
      const ca = Math.cos(a), sa = Math.sin(a), start = pot.R - 4;
      let max = want;
      if (ca > 0.02) max = Math.min(max, (wallX - CW_GAP - pot.x) / ca - start);
      if (ca < -0.02) max = Math.min(max, (pot.x - (-wallX + CW_GAP)) / -ca - start);
      if (sa > 0.02) max = Math.min(max, (wallY - CW_GAP - pot.y) / sa - start);
      if (sa < -0.02) max = Math.min(max, (pot.y - (-wallY + CW_GAP)) / -sa - start);
      for (const rk of racks) max = Math.min(max, rayHitRect(pot.x, pot.y, ca, sa, start, max, rk.x0, rk.y0, rk.x1, rk.y1, 8));
      for (const l of lids) max = Math.min(max, rayHitRect(pot.x, pot.y, ca, sa, start, max, l.x - l.R - CW_LIDRIM, l.y - l.t / 2 - CW_LIDRIM, l.x + l.R + CW_LIDRIM, l.y + l.t / 2 + (l.knobY || 0) + l.knobR, 8));
      for (const pan of pans) max = Math.min(max, rayHitRect(pot.x, pot.y, ca, sa, start, max, pan.x - pan.t / 2 - 1, pan.y - pan.R - CW_RIM, pan.x + pan.t / 2 + CW_RIM, pan.y + pan.R + CW_RIM, 8));
      for (const q of pots) if (q !== pot) max = Math.min(max, rayHitCircle(pot.x, pot.y, ca, sa, start, max, q.x, q.y, q.R + CW_POT_HW + 2));
      for (const q of others || []) for (const h of q.handles || []) {
        const s = handleSeg(q, h);
        max = Math.min(max, rayHitRect(pot.x, pot.y, ca, sa, start, max, Math.min(s.x0, s.x1) - CW_POT_HW, Math.min(s.y0, s.y1) - CW_POT_HW, Math.max(s.x0, s.x1) + CW_POT_HW, Math.max(s.y0, s.y1) + CW_POT_HW, 6));
      }
      return Math.max(0, max);
    }
    for (const pot of pots) {
      const want = Math.min(22, pot.R * 0.18 + 8), scored = [];
      const others = pots.filter(q => q.handles && q.handles.length);
      for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; scored.push({ a, reach: reachAt(pot, a, want, others) }); }
      scored.sort((a, b) => b.reach - a.reach);
      const pick = [];
      for (const s of scored) {
        if (s.reach < 6) continue;
        if (pick.some(p => { let d = Math.abs(p.a - s.a); d = Math.min(d, 2 * Math.PI - d); return d < 2.2; })) continue;
        pick.push({ angle: s.a, reach: Math.min(want, s.reach) });
        if (pick.length === 2) break;
      }
      pot.handles = pick;
    }
    return { pans, lids, pots };
  }
  function cwSegDist(px, py, x0, y0, x1, y1) {
    const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy;
    if (l2 < 1e-9) return Math.hypot(px - x0, py - y0);
    const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / l2));
    return Math.hypot(px - (x0 + t * vx), py - (y0 + t * vy));
  }
  function cwZ(a0, a1, b0, b1, e) { return a0 < b1 - e && a1 > b0 + e; }
  function cwHandleSeg(pot, h) {
    const ca = Math.cos(h.angle), sa = Math.sin(h.angle);
    return { x0: pot.x + ca * (pot.R - 12), y0: pot.y + sa * (pot.R - 12), x1: pot.x + ca * (pot.R + h.reach), y1: pot.y + sa * (pot.R + h.reach), z0: pot.z + pot.h - 22, z1: pot.z + pot.h - 14 };
  }
  function cookwareConflicts(cw, eps) {
    const e = eps == null ? 0.8 : eps;
    const pans = cw.pans || [], lids = cw.lids || [], pots = cw.pots || [], hits = [];
    const hit = (a, b) => hits.push([a, b]);
    for (let i = 0; i < pans.length; i++) for (let j = i + 1; j < pans.length; j++) {
      const a = pans[i], b = pans[j];
      if (Math.abs(a.x - b.x) < (a.t + b.t) / 2 + CW_RIM - e && Math.abs(a.y - b.y) < a.R + b.R + CW_RIM - e && cwZ(a.z, a.z + 2 * a.R, b.z, b.z + 2 * b.R, e)) hit(a, b);
    }
    for (let i = 0; i < lids.length; i++) for (let j = i + 1; j < lids.length; j++) {
      const a = lids[i], b = lids[j];
      if (Math.abs(a.y - b.y) < (a.t + b.t) / 2 + a.knobR + b.knobR - e && Math.abs(a.x - b.x) < a.R + b.R + 2 * CW_LIDRIM - e && cwZ(a.z, a.z + 2 * a.R, b.z, b.z + 2 * b.R, e)) hit(a, b);
    }
    for (let i = 0; i < pots.length; i++) for (let j = i + 1; j < pots.length; j++) {
      const a = pots[i], b = pots[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.R + b.R + e && cwZ(a.z, a.z + a.h, b.z, b.z + b.h, e)) hit(a, b);
      for (const h of a.handles || []) { const s = cwHandleSeg(a, h); if (cwSegDist(b.x, b.y, s.x0, s.y0, s.x1, s.y1) < b.R + CW_POT_HW - e && cwZ(s.z0, s.z1, b.z, b.z + b.h, e)) hit(a, b); }
      for (const h of b.handles || []) { const s = cwHandleSeg(b, h); if (cwSegDist(a.x, a.y, s.x0, s.y0, s.x1, s.y1) < a.R + CW_POT_HW - e && cwZ(s.z0, s.z1, a.z, a.z + a.h, e)) hit(a, b); }
      for (const ha of a.handles || []) for (const hb of b.handles || []) {
        const sa = cwHandleSeg(a, ha), sb = cwHandleSeg(b, hb);
        if (cwSegDist(sa.x0, sa.y0, sb.x0, sb.y0, sb.x1, sb.y1) < 2 * CW_POT_HW - e || cwSegDist(sa.x1, sa.y1, sb.x0, sb.y0, sb.x1, sb.y1) < 2 * CW_POT_HW - e) {
          if (cwZ(sa.z0, sa.z1, sb.z0, sb.z1, e)) hit(a, b);
        }
      }
    }
    for (const p of pans) for (const l of lids) {
      const px0 = p.x - p.t / 2, px1 = p.x + p.t / 2 + CW_RIM, ly0 = l.y - l.t / 2 - CW_LIDRIM, ly1 = l.y + l.t / 2 + CW_LIDRIM;
      if (px0 < l.x + l.R + CW_LIDRIM - e && px1 > l.x - l.R - CW_LIDRIM + e && p.y - p.R - CW_RIM < ly1 - e && p.y + p.R + CW_RIM > ly0 + e && cwZ(p.z, p.z + 2 * p.R, l.z, l.z + 2 * l.R, e)) hit(p, l);
      if (p.handleLen > 4) {
        const hy0 = p.y - p.R + 4 - p.handleLen, hy1 = p.y - p.R + 4;
        if (p.x - CW_HANDLE_R < l.x + l.R + CW_LIDRIM - e && p.x + CW_HANDLE_R > l.x - l.R - CW_LIDRIM + e && hy0 < ly1 + (l.knobR || 0) - e && hy1 > ly0 + e) hit(p, l);
      }
    }
    for (const p of pans) for (const pot of pots) {
      if (Math.abs(p.x - pot.x) < pot.R + p.t / 2 + CW_RIM - e && Math.abs(p.y - pot.y) < pot.R + p.R + CW_RIM - e) {
        const dx = Math.abs(p.x - pot.x) - p.t / 2 - CW_RIM;
        if (dx < pot.R - e && cwZ(p.z, p.z + 2 * p.R, pot.z, pot.z + pot.h, e)) hit(p, pot);
      }
      if (p.handleLen > 4) {
        const hy0 = p.y - p.R + 4 - p.handleLen, hy1 = p.y - p.R + 4;
        if (cwSegDist(pot.x, pot.y, p.x, hy0, p.x, hy1) < pot.R + CW_HANDLE_R - e && cwZ(p.z + p.R, p.z + p.R + 12, pot.z, pot.z + pot.h, e)) hit(p, pot);
      }
    }
    for (const l of lids) for (const pot of pots) {
      const tHalf = l.t / 2 + CW_LIDRIM;
      if (cwSegDist(pot.x, pot.y, l.x - l.R, l.y, l.x + l.R, l.y) < pot.R + tHalf - e && cwZ(l.z, l.z + 2 * l.R, pot.z, pot.z + pot.h, e)) hit(l, pot);
      if (l.knobR && Math.hypot(l.x - pot.x, l.y + (l.knobY || 0) - pot.y) < pot.R + l.knobR - e && cwZ(l.z + l.R - l.knobR, l.z + l.R + l.knobR, pot.z, pot.z + pot.h, e)) hit(l, pot);
      for (const h of pot.handles || []) {
        const s = cwHandleSeg(pot, h);
        if (cwSegDist((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, l.x - l.R, l.y, l.x + l.R, l.y) < tHalf + CW_POT_HW - e || cwSegDist(s.x1, s.y1, l.x - l.R, l.y, l.x + l.R, l.y) < tHalf + CW_POT_HW - e) {
          if (cwZ(s.z0, s.z1, l.z, l.z + 2 * l.R, e)) hit(l, pot);
        }
      }
    }
    return hits;
  }

  function writeOBJ(p, name) {
    const { V, F } = Core.weld(p);
    let s = `# Expressarte\no ${String(name || 'part').replace(/\s+/g, '_')}\n`;
    for (let i = 0; i < V.length; i += 3) s += `v ${V[i]} ${V[i + 1]} ${V[i + 2]}\n`;
    for (let i = 0; i < F.length; i += 3) s += `f ${F[i] + 1} ${F[i + 1] + 1} ${F[i + 2] + 1}\n`;
    return new TextEncoder().encode(s);
  }
  function export3MF(res, o) {
    o = o || {};
    const cols = [];
    res.parts.forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const ext = c => cols.indexOf((c || '').toUpperCase()) + 1;
    const B = usableBed(res.options.bed);
    const A = PL.arrange(res.parts.map(pt => ({ name: pt.name, p: pt.local, color: pt.color })), B.w, B.d, { gap: 5, maxZ: B.z });
    const objs = [], plates = [];
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, p: it.p, color: it.color, extruder: ext(it.color) }); }); plates.push(ids); });
    return T.threeMF(objs, { title: o.name || 'Pots and pans drawer organizer', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function files(res, o) {
    o = o || {};
    const base = o.fileBase || 'pots_drawer', out = [], seen = new Map();
    const slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    for (const pt of res.parts) {
      // identical pegs and pins are one file with a count
      if (pt.kind === 'peg' || pt.kind === 'pin') { const k = pt.kind; seen.set(k, { pt, n: (seen.get(k) ? seen.get(k).n : 0) + 1 }); continue; }
      out.push({ name: `${base}_${slug(pt.name)}.stl`, data: new Uint8Array(Core.writeSTL(pt.local, pt.name)) });
    }
    for (const [k, { pt, n }] of seen) {
      const nm = k === 'peg' ? 'peg' : 'lock_pin';
      out.push({ name: `${base}_${nm}_print_${n}.stl`, data: new Uint8Array(Core.writeSTL(pt.local, nm)) });
      out.push({ name: `${base}_${nm}_print_${n}.obj`, data: writeOBJ(pt.local, nm) });
    }
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    const s = res.stats, L = [];
    const inch = v => (v / IN).toFixed(2).replace(/\.?0+$/, '') + ' in';
    L.push('Expressarte pots and pans drawer organizer', '',
      `Drawer inside: ${s.drawerW} \u00d7 ${s.drawerD} \u00d7 ${s.drawerH} mm (${inch(s.drawerW)} \u00d7 ${inch(s.drawerD)} \u00d7 ${inch(s.drawerH)})`,
      `Pegboard: ${s.boardW} \u00d7 ${s.boardD} \u00d7 ${s.boardT} mm, ${s.cols} \u00d7 ${s.rows} holes on a ${s.pitch} mm (${inch(s.pitch)}) grid, ${s.tiles} dovetail tiles`,
      `Pegs: ${s.pegs} \u00d7 \u00d8${s.pegD} mm, ${s.pegH} mm above the board`,
      s.panRacks ? `Pan rack: ${s.panSlots} upright slots in ${s.panRacks} rack${s.panRacks > 1 ? 's' : ''}` : 'Pan rack: none',
      s.lidRacks ? `Lid rack: ${s.lidSlots} lids in ${s.lidRacks} rack${s.lidRacks > 1 ? 's' : ''}` : 'Lid rack: none',
      s.pins ? `Lock pins: ${s.pins} (two per rack)` : '', s.cradles ? `Pot cradles: ${s.cradles}` : '',
      '', 'Printing',
      '  - Board tiles: print flat, top face up, 2 to 3 walls and 10 to 15% infill. The ribbed underside saves plastic and needs no supports.',
      '  - Pegs and lock pins: print standing on the small end (the spigot). No supports.',
      '  - Racks: print flat on the rails, fins pointing up. PETG or PLA with 3 walls is strong enough for heavy pans.',
      '', 'Assembly',
      '  - Lay the tiles in the drawer front row first (tile A1 at the front left) and slide the dovetails down into each other.',
      '  - Drop the racks onto the board so their pin holes sit over board holes, then press a lock pin through each one.',
      '  - Press pegs into any hole around your pots. Move them any time.',
      ...(res.warnings || []).map(w => '  - ' + w));
    out.push({ name: `${base}_NOTES.txt`, data: new TextEncoder().encode(L.filter(x => x !== '').join('\n') + '\n') });
    return out;
  }
  function gateInfo(raw, res) {
    const o = options(raw), why = [];
    const pegs = res ? res.stats.pegs : plan(Object.assign(o, { _planned: true })).pegs.length;
    if (pegs > FREE_MAX_PEGS) why.push(`${pegs} pegs (free: up to ${FREE_MAX_PEGS})`);
    if (o.lidRack) why.push('lid rack (Pro)');
    if (o.cradles) why.push('pot cradles (Pro)');
    return why;
  }

  const api = { boardTiles, DEFAULTS, PALETTE, PITCHES, FREE_MAX_PEGS, RAIL_T, RAIL_W, CS_DEPTH, TAB, options, plan, geom, build, export3MF, files, gateInfo, writeOBJ, pegProfile, usableBed, cookwarePreview, cookwareBoxes, cookwareConflicts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPPotsDrawer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
