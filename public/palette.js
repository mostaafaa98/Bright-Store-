(function () {
  var ICO = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/></svg>';
  var en = (localStorage.getItem('lang') || 'ar') === 'en', KEY = 'palette', MAX = 4;
  var T = en ? { title: 'Your color palette', hint: 'Tap the palette icon on any color to add it here (up to 4).', empty: 'No colors yet. Pick 3-4 colors that go together.', addAll: 'Add all to cart', added: 'Added to cart', cart: 'Go to cart', clear: 'Clear', full: 'The palette holds up to 4 colors', pill: 'Palette', inP: 'In palette', addP: 'Add to palette', rm: 'Remove', qty: 'Quantity', cap: 'More than available for this color', oosP: 'Unavailable now, removed from the palette',
      mTitle: 'This color is unavailable', mSub: 'Closest colors in stock', mMatch: 'match', mAdd: 'Add', mNone: 'No close color in stock right now.', mNoRef: 'We have no photo of this color yet, so we cannot suggest a match.', mNotify: 'Notify me when it is back', mName: 'Your name', mPhone: 'Mobile number', mSend: 'Notify me', mOk: 'Saved. Our team will contact you on this number when it is back.', mBad: 'Check your name and mobile number', mErr: 'Connection problem, try again', mHave: 'Already saved for this number', mAvail: 'This color is back in stock now.', line: 'same line', miss: 'Unavailable: alternatives / notify me' }
    : { title: 'لوحة ألوانك', hint: 'اضغط أيقونة اللوحة على أي لون عشان تضيفه هنا (لحد ٤ ألوان).', empty: 'لسه مفيش ألوان. اختار ٣ أو ٤ ألوان متناسقة.', addAll: 'أضف الكل للسلة', added: 'تمت الإضافة للسلة', cart: 'اذهب للسلة', clear: 'مسح', full: 'اللوحة بتشيل لحد ٤ ألوان', pill: 'لوحة الألوان', inP: 'في اللوحة', addP: 'أضف للوحة', rm: 'حذف', qty: 'الكمية', cap: 'الكمية أكبر من المتاح لهذا اللون', oosP: 'لون غير متوفر حالياً، تم حذفه من اللوحة',
      mTitle: 'اللون ده غير متوفر', mSub: 'أقرب ألوان متوفرة', mMatch: 'تطابق', mAdd: 'أضف', mNone: 'مفيش لون قريب متوفر حالياً.', mNoRef: 'لسه معندناش صورة للون ده، فمش هنقدر نقترح بديل مطابق.', mNotify: 'ابلغني لما يرجع', mName: 'اسمك', mPhone: 'رقم الموبايل', mSend: 'ابلغني', mOk: 'تم الحفظ. فريقنا هيتواصل معاك على الرقم ده لما اللون يرجع.', mBad: 'راجع الاسم ورقم الموبايل', mErr: 'مشكلة في الاتصال، حاول تاني', mHave: 'الطلب محفوظ بالفعل على الرقم ده', mAvail: 'اللون ده رجع متوفر دلوقتي.', line: 'نفس الخط', miss: 'غير متوفر: بدائل / ابلغني' };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function D() { return window.BRdata ? window.BRdata() : { products: [], colors: [] }; }
  function col(id) { return D().colors.filter(function (c) { return c.id === Number(id); })[0]; }
  function prod(id) { return D().products.filter(function (p) { return p.id === Number(id); })[0]; }
  function cap(p, c) { return c && c.mx != null && p && (p.unit !== 'كيلو' || c.line === 'linen') ? c.mx : null; }
  function toast(t) { var e = document.getElementById('toast'); if (!e) return; e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, 2400); }
  function load() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function save(a) { localStorage.setItem(KEY, JSON.stringify(a)); sync(); }
  function idx(a, p, c) { for (var i = 0; i < a.length; i++) if (a[i].p === p && a[i].c === c) return i; return -1; }
  function has(p, c) { return idx(load(), Number(p), Number(c)) > -1; }
  function bgOf(c) { return 'background:' + (c ? c.hex : '#ccc') + (c && c.t ? ' url(' + c.t + ') center/cover' : ''); }
  function refresh() { if (window.BRrefresh) window.BRrefresh(); document.querySelectorAll('[data-pal]').forEach(function (b) { var ids = b.dataset.pal.split(':'), on = has(ids[0], ids[1]); b.classList.toggle('on', on); if (b.classList.contains('pl-add')) b.innerHTML = ICO + ' ' + (on ? T.inP : T.addP); }); }
  function toggle(p, c) {
    p = Number(p); c = Number(c); var a = load(), i = idx(a, p, c), cc = col(c);
    if (i > -1) a.splice(i, 1);
    else { if (cc && cc.oos) return; if (a.length >= MAX) { toast(T.full); return; } a.push({ p: p, c: c, q: 1 }); }
    save(a); refresh(); if (!root.hidden) render();
  }

  // ---------- pill ----------
  var pill = document.createElement('button'); pill.type = 'button'; pill.className = 'pl-pill'; pill.hidden = true; pill.setAttribute('aria-label', T.pill);
  document.body.appendChild(pill);
  function sync() {
    var a = load().filter(function (x) { return col(x.c); });
    pill.innerHTML = ICO + '<span class="pl-dots">' + a.map(function (x) { return '<i style="' + esc(bgOf(col(x.c))) + '"></i>'; }).join('') + '</span><b>' + a.length + '</b>';
    pill.hidden = !a.length || /^#\/(admin|login|register|cart)/.test(location.hash) || !root.hidden;
  }
  window.addEventListener('hashchange', sync);
  pill.onclick = function () { open(); };

  // ---------- palette sheet ----------
  var root = document.createElement('div'); root.className = 'cm pl'; root.hidden = true; root.setAttribute('role', 'dialog');
  root.innerHTML = '<div class="cm-in pl-in"><div class="cm-h"><b>' + ICO + ' ' + T.title + '</b><button type="button" class="cm-x" aria-label="close">✕</button></div><div class="cm-b" id="plb"></div></div>';
  document.body.appendChild(root);
  var body = root.querySelector('#plb');
  function open() { render(); root.hidden = false; document.documentElement.classList.add('lock'); sync(); }
  function closeP() { root.hidden = true; if (mroot.hidden) document.documentElement.classList.remove('lock'); sync(); }
  root.querySelector('.cm-x').onclick = closeP;
  root.addEventListener('click', function (e) { if (e.target === root) closeP(); });
  function clean() {
    var a = load(), out = a.filter(function (x) { var c = col(x.c); return c && prod(x.p) && !c.oos; });
    if (out.length !== a.length && D().colors.length) { save(out); toast(T.oosP); }
    return out;
  }
  function render() {
    var a = D().colors.length ? clean() : load();
    if (!a.length) { body.innerHTML = '<p class="pl-empty">' + T.empty + '</p><p class="cm-hint">' + T.hint + '</p>'; return; }
    body.innerHTML = '<div class="pl-strip">' + a.map(function (x) { var c = col(x.c); return '<div class="pl-tile" style="' + esc(bgOf(c)) + '"><span>' + esc(c.code) + '</span></div>'; }).join('') + '</div>' +
      '<div class="pl-list">' + a.map(function (x, i) {
        var c = col(x.c), p = prod(x.p), m = cap(p, c);
        return '<div class="pl-row"><i class="pl-sw" style="' + esc(bgOf(c)) + '"></i><div class="pl-nm"><b>' + esc(c.code) + '</b><span>' + esc(p.name) + '</span></div><div class="pl-q"><button type="button" data-q="-1" data-i="' + i + '" aria-label="-">−</button><b>' + x.q + '</b><button type="button" data-q="1" data-i="' + i + '" aria-label="+"' + (m != null && x.q >= m ? ' disabled' : '') + '>+</button></div><button type="button" class="pl-rm" data-rm="' + i + '" aria-label="' + T.rm + '">✕</button></div>';
      }).join('') + '</div>' +
      '<div class="pl-act"><button type="button" class="pl-go" id="plgo">' + T.addAll + ' (' + a.length + ')</button><button type="button" class="pl-clr" id="plclr">' + T.clear + '</button></div><p class="cm-hint">' + T.hint + '</p>';
  }
  body.addEventListener('click', function (e) {
    var a = load(), t = e.target.closest('button'); if (!t) return;
    if (t.dataset.q) { var x = a[Number(t.dataset.i)]; if (!x) return; var m = cap(prod(x.p), col(x.c)), n = x.q + Number(t.dataset.q); if (m != null && n > m) { toast(T.cap); n = m; } x.q = Math.max(1, n); save(a); render(); }
    else if (t.dataset.rm) { a.splice(Number(t.dataset.rm), 1); save(a); refresh(); render(); }
    else if (t.id === 'plclr') { save([]); refresh(); render(); }
    else if (t.id === 'plgo' && window.BRadd) {
      clean().forEach(function (x) { window.BRadd(x.p, x.c, x.q); });
      body.innerHTML = '<p class="pl-empty">✓ ' + T.added + '</p><div class="pl-act"><button type="button" class="pl-go" id="plcart">' + T.cart + '</button><button type="button" class="pl-clr" id="plclr2">' + T.clear + '</button></div>';
    }
    else if (t.id === 'plcart') { closeP(); location.hash = '#/cart'; }
    else if (t.id === 'plclr2') { save([]); refresh(); closeP(); }
  });

  // ---------- missing color sheet ----------
  var mroot = document.createElement('div'); mroot.className = 'cm pl ms'; mroot.hidden = true; mroot.setAttribute('role', 'dialog');
  mroot.innerHTML = '<div class="cm-in pl-in"><div class="cm-h"><b>' + T.mTitle + '</b><button type="button" class="cm-x" aria-label="close">✕</button></div><div class="cm-b" id="mlb"></div></div>';
  document.body.appendChild(mroot);
  var mb = mroot.querySelector('#mlb'), cur = null;
  function closeM() { mroot.hidden = true; if (root.hidden) document.documentElement.classList.remove('lock'); }
  mroot.querySelector('.cm-x').onclick = closeM;
  mroot.addEventListener('click', function (e) { if (e.target === mroot) closeM(); });
  function alts(pid, c) {
    var d = D(), lab = c.t && window.BRcolor && window.BRcolor.lab(c.hex), P = prod(pid), out = [];
    if (!lab) return out;
    var ids = P && P.color_ids && P.color_ids.length ? P.color_ids : d.colors.map(function (x) { return x.id; });
    ids.forEach(function (id) {
      var k = col(id); if (!k || k.oos || !k.t || k.id === c.id) return; var l = window.BRcolor.lab(k.hex); if (!l) return;
      var pp = P && P.color_ids && P.color_ids.indexOf(k.id) > -1 ? P : d.products.filter(function (q) { return (q.color_ids || []).indexOf(k.id) > -1; })[0]; if (!pp) return;
      out.push({ c: k, p: pp, d: window.BRcolor.de00(lab, l), same: k.line === c.line });
    });
    out.sort(function (a, b) { return (b.same - a.same) || (a.d - b.d); });
    var seen = {}; return out.filter(function (o) { var k = String(o.c.code).toUpperCase() + o.p.id; if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 4);
  }
  function openMiss(pid, cid) {
    var c = col(cid), p = prod(pid); if (!c) return; cur = { p: Number(pid) || null, c: c.id };
    var al = alts(pid, c), ct = {}; try { ct = JSON.parse(localStorage.getItem('notify_contact') || '{}'); } catch (e) {}
    mb.innerHTML = '<div class="pl-miss"><i class="pl-sw big" style="' + esc(bgOf(c)) + '"></i><div><b>' + esc(c.code) + '</b><span>' + (p ? esc(p.name) : '') + '</span></div></div>' +
      '<div class="cm-t">' + T.mSub + '</div>' + (al.length ? al.map(function (o) {
        return '<div class="pl-row"><i class="pl-sw" style="' + esc(bgOf(o.c)) + '"></i><div class="pl-nm"><b>' + esc(o.c.code) + '</b><span>' + Math.max(0, Math.round(100 - o.d * 2.2)) + '% ' + T.mMatch + (o.same ? ' · ' + T.line : '') + '</span></div><button type="button" class="pl-mini" data-malt="' + o.p.id + ':' + o.c.id + '">' + T.mAdd + '</button><button type="button" class="pl-mini ghost" data-pal="' + o.p.id + ':' + o.c.id + '" aria-label="' + T.addP + '">' + ICO + '</button></div>';
      }).join('') : '<p class="cm-hint">' + (c.t ? T.mNone : T.mNoRef) + '</p>') +
      '<div class="cm-t">' + T.mNotify + '</div><form id="mnf" class="pl-form" novalidate><input name="name" autocomplete="name" maxlength="60" placeholder="' + T.mName + '" value="' + esc(ct.name || '') + '"><input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" dir="ltr" placeholder="' + T.mPhone + '" value="' + esc(ct.phone || '') + '"><button type="submit" class="pl-go">' + T.mSend + '</button><p class="pl-msg" id="mnm" role="status"></p></form>';
    mroot.hidden = false; document.documentElement.classList.add('lock'); refresh();
  }
  mb.addEventListener('click', function (e) {
    var b = e.target.closest('[data-malt]'); if (!b || !window.BRadd) return; var ids = b.dataset.malt.split(':');
    window.BRadd(Number(ids[0]), Number(ids[1]), 1); b.textContent = '✓'; b.classList.add('done'); setTimeout(function () { b.textContent = T.mAdd; b.classList.remove('done'); }, 1500);
  });
  mb.addEventListener('submit', function (e) {
    e.preventDefault(); e.stopPropagation(); var f = e.target, m = mb.querySelector('#mnm'), n = f.name.value.trim(), ph = f.phone.value.trim();
    m.className = 'pl-msg'; if (n.length < 2 || !/^\+?\d{8,15}$/.test(ph.replace(/[\s\-()]/g, ''))) { m.textContent = T.mBad; m.classList.add('bad'); return; }
    var btn = f.querySelector('button'); btn.disabled = true;
    fetch('/api/color-alerts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n, phone: ph, color: cur.c, product: cur.p }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || T.mErr); return j; }); })
      .then(function (j) { localStorage.setItem('notify_contact', JSON.stringify({ name: n, phone: ph })); m.textContent = j.available ? T.mAvail : T.mOk; m.classList.add('ok'); })
      .catch(function (x) { m.textContent = x.message || T.mErr; m.classList.add('bad'); btn.disabled = false; });
  });
  window.addEventListener('popstate', function () { if (!root.hidden) closeP(); if (!mroot.hidden) closeM(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!mroot.hidden) closeM(); else if (!root.hidden) closeP(); } });

  // ---------- global hooks ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-pal]'); if (t) { e.preventDefault(); e.stopPropagation(); var ids = t.dataset.pal.split(':'); toggle(ids[0], ids[1]); return; }
    t = e.target.closest && e.target.closest('[data-miss]'); if (t) { e.preventDefault(); e.stopPropagation(); var m = t.dataset.miss.split(':'); openMiss(m[0], m[1]); }
  }, true);
  window.BRico = ICO;
  window.BRpal = { has: has, toggle: toggle, open: open };
  window.BRmiss = { open: openMiss, T: T };
  sync(); setTimeout(function () { sync(); refresh(); }, 1500);
})();
