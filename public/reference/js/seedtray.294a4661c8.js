/* Expressarte seed starter tray: a grid of small connected seed cells (like an egg carton) for the plant pot & tray
   maker. Each cell is a tapered cup (round, rounded square or hexagon) with drainage holes, joined at the top by a
   flat web. Optional tear-off score lines between cells, a matching drip tray, a clear-ish lid, row/column labels and
   a plant name. Trays bigger than the bed are split into smaller trays that each fit (cells are never cut).
   Units mm, z up, every shell is closed and outward facing (shells may overlap; slicers merge them). No brands. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tp = (polys, f) => polys.map(P => ({ outer: P.outer.map(f), holes: (P.holes || []).map(h => h.map(f)) }));
  const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };

  const CELLS = { round: { label: 'Round', free: true }, square: { label: 'Rounded square', free: true }, hex: { label: 'Hexagon', free: false } };
  const LIMITS = { freeCells: 24, maxRows: 12, maxCols: 16 };
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    rows: 4, cols: 5, cell: 'round', cellTop: 38, depth: 45, taper: 70, wall: 1.2, floor: 1.2,
    holes: 1, holeD: 5, breakLines: true, web: 2, includeTray: true, trayH: 14, lid: false, lidH: 60,
    labels: false, plantName: '', font: 'round',
    colors: { pot: PZ.mint, tray: PZ.peach, text: PZ.ink, lid: '#DCEFF5' },
    bed: [256, 256], detail: 'hd'
  };
  const SCORE = 0.7;      // gap between neighboring cell webs (the score line)
  const SKIN = 0.6;       // web thickness left under a score line (tears by hand)
  const TRAY_GAP = 1.5, TRAY_WALL = 1.6, LID_GAP = 0.8, LID_WALL = 1.2, LABEL_M = 9;

  function options(raw) {
    const r = raw || {}, o = Object.assign({}, DEFAULTS, r);
    o.rows = clamp(Math.round(num(o.seedRows != null ? o.seedRows : o.rows, 4)), 1, LIMITS.maxRows);
    o.cols = clamp(Math.round(num(o.seedCols != null ? o.seedCols : o.cols, 5)), 1, LIMITS.maxCols);
    o.cell = CELLS[o.seedCell || o.cell] ? (o.seedCell || o.cell) : 'round';
    o.cellTop = clamp(num(o.seedTop != null ? o.seedTop : o.cellTop, 38), 20, 80);
    o.depth = clamp(num(o.seedDepth != null ? o.seedDepth : o.depth, 45), 20, 100);
    o.taper = clamp(num(o.seedTaper != null ? o.seedTaper : o.taper, 70), 40, 100);
    o.wall = clamp(num(o.seedWall != null ? o.seedWall : o.wall, 1.2), 0.8, 3);
    o.floor = clamp(num(o.floor, 1.2), 0.8, 3);
    o.holes = clamp(Math.round(num(o.seedHoles != null ? o.seedHoles : o.holes, 1)), 0, 4);
    if (o.holes === 3) o.holes = 4;
    o.holeD = clamp(num(o.seedHoleD != null ? o.seedHoleD : o.holeD, 5), 2, 12);
    o.breakLines = (r.seedBreak != null ? r.seedBreak : o.breakLines) !== false;
    o.web = clamp(num(o.web, 2), 1.2, 4);
    o.includeTray = (r.seedTray != null ? r.seedTray : r.includeTray) !== false;
    o.trayH = clamp(num(r.seedTrayH != null ? r.seedTrayH : o.trayH, 14), 6, 40);
    o.lid = !!(r.seedLid != null ? r.seedLid : o.lid);
    o.lidH = clamp(num(r.seedLidH != null ? r.seedLidH : o.lidH, 60), 20, 150);
    o.labels = !!(r.seedLabels != null ? r.seedLabels : o.labels);
    o.plantName = String((r.seedName != null ? r.seedName : o.plantName) || '').slice(0, 24);
    if (!Bubble || !Bubble.FONTS || !Bubble.FONTS[o.font]) o.font = 'round';
    o.colors = Object.assign({}, DEFAULTS.colors, r.colors || {});
    o.bed = [clamp(num(o.bed && o.bed[0], 256), 100, 1000), clamp(num(o.bed && o.bed[1], 256), 100, 1000)];
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    o.exportMode = ['pot', 'tray', 'both'].includes(r.exportMode) ? r.exportMode : 'both';
    return o;
  }

  // ---------------------------------------------------------------- cell outline
  // point on the outline of half-size r (inscribed radius) at angle th
  function cellXY(kind, r, th) {
    const c = Math.cos(th), s = Math.sin(th);
    if (kind === 'square') { const n = 5, R = r / Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(s), n), 1 / n); return [R * c, R * s]; }
    if (kind === 'hex') { // flat sides top and bottom, inscribed radius r
      const seg = Math.PI / 3, local = ((th % seg) + seg) % seg - seg / 2; const R = r / Math.cos(local); return [R * c, R * s];
    }
    return [r * c, r * s];
  }
  const nAround = (o) => o.cell === 'hex' ? 48 : o.detail === 'draft' ? 40 : 72;
  function cellLoop(kind, r, n, cx, cy) { const L = []; for (let i = 0; i < n; i++) { const p = cellXY(kind, r, i / n * Math.PI * 2); L.push([cx + p[0], cy + p[1]]); } return L; }
  // half extents of the top outline along x and y (hex points along x)
  const halfExt = (kind, r) => kind === 'hex' ? [r / Math.cos(Math.PI / 6), r] : [r, r];

  function layout(o) {
    const rTop = o.cellTop / 2, rOut = rTop + o.wall, [ex, ey] = halfExt(o.cell, rOut);
    const px = 2 * ex + 2, py = 2 * ey + 2;
    const mL = o.labels ? LABEL_M : 2.4, mT = o.labels ? LABEL_M : 2.4, mB = o.plantName ? LABEL_M + 2 : 2.4, mR = 2.4;
    return { rTop, rBot: rTop * o.taper / 100, px, py, mL, mT, mB, mR };
  }
  // the largest footprint any single piece adds around its cell grid (lid > drip tray > web)
  function extra(o) { return o.lid ? 2 * (TRAY_GAP + TRAY_WALL + LID_GAP + LID_WALL) : o.includeTray ? 2 * (TRAY_GAP + TRAY_WALL) : 0; }
  // trays bigger than the bed are split into chunks of whole cells
  function chunks(o, L) {
    const [bx, by] = o.bed, UW = Math.max(60, bx - 8), UD = Math.max(60, by - 8), ex = extra(o);
    const fit = (n, p, m, U) => Math.max(1, Math.floor((U - m - ex) / p));
    // try both orientations of the grid against the bed: keep the one with fewer pieces
    const plan = (W, D) => {
      const mc = fit(o.cols, L.px, L.mL + L.mR, W), mr = fit(o.rows, L.py, L.mT + L.mB, D);
      const nx = Math.ceil(o.cols / mc), ny = Math.ceil(o.rows / mr);
      return { nx, ny, n: nx * ny };
    };
    const a = plan(UW, UD), b = plan(UD, UW), best = b.n < a.n ? b : a;
    const split = (n, k) => { const out = [], base = Math.floor(n / k), rem = n % k; let s = 0; for (let i = 0; i < k; i++) { const c = base + (i < rem ? 1 : 0); out.push([s, s + c]); s += c; } return out; };
    const cs = split(o.cols, best.nx), rs = split(o.rows, best.ny), out = [];
    rs.forEach(([r0, r1], j) => cs.forEach(([c0, c1], i) => out.push({ c0, c1, r0, r1, i, j })));
    const tooBig = L.px + L.mL + L.mR + ex > Math.max(UW, UD) && L.py + L.mT + L.mB + ex > Math.max(UW, UD);
    return { list: out, UW, UD, tooBig };
  }

  const fix = p => (p && p.length && Core.signedVolume(p) < 0 ? Core.flip(p) : p);
  // one tapered cup wall (closed tube) at cx, cy from z0 to z1
  function cupWall(o, L, cx, cy, z0, z1) {
    const n = nAround(o), nz = 1; // a straight taper needs no rings in between
    const map = (i, j, t) => {
      const v = j / nz, z = z0 + (z1 - z0) * v, ri = L.rBot + (L.rTop - L.rBot) * v; // inner radius at this height
      const p = cellXY(o.cell, ri + o.wall - t, i / n * Math.PI * 2);
      return [cx + p[0], cy + p[1], z];
    };
    return fix(T.heightSolid(n, nz + 1, () => o.wall, map, true));
  }
  function cupFloor(o, L, cx, cy) {
    const n = nAround(o), holes = [], hr = Math.min(o.holeD / 2, L.rBot * 0.32);
    if (o.holes === 1) holes.push(T.circle(cx, cy, hr, 20));
    else if (o.holes === 2) { const d = L.rBot * 0.45; holes.push(T.circle(cx - d, cy, hr * 0.8, 16), T.circle(cx + d, cy, hr * 0.8, 16)); }
    else if (o.holes === 4) { const d = L.rBot * 0.42; for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) holes.push(T.circle(cx + sx * d * 0.72, cy + sy * d * 0.72, hr * 0.62, 14)); }
    return fix(T.extrude([{ outer: cellLoop(o.cell, L.rBot + o.wall * 0.6, n, cx, cy), holes }], 2, 0, o.floor));
  }
  function textPolys(s, h, font) {
    if (!Bubble || !s) return [];
    const out = []; let x = 0;
    for (const ch of [...String(s)]) {
      if (/\s/.test(ch)) { x += h * 0.35; continue; }
      const g = Bubble.glyphPolys(font || 'round', ch, h) || Bubble.glyphPolys(font || 'round', ch.toUpperCase(), h);
      if (!g || !g.polys.length) continue;
      const b = T.polysBBox(g.polys);
      out.push(...tp(g.polys, p => [p[0] - b.x0 + x, p[1]]));
      x += b.w + h * 0.08;
    }
    if (!out.length) return [];
    const b = T.polysBBox(out);
    return tp(out, p => [p[0] - (b.x0 + b.x1) / 2, p[1] - (b.y0 + b.y1) / 2]);
  }
  const at = (polys, x, y, s) => tp(polys, p => [p[0] * (s || 1) + x, p[1] * (s || 1) + y]);

  // one tray chunk: cells c0..c1 \u00d7 r0..r1; returns { tray, text, web size }
  function chunkMesh(o, L, ch, total) {
    const nc = ch.c1 - ch.c0, nr = ch.r1 - ch.r0;
    const W = L.mL + nc * L.px + L.mR, D = L.mB + nr * L.py + L.mT;
    const top = o.depth, z0 = top - o.web, bits = [], cells = [];
    for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
      const cx = L.mL + (i + 0.5) * L.px, cy = L.mB + (nr - 1 - j + 0.5) * L.py; // row A at the back (top of the plan)
      cells.push({ cx, cy, row: ch.r0 + j, col: ch.c0 + i });
      bits.push(cupWall(o, L, cx, cy, 0, top), cupFloor(o, L, cx, cy));
    }
    const n = nAround(o), hole = c => cellLoop(o.cell, L.rTop, n, c.cx, c.cy).reverse();
    if (o.breakLines && cells.length > 1) {
      // a full-thickness web square per cell, a thin skin under the score lines, the border strip on its own
      for (const c of cells) {
        const g = SCORE / 2, sq = [[c.cx - L.px / 2 + g, c.cy - L.py / 2 + g], [c.cx + L.px / 2 - g, c.cy - L.py / 2 + g], [c.cx + L.px / 2 - g, c.cy + L.py / 2 - g], [c.cx - L.px / 2 + g, c.cy + L.py / 2 - g]];
        bits.push(fix(T.extrude([{ outer: sq, holes: [hole(c)] }], 2, z0, top)));
      }
      const inner = [[L.mL - SCORE / 2, L.mB - SCORE / 2], [W - L.mR + SCORE / 2, L.mB - SCORE / 2], [W - L.mR + SCORE / 2, D - L.mT + SCORE / 2], [L.mL - SCORE / 2, D - L.mT + SCORE / 2]];
      const border = T.diffPolys([{ outer: T.roundRect(0, 0, W, D, 3), holes: [] }], [{ outer: inner, holes: [] }]);
      if (border.length) bits.push(fix(T.extrude(border, 2, z0, top)));
      bits.push(fix(T.extrude([{ outer: T.roundRect(0, 0, W, D, 3), holes: cells.map(hole) }], 2, z0, z0 + SKIN)));
    } else {
      bits.push(fix(T.extrude([{ outer: T.roundRect(0, 0, W, D, 3), holes: cells.map(hole) }], 2, z0, top)));
    }
    // labels: row letters on the left margin, column numbers on the top margin, plant name on the front
    const txt = [];
    if (o.labels) {
      const h = Math.min(6, LABEL_M * 0.62);
      for (let j = 0; j < nr; j++) { const cy = L.mB + (nr - 1 - j + 0.5) * L.py; txt.push(...at(textPolys(String.fromCharCode(65 + ch.r0 + j), h, o.font), L.mL / 2, cy)); }
      for (let i = 0; i < nc; i++) { const cx = L.mL + (i + 0.5) * L.px; txt.push(...at(textPolys(String(ch.c0 + i + 1), h, o.font), cx, D - L.mT / 2)); }
    }
    if (o.plantName) {
      let p = textPolys(o.plantName, Math.min(7, LABEL_M * 0.7), o.font); const b = T.polysBBox(p), maxW = W - 8;
      if (p.length && b.w > maxW) p = at(p, 0, 0, maxW / b.w);
      if (p.length) txt.push(...at(p, W / 2, L.mB / 2 + 0.6));
    }
    let text = null;
    if (txt.length) { try { text = fix(T.extrude(T.unionPolys(txt), 2, top, top + 0.8)); } catch (_) { text = null; } }
    void total;
    return { tray: fix(T.concat(bits)), text, W, D, cells };
  }
  function dripTray(o, W, D) {
    const x0 = -TRAY_GAP - TRAY_WALL, y0 = x0, x1 = W + TRAY_GAP + TRAY_WALL, y1 = D + TRAY_GAP + TRAY_WALL, h = o.trayH, f = 1.6;
    const outer = T.roundRect(x0, y0, x1, y1, 5), inner = T.roundRect(-TRAY_GAP, -TRAY_GAP, W + TRAY_GAP, D + TRAY_GAP, 4).reverse();
    const bits = [fix(T.extrude([{ outer, holes: [] }], 2, 0, f)), fix(T.extrude([{ outer, holes: [inner] }], 2, f - 0.01, h))];
    // ridges across the floor so the cells drain
    const nR = Math.max(2, Math.round(D / 30));
    for (let k = 0; k < nR; k++) { const y = (k + 0.5) / nR * D; bits.push(fix(T.extrude([{ outer: [[2, y - 1.1], [W - 2, y - 1.1], [W - 2, y + 1.1], [2, y + 1.1]], holes: [] }], 2, f - 0.01, f + 2.2))); }
    return { mesh: fix(T.concat(bits)), x0, y0, x1, y1 };
  }
  // humidity lid: an open box that drops over the drip tray rim, printed top down (top plate on the bed), with vents
  function lidMesh(o, tr) {
    const g = LID_GAP, w = LID_WALL;
    const ix0 = tr.x0 - g, iy0 = tr.y0 - g, ix1 = tr.x1 + g, iy1 = tr.y1 + g;
    const outer = T.roundRect(ix0 - w, iy0 - w, ix1 + w, iy1 + w, 6), inner = T.roundRect(ix0, iy0, ix1, iy1, 5).reverse();
    const cx = (ix0 + ix1) / 2, cy = (iy0 + iy1) / 2, dx = (ix1 - ix0) * 0.3, dy = (iy1 - iy0) * 0.3;
    const vents = [[-dx, -dy], [dx, -dy], [dx, dy], [-dx, dy]].map(([a, b]) => T.circle(cx + a, cy + b, 2.5, 18).reverse());
    const plateT = 1.2;
    return fix(T.concat([fix(T.extrude([{ outer, holes: vents }], 2, 0, plateT)), fix(T.extrude([{ outer, holes: [inner] }], 2, plateT - 0.01, o.lidH))]));
  }

  function build(raw) {
    const o = options(raw), L = layout(o), warnings = [];
    const C = chunks(o, L), parts = [];
    if (C.tooBig) warnings.push('One cell is larger than your bed. Make the cells smaller.');
    if (C.list.length > 1) warnings.push(`This tray is bigger than your ${Math.round(o.bed[0])}\u00d7${Math.round(o.bed[1])} mm bed, so it is made as ${C.list.length} smaller trays of whole cells that sit side by side.`);
    if (o.wall < 1) warnings.push('Walls under 1 mm are fragile; 1.2 mm (3 lines with a 0.4 mm nozzle) is a good start.');
    const wantCells = o.exportMode !== 'tray', wantTray = o.includeTray && o.exportMode !== 'pot';
    // preview: each tray sits in its drip tray (as it is used), the lid beside it; split trays side by side
    let ox = 0, oy = 0, rowD = 0;
    const n = C.list.length, lbl = k => n > 1 ? ` ${k + 1}` : '';
    const lift = 1.6 + 2.2; // drip tray floor + ridges
    C.list.forEach((ch, k) => {
      const m = chunkMesh(o, L, ch, C);
      const tr = dripTray(o, m.W, m.D);
      if (ch.i === 0 && k) { ox = 0; oy += rowD + 16; rowD = 0; }
      const place = (p, dx, dy, dz) => PL.move(p, ox + dx, oy + dy, dz || 0);
      const g = `tray${k}`, inTray = wantTray && wantCells ? lift : 0;
      if (wantCells) {
        parts.push({ name: `Seed tray${lbl(k)}`, kind: 'pot', group: g, color: o.colors.pot, p: place(m.tray, -tr.x0, -tr.y0, inTray) });
        if (m.text) parts.push({ name: `Labels${lbl(k)}`, kind: 'text', group: g, color: o.colors.text, p: place(m.text, -tr.x0, -tr.y0, inTray) });
      }
      let w = tr.x1 - tr.x0, d = tr.y1 - tr.y0;
      if (wantTray) parts.push({ name: `Drip tray${lbl(k)}`, kind: 'tray', group: `drip${k}`, color: o.colors.tray, p: place(tr.mesh, -tr.x0, -tr.y0) });
      if (o.lid && o.exportMode !== 'pot') {
        const lm = lidMesh(o, tr), lb = Core.bbox(lm);
        parts.push({ name: `Lid${lbl(k)}`, kind: 'lid', group: `lid${k}`, color: o.colors.lid, p: place(lm, w + 20 - lb.min[0], -lb.min[1]) });
        w += 20 + (lb.max[0] - lb.min[0]); d = Math.max(d, lb.max[1] - lb.min[1]);
      }
      ox += w + 18; rowD = Math.max(rowD, d);
    });
    for (const pt of parts) { pt.assembled = pt.p; }
    // local (print) meshes per group, so labels stay on their tray
    const groups = new Map();
    for (const pt of parts) { if (!groups.has(pt.group)) groups.set(pt.group, []); groups.get(pt.group).push(pt); }
    for (const list of groups.values()) { const b = Core.bbox(T.concat(list.map(x => x.p))); for (const pt of list) pt.local = PL.move(pt.p, -b.min[0], -b.min[1], -b.min[2]); }
    for (const pt of parts) { const ck = Core.checkClosed(pt.p); if (!ck.closed) warnings.push(`${pt.name} has open edges.`); }
    const seen = new Set(), filaments = [];
    for (const pt of parts) { const c = String(pt.color).toUpperCase(); if (!seen.has(c)) { seen.add(c); filaments.push({ role: pt.kind, color: pt.color }); } }
    const all = parts.length ? T.concat(parts.map(p => p.p)) : new Float64Array(0), bb = all.length ? Core.bbox(all) : { min: [0, 0, 0], max: [0, 0, 0] };
    const cellsN = o.rows * o.cols;
    return {
      parts, options: Object.assign({}, o, { shape: 'seedtray', style: 'smooth' }), warnings, filaments,
      split: n > 1 ? { count: n, tabs: 0, nx: 0, ny: 0 } : null,
      stats: {
        shape: 'seedtray', style: 'smooth', seed: true, rows: o.rows, cols: o.cols, cells: cellsN, cell: o.cell,
        topD: o.cellTop, bottomD: +(L.rBot * 2).toFixed(1), height: o.depth, wallT: o.wall, bottomT: o.floor,
        drainage: o.holes ? `${o.holes} per cell` : 'none', holes: o.holes, breakLines: o.breakLines,
        pitch: [+L.px.toFixed(2), +L.py.toFixed(2)], trays: n,
        hasTray: parts.some(p => p.kind === 'tray'), hasLid: parts.some(p => p.kind === 'lid'), hasText: parts.some(p => p.kind === 'text'), hasInsert: false, vaseMode: false,
        tris: all.length / 9, pieces: parts.length, colors: seen.size,
        sizeX: bb.max[0] - bb.min[0], sizeY: bb.max[1] - bb.min[1], sizeZ: bb.max[2] - bb.min[2]
      },
      plate: all, assembled: all
    };
  }

  // pack groups (a tray with its labels stays together) onto as many plates as needed
  function platesOf(res) {
    const o = res.options, UW = Math.max(60, o.bed[0] - 8), UD = Math.max(60, o.bed[1] - 8);
    const groups = []; const idx = new Map();
    for (const pt of res.parts) { if (!idx.has(pt.group)) { idx.set(pt.group, groups.length); groups.push({ name: pt.name, list: [] }); } groups[idx.get(pt.group)].list.push(pt); }
    const items = groups.map(g => ({ name: g.name, p: T.concat(g.list.map(x => x.local)) }));
    const ar = PL.arrange(items, UW, UD, { gap: 6 });
    // arrange re-places the combined mesh; apply the same move (and quarter turn) to each member
    const plates = ar.plates.map(list => list.map(it => {
      const g = groups[items.findIndex(x => x.name === it.name)], b = Core.bbox(T.concat(g.list.map(x => x.local))), h = b.max[1] - b.min[1];
      const parts = g.list.map(pt => {
        let q;
        if (it.rot) { q = new Float64Array(pt.local.length); for (let i = 0; i < q.length; i += 3) { const x = pt.local[i] - b.min[0], y = pt.local[i + 1] - b.min[1]; q[i] = h - y; q[i + 1] = x; q[i + 2] = pt.local[i + 2] - b.min[2]; } }
        else q = PL.move(pt.local, -b.min[0], -b.min[1], -b.min[2]);
        return { name: pt.name, p: PL.move(q, it.x, it.y, 0), color: pt.color };
      });
      return { name: g.name, parts };
    }));
    return { plates, unfit: ar.unfit, UW, UD };
  }
  function export3MF(res, o) {
    o = o || {};
    const { plates } = platesOf(res), cols = [], objs = [], lists = [];
    res.parts.forEach(pt => { const c = String(pt.color).toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const bed = res.options.bed;
    plates.forEach((list, k) => {
      const org = T.bambuPlateOrigin(k, plates.length, bed[0], bed[1]), ids = [];
      for (const g of list) {
        ids.push(objs.length);
        const parts = g.parts.map(x => ({ name: x.name, p: PL.move(x.p, 4 + org[0], 4 + org[1], 0), color: x.color, extruder: cols.indexOf(String(x.color).toUpperCase()) + 1 }));
        objs.push(parts.length > 1 ? { name: g.name, parts } : Object.assign({}, parts[0], { name: g.name }));
      }
      lists.push(ids);
    });
    return T.threeMF(objs, { title: o.name || 'Seed starter tray', plates: lists, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function files(res, o) {
    o = o || {};
    const base = o.fileBase || 'seed_tray', out = [];
    for (const pt of res.parts) out.push({ name: `${base}_${pt.name.replace(/\s+/g, '_').toLowerCase()}.stl`, data: new Uint8Array(Core.writeSTL(pt.local, pt.name)) });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    const s = res.stats, L = ['Expressarte seed starter tray',
      `${s.rows} rows \u00d7 ${s.cols} columns = ${s.cells} cells (${CELLS[s.cell].label})`,
      `Cell top ${s.topD} mm, bottom ${s.bottomD} mm, depth ${s.height} mm, wall ${s.wallT} mm`,
      `Drainage: ${s.drainage}`, s.trays > 1 ? `Made as ${s.trays} trays that fit your bed` : 'One tray',
      '', 'Printing',
      '  - Print the cell tray upright with the cells open side up. No supports.',
      '  - Use 3 or more wall lines (1.2 mm at 0.4 mm nozzle) so the cups hold soil.',
      s.breakLines ? '  - Tear-off lines: bend along a score line a few times and the cells snap apart.' : '',
      s.hasLid ? '  - Lid: print in clear or natural PETG, top down, 1-2 walls and no infill on the walls, for a see-through humidity dome.' : '',
      '  - PETG or PLA both work; rinse before reuse.',
      ...(res.warnings || []).map(w => '  - ' + w)].filter(x => x !== '');
    out.push({ name: `${base}_NOTES.txt`, data: L.join('\n') });
    return out;
  }
  function gateInfo(raw) {
    const o = options(raw), why = [];
    if (!CELLS[o.cell].free) why.push(`${CELLS[o.cell].label} cells (Pro)`);
    if (o.rows * o.cols > LIMITS.freeCells) why.push(`${o.rows * o.cols} cells (free: up to ${LIMITS.freeCells})`);
    if (o.lid) why.push('humidity lid (Pro)');
    if (o.labels || o.plantName) why.push('labels and plant name (Pro)');
    const cols = new Set([o.colors.pot, o.includeTray ? o.colors.tray : o.colors.pot, (o.labels || o.plantName) ? o.colors.text : o.colors.pot, o.lid ? o.colors.lid : o.colors.pot].map(c => String(c).toUpperCase()));
    if (cols.size > 1) why.push('multicolor seed tray 3MF (Pro)');
    return why;
  }
  const api = { CELLS, LIMITS, DEFAULTS, options, layout, build, export3MF, files, gateInfo, platesOf, cellXY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPSeedTray = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
