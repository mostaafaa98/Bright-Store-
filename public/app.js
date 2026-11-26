(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $('#app'), S = { user: null, token: localStorage.getItem('token'), cfg: { zones: [], wallet: {}, instapay: {} }, products: [], colors: [], cart: {}, cat: '', colorF: null, A: { tab: 'home', f: {}, rep: { by: 'product' }, aq: '' }, edit: null, pc: {}, qr: '', my: [] };
  try { S.cart = JSON.parse(localStorage.getItem('cart') || '{}'); S.my = JSON.parse(localStorage.getItem('myorders') || '[]'); } catch (e) {}
  var ST = { new: 'جديد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
  var PS = { pending: 'غير مدفوع', review: 'بانتظار المراجعة', paid: 'مدفوع' };
  var PM = { cod: 'عند الاستلام', wallet: 'فودافون كاش', instapay: 'إنستا باي' };
  var SPECS = [['spec_weight', 'الوزن'], ['spec_count', 'عدد البكر / القطع'], ['spec_length', 'الطول'], ['spec_material', 'الخامة'], ['spec_size', 'المقاس / الإبر المناسبة'], ['spec_usage', 'الاستخدام']];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function egp(c) { var v = c / 100; var en = document.documentElement.lang === 'en'; return (v % 1 ? v.toFixed(2) : v).toLocaleString(en ? 'en-US' : 'ar-EG') + (en ? ' EGP' : ' ج.م'); }
  function toast(t) { var e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, 2400); }
  function api(path, opt) {
    opt = opt || {}; var h = { 'Content-Type': 'application/json' }; if (S.token) h.Authorization = 'Bearer ' + S.token;
    return fetch('/api' + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && S.token) logout(true);
        if (!r.ok) throw new Error(d.error || 'حدث خطأ'); return d; });
    });
  }
  function download(path, name) {
    fetch('/api' + path, { headers: { Authorization: 'Bearer ' + S.token } }).then(function (r) { if (!r.ok) throw new Error('تعذر التنزيل'); return r.blob(); }).then(function (b) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000); }).catch(function (x) { toast(x.message); });
  }
  function qs(o) { return Object.keys(o).filter(function (k) { return o[k]; }).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); }
  function prod(id) { return S.products.filter(function (p) { return p.id === Number(id); })[0]; }
  function wall() {
    var cs = S.colors.filter(function (c) { return c.t; }), out = [], step = Math.max(1, Math.floor(cs.length / 15));
    for (var i = 0; i < cs.length && out.length < 15; i += step) out.push(cs[i]);
    return out.length ? '<div class="wall" aria-hidden="true">' + out.map(function (c) { return '<i style="' + esc(cbg(c)) + '"></i>'; }).join('') + '</div>' : '';
  }
  function cl(c) { return c ? (c.name ? c.code + ' - ' + c.name : c.code) : ''; }
  function cbg(c) { return c ? 'background:' + c.hex + (c.t ? ' url(' + c.t + ') center/cover' : '') : ''; }
  function avail(p) { return p.color_ids.filter(function (id) { var c = color(id); return !(c && c.oos); }).length; }
  function capOf(p, c) { return c && c.mx != null && (p.unit !== 'كيلو' || c.line === 'linen') ? c.mx : null; }
  function heroId(p) {
    if (M && M.p === p && M.hero && color(M.hero) && color(M.hero).img) return M.hero;
    var cs = p.color_ids.map(color).filter(function (c) { return c && c.img && !c.oos; });
    return cs.length ? cs[0].id : 0;
  }
  function heroImg(p) { if (!p.has_colors) return p.images[0]; var id = heroId(p), c = id && color(id); return c ? c.img : p.images[0]; }
  function color(id) { return S.colors.filter(function (c) { return c.id === Number(id); })[0]; }
  function unitPrice(p, q) { return q >= S.cfg.wholeMin ? p.p_whole : q >= S.cfg.halfMin ? p.p_half : p.p_retail; }
  function saveCart() { localStorage.setItem('cart', JSON.stringify(S.cart)); nav(); }
  function groups() {
    var g = {};
    Object.keys(S.cart).forEach(function (k) {
      var a = k.split(':'), p = prod(a[0]), c = Number(a[1]);
      if (!p || (p.has_colors && p.color_ids.indexOf(c) < 0)) { delete S.cart[k]; return; }
      g[p.id] = g[p.id] || { p: p, q: 0, lines: [] }; g[p.id].q += S.cart[k]; g[p.id].lines.push({ key: k, cid: c, qty: S.cart[k] });
    });
    return Object.keys(g).map(function (k) { return g[k]; });
  }
  function cartTotal() { return groups().reduce(function (n, g) { return n + unitPrice(g.p, g.q) * g.q; }, 0); }
  function cartCount() { return Object.keys(S.cart).reduce(function (n, k) { return n + S.cart[k]; }, 0); }
  function logout(silent) { localStorage.removeItem('token'); S.token = null; S.user = null; nav(); if (!silent) location.hash = '#/'; }
  function tabOn() {
    var hs = location.hash || '#/', els = document.querySelectorAll('#nav a');
    for (var i = 0; i < els.length; i++) { var h = els[i].getAttribute('href'); els[i].classList.toggle('on', h === '#/' ? (hs === '#/' || hs === '#' || hs === '') : hs.indexOf(h) === 0); }
  }
  function prefill() {
    var f = $('#co'); if (!f) return; var c; try { c = JSON.parse(localStorage.getItem('cust') || 'null'); } catch (e) { c = null; } if (!c) return;
    ['name', 'phone', 'governorate', 'area', 'address'].forEach(function (k) { if (f[k] && !f[k].value && c[k]) f[k].value = c[k]; });
    coSummary();
  }
  function nav() {
    var n = cartCount(), h = '<a class="nl tabh" href="#/">' + ic('house') + '<span>الرئيسية</span></a><a class="nl" href="#/orders">' + ic('box') + '<span>طلباتي</span></a>';
    if (S.user && (S.user.role === 'admin' || S.user.role === 'staff')) h += '<a class="nl" href="#/admin">' + ic('gear') + '<span>لوحة التحكم</span></a>';
    h += S.user ? '<button class="nl" data-act="logout">' + ic('user') + '<span>خروج</span></button>' : '<a class="nl" href="#/login">' + ic('user') + '<span>دخول</span></a>';
    h += '<a class="cartbtn" href="#/cart" aria-label="السلة">' + ic('cart') + '<span class="cnt' + (n ? '' : ' z') + '" id="cnt">' + n + '</span></a>';
    $('#nav').innerHTML = h; tabOn(); cartbar();
  }
  function msg(t, ok) { var e = $('#m'); if (e) { e.className = ok ? 'ok' : 'err'; e.textContent = t; } }
  function nudge(g) {
    var u = unitPrice(g.p, g.q), c = S.cfg;
    if (g.q < c.halfMin && g.p.p_half < u) return 'أضف ' + (c.halfMin - g.q) + ' ' + g.p.unit + ' لتحصل على سعر نصف الجملة ' + egp(g.p.p_half);
    if (g.q < c.wholeMin && g.p.p_whole < u) return 'أضف ' + (c.wholeMin - g.q) + ' ' + g.p.unit + ' لتحصل على سعر الجملة ' + egp(g.p.p_whole);
    return '';
  }
  function bg(u) { return u ? "background-image:url('" + esc(u) + "')" : ''; }

  // ---------- أيقونات ----------
  var ICONS = {
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    house: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    cart: '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6"/><circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4z"/><path d="m3 7 9 4 9-4M12 11v10"/>',
    leaf: '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15z"/><path d="M5 19 14 10"/>',
    drop: '<path d="M12 3c4 4.5 6 7.5 6 10a6 6 0 0 1-12 0c0-2.5 2-5.5 6-10z"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h5l3 3v4h-8"/><circle cx="6" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/>',
    chat: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>'
  };
  function ic(n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }
  function num(c) { return (c / 100).toLocaleString('ar-EG'); }
  function cartbar() {
    var b = $('#cartbar'), n = cartCount();
    b.hidden = !n || /^#\/(cart|admin|login|register)/.test(location.hash);
    if (n) b.innerHTML = '<a href="#/cart">' + ic('cart') + '<span>السلة (' + n + ')</span><b>' + egp(cartTotal()) + '</b><em>إتمام الطلب</em></a>';
  }
  function same(p) { return p.p_retail === p.p_half && p.p_half === p.p_whole; }
  function ladder(p) {
    if (same(p)) return '';
    return '<div class="ladder"><div><small>قطاعي</small><b>' + num(p.p_retail) + '</b></div><div><small>من ' + S.cfg.halfMin + '</small><b>' + num(p.p_half) + '</b></div><div class="best"><small>من ' + S.cfg.wholeMin + '</small><b>' + num(p.p_whole) + '</b></div></div>';
  }
  function tiersTable(p, q) {
    if (same(p)) return '<div class="pr"><b>' + egp(p.p_retail) + '</b><span>/ ' + esc(p.unit) + ' — سعر موحد</span></div>';
    var c = S.cfg, rows = [['قطاعي', 'أقل من ' + c.halfMin, p.p_retail, q < c.halfMin], ['نصف جملة', 'من ' + c.halfMin + ' إلى ' + (c.wholeMin - 1), p.p_half, q >= c.halfMin && q < c.wholeMin], ['جملة', 'من ' + c.wholeMin + ' فأكثر', p.p_whole, q >= c.wholeMin]];
    return '<table class="tiers">' + rows.map(function (r) { return '<tr class="' + (q && r[3] ? 'on' : '') + '"><td>' + r[0] + '</td><td>' + r[1] + ' ' + esc(p.unit) + '</td><td>' + egp(r[2]) + '</td></tr>'; }).join('') + '</table>';
  }

  // ---------- المتجر ----------
  var WA = 'https://wa.me/201034497729', IG = 'https://www.instagram.com/bright_for_threads__yarns', FB = 'https://www.facebook.com/share/19xHuZcGUj/';
  var SI = {
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-2.9.9.9-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.700 6.700 0 0 1-3.300-2.900c-.2-.4.2-.4.700-1.300.1-.2 0-.3 0-.4l-.8-1.800c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.200 5.200 5.200 0 0 0 1.100 2.800 11.900 11.900 0 0 0 4.600 4c1.700.7 2.400.8 3.200.7a2.700 2.700 0 0 0 1.800-1.300 2.200 2.200 0 0 0 .2-1.300c-.1-.1-.3-.2-.5-.3z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>',
    fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.500 21v-7.500h2.600l.4-3h-3V8.600c0-.9.3-1.500 1.600-1.500h1.500V4.400A20 20 0 0 0 14.400 4.300c-2.300 0-3.900 1.400-3.900 4v2.200H8v3h2.500V21z"/></svg>'
  };
  function socials() {
    return '<div class="soc"><a class="sw" target="_blank" rel="noopener" href="' + WA + '">' + SI.wa + '<span>واتساب <bdi dir="ltr">01034497729</bdi></span></a><a class="si" target="_blank" rel="noopener" href="' + IG + '">' + SI.ig + '<span>انستجرام</span></a><a class="si" target="_blank" rel="noopener" href="' + FB + '">' + SI.fb + '<span>فيسبوك</span></a></div>';
  }
  function cardCols(p) {
    if (!p.has_colors) return [];
    var cs = p.color_ids.map(color).filter(function (c) { return c && c.img; });
    if (cs.length < 2) return [];
    var st = Math.max(1, Math.floor(cs.length / 12)), out = [];
    for (var i = 0; i < cs.length && out.length < 12; i += st) out.push(cs[i]);
    return out;
  }
  function card(p) {
    var sp = [p.spec_weight, p.spec_length].filter(Boolean).join(' • '), cc = cardCols(p), rep = cc.length ? cc[Math.floor(cc.length / 2)] : null;
    return '<article class="card" tabindex="0" data-act="open" data-id="' + p.id + '"><div class="img' + (rep ? ' col' : '') + '" style="' + (rep ? bg(rep.img) : bg(p.images[0])) + '"' + (rep ? ' data-base="' + esc(rep.img) + '" data-cyc="' + cc.map(function (c) { return c.img; }).join(' ') + '"' : '') + ' role="img" aria-label="' + esc(p.name) + '">' + (p.has_colors ? '<span class="bd">' + avail(p) + ' لون</span>' : '') + '</div><div class="cb"><div class="cat">' + esc(p.category) + (p.has_colors ? ' — ' + avail(p) + ' لون' : '') + '</div><h3>' + esc(p.name) + '</h3><div class="sp">' + esc(sp) + '</div><div class="pr"><b>' + egp(p.p_retail) + '</b><span>/ ' + esc(p.unit) + '</span></div>' + ladder(p) + '<span class="cta">' + (p.has_colors ? 'اختر اللون والكمية' : 'اختر الكمية') + '</span></div></article>';
  }
  function shop() {
    var q = $('#q').value.trim().toLowerCase(), cats = [], count = {}, cimg = {};
    S.products.forEach(function (p) { if (!count[p.category]) { count[p.category] = 0; cats.push(p.category); cimg[p.category] = p.images[0]; } count[p.category]++; });
    var list = S.products.filter(function (p) {
      return (!S.cat || p.category === S.cat) && (!S.colorF || p.color_ids.indexOf(S.colorF) > -1) && (!q || (p.name + ' ' + p.name_en + ' ' + p.category).toLowerCase().indexOf(q) > -1);
    });
    var filtering = q || S.cat || S.colorF, h = '', c = S.cfg, cres = [];
    if (q && q.length >= 1) cres = S.colors.filter(function (k) { return k.code.toLowerCase().indexOf(q) > -1 || (k.name && k.name.toLowerCase().indexOf(q) > -1); });
    if (cres.length) cres.sort(function (x, y) { return (x.code.toLowerCase() === q ? 0 : x.code.toLowerCase().indexOf(q) === 0 ? 1 : 2) - (y.code.toLowerCase() === q ? 0 : y.code.toLowerCase().indexOf(q) === 0 ? 1 : 2); });
    if (!filtering) {
      var ims = cats.map(function (k) { return cimg[k]; }).filter(Boolean).slice(0, 3);
      h += '' +
        '<section class="trust"><div>' + ic('leaf') + '<p style="margin:0"><b>قطن مصري 100%</b><span>محرر لنعومة ولمعان</span></p></div><div>' + ic('drop') + '<p style="margin:0"><b>ألوان ثابتة</b><span>صبغات أوروبية عالية الجودة</span></p></div></section>';
    }
    if (S.colors.length && S.colors.length < 80) {
      var cn = S.colorF && color(S.colorF);
      h += '<section id="colors"><div class="sec"><h2>تسوّق بحسب اللون</h2><span class="mut">' + (cn ? '' : 'اختر لوناً لتعرف أي المنتجات متوفرة به') + '</span>' + (cn ? '<span class="fchip">' + esc(cl(cn)) + '<button data-act="clear" aria-label="إلغاء فلتر اللون">إلغاء</button></span>' : '') + '</div><div class="spools">' +
        S.colors.map(function (k) { return '<button class="spool' + (S.colorF === k.id ? ' on' : '') + '" style="--c:' + esc(k.hex) + '" data-act="cfilter" data-id="' + k.id + '" title="' + esc(cl(k)) + '" aria-label="' + esc(cl(k)) + '"></button>'; }).join('') + '</div></section>';
    }
    if (cres.length) {
      h += '<section id="cres"><div class="sec"><h2>نتائج الألوان</h2><span class="mut">' + cres.length + ' لون' + (cres.length > 48 ? ' (أول 48)' : '') + '</span></div><div class="cgrid">' +
        cres.slice(0, 48).map(function (k) {
          var ps = S.products.filter(function (p) { return p.color_ids.indexOf(k.id) > -1; }).slice(0, 4);
          return '<div class="ct"><button class="cimg" data-act="zc" data-id="' + k.id + '" style="' + bg(k.img || k.t) + '" aria-label="' + esc(cl(k)) + '"></button><b>' + esc(k.code) + '</b>' +
            ps.map(function (p) { return '<button class="g sm" data-act="open" data-id="' + p.id + '">' + esc(p.name) + '</button>'; }).join('') + '</div>';
        }).join('') + '</div></section>';
    }
    h += '<section id="products"><div class="sec"><h2>المنتجات</h2><span class="mut">' + list.length + ' منتج</span></div><div class="tiles">' +
      '<button class="tile' + (!S.cat ? ' on' : '') + '" data-act="tile" data-v=""><b>الكل</b></button>' + cats.map(function (k) { return '<button class="tile' + (S.cat === k ? ' on' : '') + '" data-act="tile" data-v="' + esc(k) + '"><i style="' + bg(cimg[k]) + '"></i><span>' + esc(k) + '<small>' + count[k] + ' منتج</small></span></button>'; }).join('') + '</div><div class="grid" style="margin-top:14px">' +
      (list.length ? list.map(card).join('') : cres.length ? '' : '<div class="panel" style="grid-column:1/-1;text-align:center"><h3>لا توجد منتجات مطابقة</h3><p class="mut">جرّب كلمة بحث أخرى، أو امسح الفلاتر لعرض كل المنتجات.</p><button data-act="clear">مسح الفلاتر</button></div>') + '</div></section>';
    app.innerHTML = h;
  }
  var M = null, cyc = null;
  function cycStop() { if (!cyc) return; clearInterval(cyc.t); cyc.el.style.backgroundImage = "url('" + cyc.el.dataset.base + "')"; cyc = null; }
  function cycStart(card) {
    var el = card.querySelector('.img[data-cyc]'); if (!el || (cyc && cyc.el === el)) return; cycStop();
    var l = el.dataset.cyc.split(' '), i = 0; l.forEach(function (u) { new Image().src = u; });
    function tick() { i = (i + 1) % l.length; el.style.backgroundImage = "url('" + l[i] + "')"; }
    tick(); cyc = { el: el, t: setInterval(tick, 650) };
  }
  document.addEventListener('mouseover', function (e) { var c = e.target.closest && e.target.closest('.card'); if (c) cycStart(c); else cycStop(); });
  document.addEventListener('mouseleave', cycStop);
  document.addEventListener('touchstart', function (e) { var c = e.target.closest && e.target.closest('.card'); if (c) cycStart(c); }, { passive: true });
  ['touchend', 'touchcancel', 'scroll'].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(cycStop, ev === 'touchend' ? 1200 : 0); }, { passive: true }); });
  function openProduct(id) {
    var p = prod(id); if (!p) return; M = { p: p, sel: {}, q: '' };
    Object.keys(S.cart).forEach(function (k) { var a = k.split(':'); if (Number(a[0]) === p.id) M.sel[a[1]] = S.cart[k]; });
    var el = $('#modal'); el.classList.remove('out'); el.hidden = false; document.documentElement.classList.add('lock');
    if (!(history.state && history.state.sheet)) history.pushState({ sheet: 1 }, '');
    var specs = SPECS.filter(function (s) { return p[s[0]]; }).map(function (s) { return '<tr><td>' + s[1] + '</td><td>' + esc(p[s[0]]) + '</td></tr>'; }).join('');
    el.innerHTML = '<div class="sheet"><div class="sh-head"><div><div class="mut">' + esc(p.category) + '</div><h2 style="margin:0">' + esc(p.name) + '</h2><div class="mut" dir="ltr" style="text-align:right">' + esc(p.name_en) + '</div></div><button class="g sm" data-act="close" aria-label="إغلاق">✕</button></div>' +
      '<div class="sh-body"><div><div class="img zoomable" id="gm" data-act="zoomimg" title="تكبير" style="' + bg(heroImg(p)) + ';border:1px solid var(--line);border-radius:12px"></div>' + (!p.has_colors && p.images.length > 1 ? '<div class="gal">' + p.images.map(function (u, i) { return '<div class="th' + (i ? '' : ' on') + '" data-act="gal" data-i="' + i + '" style="' + bg(u) + '"></div>'; }).join('') + '</div>' : '') + '</div>' +
      '<div><ul class="dl">' + String(p.description || '').split(/\n/).map(function (l) { return l.replace(/^\s*•\s*/, '').trim(); }).filter(Boolean).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul><div id="tt"></div>' + (specs ? '<table class="spec">' + specs + '</table>' : '') +
      (p.has_colors ? (p.color_ids.length ? '<label for="cq">اختر الألوان (اضغط على اللون لتكبير الصورة وإضافته)</label><input id="cq" placeholder="ابحث باسم اللون أو رقمه…"><div class="sw" id="sw" style="margin-top:8px"></div>' : '<p class="err">لا توجد ألوان متاحة لهذا المنتج حالياً.</p>') : '') + '</div></div><div id="ms"></div></div>';
    mColors(); mSel();
  }
  function mColors() {
    var sw = $('#sw'); if (!sw) return; var q = M.q.toLowerCase();
    var vis = S.colors.filter(function (c) { return M.p.color_ids.indexOf(c.id) > -1 && (!q || (c.name + ' ' + c.code).toLowerCase().indexOf(q) > -1); }); vis.sort(function (a, b) { return (a.oos ? 1 : 0) - (b.oos ? 1 : 0); }); M.vis = vis.filter(function (c) { return !c.oos; }).map(function (c) { return c.id; });
    sw.innerHTML = vis.map(function (c) {
      var n = M.sel[c.id] || 0; return '<div class="s' + (n ? ' on' : '') + (c.oos ? ' oos' : '') + '"' + (c.oos ? ' aria-disabled="true"' : ' data-act="pick" data-id="' + c.id + '"') + '>' + (c.t && !c.oos ? '<button type="button" class="zb" data-act="zoomc" data-id="' + c.id + '" aria-label="تكبير الصورة">⤢</button>' : '') + '<i' + (c.t ? '' : ' class="ph"') + ' style="' + esc(cbg(c)) + '">' + (c.t ? '' : esc(c.code)) + '</i><span class="cd">' + esc(c.code) + '</span>' + (c.oos ? '<span class="ox">غير متوفر</span>' : (n ? '<span class="mini"><button type="button" data-act="mdec" data-k="' + c.id + '" aria-label="إنقاص">−</button><b>' + n + '</b><button type="button" data-act="minc" data-k="' + c.id + '" aria-label="زيادة">+</button></span>' : (c.name ? '<span class="cn">' + esc(c.name) + '</span>' : ''))) + '</div>';
    }).join('') || '<span class="mut">لا توجد ألوان مطابقة.</span>';
  }
  function step(kind, key, n) { return '<span class="step"><button class="g sm" data-act="' + kind + 'dec" data-k="' + esc(key) + '" aria-label="إنقاص">−</button><input type="number" min="0" value="' + n + '" data-act="' + kind + 'set" data-k="' + esc(key) + '" aria-label="الكمية"><button class="g sm" data-act="' + kind + 'inc" data-k="' + esc(key) + '" aria-label="زيادة">+</button></span>'; }
  function mSel() {
    var p = M.p, keys = Object.keys(M.sel), q = keys.reduce(function (n, k) { return n + M.sel[k]; }, 0), lines;
    if (p.has_colors) lines = keys.map(function (k) { var c = color(k); return '<div class="it"><span><i class="dotc" style="' + esc(cbg(c)) + '"></i> ' + esc(cl(c)) + '</span>' + step('m', k, M.sel[k]) + '</div>'; }).join('');
    else lines = '<div class="it"><span>الكمية (' + esc(p.unit) + ')</span>' + step('m', '0', M.sel['0'] || 0) + '</div>';
    var u = unitPrice(p, q), n = nudge({ p: p, q: q });
    $('#tt').innerHTML = tiersTable(p, q);
    $('#ms').innerHTML = '<div style="padding:0 18px">' + lines + (n && q ? '<div class="nudge">' + esc(n) + '</div>' : '') + '</div><div class="sbar"><div class="tot" style="padding:0 0 8px"><span>' + q + ' ' + esc(p.unit) + ' × ' + egp(u) + '</span><span>' + egp(u * q) + '</span></div><button class="blk lg" data-act="addcart"' + (q ? '' : ' disabled') + '>' + (q ? 'أضف إلى السلة' : (p.has_colors ? 'اختر لوناً وكمية' : 'حدّد الكمية')) + '</button></div>';
  }
  function setSel(k, n) { n = Math.max(0, Math.min(100000, parseInt(n, 10) || 0)); var cp = M.p.has_colors ? capOf(M.p, color(k)) : null; if (cp != null && n > cp) { n = cp; toast('الكمية المطلوبة أكبر من المتاح لهذا اللون'); } if (n) M.sel[k] = n; else delete M.sel[k]; var hc = color(k); if (n && M.p.has_colors && hc && hc.img) { M.hero = hc.id; var g = $('#gm'); if (g) g.style.backgroundImage = "url('" + hc.img + "')"; } mSel(); mColors(); }

  // ---------- السلة والطلب (بدون حساب) ----------
  function coSummary() {
    var f = $('#co'); if (!f) return; var sub = cartTotal();
    $('#sum').innerHTML = '<div class="tot"><span>الإجمالي</span><span>' + egp(sub) + '</span></div><div class="mut"><span>المبلغ لا يشمل الشحن. تتواصل معك شركة الشحن لتحديده.</span></div>';
  }
  function tierName(g) { return g.q >= S.cfg.wholeMin ? 'سعر الجملة' : g.q >= S.cfg.halfMin ? 'سعر نصف الجملة' : 'سعر القطاعي'; }
  window.BRadd = function (pid, cid, q) {
    q = Math.max(1, Math.floor(Number(q) || 1)); var k = pid + ':' + cid, n = (S.cart[k] || 0) + q, cp = capOf(prod(pid), color(cid));
    if (cp != null && n > cp) { n = cp; toast('الكمية المطلوبة أكبر من المتاح لهذا اللون'); }
    S.cart[k] = n; saveCart(); var cb = $('#cnt'); if (cb) cb.classList.add('bump'); return n;
  };
  function capCart(k, n) { var a = k.split(':'), cp = capOf(prod(a[0]), color(a[1])); if (cp != null && n > cp) { toast('الكمية المطلوبة أكبر من المتاح لهذا اللون'); return cp; } return n; }
  function cartThumb(g) { if (g.p.has_colors) for (var i = 0; i < g.lines.length; i++) { var c = color(g.lines[i].cid); if (c && c.img) return c.img; } return g.p.images[0]; }
  function cart() {
    var fd = null, fe = $('#co'); if (fe) { fd = {}; ['name', 'phone', 'governorate', 'area', 'address', 'note', 'payment'].forEach(function (n) { var el = fe.elements[n]; if (!el) return; if (el.length && el[0] && el[0].type === 'radio') { for (var i = 0; i < el.length; i++) if (el[i].checked) fd[n] = el[i].value; } else fd[n] = el.value; }); } var sy = window.scrollY;
    var gs = groups();
    if (!gs.length) { app.innerHTML = '<div class="panel done"><h2>السلة فارغة</h2><p class="mut">أضف منتجات لتبدأ طلبك.</p><a class="btn" href="#/">تصفّح المنتجات</a></div>'; return; }
    var h = '<h2>إتمام الطلب</h2><div class="cols"><div><div class="panel" style="margin-top:0"><h3>المنتجات</h3>';
    gs.forEach(function (g) {
      var u = unitPrice(g.p, g.q), n = nudge(g);
      h += '<div class="line"><div class="th2" style="' + bg(cartThumb(g)) + '"></div><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(g.p.name) + '</b><b>' + egp(u * g.q) + '</b></div><div class="mut">' + g.q + ' ' + esc(g.p.unit) + ' × ' + egp(u) + ' (' + tierName(g) + ')</div>';
      g.lines.forEach(function (l) { var c = color(l.cid); h += '<div class="it"><span>' + (l.cid && c ? '<i class="dotc cdot" style="' + esc(cbg(c)) + '"></i> <b class="ccode">' + esc(cl(c)) + '</b>' : 'الكمية') + '</span><span class="lr">' + step('c', l.key, l.qty) + '<button type="button" class="rm" data-act="cdel" data-k="' + esc(l.key) + '" aria-label="حذف">✕</button></span></div>'; });
      h += (n ? '<div class="nudge">' + esc(n) + '</div>' : '') + '<button class="g sm" style="margin-top:8px" data-act="rmprod" data-id="' + g.p.id + '">إزالة المنتج</button></div></div>';
    });
    var hasW = S.cfg.wallet.number, hasI = S.cfg.instapay.number || S.cfg.instapay.handle || S.cfg.instapay.qr;
    h += '</div><form class="panel" id="co"><h3>بيانات التوصيل</h3><p class="mut" style="margin-top:-6px">لا تحتاج لإنشاء حساب. اكتب بياناتك وأكّد الطلب.</p>' +
      '<div class="row"><div><label for="f1">الاسم</label><input id="f1" name="name" required autocomplete="name" value="' + esc(S.user ? S.user.name : '') + '"></div><div><label for="f2">رقم الموبايل</label><input id="f2" name="phone" required inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx"></div></div>' +
      '<div class="row"><div><label for="f3">المحافظة</label><select id="f3" name="governorate" required><option value="">اختر المحافظة</option>' + S.cfg.zones.map(function (z) { return '<option value="' + esc(z.name) + '">' + esc(z.name) + '</option>'; }).join('') + '</select></div><div><label for="f4">المنطقة / الحي</label><input id="f4" name="area"></div></div>' +
      '<label for="f5">العنوان بالتفصيل</label><textarea id="f5" name="address" required placeholder="الشارع، رقم العقار، علامة مميزة"></textarea><label for="f6" style="margin-top:8px">ملاحظات (اختياري)</label><input id="f6" name="note">' +
      '<h3 style="margin-top:18px">طريقة الدفع</h3><div class="pay">' +
      (hasW ? '<label class="o"><input type="radio" name="payment" value="wallet" checked> فودافون كاش (تحوّل ثم تؤكد التحويل)</label>' : '') + (hasI ? '<label class="o"><input type="radio" name="payment" value="instapay"' + (hasW ? '' : ' checked') + '> إنستا باي (QR أو رقم)</label>' : '') + '</div></form></div>' +
      '<aside class="sticky"><div class="panel" style="margin-top:0"><h3>ملخص الطلب</h3><div class="sum" id="sum"></div><button class="blk lg" type="submit" form="co">تأكيد الطلب</button><p id="m"></p></div></aside></div>';
    app.innerHTML = h; coSummary(); prefill();
    if (fd) { var f2 = $('#co'); if (f2) { Object.keys(fd).forEach(function (n) { var el = f2.elements[n]; if (!el || fd[n] == null || fd[n] === '') return; if (el.length && el[0] && el[0].type === 'radio') { for (var i = 0; i < el.length; i++) el[i].checked = el[i].value === fd[n]; } else el.value = fd[n]; }); coSummary(); } window.scrollTo(0, sy); }
  }
  function payBox(o, token) {
    if (o.payment_method === 'cod') return '<p>الدفع عند الاستلام: <b>' + egp(o.total_cents) + '</b></p>';
    if (o.payment_status === 'paid') return '<p class="ok"><b>تم تأكيد الدفع.</b></p>';
    var w = S.cfg.wallet, i = S.cfg.instapay, h = '<div class="panel" style="background:var(--mist);border-style:dashed"><b>حوّل مبلغ ' + egp(o.total_cents) + ' ثم أرسل رقم العملية</b>';
    if (o.payment_method === 'wallet') h += '<p>رقم المحفظة: <span class="big">' + esc(w.number) + '</span> <button class="g sm" data-act="copy" data-v="' + esc(w.number) + '">نسخ</button><br><span class="mut">' + esc(w.name) + '</span></p>';
    else h += (i.qr ? '<p><img class="qr" alt="QR إنستا باي" src="' + esc(i.qr) + '"></p>' : '') + (i.number ? '<p>رقم إنستا باي: <span class="big">' + esc(i.number) + '</span> <button class="g sm" data-act="copy" data-v="' + esc(i.number) + '">نسخ</button></p>' : '') + (i.handle ? '<p>العنوان: <b>' + esc(i.handle) + '</b></p>' : '') + (w.name ? '<p class="mut">باسم: ' + esc(w.name) + '</p>' : '') + (i.link ? '<p><a class="btn" target="_blank" rel="noopener" href="' + esc(i.link) + '">الدفع عبر رابط إنستا باي</a></p>' : '');
    if (o.payment_status === 'review') h += '<p class="ok">استلمنا بيانات التحويل (' + esc(o.payment_ref) + ') وهي قيد المراجعة.</p>';
    return h + '<form data-proof="' + o.id + '" data-token="' + esc(token || '') + '" class="row"><input name="ref" placeholder="رقم العملية أو الرقم المحوَّل منه" required aria-label="رقم العملية"><button>تأكيد التحويل</button></form><p id="m' + o.id + '" class="mut"></p></div>';
  }
  function waLink(text) { return S.cfg.whatsapp ? '<a class="btn gr" target="_blank" rel="noopener" href="https://wa.me/' + esc(S.cfg.whatsapp) + '?text=' + encodeURIComponent(text) + '">' + ic('chat') + 'تواصل مع برايت على واتساب</a>' : ''; }
  var PMN = { wallet: 'فودافون كاش', instapay: 'إنستا باي' };
  function shortName(n) { return n; }
  function waOrderText(o) {
    var its = o.items || [], head = 'طلب رقم #' + o.id + (o.name ? ' - ' + o.name : '') + (o.phone ? '\nالهاتف: ' + o.phone : '') + '\n\nالطلب:\n';
    var st = o.payment_status === 'paid' ? '✅ تم الدفع (مؤكد)' : o.payment_status === 'review' ? '💳 تم التحويل' + (o.payment_ref ? ' (المرجع: ' + o.payment_ref + ')' : '') + ' - بانتظار تأكيدكم' : '❌ لم أدفع بعد';
    var tail = '\n\nالإجمالي: ' + egp(o.total_cents) + '\nالدفع: ' + (PMN[o.payment_method] || '') + '\nحالة الدفع: ' + st;
    var lines = its.map(function (i, k) { return (k + 1) + '- ' + shortName(i.name) + (i.color ? ' | ' + i.color : '') + ' × ' + i.qty; }), body = '';
    for (var k = 0; k < lines.length; k++) { if ((head + body + lines[k] + tail).length > 1500) { body += '... و' + (lines.length - k) + ' صنف آخر (التفاصيل في رسالة الطلب)\n'; break; } body += lines[k] + '\n'; }
    return head + body.replace(/\n$/, '') + tail;
  }
  function waOrderBtn(o, label) { S.oc = S.oc || {}; S.oc[o.id] = o; return S.cfg.whatsapp ? '<button type="button" class="btn gr" data-act="waord" data-id="' + o.id + '">' + ic('chat') + (label || 'أرسل طلبي على واتساب') + '</button>' : ''; }
  function done(r, f) {
    var o = { id: r.orderId, payment_method: r.payment, payment_status: 'pending', total_cents: r.total, items: r.items || [], name: f.name, phone: f.phone };
    app.innerHTML = '<div class="panel done"><div class="chk">' + ic('check') + '</div><h2>تم استلام طلبك</h2><p style="font-size:20px;margin:0 0 12px">رقم الطلب <b>#' + r.orderId + '</b></p><div class="sum"><div class="tot"><span>الإجمالي</span><span>' + egp(r.total) + '</span></div></div>' +
      '<p class="mut">سنتواصل معك على ' + esc(f.phone) + ' لتأكيد الشحن. احتفظ برقم الطلب لمتابعته من «طلباتي».</p><div style="text-align:right">' + payBox(o, r.token) + '</div>' +
      '<div class="row" style="justify-content:center">' + waOrderBtn(o) + '<a class="btn g" href="#/orders">متابعة طلباتي</a><a class="btn g" href="#/">متابعة التسوق</a></div></div>';
  }
  function login(reg) {
    app.innerHTML = '<form class="panel auth" id="au" data-reg="' + (reg ? 1 : 0) + '"><h2>' + (reg ? 'إنشاء حساب' : 'تسجيل الدخول') + '</h2><p class="mut">الحساب اختياري، ويمكنك الطلب كضيف.</p>' + (reg ? '<label for="a1">الاسم</label><input id="a1" name="name" required><br><br>' : '') + '<label for="a2">' + (reg ? 'البريد الإلكتروني' : 'البريد أو اسم المستخدم') + '</label><input id="a2" name="email" ' + (reg ? 'type="email"' : 'type="text" autocapitalize="none" dir="ltr"') + ' required><br><br><label for="a3">كلمة المرور</label><input id="a3" name="password" type="password" required minlength="8" placeholder="8 أحرف على الأقل"><p id="m"></p><button class="blk lg">' + (reg ? 'إنشاء الحساب' : 'دخول') + '</button><p style="text-align:center"><a href="#/' + (reg ? 'login' : 'register') + '">' + (reg ? 'لدي حساب بالفعل' : 'إنشاء حساب جديد') + '</a></p></form>';
  }
  function track(o) {
    if (o.status === 'cancelled') return '<span class="pill p-bad">ملغي</span>';
    var order = ['new', 'processing', 'shipped', 'delivered'], i = order.indexOf(o.status);
    return '<div class="track">' + order.map(function (s, k) { return '<div class="' + (k <= i ? 'd' : '') + '">' + ST[s] + '</div>'; }).join('') + '</div>';
  }
  function orders() {
    Promise.all([S.user ? api('/orders') : [], S.my.length ? api('/orders/lookup', { method: 'POST', body: { orders: S.my } }) : []]).then(function (r) {
      var own = {}; r[0].forEach(function (o) { own[o.id] = 1; });
      var seen = {}, list = r[0].concat(r[1], S.found || []).filter(function (o) { return seen[o.id] ? false : (seen[o.id] = 1); }).sort(function (a, b) { return b.id - a.id; });
      var tok = {}; S.my.forEach(function (m) { tok[m.id] = m.token; });
      var pc = { paid: 'p-ok', review: 'p-gold', pending: 'p-new' };
      app.innerHTML = '<h2>طلباتي</h2><form class="panel" id="lk" style="margin-top:0"><b>تتبّع طلب برقمه</b><div class="row"><input name="id" type="number" placeholder="رقم الطلب" required aria-label="رقم الطلب"><input name="phone" placeholder="رقم الموبايل المسجل في الطلب" required aria-label="رقم الموبايل"><button>بحث</button></div><p id="m" class="err"></p></form>' +
        (list.length ? list.map(function (o) {
          return '<div class="panel"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>طلب #' + o.id + '</b><span><span class="pill ' + pc[o.payment_status] + '">' + PS[o.payment_status] + '</span> <span class="mut">' + PM[o.payment_method] + '</span></span></div><div class="mut">' + esc(o.created_at) + ' — ' + esc(o.governorate) + '</div>' + track(o) +
            o.items.map(function (i) { return '<div class="it"><span>' + esc(i.name) + (i.color ? ' — ' + esc(i.color) : '') + '</span><span>' + i.qty + ' × ' + egp(i.price_cents) + '</span></div>'; }).join('') +
            '<div class="tot"><span>الإجمالي</span><span>' + egp(o.total_cents) + '</span></div>' + (o.status === 'cancelled' ? '' : (tok[o.id] || own[o.id] ? payBox(o, tok[o.id]) : (o.payment_method === 'cod' ? payBox(o) : '<p class="mut">لتأكيد التحويل تواصل معنا على واتساب.</p>'))) + '<div>' + waOrderBtn(o, 'أرسل تفاصيل الطلب على واتساب') + '</div></div>';
        }).join('') : '<div class="panel">لا توجد طلبات على هذا الجهاز أو الحساب بعد.</div>');
    });
  }

  // ---------- Admin ----------
  var TABS = { home: 'نظرة عامة', products: 'المنتجات', colors: 'الألوان', orders: 'الطلبات', reports: 'التقارير', audit: 'سجل التعديلات', settings: 'الإعدادات', users: 'الحسابات' };
  var PERM_L = { orders: 'الطلبات (عرض وتغيير الحالة والدفع)', orders_delete: 'حذف الطلبات الملغاة', products: 'المنتجات والأسعار', colors: 'الألوان', reports: 'التقارير', audit: 'سجل التعديلات', settings: 'الإعدادات والنسخ الاحتياطي' };
  function can(p) { return !!S.user && (S.user.role === 'admin' || (S.user.perms || []).indexOf(p) > -1); }
  function tabOk(k) { return k === 'home' || (k === 'users' ? S.user && S.user.role === 'admin' : can(k)); }
  var TAB_IC = { users: 'user', home: 'grid', products: 'box', colors: 'palette', orders: 'list', reports: 'chart', audit: 'clock', settings: 'gear' };
  function side() { return Object.keys(TABS).filter(tabOk).map(function (k) { return '<button class="sl' + (S.A.tab === k ? ' on' : '') + '" data-act="tab" data-v="' + k + '">' + ic(TAB_IC[k]) + '<span>' + TABS[k] + '</span></button>'; }).join(''); }
  function adminView() {
    if (!S.user || (S.user.role !== 'admin' && S.user.role !== 'staff')) { location.hash = '#/'; return; }
    if (!tabOk(S.A.tab)) S.A.tab = 'home';
    var body = $('#abody');
    if (!body) { app.innerHTML = '<div class="adm"><aside class="side" id="side">' + side() + '</aside><section id="abody"></section></div>'; body = $('#abody'); } else $('#side').innerHTML = side();
    ({ home: aHome, products: aProducts, colors: aColors, orders: aOrders, reports: aReports, audit: aAudit, settings: aSettings, users: aUsers }[S.A.tab])(body);
  }
  function aHome(b) {
    api('/admin/stats').then(function (s) {
      b.innerHTML = '<div class="kpi"><div>' + ic('money') + 'مبيعات اليوم<b>' + egp(s.today) + '</b></div><div>' + ic('chart') + 'مبيعات الشهر<b>' + egp(s.month) + '</b></div><div>' + ic('bell') + 'طلبات جديدة<b>' + s.newOrders + '</b></div><div>' + ic('clock') + 'تحويلات للمراجعة<b>' + s.review + '</b></div></div>' +
        '<div class="panel"><h3>مخزون منخفض</h3>' + (s.low.length ? s.low.map(function (p) { return '<div class="it"><span>' + ic('alert') + ' ' + esc(p.name) + '</span><b>' + p.stock + '</b></div>'; }).join('') : '<span class="mut">لا يوجد منتج منخفض المخزون.</span>') + '</div>';
    });
  }
  function f(n, l, t, v, x) { return '<div><label>' + l + '</label><input name="' + n + '" type="' + (t || 'text') + '" ' + (x || '') + ' value="' + esc(v == null ? '' : v) + '"></div>'; }
  function renderPC() {
    var g = $('#pcg'); if (!g) return;
    g.innerHTML = S.colors.map(function (c) { var on = S.pc[c.id]; return '<div class="s' + (on ? ' on' : '') + '" data-act="pcol" data-id="' + c.id + '">' + (on ? '<em>✓</em>' : '') + '<i style="' + esc(cbg(c)) + '"></i>' + esc(c.code) + '<br>' + esc(c.name) + '</div>'; }).join('');
    $('#pcn').textContent = Object.keys(S.pc).filter(function (k) { return S.pc[k]; }).length + ' / ' + S.colors.length;
  }
  function aProducts(b) {
    Promise.all([api('/admin/products'), api('/colors')]).then(function (r) {
      S.products = r[0]; S.colors = r[1]; var e = S.edit && prod(S.edit) || {};
      if (S.edit && !S.pcInit) { S.pc = {}; (e.color_ids || []).forEach(function (c) { S.pc[c] = true; }); S.pcInit = true; }
      var imgs = (e.images || []).map(function (u) { var m = /^\/api\/img\/(\d+)$/.exec(u); return '<div><div class="th2" style="width:70px;height:70px;' + bg(u) + '"></div>' + (m ? '<button class="g sm" data-act="cover" data-id="' + m[1] + '">رئيسية</button><button class="g sm" data-act="delimg" data-id="' + m[1] + '">حذف</button>' : '<span class="mut">كتالوج</span>') + '</div>'; }).join('');
      b.innerHTML = '<form class="panel" id="pf"><h3>' + (e.id ? 'تعديل: ' + esc(e.name) : 'إضافة منتج') + '</h3><div class="row">' + f('name', 'الاسم', '', e.name, 'required') + f('name_en', 'الاسم بالإنجليزية', '', e.name_en) + f('category', 'القسم', '', e.category, 'required') + f('unit', 'الوحدة (علبة/كيلو/شلة)', '', e.unit) + '</div><div class="row">' +
        f('p_retail', 'سعر القطاعي ج.م', 'number', e.p_retail ? e.p_retail / 100 : '', 'required step="0.01" min="0.01"') + f('p_half', 'نصف جملة', 'number', e.p_half ? e.p_half / 100 : '', 'step="0.01" min="0.01"') + f('p_whole', 'جملة', 'number', e.p_whole ? e.p_whole / 100 : '', 'step="0.01" min="0.01"') + f('stock', 'المخزون (فارغ = غير محدود)', 'number', e.stock, 'min="0"') + '</div>' +
        '<div class="row">' + f('description', 'وصف قصير', '', e.description) + f('sort', 'الترتيب', 'number', e.sort || 0) + '</div><h4>المواصفات</h4><div class="row">' + SPECS.map(function (s) { return f(s[0], s[1], '', e[s[0]]); }).join('') + '</div>' +
        '<label><input type="checkbox" name="has_colors" style="width:auto" ' + (e.has_colors ? 'checked' : '') + '> للمنتج ألوان (يختار العميل من الألوان المحددة أدناه فقط)</label>' +
        '<div id="pcw" ' + (e.has_colors ? '' : 'hidden') + '><div class="row" style="align-items:center"><b>الألوان المتاحة: <span id="pcn"></span></b><button type="button" class="g sm" data-act="pcall">تحديد الكل</button><button type="button" class="g sm" data-act="pcnone">إلغاء الكل</button></div><div class="sw" id="pcg" style="max-height:220px"></div></div>' +
        (e.id ? '<h4>الصور</h4><div class="imgs">' + imgs + '</div><label>إضافة صورة (حتى 8)</label><input type="file" accept="image/*" data-act="imgadd" data-id="' + e.id + '">' : '<p class="mut">احفظ المنتج أولاً ثم أضف الصور.</p>') +
        '<p id="m"></p><button>حفظ</button> ' + (e.id ? '<button type="button" class="g" data-act="canceledit">إلغاء</button>' : '') + '</form>' +
        '<div class="panel"><h3>تعديل الأسعار بنسبة</h3><div class="row"><input id="pct" type="number" step="0.5" placeholder="مثال: 10 للزيادة أو -5 للتخفيض"><button data-act="bump">تطبيق على كل المنتجات</button></div><p class="mut">تُقرَّب الأسعار لأقرب جنيه وتُسجَّل في سجل التعديلات.</p></div>' +
        '<div class="panel scroll"><h3>المنتجات (عدّل السعر والمخزون مباشرة)</h3><table><tr><th></th><th>المنتج</th><th>قطاعي</th><th>نصف جملة</th><th>جملة</th><th>مخزون</th><th></th></tr>' + r[0].map(function (p) {
          var pi = function (k) { return '<td><input class="price-in" type="number" step="0.01" min="0.01" data-price="' + p.id + '" data-k="' + k + '" value="' + p[k] / 100 + '"></td>'; };
          return '<tr><td><div class="th2" style="' + bg(p.images[0]) + '"></div></td><td>' + esc(p.name) + (p.hidden ? ' <span class="tag">متوقف</span>' : '') + '</td>' + pi('p_retail') + pi('p_half') + pi('p_whole') + '<td><input class="price-in" type="number" min="0" placeholder="∞" data-stock="' + p.id + '" value="' + (p.stock == null ? '' : p.stock) + '"></td><td><button class="g sm" data-act="edit" data-id="' + p.id + '">تعديل</button> <button class="g sm" data-act="hide" data-id="' + p.id + '" data-v="' + (p.hidden ? 0 : 1) + '">' + (p.hidden ? 'تفعيل' : 'إيقاف') + '</button> <button class="g sm" data-act="del" data-id="' + p.id + '">حذف</button></td></tr>';
        }).join('') + '</table></div>';
      renderPC();
    });
  }
  function aColors(b) {
    api('/colors').then(function (cs) {
      S.colors = cs;
      b.innerHTML = '<form class="panel" id="cf"><h3>استيراد / تحديث الألوان</h3><p class="mut">سطر لكل لون: <b>الكود , الاسم , #لون</b> — مثال: 205, أزرق ملكي, #1f3a93. الكود الموجود يتم تحديثه.</p><textarea name="text" style="min-height:140px;direction:ltr" placeholder="205,أزرق ملكي,#1f3a93"></textarea><label><input type="checkbox" name="addToAll" style="width:auto" checked> إضافة الألوان الجديدة لكل المنتجات ذات الألوان (يمكن تخصيصها لاحقاً لكل منتج)</label><p id="m"></p><button>استيراد</button></form>' +
        '<div class="panel"><h3>كل الألوان (' + cs.length + ')</h3><div class="sw" style="max-height:none">' + cs.map(function (c) { return '<div class="s"><i style="' + esc(cbg(c)) + '"></i>' + esc(c.code) + '<br>' + esc(c.name) + '<br><button class="g sm" data-act="delcolor" data-id="' + c.id + '">حذف</button></div>'; }).join('') + '</div></div>';
    });
  }
  function sel(obj, cur, id, k) { return '<select data-ostat="' + id + '" data-k="' + k + '">' + Object.keys(obj).map(function (x) { return '<option value="' + x + '"' + (x === cur ? ' selected' : '') + '>' + obj[x] + '</option>'; }).join('') + '</select>'; }
  function opts(obj, cur, all) { return '<option value="">' + all + '</option>' + Object.keys(obj).map(function (x) { return '<option value="' + x + '"' + (x === cur ? ' selected' : '') + '>' + obj[x] + '</option>'; }).join(''); }
  function aOrders(b) {
    var F = S.A.f, zs = {}; S.cfg.zones.forEach(function (z) { zs[z.name] = z.name; });
    api('/admin/orders?' + qs(F)).then(function (os) {
      b.innerHTML = '<form class="panel" id="of"><div class="flt"><div><label>من</label><input type="date" name="from" value="' + esc(F.from || '') + '"></div><div><label>إلى</label><input type="date" name="to" value="' + esc(F.to || '') + '"></div><div><label>المحافظة</label><select name="governorate">' + opts(zs, F.governorate, 'الكل') + '</select></div><div><label>حالة الطلب</label><select name="status">' + opts(ST, F.status, 'الكل') + '</select></div><div><label>حالة الدفع</label><select name="payment_status">' + opts(PS, F.payment_status, 'الكل') + '</select></div><div><label>طريقة الدفع</label><select name="payment_method">' + opts(PM, F.payment_method, 'الكل') + '</select></div><div><label>بحث (اسم/هاتف/رقم)</label><input name="q" value="' + esc(F.q || '') + '"></div><button>تطبيق</button><button type="button" class="g" data-act="oreset">مسح</button><button type="button" data-act="oxlsx" style="background:#15803d">تصدير Excel</button></div></form>' +
        '<div class="panel scroll"><h3>الطلبات (' + os.length + ')</h3>' + (can('orders_delete') && os.some(function (o) { return o.status === 'cancelled'; }) ? '<button type="button" class="g sm" data-act="opurge">🗑 حذف كل الطلبات الملغاة</button>' : '') + '<table><tr><th>#</th><th>العميل</th><th>الأصناف</th><th>الإجمالي</th><th>الدفع</th><th>الحالة</th></tr>' + os.map(function (o) {
          return '<tr><td>' + o.id + '<br><span class="mut">' + esc(o.local_at) + '</span></td><td>' + esc(o.name) + '<br><span class="mut">' + esc(o.phone) + '<br>' + esc(o.governorate) + (o.area ? ' / ' + esc(o.area) : '') + '<br>' + esc(o.address) + (o.note ? '<br>📝 ' + esc(o.note) : '') + '</span></td><td>' + o.items.map(function (i) { return esc(i.name) + (i.color ? ' [' + esc(i.color) + ']' : '') + ' ×' + i.qty; }).join('<br>') + '</td><td>' + egp(o.total_cents) + '</td><td>' + PM[o.payment_method] + '<br>' + sel(PS, o.payment_status, o.id, 'payment_status') + (o.payment_ref ? '<br><span class="mut">مرجع: ' + esc(o.payment_ref) + '</span>' : '') + '</td><td>' + sel(ST, o.status, o.id, 'status') + (o.status === 'cancelled' && can('orders_delete') ? '<br><button type="button" class="g sm" data-act="odel" data-id="' + o.id + '">🗑 حذف الطلب</button>' : '') + '</td></tr>';
        }).join('') + '</table></div>';
    });
  }
  function aUsers(b) {
    api('/admin/users').then(function (us) {
      var pk = Object.keys(PERM_L);
      b.innerHTML = '<form class="panel" id="uf"><h3>إضافة حساب موظف</h3><div class="row"><div><label>الاسم</label><input name="name" required></div><div><label>اسم المستخدم (إنجليزي)</label><input name="email" required autocomplete="off" autocapitalize="none" dir="ltr" pattern="[A-Za-z0-9._@\-]{3,60}"></div><div><label>كلمة المرور (8 أحرف على الأقل)</label><input name="password" type="text" minlength="8" required autocomplete="off"></div></div>' +
        '<label>الصلاحيات</label><div class="perms">' + pk.map(function (k) { return '<label class="pm"><input type="checkbox" name="perm_' + k + '" style="width:auto"' + (k === 'orders' ? ' checked' : '') + '> ' + PERM_L[k] + '</label>'; }).join('') + '</div><button>إنشاء الحساب</button><p id="m" class="err"></p></form>' +
        us.map(function (u) {
          var adm = u.role === 'admin';
          return '<div class="panel ucard"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + esc(u.name) + (adm ? ' <span class="pill p-ok">مدير</span>' : '') + (u.active ? '' : ' <span class="pill p-bad">معطّل</span>') + '</b><span class="mut" dir="ltr">' + esc(u.email) + '</span></div>' +
            (adm ? '<p class="mut">المدير لديه كل الصلاحيات.</p>' : '<div class="perms">' + pk.map(function (k) { return '<label class="pm"><input type="checkbox" data-uperm="' + u.id + '" data-k="' + k + '" style="width:auto"' + (u.perms.indexOf(k) > -1 ? ' checked' : '') + '> ' + PERM_L[k] + '</label>'; }).join('') + '</div>' +
              '<div class="row"><button type="button" class="g sm" data-act="utoggle" data-id="' + u.id + '" data-v="' + (u.active ? 0 : 1) + '">' + (u.active ? 'تعطيل الحساب' : 'تفعيل الحساب') + '</button><button type="button" class="g sm" data-act="upass" data-id="' + u.id + '">تغيير كلمة المرور</button><button type="button" class="g sm" data-act="udel" data-id="' + u.id + '">حذف الحساب</button></div>') + '</div>';
        }).join('');
    }).catch(function (x) { b.innerHTML = '<div class="panel err">' + esc(x.message) + '</div>'; });
  }
  function aReports(b) {
    var R = S.A.rep, BY = { product: 'حسب المنتج', customer: 'حسب العميل', day: 'حسب اليوم', governorate: 'حسب المحافظة' };
    api('/admin/reports?' + qs(R)).then(function (d) {
      var tot = d.rows.reduce(function (n, r) { return n + r.tot; }, 0);
      b.innerHTML = '<form class="panel" id="rf"><div class="flt"><div><label>التقرير</label><select name="by">' + Object.keys(BY).map(function (k) { return '<option value="' + k + '"' + (k === R.by ? ' selected' : '') + '>' + BY[k] + '</option>'; }).join('') + '</select></div><div><label>من</label><input type="date" name="from" value="' + esc(R.from || '') + '"></div><div><label>إلى</label><input type="date" name="to" value="' + esc(R.to || '') + '"></div><button>عرض</button><button type="button" data-act="rxlsx" style="background:#15803d">تصدير Excel</button></div><p class="mut">الطلبات الملغاة غير محسوبة.</p></form>' +
        '<div class="panel scroll"><table><tr><th>' + d.heads[1][0] + '</th><th>' + (d.heads[1][1] || '') + '</th><th>' + d.heads[2][0] + '</th><th>' + (d.heads[2][1] || '') + '</th><th>الإجمالي</th></tr>' + d.rows.map(function (r) { return '<tr><td>' + esc(r.k1) + '</td><td>' + esc(r.k2) + '</td><td>' + r.c1 + '</td><td>' + (d.heads[2][1] ? (R.by === 'day' ? egp(r.c2) : r.c2) : '') + '</td><td><b>' + egp(r.tot) + '</b></td></tr>'; }).join('') + '<tr><td colspan="4"><b>المجموع</b></td><td><b>' + egp(tot) + '</b></td></tr></table></div>';
    });
  }
  function aAudit(b) {
    var AC = { price: '💲 سعر', stock: '📦 مخزون', status: '⏸ حالة', create: '➕ إضافة', delete: '🗑 حذف' };
    api('/admin/audit?q=' + encodeURIComponent(S.A.aq)).then(function (rows) {
      b.innerHTML = '<div class="panel"><input id="aq" placeholder="ابحث باسم المنتج أو التفاصيل…" value="' + esc(S.A.aq) + '"></div><div class="panel scroll"><table><tr><th>الوقت</th><th>بواسطة</th><th>النوع</th><th>المنتج</th><th>التفاصيل</th></tr>' + rows.map(function (r) { return '<tr><td>' + esc(r.at) + '</td><td>' + esc(r.who) + '</td><td>' + (AC[r.action] || esc(r.action)) + '</td><td>' + esc(r.product) + '</td><td>' + esc(r.detail) + '</td></tr>'; }).join('') + '</table></div>';
    });
  }
  function aSettings(b) {
    api('/admin/settings').then(function (s) {
      S.qr = s.instapay_qr; var g = function (n, l, t) { return f(n, l, t, s[n]); };
      b.innerHTML = '<form class="panel" id="sf"><h3>إعدادات المتجر</h3><div class="row">' + g('shop_name', 'اسم المتجر') + g('half_min', 'بداية نصف الجملة (وحدة)', 'number') + g('whole_min', 'بداية الجملة (وحدة)', 'number') + '</div><div class="row">' + g('whatsapp_number', 'واتساب برايت (دولي: 2010xxxxxxxx)') + '</div>' +
        '<h3>الدفع</h3><div class="row">' + g('wallet_number', 'رقم المحفظة الإلكترونية') + g('wallet_name', 'اسم صاحب المحفظة') + '</div><div class="row">' + g('instapay_number', 'رقم إنستا باي') + g('instapay_handle', 'عنوان إنستا باي (name@instapay)') + g('instapay_link', 'رابط دفع إنستا باي (ipn.eg)') + '</div><div class="row"><div><label>QR إنستا باي (صورة)</label><input type="file" accept="image/*" data-act="qrfile"></div><img id="qrp" class="qr" style="max-width:120px;' + (s.instapay_qr ? '' : 'display:none') + '" src="' + esc(s.instapay_qr) + '"></div>' +
        '<h3>إشعارات الطلبات على تيليجرام</h3><p class="mut">أنشئ بوتاً من @BotFather وخذ التوكن، ثم أرسل له رسالة وخذ معرّف المحادثة (Chat ID) من @userinfobot، أو أضف البوت لجروب واستخدم معرّفه.</p><div class="row">' + g('telegram_token', 'Bot Token') + g('telegram_chat', 'Chat ID') + '</div><p id="m"></p><button>حفظ الإعدادات</button> <button type="button" class="g" data-act="tgtest">إرسال رسالة اختبار</button></form>' +
        '<div class="panel"><h3>نسخة احتياطية</h3><p class="mut">حمّل نسخة من قاعدة البيانات (طلبات، منتجات، حسابات) واحتفظ بها بعيداً عن السيرفر.</p><button data-act="backup" class="g">تنزيل نسخة احتياطية</button></div>';
    });
  }

  var closing = 0;
  function closeModal(fromPop) {
    var el = $('#modal'); if (el.hidden || closing) return;
    if (!fromPop && history.state && history.state.sheet) { history.back(); return; }
    closing = 1; el.classList.add('out');
    setTimeout(function () { el.hidden = true; el.classList.remove('out'); closing = 0; document.documentElement.classList.remove('lock'); }, 230);
  }
  window.addEventListener('popstate', function () { if (!(history.state && history.state.sheet)) closeModal(true); });
  var SCR = {};
  function route() {
    var r = location.hash.replace('#/', '').split('?')[0];
    $('#modal').hidden = true; document.documentElement.classList.remove('lock'); closing = 0; app.className = r === 'admin' ? 'wide' : '';
    ({ '': shop, cart: cart, login: function () { login(false); }, register: function () { login(true); }, orders: orders, admin: adminView }[r] || shop)();
    window.scrollTo(0, SCR[r] || 0); cartbar();
  }
  function img(file, max, cb) {
    var r = new FileReader(); r.onload = function () { var i = new Image(); i.onload = function () {
      var k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = i.width * k; c.height = i.height * k;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height);
      var q = 0.85, d = c.toDataURL('image/jpeg', q); while (d.length > 380000 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); } cb(d); }; i.src = r.result; }; r.readAsDataURL(file);
  }
  function reAdmin() { if (S.A.tab === 'products') aProducts($('#abody')); }


  // ---------- Lightbox ----------
  var Z = { items: [], i: 0 };
  function lbEl() {
    var el = document.getElementById('lb');
    if (!el) {
      el = document.createElement('div'); el.id = 'lb'; el.className = 'lb'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
      el.innerHTML = '<button class="lbx" data-act="lbclose" aria-label="إغلاق">✕</button><button class="lbn lbp" data-act="lbprev" aria-label="السابق">‹</button><button class="lbn lbq" data-act="lbnext" aria-label="التالي">›</button><div class="lbs" id="lbs"><img id="lbimg" alt="" data-act="lbz"></div><div class="lbf" id="lbf"></div>';
      document.body.appendChild(el);
      var x0 = null; el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      el.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60 && !$('#lbs').classList.contains('z')) lbGo(dx < 0 ? 1 : -1); }, { passive: true });
    }
    return el;
  }
  function lbOpen(items, i) { Z.items = items; Z.i = i; lbEl().hidden = false; document.body.classList.add('noscroll'); lbShow(); var b = document.querySelector('#lb .lbx'); if (b) b.focus(); }
  function lbClose() { var el = document.getElementById('lb'); if (el) el.hidden = true; document.body.classList.remove('noscroll'); }
  function lbGo(d) { if (!Z.items.length) return; Z.i = (Z.i + d + Z.items.length) % Z.items.length; $('#lbs').classList.remove('z'); lbShow(); }
  function lbShow() {
    var it = Z.items[Z.i]; if (!it) return;
    var im = $('#lbimg'); if (im.getAttribute('src') !== it.src) im.src = it.src; im.alt = it.title || '';
    var multi = Z.items.length > 1; document.querySelectorAll('#lb .lbn').forEach(function (b) { b.hidden = !multi; });
    var h = '<div class="lbt"><b>' + esc(it.title || '') + '</b><span class="mut">' + (Z.i + 1) + ' / ' + Z.items.length + '</span></div>';
    if (it.id) { var n = (M.sel[it.id] || 0); h += '<div class="lba"><span class="step"><button class="g sm" data-act="lbdec" data-id="' + it.id + '" aria-label="إنقاص">−</button><b class="lbq">' + n + '</b><button class="sm" data-act="lbinc" data-id="' + it.id + '" aria-label="زيادة">+</button></span></div>'; }
    $('#lbf').innerHTML = h;
  }
  function zoomColor(id) {
    var ids = (M.vis && M.vis.indexOf(Number(id)) > -1) ? M.vis : [Number(id)];
    var items = ids.map(function (cid) { var c = color(cid); return { src: c && c.img || '', title: cl(c), id: cid }; }).filter(function (x) { return x.src; });
    var i = items.map(function (x) { return x.id; }).indexOf(Number(id));
    if (i < 0) { setSel(id, (M.sel[id] || 0) + 1); return; }
    lbOpen(items, i);
  }
  function zoomProduct() {
    if (M.p.has_colors) { var hc = heroId(M.p); if (hc) { zoomColor(hc); return; } }
    var items = M.p.images.map(function (u) { return { src: u, title: M.p.name }; }); if (!items.length) return;
    var cur = ($('#gm').style.backgroundImage || '').replace(/^url\(["']?|["']?\)$/g, ''), i = 0;
    items.forEach(function (x, k) { if (cur.indexOf(x.src) > -1 && x.src) i = k; });
    lbOpen(items, i);
  }
  document.addEventListener('keydown', function (e) {
    var el = document.getElementById('lb'); if (!el || el.hidden) return;
    if (e.key === 'Escape') { lbClose(); e.stopPropagation(); } else if (e.key === 'ArrowLeft') lbGo(document.documentElement.dir === 'rtl' ? 1 : -1); else if (e.key === 'ArrowRight') lbGo(document.documentElement.dir === 'rtl' ? -1 : 1);
  }, true);
  document.addEventListener('click', function (e) { if (e.target && e.target.id === 'lb') lbClose(); });
  // ---------- Theme / language ----------
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('theme', t); } catch (x) {} var m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#12141b' : '#faf8f5'; }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#theme')) setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    else if (e.target.closest('#lang')) { try { localStorage.setItem('lang', document.documentElement.lang === 'en' ? 'ar' : 'en'); } catch (x) {} location.reload(); }
  });
  // ---------- Events ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t || t.tagName === 'INPUT') return;
    var a = t.dataset.act, id = t.dataset.id, k = t.dataset.k;
    if (a === 'logout') logout();
    else if (a === 'tile') { S.cat = t.dataset.v; shop(); var pe = document.getElementById('products'); if (pe) pe.scrollIntoView(); }
    else if (a === 'cfilter') { S.colorF = S.colorF === Number(id) ? null : Number(id); shop(); var pe2 = document.getElementById('products'); if (pe2) pe2.scrollIntoView(); }
    else if (a === 'clear') { S.cat = ''; S.colorF = null; $('#q').value = ''; shop(); }
    else if (a === 'goto') { var ge = document.getElementById(t.dataset.v); if (ge) ge.scrollIntoView(); }
    else if (a === 'waord') { var wo = S.oc && S.oc[id]; if (wo) { if (S.refs && S.refs[id] && wo.payment_status === 'pending') { wo.payment_status = 'review'; wo.payment_ref = S.refs[id]; } window.open('https://wa.me/' + S.cfg.whatsapp + '?text=' + encodeURIComponent(waOrderText(wo)), '_blank'); } }
    else if (a === 'odel') { if (confirm('حذف الطلب #' + id + ' نهائياً؟')) api('/admin/orders/' + id, { method: 'DELETE' }).then(function () { toast('تم حذف الطلب'); aOrders($('#abody')); }).catch(function (x) { toast(x.message); }); }
    else if (a === 'opurge') { if (confirm('حذف كل الطلبات الملغاة نهائياً؟ لا يمكن التراجع.')) api('/admin/orders/purge-cancelled', { method: 'POST', body: {} }).then(function (r) { toast('تم حذف ' + r.deleted + ' طلب'); aOrders($('#abody')); }).catch(function (x) { toast(x.message); }); }
    else if (a === 'utoggle') api('/admin/users/' + id, { method: 'PATCH', body: { active: t.dataset.v === '1' } }).then(function () { aUsers($('#abody')); }).catch(function (x) { toast(x.message); });
    else if (a === 'upass') { var np = prompt('كلمة المرور الجديدة (8 أحرف على الأقل)'); if (np) api('/admin/users/' + id, { method: 'PATCH', body: { password: np } }).then(function () { toast('تم تغيير كلمة المرور'); }).catch(function (x) { toast(x.message); }); }
    else if (a === 'udel') { if (confirm('حذف هذا الحساب؟')) api('/admin/users/' + id, { method: 'DELETE' }).then(function () { toast('تم حذف الحساب'); aUsers($('#abody')); }).catch(function (x) { toast(x.message); }); }
    else if (a === 'cdel') { delete S.cart[k]; saveCart(); cart(); }
    else if (a === 'rmprod') { Object.keys(S.cart).forEach(function (key) { if (key.split(':')[0] === id) delete S.cart[key]; }); saveCart(); cart(); }
    else if (a === 'open') openProduct(id);
    else if (a === 'close') closeModal();
    else if (a === 'gal') { $('#gm').style.backgroundImage = "url('" + M.p.images[t.dataset.i] + "')"; document.querySelectorAll('.gal .th').forEach(function (x) { x.classList.toggle('on', x === t); }); }
    else if (a === 'pick') { if (!(M.sel[id] > 0)) setSel(id, 1); }
    else if (a === 'zoomc') zoomColor(id);
    else if (a === 'zc') { var zc = color(id); if (zc && zc.img) { M = M || { sel: {} }; lbOpen([{ src: zc.img, title: cl(zc) }], 0); } }
    else if (a === 'zoomimg') zoomProduct();
    else if (a === 'lbclose') lbClose();
    else if (a === 'lbprev') lbGo(-1);
    else if (a === 'lbnext') lbGo(1);
    else if (a === 'lbz') $('#lbs').classList.toggle('z');
    else if (a === 'lbinc') { setSel(id, (M.sel[id] || 0) + 1); lbShow(); }
    else if (a === 'lbdec') { setSel(id, (M.sel[id] || 0) - 1); lbShow(); }
    else if (a === 'minc') setSel(k, (M.sel[k] || 0) + 1);
    else if (a === 'mdec') setSel(k, (M.sel[k] || 0) - 1);
    else if (a === 'addcart') {
      Object.keys(S.cart).forEach(function (key) { if (Number(key.split(':')[0]) === M.p.id) delete S.cart[key]; });
      Object.keys(M.sel).forEach(function (c) { S.cart[M.p.id + ':' + c] = M.sel[c]; });
      saveCart(); closeModal(); toast('تمت الإضافة إلى السلة'); var cb = $('#cnt'); if (cb) cb.classList.add('bump');
    }
    else if (a === 'cinc' || a === 'cdec') { S.cart[k] = capCart(k, (S.cart[k] || 0) + (a === 'cinc' ? 1 : -1)); if (S.cart[k] <= 0) delete S.cart[k]; saveCart(); cart(); }
    else if (a === 'copy') { (navigator.clipboard ? navigator.clipboard.writeText(t.dataset.v) : Promise.reject()).then(function () { toast('تم النسخ'); }, function () { toast(t.dataset.v); }); }
    else if (a === 'tab') { S.A.tab = t.dataset.v; adminView(); }
    else if (a === 'edit') { S.edit = Number(id); S.pcInit = false; aProducts($('#abody')); window.scrollTo(0, 0); }
    else if (a === 'canceledit') { S.edit = null; S.pcInit = false; aProducts($('#abody')); }
    else if (a === 'hide') api('/admin/products/' + id + '/hidden', { method: 'PATCH', body: { hidden: t.dataset.v === '1' } }).then(function () { toast(t.dataset.v === '1' ? 'تم إيقاف المنتج مؤقتاً' : 'تم تفعيل المنتج'); reAdmin(); });
    else if (a === 'del' && confirm('حذف المنتج؟ (يمكنك بدلاً من ذلك إيقافه مؤقتاً)')) api('/admin/products/' + id, { method: 'DELETE' }).then(reAdmin);
    else if (a === 'delcolor') api('/admin/colors/' + id, { method: 'DELETE' }).then(function () { aColors($('#abody')); });
    else if (a === 'pcol') { S.pc[id] = !S.pc[id]; renderPC(); }
    else if (a === 'pcall') { S.colors.forEach(function (c) { S.pc[c.id] = true; }); renderPC(); }
    else if (a === 'pcnone') { S.pc = {}; renderPC(); }
    else if (a === 'cover') api('/admin/images/' + id + '/cover', { method: 'POST' }).then(reAdmin);
    else if (a === 'delimg' && confirm('حذف الصورة؟')) api('/admin/images/' + id, { method: 'DELETE' }).then(reAdmin);
    else if (a === 'bump') { var p = Number($('#pct').value); if (p && confirm('تغيير كل الأسعار بنسبة ' + p + '% ؟')) api('/admin/prices/bump', { method: 'POST', body: { percent: p } }).then(function () { toast('تم تعديل الأسعار'); reAdmin(); }).catch(function (x) { toast(x.message); }); }
    else if (a === 'oreset') { S.A.f = {}; aOrders($('#abody')); }
    else if (a === 'oxlsx') download('/admin/orders?' + qs(Object.assign({}, S.A.f, { format: 'xlsx' })), 'orders.xlsx');
    else if (a === 'rxlsx') download('/admin/reports?' + qs(Object.assign({}, S.A.rep, { format: 'xlsx' })), 'report.xlsx');
    else if (a === 'backup') download('/admin/backup', 'bright-store-backup.db');
    else if (a === 'tgtest') api('/admin/telegram/test', { method: 'POST' }).then(function () { toast('تم الإرسال ✓'); }).catch(function (x) { toast(x.message); });
    else if (a === 'zapply') { var v = $('#zall').value; if (v !== '') document.querySelectorAll('[data-zone]').forEach(function (i) { i.value = v; }); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, a = t.dataset.act;
    if (t.name === 'governorate' && t.closest('#co')) coSummary();
    else if (a === 'mset') setSel(t.dataset.k, t.value);
    else if (a === 'cset') { var n = capCart(t.dataset.k, parseInt(t.value, 10) || 0); if (n > 0) S.cart[t.dataset.k] = n; else delete S.cart[t.dataset.k]; saveCart(); cart(); }
    else if (a === 'imgadd' && t.files[0]) img(t.files[0], 900, function (d) { api('/admin/products/' + t.dataset.id + '/images', { method: 'POST', body: { data: d } }).then(function () { toast('تمت إضافة الصورة ✓'); reAdmin(); }).catch(function (x) { toast(x.message); }); });
    else if (a === 'qrfile' && t.files[0]) img(t.files[0], 500, function (d) { S.qr = d; $('#qrp').src = d; $('#qrp').style.display = 'block'; });
    else if (t.dataset.uperm) { var uid = t.dataset.uperm, ps = Array.prototype.filter.call(document.querySelectorAll('[data-uperm="' + uid + '"]'), function (c) { return c.checked; }).map(function (c) { return c.dataset.k; }); api('/admin/users/' + uid, { method: 'PATCH', body: { perms: ps } }).then(function () { toast('تم حفظ الصلاحيات ✓'); }).catch(function (x) { toast(x.message); }); }
    else if (t.name === 'has_colors') $('#pcw').hidden = !t.checked;
    else if (t.dataset.price) { var row = t.closest('tr'), body = {}; row.querySelectorAll('[data-price]').forEach(function (i) { body[i.dataset.k] = i.value; });
      api('/admin/products/' + t.dataset.price + '/prices', { method: 'PATCH', body: body }).then(function () { toast('تم حفظ السعر ✓'); }).catch(function (x) { toast(x.message); }); }
    else if (t.dataset.stock) api('/admin/products/' + t.dataset.stock + '/stock', { method: 'PATCH', body: { stock: t.value } }).then(function () { toast('تم حفظ المخزون ✓'); }).catch(function (x) { toast(x.message); });
    else if (t.dataset.ostat) { var b = {}; b[t.dataset.k] = t.value; api('/admin/orders/' + t.dataset.ostat, { method: 'PATCH', body: b }).then(function () { toast('تم التحديث ✓'); }).catch(function (x) { toast(x.message); }); }
  });
  var aqT;
  document.addEventListener('input', function (e) {
    if (e.target.id === 'cq') { M.q = e.target.value; mColors(); }
    else if (e.target.id === 'aq') { S.A.aq = e.target.value; clearTimeout(aqT); aqT = setTimeout(function () { aAudit($('#abody')); $('#aq') && $('#aq').focus(); }, 400); }
  });
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    var fm = e.target, d = Object.fromEntries(new FormData(fm)), btn = e.submitter || fm.querySelector('button'); if (btn) btn.disabled = true;
    var again = function () { if (btn) btn.disabled = false; }, bad = function (x) { msg(x.message); again(); };
    if (fm.id === 'au') api('/auth/' + (fm.dataset.reg === '1' ? 'register' : 'login'), { method: 'POST', body: d }).then(function (r) {
      S.token = r.token; S.user = r.user; localStorage.setItem('token', r.token); nav(); location.hash = '#/'; }).catch(bad);
    else if (fm.id === 'co') api('/orders', { method: 'POST', body: Object.assign({}, d, { items: Object.keys(S.cart).map(function (k) { var a = k.split(':'); return { id: Number(a[0]), color: Number(a[1]), qty: S.cart[k] }; }) }) }).then(function (r) {
      try { localStorage.setItem('cust', JSON.stringify({ name: d.name, phone: d.phone, governorate: d.governorate, area: d.area, address: d.address })); } catch (e) { } S.my.unshift({ id: r.orderId, token: r.token }); S.my = S.my.slice(0, 20); localStorage.setItem('myorders', JSON.stringify(S.my));
      S.cart = {}; saveCart(); done(r, d); window.scrollTo(0, 0); }).catch(bad);
    else if (fm.id === 'lk') api('/orders/lookup', { method: 'POST', body: { id: d.id, phone: d.phone } }).then(function (r) {
      if (!r.length) { msg('لا يوجد طلب بهذه البيانات'); again(); return; }
      S.found = r; orders(); }).catch(bad);
    else if (fm.dataset.proof) api('/orders/' + fm.dataset.proof + '/proof', { method: 'POST', body: { ref: d.ref, token: fm.dataset.token } }).then(function () { S.refs = S.refs || {}; S.refs[fm.dataset.proof] = d.ref; toast('تم إرسال بيانات التحويل ✓'); route(); }).catch(function (x) { var m = $('#m' + fm.dataset.proof); if (m) { m.className = 'err'; m.textContent = x.message; } again(); });
    else if (fm.id === 'pf') { var cur = prod(S.edit) || {}; d.has_colors = fm.has_colors.checked; d.image_url = cur.image_url || '';
      api(S.edit ? '/admin/products/' + S.edit : '/admin/products', { method: S.edit ? 'PUT' : 'POST', body: d }).then(function (r) {
        var id = S.edit || r.id; return api('/admin/products/' + id + '/colors', { method: 'PUT', body: { ids: d.has_colors ? Object.keys(S.pc).filter(function (c) { return S.pc[c]; }) : [] } }).then(function () { return id; });
      }).then(function (id) { S.edit = id; S.pcInit = false; toast('تم الحفظ ✓'); aProducts($('#abody')); }).catch(bad); }
    else if (fm.id === 'cf') api('/admin/colors/bulk', { method: 'POST', body: { text: d.text, addToAll: !!d.addToAll } }).then(function (r) { toast('تم استيراد ' + r.imported + ' لون'); aColors($('#abody')); }).catch(bad);
    else if (fm.id === 'sf') { d.instapay_qr = S.qr || ''; api('/admin/settings', { method: 'PUT', body: d }).then(function () { toast('تم الحفظ ✓'); return api('/config').then(function (c) { S.cfg = c; }); }).then(again).catch(bad); }
    else if (fm.id === 'zf') api('/admin/zones', { method: 'PUT', body: { zones: Array.prototype.map.call(fm.querySelectorAll('[data-zone]'), function (i) { return { name: i.dataset.zone, fee: i.value, active: fm.querySelector('[data-zon="' + i.dataset.zone + '"]').checked }; }) } }).then(function () { toast('تم حفظ الشحن ✓'); return api('/config').then(function (c) { S.cfg = c; }); }).then(again).catch(function (x) { toast(x.message); again(); });
    else if (fm.id === 'uf') api('/admin/users', { method: 'POST', body: { name: d.name, email: d.email, password: d.password, perms: Object.keys(PERM_L).filter(function (k) { return d['perm_' + k]; }) } }).then(function () { toast('تم إنشاء الحساب ✓'); aUsers($('#abody')); }).catch(bad);
    else if (fm.id === 'of') { S.A.f = d; aOrders($('#abody')); }
    else if (fm.id === 'rf') { S.A.rep = d; aReports($('#abody')); }
  });
  $('#q').addEventListener('input', function () { if (location.hash && location.hash !== '#/') location.hash = '#/'; else shop(); });
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.act === 'open') openProduct(e.target.dataset.id); if (e.key === 'Escape') closeModal(); });
  window.addEventListener('hashchange', function () { tabOn(); app.classList.remove('pg'); void app.offsetWidth; app.classList.add('pg'); });
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', function () { SCR[location.hash.replace('#/', '').split('?')[0]] = window.scrollY; }, { passive: true });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () { });
  var dip = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); dip = e; if (localStorage.getItem('noinstall')) return;
    var b = document.createElement('div'); b.className = 'inst';
    b.innerHTML = '<span>ثبّت تطبيق برايت على موبايلك</span><button type="button" id="instgo">تثبيت</button><button type="button" class="g" id="instno" aria-label="إغلاق">✕</button>';
    document.body.appendChild(b);
    $('#instgo').onclick = function () { dip.prompt(); b.remove(); };
    $('#instno').onclick = function () { localStorage.setItem('noinstall', '1'); b.remove(); };
  });

  function footer() {
    var c = S.cfg; $('#foot').innerHTML = '<div class="ft"><div><img class="flogo" src="/img/logo.png" alt="Bright" width="70" height="79"><b style="color:#fff;font-size:17px">' + esc(c.shop) + '</b><p>مصنع مصري لخيوط القطن والبوليستر: كوتن بارليه، كروشيه، تطريز، مكرمية وخيوط حياكة. نبيع بالقطعة وبالجملة.</p></div><div><h4>تواصل معنا</h4>' + '<p>العنوان: المنطقة الصناعية الثالثة، السادس من أكتوبر، الجيزة، مصر</p>' + (c.whatsapp ? '<p>اتصال وواتساب: <bdi dir="ltr">0' + esc(String(c.whatsapp).slice(2)) + '</bdi></p><p class="fsoc"><a href="tel:+' + esc(c.whatsapp) + '">' + ic('phone') + '<span>اتصال</span></a><a target="_blank" rel="noopener" href="https://wa.me/' + esc(c.whatsapp) + '">' + ic('chat') + '<span>واتساب</span></a></p>' : '') + '<p class="fsoc"><a target="_blank" rel="noopener" href="' + IG + '">' + SI.ig + '<span>انستجرام</span></a><a target="_blank" rel="noopener" href="' + FB + '">' + SI.fb + '<span>فيسبوك</span></a></p><small>© ' + new Date().getFullYear() + ' ' + esc(c.shop) + '</small></div></div>';
  }
  app.innerHTML = '<div class="grid">' + new Array(8).join('<div class="sk"></div>') + '</div>';
  Promise.all([
    api('/config').then(function (c) { S.cfg = c; $('#shopname').textContent = c.shop; document.title = c.shop + ' — متجر الجملة والقطاعي'; footer(); if (c.whatsapp) { var w = $('#wa'); w.href = 'https://wa.me/' + c.whatsapp; w.innerHTML = SI.wa; w.hidden = false; } }),
    api('/products').then(function (p) { S.products = p; window.BR = { products: p }; }), api('/colors').then(function (c) { S.colors = c; }),
    S.token ? api('/me').then(function (r) { S.user = r.user; }).catch(function () {}) : 0
  ]).then(function () { nav(); route(); }).catch(function (e) { app.textContent = 'تعذر تحميل المتجر: ' + e.message; });
})();
