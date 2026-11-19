/* Expressarte vase generator: parametric vases, planters, pen cups and lamp shades. A profile (classic, bulb, amphora...)
   times a cross-section (round or 3 to 12 sides, star) times a surface pattern (ribs, waves, spiral, diamonds, bumps,
   low-poly facets), with twist. Exports a closed solid for the slicer's spiral vase mode, or a real walled vessel with
   a floor and an optional drain hole. Watertight by construction. Generic names only. American spelling. */
(function (G) {
  'use strict';
  const C = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const FREE = { maxHeight: 200, patterns: ['none', 'ribs', 'waves'] }, MAX = { height: 500 };
  // profile radius factor at t = 0 (bottom) .. 1 (top); max of each is about 1
  const PROFILES = {
    classic: { label: 'Classic', f: t => 0.62 + 0.38 * Math.sin(Math.PI * (0.15 + 0.7 * t)) - 0.12 * t },
    bulb: { label: 'Bulb', f: t => t < 0.7 ? 0.55 + 0.45 * Math.sin(Math.PI * t / 0.7) : 0.55 - 0.22 * Math.sin(Math.PI * 0.75 * (t - 0.7) / 0.3) },
    cylinder: { label: 'Cylinder', f: () => 0.86 },
    flared: { label: 'Flared', f: t => 0.5 + 0.5 * t * t },
    hourglass: { label: 'Hourglass', f: t => 0.62 + 0.38 * Math.abs(Math.cos(Math.PI * t)) },
    amphora: { label: 'Amphora', f: t => t < 0.75 ? 0.5 + 0.5 * Math.sin(Math.PI * (0.1 + 0.9 * t / 0.75)) * (1 - 0.2 * t) : 0.5 - 0.22 * Math.sin(Math.PI * 0.8 * (t - 0.75) / 0.25) },
    bud: { label: 'Bud vase', f: t => 0.3 + 0.7 * Math.exp(-((t - 0.28) ** 2) / 0.05) * (1 - 0.3 * t) + 0.05 * t },
    cone: { label: 'Tapered', f: t => 1 - 0.38 * t },
    planter: { label: 'Planter', f: t => 0.78 + 0.22 * t }
  };
  const SECTIONS = { round: 'Round', poly: 'Polygon', star: 'Star', flower: 'Flower' };
  const PATTERNS = { none: 'Smooth', ribs: 'Ribs', waves: 'Waves', spiral: 'Spiral ribs', diamond: 'Diamonds', bumps: 'Bumps', facets: 'Low-poly facets', basket: 'Basket weave' };
  const PRESETS = {
    classic: { label: 'Classic ribbed vase', profile: 'classic', section: 'round', pattern: 'ribs', count: 24, depth: 1.6, twist: 0, height: 160, diameter: 100 },
    twisted: { label: 'Twisted hexagon', profile: 'cone', section: 'poly', sides: 6, pattern: 'none', twist: 120, height: 150, diameter: 95 },
    wave: { label: 'Wave bulb', profile: 'bulb', section: 'round', pattern: 'waves', count: 10, depth: 3, twist: 30, height: 170, diameter: 110 },
    star: { label: 'Star spiral', profile: 'flared', section: 'star', sides: 8, pattern: 'none', twist: 90, height: 140, diameter: 100 },
    planter: { label: 'Planter with drain', profile: 'planter', section: 'round', pattern: 'diamond', count: 18, depth: 2, twist: 0, height: 110, diameter: 130, mode: 'walled', drain: true },
    pencup: { label: 'Pen cup', profile: 'cylinder', section: 'poly', sides: 8, pattern: 'facets', count: 8, depth: 1.5, twist: 45, height: 100, diameter: 75, mode: 'walled' },
    bud: { label: 'Bud vase', profile: 'bud', section: 'round', pattern: 'spiral', count: 12, depth: 1.2, twist: 0, height: 150, diameter: 70 }
  };
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const PALETTE = [{ name: 'Peach', hex: PZ.peach }, { name: 'Soft pink', hex: PZ.pink }, { name: 'Mint', hex: PZ.mint }, { name: 'Baby blue', hex: PZ.babyBlue }, { name: 'Lavender', hex: PZ.lavender }, { name: 'Butter yellow', hex: PZ.butter }, { name: 'Matte white', hex: '#F2F0EB' }, { name: 'Sage', hex: '#9CB59A' }, { name: 'Terracotta', hex: '#C66B4B' }, { name: 'Ocean blue', hex: '#2F6FB0' }, { name: 'Charcoal', hex: '#2B2B2B' }, { name: 'Blush', hex: '#E8B4B0' }, { name: 'Mustard', hex: '#D9A62E' }, { name: 'Deep lavender', hex: '#A78BD0' }, { name: 'Silk gold', hex: '#C9A13B' }, { name: 'Translucent', hex: '#DDE8EE' }];
  const DEFAULTS = { preset: 'classic', profile: 'classic', section: 'round', sides: 6, pattern: 'ribs', count: 24, depth: 1.6, twist: 0, height: 160, diameter: 100, mode: 'vase', wall: 2, floor: 2.4, drain: false, drainD: 8, color: PZ.peach, detail: 'hd', bed: [256, 256, 256], bambu: 'A1' };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), num = (v, d, a, b) => { const n = +v; return clamp(Number.isFinite(n) ? n : d, a, b); };
  function options(raw) {
    raw = raw || {}; const p = PRESETS[raw.preset] || null;
    const o = Object.assign({}, DEFAULTS, p ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'label')) : {}, raw);
    if (!PROFILES[o.profile]) o.profile = 'classic'; if (!SECTIONS[o.section]) o.section = 'round'; if (!PATTERNS[o.pattern]) o.pattern = 'none';
    o.sides = Math.round(num(o.sides, 6, 3, 12)); o.count = Math.round(num(o.count, 24, 2, 72)); o.depth = num(o.depth, 1.6, 0, 8); o.twist = num(o.twist, 0, -720, 720);
    o.height = num(o.height, 160, 30, MAX.height); o.diameter = num(o.diameter, 100, 25, 400); o.mode = o.mode === 'walled' ? 'walled' : 'vase';
    o.wall = num(o.wall, 2, 0.8, 6); o.floor = num(o.floor, 2.4, 1, 10); o.drain = !!o.drain && o.mode === 'walled'; o.drainD = num(o.drainD, 8, 3, 30);
    if (!Array.isArray(o.bed) || o.bed.length < 2) o.bed = DEFAULTS.bed; if (o.bed.length < 3) o.bed = [o.bed[0], o.bed[1], 256];
    return o;
  }
  // cross-section radius factor at angle a (max 1)
  function section(o, a) {
    if (o.section === 'poly') { const n = o.sides, k = Math.PI / n, x = ((a % (2 * k)) + 2 * k) % (2 * k) - k; return Math.cos(k) / Math.cos(x); }
    if (o.section === 'star') { const n = o.sides, x = Math.abs(((a * n / (2 * Math.PI)) % 1 + 1) % 1 - 0.5) * 2; return 0.72 + 0.28 * x; }
    if (o.section === 'flower') return 0.84 + 0.16 * Math.cos(a * o.sides);
    return 1;
  }
  // pattern offset in mm (outward) at angle a and height t
  function pattern(o, a, t) {
    const n = o.count, d = o.depth;
    switch (o.pattern) {
      case 'ribs': return d * (0.5 + 0.5 * Math.cos(a * n)) ** 3;
      case 'waves': return d * Math.sin(a * n + Math.sin(t * Math.PI * 4) * 2.2) * 0.5 + d * 0.5;
      case 'spiral': return d * (0.5 + 0.5 * Math.cos(a * n + t * Math.PI * 6)) ** 2;
      case 'diamond': { const u = Math.abs(((a * n / (2 * Math.PI) + t * o.height / 14) % 1 + 1) % 1 - 0.5), v = Math.abs(((a * n / (2 * Math.PI) - t * o.height / 14) % 1 + 1) % 1 - 0.5); return d * (1 - 2 * Math.min(u, v)); }
      case 'bumps': { const rows = Math.max(3, Math.round(o.height / (Math.PI * o.diameter / n))), s = (Math.cos(a * n + (Math.floor(t * rows) % 2) * Math.PI) * 0.5 + 0.5) * Math.sin(Math.PI * ((t * rows) % 1)); return d * s * s; }
      case 'facets': { const rows = Math.max(2, Math.round(o.height / 25)), sa = 2 * Math.PI / n, ai = Math.round(a / sa) * sa, ti = Math.round(t * rows) / rows; return d * (1 - Math.min(1, Math.abs(a - ai) / (sa / 2) * 0.6 + Math.abs(t - ti) * rows * 0.6)); }
      case 'basket': { const rows = Math.max(4, Math.round(o.height / 10)), r = Math.floor(t * rows), ph = (r % 2) * Math.PI; return d * (0.5 + 0.5 * Math.cos(a * n + ph)) * Math.sin(Math.PI * ((t * rows) % 1)) ** 0.5; }
      default: return 0;
    }
  }
  function grid(o) { const hd = o.detail !== 'standard'; return { ns: Math.min(720, Math.max(hd ? 240 : 120, o.count * (hd ? 12 : 6))), nz: Math.max(hd ? 160 : 80, Math.round(o.height / (hd ? 0.6 : 1.2))) }; }
  // outer radius (mm) at angle a and height z
  function rOuter(o, a, z) {
    const t = z / o.height, R = o.diameter / 2, tw = o.twist * Math.PI / 180 * t, aa = a - tw;
    const base = R * PROFILES[o.profile].f(clamp(t, 0, 1)) * section(o, aa);
    return Math.max(4, base - o.depth + pattern(o, aa, t));
  }
  function build(raw) {
    const o = options(raw), { ns, nz } = grid(o), H = o.height, warnings = [];
    const out = [], tri = (a, b, c) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const ring = (z, f) => { const r = []; for (let i = 0; i < ns; i++) { const a = i / ns * 2 * Math.PI, rr = f(a, z); r.push([Math.cos(a) * rr, Math.sin(a) * rr, z]); } return r; };
    const band = (A, B, flip) => { for (let i = 0; i < ns; i++) { const j = (i + 1) % ns; if (!flip) { tri(A[i], A[j], B[j]); tri(A[i], B[j], B[i]); } else { tri(A[i], B[j], A[j]); tri(A[i], B[i], B[j]); } } };
    const cap = (R0, z, up, hole) => { // fan to center, or an annulus to a hole ring
      if (hole) { for (let i = 0; i < ns; i++) { const j = (i + 1) % ns; if (up) { tri(R0[i], R0[j], hole[j]); tri(R0[i], hole[j], hole[i]); } else { tri(R0[i], hole[j], R0[j]); tri(R0[i], hole[i], hole[j]); } } return; }
      const c = [0, 0, z]; for (let i = 0; i < ns; i++) { const j = (i + 1) % ns; if (up) tri(c, R0[i], R0[j]); else tri(c, R0[j], R0[i]); }
    };
    const zs = []; for (let k = 0; k <= nz; k++) zs.push(H * k / nz);
    const outer = zs.map(z => ring(z, (a, zz) => rOuter(o, a, zz)));
    for (let k = 0; k < nz; k++) band(outer[k], outer[k + 1], false);
    let minR = Infinity; for (const R of outer) for (const p of R) minR = Math.min(minR, Math.hypot(p[0], p[1]));
    if (o.mode === 'vase') { cap(outer[0], 0, false); cap(outer[nz], H, true); }
    else {
      // inner wall: the outer surface pulled in by the wall thickness along the local slope, from the floor to the rim
      const w = o.wall, zf = Math.min(o.floor, H * 0.5);
      const rIn = (a, z) => { const dz = 0.5, r0 = rOuter(o, a, Math.max(0, z - dz)), r1 = rOuter(o, a, Math.min(H, z + dz)), slope = (r1 - r0) / (2 * dz); return Math.max(1.5, rOuter(o, a, z) - w * Math.sqrt(1 + slope * slope)); };
      const kz = zs.findIndex(z => z >= zf), izs = [zf, ...zs.slice(kz).filter(z => z > zf + 1e-6)];
      const inner = izs.map(z => ring(z, rIn));
      for (let k = 0; k < inner.length - 1; k++) band(inner[k], inner[k + 1], true);
      cap(outer[nz], H, true, inner[inner.length - 1]);
      if (o.drain) {
        const rr = o.drainD / 2, hb = [], ht = []; for (let i = 0; i < ns; i++) { const a = i / ns * 2 * Math.PI; hb.push([Math.cos(a) * rr, Math.sin(a) * rr, 0]); ht.push([Math.cos(a) * rr, Math.sin(a) * rr, zf]); }
        cap(outer[0], 0, false, hb); cap(inner[0], zf, true, ht); band(hb, ht, true);
      } else { cap(outer[0], 0, false); cap(inner[0], zf, true); }
      let thin = Infinity; for (let i = 0; i < ns; i += 7) for (let k = 0; k < izs.length; k += 5) { const a = i / ns * 2 * Math.PI; thin = Math.min(thin, rOuter(o, a, izs[k]) - rIn(a, izs[k])); }
      if (thin < o.wall * 0.6) warnings.push('The pattern is deeper than the wall in places. Use a thicker wall or a shallower pattern.');
      if (minR < o.wall * 2 + 3) warnings.push('The neck is very narrow for a walled vessel; try spiral vase mode.');
    }
    const p = Float64Array.from(out), b = C.bbox(p), size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
    const U = [o.bed[0] - 8, o.bed[1] - 8]; const fits = size[0] <= U[0] && size[1] <= U[1] && size[2] <= o.bed[2];
    if (!fits) warnings.push(`The vase (${size.map(v => Math.round(v)).join(' \u00d7 ')} mm) is bigger than your printer. Make it smaller, or use Giant print to split it.`);
    // move so the footprint is centered on the origin
    const vol = Math.abs(C.signedVolume(p)), grams = Math.round((o.mode === 'vase' ? C.surfaceArea(p) * 0.45 / 2 : vol) / 1000 * 1.24);
    const stats = { height: +size[2].toFixed(1), width: +size[0].toFixed(1), depth: +size[1].toFixed(1), tris: p.length / 9, grams, mode: o.mode, neck: +(minR * 2).toFixed(1), liters: o.mode === 'walled' ? null : null };
    return { options: o, parts: [{ name: 'Vase', p, color: o.color, size, fits }], stats, warnings };
  }
  function gateInfo(raw) {
    const o = options(raw), reasons = [];
    if (!FREE.patterns.includes(o.pattern)) reasons.push(`the ${PATTERNS[o.pattern].toLowerCase()} pattern`);
    if (o.height > FREE.maxHeight) reasons.push(`vases taller than ${FREE.maxHeight} mm`);
    return { pro: reasons.length > 0, reasons };
  }
  function export3MF(res, o) {
    o = o || {}; const pt = res.parts[0];
    return T.threeMF([{ name: o.name || 'Vase', p: pt.p, extruder: 1, color: pt.color }], { title: o.name || 'Vase', plates: [[0]], bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: [{ color: pt.color }] });
  }
  function notes(res) {
    const o = res.options, s = res.stats, L = ['Expressarte vase', '', `${PROFILES[o.profile].label} profile, ${SECTIONS[o.section].toLowerCase()} section, ${PATTERNS[o.pattern].toLowerCase()}${o.twist ? `, ${o.twist}\u00b0 twist` : ''}. ${s.width} x ${s.depth} x ${s.height} mm.`, '', 'Printing'];
    if (o.mode === 'vase') L.push('  - This is a closed solid for spiral vase mode: in your slicer turn on Spiral vase (Bambu Studio: Others > Spiral vase; others: "Spiralize outer contour" or "Vase mode").', '  - Use a 0.6-0.8 mm line width (0.4 mm nozzle) or a 0.6 mm nozzle for a stronger wall, 3-4 bottom layers. Not watertight for water unless you print a wide line; for fresh flowers use a glass insert or the walled mode.');
    else L.push(`  - Walled vessel: ${o.wall} mm walls and a ${o.floor} mm floor${o.drain ? ` with a ${o.drainD} mm drain hole` : ''}. Print with normal settings, 3+ walls (or 100% for the wall thickness) for a watertight vase.`);
    L.push('  - No supports needed.');
    if (res.warnings.length) { L.push('', 'Notes'); res.warnings.forEach(w => L.push('  - ' + w)); }
    return L.join('\n');
  }
  function files(res, o) { o = o || {}; const base = o.fileBase || 'vase'; return [{ name: `${base}.stl`, data: new Uint8Array(C.writeSTL(res.parts[0].p, 'Vase')) }, { name: `${base}.3mf`, data: export3MF(res, o) }, { name: `${base}_NOTES.txt`, data: notes(res) }]; }
  function printList(res) { return res.parts.map(pt => ({ name: pt.name, p: pt.p, color: pt.color })); }
  const api = { FREE, MAX, PROFILES, SECTIONS, PATTERNS, PRESETS, PALETTE, DEFAULTS, options, build, gateInfo, export3MF, notes, files, printList };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPVase = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
