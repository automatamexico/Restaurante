/* global qz */
/* eslint-disable no-undef */
// src/pages/Orders.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat,
  PlusCircle,
  Edit,
  Trash2,
  Search,
  XCircle,
  Table,
  DollarSign,
  User,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

/** ===== QZ TRAY (impresión silenciosa) ===== */
const setupQZSecurity = () => {
  if (!window.qz?.security) return;
  qz.security.setCertificatePromise((resolve) => {
    resolve(null); // DEV: sin certificado; en PROD devuelve tu cert PEM
  });
  qz.security.setSignaturePromise(() => {
    return Promise.resolve(null); // DEV: sin firma; en PROD firma en backend
  });
};

const ensureQZ = async () => {
  if (!window.qz) throw new Error('QZ Tray no encontrado');
  if (qz.websocket.isActive()) return;
  setupQZSecurity();
  await qz.websocket.connect();
};

const getPrinterName = async (preferred) => {
  if (preferred) {
    const list = await qz.printers.find();
    const found = list.find((p) => p.toLowerCase().includes(preferred.toLowerCase()));
    if (found) return found;
  }
  return await qz.printers.getDefault();
};

const esc = (hex) => ({ type: 'raw', format: 'hex', data: hex.replace(/\s+/g, '') });
const txt = (str) => ({ type: 'raw', format: 'plain', data: str });

const colLine = (left, right, width = 32) => {
  const l = (left || '').toString();
  const r = (right || '').toString();
  const space = Math.max(1, width - l.length - r.length);
  return l.slice(0, width) + ' '.repeat(space) + r.slice(0, width);
};
const wrapText = (text, width = 32) => {
  const out = [];
  let s = (text || '').toString();
  while (s.length > width) {
    out.push(s.slice(0, width));
    s = s.slice(width);
  }
  out.push(s);
  return out;
};

const printKitchenViaQZ = async (order, { printerHint = 'XP' } = {}) => {
  await ensureQZ();
  const printer = await getPrinterName(printerHint);
  const cfg = qz.configs.create(printer, {
    encoding: 'CP437',
    rasterize: false,
    colorType: 'blackwhite',
    margins: 0,
    copies: 1,
    jobName: `Orden-${String(order.id).slice(0, 8)}`
  });

  const createdAt = new Date(order.created_at);
  const mesa = order.tables?.name || 'N/A';
  const mesero = order.users?.username || 'N/A';
  const items = order.order_items || [];
  const total = items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);

  const itemLines = [];
  items.forEach((it) => {
    const name = it.menu_items?.name || 'Ítem';
    const qty = String(it.quantity || 0);
    const price = '$' + Number(it.price || 0).toFixed(2);
    const nameWrapped = wrapText(name, 22);
    itemLines.push(colLine(nameWrapped[0], `${qty} x ${price}`, 32));
    for (let i = 1; i < nameWrapped.length; i++) itemLines.push(nameWrapped[i]);
    if (it.notes) wrapText('Notas: ' + it.notes, 32).forEach((l) => itemLines.push(l));
  });

  const data = [
    esc('1B40'), esc('1B7400'),
    esc('1B6101'), esc('1D2111'),
    txt('ORDEN COCINA\n'),
    esc('1D2100'),
    txt(`#${String(order.id).slice(0, 8)}  ${createdAt.toLocaleString('es-MX')}\n\n`),
    esc('1B6100'),
    txt(`Mesa: ${mesa}\n`),
    txt(`Mesero: ${mesero}\n`),
    txt(`Estado: ${order.status}\n`),
    txt('--------------------------------\n'),
    txt(colLine('Producto', 'Cant x Precio') + '\n'),
    txt('--------------------------------\n'),
    ...itemLines.map((l) => txt(l + '\n')),
    txt('--------------------------------\n'),
    txt(colLine('TOTAL', '$' + total.toFixed(2)) + '\n\n'),
    esc('1B6403'), esc('1D5601'),
  ];

  await qz.print(cfg, data);
};

/** ===== LÓGICA DE ÓRDENES ===== */
const getOrCreateProfileId = async () => {
  let profileId = localStorage.getItem('user_id');
  if (profileId) return profileId;

  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData?.user;
  if (!authUser?.id) return null;

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .maybeSingle();

  if (existing?.id) {
    localStorage.setItem('user_id', existing.id);
    return existing.id;
  }

  const candidate = {
    auth_id: authUser.id,
    email: authUser.email || null,
    username: (authUser.email || '').split('@')[0] || 'user_' + String(authUser.id).slice(0, 8),
  };

  const { data: inserted, error: insErr } = await supabase
    .from('users')
    .insert(candidate)
    .select('id')
    .single();
  if (insErr) return null;

  localStorage.setItem('user_id', inserted.id);
  return inserted.id;
};

const fetchOrderDetailsForPrint = async (orderId) => {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id, created_at, status,
      tables ( name ),
      users ( username ),
      order_items ( quantity, price, notes, menu_items ( name ) )
    `
    )
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return data;
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

  // Nuevas órdenes arrancan en "preparing"
  const [formData, setFormData] = useState({
    table_id: '',
    user_id: '',
    status: 'preparing',
    items: [],
  });

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: ordersData } = await supabase
      .from('orders')
      .select(
        `
        *,
        tables ( name ),
        users ( username ),
        order_items ( id, quantity, price, notes, status, menu_items ( name ) )
      `
      )
      .order('created_at', { ascending: false });

    const { data: tablesData } = await supabase
      .from('tables')
      .select('id, name')
      .order('name', { ascending: true });

    const { data: menuItemsData } = await supabase
      .from('menu_items')
      .select('id, name, price')
      .order('name', { ascending: true });

    setOrders(ordersData || []);
    setTables(tablesData || []);
    setMenuItems(menuItemsData || []);
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((fd) => ({ ...fd, [name]: value }));
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    setFormData((fd) => {
      const next = [...fd.items];
      next[index] = { ...next[index], [name]: value };
      return { ...fd, items: next };
    });
  };

  const handleAddItem = () => {
    setFormData((fd) => ({
      ...fd,
      items: [...fd.items, { menu_item_id: '', quantity: 1, notes: '' }],
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData((fd) => ({
      ...fd,
      items: fd.items.filter((_, i) => i !== index),
    }));
  };

  const calculateTotalAmount = () => {
    return formData.items.reduce((total, item) => {
      const mi = menuItems.find((x) => x.id === item.menu_item_id);
      return total + (mi ? mi.price * parseInt(item.quantity || 0) : 0);
    }, 0);
  };

  const handleAddEditOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let orderError = null;
    let newOrderData = null;

    const profileId = await getOrCreateProfileId();
    if (!currentOrder && !profileId) {
      setError('No se pudo crear/obtener el perfil del usuario.');
      setLoading(false);
      return;
    }

    const totalAmount = calculateTotalAmount();
    const orderToSave = {
      table_id: formData.table_id,
      user_id: currentOrder ? formData.user_id || profileId : profileId,
      status: currentOrder ? formData.status : 'preparing',
      total_amount: totalAmount,
    };

    if (currentOrder) {
      const { error: updateOrderError } = await supabase
        .from('orders')
        .update(orderToSave)
        .eq('id', currentOrder.id);
      orderError = updateOrderError;
      newOrderData = currentOrder;
    } else {
      const { data, error: insertOrderError } = await supabase
        .from('orders')
        .insert(orderToSave)
        .select()
        .single();
      orderError = insertOrderError;
      newOrderData = data;
    }

    if (!orderError && newOrderData) {
      if (currentOrder) {
        const { error: delErr } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', newOrderData.id);
        if (delErr) orderError = delErr;
      }

      if (!orderError) {
        const itemsToInsert = formData.items.map((it) => {
          const mi = menuItems.find((x) => x.id === it.menu_item_id);
          return {
            order_id: newOrderData.id,
            menu_item_id: it.menu_item_id,
            quantity: parseInt(it.quantity),
            price: mi ? mi.price : 0,
            notes: it.notes,
          };
        });
        const { error: insItemsErr } = await supabase
          .from('order_items')
          .insert(itemsToInsert);
        if (insItemsErr) orderError = insItemsErr;
      }
    }

    if (orderError) {
      setError(`¡Ups! No pude guardar la orden. Error: ${orderError.message}`);
      setLoading(false);
      return;
    }

    // Imprime silencioso solo cuando es NUEVA orden
    if (!currentOrder) {
      try {
        const fullOrder = await fetchOrderDetailsForPrint(newOrderData.id);
        await printKitchenViaQZ(fullOrder, { printerHint: 'XP' });
      } catch (printErr) {
        console.warn('No se pudo imprimir el ticket (QZ):', printErr);
      }
    }

    await fetchData();
    setIsModalOpen(false);
    setCurrentOrder(null);
    setFormData({ table_id: '', user_id: '', status: 'preparing', items: [] });
    setLoading(false);
  };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('¿Eliminar esta orden?')) return;
    setLoading(true);
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) setError('No pude borrar la orden.');
    else fetchData();
    setLoading(false);
  };

  const openAddModal = () => {
    setCurrentOrder(null);
    setFormData({ table_id: '', user_id: '', status: 'preparing', items: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (order) => {
    setCurrentOrder(order);
    setFormData({
      table_id: order.table_id,
      user_id: order.user_id,
      status: order.status,
      items: (order.order_items || []).map((item) => ({
        id: item.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        notes: item.notes,
      })),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentOrder(null);
    setFormData({ table_id: '', user_id: '', status: 'preparing', items: [] });
    setError(null);
  };

  const filteredOrders = orders.filter((order) => {
    const mesa = (order.tables?.name || '').toLowerCase();
    const mesero = (order.users?.username || '').toLowerCase();
    const est = (order.status || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    return mesa.includes(q) || mesero.includes(q) || est.includes(q);
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':    return 'bg-yellow-100 text-yellow-800';
      case 'preparing':  return 'bg-blue-100 text-blue-800';
      case 'ready':      return 'bg-green-100 text-green-800';
      case 'served':     return 'bg-purple-100 text-purple-800';
      case 'paid':       return 'bg-gray-100 text-gray-800';
      case 'cancelled':  return 'bg-red-100 text-red-800';
      default:           return 'bg-gray-100 text-gray-800';
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
        Gestión de Órdenes
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
            placeholder="Buscar órdenes por mesa, mesero o estado..."
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
          <span>Crear Nueva Orden</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredOrders.length === 0 ? (
            <motion.div
              className="col-span-full text-center py-10 text-gray-600 bg-white rounded-2xl shadow-xl p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <ChefHat className="w-24 h-24 text-gray-400 mx-auto mb-6" />
              <p className="text-xl font-semibold">¡No hay órdenes para mostrar!</p>
              <p className="text-gray-500">Es un buen momento para tomar un descanso... o para conseguir más clientes.</p>
            </motion.div>
          ) : (
            filteredOrders.map((order, index) => (
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
                      Orden #{String(order.id).substring(0, 8)}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-2 flex items-center">
                    <Table className="w-4 h-4 mr-2 text-gray-500" />
                    Mesa: {order.tables?.name || 'N/A'}
                  </p>
                  <p className="text-gray-600 mb-2 flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-500" />
                    Mesero: {order.users?.username || 'N/A'}
                  </p>
                  <ul className="list-disc list-inside text-gray-700 text-sm mb-4">
                    {(order.order_items || []).map((item) => (
                      <li key={item.id}>
                        {item.menu_items?.name} (x{item.quantity}) - ${Number(item.price || 0).toFixed(2)}
                        {item.notes && <span className="text-gray-500 italic"> ({item.notes})</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xl font-bold text-green-600 flex items-center">
                    <DollarSign className="w-5 h-5 mr-1" />
                    Total: $
                    {(order.order_items || [])
                      .reduce((t, it) => t + Number(it.price || 0) * Number(it.quantity || 0), 0)
                      .toFixed(2)}
                  </p>
                </div>
                <div className="flex justify-end space-x-3 mt-4">
                  <motion.button
                    onClick={() => openEditModal(order)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200"
                    title="Editar Orden"
                  >
                    <Edit className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    onClick={() => handleDeleteOrder(order.id)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duración-200"
                    title="Eliminar Orden"
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
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            >
              <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>

              <h3 className="text-2xl font-bold text-gray-800 mb-6">
                {currentOrder ? 'Editar Orden' : 'Crear Nueva Orden'}
              </h3>

              <form onSubmit={handleAddEditOrder} className="space-y-5">
                <div>
                  <label htmlFor="table_id" className="block text-gray-700 text-sm font-medium mb-2">
                    Mesa
                  </label>
                  <select
                    id="table_id"
                    name="table_id"
                    value={formData.table_id}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecciona una mesa</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="status" className="block text-gray-700 text-sm font-medium mb-2">
                    Estado de la Orden
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={!currentOrder}
                    required
                  >
                    <option value="pending">Pendiente</option>
                    <option value="preparing">Preparando</option>
                    <option value="ready">Lista</option>
                    <option value="served">Servida</option>
                    <option value="paid">Pagada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                  {!currentOrder && (
                    <p className="text-xs text-gray-500 mt-1">
                      Al crear, el estado se fija automáticamente en <strong>Preparando</strong>.
                    </p>
                  )}
                </div>

                <h4 className="text-lg font-bold text-gray-800 mt-6 mb-3">Items de la Orden</h4>
                {formData.items.map((item, index) => (
                  <div key={index} className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                    <div className="flex-grow">
                      <label htmlFor={`menu_item_id-${index}`} className="block text-gray-700 text-xs font-medium mb-1">
                        Plato
                      </label>
                      <select
                        id={`menu_item_id-${index}`}
                        name="menu_item_id"
                        value={item.menu_item_id}
                        onChange={(e) => handleItemChange(index, e)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-transparent text-sm"
                        required
                      >
                        <option value="">Selecciona un plato</option>
                        {menuItems.map((menuItem) => (
                          <option key={menuItem.id} value={menuItem.id}>
                            {menuItem.name} (${Number(menuItem.price || 0).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-20">
                      <label htmlFor={`quantity-${index}`} className="block text-gray-700 text-xs font-medium mb-1">
                        Cant.
                      </label>
                      <input
                        type="number"
                        id={`quantity-${index}`}
                        name="quantity"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, e)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-transparent text-sm"
                        min="1"
                        required
                      />
                    </div>

                    <div className="flex-grow">
                      <label htmlFor={`notes-${index}`} className="block text-gray-700 text-xs font-medium mb-1">
                        Notas (Opcional)
                      </label>
                      <input
                        type="text"
                        id={`notes-${index}`}
                        name="notes"
                        value={item.notes}
                        onChange={(e) => handleItemChange(index, e)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-transparent text-sm"
                        placeholder="Sin cebolla, extra picante..."
                      />
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200 mt-auto"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                ))}

                <motion.button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-300 transition-colors duration-200 flex items-center justify-center space-x-2 mt-4"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Añadir Plato</span>
                </motion.button>

                <p className="text-xl font-bold text-gray-800 mt-6">
                  Total de la Orden: ${calculateTotalAmount().toFixed(2)}
                </p>

                <motion.button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duración-200 flex items-center justify-center mt-6 disabled:opacity-60"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner /> : currentOrder ? 'Guardar Cambios' : 'Crear Orden'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Orders;
