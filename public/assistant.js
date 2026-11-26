(function () {
  var en = (localStorage.getItem('lang') || 'ar') === 'en';
  var T = en ? { t: 'Bright assistant', sub: 'Ask about products, colors, prices, shipping', ph: 'Type your question...', hi: 'Hi 👋 I can help with products, color codes, prices, shipping and payment. Replies are in Arabic.', wa: 'Talk to our team on WhatsApp', err: 'Connection problem, try again.', aria: 'Open assistant', sug: ['Light crochet thread', 'Shipping & payment', 'Wholesale prices'] }
    : { t: 'مساعد برايت', sub: 'اسألني عن المنتجات والألوان والأسعار والشحن', ph: 'اكتب سؤالك...', hi: 'أهلاً بيك 👋 أنا مساعد برايت. اسألني عن المنتجات أو كود لون أو الأسعار أو الشحن والدفع، وأنا أرد عليك فوراً.', wa: 'كلّم فريقنا على واتساب', err: 'حصلت مشكلة في الاتصال، جرّب تاني.', aria: 'افتح المساعد', sug: ['عايز خيط كروشيه', 'الشحن والدفع', 'أسعار الجملة'] };
  var hist = [], busy = false, prods = {};
  var btn = document.createElement('button'); btn.className = 'ai-fab'; btn.setAttribute('aria-label', T.aria);
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>';
  var box = document.createElement('div'); box.className = 'ai-box'; box.hidden = true; box.setAttribute('role', 'dialog');
  box.innerHTML = '<div class="ai-h"><div><b>' + T.t + '</b><small>' + T.sub + '</small></div><button class="ai-x" aria-label="close">✕</button></div><div class="ai-m" id="aim"></div><div class="ai-s" id="ais"></div><form class="ai-f" id="aif"><input id="aii" autocomplete="off" maxlength="300" placeholder="' + T.ph + '"><button aria-label="send">➤</button></form>';
  document.body.appendChild(btn); document.body.appendChild(box);
  var m = box.querySelector('#aim'), inp = box.querySelector('#aii');
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function add(role, html) { var d = document.createElement('div'); d.className = 'ai-b ' + role; d.innerHTML = html; m.appendChild(d); m.scrollTop = m.scrollHeight; return d; }
  function toggle(o) {
    box.hidden = !o; btn.classList.toggle('on', o); document.documentElement.classList.toggle('aiopen', o);
    if (o) { if (!m.children.length) { add('bot', esc(T.hi)); sug(); } setTimeout(function () { inp.focus(); }, 250); }
  }
  function sug() { var s = box.querySelector('#ais'); s.innerHTML = T.sug.map(function (x) { return '<button type="button">' + esc(x) + '</button>'; }).join(''); }
  box.querySelector('#ais').addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') send(e.target.textContent); });
  btn.onclick = function () { toggle(box.hidden); };
  box.querySelector('.ai-x').onclick = function () { toggle(false); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) toggle(false); });
  m.addEventListener('click', function (e) {
    var c = e.target.closest('[data-pid]'); if (!c) return;
    toggle(false); var fake = document.createElement('i'); fake.dataset.act = 'open'; fake.dataset.id = c.dataset.pid; fake.style.display = 'none'; document.body.appendChild(fake); fake.click(); fake.remove();
  });
  function send(t) {
    t = (t || '').trim(); if (!t || busy) return; busy = true; box.querySelector('#ais').innerHTML = '';
    add('me', esc(t)); hist.push({ role: 'user', content: t }); inp.value = '';
    var w = add('bot', '<span class="ai-dots"><i></i><i></i><i></i></span>');
    fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: hist }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || T.err); return j; }); })
      .then(function (j) {
        hist.push({ role: 'assistant', content: j.reply });
        var h = esc(j.reply).replace(/\n/g, '<br>');
        if (j.products && j.products.length) { var P = (window.BR && window.BR.products) || []; h += '<div class="ai-p">' + j.products.map(function (id) { var p = P.filter(function (x) { return x.id === id; })[0]; return p ? '<button type="button" data-pid="' + id + '">' + esc(p.name) + '</button>' : ''; }).join('') + '</div>'; }
        if (j.handoff && j.wa) h += '<a class="ai-wa" target="_blank" rel="noopener" href="' + esc(j.wa) + '">' + T.wa + '</a>';
        w.innerHTML = h; m.scrollTop = m.scrollHeight;
      }).catch(function (x) { w.textContent = x.message || T.err; hist.pop(); })
      .then(function () { busy = false; });
  }
  box.querySelector('#aif').addEventListener('submit', function (e) { e.preventDefault(); e.stopPropagation(); send(inp.value); });
  function vis() { btn.hidden = /^#\/admin/.test(location.hash); if (btn.hidden) toggle(false); }
  window.addEventListener('hashchange', vis); vis();
})();
