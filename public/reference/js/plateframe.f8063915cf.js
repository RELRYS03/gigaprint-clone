/* Expressarte license plate frame generator: US/Canada, EU and AU presets (plus custom),
   banner text, 10 styles, two-color 3MF, auto-split when the frame is bigger than the bed.
   No car brands. Local mounting laws vary; sticker corners and plate text area stay clear. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const Bubble = G.GPBubble || (typeof require === 'function' ? require('./bubble.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);

  // Plate opening sizes (mm). Frame outer = plate + 2*border.
  const PRESETS = {
    us: { label: 'US / Canada \u00b7 12\u00d76 in', plateW: 304.8, plateH: 152.4, holes: true, holeDX: 177.8, holeDY: 120.65, stickers: true },
    eu: { label: 'EU \u00b7 520\u00d7110 mm', plateW: 520, plateH: 110, holes: false, stickers: false },
    au: { label: 'AU \u00b7 372\u00d7134 mm', plateW: 372, plateH: 134, holes: false, stickers: false },
    custom: { label: 'Custom size', plateW: 304.8, plateH: 152.4, holes: true, holeDX: 177.8, holeDY: 120.65, stickers: true }
  };

  // Free styles are the first few; the rest are Pro. Multicolor and HD detail are also Pro.
  const STYLES = {
    slim: { label: 'Slim', free: true, border: 12, corner: 4, bevel: 0.5, face: 'flat' },
    classic: { label: 'Classic thick', free: true, border: 22, corner: 8, bevel: 1.0, face: 'flat' },
    bevel: { label: 'Chrome-look bevel', free: true, border: 20, corner: 6, bevel: 2.8, face: 'bevel' },
    rounded: { label: 'Rounded bubble', free: false, border: 22, corner: 18, bevel: 2.2, face: 'bulb' },
    honeycomb: { label: 'Honeycomb', free: false, border: 24, corner: 6, bevel: 0.8, face: 'honey' },
    diamond: { label: 'Diamond plate', free: false, border: 22, corner: 5, bevel: 0.8, face: 'diamond' },
    checkered: { label: 'Checkered flag', free: false, border: 22, corner: 4, bevel: 0.6, face: 'checker' },
    carbon: { label: 'Carbon-fiber look', free: false, border: 20, corner: 5, bevel: 0.8, face: 'carbon' },
    script: { label: 'Script banner', free: false, border: 26, corner: 12, bevel: 1.0, face: 'flat', fontHint: 'soft' },
    snowflake: { label: 'Holiday snowflake', free: false, border: 24, corner: 10, bevel: 1.0, face: 'snow' }
  };

  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    preset: 'us', style: 'classic', plateW: 304.8, plateH: 152.4,
    border: 22, thickness: 3.2, clearance: 0.6,
    topText: 'GIGAPRINT', bottomText: '', font: 'round', textH: 11, textStyle: 'raised',
    colors: { frame: PZ.lavender, text: PZ.ink },
    bed: [256, 256], bambu: 'A1', detail: 'hd', holes: true, splitCount: 0
  };
  const PALETTE = [
    { name: 'Black', hex: '#1A1A1A' }, { name: 'White', hex: '#F7F7F2' }, { name: 'Red', hex: '#C8102E' },
    { name: 'Blue', hex: '#1E4DB7' }, { name: 'Silver', hex: '#C0C4CC' }, { name: 'Gold', hex: '#D4A72C' },
    { name: 'Green', hex: '#1E7B46' }, { name: 'Orange', hex: '#E07A3A' }
  ];
  const FREE = { styles: Object.keys(STYLES).filter(k => STYLES[k].free), colors: 1 };

  function options(raw) {
    const rawIn = raw || {};
    const o = Object.assign({}, DEFAULTS, rawIn);
    const pre = PRESETS[o.preset] || PRESETS.us;
    if (o.preset !== 'custom') { o.plateW = pre.plateW; o.plateH = pre.plateH; o.holes = !!pre.holes; }
    else { o.plateW = Math.max(80, Math.min(600, +o.plateW || pre.plateW)); o.plateH = Math.max(40, Math.min(300, +o.plateH || pre.plateH)); }
    if (!STYLES[o.style]) o.style = 'classic';
    const st = STYLES[o.style];
    // Prefer the style's border unless the caller explicitly set one (UI border field)
    const borderSrc = Object.prototype.hasOwnProperty.call(rawIn, 'border') ? rawIn.border : st.border;
    o.border = Math.max(8, Math.min(40, +(borderSrc != null ? borderSrc : st.border)));
    o.thickness = Math.max(2.0, Math.min(6, +o.thickness || DEFAULTS.thickness));
    o.clearance = Math.max(0.2, Math.min(2, +o.clearance || DEFAULTS.clearance));
    o.textH = Math.max(5, Math.min(18, +o.textH || DEFAULTS.textH));
    o.textStyle = o.textStyle === 'embossed' ? 'embossed' : 'raised';
    o.topText = String(o.topText || '').slice(0, 28);
    o.bottomText = String(o.bottomText || '').slice(0, 28);
    if (!Bubble || !Bubble.FONTS || !Bubble.FONTS[o.font]) o.font = st.fontHint || 'round';
    o.colors = Object.assign({}, DEFAULTS.colors, o.colors || {});
    if (String(o.colors.text || '').toUpperCase() === String(o.colors.frame || '').toUpperCase()) {
      o.colors.text = o.colors.frame.toUpperCase() === '#F7F7F2' || o.colors.frame.toUpperCase() === '#FFFFFF' ? '#1A1A1A' : '#F7F7F2';
    }
    o.holes = o.holes !== false && !!(PRESETS[o.preset] || PRESETS.us).holes;
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    return o;
  }

  function stadium(cx, cy, w, h) {
    const rx = w / 2, ry = h / 2, r = Math.min(rx, ry), L = [];
    for (let i = 0; i < 24; i++) { const a = -Math.PI / 2 + i / 24 * Math.PI; L.push([cx - (rx - r) + r * Math.cos(a), cy + r * Math.sin(a)]); }
    for (let i = 0; i < 24; i++) { const a = Math.PI / 2 + i / 24 * Math.PI; L.push([cx + (rx - r) + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return L;
  }

  function holeSlots(o, pre) {
    if (!o.holes || !pre.holeDX) return [];
    const cx = o.outerW / 2, cy = o.outerH / 2;
    const dx = pre.holeDX / 2, dy = pre.holeDY / 2, slotW = 7.5, slotH = 16;
    // Slots must sit on the plate face; skip when a custom plate is too small for the standard spacing
    if (pre.holeDX + slotW > o.plateW - 4 || pre.holeDY + slotH > o.plateH - 4) return [];
    return [[-dx, -dy], [dx, -dy], [-dx, dy], [dx, dy]].map(([x, y]) => ({ outer: stadium(cx + x, cy + y, slotW, slotH), holes: [] }));
  }

  function facePattern(o, st, dens) {
    // Through-cut detail on the border strip. Pads are intersected with the ring later, so centers
    // only need to sit on the border; cut-throughs are sized to read clearly in the 3D preview.
    const polys = [];
    const cx = o.outerW / 2, cy = o.outerH / 2;
    const inx0 = cx - o.plateW / 2 - o.clearance, inx1 = cx + o.plateW / 2 + o.clearance;
    const iny0 = cy - o.plateH / 2 - o.clearance, iny1 = cy + o.plateH / 2 + o.clearance;
    const margin = 1.2;
    const onBorder = (x, y) => {
      if (x < margin || x > o.outerW - margin || y < margin || y > o.outerH - margin) return false;
      // Center must lie in the border strip (outside the plate opening)
      return !(x > inx0 && x < inx1 && y > iny0 && y < iny1);
    };
    const step = dens === 'draft' ? 14 : 9;
    if (st.face === 'honey') {
      // Large hex cut-throughs sized to the border so the honeycomb reads at a glance
      const s = Math.max(9, Math.min(o.border * 0.72, dens === 'draft' ? 15 : 13));
      const h = s * Math.sqrt(3) / 2;
      const holeR = s * 0.42;
      for (let row = 0, y = s * 0.5; y < o.outerH - s * 0.4; y += h, row++) {
        for (let x = s * 0.5 + (row % 2 ? s / 2 : 0); x < o.outerW - s * 0.4; x += s) {
          if (!onBorder(x, y)) continue;
          const L = [];
          for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; L.push([x + holeR * Math.cos(a), y + holeR * Math.sin(a)]); }
          polys.push({ outer: L, holes: [] });
        }
      }
    } else if (st.face === 'diamond') {
      for (let y = step; y < o.outerH - step; y += step) for (let x = step; x < o.outerW - step; x += step) {
        if (!onBorder(x, y)) continue;
        const r = step * 0.38;
        polys.push({ outer: [[x, y - r], [x + r * 0.7, y], [x, y + r], [x - r * 0.7, y]], holes: [] });
      }
    } else if (st.face === 'checker') {
      // Visible checks fully inside the border strip (true through-cuts)
      const s = dens === 'draft' ? 11 : 9;
      const half = s * 0.40;
      const places = [];
      for (const y of [o.border * 0.5, o.outerH - o.border * 0.5]) {
        for (let x = o.border * 0.5; x < o.outerW - o.border * 0.5; x += s) places.push([x, y]);
      }
      for (const x of [o.border * 0.5, o.outerW - o.border * 0.5]) {
        for (let y = o.border + s * 0.5; y < o.outerH - o.border - s * 0.5; y += s) places.push([x, y]);
      }
      places.forEach(([x, y]) => {
        if ((Math.round(x / s) + Math.round(y / s)) % 2) return;
        if (!onBorder(x, y)) return;
        polys.push({ outer: [[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half]], holes: [] });
      });
    } else if (st.face === 'carbon') {
      // Diagonal raised ridges along the border strips
      const pitch = dens === 'draft' ? 5 : 3.2, w = 1.35;
      for (let k = -o.outerH; k < o.outerW + o.outerH; k += pitch) {
        const strip = [];
        for (let t = 0; t <= 1.001; t += 0.05) {
          const x = k + t * (o.outerW + o.outerH) * 0.5, y = t * o.outerH;
          // sample points along a diagonal; keep segments on the border
        }
        // Build short diamond ridges at samples on top/bottom/left/right borders
      }
      for (let y of [o.border * 0.45, o.outerH - o.border * 0.45]) {
        for (let x = 6; x < o.outerW - 6; x += pitch) {
          if (!onBorder(x, y, w)) continue;
          polys.push({ outer: [[x - w, y - 0.6], [x + w * 0.4, y - 0.6], [x + w, y + 0.6], [x - w * 0.4, y + 0.6]], holes: [] });
        }
      }
      for (let x of [o.border * 0.45, o.outerW - o.border * 0.45]) {
        for (let y = 6; y < o.outerH - 6; y += pitch) {
          if (!onBorder(x, y, w)) continue;
          polys.push({ outer: [[x - 0.6, y - w], [x + 0.6, y - w * 0.4], [x + 0.6, y + w], [x - 0.6, y + w * 0.4]], holes: [] });
        }
      }
    } else if (st.face === 'snow') {
      const flakes = [
        [cx, o.outerH - o.border * 0.48], [cx, o.border * 0.48],
        [o.border * 0.48, cy], [o.outerW - o.border * 0.48, cy],
        [o.border * 0.9, o.outerH - o.border * 0.9], [o.outerW - o.border * 0.9, o.outerH - o.border * 0.9],
        [o.border * 0.9, o.border * 0.9], [o.outerW - o.border * 0.9, o.border * 0.9]
      ];
      for (const [fx, fy] of flakes) {
        if (!onBorder(fx, fy, 4)) continue;
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2, L = dens === 'draft' ? 4.2 : 5.8;
          polys.push({ outer: [
            [fx + 0.6 * Math.cos(a + 0.4), fy + 0.6 * Math.sin(a + 0.4)],
            [fx + L * Math.cos(a), fy + L * Math.sin(a)],
            [fx + 0.6 * Math.cos(a - 0.4), fy + 0.6 * Math.sin(a - 0.4)]
          ], holes: [] });
        }
        polys.push({ outer: T.circle(fx, fy, 1.4, dens === 'draft' ? 8 : 12), holes: [] });
      }
    }
    return polys;
  }

  function bannerPolys(text, o, band) {
    // band: 'top' | 'bottom' \u2014 keep text in the border strip, clear of sticker corners on US plates
    if (!text || !Bubble) return { polys: [], scale: 1, fit: true, width: 0 };
    const st = STYLES[o.style];
    const maxH = Math.min(o.textH, o.border * 0.72);
    const marginX = o.preset === 'us' || o.preset === 'custom' ? 28 : 10; // clear sticker corners
    const maxW = o.outerW - 2 * marginX;
    const chars = [...text.toUpperCase()];
    let w = 0, glyphs = [];
    for (const ch of chars) {
      if (ch === ' ') { w += maxH * 0.35; continue; }
      const g = Bubble.glyphPolys(o.font || st.fontHint || 'round', ch, maxH);
      if (!g || !g.polys.length) continue;
      glyphs.push({ polys: g.polys, adv: g.advance || maxH * 0.7, at: w });
      w += (g.advance || maxH * 0.7) * 1.08;
    }
    let scale = 1, fit = true;
    if (w > maxW) { scale = maxW / w; fit = scale >= 0.55; }
    const midX = o.outerW / 2, midY = o.outerH / 2;
    const dy = band === 'top'
      ? midY + (o.plateH / 2 + o.clearance + o.border * 0.52) - maxH * scale * 0.35
      : midY - (o.plateH / 2 + o.clearance + o.border * 0.52) - maxH * scale * 0.35;
    const dx = midX - w * scale / 2, out = [];
    for (const g of glyphs) for (const P of g.polys) {
      out.push({
        outer: P.outer.map(p => [p[0] * scale + dx + g.at * scale, p[1] * scale + dy]),
        holes: (P.holes || []).map(h => h.map(p => [p[0] * scale + dx + g.at * scale, p[1] * scale + dy]))
      });
    }
    return { polys: out, scale, fit, width: w * scale, maxW, height: maxH * scale };
  }

  function ringDiff(o, openInset, corner) {
    // Build a border ring as boolean difference so steppedExtrude / withClip keep the opening.
    const cx = o.outerW / 2, cy = o.outerH / 2;
    const outer = T.roundRect(0, 0, o.outerW, o.outerH, corner);
    const openW = o.plateW / 2 + o.clearance - openInset, openH = o.plateH / 2 + o.clearance - openInset;
    const open = T.roundRect(cx - openW, cy - openH, cx + openW, cy + openH, Math.max(1, corner - 2));
    let polys = T.diffPolys([{ outer, holes: [] }], [{ outer: open, holes: [] }]);
    const pre = PRESETS[o.preset] || PRESETS.us;
    for (const h of holeSlots(o, pre)) polys = T.diffPolys(polys, [{ outer: h.outer, holes: [] }]);
    return polys;
  }

  function frameLayers(o) {
    const st = STYLES[o.style];
    o.outerW = o.plateW + 2 * o.border;
    o.outerH = o.plateH + 2 * o.border;
    const corner = Math.min(st.corner, o.border - 1);
    const bevel = Math.min(st.bevel, o.thickness * 0.45);
    const dens = o.detail;
    const layers = [];
    // Bottom lip under the plate edge (holds the plate): opening is smaller than the plate
    layers.push({ z0: 0, z1: 1.15, polys: ringDiff(o, 3.2, corner) });
    // Main border ring \u2014 full plate window
    const zBody0 = 1.15, zBody1 = o.thickness - (bevel > 0.25 ? bevel : 0);
    layers.push({ z0: zBody0, z1: Math.max(zBody0 + 0.55, zBody1), polys: ringDiff(o, 0, corner) });
    // Face bevel / bulbous rim (inset outer edge)
    if (bevel > 0.25) {
      const inset = bevel * (st.face === 'bulb' ? 1.5 : 1.0);
      const cx = o.outerW / 2, cy = o.outerH / 2;
      const outer2 = T.roundRect(inset, inset, o.outerW - inset, o.outerH - inset, Math.max(0.5, corner - inset * 0.4));
      const openW = o.plateW / 2 + o.clearance, openH = o.plateH / 2 + o.clearance;
      const open = T.roundRect(cx - openW, cy - openH, cx + openW, cy + openH, Math.max(1, corner - 2));
      let top = T.diffPolys([{ outer: outer2, holes: [] }], [{ outer: open, holes: [] }]);
      const pre = PRESETS[o.preset] || PRESETS.us;
      for (const h of holeSlots(o, pre)) top = T.diffPolys(top, [{ outer: h.outer, holes: [] }]);
      layers.push({ z0: zBody1, z1: o.thickness, polys: top });
    }
    // Through-cut or face-cut patterns are booleaned into the main ring so the solid stays watertight
    // under withClip (raised separate pads left open edges at T-junctions).
    const pat = facePattern(o, st, dens);
    const applyPat = (ring) => {
      if (!pat.length) return ring;
      const pads = T.interPolys(pat, ring);
      return pads.length ? T.diffPolys(ring, pads) : ring;
    };
    // Rebuild layers with patterned ring. Through-cuts go all the way (including the lip)
    // so the honeycomb/checker openings read clearly against the background in the preview.
    // A narrow solid band next to the plate opening is kept by facePattern's onBorder check.
    if (st.face === 'honey' || st.face === 'checker' || st.face === 'diamond' || st.face === 'carbon' || st.face === 'snow') {
      for (const L of layers) L.polys = applyPat(L.polys);
    }
    if (!(bevel > 0.25)) {
      layers.push({ z0: zBody1, z1: o.thickness, polys: applyPat(ringDiff(o, 0, corner)) });
    } else {
      // patterned bevel top
      const last = layers[layers.length - 1];
      if (last && last.z1 >= o.thickness - 0.01) last.polys = applyPat(last.polys);
    }
    return { layers, outerW: o.outerW, outerH: o.outerH };
  }

  function textParts(o) {
    const top = bannerPolys(o.topText, o, 'top');
    const bot = bannerPolys(o.bottomText, o, 'bottom');
    const warnings = [];
    if (o.topText && !top.fit) warnings.push('Top banner text was shrunk to fit; shorten it for clearer letters.');
    if (o.bottomText && !bot.fit) warnings.push('Bottom banner text was shrunk to fit; shorten it for clearer letters.');
    if ((o.preset === 'us' || o.preset === 'custom') && o.holes) {
      warnings.push('Mounting slots match common US/Canada plate spacing. Local laws vary \u2014 keep state names, plate numbers and registration stickers visible.');
    }
    const raise = o.textStyle === 'embossed' ? -0.7 : 1.6;
    const z0 = o.textStyle === 'embossed' ? Math.max(0.4, o.thickness + raise) : o.thickness - 0.02;
    const z1 = o.textStyle === 'embossed' ? o.thickness + 0.02 : o.thickness + raise;
    const polys = top.polys.concat(bot.polys);
    let mesh = null;
    if (polys.length) mesh = T.extrude(polys, 2, Math.min(z0, z1), Math.max(z0, z1));
    return { mesh, warnings, top, bot, raise };
  }

  function sealMesh(p) {
    if (!p || !p.length || !Core.fixTJunctions) return p;
    let q = p;
    for (let i = 0; i < 14 && !Core.checkClosed(q).closed; i++) {
      const tol = i < 4 ? 1e-3 : i < 8 ? 1e-2 : 4e-2;
      const f = Core.fixTJunctions(q, new Array(q.length / 9).fill(0), tol);
      if (!f || !f.p) break;
      if (f.p.length === q.length && i > 2) {
        // try dropping crumbs then continue
        if (PL && PL.dropCrumbs) q = PL.dropCrumbs(q);
        else break;
        continue;
      }
      q = Float64Array.from(f.p);
    }
    if (PL && PL.dropCrumbs) q = PL.dropCrumbs(q);
    return q;
  }

  function usableBed(bed, bambu) {
    const [bx, by] = bed;
    // Leave a small margin; Bambu exclusion corner is handled by the shared printer step
    return [Math.max(80, bx - 8), Math.max(80, by - 8)];
  }

  function build(raw) {
    const o = options(raw);
    o.outerW = o.plateW + 2 * o.border;
    o.outerH = o.plateH + 2 * o.border;
    const geom = frameLayers(o);
    const buildFn = () => sealMesh(T.steppedExtrude(geom.layers.map(L => ({ z0: L.z0, z1: L.z1, polys: L.polys }))));
    let frameMesh = buildFn();
    const txt = textParts(o);
    const warnings = txt.warnings.slice();
    warnings.push('Print flat on the bed. For outdoor use prefer PETG or ASA (UV and heat).');

    const [UW, UD] = usableBed(o.bed, o.bambu);
    let split = null, pieces = null;
    const fits = PL.fits(o.outerW, o.outerH, UW, UD);
    const diag = Math.hypot(o.outerW, o.outerH);
    if (!fits && diag <= Math.max(UW, UD) * 1.02 && Math.min(o.outerW, o.outerH) <= Math.min(UW, UD) + 1) {
      warnings.push('This frame is long for your bed; it will auto-split into dovetail pieces (or try a larger printer).');
    }
    if (!fits) {
      try {
        split = PL.buildSplit(o.outerW, o.outerH, UW, UD, buildFn, { count: o.splitCount || 0, edge: Math.max(12, o.border * 0.55) });
        if (split && split.pieces) {
          // Keep assembled (world) coordinates on .p for preview + multicolor 3MF; .local is origin-normalized for STL packing.
          pieces = split.pieces.map((pc, i) => {
            const m = sealMesh(PL.dropCrumbs(pc.built)), b = Core.bbox(m);
            const local = PL.move(m, -b.min[0], -b.min[1], -b.min[2]);
            return {
              name: `Frame piece ${i + 1} of ${split.pieces.length}`,
              p: m, assembled: m, local,
              w: b.max[0] - b.min[0], d: b.max[1] - b.min[1], h: b.max[2] - b.min[2],
              color: o.colors.frame, kind: 'frame', pieceIndex: i,
              ox: b.min[0], oy: b.min[1] // origin of this piece in assembled space (for explode)
            };
          });
          frameMesh = T.concat(split.pieces.map(pc => pc.built));
          warnings.push(PL.splitNote('License plate frame', split, `${Math.round(UW)}\u00d7${Math.round(UD)} mm bed`));
        }
      } catch (e) {
        warnings.push('Could not auto-split for this bed: ' + (e.message || e));
      }
    }

    const textMesh = txt.mesh || null;
    const parts = [];
    if (pieces && pieces.length > 1) {
      pieces.forEach(pc => parts.push(pc));
    } else {
      parts.push({ name: 'Frame', p: frameMesh, assembled: frameMesh, local: frameMesh, color: o.colors.frame, kind: 'frame', w: o.outerW, d: o.outerH, h: o.thickness, ox: 0, oy: 0 });
    }
    if (textMesh && textMesh.length) {
      const tb = Core.bbox(textMesh);
      parts.push({
        name: 'Banner text', p: textMesh, assembled: textMesh, local: textMesh,
        color: o.colors.text, kind: 'text',
        w: tb.max[0] - tb.min[0], d: tb.max[1] - tb.min[1], h: tb.max[2] - tb.min[2],
        ox: tb.min[0], oy: tb.min[1]
      });
    }

    // Opening area check (for stats + tests): solid-slab volume would be ~outerW*outerH*thickness
    const frameOnly = pieces && pieces.length > 1 ? T.concat(pieces.map(pc => pc.assembled)) : frameMesh;
    const frameVol = Math.abs(Core.signedVolume(frameOnly));
    const solidVol = o.outerW * o.outerH * o.thickness;
    const openFrac = 1 - frameVol / Math.max(1, solidVol);

    const filaments = [{ role: 'frame', color: o.colors.frame }];
    if (textMesh) filaments.push({ role: 'text', color: o.colors.text });
    const colorsUsed = new Set(filaments.map(f => f.color.toUpperCase()));
    const all = T.concat(parts.map(p => p.assembled || p.p));
    const tris = all.length / 9;
    return {
      parts, options: o, warnings, filaments, styles: STYLES, presets: PRESETS,
      split: split ? { count: split.pieces.length, tabs: split.straight ? 0 : split.tabs, nx: split.plan.nx, ny: split.plan.ny } : null,
      stats: {
        outerW: o.outerW, outerH: o.outerH, thickness: o.thickness, style: o.style, preset: o.preset,
        tris, pieces: pieces ? pieces.length : 1, colors: colorsUsed.size,
        topFit: !o.topText || txt.top.fit, bottomFit: !o.bottomText || txt.bot.fit,
        holes: !!o.holes, openFrac, frameVol,
        plateW: o.plateW, plateH: o.plateH, border: o.border
      },
      plate: all,
      assembled: all
    };
  }

  function export3MF(res, o) {
    o = o || {};
    const cols = [];
    res.parts.forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    // Assembled positions so banner text sits on the border; slicer sees frame + text as separate filaments.
    const objects = res.parts.map(pt => ({
      name: pt.name, p: pt.assembled || pt.p, color: pt.color,
      extruder: cols.indexOf((pt.color || '').toUpperCase()) + 1
    }));
    return T.threeMF(objects, {
      title: o.name || 'License plate frame',
      plates: [objects.map((_, i) => i)],
      bambu: o.bambu === undefined ? res.options.bambu : o.bambu,
      filaments: cols.map(c => ({ color: c }))
    });
  }

  function files(res, o) {
    o = o || {};
    const base = o.fileBase || 'license_plate_frame';
    const out = [];
    res.parts.forEach(pt => {
      // Frame split pieces print from their local (origin) mesh; text stays assembled so it mates with the frame.
      const mesh = pt.kind === 'frame' && pt.local ? pt.local : (pt.assembled || pt.p);
      out.push({ name: `${base}_${pt.name.replace(/\s+/g, '_').toLowerCase()}.stl`, data: new Uint8Array(Core.writeSTL(mesh, pt.name)) });
    });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    const L = [];
    L.push('Expressarte license plate frame', `Style: ${STYLES[res.options.style].label}`, `Preset: ${PRESETS[res.options.preset].label}`,
      `Outer: ${res.stats.outerW.toFixed(1)} \u00d7 ${res.stats.outerH.toFixed(1)} \u00d7 ${res.stats.thickness.toFixed(1)} mm`,
      res.split ? `Split into ${res.split.count} dovetail pieces` : 'Single piece',
      '', 'Filaments');
    res.filaments.forEach((f, i) => L.push(`  ${i + 1}: ${f.color}  ${f.role}`));
    L.push('', 'Printing', '  - Print flat on the bed, no supports.', '  - Outdoor: PETG or ASA for UV and heat.',
      '  - Keep plate numbers, stickers and state names visible. Local laws vary.',
      ...(res.warnings || []).map(w => '  - ' + w));
    out.push({ name: `${base}_NOTES.txt`, data: L.join('\n') });
    return out;
  }

  function gateInfo(o) {
    o = options(o);
    const why = [];
    if (!STYLES[o.style].free) why.push(`${STYLES[o.style].label} style (Pro)`);
    const cols = new Set([o.colors.frame, o.colors.text].map(c => String(c).toUpperCase()));
    if (cols.size > FREE.colors && (o.topText || o.bottomText)) why.push(`${cols.size} colors (free: frame-only / 1 color)`);
    if (o.detail === 'hd' && (!STYLES[o.style].free || cols.size > 1)) { /* HD always allowed for free basic; multicolor HD is fine once Pro */ }
    // Multicolor 3MF with separate text filament counts as Pro when text is present and color differs
    if ((o.topText || o.bottomText) && String(o.colors.frame).toUpperCase() !== String(o.colors.text).toUpperCase()) {
      why.push('multicolor frame + text 3MF (Pro)');
    }
    return why;
  }

  const api = { PRESETS, STYLES, DEFAULTS, PALETTE, FREE, options, build, export3MF, files, gateInfo, bannerPolys, holeSlots };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPPlateFrame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
