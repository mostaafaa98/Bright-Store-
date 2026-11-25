const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database(process.env.DB_FILE || 'store.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// ترحيل: جدول الألوان القديم (كود فريد عام، بدون صور) إلى ألوان لكل خط إنتاج مع صورة
if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='colors'").get() && !db.prepare("SELECT 1 FROM pragma_table_info('colors') WHERE name='line'").get()) {
  db.transaction(() => { db.exec('DELETE FROM product_colors; DROP TABLE colors;'); })();
}
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_en TEXT DEFAULT '', category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'وحدة', description TEXT DEFAULT '', image_url TEXT DEFAULT '',
  p_retail INTEGER NOT NULL CHECK(p_retail>0), p_half INTEGER NOT NULL CHECK(p_half>0), p_whole INTEGER NOT NULL CHECK(p_whole>0),
  stock INTEGER CHECK(stock IS NULL OR stock>=0),           -- NULL = غير محدود
  has_colors INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS colors(
  id INTEGER PRIMARY KEY, code TEXT NOT NULL, line TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', hex TEXT NOT NULL DEFAULT '#cccccc',
  active INTEGER NOT NULL DEFAULT 1, image BLOB, thumb BLOB, UNIQUE(line, code));
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', payment_method TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_ref TEXT DEFAULT '', name TEXT, phone TEXT, address TEXT, note TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL, color TEXT, qty INTEGER NOT NULL, price_cents INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS product_colors(product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, color_id INTEGER NOT NULL REFERENCES colors(id) ON DELETE CASCADE, PRIMARY KEY(product_id,color_id));
CREATE TABLE IF NOT EXISTS product_images(id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, mime TEXT NOT NULL, data BLOB NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS zones(name TEXT PRIMARY KEY, fee_cents INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY, at TEXT DEFAULT CURRENT_TIMESTAMP, who TEXT, action TEXT, product_id INTEGER, product TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(id DESC);
`);
const hasCol = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c);
const addCol = (t, c, d) => { if (!hasCol(t, c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${d}`); };
['spec_weight', 'spec_count', 'spec_length', 'spec_material', 'spec_size', 'spec_usage'].forEach(c => addCol('products', c, "TEXT NOT NULL DEFAULT ''"));
addCol('products', 'hidden', 'INTEGER NOT NULL DEFAULT 0');
addCol('orders', 'governorate', "TEXT NOT NULL DEFAULT ''");
addCol('orders', 'area', "TEXT NOT NULL DEFAULT ''");
addCol('orders', 'shipping_cents', 'INTEGER NOT NULL DEFAULT 0');
addCol('orders', 'token', "TEXT NOT NULL DEFAULT ''");

const defaults = { shop_name: 'برايت للخيوط', half_min: '50', whole_min: '100', wallet_number: '01030869840', wallet_name: '',
  instapay_number: '01030869840', instapay_handle: 'mustafatelda98@instapay', instapay_qr: '/img/instapay-qr.jpg', instapay_link: 'https://ipn.eg/S/mustafatelda98/instapay/8g0p46', shipping_note: 'الشحن يُحسب حسب المحافظة قبل تأكيد الطلب.',
  whatsapp_number: '201034497729', telegram_token: '', telegram_chat: '', free_shipping_over: '0' };
for (const [k, v] of Object.entries(defaults)) db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(k, v);

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (ADMIN_EMAIL && ADMIN_PASSWORD && !db.prepare('SELECT 1 FROM users WHERE email=?').get(ADMIN_EMAIL.toLowerCase()))
  db.prepare("INSERT INTO users(name,email,password,role) VALUES('المدير',?,?,'admin')").run(ADMIN_EMAIL.toLowerCase(), bcrypt.hashSync(ADMIN_PASSWORD, 10));

if (!db.prepare('SELECT 1 FROM products LIMIT 1').get() && process.env.SEED !== 'false') {
  // [الاسم, English, القسم, الوحدة, الوصف, الصورة, قطاعي, نصف جملة, جملة, لها ألوان]  — أسعار 01/04/2026
  const P = [
    ['علبة برايت كوتن بارليه - لون واحد', 'Bright Pearl Cotton', 'كوتن بارليه', 'علبة', 'قطن مصري 100% طبقتين، 10 بكرات × 10 جم، 80 متر للبكرة', '/img/pearl.jpg', 115, 110, 100, 1],
    ['علبة برايت كوتن بارليه - متعدد الدرجات', 'Bright Pearl Cotton Multi', 'كوتن بارليه', 'علبة', 'قطن مصري 100%، 10 بكرات × 10 جم، ألوان متدرجة', '/img/pearl.jpg', 120, 115, 110, 1],
    ['علبة الأهرام سوبر بارليه - لون واحد', 'Super Bright Pearl Cotton', 'كوتن بارليه', 'علبة', 'أدق من برايت الأساسية، محرر مرتين، 10 بكرات × 10 جم', '/img/super.jpg', 150, 145, 140, 1],
    ['علبة الأهرام سوبر بارليه - متعدد الدرجات', 'Super Bright Pearl Cotton Multi', 'كوتن بارليه', 'علبة', 'أدق من برايت الأساسية، ألوان متدرجة', '/img/super.jpg', 155, 150, 145, 1],
    ['علبة شلات مالونيه (خيوط تطريز)', 'Bright Cotton Embroidery Floss', 'تطريز', 'علبة', 'قطن مصري طويل التيلة، 12 شلة × 2 جم، 8 متر للشلة، 250 لون', '/img/floss.jpg', 125, 120, 110, 1],
    ['شلات كروشيه بلس 100 جم', 'Bright Cottonish Plus', 'كروشيه', 'شلة', 'قطن مصري 100% 4 طبقات، 250 متر، إبر 1.5–3 مم', '/img/plus.jpg', 90, 85, 80, 1],
    ['شلات كروشيه سوبر بلس 100 جم', 'Bright Cottonish Super Plus', 'كروشيه', 'شلة', 'قطن مصري 100% 4 طبقات، أسمك درجة، 200 متر، إبر 3–4 مم', '/img/splus.jpg', 90, 85, 80, 1],
    ['شلات كروشيه 100 جم - متعدد الدرجات', 'Bright Cottonish Multi', 'كروشيه', 'شلة', 'قطن مصري 100%، ألوان متدرجة', '/img/plus.jpg', 100, 95, 90, 1],
    ['بكر كروشيه 50 جم', 'Bright Cotton Crochet', 'كروشيه', 'بكرة', 'قطن مصري 100% 3 طبقات، 230 متر، إبر 1–2.5 مم', '/img/crochet.jpg', 55, 52, 48, 1],
    ['شلات أكريليك فلافي 100 جم', 'Bright Acrylic Yarns (Fluffy)', 'أكريليك', 'شلة', 'أكريليك 100%، 180 متر، إبر 3.5–5 مم', '/img/acrylic.jpg', 63, 60, 54, 1],
    ['شلات كتان (خيش) خام - بالكيلو', 'Bright Eglin Burlap Linen', 'كتان', 'كيلو', 'كتان مصري 100%، خام', '/img/linen.jpg', 300, 275, 250, 0],
    ['شلات كتان (خيش) ألوان - بالكيلو', 'Bright Eglin Burlap Linen', 'كتان', 'كيلو', 'كتان مصري 100%، مصبوغ', '/img/linen.jpg', 350, 325, 300, 1],
    ['مكرمية قطن خام مبروم - بالكيلو', 'Bright Macrame', 'مكرمية', 'كيلو', 'قطن مصري 100%، مقاسات 2-3-4-5 مم', '/img/macrame.jpg', 125, 117, 110, 0],
    ['مكرمية قطن ألوان مبروم - بالكيلو', 'Bright Macrame', 'مكرمية', 'كيلو', 'قطن مصري 100%، ألوان ثابتة', '/img/macrame.jpg', 160, 150, 140, 1],
    ['مكرمية قطن خام محلول - بالكيلو', 'Bright Macrame', 'مكرمية', 'كيلو', 'قطن مصري 100%، خام محلول', '/img/macrame.jpg', 130, 122, 115, 0],
    ['مكرمية قطن ألوان محلول - بالكيلو', 'Bright Macrame', 'مكرمية', 'كيلو', 'قطن مصري 100%، ألوان محلول', '/img/macrame.jpg', 170, 160, 150, 1],
    ['خيوط السلسلة (بوليستر) - بالكيلو', 'Bright Polyester Macrame', 'سلسلة', 'كيلو', 'بوليستر 100%، ألوان ثابتة', '/img/chain.jpg', 120, 115, 110, 1],
    ['كوتن بارليه عادي - بالكيلو', 'Pearl Cotton (kg)', 'كوتن بارليه', 'كيلو', 'سعر موحد', '/img/pearl.jpg', 750, 750, 750, 1],
    ['كوتن بارليه متعدد الدرجات - بالكيلو', 'Pearl Cotton Multi (kg)', 'كوتن بارليه', 'كيلو', 'سعر موحد', '/img/pearl.jpg', 775, 775, 775, 1],
    ['علبة حياكة منزلية 500 متر - ألوان', 'Bright Sewing Threads', 'خيوط حياكة', 'علبة', 'بوليستر مغزول 100%، 12 بكرة × 500 متر', '/img/sewbox.jpg', 56, 56, 56, 1],
    ['علبة حياكة منزلية 500 متر - أبيض', 'Bright Sewing Threads', 'خيوط حياكة', 'علبة', 'بوليستر مغزول 100%، 12 بكرة × 500 متر', '/img/sewbox.jpg', 50, 50, 50, 0],
    ['كون حياكة 145 جم - ألوان', 'Bright Sewing Cone', 'خيوط حياكة', 'كون', 'بوليستر مغزول 100%، أرقام 2/40 - 2/20 - 3/20 - 2/60', '/img/sewing.jpg', 40, 40, 40, 1],
    ['كون حياكة 145 جم - أبيض', 'Bright Sewing Cone', 'خيوط حياكة', 'كون', 'بوليستر مغزول 100%، أرقام 2/40 - 2/20 - 3/20 - 2/60', '/img/sewing.jpg', 38, 38, 38, 0],
  ];
  const ins = db.prepare('INSERT INTO products(name,name_en,category,unit,description,image_url,p_retail,p_half,p_whole,has_colors,sort) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  P.forEach((p, i) => ins.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6] * 100, p[7] * 100, p[8] * 100, p[9], i));
}
// حساب نظام للطلبات التي تتم بدون تسجيل (لا يمكن الدخول به)
if (!db.prepare("SELECT 1 FROM users WHERE email='guest@system.local'").get())
  db.prepare("INSERT INTO users(name,email,password,role) VALUES('زائر','guest@system.local',?,'guest')").run(bcrypt.hashSync(require('crypto').randomBytes(24).toString('hex'), 10));

const flag = (k, fn) => { if (!db.prepare('SELECT 1 FROM settings WHERE key=?').get(k)) { db.transaction(fn)(); db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run(k, '1'); } };
// ألوان المنتجات الحقيقية: كل لون = كود + صورة، لكل خط إنتاج (seed/colors.json و seed/img و seed/thumb)
flag('seed_real_colors', () => {
  const fs = require('fs'), path = require('path'), dir = path.join(__dirname, 'seed');
  if (process.env.SEED === 'false' || !fs.existsSync(path.join(dir, 'colors.json'))) return;
  const M = JSON.parse(fs.readFileSync(path.join(dir, 'colors.json'), 'utf8'));
  const ins = db.prepare('INSERT OR IGNORE INTO colors(code,line,name,hex,image,thumb) VALUES(?,?,?,?,?,?)');
  const ids = {};
  for (const c of M.colors) {
    ins.run(c.code, c.line, '', c.hex, fs.readFileSync(path.join(dir, 'img', c.file)), fs.readFileSync(path.join(dir, 'thumb', c.file)));
    ids[c.line + '|' + c.code] = { id: db.prepare('SELECT id FROM colors WHERE line=? AND code=?').get(c.line, c.code).id, g: c.ginga };
  }
  const link = db.prepare('INSERT OR IGNORE INTO product_colors(product_id,color_id) VALUES(?,?)');
  for (const l of M.links) {
    const p = db.prepare('SELECT id FROM products WHERE name=?').get(l.product);
    if (!p) continue;
    for (const k of Object.keys(ids)) if (k.startsWith(l.line + '|') && ids[k].g === l.ginga) link.run(p.id, ids[k].id);
  }
});
// مواصفات المنتجات من كتالوج برايت
flag('mig_specs', () => {
  const S = { // الوزن | العدد | الطول | الخامة | المقاس | الاستخدام
    'علبة برايت كوتن بارليه': ['10 جم للبكرة', '10 بكرات في العلبة', '80 متر للبكرة', 'قطن مصري 100% طبقتين، محرر', '', 'كروشيه رفيع، تطريز، دانتيل ومفارش'],
    'علبة الأهرام سوبر بارليه': ['10 جم للبكرة', '10 بكرات في العلبة', 'أكثر من 80 متر للبكرة', 'قطن مصري 100% طبقتين، محرر مرتين', '', 'أدق من برايت الأساسية: دانتيل وأعمال دقيقة'],
    'علبة شلات مالونيه': ['2 جم للشلة', '12 شلة في العلبة', '8 متر للشلة', 'قطن مصري طويل التيلة 100%، قابل للتقسيم إلى 6 خيوط', '250 لون', 'التطريز اليدوي بأنواعه'],
    'شلات كروشيه بلس': ['100 جم', 'شلة', '250 متر', 'قطن مصري 100% أربعة طبقات، محرر', 'إبر 1.5 – 3 مم', 'كروشيه: شنط، ملابس، دمى أميجورومي'],
    'شلات كروشيه سوبر بلس': ['100 جم', 'شلة', '200 متر', 'قطن مصري 100% أربعة طبقات، أسمك من بلس', 'إبر 3 – 4 مم', 'كروشيه: شنط، ملابس، دمى أميجورومي'],
    'شلات كروشيه 100 جم': ['100 جم', 'شلة', '250 متر', 'قطن مصري 100% أربعة طبقات، ألوان متدرجة', 'إبر 1.5 – 3 مم', 'كروشيه: شنط، ملابس، إكسسوارات'],
    'بكر كروشيه 50 جم': ['50 جم', 'بكرة', '230 متر', 'قطن مصري 100% ثلاث طبقات، محرر', 'إبر 1 – 2.5 مم', 'كروشيه دقيق: مفارش، دانتيل، ملابس خفيفة'],
    'شلات أكريليك فلافي': ['100 جم', 'شلة', '180 متر', 'أكريليك 100%', 'إبر كروشيه 3.5 – 5 مم / تطريز يدوي 4 – 6 مم', 'طواقي، شالات، ملابس شتوية، تافتنج'],
    'شلات كتان': ['100 جم للشلة (يُباع بالكيلو)', '', '', 'كتان مصري 100%', '', 'شنط، قبعات، إكسسوارات'],
    'مكرمية قطن': ['يُباع بالكيلو', '', '', 'قطن مصري 100%', 'مقاسات 2 – 3 – 4 – 5 مم', 'تعليقات حائط، شنط، شباشب، ديكور'],
    'خيوط السلسلة': ['يُباع بالكيلو', '', '', 'بوليستر 100%', '', 'شنط وإكسسوارات كروشيه'],
    'علبة حياكة منزلية': ['', '12 بكرة في العلبة', '500 متر للبكرة', 'بوليستر مغزول 100%', 'أرقام 2/40 – 2/20 – 3/20 – 2/60', 'خياطة وحياكة منزلية'],
    'كون حياكة': ['145 جم', 'كون', '', 'بوليستر مغزول 100%', 'أرقام 2/40 – 2/20 – 3/20 – 2/60', 'خياطة وحياكة'],
  };
  const up = db.prepare('UPDATE products SET spec_weight=?,spec_count=?,spec_length=?,spec_material=?,spec_size=?,spec_usage=? WHERE id=? AND spec_material=\'\'');
  for (const p of db.prepare('SELECT id,name FROM products').all()) {
    const k = Object.keys(S).filter(n => p.name.startsWith(n)).sort((a, b) => b.length - a.length)[0];
    if (k) up.run(...S[k], p.id);
  }
});
// المحافظات وتكلفة الشحن (قيم مبدئية — يعدّلها المدير من الإعدادات)
if (!db.prepare('SELECT 1 FROM zones LIMIT 1').get()) {
  const Z = [[50, 'القاهرة', 'الجيزة'], [60, 'الإسكندرية', 'القليوبية'], [70, 'الغربية', 'الدقهلية', 'الشرقية', 'المنوفية', 'كفر الشيخ', 'البحيرة', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس'],
    [80, 'الفيوم', 'بني سويف', 'المنيا'], [100, 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان'], [130, 'مطروح', 'البحر الأحمر', 'الوادي الجديد', 'شمال سيناء', 'جنوب سيناء']];
  const ins = db.prepare('INSERT INTO zones(name,fee_cents,sort) VALUES(?,?,?)'); let i = 0;
  Z.forEach(([fee, ...names]) => names.forEach(n => ins.run(n, fee * 100, i++)));
}
module.exports = require('./wal')(db);
