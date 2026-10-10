import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useToast } from '../context.jsx';

export default function Login() {
  const { login, register } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', username: '', phone: '', password: '', password2: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (mode === 'register' && f.password !== f.password2) return toast('Parollar bir xil emas', 'error');
    setBusy(true);
    try {
      const u = mode === 'login' ? await login(f.username, f.password) : await register(f);
      nav(u.role === 'admin' ? '/admin' : '/shop', { replace: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="big">🏗️</div>
        <h1>Qurilish Do'koni</h1>
        <p>Sement, qorishma, bo'yoq, metall va boshqa qurilish mollari — bir joyda. Tez, qulay va ishonchli.</p>
        <ul>
          <li>✔ Barcha mahsulotlar kg / litr hisobida aniq narxlarda</li>
          <li>✔ Yetkazib berish yoki olib ketish</li>
          <li>✔ Promokod orqali chegirmalar</li>
        </ul>
      </div>
      <form className="card login-card" onSubmit={submit}>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Kirish</button>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Ro'yxatdan o'tish</button>
        </div>
        {mode === 'register' && (
          <>
            <label>Ism-familiya<input value={f.name} onChange={set('name')} required placeholder="Ali Valiyev" /></label>
            <label>Telefon<input value={f.phone} onChange={set('phone')} placeholder="+998 90 123 45 67" /></label>
          </>
        )}
        <label>Login<input value={f.username} onChange={set('username')} required autoFocus placeholder="login" /></label>
        <label>Parol<input type="password" value={f.password} onChange={set('password')} required placeholder="••••••" /></label>
        {mode === 'register' && (
          <label>Parolni takrorlang<input type="password" value={f.password2} onChange={set('password2')} required placeholder="••••••" /></label>
        )}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Kuting...' : mode === 'login' ? 'Kirish' : "Ro'yxatdan o'tish"}</button>
        {mode === 'login' && (
          <div className="hint">
            Demo: <b>admin / admin123</b> (administrator), <b>mijoz / mijoz123</b> (foydalanuvchi)
          </div>
        )}
      </form>
    </div>
  );
}
