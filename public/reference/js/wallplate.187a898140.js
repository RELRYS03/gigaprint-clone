/* Expressarte wall plate generator: North American (NEMA-sized) switch and outlet cover plates, 1 to 6 gangs at
   46.0 mm centers, Standard / Midway / Jumbo outlines, a separate opening per gang (toggle, rocker / decorator,
   duplex, single, blank, coax, phone, keystone, USB / decorator outlet, slide dimmer), countersunk holes for
   #6-32 oval-head screws and 25 front styles, including decorative outlines (capsule, shield, arch, scallop,
   wavy edge) and two-tone borders. Printed face down on a textured plate.
   The plate is one conforming mesh, no booleans: the front is a constrained Delaunay triangulation of the plate
   outline with every opening and countersink as a forced loop, filled with style-dependent sample points and lifted
   by one height function (bevel, crown, texture, text, opening chamfers). Walls join the same loop vertices to the
   back, so the result is closed (watertight) by construction. All sizes in mm; x across the gangs, y up the wall,
   z out of the wall (z = 0 is the wall side). Cosmetic covers only: no listing or certification is implied. */
(function (G) {
  'use strict';
  const dflt = m => (m && typeof m !== 'function' && m.default) || m;
  const Delaunator = dflt(G.Delaunator || (typeof require === 'function' ? require('delaunator') : null));
  const Constrainautor = dflt(G.Constrainautor || (typeof require === 'function' ? require('@kninnug/constrainautor') : null));
  const IN = 25.4;
  const GANG = 46.0; // 1.812 in gang-to-gang (NEMA WD 6 / industry); never changed for looks
  // Outer plate sizes (catalog table, mm). Heights are constant per size class; widths per gang count.
  const SIZES = {
    standard: { label: 'Standard', h: 114.3, edge: 34.9, w: [69.8, 115.9, 161.9, 207.9, 254.0, 300.0] },
    midway: { label: 'Midway', h: 123.8, edge: 39.7, w: [79.4, 125.4, 171.4, 217.5, 263.5, 309.5] },
    jumbo: { label: 'Jumbo', h: 133.3, edge: 44.4, w: [88.9, 134.9, 182.2, 227.0, 273.1, 319.1], derived: [5, 6] }
  };
  // Vertical screw spacings (center to center, mm), from the imperial standards
  const CTC = { toggle: 2.375 * IN, strap: 3.8125 * IN, box: 3.281 * IN };
  const SCREW = { spec: '#6-32 oval head', thru: 4.9, csOD: 8.1, nominalThru: 4.76, nominalCsOD: 7.9, angle: 82 };
  const CLEAR = { tight: 0.15, standard: 0.25, loose: 0.35 };
  const DEVICES = {
    // North America (the first four are the everyday ones and lead the picker)
    duplex: 'Standard outlet (round)', decor: 'Rectangular outlet (Decorator/GFCI)', rocker: 'Rocker switch (rectangular)', toggle: 'Toggle switch (standard)',
    single: 'Single round outlet', blank: 'Blank (no opening)', coax: 'Coax / cable TV', phone: 'Phone jack', keystone: 'Ethernet / keystone', usb: 'USB outlet (decorator size)', dimmer: 'Slide dimmer',
    // UK and Ireland: module front plate (Euro modules) or a surround for an existing one-piece switch or socket
    uk_rocker2: 'Rocker switch (2 modules, 50 \u00d7 50)', uk_rocker1: 'Single rocker (1 module, 25 \u00d7 50)', uk_media: 'USB / data / TV modules (50 \u00d7 50)', uk_blank: 'Blank (no opening)',
    // Europe: cover frame around a square insert
    eu_switch: 'Rocker switch insert', eu_socket: 'Schuko socket insert', eu_data: 'USB / data / TV insert', eu_blank: 'Blank (no opening)',
    // Australia and New Zealand: switch plate with mechanism holes
    au_switch: 'Switch (22 mm mechanism hole)', au_blank: 'Blank position',
    // surround frames (UK and AU: around an existing switch, socket or GPO)
    surround: 'Surround for an existing switch or socket'
  };
  // Country / region systems. Dimensions and sources: docs/wallplate-regions.md.
  const M35 = { spec: 'M3.5 countersunk (ISO 7046)', thru: 4.0, csOD: 7.6, nominalThru: 4.0, nominalCsOD: 7.3, angle: 90 };
  const REGIONS = {
    na: { label: 'North America', short: 'US / Canada', maxGangs: 6, pitch: GANG, kinds: ['plate'], sizes: ['standard', 'midway', 'jumbo'], defSize: 'midway',
      devices: ['duplex', 'decor', 'rocker', 'toggle', 'single', 'blank', 'coax', 'phone', 'keystone', 'usb', 'dimmer'], featured: 4, def: 'rocker', screwNote: '#6-32 oval-head plate screws', volts: '120 V' },
    uk: { label: 'UK & Ireland', short: 'BS 1363 / BS 4662', maxGangs: 2, kinds: ['plate', 'surround'], sizes: ['uk'], defSize: 'uk',
      devices: ['uk_rocker2', 'uk_rocker1', 'uk_media', 'uk_blank'], featured: 4, def: 'uk_rocker2', screwNote: 'M3.5 countersunk screws (60.3 mm centers)', volts: '230 V' },
    eu: { label: 'Europe', short: 'Schuko / DIN 49073', maxGangs: 5, pitch: 71, kinds: ['frame'], sizes: ['eu'], defSize: 'eu',
      devices: ['eu_switch', 'eu_socket', 'eu_data', 'eu_blank'], featured: 4, def: 'eu_switch', screwNote: 'no screws: the insert clamps the frame', volts: '230 V' },
    au: { label: 'Australia & NZ', short: 'AS/NZS 3112', maxGangs: 6, kinds: ['plate', 'surround'], sizes: ['au'], defSize: 'au',
      devices: ['au_switch', 'au_blank'], featured: 2, def: 'au_switch', screwNote: 'M3.5 x 0.8 countersunk screws (84 mm centers)', volts: '230 V' }
  };
  const UK = { plate: { 1: [86, 86], 2: [146, 86] }, fix: { 1: 60.3, 2: 120.6 }, box: { 1: [75, 75], 2: [135, 75] }, gangX: { 1: [0], 2: [-26.5, 26.5] } };
  const EU = { frame: [80.7, 151.8, 223.3, 294.6, 365.9], pitch: 71, inserts: { s55: 55, din50: 50 } };
  const AU = { plate: [73, 115], fix: 84, mech: 22, pitch: 25, accessory: { std: [73, 115], classic: [76, 116] },
    grid: { 1: [[0, 0]], 2: [[-12.5, 0], [12.5, 0]], 3: [[0, 25], [0, 0], [0, -25]], 4: [[-12.5, 12.5], [12.5, 12.5], [-12.5, -12.5], [12.5, -12.5]], 5: [[-12.5, 25], [12.5, 25], [0, 0], [-12.5, -25], [12.5, -25]], 6: [[-12.5, 25], [12.5, 25], [-12.5, 0], [12.5, 0], [-12.5, -25], [12.5, -25]] } };
  const STYLES = [
    ['smooth_bevel', 'Smooth bevel', 'Classic smooth face with a beveled edge'],
    ['flat_modern', 'Flat modern', 'Crisp square edge, thin minimal look'],
    ['rounded_pillow', 'Rounded pillow', 'Soft crowned face'],
    ['stepped_frame', 'Stepped frame', 'Concentric stepped frames'],
    ['fluted_reeded', 'Fluted / reeded', 'Rounded reeds, vertical or horizontal'],
    ['hex_honeycomb', 'Honeycomb', 'Recessed hex cells'],
    ['low_poly_facets', 'Low-poly facets', 'Geometric triangle facets'],
    ['wood_plank', 'Wood plank', 'Plank seams and wood grain'],
    ['brick', 'Brick', 'Running-bond brick with mortar lines'],
    ['art_deco', 'Art deco', 'Sunburst rays and stepped border'],
    ['victorian_border', 'Victorian border', 'Scrolling vine border, smooth center'],
    ['carbon_knurl', 'Diamond knurl', 'Machined diamond knurl'],
    ['greek_key', 'Greek key', 'Classical meander border'],
    ['waves', 'Waves', 'Ripples, radial or linear'],
    ['mountain_skyline', 'Mountain skyline', 'Layered mountain ridges and a sun'],
    ['custom_text', 'Custom text', 'Your words or monogram, engraved'],
    ['topo_lines', 'Topographic lines', 'Contour lines like a trail map'],
    ['capsule_rings', 'Capsule rings', 'Soft capsule outline with concentric rounded grooves'],
    ['scallop_inset', 'Scallop inset', 'Two-tone face with a petal-scalloped border'],
    ['shield_steps', 'Shield steps', 'Elongated shield with angular stepped bands'],
    ['stepped_ripple', 'Stepped ripple', 'Concentric rounded ripples stepping in from the edge'],
    ['arch_frame', 'Arch frame', 'Arched top with rings that follow the window shape'],
    ['sunburst_lines', 'Sunburst lines', 'Radial grooves around the openings'],
    ['wavy_edge', 'Wavy edge', 'Sine-wave outline, one color or two-tone'],
    ['channel_ribs', 'Channel ribs', 'Rounded channels that follow the plate outline']
  ];
  const FREE_STYLES = ['smooth_bevel', 'flat_modern', 'rounded_pillow', 'stepped_frame'];
  // Featured styles sit in the visible picker; the rest go under More styles.
  const FEATURED_STYLES = ['capsule_rings', 'scallop_inset', 'shield_steps', 'stepped_ripple', 'arch_frame', 'sunburst_lines', 'wavy_edge', 'channel_ribs', 'smooth_bevel', 'flat_modern', 'rounded_pillow', 'stepped_frame'];
  const TEXTURED = new Set(['fluted_reeded', 'hex_honeycomb', 'low_poly_facets', 'wood_plank', 'brick', 'art_deco', 'victorian_border', 'carbon_knurl', 'greek_key', 'waves', 'mountain_skyline', 'topo_lines', 'capsule_rings', 'scallop_inset', 'shield_steps', 'stepped_ripple', 'arch_frame', 'sunburst_lines', 'wavy_edge', 'channel_ribs']);
  const FACE_DOWN = new Set(['capsule_rings', 'scallop_inset', 'shield_steps', 'stepped_ripple', 'arch_frame', 'sunburst_lines', 'wavy_edge', 'channel_ribs', 'stepped_frame', 'flat_modern', 'smooth_bevel']);
  const TWO_TONE = new Set(['scallop_inset', 'wavy_edge', 'arch_frame', 'capsule_rings', 'shield_steps']);
  const STYLE_OUTLINE = { capsule_rings: 'pill', scallop_inset: 'scallop', shield_steps: 'hex', arch_frame: 'arch', wavy_edge: 'wavy' };
  // Preview and 3MF filament colors. Users can pick any color; these are the suggested defaults.
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const PALETTE = [
    [PZ.sage, 'Sage'], [PZ.cream, 'Cream'], [PZ.peach, 'Peach'], [PZ.pink, 'Soft pink'], [PZ.mint, 'Mint'], [PZ.babyBlue, 'Baby blue'], [PZ.lavender, 'Lavender'], [PZ.butter, 'Butter yellow'],
    ['#C46A4A', 'Terracotta'], ['#7A9E86', 'Sage green'], ['#2B2D30', 'Black'], ['#F4F1EA', 'White']
  ];
  const DETAIL = { standard: 0.6, hd: 0.42, ultra: 0.3 };
  const PRESETS = [
    { id: 'r1', label: '1-gang rocker \u00b7 Midway', o: { gangs: 1, sizeClass: 'midway', devices: [{ type: 'rocker' }], styleId: 'smooth_bevel' } },
    { id: 't1', label: '1-gang toggle \u00b7 Standard', o: { gangs: 1, sizeClass: 'standard', devices: [{ type: 'toggle' }], styleId: 'smooth_bevel' } },
    { id: 'd1', label: '1-gang duplex outlet \u00b7 Midway', o: { gangs: 1, sizeClass: 'midway', devices: [{ type: 'duplex' }], styleId: 'smooth_bevel' } },
    { id: 'td', label: '2-gang toggle + outlet', o: { gangs: 2, sizeClass: 'midway', devices: [{ type: 'toggle' }, { type: 'duplex' }], styleId: 'smooth_bevel' } },
    { id: 'r3', label: '3-gang triple rocker', o: { gangs: 3, sizeClass: 'midway', devices: [{ type: 'rocker' }, { type: 'rocker' }, { type: 'rocker' }], styleId: 'smooth_bevel' } },
    { id: 'r4', label: '4-gang quad rocker \u00b7 Jumbo', o: { gangs: 4, sizeClass: 'jumbo', devices: [{ type: 'rocker' }, { type: 'rocker' }, { type: 'rocker' }, { type: 'rocker' }], styleId: 'smooth_bevel' } },
    { id: 'd4', label: '4 outlets', o: { gangs: 4, sizeClass: 'midway', devices: [{ type: 'duplex' }, { type: 'duplex' }, { type: 'duplex' }, { type: 'duplex' }], styleId: 'smooth_bevel' } },
    { id: 'k2', label: '1-gang dual keystone', o: { gangs: 1, sizeClass: 'midway', devices: [{ type: 'keystone', keystonePorts: 2 }], styleId: 'smooth_bevel' } },
    { id: 'b1', label: '1-gang blank \u00b7 box mount', o: { gangs: 1, sizeClass: 'midway', devices: [{ type: 'blank', blankMount: 'box' }], styleId: 'smooth_bevel' } },
    { id: 'mix', label: '4-gang rocker + outlet + blank + coax', o: { gangs: 4, sizeClass: 'midway', devices: [{ type: 'rocker' }, { type: 'duplex' }, { type: 'blank' }, { type: 'coax' }], styleId: 'smooth_bevel' } },
    { id: 'uk1', label: 'UK 1-gang rocker plate', o: { region: 'uk', gangs: 1, devices: [{ type: 'uk_rocker2' }], styleId: 'smooth_bevel' } },
    { id: 'uks', label: 'UK double socket surround', o: { region: 'uk', plateKind: 'surround', gangs: 2, styleId: 'smooth_bevel' } },
    { id: 'eu3', label: 'Europe 3-gang frame', o: { region: 'eu', gangs: 3, devices: [{ type: 'eu_switch' }, { type: 'eu_socket' }, { type: 'eu_socket' }], styleId: 'smooth_bevel' } },
    { id: 'au2', label: 'Australia 2-switch plate', o: { region: 'au', gangs: 2, devices: [{ type: 'au_switch' }, { type: 'au_switch' }], styleId: 'smooth_bevel' } },
    { id: 'aus', label: 'Australia GPO surround', o: { region: 'au', plateKind: 'surround', gangs: 1, styleId: 'smooth_bevel' } }
  ];
  const DEFAULTS = {
    gangs: 1, sizeClass: 'midway', devices: null, fitClearance: 'standard',
    faceThickness: 2.5, cornerRadius: 3, bevelProfile: 'chamfer', bevelWidth: 1.5,
    edgeReturnDepth: 7, edgeReturnStyle: 'beveled', returnThickness: 1.6,
    screwMode: 'visible_countersunk', styleId: 'smooth_bevel', style2: 'none', styleMix: 0,
    textureScale: 1, textureDepth: 0.8, borderInset: 5, orientation: 'vertical', detail: 'hd',
    crownHeight: 1.2, stepCount: 2, fluteDir: 'vertical', waveMode: 'radial', seed: 7,
    engraveText: '', engraveMode: 'engrave', engravePosition: 'auto', engraveSize: 6, engraveDepth: 0.6, engraveX: 0, engraveY: 0, textMask: null,
    openingChamfer: 0.3, printFace: 'auto', subplateThickness: 3, subplateClearance: 0.25,
    region: 'na', plateKind: 'plate', euInsert: 's55', axis: 'horizontal', auAccessory: 'std', auMount: 'vertical', surroundBorder: 12, surroundOverlap: 4,
    faceColor: PZ.sage, borderColor: PZ.peach, twoTone: 'auto', bambu: 'A1'
  };

  // ---------------------------------------------------------------- 2D shapes
  // rr: rounded rectangle (w, h overall, corner r); circle; lobe: duplex half (circle cut by flats at +/- hh)
  const rr = (cx, cy, w, h, r) => ({ kind: 'rr', cx, cy, w, h, r: Math.max(0.2, Math.min(r, w / 2 - 0.05, h / 2 - 0.05)) });
  const circ = (cx, cy, R) => ({ kind: 'circle', cx, cy, R });
  const lobe = (cx, cy, R, hh) => ({ kind: 'lobe', cx, cy, R, hh });
  function grow(s, c) {
    if (s.kind === 'rr' || s.kind === 'pill') return Object.assign({}, s, { w: s.w + 2 * c, h: s.h + 2 * c, r: Math.max(0.2, (s.r || Math.min(s.w, s.h) / 2) + c) });
    if (s.kind === 'circle') return circ(s.cx, s.cy, s.R + c);
    if (s.kind === 'hex') {
      const V = offsetPoly(s.V || hexVerts(s), c), xs = V.map(p => p[0]), ys = V.map(p => p[1]);
      return Object.assign({}, s, { V, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    }
    if (s.kind === 'scallop' || s.kind === 'wavy') return Object.assign({}, s, { w: s.w + 2 * c, h: s.h + 2 * c, r: Math.max(0.2, s.r + c), amp: Math.max(0.2, (s.amp || 0) + (c > 0 ? 0 : c * 0.15)) });
    if (s.kind === 'arch') return Object.assign({}, s, { w: s.w + 2 * c, h: s.h + 2 * c, rise: Math.max(4, s.rise + c), r: Math.max(0.2, (s.r || 3) + c) });
    return lobe(s.cx, s.cy, s.R + c, s.hh + c);
  }
  function move(s, dx, dy) { const o = Object.assign({}, s, { cx: s.cx + dx, cy: s.cy + dy }); if (s.V) o.V = s.V.map(p => [p[0] + dx, p[1] + dy]); return o; }
  function sdfRr(s, x, y) {
    const dx = x - s.cx, dy = y - s.cy, r = s.r, qx = Math.abs(dx) - (s.w / 2 - r), qy = Math.abs(dy) - (s.h / 2 - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }
  function sdfConvex(V, x, y) {
    let minD = 1e9, maxS = -1e9;
    for (let i = 0; i < V.length; i++) {
      const ax = V[i][0], ay = V[i][1], bx = V[(i + 1) % V.length][0], by = V[(i + 1) % V.length][1];
      const ex = bx - ax, ey = by - ay, len = Math.hypot(ex, ey) || 1, px = x - ax, py = y - ay;
      const t = sat((px * ex + py * ey) / (len * len));
      minD = Math.min(minD, Math.hypot(px - t * ex, py - t * ey));
      maxS = Math.max(maxS, (px * ey - py * ex) / len);
    }
    return maxS > 0 ? minD : -minD;
  }
  function sdf(s, x, y) {
    const dx = x - s.cx, dy = y - s.cy;
    if (s.kind === 'circle') return Math.hypot(dx, dy) - s.R;
    if (s.kind === 'rr' || s.kind === 'pill') return sdfRr(s, x, y);
    if (s.kind === 'hex') return sdfConvex(s.V || hexVerts(s), x, y);
    if (s.kind === 'scallop' || s.kind === 'wavy') return sdfRr(s, x, y) - (s.amp || 0) * waveAt(s, x, y);
    if (s.kind === 'arch') return sdfArch(s, x, y);
    return Math.max(Math.hypot(dx, dy) - s.R, Math.abs(dy) - s.hh);
  }
  function bounds(s) {
    if (s.kind === 'rr' || s.kind === 'pill' || s.kind === 'arch') return [s.cx - s.w / 2, s.cy - s.h / 2, s.cx + s.w / 2, s.cy + s.h / 2];
    if (s.kind === 'scallop' || s.kind === 'wavy') { const a = s.amp || 0; return [s.cx - s.w / 2 - a, s.cy - s.h / 2 - a, s.cx + s.w / 2 + a, s.cy + s.h / 2 + a]; }
    if (s.kind === 'hex') { const V = s.V || hexVerts(s), xs = V.map(p => p[0]), ys = V.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
    if (s.kind === 'circle') return [s.cx - s.R, s.cy - s.R, s.cx + s.R, s.cy + s.R];
    return [s.cx - s.R, s.cy - s.hh, s.cx + s.R, s.cy + s.hh];
  }
  function extent(s) { const b = bounds(s); return { W: b[2] - b[0], H: b[3] - b[1] }; }
  // Soft capsule (stadium) with a short side flat: radius is a bit under half the short side, our own proportion.
  const pill = (cx, cy, w, h, r) => ({ kind: 'pill', cx, cy, w, h, r: Math.max(0.2, Math.min(r != null ? r : Math.min(w, h) * 0.44, w / 2 - 0.05, h / 2 - 0.05)) });
  function hexVerts(s) {
    const w = s.w / 2, h = s.h / 2, waist = s.waist != null ? s.waist : 0.44;
    if (s.axis === 'horizontal') {
      const x = w * waist;
      return [[s.cx + w, s.cy], [s.cx + x, s.cy + h], [s.cx - x, s.cy + h], [s.cx - w, s.cy], [s.cx - x, s.cy - h], [s.cx + x, s.cy - h]];
    }
    const y = h * waist;
    return [[s.cx + w, s.cy + y], [s.cx, s.cy + h], [s.cx - w, s.cy + y], [s.cx - w, s.cy - y], [s.cx, s.cy - h], [s.cx + w, s.cy - y]];
  }
  const hexagon = (cx, cy, w, h, waist, axis) => { const s = { kind: 'hex', cx, cy, w, h, waist: waist != null ? waist : 0.44, axis: axis || 'vertical' }; s.V = hexVerts(s); return s; };
  const scallop = (cx, cy, w, h, r, opt) => Object.assign({ kind: 'scallop', cx, cy, w, h, r: Math.max(0.2, r || 8), amp: 4.4, freq: 11, mode: 'petal' }, opt || {});
  const wavy = (cx, cy, w, h, r, opt) => Object.assign({ kind: 'wavy', cx, cy, w, h, r: Math.max(0.2, r || 6), amp: 3.1, freq: 8, mode: 'sine' }, opt || {});
  const arch = (cx, cy, w, h) => ({ kind: 'arch', cx, cy, w, h, rise: Math.min(22, h * 0.18, w * 0.28), r: Math.min(6, w / 8, 8) });
  function offsetPoly(V, off) {
    const n = V.length, E = [];
    for (let i = 0; i < n; i++) {
      const a = V[i], b = V[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey) || 1, nx = ey / len, ny = -ex / len;
      E.push([[a[0] + nx * off, a[1] + ny * off], [b[0] + nx * off, b[1] + ny * off]]);
    }
    const O = [];
    for (let i = 0; i < n; i++) {
      const A = E[(i + n - 1) % n], B = E[i], x1 = A[0][0], y1 = A[0][1], x2 = A[1][0], y2 = A[1][1], x3 = B[0][0], y3 = B[0][1], x4 = B[1][0], y4 = B[1][1];
      const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(d) < 1e-12) O.push(B[0]);
      else { const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d; O.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]); }
    }
    return O;
  }
  // Perimeter parameter 0..1 around a rounded rect (used to wave the scallop / wavy outline)
  function periU(s, x, y) {
    const r = s.r, ax = s.w / 2 - r, ay = s.h / 2 - r, dx = x - s.cx, dy = y - s.cy;
    const sl = [s.w - 2 * r, Math.PI / 2 * r, s.h - 2 * r, Math.PI / 2 * r, s.w - 2 * r, Math.PI / 2 * r, s.h - 2 * r, Math.PI / 2 * r];
    const tot = sl.reduce((a, b) => a + b, 0) || 1;
    const ang = (px, py) => Math.atan2(py, px);
    // nearest feature: walk the 4 sides and 4 corners
    let best = 0, bd = 1e9, acc = 0;
    const cand = (u, d) => { if (d < bd) { bd = d; best = u; } };
    // right, top-right, top, top-left, left, bottom-left, bottom, bottom-right
    const segs = [
      () => { const t = sat((dy + ay) / (2 * ay || 1)); cand((acc + t * sl[0]) / tot, Math.abs(dx - (ax + r))); acc += sl[0]; },
      () => { const a = ang(dx - ax, dy - ay); const t = sat(a / (Math.PI / 2)); cand((acc + t * sl[1]) / tot, Math.hypot(dx - ax, dy - ay) - r); acc += sl[1]; },
      () => { const t = sat((ax - dx) / (2 * ax || 1)); cand((acc + t * sl[2]) / tot, Math.abs(dy - (ay + r))); acc += sl[2]; },
      () => { const a = ang(dx + ax, dy - ay) - Math.PI / 2; const t = sat(a / (Math.PI / 2)); cand((acc + t * sl[3]) / tot, Math.hypot(dx + ax, dy - ay) - r); acc += sl[3]; },
      () => { const t = sat((ay - dy) / (2 * ay || 1)); cand((acc + t * sl[4]) / tot, Math.abs(dx + (ax + r))); acc += sl[4]; },
      () => { let a = ang(dx + ax, dy + ay); if (a < 0) a += 2 * Math.PI; const t = sat((a - Math.PI) / (Math.PI / 2)); cand((acc + t * sl[5]) / tot, Math.hypot(dx + ax, dy + ay) - r); acc += sl[5]; }, // atan2 is negative in this quadrant
      () => { const t = sat((dx + ax) / (2 * ax || 1)); cand((acc + t * sl[6]) / tot, Math.abs(dy + (ay + r))); acc += sl[6]; },
      () => { const a = ang(dx - ax, dy + ay) + Math.PI / 2; const t = sat((a < 0 ? a + 2 * Math.PI : a) / (Math.PI / 2)); cand((acc + t * sl[7]) / tot, Math.hypot(dx - ax, dy + ay) - r); acc += sl[7]; }
    ];
    segs.forEach(f => f());
    return best;
  }
  function waveAt(s, x, y) {
    const u = periU(s, x, y), n = s.freq || 10, ph = 0.25;
    const v = Math.sin(2 * Math.PI * (n * u + ph));
    if (s.mode === 'sine') return v;
    // always-outward rounded petals (never cuts in), soft peaks
    return 0.38 + 0.62 * Math.max(0, v) ** 0.75;
  }
  function sdfArch(s, x, y) {
    const rise = Math.max(1, s.rise), r = s.r, bodyH = s.h - rise;
    const body = { cx: s.cx, cy: s.cy - rise / 2, w: s.w, h: bodyH, r };
    const db = sdfRr(body, x, y);
    const ex = x - s.cx, ey = y - (s.cy + s.h / 2 - rise), rx = s.w / 2, ry = rise;
    const px = ex / rx, py = ey / ry, k = px * px + py * py;
    const de = (Math.sqrt(k) - 1) * Math.min(rx, ry);
    if (ey <= 0) return db;
    return Math.min(db, de);
  }
  // Point counts for a shape's loop at a sampling step (fixed per shape so offset copies match vertex for vertex)
  const arcN = (r, step, tol) => Math.max(4, Math.ceil(Math.max((Math.PI / 2) * r / step, (Math.PI / 2) / (2 * Math.acos(Math.max(-1, 1 - tol / Math.max(r, 1e-3)))))));
  function counts(s, step) {
    if (s.kind === 'rr' || s.kind === 'pill') return { nc: arcN(s.r, step, 0.02), nw: Math.max(1, Math.ceil((s.w - 2 * s.r) / step)), nh: Math.max(1, Math.ceil((s.h - 2 * s.r) / step)) };
    if (s.kind === 'circle') return { n: 4 * arcN(s.R, step, 0.02) };
    if (s.kind === 'hex') {
      const V = s.V || hexVerts(s);
      return { ns: V.map((p, i) => Math.max(2, Math.ceil(Math.hypot(V[(i + 1) % V.length][0] - p[0], V[(i + 1) % V.length][1] - p[1]) / step))) };
    }
    if (s.kind === 'scallop' || s.kind === 'wavy') {
      const tight = Math.max(0.28, step * 0.45);
      return { wave: 1, nc: arcN(s.r, tight, 0.015), nw: Math.max(4, Math.ceil((s.w - 2 * s.r) / tight)), nh: Math.max(4, Math.ceil((s.h - 2 * s.r) / tight)) };
    }
    if (s.kind === 'arch') {
      const bodyH = s.h - s.rise, br = Math.min(s.r, s.w / 2 - 0.05, bodyH / 2 - 0.05);
      return { nc: arcN(br, step, 0.02), nw: Math.max(1, Math.ceil((s.w - 2 * br) / step)), nh: Math.max(1, Math.ceil((bodyH - br) / step)), na: Math.max(16, Math.ceil(Math.PI * Math.max(s.w / 2, s.rise) / step)) };
    }
    const a0 = Math.asin(Math.min(0.999, s.hh / s.R));
    return { na: Math.max(6, Math.ceil(Math.max(2 * a0 * s.R / step, 2 * a0 / 0.12))), nf: Math.max(2, Math.ceil(2 * s.R * Math.cos(a0) / step)) };
  }
  function loopRr(s, k) {
    const P = [], ax = s.w / 2 - s.r, ay = s.h / 2 - s.r, r = s.r, { nc, nw, nh } = k;
    const C = [[ax, ay], [-ax, ay], [-ax, -ay], [ax, -ay]];
    for (let q = 0; q < 4; q++) {
      const [ox, oy] = C[q], a0 = q * Math.PI / 2;
      for (let i = 0; i < nc; i++) { const a = a0 + (i / nc) * Math.PI / 2; P.push([s.cx + ox + r * Math.cos(a), s.cy + oy + r * Math.sin(a)]); }
      const [nx, ny] = C[(q + 1) % 4], a1 = a0 + Math.PI / 2, n = q % 2 === 0 ? nw : nh;
      const sx = ox + r * Math.cos(a1), sy = oy + r * Math.sin(a1), ex = nx + r * Math.cos(a1), ey = ny + r * Math.sin(a1);
      for (let i = 0; i < n; i++) P.push([s.cx + sx + (ex - sx) * i / n, s.cy + sy + (ey - sy) * i / n]);
    }
    return P;
  }
  // Counter-clockwise loop of [x, y]
  function loop(s, k) {
    if (s.kind === 'rr' || s.kind === 'pill') return loopRr(s, k);
    if (s.kind === 'circle') { const P = []; for (let i = 0; i < k.n; i++) { const a = 2 * Math.PI * i / k.n; P.push([s.cx + s.R * Math.cos(a), s.cy + s.R * Math.sin(a)]); } return P; }
    if (s.kind === 'hex') {
      const V = s.V || hexVerts(s), ns = k.ns || V.map(() => 8), P = [];
      for (let i = 0; i < V.length; i++) {
        const a = V[i], b = V[(i + 1) % V.length], n = ns[i] || ns[0] || 8;
        for (let j = 0; j < n; j++) P.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
      }
      return P;
    }
    if (s.kind === 'scallop' || s.kind === 'wavy') {
      const base = loopRr(s, k), n = base.length, P = [];
      for (let i = 0; i < n; i++) {
        const a = base[(i + n - 1) % n], b = base[i], c = base[(i + 1) % n];
        const tx = c[0] - a[0], ty = c[1] - a[1], L = Math.hypot(tx, ty) || 1, nx = ty / L, ny = -tx / L;
        const w = (s.amp || 0) * waveAt(s, b[0], b[1]);
        P.push([b[0] + nx * w, b[1] + ny * w]);
      }
      return P;
    }
    if (s.kind === 'arch') {
      const rise = s.rise, bodyH = s.h - rise, br = Math.min(s.r, s.w / 2 - 0.05, Math.max(0.4, bodyH / 2 - 0.05));
      const { nc, nw, nh, na } = k, P = [], cx = s.cx, yb = s.cy - s.h / 2, yt = s.cy + s.h / 2 - rise, ax = s.w / 2 - br, hw = s.w / 2;
      // CCW: start at left side just above the bottom-left corner, go down around the bottom and up the right, then the arch, then down the left
      for (let i = 0; i < nc; i++) { const a = Math.PI + (i / nc) * (Math.PI / 2); P.push([cx - ax + br * Math.cos(a), yb + br + br * Math.sin(a)]); }
      for (let i = 0; i < nw; i++) P.push([cx - ax + (2 * ax) * i / nw, yb]);
      for (let i = 0; i < nc; i++) { const a = -Math.PI / 2 + (i / nc) * (Math.PI / 2); P.push([cx + ax + br * Math.cos(a), yb + br + br * Math.sin(a)]); }
      const yRight0 = yb + br, yRight1 = yt;
      for (let i = 0; i <= nh; i++) P.push([cx + hw, yRight0 + (yRight1 - yRight0) * i / nh]);
      for (let i = 1; i < na; i++) { const a = Math.PI * i / na; P.push([cx + hw * Math.cos(a), yt + rise * Math.sin(a)]); }
      for (let i = 0; i < nh; i++) P.push([cx - hw, yt - (yt - yRight0) * i / nh]);
      return P;
    }
    const P = [], a0 = Math.asin(Math.min(0.999, s.hh / s.R)), { na, nf } = k, xc = s.R * Math.cos(a0);
    for (let i = 0; i < na; i++) { const a = -a0 + 2 * a0 * i / na; P.push([s.cx + s.R * Math.cos(a), s.cy + s.R * Math.sin(a)]); }
    for (let i = 0; i < nf; i++) P.push([s.cx + xc - 2 * xc * i / nf, s.cy + s.hh]);
    for (let i = 0; i < na; i++) { const a = Math.PI - a0 + 2 * a0 * i / na; P.push([s.cx + s.R * Math.cos(a), s.cy + s.R * Math.sin(a)]); }
    for (let i = 0; i < nf; i++) P.push([s.cx - xc + 2 * xc * i / nf, s.cy - s.hh]);
    return P;
  }
  function outlineFor(q, L, outward) {
    const extra = Math.max(0, outward || 0), W = L.W + 2 * extra, H = L.H + 2 * extra, r = q.cornerRadius + extra * 0.15, kind = (q._rectOutline ? 'rect' : (STYLE_OUTLINE[q.styleId] || 'rect'));
    const squat = Math.min(W, H) / Math.max(W, H);
    if (kind === 'pill') return pill(0, 0, W, H, Math.min(W, H) * (squat > 0.86 ? 0.22 : 0.44));
    if (kind === 'hex') return hexagon(0, 0, W, H, squat > 0.86 ? 0.72 : 0.44, H >= W ? 'vertical' : 'horizontal');
    if (kind === 'scallop') return scallop(0, 0, W, H, Math.max(r, 8), { amp: 4.2, freq: Math.max(8, Math.round((2 * (L.W + L.H)) / 30)), mode: 'petal' });
    if (kind === 'wavy') return wavy(0, 0, W, H, Math.max(r, 6), { amp: 3.0, freq: Math.max(6, Math.round((2 * (L.W + L.H)) / 38)), mode: 'sine' });
    if (kind === 'arch') { const s = arch(0, 0, W, H); if (squat > 0.86) s.rise = Math.min(s.rise, H * 0.12, 12); return s; }
    return rr(0, 0, W, H, r);
  }
  function outlineFits(shape, L, q, screws) {
    const bw = Math.max(0.4, q.styleId === 'flat_modern' ? 0.4 : q.bevelWidth), t = q.returnThickness, D = q.edgeReturnDepth;
    const flare = q.edgeReturnStyle === 'beveled' && D > 0 ? Math.min(2.2, D * 0.21) : 0;
    const front = grow(shape, -flare), inner = D > 0 ? grow(shape, -t) : null, need = bw + 0.4;
    const holes = [];
    L.gangs.forEach(g => {
      g.openings.forEach(s => holes.push({ s, kind: 'open' }));
      if (screws) g.screws.forEach(sc => holes.push({ s: circ(sc.x, sc.y, Math.max(sc.csOD, (L.screw || SCREW).csOD) / 2), kind: 'screw' }));
    });
    for (const h of holes) {
      const P = loop(h.s, counts(h.s, 1));
      if (Math.min(...P.map(p => -sdf(front, p[0], p[1]))) < need) return false;
      if (inner) {
        const back = h.kind === 'screw' ? circ(h.s.cx, h.s.cy, (L.screw || SCREW).thru / 2) : h.s, PB = loop(back, counts(back, 1));
        if (Math.min(...PB.map(p => -sdf(inner, p[0], p[1]))) < 0.8) return false;
      }
    }
    return true;
  }
  function fitOutline(q, L, screws) {
    for (let extra = 0; extra <= 14; extra += 1.2) {
      const sh = outlineFor(q, L, extra);
      if (outlineFits(sh, L, q, screws)) return { shape: sh, extra };
    }
    return { shape: rr(0, 0, L.W, L.H, q.cornerRadius), extra: 0 };
  }

  // ---------------------------------------------------------------- devices and layout
  // One gang's device: the opening shapes (nominal, centered on the gang), the screw heights and an optional back
  // pocket that thins the plate locally (keystone jacks snap into about 1.8 mm).
  function device(d) {
    const t = (d && d.type) || 'rocker';
    const strap = [CTC.strap / 2, -CTC.strap / 2], tog = [CTC.toggle / 2, -CTC.toggle / 2], box = [CTC.box / 2, -CTC.box / 2];
    switch (t) {
      case 'toggle': return { shapes: [rr(0, 0, 10.3, 23.8, 2.5)], screws: tog };
      case 'rocker': case 'usb': case 'decor': return { shapes: [rr(0, 0, 33.3, 67.1, 2.4)], screws: strap };
      // UK Euro-module apertures are the published nominal sizes (modules are made to fit them): no extra clearance
      case 'uk_rocker2': case 'uk_media': return { shapes: [Object.assign(rr(0, 0, 50, 50, 0.6), { fixed: true })], screws: [] };
      case 'uk_rocker1': return { shapes: [Object.assign(rr(0, 0, 25, 50, 0.6), { fixed: true })], screws: [] };
      case 'uk_blank': case 'eu_blank': case 'au_blank': return { shapes: [], screws: [] };
      case 'eu_switch': case 'eu_socket': case 'eu_data': { const a = EU.inserts[d.euInsert] || 55; return { shapes: [rr(0, 0, a, a, 1.0)], screws: [] }; }
      case 'au_switch': return { shapes: [Object.assign(circ(0, 0, AU.mech / 2), { fixed: true })], screws: [] };
      case 'duplex': return { shapes: [lobe(0, 19.4, 33.3 / 2, 28.6 / 2), lobe(0, -19.4, 33.3 / 2, 28.6 / 2)], screws: [0], csOD: SCREW.nominalCsOD };
      case 'single': return { shapes: [circ(0, 0, (d.singleSize === 'large' ? 40.4 : 35.7) / 2)], screws: tog };
      case 'blank': return { shapes: [], screws: d.blankMount === 'strap' ? strap : d.blankMount === 'no_holes' ? [] : box };
      case 'coax': return { shapes: [circ(0, 0, ({ small: 9.5, medium: 10.4, large: 15.9 }[d.coaxSize] || 10.4) / 2)], screws: box };
      case 'phone': return { shapes: [d.phoneStyle === 'rj11' ? rr(0, 0, 15, 16.5, 1) : circ(0, 0, 9.5 / 2)], screws: box };
      case 'keystone': {
        const n = Math.max(1, Math.min(4, Math.round(d.keystonePorts || 1))), lay = d.keystoneLayout || (n === 4 ? 'grid' : 'vertical'), P = 22;
        let pos = [];
        if (n === 4 || (lay === 'grid' && n > 2)) pos = [[-P / 2, P / 2], [P / 2, P / 2], [-P / 2, -P / 2], [P / 2, -P / 2]].slice(0, n);
        else if (lay === 'side' && n === 2) pos = [[-P / 2, 0], [P / 2, 0]];
        else for (let i = 0; i < n; i++) pos.push([0, (i - (n - 1) / 2) * P]);
        return { shapes: pos.map(([x, y]) => Object.assign(rr(x, y, 15.0, 19.3, 0.6), { fixed: true })), screws: box, pocket: { margin: 2.4, thick: 1.8 } };
      }
      case 'dimmer': {
        if (d.sliderSlotPreset === 'decorator') return { shapes: [rr(0, 0, 33.3, 67.1, 2.4)], screws: strap };
        return { shapes: [d.sliderSlotPreset === 'wide' ? rr(0, 0, 14.7, 48.3, 3) : rr(0, 0, 12.7, 44.5, 3)], screws: strap };
      }
      default: throw new Error('Unknown device type: ' + t);
    }
  }
  function normalize(o) {
    const q = Object.assign({}, DEFAULTS, o || {});
    if (!REGIONS[q.region]) q.region = 'na';
    const R = REGIONS[q.region];
    if (!R.kinds.includes(q.plateKind)) q.plateKind = R.kinds[0];
    const maxG = q.plateKind === 'surround' ? (q.region === 'uk' ? 2 : 1) : R.maxGangs;
    q.gangs = Math.max(1, Math.min(maxG, Math.round(+q.gangs || 1)));
    if (q.region === 'na') { if (!SIZES[q.sizeClass]) q.sizeClass = 'midway'; } else q.sizeClass = R.defSize;
    if (!EU.inserts[q.euInsert]) q.euInsert = 's55';
    if (q.axis !== 'vertical') q.axis = 'horizontal';
    if (!AU.accessory[q.auAccessory]) q.auAccessory = 'std';
    if (q.auMount !== 'horizontal') q.auMount = 'vertical';
    const surround = q.plateKind === 'surround';
    const dv = surround ? [] : (Array.isArray(q.devices) ? q.devices.slice(0, q.gangs) : []);
    while (dv.length < q.gangs) dv.push({ type: surround ? 'surround' : dv.length ? (typeof dv[dv.length - 1] === 'string' ? dv[dv.length - 1] : dv[dv.length - 1].type) : R.def });
    q.devices = dv.map(d => typeof d === 'string' ? { type: d } : Object.assign({}, d));
    q.devices.forEach(d => {
      if (!DEVICES[d.type]) throw new Error('Unknown device type: ' + d.type);
      if (!surround && !R.devices.includes(d.type)) throw new Error(`${DEVICES[d.type]} is not a ${R.label} device.`);
      if (q.region === 'eu') d.euInsert = q.euInsert;
    });
    if (q.region !== 'na' && q.screwMode === 'hidden_subplate') q.screwMode = 'visible_countersunk';
    if (q.region === 'eu' || surround) q.screwMode = 'none';
    // European frames sit on the insert's support ring; surrounds lie flat on the wall under the accessory
    if (surround) q.edgeReturnDepth = 0;
    else if (q.region === 'eu' && !(o && o.edgeReturnDepth != null)) q.edgeReturnDepth = 8.9; // 11.4 mm deep overall, a typical catalog frame depth
    else if (q.region === 'uk' && !(o && o.faceThickness != null)) q.faceThickness = 2.0;
    const cl = (v, a, b, dv0) => { v = +v; return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : dv0; };
    q.faceThickness = cl(q.faceThickness, 2, 4, 2.5); q.cornerRadius = cl(q.cornerRadius, 1, 8, 3); q.bevelWidth = cl(q.bevelWidth, 0, 3, 1.5);
    q.edgeReturnDepth = cl(q.edgeReturnDepth, 0, 12, 7); q.returnThickness = cl(q.returnThickness, 1.2, 2.5, 1.6);
    q.textureScale = cl(q.textureScale, 0.5, 3, 1); q.textureDepth = cl(q.textureDepth, 0.3, 2, 0.8); q.borderInset = cl(q.borderInset, 2, 12, 5);
    q.styleMix = cl(q.styleMix, 0, 1, 0); q.crownHeight = cl(q.crownHeight, 0.3, 2, 1.2); q.stepCount = Math.round(cl(q.stepCount, 1, 3, 2));
    q.engraveSize = cl(q.engraveSize, 3, 30, 6); q.engraveDepth = cl(q.engraveDepth, 0.4, 1.2, 0.6); q.openingChamfer = cl(q.openingChamfer, 0, 0.6, 0.3);
    q.engraveX = cl(q.engraveX, -200, 200, 0); q.engraveY = cl(q.engraveY, -80, 80, 0);
    q.surroundBorder = cl(q.surroundBorder, 6, 25, 12); q.surroundOverlap = cl(q.surroundOverlap, 3, q.region === 'uk' ? 5 : 6, 4);
    q.subplateThickness = cl(q.subplateThickness, 2.4, 4, 3); q.subplateClearance = cl(q.subplateClearance, 0.1, 0.6, 0.25);
    if (!STYLES.some(s => s[0] === q.styleId)) q.styleId = 'smooth_bevel';
    if (q.style2 !== 'none' && !STYLES.some(s => s[0] === q.style2)) q.style2 = 'none';
    if (!CLEAR[q.fitClearance]) q.fitClearance = 'standard';
    if (!DETAIL[q.detail]) q.detail = 'hd';
    q.engraveText = String(q.engraveText || '').slice(0, 24);
    if (q.styleId === 'custom_text' && !q.engraveText.trim()) q.engraveText = 'HOME';
    const hex = c => { const m = String(c || '').trim().match(/^#?([0-9a-fA-F]{6})$/); return m ? ('#' + m[1].toUpperCase()) : null; };
    q.faceColor = hex(q.faceColor) || DEFAULTS.faceColor;
    q.borderColor = hex(q.borderColor) || DEFAULTS.borderColor;
    if (q.twoTone === true) q.twoTone = 'on';
    if (q.twoTone === false || q.twoTone == null) q.twoTone = 'auto';
    if (q.twoTone !== 'on' && q.twoTone !== 'off') q.twoTone = 'auto';
    q.twoToneOn = q.twoTone === 'on' || (q.twoTone === 'auto' && TWO_TONE.has(q.styleId) && (q.styleId === 'scallop_inset' || q.styleId === 'wavy_edge'));
    if (!q.bambu) q.bambu = 'A1';
    return q;
  }
  function plateSize(sizeClass, gangs, o) {
    const q = o ? normalize(Object.assign({}, o, { sizeClass, gangs })) : null, rg = q ? q.region : 'na';
    if (rg === 'na') { const S = SIZES[sizeClass] || SIZES.midway; return { W: S.w[gangs - 1], H: S.h, edge: S.edge, derived: !!(S.derived && S.derived.includes(gangs)) }; }
    if (q.plateKind === 'surround') { const a = accessory(q), b = q.surroundBorder; return { W: a[0] + 2 * b, H: a[1] + 2 * b, accessory: a }; }
    if (rg === 'uk') { const [W, H] = UK.plate[q.gangs]; return { W, H }; }
    if (rg === 'eu') { const L = EU.frame[q.gangs - 1], S0 = EU.frame[0]; return q.axis === 'vertical' ? { W: S0, H: L } : { W: L, H: S0 }; }
    return { W: AU.plate[0], H: AU.plate[1] };
  }
  // the outline of the existing accessory a surround goes around (W x H as mounted)
  function accessory(q) {
    if (q.region === 'uk') return UK.plate[q.gangs].slice();
    const a = AU.accessory[q.auAccessory]; return q.auMount === 'horizontal' ? [a[1], a[0]] : a.slice();
  }
  function gangX(i, n) { return (i - (n - 1) / 2) * GANG; }
  function gangPos(q, i) {
    const n = q.gangs;
    if (q.region === 'uk') return [UK.gangX[n][i], 0];
    if (q.region === 'eu') { const v = (i - (n - 1) / 2) * EU.pitch; return q.axis === 'vertical' ? [0, -v] : [v, 0]; }
    if (q.region === 'au') return AU.grid[n][i];
    return [gangX(i, n), 0];
  }
  function screwSpec(q) { return q.region === 'na' ? SCREW : M35; }
  // plate-level screws (UK: horizontal at 60.3 / 120.6 mm, AU: vertical at 84 mm); North America has them per gang
  function plateScrews(q) {
    if (q.screwMode === 'none') return [];
    if (q.region === 'uk') { const h = UK.fix[q.gangs] / 2; return [[-h, 0], [h, 0]]; }
    if (q.region === 'au') return [[0, AU.fix / 2], [0, -AU.fix / 2]];
    return [];
  }
  // Everything that is cut through the plate, in plate coordinates (clearance applied)
  function layout(q) {
    const ps = plateSize(q.sizeClass, q.gangs, q), { W, H, derived } = ps, c = CLEAR[q.fitClearance], SP = screwSpec(q);
    const surround = q.plateKind === 'surround';
    if (surround) {
      // one opening: the accessory outline minus the overlap it rests on; the seat (accessory + 0.5 mm) stays flat
      const a = ps.accessory, ov = q.surroundOverlap, hole = rr(0, 0, a[0] - 2 * ov, a[1] - 2 * ov, 2), seat = rr(0, 0, a[0] + 1, a[1] + 1, 1.2);
      const g = { i: 0, x: 0, y: 0, type: 'surround', label: `Surround for a ${a[0]} \u00d7 ${a[1]} mm ${q.region === 'uk' ? (q.gangs === 2 ? 'double ' : 'single ') : ''}switch or socket`, device: { type: 'surround' }, openings: [hole], screws: [], pocket: null };
      return { W, H, derived: false, clearance: c, gangs: [g], seat, accessory: a, screw: SP, region: q.region, kind: 'surround' };
    }
    const gangs = q.devices.map((d, i) => {
      const [x, y] = gangPos(q, i), dev = device(d);
      const openings = dev.shapes.map(s => grow(move(s, x, y), s.fixed ? 0 : c));
      const screws = q.screwMode === 'none' ? [] : dev.screws.map(sy => ({ x, y: y + sy, csOD: dev.csOD || SP.csOD }));
      let pocket = null;
      if (dev.pocket && openings.length) {
        const b = openings.map(bounds), x0 = Math.min(...b.map(v => v[0])), y0 = Math.min(...b.map(v => v[1])), x1 = Math.max(...b.map(v => v[2])), y1 = Math.max(...b.map(v => v[3])), m = dev.pocket.margin;
        pocket = { shape: rr((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0 + 2 * m, y1 - y0 + 2 * m, 1.5), thick: dev.pocket.thick };
      }
      return { i, x, y, type: d.type, label: DEVICES[d.type], device: d, openings, screws, pocket };
    });
    // plate-level screws go with the first gang (they are listed and checked like any other hole)
    plateScrews(q).forEach(([x, y]) => gangs[0].screws.push({ x, y, csOD: SP.csOD }));
    return { W, H, derived, clearance: c, gangs, screw: SP, region: q.region, kind: q.region === 'eu' ? 'frame' : 'plate' };
  }

  // ---------------------------------------------------------------- noise and style patterns
  function hash2(i, j, s) { let h = (i * 374761393 + j * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  const fade = t => t * t * (3 - 2 * t);
  function vnoise(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y), fx = fade(x - i), fy = fade(y - j);
    const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, s, oct) { let v = 0, a = 0.5, f = 1, n = 0; for (let k = 0; k < (oct || 4); k++) { v += a * vnoise(x * f, y * f, s + k * 17); n += a; a *= 0.5; f *= 2.03; } return v / n; }
  const sat = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const sstep = (a, b, v) => { const t = sat((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const fract = v => v - Math.floor(v);
  const tri = v => 1 - Math.abs(2 * fract(v) - 1); // 0 at integers, 1 halfway
  function segDist(px, py, ax, ay, bx, by) { const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy || 1e-12, t = sat(((px - ax) * vx + (py - ay) * vy) / L); return Math.hypot(px - ax - t * vx, py - ay - t * vy); }
  // Greek key meander, one period in unit band coords (u along the border, v across it)
  const KEY = [[0, 0.1, 1, 0.1], [0, 0.95, 1, 0.95], [0.8, 0.1, 0.8, 0.8], [0.8, 0.8, 0.2, 0.8], [0.2, 0.8, 0.2, 0.28], [0.2, 0.28, 0.6, 0.28], [0.6, 0.28, 0.6, 0.62], [0.6, 0.62, 0.4, 0.62], [0.4, 0.62, 0.4, 0.46]];
  // Border band coordinates: distance along the nearest side (u, mm) and across the band (v, 0..1)
  function band(x, y, ctx, inset, bw) {
    const hx = ctx.W / 2 - inset, hy = ctx.H / 2 - inset, ax = Math.abs(x), ay = Math.abs(y);
    const dxs = hx - ax, dys = hy - ay; // distance to the band's outer edge (side lines)
    if (dxs < -0.01 || dys < -0.01) return null;
    const side = dxs < dys ? 'v' : 'h', dist = Math.min(dxs, dys);
    if (dist > bw) return null;
    const corner = dxs < bw && dys < bw;
    return { u: side === 'h' ? x + hx : y + hy, v: dist / bw, corner, cu: bw - dxs, cv: bw - dys };
  }
  // honeycomb: is this cell (nearly) whole inside the patterned area? memoized per build
  function hexCellOk(c, rx, rz, cx, cy, s, wall) {
    if (!c.clear) return true;
    const id = rx + ',' + rz, memo = c.cellMemo || (c.cellMemo = new Map());
    let ok = memo.get(id);
    if (ok === undefined) { const R = (s - wall / 2 + 0.05) * 1.1547; let n = 0; for (let k = 0; k < 6; k++) { if (c.clear(cx + R * Math.cos(k * Math.PI / 3), cy + R * Math.sin(k * Math.PI / 3), -0.8)) n++; if (c.clear(cx + R * 0.866 * Math.cos((k + 0.5) * Math.PI / 3), cy + R * 0.866 * Math.sin((k + 0.5) * Math.PI / 3), -0.8)) n++; } ok = c.clear(cx, cy, 0) && n >= 9; memo.set(id, ok); }
    return ok;
  }
  // sunburst rays begin where neighbors are about 2.6 mm apart, so the middle never crowds into a hatched blob
  const sunR0 = rays => rays * 2.6 / (2 * Math.PI);
  // Each pattern returns a deboss fraction 0..1 (1 = full texture depth); ctx holds the plate, params and helpers
  const PATTERNS = {
    smooth_bevel: () => 0, flat_modern: () => 0, rounded_pillow: () => 0, custom_text: () => 0,
    stepped_frame: (x, y, d, c) => { // outermost frame lowest, stepping up to the flat center on short ramps
      const sw = 3.6 * c.sc, n = c.q.stepCount, r = 0.35; let k = 0;
      for (let i = 1; i <= n; i++) k += sstep(c.inset0 + i * sw - r, c.inset0 + i * sw + r, d);
      return 1 - k / n;
    },
    fluted_reeded: (x, y, d, c) => { const p = 4 * c.sc, u = c.q.fluteDir === 'horizontal' ? y : x; return 1 - Math.sin(Math.PI * fract(u / p + 0.5)); },
    hex_honeycomb: (x, y, d, c) => {
      const s = 4.2 * c.sc, wall = 0.9; // s: center-to-flat distance
      const q = (2 / 3 * x) / s / 1.1547, r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / s / 1.1547;
      // round to the nearest hex center (cube rounding)
      let rx = Math.round(q), ry = Math.round(-q - r), rz = Math.round(r);
      const dx = Math.abs(rx - q), dy = Math.abs(ry + q + r), dz = Math.abs(rz - r);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
      const cx = rx * 1.5 * s * 1.1547, cy = (rz + rx / 2) * Math.sqrt(3) * s * 1.1547;
      const px = Math.abs(x - cx), py = Math.abs(y - cy), hd = Math.max(py, px * 0.866 + py * 0.5); // distance to the hex sides
      // only (nearly) whole cells are recessed: a cell the border, an opening or the text would cut to a fragment stays flat; the rest meet the margin line cleanly
      if (!hexCellOk(c, rx, rz, cx, cy, s, wall)) return 0;
      return 1 - sstep(s - wall / 2 - 0.35, s - wall / 2 + 0.05, hd);
    },
    low_poly_facets: (x, y, d, c) => {
      const f = 11 * c.sc, gx = x / f, gy = y / f, i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j, s = c.q.seed;
      const h = (a, b) => hash2(a, b, s);
      const flip = hash2(i, j, s + 5) < 0.5;
      if (!flip) return u + v < 1 ? h(i, j) + (h(i + 1, j) - h(i, j)) * u + (h(i, j + 1) - h(i, j)) * v : h(i + 1, j + 1) + (h(i, j + 1) - h(i + 1, j + 1)) * (1 - u) + (h(i + 1, j) - h(i + 1, j + 1)) * (1 - v);
      return u > v ? h(i, j) + (h(i + 1, j) - h(i, j)) * u + (h(i + 1, j + 1) - h(i + 1, j)) * v : h(i, j) + (h(i + 1, j + 1) - h(i, j + 1)) * u + (h(i, j + 1) - h(i, j)) * v;
    },
    wood_plank: (x, y, d, c) => {
      const pw = 13 * c.sc, row = Math.floor((y + 500) / pw), vy = (y + 500) - row * pw;
      const seam = 1 - sstep(0.25, 0.75, Math.min(vy, pw - vy));
      const off = hash2(row, 3, c.q.seed) * 90, L = 70 * c.sc, ux = fract((x + off) / L) * L, joint = 1 - sstep(0.25, 0.75, Math.min(ux, L - ux));
      const g = fbm((x + off) / 26, y / 1.1, c.q.seed + row, 4), grain = sstep(0.45, 0.75, g) * 0.45 + 0.12 * vnoise(x / 3, y / 0.5, c.q.seed + 9);
      return Math.max(seam, joint, grain);
    },
    brick: (x, y, d, c) => {
      const bl = 21 * c.sc, bh = 8 * c.sc, m = 0.8, row = Math.floor((y + 500) / bh), vy = (y + 500) - row * bh;
      const ux = fract((x + 500 + (row % 2) * bl / 2) / bl) * bl;
      const e = Math.min(vy, bh - vy, ux, bl - ux);
      return 1 - sstep(m - 0.3, m + 0.15, e);
    },
    art_deco: (x, y, d, c) => {
      const sw = 2.2 * c.sc, inset = c.inset0;
      if (d < inset + 2 * sw) { if (d < inset) return 1; return d < inset + sw ? 0.6 : (d < inset + 1.6 * sw ? 0 : 0.35); }
      const oy = -c.H / 2 + inset, a = Math.atan2(y - oy, x), rays = Math.round(22 / c.sc), f = fract(a / Math.PI * rays);
      const rad = Math.hypot(x, y - oy), w = Math.min(f, 1 - f) * Math.PI / rays * rad; // arc distance to the ray edge
      const ray = Math.floor(a / Math.PI * rays) % 2 === 0 ? sstep(0.15, 0.55, w) * (0.55 + 0.45 * sat(rad / (c.H * 0.8))) : 0;
      const arc = 1 - sstep(0.3, 0.7, Math.abs(rad - c.H * 0.32));
      const arc2 = 1 - sstep(0.3, 0.7, Math.abs(rad - c.H * 0.2));
      return Math.max(ray, arc, arc2 * 0.8, rad < c.H * 0.12 ? 0.9 : 0);
    },
    victorian_border: (x, y, d, c) => {
      const bw = 10 * c.sc, b = band(x, y, c, c.inset0, bw); if (!b) return 0;
      if (b.corner) { const r = Math.hypot(b.cu - bw / 2, b.cv - bw / 2), a = Math.atan2(b.cv - bw / 2, b.cu - bw / 2); const sp = Math.abs(fract((r / (bw * 0.12) - a / (2 * Math.PI))) - 0.5); return r < bw * 0.45 ? 1 - sstep(0.12, 0.3, sp) : 0; }
      const lam = 16 * c.sc, u = b.u / lam, v = b.v, amp = 0.26;
      const f = 0.5 + amp * Math.sin(2 * Math.PI * u), df = amp * 2 * Math.PI * Math.cos(2 * Math.PI * u) / lam * bw;
      const vine = Math.abs(v - f) * bw / Math.sqrt(1 + df * df);
      let k = 1 - sstep(0.35, 0.7, vine);
      // curls inside each bend and beads along both edges
      const uc = fract(u) < 0.5 ? 0.25 : 0.75, sgn = uc === 0.25 ? -1 : 1, cx = (Math.floor(u) + uc) * lam, cy = (0.5 + sgn * 0.02) * bw;
      const r = Math.hypot(b.u - cx, v * bw - cy); if (r < bw * 0.2) k = Math.max(k, 1 - sstep(0.25, 0.55, Math.abs(r - bw * 0.13)));
      const bead = Math.hypot(fract(b.u / (2.4 * c.sc)) * 2.4 * c.sc - 1.2 * c.sc, Math.min(v, 1 - v) * bw - 0.9);
      k = Math.max(k, 1 - sstep(0.4, 0.7, bead));
      return k;
    },
    carbon_knurl: (x, y, d, c) => { const p = 2.6 * c.sc; return 1 - Math.min(tri((x + y) / p), tri((x - y) / p)); },
    greek_key: (x, y, d, c) => {
      const bw = 9 * c.sc, b = band(x, y, c, c.inset0, bw); if (!b) return 0;
      const st = 0.09;
      if (b.corner) { const u = b.cu / bw, v = b.cv / bw; const m = Math.min(Math.abs(u - 0.1), Math.abs(u - 0.95), Math.abs(v - 0.1), Math.abs(v - 0.95)); const inner = Math.max(Math.abs(u - 0.52), Math.abs(v - 0.52)); return Math.max(1 - sstep(st * 0.5, st * 0.5 + 0.05, m), 1 - sstep(0.12, 0.17, Math.abs(inner - 0.2))); }
      const per = bw * 1.0, u = fract(b.u / per), v = 1 - b.v;
      let m = 9; for (const s of KEY) m = Math.min(m, segDist(u, v, s[0], s[1], s[2], s[3]));
      return 1 - sstep(st * 0.5, st * 0.5 + 0.05, m);
    },
    waves: (x, y, d, c) => { const lam = 6 * c.sc, m = c.q.waveMode; const u = m === 'horizontal' ? y + 1.2 * Math.sin(x / (9 * c.sc)) : m === 'vertical' ? x + 1.2 * Math.sin(y / (9 * c.sc)) : Math.hypot(x, y); return (1 - Math.cos(2 * Math.PI * u / lam)) / 2; },
    mountain_skyline: (x, y, d, c) => {
      const base = -c.H / 2 + c.inset0, bh = c.H * 0.42, s = c.q.seed;
      const ridge = (xx, f, amp, sd) => { let h = 0; for (let k = 0; k < 3; k++) { const w = f * Math.pow(2, k); h += Math.pow(0.5, k) * tri(xx / w + hash2(k, sd, s)) * (0.6 + 0.4 * hash2(Math.floor(xx / w), k + sd, s)); } return amp * h / 1.75; };
      const front = base + bh * (0.2 + ridge(x, 34 * c.sc, 0.75, 1)), back = base + bh * (0.42 + ridge(x + 13, 26 * c.sc, 0.7, 2));
      let k = 0;
      if (y < front) k = 1 - 0.6 * sat((y - base) / Math.max(1, front - base)); else if (y < back) k = 0.5 - 0.3 * sat((y - front) / Math.max(1, back - front));
      if (y < front && y > front - 0.9) k = 0.15; // ridge-line highlight
      const sun = Math.hypot(x - c.W * 0.22, y - c.H * 0.26), sr = Math.min(9, c.W * 0.09) * c.sc;
      if (sun < sr) k = Math.max(k, 0.7); else if (sun < sr + 2.2) k = Math.max(k, 1 - sstep(0.3, 0.6, Math.abs(sun - sr - 1.3)) * 0.7);
      return k;
    },
    topo_lines: (x, y, d, c) => {
      const f = (a, b) => fbm(a / (38 * c.sc), b / (38 * c.sc), c.q.seed, 3) * 9;
      const v = f(x, y), e = 0.05, gx = (f(x + e, y) - f(x - e, y)) / (2 * e), gy = (f(x, y + e) - f(x, y - e)) / (2 * e), g = Math.hypot(gx, gy) || 1e-6;
      const dist = Math.abs(fract(v) - 0.5) < 0.5 ? Math.min(fract(v), 1 - fract(v)) / g : 0;
      const idx = Math.round(v), w = idx % 4 === 0 ? 0.55 : 0.35;
      return 1 - sstep(w, w + 0.3, dist);
    },
    // Concentric rounded grooves following the outline (lands stay at the face so it prints face down)
    capsule_rings: (x, y, d, c) => {
      const pitch = 5.6 * c.sc, g = 1.15, u = d - c.inset0 - 1.8;
      if (u < 0) return 0;
      const t = fract(u / pitch) * pitch;
      return 1 - sstep(0.0, 0.45, Math.abs(t - g * 0.5) / (g * 0.5));
    },
    scallop_inset: (x, y, d, c) => {
      // shallow inner highlight ring; the two-tone split carries most of the look
      const ring = 1 - sstep(0.35, 0.75, Math.abs(d - (c.borderW || 9) - 1.2));
      return ring * 0.35;
    },
    shield_steps: (x, y, d, c) => {
      const sw = 3.4 * c.sc, n = Math.max(3, c.q.stepCount + 2), u = d - c.inset0;
      if (u < 0) return 0;
      const i = Math.min(n - 1, Math.floor(u / sw)), f = sat((u - i * sw) / 0.45);
      const lo = 1 - i / n, hi = 1 - (i + 1) / n;
      return lo + (hi - lo) * f;
    },
    stepped_ripple: (x, y, d, c) => {
      // Flat lands at the face (print face down) with rounded recessed ripples between them
      const pitch = 5.0 * c.sc, u = d - c.inset0 * 0.6;
      if (u < 0) return 0;
      const t = fract(u / pitch) * pitch, g = pitch * 0.45;
      return t < g ? 1 - sstep(0.0, 0.4, Math.abs(t - g * 0.5) / (g * 0.5)) : 0;
    },
    arch_frame: (x, y, d, c) => {
      const pitch = 5.4 * c.sc, g = 1.05, u = d - c.inset0 - 1.4;
      if (u < 0) return 0;
      const t = fract(u / pitch) * pitch;
      return 1 - sstep(0.0, 0.4, Math.abs(t - g * 0.5) / (g * 0.5));
    },
    sunburst_lines: (x, y, d, c) => {
      // rays from the plate center, held back from the outer edge and from openings (keep mask is applied later)
      const rays = Math.max(20, Math.round(28 / c.sc)), a = Math.atan2(y, x), rad = Math.hypot(x, y) || 1e-6;
      const f = fract((a / (2 * Math.PI) + 0.5) * rays), w = Math.min(f, 1 - f) * 2 * Math.PI / rays * rad;
      const groove = 1 - sstep(0.22, 0.7, w), r0 = sunR0(rays);
      const inBand = sstep(c.inset0 + 1.5, c.inset0 + 3.2, d) * (1 - sstep(Math.min(c.W, c.H) * 0.42, Math.min(c.W, c.H) * 0.48, rad)) * sstep(r0, r0 + 1.2, rad);
      return groove * inBand;
    },
    wavy_edge: (x, y, d, c) => {
      const pitch = 6.2 * c.sc, g = 0.9, u = d - 2.4;
      if (u < 0) return 0;
      const t = fract(u / pitch) * pitch;
      return (1 - sstep(0.0, 0.4, Math.abs(t - g * 0.5) / (g * 0.5))) * 0.55;
    },
    channel_ribs: (x, y, d, c) => {
      // Rounded channels with flat lands at the face so the plate prints face down
      const p = 4.6 * c.sc, u = d - c.inset0;
      if (u < 0) return 0;
      const t = fract(u / p) * p, g = p * 0.5;
      return t < g ? Math.sin(Math.PI * (t / g)) : 0;
    }
  };
  // Which smooth piece of each geometric pattern (x, y) lies on. The front puts sample points exactly where the label
  // changes (cell walls, mortar lines, facet edges, ray edges), so those edges come out straight instead of stair-stepped.
  // which part of a smooth-step ramp: foot, (lower half, upper half,) top; wide ramps get a crease at their middle too
  const zone = (v, a, b, mid) => v < a ? 0 : v > b ? 3 : mid ? (v < (a + b) / 2 ? 1 : 2) : 1;
  const PATTERN_LABELS = {
    hex_honeycomb: (x, y, d, c) => {
      const s = 4.2 * c.sc, wall = 0.9, q = (2 / 3 * x) / s / 1.1547, r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / s / 1.1547;
      let rx = Math.round(q), ry = Math.round(-q - r), rz = Math.round(r);
      const dx = Math.abs(rx - q), dy = Math.abs(ry + q + r), dz = Math.abs(rz - r);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
      const cx = rx * 1.5 * s * 1.1547, cy = (rz + rx / 2) * Math.sqrt(3) * s * 1.1547, px = Math.abs(x - cx), py = Math.abs(y - cy);
      if (!hexCellOk(c, rx, rz, cx, cy, s, wall)) return 'x'; // a left-out cell is plain flat face
      const z = zone(Math.max(py, px * 0.866 + py * 0.5), s - wall / 2 - 0.35, s - wall / 2 + 0.05);
      return rx + ',' + rz + ':' + z + (z ? (py > px * 0.866 + py * 0.5 ? 'h' : (x > cx) + '' + (y > cy)) : '');
    },
    brick: (x, y, d, c) => {
      const bl = 21 * c.sc, bh = 8 * c.sc, m = 0.8, row = Math.floor((y + 500) / bh), vy = (y + 500) - row * bh;
      const ux = fract((x + 500 + (row % 2) * bl / 2) / bl) * bl, col = Math.floor((x + 500 + (row % 2) * bl / 2) / bl);
      const e = [vy, bh - vy, ux, bl - ux], k = e.indexOf(Math.min(...e));
      return row + ',' + col + ':' + zone(e[k], m - 0.3, m + 0.15) + k;
    },
    carbon_knurl: (x, y, d, c) => { const p = 2.6 * c.sc, a = (x + y) / p, b = (x - y) / p; return Math.floor(a * 2) + ',' + Math.floor(b * 2) + (tri(a) < tri(b) ? 'a' : 'b'); },
    low_poly_facets: (x, y, d, c) => {
      const f = 11 * c.sc, gx = x / f, gy = y / f, i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j, flip = hash2(i, j, c.q.seed + 5) < 0.5;
      return i + ',' + j + (flip ? (u > v ? 'a' : 'b') : (u + v < 1 ? 'a' : 'b'));
    },
    fluted_reeded: (x, y, d, c) => { const p = 4 * c.sc, u = c.q.fluteDir === 'horizontal' ? y : x; return '' + Math.floor(u / p + 0.5); },
    greek_key: (x, y, d, c) => {
      const bw = 9 * c.sc, b = band(x, y, c, c.inset0, bw); if (!b) return 'n';
      const st = 0.09;
      // the nearest line is part of the label, so the thin ridge between two close lines is found too
      if (b.corner) { const u = b.cu / bw, v = b.cv / bw, L = [Math.abs(u - 0.1), Math.abs(u - 0.95), Math.abs(v - 0.1), Math.abs(v - 0.95)], m = Math.min(...L), inner = Math.max(Math.abs(u - 0.52), Math.abs(v - 0.52)); return 'c' + L.indexOf(m) + zone(m, st * 0.5, st * 0.5 + 0.05, true) + zone(Math.abs(inner - 0.2), 0.12, 0.17) + (inner > 0.2); }
      const u = fract(b.u / bw), v = 1 - b.v; let m = 9, k = -1; KEY.forEach((sg, i) => { const e = segDist(u, v, sg[0], sg[1], sg[2], sg[3]); if (e < m) { m = e; k = i; } });
      return 'b' + Math.floor(b.u / bw) + ':' + (m < st * 0.5 ? '' : k) + zone(m, st * 0.5, st * 0.5 + 0.05, true);
    },
    art_deco: (x, y, d, c) => {
      const sw = 2.2 * c.sc, inset = c.inset0;
      if (d < inset + 2 * sw) return 'f' + (d < inset ? 0 : d < inset + sw ? 1 : d < inset + 1.6 * sw ? 2 : 3);
      const oy = -c.H / 2 + inset, a = Math.atan2(y - oy, x), rays = Math.round(22 / c.sc), f = fract(a / Math.PI * rays);
      const rad = Math.hypot(x, y - oy), w = Math.min(f, 1 - f) * Math.PI / rays * rad, ri = Math.floor(a / Math.PI * rays);
      return ri + ':' + (ri % 2 === 0 ? zone(w, 0.15, 0.55, true) + (f < 0.5) : 'x') + zone(Math.abs(rad - c.H * 0.32), 0.3, 0.7) + (rad > c.H * 0.32) + zone(Math.abs(rad - c.H * 0.2), 0.3, 0.7) + (rad > c.H * 0.2) + (rad < c.H * 0.12 ? 'd' : '');
    },
    sunburst_lines: (x, y, d, c) => {
      const rays = Math.max(20, Math.round(28 / c.sc)), rad = Math.hypot(x, y); if (rad < sunR0(rays)) return 'c';
      const f = fract((Math.atan2(y, x) / (2 * Math.PI) + 0.5) * rays), w = Math.min(f, 1 - f) * 2 * Math.PI / rays * rad;
      return Math.floor((Math.atan2(y, x) / (2 * Math.PI) + 0.5) * rays) + ':' + zone(w, 0.22, 0.7);
    }
  };
  // Which ring distances (from the front outline) the front needs as crisp edges
  function styleRings(q, ctx) {
    const R = [];
    if (q.styleId === 'art_deco') { const sw = 2.2 * ctx.sc, i = ctx.inset0; for (const v of [i, i + sw, i + 1.6 * sw, i + 2 * sw]) R.push(v - 0.04, v + 0.04); }
    if (q.styleId === 'channel_ribs') { const pitch = 4.6 * ctx.sc; for (let k = 0; k < 10; k++) R.push(ctx.inset0 + k * pitch, ctx.inset0 + k * pitch + pitch / 2); }
    return R;
  }

  // Narrow grooves that follow the outline, as { c: distance in from the front edge to the groove center, hw: half
  // width where the groove meets the face }. The front gets sample rings across each groove (edges, flanks, bottom)
  // and no grid points inside it, so the groove edges come out as smooth lines instead of grid stair-steps.
  function styleBands(q, ctx) {
    const B = [], dMax = Math.min(ctx.W, ctx.H) / 2, sc = ctx.sc, id = q.styleId;
    const run = (start, pitch, center, hw) => { for (let k = 0; k < 80; k++) { const c = start + k * pitch + center; if (c - hw > dMax) break; B.push({ c, hw }); } };
    if (id === 'capsule_rings') run(ctx.inset0 + 1.8, 5.6 * sc, 1.15 / 2, 0.45 * 1.15 / 2);
    if (id === 'arch_frame') run(ctx.inset0 + 1.4, 5.4 * sc, 1.05 / 2, 0.4 * 1.05 / 2);
    if (id === 'wavy_edge') run(2.4, 6.2 * sc, 0.9 / 2, 0.4 * 0.9 / 2);
    if (id === 'stepped_ripple') { const p = 5.0 * sc, g = p * 0.45; run(ctx.inset0 * 0.6, p, g / 2, 0.4 * g / 2); }
    if (id === 'scallop_inset') B.push({ c: (ctx.borderW || 9) + 1.2, hw: 0.75, flat: 0.35 });
    if (id === 'stepped_frame') { const sw = 3.6 * sc; for (let i = 1; i <= q.stepCount; i++) B.push({ c: ctx.inset0 + i * sw, hw: 0.35 }); }
    if (id === 'shield_steps') { // a short wall where the steps start, then a linear 0.45 mm ramp up to each step
      const sw = 3.4 * sc, n = Math.max(3, q.stepCount + 2); B.push({ c: ctx.inset0 - 0.06, hw: 0.04, F: [0] });
      for (let k = 0; k < n; k++) B.push({ c: ctx.inset0 + k * sw + 0.225, hw: 0.225, F: k ? [-1, -0.5, 0, 0.5, 1] : [-0.9, -0.5, 0, 0.5, 1] });
    }
    return B;
  }
  // Points along the edges and bottom of each sunburst ray (radial grooves), plus the angular half width to keep the
  // grid out of them
  function rayPoints(q, ctx, step, ok, zf, chains) {
    const P = [], rays = Math.max(20, Math.round(28 / ctx.sc)), rMax = Math.min(ctx.W, ctx.H) * 0.48, W7 = [-0.7, -0.46, -0.22, 0, 0.22, 0.46, 0.7];
    for (let k = 0; k < rays; k++) {
      const a0 = (k / rays - 0.5) * 2 * Math.PI, edge = [[], []];
      const cut = i => { if (edge[i].length > 1) chains.push(edge[i]); edge[i] = []; };
      for (let rad = sunR0(rays) + 0.6; rad <= rMax; rad += step) W7.forEach((w, wi) => {
        const a = a0 + w / rad, x = rad * Math.cos(a), y = rad * Math.sin(a), ei = wi === 0 ? 0 : wi === 6 ? 1 : -1;
        if (ok(x, y)) { const v = [x, y, zf(x, y)]; P.push(v); if (ei >= 0) edge[ei].push(v); } else if (ei >= 0) cut(ei);
      });
      cut(0); cut(1);
    }
    return P;
  }
  // ---------------------------------------------------------------- text (engraving mask)
  // A mask is { w, h, data (0..255, row 0 at the top), mmW, mmH }; the browser makes one from a canvas font, Node
  // (and the fallback) from the 3 x 5 pixel font in core.js, if present.
  const PIX = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110', '-': '000000111000000', '.': '000000000000010', '&': '010101010101011', '!': '010010010000010', "'": '010010000000000', ' ': '000000000000000' };
  function pixelMask(str) {
    const s = String(str).toUpperCase(), cell = 6, W = s.length * 4 * cell, H = 5 * cell, data = new Uint8Array(Math.max(1, W * H));
    for (let ci = 0; ci < s.length; ci++) { const g = PIX[s[ci]] || PIX[' ']; for (let r = 0; r < 5; r++) for (let cc = 0; cc < 3; cc++) if (g[r * 3 + cc] === '1') for (let yy = 0; yy < cell; yy++) for (let xx = 0; xx < cell; xx++) data[(r * cell + yy) * W + (ci * 4 + cc) * cell + xx] = 255; }
    return { w: W, h: H, data, aspect: W / H };
  }
  function textPlace(q, L, inset) {
    if (!q.engraveText.trim()) return null;
    const m = q.textMask && q.textMask.w ? q.textMask : pixelMask(q.engraveText.trim());
    const h = q.engraveSize, w = h * (m.aspect || m.w / m.h);
    let cx = 0, cy = 0;
    const top = [], low = [];
    L.gangs.forEach(g => { g.openings.forEach(s => { const b = bounds(s); top.push(b[3]); low.push(b[1]); }); g.screws.forEach(s => { if (s.y > 0.1) top.push(-1e9), low.push(1e9); }); });
    const openTop = Math.max(0, ...L.gangs.flatMap(g => g.openings.map(s => bounds(s)[3])));
    const screwLow = Math.min(L.H / 2 - inset, ...L.gangs.flatMap(g => g.screws.filter(s => s.y > 0.1).map(s => s.y - s.csOD / 2)));
    const pos = q.engravePosition;
    if (L.kind === 'surround' && pos !== 'custom') { // in the border below (or above) the accessory
      const mid = (L.H / 2 + L.seat.h / 2) / 2;
      return { m, x0: -w / 2, y0: (pos === 'top' ? mid : -mid) - h / 2, w, h, mode: q.engraveMode, depth: q.engraveDepth };
    }
    if (pos === 'custom') { cx = q.engraveX; cy = q.engraveY; }
    else if (pos === 'center') { cx = 0; cy = 0; }
    else if (pos === 'bottom') { cy = -((openTop + 2 + (screwLow - 2)) / 2); }
    else { // top / auto: the band between the openings and the screws, else above the screws
      const gap = (screwLow - 2) - (openTop + 2);
      cy = gap >= h ? (openTop + 2 + screwLow - 2) / 2 : (L.H / 2 - inset - h / 2 - 1);
      if (pos === 'auto' && !L.gangs.some(g => g.openings.length) ) cy = 0;
    }
    return { m, x0: cx - w / 2, y0: cy - h / 2, w, h, mode: q.engraveMode, depth: q.engraveDepth };
  }
  function sampleMask(t, x, y) {
    const u = (x - t.x0) / t.w, v = 1 - (y - t.y0) / t.h; if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const m = t.m, fx = u * (m.w - 1), fy = v * (m.h - 1), i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j;
    const g = (ii, jj) => m.data[Math.min(m.h - 1, jj) * m.w + Math.min(m.w - 1, ii)] / 255;
    return (g(i, j) * (1 - a) + g(i + 1, j) * a) * (1 - b) + (g(i, j + 1) * (1 - a) + g(i + 1, j + 1) * a) * b;
  }

  // ---------------------------------------------------------------- triangulation
  // Long straight runs of evenly spaced points (hex sides, flat plate edges) are collinear only up to rounding, and the
  // constrained triangulation can stall on them; a retry nudges the triangulation copy of the points by a few nanometers
  // (the mesh keeps the exact points), which breaks the ties without changing the shape.
  // cons[0 .. nb) are region boundaries (they flip inside / outside); any after nb are crease lines inside the region
  function cdt(xy, cons, nb) {
    let del, con;
    if (nb == null) nb = cons.length;
    const N = xy.length / 2, bset = new Set(); for (let i = 0; i < nb; i++) { const a = cons[i][0], b = cons[i][1]; bset.add(a < b ? a * N + b : b * N + a); }
    for (let attempt = 0; ; attempt++) {
      let pts = xy;
      if (attempt) { pts = new Float64Array(xy.length); for (let i = 0; i < xy.length; i++) pts[i] = xy[i] + (hash2(i, attempt, 911) - 0.5) * 2e-6 * attempt; }
      del = new Delaunator(pts); con = new Constrainautor(del);
      try { for (const e of cons) con.constrainOne(e[0], e[1]); break; } catch (err) { if (attempt >= 3) throw err; }
    }
    const Tr = del.triangles, Hh = del.halfedges, nt = Tr.length / 3, par = new Int8Array(nt).fill(-1), q = new Int32Array(nt);
    const isB = nb === cons.length ? e => con.isConstrained(e) : e => { if (!con.isConstrained(e)) return false; const a = Tr[e], b = Tr[e % 3 === 2 ? e - 2 : e + 1]; return bset.has(a < b ? a * N + b : b * N + a); };
    let qh = 0, qt = 0;
    for (let e = 0; e < Tr.length; e++) if (Hh[e] < 0) { const t = (e / 3) | 0; if (par[t] < 0) { par[t] = isB(e) ? 1 : 0; q[qt++] = t; } }
    while (qh < qt) {
      const t = q[qh++];
      for (let k = 0; k < 3; k++) { const e = 3 * t + k, o = Hh[e]; if (o < 0) continue; const u = (o / 3) | 0; if (par[u] >= 0) continue; par[u] = par[t] ^ (isB(e) ? 1 : 0); q[qt++] = u; }
    }
    if (qt !== nt) throw new Error('wall plate: triangulation did not close');
    return { T: Tr, par };
  }
  const STATS = { creaseFallback: 0, creaseDropped: 0, front: null }; // for tests: how often crease lines had to be dropped
  // Triangle soup writer
  function Soup() { this.a = []; }
  Soup.prototype.tri = function (A, B, C) { this.a.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]); };
  // Flat or lifted region: loops (arrays of [x, y, z]) + extra points; up = true faces +z
  // Drop crease segments that cross another segment or pass (nearly) through a point: those would stall the
  // constrained triangulation. Grid-bucketed, so it stays linear in practice.
  function cleanCreases(P, cons, nb) {
    const cell = 1.0, G2 = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
    const put = (k, v) => { let a = G2.get(k); if (!a) G2.set(k, a = []); a.push(v); };
    const cellsOf = (a, b, f) => { const x0 = Math.floor(Math.min(a[0], b[0]) / cell), x1 = Math.floor(Math.max(a[0], b[0]) / cell), y0 = Math.floor(Math.min(a[1], b[1]) / cell), y1 = Math.floor(Math.max(a[1], b[1]) / cell); for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) f(key(i, j)); };
    cons.forEach((c, ci) => cellsOf(P[c[0]], P[c[1]], k => put(k, ci)));
    const PT = new Map(); P.forEach((v, i) => { const k = key(Math.floor(v[0] / cell), Math.floor(v[1] / cell)); let a = PT.get(k); if (!a) PT.set(k, a = []); a.push(i); });
    const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const bad = new Set();
    for (let ci = nb; ci < cons.length; ci++) {
      const [ia, ib] = cons[ci], A = P[ia], B = P[ib], len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1e-9;
      let hit = false;
      cellsOf(A, B, k => {
        if (hit) return;
        for (const cj of G2.get(k) || []) {
          if (cj === ci) continue; const [ja, jb] = cons[cj]; if (ja === ia || ja === ib || jb === ia || jb === ib) continue;
          const C = P[ja], D = P[jb], d1 = orient(A, B, C), d2 = orient(A, B, D), d3 = orient(C, D, A), d4 = orient(C, D, B);
          const e = 1e-12 * (1 + len * len);
          if (Math.abs(d1) < e && Math.abs(d2) < e) { // collinear: only an overlap counts
            const u = v => ((v[0] - A[0]) * (B[0] - A[0]) + (v[1] - A[1]) * (B[1] - A[1])) / (len * len), uc = u(C), ud = u(D);
            if (Math.max(uc, ud) > 1e-9 && Math.min(uc, ud) < 1 - 1e-9) { hit = true; return; }
            continue;
          }
          if ((d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0) && Math.abs(d1) > e && Math.abs(d2) > e && Math.abs(d3) > e && Math.abs(d4) > e) { hit = true; return; }
        }
        for (const pi of PT.get(k) || []) {
          if (pi === ia || pi === ib) continue; const Q = P[pi];
          const t = ((Q[0] - A[0]) * (B[0] - A[0]) + (Q[1] - A[1]) * (B[1] - A[1])) / (len * len);
          if (t > 0 && t < 1 && Math.abs(orient(A, B, Q)) / len < 2e-3) { hit = true; return; }
        }
      });
      if (hit) bad.add(ci);
    }
    STATS.creaseDropped += bad.size;
    if (bad.size) { const keep = cons.filter((c, i) => i < nb || !bad.has(i)); cons.length = 0; for (const c of keep) cons.push(c); }
  }
  // chains: optional runs of extra points to keep as crease lines (groove edges), so no triangle cuts across them
  function fillRegion(out, loops, extra, up, chains) {
    const P = []; const cons = [];
    for (const L of loops) { const s = P.length; for (const v of L) P.push(v); for (let i = 0; i < L.length; i++) cons.push([s + i, s + (i + 1) % L.length]); }
    // sample points that land within 0.01 mm of a loop vertex or of each other (two rings at the same offset) are
    // dropped: once the STL rounds to 32-bit floats they would merge into zero-area, non-manifold triangles
    if (extra && extra.length) {
      const tol = 0.01, cell = new Map(), kx = v => Math.round(v / tol) + 262144, ck = (i, j) => i * 524288 + j;
      const near = v => { const i = kx(v[0]), j = kx(v[1]); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = cell.get(ck(i + a, j + b)); if (c) for (const w of c) if (Math.abs(w[0] - v[0]) < tol && Math.abs(w[1] - v[1]) < tol) return true; } return false; };
      const add = v => { const k = ck(kx(v[0]), kx(v[1])); const c = cell.get(k); if (c) c.push(v); else cell.set(k, [v]); };
      for (const v of P) add(v);
      const idx = chains && chains.length ? new Map() : null;
      for (const v of extra) if (!near(v)) { add(v); if (idx) idx.set(v, P.length); P.push(v); }
      if (idx) for (const ch of chains) for (let i = 0; i < ch.length; i++) {
        const a = idx.get(ch[i]), b = idx.get(ch[(i + 1) % ch.length]);
        if (a != null && b != null && a !== b && (i + 1 < ch.length || ch.closed)) cons.push([a, b]);
      }
    }
    const nb = loops.reduce((a, L) => a + L.length, 0);
    if (cons.length > nb) cleanCreases(P, cons, nb);
    const xy = new Float64Array(P.length * 2); P.forEach((v, i) => { xy[2 * i] = v[0]; xy[2 * i + 1] = v[1]; });
    let res;
    try { res = cdt(xy, cons, nb); } catch (e) { if (cons.length === nb) throw e; STATS.creaseFallback++; res = cdt(xy, cons.slice(0, nb), nb); } // crease lines are a nicety
    const { T: Tr, par } = res;
    let n = 0;
    for (let t = 0; t < Tr.length / 3; t++) {
      if (!(par[t] & 1)) continue;
      const A = P[Tr[3 * t]], B = P[Tr[3 * t + 1]], C = P[Tr[3 * t + 2]];
      const ar = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if ((ar > 0) === up) out.tri(A, B, C); else out.tri(A, C, B);
      n++;
    }
    return n;
  }
  // Wall strip between two rings of the same count; the solid is on the left of the loop direction, upper above lower
  function strip(out, U, Lw) { const n = U.length; for (let i = 0; i < n; i++) { const j = (i + 1) % n; out.tri(U[i], Lw[i], Lw[j]); out.tri(U[i], Lw[j], U[j]); } }
  const lift = (L, z) => L.map(p => [p[0], p[1], typeof z === 'function' ? z(p[0], p[1]) : z]);

  // ---------------------------------------------------------------- validation
  function validate(q, L, ctx) {
    const errors = [], warnings = [];
    const holes = [];
    L.gangs.forEach(g => {
      g.openings.forEach((s, k) => holes.push({ g: g.i, s, name: `${g.label} opening`, kind: 'open' }));
      g.screws.forEach(sc => holes.push({ g: g.i, s: circ(sc.x, sc.y, Math.max(sc.csOD, (L.screw || SCREW).csOD) / 2), name: 'screw countersink', kind: 'screw' }));
    });
    const front = ctx.front;
    for (const h of holes) {
      // the front: clear of the bevel; the back: the through part clear of the inner face of the return lip
      const P = loop(h.s, counts(h.s, 1));
      const inner = Math.min(...P.map(p => -sdf(front, p[0], p[1])));
      const need = ctx.bw + 0.4;
      const back = h.kind === 'screw' ? circ(h.s.cx, h.s.cy, (L.screw || SCREW).thru / 2) : h.s, PB = loop(back, counts(back, 1));
      const lip = ctx.innerD ? Math.min(...PB.map(p => -sdf(ctx.innerD, p[0], p[1]))) : 9;
      if (inner < need || lip < 0.8) errors.push(`Gang ${h.g + 1}: the ${h.name} runs too close to the plate edge (${Math.min(inner, lip).toFixed(1)} mm). Try a bigger size class or a thinner return.`);
    }
    for (let a = 0; a < holes.length; a++) for (let b = a + 1; b < holes.length; b++) {
      const A = holes[a], B = holes[b];
      const P = loop(A.s, counts(A.s, 0.5)), m = Math.min(...P.map(p => sdf(B.s, p[0], p[1])));
      const need = A.kind === 'screw' || B.kind === 'screw' ? 0.6 : 2.0;
      if (m < need) errors.push(`Gang ${A.g + 1}${A.g !== B.g ? ` and gang ${B.g + 1}` : ''}: openings are ${Math.max(0, m).toFixed(1)} mm apart (need ${need} mm of plastic).`);
    }
    if (ctx.text) {
      const t = ctx.text;
      if (t.x0 < -L.W / 2 + ctx.bw || t.x0 + t.w > L.W / 2 - ctx.bw || t.y0 < -L.H / 2 + ctx.bw || t.y0 + t.h > L.H / 2 - ctx.bw) warnings.push('The text runs past the plate face; it is trimmed. Make it smaller or move it.');
      if (holes.some(h => sdf(h.s, t.x0 + t.w / 2, t.y0 + t.h / 2) < t.h / 2)) warnings.push('Part of the text falls on an opening or screw and is left out there. Move it or change the position.');
    }
    if (L.kind === 'surround') {
      const hole = L.gangs[0].openings[0], box = q.region === 'uk' ? UK.box[q.gangs] : null;
      if (box && (hole.w < box[0] + 1 || hole.h < box[1] + 1)) errors.push(`The surround's hole (${hole.w.toFixed(1)} \u00d7 ${hole.h.toFixed(1)} mm) must clear the ${box[0]} \u00d7 ${box[1]} mm back box: use a smaller overlap.`);
      if (q.region === 'au') warnings.push(`Check that the ${hole.w.toFixed(0)} \u00d7 ${hole.h.toFixed(0)} mm hole clears your wall box or mounting bracket before printing.`);
    }
    if (L.derived) warnings.push(`${L.gangs.length}-gang Jumbo width is derived (catalog rows vary): ${L.W.toFixed(1)} mm.`);
    if (q.faceThickness < 2.2 && L.gangs.some(g => g.type === 'keystone')) warnings.push('Keystone jacks snap into about 1.8 mm; the plate is already thin there.');
    return { errors, warnings };
  }

  // ---------------------------------------------------------------- the plate
  function build(o) {
    const q = normalize(o), L = layout(q);
    const sub = q.screwMode === 'hidden_subplate';
    let cover;
    try { cover = plate(q, L, { screws: !sub }); }
    catch (e) {
      if (!STYLE_OUTLINE[q.styleId] || q._rectOutline) throw e;
      // a sample point can land on a sharp outline corner; a slightly shifted grid keeps the decorative outline
      for (const j of [0.97, 1.03, 0.93]) { try { cover = plate(Object.assign({}, q, { _stepJitter: j }), L, { screws: !sub }); break; } catch (e2) { cover = null; } }
    }
    if (!cover) {
      const q2 = Object.assign({}, q, { _rectOutline: true });
      cover = plate(q2, L, { screws: !sub });
      cover.warnings = (cover.warnings || []).concat(['The decorative outline was relaxed so openings stay clear of the edge.']);
    }
    const res = { options: q, layout: summary(q, L), W: L.W, H: L.H, depth: cover.depth, body: cover.p, warnings: cover.warnings, triangles: cover.p.length / 9, print: cover.print, printFace: cover.printFace, color: q.faceColor, parts: [{ name: 'wall_plate', label: 'Wall plate', p: cover.p, print: cover.print, color: q.faceColor, role: 'plate' }] };
    if (cover.border) {
      const zmax = Math.max(cover.depth, cover.border.depth || 0);
      const faceP = cover.p, borderP = cover.border.p;
      const facePrint = q.printFace === 'up' || cover.printFace === 'up' ? faceP : faceDown(faceP, zmax);
      const borderPrint = q.printFace === 'up' || cover.printFace === 'up' ? borderP : faceDown(borderP, zmax);
      res.parts = [
        { name: 'plate_face', label: 'Face', p: faceP, print: facePrint, color: q.faceColor, role: 'face' },
        { name: 'plate_border', label: 'Border', p: borderP, print: borderPrint, color: q.borderColor, role: 'border' }
      ];
      res.body = concatMesh(faceP, borderP);
      res.print = concatMesh(facePrint, borderPrint);
      res.triangles = res.body.length / 9;
      res.depth = zmax;
      res.printFace = cover.printFace;
      res.twoTone = true;
    }
    if (sub) {
      const s = subplate(q, L, cover);
      res.subplate = s; res.parts.push({ name: 'sub_plate', label: 'Sub-plate (screws to the devices)', p: s.p, print: s.print, role: 'subplate' });
    }
    res.filaments = filamentsOf(res);
    return res;
  }
  function concatMesh(a, b) { const o = new Float64Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }
  function filamentsOf(res) {
    const cols = [], seen = new Set();
    res.parts.forEach(pt => { const c = (pt.color || res.color || '#F4F1EA').toUpperCase(); if (!seen.has(c)) { seen.add(c); cols.push({ role: pt.role || pt.name, color: c }); } });
    return cols;
  }
  function summary(q, L) {
    return { W: L.W, H: L.H, sizeClass: q.sizeClass, region: q.region, kind: L.kind, sizeLabel: sizeLabel(q), screw: (L.screw || SCREW).spec, accessory: L.accessory || null, gangs: L.gangs.map(g => ({ x: g.x, y: g.y || 0, type: g.type, label: g.label, openings: g.openings.map(s => Object.assign({}, s)), screws: g.screws.map(s => ({ x: s.x, y: s.y })), pocket: g.pocket ? g.pocket.thick : null })), clearance: L.clearance };
  }
  // opt.screws: countersunk holes; opt.flat: { T, outline shape } for the screwed sub-plate (flat, no return, no style)
  function plate(q, L, opt) {
    const flat = !!opt.flat;
    const T = flat ? opt.flat.T : q.faceThickness, D = flat ? 0 : q.edgeReturnDepth, t = q.returnThickness;
    const style = flat ? 'flat_modern' : q.styleId, textured = !flat && (TEXTURED.has(style) || (q.style2 !== 'none' && q.styleMix > 0 && TEXTURED.has(q.style2)));
    const twoTone = !flat && q.twoToneOn;
    const borderW = twoTone ? Math.max(7, Math.min(12, q.borderInset + 3.5)) : 0;
    // Face and return stay on the catalog outline so screws and the box keep their margins.
    // Two-tone and petal/wave styles grow a decorative border outward from that core.
    // Two-tone face is the catalog rounded rectangle so the color split stays a clean,
    // non-crossing ring; capsule / shield / arch keep their own catalog outline as the face.
    const waveBorder = twoTone && (q.styleId === 'scallop_inset' || q.styleId === 'wavy_edge');
    const fitted = flat ? { shape: opt.flat.shape, extra: 0 } : (waveBorder ? { shape: rr(0, 0, L.W, L.H, q.cornerRadius), extra: 0 } : fitOutline(q, L, !!opt.screws));
    const core = fitted.shape;
    const full = flat ? core : outlineFor(q, L, (twoTone ? borderW : 0) + (fitted.extra || 0));
    const base = core;
    // outer side wall: inset from the nominal outline (at the wall) as the side rises to the front edge
    let bw = flat ? 0.4 : style === 'flat_modern' ? 0.4 : q.bevelWidth, prof = flat || style === 'flat_modern' ? 'chamfer' : q.bevelProfile;
    if (prof === 'none') bw = 0;
    if (twoTone) { bw = Math.min(bw, 0.8); if (prof === 'ogee') prof = 'chamfer'; }
    const drop = bw > 0 ? Math.min(bw * (style === 'flat_modern' || flat ? 0.75 : 1), T - 0.9) : 0;
    const zEdge = D + T - drop;
    const rs = flat ? 'square' : q.edgeReturnStyle, flare = rs === 'beveled' && D > 0 ? Math.min(2.2, D * 0.21) : 0;
    const rf = rs === 'filleted' ? Math.max(0, Math.min(1.6, zEdge - D - 0.2, T - drop - 0.2)) : 0;
    const offAt = z => (rs === 'beveled' && D > 0 ? flare * Math.min(1, z / zEdge) : 0) + (rf > 0 && z > zEdge - rf ? rf - Math.sqrt(Math.max(0, rf * rf - (z - (zEdge - rf)) ** 2)) : 0);
    const outerZ = [zEdge]; if (rf > 0) for (let k = 1; k <= 6; k++) outerZ.push(zEdge - rf * (1 - Math.cos(k / 6 * Math.PI / 2))); if (outerZ[outerZ.length - 1] > 0) outerZ.push(0);
    const ringShape = off => grow(base, -off);
    const front = ringShape(offAt(zEdge));
    const step = DETAIL[q.detail] * (q._stepJitter || 1), kOut = counts(base, Math.min(1, step * 1.6));
    const ext = extent(front);
    const ctx = { q, W: ext.W, H: ext.H, sc: q.textureScale, inset0: q.borderInset, front, bw, flare, innerD: D > 0 ? ringShape(offAt(D) + t) : null, borderW };
    // holes cut through the plate
    const tops = [], backs = [], pockets = [];
    const c = L.clearance;
    L.gangs.forEach(g => {
      const pk = !flat && g.pocket && T > g.pocket.thick + 0.3 ? g.pocket : (flat && g.pocket && T > g.pocket.thick + 0.3 ? g.pocket : null);
      const zb = pk ? D + T - pk.thick : D;
      if (pk) pockets.push({ shape: pk.shape, z: zb, holes: [] });
      g.openings.forEach(s => { const h = { s, k: counts(s, Math.min(0.5, step)), kind: 'open', zb, pocket: pk ? pockets[pockets.length - 1] : null }; tops.push(h); if (h.pocket) h.pocket.holes.push(h); else backs.push(h); });
      if (opt.screws) g.screws.forEach(sc => {
        const SP = L.screw || SCREW;
        let rT = sc.csOD / 2, rB = SP.thru / 2;
        const tanA = Math.tan(SP.angle / 2 * Math.PI / 180);
        let depth = (rT - rB) / tanA; if (depth > T - 0.45) { depth = T - 0.45; rT = rB + depth * tanA; }
        const s = circ(sc.x, sc.y, rT), k = counts(circ(0, 0, SP.csOD / 2), Math.min(0.5, step));
        const h = { s, k, kind: 'screw', thru: circ(sc.x, sc.y, rB), depth, zb: D }; tops.push(h); backs.push(h);
      });
    });
    const text = flat ? null : textPlace(q, L, q.borderInset);
    ctx.text = text;
    const val = validate(q, L, ctx);
    if (val.errors.length && !flat) { const e = new Error(val.errors[0]); e.errors = val.errors; throw e; }
    // ---- the height of the front at (x, y)
    const keep = 2, fadeW = 0.8, ch = flat ? 0.25 : q.openingChamfer, maxCut = T - 1.0;
    const pat1 = PATTERNS[style] || PATTERNS.smooth_bevel, pat2 = !flat && q.style2 !== 'none' && q.styleMix > 0 ? PATTERNS[q.style2] : null;
    const seat = !flat && L.seat ? L.seat : null;
    const crown = !flat && style === 'rounded_pillow' ? q.crownHeight : 0, crownR = seat ? Math.max(2, Math.min(ctx.W - (seat.w || 0), ctx.H - (seat.h || 0)) / 2 - bw) : Math.min(ctx.W, ctx.H) * 0.36;
    const panelStyle = s => !['victorian_border', 'greek_key', 'stepped_frame', 'art_deco', 'capsule_rings', 'shield_steps', 'arch_frame', 'stepped_ripple', 'channel_ribs', 'wavy_edge', 'scallop_inset'].includes(s);
    const pad = text ? 1.6 : 0;
    const textBox = text ? rr(text.x0 + text.w / 2, text.y0 + text.h / 2, text.w + 2 * pad, text.h + 2 * pad, 1.5) : null;
    // where a whole pattern cell may sit: inside the patterned panel, clear of the opening margins, the seat and text
    ctx.clear = (x, y, m) => {
      const d = -sdf(front, x, y); if (d < (panelStyle(style) ? ctx.inset0 + fadeW : bw + 0.6) + m) return false;
      for (const h of tops) if (sdf(h.s, x, y) < keep + fadeW + m) return false;
      if (seat && sdf(seat, x, y) + keep < keep + fadeW + m) return false;
      if (textBox && sdf(textBox, x, y) < 0.8 + m) return false;
      return true;
    };
    function zAt(x, y) {
      const d = -sdf(front, x, y);
      let z = D + T;
      if (bw > 0 && d < bw) { const u = sat(d / bw); const f = prof === 'round' ? 1 - Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))) : prof === 'ogee' ? 0.5 + 0.5 * Math.cos(Math.PI * u) : 1 - u; z -= drop * f; }
      if (crown) { const u = sat((d - bw) / crownR); z += crown * (1 - (1 - u) * (1 - u)); }
      let hd = 1e9; for (const h of tops) { const v = sdf(h.s, x, y); if (v < hd) hd = v; }
      let cut = 0;
      // a surround's seat (where the accessory rests) stays flat: no texture or text there
      const hs = seat ? Math.min(hd, sdf(seat, x, y) + keep) : hd;
      const keepM = sstep(keep, keep + fadeW, hs);
      if (keepM > 0 && (pat1 !== PATTERNS.smooth_bevel || pat2)) {
        const inPanel = sstep(ctx.inset0, ctx.inset0 + fadeW, d);
        let k = pat1(x, y, d, ctx) * (panelStyle(style) ? inPanel : sstep(bw, bw + 0.6, d));
        if (pat2) k = k * (1 - q.styleMix) + q.styleMix * pat2(x, y, d, ctx) * (panelStyle(q.style2) ? inPanel : 1);
        if (textBox) k *= sstep(0, 0.8, sdf(textBox, x, y));
        cut = q.textureDepth * k * keepM;
      }
      if (text) {
        const tv = sampleMask(text, x, y), tk = sstep(1.0, 1.6, seat ? Math.min(hd, sdf(seat, x, y) + 1) : hd) * sstep(bw, bw + 1, d);
        if (text.mode === 'emboss') { const inBox = 1 - sstep(-0.4, 0, sdf(textBox, x, y)); cut += text.depth * Math.max(0, inBox - tv) * tk; }
        else cut += text.depth * tv * tk;
      }
      if (cut > maxCut) cut = maxCut;
      z -= cut;
      if (ch > 0 && hd < ch) z -= (ch - Math.max(0, hd));
      return z;
    }
    // ---- loops
    const frontLoop = lift(loop(front, kOut), zAt);
    const holeTop = tops.map(h => lift(loop(h.s, h.k).reverse(), zAt));
    // ---- sample points over the front
    const extra = [];
    const loopsXY = [frontLoop, ...holeTop];
    const okPt = (x, y, dmin) => { if (-sdf(front, x, y) < dmin) return false; for (const h of tops) if (sdf(h.s, x, y) < dmin) return false; return true; };
    const ringStep = Math.min(0.8, step * 1.4);
    const ringsAt = [];
    if (bw > 0) { const n = prof === 'chamfer' ? 2 : 7; for (let k = 1; k <= n; k++) ringsAt.push(bw * k / n); ringsAt.push(bw + Math.min(0.6, step)); }
    else ringsAt.push(Math.min(0.5, step));
    if (crown) for (let k = 1; k <= 6; k++) ringsAt.push(bw + crownR * k / 6);
    for (const r of styleRings(q, ctx)) if (r > bw + 0.1) ringsAt.push(r);
    for (const r of ringsAt) { const s = ringShape(offAt(zEdge) + r); const se = extent(s); if (se.W < 2 || se.H < 2) continue; for (const p of loop(s, counts(s, ringStep))) if (okPt(p[0], p[1], 0.08) && (!textBox || sdf(textBox, p[0], p[1]) > 0.3 || r < bw + 0.7)) extra.push([p[0], p[1], zAt(p[0], p[1])]); }
    if (seat) for (const off of [0, 0.4, 0.8, 1.4]) { const s = grow(seat, off); for (const p of loop(s, counts(s, Math.min(0.6, step)))) if (okPt(p[0], p[1], 0.08)) extra.push([p[0], p[1], zAt(p[0], p[1])]); }
    if (ch > 0) for (const h of tops) for (const off of [ch, ch + 0.5]) { const s = grow(h.s, off); for (const p of loop(s, counts(s, Math.min(0.5, step)))) if (okPt(p[0], p[1], 0.08) && (!textBox || sdf(textBox, p[0], p[1]) > 0.3)) extra.push([p[0], p[1], zAt(p[0], p[1])]); }
    // grooves: rings across each one, snapped onto the exact distance contour (decorative outlines grow only roughly)
    const bands = flat ? [] : styleBands(q, ctx), chains = [];
    const onContour = (x, y, r) => { for (let it = 0; it < 3; it++) { const e = 1e-3, f = sdf(front, x, y) + r, gx = (sdf(front, x + e, y) - sdf(front, x - e, y)) / (2 * e), gy = (sdf(front, x, y + e) - sdf(front, x, y - e)) / (2 * e), g2 = gx * gx + gy * gy || 1; x -= f * gx / g2; y -= f * gy / g2; } return [x, y]; };
    // one point row per groove profile station, all offset along the outline normal from the same center loop so the
    // rows line up point for point (aligned quads, no zigzag across the groove)
    for (const b of bands) {
      if (b.c - b.hw <= bw + 0.1) continue;
      const s0 = ringShape(offAt(zEdge) + b.c), se = extent(s0); if (se.W < 2 || se.H < 2) continue;
      const F = b.F || (b.flat ? [-1, -0.73, -b.flat / b.hw, 0, b.flat / b.hw, 0.73, 1] : [-1, -0.6, -0.3, 0, 0.3, 0.6, 1]);
      const rows = F.map(() => []);
      for (const p0 of loop(s0, counts(s0, Math.min(ringStep, 0.5)))) {
        const pc = onContour(p0[0], p0[1], b.c), e = 1e-3, gx = (sdf(front, pc[0] + e, pc[1]) - sdf(front, pc[0] - e, pc[1])) / (2 * e), gy = (sdf(front, pc[0], pc[1] + e) - sdf(front, pc[0], pc[1] - e)) / (2 * e), gl = Math.hypot(gx, gy) || 1;
        F.forEach((f, fi) => {
          const r = b.c + f * b.hw, p = onContour(pc[0] - f * b.hw * gx / gl, pc[1] - f * b.hw * gy / gl, r);
          if (okPt(p[0], p[1], 0.08) && (!textBox || sdf(textBox, p[0], p[1]) > 0.3)) { const v = [p[0], p[1], zAt(p[0], p[1])]; extra.push(v); rows[fi].push(v); } else rows[fi].push(null);
        });
      }
      // the edge rows (where the groove meets the face) become crease lines; a row cut by an opening splits into runs
      for (const R of F.length > 1 ? [rows[0], rows[F.length - 1]] : [rows[0]]) {
        if (!R.includes(null)) { const c = R.slice(); c.closed = true; chains.push(c); continue; }
        let run = []; for (const v of R) { if (v) run.push(v); else { if (run.length > 1) chains.push(run); run = []; } } if (run.length > 1) chains.push(run);
      }
    }
    const rayed = !flat && style === 'sunburst_lines';
    if (rayed) for (const p of rayPoints(q, ctx, ringStep, (x, y) => okPt(x, y, 0.08) && (!textBox || sdf(textBox, x, y) > 0.3), zAt, chains)) extra.push(p);
    // creases of the geometric patterns: points exactly on every cell wall, mortar line, facet and ray edge
    const LB = !flat && textured && style !== 'sunburst_lines' ? PATTERN_LABELS[style] : null, cHash = new Map(), CH = Math.max(0.1, step * 0.5);
    const cNear = (x, y, r) => { const i = Math.floor(x / CH), j = Math.floor(y / CH), k = Math.ceil(r / CH); for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) { const Lc = cHash.get((i + a) + ',' + (j + b)); if (Lc) for (const p of Lc) if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < r * r) return true; } return false; };
    const cAdd = (x, y) => { const k = Math.floor(x / CH) + ',' + Math.floor(y / CH); let Lc = cHash.get(k); if (!Lc) cHash.set(k, Lc = []); Lc.push([x, y]); };
    if (LB) {
      const fb0 = bounds(front), fs = Math.max(0.12, step * 0.55), nx = Math.ceil((fb0[2] - fb0[0]) / fs) + 1, ny = Math.ceil((fb0[3] - fb0[1]) / fs) + 1;
      const needD = style === 'art_deco' || style === 'greek_key';
      const live = (x, y) => LB(x, y, needD ? -sdf(front, x, y) : 0, ctx);
      const usable = (x, y) => { const d = -sdf(front, x, y); if (d < bw + 0.5 || (panelStyle(style) && d < ctx.inset0 - 0.2)) return false; if (!okPt(x, y, keep - 0.1)) return false; return !(textBox && sdf(textBox, x, y) < 0.3); };
      const Lg = new Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) Lg[j * nx + i] = live(fb0[0] + i * fs, fb0[1] + j * fs);
      const sep = step * 0.22;
      const cross = (ax, ay, bx, by, depth = 0) => {
        const la = live(ax, ay); let lo = 0, hi = 1;
        for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (live(ax + (bx - ax) * m, ay + (by - ay) * m) === la) lo = m; else hi = m; }
        const t = (lo + hi) / 2, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        // more than one change in this grid step (a thin line, a step right next to a crease): find the rest too
        const hx = ax + (bx - ax) * hi, hy = ay + (by - ay) * hi;
        if (depth < 3 && hi < 0.995 && live(hx, hy) !== live(bx, by)) cross(hx, hy, bx, by, depth + 1);
        // a hard step (a frame edge, the end of a border band) gets a point on each side: a crisp wall, not a slope
        const L = Math.hypot(bx - ax, by - ay) || 1, ex = (bx - ax) / L * 0.03, ey = (by - ay) / L * 0.03, za = zAt(x - ex, y - ey), zb = zAt(x + ex, y + ey), hard = Math.abs(za - zb) > 0.12;
        if (cNear(x, y, hard ? 0.02 : sep) || !usable(x, y)) return;
        cAdd(x, y);
        if (hard) { extra.push([x - ex, y - ey, za]); extra.push([x + ex, y + ey, zb]); } else extra.push([x, y, zAt(x, y)]);
      };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const la = Lg[j * nx + i]; const x = fb0[0] + i * fs, y = fb0[1] + j * fs;
        if (i + 1 < nx && Lg[j * nx + i + 1] !== la) cross(x, y, x + fs, y);
        if (j + 1 < ny && Lg[(j + 1) * nx + i] !== la) cross(x, y, x, y + fs);
      }
    }
    // the pattern's own margins: a clean line where it starts inside the border and around each opening
    if (!flat && textured) {
      if (panelStyle(style)) for (const r of [0, 0.2, 0.4, 0.6, 0.8, 1].map(k => ctx.inset0 + fadeW * k)) { if (r <= bw + 0.3) continue; const sh = ringShape(offAt(zEdge) + r), se = extent(sh); if (se.W < 2 || se.H < 2) continue; for (const p of loop(sh, counts(sh, Math.min(0.5, step)))) if (okPt(p[0], p[1], keep) && !cNear(p[0], p[1], step * 0.3) && (!textBox || sdf(textBox, p[0], p[1]) > 0.3)) { cAdd(p[0], p[1]); extra.push([p[0], p[1], zAt(p[0], p[1])]); } }
      for (const h of tops) for (const off of [0, 0.25, 0.5, 0.75, 1].map(k => keep + fadeW * k)) { const sh = grow(h.s, off); for (const p of loop(sh, counts(sh, Math.min(0.5, step)))) if (okPt(p[0], p[1], off - 0.05) && -sdf(front, p[0], p[1]) > bw + 0.5 && !cNear(p[0], p[1], step * 0.3) && (!textBox || sdf(textBox, p[0], p[1]) > 0.3)) { cAdd(p[0], p[1]); extra.push([p[0], p[1], zAt(p[0], p[1])]); } }
    }
    STATS.front = { zAt, ctx, d: (x, y) => -sdf(front, x, y), creases: cHash.size ? [...cHash.values()].reduce((a, L) => a + L.length, 0) : 0 };
    const rayN = Math.max(20, Math.round(28 / ctx.sc));
    const inFeature = (x, y, d, pad) => {
      for (const b of bands) if (Math.abs(d - b.c) < b.hw + pad) return true;
      if (rayed) { const rad = Math.hypot(x, y) || 1e-6, f = fract((Math.atan2(y, x) / (2 * Math.PI) + 0.5) * rayN), w = Math.min(f, 1 - f) * 2 * Math.PI / rayN * rad; if (w < 0.7 + pad) return true; }
      return false;
    };
    // grid: dense where the style or text has detail, coarse on plain faces
    const gs = textured ? step : (crown ? Math.max(step, 1.2) : 2.4);
    const bandIn = (bw > 0 ? bw + Math.min(0.6, step) : Math.min(0.5, step)) + 0.45 * gs;
    const rowH = gs * 0.866;
    const fb = bounds(front);
    for (let j = 0, y = fb[1]; y <= fb[3]; j++, y = fb[1] + j * rowH) {
      for (let x = fb[0] + (j % 2 ? gs / 2 : 0); x <= fb[2]; x += gs) {
        if (textBox && sdf(textBox, x, y) < 0.3) continue;
        const dd = -sdf(front, x, y); if (dd < bandIn) continue;
        if ((bands.length || rayed) && inFeature(x, y, dd, 0.4 * gs)) continue;
        if (cHash.size && cNear(x, y, 0.5 * gs)) continue;
        if (!okPt(x, y, (ch > 0 ? ch + 0.5 : 0) + 0.45 * gs)) continue;
        extra.push([x, y, zAt(x, y)]);
      }
    }
    if (textBox) {
      const fs = Math.min(0.2, step * 0.6), fh = fs * 0.866;
      for (let j = 0, y = textBox.cy - textBox.h / 2 - 0.2; y <= textBox.cy + textBox.h / 2 + 0.2; j++, y = textBox.cy - textBox.h / 2 - 0.2 + j * fh)
        for (let x = textBox.cx - textBox.w / 2 - 0.2 + (j % 2 ? fs / 2 : 0); x <= textBox.cx + textBox.w / 2 + 0.2; x += fs) {
          if (sdf(textBox, x, y) >= 0.3) continue;
          if (!okPt(x, y, Math.max(bandIn, 0.1)) && -sdf(front, x, y) < bandIn) continue;
          if (!okPt(x, y, (ch > 0 ? ch + 0.5 : 0) + 0.12)) continue;
          extra.push([x, y, zAt(x, y)]);
        }
    }
    const out = new Soup();
    fillRegion(out, loopsXY, extra, true, chains.filter(c => c.length > 1));
    // ---- outer side wall rings, from the front edge down to the wall
    const rings = outerZ.map((z, i) => i === 0 ? frontLoop : lift(loop(ringShape(offAt(z)), kOut), z));
    for (let i = 0; i + 1 < rings.length; i++) strip(out, rings[i], rings[i + 1]);
    const backOuter = rings[rings.length - 1];
    // ---- holes: opening walls, countersinks
    tops.forEach((h, i) => {
      const U = holeTop[i];
      if (h.kind === 'open') { strip(out, U, lift(U, h.zb)); return; }
      const thru = loop(h.thru, h.k).reverse();
      const zc = Math.min(...U.map(p => p[2])) - h.depth;
      const cone = lift(thru, Math.max(D + 0.3, zc));
      strip(out, U, cone); strip(out, cone, lift(thru, D));
    });
    const holeBack = backs.map(h => h.kind === 'open' ? lift(loop(h.s, h.k).reverse(), D) : lift(loop(h.thru, h.k).reverse(), D));
    // ---- pockets on the back (keystone): wall from the back up to the pocket ceiling, ceiling with its openings
    const pocketBack = pockets.map(pk => {
      const kp = counts(pk.shape, 0.8), Lp = loop(pk.shape, kp).reverse();
      strip(out, lift(Lp, pk.z), lift(Lp, D));
      const inner = pk.holes.map(h => lift(loop(h.s, h.k).reverse(), pk.z));
      fillRegion(out, [lift(Lp, pk.z), ...inner], null, false);
      return lift(Lp, D);
    });
    // ---- the back: lip ring at the wall, inner lip wall, back of the face
    if (D > 0) {
      const innerShape = z => ringShape(offAt(z) + t);
      const in0 = lift(loop(innerShape(0), kOut).reverse(), 0), inD = lift(loop(innerShape(D), kOut).reverse(), D);
      fillRegion(out, [backOuter, in0], null, false);
      strip(out, inD, in0);
      fillRegion(out, [inD, ...holeBack, ...pocketBack], null, false);
    } else fillRegion(out, [backOuter, ...holeBack, ...pocketBack], null, false);
    const p = Float64Array.from(out.a);
    let zmax = 0; for (let i = 2; i < p.length; i += 3) if (p[i] > zmax) zmax = p[i];
    // face down when most of the front is the flat face plane (smooth PEI finish, no supports); a crowned or mostly
    // textured front prints face up instead (supports from the bed inside the return carry the face)
    // share of the front that is gently sloped (between flat and 45 degrees): face down those would hang over air
    let slopeA = 0; for (let f = 0; f < p.length; f += 9) { const ax = p[f + 3] - p[f], ay = p[f + 4] - p[f + 1], az = p[f + 5] - p[f + 2], bx = p[f + 6] - p[f], by = p[f + 7] - p[f + 1], bz = p[f + 8] - p[f + 2]; const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz); if (l > 0 && nz / l > 0.72 && nz / l < 0.9998 && Math.min(p[f + 2], p[f + 5], p[f + 8]) > D + 0.05) slopeA += l / 2; }
    const flatShare = 1 - slopeA / Math.max(1, L.W * L.H);
    const preferDown = FACE_DOWN.has(style) && !seat && !crown;
    const printFace = q.printFace === 'auto' ? (seat || crown || (!preferDown && flatShare < 0.8) ? 'up' : 'down') : q.printFace;
    const print = flat || printFace === 'up' ? p : faceDown(p, zmax);
    let border = null;
    if (twoTone) border = borderRing(full, grow(base, -0.18), D + T, Math.max(1.6, T), step);
    return { p, print, printFace: flat ? 'up' : printFace, flatShare, depth: zmax, warnings: val.warnings, front, tops, flare, t, D, border, full };
  }
  // 180 degrees about x: the front goes on the bed (keeps triangle orientation)
  function faceDown(p, zmax) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i]; q[i + 1] = -p[i + 1]; q[i + 2] = zmax - p[i + 2]; } return q; }
  // Front-only two-tone border: a closed ring between the decorative outline and the inset face, flush with the face.
  function borderRing(outer, inner, z1, thick, step) {
    const z0 = z1 - thick, out = new Soup();
    const Uo = loop(outer, counts(outer, Math.min(0.55, step)));
    const Ui = loop(inner, counts(inner, Math.min(0.55, step))).reverse();
    fillRegion(out, [lift(Uo, z1), lift(Ui, z1)], null, true);
    fillRegion(out, [lift(Uo, z0), lift(Ui, z0)], null, false);
    strip(out, lift(Uo, z1), lift(Uo, z0));
    strip(out, lift(Ui, z1), lift(Ui, z0));
    const p = Float64Array.from(out.a);
    return { p, depth: z1 };
  }
  function export3MF(res, opt) {
    const o = res.options || {}, bambu = (opt && opt.bambu) || o.bambu || 'A1';
    const title = (opt && opt.title) || 'Expressarte wall plate (gigaprint-wallplate)';
    const colorParts = res.parts.filter(pt => pt.role === 'face' || pt.role === 'border');
    const Tfun = (typeof StudioTools !== 'undefined' && StudioTools) || (typeof G !== 'undefined' && G.StudioTools) || (typeof require === 'function' ? require('./tools.js') : null);
    if (!Tfun || !Tfun.threeMF) throw new Error('3MF export is not available');
    if (colorParts.length >= 2) {
      const others = res.parts.filter(pt => pt.role !== 'face' && pt.role !== 'border');
      const obj = { name: 'wall_plate', parts: colorParts.map(pt => ({ name: pt.name, p: pt.print, color: pt.color })) };
      const objects = [obj, ...others.map(pt => ({ name: pt.name, p: pt.print, color: pt.color || '#C9D0D4' }))];
      const filaments = (res.filaments || colorParts.map(pt => ({ color: pt.color }))).map(f => ({ color: f.color }));
      return Tfun.threeMF(objects, { title, plates: [objects.map((_, i) => i)], bambu, filaments });
    }
    const objects = res.parts.map(pt => ({ name: pt.name, p: pt.print, color: pt.color || o.faceColor || '#7A9E86' }));
    return Tfun.threeMF(objects, { title, plates: [objects.map((_, i) => i)], bambu, filaments: (res.filaments || [{ color: objects[0].color }]).map(f => ({ color: f.color })) });
  }
  // Screwless option: a flat sub-plate that screws to the devices, and the cover slips over it (friction fit inside
  // the cover's return). Same openings; the cover has no screw holes.
  function subplate(q, L, cover) {
    const Ts = Math.min(q.subplateThickness, Math.max(2.4, q.edgeReturnDepth - 1.5));
    const inset = (cover.flare ? cover.flare * Math.min(1, Ts / Math.max(1e-6, cover.D + q.faceThickness)) : 0) + q.returnThickness + q.subplateClearance;
    const shape = rr(0, 0, L.W - 2 * inset, L.H - 2 * inset, Math.max(0.6, q.cornerRadius - inset));
    const r = plate(Object.assign({}, q, { styleId: 'flat_modern', engraveText: '', style2: 'none' }), L, { screws: true, flat: { T: Ts, shape } });
    return { p: r.p, print: r.p, W: shape.w, H: shape.h, T: Ts, clearance: q.subplateClearance };
  }
  function sizeLabel(q) {
    if (q.region === 'na') return SIZES[q.sizeClass].label;
    if (q.plateKind === 'surround') return 'Surround';
    return { uk: q.gangs === 2 ? '146 \u00d7 86 mm (2 gang)' : '86 \u00d7 86 mm (1 gang)', eu: `${q.gangs}-gang frame, ${EU.inserts[q.euInsert]} \u00d7 ${EU.inserts[q.euInsert]} mm inserts`, au: '115 \u00d7 73 mm standard plate' }[q.region];
  }
  function requirements(o) {
    const q = normalize(o), extras = [];
    if (!FREE_STYLES.includes(q.styleId)) extras.push(`${STYLES.find(s => s[0] === q.styleId)[1]} wall plate style`);
    if (q.style2 !== 'none' && q.styleMix > 0 && !FREE_STYLES.includes(q.style2)) extras.push(`${STYLES.find(s => s[0] === q.style2)[1]} style overlay`);
    if (q.screwMode === 'hidden_subplate') extras.push('screwless two-piece wall plate');
    return { tool: 'wallplate', gangs: q.gangs, extras };
  }
  // A small square of a style's face for gallery thumbnails: n x n heights (0 = face, positive = recessed mm)
  function swatch(id, n, mm) {
    const q = normalize({ styleId: id, gangs: 1, devices: [{ type: 'toggle' }] }), size = mm || 44, out = new Float32Array(n * n);
    const W = 79.4, H = 123.8, front = outlineFor(q, { W, H }), b = bounds(front), outlined = !!STYLE_OUTLINE[id];
    const ctx = { q, W: b[2] - b[0], H: b[3] - b[1], sc: 1, inset0: 5, front, bw: 1.5, borderW: 9 }, f = PATTERNS[id] || PATTERNS.smooth_bevel;
    const pad = 3, vw = (b[2] - b[0]) + 2 * pad, vh = (b[3] - b[1]) + 2 * pad, side = Math.max(vw, vh);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let x, y, d;
      if (outlined) {
        x = (b[0] + b[2]) / 2 + ((i + 0.5) / n - 0.5) * side;
        y = (b[1] + b[3]) / 2 + (0.5 - (j + 0.5) / n) * side;
        d = -sdf(front, x, y);
      } else {
        x = -W / 2 + (i + 0.5) / n * size;
        y = (id === 'mountain_skyline' ? -1 : 1) * (H / 2 - (n - 1 - j + 0.5) / n * size * (id === 'mountain_skyline' ? 1 : 0) - (id === 'mountain_skyline' ? 0 : (j + 0.5) / n * size));
        d = Math.min(W / 2 - Math.abs(x), H / 2 - Math.abs(y));
      }
      let z = 0;
      if (outlined && d < 0) { out[j * n + i] = 1.6; continue; }
      z = 0.8 * f(x, y, Math.max(0, d), ctx) * (['victorian_border', 'greek_key', 'stepped_frame', 'art_deco', 'capsule_rings', 'shield_steps', 'arch_frame', 'scallop_inset', 'wavy_edge'].includes(id) ? sstep(1.2, 2.0, Math.max(0, d)) : sstep(5, 5.8, Math.max(0, d)));
      if (d < 1.5 && d >= 0) z += 1.5 - d;
      if (id === 'rounded_pillow') z -= 1.2 * (1 - (1 - sat((d - 1.5) / 28)) ** 2);
      if (id === 'custom_text') { const u = (x + W / 2 - 22) / 7, v = (y - H / 2 + 22) / 7; z += Math.abs(u) < 1.2 && Math.abs(v) < 1.6 && (Math.abs(u) > 0.8 || Math.abs(v) < 0.2) ? 0.6 : 0; }
      out[j * n + i] = z;
    }
    return out;
  }
  const api = { _stats: STATS, _patterns: PATTERNS, _labels: PATTERN_LABELS, REGIONS, UK, EU, AU, M35, sizeLabel, gangPos, accessory, swatch, _plate: (q, L) => plate(q, L, { screws: true }), build, normalize, layout, device, plateSize, gangX, sdf, loop, counts, grow, bounds, extent, outlineFor, export3MF, requirements, faceDown, GANG, SIZES, CTC, SCREW, CLEAR, DEVICES, STYLES, FREE_STYLES, FEATURED_STYLES, PALETTE, TWO_TONE, FACE_DOWN, STYLE_OUTLINE, PRESETS, DEFAULTS, IN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPWallPlate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
