import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth, useToast, useCart } from '../context.jsx';
import { money, plabel, perUnit, stockText, calcDiscount, PAY, getPosition, reverseGeocode, distanceKm, mapLink, mapEmbed } from '../utils.js';
import { OrderList } from './shared.jsx';

/* ---------------- Do'kon (katalog) ---------------- */
export function Shop() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Hammasi');
  const [sort, setSort] = useState('name');
  const cart = useCart();
  const toast = useToast();

  useEffect(() => { api.get('/products').then(setProducts).catch((e) => toast(e.message, 'error')); }, []);
  const cats = ['Hammasi', ...new Set(products.map((p) => p.category))];
  const list = useMemo(() => {
    let l = products.filter((p) => (cat === 'Hammasi' || p.category === cat) && plabel(p).toLowerCase().includes(q.toLowerCase()));
    if (sort === 'cheap') l = [...l].sort((a, b) => a.price - b.price);
    else if (sort === 'exp') l = [...l].sort((a, b) => b.price - a.price);
    else l = [...l].sort((a, b) => a.name.localeCompare(b.name));
    return l;
  }, [products, q, cat, sort]);

  const add = (p) => {
    if (p.stock <= 0 || cart.qtyOf(p.id) + 1 > p.stock) { toast('Mahsulot yetarli emas', 'error'); return; }
    cart.add(p.id, 1);
    toast(`${plabel(p)} savatga qo'shildi`);
  };

  return (
    <>
      <div className="row between wrap">
        <h2>Mahsulotlar</h2>
        <div className="row gap wrap">
          <input className="search" placeholder="🔍 Qidirish..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Nomi bo'yicha</option><option value="cheap">Arzonlari avval</option><option value="exp">Qimmatlari avval</option>
          </select>
        </div>
      </div>
      <div className="chips">
        {cats.map((c) => <button key={c} className={'chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="grid products">
        {list.map((p) => {
          const out = p.stock <= 0;
          const low = !out && p.stock <= p.minStock;
          return (
            <div key={p.id} className={'card product' + (out ? ' out' : '')}>
              <div className="emoji">{p.emoji}</div>
              <div className="pname">{plabel(p)}</div>
              <div className="muted">{p.category}</div>
              <div className="price">{money(p.price)}</div>
              <div className="muted small-t">{perUnit(p)}</div>
              <div className="stockline">
                {out ? <span className="badge st-4">Tugagan</span> : low ? <span className="badge st-1">Oz qoldi</span> : <span className="badge st-3">Mavjud</span>}
                <span className="muted small-t">{out ? '' : stockText(p)}</span>
              </div>
              <button className="btn primary wide" onClick={() => add(p)}>🛒 Savatga</button>
            </div>
          );
        })}
      </div>
      {!list.length && <div className="card empty">Mahsulot topilmadi.</div>}
    </>
  );
}

/* ---------------- Savat va buyurtma ---------------- */
export function Cart() {
  const { items, setQty, remove, clear } = useCart();
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState(null);
  const [dtype, setDtype] = useState('yetkazish');
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState('naqd');
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState(null);
  const [locating, setLocating] = useState(false);
  const toast = useToast();
  const nav = useNavigate();

  const load = () => api.get('/products').then(setProducts);
  useEffect(() => { load(); api.get('/settings').then(setSettings); }, []);

  const lines = items.map((i) => ({ ...i, p: products.find((p) => p.id === i.productId) })).filter((l) => l.p);
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const discount = promo && subtotal >= promo.minTotal ? calcDiscount(promo, subtotal) : 0;
  const km = geo && settings && settings.storeLat != null ? distanceKm(settings.storeLat, settings.storeLng, geo.lat, geo.lng) : null;
  const tooFar = km != null && settings.maxDeliveryKm > 0 && km > settings.maxDeliveryKm;
  const fee = settings && dtype === 'yetkazish' && subtotal - discount < settings.freeDeliveryFrom
    ? settings.deliveryFee + (km ? Math.round((km * settings.deliveryPerKm) / 100) * 100 : 0) : 0;
  const total = subtotal - discount + (lines.length ? fee : 0);

  const checkPromo = async () => {
    try { setPromo(await api.post('/promo/check', { code: promoCode, subtotal })); toast('Promokod qabul qilindi'); }
    catch (e) { setPromo(null); toast(e.message, 'error'); }
  };

  const changeQty = (l, n) => {
    if (n > l.p.stock) return toast('Mahsulot yetarli emas', 'error');
    setQty(l.productId, n);
  };

  const locate = async () => {
    setLocating(true);
    try {
      const pos = await getPosition();
      setGeo(pos);
      const addr = await reverseGeocode(pos.lat, pos.lng);
      if (addr) setAddress(addr);
      else if (!address) setAddress(`GPS: ${pos.lat}, ${pos.lng}`);
      toast(`Joylashuv aniqlandi (aniqlik ~${pos.accuracy} m)`);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLocating(false); }
  };

  const order = async () => {
    setBusy(true);
    try {
      await api.post('/orders', { items: items.map(({ productId, qty }) => ({ productId, qty })), delivery: { type: dtype, address, lat: geo?.lat, lng: geo?.lng }, payment, promo: promo?.code });
      clear();
      toast('Buyurtmangiz qabul qilindi!');
      nav('/my-orders');
    } catch (e) {
      toast(e.detail ? `${e.message}: ${e.detail}` : e.message, 'error');
      load();
    } finally { setBusy(false); }
  };

  if (!lines.length) return <div className="card empty">Savatingiz bo'sh. <Link to="/shop">Do'konga o'tish →</Link></div>;

  return (
    <>
      <h2>🛒 Savat</h2>
      <div className="two">
        <div className="card">
          <table>
            <thead><tr><th>Mahsulot</th><th>Narxi</th><th>Soni</th><th className="r">Summa</th><th /></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.productId}>
                  <td>{l.p.emoji} {plabel(l.p)}</td>
                  <td>{money(l.p.price)}</td>
                  <td>
                    <div className="qty">
                      <button onClick={() => (l.qty > 1 ? changeQty(l, l.qty - 1) : remove(l.productId))}>−</button>
                      <span>{l.qty} {l.p.packLabel}</span>
                      <button onClick={() => changeQty(l, l.qty + 1)}>+</button>
                    </div>
                  </td>
                  <td className="r">{money(l.p.price * l.qty)}</td>
                  <td><button className="btn small danger" onClick={() => remove(l.productId)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card stack">
          <div className="row gap">
            <input placeholder="Promokod" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
            <button className="btn" onClick={checkPromo}>Qo'llash</button>
          </div>
          <div className="radio">
            <label><input type="radio" checked={dtype === 'yetkazish'} onChange={() => setDtype('yetkazish')} /> 🚚 Yetkazib berish</label>
            <label><input type="radio" checked={dtype === 'olib ketish'} onChange={() => setDtype('olib ketish')} /> 🏪 Olib ketish</label>
          </div>
          {dtype === 'yetkazish' && (
            <>
              <button type="button" className="btn" onClick={locate} disabled={locating}>{locating ? '📡 Aniqlanmoqda...' : geo ? '📍 Joylashuvni yangilash' : '📍 Joylashuvimni aniqlash (GPS)'}</button>
              <textarea rows="2" placeholder="Manzil: shahar, ko'cha, uy (GPS topgan manzilni tahrirlashingiz mumkin)" value={address} onChange={(e) => setAddress(e.target.value)} />
              {geo && (
                <div className="geo">
                  <iframe title="Xarita" src={mapEmbed(geo.lat, geo.lng)} loading="lazy" />
                  <div className="muted small-t">
                    📍 {geo.lat}, {geo.lng} • <a href={mapLink(geo.lat, geo.lng)} target="_blank" rel="noreferrer">Xaritada ochish</a>
                    {km != null && <> • Do'kondan masofa: <b>{km} km</b></>}
                  </div>
                  {tooFar && <div className="red-t small-t">⚠ Yetkazib berish hududidan tashqaridasiz (maks. {settings.maxDeliveryKm} km)</div>}
                </div>
              )}
            </>
          )}
          <label>To'lov turi
            <select value={payment} onChange={(e) => setPayment(e.target.value)}>
              {Object.entries(PAY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div className="sum"><span>Mahsulotlar</span><span>{money(subtotal)}</span></div>
          {discount > 0 && <div className="sum green"><span>Chegirma ({promo.code})</span><span>-{money(discount)}</span></div>}
          <div className="sum"><span>Yetkazish</span><span>{fee ? money(fee) : 'Bepul'}</span></div>
          {settings && dtype === 'yetkazish' && fee > 0 && <div className="muted small-t">Yetkazish: {money(settings.deliveryFee)}{km ? ` + ${km} km × ${money(settings.deliveryPerKm)}` : ''}. {money(settings.freeDeliveryFrom)} dan yuqori xaridda bepul</div>}
          <div className="sum big"><span>Jami</span><span>{money(total)}</span></div>
          <button className="btn primary wide" disabled={busy || tooFar} onClick={order}>{busy ? 'Kuting...' : 'Buyurtma berish'}</button>
        </div>
      </div>
    </>
  );
}

/* ---------------- Mening buyurtmalarim ---------------- */
export function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [store, setStore] = useState(null);
  const load = () => api.get('/orders').then(setOrders);
  useEffect(() => { load(); api.get('/settings').then(setStore); }, []);
  if (!orders) return <div className="center">Yuklanmoqda...</div>;
  return (<><h2>📦 Buyurtmalarim</h2><OrderList orders={orders} onChange={load} store={store} /></>);
}

/* ---------------- Profil ---------------- */
export function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '' });
  const [p, setP] = useState({ oldPassword: '', newPassword: '' });
  const saveProfile = async (e) => {
    e.preventDefault();
    try { const r = await api.put('/auth/profile', f); setUser(r.user); toast('Profil saqlandi'); } catch (er) { toast(er.message, 'error'); }
  };
  const savePw = async (e) => {
    e.preventDefault();
    try { await api.post('/auth/password', p); setP({ oldPassword: '', newPassword: '' }); toast("Parol o'zgartirildi"); } catch (er) { toast(er.message, 'error'); }
  };
  return (
    <div className="two">
      <form className="card stack" onSubmit={saveProfile}>
        <h3>👤 Profil</h3>
        <div className="muted">Login: <b>{user.username}</b></div>
        <label>Ism-familiya<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label>Telefon<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <button className="btn primary">Saqlash</button>
      </form>
      <form className="card stack" onSubmit={savePw}>
        <h3>🔒 Parolni o'zgartirish</h3>
        <label>Eski parol<input type="password" value={p.oldPassword} onChange={(e) => setP({ ...p, oldPassword: e.target.value })} required /></label>
        <label>Yangi parol<input type="password" value={p.newPassword} onChange={(e) => setP({ ...p, newPassword: e.target.value })} required /></label>
        <button className="btn primary">O'zgartirish</button>
      </form>
    </div>
  );
}
