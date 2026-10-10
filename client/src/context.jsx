import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken } from './api';

/* ---------- Auth ---------- */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api.get('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => localStorage.removeItem('qd_token'))
      .finally(() => setReady(true));
  }, []);

  const finish = (r) => { localStorage.setItem('qd_token', r.token); setUser(r.user); return r.user; };
  const login = async (username, password) => finish(await api.post('/auth/login', { username, password }));
  const register = async (data) => finish(await api.post('/auth/register', data));
  const logout = () => { localStorage.removeItem('qd_token'); setUser(null); };

  return <AuthCtx.Provider value={{ user, ready, login, register, logout, setUser }}>{children}</AuthCtx.Provider>;
}

/* ---------- Toast ---------- */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const toast = useCallback((msg, type = 'ok') => {
    const id = Math.random();
    setList((l) => [...l, { id, msg, type }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts">
        {list.map((t) => <div key={t.id} className={'toast ' + t.type}>{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Savat ---------- */
const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qd_cart')) || []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('qd_cart', JSON.stringify(items)); }, [items]);

  const qtyOf = (id) => items.find((i) => i.productId === id)?.qty || 0;
  const add = (id, n = 1) => setItems((l) => (l.some((i) => i.productId === id)
    ? l.map((i) => (i.productId === id ? { ...i, qty: i.qty + n } : i))
    : [...l, { productId: id, qty: n }]));
  const setQty = (id, qty) => setItems((l) => l.map((i) => (i.productId === id ? { ...i, qty: Math.max(1, qty) } : i)));
  const remove = (id) => setItems((l) => l.filter((i) => i.productId !== id));
  const clear = () => setItems([]);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return <CartCtx.Provider value={{ items, qtyOf, add, setQty, remove, clear, count }}>{children}</CartCtx.Provider>;
}
