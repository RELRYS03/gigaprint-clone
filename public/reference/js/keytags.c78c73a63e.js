/* Expressarte batch keychains and pet tags: a list of names, shared shape/font/ring, auto-laid on the build plate
   (or several plates), two-color 3MF. Free up to 2 tags; Pro for bigger batches. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);

  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    names: 'Max\nBella', shape: 'bone', font: 'round', textH: 10, tagW: 50, tagH: 28,
    baseT: 2.0, raise: 0.8, ring: 5, corner: 6,
    colors: { base: PZ.butter, text: '#1A1A1A' },
    bed: [256, 256], bambu: 'A1', detail: 'hd', gap: 4
  };
  const LIMITS = { freeCount: 2, maxTags: 60, maxChars: 20 };
  const SHAPES = {
    bone: { label: 'Bone' }, oval: { label: 'Oval' }, circle: { label: 'Circle' },
    rounded: { label: 'Rounded tag' }, heart: { label: 'Heart' }, shield: { label: 'Shield' }
  };
  const PALETTE = [
    { name: 'White', hex: '#F7F7F2' }, { name: 'Black', hex: '#1A1A1A' }, { name: 'Red', hex: '#C8102E' },
    { name: 'Sky', hex: '#4A90D9' }, { name: 'Forest', hex: '#1E7B46' }, { name: 'Gold', hex: '#D4A72C' },
    { name: 'Orange', hex: '#E07A3A' }, { name: 'Pink', hex: '#E891B0' }
  ];

  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    o.textH = Math.max(6, Math.min(24, +o.textH || DEFAULTS.textH));
    o.tagW = Math.max(25, Math.min(90, +o.tagW || DEFAULTS.tagW));
    o.tagH = Math.max(16, Math.min(60, +o.tagH || DEFAULTS.tagH));
    o.baseT = Math.max(1.2, Math.min(5, +o.baseT || DEFAULTS.baseT));
    o.raise = Math.max(0.4, Math.min(2, +o.raise || DEFAULTS.raise));
    o.ring = Math.max(3, Math.min(10, +o.ring || DEFAULTS.ring));
    o.colors = Object.assign({}, DEFAULTS.colors, o.colors || {});
    if (!SHAPES[o.shape]) o.shape = 'bone';
    if (!Bubble.FONTS[o.font]) o.font = 'round';
    return o;
  }
  function parseNames(text) {
    return String(text || '').split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, LIMITS.maxTags).map(s => [...s].slice(0, LIMITS.maxChars).join('').trim());
  }
  const MARGIN = 1.6;          // clear space between the text and the tag edge / ring bail (mm)
  const MIN_LETTER = 3.5;      // letters shorter than this still print, with a note
  function ptIn(pt, L) {
    let c = false; const x = pt[0], y = pt[1];
    for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
      const a = L[i], b = L[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  const inPolys = (pt, polys) => polys.some(P => ptIn(pt, P.outer) && !P.holes.some(h => ptIn(pt, h)));
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // a smooth, symmetric heart: two round lobes, a clean V notch on top and a pointed tip, sized inside w \u00d7 h
  // (kept close to a true heart's proportions so a wide tag box doesn't squash it flat)
  function heartLoop(w, h, n) {
    n = n || 192; const raw = [];
    for (let i = 0; i < n; i++) {
      const t = Math.PI * 2 * i / n;
      raw.push([16 * Math.pow(Math.sin(t), 3), 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]);
    }
    let y0 = Infinity, y1 = -Infinity; for (const q of raw) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const natural = 32 / (y1 - y0), lo = natural * 0.82, hi = natural * 1.3;
    let W = w, H = h; const a = w / h;
    if (a > hi) W = h * hi; else if (a < lo) H = w / lo;
    const sx = W / 32, sy = H / (y1 - y0), cy = (y0 + y1) / 2;
    const L = raw.map(q => [q[0] * sx, (q[1] - cy) * sy]);
    return area(L) < 0 ? L.reverse() : L;
  }
  function area(L) { let s = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) s += L[j][0] * L[i][1] - L[i][0] * L[j][1]; return s / 2; }
  function tagOutline(o) {
    const w = o.tagW, h = o.tagH, x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
    if (o.shape === 'circle') return [{ outer: T.circle(0, 0, Math.min(w, h) / 2, 96), holes: [] }];
    if (o.shape === 'oval') {
      const rx = w / 2, ry = h / 2, L = []; for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; L.push([rx * Math.cos(a), ry * Math.sin(a)]); }
      return [{ outer: L, holes: [] }];
    }
    if (o.shape === 'heart') return [{ outer: heartLoop(w, h), holes: [] }];
    if (o.shape === 'shield') { // flat top, pointed base, softly rounded corners
      const r = Math.min(2, w * 0.05);
      return T.offset(T.offset([{ outer: [[x0, y1], [x0, 0], [0, y0], [x1, 0], [x1, y1]], holes: [] }], -r), r);
    }
    if (o.shape === 'bone') {
      const r = h * 0.28, body = T.roundRect(x0 + r * 0.6, -h * 0.22, x1 - r * 0.6, h * 0.22, 2);
      const ends = [
        { outer: T.circle(x0 + r, h * 0.22, r, 48), holes: [] }, { outer: T.circle(x0 + r, -h * 0.22, r, 48), holes: [] },
        { outer: T.circle(x1 - r, h * 0.22, r, 48), holes: [] }, { outer: T.circle(x1 - r, -h * 0.22, r, 48), holes: [] },
        { outer: body, holes: [] }
      ];
      return T.unionPolys(ends);
    }
    return [{ outer: T.roundRect(x0, y0, x1, y1, Math.min(o.corner, w / 2 - 0.2, h / 2 - 0.2)), holes: [] }];
  }
  // the ring bail: a round tab on the top centre line, overlapping the outline where it really is at x = 0
  // (the heart's notch, the bone's waist), so it is always joined to the tag instead of floating above it
  function ringSpec(outline, o) {
    const hr = Math.max(1.5, o.ring / 2), tr = hr + 2.6;
    let top = -Infinity;
    for (const P of outline) {
      const L = P.outer;
      for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
        const a = L[j], b = L[i];
        if ((a[0] <= 0 && b[0] >= 0) || (a[0] >= 0 && b[0] <= 0)) {
          const y = a[0] === b[0] ? Math.max(a[1], b[1]) : a[1] + (b[1] - a[1]) * (0 - a[0]) / (b[0] - a[0]);
          top = Math.max(top, y);
        }
      }
    }
    if (!isFinite(top)) top = T.polysBBox(outline).y1;
    // lift the bail until it overlaps the tag by a fixed share of its area: as strong a joint as a straight top
    // edge gives, while a notch (the heart) lets it sit higher and leaves more room for the name
    const want = 0.14 * Math.PI * tr * tr, over = cy => T.polysArea(T.interPolys(outline, [{ outer: T.circle(0, cy, tr, 72), holes: [] }]));
    let lo = top - tr, hi = top + tr;
    for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (over(m) >= want) lo = m; else hi = m; }
    return { cx: 0, cy: lo, hr, tr };
  }
  // where text may go: the outline pulled in by the margin, minus the ring bail and its margin
  function textArea(outline, ring, m) {
    m = m === undefined ? MARGIN : m;
    let I = T.offset(outline, -m);
    I = T.diffPolys(I, [{ outer: T.circle(ring.cx, ring.cy, ring.tr + m, 72), holes: [] }]);
    return I;
  }
  // glyph outlines for a set of lines at the requested letter height, the block centred on (0, 0)
  function linePolys(lines, o, skipped) {
    const out = [], H = o.textH, step = H * 1.28;
    lines.forEach((line, li) => {
      let x = 0; const polys = [];
      for (const ch of [...line]) {
        if (ch === ' ') { x += H * 0.35; continue; }
        const g = Bubble.glyphPolys(o.font, ch, H);
        if (!g || !g.polys.length) { if (skipped && !skipped.includes(ch)) skipped.push(ch); continue; }
        for (const P of g.polys) polys.push({ outer: P.outer.map(p => [p[0] + x, p[1]]), holes: (P.holes || []).map(h => h.map(p => [p[0] + x, p[1]])) });
        x += (g.advance || H * 0.7) * 1.05;
      }
      if (!polys.length) return;
      const bb = T.polysBBox(polys), dx = -(bb.x0 + bb.x1) / 2, dy = -li * step;
      for (const P of polys) out.push({ outer: P.outer.map(p => [p[0] + dx, p[1] + dy]), holes: P.holes.map(h => h.map(p => [p[0] + dx, p[1] + dy])) });
    });
    if (!out.length) return out;
    const bb = T.polysBBox(out), cy = (bb.y0 + bb.y1) / 2;
    return out.map(P => ({ outer: P.outer.map(p => [p[0], p[1] - cy]), holes: P.holes.map(h => h.map(p => [p[0], p[1] - cy])) }));
  }
  const movePolys = (polys, s, dy) => polys.map(P => ({ outer: P.outer.map(p => [p[0] * s, p[1] * s + dy]), holes: P.holes.map(h => h.map(p => [p[0] * s, p[1] * s + dy])) }));
  function centroidY(polys) {
    let A = 0, Cy = 0;
    for (const P of polys) for (const L of [P.outer].concat(P.holes)) for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
      const c = L[j][0] * L[i][1] - L[i][0] * L[j][1]; A += c; Cy += (L[j][1] + L[i][1]) * c;
    }
    return A ? Cy / (3 * A) : 0;
  }
  // fast inside test for the search: the area's inside spans on fine rows (the exact check runs on the real outlines)
  const spanMemo = new WeakMap();
  function spans(I) {
    if (spanMemo.has(I)) return spanMemo.get(I);
    const bb = T.polysBBox(I), h = 0.02, rows = [], loops = [];
    for (const P of I) { loops.push(P.outer); for (const q of P.holes) loops.push(q); }
    for (let y = bb.y0; y <= bb.y1 + h; y += h) {
      const xs = [];
      for (const L of loops) for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
        const a = L[j], b = L[i];
        if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
      }
      rows.push(xs.sort((p, q) => p - q));
    }
    const S = { y0: bb.y0, h, rows, inside(x, y) {
      const r = rows[Math.round((y - bb.y0) / h)]; if (!r) return false;
      for (let k = 0; k + 1 < r.length; k += 2) if (x > r[k] && x < r[k + 1]) return true;
      return false;
    } };
    spanMemo.set(I, S); return S;
  }
  // largest scale (\u2264 1) and a vertical spot where the text block sits fully inside the text area
  function fitBlock(polys, I) {
    const SP = spans(I);
    const hulls = polys.map(P => hull(P.outer)), bb = T.polysBBox(polys), ib = T.polysBBox(I);
    // only the area's dents (reflex corners) and hole corners can poke into a glyph whose hull corners are all inside
    const iverts = [];
    for (const P of I) {
      const L = P.outer, sg = Math.sign(area(L)), n = L.length;
      for (let i = 0; i < n; i++) {
        const a = L[(i + n - 1) % n], b = L[i], c = L[(i + 1) % n];
        if (((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) * sg < 1e-9) iverts.push(b);
      }
      for (const h of P.holes) for (const q of h) iverts.push(q);
    }
    const pref = centroidY(I);
    const ok = (s, dy) => {
      for (const Hl of hulls) for (const q of Hl) if (!SP.inside(q[0] * s, q[1] * s + dy)) return false;
      for (const Hl of hulls) {
        const M = Hl.map(q => [q[0] * s, q[1] * s + dy]);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of M) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
        for (const v of iverts) if (v[0] > x0 && v[0] < x1 && v[1] > y0 && v[1] < y1 && ptIn(v, M)) return false;
      }
      return true;
    };
    const spot = s => {
      const lo = ib.y0 - bb.y0 * s, hi = ib.y1 - bb.y1 * s; if (lo > hi) return null;
      const c = Math.max(lo, Math.min(hi, pref)), N = 48, cand = [];
      for (let k = 0; k <= N; k++) cand.push(lo + (hi - lo) * k / N);
      cand.push(c); cand.sort((a, b) => Math.abs(a - c) - Math.abs(b - c));
      for (const dy of cand) if (ok(s, dy)) return dy;
      return null;
    };
    if (!polys.length || !I.length) return null;
    let s = 1, dy = spot(1);
    if (dy === null) {
      let lo = 0, hi = 1, best = null;
      for (let k = 0; k < 16; k++) { const m = (lo + hi) / 2, d = spot(m); if (d !== null) { lo = m; best = d; } else hi = m; }
      if (best === null) return null; s = lo; dy = best;
    }
    // exact check on the real outlines (not hulls); back off a touch if a curve still grazes the edge
    for (let k = 0; k < 12; k++) {
      const out = T.diffPolys(movePolys(polys, s, dy), I);
      if (T.polysArea(out) < 1e-4) return { s, dy };
      s *= 0.97; const d = spot(s); if (d !== null) dy = d;
    }
    return null;
  }
  function layouts(name) {
    const words = name.split(/\s+/).filter(Boolean), opts = [[words.join(' ')]];
    for (let k = 1; k < words.length; k++) opts.push([words.slice(0, k).join(' '), words.slice(k).join(' ')]);
    return opts;
  }
  // the text for one name, auto-fitted (shrunk and, for names with spaces, wrapped onto two lines) into the tag
  function fitText(name, o, I) {
    let best = null; const skipped = [];
    for (const lines of layouts(name)) {
      const polys = linePolys(lines, o, skipped); if (!polys.length) continue;
      const f = fitBlock(polys, I); if (!f) continue;
      // a second line has to earn its place: clearly bigger letters than one line
      if (!best || f.s > best.s * (lines.length > best.lines.length ? 1.12 : 1)) best = { lines, s: f.s, dy: f.dy, polys };
    }
    if (!best) return { polys: [], lines: [], letter: 0, skipped };
    return { polys: movePolys(best.polys, best.s, best.dy), lines: best.lines, letter: o.textH * best.s, scale: best.s, skipped };
  }
  let blankMemo = null; // the tag itself is the same for every name in a batch
  function blank(o) {
    const key = JSON.stringify([o.shape, o.tagW, o.tagH, o.ring, o.corner]);
    if (blankMemo && blankMemo.key === key) return blankMemo;
    const outline = tagOutline(o), ring = ringSpec(outline, o);
    let base = T.unionPolys(outline.concat([{ outer: T.circle(ring.cx, ring.cy, ring.tr, 72), holes: [] }]));
    base = T.diffPolys(base, [{ outer: T.circle(ring.cx, ring.cy, ring.hr, 72), holes: [] }]);
    return (blankMemo = { key, outline, ring, base, I: textArea(outline, ring) });
  }
  function tagGeometry(name, o) {
    const { outline, ring, base, I } = blank(o), text = fitText(name, o, I);
    return { outline, ring, base, area: I, text: text.polys, lines: text.lines, letter: text.letter, scale: text.scale || 0, skipped: text.skipped };
  }
  function oneTag(name, o) {
    const g = tagGeometry(name, o);
    const baseMesh = T.extrude(g.base, 2, 0, o.baseT);
    const textMesh = g.text.length ? T.concat(g.text.map(P => T.extrude([P], 2, o.baseT - 0.05, o.baseT + o.raise))) : null;
    const parts = [{ kind: 'base', name: `Tag ${name}`, p: baseMesh, color: o.colors.base, extruder: 1 }];
    if (textMesh) parts.push({ kind: 'text', name: `Text ${name}`, p: textMesh, color: o.colors.text, extruder: 2 });
    const all = T.concat(parts.map(q => q.p)), b = Core.bbox(all);
    return { parts, name, letter: g.letter, lines: g.lines.length, skipped: g.skipped, size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]], bb: b };
  }
  function arrange(items, bed, gap) {
    const W = bed[0] - 2 * gap, D = bed[1] - 2 * gap, pos = [];
    let x = 0, y = 0, rowH = 0, plate = 0;
    for (const it of items) {
      if (x > 0 && x + it.w > W) { x = 0; y += rowH + gap; rowH = 0; }
      if (y > 0 && y + it.h > D) { plate++; x = 0; y = 0; rowH = 0; }
      pos.push({ x: gap + x, y: bed[1] - gap - y - it.h, plate });
      x += it.w + gap; rowH = Math.max(rowH, it.h);
    }
    return pos;
  }
  function moveP(p, dx, dy, dz) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; }

  function build(raw) {
    const o = options(raw), names = parseNames(o.names), warnings = [];
    if (!names.length) names.push('Tag');
    const tags = names.map(n => oneTag(n, o));
    const long = String(o.names || '').split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => [...s].length > LIMITS.maxChars);
    if (long.length) warnings.push(`Names are cut to ${LIMITS.maxChars} characters.`);
    const small = tags.filter(t => t.letter > 0 && t.letter < MIN_LETTER);
    if (small.length) warnings.push(`Long names shrink to fit: the smallest letters are ${Math.min(...small.map(t => t.letter)).toFixed(1)} mm tall. A bigger tag prints them cleaner.`);
    const skipped = [...new Set(tags.flatMap(t => t.skipped))];
    if (skipped.length) warnings.push(`Some characters can't be made in this font and were left out: ${skipped.join(' ')}`);
    const items = tags.map(t => ({ w: t.size[0] + 1, h: t.size[1] + 1, t }));
    const pos = arrange(items, o.bed, o.gap);
    const parts = [];
    items.forEach((it, i) => {
      const dx = pos[i].x - it.t.bb.min[0], dy = pos[i].y - it.t.bb.min[1];
      for (const q of it.t.parts) parts.push({ ...q, p: moveP(q.p, dx, dy), plate: pos[i].plate, index: i });
    });
    const plates = Math.max(0, ...pos.map(p => p.plate)) + 1;
    if (plates > 1) warnings.push(`The tags fill ${plates} build plates.`);
    if (names.length > LIMITS.freeCount) warnings.push(`${names.length} tags (free: up to ${LIMITS.freeCount}).`);
    const all = T.concat(parts.map(q => q.p)), bb = Core.bbox(all);
    return {
      parts, tags, options: o, warnings, plates, names,
      filaments: [{ role: 'base', color: o.colors.base }, { role: 'text', color: o.colors.text }],
      size: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]],
      stats: { count: names.length, plates, shape: o.shape, minLetter: Math.min(...tags.map(t => t.letter || Infinity)), tris: parts.reduce((s, q) => s + q.p.length / 9, 0), size: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]] }
    };
  }

  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  function export3MF(res, o) {
    o = o || {}; const bed = o.bed || res.options.bed || DEFAULTS.bed, name = o.name || 'Keytags', n = res.plates || 1;
    const cols = []; for (const q of res.parts) if (!cols.includes(q.color)) cols.push(q.color);
    const objects = [], plates = Array.from({ length: n }, () => []);
    res.parts.forEach(pt => {
      const org = T.bambuPlateOrigin(pt.plate || 0, n, bed[0], bed[1]);
      plates[pt.plate || 0].push(objects.length);
      objects.push({ name: pt.name, p: moveP(pt.p, org[0], org[1]), color: pt.color, extruder: cols.indexOf(pt.color) + 1 });
    });
    return T.threeMF(objects, { title: name, plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function readme(res, name) {
    const s = res.stats, o = res.options, L = [`Expressarte keychains and pet tags: ${name}`, '',
      `${s.count} tags \u00b7 ${SHAPES[o.shape].label} \u00b7 ${s.plates} plate${s.plates === 1 ? '' : 's'}`, 'Names:'];
    res.names.forEach((n, i) => L.push(`  ${i + 1}. ${n}`));
    L.push('', 'Filaments'); res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}  ${f.role}`));
    L.push('', 'Printing', '  - Print flat. The 3MF opens with base and raised text on separate filaments.',
      '  - Hang each tag from the ring hole.');
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, o) {
    o = o || {}; const name = o.name || 'Keytags', base = safe(o.fileBase || name.toLowerCase()) || 'keytags';
    const list = [{ name: `${base}.3mf`, data: export3MF(res, o) }];
    res.parts.forEach((q, i) => list.push({ name: `stl/${String(i + 1).padStart(2, '0')}_${safe(q.name)}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }));
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }

  const api = { DEFAULTS, LIMITS, SHAPES, PALETTE, FONTS: Bubble.FONTS, MARGIN, options, parseNames, tagOutline, ringSpec, textArea, tagGeometry, build, export3MF, files, readme };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPKeytags = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
