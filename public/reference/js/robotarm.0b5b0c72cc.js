/* Expressarte robot arm generator: a desktop servo arm you print flat and bolt together with hobby servos.

   Layout (world: Z up, the arm reaches along +X at base yaw 0, every pitch axis is along Y):
   - base: a pedestal that holds the base servo upright (shaft up) in a blind pocket, a wire tunnel to the back, an
     optional collar that hides the gap under the turntable, desk screw holes, an optional ball race and raised text.
   - turret: the turntable disc (bolted to the base servo horn from below) with a fork on top: a gusseted cheek that
     holds the shoulder servo (shaft along +Y), a bridge block, and a bolt-on idler bracket on the far side with a ball
     bearing (a plain pivot for micro servos) coaxial with the shaft, so the upper arm is held on both sides.
   - upper arm and forearm: boxed U-channels (a web plus side walls and cross ribs). The proximal end bolts to a servo
     horn (recess + screw holes) and carries a bolt-on pivot hub whose stub turns in the idler bearing; the distal end
     holds the next servo in a through pocket (tabs on the web) boxed in by the walls. The elbow idler bracket bolts
     under the upper arm. Servos alternate sides so the arm stays close to the center plane. Boxed or lighter (web
     windows) style, optional zip-tie slots.
   - wrist (5 or 6 joints): a short plate on the wrist pitch horn. With 5 joints it is also the gripper base; with 6 it
     carries the wrist roll servo in an end plate and a separate gripper base bolts to the roll horn.
   - gripper: two meshing spur gears with fingers (drive gear on the gripper servo horn, idler gear on an M3 screw
     through a printed standoff). Claw, curved hook or wide jaw fingers.
   - fit test: a small coupon with each servo pocket and horn recess, to check the fit before the big parts.

   Servo frame (every pocket and horn is placed with one): origin on the shaft axis in the plane of the underside of
   the mounting tabs, +Z out along the shaft, the body center at x = -off. Part frames for horns: z = 0 is the face
   that sits on the horn and the recess goes into +z.

   Every printable part is built with Manifold (WebAssembly) booleans, so it is one closed solid. Servo numbers come
   from public drawings of the common hobby servo classes; the pockets add the fit tolerance on every side and the
   tab holes are short slots because ear spacing varies between makers. */
(function (G) {
  'use strict';
  const Core = G.SplitCore || (typeof require === 'function' ? require('./core.js') : null);
  const Tools = G.StudioTools || (typeof require === 'function' ? require('./tools.js') : null);
  let Bubble = G.GPBubble || null;
  if (!Bubble && typeof require === 'function') { try { Bubble = require('./bubble.js'); } catch (e) { Bubble = null; } }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => { const x = +v; return Number.isFinite(x) ? x : d; };
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------- servo and horn catalog (mm)
  // L/W body, below: tab underside to body bottom, caseTop: tab underside to case top, span: tab tip to tip,
  // holeX: ear hole spacing along the body, holeY: row spacing (0 = one row), slot: extra slot length for maker
  // variation, pilot: screw pilot hole, off: shaft offset from the body center, splineTop: tab underside to spline top
  const SERVOS = {
    std: { label: 'Standard 40 mm servo (metal gear, about 11 kg\u00b7cm)', short: 'standard 40 mm servo', cls: 'standard', L: 40.9, W: 20.0, below: 26.8, caseTop: 10.2, tabT: 2.4, span: 54.0, holeX: 49.0, holeY: 10.0, slot: 1.6, pilot: 2.6, off: 10.15, splineTop: 15.9, splineD: 6.0, teeth: 25, horn: 'disc', torque: 11, mass: 55, stall: 2.5, screw: 'M3 \u00d7 12 mm pan head', free: true },
    stdht: { label: 'High-torque 40 mm servo (metal gear, 20 kg\u00b7cm or more)', short: 'high-torque 40 mm servo', cls: 'standard', L: 40.0, W: 20.0, below: 27.7, caseTop: 12.7, tabT: 2.4, span: 54.5, holeX: 49.5, holeY: 10.0, slot: 1.6, pilot: 2.6, off: 10.0, splineTop: 16.8, splineD: 5.9, teeth: 25, horn: 'disc', torque: 20, mass: 60, stall: 3.0, screw: 'M3 \u00d7 12 mm pan head', free: true },
    micromg: { label: 'Micro 9 g servo, metal gear (about 2.2 kg\u00b7cm)', short: 'micro 9 g metal-gear servo', cls: 'micro', L: 22.8, W: 12.4, below: 18.5, caseTop: 9.9, tabT: 2.0, span: 32.1, holeX: 27.2, holeY: 0, slot: 0.8, pilot: 1.7, off: 5.3, splineTop: 14.0, splineD: 4.8, teeth: 21, horn: 'arm2', torque: 2.2, mass: 13.4, stall: 0.7, screw: 'M2 \u00d7 8 mm self-tapping (in the servo bag)', free: true },
    micro: { label: 'Micro 9 g servo, plastic gear (about 1.8 kg\u00b7cm)', short: 'micro 9 g servo', cls: 'micro', L: 22.7, W: 12.2, below: 17.0, caseTop: 10.0, tabT: 2.0, span: 32.3, holeX: 27.2, holeY: 0, slot: 0.8, pilot: 1.7, off: 5.3, splineTop: 13.3, splineD: 4.8, teeth: 21, horn: 'arm2', torque: 1.8, mass: 9, stall: 0.65, screw: 'M2 \u00d7 8 mm self-tapping (in the servo bag)', free: true },
    custom: { label: 'Custom size (enter your servo)', short: 'custom servo', cls: 'custom', free: false }
  };
  const SERVO_IDS = ['std', 'stdht', 'micromg', 'micro', 'custom'];
  // T: horn thickness that sits in the recess; above: horn top face above the spline top; center: through hole for the
  // horn screw and a screwdriver
  const HORNS = {
    disc: { label: 'round metal disc horn, 25-tooth, 20 mm across, four M3 holes on a 14 mm circle', D: 20, T: 2.0, above: 0.5, bc: 14, holeD: 3.3, cb: 6.4, cbDepth: 3, center: 7.5 },
    arm2: { label: 'two-arm plastic horn (in the servo bag)', hub: 7.4, len: 17.5, w0: 6.4, w1: 4.2, T: 1.6, above: 1.0, pilots: [10.6, 14.8], pilotD: 1.4, center: 5.2 },
    arm1: { label: 'single-arm plastic horn (in the servo bag)', hub: 7.4, len: 17.5, w0: 6.4, w1: 4.2, T: 1.6, above: 1.0, pilots: [10.6, 14.8], pilotD: 1.4, center: 5.2 }
  };
  const GRIPS = {
    claw: { label: 'Claw', free: true, note: 'Straight fingers with flat pads' },
    hook: { label: 'Curved hook', free: false, note: 'Curved fingers with grip teeth, good for round things' },
    wide: { label: 'Wide jaw', free: false, note: 'Tall flat jaw pads for boxes, cans and blocks' }
  };
  const PALETTE = [
    { name: 'White', hex: '#F5F5F0' }, { name: 'Black', hex: '#1E1E1E' }, { name: 'Gray', hex: '#8A8D91' }, { name: 'Red', hex: '#C8102E' },
    { name: 'Orange', hex: '#E8730C' }, { name: 'Yellow', hex: '#F5C518' }, { name: 'Green', hex: '#1E9B4F' }, { name: 'Blue', hex: '#2F6FD0' },
    { name: 'Purple', hex: '#7B4FB8' }, { name: 'Teal', hex: '#1D9A8A' }
  ];
  const SUGGEST = { // starting sizes per main servo class
    standard: { upperLen: 120, foreLen: 110, wristLen: 42, plateT: 6, wall: 5, baseSize: 150, turntableD: 104, fingerLen: 45, opening: 45, fingerW: 7, fingerT: 5 },
    micro: { upperLen: 80, foreLen: 80, wristLen: 38, plateT: 4, wall: 3.5, baseSize: 110, turntableD: 74, fingerLen: 40, opening: 35, fingerW: 6, fingerT: 4.5 }
  };
  const PZ = ((typeof SplitCore !== 'undefined' && SplitCore) || (typeof require === 'function' ? require('./core.js') : {})).PASTELS;
  const DEFAULTS = {
    dof: 5, mainServo: 'std', smallServo: 'micromg', fit: 0.25, upperLen: 120, foreLen: 110, wristLen: 42, shoulderLift: 6,
    baseSize: 150, baseShape: 'square', turntableD: 104, plateT: 6, wall: 5, style: 'box',
    grip: 'claw', fingerLen: 45, opening: 45, fingerW: 7, fingerT: 5, padH: 16,
    collar: true, mountHoles: true, ballRace: false, ballD: 6, cable: false, baseText: '', textH: 10, font: 'round', fitTest: true,
    payload: 50, colors: { frame: PZ.babyBlue, accent: '', text: '#1E1E1E' }, custom: null, bed: [256, 256], bambu: 'A1', detail: 'hd', gap: 6
  };
  const CUSTOM_DEFAULT = { L: 40.5, W: 20, below: 27, caseTop: 11, span: 54, holeX: 49.5, holeY: 10, off: 10, splineTop: 16, horn: 'disc', torque: 10, mass: 60 };

  function servoSpec(id, custom) {
    if (id !== 'custom') return { id, ...SERVOS[id] };
    const c = { ...CUSTOM_DEFAULT, ...(custom || {}) };
    const L = clamp(num(c.L, 40.5), 15, 70), W = clamp(num(c.W, 20), 8, 40), micro = L < 30;
    const s = {
      id: 'custom', label: `Custom servo ${L} \u00d7 ${W} mm`, short: 'custom servo', cls: 'custom', L, W,
      below: clamp(num(c.below, 27), 8, 60), caseTop: clamp(num(c.caseTop, 11), 3, 30), tabT: 2.4,
      span: clamp(num(c.span, 54), L + 4, L + 30), holeX: 0, holeY: clamp(num(c.holeY, 10), 0, W - 3),
      slot: 1.6, pilot: micro ? 1.7 : 2.6, off: clamp(num(c.off, 10), 0, L / 2 - 2), splineTop: clamp(num(c.splineTop, 16), 6, 40),
      splineD: micro ? 4.8 : 6, teeth: 0, horn: c.horn === 'arm2' ? 'arm2' : 'disc', torque: clamp(num(c.torque, 10), 0.5, 80), mass: clamp(num(c.mass, 60), 5, 300),
      stall: micro ? 0.7 : 2.5, screw: micro ? 'M2 \u00d7 8 mm self-tapping' : 'M3 \u00d7 12 mm pan head', free: false
    };
    s.holeX = clamp(num(c.holeX, 49.5), L + 2, s.span - 2);
    s.caseTop = Math.min(s.caseTop, s.splineTop - 1.5);
    return s;
  }
  const hornOf = (s, use) => HORNS[use === 'grip' ? 'arm1' : s.horn];
  const partFace = (s, h) => s.splineTop + h.above - h.T; // horn-side face of the part, above the servo tab plane

  function options(raw) {
    const o = { ...DEFAULTS, ...(raw || {}) };
    o.colors = { ...DEFAULTS.colors, ...((raw && raw.colors) || {}) };
    o.dof = [4, 5, 6].includes(+o.dof) ? +o.dof : 5;
    if (!SERVOS[o.mainServo]) o.mainServo = 'std';
    if (!SERVOS[o.smallServo]) o.smallServo = 'micromg';
    o.custom = { ...CUSTOM_DEFAULT, ...(o.custom || {}) };
    o.fit = clamp(num(o.fit, 0.25), 0, 0.8);
    o.upperLen = clamp(num(o.upperLen, 120), 40, 240);
    o.foreLen = clamp(num(o.foreLen, 110), 40, 240);
    o.wristLen = clamp(num(o.wristLen, 42), 20, 120);
    o.shoulderLift = clamp(num(o.shoulderLift, 6), 0, 80);
    o.baseSize = clamp(num(o.baseSize, 150), 60, 240);
    o.baseShape = o.baseShape === 'round' ? 'round' : 'square';
    o.turntableD = clamp(num(o.turntableD, 104), 50, 200);
    o.plateT = clamp(num(o.plateT, 6), 3, 12);
    o.wall = clamp(num(o.wall, 5), 2.5, 10);
    o.style = o.style === 'light' || o.style === 'skeleton' ? 'light' : 'box'; // old names: skeleton = light, solid = box
    if (!GRIPS[o.grip]) o.grip = 'claw';
    o.fingerLen = clamp(num(o.fingerLen, 45), 20, 120);
    o.opening = clamp(num(o.opening, 45), 10, 140);
    o.fingerW = clamp(num(o.fingerW, 7), 4, 14);
    o.fingerT = clamp(num(o.fingerT, 5), 3, 10);
    o.padH = clamp(num(o.padH, 16), 6, 40);
    for (const k of ['collar', 'mountHoles', 'fitTest']) o[k] = o[k] !== false;
    for (const k of ['ballRace', 'cable']) o[k] = !!o[k];
    o.ballD = [4.5, 6, 8].includes(+o.ballD) ? +o.ballD : 6;
    o.baseText = String(o.baseText || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 24);
    o.textH = clamp(num(o.textH, 10), 5, 24);
    if (!Bubble || !Bubble.FONTS || !Bubble.FONTS[o.font]) o.font = 'round';
    o.payload = clamp(num(o.payload, 50), 0, 1000);
    for (const k of ['frame', 'accent', 'text']) { const v = String(o.colors[k] || ''); o.colors[k] = /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : (k === 'accent' ? '' : DEFAULTS.colors[k]); }
    o.bed = [clamp(num(o.bed && o.bed[0], 256), 100, 1000), clamp(num(o.bed && o.bed[1], 256), 100, 1000)];
    o.detail = o.detail === 'draft' ? 'draft' : 'hd';
    return o;
  }

  // ---------------------------------------------------------------- 4\u00d74 matrices (row-major) and soups
  const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function mul(...ms) {
    let r = ms[0];
    for (let n = 1; n < ms.length; n++) {
      const a = r, b = ms[n], o = new Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) o[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + a[i * 4 + 3] * b[12 + j];
      r = o;
    }
    return r;
  }
  const tr = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
  const rx = d => { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]; };
  const ry = d => { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; };
  const rz = d => { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
  // columns are the frame axes in the parent, o the origin
  const axes = (x, y, z, o) => [x[0], y[0], z[0], o[0], x[1], y[1], z[1], o[1], x[2], y[2], z[2], o[2], 0, 0, 0, 1];
  const colMajor = m => [m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]];
  const det3 = m => m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8]);
  function apply(m, p) {
    const q = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) { const x = p[i], y = p[i + 1], z = p[i + 2]; q[i] = m[0] * x + m[1] * y + m[2] * z + m[3]; q[i + 1] = m[4] * x + m[5] * y + m[6] * z + m[7]; q[i + 2] = m[8] * x + m[9] * y + m[10] * z + m[11]; }
    if (det3(m) < 0) for (let i = 0; i < q.length; i += 9) for (let k = 0; k < 3; k++) { const t = q[i + 3 + k]; q[i + 3 + k] = q[i + 6 + k]; q[i + 6 + k] = t; }
    return q;
  }

  // ---------------------------------------------------------------- 2D helpers
  const area2 = L => { let s = 0; for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; s += a[0] * b[1] - a[1] * b[0]; } return s / 2; };
  const ccw = L => area2(L) < 0 ? L.slice().reverse() : L;
  const circ = (cx, cy, r, n) => { const L = []; for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; L.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return L; };
  function hull2(pts) {
    const P = pts.map(p => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (P.length < 3) return P;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-12) up.pop(); up.push(p); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  const rot2 = (pts, d) => { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); return pts.map(p => [p[0] * c - p[1] * s, p[0] * s + p[1] * c]); };
  const rectPts = (x0, y0, x1, y1, r, seg) => { r = Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01); return [...circ(x0 + r, y0 + r, r, seg), ...circ(x1 - r, y0 + r, r, seg), ...circ(x1 - r, y1 - r, r, seg), ...circ(x0 + r, y1 - r, r, seg)]; };

  // ---------------------------------------------------------------- Manifold toolkit
  function kit(M, detail) {
    const all = [];
    const k = x => { all.push(x); return x; };
    const free = () => { for (const x of all) { try { x.delete(); } catch (e) { /* freed */ } } all.length = 0; };
    const hd = detail !== 'draft';
    const seg = r => hd ? clamp(Math.ceil(2 * Math.PI * r / 0.5), 28, 192) & ~3 : clamp(Math.ceil(r * 2.2), 16, 64) & ~3;
    const cube = (x0, y0, z0, x1, y1, z1) => k(k(M.Manifold.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const cyl = (cx, cy, z0, z1, r, r2) => k(k(M.Manifold.cylinder(z1 - z0, r, r2 === undefined ? r : r2, seg(Math.max(r, r2 || 0)))).translate([cx, cy, z0]));
    const prism = (rings, z0, z1) => { const cs = k(new M.CrossSection(rings.map(ccw), 'EvenOdd')); return k(k(M.Manifold.extrude(cs, z1 - z0)).translate([0, 0, z0])); };
    const union = arr => { const a = arr.filter(Boolean); return a.length === 0 ? null : a.length === 1 ? a[0] : k(M.Manifold.union(a)); };
    const sub = (a, arr) => { const u = union(arr); return u ? k(a.subtract(u)) : a; };
    const xf = (m, mat) => k(m.transform(colMajor(mat)));
    const hull = arr => k(M.Manifold.hull(arr));
    return { M, k, free, cube, cyl, prism, union, sub, xf, hull, seg, hd };
  }
  function soupOf(m) {
    const g = m.getMesh(), V = g.vertProperties, F = g.triVerts, np = g.numProp, p = new Float64Array(F.length * 3);
    for (let i = 0; i < F.length; i++) { const v = F[i] * np; p[i * 3] = V[v]; p[i * 3 + 1] = V[v + 1]; p[i * 3 + 2] = V[v + 2]; }
    return p;
  }

  // ---------------------------------------------------------------- servo pocket and horn recess cuts
  // servo frame: tab underside at z = 0, shaft at the origin, body center at x = -off
  function servoCut(K, s, fit, zLo, zHi, hLo, hHi) {
    const out = [K.cube(-s.off - s.L / 2 - fit, -s.W / 2 - fit, zLo, -s.off + s.L / 2 + fit, s.W / 2 + fit, zHi)];
    for (const [hx, hy] of servoTabHoles(s)) {
      const r = s.pilot / 2, d = s.slot / 2;
      out.push(K.hull([K.cyl(hx - d, hy, hLo, hHi, r), K.cyl(hx + d, hy, hLo, hHi, r)]));
    }
    return out;
  }
  function servoTabHoles(s) { const rows = s.holeY > 0 ? [-s.holeY / 2, s.holeY / 2] : [0], out = []; for (const hx of [-s.off - s.holeX / 2, -s.off + s.holeX / 2]) for (const hy of rows) out.push([hx, hy]); return out; }
  // horn recess in a part frame: z = 0 is the horn-side face, `thick` is the part thickness (through holes, counterbores)
  function hornCut(K, h, fit, thick, rot, single) {
    const out = [];
    if (h.D) {
      out.push(K.cyl(0, 0, -1, h.T + 0.15, h.D / 2 + fit));
      out.push(K.cyl(0, 0, -1, thick + 1, h.center / 2));
      for (let i = 0; i < 4; i++) {
        const a = (45 + 90 * i) * DEG, x = h.bc / 2 * Math.cos(a), y = h.bc / 2 * Math.sin(a);
        out.push(K.cyl(x, y, -1, thick + 1, h.holeD / 2));
        if (thick - h.T > h.cbDepth + 1.2) out.push(K.cyl(x, y, thick - h.cbDepth, thick + 1, h.cb / 2));
      }
      return out;
    }
    const n = K.seg(h.hub / 2), parts = [K.prism([circ(0, 0, h.hub / 2 + fit, n)], -1, h.T + 0.6)];
    for (const d of single ? [0] : [0, 180]) {
      const pts = rot2(circ(0, 0, h.w0 / 2 + fit, n).concat(circ(h.len - h.w1 / 2, 0, h.w1 / 2 + fit, K.seg(h.w1 / 2))), d + rot);
      parts.push(K.prism([hull2(pts)], -1, h.T + 0.15));
      for (const r of h.pilots) { const [px, py] = rot2([[r, 0]], d + rot)[0]; out.push(K.cyl(px, py, h.T, Math.max(h.T + 3, thick - 0.8), h.pilotD / 2)); }
    }
    out.push(K.union(parts));
    out.push(K.cyl(0, 0, -1, thick + 1, h.center / 2));
    return out;
  }
  // 2D footprint points a horn needs on a plate (for the outline hull)
  function hornPad(h, fit, m, rot, single, seg) {
    if (h.D) return circ(0, 0, h.D / 2 + fit + m, seg);
    const pts = circ(0, 0, h.hub / 2 + fit + m, seg);
    for (const d of single ? [0] : [0, 180]) pts.push(...rot2(circ(h.len - h.w1 / 2, 0, h.w1 / 2 + fit + m * 0.8, 24), d + rot), ...rot2(circ(h.len * 0.45, 0, h.w0 / 2 + fit + m * 0.8, 24), d + rot));
    return pts;
  }

  // ---------------------------------------------------------------- gears and fingers (2D)
  // involute spur gear outline, one tooth centered on the angle toothAt (radians)
  function gearPoly(N, m, backlash, toothAt) {
    const pa = 20 * DEG, rp = m * N / 2, rb = rp * Math.cos(pa), ra = rp + m, rf = Math.max(rp - 1.25 * m, 0.5);
    const inv = a => Math.tan(a) - a, half = (Math.PI / 2 - backlash / rp) / N + inv(pa); // half tooth angle at the base circle
    const r0 = Math.max(rb, rf), out = [], steps = 7, pitch = 2 * Math.PI / N;
    for (let i = 0; i < N; i++) {
      const c = toothAt + i * pitch, flank = [];
      for (let k = 0; k <= steps; k++) { const r = r0 + (ra - r0) * k / steps, ang = Math.acos(clamp(rb / r, -1, 1)); flank.push([r, half - inv(ang)]); }
      const pts = [[rf, c - pitch / 2 + 1e-4]];
      if (rf < r0) pts.push([rf, c - half]);
      for (const [r, a] of flank) pts.push([r, c - a]);
      for (let k = flank.length - 1; k >= 0; k--) pts.push([flank[k][0], c + flank[k][1]]);
      if (rf < r0) pts.push([rf, c + half]);
      for (const [r, a] of pts) out.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return out;
  }
  // a thick polyline as convex capsules (one ring per segment)
  function capsules(pts, w, seg) { const out = []; for (let i = 0; i + 1 < pts.length; i++) out.push(hull2(circ(pts[i][0], pts[i][1], w / 2, seg).concat(circ(pts[i + 1][0], pts[i + 1][1], w / 2, seg)))); return out; }

  // ---------------------------------------------------------------- the design (all sizes and frames, no meshes)
  function layout(o) {
    const warn = [];
    const sM = servoSpec(o.mainServo, o.custom), sS = servoSpec(o.smallServo, o.custom);
    const hM = hornOf(sM), hS = hornOf(sS), hG = HORNS.arm1;
    const pfM = partFace(sM, hM), pfS = partFace(sS, hS), pfG = partFace(sS, hG);
    const fit = o.fit, m = o.wall, Tp = o.plateT;
    const microMain = sM.L < 30;
    const floorT = 3, Hb = sM.below + 0.6 + floorT;           // base: servo tabs on the top face, 3 mm floor
    const Td = Math.max(5, Math.min(8, (hM.T || 1.6) + 3.5));   // turntable disc
    const zT0 = Hb + pfM, zT1 = zT0 + Td;
    const yS = -(pfM + Tp / 2), Tc = Math.max(Tp, microMain ? 5 : 8);                         // cheek front face; the upper arm centered on y = 0
    const zs = zT1 + Math.max(sM.off + sM.L / 2 + fit + 3 + o.shoulderLift, (hM.D ? hM.D / 2 + fit + m : hM.len + fit + m * 0.8) + 10); // room for the bridge block under the arm
    const bodyY = yS - sM.below;
    const tabR = Math.hypot(sM.off + sM.span / 2, sM.W / 2);
    let Dt = o.turntableD;
    const needDt = 2 * Math.max(Math.abs(bodyY) + 3, tabR + 2, hM.D ? hM.D / 2 + 8 : hM.len + 6, sM.W / 2 + m + 14,
      Math.hypot(14, yS + pfM + Tp + Math.max(6, sM.below + fit + 1.2 - Tp) + 1 + (microMain ? 5 : 9.5)) + 2);
    const rb = o.ballD / 2, cableHoleX = -(sM.off + sM.L / 2 + fit + 6), cableHoleR = microMain ? 4 : 5;
    let Rb = 0;
    if (o.ballRace) Rb = Math.max(0.72 * Dt / 2, tabR + rb + 4, o.cable ? Math.abs(cableHoleX) + cableHoleR + rb + 4 : 0);
    const needDt2 = o.ballRace ? 2 * (Rb + rb + 4) : 0;
    if (Dt < Math.max(needDt, needDt2) - 0.01) { const nd = Math.ceil(Math.max(needDt, needDt2)); warn.push(`Turntable widened to ${nd} mm so the shoulder servo${o.ballRace ? ' and the ball race' : ''} fit.`); Dt = nd; }
    if (o.ballRace) Rb = Math.max(Rb, 0.72 * Dt / 2);
    const collarIn = Dt / 2 + 1.2, collarOut = collarIn + 3;
    let baseSize = o.baseSize;
    const needBase = Math.ceil(2 * ((o.collar ? collarOut : Dt / 2) + (o.mountHoles ? 16 : 6)));
    if (baseSize < needBase) { warn.push(`Base widened to ${needBase} mm to fit the turntable${o.mountHoles ? ' and the screw holes' : ''}.`); baseSize = needBase; }
    const proxReachM = hM.D ? hM.D / 2 + fit + m : hM.len + fit + m * 0.8;
    const minLink = s => Math.ceil(proxReachM + 3 + s.off + Math.max(s.L / 2 + fit, s.holeX / 2 + s.pilot / 2 + s.slot / 2) + 2);
    let L1 = o.upperLen, L2 = o.foreLen;
    const padR = s => Math.hypot(s.span / 2 - s.off + m * 0.6, s.W / 2 + fit + m);
    // idler side of the shoulder and elbow: a ball bearing (a plain bolt pivot for micro servos) in a bracket on the
    // far side of each link, coaxial with the servo shaft; a bolt-on hub on the link turns in it
    const piv = microMain
      ? { kind: 'pin', boltD: 3, nutAF: 5.5, nutT: 2.4, Rp: 8, Tch: 5, hubR: 8.5, collarR: 3.6, g: 1, screwR: 6, screwAng: 90, screwD: 2.2, cbD: 4.4, pilotD: 1.7, screwUnder: 4 }
      : { kind: 'bearing', OD: 22, ID: 8, W: 7, Rp: 15, Tch: 9.5, lipD: 17.5, hubR: 15, collarR: 5.9, g: 1.5, screwR: 10.5, screwAng: 0, screwD: 3.4, cbD: 6.4, pilotD: 2.6, screwUnder: 5 };
    const wallF = clamp(m * 0.8, 2.4, 6);                                   // channel side walls
    const Hu = Math.max(6, sM.below + fit + 1.2 - Tp), Hf = Math.max(6, sS.below + fit + 1.2 - Tp); // wall height above the web
    const zc2S = pfM + Tp + Hu + 1, zc2E = pfM + Tp + Hf + 1;              // idler bracket inner face, in the servo frame
    const ycS = yS + zc2S;                                                  // ... the shoulder one in world y
    const brkLen = microMain ? 8 : 12, xb1Off = sM.off + sM.span / 2 + fit + 1.5; // elbow bracket standoff behind the servo tabs
    const n1 = Math.max(minLink(sM), Math.ceil(padR(sM) + 3 + brkLen + xb1Off));
    if (L1 < n1) { warn.push(`Upper arm lengthened to ${n1} mm so the elbow servo and its idler bracket clear the shoulder.`); L1 = n1; }
    const xb1 = L1 - xb1Off, xb0 = xb1 - brkLen;
    const gm = 1.25, gN = 16, rp = gm * gN / 2, cA = rp + 0.06, gOuter = rp + gm, bossR = 4.8;
    if (o.dof === 4) { const n2 = Math.ceil(proxReachM + 3 + (sS.span / 2 - sS.off) + 6); if (L2 < n2) { warn.push(`Forearm lengthened to ${n2} mm to make room for the gripper.`); L2 = n2; } }
    else { const n2 = minLink(sS); if (L2 < n2) { warn.push(`Forearm lengthened to ${n2} mm so the wrist servo clears the elbow horn.`); L2 = n2; } }
    let Lw = o.wristLen, xe = 0, zr = 0;
    const Te = Math.max(Tp, 4), Tw = Math.max(3.5, Math.min(Tp, 6));
    if (o.dof === 5) {
      // the gripper servo body (forward of the gear axis) hangs toward the forearm: keep it outside the forearm pad
      const need = Math.ceil(Math.max(padR(sS) + 2 + (sS.L / 2 - sS.off) + fit, hS.hub / 2 + fit + 2 + (sS.span / 2 - sS.off) + m, gOuter + hS.hub / 2 + 2));
      if (Lw < need) { warn.push(`Wrist lengthened to ${need} mm so the gripper servo clears the forearm.`); Lw = need; }
    } else if (o.dof === 6) {
      zr = Math.max(Tw + 1 + sS.L / 2 - sS.off + fit, Tw + 2 + sS.holeX / 2 - sS.off + sS.pilot / 2 + sS.slot / 2);
      const need = Math.ceil(sS.below + fit + 4 + Te);
      if (Lw < need) { warn.push(`Wrist lengthened to ${need} mm to fit the roll servo.`); Lw = need; }
      xe = Lw;
    }
    const Tg = o.dof === 4 ? Tp : o.dof === 5 ? Tw : Math.max(3.5, Math.min(Tp, 5));
    const gearZ = pfG;
    const zg = o.dof === 6 ? Math.max(Tg + gearZ + o.fingerT / 2, hS.w0 / 2 + fit + m + 1) : 0;
    const Tfl = Math.max(4, Tg);
    const gx6 = Tfl + sS.L / 2 - sS.off + fit + 5;
    const proxR = hM.D ? hM.D / 2 + fit + m : hM.hub / 2 + fit + m;       // web half width at the shoulder horn
    const wb = Math.max(10, Math.min(22, Math.sqrt(Math.max(0, (Dt / 2 - 2) ** 2 - (ycS + piv.Tch) ** 2))));
    const zbT = Math.max(zT1 + 6, zs - (proxReachM + 2));                  // bridge block top, below the arm sweep
    return { piv, wallF, Hu, Hf, zc2S, zc2E, ycS, brkLen, xb0, xb1, proxR, wb, zbT, warn, sM, sS, hM, hS, hG, pfM, pfS, pfG, fit, m, Tp, floorT, Hb, Td, zT0, zT1, yS, Tc, zs, Dt, Rb, rb, collarIn, collarOut, baseSize, L1, L2, Lw, xe, zr, Te, Tw, Tg, gearZ, zg, Tfl, gx6, gm, gN, rp, cA, gOuter, bossR, cableHoleX, cableHoleR, microMain };
  }

  // ---------------------------------------------------------------- parts
  function servoMount(L, side, T) { return side === 'top' ? tr(L, 0, T) : mul(tr(L, 0, 0), rx(180)); }
  // link: horn at the origin (z = 0 face), the far-end attachment (servo pocket or gripper). With spec.box it is a
  // U-channel: side walls and cross ribs on the z = T side (the side the next servo body sits on), open on top for
  // the wires, and pilot holes for the pivot hub over the horn.
  const ringAt = (x0, x1) => [{ outer: [[x0, -500], [x1, -500], [x1, 500], [x0, 500]], holes: [] }];
  function linkPart(K, o, D, spec) {
    const { L, T, horn, hornRot, hornSingle } = spec, m = D.m, fit = D.fit, sg = K.seg(10), att = spec.attach, bx = spec.box;
    const outline = hull2(hornPad(horn, fit, m, hornRot || 0, hornSingle, sg).concat(att.pad));
    let solid = K.prism([outline], 0, T);
    const adds = (att.adds || []).slice(), ribs = [];
    if (bx) {
      const P0 = [{ outer: ccw(outline), holes: [] }], wf = D.wallF, H = bx.H;
      const inner = Tools.offset(P0, -wf, true), x0 = D.piv.hubR + 0.8, xr = att.xStart - 1.2 - wf;
      for (const P of Tools.interPolys(Tools.diffPolys(P0, inner), ringAt(x0, 1e4))) adds.push(K.prism([P.outer, ...P.holes], T - 0.01, T + H));
      // cross ribs: one at the hub, then about every 55 mm up to the servo pocket; a notch on top lets the wires through
      ribs.push(x0);
      const n = Math.floor((xr - x0) / 55); for (let i = 1; i <= n; i++) ribs.push(x0 + (xr - x0) * i / (n + 0.6));
      const notch = Math.min(6, H * 0.4);
      for (const x of ribs) for (const P of Tools.interPolys(P0, ringAt(x, x + wf))) adds.push(K.sub(K.prism([P.outer, ...P.holes], T - 0.01, T + H), [K.cube(x - 1, -5, T + H - notch, x + wf + 1, 5, T + H + 1)]));
    }
    if (adds.length) solid = K.union([solid, ...adds]);
    const cuts = [...hornCut(K, horn, fit + 0.1, T, hornRot || 0, hornSingle), ...att.cuts];
    if (bx) { // pivot hub screws (self-tapping into the web, above the horn recess)
      const pv = D.piv, z0 = horn.D ? horn.T + 0.9 : 0.8;
      for (const d of [0, 180]) { const a = (pv.screwAng + d) * DEG; cuts.push(K.cyl(pv.screwR * Math.cos(a), pv.screwR * Math.sin(a), z0, T + 1, pv.pilotD / 2)); }
      for (const h of bx.holes || []) cuts.push(K.cyl(h[0], h[1], -1, T + 1, h[2]));
    }
    const hornX = horn.D ? horn.D / 2 : ((hornRot || 0) % 180 === 0 ? horn.len : Math.max(horn.hub / 2, horn.w0 / 2));
    const xa = Math.max(hornX + fit + m * 0.9, bx ? D.piv.hubR + 0.8 + D.wallF + 2 : 0), xb = Math.min(att.xStart - m * 0.9, bx && bx.xEnd !== undefined ? bx.xEnd : 1e4), stations = ribs.length > 1 ? ribs.slice(1) : [];
    if (xb - xa > 14) {
      const len = xb - xa;
      if (o.style === 'light' && bx && stations.length) { // windows in the web between the ribs
        const web = Math.max(m, 4) + D.wallF, inner = Tools.offset([{ outer: ccw(outline), holes: [] }], -m - D.wallF, true);
        let region = Tools.interPolys(inner, ringAt(xa, xb));
        region = Tools.diffPolys(region, stations.map(x => ringAt(x + D.wallF / 2 - web / 2, x + D.wallF / 2 + web / 2)[0]));
        region = Tools.offset(Tools.offset(region, -2.5, true), 2.5, true);
        for (const P of region) if (Math.abs(Tools.polysArea([P])) > 30) cuts.push(K.prism([P.outer, ...P.holes], -1, T + 1));
      } else if (o.style === 'light') {
        const n = Math.max(1, Math.round(len / 55)), web = o.cable ? 12 : Math.max(m, 4);
        for (let i = 1; i < n; i++) stations.push(xa + len * i / n);
        if (o.cable && n === 1 && len > 40) stations.push((xa + xb) / 2);
        const inner = Tools.offset([{ outer: ccw(outline), holes: [] }], -m, true);
        let region = Tools.interPolys(inner, [{ outer: [[xa, -500], [xb, -500], [xb, 500], [xa, 500]], holes: [] }]);
        if (stations.length) region = Tools.diffPolys(region, stations.map(x => ({ outer: [[x - web / 2, -500], [x + web / 2, -500], [x + web / 2, 500], [x - web / 2, 500]], holes: [] })));
        region = Tools.offset(Tools.offset(region, -2.5, true), 2.5, true);
        for (const P of region) if (Math.abs(Tools.polysArea([P])) > 30) cuts.push(K.prism([P.outer, ...P.holes], -1, T + 1));
      } else if (o.cable) { const k = Math.max(1, Math.round(len / 45)); for (let i = 0; i < k; i++) stations.push(xa + len * (i + 0.5) / k); }
    }
    if (o.cable) { // zip-tie slots; on a boxed link halfway between the ribs
      let xs = stations;
      if (bx) { const ed = [xa, ...ribs.slice(1).map(x => x + D.wallF / 2), xb]; xs = []; for (let i = 0; i + 1 < ed.length; i++) if (ed[i + 1] - ed[i] > 8) xs.push((ed[i] + ed[i + 1]) / 2); }
      for (const x of xs) for (const y of [-3.6, 3.6]) cuts.push(K.cube(x - 1.25, y - 2.2, -1, x + 1.25, y + 2.2, T + 1));
    }
    return { solid: K.sub(solid, cuts), stations, outline, ribs };
  }
  function servoAttach(K, D, s, L, side, T) {
    const M4 = servoMount(L, side, T), m = D.m, fit = D.fit;
    const x0 = L - s.off - s.span / 2 - m * 0.6, x1 = L - s.off + s.span / 2 + m * 0.6, y = s.W / 2 + fit + m;
    const cuts = servoCut(K, s, fit, -300, 300, -300, 300).map(c => K.xf(c, M4));
    const xStart = Math.min(L - s.off - s.L / 2 - fit, L - s.off - s.holeX / 2 - s.pilot / 2 - s.slot / 2);
    return { pad: rectPts(x0, -y, x1, y, 4, 16), cuts, adds: [], xStart, mount: M4 };
  }
  // pivot hub: screws onto the link web over the horn (relief pockets for the horn screw heads); its stub turns in the
  // idler bearing, or for micro servos it holds the nut of the pivot bolt. Link frame: base on z = T, top face zTop
  // is the idler bracket inner face.
  function hubPart(K, D, horn, T, zTop) {
    const pv = D.piv, z1 = zTop - pv.g, parts = [K.cyl(0, 0, T + 0.02, z1, pv.hubR), K.cyl(0, 0, z1 - 0.01, zTop - 0.05, pv.collarR)];
    if (pv.kind === 'bearing') { const r = pv.ID / 2 - 0.08, z2 = zTop + pv.W - 0.6; parts.push(K.cyl(0, 0, zTop - 0.06, z2 - 0.6, r), K.cyl(0, 0, z2 - 0.61, z2, r, r - 0.6)); }
    const cuts = [];
    for (const d of [0, 180]) { const a = (pv.screwAng + d) * DEG, x = pv.screwR * Math.cos(a), y = pv.screwR * Math.sin(a); cuts.push(K.cyl(x, y, T - 1, zTop + 20, pv.screwD / 2), K.cyl(x, y, T + pv.screwUnder, zTop + 20, pv.cbD / 2)); }
    if (horn.D) for (let i = 0; i < 4; i++) { const a = (45 + 90 * i) * DEG; cuts.push(K.cyl(horn.bc / 2 * Math.cos(a), horn.bc / 2 * Math.sin(a), T - 1, T + 3, 3.4)); }
    if (pv.kind === 'pin') { cuts.push(K.prism([circ(0, 0, pv.nutAF / Math.sqrt(3) + 0.15, 6)], zTop - 0.05 - pv.nutT - 0.4, zTop + 1)); cuts.push(K.cyl(0, 0, Math.max(T + 1, z1 - 8), zTop + 1, pv.boltD / 2 + 0.2)); }
    return K.sub(K.union(parts), cuts);
  }
  // idler bracket plate in its own frame: inner face z = 0 (toward the link), the joint axis at the origin, the plate
  // below (z in [-Tch, 0]); `foot` is the 2D rectangle [x0, y0, x1, y1] it reaches out to for its screws
  function idlerPlate(K, D, foot) {
    const pv = D.piv, out = K.prism([hull2(circ(0, 0, pv.Rp, K.seg(pv.Rp)).concat(rectPts(foot[0], foot[1], foot[2], foot[3], 3, 12)))], -pv.Tch, 0);
    const cuts = pv.kind === 'bearing' ? [K.cyl(0, 0, -pv.W, 1, pv.OD / 2 + 0.06), K.cyl(0, 0, -pv.Tch - 1, 1, pv.lipD / 2)] : [K.cyl(0, 0, -pv.Tch - 1, 1, pv.boltD / 2 + 0.2)];
    return { out, cuts };
  }
  function bearingDummy(K, D) { const pv = D.piv; return pv.kind === 'bearing' ? K.sub(K.cyl(0, 0, -pv.W, 0, pv.OD / 2), [K.cyl(0, 0, -pv.W - 1, 1, pv.ID / 2)]) : null; }
  // elbow idler bracket, in the upper arm frame: a standoff under the web behind the elbow servo tabs and the bearing plate
  const elbowBrkM = D => tr(D.L1, 0, -D.zc2E);
  const elbowBrkScrews = D => { const xm = (D.xb0 + D.xb1) / 2, yb = D.sM.W / 2 + D.fit + D.m; return [[xm, -(yb - 6)], [xm, yb - 6]]; };
  function elbowBracketPart(K, D) {
    const yb = D.sM.W / 2 + D.fit + D.m, x0 = D.xb0 - D.L1, x1 = D.xb1 - D.L1, h = D.zc2E - 0.05, pv = D.piv;
    const P = idlerPlate(K, D, [x0, -yb, x1, yb]);
    const gus = Math.min(10, (h - 2) * 0.5);
    const stand = K.union([K.cube(x0, -yb, -0.01, x1, yb, h), K.hull([K.cube(x0, -yb + 2, -0.01, x1 + gus, yb - 2, 0.01), K.cube(x0, -yb + 2, -0.01, x1, yb - 2, gus)])]);
    const cuts = P.cuts.slice();
    for (const [x, y] of elbowBrkScrews(D)) cuts.push(K.cyl(x - D.L1, y, h - 12, h + 1, 1.3));
    return K.xf(K.sub(K.union([P.out, stand]), cuts), elbowBrkM(D));
  }
  // shoulder idler bracket, in the turntable frame: the plate stands at y = ycS facing -y, screwed to the bridge block
  const shoulderBrkM = D => axes([1, 0, 0], [0, 0, 1], [0, -1, 0], [0, D.ycS, D.zs]);
  const shoulderBrkScrews = D => [-1, 1].map(sx => [sx * (D.wb - 6), (D.zT1 + D.zbT) / 2]);
  function shoulderBracketPart(K, D) {
    const P = idlerPlate(K, D, [-D.wb, D.zT1 + 0.4 - D.zs, D.wb, D.zbT - D.zs]), cuts = P.cuts.slice();
    for (const [x, z] of shoulderBrkScrews(D)) cuts.push(K.cyl(x, z - D.zs, -D.piv.Tch - 1, 1, 1.7));
    return K.xf(K.sub(P.out, cuts), shoulderBrkM(D));
  }
  function inv4(m) { // rigid transforms only
    const R = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]], t = [m[3], m[7], m[11]];
    return [R[0], R[1], R[2], -(R[0] * t[0] + R[1] * t[1] + R[2] * t[2]), R[3], R[4], R[5], -(R[3] * t[0] + R[4] * t[1] + R[5] * t[2]), R[6], R[7], R[8], -(R[6] * t[0] + R[7] * t[1] + R[8] * t[2]), 0, 0, 0, 1];
  }
  // gripper base on a plate of thickness T: gear axes at x = gx; 'top' = servo tabs on z = T with the gears above,
  // 'bottom' = tabs on z = 0 with the gears below. The servo body points forward (+x).
  function gripAttach(K, o, D, gx, side, T) {
    const s = D.sS, m = D.m, fit = D.fit, cA = D.cA, top = side === 'top';
    const yA = top ? -cA : cA, yB = -yA;
    const Sg = top ? mul(tr(gx, yA, T), rz(180)) : mul(tr(gx, yA, 0), rx(180), rz(180));
    const bossTop = D.gearZ - 0.5;
    const x0 = gx + s.off - s.span / 2 - m * 0.6, x1 = gx + s.off + s.span / 2 + m * 0.6, yh = s.W / 2 + fit + m;
    const pad = rectPts(x0, yA - yh, x1, yA + yh, 4, 16).concat(circ(gx, yB, D.bossR + m * 0.7, 32));
    const cuts = servoCut(K, s, fit, -300, 300, -300, 300).map(c => K.xf(c, Sg));
    const adds = [top ? K.cyl(gx, yB, T - 0.01, T + bossTop, D.bossR) : K.cyl(gx, yB, -bossTop, 0.01, D.bossR)];
    cuts.push(K.cyl(gx, yB, -300, 300, 1.65));
    const cb = Math.min(2.6, T - 1.2);
    if (top) cuts.push(K.cyl(gx, yB, -1, cb, 3.2)); else cuts.push(K.cyl(gx, yB, T - cb, T + 1, 3.2));
    const xStart = Math.min(x0 + m * 0.6, gx - D.bossR - m * 0.7, gx + s.off - s.L / 2 - fit);
    return { pad, cuts, adds, xStart, Sg, gx, yA, yB, top, gearPlane: top ? T + D.gearZ : -D.gearZ };
  }
  // drive (A, on the servo horn) or idler (B) finger with its gear, closed, in the finger frame: gear center at the
  // origin, bottom face z = 0, the gripper center line at y = +cA (B is mirrored to y = -cA)
  function fingerPart(K, o, D, which) {
    const cA = D.cA, Lf = o.fingerLen, w = o.fingerW, Tf = o.fingerT, sg = K.seg(w / 2), style = o.grip;
    const g0 = style === 'hook' ? 1.6 : 0.6, padLen = Math.min(18, Math.max(8, Lf * 0.38)), yPad = cA - g0 - w / 2;
    const toothAt = which === 'A' ? Math.PI / 2 : Math.PI / 2 + Math.PI / D.gN; // B is mirrored afterwards: a gap faces A
    const gear = gearPoly(D.gN, D.gm, 0.12, toothAt);
    let path;
    if (style === 'hook') {
      path = []; const n = 10, bulge = Math.max(3, Lf * 0.16);
      for (let i = 0; i <= n; i++) { const t = i / n; path.push([t * (Lf - 3), yPad * Math.pow(t, 0.9) - bulge * Math.sin(Math.PI * Math.min(1, t * 1.1))]); }
      path.push([Lf, yPad]);
    } else path = [[0, 0], [Lf - padLen, yPad], [Lf, yPad]];
    const rings = capsules(path, w, sg);
    rings.push(rectPts(Lf - padLen, yPad - w / 2, Lf, cA - g0, 0.8, 6));
    if (which === 'A') rings.push(hull2(circ(0, 0, D.hG.w0 / 2 + o.fit + 2.2, 32).concat(circ(D.hG.len + 1.2, 0, D.hG.w1 / 2 + o.fit + 2.2, 24))));
    let solid = K.union([K.prism([gear], 0, Tf), ...rings.map(r => K.prism([r], 0, Tf))]);
    if (style === 'wide') solid = K.union([solid, K.prism([rectPts(Lf - padLen, yPad - w / 2, Lf, cA - g0, 1.5, 8)], 0, Math.max(o.padH, Tf))]);
    const cuts = which === 'A' ? hornCut(K, D.hG, o.fit + 0.05, Tf, 0, true) : [K.cyl(0, 0, -1, Tf + 1, 1.7)];
    const ridgeH = style === 'wide' ? Math.max(o.padH, Tf) : Tf, faceY = cA - g0, depth = style === 'hook' ? 1.0 : 0.6, pitch = style === 'hook' ? 3 : 2.5;
    for (let x = Lf - padLen + 2; x < Lf - 1; x += pitch) cuts.push(K.xf(K.cube(-0.5, -0.5, -1, 0.5, 0.5, ridgeH + 1), mul(tr(x, faceY, 0), rz(45), [Math.SQRT2 * depth, 0, 0, 0, 0, Math.SQRT2 * depth, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])));
    let part = K.sub(solid, cuts);
    if (which === 'B') part = K.xf(part, [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return { solid: part, padLen, g0, yPad, gear };
  }
  // jaw opening (mm between the pads, mid pad) when each gear has turned a degrees from closed
  function openingAt(D, o, f, a) { const xp = o.fingerLen - f.padLen / 2, yp = D.cA - f.g0, t = a * DEG; return 2 * (D.cA + xp * Math.sin(t) - yp * Math.cos(t)); }
  function travelFor(D, o, f) {
    const target = o.opening, hiA = 85;
    if (openingAt(D, o, f, hiA) < target) return { angle: hiA, reach: openingAt(D, o, f, hiA), short: true };
    let lo = 0, hi = hiA;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (openingAt(D, o, f, mid) < target) lo = mid; else hi = mid; }
    return { angle: hi, reach: target, short: false };
  }
  function torus(K, R, zc, r) {
    const sec = []; for (let i = 0; i < 24; i++) { const t = 2 * Math.PI * i / 24; sec.push([R + r * Math.cos(t), zc + r * Math.sin(t)]); }
    const cs = K.k(new K.M.CrossSection([ccw(sec)]));
    return K.k(K.M.Manifold.revolve(cs, K.seg(R)));
  }
  const ballZ = D => D.zT0 - 0.3 - D.rb + 0.9 * D.rb; // ball center: 0.6 mm gap between ring and disc, grooves 0.45 of the ball deep
  function basePart(K, o, D, textPolys) {
    const s = D.sM, half = D.baseSize / 2, outline = o.baseShape === 'round' ? circ(0, 0, half, K.seg(half)) : Tools.roundRect(-half, -half, half, half, 12, 12);
    let solid = K.prism([outline], 0, D.Hb);
    const adds = [];
    if (o.collar) adds.push(K.sub(K.cyl(0, 0, D.Hb - 0.01, D.zT1 - 2, D.collarOut), [K.cyl(0, 0, D.Hb, D.zT1, D.collarIn)]));
    if (o.ballRace) adds.push(K.sub(K.cyl(0, 0, D.Hb - 0.01, D.zT0 - 0.6, D.Rb + D.rb + 3), [K.cyl(0, 0, D.Hb - 1, D.zT0, D.Rb - D.rb - 3)]));
    if (adds.length) solid = K.union([solid, ...adds]);
    const cuts = servoCut(K, s, D.fit, -(s.below + 0.6), 60, -Math.min(14, s.below), 60).map(c => K.xf(c, tr(0, 0, D.Hb)));
    const bot = D.Hb - s.below - 0.6, wy = D.microMain ? 3 : 4;
    cuts.push(K.cube(-half - 2, -wy, bot, -s.off - s.L / 2 + 2, wy, bot + (D.microMain ? 6 : 8)));
    if (o.cable) cuts.push(K.cyl(D.cableHoleX, 0, bot + 1, D.zT1, D.cableHoleR));
    if (o.mountHoles) {
      const r = half - 9, pts = o.baseShape === 'round' ? [45, 135, 225, 315].map(a => [r * Math.cos(a * DEG), r * Math.sin(a * DEG)]) : [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [a * r, b * r]);
      for (const [x, y] of pts) { cuts.push(K.cyl(x, y, -1, D.Hb + 1, 2.3)); cuts.push(K.cyl(x, y, D.Hb - 3.2, D.Hb + 1, 4.6)); }
    }
    if (o.ballRace) cuts.push(torus(K, D.Rb, ballZ(D), D.rb + 0.15));
    const part = K.sub(solid, cuts);
    let text = null;
    if (textPolys && textPolys.length) { const rings = []; for (const P of textPolys) rings.push(P.outer, ...P.holes); text = K.prism(rings, D.Hb - 0.4, D.Hb + 1.0); }
    return { solid: part, text };
  }
  function baseTextPolys(o, D) {
    if (!o.baseText || !Bubble) return { polys: [], fit: true };
    const half = D.baseSize / 2, inner = o.collar ? D.collarOut : D.Dt / 2 + 1.5, strip = half - inner - 4;
    if (strip < 6) return { polys: [], fit: false, none: true };
    const H = Math.min(o.textH, strip * 0.8), glyphs = []; let w = 0;
    for (const ch of [...o.baseText.toUpperCase()]) {
      if (ch === ' ') { w += H * 0.35; continue; }
      const g = Bubble.glyphPolys(o.font, ch, H) || Bubble.glyphPolys(o.font, ch.toLowerCase(), H);
      if (!g || !g.polys.length) continue;
      glyphs.push({ polys: g.polys, at: w }); w += (g.advance || H * 0.7) * 1.06;
    }
    if (!glyphs.length) return { polys: [], fit: true };
    const yc = -(inner + half) / 2, maxW = o.baseShape === 'round' ? 2 * Math.sqrt(Math.max(0, half * half - (Math.abs(yc) + H / 2) ** 2)) - 12 : 2 * half - 24;
    const sc = w > maxW ? maxW / w : 1, out = [], dx = -w * sc / 2, dy = yc - H * sc * 0.36;
    for (const g of glyphs) for (const P of g.polys) out.push({ outer: P.outer.map(p => [(p[0] + g.at) * sc + dx, p[1] * sc + dy]), holes: (P.holes || []).map(h => h.map(p => [(p[0] + g.at) * sc + dx, p[1] * sc + dy])) });
    return { polys: out, fit: sc > 0.6, scale: sc, height: H * sc };
  }
  function turretPart(K, o, D) {
    const s = D.sM, h = D.hM, fit = D.fit, m = D.m, yS = D.yS, y0 = yS - D.Tc, zs = D.zs;
    const disc = K.cyl(0, 0, D.zT0, D.zT1, D.Dt / 2);
    const cwTop = s.W / 2 + fit + m, zTop = zs - s.off + s.span / 2 + m * 0.6, cwBot = Math.max(cwTop + 12, Math.min(D.Dt * 0.36, D.Dt / 2 - 6));
    const yCyl = (x, z) => K.xf(K.cyl(0, 0, 0, D.Tc, 4), mul(tr(x, yS, z), rx(90)));
    const cheek = K.hull([K.cube(-cwBot, y0, D.zT1 - 0.5, cwBot, yS, D.zT1 + 3), yCyl(-cwTop + 4, zTop - 4), yCyl(cwTop - 4, zTop - 4)]);
    const gus = [], gx0 = s.W / 2 + fit + 1.6, gw = 3.2;
    const gdBack = Math.max(6, Math.min(22, D.Dt / 2 + y0 - 3)), ghBack = Math.max(8, Math.min(34, zs - D.zT1 - 2));
    const gdFront = Math.max(4, Math.min(9, D.pfM - 5)), ghFront = Math.max(8, Math.min(26, zs - D.zT1 - 2));
    for (const sx of [-1, 1]) {
      const xa = sx < 0 ? -gx0 - gw : gx0, xb = xa + gw;
      gus.push(K.hull([K.cube(xa, y0 - gdBack, D.zT1 - 0.5, xb, y0 + 0.5, D.zT1 + 0.6), K.cube(xa, y0 - 0.6, D.zT1 - 0.5, xb, y0 + 0.5, D.zT1 + ghBack)]));
      gus.push(K.hull([K.cube(xa, yS - 0.5, D.zT1 - 0.5, xb, yS + gdFront, D.zT1 + 0.6), K.cube(xa, yS - 0.5, D.zT1 - 0.5, xb, yS + 0.6, D.zT1 + ghFront)]));
    }
    // bridge block between the cheek and the idler bracket, under the arm sweep (a U-shaped yoke with the cheek)
    const block = K.cube(-D.wb, yS + s.caseTop + 1, D.zT1 - 0.5, D.wb, D.ycS, D.zbT);
    const solid = K.union([disc, cheek, block, ...gus]);
    const S1 = axes([0, 0, 1], [1, 0, 0], [0, 1, 0], [0, yS, zs]);
    const cuts = servoCut(K, s, fit, -300, 300, -(D.Tc + 30), 8).map(c => K.xf(c, S1));
    cuts.push(...hornCut(K, h, fit + 0.1, D.Td, 0, false).map(c => K.xf(c, tr(0, 0, D.zT0))));
    for (const [x, z] of shoulderBrkScrews(D)) cuts.push(K.xf(K.cyl(0, 0, 0, 13, 1.3), mul(tr(x, D.ycS + 0.5, z), rx(90))));
    if (o.ballRace) cuts.push(torus(K, D.Rb, ballZ(D), D.rb + 0.15));
    if (o.cable) {
      cuts.push(K.hull([K.cyl(D.cableHoleX - 4, 0, D.zT0 - 1, D.zT1 + 1, D.cableHoleR), K.cyl(D.cableHoleX + 4, 0, D.zT0 - 1, D.zT1 + 1, D.cableHoleR)]));
      const x = -(cwBot - 6), z = D.zT1 + 7; cuts.push(K.cube(x - 2.2, y0 - 1, z - 1.25, x + 2.2, yS + 1, z + 1.25)); cuts.push(K.cube(x - 2.2, y0 - 1, z + 4.5, x + 2.2, yS + 1, z + 7));
    }
    return { solid: K.sub(solid, cuts), S1 };
  }
  // 6 joints: wrist bracket with the roll servo in an end plate, shaft along +X, body above the plate
  function wrist6Part(K, o, D) {
    const s = D.sS, h = D.hS, m = D.m, fit = D.fit, Tw = D.Tw, xe = D.xe, zr = D.zr, Te = D.Te;
    const yH = s.W / 2 + fit + m, zTop = zr + s.off + s.span / 2 + m * 0.6;
    const plate = K.prism([hull2(hornPad(h, fit, m, 90, false, 32).concat(rectPts(xe - Te - 16, -yH, xe, yH, 3, 12)))], 0, Tw);
    const xCyl = (y, z) => K.xf(K.cyl(0, 0, 0, Te, 3), mul(tr(xe - Te, y, z), ry(90)));
    const endP = K.hull([K.cube(xe - Te, -yH, 0, xe, yH, 2), xCyl(-yH + 3, zTop - 3), xCyl(yH - 3, zTop - 3)]);
    const gus = [];
    for (const sy of [-1, 1]) { const ya = sy < 0 ? -yH : yH - 2.6; gus.push(K.hull([K.cube(xe - Te - 14, ya, 0, xe - Te + 0.5, ya + 2.6, Tw), K.cube(xe - Te - 0.5, ya, 0, xe - Te + 0.5, ya + 2.6, Math.min(zTop - 2, Tw + 14))])); }
    const solid = K.union([plate, endP, ...gus]);
    const Sr = axes([0, 0, -1], [0, 1, 0], [1, 0, 0], [xe, 0, zr]);
    const cuts = servoCut(K, s, fit, -300, 300, -(Te + 3), 6).map(c => K.xf(c, Sr));
    cuts.push(...hornCut(K, h, fit + 0.1, Tw, 90, false));
    return { solid: K.sub(solid, cuts), Sr };
  }
  // 6 joints: gripper base with a back flange that sits on the roll horn (two-arm horn recess on the back face)
  function grip6Part(K, o, D) {
    const s = D.sS, h = D.hS, m = D.m, Tg = D.Tg, Tfl = D.Tfl, zg = D.zg, gx = D.gx6;
    const att = gripAttach(K, o, D, gx, 'top', Tg);
    const yH = Math.max(h.len + D.fit + m, D.cA + D.bossR + m);
    const plate = K.prism([hull2(att.pad.concat(rectPts(0, -yH, Tfl + 2, yH, 2, 8)))], 0, Tg);
    const xCyl = (y, r) => K.xf(K.cyl(0, 0, 0, Tfl, r), mul(tr(0, y, zg), ry(90)));
    const rr = h.w0 / 2 + D.fit + m;
    const flange = K.hull([K.cube(0, -yH, 0, Tfl, yH, 2), xCyl(-(yH - rr), rr), xCyl(yH - rr, rr)]);
    const solid = K.union([plate, flange, ...att.adds]);
    const toFlange = mul(tr(0, 0, zg), ry(90)); // horn part frame: z = 0 on the back face (x = 0), recess into +x
    const cuts = [...att.cuts, ...hornCut(K, h, D.fit + 0.1, Tfl, 90, false).map(c => K.xf(c, toFlange))];
    return { solid: K.sub(solid, cuts), att };
  }
  function fitTestPart(K, o, D, s, h) {
    const m = Math.min(D.m, 4), T = Math.max(3, Math.min(D.Tp, 5)), D2 = Object.assign({}, D, { m });
    const L = Math.ceil((h.D ? h.D / 2 + D.fit + m : h.len + D.fit + m) + 3 + s.off + Math.max(s.L / 2 + D.fit, s.holeX / 2 + s.pilot) + 2);
    const att = servoAttach(K, D2, s, L, 'top', T);
    return linkPart(K, Object.assign({}, o, { style: 'box', cable: false }), D2, { L, T, horn: h, hornRot: 0, attach: att }).solid;
  }
  // dummy servo for the preview (not printed): body, tabs, case top, spline and horn
  function servoDummy(K, s, h, single, hornRot) {
    const body = K.cube(-s.off - s.L / 2, -s.W / 2, -s.below, -s.off + s.L / 2, s.W / 2, s.caseTop);
    const tabs = K.cube(-s.off - s.span / 2, -s.W / 2, 0, -s.off + s.span / 2, s.W / 2, s.tabT);
    const tower = K.cyl(0, 0, s.caseTop - 0.01, s.splineTop - 1.2, s.splineD / 2 + 1.5);
    const servo = K.sub(K.union([body, tabs, tower]), servoTabHoles(s).map(([x, y]) => K.cyl(x, y, -1, s.tabT + 1, s.pilot / 2 + 0.6)));
    const hz0 = partFace(s, h);
    let horn;
    if (h.D) horn = K.union([K.cyl(0, 0, hz0, hz0 + h.T, h.D / 2), K.cyl(0, 0, s.splineTop - 2.5, hz0 + 0.1, 4.6)]);
    else { const ps = [K.cyl(0, 0, s.splineTop - 2.6, hz0 + h.T, h.hub / 2)]; for (const d of single ? [0] : [0, 180]) ps.push(K.prism([hull2(rot2(circ(0, 0, h.w0 / 2, 24).concat(circ(h.len - h.w1 / 2, 0, h.w1 / 2, 16)), d + hornRot))], hz0, hz0 + h.T)); horn = K.union(ps); }
    return { servo: soupOf(servo), horn: soupOf(horn) };
  }

  // ---------------------------------------------------------------- build
  function build(raw, M) {
    if (!M) throw new Error('The arm needs the geometry engine (WebAssembly).');
    const o = options(raw), D = layout(o), K = kit(M, o.detail), warnings = D.warn.slice();
    const frame = o.colors.frame, accent = o.colors.accent || frame;
    try {
      const parts = [];
      const add = (id, name, kind, man, print, color, extra) => parts.push(Object.assign({ id, name, kind, color, local: soupOf(man), print: print || I4(), obj: id }, extra || {}));
      const flipZ = t => mul(tr(0, 0, t), rx(180)); // top face down on the bed
      const tp = baseTextPolys(o, D);
      if (o.baseText && tp.none) warnings.push('There is no room for text on the base. Make the base bigger or the turntable smaller.');
      else if (o.baseText && !tp.fit) warnings.push('The base text was shrunk to fit; shorten it for clearer letters.');
      const B = basePart(K, o, D, tp.polys);
      if (B.text && o.colors.text === frame) add('base', 'Base', 'frame', K.union([B.solid, B.text]), I4(), frame);
      else { add('base', 'Base', 'frame', B.solid, I4(), frame); if (B.text) add('text', 'Base text', 'text', K.k(B.text.subtract(B.solid)), I4(), o.colors.text, { obj: 'base' }); }
      const Tu = turretPart(K, o, D);
      add('turret', 'Turntable and shoulder', 'frame', Tu.solid, tr(0, 0, -D.zT0), frame);
      const pin = D.piv.kind === 'pin', jn = pin ? 'pivot' : 'bearing';
      add('brk_s', `Shoulder ${jn} bracket`, 'frame', shoulderBracketPart(K, D), inv4(shoulderBrkM(D)), frame, { frame: 'turret' });
      const a1 = servoAttach(K, D, D.sM, D.L1, 'bottom', D.Tp);
      const box1 = { H: D.Hu, holes: elbowBrkScrews(D).map(([x, y]) => [x, y, 1.7]) };
      add('upper', 'Upper arm', 'frame', linkPart(K, o, D, { L: D.L1, T: D.Tp, horn: D.hM, hornRot: 0, attach: a1, box: box1 }).solid, I4(), frame);
      add('hub_s', 'Shoulder pivot hub', 'frame', hubPart(K, D, D.hM, D.Tp, D.Tp + D.Hu + 1), I4(), frame, { frame: 'upper' });
      add('brk_e', `Elbow ${jn} bracket`, 'frame', elbowBracketPart(K, D), inv4(elbowBrkM(D)), frame, { frame: 'upper' });
      let grip, W6 = null;
      const a2 = o.dof >= 5 ? servoAttach(K, D, D.sS, D.L2, 'bottom', D.Tp) : gripAttach(K, o, D, D.L2, 'bottom', D.Tp);
      if (o.dof === 4) grip = { host: 'fore', att: a2 };
      add('fore', o.dof === 4 ? 'Forearm and gripper base' : 'Forearm', 'frame', linkPart(K, o, D, { L: D.L2, T: D.Tp, horn: D.hM, hornRot: 0, attach: a2, box: { H: D.Hf } }).solid, I4(), frame);
      add('hub_e', 'Elbow pivot hub', 'frame', hubPart(K, D, D.hM, D.Tp, D.Tp + D.Hf + 1), I4(), frame, { frame: 'fore' });
      if (o.dof === 5) {
        const aw = gripAttach(K, o, D, D.Lw, 'top', D.Tw); grip = { host: 'wrist', att: aw };
        add('wrist', 'Wrist and gripper base', 'accent', linkPart(K, Object.assign({}, o, { style: 'box', cable: false }), D, { L: D.Lw, T: D.Tw, horn: D.hS, hornRot: 90, attach: aw }).solid, I4(), accent);
      } else if (o.dof === 6) {
        W6 = wrist6Part(K, o, D);
        add('wrist', 'Wrist', 'accent', W6.solid, I4(), accent);
        const G6 = grip6Part(K, o, D); grip = { host: 'gripbase', att: G6.att };
        add('gripbase', 'Gripper base', 'accent', G6.solid, I4(), accent);
      }
      const FA = fingerPart(K, o, D, 'A'), FB = fingerPart(K, o, D, 'B');
      add('fingerA', 'Drive finger', 'accent', FA.solid, flipZ(o.fingerT), accent);
      add('fingerB', 'Idler finger', 'accent', FB.solid, I4(), accent);
      const travel = travelFor(D, o, FA);
      if (travel.short) warnings.push(`The fingers open about ${Math.round(travel.reach)} mm at most; make them longer for a ${o.opening} mm opening.`);
      if (o.fitTest) {
        add('fit_main', `Fit test (${D.sM.short})`, 'frame', fitTestPart(K, o, D, D.sM, D.hM), I4(), frame, { fit: true });
        if (D.sS.id !== D.sM.id) add('fit_small', `Fit test (${D.sS.short})`, 'frame', fitTestPart(K, o, D, D.sS, D.hS), I4(), frame, { fit: true });
      }
      const dummies = { main: servoDummy(K, D.sM, D.hM, false, 0), small: servoDummy(K, D.sS, D.hS, false, 90), grip: servoDummy(K, D.sS, D.hG, true, 180) };
      const bd = bearingDummy(K, D);
      if (bd) { dummies.bearS = soupOf(K.xf(bd, shoulderBrkM(D))); dummies.bearE = soupOf(K.xf(bd, elbowBrkM(D))); }
      // print orientation: on the bed, at the origin
      // one shift per printed object, from its main part, so inlaid text stays in place on the base
      for (const q of parts.filter(q => q.id === q.obj)) { const b = Core.bbox(apply(q.print, q.local)); q.t0 = tr(-b.min[0], -b.min[1], -b.min[2]); }
      for (const q of parts) q.m0 = mul(parts.find(h => h.id === q.obj).t0, q.id === q.obj ? q.print : parts.find(h => h.id === q.obj).print);
      for (const q of parts) { const p = apply(q.m0, q.local), b = Core.bbox(p); q.print = q.m0; q.p = p; q.size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]; }
      for (const q of parts) { delete q.t0; delete q.m0; }
      // plate layout (one item per object; the base text rides with the base)
      const objs = [...new Set(parts.map(q => q.obj))].map(id => { const b = Core.bbox(Tools.concat(parts.filter(q => q.obj === id).map(q => q.p))); return { id, w: b.max[0] - b.min[0], h: b.max[1] - b.min[1] }; });
      const pk = Tools.pack(objs.map(x => ({ w: x.w, h: x.h })), o.bed[0], o.bed[1], o.gap, o.gap), tooBig = [];
      objs.forEach((x, i) => { x.pl = pk.place[i]; if (x.pl.sheet < 0) tooBig.push(x.id); });
      const plates = Math.max(1, pk.sheets + (tooBig.length ? 1 : 0));
      if (tooBig.length) warnings.push(`${tooBig.map(id => parts.find(q => q.obj === id).name).join(', ')} ${tooBig.length > 1 ? 'are' : 'is'} bigger than your build plate. Shorten it or pick a bigger printer.`);
      for (const x of objs) {
        const pl = x.pl, big = pl.sheet < 0;
        let mm = pl.rot ? mul(tr(x.h, 0, 0), rz(90)) : I4();
        mm = mul(tr(big ? 0 : pl.x, big ? 0 : o.bed[1] - pl.y - (pl.rot ? x.w : x.h), 0), mm);
        for (const q of parts.filter(q => q.obj === x.id)) { q.plate = big ? plates - 1 : pl.sheet; q.placed = apply(mm, q.p); }
      }
      const colors = []; for (const q of parts) if (!colors.includes(q.color)) colors.push(q.color);
      // static torque at full horizontal reach (printed parts at ~42% of solid PLA)
      const vol = id => { const q = parts.find(x => x.id === id); return q ? Core.signedVolume(q.local) / 1000 : 0; }, g = cc => cc * 1.24 * 0.42;
      const reach2 = D.L1 + D.L2, gearX = o.dof === 4 ? reach2 : o.dof === 5 ? reach2 + D.Lw : reach2 + D.Lw + D.pfS + D.gx6, tip = gearX + o.fingerLen;
      const loads = [[g(vol('upper')), D.L1 / 2], [D.sM.mass + g(vol('brk_e')) + (D.piv.kind === 'bearing' ? 12 : 2), D.L1], [g(vol('fore')), D.L1 + D.L2 / 2], [g(vol('hub_e')), D.L1]];
      if (o.dof >= 5) loads.push([D.sS.mass, reach2], [g(vol('wrist') + vol('gripbase')), (reach2 + gearX) / 2]);
      if (o.dof === 6) loads.push([D.sS.mass, reach2 + D.Lw - 8]);
      loads.push([D.sS.mass, gearX + 6], [g(vol('fingerA') + vol('fingerB')), gearX + o.fingerLen / 2], [o.payload, tip - o.fingerLen * 0.3]);
      const torqueAt = x0 => loads.reduce((t, [mg, x]) => t + (x > x0 ? mg * (x - x0) / 10 : 0), 0) / 1000; // kg\u00b7cm
      const torque = { shoulder: torqueAt(0), elbow: torqueAt(D.L1), wrist: o.dof >= 5 ? torqueAt(reach2) : 0, ratedMain: D.sM.torque, ratedSmall: D.sS.torque };
      if (torque.shoulder > D.sM.torque * 0.6) warnings.push(`The shoulder needs about ${torque.shoulder.toFixed(1)} kg\u00b7cm held straight out with a ${o.payload} g load, over 60% of the ${D.sM.short} (${D.sM.torque} kg\u00b7cm). Shorten the arm, lower the load or pick a stronger servo.`);
      if (o.dof >= 5 && torque.wrist > D.sS.torque * 0.6) warnings.push(`The wrist needs about ${torque.wrist.toFixed(1)} kg\u00b7cm with a ${o.payload} g load, a lot for the ${D.sS.short} (${D.sS.torque} kg\u00b7cm).`);
      const flex = flexOf(D, o, loads, tip);
      const stats = { flex, dof: o.dof, parts: parts.length, plates, colors: colors.length, reach: tip, shoulderH: D.zs, tris: parts.reduce((t, q) => t + q.local.length / 9, 0),
        L1: D.L1, L2: D.L2, Lw: D.Lw, baseSize: D.baseSize, Dt: D.Dt, travel: travel.angle, opening: travel.reach, mainServo: o.mainServo, smallServo: o.smallServo, grip: o.grip, servos: { main: 3, small: o.dof - 3 }, torque };
      const res = { options: o, D, parts, dummies, grip, travel, plates, colors, stats, warnings, W6, S1: Tu.S1 };
      res.hardware = hardware(res);
      res.need = proNeeds(res);
      return res;
    } finally { K.free(); }
  }

  // bending stiffness of a link section (mm^4): web b \u00d7 T with two side walls wf \u00d7 H on top. inPlane is about the
  // joint axis direction (gravity bends the arm in its plane of motion), side is out of that plane.
  function sectionI(b, T, wf, H) {
    const inPlane = T * b ** 3 / 12 + (H > 0 ? 2 * (H * wf ** 3 / 12 + H * wf * (b / 2 - wf / 2) ** 2) : 0);
    const A1 = b * T, A2 = H > 0 ? 2 * wf * H : 0, zc = (A1 * T / 2 + A2 * (T + H / 2)) / (A1 + A2);
    const side = b * T ** 3 / 12 + A1 * (zc - T / 2) ** 2 + (H > 0 ? 2 * (wf * H ** 3 / 12) + A2 * (T + H / 2 - zc) ** 2 : 0);
    return { inPlane, side };
  }
  // tip sag of the upper arm + forearm held straight out (cantilever, printed PLA/PETG at ~2.4 GPa), from the loads
  // beyond the shoulder; and how much stiffer the boxed links are than flat plates of the same web
  function flexOf(D, o, loads, tip) {
    const E = 2400, bU = 2 * (D.sM.W / 2 + D.fit + D.m), bF = 2 * ((o.dof === 4 ? D.sS.W / 2 : D.sS.W / 2) + D.fit + D.m);
    const IU = sectionI(bU, D.Tp, D.wallF, D.Hu), IF = sectionI(bF, D.Tp, D.wallF, D.Hf), fU = sectionI(bU, D.Tp, 0, 0), fF = sectionI(bF, D.Tp, 0, 0);
    const Lr = D.L1 + D.L2, n = 400; let sag = 0, sagFlat = 0;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * Lr / n, Mx = loads.reduce((t, [mg, xl]) => t + (xl > x ? mg * 0.00981 * (Math.min(xl, tip) - x) : 0), 0); // N\u00b7mm
      const I = x < D.L1 ? IU : IF, If = x < D.L1 ? fU : fF;
      sag += Mx * (Lr - x) / (E * I.inPlane) * Lr / n; sagFlat += Mx * (Lr - x) / (E * If.inPlane) * Lr / n;
    }
    return { sag, sagFlat, inPlane: IU.inPlane / fU.inPlane, side: IU.side / fU.side, I: IU };
  }

  // ---------------------------------------------------------------- pose (assembled view)
  // degrees: yaw (base), shoulder (tilt forward from upright), elbow and wrist (bend forward), roll; grip 0 closed .. 1 open
  const DEFAULT_POSE = { yaw: 25, shoulder: 20, elbow: 65, wrist: 60, roll: 0, grip: 0.6 };
  function frames(res, pose) {
    const o = res.options, D = res.D, P = { ...DEFAULT_POSE, ...(pose || {}) }, F = {};
    F.base = I4(); F.text = I4();
    F.servo0Body = tr(0, 0, D.Hb); F.servo0 = mul(tr(0, 0, D.Hb), rz(P.yaw));
    F.turret = rz(P.yaw);
    F.servo1 = mul(F.turret, res.S1);
    F.upper = mul(F.servo1, rz(P.shoulder), tr(0, 0, D.pfM)); // + leans the arm forward, toward the reach (+x)
    F.servo2 = mul(F.upper, servoMount(D.L1, 'bottom', D.Tp));
    F.fore = mul(F.servo2, rz(-P.elbow), tr(0, 0, D.pfM));
    let host = F.fore;
    if (o.dof >= 5) {
      F.servo3 = mul(F.fore, servoMount(D.L2, 'bottom', D.Tp));
      F.wrist = mul(F.servo3, rz(P.wrist), tr(0, 0, D.pfS));
      host = F.wrist;
      if (o.dof === 6) {
        F.servoR = mul(F.wrist, res.W6.Sr);
        F.gripbase = mul(F.servoR, rz(P.roll), [0, 0, -1, D.zg, 0, 1, 0, 0, 1, 0, 0, D.pfS, 0, 0, 0, 1]);
        host = F.gripbase;
      }
    }
    const at = res.grip.att, a = res.travel.angle * clamp(+P.grip || 0, 0, 1);
    F.servoG = mul(host, at.Sg);
    F.fingerA = mul(F.servoG, rz(-a), rz(180), tr(0, 0, D.pfG));
    F.fingerB = mul(host, tr(at.gx, at.yB, at.gearPlane), at.top ? I4() : rx(180), rz(a));
    return F;
  }
  function scene(res, view, pose) {
    const out = [];
    if (view === 'print') {
      let x = 0;
      for (let k = 0; k < res.plates; k++) {
        const ps = res.parts.filter(q => q.plate === k); if (!ps.length) continue;
        for (const q of ps) out.push({ name: q.name, kind: q.kind, color: q.color, id: q.id, p: Float32Array.from(apply(tr(x, 0, 0), q.placed)) });
        x += res.options.bed[0] + 20;
      }
      return out;
    }
    const F = frames(res, pose), o = res.options, d = res.dummies;
    for (const q of res.parts) if (!q.fit) out.push({ name: q.name, kind: q.kind, color: q.color, id: q.id, p: Float32Array.from(apply(F[q.frame || q.id] || F.base, q.local)) });
    if (d.bearS) { out.push({ name: 'Shoulder ball bearing', kind: 'horn', color: '#B8BCC4', p: Float32Array.from(apply(F.turret, d.bearS)) }); out.push({ name: 'Elbow ball bearing', kind: 'horn', color: '#B8BCC4', p: Float32Array.from(apply(F.upper, d.bearE)) }); }
    const put = (body, horn, dm, nm) => { out.push({ name: nm, kind: 'servo', color: '#2B2E35', p: Float32Array.from(apply(body, dm.servo)) }); out.push({ name: nm + ' horn', kind: 'horn', color: '#B8BCC4', p: Float32Array.from(apply(horn, dm.horn)) }); };
    put(F.servo0Body, F.servo0, d.main, 'Base servo');
    const P = { ...DEFAULT_POSE, ...(pose || {}) };
    put(F.servo1, mul(F.servo1, rz(P.shoulder)), d.main, 'Shoulder servo');
    put(F.servo2, mul(F.servo2, rz(-P.elbow)), d.main, 'Elbow servo');
    if (o.dof >= 5) put(F.servo3, mul(F.servo3, rz(P.wrist)), d.small, 'Wrist servo');
    if (o.dof === 6) put(F.servoR, mul(F.servoR, rz(P.roll)), d.small, 'Roll servo');
    put(F.servoG, mul(F.servoG, rz(-res.travel.angle * clamp(+P.grip || 0, 0, 1))), d.grip, 'Gripper servo');
    return out;
  }

  // ---------------------------------------------------------------- hardware list and assembly notes
  function screwLen(x) { for (const L of [6, 8, 10, 12, 16, 20, 25, 30, 35, 40]) if (L >= x) return L; return 40; }
  function hardware(res) {
    const o = res.options, D = res.D, sM = D.sM, sS = D.sS, nS = o.dof - 3, items = [];
    const nm = s => s.label.replace(/ \(.*/, '').replace(/servo/, 'servos');
    items.push({ qty: 3, what: nm(sM), note: `base, shoulder and elbow${sM.teeth ? `; ${sM.teeth}-tooth output spline, 180\u00b0 type` : ''}` });
    items.push({ qty: nS, what: nm(sS), note: o.dof === 4 ? 'gripper' : o.dof === 5 ? 'wrist and gripper' : 'wrist pitch, wrist roll and gripper' });
    if (D.hM.D) items.push({ qty: 3, what: 'Round aluminum disc horns, 25-tooth, 20 mm across, M3 holes on a 14 mm circle', note: 'stronger than the plastic horns in the box' });
    if (D.hM.D) { // through the plastic above the horn recess (less a counterbore), the horn, and 1.5 mm spare
      const h = D.hM, need = t => { const cb = t - h.T > h.cbDepth + 1.2 ? h.cbDepth : 0; return screwLen(t - h.T - 0.15 - cb + h.T + 1.5); };
      const a = need(D.Td), b = need(D.Tp);
      if (a === b) items.push({ qty: 12, what: `M3 \u00d7 ${a} mm screws`, note: 'disc horns to the turntable, upper arm and forearm, 4 each' });
      else { items.push({ qty: 4, what: `M3 \u00d7 ${a} mm screws`, note: 'disc horn to the turntable' }); items.push({ qty: 8, what: `M3 \u00d7 ${b} mm screws`, note: 'disc horns to the upper arm and forearm, 4 each' }); }
    }
    items.push({ qty: 3 * (sM.holeY > 0 ? 4 : 2), what: sM.screw.replace(/ \(.*/, ''), note: 'big servo tabs; they self-tap into the pilot holes' });
    const pv = D.piv;
    if (pv.kind === 'bearing') items.push({ qty: 2, what: `608 ball bearings, ${pv.ID} \u00d7 ${pv.OD} \u00d7 ${pv.W} mm (skate bearings)`, note: 'idler side of the shoulder and elbow; press them into the brackets' });
    else items.push({ qty: 2, what: `M3 \u00d7 ${screwLen(pv.Tch + pv.g + pv.nutT + 1)} mm bolts, M3 nylon lock nuts and M3 washers`, note: 'shoulder and elbow idler pivots; snug, not tight' });
    items.push({ qty: 4, what: `${pv.kind === 'bearing' ? 'M3' : 'M2'} \u00d7 ${screwLen(pv.screwUnder + D.Tp - (D.hM.D ? D.hM.T + 0.9 : 0.8) - 0.5)} mm self-tapping screws`, note: 'pivot hubs to the upper arm and forearm, 2 each' });
    const bs = screwLen(pv.Tch + 10), be = screwLen(D.Tp + 10);
    if (bs === be) items.push({ qty: 4, what: `M3 \u00d7 ${bs} mm self-tapping screws`, note: 'idler brackets, 2 each' });
    else { items.push({ qty: 2, what: `M3 \u00d7 ${bs} mm self-tapping screws`, note: 'shoulder idler bracket to the bridge block' }); items.push({ qty: 2, what: `M3 \u00d7 ${be} mm self-tapping screws`, note: 'elbow idler bracket, down through the upper arm' }); }
    items.push({ qty: nS * 2, what: sS.screw.replace(/ \(.*/, ''), note: 'small servo tabs' });
    items.push({ qty: nS * 2 + (D.hM.D ? 0 : 6), what: 'M2 \u00d7 6 mm self-tapping screws', note: 'plastic horns to the printed parts (often in the servo bag)' });
    items.push({ qty: 1, what: `M3 \u00d7 ${screwLen(D.Tg + D.gearZ + o.fingerT + 4.5)} mm screw, M3 nylon lock nut and 2 M3 washers`, note: 'idler finger axle' });
    if (o.mountHoles) items.push({ qty: 4, what: 'M4 or #8 wood screws', note: 'fix the base to a board or desk; a loose base tips over' });
    if (o.ballRace) items.push({ qty: Math.floor(2 * Math.PI * D.Rb / (o.ballD + 0.6)), what: `${o.ballD} mm balls (plastic airsoft pellets or steel)`, note: 'ball race under the turntable' });
    if (o.cable) items.push({ qty: 8, what: 'Small zip ties, 2.5 mm wide', note: 'wire slots' });
    const amps = 3 * sM.stall + nS * sS.stall, supply = amps > 6 ? 10 : amps > 3 ? 6 : 3;
    items.push({ qty: 1, what: '16-channel PWM servo driver board', note: 'or a microcontroller with enough PWM pins' });
    items.push({ qty: 1, what: 'Microcontroller board', note: 'runs your code' });
    items.push({ qty: 1, what: `5\u20136 V DC power supply, ${supply} A or more`, note: `stalled servos can pull ~${amps.toFixed(1)} A together; never power them from the board` });
    items.push({ qty: o.dof, what: 'Servo extension leads, 20\u201330 cm', note: 'the upper joints need longer wires' });
    const steps = [
      'Print the fit test first. Each servo should drop into its pocket with light friction and the horn should sit flat in its recess. Too tight: raise the fit tolerance by 0.1 mm. Too loose: lower it.',
      'Center every servo before you fit a horn (a 1500 \u00b5s pulse, 90\u00b0), then fit the horn and the part in the straight position shown in the preview.',
      'Base: drop the base servo into the pocket shaft up, wire out of the back tunnel, and screw the tabs.',
      `Turntable: fit a horn on the base servo, then bolt the turntable onto it from the top.${o.ballRace ? ' Fill the ball race groove with the balls first.' : ''}`,
      'Shoulder: push the shoulder servo through the cheek window from the front so the tabs sit on the front face, shaft forward, and screw the tabs.',
      'Upper arm: fit a horn on the shoulder servo and bolt the upper arm on, pointing straight up, channel side away from the servo.',
      `Shoulder idler: screw the pivot hub onto the upper arm over the horn screws, ${D.piv.kind === 'bearing' ? 'press a bearing into the shoulder bracket, slide the bracket over the hub stub' : 'put the pivot bolt through the shoulder bracket into the nut in the hub'} and screw the bracket to the bridge block on the turntable.`,
      'Elbow: mount the elbow servo in the upper arm channel (tabs under the web, shaft out the open side) and bolt the forearm onto its horn, straight in line with the upper arm.',
      `Elbow idler: screw the pivot hub onto the forearm, ${D.piv.kind === 'bearing' ? 'press a bearing into the elbow bracket, slide it over the stub' : 'put the pivot bolt through the elbow bracket into the hub'} and screw the bracket's standoff to the upper arm from inside the channel.`,
      o.dof >= 5 ? 'Wrist: mount the wrist servo in the forearm pocket, screw its two-arm horn into the wrist recess and press the wrist onto the spline, straight in line.' : null,
      o.dof === 6 ? 'Wrist roll: push the roll servo through the wrist end plate, shaft forward, screw its two-arm horn into the back of the gripper base and press it on level.' : null,
      `Gripper: mount the gripper servo, screw its single-arm horn into the drive finger, close the fingers so the pads just touch and press the drive finger on. Put the idler finger on the standoff with the M3 screw, washers and lock nut, snug but free to turn. About ${Math.round(res.travel.angle)}\u00b0 of servo travel from closed gives a ${Math.round(res.travel.reach)} mm opening.`,
      'Wires: run them along the arm, leave slack at every joint, and plug them into the servo driver with the separate power supply.',
      'Set joint limits in your code before the first run so parts never hit each other, and start with slow moves.'
    ].filter(Boolean);
    const print = ['0.2 mm layers, 4 walls, 25\u201340% infill. PETG or tough PLA is stiffer and lasts longer than plain PLA for the arm links.', 'No supports: every part is laid out flat (the arm channels web down, the brackets bearing pocket up); horn recesses and servo windows have short bridges.',
      'The bearings press in with firm thumb pressure. If a pocket is tight, sand it lightly; if it is loose, a drop of glue holds the bearing.', 'Drive the self-tapping screws in slowly the first time to cut the threads.'];
    return { items, steps, print };
  }

  // ---------------------------------------------------------------- export
  function safe(s) { return String(s).replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
  function filaments(res) { return res.colors.map(c => ({ color: c, role: [...new Set(res.parts.filter(q => q.color === c).map(q => q.kind === 'accent' ? 'gripper' : q.kind === 'text' ? 'text' : 'arm'))].join(' + ') })); }
  function export3MF(res, o) {
    o = o || {}; const bed = res.options.bed, n = res.plates, cols = res.colors, objects = [], plates = Array.from({ length: n }, () => []);
    for (const id of [...new Set(res.parts.map(q => q.obj))]) {
      const ps = res.parts.filter(q => q.obj === id), org = Tools.bambuPlateOrigin(ps[0].plate, n, bed[0], bed[1]);
      plates[ps[0].plate].push(objects.length);
      const mk = q => ({ name: q.name, p: apply(tr(org[0], org[1], 0), q.placed), color: q.color, extruder: cols.indexOf(q.color) + 1 });
      if (ps.length > 1) objects.push({ name: ps[0].name, parts: ps.map(mk) }); else objects.push(mk(ps[0]));
    }
    return Tools.threeMF(objects, { title: o.name || 'Robot arm', plates, bambu: o.bambu === undefined ? res.options.bambu : o.bambu, filaments: cols.map(c => ({ color: c })) });
  }
  function readme(res, name) {
    const s = res.stats, o = res.options, D = res.D, hw = res.hardware, f = v => (Math.round(v * 10) / 10).toString(), L = [`Expressarte robot arm: ${name}`, ''];
    L.push(`${o.dof} servos (${o.dof === 4 ? 'base, shoulder, elbow, gripper' : o.dof === 5 ? 'base, shoulder, elbow, wrist, gripper' : 'base, shoulder, elbow, wrist pitch, wrist roll, gripper'}), ${GRIPS[o.grip].label.toLowerCase()} gripper`);
    L.push(`Upper arm ${f(D.L1)} mm, forearm ${f(D.L2)} mm${o.dof >= 5 ? `, wrist ${f(D.Lw)} mm` : ''}, fingers ${f(o.fingerLen)} mm. Reach about ${Math.round(s.reach)} mm; shoulder axis ${Math.round(D.zs)} mm above the desk.`);
    L.push(`Main servos: ${D.sM.label}. Wrist and gripper servos: ${D.sS.label}.`);
    L.push(`Pocket fit tolerance ${f(o.fit)} mm per side. The gripper opens about ${Math.round(res.travel.reach)} mm when its servo turns ${Math.round(res.travel.angle)}\u00b0 from closed.`);
    L.push(`Holding torque straight out with a ${o.payload} g load: shoulder ~${f(s.torque.shoulder)} kg\u00b7cm (servo ${s.torque.ratedMain}), elbow ~${f(s.torque.elbow)} kg\u00b7cm${o.dof >= 5 ? `, wrist ~${f(s.torque.wrist)} kg\u00b7cm (servo ${s.torque.ratedSmall})` : ''}. Keep it under about half the rating.`);
    L.push(`Links: boxed U-channels (${f(D.Tp)} mm web, ${f(D.wallF)} mm walls, ${f(D.Tp + D.Hu)} mm deep upper arm). Estimated tip sag held straight out ~${f(s.flex.sag)} mm from the printed links (servo gear play adds more); about ${Math.round(s.flex.inPlane)}\u00d7 stiffer than flat plates in the plane of motion and ${Math.round(s.flex.side)}\u00d7 sideways. The shoulder and elbow are carried on both sides: the servo horn on one, ${D.piv.kind === 'bearing' ? 'a 608 ball bearing' : 'a bolt pivot'} in an idler bracket on the other.`);
    L.push('', 'Parts to print'); for (const q of res.parts) L.push(`  - ${q.name} (plate ${q.plate + 1})`);
    L.push('', 'Hardware to buy'); for (const it of hw.items) L.push(`  - ${it.qty} \u00d7 ${it.what}${it.note ? ` (${it.note})` : ''}`);
    L.push('', 'Filament slots in the 3MF'); filaments(res).forEach((x, i) => L.push(`  ${i + 1}: ${x.color}  ${x.role}`));
    L.push('', 'Printing'); for (const t of hw.print) L.push(`  - ${t}`);
    L.push('', 'Assembly'); hw.steps.forEach((t, i) => L.push(`  ${i + 1}. ${t}`));
    L.push('', 'Servo sizes used (check yours with calipers)');
    for (const sv of [D.sM, D.sS].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i)) L.push(`  ${sv.label}: body ${sv.L} \u00d7 ${sv.W} mm, ${sv.below} mm below the tabs, tabs ${sv.span} mm tip to tip, ear holes ${sv.holeX} mm apart${sv.holeY ? ` in two rows ${sv.holeY} mm apart` : ''}, shaft ${sv.off} mm from the body center, spline top ${sv.splineTop} mm above the tabs.`);
    L.push('', 'Safety', '  Servos can pinch fingers. Keep hands clear while the arm is powered, and keep small parts away from small children.');
    if (res.warnings.length) L.push('', 'Notes', ...res.warnings.map(x => '  - ' + x));
    L.push('', 'Made with Expressarte');
    return L.join('\n') + '\n';
  }
  function files(res, o) {
    o = o || {}; const name = o.name || 'Robot arm', base = safe(o.fileBase || name.toLowerCase()) || 'robot_arm';
    const list = [{ name: `${base}.3mf`, data: export3MF(res, o) }], seen = new Set();
    for (const q of res.parts) { let nm = safe(q.name.toLowerCase()); while (seen.has(nm)) nm += '_'; seen.add(nm); list.push({ name: `stl/${nm}.stl`, data: new Uint8Array(Core.writeSTL(q.p, q.name)) }); }
    list.push({ name: 'README.txt', data: readme(res, name) });
    return list;
  }
  // what an export uses beyond the free tier (for the paywall request)
  function proNeeds(res) {
    const o = res.options, why = [];
    if (o.dof === 6) why.push('6 servos with wrist roll (Pro)');
    if (o.mainServo === 'custom' || o.smallServo === 'custom') why.push('custom servo size (Pro)');
    if (!GRIPS[o.grip].free) why.push(`${GRIPS[o.grip].label.toLowerCase()} gripper (Pro)`);
    if (o.ballRace) why.push('ball race turntable (Pro)');
    if (o.baseText) why.push('text on the base (Pro)');
    if (res.colors.length > 1) why.push(`${res.colors.length} colors (Pro)`);
    return { tool: 'robotarm', dof: o.dof, customServo: o.mainServo === 'custom' || o.smallServo === 'custom', grip: o.grip, proGrip: !GRIPS[o.grip].free, ballRace: o.ballRace, baseText: !!o.baseText, colors: res.colors.length, reasons: why, pro: why.length > 0 };
  }

  const API = { SERVOS, SERVO_IDS, HORNS, GRIPS, PALETTE, SUGGEST, DEFAULTS, DEFAULT_POSE, options, servoSpec, layout, build, frames, scene, hardware, filaments, export3MF, files, readme, proNeeds, gearPoly, partFace, hornOf, apply, servoDummy, kit, mul, tr, rx, ry, rz, openingAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.GPRobotArm = API;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
