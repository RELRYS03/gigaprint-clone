/* Expressarte QR code and Wi-Fi tags: a raised two-color QR on a square plate, keychain, stand or coaster,
   with an optional label. Payloads: plain text / URL, WIFI: strings, and a simple contact card (MECARD).
   High error correction, a quiet zone, and a module-size check against the nozzle so the print stays scannable. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const QR = G.GPQRCode || (typeof require === 'function' ? require('./qrcode-lib.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);

  const QUIET = 4; // modules of quiet zone around the code (QR spec minimum)
  const DEFAULTS = {
    kind: 'url', // url | wifi | contact
    text: 'https://example.com',
    wifiSsid: 'HomeWiFi', wifiPass: '', wifiSecurity: 'WPA', wifiHidden: false, wifiText: false, wifiWords: null,
    contactName: 'Alex River', contactPhone: '', contactEmail: '', contactOrg: '', contactUrl: '',
    shape: 'plate', // plate | keychain | stand | coaster
    sizeMM: 50, baseT: 2.2, raise: 0.8, corner: 3, border: 3,
    ring: 5, nozzle: 0.4, label: '', labelSize: 6, font: 'round',
    colors: { base: '#F7F7F2', code: '#1A1A1A' },
    bed: [256, 256], bambu: 'A1', detail: 'hd', batch: null
  };
  const LIMITS = { freeBatch: 1, minSize: 25, maxSize: 120, minModule: 0.6, minText: 3.5 };
  const SHAPES = {
    plate: { label: 'Square plate', note: 'A flat tag with rounded corners.' },
    keychain: { label: 'Keychain', note: 'A hang hole on the top edge.' },
    stand: { label: 'Stand', note: 'A separate foot with a groove: the tag slides in and leans back slightly on a desk.' },
    coaster: { label: 'Coaster', note: 'A thicker round-ish plate for a drink or a phone.' }
  };
  const KINDS = {
    url: { label: 'Text or URL', note: 'Any text, a website, or a deep link.' },
    wifi: { label: 'Wi-Fi', note: 'Phone cameras open the network join sheet from a WIFI: code.' },
    contact: { label: 'Contact card', note: 'A name, phone, email and optional website (MECARD).' }
  };
  const PALETTE = [
    { name: 'White', hex: '#F7F7F2' }, { name: 'Black', hex: '#1A1A1A' }, { name: 'Navy', hex: '#1E3A5F' },
    { name: 'Red', hex: '#C8102E' }, { name: 'Forest', hex: '#1E7B46' }, { name: 'Gold', hex: '#D4A72C' },
    { name: 'Sky', hex: '#4A90D9' }, { name: 'Orange', hex: '#E07A3A' }
  ];

  function escWifi(s) { return String(s || '').replace(/([\\;,":])/g, '\\$1'); }
  function wifiString(o) {
    const t = o.wifiSecurity === 'nopass' ? 'nopass' : (o.wifiSecurity === 'WEP' ? 'WEP' : 'WPA');
    const hid = o.wifiHidden ? 'H:true;' : '';
    return `WIFI:T:${t};S:${escWifi(o.wifiSsid)};${t === 'nopass' ? '' : `P:${escWifi(o.wifiPass)};`}${hid};`;
  }
  function contactString(o) {
    const parts = [`N:${escWifi(o.contactName)}`];
    if (o.contactPhone) parts.push(`TEL:${escWifi(o.contactPhone)}`);
    if (o.contactEmail) parts.push(`EMAIL:${escWifi(o.contactEmail)}`);
    if (o.contactOrg) parts.push(`ORG:${escWifi(o.contactOrg)}`);
    if (o.contactUrl) parts.push(`URL:${escWifi(o.contactUrl)}`);
    return `MECARD:${parts.join(';')};;`;
  }
  function payload(o) {
    if (o.kind === 'wifi') return wifiString(o);
    if (o.kind === 'contact') return contactString(o);
    return String(o.text || '').trim() || 'https://example.com';
  }
  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    o.sizeMM = Math.max(LIMITS.minSize, Math.min(LIMITS.maxSize, +o.sizeMM || DEFAULTS.sizeMM));
    o.baseT = Math.max(1.2, Math.min(6, +o.baseT || DEFAULTS.baseT));
    o.raise = Math.max(0.4, Math.min(2, +o.raise || DEFAULTS.raise));
    o.corner = Math.max(0, Math.min(12, +o.corner || 0));
    o.border = Math.max(1.5, Math.min(12, +o.border || DEFAULTS.border));
    o.ring = Math.max(3, Math.min(10, +o.ring || DEFAULTS.ring));
    o.nozzle = Math.max(0.2, Math.min(1.2, +o.nozzle || DEFAULTS.nozzle));
    o.labelSize = Math.max(4, Math.min(14, +o.labelSize || DEFAULTS.labelSize));
    o.colors = Object.assign({}, DEFAULTS.colors, o.colors || {});
    if (!SHAPES[o.shape]) o.shape = 'plate';
    if (!KINDS[o.kind]) o.kind = 'url';
    if (!(Bubble && Bubble.FONTS && Bubble.FONTS[o.font])) o.font = 'round';
    o.label = String(o.label || '').replace(/\s+/g, ' ').trim();
    return o;
  }

  // merge runs of dark modules into horizontal rectangles (no boolean union: abutting edges stay separate so the
  // extruded mesh stays closed; triangles are still far fewer than one cube per module)
  function modulePolys(cells, n, moduleMM, origin) {
    const x0 = origin[0], y0 = origin[1], rects = [];
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        while (c < n && !cells[r][c]) c++;
        if (c >= n) break;
        let c1 = c; while (c1 < n && cells[r][c1]) c1++;
        const px = x0 + c * moduleMM, py = y0 + (n - r - 1) * moduleMM;
        rects.push({ outer: [[px, py], [px + (c1 - c) * moduleMM, py], [px + (c1 - c) * moduleMM, py + moduleMM], [px, py + moduleMM]], holes: [] });
        c = c1;
      }
    }
    return rects;
  }
  function extrudeParts(polys, a, h0, h1) {
    if (!polys.length) return null;
    return T.concat(polys.map(P => T.extrude([P], a, h0, h1)));
  }

  // ---------------------------------------------------------------- text: glyphs, fallback punctuation, fit
  // Punctuation the bubble styles do not carry (common in Wi-Fi passwords and URLs), drawn as round-capped strokes
  // in cap-height units (baseline 0, cap 1). [advance, strokes...]; a stroke is a polyline, a dot is one point.
  const EXTRA = {
    ':': [0.5, [[0.25, 0.16]], [[0.25, 0.64]]], ';': [0.5, [[0.27, 0.64]], [[0.29, 0.16], [0.17, -0.16]]],
    ',': [0.45, [[0.27, 0.14], [0.15, -0.18]]], '/': [0.72, [[0.12, -0.06], [0.6, 1.02]]], '\\': [0.72, [[0.12, 1.02], [0.6, -0.06]]],
    '_': [0.86, [[0.1, -0.16], [0.76, -0.16]]], '|': [0.44, [[0.22, -0.16], [0.22, 1.06]]], '=': [0.82, [[0.12, 0.3], [0.7, 0.3]], [[0.12, 0.66], [0.7, 0.66]]],
    '<': [0.8, [[0.66, 0.86], [0.14, 0.48], [0.66, 0.1]]], '>': [0.8, [[0.14, 0.86], [0.66, 0.48], [0.14, 0.1]]],
    '^': [0.8, [[0.12, 0.62], [0.4, 1.0], [0.68, 0.62]]], '"': [0.66, [[0.2, 1.02], [0.2, 0.7]], [[0.46, 1.02], [0.46, 0.7]]], '`': [0.5, [[0.16, 1.04], [0.32, 0.84]]],
    '[': [0.56, [[0.44, 1.06], [0.16, 1.06], [0.16, -0.16], [0.44, -0.16]]], ']': [0.56, [[0.12, 1.06], [0.4, 1.06], [0.4, -0.16], [0.12, -0.16]]],
    '{': [0.62, [[0.5, 1.06], [0.32, 1.0], [0.3, 0.56], [0.12, 0.45], [0.3, 0.34], [0.32, -0.1], [0.5, -0.16]]],
    '}': [0.62, [[0.12, 1.06], [0.3, 1.0], [0.32, 0.56], [0.5, 0.45], [0.32, 0.34], [0.3, -0.1], [0.12, -0.16]]],
    '(': [0.56, null, 'arcL'], ')': [0.56, null, 'arcR'], '~': [0.86, null, 'wave']
  };
  function capsule(a, b, r) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), n = 12, out = [];
    if (L < 1e-6) return T.circle(a[0], a[1], r, 2 * n);
    const ang = Math.atan2(dy, dx);
    for (let i = 0; i <= n; i++) { const t = ang - Math.PI / 2 + Math.PI * i / n; out.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)]); }
    for (let i = 0; i <= n; i++) { const t = ang + Math.PI / 2 + Math.PI * i / n; out.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]); }
    return out;
  }
  function extraGlyph(ch, h) {
    const e = EXTRA[ch]; if (!e) return null;
    let strokes = e.slice(1).filter(Array.isArray);
    const arc = (cx, a0, a1) => { const L = []; for (let i = 0; i <= 10; i++) { const t = a0 + (a1 - a0) * i / 10; L.push([cx + 0.62 * Math.cos(t), 0.45 + 0.62 * Math.sin(t)]); } return L; };
    if (e[2] === 'arcL') strokes = [arc(0.78, Math.PI * 0.66, Math.PI * 1.34)];
    if (e[2] === 'arcR') strokes = [arc(-0.22, -Math.PI * 0.34, Math.PI * 0.34)];
    if (e[2] === 'wave') { const L = []; for (let i = 0; i <= 16; i++) { const x = 0.12 + 0.62 * i / 16; L.push([x, 0.46 + 0.1 * Math.sin((i / 16) * Math.PI * 2)]); } strokes = [L]; }
    const r = 0.11 * h, polys = [];
    for (const S of strokes) {
      const P = S.map(p => [p[0] * h, p[1] * h]);
      if (P.length === 1) polys.push({ outer: T.circle(P[0][0], P[0][1], r * 1.25, 28), holes: [] });
      for (let i = 0; i + 1 < P.length; i++) polys.push({ outer: capsule(P[i], P[i + 1], r), holes: [] });
    }
    return { polys: T.unionPolys(polys), advance: e[0] * h };
  }
  const GLYPHS = new Map(); // unit-height outlines per font and character (layout scales them)
  function glyph(font, ch, h) {
    const k = font + '\u0000' + ch;
    if (!GLYPHS.has(k)) {
      const g = Bubble && Bubble.glyphPolys(font, ch, 1);
      GLYPHS.set(k, g && g.polys.length ? g : extraGlyph(ch, 1));
      if (GLYPHS.size > 4000) GLYPHS.clear();
    }
    const g = GLYPHS.get(k); if (!g || h === 1) return g;
    return { advance: g.advance * h, polys: g.polys.map(P => ({ outer: P.outer.map(p => [p[0] * h, p[1] * h]), holes: (P.holes || []).map(H => H.map(p => [p[0] * h, p[1] * h])) })) };
  }
  const canPrint = (font, ch) => ch === ' ' || !!glyph(font, ch, 1);
  // one line at cap height 1: glyph outlines and their real ink bounds (accents and descenders included)
  function lineAtUnit(text, font) {
    const out = [], missing = []; let pen = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const ch of [...text]) {
      if (ch === ' ') { pen += 0.35; continue; }
      const g = glyph(font, ch, 1);
      if (!g) { missing.push(ch); continue; }
      for (const P of g.polys) {
        const q = { outer: P.outer.map(p => [p[0] + pen, p[1]]), holes: (P.holes || []).map(H => H.map(p => [p[0] + pen, p[1]])) };
        for (const p of q.outer) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
        out.push(q);
      }
      pen += (g.advance || 0.7) * 1.05 + 0.05; // a little extra tracking so raised letters do not fuse at small sizes
    }
    if (!out.length) return null;
    return { polys: out, x0, x1, y0: Math.min(y0, 0), y1: Math.max(y1, 1), w: x1 - x0, missing };
  }
  // ways to break a string into at most maxLines lines: at spaces first, then (for codes) anywhere
  // candidate line breaks, each with a preference: at spaces (1), after _ - . / : inside a code (0.9), anywhere (0.75);
  // a break right after a "Password:" heading reads best (1.1)
  function splits(text, maxLines, anywhere, head) {
    const out = [{ lines: [text], pref: 1 }], words = text.split(/\s+/).filter(Boolean);
    const balanced = (units, k) => { // k lines with the shortest longest line (by characters); units keep their own spaces
      const len = (i, j) => units.slice(i, j).join('').trim().length, N = units.length;
      let best = null;
      if (k === 2) for (let i = 1; i < N; i++) { const m = Math.max(len(0, i), len(i, N)); if (!best || m < best.m) best = { m, cuts: [i] }; }
      else for (let i = 1; i < N - 1; i++) for (let j = i + 1; j < N; j++) { const m = Math.max(len(0, i), len(i, j), len(j, N)); if (!best || m < best.m) best = { m, cuts: [i, j] }; }
      if (!best) return null;
      const c = [0, ...best.cuts, N];
      return c.slice(1).map((e, i) => units.slice(c[i], e).join('').trim()).filter(Boolean);
    };
    const soft = t => t.match(/[^_\-./:]*[_\-./:]|[^_\-./:]+$/g) || [t]; // pieces that end at a soft break
    const add = (lines, pref) => { if (lines && lines.length > 1 && lines.every(Boolean)) out.push({ lines, pref }); };
    const spaced = words.map((w, i) => i < words.length - 1 ? w + ' ' : w);
    for (let k = 2; k <= maxLines; k++) {
      add(balanced(spaced, k), 1);
      if (anywhere) { add(balanced(spaced.flatMap(soft), k), 0.9); add(balanced([...text], k), 0.75); }
    }
    if (head && text.startsWith(head + ' ')) {
      const rest = text.slice(head.length + 1);
      add([head, rest], 1.1);
      if (maxLines >= 3) { const r2 = balanced(soft(rest), 2); add(r2 && [head, ...r2], 1.0); const r3 = balanced([...rest], 2); add(r3 && [head, ...r3], 0.85); }
    }
    return out;
  }
  // fit one text field into width availW: the largest cap height up to h0 (never below minH), wrapping onto up to
  // maxLines lines; if even minH on maxLines will not fit, the text is cut to fit and the field is flagged
  function fitField(text, opt) {
    text = String(text || '').replace(/\s+/g, ' ').trim(); if (!text) return null;
    const { font, h0, minH, availW, maxLines, anywhere, head } = opt;
    // among layouts whose letters stay at least 70% of the asked size: fewer lines and nicer breaks first;
    // if none gets there, the biggest letters
    const good = Math.max(minH, 0.7 * h0);
    let best = null, fewest = null;
    for (const { lines, pref } of splits(text, maxLines, anywhere, head)) {
      const laid = lines.map(s => lineAtUnit(s, font)); if (laid.some(l => !l)) continue;
      const wMax = Math.max(...laid.map(l => l.w));
      const h = Math.min(h0, availW / wMax), c = { lines, laid, h };
      c.score = h * pref * (1 - (anywhere ? 0.12 : 0.25) * (lines.length - 1)); // a label stays on one line when it can
      if (h >= good - 1e-9 && (!fewest || c.score > fewest.score)) fewest = c;
      if (!best || h * pref > best.h * (best.pref || 1) + 1e-9) { best = c; best.pref = pref; }
    }
    if (fewest) best = fewest;
    if (!best) return { text, h0, lines: [], laid: [], h: 0, cut: false, missing: [...new Set([...text].filter(c => !canPrint(font, c)))] };
    const missing = [...new Set(best.laid.flatMap(l => l.missing))];
    if (best.h >= minH) return Object.assign(best, { cut: false, missing, h0 });
    // too long even at the smallest printable size: keep minH and cut each line to the width
    const lines = [], laid = [];
    const rows = best.lines.length < maxLines ? splits(text, maxLines, true).filter(s => s.length === maxLines).pop() || best.lines : best.lines;
    for (const s of rows) {
      let chars = [...s];
      let l = lineAtUnit(chars.join(''), font);
      while (chars.length > 1 && l && l.w * minH > availW) { chars.pop(); l = lineAtUnit(chars.join('').trim(), font); }
      if (l) { lines.push(chars.join('').trim()); laid.push(l); }
    }
    return { text, lines, laid, h: minH, cut: true, missing, h0 };
  }
  // stack fitted fields into one block: top edge at y=0, centered on x=0; returns polys plus block size
  function textBlock(fields, nozzle) {
    const polys = []; let y = 0, w = 0, first = true;
    for (const f of fields) {
      if (!f || !f.laid.length) continue;
      const h = f.h, gap = Math.max(0.9, 2 * nozzle, 0.3 * h);
      f.laid.forEach(l => {
        if (!first) y -= gap; first = false;
        const top = y - l.y1 * h, dx = -(l.x0 + l.x1) / 2 * h;
        for (const P of l.polys) polys.push({ outer: P.outer.map(p => [p[0] * h + dx, p[1] * h + top]), holes: P.holes.map(H => H.map(p => [p[0] * h + dx, p[1] * h + top])) });
        y = top + l.y0 * h; w = Math.max(w, l.w * h);
      });
    }
    return { polys, w, h: -y };
  }
  function shift(polys, dx, dy) { return polys.map(P => ({ outer: P.outer.map(p => [p[0] + dx, p[1] + dy]), holes: P.holes.map(H => H.map(p => [p[0] + dx, p[1] + dy])) })); }
  const segs = (r, detail) => Math.max(48, Math.ceil(2 * Math.PI * r / (detail === 'draft' ? 0.8 : 0.25)));

  // ---------------------------------------------------------------- stand foot
  // a separate block printed flat with a groove leaned back STAND_TILT degrees; the tag's plain bottom strip slides in
  const STAND = { tilt: 12, depth: 5, clear: 0.4, floor: 2.2, wall: 2.6 };
  function standFoot(o, plateW, plateH, y0) {
    const len = Math.min(plateW * 0.8, Math.max(30, plateW * 0.6)), g = o.baseT + STAND.clear, H = STAND.floor + STAND.depth;
    // the leaning tag's center of mass sits (plateH / 2) * sin(tilt) behind the groove: the foot reaches well past it
    const t = Math.tan(STAND.tilt * Math.PI / 180), com = plateH / 2 * Math.sin(STAND.tilt * Math.PI / 180);
    const back = Math.max(STAND.wall + 3 + H * t, com * 1.6 + 4), front = STAND.wall + 4;
    // profile in (y, z): front at +y; groove from the top down to the floor, leaning toward -y as it rises
    const zf = STAND.floor, zt = H, gx = z => -(z - zf) * t; // groove front wall x at height z
    const prof = [[front, 0], [front, zt * 0.55], [g / 2 + STAND.wall * 0.6, zt], [gx(zt) + g / 2, zt], [g / 2, zf], [-g / 2, zf], [gx(zt) - g / 2, zt],
      [gx(zt) - g / 2 - STAND.wall, zt], [-back, zt * 0.45], [-back, 0]];
    const y0f = y0 - 6 - front, foot = T.extrude([{ outer: prof.map(p => [p[0] + y0f, p[1]]), holes: [] }], 0, -len / 2, len / 2);
    return { p: foot, len, depth: front + back, height: H };
  }

  function buildOne(raw) {
    const o = options(raw), warnings = [];
    const data = payload(o);
    const matrix = QR.encode(data, 'H');
    const n = matrix.size + 2 * QUIET, W = o.sizeMM;
    const edge = Math.max(2, o.border * 0.7), minH = Math.max(LIMITS.minText, o.nozzle * 8.75);
    const qzGap = 0.6; // plain space between the quiet zone and the first line of text
    const stand = o.shape === 'stand', coaster = o.shape === 'coaster';
    const tail = stand ? STAND.depth + 1.2 : 0; // plain strip at the bottom of a stand tag that sits in the groove
    const fieldsFor = availW => {
      const fs = [];
      const lab = fitField(o.label, { font: o.font, h0: o.labelSize, minH, availW, maxLines: 3, anywhere: false });
      if (lab) fs.push(Object.assign(lab, { name: 'Label' }));
      if (o.kind === 'wifi' && o.wifiText) {
        const words = o.wifiWords || {}, sub = Math.max(minH, o.labelSize * 0.75);
        const nh = `${words.net || 'Network'}:`, net = fitField(`${nh} ${o.wifiSsid}`, { font: o.font, h0: sub, minH, availW, maxLines: 3, anywhere: true, head: nh });
        if (net && o.wifiSsid) fs.push(Object.assign(net, { name: 'Network name' }));
        if (o.wifiSecurity !== 'nopass' && o.wifiPass) {
          const ph = `${words.pass || 'Password'}:`, pw = fitField(`${ph} ${o.wifiPass}`, { font: o.font, h0: sub, minH, availW, maxLines: 3, anywhere: true, head: ph });
          if (pw) fs.push(Object.assign(pw, { name: 'Password' }));
        }
      }
      return fs;
    };
    let qz, cx = 0, qzTop, fields, block, outline, plateW, coasterR = 0;
    if (!coaster) {
      qz = W - 2 * o.border; plateW = W;
      fields = fieldsFor(W - 2 * edge); block = textBlock(fields, o.nozzle);
      qzTop = W / 2 - o.border;
    } else {
      // the whole quiet-zone square and the text block sit inside the circle with an edge margin. Try the largest
      // QR first and step it down until the text fits at a readable size; the content is then centered vertically.
      const R = W / 2, Rin = R - edge; coasterR = R;
      const chord = y => 2 * Math.sqrt(Math.max(0, Rin * Rin - y * y));
      const place = (s, blk) => { // interval of qz top edges that keeps every corner inside, or null
        const th = blk.h ? blk.h + qzGap : 0, pts = [[s / 2, 0], [s / 2, -s]];
        if (blk.h) pts.push([blk.w / 2, -s - qzGap], [blk.w / 2, -s - th]);
        let lo = -Infinity, hi = Infinity;
        for (const [x, yr] of pts) { if (x > Rin) return null; const c = Math.sqrt(Rin * Rin - x * x); lo = Math.max(lo, -c - yr); hi = Math.min(hi, c - yr); }
        return lo <= hi + 1e-9 ? (lo + hi) / 2 : null;
      };
      let pick = null, last = null, wanted = o.label || (o.kind === 'wifi' && o.wifiText);
      const sMax = Rin * Math.SQRT2;
      for (let s = sMax; s >= sMax * 0.45 && !pick; s *= 0.97) {
        const top0 = Math.sqrt(Math.max(0, Rin * Rin - s * s / 4)), tTop = top0 - s - qzGap;
        let fs = fieldsFor(Math.min(s, chord(tTop))), blk = textBlock(fs, o.nozzle);
        if (blk.h) { fs = fieldsFor(Math.min(s, chord(tTop), chord(tTop - blk.h))); blk = textBlock(fs, o.nozzle); }
        const at = place(s, blk); if (at == null) continue;
        const ok = !wanted || fs.every(f => !f.cut && f.h >= Math.min(f.h0 || o.labelSize, Math.max(minH, 0.7 * (f.h0 || o.labelSize))) - 1e-6);
        last = { s, fs, blk, at };
        if (ok) pick = last;
      }
      if (!pick) pick = last;
      if (!pick) pick = { s: sMax, fs: [], blk: { polys: [], w: 0, h: 0 }, at: Math.sqrt(Rin * Rin - sMax * sMax / 4), dropped: true };
      qz = pick.s; fields = pick.fs; block = pick.blk; qzTop = pick.at;
      if (pick.dropped && wanted) warnings.push('The text does not fit on this coaster size, so it was left off. Make the coaster larger or shorten the text.');
      plateW = W;
    }
    const moduleMM = qz / n;
    if (moduleMM < o.nozzle) warnings.push(`Each QR module is ${moduleMM.toFixed(2)} mm, smaller than the ${o.nozzle} mm nozzle. Raise the size or use a finer nozzle.`);
    else if (moduleMM < LIMITS.minModule) warnings.push(`Modules are ${moduleMM.toFixed(2)} mm. ${LIMITS.minModule} mm or more scans more reliably.`);
    if (moduleMM < Math.max(o.nozzle, LIMITS.minModule)) {
      const needMM = Math.ceil(coaster ? (W * Math.max(o.nozzle, LIMITS.minModule) / moduleMM) : (n * Math.max(o.nozzle, LIMITS.minModule) + 2 * o.border));
      warnings.push(needMM <= LIMITS.maxSize ? `For this much data make the tag at least ${needMM} mm, or shorten the text in the code.` : `This much data needs a tag over ${LIMITS.maxSize} mm. Shorten the text in the code.`);
    }
    for (const f of fields) {
      if (f.cut) warnings.push(`${f.name} does not fit on a ${Math.round(W)} mm tag even at the smallest printable letter size, so the end was cut off. Make the tag larger or shorten it.`);
      if (f.missing && f.missing.length) warnings.push(`Some characters can't be printed in this font and were left out: ${f.missing.join(' ')}`);
    }
    const qzBottom = qzTop - qz, qrCy = qzTop - qz / 2;
    const codeSide = matrix.size * moduleMM;
    const dark = modulePolys(matrix.cells, matrix.size, moduleMM, [cx - codeSide / 2, qrCy - codeSide / 2]);
    const textTop = qzBottom - qzGap;
    const labels = block.polys.length ? T.unionPolys(shift(block.polys, 0, textTop)) : [];
    const textBottom = block.h ? textTop - block.h : qzBottom;
    // plate outline
    if (coaster) {
      outline = [{ outer: T.circle(0, 0, coasterR, segs(coasterR, o.detail)), holes: [] }];
    } else {
      // under the text: the edge margin, or the corner radius so a full-width last line clears the rounded corners
      const y1 = W / 2, y0 = Math.min(-W / 2, (block.h ? textBottom - Math.max(edge, Math.min(o.corner, W / 4)) : qzBottom - o.border) - tail);
      const r = Math.min(o.corner, W / 2 - 0.2, (y1 - y0) / 2 - 0.2);
      outline = [{ outer: T.roundRect(-W / 2, y0, W / 2, y1, r), holes: [] }];
      if (o.shape === 'keychain') {
        const hr = Math.max(1.6, o.ring / 2), tr = hr + 2.8, hy = y1 + hr + 0.6;
        outline = T.unionPolys(outline.concat([{ outer: T.circle(0, hy, tr, segs(tr, o.detail)), holes: [] }]));
        outline = T.diffPolys(outline, [{ outer: T.circle(0, hy, hr, segs(hr, o.detail)), holes: [] }]);
      }
    }
    const raised = dark.concat(labels);
    const baseMesh = T.extrude(outline, 2, 0, o.baseT);
    const codeMesh = raised.length ? extrudeParts(raised, 2, o.baseT - 0.05, o.baseT + o.raise) : null;
    const parts = [{ kind: 'base', name: 'Base plate', p: baseMesh, color: o.colors.base, extruder: 1 }];
    if (codeMesh) parts.push({ kind: 'code', name: 'QR and label', p: codeMesh, color: o.colors.code, extruder: 2 });
    const obb = T.polysBBox(outline);
    if (stand) {
      const f = standFoot(o, plateW, obb.h, obb.y0);
      parts.push({ kind: 'stand', name: 'Desk stand', p: f.p, color: o.colors.base, extruder: 1 });
    }
    const all = T.concat(parts.map(q => q.p)), bb = Core.bbox(all);
    const size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
    let tris = 0; for (const q of parts) tris += q.p.length / 9;
    const text = fields.filter(f => f.laid.length).map(f => ({ name: f.name, h: f.h, lines: f.lines.length, cut: f.cut }));
    return {
      parts, matrix, payload: data, options: o, warnings,
      layout: { outline, quiet: [cx - qz / 2, qzBottom, cx + qz / 2, qzTop], code: [cx - codeSide / 2, qrCy - codeSide / 2, cx + codeSide / 2, qrCy + codeSide / 2], text: labels, edge, standStrip: stand ? [obb.y0, obb.y0 + tail] : null, hole: o.shape === 'keychain' ? { y: W / 2 + Math.max(1.6, o.ring / 2) + 0.6, r: Math.max(1.6, o.ring / 2) } : null, minText: minH },
      filaments: codeMesh
        ? [{ role: 'base', color: o.colors.base }, { role: 'code', color: o.colors.code }]
        : [{ role: 'base', color: o.colors.base }],
      size, stats: {
        size, moduleMM, modules: matrix.size, quiet: QUIET, ec: 'H', nozzle: o.nozzle, text,
        shape: o.shape, kind: o.kind, tris, label: !!o.label, scannable: moduleMM >= o.nozzle * 0.95
      }
    };
  }

  function parseBatch(csv) {
    // one payload per line; optional "label|payload" or CSV "label,payload"
    const lines = String(csv || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.map((line, i) => {
      let label = '', text = line;
      if (line.includes('|')) { const p = line.split('|'); label = p.shift().trim(); text = p.join('|').trim(); }
      else if (/,/.test(line) && !/^https?:/i.test(line) && !/^WIFI:/i.test(line) && !/^MECARD:/i.test(line)) {
        const p = line.split(','); label = p.shift().trim(); text = p.join(',').trim();
      }
      return { label, text, index: i };
    }).filter(r => r.text);
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
  function moveP(p, dx, dy, dz) {
    const q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); }
    return q;
  }

  function build(raw) {
    const o = options(raw);
    if (o.batch && o.batch.length) {
      const built = [], warnings = [];
      for (const row of o.batch) {
        const one = buildOne(Object.assign({}, o, { text: row.text, label: row.label || o.label, kind: 'url', batch: null }));
        built.push(one); warnings.push(...one.warnings.map(w => `${row.label || row.text}: ${w}`));
      }
      const items = built.map(b => ({ w: b.size[0] + 2, h: b.size[1] + 2, b }));
      const pos = arrange(items, o.bed, 4);
      const parts = [];
      items.forEach((it, i) => {
        const dx = pos[i].x - (Core.bbox(T.concat(it.b.parts.map(q => q.p))).min[0]);
        const dy = pos[i].y - (Core.bbox(T.concat(it.b.parts.map(q => q.p))).min[1]);
        for (const q of it.b.parts) parts.push({ ...q, name: `${q.name} ${i + 1}`, p: moveP(q.p, dx, dy), plate: pos[i].plate, index: i });
      });
      const plates = Math.max(0, ...pos.map(p => p.plate)) + 1;
      if (plates > 1) warnings.push(`The batch fills ${plates} build plates.`);
      const all = T.concat(parts.map(q => q.p)), bb = Core.bbox(all);
      const colors = [];
      for (const q of parts) if (!colors.includes(q.color)) colors.push(q.color);
      return {
        parts, items: built, options: o, warnings, plates,
        filaments: colors.map((c, i) => ({ role: i === 0 ? 'base' : 'code', color: c })),
        size: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]],
        stats: { count: built.length, plates, tris: parts.reduce((s, q) => s + q.p.length / 9, 0), batch: true, shape: o.shape, kind: 'batch' },
        matrix: built[0] && built[0].matrix, payload: built.map(b => b.payload)
      };
    }
    const one = buildOne(o);
    one.plates = 1;
    one.parts.forEach(q => { q.plate = 0; });
    return one;
  }

  // top-down binary image of the raised QR (for scan tests): dark modules = black
  function topView(res, px) {
    const m = res.matrix; if (!m) return null;
    const n = m.size, pad = QUIET, N = n + 2 * pad, S = px || 8;
    const W = N * S, H = N * S, data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255; data[i * 4 + 3] = 255; }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m.cells[r][c]) {
      const x0 = (c + pad) * S, y0 = (r + pad) * S;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const o = ((y0 + y) * W + (x0 + x)) * 4; data[o] = data[o + 1] = data[o + 2] = 0;
      }
    }
    return { width: W, height: H, data };
  }

  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  function placed(res, bed) {
    const all = T.concat(res.parts.map(q => q.p)), bb = Core.bbox(all);
    const dx = bed[0] / 2 - (bb.min[0] + bb.max[0]) / 2, dy = bed[1] / 2 - (bb.min[1] + bb.max[1]) / 2, dz = -bb.min[2];
    return res.parts.map(q => ({ ...q, p: moveP(q.p, dx, dy, dz) }));
  }
  function export3MF(res, o) {
    o = o || {}; const bed = o.bed || res.options.bed || DEFAULTS.bed, name = o.name || 'QR tag';
    const n = res.plates || 1;
    if (n > 1) {
      const cols = []; for (const q of res.parts) if (!cols.includes(q.color)) cols.push(q.color);
      const objects = [], plates = Array.from({ length: n }, () => []);
      res.parts.forEach(pt => {
        const org = T.bambuPlateOrigin(pt.plate || 0, n, bed[0], bed[1]);
        const ob = { name: pt.name, p: moveP(pt.p, org[0], org[1]), color: pt.color, extruder: cols.indexOf(pt.color) + 1 };
        plates[pt.plate || 0].push(objects.length); objects.push(ob);
      });
      return T.threeMF(objects, { title: name, plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
    }
    const parts = placed(res, bed).map(q => ({ name: q.name, p: q.p, extruder: q.extruder || 1, color: q.color }));
    return T.threeMF([{ name, parts }], { title: name, plates: [[0]], bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: res.filaments });
  }
  function readme(res, name) {
    const s = res.stats, o = res.options, L = [`Expressarte QR tag: ${name}`, ''];
    if (s.batch) {
      L.push(`Batch of ${s.count} tags on ${s.plates} plate${s.plates === 1 ? '' : 's'}.`, '');
      (Array.isArray(res.payload) ? res.payload : []).forEach((p, i) => L.push(`  ${i + 1}: ${p}`));
    } else {
      L.push(`Shape: ${SHAPES[o.shape].label} \u00b7 ${s.size[0].toFixed(1)} \u00d7 ${s.size[1].toFixed(1)} \u00d7 ${s.size[2].toFixed(1)} mm`,
        `QR: ${s.modules} \u00d7 ${s.modules} modules, ${s.moduleMM.toFixed(2)} mm each, quiet zone ${s.quiet}, error correction H`,
        `Payload: ${res.payload}`, '');
    }
    L.push('Filaments');
    res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}  ${f.role === 'code' ? 'raised QR and label' : 'base plate'}`));
    L.push('', 'Printing', '  - Print flat on the bed. The 3MF opens with the base and the raised code on separate filaments.',
      '  - 0.2 mm layers, 3 walls. A dark filament on a light base scans best.',
      `  - Keep modules at least as wide as your nozzle (set to ${o.nozzle} mm here).`);
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, o) {
    o = o || {}; const name = o.name || 'QR tag', base = safe(o.fileBase || name.toLowerCase()) || 'qr_tag';
    const list = [{ name: `${base}.3mf`, data: export3MF(res, o) }];
    const pl = (res.plates || 1) > 1 ? res.parts : placed(res, o.bed || res.options.bed || DEFAULTS.bed);
    pl.forEach((q, i) => list.push({ name: `stl/${String(i + 1).padStart(2, '0')}_${safe(q.name)}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }));
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }

  const api = { STAND, fitField, lineAtUnit, canPrint, DEFAULTS, LIMITS, SHAPES, KINDS, PALETTE, options, payload, wifiString, contactString, parseBatch, build, topView, export3MF, files, readme, modulePolys };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPQRTags = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
