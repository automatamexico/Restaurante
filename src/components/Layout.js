// src/components/Layout.js
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
  Table as TableIcon,
  CookingPot,
  LogOut
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import LoadingSpinner from './LoadingSpinner';

// Define el menú con los roles permitidos para cada opción
const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['admin'] },
  { name: 'Mesas', icon: TableIcon, path: '/tables', roles: ['admin', 'staff', 'chef', 'employee'] },
  { name: 'Menú', icon: Utensils, path: '/menu', roles: ['admin'] },
  { name: 'Órdenes', icon: ChefHat, path: '/orders', roles: ['admin', 'staff', 'chef', 'employee'] },
  { name: 'Cocina', icon: CookingPot, path: '/kitchen', roles: ['admin', 'staff', 'chef', 'employee'] },
  { name: 'Caja', icon: DollarSign, path: '/cashier', roles: ['admin'] },
  { name: 'Inventario', icon: Package, path: '/inventory', roles: ['admin'] },
  { name: 'Usuarios', icon: Users, path: '/users', roles: ['admin'] },
];

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Lee el rol desde localStorage; si no existe, cae a 'employee'
  const [role, setRole] = useState(
    (localStorage.getItem('user_role') || 'employee').toLowerCase()
  );

  useEffect(() => {
    // Escucha cambios de auth
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (!session && location.pathname !== '/login') {
        navigate('/login');
      } else {
        // Actualiza rol desde localStorage por si cambió en el login
        const r = (localStorage.getItem('user_role') || 'employee').toLowerCase();
        setRole(r);
      }
    });

    // Obtiene sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session && location.pathname !== '/login') {
        navigate('/login');
      } else {
        const r = (localStorage.getItem('user_role') || 'employee').toLowerCase();
        setRole(r);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error al cerrar sesión:', error.message);
      alert('No pude cerrar sesión. ¡Estás atrapado aquí para siempre!');
    } else {
      // Limpia datos locales
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      localStorage.removeItem('auth_user_id');
      setSession(null);
      navigate('/login');
    }
    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;

  // Si no hay sesión y no estamos en /login, no renderizamos (evita parpadeo)
  if (!session && location.pathname !== '/login') return null;

  // Filtra el menú según el rol
  const visibleNavItems = navItems.filter(item => item.roles.includes(role));

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
            <Utensils className="w-10 h-10 text-purple-300 mr-3" />
            <div>
              <h1 className="text-3xl font-bold tracking-wide text-purple-100">DelSabor</h1>
              <p className="text-xs text-purple-200 mt-1">
                Rol: <span className="font-semibold capitalize">{role}</span>
              </p>
            </div>
          </div>

          <nav>
            <ul className="space-y-3">
              {visibleNavItems.map((item) => {
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
                        className={`w-6 h-6 mr-4 ${
                          active ? 'text-white' : 'text-indigo-300 group-hover:text-white'
                        } transition-colors duration-200`}
                      />
                      <span className="text-lg font-medium">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <motion.button
            className="flex items-center p-3 text-red-300 hover:bg-red-700 hover:text-white rounded-xl font-medium transition-colors duration-200 w-full mt-8"
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
