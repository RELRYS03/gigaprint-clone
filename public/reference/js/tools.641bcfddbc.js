/* Expressarte generators: lithophanes, reliefs, image-to-shape (cookie cutter, stamp,
   keychain, plaque), laser stacks and waffles, low-poly and wireframe, packing, SVG, 3MF, zip. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const CL = G.ClipperLib || (typeof require === 'function' ? require('clipper-lib') : null);
  const SC = 1000; // clipper integer scale (\u00b5m)

  // ---------------------------------------------------------------- small helpers
  const area2 = L => { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; };
  const crossv = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function pushTri(out, A, B, C, n) {
    const c = crossv([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]]);
    if (n && c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0) out.push(A[0], A[1], A[2], C[0], C[1], C[2], B[0], B[1], B[2]);
    else out.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
  }
  function fixSign(p) { return Core.signedVolume(p) < 0 ? Core.flip(p) : p; }
  function concat(list) {
    let n = 0; for (const a of list) n += a.length;
    const o = new Float64Array(n); let k = 0; for (const a of list) { o.set(a, k); k += a.length; } return o;
  }
  const UA = [1, 2, 0], WA = [2, 0, 1];
  function to3(a, h, u, w) { const o = [0, 0, 0]; o[a] = h; o[UA[a]] = u; o[WA[a]] = w; return o; }

  // ---------------------------------------------------------------- closed heightfield solid
  // Grid nx \u00d7 ny; thick(i,j) > 0; map(i,j,t) -> [x,y,z]; back surface is t = 0. wrap joins column nx-1 to 0.
  // low(i, j) (optional) gives the back surface height instead of 0 (two-sided reliefs)
  function heightSolid(nx, ny, thick, map, wrap, low) {
    const F = new Array(nx * ny), B = new Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { F[j * nx + i] = map(i, j, thick(i, j)); B[j * nx + i] = map(i, j, low ? low(i, j) : 0); }
    const n = (wrap ? nx : nx - 1) * (ny - 1) * 4 + (wrap ? nx : nx - 1) * 4 + (wrap ? 0 : (ny - 1) * 4);
    const out = new Float64Array(n * 9); let o = 0;
    const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    const put = (A, Bp, C) => { if (same(A, Bp) || same(Bp, C) || same(A, C)) return; out[o++] = A[0]; out[o++] = A[1]; out[o++] = A[2]; out[o++] = Bp[0]; out[o++] = Bp[1]; out[o++] = Bp[2]; out[o++] = C[0]; out[o++] = C[1]; out[o++] = C[2]; };
    const quad = (a, b, c, d) => { put(a, b, c); put(a, c, d); };
    const I = i => (i + nx) % nx;
    const cols = wrap ? nx : nx - 1;
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < cols; i++) {
      const i1 = wrap ? I(i + 1) : i + 1;
      quad(F[j * nx + i], F[j * nx + i1], F[(j + 1) * nx + i1], F[(j + 1) * nx + i]);
      quad(B[j * nx + i], B[(j + 1) * nx + i], B[(j + 1) * nx + i1], B[j * nx + i1]);
    }
    const top = ny - 1;
    for (let i = 0; i < cols; i++) {
      const i1 = wrap ? I(i + 1) : i + 1;
      quad(B[i], B[i1], F[i1], F[i]);
      quad(B[top * nx + i1], B[top * nx + i], F[top * nx + i], F[top * nx + i1]);
    }
    if (!wrap) for (let j = 0; j < ny - 1; j++) {
      quad(B[(j + 1) * nx], B[j * nx], F[j * nx], F[(j + 1) * nx]);
      const r = nx - 1;
      quad(B[j * nx + r], B[(j + 1) * nx + r], F[(j + 1) * nx + r], F[j * nx + r]);
    }
    return fixSign(out.subarray(0, o));
  }
  // Heightfield solid restricted to the cells where cellIn(i,j) is true (cell i,j spans nodes i..i+1, j..j+1).
  function maskedHeightSolid(nx, ny, cellIn, thick, map, low) {
    const F = new Array(nx * ny), B = new Array(nx * ny);
    const node = (i, j) => { const k = j * nx + i; if (!F[k]) { F[k] = map(i, j, thick(i, j)); B[k] = map(i, j, low ? low(i, j) : 0); } return k; };
    const out = []; const put = (a, b, c) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const quad = (a, b, c, d) => { put(a, b, c); put(a, c, d); };
    const inC = (i, j) => i >= 0 && j >= 0 && i < nx - 1 && j < ny - 1 && cellIn(i, j);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      if (!cellIn(i, j)) continue;
      const a = node(i, j), b = node(i + 1, j), c = node(i + 1, j + 1), d = node(i, j + 1);
      quad(F[a], F[b], F[c], F[d]); quad(B[a], B[d], B[c], B[b]);
      if (!inC(i, j - 1)) quad(B[a], B[b], F[b], F[a]);
      if (!inC(i, j + 1)) quad(B[c], B[d], F[d], F[c]);
      if (!inC(i - 1, j)) quad(B[d], B[a], F[a], F[d]);
      if (!inC(i + 1, j)) quad(B[b], B[c], F[c], F[b]);
    }
    return fixSign(Float64Array.from(out));
  }
  // Frame shapes in a W \u00d7 H box (mm), y up. Returns inside(x, y).
  // outline: for kind 'custom', polygons [{outer, holes}] in mm with the panel's origin bottom-left
  function frameShape(kind, W, H, outline) {
    const cx = W / 2, cy = H / 2;
    switch (kind) {
      case 'circle': { const r = Math.min(W, H) / 2; return (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r; }
      case 'window': { const r = W / 2, rc = Math.min(W, H) * 0.08; return (x, y) => { if (y > H - r) return (x - cx) ** 2 + (y - (H - r)) ** 2 <= r * r; const dx = Math.max(rc - x, 0, x - (W - rc)), dy = Math.max(rc - y, 0); return dx * dx + dy * dy <= rc * rc; }; }
      case 'custom': {
        if (!outline || !outline.length) return () => true;
        const pip = (q, L) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
        return (x, y) => outline.some(P => pip([x, y], P.outer) && !P.holes.some(h => pip([x, y], h)));
      }
      case 'oval': return (x, y) => ((x - cx) / (W / 2)) ** 2 + ((y - cy) / (H / 2)) ** 2 <= 1;
      case 'rounded': { const r = Math.min(W, H) * 0.14; return (x, y) => { const dx = Math.max(r - x, 0, x - (W - r)), dy = Math.max(r - y, 0, y - (H - r)); return dx * dx + dy * dy <= r * r; }; }
      case 'heart': return (x, y) => { const u = (x - cx) / (W / 2) * 1.18, v = (y - H * 0.42) / (H / 2) * 1.22; const a = u * u + v * v - 1; return a * a * a - u * u * v * v * v <= 0; };
      case 'arch': { const r = W / 2; return (x, y) => y <= H - r || (x - cx) ** 2 + (y - (H - r)) ** 2 <= r * r; }
      default: return () => true;
    }
  }
  // Distance in cells from each cell to the nearest outside cell (for borders of shaped panels).
  function cellDistance(nx, ny, cellIn) {
    const W = nx - 1, H = ny - 1, D = new Float32Array(W * H).fill(1e9);
    const q = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (!cellIn(i, j)) { D[j * W + i] = 0; q.push(i, j); }
    for (let i = -1; i <= W; i++) { q.push(i, -1, i, H); } for (let j = 0; j < H; j++) q.push(-1, j, W, j);
    // two-pass chamfer distance (3-4 metric scaled to cells)
    const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? 0 : D[j * W + i];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let d = D[j * W + i]; d = Math.min(d, at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + 1.414, at(i + 1, j - 1) + 1.414); D[j * W + i] = d; }
    for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { let d = D[j * W + i]; d = Math.min(d, at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + 1.414, at(i - 1, j + 1) + 1.414); D[j * W + i] = d; }
    return D;
  }
  function box(x0, y0, z0, x1, y1, z1) {
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const f = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const out = []; for (const q of f) { const [a, b, c, d] = q.map(i => P[i]); out.push(...a, ...b, ...c, ...a, ...c, ...d); }
    return Float64Array.from(out);
  }

  // ---------------------------------------------------------------- lithophane
  // gray: Float32Array nx*ny brightness 0..1, row 0 = top of the picture.
  // shapes that wrap all the way round (no side borders)
  const ROUND = { cylinder: 1, cone: 1, sphere: 1, polygon: 1 };
  // polar angle (from the top) where a sphere of diameter D opens to a hole of openD at the bottom
  function sphereSpan(D, openD) { const r = Math.max(0, Math.min(0.9, (openD || 0) / Math.max(1e-6, D))); return Math.PI - Math.asin(r); }
  // grid size for a round lithophane, so the UI and tests agree: { nx, ny, cell }
  function lithoGrid(shape, o, aspect) {
    const cell = o.cell, W = o.width;
    if (shape === 'sphere') { const D = W / Math.PI, phi = sphereSpan(D, o.openD); return { nx: Math.max(24, Math.round(W / cell)), ny: Math.max(8, Math.round(D / 2 * phi / cell) + 1) }; } // W = circumference
    if (shape === 'cone') { const R1 = W / (2 * Math.PI), R2 = R1 * (o.topRatio || 0.6), slant = aspect * Math.PI * (R1 + R2); return { nx: Math.round(W / cell), ny: Math.max(8, Math.round(slant / cell) + 1) }; }
    if (shape === 'polygon') { const N = Math.max(3, Math.min(12, Math.round(o.sides || 6))), m = Math.max(4, Math.round(W / N / cell)); return { nx: N * m, ny: Math.max(8, Math.round(W * aspect / cell) + 1) }; }
    return { nx: Math.round(W / cell), ny: Math.round(W * aspect / cell) + 1 };
  }
  function lithophane(gray, nx, ny, o) {
    const cell = o.cell, minT = o.minT, maxT = o.maxT, bw = o.border || 0;
    const bcells = Math.round(bw / cell);
    // o.mark = { text, depth }: an ID (A1, B2...) engraved into the bottom border, for tiled panels
    let markAt = null;
    if (o.mark && o.mark.text && bw >= 3 && Core && Core.FONT) {
      const txt = String(o.mark.text).toUpperCase(), Wp = txt.length * 4 - 1;
      const Wmm = (o.shape === 'cylinder' ? nx : nx - 1) * cell;
      const px = Math.min(1.4, (bw - 1.2) / 5, Wmm * 0.3 / Wp), x0 = Wmm / 2 - Wp * px / 2, z0 = (bw - 5 * px) / 2;
      if (px >= Math.max(0.5, cell * 1.4)) markAt = (i, j) => {
        const x = (i * cell - x0) / px, z = ((ny - 1 - j) * cell - z0) / px;
        if (x < 0 || z < 0 || x >= Wp || z >= 5) return false;
        const ci = Math.floor(x / 4), cx = Math.floor(x) % 4, g = Core.FONT[txt[ci]];
        return cx !== 3 && !!g && g[4 - Math.floor(z)][cx] === '1';
      };
    }
    const round = ROUND[o.shape], sphere = o.shape === 'sphere';
    // sphere: row 0 is the pole, so every column there takes the row's mean (one point); the border is the opening rim only
    let poleT = 0;
    if (sphere) { let sm = 0; for (let i = 0; i < nx; i++) { let b = gray[i]; if (o.invert) b = 1 - b; sm += maxT - b * (maxT - minT); } poleT = sm / nx; }
    const thick = (i, j) => {
      if (sphere && j === 0) return poleT;
      const inBorder = bcells > 0 && ((!sphere && j < bcells) || j >= ny - bcells || (!round && (i < bcells || i >= nx - bcells)));
      if (inBorder) return markAt && j >= ny - bcells && markAt(i, j) ? maxT - Math.min(maxT * 0.4, o.mark.depth || 0.6) : maxT;
      let b = gray[j * nx + i]; if (o.invert) b = 1 - b;
      return maxT - b * (maxT - minT);
    };
    const W = (round ? nx : nx - 1) * cell;
    const zOff = o.stand && o.shape === 'flat' ? 4 : 0;
    let map;
    if (o.shape === 'flat') map = (i, j, t) => [i * cell, t, (ny - 1 - j) * cell + zOff];
    else if (o.shape === 'arc') {
      const A = Math.max(10, Math.min(300, o.arcDeg || 120)) * Math.PI / 180, R = W / A;
      map = (i, j, t) => { const th = (i / (nx - 1) - 0.5) * A, r = R + t; return [r * Math.sin(th), r * Math.cos(th) - R, (ny - 1 - j) * cell]; };
    } else if (o.shape === 'cone') {
      // lamp shade: W is the bottom circumference, o.topRatio the top diameter over the bottom; the picture height is
      // the slant length, the relief stands out along the cone's normal
      const R1 = W / (2 * Math.PI), R2 = R1 * Math.max(0.2, Math.min(3, o.topRatio || 0.6)), L = (ny - 1) * cell;
      const H = Math.sqrt(Math.max(L * L - (R1 - R2) ** 2, (L * 0.2) ** 2)), be = Math.atan2(R1 - R2, H), cb = Math.cos(be), sb = Math.sin(be);
      map = (i, j, t) => { const th = i / nx * 2 * Math.PI, f = j / (ny - 1), r = R2 + (R1 - R2) * f; return [(r + t * cb) * Math.cos(th), (r + t * cb) * Math.sin(th), H * (1 - f) + t * sb]; };
    } else if (sphere) {
      // globe / moon: W is the diameter; rows run from the top pole down to an opening of o.openD mm at the bottom
      const Rs = W / (2 * Math.PI), phiMax = sphereSpan(2 * Rs, o.openD), zc = -Rs * Math.cos(phiMax);
      map = (i, j, t) => { const th = i / nx * 2 * Math.PI, ph = j / (ny - 1) * phiMax, r = Rs + t, sp = j === 0 ? 0 : Math.sin(ph); return [r * sp * Math.cos(th), r * sp * Math.sin(th), zc + r * Math.cos(ph)]; };
    } else if (o.shape === 'polygon') {
      // polygon lamp: N flat faces round a W mm perimeter; columns are spread evenly along the faces, corners mitred
      const N = Math.max(3, Math.min(12, Math.round(o.sides || 6))), m = nx / N, a = W / N / (2 * Math.tan(Math.PI / N)), Rc = a / Math.cos(Math.PI / N);
      const corner = f => { const q = (f + 0.5) * 2 * Math.PI / N; return [Rc * Math.cos(q), Rc * Math.sin(q)]; };
      const nrm = f => { const q = (f + 1) * 2 * Math.PI / N; return [Math.cos(q), Math.sin(q)]; }; // face f runs corner f -> f+1
      map = (i, j, t) => {
        const f = Math.floor(i / m), u = i / m - f, A = corner(f), B = corner(f + 1);
        let n = nrm(f);
        if (u < 1e-9) { const p = nrm(f - 1), k = 1 / (1 + p[0] * n[0] + p[1] * n[1]); n = [(p[0] + n[0]) * k, (p[1] + n[1]) * k]; }
        return [A[0] + (B[0] - A[0]) * u + t * n[0], A[1] + (B[1] - A[1]) * u + t * n[1], (ny - 1 - j) * cell];
      };
    } else {
      const R = W / (2 * Math.PI);
      map = (i, j, t) => { const th = i / nx * 2 * Math.PI, r = R + t; return [r * Math.cos(th), r * Math.sin(th), (ny - 1 - j) * cell]; };
    }
    let p;
    if (o.shape === 'flat' && o.frame && o.frame !== 'rect') {
      const Hmm = (ny - 1) * cell, inside = frameShape(o.frame, W, Hmm, o.outline);
      const cellIn = (i, j) => inside((i + 0.5) * cell, (ny - 1 - j - 0.5) * cell);
      const D = cellDistance(nx, ny, cellIn);
      const thickM = (i, j) => {
        let near = 1e9; for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const ci = i + di, cj = j + dj; if (ci >= 0 && cj >= 0 && ci < nx - 1 && cj < ny - 1) near = Math.min(near, D[cj * (nx - 1) + ci]); }
        if (bcells > 0 && near <= bcells) return maxT;
        let b = gray[j * nx + i]; if (o.invert) b = 1 - b; return maxT - b * (maxT - minT);
      };
      p = maskedHeightSolid(nx, ny, cellIn, thickM, map);
    } else p = heightSolid(nx, ny, thick, map, round);
    if (o.stand && o.shape === 'flat') p = concat([p, box(-3, -7, 0, W + 3, maxT + 7, 6)]);
    if (o.shape === 'cylinder' && o.bottom) { // floor so it stands as a lamp shade or votive
      const R = W / (2 * Math.PI) + maxT * 0.5;
      p = concat([p, extrude([{ outer: circle(0, 0, R, 96), holes: [] }], 2, 0, 1.6)]);
    }
    if (o.shape === 'polygon' && o.bottom) {
      const N = Math.max(3, Math.min(12, Math.round(o.sides || 6))), Rc = W / N / (2 * Math.tan(Math.PI / N)) / Math.cos(Math.PI / N) + maxT * 0.5 / Math.cos(Math.PI / N);
      const pts = []; for (let f = 0; f < N; f++) { const q = (f + 0.5) * 2 * Math.PI / N; pts.push([Rc * Math.cos(q), Rc * Math.sin(q)]); }
      p = concat([p, extrude([{ outer: pts, holes: [] }], 2, 0, 1.6)]);
    }
    if (o.shape === 'cone' && o.bottom) {
      const R = W / (2 * Math.PI) + maxT * 0.5;
      p = concat([p, extrude([{ outer: circle(0, 0, R, 96), holes: [] }], 2, 0, 1.6)]);
    }
    if (sphere) { const b = Core.bbox(p); for (let i = 2; i < p.length; i += 3) p[i] -= b.min[2]; }
    return p;
  }

  // ---------------------------------------------------------------- relief from a 3D model
  const VIEWS = {
    front: { d: [0, 1, 0], r: [1, 0, 0], u: [0, 0, 1] },
    back: { d: [0, -1, 0], r: [-1, 0, 0], u: [0, 0, 1] },
    left: { d: [1, 0, 0], r: [0, -1, 0], u: [0, 0, 1] },
    right: { d: [-1, 0, 0], r: [0, 1, 0], u: [0, 0, 1] },
    top: { d: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0] },
    bottom: { d: [0, 0, 1], r: [1, 0, 0], u: [0, -1, 0] }
  };
  // The widest plaque width (whole mm) that keeps both plaque sides within maxMM for this model and view: the
  // starting width, so a default relief stays inside the free size whatever the model's proportions.
  function reliefWidthFor(p, o, maxMM) {
    const V = VIEWS[o.view] || VIEWS.front, bb = Core.bbox(p);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const corners = []; for (let k = 0; k < 8; k++) corners.push([k & 1 ? bb.max[0] : bb.min[0], k & 2 ? bb.max[1] : bb.min[1], k & 4 ? bb.max[2] : bb.min[2]]);
    const rng = v => { const s = corners.map(c => dot(c, v)); return Math.max(...s) - Math.min(...s); };
    const pad = (o.frameW || 0) + (o.soften || 0) + (o.margin || 0), L = maxMM - 2 * (o.cell || 1); // room for rounding to the grid
    const k = rng(V.u) / Math.max(1e-6, rng(V.r)); // plaque height per unit of picture width
    const w = k > 1 ? (L - 2 * pad) / k + 2 * pad : L;
    return Math.max(20, Math.floor(Math.min(L, w)));
  }
  function relief(p, bvh, o) {
    const V = VIEWS[o.view] || VIEWS.front;
    const bb = Core.bbox(p);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const corners = []; for (let k = 0; k < 8; k++) corners.push([k & 1 ? bb.max[0] : bb.min[0], k & 2 ? bb.max[1] : bb.min[1], k & 4 ? bb.max[2] : bb.min[2]]);
    const rng = v => { const s = corners.map(c => dot(c, v)); return [Math.min(...s), Math.max(...s)]; };
    const [r0, r1] = rng(V.r), [u0, u1] = rng(V.u), [d0, d1] = rng(V.d);
    const pad = (o.frameW || 0) + (o.soften || 0) + (o.margin || 0);
    const scale = Math.max(1e-6, o.width - 2 * pad) / (r1 - r0);
    const cell = o.cell;
    const nx = Math.max(2, Math.round(o.width / cell) + 1), ny = Math.max(2, Math.round(((u1 - u0) * scale + 2 * pad) / cell) + 1);
    // o.negative: the model is carved into the plate (a mold or stamp), mirrored so a cast or print taken from it reads
    // the right way round. o.double: the back of the plate is the model seen from behind (a two-sided medallion).
    const neg = !!o.negative, dbl = !!o.double && !neg;
    const depthRange = d1 - d0 || 1;
    const sample = back => {
      const A = new Float32Array(nx * ny), dir = back ? V.d.map(v => -v) : V.d;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const ii = neg ? nx - 1 - i : i;
        const rr = r0 + (ii * cell - pad) / scale, uu = u1 - (j * cell - pad) / scale;
        const org = [0, 0, 0];
        for (let q = 0; q < 3; q++) org[q] = V.r[q] * rr + V.u[q] * uu + V.d[q] * (back ? d1 + 1 : d0 - 1);
        const t = Core.rayNearest ? Core.rayNearest(bvh, org, dir) : Infinity;
        A[j * nx + i] = isFinite(t) ? Math.max(0, 1 - (t - 1) / depthRange) : 0;
      }
      return A;
    };
    const blur = A => { const C = A.slice(); for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { let s = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += C[(j + dj) * nx + i + di]; A[j * nx + i] = s / 9; } };
    const finish = H => {
      if (o.smooth) for (let pass = 0; pass < o.smooth; pass++) blur(H);
      if (o.soften > 0) { // grow a gentle skirt outward from the outline instead of a sheer cliff
        const steps = Math.max(1, Math.round(o.soften / cell));
        let S = H.slice();
        for (let k = 0; k < steps; k++) { blur(S); for (let i = 0; i < S.length; i++) if (H[i] > S[i]) S[i] = H[i]; }
        H.set(S);
      }
      return H;
    };
    const H = finish(sample(false)), HB = dbl ? finish(sample(true)) : null;
    const g = o.gamma || 1;
    const Wmm = (nx - 1) * cell, Hmm = (ny - 1) * cell;
    const inside = frameShape(o.plate || 'rect', Wmm, Hmm);
    const cellIn = (i, j) => inside((i + 0.5) * cell, (ny - 1 - j - 0.5) * cell);
    const D = o.frameW > 0 || (o.plate && o.plate !== 'rect') ? cellDistance(nx, ny, cellIn) : null;
    const fw = (o.frameW || 0) / cell, base = dbl ? o.base / 2 : o.base, rimT = base + (o.frameH || o.depth * 0.5);
    const prof = A => (i, j) => {
      const h = neg ? 1 - Math.pow(A[j * nx + i], g) : Math.pow(A[j * nx + i], g);
      if (D && fw > 0) { let near = 1e9; for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const ci = i + di, cj = j + dj; if (ci >= 0 && cj >= 0 && ci < nx - 1 && cj < ny - 1) near = Math.min(near, D[cj * (nx - 1) + ci]); } if (near <= fw) return Math.max(rimT, base + o.depth * h); }
      return base + o.depth * h;
    };
    const thick = prof(H), backT = HB ? prof(HB) : null, low = backT ? (i, j) => -backT(i, j) : null;
    const map = (i, j, t) => [i * cell, (ny - 1 - j) * cell, t];
    let out = o.plate && o.plate !== 'rect' ? maskedHeightSolid(nx, ny, cellIn, thick, map, low) : heightSolid(nx, ny, thick, map, false, low);
    if (low) { const b = Core.bbox(out); out = Float64Array.from(out); for (let i = 2; i < out.length; i += 3) out[i] -= b.min[2]; }
    const top = new Float32Array(nx * ny), bot = new Float32Array(nx * ny), lift = low ? Math.max(...Array.from({ length: nx * ny }, (_, k) => backT(k % nx, (k / nx) | 0))) : 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { top[j * nx + i] = thick(i, j) + lift; bot[j * nx + i] = low ? low(i, j) + lift : 0; }
    return { p: out, nx, ny, top, bottom: bot };
  }

  // ---------------------------------------------------------------- image tracing
  // bin: Uint8Array w*h (1 = shape), row 0 = top. Returns loops in pixel units, y up, filled on the left.
  function traceBinary(bin, w, h) {
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && bin[(h - 1 - y) * w + x] === 1;
    const out = new Map(); // "x,y" -> list of [nx, ny]
    const add = (x0, y0, x1, y1) => { const k = x0 + ',' + y0; let l = out.get(k); if (!l) out.set(k, l = []); l.push([x1, y1]); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) add(x, y, x + 1, y);
      if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!at(x - 1, y)) add(x, y + 1, x, y);
    }
    const loops = [];
    for (const [k0, l0] of out) {
      while (l0.length) {
        const [sx, sy] = k0.split(',').map(Number);
        let px = sx, py = sy; let [nxp, nyp] = l0.pop();
        const loop = [[sx, sy]];
        let guard = 0;
        while (!(nxp === sx && nyp === sy) && guard++ < 1e7) {
          loop.push([nxp, nyp]);
          const l = out.get(nxp + ',' + nyp);
          if (!l || !l.length) break;
          let pick = 0;
          if (l.length > 1) { // prefer the left turn so diagonal pixels stay separate
            const dx = nxp - px, dy = nyp - py;
            pick = l.findIndex(q => { const ex = q[0] - nxp, ey = q[1] - nyp; return dx * ey - dy * ex > 0; });
            if (pick < 0) pick = 0;
          }
          const nq = l.splice(pick, 1)[0];
          px = nxp; py = nyp; nxp = nq[0]; nyp = nq[1];
        }
        if (loop.length >= 4) loops.push(loop);
      }
    }
    return loops;
  }
  function rdp(pts, tol) {
    if (pts.length < 4) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const st = [[0, pts.length - 1]];
    while (st.length) {
      const [a, b] = st.pop(); let best = -1, bd = tol;
      const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1], L = Math.hypot(bx - ax, by - ay) || 1e-9;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > bd) { bd = d; best = i; } }
      if (best >= 0) { keep[best] = 1; st.push([a, best], [best, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  function simplifyLoop(loop, tol, smooth) {
    // split the closed loop at its farthest point pair so RDP works on two open chains
    let far = 0, fd = -1; for (let i = 0; i < loop.length; i++) { const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > fd) { fd = d; far = i; } }
    const a = rdp(loop.slice(0, far + 1), tol), b = rdp(loop.slice(far).concat([loop[0]]), tol);
    let L = a.concat(b.slice(1, -1));
    for (let it = 0; it < (smooth || 0); it++) { // Chaikin corner cutting
      const n = []; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; n.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]); }
      L = n;
    }
    return L;
  }

  // ---------------------------------------------------------------- clipper bridges
  const toPath = L => L.map(q => ({ X: Math.round(q[0] * SC), Y: Math.round(q[1] * SC) }));
  const fromPath = P => P.map(q => [q.X / SC, q.Y / SC]);
  function orientLoop(L, wantPositive) {
    if (!L || L.length < 3) return L;
    const a = area2(L);
    return ((a > 0) === !!wantPositive) ? L : L.slice().reverse();
  }
  // Clipper nonzero fill treats a hole as empty only when it winds opposite the outer.
  // Uploaded logos (and some traces) often have CCW outers and CCW holes; without this
  // they fill solid on union/intersect (for example when a bar mat tile clips a logo).
  // Only a polygon's holes are turned (to wind opposite its own outer); outers keep their winding, because some
  // callers (lightbox letters) pass a counter as its own reversed polygon and rely on that winding to cut it.
  function polysToPaths(polys) {
    const out = [];
    for (const P of polys) {
      out.push(toPath(P.outer));
      const pos = P.outer && P.outer.length >= 3 ? area2(P.outer) > 0 : true;
      for (const h of P.holes) out.push(toPath(orientLoop(h, !pos)));
    }
    return out;
  }
  function treeToPolys(tree) {
    const polys = [];
    const walk = node => {
      for (const c of node.Childs()) {
        if (c.IsHole()) { walk(c); continue; }
        const outer = fromPath(c.Contour());
        const holes = c.Childs().map(h => fromPath(h.Contour()));
        polys.push({ outer, holes });
        for (const h of c.Childs()) walk(h);
      }
    };
    walk(tree);
    return polys.filter(P => P.outer.length >= 3);
  }
  function boolean(type, subj, clip, fill) {
    const c = new CL.Clipper();
    c.AddPaths(subj, CL.PolyType.ptSubject, true);
    if (clip && clip.length) c.AddPaths(clip, CL.PolyType.ptClip, true);
    const tree = new CL.PolyTree();
    const ft = fill === 'evenodd' ? CL.PolyFillType.pftEvenOdd : CL.PolyFillType.pftNonZero;
    c.Execute({ union: CL.ClipType.ctUnion, diff: CL.ClipType.ctDifference, inter: CL.ClipType.ctIntersection }[type], tree, ft, ft);
    return treeToPolys(tree);
  }
  function offset(polys, d, round) {
    const co = new CL.ClipperOffset(2, 0.05 * SC);
    co.AddPaths(polysToPaths(polys), round === false ? CL.JoinType.jtMiter : CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
    const tree = new CL.PolyTree(); co.Execute(tree, d * SC);
    return treeToPolys(tree);
  }
  const unionPolys = (polys, fill) => boolean('union', polysToPaths(polys), null, fill || 'nonzero');
  const diffPolys = (a, b) => boolean('diff', polysToPaths(a), polysToPaths(b), 'nonzero');
  const interPolys = (a, b) => boolean('inter', polysToPaths(a), polysToPaths(b), 'nonzero');
  const circle = (cx, cy, r, n) => { const L = []; n = n || 48; for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; L.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return L; };
  function polysBBox(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const P of polys) for (const q of P.outer) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  function transformPolys(polys, f) { return polys.map(P => ({ outer: P.outer.map(f), holes: P.holes.map(h => h.map(f)) })); }
  function polysArea(polys) { let s = 0; for (const P of polys) { s += Math.abs(area2(P.outer)); for (const h of P.holes) s -= Math.abs(area2(h)); } return s; }

  // ---------------------------------------------------------------- extrusion along an axis
  function extrude(polys, a, h0, h1) {
    const Pt = [], Tt = [];
    const norm = polys.map(P => ({
      outer: area2(P.outer) > 0 ? P.outer : P.outer.slice().reverse(),
      holes: P.holes.map(h => area2(h) < 0 ? h : h.slice().reverse())
    }));
    Core.triangulatePolys(norm, a, h1, +1, Pt, Tt, 0);
    Core.triangulatePolys(norm, a, h0, -1, Pt, Tt, 0);
    const out = Pt;
    for (const P of norm) for (const L of [P.outer, ...P.holes]) for (let i = 0; i < L.length; i++) {
      const p0 = L[i], p1 = L[(i + 1) % L.length];
      const du = p1[0] - p0[0], dw = p1[1] - p0[1];
      const n = [0, 0, 0]; n[UA[a]] = dw; n[WA[a]] = -du;
      const A = to3(a, h0, p0[0], p0[1]), B = to3(a, h0, p1[0], p1[1]), C = to3(a, h1, p1[0], p1[1]), D = to3(a, h1, p0[0], p0[1]);
      pushTri(out, A, B, C, n); pushTri(out, A, C, D, n);
    }
    return Float64Array.from(out);
  }

  // ---------------------------------------------------------------- image to shapes
  function imageShape(gray, w, h, o) {
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { const dark = gray[i] < o.threshold; bin[i] = (o.invert ? !dark : dark) ? 1 : 0; }
    let loops = traceBinary(bin, w, h).map(L => simplifyLoop(L, 0.6, 2));
    loops = loops.filter(L => Math.abs(area2(L)) > 6);
    if (!loops.length) return [];
    let x0 = Infinity, x1 = -Infinity; for (const L of loops) for (const q of L) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
    const k = o.width / Math.max(1, x1 - x0);
    const polys = boolean('union', loops.map(L => toPath(L.map(q => [q[0] * k, q[1] * k]))), null, 'evenodd');
    const minA = Math.pow(Math.max(0.6, o.minFeature || 1), 2);
    return polys.filter(P => Math.abs(area2(P.outer)) > minA).map(P => ({ outer: P.outer, holes: P.holes.filter(hh => Math.abs(area2(hh)) > minA) }));
  }
  function shapeModel(S, o) {
    if (!S.length) return { parts: [], outline: [] };
    const mirror = P => transformPolys(P, q => [-q[0], q[1]]);
    switch (o.mode) {
      case 'cutter': {
        const outerOnly = S.map(P => ({ outer: P.outer, holes: [] }));
        const src = o.cutHoles ? S : outerOnly;
        const blade = diffPolys(offset(src, o.blade), src);
        const flange = diffPolys(offset(src, o.blade + o.flange), offset(src, Math.min(-0.01, -o.flange * 0.25)));
        return { parts: [extrude(flange, 2, 0, o.flangeT), extrude(blade, 2, 0, o.height)], outline: offset(src, o.blade + o.flange) };
      }
      case 'stamp': {
        const M = mirror(S);
        const bb = polysBBox(M), m = o.border;
        const base = offset([{ outer: [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y1], [bb.x0, bb.y1]], holes: [] }], m, true);
        return { parts: [extrude(base, 2, 0, o.baseT), extrude(M, 2, o.baseT - 0.4, o.baseT + o.raise)], outline: base };
      }
      case 'keychain': case 'plaque': {
        let base = offset(S, o.border);
        base = unionPolys(base);
        if (o.mode === 'keychain') {
          // hang the ring off the top-left edge of the outline, pointing away from the centre
          const hr = Math.max(1.5, o.ring / 2), tr = hr + 3;
          const bb = polysBBox(base), cx0 = (bb.x0 + bb.x1) / 2, cy0 = (bb.y0 + bb.y1) / 2;
          let best = null, bs = -Infinity;
          for (const P of base) for (const q of P.outer) { const s = (q[1] - cy0) - 0.6 * (q[0] - cx0); if (s > bs) { bs = s; best = q; } }
          let dx = best[0] - cx0, dy = best[1] - cy0; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
          const cx = best[0] + dx * (hr + 0.8), cy = best[1] + dy * (hr + 0.8);
          base = unionPolys(base.concat([{ outer: circle(cx, cy, tr), holes: [] }]));
          base = diffPolys(base, [{ outer: circle(cx, cy, hr), holes: [] }]);
        }
        return { parts: [extrude(base, 2, 0, o.baseT), extrude(S, 2, o.baseT - 0.4, o.baseT + o.raise)], outline: base };
      }
      default: return { parts: [extrude(S, 2, 0, o.height)], outline: S };
    }
  }

  // ---------------------------------------------------------------- laser: stacked layers
  function pointIn(pt, P) {
    const pip = (pt, L) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const xi = L[i][0], yi = L[i][1], xj = L[j][0], yj = L[j][1]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) c = !c; } return c; };
    return pip(pt, P.outer) && !P.holes.some(h => pip(pt, h));
  }
  function edgeDist(pt, P) {
    let d = Infinity;
    for (const L of [P.outer, ...P.holes]) for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
      const ax = L[j][0], ay = L[j][1], bx = L[i][0], by = L[i][1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = l2 ? ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
      d = Math.min(d, Math.hypot(pt[0] - ax - t * dx, pt[1] - ay - t * dy));
    }
    return d;
  }
  function stack(p, o) {
    const a = o.axis, bb = Core.bbox(p);
    const lo = bb.min[a], hi = bb.max[a], T = o.thickness;
    const n = Math.max(1, Math.round((hi - lo) / T));
    const layers = [];
    for (let k = 0; k < n; k++) {
      const v = Core.nudgePlane(p, a, lo + (k + 0.5) * (hi - lo) / n);
      const polys = unionPolys(Core.sectionPolys(p, a, v), 'evenodd');
      layers.push({ k, h0: lo + k * T, polys });
    }
    // alignment dowel holes through every layer
    const holes = [];
    if (o.dowel > 0) {
      const nonEmpty = layers.filter(L => L.polys.length);
      const need = o.dowel / 2 + 2.5;
      const first = nonEmpty.reduce((m, L) => (polysArea(L.polys) < polysArea(m.polys) ? L : m), nonEmpty[0]);
      if (first) {
        const b = polysBBox(first.polys), step = Math.max(1, Math.max(b.w, b.h) / 40), cand = [];
        for (let x = b.x0; x <= b.x1; x += step) for (let y = b.y0; y <= b.y1; y += step) {
          const pt = [x, y]; let ok = true, cl = Infinity;
          for (const L of nonEmpty) {
            const P = L.polys.find(Q => pointIn(pt, Q));
            if (!P) { ok = false; break; }
            const d = edgeDist(pt, P); if (d < need) { ok = false; break; } cl = Math.min(cl, d);
          }
          if (ok) cand.push({ pt, cl });
        }
        if (cand.length) {
          cand.sort((x, y) => y.cl - x.cl);
          holes.push(cand[0].pt);
          let best = null, bd = 0;
          for (const c of cand) { const d = Math.hypot(c.pt[0] - holes[0][0], c.pt[1] - holes[0][1]); if (d > bd && d > o.dowel * 3) { bd = d; best = c.pt; } }
          if (best) holes.push(best);
        }
      }
      if (holes.length) for (const L of layers) L.polys = diffPolys(L.polys, holes.map(h => ({ outer: circle(h[0], h[1], o.dowel / 2, 32), holes: [] })));
    }
    // Ring slices: each layer keeps a band `ring` mm wide inside its outline. Material is only removed where the layers
    // above and below are also solid, so every pair of neighbours still overlaps (glue surface) and the first and last
    // layers and every exposed step stay closed. A boss is kept round each dowel hole.
    let saved = 0;
    if (o.ring > 0) {
      const w = o.ring, solidL = layers.map(L => L.polys), inner = solidL.map(P => (P.length ? offset(P, -w) : []));
      const bosses = holes.map(h => ({ outer: circle(h[0], h[1], o.dowel / 2 + w, 32), holes: [] }));
      layers.forEach((L, k) => {
        if (!L.polys.length || k === 0 || k === layers.length - 1) return;
        let cut = inner[k];
        for (const nb of [inner[k - 1], inner[k + 1]]) cut = cut.length && nb.length ? interPolys(cut, nb) : [];
        if (bosses.length && cut.length) cut = diffPolys(cut, bosses);
        cut = cut.filter(P => polysArea([P]) > w * w * 4);
        if (!cut.length) return;
        const before = polysArea(L.polys);
        L.polys = diffPolys(L.polys, cut);
        saved += before - polysArea(L.polys);
      });
    }
    const parts = [], preview = [];
    for (const L of layers) {
      L.polys.forEach((P, i) => parts.push({ name: `L${String(L.k + 1).padStart(2, '0')}${L.polys.length > 1 ? String.fromCharCode(97 + (i % 26)) : ''}`, polys: [P] }));
      if (L.polys.length) preview.push(extrude(L.polys, a, L.h0, L.h0 + T));
    }
    return { parts, preview: concat(preview), layers: layers.length, holes, saved: saved * T };
  }

  // ---------------------------------------------------------------- laser: split parts bigger than the sheet
  // Cuts every part that cannot fit the sheet (either way round) into a grid of segments joined by round jigsaw keys,
  // so the pieces lock flat when glued. Knobs sit mid-way along each stretch of seam that is long enough and inside
  // the material, away from the other seams; a seam too short for a knob stays straight. Segments get the part name
  // plus -1, -2... The knob allowance is taken off the cell size so every segment fits the usable sheet W \u00d7 H.
  function segmentParts(parts, W, H) {
    const out = [], log = { split: 0, segments: 0, keys: 0 };
    const fits = b => (b.w <= W && b.h <= H) || (b.h <= W && b.w <= H);
    for (const pt of parts) {
      const b = polysBBox(pt.polys);
      if (fits(b)) { out.push(pt); continue; }
      const plan = (cw, ch) => { const kr = Math.min(10, Math.max(3, Math.min(cw, ch) / 14)), m = 4.5 * kr; return { kr, nx: Math.ceil(b.w / Math.max(1, cw - m)), ny: Math.ceil(b.h / Math.max(1, ch - m)) }; };
      const A = plan(W, H), B = plan(H, W), P = A.nx * A.ny <= B.nx * B.ny ? A : B;
      const nx = P.nx, ny = P.ny, kr = P.kr;
      const xs = [], ys = [];
      for (let i = 0; i <= nx; i++) xs.push(b.x0 + b.w * i / nx);
      for (let j = 0; j <= ny; j++) ys.push(b.y0 + b.h * j / ny);
      const knobs = []; // { owner: [i, j], poly }
      const knob = (cx, cy, dx, dy) => { // round knob at (cx, cy) with a neck back to the seam
        const o = circle(cx, cy, kr, 32), hw = 0.55 * kr, nx0 = cx - dx * 1.15 * kr, ny0 = cy - dy * 1.15 * kr;
        const neck = dx ? [[Math.min(nx0, cx), cy - hw], [Math.max(nx0, cx), cy - hw], [Math.max(nx0, cx), cy + hw], [Math.min(nx0, cx), cy + hw]]
          : [[cx - hw, Math.min(ny0, cy)], [cx + hw, Math.min(ny0, cy)], [cx + hw, Math.max(ny0, cy)], [cx - hw, Math.max(ny0, cy)]];
        return unionPolys([{ outer: o, holes: [] }, { outer: neck, holes: [] }]);
      };
      const solidAt = (x, y, r) => pt.polys.some(Q => pointIn([x, y], Q) && edgeDist([x, y], Q) >= r);
      const swapped = pt.polys.map(Q => ({ outer: Q.outer.map(q => [q[1], q[0]]), holes: Q.holes.map(h => h.map(q => [q[1], q[0]])) }));
      let flip = 0;
      for (let i = 1; i < nx; i++) for (let j = 0; j < ny; j++) { // seams x = xs[i]
        const sub = crossings(pt.polys, xs[i]).map(([a, c]) => [Math.max(a, ys[j] + 1.6 * kr), Math.min(c, ys[j + 1] - 1.6 * kr)]).filter(([a, c]) => c - a >= 0);
        for (const [a, c] of sub) {
          const ym = (a + c) / 2, s = (flip++ % 2) ? 1 : -1, cx = xs[i] + s * 1.15 * kr;
          if (!solidAt(cx, ym, kr + 1.2) || !solidAt(xs[i] - s * 0.5 * kr, ym, 0.8 * kr)) continue;
          knobs.push({ owner: [s > 0 ? i - 1 : i, j], poly: knob(cx, ym, s, 0) }); break;
        }
      }
      for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) { // seams y = ys[j]
        const sub = crossings(swapped, ys[j]).map(([a, c]) => [Math.max(a, xs[i] + 1.6 * kr), Math.min(c, xs[i + 1] - 1.6 * kr)]).filter(([a, c]) => c - a >= 0);
        for (const [a, c] of sub) {
          const xm = (a + c) / 2, s = (flip++ % 2) ? 1 : -1, cy = ys[j] + s * 1.15 * kr;
          if (!solidAt(xm, cy, kr + 1.2) || !solidAt(xm, ys[j] - s * 0.5 * kr, 0.8 * kr)) continue;
          knobs.push({ owner: [i, s > 0 ? j - 1 : j], poly: knob(xm, cy, 0, s) }); break;
        }
      }
      const big = 1e4, X = i => (i <= 0 ? b.x0 - big : i >= nx ? b.x1 + big : xs[i]), Y = j => (j <= 0 ? b.y0 - big : j >= ny ? b.y1 + big : ys[j]);
      const pieces = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        let reg = [{ outer: [[X(i), Y(j)], [X(i + 1), Y(j)], [X(i + 1), Y(j + 1)], [X(i), Y(j + 1)]], holes: [] }];
        const mine = knobs.filter(q => q.owner[0] === i && q.owner[1] === j).flatMap(q => q.poly);
        const others = knobs.filter(q => q.owner[0] !== i || q.owner[1] !== j).flatMap(q => q.poly);
        if (others.length) reg = diffPolys(reg, others);
        if (mine.length) reg = unionPolys([...reg, ...mine]);
        for (const Q of interPolys(pt.polys, reg).filter(Q => polysArea([Q]) > 1)) pieces.push(Q);
      }
      // fold small corner slivers into a neighbour when the merged piece still fits
      const cellA = (b.w / nx) * (b.h / ny);
      for (let guard = 0; guard < 50; guard++) {
        const order = pieces.map((Q, i) => [polysArea([Q]), i]).sort((x, y) => x[0] - y[0]);
        let done = false;
        for (const [ar, i] of order) {
          if (ar > cellA * 0.2) break;
          let best = null;
          pieces.forEach((R, j) => {
            if (j === i) return;
            const U = unionPolys([pieces[i], R]); if (U.length !== 1) return;
            const ub = polysBBox(U); if (!fits(ub)) return;
            if (!best || ub.w * ub.h < best.s) best = { j, U, s: ub.w * ub.h };
          });
          if (best) { pieces[best.j] = best.U[0]; pieces.splice(i, 1); done = true; break; }
        }
        if (!done) break;
      }
      let k = 0;
      for (const Q of pieces) out.push({ name: `${pt.name}-${++k}`, polys: [Q], of: pt.name });
      const made = pieces.length;
      log.split++; log.segments += made; log.keys += knobs.length;
    }
    return { parts: out, log };
  }

  // ---------------------------------------------------------------- laser: finger-joint box
  // Six (or five, open top) flat panels of thickness T that slot together with finger joints. The box shell is shared
  // out exactly: each edge beam (T \u00d7 T, between corner cubes) is cut into an odd number of fingers that go to the two
  // panels in turn, and each corner cube goes to the panel with the highest priority (bottom/top, then front/back, then
  // the sides), so the panels fill the shell with no gaps or overlaps. Sizes are the outside of the box unless
  // o.inside is set. Panels come back as 2D polygons in their own plane (extrude axis frame) and a 3D preview in place.
  function fingerBox(o) {
    const T = o.thickness, open = o.lid === false;
    const D3 = o.inside ? [o.w + 2 * T, o.d + 2 * T, o.h + (open ? T : 2 * T)] : [o.w, o.d, o.h];
    if (!(T > 0) || Math.min(...D3) < 3 * T + 1) throw new Error('The box is too small for that sheet thickness.');
    const fw = Math.max(2 * T, o.finger || 10);
    const PANELS = [
      { key: 'bottom', a: 2, side: 0, pr: 3 }, { key: 'top', a: 2, side: 1, pr: 3 },
      { key: 'front', a: 1, side: 0, pr: 2 }, { key: 'back', a: 1, side: 1, pr: 2 },
      { key: 'left', a: 0, side: 0, pr: 1 }, { key: 'right', a: 0, side: 1, pr: 1 }
    ].filter(p => p.key !== 'top' || !open);
    const slab = p => { const lo = [0, 0, 0], hi = D3.slice(); if (p.side) lo[p.a] = D3[p.a] - T; else hi[p.a] = T; return { lo, hi }; };
    const has = (a, side) => PANELS.some(p => p.a === a && p.side === side);
    const cells = []; // { lo, hi, owner }
    for (const X of PANELS.filter(p => p.a === 0)) for (const Y of PANELS.filter(p => p.a === 1)) for (const Z of PANELS.filter(p => p.a === 2)) {
      const lo = [X, Y, Z].map((P, a) => (P.side ? D3[a] - T : 0));
      cells.push({ lo, hi: lo.map(v => v + T), owner: Z });
    }
    let fingers = 0;
    for (let i = 0; i < PANELS.length; i++) for (let j = i + 1; j < PANELS.length; j++) {
      const P = PANELS[i], Q = PANELS[j]; if (P.a === Q.a) continue;
      const along = 3 - P.a - Q.a, sp = slab(P), sq = slab(Q);
      const lo0 = has(along, 0) ? T : 0, hi0 = has(along, 1) ? D3[along] - T : D3[along], len = hi0 - lo0;
      let n = Math.max(3, Math.round(len / fw)); if (n % 2 === 0) n += 1;
      while (n > 3 && len / n < 1.5 * T) n -= 2;
      const hiP = P.pr >= Q.pr ? P : Q, loP = hiP === P ? Q : P;
      for (let k = 0; k < n; k++) {
        const lo = [0, 1, 2].map(a => Math.max(sp.lo[a], sq.lo[a])), hi = [0, 1, 2].map(a => Math.min(sp.hi[a], sq.hi[a]));
        lo[along] = lo0 + len * k / n; hi[along] = lo0 + len * (k + 1) / n;
        cells.push({ lo, hi, owner: k % 2 === 0 ? hiP : loP });
      }
      fingers += n;
    }
    const panels = [], preview = [];
    for (const P of PANELS) {
      const u = UA[P.a], w = WA[P.a], sl = slab(P);
      let poly = [{ outer: [[0, 0], [D3[u], 0], [D3[u], D3[w]], [0, D3[w]]], holes: [] }];
      const away = cells.filter(c => c.owner !== P && c.lo[P.a] < sl.hi[P.a] - 1e-9 && c.hi[P.a] > sl.lo[P.a] + 1e-9)
        .map(c => ({ outer: [[c.lo[u], c.lo[w]], [c.hi[u], c.lo[w]], [c.hi[u], c.hi[w]], [c.lo[u], c.hi[w]]], holes: [] }));
      if (away.length) poly = diffPolys(poly, away);
      panels.push({ name: P.key, polys: poly, axis: P.a, h0: sl.lo[P.a], h1: sl.hi[P.a] });
      preview.push(fixSign(extrude(poly, P.a, sl.lo[P.a], sl.hi[P.a])));
    }
    return { parts: panels.map(p => ({ name: p.name, polys: p.polys })), panels, preview: concat(preview), size: D3, fingers };
  }

  // ---------------------------------------------------------------- DXF (R12, millimetres)
  // Same layout as svgSheet: closed polylines on layer CUT (red), part names as TEXT on layer ENGRAVE (blue), an
  // optional sheet outline on layer FRAME.
  function dxfSheet(placed, sheet, W, H, opts) {
    opts = opts || {};
    const f = n => (Math.round(n * 1000) / 1000).toString(), L = [];
    const g = (c, v) => L.push(String(c), String(v));
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4);
    g(9, '$EXTMIN'); g(10, 0); g(20, 0); g(30, 0); g(9, '$EXTMAX'); g(10, f(W)); g(20, f(H)); g(30, 0); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1); g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0); g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, 3);
    for (const [n, c] of [['CUT', 1], ['ENGRAVE', 5], ['FRAME', 8]]) { g(0, 'LAYER'); g(2, n); g(70, 0); g(62, c); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const poly = (pts, layer) => {
      g(0, 'POLYLINE'); g(8, layer); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 1);
      for (const q of pts) { g(0, 'VERTEX'); g(8, layer); g(10, f(q[0])); g(20, f(q[1])); g(30, 0); }
      g(0, 'SEQEND'); g(8, layer);
    };
    if (opts.frame) poly([[0, 0], [W, 0], [W, H], [0, H]], 'FRAME');
    for (const p of placed) {
      if (p.sheet !== sheet) continue;
      for (const P of p.polys) for (const loop of [P.outer, ...P.holes]) poly(loop, 'CUT');
      if (opts.labels !== false && p.w > 8 && p.h > 6) {
        const fs = Math.max(3, Math.min(14, p.h * 0.2, p.w * 0.12)), lp = labelPoint(p.polys, fs);
        if (lp) { g(0, 'TEXT'); g(8, 'ENGRAVE'); g(10, f(lp[0])); g(20, f(lp[1])); g(30, 0); g(40, f(fs * 0.7)); g(1, String(p.name).replace(/[\r\n]/g, ' ')); g(72, 1); g(11, f(lp[0])); g(21, f(lp[1])); g(31, 0); g(73, 2); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }
  // turn a soup about the Z axis through (cx, cy)
  function rotateZ(p, ang, cx, cy) {
    const c = Math.cos(ang), s = Math.sin(ang), o = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { const x = p[i] - cx, y = p[i + 1] - cy; o[i] = cx + c * x - s * y; o[i + 1] = cy + s * x + c * y; o[i + 2] = p[i + 2]; }
    return o;
  }

  // ---------------------------------------------------------------- laser: interlocking waffle
  function crossings(polys, s0) { // vertical line s = s0 through polys in (s, z); returns [[z0,z1],...]
    const zs = [];
    for (const P of polys) for (const L of [P.outer, ...P.holes]) for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
      const a = L[j], b = L[i];
      if ((a[0] > s0) !== (b[0] > s0)) zs.push(a[1] + (s0 - a[0]) / (b[0] - a[0]) * (b[1] - a[1]));
    }
    zs.sort((x, y) => x - y);
    const out = []; for (let i = 0; i + 1 < zs.length; i += 2) out.push([zs[i], zs[i + 1]]);
    return out;
  }
  function waffle(p, o) {
    if (o.angle) { // turn the slicing grid: slice the model turned the other way, then turn the preview back
      const b0 = Core.bbox(p), cx = (b0.min[0] + b0.max[0]) / 2, cy = (b0.min[1] + b0.max[1]) / 2, a = o.angle * Math.PI / 180;
      const r = waffle(rotateZ(p, -a, cx, cy), Object.assign({}, o, { angle: 0 }));
      return Object.assign(r, { preview: rotateZ(r.preview, a, cx, cy) });
    }
    const bb = Core.bbox(p), T = o.thickness, c = o.slotClear || 0.1;
    const xs = [], ys = [];
    for (let i = 0; i < o.nx; i++) xs.push(bb.min[0] + (bb.max[0] - bb.min[0]) * (i + 0.5) / o.nx);
    for (let j = 0; j < o.ny; j++) ys.push(bb.min[1] + (bb.max[1] - bb.min[1]) * (j + 0.5) / o.ny);
    // X slices live in (s=y, z); Y slices in (s=x, z)
    const X = xs.map(x => unionPolys(Core.sectionPolys(p, 0, Core.nudgePlane(p, 0, x)), 'evenodd'));
    const Y = ys.map(y => unionPolys(Core.sectionPolys(p, 1, Core.nudgePlane(p, 1, y)), 'evenodd').map(P => ({ outer: P.outer.map(q => [q[1], q[0]]), holes: P.holes.map(h => h.map(q => [q[1], q[0]])) })));
    const slotsX = X.map(() => []), slotsY = Y.map(() => []);
    const rect = (s0, s1, z0, z1) => ({ outer: [[s0, z0], [s1, z0], [s1, z1], [s0, z1]], holes: [] });
    for (let i = 0; i < xs.length; i++) for (let j = 0; j < ys.length; j++) {
      const ix = crossings(X[i], ys[j]), iy = crossings(Y[j], xs[i]);
      for (const A of ix) for (const B of iy) {
        const lo = Math.max(A[0], B[0]), hi = Math.min(A[1], B[1]);
        if (hi - lo < T * 1.5) continue;
        const zm = (lo + hi) / 2;
        slotsX[i].push(rect(ys[j] - T / 2 - c, ys[j] + T / 2 + c, zm, A[1] + 1));
        slotsY[j].push(rect(xs[i] - T / 2 - c, xs[i] + T / 2 + c, B[0] - 1, zm));
      }
    }
    const parts = [], preview = [];
    X.forEach((P, i) => {
      const cut = slotsX[i].length ? diffPolys(P, slotsX[i]) : P;
      cut.forEach((Q, k) => parts.push({ name: `X${i + 1}${cut.length > 1 ? String.fromCharCode(97 + (k % 26)) : ''}`, polys: [Q] }));
      if (cut.length) preview.push(extrude(cut, 0, xs[i] - T / 2, xs[i] + T / 2));
    });
    Y.forEach((P, j) => {
      const cut = slotsY[j].length ? diffPolys(P, slotsY[j]) : P;
      cut.forEach((Q, k) => parts.push({ name: `Y${j + 1}${cut.length > 1 ? String.fromCharCode(97 + (k % 26)) : ''}`, polys: [Q] }));
      // axis 1 frame is (u=z, w=x): swap back
      const uv = cut.map(Q => ({ outer: Q.outer.map(q => [q[1], q[0]]), holes: Q.holes.map(h => h.map(q => [q[1], q[0]])) }));
      if (uv.length) preview.push(extrude(uv, 1, ys[j] - T / 2, ys[j] + T / 2));
    });
    return { parts, preview: concat(preview) };
  }

  // ---------------------------------------------------------------- sheet nesting + SVG
  // Shelf packing. `edge` is the free border kept at the sheet edges (default: the gap between items); build plates
  // pass 0 because their size already has the print margin taken off.
  function pack(items, W, H, gap, edge) {
    const e = edge == null ? gap : Math.max(0, edge), W2 = W - 2 * e + 1e-6, H2 = H - 2 * e + 1e-6, We = W - e + 1e-6, He = H - e + 1e-6;
    const order = items.map((it, i) => ({ i, w: it.w, h: it.h })).sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
    const out = new Array(items.length);
    const sheets = [];
    const newSheet = () => { const s = { rows: [], y: e }; sheets.push(s); return s; };
    for (const it of order) {
      let w = it.w, h = it.h, rot = false;
      if (h > w && h <= W2 && w <= H2) { [w, h] = [h, w]; rot = true; }
      if (w > W2 || h > H2) {
        if (h <= W2 && w <= H2) { [w, h] = [h, w]; rot = !rot; }
        else { out[it.i] = { sheet: -1 }; continue; }
      }
      let placed = false;
      for (let si = 0; si < sheets.length && !placed; si++) {
        const s = sheets[si];
        for (const r of s.rows) if (h <= r.h && r.x + w <= We) { out[it.i] = { sheet: si, x: r.x, y: r.y, rot }; r.x += w + gap; placed = true; break; }
        if (!placed && s.y + h <= He) { const r = { y: s.y, h, x: e }; s.rows.push(r); s.y += h + gap; out[it.i] = { sheet: si, x: r.x, y: r.y, rot }; r.x += w + gap; placed = true; }
      }
      if (!placed) { const s = newSheet(); const r = { y: s.y, h, x: e }; s.rows.push(r); s.y += h + gap; out[it.i] = { sheet: sheets.length - 1, x: r.x, y: r.y, rot }; r.x += w + gap; }
    }
    return { place: out, sheets: sheets.length };
  }
  function nestParts(parts, W, H, gap, kerf) {
    const prepped = parts.map(pt => {
      const polys = kerf ? offset(pt.polys, kerf / 2) : pt.polys;
      const bb = polysBBox(polys);
      return { name: pt.name, polys, bb, w: bb.w, h: bb.h };
    });
    const { place, sheets } = pack(prepped, W, H, gap);
    const placed = prepped.map((pt, i) => {
      const pl = place[i]; if (pl.sheet < 0) return { name: pt.name, sheet: -1 };
      const f = pl.rot ? (q => [pl.x + (q[1] - pt.bb.y0), pl.y + (pt.bb.x1 - q[0])]) : (q => [pl.x + (q[0] - pt.bb.x0), pl.y + (q[1] - pt.bb.y0)]);
      return { name: pt.name, sheet: pl.sheet, polys: transformPolys(pt.polys, f), w: pl.rot ? pt.h : pt.w, h: pl.rot ? pt.w : pt.h, x: pl.x, y: pl.y };
    });
    return { placed, sheets, unplaced: placed.filter(p => p.sheet < 0).map(p => p.name) };
  }
  function svgSheet(placed, sheet, W, H, opts) {
    opts = opts || {};
    const f = n => (Math.round(n * 1000) / 1000).toString();
    const path = L => 'M' + L.map(q => f(q[0]) + ' ' + f(H - q[1])).join('L') + 'Z';
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">\n`;
    if (opts.frame) s += `<rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="none" stroke="#999999" stroke-width="0.2"/>\n`;
    for (const p of placed) {
      if (p.sheet !== sheet) continue;
      const d = p.polys.map(P => [P.outer, ...P.holes].map(path).join('')).join('');
      s += `<path d="${d}" fill="${opts.fill || 'none'}" fill-rule="evenodd" stroke="#ff0000" stroke-width="0.1"/>\n`;
      if (opts.labels !== false && p.w > 8 && p.h > 6) {
        const fs = Math.max(3, Math.min(14, p.h * 0.2, p.w * 0.12));
        const lp = labelPoint(p.polys, fs);
        if (lp) s += `<text x="${f(lp[0])}" y="${f(H - lp[1])}" font-family="Arial, sans-serif" font-size="${f(fs)}" text-anchor="middle" dominant-baseline="middle" fill="#0000ff">${p.name}</text>\n`;
      }
    }
    return s + '</svg>\n';
  }
  function labelPoint(polys, fs) {
    const b = polysBBox(polys); let best = null, bd = 0; const step = Math.max(1, Math.min(b.w, b.h) / 12);
    for (let x = b.x0 + step / 2; x < b.x1; x += step) for (let y = b.y0 + step / 2; y < b.y1; y += step) {
      const P = polys.find(Q => pointIn([x, y], Q)); if (!P) continue;
      const d = edgeDist([x, y], P); if (d > bd) { bd = d; best = [x, y]; }
    }
    return bd > fs * 0.6 ? best : null;
  }

  // ---------------------------------------------------------------- low-poly + wireframe
  // Low-poly restyle. Plain vertex clustering leaves non-manifold edges and holes, so the facets
  // come from the mesh doctor's quadric edge collapse (watertight by construction) with a face
  // budget that gives facets roughly cellSize across.
  function lowPoly(p, cellSize) {
    const MD = G.MeshDoctor || (typeof require === 'function' ? require('./repair.js') : null);
    if (!MD) throw new Error('lowPoly needs MeshDoctor (repair.js)');
    let area = 0;
    for (let i = 0; i < p.length; i += 9) {
      const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
      const vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
      area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    const target = Math.max(60, Math.round(area / (0.433 * cellSize * cellSize)));
    const sm = target >= p.length / 9 ? { p: Float64Array.from(p) } : MD.simplify(p, target);
    const wd = MD.weldTol(sm.p, 1e-4);
    const verts = [], faces = [];
    for (let i = 0; i < wd.V.length; i += 3) verts.push([wd.V[i], wd.V[i + 1], wd.V[i + 2]]);
    for (let i = 0; i < wd.F.length; i += 3) faces.push([wd.F[i], wd.F[i + 1], wd.F[i + 2]]);
    return { p: Float64Array.from(sm.p), verts, faces };
  }
  function wireframe(verts, faces, r, nodeR) {
    const edges = new Set(); const E = [];
    for (const [a, b, c] of faces) for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = x < y ? x + ',' + y : y + ',' + x; if (!edges.has(k)) { edges.add(k); E.push([x, y]); } }
    const used = new Set(); E.forEach(([x, y]) => { used.add(x); used.add(y); });
    const out = [];
    const S = 6;
    for (const [ia, ib] of E) {
      const A = verts[ia], B = verts[ib];
      const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]; const L = Math.hypot(...d); if (L < 1e-6) continue;
      const z = d.map(x => x / L); const t = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      let xv = crossv(t, z); const xl = Math.hypot(...xv); xv = xv.map(q => q / xl); const yv = crossv(z, xv);
      const ring = (P) => { const R = []; for (let k = 0; k < S; k++) { const th = 2 * Math.PI * k / S; R.push([0, 1, 2].map(q => P[q] + r * (Math.cos(th) * xv[q] + Math.sin(th) * yv[q]))); } return R; };
      const ra = ring(A), rb = ring(B);
      for (let k = 0; k < S; k++) {
        const k1 = (k + 1) % S, mid = 2 * Math.PI * (k + 0.5) / S;
        const n = [0, 1, 2].map(q => Math.cos(mid) * xv[q] + Math.sin(mid) * yv[q]);
        pushTri(out, ra[k], ra[k1], rb[k1], n); pushTri(out, ra[k], rb[k1], rb[k], n);
        pushTri(out, A, ra[k1], ra[k], z.map(q => -q)); pushTri(out, B, rb[k], rb[k1], z);
      }
    }
    // octahedral nodes
    const O = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const OF = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
    for (const i of used) {
      const C = verts[i];
      const pts = O.map(o => [C[0] + o[0] * nodeR, C[1] + o[1] * nodeR, C[2] + o[2] * nodeR]);
      for (const [a, b, c] of OF) { const n = [0, 1, 2].map(q => (pts[a][q] + pts[b][q] + pts[c][q]) / 3 - C[q]); pushTri(out, pts[a], pts[b], pts[c], n); }
    }
    return { p: Float64Array.from(out), edges: E.length, nodes: used.size };
  }

  // ---------------------------------------------------------------- zip (stored) + 3MF
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zipBytes(files) {
    const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
    const now = new Date(); const dd = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(); const tt = (now.getHours() << 11) | (now.getMinutes() << 5);
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
      const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(10, tt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(12, tt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    }
    const cs = central.reduce((s, x) => s + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    const all = [...parts, ...central, new Uint8Array(e.buffer)];
    const total = all.reduce((s, x) => s + x.length, 0); const out = new Uint8Array(total); let k = 0; for (const x of all) { out.set(x, k); k += x.length; }
    return out;
  }
  // objects: [{ name, p }] -> a 3MF package with one object and one build item each (slicers list them separately).
  // opt.plates: [[object index, ...], ...] adds Bambu Studio / OrcaSlicer build plates (Metadata/model_settings.config:
  // one <plate> per bed load, listing its objects). The caller places plate k's objects at that slicer's plate origin
  // (bambuPlateOrigin), so each object also sits on its own plate by position.
  // opt.bambu: a BAMBU_PRESETS key ('P1S', 'A1', ...). Bambu Studio only reads the plates (and keeps object positions)
  // from a file that names a BambuStudio generator and carries Metadata/project_settings.config; any other 3MF is
  // loaded as "geometry data only" with every object re-centred on plate 1 (bbs_3mf.cpp, v02.08). So with opt.bambu the
  // Application tag says BambuStudio and a minimal project config selects that printer's stock system presets.
  // Colored exports are always Bambu Studio ready: any part or object with a .color (or opt.filaments) gets a filament
  // slot per color (opt.filaments order first), its extruder set from that slot when the tool left it unset, a plate
  // config, and a project config for the chosen printer (A1 when none or not a Bambu preset).
  function colorPrep(objects, opt) {
    opt = { ...(opt || {}) };
    const U = c => String(c).toUpperCase(), items = [];
    objects.forEach(ob => (ob.parts && ob.parts.length ? ob.parts : [ob]).forEach(x => items.push(x)));
    const colored = items.some(x => x.color) || (opt.filaments && opt.filaments.length);
    if (!colored) return { objects, opt };
    const fil = (opt.filaments || []).map(f => ({ ...f, color: U(f.color || '#FFFFFF') }));
    const slot = c => { const u = U(c); let i = fil.findIndex(f => f.color === u); if (i < 0) { fil.push({ color: u }); i = fil.length - 1; } return i + 1; };
    const fix = x => x.color ? (x.extruder ? x : { ...x, extruder: slot(x.color) }) : (x.extruder && fil[x.extruder - 1] ? { ...x, color: fil[x.extruder - 1].color } : x); // a part on a filament slot shows that filament's color
    objects = objects.map(ob => ob.parts && ob.parts.length ? { ...ob, parts: ob.parts.map(fix) } : fix(ob));
    let maxE = 1; objects.forEach(ob => (ob.parts && ob.parts.length ? ob.parts : [ob]).forEach(x => { maxE = Math.max(maxE, x.extruder || 1); }));
    while (fil.length < maxE) fil.push({ color: '#F2F2F2' });
    opt.filaments = fil;
    if (!opt.plates) opt.plates = [objects.map((o, i) => i)];
    if (!opt.bambu || !BAMBU_PRESETS[opt.bambu]) opt.bambu = 'A1';
    return { objects, opt };
  }
  function threeMF(objects, opt) {
    ({ objects, opt } = colorPrep(objects, opt));
    const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    const plates = opt && opt.plates, bambu = plates && opt.bambu && BAMBU_PRESETS[opt.bambu] || null;
    let res = '', build = '';
    // ob.parts: [{ name, p, extruder }] makes one object built from several meshes (a colour part each); ids run
    // parts first, then the object that groups them. ids[i] is object i's id.
    const ids = [], partIds = []; let nid = 0;
    // colours (3MF core basematerials): parts or objects with .color get a display colour any 3MF viewer shows;
    // Bambu Studio / OrcaSlicer take the filament from the extruder in model_settings.config.
    const cols = []; objects.forEach(ob => (ob.parts && ob.parts.length ? ob.parts : [ob]).forEach(x => { if (x.color && !cols.includes(String(x.color).toUpperCase())) cols.push(String(x.color).toUpperCase()); }));
    if (cols.length) { nid = 1; res += `<basematerials id="1">${cols.map((c, i) => `<base name="Color ${i + 1}" displaycolor="${esc(c)}FF"/>`).join('')}</basematerials>\n`; }
    const pidOf = c => c && cols.length ? ` pid="1" pindex="${cols.indexOf(String(c).toUpperCase())}"` : '';
    const meshXML = (id, name, p, color) => {
      const { V, F } = Core.weld(p);
      const vs = []; for (let k = 0; k < V.length; k += 3) vs.push(`<vertex x="${V[k].toFixed(4)}" y="${V[k + 1].toFixed(4)}" z="${V[k + 2].toFixed(4)}"/>`);
      const ts = []; for (let k = 0; k < F.length; k += 3) if (F[k] !== F[k + 1] && F[k + 1] !== F[k + 2] && F[k] !== F[k + 2]) ts.push(`<triangle v1="${F[k]}" v2="${F[k + 1]}" v3="${F[k + 2]}"/>`);
      return `<object id="${id}" name="${esc(name)}" type="model"${pidOf(color)}><mesh><vertices>${vs.join('')}</vertices><triangles>${ts.join('')}</triangles></mesh></object>\n`;
    };
    objects.forEach((ob, i) => {
      if (ob.parts && ob.parts.length) {
        const pids = ob.parts.map(pt => { const id = ++nid; res += meshXML(id, pt.name || ob.name, pt.p, pt.color); return id; });
        const id = ++nid; ids.push(id); partIds.push(pids);
        res += `<object id="${id}" name="${esc(ob.name)}" type="model"><components>${pids.map(k => `<component objectid="${k}"/>`).join('')}</components></object>\n`;
      } else { const id = ++nid; ids.push(id); partIds.push(null); res += meshXML(id, ob.name, ob.p, ob.color); }
      build += `<item objectid="${ids[i]}"/>`;
    });
    const model = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">${bambu ? BAMBU_APP : 'Expressarte'}</metadata>${bambu ? '<metadata name="Description">Made with Expressarte</metadata>' : ''}${opt && opt.title ? `<metadata name="Title">${esc(opt.title)}</metadata>` : ''}<resources>\n${res}</resources><build>${build}</build></model>`;
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' + (plates ? '<Default Extension="config" ContentType="text/xml"/>' : '') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>' },
      { name: '3D/3dmodel.model', data: model }
    ];
    if (plates) files.push({ name: 'Metadata/model_settings.config', data: plateConfig(objects, plates, esc, ids, partIds) });
    if (bambu) files.push({ name: 'Metadata/project_settings.config', data: JSON.stringify(bambuProject(bambu, opt.filaments, opt.project), null, 4) + '\n' });
    return zipBytes(files);
  }
  // Stock Bambu Lab system presets (0.4 nozzle, 0.20 mm Standard, Bambu PLA Basic), as in Bambu Studio's BBL profiles.
  // The H2D is left out: its dual-nozzle project config needs per-extruder settings, so it gets the plain file.
  const BAMBU_APP = 'BambuStudio-02.08.02.61';
  const BAMBU_PRESETS = {
    'A1 mini': ['Bambu Lab A1 mini', '0.20mm Standard @BBL A1M', 'Bambu PLA Basic @BBL A1M'],
    'A1': ['Bambu Lab A1', '0.20mm Standard @BBL A1', 'Bambu PLA Basic @BBL A1'],
    'P1P': ['Bambu Lab P1P', '0.20mm Standard @BBL P1P', 'Bambu PLA Basic @BBL P1P'],
    'P1S': ['Bambu Lab P1S', '0.20mm Standard @BBL X1C', 'Bambu PLA Basic @BBL P1S 0.4 nozzle'],
    'P2S': ['Bambu Lab P2S', '0.20mm Standard @BBL P2S', 'Bambu PLA Basic @BBL P2S'],
    'X1 Carbon': ['Bambu Lab X1 Carbon', '0.20mm Standard @BBL X1C', 'Bambu PLA Basic @BBL X1C'],
    'H2S': ['Bambu Lab H2S', '0.20mm Standard @BBL H2S', 'Bambu PLA Basic @BBL H2S']
  };
  // filaments: optional [{ color: '#RRGGBB' }] for a multi-colour (AMS) project, one entry per filament slot
  // project: optional extra print settings for the project (e.g. layer_height for a layered color print)
  function bambuProject([model, print, filament], filaments, project) {
    const o = { from: 'project', name: 'project_settings', version: BAMBU_APP.slice(12), printer_model: model, printer_settings_id: `${model} 0.4 nozzle`, nozzle_diameter: ['0.4'], print_settings_id: print, filament_settings_id: [filament] };
    if (!filaments || !filaments.length) filaments = [{ color: '#F2F2F2' }]; // always name the filament color, even for one color
    o.filament_settings_id = filaments.map(() => filament); o.filament_colour = filaments.map(f => String(f.color || '#FFFFFF').toUpperCase());
    if (project) Object.assign(o, project);
    return o;
  }
  // Bambu Studio's model_settings.config: object names, and one <plate> per bed load with its objects (ids are 1-based).
  function plateConfig(objects, plates, esc, ids, partIds) {
    const m = (k, v) => `<metadata key="${k}" value="${esc(v)}"/>`;
    ids = ids || objects.map((o, i) => i + 1); partIds = partIds || [];
    let x = '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n';
    objects.forEach((ob, i) => {
      const pids = partIds[i];
      // ob.settings: per-object slicer settings (Bambu Studio / OrcaSlicer keys, e.g. fuzzy_skin) written as object metadata
      const extra = ob.settings ? Object.entries(ob.settings).map(([k, v]) => m(k, v)).join('') : '';
      if (!pids) { x += `  <object id="${ids[i]}">${m('name', ob.name)}${m('extruder', ob.extruder || 1)}${extra}</object>\n`; return; }
      x += `  <object id="${ids[i]}">${m('name', ob.name)}${m('extruder', ob.parts[0].extruder || 1)}${extra}\n`;
      ob.parts.forEach((pt, k) => { x += `    <part id="${pids[k]}" subtype="normal_part">${m('name', pt.name || ob.name)}${m('extruder', pt.extruder || 1)}</part>\n`; });
      x += '  </object>\n';
    });
    let ident = 0;
    plates.forEach((list, k) => {
      x += `  <plate>${m('plater_id', k + 1)}${m('plater_name', `Plate ${k + 1}`)}${m('locked', 'false')}\n`;
      for (const i of list) x += `    <model_instance>${m('object_id', ids[i])}${m('instance_id', 0)}${m('identify_id', ++ident)}</model_instance>\n`;
      x += '  </plate>\n';
    });
    return x + '</config>\n';
  }
  // Where Bambu Studio / OrcaSlicer put plate k (0-based) of n: a grid ceil(sqrt(n)) plates wide, each plate's bed
  // width and depth plus a fifth apart, rows going toward -y (PartPlateList::compute_shape_position).
  function bambuPlateOrigin(k, n, bedW, bedD) {
    const v = Math.sqrt(n), r = Math.round(v), cols = v > r ? r + 1 : r;
    return [(k % cols) * bedW * 1.2, -Math.floor(k / cols) * bedD * 1.2];
  }

  // ---------------------------------------------------------------- thermoform (vacuum-form) buck
  // A top-down heightfield of the model (so nothing undercuts), walls spread out at the draft angle so the formed
  // sheet pulls off, standing on a base plate with a margin all round, and vent holes through the buck at the bottom
  // of every pocket and along the toe of the walls so the vacuum reaches them. o: {draft (\u00b0 from vertical), base (mm), margin (mm), ventD (mm),
  // pocket (min pocket depth to vent, mm), cell (mm)}. Returns {p, nx, ny, cell, vents:[[x,y]], size:[w,d,h], heights}.
  function buck(p, bvh, o = {}) {
    const bb = Core.bbox(p), draft = Math.min(45, Math.max(1, o.draft == null ? 5 : o.draft)), base = Math.max(0.5, o.base == null ? 3 : o.base);
    const ext = Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1]), hMax = bb.max[2] - bb.min[2];
    const cot = 1 / Math.tan(draft * Math.PI / 180), skirt = hMax * Math.tan(draft * Math.PI / 180);
    const margin = Math.max(2, o.margin == null ? 10 : o.margin);
    const W = bb.max[0] - bb.min[0] + 2 * (skirt + margin), D = bb.max[1] - bb.min[1] + 2 * (skirt + margin);
    let cell = o.cell || Math.max(0.4, ext / 300);
    if ((W / cell) * (D / cell) > 360000) cell = Math.sqrt(W * D / 360000);
    const nx = Math.ceil(W / cell) + 1, ny = Math.ceil(D / cell) + 1, x0 = bb.min[0] - skirt - margin, y0 = bb.min[1] - skirt - margin;
    const h = new Float32Array(nx * ny), dir = [0, 0, -1];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const t = Core.rayNearest(bvh, [x0 + i * cell, y0 + j * cell, bb.max[2] + 1], dir);
      h[j * nx + i] = isFinite(t) ? Math.max(0, hMax + 1 - t) : 0;
    }
    // draft: h(p) >= h(q) - |p - q| \u00b7 cot(draft), by chamfer propagation (forward and backward raster passes)
    const a = cell * cot, dg = cell * Math.SQRT2 * cot;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; let v = h[k];
        if (i > 0) v = Math.max(v, h[k - 1] - a); if (j > 0) { v = Math.max(v, h[k - nx] - a); if (i > 0) v = Math.max(v, h[k - nx - 1] - dg); if (i < nx - 1) v = Math.max(v, h[k - nx + 1] - dg); } h[k] = v; }
      for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; let v = h[k];
        if (i < nx - 1) v = Math.max(v, h[k + 1] - a); if (j < ny - 1) { v = Math.max(v, h[k + nx] - a); if (i < nx - 1) v = Math.max(v, h[k + nx + 1] - dg); if (i > 0) v = Math.max(v, h[k + nx - 1] - dg); } h[k] = v; }
    }
    // pockets: closing (max then min filter) minus the surface; vent the deepest point of each pocket
    const R = Math.max(2, Math.round((o.pocketR || Math.max(6, ext / 12)) / cell));
    const filt = (A, mx) => { const B = new Float32Array(A.length), C = new Float32Array(A.length), f = mx ? Math.max : Math.min;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let v = A[j * nx + i]; for (let d = -R; d <= R; d++) { const ii = i + d; if (ii >= 0 && ii < nx) v = f(v, A[j * nx + ii]); } B[j * nx + i] = v; }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let v = B[j * nx + i]; for (let d = -R; d <= R; d++) { const jj = j + d; if (jj >= 0 && jj < ny) v = f(v, B[jj * nx + i]); } C[j * nx + i] = v; }
      return C; };
    const cl = filt(filt(h, true), false), minPocket = o.pocket == null ? 1.5 : o.pocket;
    const ventD = Math.max(0, o.ventD == null ? 1.5 : o.ventD), vr = Math.max(0.5, ventD / 2 / cell), vents = [], hole = new Uint8Array((nx - 1) * (ny - 1));
    if (ventD > 0) {
      const cand = [];
      for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const k = j * nx + i, dp = cl[k] - h[k]; if (dp >= minPocket && h[k] > 0.2) cand.push([dp, i, j]);
        // the toe of every wall, where the sheet meets the base plate: air is trapped there too
        else if (h[k] > 0.2 && h[k] < 1.2 && (h[k - 1] === 0 || h[k + 1] === 0 || h[k - nx] === 0 || h[k + nx] === 0)) cand.push([minPocket * 0.5 + h[k] * 1e-3, i, j]); }
      cand.sort((u, v) => v[0] - u[0]);
      const sp = (o.ventSpacing || Math.max(8, ext / 10)) / cell, sp2 = sp * sp, rr = Math.ceil(vr);
      for (const [, i, j] of cand) {
        if (vents.some(([vi, vj]) => (vi - i) ** 2 + (vj - j) ** 2 < sp2)) continue;
        if (i - rr < 1 || j - rr < 1 || i + rr > nx - 3 || j + rr > ny - 3) continue;
        vents.push([i, j]); if (vents.length >= (o.maxVents || 80)) break;
      }
      for (const [i, j] of vents) for (let cj = j - rr - 1; cj <= j + rr; cj++) for (let ci = i - rr - 1; ci <= i + rr; ci++) if ((ci + 0.5 - i) ** 2 + (cj + 0.5 - j) ** 2 <= vr * vr + 0.25) hole[cj * (nx - 1) + ci] = 1;
    }
    const thick = (i, j) => base + h[j * nx + i], map = (i, j, t) => [x0 + i * cell, y0 + j * cell, t];
    const out = vents.length ? maskedHeightSolid(nx, ny, (i, j) => !hole[j * (nx - 1) + i], thick, map) : heightSolid(nx, ny, thick, map, false);
    let top = 0; for (let k = 0; k < h.length; k++) top = Math.max(top, h[k]);
    return { p: out, nx, ny, cell, draft, vents: vents.map(([i, j]) => [x0 + i * cell, y0 + j * cell]), size: [(nx - 1) * cell, (ny - 1) * cell, base + top], heights: h };
  }
  // ---------------------------------------------------------------- stepped extrude and storage boxes
  // A stack of layers, each a 2D region extruded between z0 and z1 (layers touch:
  // z1 of one is z0 of the next). Walls run up every loop of every layer; between
  // layers the exposed part of the lower region gets an up face and the overhang of
  // the upper region a down face. Regions are snapped through clipper first so the
  // shared outlines match exactly and the result is a closed solid.
  // CLIP: while a part is built in pieces (GPPlates.withClip), every layer is cut to that piece's region (a rectangle
  // with dovetail tabs), so any generator that builds from stepped layers can be split to the bed with joints.
  let CLIP = null;
  // region: polygons, or { low, high, z }: layers up to z (a floor) are cut to low (with the dovetails), the rest to high
  const clipFor = l => Array.isArray(CLIP) ? CLIP : l.z1 <= CLIP.z + 1e-6 ? CLIP.low : CLIP.high;
  function withClip(region, fn) { const prev = CLIP; CLIP = region; try { return fn(); } finally { CLIP = prev; } }
  const clipActive = () => !!CLIP;
  // the layers cut to the current piece region (what steppedExtrude builds), for generators that extrude with Manifold
  const clipLayers = layers => layers.filter(l => l.z1 > l.z0).map(l => ({ z0: l.z0, z1: l.z1, polys: CLIP ? interPolys(unionPolys(l.polys), clipFor(l)) : unionPolys(l.polys) })).filter(l => l.polys.length);
  function steppedExtrude(layers) {
    const L = layers.filter(l => l.z1 > l.z0).map(l => ({ z0: l.z0, z1: l.z1, polys: CLIP ? interPolys(unionPolys(l.polys), clipFor(l)) : unionPolys(l.polys) })).filter(l => l.polys.length);
    if (!L.length) return new Float64Array(0);
    const Pt = [], Tt = [];
    const norm = polys => polys.map(P => ({
      outer: area2(P.outer) > 0 ? P.outer : P.outer.slice().reverse(),
      holes: P.holes.map(h => area2(h) < 0 ? h : h.slice().reverse())
    }));
    const cap = (polys, z, sign) => { if (polys.length) Core.triangulatePolys(norm(polys), 2, z, sign, Pt, Tt, 0); };
    cap(L[0].polys, L[0].z0, -1);
    for (let k = 0; k < L.length; k++) {
      const { z0, z1 } = L[k], next = L[k + 1];
      for (const P of norm(L[k].polys)) for (const R of [P.outer, ...P.holes]) for (let i = 0; i < R.length; i++) {
        const p0 = R[i], p1 = R[(i + 1) % R.length], n = [p1[1] - p0[1], -(p1[0] - p0[0]), 0];
        pushTri(Pt, [p0[0], p0[1], z0], [p1[0], p1[1], z0], [p1[0], p1[1], z1], n);
        pushTri(Pt, [p0[0], p0[1], z0], [p1[0], p1[1], z1], [p0[0], p0[1], z1], n);
      }
      if (!next || next.z0 > z1 + 1e-9) { cap(L[k].polys, z1, +1); if (next) cap(next.polys, next.z0, -1); continue; }
      cap(diffPolys(L[k].polys, next.polys), z1, +1);
      cap(diffPolys(next.polys, L[k].polys), z1, -1);
    }
    let p = Float64Array.from(Pt);
    if (!Core.checkClosed(p).closed && Core.fixTJunctions) { const f = Core.fixTJunctions(p, new Array(p.length / 9).fill(0), 1e-4); if (f && f.p) p = Float64Array.from(f.p); }
    // clipped layers meet the piece outline at clipper's 1 \u00b5m grid points, a fraction of a micron off the edges they
    // sit on: close those T-junctions with a 2 \u00b5m tolerance (one more edge per triangle each round)
    for (let it = 0; CLIP && it < 6 && Core.fixTJunctions && !Core.checkClosed(p).closed; it++) { const f = Core.fixTJunctions(p, new Array(p.length / 9).fill(0), 2e-3); if (!f || !f.p || f.p.length === p.length) break; p = Float64Array.from(f.p); }
    return p;
  }
  // rounded rectangle [x0,x1]\u00d7[y0,y1] with corner radius r (0 = sharp)
  function roundRect(x0, y0, x1, y1, r, seg) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01));
    if (r < 0.05) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const n = seg || Math.max(4, Math.min(16, Math.ceil(r * 2))), L = [];
    const arc = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const t = a0 + Math.PI / 2 * i / n; L.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } };
    arc(x1 - r, y0 + r, -Math.PI / 2); arc(x1 - r, y1 - r, 0); arc(x0 + r, y1 - r, Math.PI / 2); arc(x0 + r, y0 + r, Math.PI);
    return L;
  }
  const BOX_MIN_WALL = 1.2;   // plastic kept around a magnet pocket
  // One box (and its lid). Sizes are outside width/depth and the body height.
  //   o = { w, d, h, wall, floor, radius, lid: 'none'|'lip'|'magnet', lidT, lipH, lipW,
  //         clearance, magD, magH, magClear }
  function boxLayout(o) {
    const W = o.w, D = o.d, H = o.h, t = o.wall, R = Math.max(0, o.radius || 0);
    const c = o.clearance, out = { W, D, H, wall: t, floor: o.floor, lid: o.lid };
    out.O = roundRect(0, 0, W, D, R);
    out.I = roundRect(t, t, W - t, D - t, Math.max(0, R - t));
    out.ri = Math.max(0, R - t);
    if (o.lid === 'magnet') {
      const pd = o.magD + 2 * o.magClear, pr = pd / 2, ph = o.magH + o.magClear, m = BOX_MIN_WALL;
      // pocket centre on the corner diagonal: at least m of plastic to the outside, including the rounded corner
      const k = Math.max(pr + m, R > 0 ? R - (R - pr - m) / Math.SQRT2 : 0, t / 2 + pr + 0.01);
      const e = k + pr + m;   // post reaches this far in from the outside
      out.pocket = { d: pd, r: pr, depth: ph, k, post: e };
      out.centres = [[k, k], [W - k, k], [W - k, D - k], [k, D - k]];
      const h2 = t / 2, sq = (x0, y0, x1, y1) => ({ outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], holes: [] });
      const Oin = offset([{ outer: out.O, holes: [] }], -h2, true);
      out.posts = interPolys([sq(h2, h2, e, e), sq(W - e, h2, W - h2, e), sq(W - e, D - e, W - h2, D - h2), sq(h2, D - e, e, D - h2)], Oin);
      out.lidT = Math.max(o.lidT, ph + 1);
    } else out.lidT = o.lidT;
    if (o.lid === 'lip') {
      out.lipW = o.lipW; out.lipH = Math.min(o.lipH, Math.max(1, H - o.floor - 1));
      out.lipOuter = roundRect(t + c, t + c, W - t - c, D - t - c, Math.max(0, out.ri - c));
      out.lipInner = roundRect(t + c + o.lipW, t + c + o.lipW, W - t - c - o.lipW, D - t - c - o.lipW, Math.max(0, out.ri - c - o.lipW));
    }
    return out;
  }
  function boxSolids(o) {
    const B = boxLayout(o), poly = L => ({ outer: L, holes: [] });
    const O = [poly(B.O)], ring = [{ outer: B.O, holes: [B.I.slice().reverse()] }];
    const walls = B.posts ? unionPolys(ring.concat(B.posts)) : ring;
    const layers = [{ z0: 0, z1: B.floor, polys: O }];
    const holes = B.centres ? B.centres.map(q => poly(circle(q[0], q[1], B.pocket.r, 40))) : null;
    if (holes) {
      layers.push({ z0: B.floor, z1: B.H - B.pocket.depth, polys: walls });
      layers.push({ z0: B.H - B.pocket.depth, z1: B.H, polys: diffPolys(walls, holes) });
    } else layers.push({ z0: B.floor, z1: B.H, polys: walls });
    const body = steppedExtrude(layers);
    let lid = null;
    if (B.lid === 'lip') lid = steppedExtrude([{ z0: 0, z1: B.lidT, polys: O }, { z0: B.lidT, z1: B.lidT + B.lipH, polys: [{ outer: B.lipOuter, holes: [B.lipInner.slice().reverse()] }] }]);
    else if (B.lid === 'magnet') lid = steppedExtrude([{ z0: 0, z1: B.lidT - B.pocket.depth, polys: O }, { z0: B.lidT - B.pocket.depth, z1: B.lidT, polys: diffPolys(O, holes) }]);
    return { layout: B, body, lid };
  }
  // A set of boxes, each nested inside the one before with `gap` all round and
  // room for its own lid. o adds { count, gap }. Returns null-free list of boxes.
  function storageBoxes(o) {
    const n = Math.max(1, Math.min(5, Math.round(o.count || 1))), gap = o.gap == null ? 1 : o.gap, res = [];
    let w = o.w, d = o.d, h = o.h, r = o.radius;
    for (let i = 0; i < n; i++) {
      if (w < 2 * o.wall + 10 || d < 2 * o.wall + 10 || h < o.floor + 4) break;
      const opts = Object.assign({}, o, { w, d, h, radius: r }), s = boxSolids(opts);
      s.opts = opts; res.push(s);
      const B = s.layout, inset = B.posts ? B.pocket.post : B.wall;
      // the next box sits inside this one: inside the walls (and the magnet posts) less the gap,
      // and below this box's lid (a lip reaches down inside) with its own lid on top
      w = B.W - 2 * inset - 2 * gap; d = B.D - 2 * inset - 2 * gap;
      const ownLid = o.lid === 'none' ? 0 : (o.lid === 'magnet' ? Math.max(o.lidT, o.magH + o.magClear + 1) : o.lidT);
      h = B.H - B.floor - (o.lid === 'lip' ? B.lipH : 0) - gap - ownLid;
      r = Math.max(0, B.ri - gap);
    }
    return res;
  }

  // Lithophane box: four flat picture walls that stand in a groove in a base and
  // under a matching open top frame. Lx \u00d7 Ly is the outside of the walls, H their height.
  //   o = { Lx, Ly, H, minT, maxT, border, cell, clear, invert, groove, plate, rim, hole }
  //   gray(side, nx, ny) -> brightness grid for that wall (0 = dark)
  const LBOX_SIDES = ['front', 'right', 'back', 'left'];
  function lithoBoxLayout(o) {
    const t = o.maxT, c = o.clear, Lx = o.Lx, Ly = o.Ly;
    const groove = o.groove || 4, plate = o.plate || 2.4, rim = o.rim || 3;
    // the frame round each wall is full thickness and deep enough to hide in the groove and to
    // give the side walls a flat face to butt against
    const border = Math.max(o.border || 0, groove + 1.5, t + 1);
    const len = { front: Lx, back: Lx, right: Ly - 2 * t, left: Ly - 2 * t };
    const sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const O = roundRect(-rim, -rim, Lx + rim, Ly + rim, rim);
    const gOut = sq(-c, -c, Lx + c, Ly + c), gIn = sq(t + c, t + c, Lx - t - c, Ly - t - c);
    const opening = sq(t + 3, t + 3, Lx - t - 3, Ly - t - 3);
    return { t, c, Lx, Ly, H: o.H, groove, plate, rim, border, len, O, gOut, gIn, opening, hole: o.hole == null ? 8 : o.hole, perimeter: 2 * len.front + 2 * len.right };
  }
  function lithoBoxFrames(B) {
    const poly = L => ({ outer: L, holes: [] }), O = [poly(B.O)];
    const grooveRing = [{ outer: B.gOut, holes: [B.gIn.slice().reverse()] }];
    const hole = B.hole > 0 ? [poly(circle(B.Lx / 2, B.Ly / 2, B.hole / 2, 32))] : [];
    // base: solid plate (cable hole in the middle), groove on top
    const base = steppedExtrude([
      { z0: 0, z1: B.plate, polys: diffPolys(O, hole) },
      { z0: B.plate, z1: B.plate + B.groove, polys: diffPolys(O, grooveRing.concat(hole)) }]);
    // top: open frame printed groove up, then flipped onto the walls
    const open = [poly(B.opening)];
    const top = steppedExtrude([
      { z0: 0, z1: B.plate, polys: diffPolys(O, open) },
      { z0: B.plate, z1: B.plate + B.groove, polys: diffPolys(O, grooveRing.concat(open)) }]);
    return { base, top };
  }
  // where a wall printed standing (x along its length, flat back at y = 0, relief towards +y)
  // goes in the box: flat face outward, picture running anticlockwise round the outside
  function lithoBoxPlace(p, side, B, z) {
    const q = new Float64Array(p.length), t = B.t, Lx = B.Lx, Ly = B.Ly;
    for (let i = 0; i < p.length; i += 3) {
      const u = p[i], v = p[i + 1];
      let x, y;
      if (side === 'front') { x = u; y = v; }
      else if (side === 'right') { x = Lx - v; y = t + u; }
      else if (side === 'back') { x = Lx - u; y = Ly - v; }
      else { x = v; y = Ly - t - u; }
      q[i] = x; q[i + 1] = y; q[i + 2] = p[i + 2] + z;
    }
    return q;
  }
  function lithoBox(o, gray) {
    const B = lithoBoxLayout(o);
    if (B.len.right < 20 || B.Lx < 20 || B.H < 2 * B.border + 10) return null;
    const cell0 = o.cell || 0.4, panels = [];
    for (const side of LBOX_SIDES) {
      const L = B.len[side], nx = Math.max(8, Math.round(L / cell0) + 1), ny = Math.max(8, Math.round(B.H / cell0) + 1), cell = L / (nx - 1);
      const g = gray(side, nx, ny, B);
      const p = lithophane(g, nx, ny, { shape: 'flat', cell, minT: o.minT, maxT: o.maxT, border: B.border, invert: !!o.invert, stand: false, frame: 'rect' });
      const kz = B.H / ((ny - 1) * cell);
      for (let i = 2; i < p.length; i += 3) p[i] *= kz;   // exact wall height whatever the grid
      panels.push({ side, p, nx, ny, cell, len: L, placed: lithoBoxPlace(p, side, B, B.plate) });
    }
    const F = lithoBoxFrames(B);
    // the top, flipped (180\u00b0 about x) so its groove takes the top edge of the walls
    const tp = F.top, topPlaced = new Float64Array(tp.length), zt = 2 * B.plate + B.H;
    for (let i = 0; i < tp.length; i += 3) { topPlaced[i] = tp[i]; topPlaced[i + 1] = B.Ly - tp[i + 1]; topPlaced[i + 2] = zt - tp[i + 2]; }
    return { layout: B, panels, base: F.base, top: F.top, topPlaced };
  }

  // Jigsaw puzzle: a cols \u00d7 rows plate whose cut lines carry classic round tabs. Neighbouring pieces
  // share the exact same cut line, then every piece is shrunk by half the clearance, so the gap
  // between any two pieces is the clearance everywhere, tabs included.
  //   o = { w, h, cols, rows, thick, clear, seed }
  const PUZZLE_MIN_NECK = 2;   // mm of plastic across a tab's neck after the clearance
  // knob radius, knob centre height, half neck; the knobs sit within \u00b12% of the middle of their cut, so two knobs
  // into one piece from neighbouring sides keep 0.17\u00b7m of plastic between them, more than the neck's 0.15\u00b7m
  function puzzleTabs(m) { return { kr: 0.14 * m, hc: 0.16 * m, nw: 0.075 * m, jit: 0.02 * m }; }
  function puzzleMinCell(clear) { return (PUZZLE_MIN_NECK + clear) / 0.15 + 0.01; }
  function puzzleEdge(p0, p1, sign, tabs, shift) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy), u = [dx / len, dy / len], n = [-u[1] * sign, u[0] * sign];
    const { kr, hc, nw } = tabs, s0 = len / 2 + shift, at = (s, t) => [p0[0] + u[0] * s + n[0] * t, p0[1] + u[1] * s + n[1] * t];
    const L = [p0, at(s0 - nw, 0)];
    const yN = Math.sqrt(kr * kr - nw * nw), tL = Math.atan2(-yN, -nw), tR = Math.atan2(-yN, nw) - 2 * Math.PI, N = 28;
    for (let k = 0; k <= N; k++) { const th = tL + (tR - tL) * k / N; L.push(at(s0 + kr * Math.cos(th), hc + kr * Math.sin(th))); }
    L.push(at(s0 + nw, 0));
    return L;   // p1 is the next edge's start
  }
  function puzzleLayout(o) {
    const cols = Math.max(1, Math.round(o.cols)), rows = Math.max(1, Math.round(o.rows)), cw = o.w / cols, ch = o.h / rows, m = Math.min(cw, ch);
    const tabs = puzzleTabs(m);
    let s = (o.seed >>> 0) || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const P = (i, j) => [i * cw, j * ch];
    // H[j][i]: the cut along y = j\u00b7ch between columns i and i+1 (left to right); V[i][j]: x = i\u00b7cw (bottom to top)
    const H = [], V = [];
    for (let j = 0; j <= rows; j++) { H[j] = []; for (let i = 0; i < cols; i++) H[j][i] = j === 0 || j === rows ? [P(i, j)] : puzzleEdge(P(i, j), P(i + 1, j), rnd() < 0.5 ? 1 : -1, tabs, (rnd() - 0.5) * 2 * tabs.jit); }
    for (let i = 0; i <= cols; i++) { V[i] = []; for (let j = 0; j < rows; j++) V[i][j] = i === 0 || i === cols ? [P(i, j)] : puzzleEdge(P(i, j), P(i, j + 1), rnd() < 0.5 ? 1 : -1, tabs, (rnd() - 0.5) * 2 * tabs.jit); }
    const rev = (L, end) => [end].concat(L.slice(1).reverse());   // the same cut walked the other way, from its end
    const pieces = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const ring = [].concat(H[j][i], V[i + 1][j], rev(H[j + 1][i], P(i + 1, j + 1)), rev(V[i][j], P(i, j + 1)));
      pieces.push({ i, j, cut: ring });
    }
    return { cols, rows, cw, ch, m, tabs, pieces };
  }
  function puzzle(o) {
    const clear = Math.max(0, o.clear), L = puzzleLayout(o);
    if (L.m < puzzleMinCell(clear)) return { error: 'small', minCell: puzzleMinCell(clear), layout: L };
    for (const pc of L.pieces) {
      const ring = area2(pc.cut) > 0 ? pc.cut : pc.cut.slice().reverse();
      const sh = clear > 0 ? offset([{ outer: ring, holes: [] }], -clear / 2, true) : [{ outer: ring, holes: [] }];
      if (sh.length !== 1) return { error: 'split', layout: L };
      pc.poly = sh; pc.p = steppedExtrude([{ z0: 0, z1: o.thick, polys: sh }]);
    }
    return { layout: L, pieces: L.pieces };
  }

  const api = { colorPrep, withClip, clipActive, clipLayers, PUZZLE_MIN_NECK, puzzleTabs, puzzleMinCell, puzzleEdge, puzzleLayout, puzzle, LBOX_SIDES, lithoBoxLayout, lithoBoxFrames, lithoBoxPlace, lithoBox, steppedExtrude, roundRect, boxLayout, boxSolids, storageBoxes, BOX_MIN_WALL, maskedHeightSolid, frameShape, heightSolid, lithophane, lithoGrid, sphereSpan, ROUND, relief, reliefWidthFor, buck, imageShape, shapeModel, traceBinary, extrude, offset, unionPolys, diffPolys, polysBBox, polysArea, stack, waffle, segmentParts, fingerBox, dxfSheet, rotateZ, interPolys, pointIn, circle, pack, nestParts, svgSheet, lowPoly, wireframe, zipBytes, threeMF, bambuPlateOrigin, BAMBU_PRESETS, box, concat, VIEWS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.StudioTools = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
