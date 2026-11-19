/* Expressarte form-fit cubbies (backer-exclusive): a tray with a shaped pocket for each item you keep in a drawer
   (tools, pens, makeup, jewelry, hair accessories, rolled clothing...), sized by each item's own measurements.
   Pockets get finger scoops, a colored shadow floor and a colored label; the tray fits a drawer (split into tiles that
   fit the bed) or a 42 mm grid footprint with the grid foot. Optional drop-in lid: patterns and a traced logo inlaid
   flush in up to three colors, a colored label, and printed knobs or pulls. Bambu-ready multi-color 3MF.
   Generic names only, American spelling. Needs Manifold (passed in as M). */
(function (G) {
  'use strict';
  const C = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const T = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  const PL = G.GPPlates || (typeof require === 'function' ? require('./plates.js') : null);
  const BF = G.GPBinFeatures || (typeof require === 'function' ? require('./bin-features.js') : null);
  const ST = () => G.GPStamp || (typeof require === 'function' ? require('./stamp.js') : null);
  const LD = () => G.GPLidDeco || (typeof require === 'function' ? require('./lid-deco.js') : null);
  const PITCH = 42, HU = 7, TAU = Math.PI * 2;
  const FEATURE = 'cubbies', LID_FEATURE = 'cubby-lids';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => { const n = +v; return Number.isFinite(n) && v !== '' && v != null ? n : d; };
  const hex = (v, d) => /^#[0-9a-f]{6}$/i.test(v || '') ? String(v).toUpperCase() : d;
  const P = L => ({ outer: L, holes: [] });
  const tfP = (ps, f) => ps.map(Q => ({ outer: Q.outer.map(f), holes: Q.holes.map(h => h.map(f)) }));

  // ------------------------------------------------------------------ 2D shapes (mm, centered, long axis along x)
  const circ = (cx, cy, r, n) => { const L = []; n = n || Math.max(24, Math.min(72, Math.round(r * 3))); for (let i = 0; i < n; i++) { const t = TAU * i / n; L.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return L; };
  function rrect(cx, cy, w, h, r) {
    r = clamp(r || 0, 0, Math.min(w, h) / 2 - 0.01); const L = [], x0 = cx - w / 2 + r, x1 = cx + w / 2 - r, y0 = cy - h / 2 + r, y1 = cy + h / 2 - r, n = r > 0.05 ? 8 : 0;
    const arc = (ox, oy, a0) => { if (!n) { L.push([ox + r * Math.cos(a0), oy + r * Math.sin(a0)]); return; } for (let i = 0; i <= n; i++) { const t = a0 + (Math.PI / 2) * i / n; L.push([ox + r * Math.cos(t), oy + r * Math.sin(t)]); } };
    if (!n) return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
    arc(x1, y0, -Math.PI / 2); arc(x1, y1, 0); arc(x0, y1, Math.PI / 2); arc(x0, y0, Math.PI); return L;
  }
  const stadium = (cx, cy, len, w) => rrect(cx, cy, Math.max(len, w), w, w / 2 - 0.01);
  const U = list => T.unionPolys(list.map(L => (L.outer ? L : P(L))));
  // tapered body along x from x0 (width w0) to x1 (width w1), rounded ends
  const taper = (x0, w0, x1, w1) => U([[[x0, -w0 / 2], [x1, -w1 / 2], [x1, w1 / 2], [x0, w0 / 2]], circ(x0, 0, w0 / 2, 24), circ(x1, 0, w1 / 2, 24)]);
  function pliersShape(len, jaw, spread, head) {
    const jl = len * 0.3, hx = -len / 2 + jl, hw = Math.max(jaw * 1.6, head || 0);
    const handle = s => [[hx + 4, s * hw * 0.25], [len / 2 - 6, s * (spread / 2 - 6)], [len / 2, s * (spread / 2)], [len / 2 - 2, s * (spread / 2 - 12)], [hx + 8, s * 2]];
    return U([[[-len / 2, -jaw * 0.35], [hx, -hw / 2], [hx, hw / 2], [-len / 2, jaw * 0.35]], circ(hx, 0, hw / 2, 28), circ(-len / 2 + 2, 0, jaw * 0.35, 12), handle(1), handle(-1), circ(len / 2 - 3, spread / 2 - 6, 6, 16), circ(len / 2 - 3, -(spread / 2 - 6), 6, 16)]);
  }

  // ------------------------------------------------------------------ the item library
  // params: [key, label, default, min, max]. depth(p): default pocket depth. Labels are short and generic.
  const CATS = { tools: 'Tools', writing: 'Pens and markers', beauty: 'Makeup and nails', jewelry: 'Jewelry', hair: 'Hair accessories', clothing: 'Clothing', other: 'Other' };
  const ITEMS = {
    screwdriver: { cat: 'tools', name: 'Screwdriver', label: 'SCREWDRIVER', params: [['len', 'Overall length (mm)', 200, 60, 420], ['handleLen', 'Handle length (mm)', 100, 30, 200], ['handleDia', 'Handle diameter (mm)', 30, 10, 60], ['shaftDia', 'Shaft diameter (mm)', 7, 2, 16]],
      shape: p => U([stadium(-p.len / 2 + p.handleLen / 2, 0, p.handleLen, p.handleDia), rrect(-p.len / 2 + p.handleLen + (p.len - p.handleLen) / 2 - 1, 0, p.len - p.handleLen + 2, p.shaftDia, p.shaftDia / 2 - 0.01)]), depth: p => Math.min(p.handleDia * 0.6, 24) },
    wrench: { cat: 'tools', name: 'Combination wrench', label: '{size} MM', params: [['size', 'Wrench size (mm)', 13, 5, 36], ['len', 'Length (mm)', 170, 80, 450]],
      shape: p => { const hd = p.size * 2.3 + 4, sw = p.size * 0.9 + 5; return U([stadium(0, 0, p.len - hd * 0.6, sw), circ(-p.len / 2 + hd / 2, 0, hd / 2), circ(p.len / 2 - hd / 2, 0, hd * 0.47)]); }, depth: p => clamp(p.size * 0.45 + 4, 6, 18) },
    pliers: { cat: 'tools', name: 'Pliers', label: 'PLIERS', params: [['len', 'Length (mm)', 200, 90, 350], ['jaw', 'Jaw width (mm)', 18, 6, 40], ['spread', 'Handle spread (mm)', 55, 25, 110]],
      shape: p => pliersShape(p.len, p.jaw, p.spread), depth: () => 16 },
    cutters: { cat: 'tools', name: 'Cutters / clippers', label: 'CUTTERS', params: [['len', 'Length (mm)', 130, 60, 260], ['jaw', 'Jaw width (mm)', 12, 4, 30], ['spread', 'Handle spread (mm)', 45, 20, 90]],
      shape: p => pliersShape(p.len, p.jaw, p.spread), depth: () => 14 },
    scissors: { cat: 'tools', name: 'Scissors', label: 'SCISSORS', params: [['len', 'Length (mm)', 200, 90, 300], ['loops', 'Handle width (mm)', 80, 40, 120]],
      shape: p => { const r = p.loops / 4.2, bx = p.len / 2 - r * 1.1; return U([taper(-p.len / 2 + 3, 6, bx - r, 22), circ(bx, r * 0.95, r), circ(bx, -r * 0.95, r)]); }, depth: () => 12 },
    hexkeys: { cat: 'tools', name: 'Hex key set', label: 'HEX KEYS', params: [['len', 'Length (mm)', 110, 50, 250], ['wid', 'Width (mm)', 40, 15, 90]], shape: p => U([rrect(0, 0, p.len, p.wid, 6)]), depth: () => 10 },
    tape: { cat: 'tools', name: 'Tape measure', label: 'TAPE', params: [['size', 'Width (mm)', 70, 40, 110], ['thick', 'Thickness (mm)', 40, 20, 70]], shape: p => U([rrect(0, 0, p.size, p.thick, 8)]), depth: p => clamp(p.size * 0.45, 12, 40) },
    knife: { cat: 'tools', name: 'Utility knife', label: 'KNIFE', params: [['len', 'Length (mm)', 160, 90, 240], ['wid', 'Width (mm)', 30, 15, 50]], shape: p => U([stadium(0, 0, p.len, p.wid)]), depth: () => 14 },
    pen: { cat: 'writing', name: 'Pen', label: 'PEN', params: [['len', 'Length (mm)', 145, 90, 200], ['dia', 'Diameter (mm)', 11, 6, 20]], shape: p => U([stadium(0, 0, p.len, p.dia)]), depth: p => p.dia * 0.7 },
    marker: { cat: 'writing', name: 'Marker', label: 'MARKER', params: [['len', 'Length (mm)', 140, 90, 200], ['dia', 'Diameter (mm)', 19, 10, 32]], shape: p => U([stadium(0, 0, p.len, p.dia)]), depth: p => p.dia * 0.65 },
    pencil: { cat: 'writing', name: 'Pencil', label: 'PENCIL', params: [['len', 'Length (mm)', 190, 60, 200], ['dia', 'Diameter (mm)', 8, 6, 14]], shape: p => U([stadium(0, 0, p.len, p.dia)]), depth: p => p.dia * 0.75 },
    highlighter: { cat: 'writing', name: 'Highlighter', label: 'HIGHLIGHTER', params: [['len', 'Length (mm)', 125, 80, 170], ['wid', 'Width (mm)', 22, 12, 32]], shape: p => U([rrect(0, 0, p.len, p.wid, 7)]), depth: p => p.wid * 0.6 },
    lipstick: { cat: 'beauty', name: 'Lipstick', label: 'LIPSTICK', params: [['dia', 'Diameter (mm)', 23, 12, 35], ['deep', 'Pocket depth (mm)', 40, 10, 80]], shape: p => U([circ(0, 0, p.dia / 2)]), depth: p => p.deep, upright: true },
    polish: { cat: 'beauty', name: 'Nail polish', label: 'POLISH', params: [['dia', 'Bottle width (mm)', 36, 20, 60], ['deep', 'Pocket depth (mm)', 25, 10, 60]], shape: p => U([rrect(0, 0, p.dia, p.dia, p.dia * 0.3)]), depth: p => p.deep, upright: true },
    brush: { cat: 'beauty', name: 'Makeup brush', label: 'BRUSH', params: [['len', 'Length (mm)', 175, 90, 260], ['handleDia', 'Handle diameter (mm)', 12, 6, 24], ['head', 'Bristle width (mm)', 30, 8, 60]],
      shape: p => U([stadium(p.len * 0.18, 0, p.len * 0.64, p.handleDia), taper(-p.len / 2 + p.head / 2, p.head, -p.len * 0.12, p.handleDia + 2)]), depth: p => clamp(p.head * 0.55, 8, 26) },
    mascara: { cat: 'beauty', name: 'Mascara / lip gloss', label: 'MASCARA', params: [['len', 'Length (mm)', 125, 70, 180], ['dia', 'Diameter (mm)', 18, 8, 30]], shape: p => U([stadium(0, 0, p.len, p.dia)]), depth: p => p.dia * 0.7 },
    eyeliner: { cat: 'beauty', name: 'Eyeliner pencil', label: 'LINER', params: [['len', 'Length (mm)', 150, 80, 200], ['dia', 'Diameter (mm)', 10, 6, 16]], shape: p => U([stadium(0, 0, p.len, p.dia)]), depth: p => p.dia * 0.75 },
    compact: { cat: 'beauty', name: 'Compact / palette', label: 'COMPACT', params: [['w', 'Width (mm)', 75, 30, 220], ['d', 'Depth (mm)', 75, 30, 160], ['round', 'Corner radius (mm)', 37, 0, 80], ['deep', 'Pocket depth (mm)', 14, 5, 40]],
      shape: p => U([rrect(0, 0, p.w, p.d, Math.min(p.round, Math.min(p.w, p.d) / 2))]), depth: p => p.deep },
    bottle: { cat: 'beauty', name: 'Bottle / jar', label: 'BOTTLE', params: [['w', 'Width (mm)', 45, 15, 120], ['d', 'Depth (mm)', 35, 15, 120], ['deep', 'Pocket depth (mm)', 30, 10, 90]], shape: p => U([rrect(0, 0, p.w, p.d, Math.min(p.w, p.d) * 0.3)]), depth: p => p.deep, upright: true },
    rings: { cat: 'jewelry', name: 'Ring slots', label: 'RINGS', params: [['count', 'Rings', 8, 2, 20], ['wid', 'Slot length (mm)', 24, 15, 40], ['gap', 'Slot width (mm)', 4, 2.5, 8]],
      shape: p => { const pitch = Math.max(p.gap + 9, 12), L = []; for (let i = 0; i < p.count; i++) L.push(stadium((i - (p.count - 1) / 2) * pitch, 0, p.gap, p.wid).map(([x, y]) => [x, y]) ); return U(L.map(Lp => Lp.map(([x, y]) => [x, y]))).length ? T.unionPolys(L.map(Lp => P(rrect(0, 0, 1, 1, 0).length ? Lp : Lp))).map(Q => ({ outer: Q.outer.map(([x, y]) => [y, x]), holes: Q.holes })) : []; }, depth: () => 16 },
    earrings: { cat: 'jewelry', name: 'Earring cups', label: 'EARRINGS', params: [['cols', 'Across', 4, 1, 12], ['rows', 'Rows', 2, 1, 8], ['cup', 'Cup size (mm)', 14, 8, 30]],
      shape: p => { const L = [], s = p.cup + 4; for (let j = 0; j < p.rows; j++) for (let i = 0; i < p.cols; i++) L.push(rrect((i - (p.cols - 1) / 2) * s, (j - (p.rows - 1) / 2) * s, p.cup, p.cup, p.cup * 0.35)); return U(L); }, depth: () => 8 },
    necklace: { cat: 'jewelry', name: 'Necklace channel', label: 'NECKLACE', params: [['len', 'Length (mm)', 200, 80, 400], ['wid', 'Width (mm)', 14, 8, 40]], shape: p => U([stadium(0, 0, p.len, p.wid), circ(-p.len / 2 + p.wid, 0, p.wid * 0.9)]), depth: () => 10 },
    bracelet: { cat: 'jewelry', name: 'Bracelet / watch', label: 'WATCH', params: [['w', 'Width (mm)', 75, 30, 120], ['d', 'Depth (mm)', 60, 25, 120]], shape: p => U([rrect(0, 0, p.w, p.d, Math.min(p.w, p.d) * 0.45)]), depth: () => 22 },
    scrunchie: { cat: 'hair', name: 'Scrunchie', label: 'SCRUNCHIES', params: [['dia', 'Diameter (mm)', 85, 40, 140], ['deep', 'Pocket depth (mm)', 30, 10, 80]], shape: p => U([circ(0, 0, p.dia / 2)]), depth: p => p.deep, upright: true },
    hairties: { cat: 'hair', name: 'Hair ties', label: 'HAIR TIES', params: [['dia', 'Diameter (mm)', 45, 25, 80], ['deep', 'Pocket depth (mm)', 20, 8, 60]], shape: p => U([circ(0, 0, p.dia / 2)]), depth: p => p.deep, upright: true },
    clawclip: { cat: 'hair', name: 'Claw clip', label: 'CLIPS', params: [['len', 'Length (mm)', 90, 40, 140], ['wid', 'Width (mm)', 45, 20, 80]], shape: p => U([rrect(0, 0, p.len, p.wid, p.wid * 0.35)]), depth: () => 28 },
    bobbypins: { cat: 'hair', name: 'Bobby pins', label: 'PINS', params: [['len', 'Length (mm)', 60, 30, 90], ['wid', 'Width (mm)', 22, 10, 50]], shape: p => U([rrect(0, 0, p.len, p.wid, 5)]), depth: () => 8 },
    headband: { cat: 'hair', name: 'Headband', label: 'HEADBANDS', params: [['len', 'Length (mm)', 150, 90, 220], ['wid', 'Width (mm)', 45, 20, 80]], shape: p => U([rrect(0, 0, p.len, p.wid, p.wid * 0.45)]), depth: () => 24 },
    shirt: { cat: 'clothing', name: 'Folded shirt', label: 'SHIRTS', params: [['w', 'Folded width (mm)', 240, 120, 400], ['d', 'Folded depth (mm)', 190, 100, 350]], shape: p => U([rrect(0, 0, p.w, p.d, 12)]), depth: () => 60, upright: true },
    socks: { cat: 'clothing', name: 'Rolled socks', label: 'SOCKS', params: [['dia', 'Roll size (mm)', 70, 40, 120]], shape: p => U([rrect(0, 0, p.dia, p.dia, 10)]), depth: () => 60, upright: true },
    underwear: { cat: 'clothing', name: 'Rolled underwear', label: 'UNDERWEAR', params: [['w', 'Width (mm)', 95, 50, 160], ['d', 'Depth (mm)', 120, 60, 200]], shape: p => U([rrect(0, 0, p.w, p.d, 14)]), depth: () => 60, upright: true },
    belt: { cat: 'clothing', name: 'Rolled belt', label: 'BELT', params: [['dia', 'Roll diameter (mm)', 95, 50, 150], ['buckle', 'Buckle width (mm)', 55, 25, 90]], shape: p => U([circ(0, 0, p.dia / 2), rrect(0, -p.dia / 2 + 6, p.buckle, 24, 6)]), depth: () => 45, upright: true },
    tie: { cat: 'clothing', name: 'Rolled tie', label: 'TIE', params: [['dia', 'Roll diameter (mm)', 65, 40, 100]], shape: p => U([circ(0, 0, p.dia / 2)]), depth: () => 50, upright: true },
    phone: { cat: 'other', name: 'Phone / remote', label: 'PHONE', params: [['len', 'Length (mm)', 160, 80, 260], ['wid', 'Width (mm)', 78, 30, 110], ['deep', 'Pocket depth (mm)', 9, 4, 30]], shape: p => U([rrect(0, 0, p.len, p.wid, 10)]), depth: p => p.deep },
    batteries: { cat: 'other', name: 'Batteries (AA)', label: 'AA', params: [['count', 'How many', 8, 1, 24], ['dia', 'Diameter (mm)', 14.5, 9, 34]], shape: p => { const L = []; const s = p.dia + 2; for (let i = 0; i < p.count; i++) L.push(circ((i - (p.count - 1) / 2) * s, 0, p.dia / 2 + 0.3, 28)); return U(L); }, depth: () => 30, upright: true },
    custom: { cat: 'other', name: 'Custom rectangle', label: '', params: [['w', 'Width (mm)', 80, 10, 400], ['d', 'Depth (mm)', 40, 10, 400], ['round', 'Corner radius (mm)', 6, 0, 60], ['deep', 'Pocket depth (mm)', 15, 3, 100]], shape: p => U([rrect(0, 0, p.w, p.d, p.round)]), depth: p => p.deep },
    customRound: { cat: 'other', name: 'Custom circle', label: '', params: [['dia', 'Diameter (mm)', 50, 8, 300], ['deep', 'Pocket depth (mm)', 15, 3, 100]], shape: p => U([circ(0, 0, p.dia / 2)]), depth: p => p.deep }
  };
  // rings: slots across a bar (rebuilt here so the shape stays a plain union of stadiums)
  ITEMS.rings.shape = p => { const pitch = Math.max(p.gap + 9, 12), L = []; for (let i = 0; i < p.count; i++) L.push(rrect((i - (p.count - 1) / 2) * pitch, 0, p.gap, p.wid, p.gap / 2 - 0.01)); return U(L); };

  const PRESETS = {
    toolDrawer: { label: 'Tool drawer', mode: 'drawer', w: 420, d: 300, h: 36, items: [['screwdriver', {}], ['screwdriver', { len: 160, handleLen: 85, handleDia: 26, shaftDia: 5 }], ['pliers', {}], ['cutters', {}], ['wrench', { size: 10, len: 140 }], ['wrench', { size: 13 }], ['wrench', { size: 17, len: 215 }], ['tape', {}]] },
    desk: { label: 'Desk drawer', mode: 'drawer', w: 360, d: 240, h: 24, items: [['pen', {}], ['pen', {}], ['marker', {}], ['marker', {}], ['pencil', {}], ['highlighter', {}], ['scissors', { len: 170, loops: 70 }]] },
    vanity: { label: 'Makeup drawer', mode: 'drawer', w: 360, d: 260, h: 46, items: [['lipstick', {}], ['lipstick', {}], ['lipstick', {}], ['polish', {}], ['polish', {}], ['brush', {}], ['brush', { len: 150, head: 22 }], ['mascara', {}], ['eyeliner', {}], ['compact', {}]] },
    jewelry: { label: 'Jewelry tray', mode: 'drawer', w: 240, d: 200, h: 28, items: [['rings', {}], ['earrings', {}], ['necklace', {}], ['bracelet', {}]] },
    hair: { label: 'Hair accessories', mode: 'grid', nx: 5, ny: 5, hu: 6, items: [['scrunchie', {}], ['hairties', {}], ['clawclip', {}], ['bobbypins', {}]] },
    closet: { label: 'Socks, belts and ties', mode: 'drawer', w: 420, d: 320, h: 66, items: [['belt', {}], ['belt', {}], ['tie', {}], ['tie', {}], ['tie', {}], ['socks', {}], ['socks', {}], ['socks', {}], ['socks', {}]] },
    bits: { label: 'Pens in a grid bin', mode: 'grid', nx: 4, ny: 4, hu: 4, items: [['pen', {}], ['pen', {}], ['pen', {}], ['pencil', { len: 120 }]] }
  };
  const PATTERNS = { none: 'Plain', stripes: 'Diagonal stripes', chevron: 'Chevron', dots: 'Polka dots', duo: 'Two-color dots', checker: 'Checkerboard', hex: 'Honeycomb', waves: 'Waves', diamonds: 'Diamonds', triangles: 'Triangles', scales: 'Scales', plaid: 'Plaid (two colors)', terrazzo: 'Terrazzo (two colors)', confetti: 'Confetti (two colors)', sunburst: 'Sunburst', grid: 'Grid lines' };
  const KNOBS = { round: 'Round knob', mushroom: 'Mushroom knob', square: 'Square knob', tbar: 'T-bar knob', bar: 'Bar pull', arch: 'Arch pull', notch: 'Finger notch (no knob)' };
  const LABEL_STYLES = { inlay: 'Color inlay (flush)', raised: 'Color, raised', none: 'No labels' };
  const FONTS = { block: 'Block', slab: 'Slab', round: 'Round', chunky: 'Chunky' };
  const PALETTE = [
    { name: 'Forest green', hex: '#2F6B4F' }, { name: 'Mint', hex: '#8FD3B6' }, { name: 'White', hex: '#F2F2EE' }, { name: 'Charcoal', hex: '#2B2D31' }, { name: 'Black', hex: '#141414' },
    { name: 'Light gray', hex: '#B9BCC0' }, { name: 'Blush pink', hex: '#F2B8C6' }, { name: 'Rose', hex: '#D9577A' }, { name: 'Lavender', hex: '#A894D6' }, { name: 'Ocean blue', hex: '#2E5FA8' },
    { name: 'Sky blue', hex: '#8EC5EA' }, { name: 'Signal red', hex: '#C8352E' }, { name: 'Orange', hex: '#E8812F' }, { name: 'Sunflower', hex: '#F2C230' }, { name: 'Gold', hex: '#C9A227' }, { name: 'Walnut', hex: '#6B4A2F' }
  ];
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    mode: 'drawer', w: 420, d: 300, h: 30, nx: 4, ny: 3, hu: 5, clearance: 1, floor: 2, gap: 6, margin: 6, scoops: true, shadow: true, labels: 'inlay', font: 'block', labelSize: 6,
    trayColor: PZ.sage, shadowColor: PZ.mint, labelColor: PZ.cream,
    lid: false, lidT: 2.4, lidPattern: 'stripes', patternScale: 14, lidColor: PZ.cream, patternColor: PZ.sage, patternColor2: PZ.peach, lidLabel: '', lidLabelColor: PZ.ink,
    logo: null, logoSize: 50, logoColor: PZ.ink, logoThreshold: 50, logoInvert: false, knob: 'round', knobs: 1, knobColor: PZ.mint,
    bed: [256, 256, 256], bambu: 'A1'
  };

  // ------------------------------------------------------------------ options
  function normItem(it) {
    it = it || {}; const def = ITEMS[it.type] ? it.type : 'pen', D = ITEMS[def], p = {};
    for (const [k, , d, a, b] of D.params) p[k] = clamp(num((it.p || {})[k] != null ? it.p[k] : it[k], d), a, b);
    if (p.handleLen != null && p.len != null) p.handleLen = Math.min(p.handleLen, p.len - 10);
    const lab = it.label != null ? String(it.label) : D.label.replace('{size}', p.size != null ? String(p.size) : '');
    return { type: def, p, x: num(it.x, NaN), y: num(it.y, NaN), rot: [0, 90, 180, 270].includes(+it.rot) ? +it.rot : 0, label: lab.slice(0, 18), scoop: it.scoop !== false && !D.upright, depth: it.depth != null ? clamp(num(it.depth, 10), 2, 120) : null };
  }
  function options(raw) {
    const o = Object.assign({}, DEFAULTS, raw || {});
    if (o.preset && PRESETS[o.preset] && !raw.items) { const pr = PRESETS[o.preset]; Object.assign(o, { mode: pr.mode, w: pr.w || o.w, d: pr.d || o.d, h: pr.h || o.h, nx: pr.nx || o.nx, ny: pr.ny || o.ny, hu: pr.hu || o.hu }); o.items = pr.items.map(([type, p]) => ({ type, p })); }
    if (!Array.isArray(o.items)) o.items = PRESETS.toolDrawer.items.map(([type, p]) => ({ type, p }));
    o.items = o.items.slice(0, 60).map(normItem);
    o.mode = o.mode === 'grid' ? 'grid' : 'drawer';
    o.nx = Math.round(clamp(num(o.nx, 4), 1, 10)); o.ny = Math.round(clamp(num(o.ny, 3), 1, 10)); o.hu = Math.round(clamp(num(o.hu, 5), 2, 20));
    if (o.mode === 'grid') { o.w = PITCH * o.nx - 0.5; o.d = PITCH * o.ny - 0.5; }
    else { o.w = clamp(num(o.w, 420), 40, 1200); o.d = clamp(num(o.d, 300), 40, 1200); }
    o.h = o.mode === 'grid' ? o.hu * HU : clamp(num(o.h, 30), 8, 140);
    o.clearance = clamp(num(o.clearance, 1), 0.2, 4); o.floor = clamp(num(o.floor, 2), 1, 10); o.gap = clamp(num(o.gap, 6), 2, 30); o.margin = clamp(num(o.margin, 6), 2, 30);
    o.scoops = o.scoops !== false; o.shadow = o.shadow !== false; o.labels = LABEL_STYLES[o.labels] ? o.labels : 'inlay'; o.font = FONTS[o.font] ? o.font : 'block'; o.labelSize = clamp(num(o.labelSize, 6), 3, 14);
    o.lid = !!o.lid; o.lidT = clamp(num(o.lidT, 2.4), 1.8, 4); o.lidPattern = PATTERNS[o.lidPattern] ? o.lidPattern : 'none'; o.patternScale = clamp(num(o.patternScale, 14), 5, 60);
    o.lidLabel = String(o.lidLabel || '').slice(0, 24); o.knob = KNOBS[o.knob] ? o.knob : 'round'; o.knobs = o.knob === 'notch' ? 0 : Math.round(clamp(num(o.knobs, 1), 1, 2));
    o.logoSize = clamp(num(o.logoSize, 50), 10, 400); o.logoThreshold = clamp(num(o.logoThreshold, 50), 1, 99); o.logoInvert = !!o.logoInvert;
    if (o.lid && o.labels === 'raised') o.labels = 'inlay';
    for (const k of ['trayColor', 'shadowColor', 'labelColor', 'lidColor', 'patternColor', 'patternColor2', 'lidLabelColor', 'logoColor', 'knobColor']) o[k] = hex(o[k], DEFAULTS[k]);
    o.bed = Array.isArray(o.bed) ? o.bed.map(Number) : [256, 256, 256];
    return o;
  }
  const usable = o => ({ w: Math.max(50, o.bed[0] - 8), d: Math.max(50, o.bed[1] - 8), z: Math.max(30, o.bed[2] - 4) });
  const rim = o => o.lid ? 2.4 : 0;            // tray rim around the lid recess
  const topZ = o => o.h - (o.lid ? o.lidT + 0.2 : 0);   // where pockets start
  const baseZ = o => o.mode === 'grid' ? BF.GRID.baseH || 5 : 0;

  // ------------------------------------------------------------------ one item: pocket outline, label, footprint
  const rotP = (ps, deg, dx, dy) => { const a = deg * Math.PI / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)); return tfP(ps, ([x, y]) => [x * c - y * s + dx, x * s + y * c + dy]); };
  function labelPolys(o, text, cx, cy, maxW) {
    text = String(text || '').trim(); if (!text || o.labels === 'none') return [];
    const S = ST(); let ps = [];
    try { if (S) ps = S.textBlock([text], o.font, o.labelSize, 0.06, new Set()); } catch (e) { ps = []; }
    if (!ps.length && BF.labelLoops) return BF.labelLoops(text, cx, cy, o.labelSize, maxW);
    if (!ps.length) return [];
    const b = T.polysBBox(ps), k = Math.min(1, maxW / Math.max(1, b.w));
    return tfP(ps, ([x, y]) => [cx + (x - (b.x0 + b.x1) / 2) * k, cy + (y - (b.y0 + b.y1) / 2) * k]);
  }
  function itemGeom(o, it) {
    const D = ITEMS[it.type], raw = D.shape(it.p), pocket = T.offset(raw, o.clearance, true), b = T.polysBBox(pocket);
    const maxDepth = topZ(o) - baseZ(o) - o.floor - (o.shadow ? 0.6 : 0);
    const depth = clamp(it.depth != null ? it.depth : D.depth(it.p), 2, Math.max(2, maxDepth));
    const lab = labelPolys(o, it.label, (b.x0 + b.x1) / 2, b.y0 - 2.2 - o.labelSize / 2, Math.max(16, b.w - 4));
    const lb = lab.length ? T.polysBBox(lab) : null;
    const scoopR = it.scoop && o.scoops ? clamp(Math.min(b.h * 0.55, 13), 7, 13) : 0;
    const x0 = Math.min(b.x0, lb ? lb.x0 : 1e9), x1 = Math.max(b.x1, lb ? lb.x1 : -1e9), y0 = Math.min(b.y0, lb ? lb.y0 : 1e9) - (scoopR ? 0 : 0), y1 = b.y1 + (scoopR ? scoopR * 0.5 : 0);
    return { pocket, label: lab, depth, scoopR, bb: { x0, x1, y0: Math.min(y0, b.y0 - scoopR * 0.5), y1 }, pb: b, wantDepth: it.depth != null ? it.depth : D.depth(it.p) };
  }
  const footprint = (g, rot) => { const w = g.bb.x1 - g.bb.x0, h = g.bb.y1 - g.bb.y0; return rot % 180 ? { w: h, h: w } : { w, h }; };

  // Shelf packing inside the usable top area; returns items with x, y (center of the footprint box) and rot.
  function autoArrange(raw) {
    const o = options(raw), inset = o.margin + rim(o), W = o.w - 2 * inset, H = o.d - 2 * inset;
    const gs = o.items.map(it => itemGeom(o, it));
    const tryPack = pref => {
      const rots = gs.map(g => { const f0 = footprint(g, 0); let r = pref === 'tall' ? (f0.w > f0.h ? 90 : 0) : (f0.h > f0.w ? 90 : 0); const f = footprint(g, r); if (f.w > W && footprint(g, (r + 90) % 180).w <= W) r = (r + 90) % 180; return r; });
      const order = o.items.map((it, i) => i).sort((a, b) => { const fa = footprint(gs[a], rots[a]), fb = footprint(gs[b], rots[b]); return fb.h - fa.h || fb.w - fa.w; });
      const out = o.items.map(it => Object.assign({}, it));
      let x = 0, y = 0, rowH = 0, over = 0, used = 0;
      for (const i of order) {
        const rot = rots[i], f = footprint(gs[i], rot);
        if (x > 0 && x + f.w > W) { x = 0; y += rowH + o.gap; rowH = 0; }
        if (y + f.h > H + 0.01 || f.w > W + 0.01) over++;
        const g = gs[i], cxL = (g.bb.x0 + g.bb.x1) / 2, cyL = (g.bb.y0 + g.bb.y1) / 2;
        const fx = inset + x + f.w / 2, fy = o.d - inset - y - f.h / 2;   // first row at the back
        const a = rot * Math.PI / 180, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a));
        out[i].x = +(fx - (cxL * c - cyL * sn)).toFixed(2); out[i].y = +(fy - (cxL * sn + cyL * c)).toFixed(2); out[i].rot = rot;
        x += f.w + o.gap; rowH = Math.max(rowH, f.h); used = Math.max(used, y + rowH);
      }
      return { items: out, over, used };
    };
    const a = tryPack('wide'), b = tryPack('tall');
    return (b.over < a.over || (b.over === a.over && b.used < a.used - 0.5)) ? b : a;
  }

  // ------------------------------------------------------------------ Manifold helpers
  function man(M, p) { const { V, F } = C.weld(p), mm = new M.Mesh({ numProp: 3, vertProperties: Float32Array.from(V), triVerts: Uint32Array.from(F) }); mm.merge(); return new M.Manifold(mm); }
  function soup(m) { const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float64Array(F.length * 3); for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; } return p; }
  // Extrude outlines to a solid. Shapes that touch at a corner (checkerboard, plaid) are not one manifold soup, so on
  // failure each outline is extruded on its own (shrunk 0.02 mm if needed) and the solids are unioned.
  function ext(M, polys, z0, z1) {
    if (!polys.length) return null;
    if (M.CrossSection) {   // Manifold's own 2D extrude: robust for outlines with many holes (plaid, grid lines)
      try {
        const cs = new M.CrossSection(polys.flatMap(Q => [Q.outer, ...Q.holes]), 'EvenOdd'), m = cs.extrude(z1 - z0).translate([0, 0, z0]); cs.delete();
        if (!m.isEmpty()) return m; m.delete();
      } catch (e) { /* fall through */ }
    }
    try { return man(M, T.extrude(polys, 2, z0, z1)); } catch (e) { /* fall through */ }
    const list = [];
    for (const Q of polys) {
      try { list.push(man(M, T.extrude([Q], 2, z0, z1))); continue; } catch (e) { /* shrink */ }
      for (const R of T.offset([Q], -0.02, false)) { try { list.push(man(M, T.extrude([R], 2, z0, z1))); } catch (e) { /* drop a sliver */ } }
    }
    if (!list.length) return null;
    return list.length === 1 ? list[0] : (() => { const u = M.Manifold.union(list); list.forEach(x => x.delete()); return u; })();
  }
  const unionAll = (M, list) => { list = list.filter(Boolean); if (!list.length) return null; if (list.length === 1) return list[0]; const u = M.Manifold.union(list); list.forEach(x => x.delete()); return u; };
  const cut = (M, a, b) => { if (!b) return a; const r = a.subtract(b); a.delete(); b.delete(); return r; };
  const inter2 = (M, a, b) => { const r = a.intersect(b); return r; };
  const boxM = (M, x0, y0, z0, x1, y1, z1) => M.Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0]);
  function cleanSoup(m) { const p = soup(m); m.delete(); return p; }

  // ------------------------------------------------------------------ the tray
  function layout(o) {
    const placed = [];
    let auto = null;
    if (o.items.some(it => !Number.isFinite(it.x) || !Number.isFinite(it.y))) auto = autoArrange(o).items;
    o.items.forEach((it, i) => {
      const g = itemGeom(o, it), x = auto ? auto[i].x : it.x, y = auto ? auto[i].y : it.y, rot = auto ? auto[i].rot : it.rot;
      placed.push({ it: Object.assign({}, it, { x, y, rot }), g, pocket: rotP(g.pocket, rot, x, y), label: rotP(g.label, rot, x, y), box: rotP([P(rrect((g.bb.x0 + g.bb.x1) / 2, (g.bb.y0 + g.bb.y1) / 2, g.bb.x1 - g.bb.x0, g.bb.y1 - g.bb.y0, 0))], rot, x, y) });
    });
    return placed;
  }
  function checkLayout(o, placed) {
    const warnings = [], inset = o.margin + rim(o) - 0.5, area = [P(rrect(o.w / 2, o.d / 2, o.w - 2 * Math.max(1.2, inset), o.d - 2 * Math.max(1.2, inset), 0))];
    let outside = 0, overlaps = 0;
    placed.forEach((q, i) => {
      if (T.polysArea(T.diffPolys(q.pocket, area)) > 1) { outside++; q.outside = true; }
      for (let j = 0; j < i; j++) if (T.polysArea(T.interPolys(T.offset(q.pocket, 0.6, true), placed[j].pocket)) > 1) { overlaps++; q.overlap = placed[j].overlap = true; }
      if (q.g.depth + 0.01 < q.g.wantDepth) warnings.push(`${ITEMS[q.it.type].name}: pocket is ${q.g.depth.toFixed(1)} mm deep (wanted ${q.g.wantDepth.toFixed(0)} mm). Make the tray taller.`);
    });
    if (outside) warnings.push(`${outside} ${outside === 1 ? 'item does' : 'items do'} not fit inside the tray. Press Arrange, make the tray bigger or remove items.`);
    if (overlaps) warnings.push(`${overlaps} ${overlaps === 1 ? 'pocket overlaps' : 'pockets overlap'} another one. Drag them apart or press Arrange.`);
    return warnings;
  }
  function trayOutline(o) { return [P(rrect(o.w / 2, o.d / 2, o.w, o.d, o.mode === 'grid' ? 3.75 : 4))]; }
  function buildTray(o, M, placed) {
    const z0 = baseZ(o), zt = topZ(o), H = o.h, top = trayOutline(o);
    let body = ext(M, top, z0, H);
    if (o.mode === 'grid') { const foot = man(M, BF.gridBaseSolid(o.nx, o.ny, z0 + 0.01)); body = unionAll(M, [body, foot]); }
    const cuts = [];
    if (o.lid) cuts.push(ext(M, T.offset(top, -rim(o), true), zt, H + 1));
    const area = [P(rrect(o.w / 2, o.d / 2, o.w - 2.4, o.d - 2.4, 2))];
    const shadows = [], labels = [];
    for (const q of placed) {
      const pk = T.interPolys(q.pocket, area); if (!pk.length) continue;
      const zb = zt - q.g.depth, sh = o.shadow ? 0.6 : 0;
      cuts.push(ext(M, pk, zb - sh, zt + 1));
      if (sh) shadows.push(ext(M, pk, zb - sh, zb));
      if (q.g.scoopR) {   // finger scoops on both long sides, centered on the pocket
        const r = q.g.scoopR, g = q.g, a = q.it.rot * Math.PI / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
        const cxL = (g.pb.x0 + g.pb.x1) / 2, dz = Math.min(q.g.depth, r);
        for (const yL of [g.pb.y1 - r * 0.25, g.pb.y0 + r * 0.25]) {
          const X = cxL * c - yL * s + q.it.x, Y = cxL * s + yL * c + q.it.y;
          cuts.push(M.Manifold.sphere(1, 32).scale([r, r, Math.max(dz, 2)]).translate([X, Y, zt]));
        }
      }
      if (q.label.length && o.labels !== 'none') {
        const lab = T.interPolys(q.label, area);
        if (lab.length) { if (o.labels === 'inlay') { cuts.push(ext(M, lab, zt - 0.6, zt + 1)); labels.push(ext(M, lab, zt - 0.6, zt)); } else labels.push(ext(M, lab, zt, zt + 0.6)); }
      }
    }
    if (o.lid && o.knob === 'notch') cuts.push(M.Manifold.cylinder(H, 10, 10, 40).translate([o.w / 2, rim(o) * 0.5, zt + 0.01]));
    body = cut(M, body, unionAll(M, cuts));
    let shadow = unionAll(M, shadows), label = unionAll(M, labels);
    // labels raised: keep them off the pockets
    return { body, shadow, label };
  }

  // ------------------------------------------------------------------ the lid (modeled top up: top face at z = t)
  function rngFrom(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function patternPolys(kind, w, d, s) {
    const A = [], B = [], R = Math.hypot(w, d);
    const band = (x0, x1, ang) => { const c = Math.cos(ang), sn = Math.sin(ang), cx = w / 2, cy = d / 2; return P([[x0, -R], [x1, -R], [x1, R], [x0, R]].map(([u, v]) => [cx + u * c - v * sn, cy + u * sn + v * c])); };
    if (kind === 'stripes') for (let u = -R; u < R; u += s) A.push(band(u, u + s * 0.45, Math.PI / 4));
    if (kind === 'grid') { for (let u = -R; u < R; u += s) { A.push(band(u, u + 1.4, 0)); A.push(band(u, u + 1.4, Math.PI / 2)); } }
    if (kind === 'plaid') { for (let u = -R; u < R; u += s * 1.6) { A.push(band(u, u + s * 0.5, 0)); B.push(band(u + s * 0.8, u + s * 0.95, Math.PI / 2)); B.push(band(u + s * 0.8, u + s * 0.95, 0)); A.push(band(u, u + s * 0.5, Math.PI / 2)); } }
    if (kind === 'chevron') for (let y = -s; y < d + s; y += s) { const L = []; for (let x = -s; x <= w + s; x += s) L.push([x, y + ((Math.round(x / s) % 2 + 2) % 2) * s * 0.5]); const top = L.map(([x, yy]) => [x, yy + s * 0.32]).reverse(); A.push(P(L.concat(top))); }
    if (kind === 'waves') for (let y = -s; y < d + s; y += s) { const L = []; for (let x = -2; x <= w + 2; x += 2) L.push([x, y + Math.sin(x / s * Math.PI) * s * 0.25]); const top = L.map(([x, yy]) => [x, yy + s * 0.35]).reverse(); A.push(P(L.concat(top))); }
    if (kind === 'dots' || kind === 'duo') for (let j = 0, y = s / 2; y < d + s; y += s * 0.866, j++) for (let x = (j % 2) * s / 2; x < w + s; x += s) (kind === 'duo' && (Math.round(x / s) + j) % 2 ? B : A).push(P(circ(x, y, s * 0.28, 24)));
    if (kind === 'checker') for (let j = 0; j * s < d; j++) for (let i = 0; i * s < w; i++) if ((i + j) % 2) A.push(P(rrect(i * s + s / 2, j * s + s / 2, s, s, 0)));
    if (kind === 'hex') { const r = s / 2; for (let j = 0, y = 0; y < d + s; y += r * 1.5, j++) for (let x = (j % 2) * r * 0.866; x < w + s; x += r * 1.732) { const o6 = [], i6 = []; for (let k = 0; k < 6; k++) { const t = Math.PI / 6 + k * Math.PI / 3; o6.push([x + r * Math.cos(t), y + r * Math.sin(t)]); i6.push([x + (r - 1.4) * Math.cos(t), y + (r - 1.4) * Math.sin(t)]); } A.push({ outer: o6, holes: [i6.reverse()] }); } }
    if (kind === 'diamonds') for (let j = 0, y = 0; y < d + s; y += s * 0.7, j++) for (let x = (j % 2) * s / 2; x < w + s; x += s) A.push(P([[x, y - s * 0.3], [x + s * 0.3, y], [x, y + s * 0.3], [x - s * 0.3, y]]));
    if (kind === 'triangles') for (let j = 0, y = 0; y < d + s; y += s * 0.866, j++) for (let x = (j % 2) * s / 2; x < w + s; x += s) A.push(P([[x - s * 0.35, y], [x + s * 0.35, y], [x, y + s * 0.6]]));
    if (kind === 'scales') for (let j = 0, y = 0; y < d + s; y += s * 0.5, j++) for (let x = (j % 2) * s / 2; x < w + s; x += s) { const o1 = circ(x, y, s * 0.5, 32), i1 = circ(x, y, s * 0.5 - 1.4, 32).reverse(); A.push({ outer: o1, holes: [i1] }); }
    if (kind === 'sunburst') { const n = Math.max(12, Math.round(R / s * 3)); for (let k = 0; k < n; k += 2) { const a0 = TAU * k / n, a1 = TAU * (k + 1) / n; A.push(P([[w / 2, d / 2], [w / 2 + R * Math.cos(a0), d / 2 + R * Math.sin(a0)], [w / 2 + R * Math.cos(a1), d / 2 + R * Math.sin(a1)]])); } }
    if (kind === 'terrazzo' || kind === 'confetti') { const rnd = rngFrom(Math.round(w * 7 + d * 13 + s)), n = Math.round(w * d / (s * s) * 1.4); for (let k = 0; k < n; k++) { const x = rnd() * w, y = rnd() * d, r = s * (kind === 'confetti' ? 0.18 : 0.12 + rnd() * 0.22), sides = kind === 'confetti' ? 4 : 5 + Math.floor(rnd() * 3), rot = rnd() * TAU, L = []; for (let i = 0; i < sides; i++) { const t = rot + TAU * i / sides, rr = r * (kind === 'confetti' ? (i % 2 ? 0.35 : 1) : 0.7 + rnd() * 0.5); L.push([x + rr * Math.cos(t), y + rr * Math.sin(t)]); } (k % 2 ? B : A).push(P(L)); } }
    let a = A.length ? T.unionPolys(A) : [], b = B.length ? T.unionPolys(B) : [];
    if (a.length && b.length) b = T.diffPolys(b, a);
    return { a, b };
  }
  function knobSpots(o, lw, ld) { if (o.knob === 'notch') return []; const sp = ['bar', 'arch'].includes(o.knob) ? 64 : 0; const cx = lw / 2, cy = ld / 2; const centers = o.knobs === 2 ? [[lw * 0.27, cy], [lw * 0.73, cy]] : [[cx, cy]]; return centers.map(([x, y]) => sp ? [[x - sp / 2, y], [x + sp / 2, y]] : [[x, y]]); }
  function buildKnob(o, M) {
    // modeled top up: attach face at z = 0, pegs below (into the lid holes), handle above
    const k = o.knob, pegH = o.lidT - 0.3, peg = (x) => M.Manifold.cylinder(pegH + 0.5, 3, 3, 28).translate([x, 0, -pegH]);
    let m;
    if (k === 'round') m = unionAll(M, [M.Manifold.cylinder(11, 7, 9.5, 48), peg(0)]);
    else if (k === 'mushroom') m = unionAll(M, [M.Manifold.cylinder(7, 5, 5, 32), M.Manifold.cylinder(5, 9, 11.5, 48).translate([0, 0, 6.9]), peg(0)]);
    else if (k === 'square') m = unionAll(M, [M.Manifold.hull([[-8, -8], [8, -8], [8, 8], [-8, 8]].map(([x, y]) => M.Manifold.cylinder(10, 2.5, 2.5, 16).translate([x, y, 0]))), peg(0)]);
    else if (k === 'tbar') m = unionAll(M, [M.Manifold.cylinder(7, 4.5, 4.5, 28), M.Manifold.hull([M.Manifold.cylinder(6, 5, 5, 28).translate([-13, 0, 6.9]), M.Manifold.cylinder(6, 5, 5, 28).translate([13, 0, 6.9])]), peg(0)]);
    else if (k === 'bar') m = unionAll(M, [M.Manifold.cylinder(14, 4.5, 4.5, 28).translate([-32, 0, 0]), M.Manifold.cylinder(14, 4.5, 4.5, 28).translate([32, 0, 0]), M.Manifold.hull([M.Manifold.cylinder(6, 5, 5, 28).translate([-38, 0, 13.9]), M.Manifold.cylinder(6, 5, 5, 28).translate([38, 0, 13.9])]), peg(-32), peg(32)]);
    else if (k === 'arch') { const prof = []; for (let i = 0; i <= 24; i++) { const t = Math.PI * i / 24; prof.push([-36 * Math.cos(t), 16 * Math.sin(t)]); } const outer = prof, inner = prof.map(([x, z]) => [x * 0.78, z * 0.6]).reverse(); const sec = T.extrude([{ outer: outer.concat(inner.map(([x, z]) => [x, z])), holes: [] }], 2, -4.5, 4.5); let a = man(M, sec).rotate([90, 0, 0]); a = unionAll(M, [a, M.Manifold.cylinder(4, 5, 5, 28).translate([-32, 0, 0]), M.Manifold.cylinder(4, 5, 5, 28).translate([32, 0, 0]), peg(-32), peg(32)]); m = a; }
    return m;
  }
  function buildLid(o, M) {
    const lw = o.w - 2 * rim(o) - 0.5, ld = o.d - 2 * rim(o) - 0.5, t = o.lidT, notes = [];
    const outline = [P(rrect(lw / 2, ld / 2, lw, ld, Math.max(0.5, (o.mode === 'grid' ? 3.75 : 4) - rim(o))))];
    const region = T.offset(outline, -3, true), keep = [];   // pattern/logo stay 3 mm inside the edge
    const spots = knobSpots(o, lw, ld).flat(), holes = spots.map(([x, y]) => P(circ(x, y, 3.25, 28)));
    const knobKeep = spots.map(([x, y]) => P(circ(x, y, 9, 32)));
    let free = knobKeep.length ? T.diffPolys(region, knobKeep) : region;
    if (o.knob === 'notch') free = T.diffPolys(free, [P(circ(lw / 2, 0, 14, 32))]);
    let plate = ext(M, outline, 0, t); const cuts = [], colors = { pattern: null, pattern2: null, logo: null, label: null };
    if (holes.length) cuts.push(ext(M, holes, -1, t + 1));
    if (o.knob === 'notch') cuts.push(ext(M, [P(circ(lw / 2, -2, 11, 40))], -1, t + 1));
    // label and logo first: patterns stay clear of them
    let reserved = [];
    if (o.lidLabel.trim()) {
      const lab = T.interPolys(labelPolys({ ...o, labels: 'inlay', labelSize: Math.min(14, Math.max(6, ld * 0.12)) }, o.lidLabel, lw / 2, ld * 0.2, lw * 0.8), free);
      if (lab.length) { cuts.push(ext(M, lab, t - 0.6, t + 1)); colors.label = ext(M, lab, t - 0.6, t); reserved.push(...T.offset(lab, 1.6, true)); }
    }
    if (o.logo && LD()) {
      try {
        const r = LD().apply({ deco: { kind: 'image', img: o.logo, imgMode: 'trace', imgSize: o.logoSize, threshold: o.logoThreshold, invert: o.logoInvert, finish: 'inlay', depth: 0.6, color: o.logoColor, x: 0, y: o.lidLabel.trim() ? 8 : 0 }, w: lw, d: ld, t, kind: 'friction', region: free });
        if (r && r.color && r.color.length) { const ps = r.color[0].polys; cuts.push(ext(M, ps, t - 0.6, t + 1)); colors.logo = ext(M, ps, t - 0.6, t); reserved.push(...T.offset(ps, 1.6, true)); }
        if (r) notes.push(...r.notes);
      } catch (e) { notes.push('The logo could not be traced. Try a higher-contrast image.'); }
    }
    if (o.lidPattern !== 'none') {
      const pat = patternPolys(o.lidPattern, lw, ld, o.patternScale), area = reserved.length ? T.diffPolys(free, T.unionPolys(reserved)) : free;
      const a = pat.a.length ? T.interPolys(pat.a, area).filter(Q => T.polysArea([Q]) > 0.5) : [], b = pat.b.length ? T.interPolys(pat.b, area).filter(Q => T.polysArea([Q]) > 0.5) : [];
      if (a.length) { cuts.push(ext(M, a, t - 0.6, t + 1)); colors.pattern = ext(M, a, t - 0.6, t); }
      if (b.length) { cuts.push(ext(M, b, t - 0.6, t + 1)); colors.pattern2 = ext(M, b, t - 0.6, t); }
    }
    plate = cut(M, plate, unionAll(M, cuts));
    const knob = o.knob !== 'notch' ? buildKnob(o, M) : null;
    return { plate, colors, knob, spots, lw, ld, notes, knobCount: o.knob === 'notch' ? 0 : o.knobs };
  }

  // ------------------------------------------------------------------ build everything
  const flipX = p => { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i]; q[i + 1] = -p[i + 1]; q[i + 2] = -p[i + 2]; } return q; };   // 180 degrees about x
  const moveP = (p, dx, dy, dz) => { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i] + dx; q[i + 1] = p[i + 1] + dy; q[i + 2] = p[i + 2] + (dz || 0); } return q; };
  const bboxOf = list => { let a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (const p of list) for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { a[k] = Math.min(a[k], p[i + k]); b[k] = Math.max(b[k], p[i + k]); } return { min: a, max: b }; };
  function area(p) { let a = 0; for (let i = 0; i < p.length; i += 9) { const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2], vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2]; a += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2; } return a; }
  function runs(n, m) { const k = Math.max(1, Math.ceil(n / m)), out = []; for (let i = 0; i < k; i++) out.push(n / k); return out; }
  function build(raw, M) {
    if (!M) throw new Error('The 3D engine is still loading. Try again in a moment.');
    const o = options(raw), Ub = usable(o), placed = layout(o), warnings = checkLayout(o, placed), notes = [];
    const tray = buildTray(o, M, placed);
    // tiles: drawer trays bigger than the bed are cut into straight tiles (labels and floors follow)
    const tiles = [];
    const fits = (w, d) => (w <= Ub.w && d <= Ub.d) || (d <= Ub.w && w <= Ub.d);
    let cols = 1, rows = 1;
    if (!fits(o.w, o.d)) {
      if (o.mode === 'grid') warnings.push(`This tray (${Math.round(o.w)} \u00d7 ${Math.round(o.d)} mm) is bigger than your bed. Use fewer grid units.`);
      else { cols = Math.ceil(o.w / Ub.w); rows = Math.ceil(o.d / Ub.d); const alt = [Math.ceil(o.w / Ub.d), Math.ceil(o.d / Ub.w)]; if (alt[0] * alt[1] < cols * rows) { cols = alt[0]; rows = alt[1]; } }
    }
    const tw = o.w / cols, td = o.d / rows, parts = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const bx = cols * rows > 1 ? (m) => { const b = boxM(M, i * tw - (i ? 0 : 5), j * td - (j ? 0 : 5), -20, (i + 1) * tw + (i === cols - 1 ? 5 : 0), (j + 1) * td + (j === rows - 1 ? 5 : 0), o.h + 20); const r = m.intersect(b); b.delete(); return r; } : (m) => m;
      const name = cols * rows > 1 ? `Cubby tray ${String.fromCharCode(65 + j)}${i + 1}` : 'Cubby tray';
      const sub = [{ role: 'tray', name, m: bx(tray.body), color: o.trayColor }];
      if (tray.shadow) sub.push({ role: 'shadow', name: name + ' pocket floors', m: bx(tray.shadow), color: o.shadowColor });
      if (tray.label) sub.push({ role: 'label', name: name + ' labels', m: bx(tray.label), color: o.labelColor });
      const ps = sub.map(s => ({ ...s, p: soup(s.m) })).filter(s => s.p.length);
      if (cols * rows > 1) sub.forEach(s => s.m.delete());
      parts.push({ kind: 'tray', name, parts: ps.map(s => ({ name: s.name, p: s.p, color: s.color, role: s.role })), count: 1 });
    }
    if (cols * rows > 1) notes.push(`The tray is bigger than your bed, so it prints as ${cols * rows} tiles that sit side by side in the drawer.`);
    tray.body.delete(); if (tray.shadow) tray.shadow.delete(); if (tray.label) tray.label.delete();
    let lid = null;
    if (o.lid) {
      lid = buildLid(o, M); notes.push(...lid.notes);
      const lp = [{ name: 'Lid', p: soup(lid.plate), color: o.lidColor, role: 'lid' }];
      if (lid.colors.pattern) lp.push({ name: 'Lid pattern', p: soup(lid.colors.pattern), color: o.patternColor, role: 'pattern' });
      if (lid.colors.pattern2) lp.push({ name: 'Lid pattern, second color', p: soup(lid.colors.pattern2), color: o.patternColor2, role: 'pattern2' });
      if (lid.colors.logo) lp.push({ name: 'Lid logo', p: soup(lid.colors.logo), color: o.logoColor, role: 'logo' });
      if (lid.colors.label) lp.push({ name: 'Lid label', p: soup(lid.colors.label), color: o.lidLabelColor, role: 'lidlabel' });
      lid.plate.delete(); Object.values(lid.colors).forEach(m => m && m.delete());
      parts.push({ kind: 'lid', name: 'Lid', parts: lp, count: 1, lw: lid.lw, ld: lid.ld });
      if (lid.knob) { parts.push({ kind: 'knob', name: KNOBS[o.knob], parts: [{ name: KNOBS[o.knob], p: soup(lid.knob), color: o.knobColor, role: 'knob' }], count: lid.knobCount, spots: lid.spots }); lid.knob.delete(); }
      if (!fits(lid.lw, lid.ld)) warnings.push('The lid is bigger than your bed. Use a smaller tray, or print the tray without a lid.');
    }
    // assembled preview (z up): tray tiles in place, lid lifted above and turned top up, knobs on the lid
    const preview = [];
    for (const pt of parts.filter(p => p.kind === 'tray')) for (const s of pt.parts) preview.push({ p: s.p, color: s.color, name: s.name });
    if (lid) {
      const lift = o.h + 18, ox = rim(o) + 0.25, oy = rim(o) + 0.25;
      for (const s of parts.find(p => p.kind === 'lid').parts) preview.push({ p: moveP(s.p, ox, oy, lift - o.lidT), color: s.color, name: s.name });
      const kp = parts.find(p => p.kind === 'knob');
      if (kp) { const spotsC = knobSpots(o, lid.lw, lid.ld); for (const grp of spotsC) { const cx = grp.reduce((s, q) => s + q[0], 0) / grp.length, cy = grp.reduce((s, q) => s + q[1], 0) / grp.length; preview.push({ p: moveP(kp.parts[0].p, ox + cx, oy + cy, lift), color: kp.parts[0].color, name: kp.name }); } }
    }
    // stats
    // filament estimate: 1.2 mm of walls/skins over the surface plus 15% infill inside (solid trays print with infill)
    let vol = 0; for (const pt of parts) for (const s of pt.parts) { const V = Math.abs(C.signedVolume(s.p)), A = area(s.p), shell = Math.min(V, A * 0.6); vol += (shell + (V - shell) * 0.15) * pt.count; }
    const colorsUsed = []; for (const pt of parts) for (const s of pt.parts) if (!colorsUsed.includes(s.color)) colorsUsed.push(s.color);
    const stats = { items: o.items.length, pockets: placed.length, tiles: cols * rows, size: [Math.round(o.w), Math.round(o.d), Math.round(o.h)], colors: colorsUsed.length, grams: Math.round(vol / 1000 * 1.24), lid: !!lid, knobs: lid ? lid.knobCount : 0 };
    return { options: o, placed: placed.map(q => ({ type: q.it.type, name: ITEMS[q.it.type].name, x: q.it.x, y: q.it.y, rot: q.it.rot, label: q.it.label, depth: q.g.depth, pocket: q.pocket, labelPolys: q.label, box: q.box, outside: !!q.outside, overlap: !!q.overlap })), parts, preview, stats, warnings, notes };
  }
  // what the export needs: the cubbies entitlement, plus the lids entitlement for a lid
  function gateInfo(raw) { const o = options(raw); return { features: o.lid ? [FEATURE, LID_FEATURE] : [FEATURE], exclusive: true }; }
  function printList(res) {
    const out = [];
    for (const pt of res.parts) for (let k = 0; k < pt.count; k++) {
      let ps = pt.parts.map(s => s.p);
      if (pt.kind === 'lid') ps = ps.map(flipX);                       // lids print top down (smooth inlaid top)
      if (pt.kind === 'knob') ps = ps.map(p => res.options.knob === 'arch' ? (() => { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = p[i]; q[i + 1] = p[i + 2]; q[i + 2] = -p[i + 1]; } return q; })() : flipX(p));
      const b = bboxOf(ps), sub = pt.parts.map((s, i) => ({ name: s.name, color: s.color, p: moveP(ps[i], -b.min[0], -b.min[1], -b.min[2]) }));
      out.push({ name: pt.count > 1 ? `${pt.name} ${k + 1}` : pt.name, parts: sub, color: sub[0].color, p: sub.length === 1 ? sub[0].p : concat(sub.map(s => s.p)) });
    }
    return out;
  }
  function concat(list) { const n = list.reduce((s, p) => s + p.length, 0), out = new Float64Array(n); let k = 0; for (const p of list) { out.set(p, k); k += p.length; } return out; }
  function rotZ(p) { const q = new Float64Array(p.length); for (let i = 0; i < p.length; i += 3) { q[i] = -p[i + 1]; q[i + 1] = p[i]; q[i + 2] = p[i + 2]; } return q; }
  function arrangePlates(res) {
    const Ub = usable(res.options), list = printList(res), A = PL.arrange(list.map(it => ({ name: it.name, p: it.p, color: it.color, _it: it })), Ub.w, Ub.d, { gap: 5, maxZ: Ub.z });
    const fix = q => { const it = q._it; let ps = it.parts.map(s => s.p); if (q.rot) ps = ps.map(rotZ); const b = bboxOf(ps); return { name: it.name, color: it.color, p: q.p, parts: it.parts.map((s, i) => ({ name: s.name, color: s.color, p: moveP(ps[i], q.x - b.min[0], q.y - b.min[1], -b.min[2]) })) }; };
    return { plates: A.plates.map(l => l.map(fix)), unfit: A.unfit.map(u => ({ name: u._it.name, parts: u._it.parts, p: u._it.p, color: u._it.color })) };
  }
  function export3MF(res, o) {
    o = o || {}; const cols = []; for (const pt of res.parts) for (const s of pt.parts) if (!cols.includes(s.color)) cols.push(s.color);
    const A = arrangePlates(res), objs = [], plates = [];
    const obj = it => ({ name: it.name, parts: it.parts.map(s => ({ name: s.name, p: s.p, color: s.color, extruder: cols.indexOf(s.color) + 1 })) });
    A.plates.forEach(list => { const ids = []; list.forEach(it => { ids.push(objs.length); objs.push(obj(it)); }); plates.push(ids); });
    A.unfit.forEach(u => { plates.push([objs.length]); objs.push(obj(u)); });
    return T.threeMF(objs, { title: o.name || 'Form-fit cubbies', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function notesText(res) {
    const o = res.options, st = res.stats, L = ['Expressarte form-fit cubbies', ''];
    L.push(`Tray ${st.size[0]} \u00d7 ${st.size[1]} \u00d7 ${st.size[2]} mm (${o.mode === 'grid' ? `${o.nx} \u00d7 ${o.ny} on the 42 mm grid` : 'drawer'}), ${st.pockets} pockets${st.tiles > 1 ? `, ${st.tiles} tiles` : ''}.`);
    L.push('', 'Pockets'); for (const q of res.placed) L.push(`  ${q.name}${q.label ? ` "${q.label}"` : ''}: ${q.depth.toFixed(1)} mm deep`);
    L.push('', 'Printing', '  - The tray prints upright, no supports. Each color is its own filament in the 3MF (tray, pocket floors, labels).', `  - Pocket outlines include ${o.clearance} mm of clearance around each item.`);
    if (o.lid) L.push('  - The lid prints top down so the inlaid pattern, logo and label come out smooth and flush. It drops into the recess on top of the tray.', o.knob === 'notch' ? '  - Lift the lid with the finger notch at the front.' : `  - Print ${st.knobs} ${KNOBS[o.knob].toLowerCase()}${st.knobs === 1 ? '' : 's'}; press the peg${['bar', 'arch'].includes(o.knob) ? 's' : ''} into the lid hole${['bar', 'arch'].includes(o.knob) ? 's' : ''} (a drop of glue makes it permanent).`);
    if (res.warnings.length) { L.push('', 'Notes'); res.warnings.forEach(w => L.push('  - ' + w)); }
    res.notes.forEach(n => L.push('  - ' + n));
    return L.join('\n');
  }
  function files(res, o) {
    o = o || {}; const base = o.fileBase || 'form_fit_cubbies', out = [], slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
    for (const it of printList(res)) out.push({ name: `${base}_${slug(it.name)}.stl`, data: new Uint8Array(C.writeSTL(it.p, it.name)) });
    out.push({ name: `${base}.3mf`, data: export3MF(res, o) });
    out.push({ name: `${base}_NOTES.txt`, data: notesText(res) });
    return out;
  }
  const helpers = { ext, man, soup, unionAll, cut, boxM, labelPolys, buildKnob, flipX, moveP, bboxOf, area, concat, rotZ, rrect, circ, P, tfP };
  const api = { helpers, FEATURE, LID_FEATURE, CATS, ITEMS, PRESETS, PATTERNS, KNOBS, LABEL_STYLES, FONTS, PALETTE, DEFAULTS, options, normItem, itemGeom, autoArrange, patternPolys, build, gateInfo, printList, arrangePlates, export3MF, notes: notesText, files, usable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPCubbies = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
