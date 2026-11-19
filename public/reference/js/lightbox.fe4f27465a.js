/* Expressarte lightbox letters: 3D printable lit channel letters (the "letter box" signs on storefronts). Type a word,
   pick a font and a letter height, and every letter becomes its own hollow light box:
   - Front-lit: an opaque body (back + returns) with a translucent face. The face either caps the returns (a flange
     that rests on the wall top with a plug ring that presses inside) or sits recessed on a ledge inside the returns.
   - Halo: an opaque body (front face + returns) that glows from behind through a translucent back cap; printed
     spacers hold it off the wall so the light washes the wall around the letter.
   The back carries a wire hole and keyhole or screw mounting where they fit inside the letter. An optional rail
   (a U-channel raceway behind the letters) or backer panel joins the letters. Letters bigger than the bed split
   into pieces with glue-in splice strips; the rail and panel split into segments with joiners.
   Fit rule: every letter keeps a lit channel (walls never fuse), counters (O, A, B\u2026) keep their inner islands, the
   face fits inside the returns with the set clearance, and every printed part fits the bed. If the height is too
   small for the font's strokes, it is raised to the smallest height that passes.
   Units are mm; x right, y up on the wall, z out of the wall. Every part is a closed, watertight solid.
   American spelling. No brand names. */
(function (G) {
  'use strict';
  const C = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const ST = () => G.GPStamp || (typeof require === 'function' ? require('./stamp.js') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (v === '' || v === null || v === undefined || !isFinite(+v)) ? d : +v;
  const PZ = (C && C.PASTELS) || {};

  const STYLES = [{ id: 'front', label: 'Front-lit (glowing face)' }, { id: 'halo', label: 'Halo (glow behind)' }, { id: 'both', label: 'Front-lit and halo' }];
  const FITS = [{ id: 'cap', label: 'Cap (face rests on the returns)' }, { id: 'inset', label: 'Recessed (face sits inside)' }];
  const MOUNTS = [{ id: 'keyhole', label: 'Keyhole slots' }, { id: 'screw', label: 'Screw holes' }, { id: 'none', label: 'None (tape or glue)' }];
  const BACKERS = [{ id: 'none', label: 'Separate letters' }, { id: 'rail', label: 'Rail behind the letters' }, { id: 'panel', label: 'Backer panel' }];
  const FONTS = [
    { id: 'slab', label: 'Bold slab' }, { id: 'tall', label: 'Tall' }, { id: 'round', label: 'Rounded' }, { id: 'chunky', label: 'Chunky' },
    { id: 'block', label: 'Stencil' }, { id: 'script', label: 'Script' }
  ];
  const LEDS = [{ id: 5, label: '5 mm strip' }, { id: 8, label: '8 mm strip' }, { id: 10, label: '10 mm strip' }, { id: 12, label: '12 mm strip' }];
  const PALETTE = [
    { name: 'Pink', hex: PZ.pink || '#F4B6C2' }, { name: 'Mint', hex: PZ.mint || '#A8E6CF' }, { name: 'Baby blue', hex: PZ.babyBlue || '#A7C7E7' },
    { name: 'Lavender', hex: PZ.lavender || '#C8B6E2' }, { name: 'Butter', hex: PZ.butter || '#F8E7A1' }, { name: 'Peach', hex: PZ.peach || '#F9C6A8' },
    { name: 'Sage', hex: PZ.sage || '#B5C9A8' }, { name: 'Cream', hex: PZ.cream || '#F6EFDC' }, { name: 'White', hex: '#F7F7F2' },
    { name: 'Gray', hex: '#8A8D91' }, { name: 'Black', hex: '#1E1E1E' }, { name: 'Red', hex: '#C8102E' }
  ];
  // translucent filament colors for the glowing face and the back cap
  const FACE_PALETTE = [
    { name: 'Natural (clear)', hex: '#EEEDE6' }, { name: 'White', hex: '#F7F7F2' }, { name: 'Cream', hex: PZ.cream || '#F6EFDC' }, { name: 'Butter', hex: PZ.butter || '#F8E7A1' },
    { name: 'Pink', hex: PZ.pink || '#F4B6C2' }, { name: 'Peach', hex: PZ.peach || '#F9C6A8' }, { name: 'Mint', hex: PZ.mint || '#A8E6CF' },
    { name: 'Baby blue', hex: PZ.babyBlue || '#A7C7E7' }, { name: 'Lavender', hex: PZ.lavender || '#C8B6E2' }, { name: 'Red', hex: '#E0475B' }
  ];
  const LED_COLORS = [{ name: 'Warm white', hex: '#FFD9A0' }, { name: 'Cool white', hex: '#EAF2FF' }, { name: 'Pink', hex: '#FF8FB8' }, { name: 'Blue', hex: '#7FB8FF' }, { name: 'Green', hex: '#8CFFB0' }, { name: 'Amber', hex: '#FFB347' }];
  const FREE = { maxChars: 6, maxHeight: 200 };
  const LIMITS = { maxChars: 24, minHeight: 30, maxHeight: 600, minChannel: 2, lostFrac: 0.04 };
  const DEFAULTS = {
    text: 'OPEN', font: 'slab', height: 120, spacing: 10, style: 'front', faceFit: 'cap',
    depth: 40, wall: 2, backT: 2, faceT: 1.6, plugH: 3, plugW: 1.6, inset: 3, ledgeW: 2.4, clearance: 0.25,
    led: 8, wireHole: true, wireD: 6, mount: 'keyhole', screwD: 4.5, haloGap: 25,
    backer: 'none', backerT: 4, margin: 15, railH: 30, railD: 20,
    detail: 'hd', autoHeight: true,
    colors: { body: PZ.pink || '#F4B6C2', face: PZ.cream || '#F6EFDC', backer: PZ.babyBlue || '#A7C7E7', led: '#FFD9A0' },
    bed: [256, 256, 256], bambu: 'A1'
  };
  const PRESETS = {
    pastel: { label: 'Pastel', font: 'round', text: 'hello', style: 'front', faceFit: 'cap', colors: { body: PZ.pink || '#F4B6C2', face: PZ.cream || '#F6EFDC', backer: PZ.babyBlue || '#A7C7E7', led: '#FFD9A0' } },
    open: { label: 'Open sign', font: 'slab', text: 'OPEN', style: 'front', faceFit: 'cap', colors: { body: PZ.babyBlue || '#A7C7E7', face: PZ.cream || '#F6EFDC', backer: PZ.lavender || '#C8B6E2', led: '#FFD9A0' } },
    halo: { label: 'Halo glow', font: 'tall', text: 'STUDIO', style: 'halo', faceFit: 'cap', colors: { body: PZ.lavender || '#C8B6E2', face: '#F7F7F2', backer: PZ.cream || '#F6EFDC', led: '#FF8FB8' } },
    bar: { label: 'Home bar', font: 'chunky', text: 'BAR', style: 'front', faceFit: 'inset', colors: { body: PZ.sage || '#B5C9A8', face: PZ.butter || '#F8E7A1', backer: PZ.cream || '#F6EFDC', led: '#FFB347' } }
  };

  function options(raw) {
    raw = raw || {};
    const o = { ...DEFAULTS, ...raw };
    o.colors = { ...DEFAULTS.colors, ...(raw.colors || {}) };
    o.text = String(o.text == null ? '' : o.text).replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxChars);
    if (!FONTS.some(f => f.id === o.font)) o.font = DEFAULTS.font;
    if (!STYLES.some(s => s.id === o.style)) o.style = 'front';
    if (!FITS.some(s => s.id === o.faceFit)) o.faceFit = 'cap';
    if (!MOUNTS.some(s => s.id === o.mount)) o.mount = 'keyhole';
    if (!BACKERS.some(s => s.id === o.backer)) o.backer = 'none';
    o.height = clamp(num(o.height, 120), LIMITS.minHeight, LIMITS.maxHeight);
    o.spacing = clamp(num(o.spacing, 10), 0, 60);
    o.wall = clamp(num(o.wall, 2), 1.2, 4);
    o.backT = clamp(num(o.backT, 2), 1.2, 5);
    o.faceT = clamp(num(o.faceT, 1.6), 0.8, 4);
    o.plugH = clamp(num(o.plugH, 3), 1.5, 8);
    o.plugW = clamp(num(o.plugW, 1.6), 1.2, 3);
    o.ledgeW = clamp(num(o.ledgeW, 2.4), 1.2, 5);
    o.clearance = clamp(num(o.clearance, 0.25), 0, 0.8);
    o.depth = clamp(num(o.depth, 40), 15, 150);
    o.inset = clamp(num(o.inset, 3), 0, Math.max(0, o.depth - o.backT - o.faceT - 6));
    o.led = clamp(num(o.led, 8), 3, 20);
    o.wireD = clamp(num(o.wireD, 6), 3, 12);
    o.screwD = clamp(num(o.screwD, 4.5), 3, 6);
    o.haloGap = clamp(num(o.haloGap, 25), 8, 60);
    o.backerT = clamp(num(o.backerT, 4), 2.4, 10);
    o.margin = clamp(num(o.margin, 15), 5, 60);
    o.railH = clamp(num(o.railH, 30), 18, 80);
    o.railD = clamp(num(o.railD, 20), 12, 60);
    o.wireHole = o.wireHole !== false; o.autoHeight = o.autoHeight !== false;
    o.detail = o.detail === 'standard' ? 'standard' : 'hd';
    const b = Array.isArray(o.bed) ? o.bed : DEFAULTS.bed; o.bed = [num(b[0], 256), num(b[1], 256), num(b[2], 256)];
    return o;
  }
  function presetOptions(id) { const p = PRESETS[id] || PRESETS.pastel; return options({ ...DEFAULTS, ...p, colors: { ...p.colors } }); }
  function usable(o) { return { w: Math.max(60, o.bed[0] - 8), d: Math.max(60, o.bed[1] - 8), z: Math.max(30, (o.bed[2] || 256) - 4) }; }

  // ---------------------------------------------------------------- 2D helpers
  const U = ps => ps.length ? T.unionPolys(ps) : [];
  const Off = (ps, d) => ps.length ? (Math.abs(d) < 1e-9 ? ps : T.offset(ps, d)) : [];
  const Dif = (a, b) => b && b.length && a.length ? T.diffPolys(a, b) : a;
  const Int = (a, b) => a.length && b.length ? T.interPolys(a, b) : [];
  const A = ps => ps.length ? T.polysArea(ps) : 0;
  const rect = (x0, y0, x1, y1) => ({ outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], holes: [] });
  const circ = (x, y, r, n) => ({ outer: T.circle(x, y, r, n || Math.max(24, Math.min(72, Math.round(r * 8)))), holes: [] });
  function bboxOf(polys) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const P of polys) for (const q of P.outer) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; }
  function xform(polys, k, dx, dy) { return polys.map(P => ({ outer: P.outer.map(q => [q[0] * k + dx, q[1] * k + dy]), holes: P.holes.map(h => h.map(q => [q[0] * k + dx, q[1] * k + dy])) })); }
  function inLoop(p, L) { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function inPolys(p, polys) { for (const P of polys) if (inLoop(p, P.outer) && !P.holes.some(h => inLoop(p, h))) return true; return false; }
  const holeCount = ps => ps.reduce((s, P) => s + P.holes.length, 0);
  // points inside a region on a grid, for placing holes
  function samples(region, n) {
    if (!region.length) return [];
    const b = bboxOf(region), st = Math.max(0.5, Math.max(b.w, b.h) / (n || 48)), out = [];
    for (let y = b.y0 + st / 2; y < b.y1; y += st) for (let x = b.x0 + st / 2; x < b.x1; x += st) if (inPolys([x, y], region)) out.push([x, y]);
    return out;
  }

  // ---------------------------------------------------------------- the letters
  const LC = new Map();
  function baseCap(o) { return o.detail === 'hd' ? 40 : 16; }
  function glyphLine(text, font, cap) {
    const key = font + '|' + cap + '|' + text; if (LC.has(key)) return LC.get(key);
    const dropped = new Set(), r = ST().textLine(text, font, cap, 0, dropped);
    const v = { glyphs: r.glyphs, dropped: [...dropped] };
    if (LC.size > 400) LC.clear(); LC.set(key, v); return v;
  }
  // the text at height H: pieces (connected outlines), each one channel letter, laid left to right, baseline y = 0
  function letters(o, H) {
    H = H || o.height;
    const cap = baseCap(o), g = glyphLine(o.text, o.font, cap), k = H / cap;
    if (!g.glyphs.length) return { pieces: [], dropped: g.dropped, width: 0, k };
    // each glyph placed with its own advance plus the letter gap (in mm at the final size)
    // glyphs placed with their own advance plus the letter gap (mm at the final size). Glyphs that overlap by a real
    // stroke (script joins) merge into one letter; glyphs that only graze each other (tips, serifs) are kept apart by
    // a gap so no letter ends up with a thin neck that would pinch its channel.
    const minJoin = Math.pow(2 * o.wall + 4, 2), gap = 2;
    let shift = 0; const groups = [];
    g.glyphs.forEach((gl, i) => {
      if (i) shift += o.spacing;
      let Gp = U(xform(gl.polys, k, shift, 0)); if (!Gp.length) return;
      for (const grp of groups) {
        const near = Int(Off(grp.polys, gap), Gp); if (!near.length) continue;
        const ov = A(Int(grp.polys, Gp));
        if (ov > minJoin) continue; // merged below
        Gp = Dif(Gp, Off(grp.polys, gap));
      }
      if (!Gp.length) return;
      const hit = groups.filter(grp => A(Int(grp.polys, Gp)) > minJoin);
      if (hit.length) { const m = { polys: U([...Gp, ...hit.flatMap(h => h.polys)]), gis: [i, ...hit.flatMap(h => h.gis)] }; for (const h of hit) groups.splice(groups.indexOf(h), 1); groups.push(m); }
      else groups.push({ polys: Gp, gis: [i] });
    });
    const all = groups.flatMap(grp => grp.polys.map(P => ({ P, gis: grp.gis })));
    // drop crumbs
    const polys0 = all.filter(q => A([q.P]) > Math.max(4, H * H * 0.0004));
    const polys = polys0.map(q => q.P); polys.forEach((P, j) => { P.__gis = polys0[j].gis; });
    polys.sort((a, b) => bboxOf([a]).x0 - bboxOf([b]).x0);
    const chars = [...o.text].filter(c => !/\s/.test(c));
    const pieces = polys.map((P, i) => {
      const b = bboxOf([P]);
      // name the piece after the glyph whose span holds its middle
      let best = -1, bd = Infinity; g.glyphs.forEach((gl, j) => { const gb = bboxOf(xform(gl.polys, k, 0, 0)); const x0 = gb.x0 + j * o.spacing, x1 = gb.x1 + j * o.spacing, d = b.cx < x0 ? x0 - b.cx : b.cx > x1 ? b.cx - x1 : 0; if (d < bd) { bd = d; best = j; } });
      const gis = P.__gis || [best]; delete P.__gis;
      return { i, polys: [P], bbox: b, ch: gis.length > 1 ? gis.slice().sort((a, b) => a - b).map(j => chars[j] || '').join('') : (chars[best] || '?'), gi: best, gis };
    });
    // a glyph with more than one piece (i, j, !, ?) names them "dot"
    const per = {}; pieces.forEach(p => { (per[p.gi] = per[p.gi] || []).push(p); });
    for (const list of Object.values(per)) if (list.length > 1) { list.sort((a, b) => A(b.polys) - A(a.polys)); list.forEach((p, j) => { p.sub = j ? (list.length > 2 ? 'part ' + (j + 1) : 'dot') : ''; }); }
    const bb = bboxOf(pieces.flatMap(p => p.polys));
    let glyphArea = 0; { let sh = 0; g.glyphs.forEach((gl, i) => { if (i) sh += o.spacing; glyphArea += A(U(xform(gl.polys, k, sh, 0))); }); }
    return { pieces, dropped: g.dropped, width: pieces.length ? bb.w : 0, bbox: bb, k, glyphArea, pieceArea: pieces.reduce((t, p) => t + A(p.polys), 0) };
  }

  // the shapes of one letter's layers
  function shapes(P, o) {
    const front = o.style === 'front', cap = o.faceFit === 'cap' || !front;
    const cav = Off(P, -o.wall);                                    // inside the returns
    const ledge = front && !cap ? Off(P, -(o.wall + o.ledgeW)) : cav;  // inside the ledge under a recessed face
    const faceIn = Off(P, -(o.wall + o.clearance));                  // what presses inside the returns
    const plug = cap ? Dif(faceIn, Off(P, -(o.wall + o.clearance + o.plugW))) : [];
    const ring = Dif(P, cav), ringLow = Dif(P, ledge);
    return { P, cav, ledge, faceIn, plug, ring, ringLow, cap, front };
  }
  // fit checks for one letter at this size: lit channel, islands, face clearance
  function letterFit(P, o) {
    const s = shapes(P, o), issues = [];
    const aP = A(P);
    if (!s.cav.length) issues.push('no room inside');
    // walls fuse where a stroke is thinner than two walls and a channel: that part of the letter would not light
    const r = o.wall + LIMITS.minChannel / 2, opened = Off(Off(P, -r), r);
    const lost = aP - A(Int(opened, P));
    if (lost > aP * LIMITS.lostFrac) issues.push('thin strokes');
    // counters keep their islands: the returns are one ring per outline loop, the face keeps every counter
    const loops = 1 + holeCount(P);
    if (s.ring.length !== loops) issues.push('walls fuse');
    if (s.faceIn.length !== 1 || holeCount(s.faceIn) !== holeCount(P)) issues.push('face splits');
    if (s.cap && s.plug.length < loops) issues.push('plug splits');
    if (!s.cap && s.front && (s.ledge.length !== 1 || holeCount(s.ledge) !== holeCount(P))) issues.push('ledge closes');
    // the face clears the returns by the set clearance (never touches or overlaps them)
    const over = A(Dif(Off(s.faceIn, o.clearance * 0.8), s.cav));
    if (over > 0.05) issues.push('face too big');
    return { ok: !issues.length, issues, lost: +(lost / Math.max(1e-9, aP)).toFixed(4), s };
  }
  function fitAt(o, H) {
    const L = letters(o, H); if (!L.pieces.length) return { ok: true, L, bad: [] };
    const bad = [];
    for (const p of L.pieces) { const f = letterFit(p.polys, o); p.fit = f; if (!f.ok) bad.push({ ch: p.ch, issues: f.issues }); }
    return { ok: !bad.length, L, bad };
  }
  // the smallest letter height where every letter passes (searched upward from the asked height)
  const MH = new Map();
  function minHeight(o) {
    const key = [o.text, o.font, o.wall, o.clearance, o.plugW, o.ledgeW, o.style, o.faceFit, o.spacing, o.detail].join('|');
    if (MH.has(key)) return MH.get(key);
    let lo = LIMITS.minHeight, hi = LIMITS.minHeight;
    if (fitAt(o, lo).ok) { MH.set(key, lo); return lo; }
    while (hi < LIMITS.maxHeight && !fitAt(o, hi).ok) { lo = hi; hi = Math.min(LIMITS.maxHeight, hi * 1.5); }
    if (!fitAt(o, hi).ok) { MH.set(key, null); return null; }
    for (let i = 0; i < 9 && hi - lo > 1; i++) { const m = (lo + hi) / 2; if (fitAt(o, m).ok) hi = m; else lo = m; }
    const v = Math.ceil(hi / 5) * 5; if (MH.size > 200) MH.clear(); MH.set(key, v); return v;
  }

  // ---------------------------------------------------------------- holes
  function keyholeShape(x, y, o) { const R = 4.5, w = o.screwD / 2 + 0.1; return U([circ(x, y, R, 40), rect(x - w, y, x + w, y + 9), circ(x, y + 9, w, 24)]); }
  function placeHoles(s, o, piece, railY) {
    const out = { wire: null, mounts: [] };
    const region = s.front ? s.ledge : Off(s.P, -(o.wall + o.clearance + o.plugW)); // where a hole is clear of the walls / plug
    const target = railY != null ? [piece.bbox.cx, railY] : [piece.bbox.cx, piece.bbox.cy];
    if (o.wireHole) {
      const R = Off(region, -(o.wireD / 2 + 1.5)), pts = samples(R, 60);
      let best = null, bd = Infinity; for (const p of pts) { const d = Math.hypot(p[0] - target[0], (p[1] - target[1]) * (railY != null ? 3 : 1)); if (d < bd) { bd = d; best = p; } }
      if (best) out.wire = best;
    }
    const mount = o.style !== 'front' && o.mount === 'none' ? 'screw' : o.mount;
    if (mount !== 'none') {
      const clearR = mount === 'keyhole' ? 6 : (o.style !== 'front' ? 7 : o.screwD / 2 + 4);
      const R = Off(region, -clearR), pts = samples(R, 60).filter(p => !out.wire || Math.hypot(p[0] - out.wire[0], p[1] - out.wire[1]) > o.wireD / 2 + clearR + 3);
      const ok = p => mount !== 'keyhole' || A(Dif(keyholeShape(p[0], p[1], o), Off(region, -1.2))) < 0.01;
      const two = piece.bbox.w > 150 || piece.bbox.h > 220;
      if (pts.length) {
        if (two) {
          // two holes far apart (left/right on wide letters, top/bottom on tall ones)
          const ax = piece.bbox.w >= piece.bbox.h ? 0 : 1;
          const srt = pts.slice().sort((a, b) => a[ax] - b[ax]);
          const a = srt.find(ok), b = srt.slice().reverse().find(ok);
          if (a) out.mounts.push(a); if (b && a && Math.hypot(b[0] - a[0], b[1] - a[1]) > 30) out.mounts.push(b);
        } else {
          // one hole high up, near the middle
          const srt = pts.slice().sort((a, b) => (b[1] - a[1]) - Math.abs(b[0] - piece.bbox.cx) * 0.4 + Math.abs(a[0] - piece.bbox.cx) * 0.4);
          const a = srt.find(ok); if (a) out.mounts.push(a);
        }
      }
      out.kind = mount;
    }
    return out;
  }
  function holePolys(h, o, forSpacer) {
    const ps = [];
    if (h.wire) ps.push(circ(h.wire[0], h.wire[1], o.wireD / 2));
    for (const m of h.mounts) ps.push(...(h.kind === 'keyhole' && !forSpacer ? keyholeShape(m[0], m[1], o) : [circ(m[0], m[1], o.screwD / 2 + 0.15)]));
    return U(ps);
  }

  // ---------------------------------------------------------------- solids
  let MF = null;
  function useManifold(M) { MF = M || null; }
  function solid(layers) {
    const L = layers.filter(l => l.z1 > l.z0 + 1e-6 && l.polys.length);
    if (!L.length) return new Float64Array(0);
    if (MF) {
      const bin = [], k = m => { bin.push(m); return m; };
      try {
        const ps = L.map(l => k(k(k(new MF.CrossSection(l.polys.flatMap(q => [q.outer, ...(q.holes || [])]), 'EvenOdd')).extrude(l.z1 - l.z0)).translate([0, 0, l.z0])));
        const m = ps.length === 1 ? ps[0] : k(MF.Manifold.union(ps));
        if (!m.isEmpty()) {
          const g = m.getMesh(), np = g.numProp, vp = g.vertProperties, tv = g.triVerts, q = new Float64Array(tv.length * 3);
          for (let n = 0; n < tv.length; n++) { const s2 = tv[n] * np; q[n * 3] = vp[s2]; q[n * 3 + 1] = vp[s2 + 1]; q[n * 3 + 2] = vp[s2 + 2]; }
          return q;
        }
      } catch (e) { /* stepped extrude below */ } finally { for (const m of bin) { try { m.delete(); } catch (e) { /* gone */ } } }
    }
    return T.steppedExtrude(L.slice().sort((a, b) => a.z0 - b.z0));
  }
  function flipP(p) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i]; q[i + 1] = -p[i + 1]; q[i + 2] = -p[i + 2]; } return q; }
  function moveP(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + dz; } return q; }
  function toPlate(p, flip) { let q = flip ? flipP(p) : p; if (!q.length) return q; const b = C.bbox(q); return moveP(q, -b.min[0], -b.min[1], -b.min[2]); }

  // the cells a letter (or the panel) splits into so each piece fits the bed
  function cellsFor(b, o, pad) {
    const Ub = usable(o), lim = Math.min(Ub.w, Ub.d) - (pad || 2), lim2 = Math.max(Ub.w, Ub.d) - (pad || 2);
    // fits as is (either way round)
    if ((b.w <= Ub.w && b.h <= Ub.d) || (b.w <= Ub.d && b.h <= Ub.w)) return null;
    // split along the long side first, then both
    let nx = 1, ny = 1;
    const fits = () => { const w = b.w / nx, h = b.h / ny; return (w <= lim2 && h <= lim) || (w <= lim && h <= lim2); };
    while (!fits() && nx * ny < 2000) { if (b.w / nx >= b.h / ny) nx++; else ny++; }
    const xs = Array.from({ length: nx - 1 }, (_, i) => b.x0 + b.w * (i + 1) / nx), ys = Array.from({ length: ny - 1 }, (_, j) => b.y0 + b.h * (j + 1) / ny);
    const cells = []; const X = [b.x0 - 5, ...xs, b.x1 + 5], Y = [b.y0 - 5, ...ys, b.y1 + 5];
    for (let j = 0; j < Y.length - 1; j++) for (let i = 0; i < X.length - 1; i++) cells.push({ i, j, r: rect(X[i], Y[j], X[i + 1], Y[j + 1]) });
    return { xs, ys, cells };
  }
  // cut a set of layers into the cells
  function cutLayers(layers, cells) { return cells.map(c => layers.map(l => ({ z0: l.z0, z1: l.z1, polys: Int(l.polys, [c.r]) }))); }

  function build(raw, M) {
    if (M) useManifold(M);
    const o = options(raw), warnings = [];
    const asked = o.height;
    let H = o.height, minH = null;
    if (o.text) {
      minH = minHeight(o);
      if (minH == null) warnings.push('This font is too thin for lit letters with these walls. Try a bolder font or thinner walls.');
      else if (H < minH) { if (o.autoHeight) { H = minH; warnings.push(`Letters raised to ${H} mm, the smallest size where every stroke keeps a lit channel in this font.`); } else warnings.push(`Below ${minH} mm some strokes are too thin to light.`); }
    }
    o.height = H;
    const L = letters(o, H);
    if (L.dropped.length) warnings.push(`Left out (not in this font): ${L.dropped.join(' ')}`);
    const front = o.style === 'front', capFit = o.faceFit === 'cap' || !front;
    const parts = [], assembled = [];
    const railOn = o.backer === 'rail' && L.pieces.length, panelOn = o.backer === 'panel' && L.pieces.length;
    const railY = railOn ? H * 0.42 : null;
    const backZ = 0; // letters' back face (on the wall, the rail or the panel)
    const add = (role, name, p, color, flip, extra) => {
      if (!p || !p.length) return null;
      const local = toPlate(p, flip), b = C.bbox(local);
      const pt = Object.assign({ role, name, a: p, local, color, size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] }, extra || {});
      parts.push(pt); return pt;
    };
    const holesAll = [];
    let ledRoom = Infinity, minWireOK = true;
    L.pieces.forEach((pc, idx) => {
      const s = shapes(pc.polys, o), fit = pc.fit || letterFit(pc.polys, o);
      const label = `${pc.ch}${pc.sub ? ' ' + pc.sub : ''}`, nm = `Letter ${idx + 1} (${label})`;
      const h = placeHoles(s, o, pc, railY); holesAll.push(h);
      if (o.wireHole && !h.wire) minWireOK = false;
      // the widest LED strip that lies flat inside this letter
      const room = s.ledge.length ? (() => { let lo = 0, hi = 30; for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; if (Off(s.ledge, -m / 2).length) lo = m; else hi = m; } return lo; })() : 0;
      ledRoom = Math.min(ledRoom, room); pc.ledRoom = +room.toFixed(1);
      const holes = holePolys(h, o);
      let bodyL, faceL = [], backL = [];
      const zb = front ? backZ : backZ + o.haloGap; // where the letter body starts
      if (front) {
        const top = zb + o.depth;
        bodyL = [{ z0: zb, z1: zb + o.backT, polys: Dif(s.P, holes) }];
        if (capFit) bodyL.push({ z0: zb + o.backT - 0.01, z1: top, polys: s.ring });
        else { const zl = top - o.inset - o.faceT; bodyL.push({ z0: zb + o.backT - 0.01, z1: zl, polys: s.ringLow }, { z0: zl - 0.01, z1: top, polys: s.ring }); }
        if (capFit) faceL = [{ z0: top - o.plugH, z1: top + 0.01, polys: s.plug }, { z0: top, z1: top + o.faceT, polys: s.P }];
        else { const zt = top - o.inset; faceL = [{ z0: zt - o.faceT, z1: zt, polys: s.faceIn }]; }
      } else if (o.style === 'halo') {
        // halo: back cap (translucent, on the spacers) -> body (returns + front face)
        const z1 = zb + o.faceT, top = z1 + o.depth;
        backL = [{ z0: zb, z1, polys: Dif(s.P, holes) }, { z0: z1 - 0.01, z1: z1 + o.plugH, polys: s.plug }];
        bodyL = [{ z0: z1, z1: top - o.faceT + 0.01, polys: s.ring }, { z0: top - o.faceT, z1: top, polys: s.P }];
      } else {
        // front-lit and halo: back cap -> open returns -> front cap, both caps translucent
        const z1 = zb + o.faceT, top = z1 + o.depth;
        backL = [{ z0: zb, z1, polys: Dif(s.P, holes) }, { z0: z1 - 0.01, z1: z1 + o.plugH, polys: s.plug }];
        bodyL = [{ z0: z1, z1: top, polys: s.ring }];
        faceL = [{ z0: top - o.plugH, z1: top + 0.01, polys: s.plug }, { z0: top, z1: top + o.faceT, polys: s.P }];
      }
      const cut = cellsFor(pc.bbox, o, 2);
      const groups = cut ? cut.cells : [null];
      const mk = (layers, role, what, color, flip) => {
        const sets = cut ? cutLayers(layers, cut.cells) : [layers];
        sets.forEach((ls, ci) => {
          const p = solid(ls); if (!p.length) return;
          const nm2 = sets.length > 1 ? `${nm} ${what} ${sets.length <= 26 ? String.fromCharCode(97 + ci) : ci + 1}` : `${nm} ${what}`;
          const pt = add(role, nm2, p, color, flip, { letter: idx, what }); if (pt) assembled.push(pt);
        });
      };
      if (front) {
        mk(bodyL, 'body', 'body', o.colors.body, false);
        mk(faceL, 'face', 'face', o.colors.face, capFit);
      } else {
        if (o.style === 'both') { mk(bodyL, 'body', 'body', o.colors.body, false); mk(faceL, 'face', 'face', o.colors.face, true); }
        else mk(bodyL, 'body', 'body', o.colors.body, true);
        mk(backL, 'face', 'back', o.colors.face, false);
        // spacers: a tube at each screw
        h.mounts.forEach((m, k) => {
          const sp = U([circ(m[0], m[1], 6, 48)]), hole = circ(m[0], m[1], o.screwD / 2 + 0.15, 32);
          const p = solid([{ z0: backZ, z1: backZ + o.haloGap, polys: Dif(sp, [hole]) }]);
          const pt = add('spacer', `${nm} spacer ${k + 1}`, p, o.colors.body, false, { letter: idx }); if (pt) assembled.push(pt);
        });
      }
      // splice strips glued inside across each cut of the body
      if (cut && o.style !== 'both') {
        const zf = front ? zb + o.backT : zb + o.faceT + o.depth - o.faceT; // floor (front) or inside of the face (halo)
        const base = front ? Off(s.ledge, -0.4) : Off(s.P, -(o.wall + 0.4));
        let k = 0;
        const Yb = [pc.bbox.y0 - 1, ...cut.ys, pc.bbox.y1 + 1], Xb = [pc.bbox.x0 - 1, ...cut.xs, pc.bbox.x1 + 1];
        const bands = [];
        for (const x of cut.xs) for (let j = 0; j < Yb.length - 1; j++) bands.push(rect(x - 12, Yb[j] + (j ? 13 : 0), x + 12, Yb[j + 1] - (j < Yb.length - 2 ? 13 : 0)));
        for (const y of cut.ys) for (let i = 0; i < Xb.length - 1; i++) bands.push(rect(Xb[i] + (i ? 13 : 0), y - 12, Xb[i + 1] - (i < Xb.length - 2 ? 13 : 0), y + 12));
        for (const band of bands) for (const Q of Int(base, [band])) {
          if (A([Q]) < 30) continue; const p = solid(front ? [{ z0: zf, z1: zf + 2, polys: [Q] }] : [{ z0: zf - 2, z1: zf, polys: [Q] }]);
          const pt = add('splice', `${nm} splice ${++k}`, p, o.colors.body, false, { letter: idx }); if (pt) assembled.push(pt);
        }
        warnings.push(`${label} is bigger than your bed, so it prints in ${cut.cells.length} pieces with splice strips glued inside.`);
      }
      if (o.mount !== 'none' && !h.mounts.length && front) warnings.push(`${label} has no room for a ${o.mount === 'keyhole' ? 'keyhole' : 'screw hole'}; tape or glue it.`);
    });
    if (o.wireHole && !minWireOK) warnings.push('A letter is too thin for a wire hole; run its wire from a neighbor.');
    if (L.pieces.length && ledRoom < o.led) warnings.push(`The narrowest letter fits a ${Math.floor(ledRoom)} mm LED strip; your ${o.led} mm strip is too wide for it. Use a narrower strip or bigger letters.`);
    // ---- rail / panel behind the letters
    const bb = L.pieces.length ? L.bbox : { x0: 0, x1: 0, y0: 0, y1: 0, w: 0, h: 0 };
    const zBack = o.style === 'halo' ? backZ : backZ; // the back plane the letters (or spacers) sit on
    const Ub = usable(o), longSide = Math.max(Ub.w, Ub.d) - 4;
    if (railOn) {
      const x0 = bb.x0 - 10, x1 = bb.x1 + 10, y0 = railY - o.railH / 2, y1 = railY + o.railH / 2, t = 3;
      const holes = U(holesAll.flatMap(h => [h.wire ? circ(h.wire[0], h.wire[1], o.wireD / 2 + 0.5) : null].concat(h.mounts.map(m => circ(m[0], m[1], o.screwD / 2 + 0.2))).filter(Boolean)).filter(c => c.outer.every(q => q[1] > y0 + t + 0.5 && q[1] < y1 - t - 0.5)));
      const n = Math.max(1, Math.ceil((x1 - x0) / longSide)), seg = (x1 - x0) / n;
      // wall screws: one per segment end region, clear of the letter holes
      const wallScrews = []; for (let i = 0; i < n; i++) for (const fx of [0.15, 0.85]) { const x = x0 + seg * (i + fx); if (!holes.some(Q => Math.abs(bboxOf([Q]).cx - x) < 10)) wallScrews.push(circ(x, railY, 2.4, 32)); }
      const allH = U(holes.concat(wallScrews));
      for (let i = 0; i < n; i++) {
        const a = x0 + seg * i, b = a + seg, R = [rect(a, y0, b, y1)], inner = [rect(a + (i === 0 ? t : -1), y0 + t, b - (i === n - 1 ? t : -1), y1 - t)];
        const p = solid([{ z0: zBack - t, z1: zBack, polys: Dif(R, allH) }, { z0: zBack - o.railD, z1: zBack - t + 0.01, polys: Dif(R, inner) }]);
        const pt = add('backer', n > 1 ? `Rail ${i + 1}` : 'Rail', p, o.colors.backer, true); if (pt) assembled.push(pt);
        if (i) { // a joiner sleeve inside the seam
          const c = 0.3, J = [rect(a - 20, y0 + t + c, a + 20, y1 - t - c)], Ji = [rect(a - 21, y0 + t + c + 2.4, a + 21, y1 - t - c - 2.4)];
          const pj = solid([{ z0: zBack - t - 2.4, z1: zBack - t - c, polys: J }, { z0: zBack - o.railD + 1, z1: zBack - t - 2.4 + 0.01, polys: Dif(J, Ji) }]);
          const pq = add('backer', `Rail joiner ${i}`, pj, o.colors.backer, true); if (pq) assembled.push(pq);
        }
      }
      if (n > 1) warnings.push(`The rail prints in ${n} segments that join with sleeves.`);
    }
    if (panelOn) {
      const all = U(L.pieces.flatMap(p => p.polys));
      let pan = Off(Off(all, o.margin + 12), -12); pan = Off(Off(pan, -2), 2);
      const holes = U(holesAll.flatMap(h => [h.wire ? circ(h.wire[0], h.wire[1], o.wireD / 2 + 0.5) : null].filter(Boolean)));
      // wall screws in the margin at both ends
      const pb = bboxOf(pan), free = Dif(Off(pan, -6), Off(all, 4)), pts = samples(free, 80);
      const pick = side => { let best = null, bd = Infinity; for (const p of pts) { const d = Math.abs(p[0] - (side ? pb.x1 : pb.x0)) + Math.abs(p[1] - pb.cy) * 0.5; if (d < bd) { bd = d; best = p; } } return best; };
      const ws = [pick(0), pick(1)].filter(Boolean).map(p => circ(p[0], p[1], 2.4, 32));
      const panel = Dif(pan, U(holes.concat(ws)));
      // segments: cut in the gaps between letters where possible
      const cuts = []; let start = pb.x0;
      while (pb.x1 - start > longSide) {
        let best = start + longSide - 1, bs = Infinity;
        for (let x = start + longSide * 0.5; x <= start + longSide - 1; x += 2) { const ov = A(Int(all, [rect(x - 1, pb.y0 - 1, x + 1, pb.y1 + 1)])); const sc = ov * 10 + (start + longSide - x) * 0.01; if (sc < bs) { bs = sc; best = x; } }
        cuts.push(best); start = best;
      }
      const X = [pb.x0 - 1, ...cuts, pb.x1 + 1];
      const tall = pb.h > Math.min(Ub.w, Ub.d) - 4;
      for (let i = 0; i < X.length - 1; i++) {
        const ps = Int(panel, [rect(X[i], pb.y0 - 1, X[i + 1], pb.y1 + 1)]);
        const p = solid([{ z0: zBack - o.backerT, z1: zBack, polys: ps }]);
        const pt = add('backer', X.length > 2 ? `Panel ${i + 1}` : 'Panel', p, o.colors.backer, false); if (pt) assembled.push(pt);
      }
      cuts.forEach((x, i) => { const Q = Int(Off(pan, -3), [rect(x - 15, pb.y0, x + 15, pb.y1)]); const p = solid([{ z0: zBack - o.backerT - 2.4, z1: zBack - o.backerT, polys: Q }]); const pt = add('backer', `Panel splice ${i + 1}`, p, o.colors.backer, false); if (pt) assembled.push(pt); });
      if (tall) warnings.push('The panel is taller than your bed; pick a smaller margin or letters.');
      if (cuts.length) warnings.push(`The panel prints in ${cuts.length + 1} segments, cut between letters, with splice strips glued behind.`);
    }
    // ---- stats
    const fils = [];
    for (const pt of parts) if (!fils.includes(pt.color)) fils.push(pt.color);
    let vol = 0; for (const pt of parts) vol += Math.abs(C.signedVolume ? C.signedVolume(pt.local) : 0);
    const Ub2 = usable(o);
    for (const pt of parts) pt.fits = (pt.size[0] <= Ub2.w + 0.01 && pt.size[1] <= Ub2.d + 0.01) || (pt.size[0] <= Ub2.d + 0.01 && pt.size[1] <= Ub2.w + 0.01);
    const unfit = parts.filter(p => !p.fits);
    if (unfit.length) warnings.push(`${unfit.length} part${unfit.length > 1 ? 's do' : ' does'} not fit your bed.`);
    const fitBad = L.pieces.filter(p => p.fit && !p.fit.ok).map(p => `${p.ch}: ${p.fit.issues.join(', ')}`);
    const stats = {
      letters: L.pieces.length, chars: [...o.text].filter(c => !/\s/.test(c)).length, height: +H.toFixed(1), asked, minHeight: minH,
      width: Math.round(bb.w), signH: Math.round(bb.h), depth: +(o.style === 'front' ? o.depth + (capFit ? o.faceT : 0) : o.haloGap + o.faceT + o.depth + (o.style === 'both' ? o.faceT : 0)).toFixed(1),
      parts: parts.length, colors: fils.length, grams: Math.round(vol / 1000 * 1.24), ledRoom: L.pieces.length ? +ledRoom.toFixed(1) : 0,
      fitOK: !fitBad.length, fitBad
    };
    return { options: o, letters: L, parts, assembled, holes: holesAll, stats, warnings, filaments: fils.map(c => ({ color: c })) };
  }

  function gateInfo(raw) {
    const o = options(raw), reasons = [];
    const n = [...o.text].filter(c => !/\s/.test(c)).length;
    if (n > FREE.maxChars) reasons.push(`${n} letters (free: up to ${FREE.maxChars})`);
    if (o.height > FREE.maxHeight) reasons.push(`${Math.round(o.height)} mm letters (free: up to ${FREE.maxHeight} mm)`);
    return { pro: reasons.length > 0, reasons, chars: n, height: o.height };
  }

  // ---------------------------------------------------------------- plates and files
  function arrangePlates(res) {
    const U2 = usable(res.options);
    return PL.arrange(res.parts.map(pt => ({ name: pt.name, p: pt.local, color: pt.color })), U2.w, U2.d, { gap: 4, maxZ: U2.z });
  }
  function export3MF(res, eo) {
    eo = eo || {};
    const cols = res.filaments.map(f => f.color), A2 = arrangePlates(res), objs = [], plates = [];
    A2.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, parts: [{ name: it.name, p: it.p, color: it.color, extruder: cols.indexOf(it.color) + 1 }] }); }); plates.push(ids); });
    A2.unfit.forEach(u => { plates.push([objs.length]); objs.push({ name: u.name, parts: [{ name: u.name, p: u.p, color: u.color, extruder: cols.indexOf(u.color) + 1 }] }); });
    return T.threeMF(objs, { title: eo.name || 'Lightbox letters', plates, bambu: eo.bambu === undefined ? res.options.bambu : eo.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const o = res.options, st = res.stats, L = ['Expressarte lightbox letters', ''];
    L.push(`"${o.text}" in ${FONTS.find(f => f.id === o.font).label.toLowerCase()} letters ${st.height} mm tall, ${st.width} mm wide overall, ${st.depth} mm deep.`);
    L.push(o.style === 'both' ? `Front-lit and halo: open returns between a translucent front cap and a translucent back cap, ${o.haloGap} mm spacers off the wall.` : o.style === 'front' ? `Front-lit: opaque returns with a translucent face (${o.faceFit === 'cap' ? 'cap fit: the face rests on the returns and its plug ring presses inside' : 'recessed: the face sits ' + o.inset + ' mm inside on a ledge'}), ${o.clearance} mm clearance.` : `Halo: opaque face and returns, a translucent back cap, ${o.haloGap} mm spacers off the wall.`);
    L.push('', 'Filaments'); res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}${f.color === o.colors.face ? ' (translucent: natural or white PETG/PLA works best)' : ''}`));
    L.push('', 'Print these'); for (const pt of res.parts) L.push(`  ${pt.name}  ${Math.round(pt.size[0])} \u00d7 ${Math.round(pt.size[1])} \u00d7 ${pt.size[2].toFixed(1)} mm`);
    L.push('', 'Printing',
      '  - Bodies print back down (halo bodies face down), faces print flange down: no supports.',
      '  - Faces: translucent filament, 2 walls, 0.2 mm layers. One or two layers of white under a color face spread the light.',
      '  - Bodies: opaque filament, 3 walls so light does not leak through the returns.',
      '', 'Lighting',
      `  - Stick a ${o.led} mm LED strip (or LED modules) to the inside back, in a loop around each letter, about ${Math.round(o.depth / 2)} mm or more from the face for even light.`,
      `  - The narrowest letter fits a ${st.ledRoom} mm strip.`,
      '  - Feed the wire through the wire hole. Low-voltage (5 V or 12 V) LEDs only.');
    if (res.warnings.length) { L.push('', 'Notes'); res.warnings.forEach(w => L.push('  - ' + w)); }
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, eo) {
    eo = eo || {}; const base = eo.fileBase || 'lightbox_letters', slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase(), out = [];
    out.push({ name: `${base}.3mf`, data: export3MF(res, eo) });
    for (const pt of res.parts) out.push({ name: `stl/${base}_${slug(pt.name)}.stl`, data: new Uint8Array(C.writeSTL(pt.local, pt.name)) });
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }

  const api = { STYLES, FITS, MOUNTS, BACKERS, FONTS, LEDS, PALETTE, FACE_PALETTE, LED_COLORS, FREE, LIMITS, DEFAULTS, PRESETS, options, presetOptions, usable,
    letters, shapes, letterFit, fitAt, minHeight, placeHoles, keyholeShape, cellsFor, build, gateInfo, arrangePlates, export3MF, notes, files, useManifold };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPLightbox = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
