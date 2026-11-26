(function () {
  var en = (localStorage.getItem('lang') || 'ar') === 'en';
  var T = en ? { title: 'Match a color from a photo', pick: 'Take or choose a photo', again: 'Choose another photo', hint: 'Tap anywhere on the photo to pick that exact color.', dom: 'Colors found in your photo', res: 'Closest yarn colors', none: 'No close colors in stock.', pct: 'match', load: 'Analyzing…', bad: 'Could not read this image. Try another photo.', btn: 'Match color from photo', tip: 'Dress, flower, rug… we find the closest yarn colors.', picked: 'Picked color', bg: 'background' }
    : { title: 'طابق لون من صورة', pick: 'التقط أو اختر صورة', again: 'اختر صورة تانية', hint: 'اضغط على أي مكان في الصورة تختار اللون بالظبط.', dom: 'الألوان اللي لقيناها في صورتك', res: 'أقرب ألوان الخيط', none: 'مفيش ألوان قريبة متوفرة.', pct: 'تطابق', load: 'بنحلل الصورة…', bad: 'مقدرناش نقرأ الصورة دي. جرّب صورة تانية.', btn: 'طابق لون من صورة', tip: 'فستان، وردة، سجادة... وإحنا نلاقي أقرب ألوان خيط.', picked: 'لون مختار', bg: 'خلفية' };

  // ---------- color math ----------
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function rgb2lab(r, g, b) {
    var R = lin(r), G = lin(g), B = lin(b);
    var x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047, y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750, z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    var fx = f(x), fy = f(y), fz = f(z); return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function hex2rgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); if (!/^[0-9a-f]{6}$/i.test(h)) return null; return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function rgb2hex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function de00(l1, l2) { // CIEDE2000
    var rad = Math.PI / 180, L1 = l1[0], a1 = l1[1], b1 = l1[2], L2 = l2[0], a2 = l2[1], b2 = l2[2];
    var C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
    var a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    var h1 = (Math.atan2(b1, a1p) / rad + 360) % 360, h2 = (Math.atan2(b2, a2p) / rad + 360) % 360;
    if (C1p === 0) h1 = 0; if (C2p === 0) h2 = 0;
    var dL = L2 - L1, dC = C2p - C1p, dh = 0;
    if (C1p * C2p !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
    var dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * rad / 2), Lb = (L1 + L2) / 2, Cpb = (C1p + C2p) / 2, hb = h1 + h2;
    if (C1p * C2p !== 0) { hb = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2; }
    var T0 = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
    var dt = 30 * Math.exp(-Math.pow((hb - 275) / 25, 2)), Rc = 2 * Math.sqrt(Math.pow(Cpb, 7) / (Math.pow(Cpb, 7) + Math.pow(25, 7)));
    var Sl = 1 + 0.015 * Math.pow(Lb - 50, 2) / Math.sqrt(20 + Math.pow(Lb - 50, 2)), Sc = 1 + 0.045 * Cpb, Sh = 1 + 0.015 * Cpb * T0, Rt = -Math.sin(2 * dt * rad) * Rc;
    return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
  }

  // ---------- dominant colors (center-weighted, saturation-boosted, background-suppressed) ----------
  function dominant(data, w, h) {
    var px = [], N = w * h, i, x, y;
    for (i = 0; i < N; i++) {
      if (data[i * 4 + 3] < 128) continue;
      var r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], lab = rgb2lab(r, g, b);
      x = (i % w) / w - 0.5; y = Math.floor(i / w) / h - 0.5;
      var cen = 0.3 + 0.7 * Math.exp(-(x * x + y * y) / (2 * 0.3 * 0.3));
      var chroma = Math.min(1, Math.hypot(lab[1], lab[2]) / 70), wt = cen * (0.55 + 0.9 * chroma);
      if (lab[0] > 96 || lab[0] < 4) wt *= 0.25;
      px.push({ lab: lab, rgb: [r, g, b], w: wt, border: (Math.abs(x) > 0.43 || Math.abs(y) > 0.43) });
    }
    if (!px.length) return [];
    // background guess: biggest color bin in the outer frame
    var bins = {}, nb = 0, best = null;
    px.forEach(function (p) { if (!p.border) return; nb++; var k = Math.round(p.lab[0] / 14) + ',' + Math.round(p.lab[1] / 14) + ',' + Math.round(p.lab[2] / 14); var o = bins[k] || (bins[k] = { n: 0, s: [0, 0, 0] }); o.n++; o.s[0] += p.lab[0]; o.s[1] += p.lab[1]; o.s[2] += p.lab[2]; });
    Object.keys(bins).forEach(function (k) { if (!best || bins[k].n > best.n) best = bins[k]; });
    var bg = null;
    if (best && nb && best.n / nb > 0.38) { bg = best.s.map(function (v) { return v / best.n; }); px.forEach(function (p) { if (de00(p.lab, bg) < 14) p.w *= 0.18; }); }
    // sample for speed
    var step = Math.max(1, Math.floor(px.length / 2500)), S = []; for (i = 0; i < px.length; i += step) S.push(px[i]);
    // k-means++ style init (deterministic farthest-first, weighted)
    var K = 6, cs = [S.reduce(function (a, p) { return p.w > a.w ? p : a; }, S[0]).lab.slice()];
    while (cs.length < K) {
      var far = null, fd = -1; S.forEach(function (p) { var d = Math.min.apply(null, cs.map(function (c) { return de00(p.lab, c); })) * p.w; if (d > fd) { fd = d; far = p; } });
      if (!far || fd <= 0.5) break; cs.push(far.lab.slice());
    }
    var asg;
    for (var it = 0; it < 8; it++) {
      var acc = cs.map(function () { return { w: 0, l: [0, 0, 0], r: [0, 0, 0] }; });
      S.forEach(function (p) { var bi = 0, bd = 1e9; for (var k = 0; k < cs.length; k++) { var d = (p.lab[0] - cs[k][0]) * (p.lab[0] - cs[k][0]) + (p.lab[1] - cs[k][1]) * (p.lab[1] - cs[k][1]) + (p.lab[2] - cs[k][2]) * (p.lab[2] - cs[k][2]); if (d < bd) { bd = d; bi = k; } } var a = acc[bi]; a.w += p.w; for (var j = 0; j < 3; j++) { a.l[j] += p.lab[j] * p.w; a.r[j] += p.rgb[j] * p.w; } });
      asg = acc; acc.forEach(function (a, k) { if (a.w > 0) cs[k] = a.l.map(function (v) { return v / a.w; }); });
    }
    var tot = asg.reduce(function (s, a) { return s + a.w; }, 0), out = asg.map(function (a, k) { return a.w > 0 ? { lab: cs[k], rgb: a.r.map(function (v) { return v / a.w; }), share: a.w / tot, bg: !!(bg && de00(cs[k], bg) < 14) } : null; }).filter(Boolean).sort(function (a, b) { return b.share - a.share; });
    var merged = []; out.forEach(function (c) { var m = merged.filter(function (q) { return de00(q.lab, c.lab) < 12; })[0]; if (m) { m.share += c.share; } else merged.push(c); });
    merged.sort(function (a, b) { return (a.bg - b.bg) || (b.share - a.share); });
    return merged.filter(function (c) { return c.share > 0.04; }).slice(0, 4);
  }

  // ---------- matching against the catalog ----------
  var cache = null;
  function catalog() {
    var d = window.BRdata ? window.BRdata() : { colors: [], products: [] }; if (cache && cache.n === d.colors.length && cache.p === d.products.length) return cache;
    var byColor = {}; d.products.forEach(function (p) { (p.color_ids || []).forEach(function (cid) { (byColor[cid] = byColor[cid] || []).push(p); }); });
    var list = []; d.colors.forEach(function (c) { var rgb = hex2rgb(c.hex); if (!rgb || !byColor[c.id]) return; list.push({ c: c, lab: rgb2lab(rgb[0], rgb[1], rgb[2]), ps: byColor[c.id] }); });
    return (cache = { n: d.colors.length, p: d.products.length, list: list });
  }
  function match(lab, n) {
    var cat = catalog().list, scored = cat.filter(function (e) { return !e.c.oos; }).map(function (e) { return { e: e, d: de00(lab, e.lab) }; }).sort(function (a, b) { return a.d - b.d; });
    var groups = [], idx = {};
    scored.forEach(function (s) {
      var code = String(s.e.c.code).toUpperCase(), g = idx[code];
      if (g) { g.rows.push(s.e); return; }
      if (groups.length >= n) return;
      g = idx[code] = { code: s.e.c.code, hex: s.e.c.hex, d: s.d, rows: [s.e] }; groups.push(g);
    });
    return groups;
  }

  // ---------- UI ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var root = document.createElement('div'); root.className = 'cm'; root.hidden = true; root.setAttribute('role', 'dialog');
  root.innerHTML = '<div class="cm-in"><div class="cm-h"><b>' + T.title + '</b><button type="button" class="cm-x" aria-label="close">✕</button></div><div class="cm-b">' +
    '<label class="cm-up"><input type="file" accept="image/*" id="cmf"><span>📷 ' + T.pick + '</span></label><div id="cmi" hidden><div class="cm-cv"><canvas id="cmc"></canvas><i id="cmm" hidden></i></div><p class="cm-hint">' + T.hint + '</p><div class="cm-t">' + T.dom + '</div><div id="cmd" class="cm-d"></div></div><div id="cmr"></div></div></div>';
  document.body.appendChild(root);
  var cv = root.querySelector('#cmc'), ctx = cv.getContext('2d', { willReadFrequently: true }), chips = [], sel = -1, pad = 0;

  function open() { root.hidden = false; document.documentElement.classList.add('lock'); if (!(history.state && history.state.cm)) history.pushState({ cm: 1 }, ''); }
  function close(pop) { if (root.hidden) return; if (!pop && history.state && history.state.cm) { history.back(); return; } root.hidden = true; document.documentElement.classList.remove('lock'); }
  window.addEventListener('popstate', function () { if (!(history.state && history.state.cm)) close(true); });
  root.querySelector('.cm-x').onclick = function () { close(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  function render() {
    var d = root.querySelector('#cmd');
    d.innerHTML = chips.map(function (c, i) { return '<button type="button" class="cm-chip' + (i === sel ? ' on' : '') + '" data-i="' + i + '" style="--c:' + rgb2hex(c.rgb) + '" aria-label="color"><i></i><span>' + (c.custom ? T.picked : c.bg ? T.bg : Math.round(c.share * 100) + '%') + '</span></button>'; }).join('');
    results();
  }
  function results() {
    var r = root.querySelector('#cmr'), c = chips[sel]; if (!c) { r.innerHTML = ''; return; }
    var gs = match(c.lab, 5);
    if (!gs.length) { r.innerHTML = '<p class="cm-t">' + T.none + '</p>'; return; }
    r.innerHTML = '<div class="cm-t">' + T.res + '</div>' + gs.map(function (g) {
      var pct = Math.max(0, Math.round(100 - g.d * 2.2)), cards = [], seen = {};
      g.rows.forEach(function (e) { e.ps.forEach(function (p) { var k = p.id + ':' + e.c.id; if (seen[k]) return; seen[k] = 1; cards.push(window.BRcard({ pid: p.id, cid: e.c.id, code: e.c.code, product: p.name, unit: p.unit, ok: !e.c.oos })); }); });
      return '<div class="cm-g"><div class="cm-gh"><span class="cm-sw" style="background:' + rgb2hex(c.rgb) + '"></span><span class="cm-arrow">→</span><span class="cm-sw" style="background:' + esc(g.hex) + '"></span><b>' + esc(g.code) + '</b><em>' + pct + '% ' + T.pct + '</em></div><div class="ai-i">' + cards.join('') + '</div></div>';
    }).join('');
  }
  root.querySelector('#cmd').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; sel = Number(b.dataset.i); render(); });
  cv.addEventListener('click', function (e) {
    var rc = cv.getBoundingClientRect(), x = Math.floor((e.clientX - rc.left) / rc.width * cv.width), y = Math.floor((e.clientY - rc.top) / rc.height * cv.height), s = 4, sx = Math.max(0, x - s), sy = Math.max(0, y - s);
    var w = Math.min(cv.width - sx, 2 * s + 1), h = Math.min(cv.height - sy, 2 * s + 1), dt = ctx.getImageData(sx, sy, w, h).data, r = 0, g = 0, b = 0, n = 0;
    for (var i = 0; i < dt.length; i += 4) { r += dt[i]; g += dt[i + 1]; b += dt[i + 2]; n++; }
    var rgb = [r / n, g / n, b / n]; chips = chips.filter(function (c) { return !c.custom; }); chips.unshift({ lab: rgb2lab(rgb[0], rgb[1], rgb[2]), rgb: rgb, share: 0, custom: true }); sel = 0;
    var m = root.querySelector('#cmm'); m.hidden = false; m.style.left = (e.clientX - rc.left) + 'px'; m.style.top = (e.clientY - rc.top) + 'px'; m.style.background = rgb2hex(rgb);
    render();
  });
  root.querySelector('#cmf').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = root.querySelector('#cmr'); r.innerHTML = '<p class="cm-t">' + T.load + '</p>';
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      var k = Math.min(1, 480 / Math.max(im.width, im.height)); cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
      ctx.drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      var sm = Math.min(1, 120 / Math.max(cv.width, cv.height)), sw = Math.max(1, Math.round(cv.width * sm)), sh = Math.max(1, Math.round(cv.height * sm)), tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
      var tc = tmp.getContext('2d'); tc.drawImage(cv, 0, 0, sw, sh);
      chips = dominant(tc.getImageData(0, 0, sw, sh).data, sw, sh); sel = 0; root.querySelector('#cmm').hidden = true;
      root.querySelector('#cmi').hidden = false; root.querySelector('.cm-up span').textContent = '📷 ' + T.again;
      if (!chips.length) { r.innerHTML = '<p class="cm-t">' + T.bad + '</p>'; return; }
      render();
    };
    im.onerror = function () { URL.revokeObjectURL(url); r.innerHTML = '<p class="cm-t">' + T.bad + '</p>'; };
    im.src = url; e.target.value = '';
  });

  window.BRcolor = { lab: function (h) { var r = hex2rgb(h); return r ? rgb2lab(r[0], r[1], r[2]) : null; }, de00: de00 };
  window.BRmatch = { open: open, close: close };
  // entry point in the header search bar
  var s = document.querySelector('.search');
  if (s) { var b = document.createElement('button'); b.type = 'button'; b.className = 'cm-btn'; b.setAttribute('aria-label', T.btn); b.title = T.btn;
    b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
    b.onclick = open; s.appendChild(b); }
})();
