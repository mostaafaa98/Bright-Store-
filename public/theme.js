(function () {
  var d = document.documentElement, q = location.search.match(/[?&]theme=(dark|light)/), l = location.search.match(/[?&]lang=(ar|en)/);
  try {
    if (q) localStorage.setItem('theme', q[1]);
    if (l) localStorage.setItem('lang', l[1]);
    var t = localStorage.getItem('theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var g = localStorage.getItem('lang') || 'ar';
    d.setAttribute('data-theme', t); d.lang = g; d.dir = g === 'en' ? 'ltr' : 'rtl';
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#12141b' : '#faf8f5';
  } catch (e) {}
})();
