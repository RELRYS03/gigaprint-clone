/* Expressarte hex storage wall planner: tile a wall with hex cells, skip cutouts,
   split into bed-sized interlocking tiles, plus clip-in accessories.
   Generic name only \u2014 no brand or competitor names. American spelling. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);

  // Flat-to-flat cell sizes (mm). Depth is the pocket depth of each cell.
  const CELL_PRESETS = [
    { id: '42', label: '42 mm (small)', size: 42 },
    { id: '60', label: '60 mm', size: 60 },
    { id: '80', label: '80 mm', size: 80 },
    { id: '100', label: '100 mm (large)', size: 100 }
  ];
  const ACCESSORIES = {
    hook: { label: 'Hook', free: true },
    cup: { label: 'Small bin / cup', free: true },
    shelf: { label: 'Shelf', free: false },
    cable: { label: 'Cable holder', free: false },
    tool: { label: 'Tool holder', free: false },
    label: { label: 'Label tag', free: true }
  };
  const FREE = { maxTiles: 4, maxAccessories: 2 };
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    wallW: 400, wallH: 300, cell: 60, wallT: 2.4, depth: 28, backT: 1.6,
    bed: [256, 256], bambu: 'A1', detail: 'hd',
    cutouts: [], // [{x,y,w,h,label}]
    accessories: [{ type: 'hook', count: 2 }, { type: 'cup', count: 1 }],
    colors: { wall: PZ.babyBlue, accent: PZ.peach }
  };
  const PALETTE = [
    { name: 'Sky', hex: '#8EB6CC' }, { name: 'Black', hex: '#1A1A1A' }, { name: 'White', hex: '#F7F7F2' },
    { name: 'Orange', hex: '#E07A3A' }, { name: 'Teal', hex: '#1D9A8A' }, { name: 'Blue', hex: '#3B82C4' }
  ];

  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    o.wallW = Math.max(80, Math.min(2000, +o.wallW || DEFAULTS.wallW));
    o.wallH = Math.max(80, Math.min(2000, +o.wallH || DEFAULTS.wallH));
    o.cell = Math.max(30, Math.min(160, +o.cell || DEFAULTS.cell));
    o.wallT = Math.max(1.2, Math.min(5, +o.wallT || DEFAULTS.wallT));
    o.depth = Math.max(10, Math.min(80, +o.depth || DEFAULTS.depth));
    o.backT = Math.max(0.8, Math.min(3, +o.backT || DEFAULTS.backT));
    o.cutouts = Array.isArray(o.cutouts) ? o.cutouts.map(c => ({
      x: +c.x || 0, y: +c.y || 0, w: Math.max(10, +c.w || 50), h: Math.max(10, +c.h || 50),
      label: String(c.label || 'Cutout').slice(0, 24)
    })) : [];
    o.accessories = Array.isArray(o.accessories) ? o.accessories.filter(a => ACCESSORIES[a.type]).map(a => ({
      type: a.type, count: Math.max(0, Math.min(40, +a.count || 0))
    })) : [];
    o.colors = Object.assign({}, DEFAULTS.colors, o.colors || {});
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    return o;
  }

  // Flat-top hex geometry. `size` / `cell` is flat-to-flat (mm).
  // Neighbor centers are exactly `cell` apart so adjacent cells share one wall of thickness wallT.
  function hexCorners(cx, cy, flatToFlat) {
    // Flat-top: vertices at 0\u00b0, 60\u00b0, \u2026 so flats are horizontal.
    // flat-to-flat (vertical) = \u221a3 * vr  \u21d2  vr = flatToFlat / \u221a3
    // apothem = flatToFlat / 2; neighbor pitch = flatToFlat.
    const vr = flatToFlat / Math.sqrt(3);
    const L = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3; // flat-top
      L.push([cx + vr * Math.cos(a), cy + vr * Math.sin(a)]);
    }
    return L;
  }
  function axialToPixel(q, r, cell) {
    // Flat-top odd-q: vertical pitch = cell, horizontal = cell * \u221a3/2
    return [cell * Math.sqrt(3) / 2 * q, cell * (r + 0.5 * (q & 1))];
  }
  function hexGrid(wallW, wallH, cell) {
    const pitchX = cell * Math.sqrt(3) / 2, pitchY = cell;
    const cols = Math.ceil(wallW / pitchX) + 1;
    const rows = Math.ceil(wallH / pitchY) + 1;
    const cells = [];
    const ap = cell / 2; // apothem = flat-to-flat / 2
    for (let q = 0; q < cols; q++) for (let r = 0; r < rows; r++) {
      const [cx, cy] = axialToPixel(q, r, cell);
      // Keep cells whose flat extent sits inside the wall (small margin)
      if (cx - ap < -1 || cy - ap < -1 || cx + ap > wallW + 1 || cy + ap > wallH + 1) continue;
      cells.push({ q, r, cx, cy, R: ap, size: cell, id: `${q},${r}` });
    }
    return cells;
  }
  function neighborDist(a, b) {
    return Math.hypot(a.cx - b.cx, a.cy - b.cy);
  }
  function cellInteriorsOverlap(a, b, wallT) {
    // Interiors are open pockets of flat-to-flat (size - wallT). They overlap iff center dist < size - wallT.
    const pocket = (a.size || a.R * 2) - wallT;
    return neighborDist(a, b) + 1e-6 < pocket;
  }
  function rectHitsHex(cut, cell) {
    const ap = cell.R;
    const dx = Math.max(cut.x - cell.cx, 0, cell.cx - (cut.x + cut.w));
    const dy = Math.max(cut.y - cell.cy, 0, cell.cy - (cut.y + cut.h));
    return dx * dx + dy * dy < (ap * 0.95) * (ap * 0.95);
  }

  // One tile: union of cell outers, subtract pocket inners \u2192 shared walls of thickness wallT.
  function tileMesh(group, o, z0, z1) {
    const s = o.cell, wt = o.wallT;
    // Tiny expand so Clipper merges shared flats robustly; inners keep exact shared wall thickness wt.
    const outers = group.map(c => ({ outer: hexCorners(c.cx, c.cy, s + 0.05), holes: [] }));
    let outerU = outers.length === 1 ? outers : T.unionPolys(outers);
    if (!outerU.length) outerU = outers;
    const back = T.extrude(outerU, 2, z0, z0 + o.backT);
    const inners = group.map(c => ({ outer: hexCorners(c.cx, c.cy, Math.max(8, s - wt)), holes: [] }));
    const ring = T.diffPolys(outerU, inners);
    const walls = T.extrude(ring, 2, z0 + o.backT, z1);
    return T.concat([back, walls]);
  }
  function cellMesh(cell, o, z0, z1) {
    return tileMesh([cell], o, z0, z1);
  }

  function tileKey(q, r, nq) { return `${Math.floor(q / nq)},${Math.floor(r / nq)}`; }

  function tileBBox(chunk, cell) {
    const xs = chunk.map(c => c.cx), ys = chunk.map(c => c.cy);
    // Vertex radius for flat-top = cell / \u221a3
    const vr = cell / Math.sqrt(3);
    return {
      minX: Math.min(...xs) - vr, maxX: Math.max(...xs) + vr,
      minY: Math.min(...ys) - vr, maxY: Math.max(...ys) + vr
    };
  }
  function planTiles(cells, o) {
    const [UW, UD] = [Math.max(80, (o.bed[0] || 256) - 16), Math.max(80, (o.bed[1] || 256) - 16)];
    // Seed bins on a grid that fits the bed, then recursively split any overflow.
    const groups = new Map();
    for (const c of cells) {
      const bx = Math.floor(c.cx / UW), by = Math.floor(c.cy / UD);
      const key = bx + ',' + by;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    const out = [];
    const splitFit = (chunk) => {
      if (!chunk.length) return;
      const b = tileBBox(chunk, o.cell);
      const w = b.maxX - b.minX, h = b.maxY - b.minY;
      if (w <= UW + 0.5 && h <= UD + 0.5) { out.push(chunk); return; }
      if (chunk.length === 1) { out.push(chunk); return; } // single hex always kept
      const byX = w >= h;
      const mid = byX ? (b.minX + b.maxX) / 2 : (b.minY + b.maxY) / 2;
      const a = chunk.filter(c => (byX ? c.cx : c.cy) < mid);
      const b2 = chunk.filter(c => (byX ? c.cx : c.cy) >= mid);
      if (!a.length || !b2.length) {
        // fallback: peel one cell
        out.push([chunk[0]]);
        splitFit(chunk.slice(1));
        return;
      }
      splitFit(a); splitFit(b2);
    };
    for (const list of groups.values()) splitFit(list);
    return out;
  }

  // Interlock tabs centered on shared hex edges between this tile and a higher-index neighbor tile.
  function edgeInterlocks(group, allGroups, ti, o, z0, z1) {
    const s = o.cell, pitch = s, tol = 0.6;
    const mine = new Set(group.map(c => c.id));
    const tabs = [];
    for (let tj = ti + 1; tj < allGroups.length; tj++) {
      const other = allGroups[tj];
      for (const a of group) for (const b of other) {
        if (Math.abs(neighborDist(a, b) - pitch) > tol) continue;
        // Midpoint of shared flat; tab extends toward the neighbor along the center line
        const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
        const dx = b.cx - a.cx, dy = b.cy - a.cy;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len; // toward neighbor
        const px = -uy, py = ux; // along the shared edge
        const tw = Math.min(14, s * 0.28), td = 3.2;
        const hx = tw / 2 * px, hy = tw / 2 * py;
        // Male tab protruding from this tile across the shared edge
        tabs.push({
          outer: [
            [mx - hx - ux * 0.3, my - hy - uy * 0.3],
            [mx + hx - ux * 0.3, my + hy - uy * 0.3],
            [mx + hx + ux * td, my + hy + uy * td],
            [mx - hx + ux * td, my - hy + uy * td]
          ],
          holes: []
        });
      }
    }
    if (!tabs.length) return null;
    return T.extrude(tabs, 2, z0 + 0.5, Math.min(z1, z0 + 2.4));
  }

  function accessoryMesh(type, cell, o) {
    const R = cell.R - o.wallT - 0.6;
    const cx = 0, cy = 0; // local
    if (type === 'hook') {
      const base = T.extrude([{ outer: hexCorners(cx, cy, Math.min(R, 14)), holes: [] }], 2, 0, 3);
      const arm = T.extrude([{ outer: [[-3, 0], [3, 0], [3, 22], [-3, 22]], holes: [] }], 2, 3, 6);
      const tip = T.extrude([{ outer: [[-3, 18], [10, 18], [10, 22], [-3, 22]], holes: [] }], 2, 3, 6);
      return T.concat([base, arm, tip]);
    }
    if (type === 'cup') {
      const outer = hexCorners(cx, cy, Math.min(R, cell.R * 0.72));
      const inner = hexCorners(cx, cy, Math.min(R, cell.R * 0.72) - 1.6);
      const floor = T.extrude([{ outer, holes: [] }], 2, 0, 1.4);
      const wall = T.extrude([{ outer, holes: [inner] }], 2, 1.4, Math.min(o.depth - 2, 22));
      return T.concat([floor, wall]);
    }
    if (type === 'shelf') {
      const w = Math.min(R * 1.6, cell.R * 1.2), d = Math.min(o.depth - 2, 18);
      return T.extrude([{ outer: [[-w / 2, -2], [w / 2, -2], [w / 2, d], [-w / 2, d]], holes: [] }], 2, 0, 2.4);
    }
    if (type === 'cable') {
      const base = T.extrude([{ outer: hexCorners(cx, cy, Math.min(R, 12)), holes: [] }], 2, 0, 2.5);
      const clip = T.extrude([{ outer: T.circle(0, 8, 5.5, 20), holes: [T.circle(0, 8, 3.6, 16)] }], 2, 2.5, 8);
      return T.concat([base, clip]);
    }
    if (type === 'tool') {
      const base = T.extrude([{ outer: hexCorners(cx, cy, Math.min(R, 13)), holes: [] }], 2, 0, 2.5);
      const pegs = [];
      for (const [x, y] of [[-6, 6], [6, 6], [0, 12]]) pegs.push(T.extrude([{ outer: T.circle(x, y, 2.2, 12), holes: [] }], 2, 2.5, 16));
      return T.concat([base, ...pegs]);
    }
    // label tag
    const tag = T.extrude([{ outer: [[-16, -6], [16, -6], [16, 6], [-16, 6]], holes: [] }], 2, 0, 1.8);
    const peg = T.extrude([{ outer: hexCorners(0, 0, 6), holes: [] }], 2, 1.8, 4);
    return T.concat([tag, peg]);
  }

  function gateInfo(o) {
    o = options(o);
    const cells = planCells(o);
    const tiles = planTiles(cells, o);
    const accN = o.accessories.reduce((a, x) => a + x.count, 0);
    const why = [];
    if (tiles.length > FREE.maxTiles) why.push(`${tiles.length} wall tiles (free: up to ${FREE.maxTiles})`);
    if (accN > FREE.maxAccessories) why.push(`${accN} accessories (free: up to ${FREE.maxAccessories})`);
    const proAcc = o.accessories.filter(a => !ACCESSORIES[a.type].free && a.count > 0);
    if (proAcc.length) why.push(`${ACCESSORIES[proAcc[0].type].label} accessory (Pro)`);
    return why;
  }

  function planCells(o) {
    const all = hexGrid(o.wallW, o.wallH, o.cell);
    return all.filter(c => !o.cutouts.some(cut => rectHitsHex(cut, c)));
  }

  function build(raw) {
    const o = options(raw);
    const cells = planCells(o);
    const skipped = hexGrid(o.wallW, o.wallH, o.cell).length - cells.length;
    const tileGroups = planTiles(cells, o);
    const warnings = [];
    if (!cells.length) warnings.push('No hex cells fit this wall \u2014 enlarge the wall or shrink the cell size.');
    if (skipped) warnings.push(`Skipped ${skipped} cell${skipped === 1 ? '' : 's'} over cutouts.`);
    warnings.push('Print tiles flat. Clip accessories into cells after mounting the wall.');

    const z1 = o.backT + o.depth;
    const parts = [];
    tileGroups.forEach((group, ti) => {
      let mesh = tileMesh(group, o, 0, z1);
      const tabs = edgeInterlocks(group, tileGroups, ti, o, 0, z1);
      if (tabs && tabs.length) mesh = T.concat([mesh, tabs]);
      const bb = Core.bbox(mesh);
      const local = PL.move(mesh, -bb.min[0], -bb.min[1], -bb.min[2]);
      parts.push({
        name: `Wall tile ${ti + 1} of ${tileGroups.length}`,
        p: mesh, assembled: mesh, local,
        w: bb.max[0] - bb.min[0], d: bb.max[1] - bb.min[1], h: bb.max[2] - bb.min[2],
        color: o.colors.wall, kind: 'tile', tileIndex: ti, cells: group.length,
        ox: bb.min[0], oy: bb.min[1]
      });
    });

    // Accessories: local mesh packed for the build plate; assembled mesh seated in sample cells for the 3D preview
    let accCursor = 0;
    let previewIdx = 0;
    for (const a of o.accessories) {
      if (!a.count) continue;
      const sample = cells[0] || { R: o.cell / 2, cx: 0, cy: 0, size: o.cell };
      for (let i = 0; i < a.count; i++) {
        let raw = accessoryMesh(a.type, sample, o);
        const b0 = Core.bbox(raw);
        const local = PL.move(raw, -b0.min[0], -b0.min[1], -b0.min[2]);
        const lb = Core.bbox(local);
        // Pack printable copy along X for export / build plate
        const packed = PL.move(local, accCursor, 0, 0);
        // Seat up to a few instances into wall cells for the assembled preview
        let assembled = packed;
        if (cells.length && i < 2) {
          const host = cells[previewIdx % cells.length];
          previewIdx += 2;
          assembled = PL.move(local, host.cx - (lb.max[0] + lb.min[0]) / 2, host.cy - (lb.max[1] + lb.min[1]) / 2, o.backT + 0.2);
        }
        parts.push({
          name: `${ACCESSORIES[a.type].label} ${i + 1}`,
          p: assembled, assembled, local,
          w: lb.max[0] - lb.min[0], d: lb.max[1] - lb.min[1], h: lb.max[2] - lb.min[2],
          color: o.colors.accent, kind: 'accessory', accType: a.type
        });
        accCursor += lb.max[0] - lb.min[0] + 6;
      }
    }

    for (const pt of parts) {
      if (!Core.checkClosed(pt.local || pt.p).closed && Core.fixTJunctions) {
        const src = pt.local || pt.p;
        const f = Core.fixTJunctions(src, new Array(src.length / 9).fill(0), 1e-3);
        if (f && f.p) { pt.local = Float64Array.from(f.p); if (pt.kind === 'accessory') pt.p = pt.local; }
      }
    }

    const filaments = [
      { role: 'wall', color: o.colors.wall },
      { role: 'accent', color: o.colors.accent }
    ];
    const all = parts.length ? T.concat(parts.map(p => p.assembled || p.p)) : new Float64Array(0);
    const tris = all.length / 9;
    const accN = o.accessories.reduce((a, x) => a + x.count, 0);
    return {
      parts, options: o, warnings, filaments, cells, tileGroups,
      split: { count: tileGroups.length },
      stats: {
        wallW: o.wallW, wallH: o.wallH, cell: o.cell, depth: o.depth, wallT: o.wallT,
        cells: cells.length, skipped, tiles: tileGroups.length, accessories: accN,
        tris, colors: 2
      },
      plate: all, assembled: all
    };
  }

  function export3MF(res, o) {
    o = o || {};
    const printable = res.parts.filter(pt => pt.kind !== 'accessory_preview' && !pt.preview);
    const cols = [];
    printable.forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const objects = printable.map(pt => ({
      name: pt.name, p: pt.local || pt.p, color: pt.color,
      extruder: cols.indexOf((pt.color || '').toUpperCase()) + 1
    }));
    return T.threeMF(objects, {
      title: o.name || 'Hex storage wall',
      plates: [objects.map((_, i) => i)],
      bambu: o.bambu === undefined ? res.options.bambu : o.bambu,
      filaments: cols.map(c => ({ color: c }))
    });
  }

  function files(res, o) {
    o = o || {};
    const base = o.fileBase || 'hex_storage_wall';
    const out = [];
    res.parts.filter(pt => pt.kind !== 'accessory_preview' && !pt.preview).forEach(pt => out.push({
      name: `${base}_${pt.name.replace(/\s+/g, '_').toLowerCase()}.stl`,
      data: new Uint8Array(Core.writeSTL(pt.local || pt.p, pt.name))
    }));
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    const L = [
      'Expressarte hex storage wall',
      `Wall: ${res.stats.wallW} \u00d7 ${res.stats.wallH} mm \u00b7 cell ${res.stats.cell} mm \u00b7 depth ${res.stats.depth} mm`,
      `Cells: ${res.stats.cells} (skipped ${res.stats.skipped}) \u00b7 tiles: ${res.stats.tiles} \u00b7 accessories: ${res.stats.accessories}`,
      '', 'Filaments'
    ];
    res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}  ${f.role}`));
    L.push('', 'Printing', '  - Print tiles flat on the bed.', '  - Push interlocking tabs together; a drop of glue helps.', '  - Clip accessories into cells after mounting.',
      ...(res.warnings || []).map(w => '  - ' + w));
    out.push({ name: `${base}_NOTES.txt`, data: L.join('\n') });
    return out;
  }

  const api = { CELL_PRESETS, ACCESSORIES, FREE, DEFAULTS, PALETTE, options, build, export3MF, files, gateInfo, planCells, planTiles, hexGrid, hexCorners, axialToPixel, neighborDist, cellInteriorsOverlap, tileMesh };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPHexWall = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
