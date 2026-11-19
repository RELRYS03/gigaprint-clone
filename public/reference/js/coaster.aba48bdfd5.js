/* Expressarte custom coasters: round, square, rounded-square, hexagon, octagon, scalloped and bottle-cap coasters with a
   decorative raised rim (plain, double, rope, beaded, scalloped, Greek key, hexagons, laurel, notched, gear teeth,
   waves, zigzag, stars or none), curved text along the top and bottom of the rim (the bottom arc reads left to right,
   upright), and a center with a traced logo, one or two lines of text, or both. The design can be raised, engraved,
   or inlaid flush in another color. Optional textured center, drink drainage grooves, a recessed cork or felt pocket
   or pockets for anti-slip feet underneath, a matching holder for the set, and a quantity laid out on the plates.
   Every text and logo is fitted inside its own area (never over the rim decoration, never off the coaster); fitCheck
   is the independent check the audit runs. Every body is a closed, watertight shell; the 3MF has one object per
   coaster with a part per color. American spelling. No brand names. */
(function (G) {
  'use strict';
  const C = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const ST = () => G.GPStamp || (typeof require === 'function' ? require('./stamp.js') : null);

  const SHAPES = [
    { id: 'round', label: 'Round' }, { id: 'rounded', label: 'Rounded square' }, { id: 'square', label: 'Square' },
    { id: 'hexagon', label: 'Hexagon' }, { id: 'octagon', label: 'Octagon' }, { id: 'scalloped', label: 'Scalloped' }, { id: 'cap', label: 'Bottle cap' }
  ];
  const RIMS = [
    { id: 'plain', label: 'Plain raised rim' }, { id: 'double', label: 'Double rim' }, { id: 'rope', label: 'Rope (twisted)' },
    { id: 'beaded', label: 'Beaded' }, { id: 'scallop', label: 'Scalloped arches' }, { id: 'greek', label: 'Greek key' },
    { id: 'hex', label: 'Hexagons' }, { id: 'laurel', label: 'Laurel leaves' }, { id: 'notched', label: 'Notched' },
    { id: 'gear', label: 'Gear teeth' }, { id: 'waves', label: 'Waves' }, { id: 'zigzag', label: 'Zigzag' },
    { id: 'stars', label: 'Stars' }, { id: 'none', label: 'No rim' }
  ];
  const SURFACES = [
    { id: 'flat', label: 'Flat' }, { id: 'dots', label: 'Dots' }, { id: 'ribs', label: 'Ribs' }, { id: 'grid', label: 'Grid' },
    { id: 'hex', label: 'Honeycomb' }, { id: 'waves', label: 'Waves' }, { id: 'rings', label: 'Rings' }, { id: 'sunburst', label: 'Sunburst' }
  ];
  const DRAINS = [{ id: 'none', label: 'None' }, { id: 'ring', label: 'Drip ring' }, { id: 'radial', label: 'Drip ring and grooves' }];
  const BOTTOMS = [{ id: 'none', label: 'Flat' }, { id: 'cork', label: 'Cork or felt pocket' }, { id: 'pads', label: 'Pockets for stick-on feet' }, { id: 'tpu', label: 'Printed TPU feet' }];
  const STYLES = [{ id: 'raised', label: 'Raised' }, { id: 'engraved', label: 'Engraved' }, { id: 'inlay', label: 'Inlaid flush (multicolor)' }];
  const CENTERS = [{ id: 'text', label: 'Text' }, { id: 'logo', label: 'Logo' }, { id: 'both', label: 'Logo and text' }, { id: 'none', label: 'Nothing' }];
  const SEPS = [{ id: 'dot', label: 'Dots' }, { id: 'star', label: 'Stars' }, { id: 'heart', label: 'Hearts' }, { id: 'none', label: 'None' }];
  const FONTS = [
    { id: 'slab', label: 'Bold slab' }, { id: 'block', label: 'Block' }, { id: 'script', label: 'Script' }, { id: 'tall', label: 'Tall' },
    { id: 'round', label: 'Rounded' }, { id: 'chunky', label: 'Chunky' }, { id: 'western', label: 'Western' }
  ];
  const PZ = (C && C.PASTELS) || {};
  const INK = PZ.ink || '#2B2D31';
  const PALETTE = [
    { name: 'Mint', hex: PZ.mint || '#A8E6CF' }, { name: 'Sage', hex: PZ.sage || '#B5C9A8' }, { name: 'Baby blue', hex: PZ.babyBlue || '#A7C7E7' },
    { name: 'Lavender', hex: PZ.lavender || '#C8B6E2' }, { name: 'Pink', hex: PZ.pink || '#F4B6C2' }, { name: 'Peach', hex: PZ.peach || '#F9C6A8' },
    { name: 'Butter', hex: PZ.butter || '#F8E7A1' }, { name: 'Cream', hex: PZ.cream || '#F6EFDC' }, { name: 'White', hex: '#F7F4EE' },
    { name: 'Gold', hex: '#D4A72C' }, { name: 'Walnut', hex: '#6B4226' }, { name: 'Slate', hex: '#4A4E55' }, { name: 'Charcoal', hex: INK }, { name: 'Black', hex: '#1C1C1E' }
  ];
  // Free: one coaster in up to 2 filament colors, with every shape, rim, font, surface and bottom option.
  // Pro: sets (2 or more), 3+ colors, an uploaded logo and the holder (same pattern as the bar mat).
  const FREE = { maxQty: 1, maxColors: 2, logo: false, holder: false };
  const LIMITS = { minArcCap: 3, minCenterCap: 3.5, maxArc: 40, maxCenter: 24, maxQty: 12, gap: 1.6, minSize: 60, maxSize: 160 };
  const DEFAULTS = {
    shape: 'round', size: 100, baseT: 3.2, radius: 0,
    rim: 'rope', rimW: 7, rimH: 1.4, decoH: 0.8,
    topText: 'THE SMITHS', bottomText: 'EST. 2026', arcFont: 'slab', arcH: 7.5, sep: 'dot',
    center: 'text', line1: 'Cheers', line2: '', centerFont: 'script', centerFont2: 'slab', cap1: 22, cap2: 9, centerSize: 100,
    logo: null, logo2: null, logoPos: 'above', logoSize: 44,
    style: 'raised', textH: 1.0, textD: 0.8,
    surface: 'flat', texH: 0.6, drain: 'none', bottom: 'none', pocketD: 1.6, padD: 10,
    qty: 1, holder: false,
    colors: { base: PZ.mint || '#A8E6CF', rim: INK, trim: INK, text: INK, center: INK, logo: INK, logo2: PZ.pink || '#F4B6C2', holder: PZ.mint || '#A8E6CF' },
    detail: 'hd', bed: [256, 256, 256], bambu: 'A1'
  };
  const PRESETS = {
    pastel: { label: 'Pastel rope', shape: 'round', rim: 'rope', topText: 'THE SMITHS', bottomText: 'EST. 2026', arcFont: 'slab', sep: 'dot', center: 'text', line1: 'Cheers', line2: '', centerFont: 'script', surface: 'flat', drain: 'none',
      colors: { base: PZ.mint || '#A8E6CF', rim: INK, trim: INK, text: INK, center: INK, holder: PZ.mint || '#A8E6CF' } },
    classic: { label: 'Greek key', shape: 'round', rim: 'greek', topText: 'OPA', bottomText: 'KALI OREXI', arcFont: 'block', sep: 'star', center: 'text', line1: 'Cheers', line2: '', centerFont: 'tall', surface: 'flat', drain: 'none',
      colors: { base: PZ.babyBlue || '#A7C7E7', rim: '#F7F4EE', trim: '#F7F4EE', text: '#F7F4EE', center: '#F7F4EE', holder: PZ.babyBlue || '#A7C7E7' } },
    garden: { label: 'Laurel', shape: 'round', rim: 'laurel', topText: 'HOME SWEET HOME', bottomText: '', arcFont: 'slab', sep: 'none', center: 'text', line1: 'Garcia', line2: '', centerFont: 'script', surface: 'flat', drain: 'ring',
      colors: { base: PZ.cream || '#F6EFDC', rim: PZ.sage || '#B5C9A8', trim: PZ.sage || '#B5C9A8', text: PZ.sage || '#B5C9A8', center: PZ.sage || '#B5C9A8', holder: PZ.cream || '#F6EFDC' } },
    modern: { label: 'Modern hex', shape: 'hexagon', rim: 'hex', topText: '', bottomText: '', arcFont: 'block', sep: 'none', center: 'text', line1: 'HELLO', line2: 'friend', centerFont: 'block', centerFont2: 'script', surface: 'hex', drain: 'none',
      colors: { base: PZ.lavender || '#C8B6E2', rim: '#F7F4EE', trim: '#F7F4EE', text: '#F7F4EE', center: '#F7F4EE', holder: PZ.lavender || '#C8B6E2' } },
    cap: { label: 'Bottle cap', shape: 'cap', rim: 'beaded', topText: 'ICE COLD', bottomText: 'SINCE 2026', arcFont: 'chunky', sep: 'star', center: 'text', line1: 'Cheers', line2: '', centerFont: 'western', surface: 'flat', drain: 'none',
      colors: { base: PZ.peach || '#F9C6A8', rim: '#F7F4EE', trim: '#F7F4EE', text: '#F7F4EE', center: '#F7F4EE', holder: PZ.peach || '#F9C6A8' } },
    bar: { label: 'Drip ring', shape: 'rounded', rim: 'double', topText: 'HAPPY HOUR', bottomText: 'ANY HOUR', arcFont: 'tall', sep: 'dot', center: 'text', line1: 'BAR', line2: '', centerFont: 'slab', surface: 'ribs', drain: 'radial',
      colors: { base: PZ.butter || '#F8E7A1', rim: INK, trim: INK, text: INK, center: INK, holder: PZ.butter || '#F8E7A1' } }
  };

  const clamp = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  const hex = (c, d) => /^#[0-9a-f]{6}$/i.test(c || '') ? String(c).toUpperCase() : d;
  const has = (list, id) => list.some(x => x.id === id);
  const str = (v, n) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').slice(0, n);
  function usable(o) { return { w: Math.max(50, o.bed[0] - 8), d: Math.max(50, o.bed[1] - 8), z: Math.max(20, (o.bed[2] || 256) - 4) }; }

  function options(raw) {
    raw = raw || {};
    const o = Object.assign({}, DEFAULTS, raw);
    o.bed = Array.isArray(o.bed) && o.bed[0] > 0 && o.bed[1] > 0 ? o.bed.map(Number) : DEFAULTS.bed.slice();
    if (!o.bed[2]) o.bed[2] = 256;
    o.shape = has(SHAPES, o.shape) ? o.shape : 'round';
    o.size = clamp(o.size, LIMITS.minSize, LIMITS.maxSize, DEFAULTS.size);
    o.rim = has(RIMS, o.rim) ? o.rim : 'plain';
    o.rimW = clamp(o.rimW, 3, Math.min(18, o.size * 0.16), DEFAULTS.rimW);
    o.rimH = clamp(o.rimH, 0.4, 5, DEFAULTS.rimH);
    o.decoH = clamp(o.decoH, 0.4, 2.5, DEFAULTS.decoH);
    o.style = has(STYLES, o.style) ? o.style : 'raised';
    o.textH = clamp(o.textH, 0.4, 3, DEFAULTS.textH);
    o.bottom = has(BOTTOMS, o.bottom) ? o.bottom : 'none';
    o.pocketD = clamp(o.pocketD, 0.6, 3.2, DEFAULTS.pocketD);
    o.padD = clamp(o.padD, 6, 16, DEFAULTS.padD);
    o.drain = has(DRAINS, o.drain) ? o.drain : 'none';
    o.baseT = clamp(o.baseT, 2, 8, DEFAULTS.baseT);
    // the base keeps at least 1.2 mm of plastic between a bottom pocket and a groove or an engraving
    o.botD = o.bottom === 'none' ? 0 : +Math.min(o.bottom === 'cork' ? o.pocketD : 1.0, o.baseT - 1.2).toFixed(2);
    o.textD = clamp(o.textD, 0.4, 2, DEFAULTS.textD);
    const room = o.baseT - o.botD - 1.2;
    o.cutD = o.style === 'raised' ? 0 : Math.max(0, Math.min(o.textD, room));
    o.drainD = o.drain === 'none' ? 0 : Math.max(0, Math.min(0.8, room));
    o.topText = str(o.topText, LIMITS.maxArc); o.bottomText = str(o.bottomText, LIMITS.maxArc);
    o.arcFont = has(FONTS, o.arcFont) ? o.arcFont : 'slab';
    o.arcH = clamp(o.arcH, 4, 16, DEFAULTS.arcH);
    o.sep = has(SEPS, o.sep) ? o.sep : 'dot';
    o.center = has(CENTERS, o.center) ? o.center : 'text';
    o.line1 = str(o.line1, LIMITS.maxCenter); o.line2 = str(o.line2, LIMITS.maxCenter);
    o.centerFont = has(FONTS, o.centerFont) ? o.centerFont : 'script';
    o.centerFont2 = has(FONTS, o.centerFont2) ? o.centerFont2 : 'slab';
    o.cap1 = clamp(o.cap1, 4, 60, DEFAULTS.cap1); o.cap2 = clamp(o.cap2, 4, 60, DEFAULTS.cap2);
    o.centerSize = clamp(o.centerSize, 30, 100, DEFAULTS.centerSize);
    const polysOk = v => Array.isArray(v) && v.length && v.every(P => P && Array.isArray(P.outer) && P.outer.length >= 3);
    o.logo = polysOk(raw.logo) ? raw.logo : null;
    o.logo2 = o.logo && polysOk(raw.logo2) ? raw.logo2 : null;
    o.logoPos = o.logoPos === 'below' ? 'below' : 'above';
    o.logoSize = clamp(o.logoSize, 8, 150, DEFAULTS.logoSize);
    o.surface = has(SURFACES, o.surface) ? o.surface : 'flat';
    o.texH = clamp(o.texH, 0.3, 1.5, DEFAULTS.texH);
    o.qty = Math.round(clamp(o.qty, 1, LIMITS.maxQty, 1));
    o.holder = o.holder === true || o.holder === 'true';
    const c = Object.assign({}, DEFAULTS.colors, raw.colors || {});
    o.colors = {}; for (const k of Object.keys(DEFAULTS.colors)) o.colors[k] = hex(c[k], DEFAULTS.colors[k]);
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    o.bambu = o.bambu || 'A1';
    o.rimOn = o.rim !== 'none';
    o.rimTop = o.baseT + (o.rimOn ? o.rimH : 0);
    return o;
  }
  function presetOptions(id, bed) {
    const p = PRESETS[id] || PRESETS.pastel, o = JSON.parse(JSON.stringify(Object.assign({}, DEFAULTS, p)));
    o.colors = Object.assign({}, DEFAULTS.colors, p.colors || {});
    if (bed) o.bed = bed;
    return o;
  }

  // ---------------------------------------------------------------- 2D helpers
  function area2(L) { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; }
  function inLoop(p, L) { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function inPolys(p, polys) { for (const P of polys) if (inLoop(p, P.outer) && !P.holes.some(h => inLoop(p, h))) return true; return false; }
  function bboxOf(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const P of polys) for (const q of P.outer) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  const xf = (polys, f) => polys.map(P => ({ outer: P.outer.map(f), holes: (P.holes || []).map(h => h.map(f)) }));
  const movePolys = (polys, dx, dy, s) => xf(polys, p => [p[0] * (s || 1) + dx, p[1] * (s || 1) + dy]);
  const poly = L => ({ outer: L, holes: [] });
  const areaOf = polys => polys.length ? T.polysArea(polys) : 0;
  function open(polys, r, minA) {
    if (!polys.length) return polys;
    let p = r > 0 ? T.offset(T.offset(polys, -r), r) : polys;
    if (minA) p = p.filter(P => Math.abs(area2(P.outer)) - P.holes.reduce((s, h) => s + Math.abs(area2(h)), 0) >= minA);
    return p;
  }
  function densifyLoop(L, step) {
    const out = [];
    for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    return out;
  }

  // ---------------------------------------------------------------- outline
  function rawOutline(o) {
    const R = o.size / 2, n = o.detail === 'hd' ? 240 : 120;
    if (o.shape === 'round') return [poly(T.circle(0, 0, R, n))];
    if (o.shape === 'square') return [poly(T.roundRect(-R, -R, R, R, Math.max(2.5, o.size * 0.04), o.detail === 'hd' ? 10 : 5))];
    if (o.shape === 'rounded') return [poly(T.roundRect(-R, -R, R, R, o.size * 0.2, o.detail === 'hd' ? 18 : 8))];
    const reg = (k, rot, Rc) => { const L = []; for (let i = 0; i < k; i++) { const t = rot + i * 2 * Math.PI / k; L.push([Rc * Math.cos(t), Rc * Math.sin(t)]); } return L; };
    const roundCorners = (P, r) => T.offset(T.offset(P, -r), r);
    if (o.shape === 'hexagon') return roundCorners([poly(reg(6, 0, R))], Math.max(2.5, o.size * 0.04));
    if (o.shape === 'octagon') return roundCorners([poly(reg(8, Math.PI / 8, R / Math.cos(Math.PI / 8)))], Math.max(2, o.size * 0.03));
    if (o.shape === 'scalloped') { // 12 round lobes, the cusps between them rounded off
      const N = 12, rl = R * Math.sin(Math.PI / N) / (1 + Math.sin(Math.PI / N)) * 1.25, Rp = R - rl;
      const parts = [poly(T.circle(0, 0, Rp * Math.cos(Math.PI / N) + rl * 0.2, n))];
      for (let i = 0; i < N; i++) { const t = i * 2 * Math.PI / N + Math.PI / 2; parts.push(poly(T.circle(Rp * Math.cos(t), Rp * Math.sin(t), rl, Math.round(n / 4)))); }
      return T.offset(T.offset(T.unionPolys(parts), 1.2), -1.2);
    }
    // bottle cap: 21 soft crimps
    const N = 21, a = o.size * 0.028, L = [];
    for (let i = 0; i < n * 2; i++) { const t = i / (n * 2) * Math.PI * 2, r = R - a * (1 - Math.cos(N * t)) / 2; L.push([r * Math.cos(t + Math.PI / 2), r * Math.sin(t + Math.PI / 2)]); }
    return [poly(L)];
  }
  const OC = new Map();
  function cached(key, f) { if (OC.has(key)) return OC.get(key); const v = f(); if (OC.size > 400) OC.clear(); OC.set(key, v); return v; }
  function outline(o) { return cached(`o|${o.shape}|${o.size}|${o.detail}`, () => rawOutline(o)); }
  function inner(o, d) { return d <= 0 ? outline(o) : cached(`i|${o.shape}|${o.size}|${o.detail}|${d.toFixed(3)}`, () => T.offset(outline(o), -d)); }
  function ringBetween(o, d0, d1) { return T.diffPolys(inner(o, d0), inner(o, d1)); }
  function inscribed(polys) { // distance from the center to the nearest edge
    let m = Infinity;
    for (const P of polys) for (const L of [P.outer, ...P.holes]) for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / l2)) : 0;
      m = Math.min(m, Math.hypot(a[0] + dx * t, a[1] + dy * t));
    }
    return m;
  }
  function biggest(polys) { let b = null; for (const P of polys) if (!b || Math.abs(area2(P.outer)) > Math.abs(area2(b.outer))) b = P; return b; }

  // ---------------------------------------------------------------- rim decoration (patterns laid along the rim's mid-line)
  function stripPath(o) {
    const mid = biggest(inner(o, o.rimW / 2)); let L = mid.outer.slice(); if (area2(L) < 0) L.reverse();
    const cum = [0]; for (let i = 1; i <= L.length; i++) { const a = L[i - 1], b = L[i % L.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const len = cum[cum.length - 1], ds = 0.25, n = Math.max(64, Math.round(len / ds)), step = len / n, pts = [];
    let j = 0;
    for (let i = 0; i < n; i++) { const s = i * step; while (cum[j + 1] < s) j++; const a = L[j], b = L[(j + 1) % L.length], t = (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]); pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    const win = Math.max(1, Math.round(Math.min(2.5, o.rimW * 0.35) / step)), nrm = [];
    for (let i = 0; i < n; i++) { const a = pts[(i - win + n) % n], b = pts[(i + win) % n]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; nrm.push([ty, -tx]); }
    return { pts, nrm, len, step, n };
  }
  function mapUV(S, u, v) {
    let f = (u / S.step) % S.n; if (f < 0) f += S.n;
    const i0 = Math.floor(f), t = f - i0, i = ((i0 % S.n) + S.n) % S.n, a = S.pts[i], b = S.pts[(i + 1) % S.n], na = S.nrm[i], nb = S.nrm[(i + 1) % S.n];
    const nx = na[0] + (nb[0] - na[0]) * t, ny = na[1] + (nb[1] - na[1]) * t, l = Math.hypot(nx, ny) || 1;
    return [a[0] + (b[0] - a[0]) * t + nx / l * v, a[1] + (b[1] - a[1]) * t + ny / l * v];
  }
  // shapes in strip coordinates (u along the rim, v across it, + outward) mapped onto the rim
  function mapShapes(S, loops) { return T.unionPolys(loops.map(L => { const D = densifyLoop(L, 0.4).map(q => mapUV(S, q[0], q[1])); return poly(area2(D) < 0 ? D.reverse() : D); })); }
  const rectUV = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const circUV = (u, v, r, n) => { const L = []; n = n || 20; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; L.push([u + r * Math.cos(t), v + r * Math.sin(t)]); } return L; };
  const reps = (len, p) => { const n = Math.max(3, Math.round(len / p)); return { n, p: len / n }; };
  function rimParts(o) { // { body: footprint raised to the rim top, deco: raised further on top of the rim, notch: cut from the edge }
    if (!o.rimOn) return { body: [], deco: [], notch: [] };
    return cached(`r|${o.shape}|${o.size}|${o.detail}|${o.rim}|${o.rimW}`, () => rimPartsRaw(o));
  }
  function rimPartsRaw(o) {
    const w = o.rimW, band = ringBetween(o, 0, w), inset = Math.min(0.6, w * 0.08), dband = ringBetween(o, inset, w - inset), hw = w / 2 - inset;
    const out = { body: band, deco: [], notch: [] };
    if (o.rim === 'plain') return out;
    if (o.rim === 'double') { const t = Math.max(1.0, hw * 0.42); out.deco = T.unionPolys(ringBetween(o, inset, inset + t).concat(ringBetween(o, w - inset - t, w - inset))); return out; }
    const S = stripPath(o), loops = [];
    if (o.rim === 'rope') {
      const R = reps(S.len, Math.max(2.4, hw * 1.05)), tw = R.p * 0.78, s = hw * 0.85;
      for (let k = 0; k < R.n; k++) { const u = k * R.p, L = []; for (let i = 0; i <= 24; i++) { const t = -1 + 2 * i / 24; L.push([u + s * t + tw / 2 * Math.sqrt(Math.max(0, 1 - t * t)), hw * 1.08 * t]); } for (let i = 24; i >= 0; i--) { const t = -1 + 2 * i / 24; L.push([u + s * t - tw / 2 * Math.sqrt(Math.max(0, 1 - t * t)), hw * 1.08 * t]); } loops.push(L); }
    } else if (o.rim === 'beaded') {
      const rb = Math.min(hw * 0.86, 2.8), R = reps(S.len, 2 * rb + Math.max(0.8, rb * 0.35));
      for (let k = 0; k < R.n; k++) loops.push(circUV(k * R.p, 0, rb, 28));
    } else if (o.rim === 'scallop') {
      const rs = hw * 0.95, R = reps(S.len, 2 * rs * 1.08), t = Math.max(0.9, hw * 0.3);
      for (let k = 0; k < R.n; k++) { const ring = circUV(k * R.p, -hw, rs, 36); loops.push(ring); }
      out.deco = T.unionPolys(ringBetween(o, inset, inset + t));
      const arches = T.diffPolys(mapShapes(S, loops), T.offset(mapShapes(S, Array.from({ length: R.n }, (_, k) => circUV(k * R.p, -hw, rs - t, 36))), 0));
      out.deco = open(T.interPolys(T.unionPolys(out.deco.concat(arches)), dband), 0.25, 0.4); return out;
    } else if (o.rim === 'greek') {
      const c = 2 * hw / 5, R = reps(S.len, 6 * c), k0 = R.p / (6 * c);
      // a key hook on a running baseline, 5 cells tall, 6 cells per repeat, strokes 1 cell wide
      const segs = [[0, 0, 6, 1], [0, 0, 1, 5], [0, 4, 5, 5], [4, 2, 5, 5], [2, 2, 5, 3]];
      for (let k = 0; k < R.n; k++) for (const [a, b, cc, d] of segs) loops.push(rectUV(k * R.p + a * c * k0 - (a === 0 && cc === 6 ? 0.05 : 0), -hw + b * c, k * R.p + cc * c * k0 + (cc === 6 ? 0.05 : 0), -hw + d * c));
    } else if (o.rim === 'hex') {
      const Rh = hw, R = reps(S.len, Math.sqrt(3) * Rh), sx = R.p / (Math.sqrt(3) * Rh), t = Math.max(0.8, Rh * 0.24);
      const hx = (u, r) => { const L = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 2 + i * Math.PI / 3; L.push([u + r * Math.cos(a) * sx, r * Math.sin(a)]); } return L; };
      const rings = [], holes = [];
      for (let k = 0; k < R.n; k++) { rings.push(hx(k * R.p, Rh * 1.02)); holes.push(hx(k * R.p, Rh - t)); }
      out.deco = open(T.interPolys(T.diffPolys(mapShapes(S, rings), mapShapes(S, holes)), dband), 0.2, 0.3); return out;
    } else if (o.rim === 'laurel') {
      const R = reps(S.len, Math.max(3.2, hw * 1.5)), stem = Math.max(0.8, hw * 0.16), ang = 0.6, Lf = (hw - 0.2) / (Math.sin(ang) + 0.2), Wf = Lf * 0.36;
      loops.push(...[[0, -stem / 2, S.len, stem / 2]].map(([a, b, c2, d]) => rectUV(a - 1, b, c2 + 1, d)));
      const leaf = (u, side) => { const L = [], n = 14; for (let i = 0; i <= n; i++) { const s = i / n, x = s * Lf, y = Wf / 2 * Math.sin(Math.PI * s); L.push([x, y]); } for (let i = n - 1; i > 0; i--) { const s = i / n, x = s * Lf, y = -Wf / 2 * Math.sin(Math.PI * s); L.push([x, y]); }
        const a = side * ang; return L.map(([x, y]) => [u + x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]); };
      for (let k = 0; k < R.n; k++) { loops.push(leaf(k * R.p, 1)); loops.push(leaf(k * R.p + R.p / 2, -1)); }
    } else if (o.rim === 'notched') {
      const R = reps(S.len, Math.max(3.2, hw * 1.3));
      for (let k = 0; k < R.n; k++) loops.push(rectUV(k * R.p - R.p * 0.27, -hw * 1.2, k * R.p + R.p * 0.27, hw * 1.2));
    } else if (o.rim === 'gear') {
      const R = reps(S.len, Math.max(4, w * 0.9)), dep = Math.min(2.2, w * 0.3), nl = [];
      for (let k = 0; k < R.n; k++) nl.push(rectUV(k * R.p - R.p * 0.22, w / 2 - dep, k * R.p + R.p * 0.22, w / 2 + 3));
      out.notch = T.offset(T.offset(mapShapes(S, nl), -0.4), 0.4);
      const body = T.diffPolys(band, out.notch);
      out.body = body;
      // a line along the inner edge of the teeth
      out.deco = open(T.diffPolys(ringBetween(o, dep + 0.8, Math.min(w - inset, dep + 0.8 + Math.max(1, hw * 0.4))), out.notch), 0.2, 0.3);
      return out;
    } else if (o.rim === 'waves' || o.rim === 'zigzag') {
      const t = Math.max(1.0, hw * 0.36), A = hw - t / 2 - 0.05, R = reps(S.len, Math.max(6, hw * 4.2)), step = 0.3, top = [], bot = [];
      for (let u = -1; u <= S.len + 1; u += step) { const ph = u / R.p * Math.PI * 2, f = o.rim === 'waves' ? Math.sin(ph) : (2 / Math.PI) * Math.asin(Math.sin(ph)); top.push([u, A * f + t / 2]); bot.push([u, A * f - t / 2]); }
      loops.push(bot.concat(top.reverse()));
    } else if (o.rim === 'stars') {
      const ro = hw * 0.98, R = reps(S.len, ro * 2.6);
      for (let k = 0; k < R.n; k++) { const L = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ro * 0.45 : ro; L.push([k * R.p + r * Math.cos(a), r * Math.sin(a)]); } loops.push(L); }
    }
    out.deco = open(T.interPolys(mapShapes(S, loops), dband), 0.22, 0.35);
    return out;
  }

  // ---------------------------------------------------------------- text
  const LC = new Map();
  function line10(text, font) { const key = font + '|' + text; if (LC.has(key)) return LC.get(key); const dropped = new Set(), r = ST().textLine(text, font, 10, font === 'script' ? 0 : 0.04, dropped); const v = { polys: r.polys, b: r.polys.length ? bboxOf(r.polys) : null, w: r.w, dropped: [...dropped] }; if (LC.size > 3000) LC.clear(); LC.set(key, v); return v; }
  // the circle the rim text runs inside: the largest circle inside the rim's inner edge, less a gap
  function arcGeom(o) {
    const edge = o.rimOn ? o.rimW : 0, Rin = inscribed(inner(o, edge + LIMITS.gap));
    const band = Math.min(o.arcH, Rin * 0.3);
    return { Rin, band };
  }
  function arcs(o) {
    const g = arcGeom(o), both = !!(o.topText.trim() && o.bottomText.trim()), maxA = both ? 2.55 : 4.3, dropped = new Set(), out = [];
    for (const [where, txt] of [['top', o.topText], ['bottom', o.bottomText]]) {
      if (!txt.trim()) continue;
      const r = ST().arcText(txt.trim(), o.arcFont, g.band, g.Rin, where, maxA, o.arcFont === 'script' ? 0 : 0.08, dropped);
      if (r.polys.length) out.push({ where, text: txt.trim(), polys: r.polys, cap: +r.cap.toFixed(2), ext: r.h });
    }
    // separators at 3 and 9 o'clock between the two arcs
    const seps = [];
    if (both && o.sep !== 'none' && out.length === 2) {
      const rm = g.Rin - g.band / 2, s = g.band * 0.42;
      for (const sx of [-1, 1]) {
        const cx = sx * rm; let L;
        if (o.sep === 'dot') L = T.circle(cx, 0, s * 0.55, 24);
        else if (o.sep === 'star') { L = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.42 : s; L.push([cx + r * Math.cos(a), r * Math.sin(a)]); } }
        else { L = []; for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2, x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); L.push([cx + x * s / 17, y * s / 17 + s * 0.1]); } }
        seps.push(poly(L));
      }
    }
    return { pieces: out, seps, geom: g, dropped: [...dropped], both };
  }
  function centerRegion(o, A) {
    const edge = o.rimOn ? o.rimW : 0;
    if (A.pieces.length) { const Rc = A.geom.Rin - A.geom.band - LIMITS.gap; return Rc > 4 ? [poly(T.circle(0, 0, Rc, o.detail === 'hd' ? 160 : 80))] : []; }
    return inner(o, edge + Math.max(LIMITS.gap + 0.4, o.size * 0.045));
  }
  function logoPieces(o) {
    if (!o.logo) return null;
    const all = o.logo.concat(o.logo2 || []), b = bboxOf(all), k = o.logoSize / Math.max(1e-6, b.w, b.h), f = P => movePolys(P, -b.cx * k, -b.cy * k, k);
    return { pieces: [{ polys: f(o.logo), role: 'logo', name: 'Logo' }].concat(o.logo2 ? [{ polys: f(o.logo2), role: 'logo2', name: 'Logo tone 2' }] : []), w: b.w * k, h: b.h * k };
  }
  function composeCenter(rows, o, withLogo) {
    const placed = []; let y = 0, prev = null;
    for (const r of rows) {
      const g = line10(r.text, r.font); if (!g.b) continue;
      const s = r.cap / 10, b = { x0: g.b.x0 * s, x1: g.b.x1 * s, y0: g.b.y0 * s, y1: g.b.y1 * s };
      if (prev) y -= 0.28 * Math.max(prev.cap, r.cap);
      const dy = y - b.y1;
      placed.push({ polys: movePolys(g.polys, -(b.x0 + b.x1) / 2, dy, s), role: 'center', name: 'Center text', cap: r.cap, text: r.text, font: r.font });
      y = b.y0 + dy; prev = r;
    }
    const items = [], L = withLogo ? logoPieces(o) : null, tp = placed.flatMap(p => p.polys);
    if (L) {
      const tb = tp.length ? bboxOf(tp) : null, gap = tp.length ? Math.max(2, Math.max(...rows.map(r => r.cap)) * 0.3) : 0;
      const cy = !tb ? 0 : o.logoPos === 'below' ? tb.y0 - gap - L.h / 2 : tb.y1 + gap + L.h / 2, cx = tb ? tb.cx : 0;
      for (const p of L.pieces) items.push({ ...p, polys: movePolys(p.polys, cx, cy), cap: Infinity });
    }
    items.push(...placed);
    const all = items.flatMap(i => i.polys); if (!all.length) return { items: [], w: 0, h: 0 };
    const b = bboxOf(all);
    return { items: items.map(i => ({ ...i, polys: movePolys(i.polys, -b.cx, -b.cy) })), w: b.w, h: b.h };
  }
  function fitScale(block, S, sMax) {
    if (!block.items.length || !S.length) return null;
    const best = biggest(S), sb = bboxOf([best]), cx = sb.cx, cy = sb.cy, reg = [best];
    const up = Math.min(sMax, sb.w / Math.max(1e-6, block.w), sb.h / Math.max(1e-6, block.h)); if (up <= 0) return null;
    const pts = []; for (const it of block.items) for (const P of it.polys) for (const q of P.outer) pts.push(q);
    const quick = s => pts.every(q => inPolys([cx + q[0] * s, cy + q[1] * s], reg));
    const exact = s => { const g = block.items.flatMap(i => movePolys(i.polys, cx, cy, s)); return areaOf(T.diffPolys(g, reg)) < 1e-5; };
    if (quick(up) && exact(up)) return { s: up, cx, cy };
    let lo = 0, hi = up;
    for (let k = 0; k < 22 && hi - lo > up * 2e-4; k++) { const m = (lo + hi) / 2; if (quick(m)) lo = m; else hi = m; }
    lo *= 0.995;
    for (let k = 0; k < 40 && lo > 1e-3; k++, lo *= 0.985) if (exact(lo)) return { s: lo, cx, cy };
    return null;
  }
  function wrap2(text, font) {
    const words = text.split(/\s+/).filter(Boolean); if (words.length < 2) return null; let best = null;
    for (let k = 1; k < words.length; k++) { const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '), m = Math.max((line10(a, font).b || { w: 0 }).w, (line10(b, font).b || { w: 0 }).w); if (!best || m < best.m) best = { m, parts: [a, b] }; }
    return best.parts;
  }
  // center text and logo, fitted inside the center area (shrink to fit; one line may wrap onto two)
  function layoutCenter(o, A) {
    const S0 = centerRegion(o, A), dropped = new Set();
    const showText = o.center === 'text' || o.center === 'both', withLogo = (o.center === 'logo' || o.center === 'both') && !!o.logo;
    const base = showText ? [{ text: o.line1.trim(), font: o.centerFont, cap: o.cap1 }, { text: o.line2.trim(), font: o.centerFont2, cap: o.cap2 }].filter(r => r.text) : [];
    base.forEach(r => line10(r.text, r.font).dropped.forEach(c => dropped.add(c)));
    const k = o.centerSize / 100, S = k < 0.999 && S0.length ? T.offset(S0, -(1 - k) * Math.min(bboxOf(S0).w, bboxOf(S0).h) / 2) : S0;
    const empty = !base.length && !withLogo;
    if (empty || !S.length) return { pieces: [], minCap: null, scale: 0, small: !empty, empty, rows: [], dropped: [...dropped], region: S };
    const cands = [{ rows: base, wrapped: null }];
    if (base.length === 1) { const w = wrap2(base[0].text, base[0].font); if (w) cands.push({ rows: w.map(t => ({ ...base[0], text: t })), wrapped: 0 }); }
    let best = null;
    for (const c of cands) {
      const block = composeCenter(c.rows, o, withLogo); if (!block.items.length) continue;
      const f = fitScale(block, S, 1); if (!f) continue;
      const caps = block.items.filter(i => Number.isFinite(i.cap)).map(i => i.cap * f.s), minCap = caps.length ? Math.min(...caps) : Infinity;
      const score = Number.isFinite(minCap) ? minCap : f.s * 100;
      if (!best || score > best.score + 0.05) best = { c, block, f, minCap, score };
      if (c === cands[0] && (f.s >= 0.999 || (minCap >= LIMITS.minCenterCap * 1.6 && f.s >= 0.6))) break;
    }
    if (!best) return { pieces: [], minCap: null, scale: 0, small: true, empty: false, rows: [], dropped: [...dropped], region: S };
    const { f, block } = best;
    const pieces = block.items.map(i => ({ polys: movePolys(i.polys, f.cx, f.cy, f.s), role: i.role, name: i.name, cap: Number.isFinite(i.cap) ? +(i.cap * f.s).toFixed(2) : null, text: i.text, font: i.font }));
    const minCap = Number.isFinite(best.minCap) ? +best.minCap.toFixed(2) : null;
    return { pieces, scale: +f.s.toFixed(4), minCap, wrapped: best.c.wrapped, small: minCap != null && minCap < LIMITS.minCenterCap, empty: false, rows: pieces.filter(p => p.text).map(p => ({ text: p.text, cap: p.cap })), dropped: [...dropped], region: S };
  }
  function layoutText(o) {
    const A = arcs(o), Cn = layoutCenter(o, A);
    const arcMin = A.pieces.length ? Math.min(...A.pieces.map(p => p.cap)) : null;
    return { arcs: A, center: Cn, arcMin, arcSmall: arcMin != null && arcMin < LIMITS.minArcCap, dropped: [...new Set(A.dropped.concat(Cn.dropped))] };
  }
  // independent check for the audit: rim text inside its band, center text and logo inside the center area, nothing
  // over the rim (or its decoration), arcs and separators apart from each other, everything on the coaster
  function fitCheck(o, tl) {
    tl = tl || layoutText(o);
    const errs = [], edge = o.rimOn ? o.rimW : 0, field = T.offset(inner(o, edge), 0.02), mat = outline(o), g = tl.arcs.geom;
    const pts = (polys, f) => { let bad = 0; for (const P of polys) for (const L of [P.outer, ...P.holes]) for (const q of L) if (!f(q)) bad++; return bad; };
    const arcPolys = tl.arcs.pieces.flatMap(p => p.polys).concat(tl.arcs.seps);
    for (const p of tl.arcs.pieces) {
      const b = pts(p.polys, q => { const r = Math.hypot(q[0], q[1]); return r <= g.Rin + 0.03 && r >= g.Rin - g.band - 0.03; }); if (b) errs.push(`${p.where} text: ${b} points outside its band`);
      // with text on both arcs, each keeps to its own half (a single arc may run further round)
      if (tl.arcs.pieces.length === 2 && p.where === 'top' && p.polys.some(P => P.outer.some(q => q[1] < -0.01))) errs.push('top text runs below the middle');
      if (tl.arcs.pieces.length === 2 && p.where === 'bottom' && p.polys.some(P => P.outer.some(q => q[1] > 0.01))) errs.push('bottom text runs above the middle');
    }
    if (tl.arcs.pieces.length === 2) { const a = T.offset(tl.arcs.pieces[0].polys, 0.3); if (areaOf(T.interPolys(a, tl.arcs.pieces[1].polys)) > 1e-4) errs.push('top and bottom text touch'); }
    if (tl.arcs.seps.length) { const s = T.offset(tl.arcs.seps, 0.3); if (areaOf(T.interPolys(s, tl.arcs.pieces.flatMap(p => p.polys))) > 1e-4) errs.push('a separator touches the text'); }
    const cpolys = tl.center.pieces.flatMap(p => p.polys);
    if (cpolys.length) {
      const reg = T.offset(tl.center.region, 0.02);
      const b = pts(cpolys, q => inPolys(q, reg)); if (b) errs.push(`center: ${b} points outside the center area`);
      if (areaOf(T.diffPolys(cpolys, tl.center.region)) > 1e-3) errs.push('center: area outside');
      // rim text lies at radius >= Rin - band; the center has to stay at least 0.5 mm inside that
      if (arcPolys.length) { const b2 = pts(cpolys, q => Math.hypot(q[0], q[1]) <= g.Rin - g.band - 0.5); if (b2) errs.push(`center: ${b2} points too close to the rim text`); }
    }
    const all = arcPolys.concat(cpolys);
    if (all.length) {
      const b = pts(all, q => inPolys(q, field) && inPolys(q, mat)); if (b) errs.push(`${b} text points over the rim or off the coaster`);
      // the rim and its decoration live in the band outside inner(rimW) (rimCheck); text clear of that band is clear of them
      if (areaOf(T.diffPolys(all, inner(o, edge))) > 1e-4) errs.push('text overlaps the rim');
    }
    errs.push(...rimCheck(o));
    return { ok: errs.length === 0, errs };
  }

  // the rim body inside its band, the decoration on the rim (never past its edges), all of it on the coaster
  function rimCheck(o) {
    if (!o.rimOn) return [];
    return cached(`rc|${o.shape}|${o.size}|${o.detail}|${o.rim}|${o.rimW}`, () => {
      const errs = [], rp = rimParts(o), band = T.offset(ringBetween(o, 0, o.rimW), 0.02);
      if (!rp.body.length) errs.push('no rim');
      if (areaOf(T.diffPolys(rp.body, band)) > 1e-3) errs.push('rim leaves its band');
      if (rp.deco.length && areaOf(T.diffPolys(rp.deco, T.offset(rp.body, 0.02))) > 1e-3) errs.push('rim decoration leaves the rim');
      if (o.rim !== 'plain' && o.rim !== 'none' && !rp.deco.length) errs.push('rim decoration is missing');
      return errs;
    });
  }
  // ---------------------------------------------------------------- surface, drainage, bottom
  function texturePolys(o, keep) {
    if (o.surface === 'flat') return [];
    const edge = o.rimOn ? o.rimW : 0, F = inner(o, edge + 1.0), b = bboxOf(F), R = Math.max(b.w, b.h) / 2 + 4, out = [], p = 3.2, w = 0.9;
    const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
    if (o.surface === 'dots') { const py = p * Math.sqrt(3) / 2; for (let j = -Math.ceil(R / py); j <= Math.ceil(R / py); j++) for (let i = -Math.ceil(R / p) - 1; i <= Math.ceil(R / p); i++) out.push(poly(T.circle(i * p + (j % 2 ? p / 2 : 0), j * py, 0.85, 14))); }
    else if (o.surface === 'ribs') { for (let j = -Math.ceil(R / p); j <= Math.ceil(R / p); j++) out.push(rect(-R, j * p - w / 2, R, j * p + w / 2)); }
    else if (o.surface === 'grid') { const q = p * 1.3; for (let j = -Math.ceil(R / q); j <= Math.ceil(R / q); j++) { out.push(rect(-R, j * q - w / 2, R, j * q + w / 2)); out.push(rect(j * q - w / 2, -R, j * q + w / 2, R)); } }
    else if (o.surface === 'rings') { for (let r = p; r < R; r += p) out.push({ outer: T.circle(0, 0, r + w / 2, Math.max(32, Math.round(r * 3))), holes: [T.circle(0, 0, r - w / 2, Math.max(32, Math.round(r * 3))).reverse()] }); }
    else if (o.surface === 'waves') { for (let j = -Math.ceil(R / p) - 1; j <= Math.ceil(R / p) + 1; j++) { const top = [], bot = []; for (let x = -R; x <= R; x += 0.5) { const y = j * p + 0.9 * Math.sin(x / 7 * Math.PI); top.push([x, y + w / 2]); bot.push([x, y - w / 2]); } out.push(poly(bot.concat(top.reverse()))); } }
    else if (o.surface === 'hex') { const r = 2.6, cw = r * 1.5, hR = r * Math.sqrt(3), h6 = (cx, cy, rr) => { const L = []; for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; L.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]); } return L; };
      for (let i = -Math.ceil(R / cw) - 1; i <= Math.ceil(R / cw) + 1; i++) for (let j = -Math.ceil(R / hR) - 1; j <= Math.ceil(R / hR) + 1; j++) { const cx = i * cw, cy = j * hR + (i % 2 ? hR / 2 : 0); out.push({ outer: h6(cx, cy, r + 0.35), holes: [h6(cx, cy, r - 0.45).reverse()] }); } }
    else if (o.surface === 'sunburst') { const N = 48; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, da = Math.PI / N * 0.45; out.push(poly([[0, 0], [R * Math.cos(a - da), R * Math.sin(a - da)], [R * Math.cos(a + da), R * Math.sin(a + da)]])); } }
    let P = T.interPolys(T.unionPolys(out), F);
    if (keep.length) P = T.diffPolys(P, keep);
    return open(P, 0.3, 0.6);
  }
  function drainPolys(o) {
    if (o.drain === 'none' || o.drainD < 0.3) return [];
    const edge = o.rimOn ? o.rimW : 0, gw = 1.6, ring = ringBetween(o, edge + 1.4, edge + 1.4 + gw);
    if (o.drain === 'ring') return ring;
    const R = inscribed(inner(o, edge + 1.4)), out = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, c = Math.cos(a), s = Math.sin(a), r0 = R * 0.62, r1 = R + gw, h = 0.8; out.push(poly([[c * r0 - s * h, s * r0 + c * h], [c * r0 + s * h, s * r0 - c * h], [c * r1 + s * h, s * r1 - c * h], [c * r1 - s * h, s * r1 + c * h]])); }
    return T.unionPolys(ring.concat(T.interPolys(T.unionPolys(out), inner(o, edge + 1.4))));
  }
  function padSpots(o) {
    const R = inscribed(outline(o)), r = o.padD / 2, d = R - r - Math.max(3, o.size * 0.05), n = 4, out = [];
    for (let i = 0; i < n; i++) { const a = Math.PI / 4 + i * Math.PI / 2; out.push([d * Math.cos(a), d * Math.sin(a)]); }
    return out;
  }
  function bottomCut(o, out2) {
    if (o.bottom === 'cork') return T.offset(out2, -Math.max(3, o.size * 0.04));
    if (o.bottom === 'pads' || o.bottom === 'tpu') return padSpots(o).map(([x, y]) => poly(T.circle(x, y, o.padD / 2 + 0.2, 40)));
    return [];
  }

  // ---------------------------------------------------------------- build
  function colorList(o, tl) {
    const cols = [], add = c => { if (c && !cols.includes(c)) cols.push(c); };
    add(o.colors.base);
    if (o.rimOn) { add(o.colors.rim); if (o.rim !== 'plain') add(o.colors.trim); }
    const engr = o.style === 'engraved';
    if (!engr && tl && tl.arcs.pieces.length) add(o.colors.text);
    if (!engr && tl && tl.center.pieces.some(p => p.role === 'center')) add(o.colors.center);
    if (!engr && tl && tl.center.pieces.some(p => p.role === 'logo')) add(o.colors.logo);
    if (!engr && tl && tl.center.pieces.some(p => p.role === 'logo2')) add(o.colors.logo2);
    if (o.holder) add(o.colors.holder);
    return cols;
  }
  function extrude(polys, z0, z1) { return polys.length && z1 > z0 ? T.extrude(polys, 2, z0, z1) : new Float64Array(0); }
  const solid2 = (polys, z0, z1) => {
    let p = extrude(polys, z0, z1);
    if (p.length && !C.checkClosed(p).closed) { const q = extrude(T.offset(T.offset(polys, -0.01), 0.01), z0, z1); if (C.checkClosed(q).closed) p = q; }
    return p;
  };
  function moveP(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  function man(M, p) { const { V, F } = C.weld(p), mm = new M.Mesh({ numProp: 3, vertProperties: Float32Array.from(V), triVerts: Uint32Array.from(F) }); mm.merge(); return new M.Manifold(mm); }
  function soup(m) { const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float64Array(F.length * 3); for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; } return p; }
  // fuse same-color shells (base + texture + rim, or raised text on the base) into one solid so the export
  // is not stacked bodies sharing the base-top plane (non-manifold after a weld); falls back to the plain shells
  function unionMeshes(M, meshes) {
    const live = meshes.filter(p => p && p.length >= 36);
    if (!live.length) return new Float64Array(0);
    if (!M || live.length === 1) return live.length === 1 ? live[0] : concat(live);
    let acc = null;
    try {
      acc = man(M, live[0]);
      for (let i = 1; i < live.length; i++) { const nxt = man(M, live[i]), u = acc.add(nxt); acc.delete(); nxt.delete(); acc = u; if (acc.status() !== 'NoError') { acc.delete(); return concat(live); } }
      const p = soup(acc); acc.delete(); acc = null;
      return p.length >= 36 ? p : concat(live);
    } catch (e) { try { if (acc) acc.delete(); } catch (e2) {} return concat(live); }
  }
  function concat(arr) { const n = arr.reduce((s, p) => s + (p ? p.length : 0), 0), q = new Float64Array(n); let k = 0; for (const p of arr) if (p && p.length) { q.set(p, k); k += p.length; } return q; }
  function holderGeom(o, stackH, M) {
    const out2 = outline(o), inn = T.offset(out2, 1.0), outr = T.offset(inn, 2.4), floorT = 2, H = Math.max(14, floorT + stackH + 2), b = bboxOf(outr);
    const sw = Math.min(46, o.size * 0.46), slotZ = floorT + Math.min(5, H * 0.25);
    const slot = [poly([[-sw / 2, b.y0 - 2], [sw / 2, b.y0 - 2], [sw / 2, 0], [-sw / 2, 0]])];
    const wall = T.diffPolys(outr, inn);
    // floor, lower wall and the slotted upper wall as closed blocks fused into one solid (stepped layers left
    // T-junctions where the slot corners meet the full ring)
    const blocks = [solid2(outr, 0, floorT + 0.01), solid2(wall, floorT, slotZ + 0.01), solid2(T.diffPolys(wall, slot), slotZ, H)];
    let p = M ? unionMeshes(M, blocks) : null;
    if (!p || !C.checkClosed(p).closed) { const q = T.steppedExtrude([{ z0: 0, z1: floorT, polys: outr }, { z0: floorT, z1: slotZ, polys: wall }, { z0: slotZ, z1: H, polys: T.diffPolys(wall, slot) }]); p = C.checkClosed(q).closed || !p ? q : p; }
    return { p, H, floorT, w: b.w, d: b.h };
  }
  function build(raw, M) {
    const o = options(raw), warnings = [], tl = layoutText(o), rp = rimParts(o);
    const out2 = rp.notch.length ? T.diffPolys(outline(o), rp.notch) : outline(o);
    const arcP = tl.arcs.pieces, cps = tl.center.pieces;
    const allText = arcP.flatMap(p => p.polys).concat(tl.arcs.seps, cps.flatMap(p => p.polys));
    const keep = allText.length ? T.offset(T.unionPolys(allText), 1.2) : [];
    const drain = drainPolys(o), drainCut = drain.length && keep.length ? T.diffPolys(drain, keep) : drain;
    const tex = texturePolys(o, keep.concat(drain.length ? T.offset(drain, 0.8) : []));
    const bot = bottomCut(o, out2);
    const raised = o.style === 'raised', textCut = !raised && o.cutD >= 0.3 ? T.unionPolys(allText) : [];
    if (!raised && o.cutD < 0.3) warnings.push('The base is too thin to engrave the design with the bottom pocket. The design was raised instead; make the base thicker to engrave it.');
    // base: stepped layers (bottom pocket, then solid, then the engraving and drip grooves cut into the top)
    const zs = new Set([0, o.baseT]); if (bot.length) zs.add(o.botD); if (textCut.length) zs.add(o.baseT - o.cutD); if (drainCut.length) zs.add(o.baseT - o.drainD);
    const Z = [...zs].sort((a, b) => a - b), layers = [];
    for (let i = 0; i + 1 < Z.length; i++) {
      const z0 = Z[i], z1 = Z[i + 1], zm = (z0 + z1) / 2, cuts = [];
      if (bot.length && zm < o.botD) cuts.push(...bot);
      if (textCut.length && zm > o.baseT - o.cutD) cuts.push(...textCut);
      if (drainCut.length && zm > o.baseT - o.drainD) cuts.push(...drainCut);
      layers.push({ z0, z1, polys: cuts.length ? T.diffPolys(out2, T.unionPolys(cuts)) : out2 });
    }
    const pieces = [], add = (role, name, color, p) => { if (p && p.length >= 36) pieces.push({ role, name, color, p }); };
    add('base', 'Base', o.colors.base, T.steppedExtrude(layers));
    if (tex.length) add('base', 'Texture', o.colors.base, solid2(tex, o.baseT, o.baseT + o.texH));
    if (rp.body.length) add('rim', 'Rim', o.colors.rim, solid2(rp.body, o.baseT, o.rimTop));
    if (rp.deco.length) add('trim', 'Rim pattern', o.colors.trim, solid2(rp.deco, o.rimTop, o.rimTop + o.decoH));
    const tz0 = raised || !textCut.length ? o.baseT : o.baseT - o.cutD, tz1 = raised || !textCut.length ? o.baseT + o.textH : o.baseT;
    if (raised || o.style === 'inlay' || !textCut.length) {
      for (const p of arcP) add('text', `Rim text (${p.where})`, o.colors.text, solid2(p.polys, tz0, tz1));
      if (tl.arcs.seps.length) add('text', 'Separators', o.colors.text, solid2(tl.arcs.seps, tz0, tz1));
      for (const p of cps) add(p.role, p.name, p.role === 'center' ? o.colors.center : o.colors[p.role], solid2(p.polys, tz0, tz1));
    }
    const byColor = [];
    for (const pc of pieces) { let g = byColor.find(b => b.color === pc.color); if (!g) { g = { color: pc.color, names: [], roles: [], bits: [] }; byColor.push(g); } g.names.push(pc.name); g.roles.push(pc.role); g.bits.push(pc.p); }
    const R = o.size / 2;
    const colorParts = byColor.map(g => ({ name: partLabel(g.roles), color: g.color, roles: [...new Set(g.roles)], p: moveP(unionMeshes(M, g.bits), R, R, 0) }));
    const local = concat(colorParts.map(c => c.p)), bb = C.bbox(local), size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
    const U = usable(o), fits = size[0] <= U.w + 0.05 && size[1] <= U.d + 0.05 && size[2] <= U.z;
    const parts = [];
    for (let i = 0; i < o.qty; i++) { const name = o.qty > 1 ? `Coaster ${i + 1}` : 'Coaster'; parts.push({ kind: 'coaster', name, colorParts: colorParts.map(c => ({ ...c, name: `${name} ${c.name}` })), local, size, fits }); }
    const H = size[2];
    let holder = null;
    if (o.holder) {
      const hg = holderGeom(o, o.qty * H, M); holder = hg;
      const hp = moveP(hg.p, hg.w / 2, hg.d / 2, 0), hb = C.bbox(hp), hs = [hb.max[0] - hb.min[0], hb.max[1] - hb.min[1], hb.max[2] - hb.min[2]];
      parts.push({ kind: 'holder', name: 'Holder', colorParts: [{ name: 'Holder', color: o.colors.holder, roles: ['holder'], p: hp }], local: hp, size: hs, fits: hs[0] <= U.w + 0.05 && hs[1] <= U.d + 0.05 && hs[2] <= U.z });
    }
    if (o.bottom === 'tpu') {
      const n = o.qty * 4, cols = Math.ceil(Math.sqrt(n)), pitch = o.padD + 3, discs = [];
      for (let i = 0; i < n; i++) discs.push(solid2([poly(T.circle((i % cols) * pitch + o.padD / 2, Math.floor(i / cols) * pitch + o.padD / 2, o.padD / 2 - 0.15, 40))], 0, o.botD + 1.0));
      const fp = concat(discs), fb = C.bbox(fp);
      parts.push({ kind: 'feet', name: 'Feet', colorParts: [{ name: 'Feet (TPU)', color: '#1C1C1E', roles: ['feet'], p: fp }], local: fp, size: [fb.max[0] - fb.min[0], fb.max[1] - fb.min[1], fb.max[2] - fb.min[2]], fits: true });
    }
    for (const pt of parts) if (!pt.fits) warnings.push(`${pt.name} (${Math.round(pt.size[0])} \u00d7 ${Math.round(pt.size[1])} mm) is bigger than your bed.`);
    // preview: the coaster on its own, and the holder with the rest of the set stacked in it beside it
    const placed = pieces.map(pc => ({ p: moveP(pc.p, R, R, 0), color: pc.color, name: pc.name, role: pc.role }));
    if (holder) {
      const hx = o.size + 24 + holder.w / 2, hy = R;
      placed.push({ p: moveP(holder.p, hx, hy, 0), color: o.colors.holder, name: 'Holder', role: 'holder' });
      const stackN = Math.max(0, Math.min(o.qty - 1, 12));
      const shells = pieces.filter(pc => pc.role === 'base' || pc.role === 'rim' || pc.role === 'trim');
      for (let k = 0; k < stackN; k++) for (const pc of (k === stackN - 1 ? pieces : shells)) placed.push({ p: moveP(pc.p, hx, hy, holder.floorT + k * H + 0.05), color: pc.color, name: pc.name, role: pc.role });
    }
    if (tl.arcSmall) warnings.push(`The rim text is ${tl.arcMin} mm tall, under the ${LIMITS.minArcCap} mm that prints crisply. Shorten it or make the coaster or the rim text bigger.`);
    if (tl.center.small && !tl.center.empty) warnings.push(tl.center.pieces.length ? `The center text is ${tl.center.minCap} mm tall, under the ${LIMITS.minCenterCap} mm that prints crisply. Shorten it or make the center bigger.` : 'The center does not have room for the text or logo. Shorten the rim text or make the coaster bigger.');
    if (tl.dropped.length) warnings.push(`These characters are not in the chosen font and were left out: ${tl.dropped.join(' ')}`);
    if ((o.center === 'logo' || o.center === 'both') && !o.logo) warnings.push('Upload a logo to put it in the center.');
    if (o.bottom === 'cork' && o.botD < o.pocketD - 0.01) warnings.push(`The cork pocket was made ${o.botD} mm deep to keep 1.2 mm of base under it. Make the base thicker for a deeper pocket.`);
    let vol = 0; for (const c of colorParts) vol += Math.abs(C.signedVolume(c.p));
    const fils = colorList(o, tl);
    const stats = { size: o.size, height: +H.toFixed(2), qty: o.qty, colors: fils.length, grams: Math.round(vol / 1000 * 1.24), gramsAll: Math.round(vol / 1000 * 1.24 * o.qty + (holder ? Math.abs(C.signedVolume(holder.p)) / 1000 * 1.24 : 0)),
      tris: local.length / 9, arcMin: tl.arcMin, centerMin: tl.center.minCap, holderH: holder ? +holder.H.toFixed(1) : 0 };
    return { options: o, parts, pieces, placed, stats, warnings, text: tl, filaments: fils.map(c => ({ color: c })) };
  }
  function partLabel(roles) {
    const u = [...new Set(roles)], nm = { base: 'base', rim: 'rim', trim: 'rim pattern', text: 'rim text', center: 'center text', logo: 'logo', logo2: 'logo tone 2' };
    return u.map(r => nm[r] || r).join(' + ');
  }
  function gateInfo(raw, tlIn) {
    const o = options(raw), reasons = [];
    if (o.qty > FREE.maxQty) reasons.push(`a set of ${o.qty} coasters`);
    const fake = { arcs: { pieces: (o.topText.trim() || o.bottomText.trim()) ? [1] : [] }, center: { pieces: [].concat((o.center === 'text' || o.center === 'both') && (o.line1.trim() || o.line2.trim()) ? [{ role: 'center' }] : [], (o.center === 'logo' || o.center === 'both') && o.logo ? [{ role: 'logo' }] : [], (o.center === 'logo' || o.center === 'both') && o.logo2 ? [{ role: 'logo2' }] : []) } };
    const n = colorList(o, tlIn || fake).length;
    if (n > FREE.maxColors) reasons.push(`${n} colors (free: up to ${FREE.maxColors})`);
    if (o.logo && (o.center === 'logo' || o.center === 'both')) reasons.push('an uploaded logo');
    if (o.holder) reasons.push('the holder');
    return { pro: reasons.length > 0, reasons, colors: n, qty: o.qty };
  }

  // ---------------------------------------------------------------- plates and files
  function printList(res) { return res.parts.map(pt => ({ name: pt.name, p: pt.local, color: pt.colorParts[0].color, parts: pt.colorParts.map(c => ({ name: c.name, p: c.p, color: c.color })) })); }
  function arrangePlates(res) {
    const U = usable(res.options), src = printList(res);
    const A = PL.arrange(src.map(it => ({ name: it.name, p: it.p, color: it.color, _parts: it.parts })), U.w, U.d, { gap: 4, maxZ: U.z });
    for (const list of A.plates) for (const it of list) {
      const s = src.find(q => q.name === it.name && !q._used); if (s) s._used = true;
      const parts = (s || it)._parts || it._parts || (s && s.parts); if (!parts) continue;
      const bb = C.bbox(s ? s.p : it.p);
      it.parts = parts.map(q => { let p = moveP(q.p, -bb.min[0], -bb.min[1], -bb.min[2]); if (it.rot) p = PL.turn(p); return { name: q.name, p: PL.move(p, it.x, it.y), color: q.color }; });
    }
    return A;
  }
  function export3MF(res, eo) {
    eo = eo || {};
    const cols = res.filaments.map(f => f.color), A = arrangePlates(res), objs = [], plates = [];
    if (res.parts.some(p => p.kind === 'feet') && !cols.includes('#1C1C1E')) cols.push('#1C1C1E');
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, parts: (it.parts || [{ name: it.name, p: it.p, color: it.color }]).map(q => ({ name: q.name, p: q.p, color: q.color, extruder: cols.indexOf(q.color) + 1 })) }); }); plates.push(ids); });
    A.unfit.forEach(u => { const s = res.parts.find(p => p.name === u.name); plates.push([objs.length]); objs.push({ name: u.name, parts: (s ? s.colorParts : []).map(q => ({ name: q.name, p: q.p, color: q.color, extruder: cols.indexOf(q.color) + 1 })) }); });
    return T.threeMF(objs, { title: eo.name || 'Custom coaster', plates, bambu: eo.bambu === undefined ? res.options.bambu : eo.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const o = res.options, st = res.stats, L = ['Expressarte custom coaster', ''];
    L.push(`${SHAPES.find(s => s.id === o.shape).label} coaster, ${o.size} mm across, ${st.height} mm tall overall${o.qty > 1 ? `, a set of ${o.qty}` : ''}.`);
    L.push(`Rim: ${RIMS.find(r => r.id === o.rim).label.toLowerCase()}. Design: ${STYLES.find(s => s.id === o.style).label.toLowerCase()}. Surface: ${SURFACES.find(s => s.id === o.surface).label.toLowerCase()}.`);
    for (const p of res.text.arcs.pieces) L.push(`Rim text (${p.where}): "${p.text}", ${p.cap} mm letters.`);
    if (res.text.center.rows.length) L.push(`Center text: ${res.text.center.rows.map(r => `"${r.text}" ${r.cap} mm`).join(', ')}.`);
    L.push('', 'Filaments'); res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}`));
    L.push('', 'Print these'); for (const pt of res.parts) L.push(`  ${pt.name}  ${Math.round(pt.size[0])} \u00d7 ${Math.round(pt.size[1])} \u00d7 ${pt.size[2].toFixed(1)} mm  (${pt.colorParts.length} color${pt.colorParts.length === 1 ? '' : 's'})`);
    L.push('', 'Printing',
      '  - Print flat as exported, no supports. PLA or PETG works well; PETG handles warm mugs better.',
      '  - 0.2 mm layers, 2-3 walls, 15-20% infill. The 3MF opens with each color on its own filament.',
      '  - Inlaid designs: the color parts sit flush in pockets in the base. Raised designs sit on top of the base.');
    if (o.bottom === 'cork') L.push(`  - Cut a cork or felt disc to fit the ${o.botD} mm pocket underneath and glue it in.`);
    if (o.bottom === 'pads') L.push(`  - Press four ${o.padD} mm stick-on rubber feet into the pockets underneath.`);
    if (o.bottom === 'tpu') L.push('  - Print the feet in TPU and glue them into the pockets underneath.');
    if (o.holder) L.push(`  - The holder takes ${o.qty} coasters; the slot in the front lets you pull them out.`);
    if (res.warnings.length) { L.push('', 'Notes'); res.warnings.forEach(w => L.push('  - ' + w)); }
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, eo) {
    eo = eo || {}; const base = eo.fileBase || 'custom_coaster', slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase(), out = [];
    out.push({ name: `${base}.3mf`, data: export3MF(res, eo) });
    const seen = new Set();
    for (const pt of res.parts) { if (pt.kind === 'coaster' && seen.has('c')) continue; if (pt.kind === 'coaster') seen.add('c'); for (const c of pt.colorParts) out.push({ name: `stl/${base}_${slug(pt.kind === 'coaster' ? 'coaster ' + c.name.replace(/^Coaster( \d+)? /, '') : c.name)}.stl`, data: new Uint8Array(C.writeSTL(c.p, c.name)) }); }
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }

  const api = { SHAPES, RIMS, SURFACES, DRAINS, BOTTOMS, STYLES, CENTERS, SEPS, FONTS, PALETTE, FREE, LIMITS, DEFAULTS, PRESETS, options, presetOptions,
    outline, inner, rimParts, rimCheck, stripPath, arcGeom, arcs, centerRegion, layoutCenter, layoutText, fitCheck, texturePolys, drainPolys, padSpots, build, gateInfo, colorList,
    printList, arrangePlates, export3MF, notes, files, inscribed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPCoaster = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
