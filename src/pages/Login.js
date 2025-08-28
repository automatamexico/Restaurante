// src/pages/Login.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, LogIn, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';

const normalizeRole = (val) => (val || '').toString().trim().toLowerCase();

const Login = () => {
  const [email, setEmail] = useState('');   // login por email
  const [password, setPassword] = useState('');
  const [loading,   setLoading] = useState(false);
  const [error,     setError]   = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const normEmail = email.trim().toLowerCase();

      // 1) Iniciar sesión
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normEmail,
        password,
      });
      if (authError) {
        const raw = (authError.message || '').toLowerCase();
        if (raw.includes('invalid') || raw.includes('credentials')) {
          throw new Error('Correo o contraseña incorrectos.');
        }
        if (raw.includes('email not confirmed')) {
          throw new Error('Tu correo no está confirmado. Revisa tu bandeja.');
        }
        throw new Error(authError.message || 'No se pudo iniciar sesión.');
      }

      const user = data?.user;
      if (!user) throw new Error('No se obtuvo el usuario de la sesión.');

      // 2) Confirmar sesión activa
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sessData?.session) throw new Error('No hay sesión activa tras el login.');

      // 3) Asegurar perfil en public.users y leer rol
      let profile = null;
      const { data: found } = await supabase
        .from('users')
        .select('id, auth_id, role, email, username')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (found?.id) {
        profile = found;
      } else {
        // Si no existe, lo creamos con rol por defecto "employee"
        const candidate = {
          auth_id: user.id,
          email: user.email || null,
          username: (user.email || '').split('@')[0] || ('user_' + String(user.id).slice(0, 8)),
          role: 'employee',
        };
        const { data: inserted, error: insErr } = await supabase
          .from('users')
          .insert(candidate)
          .select('id, auth_id, role, email, username')
          .single();
        if (insErr) throw insErr;
        profile = inserted;
      }

      const roleFromUsers = normalizeRole(profile?.role);
      const roleFromMeta  = normalizeRole(user?.user_metadata?.role || user?.app_metadata?.role);
      const role = roleFromUsers || roleFromMeta || 'employee';

      // 4) Persistir info mínima
      localStorage.setItem('auth_user_id', user.id);
      localStorage.setItem('user_id', profile?.id || user.id);
      localStorage.setItem('user_role', role);

      // 5) Redirección según rol:
      // - admin -> al dashboard ("/")
      // - staff/chef/employee -> a "Órdenes" (pueden navegar a Mesas/Cocina)
      if (role === 'admin') {
        navigate('/', { replace: true });
      } else {
        navigate('/orders', { replace: true });
      }
    } catch (err) {
      console.error('[Login Error]:', err);
      setError(err?.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring", damping: 15, stiffness: 100 }}
        className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 w-full max-w-md border border-gray-200"
      >
        <div className="text-center mb-8">
          <img
            src="https://fialncxvjjptzacoyhzs.supabase.co/storage/v1/object/public/imagenescomida/logo_color.png"
            alt="Login"
            className="block mx-auto mb-4 h-48 w-48 object-contain"
            loading="lazy"
          />
          <p className="text-gray-500">Desarrollado y administrado por Soluciones Inteligentes DELSU.</p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6"
          >
            <span className="block sm:inline">{error}</span>
            <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
              <XCircle className="w-5 h-5 cursor-pointer" />
            </span>
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">
              Correo electrónico
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                placeholder="tucorreo@dominio.com"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duración-200"
                placeholder="Tu contraseña"
                required
              />
            </div>
          </div>

          <motion.button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-700 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
          >
            {loading ? <LoadingSpinner /> : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Iniciar Sesión</span>
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
