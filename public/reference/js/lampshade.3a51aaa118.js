/* Expressarte lithophane lampshade: a photo wrapped around a printable lamp shade. Thin plastic lets more light through,
   so the wall's thickness follows the photo (dark = thick, light = thin) and the picture appears when the lamp is lit.
   Shape: a profile (top, bottom and middle diameters with a curve fullness) swept around a cross-section (round,
   polygon with rounded corners, star or heart) with waves and a twist. Every preset only sets these values.
   Mesh: a grid on the unrolled wall (columns evenly spaced along the outline, rows evenly spaced along the profile).
   The smooth skin is the shape itself; the relief skin is offset horizontally along the outline normal by the local
   thickness (scaled for the wall's slope), so every row stays flat in z, the top and bottom are flat for the print bed,
   and the shell is closed and two-manifold by construction. Outline corners tighter than the thickest wall are rounded
   so the offset never folds. Rims are solid bands; the shade can be split into panels and height sections to fit a bed.
   Separate parts (Manifold): a spider fitter for a harp or a lamp socket, and a base that holds a puck light.
   World frame (assembled): z = 0 is the shade's bottom edge (or the table when a base is on), the front faces -y.
   Generic names only. American spelling. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const TAU = Math.PI * 2;

  // section: 'poly' (sides 0 = round), 'star' (sides = points), 'heart'. bulge: extra middle diameter (mm, - = waist).
  // fullness: the curve's exponent (2 = parabola, higher = rounder shoulders). rounding: corner rounding (%).
  const PRESETS = {
    cylinder: { label: 'Cylinder', section: 'poly', sides: 0, height: 180, topD: 150, bottomD: 150, bulge: 0, fullness: 2, rounding: 0, waves: 0, waveDepth: 0, twist: 0 },
    drum: { label: 'Tapered drum', section: 'poly', sides: 0, height: 170, topD: 115, bottomD: 180, bulge: 0, fullness: 2, rounding: 0, waves: 0, waveDepth: 0, twist: 0 },
    bell: { label: 'Bell', section: 'poly', sides: 0, height: 170, topD: 95, bottomD: 190, bulge: -34, fullness: 2, rounding: 0, waves: 0, waveDepth: 0, twist: 0 },
    globe: { label: 'Globe', section: 'poly', sides: 0, height: 180, topD: 100, bottomD: 110, bulge: 70, fullness: 2.4, rounding: 0, waves: 0, waveDepth: 0, twist: 0 },
    hexagon: { label: 'Hexagon', section: 'poly', sides: 6, height: 180, topD: 160, bottomD: 160, bulge: 0, fullness: 2, rounding: 12, waves: 0, waveDepth: 0, twist: 0 },
    octagon: { label: 'Octagon', section: 'poly', sides: 8, height: 180, topD: 155, bottomD: 155, bulge: 0, fullness: 2, rounding: 12, waves: 0, waveDepth: 0, twist: 0 },
    square: { label: 'Rounded square', section: 'poly', sides: 4, height: 170, topD: 170, bottomD: 170, bulge: 0, fullness: 2, rounding: 30, waves: 0, waveDepth: 0, twist: 0 },
    heart: { label: 'Heart', section: 'heart', sides: 0, height: 160, topD: 170, bottomD: 170, bulge: 0, fullness: 2, rounding: 20, waves: 0, waveDepth: 0, twist: 0 },
    star: { label: 'Star', section: 'star', sides: 6, height: 170, topD: 175, bottomD: 175, bulge: 0, fullness: 2, rounding: 10, starDepth: 30, waves: 0, waveDepth: 0, twist: 0 },
    scallop: { label: 'Wavy', section: 'poly', sides: 0, height: 170, topD: 150, bottomD: 165, bulge: 0, fullness: 2, rounding: 0, waves: 12, waveDepth: 5, twist: 0 },
    twisthex: { label: 'Twisted hex', section: 'poly', sides: 6, height: 180, topD: 155, bottomD: 155, bulge: 0, fullness: 2, rounding: 18, waves: 0, waveDepth: 0, twist: 60 },
    hourglass: { label: 'Hourglass', section: 'poly', sides: 0, height: 180, topD: 160, bottomD: 160, bulge: -50, fullness: 2, rounding: 0, waves: 0, waveDepth: 0, twist: 0 },
    lantern: { label: 'Lantern', section: 'poly', sides: 0, height: 180, topD: 110, bottomD: 110, bulge: 56, fullness: 2.2, rounding: 0, waves: 16, waveDepth: 3, twist: 0 },
    cone: { label: 'Cone', section: 'poly', sides: 0, height: 170, topD: 60, bottomD: 190, bulge: 0, fullness: 2 },
    teardrop: { label: 'Teardrop', section: 'poly', sides: 0, height: 190, topD: 50, bottomD: 120, bulge: 80, fullness: 1.6, bulgeAt: 0.35 },
    onion: { label: 'Onion dome', section: 'poly', sides: 0, height: 190, topD: 50, bottomD: 130, bulge: 70, fullness: 1.8, bulgeAt: 0.3, waves: 10, waveDepth: 4 },
    pagoda: { label: 'Pagoda', section: 'poly', sides: 6, height: 200, topD: 85, bottomD: 165, rounding: 20, tiers: 3, tierDepth: 14 },
    mushroom: { label: 'Mushroom', section: 'poly', sides: 0, height: 170, topD: 110, bottomD: 90, bulge: 76, fullness: 1.6, bulgeAt: 0.7 },
    barrel: { label: 'Barrel', section: 'poly', sides: 16, height: 180, topD: 135, bottomD: 135, bulge: 30, fullness: 2, rounding: 0 },
    vase: { label: 'Vase', section: 'poly', sides: 0, height: 200, topD: 100, bottomD: 110, bulge: 80, fullness: 2, bulgeAt: 0.4, flareTop: 28 },
    diamond: { label: 'Diamond', section: 'poly', sides: 8, height: 190, topD: 70, bottomD: 70, bulge: 120, fullness: 1, rounding: 0 },
    gear: { label: 'Gear', section: 'gear', sides: 12, height: 170, topD: 170, bottomD: 170, starDepth: 12, rounding: 20 },
    flower: { label: 'Flower', section: 'flower', sides: 6, height: 170, topD: 165, bottomD: 150, bulge: 16, starDepth: 25, rounding: 40 },
    scalloped: { label: 'Scalloped', section: 'flower', sides: 16, height: 170, topD: 160, bottomD: 160, starDepth: 8, rounding: 40 },
    spiral: { label: 'Spiral ribbed', section: 'poly', sides: 0, height: 190, topD: 150, bottomD: 150, waves: 14, waveDepth: 7, twist: 150 },
    squaretaper: { label: 'Tapered square', section: 'poly', sides: 4, height: 180, topD: 115, bottomD: 175, rounding: 14 },
    triangle: { label: 'Triangle', section: 'poly', sides: 3, height: 170, topD: 110, bottomD: 110, rounding: 30 },
    pentagon: { label: 'Pentagon', section: 'poly', sides: 5, height: 175, topD: 160, bottomD: 160, rounding: 14 },
    cloud: { label: 'Cloud', section: 'cloud', sides: 7, height: 150, topD: 200, bottomD: 200, starDepth: 22, rounding: 40 },
    cabin: { label: 'Cabin', section: 'poly', sides: 4, height: 200, topD: 50, bottomD: 150, bulge: 62, fullness: 1, bulgeAt: 0.62, rounding: 6 },
    // rippled styles: fine flutes, bold ribs, pleats, flowing lobes, stacked ripples and soft puffy shapes
    fluted: { label: 'Fluted', section: 'poly', sides: 0, height: 180, topD: 140, bottomD: 150, waves: 32, waveDepth: 4, waveShape: 'flute' },
    ribbed: { label: 'Ribbed', section: 'poly', sides: 0, height: 175, topD: 130, bottomD: 150, bulge: 24, fullness: 2, waves: 24, waveDepth: 6 },
    pleated: { label: 'Pleated', section: 'poly', sides: 0, height: 180, topD: 120, bottomD: 170, waves: 20, waveDepth: 8, waveShape: 'pleat' },
    twistrib: { label: 'Twisted ribs', section: 'poly', sides: 0, height: 185, topD: 140, bottomD: 150, bulge: 12, waves: 18, waveDepth: 7, waveShape: 'flute', twist: 100 },
    flowing: { label: 'Flowing waves', section: 'poly', sides: 0, height: 175, topD: 130, bottomD: 150, bulge: 30, fullness: 2, waves: 8, waveDepth: 14, sway: 30 },
    ripple: { label: 'Ripple', section: 'poly', sides: 0, height: 180, topD: 140, bottomD: 145, ripples: 6, rippleDepth: 5 },
    marshmallow: { label: 'Marshmallow', section: 'poly', sides: 4, height: 150, topD: 150, bottomD: 160, bulge: 20, fullness: 3, rounding: 85, ripples: 3, rippleDepth: 7, twist: 20 },
    bulbsquare: { label: 'Bulbous square', section: 'poly', sides: 4, height: 170, topD: 120, bottomD: 140, bulge: 46, fullness: 3, rounding: 70 },
    organic: { label: 'Organic', section: 'cloud', sides: 5, height: 175, topD: 120, bottomD: 140, bulge: 34, fullness: 2, bulgeAt: 0.42, rounding: 40, starDepth: 16, twist: 30, sway: 35 },
    egg: { label: 'Ribbed egg', section: 'poly', sides: 0, height: 190, topD: 72, bottomD: 108, bulge: 92, fullness: 2, bulgeAt: 0.44, ripples: 12, rippleDepth: 3 },
    ribmushroom: { label: 'Ribbed mushroom', section: 'poly', sides: 0, height: 170, topD: 110, bottomD: 100, bulge: 70, fullness: 1.6, bulgeAt: 0.7, waves: 16, waveDepth: 3 },
    // designer styles: a full look (shape, wall, base or pendant cap, pastel colors). The extra keys (wall pattern,
    // relief, lamp base, fitter, colors) are suggestions the app applies with the shape; matchPreset only compares the shape.
    rippletwist: { label: 'Rippled twist vase', section: 'poly', sides: 0, height: 190, topD: 120, bottomD: 130, bulge: 34, fullness: 2, bulgeAt: 0.45, waves: 5, waveDepth: 12, twist: 70, sway: 20, fineWaves: 64, fineDepth: 1.4,
      look: { pattern: 'plain', relief: 'inside', colors: { shade: '#F4B6C2' } } },
    origami: { label: 'Origami drum', section: 'poly', sides: 10, height: 160, topD: 150, bottomD: 170, rounding: 0, zigzag: 4,
      look: { pattern: 'plain', relief: 'inside', lamp: 'faceted', colors: { shade: '#F6EFDC', base: '#A7C7E7' } } },
    flutedmushroom: { label: 'Fluted mushroom', section: 'poly', sides: 0, height: 160, topD: 96, bottomD: 190, bulge: 36, fullness: 1.6, bulgeAt: 0.6, waves: 20, waveDepth: 6, waveShape: 'scallop',
      look: { pattern: 'plain', relief: 'inside', lamp: 'ribstem', colors: { shade: '#F8E7A1', base: '#F8E7A1' } } },
    spiralcone: { label: 'Spiral cone', section: 'poly', sides: 0, height: 140, topD: 70, bottomD: 210, waves: 24, waveDepth: 3, waveShape: 'scallop', twist: 120,
      look: { pattern: 'plain', relief: 'inside', lamp: 'spiral', colors: { shade: '#A8E6CF', base: '#A8E6CF' } } },
    softsquare: { label: 'Soft square pendant', section: 'poly', sides: 4, height: 170, topD: 150, bottomD: 165, bulge: 18, fullness: 3, rounding: 72, texture: 'knit', textureDepth: 1.1, textureSize: 7,
      look: { pattern: 'plain', relief: 'inside', fitter: 'pendant26', colors: { shade: '#C8B6E2', base: '#C8B6E2' } } },
    latticependant: { label: 'Lattice pendant', section: 'poly', sides: 0, height: 200, topD: 90, bottomD: 120, bulge: 70, fullness: 2.2, bulgeAt: 0.45,
      look: { pattern: 'voronoi', relief: 'outside', fitter: 'pendant26', colors: { shade: '#F9C6A8', base: '#F9C6A8' } } },
    diamondlattice: { label: 'Diamond lattice', section: 'poly', sides: 0, height: 160, topD: 150, bottomD: 160, texture: 'diamond', textureDepth: 1.4, textureSize: 22,
      look: { pattern: 'plain', relief: 'inside', lamp: 'lattice', colors: { shade: '#F6EFDC', base: '#B5C9A8' } } },
    slatted: { label: 'Slatted pendant', section: 'poly', sides: 0, height: 200, topD: 142, bottomD: 152,
      look: { pattern: 'slats', relief: 'outside', fitter: 'pendant26', colors: { shade: '#A7C7E7', base: '#A7C7E7' } } }
  };
  const DESIGNER = ['rippletwist', 'origami', 'flutedmushroom', 'spiralcone', 'softsquare', 'latticependant', 'diamondlattice', 'slatted'];
  const WAVE_SHAPES = { round: 'Rounded ribs', flute: 'Flutes (sharp ridges)', pleat: 'Pleats (folded)', scallop: 'Fins (round ridges, sharp grooves)' };
  // surface textures (both faces of the wall move together, so the thickness and the glow stay even)
  const TEXTURES = { none: 'None', knit: 'Soft knit (fuzzy bumps)', diamond: 'Diamond lattice' };
  // what the wall shows: the photo, an even wall, or a pattern that glows (thin windows between thick ribs)
  const PATTERNS = { photo: 'Photo (lithophane)', plain: 'Plain glow (even wall)', voronoi: 'Lattice cells (organic)', slats: 'Slats (vertical)' };
  const SECTIONS = { poly: 'Round or polygon', star: 'Star', heart: 'Heart', flower: 'Flower', gear: 'Gear', cloud: 'Cloud' };
  // every preset sets every shape value (so picking one resets the rest)
  const SHAPE_DEFAULTS = { section: 'poly', sides: 0, height: 180, topD: 150, bottomD: 150, bulge: 0, fullness: 2, bulgeAt: 0.5, rounding: 0, starDepth: 22, waves: 0, waveDepth: 0, twist: 0, tiers: 0, tierDepth: 0, flareTop: 0, flareBottom: 0, waveShape: 'round', sway: 0, ripples: 0, rippleDepth: 0, fineWaves: 0, fineDepth: 0, zigzag: 0, texture: 'none', textureDepth: 0, textureSize: 8 };
  for (const k of Object.keys(PRESETS)) PRESETS[k] = Object.assign({ label: PRESETS[k].label }, SHAPE_DEFAULTS, PRESETS[k]);
  // fitters: the spider's center hole. harp: the harp's top stud; e26 / e12: a socket's shade ring.
  const FITTERS = {
    none: { label: 'None', holeD: 0 },
    harp: { label: 'Harp top (spider fitter)', holeD: 7 },
    e26: { label: 'E26 socket ring', holeD: 40 },
    e12: { label: 'E12 candelabra socket ring', holeD: 22 },
    // pendant: a solid cap on the top edge (vents, grooved top) that the socket's shade ring clamps; the shade hangs
    pendant26: { label: 'Pendant cord cap (E26)', holeD: 40, cap: true, socket: 'e26' },
    pendant12: { label: 'Pendant cord cap (E12)', holeD: 22, cap: true, socket: 'e12' }
  };
  // lamp bases: a printed body the shade drops into. h: default height; the tripod prints upside down.
  const LAMPS = {
    none: { label: 'No lamp base', h: 0, minH: 0, maxH: 0 },
    disc: { label: 'Minimal disc', h: 18, minH: 10, maxH: 40 },
    pedestal: { label: 'Round pedestal', h: 70, minH: 40, maxH: 160 },
    block: { label: 'Square block', h: 45, minH: 20, maxH: 120 },
    tripod: { label: 'Tripod legs', h: 90, minH: 50, maxH: 180 },
    column: { label: 'Turned column', h: 150, minH: 80, maxH: 200 },
    fluted: { label: 'Fluted drum', h: 60, minH: 30, maxH: 140 },
    stepped: { label: 'Stepped pedestal', h: 55, minH: 30, maxH: 120 },
    dome: { label: 'Rounded dome', h: 50, minH: 25, maxH: 110 },
    mushroom: { label: 'Mushroom stem', h: 90, minH: 60, maxH: 170 },
    ribstem: { label: 'Ribbed mushroom stem', h: 100, minH: 60, maxH: 180 },
    spiral: { label: 'Spiral cone base', h: 120, minH: 70, maxH: 200 },
    faceted: { label: 'Faceted origami base', h: 100, minH: 50, maxH: 180 },
    lattice: { label: 'Diamond lattice vase', h: 110, minH: 60, maxH: 200 },
    stand: { label: 'Light stand (legs)', h: 180, minH: 90, maxH: 420 },
    legs: { label: 'Table legs (hidden base)', h: 85, minH: 45, maxH: 300 }
  };
  // table legs: a low hub hidden inside the shade's bottom edge with angled sockets underneath for 3 or 4 legs, printed
  // or wooden dowels (with printed cap feet). The cord drops straight down from the middle.
  const LEGS = { plug: 8, flange: 3, boss: 18, socket: 15, splay: 18, capH: 20 };
  // the light stand: a ring that holds the shade up off the table on 3 or 4 legs that print separately
  const STAND = { ringH: 12, legW: 16, block: 12, tongue: 8, screwD: 3, screwLen: 25 };
  // light mounts. d: the pocket or ring size (mm). Socket bodies are the common sizes; 1/8 IPS threaded lamp pipe is 10.3 mm.
  const MOUNTS = {
    puck: { label: 'LED puck light (battery or USB)', d: 70, depth: 12 },
    e26: { label: 'E26 bulb socket', d: 0, socketD: 40, depth: 6 },
    e12: { label: 'E12 candelabra socket', d: 0, socketD: 21, depth: 6 },
    strip: { label: 'LED strip or ring channel', d: 0, depth: 4 },
    tealight: { label: 'LED tea light or candle', d: 38.5, depth: 10 },
    usb: { label: 'USB-C LED board', d: 32, depth: 6 }
  };
  const PIPE_HOLE = 10.6, NUT_AC = 15.2; // 1/8 IPS pipe clearance hole and its hex nut (12.7 mm across the flats)
  const PALETTE = [
    { name: 'White', hex: '#F4F1EA' }, { name: 'Warm white', hex: '#F2EBDD' }, { name: 'Black', hex: '#1A1A1A' },
    { name: 'Charcoal', hex: '#2B2F33' }, { name: 'Walnut', hex: '#6B4A2F' }, { name: 'Forest green', hex: '#2F6B4F' },
    { name: 'Light green', hex: '#8FD3B6' }, { name: 'Gold', hex: '#C9A227' }, { name: 'Blue', hex: '#3B82C4' },
    { name: 'Wood (wood-fill filament)', hex: '#A8743F' }, { name: 'Marble (marble filament)', hex: '#E9E6E0' },
    { name: 'Pastel pink', hex: '#F4B6C2' }, { name: 'Mint', hex: '#A8E6CF' }, { name: 'Baby blue', hex: '#A7C7E7' }, { name: 'Lavender', hex: '#C8B6E2' },
    { name: 'Butter yellow', hex: '#F8E7A1' }, { name: 'Peach', hex: '#F9C6A8' }, { name: 'Sage', hex: '#B5C9A8' }, { name: 'Cream', hex: '#F6EFDC' }
  ];
  const WOOD = '#A8743F', MARBLE = '#E9E6E0'; // the preview shows grain or veins for these two
  // color inserts: thin translucent sleeves that drop in through the top and sit on a ledge in the top rim, so the whole
  // shade glows in the insert's color. Swap them to change the lamp's color.
  const INSERT_PALETTE = [
    { name: 'Green', hex: '#3DBE6B' }, { name: 'Blue', hex: '#3B82C4' }, { name: 'Orange', hex: '#F08A24' }, { name: 'Red', hex: '#D6323C' },
    { name: 'Purple', hex: '#8E5BD6' }, { name: 'Pink', hex: '#F27BB0' }, { name: 'Yellow', hex: '#F5D33B' }, { name: 'Teal', hex: '#22B3B0' }, { name: 'Warm white', hex: '#F2EBDD' }
  ];
  const INSERT_DEFAULT_COLORS = ['#3DBE6B', '#3B82C4', '#F08A24', '#D6323C', '#8E5BD6', '#F5D33B'];
  const LEDGE_H = 1.6; // the step in the top rim the insert's flange sits in (flush with the top edge)
  const DEFAULTS = Object.assign({}, PRESETS.cylinder, {
    preset: 'cylinder', starDepth: 22,
    tMin: 0.8, tMax: 3.0, brightness: 0, contrast: 0, gamma: 1, invert: false,
    wrap: 'wrap', copies: 2, mirror: true, panelDeg: 120, fit: 'cover', zoom: 100, offX: 0, offY: 0, turn: 0,
    relief: 'inside', plainT: 1.6, pattern: 'photo', patternSize: 26, rimTop: 8, rimBottom: 8, rimT: 3.0,
    fitter: 'none', fitterD: 0, spokes: 3, base: false, puckD: 70, baseH: 16, notch: true,
    images: null, border: 0, borderStyle: 'dark', overlay: null, overlayStyle: 'dark', seam: 'back',
    lamp: 'none', lampH: 0, mount: 'puck', lightD: 0, socketD: 0, socketRise: 30, cable: 'notch', switchHole: 'none', feet: true, feetD: 12.5,
    around: 1, sections: 1, detail: 'hd', preview: false,
    inserts: 0, insertColors: INSERT_DEFAULT_COLORS.slice(0, 3), insertWall: 0.8, insertClear: 0.4,
    colors: { shade: '#F4F1EA', base: '#2B2F33' }, bed: [256, 256, 256], bambu: 'A1'
  });
  const CELL = { hd: 0.5, standard: 0.8, preview: 0.9 };
  const CAP = { hd: 260000, standard: 160000, preview: 90000 }; // grid nodes per skin

  const num = (v, d, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  function options(raw) {
    const r = Object.assign({}, DEFAULTS, raw || {}), o = {};
    o.preset = PRESETS[r.preset] ? r.preset : 'custom';
    o.section = SECTIONS[r.section] ? r.section : 'poly';
    o.sides = Math.round(num(r.sides, 0, 0, 24)); if (o.section === 'poly' && o.sides > 0 && o.sides < 3) o.sides = 3;
    if (o.section !== 'poly' && o.section !== 'heart') o.sides = Math.max(3, o.sides || 5);
    o.height = num(r.height, 180, 60, 320);
    o.topD = num(r.topD, 150, 50, 320); o.bottomD = num(r.bottomD, 150, 50, 320);
    o.bulge = num(r.bulge, 0, -120, 160); o.fullness = num(r.fullness, 2, 1, 5); o.bulgeAt = num(r.bulgeAt, 0.5, 0.15, 0.85);
    o.tiers = Math.round(num(r.tiers, 0, 0, 6)); o.tierDepth = num(r.tierDepth, 0, 0, 30); o.flareTop = num(r.flareTop, 0, 0, 60); o.flareBottom = num(r.flareBottom, 0, 0, 60);
    o.rounding = num(r.rounding, 0, 0, 100); o.starDepth = num(r.starDepth, 22, 5, 50);
    o.waves = Math.round(num(r.waves, 0, 0, 40)); o.waveDepth = num(r.waveDepth, 0, 0, 20); o.twist = num(r.twist, 0, -360, 360);
    o.waveShape = WAVE_SHAPES[r.waveShape] ? r.waveShape : 'round'; o.sway = num(r.sway, 0, -90, 90);
    o.ripples = Math.round(num(r.ripples, 0, 0, 12)); o.rippleDepth = num(r.rippleDepth, 0, 0, 15);
    o.fineWaves = Math.round(num(r.fineWaves, 0, 0, 120)); o.fineDepth = num(r.fineDepth, 0, 0, 3); o.zigzag = Math.round(num(r.zigzag, 0, 0, 8));
    o.texture = TEXTURES[r.texture] ? r.texture : 'none'; o.textureDepth = num(r.textureDepth, 0, 0, 2.5); o.textureSize = num(r.textureSize, 8, 4, 40);
    o.pattern = PATTERNS[r.pattern] ? r.pattern : 'photo'; o.patternSize = num(r.patternSize, 26, 10, 60);
    o.tMin = num(r.tMin, 0.8, 0.4, 3); o.tMax = num(r.tMax, 3, 1, 6); if (o.tMax < o.tMin + 0.4) o.tMax = o.tMin + 0.4;
    o.brightness = num(r.brightness, 0, -100, 100); o.contrast = num(r.contrast, 0, -80, 150); o.gamma = num(r.gamma, 1, 0.3, 3); o.invert = !!r.invert;
    o.wrap = ['wrap', 'repeat', 'panel'].includes(r.wrap) ? r.wrap : 'wrap';
    o.copies = Math.round(num(r.copies, 2, 2, 8)); o.mirror = r.mirror !== false; o.panelDeg = num(r.panelDeg, 120, 30, 330);
    o.fit = ['cover', 'contain', 'stretch'].includes(r.fit) ? r.fit : 'cover';
    o.zoom = num(r.zoom, 100, 100, 400); o.offX = num(r.offX, 0, -100, 100); o.offY = num(r.offY, 0, -100, 100); o.turn = num(r.turn, 0, -180, 180);
    o.relief = r.relief === 'outside' ? 'outside' : 'inside';
    o.plainT = num(r.plainT, 1.6, o.tMin, o.tMax);
    o.rimTop = num(r.rimTop, 8, 0, 40); o.rimBottom = num(r.rimBottom, 8, 0, 40); o.rimT = num(r.rimT, 3, 1, 6);
    o.fitter = FITTERS[r.fitter] ? r.fitter : 'none'; o.fitterD = num(r.fitterD, 0, 0, 80) || FITTERS[o.fitter].holeD; o.spokes = Math.round(num(r.spokes, 3, 2, 6));
    o.base = !!r.base; o.puckD = num(r.puckD, 70, 20, 200); o.baseH = num(r.baseH, 16, 8, 40); o.notch = r.notch !== false;
    o.around = [1, 2, 3, 4, 6, 8].includes(+r.around) ? +r.around : 1; o.sections = [1, 2, 3].includes(+r.sections) ? +r.sections : 1;
    o.detail = CELL[r.detail] ? r.detail : 'hd'; o.preview = !!r.preview;
    o.colors = Object.assign({}, DEFAULTS.colors, r.colors || {});
    const bed = Array.isArray(r.bed) ? r.bed : DEFAULTS.bed; o.bed = [0, 1, 2].map(a => num(bed[a], 256, 60, 2000));
    o.bambu = r.bambu || 'A1';
    const okImg = im => !!(im && im.gray && im.w && im.h);
    o.image = okImg(r.image) ? r.image : null;
    o.images = Array.isArray(r.images) ? r.images.filter(okImg).slice(0, 6) : [];
    if (r.wrap === 'gallery') o.wrap = 'gallery';
    if (o.wrap === 'gallery') { o.copies = Math.round(num(r.copies, Math.max(2, o.images.length), 2, 6)); o.mirror = false; }
    o.border = num(r.border, 0, 0, 20); o.borderStyle = r.borderStyle === 'light' ? 'light' : 'dark';
    o.overlay = r.overlay && r.overlay.ink && r.overlay.w && r.overlay.h ? r.overlay : null; o.overlayStyle = r.overlayStyle === 'light' ? 'light' : 'dark';
    o.seam = r.seam === 'corner' ? 'corner' : 'back';
    // the lamp base (a printed body the shade sits on) and how the light mounts in it
    const legacy = !!r.base && (!r.lamp || r.lamp === 'none');
    o.lamp = LAMPS[r.lamp] ? r.lamp : 'none'; if (legacy) o.lamp = 'disc'; // the older 'base' option is the minimal disc
    o.pendant = !!FITTERS[o.fitter].cap; if (o.pendant) { o.lamp = 'none'; o.base = false; } // a pendant hangs: no lamp base
    if (o.lamp !== 'none') o.base = false;
    o.mount = MOUNTS[r.mount] ? r.mount : 'puck';
    if (o.lamp === 'none') o.mount = 'puck';
    o.lampH = num(r.lampH, 0, 0, 420) || (legacy ? num(r.baseH, 16, 8, 40) : LAMPS[o.lamp].h);
    if (o.lamp !== 'none') o.lampH = Math.max(LAMPS[o.lamp].minH, Math.min(LAMPS[o.lamp].maxH, o.lampH));
    o.lightD = num(r.lightD, 0, 0, 200) || (legacy ? o.puckD : MOUNTS[o.mount].d);
    o.socketD = num(r.socketD, 0, 0, 60) || MOUNTS[o.mount].socketD || 0;
    o.socketRise = num(r.socketRise, 30, 0, 150);
    o.cable = ['notch', 'usbc', 'none'].includes(r.cable) ? r.cable : 'notch'; if (o.mount === 'usb') o.cable = 'usbc';
    if (legacy && r.notch === false) o.cable = 'none';
    o.switchHole = ['none', 'push', 'rocker'].includes(r.switchHole) ? r.switchHole : 'none';
    o.feet = r.feet !== false; o.feetD = num(r.feetD, 12.5, 6, 25);
    // the light stand: legs, joints (screws through the outer rim by default, or snap clips), no riser, no switch hole
    o.standLegs = +r.standLegs === 4 ? 4 : 3; o.standJoint = r.standJoint === 'clip' ? 'clip' : 'screw';
    o.legMode = r.legMode === 'dowel' ? 'dowel' : 'printed'; o.legD = num(r.legD, o.legMode === 'dowel' ? 6.35 : 10, 4, 16); if (o.legMode === 'printed') o.legD = Math.max(8, o.legD);
    if (o.lamp === 'legs') { if (o.mount === 'strip') o.mount = 'puck'; o.socketRise = 0; o.switchHole = 'none'; o.cable = o.cable === 'none' ? 'none' : 'notch'; }
    if (o.lamp === 'stand') { if (o.mount === 'strip') o.mount = 'puck'; o.socketRise = 0; o.switchHole = 'none'; if (o.cable === 'usbc') o.cable = 'notch'; }
    // color inserts (0 = off): count, colors, wall and clearance per side. They need the open top, so no spider fitter.
    o.inserts = Math.round(num(r.inserts, 0, 0, 6)); if (o.fitter !== 'none' && !FITTERS[o.fitter].cap) o.inserts = 0;
    const hx = c => /^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toUpperCase() : null;
    const ic = Array.isArray(r.insertColors) ? r.insertColors.map(hx) : [];
    o.insertColors = Array.from({ length: o.inserts }, (_, k) => ic[k] || INSERT_DEFAULT_COLORS[k % INSERT_DEFAULT_COLORS.length]);
    o.insertWall = num(r.insertWall, 0.8, 0.6, 2); o.insertClear = num(r.insertClear, 0.4, 0.15, 1.2);
    if (o.inserts) { // room for the ledge: a top rim at least 4 mm tall and a rim wall that keeps 1.2 mm under the step
      o.rimTop = Math.max(o.rimTop, LEDGE_H + 2.4); o.rimT = Math.max(o.rimT, 2.2);
      o.ledgeW = Math.min(1.2, o.rimT - 1.2);
    } else o.ledgeW = 0;
    // keep the rims inside the shade
    const rimMax = Math.max(0, o.height - 20); if (o.rimTop + o.rimBottom > rimMax) { const k = rimMax / (o.rimTop + o.rimBottom); o.rimTop *= k; o.rimBottom *= k; }
    return o;
  }
  // the shape's own values (what a preset sets) and whether it is the plain cylinder (free)
  const SHAPE_KEYS = Object.keys(SHAPE_DEFAULTS);
  function isPlainCylinder(o) { return o.section === 'poly' && !o.sides && (!o.waves || !o.waveDepth) && Math.abs(o.twist) < 0.5 && Math.abs(o.topD - o.bottomD) < 0.5 && Math.abs(o.bulge) < 0.5 && (!o.tiers || o.tierDepth < 0.5) && (o.flareTop || 0) < 0.5 && (o.flareBottom || 0) < 0.5 && (!o.ripples || (o.rippleDepth || 0) < 0.5) && (!o.fineWaves || (o.fineDepth || 0) < 0.05) && !o.zigzag && (!o.texture || o.texture === 'none' || (o.textureDepth || 0) < 0.05) && (!o.pattern || o.pattern === 'photo' || o.pattern === 'plain'); }
  function matchPreset(o) { for (const [k, p] of Object.entries(PRESETS)) if (SHAPE_KEYS.every(s => p[s] === undefined || (typeof p[s] === 'number' ? Math.abs(p[s] - o[s]) < 1e-6 : p[s] === o[s]))) return k; return 'custom'; }

  // ---------------------------------------------------------------- profile
  function profile(o) {
    const rb = o.bottomD / 2, rt = o.topD / 2, rm = o.bulge / 2, p = o.fullness, H = o.height, c = o.bulgeAt || 0.5;
    // tiers (pagoda eaves): each tier flares out at its bottom over a short rise (at most about 45\u00b0 to print) and tapers in
    const nT = o.tiers || 0, dT = nT ? (o.tierDepth || 0) / 2 : 0, wT = nT ? Math.min(0.45, 1.6 * dT * nT / H) : 0;
    const tierAt = t => { if (!dT) return 0; const u = Math.min(nT - 1e-9, t * nT) % 1; if (u < wT) { const x = u / wT; return dT * x * x * (3 - 2 * x); } const x = (u - wT) / (1 - wT); return dT * (1 - x) * (1 - x); };
    const fT = (o.flareTop || 0) / 2, fB = (o.flareBottom || 0) / 2;
    // ripples: soft horizontal bands that bulge out between creases (stacked marshmallows), only between the rims
    const nR = o.ripples || 0, aR = nR ? (o.rippleDepth || 0) / 2 : 0, rb0 = Math.min(0.4, (o.rimBottom || 0) / H), rt0 = Math.max(0.6, 1 - (o.rimTop || 0) / H);
    const rippleAt = t => { if (!aR || t <= rb0 || t >= rt0) return 0; const u = (t - rb0) / (rt0 - rb0); return aR * (0.5 - 0.5 * Math.cos(TAU * nR * u)); };
    const r = t => {
      const s = t < c ? t / c : (1 - t) / (1 - c); // 0 at the ends, 1 at the widest point
      let v = rb + (rt - rb) * t + rm * (1 - Math.pow(Math.max(0, 1 - s), p));
      if (fT) { const x = Math.max(0, (t - 0.7) / 0.3); v += fT * x * x; }
      if (fB) { const x = Math.max(0, (0.3 - t) / 0.3); v += fB * x * x; }
      return Math.max(18, v + tierAt(t) + rippleAt(t));
    };
    const dr = t => { const e = 1e-4, a = Math.max(0, t - e), b = Math.min(1, t + e); return (r(b) - r(a)) / ((b - a) * H); }; // dr/dz
    // arc length along the mean wall (for photo rows evenly spaced on the surface)
    const N = 600, L = new Float64Array(N + 1); for (let k = 1; k <= N; k++) { const t0 = (k - 1) / N, t1 = k / N; L[k] = L[k - 1] + Math.hypot(H / N, r(t1) - r(t0)); }
    const tOfL = l => { if (l <= 0) return 0; if (l >= L[N]) return 1; let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < l) lo = m; else hi = m; } return (lo + (l - L[lo]) / (L[hi] - L[lo] || 1)) / N; };
    const lOfT = t => { const x = Math.max(0, Math.min(1, t)) * N, k = Math.min(N - 1, Math.floor(x)); return L[k] + (L[k + 1] - L[k]) * (x - k); };
    let rMin = Infinity, rMax = 0, maxOut = 0, maxIn = 0;
    const NP = Math.max(200, 40 * nR); for (let k = 0; k <= NP; k++) { const t = k / NP, v = r(t), s = dr(t); rMin = Math.min(rMin, v); rMax = Math.max(rMax, v); if (s > 0) maxOut = Math.max(maxOut, s); else maxIn = Math.max(maxIn, -s); }
    return { r, dr, H, len: L[N], tOfL, lOfT, rMin, rMax, maxSlope: Math.max(maxOut, maxIn), maxOut, maxIn };
  }

  // ---------------------------------------------------------------- cross-section (radial table, max radius 1)
  const NS = 2048;
  function heartPolar() { // classic heart curve (notch at the back, point toward the viewer), radius by angle around a middle point
    const P = []; for (let k = 0; k < 4000; k++) { const t = k / 4000 * TAU; P.push([16 * Math.pow(Math.sin(t), 3), 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]); }
    const cy = -2;
    return polarOf(P.map(([x, y]) => [x, y - cy]));
  }
  function roundedPolygonPolar(n, k) { // regular n-gon, circumradius 1, corner radius k * inradius
    const ap = Math.cos(Math.PI / n), rc = Math.max(0, Math.min(0.999, k)) * ap, pts = [];
    // corners at angles -pi/2 + pi/n + j*2pi/n (a flat side faces the viewer)
    for (let j = 0; j < n; j++) {
      const a = -Math.PI / 2 + Math.PI / n + j * TAU / n, cr = (ap - rc) / ap; // corner arc center on the shrunk polygon
      const cx = Math.cos(a) * cr, cy = Math.sin(a) * cr;
      for (let s = 0; s <= 24; s++) { const b = a - Math.PI / n + s / 24 * TAU / n; pts.push([cx + rc * Math.cos(b), cy + rc * Math.sin(b)]); }
    }
    return polarOf(pts);
  }
  function polarOf(pts) { // convex or star-shaped polyline around the origin -> radius table
    const out = new Float64Array(NS), n = pts.length;
    for (let k = 0; k < NS; k++) {
      const a = k / NS * TAU, dx = Math.cos(a), dy = Math.sin(a); let best = 0;
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
        const t = (p[0] * ey - p[1] * ex) / den, u = (p[0] * dy - p[1] * dx) / den; if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.max(best, t);
      }
      out[k] = best;
    }
    return out;
  }
  // one rib, -1..1 over a period (phase 0 = the ridge): rounded (cosine), flutes (sharp ridges between scooped
  // channels) or pleats (straight folds)
  function waveAt(shape, ph) {
    const e = 0.16, soft = x => (Math.sqrt(x * x + e * e) - e) / (Math.sqrt(1 + e * e) - e); // |x| with a rounded tip
    if (shape === 'flute') return 1 - 2 * soft(Math.sin(ph / 2));
    if (shape === 'scallop') return 2 * soft(Math.cos(ph / 2)) - 1; // fins: broad rounded ridges, crisp grooves (the flute turned over)
    if (shape === 'pleat') { const u = ((ph / TAU) % 1 + 1) % 1, x = 1 - 4 * Math.min(u, 1 - u); return Math.sign(x) * (1 - soft(1 - Math.abs(x))); } // a triangle wave with rounded folds
    return Math.cos(ph);
  }
  // the turn of the cross-section at height t (0..1): the twist, plus a sway that leans the ribs one way then back
  function rotAt(o, t) { return (o.twist * t + (o.sway || 0) * Math.sin(TAU * t)) * Math.PI / 180 + zigAt(o, t); }
  // origami folds: the cross-section turns half a side one way, then back, in bands (a triangle wave with softened folds)
  function zigAt(o, t) {
    const n = o.zigzag || 0; if (!n) return 0;
    const per = o.sides >= 3 ? o.sides : Math.max(6, o.waves || 8), amp = Math.PI / per, u = t * n, x = u - Math.floor(u); // 0..1 in a band
    const tri = 1 - Math.abs(2 * x - 1), e = 0.06, s = v => Math.sqrt(v * v + e * e) - e; // 0 at the band ends, 1 in the middle
    return amp * (s(tri) / (s(1)));
  }
  function smoothCircular(a, passes) { const n = a.length; let b = Float64Array.from(a); for (let p = 0; p < passes; p++) { const c = new Float64Array(n); for (let k = 0; k < n; k++) c[k] = 0.25 * b[(k + n - 1) % n] + 0.5 * b[k] + 0.25 * b[(k + 1) % n]; b = c; } return b; }
  function section(o, scaleMin, minR) {
    let rho;
    if (o.section === 'heart') { rho = heartPolar(); rho = smoothCircular(rho, 6 + Math.round(o.rounding * 4)); }
    else if (o.section === 'star') {
      const n = o.sides, d = o.starDepth / 100, sharp = 1 + (100 - o.rounding) / 100 * 2.2; rho = new Float64Array(NS);
      for (let k = 0; k < NS; k++) { const a = k / NS * TAU + Math.PI / 2; rho[k] = (1 - d) + d * Math.pow(Math.abs(Math.cos(n * a / 2)), sharp); }
    } else if (o.section === 'flower') { // round petals with pinched valleys
      const n = o.sides, d = o.starDepth / 100, e = 0.3 + (100 - o.rounding) / 100 * 0.5; rho = new Float64Array(NS);
      for (let k = 0; k < NS; k++) { const a = k / NS * TAU + Math.PI / 2; rho[k] = (1 - d) + d * Math.pow(Math.abs(Math.cos(n * a / 2)), e); }
    } else if (o.section === 'gear') { // trapezoid teeth
      const n = o.sides, d = o.starDepth / 100; rho = new Float64Array(NS);
      for (let k = 0; k < NS; k++) {
        const ph = ((k / NS * n + 0.25) % 1 + 1) % 1; // a tooth faces the viewer
        let h; if (ph < 0.3) h = 1; else if (ph < 0.45) h = 1 - (ph - 0.3) / 0.15; else if (ph < 0.8) h = 0; else if (ph < 0.95) h = (ph - 0.8) / 0.15; else h = 1;
        rho[k] = (1 - d) + d * h;
      }
      rho = smoothCircular(rho, 2 + Math.round(o.rounding / 8));
    } else if (o.section === 'cloud') { // puffy bumps of a few sizes
      const n = o.sides, d = o.starDepth / 100; rho = new Float64Array(NS);
      for (let k = 0; k < NS; k++) { const a = k / NS * TAU + Math.PI / 2, amp = 0.82 + 0.18 * Math.sin(3 * a + 0.7) * Math.cos(a * 2 - 0.3); rho[k] = (1 - d) + d * amp * Math.pow(Math.abs(Math.cos(n * a / 2)), 0.45); }
    } else if (o.sides >= 3) rho = roundedPolygonPolar(o.sides, o.rounding / 100);
    else { rho = new Float64Array(NS).fill(1); }
    if (o.waves > 0 && o.waveDepth > 0) {
      const avgR = (o.topD + o.bottomD) / 4 || 75, A = o.waveDepth / 2 / avgR;
      for (let k = 0; k < NS; k++) rho[k] *= 1 + A * waveAt(o.waveShape, o.waves * (k / NS * TAU + Math.PI / 2));
      if (o.waveShape !== 'round') rho = smoothCircular(rho, 2); // keep the folds crisp but never a knife edge
    }
    if (o.fineWaves > 0 && o.fineDepth > 0) { // fine ripples on top of everything: rounded crests, crisp grooves
      const avgR = (o.topD + o.bottomD) / 4 || 75, A = o.fineDepth / 2 / avgR;
      for (let k = 0; k < NS; k++) rho[k] *= 1 + A * waveAt('scallop', o.fineWaves * (k / NS * TAU + Math.PI / 2));
    }
    const poly = o.section === 'poly' && o.sides >= 3, flats = poly ? Math.cos(Math.PI / o.sides) : 0; // polygons: the size is across the flats
    let mx = 0; for (let k = 0; k < NS; k++) mx = Math.max(mx, rho[k]); if (poly) mx = flats * Math.max(1, mx); for (let k = 0; k < NS; k++) rho[k] /= mx;
    // round off convex corners tighter than the thickest wall at the smallest scale (so the inner offset never folds)
    const Rn = minR / scaleMin; let fixes = 0;
    for (let it = 0; it < 600; it++) {
      const bad = new Uint8Array(NS); let any = false;
      for (let k = 0; k < NS; k++) {
        const a0 = (k - 1) / NS * TAU, a1 = k / NS * TAU, a2 = (k + 1) / NS * TAU, r0 = rho[(k + NS - 1) % NS], r1 = rho[k], r2 = rho[(k + 1) % NS];
        const ax = r0 * Math.cos(a0), ay = r0 * Math.sin(a0), bx = r1 * Math.cos(a1), by = r1 * Math.sin(a1), cx = r2 * Math.cos(a2), cy = r2 * Math.sin(a2);
        const cr = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (cr <= 0) continue; // concave or straight
        const la = Math.hypot(bx - ax, by - ay), lb = Math.hypot(cx - bx, cy - by), lc = Math.hypot(cx - ax, cy - ay), R = la * lb * lc / (2 * Math.abs(cr) || 1e-12);
        if (R < Rn) { bad[k] = 1; any = true; }
      }
      if (!any) break; fixes++;
      const nb = Float64Array.from(rho);
      for (let k = 0; k < NS; k++) if (bad[k] || bad[(k + 1) % NS] || bad[(k + NS - 1) % NS]) nb[k] = 0.25 * rho[(k + NS - 1) % NS] + 0.5 * rho[k] + 0.25 * rho[(k + 1) % NS];
      rho = nb;
    }
    if (!poly) { // the size is the outline's widest extent
      let x0 = 0, x1 = 0, y0 = 0, y1 = 0; for (let k = 0; k < NS; k++) { const a = k / NS * TAU, x = rho[k] * Math.cos(a), y = rho[k] * Math.sin(a); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      mx = Math.max(x1 - x0, y1 - y0) / 2; for (let k = 0; k < NS; k++) rho[k] /= mx;
    }
    let rhoMax = 0; for (let k = 0; k < NS; k++) rhoMax = Math.max(rhoMax, rho[k]);
    // outline points, normals and arc length (unit scale)
    const X = new Float64Array(NS), Y = new Float64Array(NS); for (let k = 0; k < NS; k++) { const a = k / NS * TAU; X[k] = rho[k] * Math.cos(a); Y[k] = rho[k] * Math.sin(a); }
    const S = new Float64Array(NS + 1); for (let k = 0; k < NS; k++) { const j = (k + 1) % NS; S[k + 1] = S[k] + Math.hypot(X[j] - X[k], Y[j] - Y[k]); }
    const per = S[NS];
    // the photo starts at the back (+y, angle pi/2) and runs counterclockwise, so it reads left to right from outside
    const k0 = NS / 4, s0 = S[k0];
    const at = s => { // s in [0, 1) from the back -> position and outward normal on the unit outline
      let L = s0 + (((s % 1) + 1) % 1) * per; if (L >= per) L -= per;
      let lo = 0, hi = NS; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= L) lo = m; else hi = m; }
      const f = (L - S[lo]) / (S[lo + 1] - S[lo] || 1), j = (lo + 1) % NS;
      const x = X[lo] + (X[j] - X[lo]) * f, y = Y[lo] + (Y[j] - Y[lo]) * f;
      const p = (lo + NS - 1) % NS, q = (j + 1) % NS; let tx = (X[q] - X[p]), ty = (Y[q] - Y[p]); const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      return [x, y, ty, -tx];
    };
    const sOfAngle = ang => { let k = Math.round(((ang / TAU) % 1 + 1) % 1 * NS) % NS; let L = S[k] - s0; if (L < 0) L += per; let f = L / per; if (f > 0.5) f -= 1; return f; };
    return { rho, per, at, fixes, rhoMax, sOfAngle };
  }

  // ---------------------------------------------------------------- photo
  function sampleImage(img, x, y) { // bilinear, x, y in 0..1 (clamped)
    const w = img.w, h = img.h, fx = Math.max(0, Math.min(w - 1, x * w - 0.5)), fy = Math.max(0, Math.min(h - 1, y * h - 0.5));
    const i0 = Math.floor(fx), j0 = Math.floor(fy), i1 = Math.min(w - 1, i0 + 1), j1 = Math.min(h - 1, j0 + 1), a = fx - i0, b = fy - j0, g = img.gray;
    return (g[j0 * w + i0] * (1 - a) + g[j0 * w + i1] * a) * (1 - b) + (g[j1 * w + i0] * (1 - a) + g[j1 * w + i1] * a) * b;
  }
  function sampleScene(w, h) { // a built-in scene for tests and when no photo is loaded: sky, hills, trees, a cabin
    const g = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = i / w, y = j / h; let v = 0.92 - 0.25 * y;
      const hill = 0.55 + 0.08 * Math.sin(x * 9) + 0.05 * Math.sin(x * 23 + 1); if (y > hill) v = 0.35 + 0.15 * Math.sin(x * 40) * 0.2;
      if (y > 0.8) v = 0.75 - 0.3 * (y - 0.8);
      const tx = (x * 14) % 1, tree = Math.abs(tx - 0.5) < (y - 0.35) * 0.35 && y > 0.35 && y < 0.82; if (tree && Math.floor(x * 14) % 3 !== 1) v = 0.12;
      if (x > 0.45 && x < 0.58 && y > 0.6 && y < 0.78) v = 0.22; if (x > 0.5 && x < 0.53 && y > 0.66 && y < 0.71) v = 0.95;
      g[j * w + i] = v;
    }
    return { gray: g, w, h };
  }
  // the photo (and its frame and text) over one region of the wall -> thickness. sides: frame the left and right edges too.
  function photoMapper(o, regionW, regionH, image, sides) {
    const img = image || o.image || sampleScene(480, 160), Ai = img.w / img.h, Ar = regionW / regionH, z = o.zoom / 100;
    let fw = 1, fh = 1, contain = false;
    if (o.fit === 'cover') { if (Ai > Ar) fw = Ar / Ai; else fh = Ai / Ar; }
    else if (o.fit === 'contain') { contain = true; if (Ai > Ar) fh = Ai / Ar; else fw = Ar / Ai; } // the region spans more than the photo
    fw /= z; fh /= z;
    const cx = 0.5 + (o.offX / 100) * Math.abs(1 - fw) / 2, cy = 0.5 - (o.offY / 100) * Math.abs(1 - fh) / 2;
    const b = o.brightness / 100, c = 1 + o.contrast / 100, gm = 1 / o.gamma, span = o.tMax - o.tMin;
    const bw = o.border || 0, bL = o.borderStyle === 'light' ? 1 : 0, sidesOn = sides !== false;
    const ov = o.overlay, oL = o.overlayStyle === 'light' ? 1 : 0;
    const plainL = Math.max(0, Math.min(1, (o.tMax - o.plainT) / (span || 1)));
    return (a, v) => { // a: 0..1 across the region (left to right), v: 0..1 up the region -> thickness, or -1 (plain)
      const x = cx + (a - 0.5) * fw, y = cy + (0.5 - v) * fh;
      let L, plain = false;
      if ((x < 0 || x > 1 || y < 0 || y > 1) && (contain || o.fit === 'cover')) { plain = true; L = plainL; }
      else {
        L = sampleImage(img, Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y)));
        L = Math.max(0, Math.min(1, (L - 0.5) * c + 0.5 + b)); L = Math.pow(L, gm); if (o.invert) L = 1 - L;
      }
      let touched = false;
      if (ov) { // text: ink in the chosen tone, a halo in the other tone so it reads on any photo
        const ink = sampleImage({ gray: ov.ink, w: ov.w, h: ov.h }, a, 1 - v), halo = ov.halo ? sampleImage({ gray: ov.halo, w: ov.w, h: ov.h }, a, 1 - v) : 0;
        if (halo > 0.01) { L = L * (1 - halo) + (1 - oL) * halo; touched = true; }
        if (ink > 0.01) { L = L * (1 - ink) + oL * ink; touched = true; }
      }
      if (bw > 0) { const dx = Math.min(a, 1 - a) * regionW, dy = Math.min(v, 1 - v) * regionH; if (dy < bw || (sidesOn && dx < bw)) { L = bL; touched = true; } }
      if (plain && !touched) return -1;
      return o.tMax - L * span;
    };
  }

  // seam at a corner: the photo's start (the back, +y) moves to the nearest corner of a polygon, star or gear
  function seamShift(o, Sec) {
    if (o.seam !== 'corner' || (o.section === 'poly' && o.sides < 3) || o.section === 'heart') return 0;
    // the corner nearest the back is the outline's farthest point from the axis near +y (within half a side)
    const n = Math.max(3, o.sides), half = Math.PI / n; let best = -1, bestA = Math.PI / 2;
    for (let k = 0; k < 400; k++) { const ang = Math.PI / 2 - half + (2 * half) * k / 399, i = Math.round(ang / TAU * NS) % NS, rr = Sec.rho[(i + NS) % NS]; if (rr > best + 1e-9) { best = rr; bestA = ang; } }
    return Sec.sOfAngle(bestA);
  }
  // the photo region's size (mm) without building the wall: for drawing text at the right aspect
  function region(raw) {
    const o = options(raw), P = profile(o), tRef = Math.max(o.tMax, o.rimT), slopeK = Math.min(2, Math.sqrt(1 + P.maxSlope * P.maxSlope));
    const Sec = section(o, P.rMin, tRef * slopeK + 0.6), H = o.height, lb = P.lOfT(o.rimBottom / H), lt = P.lOfT((H - o.rimTop) / H);
    let sum = 0; const n = 60; for (let k = 0; k <= n; k++) sum += P.r(P.tOfL(lb + (lt - lb) * k / n));
    const meanPer = Sec.per * sum / (n + 1), photoH = Math.max(1, lt - lb);
    const regionW = o.wrap === 'repeat' || o.wrap === 'gallery' ? meanPer / o.copies : o.wrap === 'panel' ? meanPer * o.panelDeg / 360 : meanPer;
    return { regionW, photoH };
  }
  // ---------------------------------------------------------------- the wall field
  function field(o, cellOverride) {
    const P = profile(o), H = o.height;
    const tRef = Math.max(o.tMax, o.rimT);
    const slopeK = Math.min(2, Math.sqrt(1 + P.maxSlope * P.maxSlope));
    const Sec = section(o, P.rMin, tRef * slopeK + 0.6);
    // grid size
    let cell = cellOverride || CELL[o.preview ? 'preview' : o.detail];
    const perMax = Sec.per * P.rMax;
    const zb = o.rimBottom, zt = H - o.rimTop, lb = P.lOfT(zb / H), lt = P.lOfT(zt / H), Ltot = P.len;
    // fine detail (fine ripples, textures, patterns) gets a denser preview so the ribs stay smooth on screen too
    const fineDetail = (o.fineWaves && o.fineDepth) || (o.texture !== 'none' && o.textureDepth) || o.pattern === 'voronoi' || o.pattern === 'slats';
    const cap = CAP[o.preview ? 'preview' : o.detail] * (o.preview && fineDetail ? 1.7 : 1);
    let NU, rows;
    const plan = c => {
      NU = Math.max(48, Math.ceil(perMax / c / o.around) * o.around);
      const seg = (l0, l1) => Math.max(1, Math.ceil((l1 - l0) / c));
      const nb = zb > 0.01 ? seg(0, lb) : 0, nt = zt < H - 0.01 ? seg(lt, Ltot) : 0, np = Math.max(o.sections * 2, seg(lb, lt));
      rows = [];
      if (nb) for (let j = 0; j < nb; j++) rows.push({ l: lb * j / nb, rim: true });
      for (let j = 0; j <= np; j++) rows.push({ l: lb + (lt - lb) * j / np, rim: false, pv: j / np, edge: j === 0 || j === np });
      if (nt && o.ledgeW > 0) { // the insert ledge: a step in the top rim, LEDGE_H below the top edge
        const lL = P.lOfT((H - LEDGE_H) / H), lL2 = P.lOfT((H - LEDGE_H + 0.02) / H), n1 = Math.max(1, Math.ceil((lL - lt) / c)), n2 = Math.max(1, Math.ceil((Ltot - lL2) / c));
        for (let j = 1; j <= n1; j++) rows.push({ l: lt + (lL - lt) * j / n1, rim: true });
        for (let j = 0; j <= n2; j++) rows.push({ l: lL2 + (Ltot - lL2) * j / n2, rim: true, ledge: true });
      } else if (nt) for (let j = 1; j <= nt; j++) rows.push({ l: lt + (Ltot - lt) * j / nt, rim: true });
    };
    plan(cell); if (NU * rows.length > cap) { cell *= Math.sqrt(NU * rows.length / cap); plan(cell); }
    const NV = rows.length;
    // the photo area (unrolled): for the aspect, the mean width of the photo rows
    let wsum = 0, wn = 0; for (const rw of rows) if (!rw.rim) { wsum += P.r(P.tOfL(rw.l)); wn++; }
    const meanPer = Sec.per * (wsum / Math.max(1, wn)), photoH = Math.max(1, lt - lb);
    const regionW = o.wrap === 'repeat' || o.wrap === 'gallery' ? meanPer / o.copies : o.wrap === 'panel' ? meanPer * o.panelDeg / 360 : meanPer;
    const pm = photoMapper(o, regionW, photoH, null, o.wrap !== 'wrap');
    const pat = o.pattern !== 'photo' ? patternMapper(o, meanPer, photoH) : null;
    const gal = o.wrap === 'gallery' ? Array.from({ length: o.copies }, (_, k) => photoMapper(o, regionW, photoH, o.images.length ? o.images[k % o.images.length] : null, true)) : null;
    // columns
    const col = []; for (let i = 0; i < NU; i++) { const s = i / NU; const q = Sec.at(s); col.push({ s, x: q[0], y: q[1], nx: q[2], ny: q[3] }); }
    const row = rows.map(rw => { const t = P.tOfL(rw.l), z = t * H; return Object.assign({ t, z: rw.rim ? z : z, r: P.r(t), dr: P.dr(t), rot: rotAt(o, t) }, rw); });
    // snap the rim rows to exact heights
    row[0].z = 0; row[0].t = 0; row[NV - 1].z = H; row[NV - 1].t = 1;
    const Tf = new Float32Array(NU * NV);
    const turn = o.turn / 360 + seamShift(o, Sec);
    for (let j = 0; j < NV; j++) {
      const rw = row[j];
      for (let i = 0; i < NU; i++) {
        let th;
        if (rw.rim) th = o.rimT;
        else {
          let s = col[i].s - turn; s = ((s % 1) + 1) % 1; // 0 at the back, 0.5 at the front
          let a, inside = true;
          if (pat) { th = pat(s, rw.pv); if (rw.edge && ((rw.pv === 0 && o.rimBottom > 0.01) || (rw.pv === 1 && o.rimTop > 0.01))) th = o.rimT; Tf[j * NU + i] = th; continue; }
          if (o.wrap === 'wrap') a = s;
          else if (o.wrap === 'repeat') { const q = s * o.copies, k = Math.floor(q); a = q - k; if (o.mirror && (k % 2)) a = 1 - a; }
          else if (o.wrap === 'gallery') { const q = s * o.copies, k = Math.min(o.copies - 1, Math.floor(q)); a = q - k; th = gal[k](a, rw.pv); }
          else { const w = o.panelDeg / 360; a = (s - (0.5 - w / 2)) / w; inside = a >= 0 && a <= 1; }
          const v = rw.pv;
          if (o.wrap !== 'gallery') th = inside ? pm(a, v) : -1; if (th < 0) th = o.plainT;
          if (rw.edge && (o.rimBottom > 0.01 || o.rimTop > 0.01)) { if ((v === 0 && o.rimBottom > 0.01) || (v === 1 && o.rimTop > 0.01)) th = o.rimT; }
        }
        Tf[j * NU + i] = th;
      }
    }
    return { o, P, Sec, NU, NV, col, row, Tf, cell, tRef, regionW, photoH };
  }
  // ---------------------------------------------------------------- wall patterns (instead of the photo)
  // Every pattern is a smooth thickness field on the unrolled wall (mm), periodic all the way around (no seam), with
  // soft edges about 1.6 mm wide so the ribs come out clean at any mesh size. Thin = glows, thick = dark.
  function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function smooth01(e0, e1, x) { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
  function patternMapper(o, W, Hp) {
    const lo = o.tMin, hi = o.tMax, size = o.patternSize;
    if (o.pattern === 'plain') return () => o.plainT;
    if (o.pattern === 'slats') { // vertical slats with thin glowing gaps between them
      const n = Math.max(8, Math.round(W / Math.max(6, size * 0.45))), gap = Math.min(0.42, 2.6 / (W / n)), soft = Math.min(0.12, 0.8 / (W / n));
      return s => { const u = s * n, x = u - Math.floor(u), d = Math.min(x, 1 - x); return lo + (hi - lo) * smooth01(gap / 2 - soft, gap / 2 + soft, d); };
    }
    // organic lattice: a seamless Voronoi tiling; ribs follow the cell edges and swell at the joints like bone
    const nx = Math.max(4, Math.round(W / size)), ny = Math.max(2, Math.round(Hp / (size * 0.9))), cw = W / nx, ch = Hp / ny;
    const seeds = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) seeds.push([(i + 0.15 + 0.7 * hash2(i, j)) * cw, (j + 0.15 + 0.7 * hash2(i + 101, j + 57)) * ch]);
    const w = Math.max(1.1, size * 0.075), b = 0.8;
    return (s, v) => {
      const x = s * W, y = v * Hp, ci = Math.floor(x / cw), cj = Math.floor(y / ch); let d1 = 1e9, d2 = 1e9;
      for (let dj = -1; dj <= 1; dj++) { const jj = cj + dj; if (jj < 0 || jj >= ny) continue; for (let di = -2; di <= 2; di++) {
        const ii = ci + di, im = ((ii % nx) + nx) % nx, sd = seeds[jj * nx + im], sx = sd[0] + (ii - im) * cw, d = Math.hypot(sx - x, sd[1] - y);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      } }
      const e = (d2 - d1) / 2; // distance to the nearest cell edge
      return lo + (hi - lo) * smooth01(w + b, w - b, e);
    };
  }
  // surface textures: a displacement (mm) of both faces along the outline normal, faded out over the rims
  function textureOf(F) {
    const { o, row } = F; if (o.texture === 'none' || !(o.textureDepth > 0)) return null;
    let wsum = 0, wn = 0; for (const rw of row) if (!rw.rim) { wsum += rw.r; wn++; }
    const per = F.Sec.per * (wsum / Math.max(1, wn)), size = o.textureSize, nA = Math.max(6, Math.round(per / size)), A = o.textureDepth;
    const zb = o.rimBottom, zt = o.height - o.rimTop, ramp = 3;
    const fade = rw => rw.rim ? 0 : smooth01(zb, zb + ramp, rw.z) * smooth01(zt, zt - ramp, rw.z);
    return (s, rw) => {
      const f = fade(rw); if (f <= 0) return 0;
      const u = s * nA, v = rw.z / (size * (o.texture === 'diamond' ? 1.25 : 0.86)), a = TAU * (u + v / 2), c = TAU * (u - v / 2);
      if (o.texture === 'knit') return f * A * 0.25 * (1 + Math.cos(a)) * (1 + Math.cos(c)); // round bumps on a staggered grid
      const rg = x => Math.pow(0.5 + 0.5 * Math.cos(x), 7); // a narrow rounded ridge
      const ra = rg(a), rc = rg(c); return f * A * (1 - (1 - ra) * (1 - rc));
    };
  }
  // vertex positions: outer (smooth unless the relief faces out) and inner skins
  function skins(F) {
    const { o, NU, NV, col, row, Tf, tRef } = F, N = NU * NV, O = new Float64Array(N * 3), I = new Float64Array(N * 3);
    const jStep = row.findIndex(rw => rw.ledge) - 1; // the last row under the insert ledge
    const tex = textureOf(F);
    for (let j = 0; j < NV; j++) {
      const rw = row[j], c = Math.cos(rw.rot), s = Math.sin(rw.rot);
      for (let i = 0; i < NU; i++) {
        const cl = col[i], R = rw.r, px = cl.x * R, py = cl.y * R, nx = cl.nx, ny = cl.ny;
        const rho = Math.hypot(cl.x, cl.y), k = Math.min(2, Math.sqrt(1 + (rho * rw.dr) ** 2));
        const t = Tf[j * NU + i] * k, tr = tRef * k;
        let ox, oy, ix, iy;
        if (o.relief === 'outside') { ix = px - nx * tr; iy = py - ny * tr; ox = ix + nx * t; oy = iy + ny * t; }
        else { ox = px; oy = py; ix = px - nx * t; iy = py - ny * t; }
        if (rw.ledge) { // the insert ledge: above the step the inner wall stands straight up, ledgeW out from the wall under it
          const rs = row[jStep], ks = Math.min(2, Math.sqrt(1 + (rho * rs.dr) ** 2)), dStep = o.relief === 'outside' ? tRef * ks : Tf[jStep * NU + i] * ks;
          const oD = o.relief === 'outside' ? tr - t : 0, along = cl.x * nx + cl.y * ny;
          const iD = Math.max(oD + 1.0 * k, along * (R - rs.r) + dStep - o.ledgeW * ks);
          ix = px - nx * iD; iy = py - ny * iD;
        }
        if (tex) { const d = tex(cl.s, rw); if (d) { ox += nx * d; oy += ny * d; ix += nx * d; iy += ny * d; } }
        const n = (j * NU + i) * 3;
        O[n] = ox * c - oy * s; O[n + 1] = ox * s + oy * c; O[n + 2] = rw.z;
        I[n] = ix * c - iy * s; I[n + 1] = ix * s + iy * c; I[n + 2] = rw.z;
      }
    }
    return { O, I };
  }
  // one piece: columns i0..i1 (i1 may wrap past NU for the whole ring), rows j0..j1. Returns a triangle soup and the
  // thickness at each soup vertex (for the lit preview).
  // smooth per-node normals of both skins (display only: the preview shades the wall smoothly instead of in facets)
  function gridNormals(F, S) {
    if (S.NO) return S;
    const { NU, NV } = F, NO = new Float32Array(NU * NV * 3), NI = new Float32Array(NU * NV * 3);
    for (const [A, N, sg] of [[S.O, NO, 1], [S.I, NI, -1]]) for (let j = 0; j < NV; j++) {
      const ja = Math.max(0, j - 1), jb = Math.min(NV - 1, j + 1);
      for (let i = 0; i < NU; i++) {
        const ia = (i + NU - 1) % NU, ib = (i + 1) % NU, pa = (j * NU + ia) * 3, pb = (j * NU + ib) * 3, qa = (ja * NU + i) * 3, qb = (jb * NU + i) * 3;
        const ux = A[pb] - A[pa], uy = A[pb + 1] - A[pa + 1], uz = A[pb + 2] - A[pa + 2], vx = A[qb] - A[qa], vy = A[qb + 1] - A[qa + 1], vz = A[qb + 2] - A[qa + 2];
        let nx = (uy * vz - uz * vy) * sg, ny = (uz * vx - ux * vz) * sg, nz = (ux * vy - uy * vx) * sg; const l = Math.hypot(nx, ny, nz) || 1;
        const n = (j * NU + i) * 3; N[n] = nx / l; N[n + 1] = ny / l; N[n + 2] = nz / l;
      }
    }
    S.NO = NO; S.NI = NI; return S;
  }
  function pieceMesh(F, S, i0, i1, j0, j1, ring) {
    const { NU, Tf } = F, { O, I } = S; gridNormals(F, S);
    const nc = ring ? NU : i1 - i0 + 1, ncq = ring ? NU : nc - 1, nr = j1 - j0 + 1, nrq = nr - 1;
    const tris = 4 * ncq * nrq + 4 * ncq + (ring ? 0 : 4 * nrq);
    const p = new Float32Array(tris * 9), th = new Float32Array(tris * 3), nm = new Float32Array(tris * 9); let q = 0, h = 0;
    const id = (i, j) => (j * NU + (((i % NU) + NU) % NU));
    const V = (A, i, j) => { const k = id(i, j), n = k * 3; return [A[n], A[n + 1], A[n + 2], Tf[k], A === O ? S.NO : S.NI, n]; };
    const tri = (a, b, c, flat) => {
      let fx = 0, fy = 0, fz = 0;
      if (flat) { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; fx = uy * vz - uz * vy; fy = uz * vx - ux * vz; fz = ux * vy - uy * vx; const l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l; }
      for (const v of [a, b, c]) { p[q] = v[0]; p[q + 1] = v[1]; p[q + 2] = v[2]; if (flat) { nm[q] = fx; nm[q + 1] = fy; nm[q + 2] = fz; } else { const N = v[4], n = v[5]; nm[q] = N[n]; nm[q + 1] = N[n + 1]; nm[q + 2] = N[n + 2]; } q += 3; th[h++] = v[3]; }
    };
    const quad = (a, b, c, d, flat) => { tri(a, b, c, flat); tri(a, c, d, flat); }; // a b c d counterclockwise seen from outside
    for (let jj = 0; jj < nrq; jj++) for (let ii = 0; ii < ncq; ii++) {
      const i = i0 + ii, j = j0 + jj;
      quad(V(O, i, j), V(O, i + 1, j), V(O, i + 1, j + 1), V(O, i, j + 1));
      quad(V(I, i, j), V(I, i, j + 1), V(I, i + 1, j + 1), V(I, i + 1, j));
    }
    for (let ii = 0; ii < ncq; ii++) { // bottom and top bands
      const i = i0 + ii;
      quad(V(O, i, j0), V(I, i, j0), V(I, i + 1, j0), V(O, i + 1, j0), true);
      quad(V(O, i, j1), V(O, i + 1, j1), V(I, i + 1, j1), V(I, i, j1), true);
    }
    if (!ring) for (let jj = 0; jj < nrq; jj++) { // the cut sides of a panel
      const j = j0 + jj, a = i0, b = i0 + ncq;
      quad(V(O, a, j), V(O, a, j + 1), V(I, a, j + 1), V(I, a, j), true);
      quad(V(O, b, j), V(I, b, j), V(I, b, j + 1), V(O, b, j + 1), true);
    }
    return { p: q === p.length ? p : p.slice(0, q), th: h === th.length ? th : th.slice(0, h), nrm: q === nm.length ? nm : nm.slice(0, q) };
  }

  // ---------------------------------------------------------------- separate parts (Manifold)
  function kit(M) {
    const all = [], k = x => { all.push(x); return x; };
    const ccw = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a < 0 ? pts.slice().reverse() : pts; };
    const cs = pts => k(new M.CrossSection([ccw(pts)], 'Positive'));
    const off = (c, d) => k(c.offset(d, 'Round', 2, 48));
    const ext = (c, z0, z1) => k(k(M.Manifold.extrude(c, z1 - z0)).translate([0, 0, z0]));
    const cyl = (r, z0, z1, x, y) => k(k(M.Manifold.cylinder(z1 - z0, r, r, Math.max(48, Math.min(160, Math.round(r * 4))))).translate([x || 0, y || 0, z0]));
    const box = (x0, y0, z0, x1, y1, z1) => k(k(M.Manifold.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const union = a => { a = a.filter(Boolean); return a.length === 1 ? a[0] : k(M.Manifold.union(a)); };
    const sub = (a, b) => { b = b.filter(Boolean); return b.length ? k(a.subtract(union(b))) : a; };
    const isect = (a, b) => k(a.intersect(b));
    const csub = (a, b) => k(a.subtract(b));
    const soup = m => { const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float32Array(F.length * 3); for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; } return p; };
    const free = () => { for (const x of all) { try { x.delete(); } catch (e) {} } all.length = 0; };
    return { cs, off, ext, cyl, box, union, sub, isect, csub, soup, free, k };
  }
  function ringOutline(F, S, j, which, fine) { // the outline of row j (outer or inner skin), decimated
    const A = which === 'inner' ? S.I : S.O, step = Math.max(1, Math.round(F.NU / (fine ? 1200 : 360))), pts = [];
    for (let i = 0; i < F.NU; i += step) { const n = (j * F.NU + i) * 3; pts.push([A[n], A[n + 1]]); }
    return pts;
  }
  function inradius(pts) { // the biggest circle around the axis inside the outline
    let m = Infinity;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], ex = q[0] - p[0], ey = q[1] - p[1], l2 = ex * ex + ey * ey || 1, u = Math.max(0, Math.min(1, -(p[0] * ex + p[1] * ey) / l2)); m = Math.min(m, Math.hypot(p[0] + u * ex, p[1] + u * ey)); }
    return m;
  }
  function buildSpider(F, S, M, z0, ins) { // assembled: the flange rests on the shade's top edge, the skirt drops inside
    const o = F.o, K = kit(M), j = F.NV - 1, H = o.height + z0;
    try {
      const outer = K.cs(ringOutline(F, S, j, 'outer')), wallIn = o.rimT * Math.min(2, Math.sqrt(1 + (F.row[j].dr) ** 2));
      if (FITTERS[o.fitter].cap) { // the pendant cord cap: a solid lid with a skirt (inside the color insert when there is one), vents and a grooved top
        const flT = 2.6, skH = 7, skW = 1.8, cl = 0.35;
        const skOut = ins ? K.off(K.cs(ins.hole), -cl) : K.off(outer, -(wallIn + cl)), skIn = K.off(skOut, -skW);
        const lid = K.ext(outer, H, H + flT), skirt = K.ext(K.csub(skOut, skIn), H - skH, H + 0.01);
        const ir = inradius(polysOf(skIn)[0] || [[40, 0], [0, 40], [-40, 0], [0, -40]]), hole = o.fitterD / 2, cuts = [K.cyl(hole, H - 20, H + 20)];
        if (ins) for (const [x, y] of ins.earAt || []) cuts.push(K.cyl(ins.earR + 0.6, H - skH - 1, H + 0.01, x, y)); // gaps in the skirt for the insert's ears
        const vr0 = hole + 6, vr1 = Math.min(ir - 3, hole + 22);
        if (vr1 - vr0 >= 5) for (let k = 0; k < 8; k++) { // 8 short radial vent slots, 3 mm wide
          const a = (k + 0.5) * TAU / 8, c = Math.cos(a), sn = Math.sin(a), hw = 1.5;
          cuts.push(K.ext(K.cs([[vr0 * c - hw * sn, vr0 * sn + hw * c], [vr1 * c - hw * sn, vr1 * sn + hw * c], [vr1 * c + hw * sn, vr1 * sn - hw * c], [vr0 * c + hw * sn, vr0 * sn - hw * c]]), H - 1, H + flT + 1));
        }
        const gR0 = Math.max(vr1, hole + 4) + 4, gR1 = F.P.rMax * F.Sec.rhoMax + 4;
        for (let k = 0; k < 36; k++) { // shallow radial grooves on top, so the cap reads ribbed (they print on the bed side)
          const a = k * TAU / 36, c = Math.cos(a), sn = Math.sin(a), hw = 0.6;
          cuts.push(K.ext(K.cs([[gR0 * c - hw * sn, gR0 * sn + hw * c], [gR1 * c - hw * sn, gR1 * sn + hw * c], [gR1 * c + hw * sn, gR1 * sn - hw * c], [gR0 * c + hw * sn, gR0 * sn - hw * c]]), H + flT - 0.6, H + flT + 1));
        }
        return K.soup(K.sub(K.union([lid, skirt]), cuts));
      }
      const flT = 2.2, skH = 7, skW = 1.8, cl = 0.35, hubR = o.fitterD / 2 + 5.5, spW = 7, spT = 3.2;
      const flange = K.ext(K.csub(outer, K.off(outer, -(wallIn + cl + skW + 2))), H, H + flT);
      const skirtCs = K.csub(K.off(outer, -(wallIn + cl)), K.off(outer, -(wallIn + cl + skW)));
      const skirt = K.ext(skirtCs, H - skH, H + 0.01);
      const reach = F.P.rMax * F.Sec.rhoMax * 1.5 + 10, solids = [flange, skirt];
      const spokes = [];
      for (let k = 0; k < o.spokes; k++) {
        const a = -Math.PI / 2 + k * TAU / o.spokes, c = Math.cos(a), s = Math.sin(a), hw = spW / 2;
        const quad = [[-hw * s, hw * c], [reach * c - hw * s, reach * s + hw * c], [reach * c + hw * s, reach * s - hw * c], [hw * s, -hw * c]];
        spokes.push(K.ext(K.cs(quad), H + flT - spT, H + flT));
      }
      const inside = K.ext(K.off(outer, -(wallIn + cl + 0.5)), H - 1, H + flT + 1);
      solids.push(K.isect(K.union(spokes), inside));
      solids.push(K.cyl(hubR, H + flT - spT, H + flT));
      const m = K.sub(K.union(solids), [K.cyl(o.fitterD / 2, H - 20, H + 20)]);
      return K.soup(m);
    } finally { K.free(); }
  }
  // ---------------------------------------------------------------- the lamp base (Manifold)
  // A printed body the shade drops into (a groove that follows the shade's own bottom outline), with the chosen light
  // mount, a cable path, an optional switch hole and felt-foot recesses. Assembled: z = 0 is the table, the seat is at
  // z = lampH. The tripod prints upside down (its plate on the bed); the others print as assembled.
  const GROOVE = 4, PENDANT_DROP = 70; // a pendant hangs this far over the table in the preview
  function extentOf(pts) { let r = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { r = Math.max(r, Math.hypot(x, y)); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { r, x0, x1, y0, y1 }; }
  function lampPlan(F, S) { // sizes shared by the body, the riser and the preview
    const o = F.o, H = o.lampH, out = ringOutline(F, S, 0, 'outer'), inn = ringOutline(F, S, 0, 'inner'), E = extentOf(out), ir = inradius(inn);
    const seatR = E.r + 6, Rf = Math.max(seatR * 0.92, 50), tripodR = E.r + (o.switchHole !== 'none' ? 20 : 7);
    const m = MOUNTS[o.mount], socket = o.mount === 'e26' || o.mount === 'e12';
    const stand = o.lamp === 'stand' || o.lamp === 'legs', riserOD = socket && !stand ? o.socketD + 6 : 0, rise = socket && !stand ? o.socketRise : 0;
    const legs = o.lamp === 'legs', plateT = stand ? STAND.ringH : legs ? LEGS.plug + LEGS.flange : 9, avail = o.lamp === 'tripod' || stand || legs ? plateT - 2.4 : H - 6;
    const cupDepth = socket ? (rise > 0 ? Math.min(10, rise - 4) : Math.min(6, avail - 1)) : 0;
    return { H, out, inn, E, ir, seatR, Rf, tripodR, m, socket, riserOD, rise, plateT, avail, cupDepth };
  }
  function lampProfile(o, L) { // pedestal and column: a revolved outline [r, z]
    const col = o.lamp === 'column', H = L.H, Rt = L.seatR, Rf = col ? Math.max(45, Rt * 0.55) : L.Rf, foot = col ? 10 : 6, chamf = 3;
    // the neck: as slim as the height allows (45 degree slopes in and out), at least 24 mm for the cable and a switch
    let Rn = Math.max(col ? 22 : 24, Rt * (col ? 0.26 : 0.32), (foot + Rf + Rt + 13 - H) / 2);
    Rn = Math.min(Rn, Rf - chamf, Rt);
    const z1 = foot + chamf + (Rf - chamf - Rn), z2 = H - 9 - (Rt - Rn), pts = [[0, 0], [Rf, 0], [Rf, foot], [Rf - chamf, foot + chamf], [Rn, z1]];
    if (o.lamp === 'column' && z2 - z1 > 30) { // turned beads, no steeper than about 45 degrees
      const A = Math.min(5, Rn * 0.22), n = Math.max(1, Math.round((z2 - z1) / 34)), lam = (z2 - z1) / n;
      for (let z = z1 + 2; z < z2 - 1; z += 2) pts.push([Rn + A * (0.5 - 0.5 * Math.cos(TAU * (z - z1) / lam)), z]);
    }
    pts.push([Rn, Math.max(z1, z2)], [Rt, H - 9], [Rt, H], [0, H]);
    const clean = []; for (const q of pts) { const l = clean[clean.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.05) clean.push(q); }
    return { pts: clean, Rn, Rf, zNeck: (z1 + Math.max(z1, z2)) / 2 };
  }
  function buildLamp(F, S, M, warnings) {
    const o = F.o, K = kit(M), L = lampPlan(F, S), H = L.H, style = o.lamp, tripod = style === 'tripod';
    try {
      // the groove holds the shade's bottom 4 mm: outside every outer outline and inside every inner outline down there
      let outer = K.cs(ringOutline(F, S, 0, 'outer', true)), inner = K.cs(ringOutline(F, S, 0, 'inner', true));
      for (let j = 1; j < F.NV && F.row[j - 1].z < GROOVE + 0.5; j++) { outer = K.k(outer.add(K.cs(ringOutline(F, S, j, 'outer', true)))); inner = K.k(inner.intersect(K.cs(ringOutline(F, S, j, 'inner', true)))); }
      let body, edgeY = 0, edgeX = 0, zSwitch = H / 2, feet = [], legs = [];
      if (style === 'disc') {
        const sh = K.off(outer, 6); body = K.ext(sh, 0, H); edgeY = L.E.y1 + 6; edgeX = L.E.x1 + 6;
        const fr = inradius(L.out) * 0.62; for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; feet.push([fr * Math.cos(a), fr * Math.sin(a)]); }
      } else if (style === 'block') {
        const hw = Math.max(Math.abs(L.E.x0), L.E.x1) + 7, hd = Math.max(Math.abs(L.E.y0), L.E.y1) + 7, rr = 8;
        body = K.ext(K.off(K.cs([[-hw + rr, -hd + rr], [hw - rr, -hd + rr], [hw - rr, hd - rr], [-hw + rr, hd - rr]]), rr), 0, H); edgeY = hd; edgeX = hw;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) feet.push([sx * (hw - 13), sy * (hd - 13)]);
      } else if (style === 'pedestal' || style === 'column') {
        const P = lampProfile(o, L);
        body = K.k(M.Manifold.revolve(K.k(new M.CrossSection([P.pts], 'Positive')), 128)); edgeY = P.Rf; edgeX = P.Rn; zSwitch = P.zNeck;
        for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; feet.push([P.Rf * 0.68 * Math.cos(a), P.Rf * 0.68 * Math.sin(a)]); }
      } else if (style === 'dome' || style === 'stepped' || style === 'mushroom') {
        const P = baseProfile(o, L);
        body = K.k(M.Manifold.revolve(K.k(new M.CrossSection([P.pts], 'Positive')), 160)); edgeY = Math.min(P.Rf, rAtPts(P.pts, 8.6), rAtPts(P.pts, 2.4)); zSwitch = P.zSwitch; edgeX = rAtPts(P.pts, zSwitch);
        for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; feet.push([P.Rf * 0.68 * Math.cos(a), P.Rf * 0.68 * Math.sin(a)]); }
      } else if (style === 'fluted') { // rounded flutes all around, a little wider at the foot
        const Rt = L.seatR + 1, n = Math.max(16, Math.round(TAU * Rt / 10)), sB = 1 + Math.min(0.22, 18 / Rt), pts = [];
        for (let k = 0; k < 360; k++) { const a = k / 360 * TAU, rr = (Rt + 1.6 * (1 + Math.cos(n * a))) * sB; pts.push([rr * Math.cos(a), rr * Math.sin(a)]); }
        body = K.k(M.Manifold.extrude(K.cs(pts), H, 0, 0, [1 / sB, 1 / sB])); edgeY = (Rt + 1.6 * (1 + Math.cos(n * Math.PI / 2))) * (1 + (sB - 1) * (1 - 8.6 / H)); zSwitch = H * 0.42; edgeX = (Rt + 3.2) * (1 + (sB - 1) * (1 - zSwitch / H));
        const fr = Rt * sB * 0.68; for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; feet.push([fr * Math.cos(a), fr * Math.sin(a)]); }
      } else if (style === 'ribstem' || style === 'spiral' || style === 'lattice') { // revolved bodies with ribs or a lattice
        const D = designerBase(o, L), fine = !o.preview;
        body = paramSolid(M, K, D.r, H, fine ? 720 : 360, Math.max(60, Math.ceil(H / (fine ? 0.5 : 1)))); edgeY = D.Rf; zSwitch = D.zSwitch; edgeX = D.r(0, zSwitch) - 0.6;
        for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; feet.push([D.Rf * 0.66 * Math.cos(a), D.Rf * 0.66 * Math.sin(a)]); }
      } else if (style === 'faceted') { // origami: stacked antiprism bands, every face a flat triangle
        const n = 8, ap = Math.cos(Math.PI / n), Rt = (L.seatR + 1.5) / ap, R0 = Math.max(Rt * 0.82, 44 / ap), z1 = H * 0.36, z2 = H * 0.7;
        const Rm = Math.min(Rt * 1.14, R0 + 0.8 * z1), R2 = Math.max(Rt * 0.98, Rm - 0.8 * (z2 - z1)), Rtop = Math.max(Rt, R2 - 0.8 * (H - z2) + 0.001);
        const ring = (R, rot) => { const pts = []; for (let k = 0; k < n; k++) { const a = rot + k * TAU / n; pts.push([R * Math.cos(a), R * Math.sin(a)]); } return pts; };
        const lv = [[0, R0, 0], [z1, Rm, Math.PI / n], [z2, R2, 0], [H, Rtop, Math.PI / n]], bands = [];
        for (let k = 0; k < 3; k++) { const [za, Ra, ra] = lv[k], [zb, Rb, rb] = lv[k + 1]; bands.push(K.k(M.Manifold.hull([K.ext(K.cs(ring(Ra, ra)), za, za + 0.01), K.ext(K.cs(ring(Rb, rb)), zb - 0.01, zb)]))); }
        body = K.union(bands); edgeY = R0 * ap; zSwitch = z1; edgeX = Rm * ap - 0.8;
        for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; feet.push([R0 * 0.62 * Math.cos(a), R0 * 0.62 * Math.sin(a)]); }
      } else { // tripod: a plate on three splayed legs
        const R = L.tripodR, top = H - L.plateT, rl = R * 0.6, splay = Math.min(0.3 * top, 36), parts = [K.cyl(R, top, H)];
        for (let k = 0; k < 3; k++) {
          const a = Math.PI / 2 + k * TAU / 3, c = Math.cos(a), s = Math.sin(a), rt = rl + splay;
          parts.push(K.k(M.Manifold.hull([K.cyl(6.5, top - 1, top + 2, rl * c, rl * s), K.cyl(7.5, 0, 2, rt * c, rt * s)])));
          legs.push([rt * c, rt * s]);
        }
        body = K.union(parts); feet = legs.slice();
      }
      const cuts = [K.ext(K.csub(K.off(outer, 0.45), K.off(inner, -0.45)), H - GROOVE, H + 1)]; // the shade's seat
      const floorZ = tripod ? H - L.plateT : 0, maxR = Math.max(4, L.ir - 1.5);
      const pocket = (d, depth) => { let pr = d / 2 + 0.5; if (pr > maxR) { warnings.push(`The light (${Math.round(d)} mm) is wider than the shade's bottom opening. The pocket was made ${Math.round(2 * maxR - 1)} mm.`); pr = maxR; } cuts.push(K.cyl(pr, H - Math.min(depth, L.avail), H + 1)); return pr; };
      if (L.socket) {
        cuts.push(K.cyl(PIPE_HOLE / 2, floorZ - 1, H + 1));
        if (L.rise > 0) cuts.push(K.cyl(L.riserOD / 2 + 0.4, H - 2, H + 1)); else cuts.push(K.cyl(o.socketD / 2 + 0.4, H - L.cupDepth, H + 1));
        cuts.push(K.k(K.k(M.Manifold.cylinder(6, NUT_AC / 2, NUT_AC / 2, 6)).translate([0, 0, floorZ - 1])));
      } else if (o.mount === 'strip') {
        let R = o.lightD > 0 ? o.lightD / 2 : Math.max(16, L.ir - 12); if (R + 5.5 > L.ir - 1) R = Math.max(10, L.ir - 6.5);
        cuts.push(K.ext(K.csub(K.cs(circlePts(R + 5.5)), K.cs(circlePts(Math.max(1, R - 5.5)))), H - MOUNTS.strip.depth, H + 1));
        cuts.push(K.cyl(3, floorZ - 1, H + 1, 0, R), K.cyl(4, floorZ - 1, H + 1));
        F.stripR = R;
      } else {
        pocket(o.lightD || L.m.d, L.m.depth);
        if (o.mount !== 'puck' || o.cable !== 'none') cuts.push(K.cyl(4, floorZ - 1, H + 1));
      }
      if (!tripod) {
        if (o.cable === 'notch') cuts.push(K.box(-4.5, 0, -1, 4.5, edgeY + 30, 7));
        else if (o.cable === 'usbc') cuts.push(K.box(-4.5, 0, -1, 4.5, edgeY - 20, 7), K.box(-8, edgeY - 26, -1, 8, edgeY - 1.6, 8.5), K.box(-4.9, edgeY - 3, 2.6, 4.9, edgeY + 2, 7));
        if (o.switchHole !== 'none') {
          const hz = o.switchHole === 'push' ? 7.5 : 8.5; zSwitch = Math.min(zSwitch, H - GROOVE - 1.5 - hz);
          if (zSwitch - hz < 1.2) warnings.push('The base is too low for a switch hole. Make it taller or pick a taller style.');
          else {
            const ex = edgeX, half = o.switchHole === 'push' ? [8, 7.5] : [12, 8.5];
            if (o.switchHole === 'push') cuts.push(K.k(K.k(M.Manifold.cylinder(14, 6.1, 6.1, 48)).rotate([0, 90, 0])).translate([ex - 5, 0, zSwitch]));
            else cuts.push(K.box(ex - 6, -9.6, zSwitch - 6.45, ex + 8, 9.6, zSwitch + 6.45));
            cuts.push(K.box(0, -half[0], zSwitch - half[1], ex - 2.6, half[0], zSwitch + half[1]));
            F.switchAt = [ex, 0, zSwitch];
          }
        }
      } else if (o.switchHole !== 'none') {
        const x = L.E.r + 11; cuts.push(o.switchHole === 'push' ? K.cyl(6.1, H - L.plateT - 1, H + 1, x, 0) : K.box(x - 6.45, -9.6, H - L.plateT - 1, x + 6.45, 9.6, H + 1));
      }
      if (o.feet) for (const [x, y] of feet) cuts.push(K.cyl(tripod ? Math.min(o.feetD, 13) / 2 : o.feetD / 2, -1, 1.2, x, y));
      const m = K.sub(body, cuts);
      return { body: K.soup(m), plan: L };
    } finally { K.free(); }
  }
  // the dome, stepped and mushroom bases: a revolved outline [r, z], never steeper than about 45 degrees outward
  function baseProfile(o, L) {
    const H = L.H, Rt = L.seatR, s = o.lamp; let pts, Rf, zSwitch = H * 0.4;
    if (s === 'dome') {
      Rf = Math.max(Rt * 1.3, Rt + 18); pts = [[0, 0], [Rf, 0], [Rf, 2]];
      const n = 28; for (let k = 1; k <= n; k++) { const u = k / n, z = 2 + (H - 4) * u; pts.push([Rt + (Rf - Rt) * Math.cos(u * Math.PI / 2), z]); }
      pts.push([Rt, H], [0, H]); zSwitch = Math.min(H * 0.35, H - GROOVE - 12);
    } else if (s === 'stepped') {
      Rf = Rt + 22; const R2 = Rt + 11, z1 = H * 0.3, z2 = H * 0.6, c = 1.5;
      pts = [[0, 0], [Rf, 0], [Rf, z1 - c], [Rf - c, z1], [R2, z1], [R2, z2 - c], [R2 - c, z2], [Rt, z2], [Rt, H], [0, H]]; zSwitch = z1 / 2;
    } else { // mushroom: a rounded foot, a slim stem and a flare up to the seat, like the stem under a mushroom cap
      Rf = Math.max(Rt * 0.8, 48); const zf = Math.min(14, H * 0.18), hf = H - zf - 3, k = 1.6;
      let Rn = Math.max(24, Rt * 0.45); Rn = Math.max(Rn, Rt - 0.95 * hf / k); Rn = Math.min(Rn, Rf - 6, Rt);
      pts = [[0, 0], [Rf, 0]]; for (let j = 1; j <= 10; j++) { const u = j / 10; pts.push([Rn + (Rf - Rn) * Math.cos(u * Math.PI / 2), zf * Math.sin(u * Math.PI / 2) + 0.001 * j]); }
      for (let j = 1; j <= 24; j++) { const u = j / 24; pts.push([Rn + (Rt - Rn) * Math.pow(u, k), zf + hf * u]); }
      pts.push([Rt, H], [0, H]); zSwitch = zf + hf * 0.3;
    }
    const clean = []; for (const q of pts) { const l = clean[clean.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.05) clean.push(q); }
    return { pts: clean, Rf, zSwitch };
  }
  // a closed solid of revolution with a radius that varies around and up: r(angle, z). Rings of nA points, flat bottom and top.
  function paramSolid(M, K, rFn, H, nA, nZ) {
    const nv = nA * (nZ + 1) + 2, V = new Float32Array(nv * 3), Fi = [];
    for (let j = 0; j <= nZ; j++) { const z = H * j / nZ; for (let i = 0; i < nA; i++) { const a = i / nA * TAU, r = rFn(a, z), n = (j * nA + i) * 3; V[n] = r * Math.cos(a); V[n + 1] = r * Math.sin(a); V[n + 2] = z; } }
    const cb = nA * (nZ + 1), ct = cb + 1; V[ct * 3 + 2] = H;
    for (let j = 0; j < nZ; j++) for (let i = 0; i < nA; i++) { const a = j * nA + i, b = j * nA + (i + 1) % nA, c = b + nA, d = a + nA; Fi.push(a, b, c, a, c, d); }
    for (let i = 0; i < nA; i++) { Fi.push(cb, (i + 1) % nA, i); Fi.push(ct, nZ * nA + i, nZ * nA + (i + 1) % nA); }
    const mesh = new M.Mesh({ numProp: 3, vertProperties: V, triVerts: Uint32Array.from(Fi) });
    return K.k(new M.Manifold(mesh));
  }
  // the designer bases: a profile (foot, stem or belly, seat) plus ribs, spiral ribs or a raised diamond lattice that fade
  // out near the foot and the seat. Slopes stay at about 45 degrees or less so they print without supports.
  function designerBase(o, L) {
    const H = L.H, Rt = L.seatR + 1, s = o.lamp, fade = (z, a, b) => smooth01(a, a + 6, z) * smooth01(H - b, H - b - 8, z);
    if (s === 'ribstem') { // the mushroom stem, with rounded fins all the way up
      const P = baseProfile(Object.assign({}, o, { lamp: 'mushroom' }), L), n = Math.max(14, Math.round(TAU * 30 / 9));
      const r = (a, z) => Math.max(4, rAtPts(P.pts, Math.min(H - 0.01, Math.max(0.01, z))) + 1.8 * fade(z, 12, 6) * (0.5 + 0.5 * waveAt('scallop', n * a)));
      return { r, Rf: P.Rf, zSwitch: P.zSwitch };
    }
    if (s === 'spiral') { // a foot, a slim waist and a cone up to the seat, wrapped in spiral ribs
      const Rf = Math.max(Rt * 0.8, 50), zf = 9, zw = H * 0.36; let Rw = Math.max(26, Rt * 0.34); const cone = H - 3 - zw; Rw = Math.max(Rw, Rt - Math.tan(40 * Math.PI / 180) * cone);
      const prof = z => { if (z <= zf) return Rf - Math.max(0, z - (zf - 2)); const u = Math.min(1, (z - zf) / (zw - zf)), r1 = Rf - 2 + (Rw - Rf + 2) * (1 - Math.pow(1 - u, 2)); if (z <= zw) return r1; return Rw + (Rt - Rw) * Math.min(1, (z - zw) / cone); };
      const n = 22, turns = 0.55;
      const r = (a, z) => prof(z) + 1.6 * fade(z, zf + 2, 4) * (0.5 + 0.5 * waveAt('scallop', n * a + TAU * turns * z / H * n / 4));
      return { r, Rf, zSwitch: (zf + zw) / 2 + 4 };
    }
    // lattice: a vase with a full belly, raised diamond ribs over it
    const Rb = Rt * 1.08, zb = H * 0.45, Rf = Math.max(Rt * 0.82, 46, Rb - 0.55 * zb);
    const prof = z => { if (z <= zb) { const u = z / zb; return Rf + (Rb - Rf) * Math.sin(u * Math.PI / 2); } const u = (z - zb) / (H - zb); return Rb + (Rt - Rb) * (1 - Math.cos(u * Math.PI / 2)); };
    const nd = Math.max(8, Math.round(TAU * Rb / 30)), lam = 34, rg = x => Math.pow(0.5 + 0.5 * Math.cos(x), 7);
    const r = (a, z) => { const u = nd * a / TAU, v = z / lam, ra = rg(TAU * (u + v)), rc = rg(TAU * (u - v)); return prof(z) + 2.2 * fade(z, 3, 5) * (1 - (1 - ra) * (1 - rc)); };
    return { r, Rf, zSwitch: zb };
  }
  function rAtPts(pts, z) { let best = 0; for (let i = 1; i < pts.length; i++) { const [r0, z0] = pts[i - 1], [r1, z1] = pts[i]; if (r0 > 0 && r1 > 0 && (z - z0) * (z - z1) <= 0 && z1 !== z0) best = Math.max(best, r0 + (r1 - r0) * (z - z0) / (z1 - z0)); } return best; }
  // ---------------------------------------------------------------- the light stand (Manifold)
  // A ring holds the shade (the same groove as a base) with a hub for the light on spokes, and 3 or 4 splayed legs that
  // print separately, lying on their side. Each leg's top tongue slides up into a slot under the ring (the ring rests on
  // it); an M3 screw through the outer rim locks it (or a one-sided snap ridge clicks it in). Legs taller than the bed
  // split in two with a tenon and a cross screw. The cord drops through the hub, runs under one spoke and down a groove
  // in that leg. Assembled: z = 0 is the table, the seat is at z = lampH.
  function buildStand(F, S, M, warnings, U) {
    const o = F.o, K = kit(M), L = lampPlan(F, S), H = L.H, n = o.standLegs, ST = STAND, RH = ST.ringH, W = ST.legW;
    try {
      let outer = K.cs(ringOutline(F, S, 0, 'outer', true)), inner = K.cs(ringOutline(F, S, 0, 'inner', true));
      for (let j = 1; j < F.NV && F.row[j - 1].z < GROOVE + 0.5; j++) { outer = K.k(outer.add(K.cs(ringOutline(F, S, j, 'outer', true)))); inner = K.k(inner.intersect(K.cs(ringOutline(F, S, j, 'inner', true)))); }
      const Ro = L.E.r + 12, z1 = H - RH, socket = L.socket;
      const maxR = Math.max(4, L.ir - 1.5); let pr = socket ? o.socketD / 2 + 0.4 : (o.lightD || L.m.d) / 2 + 0.5;
      if (!socket && pr > maxR) { warnings.push(`The light (${Math.round(2 * pr - 1)} mm) is wider than the shade's bottom opening. The pocket was made ${Math.round(2 * maxR - 1)} mm.`); pr = maxR; }
      const hubR = pr + (socket ? 8 : 4), Ri = Math.max(hubR + 6, L.ir - 4), solidTop = Ri <= hubR + 8;
      const ang = k => -Math.PI / 2 + k * TAU / n; // leg 1 at the back
      // the ring, the hub and the spokes (all flat underneath, so it prints as assembled)
      const parts = [K.cyl(Ro, z1, H)];
      let ringM = solidTop ? K.union(parts) : null;
      if (!solidTop) {
        const ring = K.sub(K.cyl(Ro, z1, H), [K.cyl(Ri, z1 - 1, H + 1)]), sp = [ring, K.cyl(hubR, z1, H)];
        for (let k = 0; k < n; k++) { const a = ang(k), c = Math.cos(a), s = Math.sin(a), hw = 5, R = Ri + 2; sp.push(K.ext(K.cs([[-hw * s, hw * c], [R * c - hw * s, R * s + hw * c], [R * c + hw * s, R * s - hw * c], [hw * s, -hw * c]]), z1, z1 + 9)); }
        ringM = K.union(sp);
      }
      const cuts = [K.ext(K.csub(K.off(outer, 0.45), K.off(inner, -0.45)), H - GROOVE, H + 1)];
      if (socket) { cuts.push(K.cyl(pr, z1 - 1, H + 1), K.cyl(pr + 6, z1 - 1, H - 3)); } // a 3 mm plate the socket's shade ring clamps
      else { cuts.push(K.cyl(pr, H - Math.min(L.m.depth, L.avail), H + 1)); if (o.mount !== 'puck' || o.cable !== 'none') cuts.push(K.cyl(4, z1 - 1, H + 1)); }
      // per leg: the slot under the ring for the tongue, the screw's pilot hole or the snap groove
      const legFrame = k => { const a = ang(k); return { a, u: [Math.cos(a), Math.sin(a)], t: [-Math.sin(a), Math.cos(a)] }; };
      const radialCyl = (fr, r0, r1, rad, z) => K.k(K.k(K.k(K.k(M.Manifold.cylinder(r1 - r0, rad, rad, 24)).rotate([0, 90, 0])).translate([r0, 0, z])).rotate([0, 0, fr.a * 180 / Math.PI]));
      const radialBox = (fr, r0, r1, w0, w1, za, zb) => { const { u, t } = fr, P = [[r0, w0], [r1, w0], [r1, w1], [r0, w1]].map(([r, w]) => [u[0] * r + t[0] * w, u[1] * r + t[1] * w]); return K.ext(K.cs(P), za, zb); };
      const cl = 0.2, tongueTop = H - 3, zScrew = z1 + 6.5;
      for (let k = 0; k < n; k++) {
        const fr = legFrame(k);
        cuts.push(radialBox(fr, Ro - ST.tongue - cl, Ro + 1, -W / 2 - cl, W / 2 + cl, z1 - 1, tongueTop + cl));
        if (o.standJoint === 'screw') cuts.push(radialCyl(fr, Ro - ST.tongue - 10, Ro + 1, 1.25, zScrew)); // the screw's pilot hole into the ring
        else cuts.push(radialBox(fr, Ro - ST.tongue - cl, Ro + 1, -W / 2 - 1.1, -W / 2 - cl + 0.01, tongueTop - 3.2, tongueTop - 1.6)); // the snap groove
      }
      const cord = o.cable !== 'none';
      if (cord) cuts.push(radialBox(legFrame(0), 0, Ro + 1, -3, 3, z1 - 1, z1 + 4)); // the cord runs under spoke 1
      const ringPart = K.soup(K.sub(ringM, cuts));
      // the legs
      const splay = Math.min(0.25 * H, 50), legs = [];
      for (let k = 0; k < n; k++) {
        const fr = legFrame(k), top = radialBox(fr, Ro + cl, Ro + ST.block, -W / 2, W / 2, z1, H), foot = radialBox(fr, Ro + splay, Ro + splay + 12, -W / 2, W / 2, 0, 3);
        let leg = K.k(M.Manifold.hull([top, foot]));
        leg = K.union([leg, radialBox(fr, Ro - ST.tongue, Ro + cl + 0.5, -W / 2, W / 2, z1, tongueTop)]);
        const lc = [];
        if (o.standJoint === 'screw') { // clearance hole and counterbore from the outside
          lc.push(radialCyl(fr, Ro - ST.tongue - 1, Ro + ST.block + 3, 1.7, zScrew), radialCyl(fr, Ro + ST.block - 3, Ro + ST.block + 20, 3.1, zScrew));
        } else leg = K.union([leg, radialBox(fr, Ro - ST.tongue + 0.6, Ro - 0.6, -W / 2 - 0.5, -W / 2 + 0.01, tongueTop - 3, tongueTop - 1.8)]); // the snap ridge (on the side that faces up when printed)
        if (k === 0 && cord) { // the cord groove: under the tongue, then down the leg's inner face
          lc.push(radialBox(fr, Ro - ST.tongue - 1, Ro + 4, -3, 3, z1 - 1, z1 + 4));
          lc.push(K.k(M.Manifold.hull([radialBox(fr, Ro - 1, Ro + 4, -3, 3, z1, z1 + 4), radialBox(fr, Ro + splay - 1, Ro + splay + 4, -3, 3, -1, 2)])));
        }
        if (o.feet) lc.push(K.k(K.cyl(Math.min(o.feetD, 12) / 2, -1, 1.2, (Ro + splay + 6) * fr.u[0], (Ro + splay + 6) * fr.u[1])));
        leg = K.sub(leg, lc);
        // print frame: lying on its side (x along the leg's radial line, y up the leg, the +t side on the bed)
        const toPrint = p => { const q = new Float32Array(p.length); for (let i = 0; i < p.length; i += 3) { const x = p[i], y = p[i + 1], z = p[i + 2]; q[i] = x * fr.u[0] + y * fr.u[1]; q[i + 1] = z; q[i + 2] = -(x * fr.t[0] + y * fr.t[1]); } return q; };
        // split a leg taller than the bed: a tenon on the lower piece, a mortise in the upper one, an M3 cross screw
        const lenP = Math.hypot(H, splay) + 4, room = Math.max(U.w, U.d);
        if (lenP <= room) legs.push({ name: `Leg ${k + 1}`, assembled: K.soup(leg), print: toPrint });
        else {
          const zc = H * 0.5, rc = Ro + splay * (1 - zc / H) + 6, tw = 6, th = 12, ten = radialBox(fr, rc - tw / 2, rc + tw / 2, -W / 2 + 3, W / 2, zc - 0.01, zc + th);
          const mort = radialBox(fr, rc - tw / 2 - 0.2, rc + tw / 2 + 0.2, -W / 2 + 2.8, W / 2 + 1, zc - 1, zc + th + 0.4);
          const below = K.box(-1e4, -1e4, -10, 1e4, 1e4, zc), above = K.box(-1e4, -1e4, zc, 1e4, 1e4, H + 10);
          const pin = K.k(K.k(K.k(M.Manifold.cylinder(W + 4, 1.3, 1.3, 20)).translate([0, 0, -W / 2 - 2])).rotate([90, 0, 0]));
          const pinAt = K.k(K.k(K.k(pin).rotate([0, 0, fr.a * 180 / Math.PI])).translate([rc * fr.u[0], rc * fr.u[1], zc + th / 2]));
          const lower = K.sub(K.union([K.isect(leg, below), ten]), [pinAt]), upper = K.sub(K.isect(leg, above), [mort, pinAt]);
          legs.push({ name: `Leg ${k + 1} bottom`, assembled: K.soup(lower), print: toPrint }, { name: `Leg ${k + 1} top`, assembled: K.soup(upper), print: toPrint });
        }
      }
      return { ring: ringPart, legs, plan: L, Ro, splay, footR: Ro + splay + 12 };
    } finally { K.free(); }
  }
  // ---------------------------------------------------------------- table legs (Manifold)
  // The hub: a plug that fits inside the shade's bottom edge (0.4 mm clearance) on a thin flange the edge rests on, the
  // light's pocket on top, a cord hole in the middle, and 3 or 4 bosses underneath with sockets angled 18 degrees out.
  // Legs are printed rods (12-sided, printed lying on a flat) or wooden dowels with printed cap feet. Assembled: z = 0 is
  // the table, the shade's bottom edge is at z = lampH. The hub prints upside down (flange and plug flat on the bed).
  function buildLegs(F, S, M, warnings) {
    const o = F.o, K = kit(M), H = o.lampH, LG = LEGS, n = o.standLegs, d = o.legD, th = LG.splay * Math.PI / 180;
    try {
      let outer = K.cs(ringOutline(F, S, 0, 'outer', true)), inner = K.cs(ringOutline(F, S, 0, 'inner', true));
      for (let j = 1; j < F.NV && F.row[j - 1].z < LG.plug + 0.5; j++) { outer = K.k(outer.add(K.cs(ringOutline(F, S, j, 'outer', true)))); inner = K.k(inner.intersect(K.cs(ringOutline(F, S, j, 'inner', true)))); }
      const L0 = lampPlan(F, S), top = H + LG.plug, bot = H - LG.flange;
      const plug = K.ext(K.off(inner, -0.4), H - 0.01, top), flange = K.ext(K.off(outer, 1.2), bot, H);
      const socket = L0.socket, maxR = Math.max(4, L0.ir - 2); let pr = socket ? o.socketD / 2 + 0.4 : (o.lightD || L0.m.d) / 2 + 0.5;
      if (!socket && pr > maxR) { warnings.push(`The light (${Math.round(2 * pr - 1)} mm) is wider than the shade's bottom opening. The pocket was made ${Math.round(2 * maxR - 1)} mm.`); pr = maxR; }
      const rb = d / 2 + 3.5, rs = Math.max(pr * 0.5 + 6, Math.min(L0.ir - rb - 4, L0.ir * 0.62)); // where each socket opens
      const zO = bot - LG.boss, ang = k => -Math.PI / 2 + k * TAU / n;
      const place = (m, k, zA, rA) => K.k(K.k(K.k(m).rotate([0, 180 - LG.splay, 0])).rotate([0, 0, ang(k) * 180 / Math.PI])).translate([rA * Math.cos(ang(k)), rA * Math.sin(ang(k)), zA]);
      const legsInfo = [], solids = [plug, flange], cuts = [];
      for (let k = 0; k < n; k++) {
        const rA = rs - LG.socket * Math.sin(th), zA = zO + LG.socket * Math.cos(th); // the socket's deepest point
        const up = (bot + 1 - zA) / Math.cos(th); // from the socket bottom up into the flange
        solids.push(place(K.k(M.Manifold.cylinder(LG.socket + up, rb, rb, 40)).translate([0, 0, -up]), k, zA, rA));
        cuts.push(place(K.k(M.Manifold.cylinder(LG.socket + 2, d / 2 + 0.15, d / 2 + 0.15, 40)), k, zA, rA));
        const len = zA / Math.cos(th); legsInfo.push({ k, zA, rA, len, foot: rA + len * Math.sin(th) });
      }
      let hub = K.union(solids);
      if (socket) cuts.push(K.cyl(pr, bot - 1, top + 1), K.cyl(pr + 6, bot - 1, top - 3));
      else { cuts.push(K.cyl(pr, top - Math.min(L0.m.depth, L0.avail), top + 1)); if (o.cable !== 'none' || o.mount !== 'puck') cuts.push(K.cyl(4, bot - 1, top + 1)); }
      hub = K.sub(hub, cuts);
      const out = { hub: K.soup(hub), pieces: [], legs: legsInfo, rs };
      // legs or cap feet
      for (const lg of legsInfo) {
        const a = ang(lg.k), u = [Math.cos(a), Math.sin(a)], t = [-u[1], u[0]];
        const b = [Math.cos(th) * u[0], Math.cos(th) * u[1], Math.sin(th)], ax = [Math.sin(th) * u[0], Math.sin(th) * u[1], -Math.cos(th)];
        const toAsm = p => { const q = new Float32Array(p.length); for (let i = 0; i < p.length; i += 3) { const x = p[i], y = p[i + 1], z = p[i + 2]; for (let c = 0; c < 3; c++) q[i + c] = (c < 2 ? (c === 0 ? lg.rA * u[0] : lg.rA * u[1]) : lg.zA) + x * b[c] + y * (c < 2 ? -t[c] : 0) + z * ax[c]; } return q; };
        const tableN = [Math.sin(th), 0, -Math.cos(th)], tableOff = -lg.zA; // keeps z_table >= 0 in the leg frame
        if (o.legMode === 'printed') {
          const rr = d / 2, ri = rr * Math.cos(Math.PI / 12), pts = []; for (let k = 0; k < 12; k++) { const q = -Math.PI / 2 + Math.PI / 12 + k * TAU / 12; pts.push([rr * Math.cos(q), rr * Math.sin(q)]); } // a flat at -y
          const rod = K.k(K.k(M.Manifold.extrude(K.cs(pts), lg.len + rr * 2 + 2)).trimByPlane(tableN, tableOff));
          const soup = K.soup(rod), print = new Float32Array(soup.length); for (let i = 0; i < soup.length; i += 3) { print[i] = soup[i + 2]; print[i + 1] = soup[i]; print[i + 2] = soup[i + 1] + ri; }
          out.pieces.push({ name: `Leg ${lg.k + 1}`, kind: 'stand', assembled: toAsm(soup), local: print, legLen: lg.len });
        } else { // a dowel from the socket bottom to 3 mm above the foot's floor, in a printed cap foot
          const rc = d / 2 + 3, zf = lg.len, cap = K.k(K.k(M.Manifold.cylinder(LG.capH + 10, rc, rc, 40)).translate([0, 0, zf - LG.capH]).trimByPlane(tableN, tableOff));
          const capM = K.k(cap.subtract(K.k(K.k(M.Manifold.cylinder(LG.capH - 3 + 1, d / 2 + 0.15, d / 2 + 0.15, 40)).translate([0, 0, zf - LG.capH - 1]))));
          const asm = toAsm(K.soup(capM)); out.pieces.push({ name: `Foot ${lg.k + 1}`, kind: 'stand', assembled: asm, local: asm, dowelLen: zf - 3 });
          const end = toAsm(new Float32Array([0, 0, 0, 0, 0, zf - 3])); out.dowels = (out.dowels || []).concat([{ a: [end[0], end[1], end[2]], b: [end[3], end[4], end[5]], r: d / 2 }]);
        }
      }
      out.plan = Object.assign({}, L0, { H: top, avail: LG.plug + LG.flange - 2.4, cupDepth: socket ? 3 : 0 });
      out.footR = Math.max(...legsInfo.map(l => l.foot)) + d / 2 + 3;
      return out;
    } finally { K.free(); }
  }
  function circlePts(r) { const n = Math.max(48, Math.min(200, Math.round(r * 2))), p = []; for (let k = 0; k < n; k++) { const a = k / n * TAU; p.push([r * Math.cos(a), r * Math.sin(a)]); } return p; }
  function buildRiser(o, L, M) { // a tube that lifts the socket; the threaded lamp pipe runs through it and the base
    const K = kit(M), h = L.rise, R = L.riserOD / 2;
    try {
      const tube = K.cyl(R, 0, h), core = Math.min(8, R - 3);
      const cuts = [K.cyl(o.socketD / 2 + 0.4, h - L.cupDepth, h + 1), K.cyl(PIPE_HOLE / 2, -1, h + 1)];
      if (h - L.cupDepth - 3 > 4) cuts.push(K.cyl(core, -1, h - L.cupDepth - 3));
      return K.soup(K.sub(tube, cuts));
    } finally { K.free(); }
  }
  // ---------------------------------------------------------------- color inserts (Manifold)
  // A thin straight sleeve (open top and bottom) that drops in through the top opening: its outline is the largest one
  // that clears the shade's wall at every height by the clearance (the smooth skin offset by the thickest wall, so the
  // photo relief never rubs), and a flange at the top sits in the ledge, flush with the top edge. Two small ears inside
  // the top edge are for a two-finger pinch to lift it out. Shade frame: z = 0 is the shade's bottom edge.
  // Prints upside down (flange and ears on the bed), one or two walls, no supports.
  function insertPlan(F, S, M, zBot) {
    const o = F.o, K = kit(M), H = o.height, zL = H - LEDGE_H, clear = o.insertClear, wall = o.insertWall;
    try {
      const rows = []; for (let j = 0; j < F.NV; j++) { const z = F.row[j].z, zn = j + 1 < F.NV ? F.row[j + 1].z : Infinity; if (zn > zBot + 1e-6 && z <= zL + 1e-6) rows.push(j); } // every row the sleeve spans, and the one under its bottom edge
      const stride = Math.max(1, Math.ceil(rows.length / 140)), pick = rows.filter((j, n) => n % stride === 0 || n === rows.length - 1);
      // the row with the smallest radius is always in (waists)
      let jMin = rows[0]; for (const j of rows) if (F.row[j].r < F.row[jMin].r) jMin = j; if (!pick.includes(jMin)) pick.push(jMin);
      let reg = null;
      for (const j of pick) {
        const rw = F.row[j], kMax = Math.min(2, Math.sqrt(1 + (F.Sec.rhoMax * rw.dr) ** 2));
        const wallAt = o.relief === 'outside' ? K.off(K.cs(ringOutline(F, S, j, 'inner', true)), -0.05) : K.off(K.cs(ringOutline(F, S, j, 'outer', true)), -(F.tRef * kMax + 0.05));
        reg = reg ? K.k(reg.intersect(wallAt)) : wallAt;
      }
      const bodyOut = K.off(reg, -clear), bodyIn = K.off(bodyOut, -wall);
      const areaOut = bodyOut.area(), areaIn = bodyIn.area();
      if (!(areaIn > 400)) return { ok: false, why: 'small' };
      const inPts = polysOf(bodyIn), outPts = polysOf(bodyOut);
      if (inPts.length !== 1 || outPts.length !== 1) return { ok: false, why: 'shape' };
      const ir = inradius(inPts[0]);
      let ledgeIn = null; for (let j = 0; j < F.NV; j++) if (F.row[j].ledge) { const c = K.cs(ringOutline(F, S, j, 'inner', true)); ledgeIn = ledgeIn ? K.k(ledgeIn.intersect(c)) : c; }
      const flangeOut = K.k(K.off(ledgeIn, -clear).add(bodyOut));
      const ring = K.csub(bodyOut, bodyIn), flRing = K.csub(flangeOut, bodyIn);
      // the ears: half discs inside the top edge on the left and right
      const ears = [], earAt = []; const earR = Math.min(8, Math.max(4, ir * 0.18));
      for (const sx of [-1, 1]) {
        let best = null; for (const [x, y] of inPts[0]) if (x * sx > 0 && (!best || Math.abs(y) < Math.abs(best[1]) - 1e-9 || (Math.abs(Math.abs(y) - Math.abs(best[1])) < 1e-9 && x * sx > best[0] * sx))) best = [x, y];
        if (best) earAt.push(best);
        if (best) ears.push(K.k(K.cs(circlePts(earR).map(([x, y]) => [x + best[0], y + best[1]])).intersect(bodyOut)));
      }
      const top = ears.length ? K.k(flRing.add(K.k(M.CrossSection.union(ears)))) : flRing;
      const zF = zL + 0.03; // the flange's underside rests on the ledge (just above the step's 0.02 mm bevel)
      const body = K.union([K.ext(ring, zBot, zF + 0.01), K.ext(top, zF, H)]);
      const mesh = K.soup(body);
      return { ok: true, mesh, zBot, zL, H, ir, earR, earAt, area: areaOut - areaIn, bodyOutPts: outPts[0], bodyInPts: inPts[0] };
    } finally { K.free(); }
  }
  function polysOf(cs) { return cs.toPolygons().map(poly => Array.from(poly, p => [p[0], p[1]])); }
  // the display-only light fixture for the preview (never exported): what it is, where it sits and where the light comes from
  function fixtureOf(o, L, F, z0) {
    const H = L.H, fx = { mount: o.mount };
    if (L.socket) {
      const e26 = o.mount === 'e26', cupTop = L.rise > 0 ? H - 2 + L.rise : H, sb = cupTop - L.cupDepth, sh = e26 ? 52 : 38;
      fx.socket = { z: sb, h: sh, r: o.socketD / 2 };
      fx.bulb = { z: sb + sh + (e26 ? 34 : 26), r: e26 ? 30 : 15, neck: e26 ? 16 : 7, stretch: e26 ? 1.15 : 1.9 };
      fx.light = [0, 0, fx.bulb.z];
    } else if (o.mount === 'strip') { fx.ring = { z: H - 2, R: F.stripR || 30 }; fx.light = [0, 0, H + o.height * 0.3]; }
    else if (o.mount === 'tealight') { const d = o.lightD || 38.5, z = H - Math.min(MOUNTS.tealight.depth, L.avail); fx.candle = { z, r: d / 2 - 0.5, h: 16 }; fx.light = [0, 0, z + 30]; }
    else if (o.mount === 'usb') { const z = H - Math.min(MOUNTS.usb.depth, L.avail); fx.board = { z, r: (o.lightD || 32) / 2 - 0.5 }; fx.light = [0, 0, z + 25]; }
    else { const d = Math.min(o.lightD || 70, 2 * Math.max(4, L.ir - 1.5)), z = H - Math.min(MOUNTS.puck.depth, L.avail); fx.puck = { z, r: d / 2 - 0.5, h: 16 }; fx.light = [0, 0, z + 16 + o.height * 0.2]; }
    if (F.switchAt) fx.switchAt = F.switchAt;
    return fx;
  }

  // ---------------------------------------------------------------- build
  function rotZ(p, a) { const c = Math.cos(a), s = Math.sin(a), q = new Float32Array(p.length); for (let k = 0; k < p.length; k += 3) { q[k] = p[k] * c - p[k + 1] * s; q[k + 1] = p[k] * s + p[k + 1] * c; q[k + 2] = p[k + 2]; } return q; }
  function shiftZ(p, dz) { const q = Float32Array.from(p); if (dz) for (let k = 2; k < q.length; k += 3) q[k] += dz; return q; }
  function flipX(p) { const q = new Float32Array(p.length); for (let k = 0; k < p.length; k += 3) { q[k] = p[k]; q[k + 1] = -p[k + 1]; q[k + 2] = -p[k + 2]; } return q; } // 180 degrees about x
  function usable(o) { return { w: Math.max(50, o.bed[0] - 8), d: Math.max(50, o.bed[1] - 8), z: Math.max(30, o.bed[2] - 4) }; }
  function fits(sz, U) { return ((sz[0] <= U.w && sz[1] <= U.d) || (sz[0] <= U.d && sz[1] <= U.w)) && sz[2] <= U.z; }
  // the pieces' row and column ranges for a split
  function splitPlan(F, around, sections) {
    const { NU, NV, row } = F, cuts = [0];
    if (sections > 1) { const ph = row.map((r, j) => [r, j]).filter(([r]) => !r.rim), a = ph[0][1], b = ph[ph.length - 1][1]; for (let k = 1; k < sections; k++) cuts.push(Math.round(a + (b - a) * k / sections)); }
    cuts.push(NV - 1);
    const per = NU / around, out = [];
    for (let h = 0; h < cuts.length - 1; h++) for (let k = 0; k < around; k++) out.push({ i0: Math.round(k * per), i1: Math.round((k + 1) * per), j0: cuts[h], j1: cuts[h + 1], ring: around === 1, k, h });
    return out;
  }
  function pieceFrame(F, S, pc) { // turn a panel so its middle faces -y, then measure it
    if (pc.ring) return 0;
    const jm = Math.round((pc.j0 + pc.j1) / 2), im = Math.round((pc.i0 + pc.i1) / 2) % F.NU, n = (jm * F.NU + im) * 3;
    return -Math.PI / 2 - Math.atan2(S.O[n + 1], S.O[n]);
  }
  function pieceSize(F, S, pc) {
    const a = pieceFrame(F, S, pc), c = Math.cos(a), s = Math.sin(a); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const step = Math.max(1, Math.round(F.NU / 720)), last = pc.ring ? pc.i0 + F.NU - 1 : pc.i1, idx = [];
    for (let i = pc.i0; i < last; i += step) idx.push(i); idx.push(last);
    for (const j of [pc.j0, Math.round((pc.j0 + pc.j1) / 2), pc.j1]) for (const i of idx) {
      for (const A of [S.O, S.I]) { const n = (j * F.NU + (i % F.NU)) * 3, x = A[n] * c - A[n + 1] * s, y = A[n] * s + A[n + 1] * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    // the profile can bulge between the sampled rows: widen by the max radius change
    let rmax = 0; for (let j = pc.j0; j <= pc.j1; j++) rmax = Math.max(rmax, F.row[j].r); const rs = Math.max(F.row[pc.j0].r, F.row[pc.j1].r, F.row[Math.round((pc.j0 + pc.j1) / 2)].r), grow = Math.max(0, rmax - rs);
    return [x1 - x0 + 2 * grow, y1 - y0 + 2 * grow, F.row[pc.j1].z - F.row[pc.j0].z];
  }
  // the smallest split that fits the bed
  function suggestSplit(raw) {
    const o = options(Object.assign({}, raw, { preview: true, around: 1, sections: 1 })), U = usable(o);
    const F = field(o, 3), S = skins(F);
    for (const sections of [1, 2, 3]) for (const around of [1, 2, 3, 4, 6, 8]) {
      const F2 = around === 1 && sections === 1 ? F : field(Object.assign({}, o, { around, sections }), 3), S2 = F2 === F ? S : skins(F2);
      if (splitPlan(F2, around, sections).every(pc => fits(pieceSize(F2, S2, pc), U))) return { around, sections, pieces: around * sections };
    }
    return { around: 8, sections: 3, pieces: 24, tooBig: true };
  }
  function build(raw, M) {
    const o = options(raw), warnings = [];
    const F = field(o), S = skins(F), U = usable(o);
    const lampOn = o.lamp !== 'none' && !!M;
    const legsOn = lampOn && o.lamp === 'legs', z0 = lampOn ? o.lampH - (legsOn ? 0 : GROOVE) : o.pendant ? PENDANT_DROP : 0; // the shade sits in the lamp base's groove (or on the hidden hub's flange)
    const plan = splitPlan(F, o.around, o.sections), parts = [];
    plan.forEach((pc, n) => {
      const m = pieceMesh(F, S, pc.i0, pc.i1, pc.j0, pc.j1, pc.ring);
      const a = pieceFrame(F, S, pc), zl = F.row[pc.j0].z;
      const local = PL.normalize(rotZ(shiftZ(m.p, -zl), a));
      const name = plan.length === 1 ? 'Shade' : `Shade ${o.sections > 1 ? String.fromCharCode(65 + pc.h) : ''}${o.around > 1 ? pc.k + 1 : ''}`;
      parts.push({ name, kind: 'shade', color: o.colors.shade, assembled: shiftZ(m.p, z0), th: m.th, nrm: m.nrm, local: Float32Array.from(local) });
    });
    const addFitter = holePts => {
      if (M) { const sp = buildSpider(F, S, M, z0, holePts); parts.push({ name: o.pendant ? 'Pendant cap' : 'Spider fitter', kind: 'fitter', color: o.colors.base, assembled: sp, local: Float32Array.from(PL.normalize(flipX(sp))) }); }
      else warnings.push('The fitter could not be built here (no WebAssembly).');
    };
    if (o.fitter !== 'none' && !o.pendant) addFitter(null);
    let fixture = null, standInfo = null;
    if (o.pendant) { // display only: the cord, the socket hanging through the cap and the bulb
      const e26 = FITTERS[o.fitter].socket === 'e26', top = z0 + o.height, sh = e26 ? 52 : 38, sb = top + 12 - sh, b = { r: e26 ? 30 : 15, neck: e26 ? 16 : 7, stretch: e26 ? 1.15 : 1.9 };
      b.z = sb - (e26 ? 34 : 26);
      fixture = { mount: 'pendant', hang: true, socket: { z: sb, h: sh, r: e26 ? 19.5 : 10.5 }, bulb: b, cord: { z: top + 12, len: 240 }, light: [0, 0, b.z] };
      if (b.z - b.r * b.stretch < z0 + 4) warnings.push('The bulb hangs below the shade. Make the shade taller or use a smaller LED bulb.');
      const jz = F.row.reduce((best, rw, j) => Math.abs(rw.z + z0 - b.z) < Math.abs(F.row[best].z + z0 - b.z) ? j : best, 0), wall = inradius(ringOutline(F, S, jz, 'inner'));
      if (b.r + 10 > wall) warnings.push('The bulb is close to the shade wall. Use a smaller LED bulb or a wider shade.');
    }
    if (o.lamp !== 'none') {
      if (M && o.lamp === 'legs') {
        const lb = buildLegs(F, S, M, warnings), dw = lb.pieces.find(p => p.dowelLen), lp = lb.pieces.find(p => p.legLen);
        standInfo = { footR: lb.footR, legs: o.standLegs, mode: o.legMode, legD: o.legD, dowelLen: dw ? dw.dowelLen : 0, legLen: lp ? lp.legLen : 0, table: true };
        parts.push({ name: 'Hub', kind: 'lamp', color: o.colors.base, assembled: lb.hub, local: Float32Array.from(PL.normalize(flipX(lb.hub))), flipped: true });
        for (const pc of lb.pieces) parts.push({ name: pc.name, kind: 'stand', color: o.colors.base, assembled: pc.assembled, local: Float32Array.from(PL.normalize(pc.local)) });
        fixture = fixtureOf(o, lb.plan, F, z0); if (lb.dowels) fixture.dowels = lb.dowels; // display only: the wooden dowels aren't printed
      } else if (M && o.lamp === 'stand') {
        const sb = buildStand(F, S, M, warnings, U), L = sb.plan; standInfo = { Ro: sb.Ro, splay: sb.splay, footR: sb.footR, legs: o.standLegs, joint: o.standJoint, split: sb.legs.length > o.standLegs };
        parts.push({ name: 'Stand ring', kind: 'lamp', color: o.colors.base, assembled: sb.ring, local: Float32Array.from(PL.normalize(sb.ring)), flipped: false });
        for (const lg of sb.legs) parts.push({ name: lg.name, kind: 'stand', color: o.colors.base, assembled: lg.assembled, local: Float32Array.from(PL.normalize(lg.print(lg.assembled))) });
        fixture = fixtureOf(o, L, F, z0);
      } else if (M) {
        const lb = buildLamp(F, S, M, warnings), L = lb.plan, tri = o.lamp === 'tripod';
        parts.push({ name: 'Lamp base', kind: 'lamp', color: o.colors.base, assembled: lb.body, local: Float32Array.from(PL.normalize(tri ? flipX(lb.body) : lb.body)), flipped: tri });
        if (L.socket && L.rise > 0) { const rs = buildRiser(o, L, M); parts.push({ name: 'Socket riser', kind: 'riser', color: o.colors.base, assembled: shiftZ(rs, o.lampH - 2), local: Float32Array.from(PL.normalize(rs)) }); }
        fixture = fixtureOf(o, L, F, z0);
        // a bulb must clear the shade
        if (fixture.bulb) {
          const b = fixture.bulb, top = z0 + o.height;
          if (b.z + b.r * b.stretch > top - 6) warnings.push('The bulb reaches past the top of the shade. Lower the socket riser or make the shade taller.');
          const jz = F.row.reduce((best, rw, j) => Math.abs(rw.z + z0 - b.z) < Math.abs(F.row[best].z + z0 - b.z) ? j : best, 0), wall = inradius(ringOutline(F, S, jz, 'inner'));
          if (b.r + 10 > wall) warnings.push('The bulb is close to the shade wall. Use a smaller LED bulb or a wider shade.');
        }
      } else warnings.push('The lamp base could not be built here (no WebAssembly).');
    }
    let insert = null;
    if (o.inserts > 0) {
      if (!M) warnings.push('The color inserts could not be built here (no WebAssembly).');
      else {
        // the sleeve hangs from the ledge and stops above the lamp base (or the table), and above the light if the light
        // would not fit inside it
        let zBot = lampOn ? (legsOn ? LEGS.plug : GROOVE) + 1.5 : 1.5;
        let ins = insertPlan(F, S, M, zBot);
        if (ins.ok && fixture && fixture.hang) { if (fixture.bulb.r + 6 > ins.ir) warnings.push('The bulb is close to the color insert. Use a small LED bulb.'); }
        else if (ins.ok && fixture) {
          const fx = fixture, rz = z => z - z0; let r0 = 0, zTop = -Infinity;
          if (fx.puck) { r0 = fx.puck.r; zTop = rz(fx.puck.z + fx.puck.h); }
          else if (fx.candle) { r0 = fx.candle.r; zTop = rz(fx.candle.z + fx.candle.h + 20); }
          else if (fx.board) { r0 = fx.board.r; zTop = rz(fx.board.z + 2 + fx.board.r * 0.42); }
          else if (fx.bulb) { r0 = fx.bulb.r; zTop = rz(fx.bulb.z + fx.bulb.r * fx.bulb.stretch); }
          if (r0 + 2 > ins.ir && zTop + 2 > zBot) {
            zBot = zTop + 2;
            if (zBot > o.height - LEDGE_H - 20) ins = { ok: false, why: 'light' };
            else { ins = insertPlan(F, S, M, zBot); warnings.push('The light is wider than the color insert, so the insert stops above it.'); }
          }
          if (ins.ok && fx.bulb && fx.bulb.r + 6 > ins.ir) warnings.push('The bulb is close to the color insert. Use a small LED bulb.');
        }
        if (!ins.ok) warnings.push(ins.why === 'light' ? 'The color inserts were left out: the light fills the shade. Use a smaller light or a taller shade.' : 'The color inserts were left out: the top opening is too small or too tight for one. Make the top wider.');
        else {
          insert = { ir: ins.ir, zBot: ins.zBot, zL: ins.zL, earR: ins.earR, earAt: ins.earAt, outline: ins.bodyOutPts, hole: ins.bodyInPts, wall: o.insertWall, clear: o.insertClear, ledgeW: o.ledgeW, ledgeH: LEDGE_H };
          const asm = shiftZ(ins.mesh, z0), local = Float32Array.from(PL.normalize(flipX(ins.mesh)));
          o.insertColors.forEach((c, k) => parts.push({ name: o.inserts > 1 ? `Color insert ${k + 1}` : 'Color insert', kind: 'insert', color: c, assembled: asm, local, flipped: true, insertIndex: k }));
        }
      }
    }
    if (o.pendant) addFitter(insert);
    let tooBig = false;
    for (const pt of parts) {
      const bb = Core.bbox(pt.local); pt.size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
      pt.fits = fits(pt.size, U); if (!pt.fits) { tooBig = true; if (pt.kind !== 'shade') warnings.push(`The ${pt.name.toLowerCase()} (${Math.round(pt.size[0])} \u00d7 ${Math.round(pt.size[1])} mm) is bigger than your printer.`); }
    }
    const shadeBig = parts.some(p => p.kind === 'shade' && !p.fits);
    if (shadeBig) warnings.push(o.around * o.sections > 1 ? 'Some panels are still bigger than your printer. Split into more panels or make the shade smaller.' : 'The shade is bigger than your printer. Split it into panels or make it smaller.');
    const ang = Math.atan(F.P.maxSlope) * 180 / Math.PI;
    if (ang > 50) warnings.push(`The curve is steep (${Math.round(ang)}\u00b0). Print slowly with a brim, or lower the bulge.`);
    const bbO = (() => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let n = 0; n < S.O.length; n += 3) { x0 = Math.min(x0, S.O[n]); x1 = Math.max(x1, S.O[n]); y0 = Math.min(y0, S.O[n + 1]); y1 = Math.max(y1, S.O[n + 1]); } return [x1 - x0, y1 - y0]; })();
    let vol = 0; for (const pt of parts) vol += Math.abs(Core.signedVolume(pt.local)) * (pt.kind === 'shade' || pt.kind === 'insert' ? 1 : 0.35); // the shade at 100% infill, the rest at about 20%
    let tlo = Infinity, thi = 0; for (let j = 0; j < F.NV; j++) if (!F.row[j].rim) for (let i = 0; i < F.NU; i++) { const t = F.Tf[j * F.NU + i]; tlo = Math.min(tlo, t); thi = Math.max(thi, t); }
    const stats = {
      width: bbO[0], depth: bbO[1], height: o.height, pieces: parts.filter(p => p.kind === 'shade').length, parts: parts.length,
      grams: Math.round(vol / 1000 * 1.24), tris: parts.reduce((s, p) => s + p.local.length / 9, 0), cell: F.cell, NU: F.NU, NV: F.NV,
      tMin: tlo, tMax: thi, overhang: ang, corners: F.Sec.fixes, photoW: F.regionW, photoH: F.photoH, shaped: !isPlainCylinder(o),
      lamp: lampOn ? o.lamp : 'none', totalH: z0 + o.height, stand: standInfo, footW: standInfo ? 2 * standInfo.footR : 0, inserts: parts.filter(p => p.kind === 'insert').length
    };
    const filaments = []; for (const p of parts) if (!filaments.some(f => f.color === p.color)) filaments.push({ color: p.color, role: p.name });
    return { options: o, parts, stats, warnings, filaments, tooBig, shadeBig, field: F, skins: S, z0, fixture, insert, light: fixture ? fixture.light : [0, 0, z0 + o.height * 0.42] };
  }

  // ---------------------------------------------------------------- export
  function gateInfo(o) { o = options(o); const shaped = !isPlainCylinder(o), k = matchPreset(o); return { shaped, shapeLabel: shaped ? (PRESETS[k] ? PRESETS[k].label.toLowerCase() : 'custom-shaped') : '' }; }
  function arrangePlates(res) {
    const U = usable(res.options);
    return PL.arrange(res.parts.map(pt => ({ name: pt.name, p: pt.local, color: pt.color })), U.w, U.d, { gap: 6, maxZ: U.z });
  }
  function export3MF(res, o) {
    o = o || {};
    const cols = []; res.parts.forEach(pt => { const c = (pt.color || '#888').toUpperCase(); if (!cols.includes(c)) cols.push(c); });
    const ext = c => cols.indexOf((c || '').toUpperCase()) + 1;
    const A = arrangePlates(res), objs = [], plates = [];
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push({ name: it.name, p: it.p, color: it.color, extruder: ext(it.color) }); }); plates.push(ids); });
    A.unfit.forEach(u => { plates.push([objs.length]); objs.push({ name: u.name, p: PL.normalize(u.p), color: u.color, extruder: ext(u.color) }); });
    return T.threeMF(objs, { title: o.name || 'Lamp generator', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notes(res) {
    const o = res.options, st = res.stats, f = v => String(Math.round(v)), L = [];
    L.push('Expressarte lithophane lampshade', '');
    L.push(`Shade: ${f(st.width)} mm wide, ${f(o.height)} mm tall. Wall ${o.tMin}-${o.tMax} mm (dark = thick, light = thin), rims ${o.rimT} mm.`);
    if (st.pieces > 1) L.push(`Split into ${st.pieces} pieces (${o.around} around${o.sections > 1 ? `, ${o.sections} high` : ''}). Glue the edges with CA glue or epoxy; the letters name the height section from the bottom, the numbers go around.`);
    L.push('', 'Parts');
    res.parts.forEach(p => L.push(`  ${p.name}: ${f(p.size[0])} x ${f(p.size[1])} x ${f(p.size[2])} mm`));
    L.push('', 'Printing',
      '  - Print the shade in white PLA, upright as exported (the same orientation as vase mode), with no supports.',
      '  - Use 100% infill, or enough walls to fill the thickest part, so the light passes evenly. A brim helps it stay put.',
      '  - Layers of 0.12-0.16 mm and a slower outer wall give the smoothest photo.',
      '  - The relief is on the ' + (o.relief === 'inside' ? 'inside, so the outside stays smooth.' : 'outside.'));
    const ins = res.parts.filter(p => p.kind === 'insert');
    if (ins.length && res.insert) {
      const it = res.insert, nm = c => { const q = INSERT_PALETTE.find(x => x.hex === c); return q ? q.name.toLowerCase() : c; };
      L.push(`  - Color inserts (${ins.length}: ${ins.map(p => nm(p.color)).join(', ')}): print in translucent PLA or PETG, upside down as exported (the flange and the two ears on the bed), with no supports. A ${it.wall} mm wall is one or two lines with a 0.4 mm nozzle; 2 walls, 0% infill and no top layers, or a single-wall (vase-like) wall with a ${it.wall} mm line, both work.`,
        `  - Each insert is ${f(it.zL - it.zBot + it.ledgeH)} mm tall with ${it.clear} mm of clearance per side. It drops in through the top and its flange sits in the ${it.ledgeH} mm ledge, flush with the top edge. Pinch the two ears to lift it out and drop in another color.`);
    }
    if (o.pendant) L.push(`  - The pendant cap prints flat as exported (the grooved top on the bed), no supports. Its hole is ${f(o.fitterD)} mm for an ${FITTERS[o.fitter].socket.toUpperCase()} pendant socket: the socket goes through from above and its shade ring screws on underneath. Use a pendant cord set with a ceiling canopy and an LED bulb only.`);
    else if (res.parts.some(p => p.kind === 'fitter')) L.push(`  - The spider fitter prints flat as exported. Its hole is ${f(o.fitterD)} mm: measure your harp stud or socket ring and change it if needed.`);
    const lamp = res.parts.find(p => p.kind === 'lamp');
    const sd = res.stats.stand;
    if (lamp && sd && sd.table) {
      L.push(`  - The hub prints upside down as exported (the flange and plug on the bed), with 20% infill and no supports. It hides inside the shade's bottom edge.`);
      if (sd.mode === 'dowel') L.push(`  - Legs: ${sd.legs} wooden dowels, ${f(sd.legD * 10) / 10} mm thick, each cut ${f(sd.dowelLen)} mm long. The ${sd.legs} cap feet print upright as exported. Push the dowels into the hub's sockets and the feet (a drop of glue makes it permanent).`);
      else L.push(`  - Legs: ${sd.legs} printed rods, ${f(sd.legD)} mm thick and about ${f(sd.legLen)} mm long, printed lying on a flat side as exported (3 walls). Push them into the hub's sockets.`);
      L.push('', 'Lamp hardware');
      const m = o.mount;
      if (m === 'e26' || m === 'e12') L.push(`  - An ${m.toUpperCase()} lamp socket with a threaded shade ring (body about ${f(o.socketD)} mm): it goes through the hub's 3 mm plate and the ring screws down on top. LED bulbs only.`, '  - A lamp cord with a plug and an inline switch, wired to the socket (follow the socket maker\'s instructions; ask an electrician if unsure).');
      else if (m === 'tealight') L.push(`  - A battery LED tea light or LED candle up to ${f(o.lightD || 38.5)} mm wide. Never use a real flame.`);
      else if (m === 'usb') L.push(`  - A USB-C LED board or disc up to ${f(o.lightD || 32)} mm wide.`);
      else L.push(`  - A battery or USB LED puck light up to ${f(o.lightD || 70)} mm wide (60, 70 and 80 mm are common).`);
      if (o.cable !== 'none') L.push('  - The cord drops straight down through the hole in the middle of the hub.');
    } else if (lamp && sd) {
      L.push(`  - The light stand (${f(o.lampH)} mm tall, ${sd.legs} legs, ${f(res.stats.footW)} mm across the feet): the ring prints as exported, flat side down; the legs print lying on their side as exported, with 3 walls and 20% infill, no supports.`);
      if (sd.split) L.push('  - The legs are taller than your printer, so each one is split in two. Push the tenon into the slot and drive an M3 x 16 mm screw through the cross hole (or glue it).');
      L.push('', 'Stand assembly', '  - Slide each leg\'s top tongue up into its slot under the ring until it stops; the ring rests on the tongues.');
      if (sd.joint === 'screw') L.push(`  - Lock each leg with an M3 x ${STAND.screwLen} mm screw through the leg into the outer rim (the head sits in the counterbore).`);
      else L.push('  - Each leg clicks in with a small snap ridge. Add a drop of glue if you want it permanent.');
      if (o.cable !== 'none') L.push('  - The cord drops through the hub, runs in the channel under the spoke above leg 1, then down the groove in leg 1.');
      L.push('', 'Lamp hardware');
      const m = o.mount;
      if (m === 'e26' || m === 'e12') L.push(`  - An ${m.toUpperCase()} lamp socket with a threaded shade ring (body about ${f(o.socketD)} mm): it goes through the hub's 3 mm plate and the ring screws down on top. LED bulbs only.`, '  - A lamp cord with a plug and an inline switch, wired to the socket (follow the socket maker\'s instructions; ask an electrician if unsure).');
      else if (m === 'tealight') L.push(`  - A battery LED tea light or LED candle up to ${f(o.lightD || 38.5)} mm wide. Never use a real flame.`);
      else if (m === 'usb') L.push(`  - A USB-C LED board or disc up to ${f(o.lightD || 32)} mm wide.`);
      else L.push(`  - A battery or USB LED puck light up to ${f(o.lightD || 70)} mm wide (60, 70 and 80 mm are common).`);
      if (o.feet) L.push(`  - ${sd.legs} small felt or rubber pads, up to ${f(Math.min(o.feetD, 12))} mm, under the feet.`);
    } else if (lamp) {
      L.push(`  - The lamp base (${LAMPS[o.lamp].label.toLowerCase()}, ${f(o.lampH)} mm tall) prints ${lamp.flipped ? 'upside down, its plate on the bed, as exported' : 'as exported, flat side down'}, in any color, with 15-20% infill and no supports.`);
      if (res.parts.some(p => p.kind === 'riser')) L.push('  - The socket riser prints upright as exported.');
      L.push('', 'Lamp hardware');
      const m = o.mount;
      if (m === 'e26' || m === 'e12') {
        const len = Math.round(o.lampH + (o.socketRise || 0) + 12);
        L.push(`  - An ${m.toUpperCase()} lamp socket (body about ${f(o.socketD)} mm; the cup is ${f(o.socketD + 0.8)} mm) and an LED bulb only (${m === 'e26' ? 'A19 or smaller' : 'a small candle bulb'}).`,
          `  - 1/8 IPS threaded lamp pipe about ${len} mm long (the hole is ${PIPE_HOLE} mm), with a hex nut in the recess underneath. The socket cap screws onto the pipe.`,
          '  - A lamp cord with a plug and an inline switch, threaded up the pipe and wired to the socket (follow the socket maker\'s instructions; ask an electrician if unsure).');
      } else if (m === 'strip') L.push(`  - A short LED strip (up to 10 mm wide) or an LED ring laid in the ${f(2 * (res.field.stripR || 30))} mm channel; its wire drops through the hole at the back of the channel.`);
      else if (m === 'tealight') L.push(`  - A battery LED tea light or LED candle up to ${f(o.lightD || 38.5)} mm wide. Never use a real flame.`);
      else if (m === 'usb') L.push(`  - A USB-C LED board or disc up to ${f(o.lightD || 32)} mm wide, powered through the USB-C port.`);
      else L.push(`  - A battery or USB LED puck light up to ${f(o.lightD || 70)} mm wide (60, 70 and 80 mm are common).`);
      if (o.cable === 'usbc' && o.lamp !== 'tripod') L.push('  - A small USB-C breakout board (up to 15 x 24 mm) in the pocket behind the port slot, glued in place.');
      else if (o.cable === 'notch' && o.lamp !== 'tripod') L.push('  - The cable runs through the channel underneath and out the back.');
      if (o.switchHole === 'push') L.push('  - A 12 mm panel-mount push switch in the side hole.');
      if (o.switchHole === 'rocker') L.push('  - A small rocker switch (19 x 13 mm cutout) in the side hole.');
      if (o.feet) L.push(`  - ${o.lamp === 'tripod' ? 3 : 4} felt or rubber pads, ${f(o.feetD)} mm, in the recesses underneath.`);
    }
    if (o.pattern !== 'photo') L.push(`  - Wall: ${PATTERNS[o.pattern].toLowerCase()}${o.pattern === 'plain' ? ` (${o.plainT} mm)` : `, ${o.tMin}-${o.tMax} mm`}.`);
    if (o.texture !== 'none' && o.textureDepth > 0) L.push(`  - Surface texture: ${TEXTURES[o.texture].toLowerCase()}, ${o.textureDepth} mm deep.`);
    L.push('', 'Using it', '  - Use LED bulbs or LED puck lights only. Never use a flame or a hot incandescent bulb.', o.pattern === 'photo' ? '  - The photo shows when the lamp is lit from inside.' : '  - The pattern glows when the lamp is lit from inside.');
    (res.warnings || []).forEach(w => L.push('  - ' + w));
    return L.join('\n');
  }
  function files(res, o) {
    o = o || {}; const base = o.fileBase || 'lampshade', out = [];
    const slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    for (const pt of res.parts) out.push({ name: `${base}_${slug(pt.name)}.stl`, data: new Uint8Array(Core.writeSTL(pt.local, pt.name)) });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    out.push({ name: `${base}_NOTES.txt`, data: notes(res) });
    return out;
  }

  const api = { DESIGNER, TEXTURES, PATTERNS, patternMapper, textureOf, designerBase, gridNormals, WAVE_SHAPES, rotAt, waveAt, PRESETS, SECTIONS, FITTERS, LAMPS, MOUNTS, PALETTE, INSERT_PALETTE, INSERT_DEFAULT_COLORS, LEDGE_H, DEFAULTS, SHAPE_KEYS, insertPlan, options, profile, section, region, field, skins, build, suggestSplit, gateInfo, isPlainCylinder, matchPreset, export3MF, files, notes, arrangePlates, sampleScene, photoMapper };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPLampshade = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
