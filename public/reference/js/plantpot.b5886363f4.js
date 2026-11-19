/* Expressarte plant pot & tray maker: many pot shapes and surface styles, drainage,
   matching drip trays, optional self-watering insert, rim text, multicolor 3MF,
   and auto-split when the pot is bigger than the bed. American spelling. No brands. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);
  const Seed = G.GPSeedTray || (typeof require === 'function' ? require('./seed-tray.js') : null);

  // Free: round, square, cone + smooth/ribbed. Everything else is Pro.
  const SHAPES = {
    round: { label: 'Round', free: true, sides: 0, curve: 'straight' },
    square: { label: 'Square', free: true, sides: 4, curve: 'straight' },
    cone: { label: 'Tapered cone', free: true, sides: 0, curve: 'straight', tippy: true },
    cylinder: { label: 'Cylinder', free: false, sides: 0, curve: 'straight', equal: true },
    hexagon: { label: 'Hexagon', free: false, sides: 6, curve: 'straight' },
    octagon: { label: 'Octagon', free: false, sides: 8, curve: 'straight' },
    bowl: { label: 'Bowl / planter', free: false, sides: 0, curve: 'bowl' },
    vase: { label: 'Tall vase', free: false, sides: 0, curve: 'vase' },
    star: { label: 'Star / flower', free: false, sides: 5, curve: 'straight', star: true },
    succulent: { label: 'Low succulent dish', free: false, sides: 0, curve: 'dish' },
    windowbox: { label: 'Rectangular window box', free: false, sides: 4, curve: 'straight', rect: true },
    hanging: { label: 'Hanging pot', free: false, sides: 0, curve: 'straight', hang: true },
    seedtray: { label: 'Seed starter tray', free: true, sides: 0, curve: 'straight', seed: true }
  };

  const STYLES = {
    smooth: { label: 'Smooth', free: true, bump: 0 },
    ribbed: { label: 'Ribbed / fluted', free: true, bump: 'rib' },
    spiral: { label: 'Twisted spiral', free: false, bump: 'spiral' },
    faceted: { label: 'Faceted / low-poly', free: false, bump: 'facet' },
    diamond: { label: 'Geometric diamond', free: false, bump: 'diamond' },
    wave: { label: 'Wave', free: false, bump: 'wave' },
    honeycomb: { label: 'Honeycomb texture', free: false, bump: 'honey' },
    rings: { label: 'Stacked rings', free: false, bump: 'rings' },
    brick: { label: 'Brick', free: false, bump: 'brick' },
    face: { label: 'Cute face', free: false, bump: 'face' }
  };

  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    shape: 'round', style: 'smooth',
    topD: 120, bottomD: 90, height: 110,
    wallT: 2.4, bottomT: 3.2,
    drainage: 'center', holeD: 8, holes: 5,
    feet: false, footH: 6, raisedBottom: false,
    rim: 'lip', // none | lip | rolled
    text: '', textStyle: 'raised', font: 'round', textH: 10,
    includeTray: true, trayGap: 4, trayH: 14, trayFeet: true,
    selfWater: false, vaseMode: false,
    colors: { pot: PZ.sage, tray: PZ.peach, text: PZ.ink },
    bed: [256, 256], bambu: 'A1', detail: 'hd',
    exportMode: 'both' // pot | tray | both
  };

  const PALETTE = [
    { name: 'Forest', hex: '#2F6B4F' }, { name: 'Terracotta', hex: '#C45A3B' },
    { name: 'Clay', hex: '#C4A574' }, { name: 'White', hex: '#F7F7F2' },
    { name: 'Black', hex: '#1A1A1A' }, { name: 'Sky', hex: '#5B8FA8' },
    { name: 'Sage', hex: '#7A9E7E' }, { name: 'Blush', hex: '#D4A5A5' }
  ];

  const FREE = { shapes: Object.keys(SHAPES).filter(k => SHAPES[k].free && !SHAPES[k].seed), styles: Object.keys(STYLES).filter(k => STYLES[k].free) };

  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    if (!SHAPES[o.shape]) o.shape = 'round';
    if (!STYLES[o.style]) o.style = 'smooth';
    const sh = SHAPES[o.shape];
    o.topD = Math.max(30, Math.min(400, +o.topD || DEFAULTS.topD));
    o.bottomD = Math.max(20, Math.min(400, +o.bottomD || DEFAULTS.bottomD));
    if (sh.equal) o.bottomD = o.topD;
    if (sh.tippy && o.bottomD >= o.topD) o.bottomD = Math.max(20, o.topD * 0.55);
    if (sh.dish) { o.height = Math.min(o.height, Math.max(28, o.topD * 0.35)); }
    if (sh.curve === 'vase') o.height = Math.max(o.height, o.topD * 1.1);
    o.height = Math.max(20, Math.min(400, +o.height || DEFAULTS.height));
    o.wallT = Math.max(0.8, Math.min(8, +o.wallT || DEFAULTS.wallT));
    o.bottomT = Math.max(1.2, Math.min(12, +o.bottomT || DEFAULTS.bottomT));
    if (!['none', 'center', 'multi'].includes(o.drainage)) o.drainage = 'center';
    o.holeD = Math.max(3, Math.min(20, +o.holeD || DEFAULTS.holeD));
    o.holes = Math.max(3, Math.min(12, +o.holes || DEFAULTS.holes) | 0);
    o.feet = !!o.feet; o.raisedBottom = !!o.raisedBottom;
    o.footH = Math.max(3, Math.min(20, +o.footH || DEFAULTS.footH));
    if (!['none', 'lip', 'rolled'].includes(o.rim)) o.rim = 'lip';
    o.text = String(o.text || '').slice(0, 24);
    o.textStyle = o.textStyle === 'embossed' ? 'embossed' : 'raised';
    o.textH = Math.max(6, Math.min(24, +o.textH || DEFAULTS.textH));
    if (!Bubble || !Bubble.FONTS || !Bubble.FONTS[o.font]) o.font = 'round';
    o.includeTray = o.includeTray !== false;
    o.trayGap = Math.max(1, Math.min(20, +o.trayGap || DEFAULTS.trayGap));
    o.trayH = Math.max(6, Math.min(40, +o.trayH || DEFAULTS.trayH));
    o.trayFeet = o.trayFeet !== false;
    o.selfWater = !!o.selfWater;
    o.vaseMode = !!o.vaseMode;
    if (o.vaseMode) { o.drainage = 'none'; o.wallT = Math.min(o.wallT, 0.8); o.selfWater = false; }
    o.colors = Object.assign({}, DEFAULTS.colors, o.colors || {});
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    if (!['pot', 'tray', 'both'].includes(o.exportMode)) o.exportMode = 'both';
    return o;
  }

  function radiusAt(z, o) {
    const sh = SHAPES[o.shape];
    const t = Math.max(0, Math.min(1, z / Math.max(1e-6, o.height)));
    const rTop = o.topD / 2, rBot = o.bottomD / 2;
    if (sh.curve === 'bowl') {
      // Wide mouth, rounded belly
      const s = Math.sin(t * Math.PI * 0.92);
      return rBot + (rTop - rBot) * (0.15 + 0.85 * s);
    }
    if (sh.curve === 'vase') {
      // Slim waist
      const waist = Math.min(rTop, rBot) * 0.72;
      const a = (1 - t) * (1 - t), b = t * t, c = 4 * t * (1 - t);
      return a * rBot + b * rTop + c * waist;
    }
    if (sh.curve === 'dish') {
      return rBot + (rTop - rBot) * Math.pow(t, 0.55);
    }
    return rBot + (rTop - rBot) * t;
  }

  function styleBump(theta, z, o) {
    const st = STYLES[o.style];
    if (!st || !st.bump) return 0;
    const amp = o.detail === 'draft' ? 0.7 : 1.15;
    const H = Math.max(1, o.height);
    if (st.bump === 'rib') return amp * 1.1 * Math.cos(theta * 24);
    if (st.bump === 'spiral') return amp * 1.0 * Math.cos(theta * 10 + z / H * Math.PI * 6);
    if (st.bump === 'facet') return 0; // handled by low side count
    if (st.bump === 'diamond') {
      const u = ((theta / (Math.PI * 2)) * 10) % 1, v = ((z / H) * 8) % 1;
      return amp * 0.9 * (Math.abs(u - 0.5) + Math.abs(v - 0.5) < 0.35 ? 1 : -0.2);
    }
    if (st.bump === 'wave') return amp * 1.2 * Math.sin(theta * 6) * Math.sin(z / H * Math.PI * 3);
    if (st.bump === 'honey') {
      const s = 14, h = s * Math.sqrt(3) / 2;
      const col = Math.round((theta * radiusAt(z, o)) / s);
      const row = Math.round(z / h);
      const cx = col * s + (row & 1 ? s / 2 : 0), cy = row * h;
      const dx = theta * radiusAt(z, o) - cx, dy = z - cy;
      return amp * (Math.hypot(dx, dy) < s * 0.38 ? -0.85 : 0.15);
    }
    if (st.bump === 'rings') return amp * 0.95 * Math.sin(z / H * Math.PI * 14);
    if (st.bump === 'brick') {
      const row = Math.floor(z / 8), off = (row & 1) ? 0.5 : 0;
      const u = (theta / (Math.PI * 2) * 12 + off) % 1;
      return amp * (u < 0.08 || (z % 8) < 1.1 ? 0.55 : 0);
    }
    if (st.bump === 'face') {
      // Eyes + smile on the +X face (theta ~ 0)
      const a = ((theta + Math.PI * 3) % (Math.PI * 2)) - Math.PI; // -\u03c0..\u03c0 around +X? theta 0 is +X
      const wrapA = Math.atan2(Math.sin(theta), Math.cos(theta));
      const face = Math.abs(wrapA) < 0.85;
      if (!face) return 0;
      const eyeY = H * 0.62, mouthY = H * 0.42;
      const eye1 = Math.hypot(wrapA - 0.32, (z - eyeY) / H * 3.2);
      const eye2 = Math.hypot(wrapA + 0.32, (z - eyeY) / H * 3.2);
      if (eye1 < 0.14 || eye2 < 0.14) return amp * 1.4;
      const mouth = Math.abs(z - mouthY) < H * 0.04 && Math.abs(wrapA) < 0.45 && Math.abs(wrapA) > 0.12;
      if (mouth) return amp * 1.1;
      return amp * 0.15;
    }
    return 0;
  }

  function sidesFor(o) {
    const sh = SHAPES[o.shape];
    const st = STYLES[o.style];
    if (st.bump === 'facet') return Math.max(6, sh.sides || 8);
    if (sh.star) return 10; // 5-point star via radius modulation
    if (sh.sides) return sh.sides;
    return 0; // round
  }

  function xyAt(r, theta, o) {
    const sh = SHAPES[o.shape];
    const sides = sidesFor(o);
    if (sh.rect) {
      // Window box: elongated along X
      const hx = r * 1.35, hy = r * 0.55;
      const c = Math.cos(theta), s = Math.sin(theta);
      const k = 1 / Math.max(Math.abs(c) / hx * r, Math.abs(s) / hy * r, 1e-6);
      // Map unit circle through a rounded rectangle scale
      const sx = hx * Math.max(Math.abs(c), 0.001) / Math.abs(c || 1e-6) * Math.sign(c || 1);
      const sy = hy * Math.max(Math.abs(s), 0.001) / Math.abs(s || 1e-6) * Math.sign(s || 1);
      // Simpler: ellipse
      return [r * 1.35 * c, r * 0.55 * s];
    }
    if (sh.star) {
      const tip = 5, ang = theta * tip / 2;
      const spike = 0.55 + 0.45 * Math.abs(Math.cos(ang));
      return [r * spike * Math.cos(theta), r * spike * Math.sin(theta)];
    }
    if (sides >= 3) {
      const seg = Math.PI * 2 / sides;
      const local = ((theta % seg) + seg) % seg - seg / 2;
      const R = r / Math.max(0.2, Math.cos(local));
      return [R * Math.cos(theta), R * Math.sin(theta)];
    }
    return [r * Math.cos(theta), r * Math.sin(theta)];
  }

  function potWall(o) {
    const dens = o.detail === 'draft' ? 0.5 : 1;
    const sides = sidesFor(o);
    const nTheta = sides >= 3
      ? Math.max(sides * 4, Math.round(sides * (o.detail === 'draft' ? 4 : 8)))
      : Math.max(28, Math.round(48 * dens + o.topD / 8));
    const nZ = Math.max(6, Math.round(o.height / (o.detail === 'draft' ? 5 : 2.4)));
    let wallT = o.vaseMode ? Math.min(0.8, o.wallT) : o.wallT;
    wallT = Math.max(0.6, wallT);
    const thick = () => wallT;
    const map = (i, j, t) => {
      const u = i / nTheta;
      const v = j / nZ;
      const z = v * o.height;
      const theta = u * Math.PI * 2;
      let r = radiusAt(z, o) + styleBump(theta, z, o);
      // Rim flare
      if (o.rim === 'lip' && v > 0.9) r += (v - 0.9) / 0.1 * Math.min(4, wallT * 1.2);
      if (o.rim === 'rolled' && v > 0.86) {
        const p = (v - 0.86) / 0.14;
        r += Math.sin(p * Math.PI) * Math.min(5, wallT * 1.6);
      }
      r = Math.max(wallT + 1, r);
      const rr = Math.max(wallT * 0.45, r - t);
      const [x, y] = xyAt(rr, theta, o);
      return [x, y, z];
    };
    return fix(T.heightSolid(nTheta, nZ + 1, thick, map, true));
  }

  function drainHoles(o, rInner) {
    if (o.drainage === 'none' || o.vaseMode) return [];
    const hr = Math.min(o.holeD / 2, Math.max(1.5, rInner * 0.35));
    if (o.drainage === 'center') return [T.circle(0, 0, hr, 20)];
    const n = o.holes, out = [T.circle(0, 0, hr * 0.85, 16)];
    const ring = Math.max(hr * 2.2, rInner * 0.45);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      out.push(T.circle(ring * Math.cos(a), ring * Math.sin(a), hr * 0.75, 14));
    }
    return out;
  }

  function potFloor(o) {
    const r = radiusAt(0, o);
    const wallT = o.vaseMode ? Math.min(0.8, o.wallT) : o.wallT;
    // Floor fills to just past the inner wall so it seals against the tube
    const rOuter = Math.max(wallT + 2, r - wallT * 0.15);
    const holes = drainHoles(o, Math.max(2, r - wallT - 1));
    const poly = { outer: shapeLoop(rOuter, o, 64), holes };
    const z0 = o.raisedBottom ? o.footH * 0.35 : 0;
    const z1 = z0 + o.bottomT;
    return fix(T.extrude([poly], 2, z0, z1));
  }

  function shapeLoop(r, o, n) {
    const sides = sidesFor(o);
    const N = sides >= 3 ? Math.max(sides * 4, n) : n;
    const L = [];
    for (let i = 0; i < N; i++) {
      const th = i / N * Math.PI * 2;
      L.push(xyAt(r, th, o));
    }
    return L;
  }

  function potFeet(o) {
    if (!o.feet && !o.raisedBottom) return null;
    const r = radiusAt(0, o);
    const wallT = o.wallT;
    const ring = Math.max(8, r - wallT - o.holeD);
    const fh = o.footH;
    const fr = Math.max(3.5, Math.min(8, r * 0.12));
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + Math.PI / 6;
      const cx = ring * Math.cos(a), cy = ring * Math.sin(a);
      parts.push(T.extrude([{ outer: T.circle(cx, cy, fr, 14), holes: [] }], 2, -fh, 0.2));
    }
    return fix(T.concat(parts));
  }

  function hangEars(o) {
    if (!SHAPES[o.shape].hang) return null;
    const r = radiusAt(o.height, o);
    const z = o.height - 4;
    const earR = 6, holeR = 3.2, thick = Math.max(2.4, o.wallT);
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      const cx = (r + earR * 0.2) * Math.cos(a), cy = (r + earR * 0.2) * Math.sin(a);
      // Flat ear tab with a hole, standing in XY at the rim (printed with pot upright)
      const ear = T.extrude([{
        outer: T.circle(cx, cy, earR, 18),
        holes: [T.circle(cx, cy, holeR, 14)]
      }], 2, z - thick / 2, z + thick / 2);
      parts.push(ear);
    }
    return fix(T.concat(parts));
  }

  function textMesh(o) {
    if (!o.text || !Bubble) return null;
    const chars = [...o.text.toUpperCase()];
    const H = o.textH;
    let w = 0, glyphs = [];
    for (const ch of chars) {
      if (ch === ' ') { w += H * 0.35; continue; }
      const g = Bubble.glyphPolys(o.font, ch, H);
      if (!g || !g.polys.length) continue;
      glyphs.push({ polys: g.polys, adv: g.advance || H * 0.7, at: w });
      w += (g.advance || H * 0.7) * 1.05;
    }
    if (!glyphs.length) return null;
    const r = radiusAt(o.height * 0.45, o);
    const maxW = r * 1.6;
    const scale = w > maxW ? maxW / w : 1;
    const zMid = o.height * 0.45;
    // Build flat text in a tangent plane near +X, then wrap lightly by placing at x = r
    const raise = o.textStyle === 'embossed' ? -Math.min(1.2, o.wallT * 0.45) : Math.min(1.6, o.wallT * 0.7);
    const z0 = o.textStyle === 'embossed' ? r - o.wallT * 0.15 + raise : r - 0.2;
    const z1 = o.textStyle === 'embossed' ? r - o.wallT * 0.15 : r - 0.2 + raise;
    // Extrude along X (axis 0) so letters sit on the +X face; Y is across, Z is up
    const polys = [];
    for (const g of glyphs) for (const P of g.polys) {
      polys.push({
        outer: P.outer.map(p => [p[1] * scale + zMid - H * scale * 0.5, (p[0] + g.at) * scale - w * scale / 2]),
        holes: (P.holes || []).map(h => h.map(p => [p[1] * scale + zMid - H * scale * 0.5, (p[0] + g.at) * scale - w * scale / 2]))
      });
    }
    // extrude axis 0: h is X, u is Y (from [0]), w is Z (from [1]) \u2014 wait, tools to3: o[a]=h, o[UA[a]]=u, o[WA[a]]=w with UA=[1,2,0], WA=[2,0,1]
    // axis 0: x=h, y=u, z=w  so polys are [y,z]
    try {
      return fix(T.extrude(polys, 0, Math.min(z0, z1), Math.max(z0, z1)));
    } catch (_) { return null; }
  }

  function trayMesh(o) {
    const rPot = radiusAt(0, o);
    const rInner = rPot + o.trayGap;
    const rOuter = rInner + Math.max(3.5, o.wallT * 1.1);
    const h = o.trayH;
    const wallT = Math.max(1.6, Math.min(o.wallT, 3.2));
    // Floor
    const floor = T.extrude([{ outer: shapeLoop(rOuter, o, 56), holes: [] }], 2, 0, wallT);
    // Wall tube via heightSolid
    const nTheta = Math.max(28, sidesFor(o) ? sidesFor(o) * 6 : 48);
    const nZ = Math.max(4, Math.round(h / 3));
    const map = (i, j, t) => {
      const theta = i / nTheta * Math.PI * 2;
      const z = wallT * 0.5 + j / nZ * (h - wallT * 0.5);
      const r = rOuter - t;
      const [x, y] = xyAt(Math.max(wallT * 0.4, r), theta, o);
      return [x, y, z];
    };
    const wall = T.heightSolid(nTheta, nZ + 1, () => wallT, map, true);
    let mesh = fix(T.concat([floor, wall]));
    if (o.trayFeet) {
      // Raised ridges so the pot drains
      const ribs = [];
      const n = 6, ribH = Math.min(3.5, h * 0.25), ribW = 2.2;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        // Thin box from center toward rim
        const pts = [
          [c * 4 - s * ribW, s * 4 + c * ribW],
          [c * (rInner - 2) - s * ribW, s * (rInner - 2) + c * ribW],
          [c * (rInner - 2) + s * ribW, s * (rInner - 2) - c * ribW],
          [c * 4 + s * ribW, s * 4 - c * ribW]
        ];
        ribs.push(T.extrude([{ outer: pts, holes: [] }], 2, wallT - 0.1, wallT + ribH));
      }
      mesh = fix(T.concat([mesh, ...ribs]));
    }
    return mesh;
  }

  function selfWaterInsert(o) {
    // Smaller cup that sits inside the pot with a wick hole in the floor
    const rTop = Math.max(15, o.topD / 2 - o.wallT - 3);
    const rBot = Math.max(12, o.bottomD / 2 - o.wallT - 3);
    const h = Math.max(25, o.height * 0.55);
    const wallT = Math.max(1.4, Math.min(2.4, o.wallT));
    const fake = Object.assign({}, o, { topD: rTop * 2, bottomD: rBot * 2, height: h, wallT, bottomT: 2.4, drainage: 'center', holeD: Math.max(4, o.holeD * 0.7), feet: false, raisedBottom: false, rim: 'none', style: 'smooth', vaseMode: false, text: '', shape: SHAPES[o.shape].sides ? o.shape : 'round' });
    // Avoid recursion into hang/selfWater
    const wall = potWall(fake);
    const floor = potFloor(fake);
    return fix(T.concat([wall, floor]));
  }

  function fix(p) {
    if (!p || !p.length) return p;
    return Core.signedVolume(p) < 0 ? Core.flip(p) : p;
  }

  function shiftToOrigin(p) {
    const b = Core.bbox(p);
    return PL.move(p, -b.min[0], -b.min[1], -b.min[2]);
  }

  function potBody(o) {
    const bits = [potWall(o), potFloor(o)];
    const feet = potFeet(o); if (feet) bits.push(feet);
    const ears = hangEars(o); if (ears) bits.push(ears);
    return fix(T.concat(bits));
  }

  function usableBed(bed) {
    const [bx, by] = bed || [256, 256];
    return [Math.max(60, bx - 8), Math.max(60, by - 8)];
  }

  function build(raw) {
    if (raw && raw.shape === 'seedtray' && Seed) return Seed.build(raw);
    const o = options(raw);
    const warnings = [];
    if (o.vaseMode) warnings.push('Vase mode uses a single thin wall for spiral-vase printing. No drainage holes \u2014 not for soil with water.');
    if (SHAPES[o.shape].hang) warnings.push('Hanging pot includes three rim holes for wire or cord. Check load rating of your filament.');

    const wantPot = o.exportMode !== 'tray';
    const wantTray = o.includeTray && o.exportMode !== 'pot';

    let pot = wantPot ? potBody(o) : null;
    let tray = wantTray ? trayMesh(o) : null;
    let insert = (wantPot && o.selfWater && !o.vaseMode) ? selfWaterInsert(o) : null;
    let text = (wantPot && o.text) ? textMesh(o) : null;
    if (o.text && !text) warnings.push('Could not build the side text with this font; try Round or fewer letters.');

    // Position pot centered; tray beside it for preview; insert offset
    const parts = [];
    const [UW, UD] = usableBed(o.bed);
    let split = null;

    if (pot) {
      const pb = Core.bbox(pot);
      const dia = Math.max(pb.max[0] - pb.min[0], pb.max[1] - pb.min[1]);
      const fits = PL && PL.fits ? PL.fits(dia, dia, UW, UD) : dia <= Math.min(UW, UD);
      if (!fits && PL && PL.buildSplit) {
        try {
          // Shift pot into positive quadrant for clip-based split
          const ox = -pb.min[0], oy = -pb.min[1], oz = -pb.min[2];
          const placed = PL.move(pot, ox, oy, oz);
          const buildFn = () => placed;
          split = PL.buildSplit(dia, dia, UW, UD, buildFn, { count: 0, edge: Math.max(10, o.wallT * 4) });
          if (split && split.pieces && split.pieces.length > 1) {
            split.pieces.forEach((pc, i) => {
              const m = PL.dropCrumbs ? PL.dropCrumbs(pc.built) : pc.built;
              const b = Core.bbox(m);
              const local = PL.move(m, -b.min[0], -b.min[1], -b.min[2]);
              parts.push({
                name: `Pot piece ${i + 1} of ${split.pieces.length}`,
                p: m, assembled: m, local,
                color: o.colors.pot, kind: 'pot', pieceIndex: i,
                w: b.max[0] - b.min[0], d: b.max[1] - b.min[1], h: b.max[2] - b.min[2]
              });
            });
            warnings.push(PL.splitNote('Plant pot', split, `${Math.round(UW)}\u00d7${Math.round(UD)} mm bed`));
            pot = null; // already pushed as pieces
          }
        } catch (e) {
          warnings.push('Could not auto-split for this bed: ' + (e.message || e));
        }
      }
      if (pot) {
        parts.push({ name: 'Pot', p: pot, assembled: pot, local: shiftToOrigin(pot), color: o.colors.pot, kind: 'pot' });
      }
    }

    if (text && text.length) {
      parts.push({ name: 'Text', p: text, assembled: text, local: text, color: o.colors.text, kind: 'text' });
    }
    if (tray) {
      // Place tray next to pot for assembled preview
      const potParts = parts.filter(p => p.kind === 'pot');
      let trayAssembled = tray;
      if (potParts.length) {
        const pb = Core.bbox(T.concat(potParts.map(p => p.assembled || p.p)));
        const tb = Core.bbox(tray);
        const gap = 12;
        const dx = pb.max[0] - tb.min[0] + gap;
        trayAssembled = PL.move(tray, dx, 0, 0);
      }
      parts.push({ name: 'Tray', p: trayAssembled, assembled: trayAssembled, local: shiftToOrigin(tray), color: o.colors.tray, kind: 'tray' });
    }
    if (insert) {
      const potParts = parts.filter(p => p.kind === 'pot');
      let insA = insert;
      if (potParts.length) {
        const pb = Core.bbox(T.concat(potParts.map(p => p.assembled || p.p)));
        const ib = Core.bbox(insert);
        const dx = pb.min[0] - ib.max[0] - 12;
        insA = PL.move(insert, dx, 0, 0);
      }
      parts.push({ name: 'Self-watering insert', p: insA, assembled: insA, local: shiftToOrigin(insert), color: o.colors.pot, kind: 'insert' });
    }

    for (const pt of parts) solidCheckHint(pt, warnings);

    const filaments = [];
    const seen = new Set();
    for (const pt of parts) {
      const c = String(pt.color || '#888').toUpperCase();
      if (seen.has(c)) continue;
      seen.add(c);
      filaments.push({ role: pt.kind, color: pt.color });
    }

    const all = parts.length ? T.concat(parts.map(p => p.assembled || p.p)) : new Float64Array(0);
    const bb = all.length ? Core.bbox(all) : { min: [0, 0, 0], max: [0, 0, 0] };
    return {
      parts, options: o, warnings, filaments, shapes: SHAPES, styles: STYLES,
      split: split && split.pieces ? { count: split.pieces.length, tabs: split.straight ? 0 : split.tabs, nx: split.plan.nx, ny: split.plan.ny } : null,
      stats: {
        shape: o.shape, style: o.style,
        topD: o.topD, bottomD: o.bottomD, height: o.height,
        wallT: o.wallT, bottomT: o.bottomT,
        drainage: o.drainage, vaseMode: !!o.vaseMode,
        hasTray: !!tray, hasInsert: !!insert, hasText: !!(text && text.length),
        tris: all.length / 9, pieces: parts.length,
        colors: seen.size,
        footprint: Math.max(o.topD, o.bottomD),
        sizeX: bb.max[0] - bb.min[0], sizeY: bb.max[1] - bb.min[1], sizeZ: bb.max[2] - bb.min[2]
      },
      plate: all, assembled: all
    };
  }

  function solidCheckHint(pt, warnings) {
    try {
      const p = pt.assembled || pt.p;
      if (!p || !p.length) return;
      const ck = Core.checkClosed(p);
      if (!ck.closed) warnings.push(`${pt.name} may have open edges \u2014 try HD detail.`);
    } catch (_) {}
  }

  function export3MF(res, o) {
    if (res && res.stats && res.stats.seed && Seed) return Seed.export3MF(res, o);
    o = o || {};
    const cols = [];
    res.parts.forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const objects = res.parts.map(pt => ({
      name: pt.name, p: pt.local || pt.assembled || pt.p, color: pt.color,
      extruder: cols.indexOf((pt.color || '').toUpperCase()) + 1
    }));
    // Pack parts onto plates for the slicer
    const [UW, UD] = usableBed(res.options.bed);
    let plates = [objects.map((_, i) => i)];
    if (PL && PL.arrange) {
      try {
        const arranged = PL.arrange(objects.map(ob => ({ name: ob.name, p: ob.p, color: ob.color })), UW, UD, { gap: 6 });
        if (arranged.plates && arranged.plates.length) {
          const objs = [];
          plates = [];
          arranged.plates.forEach(list => {
            const ids = [];
            list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, p: it.p, color: it.color, extruder: cols.indexOf((it.color || '').toUpperCase()) + 1 }); });
            plates.push(ids);
          });
          return T.threeMF(objs, {
            title: o.name || 'Plant pot & tray',
            plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu,
            filaments: cols.map(c => ({ color: c }))
          });
        }
      } catch (_) {}
    }
    return T.threeMF(objects, {
      title: o.name || 'Plant pot & tray',
      plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu,
      filaments: cols.map(c => ({ color: c }))
    });
  }

  function files(res, o) {
    if (res && res.stats && res.stats.seed && Seed) return Seed.files(res, o);
    o = o || {};
    const base = o.fileBase || 'plant_pot';
    const out = [];
    res.parts.forEach(pt => {
      const mesh = pt.local || pt.assembled || pt.p;
      out.push({ name: `${base}_${pt.name.replace(/\s+/g, '_').toLowerCase()}.stl`, data: new Uint8Array(Core.writeSTL(mesh, pt.name)) });
    });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    const L = [];
    L.push('Expressarte plant pot & tray',
      `Shape: ${SHAPES[res.options.shape].label}`,
      `Style: ${STYLES[res.options.style].label}`,
      `Size: top \u00d8 ${res.stats.topD} mm, bottom \u00d8 ${res.stats.bottomD} mm, height ${res.stats.height} mm`,
      `Wall ${res.stats.wallT} mm, floor ${res.stats.bottomT} mm`,
      `Drainage: ${res.stats.drainage}`,
      res.split ? `Split into ${res.split.count} dovetail pieces` : 'Single pot piece',
      '', 'Filaments');
    res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}  ${f.role}`));
    L.push('', 'Printing',
      '  - Print the pot upright, flat bottom on the bed.',
      '  - Prefer PETG outdoors; PLA is fine indoors.',
      '  - Vase mode: enable spiral vase / single-wall in your slicer.',
      ...(res.warnings || []).map(w => '  - ' + w));
    out.push({ name: `${base}_NOTES.txt`, data: L.join('\n') });
    return out;
  }

  function gateInfo(o) {
    if (o && o.shape === 'seedtray' && Seed) return Seed.gateInfo(o);
    o = options(o);
    const why = [];
    if (!SHAPES[o.shape].free) why.push(`${SHAPES[o.shape].label} shape (Pro)`);
    if (!STYLES[o.style].free) why.push(`${STYLES[o.style].label} style (Pro)`);
    if (o.selfWater) why.push('self-watering insert (Pro)');
    if (o.vaseMode) why.push('vase mode (Pro)');
    if (SHAPES[o.shape].hang) why.push('hanging pot (Pro)');
    const cols = new Set([o.colors.pot, o.includeTray ? o.colors.tray : o.colors.pot, o.text ? o.colors.text : o.colors.pot].map(c => String(c).toUpperCase()));
    if (cols.size > 1 && (o.text || o.includeTray)) why.push('multicolor pot / tray / text 3MF (Pro)');
    if (o.detail === 'hd' && (!SHAPES[o.shape].free || !STYLES[o.style].free)) { /* covered by shape/style */ }
    return why;
  }

  const api = { SHAPES, STYLES, DEFAULTS, PALETTE, FREE, options, build, export3MF, files, gateInfo, radiusAt, potBody, trayMesh };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPPlantPot = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
