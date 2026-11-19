/* Expressarte name clicker keychain: a chunky name (or logo, or photo silhouette) that clicks. A standard mechanical
   keyboard switch (not printed) snaps into the base; the cap sits on the switch stem, so pressing it clicks the switch.

   Parts (units: mm; every part is one closed, outward-facing solid, built from stacked flat layers):
   - base: the name or traced-image outline (letters or the logo thickened and bridged into one piece, with a square
     pad round each switch), printed upright. Each switch pocket is, from the bottom: a floor, a pin pocket, a housing
     pocket wide enough for the clips, the 1.5 mm plate the switch clips into (14 mm + the fit tolerance), and a collar
     that hides the top of the switch. Optional keyring loop on the floor, with a short bridge so it stays attached to
     an irregular outline.
   - cap: the same outline, printed face down: the name, logo or silhouette (and an optional heart or star) inlaid in
     the first layers as separate parts, one filament per color, and underneath a round boss with a cross socket on
     each switch stem.
   - fit test: a one-switch base and cap, to check the plate clips and the stem socket before the full print.
   Batch mode makes one base and cap per name and packs them onto as many build plates as they need. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // switch and part geometry (mm); the switch numbers follow the common keyboard switch footprint (14 mm plate cutout, cross stem)
  const SPEC = {
    plate: 14.0, plateT: 1.5, floor: 1.0, pinH: 3.4, pinW: 12.6, housingH: 5.2, housingW: 15.2, collarW: 16.4, collarH: 6.6,
    stemAbovePlate: 11.6, socketDepth: 3.6, crossW: 4.05, armX: 1.3, armY: 1.1, bossD: 5.4, bossL: 4.0, travel: 4.0,
    capT: 3.2, inlay: 0.6, pad: 19.8, wall: 1.8, loopR: 6.5, loopHole: 3.0, loopH: 4.0, outline: 2.6
  };
  SPEC.baseH = SPEC.floor + SPEC.pinH + SPEC.housingH + SPEC.plateT + SPEC.collarH;                 // 17.7
  SPEC.plateTop = SPEC.floor + SPEC.pinH + SPEC.housingH + SPEC.plateT;                               // 11.1
  SPEC.capUnder = SPEC.plateTop + SPEC.stemAbovePlate - SPEC.socketDepth + SPEC.bossL;                 // cap underside at rest
  SPEC.restGap = SPEC.capUnder - SPEC.baseH;                                                          // gap at rest
  const FONTS = { round: { label: 'Round', pro: false }, chunky: { label: 'Chunky', pro: false }, soft: { label: 'Soft', pro: true }, wide: { label: 'Wide', pro: true }, balloon: { label: 'Balloon', pro: true } };
  const LOOPS = { left: 'Left end', right: 'Right end', top: 'Top corner', none: 'No loop' };
  const CHARMS = { none: 'None', heart: 'Heart', star: 'Star' };
  const SOURCES = { name: 'Name', image: 'Logo or photo' };
  const IMAGE_MODES = { logo: 'Logo or graphic', photo: 'Photo silhouette' };
  const BODIES = { pad: 'Clicker body', follow: 'Follow the shape' };
  const PALETTE = [
    { name: 'White', hex: '#F7F7F2' }, { name: 'Black', hex: '#1E1E1E' }, { name: 'Red', hex: '#C8102E' }, { name: 'Orange', hex: '#E8730C' },
    { name: 'Yellow', hex: '#F5C518' }, { name: 'Green', hex: '#1E9B4F' }, { name: 'Sky blue', hex: '#4A90D9' }, { name: 'Purple', hex: '#7B4FB8' },
    { name: 'Pink', hex: '#F2A0B5' }, { name: 'Mint', hex: '#8FD9C0' }
  ];
  const RAINBOW = ['#C8102E', '#E8730C', '#F5C518', '#1E9B4F', '#4A90D9', '#7B4FB8', '#F2A0B5', '#8FD9C0'];
  const LIMITS = { maxChars: 12, maxSwitches: 3, freeNames: 1, freeColors: 2, maxColors: 8, maxNames: 40, freeFonts: Object.keys(FONTS).filter(k => !FONTS[k].pro) };
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    names: 'Emma', font: 'round', letterH: 24, switches: 1, loop: 'left', charm: 'none', fit: 0.15, fitTest: true, batch: false,
    colors: { base: PZ.mint, cap: '', letters: PZ.ink }, rainbow: false, bed: [256, 256], bambu: 'A1', gap: 6,
    source: 'name', image: null, imageName: '', imageMode: 'logo', body: 'pad', faceH: 28,
    threshold: 0.5, invert: false, dropBg: false, dropTol: 0.18, smooth: 1, simplify: 0.7, minFeature: 1.2, outlineOffset: 0.8
  };

  function options(raw) {
    const o = { ...DEFAULTS, ...(raw || {}) };
    o.colors = { ...DEFAULTS.colors, ...((raw && raw.colors) || {}) };
    if (!FONTS[o.font] || !Bubble.FONTS[o.font]) o.font = 'round';
    if (!LOOPS[o.loop]) o.loop = 'left';
    if (!CHARMS[o.charm]) o.charm = 'none';
    o.source = o.source === 'image' ? 'image' : 'name';
    o.imageMode = o.imageMode === 'photo' ? 'photo' : 'logo';
    o.body = o.body === 'follow' ? 'follow' : 'pad';
    o.image = Array.isArray(raw && raw.image) ? raw.image : null;
    o.imageName = String((raw && raw.imageName) || '').slice(0, 80);
    o.faceH = clamp(+o.faceH || 28, 16, 50);
    o.letterH = o.source === 'image' ? o.faceH : clamp(+o.letterH || 24, 16, 40);
    o.threshold = clamp(isFinite(+o.threshold) ? +o.threshold : 0.5, 0.02, 0.98);
    o.invert = !!(raw && raw.invert);
    o.dropBg = (raw && raw.dropBg) != null ? !!raw.dropBg : o.imageMode === 'photo';
    o.dropTol = clamp(isFinite(+(raw && raw.dropTol)) ? +raw.dropTol : 0.18, 0.02, 0.6);
    o.smooth = clamp(Math.round((raw && raw.smooth) != null ? +raw.smooth : 1), 0, 4);
    o.simplify = clamp(isFinite(+(raw && raw.simplify)) ? +raw.simplify : 0.7, 0.15, 3);
    o.minFeature = clamp(isFinite(+(raw && raw.minFeature)) ? +raw.minFeature : 1.2, 0.4, 6);
    o.outlineOffset = clamp(isFinite(+(raw && raw.outlineOffset)) ? +raw.outlineOffset : (o.imageMode === 'photo' ? 1.4 : 0.8), 0, 4);
    o.switches = clamp(Math.round(+o.switches || 1), 1, LIMITS.maxSwitches);
    o.fit = clamp(isFinite(+o.fit) ? +o.fit : 0.15, -0.1, 0.5);
    o.fitTest = o.fitTest !== false; o.batch = !!o.batch; o.rainbow = !!o.rainbow;
    for (const k of ['base', 'cap', 'letters']) { const v = String(o.colors[k] || ''); o.colors[k] = /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : (k === 'cap' ? '' : DEFAULTS.colors[k]); }
    if (Array.isArray(raw && raw.letterColors)) o.letterColors = raw.letterColors.map(c => /^#[0-9a-f]{6}$/i.test(c || '') ? c.toUpperCase() : null);
    o.bed = [clamp(+(o.bed && o.bed[0]) || 256, 100, 1000), clamp(+(o.bed && o.bed[1]) || 256, 100, 1000)];
    return o;
  }
  // names: one per line in batch mode, the first line otherwise; letters the font has, up to 12 (spaces kept, not counted)
  function parseNames(text, batch, font) {
    const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean), out = [], dropped = new Set();
    for (const s of (batch ? lines : lines.slice(0, 1)).slice(0, LIMITS.maxNames)) {
      let n = '', k = 0;
      for (const ch of [...s]) { if (/\s/.test(ch)) { if (n && !/\s$/.test(n)) n += ' '; continue; } if (font && !Bubble.supported(font, ch)) { dropped.add(ch); continue; } if (k >= LIMITS.maxChars) continue; n += ch; k++; }
      n = n.trim(); if (n) out.push(n);
    }
    return { names: out, dropped: [...dropped] };
  }
  const letterCount = s => [...String(s)].filter(ch => !/\s/.test(ch)).length;

  // ---------------------------------------------------------------- 2D
  const circle = (cx, cy, r, n) => T.circle(cx, cy, r, n || Math.max(24, Math.ceil(r * 6)));
  const P = L => ({ outer: L, holes: [] });
  const U = ps => T.unionPolys(ps), Dff = (a, b) => b && b.length ? T.diffPolys(a, b) : a, I = (a, b) => T.interPolys(a, b), Off = (ps, d) => T.offset(ps, d);
  const move = (ps, dx, dy) => ps.map(Q => ({ outer: Q.outer.map(p => [p[0] + dx, p[1] + dy]), holes: Q.holes.map(h => h.map(p => [p[0] + dx, p[1] + dy])) }));
  const mirrorX = ps => ps.map(Q => ({ outer: Q.outer.map(p => [-p[0], p[1]]).reverse(), holes: Q.holes.map(h => h.map(p => [-p[0], p[1]]).reverse()) }));
  const bb = ps => T.polysBBox(ps);
  // offsets of curvy glyphs carry thousands of tiny arc steps; 0.02 mm is far below a nozzle line
  function rdp(pts, tol) {
    if (pts.length < 4) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
    while (st.length) { const [a, b] = st.pop(); let best = -1, bd = tol; const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1], L = Math.hypot(bx - ax, by - ay) || 1e-9;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > bd) { bd = d; best = i; } }
      if (best >= 0) { keep[best] = 1; st.push([a, best], [best, b]); } }
    return pts.filter((_, i) => keep[i]);
  }
  function simpLoop(L, tol) { let far = 0, fd = -1; for (let i = 0; i < L.length; i++) { const d = Math.hypot(L[i][0] - L[0][0], L[i][1] - L[0][1]); if (d > fd) { fd = d; far = i; } }
    const a = rdp(L.slice(0, far + 1), tol), b = rdp(L.slice(far).concat([L[0]]), tol); return a.concat(b.slice(1, -1)); }
  const simp = (ps, tol) => U(ps.map(Q => ({ outer: simpLoop(Q.outer, tol || 0.02), holes: Q.holes.map(h => simpLoop(h, tol || 0.02)).filter(h => h.length >= 3) })).filter(Q => Q.outer.length >= 3));
  const area2 = L => { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; };
  function chaikin(L, n) {
    let out = L;
    for (let it = 0; it < (n || 0); it++) { const next = []; for (let i = 0; i < out.length; i++) { const p = out[i], q = out[(i + 1) % out.length]; next.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]); } out = next; }
    return out;
  }
  // RGBA (row 0 = top) to brightness 0..1. Transparent pixels become white (background) and are remembered in alpha.
  function imageGray(data, w, h) {
    const gray = new Float32Array(w * h), alpha = new Float32Array(w * h); let trans = 0;
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3] / 255, l = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
      alpha[i] = a; gray[i] = l * a + 1 * (1 - a); if (a < 0.08) trans++;
    }
    return { gray, alpha, w, h, transparent: trans / (w * h) > 0.02 };
  }
  // Flood from the edges: pixels close to the edge brightness are treated as background (set to white).
  // Skipped when the edges are already busy (a cropped photo with no clear backdrop).
  function dropEdgeBackground(gray, w, h, tol) {
    const edge = [];
    for (let x = 0; x < w; x++) { edge.push(x); edge.push((h - 1) * w + x); }
    for (let y = 1; y < h - 1; y++) { edge.push(y * w); edge.push(y * w + w - 1); }
    let sum = 0; for (const i of edge) sum += gray[i]; const seed = sum / edge.length;
    let v = 0; for (const i of edge) v += (gray[i] - seed) * (gray[i] - seed);
    if (Math.sqrt(v / edge.length) > 0.22) return gray;
    const out = Float32Array.from(gray), seen = new Uint8Array(w * h), q = [];
    const push = i => { if (!seen[i]) { seen[i] = 1; q.push(i); } };
    for (const i of edge) if (Math.abs(gray[i] - seed) <= (tol || 0.18) * 1.2) push(i);
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % w, y = (i / w) | 0; out[i] = 1;
      if (x > 0) { const j = i - 1; if (Math.abs(gray[j] - seed) <= (tol || 0.18)) push(j); }
      if (x + 1 < w) { const j = i + 1; if (Math.abs(gray[j] - seed) <= (tol || 0.18)) push(j); }
      if (y > 0) { const j = i - w; if (Math.abs(gray[j] - seed) <= (tol || 0.18)) push(j); }
      if (y + 1 < h) { const j = i + w; if (Math.abs(gray[j] - seed) <= (tol || 0.18)) push(j); }
    }
    return out;
  }
  // Trace a grayscale bitmap to clean vector outlines (mm), reusing the shared binary tracer in tools.js.
  // threshold is 0..1 (darker than this becomes the shape, unless invert is on). Transparent pixels (alpha < 0.08) stay empty.
  function traceImage(gray, w, h, raw, alpha) {
    const o = {
      threshold: clamp(isFinite(+raw.threshold) ? +raw.threshold : 0.5, 0.02, 0.98),
      invert: !!raw.invert, dropBg: !!raw.dropBg, dropTol: clamp(isFinite(+raw.dropTol) ? +raw.dropTol : 0.18, 0.02, 0.6),
      smooth: clamp(Math.round(+raw.smooth || 0), 0, 4), simplify: clamp(isFinite(+raw.simplify) ? +raw.simplify : 0.7, 0.15, 3),
      minFeature: clamp(isFinite(+raw.minFeature) ? +raw.minFeature : 1.2, 0.4, 6), width: clamp(+raw.width || 40, 8, 200)
    };
    let g = o.dropBg ? dropEdgeBackground(gray, w, h, o.dropTol) : gray;
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (alpha && alpha[i] < 0.08) { bin[i] = 0; continue; }
      const dark = g[i] < o.threshold; bin[i] = (o.invert ? !dark : dark) ? 1 : 0;
    }
    let loops = T.traceBinary(bin, w, h).map(L => simpLoop(L, o.simplify));
    if (o.smooth) loops = loops.map(L => chaikin(L, o.smooth));
    loops = loops.filter(L => Math.abs(area2(L)) > 8 && L.length >= 3);
    if (!loops.length) return [];
    let x0 = Infinity, x1 = -Infinity; for (const L of loops) for (const q of L) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; }
    const k = o.width / Math.max(1, x1 - x0);
    let polys = T.unionPolys(loops.map(L => P(L.map(q => [q[0] * k, q[1] * k]))), 'evenodd');
    const d = o.minFeature / 2;
    if (d > 0.05) polys = Off(Off(polys, -d), d);
    const minA = o.minFeature * o.minFeature;
    return polys.filter(Q => Math.abs(area2(Q.outer)) > minA).map(Q => ({ outer: Q.outer, holes: Q.holes.filter(h => Math.abs(area2(h)) > minA) }));
  }
  function fitPolys(ps, maxW, maxH) {
    if (!ps || !ps.length) return [];
    const b = bb(ps); const sw = Math.max(0.01, b.x1 - b.x0), sh = Math.max(0.01, b.y1 - b.y0);
    const s = Math.min(maxW / sw, maxH / sh);
    return move(ps.map(Q => ({ outer: Q.outer.map(p => [p[0] * s, p[1] * s]), holes: Q.holes.map(h => h.map(p => [p[0] * s, p[1] * s])) })), -b.x0 * s, -b.y0 * s);
  }
  function capsulePolys(x0, y0, x1, y1, r) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, px = -uy * r, py = ux * r;
    return [P(circle(x0, y0, r, 20)), P(circle(x1, y1, r, 20)), P([[x0 + px, y0 + py], [x1 + px, y1 + py], [x1 - px, y1 - py], [x0 - px, y0 - py]])];
  }
  function heart(s) { const L = []; for (let i = 0; i < 96; i++) { const t = i / 96 * Math.PI * 2; L.push([16 * Math.sin(t) ** 3 * s, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s]); } return L; }
  function star(R) { const L = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.48 : R; L.push([r * Math.cos(a), r * Math.sin(a)]); } return L; }
  // the letters of one name, laid out left to right (baseline y 0), each letter its own polys; the charm goes last
  function glyphs(name, o) {
    const h = o.letterH, out = []; let x = 0;
    for (const ch of [...name]) {
      if (/\s/.test(ch)) { x += h * 0.32; continue; }
      const g = Bubble.glyphPolys(o.font, ch, h); if (!g || !g.polys.length) continue;
      const b = bb(g.polys); out.push({ ch, polys: simp(move(g.polys, x - b.x0, 0)) }); x += (b.x1 - b.x0) - h * 0.03;
    }
    if (o.charm !== 'none') {
      const C = o.charm === 'heart' ? U([P(heart(h * 0.027))]) : Off(U([P(star(h * 0.5))]), -h * 0.03).map(Q => Q); const cb = bb(C);
      const C2 = o.charm === 'star' ? Off(C, h * 0.03) : C, b2 = bb(C2);
      out.push({ ch: o.charm, charm: true, polys: move(C2, x + h * 0.08 - b2.x0, h * 0.47 - (b2.y0 + b2.y1) / 2) }); void cb;
    }
    return out;
  }
  // the traced logo or silhouette, scaled to the design size, plus the optional charm on the right
  function imageGlyphs(polys, o) {
    const h = o.faceH || o.letterH || 28, maxW = Math.max(h * 2.8, o.switches * (SPEC.pad + 4) + 8);
    const fitted = fitPolys(polys, maxW, h), out = fitted.length ? [{ ch: 'image', polys: fitted }] : [];
    if (o.charm !== 'none' && fitted.length) {
      const b = bb(fitted);
      const C = o.charm === 'heart' ? U([P(heart(h * 0.027))]) : Off(U([P(star(h * 0.5))]), -h * 0.03);
      const C2 = o.charm === 'star' ? Off(C, h * 0.03) : C, b2 = bb(C2);
      out.push({ ch: o.charm, charm: true, polys: move(C2, b.x1 + h * 0.08 - b2.x0, (b.y0 + b.y1) / 2 - (b2.y0 + b2.y1) / 2) });
    }
    return out;
  }
  // the outline shared by the base and the cap: thickened letters, a bridge so it is one piece, a pad on each switch
  function outlineOf(G, o) {
    if (o.source === 'image') return outlineOfImage(G, o);
    const all = U(G.flatMap(g => g.polys)), b = bb(all), h = o.letterH, sp = SPEC, warnings = [];
    const mid = h * 0.47, bridge = P(T.roundRect(b.x0 + h * 0.15, mid - h * 0.22, b.x1 - h * 0.15, mid + h * 0.22, h * 0.2));
    let out = Off(U(Off(all, sp.outline).concat([bridge])), 0);
    const W = b.x1 - b.x0 + 2 * sp.outline; let n = o.switches;
    while (n > 1 && W / n < sp.pad + 2) n--;
    if (n < o.switches) warnings.push(`This name is too short for ${o.switches} switches, so it uses ${n}. Make the letters bigger or the name longer for more.`);
    const xs = []; for (let i = 0; i < n; i++) xs.push(b.x0 - sp.outline + W * (i + 0.5) / n);
    const pads = xs.map(x => P(T.roundRect(x - sp.pad / 2, mid - sp.pad / 2, x + sp.pad / 2, mid + sp.pad / 2, 4)));
    out = simp(Off(Off(U(out.concat(pads)), 1.5), -1.5));
    out = [out.reduce((a, q) => !a || Math.abs(T.polysArea([q])) > Math.abs(T.polysArea([a])) ? q : a, null)].map(q => ({ outer: q.outer, holes: [] })); // one piece, no holes
    return { outline: out, sw: xs.map(x => [x, mid]), mid, warnings, letters: all };
  }
  // logo / photo body: either a clicker-shaped pad around the design, or a body that follows the outline
  function outlineOfImage(G, o) {
    const all = U(G.flatMap(g => g.polys)), b = bb(all), h = o.faceH || o.letterH, sp = SPEC, warnings = [];
    if (!all.length || !isFinite(b.x0)) {
      const mid0 = h * 0.5;
      return { outline: [square(0, mid0, sp.pad, 4)], sw: [[0, mid0]], mid: mid0, warnings: ['Upload a logo or photo (PNG, JPG or SVG). A simple dark shape on a light or clear background traces best.'], letters: [] };
    }
    const mid = (b.y0 + b.y1) / 2;
    const grow = Math.max(0, +o.outlineOffset || 0) + (o.body === 'follow' ? 1.2 : 1.6);
    let out = o.body === 'follow' ? Off(all.map(q => ({ outer: q.outer, holes: [] })), grow)
      : Off(U(Off(all, grow).concat([P(T.roundRect(b.x0 + Math.min(h * 0.08, (b.x1 - b.x0) * 0.08), mid - h * 0.2, b.x1 - Math.min(h * 0.08, (b.x1 - b.x0) * 0.08), mid + h * 0.2, h * 0.18))])), 0);
    const ob = bb(out), W = ob.x1 - ob.x0; let n = o.switches;
    while (n > 1 && W / n < sp.pad + 2) n--;
    if (n < o.switches) warnings.push(`This design is too narrow for ${o.switches} switches, so it uses ${n}. Make the design bigger for more.`);
    const xs = []; for (let i = 0; i < n; i++) xs.push(ob.x0 + W * (i + 0.5) / n);
    const pads = xs.map(x => P(T.roundRect(x - sp.pad / 2, mid - sp.pad / 2, x + sp.pad / 2, mid + sp.pad / 2, 4)));
    out = simp(Off(Off(U(out.concat(pads)), 1.5), -1.5));
    out = [out.reduce((a, q) => !a || Math.abs(T.polysArea([q])) > Math.abs(T.polysArea([a])) ? q : a, null)].filter(Boolean).map(q => ({ outer: q.outer, holes: [] }));
    const pts = (o.image || []).reduce((s, q) => s + q.outer.length + q.holes.reduce((t, hh) => t + hh.length, 0), 0);
    if ((o.image && o.image.length > 24) || pts > 2500) warnings.push('This image traced into a lot of small shapes. Raise the minimum feature size or try photo silhouette for a cleaner, stronger print.');
    return { outline: out, sw: xs.map(x => [x, mid]), mid, warnings, letters: all };
  }
  function loopPolys(outline, mid, where) {
    if (where === 'none') return null;
    const b = bb(outline), sp = SPEC; let c;
    if (where === 'right') c = [b.x1 + sp.loopR - 3.2, mid];
    else if (where === 'top') { const x = b.x0 + sp.loopR + 2; let yTop = mid; for (const q of outline) for (const p of q.outer) if (Math.abs(p[0] - x) < 1.2) yTop = Math.max(yTop, p[1]); c = [x, yTop + sp.loopR - 3.2]; }
    else c = [b.x0 - sp.loopR + 3.2, mid];
    return { c, ring: P(circle(c[0], c[1], sp.loopR, 40)), hole: P(circle(c[0], c[1], sp.loopHole, 28)) };
  }
  // place the keyring on the outline and grow a short stem until the ring and the body are one piece
  function attachLoop(outline, mid, where) {
    if (where === 'none') return null;
    const b = bb(outline), sp = SPEC;
    let dirx = -1, diry = 0; if (where === 'right') { dirx = 1; diry = 0; } else if (where === 'top') { dirx = 0; diry = 1; }
    let target = [where === 'right' ? b.x1 : where === 'top' ? b.x0 + sp.loopR + 2 : b.x0, mid], best = -Infinity;
    for (const q of outline) for (const p of q.outer) {
      const along = p[0] * dirx + p[1] * diry;
      const pref = where === 'top' ? -Math.abs(p[0] - (b.x0 + Math.min(sp.loopR + 2, (b.x1 - b.x0) * 0.25))) : -Math.abs(p[1] - mid) * 0.3;
      if (along + pref > best) { best = along + pref; target = p; }
    }
    const make = stem => {
      const c = [target[0] + dirx * (sp.loopR - 3.2), target[1] + diry * (sp.loopR - 3.2)];
      const ix = target[0] - dirx * stem, iy = target[1] - diry * stem;
      const rings = U([P(circle(c[0], c[1], sp.loopR, 40))].concat(capsulePolys(c[0], c[1], ix, iy, 3.4)));
      return { c, ring: rings[0] || P(circle(c[0], c[1], sp.loopR, 40)), hole: P(circle(c[0], c[1], sp.loopHole, 28)) };
    };
    let loop = make(5);
    for (let stem = 5; stem <= 28; stem += 3) {
      loop = make(stem);
      if (U(outline.concat([loop.ring])).length === 1) break;
    }
    return loop;
  }
  const square = (x, y, w, r) => P(T.roundRect(x - w / 2, y - w / 2, x + w / 2, y + w / 2, r));
  function cross(x, y, fit) { // the stem socket: a plus, X arms thicker than Y arms (mirrored into the cap frame by the caller)
    const sp = SPEC, w = sp.crossW + fit, ax = sp.armX + fit, ay = sp.armY + fit;
    return U([P(T.roundRect(x - w / 2, y - ax / 2, x + w / 2, y + ax / 2, 0)), P(T.roundRect(x - ay / 2, y - w / 2, x + ay / 2, y + w / 2, 0))]);
  }

  // ---------------------------------------------------------------- 3D parts
  function basePart(outline, sw, loop, fit) {
    const sp = SPEC, z = [0, sp.floor, sp.floor + sp.pinH, sp.floor + sp.pinH + sp.housingH, sp.plateTop, sp.baseH];
    const holes = [[], sw.map(([x, y]) => square(x, y, sp.pinW, 1.5)), sw.map(([x, y]) => square(x, y, sp.housingW, 0.6)), sw.map(([x, y]) => square(x, y, sp.plate + fit, 0.25)), sw.map(([x, y]) => square(x, y, sp.collarW, 1.0))];
    const cuts = loop ? [...new Set(z.concat([sp.loopH]))].sort((a, b) => a - b) : z, layers = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const z0 = cuts[i], z1 = cuts[i + 1], zm = (z0 + z1) / 2; let k = 0; while (k + 1 < z.length - 1 && zm > z[k + 1]) k++;
      let polys = loop && z1 <= sp.loopH + 1e-9 ? Dff(U(outline.concat([loop.ring])), [loop.hole]) : outline;
      polys = Dff(polys, holes[k].length ? U(holes[k]) : []);
      layers.push({ z0, z1, polys });
    }
    return stack(layers);
  }
  // cap in its print frame: face down on the bed, x mirrored. Returns the body and one solid per letter (color group)
  function capParts(outline, sw, G, fit, colorOf) {
    const sp = SPEC, M = mirrorX, O = M(outline), inner = Off(O, -1.2);
    // letters: later letters win where neighbors overlap, each kept inside the outline
    const L = G.map(g => I(M(g.polys), inner)); for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) L[i] = Dff(L[i], L[j]);
    const lettersAll = U(L.flat()), bosses = sw.map(([x, y]) => P(circle(-x, y, sp.bossD / 2, 36))), crosses = U(sw.flatMap(([x, y]) => cross(-x, y, fit)));
    const z0 = sp.capT, zs = sp.capT + sp.bossL - sp.socketDepth, z1 = sp.capT + sp.bossL;
    const body = stack([{ z0: 0, z1: sp.inlay, polys: Dff(O, lettersAll) }, { z0: sp.inlay, z1: z0, polys: O }, { z0, z1: zs, polys: U(bosses) }, { z0: zs, z1, polys: Dff(U(bosses), crosses) }]);
    const groups = new Map(); L.forEach((ps, i) => { if (!ps.length) return; const c = colorOf(i, G[i]); if (!groups.has(c)) groups.set(c, []); groups.get(c).push(...ps); });
    const letters = [...groups].map(([color, ps]) => ({ color, p: stack([{ z0: 0, z1: sp.inlay, polys: ps }]) }));
    return { body, letters, lettersArea: T.polysArea(lettersAll) };
  }
  const OVERLAP = 0.02;
  function stack(layers) {
    // Each layer is its own closed prism, overlapping the one above by a hair, so every shell is watertight by
    // construction; slicers merge the overlapping shells of one object into a single solid.
    const L = layers.filter(l => l.z1 > l.z0 + 1e-9).map(l => ({ z0: l.z0, z1: l.z1, polys: U(l.polys) })).filter(l => l.polys.length);
    const zTop = L.reduce((m, l) => Math.max(m, l.z1), -Infinity), out = [];
    for (const l of L) { const top = l.z1 < zTop - 1e-9 ? l.z1 + OVERLAP : l.z1; let m = T.extrude(l.polys, 2, l.z0, top);
      // hairline slivers and pinch points (letters kissing each other) can trip the triangulator: open them away
      for (const e of [0.03, 0.06, 0.1]) { if (Core.checkClosed(m).closed) break; m = T.extrude(T.offset(T.offset(l.polys, -e), e), 2, l.z0, top); }
      for (let i = 0; i < m.length; i++) out.push(m[i]); }
    return Float64Array.from(out);
  }

  function moveP(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  // the cap turned right side up over its base, at rest (two mirrors: x back and z flipped, so the winding holds)
  function capAssembled(p) { const top = SPEC.capUnder + SPEC.capT + SPEC.bossL, q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = -p[i]; q[i + 1] = p[i + 1]; q[i + 2] = top - p[i + 2]; } return q; }

  function oneClicker(label, G, o, idx) {
    const shape = outlineOf(G, o), loop = o.source === 'image' ? attachLoop(shape.outline, shape.mid, o.loop) : loopPolys(shape.outline, shape.mid, o.loop);
    const capColor = o.colors.cap || o.colors.base, letterColor = i => o.rainbow && o.source !== 'image' ? RAINBOW[i % RAINBOW.length] : ((o.letterColors && o.letterColors[i]) || o.colors.letters);
    const base = basePart(shape.outline, shape.sw, loop, o.fit), cap = capParts(shape.outline, shape.sw, G, o.fit, i => letterColor(i));
    const inlay = o.source === 'image' ? 'Design' : 'Letters';
    const parts = [{ obj: `base${idx}`, role: 'base', kind: 'base', name: `Base ${label}`, color: o.colors.base, p: base },
      { obj: `cap${idx}`, role: 'cap', kind: 'cap', name: `Cap ${label}`, color: capColor, p: cap.body }];
    cap.letters.forEach((l, k) => parts.push({ obj: `cap${idx}`, role: 'letters', kind: 'letters', name: `${inlay} ${label}${cap.letters.length > 1 ? ' ' + (k + 1) : ''}`, color: l.color, p: l.p }));
    const b = bb(shape.outline.concat(loop ? [loop.ring] : []));
    return { name: label, parts, sw: shape.sw, warnings: shape.warnings, size: [b.x1 - b.x0, b.y1 - b.y0], switches: shape.sw.length, glyphs: G.length, loop, outline: shape.outline, mid: shape.mid, design: shape.letters };
  }
  function oneName(name, o, idx) { return oneClicker(name, glyphs(name, o), o, idx); }
  function imageLabel(o) { const n = String(o.imageName || 'Logo').replace(/\.[^.\/]+$/, '').trim(); return n || 'Logo'; }
  function oneImage(o, idx) {
    let polys = o.image;
    if ((!polys || !polys.length) && o.gray && o.w) polys = traceImage(o.gray, o.w, o.h, o, o.alpha);
    const G = imageGlyphs(polys || [], o);
    return oneClicker(imageLabel(o), G, { ...o, image: polys || [] }, idx);
  }
  function fitTestParts(o) {
    const sp = SPEC, sq = [square(0, 0, sp.pad, 4)], sw = [[0, 0]];
    const base = basePart(sq, sw, null, o.fit), cap = capParts(sq, sw, [], o.fit, () => o.colors.letters);
    return [{ obj: 'fitbase', role: 'base', kind: 'base', name: 'Fit test base', color: o.colors.base, p: base }, { obj: 'fitcap', role: 'cap', kind: 'cap', name: 'Fit test cap', color: o.colors.cap || o.colors.base, p: cap.body }];
  }
  // shelf packing over plates; the fit test gets the first plate to itself
  function arrange(items, bed, gap) {
    const W = bed[0] - 2 * gap, D = bed[1] - 2 * gap, pos = []; let x = 0, y = 0, rowH = 0, plate = 0, prev = null;
    for (const it of items) {
      if (prev !== null && it.group !== prev) { plate++; x = 0; y = 0; rowH = 0; } prev = it.group;
      if (x > 0 && x + it.w > W) { x = 0; y += rowH + gap; rowH = 0; }
      if (y > 0 && y + it.h > D) { plate++; x = 0; y = 0; rowH = 0; }
      pos.push({ x: gap + x, y: bed[1] - gap - y - it.h, plate }); x += it.w + gap; rowH = Math.max(rowH, it.h);
    }
    return pos;
  }

  function build(raw) {
    const o = options(raw), warnings = [];
    let names, tags;
    if (o.source === 'image') {
      if ((!o.image || !o.image.length) && !(o.gray && o.w)) warnings.push('Upload a logo or photo (PNG, JPG or SVG). A simple dark shape on a light or clear background traces best.');
      tags = [oneImage(o, 0)]; names = [tags[0].name];
    } else {
      const parsed = parseNames(o.names, o.batch, o.font);
      names = parsed.names.length ? parsed.names : ['Name'];
      if (!parsed.names.length) warnings.push('Type a name (letters and numbers).');
      if (parsed.dropped.length) warnings.push(`Left out ${parsed.dropped.map(c => `"${c}"`).join(', ')}: this font doesn't have ${parsed.dropped.length > 1 ? 'those characters' : 'that character'}.`);
      const long = String(o.names || '').split(/\r?\n/).filter(s => letterCount(s) > LIMITS.maxChars); if (long.length) warnings.push(`Names are up to ${LIMITS.maxChars} letters, so the extra letters were left out.`);
      tags = names.map((n, i) => oneName(n, o, i));
    }
    for (const t of tags) for (const w of t.warnings) if (!warnings.includes(w)) warnings.push(w);
    const parts = []; for (const t of tags) parts.push(...t.parts);
    if (o.fitTest) parts.push(...fitTestParts(o));
    // layout: one item per object (base, or cap with its letters)
    const objs = [...new Set(parts.map(q => q.obj))].map(id => { const ps = parts.filter(q => q.obj === id), b = Core.bbox(T.concat(ps.map(q => q.p))); return { id, b, w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], group: /^fit/.test(id) ? 0 : 1 }; });
    objs.sort((a, b) => a.group - b.group);
    const pos = arrange(objs, o.bed, o.gap), at = new Map(objs.map((it, i) => [it.id, { it, ps: pos[i] }]));
    const big = objs.filter(it => it.w > o.bed[0] - 2 * o.gap || it.h > o.bed[1] - 2 * o.gap);
    if (big.length) { const nm = [...new Set(big.map(it => /^fit/.test(it.id) ? '' : names[+it.id.replace(/\D/g, '')]).filter(Boolean))]; warnings.push(`${nm.length ? nm.map(n => `"${n}"`).join(', ') + (nm.length > 1 ? ' are' : ' is') : 'A part is'} longer than your build plate. Make the letters smaller or pick a bigger printer.`); }
    const placedParts = parts.map(q => { const { it, ps } = at.get(q.obj); return { ...q, plate: ps.plate, p: moveP(q.p, ps.x - it.b.min[0], ps.y - it.b.min[1], -it.b.min[2]) }; });
    const plates = Math.max(...pos.map(p => p.plate)) + 1;
    const colors = []; for (const q of parts) if (!colors.includes(q.color)) colors.push(q.color);
    const t0 = tags[0];
    const stats = { names: names.length, letters: letterCount(names.join('')), switches: tags.reduce((s, t) => s + t.switches, 0), switchesPerName: t0.switches, plates, colors: colors.length,
      size: t0.size, height: SPEC.capUnder + SPEC.capT, restGap: SPEC.restGap, travelGap: SPEC.restGap - SPEC.travel, baseH: SPEC.baseH,
      plateHole: SPEC.plate + o.fit, font: o.font, source: o.source, body: o.body, imageMode: o.imageMode, tris: parts.reduce((s, q) => s + q.p.length / 9, 0) };
    return { options: o, names, tags, parts: placedParts, raw: parts, plates, colors, stats, warnings };
  }
  // the filament list: base, cap (when different), then letter colors, in order of first use
  function filaments(res) { return res.colors.map(c => ({ color: c, role: res.parts.filter(q => q.color === c).map(q => q.role).filter((v, i, a) => a.indexOf(v) === i).join(' + ') })); }
  // preview: 'assembled' (cap over base at rest, names side by side) or 'print' (as laid out on the plates)
  function scene(res, view) {
    if (view === 'print') { // each plate's parts as laid out, plates side by side with only a small gap (Build plate shows the real beds)
      const out = []; let x = 0;
      for (let k = 0; k < res.plates; k++) { const ps = res.parts.filter(q => (q.plate || 0) === k); if (!ps.length) continue; const b = Core.bbox(T.concat(ps.map(q => q.p)));
        for (const q of ps) out.push({ name: q.name, kind: q.kind, color: q.color, p: Float32Array.from(moveP(q.p, x - b.min[0], -b.min[1], 0)) }); x += b.max[0] - b.min[0] + 15; }
      return out;
    }
    const out = []; let x = 0;
    res.tags.forEach((t, i) => {
      const ps = res.raw.filter(q => q.obj === `base${i}` || q.obj === `cap${i}`);
      const W = ps.map(q => q.role === 'base' ? q.p : capAssembled(q.p)), b = Core.bbox(T.concat(W));
      ps.forEach((q, k) => out.push({ name: q.name, kind: q.kind, color: q.color, p: Float32Array.from(moveP(W[k], x - b.min[0], -(b.min[1] + b.max[1]) / 2 - i * 0, 0)) }));
      x += b.max[0] - b.min[0] + 12;
    });
    return out;
  }
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  function objectName(res, id) { if (id === 'fitbase') return 'Fit test base'; if (id === 'fitcap') return 'Fit test cap'; const i = +id.replace(/\D/g, ''), n = res.names[i]; return id.startsWith('base') ? `${n} base` : `${n} cap`; }
  function export3MF(res, o) {
    o = o || {}; const bed = res.options.bed, n = res.plates, cols = res.colors, objects = [], plates = Array.from({ length: n }, () => []);
    for (const id of [...new Set(res.parts.map(q => q.obj))]) {
      const ps = res.parts.filter(q => q.obj === id), org = T.bambuPlateOrigin(ps[0].plate, n, bed[0], bed[1]);
      plates[ps[0].plate].push(objects.length);
      const mk = q => ({ name: q.role === 'letters' ? (/^Design/.test(q.name) ? 'Design' : 'Letters') : q.role === 'cap' ? 'Cap' : 'Base', p: moveP(q.p, org[0], org[1]), color: q.color, extruder: cols.indexOf(q.color) + 1 });
      if (ps.length > 1) objects.push({ name: objectName(res, id), parts: ps.map(mk) }); else objects.push({ ...mk(ps[0]), name: objectName(res, id) });
    }
    return T.threeMF(objects, { title: o.name || (res.options.source === 'image' ? 'Logo clicker keychain' : 'Name clicker keychain'), plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function readme(res, name) {
    const s = res.stats, o = res.options, sp = SPEC, f = v => (Math.round(v * 100) / 100).toString(), img = o.source === 'image';
    const L = [`Expressarte ${img ? 'logo' : 'name'} clicker keychain: ${name}`, ''];
    if (img) L.push(`${res.names[0]} \u00b7 ${IMAGE_MODES[o.imageMode] || 'Logo'} \u00b7 ${BODIES[o.body] || 'Clicker body'} \u00b7 ${s.switchesPerName} switch${s.switchesPerName > 1 ? 'es' : ''}${o.charm !== 'none' ? ` \u00b7 ${CHARMS[o.charm].toLowerCase()} on the end` : ''}`);
    else L.push(`${s.names === 1 ? `Name: ${res.names[0]}` : `${s.names} names: ${res.names.join(', ')}`} \u00b7 ${FONTS[o.font].label} font \u00b7 ${s.switchesPerName} switch${s.switchesPerName > 1 ? 'es' : ''} each${o.charm !== 'none' ? ` \u00b7 ${CHARMS[o.charm].toLowerCase()} on the end` : ''}`);
    L.push(`About ${Math.round(s.size[0])} \u00d7 ${Math.round(s.size[1])} mm and ${f(s.height)} mm tall with the switch in. ${s.plates} build plate${s.plates > 1 ? 's' : ''}${o.fitTest ? ' (plate 1 is the fit test)' : ''}.`);
    L.push('', 'You also need', `  - ${s.switches} standard mechanical keyboard switch${s.switches > 1 ? 'es' : ''} with a cross stem (3- or 5-pin, plate-mount size; clicky ones click loudest). They are not printed.`, '  - A keyring or a lobster clasp for the loop (optional).');
    L.push('', 'Filament slots in the 3MF'); filaments(res).forEach((x, i) => L.push(`  ${i + 1}: ${x.color}  ${x.role}`));
    L.push('', 'Print first: the fit test', `  Print the small fit test base and cap (plate 1). The switch should click into the base and hold; the cap should push onto the stem snugly. The fit tolerance is ${f(o.fit)} mm (plate hole ${f(sp.plate + o.fit)} mm, stem socket ${f(sp.crossW + o.fit)} mm across). Too tight: raise it by 0.05 mm. Too loose: lower it by 0.05 mm.`);
    L.push('', 'Printing', '  - Base: print upright, as laid out. 0.2 mm layers, 3 walls, 15% infill, no supports.',
      '  - Cap: print face down, as laid out (' + (img ? 'the design is' : 'the name is') + ' in the first layers, so the top comes out flat and smooth). The 3MF has the ' + (img ? 'design as its own part on its own filament' : 'letters as their own parts on their own filaments') + '.',
      '  - PLA or PETG both work.');
    L.push('', 'Putting it together', '  1. Push each switch into its pocket in the base from the top, pins first, until the clips snap under the plate.', '  2. Line the cap up over the base and press it straight down onto the switch stems.', `  3. At rest the cap floats ${f(sp.restGap)} mm above the base and travels ${f(sp.travel)} mm when you press it.`, '  4. Add a keyring through the loop.');
    L.push('', 'Safety', '  Small parts: not for children under 3. Keep switches and keyrings away from small children.');
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, o) {
    o = o || {}; const name = o.name || (res.options.source === 'image' ? 'Logo clicker keychain' : 'Name clicker keychain'), base = safe(o.fileBase || name.toLowerCase()) || (res.options.source === 'image' ? 'logo_clicker' : 'name_clicker');
    const list = [{ name: `${base}.3mf`, data: export3MF(res, o) }], seen = new Set();
    for (const id of [...new Set(res.raw.map(q => q.obj))]) {
      const ps = res.raw.filter(q => q.obj === id);
      for (const q of ps) { let nm = safe((q.role === 'letters' ? q.name : objectName(res, id)).toLowerCase()); while (seen.has(nm)) nm += '_'; seen.add(nm); list.push({ name: `stl/${nm}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }); }
    }
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }
  // what an export uses beyond the free tier (for the paywall request)
  function proNeeds(res) {
    const o = res.options, n = res.names.length, img = o.source === 'image';
    return { tool: 'clicker', count: n, colors: res.colors.length, font: o.font, fontLabel: FONTS[o.font].label, extraFont: !img && FONTS[o.font].pro, batch: n > 1, source: o.source };
  }

  const api = { SPEC, FONTS, LOOPS, CHARMS, SOURCES, IMAGE_MODES, BODIES, PALETTE, RAINBOW, LIMITS, DEFAULTS, options, parseNames, glyphs, imageGlyphs, imageGray, traceImage, dropEdgeBackground, fitPolys, outlineOf, attachLoop, loopPolys, build, scene, filaments, export3MF, files, readme, proNeeds, letterCount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPClicker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
