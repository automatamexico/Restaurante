// src/pages/Kitchen.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CookingPot,
  CheckCircle,
  XCircle,
  Clock,
  UtensilsCrossed,
  ChefHat,
  Table,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

const Kitchen = () => {
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchKitchenOrders();
  }, []);

  const fetchKitchenOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kitchen_orders')
      .select(`
        *,
        order_items (
          quantity,
          notes,
          menu_items ( name ),
          orders (
            table_id,
            tables ( name )
          )
        ),
        users ( username )
      `)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching kitchen orders:', error);
      setError('No pude traer las órdenes de la cocina. ¿Se perdieron en el fuego?');
    } else {
      setKitchenOrders(data || []);
    }
    setLoading(false);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    setLoading(true);
    const { error } = await supabase
      .from('kitchen_orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order status:', error);
      setError(`No pude actualizar el estado de la orden. Error: ${error.message}`);
      setLoading(false);
      return;
    }

    await fetchKitchenOrders();
    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-4xl font-extrabold text-gray-900 mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-700"
      >
        Módulo de Cocina
      </motion.h2>

      {error && (
        <motion.div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="block sm:inline">{error}</span>
          <span
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
          >
            <XCircle className="w-5 h-5 cursor-pointer" />
          </span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {kitchenOrders.length === 0 ? (
            <motion.div
              className="col-span-full text-center py-10 text-gray-600 bg-white rounded-2xl shadow-xl p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <CookingPot className="w-24 h-24 text-gray-400 mx-auto mb-6" />
              <p className="text-xl font-semibold">
                ¡La cocina está tranquila! No hay órdenes pendientes.
              </p>
              <p className="text-gray-500">Es un buen momento para un café... o para limpiar.</p>
            </motion.div>
          ) : (
            kitchenOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200 flex flex-col justify-between transform hover:scale-105 transition-transform duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-gray-800">
                      {order.order_items?.menu_items?.name} (x{order.order_items?.quantity})
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>

                  <p className="text-gray-600 mb-2 flex items-center">
                    <Table className="w-4 h-4 mr-2 text-gray-500" />
                    Mesa: {order.order_items?.orders?.tables?.name || 'N/A'}
                  </p>

                  {order.order_items?.notes && (
                    <p className="text-gray-600 text-sm mb-2 flex items-center">
                      <UtensilsCrossed className="w-4 h-4 mr-2 text-gray-500" />
                      Notas: {order.order_items.notes}
                    </p>
                  )}

                  {order.chef_id && (
                    <p className="text-gray-600 text-sm mb-2 flex items-center">
                      <ChefHat className="w-4 h-4 mr-2 text-gray-500" />
                      Chef: {order.users?.username || 'Asignado'}
                    </p>
                  )}

                  <p className="text-gray-500 text-xs flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Pedido: {new Date(order.created_at).toLocaleTimeString()}
                  </p>
                </div>

                {/* Acciones */}
                <div className="flex justify-end space-x-3 mt-4">
                  {order.status === 'pending' && (
                    <motion.button
                      onClick={() => updateOrderStatus(order.id, 'in_progress')}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200"
                      title="Empezar a Preparar"
                    >
                      <CookingPot className="w-5 h-5" />
                    </motion.button>
                  )}

                  {order.status === 'in_progress' && (
                    <motion.button
                      onClick={() => updateOrderStatus(order.id, 'ready')}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors duration-200"
                      title="Marcar como Listo"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </motion.button>
                  )}

                  {/* NUEVO: botón para marcar como ENTREGADO cuando ya está 'ready' */}
                  {order.status === 'ready' && (
                    <motion.button
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-full bg-teal-100 text-teal-600 hover:bg-teal-200 transition-colors duration-200"
                      title="Marcar como Entregado"
                    >
                      <UtensilsCrossed className="w-5 h-5" />
                    </motion.button>
                  )}

                  {(order.status === 'pending' || order.status === 'in_progress') && (
                    <motion.button
                      onClick={() => updateOrderStatus(order.id, 'cancelled')}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200"
                      title="Cancelar Orden"
                    >
                      <XCircle className="w-5 h-5" />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Kitchen;
