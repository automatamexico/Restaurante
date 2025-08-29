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
  History
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

// Snapshot a partir de una orden (por si lo usas en el futuro)
const snapshotFromOrder = (order) => {
  const map = {};
  (order.order_items || []).forEach((it) => {
    const k = makeKey(it.menu_item_id ?? it.menu_items?.id, it.notes || '');
    map[k] = (map[k] || 0) + Number(it.quantity || 0);
  });
  return map;
};

// Snapshot del formulario (siempre usa el id en string)
const snapshotFromForm = (formItems) => {
  const map = {};
  (formItems || []).forEach((it) => {
    const k = makeKey(it.menu_item_id, it.notes || '');
    map[k] = (map[k] || 0) + Number(it.quantity || 0);
  });
  return map;
};

/* ===========================
   Utilidades de fecha y estado
   =========================== */
const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const rangeForDate = (yyyy_mm_dd) => {
  const start = new Date(`${yyyy_mm_dd}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const statusToEs = (status) => {
  const map = {
    pending: 'Pendiente',
    preparing: 'Preparando',
    ready: 'Lista',
    served: 'Servida',
    paid: 'Pagada',
    cancelled: 'Cancelada',
  };
  return map[status] || status;
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

  // Historial
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDate, setHistoryDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10); // YYYY-MM-DD
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOrders, setHistoryOrders] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { start, end } = todayRange();

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
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
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

  const fetchHistoryForDate = async (yyyy_mm_dd) => {
    setHistoryLoading(true);
    try {
      const { start, end } = rangeForDate(yyyy_mm_dd);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          tables:table_id ( name ),
          users:user_id ( username ),
          order_items ( id )
        `)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistoryOrders(data || []);
    } catch (e) {
      console.error('history fetch error:', e);
      setHistoryOrders([]);
    } finally {
      setHistoryLoading(false);
    }
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
            const [miId, notes] = k.split('||'); // mantener como string
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

      await fetchData();
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
      await fetchData();
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
    const prevMap = {};
    (order.order_items || []).forEach((it) => {
      const k = makeKey(it.menu_item_id ?? it.menu_items?.id, it.notes || '');
      prevMap[k] = (prevMap[k] || 0) + Number(it.quantity || 0);
    });
    localStorage.setItem(SNAP_KEY(order.id), JSON.stringify(prevMap));

    setFormData({
      table_id: order.table_id,
      user_id: order.user_id,
      status: order.status,
      items: (order.order_items || []).map((item) => ({
        id: item.id,
        menu_item_id: item.menu_item_id ?? null,
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

  // Historial: abrir modal y cargar
  const openHistory = async () => {
    setHistoryOpen(true);
    await fetchHistoryForDate(historyDate);
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
            className="w-full p-3 pl-10 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duración-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <motion.button
            onClick={openAddModal}
            className="flex-1 md:flex-none bg-gradient-to-r from-green-500 to-teal-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 transition-all duración-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <PlusCircle className="w-5 h-5" />
            <span>Crear Nueva Orden</span>
          </motion.button>

          <motion.button
            onClick={openHistory}
            className="flex-1 md:flex-none bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl shadow-sm hover:bg-gray-50 flex items-center justify-center space-x-2 transition-all duración-200"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            title="Ver historial por día"
          >
            <History className="w-5 h-5" />
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
             



