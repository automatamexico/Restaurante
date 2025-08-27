// src/components/Layout.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Utensils,
  LayoutDashboard,
  Users,
  Package,
  DollarSign,
  ChefHat,
  Table,
  CookingPot,
  LogOut,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import LoadingSpinner from './LoadingSpinner';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Mesas', icon: Table, path: '/tables' },
  { name: 'Menú', icon: Utensils, path: '/menu' },
  { name: 'Órdenes', icon: ChefHat, path: '/orders' },
  { name: 'Cocina', icon: CookingPot, path: '/kitchen' },
  { name: 'Caja', icon: DollarSign, path: '/cashier' },
  { name: 'Inventario', icon: Package, path: '/inventory' },
  { name: 'Usuarios', icon: Users, path: '/users' },
];

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Suscripción de sesión + estado inicial (robusto)
  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!isMounted) return;
      setSession(sess);
      setLoading(false);
      if (!sess && location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (!isMounted) return;
      setSession(sess);
      setLoading(false);
      if (!sess && location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [navigate, location.pathname]);

  // Logout a prueba de fallos (siempre te saca)
  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.warn('Global signOut falló (continuamos con logout local):', e);
    } finally {
      try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}

      setSession(null);
      // Forzamos navegación limpia al login
      window.location.assign('/login');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!session && location.pathname !== '/login') return null;

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Sidebar */}
      {session && (
        <motion.aside
          initial={{ x: -200 }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="w-64 bg-gradient-to-b from-indigo-800 to-purple-900 text-white p-6 shadow-2xl relative z-10"
        >
          <div className="flex items-center mb-10">
            {/* Reemplaza por tu logo si quieres:
                <img src="/logo.png" alt="DelSabor" className="w-10 h-10 mr-3 object-contain" />
            */}
            <Utensils className="w-10 h-10 text-purple-300 mr-3" />
            <h1 className="text-3xl font-bold tracking-wide text-purple-100">DelSabor</h1>
          </div>

          <nav>
            <ul className="space-y-3">
              {navItems.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.path}
                      className={`flex items-center p-3 rounded-xl transition-all duration-200 group ${
                        active
                          ? 'bg-indigo-700 text-white shadow-lg'
                          : 'text-indigo-100 hover:bg-indigo-700 hover:text-white'
                      }`}
                    >
                      <item.icon
                        className={`w-6 h-6 mr-4 transition-colors duration-200 ${
                          active ? 'text-white' : 'text-indigo-300 group-hover:text-white'
                        }`}
                      />
                      <span className="text-lg font-medium">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <motion.button
            className="flex items-center p-3 text-red-300 hover:bg-red-700 hover:text-white rounded-xl font-medium transition-colors duration-200 w-full mt-8 disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            disabled={loading}
          >
            <LogOut className="w-6 h-6 mr-3" />
            <span>{loading ? 'Cerrando...' : 'Cerrar Sesión'}</span>
          </motion.button>
        </motion.aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 p-8 overflow-auto ${!session ? 'w-full' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="max-w-7xl mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default Layout;
