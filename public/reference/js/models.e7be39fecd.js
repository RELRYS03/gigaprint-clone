/* Expressarte starter models and real-world scale references.
   robot(): a procedurally built giant robot (signed-distance shapes meshed with marching
   tetrahedra), one closed watertight shell with distinct head, torso, arms and legs.
   rabbit(): a smooth, sitting rabbit built the same way (the Mesh FX starting model).
   SCALE_REFS / pickScaleRef(): everyday objects with their real height, for the 3D view. */
(function (G) {
  'use strict';

  // ---------------------------------------------------------------- signed-distance helpers
  const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
  function rbox(px, py, pz, c, h, r) { // rounded box: centre c, half-size h, corner radius r
    const qx = Math.abs(px - c[0]) - h[0] + r, qy = Math.abs(py - c[1]) - h[1] + r, qz = Math.abs(pz - c[2]) - h[2] + r;
    return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  }
  function capsule(px, py, pz, a, b, r) {
    const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], ax = px - a[0], ay = py - a[1], az = pz - a[2];
    const t = Math.max(0, Math.min(1, (ax * bx + ay * by + az * bz) / (bx * bx + by * by + bz * bz)));
    return len3(ax - bx * t, ay - by * t, az - bz * t) - r;
  }
  function cylZ(px, py, pz, c, r, z0, z1, rr) { // vertical cylinder with rounded rims
    const dx = Math.hypot(px - c[0], py - c[1]) - r + rr, dz = Math.max(z0 - pz, pz - z1) + rr;
    return Math.min(Math.max(dx, dz), 0) + len3(Math.max(dx, 0), Math.max(dz, 0), 0) - rr;
  }
  const sphere = (px, py, pz, c, r) => len3(px - c[0], py - c[1], pz - c[2]) - r;
  function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

  // The robot stands on z = 0, faces -y, 180 units tall (scale it to taste; 1 unit = 10 mm at 1.8 m).
  function robotSDF(x, y, z) {
    const ax = Math.abs(x); // mirror-symmetric in x
    let d = 1e9;
    const U = (v, k) => { d = smin(d, v, k == null ? 1.6 : k); };
    // feet, shins, knees, thighs
    U(rbox(ax, y, z, [15, -3, 5], [9.5, 14, 5], 2.5));
    U(rbox(ax, y, z, [15, 0, 26], [7.5, 8, 17], 2.5));
    U(sphere(ax, y, z, [15, -1.5, 45], 8.2));
    U(rbox(ax, y, z, [15, 0, 63], [8.5, 9, 15], 3));
    U(rbox(ax, y, z, [15, -8.6, 26], [5, 1.4, 10], 1)); // shin plates
    // pelvis, waist, torso, chest plate, back pack
    U(rbox(x, y, z, [0, 0, 84], [25, 12, 8], 4));
    U(cylZ(x, y, z, [0, 0], 13, 88, 102, 2));
    U(rbox(x, y, z, [0, 0, 120], [28, 15, 20], 6), 2.5);
    U(rbox(x, y, z, [0, -15, 124], [16, 2.5, 9], 2));
    U(rbox(x, y, z, [0, 15, 122], [17, 3.5, 13], 3));
    // shoulders, arms, hands
    U(sphere(ax, y, z, [37, 0, 133], 10.5), 3);
    U(capsule(ax, y, z, [40, 0, 130], [45, 0, 107], 7.5));
    U(sphere(ax, y, z, [45.5, 0, 106], 8.2));
    U(rbox(ax, y, z, [48, -1, 92], [8.5, 9, 13], 3.5));
    U(rbox(ax, y, z, [49.5, -2, 73], [6, 7.5, 6], 2.5));
    // neck, head, ear pods, antenna
    U(cylZ(x, y, z, [0, 0], 6.5, 138, 151, 1.5));
    U(rbox(x, y, z, [0, -1, 161], [14.5, 13, 11], 4.5), 2);
    U(cylZ(ax, z, y, [15.5, 161], 5.5, -4, 4, 1.5), 1); // ear pods (axis along x via swapped args)
    U(cylZ(x, y, z, [0, 0], 2.2, 170, 178, 0.8), 1);
    U(sphere(x, y, z, [0, 0, 178], 3.4), 1);
    // carve the visor slot and a chest vent
    d = Math.max(d, -rbox(x, y, z, [0, -14, 162], [10, 3, 2.6], 1.2));
    d = Math.max(d, -rbox(x, y, z, [0, -17.8, 109], [10, 1.4, 1.2], 0.6));
    return d;
  }

  // ---------------------------------------------------------------- marching tetrahedra (watertight by construction)
  const CUBE = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const TETS = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]]; // Kuhn split along 0-6
  function meshSDF(f, min, max, cell) {
    const nx = Math.ceil((max[0] - min[0]) / cell) + 2, ny = Math.ceil((max[1] - min[1]) / cell) + 2, nz = Math.ceil((max[2] - min[2]) / cell) + 2;
    const ox = min[0] - cell, oy = min[1] - cell, oz = min[2] - cell;
    const N = nx * ny * nz, D = new Float32Array(N), idx = (i, j, k) => (k * ny + j) * nx + i;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let v = (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) ? 1 : f(ox + i * cell, oy + j * cell, oz + k * cell);
      if (Math.abs(v) < 1e-7) v = 1e-7; D[idx(i, j, k)] = v;
    }
    const emap = new Map(), V = [], out = [];
    const pos = g => { const i = g % nx, j = ((g - i) / nx) % ny, k = Math.floor(g / (nx * ny)); return [ox + i * cell, oy + j * cell, oz + k * cell]; };
    function ev(a, b) { // vertex on edge a-b (a inside, b outside)
      const key = a < b ? a * N + b : b * N + a; let v = emap.get(key);
      if (v === undefined) {
        const t = Math.min(0.98, Math.max(0.02, D[a] / (D[a] - D[b]))), A = pos(a), B = pos(b);
        v = V.length / 3; V.push(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); emap.set(key, v);
      }
      return v;
    }
    function tri(a, b, c, inside, outside) { // orient so the normal points from inside to outside
      const P = i => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]], A = P(a), B = P(b), C = P(c);
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const I = pos(inside), O = pos(outside);
      if (n[0] * (O[0] - I[0]) + n[1] * (O[1] - I[1]) + n[2] * (O[2] - I[2]) < 0) out.push(a, c, b); else out.push(a, b, c);
    }
    const g = new Int32Array(8);
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      let any = 0, all = 1;
      for (let c = 0; c < 8; c++) { g[c] = idx(i + CUBE[c][0], j + CUBE[c][1], k + CUBE[c][2]); if (D[g[c]] < 0) any = 1; else all = 0; }
      if (!any || all) continue;
      for (const T of TETS) {
        const ins = [], outs = [];
        for (const t of T) (D[g[t]] < 0 ? ins : outs).push(g[t]);
        if (ins.length === 1) tri(ev(ins[0], outs[0]), ev(ins[0], outs[1]), ev(ins[0], outs[2]), ins[0], outs[0]);
        else if (ins.length === 3) tri(ev(ins[0], outs[0]), ev(ins[1], outs[0]), ev(ins[2], outs[0]), ins[0], outs[0]);
        else if (ins.length === 2) {
          const a = ev(ins[0], outs[0]), b = ev(ins[0], outs[1]), c = ev(ins[1], outs[1]), e = ev(ins[1], outs[0]);
          tri(a, b, c, ins[0], outs[0]); tri(a, c, e, ins[0], outs[0]);
        }
      }
    }
    const p = new Float64Array(out.length * 3);
    for (let t = 0; t < out.length; t++) { p[t * 3] = V[out[t] * 3]; p[t * 3 + 1] = V[out[t] * 3 + 1]; p[t * 3 + 2] = V[out[t] * 3 + 2]; }
    return p;
  }
  /** The default giant robot: a closed triangle soup, z up, 180 units tall, facing -y.
   *  opt.cell sets the meshing grid (smaller = finer, more triangles). */
  function robot(opt) {
    const cell = (opt && opt.cell) || 1.6;
    return meshSDF(robotSDF, [-58, -20, 0], [58, 20, 182], cell);
  }

  // ---------------------------------------------------------------- the sitting rabbit (Mesh FX starting model)
  // Smooth, curvy and organic, so the low-poly and wireframe effects read well. Ellipsoids blended with smin,
  // flat base at z = 0, faces -y, about 123 units tall; drawn from scratch here, so it has no licence strings.
  function ell(px, py, pz, c, r) { // ellipsoid distance bound (exact on the surface)
    const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
    const k0 = len3(x, y, z), k1 = len3(x / r[0], y / r[1], z / r[2]);
    return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : k0 * (k0 - 1) / k1;
  }
  const EAR_TILT = 0.32, EAR_S = Math.sin(EAR_TILT), EAR_C = Math.cos(EAR_TILT);
  function rabbitSDF(x, y, z) {
    const ax = Math.abs(x);
    let d = ell(x, y, z, [0, 10, 30], [27, 32, 29]);                 // body
    d = smin(d, ell(ax, y, z, [13, 14, 20], [15, 22, 19]), 10);      // haunches
    d = smin(d, ell(x, y, z, [0, -10, 44], [19, 18, 24]), 12);       // chest
    d = smin(d, ell(x, y, z, [0, -18, 74], [17, 18, 15.5]), 10);     // head
    d = smin(d, ell(ax, y, z, [7, -31, 70], [7.5, 7, 7]), 6);        // cheeks
    d = smin(d, ell(x, y, z, [0, -34, 74], [3.2, 3, 2.6]), 3);       // nose
    const dy = y + 12, dz = z - 86, ry = -12 + dy * EAR_C - dz * EAR_S, rz = 86 + dy * EAR_S + dz * EAR_C; // ears lean back
    const splay = Math.max(0, rz - 86) * 0.12;                        // ...and out
    d = smin(d, ell(ax - splay, ry, rz, [8, -10, 104], [6.8, 4.3, 22]), 4);
    d = smin(d, ell(ax, y, z, [9, -27, 6], [6.5, 11, 6]), 5);        // front paws
    d = smin(d, ell(ax, y, z, [19, -2, 5], [8, 21, 5.5]), 6);        // hind feet
    d = smin(d, ell(x, y, z, [0, 42, 22], [8, 7, 8]), 5);            // tail
    d = -smin(-d, ell(ax, y, z, [12.6, -28.6, 79.5], [4.2, 3.2, 4.2]), 2.5); // eyes: soft, shallow dimples
    return Math.max(d, -z);                                          // flat base, prints without supports under the body
  }
  /** The Mesh FX starting model: a closed, one-shell sitting rabbit (about 59 x 87 x 123 units, ~59k triangles at cell 1.8). */
  function rabbit(opt) {
    const cell = (opt && opt.cell) || 1.8, p = meshSDF(rabbitSDF, [-34, -40, 0], [34, 52, 128], cell);
    // Even out the marching-tetrahedra slivers and pull every corner onto the true surface: a few rounds of
    // "move halfway to the neighbors' average, then one Newton step back onto the surface". Corners on the flat
    // base stay put, and any corner whose move would flip a triangle goes back to where the grid put it, so the
    // shell stays closed and never folds. Done once per shared corner (same input, same output).
    const e = 0.05, F = rabbitSDF;
    const ids = new Map(), V = [], idx = new Int32Array(p.length / 3);
    for (let i = 0; i < p.length; i += 3) {
      const k = p[i] + ',' + p[i + 1] + ',' + p[i + 2]; let v = ids.get(k);
      if (v === undefined) { v = V.length / 3; ids.set(k, v); V.push(p[i], p[i + 1], p[i + 2]); }
      idx[i / 3] = v;
    }
    const nv = V.length / 3, nb = Array.from({ length: nv }, () => new Set()), baseZ = cell * 0.1;
    for (let o = 2; o < V.length; o += 3) if (V[o] < baseZ) V[o] = 0; // the base sits a hair above the grid plane: snap it to z = 0
    for (let t = 0; t < idx.length; t += 3) for (let j = 0; j < 3; j++) { nb[idx[t + j]].add(idx[t + (j + 1) % 3]); nb[idx[t + j]].add(idx[t + (j + 2) % 3]); }
    const NB = nb.map(x => Int32Array.from(x)), Q = Float64Array.from(V), R = new Float64Array(Q.length);
    for (let round = 0; round < 3; round++) {
      for (let v = 0; v < nv; v++) {
        const o = v * 3; if (V[o + 2] === 0) { R[o] = Q[o]; R[o + 1] = Q[o + 1]; R[o + 2] = Q[o + 2]; continue; }
        let sx = 0, sy = 0, sz = 0; for (const w of NB[v]) { sx += Q[w * 3]; sy += Q[w * 3 + 1]; sz += Q[w * 3 + 2]; }
        const n = NB[v].length; let x = (Q[o] + sx / n) / 2, y = (Q[o + 1] + sy / n) / 2, z = (Q[o + 2] + sz / n) / 2;
        const f = F(x, y, z), gx = (F(x + e, y, z) - F(x - e, y, z)) / (2 * e), gy = (F(x, y + e, z) - F(x, y - e, z)) / (2 * e), gz = (F(x, y, z + e) - F(x, y, z - e)) / (2 * e), g2 = gx * gx + gy * gy + gz * gz;
        if (g2 > 1e-6) { x -= f * gx / g2; y -= f * gy / g2; z -= f * gz / g2; }
        R[o] = x; R[o + 1] = y; R[o + 2] = Math.max(0.02, z);
      }
      Q.set(R);
    }
    for (let v = 0; v < nv; v++) { const o = v * 3, d = Math.hypot(Q[o] - V[o], Q[o + 1] - V[o + 1], Q[o + 2] - V[o + 2]); if (d > cell) { Q[o] = V[o]; Q[o + 1] = V[o + 1]; Q[o + 2] = V[o + 2]; } }
    const nrm = (A, t) => { const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3, ux = A[b] - A[a], uy = A[b + 1] - A[a + 1], uz = A[b + 2] - A[a + 2], wx = A[c] - A[a], wy = A[c + 1] - A[a + 1], wz = A[c + 2] - A[a + 2]; return [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx]; };
    for (let pass = 0, bad = 1; bad && pass < 8; pass++) {
      bad = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const n1 = nrm(Q, t), n0 = nrm(V, t);
        if (n1[0] * n0[0] + n1[1] * n0[1] + n1[2] * n0[2] <= 0) { bad++; for (let j = 0; j < 3; j++) { const a = idx[t + j] * 3; Q[a] = V[a]; Q[a + 1] = V[a + 1]; Q[a + 2] = V[a + 2]; } }
      }
    }
    for (let t = 0; t < idx.length; t++) { const a = idx[t] * 3; p[t * 3] = Q[a]; p[t * 3 + 1] = Q[a + 1]; p[t * 3 + 2] = Q[a + 2]; }
    return p;
  }

  // Where the default custom cut planes go on the robot (robot units): neck, shoulders, waist, hips, knees.
  // Planes: { c, tilt, turn, local } as the custom-cut panel uses them (tilt 0 = level, 90 = upright; turn 0 = facing x).
  const ROBOT_CUTS = [
    { c: [0, 0, 145], tilt: 0, turn: 0, local: false },
    { c: [-32.5, 0, 133], tilt: 90, turn: 0, local: true }, { c: [32.5, 0, 133], tilt: 90, turn: 0, local: true },
    { c: [0, 0, 95], tilt: 0, turn: 0, local: true },
    { c: [-15, 0, 72], tilt: 0, turn: 0, local: true }, { c: [15, 0, 72], tilt: 0, turn: 0, local: true },
    { c: [-15, 0, 45], tilt: 0, turn: 0, local: true }, { c: [15, 0, 45], tilt: 0, turn: 0, local: true }
  ];

  // ---------------------------------------------------------------- the default Giant print model (a static asset)
  // Packed indexed mesh, gzip'd by scripts/pack-default-model.js and fetched lazily by the page:
  //   'GPM1' | uint32 vertexCount | uint32 triangleCount | float32 extent[3] | uint16 xyz[nv*3] (0..65535 over extent) | uint32 idx[nt*3]
  // Coordinates come back in mm with the bounding-box minimum at the origin.
  function packMesh(p, frame) {
    const bb = frame || bboxOf(p), ext = [0, 1, 2].map(a => Math.max(1e-9, bb.max[a] - bb.min[a]));
    const map = new Map(), verts = [], idx = new Uint32Array(p.length / 3);
    for (let i = 0; i < p.length; i += 3) {
      const q = [0, 1, 2].map(a => Math.max(0, Math.min(65535, Math.round((p[i + a] - bb.min[a]) / ext[a] * 65535))));
      const k = q[0] + ',' + q[1] + ',' + q[2];
      let id = map.get(k); if (id === undefined) { id = verts.length / 3; map.set(k, id); verts.push(q[0], q[1], q[2]); }
      idx[i / 3] = id;
    }
    const nv = verts.length / 3, nt = idx.length / 3, out = new ArrayBuffer(24 + nv * 6 + (nv * 6) % 4 + nt * 12), dv = new DataView(out);
    [71, 80, 77, 49].forEach((c, i) => dv.setUint8(i, c)); dv.setUint32(4, nv, true); dv.setUint32(8, nt, true);
    ext.forEach((e, a) => dv.setFloat32(12 + a * 4, e, true));
    new Uint16Array(out, 24, nv * 3).set(verts);
    new Uint32Array(out, 24 + nv * 6 + (nv * 6) % 4, nt * 3).set(idx);
    return new Uint8Array(out);
  }
  function unpackMesh(buf) {
    const dv = new DataView(buf);
    if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'GPM1') throw new Error('not a packed mesh');
    const nv = dv.getUint32(4, true), nt = dv.getUint32(8, true), ext = [0, 1, 2].map(a => dv.getFloat32(12 + a * 4, true));
    const v = new Uint16Array(buf, 24, nv * 3), idx = new Uint32Array(buf, 24 + nv * 6 + (nv * 6) % 4, nt * 3);
    const p = new Float64Array(nt * 9);
    for (let t = 0; t < nt * 3; t++) { const j = idx[t] * 3; for (let a = 0; a < 3; a++) p[t * 3 + a] = v[j + a] / 65535 * ext[a]; }
    return p;
  }
  // the 3D scale figure: 'GPF1' | uint32 nv | uint32 nt | float32 min[3] | float32 ext[3] | uint16 xyz[nv*3] | uint16 uv[nv*2] | uint32 idx[nt*3]
  function packFigure(f) {
    const nv = f.pos.length / 3, nt = f.idx.length / 3, min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    for (let i = 0; i < f.pos.length; i++) { const a = i % 3; min[a] = Math.min(min[a], f.pos[i]); max[a] = Math.max(max[a], f.pos[i]); }
    const ext = min.map((m, a) => Math.max(1e-9, max[a] - m)), o1 = 36, o2 = o1 + nv * 6, o3 = o2 + nv * 4 + ((o2 + nv * 4) % 4 ? 4 - (o2 + nv * 4) % 4 : 0);
    const out = new ArrayBuffer(o3 + nt * 12), dv = new DataView(out);
    [71, 80, 70, 49].forEach((c, i) => dv.setUint8(i, c)); dv.setUint32(4, nv, true); dv.setUint32(8, nt, true);
    for (let a = 0; a < 3; a++) { dv.setFloat32(12 + a * 4, min[a], true); dv.setFloat32(24 + a * 4, ext[a], true); }
    const q = new Uint16Array(out, o1, nv * 3), t = new Uint16Array(out, o2, nv * 2);
    for (let i = 0; i < nv * 3; i++) q[i] = Math.round((f.pos[i] - min[i % 3]) / ext[i % 3] * 65535);
    for (let i = 0; i < nv * 2; i++) t[i] = Math.round(Math.max(0, Math.min(1, f.uv[i])) * 65535);
    new Uint32Array(out, o3, nt * 3).set(f.idx);
    return new Uint8Array(out);
  }
  function unpackFigure(buf) {
    const dv = new DataView(buf);
    if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'GPF1') throw new Error('not a packed figure');
    const nv = dv.getUint32(4, true), nt = dv.getUint32(8, true), min = [0, 1, 2].map(a => dv.getFloat32(12 + a * 4, true)), ext = [0, 1, 2].map(a => dv.getFloat32(24 + a * 4, true));
    const o1 = 36, o2 = o1 + nv * 6, o3 = o2 + nv * 4 + ((o2 + nv * 4) % 4 ? 4 - (o2 + nv * 4) % 4 : 0);
    const q = new Uint16Array(buf, o1, nv * 3), t = new Uint16Array(buf, o2, nv * 2), pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    for (let i = 0; i < nv * 3; i++) pos[i] = min[i % 3] + q[i] / 65535 * ext[i % 3];
    for (let i = 0; i < nv * 2; i++) uv[i] = t[i] / 65535;
    return { pos, uv, idx: new Uint32Array(buf.slice(o3, o3 + nt * 12)) };
  }
  function bboxOf(p) { const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < p.length; i++) { const a = i % 3; if (p[i] < min[a]) min[a] = p[i]; if (p[i] > max[a]) max[a] = p[i]; } return { min, max }; }

  // ---------------------------------------------------------------- real-world scale references
  // Friendly flat-shaded cutouts drawn in code (canvas 2D), shown at true size next to a ruler.
  // h = real height (mm), w = drawn width (mm), caption = small line under the height callout,
  // pair = a second figure that helps (the mockup: a 6 ft man with a 2 ft beagle).
  const SCALE_REFS = [
    { id: 'coin', name: 'Coin', h: 24.3, w: 24.3, caption: 'A COIN, STANDING ON ITS EDGE', across: true },
    { id: 'minifig', name: 'Toy minifigure', h: 40, w: 22, caption: 'A TOY MINIFIGURE', pair: 'coin' },
    { id: 'battery', name: 'AA battery', h: 50.5, w: 14.5, caption: 'AN AA BATTERY', pair: 'coin' },
    { id: 'mug', name: 'Coffee mug', h: 95, w: 118, caption: 'A COFFEE MUG', pair: 'battery' },
    { id: 'can', name: 'Soda can', h: 122, w: 66, caption: 'A SODA CAN', pair: 'coin' },
    { id: 'phone', name: 'Smartphone', h: 147, w: 71.5, caption: 'A SMARTPHONE', pair: 'coin' },
    { id: 'ball', name: 'Basketball', h: 240, w: 240, caption: 'A BASKETBALL', pair: 'can' },
    { id: 'cat', name: 'Cat (sitting)', h: 250, w: 290, caption: 'A SITTING CAT', pair: 'can' },
    { id: 'beagle', name: 'Beagle', h: 609.6, w: 700, caption: 'AVERAGE HEIGHT OF A BEAGLE', pair: 'cat', feet: true },
    { id: 'child', name: 'Child (6 years)', h: 1150, w: 380, caption: 'A SIX-YEAR-OLD CHILD', pair: 'beagle' },
    { id: 'human', name: 'Adult man', h: 1828.8, w: 560, caption: 'ADULT MAN', pair: 'beagle', feet: true },
    { id: 'horse', name: 'Horse', h: 2300, w: 2500, caption: 'A HORSE, HEAD UP', pair: 'human' },
    { id: 'elephant', name: 'Elephant', h: 3200, w: 4300, caption: 'AN AFRICAN ELEPHANT', pair: 'human' },
    { id: 'giraffe', name: 'Giraffe', h: 5000, w: 2900, caption: 'A GIRAFFE', pair: 'human' }
  ];
  const refById = id => SCALE_REFS.find(r => r.id === (id === 'dog' ? 'beagle' : id));
  /** The reference closest in size (log scale) to an object of height mm. */
  function pickScaleRef(mm) {
    if (mm >= 300 && mm <= 3050) return refById('human'); // roughly 1-10 ft: the man and beagle height chart
    let best = SCALE_REFS[0], bd = Infinity;
    for (const r of SCALE_REFS) { const d = Math.abs(Math.log(r.h / Math.max(mm, 0.1))); if (d < bd) { bd = d; best = r; } }
    return best;
  }
  // ---- length formatting
  function lenShort(mm, imperial) { // "5 ft 11 in", "4.8 in", "1.83 m", "61 cm", "50 mm"
    if (imperial) {
      const inch = mm / 25.4;
      if (inch >= 24) { let ft = Math.floor(inch / 12), i = Math.round(inch - ft * 12); if (i === 12) { ft++; i = 0; } return i ? `${ft} ft ${i} in` : `${ft} ft`; }
      return `${inch >= 10 ? Math.round(inch) : +inch.toFixed(1)} in`;
    }
    return mm >= 1000 ? `${+(mm / 1000).toFixed(2)} m` : mm >= 100 ? `${Math.round(mm / 10)} cm` : `${+mm.toFixed(mm < 10 ? 1 : 0)} mm`;
  }
  /** The bold callout: { big, unit, word, caption } -> "6 FEET TALL" / "AVERAGE HEIGHT OF A BEAGLE". */
  function callout(r, imperial) {
    if (r.feet) imperial = true; // the height chart's man and beagle are always '6 FEET' / '2 FEET' (metric goes in the small line)
    const mm = r.h, word = r.across ? 'ACROSS' : 'TALL';
    let big, unit;
    if (imperial) {
      const inch = mm / 25.4, ft = inch / 12;
      if (inch >= 24 && Math.abs(ft - Math.round(ft)) * 12 < 0.6) { big = String(Math.round(ft)); unit = Math.round(ft) === 1 ? 'FOOT' : 'FEET'; }
      else if (inch >= 36) { big = lenShort(mm, true).toUpperCase(); unit = ''; }
      else { big = String(inch >= 10 ? Math.round(inch) : +inch.toFixed(1)); unit = big === '1' ? 'INCH' : 'INCHES'; }
    } else if (mm >= 1000) { big = String(+(mm / 1000).toFixed(2)); unit = 'METERS'; }
    else if (mm >= 100) { big = String(Math.round(mm / 10)); unit = 'CM'; }
    else { big = String(+mm.toFixed(mm < 10 ? 1 : 0)); unit = 'MM'; }
    return { big, unit, word, caption: r.caption, alt: lenShort(mm, !imperial) };
  }
  function refLabel(r, imperial) { return `${r.name} \u00b7 ${lenShort(r.h, imperial)}${r.across ? ' across' : ''}`; }

  // ---- the ruler: a sensible range and tick interval for what stands next to it
  const IN = 25.4, FT = 304.8;
  const STEPS_IMP = [[IN / 8, 'in', 1 / 8, 0], [IN / 4, 'in', 1 / 4, 2], [IN / 2, 'in', 1 / 2, 4], [IN, 'in', 1, 8], [2 * IN, 'in', 2, 8], [3 * IN, 'in', 3, 6], [6 * IN, 'in', 6, 6], [FT, 'ft', 1, 12], [2 * FT, 'ft', 2, 4], [5 * FT, 'ft', 5, 5], [10 * FT, 'ft', 10, 10], [20 * FT, 'ft', 20, 4], [50 * FT, 'ft', 50, 5], [100 * FT, 'ft', 100, 10]];
  const STEPS_MET = [[2, 'mm', 2, 2], [5, 'mm', 5, 5], [10, 'cm', 1, 10], [20, 'cm', 2, 4], [50, 'cm', 5, 5], [100, 'cm', 10, 10], [200, 'cm', 20, 4], [500, 'm', 0.5, 5], [1000, 'm', 1, 10], [2000, 'm', 2, 4], [5000, 'm', 5, 5], [10000, 'm', 10, 10], [20000, 'm', 20, 4], [50000, 'm', 50, 5]];
  /** Ruler covering heightMM: { top (mm), unit, majors: [{ mm, label }], minors: [mm], half: [mm] } with 3-10 labelled marks. */
  function rulerSpec(heightMM, imperial) {
    const need = Math.max(heightMM, 1) * 1.08, steps = imperial ? STEPS_IMP : STEPS_MET;
    let st = steps[steps.length - 1];
    for (const s of steps) if (need / s[0] <= 8) { st = s; break; }
    const [step, unit, per, minorN] = st, n = Math.max(1, Math.ceil(need / step - 1e-9)), top = n * step;
    const majors = [], minors = [], half = [];
    const fmt = v => { const x = +(v).toFixed(3); if (x % 1 === 0 || !imperial) return String(x); const w = Math.floor(x), f = x - w, fr = { 0.125: '\u215b', 0.25: '\u00bc', 0.375: '\u215c', 0.5: '\u00bd', 0.625: '\u215d', 0.75: '\u00be', 0.875: '\u215e' }[+f.toFixed(3)]; return fr ? (w ? w + fr : fr) : String(x); };
    for (let i = 1; i <= n; i++) majors.push({ mm: i * step, label: fmt(i * per) });
    if (minorN > 1) for (let i = 0; i < n; i++) for (let j = 1; j < minorN; j++) (minorN % 2 === 0 && j === minorN / 2 ? half : minors).push((i + j / minorN) * step);
    return { top, unit, step, majors, minors, half };
  }

  // ---- drawing (canvas 2D, browser only). Each draw(ctx, r) works in millimetres with y down from the top
  // of the figure's box (r.w x r.h); figures face left (the model is on their left on screen).
  const P = (ctx, pts, fill, stroke, lw) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); } };
  const E = (ctx, x, y, rx, ry, fill, rot) => { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  const RR = (ctx, x, y, w, h, r, fill) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fillStyle = fill; ctx.fill(); };
  const curve = (ctx, pts, color, lw) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i += 2) ctx.quadraticCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(); };
  function plaid(ctx, clip, x0, y0, w, h, base, dark, light, s) { // a tartan fill clipped to a shape
    ctx.save(); clip(); ctx.clip();
    ctx.fillStyle = base; ctx.fillRect(x0, y0, w, h);
    ctx.globalAlpha = 0.55; ctx.fillStyle = dark;
    for (let x = x0; x < x0 + w; x += s) ctx.fillRect(x, y0, s * 0.42, h);
    for (let y = y0; y < y0 + h; y += s) ctx.fillRect(x0, y, w, s * 0.42);
    ctx.globalAlpha = 0.7; ctx.fillStyle = light;
    for (let x = x0 + s * 0.7; x < x0 + w; x += s) ctx.fillRect(x, y0, s * 0.06, h);
    for (let y = y0 + s * 0.7; y < y0 + h; y += s) ctx.fillRect(x0, y, w, s * 0.06);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function person(ctx, H, W, o) { // front view; o: head fraction, colours, kid
    const cx = W / 2, z = v => H - v * H; // v = fraction of height from the ground
    const head = o.head, hr = head * H / 2, hy = hr + H * 0.012;
    const sh = z(1 - head - 0.045), shW = H * (o.kid ? 0.2 : 0.235), hip = z(o.kid ? 0.47 : 0.5), crotch = z(o.kid ? 0.4 : 0.45), knee = z(0.26);
    const skin = o.skin || '#e9b48a', skinD = '#c98d63';
    // legs (jeans or shorts + socks), boots/sneakers
    const legW = H * 0.075, gap = H * 0.012;
    for (const sd of [-1, 1]) {
      const lx = cx + sd * (gap / 2 + legW / 2);
      const top = hip, bot = H - H * 0.055;
      if (o.shorts) { P(ctx, [[lx - legW / 2 - 4, top], [lx + legW / 2 + 4, top], [lx + legW / 2 + 2, knee - H * 0.02], [lx - legW / 2 - 2, knee - H * 0.02]], o.legs); RR(ctx, lx - legW * 0.35, knee - H * 0.025, legW * 0.7, bot - knee + H * 0.03, legW * 0.3, skin); RR(ctx, lx - legW * 0.38, bot - H * 0.05, legW * 0.76, H * 0.05, 6, '#f2f2f2'); }
      else {
        P(ctx, [[lx - legW / 2 - H * 0.004, top], [lx + legW / 2 + H * 0.004, top], [lx + legW * 0.46, bot], [lx - legW * 0.46, bot]], o.legs);
        P(ctx, [[lx - legW * 0.1, top + H * 0.03], [lx + legW * 0.2, top + H * 0.03], [lx + legW * 0.16, bot], [lx - legW * 0.08, bot]], o.legsHi); // fade
        ctx.strokeStyle = o.legsSeam; ctx.lineWidth = H * 0.0025; ctx.beginPath(); ctx.moveTo(lx + sd * legW * 0.42, top + 6); ctx.lineTo(lx + sd * legW * 0.4, bot); ctx.stroke();
      }
      const bw = legW * 1.12, bh = H * 0.06; // footwear, toes out a little
      RR(ctx, lx - bw / 2 + sd * H * 0.006, H - bh, bw, bh, bh * 0.35, o.boots);
      RR(ctx, lx - bw / 2 + sd * H * 0.006, H - bh * 0.28, bw, bh * 0.28, bh * 0.12, o.sole);
    }
    if (!o.shorts) P(ctx, [[cx - gap / 2, crotch], [cx + gap / 2, crotch], [cx + gap / 2, H - H * 0.06], [cx - gap / 2, H - H * 0.06]], null);
    // belt
    RR(ctx, cx - legW - gap / 2 - H * 0.004, hip - H * 0.018, 2 * legW + gap + H * 0.008, H * 0.022, 3, o.belt || '#5b3a21');
    // arms (sleeves) + hands, behind the torso
    const wrist = z(o.kid ? 0.47 : 0.49);
    for (const sd of [-1, 1]) {
      const ax = cx + sd * shW / 2, aw = H * 0.052;
      const arm = () => { ctx.beginPath(); ctx.moveTo(ax - aw * 0.55, sh + aw * 0.2); ctx.lineTo(ax + aw * 0.55, sh + aw * 0.2); ctx.lineTo(ax + sd * H * 0.03 + aw * 0.45, wrist); ctx.lineTo(ax + sd * H * 0.03 - aw * 0.45, wrist); ctx.closePath(); };
      if (o.plaid) plaid(ctx, arm, 0, sh - 20, W, wrist - sh + 40, o.shirt, o.shirtDark, o.shirtLight, H * 0.045); else { arm(); ctx.fillStyle = o.shirt; ctx.fill(); }
      if (o.shortSleeve) { RR(ctx, ax + sd * H * 0.012 - aw * 0.42, sh + H * 0.11, aw * 0.84, wrist - sh - H * 0.11, aw * 0.4, skin); }
      E(ctx, ax + sd * H * 0.03, wrist + H * 0.035, aw * 0.42, H * 0.04, skin);
    }
    // torso
    const tor = () => { ctx.beginPath(); ctx.moveTo(cx - shW / 2, sh + H * 0.01); ctx.quadraticCurveTo(cx - shW / 2, sh - H * 0.012, cx - shW * 0.3, sh - H * 0.012); ctx.lineTo(cx + shW * 0.3, sh - H * 0.012); ctx.quadraticCurveTo(cx + shW / 2, sh - H * 0.012, cx + shW / 2, sh + H * 0.01); ctx.lineTo(cx + shW * 0.44, hip + H * 0.02); ctx.lineTo(cx - shW * 0.44, hip + H * 0.02); ctx.closePath(); };
    if (o.plaid) plaid(ctx, tor, 0, sh - 30, W, hip - sh + 80, o.shirt, o.shirtDark, o.shirtLight, H * 0.045); else { tor(); ctx.fillStyle = o.shirt; ctx.fill(); }
    if (o.tee) { // open shirt over a grey tee
      P(ctx, [[cx - shW * 0.12, sh - H * 0.01], [cx + shW * 0.12, sh - H * 0.01], [cx + shW * 0.1, hip + H * 0.02], [cx - shW * 0.1, hip + H * 0.02]], o.tee);
      P(ctx, [[cx - shW * 0.13, sh - H * 0.012], [cx - shW * 0.02, sh + H * 0.05], [cx - shW * 0.2, sh + H * 0.02]], o.shirtDark);
      P(ctx, [[cx + shW * 0.13, sh - H * 0.012], [cx + shW * 0.02, sh + H * 0.05], [cx + shW * 0.2, sh + H * 0.02]], o.shirtDark);
      for (const sd of [-1, 1]) RR(ctx, cx + sd * shW * 0.27 - H * 0.03, sh + H * 0.06, H * 0.06, H * 0.05, 3, 'rgba(0,0,0,.18)');
    }
    // neck, head, hair, face
    RR(ctx, cx - H * 0.02, sh - H * 0.05, H * 0.04, H * 0.055, 6, skinD);
    E(ctx, cx - hr * 0.84, hy + hr * 0.08, hr * 0.14, hr * 0.22, skinD); E(ctx, cx + hr * 0.84, hy + hr * 0.08, hr * 0.14, hr * 0.22, skinD);
    E(ctx, cx, hy, hr * 0.8, hr, skin);
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, hy - hr * 0.1, hr * 0.9, hr * 1.02, 0, Math.PI, 0); ctx.lineTo(cx + hr * 0.82, hy - hr * 0.15); ctx.quadraticCurveTo(cx, hy - hr * 0.62, cx - hr * 0.82, hy - hr * 0.15); ctx.closePath(); ctx.fillStyle = o.hair; ctx.fill(); ctx.restore();
    for (const sd of [-1, 1]) { E(ctx, cx + sd * hr * 0.33, hy + hr * 0.02, hr * 0.085, hr * 0.1, '#2b2118'); curve(ctx, [[cx + sd * hr * 0.5, hy - hr * 0.2], [cx + sd * hr * 0.33, hy - hr * 0.3], [cx + sd * hr * 0.16, hy - hr * 0.2]], o.hair, hr * 0.07); }
    curve(ctx, [[cx - hr * 0.05, hy + hr * 0.1], [cx - hr * 0.13, hy + hr * 0.32], [cx + hr * 0.06, hy + hr * 0.35]], skinD, hr * 0.05);
    if (o.beard) { ctx.save(); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(cx, hy + hr * 0.45, hr * 0.62, hr * 0.5, 0, 0, Math.PI); ctx.fillStyle = o.hair; ctx.fill(); ctx.restore(); }
    curve(ctx, [[cx - hr * 0.25, hy + hr * 0.55], [cx, hy + hr * 0.68], [cx + hr * 0.25, hy + hr * 0.55]], '#8a4b3a', hr * 0.06);
  }
  const DRAW = {
    human: (ctx, r) => person(ctx, r.h, r.w, { head: 0.128, plaid: true, shirt: '#2f5f6e', shirtDark: '#14303a', shirtLight: '#9cc3b9', tee: '#9aa0a6', legs: '#3f6fa3', legsHi: 'rgba(160,195,230,.35)', legsSeam: '#2b4f78', boots: '#6b4423', sole: '#2e1f14', hair: '#5a3b22', beard: true }),
    child: (ctx, r) => person(ctx, r.h, r.w, { head: 0.17, kid: true, shirt: '#e4572e', shortSleeve: true, legs: '#c9b07a', shorts: true, boots: '#3d7dd8', sole: '#f4f4f4', hair: '#a0662f' }),
    beagle(ctx, r) { // side view, facing left, 2 ft to the top of its raised tail
      const tan = '#c8873f', black = '#26221f', white = '#f7f3ec', brown = '#8a5426';
      for (const [x, back] of [[205, 0], [265, 1], [470, 0], [530, 1]]) { RR(ctx, x, 340, 46, 270, 20, back ? '#e8e2d8' : white); E(ctx, x + 23, 345, 30, 40, tan); }
      E(ctx, 375, 300, 215, 105, tan);
      ctx.save(); ctx.beginPath(); ctx.ellipse(375, 300, 215, 105, 0, 0, Math.PI * 2); ctx.clip(); E(ctx, 410, 245, 175, 80, black); E(ctx, 330, 395, 210, 55, white); ctx.restore();
      curve(ctx, [[560, 270], [640, 210], [645, 30]], tan, 34); curve(ctx, [[645, 70], [646, 40], [645, 18]], white, 30); // tail with white tip
      P(ctx, [[200, 210], [250, 200], [270, 330], [190, 360]], tan); // neck
      E(ctx, 200, 345, 60, 70, white); // chest
      E(ctx, 155, 175, 85, 70, tan); // skull
      RR(ctx, 50, 175, 120, 78, 34, white); E(ctx, 150, 140, 22, 55, white, 0.2); // muzzle + blaze
      E(ctx, 52, 192, 22, 18, black); // nose
      E(ctx, 135, 160, 11, 12, '#2b1a0e'); E(ctx, 132, 157, 3.5, 3.5, '#fff');
      E(ctx, 205, 215, 42, 88, brown, -0.12); // ear
      curve(ctx, [[75, 240], [100, 250], [125, 240]], '#6d4b37', 5);
    },
    cat(ctx, r) { // sitting, side view, facing left
      const o = '#e08a3c', d = '#b4602a';
      curve(ctx, [[200, 238], [280, 240], [270, 170]], o, 26);
      E(ctx, 150, 165, 95, 85, o); E(ctx, 130, 238, 70, 14, o);
      ctx.save(); ctx.beginPath(); ctx.ellipse(150, 165, 95, 85, 0, 0, Math.PI * 2); ctx.clip(); ctx.strokeStyle = d; ctx.lineWidth = 9; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(150 + i * 22, 85); ctx.quadraticCurveTo(170 + i * 22, 130, 150 + i * 22, 175); ctx.stroke(); } ctx.restore();
      E(ctx, 95, 175, 30, 60, '#f6e7d5'); // chest
      E(ctx, 100, 85, 58, 50, o);
      P(ctx, [[60, 60], [62, 0], [95, 42]], o); P(ctx, [[110, 40], [140, 0], [148, 55]], o); P(ctx, [[70, 52], [68, 14], [88, 44]], '#f2b8a0');
      E(ctx, 62, 100, 22, 16, '#f6e7d5'); E(ctx, 46, 94, 6, 5, '#d9776b');
      E(ctx, 80, 78, 9, 11, '#7bb662'); E(ctx, 80, 78, 3, 8, '#1f2a14');
      RR(ctx, 70, 200, 26, 50, 12, '#f6e7d5');
    },
    horse(ctx, r) { // side view, facing left, head up
      const c = '#8b5a2b', dk = '#3a2414', hoof = '#2a2a2a';
      for (const [x, b] of [[620, 0], [760, 1], [1650, 0], [1790, 1]]) { RR(ctx, x, 1150, 110, 1150, 40, b ? '#6e4520' : c); RR(ctx, x - 5, 2220, 120, 80, 12, hoof); }
      E(ctx, 1220, 1050, 720, 360, c);
      curve(ctx, [[1900, 900], [2250, 1100], [2150, 1700]], dk, 110); // tail
      P(ctx, [[560, 980], [900, 820], [620, 250], [380, 330]], c); // neck
      P(ctx, [[640, 250], [700, 320], [920, 820], [860, 860], [600, 330]], dk); // mane
      P(ctx, [[390, 200], [560, 170], [600, 330], [200, 560], [110, 500]], c); // head
      E(ctx, 150, 520, 80, 60, '#6e4520'); E(ctx, 130, 515, 14, 10, '#1a1a1a');
      E(ctx, 430, 300, 22, 24, '#1a1a1a'); P(ctx, [[520, 180], [560, 40], [580, 190]], c);
    },
    elephant(ctx, r) { // side view, facing left
      const g = '#8e949b', gd = '#737a82';
      for (const [x, b] of [[1450, 1], [1900, 0], [2950, 1], [3400, 0]]) { RR(ctx, x, 1500, 430, 1700, 120, b ? gd : g); RR(ctx, x + 20, 3120, 390, 80, 30, '#d8d2c4'); }
      E(ctx, 2550, 1320, 1350, 900, g);
      curve(ctx, [[3880, 1100], [4050, 1500], [4000, 2000]], gd, 60);
      E(ctx, 1150, 900, 680, 680, g); // head
      E(ctx, 1500, 1050, 470, 680, gd, 0.1); // ear
      curve(ctx, [[700, 1100], [380, 1900], [520, 3000]], g, 300); curve(ctx, [[520, 2950], [560, 3100], [660, 3080]], g, 180); // trunk
      curve(ctx, [[780, 1450], [420, 1700], [330, 1500]], '#f4efe2', 90); // tusk
      E(ctx, 900, 750, 40, 45, '#2b2b2b');
    },
    giraffe(ctx, r) { // side view, facing left
      const y = '#e3b04b', p = '#9a5b22';
      for (const [x, b] of [[1150, 1], [1300, 0], [2200, 1], [2350, 0]]) { RR(ctx, x, 2900, 95, 2100, 40, b ? '#cf9b3a' : y); RR(ctx, x - 5, 4920, 105, 80, 10, '#3a2a1a'); }
      E(ctx, 1800, 2850, 820, 420, y);
      P(ctx, [[1150, 2850], [1500, 2600], [900, 500], [620, 560]], y); // neck
      curve(ctx, [[2600, 2700], [2750, 3000], [2700, 3600]], '#7a4a1a', 30);
      E(ctx, 560, 420, 300, 150, y, 0.35); // head
      E(ctx, 330, 470, 90, 70, '#d6a245', 0.3);
      ctx.save(); ctx.beginPath(); ctx.ellipse(1800, 2850, 820, 420, 0, 0, Math.PI * 2); ctx.moveTo(1150, 2850); ctx.lineTo(1500, 2600); ctx.lineTo(900, 500); ctx.lineTo(620, 560); ctx.closePath(); ctx.clip();
      for (let i = 0; i < 60; i++) { const a = i * 2.39996, rr = 120 + (i % 3) * 25; E(ctx, 700 + (i * 157) % 2000, 500 + (i * 331) % 2800, rr, rr * 0.8, p, a); }
      ctx.restore();
      for (const x of [590, 680]) { RR(ctx, x, 0, 40, 260, 15, p); E(ctx, x + 20, 20, 32, 30, '#5a3412'); }
      E(ctx, 520, 360, 22, 24, '#1a1a1a'); P(ctx, [[760, 330], [880, 260], [820, 400]], y);
    },
    coin(ctx, r) { const c = r.w / 2; E(ctx, c, c, c, c, '#b8902a'); E(ctx, c, c, c * 0.86, c * 0.86, '#e2c044'); E(ctx, c, c, c * 0.62, c * 0.62, '#d4b23a'); ctx.fillStyle = '#9c7a1f'; ctx.font = `bold ${c * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('1', c, c * 1.04); },
    battery(ctx, r) { RR(ctx, 4.7, 0, 5.1, 2, 0.8, '#b9bcc0'); RR(ctx, 0, 1.5, 14.5, 49, 1.6, '#202226'); RR(ctx, 0, 1.5, 14.5, 15, 1.6, '#c87533'); ctx.fillStyle = '#f2f2f2'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('AA', 7.25, 32); ctx.fillText('+', 7.25, 11); RR(ctx, 0.5, 49.5, 13.5, 1, 0.4, '#8d9095'); },
    minifig(ctx, r) {
      RR(ctx, 8, 0, 6, 2.6, 0.8, '#f2c500'); RR(ctx, 5.6, 2.2, 10.8, 9, 2.4, '#f6cd00'); E(ctx, 9, 6, 0.9, 1.1, '#1c1c1c'); E(ctx, 13, 6, 0.9, 1.1, '#1c1c1c'); curve(ctx, [[8.6, 8.4], [11, 9.6], [13.4, 8.4]], '#1c1c1c', 0.6);
      P(ctx, [[5, 11.5], [17, 11.5], [18.5, 24], [3.5, 24]], '#d0312d'); RR(ctx, 0.5, 12.5, 4, 10, 1.8, '#c22a26'); RR(ctx, 17.5, 12.5, 4, 10, 1.8, '#c22a26'); E(ctx, 2.5, 23.5, 2, 1.6, '#f6cd00'); E(ctx, 19.5, 23.5, 2, 1.6, '#f6cd00');
      RR(ctx, 3.8, 24, 14.4, 3, 0.6, '#1d4f9c'); RR(ctx, 3.8, 26.5, 6.9, 13.5, 0.8, '#2563c4'); RR(ctx, 11.3, 26.5, 6.9, 13.5, 0.8, '#2563c4');
    },
    mug(ctx, r) { ctx.lineWidth = 11; ctx.strokeStyle = '#2a8a7e'; ctx.beginPath(); ctx.ellipse(86, 46, 22, 26, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); RR(ctx, 0, 0, 86, 95, 9, '#2a9d8f'); RR(ctx, 0, 0, 86, 7, 4, '#8fd3c9'); RR(ctx, 12, 18, 6, 60, 3, 'rgba(255,255,255,.28)'); },
    can(ctx, r) { RR(ctx, 4, 0, 58, 9, 3, '#c5c9ce'); RR(ctx, 0, 7, 66, 108, 3, '#d62828'); RR(ctx, 4, 113, 58, 9, 3, '#b7bbc0'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 70); ctx.bezierCurveTo(20, 45, 45, 95, 66, 60); ctx.stroke(); RR(ctx, 9, 14, 6, 94, 3, 'rgba(255,255,255,.25)'); },
    phone(ctx, r) { RR(ctx, 0, 0, 71.5, 147, 10, '#1c1d21'); const g = ctx.createLinearGradient(0, 0, 71.5, 147); g.addColorStop(0, '#5b7cfa'); g.addColorStop(1, '#a855f7'); RR(ctx, 3.5, 3.5, 64.5, 140, 8, g); RR(ctx, 26, 6, 19.5, 5, 2.5, '#1c1d21'); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) RR(ctx, 9 + i * 14.5, 22 + j * 16, 10, 10, 3, 'rgba(255,255,255,.55)'); RR(ctx, 24, 137, 23.5, 1.6, 0.8, 'rgba(255,255,255,.8)'); },
    ball(ctx, r) { const c = 120; E(ctx, c, c, c, c, '#e66a1f'); ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, 240); ctx.moveTo(0, c); ctx.lineTo(240, c); ctx.stroke(); ctx.beginPath(); ctx.ellipse(c - 150, c, 140, 115, 0, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.ellipse(c + 150, c, 140, 115, 0, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke(); }
  };
  /** Draw a reference figure onto a canvas (browser). Returns the canvas; transparent outside the figure. */
  function drawRef(r, canvas, pxPerFigure) {
    const k = (pxPerFigure || 512) / Math.max(r.h, r.w);
    canvas.width = Math.max(8, Math.ceil(r.w * k)); canvas.height = Math.max(8, Math.ceil(r.h * k));
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.scale(k, k);
    (DRAW[r.id] || DRAW.human)(ctx, r); ctx.restore();
    return canvas;
  }
  /** Draw the ruler (wooden stick, ticks, numbers) for a rulerSpec onto a canvas of the given pixel height. */
  function drawRuler(spec, canvas, pxH, widthMM) {
    const H = pxH || 2048, k = H / spec.top, W = Math.max(48, Math.round(widthMM * k));
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext('2d');
    const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#e9d3a6'); g.addColorStop(0.5, '#f3e2bd'); g.addColorStop(1, '#dcc08a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalAlpha = 0.18; c.strokeStyle = '#a77b3f'; c.lineWidth = Math.max(1, W * 0.01);
    for (let i = 0; i < 9; i++) { c.beginPath(); const x = W * (0.08 + i * 0.105); c.moveTo(x, 0); for (let y = 0; y <= H; y += H / 24) c.lineTo(x + Math.sin(y * 0.004 + i) * W * 0.02, y); c.stroke(); }
    c.globalAlpha = 1; c.strokeStyle = '#8b6a3a'; c.lineWidth = Math.max(2, W * 0.02); c.strokeRect(0, 0, W, H);
    const Y = mm => H - mm * k;
    c.fillStyle = '#2a2116';
    for (const m of spec.minors) c.fillRect(0, Y(m) - W * 0.008, W * 0.2, Math.max(1.5, W * 0.016));
    for (const m of spec.half) c.fillRect(0, Y(m) - W * 0.011, W * 0.32, Math.max(2, W * 0.022));
    const fs = Math.min(W * 0.36, (k * spec.step) * 0.42);
    c.font = `600 ${fs}px "IBM Plex Sans", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const m of spec.majors) { c.fillRect(0, Y(m.mm) - W * 0.015, W * 0.5, Math.max(3, W * 0.03)); if (m.mm < spec.top - 1e-6) c.fillText(m.label, W * 0.72, Y(m.mm)); }
    c.font = `600 ${fs * 0.7}px "IBM Plex Sans", Arial, sans-serif`; c.fillText(spec.unit, W * 0.72, H - Math.min(H * 0.04, k * spec.step * 0.3));
    return canvas;
  }

  const api = { robot, robotSDF, rabbit, rabbitSDF, meshSDF, ROBOT_CUTS, packMesh, unpackMesh, packFigure, unpackFigure, SCALE_REFS, refById, pickScaleRef, refLabel, lenShort, callout, rulerSpec, drawRef, drawRuler };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPModels = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
