/* Expressarte 42 mm grid bin + baseplate generator: a set of storage bins on the open 42 mm grid (7 mm height units),
   with fixed compartments, a finger scoop, a label tab and a stacking lip, plus matching baseplates sized by units or
   to fill a drawer, split into tiles that fit the printer bed, with spacer strips for the leftover space.
   Generic names only (never a brand or system name). American spelling. */
(function (G) {
  'use strict';
  const C = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const BF = G.GPBinFeatures || (typeof require === 'function' ? require('./bin-features.js') : null);
  const PITCH = 42, HU = 7;
  const FREE = { maxUnits: 4, maxHeight: 10, maxBins: 8, maxPlateCells: 36 };
  const MAX = { units: 8, height: 20, bins: 60, plateUnits: 30 };
  const PALETTE = [
    { name: 'Charcoal', hex: '#2B2D31' }, { name: 'White', hex: '#F2F2EE' }, { name: 'Light gray', hex: '#B9BCC0' }, { name: 'Forest green', hex: '#2F6B4F' },
    { name: 'Mint', hex: '#8FD3B6' }, { name: 'Ocean blue', hex: '#2E5FA8' }, { name: 'Sky blue', hex: '#8EC5EA' }, { name: 'Signal red', hex: '#C8352E' },
    { name: 'Orange', hex: '#E8812F' }, { name: 'Sunflower', hex: '#F2C230' }, { name: 'Lavender', hex: '#A894D6' }, { name: 'Black', hex: '#141414' }
  ];
  const PRESETS = {
    starter: { label: 'Starter set', bins: [{ nx: 1, ny: 1, hu: 6, qty: 4 }, { nx: 2, ny: 1, hu: 6, qty: 2, divX: 1 }, { nx: 2, ny: 2, hu: 6, qty: 1, divX: 1, divY: 1 }] },
    screws: { label: 'Screws and small parts', bins: [{ nx: 1, ny: 1, hu: 3, qty: 6, divX: 1 }, { nx: 2, ny: 1, hu: 3, qty: 3, divX: 3 }] },
    tools: { label: 'Hand tools', bins: [{ nx: 1, ny: 4, hu: 6, qty: 2 }, { nx: 2, ny: 3, hu: 6, qty: 1 }] },
    desk: { label: 'Desk drawer', bins: [{ nx: 1, ny: 3, hu: 5, qty: 2 }, { nx: 2, ny: 2, hu: 5, qty: 1, divY: 1 }, { nx: 1, ny: 1, hu: 5, qty: 2 }] },
    single: { label: 'One bin', bins: [{ nx: 2, ny: 2, hu: 6, qty: 1 }] }
  };
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = { preset: 'starter', wall: 1.2, floor: 1.2, scoop: true, label: 'none', labelText: '', stack: true, plate: 'units', plateNx: 4, plateNy: 3, drawerW: 400, drawerD: 300, padding: true, binColor: PZ.sage, plateColor: PZ.mint, detail: 'hd' };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const int = (v, d, a, b) => { const n = Math.round(+v); return clamp(Number.isFinite(n) ? n : d, a, b); };
  function normBin(b) {
    b = b || {};
    const nx = int(b.nx, 1, 1, MAX.units), ny = int(b.ny, 1, 1, MAX.units);
    return { nx, ny, hu: int(b.hu, 6, 2, MAX.height), qty: int(b.qty, 1, 1, MAX.bins), divX: int(b.divX, 0, 0, Math.min(7, nx * 3 - 1)), divY: int(b.divY, 0, 0, Math.min(7, ny * 3 - 1)) };
  }
  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    if (!Array.isArray(o.bins) || !o.bins.length) o.bins = (PRESETS[o.preset] || PRESETS.starter).bins;
    o.bins = o.bins.slice(0, 24).map(normBin);
    o.wall = clamp(+o.wall || 1.2, 0.8, 3); o.floor = clamp(+o.floor || 1.2, 0.8, 4);
    o.scoop = !!o.scoop; o.stack = !!o.stack; o.label = ['front', 'back', 'none'].includes(o.label) ? o.label : 'none';
    o.labelText = String(o.labelText || '').slice(0, 16);
    o.plate = ['units', 'drawer', 'none'].includes(o.plate) ? o.plate : 'units';
    o.plateNx = int(o.plateNx, 4, 1, MAX.plateUnits); o.plateNy = int(o.plateNy, 3, 1, MAX.plateUnits);
    o.drawerW = clamp(+o.drawerW || 400, 42, 2000); o.drawerD = clamp(+o.drawerD || 300, 42, 2000);
    o.padding = o.padding !== false;
    o.bed = Array.isArray(o.bed) ? o.bed.map(Number) : [256, 256, 256];
    o.binColor = /^#[0-9a-f]{6}$/i.test(o.binColor) ? o.binColor.toUpperCase() : DEFAULTS.binColor;
    o.plateColor = /^#[0-9a-f]{6}$/i.test(o.plateColor) ? o.plateColor.toUpperCase() : DEFAULTS.plateColor;
    return o;
  }
  function usable(o) { return { w: Math.max(50, o.bed[0] - 8), d: Math.max(50, o.bed[1] - 8), z: Math.max(30, o.bed[2] - 4) }; }
  function plateUnits(o) {
    if (o.plate === 'drawer') {
      const nx = clamp(Math.floor((o.drawerW + 0.01) / PITCH), 1, MAX.plateUnits), ny = clamp(Math.floor((o.drawerD + 0.01) / PITCH), 1, MAX.plateUnits);
      return { nx, ny, padX: Math.max(0, o.drawerW - nx * PITCH), padY: Math.max(0, o.drawerD - ny * PITCH) };
    }
    if (o.plate === 'units') return { nx: o.plateNx, ny: o.plateNy, padX: 0, padY: 0 };
    return null;
  }
  // split n units into the fewest near-equal runs of at most m units
  function runs(n, m) { m = Math.max(1, m); const k = Math.ceil(n / m), out = []; let left = n; for (let i = 0; i < k; i++) { const r = Math.ceil(left / (k - i)); out.push(r); left -= r; } return out; }
  function sizeOf(p) { const b = C.bbox(p); return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]; }
  function fitsBed(sz, U) { return (sz[0] <= U.w + 0.01 && sz[1] <= U.d + 0.01) || (sz[1] <= U.w + 0.01 && sz[0] <= U.d + 0.01); }
  function move(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }
  // Manifold helpers (fixed compartment walls are unioned into the bin)
  function man(M, p) { const { V, F } = C.weld(p), mm = new M.Mesh({ numProp: 3, vertProperties: Float32Array.from(V), triVerts: Uint32Array.from(F) }); mm.merge(); return new M.Manifold(mm); }
  function soup(m) { const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float64Array(F.length * 3); for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; } return p; }
  function binName(b) { return `Bin ${b.nx}x${b.ny}x${b.hu}u` + (b.divX || b.divY ? ` (${(b.divX + 1) * (b.divY + 1)} compartments)` : ''); }
  const CACHE = new Map();
  function buildOneBin(b, o, M) {
    const key = JSON.stringify([b.nx, b.ny, b.hu, b.divX, b.divY, o.wall, o.floor, o.scoop, o.stack, o.label, o.labelText, !!M]);
    if (CACHE.has(key)) return CACHE.get(key);
    const res = buildOneBinRaw(b, o, M); if (CACHE.size > 60) CACHE.clear(); CACHE.set(key, res); return res;
  }
  // The bin engine returns overlapping closed shells (foot, body, lip, tab); fuse them into one solid body.
  function shells(M, p) {
    const { V, F } = C.weld(p), nv = V.length / 3, par = new Int32Array(nv); for (let i = 0; i < nv; i++) par[i] = i;
    const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (let i = 0; i < F.length; i += 3) { const a = find(F[i]); par[find(F[i + 1])] = a; par[find(F[i + 2])] = a; }
    const groups = new Map();
    for (let i = 0; i < F.length; i += 3) { const r = find(F[i]); let g = groups.get(r); if (!g) groups.set(r, g = []); g.push(F[i], F[i + 1], F[i + 2]); }
    const out = [];
    for (const g of groups.values()) {
      const q = new Float64Array(g.length * 3); g.forEach((vi, k) => { q[k * 3] = V[vi * 3]; q[k * 3 + 1] = V[vi * 3 + 1]; q[k * 3 + 2] = V[vi * 3 + 2]; });
      const m = man(M, q); if (m.status() === 'NoError' && !m.isEmpty()) out.push(m); else m.delete();
    }
    return out;
  }
  function buildOneBinRaw(b, o, M) {
    const w = b.nx * PITCH, d = b.ny * PITCH, h = b.hu * HU;
    const style = { gridBase: true, gridNx: b.nx, gridNy: b.ny, gridHeightUnits: true, scoop: o.scoop && b.ny >= 1, stack: o.stack, labelTab: 'none' };
    const r = BF.buildBin(w, d, h, o.wall, o.floor, 3.75, style, {});
    let mesh = r.mesh;
    const walls = [];
    if (M) {
      const t = 1.2, z0 = r.floor - 0.2, top = r.height - (o.stack ? 4.6 : 0.6) - (o.label !== 'none' ? 0 : 0);
      const x0 = o.wall - 0.3, x1 = r.w - o.wall + 0.3, y0 = o.wall - 0.3, y1 = r.d - o.wall + 0.3;
      for (let i = 1; i <= b.divX; i++) { const x = o.wall + (r.w - 2 * o.wall) * i / (b.divX + 1); walls.push(T.box(x - t / 2, y0, z0, x + t / 2, y1, top)); }
      for (let j = 1; j <= b.divY; j++) { const y = o.wall + (r.d - 2 * o.wall) * j / (b.divY + 1); walls.push(T.box(x0, y - t / 2, z0, x1, y + t / 2, top)); }
      const all = [...shells(M, mesh), ...walls.map(p => man(M, p))];
      // label tab: a 12 mm shelf along the front or back wall with a 45 degree underside, printable without supports
      if (o.label !== 'none') {
        const D = Math.min(12, (r.d - 2 * o.wall) * 0.4), zt = top, xa = o.wall - 0.3, xb = r.w - o.wall + 0.3;
        const yw = o.label === 'front' ? o.wall - 0.3 : r.d - o.wall + 0.3, s1 = o.label === 'front' ? 1 : -1, ye = yw + s1 * (D + 0.3);
        const prof = [[yw, zt], [ye, zt], [ye, zt - 1.2], [yw, zt - 1.2 - D]], pts = [];
        for (const x of [xa, xb]) for (const [y, z] of prof) pts.push([x, y, Math.max(z, z0 + 1)]);
        all.push(M.Manifold.hull(pts));
      }
      const u = M.Manifold.union(all); mesh = soup(u); u.delete(); all.forEach(x => x.delete());
    }
    return { mesh, w: r.w, d: r.d, h: r.height, floor: r.floor };
  }
  function build(raw, M) {
    const o = options(raw), U = usable(o), warnings = [], parts = [], placed = [];
    // bins: one mesh per distinct bin, printed qty times
    const binParts = [];
    o.bins.forEach((b, i) => {
      const r = buildOneBin(b, o, M), sz = sizeOf(r.mesh);
      if (sz[2] > U.z) warnings.push(`${binName(b)} is ${Math.round(sz[2])} mm tall, taller than your printer.`);
      const pt = { kind: 'bin', name: binName(b), local: r.mesh, count: b.qty, color: o.binColor, size: sz, fits: fitsBed(sz, U) && sz[2] <= U.z, bin: b, idx: i };
      if (!pt.fits && sz[2] <= U.z) warnings.push(`${binName(b)} (${Math.round(sz[0])} x ${Math.round(sz[1])} mm) is bigger than your bed. Use smaller bins.`);
      parts.push(pt); binParts.push(pt);
    });
    // baseplate tiles
    const pu = plateUnits(o); let tiles = [], spacers = [];
    if (pu) {
      const mu = Math.max(1, Math.floor((U.w + 0.01) / PITCH)), mv = Math.max(1, Math.floor((U.d + 0.01) / PITCH));
      const rx = runs(pu.nx, mu), ry = runs(pu.ny, mv), cache = new Map();
      let y = 0;
      for (const ty of ry) { let x = 0; for (const tx of rx) { const key = tx + 'x' + ty; if (!cache.has(key)) cache.set(key, BF.buildGridBaseplate(tx, ty, 1.2)); tiles.push({ key, tx, ty, x, y }); x += tx * PITCH; } y += ty * PITCH; }
      for (const [key, bp] of cache) {
        const n = tiles.filter(t => t.key === key).length, sz = sizeOf(bp.mesh);
        parts.push({ kind: 'baseplate', name: `Baseplate ${key} units`, local: bp.mesh, count: n, color: o.plateColor, size: sz, fits: fitsBed(sz, U), key, h: bp.h });
      }
      // spacer strips for the leftover drawer space (drawer mode)
      if (o.plate === 'drawer' && o.padding) {
        const H = (cache.values().next().value || {}).h || 5.85, W = pu.nx * PITCH, D = pu.ny * PITCH, sx = pu.padX / 2, sy = pu.padY / 2;
        const strip = (len, wid, name, place) => {
          if (wid < 2) return;
          const n = Math.ceil(len / Math.max(40, Math.max(U.w, U.d) - 2)), L = len / n;
          const p = T.box(0, 0, 0, L, wid, H);
          parts.push({ kind: 'spacer', name: `${name} ${Math.round(L)} x ${wid.toFixed(1)} mm`, local: p, count: n * 2, color: o.plateColor, size: [L, wid, H], fits: true });
          for (let k = 0; k < n; k++) place.forEach(f => spacers.push(f(k * L, L, wid, H)));
        };
        if (sx >= 2) strip(o.drawerD, sx, 'Side spacer', [(s, L, w, h) => ({ p: T.box(-w, s - sy, 0, 0, s - sy + L, h) }), (s, L, w, h) => ({ p: T.box(W, s - sy, 0, W + w, s - sy + L, h) })]);
        if (sy >= 2) strip(W, sy, 'End spacer', [(s, L, w, h) => ({ p: T.box(s, -w, 0, s + L, 0, h) }), (s, L, w, h) => ({ p: T.box(s, D, 0, s + L, D + w, h) })]);
        if (pu.padX > 0 && pu.padX < 4) warnings.push(`${pu.padX.toFixed(1)} mm of side space is left over; too thin for spacers.`);
      }
      if (pu.nx * pu.ny > 900) warnings.push('That is a very large baseplate. It may take a while to build.');
    }
    // assembled preview: tiles where they go, bins packed on the grid on top
    const plateH = parts.find(p => p.kind === 'baseplate') ? parts.find(p => p.kind === 'baseplate').h : 0;
    for (const t of tiles) { const bp = parts.find(p => p.kind === 'baseplate' && p.key === t.key); placed.push({ p: move(bp.local, t.x, t.y, 0), color: o.plateColor, name: bp.name }); }
    for (const s of spacers) placed.push({ p: s.p, color: o.plateColor, name: 'Spacer' });
    const gx = pu ? pu.nx : Math.max(4, ...o.bins.map(b => b.nx)), gy = pu ? pu.ny : 1e3, occ = new Set();
    const free = (ix, iy, b) => { if (ix + b.nx > gx || iy + b.ny > gy) return false; for (let a = 0; a < b.nx; a++) for (let c = 0; c < b.ny; c++) if (occ.has((ix + a) + ',' + (iy + c))) return false; return true; };
    let over = 0, offGrid = 0;
    const order = []; binParts.forEach(pt => { for (let k = 0; k < pt.count; k++) order.push(pt); });
    order.sort((a, b) => b.bin.nx * b.bin.ny - a.bin.nx * a.bin.ny);
    for (const pt of order) {
      const b = pt.bin; let spot = null;
      for (let iy = 0; iy < Math.min(gy, 200) && !spot; iy++) for (let ix = 0; ix < gx && !spot; ix++) if (free(ix, iy, b)) spot = [ix, iy];
      if (spot) { for (let a = 0; a < b.nx; a++) for (let c = 0; c < b.ny; c++) occ.add((spot[0] + a) + ',' + (spot[1] + c)); placed.push({ p: move(pt.local, spot[0] * PITCH + 0.25, spot[1] * PITCH + 0.25, pu ? plateH - 4.65 : 0), color: o.binColor, name: pt.name }); }
      else { over++; placed.push({ p: move(pt.local, (gx + 0.4) * PITCH + offGrid, 0, 0), color: o.binColor, name: pt.name }); offGrid += b.nx * PITCH + 6; }
    }
    if (pu && over) warnings.push(`${over} ${over === 1 ? 'bin does' : 'bins do'} not fit on the baseplate; shown beside it.`);
    let vol = 0; for (const pt of parts) vol += Math.abs(C.signedVolume(pt.local)) * pt.count;
    const binCount = o.bins.reduce((s, b) => s + b.qty, 0);
    const stats = {
      bins: binCount, binTypes: o.bins.length, cells: o.bins.reduce((s, b) => s + b.qty * b.nx * b.ny, 0), compartments: o.bins.reduce((s, b) => s + b.qty * (b.divX + 1) * (b.divY + 1), 0),
      plate: pu ? `${pu.nx} x ${pu.ny}` : null, plateNx: pu ? pu.nx : 0, plateNy: pu ? pu.ny : 0, tiles: tiles.length, spacers: spacers.length,
      padX: pu ? +pu.padX.toFixed(1) : 0, padY: pu ? +pu.padY.toFixed(1) : 0, grams: Math.round(vol / 1000 * 1.24), tris: parts.reduce((s, p) => s + p.local.length / 9, 0)
    };
    return { options: o, parts, placed, stats, warnings };
  }
  function gateInfo(raw) {
    const o = options(raw), reasons = [];
    if (o.bins.some(b => b.nx > FREE.maxUnits || b.ny > FREE.maxUnits)) reasons.push(`bins bigger than ${FREE.maxUnits} x ${FREE.maxUnits} units`);
    if (o.bins.some(b => b.hu > FREE.maxHeight)) reasons.push(`bins taller than ${FREE.maxHeight} units`);
    const n = o.bins.reduce((s, b) => s + b.qty, 0); if (n > FREE.maxBins) reasons.push(`${n} bins in one download (free: ${FREE.maxBins})`);
    const pu = plateUnits(o); if (pu && pu.nx * pu.ny > FREE.maxPlateCells) reasons.push(`a ${pu.nx} x ${pu.ny} baseplate (free: up to ${FREE.maxPlateCells} cells)`);
    return { pro: reasons.length > 0, reasons, bins: n };
  }
  function printList(res) { const out = []; for (const pt of res.parts) for (let i = 0; i < pt.count; i++) out.push({ name: pt.count > 1 ? `${pt.name} ${i + 1}` : pt.name, p: pt.local, color: pt.color }); return out; }
  function arrangePlates(res) { const U = usable(res.options); return PL.arrange(printList(res), U.w, U.d, { gap: 4, maxZ: U.z }); }
  function export3MF(res, o) {
    o = o || {}; const cols = []; res.parts.forEach(pt => { if (!cols.includes(pt.color)) cols.push(pt.color); });
    const A = arrangePlates(res), objs = [], plates = [];
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, p: it.p, color: it.color, extruder: cols.indexOf(it.color) + 1 }); }); plates.push(ids); });
    A.unfit.forEach(u => { plates.push([objs.length]); objs.push({ name: u.name, p: PL.normalize(u.p), color: u.color, extruder: cols.indexOf(u.color) + 1 }); });
    return T.threeMF(objs, { title: o.name || '42 mm grid bins', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const o = res.options, st = res.stats, L = ['Expressarte 42 mm grid bins and baseplates', ''];
    L.push(`${st.bins} bins (${st.compartments} compartments).` + (st.plate ? ` Baseplate ${st.plate} units in ${st.tiles} tile${st.tiles === 1 ? '' : 's'}.` : ''));
    L.push('', 'Print these');
    for (const pt of res.parts) L.push(`  ${pt.name} x${pt.count}  ${pt.color}  ${Math.round(pt.size[0])} x ${Math.round(pt.size[1])} x ${Math.round(pt.size[2])} mm`);
    L.push('', 'Printing', '  - Bins print upright as exported, no supports. 0.2 mm layers, 2-3 walls, 10-15% infill.', '  - Baseplates print flat. Tiles sit side by side in the drawer; spacer strips fill the leftover space at the edges.',
      '  - Every bin is 42 x n - 0.5 mm with a 7 mm height unit, so it fits any standard 42 mm grid baseplate.');
    if (st.plate && (st.padX || st.padY)) L.push(`  - Drawer leftover: ${st.padX} mm side to side, ${st.padY} mm front to back, split evenly on both sides.`);
    if (res.warnings.length) { L.push('', 'Notes'); res.warnings.forEach(w => L.push('  - ' + w)); }
    return L.join('\n');
  }
  function files(res, o) {
    o = o || {}; const base = o.fileBase || 'grid_bins', out = [], slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    for (const pt of res.parts) out.push({ name: `${base}_${slug(pt.name)}_x${pt.count}.stl`, data: new Uint8Array(C.writeSTL(pt.local, pt.name)) });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }
  const api = { PITCH, HU, FREE, MAX, PALETTE, PRESETS, DEFAULTS, options, normBin, plateUnits, runs, usable, build, gateInfo, printList, arrangePlates, export3MF, notes, files, binName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPGridBin = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
