/* Screw-on storage for hard cases (GPCaseStorage): FDM-friendly screw-top canisters,
 * an SD/microSD box, a stacking tower, and drop-in trays with
 * screw lids. Optional 25 mm grid bolts (same threads as the holster) or a 42 mm grid
 * foot that matches the shared Expressarte foot (bin-features.js GRID). Caps use a coarse
 * 45\u00b0 thread (3 or 4 mm pitch, 0.30 mm default clearance) that prints without supports.
 * Meshes are watertight. The case shell is preview-only and never exported. */
(function (G) {
  'use strict';
  const C = G.SplitCore || require('./core'), T = G.StudioTools || require('./tools');
  const holsterApi = () => G.GPHolster || (typeof require === 'function' ? (() => { try { return require('./holster.js'); } catch (e) { return null; } })() : null);
  const lidsApi = () => G.GPLids || (typeof require === 'function' ? (() => { try { return require('./lid-features.js'); } catch (e) { return null; } })() : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };
  const poly = outer => ({ outer, holes: [] });

  const CARD = { sd: { w: 32, d: 24, t: 2.1 }, micro: { w: 15, d: 11, t: 1.0 } };
  const CANISTERS = {
    s: { label: 'Small', id: 28, wall: 1.8 },
    m: { label: 'Medium', id: 40, wall: 2.0 },
    l: { label: 'Large', id: 52, wall: 2.2 },
    xl: { label: 'Extra large', id: 68, wall: 2.4 }
  };
  const TYPES = {
    canister: 'Screw-top canister',
    tower: 'Stacking canister tower',
    cards: 'SD and microSD card box',
    tray: 'Drop-in tray with screw lid',
    kit: 'Mixed storage kit'
  };
  const MOUNTS = {
    none: 'Loose (no mount)',
    grid25: '25 mm grid, small threaded bolts',
    grid25big: '25 mm grid, large threaded bolts',
    grid42: '42 mm grid foot'
  };
  const FITS = { snug: 0.25, standard: 0.30, loose: 0.40 };
  // 42 mm foot (male), same numbers as bin-features.js GRID
  const G42 = { pitch: 42, clear: 0.25, outerPad: 0.5, baseH: 4.75, footBot: 35.6, footMid: 37.2, footTop: 41.5, rBot: 0.8, rMid: 1.6, rTop: 3.75 };
  const PALETTE = [
    { name: 'Safety orange', hex: '#E86A1E' }, { name: 'Graphite', hex: '#3B4048' }, { name: 'Black', hex: '#1E1F22' },
    { name: 'Slate gray', hex: '#6B7280' }, { name: 'Light gray', hex: '#C9CDD2' }, { name: 'Olive drab', hex: '#5B6236' },
    { name: 'Coyote tan', hex: '#B49A6C' }, { name: 'Signal yellow', hex: '#F2C230' }, { name: 'Red', hex: '#C8322E' },
    { name: 'Blue', hex: '#2F5FA7' }, { name: 'Forest green', hex: '#2F6B4F' }, { name: 'White', hex: '#F2F2EE' }
  ];
  const DEFAULTS = {
    type: 'kit', size: 'm', height: 50, sections: 3,
    sd: 4, micro: 8, nx: 1, ny: 1, trayH: 28, mount: 'grid25', label: true, labelText: '',
    labelStyle: 'raised', fit: 'standard', threadClear: null, wall: 0, colors: { body: '#E86A1E', cap: '#3B4048' },
    detail: 'hd', bed: [256, 256], bambu: 'A1', preset: 'A1', boardT: 6.4
  };

  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    o.colors = Object.assign({}, DEFAULTS.colors, raw && raw.colors || {});
    if (!TYPES[o.type]) o.type = 'kit';
    if (!CANISTERS[o.size]) o.size = 'm';
    if (!MOUNTS[o.mount]) o.mount = 'grid25';
    if (!FITS[o.fit]) o.fit = 'standard';
    o.labelStyle = o.labelStyle === 'engraved' ? 'engraved' : 'raised';
    o.height = clamp(num(o.height, 50), 22, 140);
    o.sections = clamp(Math.round(num(o.sections, 3)), 2, 6);
    o.sd = clamp(Math.round(num(o.sd, 4)), 0, 16);
    o.micro = clamp(Math.round(num(o.micro, 8)), 0, 32);
    if (!o.sd && !o.micro) o.sd = 4;
    o.nx = clamp(Math.round(num(o.nx, 1)), 1, 4);
    o.ny = clamp(Math.round(num(o.ny, 1)), 1, 4);
    o.trayH = clamp(num(o.trayH, 28), 16, 80);
    o.boardT = clamp(num(o.boardT, 6.4), 3, 12);
    o.threadClear = o.threadClear == null || o.threadClear === '' ? FITS[o.fit] : clamp(+o.threadClear, 0.15, 0.6);
    o.label = o.label !== false;
    o.labelText = String(o.labelText || '').slice(0, 16);
    return o;
  }

  // ---------------------------------------------------------------- helical 45\u00b0 thread (same flank shape as holster.js)
  function threadSpec(id) {
    const pitch = id < 24 ? 3 : 4, depth = id < 24 ? 1.15 : 1.4, engage = pitch * 2.4;
    return { id, pitch, depth, engage, major: id + 2 * depth, minor: id };
  }
  function flank(u) { return u < 0.15 ? 0 : u < 0.4 ? (u - 0.15) / 0.25 : u < 0.6 ? 1 : u < 0.85 ? (0.85 - u) / 0.25 : 0; }
  function ring(r, z, N) { const L = []; for (let k = 0; k < N; k++) { const a = 2 * Math.PI * k / N; L.push([r * Math.cos(a), r * Math.sin(a), z]); } return L; }
  function stitch(out, A, B, flip) {
    const N = A.length, tri = (a, b, c) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let k = 0; k < N; k++) {
      const a = A[k], b = A[(k + 1) % N], c = B[(k + 1) % N], d = B[k];
      if (flip) { tri(a, d, c); tri(a, c, b); } else { tri(a, b, c); tri(a, c, d); }
    }
  }
  function fan(out, c, R, flip) {
    const N = R.length, tri = (a, b, c0) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], c0[0], c0[1], c0[2]);
    for (let k = 0; k < N; k++) { const a = R[k], b = R[(k + 1) % N]; if (flip) tri(c, a, b); else tri(c, b, a); }
  }
  function closeSoup(out) { let p = Float64Array.from(out); if (C.signedVolume(p) < 0) p = C.flip(p); return p; }
  function femaleR(th, z, z0, k, N) {
    const bore = th.minor / 2, dep = th.depth, Pt = th.pitch;
    if (z < z0 - 1e-9) return bore;
    let u = ((z - z0) / Pt - k / N) % 1; if (u < 0) u += 1;
    const ch = Math.min(Math.max(0, z - z0), Math.max(0, z0 + th.engage - z), 0.7);
    const taper = ch < 0.7 && (z - z0 < 0.7 || z0 + th.engage - z < 0.7) ? ch / 0.7 : 1;
    return bore + dep * flank(u) * taper;
  }
  function maleR(th, tc, z, z0, k, N) {
    const maj = th.major - 2 * tc, mn = th.minor - 2 * tc, dep = (maj - mn) / 2, Pt = th.pitch;
    let u = ((z - z0) / Pt - k / N) % 1; if (u < 0) u += 1;
    const tip = th.engage, ch = Math.min(Math.max(0, z - z0), Math.max(0, z0 + tip - z), 0.7);
    const taper = ch < 0.7 && (z - z0 < 0.7 || z0 + tip - z < 0.7) ? ch / 0.7 : 1;
    return Math.max(mn / 2, mn / 2 + dep * flank(u) * taper);
  }
  function profileRing(rFn, z, N) {
    const L = []; for (let k = 0; k < N; k++) { const a = 2 * Math.PI * k / N, r = rFn(k); L.push([r * Math.cos(a), r * Math.sin(a), z]); } return L;
  }
  // Closed cup: floor at z = 0, walls to z = H, internal thread in the top `engage` mm.
  function bodyCup(th, tc, H, wall, floor, detail) {
    const OR = th.major / 2 + wall, bore = th.minor / 2, zT = H - th.engage;
    const hd = detail === 'hd', N = hd ? 96 : 48, dz = hd ? 0.15 : 0.3;
    const zs = [0, floor];
    const nW = Math.max(2, Math.ceil((zT - floor) / (hd ? 1.2 : 2.5)));
    for (let i = 1; i <= nW; i++) zs.push(floor + (zT - floor) * i / nW);
    const nT = Math.max(6, Math.ceil(th.engage / dz));
    for (let i = 1; i <= nT; i++) zs.push(zT + th.engage * i / nT);
    const zlist = [...new Set(zs.map(z => +z.toFixed(5)))].sort((a, b) => a - b);
    const out = [], outer = [], inner = [];
    for (const z of zlist) {
      outer.push(ring(OR, z, N));
      if (z <= floor + 1e-9) inner.push(null);
      else inner.push(profileRing(k => femaleR(th, z, zT, k, N), z, N));
    }
    // bottom face
    fan(out, [0, 0, 0], outer[0], false);
    // outer wall 0..H
    for (let i = 0; i + 1 < outer.length; i++) stitch(out, outer[i], outer[i + 1], false);
    // inner wall from floor to H (downward-facing = flipped)
    let prev = null;
    for (let i = 0; i < inner.length; i++) {
      if (!inner[i]) continue;
      if (!prev) { // floor top: disk from axis to bore at z = floor
        fan(out, [0, 0, zlist[i]], inner[i], true);
      } else stitch(out, prev, inner[i], true);
      prev = inner[i];
    }
    // top rim: outer to inner at z = H
    stitch(out, outer[outer.length - 1], inner[inner.length - 1], false);
    return { p: closeSoup(out), OR, H, th };
  }
  // Cap: closed top at z = 0 (print bed), solid male thread pointing +z.
  function capSolid(th, tc, wall, topT, detail, label) {
    const OR = th.major / 2 + wall + 0.8, tip = th.engage + 0.6;
    const hd = detail === 'hd', N = hd ? 96 : 48, dz = hd ? 0.12 : 0.28;
    const zs = [0, topT];
    const nT = Math.max(6, Math.ceil(tip / dz));
    for (let i = 1; i <= nT; i++) zs.push(topT + tip * i / nT);
    const out = [], rings = [];
    rings.push(ring(OR, 0, N));
    rings.push(ring(OR, topT, N));
    for (let i = 1; i <= nT; i++) {
      const z = topT + tip * i / nT;
      rings.push(profileRing(k => maleR(th, tc, z, topT, k, N), z, N));
    }
    fan(out, [0, 0, 0], rings[0], false);
    for (let i = 0; i + 1 < rings.length; i++) stitch(out, rings[i], rings[i + 1], false);
    fan(out, [0, 0, rings[rings.length - 1][0][2]], rings[rings.length - 1], true);
    let p = closeSoup(out);
    if (label && label.mesh) p = concatClosed(p, label.mesh);
    return { p, H: topT + tip, OR, threadLen: tip };
  }
  // Mid tower section: a solid male plug plus a cup, both closed, stacked.
  function malePlug(th, tc, len, detail) {
    const hd = detail === 'hd', N = hd ? 96 : 48, dz = hd ? 0.12 : 0.28;
    const n = Math.max(6, Math.ceil(len / dz)), out = [], rings = [];
    for (let i = 0; i <= n; i++) {
      const z = len * i / n;
      rings.push(profileRing(k => maleR(th, tc, z, 0, k, N), z, N));
    }
    fan(out, [0, 0, 0], rings[0], false);
    for (let i = 0; i + 1 < rings.length; i++) stitch(out, rings[i], rings[i + 1], false);
    fan(out, [0, 0, len], rings[rings.length - 1], true);
    return closeSoup(out);
  }
  function stackSection(th, tc, H, wall, detail) {
    const maleH = th.engage + 0.4;
    if (H < maleH + th.engage + 8) throw Error('Each tower section needs more height for the threads.');
    const cup = bodyCup(th, tc, H - maleH, wall, 1.8, detail);
    const p = concatClosed(malePlug(th, tc, maleH, detail), shift(cup.p, 0, 0, maleH));
    return { p, H, OR: cup.OR };
  }
    function concatClosed(a, b) {
    const p = new Float64Array(a.length + b.length);
    p.set(a, 0); p.set(b, a.length);
    return C.signedVolume(p) < 0 ? C.flip(p) : p;
  }
  function shift(p, x, y, z) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + x; q[i + 1] = p[i + 1] + y; q[i + 2] = p[i + 2] + z; } return q; }
  function rotX(p, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { const y = p[i + 1], z = p[i + 2]; q[i] = p[i]; q[i + 1] = y * c - z * s; q[i + 2] = y * s + z * c; }
    return q;
  }

  // ---------------------------------------------------------------- labels
  function labelMesh(text, style, cx, cy, z0, z1, maxW, maxH) {
    const L = lidsApi(); if (!L || !text) return null;
    const letters = L.textPolys(String(text).toUpperCase(), cx, cy, Math.min(maxH * 0.62, 8), maxW);
    if (!letters || !letters.length) return null;
    const panel = [poly(T.roundRect(cx - maxW / 2, cy - maxH / 2, cx + maxW / 2, cy + maxH / 2, Math.min(2, maxH / 3), 12))];
    const cut = T.interPolys(letters, panel);
    if (style === 'engraved') {
      // a shallow recess over the panel, letters deeper \u2014 for a cap top at z=0..topT we cut from the bed face
      return T.steppedExtrude([{ z0, z1, polys: cut.length ? cut : panel }]);
    }
    const raised = cut.length ? T.steppedExtrude([{ z0, z1, polys: cut }]) : null;
    return raised;
  }

  // ---------------------------------------------------------------- 42 mm foot (male)
  function footLayers(nx, ny) {
    const W = G42.pitch * nx - G42.outerPad, D = G42.pitch * ny - G42.outerPad;
    const layers = [];
    const at = (s, r, z0, z1) => {
      const polys = [];
      for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
        const cx = G42.pitch * (ix + 0.5) - G42.outerPad / 2, cy = G42.pitch * (iy + 0.5) - G42.outerPad / 2, h = s / 2;
        polys.push(poly(T.roundRect(cx - h, cy - h, cx + h, cy + h, r, 24)));
      }
      layers.push({ z0, z1, polys });
    };
    // short 45\u00b0 35.6\u219237.2 over 0.8, straight, long 45\u00b0 37.2\u219241.5 over 2.15
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4, s = G42.footBot + (G42.footMid - G42.footBot) * t, r = G42.rBot + (G42.rMid - G42.rBot) * t;
      at(s, r, 0.8 * k / 4, 0.8 * (k + 1) / 4);
    }
    at(G42.footMid, G42.rMid, 0.8, 2.6);
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4, s = G42.footMid + (G42.footTop - G42.footMid) * t, r = G42.rMid + (G42.rTop - G42.rMid) * t;
      at(s, r, 2.6 + 2.15 * k / 4, 2.6 + 2.15 * (k + 1) / 4);
    }
    return { layers, W, D, H: G42.baseH };
  }
  function gridFootMesh(nx, ny) { return T.steppedExtrude(footLayers(nx, ny).layers); }
  function boxMesh(w, d, h, wall, floor, radius) {
    const R = Math.min(radius, w / 2 - 0.2, d / 2 - 0.2);
    const outer = [poly(T.roundRect(0, 0, w, d, R, 20))];
    const inner = [poly(T.roundRect(wall, wall, w - wall, d - wall, Math.max(0.4, R - wall), 20))];
    const layers = [{ z0: 0, z1: floor, polys: outer }];
    layers.push({ z0: floor, z1: h, polys: T.diffPolys(outer, inner) });
    return T.steppedExtrude(layers);
  }

  // ---------------------------------------------------------------- 25 mm grid mount (bolts)
  function grid25(o) {
    const H = holsterApi(); if (!H) return null;
    const big = o.mount === 'grid25big', th = big ? H.THREADS.large : H.THREADS.small;
    const mat = H.MATERIALS.petg, bolt = H.boltMesh(th, mat.thread, o.boardT, 3.2, o.detail);
    return { th, bolt, pitch: 25, head: th.head, hole: th.major + 0.8, boardT: o.boardT };
  }
  function flangeFor(OR, o, holes) {
    // a disc or rounded pad under the body, 3.2 mm thick, with counterbored through-holes
    const g = grid25(o); if (!g || o.mount === 'none' || o.mount === 'grid42') return null;
    const padR = Math.max(OR + 2.5, (holes === 1 ? g.head / 2 : 25 / 2) + g.head / 2 + 3);
    const layers = [{ z0: -3.2, z1: 0, polys: [poly(T.circle(0, 0, padR, 64))] }];
    const pts = holes === 1 ? [[0, 0]] : holes === 2 ? [[-12.5, 0], [12.5, 0]] : [[-12.5, -12.5], [12.5, -12.5], [-12.5, 12.5], [12.5, 12.5]];
    const shaft = pts.map(([x, y]) => poly(T.circle(x, y, g.th.major / 2 + 0.4, 36)));
    const bore = pts.map(([x, y]) => poly(T.circle(x, y, g.head / 2 + 0.4, 36)));
    // through shaft; head pocket from z=-0.4 to 0 (into the body floor) would weaken a thin floor, so pocket is in the flange
    const solid = T.steppedExtrude([
      { z0: -3.2, z1: -0.8, polys: T.diffPolys(layers[0].polys, shaft) },
      { z0: -0.8, z1: 0, polys: T.diffPolys(layers[0].polys, bore) }
    ]);
    return { p: solid, pts, padR, g, holes: pts.length };
  }

  // ---------------------------------------------------------------- module builders
  function defaultLabel(o, fallback) { return (o.label && (o.labelText || fallback) || '').trim(); }

  function makeJar(th, o, H, wall, labelText) {
    const floor = 2.0, topT = 2.4;
    const body = bodyCup(th, o.threadClear, H, wall, floor, o.detail);
    let bodyP = body.p;
    let fl = null;
    if (o.mount === 'grid25' || o.mount === 'grid25big') {
      const holes = body.OR > 28 ? 2 : 1;
      fl = flangeFor(body.OR, o, holes);
      if (fl) bodyP = concatClosed(bodyP, fl.p);
    }
    if (o.mount === 'grid42') {
      const nx = Math.max(1, Math.ceil((2 * body.OR + 2) / G42.pitch)), ny = nx;
      const foot = gridFootMesh(nx, ny);
      const W = G42.pitch * nx - G42.outerPad, D = G42.pitch * ny - G42.outerPad;
      bodyP = concatClosed(shift(bodyP, W / 2, D / 2, G42.baseH), foot);
      body.offset = [W / 2, D / 2, G42.baseH];
    }
    const lab = o.label ? labelMesh(labelText, o.labelStyle, 0, 0, o.labelStyle === 'raised' ? 0 : 0, o.labelStyle === 'raised' ? 0.7 : 0.5, Math.max(12, body.OR * 1.4), 8) : null;
    // raised letters sit on the bed face of the cap (z=0); for engraved, letters are a recess \u2014 skip subtract without CSG, just raise
    const capLab = lab && o.labelStyle === 'raised' ? { mesh: lab } : null;
    const cap = capSolid(th, o.threadClear, wall, topT, o.detail, capLab);
    const rimZ = H + (o.mount === 'grid42' ? G42.baseH : 0);
    return { body: bodyP, cap: cap.p, bodyH: rimZ + (fl ? 3.2 : 0), rimZ, capH: cap.H, OR: body.OR, flange: fl, capPrint: cap.p, th };
  }

  function canister(o) {
    const c = CANISTERS[o.size], wall = o.wall > 0 ? o.wall : c.wall, th = threadSpec(c.id);
    const label = defaultLabel(o, c.label.toUpperCase());
    const j = makeJar(th, o, o.height, wall, label);
    const parts = [
      { name: `${c.label} canister`, kind: 'body', role: 'body', p: j.body, local: j.body, color: o.colors.body },
      { name: `${c.label} canister cap`, kind: 'cap', role: 'cap', p: wornCap(j, j.rimZ), local: j.cap, color: o.colors.cap }
    ];
    addBolts(parts, j, o);
    return { parts, height: j.bodyH + 2, width: 2 * j.OR + 4, depth: 2 * j.OR + 4, label, info: { kind: 'canister', size: o.size, id: c.id, thread: th } };
  }
  function wornCap(j, bodyH) {
    // cap local: top at z=0, thread +z. Worn: flip 180\u00b0 about x and sit on the rim (bodyH).
    const flipped = rotX(j.cap, Math.PI);
    // after rotX 180, z' = -z, so the top (z=0) goes to 0 and the thread goes negative; shift up by bodyH
    return shift(flipped, 0, 0, bodyH);
  }
  function addBolts(parts, j, o) {
    if (!j.flange || !j.flange.g) return;
    j.flange.pts.forEach((pt, i) => {
      const b = shift(j.flange.g.bolt.p, pt[0], pt[1], -3.2 - (j.flange.g.bolt.length - j.flange.g.boardT - 3.2));
      // bolt prints head-down; preview: head in the flange pocket, thread through the board (-z)
      const preview = shift(rotX(j.flange.g.bolt.p, Math.PI), pt[0], pt[1], -0.8);
      parts.push({ name: `Grid bolt${j.flange.pts.length > 1 ? ' ' + (i + 1) : ''}`, kind: 'bolt', role: 'bolt', p: preview, local: j.flange.g.bolt.p, color: '#3B4048' });
    });
  }

  function tower(o) {
    const c = CANISTERS[o.size], wall = o.wall > 0 ? o.wall : c.wall, th = threadSpec(c.id);
    const secH = o.height, n = o.sections;
    const base = makeJar(th, o, secH, wall, defaultLabel(o, c.label.toUpperCase()));
    const parts = [
      { name: `${c.label} tower base`, kind: 'body', role: 'body', p: base.body, local: base.body, color: o.colors.body },
      { name: `${c.label} tower cap`, kind: 'cap', role: 'cap', p: wornCap(base, secH * n - th.engage * (n - 1)), local: base.cap, color: o.colors.cap }
    ];
    // mid sections
    let z = secH;
    for (let i = 0; i < n - 1; i++) {
      const mid = stackSection(th, o.threadClear, secH, wall, o.detail);
      parts.push({ name: `${c.label} tower section ${i + 2}`, kind: 'section', role: 'body', p: shift(mid.p, 0, 0, z - th.engage), local: mid.p, color: o.colors.body });
      z += secH - th.engage;
    }
    // fix cap preview height: top of last section
    const capIdx = parts.findIndex(q => q.kind === 'cap');
    parts[capIdx].p = wornCap(base, z);
    addBolts(parts, base, o);
    return { parts, height: z + 3, width: 2 * base.OR + 4, depth: 2 * base.OR + 4, info: { kind: 'tower', size: o.size, sections: n, thread: th } };
  }

  function cardBox(o) {
    const wall = o.wall > 0 ? o.wall : 1.8, gap = 1.2;
    const sd = CARD.sd, mic = CARD.micro;
    const slotSD = { w: sd.w + 0.6, d: sd.d + 0.5, t: sd.t + 0.45 };
    const slotM = { w: mic.w + 0.5, d: mic.d + 0.4, t: mic.t + 0.4 };
    const colsSD = Math.min(o.sd, 4) || 0, colsM = Math.min(o.micro, 8) || 0;
    const rowsSD = colsSD ? Math.ceil(o.sd / colsSD) : 0, rowsM = colsM ? Math.ceil(o.micro / colsM) : 0;
    const blockSD = colsSD ? [colsSD * slotSD.w + (colsSD + 1) * gap, rowsSD * (slotSD.d + gap) + gap] : [0, 0];
    const blockM = colsM ? [colsM * slotM.w + (colsM + 1) * gap, rowsM * (slotM.d + gap) + gap] : [0, 0];
    const innerW = Math.max(blockSD[0], blockM[0], 28), innerD = blockSD[1] + (blockSD[1] && blockM[1] ? gap : 0) + blockM[1] + 2;
    const id = Math.max(40, Math.ceil(Math.hypot(innerW, innerD) / 2) * 2 + 4);
    const th = threadSpec(id), H = Math.max(slotSD.t, slotM.t) + 10 + th.engage;
    const jar = makeJar(th, o, H, wall, defaultLabel(o, 'CARDS'));
    // a drop-in rack with blind slots (pockets, not through holes) so the mesh stays closed
    const rackR = th.minor / 2 - 0.6, rackT = Math.max(slotSD.t, slotM.t) + 1.6;
    const disc = [poly(T.circle(0, 0, rackR, 64))];
    const pockets = [];
    const add = (n, cols, sw, sd_, x0, y0) => {
      for (let i = 0; i < n; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        pockets.push(poly(T.roundRect(x0 + c * (sw + gap), y0 + r * (sd_ + gap), x0 + c * (sw + gap) + sw, y0 + r * (sd_ + gap) + sd_, 0.5, 6)));
      }
    };
    const x0 = -innerW / 2 + gap, ySD = innerD / 2 - gap - (blockSD[1] || 0);
    if (o.sd) add(o.sd, colsSD, slotSD.w, slotSD.d, x0, ySD);
    const yM = -innerD / 2 + gap;
    if (o.micro) add(o.micro, colsM, slotM.w, slotM.d, x0, yM);
    const layers = [{ z0: 0, z1: 1.2, polys: disc }];
    if (pockets.length) layers.push({ z0: 1.2, z1: rackT, polys: T.diffPolys(disc, pockets) });
    else layers.push({ z0: 1.2, z1: rackT, polys: disc });
    const rack = T.steppedExtrude(layers);
    const zOff = o.mount === 'grid42' ? G42.baseH : 0;
    const parts = [
      { name: 'SD card box', kind: 'body', role: 'body', p: jar.body, local: jar.body, color: o.colors.body },
      { name: 'SD card rack', kind: 'rack', role: 'body', p: shift(rack, 0, 0, zOff + 2), local: rack, color: o.colors.body },
      { name: 'SD card box cap', kind: 'cap', role: 'cap', p: wornCap(jar, jar.rimZ), local: jar.cap, color: o.colors.cap }
    ];
    addBolts(parts, jar, o);
    return { parts, height: jar.bodyH + 2, width: 2 * jar.OR + 4, depth: 2 * jar.OR + 4, info: { kind: 'cards', sd: o.sd, micro: o.micro, id, thread: th } };
  }

  function dropTray(o) {
    const nx = o.nx, ny = o.ny, wall = o.wall > 0 ? o.wall : 1.8;
    const W = G42.pitch * nx - G42.outerPad, D = G42.pitch * ny - G42.outerPad;
    const id = Math.max(20, Math.floor(Math.min(W, D) - 2 * wall - 4));
    const th = threadSpec(id), H = o.trayH;
    const so = Object.assign({}, o, { mount: 'grid42', height: H });
    const j = makeJar(th, so, H, wall, defaultLabel(o, 'TRAY'));
    const parts = [
      { name: `${nx}\u00d7${ny} screw-lid tray`, kind: 'body', role: 'body', p: j.body, local: j.body, color: o.colors.body },
      { name: `${nx}\u00d7${ny} tray cap`, kind: 'cap', role: 'cap', p: wornCap(j, j.rimZ), local: j.cap, color: o.colors.cap }
    ];
    return { parts, height: j.bodyH + 2, width: Math.max(W, 2 * j.OR + 2), depth: Math.max(D, 2 * j.OR + 2), info: { kind: 'tray', nx, ny, id, thread: th } };
  }

  function kit(o) {
    const items = [];
    const one = (type, extra) => buildOne(Object.assign({}, o, extra, { type, sections: extra && extra.sections || 3 }));
    // a full-looking floor of boxes: every canister size, two towers, a card box, and two trays
    items.push(one('canister', { size: 'xl', height: 50, labelText: 'XL' }));
    items.push(one('canister', { size: 'l', height: 55, labelText: 'LARGE' }));
    items.push(one('canister', { size: 'm', height: 50, labelText: o.labelText || 'MED' }));
    items.push(one('canister', { size: 'm', height: 36, labelText: 'SHORT' }));
    items.push(one('canister', { size: 's', height: 48, labelText: 'SMALL' }));
    items.push(one('canister', { size: 's', height: 36, labelText: 'MINI' }));
    items.push(one('tower', { size: 'm', height: 40, sections: 3, labelText: 'STACK' }));
    items.push(one('tower', { size: 's', height: 36, sections: 3, labelText: 'STACK' }));
    items.push(one('cards', { sd: 4, micro: 8, labelText: 'CARDS', mount: o.mount === 'grid42' ? 'grid42' : o.mount }));
    items.push(one('tray', { nx: 2, ny: 1, trayH: 28, labelText: 'TRAY', mount: 'grid42' }));
    items.push(one('tray', { nx: 1, ny: 1, trayH: 28, labelText: 'BIN', mount: 'grid42' }));
    return packKit(items, o);
  }

  function buildOne(o) {
    o = options(o);
    if (o.type === 'canister') return canister(o);
    if (o.type === 'tower') return tower(o);
    if (o.type === 'cards') return cardBox(o);
    if (o.type === 'tray') return dropTray(o);
    return kit(o);
  }

  function packKit(items, o) {
    const gap = 8, parts = [];
    let x = 0, y = 0, rowH = 0, maxX = 0, maxZ = 0;
    items.forEach((it, idx) => {
      const w = it.width || 40, d = it.depth || 40;
      if (x + w > 300 && x > 0) { x = 0; y += rowH + gap; rowH = 0; }
      const dx = x + w / 2, dy = y + d / 2; // roughly; parts are often centered on 0,0
      it.parts.forEach(q => {
        const name = items.length > 1 && !/ /g.test(q.name + idx) ? q.name : q.name;
        parts.push({ ...q, p: shift(q.p, x, y, 0) });
      });
      x += w + gap; rowH = Math.max(rowH, d); maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, it.height || 0);
    });
    return { parts, height: maxZ, width: maxX, depth: y + rowH, info: { kind: 'kit', items: items.map(i => i.info) } };
  }

  function finalize(res, o) {
    const warnings = [];
    res.parts.forEach(q => {
      if (!q.local) q.local = q.p;
      const cl = C.checkClosed(q.local);
      if (cl && cl.closed === false) warnings.push(`${q.name} did not close cleanly.`);
    });
    const cols = [];
    res.parts.forEach(q => { const c = (q.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const PL = G.GPPlates || (typeof require === 'function' ? require('./plates') : null);
    let plates = [], unfit = [];
    if (PL && PL.arrange) {
      const usable = (bed, preset) => { const offY = ['P1S', 'P1P', 'X1 Carbon'].includes(preset) ? 24 : 0; return [bed[0] - 13, bed[1] - offY - 13]; };
      const [W, D] = usable(o.bed, o.preset || o.bambu);
      const ar = PL.arrange(res.parts.map(q => ({ name: q.name, p: q.local, color: q.color })), W, D, { gap: 5 });
      plates = ar.plates; unfit = ar.unfit || [];
      if (unfit.length) warnings.push(`${unfit.length} piece${unfit.length === 1 ? ' is' : 's are'} too big for this printer.`);
    }
    const tris = res.parts.reduce((s, q) => s + (q.local ? q.local.length / 9 : 0), 0);
    return {
      options: o, parts: res.parts, plates, filaments: cols.map(c => ({ color: c })), warnings,
      stats: {
        type: o.type, typeLabel: TYPES[o.type], mount: o.mount, mountLabel: MOUNTS[o.mount],
        pieces: res.parts.length, plates: plates.length, tris: Math.round(tris), colors: cols.length,
        fit: o.threadClear, height: res.height, width: res.width, depth: res.height && res.depth, info: res.info
      }
    };
  }

  function build(raw) { return finalize(buildOne(options(raw)), options(raw)); }

  function export3MF(res, opt) {
    opt = opt || {};
    const PL = G.GPPlates || (typeof require === 'function' ? require('./plates') : null);
    if (!PL) throw Error('Plate layout is not available.');
    const o = res.options, bed = o.bed, offY = ['P1S', 'P1P', 'X1 Carbon'].includes(o.preset || o.bambu) ? 24 : 0;
    const W = bed[0] - 13, D = bed[1] - offY - 13, off = [(bed[0] - W) / 2, (bed[1] - D) / 2];
    return PL.plates3MF(res.plates, { title: opt.name || 'Expressarte case storage', bambu: opt.bambu === undefined ? o.bambu : opt.bambu, bed, offset: off, filaments: res.filaments });
  }
  function files(res, opt) {
    opt = opt || {};
    const base = opt.fileBase || 'case_storage', out = [], seen = new Set();
    res.parts.forEach(pt => {
      let n = `${base}_${pt.name.replace(/[^\w]+/g, '_').toLowerCase()}`.replace(/_+/g, '_').replace(/_+$/, '');
      while (seen.has(n)) n += '_b'; seen.add(n);
      out.push({ name: `${n}.stl`, data: new Uint8Array(C.writeSTL(pt.local, pt.name)) });
    });
    out.push({ name: `${base}.3mf`, data: export3MF(res, opt) });
    const s = res.stats, f = v => (Math.round((v || 0) * 10) / 10).toString();
    const L = ['Expressarte hard case screw-on storage',
      `Set: ${s.typeLabel} \u00b7 mount: ${s.mountLabel}`,
      `Thread clearance: ${f(s.fit)} mm (coarse 45\u00b0 thread, made for FDM; 2 to 3 turns of engagement).`,
      `Pieces: ${s.pieces} on ${s.plates} build plate${s.plates === 1 ? '' : 's'}`, '', 'Filaments'];
    res.filaments.forEach((x, i) => L.push(`  ${i + 1}: ${x.color}`));
    L.push('', 'Printing',
      '  - Print bodies opening up, caps with the top on the bed (thread pointing up). No supports.',
      '  - PETG or ASA handles a hot car better than PLA.',
      '  - If a cap feels tight, reprint it with the loose thread fit (0.40 mm). If it is sloppy, use snug (0.25 mm).',
      '  - 25 mm grid bolts print head down, 100% infill or 5 walls, and screw into the case grid board.',
      '  - 42 mm grid feet drop into the case 42 mm grid floor (same foot as the drawer bins).',
      ...(res.warnings || []).map(w => '  - ' + w));
    out.push({ name: `${base}_NOTES.txt`, data: L.join('\n') });
    return out;
  }
  function gateInfo(res) {
    const why = [];
    if (res.stats.pieces > 4) why.push(`${res.stats.pieces} printed pieces (free: up to 4)`);
    return why;
  }

  const api = { TYPES, MOUNTS, CANISTERS, CARD, FITS, PALETTE, DEFAULTS, G42, options, threadSpec, build, export3MF, files, gateInfo, bodyCup, capSolid, gridFootMesh, footLayers };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPCaseStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
