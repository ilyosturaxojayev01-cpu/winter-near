# 🏗️ Onlayn Qurilish Do'koni

**Frontend:** React (Vite) • **Backend:** Express (Node.js) • **Ma'lumotlar:** `server/data/` papkasidagi JSON fayllar (VS Code ichida)

## Ishga tushirish (VS Code terminalida)

Node.js 18+ o'rnatilgan bo'lishi kerak.

```bash
npm run install-all     # bir marta: barcha kutubxonalarni o'rnatadi
npm run dev             # frontend + backend birga ishga tushadi
```

Brauzerda oching: **http://localhost:5173**

### Bitta server sifatida (production)
```bash
npm run build           # React ni yig'adi
npm start               # http://localhost:5000 (frontend + backend birga)
```

## Demo akkauntlar
| Rol | Login | Parol |
|---|---|---|
| Administrator | `admin` | `admin123` |
| Foydalanuvchi | `mijoz` | `mijoz123` |

Yangi foydalanuvchilar «Ro'yxatdan o'tish» orqali qo'shiladi. Xavfsizlik uchun admin parolini birinchi kirishdan keyin Profil bo'limida emas, ishga tushirishdan oldin `server/index.js` ichidagi `seed()` funksiyasida o'zgartirib qo'ying.

## Ma'lumotlar qayerda saqlanadi?
| Fayl | Mazmuni |
|---|---|
| `server/data/db.json` | foydalanuvchilar, mahsulotlar, buyurtmalar, kassa, promokodlar |
| `server/data/logs.jsonl` | barcha harakatlar jurnali (kim, qachon, nima qildi) |
| `server/data/backups/` | har kuni avtomatik zaxira (oxirgi 30 kun) |

Sayt yoki server o'chsa ham ma'lumotlar yo'qolmaydi. Bazani **noldan boshlash** uchun serverni to'xtatib `db.json` ni o'chiring.

## Yangi (v3) — tuzatishlar
- Yetkazib berish muddati endi **3-4 soat** (avval 24-72 soat edi). Eski `db.json` ham avtomatik shu muddatga o'tkaziladi.
- Barcha vaqtlar **O'zbekiston vaqti (UTC+5)** bilan ko'rsatiladi; hisoblagich **soniyalab real vaqtda** yuradi va server soatiga moslashadi (qurilma soati noto'g'ri bo'lsa ham).
- **Vaqtidan oldin qabul qilish taqiqlandi:** mahsulot kelishiga vaqt bor bo'lsa «Qabul qilish» tugmasi o'chiq turadi, server ham rad etadi. Vaqti kelganda mahsulot omborga o'zi qo'shiladi (har 15 soniyada tekshiriladi).

## Yangi (v2)
- **55 xil mahsulot**, 10 kategoriya: qorishmalar, yelim, bo'yoq, metiz, metall, gisht/bloklar, tom va izolyatsiya, santexnika, elektr, asboblar.
- **GPS orqali yetkazib berish:** savatda «📍 Joylashuvimni aniqlash» tugmasi → koordinata + manzil matni (OpenStreetMap, internet kerak) + xarita ko'rinishi. Do'kondan masofa (km) hisoblanadi, yetkazish narxi = asosiy narx + km × narx, hududdan tashqarida buyurtma berilmaydi. Buyurtmada «Xaritada ko'rish» havolasi (administrator ham ko'radi).
- Admin → **Aksiya va sozlamalar**: do'kon joylashuvi (GPS bilan aniqlash mumkin), 1 km narxi, maksimal masofa.
- GPS faqat `localhost` yoki HTTPS da ishlaydi va brauzer ruxsat so'raydi.
- Eski `db.json` bilan ishlayotgan bo'lsangiz: yangi mahsulotlar chiqishi uchun serverni to'xtatib `server/data/db.json` ni o'chiring (ma'lumotlar noldan boshlanadi). Yangi sozlamalar esa avtomatik qo'shiladi.

## Imkoniyatlar

**Foydalanuvchi sahifasi:** katalog (qidiruv, kategoriya, saralash) • narx va o'lchov birligi (`25 kg Eleron Qorishmasi — 40.000 so'm`, 1 kg narxi ham ko'rsatiladi) • savat • promokod • yetkazish/olib ketish • to'lov turi • buyurtmalar tarixi • bekor qilish • chek chop etish • kelayotgan mahsulotlar sahifasi (kelish vaqti hisoblagich bilan) • profil va parol almashtirish.

**Administrator sahifasi:**
- 📊 Boshqaruv: kassa, bugungi/oylik savdo, foyda, sof foyda, ombor qiymati, 7 kunlik grafik, eng ko'p sotilganlar, kategoriyalar, ombor ogohlantirishlari
- 📦 Mahsulotlar: qo'shish/tahrirlash/arxivlash, sotuv va buyurtma narxi, foyda foizi, minimal qoldiq
- 🚚 Ta'minot: mahsulot tugaganda yangi buyurtma (masalan Eleron uchun 30.000 so'm/qop), to'lov kassadan ayriladi, belgilangan vaqtda avtomatik omborga qo'shiladi (yoki qo'lda qabul / bekor qilib pulni qaytarish)
- 💰 Kassa: har bir kirim/chiqim, xarajat (ijara, maosh...) kiritish, kassani to'ldirish
- 🧾 Buyurtmalar: holatni boshqarish (Yangi → Tayyorlanmoqda → Yo'lda → Yetkazildi), bekor qilish (ombor va pul qaytadi)
- 👥 Foydalanuvchilar: ro'yxat, xaridlar summasi, bloklash
- 🏷️ Aksiya: promokodlar (foiz/summa, limit, minimal xarid), yetkazish narxi va do'kon sozlamalari
- 📜 Jurnal: barcha loglar, qidiruv bilan

**Pul oqimi qoidalari:** sotuv → kassaga `+`; ta'minot buyurtmasi → kassadan `−`; bekor qilingan sotuv → `−` (qaytarish); bekor qilingan ta'minot → `+`. Mahsulot yetmasa: **«Mahsulot yetarli emas»**.

**Xavfsizlik:** parollar `scrypt` bilan shifrlanadi, imzolangan token (7 kun), 5 marta xato parolda 5 daqiqa blok, admin API'lari faqat administrator uchun.

## Papka tuzilishi
```
qurilish-doni/
├─ server/        Express API (index.js) + data/
└─ client/        React (src/pages: Login, user, admin, shared)
```
