/* Expressarte custom stamp maker: a 3D printable roller stamp or hand stamp with your text, your logo, or both.

   Units are mm. Every printed part is built from closed, outward-facing shells; where two shells of one part meet
   they overlap by a hair so slicers merge them into one solid.

   Design ("read frame"): the stamp face is composed the way the impression should read on paper. The die is
   mirrored from it automatically: the hand stamp prints face up with the design mirrored, and the roller wraps the
   design around the wheel so that rolling it lays the impression down the right way round (see wrapBand).

   Parts
   - Roller stamp: a wheel (core + raised relief band, prints lying on its side), a handle with a fork (prints
     standing on the end of the grip, the fork yoke has a 45\u00b0 underside so it needs no supports) and an axle pin
     (prints standing on its head). Optional 608 skate bearings in the wheel. Ink it on an ordinary stamp pad.
   - Hand stamp: a face block (relief up, design mirrored, keyed pocket in the back) and a handle (prints knob down,
     keyed peg up), or one piece printed knob down with a 45\u00b0 flare under the block. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);
  const SF = G.GPStampFonts || (typeof require === 'function' ? require('./stamp-fonts.js') : null);
  const Ck = G.GPClicker || (typeof require === 'function' ? require('./clicker.js') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (v === '' || v === null || v === undefined || !isFinite(+v)) ? d : +v;

  // ---------------------------------------------------------------- choices
  const TYPES = { roller: 'Roller stamp', hand: 'Hand stamp' };
  const CONTENT = { text: 'Text', logo: 'Logo', both: 'Text + logo', pattern: 'Pattern' };
  // repeating textures (seamless around a roller wheel), the clay and fondant favorites
  const PATTERNS = { dots: 'Dots', diamonds: 'Diamonds', hearts: 'Hearts', stars: 'Stars', waves: 'Waves', chevrons: 'Chevrons', grid: 'Grid', hex: 'Honeycomb', stripes: 'Diagonal stripes' };
  // what the stamp is for: sets relief depth and the smallest printable detail, and the print notes
  const USES = {
    ink: { label: 'Ink on paper or fabric', depth: 1.5, minFeature: 0.8 },
    clay: { label: 'Clay and pottery', depth: 2.2, minFeature: 1.2 },
    leather: { label: 'Leather', depth: 1.2, minFeature: 1.0 },
    food: { label: 'Cookies and fondant', depth: 2.0, minFeature: 1.2 }
  };
  const FONTS = {
    slab: { label: 'Slab', src: 'stamp', pro: false }, block: { label: 'Block', src: 'stamp', pro: false },
    round: { label: 'Round', src: 'bubble', pro: false }, chunky: { label: 'Chunky', src: 'bubble', pro: false },
    tall: { label: 'Tall', src: 'stamp', pro: true }, western: { label: 'Western', src: 'stamp', pro: true }, script: { label: 'Script', src: 'stamp', pro: true }
  };
  const SHAPES = { round: 'Round', square: 'Square', rect: 'Rectangle', oval: 'Oval', custom: 'Follow the design' };
  const LAYOUTS = { lines: 'Straight lines', circle: 'Curved around', above: 'Text above logo', below: 'Text below logo', side: 'Logo beside text' };
  const BORDERS = { none: 'No border', line: 'Line', double: 'Double line', dots: 'Dotted' };
  const ORNAMENTS = { none: 'None', star: 'Star', heart: 'Heart', dot: 'Dot', diamond: 'Diamond' };
  const HAND_HANDLES = { knob: { label: 'Turned knob', pro: false }, grip: { label: 'Ribbed grip', pro: false }, mushroom: { label: 'Mushroom', pro: true }, gem: { label: 'Faceted gem', pro: true } };
  const ROLLER_HANDLES = { ergo: { label: 'Contour grip', pro: false }, ribbed: { label: 'Ribbed grip', pro: false }, bulb: { label: 'Palm bulb', pro: true }, gem: { label: 'Faceted', pro: true } };
  const AXLES = { pin: 'Printed axle pin', bearing: '608 skate bearings' };
  const PALETTE = [
    { name: 'Walnut', hex: '#6B4226' }, { name: 'Maple', hex: '#E6D3B3' }, { name: 'Black', hex: '#1E1E1E' }, { name: 'White', hex: '#F7F7F2' },
    { name: 'Red', hex: '#C8102E' }, { name: 'Navy', hex: '#1F3A68' }, { name: 'Forest', hex: '#2F6B4F' }, { name: 'Orange', hex: '#E8730C' },
    { name: 'Yellow', hex: '#F5C518' }, { name: 'Purple', hex: '#7B4FB8' }, { name: 'Gray', hex: '#8A8D91' }, { name: 'Pink', hex: '#F2A0B5' }
  ];
  const INKS = [{ name: 'Red ink', hex: '#B3122E' }, { name: 'Blue ink', hex: '#1F4FA8' }, { name: 'Black ink', hex: '#1C1C1E' }, { name: 'Green ink', hex: '#1E7A46' }, { name: 'Purple ink', hex: '#6A3FA0' }];
  const USE_TIPS = {
    clay: 'Dust the face with cornstarch or spray it lightly with water so clay releases cleanly. Roll or press while the clay is leather-soft, then let it firm up before you lift it.',
    leather: 'Dampen vegetable-tanned leather (casing), then press the stamp in with a mallet or an arbor press on a hard surface. For leather, a stiff hand stamp printed in PLA or PETG with 100% infill works best.',
    food: 'Print in a food-contact-safe filament (PETG is a common choice), use a fresh dedicated print, and wash it before and after use. Dust the face with flour or powdered sugar so dough and fondant release. Layer lines can trap food, so hand wash and replace it when worn.'
  };
  const WRAPS = { auto: 'Auto line breaks', off: 'Keep lines as typed' };
  const LIMITS = { freeColors: 2, maxChars: 28, smallText: 3, hand: { min: 20, max: 200 }, roller: { minD: 24, maxD: 90, minW: 12, maxW: 120 }, pattern: { min: 6, max: 30 }, wideAxle: 80 };
  const SPEC = {
    margin: 1.2, borderW: 1.4, gap: 1.3, plateT: 6, chamfer: 0.8, pegR: 5, pegFlat: 0.55, pocketEnd: 1.8, arrowDepth: 0.6,
    edge: 0.9, wheelChamfer: 0.6, embed: 0.3, armT: 4.6, armGap: 1.0, bossH: 0.7, yokeT: 4.5, yokeClear: 2.5,
    pinR: 3, pinHeadR: 5.6, pinHeadT: 1.8, bearingOD: 22, bearingID: 8, bearingW: 7, gripL: 96
  };
  const DEFAULTS = {
    type: 'roller', content: 'text', text: 'EXPRESSARTE', text2: '', text3: '', pattern: 'diamonds', patternSize: 10, use: 'ink', font: 'slab', layout: 'lines', shape: 'round',
    width: 50, height: 34, diameter: 40, rollW: 30, depth: 1.6, plateT: 6, border: 'line', ornament: 'star', reverse: false,
    textScale: 0.9, logoScale: 1, tracking: 0.06, repeats: 0, separator: 'star', minFeature: 0.8, shoulder: true,
    wrap: 'auto', handle: '', onePiece: false, axle: 'pin', fit: 0.15, detail: 'hd',
    colors: { handle: '#6B4226', body: '', face: '#C8102E' }, ink: '#B3122E',
    image: null, imageName: '', bed: [256, 256], bedZ: 256, bambu: 'A1', gap: 8
  };

  function options(raw) {
    raw = raw || {};
    const o = { ...DEFAULTS, ...raw };
    o.colors = { ...DEFAULTS.colors, ...(raw.colors || {}) };
    o.type = TYPES[o.type] ? o.type : 'roller';
    o.content = CONTENT[o.content] ? o.content : 'text';
    o.font = FONTS[o.font] ? o.font : 'slab';
    o.text = String(o.text == null ? '' : o.text).replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxChars);
    o.text2 = String(o.text2 == null ? '' : o.text2).replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxChars);
    o.text3 = String(o.text3 == null ? '' : o.text3).replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxChars);
    o.pattern = PATTERNS[o.pattern] ? o.pattern : 'diamonds';
    o.patternSize = clamp(num(o.patternSize, 10), LIMITS.pattern.min, LIMITS.pattern.max);
    o.use = USES[o.use] ? o.use : 'ink';
    o.shape = SHAPES[o.shape] ? o.shape : 'round';
    o.layout = LAYOUTS[o.layout] ? o.layout : 'lines';
    // layouts that make sense for this content and stamp
    if (o.content === 'logo' || o.content === 'pattern') o.layout = 'lines';
    else if (o.content === 'text' && !['lines', 'circle'].includes(o.layout)) o.layout = 'lines';
    else if (o.content === 'both' && o.layout === 'lines') o.layout = o.type === 'roller' ? 'side' : 'above';
    if (o.layout === 'circle' && (o.type !== 'hand' || o.shape !== 'round')) o.layout = o.content === 'both' ? (o.type === 'roller' ? 'side' : 'above') : 'lines';
    o.border = BORDERS[o.border] ? o.border : 'line';
    o.ornament = ORNAMENTS[o.ornament] ? o.ornament : 'none';
    o.separator = ORNAMENTS[o.separator] || (o.separator === 'logo' && o.type === 'roller') ? o.separator : 'none';
    const H = LIMITS.hand, R = LIMITS.roller;
    o.bed = [clamp(num(o.bed && o.bed[0], 256), 100, 1000), clamp(num(o.bed && o.bed[1], 256), 100, 1000)];
    o.gap = clamp(num(o.gap, 8), 2, 30);
    // the biggest hand stamp is the one that fits this printer's plate (with the layout margin)
    o.maxHand = [Math.min(H.max, o.bed[0] - 2 * o.gap), Math.min(H.max, o.bed[1] - 2 * o.gap)];
    o.width = clamp(num(o.width, 50), H.min, o.maxHand[0]);
    o.height = clamp(num(o.height, 34), H.min, o.maxHand[1]);
    if (o.shape === 'round' || o.shape === 'square') { o.width = Math.min(o.width, o.maxHand[1]); o.height = o.width; }
    o.diameter = clamp(num(o.diameter, 40), R.minD, R.maxD);
    o.rollW = clamp(num(o.rollW, 30), R.minW, R.maxW);
    o.depth = clamp(num(o.depth, o.type === 'roller' ? 1.5 : 1.6), 0.8, 3);
    o.plateT = clamp(num(o.plateT, 6), 5, 12);
    o.textScale = clamp(num(o.textScale, 0.9), 0.4, 1);
    o.logoScale = clamp(num(o.logoScale, 1), 0.4, 1);
    o.tracking = clamp(num(o.tracking, 0.06), -0.05, 0.4);
    o.repeats = Math.round(clamp(num(o.repeats, 0), 0, 12));
    o.minFeature = clamp(num(o.minFeature, 0.8), 0.4, 3);
    o.fit = clamp(num(o.fit, 0.15), -0.1, 0.5);
    o.reverse = !!raw.reverse; o.shoulder = raw.shoulder !== false; o.onePiece = !!raw.onePiece;
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    o.wrap = o.wrap === 'off' ? 'off' : 'auto';
    const HS = o.type === 'roller' ? ROLLER_HANDLES : HAND_HANDLES;
    if (!HS[o.handle]) o.handle = Object.keys(HS)[0];
    o.axle = AXLES[o.axle] ? o.axle : 'pin';
    o.image = Array.isArray(raw.image) ? raw.image : null;
    o.imageName = String(raw.imageName || '').slice(0, 80);
    for (const k of ['handle', 'body', 'face']) { const v = String(o.colors[k] || ''); o.colors[k] = /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : (k === 'body' ? '' : DEFAULTS.colors[k]); }
    o.ink = /^#[0-9a-f]{6}$/i.test(String(o.ink || '')) ? String(o.ink).toUpperCase() : DEFAULTS.ink;
    o.bedZ = clamp(num(o.bedZ, 256), 80, 1000);
    return o;
  }

  // ---------------------------------------------------------------- 2D helpers
  const P = L => ({ outer: L, holes: [] });
  const U = ps => T.unionPolys(ps), Dff = (a, b) => b && b.length ? T.diffPolys(a, b) : a, I = (a, b) => T.interPolys(a, b), Off = (ps, d) => T.offset(ps, d);
  const tf = (ps, f) => ps.map(Q => ({ outer: Q.outer.map(f), holes: Q.holes.map(h => h.map(f)) }));
  const move = (ps, dx, dy) => tf(ps, p => [p[0] + dx, p[1] + dy]);
  const scale = (ps, s, cx, cy) => tf(ps, p => [(cx || 0) + p[0] * s, (cy || 0) + p[1] * s]);
  const mirrorX = ps => ps.map(Q => ({ outer: Q.outer.map(p => [-p[0], p[1]]).reverse(), holes: Q.holes.map(h => h.map(p => [-p[0], p[1]]).reverse()) }));
  const bb = ps => T.polysBBox(ps);
  const area = ps => T.polysArea(ps);
  const rect = (x0, y0, x1, y1) => P([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const circle = (cx, cy, r, n) => T.circle(cx, cy, r, n || Math.max(24, Math.ceil(r * 5)));
  const a2 = L => { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; };
  function densify(ps, maxLen) {
    const d = L => { const out = []; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / maxLen)); for (let k = 0; k < n; k++) out.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]); } return out; };
    return ps.map(Q => ({ outer: d(Q.outer), holes: Q.holes.map(d) }));
  }
  function star(R, n) { const L = []; n = n || 5; for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, r = i % 2 ? R * 0.45 : R; L.push([r * Math.cos(a), r * Math.sin(a)]); } return L; }
  function heart(R) { const L = [], s = R / 16; for (let i = 0; i < 96; i++) { const t = i / 96 * Math.PI * 2; L.push([16 * Math.sin(t) ** 3 * s, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s + R * 0.15]); } return L; }
  // a small ornament centered on (0,0), about 2R across
  function ornament(kind, R) {
    if (!R || R < 0.6 || kind === 'none') return [];
    if (kind === 'star') return Off(U([P(star(R * 1.05))]), -R * 0.04).length ? Off(Off(U([P(star(R * 1.05))]), -R * 0.06), R * 0.06) : U([P(star(R))]);
    if (kind === 'heart') return U([P(heart(R))]);
    if (kind === 'diamond') return U([P([[0, R], [R * 0.7, 0], [0, -R], [-R * 0.7, 0]])]);
    return [P(circle(0, 0, R * 0.55, 32))];
  }

  // ---------------------------------------------------------------- lettering
  function parsePath(d, s, tol) {
    const tok = String(d).match(/[MLQCZ]|-?\d*\.?\d+/g) || [], loops = []; let i = 0, cmd = 'M', x = 0, y = 0, cur = null;
    const push = (px, py) => { const l = cur[cur.length - 1]; if (!l || Math.abs(l[0] - px) > 1e-9 || Math.abs(l[1] - py) > 1e-9) cur.push([px, py]); };
    const n = () => +tok[i++] * s;
    while (i < tok.length) {
      if (/^[MLQCZ]$/.test(tok[i])) { cmd = tok[i++]; if (cmd === 'Z') { if (cur && cur.length > 2) loops.push(cur); cur = null; continue; } }
      if (cmd === 'M') { if (cur && cur.length > 2) loops.push(cur); x = n(); y = n(); cur = [[x, y]]; cmd = 'L'; }
      else if (cmd === 'L') { const px = n(), py = n(); if (!cur) cur = [[x, y]]; push(px, py); x = px; y = py; }
      else if (cmd === 'Q') { const x1 = n(), y1 = n(), x2 = n(), y2 = n(); if (!cur) cur = [[x, y]]; const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1), m = Math.max(2, Math.ceil(Math.sqrt(len / tol) * 0.55)); for (let k = 1; k <= m; k++) { const t = k / m, a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t; push(a * x + b * x1 + c * x2, a * y + b * y1 + c * y2); } x = x2; y = y2; }
      else if (cmd === 'C') { const x1 = n(), y1 = n(), x2 = n(), y2 = n(), x3 = n(), y3 = n(); if (!cur) cur = [[x, y]]; const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2), m = Math.max(3, Math.ceil(Math.sqrt(len / tol) * 0.6)); for (let k = 1; k <= m; k++) { const t = k / m, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, e = t ** 3; push(a * x + b * x1 + c * x2 + e * x3, a * y + b * y1 + c * y2 + e * y3); } x = x3; y = y3; }
      else i++;
    }
    if (cur && cur.length > 2) loops.push(cur);
    return loops.map(L => { const f = L[0], l = L[L.length - 1]; return Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-9 ? L.slice(0, -1) : L; }).filter(L => L.length > 2);
  }
  // Round and Chunky take plain letters from the bubble fonts and accented letters (Spanish, Turkish, French, German,
  // Portuguese) from stamp-fonts.js; an accented letter can be stored as [advance, accent path, base letter].
  const sfGlyph = (font, ch) => { const F = SF && SF[font], e = F && F.glyphs[ch]; if (!e) return null;
    if (!e[2]) return { F, adv: e[0], d: e[1] };
    const B = FONTS[font].src === 'bubble' ? Bubble.FONTS[font] : F, b = (B && B.glyphs[e[2]]) || F.glyphs[e[2]];
    return b ? { F, adv: e[0], d: b[1] + e[1] } : null; };
  const own = (font, ch) => (FONTS[font].src === 'bubble' && Bubble.supported(font, ch)) || !!sfGlyph(font, ch);
  // a letter the font can't draw: its unaccented base if the font has that (e.g. "\u0142" is not decomposable, "\u0151" -> "o")
  const plainOf = ch => { const b = ch.normalize ? ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : ch; return b && b !== ch ? b : null; };
  const supported = (font, ch) => own(font, ch);
  const GC = new Map();
  // one glyph at cap height h (mm), baseline y = 0, pen at x = 0: { polys, adv }
  function glyph(font, ch, h) {
    const key = font + '|' + ch + '|' + h.toFixed(3); if (GC.has(key)) return GC.get(key);
    let g = null;
    if (FONTS[font].src === 'bubble' && Bubble.supported(font, ch)) { const b = Bubble.glyphPolys(font, ch, h); if (b) g = { polys: b.polys, adv: b.advance }; }
    else { const e = sfGlyph(font, ch); if (e) { const s = h / e.F.cap; g = { polys: T.unionPolys(parsePath(e.d, s, 0.012).map(P), 'nonzero'), adv: e.adv * s }; } }
    if (GC.size > 4000) GC.clear(); GC.set(key, g); return g;
  }
  // a line of text: glyphs left to right, baseline 0
  function textLine(str, font, h, track, dropped) {
    const out = []; let x = 0, any = false;
    for (const ch of [...String(str)]) {
      if (/\s/.test(ch)) { x += h * 0.3; continue; }
      let c = ch;
      if (!own(font, c)) { const b = plainOf(c); if (b && [...b].every(x => own(font, x)) && b.length === 1) { if (dropped) (dropped.plain || (dropped.plain = new Set())).add(ch); c = b; } else { if (dropped) dropped.add(ch); continue; } }
      const g = glyph(font, c, h); if (!g || !g.polys.length) continue;
      out.push({ polys: move(g.polys, x, 0), x0: x, x1: x + g.adv }); x += g.adv + track * h; any = true;
    }
    const polys = U(out.flatMap(g => g.polys)), b = polys.length ? bb(polys) : { x0: 0, x1: 0, y0: 0, y1: 0 };
    return { polys, glyphs: out, w: any ? x - track * h : 0, b };
  }
  // lines stacked and centered; returns polys centered on (0,0)
  function textBlock(lines, font, h, track, dropped) {
    const L = lines.filter(Boolean).map(s => textLine(s, font, h, track, dropped)).filter(l => l.polys.length);
    if (!L.length) return [];
    const gapY = h * 0.42; let y = 0; const out = [];
    L.forEach((l, i) => { if (i) y -= h + gapY; out.push(...move(l.polys, -(l.b.x0 + l.b.x1) / 2, y)); });
    const ps = U(out), b = bb(ps); return move(ps, -(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
  }
  // The typed lines, plus (with auto line breaks) the one line split at spaces onto 2 or 3 lines, balanced by width,
  // or two typed lines joined onto one.
  function lineSets(lines, o) {
    const sets = [lines];
    if (o.wrap === 'off' || !lines.length || lines.length > 2) return sets; // three typed lines stay as typed
    if (lines.length === 2) { const j = [lines.join(' ')]; j.joined = true; sets.push(j); return sets; } // only when the typed lines come out tiny
    const words = lines[0].split(' ').filter(Boolean); if (words.length < 2) return sets;
    for (const n of [2, 3]) {
      if (words.length < n) break;
      let best = null;
      const rec = (i, k, acc) => {
        if (k === 1) { const g = acc.concat([words.slice(i).join(' ')]), m = Math.max(...g.map(x => [...x].length)); if (!best || m < best.m) best = { g, m }; return; }
        for (let j = i + 1; j <= words.length - k + 1; j++) rec(j, k - 1, acc.concat([words.slice(i, j).join(' ')]));
      };
      rec(0, n, []); if (best) sets.push(best.g);
    }
    return sets;
  }
  // pick the line set whose letters come out tallest; scoreOf(lines) -> letter height (mm). A split has to beat
  // the line as typed by 15% (and 3 lines beat 2 by 15%) so short text stays on one line; two typed lines are only
  // joined when they would come out under 4 mm.
  function bestLines(sets, scoreOf) {
    let best = null;
    for (const L of sets) { if (L.joined && best && best.sc >= 4) continue; const sc = scoreOf(L); if (!best || sc > best.sc * 1.15) best = { L, sc }; }
    return best || { L: sets[0], sc: 0 };
  }
  // text bent onto a circle. top: reads left to right over the top, letters pointing out; bottom: reads left to
  // right under the bottom, letters pointing in. The band is [Rin - h, Rin]. Shrinks to fit maxAngle (radians).
  function arcText(str, font, h, Rin, where, maxAngle, track, dropped) {
    // h is the band height: the letters' full extent (accents, ascenders, descenders like y, g, \u00e7) must fit in it,
    // so the cap height is scaled down until the whole line sits inside [Rin - h, Rin]
    const band = h; let cap = h, line = textLine(str, font, cap, track, dropped); if (!line.polys.length) return { polys: [], h, cap: 0 };
    const ext = () => line.b.y1 - line.b.y0;
    if (ext() > band * 1.001) { cap *= band / ext(); line = textLine(str, font, cap, track, dropped); }
    const Rm = Rin - band / 2, need = line.w / Rm;
    if (need > maxAngle) { const k = maxAngle / need; cap *= k; line = textLine(str, font, cap, track, dropped); }
    const e = ext(), y0 = line.b.y0, Rm2 = Rin - e / 2, cx = (line.b.x0 + line.b.x1) / 2;
    const ps = densify(line.polys, Math.max(0.15, cap / 40));
    const map = where === 'top'
      ? p => { const th = Math.PI / 2 - (p[0] - cx) / Rm2, r = Rin - e + (p[1] - y0); return [r * Math.cos(th), r * Math.sin(th)]; }
      : p => { const th = -Math.PI / 2 + (p[0] - cx) / Rm2, r = Rin - (p[1] - y0); return [r * Math.cos(th), r * Math.sin(th)]; };
    return { polys: U(tf(ps, map)), h: e, cap };
  }

  // ---------------------------------------------------------------- fitting
  // the largest scale (up to sMax) at which ps, centered on (cx, cy), stays inside region
  function fitInto(ps, region, cx, cy, sMax) {
    if (!ps.length || !region.length) return { polys: [], s: 0 };
    const b = bb(ps), ox = (b.x0 + b.x1) / 2, oy = (b.y0 + b.y1) / 2, A = area(ps);
    const at = s => tf(ps, p => [cx + (p[0] - ox) * s, cy + (p[1] - oy) * s]);
    const ok = s => area(T.diffPolys(at(s), region)) <= A * s * s * 0.0015 + 1e-4;
    if (ok(sMax)) return { polys: at(sMax), s: sMax };
    let lo = 0, hi = sMax; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    return { polys: at(lo), s: lo };
  }
  const bboxFit = (ps, w, h) => { const b = bb(ps); return Math.min(w / Math.max(1e-6, b.x1 - b.x0), h / Math.max(1e-6, b.y1 - b.y0)); };

  // ---------------------------------------------------------------- the logo
  function logoPolys(o) {
    let ps = o.image;
    if ((!ps || !ps.length) && o.gray && o.w) ps = (G.GPClicker || Ck).traceImage(o.gray, o.w, o.h, o, o.alpha);
    if (!ps || !ps.length) return [];
    ps = U(ps); if (!ps.length) return [];
    const b = bb(ps); return move(ps, -(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
  }
  function placeholderLogo(R) { // shown until a logo is uploaded: a simple star badge
    return U([P(star(R, 5))]);
  }

  // ---------------------------------------------------------------- repeating patterns
  // Fills the box [x0, x1] \u00d7 [y0, y1] with one pattern on a cellU \u00d7 cellV grid. Columns start at x0, so a box that is a
  // whole number of cells wide tiles seamlessly (the roller picks cellU = C / n for that). Shapes may spill past the box;
  // the caller clips them.
  function patternPolys(kind, x0, y0, x1, y1, cellU, cellV, minF, loose) {
    const out = [], nu = Math.ceil((x1 - x0) / cellU) + 1, nv = Math.ceil((y1 - y0) / cellV) + 1, s = Math.min(cellU, cellV);
    const t = Math.max(minF * 1.05, s * 0.18); // stroke width for line patterns
    const cy0 = (y0 + y1) / 2 - Math.floor(nv / 2) * cellV; // rows centered on the box, so the pattern sits even top to bottom
    const band = (fy, xa, xb) => { const step = Math.min(cellU / 24, 0.6), top = [], bot = []; // a stroked curve y = fy(x)
      for (let x = xa; x <= xb + 1e-9; x += step) { const y = fy(x), d = (fy(x + 0.01) - fy(x - 0.01)) / 0.02, k = t / 2 * Math.sqrt(1 + d * d); top.push([x, y + k]); bot.push([x, y - k]); }
      return P(top.concat(bot.reverse())); };
    if (kind === 'waves' || kind === 'chevrons') {
      const amp = cellV * 0.22, f = kind === 'waves' ? u => Math.sin(2 * Math.PI * u) : u => { const q = ((u % 1) + 1) % 1; return q < 0.5 ? 4 * q - 1 : 3 - 4 * q; };
      for (let j = -1; j <= nv; j++) { const yc = cy0 + j * cellV; out.push(band(x => yc + amp * f((x - x0) / cellU), x0 - cellU, x1 + cellU)); }
      return U(out);
    }
    if (kind === 'grid') {
      for (let i = -1; i <= nu; i++) { const x = x0 + i * cellU; out.push(rect(x - t / 2, y0 - cellV, x + t / 2, y1 + cellV)); }
      for (let j = -1; j <= nv; j++) { const y = cy0 + (j + 0.5) * cellV; out.push(rect(x0 - cellU, y - t / 2, x1 + cellU, y + t / 2)); }
      return U(out);
    }
    if (kind === 'stripes') { // 45\u00b0 bands, one per column, so they tile around the wheel
      const h = (y1 - y0) + 2 * cellV, w = cellU * 0.42;
      for (let i = -Math.ceil(h / cellU) - 1; i <= nu; i++) { const xa = x0 + i * cellU, ya = y0 - cellV; out.push(P([[xa, ya], [xa + w, ya], [xa + w + h, ya + h], [xa + h, ya + h]])); }
      return U(out);
    }
    for (let j = -1; j <= nv; j++) {
      const yc = cy0 + j * cellV, odd = ((j % 2) + 2) % 2 === 1;
      for (let i = -1; i <= nu; i++) {
        const xc = x0 + (i + 0.5 + (odd && kind !== 'diamonds' ? 0.5 : 0)) * cellU;
        if (kind === 'dots') out.push(P(circle(xc, yc, s * 0.3, 28)));
        else if (kind === 'diamonds') out.push(P([[xc - cellU * 0.4, yc], [xc, yc - cellV * 0.4], [xc + cellU * 0.4, yc], [xc, yc + cellV * 0.4]]));
        else if (kind === 'hearts') out.push(...move(ornament('heart', s * 0.36), xc, yc));
        else if (kind === 'stars') out.push(...move(ornament('star', s * 0.4), xc, yc));
        else if (kind === 'hex') { const R = s * 0.5, ri = Math.max(0.3, R - Math.max(t, minF * 1.4)), hx = r => { const L = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; L.push([xc + r * Math.cos(a), yc + r * Math.sin(a)]); } return L; };
          out.push(...Dff([P(hx(R * 0.96))], [P(hx(ri * 0.96))])); }
      }
    }
    return loose ? out : U(out);
  }
  const MOTIFS = new Set(['dots', 'diamonds', 'hearts', 'stars', 'hex']);
  // fill a region with a pattern: whole motifs only (no clipped slivers at the edge); line patterns are clipped and
  // any slivers thinner than the smallest detail are trimmed off. vBand: [v0, v1] limits only v (the roller wraps u).
  function fillPattern(o, region, x0, y0, x1, y1, cU, cV, vBand) {
    const minF = o.minFeature, kind = o.pattern;
    if (MOTIFS.has(kind)) {
      const pieces = patternPolys(kind, x0, y0, x1, y1, cU, cV, minF, true), keep = [];
      for (const q of pieces) { const b = bb([q]);
        if (vBand) { if (b.y0 >= vBand[0] - 1e-6 && b.y1 <= vBand[1] + 1e-6) keep.push(q); continue; }
        const a = Math.abs(area([q])); if (a > 0 && Math.abs(area(I([q], region))) >= a * 0.999) keep.push(q); }
      const r = minF * 0.55; return U(Off(Off(I(U(keep), region), -r), r)); // round off tips finer than the smallest detail
    }
    const cut = I(patternPolys(kind, x0, y0, x1, y1, cU, cV, minF), region), r = minF * 0.55;
    return U(Off(Off(cut, -r), r)).filter(Q => Math.abs(area([Q])) > minF * minF * 2);
  }

  // ---------------------------------------------------------------- face outlines (read frame, centered)
  // Rings with the same vertex count for every inset, so the block's chamfers can be lofted between them.
  function ringPts(o, inset, n) {
    const W = o.width, H = o.height, out = [];
    if (o.shape === 'round') { const r = W / 2 - inset; for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; out.push([r * Math.cos(t), r * Math.sin(t)]); } return out; }
    if (o.shape === 'oval') { const a = W / 2 - inset, b = H / 2 - inset; for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; out.push([a * Math.cos(t), b * Math.sin(t)]); } return out; }
    const r0 = Math.min(W, H) * 0.12, rc = Math.max(0.35, r0 - inset), ax = W / 2 - inset - rc, ay = H / 2 - inset - rc, m = Math.max(2, Math.round(n / 4));
    const cs = [[ax, ay, 0], [-ax, ay, 1], [-ax, -ay, 2], [ax, -ay, 3]];
    for (const [cx, cy, q] of cs) for (let k = 0; k < m; k++) { const t = (q + k / (m - 1)) * Math.PI / 2; out.push([cx + rc * Math.cos(t), cy + rc * Math.sin(t)]); }
    return out;
  }
  const ringPoly = (o, inset, n) => [P(ringPts(o, inset, n || 192))];

  // ---------------------------------------------------------------- hand stamp face
  function borderPolys(kind, outer, bw, minF) { // outer: polys of the border's outside edge
    if (kind === 'none') return { polys: [], w: 0 };
    bw = Math.max(bw, minF);
    if (kind === 'line') return { polys: Dff(outer, Off(outer, -bw)), w: bw };
    if (kind === 'double') { const a = Math.max(minF, bw * 0.75), g = Math.max(0.9, minF * 1.2), b = Math.max(minF, bw * 0.5);
      const o2 = Off(outer, -(a + g)); return { polys: U(Dff(outer, Off(outer, -a)).concat(Dff(o2, Off(o2, -b)))), w: a + g + b }; }
    // dots along the outline
    const r = Math.max(minF * 0.75, bw * 0.62), path = Off(outer, -r), dots = [];
    for (const Q of path) { const L = Q.outer; let per = 0; for (let i = 0; i < L.length; i++) per += Math.hypot(L[(i + 1) % L.length][0] - L[i][0], L[(i + 1) % L.length][1] - L[i][1]);
      const n = Math.max(6, Math.floor(per / (r * 2.9))), step = per / n; let acc = 0, next = 0;
      for (let i = 0; i < L.length && dots.length < 400; i++) { const p = L[i], q = L[(i + 1) % L.length], s = Math.hypot(q[0] - p[0], q[1] - p[1]);
        while (next <= acc + s) { const t = s ? (next - acc) / s : 0; dots.push(P(circle(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, r, 20))); next += step; }
        acc += s; } }
    return { polys: U(dots), w: r * 2 };
  }
  function contentHand(o, inner, logo, dropped, warnings) {
    const lines = [o.text, o.text2, o.text3].filter(Boolean), b = bb(inner), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, w = b.x1 - b.x0, h = b.y1 - b.y0;
    let blk = hgt => textBlock(lines, o.font, hgt, o.tracking, dropped);
    const cap = mm => { if (mm > 0) o._cap = Math.min(o._cap || Infinity, mm); };
    // text blocks are built 10 mm tall per line, so the fitted scale gives the letter height; pass txt = true for text
    const fitText = (ps, region, k, txt) => { if (!ps.length) return []; const rb = bb(region); const f = fitInto(ps, region, (rb.x0 + rb.x1) / 2, (rb.y0 + rb.y1) / 2, bboxFit(ps, rb.x1 - rb.x0, rb.y1 - rb.y0)); if (txt) cap(10 * f.s * k); return scale(move(f.polys, -(rb.x0 + rb.x1) / 2, -(rb.y0 + rb.y1) / 2), k, (rb.x0 + rb.x1) / 2, (rb.y0 + rb.y1) / 2); };
    // auto line breaks: a single long line goes onto 2 or 3 lines when that makes the letters bigger
    const wrapFor = region => { if (lines.length > 2 || o.wrap === 'off' || o.shape === 'custom') return; /* a custom outline follows the text as typed */ const rb = bb(region);
      const pick = bestLines(lineSets(lines, o), L => { const ps = textBlock(L, o.font, 10, o.tracking, null); if (!ps.length) return 0; return 10 * fitInto(ps, region, (rb.x0 + rb.x1) / 2, (rb.y0 + rb.y1) / 2, bboxFit(ps, rb.x1 - rb.x0, rb.y1 - rb.y0)).s; });
      if (pick.L !== lines) { o._lines = pick.L; blk = hgt => textBlock(pick.L, o.font, hgt, o.tracking, dropped); } };
    if (o.content === 'logo') { if (!logo.length) return []; return fitText(logo, inner, o.logoScale); }
    if (o.content === 'pattern') { const cell = o.patternSize; return fillPattern(o, inner, b.x0, b.y0, b.x1, b.y1, cell, o.pattern === 'hex' ? cell * 0.866 : cell); }
    if (o.layout === 'circle') {
      const Rin = w / 2, th = clamp(Rin * 0.27 * o.textScale, 2.2, 18), both = !!(o.text && o.text2);
      const top = o.text ? arcText(o.text, o.font, th, Rin, 'top', both ? 2.45 : 4.6, o.tracking + 0.05, dropped) : { polys: [], h: th };
      const bot = o.text2 ? arcText(o.text2, o.font, Math.min(th, top.h * 1.0 || th), Rin, 'bottom', both ? 2.45 : 4.6, o.tracking + 0.05, dropped) : { polys: [], h: 0 };
      const band = Math.max(top.h, bot.h || 0), out = [...top.polys, ...bot.polys]; cap(top.polys.length ? top.cap : 0); cap(bot.polys.length ? bot.cap : 0);
      if (both && o.ornament !== 'none') { const r = Math.min(band * 0.38, 4); out.push(...move(ornament(o.ornament, r), Rin - band / 2, 0), ...move(ornament(o.ornament, r), -(Rin - band / 2), 0)); }
      let Rc = Rin - band - o._gap;
      if (o.border !== 'none' && Rc > 6) { const sw = Math.max(o.minFeature, o._bw * 0.6); out.push(...Dff([P(circle(0, 0, Rc, 160))], [P(circle(0, 0, Rc - sw, 160))])); Rc -= sw + o._gap; }
      if (o.content === 'both' && Rc > 3) { const L = logo.length ? logo : placeholderLogo(Rc * 0.7); out.push(...fitText(L, [P(circle(0, 0, Rc, 160))], o.logoScale)); }
      else if (o.content === 'text' && Rc > 2 && o.ornament !== 'none') out.push(...ornament(o.ornament, Rc * 0.55 * o.logoScale));
      return move(U(out), cx, cy);
    }
    if (o.content === 'text') { wrapFor(inner); return fitText(blk(10), inner, o.textScale, true); }
    // text + logo
    const L = logo.length ? logo : placeholderLogo(10), g = o._gap;
    if (o.layout === 'side') {
      const lw = w * 0.38, lr = I(inner, [rect(b.x0, b.y0, b.x0 + lw, b.y1)]), tr = I(inner, [rect(b.x0 + lw + g, b.y0, b.x1, b.y1)]);
      wrapFor(tr); return U(fitText(L, lr, o.logoScale).concat(fitText(blk(10), tr, o.textScale, true)));
    }
    const one = lines.length < 2 || o.layout === 'below', tH = h * (one ? 0.3 : 0.24);
    if (o.layout === 'above' && lines.length === 2) { // line 1 over the logo, line 2 under it
      const t1 = I(inner, [rect(b.x0, b.y1 - tH, b.x1, b.y1)]), t2 = I(inner, [rect(b.x0, b.y0, b.x1, b.y0 + tH)]), lr = I(inner, [rect(b.x0, b.y0 + tH + g, b.x1, b.y1 - tH - g)]);
      const A = fitText(textBlock([lines[0]], o.font, 10, o.tracking, dropped), t1, o.textScale, true), B = fitText(textBlock([lines[1]], o.font, 10, o.tracking, dropped), t2, o.textScale, true);
      return U(A.concat(B, fitText(L, lr, o.logoScale)));
    }
    const top = o.layout === 'above', tr = I(inner, [top ? rect(b.x0, b.y1 - tH * (lines.length > 1 ? 1.7 : 1), b.x1, b.y1) : rect(b.x0, b.y0, b.x1, b.y0 + tH * (lines.length > 1 ? 1.7 : 1))]);
    const tb = bb(tr), lr = I(inner, [top ? rect(b.x0, b.y0, b.x1, tb.y0 - g) : rect(b.x0, tb.y1 + g, b.x1, b.y1)]);
    return U(fitText(blk(10), tr, o.textScale, true).concat(fitText(L, lr, o.logoScale)));
  }
  function composeHand(o, logo, warnings, dropped) {
    const minF = o.minFeature, n = o.detail === 'hd' ? 256 : 128;
    o._bw = Math.max(SPEC.borderW, minF); o._gap = SPEC.gap;
    let outline, inner, border = [];
    if (o.shape === 'custom') {
      const box = [rect(-o.width / 2 + 3, -o.height / 2 + 3, o.width / 2 - 3, o.height / 2 - 3)];
      const oc = { ...o, layout: o.layout === 'circle' ? 'lines' : o.layout };
      const design = U(contentHand(oc, box, logo, dropped, warnings)); o._cap = oc._cap; o._lines = oc._lines;
      if (!design.length) { outline = [rect(-o.width / 2, -o.height / 2, o.width / 2, o.height / 2)]; return { outline, relief: [], design: [] }; }
      const bw = o.border === 'none' ? 0 : borderPolys(o.border, [P(circle(0, 0, 10, 32))], o._bw, minF).w;
      const pad = SPEC.margin + (bw ? bw + o._gap : 0.9) + 0.2;
      let out = Off(Off(U(design.map(q => ({ outer: q.outer, holes: [] }))), pad + 2.5), -2.5);
      out = [out.reduce((a, q) => !a || Math.abs(a2(q.outer)) > Math.abs(a2(a.outer)) ? q : a, null)].map(q => ({ outer: q.outer, holes: [] }));
      outline = out;
      if (bw) border = borderPolys(o.border, Off(outline, -SPEC.margin), o._bw, minF).polys;
      return { outline, relief: U(design.concat(border)), design, border };
    }
    outline = ringPoly(o, 0, n);
    const face = ringPoly(o, SPEC.margin, n);
    let contentInset = SPEC.margin + 0.9;
    if (o.border !== 'none') { const B = borderPolys(o.border, face, o._bw, minF); border = B.polys; contentInset = SPEC.margin + B.w + o._gap; }
    inner = ringPoly(o, contentInset, n);
    const design = contentHand(o, inner, logo, dropped, warnings);
    if (o.reverse) { // solid face, design knocked out (kept inside the border)
      const solid = Dff(inner, Off(design, Math.max(0, o.minFeature * 0.15)));
      return { outline, face, relief: U(solid.concat(border)), design, border, inner };
    }
    return { outline, face, relief: U(design.concat(border)), design, border, inner };
  }

  // ---------------------------------------------------------------- roller band (read frame: u along the roll, v across)
  function rollerDims(o) {
    const Rout = o.diameter / 2, Rc = Rout - o.depth, C = 2 * Math.PI * Rout;
    return { Rout, Rc, C, W: o.rollW };
  }
  function composeRoller(o, logo, warnings, dropped) {
    const { C, W } = rollerDims(o), minF = o.minFeature, half = W / 2 - SPEC.edge;
    const bw = Math.max(SPEC.borderW, minF), g = SPEC.gap; let rails = [], Vc = half - 0.4;
    if (o.border === 'line') { rails = [rect(0, half - bw, C, half), rect(0, -half, C, -half + bw)]; Vc = half - bw - g; }
    else if (o.border === 'double') { const a = Math.max(minF, bw * 0.7), gg = Math.max(0.9, minF * 1.2), b = Math.max(minF, bw * 0.5);
      rails = [rect(0, half - a, C, half), rect(0, -half, C, -half + a), rect(0, half - a - gg - b, C, half - a - gg), rect(0, -half + a + gg, C, -half + a + gg + b)]; Vc = half - a - gg - b - g; }
    else if (o.border === 'dots') { const r = Math.max(minF * 0.75, bw * 0.6), n = Math.max(8, Math.floor(C / (r * 3))), st = C / n;
      for (let i = 0; i < n; i++) { rails.push(P(circle((i + 0.5) * st, half - r, r, 18)), P(circle((i + 0.5) * st, -half + r, r, 18))); } Vc = half - 2 * r - g; }
    const Hc = Math.max(2, 2 * Vc), lines = [o.text, o.text2, o.text3].filter(Boolean);
    if (o.content === 'pattern') { // a seamless texture: a whole number of cells around the wheel
      const nU = Math.max(1, Math.round(C / o.patternSize)), cU = C / nU, cV = o.pattern === 'hex' ? cU * 0.866 : cU, box = [rect(0, -Vc, C, Vc)];
      let design = fillPattern(o, box, 0, -Vc, C, Vc, cU, cV, [-Vc, Vc]);
      if (o.reverse) design = Dff(box, design);
      return { relief: U(design.concat(rails)), design, rails, C, W, repeats: nU, pitch: cU, tileW: cU, Hc, pattern: true };
    }
    // one tile of the design, centered on (0,0), Hc tall at most
    const fitH = (ps, h) => { if (!ps.length) return []; const b = bb(ps), s = h / Math.max(1e-6, b.y1 - b.y0); return scale(move(ps, -(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2), s); };
    let tile = [], tScale = 0; // tScale: letter height (mm) per mm of the text block's height
    const L = logo.length ? logo : (o.content !== 'text' ? placeholderLogo(10) : []);
    const sp0 = Math.max(3, Hc * 0.35) + (o.separator === 'logo' ? Hc * 0.7 : o.separator !== 'none' ? Hc * 0.35 : 0);
    // the text block, 10 mm per line; for text only, auto line breaks pick the split with the tallest letters
    const tblock = (hFrac, wMax) => {
      let use = lines;
      if (o.content === 'text') use = bestLines(lineSets(lines, o), Ls => { const ps = textBlock(Ls, o.font, 10, o.tracking, null); if (!ps.length) return 0; const b = bb(ps); return 10 * Math.min(Hc * hFrac / (b.y1 - b.y0), wMax / (b.x1 - b.x0)); }).L;
      if (use !== lines) o._lines = use;
      const ps = textBlock(use, o.font, 10, o.tracking, dropped); if (ps.length) { const b = bb(ps); tScale = 10 / (b.y1 - b.y0); } return ps;
    };
    const txH = ps => { if (!ps.length || !tScale) return; const b = bb(ps); o._cap = (b.y1 - b.y0) * tScale; };
    if (o.content === 'text') { tile = fitH(tblock(o.textScale, C - sp0), Hc * o.textScale); txH(tile); }
    else if (o.content === 'logo') tile = fitH(L, Hc * o.logoScale);
    else if (o.layout === 'above' || o.layout === 'below') {
      const tb = fitH(tblock(), Hc * (lines.length > 1 ? 0.42 : 0.3) * o.textScale / 0.9), lg = fitH(L, Hc * 0.6 * o.logoScale); txH(tb);
      const tbb = bb(tb), lbb = bb(lg), top = o.layout === 'above';
      const tot = (tbb.y1 - tbb.y0) + (lbb.y1 - lbb.y0) + g, yT = top ? Hc / 2 - (tbb.y1 - tbb.y0) / 2 : -Hc / 2 + (tbb.y1 - tbb.y0) / 2;
      const yL = top ? yT - (tbb.y1 - tbb.y0) / 2 - g - (lbb.y1 - lbb.y0) / 2 : yT + (tbb.y1 - tbb.y0) / 2 + g + (lbb.y1 - lbb.y0) / 2;
      tile = U(move(tb, 0, yT).concat(move(lg, 0, yL))); void tot;
      const b2 = bb(tile); tile = move(tile, 0, -(b2.y0 + b2.y1) / 2);
    } else { // logo beside the text
      const lg = fitH(L, Hc * o.logoScale), tb = fitH(tblock(), Hc * (lines.length > 1 ? 0.8 : 0.56) * o.textScale / 0.9); txH(tb);
      const lb = bb(lg), tbb = bb(tb), gx = Hc * 0.16;
      const total = (lb.x1 - lb.x0) + gx + (tbb.x1 - tbb.x0);
      tile = U(move(lg, -total / 2 + (lb.x1 - lb.x0) / 2, 0).concat(move(tb, total / 2 - (tbb.x1 - tbb.x0) / 2, 0)));
    }
    let tb = tile.length ? bb(tile) : { x0: 0, x1: 0 }, tw = tb.x1 - tb.x0;
    const sp = sp0;
    if (tw + sp > C) { const k = (C - sp) / tw; tile = scale(tile, k); if (o._cap) o._cap *= k; tb = bb(tile); tw = tb.x1 - tb.x0; if (k < 0.6 && !(o._cap >= 5)) warnings.push('The design was too long for one turn of the wheel, so it was scaled down. Use a bigger wheel or shorter text.'); }
    const fitN = Math.max(1, Math.floor(C / (tw + sp)));
    let n = o.repeats > 0 ? Math.min(o.repeats, fitN) : fitN;
    if (o.repeats > fitN) warnings.push(`Only ${fitN} cop${fitN === 1 ? 'y fits' : 'ies fit'} around this wheel.`);
    const pitch = C / n, out = [];
    for (let i = 0; i < n; i++) out.push(...move(tile, (i + 0.5) * pitch, 0));
    const sepR = Math.min(Hc * 0.2, (pitch - tw) * 0.28);
    if (o.separator === 'logo') { // your logo between the copies, scaled to fit the gap (mirrored with the rest of the face)
      const sl = o._sepLogo && o._sepLogo.length ? o._sepLogo : ornament('star', sepR);
      const gapW = (pitch - tw) * 0.62, sh = Math.min(Hc * 0.62, gapW * 1.6), sw = gapW;
      if (sl.length && Math.min(sh, sw) >= Math.max(1.2, minF * 1.5)) { const b = bb(sl), k = bboxFit(sl, sw, sh), one = scale(move(sl, -(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2), k);
        for (let i = 0; i < n; i++) out.push(...move(one, i * pitch, 0)); }
      else warnings.push('There is no room for the logo between the copies. Use fewer repeats or a bigger wheel.');
    } else if (o.separator !== 'none' && sepR >= Math.max(0.8, minF)) for (let i = 0; i < n; i++) out.push(...move(ornament(o.separator, sepR), i * pitch, 0));
    let design = U(out);
    if (o.reverse) { design = Dff([rect(-1, -Vc - g * 0.5, C + 1, Vc + g * 0.5)], design); }
    // wrap anything that crosses the seam back onto [0, C)
    const strip = [rect(0, -W, C, W)];
    const wrap = ps => U(I(ps, strip).concat(I(move(ps, C, 0), strip), I(move(ps, -C, 0), strip)));
    design = wrap(design);
    return { relief: U(design.concat(rails)), design, rails, C, W, repeats: n, pitch, tileW: tw, Hc };
  }

  // ---------------------------------------------------------------- printability: minimum feature size
  function openRelief(ps, minF, warnings) {
    if (!ps.length) return ps;
    const d = minF / 2, A0 = area(ps), q = U(Off(Off(ps, -d), d * 1.0));
    const lost = A0 > 0 ? 1 - area(q) / A0 : 0;
    if (lost > 0.03) warnings.push(`Some details are thinner than ${minF} mm, so ${Math.round(lost * 100)}% of the design was too fine to print and was left off. Make the stamp bigger, the text shorter, or lower the minimum feature size.`);
    return q.filter(Q => Math.abs(a2(Q.outer)) > minF * minF * 0.5);
  }

  // ---------------------------------------------------------------- meshes
  const OVER = 0.02;
  function fixSign(p) { return Core.signedVolume(p) < 0 ? Core.flip(p) : p; }
  function prism(ps, z0, z1) { // a closed prism; retries with slivers opened when the triangulator trips
    if (!ps.length || z1 <= z0) return new Float64Array(0);
    let m = T.extrude(ps, 2, z0, z1);
    for (const e of [0.02, 0.05, 0.1]) { if (Core.checkClosed(m).closed) break; m = T.extrude(U(Off(Off(ps, -e), e)), 2, z0, z1); }
    return m;
  }
  // loft through rings of equal length; rings form a closed loop (like a lathe profile); a ring of identical points
  // is a pole. Optional per-vertex map (e.g. the yoke clamp).
  function loftLoop(rings) {
    const n = rings[0].length, out = [], R = rings.length;
    const pole = r => { const a = r[0]; for (let i = 1; i < r.length; i++) if (Math.abs(r[i][0] - a[0]) > 1e-9 || Math.abs(r[i][1] - a[1]) > 1e-9 || Math.abs(r[i][2] - a[2]) > 1e-9) return false; return true; };
    const poles = rings.map(pole);
    const tri = (a, b, c) => { out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); };
    for (let i = 0; i < R; i++) {
      const A = rings[i], B = rings[(i + 1) % R]; if (poles[i] && poles[(i + 1) % R]) continue;
      for (let j = 0; j < n; j++) { const j1 = (j + 1) % n;
        if (!poles[i]) tri(A[j], A[j1], B[j1]);
        if (!poles[(i + 1) % R]) tri(A[j], B[j1], B[j]); }
    }
    return fixSign(Float64Array.from(out));
  }
  // revolve a closed (r, z) profile around the z axis
  function lathe(prof, n, phase, map) {
    phase = phase || 0;
    const rings = prof.map(([r, z]) => { const ring = []; for (let j = 0; j < n; j++) { const t = phase + 2 * Math.PI * j / n; let p = [r * Math.cos(t), r * Math.sin(t), z]; if (map) p = map(p); ring.push(r === 0 ? [0, 0, z] : p); } return ring; });
    return loftLoop(rings);
  }
  function xform(p, f) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { const v = f(p[i], p[i + 1], p[i + 2]); q[i] = v[0]; q[i + 1] = v[1]; q[i + 2] = v[2]; } return q; }
  const moveP = (p, dx, dy, dz) => xform(p, (x, y, z) => [x + dx, y + dy, z + dz]);
  // proper rotations only, so the winding stays outward
  const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return xform(p, (x, y, z) => [x * c + z * s, y, -x * s + z * c]); };
  const rotX = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return xform(p, (x, y, z) => [x, y * c - z * s, y * s + z * c]); };
  const cat = list => T.concat(list.filter(m => m && m.length));
  // a profile sampler: points (r, h) for h in [h0, h1], step dh
  const sample = (f, h0, h1, dh) => { const pts = [], n = Math.max(2, Math.ceil((h1 - h0) / dh)); for (let i = 0; i <= n; i++) { const h = h0 + (h1 - h0) * i / n; pts.push([Math.max(0.3, f(h)), h]); } return pts; };
  // printable profile: walking in print order (up), the radius may grow by at most `slope` per mm
  function printable(pts, up) {
    const q = pts.map(p => p.slice());
    if (up) { for (let i = 1; i < q.length; i++) q[i][0] = Math.min(q[i][0], q[i - 1][0] + Math.abs(q[i][1] - q[i - 1][1]) * 0.98); }
    else { for (let i = q.length - 2; i >= 0; i--) q[i][0] = Math.min(q[i][0], q[i + 1][0] + Math.abs(q[i + 1][1] - q[i][1]) * 0.98); }
    return q;
  }
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ellR = (h, hc, a, b) => { const t = (h - hc) / b; return Math.abs(t) >= 1 ? 0 : a * Math.sqrt(1 - t * t); };

  // ---------------------------------------------------------------- hand stamp handle (use frame: h up from the block's back)
  // Prints knob down, so going down in use (up in print) the radius may only grow at 45\u00b0: printable(\u2026, false) walks
  // from the top. Returns the profile points from the collar (h = 0) to the top.
  function handProfile(style, k, Rcol, dh) {
    const col = 2.4 * k;
    if (style === 'grip') {
      const L = 62 * k, r0 = 9.2 * k, ribs = h => { if (h < 12 * k || h > L - 11 * k) return 0; const t = ((h - 12 * k) / (6.2 * k)) % 1; return 1.1 * k * Math.pow(Math.max(0, Math.cos(Math.PI * (t - 0.5))), 6); };
      const f = h => h <= col ? Rcol : Math.max(r0 + ribs(h) - 0.6 * k * Math.sin(Math.PI * clamp((h - col) / (L - col), 0, 1)), ellR(h, L - 9 * k, r0 + 0.6 * k, 9 * k) * (h > L - 9 * k ? 1 : 0));
      const raw = sample(h => h > L - 9 * k ? ellR(h, L - 9 * k, r0 + 0.3 * k, 9 * k) : f(h), 0, L, dh);
      return { pts: printable(raw, false), L, seg: 1 };
    }
    if (style === 'mushroom') {
      const L = 44 * k, hc = 0.7 * L, a = 17.5 * k, b = 0.3 * L, neck = h => 7.6 * k + 1.6 * k * smoothstep(0.2 * L, 0.48 * L, h);
      return { pts: printable(sample(h => h <= col ? Rcol : Math.max(neck(h) * (h < hc ? 1 : 0), ellR(h, hc, a, b)), 0, L, dh), false), L, seg: 1 };
    }
    if (style === 'gem') {
      const L = 52 * k, f = h => h <= col ? Rcol : h < 0.16 * L ? 7.2 * k : h < 0.8 * L ? 7.2 * k + (12.8 * k - 7.2 * k) * (h - 0.16 * L) / (0.64 * L) : 12.8 * k - (h - 0.8 * L) * 1.6;
      const raw = [[Rcol, 0], [Rcol, col], [7.2 * k, col + Math.max(0, Rcol - 7.2 * k)], [7.2 * k, Math.max(0.16 * L, col + Rcol - 7.2 * k + 0.5)], [12.8 * k, 0.8 * L], [6.4 * k, L]];
      void f; return { pts: raw, L, seg: 8, facet: true };
    }
    // turned knob
    const L = 50 * k, rn = 6.2 * k, hk = 0.78 * L, a = 12.2 * k, b = 0.25 * L;
    const neck = h => rn * (1 - 0.1 * Math.sin(Math.PI * clamp((h - col) / (0.58 * L - col), 0, 1))) + 1.2 * k * smoothstep(0.42 * L, 0.56 * L, h);
    return { pts: printable(sample(h => h <= col ? Rcol : Math.max(h < hk ? neck(h) : 0, ellR(h, hk, a, b)), 0, L, dh), false), L, seg: 1 };
  }
  function pegPoly(r, flat) { const pts = []; for (let i = 0; i < 64; i++) { const t = 2 * Math.PI * i / 64; pts.push([r * Math.cos(t), Math.min(r * Math.sin(t), r * flat)]); } return [P(pts)]; }

  function handParts(o, face, warnings) {
    const hd = o.detail === 'hd', n = hd ? 256 : 128, S = SPEC, T0 = o.plateT, d = o.depth, c = S.chamfer, custom = o.shape === 'custom';
    // block outline (print frame: mirrored), relief (mirrored, on top)
    const relief = mirrorX(openRelief(face.relief, o.minFeature, warnings));
    const minDim = custom ? Math.min(bb(face.outline).w, bb(face.outline).h) : Math.min(o.width, o.height);
    const k = clamp(minDim / 46, 0.62, 1.4), Rcol = Math.max(7, Math.min(15 * k, minDim / 2 - c - 2.6));
    const pocketD = Math.max(2.2, T0 - S.pocketEnd), pegR = Math.min(S.pegR * Math.min(1, k + 0.15), Rcol - 2.2), fit = o.fit;
    const block = [];
    const ringsAt = (inset, z) => (custom ? null : ringPts(o, inset, n).map(p => [-p[0], p[1], z]));
    const coreInset = c + 1.5;
    const core = custom ? mirrorX(face.outline) : mirrorX(ringPoly(o, coreInset, n));
    const pocket = o.onePiece ? [] : pegPoly(pegR + fit, S.pegFlat).map(Q => ({ outer: Q.outer, holes: [] }));
    // back of the block: a pocket for the handle's keyed peg and a small arrow pointing to the top of the design
    let arrow = [];
    if (!o.onePiece) { const y0 = Rcol + 1.6, avail = minDim / 2 - coreInset - 1.4 - y0; if (avail >= 3.2) { const s = Math.min(5.5, avail); arrow = [P([[0, y0 + s], [-s * 0.55, y0 + s * 0.42], [-s * 0.2, y0 + s * 0.42], [-s * 0.2, y0], [s * 0.2, y0], [s * 0.2, y0 + s * 0.42], [s * 0.55, y0 + s * 0.42]])]; } }
    const coreL = Dff(core, pocket);
    if (arrow.length) block.push(prism(Dff(coreL, arrow), 0, S.arrowDepth + OVER), prism(coreL, S.arrowDepth, pocketD + OVER));
    else block.push(prism(coreL, 0, pocketD + OVER));
    block.push(prism(core, pocketD, T0));
    if (!custom) { // chamfered rim band (lofted, so the chamfers are smooth)
      const inn = coreInset + 0.5;
      block.push(loftLoop([ringsAt(c, 0), ringsAt(0, c), ringsAt(0, T0 - c), ringsAt(c, T0), ringsAt(inn, T0), ringsAt(inn, 0)]));
    } else block.push(prism(Off(core, 0), 0, T0)); // custom outline: square edges
    // relief: optional tapered shoulder for strength, then the printing face
    const rel = [];
    if (relief.length) {
      if (o.shoulder && d > 1.1) { const sh = Math.min(0.5, d * 0.3); rel.push(prism(U(Off(relief, 0.32)), T0 - 0.3, T0 + sh + OVER), prism(relief, T0 + sh, T0 + d)); }
      else rel.push(prism(relief, T0 - 0.3, T0 + d));
    }
    const blockP = cat(block), reliefP = cat(rel);
    // handle in use frame (h up from the back of the block)
    const H = handProfile(o.handle, k, Rcol, hd ? 0.35 : 0.7), prof = [[0, 0]].concat(H.pts, [[0, H.pts[H.pts.length - 1][1]]]);
    const seg = H.seg === 8 ? 8 : (hd ? 192 : 96), phase = H.seg === 8 ? Math.PI / 8 : 0;
    let handleUse = lathe(prof, seg, phase);
    const pegL = pocketD - 0.35;
    if (!o.onePiece) handleUse = cat([handleUse, prism(pegPoly(pegR, S.pegFlat), -pegL, OVER * 4)]);
    const L = H.L;
    // print frames: handle knob down (rotate 180\u00b0 about y), block relief up
    const handlePrint = moveP(rotY(handleUse, Math.PI), 0, 0, L);
    const parts = [];
    const faceColor = o.colors.face, bodyColor = o.colors.body || o.colors.handle;
    let flare = null, zP = 0;
    if (o.onePiece) { // knob on the bed, a 45\u00b0 flare from the collar out to the block, block and face on top
      const Rmax = custom ? Math.max(...core[0].outer.map(p => Math.hypot(p[0], p[1]))) : Math.max(...ringPts(o, c, n).map(p => Math.hypot(p[0], p[1])));
      const fh = Math.max(1, Rmax - Rcol + 0.3); zP = L + fh;
      const top = custom ? null : ringPts(o, c, n).map(p => [-p[0], p[1]]);
      if (top) {
        const z0 = L - 0.4, z1 = zP + 0.3, ring0 = top.map(p => { const a = Math.atan2(p[1], p[0]); return [Rcol * Math.cos(a), Rcol * Math.sin(a), z0]; });
        flare = loftLoop([top.map(() => [0, 0, z0]), ring0, top.map(p => [p[0], p[1], z1]), top.map(() => [0, 0, z1])]);
      } else { // follow-the-design outline: stepped 45\u00b0 flare
        const L2 = []; for (let z = 0; z < fh; z += 0.3) L2.push(prism(I(Off([P(circle(0, 0, Rcol + z + 0.3, 96))], 0), core), L + z - 0.05, L + z + 0.32)); flare = cat(L2);
      }
      const one = cat([handlePrint, flare, moveP(blockP, 0, 0, zP)]);
      parts.push({ obj: 'stamp', role: 'handle', kind: 'handle', name: 'Stamp (one piece)', color: o.colors.handle, p: bodyColor === o.colors.handle ? one : cat([handlePrint, flare]) });
      if (bodyColor !== o.colors.handle) parts.push({ obj: 'stamp', role: 'body', kind: 'body', name: 'Stamp block', color: bodyColor, p: moveP(blockP, 0, 0, zP) });
      if (reliefP.length) parts.push({ obj: 'stamp', role: 'face', kind: 'face', name: 'Stamp face', color: faceColor, p: moveP(reliefP, 0, 0, zP) });
    } else {
      parts.push({ obj: 'block', role: 'body', kind: 'body', name: 'Stamp block', color: bodyColor, p: blockP });
      if (reliefP.length) parts.push({ obj: 'block', role: 'face', kind: 'face', name: 'Stamp face', color: faceColor, p: reliefP });
      parts.push({ obj: 'handle', role: 'handle', kind: 'handle', name: 'Handle', color: o.colors.handle, p: handlePrint });
    }
    // use frame: face down on the paper, handle up
    const top = T0 + d;
    const toUse = (q, obj) => obj === 'handle' ? moveP(handleUse, 0, 0, top) : moveP(rotY(moveP(q, 0, 0, -zP), Math.PI), 0, 0, top);
    for (const q of parts) q.use = o.onePiece ? moveP(rotY(q.p, Math.PI), 0, 0, zP + top) : toUse(q.p, q.obj);
    return { parts, info: { k, Rcol, pegR, pocketD, pegL, handleL: L, blockT: T0, height: top + L, flareH: o.onePiece ? zP - L : 0, minDim } };
  }

  // ---------------------------------------------------------------- roller parts
  // Wrap the band (u along the roll, v across) onto the wheel, axis along y, wheel center at the origin, touching the
  // paper at the bottom (\u03c6 = 0). At the contact patch +u runs along +x and +v along +y, so as the wheel rolls the
  // band is laid onto the paper exactly as composed: the read-frame design reads correctly, and the die is its mirror
  // when you look at the wheel from outside.
  function wrapBand(ps, C, Rout, Rc, h0, h1, du) {
    if (!ps.length) return new Float64Array(0);
    const N = Math.ceil(C / du), st = C / N, out = [], items = ps.map(Q => ({ Q, b: bb([Q]) }));
    for (let k = 0; k < N; k++) {
      const u0 = k * st, u1 = Math.min(C, (k + 1) * st + (k + 1 < N ? OVER : 0));
      const cand = items.filter(it => it.b.x1 >= u0 && it.b.x0 <= u1).map(it => it.Q); if (!cand.length) continue;
      const piece = I(cand, [rect(u0, -1e3, u1, 1e3)]); if (!piece.length) continue;
      const m = prism(piece, h0, h1);
      out.push(xform(m, (u, v, h) => { const phi = u / Rout, r = Rc + h; return [r * Math.sin(phi), v, -r * Math.cos(phi)]; }));
    }
    return fixSign(cat(out));
  }
  function rollerParts(o, band, warnings) {
    const hd = o.detail === 'hd', S = SPEC, { Rout, Rc, C, W } = rollerDims(o), seg = hd ? 288 : 144, fit = o.fit;
    let axle = o.axle;
    if (axle === 'bearing' && (W < 2 * S.bearingW + 2 || Rc < S.bearingOD / 2 + 2.4)) { warnings.push(`608 bearings need a wheel at least ${2 * S.bearingW + 2} mm wide and ${Math.ceil((S.bearingOD / 2 + 2.4 + o.depth) * 2)} mm across, so this one uses the printed axle pin.`); axle = 'pin'; }
    const wide = o.rollW > LIMITS.wideAxle, pinR = axle === 'bearing' ? S.bearingID / 2 : wide ? 4 : S.pinR; // a thicker printed pin for wide wheels
    // wheel core (axis y): chamfered outer edges, bore or bearing seats
    const hw = W / 2, ch = S.wheelChamfer;
    let prof;
    if (axle === 'bearing') { const sr = S.bearingOD / 2 + 0.03 + fit * 0.2, br = pinR + 1.1, bw = S.bearingW + 0.1;
      prof = [[sr, -hw], [Rc - ch, -hw], [Rc, -hw + ch], [Rc, hw - ch], [Rc - ch, hw], [sr, hw], [sr, hw - bw], [br, hw - bw], [br, -hw + bw], [sr, -hw + bw]]; }
    else { const br = pinR + fit + 0.12; prof = [[br, -hw], [Rc - ch, -hw], [Rc, -hw + ch], [Rc, hw - ch], [Rc - ch, hw], [br, hw]]; }
    const coreY = rotX(lathe(prof, seg), -Math.PI / 2);            // lathe axis z -> y
    const reliefPolys = openRelief(band.relief, o.minFeature, warnings);
    const du = hd ? 0.45 : 0.9, sh = o.shoulder && o.depth > 1.1 ? Math.min(0.45, o.depth * 0.28) : 0;
    const reliefY = sh ? cat([wrapBand(U(Off(reliefPolys, 0.3)).map(Q => Q).filter(Boolean), C, Rout, Rc, -S.embed, sh + OVER, du), wrapBand(reliefPolys, C, Rout, Rc, sh, o.depth, du)])
      : wrapBand(reliefPolys, C, Rout, Rc, -S.embed, o.depth, du);
    // handle + fork (print frame = use frame before posing: grip end on the bed, axis z)
    const ax = axle === 'bearing' ? 8.6 : 8, Ya = hw + S.armGap + S.armT, Lg = S.gripL;
    const G1 = rollerGrip(o.handle, Lg, hd);
    const rn = Math.min(G1.top, ax - 0.4), Ry = Math.hypot(Ya, ax) + 0.4, zc = Lg - 1.5, zyt = zc + (Ry - rn) + S.yokeT + Math.max(0, o.rollW - 60) * 0.04; // a deeper yoke bar for wide wheels
    const yoke = lathe([[0, zc], [rn, zc], [Ry, zc + (Ry - rn)], [Ry, zyt], [0, zyt]], hd ? 256 : 128, 0, p => [clamp(p[0], -ax, ax), clamp(p[1], -Ya, Ya), p[2]]);
    const za = zyt + S.yokeClear + Rout;                              // axle height
    const holeAt = (r, tear) => { const pts = []; for (let i = 0; i < 48; i++) { const t = 2 * Math.PI * i / 48; pts.push([r * Math.cos(t), za + r * Math.sin(t)]); }
      if (tear) { // 45\u00b0 teardrop point on top so the hole prints clean without supports
        const top = []; for (const p of pts) top.push(p); const tip = [0, za + r * Math.SQRT2]; let best = 0; for (let i = 0; i < pts.length; i++) if (pts[i][1] > pts[best][1]) best = i; top.splice(best, 1, tip); return U([P(top), P(pts)]); }
      return [P(pts)]; };
    const armXZ = U([rect(-ax, zyt - 1, ax, za), P(circle(0, za, ax, 64).map(p => p))]);
    const clr = pinR + fit + 0.05, press = pinR + fit - 0.2;
    const armPlus = Dff(armXZ, holeAt(clr, true)), armMinus = Dff(armXZ, holeAt(press, true));
    const extXZ = (ps, y0, y1) => fixSign(xform(T.extrude(ps.map(Q => ({ outer: Q.outer.map(p => [p[1], p[0]]), holes: Q.holes.map(h => h.map(p => [p[1], p[0]])) })), 1, y0, y1), (x, y, z) => [x, y, z]));
    const bossR = axle === 'bearing' ? 6.0 : pinR + 2.6;
    const boss = ys => Dff([P(circle(0, za, bossR, 48))], holeAt(ys > 0 ? clr : press, false));
    const fork = cat([
      extXZ(armPlus, hw + S.armGap, Ya), extXZ(armMinus, -Ya, -hw - S.armGap),
      extXZ(boss(1), hw + S.armGap - S.bossH, hw + S.armGap + OVER), extXZ(boss(-1), -hw - S.armGap - OVER, -hw - S.armGap + S.bossH)
    ]);
    const handleP = cat([G1.mesh, yoke, fork]);
    // axle pin: head on +y, shaft through both arms, flush with the outside of the -y arm
    const Ls = 2 * Ya, hr = axle === 'bearing' ? 6.4 : S.pinHeadR, ht = S.pinHeadT;
    const pinZ = lathe([[0, 0], [hr - 0.4, 0], [hr, 0.4], [hr, ht], [pinR, ht], [pinR, ht + Ls - 0.5], [pinR - 0.5, ht + Ls], [0, ht + Ls]], hd ? 96 : 48);
    // print frames
    const toPrintWheel = p => moveP(rotX(p, Math.PI / 2), 0, 0, hw);   // axis y -> z, lying on its side
    const wheelPrint = toPrintWheel(coreY), reliefPrint = toPrintWheel(reliefY);
    const bodyColor = o.colors.body || o.colors.handle;
    const parts = [
      { obj: 'wheel', role: 'body', kind: 'body', name: 'Roller wheel', color: bodyColor, p: wheelPrint },
      { obj: 'wheel', role: 'face', kind: 'face', name: 'Stamp face', color: o.colors.face, p: reliefPrint },
      { obj: 'handle', role: 'handle', kind: 'handle', name: 'Handle and fork', color: o.colors.handle, p: handleP },
      { obj: 'pin', role: 'pin', kind: 'pin', name: 'Axle pin', color: o.colors.handle, p: pinZ }
    ].filter(q => q.p.length);
    // use pose: wheel on the paper, handle raised 45\u00b0 behind it (toward +x)
    const Rup = Rout, alpha = -3 * Math.PI / 4;
    const handleUse = p => moveP(rotY(moveP(p, 0, 0, -za), alpha), 0, 0, Rup);
    for (const q of parts) {
      if (q.obj === 'wheel') q.use = moveP(q.role === 'face' ? reliefY : coreY, 0, 0, Rup);
      else if (q.obj === 'handle') q.use = handleUse(q.p);
      else q.use = handleUse(moveP(rotX(pinZ, Math.PI / 2), 0, Ya + ht, za)); // pin axis z -> -y, head just outside the +y arm
    }
    return { parts, info: { Rout, Rc, C, W, axle, pinR, za, Ya, ax, gripL: Lg, handleH: za + ax, holeClear: clr, holePress: press, wide, pinL: 2 * Ya + S.pinHeadT } };
  }
  // roller grips (print frame = use frame, butt end on the bed): going up, the radius may only grow at 45\u00b0
  function rollerGrip(style, L, hd) {
    const dh = hd ? 0.4 : 0.8, seg = hd ? 192 : 96, topR = 7.2;
    let f, faceted = false;
    if (style === 'ribbed') f = h => { const r = 10.6, rib = h > 8 && h < L - 22 ? 1.05 * Math.pow(Math.max(0, Math.cos(Math.PI * ((((h - 8) / 7) % 1) - 0.5))), 6) : 0; return Math.min(8.5 + h, (h > L - 22 ? r + (topR - r) * smoothstep(L - 22, L - 4, h) : r) + rib); };
    else if (style === 'bulb') f = h => Math.min(8 + h * 0.98, Math.max(ellR(h, 0.24 * L, 16.5, 0.24 * L + 2), 8.6 - 1.4 * smoothstep(0.5 * L, L, h)));
    else if (style === 'gem') { faceted = true; f = h => Math.min(9 + h, h < 0.34 * L ? 9.5 + (13 - 9.5) * h / (0.34 * L) : 13 - (13 - topR) * (h - 0.34 * L) / (0.66 * L)); }
    else f = h => { // contour: palm swell, then soft finger grooves toward the fork
      const swell = 10.4 + 2.4 * Math.exp(-(((h - 0.3 * L) / (0.2 * L)) ** 2)), grooves = h > 0.5 * L && h < 0.8 * L ? 0.75 * Math.pow(Math.sin(Math.PI * (h - 0.5 * L) / (0.075 * L)), 2) : 0;
      const neck = smoothstep(0.78 * L, L - 3, h); return Math.min(9 + h, (swell - grooves) * (1 - neck) + topR * neck); };
    let pts = faceted ? [[9, 0], [13, 0.34 * L], [topR, L]] : sample(f, 0, L, dh);
    if (!faceted) pts[pts.length - 1][0] = topR;
    pts = printable(pts, true);
    const prof = [[0, 0]].concat(pts, [[0, L]]);
    return { mesh: lathe(prof, faceted ? 8 : seg, faceted ? Math.PI / 8 : 0), top: pts[pts.length - 1][0], L };
  }

  // ---------------------------------------------------------------- build
  function build(raw) {
    const o = options(raw), warnings = [], dropped = new Set();
    const pat = o.content === 'pattern', sepLogo = o.type === 'roller' && o.separator === 'logo' && !pat;
    let logo = (o.content === 'text' || pat) && !sepLogo ? [] : logoPolys(o);
    if (((o.content !== 'text' && !pat) || sepLogo) && !logo.length) warnings.push('Upload a logo (PNG, JPG, WebP or SVG). A star stands in until you do.');
    if (sepLogo) o._sepLogo = logo;
    if (o.content === 'text' || pat) logo = [];
    if (o.content !== 'logo' && o.content !== 'pattern' && !o.text && !o.text2 && !o.text3) warnings.push('Type some text for the stamp.');
    let face, partsRes, impression, stats = {};
    if (o.type === 'hand') {
      const askW = num(raw && raw.width, o.width), askH = o.shape === 'round' || o.shape === 'square' ? askW : num(raw && raw.height, o.height);
      if (askW > o.width + 0.5 || askH > o.height + 0.5) warnings.push(`Made it ${Math.round(o.width)}${o.shape === 'round' || o.shape === 'square' ? '' : ` \u00d7 ${Math.round(o.height)}`} mm, the biggest that fits your build plate.`);
      face = composeHand(o, logo, warnings, dropped);
      partsRes = handParts(o, face, warnings);
      impression = { kind: 'hand', polys: openRelief(face.relief, o.minFeature, []), outline: face.outline };
      const b = bb(face.outline); stats.size = [b.x1 - b.x0, b.y1 - b.y0]; stats.height = partsRes.info.height;
    } else {
      face = composeRoller(o, logo, warnings, dropped);
      partsRes = rollerParts(o, face, warnings);
      impression = { kind: 'roller', polys: openRelief(face.relief, o.minFeature, []), C: face.C, W: face.W };
      stats.size = [o.diameter, o.rollW]; stats.height = partsRes.info.handleH; stats.repeats = face.repeats; stats.circumference = face.C;
    }
    // letter height: how big the smallest line of text came out after fitting it to the face
    stats.letterH = o.content !== 'logo' && o.content !== 'pattern' && o._cap && isFinite(o._cap) ? +o._cap.toFixed(2) : null;
    stats.lines = o._lines ? o._lines.length : [o.text, o.text2, o.text3].filter(Boolean).length;
    stats.pattern = o.content === 'pattern' ? o.pattern : null; stats.use = o.use;
    stats.autoLines = o._lines || null;
    if (stats.letterH && stats.letterH < Math.max(LIMITS.smallText, o.minFeature * 4)) warnings.push(`The letters are only ${stats.letterH.toFixed(1)} mm tall, so thin strokes may not print or ink cleanly. Use ${o.type === 'roller' ? 'a wider or bigger wheel, a thinner border' : 'a bigger stamp'}, shorter text or fewer lines.`);
    if (dropped.plain && dropped.plain.size) warnings.push(`Drew ${[...dropped.plain].map(c => `"${c}"`).join(', ')} without the accent: this font doesn't have ${dropped.plain.size > 1 ? 'those letters' : 'that letter'}.`);
    if (dropped.size) warnings.push(`Left out ${[...dropped].map(c => `"${c}"`).join(', ')}: this font doesn't have ${dropped.size > 1 ? 'those characters' : 'that character'}.`);
    const parts = partsRes.parts;
    // print layout: one row of objects, each on the bed (z = 0); more plates if needed
    const objs = [...new Set(parts.map(q => q.obj))].map(id => { const ps = parts.filter(q => q.obj === id), b = Core.bbox(T.concat(ps.map(q => q.p))); return { id, b, w: b.max[0] - b.min[0], d: b.max[1] - b.min[1], h: b.max[2] - b.min[2] }; });
    const g = o.gap, W = o.bed[0] - 2 * g, D = o.bed[1] - 2 * g; let x = 0, y = 0, rowD = 0, plate = 0; const at = new Map();
    for (const it of objs) { if (x > 0 && x + it.w > W) { x = 0; y += rowD + g; rowD = 0; } if (y > 0 && y + it.d > D) { plate++; x = 0; y = 0; rowD = 0; } at.set(it.id, { x: g + x, y: o.bed[1] - g - y - it.d, plate }); x += it.w + g; rowD = Math.max(rowD, it.d); }
    const big = objs.filter(it => it.w > W || it.d > D), tall = objs.filter(it => it.h > o.bedZ);
    if (big.length) warnings.push(`${big.map(it => parts.find(q => q.obj === it.id).name).join(', ')} ${big.length > 1 ? 'are' : 'is'} bigger than your build plate.`);
    if (tall.length) warnings.push(`${tall.map(it => parts.find(q => q.obj === it.id).name).join(', ')} ${tall.length > 1 ? 'are' : 'is'} taller than your printer.`);
    const placed = parts.map(q => { const it = objs.find(z => z.id === q.obj), a = at.get(q.obj); return { ...q, plate: a.plate, p: moveP(q.p, a.x - it.b.min[0], a.y - it.b.min[1], -it.b.min[2]) }; });
    const plates = Math.max(0, ...placed.map(q => q.plate)) + 1;
    const colors = []; for (const q of parts) if (!colors.includes(q.color)) colors.push(q.color);
    Object.assign(stats, { type: o.type, content: o.content, layout: o.layout, font: o.font, handle: o.handle, axle: partsRes.info.axle || null, depth: o.depth, colors: colors.length, plates, parts: parts.length, tris: parts.reduce((s, q) => s + q.p.length / 9, 0), info: partsRes.info, onePiece: o.type === 'hand' && o.onePiece });
    return { options: o, parts: placed, raw: parts, impression, face, plates, colors, stats, warnings };
  }

  function filaments(res) {
    const roller = res.options.type === 'roller';
    const label = q => {
      const n = ({ body: roller ? 'wheel' : 'block', face: 'stamp face', handle: 'handle', pin: 'axle pin' }[q.role] || q.role);
      if (roller && (q.role === 'body' || q.role === 'face')) return n + ' (TPU)';
      if (roller && (q.role === 'handle' || q.role === 'pin')) return n + ' (PLA/PETG)';
      return n;
    };
    return res.colors.map(c => ({ color: c, role: res.raw.filter(q => q.color === c).map(label).filter((v, i, a) => a.indexOf(v) === i).join(' + ') }));
  }

  // paper and ink for the preview (not exported)
  function paperScene(res) {
    const o = res.options, im = res.impression, out = [];
    if (o.type === 'roller') {
      const C = im.C, Wb = im.W, Lt = Math.min(C * 1.6, 190), ink = [];
      for (let k = 1; k <= 3; k++) ink.push(...move(im.polys, -C * k, 0));
      const trail = I(U(ink), [rect(-Lt, -Wb, 0, Wb)]);
      const x0 = -Lt - 14, x1 = 70, y0 = -Wb / 2 - 26, y1 = Wb / 2 + 26;
      out.push({ name: 'Paper', kind: 'paper', color: '#FBFAF6', p: prism([rect(x0, y0, x1, y1)], -0.6, 0) });
      if (trail.length) out.push({ name: 'Impression', kind: 'ink', color: o.ink, p: prism(trail, 0, 0.05) });
      return out;
    }
    const b = bb(im.outline), w = b.x1 - b.x0, h = b.y1 - b.y0, off = -(w / 2 + 10);
    out.push({ name: 'Paper', kind: 'paper', color: '#FBFAF6', p: prism([rect(off - w / 2 - 14, -h / 2 - 16, w / 2 + 22 - off * 0 + w * 0.6, h / 2 + 16)], -0.6, 0) });
    if (im.polys.length) out.push({ name: 'Impression', kind: 'ink', color: o.ink, p: prism(move(im.polys, off - (b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2), 0, 0.05) });
    return out;
  }
  // view: 'use' (in use on paper with its impression) or 'print' (as laid out on the build plate)
  function scene(res, view) {
    if (view === 'print') {
      const out = []; let x = 0;
      for (let k = 0; k < res.plates; k++) { const ps = res.parts.filter(q => (q.plate || 0) === k); if (!ps.length) continue; const b = Core.bbox(T.concat(ps.map(q => q.p)));
        for (const q of ps) out.push({ name: q.name, kind: q.kind, color: q.color, p: Float32Array.from(moveP(q.p, x - b.min[0], -b.min[1], 0)), local: true }); x += b.max[0] - b.min[0] + 15; }
      return out;
    }
    const o = res.options, out = [];
    let dx = 0, dz = 0;
    if (o.type === 'hand') { const b = bb(res.impression.outline), w = b.x1 - b.x0; dx = w / 2 + 10; dz = 7; }
    for (const q of res.raw) out.push({ name: q.name, kind: q.kind, color: q.color, p: Float32Array.from(moveP(q.use, dx, 0, dz)) });
    for (const q of paperScene(res)) out.push({ ...q, p: Float32Array.from(q.p), preview: true });
    return out;
  }
  // flat impression outlines for the 2D preview: [[x, y], ...] loops (outer first, then holes) in read frame
  function impression2D(res) {
    const im = res.impression, loops = ps => ps.map(Q => [Q.outer, ...Q.holes]);
    return im.kind === 'roller' ? { kind: 'roller', C: im.C, W: im.W, polys: loops(im.polys) } : { kind: 'hand', outline: loops(im.outline), polys: loops(im.polys) };
  }

  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  const OBJ_NAMES = { wheel: 'Roller wheel \u2014 print in TPU', handle: 'Handle', pin: 'Axle pin \u2014 print in PLA or PETG', block: 'Stamp block', stamp: 'Stamp' };
  const EXPORT_PART_NAMES = {
    'Roller wheel': 'Roller wheel \u2014 print in TPU',
    'Stamp face': 'Stamp face \u2014 print in TPU',
    'Handle and fork': 'Handle and fork \u2014 print in PLA or PETG',
    'Axle pin': 'Axle pin \u2014 print in PLA or PETG'
  };
  function export3MF(res, opt) {
    opt = opt || {}; const bed = res.options.bed, n = res.plates, cols = res.colors, objects = [], plates = Array.from({ length: n }, () => []);
    const partName = q => res.options.type === 'roller' ? (EXPORT_PART_NAMES[q.name] || q.name) : q.name;
    for (const id of [...new Set(res.parts.map(q => q.obj))]) {
      const ps = res.parts.filter(q => q.obj === id), org = T.bambuPlateOrigin(ps[0].plate, n, bed[0], bed[1]);
      plates[ps[0].plate].push(objects.length);
      const mk = q => ({ name: partName(q), p: moveP(q.p, org[0], org[1], 0), color: q.color, extruder: cols.indexOf(q.color) + 1 });
      const nm = id === 'handle' && res.options.type === 'roller' ? 'Handle and fork \u2014 print in PLA or PETG' : OBJ_NAMES[id] || id;
      if (ps.length > 1) objects.push({ name: nm, parts: ps.map(mk) }); else objects.push({ ...mk(ps[0]), name: nm });
    }
    return T.threeMF(objects, { title: opt.name || (res.options.type === 'roller' ? 'Custom roller stamp' : 'Custom stamp'), plates, bambu: opt.bambu === undefined ? res.options.bambu : opt.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function readme(res, name) {
    const o = res.options, s = res.stats, f = v => (Math.round(v * 100) / 100).toString(), info = s.info, roller = o.type === 'roller';
    const txt = [o.text, o.text2, o.text3].filter(Boolean).join(' / ');
    const what = o.content === 'logo' ? 'logo' : o.content === 'pattern' ? `${PATTERNS[o.pattern].toLowerCase()} pattern (${f(o.patternSize)} mm cells)` : o.content === 'both' ? `"${txt}" with a logo` : `"${txt}"`;
    const L = [`Expressarte ${roller ? 'roller stamp' : 'hand stamp'}: ${name}`, ''];
    if (roller) L.push(`${what} \u00b7 ${f(o.diameter)} mm wheel, ${f(o.rollW)} mm wide \u00b7 ${s.repeats} cop${s.repeats === 1 ? 'y' : 'ies'} per turn (${f(info.C)} mm) \u00b7 ${ROLLER_HANDLES[o.handle].label} handle \u00b7 ${AXLES[info.axle]}`);
    else L.push(`${what} \u00b7 ${SHAPES[o.shape]} ${o.shape === 'custom' ? '' : `${f(o.width)}${o.shape === 'round' || o.shape === 'square' ? '' : ` \u00d7 ${f(o.height)}`} mm `}\u00b7 ${HAND_HANDLES[o.handle].label} handle${o.onePiece ? ' \u00b7 one piece' : ''}`);
    L.push(`Relief depth ${f(o.depth)} mm \u00b7 minimum feature ${f(o.minFeature)} mm \u00b7 the face is mirrored so the stamp prints the right way round.`, `Made for: ${USES[o.use].label}`);
    L.push('', 'Filament slots in the 3MF'); filaments(res).forEach((x, i) => L.push(`  ${i + 1}: ${x.color}  ${x.role}`));
    L.push('', 'Printing');
    if (roller) {
      L.push('  - Wheel (the textured stamp part): print in TPU, a flexible filament such as 95A. Lies on its side as laid out. 0.12 to 0.16 mm layers give the crispest letters. Slow down (20 to 30 mm/s). No supports.',
        '  - Handle: print in PLA or PETG. Stands on the end of the grip. The yoke has a 45\u00b0 underside and the axle holes have a teardrop top, so it prints without supports. 3 walls, 15% infill.',
        `  - Axle pin: print in PLA or PETG. Stands on its head. 100% infill or 4+ walls so it stays stiff.${info.wide ? ` This wide wheel gets a thicker ${f(info.pinR * 2)} mm pin; an ${f(info.pinR * 2)} mm steel rod or bolt about ${Math.ceil(info.pinL)} mm long also fits and is stiffer.` : ''}`);
      L.push('', 'Putting it together', info.axle === 'bearing' ? '  1. Press a 608 skate bearing (8 \u00d7 22 \u00d7 7 mm) into each side of the wheel.' : '  1. The wheel spins on the pin; no bearings needed.',
        `  2. Set the wheel between the fork arms and push the pin in from the side with the larger hole (${f(info.holeClear * 2)} mm) until it bottoms in the tight hole (${f(info.holePress * 2)} mm). A drop of glue in the tight hole makes it permanent; an M${Math.round(info.pinR * 2)} bolt and nut also fits.`,
        '  3. Roll the wheel across a stamp pad, then roll it over paper, cardboard or fabric with even pressure.');
    } else {
      L.push('  - Stamp block: face up as laid out, so the letters print as the last, sharpest layers. 0.12 to 0.16 mm layers. No supports.',
        o.onePiece ? '  - One piece: prints knob down; the 45\u00b0 flare under the block needs no supports.' : '  - Handle: prints knob down with the keyed peg up. No supports.');
      if (!o.onePiece) L.push('', 'Putting it together', `  Push the handle's peg into the pocket in the back of the block. The flat on the peg lines the handle up with the design, and the arrow on the back points to the top of the impression. Fit tolerance ${f(o.fit)} mm; a drop of glue makes it permanent.`);
    }
    L.push('', 'Inking', roller
      ? '  Use a water-based stamp pad or acrylic paint on a foam roller. The TPU wheel inks cleanly; wash the face with warm water after use.'
      : '  Use a water-based stamp pad or acrylic paint on a foam roller. For crisp prints, sand the face lightly flat or print the face in TPU. Wash the face with warm water after use.');
    const tip = USE_TIPS[o.use]; if (tip) L.push('', USES[o.use].label, '  ' + tip);
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, opt) {
    opt = opt || {}; const name = opt.name || (res.options.type === 'roller' ? 'Custom roller stamp' : 'Custom stamp'), base = safe(opt.fileBase || name.toLowerCase()) || 'custom_stamp';
    const list = [{ name: `${base}.3mf`, data: export3MF(res, opt) }], seen = new Set();
    for (const q of res.raw) { let nm = safe(q.name.toLowerCase()); while (seen.has(nm)) nm += '_'; seen.add(nm); list.push({ name: `stl/${nm}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }); }
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }
  function proNeeds(res) {
    const o = res.options, HS = o.type === 'roller' ? ROLLER_HANDLES : HAND_HANDLES;
    return { tool: 'stamp', type: o.type, colors: res.colors.length, font: o.font, fontLabel: FONTS[o.font].label, extraFont: o.content !== 'logo' && FONTS[o.font].pro, handle: o.handle, handleLabel: HS[o.handle].label, proHandle: HS[o.handle].pro };
  }

  const api = { TYPES, CONTENT, PATTERNS, USES, USE_TIPS, patternPolys, WRAPS, lineSets, bestLines, FONTS, SHAPES, LAYOUTS, BORDERS, ORNAMENTS, HAND_HANDLES, ROLLER_HANDLES, AXLES, PALETTE, INKS, LIMITS, SPEC, DEFAULTS,
    options, build, scene, impression2D, filaments, export3MF, files, readme, proNeeds, textLine, textBlock, arcText, glyph, supported, composeHand, composeRoller, rollerDims, handProfile, rollerGrip, lathe, loftLoop, wrapBand, parsePath };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPStamp = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
