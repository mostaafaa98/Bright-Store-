# إتاحة المتجر من أي مكان

> GitHub يحفظ الكود فقط ولا يشغّل المتجر (Node + قاعدة بيانات). تحتاج استضافة تشغّل الخادم.

## الخيار 1 (الأفضل للتحكم والتكلفة): سيرفر VPS + دومين
1. اشترك في VPS صغير (1 CPU / 1–2GB يكفي) بنظام Ubuntu، وادخل بـ SSH.
2. ثبّت Docker: `curl -fsSL https://get.docker.com | sh`
3. وجّه الدومين (A record) إلى IP السيرفر، وعدّل `Caddyfile` بدومينك.
4. على السيرفر:
```bash
git clone https://github.com/mostaafaa98/Bright-Store-.git && cd Bright-Store-
cp .env.example .env && nano .env      # JWT_SECRET طويل عشوائي + بيانات المدير
docker compose up -d --build
```
HTTPS يتفعّل تلقائياً. القاعدة في مجلد `data/` — انسخه دورياً أو استخدم زر «نسخة احتياطية» في لوحة التحكم.
التحديث لاحقاً: `git pull && docker compose up -d --build`

## الخيار 2: منصة جاهزة (Render / Railway / Fly.io)
اربط مستودع GitHub، الأمر `npm start`، وأضف متغيرات `.env`، **وأضف Persistent Disk/Volume** مركّب على `/data` مع `DB_FILE=/data/store.db`
(بدون Disk ستضيع الطلبات عند كل إعادة تشغيل). ثم اربط الدومين من إعدادات المنصة.

## بعد النشر (مهم)
- غيّر كلمة مرور المدير، وضع `JWT_SECRET` عشوائي طويل.
- من «الإعدادات»: رقم واتساب، المحفظة/إنستا باي، تيليجرام، وأسعار الشحن.
- جرّب طلباً كاملاً من موبايل قبل الإعلان.
