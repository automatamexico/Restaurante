// src/pages/Login.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, LogIn, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';

// Mapea role_id -> nombre (por si no existe la tabla roles o no trae join)
const mapRoleId = (id) => {
  const n = Number(id);
  // Ajusta estos valores a tu semántica si difieren
  const map = {
    1: 'admin',
    2: 'staff',
    3: 'chef',
    4: 'employee',
  };
  return map[n] || 'employee';
};

const Login = () => {
  const [email, setEmail] = useState(''); // login por email
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const normEmail = email.trim().toLowerCase();

      // 1) Login Supabase Auth
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
          throw new Error('Tu correo no está confirmado. Revisa tu bandeja de entrada.');
        }
        throw new Error(authError.message || 'No se pudo iniciar sesión.');
      }

      const user = data?.user;
      if (!user) throw new Error('No se obtuvo el usuario de la sesión.');

      // 2) Sesión activa
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sessData?.session) {
        throw new Error('No hay sesión activa tras el login.');
      }

      // 3) Leer/crear perfil en public.users usando role_id
      let roleText = 'employee';
      let profileId = null;

      // Intenta leer perfil con join a roles (si existe)
      const { data: profile, error: profErr } = await supabase
        .from('users')
        .select('id, email, role_id, roles:role_id ( name )') // <-- join si tienes tabla roles(id,name)
        .eq('auth_id', user.id)
        .maybeSingle();

      if (profErr) {
        console.warn('No se pudo leer profile (users):', profErr.message);
      }

      if (profile?.id) {
        profileId = profile.id;
        // Si hay roles.name lo usamos; si no, mapeamos role_id
        roleText = (profile?.roles?.name || mapRoleId(profile?.role_id)).toLowerCase();
      } else {
        // Crear perfil con role_id por defecto
        // Intentar obtener role_id de 'employee' desde tabla roles
        let defaultRoleId = 4; // fallback si no existe tabla/registro
        try {
          const { data: roleRow } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'employee')
            .maybeSingle();
          if (roleRow?.id) defaultRoleId = roleRow.id;
        } catch {
          // Si falla, usamos 4
        }

        const username =
          (user.email || '').split('@')[0] || 'user_' + String(user.id).slice(0, 8);

        const { data: inserted, error: insErr } = await supabase
          .from('users')
          .insert({
            auth_id: user.id,
            email: user.email || null,
            username,
            role_id: defaultRoleId,
          })
          .select('id, role_id')
          .single();

        if (insErr) {
          console.error('Error insertando profile:', insErr);
          throw new Error('No se pudo crear el perfil del usuario.');
        }

        profileId = inserted.id;
        roleText = mapRoleId(inserted.role_id);
      }

      // 4) Guardar en localStorage (ui/guards usan el nombre del rol)
      localStorage.setItem('user_id', profileId);     // id de public.users
      localStorage.setItem('auth_user_id', user.id);  // id de auth.users
      localStorage.setItem('user_role', roleText);    // admin/staff/chef/employee

      // 5) Redirigir según rol o a donde venía
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (roleText === 'admin') {
        navigate('/', { replace: true });        // dashboard para admin
      } else {
        navigate('/orders', { replace: true });  // módulo operativo para no-admin
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
