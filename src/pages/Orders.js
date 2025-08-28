/* global qz */
/* eslint-disable no-undef */
// src/pages/Orders.jsx
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

/** ===== QZ TRAY (impresión silenciosa) =====
 * Requiere QZ Tray corriendo en la máquina con la impresora.
 * Para DEV rápido: en QZ Tray habilita "Allow unsigned requests" (o usa tu certificado/firmado).
 */

// Opcional: si tienes certificado propio, colócalo aquí y configura la firma.
// Para DEV (sin certificado), deja las Promises devolviendo null/resolve.
// QZ Tray debe permitir "unsigned" para aceptar la conexión.
const setupQZSecurity = () => {
  if (!window.qz?.security) return;
  qz.security.setCertificatePromise((resolve, reject) => {
    // DEV: dejar vacío. Producción: devuelve tu CERT PEM.
    resolve(null);
  });

  qz.security.setSignaturePromise((toSign) => {
    // DEV: sin firma (null). Producción: firmar "toSign" en tu backend y devolver la firma.
    return Promise.resolve(null);
  });
};

const ensureQZ = async () => {
  if (!window.qz) throw new Error('QZ Tray no encontrado. Asegúrate de cargar qz-tray.js en index.html');
  if (qz.websocket.isActive()) return;
  setupQZSecurity();
  await qz.websocket.connect(); // conecta al QZ Tray local
};

/** Encuentra impresora por nombre (si lo pasas) o usa la predeterminada */
const getPrinterName = async (preferred) => {
  if (preferred) {
    const list = await qz.printers.find();
    const found = list.find((p) => p.toLowerCase().includes(preferred.toLowerCase()));
    if (found) return found;
  }
  return await qz.printers.getDefault();
};

/** ESC/POS helpers */
const esc = (hex) => ({ type: 'raw', format: 'hex', data: hex.replace(/\s+/g, '') });
const txt = (str) => ({ type: 'raw', format: 'plain', data: str });

/** Formateo de líneas para 58mm (≈32 columnas con fuente A) */
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

/** Construye y envía ESC/POS a la impresora (silencioso) */
const printKitchenViaQZ = async (order, { printerHint = 'XP' } = {}) => {
  await ensureQZ();
  const printer = await getPrinterName(printerHint);
  const cfg = qz.configs.create(printer, {
    encoding: 'CP437',     // español básico; ajusta si tu impresora usa otro codepage
    rasterize: false,      // enviamos ESC/POS crudo
    colorType: 'blackwhite',
    margins: 0,
    copies: 1,
    jobName: `Orden-${String(order.id).slice(0, 8)}`
  });

  const createdAt = new Date(order.created_at);
  const mesa = order.tables?.name || 'N/A';
  const mesero = order.users?.username || 'N/A';
  const items = order.order_items || [];

  // Calcula total
  const total = items.reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
    0
  );

  // Arma líneas de ítems
  const itemLines = [];
  items.forEach((it) => {
    const name = it.menu_items?.name || 'Ítem';
    const qty = String(it.quantity || 0);
    const price = '$' + Number(it.price || 0).toFixed(2);

    // Nombre puede ocupar varias líneas
    const nameWrapped = wrapText(name, 22); // deja espacio para qty+price
    // Primera línea: nombre + qty/price
    itemLines.push(colLine(nameWrapped[0], `${qty} x ${price}`, 32));
    // Resto de líneas: nombre continuo
    for (let i = 1; i < nameWrapped.length; i++) itemLines.push(nameWrapped[i]);

    // Notas (si hay)
    if (it.notes) {
      wrapText('Notas: ' + it.notes, 32).forEach((l) => itemLines.push(l));
    }
  });

  // Comandos ESC/POS
  const data = [
    esc('1B40'),            // init
    esc('1B7400'),          // codepage CP437
    esc('1B6101'),          // center
    esc('1D2111'),          // doble ancho+alto
    txt('ORDEN COCINA\n'),
    esc('1D2100'),          // normal
    txt(`#${String(order.id).slice(0, 8)}  ${createdAt.toLocaleString('es-MX')}\n`),
    txt('\n'),
    esc('1B6100'),          // left
    txt(`Mesa: ${mesa}\n`),
    txt(`Mesero: ${mesero}\n`),
    txt(`Estado: ${order.status}\n`),
    txt('--------------------------------\n'),
    txt(colLine('Producto', 'Cant x Precio') + '\n'),
    txt('--------------------------------\n'),
    ...itemLines.map((l) => txt(l + '\n')),
    txt('--------------------------------\n'),
    txt(colLine('TOTAL', '$' + total.toFixed(2)) + '\n'),
    txt('\n\n'),
    // Alimenta y corte (si soporta)
    esc('1B6403'),          // feed 3
    esc('1D5601'),          // cut parcial (algunas 58mm lo ignoran si no hay cutter)
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

  useEffect(() => {
    fetchData();
  }, []);

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

  /** Crear/editar orden:
   *  - En creación: status = 'preparing'
   *  - Tras crear: impresión silenciosa via QZ (ESC/POS)
   */
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
      status: currentOrder ? formData.status : 'preparing', // forzamos "preparing" al crear
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
      // Si editamos, reemplazamos ítems
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

    // 🔇 Impresión silenciosa tras crear (no al editar)
    if (!currentOrder) {
      try {
        const fullOrder = await fetchOrderDetailsForPrint(newOrderData.id);
        await printKitchenViaQZ(fullOrder, { printerHint: 'XP' }); // busca impresora que contenga "XP" o usa la predeterminada
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
            className="w-full p-3 pl-10 rounded-xl border border-gray-300 focus:ring-2 focus:ring-i

export default Orders;
