/* Expressarte print estimates: filament weight and length, material cost and a rough print time.
   Calibrated against PrusaSlicer 2.9.2 slicing 21 test parts with Bambu Studio's "0.20mm Standard" settings
   (2 walls 0.42/0.45 mm, 15% grid, 5 top / 3 bottom layers, Bambu PLA Basic, flow 0.98): weight within ~2% on
   average (worst ~12%, a 6 cm robot of thin limbs), time within ~20%. tests/estimate.test.js holds those numbers.
   FDM:   walls  = side area (projected sideways) x wall thickness (line spacing of each loop)
          skins  = top-facing area x max(5 layers, 1 mm) + bottom-facing area x 3 layers (x 0.9: skins overlap walls)
          infill = the remaining core x infill, plus line ends/anchors (more in narrow cores) and solid fill
                   where the core is too thin for sparse infill (thin walls, lithophanes, hollow shells)
          time   = walls, skins and infill at their own volumetric rates + a few seconds per layer
   Resin: material = the solid volume; time = layers x seconds per layer. */
(function (G) {
  'use strict';
  // price = per kg (derived from rollPrice / rollG when a roll price is given); roll in grams
  const MATERIALS = {
    'bambu-pla-basic': { name: 'Bambu PLA Basic', density: 1.26, price: 14.99, rollPrice: 14.99, rollG: 1000 },
    pla: { name: 'PLA (generic)', density: 1.24, price: 20, rollPrice: 20, rollG: 1000 },
    petg: { name: 'PETG', density: 1.27, price: 22, rollPrice: 22, rollG: 1000 },
    abs: { name: 'ABS', density: 1.04, price: 22, rollPrice: 22, rollG: 1000 },
    asa: { name: 'ASA', density: 1.07, price: 25, rollPrice: 25, rollG: 1000 },
    tpu: { name: 'TPU', density: 1.21, price: 30, rollPrice: 30, rollG: 1000 },
    resin: { name: 'Resin', density: 1.12, price: 35, rollPrice: 35, rollG: 1000, resin: true }
  };
  // volumetric rates (mm^3/s) for walls, skins and sparse infill, and seconds per layer change.
  // fast = fitted to Bambu-like speeds (outer 200 / inner 300 / infill 270 mm/s, 10k accel, 21 mm^3/s cap).
  const SPEEDS = {
    quality: { name: 'Quality / older printer', wall: 2.5, skin: 4.5, infill: 8, layerSec: 6 },
    standard: { name: 'Standard (Prusa MK4, Ender-3 V3)', wall: 4.5, skin: 8, infill: 14, layerSec: 4 },
    fast: { name: 'Fast CoreXY (Bambu, Klipper)', wall: 7, skin: 12, infill: 21, layerSec: 3 },
    resin: { name: 'Resin MSLA', wall: 0, skin: 0, infill: 0, layerSec: 8.5 }
  };
  for (const sp of Object.values(SPEEDS)) sp.flow = sp.infill; // shown as the printer's top volumetric speed
  // Bambu Lab defaults: Bambu PLA Basic ($14.99 per 1 kg roll), 0.20mm Standard, auto infill per part.
  const DEFAULTS = { v: 2, material: 'bambu-pla-basic', density: 1.26, diameter: 1.75, price: 14.99, rollPrice: 14.99, rollG: 1000, infill: 15, walls: 2, layerH: 0.2, lineW: 0.42, speed: 'fast', flow: 21, autoInfill: true };
  // settings saved before 2026-10-19 that still equal the old defaults move to the new ones; anything changed stays
  const OLD_DEFAULTS = { material: 'pla', density: 1.24, diameter: 1.75, price: 20, infill: 15, walls: 3, layerH: 0.2, lineW: 0.42, speed: 'standard' };
  function migrate(saved) {
    if (!saved || typeof saved !== 'object') return null;
    if (saved.v >= 2) return saved;
    const same = Object.keys(OLD_DEFAULTS).every(k => saved[k] == null || saved[k] === OLD_DEFAULTS[k]);
    if (same) return null;
    const out = Object.assign({}, saved, { v: 2 });
    if (out.rollPrice == null) { out.rollPrice = out.price; out.rollG = 1000; }
    if (out.autoInfill == null) out.autoInfill = false; // they chose an infill: keep using it everywhere
    return out;
  }

  const clamp = (x, lo, hi, d) => { x = +x; return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  function normalize(s) {
    s = Object.assign({}, DEFAULTS, s || {});
    if (!MATERIALS[s.material]) s.material = DEFAULTS.material;
    if (!SPEEDS[s.speed]) s.speed = DEFAULTS.speed;
    const M = MATERIALS[s.material], resin = !!M.resin;
    const rollG = clamp(s.rollG, 50, 10000, 1000);
    const rollPrice = s.rollPrice != null && s.rollPrice !== '' ? clamp(s.rollPrice, 0, 100000, M.rollPrice) : clamp(s.price, 0, 10000, M.price) * rollG / 1000;
    return {
      v: 2, material: s.material, resin,
      density: clamp(s.density, 0.5, 3, M.density),
      diameter: clamp(s.diameter, 1, 3.5, 1.75),
      rollPrice: Math.round(rollPrice * 100) / 100, rollG,
      price: rollPrice / rollG * 1000, // per kg, derived
      infill: clamp(s.infill, 0, 100, 15),
      walls: Math.round(clamp(s.walls, 1, 20, 2)),
      layerH: clamp(s.layerH, 0.01, 1, resin ? 0.05 : 0.2),
      lineW: clamp(s.lineW, 0.2, 1.2, 0.42),
      speed: resin ? 'resin' : (s.speed === 'resin' ? 'fast' : s.speed),
      flow: SPEEDS[resin ? 'resin' : (s.speed === 'resin' ? 'fast' : s.speed)].flow,
      autoInfill: s.autoInfill !== false
    };
  }

  // Geometry the estimate needs from a triangle soup (mm): volume, area, side-facing area, top- and
  // bottom-facing areas (projected), height. scale multiplies every coordinate.
  function geometry(p, scale) {
    const k = scale || 1;
    let vol = 0, area = 0, side = 0, up = 0, down = 0, zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < p.length; i += 9) {
      const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2], bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, n2 = Math.hypot(nx, ny, nz);
      vol += (p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7]) - p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6]) + p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6])) / 6;
      for (let j = 2; j < 9; j += 3) { if (p[i + j] < zmin) zmin = p[i + j]; if (p[i + j] > zmax) zmax = p[i + j]; }
      if (!n2) continue;
      const a = n2 / 2, z = nz / n2;
      area += a; side += a * Math.sqrt(Math.max(0, 1 - z * z)); if (z > 0) up += a * z; else down -= a * z;
    }
    const k2 = k * k;
    return { volume: Math.abs(vol) * k2 * k, area: area * k2, side: side * k2, up: up * k2, down: down * k2, height: p.length ? (zmax - zmin) * k : 0 };
  }

  // FDM material split into walls, skins and infill (mm^3 before flow), for a part and settings
  function fdmParts(g, s) {
    const vol = g.volume, lh = s.layerH, sp = w => Math.max(0.05, w - lh * (1 - Math.PI / 4)); // spacing of a line w wide
    const side = g.side != null ? g.side : g.area * 0.8, up = g.up != null ? g.up : g.area * 0.1, down = g.down != null ? g.down : g.area * 0.1;
    const tw = sp(s.lineW) + sp(s.lineW + 0.03) * (s.walls - 1);
    const walls = Math.min(vol, side * tw);
    const skins = Math.min(vol - walls, (up * Math.max(5 * lh, 1.0) + down * 3 * lh) * 0.9);
    const core = Math.max(0, vol - walls - skins);
    const coreW = core > 0 && side > 0 ? 2 * core / side : 0; // typical width of the core (mm)
    const d = s.infill / 100;
    const eff = d >= 1 ? 1 : Math.min(1, d * (1 + 1 / Math.max(coreW, 1e-6)) + (1 - d) * Math.exp(-coreW));
    return { walls, skins, core, infill: core * eff, effInfill: eff, coreW };
  }
  const FLOW_RATIO = 0.98; // Bambu PLA Basic flow ratio: slicers extrude 2% less than the nominal volume
  // geo: { volume (mm^3, sign ignored), area (mm^2), height (mm, as printed), and optionally side/up/down (see geometry) }
  function estimate(geo, settings) {
    const s = normalize(settings);
    const g = Object.assign({}, geo, { volume: Math.abs(+geo.volume || 0), area: Math.max(0, +geo.area || 0) });
    const height = Math.max(0, +geo.height || 0);
    const sp = SPEEDS[s.speed];
    const layers = height > 0 ? Math.ceil(height / s.layerH) : 0;
    let used, hours, parts = null;
    if (s.resin) {
      used = g.volume;
      hours = layers * sp.layerSec / 3600;
    } else {
      parts = fdmParts(g, s);
      used = (parts.walls + parts.skins + parts.infill) * FLOW_RATIO;
      const thin = 0.2 / s.layerH; // thinner layers: more moves for the same plastic
      hours = (parts.walls / sp.wall + parts.skins / sp.skin + parts.infill / sp.infill) * FLOW_RATIO * (0.75 + 0.25 * thin) / 3600 + layers * sp.layerSec / 3600;
    }
    const grams = used / 1000 * s.density;
    const meters = s.resin ? null : used / (Math.PI * (s.diameter / 2) ** 2) / 1000;
    return { used, grams, meters, ml: used / 1000, cost: grams / 1000 * s.price, hours, layers, resin: s.resin, infill: s.infill, walls: s.walls, parts };
  }

  // Recommended infill and walls for one part: { infill, walls, pattern, reason, kind }.
  // ctx: { kind: 'part' | 'pins' | 'litho' | 'connector', joints, dims: [x, y, z] mm }
  function recommend(geo, ctx) {
    ctx = ctx || {};
    const dims = ctx.dims || [0, 0, geo.height || 0], maxD = Math.max(...dims), minD = Math.min(...dims.filter(x => x > 0).concat([Infinity]));
    const vol = Math.abs(geo.volume || 0), side = geo.side != null ? geo.side : (geo.area || 0) * 0.8;
    const thick = side > 0 ? 2 * vol / side : minD; // typical wall-to-wall thickness
    if (ctx.kind === 'litho') return { infill: 100, walls: 2, pattern: 'solid', kind: 'solid', reason: 'Lithophane: print solid so the light shows the picture evenly' };
    if (ctx.kind === 'pins' || ctx.kind === 'connector') return { infill: 100, walls: 3, pattern: 'solid', kind: 'solid', reason: 'Dowel pins and connectors carry the load: print solid' };
    if (thick < 4 || minD < 5) return { infill: 100, walls: 2, pattern: 'solid', kind: 'solid', reason: `Thin (about ${thick.toFixed(1)} mm): it prints solid anyway` };
    if (vol < 20000 || maxD < 40) return { infill: 25, walls: 3, pattern: 'gyroid', kind: 'small', reason: 'Small part: a little more infill makes it sturdy for a few grams' };
    if (maxD >= 120) return { infill: (ctx.joints || 0) >= 3 ? 12 : 10, walls: 3, pattern: 'gyroid', kind: 'shell', reason: `Big cosmetic part: light gyroid infill, a third wall for stiffness${(ctx.joints || 0) >= 3 ? ' (a bit more for its ' + ctx.joints + ' joints)' : ''}` };
    return { infill: (ctx.joints || 0) >= 3 ? 20 : 15, walls: (ctx.joints || 0) ? 3 : 2, pattern: 'gyroid', kind: 'std', reason: (ctx.joints || 0) ? `Medium part with ${ctx.joints} joint${ctx.joints > 1 ? 's' : ''}: 3 walls so the joint holes stay strong` : 'Medium part: standard 15% infill' };
  }
  function total(list) {
    const t = { used: 0, grams: 0, meters: 0, ml: 0, cost: 0, hours: 0, resin: false };
    for (const e of list) { if (!e) continue; t.used += e.used; t.grams += e.grams; t.meters += e.meters || 0; t.ml += e.ml; t.cost += e.cost; t.hours += e.hours; t.resin = t.resin || e.resin; }
    if (t.resin) t.meters = null;
    return t;
  }
  // Round to whole minutes first so 19.995 h reads "20 h 00 m", not "19 h 60 m".
  const hrs = h => { const m = Math.round(h * 60); return m < 60 ? `${Math.max(1, m)} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`; };
  // Short human strings, shared by the app, the README in zips and the assembly sheet.
  function describe(e, currency) {
    const c = currency || '$';
    return {
      weight: e.grams >= 1000 ? `${(e.grams / 1000).toFixed(2)} kg` : `${Math.round(e.grams)} g`,
      length: e.resin ? `${e.ml.toFixed(e.ml < 10 ? 1 : 0)} ml` : `${e.meters.toFixed(e.meters < 10 ? 1 : 0)} m`,
      cost: `${c}${e.cost.toFixed(2)}`,
      time: hrs(e.hours)
    };
  }

  // Several printers working at once: hand out the jobs (parts, pin blocks) so the printers finish at about the same time.
  // jobs: [{ id, hours, dims:[x,y,z] }] (hours at 100 % speed); printers: [{ name, speed (100 = as estimated), bed:[x,y,z] }].
  // Longest job first, each to the printer it fits on that would finish it soonest. A job no printer fits goes to the
  // first printer and is reported in `unfit`.
  function fitsOn(d, b, turn) {
    const e = b.map(x => x + 0.01);
    if (turn) { const s = d.slice().sort((x, y) => x - y), t = e.slice().sort((x, y) => x - y); return s.every((x, i) => x <= t[i]); }
    return d[2] <= e[2] && ((d[0] <= e[0] && d[1] <= e[1]) || (d[0] <= e[1] && d[1] <= e[0]));
  }
  function balance(jobs, printers, opt) {
    opt = opt || {};
    const P = printers.map((p, i) => ({ i, name: p.name, speed: Math.max(10, Math.min(500, +p.speed || 100)), bed: p.bed, hours: 0, jobs: [] }));
    const order = jobs.map((j, k) => ({ j, k })).sort((a, b) => b.j.hours - a.j.hours || a.k - b.k);
    const unfit = [];
    for (const { j } of order) {
      const ok = P.filter(p => !p.bed || !j.dims || fitsOn(j.dims, p.bed, opt.turn));
      const pool = ok.length ? ok : [P[0]];
      if (!ok.length) unfit.push(j.id);
      let best = null, bestEnd = Infinity;
      for (const p of pool) { const end = p.hours + j.hours * 100 / p.speed; if (end < bestEnd - 1e-9) { best = p; bestEnd = end; } }
      best.hours = bestEnd; best.jobs.push(j.id);
    }
    const one = jobs.reduce((n, j) => n + j.hours, 0);
    const finish = P.reduce((m, p) => Math.max(m, p.hours), 0);
    return { printers: P.map(p => ({ name: p.name, speed: p.speed, hours: p.hours, jobs: p.jobs })), finish, single: one, unfit };
  }
  const api = { MATERIALS, SPEEDS, DEFAULTS, OLD_DEFAULTS, migrate, normalize, geometry, fdmParts, estimate, recommend, total, describe, hrs, balance, fitsOn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.PrintEstimate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
