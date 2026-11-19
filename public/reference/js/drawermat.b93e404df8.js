/* Expressarte fitted drawer mat: a mat that fills a drawer exactly and splits into bed-sized
   tiles with flat-locking edge joints. Patterns (grid, hex, waves, ribbed, diamond, dots,
   terrazzo, non-slip nubs) are laid out in global drawer coordinates so motifs run across
   snap seams as one continuous sheet. Pastel colors, TPU recommended, and a rigid-plastic mode with a
   looser fit and flexure slots so the joints still snap. American spelling. No brand names. */
(function (G) {
  'use strict';
  const C = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);

  const PATTERNS = [
    { id: 'nubs', label: 'Non-slip nubs' },
    { id: 'grid', label: 'Grid' },
    { id: 'hex', label: 'Hex' },
    { id: 'waves', label: 'Waves' },
    { id: 'ribbed', label: 'Ribbed' },
    { id: 'diamond', label: 'Diamond' },
    { id: 'dots', label: 'Dots' },
    { id: 'terrazzo', label: 'Terrazzo' }
  ];
  const PZ = (C && C.PASTELS) || {};
  const PALETTE = [
    { name: 'Mint', hex: PZ.mint || '#A8E6CF' },
    { name: 'Sage', hex: PZ.sage || '#B5C9A8' },
    { name: 'Baby blue', hex: PZ.babyBlue || '#A7C7E7' },
    { name: 'Lavender', hex: PZ.lavender || '#C8B6E2' },
    { name: 'Pink', hex: PZ.pink || '#F4B6C2' },
    { name: 'Peach', hex: PZ.peach || '#F9C6A8' },
    { name: 'Butter', hex: PZ.butter || '#F8E7A1' },
    { name: 'Cream', hex: PZ.cream || '#F6EFDC' },
    { name: 'White', hex: '#F7F4EE' },
    { name: 'Charcoal', hex: PZ.ink || '#2B2D31' }
  ];
  const FREE = { maxW: 600, maxD: 500, maxTiles: 8 };
  const DEFAULTS = {
    drawerW: 400, drawerD: 300, pattern: 'nubs', material: 'tpu',
    thickness: 2.4, relief: 0.8, scale: 1, radius: 6, detail: 'hd',
    baseColor: PZ.mint || '#A8E6CF', patternColor: PZ.butter || '#F8E7A1', chipColor: PZ.pink || '#F4B6C2',
    showDrawer: true, bed: [256, 256, 256], bambu: 'A1'
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex = (c, d) => /^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() : d;
  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    o.drawerW = clamp(+o.drawerW || DEFAULTS.drawerW, 60, 2000);
    o.drawerD = clamp(+o.drawerD || DEFAULTS.drawerD, 60, 2000);
    o.pattern = PATTERNS.some(p => p.id === o.pattern) ? o.pattern : 'nubs';
    o.material = o.material === 'rigid' ? 'rigid' : 'tpu';
    o.thickness = clamp(+o.thickness || 2.4, 1.2, 8);
    o.relief = clamp(+o.relief || 0.8, 0.3, 2.5);
    o.scale = clamp(+o.scale || 1, 0.5, 1.8);
    o.radius = clamp(+o.radius || 0, 0, 30);
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    o.baseColor = hex(o.baseColor, DEFAULTS.baseColor);
    o.patternColor = hex(o.patternColor, DEFAULTS.patternColor);
    o.chipColor = hex(o.chipColor, DEFAULTS.chipColor);
    o.showDrawer = o.showDrawer !== false;
    o.bed = Array.isArray(o.bed) ? o.bed.map(Number) : [256, 256, 256];
    return o;
  }
  function materialSpec(o) {
    if (o.material === 'rigid') return { clearance: 0.32, shrink: 1.0, flex: true, label: 'rigid plastic' };
    return { clearance: 0.12, shrink: 0.4, flex: false, label: 'TPU' };
  }
  function jointSpec(o) {
    const m = materialSpec(o);
    return { depth: 7, pitch: 32, neck: 12, flare: 2.2, margin: 10, clearance: m.clearance, flex: m.flex, shrink: m.shrink };
  }
  function usable(o) { return { w: Math.max(50, o.bed[0] - 8), d: Math.max(50, o.bed[1] - 8), z: Math.max(20, o.bed[2] - 4) }; }

  function runs(n, m) {
    m = Math.max(1, m); const k = Math.ceil(n / m), out = []; let left = n;
    for (let i = 0; i < k; i++) { const r = Math.ceil(left / (k - i)); out.push(r); left -= r; }
    return out;
  }
  // Split a length into the fewest near-equal field sizes that each fit maxField (the printable field, not counting a male tab).
  function splitLength(len, maxField) {
    const n = Math.max(1, Math.ceil((len - 1e-6) / Math.max(20, maxField)));
    const sizes = []; let left = len;
    for (let i = 0; i < n; i++) { const s = left / (n - i); sizes.push(+s.toFixed(4)); left -= sizes[i]; }
    return sizes;
  }
  function layout(o) {
    const J = jointSpec(o), U = usable(o), m = materialSpec(o);
    const W = Math.max(40, o.drawerW - m.shrink), D = Math.max(40, o.drawerD - m.shrink);
    // Male tabs add joint.depth on +X and +Y; those sides must still fit the bed.
    const maxFieldW = Math.max(30, U.w - J.depth), maxFieldD = Math.max(30, U.d - J.depth);
    const cols = splitLength(W, maxFieldW), rows = splitLength(D, maxFieldD);
    const tiles = []; let y = 0;
    for (let j = 0; j < rows.length; j++) {
      let x = 0;
      for (let i = 0; i < cols.length; i++) {
        tiles.push({
          ix: i, iy: j, x, y, fieldW: cols[i], fieldD: rows[j],
          xm: i > 0 ? 'female' : 'none',
          xp: i < cols.length - 1 ? 'male' : 'none',
          ym: j > 0 ? 'female' : 'none',
          yp: j < rows.length - 1 ? 'male' : 'none',
          r00: i === 0 && j === 0, r10: i === cols.length - 1 && j === 0,
          r01: i === 0 && j === rows.length - 1, r11: i === cols.length - 1 && j === rows.length - 1
        });
        x += cols[i];
      }
      y += rows[j];
    }
    return { W, D, cols, rows, tiles, joint: J, material: m };
  }

  function area2(P) { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function tabStations(len, J) {
    const usable = len - 2 * J.margin;
    if (usable < J.neck + 2 * J.flare + 2) return [];
    const n = Math.max(1, Math.floor((usable + 4) / J.pitch));
    const span = (n - 1) * J.pitch;
    const start = (len - span) / 2;
    const out = [];
    for (let i = 0; i < n; i++) out.push(start + i * J.pitch);
    return out;
  }
  // Walk an edge from t=0 to t=len. origin + along*t is on the edge. outward points out of the tile.
  function edgePoints(origin, along, outward, len, kind, J) {
    const pts = [], stations = kind === 'none' ? [] : tabStations(len, J);
    const half = J.neck / 2;
    let cursor = 0;
    const push = (t, out) => { pts.push([origin[0] + along[0] * t + outward[0] * out, origin[1] + along[1] * t + outward[1] * out]); };
    push(0, 0);
    for (const mid of stations) {
      const t0 = mid - half, t1 = mid + half;
      if (t0 <= cursor + 0.5) continue;
      // Dovetail: male tip is wider than the neck so it locks; female is the same shape
      // cut inward, enlarged by clearance, so the tab snaps in from above.
      if (kind === 'male') {
        push(t0, 0);
        push(t0 - J.flare, J.depth);
        push(t1 + J.flare, J.depth);
        push(t1, 0);
      } else if (kind === 'female') {
        const c = J.clearance;
        push(t0 - c, 0);
        push(t0 - J.flare - c, -(J.depth + c));
        push(t1 + J.flare + c, -(J.depth + c));
        push(t1 + c, 0);
      }
      cursor = t1;
    }
    if (cursor < len - 1e-6) push(len, 0);
    else if (Math.abs(cursor - len) > 1e-6) push(len, 0);
    return pts;
  }
  function arc(cx, cy, r, a0, a1, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  }
  function tileOutline(t, o, J) {
    const w = t.fieldW, d = t.fieldD, r = Math.min(o.radius, w / 2, d / 2);
    const segs = o.detail === 'hd' ? 8 : 4;
    // CCW: bottom (y=0, +X), right (x=w, +Y), top (y=d, -X), left (x=0, -Y)
    let pts = [];
    const startR = (t.r00 && r > 0.4) ? r : 0, endR = (t.r10 && r > 0.4) ? r : 0;
    if (startR) pts.push(...arc(startR, startR, startR, Math.PI, Math.PI * 1.5, segs));
    else pts.push([0, 0]);
    const bot = edgePoints([startR, 0], [1, 0], [0, -1], w - startR - endR, t.ym, J);
    pts.push(...bot.slice(1));
    if (endR) pts.push(...arc(w - endR, endR, endR, Math.PI * 1.5, Math.PI * 2, segs).slice(1));

    const rightStart = endR, rightEnd = (t.r11 && r > 0.4) ? r : 0;
    const right = edgePoints([w, rightStart], [0, 1], [1, 0], d - rightStart - rightEnd, t.xp, J);
    pts.push(...right.slice(1));
    if (rightEnd) pts.push(...arc(w - rightEnd, d - rightEnd, rightEnd, 0, Math.PI * 0.5, segs).slice(1));

    const topStart = rightEnd, topEnd = (t.r01 && r > 0.4) ? r : 0;
    const top = edgePoints([w - topStart, d], [-1, 0], [0, 1], w - topStart - topEnd, t.yp, J);
    pts.push(...top.slice(1));
    if (topEnd) pts.push(...arc(topEnd, d - topEnd, topEnd, Math.PI * 0.5, Math.PI, segs).slice(1));

    const leftStart = topEnd, leftEnd = startR;
    const left = edgePoints([0, d - leftStart], [0, -1], [-1, 0], d - leftStart - leftEnd, t.xm, J);
    pts.push(...left.slice(1));
    // drop exact duplicate of the first point
    if (pts.length > 1) {
      const a = pts[0], b = pts[pts.length - 1];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) pts.pop();
    }
    if (area2(pts) < 0) pts = pts.reverse();
    return pts;
  }
  function extrudePoly(loop, z0, z1) { return T.extrude([{ outer: loop, holes: [] }], 2, z0, z1); }

  function man(M, p) {
    const { V, F } = C.weld(p), mm = new M.Mesh({ numProp: 3, vertProperties: Float32Array.from(V), triVerts: Uint32Array.from(F) });
    mm.merge(); return new M.Manifold(mm);
  }
  function soup(m) {
    const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float64Array(F.length * 3);
    for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; }
    return p;
  }
  function unionAll(M, meshes) {
    const live = [];
    for (const p of meshes) {
      if (!p || !p.length) continue;
      try { const m = man(M, p); if (m.status() === 'NoError' && !m.isEmpty()) live.push(m); else m.delete(); }
      catch (e) { /* skip a bad shell */ }
    }
    if (!live.length) return null;
    if (live.length === 1) { const p = soup(live[0]); live[0].delete(); return p; }
    const u = M.Manifold.union(live); const p = soup(u); u.delete(); live.forEach(m => m.delete()); return p;
  }
  function subtract(M, a, cuts) {
    if (!cuts.length) return a;
    const base = man(M, a), holes = [];
    for (const p of cuts) {
      try { const m = man(M, p); if (m.status() === 'NoError' && !m.isEmpty()) holes.push(m); else m.delete(); }
      catch (e) { /* skip */ }
    }
    if (!holes.length) { const p = soup(base); base.delete(); return p; }
    const h = holes.length === 1 ? holes[0] : M.Manifold.union(holes);
    if (holes.length > 1) holes.forEach(m => m.delete());
    const d = base.subtract(h); const p = soup(d); d.delete(); base.delete(); h.delete();
    return p;
  }

  // Flexure slots around each female socket so a rigid tile can deflect and snap. Printable through-cuts.
  function flexCuts(t, J, th) {
    const cuts = [], stations = [], c = 0.7, reach = J.depth + J.clearance + 1.6, hinge = 1.4;
    const add = (origin, along, outward, len) => {
      for (const mid of tabStations(len, J)) {
        const t0 = mid - J.neck / 2 - J.flare - J.clearance - 0.8;
        const t1 = mid + J.neck / 2 + J.flare + J.clearance + 0.8;
        const box = (u0, u1, v0, v1) => T.box(
          origin[0] + along[0] * u0 + outward[0] * v0,
          origin[1] + along[1] * u0 + outward[1] * v0,
          -0.2,
          origin[0] + along[0] * u1 + outward[0] * v1,
          origin[1] + along[1] * u1 + outward[1] * v1,
          th + 0.2
        );
        // three sides of a U around the socket, leaving a hinge at the inner end
        cuts.push(box(t0, t0 + c, 0.2, -(reach)));
        cuts.push(box(t1 - c, t1, 0.2, -(reach)));
        cuts.push(box(t0, t1, -(reach - c), -(reach)));
        void hinge;
      }
    };
    if (t.ym === 'female') add([0, 0], [1, 0], [0, -1], t.fieldW);
    if (t.xp === 'male') { /* no slots on male */ }
    if (t.yp === 'female') add([t.fieldW, t.fieldD], [-1, 0], [0, 1], t.fieldW);
    if (t.xm === 'female') add([0, t.fieldD], [0, -1], [-1, 0], t.fieldD);
    if (t.xp === 'female') add([t.fieldW, 0], [0, 1], [1, 0], t.fieldD);
    if (t.ym === 'male' || t.yp === 'male' || t.xm === 'male') { /* ignore */ }
    return cuts;
  }

  function sizeOf(p) { const b = C.bbox(p); return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]; }
  function move(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  function concat(arr) {
    const n = arr.reduce((s, p) => s + (p ? p.length : 0), 0), q = new Float64Array(n); let k = 0;
    for (const p of arr) if (p && p.length) { q.set(p, k); k += p.length; }
    return q;
  }
  function box(x0, y0, z0, x1, y1, z1) {
    if (x1 < x0) { const t = x0; x0 = x1; x1 = t; }
    if (y1 < y0) { const t = y0; y0 = y1; y1 = t; }
    if (z1 < z0) { const t = z0; z0 = z1; z1 = t; }
    if (x1 - x0 < 0.05 || y1 - y0 < 0.05 || z1 - z0 < 0.05) return null;
    return T.box(x0, y0, z0, x1, y1, z1);
  }

  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function cylinder(cx, cy, r, z0, z1, segs) {
    const loop = [];
    for (let i = 0; i < segs; i++) { const a = i / segs * Math.PI * 2; loop.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return extrudePoly(loop, z0, z1);
  }
  function nub(cx, cy, z0, rx, h, segs) {
    const rings = Math.max(3, Math.round(segs / 2));
    const pts = [];
    const ring = (r, z) => {
      const out = [];
      for (let i = 0; i < segs; i++) { const a = i / segs * Math.PI * 2; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]); }
      return out;
    };
    const R = [ring(rx, z0)];
    for (let i = 1; i <= rings; i++) {
      const t = i / rings, phi = t * Math.PI * 0.5;
      R.push(ring(rx * Math.cos(phi), z0 + h * Math.sin(phi)));
    }
    const cap = [cx, cy, z0 + h];
    const push = (a, b, c) => pts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    // bottom cap
    for (let i = 0; i < segs; i++) {
      const p0 = R[0][i], p1 = R[0][(i + 1) % segs];
      push([cx, cy, z0], p1, p0);
    }
    for (let k = 0; k < rings; k++) {
      const A = R[k], B = R[k + 1];
      for (let i = 0; i < segs; i++) {
        const j = (i + 1) % segs;
        push(A[i], A[j], B[j]); push(A[i], B[j], B[i]);
      }
    }
    const top = R[rings];
    for (let i = 0; i < segs; i++) push(top[i], top[(i + 1) % segs], cap);
    return new Float64Array(pts);
  }
  function hexLoop(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  }

  function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function clipLoopToRect(loop, x0, y0, x1, y1) {
    const cut = (pts, inside, hit) => {
      const out = [];
      if (!pts.length) return out;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ain = inside(a), bin = inside(b);
        if (ain && bin) out.push(b);
        else if (ain && !bin) out.push(hit(a, b));
        else if (!ain && bin) { out.push(hit(a, b)); out.push(b); }
      }
      return out;
    };
    const acrossX = (a, b, x) => lerp2(a, b, Math.abs(b[0] - a[0]) < 1e-12 ? 0 : (x - a[0]) / (b[0] - a[0]));
    const acrossY = (a, b, y) => lerp2(a, b, Math.abs(b[1] - a[1]) < 1e-12 ? 0 : (y - a[1]) / (b[1] - a[1]));
    let p = loop;
    p = cut(p, q => q[0] >= x0 - 1e-9, (a, b) => acrossX(a, b, x0));
    p = cut(p, q => q[0] <= x1 + 1e-9, (a, b) => acrossX(a, b, x1));
    p = cut(p, q => q[1] >= y0 - 1e-9, (a, b) => acrossY(a, b, y0));
    p = cut(p, q => q[1] <= y1 + 1e-9, (a, b) => acrossY(a, b, y1));
    return p;
  }
  // A bar trimmed at a tile edge keeps only what is printable: when a seam falls inside a bar, the side with less than
  // MIN_SLIVER mm is dropped (its neighbor tile prints the rest), so no paper-thin or zero-thickness walls reach the file.
  const MIN_SLIVER = 0.6;
  function boxed(x0, y0, z0, x1, y1, z1, tw, td) {
    const a = Math.max(0, x0), b = Math.max(0, y0), c = Math.min(tw, x1), d = Math.min(td, y1);
    if (c - a < MIN_SLIVER || d - b < MIN_SLIVER) return null;
    return box(a, b, z0, c, d, z1);
  }
  function overlaps(gx, gy, rad, x0, y0, x1, y1) {
    return gx + rad >= x0 && gx - rad <= x1 && gy + rad >= y0 && gy - rad <= y1;
  }
  function fullyInside(gx, gy, rad, x0, y0, x1, y1) {
    return gx - rad >= x0 + 1e-6 && gx + rad <= x1 - 1e-6 && gy - rad >= y0 + 1e-6 && gy + rad <= y1 - 1e-6;
  }
  function intersectMesh(M, a, clipMan) {
    if (!a || !a.length) return a;
    let A;
    try {
      A = man(M, a);
      const d = A.intersect(clipMan);
      const ok = d.status() === 'NoError' && !d.isEmpty();
      const p = ok ? soup(d) : new Float64Array(0);
      d.delete(); A.delete();
      return p;
    } catch (e) {
      try { if (A) A.delete(); } catch (e2) {}
      return a;
    }
  }
  // The visible top of a tile is the field rectangle, with a rounded corner only where
  // the tile is a corner of the assembled mat. Pattern is clipped to that surface \u2014 not
  // to the snap tabs or socket notches \u2014 so the raised texture runs across the seams
  // and covers the joint zone as a top-surface finish. Tabs stay unpatterned (they tuck
  // into the neighbor).
  function fieldTopOutline(t, o) {
    return tileOutline({ ...t, xm: 'none', xp: 'none', ym: 'none', yp: 'none' }, o, jointSpec(o));
  }
  function clipToOutline(meshes, t, o, M, J) {
    if (!meshes.length) return meshes;
    const edge = 0.4;
    const near = mesh => {
      const b = C.bbox(mesh);
      return b.min[0] < edge || b.max[0] > t.fieldW - edge || b.min[1] < edge || b.max[1] > t.fieldD - edge;
    };
    if (!M) return meshes.filter(m => m && m.length);
    let clipMan = null;
    const out = [];
    try {
      for (const mesh of meshes) {
        if (!mesh || !mesh.length) continue;
        if (!near(mesh)) { out.push(mesh); continue; }
        if (!clipMan) {
          const solid = extrudePoly(fieldTopOutline(t, o), o.thickness - 0.3, o.thickness + o.relief + 0.3);
          clipMan = man(M, solid);
        }
        const p = intersectMesh(M, mesh, clipMan);
        if (p && p.length >= 36) out.push(p);
      }
    } finally { if (clipMan) try { clipMan.delete(); } catch (e) {} }
    return out;
  }

  function patternMeshes(t, o, M, L) {
    const z0 = o.thickness, z1 = o.thickness + o.relief, s = o.scale;
    const J = jointSpec(o);
    const tw = t.fieldW, td = t.fieldD, ox = t.x, oy = t.y;
    const gx0 = ox, gy0 = oy, gx1 = ox + tw, gy1 = oy + td;
    const W = L ? L.W : gx1, D = L ? L.D : gy1;
    const hd = o.detail !== 'draft';
    const area = tw * td;
    const segs = !hd ? 6 : (area > 35000 ? 8 : 12);
    const out = { main: [], chips: [] };
    const toLocalX = gx => gx - ox, toLocalY = gy => gy - oy;

    if (o.pattern === 'nubs') {
      const pitch = 10 * s, rx = 2.2 * Math.min(1.15, s + 0.15), h = o.relief;
      const j0 = Math.floor((gy0 - rx) / pitch) - 1, j1 = Math.ceil((gy1 + rx) / pitch) + 1;
      const i0 = Math.floor((gx0 - rx) / pitch) - 1, i1 = Math.ceil((gx1 + rx) / pitch) + 1;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const gx = (i + 0.5 + (j % 2 ? 0.25 : 0)) * pitch, gy = (j + 0.5) * pitch;
        if (!overlaps(gx, gy, rx + 0.05, gx0, gy0, gx1, gy1)) continue;
        out.main.push(nub(toLocalX(gx), toLocalY(gy), z0, rx, h, segs));
      }
    } else if (o.pattern === 'grid') {
      const pitch = 14 * s, bar = clamp(1.15 * s, 0.8, 2.2);
      const i0 = Math.floor((gx0 - bar) / pitch), i1 = Math.ceil((gx1 + bar) / pitch);
      const j0 = Math.floor((gy0 - bar) / pitch), j1 = Math.ceil((gy1 + bar) / pitch);
      for (let i = i0; i <= i1; i++) {
        const m = boxed(toLocalX(i * pitch) - bar / 2, 0, z0, toLocalX(i * pitch) + bar / 2, td, z1, tw, td);
        if (m) out.main.push(m);
      }
      for (let j = j0; j <= j1; j++) {
        const m = boxed(0, toLocalY(j * pitch) - bar / 2, z0, tw, toLocalY(j * pitch) + bar / 2, z1, tw, td);
        if (m) out.main.push(m);
      }
    } else if (o.pattern === 'hex') {
      const R = 8 * s, wall = clamp(1.1 * s, 0.7, 2), hR = R * Math.sqrt(3), rowH = hR * 0.75, colW = R * 1.5;
      const inner = (cx, cy, ro, ri) => {
        const outer = hexLoop(cx, cy, ro), hole = hexLoop(cx, cy, ri);
        if (area2(hole) > 0) hole.reverse();
        return T.extrude([{ outer, holes: [hole] }], 2, z0, z1);
      };
      const j0 = Math.floor((gy0 - R) / rowH) - 1, j1 = Math.ceil((gy1 + R) / rowH) + 1;
      const i0 = Math.floor((gx0 - R) / colW) - 1, i1 = Math.ceil((gx1 + R) / colW) + 1;
      for (let j = j0; j <= j1; j++) {
        const xoff = j % 2 ? R * 0.75 : 0;
        for (let i = i0; i <= i1; i++) {
          const gx = i * colW + xoff, gy = j * rowH;
          if (!overlaps(gx, gy, R, gx0, gy0, gx1, gy1)) continue;
          out.main.push(inner(toLocalX(gx), toLocalY(gy), R, Math.max(1.2, R - wall)));
        }
      }
    } else if (o.pattern === 'ribbed') {
      const pitch = 6 * s, bar = clamp(2.2 * s, 1.2, 3.2), h = bar * 0.55;
      const j0 = Math.floor((gy0 - h) / pitch) - 1, j1 = Math.ceil((gy1 + h) / pitch) + 1;
      for (let j = j0; j <= j1; j++) {
        const m = boxed(0, toLocalY(j * pitch), z0, tw, toLocalY(j * pitch) + h, z1, tw, td);
        if (m) out.main.push(m);
      }
    } else if (o.pattern === 'waves') {
      // Walk x exactly from this tile's global left to right so the sine phase matches
      // the neighbor at the seam. Strips that cross the top or bottom are trimmed by clipToOutline.
      const amp = 3.2 * s, period = 18 * s, step = hd ? 1.2 : 2.4, bar = clamp(2 * s, 1.2, 3), yPitch = period * 0.55;
      const j0 = Math.floor((gy0 - amp - bar) / yPitch) - 1, j1 = Math.ceil((gy1 + amp + bar) / yPitch) + 1;
      for (let j = j0; j <= j1; j++) {
        const gy = j * yPitch;
        if (gy + amp + bar * 0.6 < gy0 || gy - amp > gy1) continue;
        const loop = [];
        for (let gx = gx0; gx <= gx1 + 1e-9; gx += step) loop.push([toLocalX(gx), toLocalY(gy + amp * Math.sin(gx / period * Math.PI * 2))]);
        if (!loop.length || Math.abs((loop[loop.length - 1][0] + ox) - gx1) > 1e-6)
          loop.push([toLocalX(gx1), toLocalY(gy + amp * Math.sin(gx1 / period * Math.PI * 2))]);
        const back = loop.map(pt => [pt[0], pt[1] + bar * 0.6]).reverse();
        const poly = loop.concat(back);
        if (poly.length < 4) continue;
        if (area2(poly) < 0) poly.reverse();
        out.main.push(extrudePoly(poly, z0, z1));
      }
    } else if (o.pattern === 'diamond') {
      const pitch = 12 * s, half = 4.2 * s, tbar = clamp(1.15 * s, 0.8, 2);
      const dia = (cx, cy) => {
        const outer = [[cx, cy - half], [cx + half, cy], [cx, cy + half], [cx - half, cy]];
        const k = (half - tbar) / half;
        if (k <= 0.2) return extrudePoly(outer, z0, z1);
        const hole = [[cx, cy - half * k], [cx + half * k, cy], [cx, cy + half * k], [cx - half * k, cy]];
        if (area2(hole) > 0) hole.reverse();
        return T.extrude([{ outer, holes: [hole] }], 2, z0, z1);
      };
      const j0 = Math.floor((gy0 - half) / (pitch * 0.5)) - 1, j1 = Math.ceil((gy1 + half) / (pitch * 0.5)) + 1;
      const i0 = Math.floor((gx0 - half) / pitch) - 1, i1 = Math.ceil((gx1 + half) / pitch) + 1;
      for (let j = j0; j <= j1; j++) {
        const xoff = j % 2 ? pitch * 0.5 : 0;
        for (let i = i0; i <= i1; i++) {
          const gx = i * pitch + xoff, gy = j * pitch * 0.5;
          if (!overlaps(gx, gy, half, gx0, gy0, gx1, gy1)) continue;
          out.main.push(dia(toLocalX(gx), toLocalY(gy)));
        }
      }
    } else if (o.pattern === 'dots') {
      const pitch = 8 * s, r = 1.55 * Math.min(1.2, s + 0.1);
      const j0 = Math.floor((gy0 - r) / pitch) - 1, j1 = Math.ceil((gy1 + r) / pitch) + 1;
      const i0 = Math.floor((gx0 - r) / pitch) - 1, i1 = Math.ceil((gx1 + r) / pitch) + 1;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const gx = (i + 0.5) * pitch, gy = (j + 0.5) * pitch;
        if (!overlaps(gx, gy, r + 0.05, gx0, gy0, gx1, gy1)) continue;
        out.main.push(cylinder(toLocalX(gx), toLocalY(gy), r, z0, z1, segs));
      }
    } else if (o.pattern === 'terrazzo') {
      const rnd = rng((0x9E3779B9 ^ (Math.round(W * 10) * 17 + Math.round(D * 7) * 31 + Math.round(s * 100) * 13)) >>> 0);
      const n = Math.max(8, Math.round((W * D / 280) / s));
      for (let k = 0; k < n; k++) {
        const cx = rnd() * W, cy = rnd() * D;
        const rad = (2.2 + rnd() * 4.5) * s, sides = 5 + (rnd() * 3 | 0), rot = rnd() * Math.PI;
        const loop = [];
        let reach = 0;
        for (let i = 0; i < sides; i++) {
          const a = rot + i / sides * Math.PI * 2, rr = rad * (0.65 + rnd() * 0.5);
          const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
          loop.push([x, y]);
          if (rr > reach) reach = rr;
        }
        // Consume the same rng draws on every tile so the global stream stays in lockstep,
        // even when this chip misses the current tile.
        const h = z0 + o.relief * (0.45 + rnd() * 0.55);
        const isChip = rnd() < 0.38;
        if (loop.length < 3 || !overlaps(cx, cy, reach, gx0, gy0, gx1, gy1)) continue;
        const local = loop.map(pt => [toLocalX(pt[0]), toLocalY(pt[1])]);
        const clipped = fullyInside(cx, cy, reach, gx0, gy0, gx1, gy1) ? local : clipLoopToRect(local, 0, 0, tw, td);
        if (clipped.length < 3) continue;
        if (area2(clipped) < 0) clipped.reverse();
        if (Math.abs(area2(clipped)) < 0.3) continue;
        const mesh = extrudePoly(clipped, z0, h);
        if (isChip) out.chips.push(mesh); else out.main.push(mesh);
      }
    }
    out.main = clipToOutline(out.main, t, o, M, J);
    out.chips = clipToOutline(out.chips, t, o, M, J);
    return out;
  }

  const TILE_CACHE = new Map();
  function tileKey(t, o, L) {
    return [t.x, t.y, t.fieldW, t.fieldD, t.xm, t.xp, t.ym, t.yp, +!!t.r00, +!!t.r10, +!!t.r01, +!!t.r11,
      o.pattern, o.material, o.thickness, o.relief, o.scale, o.radius, o.detail, L && L.W, L && L.D].join('|');
  }
  function buildTile(t, o, M, L) {
    const key = tileKey(t, o, L);
    if (TILE_CACHE.has(key)) {
      const c = TILE_CACHE.get(key);
      return { base: c.base, pattern: c.pattern, chips: c.chips, local: c.local };
    }
    const J = jointSpec(o), loop = tileOutline(t, o, J);
    let base = extrudePoly(loop, 0, o.thickness);
    if (M && J.flex) {
      const cuts = flexCuts(t, J, o.thickness);
      if (cuts.length) {
        try { base = subtract(M, base, cuts); } catch (e) { /* keep uncut base */ }
      }
    }
    const pat = patternMeshes(t, o, M, L);
    const pattern = pat.main.length ? concat(pat.main) : new Float64Array(0);
    const chips = pat.chips.length ? concat(pat.chips) : new Float64Array(0);
    // Keep the complete tile as separate shells (base + pattern). Unioning hundreds of nubs
    // is slow and heavy; slicers accept a multi-body STL, and the 3MF already splits colors.
    const local = concat([base, pattern, chips].filter(p => p && p.length));
    const res = { base, pattern, chips, local };
    if (TILE_CACHE.size > 20) TILE_CACHE.clear();
    TILE_CACHE.set(key, res);
    return res;
  }

  function tileName(t, cols, rows) {
    if (cols === 1 && rows === 1) return 'Drawer mat';
    return `Tile ${t.ix + 1},${t.iy + 1}`;
  }
  function fitsBed(sz, U) { return (sz[0] <= U.w + 0.05 && sz[1] <= U.d + 0.05) || (sz[1] <= U.w + 0.05 && sz[0] <= U.d + 0.05); }

  function build(raw, M) {
    const o = options(raw), U = usable(o), L = layout(o), warnings = [], parts = [], placed = [];
    if (o.drawerW < 60 || o.drawerD < 60) warnings.push('Enter a drawer at least 60 mm on each side.');
    if (L.tiles.length > 40) warnings.push('That is a very large mat. It may take a while to build.');
    if (o.material === 'tpu') warnings.push('Print in TPU (95A works well) for a snug, quiet mat that stays put.');
    else warnings.push('Rigid mode: joints are a little looser and have flexure slots so PLA or PETG can snap together. TPU still fits better.');

    for (const t of L.tiles) {
      const mesh = buildTile(t, o, M, L), sz = sizeOf(mesh.local);
      const fits = fitsBed(sz, U) && sz[2] <= U.z + 0.05;
      if (!fits) warnings.push(`${tileName(t, L.cols.length, L.rows.length)} (${Math.round(sz[0])} \u00d7 ${Math.round(sz[1])} mm) is bigger than your bed.`);
      const pt = {
        kind: 'tile', name: tileName(t, L.cols.length, L.rows.length), local: mesh.local,
        base: mesh.base, pattern: mesh.pattern, chips: mesh.chips,
        count: 1, color: o.baseColor, patternColor: o.patternColor, chipColor: o.chipColor,
        size: sz, fits, tile: t
      };
      parts.push(pt);
      placed.push({ p: move(mesh.base, t.x, t.y, 0), color: o.baseColor, name: pt.name, kind: 'tile' });
      if (mesh.pattern && mesh.pattern.length) placed.push({ p: move(mesh.pattern, t.x, t.y, 0), color: o.patternColor, name: pt.name + ' pattern', kind: 'pattern' });
      if (mesh.chips && mesh.chips.length) placed.push({ p: move(mesh.chips, t.x, t.y, 0), color: o.chipColor, name: pt.name + ' chips', kind: 'chips' });
    }
    let vol = 0; for (const pt of parts) vol += Math.abs(C.signedVolume(pt.local)) * pt.count;
    const density = o.material === 'tpu' ? 1.21 : 1.24;
    const stats = {
      tiles: parts.length, cols: L.cols.length, rows: L.rows.length,
      width: +L.W.toFixed(2), depth: +L.D.toFixed(2),
      drawerW: o.drawerW, drawerD: o.drawerD, shrink: L.material.shrink,
      thickness: +(o.thickness + o.relief).toFixed(2),
      pattern: o.pattern, material: o.material,
      grams: Math.round(vol / 1000 * density),
      tris: parts.reduce((s, p) => s + p.local.length / 9, 0),
      joint: L.joint.depth, clearance: L.joint.clearance
    };
    return { options: o, layout: L, parts, placed, stats, warnings };
  }

  function gateInfo(raw) {
    const o = options(raw), L = layout(o), reasons = [];
    if (o.drawerW > FREE.maxW) reasons.push(`a drawer wider than ${FREE.maxW} mm`);
    if (o.drawerD > FREE.maxD) reasons.push(`a drawer deeper than ${FREE.maxD} mm`);
    if (L.tiles.length > FREE.maxTiles) reasons.push(`${L.tiles.length} tiles (free: up to ${FREE.maxTiles})`);
    return { pro: reasons.length > 0, reasons, tiles: L.tiles.length, drawerW: o.drawerW, drawerD: o.drawerD };
  }

  function printList(res) {
    const out = [];
    for (const pt of res.parts) {
      const parts = [{ name: pt.name, p: pt.base, color: pt.color }];
      if (pt.pattern && pt.pattern.length) parts.push({ name: pt.name + ' pattern', p: pt.pattern, color: pt.patternColor });
      if (pt.chips && pt.chips.length) parts.push({ name: pt.name + ' chips', p: pt.chips, color: pt.chipColor });
      out.push({ name: pt.name, p: pt.local, color: pt.color, parts });
    }
    return out;
  }
  function applyPlace(p, b, rot, x, y) {
    let q = move(p, -b.min[0], -b.min[1], -b.min[2]);
    if (rot) q = PL.turn(q);
    return PL.move(q, x, y);
  }
  function arrangePlates(res) {
    const U = usable(res.options), src = printList(res);
    const A = PL.arrange(src.map(it => ({ name: it.name, p: it.p, color: it.color, _parts: it.parts })), U.w, U.d, { gap: 4, maxZ: U.z });
    for (const list of A.plates) for (const it of list) {
      const srcIt = src.find(s => s.name === it.name && !s._used);
      if (srcIt) srcIt._used = true;
      const parts = (srcIt || it)._parts || it._parts;
      if (!parts) continue;
      const b = C.bbox((srcIt || it).p || it.p);
      // arranged item already normalized from its p; use original bbox of the union
      const orig = srcIt || { p: it.p };
      const bb = C.bbox(orig.p);
      it.parts = parts.map(q => ({ name: q.name, p: applyPlace(q.p, bb, it.rot, it.x, it.y), color: q.color }));
    }
    return A;
  }
  function filaments(res) {
    const cols = [];
    const add = c => { if (c && !cols.includes(c)) cols.push(c); };
    add(res.options.baseColor); add(res.options.patternColor);
    if (res.options.pattern === 'terrazzo') add(res.options.chipColor);
    return cols.map(c => ({ color: c }));
  }
  function export3MF(res, o) {
    o = o || {};
    const cols = filaments(res).map(f => f.color);
    const A = arrangePlates(res), objs = [], plates = [];
    A.plates.forEach(list => {
      const ids = [];
      list.forEach(it => {
        const bits = it.parts && it.parts.length ? it.parts : [{ name: it.name, p: it.p, color: it.color }];
        bits.forEach(q => {
          ids.push(objs.length);
          objs.push({ name: q.name, p: q.p, color: q.color, extruder: cols.indexOf(q.color) + 1 });
        });
      });
      plates.push(ids);
    });
    A.unfit.forEach(u => {
      const bits = u._parts || [{ name: u.name, p: PL.normalize(u.p), color: u.color }];
      const ids = [];
      bits.forEach(q => { ids.push(objs.length); objs.push({ name: q.name, p: q.p, color: q.color, extruder: cols.indexOf(q.color) + 1 }); });
      plates.push(ids);
    });
    return T.threeMF(objs, { title: o.name || 'Fitted drawer mat', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const o = res.options, st = res.stats, L = ['Expressarte fitted drawer mat', ''];
    L.push(`Drawer inside ${o.drawerW} \u00d7 ${o.drawerD} mm. Assembled mat ${st.width} \u00d7 ${st.depth} mm (${st.cols} \u00d7 ${st.rows} tiles), ${st.thickness} mm thick, ${PATTERNS.find(p => p.id === o.pattern).label.toLowerCase()} pattern.`);
    L.push(`Material: ${o.material === 'tpu' ? 'TPU (recommended). Joint clearance ' + st.clearance + ' mm.' : 'Rigid plastic mode. Looser joints (' + st.clearance + ' mm) with flexure slots so PLA or PETG can snap.'} Shrink ${st.shrink} mm total so the mat drops in cleanly.`);
    L.push('', 'Print these');
    for (const pt of res.parts) L.push(`  ${pt.name}  ${pt.color}${pt.pattern && pt.pattern.length ? ' / ' + pt.patternColor : ''}  ${Math.round(pt.size[0])} \u00d7 ${Math.round(pt.size[1])} \u00d7 ${pt.size[2].toFixed(1)} mm`);
    L.push('', 'Printing');
    if (o.material === 'tpu') L.push('  - Print in TPU (95A works well), flat as exported, no supports. 0.2 mm layers, 2-3 walls, 10-20% infill, a brim if the first layer curls.');
    else L.push('  - Print flat as exported, no supports. 0.2 mm layers, 3 walls, 15% infill. PLA or PETG both work; TPU still holds a tighter, quieter fit.');
    L.push('  - Tiles snap together along the dovetail edges. The joint locks the tiles in plane so the mat stays flat. Start from one corner and work across.');
    L.push('  - Each color is its own filament in the 3MF. The pattern sits on top of the base; print them together on the same plate.');
    if (res.warnings.length) { L.push('', 'Notes'); res.warnings.forEach(w => L.push('  - ' + w)); }
    return L.join('\n');
  }
  function files(res, o) {
    o = o || {}; const base = o.fileBase || 'drawer_mat', out = [], slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    for (const pt of res.parts) out.push({ name: `${base}_${slug(pt.name)}.stl`, data: new Uint8Array(C.writeSTL(pt.local, pt.name)) });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }

  const api = { PATTERNS, PALETTE, FREE, DEFAULTS, options, materialSpec, jointSpec, usable, layout, splitLength, runs, tabStations, tileOutline, buildTile, build, gateInfo, printList, arrangePlates, export3MF, notes, files, filaments };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPDrawerMat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
