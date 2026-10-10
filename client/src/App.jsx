import { Routes, Route, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useCart } from './context.jsx';
import Login from './pages/Login.jsx';
import { Shop, Cart, MyOrders, Profile } from './pages/user.jsx';
import { Incoming } from './pages/shared.jsx';
import { Dashboard, Products, Restock, Cash, AdminOrders, Users, Promos, Logs } from './pages/admin.jsx';

function Guard({ role, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="center">Yuklanmoqda...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/shop'} replace />;
  return children;
}

function Layout({ admin }) {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const nav = useNavigate();
  const links = admin
    ? [['/admin', 'Boshqaruv', true], ['/admin/products', 'Mahsulotlar'], ['/admin/restock', "Ta'minot"], ['/admin/cash', 'Kassa'],
       ['/admin/orders', 'Buyurtmalar'], ['/admin/users', 'Foydalanuvchilar'], ['/admin/promos', 'Aksiya'], ['/admin/logs', 'Jurnal']]
    : [['/shop', "Do'kon"], ['/cart', `Savat${count ? ` (${count})` : ''}`], ['/my-orders', 'Buyurtmalarim'], ['/incoming', 'Kelayotgan'], ['/profile', 'Profil']];
  return (
    <>
      <header className="top">
        <div className="brand">🏗️ <b>Qurilish</b> Do'koni {admin && <span className="tag">ADMIN</span>}</div>
        <nav>
          {links.map(([to, text, end]) => <NavLink key={to} to={to} end={!!end}>{text}</NavLink>)}
        </nav>
        <div className="who">
          <span>{user.name}</span>
          <button className="btn small" onClick={() => { logout(); nav('/login'); }}>Chiqish</button>
        </div>
      </header>
      <main className="page"><Outlet /></main>
    </>
  );
}

function Home() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="center">Yuklanmoqda...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/shop'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard role="user"><Layout /></Guard>}>
        <Route path="/shop" element={<Shop />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/incoming" element={<Incoming />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="/admin" element={<Guard role="admin"><Layout admin /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="restock" element={<Restock />} />
        <Route path="cash" element={<Cash />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="users" element={<Users />} />
        <Route path="promos" element={<Promos />} />
        <Route path="logs" element={<Logs />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
