/* Expressarte flex name: type a name and get ONE connected, print-in-place flexible piece.

   Styles (units mm, z up, prints flat with no supports):
   - chainmail: a fabric of small diamond links on a square grid. Every link has two low bars on the bed and two high
     bars on top (joined by corner posts), so each link passes over and under each of its four side neighbors and is
     linked to them like chain. Links never touch: every gap is at least the clearance, side to side and top to bottom.
   - tiles: an articulated mat. The name shape is cut into small square tiles. Each tile sends a hidden arm to its right
     and back neighbors; the arm ends in a peg that stands in a slotted pocket in the neighbor's floor, held between the
     neighbor's floor and roof with the clearance all round. The tops can be domed or flat; letters can be inlaid flush
     in a second color.
   - slinky: the name outline as a flat spring of nested outline rings, each joined to the next by one short tab on
     alternating ends. Lift the middle and it stretches and bounces like a coil spring.
   No brand or competitor names. American spelling. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };

  const STYLES = { chainmail: 'Chain mail', tiles: 'Wiggle tiles', grid: 'Sliding grid', slinky: 'Slinky spring' };
  const FONTS = { round: { label: 'Round', pro: false }, chunky: { label: 'Chunky', pro: false }, soft: { label: 'Soft', pro: true }, wide: { label: 'Wide', pro: true }, balloon: { label: 'Balloon', pro: true } };
  const SHAPES = { plate: 'Rounded plate', name: 'Name outline' };
  const TOPS = { dome: 'Domed tops', flat: 'Flat tops' };
  const COLOR_MODES = { one: 'One color', two: 'Letters in a second color', checker: 'Checkerboard', rainbow: 'Rainbow letters' };
  const PALETTE = [
    { name: 'White', hex: '#F7F7F2' }, { name: 'Black', hex: '#1E1E1E' }, { name: 'Red', hex: '#C8102E' }, { name: 'Orange', hex: '#E8730C' },
    { name: 'Yellow', hex: '#F5C518' }, { name: 'Green', hex: '#1E9B4F' }, { name: 'Sky blue', hex: '#4A90D9' }, { name: 'Purple', hex: '#7B4FB8' },
    { name: 'Pink', hex: '#F2A0B5' }, { name: 'Mint', hex: '#8FD9C0' }, { name: 'Gray', hex: '#8A8D91' }
  ];
  const RAINBOW = ['#C8102E', '#E8730C', '#F5C518', '#1E9B4F', '#4A90D9', '#7B4FB8', '#F2A0B5', '#8FD9C0'];
  const LIMITS = { maxChars: 12, freeColors: 2, freeFonts: ['round', 'chunky'] };
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    style: 'chainmail', name: 'Emma', font: 'chunky', letterH: 44, shape: 'plate', top: 'dome',
    pitch: 0, clearance: 0, bar: 1.2, thickness: 0, keyring: false, colorMode: 'two',
    colors: { base: PZ.lavender, letters: PZ.ink, alt: PZ.pink },
    coils: 6, wall: 2.4, gap: 0.8, layer: 1.6,
    bed: [256, 256], detail: 'hd'
  };
  const PER_STYLE = {
    chainmail: { pitch: 5, clearance: 0.4, thickness: 2.4, letterH: 44 },
    tiles: { pitch: 8, clearance: 0.35, thickness: 6, letterH: 48 },
    grid: { pitch: 9, clearance: 0.35, thickness: 7, letterH: 44 },
    slinky: { letterH: 40 }
  };

  function hex(c, d) { const v = String(c || ''); return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : d; }
  function options(raw) {
    const r = raw || {}, o = Object.assign({}, DEFAULTS, r);
    o.style = STYLES[o.style] ? o.style : 'chainmail';
    const ps = PER_STYLE[o.style];
    o.name = [...String(o.name == null ? DEFAULTS.name : o.name).replace(/\s+/g, ' ').trim()].slice(0, LIMITS.maxChars + 4).join('');
    o.font = FONTS[o.font] && Bubble && Bubble.FONTS && Bubble.FONTS[o.font] ? o.font : 'round';
    o.letterH = clamp(num(r.letterH, ps.letterH), 20, 150);
    o.shape = o.shape === 'tag' ? 'plate' : SHAPES[o.shape] ? o.shape : 'plate';
    o.top = TOPS[o.top] ? o.top : 'dome';
    if (o.style === 'chainmail') {
      o.pitch = clamp(num(r.pitch, ps.pitch) || ps.pitch, 5, 12);
      o.clearance = clamp(num(r.clearance, ps.clearance) || ps.clearance, 0.25, 0.7);
      o.thickness = clamp(num(r.thickness, ps.thickness) || ps.thickness, 1.8, 5);
      // keep every side gap at least the clearance: bar \u2264 0.354 \u00d7 pitch \u2212 clearance
      o.bar = clamp(num(r.bar, 1.2), 0.8, 2.4);
      const maxBar = 0.3536 * o.pitch - o.clearance - 0.05;
      if (o.bar > maxBar) { o.barClamped = true; o.bar = Math.max(0.6, +maxBar.toFixed(2)); }
    } else if (o.style === 'tiles' || o.style === 'grid') {
      if (o.style === 'grid' && r.top == null) o.top = 'flat';
      o.pitch = clamp(num(r.pitch, ps.pitch) || ps.pitch, o.style === 'grid' ? 9 : 7, o.style === 'grid' ? 16 : 14);
      o.clearance = clamp(num(r.clearance, ps.clearance) || ps.clearance, 0.25, 0.6);
      o.thickness = clamp(num(r.thickness, ps.thickness) || ps.thickness, 4.6 + 2 * o.clearance - 0.7, 12);
    } else {
      o.coils = clamp(Math.round(num(r.coils, 6)), 1, 20);
      o.wall = clamp(num(r.wall, 2.4), 1.2, 5);
      o.gap = clamp(num(r.gap, 0.8), 0.4, 3);
      o.layer = clamp(num(r.layer, 1.6), 0.8, 5);
    }
    o.keyring = !!r.keyring;
    o.colorMode = COLOR_MODES[o.colorMode] ? o.colorMode : 'two';
    if (o.style === 'slinky' && o.colorMode === 'checker') o.colorMode = 'two';
    o.colors = { base: hex(r.colors && r.colors.base, DEFAULTS.colors.base), letters: hex(r.colors && r.colors.letters, DEFAULTS.colors.letters), alt: hex(r.colors && r.colors.alt, DEFAULTS.colors.alt) };
    o.bed = [clamp(num(o.bed && o.bed[0], 256), 100, 1000), clamp(num(o.bed && o.bed[1], 256), 100, 1000)];
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    return o;
  }

  // ---------------------------------------------------------------- 2D helpers
  const P = L => ({ outer: L, holes: [] });
  const U = ps => ps.length ? T.unionPolys(ps) : [];
  const D = (a, b) => (b && b.length ? T.diffPolys(a, b) : a);
  const I = (a, b) => (a.length && b.length ? T.interPolys(a, b) : []);
  const Off = (ps, d, sq) => (ps.length ? T.offset(ps, d, sq ? false : undefined) : []);
  const area = ps => T.polysArea(ps);
  const bb = ps => T.polysBBox(ps);
  const move = (ps, dx, dy) => ps.map(Q => ({ outer: Q.outer.map(p => [p[0] + dx, p[1] + dy]), holes: Q.holes.map(h => h.map(p => [p[0] + dx, p[1] + dy])) }));
  const rect = (x0, y0, x1, y1) => P([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const circ = (x, y, r, n) => P(T.circle(x, y, r, n || Math.max(16, Math.ceil(r * 10))));
  function stadium(x0, y, x1, r) { // horizontal slot from x0 to x1 at height y
    const L = [], n = 10;
    for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + Math.PI * i / n; L.push([x1 + r * Math.cos(t), y + r * Math.sin(t)]); }
    for (let i = 0; i <= n; i++) { const t = Math.PI / 2 + Math.PI * i / n; L.push([x0 + r * Math.cos(t), y + r * Math.sin(t)]); }
    return P(L);
  }
  const swapXY = ps => ps.map(Q => ({ outer: Q.outer.map(p => [p[1], p[0]]).reverse(), holes: Q.holes.map(h => h.map(p => [p[1], p[0]]).reverse()) }));
  const largest = ps => ps.length ? [ps.reduce((a, q) => (Math.abs(T.polysArea([q])) > Math.abs(T.polysArea([a])) ? q : a))] : [];
  const noHoles = ps => ps.map(Q => ({ outer: Q.outer, holes: [] }));
  function rdp(pts, tol) {
    if (pts.length < 4) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
    while (st.length) { const [a, b2] = st.pop(); let best = -1, bd = tol; const ax = pts[a][0], ay = pts[a][1], bx = pts[b2][0], by = pts[b2][1], Ln = Math.hypot(bx - ax, by - ay) || 1e-9;
      for (let i = a + 1; i < b2; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / Ln; if (d > bd) { bd = d; best = i; } }
      if (best >= 0) { keep[best] = 1; st.push([a, best], [best, b2]); } }
    return pts.filter((_, i) => keep[i]);
  }
  function simpLoop(L, tol) { if (L.length < 8) return L; const h = L.length >> 1; const a = rdp(L.slice(0, h + 1), tol), b2 = rdp(L.slice(h).concat([L[0]]), tol); return a.concat(b2.slice(1, -1)); }
  function simplify(ps, tol) { const q = ps.map(Q => ({ outer: simpLoop(Q.outer, tol), holes: Q.holes.map(h => simpLoop(h, tol)).filter(h => h.length >= 3) })).filter(Q => Q.outer.length >= 3); return q.length ? U(q) : ps; }
  function inside(pt, ps) { for (const Q of ps) if (T.pointIn(pt, { outer: Q.outer, holes: Q.holes || [] })) return true; return false; }

  // ---------------------------------------------------------------- letters
  function chars(name) { return [...String(name || '')].filter(c => !/\s/.test(c)); }
  function letters(o) {
    const h = o.letterH, out = [], skipped = []; let x = 0, k = 0;
    for (const ch of [...o.name]) {
      if (/\s/.test(ch)) { x += h * 0.3; continue; }
      if (k >= LIMITS.maxChars) break;
      const g = Bubble.glyphPolys(o.font, ch, h); if (!g || !g.polys.length) { skipped.push(ch); continue; }
      const b = bb(g.polys); out.push({ ch, i: out.length, polys: move(g.polys, x - b.x0, 0) }); x += (b.x1 - b.x0) + (o.style === 'chainmail' ? (o.shape === 'plate' ? Math.max(h * 0.07, Math.min(o.pitch * 1.5, h * 0.16)) : h * 0.1) : h * 0.07); k++; // air between letters so each one reads (chain mail: at least a link and a half, so a row of base links parts them)
    }
    return { list: out, skipped };
  }
  // the one connected outline the flexible piece fills: thickened letters bridged through the middle, no holes
  function outline(L, o, border, bandHalf) {
    const all = U(L.list.flatMap(g => g.polys)); if (!all.length) return { region: [], all, mid: 0, b: null };
    const b = bb(all), mid = o.letterH * 0.47;
    let region;
    // rounded plate (default): the letters sit on a backing with a clear border all round, so they read as letters
    if (o.shape === 'plate') { const m = Math.max(border * 3, o.letterH * 0.16); region = [P(T.roundRect(b.x0 - m, b.y0 - m, b.x1 + m, b.y1 + m, Math.min(o.letterH * 0.3, (b.h + 2 * m) / 2 - 0.5)))]; }
    else {
      const band = rect(b.x0 + o.letterH * 0.12, mid - bandHalf, b.x1 - o.letterH * 0.12, mid + bandHalf);
      region = largest(noHoles(U(Off(all, border).concat([band]))));
    }
    region = simplify(region, 0.04);
    return { region, all, mid, b };
  }

  // ---------------------------------------------------------------- stacked-layer solids
  // layers: [{ polys, z0, z1 }], contiguous from the bottom; one closed solid
  // edges not used exactly once in each direction (exact vertex match): 0 for a clean closed manifold
  function strictBad(p) {
    const E = new Map(), k3 = i => `${p[i].toFixed(5)},${p[i + 1].toFixed(5)},${p[i + 2].toFixed(5)}`; let bad = 0;
    for (let t = 0; t < p.length; t += 9) { const v = [k3(t), k3(t + 3), k3(t + 6)]; for (let e = 0; e < 3; e++) { const a = v[e], b2 = v[(e + 1) % 3]; if (a === b2) continue; const k = a < b2 ? a + '|' + b2 : b2 + '|' + a; E.set(k, (E.get(k) || 0) + (a < b2 ? 1 : 1000)); } }
    for (const c of E.values()) if (c !== 1001) bad++; // exactly one use each way
    return bad;
  }
  // weld: snap to a 0.1 \u00b5m grid so points the T-junction repair left a hair apart become one vertex; drop the
  // slivers that collapse
  function weld(p, S = 1e4, off = 0) {
    const q = new Float64Array(p.length); let n = 0;
    for (let t = 0; t < p.length; t += 9) {
      const v = []; for (let k = 0; k < 9; k++) v.push(Math.round((p[t + k] + off) * S) / S - off);
      if ((v[0] === v[3] && v[1] === v[4] && v[2] === v[5]) || (v[0] === v[6] && v[1] === v[7] && v[2] === v[8]) || (v[3] === v[6] && v[4] === v[7] && v[5] === v[8])) continue;
      q.set(v, n); n += 9;
    }
    return q.slice(0, n);
  }
  // a near-degenerate cap triangle can come out wound backwards: if all three of its edges run the same way as
  // the neighbor across them, turn it over
  function fixFlips(p) {
    const k3 = i => p[i].toFixed(5) + ',' + p[i + 1].toFixed(5) + ',' + p[i + 2].toFixed(5), E = new Map(), V = [];
    for (let t = 0; t < p.length; t += 9) { const v = [k3(t), k3(t + 3), k3(t + 6)]; V.push(v); for (let e = 0; e < 3; e++) { const a = v[e], b = v[(e + 1) % 3]; if (a !== b) { const k = a + '>' + b; E.set(k, (E.get(k) || 0) + 1); } } }
    const q = Float64Array.from(p); let n = 0;
    V.forEach((v, i) => {
      let same = 0, real = 0;
      for (let e = 0; e < 3; e++) { const a = v[e], b = v[(e + 1) % 3]; if (a === b) continue; real++; if (E.get(a + '>' + b) === 2 && !E.get(b + '>' + a)) same++; }
      if (real && same === real) { const t = i * 9; for (let k = 0; k < 3; k++) { q[t + 3 + k] = p[t + 6 + k]; q[t + 6 + k] = p[t + 3 + k]; } n++; }
    });
    return n ? q : p;
  }
  function solidOf(layers) {
    let p0 = solidOf0(layers); if (!p0.length || !strictBad(p0)) return p0;
    { const q = fixFlips(p0); if (!strictBad(q)) return q; if (strictBad(q) < strictBad(p0)) p0 = q; }
    // points the repair left a few 0.1 \u00b5m apart: weld on a coarser 1 \u00b5m grid (two grid phases, keep the clean one)
    for (const off of [0, 0.00037]) { const q = weld(p0, 1e3, off); if (q.length && !strictBad(q)) return Core.signedVolume(q) < 0 ? Core.flip(q) : q; }
    // a region that touches itself at a single corner (two lobes of a rounded top) is not manifold there: open each
    // layer by a hair so the lobes part, and keep whichever is cleaner
    const p1 = solidOf0(layers.map(l => ({ z0: l.z0, z1: l.z1, polys: l.polys && l.polys.length ? Off(Off(l.polys, -0.02), 0.015) : l.polys })));
    if (p1.length && !strictBad(p1)) return p1;
    // last resort: fold the thin rounded-edge steps into the layer below (a square top edge on this block only)
    const M = [];
    for (const l of layers) { if (!l.polys || !l.polys.length) continue; const prev = M[M.length - 1]; if (prev && l.z1 - l.z0 < 0.35 && Math.abs(prev.z1 - l.z0) < 1e-9 && l.z0 > 1.5) M[M.length - 1] = { z0: prev.z0, z1: l.z1, polys: prev.polys }; else M.push(l); }
    const p2 = solidOf0(M);
    const cands = [p0, p1, p2].filter(q => q.length).map(q => [strictBad(q), q]).sort((x, y) => x[0] - y[0]);
    return cands.length ? cands[0][1] : p0;
  }
  function solidOf0(layers) {
    let p = T.steppedExtrude(layers.filter(l => l.polys && l.polys.length));
    // caps between layers meet the walls at clipper's 1 \u00b5m grid points: close those T-junctions (as the box maker does)
    for (let it = 0; it < 24 && p.length && Core.fixTJunctions && !Core.checkClosed(p).closed; it++) { const f = Core.fixTJunctions(p, new Array(p.length / 9).fill(0), 2e-3); if (!f || !f.p || f.p.length === p.length) break; p = Float64Array.from(f.p); }
    p = weld(p);
    return p.length && Core.signedVolume(p) < 0 ? Core.flip(p) : p;
  }

  // ---------------------------------------------------------------- chain mail
  function ringLayers(cx, cy, o) {
    const p = o.pitch, a = 0.75 * p, w = o.bar, c = o.clearance, t = (o.thickness - c) / 2;
    const V = { R: [cx + a, cy], Tp: [cx, cy + a], L: [cx - a, cy], B: [cx, cy - a] };
    // bars run half a bar width past each corner, so two bars meeting at a corner overlap in a w\u00d7w square; the post
    // joining the low bar to the high bar is that square shrunk a little, so it sits strictly inside both bars and
    // no outlines ever run along each other (clean closed solid for any size)
    const bar = (A, B2) => {
      const dx = B2[0] - A[0], dy = B2[1] - A[1], l = Math.hypot(dx, dy), ux = dx / l * w / 2, uy = dy / l * w / 2, nx = -uy, ny = ux;
      const A0 = [A[0] - ux, A[1] - uy], B0 = [B2[0] + ux, B2[1] + uy];
      return P([[A0[0] + nx, A0[1] + ny], [B0[0] + nx, B0[1] + ny], [B0[0] - nx, B0[1] - ny], [A0[0] - nx, A0[1] - ny]]);
    };
    const post = q => { const r = w * 0.7071 - 0.12; return P([[q[0] + r, q[1]], [q[0], q[1] + r], [q[0] - r, q[1]], [q[0], q[1] - r]]); };
    const posts = [V.R, V.Tp, V.L, V.B].map(post);
    const low = U([bar(V.Tp, V.L), bar(V.B, V.R)]);      // upper-left and lower-right bars on the bed
    const high = U([bar(V.R, V.Tp), bar(V.L, V.B)]);     // upper-right and lower-left bars on top
    const mid = U(posts);
    return [{ polys: low, z0: 0, z1: t }, { polys: mid, z0: t, z1: t + c }, { polys: high, z0: t + c, z1: 2 * t + c }];
  }
  function chainmail(o, L, warnings) {
    const p = o.pitch, out = outline(L, o, p * 0.3, p * 0.7);
    if (!out.region.length) return null;
    const b = bb(out.region), y0 = out.mid - Math.ceil((out.mid - b.y0) / p) * p, x0 = b.x0;
    const nx = Math.ceil((b.x1 - x0) / p) + 1, ny = Math.ceil((b.y1 - y0) / p) + 1, cells = new Map();
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const cx = x0 + i * p, cy = y0 + j * p;
      if (inside([cx, cy], out.region)) cells.set(`${i},${j}`, { i, j, cx, cy });
    }
    if (o.keyring) addKeyring(cells, o, x0, y0, p);
    const keep = connected(cells, (a2, b2) => true, warnings);
    const pieces = [];
    // links take the letter color only well inside a letter, so the narrow gaps (inside an m, the hole of an a) stay
    // open in the base color and each letter keeps its shape
    const Lc = { list: L.list.map(g => { const t = Off(g.polys, -o.pitch * 0.5); return { i: g.i, polys: t.length ? t : g.polys }; }) };
    for (const c of keep) pieces.push({ i: c.i, j: c.j, cx: c.cx, cy: c.cy, key: !!c.key, layers: ringLayers(c.cx, c.cy, o), letter: letterAt([c.cx, c.cy], Lc) });
    return { pieces, region: out.region, letters: out.all };
  }
  function addKeyring(cells, o, x0, y0, p) {
    // one more link (or tile) left of the leftmost one on the middle row
    const rows = [...cells.values()], jm = Math.round((o.letterH * 0.47 - y0) / p);
    const row = rows.filter(c => c.j === jm); if (!row.length) return;
    const i = Math.min(...row.map(c => c.i)) - 1;
    cells.set(`${i},${jm}`, { i, j: jm, cx: x0 + i * p, cy: y0 + jm * p, key: true });
  }
  // keep the biggest group of 4-neighbor connected cells (a cell joins only through a valid joint)
  function connected(cells, ok, warnings) {
    const seen = new Set(), groups = [];
    for (const [k, c] of cells) {
      if (seen.has(k)) continue;
      const g = [], st = [k]; seen.add(k);
      while (st.length) {
        const kk = st.pop(), cc = cells.get(kk); g.push(cc);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = `${cc.i + di},${cc.j + dj}`, nc = cells.get(nk);
          if (!nc || seen.has(nk)) continue;
          const a = di + dj > 0 ? cc : nc, b2 = di + dj > 0 ? nc : cc;
          if (!ok(a, b2, di !== 0 ? 'x' : 'y')) continue;
          seen.add(nk); st.push(nk);
        }
      }
      groups.push(g);
    }
    groups.sort((a, b) => b.length - a.length);
    const dropped = groups.slice(1).reduce((s, g) => s + g.length, 0);
    const kept = groups[0] || [];
    if (dropped && warnings) warnings.push(dropped > 0.12 * (kept.length + dropped)
      ? `${dropped} pieces could not be joined and were left out, so parts of the letters are missing. Make the letters bigger or the ${'links'} smaller.`
      : `${dropped} small edge ${dropped === 1 ? 'piece' : 'pieces'} without room for a joint ${dropped === 1 ? 'was' : 'were'} left out so the name stays one connected piece.`);
    return kept;
  }
  function letterAt(pt, L) { for (const g of L.list) if (inside(pt, g.polys)) return g.i; return -1; }

  // ---------------------------------------------------------------- articulated tiles
  function tileSpec(o) {
    const p = o.pitch, c = o.clearance, h = p / 2 - c / 2;
    // wiggle tiles: a little play so the mat wiggles and bends; sliding grid: long slots so every joint also slides
    const slide = o.style === 'grid';
    const pr = clamp(p * 0.1, 0.75, 1.3), aw = pr, lip = clamp(p * 0.11, 0.8, 1.4), off = p * (slide ? 0.2 : 0.18), e = slide ? clamp(p * 0.15, 1, 1.8) : clamp(p * 0.06, 0.4, 0.8);
    const f = 1.0, k = 1.2, capZ = f + 2 * c + k, top = Math.max(capZ + 1.6, o.thickness);
    const px = -h + lip + pr + c + e / 2; // peg rest position from the receiving tile center (along the joint)
    return { p, c, h, pr, aw, lip, off, e, f, k, capZ, top, px };
  }
  // in the receiving tile's own frame (center 0,0), joint coming in from -x at y = +off
  function slotX(S) {
    const peg = stadium(S.px - S.e / 2, S.off, S.px + S.e / 2, S.pr);
    const arm = rect(-S.h - S.c - 1, S.off - S.aw, S.px, S.off + S.aw);
    return { peg, keepFloor: Off([peg], S.c), keepMid: Off(U([peg, arm]), S.c), need: rect(-S.h, S.off - S.aw - S.c - 0.7, S.px + S.e / 2 + S.pr + S.c + 0.7, S.off + S.aw + S.c + 0.7) };
  }
  function jointShapes(S) {
    const sx = slotX(S), sy = { keepFloor: swapXY(sx.keepFloor), keepMid: swapXY(sx.keepMid), need: swapXY([sx.need]) };
    return { x: { keepFloor: sx.keepFloor, keepMid: sx.keepMid, need: [sx.need] }, y: sy };
  }
  function tiles(o, L, warnings) {
    const S = tileSpec(o), p = S.p, out = outline(L, o, p * 0.28, p * 0.75);
    if (!out.region.length) return null;
    const J = jointShapes(S);
    let b = bb(out.region), y0 = out.mid - Math.ceil((out.mid - b.y0) / p) * p, x0 = b.x0 + p / 2;
    if (o.shape === 'plate') {
      // the plate is a whole number of blocks, centered on the name, so every edge block is a full block (only the
      // four corners are rounded) and no slivers get dropped
      const lb = out.b, m = Math.max(p * 0.6, o.letterH * 0.1), nX = Math.ceil((lb.x1 - lb.x0 + 2 * m) / p), nY = Math.ceil((lb.y1 - lb.y0 + 2 * m) / p);
      const X0 = (lb.x0 + lb.x1) / 2 - nX * p / 2, Y0 = (lb.y0 + lb.y1) / 2 - nY * p / 2;
      const X1 = X0 + nX * p, Y1 = Y0 + nY * p, k = p * 0.4; // softened (cut) corners: few clean vertices
      out.region = [P([[X0 + k, Y0], [X1 - k, Y0], [X1, Y0 + k], [X1, Y1 - k], [X1 - k, Y1], [X0 + k, Y1], [X0, Y1 - k], [X0, Y0 + k]])];
      b = bb(out.region); x0 = X0 + p / 2; y0 = Y0 + p / 2;
    }
    const nx = Math.ceil((b.x1 - x0) / p) + 1, ny = Math.ceil((b.y1 - y0) / p) + 1, cells = new Map();
    for (let j = -1; j <= ny; j++) for (let i = -1; i <= nx; i++) {
      const cx = x0 + i * p, cy = y0 + j * p, sq = rect(cx - S.h, cy - S.h, cx + S.h, cy + S.h);
      let body = largest(I([sq], out.region)); if (!body.length || area(body) < 0.3 * p * p) continue;
      body = simplify(Off(Off(body, -0.3), 0.3), 0.03); if (!body.length) continue; // no slivers thinner than a nozzle line
      cells.set(`${i},${j}`, { i, j, cx, cy, body: largest(body) });
    }
    if (o.keyring) {
      addKeyring(cells, o, x0, y0, p);
      for (const c of cells.values()) if (c.key && !c.body) { c.body = D([P(T.roundRect(c.cx - S.h, c.cy - S.h, c.cx + S.h, c.cy + S.h, S.h * 0.8))], [circ(c.cx, c.cy, Math.min(2.2, S.h * 0.55))]); }
    }
    // a joint needs room for the pocket in the receiver and for the arm root in the sender
    const memo = new Map();
    const okJ = (a, r, ax) => { const key = `${a.i},${a.j},${ax}`; if (!memo.has(key)) memo.set(key, okJ0(a, r, ax)); return memo.get(key); };
    const okJ0 = (a, r, ax) => {
      const need = move(ax === 'x' ? J.x.need : J.y.need, r.cx, r.cy);
      if (area(D(need, r.body)) > 0.05) return false;
      const root = ax === 'x' ? rect(a.cx + S.h - 1.4, a.cy + S.off - S.aw - 0.4, a.cx + S.h, a.cy + S.off + S.aw + 0.4) : rect(a.cx + S.off - S.aw - 0.4, a.cy + S.h - 1.4, a.cx + S.off + S.aw + 0.4, a.cy + S.h);
      return area(D([root], a.body)) < 0.05;
    };
    const keep = connected(cells, okJ, warnings), have = new Map(keep.map(c => [`${c.i},${c.j}`, c]));
    const pieces = [];
    for (const c of keep) {
      const inX = have.get(`${c.i - 1},${c.j}`), inY = have.get(`${c.i},${c.j - 1}`), outX = have.get(`${c.i + 1},${c.j}`), outY = have.get(`${c.i},${c.j + 1}`);
      const jIn = [], jOut = [];
      if (inX && okJ(inX, c, 'x')) jIn.push('x'); if (inY && okJ(inY, c, 'y')) jIn.push('y');
      if (outX && okJ(c, outX, 'x')) jOut.push(['x', outX]); if (outY && okJ(c, outY, 'y')) jOut.push(['y', outY]);
      const keepF = U(jIn.flatMap(ax => move(J[ax].keepFloor, c.cx, c.cy)));
      const keepM = U(jIn.flatMap(ax => move(J[ax].keepMid, c.cx, c.cy)));
      const pegs = [], arms = [];
      for (const [ax, n] of jOut) {
        if (ax === 'x') { pegs.push(circ(n.cx + S.px, n.cy + S.off, S.pr, 20)); arms.push(rect(c.cx + S.h - 1.2, c.cy + S.off - S.aw, n.cx + S.px, c.cy + S.off + S.aw)); }
        else { pegs.push(circ(n.cx + S.off, n.cy + S.px, S.pr, 20)); arms.push(rect(c.cx + S.off - S.aw, c.cy + S.h - 1.2, c.cx + S.off + S.aw, n.cy + S.px)); }
      }
      const body = c.body, floor = keepF.length ? D(body, keepF) : body, mid = keepM.length ? D(body, keepM) : body;
      const layers = [
        { polys: U(floor.concat(pegs)), z0: 0, z1: S.f },
        { polys: U(mid.concat(pegs)), z0: S.f, z1: S.f + S.c },
        { polys: U(mid.concat(pegs, arms)), z0: S.f + S.c, z1: S.f + S.c + S.k },
        { polys: mid, z0: S.f + S.c + S.k, z1: S.capZ }
      ];
      const inlay = o.colorMode !== 'one' && o.colorMode !== 'checker' && !c.key && (o.colorMode === 'rainbow' || o.colors.letters !== o.colors.base);
      let piece;
      if (inlay) {
        // letters in a second color: the block top is flat and split along the TRUE letter outlines, so each letter
        // runs edge to edge across the blocks and reads at a glance (only the thin seams cross it). The cap above the
        // joints has rounded corners so the blocks still look like soft tiles.
        const rc = clamp(p * (o.style === 'grid' ? 0.07 : 0.2), 0.4, 2.2), cap = c.key ? body : I(body, [P(T.roundRect(c.cx - S.h, c.cy - S.h, c.cx + S.h, c.cy + S.h, rc))]);
        const capP = cap.length ? cap : body, zc = S.top - 1.0, big = q => Math.abs(T.polysArea([q])) > 0.25;
        layers.push({ polys: capP, z0: S.capZ, z1: S.top });
        // letters stop a hair inside the block edge (never tangent to it) and near-touching bits are merged, so the
        // two colors meet in clean outlines with no pinch points
        const lettersTop = Off(Off(Off(Off(I(Off(capP, -0.25), out.all), -0.08), 0.16), -0.08), 0).filter(big);
        piece = { i: c.i, j: c.j, cx: c.cx, cy: c.cy, key: !!c.key, layers, letter: letterAt([c.cx, c.cy], L) };
        if (lettersTop.length) {
          const rest = D(capP, lettersTop);
          piece.body = layers.slice(0, -1).concat([{ polys: capP, z0: S.capZ, z1: zc }]).concat(rest.length ? [{ polys: rest, z0: zc, z1: S.top }] : []);
          piece.inlay = { layers: [{ polys: lettersTop, z0: zc, z1: S.top }], byLetter: L.list.map(g => { const q = I(lettersTop, g.polys).filter(big); return q.length ? [{ polys: q, z0: zc, z1: S.top }] : []; }) };
        }
      } else {
        const capTop = S.top, round = o.top === 'dome' ? Math.min(1.4, (capTop - S.capZ) * 0.5) : Math.min(0.4, (capTop - S.capZ) * 0.3);
        const steps = o.top === 'dome' ? 4 : 1, zr = capTop - round;
        layers.push({ polys: body, z0: S.capZ, z1: zr });
        for (let s = 1; s <= steps; s++) { // rounded top edge: quarter circle in steps
          const ang = s / steps * Math.PI / 2, inset = round * (1 - Math.cos(ang - Math.PI / (2 * steps) * 0.5)) + 0.05;
          const z0 = zr + round * Math.sin((s - 1) / steps * Math.PI / 2), z1 = zr + round * Math.sin(ang);
          const q = Off(body, -inset); if (q.length) layers.push({ polys: q, z0, z1 });
        }
        piece = { i: c.i, j: c.j, cx: c.cx, cy: c.cy, key: !!c.key, layers, letter: letterAt([c.cx, c.cy], L) };
      }
      pieces.push(piece);
    }
    return { pieces, region: out.region, letters: out.all, spec: S };
  }

  // ---------------------------------------------------------------- slinky
  function slinky(o, L, warnings) {
    // the name itself is the solid center (readable, counters kept); the coils are outlines grown outward from it,
    // each one gap away from the last, so every coil is one closed loop whatever the font
    const h = o.letterH, step = o.wall + o.gap;
    const all = U(L.list.flatMap(g => g.polys)); if (!all.length) return null;
    const b0 = bb(all), mid = h * 0.47;
    const band = rect(b0.x0 + h * 0.15, mid - h * 0.07, b0.x1 - h * 0.15, mid + h * 0.07);
    const fat = Off(all, 0.6);
    let name = U(fat.concat([band]));
    // loose bits (the dot on an i or j, a letter above the band) get a short post down or up to the band
    if (name.length > 1) {
      const main = largest(name)[0], posts = [];
      for (const Q of name) if (Q !== main) { const bq = bb([Q]), cx = (bq.x0 + bq.x1) / 2, w = clamp((bq.x1 - bq.x0) * 0.45, 1.6, 4); posts.push(rect(cx - w / 2, Math.min(mid, (bq.y0 + bq.y1) / 2), cx + w / 2, Math.max(mid, (bq.y0 + bq.y1) / 2))); }
      name = U(name.concat(posts));
    }
    const pieces = name.length; name = largest(name);
    if (pieces > 1) warnings.push('Some letters do not touch the rest of the name and were left out of the center. Use a bolder font or fewer spaces.');
    name = simplify(name, 0.03);
    const base = noHoles(name);
    const grow = d => largest(noHoles(Off(base, d)));
    const rings = []; // innermost first
    for (let k = 1; k <= o.coils; k++) rings.push(D(grow(k * step), grow(k * step - o.wall)));
    if (o.keyring) { // a loop on the outer coil, left end
      const O = grow(o.coils * step), bo = bb(O), r = 5.5, cx = bo.x0 - r + o.wall * 0.8, cy = mid;
      const last = rings.length - 1;
      rings[last] = D(U(rings[last].concat([circ(cx, cy, r, 40)])), [circ(cx, cy, 2.6, 28)].concat(grow((o.coils - 1) * step + o.gap)));
    }
    // bridges: from each loop's leftmost (or rightmost) point straight out across one gap into the next coil
    const bounds = [base].concat(rings.map((_, k) => grow((k + 1) * step)));
    const tw = Math.max(1.6, o.wall * 0.9), tabs = [];
    for (let k = 0; k < rings.length; k++) {
      const left = k % 2 === 0, B = bounds[k];
      let P0 = null;
      for (const Q of B) for (const v of Q.outer) if (!P0 || (left ? v[0] < P0[0] - 1e-6 : v[0] > P0[0] + 1e-6) || (Math.abs(v[0] - P0[0]) <= 1e-6 && Math.abs(v[1] - mid) < Math.abs(P0[1] - mid))) P0 = v;
      const reach = o.gap + o.wall * 0.6, into = Math.min(o.wall, 2) * 0.6;
      const strip = left ? rect(P0[0] - reach, P0[1] - tw / 2, P0[0] + into, P0[1] + tw / 2) : rect(P0[0] - into, P0[1] - tw / 2, P0[0] + reach, P0[1] + tw / 2);
      let tab = I([strip], bounds[k + 1]);
      if (tab.length > 1) tab = [tab.reduce((x, y) => area([y]) > area([x]) ? y : x)];
      tabs.push(tab);
    }
    // outer coil first (it stays on the table when stretched), the name last
    const order = rings.slice().reverse().concat([name]);
    const tabsOut = tabs.slice().reverse(); // tabsOut[k] joins order[k] and order[k + 1]
    return { rings: order, tabs: tabsOut, name, fat, region: bounds[bounds.length - 1], letters: all, mid, coils: rings.length };
  }

  // ---------------------------------------------------------------- build
  function colorOf(o, piece) {
    if (o.colorMode === 'one') return o.colors.base;
    if (o.colorMode === 'checker') return (piece.i + piece.j) % 2 ? o.colors.alt : o.colors.base;
    if (piece.letter < 0) return o.colors.base;
    if (o.colorMode === 'rainbow') return RAINBOW[piece.letter % RAINBOW.length];
    return o.colors.letters;
  }
  function usable(o) { return [Math.max(60, o.bed[0] - 8), Math.max(60, o.bed[1] - 8)]; }
  function core(o, warnings) {
    const L = letters(o);
    if (L.skipped.length) warnings.push(`Skipped ${[...new Set(L.skipped)].map(c => `"${c}"`).join(', ')}: not in this font.`);
    if (!L.list.length) return { L, g: null };
    const g = o.style === 'chainmail' ? chainmail(o, L, warnings) : o.style === 'tiles' || o.style === 'grid' ? tiles(o, L, warnings) : slinky(o, L, warnings);
    return { L, g };
  }
  function build(raw) {
    let o = options(raw);
    const warnings = [];
    if (o.barClamped) warnings.push(`Bars are ${o.bar} mm so every gap between links stays at least ${o.clearance} mm with ${o.pitch} mm links.`);
    // fit the build plate: shrink the letters until the whole piece fits (it is one piece, so it is never cut)
    const [UW, UD] = usable(o), BIG = Math.max(UW, UD), SMALL = Math.min(UW, UD);
    const mOf = o => (o.style === 'chainmail' ? o.pitch * 1.5 : o.style === 'tiles' || o.style === 'grid' ? o.pitch : o.coils * (o.wall + o.gap) + (o.keyring ? 8 : 0) + 1) + (o.shape === 'plate' && o.style !== 'slinky' ? Math.max(o.pitch * 0.9, o.letterH * 0.16) : 0);
    const fits = (w, d) => Math.max(w, d) <= BIG && Math.min(w, d) <= SMALL;
    // estimate from the letters alone first (cheap), then check the real piece
    const fitLoop = () => {
      for (let it = 0; it < 6; it++) {
        const Lq = letters(o); if (!Lq.list.length) return true;
        const b = bb(U(Lq.list.flatMap(g => g.polys))), m = mOf(o), w = b.w + 2 * m + 6, d = b.h + 2 * m + 6;
        if (fits(w, d)) return true;
        if (o.letterH <= 20) return false;
        const s = Math.min(BIG / Math.max(w, d), SMALL / Math.min(w, d)) * 0.98;
        o = options(Object.assign({}, raw, { letterH: Math.max(20, Math.floor(o.letterH * s)) }));
      }
      return false;
    };
    if (!fitLoop() && o.shape === 'plate' && o.style !== 'slinky') {
      // a long name on a small bed: drop the plate border and follow the letters instead
      raw = Object.assign({}, raw, { shape: 'name' }); o = options(raw); fitLoop();
      warnings.push('Used the name outline instead of the rounded plate so the long name fits your bed.');
    }
    if (o.letterH < options(raw).letterH) warnings.push(`Letters set to ${o.letterH} mm tall so the whole name fits your ${o.bed[0]}\u00d7${o.bed[1]} mm bed in one piece.`);
    const w2 = [], { L, g } = core(o, w2); warnings.push(...w2);
    if (!g || (g.pieces && !g.pieces.length) || (g.rings && !g.rings.length)) return empty(o, warnings.concat([L.list.length ? 'These letters are too thin for this style. Make them bigger.' : 'Type a name to start.']));
    return o.style === 'slinky' ? finishSlinky(o, g, L, warnings) : finishLinks(o, g, L, warnings);
  }
  function empty(o, warnings) { return { parts: [], options: o, warnings, filaments: [], stats: { style: o.style, pieces: 0, tris: 0, colors: 0, links: 0, sizeX: 0, sizeY: 0, sizeZ: 0, letterH: o.letterH }, plate: new Float64Array(0), stretched: null }; }

  // group meshes by color: one part per filament (many separate shells in it for links and tiles)
  function finishLinks(o, g, L, warnings) {
    const byColor = new Map(), add = (c, p) => { if (!p || !p.length) return; if (!byColor.has(c)) byColor.set(c, []); byColor.get(c).push(p); };
    let open = 0;
    // every chain link is the same: build it once at the origin (clipper's grid is exact there) and move copies
    const linkAt0 = o.style === 'chainmail' ? solidOf(ringLayers(0, 0, o)) : null;
    for (const pc of g.pieces) {
      const m = linkAt0 ? moveP(linkAt0, pc.cx, pc.cy, 0) : solidOf(pc.body || pc.layers); if (!Core.checkClosed(m).closed) open++;
      const inlaid = (o.style === 'tiles' || o.style === 'grid') && o.colorMode !== 'one' && o.colorMode !== 'checker' && !pc.key;
      pc.mesh = m; add(inlaid ? o.colors.base : colorOf(o, pc), m);
      if (pc.inlay) {
        if (o.colorMode === 'rainbow') pc.inlay.byLetter.forEach((ls, li) => { if (ls.length) add(RAINBOW[li % RAINBOW.length], solidOf(ls)); });
        else add(o.colors.letters, solidOf(pc.inlay.layers));
      }
    }
    if (open) warnings.push(`${open} piece${open === 1 ? '' : 's'} may have open edges.`);
    const label = o.style === 'chainmail' ? 'links' : 'tiles';
    const parts = [...byColor.entries()].map(([color, list], i) => ({ name: byColor.size === 1 ? `Flex name` : `Flex name color ${i + 1}`, kind: 'flex', color, p: T.concat(list) }));
    centerParts(parts);
    const all = T.concat(parts.map(x => x.p)), b = Core.bbox(all);
    const stats = { style: o.style, name: o.name, font: o.font, letterH: o.letterH, pitch: o.pitch, clearance: o.clearance, bar: o.bar, thickness: g.spec ? g.spec.top : o.thickness,
      links: g.pieces.length, label, pieces: parts.length, colors: byColor.size, tris: all.length / 9, keyring: g.pieces.some(x => x.key),
      sizeX: b.max[0] - b.min[0], sizeY: b.max[1] - b.min[1], sizeZ: b.max[2] - b.min[2] };
    return { parts, options: o, warnings, filaments: parts.map(x => ({ role: x.name, color: x.color })), stats, plate: all, pieces: g.pieces, spec: g.spec || null, stretched: null };
  }
  function finishSlinky(o, g, L, warnings) {
    const H = o.layer, n = g.rings.length;
    // colors: the name in the letter color; coils in the base color (one color: all base; rainbow: coils cycle)
    const colorAt = k => k === n - 1 ? (o.colorMode === 'one' ? o.colors.base : o.colors.letters) : o.colorMode === 'rainbow' ? RAINBOW[k % RAINBOW.length] : o.colors.base;
    // one closed solid for the whole spring (coils, bridges and name unioned in 2D)
    const flat = U(g.rings.flat().concat(g.tabs.flat()));
    const single = solidOf([{ polys: flat, z0: 0, z1: H }]);
    const byColor = new Map();
    const put = (c, polys) => { if (!polys.length) return; if (!byColor.has(c)) byColor.set(c, []); byColor.get(c).push(polys); };
    g.rings.forEach((r, k) => {
      if (k === n - 1 && o.colorMode !== 'one') { // the name: letters in their color, the joining band in the coil color
        const tabIn = g.tabs[n - 2] || [], lettersR = D(I(r, g.fat), tabIn);
        put(colorAt(k), lettersR); put(o.colorMode === 'rainbow' ? colorAt(n - 2) : o.colors.base, Off(Off(D(r, g.fat), -0.08), 0.08).filter(q => Math.abs(T.polysArea([q])) > 0.3)); /* opening drops hairline slivers along the letter edges */
        return;
      }
      put(colorAt(k), U(r.concat(g.tabs[k] || [])));
    });
    // per color: one solid of all its coils (they never touch except through bridges of the same coil)
    let parts = byColor.size === 1 ? [{ name: 'Slinky name', kind: 'flex', color: colorAt(0), p: single }]
      : [...byColor.entries()].map(([color, list], i) => ({ name: `Slinky name color ${i + 1}`, kind: 'flex', color, p: solidOf([{ polys: U(list.flat()), z0: 0, z1: H }]) }));
    const off = centerParts(parts);
    // stretched preview: coil k lifted k steps, each bridge drawn as a post up to the next coil
    const lift = Math.max(5, H * 3.2), st = [];
    g.rings.forEach((r, k) => {
      const c = colorAt(k);
      if (k === n - 1 && o.colorMode !== 'one') { st.push({ color: c, p: moveP(solidOf([{ polys: I(r, g.fat), z0: k * lift, z1: k * lift + H }]), off[0], off[1], 0) }); const rest = D(r, g.fat); if (rest.length) st.push({ color: o.colors.base, p: moveP(solidOf([{ polys: rest, z0: k * lift, z1: k * lift + H }]), off[0], off[1], 0) }); }
      else st.push({ color: c, p: moveP(solidOf([{ polys: r, z0: k * lift, z1: k * lift + H }]), off[0], off[1], 0) });
      if (g.tabs[k] && g.tabs[k].length) st.push({ color: c, p: moveP(solidOf([{ polys: g.tabs[k], z0: k * lift, z1: (k + 1) * lift + H }]), off[0], off[1], 0) });
    });
    const all = T.concat(parts.map(x => x.p)), b = Core.bbox(all);
    if (!Core.checkClosed(single).closed) warnings.push('The spring may have open edges.');
    const stats = { style: 'slinky', name: o.name, font: o.font, letterH: o.letterH, coils: g.coils, core: true, wall: o.wall, gap: o.gap, layer: H,
      links: g.coils, label: 'coils', pieces: parts.length, colors: byColor.size, tris: all.length / 9, keyring: !!o.keyring, stretchH: (n - 1) * lift + H,
      sizeX: b.max[0] - b.min[0], sizeY: b.max[1] - b.min[1], sizeZ: b.max[2] - b.min[2] };
    return { parts, options: o, warnings, filaments: parts.map(x => ({ role: x.name, color: x.color })), stats, plate: all, single: moveP(single, off[0], off[1], 0), rings: g.rings, tabs: g.tabs,
      stretched: st };
  }
  function moveP(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + dz; } return q; }
  // put the piece at the middle of the bed (x, y \u2265 0), z on the bed
  function centerParts(parts) {
    const b = Core.bbox(T.concat(parts.map(x => x.p))), dx = -b.min[0], dy = -b.min[1], dz = -b.min[2];
    for (const x of parts) x.p = moveP(x.p, dx, dy, dz);
    return [dx, dy];
  }

  // ---------------------------------------------------------------- checks (tests and the fit note)
  // any two different pieces: where their layers are closer than the clearance in height, their outlines must be at
  // least the clearance apart side to side (tested with each grown by just under half the clearance)
  function clearanceCheck(res, tol) {
    const pcs = res.pieces || [], c = res.options.clearance, g = c * 0.5 * (tol == null ? 0.96 : tol), bad = [];
    const grid = new Map(); pcs.forEach((pc, k) => { const key = `${pc.i},${pc.j}`; grid.set(key, k); });
    for (let a = 0; a < pcs.length; a++) {
      const A = pcs[a];
      for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
        const k = grid.get(`${A.i + di},${A.j + dj}`); if (k == null || k <= a) continue;
        const B = pcs[k];
        for (const la of A.layers) for (const lb of B.layers) {
          if (la.z1 + c * 0.9 <= lb.z0 || lb.z1 + c * 0.9 <= la.z0) continue;
          const hit = I(Off(la.polys, g), Off(lb.polys, g));
          if (hit.length && area(hit) > 1e-4) { bad.push({ a: [A.i, A.j], b: [B.i, B.j], z: [la.z0, la.z1, lb.z0, lb.z1], area: area(hit) }); break; }
        }
      }
    }
    return bad;
  }
  // which pieces are trapped together (the links or joints that hold): pairs of 4-neighbors
  function links(res) {
    const pcs = res.pieces || [], have = new Set(pcs.map(p => `${p.i},${p.j}`)); let n = 0;
    for (const p of pcs) { if (have.has(`${p.i + 1},${p.j}`)) n++; if (have.has(`${p.i},${p.j + 1}`)) n++; }
    return n;
  }

  // ---------------------------------------------------------------- previews
  // drape: bend the flat piece over a round form along x (preview only; exports stay flat)
  function drape(p, R, cx, z0, keepZ) {
    const q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      const th = (p[i] - cx) / R, r = R + (p[i + 2] - (z0 || 0));
      q[i] = cx + r * Math.sin(th); q[i + 1] = p[i + 1]; q[i + 2] = r * Math.cos(th) - R + (z0 || 0) + R * (1 - Math.cos(Math.min(Math.PI / 2, Math.abs((p[i] - cx) / R)))) * 0;
    }
    if (keepZ) return q;
    // lift so the lowest point sits on the bed
    let mz = Infinity; for (let i = 2; i < q.length; i += 3) mz = Math.min(mz, q[i]);
    for (let i = 2; i < q.length; i += 3) q[i] -= mz;
    return q;
  }

  // ---------------------------------------------------------------- export
  function export3MF(res, o) {
    o = o || {};
    const cols = res.parts.map(x => x.color.toUpperCase()).filter((c, i, a) => a.indexOf(c) === i);
    const [UW, UD] = usable(res.options), b = Core.bbox(res.plate), dx = 4 + (UW - (b.max[0] - b.min[0])) / 2, dy = 4 + (UD - (b.max[1] - b.min[1])) / 2;
    const parts = res.parts.map(x => ({ name: x.name, p: moveP(x.p, dx, dy, 0), color: x.color, extruder: cols.indexOf(x.color.toUpperCase()) + 1 }));
    const obj = parts.length > 1 ? { name: o.name || 'Flex name', parts } : Object.assign({}, parts[0], { name: o.name || 'Flex name' });
    return T.threeMF([obj], { title: o.name || 'Flex name', plates: [[0]], bambu: o.bambu === undefined ? 'A1' : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const s = res.stats, o = res.options, L = [];
    if (s.style === 'slinky') {
      L.push('Expressarte slinky name', `Name: ${s.name}  (${FONTS[s.font].label}, ${s.letterH} mm tall)`, `${s.coils} coils around the name, wall ${s.wall} mm, gap ${s.gap} mm, ${s.layer} mm thick`, '', 'Printing',
        '  - Print flat as it comes, no supports, no brim needed. 0.2 mm layers.',
        '  - PLA works; PETG is springier and less likely to snap. Use 100% infill or 3+ walls so the coils are solid.',
        '  - The name is the solid center (letters joined by a thin band); each coil is the name outline grown outward, so the coils round off the farther out they go.',
        '  - After printing, hold the outer coil and lift the name in the middle: the coils stretch into a spring tower. Pull gently the first time.',
        '  - Very thin gaps can fuse on an over-extruding printer; if the coils stick, raise the gap to 1 mm.');
    } else {
      const S = res.spec;
      L.push(`Expressarte flex name (${STYLES[s.style]})`, `Name: ${s.name}  (${FONTS[s.font].label}, ${s.letterH} mm tall)`, `${s.links} ${s.label}, ${s.pitch} mm grid, ${s.clearance} mm clearance, ${(+s.thickness).toFixed(1)} mm thick`, '', 'Printing',
        '  - Print flat as it comes. No supports. First layer must be flat and not squished (no elephant foot), or the bottom parts fuse.',
        '  - 0.2 mm layers (0.16 for small links), 0.4 mm nozzle, 2 walls, 15% infill or more.',
        s.style === 'chainmail' ? '  - The top bars bridge between corner posts; keep bridge speed and cooling at your normal values.' : '  - Each block\'s roof bridges over its joint slots; normal bridge settings work.',
        `  - When it comes off the bed, flex it gently in both directions to free every ${s.style === 'chainmail' ? 'link' : 'joint'}.`,
        '  - If parts are fused on your printer, rebuild with a bigger clearance (+0.05 mm) and print a small name as a test.');
      if (S) L.push('', `Block joints: ${S.c} mm clearance all round, peg \u00d8${(S.pr * 2).toFixed(1)} mm in a slot with ${S.e.toFixed(1)} mm of ${s.style === 'grid' ? 'slide' : 'play'}.`);
    }
    if (res.filaments.length > 1) { L.push('', 'Filaments'); res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}`)); }
    if (res.warnings.length) L.push('', ...res.warnings.map(w => '  - ' + w));
    void o;
    return L.join('\n');
  }
  function files(res, o) {
    o = o || {};
    const base = o.fileBase || 'flex_name', out = [];
    const all = res.single || res.plate;
    out.push({ name: `${base}.stl`, data: new Uint8Array(Core.writeSTL(all, base)) });
    if (res.parts.length > 1) res.parts.forEach((x, i) => out.push({ name: `${base}_color_${i + 1}.stl`, data: new Uint8Array(Core.writeSTL(x.p, x.name)) }));
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }
  function gateInfo(raw) {
    const o = options(raw), why = [];
    if (FONTS[o.font].pro) why.push(`${FONTS[o.font].label} font (Pro)`);
    const n = o.colorMode === 'one' ? 1 : o.colorMode === 'two' ? 2 : o.colorMode === 'checker' ? 3 : Math.min(RAINBOW.length, chars(o.name).length) + 1;
    if (n > LIMITS.freeColors) why.push(`${n} colors (free: up to ${LIMITS.freeColors})`);
    if (o.keyring && o.style !== 'slinky') { /* keyring is free */ }
    return why;
  }
  function colorCount(raw) { const o = options(raw); return o.colorMode === 'one' ? 1 : o.colorMode === 'two' ? 2 : o.colorMode === 'checker' ? 3 : Math.min(RAINBOW.length, chars(o.name).length) + 1; }

  const api = { STYLES, FONTS, SHAPES, TOPS, COLOR_MODES, PALETTE, RAINBOW, LIMITS, DEFAULTS, PER_STYLE, options, build, export3MF, files, notes, gateInfo, colorCount, clearanceCheck, links, drape, tileSpec, ringLayers };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPFlexName = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
