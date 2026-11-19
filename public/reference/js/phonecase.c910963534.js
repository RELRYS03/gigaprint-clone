/* Expressarte phone case generator: a bumper case for a chosen phone, with a back design (patterns, logo, text) and
   magnetic snap-on add-ons that hold things. Also builds hard snap-on MacBook lid and bottom shells, split to the
   chosen printer bed with interlocking glue seams.

   Units are mm. Every solid is built and combined with Manifold (WebAssembly), so each exported part is a closed,
   manifold mesh. build(raw, M) takes the initialized Manifold module.

   Frames
   - Case frame = print frame: x to the right as seen from the SCREEN, y toward the top of the phone, z up. The case
     prints back down (z = 0 is the outside of the back), screen side up, so the lip over the screen is the last thing
     printed and nothing needs supports.
   - Back view (u, v): how you look at the back of the phone. u = -x, v = y. Patterns, logo, text and add-on positions
     are designed in the back view so they read the right way round on the finished case.
   - Assembled view = the case turned over (rotated 180\u00b0 about y): (x, y, z) -> (-x, y, -z). The back faces up, so the
     assembled frame IS the back view with w = z out of the back; add-ons sit at w >= 0.

   Mount: the case takes a 56 mm adhesive magnetic ring (recess on the inside of the back) or a ring of 6 \u00d7 2 mm disc
   magnets; every add-on has 6 \u00d7 2 mm magnet pockets on its flat mating face. A slide-on rail would have to stick out of
   the back, which is the side on the bed, so it could not print without supports; magnets keep the back flat and let
   add-ons swap and turn. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PM = G.GPPhoneModels || (typeof require === 'function' ? require('./phonecase-models.js') : null);
  const CL = G.ClipperLib || (typeof require === 'function' ? require('clipper-lib') : null);
  const stampApi = () => G.GPStamp || (typeof require === 'function' ? require('./stamp.js') : null);
  const monoApi = () => G.GPMonogram || (typeof require === 'function' ? require('./monogram.js') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (v === '' || v === null || v === undefined || !isFinite(+v)) ? d : +v;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- choices
  const MATERIALS = { tpu: 'Flexible (TPU)', rigid: 'Rigid (PLA / PETG), two-part' };
  const PATTERNS = {
    none: { label: 'Plain', pro: false },
    hex: { label: 'Hex tiles', pro: false, kind: 'cells', scale: 9, line: 1.2 },
    honeycomb: { label: 'Honeycomb cutouts', pro: false, kind: 'cells', scale: 8, line: 1.6, style: 'cut' },
    waves: { label: 'Waves', pro: false, kind: 'lines', scale: 6, line: 1.4 },
    knurl: { label: 'Diamond knurl', pro: false, kind: 'cells', scale: 5, line: 0.9 },
    dots: { label: 'Dots', pro: false, kind: 'cells', scale: 7, line: 1.4 },
    stripes: { label: 'Ribs', pro: false, kind: 'lines', scale: 5, line: 1.8 },
    voronoi: { label: 'Voronoi', pro: true, kind: 'cells', scale: 11, line: 1.4 },
    carbon: { label: 'Carbon weave', pro: true, kind: 'cells', scale: 7, line: 0.8 },
    topo: { label: 'Topographic', pro: true, kind: 'lines', scale: 6, line: 1.0 },
    lowpoly: { label: 'Low-poly', pro: true, kind: 'cells', scale: 12, line: 1.0 },
    chevron: { label: 'Chevron', pro: true, kind: 'lines', scale: 7, line: 1.6 },
    scales: { label: 'Dragon scales', pro: true, kind: 'lines', scale: 8, line: 1.2 }
  };
  const PAT_STYLES = { carved: 'Carved in', raised: 'Raised', cut: 'Cut through', inlay: 'Inlaid color' };
  const BADGE_STYLES = { deboss: 'Debossed', emboss: 'Embossed', inlay: 'Inlaid color', cut: 'Cut through' };
  const FONTS = {
    slab: { label: 'Slab', pro: false }, block: { label: 'Block', pro: false }, round: { label: 'Round', pro: false }, chunky: { label: 'Chunky', pro: false },
    tall: { label: 'Tall', pro: true }, western: { label: 'Western', pro: true }, script: { label: 'Script', pro: true }
  };
  const ADDONS = {
    wallet: { label: 'Card wallet', note: 'Holds 1 to 3 cards' },
    kickstand: { label: 'Fold-out kickstand', note: 'Prints in place, hinge and all' },
    ring: { label: 'Finger ring', note: 'A loop for one finger' },
    strap: { label: 'Hand strap anchors', note: 'Thread a 20 mm strap through' },
    earbuds: { label: 'Earbud case holder', note: 'Snug cradle with lips' },
    clip: { label: 'Pen / lip balm clip', note: 'C-clip for a pen, lip balm or cable' },
    opener: { label: 'Bottle opener', note: 'Pops caps' }
  };
  const CLIPS = { pen: { label: 'Pen or stylus (9 mm)', d: 9, len: 50 }, balm: { label: 'Lip balm (16 mm)', d: 16, len: 46 }, cable: { label: 'Cable (5 mm)', d: 5, len: 14 } };
  const PALETTE = [
    { name: 'Black', hex: '#1E1E1E' }, { name: 'White', hex: '#F7F7F2' }, { name: 'Gray', hex: '#8A8D91' }, { name: 'Navy', hex: '#1F3A68' },
    { name: 'Red', hex: '#C8102E' }, { name: 'Orange', hex: '#E8730C' }, { name: 'Yellow', hex: '#F5C518' }, { name: 'Forest', hex: '#2F6B4F' },
    { name: 'Mint', hex: '#8FD3B6' }, { name: 'Purple', hex: '#7B4FB8' }, { name: 'Pink', hex: '#F2A0B5' }, { name: 'Sand', hex: '#E6D3B3' }
  ];
  const LIMITS = { freeColors: 2, freeAddons: 1, maxChars: 24 };
  // monogram on the back: finishes and positions (the styles and frames live in monogram.js)
  const MONO_FINISHES = { raised: 'Raised', deboss: 'Debossed', inlay: 'Flush inlay' };
  const MONO_POSITIONS = { center: 'Center', lower: 'Lower', camera: 'Near the camera' };
  const MONO_POSITIONS_LAPTOP = { center: 'Center', lower: 'Lower', camera: 'Upper' };
  const MONO_SIZE = { phone: { min: 10, max: 60, def: 32 }, laptop: { min: 20, max: 160, def: 70 } };
  const SPEC = { magD: 6, magT: 2, magN: 6, magR: 25.5, ringOD: 56, ringID: 46, ringT: 0.8, addonBase: 3.2, rbo: 1.5, rt: 1.0 };
  const DEFAULTS = {
    phone: 'iphone17pro', material: 'tpu', clearance: null, wall: 1.5, back: null, lip: 1.5, lipH: null,
    buttons: 'covers', camera: 'guard', bottom: 'ports', lanyard: 'none', mount: 'none',
    pattern: 'hex', patStyle: 'raised', patScale: null, patRot: 0, patLine: null, patDepth: 0.6, patInvert: false,
    text: '', font: 'block', textH: 7, textY: -42, logoW: 28, logoY: -20, logoX: 0, badgeStyle: 'deboss', badgeDepth: 0.6,
    addons: [], cards: 2, clip: 'pen', budW: 61, budH: 46, budD: 22, camDx: 0, camDy: 0, btnDy: 0,
    colors: { case: '#2F6B4F', raised: '#8FD3B6', design: '#8FD3B6', badge: '#8FD3B6', guard: '#2F6B4F', addon: '#8FD3B6', mono: '#8FD3B6' },
    singleColor: false,
    monoText: '', monoOrder: 'classic', monoStyle: 'circle', monoFrame: 'auto', monoPos: 'center', monoSize: null, monoFinish: 'raised', monoDepth: 0.6,
    bed: [256, 256], bedZ: 256, bambu: 'A1'
  };

  function options(raw) {
    raw = raw || {};
    const o = { ...DEFAULTS, ...raw };
    o.colors = { ...DEFAULTS.colors, ...(raw.colors || {}) };
    for (const k of Object.keys(DEFAULTS.colors)) { const v = String(o.colors[k] || ''); o.colors[k] = /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : DEFAULTS.colors[k]; }
    o.singleColor = !!raw.singleColor;
    if (o.singleColor) {
      o.colors.raised = o.colors.design = o.colors.badge = o.colors.guard = o.colors.addon = o.colors.mono = o.colors.case;
    } else {
      if (!raw.colors || raw.colors.design == null) o.colors.design = o.colors.raised;
      if (!raw.colors || raw.colors.badge == null) o.colors.badge = o.colors.raised;
      if (!raw.colors || raw.colors.addon == null) o.colors.addon = o.colors.raised;
      if (!raw.colors || raw.colors.guard == null) o.colors.guard = o.colors.case;
      if (!raw.colors || raw.colors.mono == null) o.colors.mono = o.colors.raised;
    }
    const custom = o.phone === 'custom' && o.custom?.id === 'custom';
    o.phone = custom || PM.byId[o.phone] ? o.phone : DEFAULTS.phone;
    const dev = PM.byId[o.phone], laptop = !!(dev && dev.kind === 'laptop');
    o.kind = laptop ? 'laptop' : 'phone';
    if (laptop) o.material = 'rigid';
    else o.material = MATERIALS[o.material] ? o.material : 'tpu';
    const rigid = o.material === 'rigid';
    o.clearance = clamp(num(o.clearance, laptop ? 0.4 : (rigid ? 0.35 : 0.2)), 0, 1.2);
    o.wall = clamp(num(o.wall, laptop ? 1.8 : 1.5), 1.0, 3.5);
    o.back = clamp(num(o.back, laptop ? 1.8 : (rigid ? 2.2 : 1.6)), 1.0, 4);
    o.lip = clamp(num(raw.lip, laptop ? 1.0 : (rigid ? 0.7 : 1.5)), 0.3, 2.5);
    o.lipH = clamp(num(o.lipH, laptop ? 1.2 : (rigid ? 0.7 : 0.9)), 0.4, 2.5);
    o.buttons = laptop ? 'cutouts' : (o.buttons === 'cutouts' || rigid ? 'cutouts' : 'covers');
    o.camera = laptop ? 'flush' : (o.camera === 'flush' ? 'flush' : 'guard');
    o.bottom = o.bottom === 'open' ? 'open' : 'ports';
    o.lanyard = laptop ? 'none' : (['left', 'right'].includes(o.lanyard) ? o.lanyard : 'none');
    o.pattern = PATTERNS[o.pattern] ? o.pattern : 'none';
    const P = PATTERNS[o.pattern];
    o.patStyle = PAT_STYLES[o.patStyle] ? o.patStyle : DEFAULTS.patStyle;
    o.patScale = clamp(num(o.patScale, P.scale || 8), 3, 30);
    o.patLine = clamp(num(o.patLine, P.line || 1.2), 0.6, 6);
    if (o.patStyle === 'cut') o.patLine = Math.max(o.patLine, 1.0);
    o.patRot = ((num(o.patRot, 0) % 360) + 360) % 360;
    o.patDepth = clamp(num(o.patDepth, 0.6), 0.3, 2);
    o.patInvert = !!raw.patInvert;
    o.text = String(o.text == null ? '' : o.text).replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxChars);
    o.font = FONTS[o.font] ? o.font : 'block';
    o.textH = clamp(num(o.textH, laptop ? 14 : 7), 3, laptop ? 40 : 20);
    o.textY = clamp(num(o.textY, laptop ? -40 : -42), laptop ? -200 : -90, laptop ? 200 : 90);
    o.image = Array.isArray(raw.image) && raw.image.length ? raw.image : null;
    o.imageName = String(raw.imageName || '').slice(0, 80);
    o.logoW = clamp(num(o.logoW, laptop ? 56 : 28), 6, laptop ? 160 : 70);
    o.logoX = clamp(num(o.logoX, 0), laptop ? -80 : -40, laptop ? 80 : 40);
    o.logoY = clamp(num(o.logoY, laptop ? 30 : -20), laptop ? -200 : -90, laptop ? 200 : 90);
    o.badgeStyle = BADGE_STYLES[o.badgeStyle] ? o.badgeStyle : 'deboss';
    o.badgeDepth = clamp(num(o.badgeDepth, 0.6), 0.3, 2);
    { // monogram
      const MG = monoApi();
      o.monoText = MG ? MG.cleanInitials(raw.monoText) : '';
      o.monoOrder = o.monoOrder === 'straight' ? 'straight' : 'classic';
      o.monoStyle = MG && MG.STYLES[o.monoStyle] ? o.monoStyle : 'circle';
      o.monoFrame = MG && MG.FRAMES[o.monoFrame] ? o.monoFrame : 'auto';
      o.monoPos = MONO_POSITIONS[o.monoPos] ? o.monoPos : 'center';
      const MS = MONO_SIZE[laptop ? 'laptop' : 'phone'];
      o.monoSize = clamp(num(o.monoSize, MS.def), MS.min, MS.max);
      o.monoFinish = MONO_FINISHES[o.monoFinish] ? o.monoFinish : 'raised';
      o.monoDepth = clamp(num(o.monoDepth, 0.6), 0.3, 1.5);
    }
    o.addons = laptop ? [] : (Array.isArray(raw.addons) ? raw.addons : []).filter((a, i, A) => ADDONS[a] && A.indexOf(a) === i);
    o.mount = laptop ? 'none' : (['ring', 'magnets'].includes(o.mount) ? o.mount : 'none');
    o.cards = Math.round(clamp(num(o.cards, 2), 1, 3));
    o.clip = CLIPS[o.clip] ? o.clip : 'pen';
    o.budW = clamp(num(o.budW, 61), 30, 75); o.budH = clamp(num(o.budH, 46), 30, 75); o.budD = clamp(num(o.budD, 22), 12, 32);
    o.camDx = clamp(num(o.camDx, 0), -3, 3); o.camDy = clamp(num(o.camDy, 0), -3, 3); o.btnDy = clamp(num(o.btnDy, 0), -4, 4);
    o.bed = [clamp(num(o.bed && o.bed[0], 256), 100, 1000), clamp(num(o.bed && o.bed[1], 256), 100, 1000)];
    o.bedZ = clamp(num(o.bedZ, 256), 60, 1000);
    return o;
  }

  // ---------------------------------------------------------------- 2D helpers (plain point loops)
  function rrect(x0, y0, x1, y1, r, n) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 1e-4, (y1 - y0) / 2 - 1e-4)); n = n || 10;
    if (r < 0.01) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const L = [], c = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]];
    for (const [cx, cy, a0] of c) for (let i = 0; i <= n; i++) { const a = a0 + Math.PI / 2 * i / n; L.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return L;
  }
  const stadium = (cx, cy, w, h, n) => rrect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, Math.min(w, h) / 2, n || 12);
  const circ = (cx, cy, r, n) => { n = n || Math.max(24, Math.min(160, Math.ceil(r * 6))); const L = []; for (let i = 0; i < n; i++) { const a = TAU * i / n; L.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return L; };
  const area2 = L => { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; };
  const rot2 = (L, a, cx, cy) => { const c = Math.cos(a), s = Math.sin(a); cx = cx || 0; cy = cy || 0; return L.map(p => [cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c]); };

  // seeded random
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // thick strokes along open polylines (back view), via Clipper; returns loops (outer and hole loops, EvenOdd-safe)
  function strokes(lines, width) {
    const S = 1000, co = new CL.ClipperOffset(2, 0.08 * S), sol = new CL.Paths();
    for (const pl of lines) if (pl.length > 1) co.AddPath(pl.map(p => ({ X: Math.round(p[0] * S), Y: Math.round(p[1] * S) })), CL.JoinType.jtRound, CL.EndType.etOpenRound);
    co.Execute(sol, width / 2 * S);
    return sol.map(path => path.map(q => [q.X / S, q.Y / S])).filter(L => L.length > 2);
  }

  // ---------------------------------------------------------------- patterns (back view, centered on 0,0)
  // returns { loops } covering the square [-R, R]^2 before rotation. cells: separate non-overlapping loops; lines:
  // stroked polylines. All loops are EvenOdd-safe (no overlaps).
  function patternLoops(id, s, lw, rotDeg, R, seed) {
    const out = [], lines = [], rnd = rng(seed || 7), P = PATTERNS[id];
    const N = Math.ceil(R / s) + 2;
    if (id === 'hex' || id === 'honeycomb') {
      const dy = s * Math.sqrt(3) / 2, rr = Math.max(0.3, (s - lw)) / Math.sqrt(3);
      for (let j = -Math.ceil(R / dy) - 1; j <= Math.ceil(R / dy) + 1; j++) for (let i = -N; i <= N; i++) {
        const cx = i * s + (j & 1 ? s / 2 : 0), cy = j * dy, L = [];
        for (let k = 0; k < 6; k++) { const a = Math.PI / 2 + k * Math.PI / 3; L.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
        out.push(L);
      }
    } else if (id === 'dots') {
      const dy = s * Math.sqrt(3) / 2, r = Math.max(0.4, (s - 2 * lw) / 2);
      for (let j = -Math.ceil(R / dy) - 1; j <= Math.ceil(R / dy) + 1; j++) for (let i = -N; i <= N; i++) out.push(circ(i * s + (j & 1 ? s / 2 : 0), j * dy, r, 28));
    } else if (id === 'knurl') {
      const h = Math.max(0.3, s - lw) / 2;
      for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) out.push(rot2([[-h, -h], [h, -h], [h, h], [-h, h]].map(p => [p[0] + i * s, p[1] + j * s]), Math.PI / 4));
    } else if (id === 'carbon') {
      const g = lw / 2;
      for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
        const x0 = i * s, y0 = j * s;
        if ((i + j) & 1) { out.push(rrect(x0 + g, y0 + g, x0 + s / 2 - g, y0 + s - g, 0.3, 2)); out.push(rrect(x0 + s / 2 + g, y0 + g, x0 + s - g, y0 + s - g, 0.3, 2)); }
        else { out.push(rrect(x0 + g, y0 + g, x0 + s - g, y0 + s / 2 - g, 0.3, 2)); out.push(rrect(x0 + g, y0 + s / 2 + g, x0 + s - g, y0 + s - g, 0.3, 2)); }
      }
    } else if (id === 'voronoi') {
      const seeds = new Map(), key = (i, j) => i + ',' + j;
      for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) seeds.set(key(i, j), [(i + 0.15 + 0.7 * rnd()) * s, (j + 0.15 + 0.7 * rnd()) * s]);
      for (let j = -N + 2; j <= N - 2; j++) for (let i = -N + 2; i <= N - 2; i++) {
        const p = seeds.get(key(i, j)); let poly = [[p[0] - 2 * s, p[1] - 2 * s], [p[0] + 2 * s, p[1] - 2 * s], [p[0] + 2 * s, p[1] + 2 * s], [p[0] - 2 * s, p[1] + 2 * s]];
        for (let dj = -2; dj <= 2 && poly.length; dj++) for (let di = -2; di <= 2 && poly.length; di++) {
          if (!di && !dj) continue; const q = seeds.get(key(i + di, j + dj)); if (!q) continue;
          const nx = q[0] - p[0], ny = q[1] - p[1], nl = Math.hypot(nx, ny), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
          const c = (nx * mx + ny * my) / nl - lw / 2; poly = clipHalf(poly, nx / nl, ny / nl, c);
        }
        if (poly.length > 2 && Math.abs(area2(poly)) > 0.5) out.push(poly);
      }
    } else if (id === 'lowpoly') {
      const pts = [];
      for (let j = -N; j <= N + 1; j++) { const row = []; for (let i = -N; i <= N + 1; i++) row.push([(i + (rnd() - 0.5) * 0.7) * s, (j + (rnd() - 0.5) * 0.7) * s]); pts.push(row); }
      for (let j = 0; j < pts.length - 1; j++) for (let i = 0; i < pts[j].length - 1; i++) {
        const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i + 1], d = pts[j + 1][i];
        const tris = (i + j) & 1 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
        for (const t of tris) { const q = insetTri(t, lw / 2); if (q) out.push(q); }
      }
    } else if (id === 'waves') {
      const amp = s * 0.32, lam = s * 2.6;
      for (let j = -N; j <= N; j++) { const L = []; for (let x = -R - s; x <= R + s; x += s / 10) L.push([x, j * s + amp * Math.sin(TAU * x / lam)]); lines.push(L); }
    } else if (id === 'stripes') {
      for (let j = -N; j <= N; j++) lines.push([[-R - s, j * s], [R + s, j * s]]);
    } else if (id === 'chevron') {
      const amp = s * 0.45;
      for (let j = -N; j <= N; j++) { const L = []; for (let i = -N * 2; i <= N * 2; i++) L.push([i * s / 2, j * s + (i & 1 ? amp : 0)]); lines.push(L); }
    } else if (id === 'scales') {
      const r = s / 2;
      for (let j = -2 * N; j <= 2 * N; j++) for (let i = -N; i <= N; i++) { const cx = i * s + (j & 1 ? s / 2 : 0), cy = j * s / 2, L = []; for (let k = 0; k <= 18; k++) { const a = Math.PI + Math.PI * k / 18; L.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } lines.push(L); }
    } else if (id === 'topo') {
      lines.push(...topoLines(s, R, rnd));
    }
    let loops = out;
    if (P && P.kind === 'lines') loops = strokes(lines, lw);
    const a = rotDeg * Math.PI / 180;
    return a ? loops.map(L => rot2(L, a)) : loops;
  }
  function clipHalf(poly, nx, ny, c) { // keep n\u00b7p <= c
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], dp = nx * p[0] + ny * p[1] - c, dq = nx * q[0] + ny * q[1] - c;
      if (dp <= 0) out.push(p);
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  }
  function insetTri(t, d) {
    const [A, B, C] = t, a = Math.hypot(B[0] - C[0], B[1] - C[1]), b = Math.hypot(A[0] - C[0], A[1] - C[1]), c = Math.hypot(A[0] - B[0], A[1] - B[1]);
    const p = a + b + c, I = [(a * A[0] + b * B[0] + c * C[0]) / p, (a * A[1] + b * B[1] + c * C[1]) / p], ar = Math.abs(area2(t)), r = 2 * ar / p;
    if (r - d < 0.25) return null; const k = (r - d) / r;
    return t.map(q => [I[0] + (q[0] - I[0]) * k, I[1] + (q[1] - I[1]) * k]);
  }
  // contour lines of a smooth seeded field, spaced about s apart (marching squares, chained into polylines)
  function topoLines(s, R, rnd) {
    const waves = []; for (let k = 0; k < 5; k++) { const lam = s * (5 + 4 * k + 3 * rnd()), th = rnd() * TAU; waves.push([Math.cos(th) * TAU / lam, Math.sin(th) * TAU / lam, rnd() * TAU, 1 / (1 + k * 0.6)]); }
    const f = (x, y) => { let v = 0; for (const w of waves) v += w[3] * Math.sin(w[0] * x + w[1] * y + w[2]); return v; };
    const h = Math.min(1.0, s / 4), n = Math.ceil(2 * R / h) + 1, F = new Float64Array(n * n);
    let g = 0, cnt = 0, lo = Infinity, hi = -Infinity;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = f(-R + i * h, -R + j * h); F[j * n + i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
    for (let j = 0; j < n - 1; j += 3) for (let i = 0; i < n - 1; i += 3) { g += Math.hypot(F[j * n + i + 1] - F[j * n + i], F[(j + 1) * n + i] - F[j * n + i]) / h; cnt++; }
    const step = (g / cnt) * s, lines = [];
    for (let lv = Math.ceil(lo / step) * step + step * 0.37; lv < hi; lv += step) {
      const segs = new Map(); // edge key -> [other key, point]
      const pt = new Map();
      const ek = (i, j, d) => (j * n + i) * 2 + d; // d 0: edge to the right of (i,j), 1: edge above
      const ip = (i, j, d) => { const k = ek(i, j, d); if (pt.has(k)) return k; const a = F[j * n + i], b = d ? F[(j + 1) * n + i] : F[j * n + i + 1], t = (lv - a) / (b - a); pt.set(k, d ? [-R + i * h, -R + (j + t) * h] : [-R + (i + t) * h, -R + j * h]); return k; };
      const link = (a, b) => { (segs.get(a) || segs.set(a, []).get(a)).push(b); (segs.get(b) || segs.set(b, []).get(b)).push(a); };
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
        const v0 = F[j * n + i] > lv, v1 = F[j * n + i + 1] > lv, v2 = F[(j + 1) * n + i + 1] > lv, v3 = F[(j + 1) * n + i] > lv;
        const c = (v0 ? 1 : 0) | (v1 ? 2 : 0) | (v2 ? 4 : 0) | (v3 ? 8 : 0); if (c === 0 || c === 15) continue;
        const B = () => ip(i, j, 0), Rr = () => ip(i + 1, j, 1), Tt = () => ip(i, j + 1, 0), Lf = () => ip(i, j, 1);
        switch (c) {
          case 1: case 14: link(Lf(), B()); break; case 2: case 13: link(B(), Rr()); break; case 4: case 11: link(Rr(), Tt()); break; case 8: case 7: link(Tt(), Lf()); break;
          case 3: case 12: link(Lf(), Rr()); break; case 6: case 9: link(B(), Tt()); break;
          case 5: link(Lf(), Tt()); link(B(), Rr()); break; case 10: link(Lf(), B()); link(Rr(), Tt()); break;
        }
      }
      const seen = new Set();
      const walk = start => { const L = [start]; seen.add(start); let cur = start; for (;;) { const nx = (segs.get(cur) || []).find(k => !seen.has(k)); if (nx === undefined) break; seen.add(nx); L.push(nx); cur = nx; } return L; };
      for (const [k, v] of segs) if (!seen.has(k) && v.length === 1) { const L = walk(k); lines.push(L.map(q => pt.get(q))); }
      for (const k of segs.keys()) if (!seen.has(k)) { const L = walk(k); L.push(L[0]); lines.push(L.map(q => pt.get(q))); }
    }
    return lines.map(L => L.filter((p, i) => i % 2 === 0 || i === L.length - 1)).filter(L => L.length > 2);
  }

  // ---------------------------------------------------------------- phone outline
  // base outline (CCW, case frame) with unit outward normals; offset(d) moves every point d along its normal, so all
  // offsets have the same point count and can be lofted into one indexed, closed mesh.
  function outline(ph, nc) {
    const a = ph.W / 2, b = ph.L / 2, e = Math.min(ph.corner.e, a - 0.5, b - 0.5), n = ph.corner.n || 2, pts = [];
    const straight = (p0, p1, k) => { for (let i = 0; i < k; i++) { const t = i / k; pts.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]); } };
    const corner = (cx, cy, q) => { for (let i = 0; i < nc; i++) { const t = (q + i / nc) * Math.PI / 2, c = Math.cos(t), s = Math.sin(t); pts.push([cx + e * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + e * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]); } };
    const ks = Math.max(2, Math.ceil(2 * (b - e) / 2.5)), kw = Math.max(2, Math.ceil(2 * (a - e) / 2.5));
    straight([a, -(b - e)], [a, b - e], ks); corner(a - e, b - e, 0);
    straight([a - e, b], [-(a - e), b], kw); corner(-(a - e), b - e, 1);
    straight([-a, b - e], [-a, -(b - e)], ks); corner(-(a - e), -(b - e), 2);
    straight([-(a - e), -b], [a - e, -b], kw); corner(a - e, -(b - e), 3);
    const N = pts.length, nr = pts.map((p, i) => { const q = pts[(i + 1) % N], r = pts[(i + N - 1) % N], tx = q[0] - r[0], ty = q[1] - r[1], l = Math.hypot(tx, ty) || 1; return [ty / l, -tx / l]; });
    return { pts, nr, N, a, b, e, at: d => pts.map((p, i) => [p[0] + nr[i][0] * d, p[1] + nr[i][1] * d]) };
  }

  // ---------------------------------------------------------------- Manifold kit
  function kit(M) {
    const bin = [];
    const k = x => { bin.push(x); return x; };
    const cs = (loops, fill) => k(new M.CrossSection(loops.filter(L => L && L.length > 2), fill || 'EvenOdd'));
    const ext = (sec, z0, z1) => k(k(sec.extrude(z1 - z0)).translate([0, 0, z0]));
    const box = (x0, y0, z0, x1, y1, z1) => k(k(M.Manifold.cube([x1 - x0, y1 - y0, z1 - z0], false)).translate([x0, y0, z0]));
    const U = list => { list = list.filter(Boolean); if (!list.length) return null; if (list.length === 1) return list[0]; return k(M.Manifold.union(list)); };
    const sub = (a, b) => b ? k(a.subtract(b)) : a;
    const add = (a, b) => b ? (a ? k(a.add(b)) : b) : a;
    const and = (a, b) => k(a.intersect(b));
    const csU = list => { list = list.filter(Boolean); if (!list.length) return null; return list.length === 1 ? list[0] : k(M.CrossSection.union(list)); };
    const off = (sec, d, seg) => k(sec.offset(d, 'Round', 2, seg || 48));
    // section in the (y, z) plane extruded along x from x0 to x1 (side cuts); loops given as [y, z]
    const extX = (loops, x0, x1) => k(k(k(cs(loops.map(L => L.map(p => [-p[1], p[0]]))).extrude(x1 - x0)).rotate([0, 90, 0])).translate([x0, 0, 0]));
    // section in the (x, z) plane extruded along y from y0 to y1; loops given as [x, z]
    const extY = (loops, y0, y1) => k(k(k(cs(loops).extrude(y1 - y0)).rotate([90, 0, 0])).translate([0, y1, 0]));
    // loft rings: rows [[d, z]] of offsets of the outline, bottom to top; capped with fans (outline is convex)
    function loft(ol, rows) {
      const N = ol.N, Rn = rows.length, vp = new Float32Array((N * Rn + 2) * 3), tv = [];
      rows.forEach(([d, z], r) => { const ring = ol.at(d); for (let i = 0; i < N; i++) { const o = (r * N + i) * 3; vp[o] = ring[i][0]; vp[o + 1] = ring[i][1]; vp[o + 2] = z; } });
      const c0 = N * Rn, c1 = c0 + 1; vp[c0 * 3 + 2] = rows[0][1]; vp[c1 * 3 + 2] = rows[Rn - 1][1];
      for (let r = 0; r < Rn - 1; r++) for (let i = 0; i < N; i++) { const a = r * N + i, a1 = r * N + (i + 1) % N, b = a + N, b1 = a1 + N; tv.push(a, a1, b1, a, b1, b); }
      for (let i = 0; i < N; i++) { tv.push(c0, (i + 1) % N, i); tv.push(c1, (Rn - 1) * N + i, (Rn - 1) * N + (i + 1) % N); }
      return k(new M.Manifold(new M.Mesh({ numProp: 3, vertProperties: vp, triVerts: Uint32Array.from(tv) })));
    }
    const free = () => { for (const x of bin) { try { x.delete(); } catch (e) { /* already gone */ } } bin.length = 0; };
    return { M, k, cs, ext, box, U, sub, add, and, csU, off, extX, extY, loft, free, cyl: (r, z0, z1, n) => k(k(M.Manifold.cylinder(z1 - z0, r, r, n || 48)).translate([0, 0, z0])) };
  }
  function soup(m) {
    const g = m.getMesh(), np = g.numProp, vp = g.vertProperties, tv = g.triVerts, out = new Float32Array(tv.length * 3);
    for (let i = 0; i < tv.length; i++) { const s = tv[i] * np; out[i * 3] = vp[s]; out[i * 3 + 1] = vp[s + 1]; out[i * 3 + 2] = vp[s + 2]; }
    return out;
  }
  const empty = m => !m || m.isEmpty();
  // drop zero-volume slivers; for a case shell also drop loose islands (bits a cut-through pattern frees would fall out)
  function clean(K, m, onlyLargest) {
    if (empty(m)) return m;
    const parts = m.decompose(); parts.forEach(K.k);
    if (parts.length < 2) return m;
    const vols = parts.map(b => b.volume()), big = Math.max(...vols);
    const keep = parts.filter((b, i) => onlyLargest ? vols[i] === big : vols[i] > Math.max(1, big * 1e-4));
    return keep.length === 1 ? keep[0] : K.k(K.M.Manifold.compose(keep));
  }


  function accentOn(o) {
    return !o.singleColor && String(o.colors.raised || '').toUpperCase() !== String(o.colors.case || '').toUpperCase();
  }
  function collectColors(o, parts) {
    const cols = [];
    const add = c => { c = String(c || '').toUpperCase(); if (/^#[0-9A-F]{6}$/.test(c) && !cols.includes(c)) cols.push(c); };
    add(o.colors.case);
    const raised = String(o.colors.raised || '').toUpperCase();
    if (accentOn(o) && parts.some(q => String(q.color || '').toUpperCase() === raised)) add(o.colors.raised);
    for (const q of parts) add(q.color);
    return cols;
  }

  // ---------------------------------------------------------------- the case
  function caseGeometry(o, ph, K, warnings) {
    const nc = 28, ol = outline(ph, nc), a = ol.a, b = ol.b;
    const c = o.clearance, w = o.wall, rigid = o.material === 'rigid', Tz = ph.T + (rigid ? 0 : 0.25);
    const D = c + w, rbo = Math.min(SPEC.rbo, w + 0.5), rt = Math.min(SPEC.rt, o.lipH * 0.9, w * 0.8);
    const rbPh = Math.min(ph.edge.back, Tz / 3), rfPh = Math.min(ph.edge.front, Tz / 3);
    // design relief: raised features thicken the back; magnets may need a thicker back too
    const pat = o.pattern !== 'none' ? PATTERNS[o.pattern] : null;
    const hasBadge = !!(o.image || o.text);
    let rz = 0;
    if (pat && o.patStyle === 'raised') rz = Math.max(rz, o.patDepth);
    if (hasBadge && o.badgeStyle === 'emboss') rz = Math.max(rz, o.badgeDepth);
    if (o.monoText && o.monoFinish === 'raised') rz = Math.max(rz, o.monoDepth);
    let bt = o.back;
    if (o.mount === 'magnets' && bt < SPEC.magT + 0.7) { bt = SPEC.magT + 0.7; warnings.push(`The back is ${bt.toFixed(1)} mm thick so the magnets fit.`); }
    if (o.mount === 'ring' && bt < SPEC.ringT + 0.7) bt = SPEC.ringT + 0.7;
    const B = bt + rz, zTop = B + Tz + o.lipH;
    const info = { B, bt, rz, zTop, D, outerW: ph.W + 2 * D, outerL: ph.L + 2 * D, outerT: zTop };

    // outer body
    const rows = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6 * Math.PI / 2; rows.push([D - rbo + rbo * Math.sin(t), rbo - rbo * Math.cos(t)]); }
    for (let i = 0; i <= 6; i++) { const t = i / 6 * Math.PI / 2; rows.push([D - rt + rt * Math.cos(t), zTop - rt + rt * Math.sin(t)]); }
    let body = K.loft(ol, rows);
    // cavity: phone back edge, straight side, front edge, then the lip over the screen with a chamfered inner edge
    const cav = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6 * Math.PI / 2; cav.push([c - rbPh + rbPh * Math.sin(t), B + rbPh - rbPh * Math.cos(t)]); }
    for (let i = 0; i <= 6; i++) { const t = i / 6 * Math.PI / 2; cav.push([Math.max(-o.lip, c - rfPh + rfPh * Math.cos(t)), B + Tz - rfPh + rfPh * Math.sin(t)]); }
    const ch = Math.min(0.45, o.lipH * 0.5);
    if (cav[cav.length - 1][0] > -o.lip + 1e-3) cav.push([-o.lip, B + Tz + 0.001]);
    cav.push([-o.lip, zTop - ch], [-o.lip + ch, zTop], [-o.lip + ch + 1.2, zTop + 1.2]);
    const cavity = K.loft(ol, cav);
    const P = d => ol.at(d);
    const csP = d => K.cs([P(d)]);

    // lanyard tab on a bottom corner (left/right as seen from the screen)
    if (o.lanyard !== 'none') {
      const sx = o.lanyard === 'left' ? -1 : 1; let best = 0, bv = -Infinity;
      ol.pts.forEach((p, i) => { const v = sx * p[0] - p[1]; if (v > bv) { bv = v; best = i; } });
      const p = ol.at(D)[best], nr = ol.nr[best], hc = [p[0] + nr[0] * 3.6, p[1] + nr[1] * 3.6], ic = [p[0] - nr[0] * 3, p[1] - nr[1] * 3];
      const tab = K.k(M_hull(K, [circ(hc[0], hc[1], 3.4, 40), circ(ic[0], ic[1], 3.4, 40)]));
      body = K.add(body, K.ext(tab, 0, Math.min(3, zTop - 1)));
      info.lanyardHole = hc;
    }
    // button covers: raised pills outside
    const btns = ph.buttons.map(bn => ({ ...bn, x: bn.side === 'L' ? -a : a, yc: b - bn.y - o.btnDy, zc: B + bn.z }));
    const covers = [], nubs = [], cuts = [];
    for (const bn of btns) {
      const sx = Math.sign(bn.x), alwaysCut = bn.kind === 'camctl' || bn.kind === 'switch';
      const xo = sx * (a + D), xi = sx * (a + c);
      if (o.buttons === 'covers' && !alwaysCut) {
        const pl = Math.max(4, bn.len * 0.8), ph2 = Math.max(1.4, Math.min(bn.h * 0.85, 2.4));
        const pill = K.extX([stadium(bn.yc, bn.zc, pl, ph2)], sx > 0 ? xo - 0.3 : xo - 0.55, sx > 0 ? xo + 0.55 : xo + 0.3);
        covers.push(pill);
        const xm = sx * (a + D - 0.9);
        cuts.push(K.extX([stadium(bn.yc, bn.zc, bn.len + 1.2, bn.h + 0.8)], Math.min(xm, xi - sx * 1), Math.max(xm, xi - sx * 1)));
        const nl = Math.max(2, bn.len * 0.5), nh = Math.max(1.0, bn.h * 0.5), xn = sx * (a + c + 0.05);
        nubs.push(K.extX([stadium(bn.yc, bn.zc, nl, nh)], Math.min(xm + sx * 0.05, xn), Math.max(xm + sx * 0.05, xn)));
      } else {
        const m = bn.kind === 'camctl' ? 1.0 : 0.6;
        let h = bn.h + 2 * m; h = Math.min(h, 2 * (bn.zc - B) - 0.2, 2 * (zTop - 0.6 - bn.zc) + 4);
        cuts.push(K.extX([stadium(bn.yc, bn.zc, bn.len + 2 * m, Math.max(1.6, h))], sx > 0 ? xi - 1 : -(a + D + 2), sx > 0 ? a + D + 2 : xi + 1));
      }
    }
    if (covers.length && !accentOn(o)) body = K.add(body, K.U(covers));
    let shell = K.sub(body, cavity);
    // bottom: USB-C, speaker/mic slots, stylus silo, or open
    const bt0 = -(b + D + 2), bt1 = -(b + c) + 2.3, zc = B + Tz / 2, bb = ph.bottom || {};
    const slotZ = (h) => { const hh = Math.min(h, 2 * (zc - B) - 0.1); return hh; };
    if (o.bottom === 'open') {
      const half = a - ol.e * 0.75, z0 = B + 1.2;
      cuts.push(K.extY([rrect(-half, z0, half, zTop + 4, 2.2, 8)], bt0, bt1));
    } else {
      if (bb.usb) { const h = slotZ(bb.usb.h + 1.0); cuts.push(K.extY([stadium(bb.usb.x, zc, bb.usb.w + 1.0, h)], bt0, bt1)); }
      for (const g of bb.grille || []) { const x0 = Math.min(g[0], g[1]), x1 = Math.max(g[0], g[1]); cuts.push(K.extY([stadium((x0 + x1) / 2, zc, x1 - x0 + 0.6, (bb.gh || 2.2) + 0.6)], bt0, bt1)); }
      if (bb.pen) { const h = slotZ(bb.pen.h + 0.8); cuts.push(K.extY([stadium(bb.pen.x, zc, bb.pen.w + 0.8, h)], bt0, bt1)); }
    }
    // camera opening (case frame): parts are in back view from the left/top edges
    const cm = ph.camera, cmM = 0.6 + c, toX = bx => a - bx + (-o.camDx), toY = by => b - by + o.camDy;
    const camSecs = []; let hasFull = false;
    for (const q of cm.parts) {
      if (q.t === 'c') camSecs.push(K.cs([circ(toX(q.x), toY(q.y), q.d / 2 + cmM, 96)]));
      else { if (q.full) hasFull = true; const x0 = toX(q.x1), x1 = toX(q.x0), y0 = toY(q.y1), y1 = toY(q.y0); camSecs.push(K.cs([rrect(x0 - cmM, y0 - cmM, x1 + cmM, y1 + cmM, q.r + cmM, 16)])); }
    }
    let camOpen = K.csU(camSecs);
    camOpen = K.off(K.off(camOpen, 2.5, 48), -2.5, 48); // close small gaps between lenses into one clean opening
    const inner = csP(hasFull ? -0.4 : c - rbPh - 0.3);
    camOpen = K.k(camOpen.intersect(inner));
    cuts.push(K.ext(camOpen, -1, B + 0.5));
    // a two-step chamfer around the outside of the opening
    cuts.push(K.ext(K.k(K.off(camOpen, 0.7).intersect(inner)), -1, 0.35));
    cuts.push(K.ext(K.k(K.off(camOpen, 0.35).intersect(inner)), -1, 0.7));
    const camBox = camOpen.bounds();
    info.camBottom = camBox.min[1];
    // mount
    const cyDefault = ph.brand === 'iphone' ? -0.018 * ph.L : -0.02 * ph.L, RO = SPEC.ringOD / 2 + 0.3;
    let cy = Math.min(cyDefault, info.camBottom - 2 - RO);
    if (cy - RO < -b + 6) cy = -b + 6 + RO;
    info.mountY = cy; info.mount = o.mount;
    let mountKeep = null;
    if (o.mount === 'ring') {
      const ann = K.cs([circ(0, cy, RO, 160), circ(0, cy, SPEC.ringID / 2 - 0.3, 160)]);
      cuts.push(K.ext(ann, B - SPEC.ringT, B + 0.5));
      mountKeep = K.cs([circ(0, cy, RO + 1.2, 160), circ(0, cy, SPEC.ringID / 2 - 1.5, 160)]);
    } else if (o.mount === 'magnets') {
      const holes = [], keep = [];
      for (let i = 0; i < SPEC.magN; i++) { const t = TAU * i / SPEC.magN + Math.PI / 2, x = SPEC.magR * Math.cos(t), y = cy + SPEC.magR * Math.sin(t); holes.push(circ(x, y, SPEC.magD / 2 + 0.12, 48)); keep.push(circ(x, y, SPEC.magD / 2 + 1.6, 48)); }
      cuts.push(K.ext(K.cs(holes), B - SPEC.magT - 0.1, B + 0.5));
      mountKeep = K.csU(keep.map(L => K.cs([L])));
    }
    // design region: the flat part of the back, minus the camera surround, the mount and the lanyard
    let region = csP(D - rbo - 2.2);
    region = K.k(region.subtract(K.off(camOpen, 2.4)));
    if (mountKeep) region = K.k(region.subtract(mountKeep));
    info.camBox = camBox;
    return { ol, info, shell, cuts, nubs, covers, region, camOpen, inner, P, csP, B, zTop, D, rbo, rbPh, c, cy, bt };
  }
  function M_hull(K, loops) { return K.M.CrossSection.hull(loops.map(L => K.cs([L]))); }

  // ---------------------------------------------------------------- logo and text (back view -> case frame)
  function badgeLoops(o, warnings) {
    const loops = [];
    const mirror = L => L.map(p => [-p[0], p[1]]);
    if (o.image) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const Q of o.image) for (const p of Q.outer) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      const s = o.logoW / Math.max(0.01, Math.max(x1 - x0, (y1 - y0) * 0.8)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      for (const Q of o.image) for (const L of [Q.outer, ...(Q.holes || [])]) loops.push(mirror(L.map(p => [o.logoX + (p[0] - cx) * s, o.logoY + (p[1] - cy) * s])));
    }
    if (o.text) {
      const SM = stampApi(), dropped = new Set();
      let ps = [];
      try { ps = SM.textBlock([o.text], o.font, o.textH, 0.06, dropped); } catch (e) { warnings.push('The text could not be drawn in that font.'); }
      if (dropped.size) warnings.push(`Left out ${[...dropped].map(ch => `"${ch}"`).join(', ')}: this font doesn't have ${dropped.size > 1 ? 'those characters' : 'that character'}.`);
      for (const Q of ps) for (const L of [Q.outer, ...(Q.holes || [])]) loops.push(mirror(L.map(p => [p[0], o.textY + p[1]])));
    }
    return loops;
  }

  // ---------------------------------------------------------------- monogram (back view -> case frame)
  // Builds the monogram and finds the largest scale (up to the chosen size) at which it fits inside the safe area.
  // centers: functions (s, w, h) -> [x, y] in the case frame for a monogram scaled by s; the first that fits at full
  // size wins, otherwise the one that fits largest.
  function monoPlace(o, K, safe, centers, warnings, minMM, turn) {
    const MG = monoApi(); if (!MG || !o.monoText) return null;
    const m = MG.build({ initials: o.monoText, order: o.monoOrder, style: o.monoStyle, frame: o.monoFrame, size: o.monoSize });
    if (m.dropped && m.dropped.length) warnings.push(`Left out ${m.dropped.map(ch => `"${ch}"`).join(', ')}: this monogram style doesn't have ${m.dropped.length > 1 ? 'those letters' : 'that letter'}.`);
    if (!m.polys.length) return null;
    const k = turn ? -1 : 1; // turn: half a turn, so a laptop lid reads upright from behind the open screen
    const loopsAt = (s, cx, cy) => { const L = []; for (const Q of m.polys) for (const R of [Q.outer, ...Q.holes]) L.push(R.map(p => [cx - k * p[0] * s, cy + k * p[1] * s])); return L; };
    const safeA = safe.area();
    const fits = (s, c) => {
      const sec = K.cs(loopsAt(s, c[0], c[1])), A = sec.area();
      if (!(A > 0) || A > safeA) return null;
      return K.k(sec.subtract(safe)).area() <= A * 0.001 ? sec : null;
    };
    let best = null;
    for (const cf of centers) {
      const c1 = cf(1, m.w, m.h), full = fits(1, c1);
      if (full) { best = { s: 1, sec: full, c: c1 }; break; }
      let lo = 0, hi = 1, got = null;
      for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2, c = cf(mid, m.w, m.h), r = fits(mid, c); if (r) { lo = mid; got = { s: mid, sec: r, c }; } else hi = mid; }
      if (got && (!best || got.s > best.s + 1e-3)) best = got;
    }
    const big = Math.max(m.w, m.h);
    if (!best || best.s * big < (minMM || 8)) { warnings.push('There isn\'t room for the monogram in that spot. Try another position or a smaller size.'); return null; }
    if (best.s < 0.985) warnings.push(`The monogram is ${Math.round(best.s * big)} mm instead of ${Math.round(big)} mm so it stays clear of the ${o.kind === 'laptop' ? 'edges and the hinge' : 'camera and the magnetic charging area'}.`);
    const sec = K.k(best.sec.intersect(safe));
    return { sec, s: best.s, x: best.c[0], y: best.c[1], w: m.w * best.s, h: m.h * best.s, size: big * best.s, style: m.style, frame: m.frame, letters: m.letters.join('') };
  }
  // the monogram's own colored part and the cuts it needs. Print frame: z = 0 is the outside face; rz is how far raised
  // features stand proud of the lowered background; floorMin keeps a solid floor under a recess.
  function monoFinish(o, K, sec, rz, back, cut, inlays) {
    if (!sec) return;
    const color = o.colors.mono, same = o.singleColor || color === o.colors.case;
    const room = Math.max(0.3, back - 0.6);
    if (o.monoFinish === 'raised') {
      // stands rz proud; in its own color it also reaches 0.4 mm into the back so the color reads from the side
      if (same) return; // the lowered background already leaves it standing
      const e = Math.min(0.4, Math.max(0, room - 0.2));
      cut(sec, rz + e);
      inlays.push({ name: 'Monogram', color, mono: true, m: K.ext(sec, 0, rz + e) });
    } else if (o.monoFinish === 'deboss') {
      const fl = same ? 0 : 0.4, d = Math.min(o.monoDepth, Math.max(0.3, room - fl));
      cut(sec, rz + d + fl);
      if (!same) inlays.push({ name: 'Monogram', color, mono: true, m: K.ext(sec, rz + d, rz + d + fl) });
    } else { // flush inlay
      const d = Math.min(Math.max(o.monoDepth, 0.4), room);
      cut(sec, rz + d);
      inlays.push({ name: 'Monogram', color, mono: true, m: K.ext(sec, rz, rz + d) });
    }
  }

  // ---------------------------------------------------------------- add-ons (local frame: u right, v up in back view, w out of the back)
  function addonGeometry(id, o, K) {
    const tb = SPEC.addonBase, md = SPEC.magD + 0.25, mt = SPEC.magT + 0.15, r = SPEC.magR;
    const magHoles = (cx, cy) => { const L = []; for (let i = 0; i < SPEC.magN; i++) { const t = TAU * i / SPEC.magN + Math.PI / 2; L.push(circ((cx || 0) + r * Math.cos(t), (cy || 0) + r * Math.sin(t), md / 2, 40)); } return K.ext(K.cs(L), -1, mt); };
    const puck = (R, t) => K.ext(K.cs([circ(0, 0, R || 30, 160)]), 0, t || tb);
    const rr = (x0, y0, x1, y1, rad, z0, z1) => K.ext(K.cs([rrect(x0, y0, x1, y1, rad, 10)]), z0, z1);
    // section in the (v, w) plane extruded along u, and in the (u, w) plane extruded along v
    const extU = (loops, u0, u1) => K.extX(loops, u0, u1);
    const extV = (loops, v0, v1) => K.extY(loops, v0, v1);
    let solid, extra = {}, printT = null, use = null;
    if (id === 'wallet') {
      const n = o.cards, iw = 54 + 0.9, il = 85.6 + 1.0, ct = n * 0.8 + 0.5, wl = 2.0, cov = 1.2;
      const W2 = iw / 2 + wl, y0 = -il / 2 - wl, y1 = il / 2;
      const H = tb + ct + cov;
      let s = rr(-W2, y0, W2, y1, 3, 0, H);
      s = K.sub(s, K.box(-iw / 2, -il / 2, tb, iw / 2, y1 + 1, tb + ct));
      // thumb window in the cover and a finger notch at the open end
      s = K.sub(s, rr(-15, -il / 2 + 10, 15, il / 2 - 22, 6, tb + ct - 0.2, H + 1));
      s = K.sub(s, K.ext(K.cs([circ(0, y1, 11, 64)]), tb + ct - 0.2, H + 1));
      solid = K.sub(s, magHoles(0, 0));
      // prints standing on its side so the card slot needs no bridging: (u, v, w) -> (w, v, -u + W2)
      printT = m => K.k(K.k(m.rotate([0, -90, 0])).translate([0, 0, W2]));
      extra = { cards: n, size: [2 * W2, y1 - y0, H] };
    } else if (id === 'kickstand') {
      const hr = 3.2, vh = 30 + hr + 0.5, wh = hr, pin = 1.6, hole = pin + 0.35, legL = 62, neck = 10;
      let base = rr(-30, -30, 30, 30, 6, 0, tb);
      const blocks = [rr(-22, 26, -8, vh, 0.5, 0, tb), rr(8, 26, 22, vh, 0.5, 0, tb)];
      const knU = (u0, u1, rad) => extU([circ(vh, wh, rad, 48)], u0, u1);
      base = K.U([base, ...blocks, knU(-22, -8, hr), knU(8, 22, hr), knU(-22, 22, pin)]);
      // leg, printed lying flat and unfolded; its knuckle turns on the pin
      const tear = (() => { const L = circ(vh, wh, hole, 40); let top = 0; L.forEach((p, i) => { if (p[1] > L[top][1]) top = i; }); L.splice(top, 1, [vh, wh + hole * Math.SQRT2]); return L; })();
      let leg = K.U([rr(-7.4, vh, 7.4, vh + neck + 1, 0.4, 0, tb), rr(-22, vh + neck, 22, vh + legL, 7, 0, tb), knU(-7.6, 7.6, hr)]);
      leg = K.sub(leg, extU([tear], -8, 8));
      // grip notch at the tip
      leg = K.sub(leg, K.ext(K.cs([stadium(0, vh + legL, 18, 8)]), tb - 1.2, tb + 1));
      base = K.sub(base, magHoles(0, 0));
      solid = K.U([base, leg]);
      // assembled: leg folded out about 65\u00b0 from closed
      const th = 180 - 62;
      const legUse = K.k(K.k(K.k(leg.translate([0, -vh, -wh])).rotate([th, 0, 0])).translate([0, vh, wh]));
      use = () => K.U([base, legUse]);
      extra = { size: [60, 30 + vh + legL, tb] };
    } else if (id === 'ring') {
      const outer = [[-15, tb - 0.4], [15, tb - 0.4], [15, tb + 11], [0, tb + 26], [-15, tb + 11]], inn = [[-10.5, tb + 1.2], [10.5, tb + 1.2], [10.5, tb + 11], [0, tb + 21.5], [-10.5, tb + 11]];
      let sec = K.cs([outer]); sec = K.off(K.off(sec, -2.2, 32), 2.2, 32); let hs = K.cs([inn]); hs = K.off(K.off(hs, -1.5, 32), 1.5, 32);
      sec = K.k(sec.subtract(hs));
      const loop = extU(sec.toPolygons(), -5, 5);
      solid = K.sub(K.U([puck(30, tb), loop]), magHoles(0, 0));
      extra = { size: [60, 60, tb + 26] };
    } else if (id === 'strap') {
      const sw = 21, bl = 11, rt = 1.8, th = 2.6, vy = 47;
      const plate = K.U([puck(30, tb), rr(-17, -vy - bl / 2, 17, vy + bl / 2, 6, 0, tb)]);
      const anchors = [];
      for (const v of [-vy, vy]) {
        let blk = rr(-sw / 2 - 2.6, v - bl / 2, sw / 2 + 2.6, v + bl / 2, 1.5, 0, tb + th + rt);
        blk = K.sub(blk, K.box(-sw / 2, v - bl / 2 - 1, tb, sw / 2, v + bl / 2 + 1, tb + th));
        anchors.push(blk);
      }
      solid = K.sub(K.U([plate, ...anchors]), magHoles(0, 0));
      extra = { strapW: 20, size: [34, 2 * vy + bl, tb + th + rt] };
    } else if (id === 'earbuds') {
      const cw = o.budW + 0.6, chh = o.budH + 0.6, cd = o.budD + 0.4, wl = 1.8, lipW = 1.6, lipT = 0.9;
      const H = tb + cd + lipT, x2 = cw / 2 + wl, y0 = -chh / 2 - wl, y1 = chh / 2;
      let s = K.U([puck(30, tb), rr(-x2, y0, x2, y1, 3, 0, tb)]);
      const wall = side => { const sx = side, xi = sx * cw / 2, xo = sx * x2, xl = sx * (cw / 2 - lipW);
        const L = [[xi, tb - 0.1], [xo, tb - 0.1], [xo, H], [xl, H], [xl, H - lipT], [xi, H - lipT - lipW]];
        return extV([sx > 0 ? L : L.slice().reverse()], y0, y1); };
      s = K.U([s, wall(1), wall(-1), rr(-x2, y0, x2, -chh / 2 + 0.01, 0.6, 0, tb + cd * 0.55)]);
      solid = K.sub(s, magHoles(0, 0));
      extra = { size: [2 * x2, y1 - y0, H] };
    } else if (id === 'clip') {
      const C = CLIPS[o.clip], ri = C.d / 2 + 0.1, wt = C.d > 12 ? 2.4 : 1.9, ro = ri + wt, wc = tb + 1.2 + ro;
      let sec = K.cs([circ(0, wc, ro, 96)]);
      sec = K.k(sec.add(K.cs([rrect(-ro * 0.7, tb - 0.3, ro * 0.7, wc, 0.5, 4)])));
      sec = K.k(sec.subtract(K.cs([circ(0, wc, ri, 96)])));
      const ga = 52 * Math.PI / 180, wedge = [[0, wc], [Math.sin(ga) * ro * 3, wc + Math.cos(ga) * ro * 3], [-Math.sin(ga) * ro * 3, wc + Math.cos(ga) * ro * 3]];
      sec = K.k(sec.subtract(K.cs([wedge])));
      sec = K.off(K.off(sec, 0.45, 24), -0.45, 24);
      const polys = sec.toPolygons(), clips = [];
      if (o.clip === 'cable') for (const v of [-18, 0, 18]) clips.push(extV(polys, v - C.len / 2, v + C.len / 2));
      else clips.push(extV(polys, -C.len / 2, C.len / 2));
      solid = K.sub(K.U([puck(30, tb), ...clips]), magHoles(0, 0));
      extra = { d: C.d, size: [60, 60, wc + ro] };
    } else if (id === 'opener') {
      const t = 4.6;
      let s = K.U([puck(30, t), rr(-20, -66, 20, 0, 12, 0, t)]);
      s = K.sub(s, K.ext(K.cs([rrect(-13.5, -58, 13.5, -45, 3.5, 8)]), -1, t + 1));
      s = K.sub(s, K.ext(K.cs([[[-13.5, -45.5], [13.5, -45.5], [9, -41.5], [-9, -41.5]]]), -1, t + 1));
      solid = K.sub(s, magHoles(0, 0));
      extra = { size: [60, 96, t] };
    }
    return { solid, printT, use: use ? use() : solid, extra };
  }


  // ---------------------------------------------------------------- laptops: hard snap-on lid + bottom shells, split to the plate
  function laptopOutline(lp, step, nc) {
    const a = lp.W / 2, b = lp.D / 2, e = Math.min(lp.corner.e, a - 0.5, b - 0.5), n = lp.corner.n || 2, pts = [];
    const straight = (p0, p1, k) => { for (let i = 0; i < k; i++) { const t = i / k; pts.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]); } };
    const corner = (cx, cy, q) => { for (let i = 0; i < nc; i++) { const t = (q + i / nc) * Math.PI / 2, c = Math.cos(t), s = Math.sin(t); pts.push([cx + e * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + e * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]); } };
    const ks = Math.max(2, Math.ceil(2 * (b - e) / step)), kw = Math.max(2, Math.ceil(2 * (a - e) / step));
    straight([a, -(b - e)], [a, b - e], ks); corner(a - e, b - e, 0);
    straight([a - e, b], [-(a - e), b], kw); corner(-(a - e), b - e, 1);
    straight([-a, b - e], [-a, -(b - e)], ks); corner(-(a - e), -(b - e), 2);
    straight([-(a - e), -b], [a - e, -b], kw); corner(a - e, -(b - e), 3);
    const N = pts.length, nr = pts.map((p, i) => { const q = pts[(i + 1) % N], r = pts[(i + N - 1) % N], tx = q[0] - r[0], ty = q[1] - r[1], l = Math.hypot(tx, ty) || 1; return [ty / l, -tx / l]; });
    return { pts, nr, N, a, b, e, at: d => pts.map((p, i) => [p[0] + nr[i][0] * d, p[1] + nr[i][1] * d]) };
  }
  function splitPlan(w, d, bed) {
    const margin = 6, ov = 12;
    const bw = Math.max(80, (bed && bed[0]) || 256), bd = Math.max(80, (bed && bed[1]) || 256);
    const fits = (pw, pd) => (pw <= bw - margin && pd <= bd - margin) || (pw <= bd - margin && pd <= bw - margin);
    const piece = (total, n) => (total + ov * Math.max(0, n - 1)) / n;
    if (fits(w, d)) return { nx: 1, ny: 1, overlap: ov, n: 1 };
    // When a split is needed, prefer 4 pieces (2 \u00d7 2), or more if 2 \u00d7 2 still misses the plate.
    const cand = [];
    for (let nx = 1; nx <= 6; nx++) for (let ny = 1; ny <= 6; ny++) {
      const n = nx * ny; if (n < 2) continue;
      const pw = piece(w, nx), pd = piece(d, ny);
      if (fits(pw, pd)) cand.push({ nx, ny, n, pw, pd, prefer: (nx === 2 && ny === 2) ? 0 : (n >= 4 ? 1 : 2), aspect: Math.abs(pw - pd) });
    }
    cand.sort((A, B) => A.prefer - B.prefer || A.n - B.n || A.aspect - B.aspect);
    if (cand[0]) return { nx: cand[0].nx, ny: cand[0].ny, overlap: ov, n: cand[0].n, pw: cand[0].pw, pd: cand[0].pd };
    const nx = Math.max(2, Math.ceil((w + ov) / Math.max(80, Math.max(bw, bd) - margin)));
    const ny = Math.max(2, Math.ceil((d + ov) / Math.max(80, Math.min(bw, bd) - margin)));
    return { nx, ny, overlap: ov, n: nx * ny, pw: piece(w, nx), pd: piece(d, ny) };
  }
  function cellPlace(ix, iy, nx, ny) {
    const col = nx === 1 ? '' : (ix === 0 ? 'left' : ix === nx - 1 ? 'right' : 'center');
    const row = ny === 1 ? '' : (iy === 0 ? 'front' : iy === ny - 1 ? 'back' : 'middle');
    return [row, col].filter(Boolean).join(' ') || 'full';
  }
  // tray in print frame: outer floor at z = 0, +y toward the hinge, +x right
  function makeTray(K, lp, o, kind) {
    const wall = o.wall, cl = o.clearance, fl = o.back, lip = o.lip, lipH = o.lipH;
    const thick = kind === 'bottom' ? lp.baseT : lp.lidT;
    const ol = laptopOutline(lp, 7, 10);
    const od = cl + wall;
    const zInner = fl, zLip0 = fl + cl + thick, zTop = zLip0 + lipH;
    let shell = K.ext(K.cs([ol.at(od)]), 0, zTop);
    shell = K.sub(shell, K.ext(K.cs([ol.at(cl)]), zInner, zTop + 3));
    // inward snap lip on the front and sides; the lid skips the front lip so the camera stays clear
    const lipOuter = K.cs([ol.at(cl + 0.05)]), lipInner = K.cs([ol.at(cl - lip)]);
    let lipSec = K.k(lipOuter.subtract(lipInner));
    let lipM = K.ext(lipSec, zLip0 - 0.2, zTop);
    const frontCut = kind === 'lid'
      ? K.box(-800, -800, zLip0 - 1, 800, -ol.b + lp.corner.e + 8, zTop + 2)
      : null;
    if (frontCut) lipM = K.sub(lipM, frontCut);
    shell = K.add(shell, lipM);
    // hinge keep-out at the back (+y): open the wall, and on the bottom shell notch the floor too
    const hI = lp.hinge.inset + (kind === 'lid' ? 6 : 0);
    shell = K.sub(shell, K.box(-800, ol.b - hI, kind === 'bottom' ? zInner + 1.2 : zInner - 0.4, 800, 800, zTop + 6));
    if (kind === 'bottom') shell = K.sub(shell, K.box(-800, ol.b - 8, -2, 800, 800, zTop + 6));
    const cuts = [];
    if (kind === 'bottom') {
      const dy = o.btnDy || 0, fdx = o.camDx || 0, fdy = o.camDy || 0;
      for (const p of lp.ports || []) {
        const y = ol.b - p.fromBack + dy, zc = zInner + cl + p.z;
        const len = p.len + 1.4, h = p.h + 1.2;
        const side = p.side === 'L' ? -1 : 1, xi = side * (lp.W / 2);
        const x0 = Math.min(xi - side * 10, xi + side * 10), x1 = Math.max(xi - side * 10, xi + side * 10);
        cuts.push(K.extX([stadium(y, zc, len, h, 14)], x0, x1));
      }
      if (o.bottom === 'open' && (lp.ports || []).length) {
        const ys = (lp.ports || []).map(p => ol.b - p.fromBack + dy);
        const y0 = Math.min(...ys) - 18, y1 = Math.max(...ys) + 18;
        for (const side of [-1, 1]) {
          const xi = side * (lp.W / 2);
          cuts.push(K.box(xi - side * (wall + cl + 2), y0, zInner + 0.8, xi + side * 2, y1, zTop + 2));
        }
      }
      for (const f of lp.feet || []) {
        const x = -lp.W / 2 + f.x + fdx, y = -lp.D / 2 + f.y + fdy, m = 1.6;
        cuts.push(K.ext(K.cs([rrect(x - f.w / 2 - m, y - f.d / 2 - m, x + f.w / 2 + m, y + f.d / 2 + m, Math.min(f.w, f.d) / 2 + m, 10)]), -1, zInner + 1));
      }
      for (const v of lp.vents || []) {
        const x0 = -lp.W / 2 + v.x0, x1 = -lp.W / 2 + v.x1, y0 = -lp.D / 2 + v.y0, y1 = -lp.D / 2 + v.y1;
        cuts.push(K.ext(K.cs([rrect(x0, y0, x1, y1, v.r || 6, 8)]), -1, zInner + 1));
      }
    }
    if (cuts.length) shell = K.sub(shell, K.U(cuts));
    const outW = lp.W + 2 * od, outD = lp.D + 2 * od;
    return { shell: clean(K, shell, true), ol, fl, cl, wall, zTop, zInner, zLip0, thick, od, outW, outD };
  }
  function splitTray(K, solid, inlays, plan, outW, outD, H, floor, prefix, color) {
    const { nx, ny, overlap: ov } = plan, parts = [];
    if (nx === 1 && ny === 1) {
      parts.push({ obj: prefix, role: 'case', kind: 'case', name: prefix, color, m: solid, inlaySrc: inlays });
      return parts;
    }
    const xL = -outW / 2, yL = -outD / 2;
    const xs = Array.from({ length: nx + 1 }, (_, i) => xL + outW * i / nx);
    const ys = Array.from({ length: ny + 1 }, (_, i) => yL + outD * i / ny);
    const gap = 0.18, mid = Math.max(0.75, floor * 0.5);
    const keys = [];
    const place = (axis, s, lo, hi) => {
      const len = hi - lo; if (len < 30) return;
      const n = Math.max(1, Math.round(len / 50));
      for (let k = 1; k <= n; k++) keys.push({ axis, s, v: lo + len * k / (n + 1) });
    };
    for (let i = 1; i < nx; i++) place('x', xs[i], yL + 18, yL + outD - 18);
    for (let j = 1; j < ny; j++) place('y', ys[j], xL + 18, xL + outW - 18);
    const nTot = nx * ny;
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const x0 = xs[ix], x1 = xs[ix + 1], y0 = ys[iy], y1 = ys[iy + 1];
      const ox0 = x0 - (ix > 0 ? ov / 2 : 0), ox1 = x1 + (ix + 1 < nx ? ov / 2 : 0);
      const oy0 = y0 - (iy > 0 ? ov / 2 : 0), oy1 = y1 + (iy + 1 < ny ? ov / 2 : 0);
      let p = K.and(solid, K.box(ox0, oy0, -2, ox1, oy1, H + 8));
      const even = (ix + iy) % 2 === 0;
      const lap = (axis, seam, a0, a1) => {
        const s0 = seam - ov / 2, s1 = seam + ov / 2;
        if (even) { // keep the bed-side half of the overlap
          if (axis === 'x') p = K.sub(p, K.box(s0, a0, mid + gap / 2, s1, a1, H + 8));
          else p = K.sub(p, K.box(a0, s0, mid + gap / 2, a1, s1, H + 8));
        } else {
          if (axis === 'x') p = K.sub(p, K.box(s0, a0, -2, s1, a1, mid - gap / 2));
          else p = K.sub(p, K.box(a0, s0, -2, a1, s1, mid - gap / 2));
        }
      };
      if (ix > 0) lap('x', x0, oy0, oy1);
      if (ix + 1 < nx) lap('x', x1, oy0, oy1);
      if (iy > 0) lap('y', y0, ox0, ox1);
      if (iy + 1 < ny) lap('y', y1, ox0, ox1);
      // vertical alignment keys in the overlap: male nubs on the even piece, pockets on the odd piece
      for (const ky of keys) {
        const onX = ky.axis === 'x' && ((Math.abs(ky.s - x0) < 1e-6 && ix > 0) || (Math.abs(ky.s - x1) < 1e-6 && ix + 1 < nx)) && ky.v >= y0 - 0.5 && ky.v <= y1 + 0.5;
        const onY = ky.axis === 'y' && ((Math.abs(ky.s - y0) < 1e-6 && iy > 0) || (Math.abs(ky.s - y1) < 1e-6 && iy + 1 < ny)) && ky.v >= x0 - 0.5 && ky.v <= x1 + 0.5;
        if (!onX && !onY) continue;
        const cx = ky.axis === 'x' ? ky.s : ky.v, cy = ky.axis === 'x' ? ky.v : ky.s;
        if (even) {
          const pad = K.cyl(5.2, 0, mid + 0.4, 24);
          const nub = K.cyl(2.45, 0, mid + 1.7, 24);
          p = K.add(p, K.k(K.k(K.U([pad, nub])).translate([cx, cy, 0])));
        } else {
          const pad = K.k(K.cyl(6.2, mid - 0.2, floor + 2.2, 24).translate([cx, cy, 0]));
          p = K.add(p, pad);
          p = K.sub(p, K.k(K.cyl(2.7, mid - 0.4, mid + 1.95, 24).translate([cx, cy, 0])));
        }
      }
      const place = cellPlace(ix, iy, nx, ny);
      const name = nTot === 1 ? prefix : `${prefix}, piece ${iy * nx + ix + 1} of ${nTot} (${place})`;
      const obj = `${prefix.replace(/\s+/g, '_')}_${ix}_${iy}`;
      parts.push({ obj, role: 'case', kind: 'case', name, color, m: clean(K, p, true), clip: [ox0, oy0, ox1, oy1], inlaySrc: inlays });
    }
    return parts;
  }
  function buildLaptop(o, lp, K, warnings) {
    const lidG = makeTray(K, lp, o, 'lid');
    const botG = makeTray(K, lp, o, 'bottom');
    // lid design in print / back view: +y toward the hinge, x mirrored like the phone back so a 180\u00b0 Y
    // assembly rotate reads correctly when you look down at the closed lid
    const designCuts = [], inlays = [];
    const inset = 10, hingeKeep = lp.hinge.inset + 10;
    const region = K.cs([rrect(-lp.W / 2 + inset, -lp.D / 2 + inset, lp.W / 2 - inset, lp.D / 2 - hingeKeep, Math.max(2, lp.corner.e - 2), 8)]);
    // monogram: inside the lid design area, clear of the edges and the hinge. It reads upright to someone looking at
    // the back of the open screen (like a maker's logo), so Lower is toward the hinge (+y) and Upper toward the top edge.
    let mono = null;
    if (o.monoText) {
      const safe = K.k(K.off(region, -2, 24)), sb = safe.bounds();
      const centers = o.monoPos === 'center' ? [() => [0, (sb.min[1] + sb.max[1]) / 2]]
        : o.monoPos === 'lower' ? [(s, w, h) => [0, sb.max[1] - 14 - h * s / 2]]
          : [(s, w, h) => [0, sb.min[1] + 14 + h * s / 2]];
      mono = monoPlace(o, K, safe, centers, warnings, 12, true);
      if (mono) mono.keep = { safe: [sb.min[0], sb.min[1], sb.max[0], sb.max[1]] };
    }
    const badge = badgeLoops(o, warnings);
    let badgeCS = badge.length ? K.cs(badge) : null;
    if (badgeCS && badgeCS.isEmpty()) badgeCS = null;
    if ((o.image || o.text) && !badgeCS) warnings.push('The logo or text came out empty. Try a bigger size.');
    let badgeIn = badgeCS ? K.k(badgeCS.intersect(region)) : null;
    if (badgeIn && badgeCS && badgeIn.area() < badgeCS.area() * 0.98) warnings.push('Part of the logo or text runs off the lid; it is trimmed.');
    if (badgeIn && mono) { badgeIn = K.k(badgeIn.subtract(K.off(mono.sec, 1.6, 24))); if (badgeIn.isEmpty()) badgeIn = null; }
    let ink = null, patRegion = region;
    if (badgeIn) patRegion = K.k(patRegion.subtract(K.off(badgeIn, 2.4, 24)));
    if (mono) patRegion = K.k(patRegion.subtract(K.off(mono.sec, 2.4, 24)));
    if (o.pattern !== 'none') {
      const R = Math.hypot(lp.W, lp.D) / 2 + 8;
      const loops = patternLoops(o.pattern, o.patScale, o.patLine, o.patRot, R, 1 + lp.W * 3).map(L => L.map(p => [-p[0], p[1]]));
      ink = loops.length ? K.cs(loops) : null;
      if (ink) ink = o.patInvert ? K.k(patRegion.subtract(ink)) : K.k(ink.intersect(patRegion));
      if (ink && ink.isEmpty()) ink = null;
      if (ink && o.patStyle === 'cut') warnings.push('A cut-through pattern on a split lid can weaken the glue seams; carved or inlaid holds up better.');
    }
    const rz = Math.max(ink && o.patStyle === 'raised' ? o.patDepth : 0, badgeIn && o.badgeStyle === 'emboss' ? o.badgeDepth : 0, mono && o.monoFinish === 'raised' ? o.monoDepth : 0);
    const cut = (sec, z1) => { if (sec) designCuts.push(K.ext(sec, -0.2, z1)); };
    if (rz > 0) {
      let raised = null;
      if (ink && o.patStyle === 'raised') raised = ink;
      if (badgeIn && o.badgeStyle === 'emboss') raised = raised ? K.k(raised.add(badgeIn)) : badgeIn;
      if (mono && o.monoFinish === 'raised') raised = raised ? K.k(raised.add(mono.sec)) : mono.sec;
      cut(raised ? K.k(region.subtract(raised)) : region, rz);
    }
    const style = (sec, st, depth, color, name) => {
      if (!sec) return;
      if (st === 'carved' || st === 'deboss') cut(sec, rz + Math.min(depth, o.back - 0.6));
      else if (st === 'cut') cut(sec, lidG.zTop + 1);
      else if (st === 'inlay') { const d = rz + Math.min(depth, o.back - 0.6); cut(sec, d); inlays.push({ name, color, m: K.ext(sec, 0, d) }); }
      else if ((st === 'raised' || st === 'emboss') && accentOn(o)) {
        const d = rz || Math.min(depth, o.back - 0.6);
        cut(sec, Math.max(0.2, d - 0.2));
        inlays.push({ name, color: o.colors.raised, m: K.ext(sec, 0, d + 0.2) });
      }
    };
    style(ink, o.patStyle, o.patDepth, o.colors.design, ink && o.patStyle === 'raised' && accentOn(o) ? 'Raised pattern' : 'Pattern inlay');
    style(badgeIn, o.badgeStyle, o.badgeDepth, o.colors.badge, badgeIn && o.badgeStyle === 'emboss' && accentOn(o) ? 'Raised logo' : 'Logo inlay');
    if (mono) monoFinish(o, K, mono.sec, rz, o.back, cut, inlays);
    let lidShell = lidG.shell;
    if (designCuts.length) lidShell = K.sub(lidShell, K.U(designCuts));
    lidShell = clean(K, lidShell, true);

    const plan = splitPlan(Math.max(lidG.outW, botG.outW), Math.max(lidG.outD, botG.outD), o.bed);
    const lidParts = splitTray(K, lidShell, inlays, plan, lidG.outW, lidG.outD, lidG.zTop, lidG.fl, 'Lid shell', o.colors.case);
    const botParts = splitTray(K, botG.shell, [], plan, botG.outW, botG.outD, botG.zTop, botG.fl, 'Bottom shell', o.colors.case);

    // assembled: bottom tray already has its outer floor at z = 0 (desk). Lid print is outer-down;
    // rotate 180\u00b0 about Y and lift so the outer face sits at z = T + clearance + floor (closed).
    const zLidOuter = lp.T + o.clearance + lidG.fl;
    const lidAsm = m => K.k(K.k(m.rotate([0, 180, 0])).translate([0, 0, zLidOuter]));
    // open the lid ~110\u00b0 about the hinge axis (x through y = D/2 - 6, z = baseT)
    const yH = lp.D / 2 - 6, zH = lp.baseT, open = -110;
    const swing = m => K.k(K.k(K.k(m.translate([0, -yH, -zH])).rotate([open, 0, 0])).translate([0, yH, zH]));

    const parts = [];
    const push = (spec, printM, useM) => {
      const m = clean(K, printM, spec.role === 'case'); if (empty(m)) return;
      const use = useM ? clean(K, useM, false) : null;
      parts.push({ obj: spec.obj, role: spec.role, kind: spec.role === 'design' ? 'design' : 'case', name: spec.name, color: spec.color, p: soup(m), use: use && !empty(use) ? soup(use) : soup(m) });
    };
    for (const q of lidParts) {
      push(q, q.m, swing(lidAsm(q.m)));
      for (const inn of (q.inlaySrc || [])) {
        let im = inn.m;
        if (q.clip) im = K.and(im, K.box(q.clip[0], q.clip[1], -1, q.clip[2], q.clip[3], 8));
        if (empty(im)) continue;
        push({ obj: q.obj, role: 'design', name: inn.name + (plan.n > 1 ? ` (${cellPlace(+q.obj.split('_').at(-2), +q.obj.split('_').at(-1), plan.nx, plan.ny)})` : ''), color: inn.color }, im, swing(lidAsm(im)));
      }
    }
    for (const q of botParts) push(q, q.m, q.m); // bottom print frame is the assembled desk frame

    if (plan.n > 1) warnings.push(`Each shell is split into ${plan.n} pieces (${plan.nx} \u00d7 ${plan.ny}) to fit your ${o.bed[0]} \u00d7 ${o.bed[1]} mm plate. The seams have a glue gap and interlocking alignment keys; glue them before you snap the shells on.`);
    if ((lp.vents || []).length) warnings.push('The bottom shell leaves the intake vents open. Do not fill those openings or cover them with a pattern.');

    // laptop mock (preview only): a closed-thickness body, lid swung open with the shell
    const mock = laptopMock(lp, K, o, yH, zH, open);

    const objs = [...new Set(parts.map(q => q.obj))].map(id => { const ps = parts.filter(q => q.obj === id), bx = Core.bbox(T.concat(ps.map(q => q.p))); return { id, b: bx, w: bx.max[0] - bx.min[0], d: bx.max[1] - bx.min[1], h: bx.max[2] - bx.min[2] }; });
    const gapP = 6, BW = o.bed[0] - 2 * gapP, BD = o.bed[1] - 2 * gapP; let x = 0, y = 0, rowD = 0, plate = 0; const at = new Map();
    for (const it of objs) { if (x > 0 && x + it.w > BW) { x = 0; y += rowD + gapP; rowD = 0; } if (y > 0 && y + it.d > BD) { plate++; x = 0; y = 0; rowD = 0; } at.set(it.id, { x: gapP + x, y: o.bed[1] - gapP - y - it.d, plate }); x += it.w + gapP; rowD = Math.max(rowD, it.d); }
    const big = objs.filter(it => it.w > BW || it.d > BD), tall = objs.filter(it => it.h > o.bedZ);
    if (big.length) warnings.push(`${big.map(it => parts.find(q => q.obj === it.id).name).join(', ')} ${big.length > 1 ? 'are' : 'is'} bigger than your build plate.`);
    if (tall.length) warnings.push(`${tall.map(it => parts.find(q => q.obj === it.id).name).join(', ')} ${tall.length > 1 ? 'are' : 'is'} taller than your printer.`);
    const placed = parts.map(q => { const it = objs.find(z => z.id === q.obj), aa = at.get(q.obj); return { ...q, plate: aa.plate, p: moveP(q.p, aa.x - it.b.min[0], aa.y - it.b.min[1], -it.b.min[2]) }; });
    const plates = Math.max(0, ...placed.map(q => q.plate)) + 1;
    const colors = collectColors(o, parts);
    const stats = {
      phone: lp.id, phoneName: lp.name, est: lp.est.slice(), material: 'rigid', kind: 'laptop',
      size: [botG.outW, botG.outD, Math.max(lidG.zTop, botG.zTop)], back: o.back, colors: colors.length, plates, parts: parts.length,
      tris: parts.reduce((s, q) => s + q.p.length / 9, 0), addons: [], mount: 'none', mountY: 0, guardH: 0, split: plan,
      splitN: plan.n, pattern: o.pattern, patStyle: o.patStyle, badge: !!badgeIn, clearance: o.clearance, bed: o.bed.slice(),
      monogram: monoStat(o, mono), rz
    };
    return { options: o, phone: lp, parts: placed, raw: parts, mock, plates, colors, stats, warnings };
  }
  function laptopMock(lp, K, o, yH, zH, open) {
    const ol = laptopOutline(lp, 8, 8), a = lp.W / 2, b = lp.D / 2;
    const swing = m => K.k(K.k(K.k(m.translate([0, -yH, -zH])).rotate([open, 0, 0])).translate([0, yH, zH]));
    const parts = [], alu = '#5A5F66'; // space-gray aluminum
    const add = (name, mat, color, m) => { if (empty(m)) return; parts.push({ name, mat, color, p: soup(m) }); };
    add('Base', 'aluminum', alu, K.ext(K.cs([ol.at(0)]), 0, lp.baseT));
    // keyboard deck and trackpad sit on the base (preview only, no logo)
    add('Keyboard', 'keys', '#1A1B1E', K.ext(K.cs([rrect(-a + 10, -10, a - 10, b - 22, 2.2, 8)]), lp.baseT + 0.02, lp.baseT + 0.38));
    const tpW = Math.min(130, lp.W * 0.36), tpH = Math.min(78, lp.D * 0.28), tpY0 = -b + 16;
    add('Trackpad', 'trackpad', '#9AA0A6', K.ext(K.cs([rrect(-tpW / 2, tpY0, tpW / 2, tpY0 + tpH, 3.6, 10)]), lp.baseT + 0.05, lp.baseT + 0.42));
    const lid = K.ext(K.cs([ol.at(0)]), lp.baseT, lp.T);
    add('Lid', 'aluminum', alu, swing(lid));
    const bezel = 8, hingeBezel = 16;
    const bezOuter = rrect(-a + 5, -b + 5, a - 5, b - 12, 3.4, 10);
    const bezInner = rrect(-a + bezel, -b + bezel, a - bezel, b - hingeBezel, 3.2, 10);
    add('Bezel', 'bezel', '#0A0A0C', swing(K.ext(K.cs([bezOuter, bezInner]), lp.baseT - 0.48, lp.baseT - 0.06)));
    const scr = K.ext(K.cs([bezInner]), lp.baseT - 0.62, lp.baseT - 0.16);
    add('Display', 'screen', '#0B1020', swing(scr));
    for (const f of (lp.feet || [])) {
      const fx = f.x - lp.W / 2, fy = f.y - lp.D / 2;
      add('Foot', 'rubber', '#1A1A1C', K.ext(K.cs([rrect(fx - f.w / 2, fy - f.d / 2, fx + f.w / 2, fy + f.d / 2, 2.2, 8)]), -1.2, 0.15));
    }
    return parts;
  }

  // ---------------------------------------------------------------- build
  function build(raw, M) {
    if (!M || !M.Manifold) throw new Error('The solid engine (Manifold) is not loaded.');
    const o = options(raw), ph = o.phone === 'custom' ? o.custom : PM.byId[o.phone], warnings = [], K = kit(M);
    try {
      if (ph.kind === 'laptop') return buildLaptop(o, ph, K, warnings);
      if (o.addons.length && o.mount === 'none') { o.mount = 'ring'; o._autoMount = true; }
      const g = caseGeometry(o, ph, K, warnings);
      const { region, B } = g;
      const designCuts = [], inlays = [];
      // monogram: the flat back minus the camera surround (and the glued guard ring) and the magnetic charging ring
      let mono = null;
      if (o.monoText) {
        const ringY = g.info.mountY, r0 = SPEC.ringID / 2 - 1.5, r1 = SPEC.ringOD / 2 + 1.5;
        let safe = g.csP(g.D - g.rbo - 2.2);
        safe = K.k(safe.subtract(K.off(g.camOpen, 3.2)));
        safe = K.k(safe.subtract(K.cs([circ(0, ringY, r1, 160), circ(0, ringY, r0, 160)])));
        const cb = g.info.camBox, sb = safe.bounds(), top = ringY - r1 - 1, bot = sb.min[1];
        const centers = o.monoPos === 'center' ? [() => [0, ringY]]
          : o.monoPos === 'lower' ? [() => [0, (top + bot) / 2], (s, w, h) => [0, top - h * s / 2 - 0.5]]
            : [(s, w, h) => [0, cb.min[1] - 3.6 - h * s / 2],
              (s, w, h) => { const l = cb.min[0] - sb.min[0], r = sb.max[0] - cb.max[0]; return l > r ? [(sb.min[0] + cb.min[0] - 3.2) / 2, (cb.min[1] + cb.max[1]) / 2] : [(sb.max[0] + cb.max[0] + 3.2) / 2, (cb.min[1] + cb.max[1]) / 2]; },
              (s, w, h) => [0, (cb.min[1] - 3.2 + ringY + r1) / 2]];
        if (o.monoPos === 'camera') {
          // phones whose camera spans the back leave little room beside or under it: fall back to the center
          const w1 = [], near = monoPlace(o, K, safe, centers, w1);
          if (near && near.s >= 0.6) { mono = near; warnings.push(...w1); }
          else {
            const w2 = [], mid = monoPlace(o, K, safe, [() => [0, ringY]], w2);
            if (mid && (!near || mid.s > near.s)) { mono = mid; mono.moved = 'center'; warnings.push(...w2.filter(w => !/There isn't room/.test(w)), 'There isn\'t room next to the camera on this phone, so the monogram is centered on the back.'); }
            else { mono = near; warnings.push(...w1); }
          }
        } else mono = monoPlace(o, K, safe, centers, warnings);
        if (mono) mono.keep = { cam: g.camOpen.toPolygons().map(L => L.map(p => [p[0], p[1]])), ring: [0, ringY, r0, r1], safe: [sb.min[0], sb.min[1], sb.max[0], sb.max[1]] };
      }
      // badge (logo + text)
      const badge = badgeLoops(o, warnings);
      let badgeCS = badge.length ? K.cs(badge) : null;
      if (badgeCS && badgeCS.isEmpty()) badgeCS = null;
      if ((o.image || o.text) && !badgeCS) warnings.push('The logo or text came out empty. Try a bigger size.');
      let badgeIn = null;
      if (badgeCS) {
        badgeIn = K.k(badgeCS.intersect(g.csP(g.D - g.rbo - 1.2)));
        badgeIn = K.k(badgeIn.subtract(K.off(g.camOpen, 1.2)));
        if (badgeIn.area() < badgeCS.area() * 0.98) warnings.push('Part of the logo or text runs off the flat back or into the camera opening; it is trimmed.');
        if (mono) { badgeIn = K.k(badgeIn.subtract(K.off(mono.sec, 1.2, 32))); if (badgeIn.isEmpty()) badgeIn = null; }
      }
      // pattern ink
      let ink = null, patRegion = region;
      if (badgeIn) patRegion = K.k(patRegion.subtract(K.off(badgeIn, 1.6, 32)));
      if (mono) patRegion = K.k(patRegion.subtract(K.off(mono.sec, 1.6, 32)));
      if (o.pattern !== 'none') {
        const R = Math.hypot(ph.W, ph.L) / 2 + 6;
        const loops = patternLoops(o.pattern, o.patScale, o.patLine, o.patRot, R, 1 + ph.L * 7).map(L => L.map(p => [-p[0], p[1]]));
        ink = loops.length ? K.cs(loops) : null;
        if (ink) ink = o.patInvert ? K.k(patRegion.subtract(ink)) : K.k(ink.intersect(patRegion));
        if (ink && ink.isEmpty()) ink = null;
        if (ink && o.patStyle === 'cut' && o.material === 'rigid') warnings.push('Cut-through patterns make a rigid case weaker; TPU flexes and handles them better.');
      }
      const rz = g.info.rz, cut = (sec, z1) => designCuts.push(K.ext(sec, -1, z1));
      // background lowered when something is raised
      if (rz > 0) {
        let raised = null;
        if (ink && o.patStyle === 'raised') raised = ink;
        if (badgeIn && o.badgeStyle === 'emboss') raised = raised ? K.k(raised.add(badgeIn)) : badgeIn;
        if (mono && o.monoFinish === 'raised') raised = raised ? K.k(raised.add(mono.sec)) : mono.sec;
        // the background is lowered over the whole flat back (the monogram may sit where the pattern doesn't reach)
        const bgArea = mono ? K.k(region.add(mono.sec)) : region;
        cut(raised ? K.k(bgArea.subtract(raised)) : bgArea, rz);
      }
      const back = g.bt;
      const style = (sec, st, depth, color, name) => {
        if (!sec) return;
        if (st === 'carved' || st === 'deboss') cut(sec, rz + Math.min(depth, back - 0.6));
        else if (st === 'cut') cut(sec, B + 0.5);
        else if (st === 'inlay') { const d = rz + Math.min(depth, back - 0.6); cut(sec, d); inlays.push({ name, color, m: K.ext(sec, 0, d) }); }
        else if ((st === 'raised' || st === 'emboss') && accentOn(o)) {
          const d = rz || Math.min(depth, back - 0.6);
          cut(sec, Math.max(0.2, d - 0.2));
          inlays.push({ name, color: o.colors.raised, m: K.ext(sec, 0, d + 0.2) });
        }
      };
      style(ink, o.patStyle, o.patDepth, o.colors.design, ink && o.patStyle === 'raised' && accentOn(o) ? 'Raised pattern' : 'Pattern inlay');
      style(badgeIn, o.badgeStyle, o.badgeDepth, o.colors.badge, badgeIn && o.badgeStyle === 'emboss' && accentOn(o) ? 'Raised logo' : 'Logo inlay');
      if (mono) monoFinish(o, K, mono.sec, rz, back, cut, inlays);
      // carve it all
      let shell = g.shell;
      const allCuts = K.U([...g.cuts, ...designCuts]);
      shell = K.sub(shell, allCuts);
      if (accentOn(o) && g.covers && g.covers.length) {
        let bump = K.U(g.covers);
        if (allCuts) bump = K.sub(bump, allCuts);
        if (!empty(bump)) inlays.push({ name: 'Button bumpers', color: o.colors.raised, m: bump });
      }
      if (g.nubs.length) shell = K.add(shell, K.U(g.nubs));
      if (g.info.lanyardHole) { const h = g.info.lanyardHole; shell = K.sub(shell, K.ext(K.cs([circ(h[0], h[1], 1.6, 32)]), -1, 10)); }
      // pieces
      const parts = [];
      const asm = m => K.k(m.rotate([0, 180, 0]));
      const pushPart = (obj, role, name, color, m, printM, useM) => { m = clean(K, m, role === 'case'); if (empty(m)) return; if (!printM && !useM) { /* m is both */ } parts.push({ obj, role, kind: role, name, color, p: soup(printM || m), use: soup(useM || asm(m)) }); };
      if (o.material === 'rigid') {
        // two halves: the end cap slides on from the bottom and laps under the main shell, held by two snap bumps
        const ys = -g.ol.b + 28, ov = 10, zm = back * 0.5, a = g.ol.a, big = 400;
        const lowR = K.U([K.box(-big, -big, -big, big, ys, big), K.box(-(a - 4), ys - 0.01, -big, a - 4, ys + ov, zm)]);
        const gapR = K.U([K.box(-big, -big, -big, big, ys + 0.15, big), K.box(-(a - 4) - 0.15, ys, -big, a - 4 + 0.15, ys + ov + 0.15, zm + 0.15)]);
        const bumps = [-1, 1].map(sx => K.k(K.k(K.M.Manifold.sphere(0.65, 24)).translate([sx * (a - 4) * 0.5, ys + ov * 0.6, zm])));
        const dimples = [-1, 1].map(sx => K.k(K.k(K.M.Manifold.sphere(0.8, 24)).translate([sx * (a - 4) * 0.5, ys + ov * 0.6, zm])));
        let lo = K.and(shell, lowR); lo = K.add(lo, K.and(K.U(bumps), K.box(-big, -big, zm - 0.01, big, big, big)));
        let hi = K.sub(K.sub(shell, gapR), K.U(dimples));
        pushPart('case', 'case', 'Case main shell', o.colors.case, hi);
        pushPart('cap', 'case', 'Case end cap', o.colors.case, lo);
        for (const q of inlays) { pushPart('case', 'design', q.name, q.color, K.sub(q.m, gapR)); pushPart('cap', 'design', q.name + ' (cap)', q.color, K.and(q.m, lowR)); }
        g.info.split = ys;
      } else {
        pushPart('case', 'case', 'Phone case', o.colors.case, shell);
        for (const q of inlays) pushPart('case', 'design', q.name, q.color, q.m);
      }
      // camera guard ring: printed flat, glued around the opening (the back faces the bed, so it can't be printed on)
      const camLift = Math.max(0, ph.camera.bump - g.info.B);
      if (o.camera === 'guard') {
        const hg = Math.max(0.8, camLift + 0.5);
        let band = K.k(K.off(g.camOpen, 1.8, 48).subtract(g.camOpen));
        band = K.k(band.intersect(g.csP(g.D - g.rbo - 0.3)));
        const ring = K.ext(band, 0, hg);
        pushPart('guard', 'guard', 'Camera guard ring', o.colors.guard, ring, null, asm(K.k(ring.translate([0, 0, -hg]))));
        g.info.guardH = hg;
      } else if (camLift > 0.3) warnings.push(`The lenses stand ${camLift.toFixed(1)} mm proud of the back. Add the camera guard ring so they don't touch the table.`);
      // add-ons
      const addInfo = [];
      o.addons.forEach((id, i) => {
        const A = addonGeometry(id, o, K); if (!A.solid) return;
        const pm = A.printT ? A.printT(A.solid) : A.solid;
        const useM = i === 0 ? K.k(A.use.translate([0, g.cy, 0])) : null;
        parts.push({ obj: 'addon_' + id, role: 'addon', kind: 'addon', name: ADDONS[id].label, color: o.colors.addon, p: soup(pm), use: useM ? soup(useM) : null });
        addInfo.push({ id, ...A.extra });
      });
      if (o._autoMount) warnings.push('Add-ons stick on with magnets, so the case got the magnetic ring recess.');
      // phone (preview only, assembled view)
      const mock = phoneMock(ph, g, K, o);
      // plate layout
      const objs = [...new Set(parts.map(q => q.obj))].map(id => { const ps = parts.filter(q => q.obj === id), bx = Core.bbox(T.concat(ps.map(q => q.p))); return { id, b: bx, w: bx.max[0] - bx.min[0], d: bx.max[1] - bx.min[1], h: bx.max[2] - bx.min[2] }; });
      const gap = 6, BW = o.bed[0] - 2 * gap, BD = o.bed[1] - 2 * gap; let x = 0, y = 0, rowD = 0, plate = 0; const at = new Map();
      for (const it of objs) { if (x > 0 && x + it.w > BW) { x = 0; y += rowD + gap; rowD = 0; } if (y > 0 && y + it.d > BD) { plate++; x = 0; y = 0; rowD = 0; } at.set(it.id, { x: gap + x, y: o.bed[1] - gap - y - it.d, plate }); x += it.w + gap; rowD = Math.max(rowD, it.d); }
      const big = objs.filter(it => it.w > BW || it.d > BD), tall = objs.filter(it => it.h > o.bedZ);
      if (big.length) warnings.push(`${big.map(it => parts.find(q => q.obj === it.id).name).join(', ')} ${big.length > 1 ? 'are' : 'is'} bigger than your build plate.`);
      if (tall.length) warnings.push(`${tall.map(it => parts.find(q => q.obj === it.id).name).join(', ')} ${tall.length > 1 ? 'are' : 'is'} taller than your printer.`);
      const placed = parts.map(q => { const it = objs.find(z => z.id === q.obj), aa = at.get(q.obj); return { ...q, plate: aa.plate, p: moveP(q.p, aa.x - it.b.min[0], aa.y - it.b.min[1], -it.b.min[2]) }; });
      const plates = Math.max(0, ...placed.map(q => q.plate)) + 1;
      const colors = collectColors(o, parts);
      const stats = {
        phone: ph.id, phoneName: ph.name, est: ph.est.slice(), material: o.material, size: [g.info.outerW, g.info.outerL, g.info.outerT], back: g.info.B,
        colors: colors.length, plates, parts: parts.length, tris: parts.reduce((s, q) => s + q.p.length / 9, 0), addons: addInfo, mount: o.mount, mountY: g.cy,
        guardH: g.info.guardH || 0, split: g.info.split || null, pattern: o.pattern, patStyle: o.patStyle, badge: !!badgeIn, clearance: o.clearance,
        monogram: monoStat(o, mono), rz
      };
      return { options: o, phone: ph, parts: placed, raw: parts, mock, plates, colors, stats, warnings };
    } finally { K.free(); }
  }
  function monoStat(o, mono) {
    if (!mono) return null;
    return { initials: o.monoText, letters: mono.letters, style: mono.style, frame: mono.frame, finish: o.monoFinish, position: o.monoPos, color: o.colors.mono,
      size: mono.size, w: mono.w, h: mono.h, x: mono.x, y: mono.y, scale: mono.s, moved: mono.moved || null, keep: mono.keep || null };
  }
  function frameColor(ph) {
    if (ph.brand === 'iphone') return /pro|air/.test(ph.id) ? '#8A8E93' : '#C2C5C9';
    if (ph.brand === 'galaxy') return /ultra/.test(ph.id) ? '#7A7E84' : '#3A3D42';
    if (ph.brand === 'pixel') return '#9AA0A6';
    return '#8A8E93';
  }
  // back / camera plateau: 17/18 Pro is frosted natural titanium; others are dark glass
  function backFinish(ph) {
    if (/iphone1[78]pro/.test(ph.id)) return { mat: 'frost', color: '#2F3844' }; // deep blue-gray titanium, matte
    if (ph.brand === 'iphone' && /pro/.test(ph.id)) return { mat: 'frost', color: '#2A2D32' };
    if (ph.brand === 'galaxy') return { mat: 'frost', color: /ultra/.test(ph.id) ? '#1C1F24' : '#1A1C20' };
    if (ph.brand === 'pixel') return { mat: 'frost', color: '#1A2230' };
    return { mat: 'glass', color: '#12141A' };
  }
  // notch on 13 and non-Pro 14; Dynamic Island on 14 Pro and later; a punch-hole on Galaxy and Pixel
  function frontFeature(ph) {
    if (ph.brand === 'iphone') {
      if (/^iphone13/.test(ph.id) || ph.id === 'iphone14' || ph.id === 'iphone14plus') return { type: 'notch', w: Math.min(34, ph.W * 0.47), h: 7.2, y: 0.15 };
      return { type: 'island', w: /air/.test(ph.id) ? 11.2 : 12.4, h: 3.7, y: 6.4 };
    }
    if (ph.brand === 'galaxy' || ph.brand === 'pixel') return { type: 'hole', d: ph.brand === 'pixel' ? 3.4 : 3.6, y: 5.8 };
    return null;
  }
  function phoneMock(ph, g, K, o) {
    const rb = Math.min(ph.edge.back, ph.T / 3), rf = Math.min(ph.edge.front, ph.T / 3);
    const B = g.B, T = ph.T, ol = g.ol, a = ol.a, b = ol.b;
    const flip = m => K.k(m.rotate([0, 180, 0]));
    const parts = [];
    const add = (name, mat, color, m) => { if (!m || empty(m)) return; parts.push({ name, mat, color, p: soup(flip(m)) }); };
    // metal band with the same rounded corners and edge profile as the phone
    const rows = [];
    for (let i = 0; i <= 5; i++) { const t = i / 5 * Math.PI / 2; rows.push([-rb + rb * Math.sin(t), B + rb - rb * Math.cos(t)]); }
    for (let i = 0; i <= 5; i++) { const t = i / 5 * Math.PI / 2; rows.push([-rf + rf * Math.cos(t), B + T - rf + rf * Math.sin(t)]); }
    add('Frame', 'frame', frameColor(ph), K.loft(ol, rows));
    // glossy glass back, inset so a metal rim shows around it; open over the camera plateau
    const backInset = Math.max(rb, 0.9) + 0.15;
    let backGlass = K.ext(K.cs([ol.at(-backInset)]), B - 0.08, B + 0.45);
    const cm = ph.camera, toX = bx => a - bx, toY = by => b - by, camCuts = [];
    for (const q of cm.parts) {
      if (q.t === 'r') camCuts.push(rrect(toX(q.x1) - 0.35, toY(q.y1) - 0.35, toX(q.x0) + 0.35, toY(q.y0) + 0.35, (q.r || 2) + 0.35, 12));
    }
    if (camCuts.length) backGlass = K.sub(backGlass, K.ext(K.cs(camCuts), B - 8, B + 2));
    const back = backFinish(ph);
    add('Back glass', back.mat, back.color, backGlass);
    // front glass and a slightly proud screen with a lock-screen gradient (applied in the viewer)
    const frontInset = Math.max(rf, 0.85) + 0.1;
    add('Front glass', 'glass', '#121317', K.ext(K.cs([ol.at(-frontInset)]), B + T - 0.5, B + T + 0.08));
    const screenInset = 2.35;
    add('Screen', 'screen', '#0B1020', K.ext(K.cs([ol.at(-screenInset)]), B + T - 0.18, B + T + 0.14));
    const feat = frontFeature(ph), zIsle = B + T + 0.16;
    if (feat && feat.type === 'island') {
      add('Island', 'island', '#0A0A0C', K.ext(K.cs([stadium(0, b - feat.y, feat.w, feat.h, 14)]), B + T - 0.05, zIsle + 0.12));
    } else if (feat && feat.type === 'notch') {
      add('Notch', 'island', '#0A0A0C', K.ext(K.cs([rrect(-feat.w / 2, b - feat.h, feat.w / 2, b + 0.4, feat.h * 0.45, 10)]), B + T - 0.05, zIsle + 0.1));
    } else if (feat && feat.type === 'hole') {
      add('Front camera', 'island', '#0A0A0C', K.ext(K.cs([circ(0, b - feat.y, feat.d / 2, 28)]), B + T - 0.04, zIsle + 0.1));
    }
    // camera plateau, lens rings and glass, flash / sensors \u2014 positions from the model data
    const platH = cm.plateau || Math.min(1.2, cm.bump * 0.4);
    let flashUsed = false;
    for (const q of cm.parts) {
      if (q.t === 'r') {
        let plat = K.ext(K.cs([rrect(toX(q.x1), toY(q.y1), toX(q.x0), toY(q.y0), q.r, 14)]), B - platH, B + 0.12);
        if (q.full) plat = K.and(plat, K.ext(g.csP(-Math.min(ph.edge.back, 1.2)), -50, 50));
        add('Camera bar', 'plateau', back.color, plat);
        continue;
      }
      const r = q.d / 2, cx = toX(q.x), cy = toY(q.y);
      if (r >= 4.6) {
        const ring = K.ext(K.cs([circ(cx, cy, r - 0.15, 36), circ(cx, cy, Math.max(1.2, r - 1.05), 28)]), B - platH - 0.2, B - platH + 0.55);
        add('Lens ring', 'lensRing', '#C8CBD0', ring);
        add('Lens', 'lensGlass', '#070A12', K.ext(K.cs([circ(cx, cy, Math.max(1.1, r - 1.0), 28)]), B - cm.bump, B - platH + 0.12));
      } else if (r >= 2.4 && !flashUsed) {
        flashUsed = true;
        add('Flash', 'flash', '#E8D6A0', K.ext(K.cs([circ(cx, cy, r - 0.15, 24)]), B - platH - 0.15, B - platH + 0.4));
      } else {
        add('Sensor', 'sensor', '#101218', K.ext(K.cs([circ(cx, cy, Math.max(0.6, r - 0.2), 20)]), B - platH - 0.1, B - platH + 0.35));
      }
    }
    // side buttons, including the action / ring switch and camera control
    for (const bn of ph.buttons) {
      const x = bn.side === 'L' ? -a : a, sx = Math.sign(x), yc = b - bn.y, zc = B + bn.z;
      const out = bn.kind === 'switch' ? 0.75 : 0.48;
      add(bn.kind === 'switch' ? 'Switch' : 'Button', bn.kind === 'switch' ? 'switch' : 'button', frameColor(ph),
        K.extX([stadium(yc, zc, bn.len, bn.h, 10)], sx > 0 ? x - 0.15 : x - out, sx > 0 ? x + out : x + 0.15));
    }
    return parts;
  }
  function moveP(p, dx, dy, dz) { const q = new Float32Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + dz; } return q; }

  function filaments(res) {
    const roles = { case: 'case', design: 'pattern / logo inlay', guard: 'camera guard', addon: 'add-ons', mono: 'monogram' };
    return res.colors.map(c => ({ color: c, role: res.raw.filter(q => q.color === c).map(q => roles[/^Monogram/.test(q.name) ? 'mono' : q.role] || q.role).filter((v, i, a) => a.indexOf(v) === i).join(' + ') }));
  }
  // view: 'case' (assembled with the phone, back up) or 'print' (as laid out on the build plate)
  function scene(res, view) {
    if (view === 'print') {
      const out = []; let x = 0;
      for (let k = 0; k < res.plates; k++) { const ps = res.parts.filter(q => (q.plate || 0) === k); if (!ps.length) continue; const b = Core.bbox(T.concat(ps.map(q => q.p)));
        for (const q of ps) out.push({ name: q.name, kind: q.kind, color: q.color, p: moveP(q.p, x - b.min[0], -b.min[1], 0), local: true }); x += b.max[0] - b.min[0] + 15; }
      return out;
    }
    const out = [];
    for (const q of res.raw) if (q.use) out.push({ name: q.name, kind: q.kind, color: q.color, p: Float32Array.from(q.use) });
    const mocks = !res.mock ? [] : (Array.isArray(res.mock) ? res.mock : [{ name: res.phone.name, color: '#A8ABB0', p: res.mock }]);
    const devKind = res.stats && res.stats.kind === 'laptop' ? 'laptop' : 'phone';
    for (const q of mocks) out.push({ name: q.name, kind: devKind, color: q.color, mat: q.mat, p: Float32Array.from(q.p), preview: true });
    return out;
  }
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  const OBJ_NAMES = { case: 'Phone case', cap: 'Case end cap', guard: 'Camera guard ring' };
  function export3MF(res, opt) {
    opt = opt || {}; const bed = res.options.bed, n = res.plates, cols = res.colors, objects = [], plates = Array.from({ length: n }, () => []);
    for (const id of [...new Set(res.parts.map(q => q.obj))]) {
      const ps = res.parts.filter(q => q.obj === id), org = T.bambuPlateOrigin(ps[0].plate, n, bed[0], bed[1]);
      plates[ps[0].plate].push(objects.length);
      const mk = q => ({ name: q.name, p: moveP(q.p, org[0], org[1], 0), color: q.color, extruder: cols.indexOf(q.color) + 1 });
      const nm = OBJ_NAMES[id] || (ps[0].name);
      if (ps.length > 1) objects.push({ name: nm, parts: ps.map(mk) }); else objects.push({ ...mk(ps[0]), name: nm });
    }
    return T.threeMF(objects, { title: opt.name || `${res.phone.name} case`, plates, bambu: opt.bambu || res.options.bambu || 'A1', filaments: cols.map(c => ({ color: c })) });
  }
  function readme(res, name) {
    const o = res.options, s = res.stats, f = v => (Math.round(v * 100) / 100).toString(), rigid = o.material === 'rigid', laptop = s.kind === 'laptop';
    const L = [laptop ? `Expressarte laptop case: ${name}` : `Expressarte phone case: ${name}`, '',
      laptop
        ? `${res.phone.name} \u00b7 hard snap-on shells (PLA or PETG) \u00b7 lid + bottom \u00b7 outside ${f(s.size[0])} \u00d7 ${f(s.size[1])} \u00d7 ${f(s.size[2])} mm \u00b7 walls ${f(o.wall)} mm \u00b7 fit clearance ${f(o.clearance)} mm`
        : `${res.phone.name} \u00b7 ${MATERIALS[o.material]} \u00b7 outside ${f(s.size[0])} \u00d7 ${f(s.size[1])} \u00d7 ${f(s.size[2])} mm \u00b7 back ${f(s.back)} mm \u00b7 fit clearance ${f(o.clearance)} mm`];
    if (o.pattern !== 'none') L.push(`${laptop ? 'Lid' : 'Back'} pattern: ${PATTERNS[o.pattern].label}, ${PAT_STYLES[o.patStyle].toLowerCase()}, ${f(o.patScale)} mm cells, ${f(o.patDepth)} mm deep.`);
    if (s.badge) L.push(`Logo / text: ${BADGE_STYLES[o.badgeStyle].toLowerCase()}.`);
    if (s.monogram) { const MG = monoApi(), m = s.monogram; L.push(`Monogram: ${m.initials} \u00b7 ${(MG && MG.STYLES[m.style] ? MG.STYLES[m.style].label : m.style).toLowerCase()} \u00b7 ${MONO_FINISHES[m.finish].toLowerCase()} \u00b7 ${f(m.size)} mm \u00b7 ${m.color}${m.finish !== 'raised' || m.color !== o.colors.case ? ' (its own part, \"Monogram\")' : ''}.`); }
    L.push('', 'Filament slots in the 3MF'); filaments(res).forEach((x, i) => L.push(`  ${i + 1}: ${x.color}  ${x.role}`));
    L.push('', 'Printing');
    if (laptop) {
      L.push('  - Shells: PLA or PETG, outer face down on the bed exactly as laid out. 0.16 to 0.2 mm layers, 3 walls, 20% infill, no supports.');
      L.push('  - Each shell is a hard snap-on tray: a lid shell for the back of the display, and a bottom shell for the base. The lips clip over the edges.');
      if (s.splitN > 1) {
        L.push(`  - Each shell is split into ${s.splitN} pieces (${s.split.nx} \u00d7 ${s.split.ny}) with a half-lap glue seam and interlocking alignment keys. Dry-fit the keys, then glue with CA glue or a plastic weld. Let the seams set before you snap the shells onto the computer.`);
        L.push('  - Glue the lid pieces into one shell and the bottom pieces into one shell. The keys only fit their matching neighbor.');
      }
      L.push('  - Snap the bottom shell on from underneath, then the lid shell onto the closed or nearly closed lid. Keep the hinge area and any vent openings clear.');
      L.push('  - Port, foot and vent openings are rounded slots that bridge cleanly. If a test print is off, nudge them under Fit and thickness and print again.');
    } else {
      L.push(rigid ? '  - Case: PLA or PETG, back down on the bed exactly as laid out. 0.16 to 0.2 mm layers, 3 walls, no supports. The lip over the screen prints last.'
        : '  - Case: TPU 95A (or 85A to 90A for a softer feel), back down exactly as laid out. Slow down (20 to 30 mm/s), 0.16 to 0.2 mm layers, 3 walls, 20% infill, no supports.');
      L.push('  - Openings at the bottom and sides are rounded slots, so they bridge cleanly with no supports.');
      if (s.guardH) L.push(`  - Camera guard ring: prints flat. Glue it around the camera opening on the back (CA glue for PLA/PETG, flexible CA or E6000 for TPU). It stands ${f(s.guardH)} mm so the lenses stay off the table.`);
      if (rigid) L.push('  - The case comes in two parts: the main shell and an end cap. Slide the main shell onto the phone from the top, then slide the cap on from the bottom until the two snap bumps click into the lap joint.');
    }
    if (s.mount === 'ring') L.push('', 'Magnetic mount', '  Stick a 56 mm adhesive magnetic charging ring (inner hole 46 mm, up to 0.8 mm thick) into the round recess inside the back before you put the phone in.');
    if (s.mount === 'magnets') L.push('', 'Magnetic mount', `  Glue six 6 \u00d7 2 mm disc magnets into the pockets inside the back, all the same pole facing the phone. Add-on magnets go in with the opposite pole facing out.`);
    if (s.addons.length) {
      L.push('', 'Add-ons (each has six 6 \u00d7 2 mm magnet pockets on its flat face; press-fit with a drop of glue, poles matching the case)');
      for (const a of s.addons) L.push(`  - ${ADDONS[a.id].label}: ${({ wallet: `holds ${a.cards} card${a.cards > 1 ? 's' : ''}; prints standing on its side so the card slot needs no bridging.`, kickstand: 'prints flat and unfolded with the hinge printed in place. Snap it free with a gentle twist after printing. 0.2 mm layers, no supports.', ring: 'prints upright; the pointed arch needs no supports.', strap: 'prints flat. Thread a 20 mm elastic strap through both loops.', earbuds: 'prints flat; the lips have a 45\u00b0 underside. Slide the earbud case in from the open end.', clip: `prints flat; the clip opening faces up so it needs no supports (${a.d} mm).`, opener: 'prints flat. Use PETG or PLA with 100% infill for a strong opener.' })[a.id]}`);
      L.push('  Magnets hold well for a wallet, ring or clip in a pocket; don\'t rely on them to carry the phone from a belt.');
    }
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, opt) {
    opt = opt || {}; const name = opt.name || `${res.phone.name} case`, base = safe(opt.fileBase || name.toLowerCase()) || (res.stats && res.stats.kind === 'laptop' ? 'laptop_case' : 'phone_case');
    const list = [{ name: `${base}.3mf`, data: export3MF(res, opt) }], seen = new Set();
    for (const q of res.raw) { let nm = safe(q.name.toLowerCase()); while (seen.has(nm)) nm += '_'; seen.add(nm); list.push({ name: `stl/${nm}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }); }
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }
  function proNeeds(res) {
    const o = res.options;
    return { tool: 'phonecase', colors: res.colors.length, addons: o.addons.length, pattern: o.pattern, patternLabel: PATTERNS[o.pattern].label, proPattern: !!PATTERNS[o.pattern].pro,
      font: o.font, fontLabel: FONTS[o.font].label, extraFont: !!o.text && FONTS[o.font].pro,
      monogram: !!res.stats.monogram, proMonogram: !!res.stats.monogram && !!(monoApi() && monoApi().STYLES[o.monoStyle] && monoApi().STYLES[o.monoStyle].pro),
      monogramLabel: monoApi() && monoApi().STYLES[o.monoStyle] ? monoApi().STYLES[o.monoStyle].label : '' };
  }

  const api = { MONO_FINISHES, MONO_POSITIONS, MONO_POSITIONS_LAPTOP, MONO_SIZE, MATERIALS, PATTERNS, PAT_STYLES, BADGE_STYLES, FONTS, ADDONS, CLIPS, PALETTE, LIMITS, SPEC, DEFAULTS, PHONES: PM.PHONES, LAPTOPS: PM.LAPTOPS, BRANDS: PM.BRANDS, byId: PM.byId, isLaptop: PM.isLaptop, splitPlan,
    options, build, scene, filaments, export3MF, files, readme, proNeeds, patternLoops, outline };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPPhoneCase = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
