/* Expressarte multi-color prints from graphic files.
   A logo or graphic (PNG, JPG or SVG, decoded to RGBA by the page) is reduced to a few colors, every color becomes
   its own printable part, and the parts stack on a base plate: one multi-part 3MF with an extruder per color (opens
   in your slicer with the colors already assigned) and one STL per color.

   Pipeline
   1. analyze(): k-means in CIE Lab (k-means++ seeding, fixed seed so the result is repeatable), palette sorted by
      coverage, transparent pixels kept apart, and the background (transparency, or the color that owns most of the
      image border) detected.
   2. build(): palette edits (merge, role: print / base / remove), a 3\u00d73 majority pass and a small-region pass at the
      minimum feature size clean the label map; every label gets a Gaussian-smoothed indicator field and the field
      f_l \u2212 max(other labels) is contoured at 0 with marching squares (optionally on a 2\u00d7 bilinear grid, "HD"). Two
      neighbors share one zero line, so the color regions meet without gaps; a tiny overlap plus an ordered
      difference makes them disjoint at triple points. A miter "opening" drops details thinner than the minimum
      feature size.
   3. Solids: the base plate (none = art shape, rectangle, rounded, circle, or follow outline with a margin; optional
      keychain tab and hole, optional magnet pocket from below) and the color parts, each a straight extrusion or a
      stepped solid, so every part is a closed, outward-facing mesh.
      Flat inlay: every color sits in one top layer and the base color fills the rest of it (flush top).
      Raised relief: every color stands on the plate at its own height.
   All lengths are mm; the art's long side is opt.size. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const VOID = 255;
  const DEFAULTS = {
    size: 100, plate: 'rounded', margin: 4, corner: 6, baseT: 2, mode: 'raised', layerT: 0.8, height: 1,
    smoothing: 1, hd: true, minFeature: 0.6, keychain: false, holeD: 5, magnet: false, magnetD: 10, magnetH: 3,
    baseColor: null, bed: [256, 256], bambu: 'A1'
  };
  const LIMITS = { minColors: 2, maxColors: 8, minSize: 10, maxSize: 400, minBase: 0.6, maxLong: 1400 };

  // ---------------------------------------------------------------- color helpers
  const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  const toHex = rgb => '#' + rgb.map(hex2).join('').toUpperCase();
  function parseHex(h) { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lab(r, g, b, out, o) {
    const R = LIN[r], Gc = LIN[g], B = LIN[b];
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const x = f((R * 0.4124 + Gc * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + Gc * 0.7152 + B * 0.0722), z = f((R * 0.0193 + Gc * 0.1192 + B * 0.9505) / 1.08883);
    out[o] = 116 * y - 16; out[o + 1] = 500 * (x - y); out[o + 2] = 200 * (y - z);
  }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // Relative luminance, for picking readable text on a swatch.
  function luma(hex) { const c = parseHex(hex) || [0, 0, 0]; return 0.2126 * LIN[c[0]] + 0.7152 * LIN[c[1]] + 0.0722 * LIN[c[2]]; }

  // ---------------------------------------------------------------- image prep
  // Box-filter downscale (premultiplied alpha) so the long side is at most maxLong pixels.
  function fit(img, maxLong) {
    const { w, h, data } = img, s = Math.max(w, h) / maxLong;
    if (s <= 1) return { w, h, data };
    const W = Math.max(1, Math.round(w / s)), H = Math.max(1, Math.round(h / s)), out = new Uint8ClampedArray(W * H * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x0 = Math.floor(i * w / W), x1 = Math.max(x0 + 1, Math.floor((i + 1) * w / W)), y0 = Math.floor(j * h / H), y1 = Math.max(y0 + 1, Math.floor((j + 1) * h / H));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = (y * w + x) * 4, al = data[k + 3]; r += data[k] * al; g += data[k + 1] * al; b += data[k + 2] * al; a += al; n++; }
      const o = (j * W + i) * 4; if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; } out[o + 3] = a / n;
    }
    return { w: W, h: H, data: out };
  }

  // ---------------------------------------------------------------- 1. analyze: quantize to k colors
  function analyze(img, k, opt) {
    opt = opt || {};
    k = Math.max(LIMITS.minColors, Math.min(LIMITS.maxColors, Math.round(k || 4)));
    if (!img || !img.w || !img.h || !img.data || img.data.length < img.w * img.h * 4) throw new Error('That image could not be read.');
    const src = fit(img, opt.maxLong || 1000), { w, h, data } = src, n = w * h;
    const L = new Float32Array(n * 3), opaque = new Uint8Array(n);
    let nOpaque = 0;
    for (let i = 0; i < n; i++) if (data[i * 4 + 3] >= 128) { opaque[i] = 1; nOpaque++; lab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], L, i * 3); }
    if (nOpaque < 16) throw new Error('The image is empty or fully transparent.');
    // samples: every opaque pixel, strided down to about 60k
    const stride = Math.max(1, Math.floor(nOpaque / 60000)), S = [];
    for (let i = 0, c = 0; i < n; i++) if (opaque[i] && (c++ % stride) === 0) S.push(i);
    const rand = rng(0x9e3779b9), C = new Float32Array(k * 3), D = new Float32Array(S.length).fill(Infinity);
    // k-means++ (deterministic)
    let first = S[Math.floor(rand() * S.length)];
    C.set(L.subarray(first * 3, first * 3 + 3), 0);
    let kk = 1;
    for (; kk < k; kk++) {
      let sum = 0;
      for (let s = 0; s < S.length; s++) { const i = S[s] * 3, c = (kk - 1) * 3, d = (L[i] - C[c]) ** 2 + (L[i + 1] - C[c + 1]) ** 2 + (L[i + 2] - C[c + 2]) ** 2; if (d < D[s]) D[s] = d; sum += D[s]; }
      if (sum < 1e-6) break; // fewer distinct colors than k
      let r = rand() * sum, s = 0; for (; s < S.length - 1; s++) { r -= D[s]; if (r <= 0) break; }
      C.set(L.subarray(S[s] * 3, S[s] * 3 + 3), kk * 3);
    }
    k = kk;
    const asg = new Uint8Array(S.length), acc = new Float64Array(k * 4);
    const nearest = (i3) => { let b = 0, bd = Infinity; for (let c = 0; c < k; c++) { const d = (L[i3] - C[c * 3]) ** 2 + (L[i3 + 1] - C[c * 3 + 1]) ** 2 + (L[i3 + 2] - C[c * 3 + 2]) ** 2; if (d < bd) { bd = d; b = c; } } return b; };
    for (let it = 0; it < 24; it++) {
      acc.fill(0); let moved = 0;
      for (let s = 0; s < S.length; s++) { const i3 = S[s] * 3, c = nearest(i3); if (c !== asg[s] || it === 0) moved++; asg[s] = c; acc[c * 4] += L[i3]; acc[c * 4 + 1] += L[i3 + 1]; acc[c * 4 + 2] += L[i3 + 2]; acc[c * 4 + 3]++; }
      for (let c = 0; c < k; c++) if (acc[c * 4 + 3]) for (let q = 0; q < 3; q++) C[c * 3 + q] = acc[c * 4 + q] / acc[c * 4 + 3];
      if (!moved) break;
    }
    // full assignment, mean sRGB per cluster (the swatch the user sees)
    const raw = new Uint8Array(n).fill(VOID), rgbAcc = new Float64Array(k * 4);
    for (let i = 0; i < n; i++) if (opaque[i]) { const c = nearest(i * 3); raw[i] = c; rgbAcc[c * 4] += data[i * 4]; rgbAcc[c * 4 + 1] += data[i * 4 + 1]; rgbAcc[c * 4 + 2] += data[i * 4 + 2]; rgbAcc[c * 4 + 3]++; }
    // drop empty clusters, sort by coverage
    const order = []; for (let c = 0; c < k; c++) if (rgbAcc[c * 4 + 3] > 0) order.push(c);
    order.sort((a, b) => rgbAcc[b * 4 + 3] - rgbAcc[a * 4 + 3]);
    const remap = new Uint8Array(256).fill(VOID); order.forEach((c, i) => { remap[c] = i; });
    const labels = new Uint8Array(n); for (let i = 0; i < n; i++) labels[i] = raw[i] === VOID ? VOID : remap[raw[i]];
    const palette = order.map(c => { const m = rgbAcc[c * 4 + 3]; const rgb = [rgbAcc[c * 4] / m, rgbAcc[c * 4 + 1] / m, rgbAcc[c * 4 + 2] / m]; return { rgb: rgb.map(Math.round), hex: toHex(rgb), share: m / nOpaque }; });
    // background: transparency, else the color that owns most of the border
    const transparent = n - nOpaque;
    let background = -1, bgKind = 'none';
    if (transparent > n * 0.02) bgKind = 'transparent';
    else {
      const cnt = new Map(); let tot = 0;
      const add = i => { const l = labels[i]; if (l !== VOID) { cnt.set(l, (cnt.get(l) || 0) + 1); tot++; } };
      for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x); }
      for (let y = 1; y < h - 1; y++) { add(y * w); add(y * w + w - 1); }
      let best = -1, bc = 0; for (const [l, c] of cnt) if (c > bc) { bc = c; best = l; }
      if (best >= 0 && bc >= tot * 0.6) { background = best; bgKind = 'color'; }
    }
    return { w, h, labels, palette, background, bgKind, transparent: transparent / n, rgba: data };
  }

  // Default per-color settings for an analysis: the background is removed (its color becomes the base plate).
  function defaultColors(an, o) {
    o = o || {};
    return an.palette.map((p, i) => ({ hex: p.hex, role: i === an.background ? 'remove' : 'print', merge: null, height: o.height || DEFAULTS.height }));
  }
  function defaultBase(an) {
    if (an.background >= 0) return an.palette[an.background].hex;
    // transparent art: a base that contrasts with the main color
    const main = an.palette[0] ? an.palette[0].hex : '#000000';
    return luma(main) > 0.35 ? '#1E1E1E' : '#F4F4F2';
  }

  // ---------------------------------------------------------------- 2. raster cleanup
  // groups: one per merged printed color, plus BASE (base-colored art) \u2014 VOID is outside the art.
  function groupLabels(an, colors) {
    const k = an.palette.length, root = i => { const seen = new Set(); while (colors[i] && colors[i].merge != null && colors[i].merge !== i && !seen.has(i)) { seen.add(i); i = colors[i].merge; } return i; };
    const groups = [], gOf = new Uint8Array(256).fill(VOID);
    let baseG = -1;
    for (let i = 0; i < k; i++) {
      const r = root(i), c = colors[r] || { role: 'print', hex: an.palette[r].hex };
      if (c.role === 'remove') continue;
      if (c.role === 'base') { if (baseG < 0) { baseG = groups.length; groups.push({ kind: 'base', members: [], hex: null }); } gOf[i] = baseG; groups[baseG].members.push(i); continue; }
      let g = groups.findIndex(x => x.kind === 'print' && x.root === r);
      if (g < 0) { g = groups.length; groups.push({ kind: 'print', root: r, members: [], hex: (parseHex(c.hex) ? toHex(parseHex(c.hex)) : an.palette[r].hex), height: c.height }); }
      gOf[i] = g; groups[g].members.push(i);
    }
    const lab = new Uint8Array(an.labels.length);
    for (let i = 0; i < lab.length; i++) lab[i] = an.labels[i] === VOID ? VOID : gOf[an.labels[i]];
    return { groups, lab };
  }
  function majority(lab, w, h) {
    const out = lab.slice(), cnt = new Map();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      cnt.clear(); let best = lab[y * w + x], bc = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const l = lab[(y + dy) * w + x + dx], c = (cnt.get(l) || 0) + 1; cnt.set(l, c); if (c > bc) { bc = c; best = l; } }
      if (bc >= 5) out[y * w + x] = best;
    }
    return out;
  }
  // Connected regions (4-neighbor) smaller than minPx join the label they touch most.
  function dropSmall(lab, w, h, minPx) {
    const seen = new Int32Array(w * h).fill(-1), stack = new Int32Array(w * h);
    let changed = 0;
    for (let s = 0; s < w * h; s++) {
      if (seen[s] >= 0) continue;
      const l = lab[s]; let top = 0, size = 0; stack[top++] = s; seen[s] = s; const comp = [];
      const border = new Map();
      while (top) {
        const i = stack[--top]; comp.push(i); size++;
        const x = i % w, y = (i / w) | 0;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (const j of nb) { if (j < 0) { border.set(VOID, (border.get(VOID) || 0) + 1); continue; } if (lab[j] === l) { if (seen[j] < 0) { seen[j] = s; stack[top++] = j; } } else border.set(lab[j], (border.get(lab[j]) || 0) + 1); }
      }
      if (size >= minPx || !border.size) continue;
      let best = -1, bc = -1; for (const [m, c] of border) if (c > bc) { bc = c; best = m; }
      if (l === VOID && best !== VOID) { /* a pinhole in the art: fill it */ }
      for (const i of comp) lab[i] = best; changed++;
    }
    return changed;
  }

  // ---------------------------------------------------------------- fields + marching squares
  function blur(f, W, H, sigma) {
    const r = Math.max(1, Math.ceil(sigma * 3)), kr = new Float32Array(2 * r + 1); let s = 0;
    for (let i = -r; i <= r; i++) { kr[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); s += kr[i + r]; }
    for (let i = 0; i < kr.length; i++) kr[i] /= s;
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { const o = y * W; for (let x = 0; x < W; x++) { let a = 0; for (let k = -r; k <= r; k++) { const xx = x + k < 0 ? 0 : x + k >= W ? W - 1 : x + k; a += f[o + xx] * kr[k + r]; } tmp[o + x] = a; } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0; for (let k = -r; k <= r; k++) { const yy = y + k < 0 ? 0 : y + k >= H ? H - 1 : y + k; a += tmp[yy * W + x] * kr[k + r]; } out[y * W + x] = a; }
    return out;
  }
  function upsample2(g, W, H) {
    const W2 = 2 * W - 1, H2 = 2 * H - 1, o = new Float32Array(W2 * H2);
    for (let y = 0; y < H2; y++) { const y0 = y >> 1, y1 = Math.min(H - 1, y0 + (y & 1)); for (let x = 0; x < W2; x++) { const x0 = x >> 1, x1 = Math.min(W - 1, x0 + (x & 1)); o[y * W2 + x] = (g[y0 * W + x0] + g[y0 * W + x1] + g[y1 * W + x0] + g[y1 * W + x1]) / 4; } }
    return { g: o, W: W2, H: H2 };
  }
  // Closed zero-level loops of g (inside: g > 0) in grid coordinates [x, y] (y = row). The grid border must be outside.
  function contour(g, W, H) {
    const val = i => { const v = g[i]; return v > 0 ? v : Math.min(v, -1e-7); };
    const eid = (x, y, vert) => ((y * W + x) << 1) | vert, n1 = new Int32Array(W * H * 2).fill(-1), n2 = new Int32Array(W * H * 2).fill(-1), pt = new Float64Array(W * H * 4);
    const link = (a, b) => { if (n1[a] < 0) n1[a] = b; else n2[a] = b; if (n1[b] < 0) n1[b] = a; else n2[b] = a; };
    const setPt = (e, x0, y0, v0, x1, y1, v1) => { const t = v0 / (v0 - v1); pt[e * 2] = x0 + (x1 - x0) * t; pt[e * 2 + 1] = y0 + (y1 - y0) * t; };
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      const a = val(y * W + x), b = val(y * W + x + 1), c = val((y + 1) * W + x + 1), d = val((y + 1) * W + x);
      const ia = a > 0, ib = b > 0, ic = c > 0, id = d > 0;
      const cs = (ia ? 1 : 0) | (ib ? 2 : 0) | (ic ? 4 : 0) | (id ? 8 : 0);
      if (cs === 0 || cs === 15) continue;
      const e0 = eid(x, y, 0), e1 = eid(x + 1, y, 1), e2 = eid(x, y + 1, 0), e3 = eid(x, y, 1), E = [];
      if (ia !== ib) { setPt(e0, x, y, a, x + 1, y, b); E.push(e0); }
      if (ib !== ic) { setPt(e1, x + 1, y, b, x + 1, y + 1, c); E.push(e1); }
      if (id !== ic) { setPt(e2, x, y + 1, d, x + 1, y + 1, c); E.push(e2); }
      if (ia !== id) { setPt(e3, x, y, a, x, y + 1, d); E.push(e3); }
      if (E.length === 2) link(E[0], E[1]);
      else { // saddle
        const center = (a + b + c + d) / 4 > 0;
        if (ia) { if (center) { link(e0, e1); link(e2, e3); } else { link(e0, e3); link(e1, e2); } }
        else { if (center) { link(e0, e3); link(e1, e2); } else { link(e0, e1); link(e2, e3); } }
      }
    }
    const loops = [], done = new Uint8Array(W * H * 2);
    for (let s = 0; s < n1.length; s++) {
      if (n1[s] < 0 || done[s]) continue;
      const L = []; let prev = -1, cur = s;
      while (cur >= 0 && !done[cur]) { done[cur] = 1; L.push([pt[cur * 2], pt[cur * 2 + 1]]); const nx = n1[cur] !== prev ? n1[cur] : n2[cur]; prev = cur; cur = nx; }
      if (L.length >= 3) loops.push(L);
    }
    return loops;
  }
  const perimeter = L => { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += Math.hypot(L[i][0] - L[j][0], L[i][1] - L[j][1]); return s; };
  const area2 = L => { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; };
  function rdpClosed(L, tol) {
    if (L.length < 8) return L;
    const rdp = (pts) => {
      const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
      while (st.length) { const [a, b] = st.pop(); let best = -1, bd = tol; const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1], len = Math.hypot(bx - ax, by - ay) || 1e-12;
        for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len; if (d > bd) { bd = d; best = i; } }
        if (best >= 0) { keep[best] = 1; st.push([a, best], [best, b]); } }
      return pts.filter((_, i) => keep[i]);
    };
    let far = 0, fd = -1; for (let i = 0; i < L.length; i++) { const d = Math.hypot(L[i][0] - L[0][0], L[i][1] - L[0][1]); if (d > fd) { fd = d; far = i; } }
    const a = rdp(L.slice(0, far + 1)), b = rdp(L.slice(far).concat([L[0]]));
    return a.concat(b.slice(1, -1));
  }

  // ---------------------------------------------------------------- plate helpers
  function minDistToEdges(polys, x, y) {
    let best = Infinity;
    for (const P of polys) for (const R of [P.outer, ...P.holes]) for (let i = 0, j = R.length - 1; i < R.length; j = i++) {
      const ax = R[j][0], ay = R[j][1], bx = R[i][0], by = R[i][1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y));
    }
    return best;
  }
  const inside = (polys, x, y) => polys.some(P => T.pointIn([x, y], P));
  // the point inside the polygons farthest from their edges (grid search, refined), preferring the center
  function deepPoint(polys) {
    const bb = T.polysBBox(polys); let best = null, bd = -1;
    const tryAt = (x, y, bias) => { if (!inside(polys, x, y)) return; const d = minDistToEdges(polys, x, y) - bias; if (d > bd) { bd = d; best = [x, y]; } };
    const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    for (let j = 0; j <= 24; j++) for (let i = 0; i <= 24; i++) { const x = bb.x0 + bb.w * i / 24, y = bb.y0 + bb.h * j / 24; tryAt(x, y, 0.08 * Math.hypot(x - cx, y - cy)); }
    if (!best) return null;
    let step = Math.max(bb.w, bb.h) / 48;
    for (let it = 0; it < 12; it++, step /= 2) { const [x, y] = best; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) tryAt(x + dx * step, y + dy * step, 0.08 * Math.hypot(x + dx * step - cx, y + dy * step - cy)); }
    return { x: best[0], y: best[1], clear: minDistToEdges(polys, best[0], best[1]) };
  }
  // highest outline point along the vertical line x
  function topAt(polys, x) {
    let top = -Infinity;
    for (const P of polys) { const R = P.outer; for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const a = R[j], b = R[i]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) { const t = (x - a[0]) / (b[0] - a[0]); top = Math.max(top, a[1] + t * (b[1] - a[1])); } } }
    return top;
  }

  // ---------------------------------------------------------------- 3. build
  function build(an, colors, o) {
    o = Object.assign({}, DEFAULTS, o || {});
    colors = colors || defaultColors(an);
    const warn = [];
    const size = Math.max(LIMITS.minSize, Math.min(LIMITS.maxSize, +o.size || DEFAULTS.size));
    const baseColor = parseHex(o.baseColor) ? toHex(parseHex(o.baseColor)) : defaultBase(an);
    const minF = Math.max(0.2, Math.min(5, +o.minFeature || 0));
    let baseT = Math.max(LIMITS.minBase, Math.min(20, +o.baseT || DEFAULTS.baseT));
    const layerT = Math.max(0.2, Math.min(10, +o.layerT || DEFAULTS.layerT));
    const { w, h } = an;
    let { groups, lab } = groupLabels(an, colors);
    if (!groups.some(g => g.kind === 'print') && !groups.length) throw new Error('Every color is removed. Keep at least one color.');
    // art bounds in pixels -> scale
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lab[y * w + x] !== VOID) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) throw new Error('Every color is removed. Keep at least one color.');
    const px = size / Math.max(x1 - x0 + 1, y1 - y0 + 1); // mm per pixel
    // raster cleanup
    const smoothing = Math.max(0, Math.min(3, Math.round(+o.smoothing || 0)));
    if (smoothing > 0) lab = majority(lab, w, h);
    const minPx = Math.max(2, Math.round(Math.PI / 4 * (minF / px) ** 2));
    dropSmall(lab, w, h, minPx);
    // fields on a padded grid (the pad is outside the art so every contour closes)
    const pad = 3, W = w + 2 * pad, H = h + 2 * pad, nG = groups.length, sigma = [0.45, 0.7, 1.1, 1.7][smoothing];
    // Soft membership keeps the art's antialiasing: an edge pixel that is a blend of two palette colors counts toward
    // both (by where it sits between them), so the contour lands between pixels instead of on the pixel staircase.
    const soft = new Float32Array(w * h * 2), softG = new Uint8Array(w * h * 2).fill(VOID);
    { const P = an.palette.map(q => q.rgb), gOf = an.palette.map((q, i) => { for (let g = 0; g < nG; g++) if (groups[g].members.includes(i)) return g; return VOID; }), d = an.rgba;
      for (let i = 0; i < w * h; i++) {
        const l = lab[i], al = d ? d[i * 4 + 3] / 255 : 1;
        if (!d || l === VOID || an.labels[i] === VOID || gOf[an.labels[i]] !== l) { softG[i * 2] = l; soft[i * 2] = 1; continue; }
        const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2]; let a = -1, b2 = -1, da = Infinity, db = Infinity;
        for (let k = 0; k < P.length; k++) { const q = P[k], dd = (r - q[0]) ** 2 + (gg - q[1]) ** 2 + (b - q[2]) ** 2; if (dd < da) { db = da; b2 = a; da = dd; a = k; } else if (dd < db) { db = dd; b2 = k; } }
        let t = 0;
        if (b2 >= 0) { const pa = P[a], pb = P[b2], vx = pb[0] - pa[0], vy = pb[1] - pa[1], vz = pb[2] - pa[2], L2 = vx * vx + vy * vy + vz * vz; if (L2 > 0) t = Math.max(0, Math.min(0.5, ((r - pa[0]) * vx + (gg - pa[1]) * vy + (b - pa[2]) * vz) / L2)); }
        const ga = gOf[a], gb = b2 >= 0 ? gOf[b2] : VOID;
        softG[i * 2] = ga; soft[i * 2] = (1 - t) * al; softG[i * 2 + 1] = gb; soft[i * 2 + 1] = t * al; // the rest (1 - al) is VOID
      } }
    const fields = [];
    for (let g = 0; g <= nG; g++) { // g === nG: VOID
      const f = new Float32Array(W * H); const id = g === nG ? VOID : g;
      for (let i = 0; i < W * H; i++) {
        const x = i % W - pad, y = ((i / W) | 0) - pad;
        if (x < 0 || y < 0 || x >= w || y >= h) { if (id === VOID) f[i] = 1; continue; }
        const k = y * w + x; let v = 0;
        if (softG[k * 2] === id) v += soft[k * 2];
        if (softG[k * 2 + 1] === id) v += soft[k * 2 + 1];
        if (id === VOID) v += 1 - soft[k * 2] - soft[k * 2 + 1];
        f[i] = v;
      }
      fields.push(blur(f, W, H, sigma));
    }
    const top1 = new Float32Array(W * H).fill(-1), top2 = new Float32Array(W * H).fill(-1), arg = new Uint8Array(W * H);
    for (let g = 0; g <= nG; g++) { const f = fields[g]; for (let i = 0; i < W * H; i++) { const v = f[i]; if (v > top1[i]) { top2[i] = top1[i]; top1[i] = v; arg[i] = g; } else if (v > top2[i]) top2[i] = v; } }
    // pad ring forced outside for every label
    const isPad = i => { const x = i % W, y = (i / W) | 0; return x === 0 || y === 0 || x === W - 1 || y === H - 1; };
    const hd = o.hd !== false, tol = o.tol != null ? o.tol : hd ? Math.max(0.008, 0.06 * px) : Math.max(0.02, 0.2 * px); // simplification tolerance (mm), under a quarter pixel
    const cx0 = (x0 + x1 + 1) / 2, cy0 = (y0 + y1 + 1) / 2;
    const toMM = (gx, gy, s) => [((gx / s) - pad + 0.5 - cx0) * px, (cy0 - ((gy / s) - pad + 0.5)) * px];
    const raw = [];
    for (let g = 0; g < nG; g++) {
      const f = fields[g]; let gg = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) gg[i] = isPad(i) ? -1 : f[i] - (arg[i] === g ? top2[i] : top1[i]);
      let GW = W, GH = H, s = 1;
      if (hd) { const u = upsample2(gg, W, H); gg = u.g; GW = u.W; GH = u.H; s = 2; }
      const loops = contour(gg, GW, GH).map(L => rdpClosed(L.map(q => toMM(q[0], q[1], s)), tol)).filter(L => L.length >= 3 && Math.abs(area2(L)) > (px * px) * 0.05);
      raw.push(loops.length ? T.unionPolys(loops.map(L => ({ outer: L, holes: [] })), 'evenodd') : []);
    }
    // A: the art area (all kept colors); regions: disjoint, gap-free inside A
    const art = T.unionPolys([].concat(...raw.map(r => T.offset(r, 0.2 * px, true))));
    const eps = Math.max(0.01, 0.25 * px);
    const order = groups.map((g, i) => i).sort((a, b) => T.polysArea(raw[a]) - T.polysArea(raw[b])); // small details first win their edges
    let taken = []; const region = new Array(nG).fill(null).map(() => []);
    for (const g of order) {
      if (!raw[g].length) continue;
      let r = T.interPolys(T.offset(raw[g], eps, true), art);
      if (taken.length) r = T.diffPolys(r, taken);
      region[g] = r; taken = T.unionPolys(taken.concat(r));
    }
    // minimum feature size: miter opening drops anything thinner, keeps corners
    const rOpen = minF / 2;
    for (let g = 0; g < nG; g++) {
      if (groups[g].kind !== 'print' || !region[g].length) continue;
      const opened = T.offset(T.offset(region[g], -rOpen, false), rOpen, false);
      // subtract only real thin features; the opening's micron slivers along shared edges would open gaps between colors
      const lost = T.diffPolys(region[g], opened).filter(P => { const a = T.polysArea([P]), per = perimeter(P.outer); return a > minF * minF || a / Math.max(1e-9, per / 2) > 0.03; });
      const r = lost.length ? T.diffPolys(region[g], lost) : region[g];
      region[g] = r.filter(P => Math.abs(area2(P.outer)) > minF * minF).map(P => ({ outer: P.outer, holes: P.holes.filter(hh => Math.abs(area2(hh)) > minF * minF * 0.5) }));
    }
    // plate outline
    const bbA = T.polysBBox(art), margin = Math.max(0, +o.margin || 0);
    let plate;
    switch (o.plate) {
      case 'none': plate = art; break;
      case 'rect': plate = [{ outer: T.roundRect(bbA.x0 - margin, bbA.y0 - margin, bbA.x1 + margin, bbA.y1 + margin, 0), holes: [] }]; break;
      case 'circle': {
        const cx = (bbA.x0 + bbA.x1) / 2, cy = (bbA.y0 + bbA.y1) / 2; let r = 0;
        for (const P of art) for (const q of P.outer) r = Math.max(r, Math.hypot(q[0] - cx, q[1] - cy));
        plate = [{ outer: T.circle(cx, cy, r + margin, 160), holes: [] }]; break;
      }
      case 'outline': plate = T.unionPolys(T.offset(art, Math.max(0.4, margin), true)).map(P => ({ outer: P.outer, holes: [] })); plate = T.unionPolys(plate); break;
      default: { const rr = Math.max(0, Math.min(+o.corner || 0, (Math.min(bbA.w, bbA.h) + 2 * margin) / 2 - 0.1)); plate = [{ outer: T.roundRect(bbA.x0 - margin, bbA.y0 - margin, bbA.x1 + margin, bbA.y1 + margin, rr, 12), holes: [] }]; }
    }
    if (o.plate === 'outline' && plate.length > 1) warn.push(`The outline makes ${plate.length} separate pieces; raise the margin to join them into one plate.`);
    if (o.plate === 'none' && plate.length > 1) warn.push(`The art is ${plate.length} separate pieces with no backing plate. Pick a plate shape to hold them together.`);
    // keychain tab + hole at the top center
    let hole = null;
    if (o.keychain) {
      const hr = Math.max(1.5, (+o.holeD || 5) / 2), tr = hr + 2.6, bb = T.polysBBox(plate), cx = (bb.x0 + bb.x1) / 2;
      let yTop = topAt(plate, cx); if (!isFinite(yTop)) yTop = bb.y1;
      const cy = yTop + hr + 0.6;
      plate = T.unionPolys(plate.concat([{ outer: T.circle(cx, cy, tr, 64), holes: [] }, { outer: T.roundRect(cx - tr, yTop - tr - 1, cx + tr, cy, 0), holes: [] }]));
      hole = [{ outer: T.circle(cx, cy, hr, 48), holes: [] }];
      plate = T.diffPolys(plate, hole);
    }
    const clip = r => { let q = T.interPolys(r, plate); if (hole) q = T.diffPolys(q, hole); return q; };
    // color parts and the base-colored fill
    const print = groups.map((g, i) => ({ g, i })).filter(x => x.g.kind === 'print');
    for (const x of print) region[x.i] = clip(region[x.i]);
    const colored = T.unionPolys([].concat(...print.map(x => region[x.i])));
    // magnet pocket in the plate's underside
    let pocket = null;
    if (o.magnet) {
      const md = Math.max(3, +o.magnetD || 10) + 0.2, mh = Math.max(0.8, +o.magnetH || 3) + 0.2;
      const needBase = mh + 0.6;
      if (baseT < needBase) { warn.push(`Base thickened to ${needBase.toFixed(1)} mm to fit the ${(mh - 0.2).toFixed(1)} mm magnet.`); baseT = needBase; }
      const dp = deepPoint(hole ? T.diffPolys(plate, T.offset(hole, 3, true)) : plate);
      if (!dp || dp.clear < md / 2 + 1) warn.push('The magnet pocket does not fit inside this plate; make the print bigger or the magnet smaller.');
      else pocket = { x: dp.x, y: dp.y, d: md, h: mh };
    }
    const parts = [];
    const zTop = baseT;
    // filament slots: 1 = base color, then one per distinct printed color
    const slots = [baseColor];
    const slotOf = hex => { let k = slots.indexOf(hex); if (k < 0) { slots.push(hex); k = slots.length - 1; } return k + 1; };
    const flat = o.mode === 'flat';
    const baseLayers = [];
    if (pocket) {
      const ring = [{ outer: T.circle(pocket.x, pocket.y, pocket.d / 2, 64), holes: [] }];
      baseLayers.push({ z0: 0, z1: pocket.h, polys: T.diffPolys(plate, ring) }, { z0: pocket.h, z1: zTop, polys: plate });
    } else baseLayers.push({ z0: 0, z1: zTop, polys: plate });
    let fill = [];
    if (flat) { fill = T.diffPolys(plate, colored); if (hole) fill = T.diffPolys(fill, hole); fill = fill.filter(P => Math.abs(area2(P.outer)) > 0.01); if (fill.length) baseLayers.push({ z0: zTop, z1: zTop + layerT, polys: fill }); }
    const baseP = baseLayers.length === 1 ? T.extrude(baseLayers[0].polys, 2, baseLayers[0].z0, baseLayers[0].z1) : T.steppedExtrude(baseLayers);
    parts.push({ name: 'Base plate', kind: 'base', color: baseColor, extruder: 1, p: baseP, area: T.polysArea(plate), polys: plate });
    let maxZ = zTop + (flat && fill.length ? layerT : 0);
    print.forEach((x, n) => {
      const r = region[x.i]; if (!r.length) return;
      const hh = flat ? layerT : Math.max(0.2, Math.min(20, +x.g.height || +o.height || DEFAULTS.height));
      const p = T.extrude(r, 2, zTop, zTop + hh);
      maxZ = Math.max(maxZ, zTop + hh);
      parts.push({ name: `Color ${n + 1} ${x.g.hex}`, kind: 'color', color: x.g.hex, extruder: slotOf(x.g.hex), height: hh, p, area: T.polysArea(r), polys: r, group: x.i, members: x.g.members });
    });
    if (parts.length < 2) warn.push('Only the base plate is left: every color is removed, merged into the base, or below the minimum feature size.');
    if (slots.length > 4) warn.push(`This print uses ${slots.length} filaments; a single 4-slot AMS needs a filament swap.`);
    const bbP = T.polysBBox(plate), bed = o.bed || DEFAULTS.bed;
    if (bbP.w > bed[0] || bbP.h > bed[1]) warn.push(`At ${bbP.w.toFixed(0)} \u00d7 ${bbP.h.toFixed(0)} mm the plate is bigger than the ${bed[0]} \u00d7 ${bed[1]} mm bed.`);
    const tris = parts.reduce((s, q) => s + q.p.length / 9, 0);
    return {
      _raw: o.debug ? raw : undefined, parts, filaments: slots.map(c => ({ color: c })), size: [bbP.w, bbP.h, maxZ], warnings: warn,
      stats: { px, tris, colors: print.length, minFeature: minF, baseT, layerT, mode: flat ? 'flat' : 'raised', plate: o.plate, hd, pocket, keychain: !!hole },
      options: { ...o, baseT, size }
    };
  }

  // ---------------------------------------------------------------- exports
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  // Centered on the bed (Bambu Studio / OrcaSlicer keep positions for a BambuStudio project file).
  function placed(res, bed) {
    const all = T.concat(res.parts.map(q => q.p)), bb = Core.bbox(all), dx = bed[0] / 2 - (bb.min[0] + bb.max[0]) / 2, dy = bed[1] / 2 - (bb.min[1] + bb.max[1]) / 2, dz = -bb.min[2];
    return res.parts.map(q => { const p = new Float64Array(q.p.length); for (let i = 0; i < p.length; i += 3) { p[i] = q.p[i] + dx; p[i + 1] = q.p[i + 1] + dy; p[i + 2] = q.p[i + 2] + dz; } return { ...q, p }; });
  }
  function export3MF(res, o) {
    o = o || {}; const bed = o.bed || DEFAULTS.bed, name = o.name || 'Multicolor print';
    const parts = placed(res, bed).map(q => ({ name: q.name, p: q.p, extruder: q.extruder, color: q.color }));
    return T.threeMF([{ name, parts }], { title: name, plates: [[0]], bambu: o.bambu === undefined ? DEFAULTS.bambu : o.bambu, filaments: res.filaments });
  }
  function readme(res, name) {
    const s = res.stats, L = [`Expressarte multi-color print: ${name}`, '',
      `Size: ${res.size[0].toFixed(1)} \u00d7 ${res.size[1].toFixed(1)} \u00d7 ${res.size[2].toFixed(1)} mm`,
      `Style: ${s.mode === 'flat' ? `flat inlay (colors ${s.layerT} mm deep in a flush top)` : 'raised relief (each color stands on the plate)'}, base ${s.baseT.toFixed(1)} mm`, '',
      'Filaments (slot: color: parts)'];
    res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}: ${res.parts.filter(q => q.extruder === i + 1).map(q => q.name).join(', ')}`));
    L.push('', 'The 3MF opens in your slicer as one object with a part per color and the filament slots already assigned.',
      'Using the STLs instead: import them all at once and answer Yes when asked to load them as one object with multiple parts, then pick a filament for each part.',
      'Print flat on the bed, 0.2 mm layers or finer; the first color layer starts right where the base plate ends, so the color change lands on a layer boundary when the base thickness is a multiple of the layer height.');
    if (s.pocket) L.push(`Magnet pocket: ${s.pocket.d.toFixed(1)} mm wide, ${s.pocket.h.toFixed(1)} mm deep, open on the underside (sized with 0.2 mm clearance).`);
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, o) {
    o = o || {}; const name = o.name || 'Multicolor print', base = safe(o.fileBase || name.toLowerCase()) || 'multicolor';
    const list = [{ name: `${base}.3mf`, data: export3MF(res, o) }];
    const pl = placed(res, o.bed || DEFAULTS.bed);
    pl.forEach((q, i) => list.push({ name: `stl/${String(i + 1).padStart(2, '0')}_${safe(q.kind === 'base' ? 'base_plate_' + q.color.slice(1) : 'color_' + q.color.slice(1))}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }));
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }

  const api = { DEFAULTS, LIMITS, VOID, analyze, defaultColors, defaultBase, build, export3MF, files, readme, contour, fit, toHex, parseHex, luma, groupLabels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPMulticolor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
