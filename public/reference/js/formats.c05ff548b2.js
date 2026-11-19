/* Expressarte file formats (browser, Web Worker and Node):
   - parseOBJ(text): vertices and faces, any index form (v, v/vt, v//vn, v/vt/vn, negative), n-gons
     triangulated with earcut on the face's own plane, o/g groups kept as separate objects,
     winding checked against the vertex normals when the file has them.
   - parse3MF(buf): the 3MF core spec, a zip of XML. Objects, nested components with transforms,
     build items with transforms, units, and Bambu/Prusa/Orca projects whose meshes live in
     extra .model files (production extension p:path). No DOMParser, so it also runs in a Worker.
   - unzip(buf): stored and deflated zip entries (DecompressionStream, or zlib under Node).
   - toSoup(objects): all objects joined into one triangle soup.
   Results: { objects: [{ name, p }] } where p is a Float64Array triangle soup in millimetres. */
(function (G) {
  'use strict';
  const earcut = G.earcut || (typeof require === 'function' ? require('earcut') : null);

  // ---------------------------------------------------------------- OBJ
  function parseOBJ(text) {
    const V = [], N = [];
    const groups = new Map(); let cur = null, curName = '', usedO = false;
    const group = name => { let g = groups.get(name); if (!g) { g = []; groups.set(name, g); } return g; };
    const lines = String(text).replace(/\\\r?\n/g, ' ').split(/\r?\n/);
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li].trim();
      if (!line || line[0] === '#') continue;
      const sp = line.indexOf(' '); if (sp < 0) continue;
      const kw = line.slice(0, sp), rest = line.slice(sp + 1).trim();
      if (kw === 'v') { const q = rest.split(/\s+/); V.push(+q[0], +q[1], +q[2]); }
      else if (kw === 'vn') { const q = rest.split(/\s+/); N.push(+q[0], +q[1], +q[2]); }
      else if (kw === 'o') { usedO = true; curName = rest || 'object'; cur = null; }
      else if (kw === 'g' && !usedO) { curName = rest || curName; cur = null; }
      else if (kw === 'f') {
        const nvv = V.length / 3, nn = N.length / 3;
        const toks = rest.split(/\s+/); const vi = [], ni = [];
        for (const t of toks) {
          const parts = t.split('/');
          let i = parseInt(parts[0], 10); if (!Number.isFinite(i)) continue;
          i = i < 0 ? nvv + i : i - 1; if (i < 0 || i >= nvv) continue;
          vi.push(i);
          let n = parts.length > 2 ? parseInt(parts[2], 10) : NaN;
          if (Number.isFinite(n)) { n = n < 0 ? nn + n : n - 1; ni.push(n >= 0 && n < nn ? n : -1); } else ni.push(-1);
        }
        if (vi.length < 3) continue;
        if (!cur) cur = group(curName);
        polyToTris(V, N, vi, ni, cur);
      }
    }
    const objects = [];
    for (const [name, arr] of groups) if (arr.length) objects.push({ name: name || 'model', p: Float64Array.from(arr) });
    return { objects };
  }
  // Triangulate one face. Triangles: kept. Quads: split on the diagonal that keeps both halves facing the same way.
  // Bigger n-gons: projected onto their Newell plane and cut with earcut (handles concave faces); fan as a last resort.
  function polyToTris(V, N, vi, ni, out) {
    const n = vi.length, P = i => [V[vi[i] * 3], V[vi[i] * 3 + 1], V[vi[i] * 3 + 2]];
    // Newell normal of the polygon
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < n; i++) { const a = P(i), b = P((i + 1) % n); nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
    // flip when every vertex has a normal and they point the other way
    let flip = false;
    if (ni.every(k => k >= 0) && N.length) { let s = 0; for (const k of ni) s += N[k * 3] * nx + N[k * 3 + 1] * ny + N[k * 3 + 2] * nz; flip = s < 0; }
    const tris = [];
    if (n === 3) tris.push(0, 1, 2);
    else if (n === 4) {
      const d = (a, b, c) => { const A = P(a), B = P(b), C = P(c); const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]; return (u[1] * v[2] - u[2] * v[1]) * nx + (u[2] * v[0] - u[0] * v[2]) * ny + (u[0] * v[1] - u[1] * v[0]) * nz; };
      if (d(0, 1, 2) > 0 && d(0, 2, 3) > 0) tris.push(0, 1, 2, 0, 2, 3); else tris.push(0, 1, 3, 1, 2, 3);
    } else {
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      const [iu, iw] = az >= ax && az >= ay ? [0, 1] : ax >= ay ? [1, 2] : [2, 0];
      const flat = []; for (let i = 0; i < n; i++) { const q = P(i); flat.push(q[iu], q[iw]); }
      const t = earcut ? earcut(flat) : [];
      if (t.length === (n - 2) * 3) {
        // earcut ignores orientation: put each triangle back on the polygon's winding
        for (let k = 0; k < t.length; k += 3) {
          const a = P(t[k]), b = P(t[k + 1]), c = P(t[k + 2]);
          const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
          if (cx * nx + cy * ny + cz * nz < 0) tris.push(t[k], t[k + 2], t[k + 1]); else tris.push(t[k], t[k + 1], t[k + 2]);
        }
      } else for (let k = 1; k + 1 < n; k++) tris.push(0, k, k + 1);
    }
    for (let k = 0; k < tris.length; k += 3) {
      const a = P(tris[k]), b = P(tris[k + (flip ? 2 : 1)]), c = P(tris[k + (flip ? 1 : 2)]);
      out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    }
  }

  // ---------------------------------------------------------------- zip reading
  async function inflateRaw(u8) {
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    if (typeof require === 'function') return new Uint8Array(require('node:zlib').inflateRawSync(u8));
    throw new Error('this browser cannot unpack compressed files');
  }
  // Uses the central directory (sizes are there even when local headers use data descriptors).
  function zipEntries(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip file (a 3MF is a zip archive)');
    const count = dv.getUint16(eocd + 10, true); let off = dv.getUint32(eocd + 16, true);
    const files = {}; const td = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(off, true) !== 0x02014b50) throw new Error('damaged zip directory');
      const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nlen = dv.getUint16(off + 28, true), xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true), lho = dv.getUint32(off + 42, true);
      const name = td.decode(u8.subarray(off + 46, off + 46 + nlen));
      const lnl = dv.getUint16(lho + 26, true), lxl = dv.getUint16(lho + 28, true);
      files[name] = { method, data: u8.subarray(lho + 30 + lnl + lxl, lho + 30 + lnl + lxl + csize) };
      off += 46 + nlen + xlen + clen;
    }
    return files;
  }
  async function unzip(buf) {
    const ents = zipEntries(buf), out = {};
    for (const [name, e] of Object.entries(ents)) {
      if (e.method === 0) out[name] = e.data;
      else if (e.method === 8) out[name] = await inflateRaw(e.data);
      else throw new Error(`unsupported compression in ${name}`);
    }
    return out;
  }

  // ---------------------------------------------------------------- 3MF
  const UNITS = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };
  const ent = s => s.indexOf('&') < 0 ? s : s.replace(/&(lt|gt|amp|quot|apos|#x[0-9a-f]+|#\d+);/gi, (m, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()] || (e[1] === 'x' || e[1] === 'X' ? String.fromCodePoint(parseInt(e.slice(2), 16)) : String.fromCodePoint(+e.slice(1)))));
  function attrs(s) {
    const o = {}; const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g; let m;
    while ((m = re.exec(s))) { const k = m[1], v = ent(m[2] !== undefined ? m[2] : m[3]); o[k] = v; const c = k.indexOf(':'); if (c > 0 && o[k.slice(c + 1)] === undefined && k.slice(0, c) !== 'xmlns') o['@' + k.slice(c + 1)] = v; }
    return o;
  }
  const NUM_RE = {}; for (const k of ['x', 'y', 'z', 'v1', 'v2', 'v3']) NUM_RE[k] = new RegExp('(?:^|\\s)' + k + '\\s*=\\s*["\']([^"\']*)');
  const num = (s, key) => { const m = NUM_RE[key].exec(s); return m ? +m[1] : NaN; };
  // One .model document -> { unit, objects: Map(id -> {name, type, V, T, comps}), items }
  function readModel(xml) {
    const doc = { unit: 'millimeter', objects: new Map(), items: [] };
    const re = /<(\/?)([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
    let m, obj = null, inBuild = false;
    while ((m = re.exec(xml))) {
      const close = m[1] === '/', tag = m[3], body = m[4];
      if (close) { if (tag === 'object') obj = null; else if (tag === 'build') inBuild = false; continue; }
      switch (tag) {
        case 'vertex': if (obj) obj.V.push(num(body, 'x'), num(body, 'y'), num(body, 'z')); break;
        case 'triangle': if (obj) obj.T.push(num(body, 'v1'), num(body, 'v2'), num(body, 'v3')); break;
        case 'model': { const a = attrs(body); if (a.unit) doc.unit = a.unit; break; }
        case 'object': { const a = attrs(body); obj = { id: a.id, name: a.name || '', type: a.type || 'model', V: [], T: [], comps: [] }; doc.objects.set(a.id, obj); if (m[5] === '/') obj = null; break; }
        case 'component': if (obj) { const a = attrs(body); obj.comps.push({ objectid: a.objectid, transform: a.transform, path: a['p:path'] || a['@path'] || a.path }); } break;
        case 'build': inBuild = m[5] !== '/'; break;
        case 'item': if (inBuild) { const a = attrs(body); doc.items.push({ objectid: a.objectid, transform: a.transform, path: a['p:path'] || a['@path'], printable: a.printable }); } break;
      }
    }
    return doc;
  }
  const mat = str => { if (!str) return null; const m = str.trim().split(/\s+/).map(Number); return m.length === 12 && m.every(Number.isFinite) ? m : null; };
  // row-vector convention (3MF spec): p' = p * A, then * B
  function mul(A, B) {
    if (!A) return B; if (!B) return A;
    const r = new Array(12);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j] + (i === 3 ? B[9 + j] : 0);
    return r;
  }
  const det = M => M ? M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]) : 1;

  async function parse3MF(buf) {
    const files = await unzip(buf);
    const td = new TextDecoder(); const docs = {};
    for (const name of Object.keys(files)) if (/\.model$/i.test(name)) docs['/' + name.replace(/^\//, '')] = readModel(td.decode(files[name]));
    // the root model: named in _rels/.rels, else the usual path, else the first .model
    let mainName = null;
    const rels = files['_rels/.rels'];
    if (rels) { const m = /Target="([^"]+\.model)"[^>]*Type="[^"]*3dmodel"|Type="[^"]*3dmodel"[^>]*Target="([^"]+\.model)"/i.exec(td.decode(rels)); if (m) mainName = '/' + (m[1] || m[2]).replace(/^\//, ''); }
    if (!mainName || !docs[mainName]) mainName = Object.keys(docs).find(n => /3D\/3dmodel\.model$/i.test(n)) || Object.keys(docs)[0];
    if (!mainName) throw new Error('no 3D model inside this 3MF');
    const root = docs[mainName];
    const scale = UNITS[root.unit] || 1;
    const objects = [];
    const emit = (docName, id, M, out, depth) => {
      const d = docs[docName]; const o = d && d.objects.get(String(id));
      if (!o || depth > 16) return;
      if (o.T.length) {
        const V = o.V, T = o.T, flip = det(M) < 0;
        for (let k = 0; k < T.length; k += 3) {
          const ids = flip ? [T[k], T[k + 2], T[k + 1]] : [T[k], T[k + 1], T[k + 2]];
          if (ids.some(i => !(i >= 0 && i * 3 + 2 < V.length))) continue;
          for (const i of ids) {
            const x = V[i * 3], y = V[i * 3 + 1], z = V[i * 3 + 2];
            if (M) out.push(x * M[0] + y * M[3] + z * M[6] + M[9], x * M[1] + y * M[4] + z * M[7] + M[10], x * M[2] + y * M[5] + z * M[8] + M[11]);
            else out.push(x, y, z);
          }
        }
      }
      for (const c of o.comps) emit(c.path ? '/' + c.path.replace(/^\//, '') : docName, c.objectid, mul(mat(c.transform), M), out, depth + 1);
    };
    const nameOf = (docName, id) => { const o = docs[docName] && docs[docName].objects.get(String(id)); return o && o.name; };
    let items = root.items.filter(it => it.printable !== '0');
    if (!items.length) { // no build section: every top-level model object
      const used = new Set(); for (const o of root.objects.values()) for (const c of o.comps) if (!c.path) used.add(String(c.objectid));
      items = [...root.objects.values()].filter(o => !used.has(String(o.id)) && o.type !== 'support' && o.type !== 'other').map(o => ({ objectid: o.id }));
    }
    items.forEach((it, i) => {
      const docName = it.path ? '/' + it.path.replace(/^\//, '') : mainName;
      const out = []; emit(docName, it.objectid, mat(it.transform), out, 0);
      if (!out.length) return;
      const p = Float64Array.from(out); if (scale !== 1) for (let k = 0; k < p.length; k++) p[k] *= scale;
      objects.push({ name: nameOf(docName, it.objectid) || `object ${i + 1}`, p });
    });
    if (!objects.length) throw new Error('this 3MF has no printable meshes');
    return { objects, unit: root.unit };
  }

  function toSoup(objects) {
    let n = 0; for (const o of objects) n += o.p.length;
    const p = new Float64Array(n); let k = 0; for (const o of objects) { p.set(o.p, k); k += o.p.length; }
    return p;
  }
  const isModelName = name => /\.(stl|obj|3mf)$/i.test(name);

  const api = { parseOBJ, parse3MF, unzip, zipEntries, toSoup, isModelName, UNITS, _readModel: readModel, _mul: mul };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPFormats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
