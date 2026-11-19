/* Expressarte case handle generator: a replacement top handle for hard equipment cases that pins into the lid's
   handle mounts (a two-prong fork at each end, the case's center knuckle sits in the slot and the original 6 mm
   stainless pin runs through prongs and knuckles).

   The anchor interface is measured from Clark's own fit-tested handle (the "small" factory handle: the 1510 top
   handle, also used by the Pelican Air 1535 and the Apache 5800). Every listed case uses that same factory handle,
   so the same mounting interface.

   Units are mm. Solids are built and combined with Manifold (WebAssembly), so every exported part is closed and
   manifold. build(raw, M) takes the initialized Manifold module.

   Print frame: x along the handle (0 .. L), y across it (0 .. W), z up. The handle prints upright, grip down on the
   bed and the forks up, exactly like the original: the slots open upward, the pin holes and the tie-down holes run
   level and bridge cleanly, so nothing needs supports.
   Use frame (preview only): the lid's handle pocket floor is z = 0, the pin axis runs along x at y = 0, z = PIN_H. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const stampApi = () => G.GPStamp || (typeof require === 'function' ? require('./stamp.js') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (v === '' || v === null || v === undefined || !isFinite(+v)) ? d : +v;
  const D2R = Math.PI / 180;

  // ---------------------------------------------------------------- mounting interfaces
  // fork: [outer prong, slot, inner prong] at the left end and [inner prong, slot, outer prong] at the right, mm.
  // span: clear length between the two legs. holeD: pin hole. pinTop: pin axis below the prong tops. slotDepth: slot
  // depth from the prong tops. legW: width of the legs at the forks. W: width of the handle body below the forks.
  const IFACES = {
    small: {
      label: 'Small factory handle (6 mm pins)', forkL: [5.05, 5.9, 5.05], forkR: [5.55, 5.9, 4.55], span: 108.5,
      holeD: 6.22, pinTop: 8.7, pinOffY: 0.45, slotDepth: 26, legW: 18, W: 23, gripD: 25, clear: 39.3, gripW: 23, holeOffX: 0.08, holeZ: 0.42,
      source: 'Measured from Clark\'s fit-tested handle (MakerWorld 3115333)'
    }
  };
  // Every case here takes the same factory handle as the 1510 top handle (same part number), so the same interface.
  const CASES = [
    { id: 'p1510', name: 'Pelican 1510', where: 'top handle', iface: 'small', group: 'tested' },
    { id: 'p1535air', name: 'Pelican Air 1535', where: 'top handle', iface: 'small', group: 'tested' },
    { id: 'a5800', name: 'Apache 5800', where: 'top handle', iface: 'small', group: 'tested' },
    { id: 'p1560', name: 'Pelican 1560', where: 'side handle', iface: 'small', group: 'same' },
    { id: 'p1440', name: 'Pelican 1440', where: 'side handles', iface: 'small', group: 'same' },
    { id: 'p1460', name: 'Pelican 1460', where: 'side handles', iface: 'small', group: 'same' },
    { id: 'p1610', name: 'Pelican 1610', where: 'side handles', iface: 'small', group: 'same' },
    { id: 'p1620', name: 'Pelican 1620', where: 'side handles', iface: 'small', group: 'same' },
    { id: 'p1650', name: 'Pelican 1650', where: 'side handles', iface: 'small', group: 'same' },
    { id: 'p1700', name: 'Pelican 1700', where: 'side handle', iface: 'small', group: 'same' },
    { id: 'p1400', name: 'Pelican 1400', where: 'front handle', iface: 'small', group: 'same' },
    { id: 'p1495', name: 'Pelican 1495', where: 'front handle', iface: 'small', group: 'same' },
    { id: 'p1557air', name: 'Pelican Air 1557', where: 'side handle', iface: 'small', group: 'same' },
    { id: 'p1607air', name: 'Pelican Air 1607', where: 'side handles', iface: 'small', group: 'same' },
    { id: 'p1615air', name: 'Pelican Air 1615', where: 'side handles', iface: 'small', group: 'same' },
    { id: 'p1637air', name: 'Pelican Air 1637', where: 'side handles', iface: 'small', group: 'same' },
    { id: 'custom', name: 'Custom (measure your case)', where: '', iface: 'custom', group: 'custom' }
  ];
  const byId = Object.fromEntries(CASES.map(c => [c.id, c]));
  // Grip profiles (the cross-section of the bar between the forks)
  const PROFILES = {
    original: { label: 'Original', note: 'Rounded finger side, like the fit-tested handle' },
    oval: { label: 'Oval', note: 'Round on both sides, soft in the hand' },
    flat: { label: 'Flat', note: 'Square with small rounds, slim and flat-sided for text' },
    dshape: { label: 'D-shape', note: 'Flat palm side, full round finger side' },
    octagon: { label: 'Octagon', note: 'Faceted, with chamfered edges' }
  };
  const GRIPS = PROFILES; // older name
  const GROOVES = { none: { label: 'None', depth: 0, r: 0 }, light: { label: 'Light', depth: 1.4, r: 9 }, deep: { label: 'Deep', depth: 3.4, r: 11 } };
  const HOLE_SHAPES = { round: 'Round', oval: 'Oval', slot: 'Slot', hex: 'Hex' };
  const PATTERNS = { none: 'None', knurl: 'Knurl', diamond: 'Diamond', hex: 'Hex', stripes: 'Stripes', waves: 'Waves' };
  const PAT_STYLES = { deboss: 'Debossed', emboss: 'Embossed' };
  // Presets set only the grip; the height, length and the mount never change.
  const PRESETS = {
    original: { label: 'Original', note: 'The fit-tested handle: rounded grip with a row of strap holes',
      o: { profile: 'original', gripD: 25, gripW: 23, holes: true, holeN: 0, holeD: 10.4, holeShape: 'oval', grooves: 'none', grooveN: 4, pattern: 'none', pad: false } },
    solid: { label: 'Solid comfort', note: 'A solid oval bar, light finger grooves and a soft-grip pad',
      o: { profile: 'oval', gripD: 27, gripW: 23, holes: false, grooves: 'light', grooveN: 4, pattern: 'none', pad: true, padT: 2 } },
    deep: { label: 'Deep grip', note: 'Solid bar with four deep finger grooves',
      o: { profile: 'original', gripD: 28, gripW: 23, holes: false, grooves: 'deep', grooveN: 4, pattern: 'none', pad: false } },
    strap: { label: 'Strap bar', note: 'Flat bar with five wide slots for straps and carabiners',
      o: { profile: 'flat', gripD: 26, gripW: 23, holes: true, holeN: 5, holeD: 10, holeShape: 'slot', grooves: 'none', pattern: 'none', pad: false } },
    name: { label: 'Name bar', note: 'Flat solid bar with your name inlaid in a second color',
      o: { profile: 'flat', gripD: 26, gripW: 23, holes: false, grooves: 'none', pattern: 'none', pad: false, textStyle: 'inlay', textH: 11, bothSides: true } },
    pattern: { label: 'Pattern grip', note: 'Oval bar with a debossed diamond texture',
      o: { profile: 'oval', gripD: 26, gripW: 23, holes: false, grooves: 'none', pattern: 'diamond', patStyle: 'deboss', patDepth: 0.7, patScale: 1, pad: false } }
  };
  const MATERIALS = {
    petg: { label: 'PETG', walls: 5, infill: 75, tol: 0, note: 'PETG, 0.2 mm layers, 5 walls, 75% infill (the fit-tested settings). Tough and a little flexible; fine in a hot car.' },
    petgmax: { label: 'PETG heavy duty', walls: 6, infill: 100, tol: 0, note: 'PETG, 0.2 mm layers, 6 walls, 100% infill. For a fully loaded case carried every day.' },
    asa: { label: 'ASA (outdoor)', walls: 5, infill: 75, tol: 0.1, note: 'ASA, 0.2 mm layers, 5 walls, 75% infill, enclosed printer. Holds up to sun and heat; the pin holes are 0.1 mm bigger for ASA shrink.' }
  };
  const FITS = { snug: { label: 'Snug', d: -0.1 }, standard: { label: 'Standard', d: 0 }, loose: { label: 'Loose', d: 0.15 } };
  const TEXT_STYLES = { engrave: 'Engraved', raised: 'Raised color', inlay: 'Inlaid color' };
  const FONTS = { block: 'Block', slab: 'Slab', round: 'Round', chunky: 'Chunky' };
  const PALETTE = [
    { name: 'Black', hex: '#1E1E1E' }, { name: 'White', hex: '#F7F7F2' }, { name: 'Gray', hex: '#8A8D91' }, { name: 'Navy', hex: '#1F3A68' },
    { name: 'Red', hex: '#C8102E' }, { name: 'Orange', hex: '#E8730C' }, { name: 'Yellow', hex: '#F5C518' }, { name: 'Forest', hex: '#2F6B4F' },
    { name: 'Mint', hex: '#8FD3B6' }, { name: 'Blue', hex: '#1F6FB2' }, { name: 'Purple', hex: '#7B4FB8' }, { name: 'Sand', hex: '#E6D3B3' }
  ];
  const LIMITS = { freeColors: 2, maxChars: 20 };
  const PIN_H = 13; // preview: pin axis above the pocket floor
  const DEFAULTS = {
    caseId: 'p1510', profile: 'original', material: 'petg', fit: 'standard',
    gripD: null, gripW: null,
    holes: true, holeN: 0, holeD: 10.4, holePitch: 15.15, holeShape: 'oval',
    grooves: 'none', grooveN: 4, grooveDepth: null,
    pattern: 'none', patStyle: 'deboss', patDepth: 0.6, patScale: 1,
    pad: false,
    text: '', font: 'block', textH: 9, textStyle: 'engrave', textDepth: 0.8, bothSides: false, logoH: 14,
    padT: 2,
    custom: { spacing: 125, forkLen: 16, slotW: 5.9, holeD: 6.2, pinTop: 8.7, slotDepth: 26, legW: 18 },
    colors: { body: '#E8730C', accent: '#1E1E1E' }, singleColor: false,
    bed: [256, 256], bedZ: 256, bambu: 'A1'
  };

  function options(raw) {
    raw = raw || {};
    const o = { ...DEFAULTS, ...raw };
    o.caseId = byId[o.caseId] ? o.caseId : DEFAULTS.caseId;
    // older single 'grip' option: ergo = original + light grooves, pad = original + pad
    if (raw.grip && !raw.profile) { o.profile = raw.grip === 'ergo' || raw.grip === 'pad' ? 'original' : raw.grip; if (raw.grip === 'ergo' && raw.grooves === undefined) o.grooves = 'light'; if (raw.grip === 'pad' && raw.pad === undefined) o.pad = true; }
    o.profile = PROFILES[o.profile] ? o.profile : 'original';
    o.grip = o.profile;
    o.pad = !!o.pad;
    o.grooves = GROOVES[o.grooves] ? o.grooves : 'none';
    o.grooveN = Math.round(clamp(num(o.grooveN, 4), 2, 6));
    o.grooveDepth = o.grooves === 'none' ? 0 : clamp(num(raw.grooveDepth, GROOVES[o.grooves].depth), 0.6, 4);
    o.holeShape = HOLE_SHAPES[o.holeShape] ? o.holeShape : 'oval';
    o.holeN = Math.round(clamp(num(o.holeN, 0), 0, 9));
    o.pattern = PATTERNS[o.pattern] ? o.pattern : 'none';
    o.patStyle = PAT_STYLES[o.patStyle] ? o.patStyle : 'deboss';
    o.patScale = clamp(num(o.patScale, 1), 0.6, 1.6);
    o.material = MATERIALS[o.material] ? o.material : 'petg';
    o.fit = FITS[o.fit] ? o.fit : 'standard';
    const c = { ...DEFAULTS.custom, ...(raw.custom || {}) };
    o.custom = {
      spacing: clamp(num(c.spacing, 125), 70, 300), forkLen: clamp(num(c.forkLen, 16), 10, 30), slotW: clamp(num(c.slotW, 5.9), 3, 12),
      holeD: clamp(num(c.holeD, 6.2), 3, 10), pinTop: clamp(num(c.pinTop, 8.7), 5, 15), slotDepth: clamp(num(c.slotDepth, 26), 14, 40), legW: clamp(num(c.legW, 18), 12, 30)
    };
    const I = iface(o);
    // Locked: the total height (pin axis to the grip's palm face), the length and the width never change. A thicker
    // grip takes its depth from the finger room; the width stays inside the handle's width.
    o.gripD = clamp(num(raw.gripD, I.gripD), 18, 30);
    o.gripW = clamp(num(raw.gripW, I.gripW), 16, I.W);
    o.clear = I.gripD + I.clear - o.gripD;
    o.holes = raw.holes === undefined ? true : !!raw.holes;
    o.holeD = clamp(num(o.holeD, 10.4), 6, 14);
    o.holePitch = clamp(num(o.holePitch, 15.15), o.holeD + 3, 40);
    o.text = String(o.text == null ? '' : o.text).replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxChars);
    o.font = FONTS[o.font] ? o.font : 'block';
    o.textH = clamp(num(o.textH, 9), 4, 20);
    o.textStyle = TEXT_STYLES[o.textStyle] ? o.textStyle : 'engrave';
    o.textDepth = clamp(num(o.textDepth, 0.8), 0.4, 1.5);
    o.bothSides = !!raw.bothSides;
    o.image = Array.isArray(raw.image) && raw.image.length ? raw.image : null;
    o.imageName = String(raw.imageName || '').slice(0, 80);
    o.logoH = clamp(num(o.logoH, 14), 5, 24);
    o.padT = clamp(num(o.padT, 2), 1.2, 3.5);
    o.patDepth = clamp(num(o.patDepth, 0.6), 0.4, 1.2);
    if (o.pad) o.patDepth = Math.min(o.patDepth, o.padT - 0.6);
    // raised text stays inside the locked width: the grip narrows by the text depth
    if (o.textStyle === 'raised' && (o.text || o.image)) o.gripW = Math.min(o.gripW, I.W - 2 * o.textDepth);
    o.colors = { ...DEFAULTS.colors, ...(raw.colors || {}) };
    for (const k of Object.keys(DEFAULTS.colors)) { const v = String(o.colors[k] || ''); o.colors[k] = /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : DEFAULTS.colors[k]; }
    o.singleColor = !!raw.singleColor;
    o.bed = [clamp(num(o.bed && o.bed[0], 256), 100, 1000), clamp(num(o.bed && o.bed[1], 256), 100, 1000)];
    o.bedZ = clamp(num(o.bedZ, 256), 60, 1000);
    o.bambu = String(o.bambu || 'A1');
    return o;
  }
  // the interface (fork, pins) for the chosen case
  function iface(o) {
    const cs = byId[o.caseId] || byId.p1510;
    if (cs.iface !== 'custom') return { ...IFACES[cs.iface], custom: false };
    const c = o.custom, prong = Math.max(2.5, (c.forkLen - c.slotW) / 2), fl = prong * 2 + c.slotW;
    return { label: 'Custom', forkL: [prong, c.slotW, prong], forkR: [prong, c.slotW, prong], span: Math.max(40, c.spacing - fl), holeD: c.holeD, pinTop: c.pinTop, pinOffY: 0,
      slotDepth: c.slotDepth, legW: Math.min(c.legW, 23), W: Math.max(23, Math.min(30, c.legW + 5)), gripD: 25, clear: 39.3, gripW: Math.max(23, Math.min(30, c.legW + 5)), holeOffX: 0, holeZ: 0.4228, custom: true, source: 'Your measurements' };
  }

  // ---------------------------------------------------------------- 2D helpers
  function arc(cx, cy, rx, ry, a0, a1, n) { const out = []; for (let i = 0; i <= n; i++) { const t = (a0 + (a1 - a0) * i / n) * D2R; out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } return out; }
  function dedupe(L) { const out = []; for (const p of L) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push(p); } const a = out[0], b = out[out.length - 1]; if (out.length > 2 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4) out.pop(); return out; }
  function rrect(x0, y0, x1, y1, r, n) { r = Math.min(r, (x1 - x0) / 2 - 1e-3, (y1 - y0) / 2 - 1e-3); n = n || 12; return dedupe([...arc(x1 - r, y0 + r, r, r, -90, 0, n), ...arc(x1 - r, y1 - r, r, r, 0, 90, n), ...arc(x0 + r, y1 - r, r, r, 90, 180, n), ...arc(x0 + r, y0 + r, r, r, 180, 270, n)]); }
  // grip cross-section in the (y, z) plane, CCW
  function gripYZ(style, yc, w, d) {
    const a = w / 2, y0 = yc - a, y1 = yc + a, er = Math.min(4.6, a * 0.42), ez = Math.min(2.9, d * 0.14);
    const bottom = [...arc(y0 + er, ez, er, ez, 180, 270, 12), ...arc(y1 - er, ez, er, ez, 270, 360, 12)];
    if (style === 'flat') { const r = Math.min(3, a * 0.3); return dedupe([...bottom, ...arc(y1 - r, d - r, r, r, 0, 90, 12), ...arc(y0 + r, d - r, r, r, 90, 180, 12)]); }
    if (style === 'dshape') { const b = Math.min(a, d - ez - 2); const zs = d - b; const r = 2.5; return dedupe([...arc(y0 + r, r, r, r, 180, 270, 8), ...arc(y1 - r, r, r, r, 270, 360, 8), ...arc(yc, zs, a, b, 0, 180, 48)]); }
    if (style === 'oval') { // round on both faces: big soft rounds on the palm (bed) side, a full dome on the finger side
      const r0 = a * 0.72, z0 = Math.min(5.2, d * 0.22), b = d * 0.42, zs = d - b;
      return dedupe([...arc(y0 + r0, z0, r0, z0, 180, 270, 16), ...arc(y1 - r0, z0, r0, z0, 270, 360, 16), ...arc(yc, zs, a, b, 0, 180, 48)]);
    }
    if (style === 'octagon') { const c = Math.min(a, d / 2) * 0.62; return [[y0 + c, 0], [y1 - c, 0], [y1, c], [y1, d - c], [y1 - c, d], [y0 + c, d], [y0, d - c], [y0, c]]; }
    const b = Math.min(6.24, d * 0.3), zs = d - b; // original / grooves / pad: elliptical dome on the finger side
    return dedupe([...bottom, ...arc(yc, zs, a, b, 0, 180, 48)]);
  }
  // where the flat side faces of the grip run (for text): [z0, z1]
  function gripFlatBand(style, w, d) {
    const a = w / 2, ez = Math.min(2.9, d * 0.14);
    if (style === 'flat') return [ez + 0.6, d - Math.min(3, a * 0.3) - 0.4];
    if (style === 'dshape') { const b = Math.min(a, d - ez - 2); return [2.5 + 0.4, d - b - 0.2]; }
    if (style === 'oval') return [Math.min(5.2, d * 0.22) + 0.4, d - d * 0.42 - 0.2];
    if (style === 'octagon') { const c = Math.min(a, d / 2) * 0.62; return [c + 0.4, d - c - 0.4]; }
    return [ez + 0.6, d - Math.min(6.24, d * 0.3) - 0.2];
  }
  // leg cross-section in the (y, z) plane, CCW: full width W below the chamfer, legW at the forks, a round top
  function legYZ(yc, W, legW, H, chamferTop) {
    const a = W / 2, y0 = yc - a, y1 = yc + a, u = legW / 2, er = 4.6, ez = 2.9;
    const ch1 = chamferTop, ch0 = ch1 - (a - u) * 2.8;
    const R = Math.max(u + 0.5, 11.2), zc = H - R, za = zc + Math.sqrt(Math.max(0, R * R - u * u)), a0 = Math.atan2(za - zc, u) / D2R;
    return dedupe([...arc(y0 + er, ez, er, ez, 180, 270, 12), ...arc(y1 - er, ez, er, ez, 270, 360, 12),
      [y1, ch0], [yc + u, ch1], ...arc(yc, zc, R, R, a0, 180 - a0, 40), [yc - u, ch1], [y0, ch0]]);
  }

  // ---------------------------------------------------------------- Manifold kit
  function kit(M) {
    const bin = [];
    const k = x => { bin.push(x); return x; };
    const cs = (loops, fill) => k(new M.CrossSection(loops.filter(L => L && L.length > 2), fill || 'Positive'));
    const ext = (sec, z0, z1) => k(k(sec.extrude(z1 - z0)).translate([0, 0, z0]));
    const box = (x0, y0, z0, x1, y1, z1) => k(k(M.Manifold.cube([x1 - x0, y1 - y0, z1 - z0], false)).translate([x0, y0, z0]));
    const U = list => { list = list.filter(m => m && !m.isEmpty()); if (!list.length) return null; if (list.length === 1) return list[0]; return k(M.Manifold.union(list)); };
    const sub = (a, b) => (a && b) ? k(a.subtract(b)) : a;
    const and = (a, b) => k(a.intersect(b));
    // (y, z) section extruded along x from x0 to x1
    const extX = (loops, x0, x1, fill) => k(k(k(cs(loops.map(L => L.map(p => [-p[1], p[0]])), fill).extrude(x1 - x0)).rotate([0, 90, 0])).translate([x0, 0, 0]));
    const extXcs = (sec, x0, x1) => k(k(k(k(sec.rotate(90)).extrude(x1 - x0)).rotate([0, 90, 0])).translate([x0, 0, 0]));
    // (x, z) section extruded along y from y0 to y1
    const extY = (loops, y0, y1, fill) => k(k(k(cs(loops, fill).extrude(y1 - y0)).rotate([90, 0, 0])).translate([0, y1, 0]));
    // cylinder along x / along y
    const cylX = (r, y, z, x0, x1, n) => k(k(k(M.Manifold.cylinder(x1 - x0, r, r, n || 96)).rotate([0, 90, 0])).translate([x0, y, z]));
    const cylY = (r, x, z, y0, y1, n, sx, sz) => k(k(k(k(M.Manifold.cylinder(y1 - y0, r, r, n || 96)).rotate([-90, 0, 0])).scale([sx || 1, 1, sz || 1])).translate([x, y0, z]));
    // a through hole along y from 0 to W with rounded-over edges (fillet a mm wide, b mm deep) at both faces, oval sx \u00d7 sz
    const roundHoleY = (r, x, z, W, a, b, sx, sz) => {
      const pr = [[0, -1], [r + a, -1]], n = 12;
      for (let i = 0; i <= n; i++) { const t = i / n * Math.PI / 2; pr.push([r + a - a * Math.sin(t), b - b * Math.cos(t)]); }
      for (let i = 0; i <= n; i++) { const t = i / n * Math.PI / 2; pr.push([r + a * (1 - Math.cos(t)), W - b + b * Math.sin(t)]); }
      pr.push([r + a, W + 1], [0, W + 1]);
      const sec = cs([dedupe(pr)]);
      return k(k(k(k(M.Manifold.revolve(sec, 96)).rotate([-90, 0, 0])).scale([sx || 1, 1, sz || 1])).translate([x, 0, z]));
    };
    const free = () => { for (const x of bin) { try { x.delete(); } catch (e) { /* gone */ } } bin.length = 0; };
    return { M, k, cs, ext, box, U, sub, and, extX, extXcs, extY, cylX, cylY, roundHoleY, free };
  }
  function soup(m) {
    const g = m.getMesh(), np = g.numProp, vp = g.vertProperties, tv = g.triVerts, out = new Float32Array(tv.length * 3);
    for (let i = 0; i < tv.length; i++) { const s = tv[i] * np; out[i * 3] = vp[s]; out[i * 3 + 1] = vp[s + 1]; out[i * 3 + 2] = vp[s + 2]; }
    return out;
  }
  const empty = m => !m || m.isEmpty();

  // ---------------------------------------------------------------- text and logo (on the grip's side faces)
  // polys in (u, v), centered; returns { polys, w, h }
  function badgePolys(o, maxW, maxH, warnings) {
    const SM = stampApi(), items = [];
    if (o.image) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const Q of o.image) for (const p of Q.outer) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      if (isFinite(x0) && x1 > x0 && y1 > y0) {
        const h = Math.min(o.logoH, maxH), s = h / (y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        items.push({ w: (x1 - x0) * s, h, polys: o.image.map(Q => ({ outer: Q.outer.map(p => [(p[0] - cx) * s, (p[1] - cy) * s]), holes: (Q.holes || []).map(L => L.map(p => [(p[0] - cx) * s, (p[1] - cy) * s])) })) });
      }
    }
    if (o.text && SM) {
      const dropped = new Set(); let ps = [];
      try { ps = SM.textBlock([o.text], o.font, Math.min(o.textH, maxH), 0.06, dropped); } catch (e) { warnings.push('The text could not be drawn in that lettering.'); }
      if (dropped.size) warnings.push(`Some characters are not in this lettering and were left out: ${[...dropped].join(' ')}`);
      if (ps.length) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const Q of ps) for (const p of Q.outer) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } items.push({ w: x1 - x0, h: y1 - y0, polys: ps.map(Q => ({ outer: Q.outer.map(p => [p[0] - (x0 + x1) / 2, p[1] - (y0 + y1) / 2]), holes: (Q.holes || []).map(L => L.map(p => [p[0] - (x0 + x1) / 2, p[1] - (y0 + y1) / 2])) })) }); }
    }
    if (!items.length) return null;
    const gap = items.length > 1 ? 4 : 0, tw = items.reduce((s, it) => s + it.w, 0) + gap;
    const s = tw > maxW ? maxW / tw : 1;
    if (s < 1) warnings.push('The text and logo were shrunk to fit the grip.');
    const out = []; let x = -tw / 2;
    for (const it of items) { const dx = x + it.w / 2; for (const Q of it.polys) out.push({ outer: Q.outer.map(p => [(p[0] + dx) * s, p[1] * s]), holes: Q.holes.map(L => L.map(p => [(p[0] + dx) * s, p[1] * s])) }); x += it.w + gap; }
    return { polys: out, w: tw * s, h: Math.max(...items.map(it => it.h)) * s };
  }

  // ---------------------------------------------------------------- the handle
  function geometry(o) {
    const I = iface(o), W = I.W, yc = W / 2;
    const [lo, ls, li] = I.forkL, [ri, rs, ro] = I.forkR;
    const xL1 = lo + ls + li, xR0 = xL1 + I.span, L = xR0 + ri + rs + ro;
    const slots = [[lo, lo + ls], [xR0 + ri, xR0 + ri + rs]];
    const gripD = o.gripD, pinZ = gripD + o.clear, H = pinZ + I.pinTop, slotZ = H - I.slotDepth;
    const pinY = yc + I.pinOffY, holeD = I.holeD + MATERIALS[o.material].tol + FITS[o.fit].d;
    return { I, W, yc, L, xL1, xR0, slots, gripD, gripW: o.gripW, pinZ, pinY, H, slotZ, holeD, chamferTop: slotZ - 4 };
  }
  function buildHandle(o, K, warnings) {
    const g = geometry(o), { W, yc, L, xL1, xR0, gripD, H } = g;
    // side profile (x, z): the U with soft outer corners and filleted inside corners
    const rx = Math.min(16.23, xL1 + 0.23, L / 4), rz = Math.min(15, gripD * 0.6), fr = 2;
    const side = dedupe([[0, H], [0, rz], ...arc(rx, rz, rx, rz, 180, 270, 32), ...arc(L - rx, rz, rx, rz, 270, 360, 32), [L, H], [xR0, H],
      ...arc(xR0 - fr, gripD + fr, fr, fr, 0, -90, 8), ...arc(xL1 + fr, gripD + fr, fr, fr, 270, 180, 8), [xL1, H]]);
    const sideM = K.extY([side], -1, W + 1);
    const band0 = xL1 - 2, band1 = xR0 + 2;
    const legs = K.and(K.and(sideM, K.extX([legYZ(yc, W, g.I.legW, H, g.chamferTop)], -1, L + 1)),
      K.U([K.box(-1, -1, -1, band0, W + 1, H + 1), K.box(band1, -1, -1, L + 1, W + 1, H + 1), K.box(band0 - 0.01, -1, gripD - 0.01, xL1 + fr + 0.01, W + 1, H + 1), K.box(xR0 - fr - 0.01, -1, gripD - 0.01, band1 + 0.01, W + 1, H + 1)])); // only the fillet zones, so no sliver on the grip
    const gripSec = gripYZ(o.grip, yc, o.gripW, gripD);
    const grip = K.and(sideM, K.extX([gripSec], band0 - 0.01, band1 + 0.01));
    let body = K.U([legs, grip]);
    body = K.and(body, K.ext(K.cs([rrect(0, 0, L, W, 3.3, 10)]), -1, H + 1)); // soft vertical corners
    // forks: the slots for the case's center knuckles, and the pin holes
    for (const [s0, s1] of g.slots) body = K.sub(body, K.box(s0, -1, g.slotZ, s1, W + 1, H + 1));
    body = K.sub(body, K.cylX(g.holeD / 2, g.pinY, g.pinZ, -1, L + 1, 96));
    // finger grooves
    let grooveAt = null;
    if (o.grooves !== 'none') {
      const n = o.grooveN, r = GROOVES[o.grooves].r, depth = Math.min(o.grooveDepth, gripD * 0.2), cx = (xL1 + xR0) / 2;
      const pitch = Math.min(2 * r + 1.5, (xR0 - xL1 - 10) / n);
      grooveAt = { r, zc: gripD + r - depth, xs: Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * pitch) };
      body = K.sub(body, K.U(grooveAt.xs.map(x => K.cylY(r, x, grooveAt.zc, -1, W + 1, 96))));
    }
    // text and logo on the side faces
    const parts = [];
    let badge = null, badgeX = null;
    if (o.text || o.image) {
      const band = gripFlatBand(o.grip, o.gripW, gripD), maxH = Math.max(3, band[1] - band[0] - 1.2), maxW = Math.max(20, xR0 - xL1 - 14);
      badge = badgePolys(o, maxW, maxH, warnings);
      if (badge) badgeX = [(xL1 + xR0) / 2 - badge.w / 2, (xL1 + xR0) / 2 + badge.w / 2];
      if (badge) badge.zc = (band[0] + band[1]) / 2;
      if (!badge) warnings.push('The text or logo came out empty. Try a bigger size.');
    }
    // tie-down / carabiner holes through the grip
    // surface pattern on the grip's side faces and finger side (not the palm face, which prints on the bed)
    if (o.pattern !== 'none') body = patternGrip(o, K, g, body, gripSec, badgeX, badge, warnings);
    // tie-down / carabiner holes through the grip
    let nHoles = 0, holeXs = [];
    if (o.holes) {
      const span = xR0 - xL1, r = o.holeD / 2, shp = o.holeShape;
      const halfW = shp === 'slot' ? r * 0.84 + r * 0.9 : shp === 'hex' ? r : r * 1.038, hH = shp === 'slot' ? r * 0.84 : r;
      const edge = (shp === 'oval' ? r : halfW) + 3.6, room = span - 2 * edge;
      let n, pitch;
      if (o.holeN > 0) { n = o.holeN; pitch = n > 1 ? Math.min(40, room / (n - 1)) : 0; const minP = 2 * halfW + 3; if (n > 1 && pitch < minP) { n = Math.max(1, Math.floor(room / minP + 1e-6) + 1); pitch = n > 1 ? room / (n - 1) : 0; warnings.push(`Only ${n} holes of that size fit along the grip.`); } }
      else { pitch = Math.max(o.holePitch, 2 * halfW + 3); n = Math.max(0, Math.floor(room / pitch + 1e-6) + 1); }
      const x0 = (xL1 + xR0) / 2 + (o.holeN > 0 ? 0 : (g.I.holeOffX || 0)) - (n - 1) * pitch / 2;
      const zH = gripD * (g.I.holeZ || 0.42);
      if (2 * hH > gripD - 6) warnings.push('The holes are too big for that grip thickness; they were left out.');
      else {
        for (let i = 0; i < n; i++) { const x = x0 + i * pitch; if (badgeX && x + halfW + 1 > badgeX[0] && x - halfW - 1 < badgeX[1]) continue; holeXs.push(x); }
        if (badgeX && holeXs.length < n) warnings.push(`${n - holeXs.length} of the ${n} holes were skipped where the text or logo sits.`);
        nHoles = holeXs.length;
        // soft rounded-over edges for straps; the oval is the original's (10.8 \u00d7 10 mm at the default size)
        const ra = Math.min(1.9, hH * 0.37), rb = Math.min(3, W * 0.13);
        const one = x => {
          if (shp === 'hex') return K.cylY(r, x, zH, -1, W + 1, 6);
          if (shp === 'slot') { const rs = r * 0.84, dx = r * 0.9; return K.k(K.M.Manifold.hull([K.roundHoleY(rs, x - dx, zH, W, ra, rb), K.roundHoleY(rs, x + dx, zH, W, ra, rb)])); }
          return shp === 'round' ? K.roundHoleY(r, x, zH, W, ra, rb) : K.roundHoleY(r, x, zH, W, ra, rb, 1.038, 0.96);
        };
        if (holeXs.length) body = K.sub(body, K.U(holeXs.map(one)));
      }
    }
    // soft-grip pad: a shell of the grip between two rigid collars, its own part on filament 2
    let pad = null;
    if (o.pad) {
      const x0 = xL1 + 3, x1 = xR0 - 3;
      const sec = K.cs([gripSec]);
      let core = K.extXcs(K.k(sec.offset(-o.padT, 'Round', 2, 48)), x0 - 0.01, x1 + 0.01);
      if (grooveAt) core = K.sub(core, K.U(grooveAt.xs.map(x => K.cylY(grooveAt.r + o.padT, x, grooveAt.zc, -1, W + 1, 96)))); // even pad over the grooves
      core = K.and(core, body); // keeps the holes open
      pad = K.sub(K.and(body, K.box(x0, -1, -1, x1, W + 1, gripD + 1)), core);
      body = K.sub(body, K.box(x0, -1, -1, x1, W + 1, gripD + 1));
      body = K.U([body, K.and(core, K.box(x0 - 0.02, -1, -1, x1 + 0.02, W + 1, gripD + 1))]);
    }
    // badge solids
    let raisedM = null;
    if (badge) {
      const faces = [{ y: yc - o.gripW / 2, out: -1 }]; if (o.bothSides) faces.push({ y: yc + o.gripW / 2, out: 1 });
      const cx = (xL1 + xR0) / 2, zc = badge.zc, dep = o.textDepth;
      const solids = [];
      for (const f of faces) {
        // read upright in use (the handle stands grip-up on the lid): u runs toward -x on the front face, +x on the back
        const sx = f.out < 0 ? -1 : 1;
        const loops = []; for (const Q of badge.polys) for (const Lp of [Q.outer, ...Q.holes]) loops.push(Lp.map(p => [cx + sx * p[0], zc - p[1]]));
        const cs = K.cs(loops, 'EvenOdd');
        const exY = (y0, y1) => K.k(K.k(K.k(cs.extrude(y1 - y0)).rotate([90, 0, 0])).translate([0, y1, 0]));
        if (o.textStyle === 'raised') solids.push(f.out < 0 ? exY(f.y - dep, f.y + 0.4) : exY(f.y - 0.4, f.y + dep));
        else solids.push(f.out < 0 ? exY(f.y - 1, f.y + dep) : exY(f.y - dep, f.y + 1));
      }
      const S = K.U(solids);
      if (o.textStyle === 'engrave') { body = K.sub(body, S); if (pad) pad = K.sub(pad, S); }
      else if (o.textStyle === 'inlay') {
        const inl = K.and(K.U([body, pad]), S); body = K.sub(body, S); if (pad) pad = K.sub(pad, S); raisedM = inl;
      } else { const outer = pad ? K.sub(K.sub(S, body), pad) : K.sub(S, body); raisedM = outer; }
    }
    const accent = !o.singleColor && o.colors.accent !== o.colors.body;
    parts.push({ name: 'Case handle', role: 'body', m: body, color: o.colors.body });
    if (!empty(pad)) parts.push({ name: 'Soft-grip pad', role: 'pad', m: pad, color: accent ? o.colors.accent : o.colors.body });
    if (!empty(raisedM)) parts.push({ name: o.textStyle === 'inlay' ? 'Text inlay' : 'Raised text', role: 'text', m: raisedM, color: accent ? o.colors.accent : o.colors.body });
    return { g, parts, nHoles, holeXs, badge: !!badge };
  }

  // ---------------------------------------------------------------- surface patterns
  // 2D pattern loops (CCW) covering [x0, x1] \u00d7 [v0, v1]; s scales the feature size
  function patternLoops(kind, x0, x1, v0, v1, s) {
    const out = [], ccw = L => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } return a < 0 ? L.reverse() : L; };
    const xc = (x0 + x1) / 2, vc = (v0 + v1) / 2, X = x1 - x0, V = v1 - v0;
    if (kind === 'stripes') { const p = 4 * s, w = 1.6 * s, n = Math.ceil(X / p) + 1; for (let i = -n; i <= n; i++) { const x = xc + i * p; if (x < x0 - w || x > x1 + w) continue; out.push([[x - w / 2, v0 - 1], [x + w / 2, v0 - 1], [x + w / 2, v1 + 1], [x - w / 2, v1 + 1]]); } }
    else if (kind === 'knurl') { // crossed lines at \u00b145\u00b0
      const p = 3.2 * s, w = 0.9 * s, R = Math.hypot(X, V) / 2 + 4, n = Math.ceil(R / p) + 1;
      for (const sg of [1, -1]) for (let i = -n; i <= n; i++) { const c = i * p, ux = Math.SQRT1_2, uy = sg * Math.SQRT1_2, nx = -uy, ny = ux;
        const a = [xc + nx * (c - w / 2) - ux * R, vc + ny * (c - w / 2) - uy * R], b = [xc + nx * (c - w / 2) + ux * R, vc + ny * (c - w / 2) + uy * R];
        const d = [xc + nx * (c + w / 2) + ux * R, vc + ny * (c + w / 2) + uy * R], e = [xc + nx * (c + w / 2) - ux * R, vc + ny * (c + w / 2) - uy * R];
        out.push(ccw([a, b, d, e])); }
    } else if (kind === 'diamond') {
      const p = 6 * s, h = 2.4 * s, nx = Math.ceil(X / p / 2) + 1, nv = Math.ceil(V / p) + 1;
      for (let j = -nv; j <= nv; j++) for (let i = -nx; i <= nx; i++) { const x = xc + (i + (j & 1 ? 0.5 : 0)) * p, v = vc + j * p / 2; if (x < x0 - h || x > x1 + h || v < v0 - h || v > v1 + h) continue; out.push([[x, v - h], [x + h * 1.25, v], [x, v + h], [x - h * 1.25, v]]); }
    } else if (kind === 'hex') {
      const r = 2.3 * s, R = r + 0.65 * s, dx = 1.5 * R, dv = Math.sqrt(3) * R, nx = Math.ceil(X / dx / 2) + 1, nv = Math.ceil(V / dv / 2) + 1;
      for (let i = -nx; i <= nx; i++) for (let j = -nv; j <= nv; j++) { const x = xc + i * dx, v = vc + (j + (i & 1 ? 0.5 : 0)) * dv; if (x < x0 - r || x > x1 + r || v < v0 - r || v > v1 + r) continue; const L = []; for (let k = 0; k < 6; k++) L.push([x + r * Math.cos(k * Math.PI / 3), v + r * Math.sin(k * Math.PI / 3)]); out.push(L); }
    } else if (kind === 'waves') { // wavy bands running along the grip
      const p = 3.6 * s, w = 1.5 * s, A = 1.1 * s, lam = 12 * s, nv = Math.ceil(V / p / 2) + 1, step = 0.8;
      for (let j = -nv; j <= nv; j++) { const c = vc + j * p; if (c < v0 - w - A || c > v1 + w + A) continue; const top = [], bot = [];
        for (let x = x0 - 2; x <= x1 + 2 + 1e-6; x += step) { const y = c + A * Math.sin(2 * Math.PI * (x - xc) / lam); bot.push([x, y - w / 2]); top.push([x, y + w / 2]); }
        out.push([...bot, ...top.reverse()]); }
    }
    return out;
  }
  // deboss: the pattern sinks into the surface. emboss: the surface around the pattern sinks, so the pattern stands
  // proud. Both keep inside the grip's outline, so the handle's size never changes.
  function patternGrip(o, K, g, body, gripSec, badgeX, badge, warnings) {
    const { W, yc, xL1, xR0, gripD } = g, dep = o.patDepth, s = o.patScale;
    const px0 = xL1 + (o.pad ? 4 : 5), px1 = xR0 - (o.pad ? 4 : 5);
    const sec = K.cs([gripSec]);
    const skin = K.sub(K.extXcs(K.k(sec.offset(1.5, 'Round', 1, 32)), px0, px1), K.extXcs(K.k(sec.offset(-dep, 'Round', 1, 32)), px0 - 1, px1 + 1)); // reaches past the surface: no coplanar faces
    const band = gripFlatBand(o.profile, o.gripW, gripD), zSplit = band[1] + 0.3, zBed = Math.min(band[0], 1.6);
    // sides: projected along y; the finger side: projected along z
    const side = K.and(K.extY(patternLoops(o.pattern, px0, px1, zBed, zSplit, s), -2, W + 2), K.box(px0, -2, zBed, px1, W + 2, zSplit));
    const top = K.and(K.ext(K.cs(patternLoops(o.pattern, px0, px1, yc - o.gripW / 2 - 1, yc + o.gripW / 2 + 1, s)), zSplit, gripD + 3), K.box(px0, -2, zSplit, px1, W + 2, gripD + 3));
    let mask = K.U([side, top]);
    let keep = null; // where the text or logo sits: plain surface
    if (badge && badgeX) {
      const z0 = band[0] - 0.6, z1 = band[1] + 0.2, bx0 = badgeX[0] - 2.5, bx1 = badgeX[1] + 2.5;
      keep = K.U([K.box(bx0, -1, z0, bx1, yc, z1), o.bothSides ? K.box(bx0, yc, z0, bx1, W + 1, z1) : null].filter(Boolean));
    }
    const shell = K.and(skin, K.box(px0, -2, zBed, px1, W + 2, gripD + 3));
    let cut = o.patStyle === 'deboss' ? K.and(shell, mask) : K.sub(shell, mask);
    if (keep) cut = K.sub(cut, keep);
    if (!cut || cut.isEmpty()) { warnings.push('The pattern came out empty at that size.'); return body; }
    return K.sub(body, cut);
  }

  // ---------------------------------------------------------------- display-only case (preview, never exported)
  // The whole hard case at its real proportions (shared mockup in case-mockup.js), the handle mount on its top
  // where the factory handle sits, with the hinge knuckles and steel pins.
  const mockApi = () => G.GPCaseMock || (typeof require === 'function' ? require('./case-mockup.js') : null);
  function mockPlan(caseId) {
    const CM = mockApi(), sp = CM.spec(caseId === 'custom' ? 'p1510' : caseId);
    const pocket = [-9.5, -17, 0, 86], pd = 6; // folded handle lies toward +y; x set per handle length
    let y0, usePocket = true, trolley = false;
    if (sp.layout === 'front' || sp.D < 200) { usePocket = false; y0 = -sp.lidD - 22; }
    else if (sp.wheels) { y0 = 86 + 50 - sp.D; trolley = true; }
    else y0 = 34.5 - sp.D / 2;
    return { CM, sp, y0, pocket: usePocket ? pocket : null, pd: usePocket ? pd : 0, trolley };
  }
  const plateApi = () => G.GPNamePlate || (typeof require === 'function' ? require('./case-nameplate.js') : null);
  function buildMock(K, g, caseId, info) {
    const L = g.L, M = K.M, P = mockPlan(caseId), cx = L / 2, out = [];
    const opt = { y0: P.y0, keepX: [-L / 2 - 30, L / 2 + 30] };
    const NP = plateApi(), pk = NP && NP.pocketFor ? NP.pocketFor(caseId) : null;
    if (pk) {
      opt.plate = pk; const spot = P.CM.plateSpot(P.sp, opt, pk);
      if (spot) {
        info.plateSpot = { ...spot, off: [cx, 0, P.pd] };
        // the stock blank plate in its pocket (display only)
        const blank = NP.plateSolid(K.M, pk), mesh = soup(blank); blank.delete();
        out.push({ name: 'Name plate (stock)', kind: 'case', mat: 'caseshell', color: '#3A3C40', p: NP.poseP(mesh, info.plateSpot) });
      } else delete opt.plate;
    }
    if (P.pocket) opt.pocket = [-L / 2 - 9.5, P.pocket[1], L / 2 + 9.5, P.pocket[3], P.pd];
    if (P.trolley) opt.trolley = [-Math.min(130, P.sp.W / 2 - 40), Math.min(130, P.sp.W / 2 - 40)];
    for (const q of P.CM.build(M, P.sp, opt)) out.push({ name: q.name, kind: q.kind, mat: q.mat, color: q.color, p: moveP(q.p, cx, 0, P.pd) });
    // knuckles: outside each fork, in each slot and inside each fork, molded up from the pocket floor
    const kn = [], gap = 0.25;
    const knuckle = (x0, x1) => K.U([K.cylX(6.5, 0, PIN_H, x0, x1, 64), K.box(x0, -6.5, P.pocket ? 0 : -1, x1, 6.5, PIN_H)]);
    for (const [s0, s1] of g.slots) kn.push(knuckle(s0 + gap, s1 - gap));
    kn.push(knuckle(-6.2, -gap), knuckle(g.xL1 + gap, g.xL1 + 6.2), knuckle(g.xR0 - 6.2, g.xR0 - gap), knuckle(L + gap, L + 6.2));
    out.push({ name: 'Hinge knuckles', kind: 'case', mat: 'caseshell', color: P.CM.COL.shell, p: soup(K.U(kn)) });
    const pins = [K.cylX(3, 0, PIN_H, -6.4, g.xL1 + 6.4, 40), K.cylX(3, 0, PIN_H, g.xR0 - 6.4, L + 6.4, 40)];
    out.push({ name: 'Steel pins', kind: 'pin', mat: 'switch', color: '#C9CDD2', p: soup(K.U(pins)) });
    return out;
  }
  // print frame -> use frame: turn about the pin axis by deg (180 = standing grip-up, 90 = folded flat)
  function poseP(p, g, deg) {
    const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R), q = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 3) { const dy = p[i + 1] - g.pinY, dz = p[i + 2] - g.pinZ; q[i] = p[i]; q[i + 1] = dy * c - dz * s; q[i + 2] = PIN_H + dy * s + dz * c; }
    return q;
  }
  function moveP(p, dx, dy, dz) { const q = new Float32Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + dz; } return q; }

  function build(raw, M) {
    if (!M || !M.Manifold) throw new Error('The solid engine (Manifold) is not loaded.');
    const o = options(raw), K = kit(M), warnings = [];
    try {
      const H = buildHandle(o, K, warnings), g = H.g;
      const raw2 = H.parts.map(q => ({ name: q.name, role: q.role, kind: q.role === 'body' ? 'handle' : q.role, color: q.color, p: soup(q.m), obj: 'handle' }));
      for (const q of raw2) if (!q.p.length) throw new Error(`The ${q.name.toLowerCase()} came out empty.`);
      const info = {}, mock = buildMock(K, g, o.caseId, info);
      // place on the bed: centered, in the print orientation
      const bx = o.bed[0], by = o.bed[1];
      const fits = g.L <= bx - 4 && g.W <= by - 4 && g.H <= o.bedZ;
      let parts;
      if (fits) parts = raw2.map(q => ({ ...q, plate: 0, p: moveP(q.p, (bx - g.L) / 2, (by - g.W) / 2, 0) }));
      else if (Math.hypot(g.L, g.W) <= Math.min(bx, by) * Math.SQRT2 - 8 && g.H <= o.bedZ) {
        // corner to corner on a small bed
        const a = Math.atan2(by, bx), c = Math.cos(a), s = Math.sin(a);
        parts = raw2.map(q => { const p = new Float32Array(q.p.length); for (let i = 0; i < p.length; i += 3) { const x = q.p[i] - g.L / 2, y = q.p[i + 1] - g.W / 2; p[i] = bx / 2 + x * c - y * s; p[i + 1] = by / 2 + x * s + y * c; p[i + 2] = q.p[i + 2]; } return { ...q, plate: 0, p }; });
        warnings.push('The handle sits corner to corner to fit your build plate.');
      } else { parts = raw2.map(q => ({ ...q, plate: 0, p: moveP(q.p, (bx - g.L) / 2, (by - g.W) / 2, 0) })); warnings.push(`The handle (${Math.round(g.L)} mm) is longer than your build plate.`); }
      if (o.clear < 36) warnings.push(`A thick grip leaves ${Math.round(o.clear * 10) / 10} mm of finger room. Gloved hands may be snug.`);
      const I = g.I, cs = byId[o.caseId];
      const colors = [...new Set(raw2.map(q => q.color))];
      const stats = {
        caseId: o.caseId, caseName: cs.name, where: cs.where, size: [g.L, g.W, g.H], pinSpacing: (g.slots[1][0] + g.slots[1][1]) / 2 - (g.slots[0][0] + g.slots[0][1]) / 2,
        slotW: g.slots[0][1] - g.slots[0][0], holeD: g.holeD, pinZ: g.pinZ, pinTop: I.pinTop, slotDepth: I.slotDepth, span: I.span, clear: o.clear, gripD: o.gripD, gripW: o.gripW,
        holes: H.nHoles, holeSize: o.holeD, colors: colors.length, parts: raw2.length, plates: 1, grip: o.profile, profile: o.profile, gripLabel: PROFILES[o.profile].label, grooves: o.grooves, grooveN: o.grooves === 'none' ? 0 : o.grooveN, pattern: o.pattern, patStyle: o.patStyle, pad: o.pad, holeShape: o.holeShape, gripSummary: gripSummary(o, H.nHoles), material: o.material, materialLabel: MATERIALS[o.material].label,
        walls: MATERIALS[o.material].walls, infill: MATERIALS[o.material].infill, badge: H.badge, custom: !!I.custom, source: I.source, bed: o.bed
      };
      return { options: o, g: { ...g, I: undefined }, raw: raw2, parts, mock, plateSpot: info.plateSpot || null, warnings, stats, colors, plates: 1 };
    } finally { K.free(); }
  }

  function gripSummary(o, holes) {
    const bits = [`${PROFILES[o.profile].label} grip`];
    if (o.grooves !== 'none') bits.push(`${GROOVES[o.grooves].label.toLowerCase()} finger grooves`);
    if (o.pattern !== 'none') bits.push(`${PAT_STYLES[o.patStyle].toLowerCase()} ${PATTERNS[o.pattern].toLowerCase()} pattern`);
    if (o.pad) bits.push('soft-grip pad');
    if (!holes) bits.push('solid bar');
    return bits.join(', ');
  }
  function presetOptions(id) { const p = PRESETS[id]; return p ? { ...p.o } : null; }
  function filaments(res) {
    const roles = { body: 'handle', pad: 'soft-grip pad (TPU)', text: 'text / logo' };
    return res.colors.map(c => ({ color: c, role: res.raw.filter(q => q.color === c).map(q => roles[q.role] || q.role).filter((v, i, a) => a.indexOf(v) === i).join(' + ') }));
  }
  // view: 'case' (standing on the lid), 'folded' (folded flat into the pocket) or 'print' (on the build plate)
  function scene(res, view) {
    if (view === 'print') return res.parts.map(q => ({ name: q.name, kind: q.kind, color: q.color, p: Float32Array.from(q.p) }));
    const g = res.g, deg = view === 'folded' ? 90 : 180, out = [];
    for (const q of res.raw) out.push({ name: q.name, kind: q.kind, color: q.color, p: poseP(q.p, g, deg) });
    // close-up: the handle standing, the case clipped to the top around it
    const CM = view === 'close' ? mockApi() : null, lo = [-45, -75, -70], hi = [g.L + 45, 75, 200];
    for (const q of res.mock) { const p = CM ? CM.clip(q.p, lo, hi) : Float32Array.from(q.p); if (p.length) out.push({ name: q.name, kind: q.kind, color: q.color, mat: q.mat, p, preview: true }); }
    return out;
  }
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  function export3MF(res, opt) {
    opt = opt || {}; const cols = res.colors, mat = MATERIALS[res.options.material];
    const mk = q => ({ name: q.name, p: q.p, color: q.color, extruder: cols.indexOf(q.color) + 1 });
    const settings = { wall_loops: String(mat.walls), sparse_infill_density: `${mat.infill}%` };
    const ob = res.parts.length > 1 ? { name: 'Case handle', parts: res.parts.map(mk), settings } : { ...mk(res.parts[0]), name: 'Case handle', settings };
    return T.threeMF([ob], { title: opt.name || 'Case handle', plates: [[0]], bambu: opt.bambu || res.options.bambu || 'A1', filaments: cols.map(c => ({ color: c })) });
  }
  function readme(res, name) {
    const o = res.options, s = res.stats, f = v => (Math.round(v * 100) / 100).toString(), mat = MATERIALS[o.material];
    const L = [`Expressarte case handle: ${name}`, '',
      `${s.caseName}${s.where ? ' ' + s.where : ''} \u00b7 ${f(s.size[0])} \u00d7 ${f(s.size[1])} \u00d7 ${f(s.size[2])} mm \u00b7 ${gripSummary(o, s.holes)} \u00b7 ${mat.label}`,
      `Mount: two-prong fork at each end, ${f(s.slotW)} mm slots ${f(s.pinSpacing)} mm apart, ${f(s.holeD)} mm pin holes ${f(s.pinTop)} mm below the prong tops.`,
      `Finger room under the grip: ${f(s.clear - s.pinTop)} mm to the prong tops.`];
    if (s.holes) L.push(`${s.holes} tie-down holes, ${f(s.holeSize)} mm, for straps or carabiners.`);
    L.push('', 'Filament slots in the 3MF'); filaments(res).forEach((x, i) => L.push(`  ${i + 1}: ${x.color}  ${x.role}`));
    L.push('', 'Printing',
      `  - ${mat.note}`,
      '  - Print it upright exactly as laid out: grip on the bed, forks up. No supports. The slots open upward and the pin holes bridge.',
      '  - The 3MF already sets the walls and infill on the object. Pick your PETG or ASA filament profile in the slicer.');
    if (o.pad) L.push('  - Soft-grip pad: filament 2. On a dual-nozzle printer load TPU (95A) for a soft grip that bonds to PETG; on a single nozzle, print it in a second color of the same material.');
    L.push('', 'Fitting',
      '  - Drive the old pins out with a 3 mm (1/8 in) pin punch from the clean end, keep them, and lift the old handle off.',
      '  - Set the new handle in place so each fork straddles the center knuckle, line up the holes and tap the original stainless pins back in, ridged end last, until flush.',
      '  - Fold the handle down and up a few times. It should swing freely without wobble. If the pins are tight, run a 6.3 mm (1/4 in) drill through the forks by hand.');
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, opt) {
    opt = opt || {}; const name = opt.name || `${res.stats.caseName} handle`, base = safe(opt.fileBase || name.toLowerCase()) || 'case_handle';
    const list = [{ name: `${base}.3mf`, data: export3MF(res, opt) }], seen = new Set();
    for (const q of res.parts) { let nm = safe(q.name.toLowerCase()); while (seen.has(nm)) nm += '_'; seen.add(nm); list.push({ name: `stl/${nm}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }); }
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }
  function proNeeds(res) {
    const o = res.options;
    return { tool: 'casehandle', colors: res.colors.length, custom: byId[o.caseId].iface === 'custom', logo: !!o.image };
  }

  const api = { PROFILES, GROOVES, HOLE_SHAPES, PATTERNS, PAT_STYLES, PRESETS, presetOptions, patternLoops, IFACES, CASES, byId, GRIPS, MATERIALS, FITS, TEXT_STYLES, FONTS, PALETTE, LIMITS, DEFAULTS, PIN_H, options, iface, geometry, build, scene, filaments, export3MF, files, readme, proNeeds, gripYZ, legYZ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPCaseHandle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
