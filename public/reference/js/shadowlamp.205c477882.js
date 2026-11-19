/* Expressarte shadow lamp: a printable lamp piece whose cast light and shadow redraw a picture (a character, logo or
   silhouette) on a wall when a small light sits inside or behind it.
   Modes: a round lantern (the picture is cut through the curved wall), a square box with the picture on 1, 2 or 4 sides,
   and a flat panel on a stand with the light behind it. Every cut is projected from the light: each hole edge runs along
   the ray from the light (the inner skin is the outer skin scaled toward the light), so the wall's thickness never
   shades the picture and a round wall casts an undistorted picture on a flat wall at the set distance.
   Holes are meshed straight from a sampled field (marching squares on the unrolled wall), so the shell is closed and
   two-manifold by construction; loose islands (eyes, a figure inside a window) get bridges to the frame so nothing falls
   out, and the base (plate, shade collar, tea light or bulb socket holder, cable notch) is built with Manifold.
   World frame (assembled): z = 0 is the table, the picture faces +y toward the wall. Generic names only. American spelling. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);

  const MODES = { cylinder: 'Round lantern', box: 'Square box', panel: 'Flat panel on a stand' };
  const STYLES = { shadow: 'Shadow silhouette (dark figure in a lit window)', light: 'Light picture (the figure glows on the wall)' };
  const WINDOWS = { rect: 'Rounded rectangle', circle: 'Circle (moon)' };
  // Light holders. lightAbove: light center above the holder floor (LED tea light flame tip area, bulb center above the
  // socket rim); block: the holder's top edge that rays from the light must clear (radius, height above the floor).
  const HOLDERS = {
    tealight: { label: 'LED tea light (38 mm)', lightAbove: 26, recessR: 20, recessD: 6, pedR: 22.4, holeD: 16, blockR: 19.5, blockZ: 18 },
    e12: { label: 'E12 candelabra bulb socket', lightAbove: 38, socketD: 22, socketLen: 25, holeD: 9, blockZ: 0 },
    e14: { label: 'E14 small bulb socket', lightAbove: 45, socketD: 29, socketLen: 28, holeD: 9, blockZ: 0 }
  };
  const PALETTE = [
    { name: 'Warm white', hex: '#F2EBDD' }, { name: 'Black', hex: '#1A1A1A' }, { name: 'Charcoal', hex: '#2B2F33' },
    { name: 'Forest green', hex: '#2F6B4F' }, { name: 'Light green', hex: '#8FD3B6' }, { name: 'Orange', hex: '#E07A3A' },
    { name: 'Blue', hex: '#3B82C4' }, { name: 'Red', hex: '#C41E3A' }, { name: 'Gold', hex: '#C9A227' }
  ];
  const DEFAULTS = {
    mode: 'cylinder', style: 'shadow', window: 'rect', stand: true, sample: 'cat', mask: null,
    smooth: 1, minFeature: 1.0, bridge: 1.6, fill: 0.92, copies: 1,
    diameter: 110, height: 160, wall: 2.0, rim: 10, corner: 8,
    panelW: 130, panelH: 150, frame: 8,
    holder: 'tealight', socketD: null, lightAbove: null, lightH: null, lightDist: 70, wallDist: 400,
    base: true, notch: true, notchW: 7,
    colors: { shade: '#F2EBDD', base: '#2B2F33' }, detail: 'hd', bed: [256, 256, 256], bambu: 'A1'
  };
  const B = 8; // block size (cells) for merging flat solid areas
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (v === '' || v == null || !Number.isFinite(+v)) ? d : +v;
  const hex = c => /^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toUpperCase() : null;

  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    o.mode = MODES[o.mode] ? o.mode : 'cylinder';
    o.style = STYLES[o.style] ? o.style : 'shadow';
    o.window = WINDOWS[o.window] ? o.window : 'rect';
    o.stand = o.stand !== false;
    o.holder = HOLDERS[o.holder] ? o.holder : 'tealight';
    o.smooth = clamp(num(o.smooth, 1), 0, 4);
    o.minFeature = clamp(num(o.minFeature, 1), 0.4, 4);
    o.bridge = clamp(num(o.bridge, 1.6), 1.0, 5);
    o.fill = clamp(num(o.fill, 0.92), 0.4, 1);
    o.copies = Math.round(clamp(num(o.copies, 1), 1, 4)); if (o.mode === 'box' && o.copies === 3) o.copies = 4; if (o.mode === 'panel') o.copies = 1;
    o.wall = clamp(num(o.wall, 2), 1.2, 4);
    o.rim = clamp(num(o.rim, 10), 4, 40);
    const minD = o.holder === 'tealight' ? 72 : 56;
    o.diameter = clamp(num(o.diameter, 110), minD, 300);
    o.height = clamp(num(o.height, 160), 60, 350);
    o.corner = clamp(num(o.corner, 8), o.wall + 1, 30);
    o.panelW = clamp(num(o.panelW, 130), 60, 300);
    o.panelH = clamp(num(o.panelH, 150), 60, 300);
    o.frame = clamp(num(o.frame, 8), 4, 30);
    o.lightDist = clamp(num(o.lightDist, 70), 35, 250);
    o.wallDist = clamp(num(o.wallDist, 400), 150, 3000);
    const hd = HOLDERS[o.holder];
    o.socketD = hd.socketD ? clamp(num(o.socketD, hd.socketD), 12, 45) : null;
    o.lightAbove = clamp(num(o.lightAbove, hd.lightAbove), 8, 90);
    o.lightH = o.lightH === '' || o.lightH == null || !Number.isFinite(+o.lightH) ? null : clamp(+o.lightH, 10, 300);
    o.notchW = clamp(num(o.notchW, 7), 3, 14);
    o.base = o.base !== false; o.notch = o.notch !== false;
    o.colors = { shade: hex(o.colors && o.colors.shade) || DEFAULTS.colors.shade, base: hex(o.colors && o.colors.base) || DEFAULTS.colors.base };
    o.detail = o.detail === 'standard' ? 'standard' : 'hd';
    o.bed = Array.isArray(o.bed) && o.bed.length === 3 ? o.bed.map(v => num(v, 256)) : [256, 256, 256];
    return o;
  }

  // ---------------------------------------------------------------- pictures
  // Built-in silhouettes: shapes in a 100 x 100 box (y down), added or cut in order and rasterized.
  const capsules = (pts, r) => pts.slice(1).map((p, i) => ({ k: 'cap', a: pts[i], b: p, r }));
  const SAMPLES = {
    cat: { label: 'Cat', shapes: [
      { k: 'e', c: [44, 72], r: [21, 23] }, { k: 'e', c: [56, 60], r: [11, 16] }, { k: 'c', c: [62, 38], r: 13 },
      { k: 'p', pts: [[51, 33], [53, 15], [62, 27]] }, { k: 'p', pts: [[63, 27], [73, 14], [75, 33]] },
      { k: 'p', pts: [[51, 70], [61, 70], [61, 95], [51, 95]] }, { k: 'e', c: [44, 92], r: [23, 4.5] },
      ...capsules([[26, 90], [14, 84], [9, 72], [12, 60], [19, 52]], 3.6)] },
    bunny: { label: 'Bunny', shapes: [
      { k: 'e', c: [48, 72], r: [24, 20] }, { k: 'c', c: [67, 47], r: 12 }, { k: 'e', c: [61, 22], r: [4.8, 15], rot: -14 },
      { k: 'e', c: [72, 23], r: [4.8, 15], rot: 12 }, { k: 'c', c: [24, 66], r: 6.5 }, { k: 'e', c: [56, 91], r: [16, 4.5] }] },
    bat: { label: 'Bat', shapes: [
      { k: 'p', pts: [[50, 40], [40, 36], [28, 26], [10, 30], [2, 44], [12, 44], [18, 54], [26, 49], [32, 60], [40, 52], [46, 62], [50, 56], [54, 62], [60, 52], [68, 60], [74, 49], [82, 54], [88, 44], [98, 44], [90, 30], [72, 26], [60, 36]] },
      { k: 'e', c: [50, 47], r: [7, 13] }, { k: 'c', c: [50, 33], r: 6.5 }, { k: 'p', pts: [[45, 31], [44, 21], [49, 28]] }, { k: 'p', pts: [[55, 31], [56, 21], [51, 28]] }] },
    tree: { label: 'Pine tree', shapes: [
      { k: 'p', pts: [[50, 4], [70, 34], [30, 34]] }, { k: 'p', pts: [[50, 20], [78, 58], [22, 58]] }, { k: 'p', pts: [[50, 40], [88, 84], [12, 84]] },
      { k: 'p', pts: [[44, 82], [56, 82], [56, 97], [44, 97]] }] },
    star: { label: 'Star', shapes: [{ k: 'p', pts: Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 19 : 48; return [50 + r * Math.cos(a), 54 + r * Math.sin(a)]; }) }] },
    heart: { label: 'Heart', shapes: [{ k: 'p', pts: Array.from({ length: 72 }, (_, i) => { const t = i / 72 * Math.PI * 2; return [50 + 2.9 * 16 * Math.pow(Math.sin(t), 3), 48 - 2.9 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; }) }] },
    moon: { label: 'Moon and stars', shapes: [{ k: 'c', c: [44, 52], r: 38 }, { k: 'c', c: [62, 42], r: 32, sub: true },
      { k: 'p', pts: Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.4 : 8; return [80 + r * Math.cos(a), 72 + r * Math.sin(a)]; }) },
      { k: 'p', pts: Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.4 : 5.6; return [70 + r * Math.cos(a), 18 + r * Math.sin(a)]; }) }] }
  };
  function inPoly(x, y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function inShape(s, x, y) {
    if (s.k === 'c') return (x - s.c[0]) ** 2 + (y - s.c[1]) ** 2 <= s.r * s.r;
    if (s.k === 'e') { const r = (s.rot || 0) * Math.PI / 180, dx = x - s.c[0], dy = y - s.c[1], u = dx * Math.cos(r) + dy * Math.sin(r), v = -dx * Math.sin(r) + dy * Math.cos(r); return (u / s.r[0]) ** 2 + (v / s.r[1]) ** 2 <= 1; }
    if (s.k === 'cap') { const ax = s.b[0] - s.a[0], ay = s.b[1] - s.a[1], t = clamp(((x - s.a[0]) * ax + (y - s.a[1]) * ay) / (ax * ax + ay * ay), 0, 1); return (x - s.a[0] - t * ax) ** 2 + (y - s.a[1] - t * ay) ** 2 <= s.r * s.r; }
    return inPoly(x, y, s.pts);
  }
  // a mask is { w, h, d: Float32Array (1 = the figure) } cropped to the figure with a small margin
  function sampleMask(name, res) {
    const S = SAMPLES[name] || SAMPLES.cat, n = res || 320, d = new Uint8Array(n * n), ss = 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let hit = 0;
      for (let a = 0; a < ss; a++) for (let b = 0; b < ss; b++) {
        const x = (i + (a + 0.5) / ss) * 100 / n, y = (j + (b + 0.5) / ss) * 100 / n; let v = false;
        for (const s of S.shapes) if (inShape(s, x, y)) v = !s.sub; hit += v ? 1 : 0;
      }
      d[j * n + i] = hit * 2 >= ss * ss ? 1 : 0;
    }
    return crop({ w: n, h: n, d });
  }
  // Image \u2192 mask: dark pixels are the figure (light ones with invert); clear pixels are background; a photo can drop a
  // plain background connected to the border first.
  function traceMask(gray, alpha, w, h, o) {
    o = o || {}; const th = o.threshold == null ? 0.5 : o.threshold, d = new Uint8Array(w * h);
    for (let k = 0; k < w * h; k++) { const a = alpha ? alpha[k] : 1; const dark = gray[k] < th; d[k] = a < 0.5 ? (o.invert && !alpha ? 1 : 0) : ((o.invert ? !dark : dark) ? 1 : 0); }
    if (o.dropBg) { // flood the border-connected region of the border's typical value
      const seen = new Uint8Array(w * h), st = []; const push = k => { if (!seen[k] && Math.abs(gray[k] - gray[0]) < (o.dropTol || 0.18)) { seen[k] = 1; st.push(k); } };
      for (let i = 0; i < w; i++) { push(i); push((h - 1) * w + i); } for (let j = 0; j < h; j++) { push(j * w); push(j * w + w - 1); }
      while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; d[k] = 0; if (x > 0) push(k - 1); if (x < w - 1) push(k + 1); if (y > 0) push(k - w); if (y < h - 1) push(k + w); }
      for (let k = 0; k < w * h; k++) if (!seen[k] && (!alpha || alpha[k] >= 0.5)) d[k] = 1;
    }
    return crop({ w, h, d });
  }
  function crop(m) {
    let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (m.d[j * m.w + i]) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    if (x1 < 0) return null;
    const pad = Math.max(2, Math.round(0.03 * Math.max(x1 - x0, y1 - y0))), W = x1 - x0 + 1 + 2 * pad, H = y1 - y0 + 1 + 2 * pad, d = new Float32Array(W * H);
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) d[(j - y0 + pad) * W + (i - x0 + pad)] = m.d[j * m.w + i];
    return { w: W, h: H, d, pad };
  }
  // separable box blur, applied twice (close to a Gaussian); radius in pixels
  function blur(m, r) {
    if (!(r > 0)) return m;
    const { w, h } = m; let a = Float32Array.from(m.d), b = new Float32Array(w * h); const R = Math.max(1, Math.round(r));
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < h; j++) { let s = 0, c = 0; for (let i = -R; i <= R; i++) if (i >= 0 && i < w) { s += a[j * w + i]; c++; } for (let i = 0; i < w; i++) { b[j * w + i] = s / c; const o = i - R, n = i + R + 1; if (o >= 0) { s -= a[j * w + o]; c--; } if (n < w) { s += a[j * w + n]; c++; } } }
      for (let i = 0; i < w; i++) { let s = 0, c = 0; for (let j = -R; j <= R; j++) if (j >= 0 && j < h) { s += b[j * w + i]; c++; } for (let j = 0; j < h; j++) { a[j * w + i] = s / c; const o = j - R, n = j + R + 1; if (o >= 0) { s -= b[o * w + i]; c--; } if (n < h) { s += b[n * w + i]; c++; } } }
    }
    return { w, h, d: a, pad: m.pad };
  }
  function sampleBilinear(m, x, y) { // x, y in 0..1 over the mask
    const fx = x * m.w - 0.5, fy = y * m.h - 0.5, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const at = (a, b) => (a < 0 || b < 0 || a >= m.w || b >= m.h) ? 0 : m.d[b * m.w + a];
    return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - ty) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * ty;
  }

  // ---------------------------------------------------------------- outlines
  // Rounded square of half-width A and corner radius rc (rc = A is a circle), walked counterclockwise from (0, -A).
  function outline(A, rc) {
    rc = Math.min(rc, A); const a = A - rc, segs = [], q = Math.PI / 2;
    const L = (x, y, dx, dy, len) => { if (len > 1e-9) segs.push({ t: 'l', x, y, dx, dy, len }); };
    const R = (cx, cy, a0) => { if (rc > 1e-9) segs.push({ t: 'a', cx, cy, a0, len: rc * q }); };
    L(0, -A, 1, 0, a); R(a, -a, -q); L(A, -a, 0, 1, 2 * a); R(a, a, 0); L(a, A, -1, 0, 2 * a); R(-a, a, q); L(-A, a, 0, -1, 2 * a); R(-a, -a, 2 * q); L(-a, -A, 1, 0, a);
    const perim = segs.reduce((s, g) => s + g.len, 0);
    function at(s) {
      s = ((s % perim) + perim) % perim;
      for (const g of segs) {
        if (s <= g.len + 1e-12) {
          if (g.t === 'l') return [g.x + g.dx * s, g.y + g.dy * s, g.dy, -g.dx];
          const t = g.a0 + s / rc, c = Math.cos(t), sn = Math.sin(t); return [g.cx + rc * c, g.cy + rc * sn, c, sn];
        }
        s -= g.len;
      }
      const g = segs[segs.length - 1]; return [g.x + g.dx * g.len, g.y + g.dy * g.len, g.dy, -g.dx];
    }
    function poly(n) { const out = []; for (let i = 0; i < n; i++) { const p = at(i / n * perim); out.push([p[0], p[1]]); } return out; }
    return { A, rc, a, perim, at, poly };
  }
  // distance from the center to a rounded square along the direction (cos f, sin f)
  function radial(f, A, rc) {
    rc = Math.min(rc, A); const a = A - rc, dx = Math.abs(Math.cos(f)), dy = Math.abs(Math.sin(f));
    if (dx > 1e-12) { const t = A / dx; if (t * dy <= a + 1e-12) return t; }
    if (dy > 1e-12) { const t = A / dy; if (t * dx <= a + 1e-12) return t; }
    const dc = dx * a + dy * a, disc = dc * dc - 2 * a * a + rc * rc; return dc + Math.sqrt(Math.max(0, disc));
  }

  // ---------------------------------------------------------------- layout
  function layout(o) {
    const hd = HOLDERS[o.holder], warnings = [];
    const panel = o.mode === 'panel', t = o.wall;
    const plateT = panel ? 4 : 5, railH = 8;
    const A = panel ? 0 : o.diameter / 2, rc = o.mode === 'box' ? Math.min(o.corner, A - 1) : A;
    const z0 = panel ? plateT + railH : plateT; // bottom of the shade or panel (world)
    const Hs = panel ? o.panelH : o.height;
    // holder: floor height and the light
    const pedR = o.holder === 'tealight' ? hd.pedR : o.socketD / 2 + 2.4;
    const floorMin = o.holder === 'tealight' ? plateT : plateT + hd.socketLen + 2;
    const yL = panel ? -(t + o.lightDist) : 0;
    let zL;
    if (o.lightH != null) zL = (panel ? plateT : z0) + o.lightH; // above the base plate top / shade bottom
    else zL = panel ? Math.max(floorMin + o.lightAbove, z0 + o.frame) : floorMin + o.lightAbove;
    let floor = zL - o.lightAbove;
    if (floor < floorMin - 1e-9) { floor = floorMin; const was = zL; zL = floor + o.lightAbove; if (o.lightH != null && Math.abs(was - zL) > 0.5) warnings.push(`The light can't sit lower than ${Math.round(zL - (panel ? plateT : z0))} mm with this holder, so it sits there.`); }
    if (!panel && zL > z0 + Hs - 15) { zL = z0 + Hs - 15; floor = zL - o.lightAbove; warnings.push('The light was above the top of the shade, so it sits 15 mm below the top.'); }
    const blockR = o.holder === 'tealight' ? hd.blockR : pedR, blockZ = floor + hd.blockZ;
    // shade: picture band (world z) and the picture's place on the wall
    const dmin = panel ? t + o.lightDist : (o.mode === 'box' ? A : A); // nearest horizontal distance from the light to the outer skin
    let zb0 = z0 + (panel ? o.frame : o.rim), zb1 = z0 + Hs - (panel ? o.frame : o.rim);
    if (zL > blockZ + 0.5) zb0 = Math.max(zb0, zL - dmin * (zL - blockZ) / blockR + 1.5);
    else zb0 = Math.max(zb0, zL + 2);
    if (zb1 - zb0 < 15) warnings.push('There is very little room for the picture: make the shade taller or raise the light.');
    const faces = [];
    const nF = o.copies;
    if (panel) faces.push({ n: [0, 1], r: [1, 0], psi: Math.PI / 2 });
    else if (o.mode === 'box') { const order = nF === 1 ? [90] : nF === 2 ? [90, 270] : [90, 180, 270, 0]; for (const d of order) { const f = d * Math.PI / 180; faces.push({ n: [Math.cos(f), Math.sin(f)], r: [Math.sin(f), -Math.cos(f)], psi: f }); } }
    else for (let k = 0; k < nF; k++) { const f = Math.PI / 2 + k * 2 * Math.PI / nF; faces.push({ n: [Math.cos(f), Math.sin(f)], r: [Math.sin(f), -Math.cos(f)], psi: f }); }
    const alphaMax = o.mode === 'cylinder' ? Math.min(65, 180 / nF - 6) * Math.PI / 180 : 0;
    const Dw = o.wallDist; // from the lamp's axis (round, box) or the panel's front face
    const Sv = panel ? (Dw + t + o.lightDist) / (t + o.lightDist) : Dw / A; // magnification straight ahead
    const Xmax = panel ? (o.panelW / 2 - o.frame) * Sv : o.mode === 'box' ? Math.max(5, rc < A ? (A - rc - 1.5) : 0) * Sv : Dw * Math.tan(alphaMax);
    const floorMargin = 20;
    return { panel, t, plateT, railH, A, rc, z0, Hs, pedR, floor, floorMin, zL, yL, blockR, blockZ, zb0, zb1, faces, alphaMax, Dw, Sv, Xmax, floorMargin, warnings, holder: o.holder, hd };
  }
  // the picture: the figure (and its window, for shadow style) in a box of aspect ratio `aspect`
  function picture(o, mask) {
    const m = blur(mask, o.smooth * Math.max(mask.w, mask.h) / 240);
    if (o.style === 'light') return { aspect: mask.w / mask.h, m, mx0: 0, my0: 0, mw: 1, mh: 1, win: null };
    const mg = 0.12, mw = mask.w, mh = mask.h, big = Math.max(mw, mh);
    if (o.window === 'circle') {
      const D = Math.hypot(mw, mh) * 1.02, s = D; // square window, figure centered
      return { aspect: 1, m, mx0: (s - mw) / 2 / s, my0: (s - mh) / 2 / s, mw: mw / s, mh: mh / s, win: 'circle' };
    }
    const W = mw + 2 * mg * big, H = mh + mg * big + (o.stand ? 0 : mg * big);
    return { aspect: W / H, m, mx0: mg * big / W, my0: mg * big / H, mw: mw / W, mh: mh / H, win: 'rect', stand: o.stand };
  }
  // fit the picture's rectangle on the wall inside what the band can reach
  function fitRect(o, Ly, aspect) {
    const { zL, Dw, Sv } = Ly;
    let Xh = Ly.Xmax, rect = null;
    for (let it = 0; it < 4; it++) {
      // vertical range at the center and at the widest angle (round shade: the band reaches further out to the side)
      const ranges = [Sv];
      if (o.mode === 'cylinder') { const d = Math.atan2(Xh, Dw); ranges.push(Dw / (Ly.A * Math.cos(d))); }
      let lo = -Infinity, hi = Infinity;
      for (const S of ranges) { lo = Math.max(lo, zL + (Ly.zb0 - zL) * S); hi = Math.min(hi, zL + (Ly.zb1 - zL) * S); }
      lo = Math.max(lo, Ly.floorMargin);
      const Hr = Math.max(1, hi - lo);
      let h = Math.min(Hr, 2 * Ly.Xmax / aspect) * o.fill, w = h * aspect;
      rect = { x0: -w / 2, w, zt: (lo + hi) / 2 + h / 2, h, lo, hi };
      if (o.mode !== 'cylinder' || Math.abs(w / 2 - Xh) < 0.5) break;
      Xh = w / 2;
    }
    return rect;
  }

  // ---------------------------------------------------------------- the sampled field
  // Nodes on the unrolled outer skin: u across, v up. g = how open (a hole) each node is; < 0.5 is solid.
  function grid(o, Ly) {
    const h = o.detail === 'hd' ? 0.42 : 0.75;
    let NU, NV, wrap, hu, hv, u0, v0, OL = null, Wp = 0;
    if (Ly.panel) {
      Wp = o.panelW; const nu = Math.max(8, Math.round(Wp / h)); hu = Wp / nu; NU = nu + 3; u0 = -1.5 * hu; wrap = false;
    } else {
      OL = outline(Ly.A, Ly.rc); NU = Math.max(B * 8, Math.round(OL.perim / h / B) * B); hu = OL.perim / NU; u0 = 0; wrap = true;
    }
    const nv = Math.max(8, Math.round(Ly.Hs / h)); hv = Ly.Hs / nv;
    const tabRows = Ly.panel ? Math.ceil((Ly.railH + 2.5) / hv) + 1 : 0;
    v0 = -1.5 * hv - tabRows * hv; NV = nv + 3 + tabRows;
    return { NU, NV, wrap, hu, hv, u0, v0, OL, Wp, h: Math.max(hu, hv) };
  }
  function nodePositions(o, Ly, Gd) {
    const { NU, NV } = Gd, N = NU * NV, O = new Float64Array(N * 3), I = new Float64Array(N * 3);
    const zL = Ly.zL, t = Ly.t;
    if (Ly.panel) {
      const Wp = Gd.Wp, Hp = Ly.Hs, k = o.lightDist / (o.lightDist + t), fw = Math.max(1, o.frame * 0.8);
      for (let j = 0; j < NV; j++) {
        const v = Gd.v0 + j * Gd.hv, z = Ly.z0 + v;
        for (let i = 0; i < NU; i++) {
          const u = Gd.u0 + i * Gd.hu, x = Wp / 2 - u, n = (j * NU + i) * 3;
          O[n] = x; O[n + 1] = 0; O[n + 2] = z;
          const w = clamp(Math.min(u, Wp - u, v, Hp - v) / fw, 0, 1);
          I[n] = x + w * (x * k - x); I[n + 1] = -t; I[n + 2] = z + w * (zL + (z - zL) * k - z);
        }
      }
    } else {
      const OL = Gd.OL, Hs = Ly.Hs, rw = Math.max(1, o.rim * 0.8), Ai = Ly.A - t, rci = Math.max(0, Ly.rc - t);
      const col = [];
      for (let i = 0; i < NU; i++) { const p = OL.at(i * Gd.hu), f = Math.atan2(p[1], p[0]), r = Math.hypot(p[0], p[1]); col.push([p[0], p[1], radial(f, Ai, rci) / r]); }
      for (let j = 0; j < NV; j++) {
        const v = Gd.v0 + j * Gd.hv, z = Ly.z0 + v, w = clamp(Math.min(v, Hs - v) / rw, 0, 1);
        for (let i = 0; i < NU; i++) {
          const c = col[i], n = (j * NU + i) * 3;
          O[n] = c[0]; O[n + 1] = c[1]; O[n + 2] = z;
          I[n] = c[0] * c[2]; I[n + 1] = c[1] * c[2]; I[n + 2] = z + w * (zL + (z - zL) * c[2] - z);
        }
      }
    }
    return { O, I };
  }
  // wall coordinates of the ray from the light through outer point (x, y, z), for picture face f; null when the point
  // does not belong to that face
  function toWall(o, Ly, f, x, y, z) {
    if (Ly.panel) { const S = (Ly.Dw + Ly.t + o.lightDist) / (Ly.t + o.lightDist); return [x * S, Ly.zL + (z - Ly.zL) * S]; }
    const dn = x * f.n[0] + y * f.n[1]; if (dn <= 1e-6) return null;
    const lat = x * f.r[0] + y * f.r[1];
    if (o.mode === 'box') { if (Math.abs(dn - Ly.A) > 1e-6 || Math.abs(lat) > Ly.A - Ly.rc - 1.0) return null; }
    else { if (Math.abs(Math.atan2(lat, dn)) > Ly.alphaMax + 1e-9) return null; }
    const S = Ly.Dw / dn; return [lat * S, Ly.zL + (z - Ly.zL) * S];
  }
  function field(o, Ly, Gd, pos, pic, rect) {
    const { NU, NV } = Gd, N = NU * NV, g = new Float32Array(N), O = pos.O;
    const soft = Math.max(Gd.hu, Gd.hv);
    const winSoft = soft * Ly.Sv; // a node step, measured on the wall
    const Wp = Gd.Wp, Hp = Ly.Hs, tabs = Ly.panel ? tabSpots(o, Ly) : [];
    for (let j = 0; j < NV; j++) {
      const v = Gd.v0 + j * Gd.hv;
      for (let i = 0; i < NU; i++) {
        const n = j * NU + i, u = Gd.u0 + i * Gd.hu;
        // outside the part: open
        let sd;
        if (Ly.panel) {
          const r = Math.min(6, o.frame), qx = Math.abs(u - Wp / 2) - (Wp / 2 - r), qz = Math.abs(v - Hp / 2) - (Hp / 2 - r);
          sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
          for (const tb of tabs) { const sx = Math.max(Math.abs(u - tb.u) - tb.w / 2, v - 0.5, -v - tb.h); sd = Math.min(sd, sx); }
        } else sd = Math.max(-v, v - Hp);
        const gOut = clamp(0.5 + sd / soft, 0, 1);
        if (gOut >= 0.5) { g[n] = gOut; continue; }
        let gp = 0;
        const z = O[n * 3 + 2];
        if (z > Ly.zb0 && z < Ly.zb1) {
          for (const f of Ly.faces) {
            const w = toWall(o, Ly, f, O[n * 3], O[n * 3 + 1], z); if (!w) continue;
            const ix = (w[0] - rect.x0) / rect.w, iy = (rect.zt - w[1]) / rect.h;
            if (ix < 0 || ix > 1 || iy < 0 || iy > 1) break;
            gp = picValue(pic, ix, iy, rect, winSoft); break;
          }
        }
        g[n] = Math.max(gp, gOut);
      }
    }
    return g;
  }
  function picValue(pic, ix, iy, rect, winSoft) {
    const mx = (ix - pic.mx0) / pic.mw, my = (iy - pic.my0) / pic.mh;
    const m = (mx >= 0 && mx <= 1 && my >= 0 && my <= 1) ? sampleBilinear(pic.m, mx, my) : 0;
    if (!pic.win) return m;
    // window value from its signed distance on the wall (mm)
    const x = ix * rect.w, z = iy * rect.h; let sd;
    if (pic.win === 'circle') sd = Math.hypot(x - rect.w / 2, z - rect.h / 2) - Math.min(rect.w, rect.h) / 2;
    else { const r = 0.06 * Math.min(rect.w, rect.h), qx = Math.abs(x - rect.w / 2) - (rect.w / 2 - r), qz = Math.abs(z - rect.h / 2) - (rect.h / 2 - r); sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r; }
    const win = clamp(0.5 - sd / winSoft, 0, 1);
    return Math.min(win, 1 - m);
  }
  function tabSpots(o, Ly) {
    const Wp = o.panelW, w = 14, h = Ly.railH + 2.5 - 0.4;
    return [{ u: Wp * 0.25, w, h }, { u: Wp * 0.75, w, h }];
  }

  // ---------------------------------------------------------------- cleanup and bridges on the node grid
  function neighbors4(Gd, n, out) {
    const { NU, NV, wrap } = Gd, i = n % NU, j = (n / NU) | 0; let c = 0;
    if (i > 0) out[c++] = n - 1; else if (wrap) out[c++] = n + NU - 1;
    if (i < NU - 1) out[c++] = n + 1; else if (wrap) out[c++] = n - NU + 1;
    if (j > 0) out[c++] = n - NU; if (j < NV - 1) out[c++] = n + NU;
    return c;
  }
  function label(Gd, solid, want) { // 4-connected components of solid === want
    const N = Gd.NU * Gd.NV, lab = new Int32Array(N).fill(-1), sizes = [], st = new Int32Array(N), nb = new Int32Array(4);
    for (let s = 0; s < N; s++) {
      if (solid[s] !== want || lab[s] >= 0) continue;
      const id = sizes.length; let top = 0, sz = 0; st[top++] = s; lab[s] = id;
      while (top) { const n = st[--top]; sz++; const c = neighbors4(Gd, n, nb); for (let q = 0; q < c; q++) { const m = nb[q]; if (solid[m] === want && lab[m] < 0) { lab[m] = id; st[top++] = m; } } }
      sizes.push(sz);
    }
    return { lab, sizes };
  }
  function cleanAndBridge(o, Ly, Gd, g, inside) {
    const { NU, NV } = Gd, N = NU * NV, cellA = Gd.hu * Gd.hv;
    const solidOf = () => { const s = new Uint8Array(N); for (let n = 0; n < N; n++) s[n] = g[n] < 0.5 ? 1 : 0; return s; };
    let solid = solidOf();
    // tiny holes close up; tiny loose specks drop out
    const minA = o.minFeature * o.minFeature;
    { const H = label(Gd, solid, 0); for (let n = 0; n < N; n++) if (inside[n] && H.sizes[H.lab[n]] * cellA < minA) g[n] = 0.25; }
    solid = solidOf();
    { const S = label(Gd, solid, 1); let big = 0; S.sizes.forEach((s, i) => { if (s > S.sizes[big]) big = i; }); for (let n = 0; n < N; n++) if (solid[n] && S.lab[n] !== big && S.sizes[S.lab[n]] * cellA < minA * 2) g[n] = 0.75; }
    const bridges = [];
    const uOf = n => Gd.u0 + (n % NU) * Gd.hu, vOf = n => Gd.v0 + ((n / NU) | 0) * Gd.hv;
    const du = (a, b) => { let d = b - a; if (Gd.wrap) { const P = NU * Gd.hu; if (d > P / 2) d -= P; if (d < -P / 2) d += P; } return d; };
    for (let round = 0; round < 6; round++) {
      solid = solidOf();
      const S = label(Gd, solid, 1); if (S.sizes.length <= 1) break;
      let main = 0; S.sizes.forEach((s, i) => { if (s > S.sizes[main]) main = i; });
      // multi-source BFS from the main body over every node (8 neighbors), remembering the source node
      const dist = new Int32Array(N).fill(-1), src = new Int32Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
      for (let n = 0; n < N; n++) if (solid[n] && S.lab[n] === main) { dist[n] = 0; src[n] = n; q[qt++] = n; }
      while (qh < qt) {
        const n = q[qh++], i = n % NU, j = (n / NU) | 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue; let ii = i + di; const jj = j + dj; if (jj < 0 || jj >= NV) continue;
          if (ii < 0 || ii >= NU) { if (!Gd.wrap) continue; ii = (ii + NU) % NU; }
          const m = jj * NU + ii; if (dist[m] >= 0 || !inside[m]) continue; dist[m] = dist[n] + 1; src[m] = src[n]; q[qt++] = m;
        }
      }
      const best = new Map();
      for (let n = 0; n < N; n++) {
        if (!solid[n] || S.lab[n] === main || dist[n] < 0) continue;
        const id = S.lab[n], e = best.get(id), L = Math.hypot(du(uOf(n), uOf(src[n])), vOf(src[n]) - vOf(n));
        if (!e) best.set(id, { n, L, nodes: [n] }); else { e.nodes.push(n); if (L < e.L) { e.n = n; e.L = L; } }
      }
      if (!best.size) break;
      for (const [, e] of best) {
        const list = [e.n];
        // a big island gets a second bridge on its far side
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const n of e.nodes) { const u = du(uOf(e.n), uOf(n)), v = vOf(n); x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
        const span = Math.hypot(x1 - x0, y1 - y0);
        if (round === 0 && span > 18) {
          let b2 = -1, L2 = Infinity;
          for (const n of e.nodes) { const away = Math.hypot(du(uOf(e.n), uOf(n)), vOf(n) - vOf(e.n)); if (away < span * 0.5) continue; const L = Math.hypot(du(uOf(n), uOf(src[n])), vOf(src[n]) - vOf(n)); if (L < L2) { L2 = L; b2 = n; } }
          if (b2 >= 0) list.push(b2);
        }
        for (const a of list) {
          const b = src[a], ua = uOf(a), va = vOf(a), ub = ua + du(ua, uOf(b)), vb = vOf(b);
          // extend each end a little into the solid so the joint is solid
          const L = Math.hypot(ub - ua, vb - va) || 1, ex = (ub - ua) / L, ey = (vb - va) / L, ext = o.bridge * 0.6;
          drawBridge(Gd, g, inside, ua - ex * ext, va - ey * ext, ub + ex * ext, vb + ey * ext, o.bridge);
          bridges.push({ a: [ua, va], b: [ub, vb], len: L });
        }
      }
    }
    solid = solidOf();
    const S = label(Gd, solid, 1);
    return { bridges, islands: S.sizes.length - 1 };
  }
  function drawBridge(Gd, g, inside, ua, va, ub, vb, bw) {
    const { NU, NV } = Gd, h = Math.min(Gd.hu, Gd.hv), r = bw / 2 + 2 * h;
    const i0 = Math.floor((Math.min(ua, ub) - r - Gd.u0) / Gd.hu), i1 = Math.ceil((Math.max(ua, ub) + r - Gd.u0) / Gd.hu);
    const j0 = Math.max(0, Math.floor((Math.min(va, vb) - r - Gd.v0) / Gd.hv)), j1 = Math.min(NV - 1, Math.ceil((Math.max(va, vb) + r - Gd.v0) / Gd.hv));
    const ax = ub - ua, ay = vb - va, LL = ax * ax + ay * ay || 1;
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
      let i = ii; if (i < 0 || i >= NU) { if (!Gd.wrap) continue; i = ((i % NU) + NU) % NU; }
      const n = j * NU + i; if (!inside[n]) continue;
      const x = Gd.u0 + ii * Gd.hu, y = Gd.v0 + j * Gd.hv, t = clamp(((x - ua) * ax + (y - va) * ay) / LL, 0, 1);
      const d = Math.hypot(x - ua - t * ax, y - va - t * ay), gb = clamp(0.5 + (d - bw / 2) / Math.max(Gd.hu, Gd.hv), 0, 1);
      if (gb < g[n]) g[n] = gb;
    }
  }

  // ---------------------------------------------------------------- mesh
  // Marching squares over the node grid; solid corners are separated at saddles (consistent with the 4-connected
  // labeling above). Fully solid 8 x 8 blocks become one fan. Outer skin faces outward, inner skin inward, and every
  // contour gets a side wall from the outer to the inner skin.
  function meshField(Gd, g, pos) {
    const { NU, NV, wrap } = Gd, N = NU * NV, O = pos.O, I = pos.I;
    for (let n = 0; n < N; n++) { const d = g[n] - 0.5; if (Math.abs(d) < 1e-3) g[n] = 0.5 + (d < 0 ? -1e-3 : 1e-3); }
    const solid = n => g[n] < 0.5;
    const P = []; const vid = new Int32Array(N * 2).fill(-1), eid = new Int32Array(N * 4).fill(-1);
    const nodeV = (n, s) => { let id = vid[2 * n + s]; if (id < 0) { const A = s ? I : O; id = P.length / 3; P.push(A[3 * n], A[3 * n + 1], A[3 * n + 2]); vid[2 * n + s] = id; } return id; };
    const edgeV = (a, b, dir, s) => {
      const key = 4 * a + 2 * dir + s; let id = eid[key];
      if (id < 0) { let t = (0.5 - g[a]) / (g[b] - g[a]); t = clamp(t, 0.02, 0.98); const A = s ? I : O; id = P.length / 3; P.push(A[3 * a] + t * (A[3 * b] - A[3 * a]), A[3 * a + 1] + t * (A[3 * b + 1] - A[3 * a + 1]), A[3 * a + 2] + t * (A[3 * b + 2] - A[3 * a + 2])); eid[key] = id; }
      return id;
    };
    const tri = [];
    const nIdx = (i, j) => j * NU + (wrap ? ((i % NU) + NU) % NU : i);
    const cellsU = wrap ? NU : NU - 1, nbU = Math.floor(cellsU / B), nbV = Math.floor((NV - 1) / B);
    const full = new Uint8Array(nbU * nbV);
    for (let bj = 0; bj < nbV; bj++) for (let bi = 0; bi < nbU; bi++) {
      let ok = 1; for (let j = bj * B; j <= bj * B + B && ok; j++) for (let i = bi * B; i <= bi * B + B; i++) if (!solid(nIdx(i, j))) { ok = 0; break; }
      full[bj * nbU + bi] = ok;
    }
    const isFull = (bi, bj) => { if (bj < 0 || bj >= nbV) return false; if (bi < 0 || bi >= nbU) { if (!wrap || nbU * B !== NU) return false; bi = (bi + nbU) % nbU; } return !!full[bj * nbU + bi]; };
    const emitPoly = items => { // items: ['n', node] or ['e', a, b, dir]; polygon counterclockwise in (u, v)
      const ids = s => items.map(it => it[0] === 'n' ? nodeV(it[1], s) : edgeV(it[1], it[2], it[3], s));
      const o = ids(0), inn = ids(1);
      for (let k = 1; k + 1 < o.length; k++) { tri.push(o[0], o[k], o[k + 1]); tri.push(inn[0], inn[k + 1], inn[k]); }
      for (let k = 0; k < items.length; k++) {
        const p = items[k], q = items[(k + 1) % items.length];
        if (p[0] === 'e' && q[0] === 'e') { const po = o[k], qo = o[(k + 1) % items.length], pi = inn[k], qi = inn[(k + 1) % items.length]; tri.push(po, qi, qo); tri.push(po, pi, qi); }
      }
    };
    // full blocks
    for (let bj = 0; bj < nbV; bj++) for (let bi = 0; bi < nbU; bi++) {
      if (!full[bj * nbU + bi]) continue;
      const i0 = bi * B, j0 = bj * B, sides = [!isFull(bi, bj - 1), !isFull(bi + 1, bj), !isFull(bi, bj + 1), !isFull(bi - 1, bj)], ring = [];
      const add = (i, j) => ring.push(nIdx(i, j));
      for (let k = 0; k < B; k++) if (k === 0 || sides[0]) add(i0 + k, j0);
      for (let k = 0; k < B; k++) if (k === 0 || sides[1]) add(i0 + B, j0 + k);
      for (let k = 0; k < B; k++) if (k === 0 || sides[2]) add(i0 + B - k, j0 + B);
      for (let k = 0; k < B; k++) if (k === 0 || sides[3]) add(i0, j0 + B - k);
      for (const s of [0, 1]) {
        const r = ring.map(n => nodeV(n, s));
        if (r.length === 4) { if (s) tri.push(r[0], r[2], r[1], r[0], r[3], r[2]); else tri.push(r[0], r[1], r[2], r[0], r[2], r[3]); }
        else { const c = nodeV(nIdx(i0 + B / 2, j0 + B / 2), s); for (let k = 0; k < r.length; k++) { const a = r[k], b = r[(k + 1) % r.length]; if (s) tri.push(c, b, a); else tri.push(c, a, b); } }
      }
    }
    // fine cells
    for (let j = 0; j < NV - 1; j++) for (let i = 0; i < cellsU; i++) {
      const bi = Math.floor(i / B), bj = Math.floor(j / B);
      if (bi < nbU && bj < nbV && full[bj * nbU + bi]) continue;
      const c = [nIdx(i, j), nIdx(i + 1, j), nIdx(i + 1, j + 1), nIdx(i, j + 1)], s = c.map(solid);
      const cnt = s[0] + s[1] + s[2] + s[3]; if (!cnt) continue;
      // edges: 0: c0-c1 (h at c0), 1: c1-c2 (v at c1), 2: c3-c2 (h at c3), 3: c0-c3 (v at c0)
      const E = [['e', c[0], c[1], 0], ['e', c[1], c[2], 1], ['e', c[3], c[2], 0], ['e', c[0], c[3], 1]];
      if (cnt === 4) { emitPoly(c.map(n => ['n', n])); continue; }
      if (cnt === 2 && s[0] === s[2]) { // saddle: keep the two solid corners apart
        if (s[0]) { emitPoly([['n', c[0]], E[0], E[3]]); emitPoly([E[1], ['n', c[2]], E[2]]); }
        else { emitPoly([E[0], ['n', c[1]], E[1]]); emitPoly([E[2], ['n', c[3]], E[3]]); }
        continue;
      }
      const items = [];
      for (let k = 0; k < 4; k++) { if (s[k]) items.push(['n', c[k]]); if (s[k] !== s[(k + 1) % 4]) items.push(E[k]); }
      emitPoly(items);
    }
    const p = new Float32Array(tri.length * 3);
    for (let k = 0; k < tri.length; k++) { const v = tri[k] * 3; p[k * 3] = P[v]; p[k * 3 + 1] = P[v + 1]; p[k * 3 + 2] = P[v + 2]; }
    return p;
  }

  // ---------------------------------------------------------------- base (Manifold)
  function kit(M) {
    const all = [], k = x => { all.push(x); return x; };
    const ccw = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a < 0 ? pts.slice().reverse() : pts; };
    const prism = (rings, z0, z1) => k(k(M.Manifold.extrude(k(new M.CrossSection(rings.map((r, i) => i ? ccw(r).slice().reverse() : ccw(r)), 'Positive')), z1 - z0)).translate([0, 0, z0]));
    const cyl = (r, z0, z1, x, y) => k(k(M.Manifold.cylinder(z1 - z0, r, r, Math.max(48, Math.min(160, Math.round(r * 5))))).translate([x || 0, y || 0, z0]));
    const box = (x0, y0, z0, x1, y1, z1) => k(k(M.Manifold.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const union = a => { a = a.filter(Boolean); return a.length === 1 ? a[0] : k(M.Manifold.union(a)); };
    const sub = (a, b) => { b = b.filter(Boolean); return b.length ? k(a.subtract(union(b))) : a; };
    const soup = m => { const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float32Array(F.length * 3); for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; } return p; };
    const free = () => { for (const x of all) { try { x.delete(); } catch (e) {} } all.length = 0; };
    return { prism, cyl, box, union, sub, soup, free };
  }
  function holderParts(K, o, Ly, x, y) { // pedestal solid and its cuts
    const hd = Ly.hd, top = Ly.floor + (o.holder === 'tealight' ? hd.recessD : 0);
    if (o.holder === 'tealight') {
      return { solid: [K.cyl(hd.pedR, 0, top, x, y)], cuts: [K.cyl(hd.recessR, Ly.floor, top + 1, x, y), K.cyl(hd.holeD / 2, -1, top + 1, x, y)] };
    }
    const rS = o.socketD / 2;
    return { solid: [K.cyl(rS + 2.4, 0, top, x, y)], cuts: [K.cyl(rS, top - hd.socketLen, top + 1, x, y), K.cyl(hd.holeD / 2, -1, top + 1, x, y)] };
  }
  function buildBase(o, Ly, M) {
    const K = kit(M);
    try {
      const hd = Ly.hd, notchH = Ly.plateT - 1.6;
      let solid = [], cuts = [];
      if (!Ly.panel) {
        const ol = (d, n) => outline(Ly.A - d, Math.max(0, Ly.rc - d)).poly(n);
        const n = 192;
        solid.push(K.prism([ol(-3, n)], 0, Ly.plateT));
        const c0 = Ly.t + 0.35, c1 = c0 + 2.2;
        solid.push(K.prism([ol(c0, n), ol(c1, n)], Ly.plateT - 0.01, Ly.plateT + 5));
        const H = holderParts(K, o, Ly, 0, 0); solid.push(...H.solid); cuts.push(...H.cuts);
        if (o.notch) cuts.push(K.box(-o.notchW / 2, 0, -1, o.notchW / 2, Ly.A + 10, notchH));
      } else {
        const W = o.panelW, t = Ly.t, yL = Ly.yL, back = yL - Ly.pedR - 10, front = 14, xr = W / 2 + 8;
        const r = 8, rr = []; const cs = [[xr - r, front - r, 0], [-xr + r, front - r, 1], [-xr + r, back + r, 2], [xr - r, back + r, 3]];
        for (const [cx, cy, q] of cs) for (let k = 0; k <= 8; k++) { const a = q * Math.PI / 2 + k / 8 * Math.PI / 2; rr.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
        solid.push(K.prism([rr], 0, Ly.plateT));
        solid.push(K.box(-(W / 2 + 3), -t - 3, Ly.plateT - 0.01, W / 2 + 3, 3, Ly.plateT + Ly.railH));
        const H = holderParts(K, o, Ly, 0, yL); solid.push(...H.solid); cuts.push(...H.cuts);
        for (const tb of tabSpots(o, Ly)) { const x = W / 2 - tb.u; cuts.push(K.box(x - tb.w / 2 - 0.25, -t - 0.2, Ly.plateT - 2.5, x + tb.w / 2 + 0.25, 0.2, Ly.plateT + Ly.railH + 1)); }
        if (o.notch) cuts.push(K.box(-o.notchW / 2, back - 10, -1, o.notchW / 2, yL, notchH));
      }
      const m = K.sub(K.union(solid), cuts);
      return K.soup(m);
    } finally { K.free(); }
  }

  // ---------------------------------------------------------------- build
  function build(raw, M) {
    const o = options(raw), Ly = layout(o), warnings = Ly.warnings.slice();
    const mask = o.mask && o.mask.w && o.mask.d ? o.mask : sampleMask(o.sample);
    if (!mask) throw new Error('No figure found in the picture.');
    const pic = picture(o, mask), rect = fitRect(o, Ly, pic.aspect);
    const Gd = grid(o, Ly), pos = nodePositions(o, Ly, Gd);
    const g = field(o, Ly, Gd, pos, pic, rect);
    const inside = new Uint8Array(g.length);
    { const N = Gd.NU * Gd.NV; for (let n = 0; n < N; n++) { const j = (n / Gd.NU) | 0, i = n % Gd.NU, v = Gd.v0 + j * Gd.hv, u = Gd.u0 + i * Gd.hu; inside[n] = v >= 0 && v <= Ly.Hs && (!Ly.panel || (u >= 0 && u <= Gd.Wp)) ? 1 : 0; } }
    const br = cleanAndBridge(o, Ly, Gd, g, inside);
    const shade = meshField(Gd, g, pos);
    const parts = [];
    const name = Ly.panel ? 'Panel' : 'Shade';
    let local;
    if (Ly.panel) { // print lying flat, front face down
      local = new Float32Array(shade.length); for (let k = 0; k < shade.length; k += 3) { local[k] = shade[k]; local[k + 1] = shade[k + 2]; local[k + 2] = -shade[k + 1]; }
    } else { local = new Float32Array(shade.length); for (let k = 0; k < shade.length; k += 3) { local[k] = shade[k]; local[k + 1] = shade[k + 1]; local[k + 2] = shade[k + 2] - Ly.z0; } }
    parts.push({ name, kind: 'shade', color: o.colors.shade, assembled: shade, local: PL.normalize(local) });
    if (o.base && M) {
      const b = buildBase(o, Ly, M);
      parts.push({ name: Ly.panel ? 'Stand' : 'Base', kind: 'base', color: o.colors.base, assembled: b, local: PL.normalize(Float32Array.from(b)) });
    } else if (o.base && !M) warnings.push('The base could not be built here (no WebAssembly).');
    // fit check
    const U = { w: Math.max(50, o.bed[0] - 8), d: Math.max(50, o.bed[1] - 8), z: Math.max(30, o.bed[2] - 4) };
    for (const pt of parts) { const bb = Core.bbox(pt.local), w = bb.max[0] - bb.min[0], d = bb.max[1] - bb.min[1], h = bb.max[2] - bb.min[2]; pt.size = [w, d, h]; if (!(((w <= U.w && d <= U.d) || (w <= U.d && d <= U.w)) && h <= U.z)) warnings.push(`The ${pt.name.toLowerCase()} (${Math.round(w)} \u00d7 ${Math.round(d)} \u00d7 ${Math.round(h)} mm) is bigger than your printer. Make it smaller or pick a bigger printer.`); }
    if (br.islands > 0) warnings.push('Some small pieces could not be joined to the frame. Raise Simplify or the bridge width.');
    const light = [0, Ly.yL, Ly.zL];
    const shadowCm = [rect.w / 10, rect.h / 10];
    const stats = {
      mode: o.mode, style: o.style, wallW: rect.w, wallH: rect.h, wallDist: o.wallDist, lightZ: Ly.zL, lightH: Ly.zL - (Ly.panel ? Ly.plateT : Ly.z0),
      mag: Ly.Sv, bridges: br.bridges.length, tris: parts.reduce((s, p) => s + p.local.length / 9, 0), pieces: parts.length,
      colors: new Set(parts.map(p => p.color)).size, shadowCm
    };
    const filaments = []; for (const p of parts) if (!filaments.some(f => f.color === p.color)) filaments.push({ color: p.color, role: p.name });
    return { options: o, layout: Ly, rect, pic: { aspect: pic.aspect, win: pic.win }, light, parts, stats, warnings, filaments, bridges: br.bridges, mask, picFn: (ix, iy) => picValue(pic, ix, iy, rect, 1e-6) };
  }

  // ---------------------------------------------------------------- shadow check
  // Cast rays from the (point) light to a grid of points on the wall over the picture and report which reach the wall
  // through the printed parts. Rays only meet triangles whose angle around the light's vertical axis spans theirs.
  function simulate(res, opt) {
    opt = opt || {}; const nx = opt.nx || 80, ny = opt.ny || 80, Ly = res.layout, L = res.light, f = Ly.faces[0], R = res.rect;
    const bins = 1440, lists = Array.from({ length: bins }, () => []);
    const soups = res.parts.map(p => p.assembled);
    const tris = []; for (const p of soups) for (let k = 0; k < p.length; k += 9) tris.push(p, k);
    const ang = (x, y) => Math.atan2(y - L[1], x - L[0]);
    for (let q = 0; q < tris.length; q += 2) {
      const p = tris[q], k = tris[q + 1]; const a = [], rr = [];
      for (let v = 0; v < 3; v++) { a.push(ang(p[k + v * 3], p[k + v * 3 + 1])); rr.push(Math.hypot(p[k + v * 3] - L[0], p[k + v * 3 + 1] - L[1])); }
      if (Math.min(...rr) < 0.5) { for (let b = 0; b < bins; b++) lists[b].push(q); continue; }
      let lo = Math.min(...a), hi = Math.max(...a);
      const ranges = hi - lo > Math.PI ? [[Math.max(...a.filter(x => x < 0)), Math.PI], [-Math.PI, Math.min(...a.filter(x => x >= 0))]] : [[lo, hi]];
      for (const [x0, x1] of ranges) { const b0 = Math.floor((x0 + Math.PI) / (2 * Math.PI) * bins) - 1, b1 = Math.floor((x1 + Math.PI) / (2 * Math.PI) * bins) + 1; for (let b = b0; b <= b1; b++) lists[((b % bins) + bins) % bins].push(q); }
    }
    const hit = (D) => { // ray L + s D, s in (0, 1)
      const b = ((Math.floor((Math.atan2(D[1], D[0]) + Math.PI) / (2 * Math.PI) * bins) % bins) + bins) % bins;
      for (const q of lists[b]) {
        const p = tris[q], k = tris[q + 1];
        const e1x = p[k + 3] - p[k], e1y = p[k + 4] - p[k + 1], e1z = p[k + 5] - p[k + 2], e2x = p[k + 6] - p[k], e2y = p[k + 7] - p[k + 1], e2z = p[k + 8] - p[k + 2];
        const px = D[1] * e2z - D[2] * e2y, py = D[2] * e2x - D[0] * e2z, pz = D[0] * e2y - D[1] * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue; const inv = 1 / det, tx = L[0] - p[k], ty = L[1] - p[k + 1], tz = L[2] - p[k + 2];
        const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (D[0] * qx + D[1] * qy + D[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
        const s = (e2x * qx + e2y * qy + e2z * qz) * inv; if (s > 1e-6 && s < 1) return true;
      }
      return false;
    };
    // the holder's light source body (an LED tea light) also blocks light
    const body = Ly.holder === 'tealight' ? { r: Ly.hd.blockR, z: Ly.floor + Ly.hd.blockZ } : null;
    const lit = new Uint8Array(nx * ny), want = new Uint8Array(nx * ny);
    let agree = 0, inter = 0, uni = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const ix = (i + 0.5) / nx, iy = (j + 0.5) / ny, xw = R.x0 + ix * R.w, zw = R.zt - iy * R.h;
      const W = Ly.panel ? [xw, Ly.Dw, zw] : [f.r[0] * xw + f.n[0] * Ly.Dw, f.r[1] * xw + f.n[1] * Ly.Dw, zw];
      const D = [W[0] - L[0], W[1] - L[1], W[2] - L[2]];
      let blocked = hit(D);
      if (!blocked && body) { const hl = Math.hypot(D[0], D[1]); const zAt = L[2] + D[2] * (body.r / hl); if (zAt < body.z && Ly.zL > body.z) blocked = true; }
      const l = blocked ? 0 : 1, w = res.picFn(ix, iy) >= 0.5 ? 1 : 0;
      lit[j * nx + i] = l; want[j * nx + i] = w; if (l === w) agree++; if (l && w) inter++; if (l || w) uni++;
    }
    return { nx, ny, lit, want, agreement: agree / (nx * ny), iou: uni ? inter / uni : 1 };
  }

  // ---------------------------------------------------------------- export
  function gateInfo() { return []; } // free: every mode, style and extra
  function arrangePlates(res) {
    const bed = res.options.bed, U = { w: Math.max(50, bed[0] - 8), d: Math.max(50, bed[1] - 8), z: Math.max(30, bed[2] - 4) };
    return PL.arrange(res.parts.map(pt => ({ name: pt.name, p: pt.local, color: pt.color })), U.w, U.d, { gap: 6, maxZ: U.z });
  }
  function export3MF(res, o) {
    o = o || {};
    const cols = []; res.parts.forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const ext = c => cols.indexOf((c || '').toUpperCase()) + 1;
    const A = arrangePlates(res), objs = [], plates = [];
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, p: it.p, color: it.color, extruder: ext(it.color) }); }); plates.push(ids); });
    A.unfit.forEach(u => { plates.push([objs.length]); objs.push({ name: u.name, p: PL.normalize(u.p), color: u.color, extruder: ext(u.color) }); });
    return T.threeMF(objs, { title: o.name || 'Shadow lamp', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const o = res.options, s = res.stats, Ly = res.layout, f = v => (+v).toFixed(0);
    const L = ['Expressarte shadow lamp', `${MODES[o.mode]} \u00b7 ${STYLES[o.style]}`];
    if (Ly.panel) L.push(`Panel ${f(o.panelW)} \u00d7 ${f(o.panelH)} mm, ${o.wall} mm thick; light ${f(o.lightDist)} mm behind the panel`);
    else L.push(`${o.mode === 'box' ? 'Box' : 'Shade'} ${f(o.diameter)} mm across, ${f(o.height)} mm tall, ${o.wall} mm wall`);
    L.push(`Light: ${HOLDERS[o.holder].label}, center ${f(s.lightH)} mm above the ${Ly.panel ? 'stand' : 'base'}`,
      `On a wall ${f(o.wallDist)} mm away the picture is about ${f(s.wallW / 10)} \u00d7 ${f(s.wallH / 10)} cm.`, '', 'Filaments');
    res.filaments.forEach((x, i) => L.push(`  ${i + 1}: ${x.color}  ${x.role}`));
    L.push('', 'Printing',
      Ly.panel ? '  - Print the panel lying flat as exported; no supports.' : '  - Print the shade standing up as exported, no supports. The tops of the cutouts bridge: keep the part fan on and print a little slower.',
      '  - Use an opaque filament (2+ walls); a light filament glows, a dark one gives the crispest picture.',
      '', 'Using it',
      '  - Use an LED tea light or a cool LED bulb only. Never use a flame or a hot incandescent bulb.',
      `  - Put the lamp ${f(o.wallDist)} mm from the wall (from the lamp's center${Ly.panel ? '; for the panel, from its front face' : ''}) with the picture facing the wall.`,
      '  - The smaller the light, the sharper the picture: a single small LED is sharpest. Thin bridges blur away on the wall.');
    if (o.holder !== 'tealight') L.push(`  - The socket hole is ${f(o.socketD)} mm. Measure your socket and change it if needed. Run the cord through the notch under the base.`);
    (res.warnings || []).forEach(w => L.push('  - ' + w));
    return L.join('\n');
  }
  function files(res, o) {
    o = o || {}; const base = o.fileBase || 'shadow_lamp', out = [];
    const slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    for (const pt of res.parts) out.push({ name: `${base}_${slug(pt.name)}.stl`, data: new Uint8Array(Core.writeSTL(pt.local, pt.name)) });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }

  const api = { MODES, STYLES, WINDOWS, HOLDERS, PALETTE, DEFAULTS, SAMPLES, options, layout, build, sampleMask, traceMask, blur, outline, radial, simulate, export3MF, files, notes, gateInfo, arrangePlates };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPShadowLamp = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
