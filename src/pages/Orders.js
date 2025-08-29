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
  Printer,
  Calendar,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

/* ===========================
   Ticket HTML (58mm, ancho útil 48mm)
   =========================== */
const printKitchenTicket = (order) => {
  const LOGO_URL = 'https://fialncxvjjptzacoyhzs.supabase.co/storage/v1/object/public/imagenescomida/logo_negro.png';

  const createdAt = new Date(order.created_at);
  const tableName = order.tables?.name || 'N/A';
  const waiter = order.users?.username || 'N/A';
  const items = order.order_items || [];

  const itemsHTML = items.length
    ? items
        .map(
          (it) => `
        <tr>
          <td class="col-name">
            ${it.menu_items?.name || 'Ítem'}
            ${it.notes ? `<div class="notes">Notas: ${it.notes}</div>` : ''}
          </td>
          <td class="col-qty">${Number(it.quantity || 0)}</td>
        </tr>
      `
        )
        .join('')
    : `<tr><td class="col-name">(sin ítems)</td><td class="col-qty"></td></tr>`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ticket Cocina</title>
  <style>
    @page { size: 58mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { width: 58mm; }

    .ticket {
      width: 48mm;
      margin: 0 auto;
      padding: 2mm;
      box-sizing: border-box;
      color: #000;
      font-family: "Courier New", ui-monospace, Menlo, Consolas, monospace;
      font-weight: 700;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      text-rendering: optimizeLegibility;
      transform: translateX(0);
    }
    * {
      -webkit-font-smoothing: none;
      -moz-osx-font-smoothing: auto;
    }
    .center { text-align: center; }
    .logo {
      display: block;
      margin: 0 auto 2mm;
      width: 48mm;
      max-width: 48mm;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
    }
    .title {
      font-weight: 900;
      font-size: 20px;
      margin: 1mm 0 0.5mm;
      letter-spacing: 0.2px;
    }
    .meta {
      font-size: 14px;
      font-weight: 800;
      margin-bottom: 1mm;
    }
    hr {
      border: 0;
      border-top: 1px solid #000;
      margin: 2mm 0;
    }
    .label { font-weight: 800; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 14px;
    }
    .col-name  { width: 72%; padding: 1mm 0 0.5mm 0; font-weight: 800; }
    .col-qty   { width: 28%; text-align: center; font-weight: 900; }
    td { vertical-align: top; }
    .notes {
      font-size: 13px;
      font-weight: 700;
      margin-top: 0.5mm;
    }
    .col-name, .notes { word-break: break-word; overflow-wrap: anywhere; white-space: normal; }
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    ${LOGO_URL ? `<img src="${LOGO_URL}" alt="Logo" class="logo" width="384" crossorigin="anonymous" referrerpolicy="no-referrer" />` : ''}

    <div class="center title">ORDEN COCINA</div>
    <div class="center meta">
      #${String(order.id).slice(0, 8)} — ${createdAt.toLocaleDateString('es-MX')} ${createdAt.toLocaleTimeString('es-MX')}
    </div>

    <hr />

    <div><span class="label">Mesa:</span> ${tableName}</div>
    <div><span class="label">Mesero:</span> ${waiter}</div>
    <div><span class="label">Estado:</span> ${order.status}</div>

    <hr />

    <table>
      <thead>
        <tr>
          <td class="col-name"><strong>Producto</strong></td>
          <td class="col-qty"><strong>Cant</strong></td>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>
  </div>

  <script>
    setTimeout(function(){ window.print(); }, 150);
  </script>
</body>
</html>
`;

  const w = window.open('', '_blank', 'width=480,height=640');
  if (!w) {
    alert('El bloqueador de popups impidió abrir la ventana de impresión. Permite popups para este sitio.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
};

/* ===========================
   Helpers de datos
   =========================== */
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
      order_items ( quantity, price, notes, menu_items ( id, name ) )
    `
    )
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return data;
};

/* ===========================
   Detección de ítems agregados (para impresiones parciales)
   =========================== */
const SNAP_KEY = (orderId) => `ORD_SNAP_${orderId}`;
const makeKey = (menu_item_id, notes) => `${String(menu_item_id)}||${(notes || '').trim()}`;

// Snapshot a partir de una orden
const snapshotFromOrder = (order) => {
  const map = {};
  (order.order_items || []).forEach((it) => {
    const k = makeKey(it.menu_item_id ?? it.menu_items?.id, it.notes || '');
    map[k] = (map[k] || 0) + Number(it.quantity || 0);
  });
  return map;
};

// Snapshot del formulario
const snapshotFromForm = (formItems) => {
  const map = {};
  (formItems || []).forEach((it) => {
    const k = makeKey(it.menu_item_id, it.notes || '');
    map[k] = (map[k] || 0) + Number(it.quantity || 0);
  });
  return map;
};

/* ===========================
   Utils de fecha y estatus
   =========================== */
const startEndOfDayISO = (date) => {
  const d = new Date(date);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

const statusES = (s) => {
  switch ((s || '').toLowerCase()) {
    case 'pending': return 'Pendiente';
    case 'preparing': return 'Preparando';
    case 'ready': return 'Lista';
    case 'served': return 'Servida';
    case 'paid': return 'Pagada';
    case 'cancelled': return 'Cancelada';
    default: return s || '—';
  }
};

/* ===========================
   Componente principal
   =========================== */
const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

  // Nuevas órdenes: "preparing"
  const [formData, setFormData] = useState({
    table_id: '',
    user_id: '',
    status: 'preparing',
    items: [],
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Modal de confirmación de impresión
  const [printPromptOpen, setPrintPromptOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);

  // Modal Historial
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDate, setHistoryDate] = useState(() => {
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, '0');
    const dd = String(t.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchDataForToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDataForToday = async () => {
    setLoading(true);
    const { startISO, endISO } = startEndOfDayISO(new Date());

    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        *,
        tables ( name ),
        users ( username ),
        order_items (
          id,
          menu_item_id,
          quantity,
          price,
          notes,
          status,
          menu_items ( id, name )
        )
      `)
      .gte('created_at', startISO)
      .lt('created_at', endISO)
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

  const fetchHistoryForDate = async (yyyyMMdd) => {
    setHistoryLoading(true);
    const { startISO, endISO } = startEndOfDayISO(yyyyMMdd);

    const { data, error: err } = await supabase
      .from('orders')
      .select(`
        id, status, created_at,
        tables ( name ),
        users ( username )
      `)
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .order('created_at', { ascending: false });

    if (!err) setHistoryOrders(data || []);
    setHistoryLoading(false);
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
      const mi = menuItems.find((x) => String(x.id) === String(item.menu_item_id));
      const qty = Number(item.quantity || 0);
      return total + (mi ? mi.price * qty : 0);
    }, 0);
  };

  // Validación
  const validateForm = () => {
    if (!formData.table_id) {
      setError('Selecciona una mesa.');
      return false;
    }
    if (!formData.items.length) {
      setError('Agrega al menos 1 ítem a la orden.');
      return false;
    }
    for (const it of formData.items) {
      if (!it.menu_item_id) {
        setError('Hay un ítem sin seleccionar (plato).');
        return false;
      }
      const qty = Number(it.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        setError('Todas las cantidades deben ser números ≥ 1.');
        return false;
      }
    }
    return true;
  };

  // Insert con fallback (si tu BD no tiene total_amount)
  const insertOrderWithFallback = async (payload) => {
    let { data, error } = await supabase
      .from('orders')
      .insert(payload)
      .select()
      .single();

    if (error && /total_amount/i.test(error.message)) {
      const { total_amount, ...withoutTotal } = payload;
      ({ data, error } = await supabase
        .from('orders')
        .insert(withoutTotal)
        .select()
        .single());
    }
    return { data, error };
  };

  // Crear/editar orden
  const handleAddEditOrder = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validateForm()) return;

    setLoading(true);
    let newOrderData = null;

    try {
      const profileId = await getOrCreateProfileId();
      if (!currentOrder && !profileId) {
        throw new Error('No se pudo crear/obtener el perfil del usuario.');
      }

      const totalAmount = calculateTotalAmount();
      const orderToSave = {
        table_id: formData.table_id,
        user_id: currentOrder ? formData.user_id || profileId : profileId,
        status: currentOrder ? formData.status : 'preparing',
        total_amount: totalAmount,
      };

      // Delta de ítems NUEVOS (por plato+nota), usando IDs como string
      let deltaItems = [];
      if (currentOrder) {
        const prevSnap = JSON.parse(localStorage.getItem(SNAP_KEY(currentOrder.id)) || '{}');
        const newSnap = snapshotFromForm(formData.items);

        Object.keys(newSnap).forEach((k) => {
          const add = (newSnap[k] || 0) - (prevSnap[k] || 0);
          if (add > 0) {
            const [miId, notes] = k.split('||'); // mantener string
            const mi = menuItems.find((x) => String(x.id) === String(miId));
            deltaItems.push({
              menu_item_id: miId,
              quantity: add,
              notes: notes || '',
              menu_items: { name: mi ? mi.name : '(sin nombre)' },
            });
          }
        });
      }

      if (currentOrder) {
        const { error: updateOrderError } = await supabase
          .from('orders')
          .update(orderToSave)
          .eq('id', currentOrder.id);
        if (updateOrderError) throw updateOrderError;
        newOrderData = currentOrder;

        // Reemplaza ítems
        const { error: delErr } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', newOrderData.id);
        if (delErr) throw delErr;
      } else {
        const { data, error: insertOrderError } = await insertOrderWithFallback(orderToSave);
        if (insertOrderError) throw insertOrderError;
        newOrderData = data;
      }

      // Insertar ítems actuales del formulario
      const itemsToInsert = formData.items.map((it) => {
        const mi = menuItems.find((x) => String(x.id) === String(it.menu_item_id));
        return {
          order_id: newOrderData.id,
          menu_item_id: it.menu_item_id,
          quantity: Number(it.quantity),
          price: mi ? Number(mi.price) : 0,
          notes: it.notes || null,
        };
      });

      if (itemsToInsert.length) {
        const { error: insItemsErr } = await supabase.from('order_items').insert(itemsToInsert);
        if (insItemsErr) throw insItemsErr;
      }

      // Preguntar impresión
      if (!currentOrder) {
        // Nueva orden: imprimir TODO
        const fullOrder = await fetchOrderDetailsForPrint(newOrderData.id);
        setPrintOrder(fullOrder);
        setPrintPromptOpen(true);
      } else if (deltaItems.length > 0) {
        // Edición: imprimir SOLO lo nuevo
        const header = await fetchOrderDetailsForPrint(newOrderData.id);
        const partial = {
          ...header,
          order_items: deltaItems, // sólo nuevos
        };
        setPrintOrder(partial);
        setPrintPromptOpen(true);
      }

      await fetchDataForToday();
      setIsModalOpen(false);
      setCurrentOrder(null);
      setFormData({ table_id: '', user_id: '', status: 'preparing', items: [] });
    } catch (err) {
      console.error('[Orders] Error al guardar:', err);
      setError('No pude guardar la orden: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('¿Eliminar esta orden?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      await fetchDataForToday();
    } catch (err) {
      setError('No pude borrar la orden: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setCurrentOrder(null);
    setFormData({ table_id: '', user_id: '', status: 'preparing', items: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (order) => {
    setCurrentOrder(order);

    // Snapshot previo por (menu_item_id + notes) en STRING
    const prevMap = snapshotFromOrder(order);
    localStorage.setItem(SNAP_KEY(order.id), JSON.stringify(prevMap));

    setFormData({
      table_id: order.table_id,
      user_id: order.user_id,
      status: order.status,
      items: (order.order_items || []).map((item) => ({
        id: item.id,
        menu_item_id: item.menu_item_id ?? null, // UUID/string
        quantity: item.quantity,
        notes: item.notes || '',
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
        Gestión de Órdenes (hoy)
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

        <div className="flex gap-3 w-full md:w-auto">
          <motion.button
            onClick={openAddModal}
            className="flex-1 md:flex-none bg-gradient-to-r from-green-500 to-teal-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <PlusCircle className="w-5 h-5" />
            <span>Crear Nueva Orden</span>
          </motion.button>

          <motion.button
            onClick={() => {
              setHistoryOpen(true);
              fetchHistoryForDate(historyDate);
            }}
            className="flex-1 md:flex-none bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2 transition-all duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Calendar className="w-5 h-5" />
            <span>Historial de órdenes</span>
          </motion.button>
        </div>
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
                      {statusES(order.status)}
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
                    className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200"
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

      {/* ===== Modal: Crear / Editar Orden ===== */}
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
                    required
                  >
                    <option value="preparing">Preparando</option>
                    <option value="pending">Pendiente</option>
                    <option value="ready">Lista</option>
                    <option value="served">Servida</option>
                    <option value="paid">Pagada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>

                <h4 className="text-lg font-bold text-gray-800 mt-6 mb-3">Ítems de la orden</h4>

                {formData.items.map((item, index) => (
                  <div key={index} className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                    <div className="flex-grow">
                      <label
                        htmlFor={`menu_item_id-${index}`}
                        className="block text-gray-700 text-xs font-medium mb-1"
                      >
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
                            {menuItem.name} (${menuItem.price.toFixed(2)})
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
                        Notas (opcional)
                      </label>
                      <input
                        type="text"
                        id={`notes-${index}`}
                        name="notes"
                        value={item.notes}
                        onChange={(e) => handleItemChange(index, e)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-transparent text-sm"
                        placeholder="Sin cebolla, extra picante…"
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
                  className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-300 transition-colors duration-200 flex items-center justify-center space-x-2 mt-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Añadir plato</span>
                </motion.button>

                <p className="text-xl font-bold text-gray-800 mt-4">
                  Total de la orden: ${calculateTotalAmount().toFixed(2)}
                </p>

                <motion.button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center mt-4"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                >
                  {loading ? 'Guardando…' : currentOrder ? 'Guardar cambios' : 'Crear orden'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Modal: Imprimir Orden en cocina ===== */}
      <AnimatePresence>
        {printPromptOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md relative"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            >
              <button
                onClick={() => setPrintPromptOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <Printer className="w-7 h-7 text-indigo-600" />
                <h3 className="text-2xl font-bold text-gray-800">Imprimir Orden en cocina</h3>
              </div>

              <p className="text-gray-600 mb-6">
                ¿Deseas imprimir el ticket de la orden{' '}
                <strong>#{printOrder ? String(printOrder.id).slice(0, 8) : ''}</strong> para cocina?
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100"
                  onClick={() => setPrintPromptOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => {
                    if (printOrder) printKitchenTicket(printOrder);
                    setPrintPromptOpen(false);
                  }}
                >
                  Aceptar e imprimir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Modal: Historial de Órdenes ===== */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-2xl relative"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            >
              <button
                onClick={() => setHistoryOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-7 h-7 text-indigo-600" />
                <h3 className="text-2xl font-bold text-gray-800">Historial de órdenes</h3>
              </div>

              <p className="text-gray-600 mb-4">Selecciona el día que deseas consultar.</p>

              <div className="flex items-center gap-3 mb-6">
                <input
                  type="date"
                  className="p-2 border rounded-lg"
                  value={historyDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHistoryDate(v);
                    fetchHistoryForDate(v);
                  }}
                />
                <button
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => fetchHistoryForDate(historyDate)}
                >
                  Consultar
                </button>
              </div>

              <div className="max-h-[60vh] overflow-auto">
                {historyLoading ? (
                  <div className="py-10"><LoadingSpinner /></div>
                ) : historyOrders.length === 0 ? (
                  <p className="text-gray-500">No hay órdenes para ese día.</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {historyOrders.map((o) => (
                      <li key={o.id} className="py-3 flex items-center justify-between">
                        <div className="text-gray-700">
                          <span className="font-semibold">Orden #{String(o.id).slice(0,8)}</span>
                          {' — '}Mesa {o?.tables?.name || 'N/A'}
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${getStatusColor(o.status)}`}>
                            {statusES(o.status)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(o.created_at).toLocaleString('es-MX')}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Orders;

             



