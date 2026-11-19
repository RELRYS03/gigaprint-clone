/* Expressarte assembly sheet: a small, dependency-free PDF writer (standard Helvetica fonts, vector
   lines and boxes) and the Giant print assembly sheet built with it. Runs offline in the browser and in Node. */
(function (G) {
  'use strict';
  // Helvetica advance widths (1/1000 em) for ASCII 32..126, from the standard AFM.
  const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  // a few non-ASCII characters the app uses, in WinAnsi
  const WIN = { '\u00d7': 0xd7, '\u00b7': 0xb7, '\u00b0': 0xb0, '\u00d8': 0xd8, '\u2013': 0x96, '\u2014': 0x97, '\u2192': null, '\u2026': 0x85, '\u00b3': 0xb3, '\u00b2': 0xb2 };
  const WIN_W = { 0xd7: 584, 0xb7: 278, 0xb0: 400, 0xd8: 778, 0x96: 556, 0x97: 1000, 0x85: 1000, 0xb3: 333, 0xb2: 333 };
  function enc(str) {
    let out = '';
    for (const ch of String(str)) {
      const c = ch.codePointAt(0);
      if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
      else if (c >= 32 && c < 127) out += ch;
      else if (ch === '\u2192') out += '->';
      else if (WIN[ch]) out += '\\' + WIN[ch].toString(8);
      else out += '?';
    }
    return out;
  }
  function textWidth(str, size, bold) {
    let w = 0;
    for (const ch of String(str)) { const c = ch.codePointAt(0); w += c >= 32 && c < 127 ? HW[c - 32] : ch === '\u2192' ? 1100 : WIN[ch] ? WIN_W[WIN[ch]] : 556; }
    return w / 1000 * size * (bold ? 1.06 : 1);
  }
  const rgb = hex => { const h = String(hex || '#000').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(x => +x.toFixed(3)).join(' '); };
  const f2 = x => (+x).toFixed(2).replace(/\.?0+$/, '') || '0';

  // Pages are drawn with a top-left origin in points (1/72 in). US Letter by default.
  function PDF(opts) {
    const W = (opts && opts.width) || 612, H = (opts && opts.height) || 792;
    const pages = []; let cur = null;
    const doc = {
      W, H,
      page() { cur = []; pages.push(cur); return doc; },
      text(x, y, str, o) {
        o = o || {}; const size = o.size || 10, font = o.bold ? 'F2' : o.mono ? 'F3' : 'F1';
        let tx = x; const w = o.mono ? String(str).length * 0.6 * size : textWidth(str, size, o.bold);
        if (o.align === 'center') tx = x - w / 2; else if (o.align === 'right') tx = x - w;
        cur.push(`BT /${font} ${f2(size)} Tf ${rgb(o.color)} rg ${f2(tx)} ${f2(H - y)} Td (${enc(str)}) Tj ET`);
        return w;
      },
      width: (str, size, bold) => textWidth(str, size || 10, bold),
      line(x1, y1, x2, y2, o) { o = o || {}; cur.push(`${f2(o.width || 0.75)} w ${rgb(o.color || '#000')} RG ${o.dash ? `[${o.dash.join(' ')}] 0 d ` : ''}${f2(x1)} ${f2(H - y1)} m ${f2(x2)} ${f2(H - y2)} l S${o.dash ? ' [] 0 d' : ''}`); },
      rect(x, y, w, h, o) {
        o = o || {}; const op = o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S';
        cur.push(`${o.fill ? rgb(o.fill) + ' rg ' : ''}${o.stroke ? rgb(o.stroke) + ' RG ' + f2(o.width || 0.75) + ' w ' : ''}${f2(x)} ${f2(H - y - h)} ${f2(w)} ${f2(h)} re ${op}`);
      },
      circle(cx, cy, r, o) {
        o = o || {}; const k = 0.5523 * r, Y = H - cy;
        const path = `${f2(cx + r)} ${f2(Y)} m ${f2(cx + r)} ${f2(Y + k)} ${f2(cx + k)} ${f2(Y + r)} ${f2(cx)} ${f2(Y + r)} c ${f2(cx - k)} ${f2(Y + r)} ${f2(cx - r)} ${f2(Y + k)} ${f2(cx - r)} ${f2(Y)} c ${f2(cx - r)} ${f2(Y - k)} ${f2(cx - k)} ${f2(Y - r)} ${f2(cx)} ${f2(Y - r)} c ${f2(cx + k)} ${f2(Y - r)} ${f2(cx + r)} ${f2(Y - k)} ${f2(cx + r)} ${f2(Y)} c`;
        cur.push(`${o.fill ? rgb(o.fill) + ' rg ' : ''}${o.stroke ? rgb(o.stroke) + ' RG ' + f2(o.width || 0.75) + ' w ' : ''}${path} ${o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'}`);
      },
      poly(pts, o) { // closed polygon, [[x, y], ...] in page points
        o = o || {}; if (!pts || pts.length < 3) return;
        const path = pts.map((q, i) => `${f2(q[0])} ${f2(H - q[1])} ${i ? 'l' : 'm'}`).join(' ') + ' h';
        cur.push(`${o.fill ? rgb(o.fill) + ' rg ' : ''}${o.stroke ? rgb(o.stroke) + ' RG ' + f2(o.width || 0.75) + ' w ' : ''}${path} ${o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'}`);
      },
      get pageCount() { return pages.length; },
      bytes(meta) {
        const objs = [];
        const add = s => { objs.push(s); return objs.length; };
        add('<< /Type /Catalog /Pages 2 0 R >>');
        add(null); // pages, filled below
        add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
        const kids = [];
        for (const ops of pages) {
          const body = ops.join('\n');
          const c = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
          kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${c} 0 R >>`));
        }
        objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
        const info = add(`<< /Title (${enc((meta && meta.title) || 'Expressarte')}) /Producer (Expressarte) /Creator (Expressarte) >>`);
        let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const offs = [];
        objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
        const xref = out.length;
        out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
        out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
        const u8 = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u8[i] = out.charCodeAt(i) & 255;
        return u8;
      }
    };
    return doc;
  }

  // ---------------------------------------------------------------- part outlines for the step pictures
  // Convex outline of a part seen from above (X, Y) and from the front (X, Z), from its triangle soup.
  // Sampled to at most ~4000 vertices; a convex outline is plenty to show where a part goes.
  function hull2(pts) {
    const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (P.length < 3) return P;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  function partOutlines(p) {
    const nv = Math.floor(p.length / 3), step = Math.max(1, Math.floor(nv / 4000));
    const top = [], front = [];
    for (let v = 0; v < nv; v += step) { const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2]; top.push([x, y]); front.push([x, z]); }
    const r = h => hull2(h).map(q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]);
    return { top: r(top), front: r(front) };
  }
  // Assembly steps in part order: which already-placed parts each new part joins. Uses the free-cut joins
  // when given, otherwise grid neighbours (cells one step apart along one axis).
  function assemblySteps(d) {
    const pieces = d.pieces.slice().sort((a, b) => a.number - b.number), done = [], out = [];
    const adj = new Map();
    if (d.free && d.free.joins) for (const [a, b, k] of d.free.joins) { (adj.get(a) || adj.set(a, []).get(a)).push([b, k]); (adj.get(b) || adj.set(b, []).get(b)).push([a, k]); }
    for (const pc of pieces) {
      let to;
      if (d.free) to = (adj.get(pc.id) || []).filter(([o]) => done.some(q => q.id === o)).map(([o]) => o);
      else to = done.filter(q => q.cell && pc.cell && q.cell.reduce((s, c, a) => s + Math.abs(c - pc.cell[a]), 0) === 1).map(q => q.id);
      out.push({ id: pc.id, number: pc.number, joins: [...new Set(to)], layer: !d.free && pc.cell ? pc.cell[2] : null, joints: pc.joints || 0 });
      done.push(pc);
    }
    return out;
  }

  // ---------------------------------------------------------------- the assembly sheet
  // d = { model, date, size:[x,y,z], counts:[nx,ny,nz], planes:[[x cuts],[y cuts],[z cuts]],
  //       pieces:[{ id, number, cell:[i,j,k], dims:[x,y,z], joints, est:{weight,length,time,cost} }],
  //       joint:{ name, lines:[...] }, labels: 'text', totals:{weight,length,time,cost}, plates, settings: 'text', notes:[...] }
  const BLUE = '#3d6be4', INK = '#14213d', MUTED = '#5a6785', LINE = '#dce4f5', SOFT = '#e8effd';
  function assemblySheet(d) {
    const pdf = PDF(); const M = 40, PW = pdf.W, PH = pdf.H;
    const pieces = d.pieces.slice().sort((a, b) => a.number - b.number);
    let y = 0;
    const footer = () => {
      pdf.line(M, PH - 34, PW - M, PH - 34, { color: LINE });
      pdf.text(M, PH - 22, 'Estimates are rough guides from the model volume and your settings; your slicer has the final word.', { size: 7.5, color: MUTED });
      pdf.text(PW - M, PH - 22, `Expressarte \u00b7 page ${pdf.pageCount}`, { size: 7.5, color: MUTED, align: 'right' });
    };
    const newPage = (title) => {
      if (pdf.pageCount) footer();
      pdf.page();
      pdf.rect(0, 0, PW, 6, { fill: BLUE });
      pdf.text(M, 34, title, { size: 16, bold: true, color: INK });
      pdf.text(PW - M, 34, d.model, { size: 9, color: MUTED, align: 'right' });
      y = 48;
    };
    newPage('Assembly sheet');
    const n = d.counts, sz = d.size;
    pdf.text(M, y + 10, `Finished size ${sz.map(v => v.toFixed(1)).join(' \u00d7 ')} mm  \u00b7  ${d.free ? (d.free.title || `${d.free.cuts.length} custom cut${d.free.cuts.length === 1 ? '' : 's'}`) : `grid ${n.join(' \u00d7 ')} (X \u00d7 Y \u00d7 Z)`}  \u00b7  ${pieces.length} parts${d.date ? '  \u00b7  ' + d.date : ''}`, { size: 9.5, color: INK });
    y += 22;
    // totals strip
    const T = d.totals || {}; const boxes = [['Filament', T.weight], [d.resin ? 'Resin' : 'Length', T.length], ['Material cost', T.cost], ['Print time', T.time], ['Plates', d.plates != null ? String(d.plates) : '\u2014']];
    const bw = (PW - 2 * M - 4 * 8) / 5;
    boxes.forEach(([k, v], i) => {
      const x = M + i * (bw + 8);
      pdf.rect(x, y, bw, 40, { fill: SOFT });
      pdf.text(x + 8, y + 18, v || '\u2014', { size: 13, bold: true, color: INK });
      pdf.text(x + 8, y + 32, k.toUpperCase() + (i < 4 ? ' (EST.)' : ''), { size: 7, color: MUTED });
    });
    y += 52;
    if (d.settings) { pdf.text(M, y, 'Estimate settings: ' + d.settings, { size: 7.5, color: MUTED }); y += 12; }
    // connectors and labels
    pdf.text(M, y + 10, 'Connectors', { size: 11, bold: true, color: INK }); y += 16;
    pdf.text(M, y + 9, d.joint.name, { size: 9.5, bold: true, color: BLUE }); y += 13;
    for (const l of d.joint.lines || []) { pdf.text(M, y + 9, l, { size: 8.5, color: INK }); y += 11.5; }
    if (d.labels) { pdf.text(M, y + 9, d.labels, { size: 8.5, color: INK }); y += 11.5; }
    y += 8;
    if (d.free) { // custom planes: no grid; list each cut and which parts join there
      pdf.text(M, y + 10, d.free.heading || 'Cuts', { size: 11, bold: true, color: INK }); y += 16;
      for (const c of d.free.cuts) { if (y + 12 > PH - 50) newPage('Cuts (continued)'); pdf.text(M, y + 9, c, { size: 8.5, color: INK }); y += 12; }
      y += 6; pdf.text(M, y + 10, 'What joins what', { size: 11, bold: true, color: INK }); y += 16;
      for (const [a, b, k] of d.free.joins) { if (y + 14 > PH - 50) newPage('Joins (continued)'); pdf.circle(M + 3, y + 6, 2.6, { fill: BLUE }); pdf.text(M + 10, y + 9, `${a} + ${b}${k ? `  \u00b7  ${k} ${k === 1 ? 'joint' : 'joints'}` : '  \u00b7  glue'}`, { size: 9, bold: true, color: INK }); y += 13; }
      y += 10;
    } else {
    // layer grids: top view of each layer, X to the right, front (low Y) at the bottom
    pdf.text(M, y + 10, 'Grid layout (top view, front edge at the bottom)', { size: 11, bold: true, color: INK }); y += 18;
    const byCell = new Map(), more = new Map(); // a cell with separate parts shows its main part's ID and "+n"
    for (const p of pieces) { const k = p.cell.join(','); if (!byCell.has(k)) byCell.set(k, p); else more.set(k, (more.get(k) || 0) + 1); }
    const edges = a => { const pl = (d.planes && d.planes[a]) || []; if (pl.length === n[a] - 1 && pl.every(Number.isFinite)) return [0, ...pl, sz[a]]; return Array.from({ length: n[a] + 1 }, (_, i) => sz[a] * i / n[a]); };
    const xs = edges(0), ys = edges(1);
    const cols = n[2] > 1 ? 2 : 1, gap = 18;
    const boxW = (PW - 2 * M - (cols - 1) * gap) / cols;
    const scale = Math.min(boxW / sz[0], (n[2] > 1 ? 210 : 300) / sz[1]);
    const gw = sz[0] * scale, gh = sz[1] * scale;
    for (let k = 0; k < n[2]; k++) {
      const col = k % cols;
      if (col === 0 && k > 0) y += gh + 34;
      if (y + gh + 30 > PH - 50) { newPage('Assembly sheet (continued)'); }
      const ox = M + col * (boxW + gap) + (boxW - gw) / 2, oy = y + 14;
      pdf.text(M + col * (boxW + gap), y + 8, n[2] > 1 ? `Layer ${k + 1}${k === 0 ? ' (bottom)' : k === n[2] - 1 ? ' (top)' : ''}` : 'Single layer', { size: 9, bold: true, color: MUTED });
      for (let j = 0; j < n[1]; j++) for (let i = 0; i < n[0]; i++) {
        const x0 = ox + xs[i] * scale, x1 = ox + xs[i + 1] * scale, y0 = oy + gh - ys[j + 1] * scale, y1 = oy + gh - ys[j] * scale;
        const pc = byCell.get([i, j, k].join(','));
        if (pc) {
          pdf.rect(x0, y0, x1 - x0, y1 - y0, { fill: '#ffffff', stroke: BLUE, width: 1 });
          const fs = Math.max(6, Math.min(18, (x1 - x0) * 0.3, (y1 - y0) * 0.45));
          pdf.text((x0 + x1) / 2, (y0 + y1) / 2 + fs * 0.35, pc.id + (more.get([i, j, k].join(',')) ? ` +${more.get([i, j, k].join(','))}` : ''), { size: fs, bold: true, color: INK, align: 'center' });
          if ((y1 - y0) > fs * 2.4 && (x1 - x0) > 36) pdf.text((x0 + x1) / 2, (y0 + y1) / 2 + fs * 0.35 + 10, `#${pc.number}`, { size: 7, color: MUTED, align: 'center' });
          // joint markers on shared edges with neighbours that exist
          if (d.joint.marks) {
            if (i + 1 < n[0] && byCell.get([i + 1, j, k].join(','))) pdf.circle(x1, (y0 + y1) / 2, 2.6, { fill: BLUE });
            if (j + 1 < n[1] && byCell.get([i, j + 1, k].join(','))) pdf.circle((x0 + x1) / 2, y0, 2.6, { fill: BLUE });
          }
        } else pdf.rect(x0, y0, x1 - x0, y1 - y0, { stroke: LINE, width: 0.6 });
      }
      pdf.text(ox + gw / 2, oy + gh + 11, 'front', { size: 7, color: MUTED, align: 'center' });
    }
    y += gh + 34;
    if (d.joint.marks) { pdf.circle(M + 3, y - 3, 2.6, { fill: BLUE }); pdf.text(M + 10, y, `= ${d.joint.marks} between neighboring parts${n[2] > 1 ? '; layers also join on their top and bottom faces' : ''}`, { size: 7.5, color: MUTED }); y += 14; }
    }
    // parts table in assembly order
    const colsT = [['#', 22], ['ID', 34], [d.free ? 'Joins' : 'Grid', 50], ['Size (mm)', 118], ['Joints', 40], ['Weight', 54], [d.resin ? 'Resin' : 'Filament', 54], ['Time', 62], ['Cost', 50]];
    const header = () => {
      pdf.rect(M, y, PW - 2 * M, 16, { fill: SOFT });
      let x = M + 6; for (const [h, w] of colsT) { pdf.text(x, y + 11, h.toUpperCase(), { size: 7, bold: true, color: MUTED }); x += w; }
      y += 16;
    };
    if (y + 60 > PH - 50) newPage('Parts (assembly order)'); else { pdf.text(M, y + 10, 'Parts in assembly order', { size: 11, bold: true, color: INK }); y += 18; }
    header();
    for (const pc of pieces) {
      if (y + 15 > PH - 50) { newPage('Parts (continued)'); header(); }
      const vals = [String(pc.number), pc.id, d.free ? (pc.joinsTo || '\u2014') : pc.cell.map(c => c + 1).join('-'), pc.dims.map(v => v.toFixed(1)).join(' \u00d7 '), pc.joints ? String(pc.joints) : '\u2014', pc.est.weight, pc.est.length, pc.est.time, pc.est.cost];
      let x = M + 6; vals.forEach((v, i) => { pdf.text(x, y + 10.5, v, { size: 8.5, bold: i === 1, color: INK }); x += colsT[i][1]; });
      pdf.line(M, y + 15, PW - M, y + 15, { color: LINE, width: 0.5 });
      y += 15;
    }
    y += 12;
    // several printers: which parts each one prints, so they all finish at about the same time
    if (d.farm && d.farm.printers && d.farm.printers.length > 1) {
      const rows = [];
      for (const p of d.farm.printers) {
        const ids = p.jobs.length ? p.jobs : ['(nothing to print)'];
        for (let i = 0; i < ids.length; i += 12) rows.push({ head: i === 0 ? `${p.name}${p.speed !== 100 ? ` (${p.speed}% speed)` : ''}  \u00b7  ${p.time}` : '', ids: ids.slice(i, i + 12).join(', ') });
      }
      if (y + 36 + rows.length * 24 > PH - 50) newPage('Printers');
      pdf.text(M, y + 10, `Printers working at once: all done in about ${d.farm.finish}${d.farm.single ? ` (one printer: ${d.farm.single})` : ''}`, { size: 11, bold: true, color: INK }); y += 18;
      for (const rw of rows) {
        if (y + 24 > PH - 50) newPage('Printers (continued)');
        if (rw.head) { pdf.text(M, y + 9, rw.head, { size: 9, bold: true, color: BLUE }); y += 12; }
        pdf.text(M + 10, y + 9, rw.ids, { size: 8.5, color: INK }); y += 12;
      }
      y += 10;
    }
    // step by step: one small card per part with a top and a front view; parts already in place are grey,
    // the part to add is blue. Needs the part outlines (pc.outline); skipped for very big jobs (the table has the order).
    const ST = assemblySteps(d), hasOut = pieces.every(pc => pc.outline && pc.outline.top && pc.outline.top.length >= 3);
    if (hasOut && pieces.length > 1 && pieces.length <= 120) {
      newPage('Step by step');
      pdf.text(M, y + 9, 'Add the parts in this order. Gray = already in place, blue = the part to add.', { size: 8.5, color: INK }); y += 12;
      pdf.text(M, y + 9, 'In each card: left, seen from above (front edge at the bottom); right, seen from the front.', { size: 8, color: MUTED }); y += 18;
      const all = pieces.map(pc => pc.outline), ext = (k, a) => [Math.min(...all.map(o => Math.min(...o[k].map(q => q[a])))), Math.max(...all.map(o => Math.max(...o[k].map(q => q[a]))))];
      const tx = ext('top', 0), ty = ext('top', 1), fz = ext('front', 1);
      const perRow = 3, gapC = 10, cw = (PW - 2 * M - (perRow - 1) * gapC) / perRow, vw = (cw - 18) / 2, ch = 44 + vw;
      const map = (o, x0, y0, ax, ay) => { const sx = vw / Math.max(1e-6, ax[1] - ax[0]), sy = vw / Math.max(1e-6, ay[1] - ay[0]), sc = Math.min(sx, sy);
        const ox = x0 + (vw - (ax[1] - ax[0]) * sc) / 2, oy = y0 + vw - (vw - (ay[1] - ay[0]) * sc) / 2;
        return o.map(q => [ox + (q[0] - ax[0]) * sc, oy - (q[1] - ay[0]) * sc]); };
      ST.forEach((st, i) => {
        const col = i % perRow;
        if (col === 0 && i > 0) y += ch + 10;
        if (col === 0 && y + ch > PH - 50) newPage('Step by step (continued)');
        const x = M + col * (cw + gapC), pc = pieces[i];
        pdf.rect(x, y, cw, ch, { stroke: LINE, width: 0.75 });
        pdf.circle(x + 13, y + 13, 8, { fill: BLUE });
        pdf.text(x + 13, y + 16.2, String(i + 1), { size: i + 1 >= 100 ? 7 : 9, bold: true, color: '#ffffff', align: 'center' });
        pdf.text(x + 26, y + 16, `Add ${st.id}`, { size: 10, bold: true, color: INK });
        const what = i === 0 ? 'Start here: stand it on the bench.' : st.joins.length ? `${st.layer ? `Layer ${st.layer + 1}: join` : 'Join'} it to ${st.joins.slice(0, 4).join(', ')}${st.joins.length > 4 ? '\u2026' : ''}.` : `Place it${st.layer ? ` on layer ${st.layer + 1}` : ''} (no joint to a placed part yet).`;
        let line = what; while (line.length > 3 && pdf.width(line, 7.5) > cw - 14) line = line.slice(0, -2);
        pdf.text(x + 7, y + 33, line === what ? what : line.replace(/.$/, '\u2026'), { size: 7.5, color: MUTED });
        const vy = y + 40;
        for (const [k, vx, ax, ay] of [['top', x + 6, tx, ty], ['front', x + 12 + vw, tx, fz]]) {
          pdf.rect(vx, vy, vw, vw, { fill: '#f6f8fd' });
          for (let j = 0; j < i; j++) pdf.poly(map(all[j][k], vx, vy, ax, ay), { fill: '#d4dae6', stroke: '#ffffff', width: 0.4 });
          pdf.poly(map(pc.outline[k], vx, vy, ax, ay), { fill: BLUE, stroke: INK, width: 0.6 });
        }
      });
      y += ch + 16;
      if (y + 40 > PH - 50) newPage('Notes');
    }
    const steps = d.notes || [];
    if (steps.length) {
      if (y + 20 + steps.length * 12 > PH - 50) newPage('Notes');
      pdf.text(M, y + 10, 'How to assemble', { size: 11, bold: true, color: INK }); y += 18;
      steps.forEach((s, i) => { if (y + 12 > PH - 50) newPage('Notes (continued)'); pdf.text(M, y + 9, `${i + 1}. ${s}`, { size: 8.5, color: INK }); y += 12; });
    }
    footer();
    return pdf.bytes({ title: `Assembly sheet - ${d.model}` });
  }

  const api = { PDF, assemblySheet, assemblySteps, partOutlines, hull2, textWidth, _enc: enc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else G.GPSheet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
