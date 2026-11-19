/* Expressarte device holster: a mount for power bricks, chargers, routers, small UPS units and other rectangular devices.
   It bolts to a 25 mm multipoint grid board with printed threaded bolts, screws to a wall or desk, or stands in a 42 mm
   grid baseplate. The device slides in from the top; side walls, front lips and a bolt-on end cap hold it on every side,
   so it stays put upside down or sideways (nothing relies on friction or adhesive).
   Print frame: x = device width, y = depth (y = 0 is the board side), z = device height (z = 0 is the bottom end).
   Every part prints standing on its end with no supports: walls and lips are vertical, and every hole through a wall is
   cut layer by layer as a teardrop (45\u00b0 pointed top). Generic names only. American spelling. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const BF = () => G.GPBinFeatures || (typeof require === 'function' ? require('./bin-features.js') : null);
  const SQ2 = Math.SQRT2, EPS = 1e-4;

  // Threads of the 25 mm multipoint grid board (community measurements of the tile holes): small holes take a 7 mm
  // thread at 3 mm pitch (minor 6 mm), the big holes a 22.6 mm thread at 2.5 mm pitch (minor 21.4 mm). The board is 6.4 mm thick.
  const THREADS = {
    small: { label: 'Small threaded bolts (7 mm)', major: 7.0, minor: 6.0, pitch: 3, head: 13, headH: 2.8, slot: 1.8 },
    large: { label: 'Large threaded bolts (22.6 mm)', major: 22.6, minor: 21.4, pitch: 2.5, head: 30, headH: 3.2, slot: 2.6 }
  };
  const GRID_PITCH = 25;
  const GRID42_TOP = 4.75 + 2; // 42 mm grid feet (4.75 mm) plus a 2 mm deck, as the drawer bins use
  const SCREW_HEAD = 8.6; // pan head #8 / 4 mm screw
  const MATERIALS = {
    petg: { label: 'PETG', thread: 0.2, note: 'PETG handles warm power bricks (up to about 70 \u00b0C) and flexes instead of cracking.' },
    asa: { label: 'ASA', thread: 0.2, note: 'ASA is the most heat resistant (about 95 \u00b0C): best for hot chargers or a case in the sun.' },
    pla: { label: 'PLA', thread: 0.15, note: 'PLA softens near 55 \u00b0C. Fine for cool devices; use PETG or ASA for power bricks and chargers.' }
  };
  const FRONTS = { partial: 'Partial front with retaining lips', closed: 'Closed front', open: 'Open front (straps hold it)' };
  const RETAINS = { cap: 'Bolt-on end cap', straps: 'Strap slots', none: 'Open top' };
  const MOUNTS = { grid25: '25 mm multipoint grid, small threaded bolts', grid25big: '25 mm multipoint grid, large threaded bolts', screws: 'Screw holes', grid42: '42 mm grid base (desk or drawer)' };
  const FACES = ['bottom', 'top', 'left', 'right', 'front'];
  const SHAPES = ['round', 'slot', 'rect'];
  const VENTS = ['none', 'slots', 'hex'];
  const DEFAULTS = {
    devW: 60, devH: 110, devD: 30, devR: 3,
    clearance: 0.5, material: 'petg', wall: 2.4, lip: 6, threadClear: null,
    front: 'partial', retain: 'cap', mount: 'grid25', boardT: 6.4, screwD: 4,
    straps: 0, strapW: 20, vents: 'none',
    openings: [],
    colors: { body: '#2B2F33', bolts: '#E07A3A' },
    bed: [256, 256, 256], bambu: 'A1', detail: 'hd', gridBaseMesh: null, device: true
  };
  const PALETTE = [
    { name: 'Charcoal', hex: '#2B2F33' }, { name: 'Black', hex: '#1A1A1A' }, { name: 'White', hex: '#F7F7F2' },
    { name: 'Orange', hex: '#E07A3A' }, { name: 'Forest green', hex: '#2F6B4F' }, { name: 'Blue', hex: '#3B82C4' }, { name: 'Gray', hex: '#9AA3AB' }
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (v === '' || v == null || !Number.isFinite(+v)) ? d : +v;
  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    o.devW = clamp(num(o.devW, DEFAULTS.devW), 10, 400);
    o.devH = clamp(num(o.devH, DEFAULTS.devH), 10, 400);
    o.devD = clamp(num(o.devD, DEFAULTS.devD), 5, 150);
    o.devR = clamp(num(o.devR, DEFAULTS.devR), 0, Math.max(0, Math.min(o.devW, o.devD) / 2 - 0.5));
    o.clearance = clamp(num(o.clearance, DEFAULTS.clearance), 0, 3);
    o.wall = clamp(num(o.wall, DEFAULTS.wall), 1.6, 6);
    o.lip = clamp(num(o.lip, DEFAULTS.lip), 2, 40);
    o.material = MATERIALS[o.material] ? o.material : 'petg';
    o.threadClear = o.threadClear == null || o.threadClear === '' ? MATERIALS[o.material].thread : clamp(+o.threadClear || 0, 0, 0.6);
    o.front = FRONTS[o.front] ? o.front : 'partial';
    o.retain = RETAINS[o.retain] ? o.retain : 'cap';
    o.mount = MOUNTS[o.mount] ? o.mount : 'grid25';
    if (o.mount === 'grid42' && o.retain === 'cap') o.retain = 'none'; // a dock has nothing above it to bolt a cap to
    if (o.front === 'open' && o.retain !== 'straps') o.straps = Math.max(1, +o.straps || 0); // straps are what holds an open front
    o.boardT = clamp(num(o.boardT, DEFAULTS.boardT), 3, 20);
    o.screwD = clamp(num(o.screwD, DEFAULTS.screwD), 2.5, 6);
    o.straps = clamp(Math.round(num(o.straps, 0)), 0, 4);
    if (o.retain === 'straps') o.straps = Math.max(1, o.straps);
    o.strapW = clamp(num(o.strapW, DEFAULTS.strapW), 8, 50);
    o.vents = VENTS.includes(o.vents) ? o.vents : 'none';
    o.openings = (Array.isArray(o.openings) ? o.openings : []).slice(0, 12).map(q => ({
      face: FACES.includes(q.face) ? q.face : 'bottom', shape: SHAPES.includes(q.shape) ? q.shape : 'round',
      a: q.a === '' || q.a == null || !Number.isFinite(+q.a) ? null : +q.a, b: q.b === '' || q.b == null || !Number.isFinite(+q.b) ? null : +q.b,
      w: clamp(num(q.w, 12), 2, 300), h: clamp(num(q.h, 8), 2, 300)
    }));
    o.colors = Object.assign({}, DEFAULTS.colors, o.colors || {});
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    const bd = Array.isArray(o.bed) ? o.bed : DEFAULTS.bed;
    o.bed = [clamp(+bd[0] || 256, 60, 2000), clamp(+bd[1] || 256, 60, 2000), clamp(+bd[2] || +bd[0] || 256, 40, 2000)];
    o.device = o.device !== false;
    return o;
  }

  // ---------------------------------------------------------------- 2D helpers
  const area2 = L => { let s = 0; for (let i = 0, n = L.length; i < n; i++) { const a = L[i], b = L[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s; };
  const ccw = L => area2(L) < 0 ? L.slice().reverse() : L;
  const P = L => ({ outer: ccw(L), holes: [] });
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  function rr4(x0, y0, x1, y1, rs, seg) { // rounded rectangle, corner radii [x0y0, x1y0, x1y1, x0y1]
    const mx = Math.min((x1 - x0) / 2, (y1 - y0) / 2) - 0.01, L = [];
    const c = [[x0, y0, Math.PI], [x1, y0, -Math.PI / 2], [x1, y1, 0], [x0, y1, Math.PI / 2]];
    const sx = [1, -1, -1, 1], sy = [1, 1, -1, -1];
    c.forEach(([cx, cy, a0], k) => {
      const r = clamp(rs[k] || 0, 0, mx);
      if (r < 0.05) { L.push([cx, cy]); return; }
      const n = seg || Math.max(4, Math.min(24, Math.ceil(r * 2.5)));
      for (let i = 0; i <= n; i++) { const t = a0 + Math.PI / 2 * i / n; L.push([cx + sx[k] * r + r * Math.cos(t), cy + sy[k] * r + r * Math.sin(t)]); }
    });
    return L;
  }
  const circ = (cx, cy, r, n) => { const L = []; for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; L.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return L; };
  function stadium(cx, cy, w, h, n) { // w along x, h along y
    const r = Math.min(w, h) / 2; return rr4(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, [r, r, r, r], n);
  }
  // Convex hull (monotone chain), counterclockwise.
  function hull(pts) {
    const q = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
    for (let i = q.length - 1; i >= 0; i--) { const p = q[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-12) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // Teardrop (u, v), v up: a circle with 45\u00b0 flanks to a point on top, so a hole through a vertical wall needs no support.
  function teardrop(cu, cv, r, n) {
    const L = [], m = Math.max(8, Math.round(n * 0.75));
    for (let i = 0; i <= m; i++) { const a = Math.PI * 0.75 + Math.PI * 1.5 * i / m; L.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]); }
    L.push([cu, cv + r * SQ2]); return L;
  }
  // An opening w wide (along u) and h tall (along v) through a vertical wall: round (w is the diameter), slot or rectangle.
  function wallShape(shape, cu, cv, w, h, n) {
    if (shape === 'round') return teardrop(cu, cv, w / 2, n);
    if (shape === 'rect') return rect(cu - w / 2, cv - h / 2, cu + w / 2, cv + h / 2);
    if (w >= h) { const r = h / 2, s = (w - h) / 2; return hull(teardrop(cu - s, cv, r, n).concat(teardrop(cu + s, cv, r, n))); }
    const r = w / 2, s = (h - w) / 2; return hull(circ(cu, cv - s, r, n).concat(teardrop(cu, cv + s, r, n)));
  }
  // The same opening through a horizontal end wall (no overhang to worry about).
  function flatShape(shape, cx, cy, w, h, n) {
    if (shape === 'round') return circ(cx, cy, w / 2, n);
    if (shape === 'slot') return stadium(cx, cy, w, h, Math.max(4, n / 4));
    return rr4(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, [0.6, 0.6, 0.6, 0.6], 3);
  }
  function hexPointy(cu, cv, s) { const R = s / Math.sqrt(3), L = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 2 + i * Math.PI / 3; L.push([cu + R * Math.cos(a), cv + R * Math.sin(a)]); } return L; }

  // ---------------------------------------------------------------- layout
  function picks(k, maxStep) { // lattice indices 0..k, both ends kept, no gap over maxStep
    if (k <= 0) return [0];
    const n = Math.max(1, Math.ceil(k / maxStep)), out = [];
    for (let i = 0; i <= n; i++) { const j = Math.round(i * k / n); if (!out.includes(j)) out.push(j); }
    return out;
  }
  function usable(bed) { return { w: Math.max(50, bed[0] - 8), d: Math.max(50, bed[1] - 8), z: Math.max(30, bed[2] - 4) }; }
  const fitsXY = (w, d, B) => (w <= B.w + 1e-6 && d <= B.d + 1e-6) || (w <= B.d + 1e-6 && d <= B.w + 1e-6);

  function layout(o) {
    const warnings = [], c = o.clearance, w = o.wall;
    const grid25 = o.mount === 'grid25' || o.mount === 'grid25big', grid42 = o.mount === 'grid42', screws = o.mount === 'screws';
    const th = grid25 ? THREADS[o.mount === 'grid25big' ? 'large' : 'small'] : null;
    const baseT = Math.max(2.4, w);
    const pocket = th ? th.headH + 0.2 : screws ? 3 : 0;
    const backT = grid42 ? w : baseT + pocket;
    const frontT = o.front === 'open' ? 0 : w;
    const cw = o.devW + 2 * c, cd = o.devD + 2 * c, ch = o.devH + 2 * c;
    const rc = o.devR > 0 ? Math.min(o.devR + c, cw / 2 - 0.2, cd / 2 - 0.2) : 0;
    let Wo = cw + 2 * w, Do = backT + cd + frontT, cx0 = w, cy0 = backT, zc0 = Math.max(2.4, w), outer, grid = null;
    if (grid42) {
      const nx = Math.max(1, Math.ceil((Wo + 0.5) / 42 - 1e-6)), ny = Math.max(1, Math.ceil((Do + 0.5) / 42 - 1e-6));
      const W42 = 42 * nx - 0.5, D42 = 42 * ny - 0.5, deck = 2;
      grid = { nx, ny, top: GRID42_TOP };
      Wo = W42; Do = D42; cx0 = (W42 - cw) / 2; cy0 = (D42 - cd) / 2; zc0 = GRID42_TOP;
      outer = [P(rr4(0, 0, W42, D42, [3.75, 3.75, 3.75, 3.75], 12))];
      if (Wo > cw + 2 * w + 8 || Do > cd + 2 * w + 8) warnings.push(`The walls are thickened to fill ${nx} \u00d7 ${ny} grid units (${W42} \u00d7 ${D42} mm).`);
    } else {
      const rf = rc > 0 ? rc + frontT : 1, rb = 0.8;
      outer = [P(rr4(0, 0, Wo, Do, [rb, rb, rf, rf]))];
    }
    const cx1 = cx0 + cw, cy1 = cy0 + cd, Ztop = zc0 + ch;
    let lip = 0;
    if (o.front === 'partial') {
      lip = Math.max(o.lip, rc + 2);
      if (cw - 2 * lip < 4) { lip = 0; warnings.push('The device is too narrow for a front window, so the front is closed.'); }
      else if (lip > o.lip + 0.01) warnings.push(`Front lips widened to ${lip.toFixed(1)} mm so they reach past the device's rounded corners.`);
    }
    const front = o.front === 'partial' && !lip ? 'closed' : o.front;
    // bolts / screws
    const rcb = th ? th.head / 2 + 0.4 : screws ? SCREW_HEAD / 2 + 0.4 : 0;
    const rh = th ? th.major / 2 + 0.4 : screws ? o.screwD / 2 + 0.25 : 0;
    const B = usable(o.bed);
    const L = { o, th, grid25, grid42, screws, baseT, pocket, backT, frontT, cw, cd, ch, rc, Wo, Do, cx0, cy0, cx1, cy1, zc0, Ztop, lip, front, rcb, rh, outer, grid, B, warnings };
    const capT = Math.max(3, w);
    L.capT = capT;
    // Fixings sit on 25 mm lattice lines (the board's grid; screws use the same spacing): columns centered across the
    // device, rows anchored on the end cap's row so the cap lands on the board's grid too. A holster too big for the
    // printer is cut between lattice lines, and every section gets its own fixings.
    const pitch = GRID_PITCH, xMin = cx0 + rcb + 0.4, xMax = cx1 - rcb - 0.4, xc = (cx0 + cx1) / 2;
    const zMin = zc0 + rcb + 0.4, zMax = Ztop - rcb * SQ2 - 0.4;
    const fixing = grid25 || screws;
    let xLines = [], zLines = [], capRow = null;
    if (fixing) {
      if (xMax < xMin - 1e-6) {
        if (th && th === THREADS.large) throw new Error(`The large threaded bolts need a device at least ${Math.ceil(2 * rcb + 0.8 - 2 * c)} mm wide. Use the small threaded bolts.`);
        xLines = [xc]; warnings.push('The device is narrow: one column of fixings down the middle.');
      } else { const k = Math.floor((xMax - xMin) / pitch + 1e-6); for (let j = 0; j <= k; j++) xLines.push(xc + pitch * (j - k / 2)); }
      const wantCap = o.retain === 'cap';
      if (zMax < zMin - 1e-6) { zLines = [(zMin + zMax) / 2]; warnings.push('The device is short: one row of fixings.'); }
      else if (wantCap) {
        const need = Ztop + capT + rcb + 0.6;
        for (let z = need - pitch; z >= zMin - 1e-6; z -= pitch) if (z <= zMax + 1e-6) zLines.unshift(z);
        if (!zLines.length) { const k = Math.floor((zMax - zMin) / pitch + 1e-6); for (let j = 0; j <= k; j++) zLines.push(zMin + pitch * j); }
      } else { const k = Math.floor((zMax - zMin) / pitch + 1e-6), z0 = (zMin + zMax) / 2 - pitch * k / 2; for (let j = 0; j <= k; j++) zLines.push(z0 + pitch * j); }
      if (wantCap) { const need = Ztop + capT + rcb + 0.6, z0 = zLines[0]; capRow = grid25 ? z0 + pitch * Math.ceil((need - z0) / pitch - 1e-6) : need; }
    }
    const pad = rcb + 0.8;
    const split = (lo, hi, maxLen, lines) => {
      if (hi - lo <= maxLen + 1e-6) return [lo, hi];
      const cand = [];
      for (let i = 0; i + 1 < lines.length; i++) cand.push((lines[i] + lines[i + 1]) / 2);
      lines.forEach(z => cand.push(z));
      if (!lines.length) for (let z = lo + 20; z < hi - 20; z += 5) cand.push(z);
      cand.sort((a, b) => a - b);
      const okSec = (a, b) => !fixing || lines.some(z => z > a + (a > lo ? pad : -1) && z < b - (b < hi ? pad : -1));
      const cuts = [lo]; let s = lo;
      while (hi - s > maxLen + 1e-6) {
        const left = Math.ceil((hi - s) / maxLen - 1e-9), target = s + (hi - s) / left;
        const ok = cand.filter(cz => cz > s + 10 && cz <= s + maxLen && okSec(s, cz) && hi - cz > 10);
        if (!ok.length) return null;
        ok.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
        s = ok[0]; cuts.push(s);
      }
      if (!okSec(s, hi)) return null;
      cuts.push(hi); return cuts;
    };
    const needX = !fitsXY(Wo, Do, B);
    let zCuts = split(0, Ztop, B.z, zLines);
    if (!zCuts) { warnings.push(`The holster is ${Math.round(Ztop)} mm tall, more than this printer's ${Math.round(B.z)} mm build height.`); zCuts = [0, Ztop]; }
    let xCuts = [0, Wo];
    if (needX) { xCuts = split(0, Wo, Math.max(B.w, B.d), xLines); if (!xCuts) { warnings.push(`The holster is ${Math.round(Wo)} mm wide, wider than this printer's bed.`); xCuts = [0, Wo]; } }
    const inside = (lines, a, b, lo, hi) => lines.filter(v => v > a + (a > lo + 1e-6 ? pad : -1) && v < b - (b < hi - 1e-6 ? pad : -1));
    const fixes = [], capFixes = []; let warnedOne = false;
    if (fixing) {
      for (let i = 0; i + 1 < zCuts.length; i++) for (let j = 0; j + 1 < xCuts.length; j++) {
        const zs = inside(zLines, zCuts[i], zCuts[i + 1], 0, Ztop), xs = inside(xLines, xCuts[j], xCuts[j + 1], 0, Wo);
        const zp = picks(zs.length - 1, 4).map(q => zs[q]), xp = picks(xs.length - 1, 4).map(q => xs[q]);
        const before = fixes.length;
        for (const z of zp) for (const x of xp) if (z != null && x != null) fixes.push([x, z]);
        if (fixes.length - before === 1 && !warnedOne) { warnedOne = true; warnings.push((zCuts.length - 1) * (xCuts.length - 1) > 1 ? 'One section has only one fixing and could pivot. Pick a bigger bed or add straps.' : (capRow != null ? 'Only one body fixing fits, so the holster could pivot. Make it a little taller or wider, or add straps.' : 'Only one fixing fits, so the holster could pivot. Add the end cap or straps, or make it a little taller or wider.')); }
      }
      if (capRow != null) for (let j = 0; j + 1 < xCuts.length; j++) {
        const xs = inside(xLines, xCuts[j], xCuts[j + 1], 0, Wo); if (!xs.length) continue;
        capFixes.push([xs[0], capRow]); if (xs.length > 1) capFixes.push([xs[xs.length - 1], capRow]);
      }
    }
    Object.assign(L, { xLines, zLines, zCuts, xCuts, fixes, capFixes, cols: [...new Set(fixes.map(f => f[0]))], rows: [...new Set(fixes.map(f => f[1]))] });
    L.cap = null;
    if (capRow != null) L.cap = { z0: Ztop, z1: capRow + rcb * SQ2 + Math.max(2, w), row: capRow };
    return L;
  }

  // ---------------------------------------------------------------- holes cut through the walls
  // Each hole is a solid: { at: 'body'|'cap', s } built with the Manifold helpers in K.
  function features(L, K) {
    const o = L.o, H = [], { cx0, cx1, cy0, cy1, zc0, Ztop, Wo, Do, baseT, backT, rcb, rh } = L, n = o.detail === 'hd' ? 64 : 32;
    // fixing holes: a through hole into the board and a pocket the bolt (or screw) head sits in, flush with the back
    const fix = (x, z, at) => {
      H.push({ at, s: K.alongY(teardrop(x, z, rh, n), -1, baseT + 0.01) });
      if (L.pocket > 0) H.push({ at, s: K.alongY(teardrop(x, z, rcb, n), baseT, backT + 0.01) });
    };
    for (const [x, z] of L.fixes) fix(x, z, 'body');
    if (L.cap) for (const [x, z] of L.capFixes) fix(x, z, 'cap');
    // openings on the faces (cable inlets, buttons, LEDs, displays, connectors), placed from the device's own edges
    for (const q of o.openings) {
      const w = q.w, h = q.h, c = o.clearance;
      if (q.face === 'left' || q.face === 'right') {
        const y = cy0 + c + (q.a == null ? o.devD / 2 : q.a), z = zc0 + c + (q.b == null ? o.devH / 2 : q.b);
        H.push({ at: 'body', s: q.face === 'left' ? K.alongX(wallShape(q.shape, y, z, w, h, n), -1, cx0 + 0.01) : K.alongX(wallShape(q.shape, y, z, w, h, n), cx1 - 0.01, Wo + 1) });
      } else if (q.face === 'front') {
        if (L.front === 'open') continue;
        const x = cx0 + c + (q.a == null ? o.devW / 2 : q.a), z = zc0 + c + (q.b == null ? o.devH / 2 : q.b);
        H.push({ at: 'body', s: K.alongY(wallShape(q.shape, x, z, w, h, n), cy1 - 0.01, Do + 1) });
      } else {
        const x = cx0 + c + (q.a == null ? o.devW / 2 : q.a), y = cy0 + c + (q.b == null ? o.devD / 2 : q.b), poly = flatShape(q.shape, x, y, w, h, n);
        if (q.face === 'bottom') { if (L.grid42) { L.warnings.push('Bottom openings are left off the 42 mm grid base.'); continue; } H.push({ at: 'body', s: K.alongZ(poly, -1, zc0 + 0.01) }); }
        else { if (!L.cap) { L.warnings.push('Top openings need the end cap (the top is open without it).'); continue; } H.push({ at: 'cap', s: K.alongZ(poly, Ztop - 1, Ztop + L.capT + 0.01) }); }
      }
    }
    // ventilation through both side walls (and the front when it is closed): vertical slots or pointy-top hexes
    if (o.vents !== 'none') {
      const s = 6, gap = 2.6, zA = zc0 + 6, zB = Ztop - 8, yA = cy0 + 3, yB = cy1 - 3, xA = cx0 + 5, xB = cx1 - 5;
      const grid = (a0, a1) => { // centers across a span and up the height
        const out = [];
        if (o.vents === 'slots') {
          const len = Math.min(30, zB - zA), pa = s + gap; if (len < 8 || a1 - a0 < s) return out;
          const na = Math.floor((a1 - a0 - s) / pa) + 1, u0 = (a0 + a1) / 2 - (na - 1) * pa / 2;
          const nz = Math.max(1, Math.floor((zB - zA + 4) / (len + 4))), z0 = (zA + zB) / 2 - (nz - 1) * (len + 4) / 2;
          for (let i = 0; i < na; i++) for (let j = 0; j < nz; j++) out.push(wallShape('slot', u0 + i * pa, z0 + j * (len + 4), s / 2 + 0.6, len, n / 2));
        } else {
          const R = s / Math.sqrt(3), pa = s + gap, pz = (s + gap) * Math.sqrt(3) / 2;
          if (a1 - a0 < s) return out;
          for (let j = 0, z = zA + R; z <= zB - R; j++, z += pz) { const off = j % 2 ? pa / 2 : 0; for (let u = a0 + s / 2 + off; u <= a1 - s / 2; u += pa) out.push(hexPointy(u, z, s)); }
        }
        return out;
      };
      const side = grid(yA, yB);
      if (side.length) { H.push({ at: 'body', s: K.alongXMany(side, -1, cx0 + 0.01) }); H.push({ at: 'body', s: K.alongXMany(side, cx1 - 0.01, Wo + 1) }); }
      if (L.front === 'closed') { const fr = grid(xA, xB); if (fr.length) H.push({ at: 'body', s: K.alongYMany(fr, cy1 - 0.01, Do + 1) }); }
    }
    // strap slots: a shallow groove across the back so the strap runs behind the device, out through both side walls
    // and around the front; groove and slots have 45\u00b0 tops so they print without support
    if (o.straps > 0) {
      const gd = Math.min(2, backT - 1.6), sw = o.strapW + 1, yb = backT - gd, yt = backT + 1.6;
      for (let i = 0; i < o.straps; i++) {
        const z = zc0 + L.ch * (i + 1) / (o.straps + 1), z0 = z - sw / 2, z1 = z + sw / 2;
        const slot = [[yb, z0], [yt, z0], [yt, z1], [(yb + yt) / 2, z1 + (yt - yb) / 2], [yb, z1]];
        H.push({ at: 'body', s: K.alongX(slot, -1, cx0 + 0.6) });
        H.push({ at: 'body', s: K.alongX(slot, cx1 - 0.6, Wo + 1) });
        H.push({ at: 'body', s: K.alongX([[yb, z0], [backT + 0.01, z0], [backT + 0.01, z1 + gd], [yb, z1]], cx0 - 0.01, cx1 + 0.01) });
      }
    }
    return H;
  }

  // Manifold helpers: every object made is tracked and freed after the build.
  function kit(M) {
    const all = [], k = x => { all.push(x); return x; };
    const cs = rings => k(new M.CrossSection(rings.map(ccw), 'NonZero'));
    const ext = (c, h) => k(M.Manifold.extrude(c, h));
    const Xm = [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1]; // column-major: (p, q, s) -> (x = s, y = p, z = q)
    const alongZ = (poly, z0, z1) => k(ext(cs([poly]), z1 - z0).translate([0, 0, z0]));
    const alongZPolys = (polys, z0, z1) => k(ext(k(new M.CrossSection(polys.flatMap(q => [ccw(q.outer), ...q.holes.map(h => ccw(h).slice().reverse())]), 'Positive')), z1 - z0).translate([0, 0, z0]));
    const alongX = (poly, x0, x1) => k(k(ext(cs([poly]), x1 - x0).transform(Xm)).translate([x0, 0, 0]));
    const alongY = (poly, y0, y1) => k(k(ext(cs([poly]), y1 - y0).rotate([90, 0, 0])).translate([0, y1, 0])); // (p, q, s) -> (p, -s, q)
    const many = list => k(M.CrossSection.union(list.map(q => cs([q]))));
    const alongXMany = (list, x0, x1) => k(k(ext(many(list), x1 - x0).transform(Xm)).translate([x0, 0, 0]));
    const alongYMany = (list, y0, y1) => k(k(ext(many(list), y1 - y0).rotate([90, 0, 0])).translate([0, y1, 0]));
    const union = a => { a = a.filter(Boolean); return !a.length ? null : a.length === 1 ? a[0] : k(M.Manifold.union(a)); };
    const sub = (a, b) => { const u = union(b); return u ? k(a.subtract(u)) : a; };
    const box = (x0, y0, z0, x1, y1, z1) => alongZ(rect(x0, y0, x1, y1), z0, z1);
    const fromSoup = p => { const { V, F } = Core.weld(p); const mm = new M.Mesh({ numProp: 3, vertProperties: Float32Array.from(V), triVerts: Uint32Array.from(F) }); mm.merge(); return k(new M.Manifold(mm)); };
    const soup = m => { const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float64Array(F.length * 3); for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; } return p; };
    const free = () => { for (const x of all) { try { x.delete(); } catch (e) {} } all.length = 0; };
    return { k, cs, alongZ, alongZPolys, alongX, alongY, alongXMany, alongYMany, union, sub, box, fromSoup, soup, free };
  }

  // ---------------------------------------------------------------- printed threaded bolt (prints head down, no support)
  function boltMesh(th, tc, boardT, baseT, detail) {
    // One surface of revolution, ring by ring (every ring has the same angles, so the mesh is closed by construction):
    // a hex socket for a hex key in the head face, a knurled head, a plain shank through the holster's back plate and
    // a helical thread that screws into the board. The head prints on the bed; the thread flanks are 45\u00b0 or steeper.
    const maj = th.major - 2 * tc, mn = th.minor - 2 * tc, Pt = th.pitch, dep = (maj - mn) / 2;
    const hr = th.head / 2, hh = th.headH, hex = th === THREADS.large ? 8 : 4, sock = Math.min(hh - 0.8, th === THREADS.large ? 2.4 : 2.0);
    const Lt = Math.max(3, boardT - 0.4), z2 = hh + baseT, z3 = z2 + Lt;
    const hd = detail === 'hd', N = hd ? 144 : 72, dz = hd ? 0.1 : 0.25;
    const ang = k => 2 * Math.PI * k / N;
    const kn = Math.round(hr * 2.2);
    const headR = (k, inset) => hr - inset - 0.3 * (0.5 - 0.5 * Math.cos(kn * ang(k)));
    const hexR = k => { const a = (hex + 0.15) / 2, t = ((ang(k) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6; return a / Math.cos(t); };
    const g = u => u < 0.15 ? 0 : u < 0.4 ? (u - 0.15) / 0.25 : u < 0.6 ? 1 : u < 0.85 ? (0.85 - u) / 0.25 : 0;
    const rings = []; // [z, k => r]
    rings.push([sock, hexR], [0, hexR], [0, k => headR(k, 0.4)], [0.4, k => headR(k, 0)], [hh, k => headR(k, 0)], [hh, () => maj / 2], [z2, () => maj / 2]);
    const n = Math.ceil(Lt / dz);
    for (let i = 1; i <= n; i++) {
      const z = z2 + Lt * i / n, rmax = maj / 2 - Math.max(0, z - (z3 - 0.9));
      rings.push([z, k => { let u = ((z - z2) / Pt - k / N) % 1; if (u < 0) u += 1; return Math.max(mn / 2 - 0.35, Math.min(rmax, mn / 2 + dep * g(u))); }]);
    }
    const V = rings.map(([z, f]) => { const L = []; for (let k = 0; k < N; k++) { const r = f(k); L.push([r * Math.cos(ang(k)), r * Math.sin(ang(k)), z]); } return L; });
    const out = [];
    const tri = (a, b, c) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const c0 = [0, 0, sock], c1 = [0, 0, z3];
    for (let k = 0; k < N; k++) tri(c0, V[0][(k + 1) % N], V[0][k]);
    for (let i = 0; i + 1 < V.length; i++) for (let k = 0; k < N; k++) {
      const a = V[i][k], b = V[i][(k + 1) % N], c = V[i + 1][(k + 1) % N], d = V[i + 1][k];
      tri(a, b, c); tri(a, c, d);
    }
    const last = V[V.length - 1];
    for (let k = 0; k < N; k++) tri(c1, last[k], last[(k + 1) % N]);
    let p = Float64Array.from(out);
    if (Core.signedVolume(p) < 0) p = Core.flip(p);
    return { p, length: z3, threadLen: Lt, major: maj, minor: mn, hex };
  }

  // The board side of the same thread: a cutter (nominal size, the bolt is made smaller by its clearance) for a
  // threaded hole through a board from z0 to z1, with a small lead-in chamfer at both faces. Same profile as the bolt.
  function threadCutter(th, z0, z1, detail) {
    const maj = th.major, mn = th.minor, Pt = th.pitch, dep = (maj - mn) / 2;
    const hd = detail === 'hd', N = hd ? (th === THREADS.large ? 96 : 48) : (th === THREADS.large ? 64 : 32), dz = hd ? 0.25 : 0.4;
    const ang = k => 2 * Math.PI * k / N;
    const g = u => u < 0.15 ? 0 : u < 0.4 ? (u - 0.15) / 0.25 : u < 0.6 ? 1 : u < 0.85 ? (0.85 - u) / 0.25 : 0;
    const e = 0.6, n = Math.max(2, Math.ceil((z1 - z0 + 2 * e) / dz)), V = [];
    for (let i = 0; i <= n; i++) {
      const z = z0 - e + (z1 - z0 + 2 * e) * i / n, ch = maj / 2 + 0.5 - Math.min(Math.abs(z - z0), Math.abs(z - z1)), L = [];
      for (let k = 0; k < N; k++) { let u = (z / Pt - k / N) % 1; if (u < 0) u += 1; const r = Math.max(mn / 2 + dep * g(u), ch); L.push([r * Math.cos(ang(k)), r * Math.sin(ang(k)), z]); }
      V.push(L);
    }
    const out = [], tri = (a, b, c) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const c0 = [0, 0, V[0][0][2]], c1 = [0, 0, V[n][0][2]];
    for (let k = 0; k < N; k++) tri(c0, V[0][(k + 1) % N], V[0][k]);
    for (let i = 0; i < n; i++) for (let k = 0; k < N; k++) { const a = V[i][k], b = V[i][(k + 1) % N], c = V[i + 1][(k + 1) % N], d = V[i + 1][k]; tri(a, b, c); tri(a, c, d); }
    for (let k = 0; k < N; k++) tri(c1, V[n][k], V[n][(k + 1) % N]);
    let p = Float64Array.from(out);
    if (Core.signedVolume(p) < 0) p = Core.flip(p);
    return p;
  }

  // ---------------------------------------------------------------- build
  const move = (p, dx, dy, dz) => PL ? PL.move(p, dx, dy, dz) : (() => { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + dz; } return q; })();
  function boltPlace(p, x, y0, z) { // bolt axis (local +z, head at 0) along -y, head top at y0, center at (x, z)
    const q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { q[i] = x + p[i]; q[i + 1] = y0 - p[i + 2]; q[i + 2] = z + p[i + 1]; }
    return q;
  }

  function build(raw, M) {
    if (!M) throw new Error('The holster needs the 3D engine.');
    const o = options(raw), L = layout(o), K = kit(M), warnings = L.warnings;
    try {
      const Hs = features(L, K), parts = [];
      const bodyCol = o.colors.body, boltCol = o.colors.bolts, B = L.B;
      const { outer, cx0, cx1, cy0, cy1, zc0, Ztop, rc, Wo, Do, lip } = L;
      // body: outer shell minus the device pocket, the front window and every hole
      let body = K.alongZPolys(outer, L.grid42 ? zc0 - 0.6 : 0, Ztop);
      const cut = [K.alongZ(rr4(cx0, cy0, cx1, cy1, [rc, rc, rc, rc]), zc0, Ztop + 1)];
      if (L.front === 'open') cut.push(K.box(cx0, cy1 - Math.max(rc, 0.05), zc0, cx1, Do + 1, Ztop + 1));
      else if (L.front === 'partial') cut.push(K.box(cx0 + lip, cy1 - 0.5, zc0 + lip, cx1 - lip, Do + 1, Ztop + 1));
      for (const h of Hs) if (h.at === 'body') cut.push(h.s);
      body = K.sub(body, cut);
      if (L.grid42) {
        let base = o.gridBaseMesh;
        if (!base) { const BFm = BF(); if (!BFm) throw new Error('The 42 mm grid base is not available here.'); base = BFm.gridBaseSolid(L.grid.nx, L.grid.ny, GRID42_TOP, {}); }
        body = K.union([K.fromSoup(Float64Array.from(base)), body]);
      }
      // end cap: an end plate over the device's top, then a short back plate and side walls that bolt to the board
      let cap = null;
      if (L.cap) {
        cap = K.alongZPolys(outer, L.cap.z0, L.cap.z1);
        const cc = [K.box(cx0, L.backT, L.cap.z0 + L.capT, cx1, Do + 1, L.cap.z1 + 1)];
        for (const h of Hs) if (h.at === 'cap') cc.push(h.s);
        cap = K.sub(cap, cc);
      }
      const zCuts = L.zCuts, xCuts = L.xCuts;
      const nZ = zCuts.length - 1, nX = xCuts.length - 1;
      const piece = (m, xa, xb, za, zb) => (nZ * nX === 1 && za <= 0 && zb >= Ztop) || !m ? m : K.k(m.intersect(K.box(xa === 0 ? -5 : xa, -5, za <= 0 ? -5 : za, xb >= Wo ? Wo + 5 : xb, Do + 5, zb >= Ztop ? Ztop + 5 : zb)));
      for (let i = 0; i < nZ; i++) for (let j = 0; j < nX; j++) {
        const za = zCuts[i], zb = zCuts[i + 1], xa = xCuts[j], xb = xCuts[j + 1];
        const m = nZ * nX === 1 ? body : piece(body, xa, xb, za, zb), mesh = K.soup(m);
        if (!mesh.length) continue;
        const name = nZ * nX === 1 ? 'Holster' : `Holster section ${i * nX + j + 1}`;
        parts.push({ name, kind: 'body', color: bodyCol, assembled: mesh, local: PL.normalize(mesh) });
      }
      if (nZ > 1) warnings.push(`Split into ${nZ} sections along the height to fit your printer; each section bolts to the board on its own.`);
      if (nX > 1) warnings.push(`Split into ${nX} sections across the width to fit your printer; each section bolts to the board on its own.`);
      if (cap) for (let j = 0; j < nX; j++) {
        const xa = xCuts[j], xb = xCuts[j + 1];
        const m = nX === 1 ? cap : K.k(cap.intersect(K.box(xa === 0 ? -5 : xa, -5, L.cap.z0 - 5, xb >= Wo ? Wo + 5 : xb, Do + 5, L.cap.z1 + 5))), mesh = K.soup(m);
        if (!mesh.length) continue;
        parts.push({ name: nX > 1 ? `End cap ${j + 1}` : 'End cap', kind: 'cap', color: bodyCol, assembled: mesh, local: PL.normalize(mesh) });
      }
      // bolts (identical; each one is its own object so the slicer can lay them out)
      let bolt = null, nb = 0;
      const holes = [];
      L.fixes.forEach(f => holes.push(f)); if (L.cap) L.capFixes.forEach(f => holes.push(f));
      if (L.th) {
        bolt = boltMesh(L.th, o.threadClear, o.boardT, L.baseT, o.detail);
        holes.forEach(([x, z], i) => { nb++; parts.push({ name: `Bolt ${i + 1}`, kind: 'bolt', color: boltCol, assembled: boltPlace(bolt.p, x, L.backT - 0.2, z), local: bolt.p }); });
      }
      // the device itself, for the preview only
      if (o.device) {
        const c = o.clearance;
        const dev = K.soup(K.alongZ(rr4(cx0 + c, cy0 + c, cx1 - c, cy1 - c, [o.devR, o.devR, o.devR, o.devR]), zc0 + c, zc0 + c + o.devH));
        parts.push({ name: 'Device (preview)', kind: 'device', color: '#C9D1D8', assembled: dev, local: dev, preview: true });
      }
      // the preview faces the viewer: turned half a turn about z so the front (not the board side) is toward the camera
      for (const pt of parts) { const a = pt.assembled, q = new Float64Array(a.length); for (let i = 0; i < a.length; i += 3) { q[i] = Wo - a[i]; q[i + 1] = Do - a[i + 1]; q[i + 2] = a[i + 2]; } pt.assembled = q; pt.p = q; }
      const printable = parts.filter(p => !p.preview);
      const all = T.concat(printable.map(p => p.assembled));
      const totalH = L.cap ? L.cap.z1 : Ztop;
      if (o.material === 'pla') warnings.push(MATERIALS.pla.note);
      if (L.grid42) warnings.push('The 42 mm grid base is a desk or drawer dock: it holds the device upright. For a case that flips over, use the 25 mm grid or screws.');
      if (o.retain === 'none' && !L.grid42 && !o.straps) warnings.push('With an open top the device can slide out when the holster is upside down. Add the end cap or straps for a case that flips over.');
      const filaments = [{ role: 'body', color: bodyCol }]; if (nb) filaments.push({ role: 'bolts', color: boltCol });
      return {
        parts, options: Object.assign({}, o, { gridBaseMesh: null }), warnings, filaments,
        layout: { cols: L.cols, rows: L.rows, cap: L.cap, zCuts: L.zCuts, xCuts: L.xCuts, backT: L.backT, baseT: L.baseT, Wo, Do, Ztop, zc0, cx0, cy0, cw: L.cw, cd: L.cd, ch: L.ch, lip, front: L.front, holes, grid: L.grid ? { nx: L.grid.nx, ny: L.grid.ny } : null },
        bolt: bolt ? { length: bolt.length, threadLen: bolt.threadLen, major: bolt.major, minor: bolt.minor, pitch: L.th.pitch, head: L.th.head, hex: bolt.hex } : null,
        stats: {
          outerW: +Wo.toFixed(1), outerD: +Do.toFixed(1), outerH: +totalH.toFixed(1), bolts: nb, screws: L.screws ? holes.length : 0,
          fixings: holes.length, sections: printable.filter(p => p.kind !== 'bolt').length, pieces: printable.length, mount: o.mount, front: L.front, retain: o.retain,
          tris: all.length / 9, colors: filaments.length
        },
        plate: all
      };
    } finally { K.free(); }
  }

  function gateInfo() { return []; } // the holster is free: every mount, front and extra

  function arrangePlates(res) {
    const B = usable(res.options.bed);
    return PL.arrange(res.parts.filter(p => !p.preview).map(pt => ({ name: pt.name, p: pt.local, color: pt.color })), B.w, B.d, { gap: 5, maxZ: B.z });
  }
  function export3MF(res, o) {
    o = o || {};
    const cols = [];
    res.parts.filter(p => !p.preview).forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const ext = c => cols.indexOf((c || '').toUpperCase()) + 1;
    const A = arrangePlates(res);
    const objs = [], plates = [];
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, p: it.p, color: it.color, extruder: ext(it.color) }); }); plates.push(ids); });
    A.unfit.forEach(u => { plates.push([objs.length]); objs.push({ name: u.name, p: PL.normalize(u.p), color: u.color, extruder: ext(u.color) }); });
    return T.threeMF(objs, { title: o.name || 'Device holster', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const o = res.options, s = res.stats, Ly = res.layout, f = v => (+v).toFixed(1).replace(/\.0$/, '');
    const L = [
      'Expressarte device holster',
      `Device: ${f(o.devW)} \u00d7 ${f(o.devH)} \u00d7 ${f(o.devD)} mm (width \u00d7 height \u00d7 depth), corner radius ${f(o.devR)} mm, ${f(o.clearance)} mm clearance per side`,
      `Holster outside: ${f(s.outerW)} \u00d7 ${f(s.outerH)} mm on the board, ${f(s.outerD)} mm deep \u00b7 ${FRONTS[Ly.front]} \u00b7 ${RETAINS[o.retain]}`,
      `Mount: ${MOUNTS[o.mount]}` + (s.fixings ? ` \u00b7 ${s.fixings} ${o.mount === 'screws' ? 'screws' : 'bolts'}` : ''),
      '', 'Filaments'
    ];
    res.filaments.forEach((x, i) => L.push(`  ${i + 1}: ${x.color}  ${x.role}`));
    L.push('', 'Printing',
      `  - Material: ${MATERIALS[o.material].label}. ${MATERIALS[o.material].note}`,
      '  - Print the holster and end cap standing on their ends as exported: no supports needed. A brim helps tall parts.',
      '  - 3+ walls (perimeters) and 25%+ infill make the mounts strong.');
    if (res.bolt) L.push(`  - Bolts print head down: ${f(res.bolt.major)} mm thread, ${f(res.bolt.pitch)} mm pitch, ${f(res.bolt.threadLen)} mm long. Use 100% infill or 5 walls for the bolts.`);
    L.push('', 'Mounting');
    if (o.mount === 'grid25' || o.mount === 'grid25big') {
      L.push(`  1. Hold the holster on the board so its holes line up with the board's ${o.mount === 'grid25big' ? 'big' : 'small'} holes (they sit on the 25 mm grid).`,
        `  2. Screw a bolt through each hole into the board with a ${res.bolt ? f(res.bolt.hex) : 4} mm hex key until the head sits flush.`,
        '  3. Slide the device in from the top.' + (Ly.cap ? ' Put the end cap on and bolt it to the board above.' : ''));
    } else if (o.mount === 'screws') {
      L.push(`  1. Mark the ${s.fixings} holes on the wall or desk and drive #8 or ${f(o.screwD)} mm pan-head screws (wall plugs in drywall).`,
        '  2. Slide the device in from the top.' + (Ly.cap ? ' Screw the end cap on above it.' : ''));
    } else L.push('  1. Drop the holster into a 42 mm grid baseplate and stand the device in it.');
    if (o.straps) L.push(`  - Strap slots: thread a ${Math.round(o.strapW)} mm hook-and-loop strap behind the device, out through both sides and around the front.`);
    (res.warnings || []).forEach(w => L.push('  - ' + w));
    return L.join('\n');
  }
  function files(res, o) {
    o = o || {};
    const base = o.fileBase || 'device_holster', out = [];
    const slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    const bolts = res.parts.filter(p => p.kind === 'bolt');
    for (const pt of res.parts) { if (pt.preview || pt.kind === 'bolt') continue; out.push({ name: `${base}_${slug(pt.name)}.stl`, data: new Uint8Array(Core.writeSTL(pt.local, pt.name)) }); }
    if (bolts.length) out.push({ name: `${base}_bolt_print_${bolts.length}.stl`, data: new Uint8Array(Core.writeSTL(bolts[0].local, 'bolt')) });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }

  const api = { THREADS, MATERIALS, FRONTS, RETAINS, MOUNTS, FACES, SHAPES, VENTS, DEFAULTS, PALETTE, GRID_PITCH, options, layout, build, boltMesh, threadCutter, export3MF, files, notes, gateInfo, arrangePlates, teardrop, wallShape, GRID42_TOP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPHolster = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
