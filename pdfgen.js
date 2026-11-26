const PDFDocument = require('pdfkit'), path = require('path');
const FR = path.join(__dirname, 'fonts', 'Amiri-Regular.ttf'), FB = path.join(__dirname, 'fonts', 'Amiri-Bold.ttf');
// RTL line: split into Arabic / non-Arabic runs and draw in visual (right-to-left) order
const AR = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
function runs(t) {
  const out = []; let cur = null;
  for (const ch of String(t)) {
    const a = AR.test(ch), neutral = /[\s\-–—.,:;()\/|]/.test(ch);
    const k = neutral && cur ? cur.k : (a ? 'a' : 'l');
    if (cur && cur.k === k) cur.s += ch; else { cur = { k, s: ch }; out.push(cur); }
  }
  return out;
}
function drawRtl(doc, text, xRight, y, opt = {}) {
  const rs = runs(text), size = opt.size || 11, ws = rs.map(r => doc.widthOfString(r.s.replace(/^\s+|\s+$/g, r.k === 'l' ? '' : '$&'), { features: ['rlig'] }));
  const total = ws.reduce((a, b) => a + b, 0); let x;
  if (opt.align === 'center') x = opt.cx + total / 2; else x = xRight;
  rs.forEach((r, i) => { x -= ws[i]; doc.text(r.s, x, y, { lineBreak: false, features: ['rlig'] }); });
  return total;
}
function orderPdf({ title, rows, totalLabel = 'الاجمالي' }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'Bright order' } }), bufs = [];
    doc.on('data', b => bufs.push(b)); doc.on('end', () => resolve(Buffer.concat(bufs))); doc.on('error', reject);
    const L = 40, R = doc.page.width - 40, W = R - L, cNo = 36, cQty = 120, cItem = W - cNo - cQty, rh = 21;
    const xNo = R - cNo, xItem = xNo - cItem, xQty = L;
    let y = 40, n = 0, sum = 0;
    const cell = (x, w, yy, h, fill) => { if (fill) doc.rect(x, yy, w, h).fill(fill); doc.lineWidth(.6).strokeColor('#333').rect(x, yy, w, h).stroke(); };
    const head = () => {
      doc.font(FB).fontSize(13);
      if (y === 40) { cell(L, W, y, 24, '#e4e0d4'); doc.fillColor('#000'); drawRtl(doc, title, 0, y + 5, { align: 'center', cx: L + W / 2 }); y += 24 + 14; }
      cell(xNo, cNo, y, rh, '#e4e0d4'); cell(xItem, cItem, y, rh, '#e4e0d4'); cell(xQty, cQty, y, rh, '#e4e0d4');
      doc.fillColor('#000').fontSize(11);
      drawRtl(doc, 'م', 0, y + 4, { align: 'center', cx: xNo + cNo / 2 }); drawRtl(doc, 'الصنف', 0, y + 4, { align: 'center', cx: xItem + cItem / 2 }); drawRtl(doc, 'الكمية المطلوبة', 0, y + 4, { align: 'center', cx: xQty + cQty / 2 });
      y += rh;
    };
    head();
    for (const r of rows) {
      if (y + rh > doc.page.height - 50) { doc.addPage(); y = 50; head(); }
      n++; sum += r.qty;
      cell(xNo, cNo, y, rh); cell(xItem, cItem, y, rh); cell(xQty, cQty, y, rh);
      doc.font(FR).fontSize(11).fillColor('#000');
      drawRtl(doc, String(n), 0, y + 4, { align: 'center', cx: xNo + cNo / 2 });
      drawRtl(doc, r.label, xItem + cItem - 8, y + 4);
      drawRtl(doc, String(r.qty), 0, y + 4, { align: 'center', cx: xQty + cQty / 2 });
      y += rh;
    }
    if (y + rh > doc.page.height - 50) { doc.addPage(); y = 50; }
    cell(xNo, cNo + cItem, y, rh, '#f1eee4'); cell(xQty, cQty, y, rh, '#f1eee4');
    doc.font(FB).fontSize(12).fillColor('#000');
    drawRtl(doc, totalLabel, 0, y + 4, { align: 'center', cx: xItem + (cItem + cNo) / 2 });
    drawRtl(doc, String(sum), 0, y + 4, { align: 'center', cx: xQty + cQty / 2 });
    doc.end();
  });
}
module.exports = { orderPdf };
