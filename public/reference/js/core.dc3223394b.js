/* Expressarte geometry core: STL I/O, planar grid cutting with capping, hollowing,
   and cap-surface joinery (pegs, dowels, snap clips, dovetail slides, magnets).
   Pure JS; needs earcut. Works in the browser (global SplitCore) and in Node. */
(function (G) {
  'use strict';
  const earcut = G.earcut || (typeof require === 'function' ? require('earcut') : null);

  // ---------------------------------------------------------------- STL I/O
  function parseSTL(buf) {
    const dv = new DataView(buf);
    let binary = false;
    if (buf.byteLength >= 84) {
      const n = dv.getUint32(80, true);
      if (84 + n * 50 === buf.byteLength) binary = true;
    }
    if (!binary) {
      const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 2048)));
      if (!(/^\s*solid/i.test(head) && /facet|vertex/i.test(head))) binary = buf.byteLength >= 84;
    }
    if (binary) {
      const n = dv.getUint32(80, true);
      const cnt = Math.min(n, Math.floor((buf.byteLength - 84) / 50));
      const out = new Float64Array(cnt * 9);
      let o = 84;
      for (let i = 0; i < cnt; i++) {
        o += 12;
        for (let k = 0; k < 9; k++) { out[i * 9 + k] = dv.getFloat32(o, true); o += 4; }
        o += 2;
      }
      return out;
    }
    const text = new TextDecoder().decode(new Uint8Array(buf));
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
    const arr = []; let m;
    while ((m = re.exec(text))) arr.push(+m[1], +m[2], +m[3]);
    return new Float64Array(arr.slice(0, arr.length - (arr.length % 9)));
  }

  // Corners that checkClosed treats as one point (same 1e-5 key) are written with identical float32 values, and
  // triangles that collapse (two corners on one point) are dropped, so a part that is watertight here is
  // watertight in the file too. Before, 149.999999999999 and 150 or 1e-12 and 0 became different float32 values.
  function writeSTL(p, name) {
    const { V, F } = weld(p);
    const V32 = Float32Array.from(V);
    const same = (a, b) => a === b || (V32[a * 3] === V32[b * 3] && V32[a * 3 + 1] === V32[b * 3 + 1] && V32[a * 3 + 2] === V32[b * 3 + 2]);
    const keep = [];
    for (let i = 0; i < F.length; i += 3) { const a = F[i], b = F[i + 1], c = F[i + 2]; if (!same(a, b) && !same(b, c) && !same(a, c)) keep.push(i); }
    const n = keep.length;
    const buf = new ArrayBuffer(84 + n * 50);
    const dv = new DataView(buf);
    const hdr = ('Expressarte ' + (name || '')).slice(0, 79);
    for (let i = 0; i < hdr.length; i++) dv.setUint8(i, hdr.charCodeAt(i) & 127);
    dv.setUint32(80, n, true);
    let o = 84;
    for (const i of keep) {
      const b = i * 3;
      const ux = p[b + 3] - p[b], uy = p[b + 4] - p[b + 1], uz = p[b + 5] - p[b + 2];
      const vx = p[b + 6] - p[b], vy = p[b + 7] - p[b + 1], vz = p[b + 8] - p[b + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
      o += 12;
      for (let k = 0; k < 3; k++) { const v = F[i + k] * 3; dv.setFloat32(o, V32[v], true); dv.setFloat32(o + 4, V32[v + 1], true); dv.setFloat32(o + 8, V32[v + 2], true); o += 12; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  // ---------------------------------------------------------------- helpers
  const Q = 1e5;
  const k3 = (x, y, z) => Math.round(x * Q) + ',' + Math.round(y * Q) + ',' + Math.round(z * Q);
  const k2 = (u, w) => Math.round(u * Q) + ',' + Math.round(w * Q);

  function bbox(p) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) {
      for (let a = 0; a < 3; a++) { const v = p[i + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
    }
    return { min: mn, max: mx };
  }

  function signedVolume(p) {
    let v = 0;
    for (let i = 0; i < p.length; i += 9) {
      const ax = p[i], ay = p[i + 1], az = p[i + 2], bx = p[i + 3], by = p[i + 4], bz = p[i + 5], cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];
      v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    }
    return v / 6;
  }

  function flip(p) {
    const o = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 9) {
      o[i] = p[i]; o[i + 1] = p[i + 1]; o[i + 2] = p[i + 2];
      o[i + 3] = p[i + 6]; o[i + 4] = p[i + 7]; o[i + 5] = p[i + 8];
      o[i + 6] = p[i + 3]; o[i + 7] = p[i + 4]; o[i + 8] = p[i + 5];
    }
    return o;
  }

  // Directed-edge check: every edge a->b must have exactly one b->a.
  function checkClosed(p) {
    const m = new Map();
    const n = p.length / 9;
    const keys = new Array(3);
    for (let i = 0; i < n; i++) {
      const b = i * 9;
      keys[0] = k3(p[b], p[b + 1], p[b + 2]); keys[1] = k3(p[b + 3], p[b + 4], p[b + 5]); keys[2] = k3(p[b + 6], p[b + 7], p[b + 8]);
      if (keys[0] === keys[1] || keys[1] === keys[2] || keys[0] === keys[2]) continue; // degenerate
      for (let e = 0; e < 3; e++) {
        const a = keys[e], c = keys[(e + 1) % 3];
        const rev = c + '|' + a;
        const r = m.get(rev);
        if (r) { if (r === 1) m.delete(rev); else m.set(rev, r - 1); }
        else { const f = a + '|' + c; m.set(f, (m.get(f) || 0) + 1); }
      }
    }
    let open = 0; for (const v of m.values()) open += v;
    return { open, closed: open === 0 };
  }

  // Drop zero-area / repeated-vertex triangles (common in exported STLs).
  function clean(p) {
    const out = [];
    for (let b = 0; b < p.length; b += 9) {
      const A = k3(p[b], p[b + 1], p[b + 2]), B = k3(p[b + 3], p[b + 4], p[b + 5]), C = k3(p[b + 6], p[b + 7], p[b + 8]);
      if (A === B || B === C || A === C) continue;
      for (let k = 0; k < 9; k++) out.push(p[b + k]);
    }
    return Float64Array.from(out);
  }

  // uv frame for a plane perpendicular to axis a (right-handed: u x w = +a)
  const UA = [1, 2, 0], WA = [2, 0, 1];
  function to3(a, v, u, w, out, o) {
    out[o + a] = v; out[o + UA[a]] = u; out[o + WA[a]] = w;
  }

  function polyArea(pts) {
    let s = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]);
    return s / 2;
  }
  function pip(pt, pts) {
    let c = false; const x = pt[0], y = pt[1];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }

  // Join directed segments [[u1,w1,u2,w2],...] into closed loops.
  function joinLoops(segs) {
    const byStart = new Map();
    const used = new Uint8Array(segs.length);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]; const k = k2(s[0], s[1]);
      if (k === k2(s[2], s[3])) { used[i] = 1; continue; } // zero-length

      let l = byStart.get(k); if (!l) { l = []; byStart.set(k, l); } l.push(i);
    }
    const loops = []; let broken = 0;
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      const loop = []; let cur = i; const startKey = k2(segs[i][0], segs[i][1]);
      let ok = false;
      for (let guard = 0; guard < segs.length + 2; guard++) {
        used[cur] = 1; const s = segs[cur];
        loop.push([s[0], s[1]]);
        const ek = k2(s[2], s[3]);
        if (ek === startKey) { ok = true; break; }
        const l = byStart.get(ek); let nxt = -1;
        if (l) for (const j of l) if (!used[j]) { nxt = j; break; }
        if (nxt < 0) break;
        cur = nxt;
      }
      if (ok && loop.length >= 3) loops.push(loop); else broken++;
    }
    return { loops, broken };
  }

  // Remove consecutive duplicates; group loops into polygons with holes by nesting parity.
  // With `oriented` (loops traced from a closed mesh, so solid is on one fixed side), a loop wound like the outer
  // boundary is solid even where nesting parity says hole: a self-overlapping model has material inside material,
  // and punching that out as a hole left the cut part open. Then holes go to the smallest outer around them.
  function loopsToPolys(loops, oriented) {
    const L = [];
    for (const lp of loops) {
      const c = [];
      for (const p of lp) { const q = c[c.length - 1]; if (!q || Math.abs(q[0] - p[0]) > 1e-9 || Math.abs(q[1] - p[1]) > 1e-9) c.push(p); }
      if (c.length > 1) { const a = c[0], b = c[c.length - 1]; if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) c.pop(); }
      if (c.length >= 3) { const ar = polyArea(c); if (Math.abs(ar) > 1e-8) L.push({ pts: c, area: Math.abs(ar), sgn: Math.sign(ar), depth: 0, parent: -1 }); }
    }
    L.sort((x, y) => y.area - x.area);
    for (let i = 0; i < L.length; i++) {
      let best = -1;
      for (let j = 0; j < i; j++) if (L[j].area > L[i].area && pip(L[i].pts[0], L[j].pts)) { if (best < 0 || L[j].area < L[best].area) best = j; }
      L[i].parent = best; L[i].depth = best < 0 ? 0 : L[best].depth + 1;
    }
    if (oriented && L.length > 1 && L.some(l => (l.depth % 2 === 0) !== (l.sgn === L[0].sgn))) {
      const ref = L[0].sgn, polys = [], idx = new Map(), host = new Array(L.length).fill(-1);
      // a hole is a loop wound against the largest one with an outer-wound loop around it; anything else is solid
      for (let i = 0; i < L.length; i++) {
        if (L[i].sgn === ref) continue;
        for (let j = 0; j < i; j++) if (L[j].sgn === ref && L[j].area > L[i].area && pip(L[i].pts[0], L[j].pts) && (host[i] < 0 || L[j].area < L[host[i]].area)) host[i] = j;
      }
      // an outer wound backwards (an inside-out sliver of a self-overlapping model) is capped facing the other way (inv)
      for (let i = 0; i < L.length; i++) if (host[i] < 0) { idx.set(i, polys.length); polys.push({ outer: L[i].pts, holes: [], area: L[i].area, inv: L[i].sgn !== ref }); }
      for (let i = 0; i < L.length; i++) if (host[i] >= 0) { const P = polys[idx.get(host[i])]; P.holes.push(L[i].pts); P.area -= L[i].area; }
      return polys;
    }
    const polys = []; const idx = new Map();
    for (let i = 0; i < L.length; i++) if (L[i].depth % 2 === 0) { idx.set(i, polys.length); polys.push({ outer: L[i].pts, holes: [], area: L[i].area }); }
    for (let i = 0; i < L.length; i++) if (L[i].depth % 2 === 1 && idx.has(L[i].parent)) { const P = polys[idx.get(L[i].parent)]; P.holes.push(L[i].pts); P.area -= L[i].area; }
    return polys;
  }

  // earcut drops exactly-collinear boundary points; put them back by fanning the
  // triangle that spans them, so cap edges match the neighbouring walls exactly.
  function restoreCollinear(tri, ringStarts) {
    const used = new Uint8Array(ringStarts[ringStarts.length - 1]);
    for (const i of tri) used[i] = 1;
    let missing = false; for (let i = 0; i < used.length; i++) if (!used[i]) { missing = true; break; }
    if (!missing) return tri;
    const T = []; for (let i = 0; i < tri.length; i += 3) T.push([tri[i], tri[i + 1], tri[i + 2]]);
    for (let r = 0; r + 1 < ringStarts.length; r++) {
      const s = ringStarts[r], e = ringStarts[r + 1], n = e - s;
      if (n < 3) continue;
      let start = -1; for (let i = s; i < e; i++) if (used[i]) { start = i; break; }
      if (start < 0) continue;
      let k = 0;
      while (k < n) {
        const ia = s + ((start - s + k) % n);
        const chain = []; let j = 1;
        while (j <= n && !used[s + ((ia - s + j) % n)]) { chain.push(s + ((ia - s + j) % n)); j++; }
        const ib = s + ((ia - s + j) % n);
        if (chain.length) {
          let found = false;
          for (let t = 0; t < T.length && !found; t++) {
            const q = T[t];
            for (let e2 = 0; e2 < 3; e2++) {
              const x = q[e2], y = q[(e2 + 1) % 3], c = q[(e2 + 2) % 3];
              let seq = null;
              if (x === ia && y === ib) seq = [ia, ...chain, ib];
              else if (x === ib && y === ia) seq = [ib, ...chain.slice().reverse(), ia];
              if (!seq) continue;
              T.splice(t, 1);
              for (let m = 0; m + 1 < seq.length; m++) T.push([seq[m], seq[m + 1], c]);
              for (const ci of chain) used[ci] = 1;
              found = true; break;
            }
          }
        }
        k += j;
      }
    }
    const out = []; for (const q of T) out.push(q[0], q[1], q[2]);
    return out;
  }

  // Make a cap edge-consistent with its rings. Triangles are first oriented by their own area, which is right for a
  // simple ring; but a ring that crosses itself (a self-overlapping sliver of the model) has a lobe wound the other
  // way, and its triangles then ran the same way as the walls beside them, leaving open edges. When the caller knows
  // which way the rings run relative to the cap (want: true = triangles use ring edges in ring order), triangles on
  // a ring edge follow that and the rest follow their neighbours across shared edges. Simple rings are unchanged.
  function orientToRings(tris, ringStarts, want) {
    if (!tris.length) return;
    const ring = new Map(); // "i>j" for each ring edge in ring order
    for (let r = 0; r + 1 < ringStarts.length; r++) { const s = ringStarts[r], n = ringStarts[r + 1] - s; for (let k = 0; k < n; k++) ring.set(s + k + '>' + (s + (k + 1) % n), 1); }
    let fwd = 0, back = 0;
    for (const t of tris) for (let e = 0; e < 3; e++) { const x = t[e], y = t[(e + 1) % 3]; if (ring.has(x + '>' + y)) fwd++; else if (ring.has(y + '>' + x)) back++; }
    if (want ? !back : !fwd) return; // already consistent (the usual case)
    const flip = t => { const q = t[1]; t[1] = t[2]; t[2] = q; };
    const done = new Uint8Array(tris.length), queue = [];
    tris.forEach((t, i) => {
      for (let e = 0; e < 3; e++) { const x = t[e], y = t[(e + 1) % 3];
        const f = ring.has(x + '>' + y), b = ring.has(y + '>' + x); if (!f && !b) continue;
        if (f !== want) flip(t); done[i] = 1; queue.push(i); break; }
    });
    const byEdge = new Map(); // undirected edge -> triangles
    tris.forEach((t, i) => { for (let e = 0; e < 3; e++) { const x = t[e], y = t[(e + 1) % 3], k = x < y ? x + ',' + y : y + ',' + x; let l = byEdge.get(k); if (!l) byEdge.set(k, l = []); l.push(i); } });
    while (queue.length) {
      const i = queue.shift(), t = tris[i];
      for (let e = 0; e < 3; e++) { const x = t[e], y = t[(e + 1) % 3];
        for (const j of byEdge.get(x < y ? x + ',' + y : y + ',' + x)) { if (done[j]) continue;
          const u = tris[j]; let same = false; for (let g = 0; g < 3; g++) if (u[g] === x && u[(g + 1) % 3] === y) same = true;
          if (same) flip(u); done[j] = 1; queue.push(j); } }
    }
  }

  // Does a cap over one ring of n points use every ring edge once in the wanted direction, and every other edge
  // once each way?
  function capResidual(tris, ringStarts, want) { // ring edges (as the cap should use them) the cap doesn't cover: x>y -> count
    const cnt = new Map();
    const add = (x, y, d) => { const k = x + '>' + y; cnt.set(k, (cnt.get(k) || 0) + d); };
    for (const t of tris) for (let e = 0; e < 3; e++) { const x = t[e], y = t[(e + 1) % 3]; add(x, y, -1); add(y, x, 1); }
    for (let r = 0; r + 1 < ringStarts.length; r++) {
      const s = ringStarts[r], n = ringStarts[r + 1] - s;
      for (let k = 0; k < n; k++) { const x = s + k, y = s + (k + 1) % n; if (want) { add(x, y, 1); add(y, x, -1); } else { add(y, x, 1); add(x, y, -1); } }
    }
    const res = []; for (const [k, c] of cnt) if (c > 0) { const [x, y] = k.split('>').map(Number); for (let i = 0; i < c; i++) res.push([x, y]); }
    return res;
  }
  const capCloses = (tris, ringStarts, want) => !capResidual(tris, ringStarts, want).length;
  // Close what earcut left uncovered (a dropped sliver triangle, a lobe of a ring that crosses itself): walk the
  // uncovered edges into loops and fan each, so the cap's boundary is exactly its ring.
  function patchCap(tris, ringStarts, want) {
    const res = capResidual(tris, ringStarts, want); if (!res.length) return;
    const from = new Map(); res.forEach((e, i) => { let l = from.get(e[0]); if (!l) from.set(e[0], l = []); l.push(i); });
    const used = new Uint8Array(res.length);
    for (let i = 0; i < res.length; i++) {
      if (used[i]) continue;
      const loop = []; let cur = i;
      for (let g = 0; g <= res.length; g++) {
        used[cur] = 1; loop.push(res[cur][0]);
        if (res[cur][1] === res[i][0]) break;
        const l = from.get(res[cur][1]); let nx = -1; if (l) for (const j of l) if (!used[j]) { nx = j; break; }
        if (nx < 0) { loop.length = 0; break; }
        cur = nx;
      }
      for (let k = 1; k + 1 < loop.length; k++) tris.push([loop[0], loop[k], loop[k + 1]]);
    }
  }

  // Triangulate polygons into 3D triangles on plane (a,v) facing sign*axis.
  function triangulatePolys(polys, a, v, sign, outP, outT, tag, ringDir) {
    const tmp = new Float64Array(9);
    for (const P of polys) {
      const flat = []; const holes = [];
      for (const q of P.outer) flat.push(q[0], q[1]);
      for (const h of P.holes) { holes.push(flat.length / 2); for (const q of h) flat.push(q[0], q[1]); }
      const tri = restoreCollinear(earcut(flat, holes.length ? holes : null, 2), [0, ...holes, flat.length / 2]);
      // Orient triangles; zero-area ones (collinear boundary points) are kept and
      // oriented to match their neighbours so the cap stays edge-connected.
      const edges = new Set(); const good = []; const degen = [];
      for (let i = 0; i < tri.length; i += 3) {
        let i0 = tri[i], i1 = tri[i + 1], i2 = tri[i + 2];
        const ar = (flat[i1 * 2] - flat[i0 * 2]) * (flat[i2 * 2 + 1] - flat[i0 * 2 + 1]) - (flat[i2 * 2] - flat[i0 * 2]) * (flat[i1 * 2 + 1] - flat[i0 * 2 + 1]);
        if (ar === 0) { degen.push([i0, i1, i2]); continue; }
        if ((ar > 0) !== ((P.inv ? -sign : sign) > 0)) { const t = i1; i1 = i2; i2 = t; }
        good.push([i0, i1, i2]); edges.add(i0 + '>' + i1).add(i1 + '>' + i2).add(i2 + '>' + i0);
      }
      for (let pass = 0; pass < 3 && degen.length; pass++) {
        for (let k = degen.length - 1; k >= 0; k--) {
          const [i0, i1, i2] = degen[k];
          const f = +edges.has(i1 + '>' + i0) + +edges.has(i2 + '>' + i1) + +edges.has(i0 + '>' + i2);
          const b = +edges.has(i2 + '>' + i0) + +edges.has(i1 + '>' + i2) + +edges.has(i0 + '>' + i1);
          if (!f && !b && pass < 2) continue;
          const t = f >= b ? [i0, i1, i2] : [i0, i2, i1];
          good.push(t); edges.add(t[0] + '>' + t[1]).add(t[1] + '>' + t[2]).add(t[2] + '>' + t[0]);
          degen.splice(k, 1);
        }
      }
      if (ringDir) {
        // the cap must use each ring edge once, against the wall beside it; when earcut's doesn't (a cut through a
        // self-overlapping sliver gives a ring that crosses itself), re-orient it from the ring edges, then close
        // whatever is still uncovered
        const rs = [0, ...holes, flat.length / 2], want = ringDir > 0;
        if (!capCloses(good, rs, want)) {
          const orig = good.map(t => t.slice());
          orientToRings(good, rs, want);
          if (!capCloses(good, rs, want)) { good.length = 0; good.push(...orig); patchCap(good, rs, want); }
        }
      }
      for (const [i0, i1, i2] of good) {
        to3(a, v, flat[i0 * 2], flat[i0 * 2 + 1], tmp, 0);
        to3(a, v, flat[i1 * 2], flat[i1 * 2 + 1], tmp, 3);
        to3(a, v, flat[i2 * 2], flat[i2 * 2 + 1], tmp, 6);
        for (let k = 0; k < 9; k++) outP.push(tmp[k]);
        outT.push(tag);
      }
    }
  }

  // ---------------------------------------------------------------- plane cut
  function nudgePlane(p, a, v) {
    for (let it = 0; it < 60; it++) {
      let bad = false;
      for (let i = a; i < p.length; i += 3) if (Math.abs(p[i] - v) < 1e-5) { bad = true; break; }
      if (!bad) return v;
      v += 1.37e-4;
    }
    return v;
  }

  // mesh = {p: number[] (9/tri), t: number[] (tag/tri)}. Returns {neg, pos} closed meshes.
  // select(poly) (optional): only the chosen cross-sections get caps; the rest stay open for cutFree to re-join.
  // rawCaps: keep earcut's caps as they come (the cavity clip: an offset surface can fold over itself, and its caps are
  // rebuilt from regions later)
  function cutPlane(mesh, a, v, tagNeg, tagPos, select, rawCaps) {
    const P = mesh.p, T = mesh.t, n = T.length;
    const neg = { p: [], t: [] }, pos = { p: [], t: [] };
    const segs = [];
    const V = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], d = [0, 0, 0];
    const inter = (A, dA, B, dB) => {
      // canonical: from the negative endpoint to the positive endpoint
      let N = A, dn = dA, Pp = B, dp = dB;
      if (dA > 0) { N = B; dn = dB; Pp = A; dp = dA; }
      const t = dn / (dn - dp);
      const r = [N[0] + t * (Pp[0] - N[0]), N[1] + t * (Pp[1] - N[1]), N[2] + t * (Pp[2] - N[2])];
      r[a] = v; return r;
    };
    const push = (m, A, B, C, tag) => { m.p.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]); m.t.push(tag); };
    for (let i = 0; i < n; i++) {
      const b = i * 9;
      for (let k = 0; k < 3; k++) { V[k] = [P[b + k * 3], P[b + k * 3 + 1], P[b + k * 3 + 2]]; d[k] = V[k][a] - v; if (d[k] === 0) d[k] = 1e-12; }
      const s0 = d[0] > 0, s1 = d[1] > 0, s2 = d[2] > 0;
      if (s0 === s1 && s1 === s2) { const m = s0 ? pos : neg; for (let k = 0; k < 9; k++) m.p.push(P[b + k]); m.t.push(T[i]); continue; }
      let L; if (s0 !== s1 && s0 !== s2) L = 0; else if (s1 !== s0 && s1 !== s2) L = 1; else L = 2;
      const A = V[L], B = V[(L + 1) % 3], C = V[(L + 2) % 3];
      const dA = d[L], dB = d[(L + 1) % 3], dC = d[(L + 2) % 3];
      const pAB = inter(A, dA, B, dB), pAC = inter(A, dA, C, dC);
      const lone = dA > 0 ? pos : neg, other = dA > 0 ? neg : pos;
      push(lone, A, pAB, pAC, T[i]);
      push(other, pAB, B, C, T[i]);
      push(other, pAB, C, pAC, T[i]);
      const u1 = pAB[UA[a]], w1 = pAB[WA[a]], u2 = pAC[UA[a]], w2 = pAC[WA[a]];
      // boundary of the negative half runs pAC->pAB when A is negative, pAB->pAC otherwise; cap edge is reversed
      if (dA < 0) segs.push([u1, w1, u2, w2]); else segs.push([u2, w2, u1, w1]);
    }
    const { loops, broken } = joinLoops(segs);
    const polys = loopsToPolys(loops, true);
    const capped = select ? polys.filter(select) : polys;
    // segs run against the negative cap's edges (the cap faces away from its wall), so it uses ring edges backward
    triangulatePolys(capped, a, v, +1, neg.p, neg.t, tagNeg, rawCaps ? 0 : -1);
    triangulatePolys(capped, a, v, -1, pos.p, pos.t, tagPos, rawCaps ? 0 : +1);
    return { neg, pos, broken, polys, capped };
  }

  // Boundary polygons of the cap triangles carrying `tag`.
  function capPolys(mesh, tag, a) {
    const P = mesh.p, T = mesh.t;
    const m = new Map();
    for (let i = 0; i < T.length; i++) {
      if (T[i] !== tag) continue;
      const b = i * 9;
      const pts = [[P[b + UA[a]], P[b + WA[a]]], [P[b + 3 + UA[a]], P[b + 3 + WA[a]]], [P[b + 6 + UA[a]], P[b + 6 + WA[a]]]];
      for (let e = 0; e < 3; e++) {
        const s = pts[e], t = pts[(e + 1) % 3];
        const ks = k2(s[0], s[1]), kt = k2(t[0], t[1]);
        if (ks === kt) continue;
        const rk = kt + '|' + ks;
        if (m.has(rk)) m.delete(rk); else m.set(ks + '|' + kt, [s[0], s[1], t[0], t[1]]);
      }
    }
    const { loops } = joinLoops([...m.values()]);
    const polys = loopsToPolys(loops, true);
    for (const P of polys) P.ring = true; // rings run along the cap triangles' own edges
    return polys;
  }

  function removeTag(mesh, tag) {
    const p = [], t = [];
    for (let i = 0; i < mesh.t.length; i++) {
      if (mesh.t[i] === tag) continue;
      const b = i * 9; for (let k = 0; k < 9; k++) p.push(mesh.p[b + k]); t.push(mesh.t[i]);
    }
    mesh.p = p; mesh.t = t;
  }

  // ---------------------------------------------------------------- BVH (ray queries)
  function buildBVH(p) {
    const n = p.length / 9;
    const idx = new Int32Array(n);
    const cen = new Float64Array(n * 3), bmin = new Float64Array(n * 3), bmax = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) {
      idx[i] = i; const b = i * 9;
      for (let a = 0; a < 3; a++) {
        const x = p[b + a], y = p[b + 3 + a], z = p[b + 6 + a];
        bmin[i * 3 + a] = Math.min(x, y, z); bmax[i * 3 + a] = Math.max(x, y, z); cen[i * 3 + a] = (x + y + z) / 3;
      }
    }
    const nodes = []; // {mn,mx,l,r,s,e}
    function build(s, e) {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = s; i < e; i++) { const t = idx[i]; for (let a = 0; a < 3; a++) { if (bmin[t * 3 + a] < mn[a]) mn[a] = bmin[t * 3 + a]; if (bmax[t * 3 + a] > mx[a]) mx[a] = bmax[t * 3 + a]; } }
      const node = { mn, mx, l: -1, r: -1, s, e }; const id = nodes.length; nodes.push(node);
      if (e - s <= 6) return id;
      let ax = 0; const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]]; if (ext[1] > ext[ax]) ax = 1; if (ext[2] > ext[ax]) ax = 2;
      const sub = Array.from(idx.subarray(s, e)); sub.sort((x, y) => cen[x * 3 + ax] - cen[y * 3 + ax]);
      for (let i = 0; i < sub.length; i++) idx[s + i] = sub[i];
      const mid = (s + e) >> 1;
      node.l = build(s, mid); node.r = build(mid, e);
      return id;
    }
    if (n) build(0, n);
    return { p, idx, nodes };
  }
  function rayBox(o, inv, mn, mx, tmax) {
    let t0 = 0, t1 = tmax;
    for (let a = 0; a < 3; a++) {
      let ta = (mn[a] - o[a]) * inv[a], tb = (mx[a] - o[a]) * inv[a];
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return false;
    }
    return true;
  }
  function rayTri(p, b, o, d) {
    const e1x = p[b + 3] - p[b], e1y = p[b + 4] - p[b + 1], e1z = p[b + 5] - p[b + 2];
    const e2x = p[b + 6] - p[b], e2y = p[b + 7] - p[b + 1], e2z = p[b + 8] - p[b + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-14) return -1;
    const inv = 1 / det;
    const tx = o[0] - p[b], ty = o[1] - p[b + 1], tz = o[2] - p[b + 2];
    const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) return -1;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const w = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (w < 0 || u + w > 1) return -1;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return t;
  }
  function rayQuery(bvh, o, d, nearest, tmin) {
    const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
    let best = Infinity, count = 0;
    const st = bvh.nodes.length ? [0] : [];
    while (st.length) {
      const nd = bvh.nodes[st.pop()];
      if (!rayBox(o, inv, nd.mn, nd.mx, nearest ? best : Infinity)) continue;
      if (nd.l < 0) {
        for (let i = nd.s; i < nd.e; i++) {
          const t = rayTri(bvh.p, bvh.idx[i] * 9, o, d);
          if (t > tmin) { count++; if (t < best) best = t; }
        }
      } else { st.push(nd.l, nd.r); }
    }
    return nearest ? best : count;
  }
  const RD = (() => { const v = [0.5772, 0.5781, 0.5765]; const l = Math.hypot(...v); return v.map(x => x / l); })();
  function inside(bvh, pt) { return (rayQuery(bvh, pt, RD, false, 0) & 1) === 1; }

  // ---------------------------------------------------------------- weld + hollow
  function weld(p) {
    const map = new Map(); const V = []; const F = new Int32Array(p.length / 3);
    for (let i = 0; i < p.length / 3; i++) {
      const k = k3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      let id = map.get(k);
      if (id === undefined) { id = V.length / 3; map.set(k, id); V.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); }
      F[i] = id;
    }
    return { V: Float64Array.from(V), F };
  }

  // Merge vertices closer than tol (cut points a hair from a corner) and drop the triangles that collapse.
  // Returns { p, t } with the per-triangle tags kept.
  function snapClose(p, t, tol, only) {
    const inv = 1 / tol, cell = new Map(), rep = [], out = [], tags = [];
    const key = (x, y, z) => Math.floor(x * inv) + ',' + Math.floor(y * inv) + ',' + Math.floor(z * inv);
    const find = (x, y, z) => {
      const cx = Math.floor(x * inv), cy = Math.floor(y * inv), cz = Math.floor(z * inv);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const l = cell.get((cx + a) + ',' + (cy + b) + ',' + (cz + c)); if (!l) continue;
        for (const id of l) { const r = rep[id]; if (Math.abs(r[0] - x) <= tol && Math.abs(r[1] - y) <= tol && Math.abs(r[2] - z) <= tol) return id; }
      }
      const id = rep.length; rep.push([x, y, z]); const k = key(x, y, z); let l = cell.get(k); if (!l) { l = []; cell.set(k, l); } l.push(id); return id;
    };
    for (let i = 0; i < p.length; i += 9) {
      const pick = j => only && !only.has(k3(p[j], p[j + 1], p[j + 2])) ? -1 - j : find(p[j], p[j + 1], p[j + 2]);
      const ids = [pick(i), pick(i + 3), pick(i + 6)];
      if (only) { // vertices off the open edges keep their exact place
        if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
        for (let e = 0; e < 3; e++) { const id = ids[e]; if (id < 0) { const j = -1 - id; out.push(p[j], p[j + 1], p[j + 2]); } else out.push(rep[id][0], rep[id][1], rep[id][2]); }
        tags.push(t ? t[i / 9] : -1); continue;
      }
      if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
      for (const id of ids) out.push(rep[id][0], rep[id][1], rep[id][2]);
      tags.push(t ? t[i / 9] : -1);
    }
    return { p: out, t: tags };
  }

  // Try the hairline repairs in turn on an open piece; keep the first that closes it.
  function sealPiece(pc) {
    const ok = q => checkClosed(Float64Array.from(q.p)).closed;
    if (ok(pc)) return true;
    const a = dropSlivers(pc.p, pc.t, 0.02); if (ok(a)) { pc.p = a.p; pc.t = a.t; return true; }
    for (const tol of [1e-4, 1e-3]) { const r = fixTJunctions(pc.p, pc.t, tol); if (ok(r)) { pc.p = r.p; pc.t = r.t; return true; } const r2 = snapClose(r.p, r.t, 1e-4); if (ok(r2)) { pc.p = r2.p; pc.t = r2.t; return true; } }
    const openKeys = q => { const cnt = new Map(), P = q.p; for (let b = 0; b < P.length; b += 9) { const ks = [k3(P[b], P[b + 1], P[b + 2]), k3(P[b + 3], P[b + 4], P[b + 5]), k3(P[b + 6], P[b + 7], P[b + 8])]; for (let e = 0; e < 3; e++) { const k = ks[e] + '|' + ks[(e + 1) % 3]; cnt.set(k, (cnt.get(k) || 0) + 1); } }
      const s2 = new Set(); for (const [k, v] of cnt) { const [x, y] = k.split('|'); if (v > (cnt.get(y + '|' + x) || 0)) { s2.add(x); s2.add(y); } } return s2; };
    for (const tol of [1e-4, 5e-4]) { // first merge only the corners of the open edges
      const b = snapClose(pc.p, pc.t, tol, openKeys(pc)); if (ok(b)) { pc.p = b.p; pc.t = b.t; return true; }
      const c = dropSlivers(b.p, b.t, 0.02); if (ok(c)) { pc.p = c.p; pc.t = c.t; return true; }
    }
    for (const tol of [1e-5, 5e-5, 2e-4]) {
      const b = snapClose(pc.p, pc.t, tol);
      for (const r of [b, dropSlivers(b.p, b.t, 0.02), snapClose(a.p, a.t, tol)]) if (ok(r)) { pc.p = r.p; pc.t = r.t; return true; }
    }
    return false;
  }

  // Split a triangle whose open edge runs past corners of other open edges (a T-junction: one side of a seam
  // has the long edge, the other side has it in pieces). Returns { p, t }.
  function fixTJunctions(p, t, tol) {
    const nT = p.length / 9, kOf = (P, j) => k3(P[j], P[j + 1], P[j + 2]), cnt = new Map(), pos = new Map();
    for (let i = 0; i < nT; i++) for (let e = 0; e < 3; e++) { const a = kOf(p, i * 9 + e * 3), b = kOf(p, i * 9 + ((e + 1) % 3) * 3); const k = a + '|' + b; cnt.set(k, (cnt.get(k) || 0) + 1); }
    const isOpen = (a, b) => (cnt.get(a + '|' + b) || 0) > (cnt.get(b + '|' + a) || 0);
    for (const [k] of cnt) { const [a, b] = k.split('|'); if (isOpen(a, b)) { pos.set(a, null); pos.set(b, null); } }
    if (!pos.size) return { p, t };
    for (let j = 0; j < p.length; j += 3) { const k = kOf(p, j); if (pos.has(k) && !pos.get(k)) pos.set(k, [p[j], p[j + 1], p[j + 2]]); }
    const verts = [...pos.entries()];
    const out = [], tags = [];
    for (let i = 0; i < nT; i++) {
      const b = i * 9, V = [0, 1, 2].map(e => [p[b + e * 3], p[b + e * 3 + 1], p[b + e * 3 + 2]]), K = [0, 1, 2].map(e => kOf(p, b + e * 3));
      let done = false;
      for (let e = 0; e < 3 && !done; e++) {
        const a = V[e], c = V[(e + 1) % 3], o = V[(e + 2) % 3];
        if (!isOpen(K[e], K[(e + 1) % 3])) continue;
        const d = sub(c, a), L2 = dot(d, d); if (!L2) continue;
        const mids = [];
        for (const [k, q] of verts) {
          if (k === K[e] || k === K[(e + 1) % 3]) continue;
          const s0 = dot(sub(q, a), d) / L2; if (s0 <= 1e-9 || s0 >= 1 - 1e-9) continue;
          const f = [a[0] + d[0] * s0, a[1] + d[1] * s0, a[2] + d[2] * s0]; if (Math.hypot(...sub(q, f)) > tol) continue;
          mids.push([s0, q]);
        }
        if (!mids.length) continue;
        mids.sort((x, y) => x[0] - y[0]);
        const chain = [a, ...mids.map(m => m[1]), c];
        for (let q = 0; q + 1 < chain.length; q++) { out.push(...chain[q], ...chain[q + 1], ...o); tags.push(t ? t[i] : -1); }
        done = true;
      }
      if (!done) { for (let k = 0; k < 9; k++) out.push(p[b + k]); tags.push(t ? t[i] : -1); }
    }
    return { p: out, t: tags };
  }

  // Turn over or drop near-flat triangles (altitude under h) on an open edge when that leaves fewer open edges: a stray
  // sliver folded over a seam the neighbours already close. Returns { p, t }.
  function dropSlivers(p, t, h) {
    const key = i => k3(p[i], p[i + 1], p[i + 2]), nT = p.length / 9;
    const cnt = new Map(), tri = [];
    for (let i = 0; i < nT; i++) { const b = i * 9, ks = [key(b), key(b + 3), key(b + 6)]; tri.push(ks); if (ks[0] === ks[1] || ks[1] === ks[2] || ks[0] === ks[2]) continue; for (let e = 0; e < 3; e++) { const k = ks[e] + '|' + ks[(e + 1) % 3]; cnt.set(k, (cnt.get(k) || 0) + 1); } }
    const openOf = () => { let o = 0; for (const [k, v] of cnt) { const [x, y] = k.split('|'); const r = cnt.get(y + '|' + x) || 0; if (v > r) o += v - r; } return o; };
    const alt = b => { const A = [p[b], p[b + 1], p[b + 2]], B = [p[b + 3], p[b + 4], p[b + 5]], Cc = [p[b + 6], p[b + 7], p[b + 8]]; const L = Math.max(Math.hypot(...sub(B, A)), Math.hypot(...sub(Cc, B)), Math.hypot(...sub(A, Cc))); return L ? Math.hypot(...cross(sub(B, A), sub(Cc, A))) / L : 0; };
    const gone = new Set(), flipped = new Set(); let open = openOf();
    if (!open) return { p, t };
    const edit = (ks, d) => { for (let e = 0; e < 3; e++) { const k = ks[e] + '|' + ks[(e + 1) % 3]; const v = (cnt.get(k) || 0) + d; if (v) cnt.set(k, v); else cnt.delete(k); } };
    for (let i = 0; i < nT && open; i++) {
      const ks = tri[i]; if (ks[0] === ks[1] || ks[1] === ks[2] || ks[0] === ks[2]) continue;
      let onOpen = false; for (let e = 0; e < 3; e++) { const f = cnt.get(ks[e] + '|' + ks[(e + 1) % 3]) || 0, r = cnt.get(ks[(e + 1) % 3] + '|' + ks[e]) || 0; if (f > r) onOpen = true; }
      if (!onOpen || alt(i * 9) >= h) continue;
      // a zero-area triangle wound the wrong way (collinear corners) is fixed by turning it over; else drop it
      const fl = [ks[0], ks[2], ks[1]];
      edit(ks, -1); edit(fl, 1); const o1 = openOf();
      if (o1 < open) { open = o1; flipped.add(i); tri[i] = fl; continue; }
      edit(fl, -1); const o2 = openOf();
      if (o2 < open) { open = o2; gone.add(i); } else edit(ks, 1);
    }
    const out = [], tags = [];
    for (let i = 0; i < nT; i++) {
      if (gone.has(i)) continue; const b = i * 9;
      if (flipped.has(i)) out.push(p[b], p[b + 1], p[b + 2], p[b + 6], p[b + 7], p[b + 8], p[b + 3], p[b + 4], p[b + 5]); else for (let k = 0; k < 9; k++) out.push(p[b + k]);
      tags.push(t ? t[i] : -1);
    }
    return { p: out, t: tags };
  }

  // Inner offset surface (outward-facing, i.e. a closed solid describing the cavity).
  function cavitySurface(p, wall, bvh) {
    const { V, F } = weld(p);
    const nv = V.length / 3;
    const N = new Float64Array(nv * 3);
    for (let f = 0; f < F.length; f += 3) {
      const ia = F[f], ib = F[f + 1], ic = F[f + 2];
      const pa = [V[ia * 3], V[ia * 3 + 1], V[ia * 3 + 2]], pb = [V[ib * 3], V[ib * 3 + 1], V[ib * 3 + 2]], pc = [V[ic * 3], V[ic * 3 + 1], V[ic * 3 + 2]];
      const fn = cross(sub(pb, pa), sub(pc, pa)); const l = Math.hypot(...fn); if (!l) continue;
      fn[0] /= l; fn[1] /= l; fn[2] /= l;
      const corners = [[ia, pa, pb, pc], [ib, pb, pc, pa], [ic, pc, pa, pb]];
      for (const [id, P0, P1, P2] of corners) {
        const e1 = norm(sub(P1, P0)), e2 = norm(sub(P2, P0));
        const ang = Math.acos(Math.max(-1, Math.min(1, dot(e1, e2))));
        N[id * 3] += fn[0] * ang; N[id * 3 + 1] += fn[1] * ang; N[id * 3 + 2] += fn[2] * ang;
      }
    }
    // neighbours for smoothing
    const nb = Array.from({ length: nv }, () => new Set());
    for (let f = 0; f < F.length; f += 3) { const a = F[f], b = F[f + 1], c = F[f + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
    for (let i = 0; i < nv; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l; }
    // smooth normals a little so creases don't fold the inner surface
    for (let it = 0; it < 3; it++) {
      const M = new Float64Array(N.length);
      for (let i = 0; i < nv; i++) {
        let x = N[i * 3] * 2, y = N[i * 3 + 1] * 2, z = N[i * 3 + 2] * 2;
        for (const j of nb[i]) { x += N[j * 3]; y += N[j * 3 + 1]; z += N[j * 3 + 2]; }
        const l = Math.hypot(x, y, z) || 1; M[i * 3] = x / l; M[i * 3 + 1] = y / l; M[i * 3 + 2] = z / l;
      }
      N.set(M);
    }
    const off = new Float64Array(nv);
    for (let i = 0; i < nv; i++) {
      const d = [-N[i * 3], -N[i * 3 + 1], -N[i * 3 + 2]];
      const o = [V[i * 3] + d[0] * 1e-4, V[i * 3 + 1] + d[1] * 1e-4, V[i * 3 + 2] + d[2] * 1e-4];
      const th = rayQuery(bvh, o, d, true, 1e-6);
      off[i] = Math.min(wall, isFinite(th) ? th * 0.42 : wall);
    }
    for (let it = 0; it < 4; it++) { // smooth the offset field, never growing it
      const o2 = new Float64Array(nv);
      for (let i = 0; i < nv; i++) { let s = off[i], c = 1; for (const j of nb[i]) { s += off[j]; c++; } o2[i] = Math.min(off[i], s / c); }
      off.set(o2);
    }
    const out = new Float64Array(F.length * 3);
    for (let f = 0; f < F.length; f++) {
      const i = F[f];
      out[f * 3] = V[i * 3] - N[i * 3] * off[i]; out[f * 3 + 1] = V[i * 3 + 1] - N[i * 3 + 1] * off[i]; out[f * 3 + 2] = V[i * 3 + 2] - N[i * 3 + 2] * off[i];
    }
    return out;
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // ---------------------------------------------------------------- grid cutting
  // planes: [[x...],[y...],[z...]] sorted. Returns pieces {cell:[i,j,k], p, t} and cap registry.
  function cutGrid(p, planes, onProgress, rawCaps) {
    const caps = [];
    let start = { p: Array.from(p), t: new Array(p.length / 9).fill(-1) };
    let cells = [{ cell: [0, 0, 0], m: start }];
    const warn = [];
    for (let a = 0; a < 3; a++) {
      const next = [];
      for (const c of cells) {
        let rest = c.m;
        for (let i = 0; i < planes[a].length; i++) {
          const v = planes[a][i];
          const idN = caps.length, idP = idN + 1;
          caps.push({ id: idN, axis: a, v, sign: +1, partner: idP, index: i });
          caps.push({ id: idP, axis: a, v, sign: -1, partner: idN, index: i });
          const r = cutPlane(rest, a, v, idN, idP, null, rawCaps);
          if (r.broken) warn.push('A cut at ' + 'XYZ'[a] + '=' + v.toFixed(1) + ' mm crossed an open or self-intersecting part of the mesh.');
          const cell = c.cell.slice(); cell[a] = i;
          if (r.neg.t.length) next.push({ cell, m: r.neg });
          rest = r.pos;
          if (onProgress) onProgress();
        }
        const cell = c.cell.slice(); cell[a] = planes[a].length;
        if (rest.t.length) next.push({ cell, m: rest });
      }
      cells = next;
    }
    return { pieces: cells.map(c => ({ cell: c.cell, p: c.m.p, t: c.m.t })), caps, warn };
  }

  // Cavity: clip to each cell shrunk by `gap` from interior cut planes.
  function cavityForCell(cav, planes, cell, gap) {
    let m = { p: Array.from(cav), t: new Array(cav.length / 9).fill(-2) };
    const capV = {};
    for (let a = 0; a < 3; a++) {
      const i = cell[a];
      if (i > 0) { const v = nudgePlane(m.p, a, planes[a][i - 1] + gap); const tg = cavTag(a, 0); capV[tg] = v; m = cutPlane(m, a, v, -2, tg, null, true).pos; }
      if (!m.t.length) return null;
      if (i < planes[a].length) { const v = nudgePlane(m.p, a, planes[a][i] - gap); const tg = cavTag(a, 1); capV[tg] = v; m = cutPlane(m, a, v, tg, -2, null, true).neg; }
      if (!m.t.length) return null;
    }
    m.capV = capV;
    return m;
  }

  // ---------------------------------------------------------------- feature meshes
  // Local frame for a feature: plane axis a at value v, centre (cu,cw), ds = direction (+1/-1) along axis.
  function frame(a, v, cu, cw, ds) {
    const ea = [0, 0, 0]; ea[a] = ds;
    const eu = [0, 0, 0]; eu[UA[a]] = 1;
    const ew = [0, 0, 0]; ew[WA[a]] = 1;
    const pt = (u, w, h) => { const o = [0, 0, 0]; o[a] = h === 0 ? v : v + ds * h; o[UA[a]] = u; o[WA[a]] = w; return o; };
    return { a, v, cu, cw, ds, ea, eu, ew, pt };
  }
  function addTri(out, A, B, C, n) {
    const c = cross(sub(B, A), sub(C, A));
    if (dot(c, n) < 0) out.push(A[0], A[1], A[2], C[0], C[1], C[2], B[0], B[1], B[2]);
    else out.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
  }
  function addQuad(out, A, B, C, D, n) { addTri(out, A, B, C, n); addTri(out, A, C, D, n); }

  // Revolved feature. profile [[h,r],...] from the plane (h=0) to the end; cavity flips normals.
  function revolve(F, profile, cavity, N, startDisc) {
    N = N || 32;
    const out = [];
    const ang = []; for (let i = 0; i < N; i++) ang.push(2 * Math.PI * i / N);
    const rim = ang.map(t => [F.cu + profile[0][1] * Math.cos(t), F.cw + profile[0][1] * Math.sin(t)]);
    const ring = k => {
      const [h, r] = profile[k];
      return ang.map((t, i) => (k === 0 ? F.pt(rim[i][0], rim[i][1], 0) : F.pt(F.cu + r * Math.cos(t), F.cw + r * Math.sin(t), h)));
    };
    const rings = profile.map((_, k) => ring(k));
    const sg = cavity ? -1 : 1;
    for (let k = 0; k + 1 < profile.length; k++) {
      const dh = profile[k + 1][0] - profile[k][0], dr = profile[k + 1][1] - profile[k][1];
      const l = Math.hypot(dh, dr) || 1; const nr = dh / l, nh = -dr / l;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N; const tm = (ang[i] + (j ? ang[j] : 2 * Math.PI)) / 2;
        const rad = [0, 0, 0]; for (let q = 0; q < 3; q++) rad[q] = F.eu[q] * Math.cos(tm) + F.ew[q] * Math.sin(tm);
        const n = [0, 0, 0]; for (let q = 0; q < 3; q++) n[q] = sg * (rad[q] * nr + F.ea[q] * nh);
        addQuad(out, rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i], n);
      }
    }
    const last = profile[profile.length - 1];
    const ce = F.pt(F.cu, F.cw, last[0]);
    const nEnd = F.ea.map(x => x * sg);
    const R = rings[rings.length - 1];
    for (let i = 0; i < N; i++) addTri(out, ce, R[i], R[(i + 1) % N], nEnd);
    if (startDisc) { // standalone part: close the h=0 end too
      const c0 = F.pt(F.cu, F.cw, 0); const n0 = F.ea.map(x => -x * sg);
      for (let i = 0; i < N; i++) addTri(out, c0, rings[0][i], rings[0][(i + 1) % N], n0);
    }
    return { rim, tris: out };
  }

  // Keyed peg or socket: a prism of a 2D shape swept along profile [[h, R, e], ...]. R is the apothem (half side,
  // radius) at that height; e is the clearance already in R (a socket grows its flats by e, not the whole shape).
  // Shapes: square, hex, D (a round peg with one flat). Convex, centred on (cu,cw), so it can't turn in its socket.
  function shapeLoop(shape, R, e) {
    const pts = [];
    if (shape === 'square') { for (const [x, y] of [[1, -1], [1, 1], [-1, 1], [-1, -1]]) pts.push([x * R, y * R]); }
    else if (shape === 'hex') { const rc = R / Math.cos(Math.PI / 6); for (let i = 0; i < 6; i++) { const t = Math.PI / 6 + i * Math.PI / 3; pts.push([rc * Math.cos(t), rc * Math.sin(t)]); } }
    else { // D: circle with a flat on +u at 0.6 of the bare radius (the socket's flat moves out by e too)
      const N = 32, f = 0.6 * (R - e) + e;
      for (let i = 0; i < N; i++) { const t = 2 * Math.PI * (i + 0.5) / N; pts.push([Math.min(f, R * Math.cos(t)), R * Math.sin(t)]); }
    }
    return pts;
  }
  const SHAPE_K = { round: 1, square: Math.SQRT2, hex: 1 / Math.cos(Math.PI / 6), D: 1 }; // circumradius / apothem
  function keyedPrism(F, shape, profile, cavity) {
    const out = [], sg = cavity ? -1 : 1;
    // turned by an angle that depends on the position, so the flats of two sockets on one face never line up
    // (collinear hole edges trip the cap triangulation); peg and socket share it, so they still match
    const fr = x => x - Math.floor(x), ang = 0.2 + 0.3 * fr(Math.abs(F.cu * 0.7548777 + F.cw * 0.5698403)), ca = Math.cos(ang), sa = Math.sin(ang);
    const loops = profile.map(([, R, e]) => shapeLoop(shape, R, e || 0).map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]));
    const rim = loops[0].map(q => [F.cu + q[0], F.cw + q[1]]);
    const rings = loops.map((L, k) => L.map((q, i) => k === 0 ? F.pt(rim[i][0], rim[i][1], 0) : F.pt(F.cu + q[0], F.cw + q[1], profile[k][0])));
    const N = rim.length;
    for (let k = 0; k + 1 < profile.length; k++) {
      const dh = profile[k + 1][0] - profile[k][0], dr = profile[k + 1][1] - profile[k][1];
      const l = Math.hypot(dh, dr) || 1, nr = dh / l, nh = -dr / l;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N, mu = (loops[k][i][0] + loops[k][j][0]) / 2, mw = (loops[k][i][1] + loops[k][j][1]) / 2, ml = Math.hypot(mu, mw) || 1;
        const n = [0, 0, 0]; for (let q = 0; q < 3; q++) n[q] = sg * ((F.eu[q] * mu + F.ew[q] * mw) / ml * nr + F.ea[q] * nh);
        addQuad(out, rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i], n);
      }
    }
    const last = profile[profile.length - 1], ce = F.pt(F.cu, F.cw, last[0]), nEnd = F.ea.map(x => x * sg), R = rings[rings.length - 1];
    for (let i = 0; i < N; i++) addTri(out, ce, R[i], R[(i + 1) % N], nEnd);
    return { rim, tris: out };
  }

  // Snap clip: split peg with a barb near the tip.
  function snapPeg(F, r, L, b, ws, N) {
    N = N || 10;
    const w = ws / 2;
    const h0 = Math.max(1.2, L * 0.22);
    const tipH = Math.max(2.4, 4 * b);
    const zc = L - tipH - 0.4;
    const prof = [[h0, r], [zc, r], [zc + 0.4, r + b], [L, Math.max(r - 0.35, w + 0.4)]];
    const out = [];
    const Darc = (R, side) => { // side 0 = +w prong, 1 = -w prong
      const a0 = Math.asin(Math.min(0.999, w / R));
      const base = side === 0 ? a0 : Math.PI + a0;
      const pts = [];
      for (let j = 0; j <= N; j++) { const t = base + (Math.PI - 2 * a0) * j / N; pts.push([R * Math.cos(t), R * Math.sin(t), t]); }
      return pts;
    };
    const P = (q, h) => F.pt(F.cu + q[0], F.cw + q[1], h);
    const fullRing = R => Darc(R, 0).concat(Darc(R, 1));
    const rim2 = fullRing(r);
    const rim = rim2.map(q => [F.cu + q[0], F.cw + q[1]]);
    const ringAt = h => rim2.map((q, i) => h === 0 ? F.pt(rim[i][0], rim[i][1], 0) : P(q, h));
    const r0 = ringAt(0), r1 = ringAt(h0);
    const M = rim2.length;
    const radial = t => { const o = [0, 0, 0]; for (let q = 0; q < 3; q++) o[q] = F.eu[q] * Math.cos(t) + F.ew[q] * Math.sin(t); return o; };
    for (let i = 0; i < M; i++) {
      const j = (i + 1) % M;
      const tm = Math.atan2(rim2[i][1] + rim2[j][1], rim2[i][0] + rim2[j][0]);
      addQuad(out, r0[i], r0[j], r1[j], r1[i], radial(tm));
    }
    // slot floor at h0: D1[N], D2[0], D2[N], D1[0]
    const up = F.ea;
    addQuad(out, r1[N], r1[N + 1], r1[2 * N + 1], r1[0], up);
    for (let side = 0; side < 2; side++) {
      const layers = [side === 0 ? r1.slice(0, N + 1) : r1.slice(N + 1)];
      for (let k = 1; k < prof.length; k++) layers.push(Darc(prof[k][1], side).map(q => P(q, prof[k][0])));
      for (let k = 0; k + 1 < layers.length; k++) {
        const dh = prof[k + 1][0] - prof[k][0], dr = prof[k + 1][1] - prof[k][1];
        const l = Math.hypot(dh, dr); const nr = dh / l, nh = -dr / l;
        const A = layers[k], B = layers[k + 1];
        const arc = side === 0 ? Darc(r, 0) : Darc(r, 1);
        for (let j = 0; j < N; j++) {
          const tm = (arc[j][2] + arc[j + 1][2]) / 2; const rd = radial(tm);
          const n = [0, 0, 0]; for (let q = 0; q < 3; q++) n[q] = rd[q] * nr + F.ea[q] * nh;
          addQuad(out, A[j], A[j + 1], B[j + 1], B[j], n);
        }
        // chord wall faces the slot
        const cn = F.ew.map(x => side === 0 ? -x : x);
        addQuad(out, A[N], A[0], B[0], B[N], cn);
      }
      const top = layers[layers.length - 1];
      for (let j = 1; j < N; j++) addTri(out, top[0], top[j], top[j + 1], up);
    }
    return { rim, tris: out, zc };
  }

  // Dovetail tenon (male) and keyhole slide pocket (female). orient 0: slide along u, 1: along w.
  function dovetailLocal(F, orient) {
    const map = (s, c, h) => orient === 0 ? F.pt(F.cu + s, F.cw + c, h) : F.pt(F.cu + c, F.cw + s, h);
    const map2 = (s, c) => orient === 0 ? [F.cu + s, F.cw + c] : [F.cu + c, F.cw + s];
    const es = orient === 0 ? F.eu : F.ew, ec = orient === 0 ? F.ew : F.eu;
    const neg = v => v.map(x => -x);
    return { map, map2, es, ec, neg };
  }
  function dovetailMale(F, orient, Lk, wn, ww, h) {
    const D = dovetailLocal(F, orient), out = [];
    const rim = [D.map2(0, -wn / 2), D.map2(Lk, -wn / 2), D.map2(Lk, wn / 2), D.map2(0, wn / 2)];
    const b = rim.map(q => F.pt(q[0], q[1], 0));
    const t = [D.map(0, -ww / 2, h), D.map(Lk, -ww / 2, h), D.map(Lk, ww / 2, h), D.map(0, ww / 2, h)];
    addQuad(out, b[0], b[1], t[1], t[0], D.neg(D.ec));
    addQuad(out, b[2], b[3], t[3], t[2], D.ec);
    addQuad(out, b[1], b[2], t[2], t[1], D.es);
    addQuad(out, b[3], b[0], t[0], t[3], D.neg(D.es));
    addQuad(out, t[0], t[1], t[2], t[3], F.ea);
    return { rim, tris: out };
  }
  function dovetailFemale(F, orient, Lk, wn, h, ang, c) {
    const D = dovetailLocal(F, orient), out = [];
    const H = h + c, hn = wn / 2 + c, hw = hn + H * Math.tan(ang);
    const s0 = -Lk - c, s1 = 0, s2 = Lk + c;
    const rim2 = [[s0, -hw], [s1, -hw], [s1, -hn], [s2, -hn], [s2, hn], [s1, hn], [s1, hw], [s0, hw]];
    const rim = rim2.map(q => D.map2(q[0], q[1]));
    const R = rim.map(q => F.pt(q[0], q[1], 0));
    const P = (s, cc, hh) => D.map(s, cc, hh);
    const nIn = F.ea.map(x => -x); // cavity floor faces back toward the plane
    const cPos = D.ec, cNeg = D.neg(D.ec), sPos = D.es, sNeg = D.neg(D.es);
    // end wall s0
    addQuad(out, R[7], R[0], P(s0, -hw, H), P(s0, hw, H), sPos);
    for (const sg of [-1, 1]) {
      const iE0 = sg < 0 ? 0 : 7, iE1 = sg < 0 ? 1 : 6, iN1 = sg < 0 ? 2 : 5, iN2 = sg < 0 ? 3 : 4;
      const nC = sg < 0 ? cPos : cNeg; // walls face into the cavity
      addQuad(out, R[iE0], R[iE1], P(s1, sg * hw, H), P(s0, sg * hw, H), nC); // entry wall
      addTri(out, R[iN1], R[iE1], P(s1, sg * hw, H), sNeg); // transition sliver
      addQuad(out, R[iN1], R[iN2], P(s2, sg * hw, H), P(s1, sg * hw, H), nC); // slanted wall
    }
    addQuad(out, R[3], R[4], P(s2, hw, H), P(s2, -hw, H), sNeg); // end wall s2
    addQuad(out, P(s0, -hw, H), P(s1, -hw, H), P(s1, hw, H), P(s0, hw, H), nIn);
    addQuad(out, P(s1, -hw, H), P(s2, -hw, H), P(s2, hw, H), P(s1, hw, H), nIn);
    return { rim, tris: out, hw, s0, s2, H };
  }

  // ---------------------------------------------------------------- placement
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function regionCandidates(poly) {
    const all = [poly.outer, ...poly.holes];
    let mnu = Infinity, mnw = Infinity, mxu = -Infinity, mxw = -Infinity;
    for (const q of poly.outer) { mnu = Math.min(mnu, q[0]); mxu = Math.max(mxu, q[0]); mnw = Math.min(mnw, q[1]); mxw = Math.max(mxw, q[1]); }
    const step = Math.max(0.5, Math.max(mxu - mnu, mxw - mnw) / 48);
    const cands = [];
    for (let u = mnu + step / 2; u < mxu; u += step) for (let w = mnw + step / 2; w < mxw; w += step) {
      if (!pip([u, w], poly.outer)) continue;
      let inHole = false; for (const h of poly.holes) if (pip([u, w], h)) { inHole = true; break; }
      if (inHole) continue;
      let cl = Infinity;
      for (const lp of all) for (let i = 0, j = lp.length - 1; i < lp.length; j = i++) { const d = segDist(u, w, lp[j][0], lp[j][1], lp[i][0], lp[i][1]); if (d < cl) cl = d; }
      cands.push({ u, w, cl });
    }
    cands.sort((x, y) => y.cl - x.cl);
    return { cands, ext: [mxu - mnu, mxw - mnw] };
  }

  // distance from (u,w) to the nearest outline edge of a set of section polygons
  function clearIn(polys, u, w) {
    let cl = Infinity;
    for (const P of polys) for (const lp of [P.outer, ...P.holes]) for (let i = 0, j = lp.length - 1; i < lp.length; j = i++) { const d = segDist(u, w, lp[j][0], lp[j][1], lp[i][0], lp[i][1]); if (d < cl) cl = d; }
    return cl;
  }

  // Connector specification given type, sizing and the region's best clearance.
  function connectorSpec(opt, maxCl) {
    const c = opt.tolerance;
    let r = opt.diameter / 2, L = opt.length;
    if (opt.autoSize) { r = Math.max(1.5, Math.min(6, maxCl * 0.25)); L = Math.max(6, Math.min(18, Math.round(r * 3.2))); }
    const wall = opt.minWall;
    switch (opt.type) {
      case 'peg': {
        const shape = SHAPE_K[opt.shape] ? opt.shape : 'round', taper = !!opt.taper, rk = r * SHAPE_K[shape];
        return { type: 'peg', r, L, c, shape, taper, rk, rev: !!opt.reverse, reach: rk + c + wall, depth: L + 0.6 };
      }
      case 'dowel': {
        if (!opt.snapPin) return { type: 'dowel', r, L, c, reach: r + c + wall, depth: L / 2 + 0.5 };
        // split snap pin: each end is slotted into two prongs with a barb that clicks into a groove at the bottom of
        // the hole. The prongs need length to flex, so the pin is at least long enough for that.
        r = Math.max(r, 2); const b = Math.max(0.3, Math.min(0.6, r * 0.15)), g = Math.max(1.2, r * 0.5), prong = g + 1.4 * r;
        L = Math.max(L, 2 * (prong + 1.2) + 0.4);
        return { type: 'dowel', snap: true, r, L, c, b, g, prong, slot: 2 * b + 0.5, reach: r + b + c + wall, depth: L / 2 + 0.5 };
      }
      case 'snap': { const b = Math.max(0.35, Math.min(0.8, r * 0.18)); const ws = Math.max(1, r * 0.55); r = Math.max(r, 2.2); return { type: 'snap', r, L: Math.max(L, 8), b, ws, c, rev: !!opt.reverse, reach: r + b + c + wall, depth: Math.max(L, 8) + 0.8 }; }
      case 'dovetail': {
        const h = Math.max(3, Math.min(8, r * 1.4)), wn = Math.max(4, r * 2), ang = 15 * Math.PI / 180, Lk = Math.max(8, Math.min(30, r * 5));
        const hw = wn / 2 + c + (h + c) * Math.tan(ang);
        return { type: 'dovetail', h, wn, ww: wn + 2 * h * Math.tan(ang), ang, Lk, c, rev: !!opt.reverse, reach: Math.hypot(Lk + c, hw) + wall, depth: h + c };
      }
      case 'magnet': { const md = opt.magnetDiameter, mt = opt.magnetThickness; return { type: 'magnet', r: md / 2, c, md, mt, reach: md / 2 + c + wall, depth: mt + 0.3 }; }
      default: return null;
    }
  }

  // Build feature meshes for one connector at (cu,cw) on plane (a,v). Neg piece = A, Pos piece = B.
  function buildConnector(spec, a, v, cu, cw, orient) {
    const FA = frame(a, v, cu, cw, -1); // into A's material
    const FB0 = frame(a, v, cu, cw, +1); // into B's material (and the direction A's pegs point)
    // reversed: the male half sits on B and points into A, so build it in A's frame and swap the halves at the end
    const FB = spec.rev ? FA : FB0;
    const r = spec.r, c = spec.c;
    let A = null, B = null, pins = 0;
    switch (spec.type) {
      case 'peg': {
        const ch = Math.min(0.6, r * 0.3), L = spec.L, d = L + 0.6;
        if (spec.taper) { // glue key: tapers to 55% so it self-centres and wedges tight; the socket follows the taper
          const rt = r * 0.55, at = h => r - (r - rt) * h / L, sh = spec.shape;
          if (sh === 'round') { A = revolve(FB, [[0, r], [L, rt]], false); B = revolve(FB, [[0, r + c], [d, at(d) + c]], true); }
          else { A = keyedPrism(FB, sh, [[0, r, 0], [L, rt, 0]], false); B = keyedPrism(FB, sh, [[0, r + c, c], [d, at(d) + c, c]], true); }
        } else if (spec.shape && spec.shape !== 'round') {
          A = keyedPrism(FB, spec.shape, [[0, r, 0], [L - ch, r, 0], [L, r - ch, 0]], false);
          B = keyedPrism(FB, spec.shape, [[0, r + c, c], [d, r + c, c]], true);
        } else {
          A = revolve(FB, [[0, r], [L - ch, r], [L, r - ch]], false);
          B = revolve(FB, [[0, r + c], [d, r + c]], true);
        }
        break;
      }
      case 'dowel': {
        const d = spec.L / 2 + 0.5;
        // snap pin: a groove at the bottom of each hole, starting just short of where the barb's shoulder sits
        const prof = spec.snap ? (() => { const gs = (spec.L - 0.4) / 2 - spec.g - 0.2; return [[0, r + c], [gs, r + c], [gs, r + spec.b + c], [d, r + spec.b + c]]; })() : [[0, r + c], [d, r + c]];
        A = revolve(FA, prof, true);
        B = revolve(FB, prof, true);
        pins = 1; break;
      }
      case 'snap': {
        A = snapPeg(FB, r, spec.L, spec.b, spec.ws);
        B = revolve(FB, [[0, r + c], [A.zc - c, r + c], [A.zc - c, r + spec.b + c], [spec.L + 0.8, r + spec.b + c]], true);
        break;
      }
      case 'dovetail': {
        A = dovetailMale(FB, orient, spec.Lk, spec.wn, spec.ww, spec.h);
        B = dovetailFemale(FB, orient, spec.Lk, spec.wn, spec.h, spec.ang, c);
        break;
      }
      case 'magnet': {
        A = revolve(FA, [[0, r + c], [spec.depth, r + c]], true);
        B = revolve(FB, [[0, r + c], [spec.depth, r + c]], true);
        break;
      }
    }
    if (spec.rev && (spec.type === 'peg' || spec.type === 'snap' || spec.type === 'dovetail')) return { A: B, B: A, pins };
    return { A, B, pins };
  }

  // 3D points that must lie inside solid material for a connector to be safe.
  function probePoints(spec, a, v, cu, cw, orient, wall) {
    const pts = [];
    const ring = (ds, rad, h, n) => { const F = frame(a, v, cu, cw, ds); for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; pts.push(F.pt(cu + rad * Math.cos(t), cw + rad * Math.sin(t), h)); } pts.push(F.pt(cu, cw, h)); };
    const R = spec.type === 'dovetail' ? 0 : ((spec.rk || spec.r) + (spec.b || 0) + spec.c), sd = spec.rev ? -1 : 1;
    switch (spec.type) {
      case 'peg': case 'snap': ring(sd, R + wall * 0.7, spec.depth * 0.5, 8); ring(sd, R + wall * 0.7, spec.depth, 8); ring(sd, 0, spec.depth + wall, 1); break;
      case 'dowel': case 'magnet': for (const ds of [-1, 1]) { ring(ds, R + wall * 0.7, spec.depth * 0.5, 8); ring(ds, R + wall * 0.7, spec.depth, 8); ring(ds, 0, spec.depth + wall, 1); } break;
      case 'dovetail': {
        const F = frame(a, v, cu, cw, sd); const D = dovetailLocal(F, orient);
        const hw = spec.wn / 2 + spec.c + (spec.h + spec.c) * Math.tan(spec.ang) + wall * 0.7;
        const s0 = -spec.Lk - spec.c - wall * 0.7, s2 = spec.Lk + spec.c + wall * 0.7, H = spec.depth + wall;
        for (const s of [s0, (s0 + s2) / 2, s2]) for (const cc of [-hw, 0, hw]) { pts.push(D.map(s, cc, H)); pts.push(D.map(s, cc, H / 2)); }
        break;
      }
    }
    return pts;
  }

  // features: [{rim:[[u,w]...] | rims:[...], islands:[loops], tris:[...]}]
  function addFeatureToPiece(piece, tag, a, v, sign, features, countJoint, triTag) {
    const polys = capPolys(piece, tag, a);
    if (!polys.length) return false;
    for (const f of features) {
      const rims = f.rims || [f.rim];
      for (const rim of rims) {
        let cx = 0, cy = 0; for (const q of rim) { cx += q[0]; cy += q[1]; } cx /= rim.length; cy /= rim.length;
        const probe = pip([cx, cy], rim) ? [cx, cy] : rim[0];
        let target = null;
        for (const P of polys) { if (pip(probe, P.outer) && !P.holes.some(h => pip(probe, h))) { target = P; break; } }
        if (!target) return false;
        target.holes.push(rim); target.changed = true;
      }
      for (const isl of (f.islands || [])) polys.push(isl.outer ? { outer: isl.outer, holes: isl.holes.slice() } : { outer: isl, holes: [] });
    }
    removeTag(piece, tag);
    // regions left as they were keep their ring (traced from the cap, so its triangles use ring edges forward): a
    // self-crossing sliver there is re-capped closed as cutPlane capped it. Regions with a new hole or island don't.
    triangulatePolys(polys.filter(P => P.changed || !P.ring), a, v, sign, piece.p, piece.t, tag);
    triangulatePolys(polys.filter(P => !P.changed && P.ring), a, v, sign, piece.p, piece.t, tag, +1);
    if (countJoint !== false) piece.joints = (piece.joints || 0) + features.length;
    const tt = triTag === undefined ? -3 : triTag;
    for (const f of features) { if (!f.tris) continue; for (let i = 0; i < f.tris.length; i++) piece.p.push(f.tris[i]); for (let i = 0; i < f.tris.length / 9; i++) piece.t.push(tt); }
    return true;
  }

  const cavTag = (a, side) => -10 - (a * 2 + side);

  // ---------------------------------------------------------------- engraved part IDs (A1, B2 ... or 1, 2, 3)
  // 3 x 5 pixel font. Glyphs may touch diagonally; textLoops bridges those corners so every outline is simple.
  const FONT = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '001', '001'], '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
    D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
    G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
    J: ['001', '001', '001', '101', '010'], K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
    M: ['101', '111', '111', '101', '101'], N: ['110', '101', '101', '101', '101'], O: ['010', '101', '101', '101', '010'],
    P: ['110', '101', '110', '100', '100'], Q: ['010', '101', '101', '111', '011'], R: ['110', '101', '110', '101', '101'],
    S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'],
    V: ['101', '101', '101', '010', '010'], W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'],
    Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'], '-': ['000', '000', '111', '000', '000']
  };
  // Outline loops of a pixel string, in font-pixel units (half-pixel steps), origin bottom-left. Filled side on the left.
  // The glyphs are traced on a 2x grid where a diagonal-only contact gets one extra half-pixel, so loops never pinch.
  function textLoops(str) {
    str = String(str).toUpperCase();
    const W = str.length * 4 - 1, H = 5, GW = W * 2, GH = H * 2;
    const g = new Uint8Array(GW * GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const fx = x >> 1, fy = y >> 1, ci = Math.floor(fx / 4), cx = fx % 4;
      const gl = FONT[str[ci]];
      g[y * GW + x] = cx !== 3 && gl && gl[H - 1 - fy][cx] === '1' ? 1 : 0;
    }
    const at = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH ? g[y * GW + x] : 0;
    for (let pass = 0; pass < 2; pass++) for (let y = 0; y < GH - 1; y++) for (let x = 0; x < GW - 1; x++) {
      const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1);
      if (a && d && !b && !c) g[y * GW + x + 1] = 1;       // bridge the corner on the lower right
      else if (b && c && !a && !d) g[y * GW + x] = 1;      // bridge on the lower left
    }
    const out = new Map();
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) out.set(x + ',' + y, [x + 1, y]);
      if (!at(x + 1, y)) out.set((x + 1) + ',' + y, [x + 1, y + 1]);
      if (!at(x, y + 1)) out.set((x + 1) + ',' + (y + 1), [x, y + 1]);
      if (!at(x - 1, y)) out.set(x + ',' + (y + 1), [x, y]);
    }
    const loops = []; const used = new Set();
    for (const k of out.keys()) {
      if (used.has(k)) continue;
      const loop = []; let cur = k;
      while (!used.has(cur)) { used.add(cur); const [x, y] = cur.split(',').map(Number); loop.push([x / 2, y / 2]); const n = out.get(cur); cur = n[0] + ',' + n[1]; }
      // drop collinear points
      const c = loop.filter((p, i) => { const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length]; return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0; });
      loops.push(c);
    }
    return { loops, W, H };
  }
  // Grid ID for a piece: row letter (front to back, then the next layer up continues the alphabet) + column number.
  // A1 is front-left on the bottom layer. Falls back to plain numbers past 26 rows.
  function pieceId(cell, counts, number) {
    const row = cell[2] * counts[1] + cell[1];
    if (row >= 26 || counts[0] > 99) return String(number);
    return String.fromCharCode(65 + row) + (cell[0] + 1);
  }
  // Custom part numbers: a job prefix (A-Z, 0-9, '-'; up to 6 characters, the label font has nothing else) and either
  // the grid IDs (A1, B2...) or plain numbers that start where you choose (to carry on a series). Pieces keep their
  // assembly order; only the text changes, so labels, file names and the sheet all follow.
  function cleanPrefix(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 6); }
  function numberParts(pieces, opt) {
    if (!opt) return pieces;
    const pre = cleanPrefix(opt.prefix), num = opt.style === 'num';
    const start = Math.max(0, Math.min(99999, Math.floor(+opt.start) || (opt.start === 0 || opt.start === '0' ? 0 : 1)));
    if (!pre && !num) return pieces;
    for (const pc of pieces) pc.labelText = pre + (num ? String(start + pc.number - 1) : String(pc.labelText || pc.number));
    return pieces;
  }
  // style 'engrave': the ID is cut into the face. style 'raised': letters stand up inside a recessed panel,
  // their tops flush with the face, so the seam still closes flat.
  function labelFeature(text, a, v, cu, cw, px, depth, ds, mirror, style) {
    const tl = textLoops(text), W = tl.W, H = tl.H;
    // nudge each counter (the hole in A, B, D...) a hair so none of its edges is collinear with the glyph's outline or another counter
    let kc = 0;
    const loops = tl.loops.map(l => { if (polyArea(l) >= 0) return l; const du = 0.011 + 0.006 * kc, dw = 0.007 + 0.004 * kc; kc++; return l.map(q => [q[0] + du, q[1] + dw]); });
    const raised = style === 'raised';
    const F = frame(a, v, cu, cw, ds);
    // in pixel units: for raised, a panel around the text and every glyph loop reversed (glyphs stay, the rest is removed)
    let src = loops;
    if (raised) src = [[[-1, -1], [W + 1, -1], [W + 1, H + 1], [-1, H + 1]], ...loops.map(l => l.slice().reverse())];
    const tr = src.map(lp => {
      const gi = Math.floor(Math.min(...lp.map(q => q[0])) / 4); // stagger glyphs so their edges are never collinear
      let L = lp.map(([x, y]) => [cu + (mirror ? -1 : 1) * (x - W / 2) * px, cw + (y - H / 2) * px + gi * 0.013]);
      if (mirror) L = L.reverse();
      return L;
    });
    const outers = [], counters = [];
    for (const L of tr) (polyArea(L) > 0 ? outers : counters).push(L);
    const tris = [];
    for (const L of tr) for (let i = 0; i < L.length; i++) {
      const p0 = L[i], p1 = L[(i + 1) % L.length];
      const du = p1[0] - p0[0], dw = p1[1] - p0[1];
      const n = [0, 0, 0]; for (let q = 0; q < 3; q++) n[q] = F.eu[q] * -dw + F.ew[q] * du;
      addQuad(tris, F.pt(p0[0], p0[1], 0), F.pt(p1[0], p1[1], 0), F.pt(p1[0], p1[1], depth), F.pt(p0[0], p0[1], depth), n);
    }
    const polys = outers.map(o => ({ outer: o, holes: counters.filter(c => pip(c[0], o)) }));
    const pb = [], tb = [];
    triangulatePolys(polys, a, v + ds * depth, -ds, pb, tb, 0);
    for (const x of pb) tris.push(x);
    if (!raised) return { rims: outers, islands: counters, tris, w: W * px, h: H * px };
    // raised: only the panel cuts the face; each glyph is an island at face level, with its own counters as pockets
    const panel = outers.reduce((m, o) => Math.abs(polyArea(o)) > Math.abs(polyArea(m)) ? o : m, outers[0]);
    const pockets = outers.filter(o => o !== panel);
    const islands = counters.map(c => ({ outer: c, holes: pockets.filter(o => pip(o[0], c)) }));
    return { rims: [panel], islands, tris, w: (W + 2) * px, h: (H + 2) * px };
  }
  // Put `text` on the cap face `tag` of a piece if there is room. Returns true when placed.
  function labelOnCap(pc, tag, cap, text, opt) {
    const style = opt.style === 'raised' ? 'raised' : 'engrave';
    const polys = capPolys(pc, tag, cap.axis);
    for (const poly of polys.sort((x, y) => y.area - x.area)) {
      const { cands } = regionCandidates(poly);
      if (!cands.length) continue;
      const units = Math.hypot(text.length * 4 - 1 + (style === 'raised' ? 2 : 0), 5 + (style === 'raised' ? 2 : 0)) / 2;
      const px = Math.min(opt.maxPx || 3, (cands[0].cl - 1.5) / units);
      if (px < 0.9) continue;
      const reach = units * px + 1.2;
      const q = cands.find(c => c.cl >= reach);
      if (!q) continue;
      const f = labelFeature(text, cap.axis, cap.v, q.u, q.w, px, opt.depth || 0.6, -cap.sign, cap.sign < 0, style);
      if (addFeatureToPiece(pc, tag, cap.axis, cap.v, cap.sign, [f], false, -4)) { pc.label = text; pc.labelFace = { axis: cap.axis, v: cap.v, sign: cap.sign, u: q.u, w: q.w, px }; return true; }
      return false;
    }
    return false;
  }
  function addLabels(pieces, caps, opt) {
    let placed = 0;
    pieces.forEach((pc, idx) => {
      const text = String(pc.labelText || pc.number || idx + 1);
      const tags = [...new Set(pc.t.filter(t => t >= 0))].sort((x, y) => caps[x].sign - caps[y].sign);
      for (const tag of tags) if (labelOnCap(pc, tag, caps[tag], text, opt)) { placed++; break; }
    });
    return placed;
  }

  // ---------------------------------------------------------------- vent holes (hollow pieces)
  function addVents(pc, caps, capV, radius, count, bvh) {
    let made = 0;
    const tags = [...new Set(pc.t.filter(t => t >= 0))];
    // One hole per cut face first; later passes put more on the same face (the hole already made is a hole
    // in the cap outline, so the clearance test keeps the next one away from it).
    for (let pass = 0; pass < count && made < count; pass++) for (const tag of tags) {
      if (made >= count) break;
      const cap = caps[tag];
      const side = cap.sign > 0 ? 1 : 0;
      const ct = cavTag(cap.axis, side);
      if (capV[ct] === undefined || !pc.t.includes(ct)) continue;
      const vc = capV[ct];
      const cavPolys = capPolys(pc, ct, cap.axis);
      const outPolys = capPolys(pc, tag, cap.axis);
      let hit = null;
      for (const poly of cavPolys) {
        const { cands } = regionCandidates(poly);
        for (const q of cands) {
          if (q.cl < radius + 1) break;
          const P = outPolys.find(o => pip([q.u, q.w], o.outer) && !o.holes.some(h => pip([q.u, q.w], h)));
          if (!P) continue;
          let cl = Infinity;
          for (const lp of [P.outer, ...P.holes]) for (let i = 0, j = lp.length - 1; i < lp.length; j = i++) cl = Math.min(cl, segDist(q.u, q.w, lp[j][0], lp[j][1], lp[i][0], lp[i][1]));
          if (cl < radius + 1.5) continue;
          const F = frame(cap.axis, cap.v, q.u, q.w, -cap.sign);
          const gap = Math.abs(vc - cap.v);
          let ok = true;
          for (let k = 0; k < 8 && ok; k++) { const t = k * Math.PI / 4; if (!inside(bvh, F.pt(q.u + (radius + 0.8) * Math.cos(t), q.w + (radius + 0.8) * Math.sin(t), gap * 0.5))) ok = false; }
          if (ok) { hit = q; break; }
        }
        if (hit) break;
      }
      if (!hit) continue;
      const N = 20, rim = [];
      for (let i = 0; i < N; i++) { const t = 2 * Math.PI * i / N; rim.push([hit.u + radius * Math.cos(t), hit.w + radius * Math.sin(t)]); }
      const A = cap.axis, tris = [];
      const P0 = rim.map(q => { const o = [0, 0, 0]; to3(A, cap.v, q[0], q[1], o, 0); return o; });
      const P1 = rim.map(q => { const o = [0, 0, 0]; to3(A, vc, q[0], q[1], o, 0); return o; });
      const F = frame(A, cap.v, hit.u, hit.w, 1);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N, tm = 2 * Math.PI * (i + 0.5) / N;
        const n = [0, 0, 0]; for (let q = 0; q < 3; q++) n[q] = -(F.eu[q] * Math.cos(tm) + F.ew[q] * Math.sin(tm));
        addQuad(tris, P0[i], P0[j], P1[j], P1[i], n);
      }
      addFeatureToPiece(pc, tag, A, cap.v, cap.sign, [{ rim, tris }], false, -5);
      addFeatureToPiece(pc, ct, A, vc, -cap.sign, [{ rim: rim.slice(), tris: null }], false);
      made++;
    }
    return made;
  }

  // ---------------------------------------------------------------- sections, areas, orientation
  function sectionSegs(p, a, v) {
    const segs = [];
    const d = [0, 0, 0];
    for (let b = 0; b < p.length; b += 9) {
      for (let k = 0; k < 3; k++) { d[k] = p[b + k * 3 + a] - v; if (d[k] === 0) d[k] = 1e-12; }
      const s0 = d[0] > 0, s1 = d[1] > 0, s2 = d[2] > 0;
      if (s0 === s1 && s1 === s2) continue;
      let L; if (s0 !== s1 && s0 !== s2) L = 0; else if (s1 !== s0 && s1 !== s2) L = 1; else L = 2;
      const iA = L, iB = (L + 1) % 3, iC = (L + 2) % 3;
      const pt = (i, j) => { const t = d[i] / (d[i] - d[j]); return [p[b + i * 3 + UA[a]] + t * (p[b + j * 3 + UA[a]] - p[b + i * 3 + UA[a]]), p[b + i * 3 + WA[a]] + t * (p[b + j * 3 + WA[a]] - p[b + i * 3 + WA[a]])]; };
      const P = pt(iA, iB), Qp = pt(iA, iC);
      if (d[iA] < 0) segs.push([P[0], P[1], Qp[0], Qp[1]]); else segs.push([Qp[0], Qp[1], P[0], P[1]]);
    }
    return segs;
  }
  function sectionPolys(p, a, v) { return loopsToPolys(joinLoops(sectionSegs(p, a, v)).loops); }
  function sectionArea(p, a, v) {
    let s = 0;
    for (const g of sectionSegs(p, a, v)) s += g[0] * g[3] - g[2] * g[1];
    return Math.abs(s / 2);
  }
  // Choose cut positions on one axis: strategy 'small' minimises seam area, 'large' maximises it.
  function smartPlanes(p, a, lo, hi, n, maxLen, strategy) {
    if (n <= 1) return [];
    const S = 160, pos = [], area = [];
    for (let i = 1; i < S; i++) { const v = lo + (hi - lo) * i / S; pos.push(v); area.push(sectionArea(p, a, v)); }
    const amax = Math.max(1e-9, ...area);
    const cost = area.map(x => strategy === 'large' ? 1 - x / amax : x / amax);
    const minGap = Math.min((hi - lo) / n * 0.35, maxLen * 0.5);
    const K = n - 1, M = pos.length;
    let prev = new Array(M).fill(Infinity), back = [];
    for (let j = 0; j < M; j++) if (pos[j] - lo <= maxLen && pos[j] - lo >= minGap) prev[j] = cost[j];
    for (let k = 1; k < K; k++) {
      const cur = new Array(M).fill(Infinity), bk = new Array(M).fill(-1);
      for (let j = 0; j < M; j++) for (let i = 0; i < j; i++) {
        const g = pos[j] - pos[i];
        if (g > maxLen || g < minGap || prev[i] === Infinity) continue;
        const c = prev[i] + cost[j]; if (c < cur[j]) { cur[j] = c; bk[j] = i; }
      }
      back.push(bk); prev = cur;
    }
    let best = -1, bc = Infinity;
    for (let j = 0; j < M; j++) if (prev[j] < bc && hi - pos[j] <= maxLen && hi - pos[j] >= minGap) { bc = prev[j]; best = j; }
    if (best < 0) return null;
    const out = [pos[best]];
    for (let k = back.length - 1; k >= 0; k--) { best = back[k][best]; out.unshift(pos[best]); }
    return out;
  }
  function surfaceArea(p) {
    let s = 0;
    for (let b = 0; b < p.length; b += 9) {
      const c = cross([p[b + 3] - p[b], p[b + 4] - p[b + 1], p[b + 5] - p[b + 2]], [p[b + 6] - p[b], p[b + 7] - p[b + 1], p[b + 8] - p[b + 2]]);
      s += Math.hypot(c[0], c[1], c[2]) / 2;
    }
    return s;
  }
  // Rotations that put each of the six box faces on the bed (all proper rotations).
  const ROTS = [
    { down: [0, 0, -1], f: (x, y, z) => [x, y, z] },
    { down: [0, 0, 1], f: (x, y, z) => [x, -y, -z] },
    { down: [-1, 0, 0], f: (x, y, z) => [-z, y, x] },
    { down: [1, 0, 0], f: (x, y, z) => [z, y, -x] },
    { down: [0, -1, 0], f: (x, y, z) => [x, -z, y] },
    { down: [0, 1, 0], f: (x, y, z) => [x, z, -y] }
  ];
  // `fit` (optional) gets the [width, depth, height] a rotation would print at; when any rotation fits, only those count.
  function bestOrientation(p, fit) {
    const bb = bbox(p); let best = null, bestFit = null;
    for (let r = 0; r < 6; r++) {
      const dn = ROTS[r].down; const a = dn[0] ? 0 : dn[1] ? 1 : 2; const s = dn[a];
      const ext = s < 0 ? bb.min[a] : bb.max[a];
      let bed = 0, over = 0;
      for (let b = 0; b < p.length; b += 9) {
        const c = cross([p[b + 3] - p[b], p[b + 4] - p[b + 1], p[b + 5] - p[b + 2]], [p[b + 6] - p[b], p[b + 7] - p[b + 1], p[b + 8] - p[b + 2]]);
        const l = Math.hypot(c[0], c[1], c[2]); if (!l) continue;
        const nd = (c[a] * s) / l, ar = l / 2;
        if (nd > 0.999 && Math.abs(p[b + a] - ext) < 0.05 && Math.abs(p[b + 3 + a] - ext) < 0.05 && Math.abs(p[b + 6 + a] - ext) < 0.05) bed += ar;
        else if (nd > 0.72) over += ar;
      }
      const h = bb.max[a] - bb.min[a];
      const score = bed - 0.6 * over - 0.01 * h;
      if (!best || score > best.score) best = { r, score, bed, over };
      if (fit) { const o = [0, 1, 2].filter(k => k !== a).map(k => bb.max[k] - bb.min[k]); if (fit([o[0], o[1], h]) && (!bestFit || score > bestFit.score)) bestFit = { r, score, bed, over }; }
    }
    return bestFit || best;
  }
  function applyRotation(p, r) {
    const f = ROTS[r].f, out = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 3) { const q = f(p[i], p[i + 1], p[i + 2]); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; }
    const bb = bbox(out);
    for (let i = 0; i < out.length; i += 3) { out[i] -= bb.min[0]; out[i + 1] -= bb.min[1]; out[i + 2] -= bb.min[2]; }
    return out;
  }

  // Grid neighbours across cut faces. A cell can hold several separate parts (islands), so each part is paired
  // with every part in the next cell whose matching cut face overlaps its own.
  function capBox2(pc, tag, axis) {
    const ua = UA[axis], wa = WA[axis]; let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity, any = false;
    for (let f = 0; f < pc.t.length; f++) if (pc.t[f] === tag) { any = true; for (let k = 0; k < 3; k++) { const u = pc.p[f * 9 + k * 3 + ua], w = pc.p[f * 9 + k * 3 + wa]; if (u < u0) u0 = u; if (u > u1) u1 = u; if (w < w0) w0 = w; if (w > w1) w1 = w; } }
    return any ? [u0, u1, w0, w1] : null;
  }
  function gridPairs(pieces, caps) {
    const byCell = new Map();
    for (const pc of pieces) { const k = pc.cell.join(','); if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(pc); }
    const pairs = [];
    for (const A of pieces) for (const tag of new Set(A.t.filter(t => t >= 0 && caps[t].sign === 1))) {
      const cap = caps[tag], nc = A.cell.slice(); nc[cap.axis] += 1;
      const Bs = (byCell.get(nc.join(',')) || []).filter(B => B.t.includes(cap.partner));
      if (Bs.length === 1 && byCell.get(A.cell.join(',')).length === 1) { pairs.push([A, Bs[0], tag, cap]); continue; }
      const a = capBox2(A, tag, cap.axis);
      for (const B of Bs) { const b = capBox2(B, cap.partner, cap.axis); if (a && b && a[0] <= b[1] + 0.01 && b[0] <= a[1] + 0.01 && a[2] <= b[3] + 0.01 && b[2] <= a[3] + 0.01) pairs.push([A, B, tag, cap]); }
    }
    return pairs;
  }
  // Split every grid cell into its separate parts (islands). Each island becomes its own part with the cell's
  // grid position; isl = 0 is the biggest. Crumbs under minVol mm\u00b3 are dropped.
  // With caps and nugget (mm\u00b3): a separate bit smaller than that (a fingertip the cut caught) is not its own part:
  // it is joined back onto the part in the next cell it was cut from, across their shared cut face.
  function splitCellIslands(pieces, minVol, caps, nugget, limit) {
    let out = [];
    for (const pc of pieces) {
      const isl = islandsOf(pc).filter(m => m.vol >= (minVol || 0));
      isl.forEach((m, i) => out.push({ cell: pc.cell, p: m.p, t: m.t, isl: i, islands: isl.length, vol: m.vol }));
    }
    if (caps && nugget) {
      const gone = new Set(), big = [0, 0, 0]; // never make a part bigger than the biggest grid cell's (it must still fit the bed)
      for (const pc of pieces) { const b = bbox(pc.p); for (let a = 0; a < 3; a++) big[a] = Math.max(big[a], b.max[a] - b.min[a]); }
      const tiny = out.filter(o => (o.vol || Math.abs(signedVolume(o.p))) < nugget).sort((a, b) => a.vol - b.vol);
      for (const N of tiny) {
        const tags = [...new Set(N.t.filter(t => t >= 0))];
        let done = false;
        for (const tag of tags) {
          const cap = caps[tag]; if (!cap || cap.axis === undefined) continue;
          const ua = UA[cap.axis], wa = WA[cap.axis], tri = [];
          for (let f = 0; f < N.t.length; f++) if (N.t[f] === tag) { const b = f * 9; tri.push([N.p[b + ua], N.p[b + wa], N.p[b + 3 + ua], N.p[b + 3 + wa], N.p[b + 6 + ua], N.p[b + 6 + wa]]); }
          const inside = (u, w) => tri.some(([a0, a1, b0, b1, c0, c1]) => { const d1 = (u - b0) * (a1 - b1) - (a0 - b0) * (w - b1), d2 = (u - c0) * (b1 - c1) - (b0 - c0) * (w - c1), d3 = (u - a0) * (c1 - a1) - (c0 - a0) * (w - a1); return !((d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9) && (d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9)); });
          for (const B of out) {
            if (B === N || gone.has(B) || !B.t.includes(cap.partner)) continue;
            const drop = new Set();
            for (let f = 0; f < B.t.length; f++) if (B.t[f] === cap.partner) { const b = f * 9; if (inside((B.p[b + ua] + B.p[b + 3 + ua] + B.p[b + 6 + ua]) / 3, (B.p[b + wa] + B.p[b + 3 + wa] + B.p[b + 6 + wa]) / 3)) drop.add(f); }
            if (!drop.size) continue;
            const p = [], t = [];
            for (let f = 0; f < B.t.length; f++) if (!drop.has(f)) { for (let k = 0; k < 9; k++) p.push(B.p[f * 9 + k]); t.push(B.t[f]); }
            for (let f = 0; f < N.t.length; f++) if (N.t[f] !== tag) { for (let k = 0; k < 9; k++) p.push(N.p[f * 9 + k]); t.push(N.t[f]); }
            { const mb = bbox(p); if ([0, 1, 2].some(a => mb.max[a] - mb.min[a] > Math.max(big[a], limit ? limit[a] - 20 : 0) + 0.01)) continue; } // room left for pegs
            if (!checkClosed(Float64Array.from(p)).closed) continue;
            B.p = p; B.t = t; B.vol = (B.vol || 0) + N.vol; gone.add(N); done = true; break;
          }
          if (done) break;
        }
      }
      if (gone.size) {
        out = out.filter(o => !gone.has(o));
        const byCell = new Map(); for (const o of out) { const k = o.cell.join(','); if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(o); }
        for (const L of byCell.values()) { L.sort((a, b) => b.vol - a.vol); L.forEach((o, i) => { o.isl = i; o.islands = L.length; }); }
      }
    }
    return out;
  }
  // Place connectors on every interface between neighbouring pieces.
  // Joints between piece A (cap `tag`, sign +1) and piece B (cap.partner). Only spots inside both cap faces are used.
  // Every placed joint is recorded in log.joints (plane coordinates) with whether both halves were cut.
  // closest distance between segments p1-q1 and p2-q2
  function segSeg(p1, q1, p2, q2) {
    const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
    let s, t;
    if (a < 1e-12 && e < 1e-12) return Math.hypot(...r);
    if (a < 1e-12) { s = 0; t = Math.max(0, Math.min(1, f / e)); }
    else { const c = dot(d1, r); if (e < 1e-12) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else { const b = dot(d1, d2), den = a * e - b * b; s = den > 1e-12 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); } } }
    const P = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s], Q = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
    return Math.hypot(P[0] - Q[0], P[1] - Q[1], P[2] - Q[2]);
  }
  // Holes already cut into a piece (world frame), so joints on neighbouring faces do not run into each other at an edge.
  const holesOf = pc => { if (!pc._holes) Object.defineProperty(pc, '_holes', { value: [], enumerable: false, writable: true }); return pc._holes; };
  function connectPair(A, B, tag, cap, opt, bvh, log, quiet) {
    const W = v => opt.frame ? vecWorld(v, opt.frame) : v;
    const holeSegs = (spec, axis, v, u, w) => {
      const pos = [0, 0, 0]; to3(axis, v, u, w, pos, 0); const dir = [0, 0, 0]; dir[axis] = 1;
      const R = spec.type === 'dovetail' ? Math.max(spec.wn / 2 + spec.c + spec.h * 0.6, (spec.Lk || 0) / 2) : (spec.rk || spec.r || 0) + (spec.c || 0) + (spec.b || 0);
      const d = spec.depth || spec.L || 0, out = [];
      const end = s => W([pos[0] + dir[0] * d * s, pos[1] + dir[1] * d * s, pos[2] + dir[2] * d * s]);
      if (spec.rev) out.push({ pc: A, p0: W(pos), p1: end(-1), R }); else out.push({ pc: B, p0: W(pos), p1: end(1), R });
      if (spec.type === 'dowel' || spec.type === 'magnet') out.push({ pc: A, p0: W(pos), p1: end(-1), R });
      return out;
    };
    const clashes = segs => segs.some(sg => holesOf(sg.pc).some(h => segSeg(sg.p0, sg.p1, h.p0, h.p1) < sg.R + h.R + Math.max(1, opt.minWall || 2)));
    const polys = capPolys(A, tag, cap.axis), polysB = capPolys(B, cap.partner, cap.axis);
    const inB = (u, w) => polysB.some(P => pip([u, w], P.outer) && !P.holes.some(h => pip([u, w], h)));
    const featA = [], featB = [], placed = [];
    let bvhA = null, bvhB = null;
    for (const poly of polys) {
      if (!polysB.length) break;
      // (with staggered seams one face meets two parts, so any shared point counts)
      const probeIn = (() => { const { cands } = regionCandidates(poly); return opt.clipB ? cands.some(q => inB(q.u, q.w)) : cands.length ? inB(cands[0].u, cands[0].w) : false; })();
      if (quiet && !probeIn) continue; // this part of A's face belongs to another neighbour
      log.interfaces++;
      if (poly.area < 4) { log.skipped++; continue; }
      const rc = regionCandidates(poly), ext = rc.ext;
      let cands = rc.cands.filter(q => inB(q.u, q.w));
      // staggered (brick) seams: A's face meets B's only in part, so a joint must also clear the edge of B's face
      if (opt.clipB) { cands = cands.map(q => ({ u: q.u, w: q.w, cl: Math.min(q.cl, clearIn(polysB, q.u, q.w)) })); cands.sort((x, y) => y.cl - x.cl); }
      if (!cands.length) { log.skipped++; continue; }
      const maxCl = cands[0].cl;
      let spec = connectorSpec(opt, maxCl);
      let scale = 1, valid = [];
      for (let attempt = 0; attempt < 4; attempt++) {
        valid = cands.filter(q => q.cl >= spec.reach);
        if (valid.length) break;
        scale *= 0.75; log.shrunk++;
        const o2 = Object.assign({}, opt, { autoSize: false, diameter: Math.max(2.5, opt.autoSize ? Math.max(3, Math.min(10, maxCl * 0.6)) * scale : opt.diameter * scale), length: Math.max(5, (opt.autoSize ? 12 : opt.length) * scale), magnetDiameter: opt.magnetDiameter });
        spec = connectorSpec(o2, maxCl);
        if (spec.type === 'magnet') break;
      }
      if (!valid.length) { log.skipped++; continue; }
      const orient = ext[0] >= ext[1] ? 0 : 1;
      let want = opt.perFace;
      if (!want) want = Math.max(1, Math.min(4, Math.round(Math.sqrt(poly.area) / (spec.reach * 5))));
      const minSep = 2 * spec.reach + 2;
      const chosen = [];
      let pool = valid.slice();
      while (chosen.length < want && pool.length) {
        let best = -1, bestD = -1;
        if (!chosen.length) best = 0;
        else for (let i = 0; i < pool.length; i++) {
          let dmin = Infinity; for (const q of chosen) dmin = Math.min(dmin, Math.hypot(pool[i].u - q.u, pool[i].w - q.w));
          if (dmin >= minSep && dmin + pool[i].cl * 0.25 > bestD) { bestD = dmin + pool[i].cl * 0.25; best = i; }
        }
        if (best < 0) break;
        const q = pool[best]; pool.splice(best, 1);
        const probes = probePoints(spec, cap.axis, cap.v, q.u, q.w, orient, opt.minWall);
        if (!probes.every(pt => inside(bvh, pt) && (!opt.cavityBVH || !inside(opt.cavityBVH, pt)))) continue;
        // free cuts at an angle (wedges): the uncut model can't see the part's other cut faces, so ask the part itself
        if (opt.clipB && !probes.every(pt => inside(pt[cap.axis] > cap.v ? (bvhB || (bvhB = buildBVH(B.p))) : (bvhA || (bvhA = buildBVH(A.p))), pt))) continue;
        const segs = holeSegs(spec, cap.axis, cap.v, q.u, q.w);
        if (clashes(segs)) continue;
        for (const sg of segs) holesOf(sg.pc).push(sg);
        chosen.push(q);
      }
      if (!chosen.length) { log.skipped++; continue; }
      for (const q of chosen) {
        const f = buildConnector(spec, cap.axis, cap.v, q.u, q.w, orient);
        featA.push(f.A); featB.push(f.B);
        if (f.pins) { log.pins++; log.pinSpec = spec; }
        log.placed++;
        placed.push({ axis: cap.axis, v: cap.v, u: q.u, w: q.w, orient, spec });
      }
    }
    if (!featA.length) return 0;
    const okA = addFeatureToPiece(A, tag, cap.axis, cap.v, +1, featA);
    const okB = addFeatureToPiece(B, cap.partner, cap.axis, cap.v, -1, featB);
    if (!log.joints) log.joints = [];
    for (const j of placed) {
      const pos = [0, 0, 0]; to3(j.axis, j.v, j.u, j.w, pos, 0);
      const dir = [0, 0, 0]; dir[j.axis] = 1;
      const ou = [0, 0, 0]; ou[j.orient === 0 ? UA[j.axis] : WA[j.axis]] = 1;
      const sp = j.spec;
      log.joints.push({ pos, dir, along: ou, type: sp.type, r: sp.r || 0, rk: sp.rk || sp.r || 0, shape: sp.shape || null, taper: !!sp.taper, rev: !!sp.rev, c: sp.c, L: sp.L || sp.Lk || 0, depth: sp.depth, b: sp.b || 0, hw: sp.type === 'dovetail' ? sp.wn / 2 + sp.c + (sp.h + sp.c) * Math.tan(sp.ang) : 0, Lk: sp.Lk || 0, okA, okB });
      const jr = log.joints[log.joints.length - 1]; // piece refs are not enumerable, so logs stay small to print or post
      Object.defineProperty(jr, 'pa', { value: A, enumerable: false, writable: true }); Object.defineProperty(jr, 'pb', { value: B, enumerable: false, writable: true });
    }
    return placed.length;
  }

  function addConnectors(pieces, caps, opt, bvh, onProgress) {
    const log = { placed: 0, pins: 0, skipped: 0, shrunk: 0, interfaces: 0, pinSpec: null, joints: [] };
    if (!opt.type || opt.type === 'none' || opt.type === 'lip') return log; // the step lip is lipJoints()
    for (const [A, B, tag, cap] of gridPairs(pieces, caps)) { connectPair(A, B, tag, cap, opt, bvh, log); if (onProgress) onProgress(); }
    return log;
  }

  // ---------------------------------------------------------------- free cut planes (any angle)
  // Orthonormal frame with n as the third axis (u x w = n), so a plane with normal n becomes "z = const".
  function basisFor(n) {
    n = norm(n);
    const ref = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = norm(cross(ref, n)), w = cross(n, u);
    return { u, w, n };
  }
  function toLocal(p, B) { // in place, plain arrays or typed arrays
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      p[i] = x * B.u[0] + y * B.u[1] + z * B.u[2]; p[i + 1] = x * B.w[0] + y * B.w[1] + z * B.w[2]; p[i + 2] = x * B.n[0] + y * B.n[1] + z * B.n[2];
    }
    return p;
  }
  function toWorld(p, B) {
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      p[i] = x * B.u[0] + y * B.w[0] + z * B.n[0]; p[i + 1] = x * B.u[1] + y * B.w[1] + z * B.n[1]; p[i + 2] = x * B.u[2] + y * B.w[2] + z * B.n[2];
    }
    return p;
  }
  const vecWorld = (v, B) => [v[0] * B.u[0] + v[1] * B.w[0] + v[2] * B.n[0], v[0] * B.u[1] + v[1] * B.w[1] + v[2] * B.n[1], v[0] * B.u[2] + v[1] * B.w[2] + v[2] * B.n[2]];
  // Edge-connected components of a triangle soup; also the open (one-sided) edges of each component.
  function components(m) {
    const n = m.t.length, par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
    const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const vk = new Array(n * 3);
    for (let i = 0; i < n * 3; i++) vk[i] = k3(m.p[i * 3], m.p[i * 3 + 1], m.p[i * 3 + 2]);
    const edges = new Map();
    for (let i = 0; i < n; i++) for (let e = 0; e < 3; e++) {
      const a = vk[i * 3 + e], b = vk[i * 3 + (e + 1) % 3]; if (a === b) continue;
      const key = a < b ? a + '|' + b : b + '|' + a;
      const l = edges.get(key); if (l) { l.push(i); par[find(i)] = find(l[0]); } else edges.set(key, [i]);
    }
    const ids = new Map(), comps = [];
    for (let i = 0; i < n; i++) { const r = find(i); let c = ids.get(r); if (c === undefined) { c = comps.length; ids.set(r, c); comps.push({ tris: [], open: [] }); } comps[c].tris.push(i); }
    for (const [key, l] of edges) if (l.length === 1) comps[ids.get(find(l[0]))].open.push(key);
    return comps;
  }
  const subMesh = (m, tris) => { const p = [], t = []; for (const i of tris) { for (let k = 0; k < 9; k++) p.push(m.p[i * 9 + k]); t.push(m.t[i]); } return { p, t }; };

  // planes: [{ c:[x,y,z] point, n:[x,y,z] normal, local:true, within }]. local = cut only the cross-section under c
  // (an arm, a leg, the neck), not everything the infinite plane passes through. within = { axis, lo, hi }: cut only
  // the parts whose middle along that axis lies between lo and hi (one layer of a brick pattern). Returns pieces + caps.

  // ---------------------------------------------------------------- conic cuts
  // A cone cut is a plane cut in a warped space: in the plane's own frame, z' = z - s\u00b7\u03c1 (\u03c1 = distance from the
  // cone's axis through (cx, cy)) turns the cone z = v + s\u00b7\u03c1 into the plane z' = v. The warp moves points only
  // along z, so it is exactly undone afterwards, every untouched vertex comes back bit for bit, and both halves
  // share the same cut points and cap, so they stay watertight.
  function coneWarp(p, s, cx, cy, dir) {
    for (let i = 0; i < p.length; i += 3) p[i + 2] -= dir * s * Math.hypot(p[i] - cx, p[i + 1] - cy);
    return p;
  }
  // Indexed mesh for local refinement: exact-coordinate welding (soups repeat shared vertices exactly).
  function indexMesh(p, t) {
    const vid = new Map(), V = [], F = [], tag = [];
    const at = i => { const key = p[i] + ',' + p[i + 1] + ',' + p[i + 2]; let k = vid.get(key); if (k === undefined) { k = V.length / 3; vid.set(key, k); V.push(p[i], p[i + 1], p[i + 2]); } return k; };
    for (let f = 0; f < p.length / 9; f++) { F.push(at(f * 9), at(f * 9 + 3), at(f * 9 + 6)); tag.push(t[f]); }
    return { V, F, tag };
  }
  // Longest-edge bisection (Rivara's LEPP), conforming: splitting an edge splits every triangle on it, and a
  // neighbour with a longer edge is split first, so triangles keep their shape and no T-junctions appear.
  // pick(f) returns the local edge index (0: v0-v1, 1: v1-v2, 2: v2-v0) to split, or -1; can(a, b) says an edge
  // may be split at all (a cap keeps its rim).
  function bisect(M, pick, maxTris, can) {
    const { V, F, tag } = M, dead = [], E = new Map();
    can = can || (() => true);
    const ek = (a, b) => a < b ? a * 67108864 + b : b * 67108864 + a;
    const addE = f => { for (let e = 0; e < 3; e++) { const k = ek(F[f * 3 + e], F[f * 3 + (e + 1) % 3]); let l = E.get(k); if (!l) E.set(k, l = []); l.push(f); } };
    const len2 = (a, b) => (V[a * 3] - V[b * 3]) ** 2 + (V[a * 3 + 1] - V[b * 3 + 1]) ** 2 + (V[a * 3 + 2] - V[b * 3 + 2]) ** 2;
    const longest = f => { let best = -1, bl = -1; for (let e = 0; e < 3; e++) { const a = F[f * 3 + e], b = F[f * 3 + (e + 1) % 3]; if (!can(a, b)) continue; const l = len2(a, b); if (l > bl) { bl = l; best = e; } } return best; };
    const nF = () => F.length / 3;
    for (let f = 0; f < nF(); f++) { dead.push(false); addE(f); }
    const work = []; for (let f = 0; f < nF(); f++) work.push(f);
    const forced = new Set();
    let guard = 0;
    while (work.length && nF() < maxTris && guard++ < 4 * maxTris) {
      const f = work.pop(); if (dead[f]) continue;
      const e = forced.has(f) ? longest(f) : pick(f, M); forced.delete(f); if (e < 0) continue;
      const a = F[f * 3 + e], b = F[f * 3 + (e + 1) % 3], k = ek(a, b), lab = len2(a, b);
      // LEPP: if the triangle across this edge has a longer edge, split that one first and come back
      const nb = (E.get(k) || []).find(g => g !== f && !dead[g]);
      if (nb !== undefined) {
        const eg = longest(nb);
        if (eg >= 0 && len2(F[nb * 3 + eg], F[nb * 3 + (eg + 1) % 3]) > lab * (1 + 1e-9)) { work.push(f, nb); forced.add(nb); continue; }
      }
      const m = V.length / 3; V.push((V[a * 3] + V[b * 3]) / 2, (V[a * 3 + 1] + V[b * 3 + 1]) / 2, (V[a * 3 + 2] + V[b * 3 + 2]) / 2);
      for (const g of E.get(k) || []) {
        if (dead[g]) continue;
        // rotate g so its edge {a, b} comes first, keeping its orientation
        let r = 0; while (r < 3) { const x = F[g * 3 + r], y = F[g * 3 + (r + 1) % 3]; if ((x === a && y === b) || (x === b && y === a)) break; r++; }
        if (r === 3) continue;
        const x = F[g * 3 + r], y = F[g * 3 + (r + 1) % 3], c = F[g * 3 + (r + 2) % 3];
        dead[g] = true;
        for (const tri of [[x, m, c], [m, y, c]]) { const h = nF(); F.push(tri[0], tri[1], tri[2]); tag.push(tag[g]); dead.push(false); addE(h); work.push(h); }
      }
      E.delete(k);
    }
    const p = [], t = [];
    for (let f = 0; f < nF(); f++) if (!dead[f]) { for (let q = 0; q < 3; q++) { const v = F[f * 3 + q]; p.push(V[v * 3], V[v * 3 + 1], V[v * 3 + 2]); } t.push(tag[f]); }
    return { p, t };
  }
  // split the triangles the cone crosses until their edges are at most L long, so the cut follows the curve
  function refineAcrossCone(p, t, s, cx, cy, v, L, maxTris) {
    const M = indexMesh(p, t), V = M.V;
    const fv = i => V[i * 3 + 2] - s * Math.hypot(V[i * 3] - cx, V[i * 3 + 1] - cy) - v;
    const len2 = (a, b) => (V[a * 3] - V[b * 3]) ** 2 + (V[a * 3 + 1] - V[b * 3 + 1]) ** 2 + (V[a * 3 + 2] - V[b * 3 + 2]) ** 2;
    const pick = (f, M2) => {
      const F = M2.F, a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2], fa = fv(a), fb = fv(b), fc = fv(c);
      if (Math.min(fa, fb, fc) > 0 || Math.max(fa, fb, fc) < 0) return -1;
      const l = [len2(a, b), len2(b, c), len2(c, a)], e = l[0] >= l[1] && l[0] >= l[2] ? 0 : l[1] >= l[2] ? 1 : 2;
      return l[e] > L * L ? e : -1;
    };
    return bisect(M, pick, maxTris);
  }
  // Refine a flat cap (in warped space, z' = v) until lifting it onto the cone strays less than tol: only edges
  // inside the cap are split, so its rim still matches the walls exactly. Returns the cap triangles as a soup.
  function refineConeCap(cp, s, cx, cy, tol, maxTris) {
    const M = indexMesh(cp, new Array(cp.length / 9).fill(0)), V = M.V;
    const rho = (x, y) => Math.hypot(x - cx, y - cy), rv = i => rho(V[i * 3], V[i * 3 + 1]);
    const edgeErr = (a, b) => Math.abs(s) * ((rv(a) + rv(b)) / 2 - rho((V[a * 3] + V[b * 3]) / 2, (V[a * 3 + 1] + V[b * 3 + 1]) / 2));
    const use = new Map(), ek = (a, b) => a < b ? a + ',' + b : b + ',' + a;
    for (let f = 0; f < M.F.length / 3; f++) for (let e = 0; e < 3; e++) { const k = ek(M.F[f * 3 + e], M.F[f * 3 + (e + 1) % 3]); use.set(k, (use.get(k) || 0) + 1); }
    const rim = new Set([...use].filter(([, n]) => n === 1).map(([k]) => k));
    const pick = (f, M2) => {
      const F = M2.F, ids = [F[f * 3], F[f * 3 + 1], F[f * 3 + 2]];
      const cxm = (V[ids[0] * 3] + V[ids[1] * 3] + V[ids[2] * 3]) / 3, cym = (V[ids[0] * 3 + 1] + V[ids[1] * 3 + 1] + V[ids[2] * 3 + 1]) / 3;
      let worst = Math.abs(s) * ((rv(ids[0]) + rv(ids[1]) + rv(ids[2])) / 3 - rho(cxm, cym)), best = -1, bl = 0;
      for (let e = 0; e < 3; e++) {
        const a = ids[e], b = ids[(e + 1) % 3]; if (rim.has(ek(a, b))) continue;
        worst = Math.max(worst, edgeErr(a, b));
        const l = (V[a * 3] - V[b * 3]) ** 2 + (V[a * 3 + 1] - V[b * 3 + 1]) ** 2; if (l > bl) { bl = l; best = e; }
      }
      return worst > tol && bl > 1e-4 ? best : -1;
    };
    return bisect(M, pick, maxTris, (a, b) => !rim.has(ek(a, b))).p;
  }
  function cutFree(soup, planes, onProgress) {
    const st = { pieces: [{ p: Array.from(soup), t: new Array(soup.length / 9).fill(-1) }], caps: [], warn: [] };
    planes.forEach((pl, k) => { freeStep(st, pl, k); if (onProgress) onProgress((k + 1) / planes.length); });
    return st;
  }
  // One free cut (plane number k) applied to st.pieces in place. pl.only (a Set of pieces): cut just those.
  // pl.exclude (world points): cross-sections around any of them are left uncut (a sliver there stays on its part).
  // Returns the parts the cut made (one entry per resulting part of the pieces it crossed).
  function freeStep(st, pl, k) {
    const caps = st.caps, warn = st.warn, pieces = st.pieces;
    {
      const B = basisFor(pl.n), c = [dot(pl.c, B.u), dot(pl.c, B.w), dot(pl.c, B.n)];
      const within = pl.within ? pc => { const a = pl.within.axis; let lo = Infinity, hi = -Infinity; for (let q = a; q < pc.p.length; q += 3) { if (pc.p[q] < lo) lo = pc.p[q]; if (pc.p[q] > hi) hi = pc.p[q]; } const m = (lo + hi) / 2; return m > pl.within.lo && m < pl.within.hi; } : () => true;
      const ins = pieces.map(pc => within(pc) && (!pl.only || pl.only.has(pc)));
      // cone: pl.cone degrees between the cone and the plane, positive = the tip points along n
      const cone = pl.cone ? Math.max(-60, Math.min(60, pl.cone)) : 0, sl = cone ? -Math.tan(cone * Math.PI / 180) : 0;
      const local = pieces.map((pc, i) => {
        if (!ins[i]) return null;
        const lp = toLocal(pc.p.slice(), B);
        if (!sl) return lp;
        const bb = bbox(lp), D = Math.hypot(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]);
        const r = refineAcrossCone(lp, pc.t, sl, c[0], c[1], c[2], Math.max(0.4, Math.min(2, D / 120)), lp.length / 9 + 400000);
        const w = coneWarp(r.p, sl, c[0], c[1], 1); w.t = r.t; return w;
      });
      let v = c[2];
      for (let it = 0; it < 60; it++) { if (!local.some(lp => { if (!lp) return false; for (let i = 2; i < lp.length; i += 3) if (Math.abs(lp[i] - v) < 1e-5) return true; return false; })) break; v += 1.37e-4; }
      // which cross-sections does this plane cut?
      // a crossing point that lands on a rounding boundary breaks a section loop: slide the plane a hair and retry
      for (let it = 0; it < 8; it++) { if (!local.some(lp => lp && joinLoops(sectionSegs(lp, 2, v)).broken)) break; v += 0.00731 * (it + 1); }
      const sections = local.map(lp => lp ? sectionPolys(lp, 2, v) : []);
      const inPoly = (P, q) => pip(q, P.outer) && !P.holes.some(h => pip(q, h));
      const distTo = P => { let d = Infinity; for (const lp of [P.outer, ...P.holes]) for (let i = 0, j = lp.length - 1; i < lp.length; j = i++) d = Math.min(d, segDist(c[0], c[1], lp[j][0], lp[j][1], lp[i][0], lp[i][1])); return d; };
      let select = () => true;
      if (pl.local !== false) {
        const hit = sections.some(ps => ps.some(P => pip([c[0], c[1]], P.outer)));
        if (hit) select = P => pip([c[0], c[1]], P.outer);
        else { let dmin = Infinity; for (const ps of sections) for (const P of ps) dmin = Math.min(dmin, distTo(P)); select = P => distTo(P) <= dmin + 1e-6; }
      }
      if (pl.exclude && pl.exclude.length) { const ex = pl.exclude.map(q => [dot(q, B.u), dot(q, B.w)]), s0 = select; select = P => s0(P) && !ex.some(q => pip(q, P.outer) && !P.holes.some(h => pip(q, h))); }
      const idN = caps.length, idP = idN + 1;
      caps.push({ id: idN, plane: k, sign: +1, partner: idP, v, B, cone }, { id: idP, plane: k, sign: -1, partner: idN, v, B, cone });
      const next = [], made = []; let cutAny = false;
      pieces.forEach((pc, i) => {
        if (!ins[i] || !sections[i].some(select)) { next.push(pc); return; }
        cutAny = true;
        const r = cutPlane({ p: local[i], t: local[i].t || pc.t }, 2, v, idN, idP, select);
        if (r.broken) warn.push(`Cut ${k + 1} crossed an open or self-intersecting part of the mesh.`);
        if (sl) { // refine the cap so it follows the cone once lifted, and give the other half the same cap, reversed
          const capN = [], restN = { p: [], t: [] }, restP = { p: [], t: [] };
          r.neg.t.forEach((tg, f) => { const dst = tg === idN ? null : restN; for (let q = 0; q < 9; q++) (dst ? dst.p : capN).push(r.neg.p[f * 9 + q]); if (dst) dst.t.push(tg); });
          r.pos.t.forEach((tg, f) => { if (tg === idP) return; for (let q = 0; q < 9; q++) restP.p.push(r.pos.p[f * 9 + q]); restP.t.push(tg); });
          const cap = refineConeCap(capN, sl, c[0], c[1], 0.04, capN.length / 9 + 300000);
          for (let f = 0; f < cap.length; f += 9) {
            for (let q = 0; q < 9; q++) restN.p.push(cap[f + q]); restN.t.push(idN);
            restP.p.push(cap[f], cap[f + 1], cap[f + 2], cap[f + 6], cap[f + 7], cap[f + 8], cap[f + 3], cap[f + 4], cap[f + 5]); restP.t.push(idP);
          }
          r.neg = restN; r.pos = restP;
        }
        const cn = components(r.neg), cp = components(r.pos);
        // re-join halves across the cross-sections that were not chosen (their seams are open on both sides)
        const owner = new Map(); cn.forEach((cc, j) => cc.open.forEach(e => owner.set(e, j)));
        const par = cn.map((_, j) => j).concat(cp.map((_, j) => cn.length + j));
        const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
        cp.forEach((cc, j) => cc.open.forEach(e => { const o = owner.get(e); if (o !== undefined) par[find(cn.length + j)] = find(o); }));
        const groups = new Map();
        const add = (root, mesh, tris) => { let g = groups.get(root); if (!g) { g = { p: [], t: [] }; groups.set(root, g); } const s = subMesh(mesh, tris); for (const x of s.p) g.p.push(x); for (const x of s.t) g.t.push(x); };
        cn.forEach((cc, j) => add(find(j), r.neg, cc.tris));
        cp.forEach((cc, j) => add(find(cn.length + j), r.pos, cc.tris));
        const out = [];
        for (const g of groups.values()) { if (sl) coneWarp(g.p, sl, c[0], c[1], -1); toWorld(g.p, B); out.push(g); }
        // shells that overlap (a detail sunk into the body, kept as its own shell) stay on the part they sit in
        for (const g of mergeOverlapping(out)) { next.push(g); made.push(g); }
      });
      if (!cutAny && !pl.quiet) warn.push(`Cut ${k + 1} does not cross the model.`);
      st.pieces = next;
      return made;
    }
  }
  // Parts that are separate shells but overlap in space (one shell sunk into or inside another) belong together:
  // merge any whose original-surface triangle centres lie inside another part. Parts that only meet at a cut face
  // never merge (their surface triangles sit strictly on their own side of it).
  function mergeOverlapping(list) {
    if (list.length < 2) return list;
    const info = list.map(m => { const b = bbox(m.p); return { m, b, vol: Math.abs(signedVolume(m.p)), bvh: null }; });
    const par = info.map((_, i) => i), find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const touch = (A, B) => [0, 1, 2].every(a => A.b.min[a] < B.b.max[a] - 1e-6 && B.b.min[a] < A.b.max[a] - 1e-6);
    for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++) {
      if (find(i) === find(j) || !touch(info[i], info[j])) continue;
      const [S, L] = info[i].vol < info[j].vol ? [info[i], info[j]] : [info[j], info[i]];
      if (!L.bvh) L.bvh = buildBVH(Float64Array.from(L.m.p));
      const surf = []; for (let f = 0; f < S.m.t.length; f++) if (S.m.t[f] < 0) surf.push(f);
      const step = Math.max(1, Math.floor(surf.length / 48)); let hit = false;
      for (let s = 0; s < surf.length && !hit; s += step) {
        const b = surf[s] * 9, q = [(S.m.p[b] + S.m.p[b + 3] + S.m.p[b + 6]) / 3 + 1.1e-5, (S.m.p[b + 1] + S.m.p[b + 4] + S.m.p[b + 7]) / 3 + 1.7e-5, (S.m.p[b + 2] + S.m.p[b + 5] + S.m.p[b + 8]) / 3 + 0.9e-5];
        if ([0, 1, 2].some(a => q[a] < L.b.min[a] || q[a] > L.b.max[a])) continue;
        if (inside(L.bvh, q)) hit = true;
      }
      if (hit) par[find(i)] = find(j);
    }
    const groups = new Map();
    info.forEach((x, i) => { const r = find(i); let g = groups.get(r); if (!g) { g = { p: [], t: [] }; groups.set(r, g); } for (const v of x.m.p) g.p.push(v); for (const v of x.m.t) g.t.push(v); });
    return groups.size === list.length ? list : [...groups.values()];
  }
  // Connected parts of one cut part (a grid cell can hold the hip and, beside it, a hand that only reaches into the
  // cell): edge-connected shells, with overlapping shells kept together. Returns [{ p, t, vol }] biggest first.
  function islandsOf(pc) {
    const cc = components(pc);
    if (cc.length < 2) return [{ p: pc.p, t: pc.t, vol: Math.abs(signedVolume(pc.p)) }];
    const parts = mergeOverlapping(cc.map(c => subMesh(pc, c.tris)));
    return parts.map(m => ({ p: m.p, t: m.t, vol: Math.abs(signedVolume(m.p)) })).sort((a, b) => b.vol - a.vol);
  }

  // ---------------------------------------------------------------- shape-aware split (limbs first, then bed fit)
  // How the model is built, read from cross-sections: slice a part along an axis and link the section regions of
  // neighbouring slices. A run of single regions that starts at a free end (a hand, a foot, the top of the head, a
  // tail) and ends where it merges into a bigger region or the section suddenly grows (the body) is a limb. Limbs
  // are cut off flat at their narrowest point near the body, so an arm never carries a chunk of the torso; whatever
  // is still too big for the bed is then cut across its narrowest sections (waist, neck), and a cut that would leave
  // a small loose bit (a fingertip poking past the plane) skips that bit so it stays on the part it belongs to.
  function interiorPoint(P) {
    const o = P.outer; let w0 = Infinity, w1 = -Infinity; for (const q of o) { if (q[1] < w0) w0 = q[1]; if (q[1] > w1) w1 = q[1]; }
    let best = null;
    for (const f of [0.5, 0.37, 0.63, 0.25, 0.75]) {
      const y = w0 + (w1 - w0) * f + 1.3e-7, xs = [];
      for (const L of [o, ...P.holes]) for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[j], b = L[i]; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) if (!best || xs[k + 1] - xs[k] > best.w) best = { w: xs[k + 1] - xs[k], q: [(xs[k] + xs[k + 1]) / 2, y] };
      if (best && best.w > 0) break;
    }
    return best ? best.q : o[0].slice();
  }
  function sliceGraph(p, a, N, bb) {
    const lo = bb.min[a], hi = bb.max[a], h = (hi - lo) / N, S = [];
    for (let i = 0; i < N; i++) {
      const v = lo + (i + 0.5) * h;
      const polys = loopsToPolys(joinLoops(sectionSegs(p, a, v)).loops, true).filter(P => !P.inv && P.area > 1e-6);
      S.push(polys.map(P => {
        let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity; for (const q of P.outer) { if (q[0] < u0) u0 = q[0]; if (q[0] > u1) u1 = q[0]; if (q[1] < w0) w0 = q[1]; if (q[1] > w1) w1 = q[1]; }
        return { i, v, area: P.area, b: [u0, u1, w0, w1], pt: interiorPoint(P), P, up: [], dn: [] };
      }));
    }
    const inP = (q, P) => pip(q, P.outer) && !P.holes.some(hh => pip(q, hh));
    for (let i = 0; i + 1 < N; i++) for (const A of S[i]) for (const B of S[i + 1]) {
      if (A.b[0] > B.b[1] || B.b[0] > A.b[1] || A.b[2] > B.b[3] || B.b[2] > A.b[3]) continue;
      let ov = inP(A.pt, B.P) || inP(B.pt, A.P);
      if (!ov) { const st = Math.max(1, Math.floor(A.P.outer.length / 12)); for (let k = 0; k < A.P.outer.length && !ov; k += st) ov = inP(A.P.outer[k], B.P); }
      if (!ov) { const st = Math.max(1, Math.floor(B.P.outer.length / 12)); for (let k = 0; k < B.P.outer.length && !ov; k += st) ov = inP(B.P.outer[k], A.P); }
      if (ov) { A.up.push(B); B.dn.push(A); }
    }
    // slices to the nearest free end, down and up: a cut through a section 1-2 slices from an end only grazes it
    for (const row of S) for (const n of row) n.eDn = n.dn.length ? 1 + Math.min(...n.dn.map(m => m.eDn)) : 0;
    for (let i = N - 1; i >= 0; i--) for (const n of S[i]) n.eUp = n.up.length ? 1 + Math.min(...n.up.map(m => m.eUp)) : 0;
    const A = S.map(row => row.reduce((t, n) => t + n.area, 0));
    return { a, lo, hi, h, S, A };
  }
  // Limb runs on one slice graph: [{ dir, chain, j (cut node), junction }]. dir +1: the free end is at the low side.
  function limbRuns(G) {
    const out = [];
    for (const dir of [1, -1]) for (const row of G.S) for (const n0 of row) {
      if ((dir > 0 ? n0.dn : n0.up).length) continue; // not a free end
      const chain = [n0]; let cur = n0, junction = null, maxA = n0.area, narrowed = false;
      for (;;) {
        const fw = dir > 0 ? cur.up : cur.dn; if (fw.length !== 1) break; // the part ends, or splits (fingers, two legs)
        const m = fw[0], bk = dir > 0 ? m.dn : m.up;
        if (bk.length >= 2) { junction = m; break; } // merges with another region: the body
        // the section grows well past the limb's typical size (and stays big): the body
        // (counted once the limb has narrowed after its widest point, so the growing tip itself never counts), or
        // it jumps at once
        if (chain.length >= 3 && (narrowed && m.area > 2.3 * narrowed.med && m.area > 1.15 * narrowed.max || m.area > 1.5 * cur.area && m.area > 2.3 * maxA)) {
          const ref = narrowed ? Math.min(narrowed.med * 2.3, narrowed.max * 1.15) : 2.3 * maxA;
          const nx = (dir > 0 ? m.up : m.dn); if (nx.length !== 1 || nx[0].area > ref) { junction = m; break; }
        }
        if (!narrowed && m.area < 0.75 * maxA) narrowed = { med: chain.map(n => n.area).sort((x, y) => x - y)[chain.length >> 1], max: maxA }; // the limb's own size, kept
        chain.push(m); cur = m; if (m.area > maxA) maxA = m.area;
      }
      if (!junction || chain.length < 3) continue;
      // the cut: narrow, and close to the body (an arm comes off at the shoulder, not the elbow)
      const L = chain.length; let j = -1, best = Infinity;
      // never past where the section climbs out of the limb's narrowest part into the body (a cut there would take
      // a slice of the body with the limb)
      const k0 = Math.max(1, Math.floor(L * 0.6)); let kMax = L - 1, lo = Infinity;
      const rb = [Infinity, -Infinity, Infinity, -Infinity], grow = (r, b) => { r[0] = Math.min(r[0], b[0]); r[1] = Math.max(r[1], b[1]); r[2] = Math.min(r[2], b[2]); r[3] = Math.max(r[3], b[3]); };
      for (let k = 0; k < k0; k++) grow(rb, chain[k].b);
      for (let k = k0; k < L; k++) {
        lo = Math.min(lo, chain[k].area); const b = chain[k].b;
        // nor where the section suddenly reaches out sideways: it has joined something else (legs standing on a base)
        const tu = Math.max(3, 0.25 * (rb[1] - rb[0])), tw = Math.max(3, 0.25 * (rb[3] - rb[2]));
        const out = b[0] < rb[0] - tu || b[1] > rb[1] + tu || b[2] < rb[2] - tw || b[3] > rb[3] + tw;
        if (k > k0 && chain[k].area > 2 * lo || out) { kMax = k - 1; break; }
        grow(rb, b);
      }
      for (let k = Math.min(k0, kMax); k <= kMax; k++) { const s = chain[k].area * (1 + 0.5 * (L - 1 - k) / L); if (s < best) { best = s; j = k; } }
      if (j < 1) continue;
      out.push({ dir, chain, j, kMin: Math.min(k0, kMax), kMax, junction, axis: G.a, h: G.h, area: chain[j].area });
    }
    return out;
  }
  function boxOfNodes(G, nodes, cutV, dir, bb) { // 3D box of section nodes (each a slab h thick), clipped to bb
    const a = G.a, ua = UA[a], wa = WA[a], mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const n of nodes) {
      const v0 = n.v - G.h / 2, v1 = n.v + G.h / 2;
      if (v0 < mn[a]) mn[a] = v0; if (v1 > mx[a]) mx[a] = v1;
      if (n.b[0] < mn[ua]) mn[ua] = n.b[0]; if (n.b[1] > mx[ua]) mx[ua] = n.b[1]; if (n.b[2] < mn[wa]) mn[wa] = n.b[2]; if (n.b[3] > mx[wa]) mx[wa] = n.b[3];
    }
    if (cutV != null) { if (dir > 0) mx[a] = cutV; else mn[a] = cutV; }
    for (let k = 0; k < 3; k++) { mn[k] = Math.max(mn[k], bb.min[k]); mx[k] = Math.min(mx[k], bb.max[k]); }
    return { min: mn, max: mx };
  }
  // Parts needed to print a box of `dims` on `bed` (whole parts first; rot: any of the six axis turns).
  function partsFor(dims, opt) {
    const E = opt.bed, pr = opt.pr || 0, perms = opt.rot ? [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]] : [[0, 1, 2]];
    let best = Infinity;
    for (const pm of perms) {
      let n = 1; for (let a = 0; a < 3; a++) { const D = dims[a], e = E[pm[a]]; n *= D <= e + 1e-6 ? 1 : Math.ceil(D / Math.max(5, e - pr) - 1e-9); }
      if (n < best) best = n;
    }
    return best;
  }
  function smartSplit(soup, opt) {
    opt = Object.assign({ rot: true, pr: 0, maxParts: 400 }, opt);
    const tot = Math.abs(signedVolume(soup)), minVol = opt.minVol || Math.max(2000, Math.min(tot * 0.003, 0.01 * opt.bed[0] * opt.bed[1] * opt.bed[2])); // a small bit: small next to the model and to the bed
    const st = { pieces: [{ p: Array.from(soup), t: new Array(soup.length / 9).fill(-1) }], caps: [], warn: [] };
    const planes = [], info = new Map(); // piece -> { cutAx: Set }
    info.set(st.pieces[0], { cutAx: new Set() });
    const dimsOf = b => [0, 1, 2].map(a => b.max[a] - b.min[a]);
    const padded = (b, ax, est) => dimsOf(b).map((d, a) => d + (ax.has(a) ? opt.pr : 0) + (est ? 2 : 0)); // est: a margin for estimates from slices
    const fits = pc => partsFor(padded(bbox(pc.p), info.get(pc).cutAx), Object.assign({}, opt, { pr: 0 })) === 1 && dimsOf(bbox(pc.p)).every((d, a) => true);
    const thin = Math.max(20, 0.16 * Math.min(...opt.bed));
    // a small bit: small next to the model and the bed, and next to the part it came off (a slender part cut into
    // bed lengths is not a pile of small bits)
    let mvNow = minVol;
    const small = m => { const v = Math.abs(signedVolume(m.p)); if (v < mvNow) return true; const t = Math.min(...dimsOf(bbox(m.p))); return t < 3 || (t < thin && v < 5 * mvNow); };
    // one cut on the parts in `only`; a resulting part that is a small loose bit is not cut off: that section is
    // skipped (it stays on its own side) and the cut is redone. Returns the new parts, or null if nothing was cut.
    function cut(pl, only, axis, strict) {
      const saveP = st.pieces.slice(), saveC = st.caps.length, exclude = [];
      let ov = 0; for (const pc of only) ov += Math.abs(signedVolume(pc.p)); mvNow = Math.min(minVol, 0.15 * ov);
      for (let attempt = 0; attempt < 5; attempt++) {
        st.pieces = saveP.slice(); st.caps.length = saveC;
        const made = freeStep(st, Object.assign({}, pl, { only, exclude, quiet: true }), planes.length);
        if (made.length < 2) { // nothing was cut off (or skipping the small bits left nothing to cut)
          st.pieces = saveP; st.caps.length = saveC;
          if (!attempt || strict) return null;
          exclude.length = 0; attempt = 3; continue; // the plain cut, small bits and all
        }
        const bad = made.filter(small);
        if (bad.length && attempt === 4 && strict) { st.pieces = saveP; st.caps.length = saveC; return null; }
        if (!bad.length || attempt === 4) {
          const parentAx = new Set(); for (const pc of only) if (info.has(pc)) for (const x of info.get(pc).cutAx) parentAx.add(x);
          for (const m of made) { const ax = new Set(parentAx); if (m.t.some(t => t === saveC || t === saveC + 1)) ax.add(axis); info.set(m, { cutAx: ax }); }
          planes.push(Object.assign({ c: pl.c, n: pl.n, local: pl.local }, { kind: pl.kind }));
          if (bad.length) st.warn.push(`A cut left ${bad.length} small part${bad.length > 1 ? 's' : ''} that could not be kept on a neighbor.`);
          return made;
        }
        // where each small bit touches this cut: one point inside its cap face, so that cross-section is skipped
        for (const m of bad) for (let f = 0; f < m.t.length; f++) if (m.t[f] === saveC || m.t[f] === saveC + 1) { const b = f * 9; exclude.push([(m.p[b] + m.p[b + 3] + m.p[b + 6]) / 3, (m.p[b + 1] + m.p[b + 4] + m.p[b + 7]) / 3, (m.p[b + 2] + m.p[b + 5] + m.p[b + 8]) / 3]); break; }
      }
      return null;
    }
    const axisN = a => { const n = [0, 0, 0]; n[a] = 1; return n; };
    const point3 = (a, v, q) => { const c = [0, 0, 0]; c[a] = v; c[UA[a]] = q[0]; c[WA[a]] = q[1]; return c; };
    let guard = 0, limbCuts = 0;
    for (;;) {
      if (++guard > 300 || st.pieces.length > opt.maxParts) { st.warn.push('Stopped early: the model needs a very large number of parts.'); break; }
      const todo = st.pieces.filter(pc => !info.get(pc).stuck && !fits(pc));
      if (!todo.length) break;
      if (opt.onProgress) { let left = 0; for (const pc of todo) left += Math.abs(signedVolume(pc.p)); opt.onProgress(Math.min(0.95, 1 - left / tot)); }
      const P = todo.reduce((m, pc) => Math.abs(signedVolume(pc.p)) > Math.abs(signedVolume(m.p)) ? pc : m, todo[0]);
      const bb = bbox(P.p), d = dimsOf(bb), ax0 = info.get(P).cutAx, pvol = Math.abs(signedVolume(P.p));
      const need0 = partsFor(padded(bb, ax0), opt), bvol = d[0] * d[1] * d[2];
      const graphs = [0, 1, 2].map(a => sliceGraph(P.p, a, Math.max(24, Math.min(64, Math.round(d[a] / 6))), bb));
      // ---- limbs: on each axis and side, the free-end runs ordered by how far they reach; try cutting the first k
      let bestMove = null;
      if (limbCuts < 24) for (const G of graphs) for (const dir of [1, -1]) {
        const runs = limbRuns(G).filter(r => r.dir === dir);
        if (!runs.length) continue;
        let maxSec = 0; for (const row of G.S) { let s = 0; for (const n of row) s += n.area; if (s > maxSec) maxSec = s; }
        const ok = runs.filter(r => {
          if (r.area > 0.45 * maxSec) return false; // too thick to be a limb
          let bv = 0; for (let k = 0; k < r.j; k++) bv += r.chain[k].area * G.h;
          r.vol = bv; return bv >= minVol * 1.5 && bv <= 0.6 * pvol;
        });
        // where along the limb: as close to the body as lets the limb print in the fewest parts (a leg that just
        // misses the bed comes off a little lower instead of losing its foot), narrow sections preferred
        const rax0 = new Set(ax0); rax0.add(G.a);
        const allNodes = []; for (const row of G.S) for (const n of row) allNodes.push(n);
        for (const r of ok) {
          const L = r.chain.length; let bestK = r.j, bp = Infinity, bs = Infinity;
          for (let k = r.kMin; k <= r.kMax; k++) {
            // the limb and what is left of the body, both: a cut a little further in can let the body fit too
            const gone = new Set(r.chain.slice(0, k)), rest = allNodes.filter(n => !gone.has(n));
            const pk = partsFor(padded(boxOfNodes(G, r.chain.slice(0, k + 1), r.chain[k].v, dir, bb), rax0, 1), opt) + (rest.length ? partsFor(padded(boxOfNodes(G, rest, r.chain[k].v, -dir, bb), rax0, 1), opt) : 0);
            const sk = r.chain[k].area * (1 + 0.5 * (L - 1 - k) / L);
            if (pk < bp || (pk === bp && sk < bs)) { bp = pk; bs = sk; bestK = k; }
          }
          r.j = bestK; r.area = r.chain[bestK].area;
        }
        ok.sort((x, y) => dir > 0 ? x.chain[0].v - y.chain[0].v : y.chain[0].v - x.chain[0].v);
        for (let k = 1; k <= Math.min(ok.length, 6); k++) {
          const sel = ok.slice(0, k), gone = new Set(); for (const r of sel) for (let q = 0; q < r.j; q++) gone.add(r.chain[q]);
          const rest = []; for (const row of G.S) for (const n of row) if (!gone.has(n)) rest.push(n);
          if (!rest.length) continue;
          const rb = boxOfNodes(G, rest, null, 0, bb), rax = new Set(ax0); rax.add(G.a);
          let parts = partsFor(padded(rb, rax, 1), opt);
          for (const r of sel) { const lb = boxOfNodes(G, r.chain.slice(0, r.j + 1), r.chain[r.j].v, dir, bb); parts += partsFor(padded(lb, rax, 1), opt); }
          const shrink = 1 - (dimsOf(rb).reduce((x, y) => x * y, 1)) / bvol;
          // a limb taken off at the body may cost a part or two (it still has to fit the bed itself); worth it when
          // the rest gets clearly smaller
          const score = (need0 - parts) + 2 * shrink - 0.12 * k;
          if (shrink >= 0.15 && parts <= need0 + 2 * k && (!bestMove || score > bestMove.score)) bestMove = { score, G, sel };
        }
      }
      if (bestMove) {
        const G = bestMove.G; let cutAny = false;
        for (const r of bestMove.sel) {
          const n = r.chain[r.j], fam = st.pieces.filter(pc => pc === P || (info.get(pc) && info.get(pc).from === P));
          const made = cut({ c: point3(G.a, n.v, n.pt), n: axisN(G.a), local: true, kind: 'limb' }, new Set(fam), G.a, true);
          if (made) { cutAny = true; limbCuts++; for (const m of made) info.get(m).from = P; }
        }
        if (cutAny) continue;
      }
      // ---- too big and no limb to take off: cut across, at the narrowest sections, as few times as the bed needs
      const slabs = [];
      for (let a = 0; a < 3; a++) {
        const others = [0, 1, 2].filter(x => x !== a), rax = new Set(ax0); rax.add(a);
        // how many pieces along a, if the other two axes are fine as they are
        const G = graphs[a];
        for (let i = 1; i < G.S.length - 1; i++) {
          const v = G.lo + (i + 0.5) * G.h; // between slices i and i+1 (cut at a slice centre is fine too)
          const below = [], above = [];
          for (const row of G.S) for (const n of row) { if (n.i <= i) below.push(n); if (n.i >= i) above.push(n); }
          if (!below.length || !above.length) continue;
          const b1 = boxOfNodes(G, below, v, 1, bb), b2 = boxOfNodes(G, above, v, -1, bb);
          const parts = partsFor(padded(b1, rax, 1), opt) + partsFor(padded(b2, rax, 1), opt);
          let sec = 0; for (const n of G.S[i]) sec += n.area;
          let vb = 0; for (const n of below) vb += n.area * G.h;
          if (vb < Math.min(minVol, 0.15 * pvol) || pvol - vb < Math.min(minVol, 0.15 * pvol)) continue;
          if (Math.min(v - bb.min[a], bb.max[a] - v) < Math.max(25, 0.2 * Math.min(...opt.bed))) continue; // no thin slabs
          // fewer parts first; then a small seam; then a cut that leaves the bigger piece at a full bed length
          const e = Math.max(...opt.bed);
          // a cut that only grazes the end of some region (the side of the body next to an arm) shaves a thin
          // wall off it onto the neighbor part: nearly as bad as an extra part
          // (on the high side of a cliff: the section falls away within a couple of slices)
          let graze = 0; for (const n of G.S[i]) if (Math.min(n.eDn, n.eUp) * G.h < Math.max(0.12 * Math.min(...opt.bed), 3 * G.h)) graze = 1;
          for (const k of [-2, -1, 1, 2]) { const q = i + k; if (q >= 0 && q < G.S.length && G.A[q] < 0.6 * G.A[i]) graze = 1; }
          // seam size, counting only real narrow spots (a waist, a neck: smaller than both sides) as small; near an
          // edge the section shrinks toward the edge, which is no neck, so it costs the size a little further in
          const W = Math.max(2, Math.round(0.12 * Math.min(...opt.bed) / G.h));
          let m1 = 0, m2 = 0; for (let q = Math.max(0, i - W); q < i; q++) m1 = Math.max(m1, G.A[q]); for (let q = i + 1; q <= Math.min(G.S.length - 1, i + W); q++) m2 = Math.max(m2, G.A[q]);
          const seam = sec < 0.8 * Math.min(m1, m2) ? sec : Math.max(sec, Math.min(m1, m2) || sec);
          const bal = Math.abs((v - bb.min[a]) - (bb.max[a] - v)) / (bb.max[a] - bb.min[a]);
          // a cut along a limb (down the length of a leg) instead of across it: seen from the other axes, the plane
          // runs through the middle of small sections for a long way
          let along = 0;
          for (const ob of others) {
            const H = graphs[ob]; let mx = 0; for (const x of H.A) mx = Math.max(mx, x); let run = 0;
            for (const row of H.S) { let hit = false; for (const n of row) { if (n.area > 0.45 * mx) continue; const lo = a === UA[ob] ? n.b[0] : n.b[2], hi = a === UA[ob] ? n.b[1] : n.b[3], m = Math.min(0.1 * (hi - lo), 2); if (v > lo + m && v < hi - m) hit = true; } if (hit) run += H.h; }
            along = Math.max(along, run);
          }
          const lengthwise = along > 2 * thin ? 1.5 : 0;
          slabs.push({ score: parts + 0.6 * seam / (e * e) + 0.9 * graze + 0.25 * bal + lengthwise, a, v });
        }
        void others;
      }
      slabs.sort((x, y) => x.score - y.score);
      // no usable section (a wire too thin to slice well): plain cuts a bed length in, on the longest side
      if (!slabs.length) { const a = d.indexOf(Math.max(...d)), L = Math.max(...opt.bed) - opt.pr - 5; for (const f of [L, d[a] / 2, d[a] - L]) if (f > 1 && f < d[a] - 1) slabs.push({ score: 0, a, v: bb.min[a] + f }); }
      let done = false;
      const slabPl = sb => ({ c: point3(sb.a, sb.v, [(bb.min[UA[sb.a]] + bb.max[UA[sb.a]]) / 2, (bb.min[WA[sb.a]] + bb.max[WA[sb.a]]) / 2]), n: axisN(sb.a), local: false, kind: 'slab' });
      for (const sb of slabs.slice(0, 16)) { // the best cut that leaves no small loose bits
        const made = cut(slabPl(sb), new Set([P]), sb.a, true);
        if (made && made.length > 1) { done = true; break; }
      }
      // else the best one that cuts at all (a small bit may be left as its own part, with a warning)
      if (!done) for (const sb of slabs.slice(0, 8)) {
        const saveP = st.pieces.slice(), saveC = st.caps.length, nPl = planes.length, nW = st.warn.length;
        const made = cut(slabPl(sb), new Set([P]), sb.a);
        if (made && made.length > 1) { done = true; break; }
        st.pieces = saveP; st.caps.length = saveC; planes.length = nPl; st.warn.length = nW;
      }
      if (!done) { info.get(P).stuck = true; st.warn.push('A part is still too big for the bed: no clean cut was found for it.'); }
    }
    return { pieces: st.pieces, caps: st.caps, warn: st.warn, planes, fits: st.pieces.map(pc => fits(pc)) };
  }
  // Free-plane split: cuts, then joints and part IDs on each cut face, worked in that plane's own frame.
  function splitFree(soup, planes, conn, opt) {
    opt = opt || {};
    const g = opt.pre || cutFree(soup, planes, opt.onProgress);
    const cen = pc => { let x = 0, y = 0, z = 0; const n = pc.p.length / 3; for (let i = 0; i < pc.p.length; i += 3) { x += pc.p[i]; y += pc.p[i + 1]; z += pc.p[i + 2]; } return [x / n, y / n, z / n]; };
    // brick / radial: crumbs under 1 mm\u00b3 (where nudged cuts nearly meet, at a wedge's tip) are too small to print
    if (opt.layers) {
      // seal hairline gaps where a cut passed a hair from a corner (several cuts meet near a wedge's tip)
      for (const pc of g.pieces) sealPiece(pc);
      const n0 = g.pieces.length, sliver = pc => { if (!opt.layers.center) return false; const b = bbox(pc.p); return Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]) < 1; };
      g.pieces = g.pieces.filter(pc => Math.abs(signedVolume(pc.p)) >= 1 && !sliver(pc)); if (g.pieces.length < n0) g.crumbs = n0 - g.pieces.length;
    }
    g.pieces.forEach(pc => { pc.c = cen(pc); pc.bb = bbox(pc.p); });
    // assembly order: the biggest part first (the body), then bottom to top
    const vol = pc => signedVolume(pc.p);
    const big = g.pieces.reduce((m, pc) => vol(pc) > vol(m) ? pc : m, g.pieces[0]);
    if (opt.layers) { // brick or radial split: number layer by layer (A1, A2\u2026 on the bottom layer, B1\u2026 above)
      const L = opt.layers, b = L.bounds, mid = pc => (pc.bb.min[L.axis] + pc.bb.max[L.axis]) / 2;
      const layerOf = pc => { const m = mid(pc); let k = 0; while (k < b.length - 2 && m > b[k + 1]) k++; return k; };
      const t0 = (L.turn || 0) * Math.PI / 180;
      const ang = pc => { let a = Math.atan2(pc.c[1] - L.center[1], pc.c[0] - L.center[0]) - t0; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return a; };
      const [p1, p2] = L.axis === 2 ? [1, 0] : L.axis === 1 ? [2, 0] : [2, 1];
      g.pieces.forEach(pc => { pc.layer = layerOf(pc); });
      g.pieces.sort((a, b2) => a.layer - b2.layer || (L.center ? ang(a) - ang(b2) : (a.bb.min[p1] - b2.bb.min[p1]) || (a.bb.min[p2] - b2.bb.min[p2])));
      const seen = new Map();
      g.pieces.forEach((pc, i) => { const j = (seen.get(pc.layer) || 0) + 1; seen.set(pc.layer, j); pc.number = i + 1; pc.cell = [j - 1, 0, pc.layer]; pc.labelText = (pc.layer < 26 ? String.fromCharCode(65 + pc.layer) : 'L' + (pc.layer + 1)) + j; });
    } else {
      g.pieces.sort((a, b) => (a === big ? -1 : b === big ? 1 : a.bb.min[2] - b.bb.min[2] || a.c[0] - b.c[0]));
      g.pieces.forEach((pc, i) => { pc.number = i + 1; pc.cell = [i, 0, 0]; pc.labelText = i < 26 ? String.fromCharCode(65 + i) : String(i + 1); });
    }
    numberParts(g.pieces, opt.numbering);
    const log = { placed: 0, pins: 0, skipped: 0, shrunk: 0, interfaces: 0, pinSpec: null, joints: [] };
    if (conn && conn.type && conn.type !== 'none') {
      const bvhs = new Map();
      for (let k = 0; k < planes.length; k++) {
        const cN = g.caps[2 * k], cP = g.caps[2 * k + 1], B = cN.B;
        if (cN.cone) { if (g.pieces.some(pc => pc.t.includes(cN.id))) log.coneGlued = (log.coneGlued || 0) + 1; continue; } // a cone face centres itself: glue only
        const As = g.pieces.filter(pc => pc.t.includes(cN.id)), Bs = g.pieces.filter(pc => pc.t.includes(cP.id));
        if (!As.length || !Bs.length) continue;
        const bk = B.n.map(x => x.toFixed(9)).join(','); // planes that share a direction share one search tree
        let bvh = bvhs.get(bk); if (!bvh) { bvh = buildBVH(toLocal(Float64Array.from(soup), B)); bvhs.set(bk, bvh); }
        const touched = [...new Set([...As, ...Bs])];
        touched.forEach(pc => toLocal(pc.p, B));
        const before = log.joints.length;
        if (conn.type === 'lip') {
          if (!log.lip) log.lip = { spec: null, specs: lipSpecs(conn), rims: [], open: 0, flat: 0, slim: 0, fallback: 0, faces: 0, lip: true };
          const L = log.lip; L.spec = L.specs[0];
          for (const A of As) for (const Bp of Bs) if (A !== Bp && A.t.includes(cN.id) && Bp.t.includes(cP.id)) {
            L.faces++; const before2 = L.rims.length, e = lipOne(A, Bp, cN.id, { axis: 2, v: cN.v, sign: 1, partner: cP.id }, L.specs, L);
            for (let q = before2; q < L.rims.length; q++) { const r = L.rims[q]; r.frame = B; if (r.pos) r.pos = vecWorld(r.pos, B); for (const pg of r.pegs || []) pg.pos = vecWorld(pg.pos, B); r.dirW = vecWorld([0, 0, 1], B); }
            void e;
          }
        } else
        for (const A of As) for (const Bp of Bs) if (A !== Bp) {
          // a joint must never leave a part open (two cuts close together, a thin wall): put that face back to glue
          const wasA = checkClosed(Float64Array.from(A.p)).closed, wasB = checkClosed(Float64Array.from(Bp.p)).closed;
          const sA = { p: A.p.slice(), t: A.t.slice(), j: A.joints }, sB = { p: Bp.p.slice(), t: Bp.t.slice(), j: Bp.joints }, nJ = log.joints.length, keep = { placed: log.placed, pins: log.pins };
          connectPair(A, Bp, cN.id, { axis: 2, v: cN.v, sign: 1, partner: cP.id }, Object.assign({}, conn, { frame: B, clipB: !!opt.layers }), bvh, log, true);
          if (log.joints.length > nJ && ((wasA && !checkClosed(Float64Array.from(A.p)).closed) || (wasB && !checkClosed(Float64Array.from(Bp.p)).closed))) {
            A.p = sA.p; A.t = sA.t; A.joints = sA.j; Bp.p = sB.p; Bp.t = sB.t; Bp.joints = sB.j;
            log.joints.length = nJ; log.placed = keep.placed; log.pins = keep.pins; log.glued = (log.glued || 0) + 1;
          }
        }
        touched.forEach(pc => toWorld(pc.p, B));
        for (let j = before; j < log.joints.length; j++) { const jt = log.joints[j]; jt.pos = vecWorld(jt.pos, B); jt.dir = vecWorld(jt.dir, B); jt.along = vecWorld(jt.along, B); }
      }
    }
    if (opt.labels) for (const pc of g.pieces) {
      const tags = [...new Set(pc.t.filter(t => t >= 0))];
      // biggest cap face first
      const area = tag => { let a = 0; for (let i = 0; i < pc.t.length; i++) if (pc.t[i] === tag) { const b = i * 9; a += Math.hypot(...cross(sub([pc.p[b + 3], pc.p[b + 4], pc.p[b + 5]], [pc.p[b], pc.p[b + 1], pc.p[b + 2]]), sub([pc.p[b + 6], pc.p[b + 7], pc.p[b + 8]], [pc.p[b], pc.p[b + 1], pc.p[b + 2]]))); } return a; };
      tags.sort((x, y) => area(y) - area(x));
      for (const tag of tags) {
        const cap = g.caps[tag]; if (cap.cone) continue; // IDs go on flat cut faces only
        toLocal(pc.p, cap.B);
        const ok = labelOnCap(pc, tag, { axis: 2, v: cap.v, sign: cap.sign }, pc.labelText, { depth: opt.labelDepth || 0.6, style: opt.labelStyle });
        toWorld(pc.p, cap.B);
        if (ok) { pc.labelFace.plane = cap.plane; break; }
      }
    }
    if (opt.layers) for (const pc of g.pieces) if (!sealPiece(pc)) { log.open = (log.open || 0) + 1; }
    return { pieces: g.pieces, caps: g.caps.map(c => ({ id: c.id, plane: c.plane, sign: c.sign, partner: c.partner, cone: c.cone || 0 })), log, warn: g.warn };
  }

  // Shape-aware split with joints and IDs: smartSplit's cuts, then splitFree's joints and labels on every cut face.
  // opt: { bed, pr, rot, labels, labelStyle, numbering, labelDepth, onProgress }. Returns splitFree's result plus
  // planes (each { c, n, kind: 'limb' | 'slab' }) and fits (per part, before joints).
  function splitSmart(soup, conn, opt) {
    opt = opt || {};
    const prog = opt.onProgress || (() => {});
    const g = smartSplit(soup, { bed: opt.bed, pr: opt.pr || 0, rot: opt.rot !== false, onProgress: f => prog(0.6 * f) });
    const r = splitFree(soup, g.planes, conn, Object.assign({}, opt, { pre: g, onProgress: null }));
    prog(1);
    r.planes = g.planes.map(q => ({ c: q.c, n: q.n, kind: q.kind }));
    r.warn = (r.warn || []).concat([]);
    return r;
  }
  // ---------------------------------------------------------------- brick (staggered) and radial wedge layouts
  // Both are free-plane splits (splitFree), so joints follow any face, including faces that meet two parts.
  // Brick: grid cuts, but on every other layer the cuts across that layer move by half a block, like brickwork,
  // so no seam runs straight through the model. bounds = { min:[x,y,z], max:[x,y,z] }, planes = [[x\u2026],[y\u2026],[z\u2026]].
  // Layers run along Z when there are Z cuts, else along Y (a flat model: rows staggered like a wall).
  function brickPlanes(bounds, planes) {
    const L = planes[2].length ? 2 : planes[1].length ? 1 : -1;
    if (L < 0) return null;
    const stag = [0, 1, 2].filter(a => a !== L && planes[a].length && !(L === 1 && a === 2));
    if (!stag.length) return null;
    const mid = [0, 1, 2].map(a => (bounds.min[a] + bounds.max[a]) / 2);
    const lb = [bounds.min[L], ...planes[L], bounds.max[L]];
    const at = (a, v) => { const c = mid.slice(); c[a] = v; const n = [0, 0, 0]; n[a] = 1; return { c, n }; };
    const out = planes[L].map(v => Object.assign(at(L, v), { local: false }));
    for (let k = 0; k + 1 < lb.length; k++) for (const a of stag) {
      const seg = [bounds.min[a], ...planes[a], bounds.max[a]];
      const cuts = k % 2 === 0 ? planes[a] : seg.slice(1).map((x, i) => (seg[i] + x) / 2);
      for (const v of cuts) out.push(Object.assign(at(a, v), { local: false, within: { axis: L, lo: lb[k], hi: lb[k + 1] } }));
    }
    return { planes: out, layers: { axis: L, bounds: lb }, stagger: stag };
  }
  // Radial wedges: n (even) wedges round a vertical axis through center [x,y], like slices of a cake, first cut at
  // turn degrees; zPlanes add layers. n/2 planes through the axis make the n wedges.
  function radialPlanes(bounds, center, n, turn, zPlanes) {
    n = Math.max(2, Math.round(n / 2) * 2);
    const zc = (bounds.min[2] + bounds.max[2]) / 2, out = [];
    for (const z of zPlanes || []) out.push({ c: [center[0], center[1], z], n: [0, 0, 1], local: false });
    for (let k = 0; k < n / 2; k++) {
      const t = ((turn || 0) + k * 360 / n) * Math.PI / 180;
      // planes that all share one line meet the earlier cut faces edge-on there, so each plane passes a hair
      // (0.02 mm and up) beside the axis; the slivers that leaves round the axis are dropped as crumbs
      const nn = [-Math.sin(t), Math.cos(t), 0], d = 0.02 + 0.0137 * k;
      out.push({ c: [center[0] + nn[0] * d, center[1] + nn[1] * d, zc], n: nn, local: false });
    }
    return { planes: out, layers: { axis: 2, bounds: [bounds.min[2], ...(zPlanes || []), bounds.max[2]], center: center.slice(0, 2), turn: turn || 0 } };
  }
  // Radial split with a check: if any wedge comes out with a hairline gap (many cuts crowd the axis), cut again
  // turned by a fraction of a degree and keep the first clean result. Returns splitFree's result plus turn, open.
  function splitRadial(soup, bounds, center, n, turn, zPlanes, conn, opt) {
    let best = null;
    for (const dt of [0, 0.37, -0.53, 0.91, -1.27]) {
      const L = radialPlanes(bounds, center, n, (turn || 0) + dt, zPlanes);
      const r = splitFree(soup, L.planes, conn, Object.assign({}, opt, { layers: Object.assign(L.layers, { turn: turn || 0 }) }));
      r.turn = (turn || 0) + dt; r.planes = L.planes; r.layers = L.layers;
      r.open = r.pieces.filter(pc => !checkClosed(Float64Array.from(pc.p)).closed).length;
      if (!best || r.open < best.open) best = r;
      if (!r.open) break;
    }
    return best;
  }
  // XY footprint [w, h] of each wedge (world axes): triangles that straddle a cut are clipped to each wedge, and
  // every wedge box includes the axis, so the numbers match the cut wedges (before pegs).
  function wedgeExtents(soup, center, n, turn) {
    const t0 = (turn || 0) * Math.PI / 180, step = 2 * Math.PI / n;
    const bx = Array.from({ length: n }, () => [center[0], center[1], center[0], center[1]]);
    const sec = (x, y) => { let a = Math.atan2(y - center[1], x - center[0]) - t0; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return Math.min(n - 1, Math.floor(a / step)); };
    const put = (k, x, y) => { const b = bx[k]; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; };
    // each wedge is convex (n >= 2): keep the side of each bounding ray
    const half = [];
    for (let k = 0; k < n; k++) { const a0 = t0 + k * step, a1 = a0 + step; half.push([[-Math.sin(a0), Math.cos(a0)], [Math.sin(a1), -Math.cos(a1)]]); }
    const clip = (poly, h) => { const out = [], d = q => (q[0] - center[0]) * h[0] + (q[1] - center[1]) * h[1];
      for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length], dp = d(P), dq = d(Q); if (dp >= 0) out.push(P); if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); } }
      return out; };
    for (let i = 0; i < soup.length; i += 9) {
      const ks = [sec(soup[i], soup[i + 1]), sec(soup[i + 3], soup[i + 4]), sec(soup[i + 6], soup[i + 7])];
      if (ks[0] === ks[1] && ks[1] === ks[2]) { for (let v = 0; v < 9; v += 3) put(ks[0], soup[i + v], soup[i + v + 1]); continue; }
      const tri = [[soup[i], soup[i + 1]], [soup[i + 3], soup[i + 4]], [soup[i + 6], soup[i + 7]]];
      for (let k = 0; k < n; k++) {
        let poly = clip(tri, half[k][0]); if (n > 2 && poly.length) poly = clip(poly, half[k][1]);
        for (const q of poly) put(k, q[0], q[1]);
      }
    }
    return bx.map(b => [b[2] - b[0], b[3] - b[1]]);
  }

  // ---------------------------------------------------------------- joint fit check
  // For every joint: both halves present, clearance in a sensible range for the joint type, and enough
  // material around and behind each hole (measured by casting rays through the finished part).
  const FIT = { peg: [0.15, 0.5], dowel: [0.1, 0.4], snap: [0.15, 0.4], dovetail: [0.2, 0.5], magnet: [0.05, 0.4] };
  function fitCheck(pieces, joints, opt) {
    opt = opt || {};
    const minWall = opt.minWall || 0.8, okWall = opt.okWall || 1.4;
    const bvhs = new Map();
    const bvhOf = i => { if (!bvhs.has(i)) bvhs.set(i, buildBVH(pieces[i].p)); return bvhs.get(i); };
    const out = { ok: 0, warn: 0, bad: 0, items: [] };
    for (const j of joints) {
      const notes = []; let level = 0; const bump = (l, msg) => { level = Math.max(level, l); notes.push(msg); };
      if (!j.okA || !j.okB) bump(2, !j.okB ? 'the peg has no matching hole on the next part' : 'the hole has no matching peg');
      const rng = FIT[j.type];
      if (rng) {
        if (j.c < rng[0] * 0.5) bump(2, `clearance ${j.c} mm is too tight to go together (try ${rng[0]}-${rng[1]} mm)`);
        else if (j.c < rng[0]) bump(1, `clearance ${j.c} mm is tight for ${j.type === 'dovetail' ? 'a sliding dovetail' : 'this joint'} (try ${rng[0]} mm or more)`);
        else if (j.c > rng[1]) bump(1, `clearance ${j.c} mm is loose; the parts may wobble`);
      }
      if ((j.type === 'peg' || j.type === 'snap') && j.r * 2 < 3) bump(1, `pegs ${(j.r * 2).toFixed(1)} mm across may snap off`);
      // walls: rays from inside each hole out through the part
      let wall = Infinity;
      const sides = j.type === 'dowel' || j.type === 'magnet' ? [[j.B, 1], [j.A, -1]] : j.rev ? [[j.A, -1]] : [[j.B, 1]];
      for (const [pi, sgn] of sides) {
        if (pi == null || pi < 0 || !pieces[pi]) continue;
        const bvh = bvhOf(pi), n = j.dir.map(x => x * sgn);
        const e1 = norm(j.along), e2 = cross(n, e1);
        const R = j.type === 'dovetail' ? null : (j.rk || j.r) + j.c + (j.b || 0);
        for (const h of j.type === 'dovetail' ? [] : [j.depth * 0.5, Math.max(0.3, j.depth - 0.4)]) {
          const Q = [j.pos[0] + n[0] * h, j.pos[1] + n[1] * h, j.pos[2] + n[2] * h];
          for (let k = 0; k < 8; k++) {
            const t = k * Math.PI / 4, ct = Math.cos(t), st = Math.sin(t);
            const d = [e1[0] * ct + e2[0] * st, e1[1] * ct + e2[1] * st, e1[2] * ct + e2[2] * st];
            const t1 = rayQuery(bvh, Q, d, true, 1e-6);
            const expect = R != null ? R : Math.hypot(j.Lk * ct, j.hw * st);
            if (!isFinite(t1) || t1 > expect * 1.6 + 1) continue; // ray left through an opening (a slide-in slot): not a wall
            const P1 = [Q[0] + d[0] * (t1 + 1e-3), Q[1] + d[1] * (t1 + 1e-3), Q[2] + d[2] * (t1 + 1e-3)];
            const t2 = rayQuery(bvh, P1, d, true, 1e-6);
            if (isFinite(t2)) wall = Math.min(wall, t2);
          }
        }
        // behind the bottom of the hole
        const Q0 = [j.pos[0] + n[0] * 0.05, j.pos[1] + n[1] * 0.05, j.pos[2] + n[2] * 0.05];
        const tb = rayQuery(bvh, Q0, n, true, 1e-6);
        if (isFinite(tb) && tb < j.depth + 1) { const P1 = [Q0[0] + n[0] * (tb + 1e-3), Q0[1] + n[1] * (tb + 1e-3), Q0[2] + n[2] * (tb + 1e-3)]; const t2 = rayQuery(bvh, P1, n, true, 1e-6); if (isFinite(t2)) wall = Math.min(wall, t2); }
      }
      if (wall < minWall) bump(2, `only ${wall.toFixed(1)} mm of wall around the hole; it may break through`);
      else if (wall < okWall) bump(1, `thin wall (${wall.toFixed(1)} mm) around the hole`);
      const status = ['ok', 'warn', 'bad'][level];
      out[status]++;
      out.items.push({ pos: j.pos, dir: j.dir, type: j.type, A: j.A, B: j.B, status, notes, wall: isFinite(wall) ? +wall.toFixed(2) : null });
    }
    return out;
  }

  // ---------------------------------------------------------------- distance-field cavity (uniform wall, never folds)
  // Closest point on triangle (Ericson, Real-Time Collision Detection 5.1.5).
  function closestOnTri(p, b, P, out) {
    const ax = p[b], ay = p[b + 1], az = p[b + 2], abx = p[b + 3] - ax, aby = p[b + 4] - ay, abz = p[b + 5] - az, acx = p[b + 6] - ax, acy = p[b + 7] - ay, acz = p[b + 8] - az;
    const apx = P[0] - ax, apy = P[1] - ay, apz = P[2] - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    const set = (x, y, z) => { out[0] = x; out[1] = y; out[2] = z; };
    if (d1 <= 0 && d2 <= 0) return set(ax, ay, az);
    const bpx = P[0] - p[b + 3], bpy = P[1] - p[b + 4], bpz = P[2] - p[b + 5];
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) return set(p[b + 3], p[b + 4], p[b + 5]);
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return set(ax + abx * v, ay + aby * v, az + abz * v); }
    const cpx = P[0] - p[b + 6], cpy = P[1] - p[b + 7], cpz = P[2] - p[b + 8];
    const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) return set(p[b + 6], p[b + 7], p[b + 8]);
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return set(ax + acx * w, ay + acy * w, az + acz * w); }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return set(p[b + 3] + (p[b + 6] - p[b + 3]) * w, p[b + 4] + (p[b + 7] - p[b + 4]) * w, p[b + 5] + (p[b + 8] - p[b + 5]) * w); }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
    set(ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w);
  }
  // Nearest surface point within rmax: returns the distance (rmax if none closer) and writes the point to q.
  function nearestPoint(bvh, P, rmax, q) {
    let best = rmax * rmax; const c = [0, 0, 0], st = bvh.nodes.length ? [0] : [];
    while (st.length) {
      const nd = bvh.nodes[st.pop()];
      let d2 = 0; for (let a = 0; a < 3; a++) { const v = P[a] < nd.mn[a] ? nd.mn[a] - P[a] : P[a] > nd.mx[a] ? P[a] - nd.mx[a] : 0; d2 += v * v; }
      if (d2 >= best) continue;
      if (nd.l >= 0) { st.push(nd.l, nd.r); continue; }
      for (let i = nd.s; i < nd.e; i++) {
        closestOnTri(bvh.p, bvh.idx[i] * 9, P, c);
        const dd = (c[0] - P[0]) ** 2 + (c[1] - P[1]) ** 2 + (c[2] - P[2]) ** 2;
        if (dd < best) { best = dd; if (q) { q[0] = c[0]; q[1] = c[1]; q[2] = c[2]; } }
      }
    }
    return Math.sqrt(best);
  }
  function rayAll(bvh, o, d) {
    const inv = [1 / d[0], 1 / d[1], 1 / d[2]], hits = [], st = bvh.nodes.length ? [0] : [];
    while (st.length) {
      const nd = bvh.nodes[st.pop()];
      if (!rayBox(o, inv, nd.mn, nd.mx, Infinity)) continue;
      if (nd.l < 0) { for (let i = nd.s; i < nd.e; i++) { const t = rayTri(bvh.p, bvh.idx[i] * 9, o, d); if (t > 0) hits.push(t); } } else st.push(nd.l, nd.r);
    }
    return hits.sort((x, y) => x - y);
  }
  const CUBE8 = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const TETS6 = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
  // The cavity of a hollow shell: every point inside the model at least `wall` from its surface. The distance is
  // exact at grid points (cell `h`), meshed with marching tetrahedra (closed, never folds or self-intersects), then
  // every vertex is moved onto the exact `wall` distance, so the wall is uniform. Thin parts (under 2 x wall) stay solid.
  // Returns an outward-facing closed soup (the cavity as a solid), like cavitySurface.
  function sdfCavity(soup, wall, bvh, opt) {
    opt = opt || {};
    const bb = bbox(soup), ext = [0, 1, 2].map(a => bb.max[a] - bb.min[a]);
    // grid cell: about `target` triangles on the cavity (~6 per cell crossing), never finer than the point budget allows
    const h = opt.cell || Math.max(0.8, wall * 0.4, Math.cbrt(ext[0] * ext[1] * ext[2] / (opt.budget || 8e6)), Math.min(14, Math.sqrt(6 * surfaceArea(soup) / (opt.target || 150000))));
    const lo = bb.min.map(x => x + wall - h * 0.5), n = [0, 1, 2].map(a => Math.max(2, Math.ceil((ext[a] - 2 * wall + h) / h) + 1));
    const nx = n[0], ny = n[1], nz = n[2], N = nx * ny * nz, F = new Float32Array(N).fill(1), R = wall + 2 * h;
    const idx = (i, j, k) => (k * ny + j) * nx + i, P = [0, 0, 0];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = lo[0] + i * h + 1.234e-5, y = lo[1] + j * h + 2.345e-5; // off-grid so rays miss mesh edges
        const hits = rayAll(bvh, [x, y, bb.min[2] - 1], [0, 0, 1]); if (hits.length < 2) continue;
        for (let k = 0; k < nz; k++) {
          const z = lo[2] + k * h, t = z - (bb.min[2] - 1);
          let c = 0; while (c < hits.length && hits[c] < t) c++;
          if (!(c & 1)) continue; // outside
          P[0] = lo[0] + i * h; P[1] = lo[1] + j * h; P[2] = z;
          const d = Math.min(nearestPoint(bvh, P, R), t - hits[c - 1], hits[c] - t);
          F[idx(i, j, k)] = wall - d;
        }
      }
      if (opt.onProgress && (j & 7) === 0) opt.onProgress(0.7 * j / ny);
    }
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) F[idx(i, j, k)] = 1;
      else if (Math.abs(F[idx(i, j, k)]) < 1e-6) F[idx(i, j, k)] = 1e-6;
    }
    // marching tetrahedra (as GPModels.meshSDF): inside = F < 0
    const emap = new Map(), V = [], out = [];
    const pos = g => { const i = g % nx, j = ((g - i) / nx) % ny, k = Math.floor(g / (nx * ny)); return [lo[0] + i * h, lo[1] + j * h, lo[2] + k * h]; };
    const ev = (a, b) => {
      const key = a < b ? a * N + b : b * N + a; let v = emap.get(key);
      if (v === undefined) { const t = Math.min(0.98, Math.max(0.02, F[a] / (F[a] - F[b]))), A = pos(a), B = pos(b); v = V.length / 3; V.push(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); emap.set(key, v); }
      return v;
    };
    const tri = (a, b, c, ins, outs) => {
      const A = [V[a * 3], V[a * 3 + 1], V[a * 3 + 2]], u = [V[b * 3] - A[0], V[b * 3 + 1] - A[1], V[b * 3 + 2] - A[2]], w = [V[c * 3] - A[0], V[c * 3 + 1] - A[1], V[c * 3 + 2] - A[2]];
      const nn = cross(u, w), I = pos(ins), O = pos(outs);
      if (nn[0] * (O[0] - I[0]) + nn[1] * (O[1] - I[1]) + nn[2] * (O[2] - I[2]) < 0) out.push(a, c, b); else out.push(a, b, c);
    };
    const gc = new Int32Array(8);
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      let any = 0, all = 1;
      for (let c = 0; c < 8; c++) { gc[c] = idx(i + CUBE8[c][0], j + CUBE8[c][1], k + CUBE8[c][2]); if (F[gc[c]] < 0) any = 1; else all = 0; }
      if (!any || all) continue;
      for (const T of TETS6) {
        const ins = [], outs = [];
        for (const t of T) (F[gc[t]] < 0 ? ins : outs).push(gc[t]);
        if (ins.length === 1) tri(ev(ins[0], outs[0]), ev(ins[0], outs[1]), ev(ins[0], outs[2]), ins[0], outs[0]);
        else if (ins.length === 3) tri(ev(ins[0], outs[0]), ev(ins[1], outs[0]), ev(ins[2], outs[0]), ins[0], outs[0]);
        else if (ins.length === 2) { const a = ev(ins[0], outs[0]), b = ev(ins[0], outs[1]), c = ev(ins[1], outs[1]), e = ev(ins[1], outs[0]); tri(a, b, c, ins[0], outs[0]); tri(a, c, e, ins[0], outs[0]); }
      }
    }
    if (opt.onProgress) opt.onProgress(0.85);
    // move every vertex onto the exact wall distance (the grid interpolation rounds concave corners a little), but
    // never so far that a triangle tips over: where one would, its vertices move half as far, then a quarter...
    const q = [0, 0, 0], v3 = [0, 0, 0], maxMove = opt.noSnap ? 0 : h * 0.45, nv = V.length / 3, M = new Float64Array(V.length);
    for (let pass = 0; pass < 4 && maxMove > 0; pass++) { // repeated: a step off one face can come closer to another
      let moved = 0;
      for (let vi = 0; vi < V.length; vi += 3) {
        v3[0] = V[vi] + M[vi]; v3[1] = V[vi + 1] + M[vi + 1]; v3[2] = V[vi + 2] + M[vi + 2];
        const d = nearestPoint(bvh, v3, wall + h, q); if (d >= wall + h || d < 1e-6 || Math.abs(wall - d) < 0.005) continue;
        const s = (wall - d) / d; // away from (or toward) the nearest surface point
        for (let k = 0; k < 3; k++) M[vi + k] += (v3[k] - q[k]) * s;
        const L = Math.hypot(M[vi], M[vi + 1], M[vi + 2]); if (L > maxMove) for (let k = 0; k < 3; k++) M[vi + k] *= maxMove / L;
        moved++;
      }
      if (!moved) break;
    }
    const nrm = (W, t) => { const a = out[t] * 3, b = out[t + 1] * 3, c = out[t + 2] * 3;
      return cross([W(b) - W(a), W(b + 1) - W(a + 1), W(b + 2) - W(a + 2)], [W(c) - W(a), W(c + 1) - W(a + 1), W(c + 2) - W(a + 2)]); };
    const N0 = []; for (let t = 0; t < out.length; t += 3) N0.push(nrm(i => V[i], t));
    const scale = new Float64Array(nv).fill(1), FOLD = opt.fold == null ? 0.1 : opt.fold;
    for (let it = 0; it < 8; it++) {
      const W = i => V[i] + M[i] * scale[(i / 3) | 0]; let bad = 0;
      for (let t = 0, k = 0; t < out.length; t += 3, k++) {
        const n1 = nrm(W, t), n0 = N0[k], dot = n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2];
        if (dot < FOLD * Math.hypot(...n0) * Math.hypot(...n1)) { bad++; for (let e = 0; e < 3; e++) scale[out[t + e]] *= 0.5; }
      }
      if (!bad) break;
      if (it === 7) for (let t = 0, k = 0; t < out.length; t += 3, k++) { // still tipping: leave those where the grid put them
        const n1 = nrm(W, t), n0 = N0[k]; if (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] < FOLD * Math.hypot(...n0) * Math.hypot(...n1)) for (let e = 0; e < 3; e++) scale[out[t + e]] = 0;
      }
    }
    for (let i = 0; i < V.length; i++) V[i] += M[i] * scale[(i / 3) | 0];
    const p = new Float64Array(out.length * 3);
    for (let t = 0; t < out.length; t++) { p[t * 3] = V[out[t] * 3]; p[t * 3 + 1] = V[out[t] * 3 + 1]; p[t * 3 + 2] = V[out[t] * 3 + 2]; }
    p.cell = h;
    return p;
  }

  // ---------------------------------------------------------------- hollow, then split: one shell, connection rims at every cut
  // The whole model is hollowed as ONE shell (one offset cavity), then cut on the grid. At each cut the thin wall is
  // thickened into a band (`bandW` wide, `D` deep, stepping back down to the wall in 45-degree terraces so nothing
  // overhangs inside), the cavity runs straight through the band (the parts are open where they meet, so the assembled
  // model is one continuous shell), and the band face carries a tongue-and-groove rim: a raised lip on the lower/left
  // part (A) slides into a matching channel on the other (B) with `c` clearance on every side and 0.4 mm at the bottom.
  // Everything at a cut is built from 2D polygons in the cut plane (Clipper offsets of the cross-section) extruded as
  // straight prisms, so every part stays watertight and manifold by construction.
  const getCL = () => G.ClipperLib || (typeof require === 'function' ? require('clipper-lib') : null);
  const CSC = 1e4; // clipper integer scale (0.1 um)
  const CLEAN = 0.03; // drop polygon points within 0.03 mm of the line through their neighbours (keeps the rims light)
  const pArea = L => polyArea(L);
  function orientPolys(polys) { // outer CCW, holes CW (region on the left of every edge)
    return polys.map(P => ({ outer: pArea(P.outer) > 0 ? P.outer : P.outer.slice().reverse(), holes: P.holes.map(h => pArea(h) < 0 ? h : h.slice().reverse()) }));
  }
  const toCP = L => L.map(q => ({ X: Math.round(q[0] * CSC), Y: Math.round(q[1] * CSC) }));
  const fromCP = P => P.map(q => [q.X / CSC, q.Y / CSC]);
  function cPaths(polys) { const out = []; for (const P of orientPolys(polys)) { out.push(toCP(P.outer)); for (const h of P.holes) out.push(toCP(h)); } return out; }
  function cTree(tree, minArea) {
    const CL = getCL(), polys = [];
    const walk = node => { for (const ch of node.Childs()) { if (ch.IsHole()) { walk(ch); continue; }
      const outer = fromCP(CL.Clipper.CleanPolygon(ch.Contour(), CLEAN * CSC));
      const holes = ch.Childs().map(h => fromCP(CL.Clipper.CleanPolygon(h.Contour(), CLEAN * CSC))).filter(h => h.length >= 3 && Math.abs(pArea(h)) > 1e-3);
      if (outer.length >= 3 && Math.abs(pArea(outer)) > (minArea || 1e-3)) polys.push({ outer, holes });
      for (const h of ch.Childs()) walk(h); } };
    walk(tree); return polys;
  }
  function cBool(type, a, b, minArea) {
    const CL = getCL(), c = new CL.Clipper(); c.StrictlySimple = true;
    if (a.length) c.AddPaths(cPaths(a), CL.PolyType.ptSubject, true);
    if (b && b.length) c.AddPaths(cPaths(b), CL.PolyType.ptClip, true);
    const tree = new CL.PolyTree();
    c.Execute({ union: CL.ClipType.ctUnion, diff: CL.ClipType.ctDifference, inter: CL.ClipType.ctIntersection }[type], tree, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    return cTree(tree, minArea);
  }
  function cOff(polys, d, minArea) {
    if (!polys.length) return [];
    const CL = getCL(), co = new CL.ClipperOffset(2, 0.08 * CSC); // arcs within 0.08 mm of round
    co.AddPaths(cPaths(polys), CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
    const tree = new CL.PolyTree(); co.Execute(tree, d * CSC);
    return cBool('union', cTree(tree), null, minArea); // strictly simple output
  }
  // The region of a planar face as strictly simple polygons. Unlike capPolys this keeps loops that touch at a vertex
  // (an iso-surface cavity can pinch there): the directed boundary loops are filled by winding number, not nesting.
  function capRegion(mesh, tag, a) {
    const P = mesh.p, T = mesh.t, m = new Map();
    for (let i = 0; i < T.length; i++) {
      if (T[i] !== tag) continue;
      const b = i * 9, pts = [[P[b + UA[a]], P[b + WA[a]]], [P[b + 3 + UA[a]], P[b + 3 + WA[a]]], [P[b + 6 + UA[a]], P[b + 6 + WA[a]]]];
      for (let e = 0; e < 3; e++) {
        const s = pts[e], t = pts[(e + 1) % 3], ks = k2(s[0], s[1]), kt = k2(t[0], t[1]); if (ks === kt) continue;
        // count directed edges (a triangulation can overlap itself, so an edge may repeat): what is left is the boundary
        const fw = ks < kt, key = fw ? ks + '|' + kt : kt + '|' + ks; let e2 = m.get(key);
        if (!e2) { e2 = { n: 0, s: fw ? s : t, t: fw ? t : s }; m.set(key, e2); } e2.n += fw ? 1 : -1;
      }
    }
    const segs = []; for (const e2 of m.values()) for (let k = 0; k < Math.abs(e2.n); k++) segs.push(e2.n > 0 ? [e2.s[0], e2.s[1], e2.t[0], e2.t[1]] : [e2.t[0], e2.t[1], e2.s[0], e2.s[1]]);
    const { loops } = joinLoops(segs); if (!loops.length) { const e = []; e.raw = []; return e; }
    const CL = getCL(), c = new CL.Clipper(); c.StrictlySimple = true; c.PreserveCollinear = true;
    c.AddPaths(loops.map(L => L.map(q => ({ X: Math.round(q[0] * Q), Y: Math.round(q[1] * Q) }))), CL.PolyType.ptSubject, true);
    const tree = new CL.PolyTree(); c.Execute(CL.ClipType.ctUnion, tree, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    // no cleaning, and every vertex snapped back to its exact original, so the face still meets the side walls exactly
    const orig = new Map(); for (const L of loops) for (const q of L) orig.set(Math.round(q[0] * Q) + ',' + Math.round(q[1] * Q), q);
    const back = path => path.map(p => orig.get(p.X + ',' + p.Y) || [p.X / Q, p.Y / Q]), polys = [];
    const walk = node => { for (const ch of node.Childs()) { if (ch.IsHole()) { walk(ch); continue; }
      const outer = back(ch.Contour()); if (outer.length >= 3) polys.push({ outer, holes: ch.Childs().map(h => back(h.Contour())).filter(h => h.length >= 3) });
      for (const h of ch.Childs()) walk(h); } };
    walk(tree); polys.raw = loops; return polys;
  }
  const cOpen = (polys, r, minArea) => cOff(cOff(polys, -r), r, minArea); // drop slivers narrower than 2r
  const polysArea = ps => ps.reduce((s, P) => s + Math.abs(pArea(P.outer)) - P.holes.reduce((t, h) => t + Math.abs(pArea(h)), 0), 0);
  const loopsOf = ps => { const o = []; for (const P of ps) { o.push(P.outer); for (const h of P.holes) o.push(h); } return o; };
  const inPolys = (ps, q) => ps.some(P => pip(q, P.outer) && !P.holes.some(h => pip(q, h)));

  // Rim, band and tunnel sizes for a wall, rim height and clearance (mm).
  function rimSpec(opt) {
    const w = Math.max(0.8, opt.wall || 3), h = Math.max(1, opt.rimH == null ? 5 : opt.rimH), c = Math.max(0.05, opt.clearance == null ? 0.25 : opt.clearance);
    const t = Math.max(2, Math.min(4, w)); // the lip: at least 2 mm so it prints with 4+ lines
    const pegs = opt.pegs !== false, rpMin = 1.5; // printed-in alignment pegs: at least 3 mm across
    const B = Math.max(opt.bandW || 0, 3 * w, 2 * 1.6 + t + 2 * c, pegs ? 2 * (rpMin + c + 2.1) : 0); // band width at the cut face
    const s = (B - t - 2 * c) / 2; // wall left on each side of the channel
    const Bn = w, n = B - Bn > 0.3 ? Math.max(1, Math.ceil((B - Bn) / 1.5 - 1e-9)) : 0, step = n ? (B - Bn) / n : 0; // 45-degree terraces back to the wall
    const gd = h + 0.4; // channel depth: the lip never bottoms out, so the faces close
    // pegs sit on the lip line (B/2 in from the outside) with at least 2 mm of material all round the hole (2.1 by
    // design, for the faceting of the round holes)
    const rp = pegs ? Math.min(3, B / 2 - 2.1 - c) : 0, rh = rp + c, hp = h + 3, hd = hp + 0.4;
    const D = Math.max(opt.band || 0, 12, gd + 1.5 + n * step, pegs ? hd + 2 : 0);
    return { w, h, c, t, B, s, o1: s + c, o2: s + c + t, gd, Bn, n, step, D, Dfull: D - n * step,
      pegs, rp, rh, hp, hd, rg: rp + 2 * c + 2.1, rb: rh + 2.1, pegWall: 2, pegSpacing: opt.pegSpacing || 100 };
  }

  // Cavity per grid cell, clipped `D` back from every interior cut (one cut of the cavity, not one per cell).
  function cavityCells1(cav, P, D, shift) {
    // keep the cavity cuts well clear of cavity vertices (1e-4 mm, ten times the usual nudge), so no sliver of the
    // cavity wall lies flat in a cut plane
    const nudgePlane = (p, a, v) => {
      for (let it = 0; it < 300; it++) {
        const x = v + (it & 1 ? -1 : 1) * Math.ceil(it / 2) * 3.1e-4; let ok = true;
        for (let i = a; i < p.length; i += 3) if (Math.abs(p[i] - x) < 1e-4) { ok = false; break; }
        if (ok) return x;
      }
      return v;
    };
    const P2 = [], seg = [];
    for (let a = 0; a < 3; a++) {
      const vals = []; for (const v of P[a]) vals.push(nudgePlane(cav, a, v - D + shift), nudgePlane(cav, a, v + D + shift));
      vals.sort((x, y) => x - y); P2.push(vals);
      const s = []; // for each original cell index: its sub-cell index in P2, or -1
      for (let i = 0; i <= P[a].length; i++) {
        const lo = i > 0 ? nudgePlane(cav, a, P[a][i - 1] + D + shift) : -Infinity, hi = i < P[a].length ? nudgePlane(cav, a, P[a][i] - D + shift) : Infinity;
        if (!(lo < hi)) { s.push(-1); continue; }
        const j = lo === -Infinity ? 0 : vals.indexOf(lo) + 1;
        s.push((j === vals.length ? hi === Infinity : vals[j] === hi) ? j : -1);
      }
      seg.push(s);
    }
    const g = cutGrid(cav, P2, null, true), byCell = new Map(g.pieces.map(pc => [pc.cell.join(','), pc]));
    return cell => {
      const sub = cell.map((c, a) => seg[a][c]); if (sub.some(x => x < 0)) return null;
      const pc = byCell.get(sub.join(',')); if (!pc || !pc.t.length) return null;
      const t = new Array(pc.t.length), capV = {};
      for (let i = 0; i < pc.t.length; i++) { const tg = pc.t[i]; if (tg < 0) { t[i] = -2; continue; } const cp = g.caps[tg], ct = cavTag(cp.axis, cp.sign > 0 ? 1 : 0); t[i] = ct; capV[ct] = cp.v; }
      return { p: pc.p, t, capV };
    };
  }

  // A cut can graze a fold of the cavity and leave a cell open. Each cell takes the first of a few slightly shifted
  // cuts that leaves it closed; a cell no cut closes gets no cavity (that part stays solid, never broken).
  function cavityCells(cav, P, D) {
    const tries = [0, 0.31, -0.47, 0.73], made = [], memo = new Map();
    return cell => {
      const k = cell.join(','); if (memo.has(k)) return memo.get(k);
      let res = null;
      for (let i = 0; i < tries.length && !res; i++) {
        if (!made[i]) made[i] = cavityCells1(cav, P, D, tries[i]);
        const m = made[i](cell); if (m && checkClosed(Float64Array.from(m.p)).closed) res = m;
        else if (!m && i === 0) break; // no cavity in this cell at all
      }
      memo.set(k, res); return res;
    };
  }

  const RIM_TAG = -6, BAND_TAG = -7; // lip / channel triangles; tunnel and terrace triangles inside the band
  // straight prism walls for oriented loops between plane coordinates x0 and x1 on axis a.
  // inward = true: normals point into the polygon (a void: channel, tunnel); false: out of it (a lip).
  function prismWalls(out, polys, a, x0, x1, inward) {
    const P3 = (q, x) => { const o = [0, 0, 0]; o[a] = x; o[UA[a]] = q[0]; o[WA[a]] = q[1]; return o; };
    for (const P of orientPolys(polys)) for (const L of [P.outer, ...P.holes]) for (let i = 0; i < L.length; i++) {
      const p0 = L[i], p1 = L[(i + 1) % L.length], du = p1[0] - p0[0], dw = p1[1] - p0[1];
      const s = inward ? 1 : -1, n = [0, 0, 0]; n[UA[a]] = -dw * s; n[WA[a]] = du * s;
      addQuad(out, P3(p0, x0), P3(p1, x0), P3(p1, x1), P3(p0, x1), n);
    }
  }
  const pushTris = (pc, tris, tag) => { for (let i = 0; i < tris.length; i++) pc.p.push(tris[i]); for (let i = 0; i < tris.length / 9; i++) pc.t.push(tag); };
  function retri(pc, tag, a, v, sign, loops) { // replace the face `tag` by the even-odd region of `loops`
    removeTag(pc, tag);
    triangulatePolys(loopsToPolys(loops), a, v, sign, pc.p, pc.t, tag);
  }
  // Cross-sections of a part between two plane coordinates (only where the part exists).
  function sectionsBetween(pc, a, lo, hi, n) {
    let mn = Infinity, mx = -Infinity; for (let i = a; i < pc.p.length; i += 3) { if (pc.p[i] < mn) mn = pc.p[i]; if (pc.p[i] > mx) mx = pc.p[i]; }
    lo = Math.max(lo, mn + 0.02); hi = Math.min(hi, mx - 0.02); const out = [];
    if (!(lo < hi)) return out;
    // a slice can come out empty when it grazes a vertex of the mesh; nudge it a little before believing that
    for (let k = 0; k <= n; k++) {
      const v0 = lo + (hi - lo) * k / n; let ps = [];
      for (const d of [0, 0.037, -0.041, 0.083]) { const v = Math.min(hi, Math.max(lo, v0 + d)); ps = sectionPolys(pc.p, a, nudgePlane(pc.p, a, v)); if (polysArea(ps) > 1e-6) break; }
      out.push(ps);
    }
    return out;
  }

  const disc = (q, r, n) => { n = n || 24; const L = []; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n * Math.PI * 2; L.push([q[0] + r * Math.cos(t), q[1] + r * Math.sin(t)]); } return { outer: L, holes: [] }; };
  function loopDist(q, L) { let best = Infinity; for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0; best = Math.min(best, Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t)); } return best; }
  const edgeDist = (ps, q) => { let d = Infinity; for (const L of loopsOf(ps)) d = Math.min(d, loopDist(q, L)); return d; };
  // Where the pegs go on one cut. Candidates lie on the lip line (the middle of the band, B/2 in from the outside) and
  // must keep `rh + 2` mm of material to every edge of the band section S (outside surface and thin spots), stay on a
  // straight run of the lip (no sharp corners) and on the lip itself. Pegs are spread evenly by arc length round each
  // loop, about `pegSpacing` apart, at least 3 per cut where the section allows (2 on a small loop).
  function pegSites(S, Tl, sp) {
    const lines = loopsOf(cOff(S, -sp.B / 2)).filter(L => L.length >= 3), need = sp.rh + sp.pegWall;
    const loops = [];
    for (const L of lines) {
      const pts = [], cum = [0]; let len = 0;
      for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const k = Math.max(1, Math.ceil(l / 1)); for (let j = 0; j < k; j++) pts.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k, len + l * j / k]); len += l; }
      if (len < 25) continue;
      // turning within +-6 mm of each candidate (a corner of the lip line), and whether a peg fits there
      const at = d => { d = ((d % len) + len) % len; let lo = 0, hi = pts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m][2] <= d) lo = m; else hi = m - 1; } return pts[lo]; };
      const cand = pts.map(p => {
        const p0 = at(p[2] - 6), p1 = at(p[2] + 6), a0 = Math.atan2(p[1] - p0[1], p[0] - p0[0]), a1 = Math.atan2(p1[1] - p[1], p1[0] - p[0]);
        let turn = Math.abs(a1 - a0); if (turn > Math.PI) turn = 2 * Math.PI - turn;
        const wall = edgeDist(S, p) - sp.rh;
        return { q: [p[0], p[1]], d: p[2], turn, wall, ok: turn < Math.PI / 4 && wall >= sp.pegWall + 0.08 && inPolys(Tl, p) };
      });
      loops.push({ len, cand });
    }
    const total = loops.reduce((t, l) => t + l.len, 0); if (!total) return [];
    const N = Math.max(3, Math.min(16, Math.round(total / sp.pegSpacing))), sites = [];
    for (const lp of loops.sort((x, y) => y.len - x.len)) {
      let m = Math.round(N * lp.len / total); m = Math.max(m, lp.len >= 60 ? 2 : 1); if (sites.length === 0) m = Math.max(m, loops.length === 1 ? 3 : 2);
      const good = lp.cand.filter(c => c.ok); if (!good.length) continue;
      m = Math.min(m, Math.max(1, Math.floor(lp.len / (2 * sp.rb + 6))));
      const gap = lp.len / m; let best = null;
      for (let ph = 0; ph < gap; ph += 2) { // the phase where every peg lands closest to its even spot, on the straightest run
        const pick = []; let cost = 0;
        for (let i = 0; i < m; i++) {
          const want = ph + i * gap; let b = null, bc = Infinity;
          for (const c of good) { let dd = Math.abs(c.d - want); dd = Math.min(dd, lp.len - dd); if (dd > gap / 3) continue; const cc = dd + c.turn * 20 - Math.min(c.wall, 4) * 2; if (cc < bc) { bc = cc; b = c; } }
          if (!b) { cost += 1e3; continue; } pick.push(b); cost += bc;
        }
        if (!best || cost < best.cost) best = { cost, pick };
      }
      for (const c of best.pick) if (!sites.some(o => Math.hypot(o.q[0] - c.q[0], o.q[1] - c.q[1]) < 2 * sp.rb + 4)) sites.push(c);
    }
    return sites;
  }
  // a part is still closed near one cut (only edges with both ends in the slab around the cut are counted)
  function closedNear(pc, a, v, R) {
    const p = pc.p, m = new Map(), K = (b) => k3(p[b], p[b + 1], p[b + 2]);
    for (let b = 0; b < p.length; b += 9) {
      if (Math.abs(p[b + a] - v) > R && Math.abs(p[b + 3 + a] - v) > R && Math.abs(p[b + 6 + a] - v) > R) continue;
      const k = [K(b), K(b + 3), K(b + 6)]; if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue;
      for (let e = 0; e < 3; e++) {
        const f = (e + 1) % 3; if (Math.abs(p[b + e * 3 + a] - v) > R || Math.abs(p[b + f * 3 + a] - v) > R) continue;
        const x = k[e], y = k[f], kk = x < y ? x + '|' + y : y + '|' + x; m.set(kk, (m.get(kk) || 0) + (x < y ? 1 : -1));
      }
    }
    for (const n of m.values()) if (n) return false;
    return true;
  }
  // One cut between A (cap `tag`, faces +axis) and its neighbour B. Mutates both parts. Returns a log entry or null.
  function rimPair(A, B, tag, cap, sp, opt) {
    const a = cap.axis, v = cap.v;
    const RA = capRegion(A, tag, a), RB = capRegion(B, cap.partner, a);
    if (!RA.length || !RB.length) return null;
    // the band must stay inside the outside surface on both sides: intersect the sections over the band depth
    let S = cBool('inter', RA, RB);
    const ctA0 = cavTag(a, 1), ctB0 = cavTag(a, 0); // the band runs from the face to where the cavity starts on each side
    const loA = A.capV && A.capV[ctA0] !== undefined ? Math.max(v - sp.D - 1, A.capV[ctA0]) : v - sp.D, hiB = B.capV && B.capV[ctB0] !== undefined ? Math.min(v + sp.D + 1, B.capV[ctB0]) : v + sp.D;
    for (const s of sectionsBetween(A, a, loA + 0.05, v - 0.03, 6).concat(sectionsBetween(B, a, v + 0.03, hiB - 0.05, 6))) { if (!S.length) break; S = cBool('inter', S, s); }
    const entry = { axis: a, v, A, B, rim: false, open: false, area: polysArea(RA) };
    if (!S.length) return entry;
    // lip (A) and channel (B)
    let Tl = cOpen(cBool('diff', cOff(S, -sp.o1), cOff(S, -sp.o2)), Math.min(0.8, sp.t * 0.35), 6);
    // pegs on A, holes on B at the same spots; the lip stops short of each peg so the channel never runs into a hole
    const sites = sp.pegs && Tl.length && !opt.noPegs ? pegSites(S, Tl, sp) : [];
    const Pg = sites.map(c => disc(c.q, sp.rp)), Hl = sites.map(c => disc(c.q, sp.rh));
    if (sites.length) Tl = cOpen(cBool('diff', Tl, sites.map(c => disc(c.q, sp.rg))), 0.6, 6);
    const Gr = Tl.length ? cOff(Tl, sp.c, 1) : [];
    // tunnel through the band, in terraces from the face opening Q[0] out to the cavity Q[n]
    let Q = null;
    const ctA = cavTag(a, 1), ctB = cavTag(a, 0);
    if (!opt.noTunnel && A.capV && B.capV && A.capV[ctA] !== undefined && B.capV[ctB] !== undefined && A.t.includes(ctA) && B.t.includes(ctB)) {
      const KA = capRegion(A, ctA, a), KB = capRegion(B, ctB, a);
      let Qn = cBool('inter', cBool('inter', cOff(KA, -0.4), cOff(KB, -0.4)), cOff(S, -sp.Bn), 4);
      const lv = [Qn];
      for (let k = sp.n - 1; k >= 0; k--) lv.unshift(cOpen(cOff(lv[0], -sp.step), 0.5, 4));
      // a solid boss round every peg hole, the full depth of the band (a little wider at each level towards the face,
      // so the terrace levels stay strictly nested)
      if (sites.length) for (let k = 0; k <= sp.n; k++) lv[k] = cOpen(cBool('diff', lv[k], sites.map(c => disc(c.q, sp.rb + (sp.n - k) * 0.25 + 0.3))), 0.4, 4);
      // keep only tunnels that reach the face (a closed face keeps a plain solid band, so a vent can still go through it)
      const keep = lv[0].filter(P => Math.abs(pArea(P.outer)) >= Math.max(16, 4 * sp.w * sp.w));
      if (keep.length) {
        const seeds = keep.map(P => P.outer[0]);
        Q = lv.map((ps, k) => k === 0 ? keep : ps.filter(P => seeds.some(q => pip(q, P.outer))));
      }
    }
    // A: face with the lip and the tunnel opening, the lip itself, the tunnel and the cavity cap
    const vA = v, vB = v;
    retri(A, tag, a, vA, +1, loopsOf(RA).concat(loopsOf(Tl), loopsOf(Pg), Q ? loopsOf(Q[0]) : []));
    retri(B, cap.partner, a, vB, -1, loopsOf(RB).concat(loopsOf(Gr), loopsOf(Hl), Q ? loopsOf(Q[0]) : []));
    if (sites.length) {
      const tp = []; prismWalls(tp, Pg, a, v, v + sp.hp, false); triangulatePolys(orientPolys(Pg), a, v + sp.hp, +1, tp, [], 0); pushTris(A, tp, RIM_TAG);
      const th = []; prismWalls(th, Hl, a, v, v + sp.hd, true); triangulatePolys(orientPolys(Hl), a, v + sp.hd, -1, th, [], 0); pushTris(B, th, RIM_TAG);
      entry.pegs = sites.map(c => { const pos = [0, 0, 0]; pos[a] = v; pos[UA[a]] = c.q[0]; pos[WA[a]] = c.q[1]; return { q: c.q, pos, wall: +c.wall.toFixed(2) }; });
    } else entry.pegs = [];
    if (Tl.length) {
      const tri = []; prismWalls(tri, Tl, a, v, v + sp.h, false); triangulatePolys(orientPolys(Tl), a, v + sp.h, +1, tri, [], 0); pushTris(A, tri, RIM_TAG);
      const trg = []; prismWalls(trg, Gr, a, v, v + sp.gd, true); triangulatePolys(orientPolys(Gr), a, v + sp.gd, -1, trg, [], 0); pushTris(B, trg, RIM_TAG);
      entry.rim = true;
    }
    if (Q) {
      for (const [pc, sign, ct] of [[A, +1, ctA], [B, -1, ctB]]) {
        const vc = pc.capV[ct], Dside = Math.abs(vc - v), at = d => v - sign * d;
        const ed = [0, sp.Dfull]; for (let k = 1; k <= sp.n; k++) ed.push(sp.Dfull + k * sp.step); ed[ed.length - 1] = Dside;
        const tri = [];
        for (let k = 0; k < Q.length; k++) {
          prismWalls(tri, Q[k], a, at(ed[k]), at(ed[k + 1]), true);
          if (k + 1 < Q.length) triangulatePolys(loopsToPolys(loopsOf(Q[k + 1]).concat(loopsOf(Q[k]))), a, at(ed[k + 1]), -sign, tri, [], 0);
        }
        pushTris(pc, tri, BAND_TAG);
        const K = capRegion(pc, ct, a);
        retri(pc, ct, a, vc, -sign, loopsOf(K).concat(loopsOf(Q[Q.length - 1])));
        pc.open = (pc.open || 0) + 1;
      }
      entry.open = true; entry.openArea = polysArea(Q[0]);
    }
    if (entry.rim) {
      // a point on the lip (for markers) and the geometry the fit check and the tests use
      let best = null; for (const P of Tl) { const ar = Math.abs(pArea(P.outer)); if (!best || ar > best.ar) best = { ar, q: P.outer[0] }; }
      const pos = [0, 0, 0]; pos[a] = v; pos[UA[a]] = best.q[0]; pos[WA[a]] = best.q[1];
      Object.assign(entry, { pos, lipArea: polysArea(Tl), lip: Tl, channel: Gr });
    }
    return entry;
  }

  // Grid split pieces (from cutGrid) of `soup`, hollowed as one shell with connection rims at every cut.
  // A cell's cavity, trimmed to the cavity shells that sit inside this part (a cell with two islands gets each its own).
  function cavityInIsland(cm, pc) {
    if (!cm || !cm.t.length || !pc.islands || pc.islands < 2) return cm;
    const bvh = buildBVH(Float64Array.from(pc.p)), keep = { p: [], t: [] };
    for (const cc of components(cm)) {
      const f = cc.tris[0] * 9, q = [(cm.p[f] + cm.p[f + 3] + cm.p[f + 6]) / 3, (cm.p[f + 1] + cm.p[f + 4] + cm.p[f + 7]) / 3, (cm.p[f + 2] + cm.p[f + 5] + cm.p[f + 8]) / 3];
      if (!inside(bvh, q)) continue;
      const sm = subMesh(cm, cc.tris); for (const x of sm.p) keep.p.push(x); for (const x of sm.t) keep.t.push(x);
    }
    if (!keep.t.length) return null;
    keep.capV = cm.capV; return keep;
  }
  function hollowRims(g, soup, P, opt, bvh, onProgress) {
    const sp = rimSpec(opt);
    const cav = opt.offsetCavity ? cavitySurface(soup, sp.w, bvh) : sdfCavity(soup, sp.w, bvh, { onProgress: f => onProgress && onProgress(0.25 * f, 'Hollowing the whole model'), budget: opt.budget });
    if (onProgress) onProgress(0.25, 'Cutting the cavity');
    const cell = cavityCells(cav, P, sp.D);
    for (const pc of g.pieces) {
      const cm = cavityInIsland(cell(pc.cell), pc); if (!cm) continue;
      const f = flip(Float64Array.from(cm.p));
      for (let i = 0; i < f.length; i++) pc.p.push(f[i]);
      for (let i = 0; i < cm.t.length; i++) pc.t.push(cm.t[i]);
      pc.cavity = true; pc.capV = cm.capV;
    }
    const pairs = gridPairs(g.pieces, g.caps);
    const log = { spec: sp, rims: [], open: 0, flat: 0, faces: pairs.length };
    // Every cut is checked: if a part that was closed is not closed after its rim (a degenerate sliver in the input or
    // the cavity can spoil a face), the cut is rebuilt without the tunnel, and failing that left as a plain solid band.
    const closedNow = pc => checkClosed(Float64Array.from(pc.p)).closed, R = sp.D + 2, snap = pc => ({ p: pc.p.slice(), t: pc.t.slice(), open: pc.open });
    const restore = (pc, s) => { pc.p = s.p; pc.t = s.t; pc.open = s.open; };
    const ok = new Map(g.pieces.map(pc => [pc, closedNow(pc)]));
    log.fallback = 0;
    pairs.forEach(([A, B, tag, cap], k) => {
      const sA = snap(A), sB = snap(B), wasA = ok.get(A), wasB = ok.get(B); // a part already open (input gaps) is not held to it
      let e = rimPair(A, B, tag, cap, sp, opt);
      const near = () => (!wasA || closedNear(A, cap.axis, cap.v, R)) && (!wasB || closedNear(B, cap.axis, cap.v, R));
      if ((wasA || wasB) && !near()) {
        restore(A, snap(sA)); restore(B, snap(sB)); log.fallback++;
        e = rimPair(A, B, tag, cap, sp, Object.assign({}, opt, { noTunnel: true }));
        if (!near()) { restore(A, sA); restore(B, sB); e = { axis: cap.axis, v: cap.v, A, B, rim: false, open: false, area: 0 }; }
      }
      if (e) { log.rims.push(e); if (e.open) log.open++; if (!e.rim) log.flat++; if (e.rim) { A.rims = (A.rims || 0) + 1; B.rims = (B.rims || 0) + 1; } }
      if (onProgress) onProgress(0.3 + 0.6 * (k + 1) / pairs.length, 'Adding connection rims');
    });
    let vents = 0;
    for (const pc of g.pieces) {
      pc.sealed = !!pc.cavity && !pc.open;
      if (pc.sealed && opt.vents > 0) { pc.vents = addVents(pc, g.caps, pc.capV, (opt.ventD || 3) / 2, opt.vents, bvh); vents += pc.vents; }
    }
    log.vents = vents;
    return log;
  }
  // Step lip for solid parts: a lip that follows the cut section a few mm in from the outside, into a matching channel
  // on the neighbour, with printed alignment pegs on the lip line. A section too thin for the full lip gets a slimmer
  // one without pegs; one too thin for that stays flat (glue). Any cut that would leave a part open is put back flat.
  function lipSpecs(opt) {
    const o = { rimH: opt.rimH == null ? 4 : opt.rimH, clearance: opt.clearance == null ? 0.2 : opt.clearance };
    // thin walls (down to about 4 mm): a 1.6 mm lip with 0.9 mm either side of its channel
    const thin = rimSpec(Object.assign({ wall: 1.4, pegs: false }, o)), c = thin.c, t = 1.6, sw = 0.9;
    Object.assign(thin, { t, s: sw, B: t + 2 * c + 2 * sw, o1: sw + c, o2: sw + c + t });
    const out = [rimSpec(Object.assign({ wall: opt.wall || 3, pegs: opt.pegs !== false }, o)), rimSpec(Object.assign({ wall: 1.4, pegs: false }, o)), thin];
    // no cavity tunnel here, so the section only has to hold over the channel and peg-hole depth (a curved thin wall
    // drifts sideways quickly, so a deeper band would rule out lips that fit fine)
    for (const sp of out) sp.D = Math.max(sp.gd, sp.pegs ? sp.hd : 0) + 1;
    return out;
  }
  function lipPairs(pieces, caps) {
    return gridPairs(pieces, caps);
  }
  function lipOne(A, B, tag, cap, specs, log) {
    const snap = pc => ({ p: pc.p.slice(), t: pc.t.slice() }), restore = (pc, s) => { pc.p = s.p; pc.t = s.t; };
    const sA = snap(A), sB = snap(B), wasA = checkClosed(Float64Array.from(A.p)).closed, wasB = checkClosed(Float64Array.from(B.p)).closed;
    for (let k = 0; k < specs.length; k++) {
      const sp = specs[k], e = rimPair(A, B, tag, cap, sp, { noTunnel: true });
      const R = Math.max(sp.gd, sp.hd, sp.hp, sp.h) + 2, ok = e && e.rim && (!wasA || closedNear(A, cap.axis, cap.v, R)) && (!wasB || closedNear(B, cap.axis, cap.v, R));
      if (ok) { e.spec = sp; e.slim = k > 0; e.thin = k > 1; log.rims.push(e); A.rims = (A.rims || 0) + 1; B.rims = (B.rims || 0) + 1; if (k > 0) log.slim++; return e; }
      restore(A, snap(sA)); restore(B, snap(sB)); if (e && e.rim) log.fallback++;
    }
    log.flat++; log.rims.push({ axis: cap.axis, v: cap.v, A, B, rim: false, open: false, area: 0 });
    return null;
  }
  function lipJoints(pieces, caps, opt, onProgress) {
    const specs = lipSpecs(opt || {}), pairs = lipPairs(pieces, caps);
    const log = { spec: specs[0], specs, rims: [], open: 0, flat: 0, slim: 0, fallback: 0, faces: pairs.length, lip: true };
    pairs.forEach(([A, B, tag, cap], k) => { lipOne(A, B, tag, cap, specs, log); if (onProgress) onProgress((k + 1) / pairs.length); });
    return log;
  }

  // Fit-check items for rims (same shape as joint items): the lip has a channel, clearance in range, walls beside the channel.
  function rimFit(log, pieces) {
    const out = [];
    for (const e of log.rims) {
      if (!e.rim) continue;
      const sp = e.spec || log.spec, notes = []; let level = 0; const bump = (l, m) => { level = Math.max(level, l); notes.push(m); };
      if (sp.c < 0.1) bump(2, `clearance ${sp.c} mm is too tight for a rim (try 0.2-0.3 mm)`); else if (sp.c < 0.15) bump(1, `clearance ${sp.c} mm is tight (try 0.2 mm or more)`); else if (sp.c > 0.45) bump(1, `clearance ${sp.c} mm is loose; the parts may wobble`);
      if (sp.s < 1.2) bump(1, `only ${sp.s.toFixed(1)} mm of wall beside the channel`);
      const dir = e.dirW || (() => { const d = [0, 0, 0]; d[e.axis] = 1; return d; })();
      out.push({ pos: e.pos, dir, type: e.spec && log.lip ? 'lip' : 'rim', A: pieces.indexOf(e.A), B: pieces.indexOf(e.B), status: ['ok', 'warn', 'bad'][level], notes, wall: +sp.s.toFixed(2) });
    }
    return out;
  }

  // ---------------------------------------------------------------- hollow a whole model
  // The outside stays exactly as it was (all detail kept); the inside is an offset shell `wall` mm in.
  // Drain holes go through the base: a sliver (usually well under 1 mm) is trimmed off the lowest point to make a
  // flat spot, the cavity gets a flat floor `wall` above it, and a tube joins the two.
  function hollowSolid(soup, opt) {
    const wall = Math.max(0.8, opt.wall || 2), drains = opt.drains || 0, r = Math.max(0.75, (opt.drainD || 4) / 2);
    const bvh = buildBVH(soup);
    const cav = cavitySurface(soup, wall, bvh);
    if (!drains) {
      const p = new Float64Array(soup.length + cav.length); p.set(soup); p.set(flip(Float64Array.from(cav)), soup.length);
      return { p, trimmed: 0, drains: 0 };
    }
    const bb = bbox(soup), H = bb.max[2] - bb.min[2];
    // A trim height can cut the cavity where it is ragged and leave the shell open; only a watertight result counts.
    const srcClosed = checkClosed(soup).closed;
    let best = null;
    for (const t of [0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.8, 1.2, 1.8, 2.5]) {
      if (t > Math.min(H * 0.2, wall * 1.5)) break;
      const P = [[], [], [nudgePlane(soup, 2, bb.min[2] + t)]];
      const g = cutGrid(soup, P);
      const top = g.pieces.find(pc => pc.cell[2] === 1); if (!top) continue;
      const cm = cavityForCell(cav, P, [0, 0, 1], wall);
      if (!cm || !cm.t.length) continue;
      const f = flip(Float64Array.from(cm.p));
      for (let i = 0; i < f.length; i++) top.p.push(f[i]);
      for (let i = 0; i < cm.t.length; i++) top.t.push(cm.t[i]);
      const made = addVents(top, g.caps, cm.capV, r, drains, bvh);
      if (!made) continue;
      const p = Float64Array.from(top.p);
      if (srcClosed && !checkClosed(p).closed) continue;
      if (!best || made > best.drains) best = { p, trimmed: t, drains: made };
      if (made >= drains) break;
    }
    if (!best) { const p = new Float64Array(soup.length + cav.length); p.set(soup); p.set(flip(Float64Array.from(cav)), soup.length); return { p, trimmed: 0, drains: 0 }; }
    return best;
  }
  // Push-in plugs for drain holes (printed separately; a lip stops them falling in).
  function drainPlugs(count, d, wall) {
    const r = d / 2 - 0.1, out = [];
    for (let i = 0; i < count; i++) {
      const F = frame(2, 0, i * (d + 8) + d / 2 + 2, d / 2 + 2, +1);
      const m = revolve(F, [[0, r + 1.5], [0.8, r + 1.5], [0.8, r], [0.8 + wall - 0.2, r], [0.8 + wall, r - 0.3]], false, 28, true);
      for (const x of m.tris) out.push(x);
    }
    return Float64Array.from(out);
  }

  // ---------------------------------------------------------------- two-part box mold
  // Box around the model minus the model, split on a parting plane through the middle, with peg keys
  // between the halves so they register. With `pour`, the top `trim` mm of the model is left open as the pour hole.
  function moldBox(soup, opt) {
    const wall = Math.max(4, opt.wall || 10), axis = opt.axis === 1 ? 1 : 0, bb = bbox(soup);
    const pour = opt.pour !== false, trim = Math.max(0.5, opt.trim || 2);
    const x0 = bb.min[0] - wall, y0 = bb.min[1] - wall, z0 = bb.min[2] - wall, x1 = bb.max[0] + wall, y1 = bb.max[1] + wall;
    let cav, z1, holes = [];
    if (pour) {
      z1 = nudgePlane(soup, 2, bb.max[2] - trim);
      const r = cutPlane({ p: Array.from(soup), t: new Array(soup.length / 9).fill(-1) }, 2, z1, 0, 1);
      removeTag(r.neg, 0);
      cav = flip(Float64Array.from(r.neg.p)); holes = r.polys;
    } else { z1 = bb.max[2] + wall; cav = flip(Float64Array.from(soup)); }
    const out = Array.from(cav), tt = [];
    const quad = (A, B, C, D) => out.push(...A, ...B, ...C, ...A, ...C, ...D);
    const shape = opt.outer === 'cylinder' || opt.outer === 'sphere' ? opt.outer : 'box';
    let loops, dims;
    if (shape === 'box') {
      // outward-facing box: bottom, four sides; the top is triangulated with the pour hole(s) cut out
      quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);
      quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
      quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
      quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]);
      quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]);
      loops = [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
      dims = [x1 - x0, y1 - y0, z1 - z0];
    } else {
      // round outside: a cylinder on the vertical axis, or a ball flattened at the bottom (to stand) and at the top (the
      // pour face). The radius clears every vertex of the model by the wall; the facets sit inside the true surface by
      // under 0.3% of the radius, so the wall stays at least `wall` less that sliver.
      const S = 96, cx = (bb.min[0] + bb.max[0]) / 2, cy = (bb.min[1] + bb.max[1]) / 2, cz = (bb.min[2] + bb.max[2]) / 2;
      let r2 = 0, r3 = 0;
      for (let i = 0; i < soup.length; i += 3) { const dx = soup[i] - cx, dy = soup[i + 1] - cy, dz = soup[i + 2] - cz; r2 = Math.max(r2, dx * dx + dy * dy); r3 = Math.max(r3, dx * dx + dy * dy + dz * dz); }
      const ring = (r, z) => { const L = []; for (let i = 0; i < S; i++) { const t = 2 * Math.PI * i / S; L.push([cx + r * Math.cos(t), cy + r * Math.sin(t), z]); } return L; };
      const rings = [];
      if (shape === 'cylinder') { const R = Math.sqrt(r2) + wall; rings.push(ring(R, z0), ring(R, z1)); dims = [2 * R, 2 * R, z1 - z0]; }
      else {
        const R = Math.sqrt(r3) + wall + 1, pa = Math.acos(Math.max(-1, Math.min(1, (z0 - cz) / R))), pb = Math.acos(Math.max(-1, Math.min(1, (z1 - cz) / R)));
        const K = Math.max(2, Math.ceil((pa - pb) / (Math.PI / 40)));
        for (let k = 0; k <= K; k++) { const ph = pa + (pb - pa) * k / K, z = k === 0 ? z0 : k === K ? z1 : cz + R * Math.cos(ph); rings.push(ring(R * Math.sin(ph), z)); }
        dims = [2 * R, 2 * R, z1 - z0];
      }
      for (let k = 0; k + 1 < rings.length; k++) for (let i = 0; i < S; i++) { const j = (i + 1) % S; quad(rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]); }
      triangulatePolys([{ outer: rings[0].map(q => [q[0], q[1]]), holes: [] }], 2, z0, -1, out, tt, 0);
      loops = [rings[rings.length - 1].map(q => [q[0], q[1]])];
    }
    for (const P of holes) { loops.push(P.outer); for (const h of P.holes) loops.push(h); }
    triangulatePolys(loopsToPolys(loops), 2, z1, +1, out, tt, 0);
    const M = Float64Array.from(out);
    const v = nudgePlane(M, axis, (bb.min[axis] + bb.max[axis]) / 2 + (opt.offset || 0));
    const P = [[], [], []]; P[axis] = [v];
    const g = cutGrid(M, P);
    g.pieces.forEach((pc, i) => { pc.number = i + 1; pc.labelText = 'AB'[i] || String(i + 1); });
    let log = { placed: 0, joints: [] };
    if (opt.keys !== 0) {
      const kd = opt.keyD || Math.max(5, Math.min(12, wall * 0.8));
      log = addConnectors(g.pieces, g.caps, { type: 'peg', autoSize: false, diameter: kd, length: Math.max(4, Math.min(kd, wall * 0.8)), tolerance: opt.tolerance == null ? 0.25 : opt.tolerance, minWall: 1.5, perFace: opt.keys || 4 }, buildBVH(M));
    }
    return { pieces: g.pieces.map(pc => ({ p: Float64Array.from(pc.p), number: pc.number, id: pc.labelText, cell: pc.cell })), keys: log.placed, pour, box: dims, shape, parting: { axis, v } };
  }

  // ---------------------------------------------------------------- multi-piece shell mold
  // A thin conformal shell around the model (every point within `shell` mm of its surface), split radially around the
  // vertical axis into `pieces` wedges, with a flat flange on each side of every parting plane that follows the shell's
  // profile (`flangeW` wide beyond the shell, `flangeT` thick per piece) and bolt holes through matching flange pairs.
  // The outside (shell + flanges + holes) is one distance field on a grid, meshed with marching tetrahedra (closed by
  // construction); the inside is the model's own surface, so the cavity is exact. The solid is then cut with exact plane
  // cuts (capped), so every piece is watertight and the faces of neighbouring pieces are flat and match.
  function moldShell(soup, opt, onProgress) {
    opt = opt || {};
    const prog = onProgress || (() => {});
    const num = (v, d, lo, hi) => { v = v == null || v === '' || !isFinite(+v) ? d : +v; return Math.min(hi, Math.max(lo, v)); };
    const T = num(opt.shell, 3, 1, 20), N = Math.round(num(opt.pieces, 6, 2, 12)), rot = num(opt.rotate, 0, -360, 360) * Math.PI / 180;
    const W = num(opt.flangeW, 12, 0, 60), gap = num(opt.gap, 0.2, 0, 2), ft = num(opt.flangeT, 3, 1, 20), ftE = ft + gap / 2;
    const holeD = W > 0 ? num(opt.holeD, 4, 0, 20) : 0, rad = holeD / 2, spacing = num(opt.holeSpacing, 35, 5, 500), maxHoles = Math.round(num(opt.holesPer, 0, 0, 50));
    const thin = opt.thin ? num(opt.thin, 3, 1.5, 30) : 0, base = !!(opt.base || thin);
    const open = base || opt.openBottom !== false, trim = num(opt.trim, 2, 0, 1e4);
    if (!checkClosed(soup).closed) throw new Error('the model is not watertight: run Repair STL first');
    const bb = bbox(soup), bvh = buildBVH(soup);
    const c = [(bb.min[0] + bb.max[0]) / 2 + (opt.cx || 0), (bb.min[1] + bb.max[1]) / 2 + (opt.cy || 0)];
    const zb = open ? bb.min[2] + Math.min(trim, (bb.max[2] - bb.min[2]) * 0.5) : -Infinity;
    const ext = [0, 1, 2].map(a => bb.max[a] - bb.min[a]);
    const hFine = Math.min(T * 0.5, ft * 0.6, rad > 0 ? Math.max(0.6, holeD / 3) : 99, thin ? thin * 0.4 : 99);
    const R0 = T + W + 1;
    const h = opt.cell || Math.max(0.5, hFine, Math.cbrt((ext[0] + 2 * R0) * (ext[1] + 2 * R0) * (ext[2] + 2 * R0) / (opt.budget || 5e6)));
    const R = T + W + 2 * h;
    // parting planes: half-plane k leaves the axis along u_k at angle th_k; its normal n_k points toward the next plane
    const th = [], U = [], Nn = []; for (let k = 0; k < N; k++) { const a = rot + k * 2 * Math.PI / N; th.push(a); U.push([Math.cos(a), Math.sin(a)]); Nn.push([-Math.sin(a), Math.cos(a)]); }
    const dAt = (P, rmax) => { const d = nearestPoint(bvh, P, rmax); return d < rmax && inside(bvh, P) ? -d : d; };
    // ---- bolt holes: centres on the middle of each flange, in the plane, spaced along it
    const holes = [];
    if (rad > 0) {
      // the hole must clear the shell (it would open into the cavity) and leave flange material around it
      const dMin = T + 0.5 + Math.hypot(rad, ftE + 0.5 * h), dMax = T + W - rad - 1, step = Math.max(0.75, Math.min(1.5, h));
      const L = Math.min(dMax, Math.max(dMin, T + W / 2));
      const dTh = 2 * Math.PI / N, sinD = Math.sin(Math.min(dTh, Math.PI / 2)), rMin = N > 2 ? (rad + 2 * ftE + h + 2) / sinD : rad + 2;
      const rMax = Math.max(...[[bb.min[0], bb.min[1]], [bb.max[0], bb.min[1]], [bb.min[0], bb.max[1]], [bb.max[0], bb.max[1]]].map(q => Math.hypot(q[0] - c[0], q[1] - c[1]))) + T + W;
      const z0 = Math.max(bb.min[2] - T - W, zb + rad + 2), z1 = bb.max[2] + T + W;
      for (let k = 0; k < N; k++) {
        const cand = [], P = [0, 0, 0];
        for (let z = z0; z <= z1; z += step) for (let r = rMin; r <= rMax; r += step) {
          P[0] = c[0] + U[k][0] * r; P[1] = c[1] + U[k][1] * r; P[2] = z;
          const d = nearestPoint(bvh, P, dMax + 1);
          if (Math.abs(d - L) > step * 0.75 || d < dMin || d > dMax || inside(bvh, P)) continue;
          cand.push([r, z, Math.abs(d - L)]);
        }
        // walk along the midline from its lowest point: each next hole is the nearest candidate at least `spacing` from all
        const picked = [];
        if (cand.length) {
          cand.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
          picked.push(cand[0]);
          for (;;) {
            const last = picked[picked.length - 1]; let best = null, bd = Infinity;
            for (const q of cand) {
              if (picked.some(p => Math.hypot(p[0] - q[0], p[1] - q[1]) < spacing)) continue;
              const dd = Math.hypot(last[0] - q[0], last[1] - q[1]) + q[2] * 4; if (dd < bd) { bd = dd; best = q; }
            }
            if (!best) break; picked.push(best);
          }
        }
        let use = picked;
        if (maxHoles && picked.length > maxHoles) { use = []; for (let i = 0; i < maxHoles; i++) use.push(picked[Math.round(i * (picked.length - 1) / Math.max(1, maxHoles - 1))]); }
        for (const q of use) holes.push({ plane: k, r: q[0], z: q[1], c: [c[0] + U[k][0] * q[0], c[1] + U[k][1] * q[0], q[1]], n: [Nn[k][0], Nn[k][1], 0], d: holeD });
      }
    }
    const cellNote = thin && h > thin * 0.5 ? `This model is large for a ${thin} mm thin cast: the core is built on a ${h.toFixed(1)} mm grid, so the cast wall will vary by about ${h.toFixed(1)} mm. A thicker cast is safer.` : h > T * 0.6 ? `This model is large for a ${T} mm shell: the outside is built on a ${h.toFixed(1)} mm grid, so the shell may come out thin in places. A ${Math.ceil(h * 2)} mm shell or thicker is safer.` : '';
    const holeNote = rad > 0 && holes.length === 0 ? `The flanges are too narrow for ${holeD} mm holes; make them wider or the holes smaller.` : '';
    prog(0.08, 'Measuring around the model');
    // ---- distance field on the grid: inside = F < 0
    const lo = [bb.min[0] - R - h, bb.min[1] - R - h, Math.max(bb.min[2] - R - h, open ? zb - 4 * h : -Infinity)];
    const n = [0, 1, 2].map(a => Math.max(3, Math.ceil((bb.max[a] + R + h - lo[a]) / h) + 1));
    const nx = n[0], ny = n[1], nz = n[2], NN = nx * ny * nz, F = new Float32Array(NN).fill(1);
    const Fc = thin ? new Float32Array(NN).fill(1) : null; // thin cast: the core (the model shrunk by `thin`), inside = Fc < 0
    // the core is measured from the model's surface above the opening only, so it reaches down to the plate (the cast is
    // open there, like the back of a mask)
    let bvhC = bvh;
    if (thin) { const r = cutPlane({ p: Array.from(soup), t: new Array(soup.length / 9).fill(0) }, 2, nudgePlane(soup, 2, zb), 8, 8); removeTag(r.pos, 8); if (r.pos.p.length) bvhC = buildBVH(Float64Array.from(r.pos.p)); }
    const idx = (i, j, k) => (k * ny + j) * nx + i, P = [0, 0, 0], hs = Array.from({ length: N }, () => 0);
    const hByPlane = Array.from({ length: N }, (_, k) => holes.filter(o => o.plane === k));
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const x = lo[0] + i * h, y = lo[1] + j * h;
        const hits = rayAll(bvh, [x + 1.234e-5, y + 2.345e-5, bb.min[2] - 1], [0, 0, 1]);
        const qx = x - c[0], qy = y - c[1];
        // planes near this column (the flange slabs are vertical, so this holds for the whole column)
        const near = []; if (W > 0) for (let k = 0; k < N; k++) { const s = qx * Nn[k][0] + qy * Nn[k][1], u = qx * U[k][0] + qy * U[k][1]; hs[k] = s; if (Math.abs(s) < ftE + 2 * h && u > -2 * h) near.push(k); }
        for (let k = 1; k < nz - 1; k++) {
          const z = lo[2] + k * h, t = z - (bb.min[2] - 1);
          let cc = 0; while (cc < hits.length && hits[cc] < t) cc++;
          P[0] = x; P[1] = y; P[2] = z;
          if (cc & 1) { // inside the model: solid (the cavity is the model's own surface)
            F[idx(i, j, k)] = -T;
            if (Fc) { const f = thin - nearestPoint(bvhC, P, thin + 2 * h); Fc[idx(i, j, k)] = Math.abs(f) < 1e-6 ? 1e-6 : f; }
            continue;
          }
          const d = nearestPoint(bvh, P, near.length ? R : T + 2 * h);
          let f = d - T;
          for (const kk of near) {
            const u = qx * U[kk][0] + qy * U[kk][1], g = Math.max(Math.abs(hs[kk]) - ftE, d - (T + W), -u);
            if (g < f) f = g;
            for (const o of hByPlane[kk]) {
              const dx = x - o.c[0], dy = y - o.c[1], dz = z - o.c[2], s = dx * o.n[0] + dy * o.n[1];
              const rho = Math.hypot(dx - s * o.n[0], dy - s * o.n[1], dz), hv = Math.min(rad - rho, ftE + 0.5 * h - Math.abs(s));
              if (hv > f) f = hv;
            }
          }
          F[idx(i, j, k)] = Math.abs(f) < 1e-6 ? 1e-6 : f;
        }
      }
      if ((j & 3) === 0) prog(0.08 + 0.5 * j / ny, 'Measuring around the model');
    }
    prog(0.6, 'Meshing the shell');
    // ---- marching tetrahedra (as sdfCavity)
    const march = F => {
    const emap = new Map(), V = [], tri3 = [];
    const pos = g => { const i = g % nx, j = ((g - i) / nx) % ny, k = Math.floor(g / (nx * ny)); return [lo[0] + i * h, lo[1] + j * h, lo[2] + k * h]; };
    const ev = (a, b) => {
      const key = a < b ? a * NN + b : b * NN + a; let v = emap.get(key);
      if (v === undefined) { const t = Math.min(0.98, Math.max(0.02, F[a] / (F[a] - F[b]))), A = pos(a), B = pos(b); v = V.length / 3; V.push(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); emap.set(key, v); }
      return v;
    };
    const tri = (a, b, cc, ins, outs) => {
      const A = [V[a * 3], V[a * 3 + 1], V[a * 3 + 2]], u = [V[b * 3] - A[0], V[b * 3 + 1] - A[1], V[b * 3 + 2] - A[2]], w = [V[cc * 3] - A[0], V[cc * 3 + 1] - A[1], V[cc * 3 + 2] - A[2]];
      const nn = cross(u, w), I = pos(ins), O = pos(outs);
      if (nn[0] * (O[0] - I[0]) + nn[1] * (O[1] - I[1]) + nn[2] * (O[2] - I[2]) < 0) tri3.push(a, cc, b); else tri3.push(a, b, cc);
    };
    const gc = new Int32Array(8);
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      let any = 0, all = 1;
      for (let q = 0; q < 8; q++) { gc[q] = idx(i + CUBE8[q][0], j + CUBE8[q][1], k + CUBE8[q][2]); if (F[gc[q]] < 0) any = 1; else all = 0; }
      if (!any || all) continue;
      for (const TT of TETS6) {
        const ins = [], outs = [];
        for (const t of TT) (F[gc[t]] < 0 ? ins : outs).push(gc[t]);
        if (ins.length === 1) tri(ev(ins[0], outs[0]), ev(ins[0], outs[1]), ev(ins[0], outs[2]), ins[0], outs[0]);
        else if (ins.length === 3) tri(ev(ins[0], outs[0]), ev(ins[1], outs[0]), ev(ins[2], outs[0]), ins[0], outs[0]);
        else if (ins.length === 2) { const a = ev(ins[0], outs[0]), b = ev(ins[0], outs[1]), e1 = ev(ins[1], outs[1]), e2 = ev(ins[1], outs[0]); tri(a, b, e1, ins[0], outs[0]); tri(a, e1, e2, ins[0], outs[0]); }
      }
    }
    return { V, tri3 };
    };
    const { V, tri3 } = march(F);
    // whole solid: outer surface (tag 0) + the model turned inside out (the cavity, tag 1)
    const cav = flip(soup), nOut = tri3.length / 3;
    let mesh = { p: new Array(tri3.length * 3 + cav.length), t: new Array(nOut + cav.length / 9) };
    for (let q = 0; q < tri3.length; q++) { const v = tri3[q] * 3, o = q * 3; mesh.p[o] = V[v]; mesh.p[o + 1] = V[v + 1]; mesh.p[o + 2] = V[v + 2]; }
    for (let q = 0; q < cav.length; q++) mesh.p[tri3.length * 3 + q] = cav[q];
    mesh.t.fill(0, 0, nOut); mesh.t.fill(1, nOut);
    const outerTris = nOut;
    // ---- radial cuts: rotate so the plane is y = 0, cut, rotate back
    const rotM = (m, ang) => { const cs = Math.cos(ang), sn = Math.sin(ang), p = m.p, o = new Array(p.length);
      for (let i = 0; i < p.length; i += 3) { const x = p[i] - c[0], y = p[i + 1] - c[1]; o[i] = c[0] + x * cs - y * sn; o[i + 1] = c[1] + x * sn + y * cs; o[i + 2] = p[i + 2]; }
      return { p: o, t: m.t }; };
    const pieces = [];
    for (let k = 0; k < N; k++) {
      prog(0.72 + 0.26 * k / N, `Cutting piece ${k + 1} of ${N}`);
      const a = th[k], b = th[(k + 1) % N], span = N === 2 ? Math.PI : 2 * Math.PI / N;
      // a cut can (rarely) leave a sliver hole where it grazes the marching-tetrahedra mesh: retry a hair further off
      // (the radial cuts go first and the pour opening last: cutting across the flat bottom cap left slivers)
      let m, best = null;
      for (let at = 0; at < 8; at++) {
        const e = at * 0.0123;
        m = rotM(mesh, -a);
        m = cutPlane(m, 1, nudgePlane(m.p, 1, c[1] + gap / 2 + e), 3, 3).pos; // angles (a, a + 180)
        if (N > 2) { m = rotM(m, -span); m = cutPlane(m, 1, nudgePlane(m.p, 1, c[1] - gap / 2 - e), 3, 3).neg; m = rotM(m, a + span); } else m = rotM(m, a);
        if (open) m = cutPlane(m, 2, nudgePlane(m.p, 2, zb + at * 0.0071), 2, 2).pos;
        const ck = checkClosed(m.p);
        if (!best || ck.open < best.open) best = { m, open: ck.open };
        if (ck.closed) break;
      }
      m = dropFins(best.m);
      const p = Float64Array.from(m.p), mid = a + span / 2;
      pieces.push({ p, id: k + 1, planes: [k, (k + 1) % N], dir: [Math.cos(mid), Math.sin(mid), 0], tags: Int8Array.from(m.t) });
    }
    let plate = null;
    if (base) {
      prog(0.985, thin ? 'Building the base plate and core' : 'Building the base plate');
      const outP = new Float64Array(tri3.length * 3); for (let q = 0; q < tri3.length; q++) { const v = tri3[q] * 3; outP[q * 3] = V[v]; outP[q * 3 + 1] = V[v + 1]; outP[q * 3 + 2] = V[v + 2]; }
      let core = null;
      if (thin) { const cm = march(Fc); core = new Float64Array(cm.tri3.length * 3); for (let q = 0; q < cm.tri3.length; q++) { const v = cm.tri3[q] * 3; core[q * 3] = cm.V[v]; core[q * 3 + 1] = cm.V[v + 1]; core[q * 3 + 2] = cm.V[v + 2]; } }
      plate = basePlate(soup, outP, core, zb, opt);
    }
    prog(0.99, 'Checking the pieces');
    return { pieces, holes, base: plate, thin, planes: th.map((a, k) => ({ angle: a, u: [U[k][0], U[k][1], 0], n: [Nn[k][0], Nn[k][1], 0] })), center: [c[0], c[1]], zb: open ? zb : null,
      cell: h, outerTris, holeNote, cellNote, shell: T, flangeW: W, flangeT: ft, gap, holeD, open, box: [ext[0] + 2 * (T + W), ext[1] + 2 * (T + W), bb.max[2] + T + W - (open ? zb : bb.min[2] - T - W)] };
  }

  // Base plate for an open-bottom shell mold: a flat slab that closes the opening, with a low fence around the shell's
  // footprint so the pieces sit in place, a sprue (pour hole) where the opening is widest and vents at its far ends.
  // Pour with the mold turned over (plate on top). With a core (thin cast), the core stands on the plate as one solid:
  // its cut edge is shared with holes in the plate's top face, so the two are one watertight body.
  // Everything is built from shared loops (no Booleans): flat faces from triangulatePolys, walls from quads.
  function basePlate(soup, outerSoup, coreSoup, zb, opt) {
    const num = (v, d, lo, hi) => { v = v == null || v === '' || !isFinite(+v) ? d : +v; return Math.min(hi, Math.max(lo, v)); };
    const pt = num(opt.plateT, 4, 1.5, 20), fh = num(opt.fenceH, 5, 2, 30), fw = num(opt.fenceW, 3, 1.2, 20), fit = num(opt.fit, 0.4, 0, 3);
    const sprueD = num(opt.sprueD, 8, 0, 40), ventD = num(opt.ventD, 3, 0, 20), nV = Math.round(num(opt.vents, 2, 0, 8));
    const notes = [];
    const zc = nudgePlane(coreSoup || soup, 2, zb);
    // ---- footprint of the shell at the cut: its convex outline, grown by the fit clearance (fence inside) and the fence
    const sec = sectionPolys(outerSoup, 2, zb + 0.05), fp = [];
    for (const P of sec) for (const q of P.outer) fp.push(q);
    if (fp.length < 3) throw new Error('the shell has no footprint at the opening');
    const hull = pts => {
      const a = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]), cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
      const lo = [], up = [];
      for (const p of a) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
      for (let i = a.length - 1; i >= 0; i--) { const p = a[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-12) up.pop(); up.push(p); }
      return lo.slice(0, -1).concat(up.slice(0, -1)); // counter-clockwise
    };
    const grow = (H, r) => { const P = []; for (const q of H) for (let i = 0; i < 16; i++) { const t = 2 * Math.PI * i / 16; P.push([q[0] + r * Math.cos(t), q[1] + r * Math.sin(t)]); } return hull(P); };
    const H0 = hull(fp), inner = grow(H0, fit + 0.01), outer = grow(H0, fit + fw);
    const circle = (c, r) => { const L = [], n = Math.max(16, Math.min(48, Math.ceil(r * 8))); for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; L.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); } return L; };
    // ---- the core (thin cast): the part above the plate, open where it was cut; pieces that float are left out
    let coreP = [], coreLoops = [], dropped = 0, coreVol = 0;
    if (coreSoup && coreSoup.length) {
      const r = cutPlane({ p: Array.from(coreSoup), t: new Array(coreSoup.length / 9).fill(0) }, 2, zc, 6, 6);
      const m = r.pos; coreVol = signedVolume(Float64Array.from(m.p)); removeTag(m, 6);
      for (const cp of components(m)) { const sm = subMesh(m, cp.tris); if (!cp.open.length) { dropped++; coreVol -= signedVolume(Float64Array.from(sm.p)); continue; } for (const v of sm.p) coreP.push(v); }
      for (const P of r.polys) { coreLoops.push(P.outer); for (const hh of P.holes) coreLoops.push(hh); }
      if (!coreLoops.length) notes.push('The model is too thin here for a hollow cast of that wall: it casts solid.');
      if (dropped) notes.push(`${dropped} thick part${dropped > 1 ? 's' : ''} away from the base stay${dropped > 1 ? '' : 's'} solid (the core cannot reach ${dropped > 1 ? 'them' : 'it'}).`);
    }
    // ---- where to pour: the opening (the model's own section at the cut) less the core
    const open = sectionPolys(soup, 2, zc), regLoops = [];
    for (const P of open) { regLoops.push(P.outer); for (const hh of P.holes) regLoops.push(hh); }
    for (const L of coreLoops) regLoops.push(L);
    const segs = []; for (const L of regLoops) for (let i = 0; i < L.length; i++) segs.push([L[i], L[(i + 1) % L.length]]);
    const inReg = (x, y) => { let c = 0; for (const [a, b] of segs) if ((a[1] > y) !== (b[1] > y) && x < a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) c++; return c & 1; };
    const clear = (x, y) => { let d = Infinity; for (const [a, b] of segs) { const ux = b[0] - a[0], uy = b[1] - a[1], L2 = ux * ux + uy * uy, t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * ux + (y - a[1]) * uy) / L2)) : 0; d = Math.min(d, Math.hypot(x - a[0] - t * ux, y - a[1] - t * uy)); } return d; };
    const cand = [];
    if (segs.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [a] of segs) { x0 = Math.min(x0, a[0]); y0 = Math.min(y0, a[1]); x1 = Math.max(x1, a[0]); y1 = Math.max(y1, a[1]); }
      const st = Math.max(0.25, Math.max(x1 - x0, y1 - y0) / 90);
      for (let y = y0 + st / 2; y < y1; y += st) for (let x = x0 + st / 2; x < x1; x += st) if (inReg(x, y)) cand.push([x, y, clear(x, y)]);
    }
    const circles = [];
    let sprue = null; const vents = [];
    if (sprueD > 0 && cand.length) {
      let b = cand[0]; for (const q of cand) if (q[2] > b[2]) b = q;
      const r = Math.min(sprueD / 2, b[2] - 0.5);
      if (r >= 0.75) { sprue = { c: [b[0], b[1]], d: +(2 * r).toFixed(2) }; circles.push(circle(sprue.c, r)); if (2 * r < sprueD - 0.01) notes.push(`The opening is narrow, so the sprue is ${sprue.d.toFixed(1)} mm (asked ${sprueD} mm): pour slowly, or use a syringe.`); }
      else notes.push('The opening is too narrow for a sprue: leave it off and pour before fitting the plate.');
    }
    if (sprue && ventD > 0 && nV > 0) {
      // vents shrink to fit a narrow opening (down to 1.5 mm)
      const placed = [{ c: sprue.c, r: sprue.d / 2 }];
      for (let k = 0; k < nV; k++) {
        let best = null, bd = -1, br = 0;
        // full-size vents first; smaller ones only where nothing full-size fits
        for (let pass = 0; pass < 2 && !best; pass++) for (const q of cand) {
          const vr = Math.min(ventD / 2, q[2] - 0.5); if (vr < 0.75 || (!pass && vr < ventD / 2)) continue;
          // far from the sprue, and spread from the other vents
          let dm = Infinity, dv = Infinity; placed.forEach((o, i) => { const d = Math.hypot(q[0] - o.c[0], q[1] - o.c[1]) - o.r - vr; dm = Math.min(dm, d); if (i) dv = Math.min(dv, d); });
          const sc = Math.hypot(q[0] - sprue.c[0], q[1] - sprue.c[1]) + (dv === Infinity ? 0 : dv) + 2 * vr;
          if (dm > 2 && sc > bd) { bd = sc; best = q; br = vr; }
        }
        if (!best) break;
        vents.push({ c: [best[0], best[1]], d: +(2 * br).toFixed(2) }); placed.push({ c: [best[0], best[1]], r: br }); circles.push(circle([best[0], best[1]], br));
      }
      const small = vents.filter(v => v.d < ventD - 0.01);
      if (small.length) notes.push(`The opening is narrow, so ${small.length === vents.length ? 'the vents are' : 'some vents are'} ${Math.min(...small.map(v => v.d)).toFixed(1)} mm (asked ${ventD} mm).`);
      if (vents.length < nV) notes.push(`Room for ${vents.length} of ${nV} vents in the opening.`);
    }
    // ---- the solid
    const out = [], tt = [], z0 = zc - pt, z1 = zc + fh;
    const quad = (A, B, C, D) => out.push(...A, ...B, ...C, ...A, ...C, ...D);
    const wall = (L, za, zb2, outward) => { for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], A = [a[0], a[1], za], B = [b[0], b[1], za], Cc = [b[0], b[1], zb2], D = [a[0], a[1], zb2]; if (outward) quad(A, B, Cc, D); else quad(B, A, D, Cc); } };
    const ccw = L => polyArea(L) > 0 ? L : L.slice().reverse();
    triangulatePolys(loopsToPolys([outer, ...circles]), 2, z0, -1, out, tt, 0);
    wall(outer, z0, z1, true);
    triangulatePolys([{ outer, holes: [inner] }], 2, z1, +1, out, tt, 0);
    wall(inner, zc, z1, false);
    triangulatePolys(loopsToPolys([inner, ...coreLoops, ...circles]), 2, zc, +1, out, tt, 0);
    for (const L of circles) wall(ccw(L), z0, zc, false);
    for (const v of coreP) out.push(v);
    return { p: Float64Array.from(out), sprue, vents, plateT: pt, fenceH: fh, fenceW: fw, fit, z: zc, core: coreLoops.length > 0, coreVol, coreDropped: dropped, notes, size: [0, 1].map(a => Math.max(...outer.map(q => q[a])) - Math.min(...outer.map(q => q[a]))) };
  }

  // Remove zero-thickness fins: a triangle and its exact reverse (same three vertices, opposite winding).
  // Cap triangulation next to the split axis can leave these; together they enclose nothing, so dropping
  // the pair keeps the piece closed and makes it manifold.
  function dropFins(m) {
    const n = m.p.length / 9, sig = new Map(), kill = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const b = i * 9, K = [k3(m.p[b], m.p[b + 1], m.p[b + 2]), k3(m.p[b + 3], m.p[b + 4], m.p[b + 5]), k3(m.p[b + 6], m.p[b + 7], m.p[b + 8])];
      if (K[0] === K[1] || K[1] === K[2] || K[0] === K[2]) { kill[i] = 1; continue; }
      let j = 0; for (let e = 1; e < 3; e++) if (K[e] < K[j]) j = e;
      const a = K[j], b1 = K[(j + 1) % 3], c1 = K[(j + 2) % 3], fwd = a + '|' + b1 + '|' + c1, rev = a + '|' + c1 + '|' + b1;
      const st = sig.get(rev);
      if (st && st.length) { kill[st.pop()] = 1; kill[i] = 1; }
      else { const l = sig.get(fwd); if (l) l.push(i); else sig.set(fwd, [i]); }
    }
    let cnt = 0; for (let i = 0; i < n; i++) if (!kill[i]) cnt++;
    if (cnt === n) return m;
    const p = new Float64Array(cnt * 9), t = new Int8Array(cnt);
    for (let i = 0, o = 0; i < n; i++) if (!kill[i]) { for (let k = 0; k < 9; k++) p[o * 9 + k] = m.p[i * 9 + k]; t[o] = m.t[i]; o++; }
    return { p, t };
  }

  // Printable plate of dowel pins.
  // Pins in rows across the bed. When they do not all fit on one bed (bedY given), they go in blocks of
  // pinLayout().perPlate, one bed's worth each, side by side; the pins stay in order so a block is a slice.
  function pinLayout(spec, bedX, bedY) {
    if (spec.snap) { // snap pins print lying down, flat side on the bed, so the prongs flex in the plane of the bed
      const r = spec.r - 0.05, len = spec.L - 0.4, px = len + 3, py = 2 * (r + spec.b) + 3;
      const cols = Math.max(1, Math.floor((bedX - len - 4) / px) + 1), rows = bedY ? Math.max(1, Math.floor((bedY - py - 1) / py) + 1) : Infinity;
      return { r, pitch: py, px, py, cols, rows, perPlate: cols * rows };
    }
    const r = spec.r - 0.05, pitch = 2 * r + 4;
    const cols = Math.max(1, Math.floor((bedX - 2 * r - 4) / pitch) + 1);
    const rows = bedY ? Math.max(1, Math.floor((bedY - 2 * r - 4) / pitch) + 1) : Infinity;
    return { r, pitch, cols, rows, perPlate: cols * rows };
  }
  // One split snap pin lying along +X from the origin, flat on z = 0: the outline (seen from above) has a slot and a
  // barb at each end; the thickness is the round pin cut flat top and bottom (so it prints without support).
  function snapPinMesh(spec) {
    const r = spec.r - 0.05, len = spec.L - 0.4, b = spec.b, g = spec.g, sl = spec.prong, sw = spec.slot, flat = 0.7 * r;
    const cell = Math.min(0.1, r / 30), nx = Math.ceil(len / Math.min(0.25, r / 12)) + 1, rmax = r + b, ny = 2 * Math.ceil(rmax / cell) + 1, cx = len / (nx - 1);
    const half = x => { const e = Math.min(x, len - x); // pin half-width along its length
      if (e < g) return r - 0.35 + (b + 0.35) * e / g; // lead-in ramp up to the barb, then a sharp shoulder back to r
      return r; };
    const y0 = -(ny - 1) / 2 * cell;
    const inside = (x, y) => { const e = Math.min(x, len - x); if (Math.abs(y) > half(x)) return false; return !(e < sl && Math.abs(y) < sw / 2); };
    const zt = (x, y) => { const w = half(x); return Math.max(0.3 * r, Math.min(flat, Math.sqrt(Math.max(0, w * w - y * y)))); };
    const cellIn = (i, j) => inside((i + 0.5) * cx, y0 + (j + 0.5) * cell);
    const F = new Array(nx * ny), Bk = new Array(nx * ny), out = [];
    const node = (i, j) => { const k = j * nx + i; if (!F[k]) { const x = i * cx, y = y0 + j * cell, z = zt(x, y); F[k] = [x, y, flat + z]; Bk[k] = [x, y, flat - z]; } return k; };
    const put = (a, bb, c2) => out.push(a[0], a[1], a[2], bb[0], bb[1], bb[2], c2[0], c2[1], c2[2]);
    const quad = (a, bb, c2, d) => { put(a, bb, c2); put(a, c2, d); };
    const inC = (i, j) => i >= 0 && j >= 0 && i < nx - 1 && j < ny - 1 && cellIn(i, j);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      if (!cellIn(i, j)) continue;
      const a = node(i, j), bq = node(i + 1, j), c2 = node(i + 1, j + 1), d = node(i, j + 1);
      quad(F[a], F[bq], F[c2], F[d]); quad(Bk[a], Bk[d], Bk[c2], Bk[bq]);
      if (!inC(i, j - 1)) quad(Bk[a], Bk[bq], F[bq], F[a]);
      if (!inC(i, j + 1)) quad(Bk[c2], Bk[d], F[d], F[c2]);
      if (!inC(i - 1, j)) quad(Bk[d], Bk[a], F[a], F[d]);
      if (!inC(i + 1, j)) quad(Bk[bq], Bk[c2], F[c2], F[bq]);
    }
    const m = Float64Array.from(out); return signedVolume(m) < 0 ? flip(m) : m;
  }
  function pinPlate(spec, count, bedX, bedY) {
    if (spec.snap) {
      const Lo = pinLayout(spec, bedX, bedY), one = snapPinMesh(spec), out = new Float64Array(one.length * count), rr = Lo.r + spec.b;
      for (let i = 0; i < count; i++) {
        const blk = Math.floor(i / Lo.perPlate), j = i - blk * Lo.perPlate;
        const ox = blk * (Lo.cols * Lo.px + 10) + (j % Lo.cols) * Lo.px + 2, oy = Math.floor(j / Lo.cols) * Lo.py + rr + 2;
        for (let k = 0; k < one.length; k += 3) { out[i * one.length + k] = one[k] + ox; out[i * one.length + k + 1] = one[k + 1] + oy; out[i * one.length + k + 2] = one[k + 2]; }
      }
      return out;
    }
    const { r, pitch, cols, perPlate } = pinLayout(spec, bedX, bedY);
    const L = spec.L - 0.4, ch = Math.min(0.5, r * 0.25);
    const out = [];
    for (let i = 0; i < count; i++) {
      const blk = Math.floor(i / perPlate), j = i - blk * perPlate;
      const cx = blk * (cols * pitch + 10) + (j % cols) * pitch + r + 2, cy = Math.floor(j / cols) * pitch + r + 2;
      const F = frame(2, 0, cx, cy, +1);
      const m = revolve(F, [[0, r - ch], [ch, r], [L - ch, r], [L, r - ch]], false, 24, true);
      for (const x of m.tris) out.push(x);
    }
    return Float64Array.from(out);
  }

  const _dbg = { capRegion, sectionsBetween, cBool, cOff, cOpen, polysArea, sectionSegs, joinLoops, polyArea, pip, loopsToPolys };
  // Shared pastel print palette: the default filament colors across the generators (users can still pick any color).
  // ink is the readable dark for text and inlays on a pastel base.
  const PASTELS = Object.freeze({ pink: '#F4B6C2', mint: '#A8E6CF', babyBlue: '#A7C7E7', lavender: '#C8B6E2', butter: '#F8E7A1', peach: '#F9C6A8', sage: '#B5C9A8', cream: '#F6EFDC', ink: '#2B2D31' });
  const api = { PASTELS, _dbg, rayNearest: (bvh, o, d) => rayQuery(bvh, o, d, true, 1e-6), sectionPolys, sectionArea, smartPlanes, surfaceArea, bestOrientation, applyRotation, pinLayout, addLabels, addVents, cavTag, textLoops, pieceId, numberParts, cleanPrefix, FONT, loopsToPolys, triangulatePolys, earcutRef: () => earcut, clean, parseSTL, writeSTL, bbox, signedVolume, flip, checkClosed, cutPlane, cutGrid, nudgePlane, cavitySurface, cavityForCell, buildBVH, inside, addConnectors, connectPair, labelOnCap, pinPlate, snapPinMesh, connectorSpec, weld, basisFor, toLocal, toWorld, components, cutFree, splitFree, freeStep, smartSplit, splitSmart, sliceGraph, limbRuns, partsFor, mergeOverlapping, islandsOf, splitCellIslands, gridPairs, cavityInIsland, snapClose, dropSlivers, fixTJunctions, brickPlanes, radialPlanes, splitRadial, wedgeExtents, fitCheck, hollowSolid, drainPlugs, moldBox, moldShell, basePlate, rayAll, rimSpec, hollowRims, sdfCavity, nearestPoint, rimFit, lipJoints, lipSpecs, cavityCells, capPolys, RIM_TAG, BAND_TAG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.SplitCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
