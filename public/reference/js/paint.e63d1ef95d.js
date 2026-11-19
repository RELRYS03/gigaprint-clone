/* Expressarte filament painting: a photo becomes a layered color print.
   Thin layers of translucent filament stacked on each other mix like paint: the taller a spot is, the more of the
   lighter filaments sit on top of the darker ones, so brightness maps to height and the filament changes at a few
   set layers turn that relief into a picture.

   What this file does (units: mm; the print lies in z >= 0 with x right and y up the picture):
   - gray(): the image's brightness (with brightness, contrast, gamma and invert) sampled on a regular vertex grid
     (box-filtered when the image is bigger than the grid);
   - grid(): the heightfield H = base + brightness * (max - base) at each grid vertex, the outline mask (rectangle,
     rounded rectangle or oval, optional hanging hole) and an optional raised border/frame;
   - the layer plan: layer 1 is `first` thick, every later layer `layer` thick; filament k starts at layer
     swaps[k-1] + 1, so the color bands are [z_k, z_k+1) with z_k at layer tops;
   - autoSwaps(): picks the swap layers that make the simulated brightness track the picture best;
   - simulate(): the color a spot of height h shows from the front: each band is mixed over the one below with
     a = 1 - exp(-3 t / TD) (TD = the filament's transmission distance, the thickness at which it hides what is
     under it), in linear RGB;
   - bandMesh(): one closed solid per color band: the smooth heightfield clipped to the band's slab, a flat cap
     where the surface goes above the band, a flat floor and walls on the outline. Each grid triangle is clipped by
     the band's planes with crossing points computed once per grid edge, so neighbors meet exactly; flat caps and
     floors are merged into polygons (outline + contour loops) and triangulated, which keeps the mesh small.
     A single [0, inf) band is the whole print in one piece (the STL).
   - export3MF(): one object with a part per band, each on its own filament slot (Bambu-ready colors), plus STLs and
     a swap-instructions text for single-extruder printers. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- filaments and defaults
  // TD (transmission distance, mm): how thick the filament must be before nothing shows through. Typical matte PLA
  // values; measure your own with a TD card or a light and a step test and type them in.
  const FILAMENTS = [
    { name: 'Black', hex: '#1A1A1A', td: 0.6 },
    { name: 'Charcoal', hex: '#3C3F44', td: 0.9 },
    { name: 'Gray', hex: '#8A8D91', td: 1.6 },
    { name: 'Light gray', hex: '#C4C6C8', td: 2.4 },
    { name: 'White', hex: '#F5F5F2', td: 3.0 },
    { name: 'Navy', hex: '#1F2F5C', td: 1.0 },
    { name: 'Blue', hex: '#2563C9', td: 1.6 },
    { name: 'Sky blue', hex: '#7FC4EC', td: 3.0 },
    { name: 'Teal', hex: '#1E8C8A', td: 1.8 },
    { name: 'Green', hex: '#2E8B3E', td: 1.8 },
    { name: 'Olive', hex: '#6B6B2A', td: 1.4 },
    { name: 'Brown', hex: '#6B4226', td: 1.2 },
    { name: 'Tan', hex: '#C9A27A', td: 2.6 },
    { name: 'Skin', hex: '#E8BFA0', td: 3.2 },
    { name: 'Red', hex: '#C8202F', td: 2.0 },
    { name: 'Orange', hex: '#EE7623', td: 2.8 },
    { name: 'Yellow', hex: '#F4D23C', td: 3.6 },
    { name: 'Pink', hex: '#F2A3C0', td: 3.2 },
    { name: 'Purple', hex: '#6A3FA0', td: 1.4 }
  ];
  const fil = n => { const f = FILAMENTS.find(x => x.name === n); return { name: f.name, hex: f.hex, td: f.td }; };
  // starting sets by count, dark to light (the usual order: the base is the darkest)
  const PRESETS = {
    2: ['Black', 'White'], 3: ['Black', 'Gray', 'White'], 4: ['Black', 'Charcoal', 'Gray', 'White'],
    5: ['Black', 'Navy', 'Gray', 'Tan', 'White'], 6: ['Black', 'Brown', 'Red', 'Orange', 'Yellow', 'White'],
    7: ['Black', 'Navy', 'Blue', 'Teal', 'Tan', 'Yellow', 'White'], 8: ['Black', 'Navy', 'Purple', 'Red', 'Orange', 'Yellow', 'Sky blue', 'White']
  };
  const presetColors = n => PRESETS[clamp(n | 0, 2, 8)].map(fil);
  const SHAPES = { rect: 'Rectangle', rounded: 'Rounded', oval: 'Oval' };
  const DETAIL = { preview: { cell: 0.05, maxN: 320 }, draft: { cell: 0.7, maxN: 170 }, standard: { cell: 0.3, maxN: 460 }, high: { cell: 0.15, maxN: 1000 } };
  const DEFAULTS = {
    size: 100, axis: 'width', shape: 'rect', corner: 6, first: 0.16, layer: 0.08, base: 0.48, maxH: 2.0,
    border: 0, borderH: 0, hole: false, holeD: 5, brightness: 0, contrast: 0, gamma: 1, invert: false, smooth: 0.5,
    colors: presetColors(4), swaps: null, detail: 'standard', bambu: 'A1'
  };
  const LIMITS = { free: { size: 100, colors: 4 }, minColors: 2, maxColors: 8, minSize: 20, maxSize: 300 };

  // ---------------------------------------------------------------- color helpers
  function parseHex(h) { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return [0, 0, 0]; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const toSrgb = v => { v = clamp(v, 0, 1); return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };
  const lin = hex => parseHex(hex).map(toLin);
  const hex2 = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  const toHex = rgb => '#' + rgb.map(hex2).join('').toUpperCase();
  // perceived lightness 0..1 (CIE L*/100) of a linear RGB color
  function lightL(c) { const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return (y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y) / 100; }
  const lightHex = hex => lightL(lin(hex));

  // ---------------------------------------------------------------- options
  function options(o) {
    const d = DEFAULTS, r = Object.assign({}, d, o || {});
    r.layer = clamp(+r.layer || d.layer, 0.04, 0.32); r.first = clamp(+r.first || d.first, 0.08, 0.4);
    r.size = clamp(+r.size || d.size, LIMITS.minSize, LIMITS.maxSize);
    r.maxH = clamp(+r.maxH || d.maxH, r.first + r.layer * 3, 12);
    r.base = clamp(+r.base || d.base, r.first, r.maxH - r.layer * 2);
    r.border = clamp(+r.border || 0, 0, 20); r.borderH = r.border > 0 ? clamp(+r.borderH || r.maxH, r.base, 14) : 0;
    r.holeD = clamp(+r.holeD || d.holeD, 2, 12); r.corner = clamp(+r.corner || 0, 0, 60);
    r.gamma = clamp(+r.gamma || 1, 0.3, 3); r.contrast = clamp(+r.contrast || 0, -0.9, 2); r.brightness = clamp(+r.brightness || 0, -0.6, 0.6); r.smooth = clamp(+r.smooth || 0, 0, 3);
    if (!SHAPES[r.shape]) r.shape = 'rect'; if (!DETAIL[r.detail]) r.detail = 'standard';
    const cs = (Array.isArray(r.colors) && r.colors.length ? r.colors : d.colors).slice(0, LIMITS.maxColors).map(c => ({ name: c.name || '', hex: toHex(parseHex(c.hex)), td: clamp(+c.td || 1, 0.1, 20) }));
    while (cs.length < LIMITS.minColors) cs.push(fil(cs.length ? 'White' : 'Black'));
    r.colors = cs;
    return r;
  }
  // layer plan: z of the top of layer n (n = 1, 2 ...), and the layer whose top is nearest a height
  const layerTop = (o, n) => n <= 0 ? 0 : o.first + (n - 1) * o.layer;
  const layerAt = (o, z) => z <= o.first ? 1 : Math.max(1, Math.round((z - o.first) / o.layer) + 1);
  const layers = o => ({ base: layerAt(o, o.base), top: layerAt(o, o.maxH) });
  // swap layers: filament k (k >= 1) starts on layer swaps[k-1] + 1; always increasing, from just above the base to the top
  function fixSwaps(o, s) {
    const n = o.colors.length, L = layers(o), out = [];
    for (let k = 1; k < n; k++) {
      let v = s && isFinite(s[k - 1]) ? Math.round(s[k - 1]) : L.base + Math.round(k * (L.top - L.base) / n);
      v = clamp(v, (k === 1 ? L.base : out[k - 2] + 1), L.top - (n - 1 - k) - 1);
      out.push(Math.max(k === 1 ? L.base : out[k - 2] + 1, v));
    }
    return out;
  }
  // [{lo, hi, k}] in mm for color k (k = 0 the base color)
  function bands(o, swaps) {
    const s = fixSwaps(o, swaps), out = [];
    for (let k = 0; k < o.colors.length; k++) out.push({ k, lo: k === 0 ? 0 : layerTop(o, s[k - 1]), hi: k === o.colors.length - 1 ? Infinity : layerTop(o, s[k]) });
    return out;
  }

  // ---------------------------------------------------------------- simulated color
  // the color a spot printed to height h shows from the front, as linear RGB
  function makeSim(o, swaps) {
    const B = bands(o, swaps), C = o.colors.map(c => lin(c.hex));
    return h => {
      const top = Math.max(o.first, layerTop(o, layerAt(o, h))); // what the printer actually lays down
      const c = C[0].slice();
      for (let i = 1; i < B.length; i++) {
        const t = Math.min(top, B[i].hi) - B[i].lo; if (t <= 1e-9) break;
        const a = 1 - Math.exp(-3 * t / o.colors[i].td), f = C[i];
        c[0] += (f[0] - c[0]) * a; c[1] += (f[1] - c[1]) * a; c[2] += (f[2] - c[2]) * a;
      }
      return c;
    };
  }
  // lookup table of simulated sRGB colors by height (step = layer / 4)
  function simTable(o, swaps) {
    const sim = makeSim(o, swaps), top = Math.max(o.maxH, o.borderH || 0) + o.layer, step = o.layer / 4, n = Math.ceil(top / step) + 2;
    const rgb = new Uint8Array(n * 3), linear = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const c = sim(i * step); linear.set(c, i * 3); rgb[i * 3] = toSrgb(c[0]); rgb[i * 3 + 1] = toSrgb(c[1]); rgb[i * 3 + 2] = toSrgb(c[2]); }
    return { step, n, rgb, linear, at: h => Math.min(n - 1, Math.max(0, Math.round(h / step))) };
  }

  // ---------------------------------------------------------------- image -> brightness
  // img: {w, h, data RGBA}; transparent pixels count as white. Returns Float32Array w*h of 0..1 (sRGB luma).
  function luminance(img) {
    const { w, h, data } = img, L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3] / 255, y = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
      L[i] = y * a + (1 - a);
    }
    return L;
  }
  function tone(v, o) {
    v = (v - 0.5) * (1 + o.contrast) + 0.5 + o.brightness;
    v = clamp(v, 0, 1); if (o.gamma !== 1) v = Math.pow(v, o.gamma);
    return o.invert ? 1 - v : v;
  }
  // print size from the image's aspect: [W, H] mm
  function printSize(o, aspect) { // aspect = image h / w
    return o.axis === 'height' ? [o.size / aspect, o.size] : [o.size, o.size * aspect];
  }
  // sample brightness at nx*ny vertices (row 0 = bottom of the picture)
  function sampleGray(L, w, h, nx, ny, o) {
    const g = new Float32Array(nx * ny), fx = w / nx, fy = h / ny;
    const at = (x, y) => L[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      // image area this vertex stands for (vertex at the center of its footprint)
      const cx = (i + 0.5) * fx, cy = (ny - 1 - j + 0.5) * fy; let v;
      if (fx > 1.5 || fy > 1.5) {
        const x0 = Math.floor(cx - fx / 2), x1 = Math.max(x0 + 1, Math.ceil(cx + fx / 2)), y0 = Math.floor(cy - fy / 2), y1 = Math.max(y0 + 1, Math.ceil(cy + fy / 2));
        let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += at(x, y); n++; } v = s / n;
      } else {
        const x = cx - 0.5, y = cy - 0.5, xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi;
        v = (at(xi, yi) * (1 - tx) + at(xi + 1, yi) * tx) * (1 - ty) + (at(xi, yi + 1) * (1 - tx) + at(xi + 1, yi + 1) * tx) * ty;
      }
      g[j * nx + i] = v;
    }
    if (o.smooth > 0) blur(g, nx, ny, o.smooth);
    for (let k = 0; k < g.length; k++) g[k] = tone(g[k], o);
    return g;
  }
  function blur(g, nx, ny, r) { // small separable gaussian (sigma r cells)
    const R = Math.ceil(r * 2), K = []; let s = 0; for (let i = -R; i <= R; i++) { const v = Math.exp(-i * i / (2 * r * r)); K.push(v); s += v; } for (let i = 0; i < K.length; i++) K[i] /= s;
    const t = new Float32Array(g.length);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let a = 0; for (let k = -R; k <= R; k++) a += K[k + R] * g[j * nx + clamp(i + k, 0, nx - 1)]; t[j * nx + i] = a; }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let a = 0; for (let k = -R; k <= R; k++) a += K[k + R] * t[clamp(j + k, 0, ny - 1) * nx + i]; g[j * nx + i] = a; }
  }

  // ---------------------------------------------------------------- outline
  // signed distance to the outline (negative inside), W x H mm with the corner at (0,0)
  function outlineSDF(o, W, H) {
    const cx = W / 2, cy = H / 2;
    if (o.shape === 'oval') { const a = W / 2, b = H / 2, m = Math.min(a, b); return (x, y) => { const u = (x - cx) / a, v = (y - cy) / b; return (Math.hypot(u, v) - 1) * m; }; }
    const r = o.shape === 'rounded' ? Math.min(o.corner, W / 2, H / 2) : 0;
    return (x, y) => { const qx = Math.abs(x - cx) - (W / 2 - r), qy = Math.abs(y - cy) - (H / 2 - r); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
  }
  function holeSpec(o, W, H) {
    if (!o.hole) return null;
    const r = o.holeD / 2, ring = 1.6, m = Math.max(o.border, 0) + r + ring + 1.2;
    return { x: W / 2, y: H - (o.shape === 'oval' ? m + 1.5 : m), r, ring };
  }

  // ---------------------------------------------------------------- grid
  // img: {w, h, data}. Returns { nx, ny, cell, W, H, h: Float64Array heights, cellIn: Uint8Array, gray, o }
  function grid(img, o, detail) {
    o = options(o);
    const D = DETAIL[detail || o.detail] || DETAIL.standard, aspect = img.h / img.w, [W0, H0] = printSize(o, aspect);
    const cell = Math.max(D.cell, Math.max(W0, H0) / D.maxN);
    const nx = Math.max(3, Math.round(W0 / cell) + 1), ny = Math.max(3, Math.round(H0 / cell) + 1);
    const cw = W0 / (nx - 1), ch = H0 / (ny - 1); // exact size: cells may be a hair off square
    const L = img.L || luminance(img), gray = sampleGray(L, img.w, img.h, nx, ny, o);
    const sdf = outlineSDF(o, W0, H0), hole = holeSpec(o, W0, H0);
    const cellIn = new Uint8Array((nx - 1) * (ny - 1));
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const x = (i + 0.5) * cw, y = (j + 0.5) * ch;
      let inn = o.shape === 'rect' || sdf(x, y) < 0;
      if (inn && hole && Math.hypot(x - hole.x, y - hole.y) < hole.r) inn = false;
      cellIn[j * (nx - 1) + i] = inn ? 1 : 0;
    }
    unpinch(cellIn, nx - 1, ny - 1);
    const h = new Float64Array(nx * ny), top = o.border > 0 ? o.borderH : o.maxH;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = i * cw, y = j * ch, k = j * nx + i;
      let z = o.base + gray[k] * (o.maxH - o.base);
      if (o.border > 0 && sdf(x, y) > -o.border) z = top;
      if (hole && Math.hypot(x - hole.x, y - hole.y) < hole.r + hole.ring) z = Math.max(o.base + 0.6 * (o.maxH - o.base), o.border > 0 ? top : o.maxH);
      h[k] = z;
    }
    return { nx, ny, cw, ch, W: W0, H: H0, h, cellIn, gray, o, hole };
  }
  // two cells that touch only at a corner make a pinch vertex (not a manifold); fill one of the gaps
  function unpinch(m, cx, cy) {
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (let j = 0; j + 1 < cy; j++) for (let i = 0; i + 1 < cx; i++) {
        const a = m[j * cx + i], b = m[j * cx + i + 1], c = m[(j + 1) * cx + i], d = m[(j + 1) * cx + i + 1];
        if (a && d && !b && !c) { m[j * cx + i + 1] = 1; changed = true; } else if (b && c && !a && !d) { m[j * cx + i] = 1; changed = true; }
      }
      if (!changed) break;
    }
  }
  // keep heights a hair off the band planes so every crossing is a proper one
  function nudge(Gd, levels) {
    const h = Gd.h, eps = 1e-3;
    for (let k = 0; k < h.length; k++) for (const z of levels) if (Math.abs(h[k] - z) < eps) h[k] = h[k] < z ? z - eps : z + eps;
  }

  // ---------------------------------------------------------------- band solids
  // One closed solid for lo <= z <= min(H, hi) over the outline (hi = Infinity for the top band / the whole print).
  function bandMesh(Gd, lo, hi) {
    const { nx, ny, cw, ch, h, cellIn } = Gd, N = nx * ny, CX = nx - 1;
    const out = [], CP = [], cross = new Map();
    const X = id => id < N ? (id % nx) * cw : CP[(id - N) * 3], Y = id => id < N ? Math.floor(id / nx) * ch : CP[(id - N) * 3 + 1];
    const xid = (a, b, lvl, li) => {
      if (a > b) { const t = a; a = b; b = t; }
      li = lvl === lo ? 0 : 1; // keyed by the band plane, whichever clip asks
      const key = (a * N + b) * 2 + li; let id = cross.get(key);
      if (id === undefined) { const t = (lvl - h[a]) / (h[b] - h[a]); id = N + CP.length / 3; CP.push(X(a) + (X(b) - X(a)) * t, Y(a) + (Y(b) - Y(a)) * t, lvl); cross.set(key, id); }
      return id;
    };
    const zOf = id => id < N ? h[id] : CP[(id - N) * 3 + 2];
    // polygon of {lo2 <= H <= hi2} in triangle tri (CCW), as point ids; eo[i] = the triangle edge each point starts on
    const P = [], E = [];
    function clip(tri, lo2, hi2) {
      P.length = 0; E.length = 0;
      for (let e = 0; e < 3; e++) {
        const a = tri[e], b = tri[(e + 1) % 3], ha = h[a], hb = h[b];
        if (ha > lo2 && ha < hi2) { P.push(a); E.push(e); }
        let c1 = -1, t1 = 0, c2 = -1, t2 = 0;
        if ((ha - lo2) * (hb - lo2) < 0) { c1 = xid(a, b, lo2, 0); t1 = (lo2 - ha) / (hb - ha); }
        if (hi2 < Infinity && (ha - hi2) * (hb - hi2) < 0) { c2 = xid(a, b, hi2, 1); t2 = (hi2 - ha) / (hb - ha); }
        if (c1 >= 0 && c2 >= 0 && t2 < t1) { P.push(c2, c1); E.push(e, e); }
        else { if (c1 >= 0) { P.push(c1); E.push(e); } if (c2 >= 0) { P.push(c2); E.push(e); } }
      }
    }
    const tri = [0, 0, 0], ne = [0, 0, 0]; // ne: is triangle edge e on the outline
    const cin = (i, j) => i >= 0 && j >= 0 && i < CX && j < ny - 1 && cellIn[j * CX + i] === 1;
    const capSeg = [], botSeg = [], walls = [];
    const pushTri = (ax, ay, az, bx, by, bz, cx, cy, cz) => out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    const area2 = (a, b, c) => (X(b) - X(a)) * (Y(c) - Y(a)) - (X(c) - X(a)) * (Y(b) - Y(a));
    function surface() { // ear-clip the convex slab polygon (skips zero-area ears from collinear points)
      const q = P.slice();
      let guard = 0;
      while (q.length > 3 && guard++ < 20) {
        let done = false;
        for (let i = 0; i < q.length; i++) {
          const a = q[(i + q.length - 1) % q.length], b = q[i], c = q[(i + 1) % q.length];
          if (area2(a, b, c) > 1e-14) { pushTri(X(a), Y(a), zOf(a), X(b), Y(b), zOf(b), X(c), Y(c), zOf(c)); q.splice(i, 1); done = true; break; }
        }
        if (!done) break;
      }
      if (q.length === 3 && area2(q[0], q[1], q[2]) > 1e-14) pushTri(X(q[0]), Y(q[0]), zOf(q[0]), X(q[1]), Y(q[1]), zOf(q[1]), X(q[2]), Y(q[2]), zOf(q[2]));
    }
    function region(lvl, segs) { // outline + contour segments of {H >= lvl} in this triangle
      clip(tri, lvl, Infinity);
      const n = P.length; if (n < 3) return;
      for (let i = 0; i < n; i++) {
        const p = P[i], q = P[(i + 1) % n], ep = E[i], eq = E[(i + 1) % n];
        const onEdge = q < N || eq === ep; // a segment into a vertex always runs along the edge before it
        if (onEdge) { if (ne[ep]) segs.push(p, q); }
        else segs.push(p, q); // contour chord
      }
    }
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < CX; i++) {
      if (!cellIn[j * CX + i]) continue;
      const v00 = j * nx + i, v10 = v00 + 1, v01 = v00 + nx, v11 = v01 + 1;
      for (let t = 0; t < 2; t++) {
        if (t === 0) { tri[0] = v00; tri[1] = v10; tri[2] = v11; ne[0] = !cin(i, j - 1); ne[1] = !cin(i + 1, j); ne[2] = false; }
        else { tri[0] = v00; tri[1] = v11; tri[2] = v01; ne[0] = false; ne[1] = !cin(i, j + 1); ne[2] = !cin(i - 1, j); }
        const mx = Math.max(h[tri[0]], h[tri[1]], h[tri[2]]), mn = Math.min(h[tri[0]], h[tri[1]], h[tri[2]]);
        if (mx <= lo) continue;
        if (mn < hi) { clip(tri, lo, hi); if (P.length >= 3) surface(); }
        if (hi < Infinity && mx > hi) region(hi, capSeg);
        region(lo, botSeg);
        for (let e = 0; e < 3; e++) if (ne[e]) walls.push(tri[e], tri[(e + 1) % 3]);
      }
    }
    // walls on the outline: from lo up to min(H, hi) where H > lo
    for (let w = 0; w < walls.length; w += 2) {
      const a = walls[w], b = walls[w + 1], ha = h[a], hb = h[b];
      const pts = []; // [id, t]
      if (ha > lo) pts.push([a, 0]);
      if ((ha - lo) * (hb - lo) < 0) pts.push([xid(a, b, lo, 0), (lo - ha) / (hb - ha)]);
      if (hi < Infinity && (ha - hi) * (hb - hi) < 0) pts.push([xid(a, b, hi, 1), (hi - ha) / (hb - ha)]);
      if (hb > lo) pts.push([b, 1]);
      if (pts.length < 2) continue;
      pts.sort((u, v) => u[1] - v[1]);
      const top = id => [X(id), Y(id), id < N ? Math.min(h[id], hi) : zOf(id)];
      const f = pts[0][0], l = pts[pts.length - 1][0];
      const poly = [[X(f), Y(f), lo], [X(l), Y(l), lo]];
      for (let k = pts.length - 1; k >= 0; k--) poly.push(top(pts[k][0]));
      const Q = []; for (const p of poly) { const q = Q[Q.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1] || q[2] !== p[2]) Q.push(p); }
      while (Q.length > 1 && Q[0][0] === Q[Q.length - 1][0] && Q[0][1] === Q[Q.length - 1][1] && Q[0][2] === Q[Q.length - 1][2]) Q.pop();
      for (let k = 1; k + 1 < Q.length; k++) {
        const A = Q[0], B = Q[k], C = Q[k + 1];
        const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
        if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-12) continue;
        pushTri(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
      }
    }
    // flat cap (up) and floor (down)
    if (hi < Infinity) flat(capSeg, hi, 1);
    flat(botSeg, lo, -1);
    function flat(segs, z, sign) {
      if (!segs.length) return;
      const next = new Map(); for (let k = 0; k < segs.length; k += 2) next.set(segs[k], segs[k + 1]);
      const seen = new Set(), loops = [];
      for (let k = 0; k < segs.length; k += 2) {
        const s = segs[k]; if (seen.has(s)) continue;
        const loop = []; let c = s, g = 0;
        while (!seen.has(c) && g++ <= segs.length) { seen.add(c); loop.push([X(c), Y(c)]); c = next.get(c); if (c === undefined) break; }
        if (c === s && loop.length >= 3) loops.push(loop);
      }
      const polys = nestLoops(loops), tmpT = [];
      Core.triangulatePolys(polys, 2, z, sign, out, tmpT, 0, sign);
    }
    return Float64Array.from(out);
  }
  // CCW loops are outlines, CW loops are holes; each hole goes in the smallest outline around it
  function nestLoops(loops) {
    const outer = [], holes = [];
    for (const L of loops) {
      let a = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0, j = L.length - 1; i < L.length; j = i++) { a += L[j][0] * L[i][1] - L[i][0] * L[j][1]; const p = L[i]; if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      const e = { pts: L, area: Math.abs(a / 2), bb: [x0, y0, x1, y1] };
      if (Math.abs(a) < 1e-14) continue;
      (a > 0 ? outer : holes).push(e);
    }
    outer.sort((p, q) => p.area - q.area);
    const polys = outer.map(e => ({ outer: e.pts, holes: [], area: e.area }));
    for (const hl of holes) {
      const pt = hl.pts[0];
      for (let i = 0; i < outer.length; i++) {
        const b = outer[i].bb, e = outer[i];
        if (e.area < hl.area || pt[0] < b[0] || pt[0] > b[2] || pt[1] < b[1] || pt[1] > b[3]) continue;
        if (pip(pt, e.pts) || pip(hl.pts[(hl.pts.length / 2) | 0], e.pts)) { polys[i].holes.push(hl.pts); break; }
      }
    }
    return polys;
  }
  function pip(pt, pts) {
    let c = false; const x = pt[0], y = pt[1];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; }
    return c;
  }

  // ---------------------------------------------------------------- swap heights
  // Choose swap layers so the simulated lightness follows the picture: the target lightness at a height runs
  // linearly from the darkest to the lightest filament over base..max, weighted by how much of the picture
  // sits at each height. Coordinate descent over whole layers.
  function autoSwaps(o, heights) {
    o = options(o);
    const n = o.colors.length, L = layers(o), NB = 48, hist = new Float64Array(NB), span = o.maxH - o.base;
    if (heights && heights.length) { for (let k = 0; k < heights.length; k++) { const t = (heights[k] - o.base) / span; if (t >= -1e-6 && t <= 1 + 1e-6) hist[Math.min(NB - 1, Math.max(0, Math.floor(t * NB)))]++; } }
    else hist.fill(1);
    for (let b = 0; b < NB; b++) hist[b] = Math.sqrt(hist[b]) + 0.15; // every tone matters a little, common tones more
    const ls = o.colors.map(c => lightHex(c.hex)), lmin = Math.min(...ls), lmax = Math.max(...ls);
    const cost = s => {
      const sim = makeSim(o, s); let e = 0;
      for (let b = 0; b < NB; b++) { const t = (b + 0.5) / NB, want = ls[0] + (lmax - ls[0]) * t; const d = lightL(sim(o.base + t * span)) - want; e += hist[b] * d * d; }
      return e;
    };
    let s = fixSwaps(o, null), best = cost(s);
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (let k = 0; k < n - 1; k++) {
        const loK = k === 0 ? L.base : s[k - 1] + 1, hiK = k === n - 2 ? L.top - 1 : s[k + 1] - 1;
        for (let v = loK; v <= hiK; v++) { if (v === s[k]) continue; const t = s.slice(); t[k] = v; const c = cost(t); if (c < best - 1e-12) { best = c; s = t; moved = true; } }
      }
      if (!moved) break;
    }
    void lmin;
    return s;
  }

  // ---------------------------------------------------------------- build
  // img: {w, h, data} (or with a precomputed L); o: options. Returns
  // { parts: [{ name, p, color, extruder, k, lo, hi }], whole (one-piece solid), swaps, bands, size, stats, warnings, options }
  function build(img, o, opt) {
    o = options(o); opt = opt || {};
    const detail = opt.detail || o.detail, Gd = grid(img, o, detail);
    const imgHeights = []; for (let k = 0; k < Gd.h.length; k += 7) imgHeights.push(Gd.h[k]);
    const swaps = o.swaps ? fixSwaps(o, o.swaps) : autoSwaps(o, imgHeights);
    const B = bands(o, swaps), levels = []; for (const b of B) { if (b.lo > 0) levels.push(b.lo); }
    nudge(Gd, levels);
    let top = 0; for (let k = 0; k < Gd.h.length; k++) if (Gd.h[k] > top) top = Gd.h[k];
    const warnings = [], parts = [];
    for (const b of B) {
      if (b.lo >= top) { warnings.push(`${o.colors[b.k].name || 'Color ' + (b.k + 1)} starts above the tallest point, so it isn't used. Lower its swap layer or raise the max height.`); continue; }
      const p = bandMesh(Gd, b.lo, b.hi);
      if (p.length) parts.push({ name: `${b.k + 1} ${o.colors[b.k].name || 'Color ' + (b.k + 1)}`.trim(), p, color: o.colors[b.k].hex, extruder: b.k + 1, k: b.k, lo: b.lo, hi: b.hi });
    }
    const whole = opt.whole === false ? null : bandMesh(Gd, 0, Infinity);
    for (let k = 1; k < o.colors.length; k++) { const a = o.colors[k - 1], c = o.colors[k]; if (lightHex(c.hex) < lightHex(a.hex) - 0.05 && !o.invert) { warnings.push(`${c.name || 'Color ' + (k + 1)} is darker than the filament under it. Darker filaments usually go lower; try Sort dark to light.`); break; } }
    if (o.maxH - o.base < o.layer * o.colors.length * 2) warnings.push('Few layers between the base and the max height for this many colors. Raise the max height or use a thinner layer.');
    const tris = parts.reduce((a, q) => a + q.p.length / 9, 0);
    return { parts, whole, swaps, bands: B, size: [Gd.W, Gd.H, top], warnings, options: o, detail,
      stats: { nx: Gd.nx, ny: Gd.ny, cell: Math.max(Gd.cw, Gd.ch), tris, layers: layerAt(o, top), top, colors: o.colors.length, hole: !!Gd.hole } };
  }
  // per-vertex simulated colors for a triangle soup (Float32Array, 0..1 sRGB) for the 3D preview
  function vertexColors(p, table) {
    const c = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 3) { const k = table.at(p[i + 2]) * 3; c[i] = table.rgb[k] / 255; c[i + 1] = table.rgb[k + 1] / 255; c[i + 2] = table.rgb[k + 2] / 255; }
    return c;
  }

  // ---------------------------------------------------------------- instructions and export
  const f2 = v => (Math.round(v * 100) / 100).toFixed(2);
  function swapPlan(res) {
    const o = res.options, s = res.swaps;
    return o.colors.map((c, k) => k === 0 ? { k, name: c.name || 'Color 1', hex: c.hex, layer: 1, z: 0 } : { k, name: c.name || `Color ${k + 1}`, hex: c.hex, layer: s[k - 1] + 1, z: layerTop(o, s[k - 1]) });
  }
  function instructions(res, name) {
    const o = res.options, plan = swapPlan(res), L = [`Expressarte filament painting: ${name || 'filament painting'}`, '',
      `Size: ${res.size[0].toFixed(1)} \u00d7 ${res.size[1].toFixed(1)} mm, ${res.size[2].toFixed(2)} mm tall (${res.stats.layers} layers)`,
      `Layers: first layer ${f2(o.first)} mm, then ${f2(o.layer)} mm. Set exactly these in your slicer, or the color changes land on the wrong layers.`,
      `Base: ${f2(o.base)} mm solid, max height ${f2(o.maxH)} mm${o.border > 0 ? `, border ${o.border} mm wide at ${f2(o.borderH)} mm` : ''}`, '',
      'Filament order (bottom to top)'];
    plan.forEach((p, i) => L.push(i === 0 ? `  Start:    ${p.name} ${p.hex} (TD ${o.colors[0].td})` : `  Layer ${String(p.layer).padStart(3)}: change to ${p.name} ${p.hex} (TD ${o.colors[i].td}), from Z = ${f2(p.z)} mm`));
    L.push('', 'Single-extruder printers',
      '  Add a filament change (pause / M600) at each layer above. Most slicers number layers from 1 and show the Z height; match the Z if the numbering differs.',
      '  Print the whole picture as one piece: use the one-piece STL (whole print).',
      '', 'Multi-color printers (AMS / tool changers)',
      '  Open the 3MF: it is one object with a part per color band, each already on its own filament slot, so the colors change at the right heights by themselves.',
      '', 'Print tips',
      '  - Print face up, flat on the bed, with 100% infill (or many walls) so light passes evenly. Ironing off.',
      '  - Matte PLA gives the best blends. If your filament differs, measure its TD and type it in to match the preview.',
      '  - Hang it with a light behind it to see the most color, or on a wall like a painting.');
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  function placed(res, bed) {
    const b = bed || [256, 256], dx = (b[0] - res.size[0]) / 2, dy = (b[1] - res.size[1]) / 2;
    const mv = p => { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2]; } return q; };
    return { parts: res.parts.map(q => ({ ...q, p: mv(q.p) })), whole: res.whole ? mv(res.whole) : null };
  }
  function filaments(res) { return res.options.colors.map(c => ({ color: c.hex, name: c.name })); }
  function export3MF(res, o) {
    o = o || {}; const name = o.name || 'Filament painting', P = placed(res, o.bed);
    const parts = P.parts.map(q => ({ name: q.name, p: q.p, extruder: q.extruder, color: q.color }));
    const ro = res.options;
    return T.threeMF([{ name, parts, settings: { layer_height: String(ro.layer) } }], { title: name, plates: [[0]], bambu: o.bambu === undefined ? ro.bambu : o.bambu, filaments: filaments(res),
      project: { layer_height: String(ro.layer), initial_layer_print_height: String(ro.first), sparse_infill_density: '100%', ironing_type: 'no ironing' } });
  }
  function files(res, o) {
    o = o || {}; const name = o.name || 'Filament painting', base = safe(o.fileBase || name.toLowerCase()) || 'filament_painting', P = placed(res, o.bed);
    const list = [{ name: `${base}.3mf`, data: export3MF(res, o) }];
    if (P.whole) list.push({ name: `${base}_whole_print.stl`, data: new Uint8Array(Core.writeSTL(P.whole, name)) });
    P.parts.forEach(q => list.push({ name: `color_bands/${String(q.k + 1).padStart(2, '0')}_${safe(q.name.replace(/^\d+\s*/, '').toLowerCase()) || 'color'}_${q.color.slice(1)}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }));
    list.push({ name: 'SWAP_INSTRUCTIONS.txt', data: instructions(res, name) });
    return list;
  }

  const api = { FILAMENTS, PRESETS, SHAPES, DETAIL, DEFAULTS, LIMITS, presetColors, options, layers, layerTop, layerAt, fixSwaps, bands, makeSim, simTable, luminance, tone, printSize, grid,
    bandMesh, autoSwaps, build, vertexColors, swapPlan, instructions, export3MF, files, placed, filaments, lightHex, parseHex, toHex, lin, toSrgb, outlineSDF, holeSpec };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPPaint = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
