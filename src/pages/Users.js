import React from 'react';
import { motion } from 'framer-motion';
import { Users as UsersIcon } from 'lucide-react';

const Users = () => {
  return (
    <div className="space-y-8">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-4xl font-extrabold text-gray-900 mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-700"
      >
        Gestión de Usuarios
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200 text-center"
      >
        <UsersIcon className="w-24 h-24 text-purple-500 mx-auto mb-6" />
        <h3 className="text-2xl font-bold text-gray-800 mb-3">¡Próximamente!</h3>
        <p className="text-gray-600">Aquí podrás gestionar los usuarios y sus roles. ¡Cada quien en su puesto, como debe ser!</p>
      </motion.div>
    </div>
  );
};

export default Users;