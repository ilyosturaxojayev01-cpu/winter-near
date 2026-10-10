/* Server vaqti bilan moslashtirilgan soat (foydalanuvchi qurilmasi soati noto'g'ri bo'lsa ham to'g'ri ishlaydi) */
const clock = { offset: 0 };
export const nowTs = () => Date.now() + clock.offset;

export const getToken = () => localStorage.getItem('qd_token');

async function req(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (getToken()) headers.Authorization = 'Bearer ' + getToken();
  let res;
  try {
    res = await fetch('https://winter-near.onrender.com/api' + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Serverga ulanib bo'lmadi. Backend ishlayotganini tekshiring");
  }
  const st = res.headers.get('X-Server-Time');
  if (st) clock.offset = Number(st) - Date.now();
  let data = null;
  try { data = await res.json(); } catch { /* bo'sh javob */ }
  if (!res.ok) {
    const e = new Error(data?.error || 'Xatolik yuz berdi');
    e.detail = data?.detail;
    e.status = res.status;
    throw e;
  }
  return data;
}

export const api = {
  get: (u) => req('GET', u),
  post: (u, b) => req('POST', u, b || {}),
  put: (u, b) => req('PUT', u, b || {}),
  patch: (u, b) => req('PATCH', u, b || {}),
  del: (u) => req('DELETE', u)
};
