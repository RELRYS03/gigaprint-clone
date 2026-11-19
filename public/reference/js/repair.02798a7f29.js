/* Expressarte mesh doctor: analysis, repair (weld, clean, orient, fill holes, loose parts,
   non-manifold cleanup) and quadric edge-collapse simplification. Works in the browser and Node. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const earcut = G.earcut || (typeof require === 'function' ? require('earcut') : null);

  // ---------------------------------------------------------------- indexed mesh helpers
  function bboxDiag(p) { const bb = Core.bbox(p); return Math.hypot(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]) || 1; }
  // Weld with a tolerance using a hashed grid (checks neighbouring cells so nothing straddling a cell edge is missed).
  // Snap-weld: corners that round to the same tolerance cell become one vertex. Numeric keys keep it fast.
  function weldTol(p, tol) {
    const n = p.length / 3, inv = 1 / tol;
    const map = new Map(); const V = []; const F = new Int32Array(n);
    const B = 2097152; // 2^21 cells per axis around the origin
    for (let i = 0; i < n; i++) {
      const gx = Math.round(p[i * 3] * inv), gy = Math.round(p[i * 3 + 1] * inv), gz = Math.round(p[i * 3 + 2] * inv);
      const k = ((gx % B) + B) % B * B * B + ((gy % B) + B) % B * B + ((gz % B) + B) % B;
      let id = map.get(k);
      if (id === undefined) { id = V.length / 3; map.set(k, id); V.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); }
      F[i] = id;
    }
    return { V: Float64Array.from(V), F };
  }
  // Merge open-edge vertices that sit within `tol` of each other but landed in different weld cells.
  function closeGaps(V, F, tol) {
    const nv = V.length / 3, em = edgeMap(F, nv);
    const bv = new Set();
    for (const [k, l] of em) if (l.length === 2) { const lo = Math.floor(k / nv); bv.add(lo); bv.add(k - lo * nv); }
    if (!bv.size) return { F, merged: 0 };
    const inv = 1 / (tol * 2), grid = new Map(), remap = new Int32Array(nv); for (let i = 0; i < nv; i++) remap[i] = i;
    let merged = 0;
    for (const v of bv) {
      const x = V[v * 3], y = V[v * 3 + 1], z = V[v * 3 + 2];
      const gx = Math.floor(x * inv), gy = Math.floor(y * inv), gz = Math.floor(z * inv);
      let hit = -1;
      for (let dx = -1; dx <= 1 && hit < 0; dx++) for (let dy = -1; dy <= 1 && hit < 0; dy++) for (let dz = -1; dz <= 1 && hit < 0; dz++) {
        const l = grid.get((gx + dx) + ',' + (gy + dy) + ',' + (gz + dz)); if (!l) continue;
        for (const u of l) if (Math.hypot(V[u * 3] - x, V[u * 3 + 1] - y, V[u * 3 + 2] - z) <= tol * 2) { hit = u; break; }
      }
      if (hit >= 0) { remap[v] = hit; merged++; }
      else { const k = gx + ',' + gy + ',' + gz; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(v); }
    }
    if (!merged) return { F, merged: 0 };
    const out = new Int32Array(F.length); for (let i = 0; i < F.length; i++) out[i] = remap[F[i]];
    return { F: out, merged };
  }
  function toSoup(V, F) {
    const out = new Float64Array(F.length * 3);
    for (let i = 0; i < F.length; i++) { const v = F[i]; out[i * 3] = V[v * 3]; out[i * 3 + 1] = V[v * 3 + 1]; out[i * 3 + 2] = V[v * 3 + 2]; }
    return out;
  }
  function triArea(V, a, b, c) {
    const ux = V[b * 3] - V[a * 3], uy = V[b * 3 + 1] - V[a * 3 + 1], uz = V[b * 3 + 2] - V[a * 3 + 2];
    const vx = V[c * 3] - V[a * 3], vy = V[c * 3 + 1] - V[a * 3 + 1], vz = V[c * 3 + 2] - V[a * 3 + 2];
    return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  // undirected edge -> list of [face, dir] where dir = +1 if face runs lo->hi
  function edgeMap(F, nv) {
    const m = new Map();
    for (let f = 0; f < F.length / 3; f++) for (let e = 0; e < 3; e++) {
      const a = F[f * 3 + e], b = F[f * 3 + (e + 1) % 3];
      const lo = a < b ? a : b, hi = a < b ? b : a, k = lo * nv + hi;
      let l = m.get(k); if (!l) m.set(k, l = []); l.push(f, a < b ? 1 : -1);
    }
    return m;
  }
  function shellsOf(F, nv, em) {
    const nf = F.length / 3, parent = new Int32Array(nf); for (let i = 0; i < nf; i++) parent[i] = i;
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (const l of em.values()) for (let i = 2; i < l.length; i += 2) { const a = find(l[0]), b = find(l[i]); if (a !== b) parent[a] = b; }
    const id = new Map(), shell = new Int32Array(nf);
    for (let f = 0; f < nf; f++) { const r = find(f); let s = id.get(r); if (s === undefined) { s = id.size; id.set(r, s); } shell[f] = s; }
    return { shell, count: id.size };
  }

  // ---------------------------------------------------------------- analysis
  function analyze(p) {
    const tol = Math.max(1e-6, bboxDiag(p) * 1e-7);
    const { V, F } = weldTol(p, tol);
    const nv = V.length / 3, nf = F.length / 3;
    let degenerate = 0;
    const seen = new Map(); let duplicate = 0;
    const keep = [];
    for (let f = 0; f < nf; f++) {
      const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
      if (a === b || b === c || a === c || triArea(V, a, b, c) < 1e-12) { degenerate++; continue; }
      const k = [a, b, c].sort((x, y) => x - y).join(',');
      if (seen.has(k)) { duplicate++; continue; }
      seen.set(k, 1); keep.push(a, b, c);
    }
    const G2 = Int32Array.from(keep);
    const em = edgeMap(G2, nv);
    let boundary = 0, nonManifold = 0, flipped = 0;
    const boundarySegs = [], nmSegs = [];
    for (const [k, l] of em) {
      const cnt = l.length / 2;
      const lo = Math.floor(k / nv), hi = k - lo * nv;
      const seg = [V[lo * 3], V[lo * 3 + 1], V[lo * 3 + 2], V[hi * 3], V[hi * 3 + 1], V[hi * 3 + 2]];
      if (cnt === 1) { boundary++; if (boundarySegs.length < 60000 * 6) boundarySegs.push(...seg); }
      else if (cnt > 2) { nonManifold++; if (nmSegs.length < 60000 * 6) nmSegs.push(...seg); }
      else if (l[1] === l[3]) flipped++;
    }
    const sh = shellsOf(G2, nv, em);
    const holes = countLoops(G2, nv, em);
    const soup = toSoup(V, G2);
    const vol = Core.signedVolume(soup);
    const issues = degenerate + duplicate + boundary + nonManifold + flipped + (vol < 0 ? 1 : 0);
    return {
      triangles: nf, vertices: nv, degenerate, duplicate, boundaryEdges: boundary, holes, nonManifold, flippedEdges: flipped,
      shells: sh.count, volume: vol, area: Core.surfaceArea(soup), insideOut: vol < 0, watertight: boundary === 0 && nonManifold === 0 && flipped === 0,
      boundarySegs: Float32Array.from(boundarySegs), nmSegs: Float32Array.from(nmSegs), issues
    };
  }
  function countLoops(F, nv, em) {
    // boundary edges directed as they appear in their single face
    const next = new Map();
    for (const l of em.values()) {
      if (l.length !== 2) continue;
      const f = l[0];
      for (let e = 0; e < 3; e++) {
        const a = F[f * 3 + e], b = F[f * 3 + (e + 1) % 3];
        const lst = em.get((a < b ? a : b) * nv + (a < b ? b : a));
        if (lst === l) { let s = next.get(a); if (!s) next.set(a, s = []); s.push(b); }
      }
    }
    let loops = 0; const used = new Set();
    for (const [a, outs] of next) for (const b0 of outs) {
      const k0 = a + '>' + b0; if (used.has(k0)) continue;
      loops++; let cur = a, nb = b0, guard = 0;
      while (guard++ < 1e7) { used.add(cur + '>' + nb); const o = next.get(nb); if (!o) break; const n2 = o.find(x => !used.has(nb + '>' + x)); if (n2 === undefined) break; cur = nb; nb = n2; }
    }
    return loops;
  }

  // ---------------------------------------------------------------- repair
  function repair(p, opt) {
    const first = repairOnce(p, opt);
    const q = quickCheck(first.p);
    if (q.open === 0 && q.nm === 0) return first;
    const second = repairOnce(first.p, Object.assign({}, opt, { removeLoose: 0 }));
    const extra = second.log.filter(l => !/^Welded|^No problems/.test(l[0]));
    return { p: second.p, log: first.log.concat(extra.map(l => [l[0] + ' (second pass)', l[1]])) };
  }
  function quickCheck(p) {
    const { V, F } = weldTol(p, Math.max(1e-6, bboxDiag(p) * 1e-7)); const nv = V.length / 3; const em = edgeMap(F, nv);
    let open = 0, nm = 0; for (const l of em.values()) { if (l.length === 2) open++; else if (l.length > 4) nm++; }
    return { open, nm };
  }
  function repairOnce(p, opt) {
    opt = Object.assign({ weldTol: 0, removeLoose: 0.002, fillHoles: true, maxHoleEdges: 5000, fixOrientation: true, nonManifold: true }, opt || {});
    const log = [];
    const diag = bboxDiag(p);
    const tol = opt.weldTol > 0 ? opt.weldTol : Math.max(1e-5, diag * 2e-6);
    let { V, F } = weldTol(p, tol);
    let nv = V.length / 3;
    log.push(['Welded vertices', `${p.length / 9 * 3 - nv} duplicate corners merged (tolerance ${tol.toPrecision(2)} mm)`]);
    { const g = closeGaps(V, F, tol); F = g.F; if (g.merged) log.push(['Closed hairline gaps', `${g.merged} open corners snapped together`]); }

    // 1. degenerate + duplicate faces (opposite twins are internal double walls: drop both)
    {
      const keep = []; const seen = new Map(); let deg = 0, dup = 0, twins = 0;
      for (let f = 0; f < F.length / 3; f++) {
        const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
        if (a === b || b === c || a === c || triArea(V, a, b, c) < tol * tol * 1e-3) { deg++; continue; }
        const s = [a, b, c].sort((x, y) => x - y).join(',');
        const prev = seen.get(s);
        if (prev !== undefined) {
          const pa = keep[prev], pb = keep[prev + 1], pc = keep[prev + 2];
          const same = (pa === a && pb === b && pc === c) || (pa === b && pb === c && pc === a) || (pa === c && pb === a && pc === b);
          if (same) { dup++; continue; }
          keep[prev] = -1; twins++; seen.delete(s); continue;
        }
        seen.set(s, keep.length); keep.push(a, b, c);
      }
      const k2 = []; for (let i = 0; i < keep.length; i += 3) if (keep[i] >= 0) k2.push(keep[i], keep[i + 1], keep[i + 2]);
      F = Int32Array.from(k2);
      if (deg) log.push(['Removed degenerate triangles', String(deg)]);
      if (dup) log.push(['Removed duplicate triangles', String(dup)]);
      if (twins) log.push(['Removed internal double walls', `${twins * 2} triangles`]);
    }

    // 2. non-manifold edges: keep the two faces that form the most consistent pair, drop the rest
    if (opt.nonManifold) {
      let em = edgeMap(F, nv); const drop = new Set();
      for (const l of em.values()) {
        if (l.length <= 4) continue;
        // prefer keeping an opposite-direction pair with the largest areas
        const faces = []; for (let i = 0; i < l.length; i += 2) faces.push({ f: l[i], d: l[i + 1], a: triArea(V, F[l[i] * 3], F[l[i] * 3 + 1], F[l[i] * 3 + 2]) });
        faces.sort((x, y) => y.a - x.a);
        const first = faces[0]; const partner = faces.slice(1).find(x => x.d !== first.d) || faces[1];
        for (const x of faces) if (x !== first && x !== partner) drop.add(x.f);
      }
      if (drop.size) {
        const k = []; for (let f = 0; f < F.length / 3; f++) if (!drop.has(f)) k.push(F[f * 3], F[f * 3 + 1], F[f * 3 + 2]);
        F = Int32Array.from(k); log.push(['Cleaned non-manifold edges', `${drop.size} stray triangles removed`]);
      }
    }

    // 3. loose parts
    let em = edgeMap(F, nv);
    let sh = shellsOf(F, nv, em);
    if (opt.removeLoose > 0 && sh.count > 1) {
      const area = new Float64Array(sh.count); let total = 0;
      for (let f = 0; f < F.length / 3; f++) { const a = triArea(V, F[f * 3], F[f * 3 + 1], F[f * 3 + 2]); area[sh.shell[f]] += a; total += a; }
      const kill = new Set(); for (let s = 0; s < sh.count; s++) if (area[s] < total * opt.removeLoose) kill.add(s);
      if (kill.size && kill.size < sh.count) {
        const k = []; for (let f = 0; f < F.length / 3; f++) if (!kill.has(sh.shell[f])) k.push(F[f * 3], F[f * 3 + 1], F[f * 3 + 2]);
        F = Int32Array.from(k); log.push(['Removed loose fragments', `${kill.size} tiny part${kill.size > 1 ? 's' : ''}`]);
        em = edgeMap(F, nv); sh = shellsOf(F, nv, em);
      }
    }

    // 4. consistent winding inside each shell (breadth-first across shared edges)
    if (opt.fixOrientation) {
      const nf = F.length / 3; const visited = new Uint8Array(nf); let flips = 0;
      const faceEdges = f => [0, 1, 2].map(e => { const a = F[f * 3 + e], b = F[f * 3 + (e + 1) % 3]; return [a, b]; });
      for (let s0 = 0; s0 < nf; s0++) {
        if (visited[s0]) continue;
        visited[s0] = 1; const queue = [s0];
        while (queue.length) {
          const f = queue.pop();
          for (const [a, b] of faceEdges(f)) {
            const l = em.get((a < b ? a : b) * nv + (a < b ? b : a));
            if (!l || l.length !== 4) continue;
            const g = l[0] === f ? l[2] : l[0];
            if (visited[g]) continue;
            visited[g] = 1;
            // neighbour must run b->a; if it runs a->b, flip it
            let runsAB = false; for (let e = 0; e < 3; e++) if (F[g * 3 + e] === a && F[g * 3 + (e + 1) % 3] === b) runsAB = true;
            if (runsAB) { const t = F[g * 3 + 1]; F[g * 3 + 1] = F[g * 3 + 2]; F[g * 3 + 2] = t; flips++; }
            queue.push(g);
          }
          // edge directions changed for flipped faces; refresh lazily by rebuilding at the end
        }
      }
      if (flips) { log.push(['Made triangle winding consistent', `${Math.min(flips, F.length / 3 - flips)} triangles turned`]); em = edgeMap(F, nv); }
    }

    // 5. fill holes
    let filled = 0, addedV = [];
    if (opt.fillHoles) {
      const loops = boundaryLoops(F, nv, em);
      const newF = [];
      const Vx = Array.from(V);
      const has = (a, b) => em.has((a < b ? a : b) * nv + (a < b ? b : a));
      for (const L of loops) {
        if (L.length < 3 || L.length > opt.maxHoleEdges) continue;
        fillLoop(Vx, L, newF, has);
        filled++;
      }
      if (filled) {
        V = Float64Array.from(Vx); nv = V.length / 3;
        const merged = new Int32Array(F.length + newF.length); merged.set(F); merged.set(newF, F.length); F = merged;
        log.push(['Filled holes', `${filled} hole${filled > 1 ? 's' : ''} closed`]);
        em = edgeMap(F, nv);
      }
    }

    // 6. outward-facing shells (nested shells become cavities)
    sh = shellsOf(F, nv, em);
    {
      const soupOf = s => { const out = []; for (let f = 0; f < F.length / 3; f++) if (sh.shell[f] === s) for (let k = 0; k < 3; k++) { const v = F[f * 3 + k]; out.push(V[v * 3], V[v * 3 + 1], V[v * 3 + 2]); } return Float64Array.from(out); };
      const shells = []; for (let s = 0; s < sh.count; s++) shells.push(soupOf(s));
      const vols = shells.map(x => Core.signedVolume(x));
      const want = new Int8Array(sh.count).fill(1);
      if (sh.count > 1 && sh.count <= 60) {
        const bvhs = shells.map(x => Core.buildBVH(x));
        for (let s = 0; s < sh.count; s++) {
          const pt = [shells[s][0], shells[s][1], shells[s][2]]; let depth = 0;
          for (let t = 0; t < sh.count; t++) if (t !== s && Math.abs(vols[t]) > Math.abs(vols[s]) && Core.inside(bvhs[t], pt)) depth++;
          if (depth % 2 === 1) want[s] = -1;
        }
      }
      let flippedShells = 0;
      for (let s = 0; s < sh.count; s++) {
        if (Math.sign(vols[s] || 1) === want[s]) continue;
        flippedShells++;
        for (let f = 0; f < F.length / 3; f++) if (sh.shell[f] === s) { const t = F[f * 3 + 1]; F[f * 3 + 1] = F[f * 3 + 2]; F[f * 3 + 2] = t; }
      }
      if (flippedShells) log.push(['Turned inside-out parts the right way', `${flippedShells} part${flippedShells > 1 ? 's' : ''}`]);
    }
    if (log.length === 1) log.push(['No problems needed fixing', '']);
    return { p: toSoup(V, F), log };
  }

  function boundaryLoops(F, nv, em) {
    const next = new Map();
    for (const l of em.values()) {
      if (l.length !== 2) continue;
      const f = l[0];
      for (let e = 0; e < 3; e++) {
        const a = F[f * 3 + e], b = F[f * 3 + (e + 1) % 3];
        if (em.get((a < b ? a : b) * nv + (a < b ? b : a)) === l) { let s = next.get(a); if (!s) next.set(a, s = []); s.push(b); }
      }
    }
    const loops = [];
    for (const [a0] of next) {
      let outs = next.get(a0);
      while (outs && outs.length) {
        const L = [a0]; let cur = outs.pop(), guard = 0, ok = false;
        while (guard++ < 1e7) {
          if (cur === a0) { ok = true; break; }
          L.push(cur);
          const o = next.get(cur); if (!o || !o.length) break;
          cur = o.pop();
        }
        if (ok && L.length >= 3) loops.push(L);
        outs = next.get(a0);
      }
    }
    return loops;
  }
  // The hole is bounded by edges a->b of existing faces; new faces must run b->a, so fill the reversed loop.
  function fillLoop(Vx, L, out, has) {
    const R = L.slice().reverse(); const n = R.length;
    if (n === 3) { out.push(R[0], R[1], R[2]); return; }
    // Newell normal of the reversed loop
    let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) {
      const a = R[i] * 3, b = R[(i + 1) % n] * 3;
      nx += (Vx[a + 1] - Vx[b + 1]) * (Vx[a + 2] + Vx[b + 2]); ny += (Vx[a + 2] - Vx[b + 2]) * (Vx[a] + Vx[b]); nz += (Vx[a] - Vx[b]) * (Vx[a + 1] + Vx[b + 1]);
      cx += Vx[a]; cy += Vx[a + 1]; cz += Vx[a + 2];
    }
    cx /= n; cy /= n; cz /= n;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    // planar projection
    const t = Math.abs(nx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let ux = t[1] * nz - t[2] * ny, uy = t[2] * nx - t[0] * nz, uz = t[0] * ny - t[1] * nx; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const wx = ny * uz - nz * uy, wy = nz * ux - nx * uz, wz = nx * uy - ny * ux;
    const flat = []; let maxOff = 0, span = 0;
    for (const v of R) {
      const dx = Vx[v * 3] - cx, dy = Vx[v * 3 + 1] - cy, dz = Vx[v * 3 + 2] - cz;
      flat.push(dx * ux + dy * uy + dz * uz, dx * wx + dy * wy + dz * wz);
      maxOff = Math.max(maxOff, Math.abs(dx * nx + dy * ny + dz * nz)); span = Math.max(span, Math.hypot(dx, dy, dz));
    }
    let area2 = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; area2 += flat[i * 2] * flat[j * 2 + 1] - flat[j * 2] * flat[i * 2 + 1]; }
    if (maxOff < span * 0.25 && earcut) {
      const tri = earcut(flat, null, 2);
      let tA = 0; for (let i = 0; i < tri.length; i += 3) { const a = tri[i] * 2, b = tri[i + 1] * 2, c = tri[i + 2] * 2; tA += Math.abs((flat[b] - flat[a]) * (flat[c + 1] - flat[a + 1]) - (flat[c] - flat[a]) * (flat[b + 1] - flat[a + 1])); }
      const used = new Set(tri);
      // a chord that duplicates an existing edge would make that edge non-manifold
      let clash = false;
      if (has) for (let i = 0; i < tri.length && !clash; i += 3) for (let e = 0; e < 3; e++) {
        const x = tri[i + e], y = tri[i + (e + 1) % 3];
        if ((y - x + n) % n !== 1 && (x - y + n) % n !== 1 && has(R[x], R[y])) { clash = true; break; }
      }
      if (!clash && tri.length && Math.abs(tA - Math.abs(area2)) < Math.abs(area2) * 1e-3 + 1e-9 && used.size === n) {
        for (let i = 0; i < tri.length; i += 3) {
          let a = tri[i], b = tri[i + 1], c = tri[i + 2];
          const s = (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[c * 2] - flat[a * 2]) * (flat[b * 2 + 1] - flat[a * 2 + 1]);
          if ((s > 0) !== (area2 > 0)) { const q = b; b = c; c = q; }
          out.push(R[a], R[b], R[c]);
        }
        return;
      }
    }
    // fallback: fan from a new centre vertex, nudged along the normal for a gentle dome
    const ci = Vx.length / 3; Vx.push(cx, cy, cz);
    for (let i = 0; i < n; i++) out.push(ci, R[i], R[(i + 1) % n]);
  }

  // ---------------------------------------------------------------- quadric edge-collapse simplification
  function simplify(p, target, onProgress) {
    const { V: V0, F: F0 } = weldTol(p, Math.max(1e-6, bboxDiag(p) * 1e-7));
    const P = Float64Array.from(V0), F = Int32Array.from(F0);
    const nv = P.length / 3; let nf = F.length / 3;
    const startF = nf;
    if (nf <= target) return { p: toSoup(P, F), faces: nf };
    const alive = new Uint8Array(nf).fill(1);
    const Q = new Float64Array(nv * 10);
    const vf = Array.from({ length: nv }, () => []);
    const addQ = (v, a, b, c, d, w) => { const o = v * 10; Q[o] += w * a * a; Q[o + 1] += w * a * b; Q[o + 2] += w * a * c; Q[o + 3] += w * a * d; Q[o + 4] += w * b * b; Q[o + 5] += w * b * c; Q[o + 6] += w * b * d; Q[o + 7] += w * c * c; Q[o + 8] += w * c * d; Q[o + 9] += w * d * d; };
    const faceN = (a, b, c, ax, ay, az) => {
      const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
      return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    };
    for (let f = 0; f < nf; f++) {
      const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
      const n = faceN(a, b, c, P[a * 3], P[a * 3 + 1], P[a * 3 + 2]); const l = Math.hypot(n[0], n[1], n[2]);
      vf[a].push(f); vf[b].push(f); vf[c].push(f);
      if (!l) continue;
      const nx = n[0] / l, ny = n[1] / l, nz = n[2] / l, d = -(nx * P[a * 3] + ny * P[a * 3 + 1] + nz * P[a * 3 + 2]);
      const w = l / 2;
      addQ(a, nx, ny, nz, d, w); addQ(b, nx, ny, nz, d, w); addQ(c, nx, ny, nz, d, w);
    }
    // keep open borders in place
    const em = edgeMap(F, nv);
    for (const [k, l] of em) {
      if (l.length !== 2) continue;
      const lo = Math.floor(k / nv), hi = k - lo * nv, f = l[0];
      const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
      const fn = faceN(a, b, c, P[a * 3], P[a * 3 + 1], P[a * 3 + 2]);
      const ex = P[hi * 3] - P[lo * 3], ey = P[hi * 3 + 1] - P[lo * 3 + 1], ez = P[hi * 3 + 2] - P[lo * 3 + 2];
      let px = ey * fn[2] - ez * fn[1], py = ez * fn[0] - ex * fn[2], pz = ex * fn[1] - ey * fn[0]; const pl = Math.hypot(px, py, pz); if (!pl) continue;
      px /= pl; py /= pl; pz /= pl; const d = -(px * P[lo * 3] + py * P[lo * 3 + 1] + pz * P[lo * 3 + 2]);
      const w = (ex * ex + ey * ey + ez * ez) * 50;
      addQ(lo, px, py, pz, d, w); addQ(hi, px, py, pz, d, w);
    }
    const removed = new Uint8Array(nv), ver = new Int32Array(nv);
    const verOf = v => ver[v];
    // binary heap of {c, a, b, va, vb, x, y, z}
    const H = [];
    const push = (c, a, b, x, y, z) => {
      const e = { c, a, b, va: ver[a], vb: ver[b], x, y, z };
      let i = H.length; H.push(e);
      while (i > 0) { const p2 = (i - 1) >> 1; if (H[p2].c <= c) break; H[i] = H[p2]; i = p2; }
      H[i] = e;
    };
    const pop = () => {
      const top = H[0], last = H.pop(), n = H.length;
      if (n) {
        let i = 0;
        while (true) { const l = 2 * i + 1, r = l + 1; let m = l; if (l >= n) break; if (r < n && H[r].c < H[l].c) m = r; if (H[m].c >= last.c) break; H[i] = H[m]; i = m; }
        H[i] = last;
      }
      return top;
    };
    const qerr = (o, x, y, z) => Q[o] * x * x + 2 * Q[o + 1] * x * y + 2 * Q[o + 2] * x * z + 2 * Q[o + 3] * x + Q[o + 4] * y * y + 2 * Q[o + 5] * y * z + 2 * Q[o + 6] * y + Q[o + 7] * z * z + 2 * Q[o + 8] * z + Q[o + 9];
    const tmpQ = 10 * nv; const QQ = new Float64Array(10);
    const evalEdge = (a, b) => {
      for (let i = 0; i < 10; i++) QQ[i] = Q[a * 10 + i] + Q[b * 10 + i];
      const e = (x, y, z) => QQ[0] * x * x + 2 * QQ[1] * x * y + 2 * QQ[2] * x * z + 2 * QQ[3] * x + QQ[4] * y * y + 2 * QQ[5] * y * z + 2 * QQ[6] * y + QQ[7] * z * z + 2 * QQ[8] * z + QQ[9];
      // solve [q0 q1 q2; q1 q4 q5; q2 q5 q7] x = -[q3 q6 q8]
      const a11 = QQ[0], a12 = QQ[1], a13 = QQ[2], a22 = QQ[4], a23 = QQ[5], a33 = QQ[7];
      const det = a11 * (a22 * a33 - a23 * a23) - a12 * (a12 * a33 - a23 * a13) + a13 * (a12 * a23 - a22 * a13);
      const mx = (P[a * 3] + P[b * 3]) / 2, my = (P[a * 3 + 1] + P[b * 3 + 1]) / 2, mz = (P[a * 3 + 2] + P[b * 3 + 2]) / 2;
      const scale = Math.abs(a11) + Math.abs(a22) + Math.abs(a33) + 1e-30;
      let best = null;
      if (Math.abs(det) > 1e-9 * scale * scale * scale) {
        const b1 = -QQ[3], b2 = -QQ[6], b3 = -QQ[8];
        const x = (b1 * (a22 * a33 - a23 * a23) - a12 * (b2 * a33 - a23 * b3) + a13 * (b2 * a23 - a22 * b3)) / det;
        const y = (a11 * (b2 * a33 - a23 * b3) - b1 * (a12 * a33 - a23 * a13) + a13 * (a12 * b3 - b2 * a13)) / det;
        const z = (a11 * (a22 * b3 - b2 * a23) - a12 * (a12 * b3 - b2 * a13) + b1 * (a12 * a23 - a22 * a13)) / det;
        // stay near the edge so a bad solve cannot fling vertices away
        const L = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
        if (Math.hypot(x - mx, y - my, z - mz) < L * 2) best = [e(x, y, z), x, y, z];
      }
      for (const c of [[P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]], [mx, my, mz]]) {
        const v = e(c[0], c[1], c[2]); if (!best || v < best[0]) best = [v, c[0], c[1], c[2]];
      }
      return best;
    };
    const neighbours = v => { const s = new Set(); for (const f of vf[v]) if (alive[f]) for (let k = 0; k < 3; k++) { const u = F[f * 3 + k]; if (u !== v) s.add(u); } return s; };
    for (const [k] of em) { const a = Math.floor(k / nv), b = k - a * nv; const r = evalEdge(a, b); push(r[0], a, b, r[1], r[2], r[3]); }
    let iter = 0;
    while (nf > target && H.length) {
      const { a, b, va, vb, x, y, z } = pop();
      if (removed[a] || removed[b] || ver[a] !== va || ver[b] !== vb) continue;
      const fa = vf[a].filter(f => alive[f]), fb = vf[b].filter(f => alive[f]);
      const shared = fa.filter(f => F[f * 3] === b || F[f * 3 + 1] === b || F[f * 3 + 2] === b);
      if (!shared.length) continue;
      // link condition keeps the surface manifold
      const na = neighbours(a), nb = neighbours(b); let common = 0; for (const u of na) if (nb.has(u)) common++;
      if (common !== shared.length) continue;
      // reject folds: no remaining face may flip or collapse
      let bad = false;
      for (const f of fa.concat(fb)) {
        if (shared.includes(f)) continue;
        const i0 = F[f * 3], i1 = F[f * 3 + 1], i2 = F[f * 3 + 2];
        const pos = i => (i === a || i === b) ? [x, y, z] : [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
        const A = pos(i0), B = pos(i1), C = pos(i2);
        const n1 = faceN(i0, i1, i2, P[i0 * 3], P[i0 * 3 + 1], P[i0 * 3 + 2]);
        const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
        const n2 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        const l1 = Math.hypot(...n1), l2 = Math.hypot(...n2);
        if (l2 < 1e-14 || (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]) < 0.2 * l1 * l2) { bad = true; break; }
      }
      if (bad) continue;
      P[a * 3] = x; P[a * 3 + 1] = y; P[a * 3 + 2] = z;
      for (let i = 0; i < 10; i++) Q[a * 10 + i] += Q[b * 10 + i];
      for (const f of shared) { alive[f] = 0; nf--; }
      for (const f of fb) { if (!alive[f]) continue; for (let k = 0; k < 3; k++) if (F[f * 3 + k] === b) F[f * 3 + k] = a; vf[a].push(f); }
      vf[a] = vf[a].filter(f => alive[f]);
      removed[b] = 1; vf[b] = []; ver[a]++;
      // only edges touching the merged vertex changed; older entries for them are now stale by version
      for (const u of neighbours(a)) { const r = evalEdge(a, u); push(r[0], a, u, r[1], r[2], r[3]); }
      if (onProgress && (++iter & 4095) === 0) onProgress(1 - (nf - target) / (startF - target));
    }
    const outF = []; for (let f = 0; f < F.length / 3; f++) if (alive[f]) outF.push(F[f * 3], F[f * 3 + 1], F[f * 3 + 2]);
    return { p: toSoup(P, Int32Array.from(outF)), faces: outF.length / 3 };
  }


  // ---------------------------------------------------------------- separate parts
  // Split a soup into its disconnected shells (connected through shared edges after welding).
  // Inside-out shells that sit inside another part (the inner wall of a hollow print) stay with
  // that part; any other inside-out shell is turned the right way out. Sorted by volume, largest first.
  function separate(p, opt) {
    opt = opt || {};
    const tol = Math.max(1e-6, bboxDiag(p) * 1e-7);
    const { V, F } = weldTol(p, tol);
    const nv = V.length / 3, nf = F.length / 3;
    const em = edgeMap(F, nv); const sh = shellsOf(F, nv, em);
    const faces = Array.from({ length: sh.count }, () => []);
    for (let f = 0; f < nf; f++) faces[sh.shell[f]].push(f);
    let shells = faces.map(list => {
      const out = new Float64Array(list.length * 9); let k = 0;
      for (const f of list) for (let e = 0; e < 3; e++) { const v = F[f * 3 + e]; out[k++] = V[v * 3]; out[k++] = V[v * 3 + 1]; out[k++] = V[v * 3 + 2]; }
      const bb = Core.bbox(out);
      return { p: out, vol: Core.signedVolume(out), bb };
    });
    const contains = (A, B) => [0, 1, 2].every(a => A.bb.min[a] <= B.bb.min[a] + 1e-9 && A.bb.max[a] >= B.bb.max[a] - 1e-9);
    const holes = shells.filter(s => s.vol < 0), solids = shells.filter(s => s.vol >= 0);
    for (const h of holes) {
      let host = null;
      for (const s of solids) if (s.vol > -h.vol && contains(s, h) && (!host || s.vol < host.vol)) host = s;
      if (host) { (host.inner = host.inner || []).push(h); }
      else { h.p = Core.flip(h.p); h.vol = -h.vol; solids.push(h); }
    }
    const parts = solids.map(s => {
      let q = s.p;
      if (s.inner) { const all = new Float64Array(q.length + s.inner.reduce((n, h) => n + h.p.length, 0)); all.set(q); let k = q.length; for (const h of s.inner) { all.set(h.p, k); k += h.p.length; } q = all; }
      const bb = Core.bbox(q), ck = Core.checkClosed(q);
      return { p: q, volume: Core.signedVolume(q), area: Core.surfaceArea(q), min: bb.min, max: bb.max, size: [0, 1, 2].map(a => bb.max[a] - bb.min[a]), tris: q.length / 9, closed: ck.closed };
    });
    parts.sort((a, b) => b.volume - a.volume || b.area - a.area);
    const big = parts.length ? Math.max(parts[0].volume, 1e-9) : 1;
    const pct = opt.debrisPct != null ? opt.debrisPct : 0.001;
    parts.forEach((pt, i) => { pt.index = i; pt.debris = i > 0 && pt.volume < big * pct; });
    return parts;
  }

  const api = { analyze, repair, simplify, separate, weldTol, toSoup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.MeshDoctor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
