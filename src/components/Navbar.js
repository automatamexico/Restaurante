import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Utensils, LayoutDashboard, Users, ChefHat, DollarSign, Package, LogOut } from 'lucide-react';

const Navbar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Mesas', path: '/tables', icon: Utensils },
    { name: 'Menú', path: '/menu', icon: ChefHat },
    { name: 'Órdenes', path: '/orders', icon: DollarSign },
    { name: 'Inventario', path: '/inventory', icon: Package },
    { name: 'Usuarios', path: '/users', icon: Users },
  ];

  return (
    <motion.nav
      className="bg-card shadow-custom-medium p-4 rounded-3xl m-4 flex flex-col items-center justify-between h-[calc(100vh-2rem)]"
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="flex flex-col items-center w-full">
        <div className="mb-8 text-center">
          <Utensils className="w-12 h-12 text-primary mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-textPrimary">SoftRestaurant</h1>
        </div>
        <ul className="space-y-4 w-full">
          {navItems.map((item) => (
            <motion.li
              key={item.name}
              whileHover={{ scale: 1.05, backgroundColor: '#F0F0F0' }}
              whileTap={{ scale: 0.95 }}
              className="rounded-xl"
            >
              <Link
                to={item.path}
                className="flex items-center p-3 text-textSecondary hover:text-primary font-medium transition-colors duration-200"
              >
                <item.icon className="w-6 h-6 mr-3" />
                <span>{item.name}</span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
      <motion.button
        className="flex items-center p-3 text-red-500 hover:bg-red-50 rounded-xl font-medium transition-colors duration-200 w-full"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => alert('Funcionalidad de Logout aún no implementada. ¡No te vayas todavía!')}
      >
        <LogOut className="w-6 h-6 mr-3" />
        <span>Cerrar Sesión</span>
      </motion.button>
    </motion.nav>
  );
};

export default Navbar;