# iCOOL Photo Branding App - v9 Clean Build

هذه نسخة نظيفة كاملة تعمل بدون أخطاء generate/generator وبدون معالجة الصورة على السيرفر.

## المهم

- لا يوجد `app/api/generate`
- لا يوجد `app/api/generator`
- الصورة تُعالج داخل الهاتف مباشرة عبر Canvas
- الشعار موجود في `public/icool-logo.png`
- السيرفر يستعمل فقط `/api/slogan` لاختيار slogan، وإذا لم يوجد OPENAI_API_KEY يعمل fallback تلقائيًا

## الملفات الأساسية

```text
app/page.jsx
app/globals.css
app/layout.jsx
app/api/slogan/route.js
public/icool-logo.png
public/icon-512.png
public/manifest.json
package.json
next.config.mjs
jsconfig.json
```

## الرفع على GitHub

ارفع محتويات هذا الملف مباشرة في root المشروع، وليس داخل فولدر إضافي.

الصحيح:
```text
app/
public/
package.json
next.config.mjs
```

الخطأ:
```text
icoolapp/app/
icoolapp/public/
```

## متغير اختياري في Vercel

إذا أردت slogan من قراءة الصورة بالذكاء:
```text
OPENAI_API_KEY=your_key
```

إذا لم تضعه، التطبيق يعمل بشكل طبيعي ويستعمل slogans جاهزة حسب نوع المشروع.

## اختبار

بعد deploy افتح:
```text
/api/slogan
```

يجب أن يرجع JSON فيه:
```json
{"ok":true,"version":"v9-clean"}
```
