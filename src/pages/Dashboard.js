// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChefHat, Table as TableIcon, DollarSign, Package, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

// =====================
// CONFIGURACIÓN DEL LOGO
// =====================
// ⬇️ Pega aquí tu URL PÚBLICA de Supabase para el logo (PNG/JPG/SVG):
const LOGO_URL = 'https://fialncxvjjptzacoyhzs.supabase.co/storage/v1/object/public/imagenescomida/logo_color.png';
// Tamaño máximo del logo (px). Se escala automáticamente.
const LOGO_MAX_WIDTH_PX = 360;

const Dashboard = () => {
  const [stats, setStats] = useState({
    pendingOrders: 0,
    occupiedTables: 0,
    todaySales: 0,
    lowStockItems: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logoVisible, setLogoVisible] = useState(Boolean(LOGO_URL));

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Órdenes Pendientes
      const { count: pendingOrdersCount, error: ordersError } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (ordersError) throw ordersError;

      // Mesas Ocupadas
      const { count: occupiedTablesCount, error: tablesError } = await supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'occupied');
      if (tablesError) throw tablesError;

      // Ventas de Hoy (usamos created_at)
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data: salesData, error: salesError } = await supabase
        .from('payments')
        .select('amount, created_at')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString());
      if (salesError) throw salesError;

      const totalSales = (salesData || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // Productos con stock bajo: contamos en cliente (quantity <= min_stock_level)
      const { data: invRows, error: inventoryError } = await supabase
        .from('inventory')
        .select('quantity, min_stock_level');
      if (inventoryError) throw inventoryError;

      const lowStockItems = (invRows || []).filter(
        r => Number(r.quantity || 0) <= Number(r.min_stock_level || 0)
      ).length;

      // Órdenes recientes (últimas 5)
      const { data: recent, error: recentErr } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          tables:table_id ( name )
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      if (recentErr) throw recentErr;

      setStats({
        pendingOrders: pendingOrdersCount || 0,
        occupiedTables: occupiedTablesCount || 0,
        todaySales: totalSales || 0,
        lowStockItems: lowStockItems || 0,
      });
      setRecentOrders(recent || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('No pude cargar los datos del dashboard.');
      setStats({
        pendingOrders: 0,
        occupiedTables: 0,
        todaySales: 0,
        lowStockItems: 0,
      });
      setRecentOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { name: 'Órdenes Pendientes', value: stats.pendingOrders, icon: ChefHat, color: 'bg-red-500', textColor: 'text-red-700' },
    { name: 'Mesas Ocupadas', value: stats.occupiedTables, icon: TableIcon, color: 'bg-blue-500', textColor: 'text-blue-700' },
    { name: 'Ventas Hoy', value: `$${stats.todaySales.toFixed(2)}`, icon: DollarSign, color: 'bg-green-500', textColor: 'text-green-700' },
    { name: 'Productos Bajos', value: stats.lowStockItems, icon: Package, color: 'bg-yellow-500', textColor: 'text-yellow-700' },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'served': return 'bg-purple-100 text-purple-800';
      case 'paid': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {/* Encabezado con logo + nombre */}
      <div className="flex flex-col items-center">
        {logoVisible && LOGO_URL ? (
          <img
            src={LOGO_URL}
            alt="logo"
            className="mb-2"
            style={{ maxWidth: LOGO_MAX_WIDTH_PX, width: '100%', height: 'auto', objectFit: 'contain' }}
            crossOrigin="anonymous"
            decoding="async"
            loading="eager"
            onError={() => setLogoVisible(false)} // si falla, ocultamos el logo y dejamos solo el título
          />
        ) : null}
         <motion.h2
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
  className="text-4xl font-extrabold text-gray-900 mb-2 text-center bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-700"
>
  DelSabor
</motion.h2>

      </div>

      {error && (
        <motion.div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="block sm:inline">{error}</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
            <XCircle className="w-5 h-5 cursor-pointer" />
          </span>
        </motion.div>
      )}

      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="bg-white rounded-2xl shadow-xl p-6 flex items-center space-x-4 border border-gray-200 transform hover:scale-105 transition-transform duration-300"
          >
            <div className={`p-4 rounded-full ${stat.color} bg-opacity-20`}>
              <stat.icon className={`w-8 h-8 ${stat.textColor}`} />
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">{stat.name}</p>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Actividad reciente basada en la BD */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200"
      >
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Actividad Reciente</h3>
        {recentOrders.length === 0 ? (
          <p className="text-gray-500">No hay actividad reciente.</p>
        ) : (
          <ul className="space-y-3">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">
                  Orden #{String(o.id).slice(0, 8)} — Mesa {o?.tables?.name || 'N/A'}{' '}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${getStatusBadge(o.status)}`}>
                    {o.status}
                  </span>
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(o.created_at).toLocaleString('es-MX')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;
