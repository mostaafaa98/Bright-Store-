const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database(process.env.DB_FILE || 'store.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
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
  id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, hex TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
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

const defaults = { shop_name: 'برايت للخيوط', half_min: '50', whole_min: '100', wallet_number: '', wallet_name: '',
  instapay_number: '', instapay_handle: '', instapay_qr: '', shipping_note: 'الشحن يُحدَّد عند تأكيد الطلب.' };
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
if (!db.prepare('SELECT 1 FROM colors LIMIT 1').get() && process.env.SEED !== 'false') {
  const C = ['أبيض #ffffff', 'أوف وايت #f5efe0', 'بيج #e6d3b3', 'كريمي #f3e5ab', 'أصفر ليموني #f7e463', 'أصفر #f5c518', 'برتقالي #f08a24', 'مشمشي #f6b48a',
    'سلمون #f28b82', 'وردي فاتح #f8c8dc', 'وردي #ee7fa6', 'فوشيا #d6246e', 'أحمر #d62828', 'قرمزي #a4161a', 'عنابي #7b1e3a', 'بوردو #5a1020',
    'بنفسجي فاتح #c5a8e0', 'بنفسجي #8e5bbf', 'موف #6a3d9a', 'أزرق سماوي #a6d8f0', 'أزرق فاتح #5aa9e6', 'أزرق #1f6fb2', 'كحلي #14284b', 'تركواز #2bb5b0',
    'أخضر نعناعي #a8e0c5', 'أخضر فاتح #8fd16a', 'أخضر #2f9e44', 'أخضر زيتي #6b7d2f', 'أخضر غامق #14532d', 'بني فاتح #c19a6b', 'بني #8b5a2b', 'شوكولاتة #4a2c1a',
    'رمادي فاتح #cfd4da', 'رمادي #8a8f98', 'فحمي #3a3f47', 'أسود #111111'];
  const ins = db.prepare('INSERT INTO colors(code,name,hex) VALUES(?,?,?)');
  C.forEach((c, i) => { const m = c.match(/^(.*) (#[0-9a-f]{6})$/i); ins.run(String(101 + i), m[1], m[2]); });
}
module.exports = db;
