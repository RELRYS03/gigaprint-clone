/* Expressarte lighter case generator: a snug sleeve for a pocket lighter with raised lettering, a logo, a surface
   pattern on the back and an optional clip, keyring or carabiner loop. One object, printed upright with no supports;
   each color (case, letters, logo, pattern) is its own part on its own filament in the 3MF.

   Lighter sizes (mm, height \u00d7 width \u00d7 depth) come from published figures; the brand names are used only to say
   which lighters each size fits (Expressarte isn't affiliated with these brands):
   - Standard disposable 81.7 \u00d7 25.2 \u00d7 14.4: BIC J6 Maxi, Hong Kong EMSD filing LD221LA (BIC's catalog lists the
     child-resistant J26 as 82 \u00d7 25 \u00d7 15). Fits BIC Classic (J6, J26).
   - Mini disposable 61.9 \u00d7 21.7 \u00d7 10.8: BIC J5 Mini, EMSD LD220LA (BIC Japan lists the J25 as 61 \u00d7 21 \u00d7 11).
   - Slim disposable 75.9 \u00d7 21.7 \u00d7 10.8: BIC J3 Slim, EMSD LD219LA (BIC Japan lists the J23 as 75 \u00d7 21 \u00d7 11).
   - Gas-station disposable 80 \u00d7 25 \u00d7 12: BIC J38 Electronic is 79 \u00d7 25 \u00d7 12 (EMSD LD222LA); fits it and similar
     flat gas-station lighters.
   - Flat disposable 80.6 \u00d7 23 \u00d7 10.25: Cricket ED4 Electronic, EMSD LD216JA; the Cricket Original (ED1) is
     78.96 \u00d7 22.5 \u00d7 10 (EMSD LD214JA), so both fit.
   - Refillable flat-top: Clipper publishes 74 mm tall, 16 mm thick (Large CP11) and 63 \u00d7 14 (Micro CP22). The body is
     a round barrel that flares on one side toward the top (about 0.104 mm per mm, measured from two published sleeve
     models): about 16.4 wide at the bottom and 22.5 at the top of the body for the Large. The case pocket follows the
     flare in 3 mm steps. The Micro is the same shape about 0.86\u00d7 smaller.
   Every size can be nudged with the fit setting or replaced by your own measurements.

   Lettering rule (the reason this file exists): every letter and logo sits inside the flat front face of the case,
   inset by a safe margin, for every lighter, case shape, font and text length. Text shrinks, wraps or (as a last
   resort, with a warning) is shortened; it never runs past the face, round a corner or off the case. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PZ = Core.PASTELS;

  const LIGHTERS = {
    standard: { label: 'Standard disposable', fits: 'BIC Classic (J6, J26)', H: 81.7, W: 25.2, D: 14.4, sect: 'oval', n: 2.4, head: 19, top: 'hood', color: '#D8433A' },
    mini: { label: 'Mini disposable', fits: 'BIC Mini (J5, J25)', H: 61.9, W: 21.7, D: 10.8, sect: 'oval', n: 2.4, head: 16, top: 'hood', color: '#3C78C8' },
    slim: { label: 'Slim disposable', fits: 'BIC Slim (J23, J3)', H: 75.9, W: 21.7, D: 10.8, sect: 'oval', n: 2.4, head: 18, top: 'hood', color: '#2E9E6A' },
    station: { label: 'Gas-station disposable', fits: 'BIC Electronic (J38) and similar flat gas-station lighters', H: 80, W: 25, D: 12, sect: 'rrect', r: 3.2, head: 19, top: 'hood', color: '#E0A020' },
    flat: { label: 'Flat disposable', fits: 'Cricket Original and Cricket Electronic', H: 80.6, W: 23, D: 10.25, sect: 'rrect', r: 3.0, head: 18, top: 'hood', color: '#2F8FCF' },
    refill: { label: 'Refillable flat-top (large)', fits: 'Clipper Large (CP11)', H: 74, D: 16.4, sect: 'barrel', taper: 0.104, nose: 4.6, head: 15, top: 'flat', color: '#8A4FC0' },
    refillsmall: { label: 'Refillable flat-top (mini)', fits: 'Clipper Micro / Mini (CP22)', H: 63, D: 14.1, sect: 'barrel', taper: 0.104, nose: 4.0, head: 13, top: 'flat', color: '#E05A8A' },
    custom: { label: 'Custom size', fits: '', H: 80, W: 25, D: 14, sect: 'rrect', r: 4, head: 18, top: 'hood', color: '#7A7F87' }
  };
  // a barrel lighter (round body flaring on one side toward the top): the width at the top of the body
  for (const k in LIGHTERS) { const L = LIGHTERS[k]; if (L.sect === 'barrel') L.W = +(L.D + L.taper * (L.H - L.head)).toFixed(1); }
  const SHAPES = {
    rounded: { label: 'Rounded', wall: 2.0 }, slim: { label: 'Slim', wall: 1.5 }, chunky: { label: 'Chunky', wall: 3.2 },
    hex: { label: 'Hex', wall: 2.0 }, faceted: { label: 'Faceted', wall: 2.0 }, ribbed: { label: 'Ribbed', wall: 2.0 }, pill: { label: 'Pill', wall: 2.0 }
  };
  const LAYOUTS = { stacked: 'Stacked letters', along: 'Along the case', across: 'Across', none: 'No lettering' };
  const DESIGNS = { name: 'Name', logo: 'Logo', both: 'Logo and name' };
  const FONTS = { chunky: { label: 'Bold', pro: false }, round: { label: 'Round', pro: false }, soft: { label: 'Soft', pro: true }, wide: { label: 'Wide', pro: true }, balloon: { label: 'Balloon', pro: true } };
  const PATTERNS = { none: 'None', dots: 'Dots', diamonds: 'Diamonds', chevrons: 'Chevrons', waves: 'Waves', ribs: 'Ribs' };
  const ATTACH = { none: 'Simple case', clip: 'Pocket clip', keyring: 'Keychain ring', carabiner: 'Carabiner loop' };
  const FITS = { snug: 0.2, standard: 0.3, loose: 0.45 };
  const PALETTE = [
    { name: 'Pink', hex: PZ.pink }, { name: 'Mint', hex: PZ.mint }, { name: 'Baby blue', hex: PZ.babyBlue }, { name: 'Lavender', hex: PZ.lavender },
    { name: 'Butter', hex: PZ.butter }, { name: 'Peach', hex: PZ.peach }, { name: 'Sage', hex: PZ.sage }, { name: 'Cream', hex: PZ.cream },
    { name: 'White', hex: '#F7F7F2' }, { name: 'Ink', hex: PZ.ink }, { name: 'Red', hex: '#C8102E' }, { name: 'Sky blue', hex: '#4A90D9' }
  ];
  // the face rule: letters stay this far inside the flat front (mm), never smaller than MIN_LETTER
  const FIT = { side: 1.2, end: 2.0, minLetter: 3.5, maxChars: 16 };
  const LIMITS = { freeColors: 2, freeFonts: Object.keys(FONTS).filter(k => !FONTS[k].pro), maxChars: FIT.maxChars };
  const DEFAULTS = {
    lighter: 'standard', shape: 'rounded', fit: 'standard', fitMM: null, custom: { H: 80, W: 25, D: 14 }, head: 0,
    design: 'name', layout: 'stacked', text: 'CLARK', font: 'chunky', caps: true, maxLetter: 24, relief: 1.0,
    image: null, imageName: '', logoSize: 100,
    pattern: 'none', attach: 'none', window: false, hole: true, fitRing: false,
    colors: { body: PZ.lavender, letters: PZ.ink, logo: PZ.pink, pattern: '' },
    bed: [256, 256], bambu: 'A1'
  };
  const SPEC = { floor: 1.6, holeR: 3.5, embed: 0.4, patRelief: 0.6, patEmbed: 0.3, clipW: 9, clipT: 1.8, clipGap: 1.4, clipBridge: 6,
    keyring: { R: 5.6, r: 2.6, h: 4 }, carabiner: { R: 8.6, r: 5.6, h: 5 }, lead: 0.6 };

  const hex6 = v => /^#[0-9a-f]{6}$/i.test(v || '');
  function options(raw) {
    raw = raw || {};
    const o = { ...DEFAULTS, ...raw };
    o.colors = { ...DEFAULTS.colors, ...(raw.colors || {}) };
    for (const k of ['body', 'letters', 'logo']) o.colors[k] = hex6(o.colors[k]) ? o.colors[k].toUpperCase() : DEFAULTS.colors[k];
    o.colors.pattern = hex6(o.colors.pattern) ? o.colors.pattern.toUpperCase() : '';
    if (!LIGHTERS[o.lighter]) o.lighter = 'standard';
    if (!SHAPES[o.shape]) o.shape = 'rounded';
    if (!LAYOUTS[o.layout]) o.layout = 'stacked';
    if (!DESIGNS[o.design]) o.design = 'name';
    if (!FONTS[o.font] || !Bubble.FONTS[o.font]) o.font = 'chunky';
    if (!PATTERNS[o.pattern]) o.pattern = 'none';
    if (!ATTACH[o.attach]) o.attach = 'none';
    o.fit = FITS[o.fit] != null ? o.fit : 'standard';
    o.fitMM = Number.isFinite(+raw.fitMM) && raw.fitMM !== null && raw.fitMM !== '' ? clamp(+raw.fitMM, 0, 1) : FITS[o.fit];
    const c = raw.custom || {};
    o.custom = { H: clamp(+c.H || 80, 40, 120), W: clamp(+c.W || 25, 12, 45), D: clamp(+c.D || 14, 7, 30) };
    o.text = String(o.text == null ? '' : o.text).replace(/\s+/g, ' ').trim();
    o.caps = o.caps !== false;
    o.maxLetter = clamp(+o.maxLetter || 24, 5, 40);
    o.relief = clamp(+o.relief || 1, 0.6, 2);
    o.logoSize = clamp(+o.logoSize || 100, 30, 100);
    o.image = Array.isArray(raw.image) ? raw.image : null;
    o.imageName = String(raw.imageName || '').slice(0, 80);
    o.window = !!o.window; o.hole = o.hole !== false; o.fitRing = !!o.fitRing;
    o.head = Number.isFinite(+raw.head) ? +raw.head : 0;
    o.bed = [clamp(+(o.bed && o.bed[0]) || 256, 100, 1000), clamp(+(o.bed && o.bed[1]) || 256, 100, 1000)];
    return o;
  }
  function lighterOf(o) {
    const L = { ...LIGHTERS[o.lighter] };
    if (o.lighter === 'custom') Object.assign(L, o.custom, { head: clamp(Math.round(o.custom.H * 0.23), 12, 26) });
    return L;
  }

  // ---------------------------------------------------------------- 2D helpers
  const P = L => ({ outer: L, holes: [] });
  const U = ps => T.unionPolys(ps), Dff = (a, b) => b && b.length ? T.diffPolys(a, b) : a, I = (a, b) => T.interPolys(a, b), Off = (ps, d) => T.offset(ps, d);
  const bb = ps => T.polysBBox(ps);
  const map = (ps, f) => ps.map(Q => ({ outer: Q.outer.map(f), holes: Q.holes.map(h => h.map(f)) }));
  const move = (ps, dx, dy) => map(ps, p => [p[0] + dx, p[1] + dy]);
  const scaleAbout = (ps, k, cx, cy) => map(ps, p => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
  const rect = (x0, y0, x1, y1) => P([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const circle = (cx, cy, r, n) => T.circle(cx, cy, r, n || Math.max(48, Math.ceil(r * 14)));
  const area = ps => T.polysArea(ps);
  // the lighter's own cross-section (centered, x = width, y = depth), finely sampled so the fit is smooth
  // h = height above the lighter's bottom (barrel lighters flare toward the top); no h = the widest (top) section
  function section(L, grow, h) {
    const a = L.W / 2 + grow, b = L.D / 2 + grow;
    if (L.sect === 'barrel') return [P(barrel(L, grow, h))];
    if (L.sect === 'oval') {
      const n = L.n || 2.4, pts = [];
      for (let i = 0; i < 160; i++) { const t = i / 160 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); pts.push([a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]); }
      return [P(pts)];
    }
    return [P(T.roundRect(-a, -b, a, b, Math.min((L.r || 3) + grow, b - 0.01), 24))];
  }
  // round barrel (radius D/2) plus a nose circle sliding out to -x as it rises; the convex hull of the two. Centered so
  // the top section is symmetric about x = 0.
  function barrel(L, grow, h) {
    const bodyH = L.H - L.head, eMax = L.taper * bodyH, e = h == null ? eMax : clamp(L.taper * h, 0, eMax);
    const R = L.D / 2 + grow, r = Math.min(L.nose + grow, R), cx = eMax / 2, nx = cx - R + r - e, pts = [];
    for (let i = 0; i < 120; i++) { const t = i / 120 * Math.PI * 2; pts.push([cx + R * Math.cos(t), R * Math.sin(t)]); pts.push([nx + r * Math.cos(t), r * Math.sin(t)]); }
    return hull(pts);
  }
  function hull(pts) {
    pts = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-12) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // the outside of the case; both wide sides are flat across 2 \u00d7 flatHalf. The lettered face is the y-min side (it faces
  // the viewer in the Front camera); the pattern, clip and fuel window go on the y-max side.
  function outline(shape, A, B) {
    if (shape === 'faceted') { const c = Math.min(B * 0.55, 4); return { polys: [P([[-A + c, -B], [A - c, -B], [A, -B + c], [A, B - c], [A - c, B], [-A + c, B], [-A, B - c], [-A, -B + c]])], flatHalf: A - c }; }
    if (shape === 'hex') { const c = B * 0.8, A2 = A + c * 0.35; return { polys: [P([[-A2, 0], [-A2 + c, -B], [A2 - c, -B], [A2, 0], [A2 - c, B], [-A2 + c, B]])], flatHalf: A2 - c }; }
    // a pill keeps at least an 11 mm flat face (deep, near-round cases such as the barrel lighters would leave almost none)
    const r = shape === 'pill' ? Math.max(0.5, Math.min(B - 0.02, A - 5.5)) : shape === 'slim' ? Math.min(B - 0.4, 3.2) : shape === 'chunky' ? Math.min(B - 0.6, 6) : Math.min(B - 0.6, 4.5);
    let polys = [P(T.roundRect(-A, -B, A, B, r, 24))];
    if (shape === 'ribbed') { // vertical ribs round the two ends only, never on the front or back face
      const rr = 0.85, ribs = [], side = B - r;
      for (let y = -side; y <= side + 1e-6; y += Math.max(2.2, side)) for (const s of [-1, 1]) ribs.push(P(circle(s * A, y, rr, 28)));
      for (const s of [-1, 1]) for (const t of [-1, 1]) { const ang = Math.PI / 4; ribs.push(P(circle(s * (A - r + r * Math.cos(ang)), t * (side + r * Math.sin(ang)), rr, 28))); }
      polys = U(polys.concat(ribs));
    }
    return { polys, flatHalf: A - r };
  }
  function caseShape(L, o) {
    const cav = section(L, o.fitMM), cb = bb(cav), wall = SHAPES[o.shape].wall;
    let A = cb.x1 + wall, B = cb.y1 + wall, sh = outline(o.shape, A, B);
    // grow until the wall is at least 90% of its nominal thickness all the way round
    const need = Off(cav, wall * 0.9);
    for (let k = 0; k < 60 && area(Dff(need, sh.polys)) > 0.01; k++) { A += 0.2; if (k % 3 === 2) B += 0.1; sh = outline(o.shape, A, B); }
    const ob = bb(sh.polys);
    return { cav, outer: sh.polys, flatHalf: sh.flatHalf, front: ob.y1, back: ob.y0, A: ob.x1, B: ob.y1, wall, L, fit: o.fitMM };
  }

  // ---------------------------------------------------------------- lettering (always inside the face box)
  const GC = new Map();
  function glyph(font, ch, h) {
    const k = font + '|' + ch + '|' + h.toFixed(4); if (GC.has(k)) return GC.get(k);
    const g = Bubble.glyphPolys(font, ch, h), v = g && g.polys.length ? g.polys : null; if (GC.size > 4000) GC.clear(); GC.set(k, v); return v;
  }
  function cleanText(text, font, caps) {
    const missing = new Set(); let s = '';
    for (let ch of [...String(text || '')]) {
      if (caps) ch = ch.toUpperCase();
      if (/\s/.test(ch)) { if (s && !/ $/.test(s)) s += ' '; continue; }
      if (!Bubble.supported(font, ch)) { missing.add(ch); continue; }
      s += ch;
    }
    s = s.trim(); const letters = [...s].filter(c => c !== ' ');
    let t = s;
    if (letters.length > FIT.maxChars) { // past the limit: keep whole words when that keeps at least half the letters
      t = cutChars(s, FIT.maxChars); const nxt = s.slice(t.length, t.length + 1), sp = t.lastIndexOf(' ');
      if (nxt && nxt !== ' ' && sp > 0 && [...t.slice(0, sp)].filter(c => c !== ' ').length >= FIT.maxChars / 2) t = t.slice(0, sp);
      t = t.trim();
    }
    return { text: t, missing: [...missing], over: letters.length > FIT.maxChars };
  }
  function cutChars(s, n) { let k = 0, out = ''; for (const ch of [...s]) { if (ch !== ' ') { if (k >= n) break; k++; } out += ch; } return out.trim(); }
  // one line, baseline y 0, starting at x 0
  function line(str, font, h) {
    const out = []; let x = 0;
    for (const ch of [...str]) {
      if (ch === ' ') { x += h * 0.34; continue; }
      const g = glyph(font, ch, h); if (!g) continue; const b = bb(g);
      out.push(...move(g, x - b.x0, 0)); x += (b.x1 - b.x0) + h * 0.06;
    }
    return out;
  }
  // lines stacked downward, each centered on x 0
  function lines(rows, font, h) {
    const out = []; let y = 0;
    rows.forEach((r, i) => {
      const ps = line(r, font, h); if (!ps.length) return; const b = bb(ps);
      if (i) y -= h * 0.28;
      out.push(...move(ps, -(b.x0 + b.x1) / 2, y - b.y1)); y -= (b.y1 - b.y0);
    });
    return out;
  }
  // stacked letters: one letter per row, top to bottom
  function stacked(str, font, h) {
    const out = []; let y = 0, first = true;
    for (const ch of [...str]) {
      if (ch === ' ') { y -= h * 0.42; continue; }
      const g = glyph(font, ch, h); if (!g) continue; const b = bb(g);
      if (!first) y -= h * 0.16; first = false;
      out.push(...move(g, -(b.x0 + b.x1) / 2, y - b.y1)); y -= (b.y1 - b.y0);
    }
    return out;
  }
  const rot90 = ps => map(ps, p => [-p[1], p[0]]).map(Q => Q); // reads bottom to top
  function arrangeText(layout, rows, font, h) {
    if (layout === 'stacked') return stacked(rows.join(' '), font, h);
    if (layout === 'along') return rot90(lines(rows, font, h));
    return lines(rows, font, h);
  }
  // the ways to break the text: 1 line, or 2-3 lines at the spaces (across also lets a single word stay whole)
  function splits(text, layout) {
    if (layout === 'stacked') return [[text]];
    const words = text.split(' '), out = [[text]];
    const max = layout === 'along' ? 2 : 4;
    const rec = (i, acc) => {
      if (i === words.length) { if (acc.length > 1 && acc.length <= max) out.push(acc); return; }
      for (let j = i + 1; j <= words.length; j++) rec(j, acc.concat([words.slice(i, j).join(' ')]));
    };
    if (words.length > 1 && words.length <= 8) rec(0, []);
    return out;
  }
  // biggest letters that fit the box (w \u00d7 h, mm); returns { rows, h, cut }
  function fitText(text, o, box) {
    const W = box[2] - box[0], H = box[3] - box[1], U10 = 10;
    let best = null;
    for (const rows of splits(text, o.layout)) {
      const ps = arrangeText(o.layout, rows, o.font, U10); if (!ps.length) continue;
      const b = bb(ps), s = Math.min(W / (b.x1 - b.x0), H / (b.y1 - b.y0));
      const h = Math.min(o.maxLetter, s * U10), score = h * (1 - 0.06 * (rows.length - 1));
      if (!best || score > best.score + 1e-9) best = { rows, h, score };
    }
    return best;
  }
  function placeIn(ps, box) { // center polys in the box; shrink if anything would poke out
    if (!ps.length) return ps;
    let b = bb(ps); const W = box[2] - box[0], H = box[3] - box[1];
    const k = Math.min(1, W / (b.x1 - b.x0), H / (b.y1 - b.y0));
    let out = move(ps, (box[0] + box[2]) / 2 - (b.x0 + b.x1) / 2, (box[1] + box[3]) / 2 - (b.y0 + b.y1) / 2);
    if (k < 1) out = scaleAbout(out, k * 0.999, (box[0] + box[2]) / 2, (box[1] + box[3]) / 2);
    return out;
  }
  function textBlock(o, box, label) {
    const warnings = [], c = cleanText(o.text, o.font, o.caps);
    if (c.missing.length) warnings.push(`Left out ${c.missing.map(x => `"${x}"`).join(', ')}: this font doesn't have ${c.missing.length > 1 ? 'those characters' : 'that character'}.`);
    if (c.over) warnings.push(`Lettering is up to ${FIT.maxChars} letters, so the extra letters were left out.`);
    let text = c.text; if (!text) return { polys: [], h: 0, rows: [], warnings: o.text ? warnings : warnings.concat(['Type a name or word for the lettering.']) };
    let f = fitText(text, o, box), cut = false, layout = o.layout;
    if (f && f.h < FIT.minLetter - 1e-9 && o.layout !== 'along') { // too many letters to stack or set across: run them along the case
      const g = fitText(text, { ...o, layout: 'along' }, box);
      if (g && g.h > f.h) { f = g; layout = 'along'; warnings.push(`Too many letters for ${o.layout === 'stacked' ? 'stacked letters' : 'lettering across'} at a printable size, so they run along the case instead.`); }
    }
    while (f && f.h < FIT.minLetter - 1e-9 && [...text].filter(x => x !== ' ').length > 1) { text = cutChars(text, [...text].filter(x => x !== ' ').length - 1); cut = true; f = fitText(text, { ...o, layout }, box); }
    if (!f) return { polys: [], h: 0, rows: [], warnings };
    if (cut) warnings.push(`"${c.text}" does not fit on this case even at the smallest printable letter size (${FIT.minLetter} mm), so the end was cut off. Use fewer letters, a different layout, or a bigger lighter.`);
    else if (f.h < FIT.minLetter) warnings.push(`One letter only just fits on this face: the lettering is ${f.h.toFixed(1)} mm tall.`); void label;
    const polys = placeIn(arrangeText(layout, f.rows, o.font, Math.max(0.5, f.h)), box);
    return { polys: U(polys), h: f.h, rows: f.rows, text, cut, warnings, layout };
  }
  function logoBlock(o, box) {
    if (!o.image || !o.image.length) return { polys: [], warnings: ['Upload a logo (PNG, JPG, WebP or SVG). A simple dark shape on a light or clear background traces best.'] };
    const ps = U(o.image), b = bb(ps); if (!ps.length || !isFinite(b.x0)) return { polys: [], warnings: [] };
    const W = (box[2] - box[0]) * o.logoSize / 100, H = (box[3] - box[1]) * o.logoSize / 100;
    const k = Math.min(W / (b.x1 - b.x0), H / (b.y1 - b.y0));
    const sized = map(ps, p => [p[0] * k, p[1] * k]);
    let polys = placeIn(sized, box);
    // features thinner than a nozzle line vanish in the slicer: open them away, keep what is left
    const clean = Off(Off(polys, -0.25), 0.25); if (area(clean) > area(polys) * 0.6) polys = clean;
    const warnings = []; if (area(polys) < 4) warnings.push('The logo came out very small or thin on this face. Try a bolder image or the logo-only design.');
    return { polys, warnings, size: [(b.x1 - b.x0) * k, (b.y1 - b.y0) * k] };
  }
  // the front face box (x across, z up) and what goes in it
  function faceLayout(o, cs, Hc, label) {
    const box = [-cs.flatHalf + FIT.side, FIT.end, cs.flatHalf - FIT.side, Hc - FIT.end];
    const warnings = []; let text = { polys: [], h: 0, rows: [] }, logo = { polys: [] };
    const wantText = o.design !== 'logo' && o.layout !== 'none', wantLogo = o.design !== 'name';
    if (wantLogo && wantText) {
      const bw = box[2] - box[0], bh = box[3] - box[1], lh = Math.min(bh * 0.4, bw * 1.25), gap = 2;
      logo = logoBlock(o, [box[0], box[3] - lh, box[2], box[3]]);
      text = textBlock(o, [box[0], box[1], box[2], box[3] - lh - gap], label);
    } else if (wantLogo) logo = logoBlock(o, box);
    else if (wantText) text = textBlock(o, box, label);
    warnings.push(...(text.warnings || []), ...(logo.warnings || []));
    // last guard: nothing outside the face box, and letters never under the logo
    const R = [rect(box[0], box[1], box[2], box[3])];
    const tp = text.polys.length ? I(text.polys, R) : [], lp = logo.polys.length ? Dff(I(logo.polys, R), tp) : [];
    return { box, layout: text.layout || o.layout, rawText: text.polys, rawLogo: logo.polys, text: tp, logo: lp, letterH: text.h, rows: text.rows, cut: !!text.cut, warnings, logoSize: logo.size || null };
  }

  // ---------------------------------------------------------------- back pattern (inside the flat back only)
  function patternPolys(kind, box, skip) {
    if (kind === 'none') return [];
    const [x0, z0, x1, z1] = box, out = [];
    if (kind === 'dots') { const s = 3.6; for (let j = 0, z = z0 + 1.6; z < z1; z += s * 0.866, j++) for (let x = x0 + 1.4 + (j & 1 ? s / 2 : 0); x < x1; x += s) out.push(P(circle(x, z, 1.1, 32))); }
    if (kind === 'diamonds') { const s = 4.4; for (let j = 0, z = z0 + 2; z < z1; z += s / 2, j++) for (let x = x0 + 1.6 + (j & 1 ? s / 2 : 0); x < x1; x += s) out.push(P([[x, z - 1.7], [x + 1.7, z], [x, z + 1.7], [x - 1.7, z]])); }
    if (kind === 'ribs') for (let z = z0 + 1; z < z1; z += 3) out.push(rect(x0 - 1, z, x1 + 1, z + 1.0));
    if (kind === 'chevrons') for (let z = z0 + 1; z < z1 + 6; z += 4) { const cx = (x0 + x1) / 2, w = 1.0, d = Math.min(3, (x1 - x0) / 4); out.push(P([[x0 - 1, z - d], [cx, z], [x1 + 1, z - d], [x1 + 1, z - d + w], [cx, z + w], [x0 - 1, z - d + w]])); }
    if (kind === 'waves') for (let z = z0 + 1.2; z < z1; z += 3.6) { const top = [], bot = []; for (let x = x0 - 1; x <= x1 + 1.001; x += 0.25) { const y = z + 0.8 * Math.sin((x - x0) / 3.2 * Math.PI); top.push([x, y + 0.5]); bot.push([x, y - 0.5]); } out.push(P(bot.concat(top.reverse()))); }
    let ps = I(U(out), [rect(x0, z0, x1, z1)]);
    if (skip && skip.length) ps = Dff(ps, skip);
    return ps.filter(Q => Math.abs(area([Q])) > 0.3);
  }

  // ---------------------------------------------------------------- 3D
  const OVERLAP = 0.02;
  function solid(polys, a, h0, h1) {
    let m = T.extrude(polys, a, h0, h1);
    for (const e of [0.02, 0.05, 0.1]) { if (Core.checkClosed(m).closed) break; m = T.extrude(Off(Off(polys, -e), e), a, h0, h1); }
    return m;
  }
  function stackZ(layers) {
    const L = layers.filter(l => l.z1 > l.z0 + 1e-9).map(l => ({ ...l, polys: U(l.polys) })).filter(l => l.polys.length);
    const zTop = Math.max(...L.map(l => l.z1)), out = [];
    for (const l of L) { const m = solid(l.polys, 2, l.z0, l.z1 < zTop - 1e-9 ? l.z1 + OVERLAP : l.z1); for (let i = 0; i < m.length; i++) out.push(m[i]); }
    return Float64Array.from(out);
  }
  // face polys (x, z) to a prism along y from y0 to y1 (axis 1 maps 2D [u, w] to [z, x])
  function faceSolid(ps, y0, y1) {
    const out = [];
    for (const Q of ps) { const m = solid([{ outer: Q.outer.map(p => [p[1], p[0]]), holes: Q.holes.map(h => h.map(p => [p[1], p[0]])) }], 1, y0, y1); for (let i = 0; i < m.length; i++) out.push(m[i]); }
    return Float64Array.from(out);
  }
  function bodyPart(cs, o, Hc, att) {
    const sp = SPEC, cuts = new Set([0, sp.floor, Hc - sp.lead, Hc]);
    const lead = Off(cs.cav, 0.4), hole = o.hole ? [P(circle(0, 0, sp.holeR, 64))] : [];
    let ring = null; if (att === 'keyring' || att === 'carabiner') { const g = sp[att], cx = cs.A + g.R - 2.0; ring = { disc: P(circle(cx, 0, g.R, 96)), hole: P(circle(cx, 0, g.r, 72)), h: g.h, c: [cx, 0], R: g.R, r: g.r }; cuts.add(g.h); }
    let clip = null;
    if (att === 'clip') {
      const w = Math.min(sp.clipW, cs.flatHalf * 2 - 1), yb = cs.front, t = sp.clipT, gap = sp.clipGap;
      clip = { tongue: rect(-w / 2, yb + gap, w / 2, yb + gap + t), bridge: rect(-w / 2, yb - 0.8, w / 2, yb + gap + t), bump: rect(-w / 2, yb + 0.55, w / 2, yb + gap + 0.05), w };
      cuts.add(Hc - sp.clipBridge); cuts.add(2.4);
    }
    let win = null;
    if (o.window && Hc - sp.floor > 26) {
      const ww = Math.min(5, cs.flatHalf * 2 - 4), wx = att === 'clip' ? Math.min(cs.flatHalf - ww / 2 - 1.2, clip.w / 2 + ww / 2 + 1.4) : 0;
      if (ww >= 2.5 && (att !== 'clip' || wx + ww / 2 <= cs.flatHalf - 1)) { win = { r: rect(wx - ww / 2, 0, wx + ww / 2, cs.front + 2), z0: sp.floor + 7, z1: Hc - 8, x: wx, w: ww }; cuts.add(win.z0); cuts.add(win.z1); }
    }
    // barrel lighters flare toward the top: the pocket follows them in 3 mm steps (each step only widens going up, so
    // the inside never overhangs)
    const taper = cs.L && cs.L.sect === 'barrel', STEP = 3;
    if (taper) for (let z = sp.floor + STEP; z < Hc - sp.lead - 0.8; z += STEP) cuts.add(+z.toFixed(4));
    const cavAt = (z0, z1) => taper ? section(cs.L, cs.fit, Math.min(z1, Hc) - sp.floor) : cs.cav;
    const zs = [...cuts].filter(z => z >= 0 && z <= Hc).sort((a, b) => a - b), layers = [];
    for (let i = 0; i + 1 < zs.length; i++) {
      const z0 = zs[i], z1 = zs[i + 1], zm = (z0 + z1) / 2, add = cs.outer.slice(), cut = [];
      if (ring && zm < ring.h) { add.push(ring.disc); cut.push(ring.hole); }
      if (clip) { add.push(clip.tongue); if (zm > Hc - sp.clipBridge) add.push(clip.bridge); if (zm < 2.4) add.push(clip.bump); }
      if (zm < sp.floor) cut.push(...hole); else cut.push(...(zm > Hc - sp.lead ? lead : cavAt(z0, z1)));
      if (win && zm > win.z0 && zm < win.z1) cut.push(win.r);
      layers.push({ z0, z1, polys: Dff(U(add), U(cut)) });
    }
    return { p: stackZ(layers), ring, clip, win };
  }

  // ---------------------------------------------------------------- display-only lighter (never exported)
  // a smooth display mesh of a barrel lighter body: rings cast from the barrel's center, joined with quads
  function loftBarrel(L, z0, z1) {
    const N = 96, n = 24, eMax = L.taper * (L.H - L.head), cx = eMax / 2, rings = [], out = [];
    const ray = (poly, t) => { const dx = Math.cos(t), dy = Math.sin(t); let best = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue; const u = ((a[0] - cx) * ey - a[1] * ex) / den, v = ((a[0] - cx) * dy - a[1] * dx) / den; if (u > 0 && v >= -1e-9 && v <= 1 + 1e-9) best = Math.max(best, u); } return [cx + dx * best, dy * best]; };
    for (let j = 0; j <= n; j++) { const z = z0 + (z1 - z0) * j / n, poly = barrel(L, 0, Math.min(z - z0, L.H - L.head)); const ring = []; for (let k = 0; k < N; k++) { const q = ray(poly, k / N * Math.PI * 2); ring.push([q[0], q[1], z]); } rings.push(ring); }
    const tri = (a, b, c) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let j = 0; j < n; j++) for (let k = 0; k < N; k++) { const a0 = rings[j][k], a1 = rings[j][(k + 1) % N], b0 = rings[j + 1][k], b1 = rings[j + 1][(k + 1) % N]; tri(a0, a1, b1); tri(a0, b1, b0); }
    const c0 = [cx, 0, z0], c1 = [cx, 0, z1];
    for (let k = 0; k < N; k++) { tri(c0, rings[0][(k + 1) % N], rings[0][k]); tri(c1, rings[n][k], rings[n][(k + 1) % N]); }
    return Float64Array.from(out);
  }
  function mockup(L, z0) {
    const out = [], H = L.H, bodyTop = z0 + H - (L.top === 'flat' ? 2.5 : 15.5);
    out.push({ name: 'Lighter', kind: 'lighter', mat: 'shell', color: L.color, p: L.sect === 'barrel' ? loftBarrel(L, z0, bodyTop) : solid(section(L, 0), 2, z0, bodyTop) });
    if (L.top === 'flat') {
      out.push({ name: 'Lighter top', kind: 'lighter', mat: 'aluminum', color: '#B9BEC6', p: solid(section(L, -0.6), 2, bodyTop, z0 + H - 0.6) });
      out.push({ name: 'Flint wheel', kind: 'lighter', mat: 'switch', color: '#5B6068', p: solid([P(circle(0, z0 + H - 1.5, 4.2, 64))].map(Q => Q), 0, -3.2, 3.2) });
    } else {
      out.push({ name: 'Lighter hood', kind: 'lighter', mat: 'aluminum', color: '#C9CDD3', p: solid([P(T.roundRect(-L.W * 0.32, -L.D * 0.12, L.W * 0.32, L.D * 0.46, 1.2, 8))], 2, bodyTop - 0.5, z0 + H - 0.4) });
      out.push({ name: 'Flint wheel', kind: 'lighter', mat: 'switch', color: '#4E535B', p: solid([P(circle(-L.D * 0.2, z0 + H - 5.2, 3.9, 64))], 0, -3.6, 3.6) });
      out.push({ name: 'Gas lever', kind: 'lighter', mat: 'rubber', color: '#2B2D31', p: solid([P(T.roundRect(-L.W * 0.26, -L.D * 0.44, L.W * 0.26, L.D * 0.1, 1.2, 8))], 2, bodyTop - 0.3, bodyTop + 4.6) });
    }
    return out;
  }

  // ---------------------------------------------------------------- build
  function build(raw) {
    const o = options(raw), L = lighterOf(o), warnings = [];
    const minHead = L.head; let head = o.head > 0 ? o.head : L.head;
    if (head < minHead) head = minHead; // never cover the striker, wheel or gas lever
    head = Math.min(head, L.H * 0.6);
    const cs = caseShape(L, o), Hc = SPEC.floor + L.H - head;
    const face = faceLayout(o, cs, Hc, L.label.toLowerCase());
    warnings.push(...face.warnings);
    const body = bodyPart(cs, o, Hc, o.attach);
    const patSkip = []; if (body.clip) patSkip.push(rect(-body.clip.w / 2 - 1.5, -10, body.clip.w / 2 + 1.5, Hc + 10)); if (body.win) patSkip.push(rect(body.win.x - body.win.w / 2 - 1.2, body.win.z0 - 1.2, body.win.x + body.win.w / 2 + 1.2, body.win.z1 + 1.2));
    const patBox = [-cs.flatHalf + 1.2, SPEC.floor + 1.2, cs.flatHalf - 1.2, Hc - 2.2];
    const pat = patternPolys(o.pattern, patBox, patSkip);
    if (o.window && !body.win) warnings.push('The fuel window was left off: this case is too short or too narrow for one.');
    const colors = { body: o.colors.body, letters: o.colors.letters, logo: o.colors.logo, pattern: o.colors.pattern || o.colors.body };
    const parts = [{ obj: 'case', role: 'body', kind: 'case', name: 'Case', color: colors.body, p: body.p }];
    if (face.text.length) parts.push({ obj: 'case', role: 'letters', kind: 'letters', name: 'Letters', color: colors.letters, p: faceSolid(face.text, cs.back - o.relief, cs.back + SPEC.embed) });
    if (face.logo.length) parts.push({ obj: 'case', role: 'logo', kind: 'logo', name: 'Logo', color: colors.logo, p: faceSolid(face.logo, cs.back - o.relief, cs.back + SPEC.embed) });
    if (pat.length) parts.push({ obj: 'case', role: 'pattern', kind: 'pattern', name: 'Pattern', color: colors.pattern, p: faceSolid(pat, cs.front - SPEC.patEmbed, cs.front + SPEC.patRelief) });
    if (o.fitRing) { // a short ring of the same pocket to check the fit before the full print
      const ring = stackZ([{ z0: 0, z1: 10, polys: Dff(Off(cs.cav, 1.6), Off(cs.cav, 0)) }]);
      parts.push({ obj: 'fitring', role: 'body', kind: 'case', name: 'Fit test ring', color: colors.body, p: ring });
    }
    const usedColors = []; for (const q of parts) if (!usedColors.includes(q.color)) usedColors.push(q.color);
    // place on the build plate (centered; the fit ring to the right)
    const placed = [], bedC = [o.bed[0] / 2, o.bed[1] / 2];
    const caseB = Core.bbox(T.concat(parts.filter(q => q.obj === 'case').map(q => q.p)));
    for (const q of parts) {
      let dx = bedC[0] - (caseB.min[0] + caseB.max[0]) / 2, dy = bedC[1] - (caseB.min[1] + caseB.max[1]) / 2;
      if (q.obj === 'fitring') { const rb = Core.bbox(q.p); dx = bedC[0] + (caseB.max[0] - caseB.min[0]) / 2 + 8 - rb.min[0]; }
      placed.push({ ...q, plate: 0, p: moveP(q.p, dx, dy, 0) });
    }
    const ob = bb(cs.outer.concat(body.ring ? [body.ring.disc] : []).concat(body.clip ? [body.clip.tongue] : []));
    const stats = {
      lighter: o.lighter, lighterLabel: L.label, lighterSize: [L.H, L.W, L.D], fit: o.fitMM, pocket: [bb(cs.cav).x1 * 2, bb(cs.cav).y1 * 2],
      size: [ob.x1 - ob.x0, ob.y1 - ob.y0, Hc], height: Hc, head, wall: cs.wall, face: [cs.flatHalf * 2, Hc], letterH: face.letterH, rows: face.rows,
      layout: o.layout, design: o.design, shape: o.shape, attach: o.attach, colors: usedColors.length, font: o.font,
      tris: parts.reduce((s, q) => s + q.p.length / 9, 0), window: !!body.win
    };
    return { options: o, lighter: L, cs, Hc, face, body, parts: placed, raw: parts, mock: mockup(L, SPEC.floor), plates: 1, colors: usedColors, stats, warnings };
  }
  function moveP(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  // the preview: the case (and fit ring) as built, with the display-only lighter inside the case
  function scene(res) {
    const out = res.raw.filter(q => q.obj === 'case').map(q => ({ name: q.name, kind: q.kind, color: q.color, p: Float32Array.from(q.p) }));
    const fr = res.raw.find(q => q.obj === 'fitring');
    if (fr) { const cb = Core.bbox(T.concat(res.raw.filter(q => q.obj === 'case').map(q => q.p))), rb = Core.bbox(fr.p); out.push({ name: fr.name, kind: fr.kind, color: fr.color, p: Float32Array.from(moveP(fr.p, cb.max[0] + 8 - rb.min[0], 0, 0)) }); }
    for (const m of res.mock) out.push({ name: m.name, kind: 'lighter', color: m.color, mat: m.mat, preview: true, p: Float32Array.from(m.p) });
    return out;
  }
  function filaments(res) { return res.colors.map(c => ({ color: c, role: res.raw.filter(q => q.color === c).map(q => q.role).filter((v, i, a) => a.indexOf(v) === i).join(' + ') })); }
  function export3MF(res, o) {
    o = o || {}; const bed = res.options.bed, cols = res.colors, objects = [], org = T.bambuPlateOrigin(0, 1, bed[0], bed[1]);
    for (const id of [...new Set(res.parts.map(q => q.obj))]) {
      const ps = res.parts.filter(q => q.obj === id);
      const mk = q => ({ name: q.name, p: moveP(q.p, org[0], org[1]), color: q.color, extruder: cols.indexOf(q.color) + 1 });
      const name = id === 'fitring' ? 'Fit test ring' : (o.name || 'Lighter case');
      if (ps.length > 1) objects.push({ name, parts: ps.map(mk) }); else objects.push({ ...mk(ps[0]), name });
    }
    return T.threeMF(objects, { title: o.name || 'Lighter case', plates: [objects.map((_, i) => i)], bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  function readme(res, name) {
    const s = res.stats, o = res.options, f = v => (Math.round(v * 10) / 10).toString(), L = res.lighter;
    const R = [`Expressarte lighter case: ${name}`, '',
      `For: ${L.label} (${f(L.H)} \u00d7 ${f(L.W)} \u00d7 ${f(L.D)} mm)${L.fits ? `, fits ${L.fits}` : ''}. Pocket ${f(s.pocket[0])} \u00d7 ${f(s.pocket[1])} mm (${f(o.fitMM)} mm clearance each side).`,
      `Case ${f(s.size[0])} \u00d7 ${f(s.size[1])} \u00d7 ${f(s.height)} mm, ${SHAPES[o.shape].label.toLowerCase()} shape, ${f(s.wall)} mm walls. The top ${f(s.head)} mm of the lighter (wheel, striker and gas lever) stays open.`];
    if (s.letterH) R.push(`Lettering: "${res.face.rows.join(' ')}" ${LAYOUTS[o.layout].toLowerCase()}, ${f(s.letterH)} mm letters, raised ${f(o.relief)} mm, all inside the flat front face.`);
    if (res.face.logo.length) R.push('Logo: raised on the front face.');
    if (o.pattern !== 'none') R.push(`Back pattern: ${PATTERNS[o.pattern].toLowerCase()}.`);
    R.push(`Attachment: ${ATTACH[o.attach].toLowerCase()}.`);
    R.push('', 'Filament slots in the 3MF'); filaments(res).forEach((x, i) => R.push(`  ${i + 1}: ${x.color}  ${x.role}`));
    R.push('', 'Printing', '  - Print standing up, open end at the top, as laid out. No supports needed.', '  - 0.16 or 0.2 mm layers, 3 walls, 15% infill. PLA or PETG; PETG takes pocket heat better.',
      '  - The letters, logo and pattern are separate parts of the one object, each on its own filament slot.');
    if (o.attach === 'clip') R.push('  - The clip prints standing next to the back wall and joins it at the top; snap it gently once to free it.');
    if (o.fitRing) R.push('  - Print the small fit test ring first and slide the lighter in. Too tight: choose a looser fit. Too loose: a snugger one.');
    R.push('', 'Lighter sizes vary a little between makers and batches. If yours is different, pick Custom size and enter your measurements.', '', 'Keep lighters away from children. The case is for carrying only: never print or use it near an open flame.', '', 'Brand names are used only to describe fit; Expressarte isn\'t affiliated with these brands.', '', 'Made with Expressarte');
    return R.join('\n') + '\n';
  }
  function files(res, o) {
    o = o || {}; const name = o.name || 'Lighter case', base = safe(o.fileBase || name.toLowerCase()) || 'lighter_case';
    const list = [{ name: `${base}.3mf`, data: export3MF(res, o) }], seen = new Set();
    for (const q of res.raw) { let nm = safe((q.obj === 'fitring' ? 'fit_test_ring' : q.name).toLowerCase()); while (seen.has(nm)) nm += '_'; seen.add(nm); list.push({ name: `stl/${nm}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }); }
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }
  function proNeeds(res) {
    const o = res.options, usesText = res.face.text.length > 0;
    return { tool: 'lightercase', colors: res.colors.length, font: o.font, fontLabel: FONTS[o.font].label, extraFont: usesText && FONTS[o.font].pro, logo: res.face.logo.length > 0 };
  }

  const api = { LIGHTERS, SHAPES, LAYOUTS, DESIGNS, FONTS, PATTERNS, ATTACH, FITS, PALETTE, FIT, LIMITS, DEFAULTS, SPEC, options, lighterOf, section, outline, caseShape, cleanText, fitText, faceLayout, patternPolys, build, scene, filaments, export3MF, files, readme, proNeeds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPLighterCase = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
