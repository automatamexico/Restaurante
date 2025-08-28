// src/App.js
import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
  Navigate,
  useLocation,
} from 'react-router-dom';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tables from './pages/Tables';
import Menu from './pages/Menu';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import Cashier from './pages/Cashier';
import Inventory from './pages/Inventory';
import Users from './pages/Users';
import Login from './pages/Login';

import { supabase } from './supabaseClient';

/* =========================
   Guards (protecciones)
   ========================= */
const getStoredRole = () =>
  (localStorage.getItem('user_role') || 'employee').toLowerCase();

// Exige sesión activa
const RequireAuth = () => {
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setOk(!!data?.session);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (checking) return null; // aquí podrías poner un spinner si quieres
  if (!ok) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
};

// Exige que el rol esté en la lista permitida
const RequireRoles = ({ allowed = [], redirectTo = '/orders' }) => {
  const role = getStoredRole();
  if (allowed.length > 0 && !allowed.map(r => r.toLowerCase()).includes(role)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <Outlet />;
};

/* =========================
   App
   ========================= */
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Público */}
        <Route path="/login" element={<Login />} />

        {/* Todo lo demás requiere sesión */}
        <Route element={<RequireAuth />}>
          {/* SOLO ADMIN */}
          <Route element={<RequireRoles allowed={['admin']} redirectTo="/orders" />}>
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/cashier" element={<Layout><Cashier /></Layout>} />
            <Route path="/inventory" element={<Layout><Inventory /></Layout>} />
            <Route path="/users" element={<Layout><Users /></Layout>} />
            <Route path="/menu" element={<Layout><Menu /></Layout>} />
          </Route>

          {/* admin + staff + chef + employee */}
          <Route
            element={
              <RequireRoles
                allowed={['admin', 'staff', 'chef', 'employee']}
                redirectTo="/orders"
              />
            }
          >
            <Route path="/tables" element={<Layout><Tables /></Layout>} />
            <Route path="/orders" element={<Layout><Orders /></Layout>} />
            <Route path="/kitchen" element={<Layout><Kitchen /></Layout>} />
          </Route>

          {/* Fallback autenticado */}
          <Route path="*" element={<Layout><Orders /></Layout>} />
        </Route>
      </Routes>
    </Router>
  );
}
