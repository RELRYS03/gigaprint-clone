/* Expressarte phone case generator: phone dimensions (mm).

   Coordinates
   - L \u00d7 W \u00d7 T: body length (top to bottom), width and thickness without the camera bump.
   - corner: { e, n }: the plan-view corner. e is how far the corner curve runs along each edge before the side is
     straight; n is the superellipse exponent (2 = a plain circular arc of radius e). Apple's continuous-curvature
     corners fit n \u2248 3 to within 0.05 mm (checked against the 8-point corner profile in each drawing's Detail A).
   - edge: { back, front }: radius where the side meets the back and the screen (side profile).
   - buttons: side 'L' or 'R' as seen from the SCREEN; y = center from the top edge; len = length along the side;
     z = center height measured from the back; h = button height across the side (in z).
   - camera: as seen from the BACK (how you look at the camera): x from the left edge of the back view, y from the top.
     parts: lenses / flash / sensors (c: circle) and the camera plateau (r: rounded rectangle; full: true means the
     plateau runs edge to edge). bump = how far the highest camera glass stands off the back; plateau = plateau height.
   - bottom: usb = USB-C opening (center offset from the middle, width, height); grille = speaker/mic slot ranges as
     offsets from the middle of the bottom edge; pen = stylus silo.
   - est: which parts were not read from a manufacturer drawing (kept for our records). The Fit and thickness
     controls still let people nudge the openings.

   Sources
   - Apple: "Dimensional Drawings" per device, developer.apple.com/accessories/dimensional-drawings/ (iphone-13 ...
     iphone-18-pro-max PDFs, read 2026-11-11), plus "Accessory Design Guidelines for Apple Devices" R32 (case
     thickness on the back 2.1 mm max for full wireless-charging function; camera keep-outs; recommended USB-C
     connector keep-out 12.45 \u00d7 6.60 mm, R3.25). Button centers/lengths, camera centers/diameters, plateau heights and
     corner profiles below are read off those drawings; body sizes are the drawings' product length/width/thickness.
   - Samsung: body sizes from samsung.com spec pages. S25 and S25 Ultra camera stacks and the S25 Ultra stylus
     slot were revised 2026-11-11 from measured openings on highly rated community TPU cases.
   - Google: body sizes from store.google.com tech specs. Pixel 9 Pro and Pixel 10 Pro camera bars and buttons
     were revised 2026-11-11 from measured community openings.
   - MacBook: closed body sizes from Apple tech specs (apple.com/macbook-air/specs/, apple.com/macbook-pro/specs/,
     read 2026-11-11). Apple's accessory dimensional-drawings list had no Air or Pro drawings on that date (only
     MacBook Neo), so corners, lid/base split, ports, feet, vents and hinge keep-outs follow those specs and photos. */
(function (G) {
  'use strict';
  // iPhone USB-C and speaker slots (Apple's recommended connector keep-out; grille holes run 11.5 to 20.6 mm either side)
  const IP_BOTTOM = { usb: { x: 0, w: 12.45, h: 6.6 }, grille: [[-21.2, -10.9], [10.9, 21.2]], gh: 2.3 };
  const IP_LIGHTNING = { usb: { x: 0, w: 11.2, h: 5.6 }, grille: [[-21.2, -10.9], [10.9, 21.2]], gh: 2.3 };
  const C = (x, y, d) => ({ t: 'c', x, y, d });
  const R = (x0, y0, x1, y1, r, full) => ({ t: 'r', x0, y0, x1, y1, r, full: !!full });
  // left-side button sets (from the screen): action / ring switch + volume; right: side button (+ camera control)
  const leftSet = (z, a, ah, v1, v2, vh, bw, sw) => [
    { side: 'L', kind: sw ? 'switch' : 'action', y: a, len: ah * 2, z, h: sw ? 2.35 : bw },
    { side: 'L', kind: 'volup', y: v1, len: vh * 2, z, h: bw },
    { side: 'L', kind: 'voldown', y: v2, len: vh * 2, z, h: bw }];
  const side = (z, y, half, bw) => ({ side: 'R', kind: 'power', y, len: half * 2, z, h: bw });
  const camctl = (z, y, half, bw) => ({ side: 'R', kind: 'camctl', y, len: half * 2, z, h: bw });

  const PHONES = [
    // ---------------------------------------------------------------- iPhone 18 Pro (Apple drawing 2026)
    { id: 'iphone18pro', brand: 'iphone', name: 'iPhone 18 Pro', year: 2026, L: 150.01, W: 71.85, T: 8.75, corner: { e: 19.43, n: 3 }, edge: { back: 1.6, front: 1.2 },
      buttons: [...leftSet(4.375, 34.28, 3.45, 48.43, 62.63, 5.60, 2.66), side(4.375, 55.53, 8.85, 2.66), camctl(4.375, 98.40, 8.55, 3.03)],
      camera: { parts: [R(1.2, 1.2, 70.6, 50.5, 9.5, true), C(14.37, 14.37, 16.58), C(14.37, 33.61, 16.58), C(32.49, 23.99, 16.58), C(58.03, 13.82, 6.9), C(58.03, 34.16, 6.9)], plateau: 2.78, bump: 4.89 },
      bottom: IP_BOTTOM, est: [] },
    { id: 'iphone18promax', brand: 'iphone', name: 'iPhone 18 Pro Max', year: 2026, L: 163.43, W: 78.0, T: 8.75, corner: { e: 19.43, n: 3 }, edge: { back: 1.6, front: 1.2 },
      buttons: [...leftSet(4.375, 34.28, 3.45, 48.43, 62.63, 5.60, 2.66), side(4.375, 55.53, 8.85, 2.66), camctl(4.375, 111.82, 8.55, 3.03)],
      camera: { parts: [R(1.2, 1.2, 76.8, 50.5, 9.5, true), C(14.37, 14.37, 16.58), C(14.37, 33.61, 16.58), C(32.49, 23.99, 16.58), C(64.16, 13.82, 6.9), C(64.16, 34.16, 6.9)], plateau: 2.78, bump: 4.89 },
      bottom: IP_BOTTOM, est: ['camera'] }, // flash/sensor column taken from the 17 Pro Max drawing (same body), lenses from the 18 Pro
    // ---------------------------------------------------------------- iPhone 17 family (Apple drawings 2025)
    { id: 'iphone17pro', brand: 'iphone', name: 'iPhone 17 Pro', year: 2025, L: 150.01, W: 71.85, T: 8.75, corner: { e: 19.43, n: 3 }, edge: { back: 1.6, front: 1.2 },
      buttons: [...leftSet(4.375, 34.28, 3.45, 48.43, 62.63, 5.60, 2.66), side(4.375, 55.53, 8.85, 2.66), camctl(4.375, 98.40, 8.55, 3.03)],
      camera: { parts: [R(1.2, 1.2, 70.6, 50.5, 9.5, true), C(14.37, 14.37, 16.2), C(14.37, 33.61, 16.2), C(32.36, 23.99, 16.2), C(58.03, 13.82, 6.8), C(58.03, 34.16, 6.65)], plateau: 2.55, bump: 4.43 },
      bottom: IP_BOTTOM, est: [] },
    { id: 'iphone17promax', brand: 'iphone', name: 'iPhone 17 Pro Max', year: 2025, L: 163.43, W: 78.0, T: 8.75, corner: { e: 19.43, n: 3 }, edge: { back: 1.6, front: 1.2 },
      buttons: [...leftSet(4.375, 34.28, 3.45, 48.43, 62.63, 5.60, 2.66), side(4.375, 55.53, 8.85, 2.66), camctl(4.375, 111.82, 8.55, 3.13)],
      camera: { parts: [R(1.2, 1.2, 76.8, 50.5, 9.5, true), C(14.37, 14.37, 16.2), C(14.37, 33.61, 16.2), C(32.36, 23.99, 16.2), C(64.16, 13.82, 6.8), C(64.16, 34.16, 6.65)], plateau: 2.55, bump: 4.43 },
      bottom: IP_BOTTOM, est: [] },
    { id: 'iphoneair', brand: 'iphone', name: 'iPhone Air', year: 2025, L: 156.18, W: 74.7, T: 5.64, corner: { e: 19.2, n: 3 }, edge: { back: 1.0, front: 1.0 },
      buttons: [...leftSet(2.82, 34.08, 3.45, 48.23, 62.43, 5.60, 2.35), side(2.82, 55.33, 8.90, 2.35), camctl(2.82, 104.77, 8.55, 2.53)],
      camera: { parts: [R(1.2, 1.2, 73.5, 27.5, 12, true), C(16.29, 16.29, 15.82), C(58.42, 16.29, 6.3), C(51.34, 16.29, 2.3)], plateau: 3.03, bump: 5.68 },
      bottom: IP_BOTTOM, est: [] },
    { id: 'iphone17', brand: 'iphone', name: 'iPhone 17', year: 2025, L: 149.6, W: 71.5, T: 7.95, corner: { e: 19.23, n: 3 }, edge: { back: 1.2, front: 1.2 },
      buttons: [...leftSet(3.97, 34.08, 3.45, 48.23, 62.43, 5.60, 2.66), side(3.97, 55.32, 8.85, 2.66), camctl(3.97, 98.20, 8.55, 3.03)],
      camera: { parts: [R(1.18, 1.34, 26.08, 40.99, 12.4), C(13.62, 13.62, 16.0), C(13.62, 31.34, 16.0), C(30.41, 22.48, 6.28)], plateau: 1.78, bump: 3.45 },
      bottom: IP_BOTTOM, est: [] },
    // ---------------------------------------------------------------- iPhone 16 family (Apple drawings 2024)
    { id: 'iphone16pro', brand: 'iphone', name: 'iPhone 16 Pro', year: 2024, L: 149.61, W: 71.45, T: 8.25, corner: { e: 19.23, n: 3.1 }, edge: { back: 1.3, front: 1.2 },
      buttons: [...leftSet(4.12, 34.08, 3.45, 48.23, 62.43, 5.60, 2.66), side(4.12, 55.33, 8.85, 2.66), camctl(4.12, 98.19, 8.55, 3.03)],
      camera: { parts: [R(1.04, 1.04, 45.22, 46.54, 8.5), C(14.17, 14.17, 16.2), C(14.17, 33.41, 16.2), C(32.16, 23.79, 16.2), C(32.16, 10.22, 6.92)], plateau: 2.05, bump: 4.28 },
      bottom: IP_BOTTOM, est: [] },
    { id: 'iphone16promax', brand: 'iphone', name: 'iPhone 16 Pro Max', year: 2024, L: 163.03, W: 77.58, T: 8.25, corner: { e: 19.23, n: 3.1 }, edge: { back: 1.3, front: 1.2 },
      buttons: [...leftSet(4.12, 34.08, 3.45, 48.23, 62.43, 5.60, 2.66), side(4.12, 55.33, 8.85, 2.66), camctl(4.12, 111.62, 8.55, 3.03)],
      camera: { parts: [R(1.04, 1.04, 45.22, 46.54, 8.5), C(14.17, 14.17, 16.2), C(14.17, 33.41, 16.2), C(32.16, 23.79, 16.2), C(32.16, 10.22, 6.92)], plateau: 2.05, bump: 4.28 },
      bottom: IP_BOTTOM, est: [] },
    { id: 'iphone16plus', brand: 'iphone', name: 'iPhone 16 Plus', year: 2024, L: 160.89, W: 77.8, T: 7.81, corner: { e: 17.4, n: 3 }, edge: { back: 1.2, front: 1.2 },
      buttons: [...leftSet(3.91, 34.08, 3.45, 48.23, 62.43, 5.60, 2.66), side(3.91, 55.33, 8.85, 2.66), camctl(3.91, 109.48, 8.55, 3.03)],
      camera: { parts: [R(1.09, 1.25, 26.16, 41.0, 12.4), C(13.62, 13.62, 16.0), C(13.62, 31.34, 16.0), C(30.01, 22.48, 6.28)], plateau: 1.85, bump: 3.48 },
      bottom: IP_BOTTOM, est: [] },
    { id: 'iphone16', brand: 'iphone', name: 'iPhone 16', year: 2024, L: 147.64, W: 71.63, T: 7.81, corner: { e: 17.4, n: 3 }, edge: { back: 1.2, front: 1.2 },
      buttons: [...leftSet(3.91, 34.08, 3.45, 48.23, 62.43, 5.60, 2.66), side(3.91, 55.33, 8.85, 2.66), camctl(3.91, 96.23, 8.55, 3.03)],
      camera: { parts: [R(1.09, 1.25, 26.16, 41.0, 12.4), C(13.62, 13.62, 16.0), C(13.62, 31.34, 16.0), C(30.01, 22.48, 6.28)], plateau: 1.85, bump: 3.48 },
      bottom: IP_BOTTOM, est: [] },
    // ---------------------------------------------------------------- iPhone 15 family (Apple drawings 2023)
    { id: 'iphone15promax', brand: 'iphone', name: 'iPhone 15 Pro Max', year: 2023, L: 159.86, W: 76.7, T: 8.25, corner: { e: 17.24, n: 3.1 }, edge: { back: 1.3, front: 1.2 },
      buttons: [...leftSet(4.12, 31.67, 3.02, 45.22, 59.42, 5.60, 2.66), side(4.12, 56.17, 8.85, 2.66)],
      camera: { parts: [R(1.04, 1.04, 45.22, 46.54, 8.5), C(14.17, 14.17, 16.2), C(14.17, 33.41, 16.2), C(32.16, 23.79, 16.2), C(32.16, 10.22, 6.92)], plateau: 2.05, bump: 3.78 },
      bottom: IP_BOTTOM, est: ['buttons'] }, // buttons taken from the 15 Pro drawing (same top section)
    { id: 'iphone15pro', brand: 'iphone', name: 'iPhone 15 Pro', year: 2023, L: 146.61, W: 70.6, T: 8.25, corner: { e: 17.24, n: 3.1 }, edge: { back: 1.3, front: 1.2 },
      buttons: [...leftSet(4.12, 31.67, 3.02, 45.22, 59.42, 5.60, 2.66), side(4.12, 56.17, 8.85, 2.66)],
      camera: { parts: [R(1.04, 1.04, 45.22, 46.54, 8.5), C(14.17, 14.17, 16.2), C(14.17, 33.41, 16.2), C(32.16, 23.79, 16.2), C(32.16, 10.22, 6.92)], plateau: 2.05, bump: 3.78 },
      bottom: IP_BOTTOM, est: [] },
    { id: 'iphone15plus', brand: 'iphone', name: 'iPhone 15 Plus', year: 2023, L: 160.87, W: 77.76, T: 7.81, corner: { e: 17.4, n: 3 }, edge: { back: 1.3, front: 1.2 },
      buttons: [...leftSet(3.91, 32.83, 2.96, 46.27, 60.47, 5.60, 2.66, true), side(3.91, 53.37, 8.85, 2.66)],
      camera: { parts: [R(1.22, 1.22, 37.15, 37.15, 9), C(12.73, 12.73, 15.07), C(25.64, 25.64, 15.07), C(27.32, 11.06, 6.28)], plateau: 1.85, bump: 3.48 },
      bottom: IP_BOTTOM, est: ['buttons'] }, // buttons taken from the iPhone 15 drawing (same top section)
    { id: 'iphone15', brand: 'iphone', name: 'iPhone 15', year: 2023, L: 147.64, W: 71.6, T: 7.81, corner: { e: 17.4, n: 3 }, edge: { back: 1.3, front: 1.2 },
      buttons: [...leftSet(3.91, 32.83, 2.96, 46.27, 60.47, 5.60, 2.66, true), side(3.91, 53.37, 8.85, 2.66)],
      camera: { parts: [R(1.22, 1.22, 37.15, 37.15, 9), C(12.73, 12.73, 15.07), C(25.64, 25.64, 15.07), C(27.32, 11.06, 6.28)], plateau: 1.85, bump: 3.48 },
      bottom: IP_BOTTOM, est: [] },
    // ---------------------------------------------------------------- iPhone 14 / 13 (Apple drawings 2022 / 2021, Lightning)
    { id: 'iphone14promax', brand: 'iphone', name: 'iPhone 14 Pro Max', year: 2022, L: 160.7, W: 77.6, T: 7.85, corner: { e: 17.32, n: 3 }, edge: { back: 0.6, front: 0.6 },
      buttons: [...leftSet(3.92, 31.14, 2.96, 44.59, 58.79, 5.90, 3.26, true), side(3.92, 55.54, 9.15, 3.26)],
      camera: { parts: [R(2.19, 2.19, 45.61, 45.61, 8), C(14.28, 14.28, 15.61), C(14.28, 33.52, 15.61), C(32.12, 23.9, 15.61), C(32.12, 10.32, 6.9)], plateau: 1.85, bump: 4.18 },
      bottom: IP_LIGHTNING, est: ['buttons', 'camera'] }, // from the 14 Pro drawing
    { id: 'iphone14pro', brand: 'iphone', name: 'iPhone 14 Pro', year: 2022, L: 147.46, W: 71.5, T: 7.85, corner: { e: 17.32, n: 3 }, edge: { back: 0.6, front: 0.6 },
      buttons: [...leftSet(3.92, 31.14, 2.96, 44.59, 58.79, 5.90, 3.26, true), side(3.92, 55.54, 9.15, 3.26)],
      camera: { parts: [R(2.19, 2.19, 45.61, 45.61, 8), C(14.28, 14.28, 15.61), C(14.28, 33.52, 15.61), C(32.12, 23.9, 15.61), C(32.12, 10.32, 6.9)], plateau: 1.85, bump: 4.18 },
      bottom: IP_LIGHTNING, est: [] },
    { id: 'iphone14plus', brand: 'iphone', name: 'iPhone 14 Plus', year: 2022, L: 160.8, W: 78.1, T: 7.8, corner: { e: 16.14, n: 3 }, edge: { back: 0.6, front: 0.6 },
      buttons: [...leftSet(3.90, 31.98, 2.96, 45.43, 59.63, 5.92, 3.31, true), side(3.90, 52.53, 9.17, 3.31)],
      camera: { parts: [R(1.2, 1.2, 35.9, 35.9, 8.5), C(11.88, 11.88, 14.38), C(24.63, 24.63, 14.38), C(26.30, 10.21, 6.28)], plateau: 1.85, bump: 3.42 },
      bottom: IP_LIGHTNING, est: ['buttons'] }, // from the iPhone 14 drawing
    { id: 'iphone14', brand: 'iphone', name: 'iPhone 14', year: 2022, L: 146.71, W: 71.5, T: 7.8, corner: { e: 16.14, n: 3 }, edge: { back: 0.6, front: 0.6 },
      buttons: [...leftSet(3.90, 31.98, 2.96, 45.43, 59.63, 5.92, 3.31, true), side(3.90, 52.53, 9.17, 3.31)],
      camera: { parts: [R(1.2, 1.2, 35.9, 35.9, 8.5), C(11.88, 11.88, 14.38), C(24.63, 24.63, 14.38), C(26.30, 10.21, 6.28)], plateau: 1.85, bump: 3.42 },
      bottom: IP_LIGHTNING, est: [] },
    { id: 'iphone13promax', brand: 'iphone', name: 'iPhone 13 Pro Max', year: 2021, L: 160.8, W: 78.1, T: 7.65, corner: { e: 17.0, n: 3 }, edge: { back: 0.6, front: 0.6 },
      buttons: [...leftSet(3.85, 31.5, 2.96, 45.0, 59.2, 5.90, 3.26, true), side(3.85, 55.5, 9.15, 3.26)],
      camera: { parts: [R(2.0, 2.0, 43.5, 43.5, 8), C(13.8, 13.8, 14.8), C(13.8, 32.2, 14.8), C(30.9, 23.0, 14.8), C(30.9, 10.0, 6.5)], plateau: 1.8, bump: 3.9 },
      bottom: IP_LIGHTNING, est: ['buttons', 'camera'] },
    { id: 'iphone13pro', brand: 'iphone', name: 'iPhone 13 Pro', year: 2021, L: 146.7, W: 71.5, T: 7.65, corner: { e: 17.0, n: 3 }, edge: { back: 0.6, front: 0.6 },
      buttons: [...leftSet(3.85, 31.5, 2.96, 45.0, 59.2, 5.90, 3.26, true), side(3.85, 55.5, 9.15, 3.26)],
      camera: { parts: [R(2.0, 2.0, 43.5, 43.5, 8), C(13.8, 13.8, 14.8), C(13.8, 32.2, 14.8), C(30.9, 23.0, 14.8), C(30.9, 10.0, 6.5)], plateau: 1.8, bump: 3.9 },
      bottom: IP_LIGHTNING, est: ['buttons', 'camera'] },
    { id: 'iphone13', brand: 'iphone', name: 'iPhone 13', year: 2021, L: 146.7, W: 71.5, T: 7.65, corner: { e: 16.14, n: 3 }, edge: { back: 0.6, front: 0.6 },
      buttons: [...leftSet(3.83, 31.98, 2.96, 45.43, 59.63, 5.92, 3.31, true), side(3.83, 52.53, 9.17, 3.31)],
      camera: { parts: [R(1.2, 1.2, 35.9, 35.9, 8.5), C(11.88, 11.88, 14.38), C(24.63, 24.63, 14.38), C(26.30, 10.21, 6.28)], plateau: 1.8, bump: 3.3 },
      bottom: IP_LIGHTNING, est: ['buttons', 'camera'] }, // same body and camera layout as the iPhone 14 drawing
    // ---------------------------------------------------------------- Galaxy (S25 and S25 Ultra, openings checked against community cases)
    { id: 'galaxys25ultra', brand: 'galaxy', name: 'Galaxy S25 Ultra', year: 2025, L: 162.8, W: 77.6, T: 8.2, corner: { e: 8.5, n: 2 }, edge: { back: 1.0, front: 1.0 },
      buttons: [{ side: 'R', kind: 'volume', y: 44, len: 24, z: 4.1, h: 2.6 }, { side: 'R', kind: 'power', y: 67, len: 12, z: 4.1, h: 2.6 }],
      camera: { parts: [R(6.2, 5.8, 36.4, 59.1, 9), C(14.60, 14.15, 15.7), C(14.60, 32.40, 15.7), C(14.60, 50.65, 15.7), C(31.45, 14.15, 8.7), C(31.45, 23.28, 4.4), C(31.45, 32.40, 8.7)], plateau: 0, bump: 1.8 },
      bottom: { usb: { x: 0, w: 12.6, h: 6.4 }, grille: [[10.5, 22]], gh: 2.4, pen: { x: -18.5, w: 6.2, h: 5.6 } }, est: ['buttons', 'camera', 'ports'] },

    { id: 'galaxys25', brand: 'galaxy', name: 'Galaxy S25', year: 2025, L: 146.9, W: 70.5, T: 7.2, corner: { e: 10, n: 2 }, edge: { back: 0.9, front: 0.9 },
      buttons: [{ side: 'R', kind: 'volume', y: 37, len: 22, z: 3.6, h: 2.4 }, { side: 'R', kind: 'power', y: 58, len: 11, z: 3.6, h: 2.4 }],
      camera: { parts: [R(5.9, 5.4, 30.2, 52.0, 8), C(13.18, 12.60, 13.5), C(13.18, 28.67, 13.5), C(13.18, 44.75, 13.5), C(27.30, 20.70, 4.5)], plateau: 0, bump: 1.6 },
      bottom: { usb: { x: 0, w: 12.6, h: 6.4 }, grille: [[10.5, 20]], gh: 2.4 }, est: ['buttons', 'camera', 'ports'] },




    { id: 'pixel10pro', brand: 'pixel', name: 'Pixel 10 Pro', year: 2025, L: 152.8, W: 72.0, T: 8.6, corner: { e: 11.5, n: 2 }, edge: { back: 1.2, front: 1.0 },
      buttons: [{ side: 'R', kind: 'power', y: 48, len: 12, z: 4.3, h: 2.6 }, { side: 'R', kind: 'volume', y: 72, len: 25, z: 4.3, h: 2.6 }],
      camera: { parts: [R(4.1, 14.4, 68.0, 35.3, 11.25), C(16.22, 24.85, 14), C(32.74, 24.85, 14), C(48.72, 24.85, 11.5), C(60.29, 24.85, 4.3)], plateau: 0, bump: 3.4 },
      bottom: { usb: { x: 0, w: 12.6, h: 6.4 }, grille: [[-23, -12], [12, 23]], gh: 2.2 }, est: ['buttons', 'camera', 'ports'] },


    { id: 'pixel9pro', brand: 'pixel', name: 'Pixel 9 Pro', year: 2024, L: 152.8, W: 72.0, T: 8.5, corner: { e: 11.5, n: 2 }, edge: { back: 1.2, front: 1.0 },
      buttons: [{ side: 'R', kind: 'power', y: 48, len: 12, z: 4.25, h: 2.6 }, { side: 'R', kind: 'volume', y: 72, len: 25, z: 4.25, h: 2.6 }],
      camera: { parts: [R(4.1, 14.4, 68.0, 35.3, 11.25), C(16.22, 24.85, 14), C(32.74, 24.85, 14), C(48.72, 24.85, 11.5), C(60.29, 24.85, 4.3)], plateau: 0, bump: 3.2 },
      bottom: { usb: { x: 0, w: 12.6, h: 6.4 }, grille: [[-23, -12], [12, 23]], gh: 2.2 }, est: ['buttons', 'camera', 'ports'] },

  ];
  // ---------------------------------------------------------------- MacBook hard shells (closed body size official)
  // Body W \u00d7 D \u00d7 T (closed) from Apple tech specs, read 2026-11-11:
  //   apple.com/macbook-air/specs/ and apple.com/macbook-pro/specs/.
  // M2/M3/M4/M5 Air 13-inch share 304.1 \u00d7 215.0 \u00d7 11.3 mm; 15-inch share 340.4 \u00d7 237.6 \u00d7 11.5 mm.
  // M3/M4/M5 Pro 14-inch share 312.6 \u00d7 221.2 \u00d7 15.5 mm; 16-inch share 355.7 \u00d7 248.1 \u00d7 16.8 mm.
  // Apple's current accessory dimensional-drawings list (developer.apple.com/accessories/dimensional-drawings/,
  // read 2026-11-11) includes MacBook Neo but not these Air/Pro models, so corner radius, lid vs base
  // thickness, hinge keep-out, feet, ports and vents are estimated from official product photos and
  // the published body size. Coordinates: origin at the plan-view center, +x to the
  // right, +y toward the hinge (back), z up from the desk. Ports: fromBack is the center from the
  // back edge; z is the center from the bottom of the base; len/h are the connector keep-out.
  const foot4 = (W, D, ix, ifr, iba, fw, fd) => [
    { x: ix, y: ifr, w: fw, d: fd }, { x: W - ix, y: ifr, w: fw, d: fd },
    { x: ix, y: D - iba, w: fw, d: fd }, { x: W - ix, y: D - iba, w: fw, d: fd }];
  const P_MS = (fromBack, z) => ({ side: 'L', kind: 'magsafe', fromBack, len: 13.0, z, h: 5.4 });
  const P_TB = (side, fromBack, z) => ({ side, kind: 'usbc', fromBack, len: 11.5, z, h: 4.8 });
  const P_HP = (fromBack, z) => ({ side: 'R', kind: 'headphone', fromBack, len: 8.0, z, h: 6.0 });
  const P_HDMI = (fromBack, z) => ({ side: 'R', kind: 'hdmi', fromBack, len: 16.5, z, h: 6.8 });
  const P_SD = (fromBack, z) => ({ side: 'R', kind: 'sd', fromBack, len: 15.5, z, h: 3.2 });
  const airPorts = z => [P_MS(27, z), P_TB('L', 49, z), P_TB('L', 71, z), P_HP(30, z)];
  const proPorts = z => [P_MS(25, z), P_TB('L', 47, z), P_TB('L', 69, z), P_HP(96, z), P_HDMI(28, z), P_SD(55, z), P_TB('R', 86, z)];
  const proVents = (W, D) => [
    { x0: 28, y0: D * 0.42, x1: W / 2 - 16, y1: D - 26, r: 8 },
    { x0: W / 2 + 16, y0: D * 0.42, x1: W - 28, y1: D - 26, r: 8 }];
  const LAPTOPS = [
    { id: 'mba13', kind: 'laptop', brand: 'macbook', name: 'MacBook Air 13-inch (M2, M3, M4, M5)', year: 2022,
      W: 304.1, D: 215.0, T: 11.3, corner: { e: 9.6, n: 2 }, lidT: 4.4, baseT: 6.9, hinge: { inset: 20 },
      feet: foot4(304.1, 215.0, 22, 22, 34, 24, 12), ports: airPorts(3.45), vents: [],
      est: ['corners', 'lid', 'ports', 'feet', 'hinge'] },
    { id: 'mba15', kind: 'laptop', brand: 'macbook', name: 'MacBook Air 15-inch (M2, M3, M4, M5)', year: 2023,
      W: 340.4, D: 237.6, T: 11.5, corner: { e: 9.6, n: 2 }, lidT: 4.4, baseT: 7.1, hinge: { inset: 20 },
      feet: foot4(340.4, 237.6, 22, 22, 34, 24, 12), ports: airPorts(3.55), vents: [],
      est: ['corners', 'lid', 'ports', 'feet', 'hinge'] },
    { id: 'mbp14', kind: 'laptop', brand: 'macbook', name: 'MacBook Pro 14-inch (M3, M4, M5)', year: 2023,
      W: 312.6, D: 221.2, T: 15.5, corner: { e: 9.0, n: 2 }, lidT: 5.2, baseT: 10.3, hinge: { inset: 22 },
      feet: foot4(312.6, 221.2, 20, 22, 36, 24, 12), ports: proPorts(5.15), vents: proVents(312.6, 221.2),
      est: ['corners', 'lid', 'ports', 'feet', 'hinge', 'vents'] },
    { id: 'mbp16', kind: 'laptop', brand: 'macbook', name: 'MacBook Pro 16-inch (M3, M4, M5)', year: 2023,
      W: 355.7, D: 248.1, T: 16.8, corner: { e: 9.0, n: 2 }, lidT: 5.5, baseT: 11.3, hinge: { inset: 22 },
      feet: foot4(355.7, 248.1, 20, 22, 36, 24, 12), ports: proPorts(5.65), vents: proVents(355.7, 248.1),
      est: ['corners', 'lid', 'ports', 'feet', 'hinge', 'vents'] }
  ];
  const BRANDS = { iphone: 'iPhone', galaxy: 'Galaxy', pixel: 'Pixel', macbook: 'MacBook' };
  const DEVICES = PHONES.concat(LAPTOPS);
  const byId = Object.fromEntries(DEVICES.map(p => [p.id, p]));
  const isLaptop = d => !!(d && d.kind === 'laptop');
  const api = { PHONES, LAPTOPS, DEVICES, BRANDS, byId, isLaptop };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPPhoneModels = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
