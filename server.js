process.env.TZ = process.env.TZ || 'Africa/Cairo';
require('dotenv').config();
const { orderPdf } = require('./pdfgen');
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), crypto = require('crypto');
const path = require('path'), os = require('os'), fs = require('fs'), ExcelJS = require('exceljs');
const db = require('./db');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 24) { console.error('JWT_SECRET مطلوب (24 حرفاً على الأقل)'); process.exit(1); }
const prod = process.env.NODE_ENV === 'production';
const GUEST = db.prepare("SELECT id FROM users WHERE email='guest@system.local'").get().id;

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: {
  ...helmet.contentSecurityPolicy.getDefaultDirectives(),
  'img-src': ["'self'", 'data:', 'blob:', 'https:'], 'upgrade-insecure-requests': prod ? [] : null } } }));
app.use(express.json({ limit: '700kb' }));
// wait for the write-ahead log to reach Postgres before confirming any change to the client
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') return next();
  const json = res.json.bind(res);
  res.json = body => { db.flush().then(() => json(body)); return res; };
  next();
});

const wrap = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);
const fail = (res, code, error) => res.status(code).json({ error });
const sign = u => jwt.sign({ id: u.id, role: u.role, name: u.name }, SECRET, { expiresIn: '7d' });
const verify = req => jwt.verify((req.headers.authorization || '').slice(7), SECRET);
const auth = (req, res, next) => { try { req.user = verify(req); next(); } catch { fail(res, 401, 'يلزم تسجيل الدخول'); } };
const optAuth = (req, res, next) => { try { req.user = verify(req); } catch { req.user = null; } next(); };
const admin = (req, res, next) => { const u = db.prepare("SELECT role,active FROM users WHERE id=?").get(req.user.id); return u && u.active !== 0 && u.role === 'admin' ? next() : fail(res, 403, 'غير مسموح'); };
const PERMS = ['orders', 'orders_delete', 'products', 'colors', 'reports', 'audit', 'settings'];
const permsOf = u => u.role === 'admin' ? PERMS.slice() : String(u.perms || '').split(',').filter(x => PERMS.includes(x));
// صلاحيات الموظفين تُقرأ من قاعدة البيانات في كل طلب (التعطيل وسحب الصلاحية فوري)
const can = perm => (req, res, next) => {
  const u = db.prepare('SELECT id,name,role,perms,active FROM users WHERE id=?').get(req.user.id);
  if (!u || u.active === 0 || !['admin', 'staff'].includes(u.role)) return fail(res, 403, 'غير مسموح');
  if (perm && !permsOf(u).includes(perm)) return fail(res, 403, 'ليس لديك صلاحية لهذا الإجراء');
  req.user = { ...req.user, role: u.role, name: u.name, perms: permsOf(u) }; next();
};
const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const phoneOf = v => str(v, 30).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\s\-()]/g, '');
const okUrl = v => typeof v === 'string' && v.length <= 400 && /^(https:\/\/|\/img\/)[^\s"'<>]*$/.test(v) ? v : '';
const okData = v => typeof v === 'string' && v.length <= 400000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : '';
const money = v => Math.round(Number(v) * 100);
const settings = () => Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r => [r.key, r.value]));
const tier = (p, q, s) => q >= +s.whole_min ? p.p_whole : q >= +s.half_min ? p.p_half : p.p_retail;
const egpAr = c => (c / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ج.م';
const egp = c => (c / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' EGP';
const audit = (who, action, p, detail) => db.prepare('INSERT INTO audit_log(who,action,product_id,product,detail) VALUES(?,?,?,?,?)').run(who, action, p ? p.id : null, p ? p.name : '', detail);

// ---------- Telegram ----------
const tgCfg = () => { const s = settings(); return { tok: s.telegram_token || process.env.TELEGRAM_BOT_TOKEN, chat: s.telegram_chat || process.env.TELEGRAM_CHAT_ID }; };
const tgApi = (tok, m) => `${process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'}/bot${tok}/${m}`;
async function tgCall(m, body, timeout = 8000) {
  const { tok } = tgCfg(); if (!tok) return null;
  try { const r = await fetch(tgApi(tok, m), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) }); return r.ok ? await r.json() : null; }
  catch (e) { console.error('telegram', m, e.message); return null; }
}
async function notify(text, reply_markup) {
  const { tok, chat } = tgCfg(); if (!tok || !chat) return false;
  const b = { chat_id: chat, text }; if (reply_markup) b.reply_markup = reply_markup;
  return !!(await tgCall('sendMessage', b, 6000));
}
async function notifyPdf(buf, filename, caption) {
  const { tok, chat } = tgCfg(); if (!tok || !chat) return false;
  try {
    const f = new FormData(); f.append('chat_id', String(chat)); if (caption) f.append('caption', caption);
    f.append('document', new Blob([buf], { type: 'application/pdf' }), filename);
    const r = await fetch(tgApi(tok, 'sendDocument'), { method: 'POST', body: f, signal: AbortSignal.timeout(20000) }); return r.ok;
  } catch (e) { console.error('telegram pdf', e.message); return false; }
}
const payKb = (id, st) => ({ inline_keyboard: st === 'paid'
  ? [[{ text: '✅ تم تأكيد الدفع (اضغط للتراجع)', callback_data: `pay:${id}:pending` }]]
  : [[{ text: '✅ تم استلام الدفع', callback_data: `pay:${id}:paid` }, { text: '❌ لم يتم الدفع', callback_data: `pay:${id}:pending` }]] });
// استقبال ضغطات أزرار البوت (تأكيد الدفع) بالـ long polling
let tgOff = 0, tgTokSeen = null;
async function tgPoll() {
  for (;;) {
    const { tok, chat } = tgCfg();
    if (!tok || !chat) { await new Promise(r => setTimeout(r, 30000)); continue; }
    try {
      if (tgTokSeen !== tok) { await tgCall('deleteWebhook', {}); tgTokSeen = tok; tgOff = 0; }
      const r = await fetch(tgApi(tok, 'getUpdates'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offset: tgOff, timeout: 25, allowed_updates: ['callback_query'] }), signal: AbortSignal.timeout(35000) });
      const j = r.ok ? await r.json() : null;
      if (!j) { await new Promise(r2 => setTimeout(r2, 8000)); continue; }
      for (const u of j.result || []) { tgOff = u.update_id + 1; try { await tgHandle(u, String(chat)); } catch (e) { console.error('tg handle', e.message); } }
    } catch (e) { await new Promise(r => setTimeout(r, 8000)); }
  }
}
async function tgHandle(u, chat) {
  const cq = u.callback_query; if (!cq || !cq.message) return;
  const m = /^pay:(\d+):(paid|pending)$/.exec(cq.data || '');
  if (String(cq.message.chat.id) !== chat || !m) return tgCall('answerCallbackQuery', { callback_query_id: cq.id });
  const id = Number(m[1]), st = m[2], o = db.prepare('SELECT id,status,payment_status FROM orders WHERE id=?').get(id);
  if (!o) return tgCall('answerCallbackQuery', { callback_query_id: cq.id, text: 'الطلب غير موجود', show_alert: true });
  if (o.status === 'cancelled') return tgCall('answerCallbackQuery', { callback_query_id: cq.id, text: 'هذا الطلب ملغي', show_alert: true });
  db.prepare('UPDATE orders SET payment_status=? WHERE id=?').run(st, id);
  try { audit('تليجرام', 'payment', { id: null, name: 'طلب #' + id }, st === 'paid' ? 'تم تأكيد الدفع' : 'غير مدفوع'); } catch (e) { }
  await tgCall('editMessageReplyMarkup', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: payKb(id, st) });
  await tgCall('answerCallbackQuery', { callback_query_id: cq.id, text: st === 'paid' ? `تم تأكيد دفع الطلب #${id} ✅` : `الطلب #${id}: غير مدفوع` });
}

// ---------- Auth ----------
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
app.post('/api/auth/register', authLimiter, wrap((req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email, 120).toLowerCase(), pw = req.body.password;
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || typeof pw !== 'string' || pw.length < 8 || pw.length > 100)
    return fail(res, 400, 'بيانات غير صحيحة (كلمة المرور 8 أحرف على الأقل)');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return fail(res, 409, 'البريد مسجّل مسبقاً');
  const id = db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run(name, email, bcrypt.hashSync(pw, 10)).lastInsertRowid;
  const u = { id: Number(id), role: 'customer', name };
  res.json({ token: sign(u), user: u });
}));
app.post('/api/auth/login', authLimiter, wrap((req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE email=? AND role!='guest'").get(str(req.body.email, 120).toLowerCase());
  if (u && u.active === 0) return fail(res, 403, 'هذا الحساب معطّل');
  if (!u || typeof req.body.password !== 'string' || !bcrypt.compareSync(req.body.password, u.password))
    return fail(res, 401, 'البريد أو كلمة المرور غير صحيحة');
  res.json({ token: sign(u), user: { id: u.id, role: u.role, name: u.name, perms: permsOf(u) } });
}));
app.get('/api/me', auth, (req, res) => { const u = db.prepare('SELECT id,name,role,perms,active FROM users WHERE id=?').get(req.user.id); if (!u || u.active === 0) return fail(res, 401, 'يلزم تسجيل الدخول'); res.json({ user: { id: u.id, role: u.role, name: u.name, perms: permsOf(u) } }); });

// ---------- Public catalog ----------
function catalog(where) {
  const ps = db.prepare(`SELECT * FROM products WHERE ${where} ORDER BY sort,id`).all(), im = {}, cm = {};
  db.prepare('SELECT id,product_id FROM product_images ORDER BY sort,id').all().forEach(i => (im[i.product_id] = im[i.product_id] || []).push('/api/img/' + i.id));
  db.prepare('SELECT product_id,color_id FROM product_colors').all().forEach(c => (cm[c.product_id] = cm[c.product_id] || []).push(c.color_id));
  return ps.map(p => ({ ...p, images: im[p.id] || (p.image_url ? [p.image_url] : []), color_ids: cm[p.id] || [] }));
}
const assistantReply = require('./assistant')(db, settings);
const chatLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false });
app.post('/api/assistant', chatLimiter, wrap(async (req, res) => {
  const m = Array.isArray(req.body.messages) ? req.body.messages.slice(-10).filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string').map(x => ({ role: x.role, content: x.content.slice(0, 500) })) : [];
  if (!m.length || m[m.length - 1].role !== 'user' || !m[m.length - 1].content.trim()) return fail(res, 400, 'اكتب سؤالك');
  res.json(await assistantReply(m));
}));
app.get('/api/config', (req, res) => {
  const s = settings();
  res.json({ shop: s.shop_name, halfMin: +s.half_min, wholeMin: +s.whole_min, whatsapp: s.whatsapp_number,
    zones: db.prepare('SELECT name FROM zones WHERE active=1 ORDER BY sort').all(),
    wallet: { number: s.wallet_number, name: s.wallet_name }, instapay: { number: s.instapay_number, handle: s.instapay_handle, qr: s.instapay_qr, link: /^https:\/\/ipn\.eg\//.test(s.instapay_link || '') ? s.instapay_link : '' } });
});

// ---------- "أبلغني عند التوفر": طلبات انتظار اللون ----------
const alertLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
app.post('/api/color-alerts', alertLimiter, wrap((req, res) => {
  const b = req.body || {}, name = str(b.name, 60), phone = str(b.phone, 25).replace(/[\s\-()]/g, ''), cid = Number(b.color), pid = Number(b.product) || null;
  if (name.length < 2) return fail(res, 400, 'اكتب اسمك');
  if (!/^\+?\d{8,15}$/.test(phone)) return fail(res, 400, 'رقم الموبايل غير صحيح');
  const c = db.prepare('SELECT id,code,stock FROM colors WHERE id=? AND active=1').get(cid);
  if (!c) return fail(res, 404, 'اللون غير موجود');
  if (c.stock === null || c.stock > 0) return res.json({ ok: true, available: true });
  if (!db.prepare('SELECT 1 FROM color_alerts WHERE color_id=? AND phone=? AND notified=0').get(cid, phone))
    db.prepare('INSERT INTO color_alerts(color_id,product_id,name,phone) VALUES(?,?,?,?)').run(cid, pid, name, phone);
  res.json({ ok: true });
}));
async function sweepAlerts() {
  const rows = db.prepare("SELECT a.id,a.name,a.phone,a.color_id,c.code,p.name pname FROM color_alerts a JOIN colors c ON c.id=a.color_id LEFT JOIN products p ON p.id=a.product_id WHERE a.notified=0 AND c.active=1 AND (c.stock IS NULL OR c.stock>0) ORDER BY a.id").all();
  const by = {}; rows.forEach(r => (by[r.color_id] = by[r.color_id] || []).push(r));
  for (const g of Object.values(by)) {
    const t = `🔔 رجع للمخزون: لون ${g[0].code}${g[0].pname ? ' (' + g[0].pname + ')' : ''}\nعملاء منتظرين (${g.length}):\n` + g.map(r => `• ${r.name} - ${r.phone}`).join('\n');
    if (await notify(t)) g.forEach(r => db.prepare('UPDATE color_alerts SET notified=1 WHERE id=?').run(r.id));
  }
}
setInterval(() => sweepAlerts().catch(e => console.error('sweep', e.message)), 120000).unref();
app.get('/api/admin/color-alerts', auth, can('colors'), (req, res) => res.json(db.prepare("SELECT a.id,a.color_id,a.name,a.phone,a.notified,a.created_at,c.code,c.line,c.stock,p.name product FROM color_alerts a JOIN colors c ON c.id=a.color_id LEFT JOIN products p ON p.id=a.product_id ORDER BY a.notified, a.id DESC LIMIT 200").all()));
app.delete('/api/admin/color-alerts/:id', auth, can('colors'), (req, res) => { db.prepare('DELETE FROM color_alerts WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });
app.patch('/api/admin/colors/:id/stock', auth, can('colors'), wrap((req, res) => {
  const id = Number(req.params.id), c = db.prepare('SELECT id,code,stock FROM colors WHERE id=?').get(id), v = req.body.stock;
  if (!c) return fail(res, 404, 'غير موجود');
  const n = v === '' || v == null ? null : Number(v);
  if (n !== null && (!Number.isInteger(n) || n < 0)) return fail(res, 400, 'رصيد غير صحيح');
  db.prepare('UPDATE colors SET stock=? WHERE id=?').run(n, id);
  audit(req.user.name, 'stock', { id: 0, name: 'لون ' + c.code }, `${c.stock == null ? '∞' : c.stock} → ${n == null ? '∞' : n} (رصيد لون)`);
  sweepAlerts().catch(() => {}); res.json({ ok: true });
}));
app.get('/api/products', (req, res) => res.json(catalog('active=1 AND hidden=0')));
app.get('/api/colors', (req, res) => {
  const rows = db.prepare('SELECT id,code,line,name,hex,stock,(thumb IS NOT NULL) AS has_img FROM colors WHERE active=1').all()
    .sort((a, b) => a.line.localeCompare(b.line) || a.code.localeCompare(b.code, 'en', { numeric: true }));
  res.json(rows.map(({ has_img, stock, ...c }) => (c = { ...c, oos: stock !== null && stock <= 0, mx: stock === null ? null : Math.floor(stock) }, has_img) ? { ...c, t: '/api/color-img/' + c.id + '?t=1', img: '/api/color-img/' + c.id } : c));
});
app.get('/api/color-img/:id', (req, res) => {
  const c = db.prepare('SELECT image,thumb FROM colors WHERE id=?').get(Number(req.params.id));
  const data = c && (req.query.t ? c.thumb || c.image : c.image);
  if (!data) return res.sendStatus(404);
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800' }).send(data);
});
app.get('/api/img/:id', (req, res) => {
  const i = db.prepare('SELECT mime,data FROM product_images WHERE id=?').get(Number(req.params.id));
  if (!i) return res.sendStatus(404);
  res.set({ 'Content-Type': i.mime, 'Cache-Control': 'public, max-age=604800' }).send(i.data);
});

// ---------- Admin: products ----------
const SPEC = ['spec_weight', 'spec_count', 'spec_length', 'spec_material', 'spec_size', 'spec_usage'];
function pBody(b) {
  const half = b.p_half === '' || b.p_half == null ? b.p_retail : b.p_half, whole = b.p_whole === '' || b.p_whole == null ? half : b.p_whole;
  const p = { name: str(b.name, 120), name_en: str(b.name_en, 120), category: str(b.category, 40), unit: str(b.unit, 20) || 'وحدة', description: str(b.description, 1200),
    image_url: okUrl(b.image_url), p_retail: money(b.p_retail), p_half: money(half), p_whole: money(whole),
    stock: b.stock === '' || b.stock == null ? null : Number(b.stock), has_colors: b.has_colors ? 1 : 0, sort: parseInt(b.sort, 10) || 0 };
  SPEC.forEach(k => { p[k] = str(b[k], 200); });
  const okStock = p.stock === null || (Number.isInteger(p.stock) && p.stock >= 0);
  return p.name && p.category && p.p_retail > 0 && p.p_half > 0 && p.p_whole > 0 && okStock ? p : null;
}
const Q = 'name,name_en,category,unit,description,image_url,p_retail,p_half,p_whole,stock,has_colors,sort,' + SPEC.join(',');
const diff = (o, n) => [['p_retail', 'قطاعي'], ['p_half', 'نصف جملة'], ['p_whole', 'جملة']].filter(([k]) => o[k] !== n[k]).map(([k, l]) => `${l} ${o[k] / 100}→${n[k] / 100}`);
app.get('/api/admin/products', auth, can('products'), (req, res) => res.json(catalog('active=1')));
app.post('/api/admin/products', auth, can('products'), wrap((req, res) => {
  const p = pBody(req.body); if (!p) return fail(res, 400, 'بيانات المنتج غير صحيحة');
  const id = Number(db.prepare(`INSERT INTO products(${Q}) VALUES(${Q.split(',').map(k => '@' + k)})`).run(p).lastInsertRowid);
  audit(req.user.name, 'create', { id, name: p.name }, `إضافة منتج — قطاعي ${p.p_retail / 100}، مخزون ${p.stock == null ? '∞' : p.stock}`);
  res.json({ id });
}));
app.put('/api/admin/products/:id', auth, can('products'), wrap((req, res) => {
  const p = pBody(req.body), id = Number(req.params.id), o = db.prepare('SELECT * FROM products WHERE id=?').get(id);
  if (!p || !o) return fail(res, 400, 'بيانات المنتج غير صحيحة');
  db.prepare(`UPDATE products SET ${Q.split(',').map(k => k + '=@' + k)} WHERE id=@id`).run({ ...p, id });
  const d = diff(o, p); if (d.length) audit(req.user.name, 'price', o, d.join(' | '));
  if (o.stock !== p.stock) audit(req.user.name, 'stock', o, `${o.stock == null ? '∞' : o.stock} → ${p.stock == null ? '∞' : p.stock} (تعديل يدوي)`);
  res.json({ ok: true });
}));
app.put('/api/admin/products/:id/colors', auth, can('products'), wrap((req, res) => {
  const id = Number(req.params.id), ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger);
  db.transaction(() => {
    db.prepare('DELETE FROM product_colors WHERE product_id=?').run(id);
    const ins = db.prepare('INSERT OR IGNORE INTO product_colors(product_id,color_id) SELECT ?,id FROM colors WHERE id=? AND active=1');
    ids.forEach(c => ins.run(id, c));
  })();
  res.json({ ok: true });
}));
app.patch('/api/admin/products/:id/prices', auth, can('products'), wrap((req, res) => {
  const [a, b, c] = ['p_retail', 'p_half', 'p_whole'].map(k => money(req.body[k])), id = Number(req.params.id), o = db.prepare('SELECT * FROM products WHERE id=?').get(id);
  if (!o || !(a > 0 && b > 0 && c > 0)) return fail(res, 400, 'أسعار غير صحيحة');
  db.prepare('UPDATE products SET p_retail=?,p_half=?,p_whole=? WHERE id=?').run(a, b, c, id);
  const d = diff(o, { p_retail: a, p_half: b, p_whole: c }); if (d.length) audit(req.user.name, 'price', o, d.join(' | '));
  res.json({ ok: true });
}));
app.patch('/api/admin/products/:id/stock', auth, can('products'), wrap((req, res) => {
  const id = Number(req.params.id), o = db.prepare('SELECT * FROM products WHERE id=?').get(id), v = req.body.stock;
  const n = v === '' || v == null ? null : Number(v);
  if (!o || !(n === null || (Number.isInteger(n) && n >= 0))) return fail(res, 400, 'مخزون غير صحيح');
  db.prepare('UPDATE products SET stock=? WHERE id=?').run(n, id);
  audit(req.user.name, 'stock', o, `${o.stock == null ? '∞' : o.stock} → ${n == null ? '∞' : n} (تعديل يدوي)`);
  res.json({ ok: true });
}));
app.patch('/api/admin/products/:id/hidden', auth, can('products'), (req, res) => {
  const id = Number(req.params.id), o = db.prepare('SELECT * FROM products WHERE id=?').get(id), h = req.body.hidden ? 1 : 0;
  if (!o) return fail(res, 404, 'غير موجود');
  db.prepare('UPDATE products SET hidden=? WHERE id=?').run(h, id); audit(req.user.name, 'status', o, h ? 'إيقاف مؤقت' : 'إعادة تفعيل');
  res.json({ ok: true });
});
app.post('/api/admin/prices/bump', auth, can('products'), wrap((req, res) => {
  const pct = Number(req.body.percent);
  if (!(pct >= -50 && pct <= 100) || pct === 0) return fail(res, 400, 'النسبة من -50 إلى 100');
  const f = 1 + pct / 100, r = c => `MAX(100,CAST(ROUND(${c}*${f}/100.0)*100 AS INTEGER))`, before = db.prepare('SELECT * FROM products WHERE active=1').all();
  db.transaction(() => {
    db.prepare(`UPDATE products SET p_retail=${r('p_retail')},p_half=${r('p_half')},p_whole=${r('p_whole')} WHERE active=1`).run();
    before.forEach(o => { const n = db.prepare('SELECT p_retail,p_half,p_whole FROM products WHERE id=?').get(o.id); const d = diff(o, n); if (d.length) audit(req.user.name, 'price', o, `تعديل جماعي ${pct}% : ` + d.join(' | ')); });
  })();
  res.json({ ok: true });
}));
app.delete('/api/admin/products/:id', auth, can('products'), (req, res) => {
  const o = db.prepare('SELECT * FROM products WHERE id=?').get(Number(req.params.id));
  if (o) { db.prepare('UPDATE products SET active=0 WHERE id=?').run(o.id); audit(req.user.name, 'delete', o, 'حذف المنتج'); }
  res.json({ ok: true });
});
app.post('/api/admin/products/:id/images', auth, can('products'), wrap((req, res) => {
  const id = Number(req.params.id), m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(okData(req.body.data));
  if (!m || !db.prepare('SELECT 1 FROM products WHERE id=?').get(id)) return fail(res, 400, 'صورة غير صالحة (jpeg/png/webp حتى 400KB)');
  if (db.prepare('SELECT COUNT(*) n FROM product_images WHERE product_id=?').get(id).n >= 8) return fail(res, 400, 'الحد الأقصى 8 صور');
  const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 n FROM product_images WHERE product_id=?').get(id).n;
  res.json({ id: Number(db.prepare('INSERT INTO product_images(product_id,mime,data,sort) VALUES(?,?,?,?)').run(id, m[1], Buffer.from(m[2], 'base64'), sort).lastInsertRowid) });
}));
app.post('/api/admin/images/:id/cover', auth, can('products'), (req, res) => {
  const i = db.prepare('SELECT product_id FROM product_images WHERE id=?').get(Number(req.params.id)); if (!i) return fail(res, 404, 'غير موجود');
  db.prepare('UPDATE product_images SET sort=(SELECT MIN(sort)-1 FROM product_images WHERE product_id=?) WHERE id=?').run(i.product_id, Number(req.params.id)); res.json({ ok: true });
});
app.delete('/api/admin/images/:id', auth, can('products'), (req, res) => { db.prepare('DELETE FROM product_images WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });

// ---------- Admin: colors / settings / zones / stats / audit / backup ----------
app.post('/api/admin/colors/bulk', auth, can('colors'), wrap((req, res) => {
  const up = db.prepare('INSERT INTO colors(code,line,name,hex,active) VALUES(?,\'\',?,?,1) ON CONFLICT(line,code) DO UPDATE SET name=excluded.name,hex=excluded.hex,active=1');
  const link = db.prepare('INSERT OR IGNORE INTO product_colors(product_id,color_id) SELECT p.id,c.id FROM products p, colors c WHERE p.has_colors=1 AND c.code=? AND c.line=\'\'');
  let n = 0;
  db.transaction(() => {
    for (const line of str(req.body.text, 60000).split('\n')) {
      const [code, name, hex] = line.split(/[,\t]/).map(s => s.trim());
      if (code && name && /^#[0-9a-f]{6}$/i.test(hex || '')) { up.run(code.slice(0, 20), name.slice(0, 40), hex); if (req.body.addToAll) link.run(code.slice(0, 20)); n++; }
    }
  })();
  res.json({ imported: n });
}));
app.delete('/api/admin/colors/:id', auth, can('colors'), (req, res) => { db.prepare('UPDATE colors SET active=0 WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });
const SKEYS = ['shop_name', 'half_min', 'whole_min', 'wallet_number', 'wallet_name', 'instapay_number', 'instapay_handle', 'instapay_qr', 'instapay_link', 'whatsapp_number', 'telegram_token', 'telegram_chat'];
app.get('/api/admin/settings', auth, can('settings'), (req, res) => res.json({ ...settings(), zones: db.prepare('SELECT name,fee_cents,active FROM zones ORDER BY sort').all() }));
app.put('/api/admin/settings', auth, can('settings'), wrap((req, res) => {
  const b = req.body, h = parseInt(b.half_min, 10), w = parseInt(b.whole_min, 10), wa = phoneOf(b.whatsapp_number).replace(/^\+/, '');
  if (!(h >= 1 && w > h)) return fail(res, 400, 'حدّ الجملة يجب أن يكون أكبر من حدّ نصف الجملة');
  if (wa && !/^\d{10,15}$/.test(wa)) return fail(res, 400, 'رقم واتساب (بالصيغة الدولية 2010xxxxxxxx) غير صحيح');
  const set = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const val = { half_min: String(h), whole_min: String(w), whatsapp_number: wa, instapay_qr: okData(b.instapay_qr) || okUrl(b.instapay_qr) };
  db.transaction(() => SKEYS.forEach(k => set.run(k, k in val ? val[k] : str(b[k], 300))))();
  res.json({ ok: true });
}));
app.put('/api/admin/zones', auth, can('settings'), wrap((req, res) => {
  const up = db.prepare('UPDATE zones SET fee_cents=?,active=? WHERE name=?');
  db.transaction(() => (Array.isArray(req.body.zones) ? req.body.zones : []).forEach(z => { const f = money(z.fee); if (f >= 0) up.run(f, z.active ? 1 : 0, str(z.name, 40)); }))();
  res.json({ ok: true });
}));
app.post('/api/admin/telegram/test', auth, can('settings'), wrap(async (req, res) => (await notify('✅ اختبار إشعارات متجر برايت')) ? res.json({ ok: true }) : fail(res, 502, 'تعذر الإرسال — تحقق من التوكن ومعرّف المحادثة')));
app.get('/api/admin/stats', auth, can(), (req, res) => {
  const one = sql => db.prepare(sql).get();
  res.json({
    today: one("SELECT COALESCE(SUM(total_cents),0) v FROM orders WHERE status!='cancelled' AND date(created_at,'localtime')=date('now','localtime')").v,
    month: one("SELECT COALESCE(SUM(total_cents),0) v FROM orders WHERE status!='cancelled' AND strftime('%Y-%m',created_at,'localtime')=strftime('%Y-%m','now','localtime')").v,
    newOrders: one("SELECT COUNT(*) v FROM orders WHERE status='new'").v,
    review: one("SELECT COUNT(*) v FROM orders WHERE payment_status='review' AND status!='cancelled'").v,
    low: db.prepare('SELECT id,name,stock FROM products WHERE active=1 AND stock IS NOT NULL AND stock<=10 ORDER BY stock LIMIT 10').all() });
});
app.get('/api/admin/audit', auth, can('audit'), (req, res) => {
  const s = `%${str(req.query.q, 40)}%`;
  res.json(db.prepare("SELECT id,datetime(at,'localtime') at,who,action,product,detail FROM audit_log WHERE product LIKE ? OR detail LIKE ? ORDER BY id DESC LIMIT 300").all(s, s));
});
app.get('/api/admin/backup', auth, can('settings'), wrap(async (req, res) => {
  const f = path.join(os.tmpdir(), 'bk-' + Date.now() + '.db'); await db.backup(f);
  res.download(f, 'bright-store-backup.db', () => fs.unlink(f, () => {}));
}));

// ---------- Orders ----------
const withItems = o => { const { token, ...r } = o; return { ...r, items: db.prepare('SELECT name,color,qty,price_cents FROM order_items WHERE order_id=?').all(o.id) }; };
const createOrder = db.transaction((uid, lines, info, method) => {
  const s = settings(), groups = new Map(), cq = {};
  for (const l of lines) {
    const p = db.prepare('SELECT * FROM products WHERE id=? AND active=1 AND hidden=0').get(l.id);
    if (!p) throw new Error('منتج غير متاح حالياً');
    let color = null;
    if (p.has_colors) {
      const c = db.prepare('SELECT c.* FROM colors c JOIN product_colors pc ON pc.color_id=c.id WHERE c.id=? AND pc.product_id=? AND c.active=1').get(l.color, p.id);
      if (!c) throw new Error('اللون غير متاح لهذا المنتج: ' + p.name);
      color = c.name ? `${c.code} - ${c.name}` : c.code;
      if (c.stock !== null) {
        if (c.stock <= 0) throw new Error('اللون غير متوفر حالياً: ' + c.code + ' (' + p.name + ')');
        if (p.unit !== 'كيلو' || c.line === 'linen') { cq[c.id] = (cq[c.id] || 0) + l.qty; if (cq[c.id] > c.stock) throw new Error('الكمية المطلوبة غير متوفرة للون ' + c.code + ' (' + p.name + ')'); }
      }
    }
    const g = groups.get(p.id) || { p, q: 0, items: [] };
    g.q += l.qty; g.items.push([color, l.qty]); groups.set(p.id, g);
  }
  let sub = 0; const rows = [], moves = [];
  for (const { p, q, items } of groups.values()) {
    if (p.stock !== null) {
      if (p.stock < q) throw new Error('الكمية غير متوفرة: ' + p.name + (p.stock ? ` (المتاح ${p.stock})` : ''));
      db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(q, p.id); moves.push([p, q]);
    }
    const u = tier(p, q, s); sub += u * q; items.forEach(([c, n]) => rows.push([p, c, n, u]));
  }
  const zone = db.prepare('SELECT name FROM zones WHERE name=? AND active=1').get(info.governorate);
  if (!zone) throw new Error('اختر المحافظة');
  const ship = 0, token = crypto.randomBytes(12).toString('hex');
  const oid = Number(db.prepare('INSERT INTO orders(user_id,total_cents,shipping_cents,payment_method,name,phone,governorate,area,address,note,token) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(uid, sub + ship, ship, method, info.name, info.phone, info.governorate, info.area, info.address, info.note, token).lastInsertRowid);
  rows.forEach(([p, c, n, u]) => db.prepare('INSERT INTO order_items(order_id,product_id,name,color,qty,price_cents) VALUES(?,?,?,?,?,?)').run(oid, p.id, p.name, c, n, u));
  moves.forEach(([p, q]) => audit('عميل', 'stock', p, `${p.stock} → ${p.stock - q} (طلب #${oid})`));
  return { id: oid, sub, ship, total: sub + ship, token };
});
const orderLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false });
app.post('/api/orders', orderLimiter, optAuth, wrap((req, res) => {
  const lines = (Array.isArray(req.body.items) ? req.body.items.slice(0, 200) : []).map(i => ({ id: parseInt(i.id, 10), color: parseInt(i.color, 10) || 0, qty: parseInt(i.qty, 10) }))
    .filter(l => l.id > 0 && l.qty > 0 && l.qty <= 100000);
  const info = { name: str(req.body.name, 80), phone: phoneOf(req.body.phone), governorate: str(req.body.governorate, 40), area: str(req.body.area, 80), address: str(req.body.address, 300), note: str(req.body.note, 300) };
  const method = ['wallet', 'instapay'].includes(req.body.payment) ? req.body.payment : '';
  if (!method) return fail(res, 400, 'اختر طريقة الدفع: فودافون كاش أو إنستا باي');
  if (!lines.length || !info.name || !/^\+?\d{10,15}$/.test(info.phone) || !info.address) return fail(res, 400, 'أكمل بيانات الطلب (الاسم، رقم موبايل صحيح، العنوان)');
  let r; try { r = createOrder(req.user ? req.user.id : GUEST, lines, info, method); } catch (e) { return fail(res, 409, e.message); }
  const orows = db.prepare('SELECT name,color,qty FROM order_items WHERE order_id=? ORDER BY id').all(r.id);
  const short = n => n;
  const cell = x => String(x == null || x === '' ? '-' : x).replace(/\|/g, '/');
  const head = `طلب جديد من برايت للخيوط\n\nبيانات العميل:\n- الاسم: ${info.name}\n- الهاتف الأساسي: ${info.phone}\n- العنوان: ${[info.area, info.governorate].filter(Boolean).join('-')}\n${info.address}\n- طريقة الدفع: ${{ wallet: 'فودافون كاش', instapay: 'إنستا باي' }[method]}\n- المبلغ: ${egpAr(r.total)}${info.note ? '\n- ملاحظة: ' + info.note : ''}\n\nتفاصيل الطلب:\n\n| الصنف | الكود | الكمية |\n|-------|--------|---------|`;
  const trs = orows.map(i => `| ${cell(short(i.name))} | ${cell(i.color)} | ${i.qty} |`);
  const foot = `\nالإجمالي: ${orows.reduce((n, i) => n + i.qty, 0)} عنصر`;
  let part = head; const parts = [];
  for (const l of trs) { if ((part + '\n' + l).length > 3800) { parts.push(part); part = '| الصنف | الكود | الكمية |\n|-------|--------|---------|'; } part += '\n' + l; }
  parts.push(part + '\n' + foot);
  const label = i => short(i.name) + (i.color ? ' - ' + i.color : '');
  (async () => {
    for (let k = 0; k < parts.length; k++) await notify(parts[k], k === parts.length - 1 ? payKb(r.id, 'pending') : undefined);
    try { const buf = await orderPdf({ title: `${info.name} - طلب #${r.id}`, rows: orows.map(i => ({ label: label(i), qty: i.qty })) }); await notifyPdf(buf, `order-${r.id}.pdf`, `طلب #${r.id} - ${info.name}`); } catch (e) { console.error('pdf', e.message); }
  })();
  res.json({ orderId: r.id, sub: r.sub, shipping: r.ship, total: r.total, payment: method, token: r.token, items: orows });
}));
app.get('/api/orders', auth, (req, res) =>
  res.json(db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.user.id).map(withItems)));
const tokEq = (a, b) => typeof a === 'string' && a.length === b.length && b.length > 0 && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
app.post('/api/orders/lookup', authLimiter, wrap((req, res) => {
  const out = [];
  for (const x of (Array.isArray(req.body.orders) ? req.body.orders.slice(0, 20) : [])) {
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(parseInt(x.id, 10)); if (o && tokEq(x.token, o.token)) out.push(withItems(o));
  }
  const id = parseInt(req.body.id, 10), phone = phoneOf(req.body.phone);
  if (id && phone) { const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id); if (o && o.phone === phone && !out.some(z => z.id === o.id)) out.push(withItems(o)); }
  res.json(out);
}));
app.post('/api/orders/:id/proof', authLimiter, optAuth, wrap((req, res) => {
  const ref = str(req.body.ref, 100); if (ref.length < 3) return fail(res, 400, 'اكتب رقم العملية أو الرقم المحوَّل منه');
  const o = db.prepare("SELECT * FROM orders WHERE id=? AND payment_method IN ('wallet','instapay') AND payment_status!='paid' AND status!='cancelled'").get(Number(req.params.id));
  if (!o || !((req.user && req.user.id === o.user_id) || tokEq(req.body.token, o.token))) return fail(res, 400, 'لا يمكن تحديث هذا الطلب');
  db.prepare("UPDATE orders SET payment_ref=?, payment_status='review' WHERE id=?").run(ref, o.id);
  notify(`💳 تم إرسال بيانات تحويل للطلب #${o.id}\nالعميل: ${o.name} - ${o.phone}\nالمرجع: ${ref}\nالمبلغ: ${egpAr(o.total_cents)}`, payKb(o.id, 'review'));
  res.json({ ok: true });
}));

// ---------- Admin: orders / reports ----------
function orderFilter(q) {
  const w = ['1=1'], a = [], d = /^\d{4}-\d{2}-\d{2}$/;
  if (d.test(q.from || '')) { w.push("date(o.created_at,'localtime')>=?"); a.push(q.from); }
  if (d.test(q.to || '')) { w.push("date(o.created_at,'localtime')<=?"); a.push(q.to); }
  for (const k of ['status', 'payment_status', 'payment_method', 'governorate']) if (q[k]) { w.push(`o.${k}=?`); a.push(str(q[k], 40)); }
  if (q.q) { const s = `%${str(q.q, 40)}%`; w.push('(o.name LIKE ? OR o.phone LIKE ? OR CAST(o.id AS TEXT)=?)'); a.push(s, s, str(q.q, 40)); }
  return { w: w.join(' AND '), a };
}
async function sendXlsx(res, file, title, cols, rows) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(title, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map(([header, width]) => ({ header, width })); ws.addRows(rows); ws.getRow(1).font = { bold: true };
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${file}.xlsx"` });
  await wb.xlsx.write(res); res.end();
}
const ST = { new: 'جديد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' }, PS = { pending: 'غير مدفوع', review: 'بانتظار المراجعة', paid: 'مدفوع' }, PM = { cod: 'عند الاستلام', wallet: 'محفظة', instapay: 'إنستا باي' };
app.get('/api/admin/orders', auth, can('orders'), wrap(async (req, res) => {
  const f = orderFilter(req.query), xl = req.query.format === 'xlsx';
  const list = db.prepare(`SELECT o.*,datetime(o.created_at,'localtime') local_at FROM orders o WHERE ${f.w} ORDER BY o.id DESC LIMIT ${xl ? 5000 : 300}`).all(...f.a).map(withItems);
  if (!xl) return res.json(list);
  await sendXlsx(res, 'orders', 'الطلبات', [['رقم', 8], ['التاريخ', 18], ['العميل', 20], ['الهاتف', 15], ['المحافظة', 14], ['المنطقة', 14], ['العنوان', 30], ['الأصناف', 50], ['المنتجات', 12], ['الشحن', 10], ['الإجمالي', 12], ['الدفع', 14], ['حالة الدفع', 16], ['حالة الطلب', 14], ['مرجع الدفع', 18], ['ملاحظات', 24]],
    list.map(o => [o.id, o.local_at, o.name, o.phone, o.governorate, o.area, o.address, o.items.map(i => `${i.name}${i.color ? ' [' + i.color + ']' : ''} ×${i.qty}`).join(' ; '), (o.total_cents - o.shipping_cents) / 100, o.shipping_cents / 100, o.total_cents / 100, PM[o.payment_method], PS[o.payment_status], ST[o.status], o.payment_ref, o.note]));
}));
app.patch('/api/admin/orders/:id', auth, can('orders'), wrap((req, res) => {
  const { status, payment_status: ps } = req.body, id = Number(req.params.id);
  if (status && !ST[status]) return fail(res, 400, 'حالة غير صحيحة');
  if (ps && !PS[ps]) return fail(res, 400, 'حالة دفع غير صحيحة');
  db.transaction(() => {
    const o = db.prepare('SELECT status FROM orders WHERE id=?').get(id); if (!o) return;
    if (status === 'cancelled' && o.status !== 'cancelled')
      db.prepare('SELECT i.product_id,SUM(i.qty) q,p.name,p.stock FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=? GROUP BY i.product_id').all(id).forEach(i => {
        if (i.stock === null) return; db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(i.q, i.product_id);
        audit(req.user.name, 'stock', { id: i.product_id, name: i.name }, `${i.stock} → ${i.stock + i.q} (إلغاء طلب #${id})`);
      });
    if (status) db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, id);
    if (ps) db.prepare('UPDATE orders SET payment_status=? WHERE id=?').run(ps, id);
  })();
  res.json({ ok: true });
}));
// ---------- Admin: حذف الطلبات الملغاة ----------
const delOrder = id => { db.prepare('DELETE FROM order_items WHERE order_id=?').run(id); db.prepare('DELETE FROM orders WHERE id=?').run(id); };
app.delete('/api/admin/orders/:id', auth, can('orders_delete'), wrap((req, res) => {
  const id = Number(req.params.id), o = db.prepare('SELECT id,status FROM orders WHERE id=?').get(id);
  if (!o) return fail(res, 404, 'الطلب غير موجود');
  if (o.status !== 'cancelled') return fail(res, 400, 'يمكن حذف الطلبات الملغاة فقط');
  db.transaction(() => { delOrder(id); audit(req.user.name, 'delete', { id: null, name: 'طلب #' + id }, 'حذف طلب ملغي'); })();
  res.json({ ok: true });
}));
app.post('/api/admin/orders/purge-cancelled', auth, can('orders_delete'), wrap((req, res) => {
  const ids = db.prepare("SELECT id FROM orders WHERE status='cancelled'").all().map(x => x.id);
  db.transaction(() => { ids.forEach(delOrder); if (ids.length) audit(req.user.name, 'delete', { id: null, name: 'الطلبات الملغاة' }, `حذف ${ids.length} طلب ملغي`); })();
  res.json({ deleted: ids.length });
}));
// ---------- Admin: حسابات الموظفين وصلاحياتهم (للمدير فقط) ----------
const staffRow = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active !== 0, perms: permsOf(u), created_at: u.created_at });
const permList = v => [...new Set((Array.isArray(v) ? v : []).filter(x => PERMS.includes(x)))];
app.get('/api/admin/users', auth, admin, (req, res) => res.json(db.prepare("SELECT * FROM users WHERE role IN ('admin','staff') ORDER BY role='admin' DESC, id").all().map(staffRow)));
app.post('/api/admin/users', auth, admin, wrap((req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email, 120).toLowerCase(), pw = req.body.password;
  if (!name || !/^[a-z0-9._@\-]{3,60}$/.test(email) || typeof pw !== 'string' || pw.length < 8 || pw.length > 100) return fail(res, 400, 'أكمل الاسم واسم مستخدم (حروف إنجليزية وأرقام، 3 على الأقل) وكلمة مرور 8 أحرف على الأقل');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return fail(res, 409, 'اسم المستخدم مستخدم مسبقاً');
  const id = Number(db.prepare("INSERT INTO users(name,email,password,role,perms,active) VALUES(?,?,?,'staff',?,1)").run(name, email, bcrypt.hashSync(pw, 10), permList(req.body.perms).join(',')).lastInsertRowid);
  audit(req.user.name, 'create', { id: null, name: 'حساب ' + name }, 'إنشاء حساب موظف: ' + permList(req.body.perms).join(', '));
  res.json({ id });
}));
app.patch('/api/admin/users/:id', auth, admin, wrap((req, res) => {
  const id = Number(req.params.id), u = db.prepare("SELECT * FROM users WHERE id=? AND role='staff'").get(id);
  if (!u) return fail(res, 404, 'حساب الموظف غير موجود');
  const b = req.body;
  if (b.name !== undefined) { const n = str(b.name, 80); if (!n) return fail(res, 400, 'الاسم مطلوب'); db.prepare('UPDATE users SET name=? WHERE id=?').run(n, id); }
  if (b.perms !== undefined) db.prepare('UPDATE users SET perms=? WHERE id=?').run(permList(b.perms).join(','), id);
  if (b.active !== undefined) db.prepare('UPDATE users SET active=? WHERE id=?').run(b.active ? 1 : 0, id);
  if (b.password) { if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 100) return fail(res, 400, 'كلمة المرور 8 أحرف على الأقل'); db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(b.password, 10), id); }
  audit(req.user.name, 'status', { id: null, name: 'حساب ' + u.name }, 'تعديل حساب موظف');
  res.json({ ok: true });
}));
app.delete('/api/admin/users/:id', auth, admin, wrap((req, res) => {
  const id = Number(req.params.id), u = db.prepare("SELECT * FROM users WHERE id=? AND role='staff'").get(id);
  if (!u) return fail(res, 404, 'حساب الموظف غير موجود');
  if (db.prepare('SELECT 1 FROM orders WHERE user_id=?').get(id)) return fail(res, 409, 'لهذا الحساب طلبات. عطّله بدلاً من الحذف');
  db.prepare('DELETE FROM users WHERE id=?').run(id); audit(req.user.name, 'delete', { id: null, name: 'حساب ' + u.name }, 'حذف حساب موظف');
  res.json({ ok: true });
}));
app.get('/api/admin/reports', auth, can('reports'), wrap(async (req, res) => {
  const f = orderFilter({ from: req.query.from, to: req.query.to }), by = req.query.by, base = `${f.w} AND o.status!='cancelled'`;
  const Q = {
    product: [`SELECT i.name k1,'' k2,SUM(i.qty) c1,COUNT(DISTINCT o.id) c2,SUM(i.qty*i.price_cents) tot FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${base} GROUP BY i.product_id ORDER BY tot DESC`, ['المنتج', ''], ['الكمية', 'عدد الطلبات']],
    customer: [`SELECT o.name k1,o.phone k2,COUNT(*) c1,0 c2,SUM(o.total_cents) tot FROM orders o WHERE ${base} GROUP BY o.phone ORDER BY tot DESC`, ['العميل', 'الهاتف'], ['عدد الطلبات', '']],
    day: [`SELECT date(o.created_at,'localtime') k1,'' k2,COUNT(*) c1,SUM(o.shipping_cents) c2,SUM(o.total_cents) tot FROM orders o WHERE ${base} GROUP BY k1 ORDER BY k1 DESC`, ['اليوم', ''], ['عدد الطلبات', 'الشحن']],
    governorate: [`SELECT o.governorate k1,'' k2,COUNT(*) c1,0 c2,SUM(o.total_cents) tot FROM orders o WHERE ${base} GROUP BY o.governorate ORDER BY tot DESC`, ['المحافظة', ''], ['عدد الطلبات', '']] }[by];
  if (!Q) return fail(res, 400, 'نوع تقرير غير صحيح');
  const rows = db.prepare(Q[0]).all(...f.a);
  if (req.query.format !== 'xlsx') return res.json({ heads: Q, rows });
  await sendXlsx(res, 'report-' + by, 'تقرير', [[Q[1][0], 28], [Q[1][1] || '-', 16], [Q[2][0], 14], [Q[2][1] || '-', 14], ['الإجمالي ج.م', 16]], rows.map(r => [r.k1, r.k2, r.c1, r.c2, r.tot / 100]));
}));

const INDEX = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const sendIndex = (req, res) => {
  const base = (req.protocol + '://' + req.get('host')).replace(/[<>"']/g, '');
  res.set('Cache-Control', 'no-cache').type('html').send(INDEX.split('__BASE__').join(base));
};
app.get(['/', '/index.html'], sendIndex);
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, setHeaders: (res, p) => { if (/\.(jpg|png|webp)$/i.test(p)) res.setHeader('Cache-Control', 'public, max-age=86400'); else res.setHeader('Cache-Control', 'no-cache'); } }));
app.use('/api', (req, res) => fail(res, 404, 'غير موجود'));
app.use((err, req, res, next) => { console.error(err); fail(res, 500, 'خطأ في الخادم'); });
db.ready.then(() => app.listen(process.env.PORT || 3000, () => { console.log('Bright Store on :' + (process.env.PORT || 3000)); if (process.env.TG_POLL !== 'false') tgPoll(); }));
