/* Expressarte giant Christmas bulb: classic C7 strawberry/cone glass (smooth or
   faceted), a contrasting screw-base cap, a well for a puck light or a cord,
   optional hanging loop or flat bottom, vase-mode wall, and auto-split when
   the bulb is bigger than the selected bed. American spelling. No brands. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);

  const DEFAULTS = {
    height: 300, glassD: 0, // 0 = auto from classic C7 proportions
    style: 'smooth', // smooth | faceted
    wallT: 1.2, floorT: 1.6,
    vaseMode: false,
    flatBottom: false,
    hangingLoop: false,
    led: 'puck', // puck | cord | none
    puckD: 50, puckDepth: 16, cordD: 8,
    loopD: 0, // 0 = auto
    colors: { glass: '#C41E3A', base: '#C4A35A' },
    bed: [256, 256, 256], bambu: 'A1', detail: 'hd'
  };

  const PALETTE = {
    glass: [
      { name: 'Classic red', hex: '#C41E3A' }, { name: 'Forest green', hex: '#1F7A4D' },
      { name: 'Cobalt', hex: '#1E4B9C' }, { name: 'Amber', hex: '#E39B1C' },
      { name: 'Clear', hex: '#E8F4F8' }, { name: 'Pink', hex: '#E47A9A' },
      { name: 'Orange', hex: '#E36A1E' }, { name: 'Gold glass', hex: '#E6C35C' }
    ],
    base: [
      { name: 'Brass', hex: '#C4A35A' }, { name: 'Gold', hex: '#D4AF37' },
      { name: 'Black', hex: '#1A1A1A' }, { name: 'Silver', hex: '#C0C6CC' },
      { name: 'Copper', hex: '#B87333' }, { name: 'Antique', hex: '#8A6A3B' }
    ]
  };

  const FREE_MAX_MM = 300;
  const BASE_FRAC = 0.22;

  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {}, {
      colors: Object.assign({}, DEFAULTS.colors, (raw && raw.colors) || {})
    });
    o.height = Math.max(40, Math.min(2000, +o.height || DEFAULTS.height));
    o.glassD = Math.max(0, Math.min(1200, +o.glassD || 0));
    o.style = o.style === 'faceted' ? 'faceted' : 'smooth';
    o.wallT = Math.max(0.6, Math.min(6, +o.wallT || DEFAULTS.wallT));
    o.floorT = Math.max(0.8, Math.min(8, +o.floorT || DEFAULTS.floorT));
    o.vaseMode = !!o.vaseMode;
    if (o.vaseMode) o.wallT = Math.min(o.wallT, 0.8);
    o.flatBottom = !!o.flatBottom;
    o.hangingLoop = !!o.hangingLoop;
    if (!['puck', 'cord', 'none'].includes(o.led)) o.led = 'puck';
    o.puckD = Math.max(12, Math.min(200, +o.puckD || DEFAULTS.puckD));
    o.puckDepth = Math.max(6, Math.min(60, +o.puckDepth || DEFAULTS.puckDepth));
    o.cordD = Math.max(3, Math.min(30, +o.cordD || DEFAULTS.cordD));
    o.loopD = Math.max(0, Math.min(80, +o.loopD || 0));
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    const bed = Array.isArray(o.bed) ? o.bed : DEFAULTS.bed;
    o.bed = [Math.max(40, +bed[0] || 256), Math.max(40, +bed[1] || 256), Math.max(40, +bed[2] || Math.min(+bed[0] || 256, +bed[1] || 256))];
    o.bambu = o.bambu || 'A1';
    return o;
  }

  function layout(o) {
    const H = o.height;
    const baseH = Math.max(22, Math.min(H * 0.32, H * BASE_FRAC));
    const neckLen = Math.max(10, Math.min(H * 0.05, baseH * 0.22));
    const glassH = H - baseH + neckLen; // cap overlaps the neck
    const glassD = o.glassD > 0 ? o.glassD : glassH * 0.58;
    const glassR = glassD / 2;
    const neckR = Math.max(6, glassR * 0.42);
    const tipR = o.flatBottom ? Math.max(6, glassR * 0.16) : Math.max(1.2, glassR * 0.035);
    const flangeH = Math.max(4, baseH * 0.16);
    const insulatorH = Math.max(4, baseH * 0.18);
    const wallT = o.wallT;
    const floorT = Math.max(o.floorT, wallT);
    return { H, baseH, glassH, glassR, neckR, neckLen, tipR, flangeH, insulatorH, wallT, floorT, overlap: neckLen };
  }

  // Classic C7 strawberry: rounded point, widest at the shoulder, short neck cylinder.
  function glassRadius(z, L) {
    const t = Math.max(0, Math.min(1, z / Math.max(1e-6, L.glassH)));
    const rMax = L.glassR, rNeck = L.neckR, rTip = L.tipR;
    const tMax = 0.62, tNeck = 0.88;
    if (t <= tMax) {
      const u = t / tMax;
      const e = Math.pow(Math.sin(u * Math.PI / 2), 0.82);
      return rTip + (rMax - rTip) * e;
    }
    if (t <= tNeck) {
      const u = (t - tMax) / (tNeck - tMax);
      const s = u * u * (3 - 2 * u);
      return rMax + (rNeck * 1.06 - rMax) * s;
    }
    const u = (t - tNeck) / Math.max(1e-6, 1 - tNeck);
    const s = u * u * (3 - 2 * u);
    return rNeck * 1.06 + (rNeck - rNeck * 1.06) * s;
  }

  function facetR(r, theta, z, o, L) {
    if (o.style !== 'faceted') return r;
    const sides = 8;
    const seg = Math.PI * 2 / sides;
    const local = ((theta % seg) + seg) % seg - seg / 2;
    let R = r / Math.max(0.25, Math.cos(local));
    // Diamond cuts on the body, not on the neck or tip
    const t = z / Math.max(1e-6, L.glassH);
    if (t > 0.08 && t < 0.86) {
      const u = ((theta / (Math.PI * 2)) * 8) % 1;
      const v = ((z / L.glassH) * 8) % 1;
      const d = (Math.abs(u - 0.5) + Math.abs(v - 0.5));
      const amp = (o.detail === 'draft' ? 1.2 : 2.0) * Math.min(8, r * 0.08);
      R += d < 0.42 ? amp : -amp * 0.35;
    }
    return R;
  }

  function dens(o) { return o.detail === 'draft' ? 0.45 : 1; }

  function thetaCount(o, r) {
    if (o.style === 'faceted') return 8 * (o.detail === 'draft' ? 3 : 8);
    return Math.max(24, Math.round((o.detail === 'draft' ? 28 : 72) + r / 8));
  }

  function xy(r, theta) { return [r * Math.cos(theta), r * Math.sin(theta)]; }

  function fix(p) {
    if (!p || !p.length) return p;
    return Core.signedVolume(p) < 0 ? Core.flip(p) : p;
  }

  function shiftToOrigin(p) {
    const b = Core.bbox(p);
    return move(p, -b.min[0], -b.min[1], -b.min[2]);
  }

  function move(p, dx, dy, dz) {
    if (PL && PL.move) return PL.move(p, dx, dy, dz || 0);
    const q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); }
    return q;
  }

  function beadAt(z, L) {
    // External press-fit bead just below the neck rim
    const zBead = L.glassH - Math.max(3, L.neckLen * 0.45);
    const w = Math.max(2.2, L.wallT * 1.6);
    const d = z - zBead;
    if (Math.abs(d) > w) return 0;
    return Math.cos((d / w) * Math.PI / 2) * Math.min(1.6, L.wallT * 1.1);
  }

  // Hollow glass shell from z0 to z1 (along the classic C7 profile). Optional male
  // lip at the top and female rebate at the bottom so stacked pieces lock together.
  function glassSegment(o, L, z0, z1, lips) {
    const wallT = L.wallT;
    const lipH = lips && (lips.top || lips.bottom) ? Math.max(5, Math.min(10, wallT * 4.5)) : 0;
    const lipClear = 0.25;
    const zStart = z0;
    const zEnd = z1 + (lips && lips.top ? lipH : 0);
    const span = Math.max(1, zEnd - zStart);
    const nTheta = thetaCount(o, L.glassR);
    const nZ = Math.max(8, Math.round(span / (o.detail === 'draft' ? 5.5 : 2.2)));
    const map = (i, j, t) => {
      const v = j / nZ;
      let z = zStart + v * span;
      const theta = (i / nTheta) * Math.PI * 2;
      let r = facetR(glassRadius(z, L), theta, z, o, L);
      if (z > L.glassH - L.neckLen) r = Math.max(r, L.neckR);
      if (!o.vaseMode) r += beadAt(z, L);
      // Female rebate on the bottom of an upper piece: thinner wall
      if (lips && lips.bottom && z < z0 + lipH) r = Math.max(r, glassRadius(z0, L));
      r = Math.max(wallT + 0.8, r);
      let innerOff = t;
      if (lips && lips.bottom && z < z0 + lipH) {
        // Open the inner wall to receive the male collar
        innerOff = Math.max(t * 0.35, t - (wallT * 0.55 + lipClear));
      }
      if (lips && lips.top && z > z1) {
        // Male collar: a short tube just inside the upper piece
        const rrOuter = Math.max(wallT + 0.6, facetR(glassRadius(z1, L), theta, z1, o, L) - wallT + wallT * 0.55);
        const rrInner = Math.max(wallT * 0.35, rrOuter - (wallT * 0.55));
        const rr = t > 0 ? rrInner : rrOuter;
        const [x, y] = xy(rr, theta);
        return [x, y, z];
      }
      // Closed tip / flat floor: solid through the first floorT
      const solidTip = z <= Math.max(L.floorT, o.flatBottom ? L.floorT : L.floorT);
      let rr;
      if (t <= 0) rr = r;
      else if (solidTip) rr = 0;
      else rr = Math.max(wallT * 0.3, r - innerOff);
      const [x, y] = xy(rr, theta);
      return [x, y, z];
    };
    const thick = () => wallT;
    return fix(T.heightSolid(nTheta, nZ + 1, thick, map, true));
  }

  function glassMesh(o, L, z0, z1, lips) {
    return glassSegment(o, L, z0, z1, lips);
  }

  function threadBump(theta, z, L) {
    const z0 = L.flangeH * 0.85;
    const z1 = L.baseH - L.insulatorH;
    if (z < z0 || z > z1) return 0;
    const pitch = Math.max(2.4, (z1 - z0) / 9);
    const phase = (z / pitch) * Math.PI * 2 + theta;
    const s = Math.sin(phase);
    const amp = Math.min(1.5, L.neckR * 0.08);
    return amp * Math.max(-0.15, s);
  }

  function capOuterR(z, L) {
    const t = z / Math.max(1e-6, L.baseH);
    // Wider crimped flange, slight taper, then a smooth insulator band
    const rMid = L.neckR * 1.22;
    const rTop = L.neckR * 1.05;
    const rFlange = L.neckR * 1.48;
    if (z < L.flangeH) {
      const u = z / L.flangeH;
      return rFlange + (rMid - rFlange) * (u * u * (3 - 2 * u));
    }
    if (z > L.baseH - L.insulatorH) {
      const u = (z - (L.baseH - L.insulatorH)) / L.insulatorH;
      return rMid + (rTop - rMid) * u + (u > 0.75 ? Math.sin((u - 0.75) / 0.25 * Math.PI) * rTop * 0.04 : 0);
    }
    return rMid + (rTop - rMid) * ((z - L.flangeH) / Math.max(1e-6, L.baseH - L.flangeH - L.insulatorH)) * 0.15;
  }

  function capMesh(o, L) {
    const wallT = Math.max(L.wallT, 1.2);
    const nTheta = Math.max(28, Math.round((o.detail === 'draft' ? 28 : 64) + L.neckR / 2));
    const nZ = Math.max(10, Math.round(L.baseH / (o.detail === 'draft' ? 4 : 1.6)));
    const socketDepth = L.overlap * 0.92;
    const wellR = o.led === 'puck' ? Math.min(o.puckD / 2, capOuterR(L.baseH * 0.5, L) - wallT * 2.2) : 0;
    const wellDepth = o.led === 'puck' ? Math.min(o.puckDepth, L.baseH - socketDepth - wallT * 1.5) : 0;
    const cordR = o.led === 'none' ? 0 : Math.min(o.cordD / 2, Math.max(1.5, (wellR || capOuterR(L.baseH, L) * 0.35) * 0.45));
    const map = (i, j, t) => {
      const v = j / nZ;
      const z = v * L.baseH;
      const theta = (i / nTheta) * Math.PI * 2;
      let r = capOuterR(z, L) + threadBump(theta, z, L);
      r = Math.max(wallT + 1, r);
      // Inner cavity: open socket at the bottom, then a shoulder, then LED well / cord
      let inner = r - (t || 0);
      if (t > 0) {
        if (z < socketDepth) {
          inner = L.neckR + 0.3; // clearance around the glass neck
          // Groove for the press-fit bead
          const zBead = socketDepth - Math.max(3, L.overlap * 0.45);
          const w = Math.max(2.2, wallT * 1.6);
          if (Math.abs(z - zBead) < w) inner += Math.cos(((z - zBead) / w) * Math.PI / 2) * Math.min(1.7, wallT * 1.15);
        } else if (o.led === 'puck' && z < socketDepth + wallT) {
          // Shoulder that the neck sits against; open into the well
          inner = wellR > 1 ? wellR : cordR;
        } else if (o.led === 'puck' && z < socketDepth + wallT + wellDepth) {
          inner = wellR;
        } else if (o.led !== 'none' && cordR > 0) {
          inner = cordR;
        } else {
          // Closed top
          inner = 0;
        }
        inner = Math.max(0, Math.min(inner, r - wallT * 0.35));
      } else {
        inner = r;
      }
      const rr = t > 0 ? inner : r;
      const [x, y] = xy(rr, theta);
      return [x, y, z];
    };
    let cap = fix(T.heightSolid(nTheta, nZ + 1, () => wallT, map, true));
    if (o.hangingLoop) cap = fix(T.concat([cap, loopMesh(o, L, wellR, cordR)]));
    return cap;
  }

  function loopMesh(o, L, wellR, cordR) {
    const tube = Math.max(2.2, Math.min(5.5, L.neckR * 0.16));
    const autoR = Math.max(6, Math.min(16, L.neckR * 0.42));
    const R = o.loopD > 0 ? o.loopD / 2 : autoR;
    const hole = Math.max(wellR, cordR);
    // If the top is open and large, park the loop on the +X side of the cap; otherwise it stands on top.
    const side = hole > R * 0.7;
    const capTopR = capOuterR(L.baseH, L);
    const cx = side ? Math.max(R + tube, capTopR * 0.15) + (capTopR - R * 0.2) * 0.15 : 0;
    const cy = 0;
    const cz = L.baseH + R - tube * 0.55;
    const nU = o.detail === 'draft' ? 16 : 28;
    const nV = o.detail === 'draft' ? 10 : 16;
    // Solid torus (closed surface) as the hanging loop
    const out = [];
    const pt = (u, v) => {
      const a = u / nU * Math.PI * 2, b = v / nV * Math.PI * 2;
      return [
        cx + (R + tube * Math.cos(b)) * Math.cos(a),
        cy + (R + tube * Math.cos(b)) * Math.sin(a),
        cz + tube * Math.sin(b)
      ];
    };
    const put = (A, B, C) => { out.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]); };
    const quad = (a, b, c, d) => { put(a, b, c); put(a, c, d); };
    for (let j = 0; j < nV; j++) for (let i = 0; i < nU; i++) {
      quad(pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1));
    }
    return fix(new Float64Array(out));
  }

  function usableBed(bed) {
    const [bx, by, bz] = bed || [256, 256, 256];
    return {
      w: Math.max(50, bx - 8),
      d: Math.max(50, by - 8),
      z: Math.max(40, (bz || Math.min(bx, by)) - 4)
    };
  }

  function zPlan(height, maxZ) {
    if (height <= maxZ + 0.4) return [0, height];
    const n = Math.max(2, Math.ceil(height / maxZ));
    const h = height / n;
    const cuts = [0];
    for (let i = 1; i < n; i++) cuts.push(+(i * h).toFixed(3));
    cuts.push(height);
    return cuts;
  }

  function xySplitPart(mesh, name, color, kind, UW, UD, wallT, warnings) {
    const pb = Core.bbox(mesh);
    const spanX = pb.max[0] - pb.min[0], spanY = pb.max[1] - pb.min[1];
    const fits = PL && PL.fits ? PL.fits(spanX, spanY, UW, UD) : (spanX <= UW && spanY <= UD);
    if (fits || !PL || !PL.buildSplit) {
      return [{ name, p: mesh, assembled: mesh, local: shiftToOrigin(mesh), color, kind }];
    }
    try {
      const ox = -pb.min[0], oy = -pb.min[1];
      const placed = move(mesh, ox, oy, 0);
      const split = PL.buildSplit(spanX, spanY, UW, UD, () => placed, { count: 0, edge: Math.max(10, wallT * 4) });
      if (split && split.pieces && split.pieces.length > 1) {
        const parts = split.pieces.map((pc, i) => {
          let m = PL.dropCrumbs ? PL.dropCrumbs(pc.built) : pc.built;
          m = move(m, -ox, -oy, 0); // back to the assembled pose (do not drop Z)
          const b = Core.bbox(m);
          return {
            name: `${name} piece ${i + 1} of ${split.pieces.length}`,
            p: m, assembled: m, local: move(m, -b.min[0], -b.min[1], -b.min[2]),
            color, kind, pieceIndex: i,
            w: b.max[0] - b.min[0], d: b.max[1] - b.min[1], h: b.max[2] - b.min[2]
          };
        });
        if (warnings) warnings.push(PL.splitNote(name, split, `${Math.round(UW)}\u00d7${Math.round(UD)} mm bed`));
        return { parts, split };
      }
    } catch (e) {
      if (warnings) warnings.push('Could not auto-split ' + name.toLowerCase() + ' for this bed: ' + (e.message || e));
    }
    return [{ name, p: mesh, assembled: mesh, local: shiftToOrigin(mesh), color, kind }];
  }

  function build(raw) {
    const o = options(raw);
    const L = layout(o);
    const warnings = [];
    if (o.vaseMode) warnings.push('Vase mode uses a single thin wall for spiral-vase printing. Print the glass tip-down, open neck up, and enable spiral vase in your slicer.');
    if (o.flatBottom) warnings.push('A flat tip lets the bulb stand on a table. The classic pointed C7 shape is slightly clipped.');
    if (o.hangingLoop) warnings.push('The hanging loop is on the cap. Print the cap with the flange on the bed; the loop points up.');

    const bed = usableBed(o.bed);
    const glassCuts = zPlan(L.glassH, bed.z);
    const glassParts = [];
    let glassSplitMeta = null;

    for (let i = 0; i < glassCuts.length - 1; i++) {
      const z0 = glassCuts[i], z1 = glassCuts[i + 1];
      const lips = {
        bottom: i > 0,
        top: i < glassCuts.length - 2
      };
      const mesh = glassMesh(o, L, z0, z1, lips);
      const label = glassCuts.length > 2 ? `Glass section ${i + 1} of ${glassCuts.length - 1}` : 'Glass';
      const got = xySplitPart(mesh, label, o.colors.glass, 'glass', bed.w, bed.d, L.wallT, warnings);
      if (got.split) {
        glassSplitMeta = glassSplitMeta || { count: 0, tabs: 0 };
        glassSplitMeta.count += got.split.pieces.length;
        glassSplitMeta.tabs += got.split.straight ? 0 : (got.split.tabs || 0);
        glassParts.push(...got.parts);
      } else {
        glassParts.push(...got);
      }
    }
    if (glassCuts.length > 2) {
      warnings.push(`The glass is taller than your ${Math.round(bed.z)} mm print height, so it is split into ${glassCuts.length - 1} stacked sections with a locking lip at each seam.`);
    }

    const cap = capMesh(o, L);
    const capGot = xySplitPart(cap, 'Base', o.colors.base, 'base', bed.w, bed.d, Math.max(L.wallT, 1.2), warnings);
    const capParts = capGot.parts || capGot;
    if (capGot.split) {
      glassSplitMeta = glassSplitMeta || { count: 0, tabs: 0 };
      glassSplitMeta.count += capGot.split.pieces.length;
      glassSplitMeta.tabs += capGot.split.straight ? 0 : (capGot.split.tabs || 0);
    }
    // Also Z-split the cap if it is somehow taller than the bed (huge bulbs)
    // The cap is usually short; skip further Z cuts unless a single cap piece is too tall.
    const parts = [];

    // Assembled pose: glass on the origin (tip at z=0), cap sits on the neck.
    const capLift = L.glassH - L.overlap;
    glassParts.forEach((pt, i) => {
      const assembled = pt.assembled || pt.p;
      const nGlass = glassParts.length;
      parts.push({
        name: pt.name,
        p: assembled,
        assembled,
        local: pt.local,
        color: pt.color,
        kind: 'glass',
        pieceIndex: pt.pieceIndex != null ? pt.pieceIndex : i,
        dir: nGlass > 1 ? [((i / Math.max(1, nGlass - 1)) * 2 - 1) * 0.7, 0, 0.15] : [0, 0, -0.35],
        spread: 0.45
      });
    });
    capParts.forEach((pt, i) => {
      const assembled = move(pt.assembled || pt.p, 0, 0, capLift);
      const nCap = capParts.length;
      parts.push({
        name: pt.name,
        p: assembled,
        assembled,
        local: pt.local,
        color: pt.color,
        kind: 'base',
        pieceIndex: pt.pieceIndex != null ? pt.pieceIndex : i,
        dir: nCap > 1 ? [0.2 + i * 0.15, 0, 0.85] : [0, 0, 0.9],
        spread: 0.55
      });
    });

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
    const splitCount = parts.filter(p => p.kind === 'glass').length + parts.filter(p => p.kind === 'base').length;
    const split = (glassCuts.length > 2 || (glassSplitMeta && glassSplitMeta.count > 0) || parts.length > 2)
      ? { count: parts.length, tabs: glassSplitMeta ? glassSplitMeta.tabs : 0, zSections: glassCuts.length - 1 }
      : (parts.length > 1 ? { count: parts.length, tabs: 0, zSections: 1 } : null);

    return {
      parts, options: o, layout: L, warnings, filaments,
      split,
      stats: {
        height: o.height, glassH: L.glassH, baseH: L.baseH,
        glassD: +(L.glassR * 2).toFixed(1), neckD: +(L.neckR * 2).toFixed(1),
        style: o.style, wallT: L.wallT, floorT: L.floorT,
        vaseMode: !!o.vaseMode, flatBottom: !!o.flatBottom, hangingLoop: !!o.hangingLoop,
        led: o.led, puckD: o.puckD, cordD: o.cordD,
        tris: all.length / 9, pieces: parts.length, colors: seen.size,
        sizeX: bb.max[0] - bb.min[0], sizeY: bb.max[1] - bb.min[1], sizeZ: bb.max[2] - bb.min[2],
        splitCount
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

  function writeOBJ(p, name) {
    const { V, F } = Core.weld(p);
    let s = `# Expressarte\no ${String(name || 'part').replace(/\s+/g, '_')}\n`;
    for (let i = 0; i < V.length; i += 3) s += `v ${V[i]} ${V[i + 1]} ${V[i + 2]}\n`;
    for (let i = 0; i < F.length; i += 3) s += `f ${F[i] + 1} ${F[i + 1] + 1} ${F[i + 2] + 1}\n`;
    return new TextEncoder().encode(s);
  }

  function export3MF(res, o) {
    o = o || {};
    const cols = [];
    res.parts.forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const objects = res.parts.map(pt => ({
      name: pt.name, p: pt.local || pt.assembled || pt.p, color: pt.color,
      extruder: cols.indexOf((pt.color || '').toUpperCase()) + 1
    }));
    const bed = usableBed(res.options.bed);
    let plates = [objects.map((_, i) => i)];
    if (PL && PL.arrange) {
      try {
        const arranged = PL.arrange(objects.map(ob => ({ name: ob.name, p: ob.p, color: ob.color })), bed.w, bed.d, { gap: 6, maxZ: bed.z });
        if (arranged.plates && arranged.plates.length) {
          const objs = [];
          plates = [];
          arranged.plates.forEach(list => {
            const ids = [];
            list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, p: it.p, color: it.color, extruder: cols.indexOf((it.color || '').toUpperCase()) + 1 }); });
            plates.push(ids);
          });
          return T.threeMF(objs, {
            title: o.name || 'Giant Christmas bulb',
            plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu,
            filaments: cols.map(c => ({ color: c }))
          });
        }
      } catch (_) {}
    }
    return T.threeMF(objects, {
      title: o.name || 'Giant Christmas bulb',
      plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu,
      filaments: cols.map(c => ({ color: c }))
    });
  }

  function files(res, o) {
    o = o || {};
    const base = o.fileBase || 'christmas_bulb';
    const out = [];
    res.parts.forEach(pt => {
      const mesh = pt.local || pt.assembled || pt.p;
      const slug = pt.name.replace(/\s+/g, '_').toLowerCase();
      out.push({ name: `${base}_${slug}.stl`, data: new Uint8Array(Core.writeSTL(mesh, pt.name)) });
      out.push({ name: `${base}_${slug}.obj`, data: writeOBJ(mesh, pt.name) });
    });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    const L = [];
    L.push('Expressarte giant Christmas bulb',
      `Shape: classic C7 ${res.stats.style} glass`,
      `Overall height: ${res.stats.height} mm (glass ${res.stats.glassH.toFixed(1)} mm, base ${res.stats.baseH.toFixed(1)} mm)`,
      `Glass diameter: ${res.stats.glassD} mm \u00b7 neck \u00d8 ${res.stats.neckD} mm`,
      `Wall ${res.stats.wallT} mm \u00b7 tip floor ${res.stats.floorT} mm`,
      `LED opening: ${res.stats.led === 'puck' ? 'puck well, ' + res.stats.puckD + ' mm' : res.stats.led === 'cord' ? 'cord hole, ' + res.stats.cordD + ' mm' : 'none'}`,
      res.stats.vaseMode ? 'Vase mode: single thin wall' : 'Standard hollow shell',
      res.stats.hangingLoop ? 'Hanging loop on the cap' : 'No hanging loop',
      res.stats.flatBottom ? 'Flat tip so it can stand' : 'Pointed tip',
      res.split && res.split.zSections > 1 ? `Glass split into ${res.split.zSections} stacked sections` : 'Glass is one piece',
      res.parts.length > 2 ? `Total parts: ${res.parts.length}` : 'Two parts: glass and base',
      '', 'Filaments');
    res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}  ${f.role}`));
    L.push('', 'Printing',
      '  - Print the glass tip-down, open neck up. Translucent or silk PLA looks closest to glass.',
      '  - Print the cap with the flange (the open socket) on the bed, threads and loop pointing up.',
      '  - The cap press-fits onto the neck. If it is tight, sand the bead lightly or raise slicer horizontal expansion a little.',
      '  - For a puck light, drop it into the well in the cap before you press the cap on.',
      '  - For a cord or string light, feed the wire through the hole in the cap.',
      '  - Vase mode: enable spiral vase / single-wall in your slicer for the glass only.',
      '  - Stacked glass sections have a locking lip; glue the seam after a dry fit.',
      ...(res.warnings || []).map(w => '  - ' + w));
    out.push({ name: `${base}_NOTES.txt`, data: L.join('\n') });
    return out;
  }

  function gateInfo(raw) {
    const o = options(raw);
    const why = [];
    if (o.height > FREE_MAX_MM + 0.5) why.push(`${Math.round(o.height)} mm bulb (free: up to ${FREE_MAX_MM} mm)`);
    if (o.style === 'faceted') why.push('faceted glass (Pro)');
    if (o.vaseMode) why.push('vase mode (Pro)');
    return why;
  }

  const api = { DEFAULTS, PALETTE, FREE_MAX_MM, options, layout, glassRadius, build, export3MF, files, gateInfo, writeOBJ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPC7Bulb = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
