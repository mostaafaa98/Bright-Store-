(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $('#app'), S = { user: null, token: localStorage.getItem('token'), cfg: { zones: [], wallet: {}, instapay: {} }, products: [], colors: [], cart: {}, cat: '', A: { tab: 'home', f: {}, rep: { by: 'product' }, aq: '' }, edit: null, pc: {}, qr: '', my: [] };
  try { S.cart = JSON.parse(localStorage.getItem('cart') || '{}'); S.my = JSON.parse(localStorage.getItem('myorders') || '[]'); } catch (e) {}
  var ST = { new: 'جديد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
  var PS = { pending: 'غير مدفوع', review: 'بانتظار المراجعة', paid: 'مدفوع' };
  var PM = { cod: 'عند الاستلام', wallet: 'محفظة إلكترونية', instapay: 'إنستا باي' };
  var SPECS = [['spec_weight', 'الوزن'], ['spec_count', 'عدد البكر / القطع'], ['spec_length', 'الطول'], ['spec_material', 'الخامة'], ['spec_size', 'المقاس / الإبر المناسبة'], ['spec_usage', 'الاستخدام']];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function egp(c) { var v = c / 100; return (v % 1 ? v.toFixed(2) : v).toLocaleString('ar-EG') + ' ج.م'; }
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
  function nav() {
    var h = '<a class="btn g sm" href="#/orders">طلباتي</a>';
    if (S.user && S.user.role === 'admin') h += '<a class="btn g sm" href="#/admin">لوحة التحكم</a>';
    h += S.user ? '<button class="g sm" data-act="logout">خروج</button>' : '<a class="btn g sm" href="#/login">دخول</a>';
    h += '<a class="btn" href="#/cart">🛒 <span class="badge">' + cartCount() + '</span></a>';
    $('#nav').innerHTML = h;
  }
  function msg(t, ok) { var e = $('#m'); if (e) { e.className = ok ? 'ok' : 'err'; e.textContent = t; } }
  function priceChips(p) {
    if (p.p_retail === p.p_half && p.p_half === p.p_whole) return '<div class="price">' + egp(p.p_retail) + ' <small>/ ' + esc(p.unit) + '</small></div>';
    return '<div class="price">' + egp(p.p_retail) + ' <small>/ ' + esc(p.unit) + '</small></div><div class="chips"><span class="chip">نصف جملة ' + egp(p.p_half) + ' (من ' + S.cfg.halfMin + ')</span><span class="chip">جملة ' + egp(p.p_whole) + ' (من ' + S.cfg.wholeMin + ')</span></div>';
  }
  function nudge(g) {
    var u = unitPrice(g.p, g.q), c = S.cfg;
    if (g.q < c.halfMin && g.p.p_half < u) return 'أضف ' + (c.halfMin - g.q) + ' ' + g.p.unit + ' لتحصل على سعر نصف الجملة ' + egp(g.p.p_half);
    if (g.q < c.wholeMin && g.p.p_whole < u) return 'أضف ' + (c.wholeMin - g.q) + ' ' + g.p.unit + ' لتحصل على سعر الجملة ' + egp(g.p.p_whole);
    return '';
  }
  function bg(u) { return u ? "background-image:url('" + esc(u) + "')" : ''; }

  // ---------- Shop + product sheet ----------
  function shop() {
    var q = $('#q').value.trim().toLowerCase(), cats = [''];
    S.products.forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });
    var list = S.products.filter(function (p) { return (!S.cat || p.category === S.cat) && (!q || (p.name + ' ' + p.name_en + ' ' + p.category).toLowerCase().indexOf(q) > -1); });
    app.innerHTML = '<div class="hero"><h2>خيوط مصرية بجودة عالمية</h2><p>سعر قطاعي ونصف جملة وجملة تلقائياً حسب الكمية، ومئات الألوان لكل منتج. اطلب بدون تسجيل حساب.</p></div>' +
      '<div class="cats">' + cats.map(function (c) { return '<button class="' + (c === S.cat ? '' : 'g') + '" data-act="cat" data-v="' + esc(c) + '">' + (esc(c) || 'الكل') + '</button>'; }).join('') + '</div>' +
      '<div class="grid">' + (list.length ? list.map(function (p) {
        var sp = [p.spec_weight, p.spec_length].filter(Boolean).join(' · ');
        return '<div class="card" data-act="open" data-id="' + p.id + '"><div class="img" style="' + bg(p.images[0]) + '"></div><div class="cb"><h3>' + esc(p.name) + '</h3><div class="mut">' + esc(p.category) + (p.has_colors ? ' · ' + p.color_ids.length + ' لون' : '') + '</div>' + (sp ? '<div class="mut">' + esc(sp) + '</div>' : '') + priceChips(p) + '</div></div>';
      }).join('') : '<p class="mut">لا توجد نتائج.</p>') + '</div>';
  }
  var M = null;
  function openProduct(id) {
    var p = prod(id); if (!p) return; M = { p: p, sel: {}, q: '', gi: 0 };
    Object.keys(S.cart).forEach(function (k) { var a = k.split(':'); if (Number(a[0]) === p.id) M.sel[a[1]] = S.cart[k]; });
    var el = $('#modal'); el.hidden = false;
    var specs = SPECS.filter(function (s) { return p[s[0]]; }).map(function (s) { return '<tr><td>' + s[1] + '</td><td>' + esc(p[s[0]]) + '</td></tr>'; }).join('');
    el.innerHTML = '<div class="sheet"><div style="display:flex;justify-content:space-between;gap:10px"><div><h3 style="margin:0">' + esc(p.name) + '</h3><div class="mut">' + esc(p.name_en) + '</div></div><button class="g sm" data-act="close">✕</button></div>' +
      '<div class="row"><div><div class="img" id="gm" style="' + bg(p.images[0]) + ';border-radius:12px"></div>' + (p.images.length > 1 ? '<div class="gal">' + p.images.map(function (u, i) { return '<div class="th' + (i ? '' : ' on') + '" data-act="gal" data-i="' + i + '" style="' + bg(u) + '"></div>'; }).join('') + '</div>' : '') + '</div><div><p class="mut">' + esc(p.description) + '</p>' + priceChips(p) + (specs ? '<table class="spec">' + specs + '</table>' : '') + '</div></div>' +
      (p.has_colors ? (p.color_ids.length ? '<input id="cq" placeholder="ابحث عن لون بالاسم أو الرقم…"><div class="sw" id="sw" style="margin-top:8px"></div>' : '<p class="err">لا توجد ألوان متاحة لهذا المنتج حالياً.</p>') : '') + '<div id="ms"></div></div>';
    mColors(); mSel();
  }
  function mColors() {
    var sw = $('#sw'); if (!sw) return; var q = M.q.toLowerCase();
    sw.innerHTML = S.colors.filter(function (c) { return M.p.color_ids.indexOf(c.id) > -1 && (!q || (c.name + ' ' + c.code).toLowerCase().indexOf(q) > -1); }).map(function (c) {
      var n = M.sel[c.id] || 0; return '<div class="s' + (n ? ' on' : '') + '" data-act="pick" data-id="' + c.id + '">' + (n ? '<em>' + n + '</em>' : '') + '<i style="background:' + esc(c.hex) + '"></i>' + esc(c.code) + '<br>' + esc(c.name) + '</div>';
    }).join('') || '<span class="mut">لا توجد ألوان مطابقة.</span>';
  }
  function step(kind, key, n) { return '<span class="step"><button class="g sm" data-act="' + kind + 'dec" data-k="' + esc(key) + '">−</button><input type="number" min="0" value="' + n + '" data-act="' + kind + 'set" data-k="' + esc(key) + '" style="width:64px;padding:4px;text-align:center"><button class="g sm" data-act="' + kind + 'inc" data-k="' + esc(key) + '">+</button></span>'; }
  function mSel() {
    var p = M.p, keys = Object.keys(M.sel), q = keys.reduce(function (n, k) { return n + M.sel[k]; }, 0), h = '';
    if (p.has_colors) h += keys.map(function (k) { var c = color(k); return '<div class="it"><span><i class="dotc" style="background:' + esc(c && c.hex) + '"></i> ' + esc(c ? c.code + ' - ' + c.name : '') + '</span>' + step('m', k, M.sel[k]) + '</div>'; }).join('');
    else h += '<div class="it"><span>الكمية (' + esc(p.unit) + ')</span>' + step('m', '0', M.sel['0'] || 0) + '</div>';
    var u = unitPrice(p, q), n = nudge({ p: p, q: q });
    h += (n && q ? '<div class="nudge">💡 ' + esc(n) + '</div>' : '') + '<div class="tot"><span>' + q + ' ' + esc(p.unit) + ' × ' + egp(u) + '</span><span>' + egp(u * q) + '</span></div><button style="width:100%;margin-top:10px" data-act="addcart"' + (q ? '' : ' disabled') + '>' + (q ? 'تحديث السلة' : (p.has_colors ? 'اختر الألوان والكميات' : 'حدّد الكمية')) + '</button>';
    $('#ms').innerHTML = h;
  }
  function setSel(k, n) { n = Math.max(0, Math.min(100000, parseInt(n, 10) || 0)); if (n) M.sel[k] = n; else delete M.sel[k]; mSel(); mColors(); }

  // ---------- Cart / checkout (بدون حساب) ----------
  function shipFor(gov, sub) {
    var z = S.cfg.zones.filter(function (x) { return x.name === gov; })[0];
    if (!z) return null; return S.cfg.freeOver > 0 && sub >= S.cfg.freeOver ? 0 : z.fee_cents;
  }
  function coSummary() {
    var f = $('#co'); if (!f) return; var sub = cartTotal(), gov = f.governorate.value, ship = shipFor(gov, sub), h = '<div><span>المنتجات</span><b>' + egp(sub) + '</b></div>';
    h += '<div><span>الشحن' + (gov ? ' — ' + esc(gov) : '') + '</span><b>' + (ship == null ? 'اختر المحافظة' : ship === 0 ? 'مجاني 🎉' : egp(ship)) + '</b></div>';
    if (ship > 0 && S.cfg.freeOver > 0) h += '<div class="mut"><span>أضف ' + egp(S.cfg.freeOver - sub) + ' للحصول على شحن مجاني</span></div>';
    h += '<div class="tot"><span>الإجمالي</span><span>' + (ship == null ? egp(sub) + ' + الشحن' : egp(sub + ship)) + '</span></div>';
    $('#sum').innerHTML = h;
  }
  function cart() {
    var gs = groups();
    if (!gs.length) { app.innerHTML = '<div class="panel">السلة فارغة. <a href="#/">تصفح المنتجات</a></div>'; return; }
    var h = '<div class="panel"><h3>سلة المشتريات</h3>';
    gs.forEach(function (g) {
      var u = unitPrice(g.p, g.q), n = nudge(g);
      h += '<div style="padding:8px 0;border-bottom:1px solid var(--bd)"><b>' + esc(g.p.name) + '</b> <span class="mut">— ' + g.q + ' ' + esc(g.p.unit) + ' × ' + egp(u) + ' = <b>' + egp(u * g.q) + '</b></span>';
      g.lines.forEach(function (l) { var c = color(l.cid); h += '<div class="it"><span>' + (l.cid && c ? '<i class="dotc" style="background:' + esc(c.hex) + '"></i> ' + esc(c.code + ' - ' + c.name) : 'الكمية') + '</span>' + step('c', l.key, l.qty) + '</div>'; });
      h += (n ? '<div class="nudge">💡 ' + esc(n) + '</div>' : '') + '</div>';
    });
    var hasW = S.cfg.wallet.number, hasI = S.cfg.instapay.number || S.cfg.instapay.handle || S.cfg.instapay.qr;
    h += '</div><form class="panel" id="co"><h3>بيانات الشحن والدفع</h3><p class="mut">لا تحتاج لإنشاء حساب — اكتب بياناتك وأكّد الطلب.</p>' +
      '<div class="row"><input name="name" placeholder="الاسم" required value="' + esc(S.user ? S.user.name : '') + '"><input name="phone" placeholder="رقم الموبايل" required inputmode="tel"></div>' +
      '<div class="row"><select name="governorate" required><option value="">المحافظة</option>' + S.cfg.zones.map(function (z) { return '<option value="' + esc(z.name) + '">' + esc(z.name) + ' — ' + (z.fee_cents ? egp(z.fee_cents) : 'مجاني') + '</option>'; }).join('') + '</select><input name="area" placeholder="المنطقة / الحي"></div>' +
      '<textarea name="address" placeholder="العنوان بالتفصيل (الشارع، رقم العقار، علامة مميزة)" required></textarea><input name="note" placeholder="ملاحظات (اختياري)" style="margin-top:8px">' +
      '<h4>طريقة الدفع</h4><div class="pay"><label class="o"><input type="radio" name="payment" value="cod" checked> الدفع عند الاستلام</label>' +
      (hasW ? '<label class="o"><input type="radio" name="payment" value="wallet"> محفظة إلكترونية (تحويل ثم تأكيد)</label>' : '') + (hasI ? '<label class="o"><input type="radio" name="payment" value="instapay"> إنستا باي (QR أو رقم)</label>' : '') + '</div>' +
      '<div class="sum" id="sum"></div><p class="mut">' + esc(S.cfg.note || '') + '</p><p id="m"></p><button style="width:100%">تأكيد الطلب</button></form>';
    app.innerHTML = h; coSummary();
  }
  function payBox(o, token) {
    if (o.payment_method === 'cod') return '<p>💵 الدفع عند الاستلام: ' + egp(o.total_cents) + '</p>';
    if (o.payment_status === 'paid') return '<p class="ok">✅ تم تأكيد الدفع.</p>';
    var w = S.cfg.wallet, i = S.cfg.instapay, h = '<div class="panel" style="background:var(--bg)"><b>حوّل مبلغ ' + egp(o.total_cents) + ' ثم أرسل رقم العملية</b>';
    if (o.payment_method === 'wallet') h += '<p>رقم المحفظة: <span class="big">' + esc(w.number) + '</span> <button class="g sm" data-act="copy" data-v="' + esc(w.number) + '">نسخ</button><br><span class="mut">' + esc(w.name) + '</span></p>';
    else h += (i.qr ? '<p><img class="qr" alt="QR" src="' + esc(i.qr) + '"></p>' : '') + (i.number ? '<p>رقم إنستا باي: <span class="big">' + esc(i.number) + '</span> <button class="g sm" data-act="copy" data-v="' + esc(i.number) + '">نسخ</button></p>' : '') + (i.handle ? '<p>العنوان: <b>' + esc(i.handle) + '</b></p>' : '');
    if (o.payment_status === 'review') h += '<p class="ok">استلمنا بيانات التحويل (' + esc(o.payment_ref) + ') وهي قيد المراجعة.</p>';
    return h + '<form data-proof="' + o.id + '" data-token="' + esc(token || '') + '" class="row"><input name="ref" placeholder="رقم العملية أو الرقم المحوَّل منه" required><button>تأكيد التحويل</button></form><p id="m' + o.id + '" class="mut"></p></div>';
  }
  function waLink(text) { return S.cfg.whatsapp ? '<a class="btn" style="background:#25d366" target="_blank" rel="noopener" href="https://wa.me/' + esc(S.cfg.whatsapp) + '?text=' + encodeURIComponent(text) + '">💬 تواصل مع برايت على واتساب</a>' : ''; }
  function done(r, f) {
    var o = { id: r.orderId, payment_method: r.payment, payment_status: 'pending', total_cents: r.total };
    app.innerHTML = '<div class="panel"><h2 class="ok">✅ تم استلام طلبك</h2><p style="font-size:20px">رقم الطلب: <b>#' + r.orderId + '</b></p><div class="sum"><div><span>المنتجات</span><b>' + egp(r.sub) + '</b></div><div><span>الشحن</span><b>' + (r.shipping ? egp(r.shipping) : 'مجاني') + '</b></div><div class="tot"><span>الإجمالي</span><span>' + egp(r.total) + '</span></div></div>' +
      '<p>سنتواصل معك على <b>' + esc(f.phone) + '</b> لتأكيد الشحن. احتفظ برقم الطلب لمتابعته من «طلباتي».</p>' + payBox(o, r.token) +
      '<div class="row">' + waLink('مرحباً برايت، أنا ' + f.name + '، رقم طلبي #' + r.orderId + ' بإجمالي ' + egp(r.total)) + '<a class="btn g" href="#/orders">متابعة طلباتي</a><a class="btn g" href="#/">متابعة التسوق</a></div></div>';
  }
  function login(reg) {
    app.innerHTML = '<form class="panel" style="max-width:420px;margin:20px auto" id="au" data-reg="' + (reg ? 1 : 0) + '"><h3>' + (reg ? 'إنشاء حساب' : 'تسجيل الدخول') + '</h3>' + (reg ? '<input name="name" placeholder="الاسم" required><br><br>' : '') + '<input name="email" type="email" placeholder="البريد الإلكتروني" required><br><br><input name="password" type="password" placeholder="كلمة المرور (8 أحرف على الأقل)" required minlength="8"><p id="m"></p><button style="width:100%">' + (reg ? 'إنشاء الحساب' : 'دخول') + '</button><p><a href="#/' + (reg ? 'login' : 'register') + '">' + (reg ? 'لدي حساب' : 'حساب جديد') + '</a></p><p class="mut">الحساب اختياري — يمكنك الطلب كضيف.</p></form>';
  }
  function orders() {
    Promise.all([S.user ? api('/orders') : [], S.my.length ? api('/orders/lookup', { method: 'POST', body: { orders: S.my } }) : []]).then(function (r) {
      var own = {}; r[0].forEach(function (o) { own[o.id] = 1; }); var seen = {}, list = r[0].concat(r[1], S.found || []).filter(function (o) { return seen[o.id] ? false : (seen[o.id] = 1); }).sort(function (a, b) { return b.id - a.id; });
      var tok = {}; S.my.forEach(function (m) { tok[m.id] = m.token; });
      app.innerHTML = '<form class="panel" id="lk"><b>تتبع طلب برقمه</b><div class="row"><input name="id" type="number" placeholder="رقم الطلب" required><input name="phone" placeholder="رقم الموبايل المسجل في الطلب" required><button>بحث</button></div><p id="m" class="err"></p></form>' +
        (list.length ? list.map(function (o) {
          return '<div class="panel"><b>طلب #' + o.id + '</b> · ' + ST[o.status] + ' · ' + PM[o.payment_method] + ' (' + PS[o.payment_status] + ')<div class="mut">' + esc(o.created_at) + ' · ' + esc(o.governorate) + '</div>' +
            o.items.map(function (i) { return '<div class="it"><span>' + esc(i.name) + (i.color ? ' — ' + esc(i.color) : '') + '</span><span>' + i.qty + ' × ' + egp(i.price_cents) + '</span></div>'; }).join('') +
            '<div class="it"><span>الشحن</span><span>' + (o.shipping_cents ? egp(o.shipping_cents) : 'مجاني') + '</span></div><div class="tot"><span>الإجمالي</span><span>' + egp(o.total_cents) + '</span></div>' + (o.status === 'cancelled' ? '' : (tok[o.id] || own[o.id] ? payBox(o, tok[o.id]) : (o.payment_method === 'cod' ? payBox(o) : '<p class="mut">لتأكيد التحويل تواصل معنا على واتساب.</p>'))) + '<div>' + waLink('بخصوص طلبي رقم #' + o.id) + '</div></div>';
        }).join('') : '<div class="panel">لا توجد طلبات على هذا الجهاز/الحساب.</div>');
    });
  }

  // ---------- Admin ----------
  var TABS = { home: 'نظرة عامة', products: 'المنتجات', colors: 'الألوان', orders: 'الطلبات', reports: 'التقارير', audit: 'سجل التعديلات', settings: 'الإعدادات' };
  function adminView() {
    if (!S.user || S.user.role !== 'admin') { location.hash = '#/'; return; }
    var tabs = '<div class="tabs">' + Object.keys(TABS).map(function (k) { return '<button class="' + (S.A.tab === k ? '' : 'g') + '" data-act="tab" data-v="' + k + '">' + TABS[k] + '</button>'; }).join('') + '</div>';
    var body = $('#abody'); if (!body) { app.innerHTML = tabs + '<div id="abody"></div>'; body = $('#abody'); } else $('.tabs').outerHTML = tabs;
    ({ home: aHome, products: aProducts, colors: aColors, orders: aOrders, reports: aReports, audit: aAudit, settings: aSettings }[S.A.tab])(body);
  }
  function aHome(b) {
    api('/admin/stats').then(function (s) {
      b.innerHTML = '<div class="panel kpi"><div>مبيعات اليوم<b>' + egp(s.today) + '</b></div><div>مبيعات الشهر<b>' + egp(s.month) + '</b></div><div>طلبات جديدة<b>' + s.newOrders + '</b></div><div>تحويلات للمراجعة<b>' + s.review + '</b></div></div>' +
        '<div class="panel"><h3>مخزون منخفض</h3>' + (s.low.length ? s.low.map(function (p) { return '<div class="it"><span>' + esc(p.name) + '</span><b>' + p.stock + '</b></div>'; }).join('') : '<span class="mut">لا يوجد.</span>') + '</div>';
    });
  }
  function f(n, l, t, v, x) { return '<div><label>' + l + '</label><input name="' + n + '" type="' + (t || 'text') + '" ' + (x || '') + ' value="' + esc(v == null ? '' : v) + '"></div>'; }
  function renderPC() {
    var g = $('#pcg'); if (!g) return;
    g.innerHTML = S.colors.map(function (c) { var on = S.pc[c.id]; return '<div class="s' + (on ? ' on' : '') + '" data-act="pcol" data-id="' + c.id + '">' + (on ? '<em>✓</em>' : '') + '<i style="background:' + esc(c.hex) + '"></i>' + esc(c.code) + '<br>' + esc(c.name) + '</div>'; }).join('');
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
        '<div class="panel"><h3>كل الألوان (' + cs.length + ')</h3><div class="sw" style="max-height:none">' + cs.map(function (c) { return '<div class="s"><i style="background:' + esc(c.hex) + '"></i>' + esc(c.code) + '<br>' + esc(c.name) + '<br><button class="g sm" data-act="delcolor" data-id="' + c.id + '">حذف</button></div>'; }).join('') + '</div></div>';
    });
  }
  function sel(obj, cur, id, k) { return '<select data-ostat="' + id + '" data-k="' + k + '">' + Object.keys(obj).map(function (x) { return '<option value="' + x + '"' + (x === cur ? ' selected' : '') + '>' + obj[x] + '</option>'; }).join('') + '</select>'; }
  function opts(obj, cur, all) { return '<option value="">' + all + '</option>' + Object.keys(obj).map(function (x) { return '<option value="' + x + '"' + (x === cur ? ' selected' : '') + '>' + obj[x] + '</option>'; }).join(''); }
  function aOrders(b) {
    var F = S.A.f, zs = {}; S.cfg.zones.forEach(function (z) { zs[z.name] = z.name; });
    api('/admin/orders?' + qs(F)).then(function (os) {
      b.innerHTML = '<form class="panel" id="of"><div class="flt"><div><label>من</label><input type="date" name="from" value="' + esc(F.from || '') + '"></div><div><label>إلى</label><input type="date" name="to" value="' + esc(F.to || '') + '"></div><div><label>المحافظة</label><select name="governorate">' + opts(zs, F.governorate, 'الكل') + '</select></div><div><label>حالة الطلب</label><select name="status">' + opts(ST, F.status, 'الكل') + '</select></div><div><label>حالة الدفع</label><select name="payment_status">' + opts(PS, F.payment_status, 'الكل') + '</select></div><div><label>طريقة الدفع</label><select name="payment_method">' + opts(PM, F.payment_method, 'الكل') + '</select></div><div><label>بحث (اسم/هاتف/رقم)</label><input name="q" value="' + esc(F.q || '') + '"></div><button>تطبيق</button><button type="button" class="g" data-act="oreset">مسح</button><button type="button" data-act="oxlsx" style="background:#15803d">تصدير Excel</button></div></form>' +
        '<div class="panel scroll"><h3>الطلبات (' + os.length + ')</h3><table><tr><th>#</th><th>العميل</th><th>الأصناف</th><th>الإجمالي</th><th>الدفع</th><th>الحالة</th></tr>' + os.map(function (o) {
          return '<tr><td>' + o.id + '<br><span class="mut">' + esc(o.local_at) + '</span></td><td>' + esc(o.name) + '<br><span class="mut">' + esc(o.phone) + '<br>' + esc(o.governorate) + (o.area ? ' / ' + esc(o.area) : '') + '<br>' + esc(o.address) + (o.note ? '<br>📝 ' + esc(o.note) : '') + '</span></td><td>' + o.items.map(function (i) { return esc(i.name) + (i.color ? ' [' + esc(i.color) + ']' : '') + ' ×' + i.qty; }).join('<br>') + '</td><td>' + egp(o.total_cents) + '<br><span class="mut">شحن ' + egp(o.shipping_cents) + '</span></td><td>' + PM[o.payment_method] + '<br>' + sel(PS, o.payment_status, o.id, 'payment_status') + (o.payment_ref ? '<br><span class="mut">مرجع: ' + esc(o.payment_ref) + '</span>' : '') + '</td><td>' + sel(ST, o.status, o.id, 'status') + '</td></tr>';
        }).join('') + '</table></div>';
    });
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
      b.innerHTML = '<form class="panel" id="sf"><h3>إعدادات المتجر</h3><div class="row">' + g('shop_name', 'اسم المتجر') + g('half_min', 'بداية نصف الجملة (وحدة)', 'number') + g('whole_min', 'بداية الجملة (وحدة)', 'number') + '</div><div class="row">' + g('whatsapp_number', 'واتساب برايت (دولي: 2010xxxxxxxx)') + g('free_shipping_over', 'شحن مجاني فوق (ج.م) — 0 = معطّل', 'number') + '</div>' + g('shipping_note', 'ملاحظة الشحن تظهر في السلة') +
        '<h3>الدفع</h3><div class="row">' + g('wallet_number', 'رقم المحفظة الإلكترونية') + g('wallet_name', 'اسم صاحب المحفظة') + '</div><div class="row">' + g('instapay_number', 'رقم إنستا باي') + g('instapay_handle', 'عنوان إنستا باي (name@instapay)') + '</div><div class="row"><div><label>QR إنستا باي (صورة)</label><input type="file" accept="image/*" data-act="qrfile"></div><img id="qrp" class="qr" style="max-width:120px;' + (s.instapay_qr ? '' : 'display:none') + '" src="' + esc(s.instapay_qr) + '"></div>' +
        '<h3>إشعارات الطلبات على تيليجرام</h3><p class="mut">أنشئ بوتاً من @BotFather وخذ التوكن، ثم أرسل له رسالة وخذ معرّف المحادثة (Chat ID) من @userinfobot، أو أضف البوت لجروب واستخدم معرّفه.</p><div class="row">' + g('telegram_token', 'Bot Token') + g('telegram_chat', 'Chat ID') + '</div><p id="m"></p><button>حفظ الإعدادات</button> <button type="button" class="g" data-act="tgtest">إرسال رسالة اختبار</button></form>' +
        '<form class="panel scroll" id="zf"><h3>الشحن حسب المحافظة</h3><p class="mut">القيم المبدئية تقديرية — عدّلها حسب شركة الشحن. صفر = مجاني. إلغاء التفعيل يخفي المحافظة من الطلب.</p><div class="row"><input id="zall" type="number" placeholder="سعر موحد لكل المحافظات"><button type="button" class="g" data-act="zapply">تطبيق على الكل</button></div><table>' + s.zones.map(function (z) { return '<tr><td>' + esc(z.name) + '</td><td><input class="price-in" type="number" min="0" step="0.5" data-zone="' + esc(z.name) + '" value="' + z.fee_cents / 100 + '"></td><td><label><input type="checkbox" style="width:auto" data-zon="' + esc(z.name) + '" ' + (z.active ? 'checked' : '') + '> مفعّلة</label></td></tr>'; }).join('') + '</table><p id="zm"></p><button>حفظ الشحن</button></form>' +
        '<div class="panel"><h3>نسخة احتياطية</h3><p class="mut">حمّل نسخة من قاعدة البيانات (طلبات، منتجات، حسابات) واحتفظ بها بعيداً عن السيرفر.</p><button data-act="backup" class="g">تنزيل نسخة احتياطية</button></div>';
    });
  }

  function route() {
    var r = location.hash.replace('#/', '').split('?')[0];
    $('#modal').hidden = true;
    ({ '': shop, cart: cart, login: function () { login(false); }, register: function () { login(true); }, orders: orders, admin: adminView }[r] || shop)();
    window.scrollTo(0, 0);
  }
  function img(file, max, cb) {
    var r = new FileReader(); r.onload = function () { var i = new Image(); i.onload = function () {
      var k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = i.width * k; c.height = i.height * k;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height);
      var q = 0.85, d = c.toDataURL('image/jpeg', q); while (d.length > 380000 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); } cb(d); }; i.src = r.result; }; r.readAsDataURL(file);
  }
  function reAdmin() { if (S.A.tab === 'products') aProducts($('#abody')); }

  // ---------- Events ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t || t.tagName === 'INPUT') return;
    var a = t.dataset.act, id = t.dataset.id, k = t.dataset.k;
    if (a === 'logout') logout();
    else if (a === 'cat') { S.cat = t.dataset.v; shop(); }
    else if (a === 'open') openProduct(id);
    else if (a === 'close') $('#modal').hidden = true;
    else if (a === 'gal') { $('#gm').style.backgroundImage = "url('" + M.p.images[t.dataset.i] + "')"; document.querySelectorAll('.gal .th').forEach(function (x) { x.classList.toggle('on', x === t); }); }
    else if (a === 'pick') setSel(id, (M.sel[id] || 0) + 1);
    else if (a === 'minc') setSel(k, (M.sel[k] || 0) + 1);
    else if (a === 'mdec') setSel(k, (M.sel[k] || 0) - 1);
    else if (a === 'addcart') {
      Object.keys(S.cart).forEach(function (key) { if (Number(key.split(':')[0]) === M.p.id) delete S.cart[key]; });
      Object.keys(M.sel).forEach(function (c) { S.cart[M.p.id + ':' + c] = M.sel[c]; });
      saveCart(); $('#modal').hidden = true; toast('تم تحديث السلة ✓');
    }
    else if (a === 'cinc' || a === 'cdec') { S.cart[k] = (S.cart[k] || 0) + (a === 'cinc' ? 1 : -1); if (S.cart[k] <= 0) delete S.cart[k]; saveCart(); cart(); }
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
    else if (a === 'cset') { var n = parseInt(t.value, 10) || 0; if (n > 0) S.cart[t.dataset.k] = n; else delete S.cart[t.dataset.k]; saveCart(); cart(); }
    else if (a === 'imgadd' && t.files[0]) img(t.files[0], 900, function (d) { api('/admin/products/' + t.dataset.id + '/images', { method: 'POST', body: { data: d } }).then(function () { toast('تمت إضافة الصورة ✓'); reAdmin(); }).catch(function (x) { toast(x.message); }); });
    else if (a === 'qrfile' && t.files[0]) img(t.files[0], 500, function (d) { S.qr = d; $('#qrp').src = d; $('#qrp').style.display = 'block'; });
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
    var fm = e.target, d = Object.fromEntries(new FormData(fm)), btn = fm.querySelector('button'); if (btn) btn.disabled = true;
    var again = function () { if (btn) btn.disabled = false; }, bad = function (x) { msg(x.message); again(); };
    if (fm.id === 'au') api('/auth/' + (fm.dataset.reg === '1' ? 'register' : 'login'), { method: 'POST', body: d }).then(function (r) {
      S.token = r.token; S.user = r.user; localStorage.setItem('token', r.token); nav(); location.hash = '#/'; }).catch(bad);
    else if (fm.id === 'co') api('/orders', { method: 'POST', body: Object.assign({}, d, { items: Object.keys(S.cart).map(function (k) { var a = k.split(':'); return { id: Number(a[0]), color: Number(a[1]), qty: S.cart[k] }; }) }) }).then(function (r) {
      S.my.unshift({ id: r.orderId, token: r.token }); S.my = S.my.slice(0, 20); localStorage.setItem('myorders', JSON.stringify(S.my));
      S.cart = {}; saveCart(); done(r, d); window.scrollTo(0, 0); }).catch(bad);
    else if (fm.id === 'lk') api('/orders/lookup', { method: 'POST', body: { id: d.id, phone: d.phone } }).then(function (r) {
      if (!r.length) { msg('لا يوجد طلب بهذه البيانات'); again(); return; }
      S.found = r; orders(); }).catch(bad);
    else if (fm.dataset.proof) api('/orders/' + fm.dataset.proof + '/proof', { method: 'POST', body: { ref: d.ref, token: fm.dataset.token } }).then(function () { toast('تم إرسال بيانات التحويل ✓'); route(); }).catch(function (x) { var m = $('#m' + fm.dataset.proof); if (m) { m.className = 'err'; m.textContent = x.message; } again(); });
    else if (fm.id === 'pf') { var cur = prod(S.edit) || {}; d.has_colors = fm.has_colors.checked; d.image_url = cur.image_url || '';
      api(S.edit ? '/admin/products/' + S.edit : '/admin/products', { method: S.edit ? 'PUT' : 'POST', body: d }).then(function (r) {
        var id = S.edit || r.id; return api('/admin/products/' + id + '/colors', { method: 'PUT', body: { ids: d.has_colors ? Object.keys(S.pc).filter(function (c) { return S.pc[c]; }) : [] } }).then(function () { return id; });
      }).then(function (id) { S.edit = id; S.pcInit = false; toast('تم الحفظ ✓'); aProducts($('#abody')); }).catch(bad); }
    else if (fm.id === 'cf') api('/admin/colors/bulk', { method: 'POST', body: { text: d.text, addToAll: !!d.addToAll } }).then(function (r) { toast('تم استيراد ' + r.imported + ' لون'); aColors($('#abody')); }).catch(bad);
    else if (fm.id === 'sf') { d.instapay_qr = S.qr || ''; api('/admin/settings', { method: 'PUT', body: d }).then(function () { toast('تم الحفظ ✓'); return api('/config').then(function (c) { S.cfg = c; }); }).then(again).catch(bad); }
    else if (fm.id === 'zf') api('/admin/zones', { method: 'PUT', body: { zones: Array.prototype.map.call(fm.querySelectorAll('[data-zone]'), function (i) { return { name: i.dataset.zone, fee: i.value, active: fm.querySelector('[data-zon="' + i.dataset.zone + '"]').checked }; }) } }).then(function () { toast('تم حفظ الشحن ✓'); return api('/config').then(function (c) { S.cfg = c; }); }).then(again).catch(function (x) { toast(x.message); again(); });
    else if (fm.id === 'of') { S.A.f = d; aOrders($('#abody')); }
    else if (fm.id === 'rf') { S.A.rep = d; aReports($('#abody')); }
  });
  $('#q').addEventListener('input', function () { if (location.hash && location.hash !== '#/') location.hash = '#/'; else shop(); });
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') e.target.hidden = true; });
  window.addEventListener('hashchange', route);

  Promise.all([
    api('/config').then(function (c) { S.cfg = c; $('#shopname').textContent = c.shop; document.title = c.shop + ' — متجر الجملة والقطاعي'; if (c.whatsapp) { var w = $('#wa'); w.href = 'https://wa.me/' + c.whatsapp; w.hidden = false; } }),
    api('/products').then(function (p) { S.products = p; }), api('/colors').then(function (c) { S.colors = c; }),
    S.token ? api('/me').then(function (r) { S.user = r.user; }).catch(function () {}) : 0
  ]).then(function () { nav(); route(); }).catch(function (e) { app.textContent = 'تعذر تحميل المتجر: ' + e.message; });
})();
