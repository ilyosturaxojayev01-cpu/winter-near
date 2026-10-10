import { useEffect, useState } from 'react';
import { api, nowTs } from '../api';
import { useToast } from '../context.jsx';
import { money, num, dt, dts, countdown, STATUSES, PAY, printReceipt, mapLink } from '../utils.js';

export function useNow(ms = 1000) {
  const [now, setNow] = useState(nowTs());
  useEffect(() => { const t = setInterval(() => setNow(nowTs()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export const Badge = ({ status }) => <span className={'badge st-' + STATUSES.indexOf(status)}>{status}</span>;

/* Kelayotgan (yo'ldagi) mahsulotlar sahifasi - foydalanuvchi va admin uchun */
export function Incoming() {
  const [data, setData] = useState(null);
  const toast = useToast();
  const now = useNow();
  useEffect(() => {
    const load = () => api.get('/incoming').then(setData).catch((e) => toast(e.message, 'error'));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  if (!data) return <div className="center">Yuklanmoqda...</div>;
  return (
    <>
      <h2>🚚 Kelayotgan mahsulotlar</h2>
      <p className="muted">Do'konga yangi buyurtma qilingan mahsulotlar qachon kelishi shu yerda ko'rsatiladi. Vaqt: O'zbekiston vaqti (UTC+5), hisoblagich real vaqtda yuradi.</p>
      {data.pending.length === 0 && <div className="card empty">Hozircha yo'lda mahsulot yo'q.</div>}
      <div className="grid">
        {data.pending.map((r) => (
          <div key={r.id} className="card">
            <div className="row between"><b>{r.productName}</b><span className="badge st-2">Yo'lda</span></div>
            <div className="muted">{r.code} • {num(r.packs)} {r.packLabel} ({num(r.totalAmount)} {r.unit})</div>
            <div className="eta">⏳ {countdown(r.expectedAt, now)}</div>
            <div className="muted small-t">Buyurtma: {dt(r.orderedAt)}<br />Kutilayotgan vaqt: <b>{dts(r.expectedAt)}</b></div>
          </div>
        ))}
      </div>
      {data.recent.length > 0 && (
        <>
          <h3>Yaqinda kelganlar</h3>
          <div className="card">
            <table>
              <thead><tr><th>Mahsulot</th><th>Miqdor</th><th>Kelgan vaqti</th></tr></thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id}><td>{r.productName}</td><td>{num(r.packs)} {r.packLabel}</td><td>{dt(r.receivedAt)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/* Buyurtmalar ro'yxati (mijoz va admin) */
export function OrderList({ orders, admin, onChange, store }) {
  const toast = useToast();
  const act = async (fn, okMsg) => {
    try { await fn(); toast(okMsg); onChange(); } catch (e) { toast(e.message, 'error'); }
  };
  if (!orders.length) return <div className="card empty">Buyurtmalar topilmadi.</div>;
  return (
    <div className="stack">
      {orders.map((o) => {
        const done = ['Yetkazildi', 'Bekor qilingan'].includes(o.status);
        return (
          <div key={o.id} className="card">
            <div className="row between wrap">
              <div><b>{o.code}</b> <span className="muted">• {dt(o.createdAt)}{admin && ` • ${o.userName}${o.phone ? ' ' + o.phone : ''}`}</span></div>
              <Badge status={o.status} />
            </div>
            <table className="mini">
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.productId}>
                    <td>{i.name}</td>
                    <td>{i.qty} {i.packLabel} × {num(i.price)}</td>
                    <td className="r">{money(i.qty * i.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row between wrap">
              <div className="muted small-t">
                {o.delivery.type === 'yetkazish' ? `🚚 ${o.delivery.address}` : "🏪 Do'kondan olib ketish"}{o.delivery.lat != null && <> • <a href={mapLink(o.delivery.lat, o.delivery.lng)} target="_blank" rel="noreferrer">📍 Xaritada{o.delivery.km != null ? ` (${o.delivery.km} km)` : ''}</a></>} • {PAY[o.payment]}
                {o.discount > 0 && ` • Chegirma ${o.promo}: -${money(o.discount)}`}
                {o.deliveryFee > 0 && ` • Yetkazish: ${money(o.deliveryFee)}`}
              </div>
              <div className="total">{money(o.total)}</div>
            </div>
            <div className="row gap wrap">
              <button className="btn small" onClick={() => printReceipt(o, store)}>🧾 Chek</button>
              {!done && !admin && o.status === 'Yangi' && (
                <button className="btn small danger" onClick={() => confirm('Buyurtmani bekor qilasizmi?') && act(() => api.post(`/orders/${o.id}/cancel`), 'Buyurtma bekor qilindi')}>Bekor qilish</button>
              )}
              {!done && admin && (
                <>
                  <select value={o.status} onChange={(e) => act(() => api.patch(`/orders/${o.id}/status`, { status: e.target.value }), 'Holat yangilandi')}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
