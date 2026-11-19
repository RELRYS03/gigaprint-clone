/* Expressarte shared hard-case mockup: a display-only, unbranded rolling hard case built with Manifold, for tool
   previews (never exported). Thick shell with rounded boxy corners, a raised rim along the lid parting line, lid
   stiffening ridges, molded ribs, double-throw latches with guard ribs, reinforced padlock hasps, a purge valve, a
   continuous hinge, a retractable pull handle, wheels in molded wheel wells and rubber feet.

   Case frame (mm): the case stands upright, the top face is z = 0 (a recessed mount pocket can sink below it),
   x runs across the top face (width), y through the case (lid on the -y side, base on +y), z is up, so the
   case spans x -W/2..W/2, y y0..y0+D, z -H..0. build(M, spec, opt) returns parts
   [{ name, kind: 'case', mat, color, p: Float32Array triangle soup }].

   spec: { W, D, H, lidD, wheels, latches, layout: 'end' | 'front' }
     'end'   : the carry handle sits on the top end (rolling carry-on style); latches on the +x side, hinge on -x.
     'front' : the handle sits on the latch face (briefcase style): the top face shows the parting line with the
               latches either side of the handle mount; the hinge is on the bottom.
   opt: { y0, pocket: [x0, y0, x1, y1, depth] (mount pocket in the top face), keepX: [x0, x1] (no latches here),
          trolley: [x0, x1] (pull-handle channel), handle: true (a folded carry handle on the top face),
          plate: { L, H, T, bevel } (a recessed name plate pocket on the latch side, next to the side handle; plateSpot() says where),
          cutLid / cutBase: Manifolds in the case frame taken out of the lid / base shell (a real measured interior),
          addShell / cutShell: Manifolds in the case frame added to / taken out of the shell before the lid split
          (the name plate's pads, pockets and badge recess), handleY: where the folded top handle sits (briefcase layout),
          keep: a Manifold the wheel wells and wheels stay out of (that interior plus a skin) } */
(function (G) {
  'use strict';
  const IN = 25.4;
  // exterior sizes (in): [height standing, top-face width, depth through, lid depth, wheels, latches, layout]
  // From the makers' published exterior dimensions; lid depth from the published lid interior plus the wall.
  // Official exteriors from each model's current pelican.com product page (2026-11-15).
  // lidD is the published lid interior plus a 0.60 in wall, except where a previous fit-tested
  // value was already within 0.1 in (1510, 1400, 1700 which has no published lid split).
  // Apache 5800 exteriors from the Harbor Freight listing (21-7/8 \u00d7 13-3/4 \u00d7 9 in).
  const SPECS = {
    p1150: [7.80, 9.44, 4.29, 1.35, false, 2, 'front'],
    p1200: [9.75, 10.67, 4.86, 1.79, false, 2, 'front'],
    p1300: [9.76, 10.70, 6.89, 1.79, false, 2, 'front'],
    p1400: [11.62, 13.37, 6.00, 1.90, false, 2, 'front'],
    p1440: [19.70, 12.00, 18.00, 2.60, true, 2, 'end'],
    p1450: [13.00, 16.44, 6.82, 2.35, false, 2, 'front'],
    p1460: [20.85, 12.73, 12.75, 5.51, true, 2, 'end'],
    p1495: [17.25, 21.62, 4.87, 1.72, false, 2, 'front'],
    p1500: [14.06, 18.50, 6.93, 2.41, false, 2, 'front'],
    p1510: [22.00, 13.81, 9.00, 2.40, true, 2, 'end'],
    p1520: [15.77, 19.78, 7.41, 2.39, false, 2, 'front'],
    p1525air: [13.97, 21.96, 7.49, 2.60, false, 2, 'front'],
    p1535air: [21.96, 13.97, 8.98, 2.60, true, 2, 'end'],
    p1550: [17.20, 20.66, 8.40, 2.35, false, 2, 'front'],
    p1555air: [15.46, 24.76, 8.24, 2.60, false, 2, 'front'],
    p1557air: [19.18, 15.79, 10.50, 2.60, true, 2, 'end'],
    p1560: [22.07, 17.92, 10.42, 2.60, true, 2, 'end'],
    p1600: [19.36, 24.39, 8.79, 2.35, false, 2, 'front'],
    p1605air: [16.77, 28.87, 9.12, 2.60, false, 2, 'front'],
    p1607air: [24.13, 18.80, 13.25, 2.60, true, 3, 'end'],
    p1610: [24.83, 19.69, 11.88, 2.65, true, 3, 'end'],
    p1615air: [32.58, 18.40, 11.02, 2.60, true, 3, 'end'],
    p1620: [24.76, 19.57, 13.90, 2.61, true, 3, 'end'],
    p1637air: [26.61, 20.65, 14.87, 2.60, true, 3, 'end'],
    p1650: [31.59, 20.47, 12.45, 2.41, true, 3, 'end'],
    p1700: [38.47, 16.42, 6.14, 1.70, true, 3, 'end'],
    a5800: [21.88, 13.75, 9.00, 2.55, true, 2, 'end'],
    a4800: [15.50, 20.31, 7.38, 2.40, false, 2, 'front'],
    a3800: [13.00, 16.50, 6.75, 2.40, false, 2, 'front'],
    // Apache 1800, 2800 and 9800 exteriors from the published specs (9.25 \u00d7 7.5 \u00d7 4.38, 13.5 \u00d7 11.38 \u00d7 6, 53 \u00d7 16 \u00d7 6.13 in)
    a1800: [7.50, 9.25, 4.38, 1.35, false, 2, 'front'],
    a2800: [11.38, 13.50, 6.00, 2.20, false, 2, 'front'],
    a9800: [16.00, 53.00, 6.13, 1.98, false, 2, 'front']
  };
  function spec(id) {
    const s = SPECS[id] || SPECS.p1510;
    return { H: s[0] * IN, W: s[1] * IN, D: s[2] * IN, lidD: s[3] * IN, wheels: s[4], latches: s[5], layout: s[6] };
  }
  const COL = { shell: '#232528', lid: '#26282C', trim: '#1B1C1F', rubber: '#141516', steel: '#B9BDC3', valve: '#2E3034' };

  // the shell frame both build() and plateSpot() work from
  function frame(sp, opt) {
    const front = sp.layout === 'front', rimT = 3.2, ridgeT = 5, Y0o = opt.y0 != null ? opt.y0 : -sp.D / 2;
    const W = sp.W - 2 * rimT, H = sp.H - 2 * rimT, D = sp.D - ridgeT * (front ? 1 : 2), y0 = Y0o + ridgeT, y1 = y0 + D;
    const nL = sp.latches || 2, zs = []; for (let i = 0; i < nL; i++) zs.push(-H + H * (i + 1) / (nL + 1));
    return { front, rimT, ridgeT, Y0o, W, H, D, y0, y1, X0: -W / 2, X1: W / 2, Zb: -H, yp: Y0o + sp.lidD, nL, zs };
  }
  // Where a name plate pocket sits: on the latch side of the base, just past the side handle's hinge, its long side
  // running along the case height. Plate frame -> case frame: X = Xf + z, Y = Ya + y, Z = zc + L/2 - x (reads
  // left to right with the letters pointing at the lid when the case lies on its back). null for the briefcase layout.
  function plateSpot(sp, opt, plate) {
    if (!plate || sp.layout === 'front') return null;
    const F = frame(sp, opt || {}), bez = 1.5;
    const zc = F.nL === 2 ? (F.zs[0] + F.zs[1]) / 2 : -F.H / 2, yh = (F.yp + F.y1) / 2 + 6, Ya = yh + 15;
    if (Ya + plate.H > F.y1 - 8) return null;
    return { Xf: F.X1 + bez - plate.T, Xface: F.X1, bezel: bez, Ya, zc, L: plate.L, H: plate.H, T: plate.T, bevel: plate.bevel };
  }
  function build(M, sp, opt) {
    opt = opt || {};
    const bin = [], k = x => { bin.push(x); return x; }, Mf = M.Manifold;
    try {
      const box = (x0, y0, z0, x1, y1, z1) => k(k(Mf.cube([x1 - x0, y1 - y0, z1 - z0], false)).translate([x0, y0, z0]));
      const rbox = (x0, y0, z0, x1, y1, z1, r, seg) => { // a box with every edge and corner rounded to r
        r = Math.max(0.2, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01, (z1 - z0) / 2 - 0.01));
        const s = k(Mf.sphere(r, seg || 24)), pts = [];
        for (const x of [x0 + r, x1 - r]) for (const y of [y0 + r, y1 - r]) for (const z of [z0 + r, z1 - r]) pts.push(k(s.translate([x, y, z])));
        return k(Mf.hull(pts));
      };
      // a rounded rectangle in (x, z) extruded along y, with vertical-edge radius r
      const slabY = (x0, z0, x1, z1, r, y0, y1) => {
        r = Math.max(0.2, Math.min(r, (x1 - x0) / 2 - 0.01, (z1 - z0) / 2 - 0.01));
        const c = k(k(Mf.cylinder(y1 - y0, r, r, 24)).rotate([-90, 0, 0])), pts = [];
        for (const x of [x0 + r, x1 - r]) for (const z of [z0 + r, z1 - r]) pts.push(k(c.translate([x, y0, z])));
        return k(Mf.hull(pts));
      };
      const slabX = (y0, z0, y1, z1, r, x0, x1) => {
        r = Math.max(0.2, Math.min(r, (y1 - y0) / 2 - 0.01, (z1 - z0) / 2 - 0.01));
        const c = k(k(Mf.cylinder(x1 - x0, r, r, 24)).rotate([0, 90, 0])), pts = [];
        for (const y of [y0 + r, y1 - r]) for (const z of [z0 + r, z1 - r]) pts.push(k(c.translate([x0, y, z])));
        return k(Mf.hull(pts));
      };
      const slabZ = (x0, y0, x1, y1, r, z0, z1) => {
        r = Math.max(0.2, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01));
        const c = k(Mf.cylinder(z1 - z0, r, r, 24)), pts = [];
        for (const x of [x0 + r, x1 - r]) for (const y of [y0 + r, y1 - r]) pts.push(k(c.translate([x, y, z0])));
        return k(Mf.hull(pts));
      };
      const cylX = (r, y, z, x0, x1, n) => k(k(k(Mf.cylinder(x1 - x0, r, r, n || 32)).rotate([0, 90, 0])).translate([x0, y, z]));
      const cylY = (r, x, z, y0, y1, n) => k(k(k(Mf.cylinder(y1 - y0, r, r, n || 32)).rotate([-90, 0, 0])).translate([x, y0, z]));
      const cylZ = (r, x, y, z0, z1, n) => k(k(Mf.cylinder(z1 - z0, r, r, n || 32)).translate([x, y, z0]));
      const U = list => { list = list.filter(m => m && !m.isEmpty()); return list.length === 1 ? list[0] : k(Mf.union(list)); };
      const sub = (a, b) => k(a.subtract(b)), and = (a, b) => k(a.intersect(b));

      const { front, rimT, ridgeT, Y0o, W, H, D, y0, y1, X0, X1, Zb } = frame(sp, opt);
      const R = Math.min(30, D * 0.16), yp = Y0o + sp.lidD; // corner radius, parting plane
      const parts = [], add = (name, m, mat, color) => { if (m && !m.isEmpty()) parts.push({ name, m, mat, color }); };
      // ---- shell: one rounded block, then split into lid and base at the parting plane
      let shell = rbox(X0, y0, Zb, X1, y1, 0, R, 32);
      // raised rim either side of the parting line (thicker lip, like the molded tongue and groove)
      const rim = and(rbox(X0 - 3.2, y0 - 3.2, Zb - 3.2, X1 + 3.2, y1 + 3.2, 3.2, R + 3.2, 32), box(X0 - 9, yp - 9, Zb - 9, X1 + 9, yp + 11, 9));
      shell = U([shell, rim]);
      // molded wheel wells at the bottom back corners
      const wr = Math.min(42, D * 0.19), ww = Math.max(30, wr * 0.75);
      const wells = [];
      if (sp.wheels && !front) for (const sx of [-1, 1]) {
        const xa = sx < 0 ? X0 - 5 : X1 - ww - 14, xb = sx < 0 ? X0 + ww + 14 : X1 + 5;
        wells.push(slabX(y1 - 2 * wr - 14, Zb - 5, y1 + 5, Zb + 2 * wr + 10, wr * 0.55, xa, xb));
      }
      // stiffening ridges on the big lid face and the back face: a raised frame and level ribs inside a recessed panel
      const ridgeSet = (yFace, out) => {
        const inset = Math.min(W, H) * 0.07 + 10, t = 5, fx0 = X0 + inset, fx1 = X1 - inset, fz0 = Zb + inset + (out > 0 && sp.wheels ? 2 * wr : 0), fz1 = -inset;
        const ya = out < 0 ? yFace - t : yFace - 1, yb = out < 0 ? yFace + 1 : yFace + t;
        let frame = sub(slabY(fx0, fz0, fx1, fz1, 26, ya, yb), slabY(fx0 + 15, fz0 + 15, fx1 - 15, fz1 - 15, 16, ya - 1, yb + 1));
        const ribs = [], n = Math.max(2, Math.round((fz1 - fz0) / 120));
        for (let i = 1; i < n + 1; i++) { const z = fz0 + (fz1 - fz0) * i / (n + 1); ribs.push(slabY(fx0 + 24, z - 5, fx1 - 24, z + 5, 5, out < 0 ? ya + 1.2 : ya, out < 0 ? yb : yb - 1.2)); }
        const diag = [];
        for (const [xa, za] of [[fx0 + 11, fz0 + 11], [fx1 - 11, fz0 + 11], [fx0 + 11, fz1 - 11], [fx1 - 11, fz1 - 11]]) diag.push(cylY(9, xa, za, ya, yb, 24));
        return U([frame, ...ribs, ...diag]);
      };
      // bands of molded ribs wrapping the side walls (x faces) of the base
      const sideRibs = [];
      if (!front) for (const sx of [-1, 1]) {
        const xF = sx < 0 ? X0 : X1, n = 3;
        for (let i = 0; i < n; i++) { const yy = yp + 26 + (y1 - yp - 52) * i / (n - 1); sideRibs.push(slabX(yy - 3, Zb + (sp.wheels ? 2 * wr + 24 : 40), yy + 3, -40, 3, sx < 0 ? xF - 2.6 : xF - 1, sx < 0 ? xF + 1 : xF + 2.6)); }
      }
      shell = U([shell, ridgeSet(y0, -1), front ? null : ridgeSet(y1, 1), ...sideRibs].filter(Boolean));
      for (const w of wells) shell = sub(shell, opt.keep ? sub(w, opt.keep) : w);
      // the parting groove all the way round
      const groove = sub(box(X0 - 10, yp - 0.8, Zb - 10, X1 + 10, yp + 0.8, 10), rbox(X0 - 0.6, y0 - 0.6, Zb - 0.6, X1 + 0.6, y1 + 0.6, 0.6, R + 0.6, 32));
      shell = sub(shell, groove);
      // name plate pocket with a molded bezel; the beveled sides undercut like the real dovetail recess
      const spot = plateSpot(sp, opt, opt.plate);
      if (spot) {
        const { Xf, Ya, zc, L: pl, H: ph, T: pt, bevel: bv, bezel } = spot, c = 0.25, za = zc - pl / 2 - c, zb = zc + pl / 2 + c, ya = Ya - c, yb = Ya + ph + c;
        shell = U([shell, slabX(ya - 3, za - 3, yb + 3, zb + 3, 3, X1 - 1, X1 + bezel)]);
        const under = k(Mf.hull([box(Xf, ya, za, Xf + 0.05, yb, zb), box(Xf + pt - 0.05, ya + bv, za + bv, Xf + pt, yb, zb - bv)]));
        shell = sub(shell, U([under, box(Xf + pt - 0.1, ya + bv, za + bv, X1 + 9, yb, zb - bv)]));
      }
      if (opt.addShell) shell = U([shell, opt.addShell]);
      if (opt.cutShell) shell = sub(shell, opt.cutShell);
      // mount pocket in the top face and the pull-handle channel
      if (opt.pocket) { const [px0, py0, px1, py1, pd] = opt.pocket; shell = sub(shell, slabZ(px0, py0, px1, py1, 10, -pd, 20)); }
      let trolley = null;
      if (sp.wheels && !front && opt.trolley && y1 - (opt.pocket ? opt.pocket[3] : 0) > 40) {
        const [tx0, tx1] = opt.trolley, ty0 = y1 - 38, ty1 = y1 - 12;
        shell = sub(shell, slabZ(tx0, ty0, tx1, ty1, 8, -16, 20));
        // collapsed pull handle: the grip bar sits just proud of the top on its two tube heads
        const grip = slabZ(tx0 + 4, ty0 + 3, tx1 - 4, ty1 - 3, 9, 4, 18);
        const tubesUp = [slabZ(tx0 + 6, ty0 + 5, tx0 + 30, ty1 - 5, 6, -14, 5), slabZ(tx1 - 30, ty0 + 5, tx1 - 6, ty1 - 5, 6, -14, 5)];
        const btn = slabZ((tx0 + tx1) / 2 - 22, ty0 + 7, (tx0 + tx1) / 2 + 22, ty1 - 7, 4, 16, 19.5);
        trolley = { grip: U([sub(grip, slabZ((tx0 + tx1) / 2 - 26, ty0 + 5, (tx0 + tx1) / 2 + 26, ty1 - 5, 5, 16.5, 30)), ...tubesUp]), btn };
        // tube housings down the back face
        const tubes = [];
        for (const x of [tx0 + 16, tx1 - 16]) tubes.push(slabY(x - 16, Zb + 2 * wr + 14, x + 16, -18, 10, y1 - 2, y1 + 4));
        shell = U([shell, ...tubes]);
      }
      let lidM = and(shell, box(X0 - 20, y0 - 20, Zb - 20, X1 + 20, yp, 20));
      let baseM = and(shell, box(X0 - 20, yp, Zb - 20, X1 + 20, y1 + 20, 20));
      if (opt.cutLid) lidM = sub(lidM, opt.cutLid);
      if (opt.cutBase) baseM = sub(baseM, opt.cutBase);
      add('Case lid', lidM, 'caseshell', COL.lid);
      add('Case base', baseM, 'caseshell', COL.shell);
      if (trolley) { add('Pull handle', trolley.grip, 'rubber', COL.trim); add('Pull handle button', trolley.btn, 'rubber', '#3A3C40'); }
      // ---- latches: a double-throw lever across the parting line between two guard ribs
      const nL = sp.latches || 2, latches = [], guards = [], hasps = [], pins = [];
      const latchAt = (z, xF, sx) => { // on a side face x = xF, facing sx
        const o = v => xF + sx * v, xa = (a, b) => [Math.min(o(a), o(b)), Math.max(o(a), o(b))];
        const [l0, l1] = xa(1, 21), lw = 38;
        let lever = slabX(yp - 26, z - lw, yp + 34, z + lw, 8, l0, l1);
        lever = sub(lever, slabX(yp + 4, z - lw + 8, yp + 24, z + lw - 8, 4, ...(sx > 0 ? [o(17), o(22)] : [o(22), o(17)]))); // finger pull
        for (const dy of [-16, -9]) lever = sub(lever, slabX(yp + dy - 1.5, z - lw + 6, yp + dy + 1.5, z + lw - 6, 1.4, ...(sx > 0 ? [o(19.6), o(22)] : [o(22), o(19.6)]))); // grip ridges
        latches.push(lever);
        const [b0, b1] = xa(-1, 12); latches.push(slabX(yp + 22, z - lw - 2, yp + 42, z + lw + 2, 6, b0, b1));
        const [p0, p1] = xa(3, 13); pins.push(cylZ(3.2, (p0 + p1) / 2, yp + 32, z - lw - 3, z + lw + 3, 16));
        const [h0, h1] = xa(-1, 7); latches.push(slabX(yp - 36, z - lw + 4, yp - 18, z + lw - 4, 4, h0, h1)); // keeper on the lid
        for (const dz of [-1, 1]) { const [g0, g1] = xa(-1, 25); guards.push(slabX(yp - 38, z + dz * (lw + 9) - 6, yp + 46, z + dz * (lw + 9) + 6, 5, g0, g1)); }
      };
      const hasp = (z, xF, sx) => { // padlock hasp: a tab on the lid and one on the base, side by side, steel bushed hole
        const o = v => xF + sx * v, a0 = Math.min(o(-1), o(24)), a1 = Math.max(o(-1), o(24));
        for (const [za, zb, ya, yb] of [[z - 13, z - 1, yp - 30, yp + 2], [z + 1, z + 13, yp - 2, yp + 30]]) {
          let t = slabX(ya, za, yb, zb, 3, a0, a1);
          t = U([t, k(Mf.hull([slabX(ya, za, yb, zb, 3, Math.min(o(-1), o(4)), Math.max(o(-1), o(4))), slabX(ya - 10, za, yb + 10, zb, 3, Math.min(o(-1), o(1)), Math.max(o(-1), o(1)))]))]);
          hasps.push(sub(t, cylZ(4.2, o(15), yp, z - 20, z + 20, 24)));
        }
        pins.push(sub(cylZ(5.2, o(15), yp, z - 13, z + 13, 24), cylZ(4.2, o(15), yp, z - 14, z + 14, 24)));
      };
      if (!front) {
        const zs = []; for (let i = 0; i < nL; i++) zs.push(Zb + H * (i + 1) / (nL + 1));
        for (const z of zs) latchAt(z, X1, 1);
        hasp(Zb + Math.min(110, H * 0.16), X1, 1); hasp(-Math.min(110, H * 0.16), X1, 1);
        // side handle between the latches (the same small factory handle), folded flat, on its knuckles
        if (nL === 2) {
          const zc = (zs[0] + zs[1]) / 2, hl = Math.min(140, (zs[1] - zs[0]) - 2 * 38 - 40), yh = (yp + y1) / 2 + 6, kz = [zc - hl / 2 + 8, zc + hl / 2 - 8];
          const knk = [], legs = [];
          for (const z of kz) { knk.push(U([cylZ(6.5, X1 + 9, yh, z - 9, z + 9, 24), box(X1 - 1, yh - 6.5, z - 9, X1 + 9, yh + 6.5, z + 9)])); pins.push(cylZ(3, X1 + 9, yh, z - 12, z + 12, 16)); }
          const grip = slabX(yh - 64, zc - hl / 2, yh - 42, zc + hl / 2, 10, X1 + 1.5, X1 + 24);
          for (const z of kz) legs.push(k(Mf.hull([slabX(yh - 9, z - 11, yh + 9, z + 11, 6, X1 + 2, X1 + 18), slabX(yh - 60, z - 11, yh - 44, z + 11, 6, X1 + 2, X1 + 22)])));
          add('Side handle', U([grip, ...legs]), 'caseshell', COL.trim);
          guards.push(...knk);
        }
        // continuous hinge down the other side: alternating knuckles on lid and base
        const hx = X0 - 6, n = Math.max(6, Math.round((H - 120) / 50)), z0 = Zb + 60, z1 = -60, kl = [], kb = [];
        for (let i = 0; i < n; i++) { const za = z0 + (z1 - z0) * i / n + 1, zb = z0 + (z1 - z0) * (i + 1) / n - 1; (i % 2 ? kl : kb).push(U([cylZ(7, hx, yp, za, zb, 24), box(hx, i % 2 ? yp - 12 : yp, za, X0 + 4, i % 2 ? yp : yp + 12, zb)])); }
        add('Hinge', U([...kl, ...kb]), 'caseshell', COL.trim);
        pins.push(cylZ(2.4, hx, yp, z0 - 3, z1 + 3, 12));
      } else {
        // briefcase layout: the latches sit on the top face either side of the handle mount, across the parting line
        const keep = opt.keepX || [-90, 90], xs = [(X0 + keep[0]) / 2, (X1 + keep[1]) / 2];
        for (const x of xs) {
          const lw = 30;
          let lever = slabZ(x - lw, yp - 26, x + lw, yp + 34, 8, -1, 14);
          lever = sub(lever, slabZ(x - lw + 7, yp + 2, x + lw - 7, yp + 26, 4, 11, 16));
          latches.push(lever, slabZ(x - lw - 2, yp + 22, x + lw + 2, yp + 40, 5, -1, 9), slabZ(x - lw + 4, yp - 34, x + lw - 4, yp - 18, 4, -1, 5));
          pins.push(cylX(3, yp + 31, 7, x - lw - 3, x + lw + 3, 16));
          for (const dx of [-1, 1]) guards.push(slabZ(x + dx * (lw + 8) - 5, yp - 34, x + dx * (lw + 8) + 5, yp + 44, 4, -1, 19));
        }
      }
      // folded carry handle on the top face on its two knuckled mounts (the insert preview; the handle tool brings its own)
      if (opt.handle) {
        const hl = Math.min(150, W * 0.5), yh = front ? (opt.handleY != null ? opt.handleY : yp + 24) : (yp + y1) / 2 + 6, dir = front ? 1 : -1, kx = [-hl / 2 + 8, hl / 2 - 8], legs = [];
        const gy0 = yh + dir * 42, gy1 = yh + dir * 64;
        for (const x of kx) {
          guards.push(U([cylX(6.5, yh, 9, x - 9, x + 9, 24), box(x - 9, yh - 6.5, -1, x + 9, yh + 6.5, 9)]));
          pins.push(cylX(3, yh, 9, x - 12, x + 12, 16));
          legs.push(k(Mf.hull([slabZ(x - 11, yh - 9, x + 11, yh + 9, 6, 2, 18), slabZ(x - 11, Math.min(gy0, gy1) + 4, x + 11, Math.max(gy0, gy1) - 4, 6, 2, 22)])));
        }
        add('Top handle', U([slabZ(-hl / 2, Math.min(gy0, gy1), hl / 2, Math.max(gy0, gy1), 10, 1.5, 24), ...legs]), 'rubber', COL.trim);
      }
      add('Latches', U(latches), 'caseshell', COL.trim);
      add('Latch guards', U(guards), 'caseshell', COL.shell);
      if (hasps.length) add('Padlock hasps', U(hasps), 'caseshell', COL.shell);
      add('Steel pins', U(pins), 'switch', COL.steel);
      // ---- purge valve on the lid face, near the top
      const vx = X1 - Math.min(90, W * 0.22), vz = -Math.min(110, H * 0.2);
      let valve = U([cylY(20, vx, vz, y0 - 4, y0 + 2, 48), cylY(14.5, vx, vz, y0 - 11, y0 - 3, 48)]);
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; valve = sub(valve, cylY(1.6, vx + 15 * Math.cos(a), vz + 15 * Math.sin(a), y0 - 12, y0 - 3, 10)); }
      valve = sub(valve, box(vx - 7, y0 - 12, vz - 1.4, vx + 7, y0 - 10, vz + 1.4));
      add('Purge valve', valve, 'caseshell', COL.valve);
      // ---- wheels in the wells, rubber feet under the front and on the back for lying flat
      if (sp.wheels && !front) {
        const wheels = [], hubs = [];
        for (const sx of [-1, 1]) {
          const xa = sx < 0 ? X0 + 4 : X1 - ww - 4, cz = Zb + wr - 6, cy = y1 - wr - 6;
          wheels.push(sub(cylX(wr, cy, cz, xa, xa + ww, 48), cylX(wr * 0.5, cy, cz, xa - 1, xa + ww + 1, 32)));
          hubs.push(cylX(wr * 0.52, cy, cz, xa + 2, xa + ww - 2, 32), cylX(5, cy, cz, sx < 0 ? X0 - 1 : X1 - ww - 14, sx < 0 ? X0 + ww + 14 : X1 + 1, 16));
        }
        const out = m => opt.keep ? sub(m, opt.keep) : m;
        add('Wheels', out(U(wheels)), 'rubber', COL.rubber);
        add('Wheel hubs', out(U(hubs)), 'switch', '#5B5F66');
      }
      const feet = [];
      const fy = sp.wheels && !front ? [y0 + 26] : [y0 + 26, y1 - 26];
      for (const y of fy) for (const x of [X0 + 50, X1 - 50]) feet.push(cylZ(16, x, y, Zb - 6, Zb + 2, 32));
      if (!front) for (const x of [X0 + 50, X1 - 50]) for (const z of [Zb + 60, -60]) feet.push(cylY(14, x, z, y1 - 2, y1 + 6, 32));
      add('Feet', U(feet), 'rubber', COL.rubber);
      return parts.map(q => ({ name: q.name, kind: 'case', mat: q.mat, color: q.color, p: soup(q.m) }));
    } finally { for (const x of bin) { try { x.delete(); } catch (e) { /* gone */ } } }
  }
  function soup(m) {
    const g = m.getMesh(), np = g.numProp, vp = g.vertProperties, tv = g.triVerts, out = new Float32Array(tv.length * 3);
    for (let i = 0; i < tv.length; i++) { const s = tv[i] * np; out[i * 3] = vp[s]; out[i * 3 + 1] = vp[s + 1]; out[i * 3 + 2] = vp[s + 2]; }
    return out;
  }
  // clip a triangle soup to the box lo..hi (for close-up previews): open cut edges, display only
  function clip(p, lo, hi) {
    const out = [];
    const planes = []; for (let a = 0; a < 3; a++) { planes.push([a, lo[a], 1], [a, hi[a], -1]); }
    for (let i = 0; i < p.length; i += 9) {
      let inside = true, outside = false;
      for (let a = 0; a < 3 && !outside; a++) { const v0 = p[i + a], v1 = p[i + 3 + a], v2 = p[i + 6 + a], mn = Math.min(v0, v1, v2), mx = Math.max(v0, v1, v2); if (mx < lo[a] || mn > hi[a]) outside = true; if (mn < lo[a] || mx > hi[a]) inside = false; }
      if (outside) continue;
      if (inside) { for (let k = 0; k < 9; k++) out.push(p[i + k]); continue; }
      let poly = [[p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]], [p[i + 6], p[i + 7], p[i + 8]]];
      for (const [a, v, sg] of planes) {
        const nxt = [];
        for (let j = 0; j < poly.length; j++) {
          const P = poly[j], Q = poly[(j + 1) % poly.length], dp = (P[a] - v) * sg, dq = (Q[a] - v) * sg;
          if (dp >= 0) nxt.push(P);
          if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); nxt.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2] + (Q[2] - P[2]) * t]); }
        }
        poly = nxt; if (poly.length < 3) break;
      }
      for (let j = 1; j + 1 < poly.length; j++) out.push(...poly[0], ...poly[j], ...poly[j + 1]);
    }
    return Float32Array.from(out);
  }
  const api = { SPECS, spec, build, plateSpot, frame, clip, COL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  G.GPCaseMock = api;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
