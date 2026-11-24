require('dotenv').config();
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), path = require('path');
const db = require('./db');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 24) { console.error('JWT_SECRET مطلوب (24 حرفاً على الأقل)'); process.exit(1); }
const prod = process.env.NODE_ENV === 'production';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: {
  ...helmet.contentSecurityPolicy.getDefaultDirectives(),
  'img-src': ["'self'", 'data:', 'https:'], 'upgrade-insecure-requests': prod ? [] : null } } }));
app.use(express.json({ limit: '700kb' }));

const wrap = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);
const fail = (res, code, error) => res.status(code).json({ error });
const sign = u => jwt.sign({ id: u.id, role: u.role, name: u.name }, SECRET, { expiresIn: '7d' });
const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').slice(7), SECRET); next(); }
  catch { fail(res, 401, 'يلزم تسجيل الدخول'); }
};
const admin = (req, res, next) => req.user.role === 'admin' ? next() : fail(res, 403, 'غير مسموح');
const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const okImg = v => typeof v === 'string' && v.length <= 400000 &&
  (/^(https:\/\/|\/img\/)[^\s"'<>]*$/.test(v) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) ? v : '';
const settings = () => Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r => [r.key, r.value]));
const tier = (p, q, s) => q >= +s.whole_min ? p.p_whole : q >= +s.half_min ? p.p_half : p.p_retail;
const money = v => Math.round(Number(v) * 100);

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
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(str(req.body.email, 120).toLowerCase());
  if (!u || typeof req.body.password !== 'string' || !bcrypt.compareSync(req.body.password, u.password))
    return fail(res, 401, 'البريد أو كلمة المرور غير صحيحة');
  res.json({ token: sign(u), user: { id: u.id, role: u.role, name: u.name } });
}));
app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));

// ---------- Public catalog ----------
app.get('/api/config', (req, res) => {
  const s = settings();
  res.json({ shop: s.shop_name, halfMin: +s.half_min, wholeMin: +s.whole_min, note: s.shipping_note,
    wallet: { number: s.wallet_number, name: s.wallet_name },
    instapay: { number: s.instapay_number, handle: s.instapay_handle, qr: s.instapay_qr } });
});
app.get('/api/products', (req, res) => res.json(db.prepare('SELECT * FROM products WHERE active=1 ORDER BY sort,id').all()));
app.get('/api/colors', (req, res) => res.json(db.prepare('SELECT id,code,name,hex FROM colors WHERE active=1 ORDER BY CAST(code AS INTEGER),code').all()));

// ---------- Admin: products ----------
function pBody(b) {
  const half = b.p_half === '' || b.p_half == null ? b.p_retail : b.p_half, whole = b.p_whole === '' || b.p_whole == null ? half : b.p_whole;
  const p = { name: str(b.name, 120), name_en: str(b.name_en, 120), category: str(b.category, 40), unit: str(b.unit, 20) || 'وحدة',
    description: str(b.description, 400), image_url: okImg(b.image_url), p_retail: money(b.p_retail), p_half: money(half), p_whole: money(whole),
    stock: b.stock === '' || b.stock == null ? null : Number(b.stock), has_colors: b.has_colors ? 1 : 0, sort: parseInt(b.sort, 10) || 0 };
  const okStock = p.stock === null || (Number.isInteger(p.stock) && p.stock >= 0);
  return p.name && p.category && p.p_retail > 0 && p.p_half > 0 && p.p_whole > 0 && okStock ? p : null;
}
const Q = 'name,name_en,category,unit,description,image_url,p_retail,p_half,p_whole,stock,has_colors,sort';
app.post('/api/admin/products', auth, admin, wrap((req, res) => {
  const p = pBody(req.body); if (!p) return fail(res, 400, 'بيانات المنتج غير صحيحة');
  const id = db.prepare(`INSERT INTO products(${Q}) VALUES(${Q.split(',').map(k => '@' + k)})`).run(p).lastInsertRowid;
  res.json({ id: Number(id) });
}));
app.put('/api/admin/products/:id', auth, admin, wrap((req, res) => {
  const p = pBody(req.body); if (!p) return fail(res, 400, 'بيانات المنتج غير صحيحة');
  db.prepare(`UPDATE products SET ${Q.split(',').map(k => k + '=@' + k)} WHERE id=@id`).run({ ...p, id: Number(req.params.id) });
  res.json({ ok: true });
}));
app.patch('/api/admin/products/:id/prices', auth, admin, wrap((req, res) => {
  const [a, b, c] = ['p_retail', 'p_half', 'p_whole'].map(k => money(req.body[k]));
  if (!(a > 0 && b > 0 && c > 0)) return fail(res, 400, 'أسعار غير صحيحة');
  db.prepare('UPDATE products SET p_retail=?,p_half=?,p_whole=? WHERE id=?').run(a, b, c, Number(req.params.id));
  res.json({ ok: true });
}));
app.post('/api/admin/prices/bump', auth, admin, wrap((req, res) => {
  const pct = Number(req.body.percent);
  if (!(pct >= -50 && pct <= 100) || pct === 0) return fail(res, 400, 'النسبة من -50 إلى 100');
  const f = 1 + pct / 100, r = c => `MAX(100,CAST(ROUND(${c}*${f}/100.0)*100 AS INTEGER))`;
  db.prepare(`UPDATE products SET p_retail=${r('p_retail')},p_half=${r('p_half')},p_whole=${r('p_whole')} WHERE active=1`).run();
  res.json({ ok: true });
}));
app.delete('/api/admin/products/:id', auth, admin, (req, res) => {
  db.prepare('UPDATE products SET active=0 WHERE id=?').run(Number(req.params.id)); res.json({ ok: true });
});

// ---------- Admin: colors / settings / stats ----------
app.post('/api/admin/colors/bulk', auth, admin, wrap((req, res) => {
  // كل سطر: الكود , الاسم , #لون   (أو مفصولة بـ Tab)
  const up = db.prepare('INSERT INTO colors(code,name,hex,active) VALUES(?,?,?,1) ON CONFLICT(code) DO UPDATE SET name=excluded.name,hex=excluded.hex,active=1');
  let n = 0;
  db.transaction(() => {
    for (const line of str(req.body.text, 60000).split('\n')) {
      const [code, name, hex] = line.split(/[,\t]/).map(s => s.trim());
      if (code && name && /^#[0-9a-f]{6}$/i.test(hex || '')) { up.run(code.slice(0, 20), name.slice(0, 40), hex); n++; }
    }
  })();
  res.json({ imported: n });
}));
app.delete('/api/admin/colors/:id', auth, admin, (req, res) => { db.prepare('UPDATE colors SET active=0 WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });
const SKEYS = ['shop_name', 'half_min', 'whole_min', 'wallet_number', 'wallet_name', 'instapay_number', 'instapay_handle', 'instapay_qr', 'shipping_note'];
app.get('/api/admin/settings', auth, admin, (req, res) => res.json(settings()));
app.put('/api/admin/settings', auth, admin, wrap((req, res) => {
  const b = req.body, h = parseInt(b.half_min, 10), w = parseInt(b.whole_min, 10);
  if (!(h >= 1 && w > h)) return fail(res, 400, 'حدّ الجملة يجب أن يكون أكبر من حدّ نصف الجملة');
  const set = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  db.transaction(() => SKEYS.forEach(k => set.run(k, k === 'instapay_qr' ? okImg(b[k]) : k === 'half_min' ? String(h) : k === 'whole_min' ? String(w) : str(b[k], 300))))();
  res.json({ ok: true });
}));
app.get('/api/admin/stats', auth, admin, (req, res) => {
  const one = (sql) => db.prepare(sql).get();
  res.json({
    today: one("SELECT COALESCE(SUM(total_cents),0) v FROM orders WHERE status!='cancelled' AND date(created_at)=date('now')").v,
    month: one("SELECT COALESCE(SUM(total_cents),0) v FROM orders WHERE status!='cancelled' AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now')").v,
    newOrders: one("SELECT COUNT(*) v FROM orders WHERE status='new'").v,
    review: one("SELECT COUNT(*) v FROM orders WHERE payment_status='review' AND status!='cancelled'").v,
    low: db.prepare('SELECT id,name,stock FROM products WHERE active=1 AND stock IS NOT NULL AND stock<=10 ORDER BY stock LIMIT 10').all() });
});

// ---------- Orders ----------
const withItems = o => ({ ...o, items: db.prepare('SELECT name,color,qty,price_cents FROM order_items WHERE order_id=?').all(o.id) });
const createOrder = db.transaction((uid, lines, info, method) => {
  const s = settings(), groups = new Map();
  for (const l of lines) {
    const p = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(l.id);
    if (!p) throw new Error('منتج غير موجود');
    let color = null;
    if (p.has_colors) {
      const c = db.prepare('SELECT * FROM colors WHERE id=? AND active=1').get(l.color);
      if (!c) throw new Error('اختر اللون: ' + p.name);
      color = `${c.code} - ${c.name}`;
    }
    const g = groups.get(p.id) || { p, q: 0, items: [] };
    g.q += l.qty; g.items.push([color, l.qty]); groups.set(p.id, g);
  }
  let total = 0; const rows = [];
  for (const { p, q, items } of groups.values()) {
    if (p.stock !== null) {
      if (p.stock < q) throw new Error('الكمية غير متوفرة: ' + p.name);
      db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(q, p.id);
    }
    const u = tier(p, q, s); total += u * q;
    items.forEach(([c, n]) => rows.push([p, c, n, u]));
  }
  const oid = db.prepare('INSERT INTO orders(user_id,total_cents,payment_method,name,phone,address,note) VALUES(?,?,?,?,?,?,?)')
    .run(uid, total, method, info.name, info.phone, info.address, info.note).lastInsertRowid;
  rows.forEach(([p, c, n, u]) => db.prepare('INSERT INTO order_items(order_id,product_id,name,color,qty,price_cents) VALUES(?,?,?,?,?,?)').run(oid, p.id, p.name, c, n, u));
  return { id: Number(oid), total };
});
app.post('/api/orders', auth, wrap((req, res) => {
  const lines = (Array.isArray(req.body.items) ? req.body.items.slice(0, 200) : []).map(i => ({ id: parseInt(i.id, 10), color: parseInt(i.color, 10) || 0, qty: parseInt(i.qty, 10) }))
    .filter(l => l.id > 0 && l.qty > 0 && l.qty <= 100000);
  const info = { name: str(req.body.name, 80), phone: str(req.body.phone, 20), address: str(req.body.address, 300), note: str(req.body.note, 300) };
  const method = ['cod', 'wallet', 'instapay'].includes(req.body.payment) ? req.body.payment : 'cod';
  if (!lines.length || !info.name || info.phone.length < 8 || !info.address) return fail(res, 400, 'أكمل بيانات الطلب');
  try { const r = createOrder(req.user.id, lines, info, method); res.json({ orderId: r.id, total: r.total, payment: method }); }
  catch (e) { fail(res, 409, e.message); }
}));
app.get('/api/orders', auth, (req, res) =>
  res.json(db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.user.id).map(withItems)));
app.post('/api/orders/:id/proof', auth, wrap((req, res) => {
  const ref = str(req.body.ref, 100); if (ref.length < 3) return fail(res, 400, 'اكتب رقم العملية أو الرقم المحوَّل منه');
  const r = db.prepare("UPDATE orders SET payment_ref=?, payment_status='review' WHERE id=? AND user_id=? AND payment_method IN ('wallet','instapay') AND payment_status!='paid' AND status!='cancelled'")
    .run(ref, Number(req.params.id), req.user.id);
  r.changes ? res.json({ ok: true }) : fail(res, 400, 'لا يمكن تحديث هذا الطلب');
}));
app.get('/api/admin/orders', auth, admin, (req, res) =>
  res.json(db.prepare('SELECT o.*,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 300').all().map(withItems)));
app.patch('/api/admin/orders/:id', auth, admin, wrap((req, res) => {
  const { status, payment_status: ps } = req.body, id = Number(req.params.id);
  if (status && !['new', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) return fail(res, 400, 'حالة غير صحيحة');
  if (ps && !['pending', 'review', 'paid'].includes(ps)) return fail(res, 400, 'حالة دفع غير صحيحة');
  db.transaction(() => {
    const o = db.prepare('SELECT status FROM orders WHERE id=?').get(id); if (!o) return;
    if (status === 'cancelled' && o.status !== 'cancelled')
      db.prepare('SELECT product_id,SUM(qty) q FROM order_items WHERE order_id=? GROUP BY product_id').all(id)
        .forEach(i => db.prepare('UPDATE products SET stock=stock+? WHERE id=? AND stock IS NOT NULL').run(i.q, i.product_id));
    if (status) db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, id);
    if (ps) db.prepare('UPDATE orders SET payment_status=? WHERE id=?').run(ps, id);
  })();
  res.json({ ok: true });
}));

app.use(express.static(path.join(__dirname, 'public'), { maxAge: prod ? '1d' : 0 }));
app.use('/api', (req, res) => fail(res, 404, 'غير موجود'));
app.use((err, req, res, next) => { console.error(err); fail(res, 500, 'خطأ في الخادم'); });
app.listen(process.env.PORT || 3000, () => console.log('Bright Store on :' + (process.env.PORT || 3000)));
