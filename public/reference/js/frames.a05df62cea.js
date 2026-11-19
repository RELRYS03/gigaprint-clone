/* Expressarte picture frame generator.
   A frame is a strip of moulding swept round the picture opening, built as one watertight heightfield solid that
   prints face up (so its ornament never overhangs), plus a glued-on back ring that forms the rabbet (the step the
   glass, mat, picture and backing sit in), turn clips, a hanger and optional extras.

   Geometry: millimetres, the frame lies in XY with its face up (+z), the opening centred on the origin.
   The moulding runs along "rails" (straight sides with true 45 degree mitres, or arcs for oval, round and arch
   frames). Each rail is a grid of columns (along) by rows (across, from the sight edge out). Along a straight rail
   the column at c in [0,1] goes from A + c(B - A) in direction M(c) = n + (c(k0 + k1) - k0) t, so rows stay parallel
   to the side and the end columns are the mitre lines; running ornament repeats a whole number of times on every
   rail, so it meets itself at each mitre the way a carver lays it out.

   build(o) returns the preview grid (positions, colours, material groups) and the plan; solids(model) returns the
   printable solids; exportPieces(model, o) cuts the front at the mitres with the engine's free-plane splitter
   (pegs or dowels in the cut faces) and lays everything out on build plates. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || require('./core.js');
  const Tools = G.StudioTools || require('./tools.js');
  const TAU = Math.PI * 2, IN = 25.4;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const frac = x => x - Math.floor(x);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const dome = q => q > 0 ? Math.sqrt(q) : 0;

  // ---------------------------------------------------------------- noise (deterministic, seedable)
  function hash2(i, j, s) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, oct) { let a = 0, w = 0.5, f = 1, n = 0; for (let k = 0; k < (oct || 4); k++) { a += w * vnoise(x * f, y * f, s + k * 17); n += w; w *= 0.5; f *= 2.03; } return a / n; }
  function rng(seed) { let s = (seed | 0) || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }

  // ---------------------------------------------------------------- profile shapes (x in [0,1] across one element)
  const SHAPES = {
    flat: () => 0,
    lin: x => x,
    cove: x => 1 - Math.sqrt(Math.max(0, 1 - x * x)),
    ovolo: x => Math.sqrt(Math.max(0, 1 - (1 - x) * (1 - x))),
    ogee: x => 0.5 - 0.5 * Math.cos(Math.PI * x),
    rogee: x => 2 * x - (0.5 - 0.5 * Math.cos(Math.PI * x)),
    bead: x => x,
    scoop: x => x,
    reeds: x => x
  };
  // element: { w, a, b, s, p (bump, fraction of depth), n (reeds), orn:{k, d mm, per mm}, tex:{k, d mm, per mm}, mat }
  function elemH(e, x) {
    let h = e.a + (e.b - e.a) * (SHAPES[e.s] || SHAPES.lin)(x);
    if (e.s === 'bead') h += (e.p || 0.15) * dome(1 - (2 * x - 1) * (2 * x - 1));
    else if (e.s === 'scoop') h -= (e.p || 0.15) * Math.sin(Math.PI * x);
    else if (e.s === 'reeds') h += (e.p || 0.06) * Math.pow(Math.abs(Math.sin(Math.PI * x * (e.n || 5))), 0.6);
    return h;
  }

  // ---------------------------------------------------------------- running ornament
  // f: position along the band in motifs (whole number of motifs per rail), v in [0,1] across the element,
  // P: motif length (mm), E: element width (mm). Returns height in units of the ornament depth (about 0..1).
  const ORN = {
    pearls(f, v, P, E) { const x = (frac(f) - 0.5) * P, y = (v - 0.5) * E, r = Math.min(P * 0.47, E * 0.5); return dome(1 - (x * x + y * y) / (r * r)); },
    beadreel(f, v, P, E) {
      const g = frac(f) * P, y = (v - 0.5) * E, R = E * 0.5;
      const bead = dome(1 - ((g - 0.3 * P) / (0.27 * P)) ** 2 - (y / R) ** 2);
      const reel = c => dome(1 - ((g - c * P) / (0.055 * P)) ** 2 - (y / (R * 0.82)) ** 2) * 0.9;
      return Math.max(bead, reel(0.69), reel(0.87));
    },
    eggdart(f, v, P, E) {
      const x = (frac(f) - 0.5) * P, y = (v - 0.52) * E;
      const ax = 0.29 * P, ay = 0.36 * E, rho = Math.hypot(x / ax, y / ay);
      const egg = dome(1 - rho * rho);
      const shell = Math.max(0, 1 - Math.abs(Math.hypot(x / (0.4 * P), (y - 0.02 * E) / (0.47 * E)) - 0.92) / 0.09) * 0.62 * smooth(-0.42 * E, -0.25 * E, -y + 0.0) ;
      const dx = Math.abs(x) - 0.5 * P, xx = Math.abs(dx), yy = y;
      const shaft = yy > -0.3 * E && yy < 0.42 * E ? Math.max(0, 1 - xx / (0.035 * P)) * 0.75 : 0;
      const hw = (yy + 0.46 * E) / (0.2 * E) * 0.11 * P; // arrowhead pointing to the sight edge
      const head = yy > -0.46 * E && yy < -0.26 * E && xx < hw ? 0.8 * (1 - xx / Math.max(1e-6, hw) * 0.6) : 0;
      return Math.max(egg, shell, shaft, head);
    },
    rope(f, v, P, E) { const r = dome(1 - (2 * v - 1) ** 2), g = frac(f + v * 0.85); return r * (0.5 + 0.5 * Math.sin(Math.PI * g)); },
    gadroon(f, v, P, E) { const r = dome(1 - (2 * v - 1) ** 2), g = frac(f + (v - 0.5) * 0.55); return Math.pow(Math.sin(Math.PI * g), 0.7) * (0.35 + 0.65 * r); },
    leaftip(f, v, P, E) {
      const x = (frac(f) - 0.5) * P, xs = (frac(f + 0.5) - 0.5) * P;
      const leaf = (xx, sc) => { const hw = 0.49 * P * sc * Math.pow(Math.max(0, 1 - v), 0.55) * smooth(0, 0.22, v); if (hw < 1e-6) return 0; const q = 1 - (xx / hw) ** 2; return q > 0 ? Math.sqrt(q) * (0.55 + 0.45 * (1 - v)) - 0.22 * Math.exp(-((xx / (0.04 * P)) ** 2)) * (1 - v) * 0 + 0.18 * Math.exp(-((xx / (0.035 * P)) ** 2)) * (1 - v) : 0; };
      return Math.max(leaf(x, 1), leaf(xs, 0.55) * 0.65);
    },
    acanthus(f, v, P, E) {
      const x = (frac(f) - 0.5) * P, lob = 1 + 0.2 * Math.sin(TAU * 3.5 * v) * smooth(0.1, 0.3, v);
      const hw = 0.5 * P * lob * Math.pow(Math.max(0, 1 - v * 0.92), 0.5) * smooth(0, 0.25, v);
      if (hw < 1e-6) return 0;
      const s = Math.abs(x) / hw; if (s >= 1) return 0;
      const vein = 0.12 * Math.cos(TAU * (s * 1.6 - v * 2.2)) * (1 - s);
      const rib = 0.22 * Math.exp(-((x / (0.03 * P)) ** 2));
      const curl = 0.25 * smooth(0.7, 1, v);
      return dome(1 - s * s) * (0.55 + 0.25 * (1 - v)) + vein + rib + curl * (1 - s);
    },
    ripple(f, v) { return 0.5 + 0.5 * Math.cos(TAU * f); },
    wave(f, v) { return 0.5 + 0.5 * Math.cos(TAU * (f + 0.32 * Math.sin(Math.PI * 2 * v))); },
    flame(f, v) { const g = frac(f + 0.28 * Math.sin(TAU * v)); return g < 0.75 ? g / 0.75 : (1 - g) / 0.25; },
    dentil(f, v) { const g = frac(f); return smooth(0.08, 0.16, g) * (1 - smooth(0.84, 0.92, g)) * smooth(0.04, 0.14, v) * (1 - smooth(0.9, 0.98, v)); },
    reeds(f, v, P, E, o) { return Math.pow(Math.abs(Math.sin(Math.PI * v * ((o && o.n) || 6))), 0.6); },
    flutes(f, v) { const g = frac(f), stop = smooth(0.06, 0.2, v) * (1 - smooth(0.8, 0.94, v)); return -dome(1 - ((g - 0.5) / 0.36) ** 2) * stop; },
    chevron(f, v, P, E) { const g = frac(f + Math.abs(v - 0.5) * E / P); return 1 - 2 * Math.abs(g - 0.5); },
    laurel(f, v, P, E) {
      const x = (frac(f) - 0.5) * P, y = (v - 0.5) * E;
      const leaf = (bx, by, ang, L, Wd) => {
        const c = Math.cos(ang), s = Math.sin(ang), lx = (x - bx) * c + (y - by) * s, ly = -(x - bx) * s + (y - by) * c;
        if (lx < 0 || lx > L) return 0; const hw = Wd * Math.sin(Math.PI * lx / L); if (hw < 1e-6) return 0;
        return dome(1 - (ly / hw) ** 2) * (0.75 + 0.25 * Math.sin(Math.PI * lx / L)) + 0.12 * Math.exp(-((ly / (0.12 * Wd)) ** 2));
      };
      const L = 0.78 * P, Wd = Math.min(0.2 * P, 0.24 * E);
      const berry = dome(1 - ((x - 0.32 * P) ** 2 + (y) ** 2) / (0.09 * Math.min(P, E)) ** 2) * 0.85;
      return Math.max(leaf(-0.45 * P, 0, 0.42, L, Wd), leaf(-0.45 * P, 0, -0.42, L, Wd), leaf(-0.45 * P + P, 0, 0.42, L, Wd) * 0, berry);
    },
    ribbon(f, v, P, E) {
      const r = dome(1 - (2 * v - 1) ** 2), stick = 0.55 * r;
      const g = frac(f + (v - 0.5) * 0.75), band = Math.exp(-(((g - 0.5) / 0.22) ** 2));
      return Math.max(stick, (0.55 + 0.45 * r) * band);
    },
    punch(f, v, P, E) { const n = Math.max(1, Math.round(E / P)), xi = frac(f) - 0.5, yi = frac(v * n) - 0.5; return -dome(1 - (xi * xi + yi * yi) / 0.1); },
    sanded(f, v, P, E, o, X, Y) { return -(0.65 * vnoise(X / 0.55, Y / 0.55, 91) + 0.35 * vnoise(X / 0.27, Y / 0.27, 37)); },
    hatch(f, v, P, E, o, X, Y) {
      const s = P, g1 = frac((X + Y) / s), g2 = frac((X - Y) / s), gr = g => Math.max(0, 1 - Math.abs(g - 0.5) / 0.2);
      return -Math.max(gr(g1), gr(g2));
    },
    greekkey(f, v) {
      const K = ['1111111', '1000001', '1011101', '1010101', '1010111'], W = 7, H = 5; // a running meander, row 0 on the outer side
      const gx = frac(f) * W - 0.5, gy = (1 - v) * H - 0.5;
      const at = (i, j) => { j = clamp(j, 0, H - 1); i = ((i % W) + W) % W; return K[j][i] === '1' ? 1 : 0; };
      const i0 = Math.floor(gx), j0 = Math.floor(gy), fx = gx - i0, fy = gy - j0;
      const m = at(i0, j0) * (1 - fx) * (1 - fy) + at(i0 + 1, j0) * fx * (1 - fy) + at(i0, j0 + 1) * (1 - fx) * fy + at(i0 + 1, j0 + 1) * fx * fy;
      return smooth(0.3, 0.7, m) * smooth(0.02, 0.1, v) * (1 - smooth(0.9, 0.98, v));
    },
    whiplash(f, v, P, E) {
      const y1 = 0.5 + 0.3 * Math.sin(TAU * f) + 0.08 * Math.sin(3 * TAU * f), y2 = 0.5 + 0.22 * Math.sin(TAU * (f + 0.5)) - 0.06 * Math.sin(2 * TAU * f);
      const d1 = Math.abs(v - y1) * E, d2 = Math.abs(v - y2) * E, w = 0.1 * E;
      return Math.max(dome(1 - (d1 / w) ** 2), 0.7 * dome(1 - (d2 / (w * 0.7)) ** 2));
    },
    cabochon(f, v, P, E) { const x = (frac(f) - 0.5) / 0.42, y = (v - 0.5) / 0.4; const q = Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(y), 4); return dome(1 - q); }
  };
  // ornaments that also show as relief colour (dark in recesses): the punch and hatch ground are matte
  const GROUND = { sanded: 1, hatch: 1, punch: 1 };

  // ---------------------------------------------------------------- corner and centre features
  // x along the outward axis, y across it, both in units of the feature size R. Return height in units of the moulding
  // depth above the feature's level, or a negative number outside the feature.
  function volute(x, y, cx, cy, a, b, turns, w, hand) {
    const dx = x - cx, dy = (y - cy) * hand, rho = Math.hypot(dx, dy); if (rho < 1e-6) return 1;
    const phi = Math.atan2(dy, dx); let best = 9;
    for (let k = -1; k <= turns; k++) { const r = a * Math.exp(b * (phi + TAU * k)); best = Math.min(best, Math.abs(rho - r) / Math.max(0.35, r / a * 0.25 + 0.3)); }
    const eye = dome(1 - (rho / (a * 0.9)) ** 2);
    return Math.max(eye, rho < a * Math.exp(b * TAU * (turns + 0.6)) ? dome(1 - (best / w) ** 2) : 0);
  }
  function petals(x, y, n, r0, r1) { const r = Math.hypot(x, y), a = Math.atan2(y, x), edge = r0 + (r1 - r0) * Math.pow(Math.abs(Math.cos(a * n / 2)), 0.6); return r < edge ? dome(1 - (r / edge) ** 2) * (0.7 + 0.3 * Math.abs(Math.cos(a * n / 2))) : -1; }
  function leafAt(x, y, bx, by, ang, L, Wd, lobes) {
    const c = Math.cos(ang), s = Math.sin(ang), lx = (x - bx) * c + (y - by) * s, ly = -(x - bx) * s + (y - by) * c;
    if (lx < 0 || lx > L) return -1;
    const t = lx / L, hw = Wd * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 + 0.22 * Math.sin(TAU * (lobes || 3) * t));
    if (hw < 1e-6) return -1; const q = Math.abs(ly) / hw; if (q >= 1) return -1;
    return dome(1 - q * q) * (0.6 + 0.4 * (1 - t)) + 0.15 * Math.exp(-((ly / (0.08 * Wd)) ** 2)) + 0.08 * Math.cos(TAU * (q * 2 - t * 3)) * (1 - q);
  }
  const FEAT = {
    // Louis XIV corner cartouche: a fluted shell with a hinge, C-scroll volutes each side, acanthus running along the rails
    shell(x, y) {
      let h = -1;
      const hx = x + 0.45, r = Math.hypot(hx, y), a = Math.atan2(y, hx);
      if (Math.abs(a) < 1.3) { const re = 1.02 - 0.07 * Math.abs(Math.sin(a * 5.5)); if (r < re) { const rib = 0.5 + 0.5 * Math.cos(a * 11); h = Math.max(h, 0.35 + 0.65 * dome(1 - (r / re) ** 2) * (0.78 + 0.22 * rib)); } }
      const hinge = dome(1 - (hx * hx + y * y) / 0.05); h = Math.max(h, hinge > 0 ? 0.85 + 0.15 * hinge : -1);
      for (const s of [1, -1]) {
        const v = volute(x, y, -0.15, 0.78 * s, 0.09, 0.24, 1, 0.12, s); if (v > 0) h = Math.max(h, 0.55 * v + 0.15);
        const l = leafAt(x, y * s, -0.25, 0.95, 1.35, 1.05, 0.2, 3); if (l > 0) h = Math.max(h, 0.45 * l + 0.05);
        const l2 = leafAt(x, y * s, 0.05, 0.55, 0.65, 0.65, 0.16, 2); if (l2 > 0) h = Math.max(h, 0.5 * l2 + 0.1);
      }
      const pad = dome(1 - (x / 1.05) ** 2 - (y / 1.15) ** 2); if (pad > 0) h = Math.max(h, 0.18 * pad);
      return h;
    },
    // Louis XV / Rococo: flamboyant rocaille shell, pierced-looking scallops, flower sprays
    rocaille(x, y) {
      let h = -1;
      const hx = x + 0.35, r = Math.hypot(hx, y), a = Math.atan2(y, hx);
      if (Math.abs(a) < 1.55) { const re = 1.08 - 0.16 * Math.abs(Math.sin(a * 3.5)) - 0.06 * Math.abs(Math.sin(a * 9)); if (r < re) { const rib = 0.5 + 0.5 * Math.cos(a * 15 + r * 4); h = Math.max(h, 0.3 + 0.7 * dome(1 - (r / re) ** 2) * (0.7 + 0.3 * rib)); } }
      for (const s of [1, -1]) {
        const v = volute(x, y, 0.15, 0.95 * s, 0.07, 0.2, 2, 0.1, s); if (v > 0) h = Math.max(h, 0.6 * v + 0.1);
        const v2 = volute(x, y, -0.55, 0.6 * s, 0.06, 0.22, 1, 0.1, -s); if (v2 > 0) h = Math.max(h, 0.5 * v2 + 0.1);
        const fl = petals(x - 0.45, (y - 1.35 * s), 5, 0.12, 0.26); if (fl > 0) h = Math.max(h, 0.5 * fl + 0.25);
        const l = leafAt(x, y * s, -0.2, 1.1, 1.5, 1.2, 0.18, 4); if (l > 0) h = Math.max(h, 0.4 * l + 0.05);
      }
      return h;
    },
    // acanthus spray for centres: five leaves fanning out from a boss
    acanthus(x, y) {
      let h = -1;
      for (const [ang, L, Wd] of [[0, 1.05, 0.3], [0.75, 0.95, 0.26], [-0.75, 0.95, 0.26], [1.5, 0.85, 0.22], [-1.5, 0.85, 0.22]]) { const l = leafAt(x, y, -0.2, 0, ang, L, Wd, 3); if (l > 0) h = Math.max(h, 0.2 + 0.6 * l); }
      const boss = dome(1 - ((x + 0.2) ** 2 + y * y) / 0.06); if (boss > 0) h = Math.max(h, 0.75 + 0.25 * boss);
      return h;
    },
    rosette(x, y) { const p = petals(x, y, 8, 0.45, 0.85), q = petals(x * 1.7, y * 1.7, 8, 0.45, 0.85); let h = p > 0 ? 0.25 + 0.5 * p : -1; if (q > 0) h = Math.max(h, 0.55 + 0.35 * q); const b = dome(1 - (x * x + y * y) / 0.03); if (b > 0) h = Math.max(h, 0.9 + 0.1 * b); return h; },
    // Victorian corner block (square on the rail axes) with a rosette
    block(x, y) {
      const c = Math.SQRT1_2, u = (x - y) * c, w = (x + y) * c; // turn 45 degrees back onto the rail axes
      const m = Math.max(Math.abs(u), Math.abs(w)); if (m > 0.95) return -1;
      const bevel = Math.min(1, (0.95 - m) / 0.12), base = 0.55 + 0.1 * bevel;
      const r = FEAT.rosette(x / 0.8, y / 0.8); return Math.max(base, r > 0 ? base + 0.45 * r : base);
    },
    // Art Deco: stepped sunburst fan opening outward, with a stepped plinth
    sunburst(x, y) {
      const hx = x + 0.6, r = Math.hypot(hx, y), a = Math.atan2(y, hx); if (Math.abs(a) > 1.25 || r > 1.25) return -1;
      const step = Math.floor((1.25 - r) / 0.25) * 0.12, ray = (Math.floor((a + 1.25) / 0.208) % 2) ? 0.1 : 0;
      return 0.35 + step + ray;
    },
    ziggurat(x, y) { const m = Math.max(Math.abs(x) * 1.2, Math.abs(y)); if (m > 1) return -1; return 0.3 + Math.floor((1 - m) / 0.2) * 0.13; },
    // Art Nouveau lily with whiplash tendrils
    lily(x, y) {
      let h = -1;
      for (const [ang, L] of [[0, 1.1], [0.6, 0.9], [-0.6, 0.9]]) { const l = leafAt(x, y, -0.35, 0, ang, L, 0.22, 1); if (l > 0) h = Math.max(h, 0.3 + 0.55 * l); }
      for (const s of [1, -1]) { const t = Math.abs(y * s - 0.6 - 0.25 * Math.sin(3 * x)); if (x > -0.9 && x < 0.8 && t < 0.07) h = Math.max(h, 0.45 * dome(1 - (t / 0.07) ** 2) + 0.2); }
      return h;
    },
    // Florentine cassetta corner: flat strapwork arabesque (rosette and four spiral scrolls)
    arabesque(x, y) {
      let h = -1; const r = FEAT.rosette(x / 0.45, y / 0.45); if (r > 0) h = 0.4 + 0.6 * r;
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a), lx = x * c + y * s, ly = -x * s + y * c; const v = volute(lx, ly, 0.75, 0.15, 0.06, 0.22, 1, 0.1, 1); if (v > 0) h = Math.max(h, 0.7 * v); const l = leafAt(lx, ly, 0.35, 0, 0.0, 0.42, 0.12, 2); if (l > 0) h = Math.max(h, 0.6 * l); }
      return h;
    },
    // Neoclassical ribbon bow (top centre)
    bow(x, y) {
      let h = -1;
      const ring = (cx, cy, rx, ry, ang) => { const c = Math.cos(ang), s = Math.sin(ang), lx = (x - cx) * c + (y - cy) * s, ly = -(x - cx) * s + (y - cy) * c, q = Math.hypot(lx / rx, ly / ry); return Math.max(0, 1 - Math.abs(q - 0.78) / 0.24); };
      for (const s of [1, -1]) { const g = ring(0.1, 0.45 * s, 0.32, 0.55, 0.35 * s); if (g > 0) h = Math.max(h, 0.25 + 0.6 * g); const t = Math.abs(y - s * (0.15 + 0.35 * (-x))); if (x < 0 && x > -1 && t < 0.09) h = Math.max(h, 0.2 + 0.5 * dome(1 - (t / 0.09) ** 2)); }
      const k = dome(1 - (x * x) / 0.03 - (y * y) / 0.05); if (k > 0) h = Math.max(h, 0.6 + 0.4 * k);
      return h;
    },
    roundel(x, y) { const r = Math.hypot(x, y); if (r > 1) return -1; return 0.3 + 0.35 * dome(1 - r * r) + (Math.abs(r - 0.7) < 0.08 ? 0.15 : 0); }
  };

  // ---------------------------------------------------------------- finishes, wood species, photo sizes
  const FINISHES = {
    gold: { name: 'Silk gold', color: '#d4a64a', metal: 1, rough: 0.3, filament: 'Silk gold PLA', hex: '#D4A64A' },
    antique: { name: 'Antique gold (rubbed)', color: '#b8893a', metal: 1, rough: 0.38, rub: '#7b3420', filament: 'Silk gold PLA', hex: '#B8893A' },
    silver: { name: 'Silver leaf', color: '#cfd2d6', metal: 1, rough: 0.28, filament: 'Silk silver PLA', hex: '#CFD2D6' },
    black: { name: 'Black lacquer', color: '#141414', metal: 0, rough: 0.22, filament: 'Matte black PLA', hex: '#141414' },
    ebony: { name: 'Ebony', color: '#1b1613', metal: 0, rough: 0.35, wood: 'ebony', filament: 'Matte black PLA', hex: '#1B1613' },
    white: { name: 'Gallery white', color: '#efeae0', metal: 0, rough: 0.6, filament: 'Matte white PLA', hex: '#EFEAE0' },
    wood: { name: 'Woodgrain', color: '#8a5a3b', metal: 0, rough: 0.55, wood: true, filament: 'Wood PLA', hex: '#8A5A3B' }
  };
  const SPECIES = {
    walnut: { name: 'Walnut', light: '#8f6040', dark: '#3c2213', spacing: 3.2, pores: 0.55, figure: 0.5, knots: 0.2, filament2: '#3C2213' },
    oak: { name: 'Oak', light: '#cfa06a', dark: '#8b6236', spacing: 2.3, pores: 0.95, figure: 0.35, knots: 0.15, filament2: '#8B6236' },
    cherry: { name: 'Cherry', light: '#bf6c42', dark: '#7a361d', spacing: 2.8, pores: 0.2, figure: 0.4, knots: 0.05, filament2: '#7A361D' },
    maple: { name: 'Maple', light: '#ead3a3', dark: '#c49b62', spacing: 3.8, pores: 0.1, figure: 0.6, knots: 0.05, filament2: '#C49B62' },
    mahogany: { name: 'Mahogany', light: '#9d4b2b', dark: '#561f10', spacing: 4.2, pores: 0.5, figure: 0.8, knots: 0, filament2: '#561F10' },
    ebony: { name: 'Ebony', light: '#3b2d27', dark: '#0e0a09', spacing: 1.6, pores: 0.2, figure: 0.3, knots: 0, filament2: '#0E0A09' },
    pine: { name: 'Rustic pine', light: '#dcb47b', dark: '#9a6a39', spacing: 5.5, pores: 0.05, figure: 0.7, knots: 1, filament2: '#9A6A39' }
  };
  const PHOTO_SIZES = {
    '4x6': [4 * IN, 6 * IN], '5x7': [5 * IN, 7 * IN], '8x10': [8 * IN, 10 * IN], '11x14': [11 * IN, 14 * IN], '16x20': [16 * IN, 20 * IN],
    A5: [148, 210], A4: [210, 297], A3: [297, 420], square8: [8 * IN, 8 * IN]
  };

  // ---------------------------------------------------------------- moulding presets
  const E = (w, a, b, s, x) => Object.assign({ w, a, b, s: s || 'lin' }, x || {});
  const O = (k, d, per, x) => Object.assign({ k, d, per }, x || {});
  // family: basic | classical | ornate | masterpiece. W: face width (mm), D: moulding depth above the 4 mm base (mm).
  // profile runs from the sight edge (next to the picture) to the outer edge. mat: 2 marks the accent colour.
  const PRESETS = [
    { id: 'flat', name: 'Flat', family: 'basic', W: 25, D: 3, finish: 'black', accent: 'gold', blurb: 'A clean flat face with an eased sight edge.',
      profile: [E(0.08, 0.35, 1, 'ovolo'), E(0.88, 1, 1, 'flat'), E(0.04, 1, 0.6, 'ovolo')] },
    { id: 'rounded', name: 'Rounded', family: 'basic', W: 22, D: 8, finish: 'white', accent: 'gold', blurb: 'A soft half-round, friendly on a desk.',
      profile: [E(1, 0.15, 0.15, 'bead', { p: 0.85 })] },
    { id: 'floater', name: 'Shadow floater', family: 'basic', W: 24, D: 9, finish: 'black', accent: 'gold', blurb: 'A recessed shadow line so the picture looks like it floats, with a thin metallic fillet.',
      profile: [E(0.06, 0.4, 0.4, 'flat', { mat: 2 }), E(0.24, 0.1, 0.1, 'flat'), E(0.7, 1, 1, 'flat'), ] },
    { id: 'modern', name: 'Gallery modern', family: 'basic', W: 16, D: 12, finish: 'black', accent: 'gold', blurb: 'Deep, thin and square: the gallery standard.',
      profile: [E(0.12, 0.9, 1, 'ovolo'), E(0.88, 1, 1, 'flat')] },
    { id: 'barnwood', name: 'Barnwood', family: 'basic', W: 40, D: 5, finish: 'wood', species: 'pine', blurb: 'Wide, flat and rustic with knotty pine grain.',
      profile: [E(0.06, 0.4, 1, 'ovolo'), E(0.9, 1, 1, 'flat'), E(0.04, 1, 0.7, 'ovolo')] },

    { id: 'ogee', name: 'Ogee', family: 'classical', W: 40, D: 11, finish: 'wood', species: 'walnut', blurb: 'The classic S-curve rising to a rounded crown.',
      profile: [E(0.08, 0.2, 0.32, 'bead', { p: 0.14 }), E(0.05, 0.3, 0.3, 'flat'), E(0.55, 0.3, 1, 'ogee'), E(0.22, 1, 0.75, 'ovolo'), E(0.1, 0.62, 0.45, 'ovolo')] },
    { id: 'cove', name: 'Cove', family: 'classical', W: 38, D: 10, finish: 'wood', species: 'cherry', blurb: 'A concave sweep that pulls the eye in to the picture.',
      profile: [E(0.06, 0.25, 0.25, 'bead', { p: 0.12 }), E(0.68, 0.25, 1, 'cove'), E(0.16, 1, 0.9, 'ovolo'), E(0.1, 0.8, 0.5, 'ovolo')] },
    { id: 'bead', name: 'Bead and fillet', family: 'classical', W: 32, D: 9, finish: 'antique', accent: 'gold', blurb: 'A pearl bead at the sight edge, a flat fillet and a rounded torus.',
      profile: [E(0.16, 0.4, 0.4, 'bead', { p: 0.3, orn: O('pearls', 1.4, 4.2) }), E(0.14, 0.5, 0.5, 'flat'), E(0.6, 0.5, 0.5, 'bead', { p: 0.5 }), E(0.1, 0.55, 0.4, 'ovolo')] },
    { id: 'scoop', name: 'Scoop', family: 'classical', W: 45, D: 10, finish: 'wood', species: 'oak', blurb: 'A broad scooped panel between two rounded rails.',
      profile: [E(0.12, 0.35, 0.75, 'ovolo'), E(0.62, 0.75, 0.75, 'scoop', { p: 0.4 }), E(0.16, 0.75, 1, 'ovolo'), E(0.1, 1, 0.7, 'ovolo')] },
    { id: 'stepped', name: 'Stepped', family: 'classical', W: 36, D: 12, finish: 'black', accent: 'gold', blurb: 'Three crisp steps up from the picture with a gilt inner lip.',
      profile: [E(0.1, 0.2, 0.25, 'bead', { p: 0.12, mat: 2 }), E(0.27, 0.42, 0.42, 'flat'), E(0.27, 0.7, 0.7, 'flat'), E(0.36, 1, 1, 'flat')] },
    { id: 'swept', name: 'Swept', family: 'classical', W: 44, D: 12, finish: 'gold', accent: 'black', blurb: 'The outline swells at the corners and centers, the classic gilt-salon frame.',
      sweep: { amp: 0.45, sigma: 0.75, at: 'both' },
      profile: [E(0.1, 0.25, 0.35, 'bead', { p: 0.12 }), E(0.45, 0.35, 1, 'cove'), E(0.3, 1, 0.75, 'ovolo'), E(0.15, 0.7, 0.45, 'ovolo')] },

    { id: 'baroque', name: 'Baroque', family: 'ornate', W: 62, D: 15, finish: 'antique', accent: 'gold', blurb: 'Deep carved gilt: acanthus corners, a gadrooned torus and a pearl sight.',
      profile: [E(0.08, 0.15, 0.25, 'bead', { p: 0.12, orn: O('pearls', 1.1, 3.6) }), E(0.28, 0.25, 0.9, 'cove'), E(0.24, 0.9, 0.9, 'bead', { p: 0.12, orn: O('gadroon', 2.2, 10) }), E(0.28, 0.85, 0.4, 'ogee', { orn: O('acanthus', 1.6, 22) }), E(0.12, 0.42, 0.3, 'ovolo', { orn: O('beadreel', 0.9, 7) })],
      features: [{ at: 'corner', k: 'acanthus', s: 0.48, f0: 0.55, lvl: 0.85, h: 3.2 }, { at: 'center', k: 'acanthus', s: 0.4, f0: 0.55, lvl: 0.85, h: 2.6 }] },
    { id: 'victorian', name: 'Victorian', family: 'ornate', W: 52, D: 12, finish: 'wood', species: 'mahogany', accent: 'gold', blurb: 'A carved hardwood body with corner blocks and a gilt bead-and-reel sight slip.',
      profile: [E(0.12, 0.2, 0.3, 'bead', { p: 0.2, mat: 2, orn: O('beadreel', 1, 6.5) }), E(0.38, 0.3, 0.95, 'cove', { orn: O('flutes', 0.9, 4) }), E(0.3, 0.95, 0.9, 'bead', { p: 0.2, orn: O('rope', 1.1, 6) }), E(0.2, 0.9, 0.55, 'ovolo')],
      features: [{ at: 'corner', k: 'block', s: 0.52, f0: 0.52, lvl: 0.95, h: 2.5 }] },
    { id: 'neoclassical', name: 'Neoclassical', family: 'ornate', W: 50, D: 11, finish: 'gold', accent: 'black', blurb: 'Restrained Louis XVI gilt: laurel, beading, a ribbon bow crest.',
      profile: [E(0.1, 0.25, 0.3, 'bead', { p: 0.16, orn: O('pearls', 1, 3.4) }), E(0.12, 0.35, 0.35, 'flat'), E(0.4, 0.4, 0.95, 'ogee', { orn: O('laurel', 1.5, 15) }), E(0.12, 1, 1, 'flat'), E(0.26, 0.95, 0.5, 'ovolo', { orn: O('ribbon', 1.1, 11) })],
      features: [{ at: 'corner', k: 'rosette', s: 0.3, f0: 0.52, lvl: 0.75, h: 2.2 }, { at: 'top', k: 'bow', s: 0.55, f0: 0.5, lvl: 0.9, h: 2.5 }] },
    { id: 'artdeco', name: 'Art Deco', family: 'ornate', W: 46, D: 13, finish: 'black', accent: 'silver', blurb: 'Stepped lacquer with silver chevrons and sunburst corners.',
      profile: [E(0.1, 0.25, 0.25, 'flat', { mat: 2 }), E(0.2, 0.45, 0.45, 'flat'), E(0.3, 0.7, 0.7, 'flat', { mat: 2, orn: O('chevron', 0.9, 9) }), E(0.4, 1, 1, 'flat')],
      features: [{ at: 'corner', k: 'sunburst', s: 0.62, f0: 0.62, lvl: 0.75, h: 2.4, mat: 2 }] },
    { id: 'nouveau', name: 'Art Nouveau', family: 'ornate', W: 48, D: 10, finish: 'wood', species: 'cherry', blurb: 'Whiplash tendrils and lilies on a soft cove.',
      profile: [E(0.1, 0.2, 0.3, 'ovolo'), E(0.62, 0.3, 0.9, 'cove', { orn: O('whiplash', 1.4, 34) }), E(0.28, 0.9, 0.5, 'ovolo')],
      features: [{ at: 'corner', k: 'lily', s: 0.55, f0: 0.55, lvl: 0.7, h: 2.6 }] },

    { id: 'royal', name: 'Royal Gilt (Louis XIV)', family: 'masterpiece', W: 85, D: 19, finish: 'antique', accent: 'gold', pro: true,
      blurb: 'The palace frame: leaf-tip sight, a sanded frieze, gadrooned torus, cross-hatched reverse ogee and carved shell cartouches at every corner and center.',
      profile: [E(0.1, 0.12, 0.3, 'ovolo', { orn: O('leaftip', 1.4, 7) }), E(0.2, 0.28, 0.28, 'scoop', { p: 0.06, tex: O('sanded', 0.35, 1) }), E(0.06, 0.32, 0.32, 'bead', { p: 0.1, orn: O('pearls', 0.7, 2.8) }), E(0.24, 0.36, 1, 'ovolo', { orn: O('gadroon', 2, 12) }), E(0.27, 1, 0.42, 'rogee', { orn: O('acanthus', 1.4, 26), tex: O('hatch', 0.3, 1.6) }), E(0.13, 0.42, 0.25, 'ovolo', { orn: O('eggdart', 1.4, 11) })],
      features: [{ at: 'corner', k: 'shell', s: 0.5, f0: 0.62, lvl: 0.9, h: 4.5 }, { at: 'center', k: 'shell', s: 0.42, f0: 0.62, lvl: 0.9, h: 3.8 }],
      filaments: ['Silk gold PLA (body)', 'Matte red-brown PLA for an optional bole underlayer test'],
      tips: ['Print at 0.12 mm layers, face up, 3 walls; ironing off so the carving stays crisp.', 'Rub a dark umber or black wax into the cross-hatching and sanded frieze, wipe back the high points.', 'Burnish the gadroons and shell ribs with gilding wax (gold leaf color) on a fingertip: that contrast is what reads as water-gilded.', 'A final thin coat of matte varnish on the frieze, satin on the torus.'] },
    { id: 'rococo', name: 'Rococo Swept', family: 'masterpiece', W: 80, D: 17, finish: 'gold', accent: 'black', pro: true,
      blurb: 'Louis XV salon frame: the outline itself swells into rocaille cartouches, flower sprays and C-scrolls over a cross-hatched ground.',
      sweep: { amp: 0.5, sigma: 0.55, at: 'both' },
      profile: [E(0.12, 0.15, 0.3, 'bead', { p: 0.12, orn: O('pearls', 0.9, 3.4) }), E(0.48, 0.3, 1, 'cove', { tex: O('hatch', 0.3, 1.5) }), E(0.25, 1, 0.65, 'ovolo', { orn: O('rope', 0.9, 7) }), E(0.15, 0.62, 0.3, 'ovolo')],
      features: [{ at: 'corner', k: 'rocaille', s: 0.55, f0: 0.58, lvl: 0.8, h: 5 }, { at: 'center', k: 'rocaille', s: 0.45, f0: 0.58, lvl: 0.8, h: 4.2 }],
      filaments: ['Silk gold PLA (or silk bronze for a warmer leaf)'],
      tips: ['Print 0.12 mm layers; the cartouche reaches about 22 mm tall so slow the outer wall for a clean silhouette.', 'Prime the hatch ground with a dark brown wash, then dry-brush gilding wax over the scrolls and shell ribs.', 'Leave the recesses dull and polish only the crests: matte against bright is the Rococo look.'] },
    { id: 'cassetta', name: 'Florentine Cassetta', family: 'masterpiece', W: 78, D: 13, finish: 'gold', accent: 'black', pro: true,
      blurb: 'Renaissance box frame: a wide flat black frieze framed by gilt moldings, punched sight edge and gilt arabesque corners.',
      profile: [E(0.1, 0.15, 0.35, 'ovolo', { orn: O('punch', 0.6, 2.2) }), E(0.06, 0.38, 0.38, 'bead', { p: 0.12, orn: O('beadreel', 0.6, 4.5) }), E(0.5, 0.5, 0.5, 'flat', { mat: 2 }), E(0.1, 0.55, 0.8, 'ovolo'), E(0.24, 0.85, 0.6, 'ovolo', { orn: O('eggdart', 1.2, 10) })],
      features: [{ at: 'corner', k: 'arabesque', s: 0.4, f0: 0.42, lvl: 0.5, h: 1.6 }, { at: 'center', k: 'arabesque', s: 0.3, f0: 0.42, lvl: 0.5, h: 1.4 }],
      filaments: ['Silk gold PLA (body)', 'Matte black PLA (frieze)'],
      tips: ['With a multi-color printer, print the color 3MF: the black frieze skin swaps in on its top layers.', 'Without one, mask the gilt and paint the frieze matte black; then pick out the arabesque in gilding wax with a small brush.', 'Seal the black with matte varnish so it reads like ebonised wood.'] },
    { id: 'dutch', name: 'Dutch Ebony Ripple', family: 'masterpiece', W: 70, D: 14, finish: 'ebony', accent: 'gold', pro: true,
      blurb: 'Golden Age Dutch frame: wide ebony with machine-cut ripple and wave bands and a slim gilt sight fillet.',
      profile: [E(0.07, 0.2, 0.25, 'bead', { p: 0.12, mat: 2 }), E(0.15, 0.3, 0.5, 'ovolo', { orn: O('ripple', 0.6, 1.6) }), E(0.08, 0.5, 0.5, 'flat'), E(0.36, 0.55, 1, 'cove', { orn: O('wave', 0.55, 2.2) }), E(0.08, 1, 1, 'flat'), E(0.18, 1, 0.55, 'ovolo', { orn: O('flame', 0.6, 1.8) }), E(0.08, 0.55, 0.45, 'ovolo', { orn: O('ripple', 0.5, 1.4) })],
      filaments: ['Matte black PLA (body)', 'Silk gold PLA (sight fillet)'],
      tips: ['Use 0.08 to 0.12 mm layers: the ripple is fine and catches light only when crisp.', 'Buff the black with a little black wax and a soft cloth for an ebony sheen; do not paint the ripples.', 'Touch the sight fillet with gilding wax if printed in one color.'] },
    { id: 'gilded', name: 'Gilded Age Reeded', family: 'masterpiece', W: 72, D: 14, finish: 'gold', accent: 'black', pro: true,
      blurb: 'American Gilded Age: bundled reeds, a twisted rope, a black Greek-key frieze and ribbon-and-stick at the edge.',
      profile: [E(0.1, 0.2, 0.35, 'bead', { p: 0.12, orn: O('rope', 0.9, 5) }), E(0.26, 0.4, 0.4, 'flat', { mat: 2, groundOnly: true, orn: O('greekkey', 1.1, 21) }), E(0.28, 0.45, 1, 'reeds', { n: 7, p: 0.05, orn: O('reeds', 0.8, 1, { n: 7 }) }), E(0.08, 1, 0.95, 'bead', { p: 0.1, orn: O('pearls', 0.8, 3.2) }), E(0.28, 0.95, 0.45, 'ovolo', { orn: O('ribbon', 1.1, 12) })],
      features: [{ at: 'corner', k: 'roundel', s: 0.26, f0: 0.24, lvl: 0.42, h: 1.8 }],
      filaments: ['Silk gold PLA (body)', 'Matte black PLA (Greek key frieze)'],
      tips: ['Multi-color printer: print the color 3MF so the frieze comes out black with the gold key raised through it.', 'Single color: paint the frieze black, then rub gilding wax across the key with a flat brush so only the raised key turns gold.', 'Polish the reeds lengthwise with a cloth: the long highlights make the molding look turned.'] }
  ];
  const FAMILY = { basic: 'Basic', classical: 'Classical', ornate: 'Ornate', masterpiece: 'Masterpiece' };
  const byId = id => PRESETS.find(p => p.id === id) || PRESETS[0];

  // ---------------------------------------------------------------- outline paths (rails)
  // Sight opening (the visible window) of size sw x sh, shape rect | oval | round | arch.
  function rails(shape, sw, sh) {
    const R = [];
    const line = (A, B, k0, k1) => { const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), t = [dx / L, dy / L]; R.push({ type: 'line', A, B, L, t, n: [t[1], -t[0]], k0, k1 }); };
    if (shape === 'oval' || shape === 'round') {
      const a = shape === 'round' ? Math.min(sw, sh) / 2 : sw / 2, b = shape === 'round' ? a : sh / 2, K = 2048, th = new Float64Array(K + 1), s = new Float64Array(K + 1);
      for (let k = 1; k <= K; k++) { const t0 = (k - 1) / K * TAU, t1 = k / K * TAU; s[k] = s[k - 1] + Math.hypot(a * (Math.cos(t1) - Math.cos(t0)), b * (Math.sin(t1) - Math.sin(t0))); }
      const P = s[K]; for (let k = 0; k <= K; k++) s[k] /= P;
      // theta at arc-length fraction c, starting at the bottom (theta = -pi/2) so seams sit where the eye forgives them
      const thetaAt = c => { c = frac(c + 0.75 * 0); let lo = 0, hi = K; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= c) lo = m; else hi = m; } const f = (c - s[lo]) / Math.max(1e-12, s[hi] - s[lo]); return (lo + f) / K * TAU; };
      R.push({ type: 'ell', a, b, P, thetaAt, closed: true });
    } else if (shape === 'arch') {
      const r = sw / 2, yb = -sh / 2, yc = Math.max(yb + 2, sh / 2 - r);
      line([-r, yb], [r, yb], 1, 1); line([r, yb], [r, yc], 1, 0);
      R.push({ type: 'arc', C: [0, yc], r, a0: 0, da: Math.PI });
      line([-r, yc], [-r, yb], 0, 1);
    } else {
      const x = sw / 2, y = sh / 2;
      line([-x, -y], [x, -y], 1, 1); line([x, -y], [x, y], 1, 1); line([x, y], [-x, y], 1, 1); line([-x, y], [-x, -y], 1, 1);
    }
    return R;
  }
  // point and direction of the column at c on a rail. Rows move along m by u: perpendicular distance u from the sight line.
  function railAt(r, c) {
    if (r.type === 'line') { const k = c * (r.k0 + r.k1) - r.k0; return { px: r.A[0] + c * (r.B[0] - r.A[0]), py: r.A[1] + c * (r.B[1] - r.A[1]), mx: r.n[0] + k * r.t[0], my: r.n[1] + k * r.t[1], tx: r.t[0], ty: r.t[1] }; }
    if (r.type === 'arc') { const a = r.a0 + c * r.da, ca = Math.cos(a), sa = Math.sin(a); return { px: r.C[0] + r.r * ca, py: r.C[1] + r.r * sa, mx: ca, my: sa, tx: -sa, ty: ca }; }
    const th = r.thetaAt(c) - Math.PI / 2, ct = Math.cos(th), st = Math.sin(th), nx = r.b * ct, ny = r.a * st, nl = Math.hypot(nx, ny);
    return { px: r.a * ct, py: r.b * st, mx: nx / nl, my: ny / nl, tx: -ny / nl, ty: nx / nl };
  }
  function bandLen(r, u) { if (r.type === 'line') return r.L + u * (r.k0 + r.k1); if (r.type === 'arc') return (r.r + u) * Math.abs(r.da); return r.P + TAU * u; }

  // ---------------------------------------------------------------- sizes: sight, glass, rabbet
  // Photo p (mm). The mat window overlaps the photo 3 mm a side; the frame lip covers the glass edge.
  function dims(o) {
    const pr = byId(o.preset), ph = o.photo || PHOTO_SIZES['8x10'];
    let pw = ph[0], phh = ph[1]; if (o.landscape) [pw, phh] = [phh, pw];
    const mb = o.mat ? Math.max(0, +o.matBorder || 0) : 0, lip = clamp(+o.lip || 6, 3, 20), tol = clamp(o.tol == null ? 0.6 : +o.tol, 0, 3);
    const ov = 3, S = [pw - 2 * ov + 2 * mb, phh - 2 * ov + 2 * mb];
    if (o.shape === 'round') { const d = Math.min(S[0], S[1]); S[0] = S[1] = d; }
    const G = [S[0] + 2 * lip, S[1] + 2 * lip], R = [G[0] + 2 * tol, G[1] + 2 * tol];
    const glazing = o.glazing === 'none' ? 0 : clamp(o.glazingT == null ? 2 : +o.glazingT, 0, 6);
    const matT = o.mat ? clamp(o.matT == null ? 1.5 : +o.matT, 0.6, 4) : 0, photoT = clamp(o.photoT == null ? 0.3 : +o.photoT, 0, 3), backT = clamp(o.backT == null ? 2 : +o.backT, 0, 6);
    const stack = glazing + matT + photoT + backT + 0.4;
    const inset = 1.5, minW = lip + tol + inset + 8;
    const W = Math.max(minW, +o.W || pr.W), D = Math.max(0, o.D == null ? pr.D : +o.D), Bb = 4;
    return { pr, photo: [pw, phh], mb, lip, tol, S, G, R, glazing, matT, photoT, backT, stack, inset, minW, W, D, Bb, ringT: Math.max(2, stack), uIn: lip + tol, uOut: W - inset, window: [pw - 2 * ov, phh - 2 * ov] };
  }

  // ---------------------------------------------------------------- the front moulding grid
  // grid spacing (mm) and vertex budget per detail level. Every carved vertex is also supersampled (AA x AA samples
  // spread over its cell) so outlines and cliffs land between grid lines instead of stair-stepping along them.
  const DETAIL = { draft: 0.8, standard: 0.4, fine: 0.25 };
  const BUDGET = { draft: 250000, standard: 640000, fine: 1300000 };
  const AA = { draft: 1, standard: 3, fine: 3 };
  function anchorsFor(R, shape) {
    const A = [];
    const add = (ri, c, kind) => { const q = railAt(R[ri], c), ml = Math.hypot(q.mx, q.my); A.push({ ri, c, kind, px: q.px, py: q.py, mx: q.mx, my: q.my, ex: q.mx / ml, ey: q.my / ml }); };
    if (shape === 'rect') { for (let i = 0; i < 4; i++) { add(i, 0, 'corner'); add(i, 0.5, i === 2 ? 'top' : 'center'); } }
    else if (shape === 'arch') { add(0, 0, 'corner'); add(1, 0, 'corner'); add(0, 0.5, 'center'); add(2, 0.5, 'top'); add(2, 0.2, 'corner'); add(2, 0.8, 'corner'); }
    else { for (let k = 0; k < 4; k++) { add(0, k / 4 + 0.125, 'corner'); add(0, k / 4, k === 2 ? 'top' : 'center'); } }
    return A;
  }
  function speciesOf(o, pr) { const f = o.finish || pr.finish; if (f === 'ebony') return SPECIES.ebony; if (f !== 'wood') return null; return SPECIES[o.species || pr.species || 'walnut'] || SPECIES.walnut; }

  // wood: rings of a log lying along the rail below the board, warped, with pores and knots. Returns [latewood 0..1, pore 0..1].
  function grainAt(sp, seed, along, u, z, scale, res) {
    const s = sp.spacing * (scale || 1), w = sp.figure * s * 2.2 * (fbm(along / 45, u / 9, seed, 4) - 0.5) + 0.5 * s * (vnoise(along / 6, u / 2.5, seed + 5) - 0.5);
    const u0 = (hash2(seed, 3, 7) - 0.5) * 30, z0 = 18 + hash2(seed, 5, 9) * 40, tilt = (hash2(seed, 7, 11) - 0.5) * 0.06;
    let r = Math.sqrt((u - u0) * (u - u0) + (z + z0) * (z + z0)) + along * tilt + w;
    let knot = 0;
    if (sp.knots) for (let k = 0; k < 3; k++) {
      if (hash2(seed, k, 21) > sp.knots * 0.9) continue;
      const ka = hash2(seed, k, 23) * 600, ku = hash2(seed, k, 29) * 40, d = Math.hypot(along - ka, (u - ku) * 1.6), rk = 3 + hash2(seed, k, 31) * 4;
      r += 3.5 * s * Math.exp(-(((d / (rk * 2.5)) ** 2))); knot = Math.max(knot, Math.exp(-(((d / rk) ** 2))));
    }
    // the latewood band's falling edge is widened to at least a grid cell, so it shades smoothly instead of in steps
    const aa = clamp((res || 0) * 1.2 / s, 0.07, 0.3), ph = frac(r / s), lw = Math.max(smooth(0.62 - aa * 0.5, 0.9 - aa * 0.5, ph) * (1 - smooth(1 - aa, 1, ph)), knot);
    const pore = sp.pores * smooth(0.72, 0.9, vnoise(along / 2.2, u / 0.22, seed + 13));
    return [clamp(lw, 0, 1), pore];
  }

  function build(o) {
    o = Object.assign({ preset: 'ogee', shape: 'rect', detail: 'standard' }, o || {});
    const d = dims(o), pr = d.pr, W = d.W, D = d.D, Bb = d.Bb, shape = ['rect', 'oval', 'round', 'arch'].includes(o.shape) ? o.shape : 'rect';
    const R = rails(shape, d.S[0], d.S[1]), anchors = anchorsFor(R, shape), sp = speciesOf(o, pr), seed = (o.seed | 0) || 7;
    const prof = pr.profile, sweep = pr.sweep && o.sweep !== false ? pr.sweep : null;
    // resolution: the detail level, coarsened to stay inside the vertex budget
    const perim = R.reduce((s, r) => s + bandLen(r, W * 0.6), 0), area = perim * W * (sweep ? 1 + sweep.amp * 0.5 : 1);
    let res = DETAIL[o.detail] || DETAIL.standard; res = Math.max(res, Math.sqrt(area / (BUDGET[o.detail] || BUDGET.standard)));
    // rows across the moulding (t in [0,1]); a repeated row at a vertical step between elements
    const tw = prof.reduce((s, e) => s + e.w, 0), T = [], TE = [], TV = [];
    let t0 = 0;
    prof.forEach((e, k) => {
      const w = e.w / tw, n = Math.max(e.orn || e.tex ? 4 : 2, Math.ceil(w * W * (sweep ? 1 + sweep.amp * 0.6 : 1) / res));
      const prev = prof[k - 1], step = prev && Math.abs(elemH(prev, 1) - elemH(e, 0)) * D > 0.05;
      for (let q = (k && !step) ? 1 : 0; q <= n; q++) { T.push(t0 + w * q / n); TE.push(k); TV.push(q / n); }
      e._t0 = t0; e._t1 = t0 + w; t0 += w;
    });
    const ny = T.length;
    // columns along the rails
    const cr = [], cc = [];
    R.forEach((r, ri) => { let N = Math.max(8, Math.ceil(bandLen(r, W * 0.6) / res)); if (R.length === 1 && N % 2) N++; /* even: an oval or round then cuts on one plane */ for (let k = 0; k < N; k++) { cr.push(ri); cc.push(k / N); } r._n = N; });
    const nx = cr.length, CP = new Float64Array(nx * 4), CW = new Float64Array(nx), CA = new Float64Array(nx);
    for (let i = 0; i < nx; i++) { const q = railAt(R[cr[i]], cc[i]); CP[i * 4] = q.px; CP[i * 4 + 1] = q.py; CP[i * 4 + 2] = q.mx; CP[i * 4 + 3] = q.my; CA[i] = cc[i] * bandLen(R[cr[i]], W * 0.5); }
    // swept outline: the moulding widens around the corners and centres
    const sweepAt = sweep ? anchors.filter(a => sweep.at === 'both' || (sweep.at === 'corner' ? a.kind === 'corner' : a.kind !== 'corner')) : [];
    for (let i = 0; i < nx; i++) {
      let w = 1;
      if (sweep) { const qx = CP[i * 4] + CP[i * 4 + 2] * W * 0.5, qy = CP[i * 4 + 1] + CP[i * 4 + 3] * W * 0.5; let s = 0; for (const a of sweepAt) { const dx = qx - (a.px + a.mx * W * 0.5), dy = qy - (a.py + a.my * W * 0.5), sg = sweep.sigma * W * (a.kind === 'corner' ? 1.15 : 1); s += Math.exp(-(dx * dx + dy * dy) / (sg * sg)); } w = 1 + sweep.amp * Math.min(1, s); }
      CW[i] = w;
    }
    // whole motifs per rail for every element's running ornament
    const NM = R.map(r => prof.map(e => { const um = W * (e._t0 + e._t1) / 2, x = e.orn || e.tex; return x ? Math.max(1, Math.round(bandLen(r, um) / x.per)) : 0; }));
    const feats = (pr.features || []).filter(() => o.features !== false).flatMap(f => anchors.filter(a => f.at === a.kind || (f.at === 'center' && a.kind === 'top' && !(pr.features || []).some(g => g.at === 'top'))).map(a => {
      const ri = a.ri, wq = sweep ? 1 + sweep.amp : 1, Rs = f.s * W, u = W * wq * f.f0;
      return { f, fn: FEAT[f.k], Rs, ox: a.px + a.mx * u, oy: a.py + a.my * u, ex: a.ex, ey: a.ey, lim: (Rs * 2) * (Rs * 2), ri };
    }));
    const n = nx * ny, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), REG = new Uint8Array(n), SH = new Float32Array(n), ORNV = new Float32Array(n);
    const scl = o.grainScale || 1, gdep = o.grainRelief === false || !sp ? 0 : (o.grainDepth == null ? 0.25 : +o.grainDepth), wsplit = !!(sp && o.woodSplit);
    // carved height (no grain) at rail ri, column fraction c, element e at v; position (x, y), sweep width w
    let oOv = 0, oReg = 1;
    const carve = (ri, c, ek, e, v, x, y, w, t, fl) => {
      let z = Bb + D * elemH(e, v), ov = 0, reg = e.mat === 2 ? 2 : 1;
      const Ew = (e._t1 - e._t0) * W * w, u = t * W * w;
      if (e.orn) { const nm = NM[ri][ek], f = c * nm, P = bandLen(R[ri], W * (e._t0 + e._t1) / 2) / nm; ov = ORN[e.orn.k](f, v, P, Ew, e.orn, c * bandLen(R[ri], u), v * Ew); z += e.orn.d * ov; if (reg === 2 && e.groundOnly && ov > 0.35) reg = 1; }
      if (e.tex) { const X0 = c * bandLen(R[ri], u), Y0 = v * Ew, tv = ORN[e.tex.k](c, v, e.tex.per, Ew, e.tex, X0, Y0) * smooth(0, 0.08, v) * (1 - smooth(0.92, 1, v)); z += e.tex.d * tv; ov = Math.min(ov, tv); }
      if (fl.length && t > 0.015 && t < 0.985) for (const F of fl) {
        const dx = x - F.ox, dy = y - F.oy; if (dx * dx + dy * dy > F.lim) continue;
        const fx = (dx * F.ex + dy * F.ey) / F.Rs, fy = (-dx * F.ey + dy * F.ex) / F.Rs, h = F.fn(fx, fy);
        if (h > 0) { const zf = Bb + D * F.f.lvl + F.f.h * h; if (zf > z) { z = zf; ov = h; reg = F.f.mat === 2 ? 2 : 1; } }
      }
      oOv = ov; oReg = reg; return z;
    };
    // supersampling: AA x AA samples over the cell around each carved vertex (ornament, texture or a feature nearby)
    const aaN = sp && !prof.some(e => e.orn || e.tex) && !feats.length ? 1 : (o.aa != null ? +o.aa : (AA[o.detail] || AA.standard)), offs = [];
    for (let a = 0; a < aaN; a++) offs.push((a + 0.5) / aaN - 0.5);
    const EN = prof.map((e, k) => { let c = 0; for (let j = 0; j < ny; j++) if (TE[j] === k) c++; return Math.max(1, c - 1); });
    // pass 1: the carved height at every vertex; the features whose reach crosses each column
    const ZC = new Float32Array(n), FL = new Array(nx);
    for (let i = 0; i < nx; i++) {
      const ri = cr[i], c = cc[i], px = CP[i * 4], py = CP[i * 4 + 1], mx = CP[i * 4 + 2], my = CP[i * 4 + 3], w = CW[i];
      const fl = FL[i] = feats.filter(F => { const dx = px + mx * W * 0.5 - F.ox, dy = py + my * W * 0.5 - F.oy; return dx * dx + dy * dy < (Math.sqrt(F.lim) + W * w * Math.hypot(mx, my) + 2 * res) ** 2; });
      for (let j = 0; j < ny; j++) {
        const k = j * nx + i, t = T[j], ek = TE[j], u = t * W * w;
        ZC[k] = carve(ri, c, ek, prof[ek], TV[j], px + mx * u, py + my * u, w, t, fl); REG[k] = oReg; ORNV[k] = oOv;
      }
    }
    // pass 2: supersample the carved vertices where the surface bends sharply (an outline, a cliff, a crease), which is
    // where a single sample per cell would alias into steps; smooth carving is already exact at the grid spacing
    const thr = 0.1;
    let nAA = 0;
    for (let i = 0; i < nx; i++) {
      const ri = cr[i], c = cc[i], px = CP[i * 4], py = CP[i * 4 + 1], mx = CP[i * 4 + 2], my = CP[i * 4 + 3], w = CW[i], rseed = seed * 31 + ri * 101, dc = 1 / R[ri]._n, fl = FL[i];
      const il = (i + nx - 1) % nx, ir = (i + 1) % nx;
      let sub = null;
      for (let j = 0; j < ny; j++) {
        const k = j * nx + i, t = T[j], ek = TE[j], e = prof[ek], v = TV[j], u = t * W * w, x = px + mx * u, y = py + my * u;
        let z = ZC[k];
        if (aaN > 1 && (e.orn || e.tex || fl.length)) {
          const zl = ZC[j * nx + il], zr = ZC[j * nx + ir], jd = j > 0 && TE[j - 1] === ek ? j - 1 : j, ju = j < ny - 1 && TE[j + 1] === ek ? j + 1 : j;
          const d2c = Math.abs(zl + zr - 2 * z), d2r = jd !== j && ju !== j ? Math.abs(ZC[jd * nx + i] + ZC[ju * nx + i] - 2 * z) : Math.abs(ZC[jd * nx + i] - ZC[ju * nx + i]) * 0.5;
          if (d2c > thr || d2r > thr) {
            if (!sub) sub = offs.map(a => railAt(R[ri], c + a * dc));
            const dv = 1 / EN[ek]; let sz = 0, cnt = 0;
            for (let a = 0; a < aaN; a++) {
              const q = sub[a], ca = c + offs[a] * dc;
              for (let b = 0; b < aaN; b++) {
                const vb = clamp(v + offs[b] * dv, 0, 1), tb = e._t0 + (e._t1 - e._t0) * vb, ub = tb * W * w;
                sz += carve(ri, ca, ek, e, vb, q.px + q.mx * ub, q.py + q.my * ub, w, tb, fl); cnt++;
              }
            }
            z = sz / cnt; nAA++;
          }
        }
        if (sp) { const g = grainAt(sp, rseed, CA[i], u, z, scl, res); SH[k] = g[0] * 0.8 + g[1] * 0.5; z -= gdep * (g[0] * 0.8 + g[1] * 0.4); if (wsplit && g[0] > 0.5) REG[k] = 2; }
        X[k] = x; Y[k] = y; Z[k] = Math.max(0.8, z);
      }
    }
    // rows that share a position (an element boundary) keep one height where the profile is continuous, so smoothing
    // never opens a micro step there that the joint cuts would then have to slice
    for (let j = 0; j < ny - 1; j++) if (Math.abs(T[j + 1] - T[j]) < 1e-12) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (Math.abs(ZC[k] - ZC[k + nx]) < 1e-6) Z[k + nx] = Z[k]; }
    // the sight and outer edges get a small chamfer-free flat 0.4 mm so walls print clean (no knife edge)
    for (let i = 0; i < nx; i++) { Z[i] = Math.max(Z[i], 1.2); Z[(ny - 1) * nx + i] = Math.max(Z[(ny - 1) * nx + i], 1.2); }
    let H = 0; for (let k = 0; k < n; k++) if (Z[k] > H) H = Z[k];
    // each grid cell is split along the diagonal whose corners are closer in height: the triangle edges then follow
    // carved outlines and ridges instead of zig-zagging across them
    const DG = new Uint8Array(n);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) { const i1 = (i + 1) % nx, a = Z[j * nx + i], b = Z[j * nx + i1], c = Z[(j + 1) * nx + i1], dd = Z[(j + 1) * nx + i]; if (Math.abs(b - dd) < Math.abs(a - c) - 1e-4) DG[j * nx + i] = 1; }
    const model = { o, d, pr, shape, R, anchors, res, aa: aaN, nAA, nx, ny, DG, T, TE, cr, cc, CP, CW, X, Y, Z, REG, SH, ORNV, H, sp, seed, W, D };
    applyDefaultLip(model);
    model.plan = planPieces(model, o);
    return model;
  }

  // ---------------------------------------------------------------- the front as one closed solid (or a column range)
  // top grid, the sight wall (row 0), the outer wall (last row) and flat bottom strips joining the two wall feet.
  function frontSolid(m, i0, i1, zOff) {
    const { nx, ny, X, Y, Z } = m, DG = m.DG, top = ny - 1, whole = i0 == null, cols = whole ? nx : i1 - i0, zo = zOff || 0;
    const out = new Float64Array((cols * (ny - 1) * 2 + cols * 6) * 9 + (whole ? 0 : (ny - 1) * 4 * 9)); let o = 0;
    const g = (i, j) => (j * nx + ((i % nx) + nx) % nx);
    const tri = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      if ((ax === bx && ay === by && az === bz) || (bx === cx && by === cy && bz === cz) || (ax === cx && ay === cy && az === cz)) return;
      out[o++] = ax; out[o++] = ay; out[o++] = az; out[o++] = bx; out[o++] = by; out[o++] = bz; out[o++] = cx; out[o++] = cy; out[o++] = cz;
    };
    const s = whole ? 0 : i0;
    for (let q = 0; q < cols; q++) {
      const i = s + q, i1x = i + 1;
      for (let j = 0; j < top; j++) {
        const a = g(i, j), b = g(i1x, j), c = g(i1x, j + 1), dd = g(i, j + 1);
        if (DG && DG[a]) { tri(X[a], Y[a], Z[a] + zo, X[b], Y[b], Z[b] + zo, X[dd], Y[dd], Z[dd] + zo); tri(X[b], Y[b], Z[b] + zo, X[c], Y[c], Z[c] + zo, X[dd], Y[dd], Z[dd] + zo); }
        else { tri(X[a], Y[a], Z[a] + zo, X[b], Y[b], Z[b] + zo, X[c], Y[c], Z[c] + zo); tri(X[a], Y[a], Z[a] + zo, X[c], Y[c], Z[c] + zo, X[dd], Y[dd], Z[dd] + zo); }
      }
      const a = g(i, 0), b = g(i1x, 0), c = g(i1x, top), dd = g(i, top);
      // sight wall (outward = toward the opening)
      tri(X[a], Y[a], zo, X[b], Y[b], zo, X[b], Y[b], Z[b] + zo); tri(X[a], Y[a], zo, X[b], Y[b], Z[b] + zo, X[a], Y[a], Z[a] + zo);
      // outer wall
      tri(X[c], Y[c], zo, X[dd], Y[dd], zo, X[dd], Y[dd], Z[dd] + zo); tri(X[c], Y[c], zo, X[dd], Y[dd], Z[dd] + zo, X[c], Y[c], Z[c] + zo);
      // bottom strip
      tri(X[a], Y[a], zo, X[dd], Y[dd], zo, X[c], Y[c], zo); tri(X[a], Y[a], zo, X[c], Y[c], zo, X[b], Y[b], zo);
    }
    if (!whole) for (const [i, sg] of [[i0, 1], [i1, -1]]) for (let j = 0; j < top; j++) {
      const a = g(i, j), b = g(i, j + 1);
      if (sg > 0) { tri(X[a], Y[a], zo, X[a], Y[a], Z[a] + zo, X[b], Y[b], Z[b] + zo); tri(X[a], Y[a], zo, X[b], Y[b], Z[b] + zo, X[b], Y[b], zo); }
      else { tri(X[a], Y[a], zo, X[b], Y[b], Z[b] + zo, X[a], Y[a], Z[a] + zo); tri(X[a], Y[a], zo, X[b], Y[b], zo, X[b], Y[b], Z[b] + zo); }
    }
    return Tools.fixSign ? Tools.fixSign(out.subarray(0, o)) : fixSignLocal(out.subarray(0, o));
  }
  function fixSignLocal(p) { return Core.signedVolume(p) < 0 ? Core.flip(p) : p; }

  // ---------------------------------------------------------------- where the front is cut so each piece fits the bed
  function colLine(m, i, u) { i = ((i % m.nx) + m.nx) % m.nx; const k = i * 4, w = m.CW[i]; return [m.CP[k] + m.CP[k + 2] * m.W * w * u, m.CP[k + 1] + m.CP[k + 3] * m.W * w * u]; }
  // smallest bounding rectangle over turns of 0..89 degrees (points in XY)
  function fitRect(pts, B) {
    let best = null;
    for (let a = 0; a < 90; a += 1) {
      const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
      let x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18;
      for (const p of pts) { const x = p[0] * c - p[1] * s, y = p[0] * s + p[1] * c; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const w = x1 - x0, h = y1 - y0, fits = B ? (w <= B[0] && h <= B[1]) || (w <= B[1] && h <= B[0]) : false, area = w * h;
      if (!best || (fits && !best.fits) || (fits === best.fits && area < best.area)) best = { ang: a, w, h, area, fits };
    }
    return best;
  }
  function rangePts(m, i0, i1) { const P = [], st = Math.max(1, Math.floor((i1 - i0) / 160)); for (let i = i0; i <= i1; i += st) for (const u of [0, 0.5, 1]) P.push(colLine(m, i, u)); P.push(colLine(m, i1, 0), colLine(m, i1, 1)); return P; }
  const RAILNAMES = { rect: ['Bottom', 'Right', 'Top', 'Left'], arch: ['Bottom', 'Right side', 'Arch', 'Left side'], oval: ['Oval'], round: ['Round'] };
  function planPieces(m, o) {
    const bed = o.bed || [256, 256, 256], mg = o.margin == null ? 6 : +o.margin, B = [bed[0] - mg, bed[1] - mg], nx = m.nx, mode = o.split || 'auto';
    const warn = [];
    if (m.H > bed[2]) warn.push(`The molding is ${m.H.toFixed(0)} mm tall, more than the ${bed[2]} mm the printer can reach.`);
    const whole = fitRect(rangePts(m, 0, nx), B);
    if (mode === 'whole' || (mode === 'auto' && whole.fits)) {
      if (!whole.fits) warn.push('The whole frame is bigger than the bed. Choose Auto to cut it at the miters.');
      return { pieces: [{ i0: 0, i1: nx, whole: true, name: 'Frame', fit: whole }], cuts: [], warn, bed: B };
    }
    let cuts = [];
    const starts = []; for (let i = 0; i < nx; i++) if (m.cc[i] === 0) starts.push(i);
    if (m.shape === 'rect') cuts = starts.slice();
    else if (m.shape === 'arch') { cuts = [starts[0], starts[1]]; const a0 = starts[2], a1 = starts[3]; cuts.push(Math.round((a0 + a1) / 2)); }
    else cuts = [0, Math.round(nx / 2)];
    cuts.sort((a, b) => a - b);
    let ranges = cuts.map((c, k) => [c, k + 1 < cuts.length ? cuts[k + 1] : cuts[0] + nx]);
    const BP = [B[0] - 16, B[1] - 16]; /* the pegs stand out of each mitre face by up to 8 mm */
    for (let guard = 0; guard < 8; guard++) {
      let changed = false; const nr = [];
      for (const r of ranges) { const f = fitRect(rangePts(m, r[0], r[1]), BP); if (!f.fits && r[1] - r[0] > 16 && ranges.length + nr.length < 48) { const mid = Math.round((r[0] + r[1]) / 2); nr.push([r[0], mid], [mid, r[1]]); changed = true; } else nr.push(r); }
      ranges = nr; if (!changed) break;
    }
    const names = RAILNAMES[m.shape], byRail = {};
    const pieces = ranges.map(r => {
      const mid = ((Math.round((r[0] + r[1]) / 2) % nx) + nx) % nx, ri = m.cr[mid], f = fitRect(rangePts(m, r[0], r[1]), BP);
      if (!f.fits) warn.push('A piece is still bigger than the bed: try a narrower frame or a bigger printer.');
      (byRail[ri] = byRail[ri] || []).push(r);
      return { i0: r[0], i1: r[1], ri, fit: f };
    });
    pieces.forEach(p => { const L = byRail[p.ri]; p.name = names[p.ri] || names[0]; if (m.shape === 'oval' || m.shape === 'round') p.name = (p.i0 % nx) < nx / 4 || (p.i0 % nx) > nx * 0.75 ? 'Lower' : 'Upper'; if (L.length > 1 && m.shape !== 'oval' && m.shape !== 'round') p.name += ` ${L.indexOf(L.find(r => r[0] === p.i0)) + 1}`; });
    if (m.shape === 'oval' || m.shape === 'round') { const cnt = {}; pieces.forEach(p => { cnt[p.name] = (cnt[p.name] || 0) + 1; }); const seen = {}; pieces.forEach(p => { if (cnt[p.name] > 1) { seen[p.name] = (seen[p.name] || 0) + 1; p.name += ` ${seen[p.name]}`; } }); }
    return { pieces, cuts: [...new Set(ranges.map(r => ((r[0] % nx) + nx) % nx))], warn: [...new Set(warn)], bed: B };
  }
  function cutPlanes(m) {
    return m.plan.cuts.map(i => {
      const a = colLine(m, i, 0), b = colLine(m, i, 1), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      return { n: [-dy / L, dx / L, 0], c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.min(m.d.Bb, m.H) * 0.5 + 0.2], local: true };
    });
  }

  // ---------------------------------------------------------------- accent colour skins (AMS)
  // The accent regions become 0.4 mm skins on top of the body (the body is lowered there) so a multi-colour printer
  // swaps filament only for the top layers. Built per piece and kept one column off every cut.
  const SKIN = 0.4;
  function skinMask(m) { const { nx, ny, REG } = m, cell = new Uint8Array(nx * ny); for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) { const i1 = (i + 1) % nx; if (REG[j * nx + i] === 2 && REG[j * nx + i1] === 2 && REG[(j + 1) * nx + i] === 2 && REG[(j + 1) * nx + i1] === 2) cell[j * nx + i] = 1; } return cell; }
  function hasAccent(m) { for (let k = 0; k < m.REG.length; k++) if (m.REG[k] === 2) return true; return false; }
  // Styles with no carved accent band get a 3 mm (or ~12%) sight-edge lip in the second colour, so every
  // style can export a two-tone 3MF. Existing mat: 2 profiles and wood-grain splits are left alone.
  function applyDefaultLip(m) {
    if (hasAccent(m)) return m;
    const lipT = Math.min(0.22, Math.max(0.10, 3 / (m.W || 25)));
    let rows = 0; for (let j = 0; j < m.ny - 1; j++) if (m.T[j] <= lipT) rows++;
    const n = Math.max(rows, 3);
    for (let j = 0; j < Math.min(n, m.ny - 2); j++) for (let i = 0; i < m.nx; i++) m.REG[j * m.nx + i] = 2;
    return m;
  }
  // Complementary second filament when the style (or the user) does not name an accent finish.
  // Wood uses the species dark/grain colour; black/white/ebony get gold; gilt and silver get black; antique gilt gets silk gold.
  function defaultAccentKey(m) {
    if (m.o && m.o.accent) return m.o.accent;
    if (m.pr && m.pr.accent) return m.pr.accent;
    const fin = (m.o && m.o.finish) || (m.pr && m.pr.finish);
    if (fin === 'wood') return null;
    if (fin === 'black' || fin === 'ebony' || fin === 'white') return 'gold';
    if (fin === 'gold' || fin === 'silver') return 'black';
    if (fin === 'antique') return 'gold';
    return 'gold';
  }
  function bodyZ(m, cell) {
    // lower the body under the skin cells (every node touching a skin cell)
    const { nx, ny, Z } = m, Zb = Float32Array.from(Z), low = new Uint8Array(nx * ny);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx; i++) if (cell[j * nx + i]) { const i1 = (i + 1) % nx; low[j * nx + i] = low[j * nx + i1] = low[(j + 1) * nx + i] = low[(j + 1) * nx + i1] = 1; }
    for (let k = 0; k < Zb.length; k++) if (low[k]) Zb[k] = Math.max(0.8, Z[k] - SKIN);
    return Zb;
  }
  function skinSolid(m, cell, Zb, i0, i1) {
    const nx = m.nx, cols = i1 - i0 + 1, G = i => ((i0 + i) % nx + nx) % nx;
    const inC = (i, j) => i >= 1 && i < cols - 2 && cell[j * nx + G(i)] === 1;
    const p = Tools.maskedHeightSolid(cols, m.ny, inC, (i, j) => m.Z[j * nx + G(i)], (i, j, z) => [m.X[j * nx + G(i)], m.Y[j * nx + G(i)], z], (i, j) => Zb[j * nx + G(i)]);
    return p;
  }

  // ---------------------------------------------------------------- back ring (forms the rabbet), backing, mat, extras
  function loopAt(m, u, i0, i1, stride) {
    const P = [], nx = m.nx; stride = stride || 1;
    const add = i => { const k = ((i % nx) + nx) % nx, q = k * 4; P.push([m.CP[q] + m.CP[q + 2] * u, m.CP[q + 1] + m.CP[q + 3] * u]); };
    if (i0 == null) { for (let i = 0; i < nx; i++) if (m.cc[i] === 0 || i % stride === 0 || m.R[m.cr[i]].type !== 'line') add(i); return P; }
    for (let i = i0; i < i1; i++) if (m.cc[((i % nx) + nx) % nx] === 0 || (i - i0) % stride === 0 || m.R[m.cr[((i % nx) + nx) % nx]].type !== 'line') add(i);
    add(i1); return P;
  }
  function circle(cx, cy, r, n) { const P = []; n = n || 20; for (let k = 0; k < n; k++) { const a = -k / n * TAU; P.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return P; }
  function pip(q, L) { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function clipHoles(m) {
    const P = [], u = m.d.uIn + Math.min(4.5, (m.d.uOut - m.d.uIn) / 2), at = (ri, c) => { const q = railAt(m.R[ri], c); P.push([q.px + q.mx * u, q.py + q.my * u]); };
    if (m.shape === 'rect') for (let r = 0; r < 4; r++) { at(r, 0.25); at(r, 0.75); }
    else if (m.shape === 'arch') { at(0, 0.25); at(0, 0.75); at(1, 0.5); at(3, 0.5); at(2, 0.25); at(2, 0.75); }
    else for (let k = 0; k < 8; k++) at(0, k / 8 + 1 / 16);
    return P;
  }
  function ringPieces(m) {
    const d = m.d, nx = m.nx, B = m.plan.bed, holes = clipHoles(m), out = [];
    const mk = (i0, i1) => {
      const outer = loopAt(m, d.uOut, i0, i1, 4), inner = loopAt(m, d.uIn, i0, i1, 4).reverse(), poly = outer.concat(inner);
      const hs = holes.filter(h => pip(h, poly)).map(h => circle(h[0], h[1], 1, 16));
      return Tools.extrude([{ outer: poly, holes: hs }], 2, 0, d.ringT);
    };
    if (m.plan.pieces.length === 1) {
      const hs = holes.map(h => circle(h[0], h[1], 1, 16));
      return [{ name: 'Back ring', p: Tools.extrude([{ outer: loopAt(m, d.uOut, null, null, 4), holes: [loopAt(m, d.uIn, null, null, 4).reverse(), ...hs] }], 2, 0, d.ringT) }];
    }
    // seams a third of the way along each front piece, so every ring joint is bridged by solid moulding above it
    let cuts = m.plan.pieces.map(p => Math.round(p.i0 + (p.i1 - p.i0) * 0.35));
    let ranges = cuts.map((c, k) => [c, k + 1 < cuts.length ? cuts[k + 1] : cuts[0] + nx]);
    const BP = [B[0] - 16, B[1] - 16]; /* the pegs stand out of each mitre face by up to 8 mm */
    for (let guard = 0; guard < 6; guard++) {
      const nr = []; let ch = false;
      for (const r of ranges) { const pts = loopAt(m, d.uOut, r[0], r[1], 8).concat(loopAt(m, d.uIn, r[0], r[1], 8)), f = fitRect(pts, B); if (!f.fits && r[1] - r[0] > 12) { const md = Math.round((r[0] + r[1]) / 2); nr.push([r[0], md], [md, r[1]]); ch = true; } else nr.push(r); }
      ranges = nr; if (!ch) break;
    }
    ranges.forEach((r, k) => out.push({ name: `Back ring ${k + 1}`, p: mk(r[0], r[1]) }));
    return out;
  }
  function roundRectLoop(w, h, r, seg) { const P = [], x = w / 2, y = h / 2; r = Math.min(r, x, y); seg = seg || 6; for (const [cx, cy, a0] of [[x - r, -y + r, -Math.PI / 2], [x - r, y - r, 0], [-x + r, y - r, Math.PI / 2], [-x + r, -y + r, Math.PI]]) for (let k = 0; k <= seg; k++) { const a = a0 + k / seg * Math.PI / 2; P.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return P; }
  function keyLoop(cx, r1, w, len) {
    const P = [], a = Math.asin(Math.min(1, w / 2 / r1)), n = 24;
    for (let k = 0; k <= n; k++) { const t = a + (TAU - 2 * a) * k / n; P.push([cx + r1 * Math.cos(t), r1 * Math.sin(t)]); }
    for (let k = 0; k <= 10; k++) { const t = -Math.PI / 2 + Math.PI * k / 10; P.push([cx + len + w / 2 * Math.cos(t), w / 2 * Math.sin(t)]); }
    return P.reverse();
  }
  function stadium(cx, len, r) { const P = []; for (let k = 0; k <= 12; k++) { const t = Math.PI / 2 + Math.PI * k / 12; P.push([cx + r * Math.cos(t), r * Math.sin(t)]); } for (let k = 0; k <= 12; k++) { const t = -Math.PI / 2 + Math.PI * k / 12; P.push([cx + len + r * Math.cos(t), r * Math.sin(t)]); } return P; }
  function prism(profile, y0, y1) {
    // convex profile [[x, z]] (any winding) extruded along y
    const out = [], n = profile.length, put = (a, b, c) => out.push(...a, ...b, ...c);
    const A = profile.map(p => [p[0], y0, p[1]]), Bq = profile.map(p => [p[0], y1, p[1]]);
    for (let k = 1; k < n - 1; k++) { put(A[0], A[k], A[k + 1]); put(Bq[0], Bq[k + 1], Bq[k]); }
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; put(A[k], Bq[k], Bq[k1]); put(A[k], Bq[k1], A[k1]); }
    const p = Float64Array.from(out); return fixSignLocal(p);
  }
  function textPlate(str, accent) {
    str = String(str || '').toUpperCase().replace(/[^A-Z0-9 \-]/g, '').replace(/\s+/g, ' ').slice(0, 32).trim();
    if (!str) return null;
    const loops = Core.textLoops(str).loops, polys = Tools.unionPolys(loops.map(L => ({ outer: L, holes: [] })), 'evenodd'), cap = 7, s = cap / 5;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const L of loops) for (const q of L) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const tw = (x1 - x0) * s, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const tp = polys.map(P => ({ outer: P.outer.map(q => [(q[0] - cx) * s, (q[1] - cy) * s]), holes: P.holes.map(h => h.map(q => [(q[0] - cx) * s, (q[1] - cy) * s])) }));
    const W = Math.max(50, tw + 16), H = 16;
    const plate = Tools.extrude([{ outer: roundRectLoop(W, H, 2.5), holes: [] }], 2, 0, 2.2);
    const text = Tools.extrude(tp, 2, 2.2, 3.0);
    return { name: 'Nameplate', parts: [{ name: 'Nameplate', p: plate, extruder: 1 }, { name: 'Nameplate text', p: text, extruder: accent ? 2 : 1 }], size: [W, H] };
  }
  function accessories(m) {
    const o = m.o, d = m.d, X = [], warn = [], B = m.plan.bed;
    const fitsBed = pts => fitRect(pts, B).fits;
    if (o.backing !== false && d.backT > 0) {
      const L = loopAt(m, d.lip - 0.3, null, null, 6);
      if (fitsBed(L)) X.push({ name: 'Backing (also the glass template)', p: Tools.extrude([{ outer: L, holes: [] }], 2, 0, d.backT), kind: 'backing' });
      else warn.push('The backing is bigger than the bed, so it is left out: cut foam board or hardboard to the size in the README.');
    }
    if (o.mat && d.mb > 0) {
      const outer = loopAt(m, d.lip - 0.3, null, null, 6), N = 5, layers = [];
      if (fitsBed(outer)) {
        for (let k = 0; k < N; k++) { const off = -d.mb + d.matT * (1 - k / (N - 1)) * 0.95; layers.push({ z0: k * d.matT / N, z1: (k + 1) * d.matT / N, polys: [{ outer, holes: [loopAt(m, off, null, null, 6).reverse()] }] }); }
        X.push({ name: 'Mat (bevelled, print face down)', p: Tools.steppedExtrude(layers), kind: 'mat' });
      } else warn.push('The mat is bigger than the bed, so it is left out: a store-cut mat to the size in the README fits.');
    }
    const nClips = clipHoles(m).length;
    if (o.clips !== false) {
      const clip = Tools.extrude([{ outer: roundRectLoop(22, 9, 4.4), holes: [circle(-6.5, 0, 1.6, 16)] }], 2, 0, 2);
      for (let k = 0; k < nClips; k++) X.push({ name: `Turn clip ${k + 1}`, p: clip, kind: 'clip' });
    }
    if (o.hanger === 'keyhole' || (o.hanger == null && !o.kickstand)) {
      const plate = roundRectLoop(40, 16, 3);
      const sc = [circle(-15, 0, 1.6, 14), circle(15, 0, 1.6, 14)];
      X.push({ name: 'Keyhole hanger', p: Tools.steppedExtrude([{ z0: 0, z1: 2, polys: [{ outer: plate, holes: [stadium(-4, 8, 5.3), ...sc] }] }, { z0: 2, z1: 4, polys: [{ outer: plate, holes: [keyLoop(-4, 4.6, 4.4, 8), ...sc] }] }]), kind: 'hanger' });
    } else if (o.hanger === 'sawtooth') {
      const P = [[-30, 0], [30, 0], [30, 7]]; for (let x = 27; x > -27; x -= 3) P.push([x, 7], [x - 1.5, 9]); P.push([-27, 7], [-30, 7]);
      X.push({ name: 'Sawtooth hanger', p: Tools.extrude([{ outer: P, holes: [circle(-26.5, 3.5, 1.3, 12), circle(26.5, 3.5, 1.3, 12)] }], 2, 0, 2.4), kind: 'hanger' });
    }
    if (o.kickstand) {
      const hOut = d.S[1] + 2 * d.W, L = clamp(hOut * 0.55, 60, 170);
      X.push({ name: 'Kickstand leg', p: Tools.extrude([{ outer: [[-12, 0], [12, 0], [17, L], [-17, L]], holes: [] }], 2, 0, 4), kind: 'stand' });
      const t = Math.tan(20 * Math.PI / 180);
      X.push({ name: 'Kickstand wedge (glue to the backing)', p: prism([[0, 0], [24, 0], [24, 3], [0, 3 + 24 * t]], 0, 30), kind: 'stand' });
    }
    if (o.nameplate) { const np = textPlate(o.nameplate, true); if (np) { np.parts = tintParts(m, np.parts); X.push(Object.assign(np, { kind: 'name' })); } }
    return { items: X, warn };
  }

  // ---------------------------------------------------------------- export: cut, colour, lay out on plates
  // opt: { conn, colors (AMS skins), labels, onProgress }. Returns { items:[{ name, p | parts, kind }], log, warn }.
  // points within 2e-6 mm of each other become the same point (cut points computed from either side differ by a hair)
  function canon(p) {
    const C = 5e4, cell = new Map(), key = (a, b, c) => (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)), e2 = 4e-12;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2], cx = Math.floor(x * C), cy = Math.floor(y * C), cz = Math.floor(z * C);
      let hit = null;
      for (let a = -1; a <= 1 && !hit; a++) for (let b = -1; b <= 1 && !hit; b++) for (let c = -1; c <= 1 && !hit; c++) {
        const L = cell.get(key(cx + a, cy + b, cz + c)); if (!L) continue;
        for (const q of L) if ((q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2 < e2) { hit = q; break; }
      }
      if (hit) { p[i] = hit[0]; p[i + 1] = hit[1]; p[i + 2] = hit[2]; }
      else { const k = key(cx, cy, cz); let L = cell.get(k); if (!L) cell.set(k, L = []); L.push([x, y, z]); }
    }
    return p;
  }
  function exportPieces(m, opt) {
    opt = opt || {};
    const prog = opt.onProgress || (() => {}), warn = m.plan.warn.slice(), items = [];
    const accent = opt.colors && twoTone(m) && hasAccent(m), cell = accent ? skinMask(m) : null;
    if (cell) for (const c of m.plan.cuts) for (let j = 0; j < m.ny; j++) for (const di of [-2, -1, 0, 1]) cell[j * m.nx + ((c + di) % m.nx + m.nx) % m.nx] = 0;
    const Zb = cell ? bodyZ(m, cell) : null;
    prog(0.05, 'Building the molding');
    let DGx = m.DG; if (cell && DGx) { DGx = Uint8Array.from(DGx); for (let k = 0; k < cell.length; k++) if (cell[k]) DGx[k] = 0; } /* skins are built with the plain diagonal */
    const mm = Zb ? Object.assign({}, m, { Z: Zb, DG: DGx }) : m;
    let fronts;
    if (m.plan.pieces.length === 1) { fronts = [{ p: frontSolid(mm), plan: m.plan.pieces[0] }]; }
    else {
      // Each piece is built on its own, mitre faces exact, then every mitre gets its joint: the two pieces either side
      // are merged (their shared end caps dropped), cut on that mitre plane and given pegs. One mitre at a time,
      // because a closed ring cut on a local plane stays one piece.
      const conn = opt.conn || { type: 'peg', autoSize: true, diameter: 6, length: 8, perFace: 0, tolerance: 0.15, minWall: 2, magnetDiameter: 6, magnetThickness: 2, shape: 'round', taper: false };
      const order = m.plan.pieces.slice().sort((x, y) => x.i0 - y.i0), K = order.length;
      const cur = order.map(pc => ({ p: frontSolid(mm, pc.i0, pc.i1), plan: pc }));
      const planeAt = i => cutPlanes(Object.assign({}, m, { plan: { cuts: [i] } }))[0];
      const onPlane = (p, pl, f) => { const n = pl.n, c = pl.c; for (let q = 0; q < 9; q += 3) if (Math.abs((p[f + q] - c[0]) * n[0] + (p[f + q + 1] - c[1]) * n[1] + (p[f + q + 2] - c[2]) * n[2]) > 2e-4) return false; return true; };
      const cen = p => { let x = 0, y = 0; const n = p.length / 3; for (let i = 0; i < p.length; i += 3) { x += p[i]; y += p[i + 1]; } return [x / n, y / n]; };
      const doJoint = (ka, kb, cutI, globalPlane) => {
        const A = cur[ka], Bp = cur[kb], pl = planeAt(cutI);
        if (globalPlane) pl.local = false;
        const strip = (p, keepPl) => { const out = []; for (let f = 0; f < p.length; f += 9) { if (keepPl.some(q => onPlane(p, q, f))) continue; for (let q = 0; q < 9; q++) out.push(p[f + q]); } return out; };
        const drop = [pl]; const soup = strip(A.p, drop).concat(strip(Bp.p, drop));
        const ca = cen(A.p), cb = cen(Bp.p);
        const r = Core.splitFree(soup, [pl], conn, { labels: !!opt.labels, labelDepth: 0.6 });
        (r.warn || []).forEach(w => warn.push(String(w)));
        if (r.pieces.length !== 2) { warn.push(`The joint at ${A.plan.name} / ${Bp.plan.name} did not cut cleanly; those pieces are left without pegs there.`); return; }
        joints += (r.log && r.log.placed) || 0;
        const d2 = (c, q) => (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2;
        const P = r.pieces.map(x => ({ p: x.p instanceof Float64Array ? x.p : Float64Array.from(x.p), c: cen(x.p) }));
        const first = d2(P[0].c, ca) + d2(P[1].c, cb) <= d2(P[1].c, ca) + d2(P[0].c, cb) ? 0 : 1;
        A.p = P[first].p; Bp.p = P[1 - first].p;
      };
      let joints = 0;
      if (K === 2) { prog(0.2, 'Cutting the joints');
        // two pieces share two mitres; when both lie on one plane (an oval cut top and bottom) one plane does both
        const p0 = planeAt(order[0].i0 % m.nx), p1 = planeAt(order[1].i0 % m.nx);
        const coplanar = Math.abs(Math.abs(p0.n[0] * p1.n[0] + p0.n[1] * p1.n[1]) - 1) < 1e-6 && Math.abs((p1.c[0] - p0.c[0]) * p0.n[0] + (p1.c[1] - p0.c[1]) * p0.n[1]) < 1e-4;
        if (coplanar) {
          const full = frontSolid(mm), pl = Object.assign(p0, { local: false });
          const r = Core.splitFree(full, [pl], conn, { labels: !!opt.labels, labelDepth: 0.6 });
          (r.warn || []).forEach(w => warn.push(String(w))); joints = (r.log && r.log.placed) || 0;
          if (r.pieces.length === 2) {
            const c0 = cen(cur[0].p), P = r.pieces.map(x => ({ p: x.p instanceof Float64Array ? x.p : Float64Array.from(x.p), c: cen(x.p) }));
            const f = (P[0].c[0] - c0[0]) ** 2 + (P[0].c[1] - c0[1]) ** 2 < (P[1].c[0] - c0[0]) ** 2 + (P[1].c[1] - c0[1]) ** 2 ? 0 : 1;
            cur[0].p = P[f].p; cur[1].p = P[1 - f].p;
          } else warn.push('The two halves were left without pegs.');
        } else { doJoint(0, 1, order[1].i0 % m.nx); warn.push('One miter has no pegs: glue it flat.'); }
      } else {
        for (let k = 0; k < K; k++) { prog(0.15 + 0.6 * k / K, 'Cutting the joints'); doJoint((k + K - 1) % K, k, order[k].i0 % m.nx); }
      }
      // the cuts move points through each plane's frame and back: make copies of one point agree exactly
      for (const f of cur) canon(f.p);
      fronts = cur;
      m.joints = joints;
    }
    prog(0.8, 'Color skins and extras');
    fronts.forEach((f, k) => {
      const nm = `Frame - ${f.plan.name}`, pl = f.plan;
      if (cell) {
        const sk = pl.whole ? skinSolid(m, cell, Zb, 0, m.nx) : skinSolid(m, cell, Zb, pl.i0, pl.i1);
        if (sk.length) { items.push({ name: nm, kind: 'front', parts: tintParts(m, [{ name: nm, p: f.p, extruder: 1 }, { name: `${nm} accent`, p: sk, extruder: 2 }]) }); return; }
      }
      items.push({ name: nm, kind: 'front', p: f.p });
    });
    ringPieces(m).forEach(r => items.push(Object.assign(r, { kind: 'ring' })));
    const acc = accessories(m); acc.items.forEach(x => items.push(x)); acc.warn.forEach(w => warn.push(w));
    prog(1, 'Done');
    return { items, warn: [...new Set(warn)], accent: !!(cell && items.some(x => x.parts && x.parts.length > 1)) };
  }
  const allP = it => it.parts ? Tools.concat(it.parts.map(x => x.p)) : it.p;
  // turn each item flat on the bed for its smallest footprint, then pack onto plates (bed: usable [w, d], gap mm)
  function layout(items, bed, gap) {
    const prepped = items.map(it => {
      const p = allP(it), pts = []; const st = Math.max(9, Math.floor(p.length / 9 / 40000) * 9);
      for (let k = 0; k < p.length; k += st) pts.push([p[k], p[k + 1]]);
      const f = fitRect(pts, bed), a = -f.ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const rot = q => { const o = new Float64Array(q.length); for (let k = 0; k < q.length; k += 3) { o[k] = q[k] * c + q[k + 1] * s; o[k + 1] = -q[k] * s + q[k + 1] * c; o[k + 2] = q[k + 2]; } return o; };
      const parts = it.parts ? it.parts.map(x => Object.assign({}, x, { p: rot(x.p) })) : null, pp = parts ? null : rot(it.p);
      const bb = Core.bbox(parts ? Tools.concat(parts.map(x => x.p)) : pp);
      return { it, parts, p: pp, bb, w: bb.max[0] - bb.min[0], h: bb.max[1] - bb.min[1] };
    });
    const pk = Tools.pack(prepped.map(q => ({ w: q.w, h: q.h })), bed[0], bed[1], gap == null ? 4 : gap, 0);
    return { prepped, place: pk.place, sheets: pk.sheets };
  }
  function placed(q, pl, offX, offY) {
    const bb = q.bb, f = src => { const out = new Float32Array(src.length); for (let k = 0; k < src.length; k += 3) { let x = src[k] - bb.min[0], y = src[k + 1] - bb.min[1]; if (pl.rot) { const t = x; x = (bb.max[1] - bb.min[1]) - y; y = t; } out[k] = x + pl.x + offX; out[k + 1] = y + pl.y + offY; out[k + 2] = src[k + 2] - bb.min[2]; } return out; };
    const part = x => { const o = { name: x.name, extruder: x.extruder, p: f(x.p) }; if (x.color) o.color = x.color; return o; };
    return q.parts ? { name: q.it.name, parts: q.parts.map(part) } : { name: q.it.name, p: f(q.p) };
  }
  function filamentsFor(m) {
    const fin = FINISHES[m.o.finish || m.pr.finish] || FINISHES.gold;
    if (m.sp && m.o.woodSplit) return [{ name: `${m.sp.name} light (${fin.filament})`, color: m.sp.light }, { name: `${m.sp.name} grain`, color: m.sp.filament2 }];
    const body = m.sp && (m.o.finish || m.pr.finish) === 'wood'
      ? { name: `${m.sp.name} (${fin.filament})`, color: m.sp.light }
      : { name: fin.filament, color: fin.hex };
    const key = defaultAccentKey(m);
    if (!key) {
      if (m.sp) return [body, { name: `${m.sp.name} dark`, color: m.sp.filament2 || m.sp.dark }];
      return [body];
    }
    const acc = FINISHES[key];
    if (!acc) return [body];
    if (String(acc.hex || acc.color).toUpperCase() === String(body.color).toUpperCase()) return [body];
    return [body, { name: acc.filament, color: acc.hex }];
  }
  function colorPlan(m) {
    const fils = filamentsFor(m);
    let split = 'single';
    if (m.o.woodSplit && fils.length > 1) split = 'wood grain';
    else if (fils.length > 1 && hasAccent(m)) {
      const named = (m.pr.profile || []).some(e => e.mat === 2) || (m.pr.features || []).some(f => f.mat === 2);
      split = named ? 'preset accent' : 'inner lip';
    }
    return { split, filaments: fils };
  }
  function twoTone(m) {
    const fils = filamentsFor(m);
    return fils.length > 1 && String(fils[0].color).toUpperCase() !== String(fils[1].color).toUpperCase();
  }
  // 3MF core basematerials (and Bambu Studio when project_settings is missing) read part.color;
  // extruder 1/2 still pick the matching filament slot.
  function partColor(m, extruder) {
    const fils = filamentsFor(m);
    return (fils[(extruder || 1) - 1] || fils[0]).color;
  }
  function tintParts(m, parts) {
    return parts.map(x => Object.assign({}, x, { color: x.color || partColor(m, x.extruder) }));
  }

  // ---------------------------------------------------------------- preview data for the viewer
  const hex3 = h => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  function preview(m) {
    const { nx, ny, X, Y, Z, REG, SH, ORNV } = m, n = nx * ny, DG = m.DG;
    // mitre columns get a second copy of their vertices, used by the cells on the rail before the mitre, so the shading
    // normals break crisply at each mitre instead of rounding it over
    const MC = []; if (m.R.length > 1) for (let i = 0; i < nx; i++) { const r = m.R[m.cr[i]]; if (m.cc[i] === 0 && r.type === 'line' && r.k0 > 0) MC.push(i); }
    const dupOf = new Int32Array(nx).fill(-1); MC.forEach((i, q) => { dupOf[i] = n + q * ny; });
    const nv = n + MC.length * ny, pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    for (let k = 0; k < n; k++) { pos[k * 3] = X[k]; pos[k * 3 + 1] = Y[k]; pos[k * 3 + 2] = Z[k]; }
    // cavity: how far below its neighbourhood each point sits (blurred height minus height)
    const r = Math.max(1, Math.round(1.6 / m.res)), tmp = new Float32Array(n), bl = new Float32Array(n);
    for (let j = 0; j < ny; j++) { let s = 0; for (let q = -r; q <= r; q++) s += Z[j * nx + ((q % nx) + nx) % nx]; for (let i = 0; i < nx; i++) { tmp[j * nx + i] = s / (2 * r + 1); s += Z[j * nx + (i + r + 1) % nx] - Z[j * nx + ((i - r) % nx + nx) % nx]; } }
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { let s = 0, c = 0; for (let q = Math.max(0, j - r); q <= Math.min(ny - 1, j + r); q++) { s += tmp[q * nx + i]; c++; } bl[j * nx + i] = s / c; }
    const fin = FINISHES[m.o.finish || m.pr.finish] || FINISHES.gold, fils = filamentsFor(m);
    const acc = FINISHES[m.o.accent || m.pr.accent || defaultAccentKey(m)] || (m.sp ? { name: `${m.sp.name} dark`, color: m.sp.dark, hex: (m.sp.filament2 || m.sp.dark) } : FINISHES.black);
    const c1 = hex3(fils[0].color), c2 = hex3((fils[1] || fils[0]).color), rub = hex3('#6e2f1c'), sp = m.sp, L = sp ? hex3(sp.light) : null, Dk = sp ? hex3(sp.dark) : null;
    const antique = (m.o.finish || m.pr.finish) === 'antique', sc = 1 / (0.12 * m.D + 0.6);
    for (let k = 0; k < n; k++) {
      const cav = clamp((bl[k] - Z[k]) * sc, -1, 1), ao = clamp(1 - Math.max(0, cav) * 0.75, 0.25, 1.08) * (1 + Math.max(0, -cav) * 0.08);
      let c = REG[k] === 2 && !m.o.woodSplit ? c2 : c1;
      if (sp && !(REG[k] === 2 && !m.o.woodSplit)) { const g = clamp(SH[k], 0, 1); c = [lerp(L[0], Dk[0], g), lerp(L[1], Dk[1], g), lerp(L[2], Dk[2], g)]; }
      if (antique && REG[k] !== 2) { const t = clamp(cav * 1.4, 0, 0.85); c = [lerp(c[0], rub[0], t), lerp(c[1], rub[1], t), lerp(c[2], rub[2], t)]; }
      col[k * 3] = c[0] * ao; col[k * 3 + 1] = c[1] * ao; col[k * 3 + 2] = c[2] * ao;
    }
    MC.forEach(i => { for (let j = 0; j < ny; j++) { const s0 = (j * nx + i) * 3, d0 = (dupOf[i] + j) * 3; for (let q = 0; q < 3; q++) { pos[d0 + q] = pos[s0 + q]; col[d0 + q] = col[s0 + q]; } } });
    // index buffers per planned piece and colour region; walls per piece
    const pieces = m.plan.pieces.map(pc => {
      const i0 = pc.whole ? 0 : pc.i0, i1 = pc.whole ? nx : pc.i1, a = [], b = [];
      for (let q = i0; q < i1; q++) {
        const i = ((q % nx) + nx) % nx, ii = (i + 1) % nx, dp = dupOf[ii];
        for (let j = 0; j < ny - 1; j++) {
          const A = j * nx + i, B = dp >= 0 ? dp + j : j * nx + ii, C = dp >= 0 ? dp + j + 1 : (j + 1) * nx + ii, Dd = (j + 1) * nx + i, t = (REG[A] === 2) + (REG[j * nx + ii] === 2) + (REG[(j + 1) * nx + ii] === 2) + (REG[Dd] === 2) >= 3 ? b : a;
          if (DG && DG[A]) t.push(A, Dd, B, B, Dd, C); else t.push(A, C, B, A, Dd, C);
        }
      }
      const mid = Math.round((i0 + i1) / 2), q0 = colLine(m, mid, 0), q1 = colLine(m, mid, 1), dl = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) || 1;
      const wl = pc.whole ? frontWalls(m) : frontWalls(m, pc.i0, pc.i1);
      return { name: pc.name, idx: Uint32Array.from(a), idxAccent: Uint32Array.from(b), walls: wl, wallN: wallNormals(wl), dir: [(q1[0] - q0[0]) / dl, (q1[1] - q0[1]) / dl] };
    });
    return { pos, col, pieces, wallColor: fin.color, finish: fin, accent: acc, species: sp };
  }
  function frontWalls(m, i0, i1) {
    const full = frontSolid(m, i0, i1), out = [];
    // keep only the faces that are not on the top grid (walls, bottom, end caps): any face with a z = 0 corner
    for (let k = 0; k < full.length; k += 9) if (full[k + 2] < 1e-6 || full[k + 5] < 1e-6 || full[k + 8] < 1e-6) for (let q = 0; q < 9; q++) out.push(full[k + q]);
    return Float32Array.from(out);
  }
  // shading normals for the walls: smooth round curved walls (an oval's sight edge, a swept outline), crisp where faces
  // meet at more than 35 degrees (a mitre corner, the wall foot, a cut face)
  function wallNormals(p) {
    const nt = p.length / 9, FN = new Float32Array(nt * 3), acc = new Map(), cosT = Math.cos(35 * Math.PI / 180);
    const key = (x, y, z) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    for (let t = 0; t < nt; t++) {
      const o = t * 9, ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2], vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l > 1e-12) { nx /= l; ny /= l; nz /= l; } else { nx = ny = 0; nz = 1; } /* sliver: any unit normal */
      FN[t * 3] = nx; FN[t * 3 + 1] = ny; FN[t * 3 + 2] = nz;
      for (let q = 0; q < 3; q++) { const k = key(p[o + q * 3], p[o + q * 3 + 1], p[o + q * 3 + 2]); let L = acc.get(k); if (!L) acc.set(k, L = []); L.push(t); }
    }
    const N = new Float32Array(p.length);
    for (let t = 0; t < nt; t++) {
      const o = t * 9, ax = FN[t * 3], ay = FN[t * 3 + 1], az = FN[t * 3 + 2];
      for (let q = 0; q < 3; q++) {
        const L = acc.get(key(p[o + q * 3], p[o + q * 3 + 1], p[o + q * 3 + 2])); let sx = 0, sy = 0, sz = 0;
        for (const f of L) { const bx = FN[f * 3], by = FN[f * 3 + 1], bz = FN[f * 3 + 2]; if (ax * bx + ay * by + az * bz >= cosT) { sx += bx; sy += by; sz += bz; } }
        let l = Math.hypot(sx, sy, sz); if (l < 1e-9) { sx = ax; sy = ay; sz = az; l = 1; } N[o + q * 3] = sx / l; N[o + q * 3 + 1] = sy / l; N[o + q * 3 + 2] = sz / l;
      }
    }
    return N;
  }

  // ---------------------------------------------------------------- the numbers a framer needs
  function summary(m) {
    const d = m.d, f = v => `${v.toFixed(1)} mm`, two = a => `${a[0].toFixed(1)} x ${a[1].toFixed(1)} mm`, inch = a => `${(a[0] / IN).toFixed(2)} x ${(a[1] / IN).toFixed(2)} in`;
    const outer = [d.S[0] + 2 * d.W, d.S[1] + 2 * d.W];
    const lines = [
      ['Picture', `${two(d.photo)} (${inch(d.photo)})`],
      ['Sight opening (visible)', two(d.S)],
      d.mb ? ['Mat', `outer ${two(d.G)}, window ${two(d.window)}, ${f(d.mb)} border showing`] : null,
      [d.glazing ? 'Glass / acrylic' : 'Backing size', `${two(d.G)}${d.glazing ? `, ${d.glazing} mm thick` : ''}`],
      ['Rabbet opening', `${two(d.R)} (${d.tol} mm play each side)`],
      ['Rabbet depth', `${f(d.ringT)} = ${d.glazing ? `glazing ${d.glazing} + ` : ''}${d.matT ? `mat ${d.matT} + ` : ''}photo ${d.photoT} + backing ${d.backT} + 0.4`],
      ['Lip over the glass', f(d.lip)],
      ['Molding', `${f(d.W)} wide, ${f(m.H)} tall face, ${f(m.H + d.ringT)} deep overall`],
      ['Outside size', `${two(outer)} (${inch(outer)})${m.pr.sweep ? ', more at the swept corners' : ''}`]
    ].filter(Boolean);
    return lines;
  }
  function readme(m, ex, extra) {
    const pr = m.pr, fil = filamentsFor(m), L = summary(m).map(([k, v]) => `  ${k}: ${v}`);
    const tips = pr.tips || ['Print face up at 0.16 mm layers with 3 walls; no supports are needed.', 'Glue the back ring under the frame (CA or epoxy), then the glass, mat, picture and backing drop into the rabbet.'];
    return [`Expressarte picture frame: ${pr.name}`, '', pr.blurb, '', 'Sizes', ...L, '',
      'What is in the box',
      ...ex.items.map(it => `  - ${it.name}`), '',
      'Printing',
      '  Every frame piece prints face up, flat side on the bed, no supports. Back ring, clips and hanger print flat.',
      `  Filament: ${fil.map(x => x.name).join(' + ')}.`,
      ex.accent ? '  The color 3MF puts the accent skins on filament 2: its top 0.4 mm switch color.' : '  One filament is enough; the accent areas can be painted.',
      (pr.filaments ? `  Suggested: ${pr.filaments.join('; ')}.` : ''),
      '',
      'Assembly',
      m.plan.pieces.length > 1 ? '  1. Dry-fit the frame pieces on the pegs at the miters, then glue them (CA gel or epoxy) on a flat surface with a band clamp.' : '  1. The frame is one piece.',
      '  2. Glue the back ring under the frame, outer edges flush: it forms the rabbet. Its joints sit away from the miters, so it also braces them.',
      '  3. Lay in the glass or acrylic (cut it to the printed backing, which is also the template), the mat, the picture and the backing.',
      '  4. Screw the turn clips into the pilot holes (M2 or #2 screws, 6 to 8 mm) and turn them over the backing.',
      '  5. Screw or glue the hanger on the back ring, centered at the top.',
      '',
      'Finishing', ...tips.map(t => `  - ${t}`), '',
      ...(extra || []), '', 'Made with Expressarte'].filter(x => x !== '').join('\n').replace(/\n(Sizes|What is in the box|Printing|Assembly|Finishing)/g, '\n\n$1') + '\n';
  }
  function safeName(s) { return String(s).replace(/[^A-Za-z0-9 _\-]+/g, '').replace(/\s+/g, '_'); }
  // Files: an STL per item (zipped by the caller) plus, when plates is set, the plates 3MF (with colour parts).
  // o: { bed:[w,d] usable, offset:[x,y], fullBed:[w,d], bambu, plates3mf, colors }
  function files(m, ex, o) {
    o = o || {};
    const dir = safeName(`frame_${m.pr.id}`), list = [];
    ex.items.forEach((it, k) => list.push({ name: `${dir}/${String(k + 1).padStart(2, '0')}_${safeName(it.name)}.stl`, data: new Uint8Array(Core.writeSTL(allP(it), it.name)) }));
    let plates = null, mf = null;
    if (o.plates3mf !== false) {
      const L = layout(ex.items, o.bed || [250, 250], 4), fb = o.fullBed || o.bed || [256, 256], off = o.offset || [3, 3], objs = [], pl = [];
      let nS = L.sheets; const extra = [];
      L.place.forEach((p, i) => { if (!p || p.sheet < 0) { extra.push(i); L.place[i] = { x: 0, y: 0, rot: false, sheet: nS++ }; } });
      if (extra.length) (ex.warn = ex.warn || []).push(`${extra.length} part(s) are bigger than the bed; each sits on its own plate so you can see it, but it will not print as is.`);
      L.sheets = nS;
      for (let s = 0; s < L.sheets; s++) {
        const org = Tools.bambuPlateOrigin(s, L.sheets, fb[0], fb[1]), ids = [];
        L.place.forEach((p, i) => { if (p.sheet !== s) return; ids.push(objs.length); const ob = placed(L.prepped[i], p, off[0] + org[0], off[1] + org[1]); if (!ex.accent && ob.parts) { ob.p = Tools.concat(ob.parts.map(x => x.p)); delete ob.parts; } objs.push(ob); });
        pl.push(ids);
      }
      const fils = filamentsFor(m);
      for (const ob of objs) if (!ob.parts && !ob.color) ob.color = fils[0].color;
      // Always name a Bambu preset so Studio opens filament colours instead of importing geometry-only.
      // Part .color writes 3MF basematerials for any slicer. Two-tone styles use slots 1 and 2.
      mf = Tools.threeMF(objs, { title: m.pr.name, plates: pl, bambu: o.bambu || 'A1', filaments: fils });
      plates = L.sheets;
    }
    return { files: list, threeMF: mf, plates };
  }

  const api = { PRESETS, FAMILY, FINISHES, SPECIES, PHOTO_SIZES, ORN, FEAT, DETAIL, byId, dims, rails, railAt, bandLen, build, frontSolid, planPieces, cutPlanes, exportPieces, layout, files, preview, summary, readme, filamentsFor, colorPlan, defaultAccentKey, accessories, ringPieces, hasAccent, grainAt, fitRect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.FrameTools = api;
})(globalThis);
