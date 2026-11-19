/* Expressarte case name plates: a printable ID plate for every hard case in Customize Your Pelican, in two places:

   - Front plate: the recessed pocket next to the carry handle. A flat strip with a dovetail bevel on both short ends
     and on the lower long edge (the upper long edge is square), like the factory plates: tuck the beveled edge
     under the pocket lip, press the square edge in, a strip of thin double-sided tape behind it holds it.
   - Lid badge: the rounded badge in the middle of the outside of the lid (where the maker's logo sits), a flat
     glue-on plate with an optional raised rim, like owners' replacement badges.

   Your text (1 to 3 lines, auto-fitted inside the plate's real outline) and/or logo, raised or inlaid in a second
   color, an optional border (line, double line or raised rim), exported as a colored Bambu-ready 3MF.

   Sizes: each case lists a front plate and a lid badge with a status:
     'confirmed'  measured from fit-tested owner plates (two or more agree, or the sample plates Clark sent)
     'tested'     one fit-tested owner plate
     'estimated'  derived from the confirmed plates and the case's published exterior; measure before printing
   Sample plates (refs/case-nameplate): the Apache front plate for the 2800, 3800, 4800 and 5800 (back face
   120.32 mm along the square edge, 118.57 mm along the beveled edge, 24.42 tall, 3.5 thick, 2.0 mm bevels) and the
   Apache 3800 lid badge (85.5 \u00d7 50 mm, 8 mm corners, 2.0 mm base with a 2 mm wide rim raised 1.5 mm, glued on).

   Print frame (mm): x along the plate (0 .. L), y up the plate (0 .. H; on a front plate the beveled long edge is at
   y = 0), z out of the case (0 = the back face, on the bed). build(raw, M) takes the initialized Manifold module. */
(function (G) {
  'use strict';
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const stampApi = () => G.GPStamp || (typeof require === 'function' ? require('./stamp.js') : null);
  const mockApi = () => G.GPCaseMock || (typeof require === 'function' ? require('./case-mockup.js') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (v === '' || v === null || v === undefined || !isFinite(+v)) ? d : +v;
  const r2 = v => Math.round(v * 100) / 100, half = v => Math.round(v * 2) / 2;
  const IN = 25.4;

  const LOCATIONS = { front: 'Front plate (by the handle)', lid: 'Lid badge (middle of the lid)' };
  // plate families (kind 'strip' = beveled front plate, 'badge' = flat glue-on lid badge)
  const PLATES = {
    apache: { kind: 'strip', label: 'Apache front plate', L: 120.32, H: 24.42, T: 3.5, bevel: 2, taper: 0.875, r: 0,
      sources: [
        'Sample plate "Apache Name Plate 2800, 3800, 4800, 5800" (fit-tested, current and new cases): back face 120.32 mm on the square edge, 118.57 mm on the beveled edge, 24.42 \u00d7 3.5 mm, 2.0 mm bevels on both ends and the lower edge, square corners',
        'Owner plates, all fit-tested, measured: 119.43 \u00d7 24.98 \u00d7 3.0 (3800/4800 snug fit), 119.0 \u00d7 24.5 \u00d7 4.4 (2800 to 9800), 120 \u00d7 24 \u00d7 3.4, 119.5 \u00d7 24.5 \u00d7 3.5 (2800), 121.5 \u00d7 24.5 \u00d7 3.3 (4800), 122.67 \u00d7 23.95 \u00d7 3.5 (2800 to 9800)'
      ] },
    pelican: { kind: 'strip', label: 'Pelican front plate', L: 121.5, H: 25, T: 3.4, bevel: 1.5, taper: 0, r: 0,
      sources: [
        'Owner blank for the 1510 (fit-tested), measured: 121.95 \u00d7 25.07 \u00d7 3.38 mm, 1.5 mm bevels on both ends and one long edge, square corners',
        'Owner customizable 1510 plate (fit-tested): 120 \u00d7 25 \u00d7 3.6 mm, 1.5 mm bevels; designer of a multi-case plate: 121 mm for the 1510, 122 mm for the 1560, 1610 and 1620',
        'Owner 1520 plate (fit-tested, resized from the 1510): 117.5 \u00d7 24.48 \u00d7 3.52 mm'
      ] },
    badge: { kind: 'badge', label: 'Lid badge', L: 85.5, H: 50, T: 2, r: 8,
      sources: [
        'Sample plate "Apache 3800 Starlink Plate" (glued on): 85.5 \u00d7 50 \u00d7 3.5 mm, 8 mm corners, 2.0 mm base, 2 mm rim raised 1.5 mm, logo raised 1.0 mm',
        'Owner blank "Apache 3800 Hard Case Logo Plate", measured: 85.5 \u00d7 50 \u00d7 3.5 mm; two badge designers list one medium badge for the 2800, 3800 and 5800, a small one for the 1800 and a large one for the 4800'
      ] }
  };
  // [id, name, lid face width (in), lid face height (in), layout of the mock ('end' rolling / 'front' briefcase)]
  // Exteriors: makers' published dimensions (the same table as case-mockup.js; Apache 1800/2800/9800 from the
  // published exterior specs).
  const RAW = [
    ['p1510', 'Pelican 1510', 13.81, 22.00, 'end'], ['p1535air', 'Pelican Air 1535', 13.97, 21.96, 'end'], ['p1560', 'Pelican 1560', 17.92, 22.07, 'end'],
    ['p1607air', 'Pelican Air 1607', 18.80, 24.13, 'end'], ['p1610', 'Pelican 1610', 19.69, 24.83, 'end'], ['p1615air', 'Pelican Air 1615', 18.40, 32.58, 'end'],
    ['p1620', 'Pelican 1620', 19.57, 24.76, 'end'], ['p1637air', 'Pelican Air 1637', 20.65, 26.61, 'end'], ['p1650', 'Pelican 1650', 20.47, 31.59, 'end'],
    ['p1557air', 'Pelican Air 1557', 15.79, 19.18, 'end'], ['p1700', 'Pelican 1700', 16.42, 38.47, 'end'],
    ['p1150', 'Pelican 1150', 9.44, 7.80, 'front'], ['p1200', 'Pelican 1200', 10.67, 9.75, 'front'], ['p1300', 'Pelican 1300', 10.70, 9.76, 'front'],
    ['p1400', 'Pelican 1400', 13.37, 11.62, 'front'], ['p1440', 'Pelican 1440', 12.00, 19.70, 'end'], ['p1450', 'Pelican 1450', 16.44, 13.00, 'front'],
    ['p1460', 'Pelican 1460', 12.73, 20.85, 'end'], ['p1495', 'Pelican 1495', 21.62, 17.25, 'front'], ['p1500', 'Pelican 1500', 18.50, 14.06, 'front'],
    ['p1520', 'Pelican 1520', 19.78, 15.77, 'front'], ['p1525air', 'Pelican Air 1525', 21.96, 13.97, 'front'], ['p1550', 'Pelican 1550', 20.66, 17.20, 'front'],
    ['p1555air', 'Pelican Air 1555', 24.76, 15.46, 'front'], ['p1600', 'Pelican 1600', 24.39, 19.36, 'front'], ['p1605air', 'Pelican Air 1605', 28.87, 16.77, 'front'],
    ['a1800', 'Apache 1800', 9.25, 7.50, 'front'], ['a2800', 'Apache 2800', 13.50, 11.38, 'front'], ['a3800', 'Apache 3800', 16.50, 13.00, 'front'],
    ['a4800', 'Apache 4800', 20.31, 15.50, 'front'], ['a5800', 'Apache 5800', 13.75, 21.88, 'end'], ['a9800', 'Apache 9800', 53.00, 16.00, 'front']
  ];
  const REF_LID = Math.sqrt(16.5 * 13.0) * IN; // the Apache 3800 lid the sample badge fits
  // front plate per case
  function frontFor(id, wIn, hIn, layout) {
    const P = PLATES;
    if (id === 'a1800') return null; // no front plate pocket on the smallest case
    if (id[0] === 'a') return { ...pick(P.apache), status: id === 'a9800' ? 'tested' : 'confirmed', family: 'apache' };
    if (id === 'p1510') return { ...pick(P.pelican), status: 'confirmed', family: 'pelican' };
    if (['p1560', 'p1610', 'p1620'].includes(id)) return { ...pick(P.pelican), L: 122, status: 'confirmed', family: 'pelican' };
    if (id === 'p1520') return { ...pick(P.pelican), L: 117.5, H: 24.5, T: 3.5, status: 'tested', family: 'pelican' };
    // estimated: the plate runs along the latch face between the latches
    const face = (layout === 'end' ? hIn : wIn) * IN;
    let L;
    if (face >= 450) L = layout === 'end' ? 121.5 : 117.5; // full-size cases: the 1510 / 1520 plate
    else L = half(face * 0.27);
    const H = clamp(half(L * 0.205), 16, 25), bevel = L < 90 ? 1.2 : 1.5;
    return { ...pick(P.pelican), L, H, bevel, status: 'estimated', family: 'pelican' };
  }
  function lidFor(id, wIn, hIn) {
    const B = PLATES.badge;
    if (['a2800', 'a3800', 'a5800'].includes(id)) return { ...pick(B), status: 'confirmed', family: 'badge' };
    if (id === 'a4800') return { ...pick(B), L: 103.5, H: 60.5, r: 9.5, status: 'estimated', family: 'badge' };
    if (id === 'a1800') return { ...pick(B), L: 67, H: 40, r: 6.5, status: 'estimated', family: 'badge' };
    if (id === 'a9800') return { ...pick(B), status: 'estimated', family: 'badge' };
    const s = clamp(Math.sqrt(wIn * hIn) * IN / REF_LID, 0.62, 1.3);
    return { ...pick(B), L: half(B.L * s), H: half(B.H * s), r: half(B.r * s), status: 'estimated', family: 'badge' };
  }
  function pick(P) { return { kind: P.kind, L: P.L, H: P.H, T: P.T, bevel: P.bevel || 0, taper: P.taper || 0, r: P.r || 0 }; }
  const CASES = RAW.map(([id, name, w, h, layout]) => ({ id, name, layout, lidIn: [w, h], front: frontFor(id, w, h, layout), lid: lidFor(id, w, h) }))
    .concat([{ id: 'custom', name: 'Another case (measure it)', layout: null, lidIn: null, front: { ...pick(PLATES.pelican), status: 'custom', family: 'custom' }, lid: { ...pick(PLATES.badge), status: 'custom', family: 'custom' } }]);
  const byId = Object.fromEntries(CASES.map(c => [c.id, c]));
  const STYLES = { inlay: 'Inlaid (flush)', raised: 'Raised' };
  const FONTS = { block: 'Block', slab: 'Slab', round: 'Round', chunky: 'Chunky', tall: 'Tall', script: 'Script' };
  const BORDERS = { none: 'No border', line: 'Line', double: 'Double line', rim: 'Raised rim' };
  const STATUS = { confirmed: 'Confirmed size', tested: 'Owner-tested size', estimated: 'Estimated size', custom: 'Your size' };
  const PALETTE = [
    { name: 'Black', hex: '#1E1E1E' }, { name: 'White', hex: '#F7F7F2' }, { name: 'Gray', hex: '#8A8D91' }, { name: 'Silver', hex: '#C9CDD2' },
    { name: 'Gold', hex: '#C9A227' }, { name: 'Red', hex: '#C8102E' }, { name: 'Orange', hex: '#E8730C' }, { name: 'Yellow', hex: '#F5C518' },
    { name: 'Forest', hex: '#2F6B4F' }, { name: 'Blue', hex: '#1F6FB2' }, { name: 'Navy', hex: '#1F3A68' }, { name: 'Purple', hex: '#7B4FB8' },
    { name: 'Pink', hex: '#F4B6C2' }, { name: 'Mint', hex: '#A8E6CF' }, { name: 'Baby blue', hex: '#A7C7E7' }, { name: 'Lavender', hex: '#C8B6E2' },
    { name: 'Butter', hex: '#F8E7A1' }, { name: 'Peach', hex: '#F9C6A8' }
  ];
  const LIMITS = { freeColors: 2, maxChars: 24, maxLines: 3, minLetter: 3 };
  const RIM = { w: 2, h: 1.5 }; // the sample badge's rim
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    caseId: 'p1510', loc: 'front', line1: 'YOUR NAME', line2: '', line3: '', font: 'block', style: 'inlay', depth: 0.6, border: 'none',
    lenAdj: 0, thick: null, custom: null, logoH: null, colors: { plate: PZ.babyBlue, text: PZ.ink, border: PZ.ink }, singleColor: false, bed: [256, 256], bambu: 'A1'
  };
  // the factory size for a case and place (null when that case has no such plate)
  function pocketFor(caseId, loc) {
    const c = byId[caseId]; if (!c) return null;
    const p = c[loc === 'lid' ? 'lid' : 'front']; if (!p) return null;
    return { ...p };
  }
  function options(raw) {
    raw = raw || {};
    const o = { ...DEFAULTS, ...raw };
    o.caseId = byId[o.caseId] ? o.caseId : 'p1510';
    o.loc = o.loc === 'lid' ? 'lid' : 'front';
    if (!byId[o.caseId].front) o.loc = 'lid';
    const pk = pocketFor(o.caseId, o.loc);
    const t = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxChars);
    o.line1 = t(raw.line1 === undefined ? DEFAULTS.line1 : raw.line1); o.line2 = t(o.line2); o.line3 = t(o.line3);
    o.font = FONTS[o.font] ? o.font : 'block';
    o.style = STYLES[o.style] ? o.style : 'inlay';
    o.depth = clamp(num(o.depth, 0.6), 0.4, pk.kind === 'badge' ? 1.5 : 1.2);
    o.border = raw.border === true ? 'line' : BORDERS[raw.border] ? raw.border : 'none';
    o.lenAdj = clamp(num(o.lenAdj, 0), -3, 3);
    // a custom size: { L, H, r, T } (front plates keep their bevels)
    const cu = raw.custom && typeof raw.custom === 'object' ? raw.custom : (o.caseId === 'custom' ? {} : null);
    let d = { ...pk };
    if (cu) {
      d.L = clamp(num(cu.L, pk.L), 30, 250); d.H = clamp(num(cu.H, pk.H), 12, 160);
      d.T = clamp(num(cu.T, pk.T), pk.kind === 'badge' ? 1.2 : 2, 6);
      d.r = clamp(num(cu.r, pk.r), 0, Math.min(d.L, d.H) / 2 - 0.5);
      if (d.kind === 'strip') { d.taper = 0; d.bevel = Math.min(d.bevel, d.H / 5, d.T * 0.6); }
      d.status = 'custom';
      o.custom = { L: d.L, H: d.H, r: d.r, T: d.T };
    } else {
      o.custom = null;
      d.L = pk.L + o.lenAdj * (pk.L / 120);
      d.H = pk.H + (pk.kind === 'badge' ? o.lenAdj * (pk.H / 120) : 0);
      d.T = clamp(num(raw.thick, pk.T), pk.kind === 'badge' ? 1.2 : pk.T - 0.8, pk.kind === 'badge' ? 4 : pk.T + 0.3);
    }
    d.L = r2(d.L); d.H = r2(d.H); d.T = r2(d.T);
    o.thick = d.T;
    o.image = Array.isArray(raw.image) && raw.image.length ? raw.image : null;
    o.imageName = String(raw.imageName || '').slice(0, 80);
    o.colors = { ...DEFAULTS.colors, ...(raw.colors || {}) };
    for (const k of Object.keys(DEFAULTS.colors)) { const v = String(o.colors[k] || ''); o.colors[k] = /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : DEFAULTS.colors[k]; }
    o.singleColor = !!raw.singleColor;
    o.bed = [clamp(num(o.bed && o.bed[0], 256), 100, 1000), clamp(num(o.bed && o.bed[1], 256), 100, 1000)];
    o.bambu = String(o.bambu || 'A1');
    o.plate = d;
    return o;
  }

  // ---------------------------------------------------------------- outlines
  // back face (z = 0) and front face (z = T) outlines, as point lists in the plate frame
  function rawBack(d) {
    if (d.kind === 'badge') return [[0, 0], [d.L, 0], [d.L, d.H], [0, d.H]];
    const t = d.taper || 0; return [[t, 0], [d.L - t, 0], [d.L, d.H], [0, d.H]];
  }
  function rawFront(d) {
    if (d.kind === 'badge') return rawBack(d);
    const t = d.taper || 0, b = d.bevel || 0, xl = t * (1 - b / d.H) + b;
    return [[xl, b], [d.L - xl, b], [d.L - b, d.H], [b, d.H]];
  }
  function cs(M, pts, r) {
    let c = new M.CrossSection([pts], 'Positive');
    { const b = polyBB([pts]); r = Math.min(r, (b.x1 - b.x0) / 2 - 0.3, (b.y1 - b.y0) / 2 - 0.3); }
    if (r > 0.05) { const a = c.offset(-r, 'Miter', 2), b = a.offset(r, 'Round', 2, 96); c.delete(); a.delete(); c = b; }
    return c;
  }
  // corner radius on each face: the badge's own radius; a front plate's corners are square unless sized custom
  const rBack = d => d.r || 0, rFront = d => d.kind === 'badge' ? (d.r || 0) : Math.max(0, (d.r || 0) - (d.bevel || 0) * 0.4);
  function backCS(M, d) { return cs(M, rawBack(d), rBack(d)); }
  function frontCS(M, d) { return cs(M, rawFront(d), rFront(d)); }
  // the plate blank: the back face outline joined to the front face outline (beveled where they differ)
  function plateSolid(M, d) {
    d = { kind: 'strip', taper: 0, r: 0, ...d };
    const back = backCS(M, d);
    if (d.kind === 'badge') { const m = back.extrude(d.T); back.delete(); return m; }
    const front = frontCS(M, d), a = back.extrude(0.02), b0 = front.extrude(0.02), b = b0.translate([0, 0, d.T - 0.02]);
    const h = M.Manifold.hull([a, b]);
    for (const x of [back, front, a, b0, b]) x.delete();
    return h;
  }
  // margins between the front face edge and the lettering, per border
  function textMargin(d, border) {
    const edge = d.kind === 'badge' ? 2.2 : 1.3;
    return edge + ({ none: 0, line: 2.0, double: 3.4, rim: d.kind === 'badge' ? RIM.w + 0.6 : 1.8 })[border || 'none'];
  }
  // the region the lettering must stay inside (polygons in the plate frame)
  const SAFE = new Map();
  function safeRegion(M, d, border) {
    const key = JSON.stringify([d.kind, d.L, d.H, d.T, d.bevel, d.taper, d.r, border]);
    if (SAFE.has(key)) return SAFE.get(key);
    if (SAFE.size > 400) SAFE.clear();
    const polys = safeRegion0(M, d, border); SAFE.set(key, polys); return polys;
  }
  function safeRegion0(M, d, border) {
    const f = frontCS(M, d), s = f.offset(-textMargin(d, border), 'Round', 2, 64), polys = s.toPolygons();
    f.delete(); s.delete();
    return polys;
  }
  function inPoly(polys, x, y) {
    let inside = false;
    for (const P of polys) for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function polyBB(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const P of polys) for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; }
    return { x0, y0, x1, y1 };
  }
  // the usable box for lettering (inside the safe region; the fit loop then checks every point)
  function face(d, M, border) {
    if (!M) { const b = d.bevel || 0, t = d.taper || 0; return { x0: b + t + 1.6, x1: d.L - b - t - 1.6, y0: b + 1.1, y1: d.H - 1.4 }; }
    const bb = polyBB(safeRegion(M, d, border)), rr = Math.max(0, rFront(d) - textMargin(d, border)) * 0.29;
    return { x0: bb.x0 + rr, x1: bb.x1 - rr, y0: bb.y0 + rr, y1: bb.y1 - rr };
  }

  // ---------------------------------------------------------------- lettering
  const loopsBB = loops => polyBB(loops);
  const TEXTS = new Map(); // text outlines at 10 mm, by lines + lettering (the slow part of a rebuild)
  // returns { loops (closed point lists, even-odd), textH (letter height mm), logo, scale } or null
  function lettering(o, d, M, warnings) {
    const SM = stampApi(), A = face(d, M, o.border), W = A.x1 - A.x0, Hh = A.y1 - A.y0;
    const lines = [o.line1, o.line2, o.line3].filter(Boolean);
    const stack = d.kind === 'badge' && d.H / d.L > 0.4; // logo above the text on a badge, beside it on a strip
    const items = [];
    let logo = null;
    if (o.image) {
      let { x0, y0, x1, y1 } = polyBB(o.image.map(Q => Q.outer));
      if (isFinite(x0) && x1 > x0 && y1 > y0) {
        const lh = lines.length ? (stack ? Hh * 0.55 : Hh) : Hh, s0 = Math.min(lh / (y1 - y0), (lines.length && !stack ? W * 0.4 : W) / (x1 - x0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        logo = { kind: 'logo', w: (x1 - x0) * s0, h: (y1 - y0) * s0, polys: o.image.map(Q => ({ outer: Q.outer.map(p => [(p[0] - cx) * s0, (p[1] - cy) * s0]), holes: (Q.holes || []).map(L => L.map(p => [(p[0] - cx) * s0, (p[1] - cy) * s0])) })) };
        items.push(logo);
      }
    }
    let text = null; const h0 = 10;
    if (lines.length && SM) {
      const dropped = new Set();
      let ps = [];
      const tk = JSON.stringify([lines, o.font]), hit = TEXTS.get(tk);
      if (hit) { ps = hit.ps; for (const ch of hit.dropped) dropped.add(ch); }
      else {
        try { ps = SM.textBlock(lines, o.font, h0, 0.06, dropped); } catch (e) { warnings.push('The text could not be drawn in that lettering.'); }
        if (TEXTS.size > 200) TEXTS.clear();
        TEXTS.set(tk, { ps, dropped: [...dropped] });
      }
      if (ps.length) { const b = loopsBB(ps.map(Q => Q.outer)); text = { kind: 'text', w: b.x1 - b.x0, h: b.y1 - b.y0, polys: ps.map(Q => ({ outer: Q.outer.map(p => [p[0] - (b.x0 + b.x1) / 2, p[1] - (b.y0 + b.y1) / 2]), holes: (Q.holes || []).map(L => L.map(p => [p[0] - (b.x0 + b.x1) / 2, p[1] - (b.y0 + b.y1) / 2])) })) }; }
      if (dropped.size) warnings.push(`Some characters are not in this lettering and were left out: ${[...dropped].join(' ')}`);
    }
    if (!logo && !text) return null;
    // scale the text block to its share of the box, then lay the items out and scale the group to fit the box
    if (text) {
      const tw = logo && !stack ? W - logo.w - 4 : W, th = logo && stack ? Hh * 0.4 : Hh;
      const k = Math.min(tw / text.w, th / text.h); text.s = k; text.w *= k; text.h *= k;
      text.polys = text.polys.map(Q => ({ outer: Q.outer.map(p => [p[0] * k, p[1] * k]), holes: Q.holes.map(L => L.map(p => [p[0] * k, p[1] * k])) }));
    }
    const parts = [];
    if (logo && text && stack) { const gap = Hh * 0.05, tot = logo.h + gap + text.h; parts.push([logo, 0, tot / 2 - logo.h / 2], [text, 0, -tot / 2 + text.h / 2]); }
    else if (logo && text) { const gap = 4, tot = logo.w + gap + text.w; parts.push([logo, -tot / 2 + logo.w / 2, 0], [text, tot / 2 - text.w / 2, 0]); }
    else parts.push([logo || text, 0, 0]);
    const cx = (A.x0 + A.x1) / 2, cy = (A.y0 + A.y1) / 2;
    const place = s => { const loops = []; for (const [it, dx, dy] of parts) for (const Q of it.polys) for (const L of [Q.outer, ...Q.holes]) loops.push(L.map(p => [cx + (p[0] + dx) * s, cy + (p[1] + dy) * s])); return loops; };
    let s = 1, loops = place(s);
    { const b = loopsBB(loops); const k = Math.min(W / (b.x1 - b.x0), Hh / (b.y1 - b.y0), 1); if (k < 1) { s *= k * 0.999; loops = place(s); } }
    // every point inside the safe outline (rounded corners, tapered sides); shrink until it is
    const safe = M ? safeRegion(M, d, o.border) : null;
    if (safe) for (let i = 0; i < 60; i++) { if (loops.every(L => L.every(p => inPoly(safe, p[0], p[1])))) break; s *= 0.97; loops = place(s); }
    const textH = text ? h0 * text.s * s : 0;
    if (text && textH < LIMITS.minLetter) warnings.push(`The lettering is ${r2(textH)} mm tall, under ${LIMITS.minLetter} mm. Shorter text or fewer lines print cleaner.`);
    return { loops, textH, scale: s, logo: !!logo, text: !!text };
  }

  // ---------------------------------------------------------------- build
  function ring(M, d, inset, w) {
    const f = frontCS(M, d), a = f.offset(-inset, 'Round', 2, 64), b = f.offset(-inset - w, 'Round', 2, 64), r = a.subtract(b);
    for (const x of [f, a, b]) x.delete();
    return r;
  }
  function build(raw, M) {
    if (!M || !M.Manifold) throw new Error('The solid engine (Manifold) is not loaded.');
    const o = options(raw), d = o.plate, warnings = [], bin = [], k = x => { bin.push(x); return x; };
    try {
      let plate = k(plateSolid(M, d));
      const L = lettering(o, d, M, warnings), loops = L ? L.loops : null;
      const z0 = o.style === 'inlay' ? d.T - o.depth : d.T - 0.01, z1 = o.style === 'inlay' ? d.T + 0.01 : d.T + o.depth;
      const solid = (lp, fill, a, b) => k(k(k(new M.CrossSection(lp, fill)).extrude(b - a)).translate([0, 0, a]));
      // inlay: the cutter overshoots the face by a hair, the inlay body itself ends flush with it
      let text = loops && loops.length ? solid(loops, 'EvenOdd', z0, o.style === 'inlay' ? d.T : z1) : null;
      const cutText = text && o.style === 'inlay' ? solid(loops, 'EvenOdd', z0, z1) : text;
      let border = null, borderCut = null;
      if (o.border === 'line' || o.border === 'double') {
        const rings = o.border === 'line' ? [k(ring(M, d, 0.9, 1.1))] : [k(ring(M, d, 0.8, 0.8)), k(ring(M, d, 2.3, 0.8))];
        const u = rings.length > 1 ? k(rings[0].add(rings[1])) : rings[0];
        border = k(k(u.extrude((o.style === 'inlay' ? d.T : z1) - z0)).translate([0, 0, z0]));
        if (o.style === 'inlay') borderCut = k(k(u.extrude(z1 - z0)).translate([0, 0, z0]));
      } else if (o.border === 'rim') {
        const w = d.kind === 'badge' ? RIM.w : 1.2, rg = k(ring(M, d, 0, w));
        border = k(k(rg.extrude(RIM.h + 0.01)).translate([0, 0, d.T - 0.01]));
      }
      if (border && text) text = k(text.subtract(borderCut || border));
      if (!text && !border) warnings.push('Blank plate: add text or a logo.');
      if (o.style === 'inlay') { if (cutText) plate = k(plate.subtract(cutText)); if (borderCut) plate = k(plate.subtract(borderCut)); }
      if (o.style === 'raised' && text) warnings.push(`Raised lettering stands ${o.depth} mm proud of the plate.`);
      const one = o.singleColor;
      const parts = [{ name: 'Name plate', role: 'plate', m: plate, color: o.colors.plate }];
      if (text && !text.isEmpty()) parts.push({ name: o.style === 'inlay' ? 'Plate text inlay' : 'Plate raised text', role: 'text', m: text, color: one ? o.colors.plate : o.colors.text });
      if (border && !border.isEmpty()) parts.push({ name: o.border === 'rim' ? 'Plate rim' : 'Plate border', role: 'border', m: border, color: one ? o.colors.plate : o.colors.border });
      let out = parts;
      // single color: anything standing proud fuses into the plate; flush inlays keep their own bodies
      if (one && parts.length > 1) {
        const proud = parts.slice(1).filter(q => o.style === 'raised' || q.name === 'Plate rim'), flush = parts.slice(1).filter(q => !proud.includes(q));
        out = [{ ...parts[0], m: proud.length ? k(M.Manifold.union([parts[0].m, ...proud.map(q => q.m)])) : parts[0].m }, ...flush];
      }
      const raw2 = out.map(q => ({ name: q.name, role: q.role, kind: 'nameplate', color: q.color, p: soup(q.m) }));
      for (const q of raw2) if (!q.p.length) throw new Error(`The ${q.name.toLowerCase()} came out empty.`);
      const bx = o.bed[0], by = o.bed[1];
      if (d.L > bx - 4) warnings.push(`The plate (${Math.round(d.L)} mm) is longer than your build plate.`);
      const printParts = raw2.map(q => ({ ...q, plate: 0, p: move(q.p, (bx - d.L) / 2, (by - d.H) / 2, 0) }));
      const colors = [...new Set(raw2.map(q => q.color))];
      const cs0 = byId[o.caseId];
      let top = d.T; for (const q of raw2) for (let i = 2; i < q.p.length; i += 3) if (q.p[i] > top) top = q.p[i];
      const stats = { caseId: o.caseId, caseName: cs0.name, loc: o.loc, locLabel: LOCATIONS[o.loc], kind: d.kind, family: d.family, status: d.status, statusLabel: STATUS[d.status],
        size: [d.L, d.H, r2(top)], plateT: d.T, bevel: d.bevel || 0, taper: d.taper || 0, radius: d.r || 0, style: o.style, styleLabel: STYLES[o.style], depth: o.depth, border: o.border,
        colors: colors.length, parts: raw2.length, logo: !!o.image, lines: [o.line1, o.line2, o.line3].filter(Boolean).length, textH: L ? r2(L.textH) : 0, plates: 1, custom: !!o.custom,
        sources: (PLATES[d.family] || {}).sources ? PLATES[d.family].sources.length : 0 };
      return { options: o, raw: raw2, parts: printParts, warnings, stats, colors, plates: 1 };
    } finally { for (const x of bin) { try { x.delete(); } catch (e) { /* gone */ } } }
  }
  function soup(m) {
    const g = m.getMesh(), np = g.numProp, vp = g.vertProperties, tv = g.triVerts, out = new Float32Array(tv.length * 3);
    for (let i = 0; i < tv.length; i++) { const s = tv[i] * np; out[i * 3] = vp[s]; out[i * 3 + 1] = vp[s + 1]; out[i * 3 + 2] = vp[s + 2]; }
    return out;
  }
  function move(p, dx, dy, dz) { const q = new Float32Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + dz; } return q; }

  // ---------------------------------------------------------------- the case around it (display only)
  // Poses (plate frame -> case-mockup frame):
  //   side: the pocket on the latch side of a rolling case (case-mockup plateSpot): X = Xf + z, Y = Ya + y, Z = zc + L/2 - x
  //   top:  the pocket on the latch face of a briefcase-style case, square edge toward the lid: X = L/2 - x, Y = Yh + H - y, Z = Zb + z
  //   lid:  the badge in the middle of the lid: X = x - L/2, Y = yF - z, Z = zc - H/2 + y
  function poseP(p, spot, L, H) {
    L = L || spot.L; H = H || spot.H; const q = new Float32Array(p.length), off = spot.off || [0, 0, 0];
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      if (spot.pose === 'top') { q[i] = spot.Xc + L / 2 - x; q[i + 1] = spot.Yh + H - y; q[i + 2] = spot.Zb + z; }
      else if (spot.pose === 'lid') { q[i] = spot.Xc + x - L / 2; q[i + 1] = spot.yF - z; q[i + 2] = spot.zc - H / 2 + y; }
      else { q[i] = spot.Xf + z + off[0]; q[i + 1] = spot.Ya + y + off[1]; q[i + 2] = spot.zc + L / 2 - x + off[2]; }
    }
    return q;
  }
  function hostKey(res) {
    const o = res.options, c = byId[o.caseId], CM = mockApi();
    if (!c || !c.layout || !CM || !CM.SPECS || !CM.SPECS[o.caseId]) return null;
    const d = o.plate; return JSON.stringify([o.caseId, o.loc, d.kind, d.L, d.H, d.T, d.bevel, d.taper, d.r]);
  }
  // the case mockup with the plate's pocket (front) or badge recess (lid); { parts, spot } or null
  function host(res, M) {
    if (!hostKey(res)) return null;
    const CM = mockApi(), o = res.options, d = o.plate, sp = CM.spec(o.caseId), bin = [], k = x => { bin.push(x); return x; };
    try {
      const opt = { y0: -sp.D / 2, handle: true };
      if (sp.wheels && sp.layout === 'end') opt.trolley = [-Math.min(130, sp.W / 2 - 40), Math.min(130, sp.W / 2 - 40)];
      const F = CM.frame(sp, opt), c = 0.25, slab = (pts, a, b) => k(k(k(new M.CrossSection([pts], 'Positive')).extrude(b - a)).translate([0, 0, a]));
      const big = { ...d, L: d.L + 2 * c, H: d.H + 2 * c };
      let spot = null;
      if (o.loc === 'front' && sp.layout === 'end') {
        const ps = CM.plateSpot(sp, opt, { L: d.L, H: d.H, T: d.T, bevel: d.bevel });
        if (!ps) return null;
        opt.plate = { L: d.L, H: d.H, T: d.T, bevel: d.bevel };
        spot = { ...ps, pose: 'side' };
      } else if (o.loc === 'front') {
        // on the latch face, just past the parting line, between the latches; the folded handle below it
        const bez = 1.5, Yh = F.yp + 7, Zb = bez - d.T;
        spot = { pose: 'top', Xc: 0, Yh, Zb, L: d.L, H: d.H, T: d.T };
        opt.keepX = [-d.L / 2 - 48, d.L / 2 + 48];
        opt.handleY = Yh + d.H + 26;
        const pad = k(k(k(new M.CrossSection([[[-d.L / 2 - 4, Yh - 4], [d.L / 2 + 4, Yh - 4], [d.L / 2 + 4, Yh + d.H + 4], [-d.L / 2 - 4, Yh + d.H + 4]]], 'Positive')).offset(-3, 'Miter', 2)).offset(3, 'Round', 2, 32));
        opt.addShell = k(k(pad.extrude(bez + 3)).translate([0, 0, -3]));
        // the dovetail recess: the plate shape plus clearance, open above its front face
        const cut = k(plateSolid(M, big)), open = k(frontCS(M, big)), up = k(k(open.extrude(12)).translate([0, 0, big.T - 0.05]));
        const cutter = k(k(k(cut.add(up)).translate([-c, -c, 0])).rotate([0, 0, 180]));
        opt.cutShell = k(cutter.translate([spot.Xc + d.L / 2, Yh + d.H, Zb]));
      } else {
        // the lid badge: a flat pad in the middle of the lid face (over the ribs) with a shallow recess
        const zc = F.Zb / 2, yF = F.y0 - 5 + 1.2, rr = (d.r || 0) + 7;
        spot = { pose: 'lid', Xc: 0, yF, zc, L: d.L, H: d.H, T: d.T };
        const padCS = k(cs(M, [[-d.L / 2 - 7, zc - d.H / 2 - 7], [d.L / 2 + 7, zc - d.H / 2 - 7], [d.L / 2 + 7, zc + d.H / 2 + 7], [-d.L / 2 - 7, zc + d.H / 2 + 7]], rr));
        // CrossSection (x, z) extruded along -y: rotate the extrusion so its +z goes to -y
        const pad = k(k(k(padCS.extrude(6)).rotate([90, 0, 0])).translate([0, F.y0 + 1, 0]));
        opt.addShell = pad;
        const rec = k(cs(M, rawBack(big), rBack(big) + c)), recM = k(k(k(k(rec.extrude(1.2 + 4)).translate([-c, -c, 0])).rotate([90, 0, 0])).translate([-d.L / 2, yF, zc - d.H / 2]));
        opt.cutShell = recM;
      }
      const parts = CM.build(M, sp, opt);
      return { parts, spot };
    } finally { for (const x of bin) { try { x.delete(); } catch (e) { /* gone */ } } }
  }
  // view: 'case' (on the whole case), 'close' (close-up of the plate on the case), 'print' (on the build plate).
  // hostRes: host() for this plate; without one the plate shows on its own, face up.
  function scene(res, hostRes, view) {
    if (view === 'print' || !hostRes || !hostRes.spot) return res.parts.map(q => ({ name: q.name, kind: q.kind, color: q.color, p: Float32Array.from(q.p) }));
    const d = res.options.plate, spot = hostRes.spot, out = [];
    for (const q of res.raw) out.push({ name: q.name, kind: q.kind, color: q.color, p: poseP(q.p, spot, d.L, d.H) });
    const hs = hostRes.parts;
    // copies: the worker transfers these buffers and the host stays cached for the next rebuild
    if (view !== 'close') { for (const m of hs) out.push({ ...m, p: m.p.slice(), preview: true }); return out; }
    const CM = mockApi();
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const q of out) for (let i = 0; i < q.p.length; i += 3) for (let a = 0; a < 3; a++) { const v = q.p[i + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
    const m = 40; lo = lo.map(v => v - m); hi = hi.map(v => v + m);
    for (const h of hs) { const q = CM.clip(h.p, lo, hi); if (q.length) out.push({ ...h, p: q, preview: true }); }
    return out;
  }
  function filaments(res) {
    const roles = { plate: 'name plate', text: 'text / logo', border: 'border' };
    return res.colors.map(c => ({ color: c, role: res.raw.filter(q => q.color === c).map(q => roles[q.role] || q.role).filter((v, i, a) => a.indexOf(v) === i).join(' + ') }));
  }
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  function export3MF(res, opt) {
    opt = opt || {}; const cols = res.colors;
    const mk = q => ({ name: q.name, p: q.p, color: q.color, extruder: cols.indexOf(q.color) + 1 });
    const settings = { wall_loops: '3', sparse_infill_density: '25%' };
    const ob = res.parts.length > 1 ? { name: 'Name plate', parts: res.parts.map(mk), settings } : { ...mk(res.parts[0]), name: 'Name plate', settings };
    return T.threeMF([ob], { title: opt.name || 'Name plate', plates: [[0]], bambu: opt.bambu || res.options.bambu || 'A1', filaments: cols.map(c => ({ color: c })) });
  }
  function shapeLine(s) {
    const f = r2;
    if (s.kind === 'badge') return `${f(s.size[0])} \u00d7 ${f(s.size[1])} mm lid badge, ${f(s.radius)} mm corners, ${f(s.plateT)} mm base`;
    return `${f(s.size[0])} \u00d7 ${f(s.size[1])} \u00d7 ${f(s.plateT)} mm front plate, ${f(s.bevel)} mm bevel on both ends and the lower long edge${s.taper ? `, ${f(s.size[0] - 2 * s.taper)} mm along the beveled edge` : ''}`;
  }
  function readme(res, name) {
    const o = res.options, s = res.stats;
    const L = [`Expressarte name plate: ${name}`, '', `${s.caseName} \u00b7 ${shapeLine(s)} \u00b7 ${s.styleLabel.toLowerCase()} lettering`, `Size: ${s.statusLabel.toLowerCase()}${s.status === 'estimated' ? ' (measure your case before printing; use Custom size if it differs)' : ''}`];
    L.push('', 'Filament slots in the 3MF'); filaments(res).forEach((x, i) => L.push(`  ${i + 1}: ${x.color}  ${x.role}`));
    L.push('', 'Printing',
      '  - PLA or PETG, 0.16 mm layers, 3 walls. Print it as laid out: the back face on the bed, lettering up. No supports.',
      o.style === 'inlay' ? '  - The inlay is flush with the face: the color changes for the last layers only, so a single-nozzle AMS prints it quickly.' : '  - Raised lettering stands proud of the face in filament 2.',
      '  - Optional: turn on ironing for the top surface.', '', 'Fitting');
    if (s.kind === 'badge') L.push('  - Clean the lid with rubbing alcohol, then glue the badge into the recess in the middle of the lid (thin double-sided foam tape, E6000 or hot glue).', '  - Too big for the recess? Lower the size adjust a little and print again.');
    else L.push('  - Pry the old plate out with a thin blade from the square long edge.', '  - Put a strip of thin double-sided tape on the back, tuck the beveled long edge under the pocket lip and press the square edge in.', '  - Too tight? Lower the length or thickness by 0.3 mm and print again. Cases vary a little from year to year.');
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, opt) {
    opt = opt || {}; const name = opt.name || `${res.stats.caseName} name plate`, base = safe(opt.fileBase || name.toLowerCase()) || 'name_plate';
    const list = [{ name: `${base}.3mf`, data: export3MF(res, opt) }], seen = new Set();
    for (const q of res.parts) { let nm = safe(q.name.toLowerCase()); while (seen.has(nm)) nm += '_'; seen.add(nm); list.push({ name: `stl/${nm}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }); }
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }
  function proNeeds(res) { return { tool: 'nameplate', colors: res.colors.length, logo: !!res.options.image }; }
  // fit check for the audit: every lettering point inside the front face outline inset by minMargin
  function fitCheck(res, M, minMargin) {
    const o = res.options, d = o.plate, w = [], L = lettering(o, d, M, w);
    if (!L) return { ok: true, empty: true, textH: 0 };
    const f = frontCS(M, d), s = f.offset(-(minMargin == null ? 0.8 : minMargin), 'Round', 2, 64), polys = s.toPolygons(); f.delete(); s.delete();
    let bad = 0, n = 0; for (const lp of L.loops) for (const p of lp) { n++; if (!inPoly(polys, p[0], p[1])) bad++; }
    return { ok: bad === 0, bad, points: n, textH: r2(L.textH), scale: L.scale };
  }

  const api = { LOCATIONS, PLATES, CASES, byId, STYLES, FONTS, BORDERS, STATUS, PALETTE, LIMITS, DEFAULTS, RIM, pocketFor, options, rawBack, rawFront, plateSolid, face, safeRegion, lettering, build,
    hostKey, host, scene, poseP, filaments, export3MF, files, readme, proNeeds, fitCheck, shapeLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  G.GPNamePlate = api;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
