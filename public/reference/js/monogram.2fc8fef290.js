/* Expressarte monograms: 1 to 3 initials laid out in a classic monogram style, with an optional frame, as flat 2D
   polygons ({ outer, holes } loops, mm, y up, reading the right way round, centered on 0,0).

   Initials are typed first, middle, last. The classic order puts the last-name initial large in the middle
   (first, LAST, middle); the straight order keeps them left to right as typed.

   Lettering comes from SIL OFL 1.1 fonts already outlined into the app: src/monogram-fonts.js (Playfair Display,
   Great Vibes, Cinzel, Montserrat) and src/stamp-fonts.js (Alfa Slab One). */
(function (G) {
  'use strict';
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const MF = G.GPMonogramFonts || (typeof require === 'function' ? require('./monogram-fonts.js') : null);
  const SF = G.GPStampFonts || (typeof require === 'function' ? require('./stamp-fonts.js') : null);
  const CL = G.ClipperLib || (typeof require === 'function' ? require('clipper-lib') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;

  // style -> font, default frame, label (English; the UI translates)
  const STYLES = {
    circle: { label: 'Classic circle', font: ['mf', 'roman'], frame: 'circle', pro: false, note: 'Interlocking letters shaped into a circle, the middle one largest' },
    vine: { label: 'Script vine', font: ['mf', 'script'], frame: 'none', pro: true, note: 'Flowing script capitals with a curling vine' },
    block: { label: 'Block serif', font: ['sf', 'slab'], frame: 'none', pro: false, note: 'Heavy serif capitals, the middle one largest' },
    sans: { label: 'Modern sans', font: ['mf', 'sans'], frame: 'none', pro: false, note: 'Clean bold capitals' },
    diamond: { label: 'Diamond fishtail', font: ['mf', 'sans'], frame: 'diamond', pro: false, note: 'Letters shaped into a diamond with fishtail points' },
    stacked: { label: 'Stacked', font: ['mf', 'serif'], frame: 'none', pro: false, note: 'A large last initial beside the first and middle, stacked' }
  };
  const FRAMES = { auto: 'Style default', none: 'No frame', circle: 'Circle', diamond: 'Diamond', scalloped: 'Scalloped', laurel: 'Laurel' };
  const ORDERS = { classic: 'Classic (first, LAST, middle)', straight: 'Left to right' };
  const LETTERS = /[A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc]/;

  // cleans what was typed into up to 3 capital letters
  function cleanInitials(s) {
    const up = String(s == null ? '' : s).toLocaleUpperCase('en-US');
    return [...up].filter(ch => LETTERS.test(ch)).slice(0, 3).join('');
  }
  // the letters in display order, and which one (if any) is the large center letter
  function arrange(initials, order) {
    const L = [...cleanInitials(initials)];
    if (L.length === 3 && order !== 'straight') return { letters: [L[0], L[2], L[1]], big: 1, classic: true };
    return { letters: L, big: -1, classic: false };
  }

  // ---------------------------------------------------------------- glyphs (cap height 1, baseline 0)
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
  const fontOf = style => { const [src, id] = STYLES[style].font; const F = src === 'sf' ? SF : MF; return F && F[id] ? F[id] : null; };
  const GC = new Map();
  function glyph(style, ch) {
    const key = style + '|' + ch; if (GC.has(key)) return GC.get(key);
    const F = fontOf(style); let g = null;
    let e = F && F.glyphs[ch];
    if (!e && F) { const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); e = F.glyphs[base]; }
    if (e && e[2]) e = F.glyphs[e[2]] ? [e[0], F.glyphs[e[2]][1] + e[1]] : null; // accented letter stored as base + accent
    if (e) {
      const s = 1 / F.cap, polys = T.unionPolys(parsePath(e[1], s, 0.002).map(L => ({ outer: L, holes: [] })), 'nonzero');
      if (polys.length) g = { polys, adv: e[0] * s, b: T.polysBBox(polys) };
    }
    GC.set(key, g); return g;
  }
  const supported = (style, ch) => !!glyph(style, ch);

  // ---------------------------------------------------------------- 2D helpers
  const tf = (ps, f) => ps.map(Q => ({ outer: Q.outer.map(f), holes: Q.holes.map(h => h.map(f)) }));
  const bb = ps => T.polysBBox(ps);
  const U = ps => T.unionPolys(ps, 'nonzero');
  const P = L => ({ outer: L, holes: [] });
  function densify(ps, maxLen) {
    const d = L => { const out = []; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / maxLen)); for (let k = 0; k < n; k++) out.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]); } return out; };
    return ps.map(Q => ({ outer: d(Q.outer), holes: Q.holes.map(d) }));
  }
  // glyph scaled so its cap height is h, its ink box centered on (cx, cy)
  function placeCap(g, h, cx, cy) {
    const b = g.b, mx = (b.x0 + b.x1) / 2;
    return tf(g.polys, p => [cx + (p[0] - mx) * h, cy + (p[1] - 0.5) * h]);
  }
  // glyph stretched to fill the box [x0, x1] \u00d7 [y0, y1] (ink box)
  function fillBox(g, x0, x1, y0, y1) {
    const b = g.b, sx = (x1 - x0) / Math.max(1e-6, b.w), sy = (y1 - y0) / Math.max(1e-6, b.h);
    return tf(g.polys, p => [x0 + (p[0] - b.x0) * sx, y0 + (p[1] - b.y0) * sy]);
  }
  // thick strokes along open polylines
  function strokes(lines, width) {
    const S = 10000, co = new CL.ClipperOffset(2, 0.002 * S), sol = new CL.Paths();
    for (const pl of lines) if (pl.length > 1) co.AddPath(pl.map(p => ({ X: Math.round(p[0] * S), Y: Math.round(p[1] * S) })), CL.JoinType.jtRound, CL.EndType.etOpenRound);
    co.Execute(sol, width / 2 * S);
    return U(sol.map(path => P(path.map(q => [q.X / S, q.Y / S]))).filter(Q => Q.outer.length > 2));
  }
  const leaf = (cx, cy, ang, len, wid) => { const L = []; for (let i = 0; i < 28; i++) { const t = i / 28 * TAU, x = Math.cos(t) * len / 2, y = Math.sin(t) * wid / 2 * (1 - 0.35 * Math.cos(t)); L.push([cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)]); } return P(L); };

  // ---------------------------------------------------------------- layouts (cap height about 1)
  // a row of letters at the given cap heights, centered vertically, ink boxes spaced by gap
  function row(style, letters, heights, gap) {
    const gs = letters.map(ch => glyph(style, ch)), out = []; let x = 0;
    gs.forEach((g, i) => { if (!g) return; const w = g.b.w * heights[i]; out.push(...placeCap(g, heights[i], x + w / 2, 0)); x += w + gap; });
    return U(out);
  }
  // letters warped into a silhouette: profile(xn) gives the half height at xn in [-1, 1] (fraction of H)
  function warped(style, letters, big, R, H, mid, profile) {
    const n = letters.length, gs = letters.map(ch => glyph(style, ch));
    if (!gs.some(Boolean)) return [];
    let cols;
    if (n === 1) cols = [[-R * 0.62, R * 0.62]];
    else if (n === 2) cols = [[-R, 0.02 * R], [-0.02 * R, R]];
    else { const wm = mid * R; cols = [[-R, -wm / 2 + 0.03 * R], [-wm / 2, wm / 2], [wm / 2 - 0.03 * R, R]]; }
    const out = [];
    gs.forEach((g, i) => {
      if (!g) return;
      const [x0, x1] = cols[i];
      let ps = fillBox(g, x0, x1, -H, H);
      ps = densify(ps, R / 90);
      out.push(...tf(ps, p => [p[0], p[1] * profile(p[0] / R)]));
    });
    return U(out);
  }
  function vineLines(b) {
    // a curling vine under the letters, a tendril curling up at each end, with leaves
    const w = b.w, yb = b.y0 - 0.06, cx = (b.x0 + b.x1) / 2, half = w / 2 + 0.12, lines = [], leaves = [];
    for (const s of [-1, 1]) {
      const L = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40, x = cx + s * half * t, y = yb - 0.08 * Math.sin(t * Math.PI) + 0.04 * Math.sin(t * TAU * 1.5); L.push([x, y]); }
      // end curl
      const e = L[L.length - 1];
      for (let i = 1; i <= 26; i++) { const t = i / 26, a = -Math.PI / 2 + s * 0 + t * Math.PI * 1.6, r = 0.16 * (1 - t * 0.7); L.push([e[0] + s * (r * Math.cos(a) * -1 + 0), e[1] + 0.16 + r * Math.sin(a)]); }
      lines.push(L);
      for (const t of [0.3, 0.55, 0.8]) { const i = Math.round(t * 40), p = L[i], q = L[i + 1], ang = Math.atan2(q[1] - p[1], q[0] - p[0]), up = (Math.round(t * 10) % 2) ? 1 : -1; leaves.push(leaf(p[0] + s * 0.02, p[1] + up * 0.07, ang + s * up * 0.7, 0.2, 0.08)); }
    }
    return U([...strokes(lines, 0.05), ...leaves]);
  }
  function letterLayout(style, initials, order) {
    const A = arrange(initials, order), L = A.letters, n = L.length;
    if (!n) return { polys: [], arr: A };
    let polys;
    if (style === 'circle') {
      polys = n === 1 ? row(style, L, [1], 0) : warped(style, L, A.big, 1, 1, A.classic ? 0.74 : 0.66, xn => Math.max(0.3, Math.sqrt(Math.max(0, 1 - xn * xn))));
    } else if (style === 'diamond') {
      polys = n === 1 ? row(style, L, [1], 0) : warped(style, L, A.big, 1, 0.62, 0.6, xn => Math.max(0.16, 1 - Math.abs(xn)));
    } else if (style === 'stacked') {
      if (n === 3 && A.classic) {
        const gBig = glyph(style, L[1]), gA = glyph(style, L[0]), gB = glyph(style, L[2]), out = [];
        const wb = gBig ? gBig.b.w : 0.7; if (gBig) out.push(...placeCap(gBig, 1, wb / 2, 0));
        const sh = 0.45, xs = wb + 0.1;
        const wSmall = Math.max(gA ? gA.b.w : 0, gB ? gB.b.w : 0) * sh;
        if (gA) out.push(...placeCap(gA, sh, xs + wSmall / 2, 0.5 - sh / 2));
        if (gB) out.push(...placeCap(gB, sh, xs + wSmall / 2, -0.5 + sh / 2));
        polys = U(out);
      } else {
        const out = []; L.forEach((ch, i) => { const g = glyph(style, ch); if (g) out.push(...placeCap(g, 1, 0, -i * 1.18)); }); polys = U(out);
      }
    } else if (style === 'vine') {
      const hs = A.classic ? [0.72, 1, 0.72] : L.map(() => 1);
      polys = row(style, L, hs, -0.1);
      if (polys.length) polys = U([...polys, ...vineLines(bb(polys))]);
    } else if (style === 'block') {
      polys = row(style, L, A.classic ? [0.7, 1, 0.7] : L.map(() => 1), A.classic ? 0.05 : 0.1);
    } else { // sans
      polys = row(style, L, A.classic ? [0.62, 1, 0.62] : L.map(() => 1), A.classic ? 0.1 : 0.2);
    }
    if (!polys.length) return { polys: [], arr: A };
    const b = bb(polys), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    return { polys: tf(polys, p => [p[0] - cx, p[1] - cy]), arr: A };
  }

  // ---------------------------------------------------------------- frames (around letters centered on 0,0)
  function frameFor(kind, polys, style) {
    if (kind === 'none' || !polys.length) return [];
    const b = bb(polys), S = Math.max(b.w, b.h), w = 0.07 * S, gap = 0.08 * S;
    let rMax = 0; for (const Q of polys) for (const p of Q.outer) rMax = Math.max(rMax, Math.hypot(p[0], p[1]));
    const ring = (r0, r1, n) => { n = n || 160; const o = [], h = []; for (let i = 0; i < n; i++) { const t = TAU * i / n; o.push([r1 * Math.cos(t), r1 * Math.sin(t)]); h.push([r0 * Math.cos(t), r0 * Math.sin(t)]); } return [{ outer: o, holes: [h.reverse()] }]; };
    if (kind === 'circle') { const r0 = rMax + gap; return ring(r0, r0 + w); }
    if (kind === 'scalloped') {
      const r0 = rMax + gap, ro = r0 + w * 0.8, a = w * 1.1, N = Math.max(12, Math.round(TAU * ro / (S * 0.16))), o = [], h = [];
      for (let i = 0; i < 480; i++) { const t = TAU * i / 480, r = ro + a * Math.abs(Math.sin(N * t / 2)); o.push([r * Math.cos(t), r * Math.sin(t)]); }
      for (let i = 0; i < 160; i++) { const t = TAU * i / 160; h.push([r0 * Math.cos(t), r0 * Math.sin(t)]); }
      // a fine inner line too
      return U([{ outer: o, holes: [h.reverse()] }, ...ring(r0 - gap * 0.75 - w * 0.45, r0 - gap * 0.75)].filter(Q => Q.outer.length));
    }
    if (kind === 'diamond') {
      const k = style === 'diamond' ? 0.62 : 1; let A = 0;
      for (const Q of polys) for (const p of Q.outer) A = Math.max(A, Math.abs(p[0]) + Math.abs(p[1]) / k);
      A += style === 'diamond' ? gap * 0.7 : gap * 1.6;
      const inner = [[A, 0], [0, A * k], [-A, 0], [0, -A * k]];
      const outer = T.offset([P(inner)], w, false);
      return T.diffPolys(outer, [P(inner)]);
    }
    if (kind === 'laurel') {
      const Rl = rMax + gap + 0.05 * S, stem = [], leaves = [], len = 0.17 * S, wid = 0.065 * S;
      for (const s of [-1, 1]) {
        const L = [];
        for (let i = 0; i <= 60; i++) { const a = -Math.PI / 2 + s * (0.1 + i / 60 * 2.15); L.push([Rl * Math.cos(a), Rl * Math.sin(a)]); }
        stem.push(L);
        for (let j = 0; j < 9; j++) {
          const a = -Math.PI / 2 + s * (0.25 + j / 8.6 * 2.0), tx = -Math.sin(a) * s, ty = Math.cos(a) * s, ang = Math.atan2(ty, tx);
          for (const side of [-1, 1]) {
            const rr = Rl + side * wid * 0.95;
            leaves.push(leaf(rr * Math.cos(a) + tx * len * 0.25, rr * Math.sin(a) + ty * len * 0.25, ang + side * s * 0.45, len, wid));
          }
        }
        leaves.push(leaf(L[60][0] + 0, L[60][1] + 0, Math.atan2(L[60][1] - L[58][1], L[60][0] - L[58][0]), len, wid));
      }
      return U([...strokes(stem, w * 0.55), ...leaves]);
    }
    return [];
  }

  // ---------------------------------------------------------------- the monogram
  // opt: { initials, order, style, frame, size (mm, the larger side), minLine (mm) }
  function build(opt) {
    opt = opt || {};
    const style = STYLES[opt.style] ? opt.style : 'circle';
    const order = opt.order === 'straight' ? 'straight' : 'classic';
    const frameKind = FRAMES[opt.frame] && opt.frame !== 'auto' ? opt.frame : STYLES[style].frame;
    const initials = cleanInitials(opt.initials);
    const dropped = [...initials].filter(ch => !supported(style, ch));
    const lay = letterLayout(style, initials, order);
    if (!lay.polys.length) return { polys: [], w: 0, h: 0, style, frame: frameKind, order, initials, letters: lay.arr.letters, dropped };
    const frame = frameFor(frameKind, lay.polys, style);
    let polys = frame.length ? U([...lay.polys, ...frame]) : lay.polys;
    if (style === 'diamond' && lay.arr.letters.length > 1) {
      // fishtail points: a swallowtail at each tip of the diamond, reaching the frame when there is one
      const b = bb(lay.polys), tip = b.x1, fish = [];
      let reach = tip * 1.14;
      if (frameKind === 'diamond') { const k = 0.62; let A = 0; for (const Q of lay.polys) for (const p of Q.outer) A = Math.max(A, Math.abs(p[0]) + Math.abs(p[1]) / k); A += 0.08 * Math.max(b.w, b.h) * 0.7; reach = A - 0.2 / k + 0.05; }
      for (const s of [-1, 1]) { const L = [[tip - 0.12, 0.09], [reach, 0.2], [tip + (reach - tip) * 0.55, 0], [reach, -0.2], [tip - 0.12, -0.09]].map(p => [s * p[0], p[1]]); fish.push(P(s < 0 ? L.reverse() : L)); }
      polys = U([...polys, ...fish]);
    }
    const b0 = bb(polys), size = clamp(+opt.size || 30, 4, 400), minLine = clamp(opt.minLine == null ? 0.35 : +opt.minLine, 0, 2);
    const s = size / Math.max(b0.w, b0.h), cx = (b0.x0 + b0.x1) / 2, cy = (b0.y0 + b0.y1) / 2;
    polys = tf(polys, p => [(p[0] - cx) * s, (p[1] - cy) * s]);
    // fatten hairlines a little so the thinnest strokes still print (a 0.4 mm nozzle)
    if (minLine > 0) { polys = T.offset(polys, minLine / 2); polys = U(polys); }
    const b = bb(polys);
    polys = tf(polys, p => [p[0] - (b.x0 + b.x1) / 2, p[1] - (b.y0 + b.y1) / 2]);
    const bf = bb(polys);
    return { polys, w: bf.w, h: bf.h, style, frame: frameKind, order, initials, letters: lay.arr.letters, big: lay.arr.big, dropped };
  }

  const api = { STYLES, FRAMES, ORDERS, cleanInitials, arrange, build, supported, glyph };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPMonogram = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
