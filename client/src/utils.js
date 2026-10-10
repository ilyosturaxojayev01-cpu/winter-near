export const num = (n) => Number(n || 0).toLocaleString('de-DE');
export const money = (n) => num(Math.round(n)) + " so'm";
export const plabel = (p) => `${p.packSize} ${p.unit} ${p.name}`;
export const perUnit = (p) => `1 ${p.unit} = ${money(p.price / p.packSize)}`;
export const stockText = (p) => `${num(p.stock)} ${p.packLabel} (${num(+(p.stock * p.packSize).toFixed(2))} ${p.unit})`;
/* Barcha vaqtlar O'zbekiston vaqti bilan (UTC+5) */
export const dt = (ts) => (ts ? new Date(ts).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
export const dts = (ts) => (ts ? new Date(ts).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-');

export function countdown(ts, now = Date.now()) {
  const sec = Math.floor((ts - now) / 1000);
  if (sec <= 0) return 'Yetib keldi';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
  return [d ? `${d} kun` : '', h ? `${h} soat` : '', `${String(m).padStart(2, '0')} daqiqa`, `${String(x).padStart(2, '0')} soniya`].filter(Boolean).join(' ') + ' qoldi';
}

export const STATUSES = ['Yangi', 'Tayyorlanmoqda', "Yo'lda", 'Yetkazildi', 'Bekor qilingan'];
export const PAY = { naqd: 'Naqd pul', karta: 'Bank kartasi', click: 'Click', payme: 'Payme' };

export function calcDiscount(promo, subtotal) {
  if (!promo) return 0;
  const d = promo.type === 'percent' ? Math.round((subtotal * promo.value) / 100) : promo.value;
  return Math.min(d, subtotal);
}

export function printReceipt(o, store) {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return;
  const rows = o.items.map((i) => `<tr><td>${i.name}<br><small>${i.qty} ${i.packLabel} x ${num(i.price)}</small></td><td style="text-align:right">${num(i.qty * i.price)}</td></tr>`).join('');
  w.document.write(`<html><head><title>Chek ${o.code}</title><style>body{font-family:monospace;padding:16px;font-size:13px}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px dashed #999}h3,p{text-align:center;margin:4px 0}.t{display:flex;justify-content:space-between;margin-top:4px}</style></head><body>
  <h3>${store?.storeName || "Qurilish Do'koni"}</h3><p>${store?.address || ''} ${store?.phone || ''}</p><hr>
  <p>Chek: <b>${o.code}</b><br>${dt(o.createdAt)}<br>Mijoz: ${o.userName}</p><table>${rows}</table>
  <div class="t"><span>Jami:</span><span>${num(o.subtotal)}</span></div>
  ${o.discount ? `<div class="t"><span>Chegirma (${o.promo}):</span><span>-${num(o.discount)}</span></div>` : ''}
  <div class="t"><span>Yetkazish:</span><span>${num(o.deliveryFee)}</span></div>
  <div class="t"><b>TO'LOV:</b><b>${num(o.total)} so'm</b></div>
  <p>To'lov turi: ${PAY[o.payment] || o.payment}</p><hr><p>Xaridingiz uchun rahmat!</p>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

/* ---------- GPS / xarita ---------- */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}
export const mapLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
export const mapEmbed = (lat, lng) => {
  const d = 0.004;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
};

/* Brauzer GPS orqali joylashuvni aniqlash */
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Brauzeringiz GPS'ni qo'llab-quvvatlamaydi"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(e.code === 1 ? "Joylashuvga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering" : e.code === 3 ? 'Joylashuvni aniqlash vaqti tugadi, qayta urinib ko\'ring' : "Joylashuvni aniqlab bo'lmadi")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/* Koordinatadan manzil matni (OpenStreetMap Nominatim, internet kerak) */
export async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=uz,ru&lat=${lat}&lon=${lng}`);
    const j = await r.json();
    return j.display_name || '';
  } catch { return ''; }
}
