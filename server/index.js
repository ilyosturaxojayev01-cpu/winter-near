/* ===================================================================
   Qurilish Do'koni - BACKEND (Express)
   Barcha ma'lumotlar server/data/ papkasida (VS Code ichida) saqlanadi:
     db.json        - foydalanuvchilar, mahsulotlar, buyurtmalar, kassa...
     logs.jsonl     - barcha harakatlar jurnali (log)
     backups/       - har kuni avtomatik zaxira nusxa
   =================================================================== */
  const express = require('express');
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://winter-near.netlify.app"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
  const crypto = require('crypto');
  const fs = require('fs');
  const path = require('path');

  const PORT = process.env.PORT || 5000;
  const DATA_DIR = path.join(__dirname, 'data');
  const BACKUP_DIR = path.join(DATA_DIR, 'backups');
  const DB_FILE = path.join(DATA_DIR, 'db.json');
  const LOG_FILE = path.join(DATA_DIR, 'logs.jsonl');
  const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
  const TZ = 5; // O'zbekiston vaqt zonasi (UTC+5)
  const STATUSES = ['Yangi', 'Tayyorlanmoqda', "Yo'lda", 'Yetkazildi', 'Bekor qilingan'];

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

/* ---------------- Xavfsizlik: parol va token ---------------- */
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'));
const SECRET = fs.readFileSync(SECRET_FILE, 'utf8');

const hashPw = (pw) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
};
const checkPw = (pw, stored) => {
  const [salt, h] = stored.split(':');
  const x = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(x, Buffer.from(h, 'hex'));
};
const hmac = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + hmac(body);
};
const verifyToken = (t) => {
  const [body, sig] = String(t).split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(hmac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
};

/* ---------------- Ma'lumotlar bazasi (JSON fayl) ---------------- */
const DEFAULT_SETTINGS = {
  storeName: "Qurilish Do'koni", phone: '+998 71 200 00 00', address: 'Toshkent shahri',
  deliveryFee: 30000, freeDeliveryFrom: 1000000,
  storeLat: 41.2995, storeLng: 69.2401, // do'kon joylashuvi (admin sozlamalarda o'zgartiradi)
  deliveryPerKm: 2000,                  // GPS bo'yicha masofa uchun 1 km narxi
  maxDeliveryKm: 40                     // 0 = cheklovsiz
};
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

function seed() {
  const now = Date.now();
  const P = (name, category, unit, packSize, packLabel, price, restockCost, stock, minStock, leadHours, emoji) =>
    ({ name, category, unit, packSize, packLabel, price, restockCost, stock, minStock, leadHours, emoji });
  const list = [
    // --- Quruq qorishmalar ---
    P('Eleron Qorishmasi', 'Quruq qorishmalar', 'kg', 25, 'qop', 40000, 30000, 40, 10, 3, '🧱'),
    P('Sement M400', 'Quruq qorishmalar', 'kg', 50, 'qop', 62000, 48000, 60, 15, 4, '🏗️'),
    P('Sement M500', 'Quruq qorishmalar', 'kg', 50, 'qop', 72000, 56000, 45, 12, 3, '🏗️'),
    P('Gips shpaklyovka', 'Quruq qorishmalar', 'kg', 25, 'qop', 55000, 42000, 30, 8, 4, '⬜'),
    P('Start shpaklyovka', 'Quruq qorishmalar', 'kg', 25, 'qop', 48000, 36000, 28, 8, 3, '⬜'),
    P('Gips (alebastr)', 'Quruq qorishmalar', 'kg', 20, 'qop', 32000, 23000, 35, 8, 4, '🥣'),
    P('Yuvilgan qum', 'Quruq qorishmalar', 'kg', 50, 'qop', 12000, 8000, 100, 20, 3, '🏖️'),
    P('Shag\'al (mayda)', 'Quruq qorishmalar', 'kg', 50, 'qop', 14000, 9500, 80, 20, 4, '🪨'),
    P('Pol uchun stjajka', 'Quruq qorishmalar', 'kg', 25, 'qop', 52000, 39000, 22, 6, 3, '🟫'),
    P('Issiqlik saqlovchi suvoq', 'Quruq qorishmalar', 'kg', 25, 'qop', 58000, 44000, 18, 6, 4, '🧱'),
    // --- Yelim va gruntovka ---
    P('Plitka yelimi', 'Yelim va gruntovka', 'kg', 25, 'qop', 45000, 34000, 25, 8, 3, '🔲'),
    P('Kafel yelimi (kuchaytirilgan)', 'Yelim va gruntovka', 'kg', 25, 'qop', 62000, 47000, 20, 6, 4, '🔲'),
    P('Gruntovka', 'Yelim va gruntovka', 'litr', 10, 'kanistra', 95000, 70000, 3, 4, 3, '🧴'),
    P('Chuqur kirish gruntovkasi', 'Yelim va gruntovka', 'litr', 5, 'kanistra', 65000, 48000, 14, 4, 4, '🧴'),
    P('PVA yelim', 'Yelim va gruntovka', 'litr', 5, 'chelak', 78000, 58000, 16, 5, 3, '🪣'),
    P('Montaj ko\'pigi', 'Yelim va gruntovka', 'dona', 1, 'ballon', 48000, 34000, 40, 10, 4, '🧯'),
    P('Silikon germetik', 'Yelim va gruntovka', 'dona', 1, 'tuba', 28000, 19000, 60, 15, 3, '🧴'),
    // --- Bo'yoq va lak ---
    P("Suv emulsiyali bo'yoq (oq)", "Bo'yoq va lak", 'litr', 10, 'chelak', 180000, 135000, 12, 4, 4, '🎨'),
    P("Fasad bo'yog'i (oq)", "Bo'yoq va lak", 'litr', 20, 'chelak', 420000, 320000, 8, 3, 3, '🏠'),
    P("Rangli kolyer (pigment)", "Bo'yoq va lak", 'litr', 1, 'shisha', 32000, 22000, 30, 8, 4, '🌈'),
    P('Parket laki', "Bo'yoq va lak", 'litr', 5, 'banka', 150000, 110000, 0, 3, 3, '🪵'),
    P('Yog\'och emali (qora)', "Bo'yoq va lak", 'litr', 3, 'banka', 98000, 72000, 15, 4, 4, '⚫'),
    P('Antiseptik (yog\'och uchun)', "Bo'yoq va lak", 'litr', 5, 'banka', 125000, 92000, 10, 3, 3, '🌲'),
    P('Rastvoritel 646', "Bo'yoq va lak", 'litr', 1, 'shisha', 18000, 12000, 50, 12, 4, '🧪'),
    // --- Metiz ---
    P('Dyubel', 'Metiz', 'dona', 100, 'quti', 25000, 17000, 50, 10, 3, '🔩'),
    P('Shurup (tez-tez, 3.5x35)', 'Metiz', 'dona', 200, 'quti', 22000, 15000, 45, 10, 4, '🔩'),
    P('Qurilish mixi 100 mm', 'Metiz', 'kg', 5, 'paket', 55000, 40000, 30, 8, 3, '📌'),
    P('Anker boltlar M10', 'Metiz', 'dona', 50, 'quti', 85000, 62000, 20, 5, 4, '⚓'),
    P('Rezba shpilka M8', 'Metiz', 'metr', 1, 'dona', 9000, 6000, 60, 15, 3, '🔧'),
    // --- Metall ---
    P('Armatura 12 mm', 'Metall', 'metr', 12, 'dona', 96000, 75000, 80, 20, 4, '⚙️'),
    P('Armatura 8 mm', 'Metall', 'metr', 12, 'dona', 52000, 40000, 70, 20, 3, '⚙️'),
    P('Profil truba 40x20', 'Metall', 'metr', 6, 'dona', 78000, 60000, 40, 10, 4, '📏'),
    P('Metall list 1.5 mm', 'Metall', 'kg', 25, 'list', 260000, 205000, 12, 4, 3, '🔳'),
    P('Gipsokarton profili (UD)', 'Metall', 'metr', 3, 'dona', 18000, 12500, 120, 30, 4, '📐'),
    P('Simli to\'r (setka, 50x50)', 'Metall', 'metr', 10, 'rulon', 135000, 102000, 14, 4, 3, '🕸️'),
    // --- Gisht va bloklar ---
    P('Qizil gisht', 'Gisht va bloklar', 'dona', 100, 'poddon-qism', 140000, 105000, 30, 8, 4, '🟥'),
    P('Gazobeton blok', 'Gisht va bloklar', 'dona', 10, 'paket', 185000, 142000, 25, 6, 3, '⬜'),
    P('Gipsokarton (12.5 mm)', 'Gisht va bloklar', 'dona', 1, 'list', 68000, 51000, 90, 20, 4, '🧊'),
    // --- Tom va izolyatsiya ---
    P('Penoplast 50 mm', 'Tom va izolyatsiya', 'dona', 1, 'list', 36000, 26000, 70, 15, 3, '🟦'),
    P('Mineral paxta', 'Tom va izolyatsiya', 'kg', 10, 'paket', 98000, 74000, 18, 5, 4, '☁️'),
    P('Gidroizolyatsiya (bitum)', 'Tom va izolyatsiya', 'metr', 10, 'rulon', 215000, 165000, 10, 3, 3, '🛢️'),
    P('Shifer (8 to\'lqinli)', 'Tom va izolyatsiya', 'dona', 1, 'list', 58000, 43000, 55, 12, 4, '🏚️'),
    // --- Santexnika ---
    P('PPR quvur 20 mm', 'Santexnika', 'metr', 4, 'dona', 24000, 17000, 90, 20, 3, '🚰'),
    P('PVX kanalizatsiya quvuri 110 mm', 'Santexnika', 'metr', 2, 'dona', 42000, 31000, 40, 10, 4, '🚽'),
    P('Sharovoy kran 1/2"', 'Santexnika', 'dona', 1, 'dona', 26000, 18000, 50, 12, 3, '🔧'),
    P('Smesitel (oshxona)', 'Santexnika', 'dona', 1, 'dona', 185000, 135000, 14, 4, 4, '🚿'),
    // --- Elektr ---
    P('Kabel VVG 3x2.5', 'Elektr', 'metr', 100, 'bukta', 1450000, 1150000, 6, 2, 3, '🔌'),
    P('Rozetka (ichki)', 'Elektr', 'dona', 1, 'dona', 14000, 9000, 100, 25, 4, '🔌'),
    P('LED lampa 12W', 'Elektr', 'dona', 10, 'quti', 98000, 70000, 30, 8, 3, '💡'),
    // --- Asboblar ---
    P('Bolg\'a 500 g', 'Asboblar', 'dona', 1, 'dona', 38000, 26000, 25, 6, 4, '🔨'),
    P('Shpatel to\'plami (3 dona)', 'Asboblar', 'dona', 3, 'to\'plam', 32000, 22000, 35, 8, 3, '🧰'),
    P('Uroven (60 sm)', 'Asboblar', 'dona', 1, 'dona', 55000, 38000, 20, 5, 4, '📏'),
    P('Valik va cho\'tka to\'plami', 'Asboblar', 'dona', 1, 'to\'plam', 45000, 31000, 40, 10, 3, '🖌️'),
    P('Qurilish qo\'lqopi (10 juft)', 'Asboblar', 'dona', 10, 'qadoq', 60000, 42000, 30, 8, 4, '🧤'),
    P('Himoya kaskasi', 'Asboblar', 'dona', 1, 'dona', 35000, 24000, 25, 6, 3, '⛑️')
  ];
  const products = list.map((p, i) => ({ id: i + 1, active: true, soldCount: 0, createdAt: now, ...p }));
  const d = {
    users: [
      { id: 1, name: 'Administrator', username: 'admin', phone: '', role: 'admin', password: hashPw('admin123'), blocked: false, createdAt: now },
      { id: 2, name: 'Demo Mijoz', username: 'mijoz', phone: '+998901234567', role: 'user', password: hashPw('mijoz123'), blocked: false, createdAt: now }
    ],
    products,
    orders: [],
    restocks: [],
    transactions: [{ id: 1, type: 'deposit', amount: 10000000, note: "Boshlang'ich kassa", balanceAfter: 10000000, at: now }],
    promos: [{ code: 'QURILISH10', type: 'percent', value: 10, minTotal: 200000, maxUses: 100, usedCount: 0, expiresAt: null, active: true }],
    settings: { ...DEFAULT_SETTINGS },
    cash: { balance: 10000000 },
    meta: { leadV3: true },
    counters: { user: 2, product: products.length, order: 0, restock: 0, tx: 1 }
  };
  return d;
}

let db;
if (fs.existsSync(DB_FILE)) {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) {
    console.error("db.json o'qib bo'lmadi! server/data/backups ichidagi nusxadan tiklang.", e.message);
    process.exit(1);
  }
} else {
  db = seed();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

db.settings = { ...DEFAULT_SETTINGS, ...(db.settings || {}) }; // eski bazalar uchun yangi sozlamalar

const dayKey = (ts) => new Date(ts + TZ * 3600e3).toISOString().slice(0, 10);

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE); // xavfsiz yozish: fayl yarim-yo'lda buzilmaydi
  const bk = path.join(BACKUP_DIR, `db-${dayKey(Date.now())}.json`);
  if (!fs.existsSync(bk)) {
    fs.copyFileSync(DB_FILE, bk);
    const files = fs.readdirSync(BACKUP_DIR).sort();
    files.slice(0, Math.max(0, files.length - 30)).forEach((f) => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  }
}

function log(user, action, details = '') {
  const line = JSON.stringify({ at: Date.now(), userId: user?.id ?? null, username: user?.username ?? '-', role: user?.role ?? '-', action, details });
  fs.appendFileSync(LOG_FILE, line + '\n');
}

/* Eski bazalar: yetkazish muddatini 3-4 soatga keltirish (bir marta) */
db.meta = db.meta || {};
if (!db.meta.leadV3) {
  db.products.forEach((p) => { p.leadHours = p.id % 2 ? 3 : 4; });
  db.restocks.forEach((r) => { if (r.status === "Yo'lda") r.expectedAt = Math.min(r.expectedAt, r.orderedAt + 4 * 3600e3); });
  db.meta.leadV3 = true;
  save();
}
const uzTime = (ts) => new Date(ts).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/* ---------------- Yordamchi funksiyalar ---------------- */
const label = (p) => `${p.packSize} ${p.unit} ${p.name}`;
const bad = (res, msg, extra = {}, code = 400) => res.status(code).json({ error: msg, ...extra });
const posInt = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
const nonNeg = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : -1; };
const nextCode = (prefix, key) => { db.counters[key] += 1; return `${prefix}-${String(db.counters[key]).padStart(4, '0')}`; };

function moveCash(type, signedAmount, note, extra = {}) {
  db.cash.balance += signedAmount;
  db.counters.tx += 1;
  db.transactions.push({ id: db.counters.tx, type, amount: signedAmount, note, balanceAfter: db.cash.balance, at: Date.now(), ...extra });
}

const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, phone: u.phone, role: u.role, createdAt: u.createdAt });
const publicProduct = (p) => ({
  id: p.id, name: p.name, category: p.category, unit: p.unit, packSize: p.packSize, packLabel: p.packLabel,
  price: p.price, stock: p.stock, minStock: p.minStock, emoji: p.emoji
});

/* Kelib bo'lgan buyurtmalarni avtomatik omborga qo'shish */
function processArrivals() {
  const now = Date.now();
  let changed = false;
  for (const r of db.restocks) {
    if (r.status === "Yo'lda" && r.expectedAt <= now) {
      const p = db.products.find((x) => x.id === r.productId);
      if (p) p.stock += r.packs;
      r.status = 'Qabul qilingan';
      r.receivedAt = now;
      r.auto = true;
      log(null, 'RESTOCK_ARRIVED', `${r.code}: ${r.productName} x${r.packs} avtomatik qabul qilindi`);
      changed = true;
    }
  }
  if (changed) save();
}

/* ---------------- Middleware ---------------- */
const app = express();
app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use('/api', (req, res, next) => { res.setHeader('X-Server-Time', String(Date.now())); processArrivals(); next(); });
setInterval(processArrivals, 15000); // hech kim so'rov yubormasa ham vaqti kelgan buyurtmalar omborga qo'shiladi

const auth = (required = true) => (req, res, next) => {
  const h = req.headers.authorization || '';
  const p = h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
  const u = p && db.users.find((x) => x.id === p.id);
  if (u && u.blocked) return bad(res, 'Hisobingiz bloklangan. Administrator bilan bog\'laning', {}, 403);
  if (u) { req.user = u; return next(); }
  if (!required) return next();
  return bad(res, 'Tizimga kiring', {}, 401);
};
const adminOnly = (req, res, next) => (req.user?.role === 'admin' ? next() : bad(res, 'Faqat administrator uchun', {}, 403));

/* ---------------- AUTH ---------------- */
const attempts = new Map(); // login urinishlarini cheklash
const tokenFor = (u) => signToken({ id: u.id, exp: Date.now() + 7 * 24 * 3600e3 });

app.post('/api/auth/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const phone = String(req.body.phone || '').trim();
  if (name.length < 2) return bad(res, "Ism kamida 2 ta belgi bo'lsin");
  if (!/^[a-z0-9_.]{3,30}$/.test(username)) return bad(res, "Login 3-30 ta belgi: lotin harflari, raqam, _ yoki .");
  if (password.length < 6) return bad(res, "Parol kamida 6 ta belgi bo'lsin");
  if (db.users.some((u) => u.username === username)) return bad(res, 'Bu login band, boshqasini tanlang');
  db.counters.user += 1;
  const u = { id: db.counters.user, name, username, phone, role: 'user', password: hashPw(password), blocked: false, createdAt: Date.now() };
  db.users.push(u);
  save();
  log(u, 'REGISTER', `Yangi foydalanuvchi: ${username}`);
  res.json({ token: tokenFor(u), user: publicUser(u) });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const a = attempts.get(username) || { n: 0, until: 0 };
  if (a.until > Date.now()) return bad(res, `Ko'p marta xato kiritildi. ${Math.ceil((a.until - Date.now()) / 60000)} daqiqadan keyin urinib ko'ring`, {}, 429);
  const u = db.users.find((x) => x.username === username);
  if (!u || !checkPw(password, u.password)) {
    a.n += 1;
    if (a.n >= 5) { a.until = Date.now() + 5 * 60000; a.n = 0; }
    attempts.set(username, a);
    log(null, 'LOGIN_FAILED', `Login: ${username}`);
    return bad(res, "Login yoki parol noto'g'ri", {}, 401);
  }
  if (u.blocked) return bad(res, "Hisobingiz bloklangan", {}, 403);
  attempts.delete(username);
  log(u, 'LOGIN', 'Tizimga kirdi');
  res.json({ token: tokenFor(u), user: publicUser(u) });
});

app.get('/api/auth/me', auth(), (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/auth/password', auth(), (req, res) => {
  const { oldPassword = '', newPassword = '' } = req.body;
  if (!checkPw(String(oldPassword), req.user.password)) return bad(res, "Eski parol noto'g'ri");
  if (String(newPassword).length < 6) return bad(res, "Yangi parol kamida 6 ta belgi bo'lsin");
  req.user.password = hashPw(String(newPassword));
  save();
  log(req.user, 'PASSWORD_CHANGE', "Parolni o'zgartirdi");
  res.json({ ok: true });
});

app.put('/api/auth/profile', auth(), (req, res) => {
  const name = String(req.body.name || '').trim();
  if (name.length < 2) return bad(res, "Ism kamida 2 ta belgi bo'lsin");
  req.user.name = name;
  req.user.phone = String(req.body.phone || '').trim();
  save();
  log(req.user, 'PROFILE_UPDATE', "Profilni yangiladi");
  res.json({ user: publicUser(req.user) });
});

/* ---------------- MAHSULOTLAR (hamma uchun) ---------------- */
app.get('/api/settings', (req, res) => res.json(db.settings));

app.get('/api/products', auth(false), (req, res) => {
  res.json(db.products.filter((p) => p.active).map(publicProduct));
});

/* Kelayotgan (yo'ldagi) buyurtmalar - alohida sahifa uchun */
app.get('/api/incoming', auth(), (req, res) => {
  const pending = db.restocks.filter((r) => r.status === "Yo'lda").sort((a, b) => a.expectedAt - b.expectedAt);
  const recent = db.restocks.filter((r) => r.status === 'Qabul qilingan').sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 8);
  const strip = (r) => ({ id: r.id, code: r.code, productName: r.productName, packs: r.packs, packLabel: r.packLabel, totalAmount: r.totalAmount, unit: r.unit, orderedAt: r.orderedAt, expectedAt: r.expectedAt, receivedAt: r.receivedAt, status: r.status });
  res.json({ pending: pending.map(strip), recent: recent.map(strip) });
});

/* ---------------- BUYURTMALAR (sotib olish) ---------------- */
function calcDiscount(promo, subtotal) {
  if (!promo) return 0;
  const d = promo.type === 'percent' ? Math.round((subtotal * promo.value) / 100) : promo.value;
  return Math.min(d, subtotal);
}
function findPromo(code, subtotal) {
  if (!code) return { promo: null };
  const promo = db.promos.find((p) => p.code === String(code).trim().toUpperCase());
  if (!promo || !promo.active) return { error: 'Promokod topilmadi yoki faol emas' };
  if (promo.expiresAt && promo.expiresAt < Date.now()) return { error: 'Promokod muddati tugagan' };
  if (promo.maxUses && promo.usedCount >= promo.maxUses) return { error: 'Promokod limiti tugagan' };
  if (subtotal < promo.minTotal) return { error: `Promokod uchun kamida ${promo.minTotal.toLocaleString('de-DE')} so'mlik xarid kerak` };
  return { promo };
}

app.post('/api/promo/check', auth(), (req, res) => {
  const { promo, error } = findPromo(req.body.code, Number(req.body.subtotal) || 0);
  if (error) return bad(res, error);
  res.json({ code: promo.code, type: promo.type, value: promo.value, minTotal: promo.minTotal });
});

app.post('/api/orders', auth(), (req, res) => {
  const { items, delivery = {}, payment = 'naqd', promo: promoCode } = req.body;
  if (!Array.isArray(items) || !items.length) return bad(res, "Savat bo'sh");
  const merged = new Map();
  for (const it of items) {
    const q = posInt(it.qty);
    if (!q) return bad(res, "Miqdor noto'g'ri");
    merged.set(Number(it.productId), (merged.get(Number(it.productId)) || 0) + q);
  }
  const lines = [];
  for (const [pid, qty] of merged) {
    const p = db.products.find((x) => x.id === pid && x.active);
    if (!p) return bad(res, 'Mahsulot topilmadi');
    if (p.stock < qty) {
      return bad(res, 'Mahsulot yetarli emas', { detail: `${label(p)} - omborda: ${p.stock} ${p.packLabel}`, productId: p.id, available: p.stock });
    }
    lines.push({ p, qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const { promo, error } = findPromo(promoCode, subtotal);
  if (error) return bad(res, error);
  const discount = calcDiscount(promo, subtotal);
  const dtype = delivery.type === 'olib ketish' ? 'olib ketish' : 'yetkazish';
  const address = String(delivery.address || '').trim();
  if (dtype === 'yetkazish' && address.length < 5) return bad(res, "Yetkazib berish manzilini kiriting yoki joylashuvni aniqlang");
  let lat = null, lng = null, km = null;
  if (dtype === 'yetkazish' && delivery.lat != null && delivery.lng != null) {
    lat = Number(delivery.lat); lng = Number(delivery.lng);
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return bad(res, "GPS koordinatalari noto'g'ri");
    const st = db.settings;
    if (st.storeLat != null && st.storeLng != null) {
      km = Math.round(haversine(st.storeLat, st.storeLng, lat, lng) * 10) / 10;
      if (st.maxDeliveryKm > 0 && km > st.maxDeliveryKm) return bad(res, 'Yetkazib berish hududidan tashqaridasiz', { detail: `Masofa ${km} km, maksimal ${st.maxDeliveryKm} km` });
    }
  }
  const deliveryFee = dtype === 'yetkazish' && subtotal - discount < db.settings.freeDeliveryFrom
    ? db.settings.deliveryFee + (km ? Math.round((km * db.settings.deliveryPerKm) / 100) * 100 : 0) : 0;
  const total = subtotal - discount + deliveryFee;
  const pay = ['naqd', 'karta', 'click', 'payme'].includes(payment) ? payment : 'naqd';

  for (const { p, qty } of lines) { p.stock -= qty; p.soldCount += qty; }
  if (promo) promo.usedCount += 1;
  const order = {
    id: db.counters.order + 1,
    code: nextCode('B', 'order'),
    userId: req.user.id, userName: req.user.name, phone: req.user.phone,
    items: lines.map(({ p, qty }) => ({
      productId: p.id, name: label(p), category: p.category, unit: p.unit, packSize: p.packSize, packLabel: p.packLabel,
      qty, price: p.price, cost: p.restockCost
    })),
    subtotal, discount, promo: promo ? promo.code : null, deliveryFee, total, payment: pay,
    delivery: { type: dtype, address: dtype === 'yetkazish' ? address : '', lat, lng, km },
    status: 'Yangi', createdAt: Date.now(), history: [{ status: 'Yangi', at: Date.now() }]
  };
  db.orders.push(order);
  moveCash('sale', total, `Sotuv: ${order.code} (${req.user.name})`, { orderId: order.id });
  save();
  log(req.user, 'ORDER_CREATE', `${order.code}: ${total} so'm, ${lines.length} xil mahsulot, kassaga +${total}`);
  res.json(order);
});

app.get('/api/orders', auth(), (req, res) => {
  const list = req.user.role === 'admin' ? db.orders : db.orders.filter((o) => o.userId === req.user.id);
  res.json([...list].sort((a, b) => b.createdAt - a.createdAt));
});

function cancelOrder(order, by) {
  for (const it of order.items) {
    const p = db.products.find((x) => x.id === it.productId);
    if (p) { p.stock += it.qty; p.soldCount = Math.max(0, p.soldCount - it.qty); }
  }
  moveCash('refund', -order.total, `Qaytarish: ${order.code}`, { orderId: order.id });
  order.status = 'Bekor qilingan';
  order.history.push({ status: 'Bekor qilingan', at: Date.now(), by: by.username });
  log(by, 'ORDER_CANCEL', `${order.code}: bekor qilindi, kassadan -${order.total} so'm qaytarildi`);
}

app.post('/api/orders/:id/cancel', auth(), (req, res) => {
  const o = db.orders.find((x) => x.id === Number(req.params.id));
  if (!o) return bad(res, 'Buyurtma topilmadi', {}, 404);
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && o.userId !== req.user.id) return bad(res, "Ruxsat yo'q", {}, 403);
  if (!isAdmin && o.status !== 'Yangi') return bad(res, "Faqat 'Yangi' buyurtmani bekor qilish mumkin");
  if (['Yetkazildi', 'Bekor qilingan'].includes(o.status)) return bad(res, "Bu buyurtmani bekor qilib bo'lmaydi");
  cancelOrder(o, req.user);
  save();
  res.json(o);
});

app.patch('/api/orders/:id/status', auth(), adminOnly, (req, res) => {
  const o = db.orders.find((x) => x.id === Number(req.params.id));
  if (!o) return bad(res, 'Buyurtma topilmadi', {}, 404);
  const { status } = req.body;
  if (!STATUSES.includes(status)) return bad(res, "Noto'g'ri holat");
  if (['Yetkazildi', 'Bekor qilingan'].includes(o.status)) return bad(res, "Yakunlangan buyurtma holatini o'zgartirib bo'lmaydi");
  if (status === 'Bekor qilingan') cancelOrder(o, req.user);
  else {
    o.status = status;
    o.history.push({ status, at: Date.now(), by: req.user.username });
    log(req.user, 'ORDER_STATUS', `${o.code}: ${status}`);
  }
  save();
  res.json(o);
});

/* ---------------- ADMIN: mahsulotlar ---------------- */
function readProduct(b) {
  const p = {
    name: String(b.name || '').trim(),
    category: String(b.category || '').trim() || 'Boshqa',
    unit: ['kg', 'litr', 'dona', 'metr'].includes(b.unit) ? b.unit : null,
    packSize: Number(b.packSize),
    packLabel: String(b.packLabel || 'dona').trim(),
    price: nonNeg(b.price),
    restockCost: nonNeg(b.restockCost),
    stock: nonNeg(b.stock),
    minStock: nonNeg(b.minStock),
    leadHours: posInt(b.leadHours) || 3,
    emoji: String(b.emoji || '📦').trim().slice(0, 4) || '📦'
  };
  if (p.name.length < 2) return { error: 'Mahsulot nomini kiriting' };
  if (!p.unit) return { error: "O'lchov birligini tanlang" };
  if (!(p.packSize > 0)) return { error: "Qadoq hajmi noto'g'ri" };
  if (p.price <= 0) return { error: "Sotuv narxi noto'g'ri" };
  if (p.restockCost <= 0) return { error: "Buyurtma narxi noto'g'ri" };
  if (p.stock < 0 || p.minStock < 0) return { error: "Ombor miqdori noto'g'ri" };
  return { p };
}

app.get('/api/admin/products', auth(), adminOnly, (req, res) => res.json(db.products));

app.post('/api/admin/products', auth(), adminOnly, (req, res) => {
  const { p, error } = readProduct(req.body);
  if (error) return bad(res, error);
  db.counters.product += 1;
  const prod = { id: db.counters.product, active: true, soldCount: 0, createdAt: Date.now(), ...p };
  db.products.push(prod);
  save();
  log(req.user, 'PRODUCT_CREATE', `${label(prod)} - ${prod.price} so'm`);
  res.json(prod);
});

app.put('/api/admin/products/:id', auth(), adminOnly, (req, res) => {
  const prod = db.products.find((x) => x.id === Number(req.params.id));
  if (!prod) return bad(res, 'Mahsulot topilmadi', {}, 404);
  const { p, error } = readProduct(req.body);
  if (error) return bad(res, error);
  const before = `${label(prod)} narx:${prod.price} ombor:${prod.stock}`;
  Object.assign(prod, p);
  if (typeof req.body.active === 'boolean') prod.active = req.body.active;
  save();
  log(req.user, 'PRODUCT_UPDATE', `${before} -> ${label(prod)} narx:${prod.price} ombor:${prod.stock}`);
  res.json(prod);
});

app.patch('/api/admin/products/:id/active', auth(), adminOnly, (req, res) => {
  const prod = db.products.find((x) => x.id === Number(req.params.id));
  if (!prod) return bad(res, 'Mahsulot topilmadi', {}, 404);
  prod.active = !!req.body.active;
  save();
  log(req.user, prod.active ? 'PRODUCT_RESTORE' : 'PRODUCT_ARCHIVE', label(prod));
  res.json(prod);
});

/* ---------------- ADMIN: yangi mahsulot buyurtma qilish (ta'minot) ---------------- */
app.get('/api/admin/restocks', auth(), adminOnly, (req, res) => {
  res.json([...db.restocks].sort((a, b) => b.orderedAt - a.orderedAt));
});

app.post('/api/admin/restocks', auth(), adminOnly, (req, res) => {
  const p = db.products.find((x) => x.id === Number(req.body.productId));
  if (!p) return bad(res, 'Mahsulot topilmadi', {}, 404);
  const packs = posInt(req.body.packs);
  if (!packs) return bad(res, "Miqdorni kiriting");
  const total = p.restockCost * packs;
  if (db.cash.balance < total) {
    return bad(res, "Kassada mablag' yetarli emas", { detail: `Kerak: ${total.toLocaleString('de-DE')} so'm, kassada: ${db.cash.balance.toLocaleString('de-DE')} so'm` });
  }
  const now = Date.now();
  const r = {
    id: db.counters.restock + 1, code: nextCode('T', 'restock'),
    productId: p.id, productName: label(p), packLabel: p.packLabel, unit: p.unit,
    packs, totalAmount: packs * p.packSize, unitCost: p.restockCost, total,
    orderedAt: now, expectedAt: now + p.leadHours * 3600e3, status: "Yo'lda"
  };
  db.restocks.push(r);
  moveCash('restock', -total, `Ta'minot: ${r.code} ${r.productName} x${packs}`, { restockId: r.id });
  save();
  log(req.user, 'RESTOCK_ORDER', `${r.code}: ${r.productName} x${packs} ${p.packLabel} = ${total} so'm, kassadan -${total}`);
  res.json(r);
});

app.post('/api/admin/restocks/:id/receive', auth(), adminOnly, (req, res) => {
  const r = db.restocks.find((x) => x.id === Number(req.params.id));
  if (!r) return bad(res, 'Buyurtma topilmadi', {}, 404);
  if (r.status !== "Yo'lda") return bad(res, 'Bu buyurtma allaqachon yakunlangan');
  if (r.expectedAt > Date.now()) {
    return bad(res, 'Mahsulot hali kelmagan, vaqtidan oldin qabul qilib bo\'lmaydi', { detail: `Kelish vaqti: ${uzTime(r.expectedAt)} (O'zbekiston vaqti, UTC+5)` });
  }
  const p = db.products.find((x) => x.id === r.productId);
  if (p) p.stock += r.packs;
  r.status = 'Qabul qilingan';
  r.receivedAt = Date.now();
  save();
  log(req.user, 'RESTOCK_RECEIVE', `${r.code}: ${r.productName} x${r.packs} omborga qabul qilindi`);
  res.json(r);
});

app.post('/api/admin/restocks/:id/cancel', auth(), adminOnly, (req, res) => {
  const r = db.restocks.find((x) => x.id === Number(req.params.id));
  if (!r) return bad(res, 'Buyurtma topilmadi', {}, 404);
  if (r.status !== "Yo'lda") return bad(res, "Faqat yo'ldagi buyurtmani bekor qilish mumkin");
  r.status = 'Bekor qilingan';
  moveCash('restock_refund', r.total, `Ta'minot bekor: ${r.code}`, { restockId: r.id });
  save();
  log(req.user, 'RESTOCK_CANCEL', `${r.code}: bekor qilindi, kassaga +${r.total} so'm qaytdi`);
  res.json(r);
});

/* ---------------- ADMIN: kassa ---------------- */
app.get('/api/admin/cash', auth(), adminOnly, (req, res) => {
  res.json({ balance: db.cash.balance, transactions: [...db.transactions].sort((a, b) => b.id - a.id) });
});

app.post('/api/admin/cash', auth(), adminOnly, (req, res) => {
  const { type, note = '' } = req.body;
  const amount = posInt(req.body.amount);
  if (!['deposit', 'expense'].includes(type)) return bad(res, "Noto'g'ri amal turi");
  if (!amount) return bad(res, "Summani kiriting");
  if (type === 'expense' && db.cash.balance < amount) return bad(res, "Kassada mablag' yetarli emas");
  const text = String(note).trim() || (type === 'deposit' ? "Kassani to'ldirish" : 'Xarajat');
  moveCash(type, type === 'deposit' ? amount : -amount, text);
  save();
  log(req.user, type === 'deposit' ? 'CASH_DEPOSIT' : 'CASH_EXPENSE', `${text}: ${amount} so'm`);
  res.json({ balance: db.cash.balance });
});

/* ---------------- ADMIN: hisobot ---------------- */
app.get('/api/admin/summary', auth(), adminOnly, (req, res) => {
  const now = Date.now();
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const valid = db.orders.filter((o) => o.status !== 'Bekor qilingan');
  const costOf = (o) => o.items.reduce((s, i) => s + i.cost * i.qty, 0);
  const profitOf = (o) => o.total - costOf(o);
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const expenses = db.transactions.filter((t) => t.type === 'expense');

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const k = dayKey(now - i * 864e5);
    const os = valid.filter((o) => dayKey(o.createdAt) === k);
    days.push({
      date: k, orders: os.length,
      revenue: sum(os, (o) => o.total), profit: sum(os, profitOf),
      expenses: -sum(expenses.filter((t) => dayKey(t.at) === k), (t) => t.amount)
    });
  }
  const top = new Map();
  const cats = new Map();
  for (const o of valid) {
    for (const i of o.items) {
      const t = top.get(i.productId) || { name: i.name, qty: 0, revenue: 0 };
      t.qty += i.qty; t.revenue += i.price * i.qty; top.set(i.productId, t);
      cats.set(i.category, (cats.get(i.category) || 0) + i.price * i.qty);
    }
  }
  const active = db.products.filter((p) => p.active);
  const todayOrders = valid.filter((o) => dayKey(o.createdAt) === today);
  const monthOrders = valid.filter((o) => dayKey(o.createdAt).startsWith(month));
  const totalProfit = sum(valid, profitOf);
  const totalExpenses = -sum(expenses, (t) => t.amount);
  res.json({
    balance: db.cash.balance,
    todayRevenue: sum(todayOrders, (o) => o.total), todayOrders: todayOrders.length,
    monthRevenue: sum(monthOrders, (o) => o.total), monthProfit: sum(monthOrders, profitOf),
    totalRevenue: sum(valid, (o) => o.total), totalProfit, totalExpenses, netProfit: totalProfit - totalExpenses,
    ordersCount: db.orders.length, newOrders: db.orders.filter((o) => o.status === 'Yangi').length,
    usersCount: db.users.filter((u) => u.role === 'user').length,
    pendingRestocks: db.restocks.filter((r) => r.status === "Yo'lda").length,
    inventoryCost: sum(active, (p) => p.stock * p.restockCost),
    inventoryRetail: sum(active, (p) => p.stock * p.price),
    lowStock: active.filter((p) => p.stock <= p.minStock).map((p) => ({ id: p.id, name: label(p), stock: p.stock, minStock: p.minStock, packLabel: p.packLabel })),
    days,
    topProducts: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    categories: [...cats.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue)
  });
});

/* ---------------- ADMIN: foydalanuvchilar, promokodlar, sozlamalar, log ---------------- */
app.get('/api/admin/users', auth(), adminOnly, (req, res) => {
  res.json(db.users.map((u) => {
    const os = db.orders.filter((o) => o.userId === u.id && o.status !== 'Bekor qilingan');
    return { ...publicUser(u), blocked: u.blocked, orders: os.length, spent: os.reduce((s, o) => s + o.total, 0) };
  }));
});

app.patch('/api/admin/users/:id', auth(), adminOnly, (req, res) => {
  const u = db.users.find((x) => x.id === Number(req.params.id));
  if (!u) return bad(res, 'Foydalanuvchi topilmadi', {}, 404);
  if (u.id === req.user.id) return bad(res, "O'zingizni bloklab bo'lmaydi");
  u.blocked = !!req.body.blocked;
  save();
  log(req.user, u.blocked ? 'USER_BLOCK' : 'USER_UNBLOCK', u.username);
  res.json({ ok: true });
});

app.get('/api/admin/promos', auth(), adminOnly, (req, res) => res.json(db.promos));

app.post('/api/admin/promos', auth(), adminOnly, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const type = req.body.type === 'fixed' ? 'fixed' : 'percent';
  const value = posInt(req.body.value);
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return bad(res, "Kod 3-20 ta lotin harf/raqam bo'lsin");
  if (!value || (type === 'percent' && value > 90)) return bad(res, "Chegirma qiymati noto'g'ri");
  if (db.promos.some((p) => p.code === code)) return bad(res, 'Bunday promokod mavjud');
  const promo = { code, type, value, minTotal: Math.max(0, nonNeg(req.body.minTotal)), maxUses: posInt(req.body.maxUses) || 0, usedCount: 0, expiresAt: null, active: true };
  db.promos.push(promo);
  save();
  log(req.user, 'PROMO_CREATE', `${code}: ${value}${type === 'percent' ? '%' : " so'm"}`);
  res.json(promo);
});

app.patch('/api/admin/promos/:code', auth(), adminOnly, (req, res) => {
  const p = db.promos.find((x) => x.code === req.params.code);
  if (!p) return bad(res, 'Promokod topilmadi', {}, 404);
  p.active = !!req.body.active;
  save();
  log(req.user, 'PROMO_TOGGLE', `${p.code}: ${p.active ? 'faol' : 'o\'chirilgan'}`);
  res.json(p);
});

app.delete('/api/admin/promos/:code', auth(), adminOnly, (req, res) => {
  db.promos = db.promos.filter((x) => x.code !== req.params.code);
  save();
  log(req.user, 'PROMO_DELETE', req.params.code);
  res.json({ ok: true });
});

app.put('/api/admin/settings', auth(), adminOnly, (req, res) => {
  const s = {
    storeName: String(req.body.storeName || '').trim() || db.settings.storeName,
    phone: String(req.body.phone || '').trim(),
    address: String(req.body.address || '').trim(),
    deliveryFee: Math.max(0, nonNeg(req.body.deliveryFee)),
    freeDeliveryFrom: Math.max(0, nonNeg(req.body.freeDeliveryFrom)),
    storeLat: req.body.storeLat === '' || req.body.storeLat == null ? null : Number(req.body.storeLat),
    storeLng: req.body.storeLng === '' || req.body.storeLng == null ? null : Number(req.body.storeLng),
    deliveryPerKm: Math.max(0, nonNeg(req.body.deliveryPerKm)),
    maxDeliveryKm: Math.max(0, nonNeg(req.body.maxDeliveryKm))
  };
  if ((s.storeLat != null && !(Math.abs(s.storeLat) <= 90)) || (s.storeLng != null && !(Math.abs(s.storeLng) <= 180))) return bad(res, "Do'kon koordinatalari noto'g'ri");
  db.settings = s;
  save();
  log(req.user, 'SETTINGS_UPDATE', JSON.stringify(s));
  res.json(s);
});

app.get('/api/admin/logs', auth(), adminOnly, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const limit = Math.min(1000, posInt(req.query.limit) || 300);
  let lines = [];
  if (fs.existsSync(LOG_FILE)) lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try {
      const l = JSON.parse(lines[i]);
      if (!q || `${l.username} ${l.action} ${l.details}`.toLowerCase().includes(q)) out.push(l);
    } catch { /* buzilgan qatorni o'tkazib yuboramiz */ }
  }
  res.json({ total: lines.length, logs: out });
});

/* ---------------- Frontend (build qilingandan keyin) ---------------- */
const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.use('/api', (req, res) => bad(res, 'API topilmadi', {}, 404));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server xatosi: ' + err.message });
});

app.listen(PORT, () => {
  log(null, 'SERVER_START', `Port ${PORT}`);
  console.log(`\n  🏗️  Qurilish Do'koni serveri ishga tushdi: http://localhost:${PORT}`);
  console.log('  Admin: admin / admin123   |   Mijoz: mijoz / mijoz123\n');
});
