import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, PlusCircle, Edit, Trash2, Search, XCircle, Calendar, Receipt, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

const Cashier = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPayment, setCurrentPayment] = useState(null);
  const [formData, setFormData] = useState({ order_id: '', amount: '', payment_method: '', payment_date: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState([]); // Para seleccionar la orden a la que se asocia el pago

  useEffect(() => {
    fetchPaymentsAndOrders();
  }, []);

  const fetchPaymentsAndOrders = async () => {
    setLoading(true);
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select(`
        *,
        orders (
          id,
          tables (name),
          users (username)
        )
      `)
      .order('payment_date', { ascending: false });

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_amount, tables (name)')
      .eq('status', 'served') // Solo órdenes servidas pueden ser pagadas
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      setError('No pude traer los pagos. ¿Se perdió el dinero?');
    } else {
      setPayments(paymentsData);
    }

    if (ordersError) {
      console.error('Error fetching orders for payments:', ordersError);
      setError(prev => prev + ' Y tampoco las órdenes para pagar, ¡qué caos!');
    } else {
      setOrders(ordersData);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddEditPayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    let error;
    const paymentToSave = {
      ...formData,
      amount: parseFloat(formData.amount),
      payment_date: formData.payment_date || new Date().toISOString(),
    };

    if (currentPayment) {
      // Update
      const { error: updateError } = await supabase
        .from('payments')
        .update(paymentToSave)
        .eq('id', currentPayment.id);
      error = updateError;
    } else {
      // Add
      const { error: insertError } = await supabase
        .from('payments')
        .insert(paymentToSave);
      error = insertError;
    }

    if (error) {
      console.error('Error saving payment:', error);
      setError(`¡Ups! No pude guardar el pago. Error: ${error.message}`);
    } else {
      fetchPaymentsAndOrders();
      setIsModalOpen(false);
      setCurrentPayment(null);
      setFormData({ order_id: '', amount: '', payment_method: '', payment_date: '' });
    }
    setLoading(false);
  };

  const handleDeletePayment = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este pago? ¡Esto podría descuadrar la caja!')) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting payment:', error);
      setError('No pude borrar el pago. ¡Se resiste a desaparecer!');
    } else {
      fetchPaymentsAndOrders();
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setCurrentPayment(null);
    setFormData({ order_id: '', amount: '', payment_method: '', payment_date: new Date().toISOString().slice(0, 16) });
    setIsModalOpen(true);
  };

  const openEditModal = (payment) => {
    setCurrentPayment(payment);
    setFormData({
      order_id: payment.order_id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_date: payment.payment_date ? new Date(payment.payment_date).toISOString().slice(0, 16) : '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentPayment(null);
    setFormData({ order_id: '', amount: '', payment_method: '', payment_date: '' });
    setError(null);
  };

  const filteredPayments = payments.filter(payment =>
    payment.orders?.tables?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.payment_method.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.amount.toString().includes(searchTerm)
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-4xl font-extrabold text-gray-900 mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-700"
      >
        Gestión de Caja
      </motion.h2>

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

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full md:w-1/2">
          <input
            type="text"
            placeholder="Buscar pagos por mesa, método o monto..."
            className="w-full p-3 pl-10 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        </div>
        <motion.button
          onClick={openAddModal}
          className="bg-gradient-to-r from-green-500 to-teal-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl flex items-center space-x-2 transition-all duration-200 w-full md:w-auto justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <PlusCircle className="w-5 h-5" />
          <span>Registrar Nuevo Pago</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredPayments.length === 0 ? (
            <motion.div
              className="col-span-full text-center py-10 text-gray-600 bg-white rounded-2xl shadow-xl p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Receipt className="w-24 h-24 text-gray-400 mx-auto mb-6" />
              <p className="text-xl font-semibold">¡No hay pagos registrados!</p>
              <p className="text-gray-500">Es hora de cobrar... o de revisar si el negocio está abierto.</p>
            </motion.div>
          ) : (
            filteredPayments.map((payment, index) => (
              <motion.div
                key={payment.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200 flex flex-col justify-between transform hover:scale-105 transition-transform duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-2xl font-bold text-gray-800">Pago #{payment.id.substring(0, 8)}</h3>
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                      ${payment.amount.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-2 flex items-center">
                    <Table className="w-4 h-4 mr-2 text-gray-500" />
                    Orden: {payment.orders?.tables?.name ? `Mesa ${payment.orders.tables.name}` : 'N/A'}
                  </p>
                  <p className="text-gray-600 mb-2 flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-gray-500" />
                    Método: {payment.payment_method}
                  </p>
                  <p className="text-gray-500 text-xs flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    Fecha: {new Date(payment.payment_date).toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-end space-x-3 mt-4">
                  <motion.button
                    onClick={() => openEditModal(payment)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200"
                    title="Editar Pago"
                  >
                    <Edit className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    onClick={() => handleDeletePayment(payment.id)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200"
                    title="Eliminar Pago"
                  >
                    <Trash2 className="w-5 h-5" />
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg relative"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
            >
              <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-bold text-gray-800 mb-6">
                {currentPayment ? 'Editar Pago' : 'Registrar Nuevo Pago'}
              </h3>
              <form onSubmit={handleAddEditPayment} className="space-y-5">
                <div>
                  <label htmlFor="order_id" className="block text-gray-700 text-sm font-medium mb-2">Orden Asociada</label>
                  <select
                    id="order_id"
                    name="order_id"
                    value={formData.order_id}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecciona una orden</option>
                    {orders.map(order => (
                      <option key={order.id} value={order.id}>
                        Orden #{order.id.substring(0, 8)} - Mesa {order.tables?.name || 'N/A'} (${order.total_amount.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="amount" className="block text-gray-700 text-sm font-medium mb-2">Monto del Pago</label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ej: 25.50"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="payment_method" className="block text-gray-700 text-sm font-medium mb-2">Método de Pago</label>
                  <select
                    id="payment_method"
                    name="payment_method"
                    value={formData.payment_method}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecciona un método</option>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="transfer">Transferencia</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="payment_date" className="block text-gray-700 text-sm font-medium mb-2">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    id="payment_date"
                    name="payment_date"
                    value={formData.payment_date}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
                <motion.button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner /> : (currentPayment ? 'Guardar Cambios' : 'Registrar Pago')}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Cashier;