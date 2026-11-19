// Trash can rim generator: custom rims ("hubcaps") for the wheels of wheeled curbside carts (the 64 / 96 gallon
// bins most homes roll to the street), and a spinner version that turns on a standard skateboard-style bearing.
//
// Everything is millimetres, Z up, printed face up with the back flat on the bed (no supports anywhere).
// A rim face is a smooth polar heightfield (rings that land exactly on every crease of the profile, sectors fine
// enough that curves never facet), cut through by the windows between the spokes (exact 2D outlines with rounded
// corners), then lug nuts, rivets, curved text on the lip and a logo on the centre cap are added with Manifold.
// The mounting parts (a clip-in finger ring, a hub sleeve or screw holes) and the spinner parts (base, spinner,
// centre cap, spacers) are separate printable parts; the bearing, bolt and nut are bought (see BOM in the readme).
// The cart mockup in the studio is preview only and never exported.
(function (G) {
  'use strict';
  const TAU = Math.PI * 2, IN = 25.4;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sstep = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const wrap = (a, P) => { a = (a + P / 2) % P; if (a < 0) a += P; return a - P / 2; };
  const f1 = v => (Math.round(v * 10) / 10).toString();

  // Real cart wheels: diameters are the tyre OD. Hub = the raised boss round the axle, grip = the recess the clip
  // ring fingers snap into (both are starting points, the user measures their own wheel).
  const WHEELS = {
    w6: { name: '6 in wheel', note: 'small 20-35 gal carts', od: 6 * IN, width: 38, axle: 12.7, hub: 44, grip: 104 },
    w8: { name: '8 in wheel', note: '32-48 gal carts', od: 8 * IN, width: 44.5, axle: 15.875, hub: 54, grip: 138 },
    w10: { name: '10 in wheel', note: 'most 64 & 96 gal carts', od: 10 * IN, width: 44.5, axle: 15.875, hub: 64, grip: 176 },
    w12: { name: '12 in wheel', note: 'heavy-duty 96 gal carts', od: 12 * IN, width: 50.8, axle: 19.05, hub: 76, grip: 212 },
    eu200: { name: '200 mm wheel', note: 'EU 2-wheel bins (120-360 L)', od: 200, width: 50, axle: 20, hub: 60, grip: 136 },
    custom: { name: 'Custom', note: 'your own measurements', od: 254, width: 44.5, axle: 15.875, hub: 64, grip: 176 }
  };
  const AXLES = { '0.5in': { name: '1/2 in (12.7 mm)', d: 12.7 }, '0.625in': { name: '5/8 in (15.9 mm)', d: 15.875 }, '0.75in': { name: '3/4 in (19.1 mm)', d: 19.05 }, m20: { name: '20 mm', d: 20 }, m25: { name: '25 mm', d: 25 } };
  // d x D x B; il / ol: inner ring land and outer ring shoulder diameters (what a spacer and a seat lip may touch).
  // Every preset is a size Bambu Lab sells (us.store.bambulab.com, Maker's Supply > bearings). Bores wider than the
  // bolt get a printed centring sleeve on the lower spacer.
  const ringLands = (d, D) => ({ il: +(d + 0.29 * (D - d)).toFixed(1), ol: +(D - 0.21 * (D - d)).toFixed(1) });
  const boltFor = d => d >= 12 ? 'M12' : d >= 10 ? 'M10' : d >= 8 ? 'M8' : 'M6';
  const brg = (d, D, B, label) => Object.assign({ name: `${label} (${d} \u00d7 ${D} \u00d7 ${B} mm)`, d, D, B, bolt: boltFor(d), sold: 'Bambu Lab' }, ringLands(d, D));
  const BEARINGS = {
    '608': Object.assign(brg(8, 22, 7, '608ZZ'), { name: '608ZZ (8 \u00d7 22 \u00d7 7 mm, skateboard)', il: 12, ol: 19 }),
    '688': brg(8, 16, 5, '688ZZ slim'),
    '6000': Object.assign(brg(10, 26, 8, '6000ZZ'), { il: 14.4, ol: 22 }),
    '6200': brg(10, 30, 9, '6200ZZ'),
    '6001': Object.assign(brg(12, 28, 8, '6001ZZ'), { il: 16.2, ol: 24 }),
    '6201': brg(12, 32, 10, '6201ZZ'),
    '6202': brg(15, 35, 11, '6202ZZ'),
    '6004': brg(20, 42, 12, '6004ZZ heavy')
  };
  const BRG_CUSTOM = { d: [6, 25], D: [14, 52], B: [4, 14] };
  function bearingOf(o) {
    if (o && o.bearing === 'custom') {
      const d = clamp(+o.brD || 8, ...BRG_CUSTOM.d), D = clamp(+o.brOD || 22, Math.max(BRG_CUSTOM.D[0], d + 6), BRG_CUSTOM.D[1]), B = clamp(+o.brW || 7, ...BRG_CUSTOM.B);
      return Object.assign(brg(+d.toFixed(2), +D.toFixed(2), +B.toFixed(2), 'Custom'), { custom: true, sold: null });
    }
    return BEARINGS[o && o.bearing] || BEARINGS['608'];
  }
  // ISO 4762 socket head cap screws and ISO 4032 hex nuts
  const BOLTS = {
    M6: { d: 6, hole: 6.5, head: 10, headH: 6, nut: 10, nutH: 5.2 },
    M5: { d: 5, hole: 5.5, head: 8.5, headH: 5, nut: 8, nutH: 4 },
    M8: { d: 8, hole: 8.5, head: 13, headH: 8, nut: 13, nutH: 6.5 },
    M10: { d: 10, hole: 10.5, head: 16, headH: 10, nut: 16, nutH: 8 },
    M12: { d: 12, hole: 12.5, head: 18, headH: 12, nut: 18, nutH: 10 }
  };
  const LENGTHS = [8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100];
  const MOUNTS = {
    clip: { name: 'Clip-in ring', blurb: 'a printed ring of spring fingers snaps into the wheel recess; glue the ring into the groove on the back' },
    hub: { name: 'Hub sleeve', blurb: 'a printed sleeve with crush ribs presses over the wheel hub boss' },
    screw: { name: 'Screws', blurb: 'M4 or #8 pan-head screws through counterbored holes in the lug nuts into the wheel face' },
    tape: { name: 'Flat back (tape)', blurb: 'flat solid back for outdoor VHB tape or adhesive' }
  };
  // screw mounting: evenly spaced 4.5 mm through holes, counterbored for an M4 / #8 pan head (8 mm head, 8.8 mm bore)
  // pos: where the screws go. outer = just inside the lip, over the plastic rim of the wheel (solid rubber or plastic tyres
  // on an HDPE rim: the rim's face runs from the recess at ~0.35 x wheel OD out to ~0.40 x OD where the tyre starts), on
  // raised round bosses that bridge the windows so the edge cannot flex; lugs = through the lug nuts at the centre; both.
  const SCREW = { counts: [3, 4, 5, 6, 8], hole: 4.5, cb: 8.8, cbZ: 4, boss: 7, pos: ['outer', 'lugs', 'both'], outerK: 0.37, tyreK: 0.40, headH: 3.5, bite: 12,
    POS: { outer: 'Outer rim', lugs: 'Lug nuts (center)', both: 'Both (outer + lug nuts)' } };
  const screwPos = o => SCREW.pos.includes(o.screwPos) ? o.screwPos : 'outer';
  // screw length: what the screw passes through plus ~12 mm into the wheel, rounded up to a stock length
  const screwLen = t => [12, 16, 20, 25, 30, 35, 40].find(L => L >= t + SCREW.bite) || Math.ceil(t + SCREW.bite);
  // default screw count: the style's own lug-nut count when it is one of the choices, otherwise 4
  function screwDefault(id) { let n = 0; try { const st = styleById(id), d = dims({ style: id }), sp = st.make(d.R, d.s); n = sp.lugs ? sp.lugs.n : 0; } catch (e) { n = 0; } return SCREW.counts.includes(n) ? n : 4; }
  function screwCount(o) { const n = Math.round(+o.screws); return SCREW.counts.includes(n) ? n : screwDefault(o.style); }
  const FINISHES = {
    chrome: { name: 'Chrome', color: 0xe9edf2, metal: 1, rough: 0.12 },
    black: { name: 'Gloss black', color: 0x15171a, metal: 0.35, rough: 0.28 },
    gunmetal: { name: 'Gunmetal', color: 0x4a5058, metal: 0.9, rough: 0.32 },
    gold: { name: 'Gold', color: 0xd9a63a, metal: 1, rough: 0.2 },
    white: { name: 'White', color: 0xf3f3f0, metal: 0, rough: 0.45 },
    bronze: { name: 'Bronze', color: 0x8a6236, metal: 0.85, rough: 0.35 },
    red: { name: 'Candy red', color: 0xb0121b, metal: 0.6, rough: 0.22 }
  };
  // step / dr: face sampling (mm round / across); hb: window outline spacing; rows: the rolled spoke edge (fractions of
  // its radius); txt: lip text and logo sampling; seg: arc tolerance (mm) for fillets, nuts and rivets
  const DETAIL = {
    draft: { step: 1.0, dr: 0.9, astep: 2.4, hb: 0.6, rows: [0.2, 0.5, 1], txt: 0.6, seg: 0.5, name: 'Draft' },
    standard: { step: 0.56, dr: 0.5, astep: 1.6, hb: 0.32, rows: [0.12, 0.35, 0.65, 1], txt: 0.3, seg: 0.25, name: 'Standard' },
    fine: { step: 0.36, dr: 0.33, astep: 1.1, hb: 0.2, rows: [0.08, 0.22, 0.42, 0.66, 1], txt: 0.18, seg: 0.15, name: 'Fine' }
  };
  const dflt = m => (m && typeof m !== 'function' && m.default) || m;
  const Delaunator = dflt(G.Delaunator || (typeof require === 'function' ? require('delaunator') : null));
  const Constrainautor = dflt(G.Constrainautor || (typeof require === 'function' ? require('@kninnug/constrainautor') : null));

  // ------------------------------------------------------------------ styles
  // Each style returns a spec for a rim of radius R: the radial profile (lip, barrel, dish, hub, cap), spoke
  // families (count, width, twist, crown profile), hole patterns, lugs, rivets and extras. s scales heights.
  const def = (R, s) => ({
    lw: 0.1 * R, zl: 9.5 * s, zE: 3, crownL: 0.5 * s, ls: 1.6, barrelW: 0.03 * R, zB: 5 * s, rH: 0.25 * R, zH: 10.5 * s, zHf: 7.5 * s, ex: 1.5,
    rC: 0.13 * R, zC: 12.8 * s, dome: 1.3 * s, cap: true, rings: [], fams: [], holes: [], fillet: 3 * s, win: null,
    lugs: { n: 5, r: 0.19 * R, af: clamp(0.055 * R, 4, 8) }, rivets: null, bolts: null, extra: null, directional: false
  });
  const STYLES = [
    { id: 'star5', name: '5-spoke star', pro: false, blurb: 'Five broad concave spokes, the classic alloy look.', make(R, s) {
      return Object.assign(def(R, s), { zHf: 8.8 * s, zB: 4.6 * s, ex: 1.8, fillet: 4.5 * s, rings: [{ r: 0.27 * R, w: 1.2, h: -0.6 * s }],
        fams: [{ n: 5, w0: 0.088 * R, w1: 0.042 * R, crown: 2.6 * s, prof: 'round' }] }); } },
    { id: 'multi10', name: '10-spoke', pro: false, blurb: 'Ten slim straight spokes.', make(R, s) {
      return Object.assign(def(R, s), { zHf: 7.6 * s, zB: 5.4 * s, ex: 1.2, fillet: 2.6 * s,
        fams: [{ n: 10, w0: 0.03 * R, w1: 0.023 * R, crown: 1.9 * s, prof: 'round' }] }); } },
    { id: 'split5', name: 'Split 5-spoke', pro: false, blurb: 'Five V-shaped split spokes that fork toward the lip.', make(R, s) {
      return Object.assign(def(R, s), { zHf: 8 * s, ex: 1.5, fillet: 2.3 * s,
        fams: [{ n: 5, w0: 0.03 * R, w1: 0.021 * R, split: 0.075 * R, crown: 2.1 * s, prof: 'round' }] }); } },
    { id: 'steelie', name: 'Steelie', pro: false, blurb: 'Pressed steel wheel: rolled rings, eight vent holes, big lug nuts.', make(R, s) {
      return Object.assign(def(R, s), { rH: 0.3 * R, zH: 9.2 * s, zHf: 7.4 * s, zB: 5.2 * s, ex: 1, rC: 0.105 * R, zC: 11.6 * s, dome: 1.8 * s,
        rings: [{ r: 0.39 * R, w: 3.2 * s, h: 1.6 * s }, { r: 0.76 * R, w: 2.2 * s, h: -0.8 * s }, { r: 0.82 * R, w: 2.6 * s, h: 1.2 * s }],
        holes: [{ kind: 'round', r: 0.6 * R, n: 8, d: 0.12 * R, lip: 0.9 * s }], lugs: { n: 5, r: 0.2 * R, af: clamp(0.065 * R, 4.5, 9) } }); } },
    { id: 'slot5', name: '5-slot mag', pro: false, blurb: 'Hot-rod mag: five long rounded slots in a flat dish.', make(R, s) {
      const S = 0.12 * R;
      return Object.assign(def(R, s), { rH: 0.28 * R, zHf: 7.2 * s, zB: 5.6 * s, ex: 1, fillet: S / 2 - 0.4, win: { r0: 0.37 * R, r1: 0.8 * R },
        fams: [{ n: 5, slot: S, crown: 1.1 * s, prof: 'flat' }], rings: [{ r: 0.33 * R, w: 1.4, h: 0.7 * s }, { r: 0.85 * R, w: 1.2, h: -0.6 * s }] }); } },
    { id: 'aero', name: 'Aero disc', pro: false, blurb: 'Smooth domed disc with ten curved cooling vents.', make(R, s) {
      return Object.assign(def(R, s), { rH: 0.24 * R, zH: 11.5 * s, zHf: 10 * s, zB: 5.2 * s, ex: 0.75, rC: 0.2 * R, zC: 13.4 * s, dome: 1.6 * s, lugs: null,
        rings: [{ r: 0.5 * R, w: 1.3, h: -0.5 * s }], holes: [{ kind: 'arcslot', r: 0.8 * R, n: 10, len: 0.2 * R, w: 0.045 * R }] }); } },
    { id: 'deepdish', name: 'Deep dish', pro: false, blurb: 'Wide polished lip stepping down to six short spokes, lip rivets.', make(R, s) {
      return Object.assign(def(R, s), { lw: 0.2 * R, zl: 12 * s, zB: 3.8 * s, barrelW: 0.04 * R, rH: 0.22 * R, zH: 11 * s, zHf: 9 * s, ex: 2.1, fillet: 3 * s,
        fams: [{ n: 6, w0: 0.052 * R, w1: 0.036 * R, crown: 2.3 * s, prof: 'round' }], rivets: { n: 24, d: 3.2 * s }, lugs: { n: 6, r: 0.17 * R, af: clamp(0.05 * R, 4, 7) } }); } },
    { id: 'mesh', name: 'Mesh cross-lace', pro: true, blurb: 'Motorsport mesh: crossing spokes in a diamond lattice, rivets on the lip.', make(R, s) {
      return Object.assign(def(R, s), { zHf: 7.6 * s, ex: 1.3, fillet: 1.6 * s, lw: 0.12 * R,
        fams: [{ n: 10, twist: 0.36, w0: 0.019 * R, w1: 0.016 * R, crown: 1.7 * s, prof: 'round' }, { n: 10, twist: -0.36, w0: 0.019 * R, w1: 0.016 * R, crown: 1.7 * s, prof: 'round' }],
        rivets: { n: 20, d: 2.6 * s } }); } },
    { id: 'turbine', name: 'Turbine fan', pro: true, blurb: 'Eighteen swept fan blades, like a jet intake. Mirrored pair available.', make(R, s) {
      return Object.assign(def(R, s), { rH: 0.24 * R, zHf: 8.4 * s, zB: 5 * s, ex: 1, fillet: 1.3 * s, directional: true,
        fams: [{ n: 18, twist: 0.95, w0: 0.012 * R, w1: 0.021 * R, crown: 2.2 * s, prof: 'blade' }] }); } },
    { id: 'wire', name: 'Wire spoke', pro: true, blurb: 'Laced wire spokes and a two-ear knock-off center, the lowrider look.', make(R, s) {
      return Object.assign(def(R, s), { rH: 0.17 * R, zH: 9.6 * s, zHf: 6.4 * s, zB: 5 * s, ex: 1.2, rC: 0.085 * R, zC: 12 * s, dome: 2.2 * s, fillet: 0.8, barrelW: 0.05 * R, lugs: null,
        fams: [{ n: 24, tangent: 0.13 * R, w0: Math.max(0.95, 0.0085 * R), w1: Math.max(0.95, 0.0085 * R), crown: 1.2 * s, prof: 'round' },
          { n: 24, tangent: -0.13 * R, w0: Math.max(0.95, 0.0085 * R), w1: Math.max(0.95, 0.0085 * R), crown: 1.2 * s, prof: 'round', phase: TAU / 48 }],
        rings: [{ r: 0.2 * R, w: 1.4, h: 0.8 * s }], extra: 'knockoff' }); } },
    { id: 'bling', name: 'Big-rim bling (22s)', pro: true, blurb: 'Chrome-show style: deep stepped lip, twisted split spokes, rivet ring.', make(R, s) {
      return Object.assign(def(R, s), { lw: 0.17 * R, zl: 11.6 * s, zB: 4.4 * s, crownL: 0.3 * s, rH: 0.2 * R, zH: 11 * s, zHf: 9.2 * s, ex: 1.9, rC: 0.13 * R, zC: 13.6 * s, fillet: 2 * s, directional: true,
        rings: [{ r: 0.89 * R, w: 1.1, h: -0.7 * s }], fams: [{ n: 6, split: 0.08 * R, w0: 0.022 * R, w1: 0.017 * R, twist: 0.24, crown: 2.3 * s, prof: 'groove' }],
        rivets: { n: 30, d: 2.4 * s, at: 0.35 }, lugs: { n: 6, r: 0.165 * R, af: clamp(0.045 * R, 4, 7) } }); } },
    { id: 'directional', name: 'Directional blade', pro: true, blurb: 'Ten curved blades that sweep one way. Mirrored pair available.', make(R, s) {
      return Object.assign(def(R, s), { zHf: 8.6 * s, ex: 1.5, fillet: 2.2 * s, directional: true,
        fams: [{ n: 10, twist: 0.58, w0: 0.032 * R, w1: 0.019 * R, crown: 2.5 * s, prof: 'blade' }] }); } },
    { id: 'beadlock', name: 'Beadlock', pro: true, blurb: 'Off-road beadlock: flat bolt ring of 24 hex bolts, eight flat spokes.', make(R, s) {
      return Object.assign(def(R, s), { lw: 0.16 * R, crownL: 0, zl: 10.4 * s, rH: 0.27 * R, zHf: 8 * s, ex: 1.4, fillet: 3 * s,
        rings: [{ r: 0.84 * R - 1, w: 1, h: -0.7 * s }], fams: [{ n: 8, w0: 0.046 * R, w1: 0.036 * R, crown: 1.8 * s, prof: 'flat' }],
        bolts: { n: 24, af: clamp(0.04 * R, 3.2, 6) }, lugs: { n: 8, r: 0.2 * R, af: clamp(0.045 * R, 4, 7) } }); } },
    { id: 'trucker', name: 'Big rig spikes', pro: true, blurb: 'Polished semi-truck disc: ten hand holes round a deep dish, ten spiked lug nut covers and a spiked hub cone.', make(R, s) {
      return Object.assign(def(R, s), { lw: 0.11 * R, zl: 10.5 * s, zB: 3.6 * s, barrelW: 0.03 * R, crownL: 0.6 * s, rH: 0.42 * R, zH: 9.4 * s, zHf: 8.2 * s, ex: 1.6, rC: 0.17 * R, zC: 11.2 * s, dome: 1.2 * s, fillet: 3 * s,
        rings: [{ r: 0.46 * R, w: 2.4 * s, h: 1.1 * s }, { r: 0.8 * R, w: 1.4, h: -0.6 * s }],
        holes: [{ kind: 'round', r: 0.63 * R, n: 10, d: 0.13 * R, lip: 1.0 * s }],
        lugs: { n: 10, r: 0.31 * R, af: clamp(0.055 * R, 4.5, 8), spike: true }, centre: { kind: 'spike' } }); } },
    { id: 'slabpoke', name: 'Slab poke', pro: true, blurb: 'Houston slab-style wire wheel: 30 laced spokes and a stepped chrome poke with a knock-off that sticks way out past the tire. Set the poke length.', make(R, s) {
      const w = Math.max(0.95, 0.0085 * R);
      return Object.assign(def(R, s), { lw: 0.09 * R, rH: 0.3 * R, zH: 8.6 * s, zHf: 6.2 * s, zB: 4.6 * s, ex: 1.2, rC: 0.12 * R, zC: 9.4 * s, dome: 0.8 * s, fillet: 0.8, barrelW: 0.05 * R, lugs: null,
        fams: [{ n: 15, tangent: 0.2 * R, w0: w, w1: w, crown: 1.2 * s, prof: 'round' }, { n: 15, tangent: -0.2 * R, w0: w, w1: w, crown: 1.2 * s, prof: 'round', phase: TAU / 30 }],
        rings: [{ r: 0.33 * R, w: 1.4, h: 0.8 * s }], centre: { kind: 'poke' } }); } },
    { id: 'offroad', name: 'Off-road truck', pro: true, blurb: 'Six chunky milled spokes, eight lugs, a riveted lip.', make(R, s) {
      return Object.assign(def(R, s), { lw: 0.13 * R, zl: 11 * s, zB: 4 * s, barrelW: 0.04 * R, rH: 0.3 * R, zH: 11 * s, zHf: 9.4 * s, ex: 1.8, rC: 0.12 * R, zC: 13.2 * s, fillet: 4 * s,
        fams: [{ n: 6, w0: 0.078 * R, w1: 0.062 * R, crown: 2.7 * s, prof: 'groove' }], rivets: { n: 16, d: 3.4 * s }, lugs: { n: 8, r: 0.22 * R, af: clamp(0.055 * R, 4.5, 8) } }); } }
  ];
  const styleById = id => STYLES.find(x => x.id === id) || STYLES[0];

  // ------------------------------------------------------------------ sizes
  function dims(o) {
    o = o || {};
    const key = WHEELS[o.size] ? o.size : 'w10', pr = WHEELS[key], custom = key === 'custom';
    const od = custom && o.od > 0 ? clamp(+o.od, 100, 450) : pr.od;
    const band = Math.round(0.063 * od);                            // the tyre tread band the cover leaves showing
    const cover = o.coverD > 0 ? clamp(+o.coverD, 70, od) : od - 2 * band;
    const axle = AXLES[o.axle] ? AXLES[o.axle].d : o.axle > 0 ? +o.axle : pr.axle;
    return { key, preset: pr, od, width: custom && o.width > 0 ? +o.width : pr.width, axle, cover, R: cover / 2,
      hubD: o.hubD > 0 ? clamp(+o.hubD, 20, cover * 0.6) : Math.round(pr.hub * od / pr.od),
      gripD: o.gripD > 0 ? clamp(+o.gripD, 30, cover - 6) : Math.round(Math.min(pr.grip * od / pr.od, cover - 14)),
      s: clamp(cover / 222, 0.62, 1.3) };
  }

  // ------------------------------------------------------------------ surface
  function baseFn(sp) {
    const { R, lw, zl, zE, crownL, ls, barrelW, zB, rH, zH, zHf, ex, rC, zC, dome, cap, rings } = sp;
    const rL0 = R - lw, rB = rL0 - barrelW, re = Math.min(3, lw * 0.3), ch = Math.max(1.2, Math.abs(zH - zHf) * 0.9), g = 1.5;
    const top0 = rL0 + ls, top1 = R - re;
    const f = r => {
      let z;
      if (cap && r < rC) z = zC - dome * (r / rC) * (r / rC);
      else if (cap && r < rC + g) { const t = (r - rC) / g, zc = zC - dome; z = zc + (zH - zc) * sstep(t) - 0.9 * Math.sin(Math.PI * t); }
      else if (r < rH - ch) z = zH;
      else if (r < rH) z = zH + (zHf - zH) * sstep((r - (rH - ch)) / ch);
      else if (r < rB) z = zB + (zHf - zB) * Math.pow((rB - r) / (rB - rH), ex);
      else if (r < rL0) z = zB;
      else if (r < top0) z = zB + (zl - zB) * sstep((r - rL0) / ls);
      else if (r < top1) z = zl + crownL * Math.sin(Math.PI * (r - top0) / (top1 - top0));
      else z = zE + (zl - zE) * Math.cos((r - top1) / re * Math.PI / 2);
      for (const q of rings) { const t = (r - q.r) / q.w; if (t > -1 && t < 1) { const c = Math.cos(t * Math.PI / 2); z += q.h * c * c; } }
      return z;
    };
    const knots = [rH - ch, rH, rB, rL0, top0, top1, R].concat(cap ? [rC, rC + g / 2, rC + g] : []);
    for (const q of rings) knots.push(q.r - q.w, q.r, q.r + q.w);
    return { f, knots, rL0, rB, top0, top1, re, lipMid: (top0 + top1) / 2, band: top1 - top0 };
  }
  const PROF = {
    round: t => Math.pow(1 - t * t, 0.7),
    flat: t => 1 - Math.pow(t, 8),
    blade: (t, u) => Math.pow(1 - t * t, 0.7) * (0.55 + 0.45 * u),
    groove: t => (1 - Math.pow(t, 8)) - 0.55 * Math.max(0, 1 - (t / 0.42) * (t / 0.42))
  };
  // spoke family helpers: centre angle offset at r, half width at r, split half-angle at r
  function famPrep(f, sp, hand) {
    const r0 = sp.win ? sp.win.r0 : sp.rW0, r1 = sp.win ? sp.win.r1 : sp.rW1;
    const span = Math.max(1, r1 - r0), ph = (f.phase || 0) + Math.PI / 2;
    const tw = f.twist ? f.twist * hand : 0, a = f.tangent ? Math.abs(f.tangent) : 0, sg = f.tangent ? Math.sign(f.tangent) * hand : 0;
    const off = a ? (r => { const q = Math.max(r, a + 1e-6); return sg * (Math.acos(a / q) - Math.acos(Math.min(1, a / Math.max(r0, a + 1e-6)))); })
      : tw ? (r => tw * Math.pow(clamp((r - r0) / span, 0, 1), 1.25)) : (() => 0);
    const w = f.slot ? (r => Math.max(1.2, (TAU * r / f.n - f.slot) / 2)) : (r => f.w0 + (f.w1 - f.w0) * clamp((r - r0) / span, 0, 1));
    const sep = f.split ? (r => f.split * Math.pow(clamp((r - r0) / span, 0, 1), 0.85) / 2) : null;
    return { n: f.n, P: TAU / f.n, ph, off, w, sep, crown: f.crown, prof: PROF[f.prof] || PROF.round, blade: f.prof === 'blade', r0, r1, hand };
  }
  function surfaceFn(sp, hand) {
    const B = baseFn(sp), fams = sp.fams.map(f => famPrep(f, sp, hand)), base = B.f;
    const holeL = sp.holes.filter(h => h.lip);
    const ko = sp.extra === 'knockoff';
    const H = (r, th) => {
      let z = base(r), c = 0;
      for (const F of fams) {
        if (r < F.r0 - 3 || r > F.r1 + 3) continue;
        const fade = sstep((r - (F.r0 - 3)) / 4) * sstep((F.r1 + 3 - r) / 4);
        let d = wrap(th - F.ph - F.off(r), F.P);
        if (F.sep) { const s = F.sep(r) / Math.max(r, 1e-6); const d1 = d - s, d2 = d + s; d = Math.abs(d1) < Math.abs(d2) ? d1 : d2; }
        const w = F.w(r), t = r * Math.abs(d) / w;
        if (t >= 1) continue;
        const u = F.blade ? clamp(Math.sign(d) * F.hand * t, -1, 1) : 0;
        const v = F.crown * F.prof(t, u) * fade;
        if (v > c) c = v;
      }
      z += c;
      for (const h of holeL) {
        const P = TAU / h.n, d = wrap(th - Math.PI / 2 - P / 2, P), dist = Math.hypot(r - h.r, h.r * d), t = (dist - h.d / 2 - 1.8) / 1.8;
        if (t > -1 && t < 1) { const q = Math.cos(t * Math.PI / 2); z += h.lip * q * q; }
      }
      if (ko && r < sp.rC * 2.6 && r > sp.rC * 0.6) { // two-ear knock-off spinner
        const a = th - Math.PI / 4 * hand, x = Math.abs(r * Math.cos(a)), y = Math.abs(r * Math.sin(a)), L = sp.rC * 2.5;
        if (x > sp.rC * 0.7 && x < L) {
          const t = (x - sp.rC) / (L - sp.rC), hw = sp.rC * (0.42 - 0.18 * clamp(t, 0, 1));
          const e = sstep((hw - y) / 1.2) * sstep((L - x) / 1.6);
          z = Math.max(z, z + e * (2.2 * sp.s + 2.4 * sp.s * clamp(t, 0, 1)));
        }
      }
      return z;
    };
    return { H, B, fams };
  }

  // Polar sampling: rings land on every knot of the profile (so its creases stay sharp), each ring halves its point
  // count toward the centre while the spacing stays under `step`.
  function polarRings(R, knots, step, dr) {
    const ks = knots.filter(k => k > 0.05 && k < R - 0.05).sort((a, b) => a - b); ks.push(R);
    const radii = [], crease = []; let prev = 0;
    for (const k of ks) { if (k - prev < 0.04) continue; const n = Math.max(1, Math.ceil((k - prev) / dr)); for (let i = 1; i <= n; i++) { radii.push(prev + (k - prev) * i / n); crease.push(i === n); } prev = k; }
    const NS = Math.max(64, Math.ceil(TAU * R / step / 64) * 64);
    const counts = radii.map(r => { let n = NS; while (n % 2 === 0 && n / 2 >= 24 && TAU * r / (n / 2) <= step) n /= 2; return n; });
    return { radii, counts, NS, crease };
  }
  // A closed polar heightfield solid: flat back at z=0, vertical outer wall, top z = H(r, th).
  function polarMesh(R, H, knots, step, dr) {
    const { radii, counts, NS } = polarRings(R, knots, step, dr);
    let nv = 2 + counts.reduce((a, b) => a + b, 0) + NS;
    const V = new Float32Array(nv * 3), rings = [];
    let vi = 0; const put = (x, y, z) => { V[vi * 3] = x; V[vi * 3 + 1] = y; V[vi * 3 + 2] = z; return vi++; };
    let zmax = -Infinity;
    const c0 = put(0, 0, H(0, 0)); zmax = V[2];
    radii.forEach((r, j) => {
      const n = counts[j], s = vi;
      for (let i = 0; i < n; i++) { const th = TAU * i / n, z = H(r, th); if (z > zmax) zmax = z; put(r * Math.cos(th), r * Math.sin(th), z); }
      rings.push({ s, n });
    });
    const outer = rings[rings.length - 1], bs = vi;
    for (let i = 0; i < outer.n; i++) { const th = TAU * i / outer.n; put(R * Math.cos(th), R * Math.sin(th), 0); }
    const bc = put(0, 0, 0);
    const T = [];
    const r1 = rings[0];
    for (let i = 0; i < r1.n; i++) T.push(c0, r1.s + i, r1.s + (i + 1) % r1.n);
    for (let j = 0; j + 1 < rings.length; j++) {
      const A = rings[j], Bq = rings[j + 1]; let i = 0, k = 0;
      while (i < A.n || k < Bq.n) {
        const ta = (i + 1) / A.n, tb = (k + 1) / Bq.n;
        if (k < Bq.n && (tb <= ta + 1e-12 || i >= A.n)) { T.push(A.s + i % A.n, Bq.s + k % Bq.n, Bq.s + (k + 1) % Bq.n); k++; }
        else { T.push(A.s + i % A.n, Bq.s + k % Bq.n, A.s + (i + 1) % A.n); i++; }
      }
    }
    for (let i = 0; i < outer.n; i++) {
      const a = bs + i, b = bs + (i + 1) % outer.n, ta = outer.s + i, tb = outer.s + (i + 1) % outer.n;
      T.push(a, b, tb, a, tb, ta); T.push(bc, b, a);
    }
    return { V: V.subarray(0, vi * 3), F: Uint32Array.from(T), zmax };
  }

  // Constrained Delaunay triangulation of points xy (flat [x0, y0, x1, y1, ...]) with the loop edges `cons` forced in.
  // par[t] counts (mod 2) the loops a triangle is inside: 0 = outside every loop.
  // Only the first nWall constraints are outlines that flip the parity; the rest only keep their edges.
  function cdt(xy, cons, nWall) {
    const del = new Delaunator(xy), con = new Constrainautor(del), np = xy.length / 2, wallSet = new Set();
    if (nWall == null) nWall = cons.length;
    cons.forEach((e, i) => { con.constrainOne(e[0], e[1]); if (i < nWall) { wallSet.add(e[0] * np + e[1]); wallSet.add(e[1] * np + e[0]); } });
    const isWall = e => con.isConstrained(e) && (nWall === cons.length || wallSet.has(del.triangles[e] * np + del.triangles[e % 3 === 2 ? e - 2 : e + 1]));
    const T = del.triangles, Hh = del.halfedges, nt = T.length / 3, par = new Int8Array(nt).fill(-1), q = new Int32Array(nt);
    let qh = 0, qt = 0;
    for (let e = 0; e < T.length; e++) if (Hh[e] < 0) { const t = (e / 3) | 0; if (par[t] < 0) { par[t] = isWall(e) ? 1 : 0; q[qt++] = t; } }
    while (qh < qt) {
      const t = q[qh++];
      for (let k = 0; k < 3; k++) { const e = 3 * t + k, o = Hh[e]; if (o < 0) continue; const u = (o / 3) | 0; if (par[u] >= 0) continue; par[u] = par[t] ^ (isWall(e) ? 1 : 0); q[qt++] = u; }
    }
    if (qt !== nt) throw new Error('cdt: unreached triangles');
    return { T, par, con, del };
  }
  // The rim face with its windows as one conforming mesh (no boolean): polar rings away from the windows, the exact
  // window outlines as constrained edges, and rows of points following each outline so the spoke edges roll over
  // with a small round (radius rho) instead of a stair-stepped cut. Walls drop straight from the rolled edge to zWall
  // (0 = through, else a pocket floor), the outer wall to the flat back. opt.busy: radial bands [r0, r1] where the
  // face changes round the circle (spokes, hole lips); elsewhere it is a surface of revolution and rings only need
  // the coarser det.astep round.
  function faceMesh(R, H, knots, det, win, opt) {
    const { radii, NS, crease } = polarRings(R, knots, det.step, det.dr), rho = opt.rho, zWall = opt.zWall, solidBack = zWall > 0, busy = opt.busy || [];
    // nested counts (each ring's points are a subset of the next finer ring's), so the grid stays aligned
    const counts = radii.map(r => { const st = busy.some(b => r > b[0] && r < b[1]) ? det.step : det.astep; let n = NS; while (n % 2 === 0 && n / 2 >= 24 && TAU * r / (n / 2) <= st) n /= 2; return n; });
    // window outlines, resampled
    const loops = [];
    for (const L0 of win.loops) {
      const L = resample(L0, det.hb), q = [];
      for (const p of L) { const l = q[q.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 1e-3) q.push(p); }
      while (q.length > 3 && Math.hypot(q[0][0] - q[q.length - 1][0], q[0][1] - q[q.length - 1][1]) <= 1e-3) q.pop();
      if (q.length >= 3) loops.push(q);
    }
    // segment hash of the outlines
    const cs = Math.max(rho + det.step, 1), hash = new Map(), key = (i, j) => i * 100003 + j;
    for (const L of loops) for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], i0 = Math.floor(Math.min(a[0], b[0]) / cs), i1 = Math.floor(Math.max(a[0], b[0]) / cs), j0 = Math.floor(Math.min(a[1], b[1]) / cs), j1 = Math.floor(Math.max(a[1], b[1]) / cs);
      for (let ii = i0; ii <= i1; ii++) for (let jj = j0; jj <= j1; jj++) { const k = key(ii, jj); let c = hash.get(k); if (!c) hash.set(k, c = []); c.push(a[0], a[1], b[0], b[1]); }
    }
    const dist = (x, y) => {
      let m = Infinity; const ci = Math.floor(x / cs), cj = Math.floor(y / cs);
      for (let ii = ci - 1; ii <= ci + 1; ii++) for (let jj = cj - 1; jj <= cj + 1; jj++) {
        const c = hash.get(key(ii, jj)); if (!c) continue;
        for (let k = 0; k < c.length; k += 4) {
          const ax = c[k], ay = c[k + 1], dx = c[k + 2] - ax, dy = c[k + 3] - ay, L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = ax + t * dx - x, ey = ay + t * dy - y, d2 = ex * ex + ey * ey; if (d2 < m) m = d2;
        }
      }
      return Math.sqrt(m);
    };
    const X = [], tq = []; // xy and the roll-over parameter (1 = full height, 0 = on the outline)
    const seen = new Set(), cell = (x, y) => Math.round(x * 50) * 1e6 + Math.round(y * 50);
    const add = (x, y, t, free) => { if (free) { const c = cell(x, y); if (seen.has(c)) return -1; seen.add(c); } X.push(x, y); tq.push(t); return tq.length - 1; };
    const keepOff = rho + 0.45 * det.step;
    // windows rasterised (even-odd scanlines) so points well inside them are not triangulated at all
    const px = 0.25, NX = Math.ceil(2 * R / px) + 2, inWin = new Uint8Array(NX * NX), rows = Array.from({ length: NX }, () => []);
    for (const L of loops) for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], ya = (a[1] + R) / px, yb = (b[1] + R) / px;
      if (ya === yb) continue;
      const j0 = Math.ceil(Math.min(ya, yb) - 0.5), j1 = Math.floor(Math.max(ya, yb) - 0.5 - 1e-9);
      for (let j = Math.max(0, j0); j <= Math.min(NX - 1, j1); j++) { const yc = j + 0.5, t = (yc - ya) / (yb - ya); rows[j].push((a[0] + R) / px + t * ((b[0] - a[0]) / px)); }
    }
    for (let j = 0; j < NX; j++) { const c = rows[j].sort((p, q) => p - q); for (let m = 0; m + 1 < c.length; m += 2) { const i0 = Math.max(0, Math.ceil(c[m] - 0.5)), i1 = Math.min(NX - 1, Math.floor(c[m + 1] - 0.5)); for (let i = i0; i <= i1; i++) inWin[j * NX + i] = 1; } }
    const inside = (x, y) => { const i = Math.floor((x + R) / px), j = Math.floor((y + R) / px); return i >= 0 && j >= 0 && i < NX && j < NX && inWin[j * NX + i] === 1; };
    add(0, 0, 1, true);
    const ringIdx = [], cons = [], bIdx = [];
    radii.forEach((r, j) => {
      const n = counts[j], last = j === radii.length - 1, s = new Int32Array(n).fill(-1);
      for (let i = 0; i < n; i++) { const th = TAU * i / n, x = r * Math.cos(th), y = r * Math.sin(th); if (!last && (dist(x, y) < keepOff || inside(x, y) || (opt.inArm && opt.inArm(r, th)))) continue; s[i] = add(x, y, 1, true); }
      if (last) ringIdx.push(...s);
      // a crease of the profile: keep its ring edges in the triangulation so the shading breaks cleanly along it
      else if (crease[j]) for (let i = 0; i < n; i++) { const a = s[i], b = s[(i + 1) % n], tm = TAU * (i + 0.5) / n; if (a >= 0 && b >= 0 && dist(r * Math.cos(tm), r * Math.sin(tm)) >= keepOff) cons.push([a, b]); }
    });
    const creases = cons.splice(0, cons.length);
    // spoke-aligned lines (they follow each spoke, so its crown runs smooth instead of zig-zagging across the grid)
    if (opt.armPts) for (let i = 0; i < opt.armPts.length; i += 2) { const x = opt.armPts[i], y = opt.armPts[i + 1]; if (dist(x, y) >= rho + 0.3 * det.hb && !inside(x, y)) add(x, y, 1, true); }
    for (const L of loops) { const ids = L.map(p => add(p[0], p[1], 0)); bIdx.push(ids); for (let i = 0; i < ids.length; i++) cons.push([ids[i], ids[(i + 1) % ids.length]]); }
    for (const row of win.insets) for (const L of row.loops) for (const p of respace(L, det.hb * (1 + 1.6 * Math.max(0, row.t - 0.3)))) add(p[0], p[1], row.t, true);
    const xy = Float64Array.from(X), np = tq.length;
    const nWall = cons.length, top = cdt(xy, cons.concat(creases), nWall);
    // vertices: top (only those used by solid triangles), wall feet, back
    const vmap = new Int32Array(np).fill(-1), V = []; let zmax = -Infinity;
    const vert = i => {
      if (vmap[i] >= 0) return vmap[i];
      const x = xy[2 * i], y = xy[2 * i + 1], r = Math.hypot(x, y); let z = H(r, Math.atan2(y, x));
      const t = tq[i]; if (t < 1) { const u = 1 - t; z -= Math.min(rho * (1 - Math.sqrt(Math.max(0, 1 - u * u))), Math.max(0, z - zWall - 0.8)); }
      if (z > zmax) zmax = z; vmap[i] = V.length / 3; V.push(x, y, z); return vmap[i];
    };
    const F = [];
    const Tt = top.T;
    // Delaunator triangles turn clockwise in x/y (y up): flip them so the top faces up
    for (let t = 0; t < Tt.length / 3; t++) if (top.par[t] === 0) F.push(vert(Tt[3 * t]), vert(Tt[3 * t + 2]), vert(Tt[3 * t + 1]));
    const foot = new Map(), feet = (i, z) => { const k = i * 2 + (z > 0 ? 1 : 0); let v = foot.get(k); if (v === undefined) { v = V.length / 3; V.push(xy[2 * i], xy[2 * i + 1], z); foot.set(k, v); } return v; };
    const wall = (u, v, z) => { const a = vert(u), b = vert(v), a0 = feet(u, z), b0 = feet(v, z); F.push(b, a, a0, b, a0, b0); }; // top has u -> v
    for (const ids of bIdx) for (let i = 0; i < ids.length; i++) {
      const a = ids[i], b = ids[(i + 1) % ids.length], e = top.con.findEdge(a, b);
      if (e === Infinity || e < 0) throw new Error('face: outline edge missing');
      const solidAB = top.par[(e / 3) | 0] === 0; // the solid triangle holds a -> b in Delaunator's turn, so b -> a once flipped
      if (solidAB) wall(b, a, zWall); else wall(a, b, zWall);
    }
    for (let i = 0; i < ringIdx.length; i++) wall(ringIdx[i], ringIdx[(i + 1) % ringIdx.length], 0);
    if (!solidBack) {
      // flat back: the outer ring and the outlines, triangulated with the outlines forced in
      const ids = ringIdx.concat(...bIdx), loc = new Map(); ids.forEach((g, i) => loc.set(g, i));
      const bx = new Float64Array(ids.length * 2); ids.forEach((g, i) => { bx[2 * i] = xy[2 * g]; bx[2 * i + 1] = xy[2 * g + 1]; });
      const bc = cdt(bx, cons.map(e => [loc.get(e[0]), loc.get(e[1])]));
      for (let t = 0; t < bc.T.length / 3; t++) if (bc.par[t] === 0) F.push(feet(ids[bc.T[3 * t]], 0), feet(ids[bc.T[3 * t + 1]], 0), feet(ids[bc.T[3 * t + 2]], 0));
    } else {
      const c = V.length / 3; V.push(0, 0, 0);
      for (let i = 0; i < ringIdx.length; i++) F.push(c, feet(ringIdx[(i + 1) % ringIdx.length], 0), feet(ringIdx[i], 0));
      // pocket floors inside the windows, facing up
      const ids = [].concat(...bIdx), loc = new Map(); ids.forEach((g, i) => loc.set(g, i));
      const bx = new Float64Array(ids.length * 2); ids.forEach((g, i) => { bx[2 * i] = xy[2 * g]; bx[2 * i + 1] = xy[2 * g + 1]; });
      const bc = cdt(bx, cons.map(e => [loc.get(e[0]), loc.get(e[1])]));
      for (let t = 0; t < bc.T.length / 3; t++) if (bc.par[t] === 1) F.push(feet(ids[bc.T[3 * t]], zWall), feet(ids[bc.T[3 * t + 2]], zWall), feet(ids[bc.T[3 * t + 1]], zWall));
    }
    return { V: Float32Array.from(V), F: Uint32Array.from(F), zmax };
  }

  // Points along each spoke (centre line and lines across it, every ~step) inside the window band, and a test for
  // "inside a spoke arm" so the polar grid leaves those to the lattice.
  function armLattice(sp, S, det) {
    if (!S.fams.length) return {};
    const r0 = sp.win ? sp.win.r0 : sp.rW0, r1 = sp.win ? sp.win.r1 : sp.rW1, pts = [];
    for (const F of S.fams) {
      const ds = 0.9 * det.step, nr = Math.ceil((r1 - r0) / ds);
      for (let m = 0; m < F.n; m++) for (const sg of F.sep ? [-1, 1] : [0]) {
        for (let q = 0; q <= nr; q++) {
          const r = r0 + (r1 - r0) * q / nr, w = F.w(r), c = F.ph + m * F.P + F.off(r) + (sg ? sg * F.sep(r) / r : 0);
          const nu = Math.max(0, Math.ceil(w / det.step));
          for (let u = -nu; u <= nu; u++) { const a = c + (nu ? u / nu : 0) * w * 0.999 / r; pts.push(r * Math.cos(a), r * Math.sin(a)); }
        }
      }
    }
    const inArm = (r, th) => {
      if (r <= r0 || r >= r1) return false;
      for (const F of S.fams) {
        let d = wrap(th - F.ph - F.off(r), F.P);
        if (F.sep) { const s = F.sep(r) / r, d1 = d - s, d2 = d + s; d = Math.abs(d1) < Math.abs(d2) ? d1 : d2; }
        if (r * Math.abs(d) < F.w(r)) return true;
      }
      return false;
    };
    return { armPts: pts, inArm };
  }

  // ------------------------------------------------------------------ helpers (Manifold)
  function scope(M) {
    const all = [];
    const k = x => { all.push(x); return x; };
    k.free = keep => { for (const x of all) if (!keep || !keep.includes(x)) { try { x.delete(); } catch (e) { /* already freed */ } } all.length = 0; };
    return k;
  }
  const toMan = (M, V, F) => new M.Manifold(new M.Mesh({ numProp: 3, vertProperties: V instanceof Float32Array ? V : Float32Array.from(V), triVerts: F }));
  function ringPolys(polys) { // [{outer, holes}] or [[pts]] -> plain rings
    const out = [];
    for (const P of polys || []) { if (Array.isArray(P)) out.push(P); else { out.push(P.outer); for (const h of P.holes || []) out.push(h); } }
    return out.filter(L => L && L.length >= 3);
  }
  function resample(L, maxd) {
    const out = [];
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxd));
      for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return out;
  }
  function respace(L, d) { // points every d along a closed outline (corners are not kept)
    const out = []; let carry = 0;
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let u = carry; while (u < len) { const t = u / len; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); u += d; }
      carry = u - len;
    }
    return out;
  }
  const area = L => { let s = 0; for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const ccw = L => area(L) < 0 ? L.slice().reverse() : L;
  function arcSlot(rc, thc, len, w, det) {
    const hw = w / 2, a = len / 2 / rc, pts = [], hb = (det || DETAIL.standard).hb, N = Math.max(40, Math.ceil(len / hb)), NE = Math.max(16, Math.ceil(Math.PI * hw / hb));
    for (let i = 0; i <= N; i++) { const t = thc - a + 2 * a * i / N; pts.push([(rc + hw) * Math.cos(t), (rc + hw) * Math.sin(t)]); }
    for (let i = 1; i < NE; i++) { const t = thc + a, q = i / NE * Math.PI, cx = rc * Math.cos(t), cy = rc * Math.sin(t), ux = Math.cos(t), uy = Math.sin(t), vx = -Math.sin(t), vy = Math.cos(t); pts.push([cx + hw * (ux * Math.cos(q) + vx * Math.sin(q)), cy + hw * (uy * Math.cos(q) + vy * Math.sin(q))]); }
    for (let i = N; i >= 0; i--) { const t = thc - a + 2 * a * i / N; pts.push([(rc - hw) * Math.cos(t), (rc - hw) * Math.sin(t)]); }
    for (let i = 1; i < NE; i++) { const t = thc - a, q = Math.PI + i / NE * Math.PI, cx = rc * Math.cos(t), cy = rc * Math.sin(t), ux = Math.cos(t), uy = Math.sin(t), vx = -Math.sin(t), vy = Math.cos(t); pts.push([cx + hw * (ux * Math.cos(q) + vx * Math.sin(q)), cy + hw * (uy * Math.cos(q) + vy * Math.sin(q))]); }
    return ccw(pts);
  }
  const circ = (cx, cy, r, n) => { const p = []; n = n || Math.max(24, Math.ceil(TAU * r / 0.5)); for (let i = 0; i < n; i++) p.push([cx + r * Math.cos(TAU * i / n), cy + r * Math.sin(TAU * i / n)]); return p; };

  // the 2D windows (through the face) for a spec: band between hub and barrel minus the spokes, corners rounded
  function windowsCS(M, k, sp, S, excl, det) {
    det = det || DETAIL.standard;
    const CS = M.CrossSection, pieces = [], seg = r => Math.min(4096, Math.max(128, Math.ceil(TAU * r / det.hb)));
    if (S.fams.length) {
      const r0 = sp.win ? sp.win.r0 : sp.rW0, r1 = sp.win ? sp.win.r1 : sp.rW1;
      const band = k(k(CS.circle(r1, seg(r1))).subtract(k(CS.circle(r0, seg(r0)))));
      const arms = [];
      for (const F of S.fams) {
        const ra = Math.max(0.5, r0 - 4, F.off.length ? 0 : 0), rb = r1 + 4;
        for (let m = 0; m < F.n; m++) {
          for (const sg of F.sep ? [-1, 1] : [0]) {
            const L = [], Rr = [];
            const dr = Math.min(0.8, 1.6 * det.hb), nr = Math.ceil((rb - ra) / dr);
            for (let q = 0; q <= nr; q++) { const r = ra + (rb - ra) * q / nr;
              const c = F.ph + m * F.P + F.off(r) + (sg ? sg * F.sep(r) / r : 0), a = F.w(r) / r;
              L.push([r * Math.cos(c + a), r * Math.sin(c + a)]); Rr.push([r * Math.cos(c - a), r * Math.sin(c - a)]);
            }
            arms.push(ccw(L.concat(Rr.reverse())));
          }
        }
      }
      let w = k(band.subtract(k(new CS(arms, 'NonZero'))));
      if (sp.fillet > 0.05) { const fs = Math.max(64, Math.ceil(TAU * sp.fillet / det.seg)); w = k(k(w.offset(-sp.fillet, 'Round', 2, fs)).offset(sp.fillet, 'Round', 2, fs)); }
      pieces.push(w);
    }
    for (const h of sp.holes) {
      const P = TAU / h.n, polys = [];
      for (let i = 0; i < h.n; i++) {
        const th = Math.PI / 2 + P / 2 + i * P;
        polys.push(h.kind === 'arcslot' ? arcSlot(h.r, th, h.len, h.w, det) : circ(h.r * Math.cos(th), h.r * Math.sin(th), h.d / 2, Math.max(48, Math.ceil(Math.PI * h.d / det.hb))));
      }
      pieces.push(k(new CS(polys, 'NonZero')));
    }
    if (!pieces.length) return null;
    let w = pieces.length === 1 ? pieces[0] : k(CS.union(pieces));
    for (const e of excl) w = k(w.subtract(e));
    // drop crumbs too small to print cleanly (under ~2 mm across)
    const keep = w.toPolygons().filter(L => Math.abs(area(L)) > 3);
    return keep.length ? k(new CS(keep, 'Positive')) : null;
  }

  // text bent round the lip; polys centred on (0, 0) in mm. place: 'top' reads round the top, 'bottom' round the bottom
  function bendText(polys, Rc, place, step) {
    const out = [];
    for (const L of ringPolys(polys)) {
      const q = resample(L, step || 0.5).map(([x, y]) => {
        const th = place === 'bottom' ? -Math.PI / 2 + x / Rc : Math.PI / 2 - x / Rc, r = place === 'bottom' ? Rc - y : Rc + y;
        return [r * Math.cos(th), r * Math.sin(th)];
      });
      out.push(q);
    }
    return out;
  }
  function textSpan(polys, Rc) { let x0 = Infinity, x1 = -Infinity; for (const L of ringPolys(polys)) for (const p of L) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; } return isFinite(x0) ? (x1 - x0) / Rc : 0; }
  function fitPolys(polys, maxW, maxH) { // scale [{outer,holes}] to fit a box, centred
    const R = ringPolys(polys); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const L of R) for (const p of L) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    if (!isFinite(x0)) return [];
    const k = Math.min(maxW / Math.max(1e-9, x1 - x0), maxH / Math.max(1e-9, y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return R.map(L => L.map(p => [(p[0] - cx) * k, (p[1] - cy) * k]));
  }
  function fitCircle(polys, rad) { // scale so every point is within rad of the centre
    const R = ringPolys(polys); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const L of R) for (const p of L) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    if (!isFinite(x0)) return [];
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; let m = 0;
    for (const L of R) for (const p of L) m = Math.max(m, Math.hypot(p[0] - cx, p[1] - cy));
    const k = rad / Math.max(1e-9, m);
    return R.map(L => L.map(p => [(p[0] - cx) * k, (p[1] - cy) * k]));
  }
  // a relief solid following the surface: emboss rises `up` above it, deboss cuts `depth` into it
  function draped(M, k, rings, H, mode, amt, step) {
    if (!rings.length) return null;
    let cs = k(new M.CrossSection(rings, 'EvenOdd'));
    if (cs.isEmpty()) return null;
    const s = k(k(M.Manifold.extrude(cs, 1)).refineToLength(Math.max(0.3, 1.6 * (step || 0.5))));
    const emb = mode !== 'deboss';
    return k(s.warp(v => { const h = H(Math.hypot(v[0], v[1]), Math.atan2(v[1], v[0])); v[2] = v[2] > 0.5 ? h + (emb ? amt : 1.5) : h - (emb ? 0.6 : amt); }));
  }
  function hexNut(M, k, af, h, x, y, z, rot, det) { // chamfered hex with a washer collar and a stud end, sitting at z
    const rc = af / Math.sqrt(3), sg = Math.max(64, Math.ceil(TAU * rc * 1.2 / ((det || DETAIL.standard).seg)) & ~7);
    const hex = k(M.Manifold.cylinder(h, rc, rc, 6));
    const cham = k(M.Manifold.cylinder(h, rc * 1.12, af * 0.36 + (rc * 1.12 - af * 0.36) * 0.15, sg));
    let n = k(hex.intersect(cham));
    n = k(n.add(k(M.Manifold.cylinder(Math.max(0.8, h * 0.18), rc * 1.18, rc * 1.06, sg))));
    n = k(n.add(k(k(M.Manifold.cylinder(h * 0.25, af * 0.3, af * 0.24, Math.max(40, sg >> 1))).translate([0, 0, h - 0.01]))));
    return k(k(n.rotate([0, 0, rot || 0])).translate([x, y, z]));
  }
  // lowest top-surface height under a round footprint, so studs never hang over a sloped face
  function minH(S, x, y, rad) { let z = Infinity; for (let i = 0; i <= 16; i++) { const a = TAU * i / 16, q = i === 16 ? 0 : rad, px = x + q * Math.cos(a), py = y + q * Math.sin(a); z = Math.min(z, S.H(Math.hypot(px, py), Math.atan2(py, px))); } return z; }
  function rivet(M, k, d, x, y, z, det) { return k(k(k(M.Manifold.sphere(d / 2, Math.max(32, Math.ceil(Math.PI * d / ((det || DETAIL.standard).seg)) & ~3))).scale([1, 1, 0.7])).translate([x, y, z - d * 0.12])); }
  // centre pieces that stand on the hub: a stepped elbow poke (cone tiers, wire ribs, two-ear knock-off on the top
  // flat) or a spiked hub cone. Every tier narrows upward and every ledge faces up, so they print face up unsupported.
  const POKE = { min: 20, max: 160, def: 0.6 };   // poke length in mm (default x cover radius)
  function centreLen(kind, R, want) {
    if (kind === 'poke') return clamp(+want > 0 ? +want : POKE.def * R, POKE.min, Math.min(POKE.max, 1.3 * R));
    return clamp(0.42 * R, 14, 60);
  }
  function centreProfile(kind, rb, P) {
    // [r, z] from the base outward-up to the top; tiers narrow upward
    if (kind === 'spike') { const rc = rb, hc = Math.min(0.18 * P, 6); return { pts: [[rc, 0], [rc, hc], [rc * 0.82, hc + 0.8], [0.6, P]], top: 0.6 }; }
    const fr = [1, 0.8, 0.64, 0.5, 0.4], hz = [0, 0.3, 0.55, 0.76, 0.92], pts = [];
    for (let i = 0; i < fr.length; i++) {
      const r0 = rb * fr[i], z0 = P * hz[i], z1 = i + 1 < fr.length ? P * hz[i + 1] : P, r1 = Math.max(r0 * 0.9, r0 - (z1 - z0) * 0.12);
      if (i) pts.push([r0, z0]);  // ledge from the tier below
      pts.push([i ? r0 : rb, z0], [r1, z1 - (i + 1 < fr.length ? 0 : 0)]);
      if (i + 1 < fr.length) pts.push([rb * fr[i + 1], z1]);
    }
    const out = []; for (const q of pts) { const l = out[out.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 1e-6) out.push(q); }
    return { pts: out, top: out[out.length - 1][0] };
  }
  function revolveProfile(M, k, pts, sg) { const poly = [[0, pts[0][1]]].concat(pts, [[0, pts[pts.length - 1][1]]]); return k(M.Manifold.revolve(k(new M.CrossSection([poly.map(p => [Math.max(p[0], 0), p[1]])])), sg)); }
  function centrePiece(M, k, c, rb, det, hand) {
    const sg = Math.max(96, Math.ceil(TAU * rb / (det || DETAIL.standard).seg / 4) * 4), P = c.P, pr = centreProfile(c.kind, rb, P);
    let m = revolveProfile(M, k, pr.pts, sg);
    if (c.kind === 'poke') {
      // ten raised wire ribs running up the tiers, the outer ten spokes of an 84
      const rib = Math.max(1.0, 0.045 * rb), up = 0.9, outer = revolveProfile(M, k, pr.pts.map(([r, z]) => [r > 0.7 ? r + up : r, z]), sg), ribs = [];
      for (let i = 0; i < 10; i++) ribs.push(k(k(k(M.Manifold.cube([rb + 2, rib, P + 2], false)).translate([0, -rib / 2, -1])).rotate([0, 0, 90 + 36 * i + 18])));
      m = k(m.add(k(k(M.Manifold.union(ribs)).intersect(outer))));
      // two-ear knock-off sitting on the top flat (never past its edge)
      const rt = pr.top, hk = Math.max(2.4, 0.12 * rt + 2), core = k(k(M.Manifold.cylinder(hk + 1.2, rt * 0.42, rt * 0.34, 64)).translate([0, 0, P - 0.01]));
      const ear = k(k(k(M.Manifold.cube([2 * rt * 0.94, rt * 0.36, hk], true)).translate([0, 0, P + hk / 2 - 0.01])).rotate([0, 0, 45 * (hand || 1)]));
      const earTop = k(k(M.Manifold.cylinder(hk + 2, rt * 0.94, rt * 0.6, sg)).translate([0, 0, P - 0.02]));
      m = k(M.Manifold.union([m, core, k(ear.intersect(earTop))]));
    }
    return m;
  }
  // a hex lug nut with a long pointed spike cover (tip >= 1.2 mm across so it prints)
  function spikeNut(M, k, af, h, x, y, z, rot, det) {
    const nut = hexNut(M, k, af, h, 0, 0, 0, 0, det), rb = af * 0.42, L = clamp(4 * af, 14, 40), sg = Math.max(48, Math.ceil(TAU * rb / ((det || DETAIL.standard).seg) / 4) * 4);
    const sp = k(k(M.Manifold.cylinder(L, rb, 0.6, sg)).translate([0, 0, h * 0.6]));
    return k(k(k(M.Manifold.union([nut, sp])).rotate([0, 0, rot || 0])).translate([x, y, z]));
  }
  function skipAt(th, spans) { for (const s of spans) { if (Math.abs(wrap(th - s.c, TAU)) < s.h) return true; } return false; }
  function meshOut(m) {
    const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float64Array(F.length * 3);
    for (let i = 0; i < F.length; i++) { const o = F[i] * np; p[i * 3] = V[o]; p[i * 3 + 1] = V[o + 1]; p[i * 3 + 2] = V[o + 2]; }
    return p;
  }

  // spinner face types (the spinner is Pro): 'match' copies the rim style; the others replace the face in Rs units
  const SPIN_TYPES = {
    match: { name: 'Match the rim style' },
    blade3: { name: 'Classic 3-blade floater', make: (R, s) => ({ fams: [{ n: 3, twist: 0.42, w0: 0.2 * R, w1: 0.075 * R, crown: 2.6 * s, prof: 'round' }], fillet: 3.2 * s, holes: [], rings: [], win: null, directional: true, ex: 1.4 }) },
    star5: { name: '5-point star', make: (R, s) => ({ fams: [{ n: 5, w0: 0.16 * R, w1: Math.max(1.6, 0.03 * R), crown: 2.8 * s, prof: 'blade' }], fillet: 1.6 * s, holes: [], rings: [], win: null, directional: false, ex: 1.6 }) },
    disc: { name: 'Floater disc with cutouts', make: (R, s) => ({ fams: [], fillet: 1.2 * s, win: null, directional: false, ex: 0.8,
      holes: [{ kind: 'round', r: 0.64 * R, n: 6, d: 0.2 * R, lip: 0.7 * s }], rings: [{ r: 0.86 * R, w: 1.2, h: -0.5 * s }] }) },
    turbine: { name: 'Twisted turbine', make: (R, s) => ({ fams: [{ n: 12, twist: 1.05, w0: 0.016 * R, w1: 0.032 * R, crown: 2.4 * s, prof: 'blade' }], fillet: 1.2 * s, holes: [], rings: [], win: null, directional: true, ex: 1 }) },
    chrome: { name: 'Chrome blade (4 swept)', make: (R, s) => ({ fams: [{ n: 4, twist: 0.7, w0: 0.1 * R, w1: 0.05 * R, crown: 2.2 * s, prof: 'groove' }], fillet: 2.4 * s, holes: [], rings: [{ r: 0.9 * R, w: 1.1, h: 0.6 * s }], win: null, directional: true, ex: 1.6 }) },
    knockoff: { name: 'Knock-off bar (3-ear)', make: (R, s) => ({ fams: [{ n: 3, w0: 0.11 * R, w1: 0.2 * R, crown: 3.2 * s, prof: 'flat' }], fillet: 2 * s, holes: [], rings: [{ r: 0.9 * R, w: 1.4, h: 0.8 * s }], win: null, directional: false, ex: 1.2 }) }
  };
  const spinType = o => SPIN_TYPES[o && o.spinType] && o.spinType !== 'match' ? o.spinType : 'match';
  // the spinner's sizes without building anything: spinner radius, hub stack, cap and the free face band. A bearing
  // whose hub would leave too little face on this wheel is refused (the UI greys it out with the reason).
  function spinLayout(o, br) {
    br = br || bearingOf(o);
    const d = dims(o), R = d.R, bt = BOLTS[br.bolt], pin = o.retain === 'pin';
    const lwB = Math.max(10, 0.12 * R), gR = 2.5; let Rs = R - lwB - gR, sPos = (o.mount || 'screw') === 'screw' ? screwPos(o) : null, rOs = 0, fallback = false;
    if (sPos && sPos !== 'lugs') {
      rOs = Math.min(SCREW.outerK * d.od, SCREW.tyreK * d.od - SCREW.cb / 2 - 1, R - lwB - SCREW.cb / 2 - 1);
      const RsO = Math.min(Rs, rOs - SCREW.cb / 2 - 1.8);
      if (RsO >= 0.8 * Rs) Rs = RsO; else { fallback = true; sPos = 'lugs'; }
    }
    const capT = 3, stack = pin ? br.B + 3 : br.B + 1.5 + bt.headH + 0.5, hz = stack + capT;
    const capD = Math.max(26, br.ol + 7, Math.min(0.34 * Rs, 46)), capR = capD / 2, rTop = capR + 2.6;
    const ssp = specFor(Object.assign({}, o, { lugs: false }), Rs, d.s * 0.9, true);
    const zB = Math.max(ssp.zB * 0.72, 3.2), zHf = Math.max(ssp.zHf * 0.72, zB + 1.2);
    const rH = rTop + Math.max(1.5, hz - zHf), lw = Math.max(4, 0.06 * Rs), rW1 = Rs - lw - Math.max(1.5, 0.02 * Rs);
    const face = rW1 - rH, need = Math.max(6, 0.15 * Rs);
    return { R, Rs, lwB, gR, sPos, rOs, fallback, capT, stack, hz, capD, capR, rTop, rH, rW1, face, need, ok: face >= need,
      why: face >= need ? '' : `${br.name.split(' (')[0]} needs a ${f1(2 * rH)} mm hub; the ${f1(2 * Rs)} mm spinner on this wheel would keep only ${f1(Math.max(0, face))} mm of face (needs ${f1(need)} mm). Pick a smaller bearing or a bigger wheel.` };
  }
  function bearingFits(o, key) {
    const b = key === 'custom' || (!key && o.bearing === 'custom') ? bearingOf(Object.assign({}, o, { bearing: 'custom' })) : BEARINGS[key || o.bearing] || BEARINGS['608'];
    const L = spinLayout(o, b); return { ok: L.ok, why: L.why, hubD: 2 * L.rH, spinnerD: 2 * L.Rs };
  }

  // ------------------------------------------------------------------ colours
  // 2 or 3 colour rims, print friendly: a cover changes colour only at whole-layer Z heights (a filament swap / pause
  // for one extruder, or separate colour bodies in the 3MF for AMS); spinner kits colour whole parts (no swap at all).
  const COLORS = { layer: 0.2, minSkin: 0.8, presets: {
    gold_black: { name: 'Gold on Black', c: ['#17181a', '#c9a227', '#f1efe8'] },
    chrome_black: { name: 'Chrome & Black', c: ['#17181a', '#c9cdd3', '#f4f4f4'] },
    red_black_silver: { name: 'Red / Black / Silver', c: ['#17181a', '#b5121b', '#c9cdd3'] },
    white_blue: { name: 'White & Blue', c: ['#f1f1ee', '#1d4fc4', '#c9cdd3'] },
    purple_gold: { name: 'Candy Purple & Gold', c: ['#3b0f5e', '#c9a227', '#17181a'] },
    black_lime: { name: 'Black & Lime', c: ['#17181a', '#78cc2a', '#c9cdd3'] } } };
  const colorCount = o => [2, 3].includes(+(o && o.colors)) ? +o.colors : 1;
  function palette(o) {
    const pr = COLORS.presets[o && o.palette] || COLORS.presets.gold_black, h = (o && o.colorHex) || [];
    return [0, 1, 2].map(i => /^#[0-9a-f]{6}$/i.test(h[i] || '') ? h[i].toLowerCase() : pr.c[i]);
  }
  const colorName = hex => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); if (!m) return 'color';
    const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16)), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 60) return 'black'; if (mn > 215) return 'white'; if (mx - mn < 28) return mx > 150 ? 'silver' : 'gray';
    if (r > 150 && g > 120 && b < 90) return 'gold'; if (r > g + 60 && r > b + 60) return 'red'; if (b > r + 40 && b > g) return 'blue';
    if (g > r && g > b) return 'green'; if (r > 90 && b > 90 && g < r - 30) return 'purple'; if (r > 180 && g > 100 && b < 80) return 'orange'; return 'color'; };
  // where to change colour on a part printed face up: the area of upward faces above a candidate height should be a
  // good share of the face (the accent), no flat face may sit just above the cut (it would come out as a skin under a
  // layer or two thick) and no colour island may be a sliver (< 4 mm3 or < minSkin tall)
  function pickSwaps(Core, p, want) {
    const L = COLORS.layer, nt = p.length / 9; let zmax = 0;
    for (let i = 2; i < p.length; i += 3) if (p[i] > zmax) zmax = p[i];
    const nb = Math.ceil(zmax / 0.1) + 2, up = new Float64Array(nb), flat = new Float64Array(nb);
    let A = 0;
    for (let t = 0; t < nt; t++) { const o = t * 9, ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2], vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2];
      const nz = (ux * vy - uy * vx) / 2; if (nz <= 0) continue; const ar = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2, zc = (p[o + 2] + p[o + 5] + p[o + 8]) / 3, b = Math.min(nb - 1, Math.max(0, Math.round(zc / 0.1)));
      up[b] += nz; A += nz; if (nz > 0.97 * ar) flat[b] += nz; }
    const above = new Float64Array(nb + 1); for (let b = nb - 1; b >= 0; b--) above[b] = above[b + 1] + up[b];
    const fracAt = z => above[Math.min(nb, Math.max(0, Math.floor(z / 0.1) + 1))] / (A || 1);
    const flatNear = z => { let f = 0; for (let b = Math.floor(z / 0.1) + 1; b <= Math.min(nb - 1, Math.ceil((z + COLORS.minSkin) / 0.1)); b++) f += flat[b]; return f / (A || 1); };
    const tiny = z => { const zz = Core.nudgePlane(p, 2, z), cp = Core.cutPlane({ p, t: new Int32Array(nt) }, 2, zz, 0, 1), m = cp.pos; if (!m.t.length) return { bad: 99, n: 0 };
      const comps = Core.components(m); let bad = 0, thin = 0;
      for (const c of comps) { let v = 0, zt = -1e9; for (const i of c.tris) { const o = i * 9, P = m.p; v += (P[o] * (P[o + 4] * P[o + 8] - P[o + 5] * P[o + 7]) - P[o + 1] * (P[o + 3] * P[o + 8] - P[o + 5] * P[o + 6]) + P[o + 2] * (P[o + 3] * P[o + 7] - P[o + 4] * P[o + 6])) / 6; zt = Math.max(zt, P[o + 2], P[o + 5], P[o + 8]); }
        if (Math.abs(v) < 0.05) continue; if (Math.abs(v) < 1) bad++; else if (Math.abs(v) < 4 || zt - z < COLORS.minSkin) thin++; }
      return { bad, thin, n: comps.length }; };
    const cands = []; for (let z = Math.ceil(1.2 / L) * L; z < zmax - COLORS.minSkin; z += L) cands.push(+z.toFixed(2));
    const choose = (lo, target, fmin, fmax) => {
      const sc = cands.filter(z => z >= lo).map(z => { const f = fracAt(z); return { z, f, s: Math.abs(f - target) + 4 * flatNear(z) }; }).filter(c => c.f >= fmin && c.f <= fmax).sort((a, b) => a.s - b.s);
      let best = null;
      for (const c of sc.slice(0, 8)) { const t = tiny(c.z); if (t.bad) continue; const q = c.s + 0.025 * t.thin; if (!best || q < best.q) best = Object.assign(c, { q, islands: t.n, thin: t.thin }); }
      return best; };
    const z1 = choose(0, 0.36, 0.14, 0.62); if (!z1) return [];
    if (want < 2) return [z1];
    const z2 = choose(z1.z + 1.0, 0.1, 0.02, 0.24);
    return z2 ? [z1, z2] : [z1];
  }
  // the colour plan of a built rim: swaps (Z heights, layer numbers) and a colour per part or per Z band
  function colorPlan(r, Core) {
    const o = r.o, n = colorCount(o); if (n < 2) return null;
    const pal = palette(o).slice(0, n), parts = {}, warn = [];
    let swaps = [];
    if (o.spinner) {
      for (const pt of r.parts) parts[pt.name] = { ci: pt.role === 'spinner' ? 1 : pt.role === 'cap' ? n - 1 : 0 };
    } else {
      const cv = r.parts.find(pt => pt.role === 'cover');
      const zs = cv ? pickSwaps(Core, cv.p, n - 1) : [];
      if (zs.length < n - 1) warn.push(zs.length ? `Only one color change suits this ${r.style.name} face (nothing stands far enough above it for a third color); it prints in 2 colors.` : 'No clean color change suits this face; it prints in one color.');
      swaps = zs.map((c, i) => ({ z: c.z, layer: Math.round(c.z / COLORS.layer) + 1, to: i + 1, share: c.f, islands: c.islands }));
      for (const pt of r.parts) parts[pt.name] = pt.role === 'cover' ? { zs: swaps.map(w => w.z) } : { ci: 0 };
    }
    const used = new Set([0]); for (const k in parts) { const q = parts[k]; if (q.zs) q.zs.forEach((_, i) => used.add(i + 1)); else used.add(q.ci); }
    return { n, pal, swaps, parts, used: [...used].sort(), layer: COLORS.layer, warn };
  }
  // split a part soup into its colour bands: [{ ci, p }] bottom to top (closed bodies; empty bands dropped)
  function colorBands(Core, p, zs) {
    const out = []; let rest = { p, t: new Int32Array(p.length / 9) };
    (zs || []).forEach((z, i) => { const zz = Core.nudgePlane(rest.p, 2, z), cp = Core.cutPlane(rest, 2, zz, 0, 1);
      if (cp.neg.t.length) out.push({ ci: i, p: Float64Array.from(cp.neg.p) }); rest = { p: Float64Array.from(cp.pos.p), t: new Int32Array(cp.pos.t.length) }; });
    if (rest.t.length) out.push({ ci: (zs || []).length, p: rest.p instanceof Float64Array ? rest.p : Float64Array.from(rest.p) });
    // drop zero-volume debris shells a cut through a knife edge can leave
    for (const b of out) { if (!(zs || []).length) break; const m = { p: b.p, t: new Int32Array(b.p.length / 9) }, comps = Core.components(m); if (comps.length < 2) continue;
      const keep = []; for (const c of comps) { let v = 0; for (const i of c.tris) { const o = i * 9, P = b.p; v += (P[o] * (P[o + 4] * P[o + 8] - P[o + 5] * P[o + 7]) - P[o + 1] * (P[o + 3] * P[o + 8] - P[o + 5] * P[o + 6]) + P[o + 2] * (P[o + 3] * P[o + 7] - P[o + 4] * P[o + 6])) / 6; } if (Math.abs(v) >= 0.05) keep.push(...c.tris); }
      if (keep.length < comps.reduce((a, c) => a + c.tris.length, 0)) { keep.sort((a, c) => a - c); const q = new Float64Array(keep.length * 9); keep.forEach((i, k) => q.set(b.p.subarray(i * 9, i * 9 + 9), k * 9)); b.p = q; } }
    return out.filter(b => b.p.length);
  }

  function partBands(Core, plan, pt) {
    const q = plan.parts[pt.name] || plan.parts[String(pt.name).replace(/_\d+_of_\d+$/, '')] || { ci: 0 };
    return q.zs && q.zs.length ? colorBands(Core, pt.p, q.zs) : [{ ci: q.ci || 0, p: pt.p }];
  }

  // ------------------------------------------------------------------ parts
  function specFor(o, R, s, spin) {
    const st = styleById(o.style), sp = st.make(R, s);
    sp.R = R; sp.s = s; sp.id = st.id;
    if (o.lip > 0 && !spin) sp.lw = clamp(+o.lip, 6, 0.3 * R);
    if (o.spokes > 0 && sp.fams.length && !sp.fams.some(f => f.tangent)) for (const f of sp.fams) f.n = Math.round(clamp(+o.spokes, 3, 24));
    if (o.cap === 'none') sp.cap = false;
    if (o.cap === 'flat') sp.dome = 0.35 * s;
    if (o.lugs === false) sp.lugs = null;
    else if (o.lugs === true && !sp.lugs) sp.lugs = { n: 5, r: Math.max(sp.rC + 6, 0.19 * R), af: clamp(0.05 * R, 4, 7) };
    if (sp.lugs && o.lugN > 0) sp.lugs.n = Math.round(clamp(+o.lugN, 3, 10));
    if (sp.centre) {
      if (o.cap === 'none' || (o.hubSpike === false && sp.centre.kind === 'spike')) sp.centre = null;
      else sp.centre = Object.assign({}, sp.centre, { P: centreLen(sp.centre.kind, R, o.poke) });
    }
    sp.rW0 = sp.rH; sp.rW1 = R - sp.lw - sp.barrelW;
    return sp;
  }

  function coverSolid(M, k, sp, o, hand, extras) {
    extras = extras || {};
    const det = DETAIL[o.detail] || DETAIL.standard;
    const S = surfaceFn(sp, hand), B = S.B;
    // text: measure first so rivets and bolts keep clear of it
    const Rc = B.lipMid, spans = [], textRings = [];
    const tH = clamp(+o.textH || B.band * 0.72, 2, Math.max(2, B.band - 0.6));
    for (const [key, place] of [['text', 'top'], ['text2', 'bottom']]) {
      const polys = extras[key]; if (!polys || !ringPolys(polys).length) continue;
      let P = fitPolys(polys, 1e9, tH); let sp0 = textSpan(P, Rc);
      if (sp0 > 2.6) { P = fitPolys(P, 2.6 * Rc, 1e9); sp0 = 2.6; }  // at most ~150\u00b0 of arc
      spans.push({ c: place === 'top' ? Math.PI / 2 : -Math.PI / 2, h: sp0 / 2 + 0.06 });
      textRings.push(...bendText(P, Rc, place, det.txt));
    }
    const cseg = r => Math.min(4096, Math.max(96, Math.ceil(TAU * r / det.hb)));
    const excl = (extras.excl || []).map(e => k(k(M.CrossSection.circle(e[1], cseg(e[1]))).subtract(k(M.CrossSection.circle(e[0], cseg(e[0]))))));
    for (const d of extras.exclDiscs || []) excl.push(k(M.CrossSection.circle(d[2], cseg(d[2])).translate([d[0], d[1]])));
    // never let a lug nut hang over a window: keep a solid disc under each one
    if (sp.lugs && sp.lugs.n) { const L = sp.lugs, rr = L.af / Math.sqrt(3) * 1.18 + 1.2; for (let i = 0; i < L.n; i++) { const th = Math.PI / 2 + TAU * (i + 0.5) / L.n; excl.push(k(M.CrossSection.circle(rr, cseg(rr)).translate([L.r * Math.cos(th), L.r * Math.sin(th)]))); } }
    const win = windowsCS(M, k, sp, S, excl, det);
    let mesh = null, solid = null, how = 'polar';
    if (win && Delaunator && Constrainautor && o.faceMesh !== false) {
      // one conforming mesh with the windows already open and their edges rolled (fast, exact outlines)
      try {
        const rho = clamp(0.8 * sp.s, 0.45, 1), rs = Math.max(48, Math.ceil(TAU * rho / det.seg));
        const insets = det.rows.map(t => ({ t, loops: k(win.offset(t * rho, 'Round', 2, rs)).toPolygons() }));
        const busy = S.fams.map(F => [F.r0 - 4, F.r1 + 4]);
        for (const h of sp.holes) if (h.lip) busy.push([h.r - h.d / 2 - 4, h.r + h.d / 2 + 4]);
        if (sp.extra === 'knockoff') busy.push([sp.rC * 0.5, sp.rC * 2.7]);
        mesh = faceMesh(sp.R, S.H, B.knots, det, { loops: win.toPolygons(), insets }, Object.assign({ rho, zWall: o.back === 'solid' ? 1.6 : 0, busy }, armLattice(sp, S, det)));
        solid = k(toMan(M, mesh.V, mesh.F));
        const st = solid.status(); if ((st !== 'NoError' && st !== 0) || solid.isEmpty()) throw new Error('face mesh not closed');
        how = 'face';
      } catch (e) { mesh = null; solid = null; }
    }
    if (!solid) {
      // a face with no spokes, hole lips or knock-off is a surface of revolution: rings only need the coarse step round
      const axi = !S.fams.length && !sp.holes.some(h => h.lip) && sp.extra !== 'knockoff';
      mesh = polarMesh(sp.R, S.H, B.knots, axi ? det.astep : det.step, det.dr);
      solid = k(toMan(M, mesh.V, mesh.F));
      if (win) {
        const z0 = o.back === 'solid' ? 1.6 : -1;
        solid = k(solid.subtract(k(k(M.Manifold.extrude(win, mesh.zmax + 6)).translate([0, 0, z0]))));
      }
    }
    const adds = [], cuts = [];
    if (sp.lugs && sp.lugs.n) {
      const L = sp.lugs, h = L.af * 0.9;
      for (let i = 0; i < L.n; i++) { const th = Math.PI / 2 + TAU * (i + 0.5) / L.n, x = L.r * Math.cos(th), y = L.r * Math.sin(th), z = minH(S, x, y, L.af * 0.7) - 0.3;
        adds.push(L.spike && !L.plain ? spikeNut(M, k, L.af, h, x, y, z, th * 180 / Math.PI, det) : hexNut(M, k, L.af, h, x, y, z, th * 180 / Math.PI, det)); }
    }
    if (sp.rivets) {
      const rv = sp.rivets, rr = B.top0 + (B.top1 - B.top0) * (rv.at || 0.5);
      for (let i = 0; i < rv.n; i++) { const th = Math.PI / 2 + TAU * (i + 0.5) / rv.n; if (skipAt(th, spans)) continue; adds.push(rivet(M, k, rv.d, rr * Math.cos(th), rr * Math.sin(th), S.H(rr, th), det)); }
    }
    if (sp.bolts) {
      const bo = sp.bolts, rr = B.lipMid;
      for (let i = 0; i < bo.n; i++) { const th = Math.PI / 2 + TAU * (i + 0.5) / bo.n; if (skipAt(th, spans)) continue; adds.push(hexNut(M, k, bo.af, bo.af * 0.7, rr * Math.cos(th), rr * Math.sin(th), minH(S, rr * Math.cos(th), rr * Math.sin(th), bo.af * 0.7) - 0.3, th * 180 / Math.PI + 15, det)); }
    }
    const tmode = o.textMode === 'deboss' ? 'deboss' : 'emboss';
    const tr = draped(M, k, textRings, S.H, tmode, tmode === 'deboss' ? 0.9 : clamp(+o.textUp || 1, 0.4, 3), det.txt);
    if (tr) (tmode === 'deboss' ? cuts : adds).push(tr);
    for (const a of extras.adds || []) adds.push(a);
    let cz = null;
    if (sp.centre && !(extras.logo && sp.centre.kind === 'spike')) {
      // stands on the hub; its footprint stays inside the solid hub disc so nothing hangs over a window
      const rb = sp.centre.rb || (sp.centre.kind === 'poke' ? Math.min(sp.rH - 1.2, 0.3 * sp.R) : Math.min(sp.rC * 0.92, sp.rH - 1.2)), z0 = minH(S, 0, 0, rb + (sp.centre.kind === 'poke' ? 1.5 : 0)) - 0.3;  // the poke's ribs reach 0.9 mm past its base
      adds.push(k(centrePiece(M, k, sp.centre, rb, det, hand).translate([0, 0, z0]))); cz = { z: z0 + sp.centre.P, r: centreProfile(sp.centre.kind, rb, sp.centre.P).top, kind: sp.centre.kind };
    }
    if (extras.logo && cz && cz.kind === 'poke') {
      // the logo goes on the knock-off core at the tip of the poke
      const lr = fitCircle(extras.logo, cz.r * 0.34), hk = Math.max(2.4, 0.12 * cz.r + 2), zt = cz.z + hk + 1.2 - 0.01;
      const cs = k(new M.CrossSection(lr.map(L => resample(L, det.txt)), 'EvenOdd'));
      if (o.logoMode === 'deboss') cuts.push(k(k(cs.extrude(1.2)).translate([0, 0, zt - 0.8]))); else adds.push(k(k(cs.extrude(clamp(+o.logoUp || 1.0, 0.4, 2))).translate([0, 0, zt - 0.01])));
    } else if (extras.logo && sp.cap && !cz) {
      const lr = fitCircle(extras.logo, sp.rC * 0.84), lm = o.logoMode === 'deboss' ? 'deboss' : 'emboss';
      const lg = draped(M, k, lr.map(L => resample(L, det.txt)), S.H, lm, lm === 'deboss' ? 0.9 : clamp(+o.logoUp || 1.2, 0.4, 3), det.txt);
      if (lg) (lm === 'deboss' ? cuts : adds).push(lg);
    }
    if (adds.length) solid = k(M.Manifold.union([solid].concat(adds)));
    const allCuts = cuts.concat(extras.cuts || []);
    if (allCuts.length) solid = k(solid.subtract(allCuts.length === 1 ? allCuts[0] : k(M.Manifold.union(allCuts))));
    return { solid, S, mesh, spans, textRings: textRings.length, win: !!win, how, centre: cz };
  }

  // clip-in finger ring: printed flange down; in use the flange sits in the groove on the cover's back
  function clipRing(M, k, rg, L, segs) {
    const CS = M.CrossSection, ro = rg - 0.3, ri = ro - 1.9, rf = ro - 6.2, zt = 2 + L, bb = 1.0;
    const n = Math.max(8, Math.round(TAU * rg / 24)), pitch = 360 / n, slot = 2.4 / rg * 180 / Math.PI;
    const prof = new CS([[[ri, 0], [ro, 0], [ro, zt - 3.6], [ro + bb, zt - 3.6 + bb], [ro + bb, zt - 2.1], [ro + 0.2, zt], [ri, zt]]]); k(prof);
    const fl = k(new CS([[[rf, 0], [ro, 0], [ro, 2], [rf, 2]]]));
    const out = [], gap = segs > 1 ? 1.2 / rg * 180 / Math.PI : 0;
    for (let sI = 0; sI < segs; sI++) {
      const a0 = sI * 360 / segs, a1 = (sI + 1) * 360 / segs;
      const parts = [k(k(M.Manifold.revolve(fl, Math.max(24, Math.ceil(256 / segs)), segs > 1 ? a1 - a0 - gap : 360)).rotate([0, 0, segs > 1 ? a0 + gap / 2 : 0]))];
      for (let i = 0; i < n; i++) {
        const c = i * pitch + pitch / 2; if (segs > 1 && (c - (pitch - slot) / 2 < a0 + gap || c + (pitch - slot) / 2 > a1 - gap)) continue;
        parts.push(k(k(M.Manifold.revolve(prof, 24, pitch - slot)).rotate([0, 0, c - (pitch - slot) / 2])));
      }
      let u = k(M.Manifold.union(parts)); if (segs === 2) u = k(u.rotate([0, 0, 45]));  // halves lie on the bed diagonal
      out.push(u);
    }
    return { parts: out, groove: [rf - 0.2, ro + 0.2], fingers: n, reach: L };
  }
  function hubSleeve(M, k, hubD, L) {
    const ri = hubD / 2 + 0.15, ro = ri + 2.4;
    let t = k(k(M.Manifold.cylinder(L, ro, ro, 192)).subtract(k(k(M.Manifold.cylinder(L + 2, ri, ri, 192)).translate([0, 0, -1]))));
    const ribs = [];
    for (let i = 0; i < 8; i++) { const th = TAU * i / 8; ribs.push(k(k(M.Manifold.cylinder(L - 1.5, 0.75, 0.75, 16)).translate([(ri + 0.2) * Math.cos(th), (ri + 0.2) * Math.sin(th), 0]))); }
    t = k(M.Manifold.union([t].concat(ribs)));
    // lead-in chamfer at the open end
    t = k(t.subtract(k(k(M.Manifold.cylinder(1.6, ri - 0.6, ri + 1.0, 192)).translate([0, 0, L - 1.59]))));
    return { part: t, groove: [ri - 0.15, ro + 0.15] };
  }

  // center nut hole: for wheels held on by a nut (often with a washer or bushing) on the axle, a clean bore right
  // through the hub so the rim drops over the hardware. Auto size: the hex nut's corners (a nut is ~1.5 x the axle
  // across flats) + 1.5 mm each side, or a washer / bushing ~2.1 x the axle + 1 mm each side, whichever is bigger.
  const NUT = { min: 16, max: 80 };
  function nutHoleAuto(axle) { const corner = 1.5 * axle * 2 / Math.sqrt(3); return Math.ceil(2 * Math.max(corner + 3, 2.1 * axle + 2)) / 2; }
  function nutHoleD(o, d) { const want = +o.nutD > 0 ? +o.nutD : nutHoleAuto(d.axle); return clamp(want, NUT.min, Math.min(NUT.max, 0.55 * d.R)); }
  // spinner bases keep the bearing post on the axis, so they get a pocket of the same \u00d8 from the back (deep enough for
  // the nut and the axle end), with a flat bridged roof
  function nutPocket(M, k, hr, depth) {
    const D = Math.max(4, depth);
    const m = k(M.Manifold.union([k(k(M.Manifold.cylinder(D + 1, hr, hr, 160)).translate([0, 0, -1])), k(k(M.Manifold.cylinder(1.01, hr + 1, hr, 160)).translate([0, 0, -0.01]))]));
    return { m, pr: hr, rt: hr, D };
  }
  // pocket in the back for the axle end and its push-on cap (cone roof, so it prints face up without supports)
  function axlePocket(M, k, axle, depth) {
    const pr = axle / 2 * 1.75 + 1, D = Math.max(0, depth);
    if (D < 0.5) return null;
    const rt = Math.max(2.5, pr - D);
    return { m: k(k(M.Manifold.cylinder(D + 1, pr + 1, rt, 128)).translate([0, 0, -1])), pr, rt, D };
  }

  // ------------------------------------------------------------------ build
  // o: { size, od, coverD, axle, axleDepth, hubD, gripD, style, spokes, lip, cap, lugs, lugN, back, detail, finish,
  //      textMode, textH, textUp, logoMode, mount, screws, reach, spinner, bearing, fit, retain, gap, hand, bed }
  // extras: { text, text2, logo } outline polygons in mm ([{outer, holes}] or plain rings)
  function build(o, M, extras) {
    o = Object.assign({ size: 'w10', style: 'star5', mount: 'screw', back: 'open', detail: 'standard', textMode: 'emboss', logoMode: 'emboss', bearing: '608', fit: 0.1, retain: 'bolt', gap: 2, hand: 1, reach: 8 }, o || {});
    extras = extras || {};
    const k = scope(M), d = dims(o), st = styleById(o.style), hand = o.hand < 0 ? -1 : 1;
    const parts = [], warn = [], bridges = [], hw = {}, checks = {};
    const bed = o.bed && o.bed[0] > 0 ? o.bed : [256, 256];
    const bedMin = Math.min(bed[0], bed[1]) - 4;
    try {
      if (!o.spinner) {
        const sp = specFor(o, d.R, d.s, false);
        const cutsBack = [], excl = [], exclDiscs = [], padsOut = [];
        let nh = o.nutHole ? nutHoleD(o, d) : 0, hr = nh / 2;
        if (nh && o.mount === 'hub') { const hs0 = hubSleeve(M, k, d.hubD, 4); if (hs0.groove[0] < hr + 2) { warn.push(`The ${f1(nh)} mm nut hole is wider than the hub sleeve groove; use screws or the clip ring with a nut hole. No nut hole made.`); nh = 0; hr = 0; } }
        if (nh) {
          if (+o.nutD > 0 && Math.abs(nh - +o.nutD) > 0.01) warn.push(`The nut hole is limited to ${f1(nh)} mm on this rim.`);
          // open centre: no cap, no centre piece or knock-off over the nut; the hub widens to keep a wall round the bore
          sp.cap = false; if (sp.centre) { sp.centre = null; warn.push('The center nut hole replaces the hub spike / poke.'); }
          if (sp.extra === 'knockoff') sp.extra = null;
          sp.rH = Math.max(sp.rH, hr + 4.5); sp.rW0 = Math.max(sp.rW0, sp.rH); if (sp.win) sp.win = Object.assign({}, sp.win, { r0: Math.max(sp.win.r0, sp.rH + 2) });
          sp.rings = (sp.rings || []).filter(q => q.r - q.w > hr + 2.5);
          if (sp.lugs) { const cr0 = sp.lugs.af / Math.sqrt(3) * 1.18; sp.lugs.r = Math.max(sp.lugs.r, hr + cr0 + 2.5); }
          if (extras.logo) { warn.push('The logo needs the center cap, which the nut hole opens up; the logo is left off.'); extras = Object.assign({}, extras, { logo: null }); }
        }
        let mountParts = [];
        if (o.mount === 'clip') {
          const rg = d.gripD / 2, segs = 2 * rg + 2 > bedMin ? (rg * (1 + Math.SQRT1_2) + 2 <= bedMin ? 2 : 4) : 1;
          const cr = clipRing(M, k, rg, clamp(+o.reach || 8, 4, 20), segs);
          cutsBack.push(k(k(k(M.CrossSection.circle(cr.groove[1], 360)).subtract(k(M.CrossSection.circle(cr.groove[0], 360)))).extrude(2.1).translate([0, 0, -1])));
          bridges.push({ z: 1.1, span: cr.groove[1] - cr.groove[0], what: 'ring groove' });
          excl.push([cr.groove[0] - 2.5, cr.groove[1] + 2.5]);
          mountParts = cr.parts.map((m, i) => ({ m, name: cr.parts.length > 1 ? `clip_ring_${i + 1}_of_${cr.parts.length}` : 'clip_ring', role: 'ring', asm: { flip: true, z: 2 } }));
          hw.ring = { r: rg, fingers: cr.fingers, reach: cr.reach, segs };
        } else if (o.mount === 'hub') {
          const hs = hubSleeve(M, k, d.hubD, clamp(+o.reach || 8, 4, 30) + 2);
          cutsBack.push(k(k(k(M.CrossSection.circle(hs.groove[1], 360)).subtract(k(M.CrossSection.circle(hs.groove[0], 360)))).extrude(2.1).translate([0, 0, -1])));
          bridges.push({ z: 1.1, span: hs.groove[1] - hs.groove[0], what: 'sleeve groove' });
          excl.push([hs.groove[0] - 2.5, hs.groove[1] + 2.5]);
          mountParts = [{ m: hs.part, name: 'hub_sleeve', role: 'ring', asm: { flip: true, z: 2 } }];
          if (hs.groove[1] + 3 > sp.rH) { if (hs.groove[1] + 3 <= 0.5 * d.R) { sp.rH = hs.groove[1] + 3; sp.rW0 = sp.rH; } else warn.push('The hub sleeve is wider than half the rim; check your hub measurement.'); }
        } else if (o.mount === 'screw') {
          const pos = screwPos(o), n = screwCount(o), sets = [];
          if (pos !== 'outer') {
          // the holes go through the lug nuts: one nut per screw, a solid boss kept round each hole
          if (!sp.lugs) sp.lugs = { n: 4, r: Math.max(sp.rC + 7, 0.19 * d.R), af: clamp(0.055 * d.R, 5.5, 8) };
          // nuts wide enough for a 1.6 mm wall round the counterbore
          sp.lugs.n = screwCount(o); sp.lugs.af = Math.max(sp.lugs.af, SCREW.cb + 3.2);
          if (sp.lugs.spike) { sp.lugs.plain = true; warn.push('Screws through the lug nuts replace the spike covers with plain nuts; use Outer rim screws to keep the spikes.'); }
          const L = sp.lugs, pts = [], prA = d.axle / 2 * 1.75 + 1, cr = L.af / Math.sqrt(3) * 1.18, boss = Math.max(SCREW.boss, cr + 1.6);  // cr: the nut's base flange
          // clear the axle pocket in the back (small wheels, big axles) and keep neighbouring nuts apart
          L.r = Math.max(L.r, prA + SCREW.hole / 2 + 2.6, (2 * cr + 1.2) / (2 * Math.sin(Math.PI / L.n)), hr ? hr + cr + 2.5 : 0);
          if (hr && L.r > 0.45 * d.R) warn.push('The lug-nut screws sit far out to clear the nut hole; Outer rim screws suit this wheel better.');
          for (let i = 0; i < L.n; i++) {
            const th = Math.PI / 2 + TAU * (i + 0.5) / L.n, x = L.r * Math.cos(th), y = L.r * Math.sin(th);
            cutsBack.push(k(k(M.Manifold.cylinder(80, SCREW.hole / 2, SCREW.hole / 2, 40)).translate([x, y, -1])));
            cutsBack.push(k(k(M.Manifold.cylinder(80, SCREW.cb / 2, SCREW.cb / 2, 64)).translate([x, y, SCREW.cbZ])));
            exclDiscs.push([x, y, boss]); pts.push([x, y]);
          }
          sets.push({ where: 'lugs', r: L.r, pts, cbZ: SCREW.cbZ, len: screwLen(SCREW.cbZ) });
          }
          if (pos !== 'lugs') {
            // outer rim: just inside the lip (text and rivets live on the lip, so they never meet the bosses), over the
            // wheel's plastic rim, never out over the tyre; a raised round boss on each hole, the face kept solid round it
            const S0 = surfaceFn(sp, hand), B0 = S0.B, bR = SCREW.cb / 2 + 3, keep = bR + 1.2;
            const rO = Math.min(SCREW.outerK * d.od, SCREW.tyreK * d.od - bR, B0.top0 - bR - 0.5);
            const pts = []; let cbMax = 0;
            for (let i = 0; i < n; i++) {
              const th = Math.PI / 2 + TAU * i / n, x = rO * Math.cos(th), y = rO * Math.sin(th);
              let hm = 0; for (let j = 0; j <= 24; j++) { const a = TAU * j / 24, q = j === 24 ? 0 : bR, px = x + q * Math.cos(a), py = y + q * Math.sin(a); hm = Math.max(hm, S0.H(Math.hypot(px, py), Math.atan2(py, px))); }
              const zT = Math.max(6.5, hm + 0.6), cbZ = zT - SCREW.headH; cbMax = Math.max(cbMax, cbZ);
              padsOut.push(k(M.Manifold.union([k(M.Manifold.cylinder(zT - 0.8, bR, bR, 72)), k(k(M.Manifold.cylinder(0.8, bR, bR - 0.8, 72)).translate([0, 0, zT - 0.8]))]).translate([x, y, 0])));
              cutsBack.push(k(k(M.Manifold.cylinder(80, SCREW.hole / 2, SCREW.hole / 2, 40)).translate([x, y, -1])));
              cutsBack.push(k(k(M.Manifold.cylinder(80, SCREW.cb / 2, SCREW.cb / 2, 64)).translate([x, y, cbZ])));
              exclDiscs.push([x, y, keep]); pts.push([x, y, cbZ]);
            }
            sets.push({ where: 'outer', r: rO, pts, cbZ: Math.min(...pts.map(q => q[2])), len: screwLen(cbMax), boss: bR });
          }
          hw.screws = { n, pos, hole: SCREW.hole, cb: SCREW.cb, sets, wheelD: d.od };
        }
        if (nh) {
          // a clean bore right through, a 45\u00b0 lead-in at the back and a 45\u00b0 chamfer where it meets the hub top
          const S1 = surfaceFn(sp, hand); let zTop = 0; for (let j = 0; j < 36; j++) zTop = Math.max(zTop, S1.H(hr + 0.4, TAU * j / 36));
          const sg = Math.max(128, Math.ceil(TAU * hr / 0.6));
          cutsBack.push(k(k(M.Manifold.cylinder(200, hr, hr, sg)).translate([0, 0, -1])));
          cutsBack.push(k(k(M.Manifold.cylinder(1.01, hr + 1, hr, sg)).translate([0, 0, -0.01])));
          cutsBack.push(k(k(M.Manifold.cylinder(60, hr, hr + 60, sg)).translate([0, 0, zTop - 0.8])));
          hw.nutHole = { d: nh, auto: !(+o.nutD > 0), through: true };
        } else { const ap = axlePocket(M, k, d.axle, Math.min(clamp(o.axleDepth == null ? 6 : +o.axleDepth, 0, 20), Math.min(sp.zH, sp.zC) - 3));
          if (ap) { cutsBack.push(ap.m); bridges.push({ z: ap.D, span: 2 * ap.rt, what: 'axle pocket roof' }); hw.axle = { d: d.axle, pocketD: 2 * ap.pr, depth: ap.D }; } }
        if (o.mount === 'tape' && o.back !== 'solid') o = Object.assign({}, o, { back: 'solid' });
        // keep the mount ring band solid: show it as a raised inner ring when it crosses the windows
        for (const e of excl) if (e[1] > sp.rW0 && e[0] < sp.rW1) sp.rings.push({ r: (e[0] + e[1]) / 2, w: (e[1] - e[0]) / 2, h: 0.6 * d.s });
        const cv = coverSolid(M, k, sp, o, hand, Object.assign({}, extras, { excl, exclDiscs, cuts: cutsBack, adds: padsOut }));
        parts.push({ m: cv.solid, name: 'rim_cover', role: 'cover', asm: { z: 0 } });
        for (const mp of mountParts) parts.push(mp);
        checks.textFit = cv.spans.length; checks.mesh = cv.how;
        hw.cover = { R: d.R, lip: sp.lw, band: cv.S.B.band, lipMid: cv.S.B.lipMid, height: cv.mesh.zmax };
      } else {
        // ---------------- spinner: static base with the bearing post, a spinning rim on the bearing, cap, spacers
        let br = bearingOf(o), lay = spinLayout(o, br);
        if (!lay.ok) { warn.push(`${lay.why} Using the 608 instead.`); br = BEARINGS['608']; lay = spinLayout(o, br); }
        const bt = BOLTS[br.bolt], fit = clamp(+o.fit || 0.1, -0.1, 0.5), gap = clamp(+o.gap || 2, 1.5, 4);
        const pin = o.retain === 'pin', R = d.R, s = d.s;
        const lwB = lay.lwB, gR = lay.gR, zf = 3.2, Rs = lay.Rs, rOs = lay.rOs; let sPos = lay.sPos;
        // outer screws go in the base floor outside the spinner (the spinner shrinks to clear the heads); when that
        // would make it too small the screws fall back to the centre of the base
        if (lay.fallback) warn.push('Outer screws would leave too little room for the spinner on this wheel, so they go in the center of the base instead.');
        const shR = (br.d + (br.il - br.d) * 0.85) / 2;                      // shoulder touches the inner race only
        const nhS = o.nutHole ? nutHoleD(o, d) : 0;
        const apS = nhS ? nutPocket(M, k, nhS / 2, clamp(o.axleDepth == null ? Math.round(0.9 * d.axle + 4) : +o.axleDepth, 4, 40)) : axlePocket(M, k, d.axle, clamp(o.axleDepth == null ? 6 : +o.axleDepth, 0, 20)), Dp = apS ? apS.D : 0;
        if (nhS) hw.nutHole = { d: nhS, auto: !(+o.nutD > 0), through: false, depth: Dp };
        let zBt, zS, boltL = 0, floorU = 0;
        if (pin) { zBt = Math.max(zf + 1.2, Dp + 2); zS = zBt + gap; }
        else {
          const need = br.B + 1.5 + gap + bt.nutH + 0.2;
          boltL = LENGTHS.find(L => L >= need) || need; const dl = boltL - need;
          floorU = Math.max(1.2, dl + 0.4) + Dp; zBt = floorU + bt.nutH + 0.2; zS = zBt + gap;
        }
        const capT = lay.capT, hz = lay.hz, capR = lay.capR;
        // base: lip, recessed floor, boss
        const bsp = Object.assign(def(R, s), { R, s, lw: lwB, zl: zS + 5, zE: 3, crownL: 0.4 * s, barrelW: 0, zB: zf, rH: 1, zH: zf, zHf: zf, ex: 1, cap: false, lugs: null,
          rings: [{ r: Rs * 0.55, w: 1.4, h: -0.5 }, { r: Rs * 0.8, w: 1.4, h: -0.5 }], fams: [], holes: [] });
        bsp.rW0 = 1; bsp.rW1 = R - lwB;
        const bossR = Math.max(bt.nut / Math.sqrt(3) + 2.6, shR + 3, 10, apS ? apS.pr + 2.2 : 0);
        const baseExtra = [];
        baseExtra.push(k(M.Manifold.cylinder(zBt, bossR, bossR, 128)));
        baseExtra.push(k(k(M.Manifold.cylinder(Math.min(3, zBt - zf + 0.01) + 0.01, bossR + 3, bossR, 128)).translate([0, 0, zf - 0.01])));
        const baseCuts = [];
        if (pin) {
          baseExtra.push(k(k(M.Manifold.cylinder(gap + 0.01, shR, shR, 96)).translate([0, 0, zBt - 0.01])));
          const pr = br.d / 2 - 0.1, top = zS + br.B + 0.3;
          baseExtra.push(k(k(M.Manifold.cylinder(br.B + 0.31, pr, pr, 96)).translate([0, 0, zS - 0.01])));
          baseExtra.push(k(k(M.Manifold.cylinder(2.32, br.d / 2 + 0.35 + 0.0039, br.d / 2 - 0.55, 96)).translate([0, 0, top - 0.02])));
          baseCuts.push(k(k(M.Manifold.cube([1.6, 2 * br.d, br.B + 6], true)).translate([0, 0, zS + 0.5 + (br.B + 6) / 2])));
          hw.pin = { d: 2 * pr, top: top + 2.3 };
          bridges.push({ z: top, span: 0.45, what: 'pin barb ledge (0.45 mm, prints without support)' });
        } else {
          baseCuts.push(k(k(M.Manifold.cylinder(80, bt.hole / 2, bt.hole / 2, 64)).translate([0, 0, -1])));
          const nr = (bt.nut + 0.3) / Math.sqrt(3);
          baseCuts.push(k(k(M.Manifold.cylinder(bt.nutH + 0.2 + 5, nr, nr, 6)).translate([0, 0, zBt - bt.nutH - 0.2])));
        }
        if (apS) { baseCuts.push(apS.m); bridges.push({ z: Dp, span: 2 * apS.rt, what: 'axle pocket roof' }); hw.axle = { d: d.axle, pocketD: 2 * apS.pr, depth: Dp }; }
        const bExtras = { text: extras.text, text2: extras.text2, cuts: baseCuts };
        // mount features go on the base exactly as on a cover
        const cutsBack = [];
        if (o.mount === 'clip') {
          const rg = d.gripD / 2, segs = 2 * rg + 2 > bedMin ? (rg * (1 + Math.SQRT1_2) + 2 <= bedMin ? 2 : 4) : 1, cr = clipRing(M, k, rg, clamp(+o.reach || 8, 4, 20), segs);
          cutsBack.push(k(k(k(M.CrossSection.circle(cr.groove[1], 360)).subtract(k(M.CrossSection.circle(cr.groove[0], 360)))).extrude(2.1).translate([0, 0, -1])));
          bridges.push({ z: 1.1, span: cr.groove[1] - cr.groove[0], what: 'ring groove' });
          cr.parts.forEach((m, i) => parts.push({ m, name: cr.parts.length > 1 ? `clip_ring_${i + 1}_of_${cr.parts.length}` : 'clip_ring', role: 'ring', asm: { flip: true, z: 2 } }));
          hw.ring = { r: rg, fingers: cr.fingers, reach: cr.reach, segs };
        } else if (o.mount === 'hub') {
          const hs = hubSleeve(M, k, d.hubD, clamp(+o.reach || 8, 4, 30) + 2);
          if (hs.groove[0] < bossR + 3.2) warn.push('The hub sleeve groove would cut the bearing post; use the clip ring or tape for a spinner.');
          else {
            cutsBack.push(k(k(k(M.CrossSection.circle(hs.groove[1], 360)).subtract(k(M.CrossSection.circle(hs.groove[0], 360)))).extrude(2.1).translate([0, 0, -1])));
            bridges.push({ z: 1.1, span: hs.groove[1] - hs.groove[0], what: 'sleeve groove' });
            parts.push({ m: hs.part, name: 'hub_sleeve', role: 'ring', asm: { flip: true, z: 2 } });
          }
        } else if (o.mount === 'screw') {
          const n = screwCount(o), sets = [];
          const ring = (rr, off, where) => { const pts = []; bsp.rings = bsp.rings.filter(q => Math.abs(q.r - rr) > SCREW.cb / 2 + 2 + q.w);  // no floor groove under a screw head
            for (let i = 0; i < n; i++) { const th = Math.PI / 2 + TAU * (i + off) / n, x = rr * Math.cos(th), y = rr * Math.sin(th); pts.push([x, y]); cutsBack.push(k(k(M.Manifold.cylinder(80, SCREW.hole / 2, SCREW.hole / 2, 40)).translate([x, y, -1]))); cutsBack.push(k(k(M.Manifold.cylinder(80, SCREW.cb / 2, SCREW.cb / 2, 64)).translate([x, y, zf - 1.2]))); }
            sets.push({ where, r: rr, pts, cbZ: zf - 1.2, len: screwLen(zf - 1.2) }); };
          // centre: in the base floor under the spinner, clear of the bearing post and the floor grooves
          if (sPos !== 'outer') { ring(Math.max(bossR + 9, Rs * 0.68), 0.5, 'base'); warn.push('Center screw heads sit under the spinner: fit the screws before the spinner goes on.'); }
          // outer: in the base floor between the spinner's edge and the base lip, always reachable
          if (sPos !== 'lugs') ring(rOs, 0, 'base-outer');
          hw.screws = { n, pos: sPos, asked: screwPos(o), hole: SCREW.hole, cb: SCREW.cb, sets, wheelD: d.od };
        }
        bExtras.cuts = baseCuts.concat(cutsBack);
        const bv = coverSolid(M, k, bsp, Object.assign({}, o, { back: 'solid' }), 1, bExtras);
        let base = k(M.Manifold.union([bv.solid].concat(baseExtra)));
        for (const c of bExtras.cuts) base = k(base.subtract(c));
        parts.push({ m: base, name: 'spinner_base', role: 'base', asm: { z: 0 } });

        // spinner: the style at radius Rs, outer ring instead of a lip, a bearing housing hub
        const ssp = specFor(Object.assign({}, o, { lugs: false }), Rs, s * 0.9, true); ssp.centre = null;  // the centre piece rides on the cap
        const zk = 0.72;
        for (const key of ['zB', 'zHf']) ssp[key] *= zk;
        ssp.lw = Math.max(4, 0.06 * Rs); ssp.ls = 1.2; ssp.barrelW = Math.max(1.5, 0.02 * Rs); ssp.zl = ssp.zB + 3.2 * s; ssp.zE = Math.max(2.4, ssp.zl - 2.2); ssp.crownL = 0.3; ssp.rivets = null; ssp.bolts = null;
        ssp.zB = Math.max(ssp.zB, 3.2); ssp.zHf = Math.max(ssp.zHf, ssp.zB + 1.2);
        const rTop = capR + 2.6;
        ssp.cap = false; ssp.zH = hz; ssp.rH = rTop + Math.max(1.5, hz - ssp.zHf) * 1.0; ssp.ex = Math.min(ssp.ex, 1.6);
        ssp.rings = (ssp.rings || []).filter(q => q.r > ssp.rH + 2 && q.r < Rs - ssp.lw - 1);
        if (ssp.extra === 'knockoff') ssp.extra = null;
        ssp.rW0 = ssp.rH; ssp.rW1 = Rs - ssp.lw - ssp.barrelW;
        if (ssp.win) { ssp.win = { r0: Math.max(ssp.rH + 2, ssp.win.r0 * Rs / R), r1: Math.min(ssp.rW1, ssp.win.r1 * Rs / R) }; }
        for (const h of ssp.holes) { h.r *= Rs / R; if (h.d) h.d *= Rs / R; if (h.len) { h.len *= Rs / R; h.w *= Rs / R; } }
        const sType = spinType(o);
        if (sType !== 'match') {
          Object.assign(ssp, SPIN_TYPES[sType].make(Rs, s * 0.9)); ssp.extra = null;
          ssp.rings = ssp.rings.filter(q => q.r > ssp.rH + 2 && q.r < Rs - ssp.lw - 1);
          ssp.holes = ssp.holes.filter(h => h.r - h.d / 2 > ssp.rH + 2.5 && h.r + h.d / 2 < ssp.rW1 - 1.5);
        }
        hw.spinType = sType;
        const seatR = br.D / 2 + fit / 2, cav = br.ol / 2;
        const sCuts = [
          revolveProfile(M, k, [[seatR, -1], [seatR, br.B], [cav, br.B + seatR - cav]], 128),   // seat with a 45\u00b0 roof, no overhang (one piece, no seam slivers)
          k(k(M.Manifold.cylinder(1.2, seatR + 0.8, seatR - 0.4, 128)).translate([0, 0, -0.6])),     // lead-in chamfer
          k(k(M.Manifold.cylinder(hz + 2, cav, cav, 96)).translate([0, 0, -1])),
          k(k(M.Manifold.cylinder(capT + 1, capR, capR, 160)).translate([0, 0, hz - capT]))
        ];
        const sv = coverSolid(M, k, ssp, Object.assign({}, o, { back: 'open' }), hand, { cuts: sCuts });
        parts.push({ m: sv.solid, name: 'spinner', role: 'spinner', asm: { z: zS, spin: true } }); checks.mesh = sv.how;
        // centre cap: press fit with crush ribs, logo on top
        const cR = capR - 0.15, cT = capT - 0.2, dome = 1.6 * s;
        const capSp = { R: cR, lw: 1.2, zl: cT + dome * 0.2, zE: cT - 0.4, crownL: 0, ls: 0.6, barrelW: 0, zB: cT, rH: 0.5, zH: cT + dome, zHf: cT + dome, ex: 1, rC: cR - 1.4, zC: cT + dome, dome: dome * 0.8, cap: true, rings: [], fams: [], holes: [], s };
        capSp.rW0 = 1; capSp.rW1 = cR - 1.2;
        const sCentre = specFor(o, R, s, true).centre;
        if (sCentre) { capSp.centre = Object.assign({}, sCentre, { rb: cR - 1.4, P: sCentre.kind === 'poke' ? Math.min(sCentre.P, 4.5 * cR) : clamp(2.4 * cR, 12, 50) }); capSp.rH = cR; capSp.rC = cR - 1.4; }
        const cv = coverSolid(M, k, capSp, Object.assign({}, o, { textMode: 'emboss' }), 1, { logo: extras.logo });
        const ribs = [];
        for (let i = 0; i < 8; i++) { const th = TAU * i / 8; ribs.push(k(k(M.Manifold.cylinder(cT - 0.3, 0.6, 0.6, 16)).translate([(cR - 0.35) * Math.cos(th), (cR - 0.35) * Math.sin(th), 0]))); }
        parts.push({ m: k(M.Manifold.union([cv.solid].concat(ribs))), name: 'spinner_cap', role: 'cap', asm: { z: zS + hz - capT + 0.2, spin: true } });
        if (!pin) {
          const sp1 = k(k(M.Manifold.cylinder(gap, shR, shR, 96)).subtract(k(k(M.Manifold.cylinder(gap + 2, bt.hole / 2, bt.hole / 2, 64)).translate([0, 0, -1]))));
          const sp2 = k(k(M.Manifold.cylinder(1.5, shR, shR, 96)).subtract(k(k(M.Manifold.cylinder(4, bt.hole / 2, bt.hole / 2, 64)).translate([0, 0, -1]))));
          let sp1m = sp1;
          if (br.d - bt.hole > 1.6) {  // the bore is wider than the bolt: a printed sleeve centres the inner ring
            const so = br.d / 2 - 0.12, sl = k(k(k(M.Manifold.cylinder(br.B - 0.4, so, so - 0.25, 96)).subtract(k(k(M.Manifold.cylinder(br.B + 2, bt.hole / 2, bt.hole / 2, 64)).translate([0, 0, -1])))).translate([0, 0, gap - 0.01]));
            sp1m = k(sp1.add(sl)); hw.sleeve = { od: 2 * so, id: bt.hole, h: br.B - 0.4 };
          }
          parts.push({ m: sp1m, name: 'spacer_lower', role: 'spacer', asm: { z: zBt } });
          parts.push({ m: sp2, name: 'washer_upper', role: 'spacer', asm: { z: zS + br.B, spin: false } });
        }
        Object.assign(hw, { bearing: br, bolt: pin ? null : Object.assign({ size: br.bolt, L: boltL }, bt), zS, zBt, hz, capT, capR, Rs, base: R, shR, floorU, pin, seatR, cav, gap });
        // clearances
        let floorTop = 0; { const Bf = bv.S.B.f; for (let r = bossR + 3.5; r < Rs + gR; r += 0.5) floorTop = Math.max(floorTop, Bf(r)); }
        const spinB = sv.S.B;
        checks.axialGap = zS - Math.max(floorTop, zBt);             // spinner back vs base floor / post top
        checks.radialGap = (R - lwB) - Rs;
        checks.lipOverSpinner = bsp.zl - zS;
        checks.seat = { bore: 2 * seatR, depth: br.B, roofTo: 2 * cav };
        checks.cavityVsHead = pin ? (2 * cav - 2 * (br.d / 2 + 0.35)) : (2 * cav - bt.head);
        checks.stackRoom = pin ? (hz - capT) - (br.B + 2.6) : (hz - capT) - (br.B + 1.5 + bt.headH);
        checks.boltTip = pin ? null : (zS + br.B + 1.5) - boltL - Dp;   // the bolt tip stays above the axle pocket
        checks.spinnerOuter = spinB ? Rs : 0;
        if (2 * Rs > bedMin) warn.push(`The spinner is ${f1(2 * Rs)} mm across, more than your bed; it is cut into pieces to glue (keep them true so it spins evenly).`);
      }
      if (2 * d.R > bedMin) warn.push(`The ${f1(2 * d.R)} mm ${o.spinner ? 'base' : 'cover'} is bigger than your ${Math.round(bed[0])} \u00d7 ${Math.round(bed[1])} mm bed; it is cut into ${d.R * (1 + Math.SQRT1_2) <= bedMin - 4 ? 'halves' : d.R <= bedMin - 4 ? 'quarters' : 'eighths'} with pegs.`);
      for (const pt of parts) {
        const st2 = pt.m.status();
        if (st2 !== 'NoError' && st2 !== 0) throw new Error(`${pt.name}: ${st2}`);
        pt.genus = pt.m.genus(); pt.volume = pt.m.volume();
        pt.pieces = pt.m.decompose ? (() => { const dd = pt.m.decompose(); const n = dd.length; for (const x of dd) x.delete(); return n; })() : 1;
        pt.p = meshOut(pt.m);
      }
    } finally { k.free(); }
    for (const pt of parts) delete pt.m;
    const cover = parts.find(pt => pt.role === 'cover') || parts.find(pt => pt.role === 'base') || parts[0];
    let zmax = 0; for (const pt of parts) { if (pt.role !== 'cover' && pt.role !== 'base' && pt.role !== 'spinner') continue; for (let i = 2; i < pt.p.length; i += 3) if (pt.p[i] + (pt.asm.z || 0) > zmax) zmax = pt.p[i] + (pt.asm.z || 0); }
    const res = { o, d, style: st, parts, warn, bridges, hw, checks, height: zmax, R: d.R, cover };
    if (colorCount(o) > 1) { const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null); if (Core) { res.colorPlan = colorPlan(res, Core); if (res.colorPlan) warn.push(...res.colorPlan.warn); } }
    return res;
  }

  // ------------------------------------------------------------------ export
  function safeName(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'rim'; }
  function bbox(p) { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) { const v = p[i + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; } return { min: mn, max: mx }; }
  // cut parts that are bigger than the bed into pizza slices with pegs (Core.splitRadial), the rest stay whole
  function fitToBed(r, bed, Core) {
    const bm = Math.min(bed[0], bed[1]) - 4, out = [], warn = [];
    for (const pt of r.parts) {
      const b = bbox(pt.p), w = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
      if (w <= bm || !Core || pt.role === 'ring') { out.push(pt); continue; }
      // halves cut on the diagonal fit a square bed up to r(1 + 1/sqrt2); else quarters, then eighths
      const rad = w / 2, halves = rad * (1 + Math.SQRT1_2) <= bm, n = halves ? 2 : rad <= bm ? 4 : 8;
      const conn = { type: 'peg', autoSize: true, diameter: 6, length: 8, perFace: 0, tolerance: 0.15, minWall: 2, magnetDiameter: 6, magnetThickness: 2, shape: 'round', taper: false };
      const sr = Core.splitRadial(pt.p, b, [0, 0], n, halves ? 45 : 0, [], conn, { labels: false });
      const ps = sr.pieces.filter(pc => pc.p.length);
      ps.forEach((pc, i) => out.push(Object.assign({}, pt, { p: Float64Array.from(pc.p), name: `${pt.name}_${i + 1}_of_${ps.length}`, piece: i, of: ps.length })));
      if (sr.open) warn.push(`${sr.open} cut piece(s) of ${pt.name} did not close cleanly.`);
    }
    return { parts: out, warn };
  }
  // lay parts flat on plates: big ones get their own plate, small ones share (shelf packing)
  function plates(parts, bed, gapMM) {
    const g = gapMM || 6, items = parts.map((pt, i) => { const b = bbox(pt.p); return { i, b, w: b.max[0] - b.min[0], h: b.max[1] - b.min[1] }; }).sort((a, b) => b.w * b.h - a.w * a.h);
    const out = []; let cur = null;
    for (const it of items) {
      let placed = false;
      for (const pl of out) {
        if (pl.y + it.h <= bed[1] && pl.x + it.w <= bed[0]) { pl.items.push({ it, x: pl.x, y: pl.y }); pl.x += it.w + g; pl.rowH = Math.max(pl.rowH, it.h); placed = true; break; }
        if (pl.y + pl.rowH + g + it.h <= bed[1] && it.w <= bed[0]) { pl.y += pl.rowH + g; pl.x = 0; pl.rowH = it.h; pl.items.push({ it, x: 0, y: pl.y }); pl.x = it.w + g; placed = true; break; }
      }
      if (!placed) { cur = { x: it.w + g, y: 0, rowH: it.h, items: [{ it, x: 0, y: 0 }] }; out.push(cur); }
    }
    return out.map(pl => pl.items.map(({ it, x, y }) => ({ i: it.i, dx: x - it.b.min[0], dy: y - it.b.min[1] })));
  }
  function readme(r, extra) {
    const o = r.o, d = r.d, hw = r.hw, L = [];
    L.push(`Expressarte trash can rim: ${r.style.name}${o.spinner ? ' spinner' : ''} for a ${d.preset.name === 'Custom' ? f1(d.od) + ' mm' : d.preset.name} (${f1(d.od)} mm) cart wheel`);
    L.push(`Rim face ${f1(2 * d.R)} mm across. Print one set per wheel (two for a normal cart).`);
    L.push('');
    L.push('PRINTING');
    L.push('- Every part prints as laid out: flat side on the bed, no supports.');
    L.push('- Outdoor parts: ASA or PETG (PLA softens in summer sun). 3-4 walls, 20-30% infill, 0.2 mm layers.');
    L.push('- For a chrome look use silk or metallic filament, or prime, sand and spray chrome.');
    if (hw.nutHole) L.push(hw.nutHole.through ? `- Center nut hole: a ${f1(hw.nutHole.d)} mm bore right through the hub${hw.nutHole.auto ? ' (sized from the axle: the nut corners plus a washer)' : ''}. Slide the rim over the nut and washer; the wheel hardware stays on. If it does not clear, measure across the nut corners or the washer, add 3 mm and set that hole size.` : `- Center nut pocket: ${f1(hw.nutHole.d)} mm wide and ${f1(hw.nutHole.depth)} mm deep in the back of the spinner base, so the base drops over the nut, washer and axle end (the bearing post sits on top). Set "Axle end sticks out" to how far the nut and axle stand out of the wheel if it is deeper.`);
    else if (hw.axle) L.push(`- A ${f1(hw.axle.pocketD)} mm pocket, ${f1(hw.axle.depth)} mm deep, in the back clears the axle end and its cap.`);
    if (r.bridges.length) L.push(`- No supports needed. The only flat ceilings are short bridges any slicer handles: ${r.bridges.map(b => `${b.what.replace(/ \(.*$/, '')} ${f1(b.span)} mm`).join(', ')}.`);
    L.push('');
    L.push('MOUNTING');
    const m = o.mount;
    if (m === 'clip' && hw.ring) {
      L.push(`- Clip-in ring: ${hw.ring.fingers} spring fingers, ${f1(hw.ring.reach)} mm long, gripping a ${f1(2 * hw.ring.r)} mm recess.`);
      L.push('  Measure the inside diameter of the recess in your wheel face (where the fingers go) and its depth first; set them in the generator.');
      L.push('  Glue the ring flange into the groove on the back (CA or epoxy), fingers pointing away, then press the rim onto the wheel until it clicks.');
      if (hw.ring.segs > 1) L.push(`  The ring is printed in ${hw.ring.segs} segments that glue into the groove side by side.`);
    } else if (m === 'hub') {
      L.push(`- Hub sleeve: presses over a ${f1(d.hubD)} mm hub boss; the crush ribs take up the slack. Glue the sleeve into the groove on the back.`);
    } else if (m === 'screw') {
      const sc = hw.screws, n = sc ? sc.n : 4, words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'], W = k => words[k] ? words[k][0].toUpperCase() + words[k].slice(1) : String(k);
      const sets = sc ? sc.sets : [], tot = sets.length * n || n;
      const WHERE = { outer: 'near the outer edge, just inside the lip, each on a raised boss that ties the edge to the face', lugs: 'one through each lug nut at the center', base: 'in the base floor under the spinner (center)', 'base-outer': 'in the base floor round the outside of the spinner' };
      L.push(`- Screws: ${tot} x M4 or #8 pan-head screws per wheel (${2 * tot} for a pair).`);
      for (const st of sets) L.push(`  ${W(n)} ${f1(sc.hole)} mm holes on a ${f1(2 * st.r)} mm circle (${Math.round(200 * st.r / sc.wheelD)}% of the ${f1(sc.wheelD)} mm wheel), ${WHERE[st.where] || st.where}, counterbored ${f1(sc.cb)} mm for the heads. Screw length ${st.len} mm.`);
      if (sets.some(st => /outer/.test(st.where))) {
        L.push('  The outer holes sit over the plastic rim of the wheel, inside where the tire starts. Check with the rim held on the wheel: every hole must land on plastic, not on the tire.');
        L.push('  If a hole lands over a gap or a rib in your wheel face, turn the rim a little until all of them are on solid plastic.');
      }
      L.push('  Hold the rim on the wheel, mark through the holes, pre-drill 3 mm pilot holes about 12 mm deep (2.5 mm in soft HDPE), then drive the screws until snug. Do not crush the print.');
      if (hw.screwNote) L.push('  ' + hw.screwNote);
    } else L.push('- Flat back: clean the wheel with alcohol and stick the rim on with outdoor VHB tape (pads on the hub and lip).');
    if (o.spinner && hw.bearing) {
      const b = hw.bearing;
      L.push('');
      L.push('SPINNER: WHAT TO BUY (per wheel)');
      L.push(`- 1 x ${b.custom ? 'ball' : b.name.split(' (')[0]} bearing (${b.d} x ${b.D} x ${b.B} mm bore x OD x width).${b.sold ? ' Sold by Bambu Lab (Maker\'s Supply > bearings);' : ''}${b.d === 8 && b.D === 22 ? ' any skateboard-shop 608 also works.' : ''}`);
      if (hw.spinType && hw.spinType !== 'match') L.push(`- Spinner type: ${SPIN_TYPES[hw.spinType].name}.`);
      if (hw.bolt) {
        L.push(`- 1 x ${hw.bolt.size} x ${hw.bolt.L} mm socket head cap screw and 1 x ${hw.bolt.size} hex nut (thread locker recommended).`);
        L.push('');
        L.push('SPINNER: ASSEMBLY');
        L.push('1. Push the nut into the hex pocket in the base post.');
        L.push('2. Press the bearing into the back of the spinner until it stops (a vice or clamp helps; the seat is a light press fit).');
        L.push(`3. Lower spacer on the post${hw.sleeve ? ` (its ${f1(hw.sleeve.od)} mm sleeve centers the bearing's ${b.d} mm bore on the bolt)` : ''}, spinner on top, upper washer on the bearing, then the screw down through it all into the nut.`);
        L.push('4. Snug the screw (the inner ring is clamped, the spinner turns on the bearing). Press the center cap into the hub.');
      } else {
        L.push('');
        L.push('SPINNER: ASSEMBLY');
        L.push('1. Press the bearing into the back of the spinner.');
        L.push('2. Push the spinner straight down over the printed snap pin until the barb clicks over the bearing.');
        L.push('3. Press the center cap into the hub.');
      }
      L.push(`- Bearing seat bore ${f1(2 * hw.seatR)} mm for a ${b.D} mm bearing (fit ${o.fit} mm). If it is loose, glue it; if too tight, raise the fit and reprint the spinner.`);
      L.push(`- Spinner gap to the base: ${f1(hw.gap)} mm.`);
    }
    if (r.colorPlan) {
      const cp = r.colorPlan, nm = i => `color ${i + 1} (${colorName(cp.pal[i])}, ${cp.pal[i]})`;
      L.push('');
      L.push(`COLORS (${cp.n})`);
      L.push(`- ${cp.pal.map((c, i) => nm(i)).join(', ')}.`);
      if (cp.swaps.length) {
        L.push(`- The rim changes color at whole layers only (0.2 mm layers, face up): it starts in ${nm(0)}.`);
        for (const w of cp.swaps) L.push(`  Change to ${nm(w.to)} at Z ${w.z.toFixed(2)} mm: pause before layer ${w.layer} (the first layer above ${w.z.toFixed(2)} mm).`);
        L.push('- One extruder: add a pause / filament change at those layers in your slicer and swap the filament. Multi-material: open the 3MF; each part is already split into its color bodies with the extruders set (also in colour_bodies/ as STLs). Use 0.2 mm layers so the change lands exactly on a layer.');
      }
      for (const [k, q] of Object.entries(cp.parts)) if (!q.zs) L.push(`- ${k}: ${nm(q.ci)} (a whole part, no swap).`);
    }
    L.push('');
    L.push('PARTS');
    for (const pt of r.parts) L.push(`- ${pt.name}`);
    if (r.warn.length) { L.push(''); L.push('NOTES'); for (const w of r.warn) L.push('- ' + w); }
    for (const e of extra || []) L.push(e);
    L.push('');
    L.push('Made with Expressarte. Keep it legal: rims must not stop the wheel turning or stick out past the lid.');
    return L.join('\n') + '\n';
  }
  // files: STL per part (+ README) and a 3MF with the parts laid out on plates
  function files(r, opt) {
    opt = opt || {};
    const Core = opt.Core || G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
    const Tools = opt.Tools || G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
    const bed = opt.bed || r.o.bed || [256, 256];
    const fit = fitToBed(r, bed, Core), dir = safeName(opt.name || `rim_${r.style.id}${r.o.spinner ? '_spinner' : ''}`);
    let list = fit.parts.map((pt, i) => ({ name: `${dir}/${String(i + 1).padStart(2, '0')}_${pt.name}.stl`, data: new Uint8Array(Core.writeSTL(pt.p, pt.name)) }));
    // color: every part as its color bodies too (an AMS imports them as one object with a part per color)
    const plan = r.colorPlan, bands = plan ? fit.parts.map(pt => partBands(Core, plan, pt)) : null;
    if (plan) fit.parts.forEach((pt, i) => { if (bands[i].length < 2) return; for (const b of bands[i]) list.push({ name: `${dir}/color_bodies/${String(i + 1).padStart(2, '0')}_${pt.name}__color${b.ci + 1}_${colorName(plan.pal[b.ci])}.stl`, data: new Uint8Array(Core.writeSTL(b.p, `${pt.name} colour ${b.ci + 1}`)) }); });
    list.push({ name: `${dir}/README.txt`, data: new TextEncoder().encode(readme(Object.assign({}, r, { parts: fit.parts, warn: r.warn.concat(fit.warn) }), opt.readmeExtra)) });
    let mf = null;
    if (opt.threeMF !== false && Tools) {
      const pl = plates(fit.parts, [bed[0] - 6, bed[1] - 6]), objs = [], ids = [];
      const fb = opt.fullBed || bed, off = opt.offset || [3, 3];
      pl.forEach((items, s) => {
        const org = Tools.bambuPlateOrigin ? Tools.bambuPlateOrigin(s, pl.length, fb[0], fb[1]) : [0, 0];
        const row = [];
        for (const it of items) {
          const src = fit.parts[it.i].p, q = new Float64Array(src.length);
          for (let k = 0; k < q.length; k += 3) { q[k] = src[k] + it.dx + off[0] + org[0]; q[k + 1] = src[k + 1] + it.dy + off[1] + org[1]; q[k + 2] = src[k + 2]; }
          row.push(objs.length);
          const mv = src2 => { const w = new Float64Array(src2.length); for (let k = 0; k < w.length; k += 3) { w[k] = src2[k] + it.dx + off[0] + org[0]; w[k + 1] = src2[k + 1] + it.dy + off[1] + org[1]; w[k + 2] = src2[k + 2]; } return w; };
          const bb = bands && bands[it.i];
          if (bb && bb.length > 1) objs.push({ name: fit.parts[it.i].name, parts: bb.map(b => ({ name: `${fit.parts[it.i].name} color ${b.ci + 1}`, p: mv(b.p), extruder: b.ci + 1 })) });
          else objs.push({ name: fit.parts[it.i].name, p: q, extruder: bb && bb[0] ? bb[0].ci + 1 : 1 });
        }
        ids.push(row);
      });
      mf = Tools.threeMF(objs, { title: opt.title || dir, plates: ids, bambu: opt.bambu || null, filaments: plan ? plan.pal.map(c => ({ color: c })) : undefined });
    }
    return { files: list, threeMF: mf, parts: fit.parts, warn: fit.warn, dir };
  }

  // smooth vertex normals for the preview (crease angle keeps hard edges hard), one per soup vertex
  function normals(p, creaseDeg) {
    const nt = p.length / 9, fn = new Float32Array(nt * 3), cosC = Math.cos((creaseDeg || 38) * Math.PI / 180);
    const map = new Map(), vid = new Int32Array(nt * 3); let nv = 0;
    for (let i = 0; i < nt * 3; i++) { const key = Math.round(p[i * 3] * 1e4) + ',' + Math.round(p[i * 3 + 1] * 1e4) + ',' + Math.round(p[i * 3 + 2] * 1e4); let v = map.get(key); if (v === undefined) { v = nv++; map.set(key, v); } vid[i] = v; }
    for (let t = 0; t < nt; t++) {
      const o = t * 9, ax = p[o + 3] - p[o], ay = p[o + 4] - p[o + 1], az = p[o + 5] - p[o + 2], bx = p[o + 6] - p[o], by = p[o + 7] - p[o + 1], bz = p[o + 8] - p[o + 2];
      fn[t * 3] = ay * bz - az * by; fn[t * 3 + 1] = az * bx - ax * bz; fn[t * 3 + 2] = ax * by - ay * bx;  // area weighted
    }
    const cnt = new Int32Array(nv + 1); for (let i = 0; i < nt * 3; i++) cnt[vid[i] + 1]++;
    for (let i = 0; i < nv; i++) cnt[i + 1] += cnt[i];
    const fill = cnt.slice(), lst = new Int32Array(nt * 3); for (let i = 0; i < nt * 3; i++) lst[fill[vid[i]]++] = (i / 3) | 0;
    const unit = new Float32Array(nt * 3); for (let t = 0; t < nt; t++) { const l = Math.hypot(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]) || 1; unit[t * 3] = fn[t * 3] / l; unit[t * 3 + 1] = fn[t * 3 + 1] / l; unit[t * 3 + 2] = fn[t * 3 + 2] / l; }
    const N = new Float32Array(nt * 9);
    for (let i = 0; i < nt * 3; i++) {
      const t = (i / 3) | 0, v = vid[i]; let x = 0, y = 0, z = 0;
      for (let j = cnt[v]; j < cnt[v + 1]; j++) { const u = lst[j]; if (unit[u * 3] * unit[t * 3] + unit[u * 3 + 1] * unit[t * 3 + 1] + unit[u * 3 + 2] * unit[t * 3 + 2] >= cosC) { x += fn[u * 3]; y += fn[u * 3 + 1]; z += fn[u * 3 + 2]; } }
      const l = Math.hypot(x, y, z) || 1; N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
    }
    return N;
  }
  function pixelText(str, h) { // block-font text outline in mm, centered (for tests and as a fallback)
    const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
    const tl = Core.textLoops(String(str).toUpperCase().replace(/[^0-9A-Z\- ]/g, ''));
    return fitPolys(tl.loops.map(L => L.map(p => [p[0], -p[1]])), 1e9, h);
  }
  function isPro(o) {
    const why = [];
    if (styleById(o.style).pro) why.push('Showroom rim style');
    if (o.logo) why.push('Logo center cap');
    if (o.spinner) why.push('Spinner');
    if (o.detail === 'fine') why.push('Fine detail');
    if (colorCount(o) > 1) why.push(`${colorCount(o)}-color export`);
    return why;
  }

  function centreH(sp, r) { const c = sp.centre; if (!c) return null; const rb = c.rb || (c.kind === 'poke' ? Math.min(sp.rH - 1.2, 0.3 * sp.R) : Math.min(sp.rC * 0.92, sp.rH - 1.2)); if (r > rb) return null; const pr = centreProfile(c.kind, rb, c.P).pts; let z = 0; for (const [pr0, pz] of pr) if (pr0 >= r) z = Math.max(z, pz); return z; }
  const api = { NUT, nutHoleAuto, nutHoleD, COLORS, colorCount, palette, colorName, colorPlan, colorBands, partBands, POKE, centreH, SPIN_TYPES, spinType, spinLayout, bearingFits, bearingOf, BRG_CUSTOM, WHEELS, AXLES, BEARINGS, BOLTS, LENGTHS, MOUNTS, SCREW, screwDefault, screwCount, screwPos, screwLen, FINISHES, DETAIL, STYLES, styleById, dims, specFor, surfaceFn, polarMesh, build, files, fitToBed, plates, readme, normals, pixelText, bendText, isPro, safeName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPRims = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
