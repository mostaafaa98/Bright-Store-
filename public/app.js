(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $('#app'), S = { user: null, token: localStorage.getItem('token'), cfg: {}, products: [], colors: [], cart: {}, cat: '', A: { tab: 'home' }, edit: null, img: '' };
  try { S.cart = JSON.parse(localStorage.getItem('cart') || '{}'); } catch (e) {}
  var ST = { new: 'جديد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
  var PS = { pending: 'غير مدفوع', review: 'بانتظار المراجعة', paid: 'مدفوع' };
  var PM = { cod: 'عند الاستلام', wallet: 'محفظة إلكترونية', instapay: 'إنستا باي' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function egp(c) { var v = c / 100; return (v % 1 ? v.toFixed(2) : v).toLocaleString('ar-EG') + ' ج.م'; }
  function toast(t) { var e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, 2200); }
  function api(path, opt) {
    opt = opt || {}; var h = { 'Content-Type': 'application/json' }; if (S.token) h.Authorization = 'Bearer ' + S.token;
    return fetch('/api' + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && S.token) logout(true);
        if (!r.ok) throw new Error(d.error || 'حدث خطأ'); return d; });
    });
  }
  function prod(id) { return S.products.filter(function (p) { return p.id === Number(id); })[0]; }
  function color(id) { return S.colors.filter(function (c) { return c.id === Number(id); })[0]; }
  function unitPrice(p, q) { return q >= S.cfg.wholeMin ? p.p_whole : q >= S.cfg.halfMin ? p.p_half : p.p_retail; }
  function saveCart() { localStorage.setItem('cart', JSON.stringify(S.cart)); nav(); }
  function groups() {
    var g = {};
    Object.keys(S.cart).forEach(function (k) {
      var a = k.split(':'), p = prod(a[0]); if (!p) { delete S.cart[k]; return; }
      g[p.id] = g[p.id] || { p: p, q: 0, lines: [] }; g[p.id].q += S.cart[k]; g[p.id].lines.push({ key: k, cid: Number(a[1]), qty: S.cart[k] });
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

  // ---------- Shop ----------
  function shop() {
    var q = $('#q').value.trim(), cats = [''];
    S.products.forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });
    var list = S.products.filter(function (p) { return (!S.cat || p.category === S.cat) && (!q || (p.name + ' ' + p.name_en + ' ' + p.category).toLowerCase().indexOf(q.toLowerCase()) > -1); });
    app.innerHTML = '<div class="hero"><h2>خيوط مصرية بجودة عالمية</h2><p>سعر قطاعي ونصف جملة وجملة تلقائياً حسب الكمية، ومئات الألوان لكل منتج.</p></div>' +
      '<div class="cats">' + cats.map(function (c) { return '<button class="' + (c === S.cat ? '' : 'g') + '" data-act="cat" data-v="' + esc(c) + '">' + (esc(c) || 'الكل') + '</button>'; }).join('') + '</div>' +
      '<div class="grid">' + (list.length ? list.map(function (p) {
        return '<div class="card" data-act="open" data-id="' + p.id + '"><div class="img" style="background-image:url(\'' + esc(p.image_url) + '\')"></div><div class="cb"><h3>' + esc(p.name) + '</h3><div class="mut">' + esc(p.category) + (p.has_colors ? ' · ألوان متعددة' : '') + '</div>' + priceChips(p) + '</div></div>';
      }).join('') : '<p class="mut">لا توجد نتائج.</p>') + '</div>';
  }
  var M = null;
  function openProduct(id) {
    var p = prod(id); if (!p) return; M = { p: p, sel: {}, q: '' };
    Object.keys(S.cart).forEach(function (k) { var a = k.split(':'); if (Number(a[0]) === p.id) M.sel[a[1]] = S.cart[k]; });
    var el = $('#modal'); el.hidden = false;
    el.innerHTML = '<div class="sheet"><div style="display:flex;justify-content:space-between;gap:10px"><div><h3 style="margin:0">' + esc(p.name) + '</h3><div class="mut">' + esc(p.name_en) + '</div></div><button class="g sm" data-act="close">✕</button></div>' +
      '<div class="row"><div class="img" style="background-image:url(\'' + esc(p.image_url) + '\');border-radius:12px;max-width:260px"></div><div><p class="mut">' + esc(p.description) + '</p>' + priceChips(p) + '</div></div>' +
      (p.has_colors ? '<input id="cq" placeholder="ابحث عن لون بالاسم أو الرقم…"><div class="sw" id="sw" style="margin-top:8px"></div>' : '') +
      '<div id="ms"></div></div>';
    mColors(); mSel();
  }
  function mColors() {
    var sw = $('#sw'); if (!sw) return; var q = M.q.toLowerCase();
    sw.innerHTML = S.colors.filter(function (c) { return !q || (c.name + ' ' + c.code).toLowerCase().indexOf(q) > -1; }).map(function (c) {
      var n = M.sel[c.id] || 0; return '<div class="s' + (n ? ' on' : '') + '" data-act="pick" data-id="' + c.id + '">' + (n ? '<em>' + n + '</em>' : '') + '<i style="background:' + esc(c.hex) + '"></i>' + esc(c.code) + '<br>' + esc(c.name) + '</div>';
    }).join('') || '<span class="mut">لا توجد ألوان مطابقة.</span>';
  }
  function mSel() {
    var p = M.p, keys = Object.keys(M.sel), q = keys.reduce(function (n, k) { return n + M.sel[k]; }, 0), h = '';
    if (p.has_colors) h += keys.map(function (k) { var c = color(k); return '<div class="it"><span><i class="dotc" style="background:' + esc(c && c.hex) + '"></i> ' + esc(c ? c.code + ' - ' + c.name : '') + '</span>' + step('m', k, M.sel[k]) + '</div>'; }).join('');
    else h += '<div class="it"><span>الكمية</span>' + step('m', '0', M.sel['0'] || 0) + '</div>';
    var u = unitPrice(p, q), n = nudge({ p: p, q: q });
    h += (n && q ? '<div class="nudge">💡 ' + esc(n) + '</div>' : '') + '<div class="tot"><span>' + q + ' ' + esc(p.unit) + ' × ' + egp(u) + '</span><span>' + egp(u * q) + '</span></div><button style="width:100%;margin-top:10px" data-act="addcart"' + (q ? '' : ' disabled') + '>' + (q ? 'تحديث السلة' : (p.has_colors ? 'اختر الألوان والكميات' : 'حدّد الكمية')) + '</button>';
    $('#ms').innerHTML = h;
  }
  function step(kind, key, n) { return '<span class="step"><button class="g sm" data-act="' + kind + 'dec" data-k="' + esc(key) + '">−</button><input type="number" min="0" value="' + n + '" data-act="' + kind + 'set" data-k="' + esc(key) + '" style="width:64px;padding:4px;text-align:center"><button class="g sm" data-act="' + kind + 'inc" data-k="' + esc(key) + '">+</button></span>'; }
  function setSel(k, n) { n = Math.max(0, Math.min(100000, parseInt(n, 10) || 0)); if (n) M.sel[k] = n; else delete M.sel[k]; mSel(); mColors(); }

  // ---------- Cart / checkout ----------
  function cart() {
    var gs = groups();
    if (!gs.length) { app.innerHTML = '<div class="panel">السلة فارغة. <a href="#/">تصفح المنتجات</a></div>'; return; }
    var h = '<div class="panel"><h3>سلة المشتريات</h3>';
    gs.forEach(function (g) {
      var u = unitPrice(g.p, g.q), n = nudge(g);
      h += '<div style="padding:8px 0;border-bottom:1px solid var(--bd)"><b>' + esc(g.p.name) + '</b> <span class="mut">— ' + g.q + ' ' + esc(g.p.unit) + ' × ' + egp(u) + ' = <b>' + egp(u * g.q) + '</b></span>';
      g.lines.forEach(function (l) { var c = color(l.cid); h += '<div class="it"><span>' + (l.cid && c ? '<i class="dotc" style="background:' + esc(c.hex) + '"></i> ' + esc(c.code + ' - ' + c.name) : 'بدون لون') + '</span>' + step('c', l.key, l.qty) + '</div>'; });
      h += (n ? '<div class="nudge">💡 ' + esc(n) + '</div>' : '') + '</div>';
    });
    h += '<div class="tot"><span>الإجمالي</span><span>' + egp(cartTotal()) + '</span></div><p class="mut">' + esc(S.cfg.note || '') + '</p></div>';
    if (!S.user) h += '<div class="panel">سجّل الدخول لإتمام الطلب. <a href="#/login">دخول / إنشاء حساب</a></div>';
    else {
      var hasW = S.cfg.wallet.number, hasI = S.cfg.instapay.number || S.cfg.instapay.handle || S.cfg.instapay.qr;
      h += '<form class="panel" id="co"><h3>بيانات الشحن والدفع</h3><div class="row"><input name="name" placeholder="الاسم" required value="' + esc(S.user.name) + '"><input name="phone" placeholder="رقم الهاتف" required inputmode="tel"></div><textarea name="address" placeholder="العنوان بالتفصيل" required></textarea><input name="note" placeholder="ملاحظات (اختياري)"><h4>طريقة الدفع</h4><div class="pay"><label class="o"><input type="radio" name="payment" value="cod" checked> الدفع عند الاستلام</label>' +
        (hasW ? '<label class="o"><input type="radio" name="payment" value="wallet"> محفظة إلكترونية (تحويل ثم تأكيد)</label>' : '') +
        (hasI ? '<label class="o"><input type="radio" name="payment" value="instapay"> إنستا باي (QR أو رقم)</label>' : '') + '</div><p id="m"></p><button style="width:100%">تأكيد الطلب · ' + egp(cartTotal()) + '</button></form>';
    }
    app.innerHTML = h;
  }
  function payBox(o) {
    if (o.payment_method === 'cod') return '<p>سيتم الدفع عند الاستلام.</p>';
    if (o.payment_status === 'paid') return '<p class="ok">✅ تم تأكيد الدفع.</p>';
    var w = S.cfg.wallet, i = S.cfg.instapay, h = '<div class="panel" style="background:var(--bg)"><b>حوّل مبلغ ' + egp(o.total_cents) + ' ثم أرسل رقم العملية</b>';
    if (o.payment_method === 'wallet') h += '<p>رقم المحفظة: <span class="big">' + esc(w.number) + '</span> <button class="g sm" data-act="copy" data-v="' + esc(w.number) + '">نسخ</button><br><span class="mut">' + esc(w.name) + '</span></p>';
    else h += (i.qr ? '<p><img class="qr" alt="QR" src="' + esc(i.qr) + '"></p>' : '') + (i.number ? '<p>رقم إنستا باي: <span class="big">' + esc(i.number) + '</span> <button class="g sm" data-act="copy" data-v="' + esc(i.number) + '">نسخ</button></p>' : '') + (i.handle ? '<p>العنوان: <b>' + esc(i.handle) + '</b></p>' : '');
    h += o.payment_status === 'review' ? '<p class="ok">استلمنا بيانات التحويل (' + esc(o.payment_ref) + ') وهي قيد المراجعة.</p>' : '';
    h += '<form data-proof="' + o.id + '" class="row"><input name="ref" placeholder="رقم العملية أو الرقم المحوَّل منه" required><button>تأكيد التحويل</button></form><p id="m' + o.id + '" class="mut"></p></div>';
    return h;
  }
  function done(r) {
    app.innerHTML = '<div class="panel"><h3>✅ تم استلام طلبك رقم #' + r.orderId + '</h3><p>الإجمالي: <b>' + egp(r.total) + '</b></p>' + payBox({ id: r.orderId, payment_method: r.payment, payment_status: 'pending', total_cents: r.total }) + '<a class="btn" href="#/orders">طلباتي</a></div>';
  }
  function login(reg) {
    app.innerHTML = '<form class="panel" style="max-width:420px;margin:20px auto" id="au" data-reg="' + (reg ? 1 : 0) + '"><h3>' + (reg ? 'إنشاء حساب' : 'تسجيل الدخول') + '</h3>' + (reg ? '<input name="name" placeholder="الاسم" required><br><br>' : '') + '<input name="email" type="email" placeholder="البريد الإلكتروني" required><br><br><input name="password" type="password" placeholder="كلمة المرور (8 أحرف على الأقل)" required minlength="8"><p id="m"></p><button style="width:100%">' + (reg ? 'إنشاء الحساب' : 'دخول') + '</button><p><a href="#/' + (reg ? 'login' : 'register') + '">' + (reg ? 'لدي حساب' : 'حساب جديد') + '</a></p></form>';
  }
  function orders() {
    if (!S.user) { location.hash = '#/login'; return; }
    api('/orders').then(function (list) {
      app.innerHTML = list.length ? list.map(function (o) {
        return '<div class="panel"><b>طلب #' + o.id + '</b> · ' + ST[o.status] + ' · ' + PM[o.payment_method] + ' (' + PS[o.payment_status] + ')<div class="mut">' + esc(o.created_at) + '</div>' +
          o.items.map(function (i) { return '<div class="it"><span>' + esc(i.name) + (i.color ? ' — ' + esc(i.color) : '') + '</span><span>' + i.qty + ' × ' + egp(i.price_cents) + '</span></div>'; }).join('') +
          '<div class="tot"><span>الإجمالي</span><span>' + egp(o.total_cents) + '</span></div>' + (o.status === 'cancelled' ? '' : payBox(o)) + '</div>';
      }).join('') : '<div class="panel">لا توجد طلبات.</div>';
    });
  }

  // ---------- Admin ----------
  var TABS = { home: 'نظرة عامة', products: 'المنتجات والأسعار', colors: 'الألوان', orders: 'الطلبات', settings: 'الإعدادات والدفع' };
  function adminView() {
    if (!S.user || S.user.role !== 'admin') { location.hash = '#/'; return; }
    var tabs = '<div class="tabs">' + Object.keys(TABS).map(function (k) { return '<button class="' + (S.A.tab === k ? '' : 'g') + '" data-act="tab" data-v="' + k + '">' + TABS[k] + '</button>'; }).join('') + '</div>';
    var body = $('#abody'); if (!body) { app.innerHTML = tabs + '<div id="abody"></div>'; body = $('#abody'); } else $('.tabs').outerHTML = tabs;
    ({ home: aHome, products: aProducts, colors: aColors, orders: aOrders, settings: aSettings }[S.A.tab])(body);
  }
  function aHome(b) {
    api('/admin/stats').then(function (s) {
      b.innerHTML = '<div class="panel kpi"><div>مبيعات اليوم<b>' + egp(s.today) + '</b></div><div>مبيعات الشهر<b>' + egp(s.month) + '</b></div><div>طلبات جديدة<b>' + s.newOrders + '</b></div><div>تحويلات للمراجعة<b>' + s.review + '</b></div></div>' +
        '<div class="panel"><h3>مخزون منخفض</h3>' + (s.low.length ? s.low.map(function (p) { return '<div class="it"><span>' + esc(p.name) + '</span><b>' + p.stock + '</b></div>'; }).join('') : '<span class="mut">لا يوجد.</span>') + '</div>';
    });
  }
  function aProducts(b) {
    api('/products').then(function (ps) {
      S.products = ps; var e = S.edit && prod(S.edit) || {};
      var f = function (n, l, t, v, x) { return '<div><label>' + l + '</label><input name="' + n + '" type="' + (t || 'text') + '" ' + (x || '') + ' value="' + esc(v == null ? '' : v) + '"></div>'; };
      b.innerHTML = '<form class="panel" id="pf"><h3>' + (e.id ? 'تعديل منتج' : 'إضافة منتج') + '</h3><div class="row">' + f('name', 'الاسم', '', e.name, 'required') + f('name_en', 'الاسم بالإنجليزية', '', e.name_en) + f('category', 'القسم', '', e.category, 'required') + f('unit', 'الوحدة (علبة/كيلو/شلة)', '', e.unit) + '</div><div class="row">' +
        f('p_retail', 'سعر القطاعي ج.م', 'number', e.p_retail ? e.p_retail / 100 : '', 'required step="0.01" min="0.01"') + f('p_half', 'نصف جملة', 'number', e.p_half ? e.p_half / 100 : '', 'step="0.01" min="0.01"') + f('p_whole', 'جملة', 'number', e.p_whole ? e.p_whole / 100 : '', 'step="0.01" min="0.01"') + f('stock', 'المخزون (فارغ = غير محدود)', 'number', e.stock, 'min="0"') + '</div><div class="row">' + f('description', 'الوصف', '', e.description) + f('sort', 'الترتيب', 'number', e.sort || 0) + '</div>' +
        '<label><input type="checkbox" name="has_colors" style="width:auto" ' + (e.has_colors ? 'checked' : '') + '> للمنتج ألوان (يختار العميل اللون)</label><div class="row"><div><label>صورة المنتج</label><input type="file" accept="image/*" data-act="imgfile" data-t="product"></div><div class="img" id="ip" style="max-width:120px;background-image:url(\'' + esc(S.img || e.image_url || '') + '\')"></div></div><p id="m"></p><button>حفظ</button> ' + (e.id ? '<button type="button" class="g" data-act="canceledit">إلغاء</button>' : '') + '</form>' +
        '<div class="panel"><h3>تعديل الأسعار بنسبة</h3><div class="row"><input id="pct" type="number" step="0.5" placeholder="مثال: 10 للزيادة أو -5 للتخفيض"><button data-act="bump">تطبيق على كل المنتجات</button></div><p class="mut">تُقرَّب الأسعار لأقرب جنيه.</p></div>' +
        '<div class="panel scroll"><h3>المنتجات (عدّل السعر مباشرة)</h3><table><tr><th>المنتج</th><th>قطاعي</th><th>نصف جملة</th><th>جملة</th><th>مخزون</th><th></th></tr>' + ps.map(function (p) {
          var pi = function (k) { return '<td><input class="price-in" type="number" step="0.01" min="0.01" data-price="' + p.id + '" data-k="' + k + '" value="' + p[k] / 100 + '"></td>'; };
          return '<tr><td>' + esc(p.name) + '</td>' + pi('p_retail') + pi('p_half') + pi('p_whole') + '<td>' + (p.stock == null ? '∞' : p.stock) + '</td><td><button class="g sm" data-act="edit" data-id="' + p.id + '">تعديل</button> <button class="g sm" data-act="del" data-id="' + p.id + '">حذف</button></td></tr>';
        }).join('') + '</table></div>';
    });
  }
  function aColors(b) {
    api('/colors').then(function (cs) {
      S.colors = cs;
      b.innerHTML = '<form class="panel" id="cf"><h3>استيراد / تحديث الألوان</h3><p class="mut">سطر لكل لون: <b>الكود , الاسم , #لون</b> — مثال: 205, أزرق ملكي, #1f3a93. الكود الموجود يتم تحديثه.</p><textarea name="text" style="min-height:140px;direction:ltr" placeholder="205,أزرق ملكي,#1f3a93"></textarea><p id="m"></p><button>استيراد</button></form>' +
        '<div class="panel"><h3>الألوان (' + cs.length + ')</h3><div class="sw" style="max-height:none">' + cs.map(function (c) { return '<div class="s"><i style="background:' + esc(c.hex) + '"></i>' + esc(c.code) + '<br>' + esc(c.name) + '<br><button class="g sm" data-act="delcolor" data-id="' + c.id + '">حذف</button></div>'; }).join('') + '</div></div>';
    });
  }
  function aOrders(b) {
    api('/admin/orders').then(function (os) {
      var sel = function (obj, cur, id, k) { return '<select data-ostat="' + id + '" data-k="' + k + '">' + Object.keys(obj).map(function (x) { return '<option value="' + x + '"' + (x === cur ? ' selected' : '') + '>' + obj[x] + '</option>'; }).join('') + '</select>'; };
      b.innerHTML = '<div class="panel scroll"><h3>الطلبات</h3><table><tr><th>#</th><th>العميل</th><th>الأصناف</th><th>الإجمالي</th><th>الدفع</th><th>الحالة</th></tr>' + os.map(function (o) {
        return '<tr><td>' + o.id + '</td><td>' + esc(o.name) + '<br><span class="mut">' + esc(o.phone) + '<br>' + esc(o.address) + (o.note ? '<br>📝 ' + esc(o.note) : '') + '</span></td><td>' + o.items.map(function (i) { return esc(i.name) + (i.color ? ' [' + esc(i.color) + ']' : '') + ' ×' + i.qty; }).join('<br>') + '</td><td>' + egp(o.total_cents) + '</td><td>' + PM[o.payment_method] + '<br>' + sel(PS, o.payment_status, o.id, 'payment_status') + (o.payment_ref ? '<br><span class="mut">مرجع: ' + esc(o.payment_ref) + '</span>' : '') + '</td><td>' + sel(ST, o.status, o.id, 'status') + '</td></tr>';
      }).join('') + '</table></div>';
    });
  }
  function aSettings(b) {
    api('/admin/settings').then(function (s) {
      S.qr = s.instapay_qr; var f = function (n, l, t) { return '<div><label>' + l + '</label><input name="' + n + '" type="' + (t || 'text') + '" value="' + esc(s[n]) + '"></div>'; };
      b.innerHTML = '<form class="panel" id="sf"><h3>إعدادات المتجر</h3><div class="row">' + f('shop_name', 'اسم المتجر') + f('half_min', 'بداية نصف الجملة (وحدة)', 'number') + f('whole_min', 'بداية الجملة (وحدة)', 'number') + '</div>' + f('shipping_note', 'ملاحظة الشحن') +
        '<h3>الدفع</h3><div class="row">' + f('wallet_number', 'رقم المحفظة الإلكترونية') + f('wallet_name', 'اسم صاحب المحفظة') + '</div><div class="row">' + f('instapay_number', 'رقم إنستا باي') + f('instapay_handle', 'عنوان إنستا باي (name@instapay)') + '</div><div class="row"><div><label>QR إنستا باي (صورة)</label><input type="file" accept="image/*" data-act="imgfile" data-t="qr"></div><img id="qrp" class="qr" style="max-width:120px;' + (s.instapay_qr ? '' : 'display:none') + '" src="' + esc(s.instapay_qr) + '"></div><p id="m"></p><button>حفظ الإعدادات</button></form>';
    });
  }

  function route() {
    var r = location.hash.replace('#/', '').split('?')[0];
    $('#modal').hidden = true;
    ({ '': shop, cart: cart, login: function () { login(false); }, register: function () { login(true); }, orders: orders, admin: adminView }[r] || shop)();
    window.scrollTo(0, 0);
  }
  function img(file, cb) {
    var r = new FileReader(); r.onload = function () { var i = new Image(); i.onload = function () {
      var m = 640, k = Math.min(1, m / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = i.width * k; c.height = i.height * k;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.8)); }; i.src = r.result; }; r.readAsDataURL(file);
  }

  // ---------- Events ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t || t.tagName === 'INPUT') return;
    var a = t.dataset.act, id = t.dataset.id, k = t.dataset.k;
    if (a === 'logout') logout();
    else if (a === 'cat') { S.cat = t.dataset.v; shop(); }
    else if (a === 'open') openProduct(id);
    else if (a === 'close') $('#modal').hidden = true;
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
    else if (a === 'edit') { S.edit = Number(id); S.img = ''; aProducts($('#abody')); window.scrollTo(0, 0); }
    else if (a === 'canceledit') { S.edit = null; S.img = ''; aProducts($('#abody')); }
    else if (a === 'del' && confirm('حذف المنتج؟')) api('/admin/products/' + id, { method: 'DELETE' }).then(function () { aProducts($('#abody')); });
    else if (a === 'delcolor') api('/admin/colors/' + id, { method: 'DELETE' }).then(function () { aColors($('#abody')); });
    else if (a === 'bump') { var p = Number($('#pct').value); if (p && confirm('تغيير كل الأسعار بنسبة ' + p + '% ؟')) api('/admin/prices/bump', { method: 'POST', body: { percent: p } }).then(function () { toast('تم تعديل الأسعار'); aProducts($('#abody')); }).catch(function (x) { toast(x.message); }); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, a = t.dataset.act;
    if (a === 'mset') setSel(t.dataset.k, t.value);
    else if (a === 'cset') { var n = parseInt(t.value, 10) || 0; if (n > 0) S.cart[t.dataset.k] = n; else delete S.cart[t.dataset.k]; saveCart(); cart(); }
    else if (a === 'imgfile' && t.files[0]) img(t.files[0], function (d) {
      if (d.length > 390000) return toast('الصورة كبيرة، اختر أصغر');
      if (t.dataset.t === 'qr') { S.qr = d; $('#qrp').src = d; $('#qrp').style.display = 'block'; } else { S.img = d; $('#ip').style.backgroundImage = "url('" + d + "')"; }
    });
    else if (t.dataset.price) { var row = t.closest('tr'), body = {}; row.querySelectorAll('[data-price]').forEach(function (i) { body[i.dataset.k] = i.value; });
      api('/admin/products/' + t.dataset.price + '/prices', { method: 'PATCH', body: body }).then(function () { toast('تم حفظ السعر ✓'); }).catch(function (x) { toast(x.message); }); }
    else if (t.dataset.ostat) { var b = {}; b[t.dataset.k] = t.value; api('/admin/orders/' + t.dataset.ostat, { method: 'PATCH', body: b }).then(function () { toast('تم التحديث ✓'); }).catch(function (x) { toast(x.message); }); }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'cq') { M.q = e.target.value; mColors(); } });
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, d = Object.fromEntries(new FormData(f)), btn = f.querySelector('button'); if (btn) btn.disabled = true;
    var again = function () { if (btn) btn.disabled = false; }, bad = function (x) { msg(x.message); again(); };
    if (f.id === 'au') api('/auth/' + (f.dataset.reg === '1' ? 'register' : 'login'), { method: 'POST', body: d }).then(function (r) {
      S.token = r.token; S.user = r.user; localStorage.setItem('token', r.token); nav(); location.hash = '#/'; }).catch(bad);
    else if (f.id === 'co') api('/orders', { method: 'POST', body: { name: d.name, phone: d.phone, address: d.address, note: d.note, payment: d.payment,
      items: Object.keys(S.cart).map(function (k) { var a = k.split(':'); return { id: Number(a[0]), color: Number(a[1]), qty: S.cart[k] }; }) } }).then(function (r) { S.cart = {}; saveCart(); done(r); }).catch(bad);
    else if (f.dataset.proof) api('/orders/' + f.dataset.proof + '/proof', { method: 'POST', body: { ref: d.ref } }).then(function () { toast('تم إرسال بيانات التحويل ✓'); route(); }).catch(function (x) { var m = $('#m' + f.dataset.proof); if (m) { m.className = 'err'; m.textContent = x.message; } again(); });
    else if (f.id === 'pf') { d.has_colors = f.has_colors.checked; d.image_url = S.img || (prod(S.edit) || {}).image_url || '';
      api(S.edit ? '/admin/products/' + S.edit : '/admin/products', { method: S.edit ? 'PUT' : 'POST', body: d }).then(function () { S.edit = null; S.img = ''; toast('تم الحفظ ✓'); aProducts($('#abody')); }).catch(bad); }
    else if (f.id === 'cf') api('/admin/colors/bulk', { method: 'POST', body: d }).then(function (r) { toast('تم استيراد ' + r.imported + ' لون'); aColors($('#abody')); }).catch(bad);
    else if (f.id === 'sf') { d.instapay_qr = S.qr || ''; api('/admin/settings', { method: 'PUT', body: d }).then(function () { toast('تم الحفظ ✓'); api('/config').then(function (c) { S.cfg = c; }); again(); }).catch(bad); }
  });
  $('#q').addEventListener('input', function () { if (location.hash && location.hash !== '#/') location.hash = '#/'; else shop(); });
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') e.target.hidden = true; });
  window.addEventListener('hashchange', route);

  Promise.all([
    api('/config').then(function (c) { S.cfg = c; $('#shopname').textContent = c.shop; document.title = c.shop + ' — متجر الجملة والقطاعي'; }),
    api('/products').then(function (p) { S.products = p; }), api('/colors').then(function (c) { S.colors = c; }),
    S.token ? api('/me').then(function (r) { S.user = r.user; }).catch(function () {}) : 0
  ]).then(function () { nav(); route(); }).catch(function (e) { app.textContent = 'تعذر تحميل المتجر: ' + e.message; });
})();
