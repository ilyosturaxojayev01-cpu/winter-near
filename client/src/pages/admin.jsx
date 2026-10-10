import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, nowTs } from '../api';
import { useToast } from '../context.jsx';
import { money, num, plabel, stockText, dt, dts, countdown, STATUSES, getPosition } from '../utils.js';
import { OrderList, useNow } from './shared.jsx';

const useLoad = (url) => {
  const [data, setData] = useState(null);
  const toast = useToast();
  const load = () => api.get(url).then(setData).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, [url]);
  return [data, load];
};
const Loading = () => <div className="center">Yuklanmoqda...</div>;
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card"><div className="row between"><h3>{title}</h3><button className="btn small" onClick={onClose}>✕</button></div>{children}</div>
    </div>
  );
}

/* ---------------- Boshqaruv paneli ---------------- */
export function Dashboard() {
  const [s] = useLoad('/admin/summary');
  if (!s) return <Loading />;
  const max = Math.max(1, ...s.days.map((d) => Math.max(d.revenue, d.expenses)));
  const stat = (icon, title, value, sub, cls = '') => (
    <div className={'card stat ' + cls}><div className="si">{icon}</div><div><div className="muted">{title}</div><div className="sv">{value}</div>{sub && <div className="muted small-t">{sub}</div>}</div></div>
  );
  return (
    <>
      <h2>📊 Boshqaruv paneli</h2>
      <div className="grid stats">
        {stat('💰', "Do'kon kassasi", money(s.balance), 'Hozirgi mablag\'', 'gold')}
        {stat('📈', 'Bugungi savdo', money(s.todayRevenue), `${s.todayOrders} ta buyurtma`)}
        {stat('🗓️', 'Oylik savdo', money(s.monthRevenue), `Foyda: ${money(s.monthProfit)}`)}
        {stat('✅', 'Sof foyda (umumiy)', money(s.netProfit), `Foyda ${money(s.totalProfit)} − xarajat ${money(s.totalExpenses)}`)}
        {stat('🆕', 'Yangi buyurtmalar', s.newOrders, `Jami: ${s.ordersCount}`)}
        {stat('🚚', "Yo'ldagi ta'minot", s.pendingRestocks, 'kutilmoqda')}
        {stat('📦', 'Ombor qiymati', money(s.inventoryCost), `Sotuv bahosi: ${money(s.inventoryRetail)}`)}
        {stat('👥', 'Mijozlar', s.usersCount, "ro'yxatdan o'tgan")}
      </div>
      <div className="two">
        <div className="card">
          <h3>So'nggi 7 kun</h3>
          <div className="chart">
            {s.days.map((d) => (
              <div key={d.date} className="col" title={`${d.date}\nSavdo: ${money(d.revenue)}\nFoyda: ${money(d.profit)}\nXarajat: ${money(d.expenses)}`}>
                <div className="bars">
                  <div className="bar rev" style={{ height: (d.revenue / max) * 100 + '%' }} />
                  <div className="bar exp" style={{ height: (d.expenses / max) * 100 + '%' }} />
                </div>
                <div className="lbl">{d.date.slice(5)}</div>
              </div>
            ))}
          </div>
          <div className="legend"><span><i className="rev" /> Savdo</span><span><i className="exp" /> Xarajat</span></div>
        </div>
        <div className="card">
          <h3>⚠️ Ombor ogohlantirishlari</h3>
          {s.lowStock.length === 0 ? <div className="muted">Hammasi joyida ✔</div> : (
            <table className="mini"><tbody>
              {s.lowStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.stock === 0 ? <span className="badge st-4">Tugagan</span> : <span className="badge st-1">{p.stock} {p.packLabel}</span>}</td>
                  <td><Link className="btn small primary" to={`/admin/restock?product=${p.id}`}>Buyurtma</Link></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      </div>
      <div className="two">
        <div className="card">
          <h3>🏆 Eng ko'p sotilgan</h3>
          {s.topProducts.length === 0 ? <div className="muted">Hali sotuv yo'q</div> : (
            <table className="mini"><tbody>{s.topProducts.map((t) => <tr key={t.name}><td>{t.name}</td><td>{t.qty} ta</td><td className="r">{money(t.revenue)}</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="card">
          <h3>🗂️ Kategoriyalar bo'yicha savdo</h3>
          {s.categories.length === 0 ? <div className="muted">Hali sotuv yo'q</div> : (
            <table className="mini"><tbody>{s.categories.map((c) => <tr key={c.name}><td>{c.name}</td><td className="r">{money(c.revenue)}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- Mahsulotlar ---------------- */
const emptyP = { name: '', category: 'Quruq qorishmalar', unit: 'kg', packSize: 25, packLabel: 'qop', price: '', restockCost: '', stock: 0, minStock: 5, leadHours: 3, emoji: '📦' };

export function Products() {
  const [list, load] = useLoad('/admin/products');
  const [edit, setEdit] = useState(null);
  const [showArch, setShowArch] = useState(false);
  const toast = useToast();
  if (!list) return <Loading />;
  const save = async (e) => {
    e.preventDefault();
    try {
      edit.id ? await api.put(`/admin/products/${edit.id}`, edit) : await api.post('/admin/products', edit);
      toast('Saqlandi'); setEdit(null); load();
    } catch (er) { toast(er.message, 'error'); }
  };
  const toggle = async (p) => { try { await api.patch(`/admin/products/${p.id}/active`, { active: !p.active }); load(); } catch (e) { toast(e.message, 'error'); } };
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });
  const cats = [...new Set(list.map((p) => p.category))];
  const shown = list.filter((p) => p.active || showArch);
  return (
    <>
      <div className="row between wrap">
        <h2>📦 Mahsulotlar</h2>
        <div className="row gap">
          <label className="check"><input type="checkbox" checked={showArch} onChange={(e) => setShowArch(e.target.checked)} /> Arxivdagilar</label>
          <button className="btn primary" onClick={() => setEdit({ ...emptyP })}>+ Yangi mahsulot</button>
        </div>
      </div>
      <div className="card scroll">
        <table>
          <thead><tr><th>Mahsulot</th><th>Sotuv narxi</th><th>Buyurtma narxi</th><th>Foyda</th><th>Ombor</th><th>Yetkazish</th><th /></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'dim'}>
                <td>{p.emoji} <b>{plabel(p)}</b><div className="muted small-t">{p.category}</div></td>
                <td>{money(p.price)}</td>
                <td>{money(p.restockCost)}</td>
                <td className="green-t">{money(p.price - p.restockCost)} ({Math.round(((p.price - p.restockCost) / p.restockCost) * 100)}%)</td>
                <td>{p.stock <= 0 ? <span className="badge st-4">Tugagan</span> : stockText(p)}{p.stock > 0 && p.stock <= p.minStock && <span className="badge st-1">Oz</span>}</td>
                <td>{p.leadHours} soat</td>
                <td className="nowrap">
                  <button className="btn small" onClick={() => setEdit({ ...p })}>✏️</button>{' '}
                  <button className="btn small" onClick={() => toggle(p)}>{p.active ? 'Arxiv' : 'Tiklash'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'} onClose={() => setEdit(null)}>
          <form className="form2" onSubmit={save}>
            <label>Nomi<input value={edit.name} onChange={set('name')} required /></label>
            <label>Belgi (emoji)<input value={edit.emoji} onChange={set('emoji')} maxLength={4} /></label>
            <label>Kategoriya<input list="cats" value={edit.category} onChange={set('category')} /><datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label>O'lchov birligi
              <select value={edit.unit} onChange={set('unit')}>
                <option value="kg">kg (qattiq)</option><option value="litr">litr (suyuq)</option><option value="dona">dona</option><option value="metr">metr</option>
              </select>
            </label>
            <label>Qadoq hajmi ({edit.unit})<input type="number" step="any" min="0" value={edit.packSize} onChange={set('packSize')} required /></label>
            <label>Qadoq nomi (qop, chelak...)<input value={edit.packLabel} onChange={set('packLabel')} required /></label>
            <label>Sotuv narxi (so'm / qadoq)<input type="number" min="0" value={edit.price} onChange={set('price')} required /></label>
            <label>Buyurtma narxi (so'm / qadoq)<input type="number" min="0" value={edit.restockCost} onChange={set('restockCost')} required /></label>
            <label>Ombordagi soni ({edit.packLabel})<input type="number" min="0" value={edit.stock} onChange={set('stock')} required /></label>
            <label>Minimal qoldiq (ogohlantirish)<input type="number" min="0" value={edit.minStock} onChange={set('minStock')} required /></label>
            <label>Yetkazib berish muddati (soat)<input type="number" min="1" value={edit.leadHours} onChange={set('leadHours')} required /></label>
            <div className="full muted">Ko'rinishi: <b>{edit.packSize} {edit.unit} {edit.name || '...'}</b> — {edit.price ? money(edit.price) : '? so\'m'}</div>
            <button className="btn primary full">Saqlash</button>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ---------------- Ta'minot: yangi mahsulot buyurtma qilish ---------------- */
export function Restock() {
  const [products] = useLoad('/admin/products');
  const [restocks, loadR] = useLoad('/admin/restocks');
  const [cash, loadC] = useLoad('/admin/cash');
  const [sp] = useSearchParams();
  const [pid, setPid] = useState(sp.get('product') || '');
  const [packs, setPacks] = useState(10);
  const toast = useToast();
  const now = useNow();
  if (!products || !restocks || !cash) return <Loading />;
  const p = products.find((x) => x.id === Number(pid));
  const cost = p ? p.restockCost * (Number(packs) || 0) : 0;
  const reload = () => { loadR(); loadC(); };
  const order = async (e) => {
    e.preventDefault();
    try { await api.post('/admin/restocks', { productId: Number(pid), packs: Number(packs) }); toast('Buyurtma berildi, kassadan to\'lov yechildi'); reload(); }
    catch (er) { toast(er.detail ? `${er.message}: ${er.detail}` : er.message, 'error'); }
  };
  const run = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (er) { toast(er.message, 'error'); } };
  return (
    <>
      <h2>🚚 Ta'minot — yangi mahsulot buyurtma qilish</h2>
      <div className="two">
        <form className="card stack" onSubmit={order}>
          <div className="cashbox">💰 Kassa: <b>{money(cash.balance)}</b></div>
          <label>Mahsulot
            <select value={pid} onChange={(e) => setPid(e.target.value)} required>
              <option value="">— tanlang —</option>
              {products.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{plabel(x)} (omborda: {x.stock})</option>)}
            </select>
          </label>
          <label>Nechta {p ? p.packLabel : 'qadoq'}<input type="number" min="1" value={packs} onChange={(e) => setPacks(e.target.value)} required /></label>
          {p && (
            <div className="muted">
              1 {p.packLabel} = {money(p.restockCost)} • Jami: <b>{num(packs * p.packSize)} {p.unit}</b><br />
              To'lov: <b className="gold-t">{money(cost)}</b> • Yetib kelishi: <b>{p.leadHours} soatdan keyin</b> ({dt(now + p.leadHours * 3600e3)}, UZT)
              {cost > cash.balance && <div className="red-t">⚠ Kassada mablag' yetarli emas</div>}
            </div>
          )}
          <button className="btn primary" disabled={!p || cost > cash.balance}>Buyurtma berish</button>
        </form>
        <div className="card">
          <h3>Eslatma</h3>
          <p className="muted">Buyurtma berilganda to'lov summasi do'kon kassasidan ayriladi. Mahsulot belgilangan muddatda (3-4 soat) avtomatik omborga qo'shiladi, vaqtidan oldin qabul qilib bo'lmaydi. Barcha vaqtlar O'zbekiston vaqti (UTC+5) bilan. Foydalanuvchilar kelish vaqtini «Kelayotgan» sahifasida ko'radi.</p>
          <p className="muted">Yo'ldagi buyurtmani bekor qilsangiz, pul kassaga qaytadi.</p>
        </div>
      </div>
      <h3>Buyurtmalar tarixi</h3>
      <div className="card scroll">
        <table>
          <thead><tr><th>Kod</th><th>Mahsulot</th><th>Miqdor</th><th>To'lov</th><th>Holat</th><th>Muddat</th><th /></tr></thead>
          <tbody>
            {restocks.map((r) => (
              <tr key={r.id}>
                <td>{r.code}</td><td>{r.productName}</td><td>{r.packs} {r.packLabel}</td><td>{money(r.total)}</td>
                <td><span className={'badge ' + (r.status === "Yo'lda" ? 'st-2' : r.status === 'Qabul qilingan' ? 'st-3' : 'st-4')}>{r.status}</span></td>
                <td className="small-t">{r.status === "Yo'lda" ? <>{countdown(r.expectedAt, now)}<br />{dts(r.expectedAt)}</> : dt(r.receivedAt || r.orderedAt)}</td>
                <td className="nowrap">
                  {r.status === "Yo'lda" && (
                    <>
                      <button className="btn small primary" disabled={r.expectedAt > now} title={r.expectedAt > now ? 'Mahsulot hali kelmagan' : ''} onClick={() => run(() => api.post(`/admin/restocks/${r.id}/receive`), 'Omborga qabul qilindi')}>Qabul qilish</button>{' '}
                      <button className="btn small danger" onClick={() => confirm('Bekor qilib, pulni kassaga qaytarasizmi?') && run(() => api.post(`/admin/restocks/${r.id}/cancel`), 'Bekor qilindi, pul qaytdi')}>Bekor</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!restocks.length && <tr><td colSpan="7" className="muted">Hali buyurtma yo'q</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- Kassa ---------------- */
const TX = { sale: ['Sotuv', 'green-t'], refund: ['Qaytarish', 'red-t'], restock: ["Ta'minot", 'red-t'], restock_refund: ["Ta'minot qaytdi", 'green-t'], deposit: ["Kassa to'ldirish", 'green-t'], expense: ['Xarajat', 'red-t'] };

export function Cash() {
  const [data, load] = useLoad('/admin/cash');
  const [f, setF] = useState({ type: 'expense', amount: '', note: '' });
  const [flt, setFlt] = useState('all');
  const toast = useToast();
  if (!data) return <Loading />;
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post('/admin/cash', f); toast('Saqlandi'); setF({ ...f, amount: '', note: '' }); load(); } catch (er) { toast(er.message, 'error'); }
  };
  const list = data.transactions.filter((t) => flt === 'all' || t.type === flt);
  const income = data.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outcome = -data.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  return (
    <>
      <h2>💰 Do'kon kassasi</h2>
      <div className="grid stats">
        <div className="card stat gold"><div className="si">💰</div><div><div className="muted">Kassadagi mablag'</div><div className="sv">{money(data.balance)}</div></div></div>
        <div className="card stat"><div className="si">⬇️</div><div><div className="muted">Jami kirim</div><div className="sv green-t">{money(income)}</div></div></div>
        <div className="card stat"><div className="si">⬆️</div><div><div className="muted">Jami chiqim</div><div className="sv red-t">{money(outcome)}</div></div></div>
      </div>
      <form className="card row gap wrap end" onSubmit={submit}>
        <label>Amal<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="expense">Xarajat (ijara, maosh, kommunal...)</option><option value="deposit">Kassani to'ldirish</option></select></label>
        <label>Summa (so'm)<input type="number" min="1" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></label>
        <label className="grow">Izoh<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Masalan: Oylik ijara" /></label>
        <button className="btn primary">Saqlash</button>
      </form>
      <div className="row between wrap"><h3>Operatsiyalar</h3>
        <select value={flt} onChange={(e) => setFlt(e.target.value)}>
          <option value="all">Hammasi</option>{Object.entries(TX).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
        </select>
      </div>
      <div className="card scroll">
        <table>
          <thead><tr><th>Vaqt</th><th>Turi</th><th>Izoh</th><th className="r">Summa</th><th className="r">Qoldiq</th></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td className="nowrap">{dt(t.at)}</td><td>{TX[t.type]?.[0] || t.type}</td><td>{t.note}</td>
                <td className={'r ' + (TX[t.type]?.[1] || '')}>{t.amount > 0 ? '+' : ''}{money(t.amount)}</td>
                <td className="r">{money(t.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- Barcha buyurtmalar ---------------- */
export function AdminOrders() {
  const [orders, load] = useLoad('/orders');
  const [store] = useLoad('/settings');
  const [flt, setFlt] = useState('all');
  const [q, setQ] = useState('');
  if (!orders) return <Loading />;
  const list = orders.filter((o) => (flt === 'all' || o.status === flt) && `${o.code} ${o.userName}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="row between wrap">
        <h2>🧾 Buyurtmalar</h2>
        <div className="row gap">
          <input className="search" placeholder="Kod yoki mijoz..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={flt} onChange={(e) => setFlt(e.target.value)}><option value="all">Hammasi</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
      </div>
      <OrderList orders={list} admin onChange={load} store={store} />
    </>
  );
}

/* ---------------- Foydalanuvchilar ---------------- */
export function Users() {
  const [users, load] = useLoad('/admin/users');
  const toast = useToast();
  if (!users) return <Loading />;
  const block = async (u) => { try { await api.patch(`/admin/users/${u.id}`, { blocked: !u.blocked }); load(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <>
      <h2>👥 Foydalanuvchilar</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>Ism</th><th>Login</th><th>Telefon</th><th>Rol</th><th>Buyurtmalar</th><th>Xaridlar</th><th>Ro'yxatdan o'tgan</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.blocked ? 'dim' : ''}>
                <td>{u.name}</td><td>{u.username}</td><td>{u.phone || '-'}</td><td>{u.role === 'admin' ? 'Administrator' : 'Mijoz'}</td>
                <td>{u.orders}</td><td>{money(u.spent)}</td><td className="small-t">{dt(u.createdAt)}</td>
                <td>{u.role !== 'admin' && <button className={'btn small ' + (u.blocked ? '' : 'danger')} onClick={() => block(u)}>{u.blocked ? 'Blokdan chiqarish' : 'Bloklash'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- Promokodlar va do'kon sozlamalari ---------------- */
export function Promos() {
  const [promos, load] = useLoad('/admin/promos');
  const [settings, loadS] = useLoad('/settings');
  const [f, setF] = useState({ code: '', type: 'percent', value: 10, minTotal: 0, maxUses: 0 });
  const [s, setS] = useState(null);
  const toast = useToast();
  useEffect(() => { if (settings) setS(settings); }, [settings]);
  if (!promos || !s) return <Loading />;
  const add = async (e) => { e.preventDefault(); try { await api.post('/admin/promos', f); toast("Promokod qo'shildi"); setF({ ...f, code: '' }); load(); } catch (er) { toast(er.message, 'error'); } };
  const saveS = async (e) => { e.preventDefault(); try { await api.put('/admin/settings', s); toast('Sozlamalar saqlandi'); loadS(); } catch (er) { toast(er.message, 'error'); } };
  return (
    <>
      <h2>🏷️ Aksiya va sozlamalar</h2>
      <div className="two">
        <form className="card form2" onSubmit={add}>
          <h3 className="full">Yangi promokod</h3>
          <label>Kod<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required placeholder="YANGI15" /></label>
          <label>Turi<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">Foiz (%)</option><option value="fixed">Summa (so'm)</option></select></label>
          <label>Qiymat<input type="number" min="1" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required /></label>
          <label>Minimal xarid (so'm)<input type="number" min="0" value={f.minTotal} onChange={(e) => setF({ ...f, minTotal: e.target.value })} /></label>
          <label>Foydalanish limiti (0 = cheksiz)<input type="number" min="0" value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} /></label>
          <button className="btn primary full">Qo'shish</button>
        </form>
        <form className="card form2" onSubmit={saveS}>
          <h3 className="full">Do'kon sozlamalari</h3>
          <label>Do'kon nomi<input value={s.storeName} onChange={(e) => setS({ ...s, storeName: e.target.value })} /></label>
          <label>Telefon<input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></label>
          <label className="full">Manzil<input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></label>
          <label>Yetkazish narxi (so'm)<input type="number" min="0" value={s.deliveryFee} onChange={(e) => setS({ ...s, deliveryFee: e.target.value })} /></label>
          <label>Bepul yetkazish (dan yuqori)<input type="number" min="0" value={s.freeDeliveryFrom} onChange={(e) => setS({ ...s, freeDeliveryFrom: e.target.value })} /></label>
          <label>1 km uchun narx (so'm)<input type="number" min="0" value={s.deliveryPerKm ?? 0} onChange={(e) => setS({ ...s, deliveryPerKm: e.target.value })} /></label>
          <label>Maks. yetkazish masofasi (km, 0 = cheksiz)<input type="number" min="0" value={s.maxDeliveryKm ?? 0} onChange={(e) => setS({ ...s, maxDeliveryKm: e.target.value })} /></label>
          <label>Do'kon kengligi (lat)<input type="number" step="any" value={s.storeLat ?? ''} onChange={(e) => setS({ ...s, storeLat: e.target.value })} /></label>
          <label>Do'kon uzunligi (lng)<input type="number" step="any" value={s.storeLng ?? ''} onChange={(e) => setS({ ...s, storeLng: e.target.value })} /></label>
          <button type="button" className="btn full" onClick={async () => { try { const g = await getPosition(); setS({ ...s, storeLat: g.lat, storeLng: g.lng }); toast("Joriy joylashuv do'kon manzili qilib qo'yildi. Saqlashni bosing"); } catch (er) { toast(er.message, 'error'); } }}>📍 Do'kon joylashuvini GPS bilan aniqlash</button>
          <button className="btn primary full">Saqlash</button>
        </form>
      </div>
      <h3>Promokodlar</h3>
      <div className="card scroll">
        <table>
          <thead><tr><th>Kod</th><th>Chegirma</th><th>Min. xarid</th><th>Ishlatilgan</th><th>Holat</th><th /></tr></thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.code}>
                <td><b>{p.code}</b></td><td>{p.type === 'percent' ? p.value + '%' : money(p.value)}</td><td>{money(p.minTotal)}</td>
                <td>{p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ''}</td>
                <td><span className={'badge ' + (p.active ? 'st-3' : 'st-4')}>{p.active ? 'Faol' : "O'chirilgan"}</span></td>
                <td className="nowrap">
                  <button className="btn small" onClick={async () => { await api.patch(`/admin/promos/${p.code}`, { active: !p.active }); load(); }}>{p.active ? "O'chirish" : 'Yoqish'}</button>{' '}
                  <button className="btn small danger" onClick={async () => { if (confirm("Promokod o'chirilsinmi?")) { await api.del(`/admin/promos/${p.code}`); load(); } }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- Jurnal (loglar) ---------------- */
export function Logs() {
  const [q, setQ] = useState('');
  const [data, load] = useLoad('/admin/logs?limit=500&q=' + encodeURIComponent(q));
  if (!data) return <Loading />;
  return (
    <>
      <div className="row between wrap">
        <h2>📜 Log (loglar)</h2>
        <div className="row gap"><input className="search" placeholder="Qidirish..." value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn" onClick={load}>🔄</button></div>
      </div>
      <p className="muted">Jami yozuvlar: {data.total}. Fayl: <code>server/data/logs.jsonl</code> — sayt yopilsa ham o'chmaydi.</p>
      <div className="card scroll">
        <table>
          <thead><tr><th>Vaqt</th><th>Foydalanuvchi</th><th>Amal</th><th>Tafsilot</th></tr></thead>
          <tbody>
            {data.logs.map((l, i) => (
              <tr key={i}><td className="nowrap">{dt(l.at)}</td><td>{l.username} <span className="muted small-t">{l.role}</span></td><td><code>{l.action}</code></td><td>{l.details}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
