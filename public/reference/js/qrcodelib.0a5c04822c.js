/* Thin wrapper around Kazuhiko Arase's QR Code Generator (MIT). Encodes text to a module matrix at
   error-correction level H by default so a raised 3D print can lose a few modules and still scan. */
(function (G) {
  'use strict';
  let qrcode = G.qrcode;
  if (typeof require === 'function' && (!qrcode || typeof qrcode !== 'function')) {
    try { qrcode = require('../vendor/qrcode/qrcode.js'); } catch (e) { qrcode = null; }
  }
  if (qrcode && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }
  function encode(text, ec) {
    if (!qrcode) throw new Error('QR encoder is not loaded');
    const s = String(text == null ? '' : text);
    if (!s) throw new Error('Nothing to encode');
    const level = ec || 'H';
    let type = 0, last;
    // type 0 = auto; if the payload is too long for H, step down once
    try {
      const qr = qrcode(0, level);
      qr.addData(s);
      qr.make();
      last = qr;
    } catch (e) {
      for (const lv of ['Q', 'M', 'L']) {
        try { const qr = qrcode(0, lv); qr.addData(s); qr.make(); last = qr; break; } catch (e2) {}
      }
      if (!last) throw e;
    }
    const n = last.getModuleCount(), cells = new Array(n);
    for (let r = 0; r < n; r++) {
      const row = new Uint8Array(n);
      for (let c = 0; c < n; c++) row[c] = last.isDark(r, c) ? 1 : 0;
      cells[r] = row;
    }
    return { size: n, cells, text: s, ec: last.errorCorrectionLevel || level };
  }
  const api = { encode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.GPQRCode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
