'use strict';
// مساعد المتجر: يجيب من بيانات المتجر نفسها (منتجات، ألوان، أسعار، مخزون، شحن، دفع).
// بدون مفتاح: محرك قواعد دقيق. مع GEMINI_API_KEY أو GROQ_API_KEY: نموذج ذكي مقيّد بنفس البيانات.
const norm = s => String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\s+/g, ' ').trim();
const egp = c => { const v = c / 100; return (Number.isInteger(v) ? v : v.toFixed(2)) + ' ج.م'; };

module.exports = function (db, settings) {
  let cache = null, cat = 0;
  function data() {
    if (cache && Date.now() - cat < 8000) return cache;
    return (cache = load(), cat = Date.now(), cache);
  }
  function load() {
    const s = settings();
    const products = db.prepare('SELECT id,name,name_en,category,unit,description,p_retail,p_half,p_whole,stock,has_colors FROM products WHERE active=1 AND hidden=0 ORDER BY sort,id').all();
    const colors = db.prepare('SELECT id,code,line,stock FROM colors WHERE active=1').all();
    const pc = db.prepare('SELECT product_id,color_id FROM product_colors').all();
    const byId = {}; colors.forEach(c => byId[c.id] = c);
    const by = {}; pc.forEach(x => (by[x.product_id] = by[x.product_id] || []).push(byId[x.color_id]));
    products.forEach(p => {
      p.colors = (by[p.id] || []).filter(Boolean);
      p.available = (p.stock === null || p.stock > 0) && (!p.has_colors || p.colors.some(c => c.stock === null || c.stock > 0));
    });
    const zones = db.prepare('SELECT name,fee_cents FROM zones WHERE active=1 ORDER BY sort').all();
    return { s, products, colors, zones };
  }
  const waLink = (s, text) => s.whatsapp_number ? 'https://wa.me/' + s.whatsapp_number + (text ? '?text=' + encodeURIComponent(text) : '') : '';
  const pinfo = (p, s) => p.name + ' — ' + egp(p.p_retail) + ' / ' + p.unit + (+s.half_min ? ' (نصف جملة من ' + s.half_min + ': ' + egp(p.p_half) + '، جملة من ' + s.whole_min + ': ' + egp(p.p_whole) + ')' : '') + (p.available ? '' : ' — غير متوفر حالياً');

  const TOPICS = [
    ['كروشيه', /كروشي|كروشيه|كروشية|crochet/], ['تطريز', /تطريز|مالونيه|مالونى|ملونيه|floss|embroider/],
    ['مكرمية', /مكرمي|macrame/], ['كتان', /كتان|خيش|linen/], ['أكريليك', /اكريليك|فلافي|acrylic/],
    ['خيوط حياكة', /حياكه|خياطه|ماكينه|كون/], ['سلسلة', /سلسل|بوليستر|polyester/], ['كوتن بارليه', /بارلي|بارليه|برايت|اهرام|pearl/]];
  const GINGA = /جنجاه|متدرج|درجات|ginga/;

  function answer(msgs) {
    const { s, products, colors, zones } = data();
    const last = norm((msgs[msgs.length - 1] || {}).content), hist = norm(msgs.slice(-4).map(m => m.content).join(' '));
    const out = { reply: '', products: [], handoff: false };
    const handoff = (why, ctx) => { out.handoff = true; out.wa = waLink(s, why + (ctx ? ' — ' + ctx : '')); return out; };

    // كود لون: رد حاسم من قاعدة البيانات (لا يمر على النموذج)
    const raw = String(msgs[msgs.length - 1].content).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const toks = []; let mt; const re = /(?:^|[^A-Za-z0-9])([A-Za-z]{1,3})\s?-?\s?(\d{1,5})(?![0-9])/g;
    while ((mt = re.exec(raw))) toks.push({ l: mt[1].toUpperCase(), n: mt[2], full: mt[1].toUpperCase() + mt[2] });
    if (!toks.length && /لون|كود|code/.test(last)) { const m2 = raw.match(/(?:^|[^0-9])(\d{2,5})(?![0-9])/); if (m2) toks.push({ l: '', n: m2[1], full: m2[1] }); }
    if (toks.length) {
      const cn = c => { const m = String(c.code).toUpperCase().replace(/[\s-]/g, '').match(/^([A-Z]*)0*(\d+)([A-Z0-9]*)$/); return m ? { l: m[1], n: String(parseInt(m[2], 10)) + m[3], raw: String(c.code).toUpperCase().replace(/[\s-]/g, '') } : { l: '', n: '', raw: String(c.code).toUpperCase() }; };
      const idx = colors.map(c => [c, cn(c)]);
      const lines = [], pset = [], missing = [];
      for (const t of toks.slice(0, 5)) {
        const tn = String(parseInt(t.n, 10));
        let hits = idx.filter(([, k]) => k.raw === t.full).map(x => x[0]);
        if (!hits.length) hits = idx.filter(([, k]) => k.n === tn && (!t.l || k.l === t.l)).map(x => x[0]);
        if (!hits.length) { missing.push(t.full); continue; }
        for (const c of hits) {
          const ps = products.filter(p => p.colors.some(x => x.id === c.id));
          const ok = c.stock === null || c.stock > 0;
          lines.push('• ' + c.code + ' — ' + (ps.length ? ps.map(p => p.name).join(' / ') : 'غير مرتبط بمنتج حالياً') + ': ' + (ok ? 'متوفر ✅' : 'غير متوفر حالياً ❌'));
          ps.forEach(p => { if (!pset.includes(p.id)) pset.push(p.id); });
        }
      }
      if (lines.length || (missing.length && (/لون|كود|code/.test(last) || toks.length === missing.length && last.replace(/[a-z0-9\s-]/g, '').length < 12))) {
        out.reply = (lines.length ? 'اللون ' + (lines.length > 1 ? 'اللي سألت عنه:' : 'ده:') + '\n' + lines.join('\n') : '') + (missing.length ? (lines.length ? '\n' : '') + 'مش لاقي في الكتالوج كود: ' + missing.join('، ') + '. اتأكد من الكود أو كلم فريقنا على واتساب.' : '');
        out.products = pset.slice(0, 4); out.det = true;
        if (!lines.length) handoff('عايز أسأل عن لون كوده ' + missing.join(' '));
        return out;
      }
    }
    if (/^(مرحبا|اهلا|هاي|السلام|سلام|صباح|مساء|ازيك|هلا|hello|hi)\b/.test(last) && last.length < 25) { out.reply = 'أهلاً بيك في ' + s.shop_name + ' 👋 اسألني عن أي منتج أو لون أو سعر أو شحن، أو قولي بتعمل إيه (كروشيه، تطريز، مكرمية...) وأرشحلك الأنسب.'; return out; }
    const askShip = /شحن|توصيل|توصل|بيوصل|يوصل|مصاريف|محافظ|delivery|shipping/.test(last), askPay = /دفع|ادفع|اسدد|سداد|فودافون|كاش|انستا|instapay|تحويل|فيزا|كارت|عند الاستلام|cod/.test(last);
    if (askShip && askPay) { out.reply = 'الشحن بيتم عن طريق شركة شحن خارجية لحد باب العميل، وبتختار محافظتك عند تأكيد الطلب. الدفع بفودافون كاش أو إنستا باي (تحويل) وبتكتب رقم العملية بعد التحويل وإحنا بنأكد. مفيش دفع عند الاستلام أو بالكارت.'; return out; }
    if (askShip) {
      const fees = zones.filter(z => z.fee_cents > 0);
      out.reply = 'الشحن بيتم عن طريق شركة شحن خارجية لحد باب العميل.' + (fees.length ? ' التكلفة بتتحدد حسب المحافظة وبتظهرلك قبل تأكيد الطلب.' : ' بتختار محافظتك عند تأكيد الطلب.') + ' مواعيد الوصول بتختلف حسب المحافظة، ولو عايز ميعاد دقيق كلم فريقنا على واتساب.';
      return out;
    }
    if (askPay) {
      out.reply = 'الدفع متاح بطريقتين: فودافون كاش وإنستا باي (تحويل). بتختار الطريقة عند تأكيد الطلب وهيظهرلك الرقم، وبعد التحويل بتكتب رقم العملية وإحنا بنأكد الدفع. مفيش دفع عند الاستلام أو بالكارت حالياً.';
      return out;
    }
    if (/جمله|نص جمله|نصف جمله|كميه|كميات|حد ادني|اقل كميه|خصم|تاجر|wholesale/.test(last)) {
      out.reply = 'عندنا 3 مستويات سعر: قطاعي (أقل من ' + s.half_min + ' وحدة)، نصف جملة (من ' + s.half_min + ')، وجملة (من ' + s.whole_min + '). السعر بينزل أوتوماتيك في السلة لما الكمية توصل الحد. قولي أنهي منتج وأقولك الأسعار.';
      return out;
    }
    if (/تخفيض|عروض|كوبون|كود خصم/.test(last)) { out.reply = 'العروض والخصومات الخاصة بتتحدد مع فريقنا مباشرة، وأسعار الجملة بتنزل أوتوماتيك مع الكمية.'; return handoff('عايز أسأل عن عروض أو خصومات'); }
    if (/رجيع|استرجاع|استبدال|مرتجع|ضمان|شكوي|مشكله|اتاخر|تتبع|اوردر|طلبي/.test(last)) { out.reply = 'في الموضوع ده الأفضل تكلم فريقنا مباشرة على واتساب وهيتابعوا معاك بنفسهم.'; return handoff('عندي استفسار عن طلب أو مشكلة'); }
    if (/ستوك|مخزون|متوفر|موجود|فاضل|خلص/.test(last) && !TOPICS.some(t => t[1].test(last))) { out.reply = 'قولي اسم المنتج أو كود اللون وأقولك لو متوفر. الألوان الغير متوفرة بتظهر باهتة وما ينفعش تتختار.'; return out; }

    // ترشيح منتجات
    let topic = TOPICS.find(t => t[1].test(last)) || (/^(و|طيب|ايه|كمان|وبكام|سعر)/.test(last) || last.length < 14 ? TOPICS.find(t => t[1].test(hist)) : null);
    const wantGinga = GINGA.test(last);
    let list = topic ? products.filter(p => norm(p.category) === norm(topic[0]) || topic[1].test(norm(p.name))) : [];
    if (topic && list.length > 1 && /(^| )(خام|ابيض|الوان|لون واحد|ملون)/.test(last)) {
      const f = list.filter(p => (/خام/.test(last) ? /خام/.test(norm(p.name)) : /ابيض/.test(last) ? /ابيض/.test(norm(p.name)) : /الوان|ملون/.test(last) ? /الوان/.test(norm(p.name)) : true));
      if (f.length) list = f;
    }
    if (wantGinga && list.length) { const g = list.filter(p => /جنجاه/.test(norm(p.name))); if (g.length) list = g; }
    if (!list.length) {
      const words = last.split(' ').filter(w => w.length > 2);
      list = products.map(p => [p, words.filter(w => norm(p.name + ' ' + p.name_en + ' ' + p.description).includes(w)).length]).filter(x => x[1] >= 1).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 4);
    }
    if (!list.length) {
      if (/خيط|خيوط|منتج|عندكم|عايز|محتاج|ايه|اشتري|رشح|انسب/.test(last)) {
        out.reply = 'عندنا: كوتن بارليه، كروشيه، تطريز (مالونيه)، مكرمية، كتان، أكريليك، سلسلة وخيوط حياكة. قولي هتستخدمه في إيه (كروشيه؟ تطريز؟ مكرمية؟) وأرشحلك الأنسب بسعره.';
        return out;
      }
      out.reply = 'مش متأكد إني فهمت قصدك بالظبط. تقدر تكلم فريقنا على واتساب ويردوا عليك بسرعة.';
      return handoff('عندي سؤال: ' + String(msgs[msgs.length - 1].content).slice(0, 120));
    }
    if (list.length > 1) {
      const STOP = new Set(['بكام', 'سعر', 'عايز', 'عندكم', 'محتاج', 'ممكن', 'ايه', 'هل', 'كام', 'عاوز', 'اسعار', 'علي']);
      const ws = last.split(' ').filter(w => w.length > 2 && !STOP.has(w));
      const sc = list.map(p => ws.filter(w => norm(p.name + ' ' + p.name_en).includes(w)).length), mx = Math.max(...sc);
      if (mx >= 2 || (mx >= 1 && sc.filter(x => x === mx).length < list.length && ws.length <= 2)) list = list.filter((p, i) => sc[i] === mx);
    }
    list = list.slice(0, 5); out.products = list.map(p => p.id);
    out.reply = (topic ? 'ده المتاح في ' + topic[0] + ':' : 'ده اللي لقيته:') + '\n' + list.map(p => '• ' + pinfo(p, s)).join('\n') + '\nاضغط على المنتج تشوف كل الألوان وتضيفه للسلة.';
    return out;
  }

  // ---- نموذج ذكي اختياري ----
  function ctx() {
    const { s, products, zones } = data();
    return 'أنت مساعد متجر "' + s.shop_name + '" (مصنع خيوط قطن مصري). رد بالعامية المصرية بأسلوب ودود ومختصر (٣ أسطر تقريباً). لا تبدأ كل رد بترحيب (رحّب فقط في أول رسالة)، ولا تذكر الدفع أو الشحن إلا لو العميل سأل عنهما. جاوب على السؤال المطروح مباشرة. استخدم فقط المعلومات التالية ولا تخترع أسعاراً أو أكواداً أو مواعيد. لو السؤال خارج المعلومات قل إنك هتحوله لفريقنا على واتساب. لا تذكر أرقام مخزون دقيقة، فقط متوفر أو غير متوفر. الدفع: فودافون كاش وإنستا باي فقط، والشحن عن طريق شركة شحن خارجية بتحديد المحافظة عند الطلب. لا دفع عند الاستلام ولا كارت.\n' +
      'مستويات السعر: قطاعي، نصف جملة من ' + s.half_min + ' وحدة، جملة من ' + s.whole_min + ' وحدة (الأسعار بالجنيه).\n' +
      'المنتجات:\n' + products.map(p => '- ' + p.name + ' | ' + p.category + ' | وحدة: ' + p.unit + ' | قطاعي ' + p.p_retail / 100 + ' نصف جملة ' + p.p_half / 100 + ' جملة ' + p.p_whole / 100 + ' | ' + (p.available ? 'متوفر' : 'غير متوفر') + (p.has_colors ? ' | عدد الألوان ' + p.colors.length : '') + ' | ' + String(p.description).replace(/\n/g, ' ').slice(0, 110)).join('\n') + '\n' +
      'المحافظات: ' + zones.map(z => z.name).join('، ');
  }
  async function llm(msgs) {
    const key = process.env.GEMINI_API_KEY, gkey = process.env.GROQ_API_KEY;
    if (!key && !gkey) return null;
    const sys = ctx(), turns = msgs.slice(-8);
    if (key) {
      const models = [process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest'].filter(Boolean);
      for (const m of models) {
        try {
          const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, signal: AbortSignal.timeout(9000),
            body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: turns.map(t => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.content }] })), generationConfig: { temperature: 0.3, maxOutputTokens: 500 } })
          });
          const j = await r.json(); const t = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts.map(x => x.text || '').join('');
          if (t) return t; console.error('gemini', m, r.status, j.error && j.error.status);
        } catch (e) { console.error('gemini', m, e.message); }
      }
      return null;
    }
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + gkey }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', temperature: 0.4, max_tokens: 400, messages: [{ role: 'system', content: sys }, ...turns] })
    });
    const j = await r.json(); return j.choices && j.choices[0] && j.choices[0].message.content;
  }

  return async function reply(msgs) {
    const base = answer(msgs);
    if (base.det) return base;
    try {
      const t = await llm(msgs);
      if (t) {
        const txt = t.trim().slice(0, 900), low = /واتساب|فريقنا/.test(txt) && /هحول|هتحول|كلم|تواصل/.test(txt);
        const mentioned = data().products.filter(p => txt.includes(p.name)).map(p => p.id).slice(0, 4);
        const out = { reply: txt, products: mentioned.length ? mentioned : base.products, handoff: base.handoff || low };
        if (out.handoff) out.wa = base.wa || waLink(data().s, 'عندي سؤال: ' + String(msgs[msgs.length - 1].content).slice(0, 120));
        return out;
      }
    } catch (e) { console.error('assistant llm:', e.message); }
    return base;
  };
};
