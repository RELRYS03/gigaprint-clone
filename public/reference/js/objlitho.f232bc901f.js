/* Expressarte object lithophanes: a photo on a hollow 3D object (a ball, the moon, an egg, a heart, a gem...) that glows
   with the picture when a light shines inside. Thin plastic lets more light through, so the wall follows the photo:
   dark parts print thick and light parts thin. Light embossed details (seams, stitches, craters, dimples, pips) change
   the wall a little more, so they show too.
   Shape: every object is an inside test around a center it is star-shaped from. The outer skin is found along rays
   from that center on a latitude/longitude grid (the last exit, so the skin is always one radial sheet), scaled to the
   chosen size; the inner skin sits inward along the same rays by the local thickness (divided by the slope, so the
   wall is the right thickness across the surface and never folds). Both skins are closed, so the shell is a valid solid.
   Opening (Manifold): the shell is cut flat at the bottom where the wall is no steeper than about 55 degrees and the cut
   is wide enough, a solid floor ring is added there with the light hole in it, so the object prints upright on the
   floor ring with no supports. Too tall for the printer: horizontal bands with pin holes for 1.75 mm filament pins.
   Optional stand: a round pedestal with a seat that matches the floor ring, a pocket for the light and a cable notch.
   World frame (assembled): z = 0 is the table, the front faces -y. Generic names only. American spelling. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const LS = G.GPLampshade || (typeof require === 'function' ? require('./lampshade.js') : null);
  const TAU = Math.PI * 2, PI = Math.PI;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------------------------------------------------------------- surface details (unit direction d -> -1..1)
  // seam curve of a two-piece ball (on the unit sphere exactly)
  function seamCurve(b) {
    const a = 1 - b, c = 2 * Math.sqrt(a * b), N = 1440, P = new Float64Array(N * 3), Tn = new Float64Array(N * 3);
    for (let k = 0; k < N; k++) {
      const t = k / N * TAU;
      P[k * 3] = a * Math.cos(t) + b * Math.cos(3 * t); P[k * 3 + 1] = a * Math.sin(t) - b * Math.sin(3 * t); P[k * 3 + 2] = c * Math.sin(2 * t);
      const tx = -a * Math.sin(t) - 3 * b * Math.sin(3 * t), ty = a * Math.cos(t) - 3 * b * Math.cos(3 * t), tz = 2 * c * Math.cos(2 * t), l = Math.hypot(tx, ty, tz);
      Tn[k * 3] = tx / l; Tn[k * 3 + 1] = ty / l; Tn[k * 3 + 2] = tz / l;
    }
    const near = d => { // nearest curve sample: index, distance (chord), signed side
      let best = 0, bd = 9;
      for (let k = 0; k < N; k += 8) { const dx = d[0] - P[k * 3], dy = d[1] - P[k * 3 + 1], dz = d[2] - P[k * 3 + 2], q = dx * dx + dy * dy + dz * dz; if (q < bd) { bd = q; best = k; } }
      const k0 = best; for (let j = -8; j <= 8; j++) { const k = (k0 + j + N) % N, dx = d[0] - P[k * 3], dy = d[1] - P[k * 3 + 1], dz = d[2] - P[k * 3 + 2], q = dx * dx + dy * dy + dz * dz; if (q < bd) { bd = q; best = k; } }
      const p = [P[best * 3], P[best * 3 + 1], P[best * 3 + 2]], tn = [Tn[best * 3], Tn[best * 3 + 1], Tn[best * 3 + 2]], side = dot(d, cross(p, tn));
      return { k: best, t: best / N, dist: Math.sqrt(bd), side };
    };
    return near;
  }
  const SEAM = { ball: null };
  function seam() { return SEAM.ball || (SEAM.ball = seamCurve(0.28)); }
  function stitched(d, n, w, s0, s1) { // a narrow seam groove with slanted stitches on both sides (a V pattern)
    const q = seam()(d); let v = q.dist < w ? -1 : 0;
    const a = Math.abs(q.side); if (a > s0 && a < s1) { const ph = (q.t * n + (a - s0) / (s1 - s0) * 0.45) % 1; if (ph < 0.34) v = 1; }
    return v;
  }
  // truncated icosahedron (soccer ball): 12 pentagons and 20 hexagons (faces with their plane distances), its 60
  // vertices and 90 edges (unit directions), for the seams, the stitches and the dark pentagons
  const SOCCER = (() => {
    const p = (1 + Math.sqrt(5)) / 2, V = [];
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) { V.push([0, s1, s2 * p]); V.push([s1, s2 * p, 0]); V.push([s2 * p, 0, s1]); }
    const E = []; for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) { const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]); if (Math.abs(d - 2) < 1e-6) E.push([i, j]); }
    const adj = (a, b) => E.some(x => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a));
    const F = []; for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) { if (adj(i, j) && adj(j, k) && adj(i, k)) F.push([i, j, k]); }
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const faces = [];
    for (let i = 0; i < 12; i++) { const n = norm3(V[i]), j = E.find(x => x[0] === i || x[1] === i), o = j[0] === i ? j[1] : j[0]; faces.push({ n, h: dot(lerp(V[i], V[o], 1 / 3), n), pent: true }); }
    for (const f of F) { const c = [0, 1, 2].map(a => (V[f[0]][a] + V[f[1]][a] + V[f[2]][a]) / 3), n = norm3(c); faces.push({ n, h: dot(lerp(V[f[0]], V[f[1]], 1 / 3), n), pent: false }); }
    // vertices: a third of the way along each icosahedron edge, from each end
    const pts = [], key = new Map(), at = (i, o) => { const k = i + ',' + o; if (!key.has(k)) { key.set(k, pts.length); pts.push(norm3(lerp(V[i], V[o], 1 / 3))); } return key.get(k); };
    const edges = [];
    for (const [i, j] of E) edges.push([at(i, j), at(j, i)]); // the hexagon-hexagon edges
    for (let i = 0; i < 12; i++) { const nb = E.filter(x => x[0] === i || x[1] === i).map(x => x[0] === i ? x[1] : x[0]); for (let a = 0; a < nb.length; a++) for (let b = a + 1; b < nb.length; b++) if (adj(nb[a], nb[b])) edges.push([at(i, nb[a]), at(i, nb[b])]); }
    // each pentagon's corners in order around it
    const pents = [];
    for (let i = 0; i < 12; i++) { const n = norm3(V[i]), nb = E.filter(x => x[0] === i || x[1] === i).map(x => x[0] === i ? x[1] : x[0]); const u = norm3(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), w = cross(n, u); const cs = nb.map(o => at(i, o)).sort((a, b) => Math.atan2(dot(pts[a], w), dot(pts[a], u)) - Math.atan2(dot(pts[b], w), dot(pts[b], u))); pents.push({ n, corners: cs }); }
    return { faces, pts, edges, pents };
  })();
  // the nearest seam: angular distance to it (radians, about) and the position along it
  function soccerSeam(d) {
    let i1 = 0, i2 = 0, s1 = -9, s2 = -9; const Fc = SOCCER.faces;
    for (let k = 0; k < Fc.length; k++) { const f = Fc[k], s = (d[0] * f.n[0] + d[1] * f.n[1] + d[2] * f.n[2]) / f.h; if (s > s1) { s2 = s1; i2 = i1; s1 = s; i1 = k; } else if (s > s2) { s2 = s; i2 = k; } }
    const a = Fc[i1], b = Fc[i2], m = [a.n[0] / a.h - b.n[0] / b.h, a.n[1] / a.h - b.n[1] / b.h, a.n[2] / a.h - b.n[2] / b.h], ml = Math.hypot(m[0], m[1], m[2]) || 1;
    const e = norm3(cross(a.n, b.n));
    return { dist: (s1 - s2) / ml, along: dot(d, e), face: i1, pent: a.pent };
  }
  // the panels puff out a little between the seams (a real ball's look); the seam groove and the stitches thin and
  // thicken the wall, so they show as fine lines and dashes when it is lit. sc: mm per unit (stitches are sized in mm)
  function soccerRad(d) { const q = soccerSeam(d); return 1 - 0.011 * Math.exp(-Math.pow(q.dist / 0.05, 2)); }
  function soccer(d, p, sc, o) {
    const q = soccerSeam(d), dm = q.dist * sc, am = q.along * sc;
    let v = -sstep(0.72, 0.32, dm); // the seam
    if (!(o && o.stitchPart) && dm > 0.6 && dm < 2.1) { const c = Math.cos(TAU * am / 2.5); v = Math.max(v, 0.75 * sstep(-0.05, 0.35, c) * sstep(0.6, 0.85, dm) * sstep(2.1, 1.8, dm)); } // stitches across the seam
    return v;
  }
  // golf ball dimples on a Fibonacci lattice, binned by height
  const GOLF = (() => {
    const N = 332, ga = PI * (3 - Math.sqrt(5)), pts = [], bins = Array.from({ length: 40 }, () => []);
    for (let k = 0; k < N; k++) { const z = 1 - 2 * (k + 0.5) / N, r = Math.sqrt(1 - z * z), a = k * ga; const p = [r * Math.cos(a), r * Math.sin(a), z]; pts.push(p); bins[Math.min(39, Math.floor((z + 1) / 2 * 40))].push(p); }
    return { bins, r: 0.56 * Math.sqrt(4 * PI / N) };
  })();
  function golf(d) {
    const b = Math.min(39, Math.floor((d[2] + 1) / 2 * 40)); let bd = 9;
    for (let j = Math.max(0, b - 3); j <= Math.min(39, b + 3); j++) for (const p of GOLF.bins[j]) { const dx = d[0] - p[0], dy = d[1] - p[1], dz = d[2] - p[2], q = dx * dx + dy * dy + dz * dz; if (q < bd) bd = q; }
    const x = Math.sqrt(bd) / GOLF.r; return x < 1 ? -(1 - x * x) : 0;
  }
  const MOON = (() => { const R = rng(7), out = []; for (let k = 0; k < 70; k++) { const z = 2 * R() - 1, a = R() * TAU, r = Math.sqrt(1 - z * z); out.push({ c: [r * Math.cos(a), r * Math.sin(a), z], r: 0.035 + 0.2 * Math.pow(R(), 2.6) }); } const maria = []; for (let k = 0; k < 6; k++) { const z = 1.4 * R() - 0.7, a = R() * TAU, r = Math.sqrt(1 - z * z); maria.push({ c: [r * Math.cos(a), r * Math.sin(a), z], r: 0.3 + 0.25 * R() }); } return { out, maria }; })();
  function moon(d) {
    let v = 0;
    for (const m of MOON.maria) { const q = Math.acos(clamp(dot(d, m.c), -1, 1)) / m.r; if (q < 1.4) v += 0.35 * (1 - sstep(0.7, 1.4, q)); }
    for (const c of MOON.out) { const q = Math.acos(clamp(dot(d, c.c), -1, 1)) / c.r; if (q < 1.5) { if (q < 1) v -= 1 - q * q; v += 0.45 * Math.exp(-Math.pow((q - 1) / 0.16, 2)); } }
    return clamp(v, -1, 1);
  }
  // rough continents (longitude, latitude) for the globe: land is raised (darker), the oceans glow
  const LAND = [
    [[-168, 66], [-140, 70], [-95, 72], [-80, 63], [-60, 55], [-66, 45], [-75, 35], [-81, 25], [-97, 26], [-105, 20], [-90, 15], [-83, 9], [-78, 8], [-95, 17], [-110, 23], [-117, 33], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 60]],
    [[-55, 60], [-45, 60], [-20, 70], [-20, 80], [-60, 82], [-72, 78], [-55, 70]],
    [[-80, 10], [-62, 11], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-72, -50], [-71, -30], [-76, -14], [-81, -5]],
    [[-10, 36], [-9, 43], [-2, 48], [-5, 58], [5, 62], [15, 70], [30, 71], [60, 70], [80, 73], [110, 77], [140, 72], [180, 68], [180, 65], [160, 60], [140, 55], [135, 43], [128, 35], [122, 30], [120, 22], [108, 20], [105, 10], [100, 13], [98, 8], [92, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 25], [50, 30], [48, 28], [56, 25], [59, 22], [52, 16], [43, 13], [35, 30], [28, 37], [26, 41], [20, 40], [15, 38], [12, 44], [5, 43], [-5, 36]],
    [[-17, 21], [-6, 35], [10, 37], [32, 31], [35, 28], [43, 12], [51, 12], [40, -2], [40, -15], [35, -25], [20, -35], [17, -29], [12, -17], [13, -5], [9, 4], [-8, 4], [-17, 14]],
    [[114, -22], [130, -12], [142, -11], [146, -19], [153, -28], [150, -37], [140, -38], [132, -32], [115, -34]],
    [[-6, 50], [2, 51], [-2, 58], [-6, 58]], [[44, -13], [50, -15], [47, -25], [44, -22]], [[130, 31], [141, 36], [142, 45], [139, 40]],
    [[95, 5], [105, -6], [115, -8], [120, -9], [118, 1], [110, 2]], [[172, -35], [178, -38], [170, -46], [166, -46]]
  ];
  function inPoly(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function globe(d) {
    const lat = Math.asin(clamp(d[2], -1, 1)) * 180 / PI, lon = Math.atan2(d[0], -d[1]) * 180 / PI; // longitude 0 faces the front
    if (lat < -68) return 1;
    for (const P of LAND) if (inPoly(P, lon, lat)) return 1;
    const g = Math.min(Math.abs(((lat + 90) % 30) - 15) - 14.6, Math.abs((((lon + 180) % 30) + 30) % 30 - 15) * Math.cos(lat * PI / 180) - 14.6);
    return g > 0 ? -0.5 : 0;
  }
  function basketball(d) {
    const w = 0.022, x = d[0], y = d[1], z = d[2];
    if (Math.abs(x) < w || Math.abs(z) < w) return -1;
    if (Math.abs(Math.abs(y) - (0.62 - 0.38 * x * x)) < w * 1.1) return -1;
    return 0;
  }
  function volleyball(d) {
    const a = d.map(Math.abs); const k = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
    const s = [...a].sort((p, q) => q - p); if (s[0] - s[1] < 0.02) return -1; // the cube-face seams
    const u = d[(k + 1) % 3] / a[k]; // the strips run one way on each face, turning face to face
    if (Math.abs(Math.abs(u) - 1 / 3) < 0.025) return -1;
    return 0;
  }
  function tennis(d) { const q = seam()(d); return -sstep(0.05, 0.02, q.dist); }
  // American football: a lemon profile (two circular arcs) with pointed ends; length 2, widest 1.2 (a real ball's 0.6)
  const FB_B = 0.6, FB_R = (1 + FB_B * FB_B) / (2 * FB_B);
  function fbRad(a) { a = Math.abs(a); if (a >= 1) return 0; const l = Math.sqrt(FB_R * FB_R - a * a) - (FB_R - FB_B); return l <= 0 ? 0 : FB_B * Math.pow(l / FB_B, 0.9); }
  // four panels: seams along the top (under the laces), the front, the bottom and the back, pressed in lightly
  const FB_LACE = { half: 0.33, n: 8, arc: 0.11, wC: 4.6, hC: 1.7, wX: 3.4, hX: 1.9 };
  const FB_BADGE = { x: 0.6, th: 0.95, au: 0.17, av: 0.12, ring: 0.82 }; // the oval badge on the end panel (front, upper side, right end)
  function football(d, p, sc) {
    const rho = Math.hypot(p[1], p[2]), th = Math.atan2(p[2], -p[1]); let v = 0;
    for (const a0 of [0, PI / 2, PI, -PI / 2]) { let da = Math.abs(th - a0); if (da > PI) da = TAU - da; const w = da * rho * sc; v = Math.min(v, -0.45 * sstep(0.65, 0.25, w)); }
    return v;
  }
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const DICE_FACE = [[0, 1, 6], [0, -1, 1], [1, 1, 2], [1, -1, 5], [2, 1, 3], [2, -1, 4]]; // axis, sign, pips (opposite faces add to 7)
  function dice(d, p, q) { // q: the point in the cube's own frame
    const a = q.map(Math.abs), k = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2, sg = q[k] > 0 ? 1 : -1;
    const f = DICE_FACE.find(x => x[0] === k && x[1] === sg); if (!f || f[2] === 1 && false) return 0;
    const u = q[(k + 1) % 3] / a[k], v = q[(k + 2) % 3] / a[k];
    for (const pp of PIPS[f[2]]) { const r = Math.hypot(u - pp[0] * 0.5, v - pp[1] * 0.5) / 0.16; if (r < 1) return -(1 - r * r * r * r); }
    return 0;
  }
  const SPOTS = (() => { const R = rng(11), out = []; for (let k = 0; k < 14; k++) { const z = 0.35 + 0.6 * R(), a = R() * TAU, r = Math.sqrt(1 - z * z); out.push({ c: [r * Math.cos(a), r * Math.sin(a), z], r: 0.1 + 0.08 * R() }); } return out; })();
  function mushroom(d, p) { if (p[2] < 0.2) return 0; const dn = norm3([p[0], p[1], (p[2] - 0.12) * 1.2]); for (const s of SPOTS) { const q = Math.acos(clamp(dot(dn, s.c), -1, 1)) / s.r; if (q < 1) return -(1 - q * q); } return 0; }
  function snowman(d, p) {
    const head = p[2] > 0.95, c = head ? [0, 0, 1.35] : [0, 0, 0], dn = norm3([p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
    const dotAt = (cx, cz, r) => { const t = norm3([cx, -Math.sqrt(Math.max(0, 1 - cx * cx - cz * cz)), cz]), q = Math.acos(clamp(dot(dn, t), -1, 1)) / r; return q < 1 ? 1 - q * q : 0; };
    if (head) return Math.max(dotAt(-0.32, 0.25, 0.1), dotAt(0.32, 0.25, 0.1), dotAt(0, -0.05, 0.12), Math.abs(p[2] - 1.05) < 0.07 ? 1 : 0);
    return Math.max(dotAt(0, 0.62, 0.09), dotAt(0, 0.3, 0.09), dotAt(0, -0.02, 0.09));
  }
  function puck(d, p) { return Math.abs(p[2]) < 0.09 && Math.hypot(p[0], p[1]) > 0.95 ? (Math.cos(Math.atan2(p[1], p[0]) * 90) > 0.2 ? 1 : 0) : 0; }
  function bulbBase(d, p) { if (p[2] > -0.62) return 0; const th = Math.atan2(p[1], p[0]); return (((p[2] * 9 + th / TAU) % 1) + 1) % 1 < 0.35 ? -1 : 0; }

  // ---------------------------------------------------------------- objects (inside tests in their own units)
  const sph = (p, r) => p[0] * p[0] + p[1] * p[1] + p[2] * p[2] < r * r;
  const STAR_OUT = (() => { const P = []; for (let k = 0; k < 10; k++) { const a = PI / 2 + k * PI / 5, r = k % 2 ? 0.45 : 1; P.push([r * Math.cos(a), r * Math.sin(a)]); } P[5] = [0, Math.sin(PI / 2 + 4 * PI / 5) * 1]; return P; })(); // the bottom notch filled: it stands on a flat edge
  const STAR_RHO = (() => { const N = 1024, out = new Float64Array(N); for (let k = 0; k < N; k++) { const a = k / N * TAU, dx = Math.cos(a), dy = Math.sin(a); let best = 0; for (let i = 0; i < 10; i++) { const p = STAR_OUT[i], q = STAR_OUT[(i + 1) % 10], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue; const t = (p[0] * ey - p[1] * ex) / den, u = (p[0] * dy - p[1] * dx) / den; if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.max(best, t); } out[k] = best; } return out; })();
  const rhoStar = a => { const N = STAR_RHO.length, x = (((a / TAU) % 1) + 1) % 1 * N, i = Math.floor(x) % N, f = x - Math.floor(x); return STAR_RHO[i] * (1 - f) + STAR_RHO[(i + 1) % N] * f; };
  const GEM = (() => { const pl = []; const crownA = 34.5 * PI / 180, pavA = 40.75 * PI / 180;
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + PI / 8; pl.push([Math.cos(a) * Math.sin(crownA), Math.sin(a) * Math.sin(crownA), Math.cos(crownA), Math.sin(crownA)]); pl.push([Math.cos(a) * Math.sin(pavA), Math.sin(a) * Math.sin(pavA), -Math.cos(pavA), Math.sin(pavA)]); }
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8, b = 44 * PI / 180, c = 22 * PI / 180; pl.push([Math.cos(a) * Math.sin(b), Math.sin(a) * Math.sin(b), -Math.cos(b), Math.sin(b) * 1.004]); pl.push([Math.cos(a) * Math.sin(c), Math.sin(a) * Math.sin(c), Math.cos(c), Math.sin(c) * 1.03]); }
    for (let k = 0; k < 16; k++) { const a = k * TAU / 16; pl.push([Math.cos(a), Math.sin(a), 0, 1]); }
    pl.push([0, 0, 1, 0.3]); return pl; })();
  const R3 = (() => { const z = norm3([1, 1, 1]), x = norm3(cross([0, 0, 1], z)), y = cross(z, x); return [x, y, z]; })(); // the cube stands on a corner
  const OBJECTS = {
    soccer: { label: 'Soccer ball', size: 120, inside: p => { const l = Math.hypot(p[0], p[1], p[2]); return l < 1e-9 || l < soccerRad([p[0] / l, p[1] / l, p[2] / l]); }, rad: soccerRad, ext: 1.05, detail: soccer, sample: 'field', ball: 'soccer' },
    football: { label: 'American football', size: 170, inside: p => Math.hypot(p[1], p[2]) < fbRad(p[0]), ext: 1.05, detail: football, sample: 'city', ball: 'football', standMin: 0.27 },
    baseball: { label: 'Baseball', size: 90, inside: p => sph(p, 1), rad: () => 1, ext: 1.05, detail: d => stitched(d, 54, 0.012, 0.022, 0.07) },
    softball: { label: 'Softball', size: 110, inside: p => sph(p, 1), rad: () => 1, ext: 1.05, detail: d => stitched(d, 44, 0.014, 0.025, 0.085) },
    basketball: { label: 'Basketball', size: 120, inside: p => sph(p, 1), rad: () => 1, ext: 1.05, detail: basketball },
    volleyball: { label: 'Volleyball', size: 115, inside: p => sph(p, 1), rad: () => 1, ext: 1.05, detail: volleyball },
    tennis: { label: 'Tennis ball', size: 90, inside: p => sph(p, 1), rad: () => 1, ext: 1.05, detail: tennis },
    golf: { label: 'Golf ball', size: 90, inside: p => sph(p, 1), rad: () => 1, ext: 1.05, detail: golf },
    moon: { label: 'Moon', size: 120, inside: p => sph(p, 1), rad: () => 1, ext: 1.05, detail: moon, free: true },
    globe: { label: 'Globe', size: 120, inside: p => sph(p, 1), rad: () => 1, ext: 1.05, detail: globe },
    puck: { label: 'Hockey puck', size: 100, inside: p => { const r = Math.hypot(p[0], p[1]), h = 0.33, e = 0.06; if (Math.abs(p[2]) > h || r > 1) return false; const dz = Math.abs(p[2]) - (h - e), dr = r - (1 - e); return !(dz > 0 && dr > 0 && dz * dz + dr * dr > e * e); }, ext: 1.1, detail: puck, flat: true },
    egg: { label: 'Egg', size: 110, inside: p => { if (Math.abs(p[2]) >= 1) return false; const rr = 0.74 * Math.sqrt(1 - p[2] * p[2]) * (1 - 0.13 * p[2]); return Math.hypot(p[0], p[1]) < rr; }, ext: 1.05, free: true },
    heart: { label: 'Heart', opening: 'usb', size: 120, photo: 'front', inside: p => { const x = p[0] * 1.15, y = p[1] / 0.62, z = p[2] * 1.15 + 0.12, a = x * x + 2.25 * y * y + z * z - 1; return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z < 0; }, ext: 1.4 },
    star: { label: 'Star', opening: 'usb', size: 130, photo: 'front', inside: p => { const a = Math.atan2(p[2], p[0]), rho = Math.hypot(p[0], p[2]), s = rho / rhoStar(a); if (s >= 1) return false; return Math.abs(p[1]) < 0.36 * Math.pow(1 - Math.pow(s, 2.6), 1 / 2.6) + 0.02; }, ext: 1.1 },
    ornament: { label: 'Ornament ball', size: 70, photo: 'faces', ornament: true, inside: p => sph(p, 1), rad: () => 1, ext: 1.05 },
    bulb: { label: 'Christmas bulb', opening: 'e12', size: 140, inside: p => { const r = Math.hypot(p[0], p[1]), z = p[2]; if (z < -1 || z > 1) return false; if (z < -0.6) return r < 0.3; const t = (z + 0.6) / 1.6, body = t < 0.38 ? 0.3 + 0.3 * Math.sin(t / 0.38 * PI / 2) : 0.6 * Math.pow(Math.max(0, Math.cos((t - 0.38) / 0.62 * PI / 2)), 0.8); return r < body; }, ext: 1.1, detail: bulbBase },
    pumpkin: { label: 'Pumpkin', size: 120, inside: p => { const r = Math.hypot(p[0], p[1]), th = Math.atan2(p[1], p[0]); if (p[2] > 0.55 && p[2] < 0.95) { const sx = p[0] - 0.08 * (p[2] - 0.55), sr = Math.hypot(sx, p[1]); if (sr < 0.11) return true; } const k = 1 - 0.09 * Math.pow(Math.abs(Math.sin(th * 5)), 0.6) * (1 - 0.0 * p[2]); const q = Math.hypot(r / (1.0 * k), (p[2] + (r < 0.3 ? 0.12 * (1 - r / 0.3) * Math.sign(p[2]) : 0)) / 0.72); return q < 1; }, ext: 1.1 },
    apple: { label: 'Apple', size: 110, inside: p => { const r = Math.hypot(p[0], p[1]); if (p[2] > 0.6 && p[2] < 1.05 && Math.hypot(p[0] - 0.12 * (p[2] - 0.6), p[1]) < 0.055) return true; const d = Math.hypot(r, p[2]); if (d < 1e-6) return true; const top = Math.acos(clamp(p[2] / d, -1, 1)), lobe = 1 + 0.04 * Math.cos(5 * Math.atan2(p[1], p[0])) * sstep(1.6, 2.8, top); const R = (1 - 0.28 * Math.exp(-Math.pow(top / 0.42, 2)) - 0.12 * Math.exp(-Math.pow((PI - top) / 0.35, 2))) * (0.95 + 0.07 * Math.sin(top)) * lobe; return d < R; }, ext: 1.15 },
    gem: { label: 'Gem', opening: 'usb', size: 120, inside: p => { for (const q of GEM) if (p[0] * q[0] + p[1] * q[1] + p[2] * q[2] > q[3]) return false; return true; }, ext: 1.1, flat: true, center: [0, 0, -0.1] },
    dice: { label: 'Dice cube', opening: 'usb', size: 110, inside: p => { const q = [dot(p, R3[0]), dot(p, R3[1]), dot(p, R3[2])]; const c = [q[0], q[1], q[2]]; return Math.pow(Math.abs(c[0]), 10) + Math.pow(Math.abs(c[1]), 10) + Math.pow(Math.abs(c[2]), 10) < 1; }, ext: 1.8, cube: true, detail: (d, p) => dice(d, p, [dot(p, R3[0]), dot(p, R3[1]), dot(p, R3[2])].map((v, i, a) => v)) },
    pyramid: { label: 'Pyramid', size: 120, inside: p => { const z = p[2] + 0.35; if (z < 0 || z > 1.3) return false; const w = 1 - z / 1.3; return Math.max(Math.abs(p[0]), Math.abs(p[1])) < w; }, ext: 1.5 },
    cylinder: { label: 'Cylinder', size: 120, inside: p => { const r = Math.hypot(p[0], p[1]), e = 0.18; if (Math.abs(p[2]) > 1 || r > 0.75) return false; const dz = Math.abs(p[2]) - (1 - e), dr = r - (0.75 - e); return !(dz > 0 && dr > 0 && dz * dz + dr * dr > e * e); }, ext: 1.3, flat: true },
    dome: { label: 'Dome', size: 120, inside: p => p[2] > -0.45 && sph([p[0], p[1], p[2] + 0.45], 1), ext: 1.1 },
    mushroom: { label: 'Mushroom', opening: 'usb', size: 120, inside: p => { const r = Math.hypot(p[0], p[1]); if (p[2] > 0.05 && Math.hypot(r, (p[2] - 0.05) / 0.72) < 1 && p[2] > 0.05 + 0.18 * (1 - r * r) * 0 ) return true; return p[2] > -0.95 && p[2] <= 0.12 && r < 0.36 + 0.05 * Math.pow(Math.max(0, -p[2]), 2); }, ext: 1.1, detail: mushroom, center: [0, 0, 0.08] },
    snowman: { label: 'Snowman', size: 140, inside: p => sph(p, 1) || sph([p[0], p[1], p[2] - 1.35], 0.66), ext: 2.1, detail: snowman, center: [0, 0, 0.88] },
    pear: { label: 'Pear', opening: 'e12', size: 120, inside: p => { const r = Math.hypot(p[0], p[1]), z = p[2]; if (z > 0.95 && z < 1.25 && Math.hypot(p[0] - 0.1 * (z - 0.95), p[1]) < 0.05) return true; if (z < -1 || z > 1) return false; const t = (z + 1) / 2, rr = 0.72 * Math.sqrt(Math.max(0, Math.sin(PI * t))) * (1 - 0.48 * sstep(0.35, 0.85, t)) + 0.0; return r < rr; }, ext: 1.3 }
  };
  const OBJ_KEYS = Object.keys(OBJECTS);
  const LIGHTS = {
    puck: { label: 'LED puck light', d: 50 },
    tealight: { label: 'LED tea light', d: 40 },
    e12: { label: 'E12 candelabra bulb', d: 30 },
    usb: { label: 'USB LED', d: 20 }
  };
  // common LED puck lights (battery tap lights and USB pucks): diameter and height in mm
  const PUCKS = [{ d: 60, h: 20 }, { d: 65, h: 22 }, { d: 70, h: 26 }, { d: 76, h: 31 }];
  const puckH = d => { let b = PUCKS[0]; for (const p of PUCKS) if (Math.abs(p.d - d) < Math.abs(b.d - d)) b = p; return b.h; };
  // Christmas light bulbs the ornament slips over. C7/C9 diameters follow the C-series size code
  // (eighths of an inch): C7 = 7/8 in = 22.23 mm, C9 = 9/8 in = 28.58 mm (1000Bulbs, Christmas Light Source).
  // Screw bases are IEC 60061-1: C7 uses E12 (12 mm), C9 uses E17 (17 mm).
  // G12 LED "raspberry" globes are 12 mm across (The Christmas Light Emporium; Holiday LED Lights lists 11.8 \u00d7 13.5 mm).
  // Mini T5 / 5 mm wide-angle: the LED lens is 5 mm by definition. Battery fairy lights are commonly 3\u20135 mm; this preset is 5 mm.
  // hole is a snug friction fit (about 0.4 mm under the bulb, or slightly over a 5 mm lens so it clears) with flexible tabs.
  const BULBS = {
    c9: { label: 'C9 bulb', bulbD: 28.58, length: 57.2, base: 17, hole: 28.2, fingers: 6 },
    c7: { label: 'C7 bulb', bulbD: 22.23, length: 38.1, base: 12, hole: 21.8, fingers: 6 },
    mini: { label: 'Mini lights (T5 / 5 mm wide-angle LED)', bulbD: 5, length: 8, base: 0, hole: 5.4, fingers: 4 },
    g12: { label: 'G12 globe', bulbD: 12, length: 13.5, base: 0, hole: 11.6, fingers: 5 },
    fairy: { label: 'Battery fairy light', bulbD: 5, length: 6, base: 0, hole: 5, fingers: 4 },
    custom: { label: 'Custom size (mm)', bulbD: 0, length: 0, base: 0, hole: 16, fingers: 6 }
  };
  const BULB_NOTE = {
    c9: 'The opening is 28.2 mm, a snug fit on a C9 bulb (28.58 mm / 1 1/8 in across, the C-series size code). The E17 screw base is 17 mm. Flexible tabs grip the bulb so it stays on the string. You can also unscrew the bulb, slip the ornament over the socket, and screw the bulb back in.',
    c7: 'The opening is 21.8 mm, a snug fit on a C7 bulb (22.23 mm / 7/8 in across, the C-series size code). The E12 screw base is 12 mm. Flexible tabs grip the bulb so it stays on the string. You can also unscrew the bulb, slip the ornament over the socket, and screw the bulb back in.',
    mini: 'The opening is 5.4 mm, sized to a 5 mm wide-angle (T5) LED lens. If the socket body is wider than that, type that measurement as a custom size.',
    g12: 'The opening is 11.6 mm, a snug fit on a G12 globe (12 mm across; LED raspberry globes are specified in millimeters).',
    fairy: 'The opening is 5 mm, a common size for a battery fairy-light LED (many are 3 to 5 mm). Measure your bulb at its widest point and type a custom size if it differs.',
    custom: 'Type the width of your bulb at its widest point, in millimeters. Make it a little under that width if you want a tighter grip; the flexible tabs will flex over the bulb.'
  };
  const PALETTE = LS ? LS.PALETTE : [{ name: 'White PLA', hex: '#F4F1EA' }];
  const DEFAULTS = {
    shape: 'moon', size: 0, image: null, brightness: 0, contrast: 0, gamma: 1, invert: false, photo: '', fit: 'cover', zoom: 100, offX: 0, offY: 0, turn: 0, frontDeg: 150,
    tMin: 0.8, tMax: 3, plainT: 1.6, detailDepth: 0.7, detailPct: 100, light: '', opening: 0, stand: true, standLight: 70, puckD: 0, puckH: 0, notch: '', cableNotch: true, cradle: true, split: 'auto',
    repeat: 'auto', laces: true, badge: false, badgeImage: null, pentagons: false, stitchPart: false, tone: 'light',
    detail: 'hd', preview: false, colors: { object: '#F4F1EA', stand: '#1B1613', trim: '#1A1A1A', panels: '#1A1A1A' }, bed: [256, 256, 256], bambu: 'A1'
  };
  const CELL = { hd: 0.5, standard: 0.8, preview: 1.05 }, CAP = { hd: 230000, standard: 120000, preview: 52000 };
  const num = (v, d, lo, hi) => { v = +v; return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
  function options(raw) {
    const r = Object.assign({}, DEFAULTS, raw || {}), o = {};
    o.shape = OBJECTS[r.shape] ? r.shape : 'moon'; const ob = OBJECTS[o.shape];
    o.size = num(r.size || ob.size, ob.size, 50, 300);
    o.image = r.image && r.image.gray ? r.image : null;
    o.brightness = num(r.brightness, 0, -100, 100); o.contrast = num(r.contrast, 0, -100, 200); o.gamma = num(r.gamma, 1, 0.3, 3); o.invert = !!r.invert;
    o.photo = ['front', 'around', 'faces'].includes(r.photo) ? r.photo : (ob.photo || 'around');
    o.fit = ['cover', 'contain', 'stretch'].includes(r.fit) ? r.fit : 'cover'; o.zoom = num(r.zoom, 100, 50, 400); o.offX = num(r.offX, 0, -100, 100); o.offY = num(r.offY, 0, -100, 100);
    o.turn = num(r.turn, 0, -180, 180); o.frontDeg = num(r.frontDeg, 150, 60, 180);
    o.tMin = num(r.tMin, 0.8, 0.4, 2.5); o.tMax = Math.max(o.tMin + 0.4, num(r.tMax, 3, 1, 5)); o.plainT = num(r.plainT, 1.6, 0.4, 5);
    o.detailPct = num(r.detailPct, 100, 0, 200); o.detailDepth = num(r.detailDepth, 0.7, 0, 2) * o.detailPct / 100;
    o.images = Array.isArray(r.images) ? r.images.filter(im => im && im.gray) : null;
    if (!o.image && o.images && o.images[0]) o.image = o.images[0];
    if (!o.images) o.images = o.image ? [o.image] : [];
    o.caption = String(r.caption || r.text || '').trim().slice(0, 40);
    o.captionImage = r.captionImage && r.captionImage.gray ? r.captionImage : null;
    o.pattern = ['dots', 'stars', 'snowflakes', 'none'].includes(r.pattern) ? r.pattern : (ob.ornament ? 'dots' : 'none');
    o.loop = r.loop !== false; o.fingers = r.fingers !== false;
    if (ob.ornament) {
      o.size = num(r.size || ob.size, ob.size, 50, 100);
      o.light = BULBS[r.light] ? r.light : 'c7';
      o.openingAuto = !(+r.opening > 0);
      o.opening = o.openingAuto ? BULBS[o.light].hole : num(r.opening, BULBS[o.light].hole, 3.5, 40);
      o.stand = false;
      if (!['front', 'around', 'faces'].includes(r.photo)) o.photo = 'faces';
    } else {
      o.light = LIGHTS[r.light] ? r.light : 'puck';
      o.openingAuto = !(+r.opening > 0); o.opening = o.openingAuto ? LIGHTS[o.light].d : num(r.opening, LIGHTS[o.light].d, 10, 120);
      o.stand = !!r.stand;
    }
    o.puckD = num(+r.puckD || r.standLight, 70, 30, 120); o.standLight = o.puckD; o.puckH = num(+r.puckH || puckH(o.puckD), puckH(o.puckD), 8, 45);
    o.notch = ['cable', 'wide', 'none'].includes(r.notch) ? r.notch : (r.cableNotch === false ? 'none' : 'cable'); o.cableNotch = o.notch !== 'none'; o.cradle = r.cradle !== false;
    o.laces = ob.ball === 'football' && r.laces !== false; o.badge = ob.ball === 'football' && !!r.badge; o.badgeImage = o.badge && r.badgeImage && r.badgeImage.gray ? r.badgeImage : null;
    o.pentagons = ob.ball === 'soccer' && !!r.pentagons; o.stitchPart = ob.ball === 'soccer' && !!r.stitchPart; o.tone = r.tone === 'linear' ? 'linear' : 'light'; o.repeat = ['1', '2'].includes(String(r.repeat)) ? String(r.repeat) : 'auto';
    o.split = ['auto', '1', '2', '3', '4'].includes(String(r.split)) ? String(r.split) : 'auto';
    o.detail = r.detail === 'standard' ? 'standard' : 'hd'; o.preview = !!r.preview;
    o.colors = Object.assign({}, DEFAULTS.colors, r.colors || {});
    const bed = Array.isArray(r.bed) ? r.bed : DEFAULTS.bed; o.bed = [0, 1, 2].map(a => num(bed[a], 256, 60, 2000)); o.bambu = r.bambu || 'A1';
    o.fit2 = o.fit; o.border = 0; o.overlay = null; // the photo mapper's frame and text: not used here
    return o;
  }

  // a Fibonacci lattice on the unit sphere (for dots, stars and snowflakes that do not bunch at the poles)
  function fiboDirs(n) {
    const pts = [], ga = PI * (3 - Math.sqrt(5));
    for (let k = 0; k < n; k++) { const z = 1 - 2 * (k + 0.5) / n, r = Math.sqrt(Math.max(0, 1 - z * z)), a = k * ga; pts.push([r * Math.cos(a), r * Math.sin(a), z]); }
    return pts;
  }
  const PAT_DOTS = fiboDirs(96), PAT_STARS = fiboDirs(28), PAT_FLAKES = fiboDirs(22);
  const patHash = p => { const s = Math.abs(Math.sin(p[0] * 127.1 + p[1] * 311.7 + p[2] * 74.7) * 43758.5453); return s - Math.floor(s); };
  function star2d(x, y, r) { // 5-pointed star, 1 at the center, 0 outside
    const rho = Math.hypot(x, y); if (rho > r || r < 1e-6) return 0;
    let a = Math.atan2(y, x); if (a < 0) a += TAU;
    const sec = TAU / 10, u = (a + sec / 2) % (2 * sec), w = Math.abs(u - sec) / sec, R = r * (0.4 + 0.6 * (1 - w));
    if (rho > R) return 0; return 1 - rho / R;
  }
  function flake2d(x, y, r) { // 6-fold snowflake
    const rho = Math.hypot(x, y); if (rho > r || r < 1e-6) return 0;
    const a = Math.atan2(y, x), arm = Math.abs(((a / (PI / 3)) % 1 + 1) % 1 - 0.5) * 2;
    const w = Math.exp(-Math.pow(arm * 5.5, 2)) * (1 - rho / r);
    const ring = Math.exp(-Math.pow((rho / r - 0.58) * 9, 2)) * 0.55;
    const hub = rho < r * 0.16 ? 1 : Math.max(0, 1 - (rho / r - 0.16) / 0.1);
    return clamp(w + ring + hub * 0.85, 0, 1);
  }
  function patternAt(d, kind) {
    if (!kind || kind === 'none') return 0;
    if (d[2] < -0.78) return 0; // leave the cap (print floor, hanging top) solid
    const list = kind === 'stars' ? PAT_STARS : kind === 'snowflakes' ? PAT_FLAKES : PAT_DOTS;
    let best = 0;
    for (const p of list) {
      if (p[2] < -0.8) continue;
      const c = Math.acos(clamp(dot(d, p), -1, 1));
      const h = patHash(p);
      if (kind === 'dots') { const rad = 0.032 + 0.04 * h; if (c < rad) best = Math.max(best, Math.pow(1 - c / rad, 1.4)); }
      else if (kind === 'stars') {
        const rad = 0.11 + 0.05 * h; if (c >= rad) continue;
        const east = norm3(cross([0, 0, 1], Math.abs(p[2]) > 0.95 ? [1, 0, 0] : p)), north = cross(p, east);
        best = Math.max(best, star2d(dot(d, east), dot(d, north), Math.sin(rad)));
      } else {
        const rad = 0.13 + 0.05 * h; if (c >= rad) continue;
        const east = norm3(cross([0, 0, 1], Math.abs(p[2]) > 0.95 ? [1, 0, 0] : p)), north = cross(p, east);
        best = Math.max(best, flake2d(dot(d, east), dot(d, north), Math.sin(rad)));
      }
    }
    return best;
  }
  function faceSetup(o) {
    const imgs = o.images && o.images.length ? o.images : (o.image ? [o.image] : []);
    const nF = imgs.length, rad0 = 38 * PI / 180, rad = nF > 1 ? Math.min(rad0, PI / nF * 0.86) : rad0;
    const turn = (o.turn || 0) * PI / 180;
    const centers = imgs.map((_, i) => { const th = turn + i * TAU / Math.max(1, nF) - PI / 2; return [Math.cos(th), Math.sin(th), 0]; });
    const pms = imgs.map(im => LS.photoMapper(Object.assign({}, o, { fit: o.fit || 'cover' }), 1, 1, im, false));
    const cap = o.captionImage && o.captionImage.gray ? LS.photoMapper(Object.assign({}, o, { fit: 'contain', zoom: 100, offX: 0, offY: 0, brightness: 0, contrast: 0, gamma: 1, invert: false, overlay: null, border: 0 }), 1, 1, o.captionImage, false) : null;
    return { pms, tm: toneMap(o), rad, centers, cap };
  }
  function faceThickness(FT, o, x, y, z, C) {
    const d = norm3([x, y, z - C[2]]);
    for (let i = 0; i < FT.centers.length; i++) {
      const c = FT.centers[i], ang = Math.acos(clamp(dot(d, c), -1, 1));
      if (ang > FT.rad * 1.06) continue;
      const east = norm3(cross([0, 0, 1], c)), north = cross(c, east), s = Math.sin(FT.rad) || 1;
      const u = 0.5 + dot(d, east) / s / 2, v = 0.5 + dot(d, north) / s / 2, q = ang / FT.rad;
      if (q <= 1 && FT.pms[i]) {
        const raw = FT.pms[i](clamp(u, 0, 1), clamp(v, 0, 1));
        if (raw >= 0) { const w = q > 0.86 ? sstep(1, 0.86, q) : 1, tone = FT.tm(raw); return tone * w + o.plainT * (1 - w); }
      }
    }
    if (FT.cap) {
      const lat = Math.asin(clamp(d[2], -1, 1));
      if (lat > 0.32 && lat < 0.88) {
        const u0 = ((Math.atan2(d[1], d[0]) + PI / 2) / TAU + 1) % 1, v = (lat - 0.32) / 0.56;
        if (u0 > 0.28 && u0 < 0.72) { const raw = FT.cap((u0 - 0.28) / 0.44, v); if (raw >= 0) return FT.tm(raw); }
      }
    }
    const pat = patternAt(d, o.pattern);
    if (pat > 0) return o.plainT - (o.plainT - o.tMin) * pat;
    return -1;
  }

  function usable(o) { return { w: Math.max(50, o.bed[0] - 8), d: Math.max(50, o.bed[1] - 8), z: Math.max(30, o.bed[2] - 4) }; }
  function fits(sz, U) { return ((sz[0] <= U.w && sz[1] <= U.d) || (sz[0] <= U.d && sz[1] <= U.w)) && sz[2] <= U.z; }

  // ---------------------------------------------------------------- the radial skin
  function radius(ob, d) { // the last exit along the ray from the center
    if (ob.rad) return ob.rad(d);
    const c = ob.center || [0, 0, 0], ext = ob.ext, n = 200, st = ext / n;
    const at = r => ob.inside([c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r]);
    let r = ext; while (r > 0 && !at(r)) r -= st;
    if (r <= 0) return st;
    let lo = r, hi = Math.min(ext, r + st); for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; if (at(m)) lo = m; else hi = m; }
    return lo;
  }
  function grid(o, cellOverride) {
    const ob = OBJECTS[o.shape], c = ob.center || [0, 0, 0];
    // a coarse pass for the size, then the fine grid
    const dirOf = (i, j, NU, NV) => { const ph = PI * j / NV, th = TAU * i / NU, s = Math.sin(ph); return [s * Math.cos(th), s * Math.sin(th), -Math.cos(ph)]; };
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let j = 0; j <= 48; j++) for (let i = 0; i < 96; i++) { const d = dirOf(i, j, 96, 48), r = radius(ob, d); for (let a = 0; a < 3; a++) { const v = c[a] + d[a] * r; lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v); } }
    const ext = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], sc = o.size / Math.max(ext[0], ext[1], ext[2]);
    const rMax = Math.max(...[0, 1, 2].map(a => Math.max(Math.abs(hi[a] - c[a]), Math.abs(lo[a] - c[a])))) * sc;
    let cell = cellOverride || CELL[o.preview ? 'preview' : o.detail];
    let NU = Math.max(64, Math.ceil(TAU * rMax / cell)), NV = Math.max(32, Math.ceil(PI * rMax / cell));
    const cap = CAP[o.preview ? 'preview' : o.detail]; if (NU * NV > cap) { const k = Math.sqrt(NU * NV / cap); NU = Math.max(64, Math.ceil(NU / k)); NV = Math.max(32, Math.ceil(NV / k)); cell *= k; }
    NU = Math.ceil(NU / 4) * 4;
    // rows 0..NV (0 = bottom pole), columns 0..NU-1; poles repeat a single direction
    const N = (NV + 1) * NU, D = new Float32Array(N * 3), R = new Float32Array(N), Q = new Float32Array(N * 3);
    for (let j = 0; j <= NV; j++) for (let i = 0; i < NU; i++) {
      const n = j * NU + i; let d;
      if ((j === 0 || j === NV) && i > 0) { D[n * 3] = D[j * NU * 3]; D[n * 3 + 1] = D[j * NU * 3 + 1]; D[n * 3 + 2] = D[j * NU * 3 + 2]; R[n] = R[j * NU]; continue; }
      d = dirOf(i, j, NU, NV); D[n * 3] = d[0]; D[n * 3 + 1] = d[1]; D[n * 3 + 2] = d[2]; R[n] = radius(ob, d) * sc;
    }
    // the object center in mm; z of the frame is shifted later so the cut sits on the table
    const C = [c[0] * sc, c[1] * sc, c[2] * sc];
    for (let n = 0; n < N; n++) for (let a = 0; a < 3; a++) Q[n * 3 + a] = C[a] + D[n * 3 + a] * R[n];
    return { ob, NU, NV, N, D, R, Q, C, sc, cell, center: c };
  }
  // the outward normal of the plain skin at each node
  function normals(Gd) {
    const { NU, NV, Q, D } = Gd, Nn = new Float32Array(Gd.N * 3);
    for (let j = 0; j <= NV; j++) for (let i = 0; i < NU; i++) {
      const n = j * NU + i;
      if (j === 0 || j === NV) { Nn[n * 3] = D[n * 3]; Nn[n * 3 + 1] = D[n * 3 + 1]; Nn[n * 3 + 2] = D[n * 3 + 2]; continue; }
      const a = (j * NU + (i + 1) % NU) * 3, b = (j * NU + (i + NU - 1) % NU) * 3, u = ((j + 1) * NU + i) * 3, w = ((j - 1) * NU + i) * 3;
      const e = [Q[a] - Q[b], Q[a + 1] - Q[b + 1], Q[a + 2] - Q[b + 2]], f = [Q[u] - Q[w], Q[u + 1] - Q[w + 1], Q[u + 2] - Q[w + 2]];
      let v = norm3(cross(e, f)); if (v[0] * D[n * 3] + v[1] * D[n * 3 + 1] + v[2] * D[n * 3 + 2] < 0) v = [-v[0], -v[1], -v[2]];
      Nn[n * 3] = v[0]; Nn[n * 3 + 1] = v[1]; Nn[n * 3 + 2] = v[2];
    }
    return Nn;
  }
  // where to cut the bottom: no wall steeper than about 55 degrees above it, and wide enough for the floor ring
  function cutPlan(o, Gd, Nn) {
    const { NU, NV, Q, N } = Gd; let zmin = 1e9, zmax = -1e9;
    for (let n = 0; n < N; n++) { zmin = Math.min(zmin, Q[n * 3 + 2]); zmax = Math.max(zmax, Q[n * 3 + 2]); }
    const H = zmax - zmin, lim = zmin + (Gd.ob.cutMax || 0.45) * H, steep = -Math.sin(55 * PI / 180);
    let zOh = zmin + 0.6, steepAbove = 0;
    for (let n = 0; n < N; n++) { const z = Q[n * 3 + 2]; if (Nn[n * 3 + 2] < steep) { if (z <= lim) zOh = Math.max(zOh, z + 0.3); } }
    // the narrowest horizontal reach of the skin at height z (along each column, the first crossing from the bottom)
    const reach = z => {
      let m = 1e9;
      for (let i = 0; i < NU; i++) {
        let got = false;
        for (let j = 0; j < NV; j++) { const a = (j * NU + i) * 3, b = ((j + 1) * NU + i) * 3, za = Q[a + 2], zb = Q[b + 2]; if ((za - z) * (zb - z) <= 0 && za !== zb) { const t = (z - za) / (zb - za); m = Math.min(m, Math.hypot(Q[a] + (Q[b] - Q[a]) * t - Gd.C[0], Q[a + 1] + (Q[b + 1] - Q[a + 1]) * t - Gd.C[1])); got = true; break; } }
        if (!got) return 0;
      }
      return m;
    };
    const need = o.opening / 2 + 3.2; let zc = zOh, wide = true;
    while (reach(zc) < need) { zc += 0.5; if (zc > lim) { zc = Math.max(zOh, lim); wide = false; break; } }
    for (let n = 0; n < N; n++) if (Q[n * 3 + 2] > zc + 1 && Nn[n * 3 + 2] < steep - 0.05) steepAbove++;
    return { zc, zmin, zmax, H, wide, steepAbove: steepAbove / N, reach: reach(zc), reachAt: reach };
  }
  // the light opening that fits each object and its light: as wide as the base allows a little above the lowest
  // cut that prints without supports (a floor ring of at least 3.2 mm stays), no wider than the light's glow
  function autoOpening(o, Gd, Nn) {
    const lo = cutPlan(Object.assign({}, o, { opening: 16 }), Gd, Nn), cap = o.light === 'puck' ? o.puckD - 8 : o.light === 'tealight' ? 40 : o.light === 'e12' ? 34 : 22;
    let ex = 0, ey = 0; for (let n = 0; n < Gd.N; n++) { ex = Math.max(ex, Math.abs(Gd.Q[n * 3] - Gd.C[0])); ey = Math.max(ey, Math.abs(Gd.Q[n * 3 + 1] - Gd.C[1])); }
    const r = lo.reachAt(lo.zc + 0.03 * lo.H), narrow = 2 * Math.min(ex, ey);
    return clamp(Math.floor(2 * (r - 3.6)), 16, Math.max(16, Math.min(56, cap, Math.round(0.42 * narrow))));
  }
  // light through white plastic falls off about exp(-mu t): this picks the wall so the light that comes through
  // follows the photo's brightness (its gamma undone), not the thickness
  const MU = 1.0;
  function toneMap(o) {
    if (o.tone === 'linear') return t => t;
    const span = o.tMax - o.tMin, Tl = Math.exp(-MU * o.tMin), Td = Math.exp(-MU * o.tMax);
    return t => { const L = clamp((o.tMax - t) / span, 0, 1), T = Td + (Tl - Td) * Math.pow(L, 2.2); return clamp(-Math.log(T) / MU, o.tMin, o.tMax); };
  }
  // the wall thickness at every node: the photo (all around, or one side), the embossed details, solid bands at the
  // cuts. All around, the photo follows the surface: across by the distance around each row, up by the distance along
  // each column (so it does not stretch on long or pointed objects), and its two ends cross-fade at the back (no seam).
  function thickness(o, Gd, Nn, cut, cuts, zPhoto) {
    const { NU, NV, Q, D, N, C } = Gd, ob = Gd.ob, Tn = new Float32Array(N), E = new Float32Array(N);
    const zc = cut.zc, z0 = Math.max(zc, zPhoto == null ? zc : zPhoto), top = cut.zmax, ph = Math.max(1, top - z0);
    let rEq = 0; for (let n = 0; n < N; n++) rEq = Math.max(rEq, Math.hypot(Q[n * 3] - C[0], Q[n * 3 + 1] - C[1]));
    const tr = o.turn * PI / 180, ct = Math.cos(tr), st = Math.sin(tr);
    let xmin = 1e9, xmax = -1e9; for (let n = 0; n < N; n++) { const x = (Q[n * 3] - C[0]) * ct + (Q[n * 3 + 1] - C[1]) * st; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); }
    const around = o.photo === 'around', dist = (a, b) => Math.hypot(Q[a * 3] - Q[b * 3], Q[a * 3 + 1] - Q[b * 3 + 1], Q[a * 3 + 2] - Q[b * 3 + 2]);
    let reps = 1, U = null, regionW = xmax - xmin, regionH = ph; const FADE = 0.07;
    if (around) {
      // the horizontal outline at each height, from the columns (each column lies in one vertical half-plane), so the
      // photo runs around the object level, as seen from the side: across by the distance around that outline, up by
      // the height. Vertical lines stay vertical and nothing converges on long or pointed objects.
      const NZ = 240, zl = k => z0 + (top - z0) * k / (NZ - 1), RH = new Float32Array(NZ * NU);
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
        const a = j * NU + i, b = (j + 1) * NU + i, za = Q[a * 3 + 2], zb = Q[b * 3 + 2], lo = Math.min(za, zb), hi = Math.max(za, zb);
        if (hi < z0 || hi - lo < 1e-9) continue;
        const k0 = Math.max(0, Math.ceil((lo - z0) / (top - z0) * (NZ - 1))), k1 = Math.min(NZ - 1, Math.floor((hi - z0) / (top - z0) * (NZ - 1)));
        for (let k = k0; k <= k1; k++) { const t = (zl(k) - za) / (zb - za), x = Q[a * 3] + (Q[b * 3] - Q[a * 3]) * t - C[0], y = Q[a * 3 + 1] + (Q[b * 3 + 1] - Q[a * 3 + 1]) * t - C[1], r = Math.hypot(x, y); if (r > RH[k * NU + i]) RH[k * NU + i] = r; }
      }
      const SU = new Float32Array(NZ * (NU + 1)), PZ = new Float32Array(NZ), back = (((PI / 2 + tr) / TAU) % 1 + 1) % 1 * NU, BK = new Float32Array(NZ);
      for (let k = 0; k < NZ; k++) {
        let s = 0, px = 0, py = 0; for (let i = 0; i <= NU; i++) { const ii = i % NU, th = TAU * ii / NU, r = RH[k * NU + ii], x = r * Math.cos(th), y = r * Math.sin(th); if (i > 0) s += Math.hypot(x - px, y - py); SU[k * (NU + 1) + i] = s; px = x; py = y; }
        PZ[k] = s; const i0 = Math.floor(back), f = back - i0; BK[k] = SU[k * (NU + 1) + i0] * (1 - f) + SU[k * (NU + 1) + i0 + 1] * f;
      }
      U = new Float32Array(N); let wMax = 0; for (let k = 0; k < NZ; k++) wMax = Math.max(wMax, PZ[k]);
      for (let j = 1; j < NV; j++) for (let i = 0; i < NU; i++) {
        const n = j * NU + i, z = Q[n * 3 + 2]; if (z < z0) continue;
        const kf = clamp((z - z0) / (top - z0) * (NZ - 1), 0, NZ - 1), k = Math.min(NZ - 2, Math.floor(kf)), f = kf - k;
        const uAt = kk => PZ[kk] > 1e-6 ? (SU[kk * (NU + 1) + i] - BK[kk]) / PZ[kk] : i / NU;
        let ua = uAt(k), ub = uAt(k + 1); ua -= Math.floor(ua); ub -= Math.floor(ub); if (Math.abs(ua - ub) > 0.5) ub += ua > ub ? 1 : -1;
        let u = ua * (1 - f) + ub * f; u -= Math.floor(u); U[n] = u;
      }
      reps = o.repeat === 'auto' ? (wMax / Math.max(1, ph) > 3.2 ? 2 : 1) : +o.repeat; regionW = wMax / reps * (1 + FADE); regionH = ph;
    }
    const pm0 = LS.photoMapper(Object.assign({}, o, { fit: o.fit }), regionW, regionH, o.image, false), tm = toneMap(o);
    const pm = (a, v) => { const t = pm0(a, v); return t < 0 ? t : tm(t); };
    const wrap = (u0, v) => { // the photo spread over 1 + FADE of the way around (once, or twice: front and back); the overlap cross-fades at the back
      const k = 1 + FADE, u = (u0 * reps) % 1; if (u >= FADE) return pm(u / k, v);
      const w = u / FADE, a = pm(u / k, v), b = pm((u + 1) / k, v);
      if (a < 0 || b < 0) return a < 0 ? b : a; return a * w + b * (1 - w);
    };
    const facesOn = o.photo === 'faces' || !!(ob.ornament && ((o.pattern && o.pattern !== 'none') || o.captionImage));
    const FT = facesOn ? faceSetup(o) : null;
    const dep = o.detailDepth, det = ob.detail;
    const cc = Gd.center, isc = 1 / Gd.sc;
    const BG = o.badge ? FB_BADGE : null, bm = BG && o.badgeImage ? LS.photoMapper(Object.assign({}, o, { fit: 'contain', zoom: 100, offX: 0, offY: 0, brightness: 0, contrast: 0, gamma: 1, invert: false, overlay: null, border: 0 }), BG.au * 2, BG.av * 2, o.badgeImage, false) : null;
    for (let n = 0; n < N; n++) {
      const x = Q[n * 3] - C[0], y = Q[n * 3 + 1] - C[1], z = Q[n * 3 + 2];
      let t;
      if (FT) t = faceThickness(FT, o, x, y, z, C);
      else if (around) {
        const j = Math.floor(n / NU), az = Math.abs(Nn[n * 3 + 2]), v = (z - z0) / ph;
        if (j === 0 || j === NV || v < 0 || v > 1) t = -1;
        else { t = wrap(U[n], v); const w = ob.flat ? (az > 0.94 ? 0 : 1) : sstep(0.985, 0.93, az); if (t >= 0 && w < 1) t = t * w + o.plainT * (1 - w); }
        if (z < z0) t = -1;
      } else { const xr = x * ct + y * st, facing = Nn[n * 3] * st - Nn[n * 3 + 1] * ct; t = facing > Math.cos(o.frontDeg / 2 * PI / 180) && z >= z0 ? pm((xr - xmin) / (xmax - xmin), (z - z0) / ph) : -1; }
      if (t < 0) t = o.plainT;
      let e = 0;
      const p = [cc[0] + x * isc, cc[1] + y * isc, cc[2] + (z - C[2]) * isc];
      if (det && dep > 0) e = det([D[n * 3], D[n * 3 + 1], D[n * 3 + 2]], p, Gd.sc, o) * dep;
      if (BG) { // the end badge: the user's picture or text as a small lithophane inside a raised ring
        const rho = Math.hypot(p[1], p[2]), th = Math.atan2(p[2], -p[1]), bu = (p[0] - BG.x) / BG.au, bv = (th - BG.th) * rho / BG.av, q = Math.hypot(bu, bv);
        if (q < 1.08) { e = 0; if (q >= BG.ring - 0.04) t = Math.max(t, 2.4); else { const b = bm ? bm((bu + 1) / 2, (bv + 1) / 2) : -1; t = b < 0 ? o.tMin + 0.3 : b; } }
      }
      for (const zk of cuts) if (Math.abs(z - zk) < 4) { t = Math.max(t, 3.2); e = Math.max(e, 0); }
      if (z < zc + 4) { t = Math.max(t, 2.4); e = Math.max(e, 0); }
      E[n] = e; Tn[n] = e < 0 ? Math.max(o.tMin, t + e) : Math.max(o.tMin, t) + e; // a groove thins the wall from outside; a raised detail thickens it
    }
    return { T: Tn, E, regionW, regionH, rEq, z0, reps };
  }
  // closed outer and inner skins as indexed meshes
  function skins(Gd, Nn, TH) {
    const { NU, NV, Q, D } = Gd, nv = (NV - 1) * NU + 2;
    const O = new Float32Array(nv * 3), I = new Float32Array(nv * 3), map = (i, j) => j === 0 ? 0 : j === NV ? nv - 1 : 1 + (j - 1) * NU + (i % NU);
    for (let j = 0; j <= NV; j++) for (let i = 0; i < NU; i++) {
      if ((j === 0 || j === NV) && i > 0) continue;
      const n = j * NU + i, v = map(i, j), d = [D[n * 3], D[n * 3 + 1], D[n * 3 + 2]], e = TH.E[n], cs = Math.max(0.35, d[0] * Nn[n * 3] + d[1] * Nn[n * 3 + 1] + d[2] * Nn[n * 3 + 2]);
      const ox = Q[n * 3] + d[0] * e / cs, oy = Q[n * 3 + 1] + d[1] * e / cs, oz = Q[n * 3 + 2] + d[2] * e / cs, t = TH.T[n] / cs;
      O[v * 3] = ox; O[v * 3 + 1] = oy; O[v * 3 + 2] = oz; I[v * 3] = ox - d[0] * t; I[v * 3 + 1] = oy - d[1] * t; I[v * 3 + 2] = oz - d[2] * t;
    }
    const tris = []; const tri = (a, b, c) => { if (a !== b && b !== c && a !== c) tris.push(a, b, c); };
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = map(i, j), b = map(i + 1, j), c = map(i + 1, j + 1), d = map(i, j + 1); tri(a, b, c); tri(a, c, d); }
    return { O, I, F: Uint32Array.from(tris), nv };
  }
  // ---------------------------------------------------------------- Manifold helpers
  function kit(M) {
    const all = [], k = x => { all.push(x); return x; };
    const fromIdx = (V, F) => k(new M.Manifold(new M.Mesh({ numProp: 3, vertProperties: V, triVerts: F })));
    const cyl = (r, z0, z1, x, y, r2) => k(k(M.Manifold.cylinder(z1 - z0, r, r2 == null ? r : r2, Math.max(48, Math.min(180, Math.round(r * 4))))).translate([x || 0, y || 0, z0]));
    const box = (x0, y0, z0, x1, y1, z1) => k(k(M.Manifold.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const union = a => { a = a.filter(Boolean); return a.length === 1 ? a[0] : k(M.Manifold.union(a)); };
    const sub = (a, b) => { b = b.filter(Boolean); return b.length ? k(a.subtract(union(b))) : a; };
    const soup = m => { const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float32Array(F.length * 3); for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; } return p; };
    const free = () => { for (const x of all) { try { x.delete(); } catch (e) {} } all.length = 0; };
    return { fromIdx, cyl, box, union, sub, soup, free, k };
  }
  function bandsFor(o, cut) {
    const U = usable(o), h = cut.zmax - cut.zc;
    let n = o.split === 'auto' ? Math.max(1, Math.ceil(h / (U.z - 2))) : +o.split;
    n = clamp(n, 1, 4); const cuts = []; for (let k = 1; k < n; k++) cuts.push(cut.zc + h * k / n);
    return cuts;
  }
  // pins sit in the middle of the wall at each cut (holes for 1.75 mm filament)
  function pinSpots(Gd, sk, z, count) {
    const { NU, NV } = Gd, out = [];
    const cross = (A, i) => { const map = j => j === 0 ? 0 : j === NV ? sk.nv - 1 : 1 + (j - 1) * NU + (i % NU); for (let j = 0; j < NV; j++) { const a = map(j) * 3, b = map(j + 1) * 3, za = A[a + 2], zb = A[b + 2]; if ((za - z) * (zb - z) <= 0 && za !== zb) { const t = (z - za) / (zb - za); return [A[a] + (A[b] - A[a]) * t, A[a + 1] + (A[b + 1] - A[a + 1]) * t]; } } return null; };
    for (let k = 0; k < count; k++) { const i = Math.round((k + 0.5) / count * NU) % NU, p = cross(sk.O, i), q = cross(sk.I, i); if (p && q) out.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); }
    return out;
  }
  function sectionAt(Gd, sk, z) { // the outer skin's outline at height z (one point per column, first crossing from the bottom)
    const { NU, NV } = Gd, A = sk.O, out = [], map = (i, j) => j === 0 ? 0 : j === NV ? sk.nv - 1 : 1 + (j - 1) * NU + (i % NU);
    for (let i = 0; i < NU; i++) { for (let j = 0; j < NV; j++) { const a = map(i, j) * 3, b = map(i, j + 1) * 3, za = A[a + 2], zb = A[b + 2]; if ((za - z) * (zb - z) <= 0 && za !== zb) { const t = (z - za) / (zb - za); out.push([A[a] + (A[b] - A[a]) * t, A[a + 1] + (A[b + 1] - A[a + 1]) * t]); break; } } }
    return out;
  }
  // ---------------------------------------------------------------- raised color parts on the skin (laces, badge ring, pentagons, stitches)
  // the outer skin's radius in any direction from the center (bilinear on the grid), so a part can sit right on it
  function surfSampler(Gd, Nn, TH) {
    const { NU, NV, R, D, N } = Gd, Ro = new Float32Array(N);
    for (let n = 0; n < N; n++) { const cs = Math.max(0.35, D[n * 3] * Nn[n * 3] + D[n * 3 + 1] * Nn[n * 3 + 1] + D[n * 3 + 2] * Nn[n * 3 + 2]); Ro[n] = R[n] + TH.E[n] / cs; }
    const at = (i, j) => j <= 0 ? Ro[0] : j >= NV ? Ro[NV * NU] : Ro[j * NU + (i % NU)];
    return d => {
      const jf = Math.acos(clamp(-d[2], -1, 1)) / PI * NV; let th = Math.atan2(d[1], d[0]); if (th < 0) th += TAU;
      const fi0 = th / TAU * NU, i = Math.floor(fi0), fi = fi0 - i, j = Math.min(NV - 1, Math.floor(jf)), fj = jf - j;
      return (at(i, j) * (1 - fi) + at(i + 1, j) * fi) * (1 - fj) + (at(i, j + 1) * (1 - fi) + at(i + 1, j + 1) * fi) * fj;
    };
  }
  // a closed raised piece from a triangulated patch (points in the object's own units): its top h mm above the skin,
  // its bottom sunk below it (the object is subtracted later, so it fits the skin exactly), walls along the open edges
  function patchMesh(Gd, surf, P, T, h, sink, out) {
    const n = P.length, c = Gd.center, C = Gd.C, base = out.V.length / 3;
    for (let k = 0; k < n; k++) {
      const d = norm3([P[k][0] - c[0], P[k][1] - c[1], P[k][2] - c[2]]), r = surf(d), hk = typeof h === 'number' ? h : h[k];
      out.V.push(C[0] + d[0] * (r + hk), C[1] + d[1] * (r + hk), C[2] + d[2] * (r + hk));
    }
    for (let k = 0; k < n; k++) {
      const d = norm3([P[k][0] - c[0], P[k][1] - c[1], P[k][2] - c[2]]), r = surf(d);
      out.V.push(C[0] + d[0] * (r - sink), C[1] + d[1] * (r - sink), C[2] + d[2] * (r - sink));
    }
    const has = new Set(), F = [];
    for (let k = 0; k < T.length; k += 3) { const a = T[k], b = T[k + 1], e = T[k + 2]; has.add(a * n + b); has.add(b * n + e); has.add(e * n + a); }
    for (let k = 0; k < T.length; k += 3) {
      const a = T[k], b = T[k + 1], e = T[k + 2];
      F.push(a, b, e, e + n, b + n, a + n);
      for (const [p, q] of [[a, b], [b, e], [e, a]]) if (!has.has(q * n + p)) F.push(q, p, p + n, q, p + n, q + n);
    }
    // keep it outward: the top faces away from the center
    let vol = 0; const V = out.V, at = i => [V[(base + i) * 3], V[(base + i) * 3 + 1], V[(base + i) * 3 + 2]];
    for (let k = 0; k < F.length; k += 3) { const A = at(F[k]), B = at(F[k + 1]), E = at(F[k + 2]); vol += dot(A, cross(B, E)); }
    if (vol < 0) for (let k = 0; k < F.length; k += 3) { const t = F[k + 1]; F[k + 1] = F[k + 2]; F[k + 2] = t; }
    for (const f of F) out.F.push(f + base);
  }
  // a strip: nA x nC points (row-major), two triangles per cell; wrap joins the last row to the first
  function stripTris(nA, nC, wrap) {
    const T = [], rows = wrap ? nA : nA - 1;
    for (let a = 0; a < rows; a++) for (let k = 0; k < nC - 1; k++) { const a2 = (a + 1) % nA, p = a * nC + k, q = a2 * nC + k; T.push(p, q, q + 1, p, q + 1, p + 1); }
    return T;
  }
  const laceProfile = (s, h) => h * (0.18 + 0.82 * Math.sqrt(Math.max(0, 1 - s * s))); // s: -1..1 across: a round tube section
  function footballLaces(Gd, surf) {
    const sc = Gd.sc, L = FB_LACE, out = [];
    { // the long center lace over the top seam
      const nA = Math.max(40, Math.round(L.half * 2 * sc * 2)), nC = 9, w = L.wC / sc, P = [], H = [];
      for (let a = 0; a < nA; a++) { const t = -1 + 2 * a / (nA - 1), x = t * L.half, rho = fbRad(x), end = 0.55 + 0.45 * sstep(1, 0.88, Math.abs(t)); for (let k = 0; k < nC; k++) { const s = -1 + 2 * k / (nC - 1), ps = s * w / 2 / rho; P.push([x, rho * Math.sin(ps), rho * Math.cos(ps)]); H.push(laceProfile(s, L.hC) * end); } }
      const m = { V: [], F: [] }; patchMesh(Gd, surf, P, stripTris(nA, nC), H, 0.6, m); out.push(m);
    }
    for (let i = 0; i < L.n; i++) { // the cross laces
      const x0 = -L.half * 0.93 + (i + 0.5) * (2 * L.half * 0.93 / L.n), rho0 = fbRad(x0), ang = L.arc / rho0, nA = Math.max(24, Math.round(2 * L.arc * sc * 3)), nC = 9, w = L.wX / sc, P = [], H = [];
      for (let a = 0; a < nA; a++) { const t = -1 + 2 * a / (nA - 1), ps = t * ang, end = (0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)))) * (0.8 + 0.2 * Math.cos(t * Math.PI / 2)); for (let k = 0; k < nC; k++) { const s = -1 + 2 * k / (nC - 1), x = x0 + s * w / 2, rho = fbRad(x); P.push([x, rho * Math.sin(ps), rho * Math.cos(ps)]); H.push(laceProfile(s, L.hX) * end); } }
      const m = { V: [], F: [] }; patchMesh(Gd, surf, P, stripTris(nA, nC), H, 0.6, m); out.push(m);
    }
    return out;
  }
  function badgeRing(Gd, surf) {
    const B = FB_BADGE, nA = 120, rs = [B.ring, (B.ring + 1) / 2, 1], P = [], H = [];
    for (let a = 0; a < nA; a++) { const al = a / nA * TAU; for (let k = 0; k < rs.length; k++) { const q = rs[k], x = B.x + q * Math.cos(al) * B.au, rho = fbRad(x), th = B.th + q * Math.sin(al) * B.av / rho; P.push([x, -rho * Math.cos(th), rho * Math.sin(th)]); H.push(k === 1 ? 0.9 : 0.5); } }
    const m = { V: [], F: [] }; patchMesh(Gd, surf, P, stripTris(nA, rs.length, true), H, 0.6, m); return [m];
  }
  function soccerPentagons(Gd, surf) {
    const sc = Gd.sc, m = { V: [], F: [] }, inset = 2.2 / (0.278 * sc), sub = 10;
    for (const pg of SOCCER.pents) {
      const cn = pg.n, cs = pg.corners.map(k => { const q = SOCCER.pts[k]; return norm3([cn[0] + (q[0] - cn[0]) * (1 - inset), cn[1] + (q[1] - cn[1]) * (1 - inset), cn[2] + (q[2] - cn[2]) * (1 - inset)]); });
      const P = [], idx = new Map(), T = [], id = p => { const k = p.map(v => v.toFixed(6)).join(','); if (!idx.has(k)) { idx.set(k, P.length); P.push(p); } return idx.get(k); };
      for (let e = 0; e < 5; e++) {
        const A = cn, B = cs[e], Cc = cs[(e + 1) % 5], pt = (u, v) => [A[0] + (B[0] - A[0]) * u + (Cc[0] - A[0]) * v, A[1] + (B[1] - A[1]) * u + (Cc[1] - A[1]) * v, A[2] + (B[2] - A[2]) * u + (Cc[2] - A[2]) * v];
        const g = (i, j) => id(pt(i / sub, j / sub));
        for (let i = 0; i < sub; i++) for (let j = 0; j < sub - i; j++) { T.push(g(i, j), g(i + 1, j), g(i, j + 1)); if (j < sub - i - 1) T.push(g(i + 1, j), g(i + 1, j + 1), g(i, j + 1)); }
      }
      patchMesh(Gd, surf, P, T, 0.7, 0.5, m);
    }
    return [m];
  }
  function soccerStitches(Gd, surf) {
    const sc = Gd.sc, m = { V: [], F: [] }, T = stripTris(2, 3);
    for (const [ia, ib] of SOCCER.edges) {
      const A = SOCCER.pts[ia], B = SOCCER.pts[ib], ang = Math.acos(clamp(dot(A, B), -1, 1)), Lm = ang * sc, nrm = norm3(cross(A, B));
      const cnt = Math.max(1, Math.floor((Lm - 3.6) / 2.5) + 1), start = (Lm - (cnt - 1) * 2.5) / 2;
      for (let k = 0; k < cnt; k++) {
        const t = (start + k * 2.5) / Lm, s0 = Math.sin(ang), wa = Math.sin((1 - t) * ang) / s0, wb = Math.sin(t * ang) / s0, Pm = [A[0] * wa + B[0] * wb, A[1] * wa + B[1] * wb, A[2] * wa + B[2] * wb], Tg = norm3(cross(nrm, Pm));
        const P = []; for (const al of [-0.5, 0.5]) for (const ac of [-1.7, 0, 1.7]) P.push([Pm[0] + Tg[0] * al / sc + nrm[0] * ac / sc, Pm[1] + Tg[1] * al / sc + nrm[1] * ac / sc, Pm[2] + Tg[2] * al / sc + nrm[2] * ac / sc]);
        patchMesh(Gd, surf, P, T, 0.7, 0.4, m);
      }
    }
    return [m];
  }
  // the outer skin pushed out by off mm (for the stand's cradle and the fit clearance)
  function outerAt(Gd, Nn, TH, off) {
    const { NU, NV, Q, D } = Gd, nv = (NV - 1) * NU + 2, O = new Float32Array(nv * 3), map = (i, j) => j === 0 ? 0 : j === NV ? nv - 1 : 1 + (j - 1) * NU + (i % NU);
    for (let j = 0; j <= NV; j++) for (let i = 0; i < NU; i++) {
      if ((j === 0 || j === NV) && i > 0) continue;
      const n = j * NU + i, v = map(i, j), cs = Math.max(0.35, D[n * 3] * Nn[n * 3] + D[n * 3 + 1] * Nn[n * 3 + 1] + D[n * 3 + 2] * Nn[n * 3 + 2]), e = (Math.max(0, TH.E[n]) + off) / cs;
      O[v * 3] = Q[n * 3] + D[n * 3] * e; O[v * 3 + 1] = Q[n * 3 + 1] + D[n * 3 + 1] * e; O[v * 3 + 2] = Q[n * 3 + 2] + D[n * 3 + 2] * e;
    }
    return O;
  }
  const STAND = { puck: { from: 'below' }, tealight: { d: 39.5, depth: 9, from: 'top' }, usb: { d: 33, depth: 7, from: 'below' }, e12: { socketD: 21, tube: 28 } };
  const PIPE_HOLE = 10.6, NUT_AC = 15.2;
  function cradleH(o, cut) { return o.stand && o.cradle ? clamp(Math.round(0.11 * (cut.zmax - cut.zc)), 7, 16) : 0; }

  // cap, hang loop and flex fingers for the ornament ball (print floor = hanging top)
  function ornamentCap(K, M, o, cut, zc, floorT, seatCS, holeCS, r0) {
    const reach = cut.reach, nF = (BULBS[o.light] && BULBS[o.light].fingers) || (r0 >= 8 ? 6 : 4);
    let capCS = K.k(K.k(seatCS.offset(-0.15, 'Round', 2, 48)).subtract(holeCS));
    let floor = K.k(K.k(capCS.extrude(floorT)).translate([0, 0, zc]));
    if (o.loop !== false) {
      const tipY = reach + 7, earR = 5.4, holeR = 2.6;
      const ear = K.union([K.cyl(earR, zc, zc + floorT, 0, tipY), K.box(-earR, Math.max(r0 + 1.5, reach - 3), zc, earR, tipY, zc + floorT)]);
      floor = K.union([floor, K.sub(ear, [K.cyl(holeR, zc - 1, zc + floorT + 1, 0, tipY)])]);
    }
    const slots = [];
    if (o.fingers !== false) {
      const fingerLen = clamp(Math.min(r0 >= 8 ? 8 : 4.5, reach - r0 - 1.1), 2.2, 10);
      const slotW = r0 >= 8 ? 1.35 : 0.85, slotH = floorT + (r0 >= 8 ? 9 : 5);
      const L = fingerLen + 2.6, midR = r0 - 0.6 + L / 2;
      for (let i = 0; i < nF; i++) {
        const a = i * TAU / nF, ca = Math.cos(a), sa = Math.sin(a); // slots on the axes; the hang loop sits at +Y, between slots
        const sl = K.k(K.k(K.k(M.Manifold.cube([slotW, L, slotH + 1], true)).rotate([0, 0, a * 180 / PI])).translate([midR * ca, midR * sa, zc + slotH / 2 - 0.2]));
        slots.push(sl);
      }
      if (slots.length) floor = K.sub(floor, slots);
    }
    return { floor, slots };
  }
  function bulbFixture(o, r0) {
    const B = BULBS[o.light] || BULBS.c7;
    if (o.light === 'mini' || o.light === 'fairy') return { socket: { r: Math.max(2.2, B.bulbD / 2), h: 8, z: -6 }, bulb: { r: Math.max(2.2, B.bulbD / 2), neck: 2, stretch: 1.15, z: 7 } };
    if (o.light === 'g12') return { socket: { r: 3.6, h: 10, z: -8 }, bulb: { r: 6, neck: 3, stretch: 1.05, z: 10 } };
    if (o.light === 'custom') return { socket: { r: Math.max(3, r0 * 0.45), h: 16, z: -12 }, bulb: { r: Math.max(3, r0), neck: Math.max(2, r0 * 0.4), stretch: 1.4, z: Math.max(10, r0 * 1.1) } };
    const br = B.bulbD / 2, len = B.length || 30;
    return { socket: { r: (B.base || 10) / 2 + 1.2, h: 20, z: -16 }, bulb: { r: br, neck: Math.max(3, (B.base || 8) / 2), stretch: Math.max(1.15, (len * 0.55) / br), z: 8 + len * 0.28 } };
  }

  function build(raw, M) {
    const o = options(raw), warnings = [], ob = OBJECTS[o.shape];
    const Gd = grid(o), Nn = normals(Gd);
    if (o.openingAuto && !ob.ornament) o.opening = autoOpening(o, Gd, Nn);
    const cut = cutPlan(o, Gd, Nn), lipH = cradleH(o, cut);
    const cuts = bandsFor(o, cut), TH = thickness(o, Gd, Nn, cut, cuts, o.stand ? cut.zc + 2 + lipH : cut.zc), sk = skins(Gd, Nn, TH);
    if (!cut.wide) warnings.push(`The ${o.opening} mm light opening is wide for this object, so it cuts into the wall. Pick a smaller light or make the object bigger.`);
    if (ob.ornament && BULBS[o.light] && BULBS[o.light].length) {
      const innerH = cut.zmax - cut.zc - 2.4 - o.tMax;
      if (BULBS[o.light].length + 4 > innerH) warnings.push(`A ${BULBS[o.light].label} is about ${Math.round(BULBS[o.light].length)} mm long, which is tight in this ${o.size} mm ball. Try a bigger ornament or a smaller light.`);
    }

    if (cut.steepAbove > 0.004) warnings.push('Part of this shape hangs out steeply (more than 55 degrees). Turn on tree supports for those spots.');
    if (!M) throw new Error('This needs WebAssembly (Manifold) to build the object.');
    const K = kit(M), zc = cut.zc, floorT = 2.4, parts = [];
    try {
      const nv = sk.nv, V = new Float32Array(nv * 6); V.set(sk.O, 0); V.set(sk.I, nv * 3);
      const F = new Uint32Array(sk.F.length * 2); F.set(sk.F, 0); for (let k = 0; k < sk.F.length; k += 3) { F[sk.F.length + k] = sk.F[k] + nv; F[sk.F.length + k + 1] = sk.F[k + 2] + nv; F[sk.F.length + k + 2] = sk.F[k + 1] + nv; }
      const shell = K.fromIdx(V, F); if (shell.status() !== 'NoError') throw new Error('The shell did not close (' + shell.status() + ').');
      const r0 = o.opening / 2, ring = z => sectionAt(Gd, sk, z);
      // the floor ring: the outline at the bottom and top of the floor (whichever is smaller), with the light hole
      const csA = K.k(new M.CrossSection([ring(zc + 0.05)], 'Positive')), csB = K.k(new M.CrossSection([ring(zc + floorT)], 'Positive'));
      const seatCS = K.k(csA.intersect(csB)), holeCS = K.k(M.CrossSection.circle(r0, Math.max(48, Math.round(r0 * 4))));
      let floor, capSlots = [];
      if (ob.ornament) { const cap = ornamentCap(K, M, o, cut, zc, floorT, seatCS, holeCS, r0); floor = cap.floor; capSlots = cap.slots; }
      else floor = K.k(K.k(K.k(K.k(seatCS.offset(-0.15, 'Round', 2, 48)).subtract(holeCS)).extrude(floorT)).translate([0, 0, zc]));
      const sb = seatCS.bounds(); const seatR = Math.max(Math.abs(sb.min[0]), Math.abs(sb.max[0]), Math.abs(sb.min[1]), Math.abs(sb.max[1]));
      const trimmed = K.sub(K.k(shell.trimByPlane([0, 0, 1], zc)), [K.cyl(r0, zc - 1, zc + floorT + 0.6), ...capSlots]); // flat-bottomed objects: the hole goes through the bottom wall
      let obj;
      if (o.preview) obj = null; // the preview shows the shell and the floor as they are (no union, faster)
      else obj = K.union([trimmed, floor]);
      // raised color parts: they sit on the skin (the object is subtracted), above the floor
      const decor = [];
      {
        const surf = (o.laces || o.badge || o.pentagons || o.stitchPart) ? surfSampler(Gd, Nn, TH) : null;
        const outer = surf ? K.fromIdx(sk.O, sk.F) : null;
        const make = (meshes, name, kind, color) => {
          const ms = meshes.filter(m => m.F.length).map(m => K.fromIdx(Float32Array.from(m.V), Uint32Array.from(m.F)));
          if (!ms.length) return; let u = K.union(ms); u = K.k(K.k(u.subtract(outer)).trimByPlane([0, 0, 1], zc + floorT + 0.8));
          if (u.isEmpty()) return; decor.push({ m: u, name, kind, color });
        };
        if (o.laces) make(footballLaces(Gd, surf), 'Laces', 'trim', o.colors.trim);
        if (o.badge) make(badgeRing(Gd, surf), 'Badge ring', 'trim', o.colors.trim);
        if (o.pentagons) make(soccerPentagons(Gd, surf), 'Pentagons', 'panels', o.colors.panels);
        if (o.stitchPart) make(soccerStitches(Gd, surf), 'Stitches', 'trim', o.colors.trim);
      }
      // bands with pin holes
      const pieces = [];
      if (cuts.length) {
        if (!obj) obj = K.union([trimmed, floor]);
        const zs = [zc, ...cuts, cut.zmax + 5], pins = cuts.map(z => { const circ = TAU * Math.max(20, TH.rEq * 0.8), n = clamp(Math.round(circ / 45), 3, 8); return pinSpots(Gd, sk, z, n).map(p => K.cyl(0.95, z - 5, z + 5, p[0], p[1])); });
        for (let b = 0; b < zs.length - 1; b++) {
          let pc = K.k(K.k(obj.trimByPlane([0, 0, 1], zs[b])).trimByPlane([0, 0, -1], -zs[b + 1]));
          const ph = [].concat(b > 0 ? pins[b - 1] : [], b < cuts.length ? pins[b] : []); if (ph.length) pc = K.sub(pc, ph);
          const L = String.fromCharCode(65 + b), dec = decor.map(d => ({ ...d, m: K.k(K.k(d.m.trimByPlane([0, 0, 1], zs[b])).trimByPlane([0, 0, -1], -zs[b + 1])), name: `${d.name} ${L}` })).filter(d => !d.m.isEmpty());
          pieces.push({ m: pc, z0: zs[b], name: `Object ${L}`, decor: dec });
        }
      } else pieces.push({ m: obj, z0: zc, name: 'Object', pre: obj ? null : [trimmed, floor], decor });
      // the stand: a round base with a cradle that follows the object a little way up, a pocket for the light
      // underneath, the light opening through to the object, and a notch for the cable (or a wide one for a switch)
      let standH = 0, stand = null, fixture = null;
      const objZ = () => (o.stand ? standH - 2 : 0) - zc; // object frame -> assembled (the floor ring on the stand seat, or the table)
      if (o.stand) {
        const L = o.light, S = STAND[L];
        const pocketR = L === 'puck' ? o.puckD / 2 + 0.6 : L === 'tealight' || L === 'usb' ? S.d / 2 : 0, depth = L === 'puck' ? o.puckH + 1 : S.depth || 0;
        standH = L === 'puck' ? depth + 4 : L === 'tealight' ? 15 : L === 'usb' ? depth + 5 : 20;
        let ext = 0; for (let k = 0; k < sk.O.length; k += 3) ext = Math.max(ext, Math.abs(sk.O[k] - Gd.C[0]), Math.abs(sk.O[k + 1] - Gd.C[1]));
        const seatN = Math.min(Math.abs(sb.min[0]), Math.abs(sb.max[0]), Math.abs(sb.min[1]), Math.abs(sb.max[1])), Rs = Math.max(ob.standMin ? seatN + 8 : seatR + 6, pocketR + 4.5, 30, (ob.standMin || 0) * ext * 2), Rt = Rs + 1.5, dzS = standH - 2 - zc;
        const grown = off => K.k(K.fromIdx(outerAt(Gd, Nn, TH, off), sk.F).translate([0, 0, dzS]));
        let body = K.cyl(Rs + 3, 0, standH, 0, 0, Rt);
        if (lipH) body = K.union([body, K.k(K.cyl(Rt, standH - 1, standH + lipH).intersect(grown(3.0)))]);
        const fit = K.k(grown(0.4).trimByPlane([0, 0, 1], standH - 2)); // the object's own shape, 0.4 mm clear: its seat and the cradle's inside
        const cutsS = [fit]; if (L === 'puck' || L === 'usb') cutsS.push(K.cyl(Math.max(4, r0), depth - 1, standH + 1)); else if (L === 'e12') cutsS.push(K.cyl(Math.max(4, Math.min(r0, seatR - 3)), standH - 6, standH + 1));
        if (L === 'puck' || L === 'usb') cutsS.push(K.cyl(pocketR, -1, depth));
        if (L === 'tealight') cutsS.push(K.cyl(pocketR, standH - 2 - S.depth, standH + 1));
        if (L === 'e12') { cutsS.push(K.cyl(PIPE_HOLE / 2, -1, standH + 1)); cutsS.push(K.k(K.k(M.Manifold.cylinder(3.2, NUT_AC / 2, NUT_AC / 2, 6)).translate([0, 0, -0.01]))); }
        if (o.notch !== 'none' && L !== 'tealight') { if (o.notch === 'wide' && (L === 'puck' || L === 'usb')) cutsS.push(K.box(-13, 0, -1, 13, Rs + 6, Math.max(4.5, Math.min(depth - 3, 15)))); else cutsS.push(K.box(-3.6, 0, -1, 3.6, Rs + 6, 4.5)); }
        body = K.sub(body, cutsS);
        if (L === 'e12') { // a cup that holds the socket upright under the opening
          const cupR = S.socketD / 2 + 0.4, tube = K.sub(K.cyl(cupR + 2.2, standH - 7, standH - 2 + S.tube), [K.cyl(cupR, standH - 2, standH + S.tube + 1), K.cyl(PIPE_HOLE / 2, standH - 8, standH)]);
          body = K.union([body, tube]);
          if (cupR + 2.2 > r0 - 0.5) warnings.push('The socket cup is wider than the light opening. Pick a bigger opening.');
        }
        stand = K.soup(body);
        fixture = L === 'puck' ? { puck: { r: o.puckD / 2, h: Math.max(6, o.puckH - 1), z: 0.4 } } : L === 'tealight' ? { candle: { r: 19, h: 16, z: standH - 2 - S.depth } } : L === 'usb' ? { board: { r: 15, z: S.depth - 2.5 } } : { socket: { r: S.socketD / 2, h: 26, z: standH - 2 }, bulb: { r: 11, neck: 5, stretch: 1.5, z: standH - 2 + 26 + 15 } };
      } else {
        const L = o.light;
        fixture = ob.ornament && BULBS[L] ? bulbFixture(o, r0)
          : L === 'puck' ? { puck: { r: Math.max(r0 + 8, o.puckD / 2), h: 12, z: -12 } } : L === 'tealight' ? { candle: { r: 19, h: 16, z: 0 } } : L === 'usb' ? { board: { r: Math.min(15, r0), z: 0 } } : { socket: { r: 10.5, h: 26, z: -18 }, bulb: { r: 11, neck: 5, stretch: 1.5, z: 22 } };
      }
      const dz = objZ() + (fixture && fixture.puck && !o.stand ? 12 : 0);
      const toTh = p => { // the wall thickness at each vertex (for the lit preview)
        const th = new Float32Array(p.length / 3), { NU, NV } = Gd, C = Gd.C;
        for (let v = 0; v < th.length; v++) {
          const x = p[v * 3] - C[0], y = p[v * 3 + 1] - C[1], z = p[v * 3 + 2] - C[2], zz = p[v * 3 + 2];
          if (zz < zc + floorT + 0.2) { th[v] = 4.5; continue; }
          const l = Math.hypot(x, y, z) || 1, ph = Math.acos(clamp(-z / l, -1, 1)) / PI * NV, a = Math.atan2(y, x); let th0 = a / TAU * NU; if (th0 < 0) th0 += NU;
          const j = Math.min(NV - 1, Math.floor(ph)), i = Math.floor(th0) % NU, fj = ph - j, fi = th0 - Math.floor(th0), T = TH.T;
          const t00 = T[j * NU + i], t10 = T[j * NU + (i + 1) % NU], t01 = T[(j + 1) * NU + i], t11 = T[(j + 1) * NU + (i + 1) % NU];
          th[v] = (t00 * (1 - fi) + t10 * fi) * (1 - fj) + (t01 * (1 - fi) + t11 * fi) * fj;
        }
        return th;
      };
      const lift = p => { const a = new Float32Array(p.length); for (let k = 0; k < p.length; k += 3) { a[k] = p[k]; a[k + 1] = p[k + 1]; a[k + 2] = p[k + 2] + dz; } return a; };
      pieces.forEach((pc, gi) => {
        const p = pc.pre ? (() => { const a = K.soup(pc.pre[0]), b = K.soup(pc.pre[1]), q = new Float32Array(a.length + b.length); q.set(a, 0); q.set(b, a.length); return q; })() : K.soup(pc.m); if (!p.length) return;
        const bb = Core.bbox(p), off = [-bb.min[0], -bb.min[1], -bb.min[2]], loc = q => { const r = new Float32Array(q.length); for (let k = 0; k < q.length; k += 3) { r[k] = q[k] + off[0]; r[k + 1] = q[k + 1] + off[1]; r[k + 2] = q[k + 2] + off[2]; } return r; };
        parts.push({ name: pc.name, kind: 'object', group: gi, color: o.colors.object, assembled: lift(p), th: toTh(p), local: loc(p) });
        for (const d of pc.decor || []) { const q = K.soup(d.m); if (q.length) parts.push({ name: d.name, kind: d.kind, group: gi, color: d.color, assembled: lift(q), local: loc(q) }); } // the same origin as its object: the STLs line up
      });
      if (stand) parts.push({ name: 'Stand', kind: 'stand', group: 'stand', color: o.colors.stand, assembled: stand, local: Float32Array.from(PL.normalize(stand)) });
      const U = usable(o); let tooBig = false;
      for (const pt of parts) { const bb = Core.bbox(pt.local); pt.size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]]; pt.fits = fits(pt.size, U); if (!pt.fits) tooBig = true; }
      if (parts.some(p => p.kind === 'object' && !p.fits)) warnings.push(cuts.length ? 'A piece is still wider than your printer. Make the object smaller.' : 'The object is bigger than your printer. Split it into pieces or make it smaller.');
      if (stand && !parts.find(p => p.kind === 'stand').fits) warnings.push('The stand is bigger than your printer.');
      if (ob.flat) { let flatTop = 0; for (let n = 0; n < Gd.N; n++) if (Nn[n * 3 + 2] > 0.995 && Gd.Q[n * 3 + 2] > cut.zmax - 2) flatTop++; if (flatTop / Gd.N > 0.01) warnings.push('The flat top bridges across the inside. Print it with tree supports inside (they come out through the opening).'); }
      if (fixture.bulb) { const topIn = cut.zmax - zc + dz + zc - 3; if (fixture.bulb.z + fixture.bulb.r * fixture.bulb.stretch > topIn) warnings.push('The bulb reaches the top of the object. Make the object taller.'); }
      let vol = 0; for (const pt of parts) vol += Math.abs(Core.signedVolume(pt.local)) * (pt.kind === 'stand' ? 0.35 : 1);
      const bbA = Core.bbox(parts[0].assembled);
      const stats = { width: cut.reach ? (() => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const pt of parts) if (pt.kind === 'object') for (let k = 0; k < pt.assembled.length; k += 3) { x0 = Math.min(x0, pt.assembled[k]); x1 = Math.max(x1, pt.assembled[k]); y0 = Math.min(y0, pt.assembled[k + 1]); y1 = Math.max(y1, pt.assembled[k + 1]); } return [x1 - x0, y1 - y0]; })() : [0, 0], height: cut.zmax - zc, cut: zc - cut.zmin, opening: o.opening, pieces: pieces.length, parts: parts.length, grams: Math.round(vol / 1000 * 1.24), tris: parts.reduce((s, p) => s + p.local.length / 9, 0), cell: Gd.cell, NU: Gd.NU, NV: Gd.NV, standH, cradle: lipH, photoW: TH.regionW, photoH: TH.regionH, shaped: !ob.free, decor: parts.filter(p => p.kind === 'trim' || p.kind === 'panels').map(p => p.name) };
      stats.depth = stats.width[1]; stats.width = stats.width[0];
      const filaments = []; for (const p of parts) if (!filaments.some(f => f.color === p.color)) filaments.push({ color: p.color, role: p.name });
      return { options: o, parts, stats, warnings, filaments, tooBig, cut, cuts, fixture, z0: dz + zc, top: cut.zmax + dz, light: [Gd.C[0], Gd.C[1], Gd.C[2] + dz], grid: Gd, thick: TH, bbA };
    } finally { K.free(); }
  }

  // ---------------------------------------------------------------- export
  function gateInfo(raw) { const o = options(raw), ob = OBJECTS[o.shape]; return { shaped: !ob.free, shapeLabel: ob.free ? '' : ob.label.toLowerCase() }; }
  // an object and its color parts (laces, badge ring, pentagons, stitches) stay together as one multi-color object
  function groups(res) { const G = new Map(); for (const pt of res.parts) { const k = String(pt.group == null ? pt.name : pt.group); if (!G.has(k)) G.set(k, []); G.get(k).push(pt); } return [...G.values()]; }
  function joinP(list) { const n = list.reduce((s, q) => s + q.length, 0), out = new Float32Array(n); let k = 0; for (const q of list) { out.set(q, k); k += q.length; } return out; }
  function arrangePlates(res) { const U = usable(res.options); return PL.arrange(groups(res).map(g => ({ name: g[0].name, p: joinP(g.map(pt => pt.local)), color: g[0].color, g })), U.w, U.d, { gap: 6, maxZ: U.z }); }
  function placeLike(q, b, it) { // move one part of a group as the arrangement moved the whole group
    const out = new Float32Array(q.length), h = b.max[1] - b.min[1];
    for (let k = 0; k < q.length; k += 3) { const x = q[k] - b.min[0], y = q[k + 1] - b.min[1], z = q[k + 2] - b.min[2]; if (it.rot) { out[k] = h - y + it.x; out[k + 1] = x + it.y; } else { out[k] = x + it.x; out[k + 1] = y + it.y; } out[k + 2] = z; }
    return out;
  }
  function export3MF(res, o) {
    o = o || {};
    const cols = []; res.parts.forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const ext = c => cols.indexOf((c || '').toUpperCase()) + 1;
    const A = arrangePlates(res), objs = [], plates = [];
    const objOf = (it, at) => { const g = it.g, b = Core.bbox(joinP(g.map(pt => pt.local))); if (g.length === 1) return { name: g[0].name, p: placeLike(g[0].local, b, at), color: g[0].color, extruder: ext(g[0].color) }; return { name: g[0].name.replace(/^Object/, OBJECTS[res.options.shape].label), parts: g.map(pt => ({ name: pt.name, p: placeLike(pt.local, b, at), color: pt.color, extruder: ext(pt.color) })) }; };
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push(objOf(it, it)); }); plates.push(ids); });
    A.unfit.forEach(u => { plates.push([objs.length]); objs.push(objOf(u, { x: 0, y: 0, rot: false })); });
    return T.threeMF(objs, { title: o.name || 'Lithophane object', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const o = res.options, st = res.stats, f = v => String(Math.round(v)), L = [], ob = OBJECTS[o.shape];
    L.push(`Expressarte lithophane object: ${ob.label}`, '');
    L.push(`${f(st.width)} x ${f(st.depth)} mm, ${f(st.height)} mm tall. Wall ${o.tMin}-${o.tMax} mm (dark = thick, light = thin). Light opening ${f(o.opening)} mm.`);
    if (st.pieces > 1) L.push(`Split into ${st.pieces} bands (A is the bottom). Push short pieces of 1.75 mm filament into the pin holes and glue the bands with CA glue.`);
    L.push('', 'Parts'); res.parts.forEach(p => L.push(`  ${p.name}: ${f(p.size[0])} x ${f(p.size[1])} x ${f(p.size[2])} mm`));
    L.push('', 'Printing');
    if (ob.ornament) {
      L.push('  - Print the ornament in white PLA, upright as exported, standing on the cap (the opening and hang loop sit on the bed), with no supports.');
      L.push('  - Use 100% infill, or enough walls to fill the thickest part, so the light passes evenly. A brim helps it stay put.');
      L.push('  - Layers of 0.12-0.16 mm and a slower outer wall give the smoothest photo.');
    } else {
      L.push('  - Print the object in white PLA, upright as exported, standing on its floor ring, with no supports (unless a warning below says otherwise).',
        '  - Use 100% infill, or enough walls to fill the thickest part, so the light passes evenly. A brim helps it stay put.',
        '  - Layers of 0.12-0.16 mm and a slower outer wall give the smoothest photo.');
    }
    const dec = res.parts.filter(p => p.kind === 'trim' || p.kind === 'panels');
    if (dec.length) {
      L.push(`  - Color parts: ${[...new Set(dec.map(p => p.name.replace(/ [A-Z]$/, '').toLowerCase()))].join(', ')}. In the 3MF they are part of the object, on their own filament: print it on a multi-color printer (AMS) as one object.`);
      L.push('  - Their STLs share the object STL\'s origin: load them together as one object in your slicer and give each its own filament. With one color, print it all in white and paint the raised parts, or print them on their own and glue them on.');
    }
    if (res.parts.some(p => p.kind === 'stand')) L.push('  - The stand prints flat side down as exported, in any color, with 15-20% infill and no supports. Its cradle follows the object, so it sits steady.');
    L.push('', 'Light');
    if (o.light === 'puck') L.push(`  - A battery or USB LED puck light${o.stand ? ` up to ${f(o.puckD)} mm wide and ${f(o.puckH)} mm tall in the pocket under the stand` : ` under the ${f(o.opening)} mm opening`}. Its light comes up through the ${f(o.opening)} mm opening.`);
    if (o.light === 'tealight') L.push('  - A battery LED tea light (about 38 mm) under the opening. Never use a real flame.');
    if (o.light === 'e12') L.push(`  - An E12 candelabra socket${o.stand ? ` in the stand's cup on 1/8 IPS threaded lamp pipe (the hole is ${PIPE_HOLE} mm, hex nut underneath)` : ''} with a small LED candle bulb only. Wire it with a cord and an inline switch (ask an electrician if unsure).`);
    if (o.light === 'usb') L.push('  - A small USB LED (a USB light stick or a USB-C LED board) under the opening.');
    if (ob.ornament) {
      L.push('  - This ornament slips over a Christmas light. Use LED lights only. Never use a hot incandescent bulb or a flame.');
      L.push('  - The opening is sized to the bulb\'s widest point, with flexible tabs that grip so it stays on the light string.');
      if (BULB_NOTE[o.light]) L.push('  - ' + BULB_NOTE[o.light]);
      L.push('  - A hang loop on the cap lets you hang it from a hook as well.');
    }

    if (o.stand && o.notch === 'cable' && o.light !== 'tealight') L.push('  - The cable runs out through the notch under the stand.');
    if (o.stand && o.notch === 'wide' && o.light !== 'tealight') L.push('  - The wide notch at the back reaches the light\'s switch (or lets a remote reach its sensor) and fits a cable.');
    L.push('', 'Using it', '  - Use LED lights only. Never use a flame or a hot incandescent bulb.', '  - The photo shows when the object is lit from inside.');
    (res.warnings || []).forEach(w => L.push('  - ' + w));
    return L.join('\n');
  }
  function files(res, o) {
    o = o || {}; const base = o.fileBase || 'lithophane_object', out = [];
    const slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    for (const pt of res.parts) out.push({ name: `${base}_${slug(pt.name)}.stl`, data: new Uint8Array(Core.writeSTL(pt.local, pt.name)) });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }
  // a front-view silhouette for the object buttons: depth-shaded, glowing
  function icon(key, W, H) {
    const ob = OBJECTS[key], c = ob.center || [0, 0, 0], ext = ob.ext, out = new Float32Array(W * H).fill(-1);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = c[0] + ((i + 0.5) / W - 0.5) * 2 * ext, z = c[2] - ((j + 0.5) / H - 0.5) * 2 * ext;
      for (let k = 0; k < 40; k++) { const y = c[1] - ext + 2 * ext * k / 40; if (ob.inside([x, y, z])) { out[j * W + i] = 1 - k / 40; break; } }
    }
    return out;
  }
  const api = { OBJECTS, OBJ_KEYS, LIGHTS, BULBS, BULB_NOTE, PUCKS, PALETTE, DEFAULTS, SOCCER, FB_BADGE, fbRad, soccerSeam, toneMap, groups, options, grid, normals, cutPlan, thickness, skins, build, gateInfo, arrangePlates, export3MF, files, notes, icon, radius, usable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPObjLitho = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
