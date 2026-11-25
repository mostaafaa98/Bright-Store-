/* Storefront English translation layer. Arabic is the source language; the admin area stays Arabic. */
(function () {
  if (document.documentElement.lang !== 'en') return;
  var D = {
    'تخطَّ إلى المحتوى': 'Skip to content', 'برايت للخيوط': 'Bright Threads', 'بحث': 'Search',
    'ابحث عن منتج: كوتن بارليه، كروشيه، مكرمية…': 'Search products: pearl cotton, crochet, macrame…',
    'برايت للخيوط — متجر الجملة والقطاعي': 'Bright Threads — wholesale & retail store',
    'طلباتي': 'My orders', 'دخول': 'Sign in', 'خروج': 'Sign out', 'لوحة التحكم': 'Dashboard', 'السلة': 'Cart',
    'خيوط قطن مصري، بمئات الألوان': 'Egyptian cotton thread, in hundreds of colors',
    'كوتن بارليه وكروشيه ومالونيه ومكرمية وخيوط حياكة من مصنع برايت. اطلب بالقطعة أو بالجملة، ويتحدد السعر تلقائياً حسب كمية طلبك.': 'Pearl cotton, crochet yarn, embroidery floss, macrame and sewing thread from the Bright factory. Order by the piece or in bulk, and the price adjusts automatically to your quantity.',
    'تصفّح المنتجات': 'Browse products', 'تسوّق بحسب اللون': 'Shop by color',
    'قطن مصري 100%': '100% Egyptian cotton', 'محرر لنعومة ولمعان': 'Gassed for softness and sheen',
    'ألوان ثابتة': 'Colorfast dyes', 'صبغات أوروبية عالية الجودة': 'High-quality European dyes',
    'سعر الجملة تلقائياً': 'Automatic wholesale pricing', 'شحن لكل المحافظات': 'Shipping to all governorates', 'التكلفة تظهر قبل التأكيد': 'Cost shown before you confirm',
    'المنتجات': 'Products', 'الكل': 'All', 'إلغاء': 'Cancel', 'كتالوج': 'Catalog',
    'اختر لوناً لتعرف أي المنتجات متوفرة به': 'Pick a color to see which products come in it',
    'لا توجد منتجات مطابقة': 'No matching products', 'جرّب كلمة بحث أخرى أو امسح الفلاتر.': 'Try another search or clear the filters.',
    'كوتن بارليه': 'Pearl cotton', 'تطريز': 'Embroidery', 'كروشيه': 'Crochet', 'أكريليك': 'Acrylic', 'كتان': 'Linen', 'مكرمية': 'Macrame', 'سلسلة': 'Chain', 'خيوط حياكة': 'Sewing thread',
    'قطاعي': 'Retail', 'نصف جملة': 'Half-wholesale', 'جملة': 'Wholesale', 'مجاني': 'Free', 'ملغي': 'Cancelled',
    'علبة': 'box', 'كيلو': 'kg', 'شلة': 'skein', 'بكرة': 'spool', 'كون': 'cone', 'وحدة': 'unit',
    'أضف إلى السلة': 'Add to cart', 'اختر لوناً وكمية': 'Pick a color and quantity', 'حدّد الكمية': 'Set the quantity', 'اختر اللون والكمية': 'Pick a color and quantity', 'اختر الكمية': 'Pick a quantity',
    'اختر الألوان (اضغط على اللون لتكبير الصورة وإضافته)': 'Choose colors (tap a color to enlarge the photo and add it)',
    'ابحث باسم اللون أو رقمه…': 'Search by color code…', 'لا توجد ألوان مطابقة.': 'No matching colors.', 'لا توجد ألوان متاحة لهذا المنتج حالياً.': 'No colors are available for this product right now.',
    'المواصفات': 'Specifications', 'الوزن': 'Weight', 'عدد البكر / القطع': 'Count', 'الطول': 'Length', 'الخامة': 'Material', 'المقاس / الإبر المناسبة': 'Size / needles', 'الاستخدام': 'Use',
    'تكبير': 'Enlarge', 'إغلاق': 'Close', 'السابق': 'Previous', 'التالي': 'Next', 'إنقاص': 'Decrease', 'زيادة': 'Increase', 'الكمية': 'Quantity',
    'تمت الإضافة إلى السلة': 'Added to cart', 'الإجمالي': 'Total', 'المجموع': 'Subtotal', 'الشحن': 'Shipping', 'المنتجات ': 'Products ',
    'السلة فارغة': 'Your cart is empty', 'أضف منتجات لتبدأ طلبك.': 'Add products to start your order.', 'متابعة التسوق': 'Continue shopping', 'متابعة طلباتي': 'View my orders',
    'إتمام الطلب': 'Checkout', 'ملخص الطلب': 'Order summary', 'بيانات الشحن': 'Shipping details',
    'لا تحتاج لإنشاء حساب: اكتب بياناتك وسنراجع الطلب ونتواصل معك.': 'No account needed: enter your details and we will review the order and contact you.',
    'الاسم': 'Name', 'رقم الموبايل': 'Mobile number', 'المحافظة': 'Governorate', 'اختر المحافظة': 'Choose a governorate', 'المنطقة / الحي': 'Area / district', 'العنوان بالتفصيل': 'Full address',
    'الشارع، رقم العمارة، الدور، علامة مميزة': 'Street, building number, floor, landmark',
    'طريقة الدفع': 'Payment method', 'الدفع': 'Payment', 'عند الاستلام': 'Cash on delivery', 'محفظة إلكترونية': 'E-wallet', 'إنستا باي': 'Instapay',
    'ملاحظات': 'Notes', 'تأكيد الطلب': 'Place order', 'تم استلام طلبك': 'Order received', 'رقم الطلب': 'Order number',
    'تتبّع طلب برقمه': 'Track an order by number', 'تتبّع': 'Track', 'عرض': 'View', 'لا توجد طلبات على هذا الجهاز أو الحساب بعد.': 'No orders on this device or account yet.',
    'لا يوجد طلب بهذه البيانات': 'No order found with these details',
    'تسجيل الدخول': 'Sign in', 'إنشاء حساب': 'Create account', 'إنشاء حساب جديد': 'Create a new account', 'لدي حساب بالفعل': 'I already have an account', 'إنشاء الحساب': 'Create account',
    'البريد الإلكتروني': 'Email', 'كلمة المرور': 'Password', 'الحساب اختياري، ويمكنك الطلب كضيف.': 'An account is optional; you can order as a guest.',
    'الشراء': 'Buying', 'تواصل معنا': 'Contact us', 'تواصل مع برايت على واتساب': 'Chat with Bright on WhatsApp', 'واتساب': 'WhatsApp',
    'مصنع مصري لخيوط القطن والبوليستر: كوتن بارليه، كروشيه، تطريز، مكرمية وخيوط حياكة. نبيع بالقطعة وبالجملة.': 'An Egyptian factory for cotton and polyester thread: pearl cotton, crochet, embroidery, macrame and sewing thread. We sell by the piece and in bulk.',
    'الدفع عند الاستلام، أو بمحفظة إلكترونية، أو بإنستا باي.': 'Pay on delivery, by e-wallet, or by Instapay.',
    'بانتظار المراجعة': 'Pending review', 'قيد التجهيز': 'Being prepared', 'تم الشحن': 'Shipped', 'تم التسليم': 'Delivered', 'مدفوع': 'Paid', 'غير مدفوع': 'Unpaid',
    'تعذر التنزيل': 'Download failed', 'حدث خطأ': 'Something went wrong',
    'إزالة المنتج': 'Remove', 'لا تحتاج لإنشاء حساب. اكتب بياناتك وأكّد الطلب.': 'No account needed. Enter your details and confirm the order.', 'ملاحظات (اختياري)': 'Notes (optional)', 'الدفع عند الاستلام': 'Cash on delivery',
    'كروشيه رفيع، تطريز، دانتيل ومفارش': 'Fine crochet, embroidery, lace and doilies', 'شنط، قبعات، إكسسوارات': 'Bags, hats, accessories', 'شنط وإكسسوارات كروشيه': 'Crochet bags and accessories', 'تعليقات حائط، شنط، شباشب، ديكور': 'Wall hangings, bags, slippers, decor', 'خياطة وحياكة': 'Sewing and knitting', 'خياطة وحياكة منزلية': 'Home sewing and knitting',
    'قطاعي': 'Retail'
  };

  var GOV = {'القاهرة':'Cairo','الجيزة':'Giza','الإسكندرية':'Alexandria','القليوبية':'Qalyubia','الغربية':'Gharbia','الدقهلية':'Dakahlia','الشرقية':'Sharqia','المنوفية':'Monufia','كفر الشيخ':'Kafr El Sheikh','البحيرة':'Beheira','دمياط':'Damietta','بورسعيد':'Port Said','الإسماعيلية':'Ismailia','السويس':'Suez','الفيوم':'Fayoum','بني سويف':'Beni Suef','المنيا':'Minya','أسيوط':'Assiut','سوهاج':'Sohag','قنا':'Qena','الأقصر':'Luxor','أسوان':'Aswan','مطروح':'Matrouh','البحر الأحمر':'Red Sea','الوادي الجديد':'New Valley','شمال سيناء':'North Sinai','جنوب سيناء':'South Sinai'};
  for (var g in GOV) D[g] = GOV[g];

  var RX = [
    [/^أقل من (\d+) (.+)$/, function (m, n, u) { return 'Under ' + n + ' ' + tr(u); }], [/^من (\d+) إلى (\d+) (.+)$/, function (m, a, b, u) { return a + ' to ' + b + ' ' + tr(u); }], [/^من (\d+) فأكثر (.+)$/, function (m, n, u) { return n + '+ ' + tr(u); }],
    [/^(.+) — (\d+) (?:ج\.م|EGP)$/, function (m, g, f) { return tr(g) + ' — ' + f + ' EGP'; }], [/^(.+) \+ الشحن$/, '$1 + shipping'], [/^\(سعر (القطاعي|نصف الجملة|الجملة)\)$/, function (m, k) { return '(' + tr(k === 'القطاعي' ? 'قطاعي' : k === 'الجملة' ? 'جملة' : 'نصف جملة').toLowerCase() + ' price)'; }],
    [/^(\d+) (\S+) × (.+) \(سعر (القطاعي|نصف الجملة|الجملة)\)$/, function (m, n, u, p, k) { return n + ' ' + tr(u) + ' × ' + p + ' (' + (k === 'القطاعي' ? 'retail' : k === 'الجملة' ? 'wholesale' : 'half-wholesale') + ' price)'; }],
    [/^من (\d+)$/, 'From $1'], [/^من (\d+) وحدة$/, 'From $1 units'], [/^أقل من (\d+)$/, 'Under $1'], [/^(\d+) فأكثر$/, '$1 or more'], [/^(\d+) منتج$/, '$1 products'],
    [/^السلة \((\d+)\)$/, 'Cart ($1)'], [/^طلب #(\d+)$/, 'Order #$1'], [/^رقم الطلب #?(\d+)$/, 'Order number #$1'],
    [/^نصف جملة من (\d+)، جملة من (\d+)$/, 'Half-wholesale from $1, wholesale from $2'],
    [/^الكمية \((.+)\)$/, 'Quantity ($1)'],
    [/^(\d+) ([^\s×]+) × (.+)$/, function (m, n, u, p) { return n + ' ' + tr(u) + ' × ' + p; }],
    [/^أضف (\d+) (.*) لتحصل على سعر (نصف الجملة|الجملة)\s*(.*)$/, function (m, n, u, k, r) { return 'Add ' + n + ' ' + tr(u) + ' to get the ' + (k === 'الجملة' ? 'wholesale' : 'half-wholesale') + ' price ' + r; }],
    [/^ (.+) ?لتحصل على شحن مجاني$/, 'for free shipping']
  ];
  var SUF = [['لون واحد', 'single color'], ['متعدد الدرجات', 'multi-shade'], ['بالكيلو', 'per kg'], ['ألوان', 'colors'], ['أبيض', 'white'], ['خام مبروم', 'raw, twisted'], ['خام محلول', 'raw, untwisted'], ['ألوان مبروم', 'colors, twisted'], ['ألوان محلول', 'colors, untwisted'], ['خام', 'raw']];
  var TOK = [['قطن مصري طويل التيلة 100%', '100% long-staple Egyptian cotton'], ['قطن مصري 100%', '100% Egyptian cotton'], ['كتان مصري 100%', '100% Egyptian linen'], ['أكريليك 100%', '100% acrylic'], ['بوليستر مغزول 100%', '100% spun polyester'], ['بوليستر 100%', '100% polyester'],
    ['طبقتين', '2-ply'], ['أربعة طبقات', '4-ply'], ['ثلاث طبقات', '3-ply'], ['4 طبقات', '4-ply'], ['3 طبقات', '3-ply'], ['محرر مرتين', 'double gassed'], ['محرر', 'gassed'], ['بكرات في العلبة', 'spools per box'], ['بكرة في العلبة', 'spool per box'], ['بكرات', 'spools'], ['شلة في العلبة', 'skeins per box'], ['ألوان متدرجة', 'multi-shade colors'], ['ألوان ثابتة', 'colorfast'], ['مصبوغ', 'dyed'], ['خام', 'raw'], ['سعر موحد', 'One price'],
    ['إبر', 'needles'], ['مم', 'mm'], ['في العلبة', 'per box'], ['أدق من برايت الأساسية', 'finer than standard Bright'], ['أسمك درجة', 'one grade thicker'],['الشحن يُحسب حسب المحافظة قبل تأكيد الطلب.', 'Shipping is calculated by governorate before you confirm the order.'], ['100 جم للشلة (يُباع بالكيلو)', '100 g per skein (sold by the kg)'], ['يُباع بالكيلو', 'Sold by the kg'],
    ['أكثر من', 'over'], ['للبكرة', 'per spool'], ['للشلة', 'per skein'], ['جم', 'g'], ['متر', 'm'], ['لون', 'colors'], ['برايت للخيوط', 'Bright Threads'], ['/ علبة', '/ box'], ['/ شلة', '/ skein'], ['/ بكرة', '/ spool'], ['/ كيلو', '/ kg'], ['/ كون', '/ cone'], [' — سعر موحد', ' — one price'], ['سعر موحد', 'One price']];
  function lat(s) { return s.replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 1632); }); }
  function tr(s) { return D[s] || s; }
  function prodName(s) {
    var P = (window.BR && window.BR.products) || [];
    for (var i = 0; i < P.length; i++) if (P[i].name === s && P[i].name_en) {
      var parts = s.split(' - '), suf = parts.length > 1 ? parts[parts.length - 1].trim() : '';
      var e = P[i].name_en; for (var k = 0; k < SUF.length; k++) if (suf === SUF[k][0] || suf.indexOf(SUF[k][0]) === 0 && suf.length <= SUF[k][0].length) { return e + ' (' + SUF[k][1] + ')'; }
      return e;
    }
    return null;
  }
  function conv(t) {
    var s = t.replace(/\s+/g, ' ').trim(); if (!s || !/[\u0600-\u06FF]/.test(s)) return t;
    var r = D[s] || prodName(s); if (!r) { for (var i = 0; i < RX.length; i++) if (RX[i][0].test(s)) { r = s.replace(RX[i][0], RX[i][1]); break; } }
    if (!r && s.indexOf('ج.م') > -1) r = s.replace(/\s?ج\.م/, ' EGP');
    if (!r) { var m = s.match(/^(.+?) — (\d+) لون$/); if (m) r = (D[m[1]] || m[1]) + ' — ' + m[2] + ' colors'; }
    if (!r) { var x = s, ch = false; TOK.forEach(function (k) { if (x.indexOf(k[0]) > -1) { x = x.split(k[0]).join(k[1]); ch = true; } }); if (ch) r = x.replace(/\s*•\s*/g, ' • '); }
    if (r) r = lat(r).replace(/،/g, ','); else if (/[\u0660-\u0669]/.test(s) && !/[\u0621-\u064A]/.test(s)) r = lat(s);
    if (!r) return t;
    return t.replace(s, r);
  }
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'value'];
  function walk(n) {
    if (n.nodeType === 3) { var v = conv(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; return; }
    if (n.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(n.tagName)) return;
    if (n.closest && n.closest('.admin,#abody,.adm')) return;
    ATTRS.forEach(function (a) { if (n.hasAttribute && n.hasAttribute(a) && (a !== 'value' || n.tagName === 'BUTTON' || n.type === 'submit')) { var o = n.getAttribute(a), v = conv(o); if (v !== o) n.setAttribute(a, v); } });
    for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
  }
  var busy = false;
  function run(root) { if (busy) return; busy = true; try { walk(root); } finally { busy = false; } }
  document.title = conv(document.title);
  var mo = new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === 'characterData') run(m.target); else m.addedNodes.forEach(run); }); });
  function start() { run(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); var l = document.getElementById('langtxt'); if (l) l.textContent = 'عربي'; }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
