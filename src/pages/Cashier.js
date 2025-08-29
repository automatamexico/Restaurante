// src/pages/Cashier.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  PlusCircle,
  Edit,
  Trash2,
  Search,
  XCircle,
  Calendar,
  Receipt,
  User,
  Table as TableIcon,
  Wallet,
  Printer
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

// =====================
// CONFIGURACIÓN
// =====================

// MISMO LOGO QUE COCINA:
const LOGO_URL = 'https://fialncxvjjptzacoyhzs.supabase.co/storage/v1/object/public/imagenescomida/logo_negro.png';

// Mapear claves de BD -> etiquetas en español (método de pago)
const PAYMENT_LABELS = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro'
};
const methodLabel = (key) => PAYMENT_LABELS[key] ?? (key || '—');

// Mapear estado de la orden -> español
const STATUS_LABELS = {
  pending: 'Pendiente',
  preparing: 'Preparando',
  ready: 'Lista',
  served: 'Servida',
  paid: 'Pagada',
  cancelled: 'Cancelada'
};
const statusLabel = (key) => STATUS_LABELS[key] ?? (key || '—');

// Columna de fecha en payments (debe tener DEFAULT now() en la BD)
const DATE_COL = 'created_at';
// Estado "pagada" de la orden
const PAID_STATUS = 'paid';
// Zona horaria para mostrar fechas/hora
const CDMX_TZ = 'America/Mexico_City';

const toISOStartEnd = (yyyy_mm_dd) => {
  // yyyy-mm-dd -> rangos ISO (UTC) de 00:00 a 24:00 hora local
  const base = yyyy_mm_dd ? new Date(`${yyyy_mm_dd}T00:00:00`) : new Date();
  if (!yyyy_mm_dd) base.setHours(0, 0, 0, 0);
  const start = new Date(base);
  const end = new Date(base);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const Cashier = () => {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);             // órdenes no pagadas
  const [pendingBills, setPendingBills] = useState([]); // cuentas con saldo pendiente
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [debug, setDebug] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPayment, setCurrentPayment] = useState(null);

  // Modal de confirmación de impresión (después de REGISTRAR pago)
  const [printPromptOpen, setPrintPromptOpen] = useState(false);
  const [printPayment, setPrintPayment] = useState(null);

  // HISTORIAL
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [historyPayments, setHistoryPayments] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // DETALLES (historial)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState(null); // { payment, orderDetail }

  // Form: NO incluye fecha/hora editable (la BD pone now())
  const [formData, setFormData] = useState({
    order_id: '',
    amount: '',
    payment_method: 'cash',
    tendered: '' // monto entregado (efectivo) para calcular cambio
  });

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPaymentsAndOrders(); // carga inicial (pagos HOY)
  }, []);

  const logDbg = (where, err) =>
    setDebug(prev => [...prev, { where, message: err?.message ?? String(err) }]);

  // === Cargar HOY: pagos del día + órdenes facturables ===
  const fetchPaymentsAndOrders = async () => {
    setLoading(true);
    setError(null);
    setDebug([]);

    try {
      // --- Pagos de HOY
      const { startIso, endIso } = toISOStartEnd(); // hoy
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id,
          order_id,
          amount,
          payment_method,
          payment_status,
          transaction_id,
          ${DATE_COL},
          orders:order_id (
            id,
            total_amount,
            created_at,
            status,
            tables:table_id ( name ),
            users:user_id ( username )
          )
        `)
        .gte(DATE_COL, startIso)
        .lt(DATE_COL, endIso)
        .order(DATE_COL, { ascending: false });

      if (paymentsError) {
        logDbg('payments fetch', paymentsError);
        throw paymentsError;
      }

      // --- Órdenes facturables (no pagadas ni canceladas)
      const { data: billableOrders, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          created_at,
          status,
          tables:table_id ( name )
        `)
        .neq('status', PAID_STATUS)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (ordersErr) {
        logDbg('orders (billables) fetch', ordersErr);
        throw ordersErr;
      }

      // --- Sumatoria de pagos por orden (para calcular pendiente)
      const ids = (billableOrders || []).map(o => o.id);
      let paidMap = new Map();
      if (ids.length > 0) {
        const { data: payAgg, error: payAggErr } = await supabase
          .from('payments')
          .select('order_id, amount')
          .in('order_id', ids);
        if (payAggErr) {
          logDbg('payments sum by order', payAggErr);
          throw payAggErr;
        }
        paidMap = (payAgg || []).reduce((m, r) => {
          const k = r.order_id;
          const amt = Number(r.amount) || 0;
          m.set(k, (m.get(k) || 0) + amt);
          return m;
        }, new Map());
      }

      const pending = (billableOrders || [])
        .map(o => {
          const paid = paidMap.get(o.id) || 0;
          const total = Number(o.total_amount || 0);
          const due = Math.max(0, total - paid);
          return {
            id: o.id,
            table_name: o?.tables?.name || 'N/A',
            status: o.status,
            total,
            paid,
            due,
            created_at: o.created_at,
          };
        })
        .filter(x => x.due > 0);

      setOrders(billableOrders || []);
      setPendingBills(pending);
      setPayments(paymentsData || []);
    } catch (err) {
      console.error('fetchPaymentsAndOrders error:', err);
      setError('No pude traer los pagos.');
    } finally {
      setLoading(false);
    }
  };

  // Buscar pagos por FECHA (para Historial)
  const fetchPaymentsByDate = async (yyyy_mm_dd) => {
    setHistoryLoading(true);
    try {
      const { startIso, endIso } = toISOStartEnd(yyyy_mm_dd);
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          order_id,
          amount,
          payment_method,
          ${DATE_COL},
          orders:order_id (
            id,
            total_amount,
            created_at,
            status,
            tables:table_id ( name ),
            users:user_id ( username )
          )
        `)
        .gte(DATE_COL, startIso)
        .lt(DATE_COL, endIso)
        .order(DATE_COL, { ascending: false });

      if (error) throw error;
      setHistoryPayments(data || []);
    } catch (e) {
      setError('No pude cargar el historial de pagos: ' + (e.message || e));
    } finally {
      setHistoryLoading(false);
    }
  };

  // Si los pagos cubren el total, marcar orden como 'paid'
  const settleOrderIfFullyPaid = async (orderId) => {
    try {
      const { data: ord, error: ordErr } = await supabase
        .from('orders')
        .select('id, total_amount, status')
        .eq('id', orderId)
        .single();
      if (ordErr) throw ordErr;

      const total = Number(ord.total_amount || 0);
      const { data: payRows, error: payErr } = await supabase
        .from('payments')
        .select('amount')
        .eq('order_id', orderId);
      if (payErr) throw payErr;

      const paid = (payRows || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const due = total - paid;

      if (due <= 0.01 && ord.status !== PAID_STATUS) {
        const { error: upErr } = await supabase
          .from('orders')
          .update({ status: PAID_STATUS })
          .eq('id', orderId);
        if (upErr) throw upErr;
      }
    } catch (e) {
      logDbg('settleOrder', e);
    }
  };

  const prefillForOrder = (orderId, due) => {
    setCurrentPayment(null);
    setFormData({
      order_id: orderId,
      amount: Number(due).toFixed(2),
      payment_method: 'cash',
      tendered: Number(due).toFixed(2)
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'order_id' && value) {
        const pend = pendingBills.find(p => String(p.id) === String(value));
        if (pend) {
          next.amount = Number(pend.due).toFixed(2);
          if (next.payment_method === 'cash') {
            next.tendered = Number(pend.due).toFixed(2);
          }
        }
      }
      if (name === 'payment_method' && value !== 'cash') {
        next.tendered = '';
      }
      return next;
    });
  };

  const selectedOrderTotals = useMemo(() => {
    if (!formData.order_id) return { total: 0, paid: 0, due: 0 };
    const pend = pendingBills.find(p => String(p.id) === String(formData.order_id));
    if (pend) return { total: pend.total, paid: pend.paid, due: pend.due };
    const anyOrd = orders.find(o => String(o.id) === String(formData.order_id));
    if (anyOrd) return { total: Number(anyOrd.total_amount || 0), paid: 0, due: Number(anyOrd.total_amount || 0) };
    return { total: 0, paid: 0, due: 0 };
  }, [formData.order_id, pendingBills, orders]);

  const calcChange = useMemo(() => {
    if (formData.payment_method !== 'cash') return 0;
    const tendered = Number(formData.tendered || 0);
    const amount = Number(formData.amount || 0);
    if (!Number.isFinite(tendered) || !Number.isFinite(amount)) return 0;
    return Math.max(0, tendered - amount);
  }, [formData.payment_method, formData.tendered, formData.amount]);

  const handleAddEditPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setDebug([]);

    try {
      if (!formData.order_id) throw new Error('Selecciona una orden.');
      const amountNum = Number(formData.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) throw new Error('Monto inválido.');

      // No permitir registrar pagos a órdenes ya pagadas (en el selector solo salen no pagadas)
      if (formData.payment_method === 'cash') {
        const tenderedNum = Number(formData.tendered);
        if (!Number.isFinite(tenderedNum) || tenderedNum < amountNum) {
          throw new Error('El monto entregado debe ser mayor o igual al monto del pago.');
        }
      }

      const toSave = {
        order_id: formData.order_id || null,
        amount: amountNum,
        payment_method: formData.payment_method || null
      };

      let inserted = null;

      if (currentPayment) {
        const { error } = await supabase.from('payments').update(toSave).eq('id', currentPayment.id);
        if (error) {
          logDbg('payments update', error);
          throw error;
        }
      } else {
        const { data, error } = await supabase
          .from('payments')
          .insert(toSave)
          .select(`id, order_id, amount, payment_method, ${DATE_COL}`)
          .single();
        if (error) {
          logDbg('payments insert', error);
          throw error;
        }
        inserted = data;
      }

      // Marcar orden como pagada si aplica
      await settleOrderIfFullyPaid(toSave.order_id);

      // Refrescar HOY
      await fetchPaymentsAndOrders();

      // Cerrar modal del formulario
      closeModal();

      // Si fue un nuevo pago, preguntar imprimir
      if (!currentPayment) {
        const paymentForPrint = inserted || {
          order_id: toSave.order_id,
          amount: toSave.amount,
          payment_method: toSave.payment_method,
          [DATE_COL]: new Date().toISOString()
        };
        setPrintPayment(paymentForPrint);
        setPrintPromptOpen(true);
      }
    } catch (err) {
      console.error('handleAddEditPayment error:', err);
      setError(`¡Ups! No pude guardar el pago. ${err.message ?? ''}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id) => {
    if (!window.confirm('¿Eliminar este pago?')) return;
    setSaving(true);
    setError(null);
    setDebug([]);

    try {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) {
        logDbg('payments delete', error);
        throw error;
      }
      await fetchPaymentsAndOrders();
    } catch (err) {
      console.error('handleDeletePayment error:', err);
      setError(err.message || 'No pude borrar el pago.');
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    setCurrentPayment(null);
    setFormData({
      order_id: '',
      amount: '',
      payment_method: 'cash',
      tendered: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (payment) => {
    const isOrderPaid = payment?.orders?.status === PAID_STATUS;
    if (isOrderPaid) {
      setError('No puedes editar pagos de una orden ya pagada.');
      return;
    }
    setCurrentPayment(payment);
    setFormData({
      order_id: payment.order_id ?? '',
      amount: payment.amount ?? '',
      payment_method: payment.payment_method || 'cash',
      tendered: '' // se pedirá al imprimir si hace falta
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentPayment(null);
    setFormData({
      order_id: '',
      amount: '',
      payment_method: 'cash',
      tendered: ''
    });
    setError(null);
  };

  // Búsqueda rápida (sobre pagos HOY)
  const s = searchTerm.trim().toLowerCase();
  const filteredPayments = (payments || []).filter(p => {
    const mesa = p?.orders?.tables?.name ? String(p.orders.tables.name).toLowerCase() : '';
    const metodo = methodLabel(p?.payment_method).toLowerCase();
    const monto = p?.amount != null ? String(p.amount) : '';
    return !s || mesa.includes(s) || metodo.includes(s) || monto.includes(s);
  });

  // ===== Helpers impresión / detalles =====
  const fetchOrderDetail = async (orderId) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        total_amount,
        created_at,
        status,
        tables:table_id ( name ),
        users:user_id ( username ),
        order_items (
          id,
          quantity,
          price,
          notes,
          menu_items:menu_item_id ( name )
        ),
        payments:payments ( amount, ${DATE_COL}, payment_method )
      `)
      .eq('id', orderId)
      .single();
    if (error) throw error;
    return data;
  };

  const printReceiptForPayment = async (payment, opts = {}) => {
    try {
      const orderId = payment.order_id || payment?.orders?.id;
      if (!orderId) throw new Error('No se encontró la orden asociada al pago.');

      const detail = await fetchOrderDetail(orderId);

      // Monto entregado (efectivo) opcional para mostrar cambio
      let tendered = Number(opts.tendered);
      if (!Number.isFinite(tendered) && (payment.payment_method === 'cash' || payment?.payment_method === 'cash')) {
        const input = window.prompt('Monto entregado (opcional, solo efectivo):', Number(payment.amount).toFixed(2));
        const n = Number(input);
        if (Number.isFinite(n)) tendered = n;
      }

      const items = detail?.order_items || [];
      const printedWhen = payment[DATE_COL]
        ? new Date(payment[DATE_COL]).toLocaleString('es-MX', { timeZone: CDMX_TZ })
        : new Date().toLocaleString('es-MX', { timeZone: CDMX_TZ });

      const w = window.open('', '_blank', 'width=480,height=640');

      const styles = `
        <style>
          @page { size: 58mm auto; margin: 0; }
          html, body { margin: 0; padding: 0; }
          body { width: 58mm; }
          .ticket {
            width: 48mm; margin: 0 auto; padding: 2mm; box-sizing: border-box;
            color: #000; font-family: "Courier New", ui-monospace, Menlo, Consolas, monospace;
            font-weight: 700; line-height: 1.25; -webkit-print-color-adjust: exact; print-color-adjust: exact;
            text-rendering: optimizeLegibility; transform: translateX(0);
          }
          * { -webkit-font-smoothing: none; -moz-osx-font-smoothing: auto; }
          .center { text-align: center; }
          .logo { display:block; margin:0 auto 2mm; width:48mm; max-width:48mm; image-rendering:-webkit-optimize-contrast; image-rendering:crisp-edges; image-rendering:pixelated; }
          .title { font-weight:900; font-size:20px; margin:1mm 0 .5mm; letter-spacing:.2px; }
          .meta { font-size:14px; font-weight:800; margin-bottom:1mm; }
          hr { border:0; border-top:1px solid #000; margin:2mm 0; }
          .label { font-weight:800; }
          table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:14px; }
          .col-name{ width:60%; padding:1mm 0 .5mm 0; font-weight:800; }
          .col-qty { width:15%; text-align:center; font-weight:900; }
          .col-amt { width:25%; text-align:right; font-weight:900; }
          td { vertical-align:top; }
          .notes { font-size:13px; font-weight:700; margin-top:.5mm; }
          .col-name, .notes { word-break: break-word; overflow-wrap: anywhere; white-space: normal; }
          @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      `;

      const headerHtml = LOGO_URL
        ? `<img src="${LOGO_URL}" alt="logo" class="logo" width="384" crossorigin="anonymous" referrerpolicy="no-referrer" />`
        : `<div class="title center">TICKET</div>`;

      const itemsHtml = items.length
        ? items.map(it => {
            const name = it?.menu_items?.name || '—';
            const qty  = Number(it.quantity || 0);
            const price = Number(it.price || 0);
            const line = (qty * price).toFixed(2);
            return `
              <tr>
                <td class="col-name">
                  ${name}
                  ${it.notes ? `<div class="notes">Notas: ${it.notes}</div>` : ''}
                </td>
                <td class="col-qty">${qty}</td>
                <td class="col-amt">$${line}</td>
              </tr>
            `;
          }).join('')
        : `<tr><td class="col-name">(sin ítems)</td><td class="col-qty"></td><td class="col-amt"></td></tr>`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8" /><title>Ticket de Caja</title>${styles}</head>
        <body>
          <div class="ticket">
            ${headerHtml}
            <div class="center title">TICKET DE CAJA</div>
            <div class="center meta">#${String(detail.id).slice(0,8)} — ${printedWhen} (CDMX)</div>
            <hr />
            <div><span class="label">Mesa:</span> ${detail?.tables?.name || 'N/A'}</div>
            <div><span class="label">Estado:</span> ${statusLabel(detail?.status)}</div>
            <hr />
            <table>
              <thead><tr><td class="col-name"><strong>Producto</strong></td><td class="col-qty"><strong>Cant</strong></td><td class="col-amt"><strong>Importe</strong></td></tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <hr />
            <table>
              <tbody>
                <tr><td class="col-name">Total</td><td></td><td class="col-amt">$${Number(detail.total_amount || 0).toFixed(2)}</td></tr>
                <tr><td class="col-name">Método</td><td></td><td class="col-amt">${methodLabel(payment.payment_method)}</td></tr>
              </tbody>
            </table>
            <hr />
            <div class="center meta">¡Gracias por su compra!</div>
          </div>
          <script>
            (function(){
              function waitImages(){
                const imgs = Array.from(document.images);
                return Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.addEventListener('load', res); img.addEventListener('error', res); })));
              }
              waitImages().then(function(){ setTimeout(function(){ window.focus(); window.print(); window.close(); }, 150); });
            })();
          </script>
        </body>
        </html>
      `;

      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      setError(`No pude imprimir el ticket: ${e.message ?? e}`);
    }
  };

  // === Historial handlers ===
  const openHistory = async () => {
    setHistoryOpen(true);
    setSelectedDate(todayStr());
    await fetchPaymentsByDate(todayStr());
  };

  const changeHistoryDate = async (val) => {
    setSelectedDate(val);
    if (val) await fetchPaymentsByDate(val);
  };

  const openPaymentDetails = async (payment) => {
    try {
      const orderDetail = await fetchOrderDetail(payment.order_id);
      setDetailData({ payment, orderDetail });
      setDetailOpen(true);
    } catch (e) {
      setError('No pude leer el detalle del pago: ' + (e.message || e));
    }
  };

  const closeDetails = () => {
    setDetailOpen(false);
    setDetailData(null);
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
        Gestión de Caja
      </motion.h2>

      {error && (
        <motion.div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="block sm:inline">{error}</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
            <XCircle className="w-5 h-5 cursor-pointer" />
          </span>
        </motion.div>
      )}

      {debug.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl mb-3">
          <p className="font-semibold mb-2">Diagnóstico:</p>
          <ul className="list-disc pl-5 space-y-1">
            {debug.map((d, i) => (
              <li key={i}><strong>{d.where}:</strong> {d.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* === CUENTAS PENDIENTES === */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Wallet className="w-6 h-6" /> Cuentas pendientes de pago
          </h3>
          <span className="text-sm text-gray-500">
            {pendingBills.length} {pendingBills.length === 1 ? 'cuenta' : 'cuentas'}
          </span>
        </div>

        {pendingBills.length === 0 ? (
          <p className="text-gray-500">No hay cuentas pendientes. 🎉</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingBills.map(pb => (
              <div key={pb.id} className="rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-800">Orden #{String(pb.id).slice(0,8)}</div>
                  <div className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{statusLabel(pb.status)}</div>
                </div>
                <p className="text-gray-600 mb-1">Mesa: <span className="font-medium">{pb.table_name}</span></p>
                <p className="text-gray-600 mb-1">Total: <span className="font-medium">${pb.total.toFixed(2)}</span></p>
                <p className="text-gray-600 mb-1">Pagado: <span className="font-medium">${pb.paid.toFixed(2)}</span></p>
                <p className="text-gray-700 font-semibold mb-3">Pendiente: ${pb.due.toFixed(2)}</p>
                <button
                  onClick={() => prefillForOrder(pb.id, pb.due)}
                  className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white px-4 py-2 rounded-lg hover:opacity-95"
                >
                  Cobrar restante
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === BUSCADOR, NUEVO PAGO, HISTORIAL === */}
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
        <div className="flex gap-3 w-full md:w-auto">
          <motion.button
            onClick={openHistory}
            className="bg-white border border-indigo-300 text-indigo-700 px-6 py-3 rounded-xl shadow hover:bg-indigo-50 flex items-center space-x-2 w-full md:w-auto justify-center"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <Calendar className="w-5 h-5" />
            <span>Historial de pagos</span>
          </motion.button>

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
      </div>

      {/* === GRID DE PAGOS (SOLO HOY) === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredPayments.length === 0 ? (
            <motion.div
              className="col-span-full text-center py-10 text-gray-600 bg-white rounded-2xl shadow-xl p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Receipt className="w-24 h-24 text-gray-400 mx-auto mb-6" />
              <p className="text-xl font-semibold">¡No hay pagos registrados hoy!</p>
              <p className="text-gray-500">Registra un pago o consulta el historial.</p>
            </motion.div>
          ) : (
            filteredPayments.map((payment, index) => {
              const amt = Number(payment.amount);
              const amtText = Number.isFinite(amt) ? amt.toFixed(2) : String(payment.amount ?? '');
              const fechaText = payment[DATE_COL]
                ? new Date(payment[DATE_COL]).toLocaleString('es-MX', { timeZone: CDMX_TZ })
                : '—';
              const mesaName = payment?.orders?.tables?.name ? `Mesa ${payment.orders.tables.name}` : 'N/A';
              const usuario = payment?.orders?.users?.username ?? null;
              const isOrderPaid = payment?.orders?.status === PAID_STATUS;

              return (
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
                      {/* IMPORTANTE: Mostrar Orden # para que coincida con el ticket */}
                      <h3 className="text-2xl font-bold text-gray-800">
                        Orden #{String(payment.order_id).slice(0, 8)}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${isOrderPaid ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}`}>
                        ${amtText}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2 flex items-center">
                      <TableIcon className="w-4 h-4 mr-2 text-gray-500" />
                      {mesaName}
                    </p>
                    <p className="text-gray-600 mb-2 flex items-center">
                      <DollarSign className="w-4 h-4 mr-2 text-gray-500" />
                      Método: {methodLabel(payment.payment_method)}
                    </p>
                    <p className="text-gray-600 mb-2 flex items-center">
                      <User className="w-4 h-4 mr-2 text-gray-500" />
                      Cajero: {usuario || '—'}
                    </p>
                    <p className="text-gray-500 text-xs flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Fecha: {fechaText} (CDMX)
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-3 mt-4">
                    <motion.button
                      onClick={() => printReceiptForPayment(payment)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors duration-200 flex items-center gap-2"
                      title="Imprimir Ticket"
                    >
                      <Printer className="w-5 h-5" />
                      Ticket
                    </motion.button>

                    <motion.button
                      onClick={() => openEditModal(payment)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      className={`p-2 rounded-full transition-colors duration-200 ${isOrderPaid ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                      title={isOrderPaid ? 'Orden pagada: no editable' : 'Editar Pago'}
                      disabled={isOrderPaid}
                    >
                      <Edit className="w-5 h-5" />
                    </motion.button>

                    <motion.button
                      onClick={() => handleDeletePayment(payment.id)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      className={`p-2 rounded-full transition-colors duration-200 ${isOrderPaid ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                      title={isOrderPaid ? 'Orden pagada: no eliminable' : 'Eliminar Pago'}
                      disabled={isOrderPaid}
                    >
                      <Trash2 className="w-5 h-5" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* === MODAL: NUEVO/EDITAR PAGO === */}
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

              {/* Info: fecha/hora en CDMX (solo display, no editable) */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 mb-4">
                <span className="font-medium">Fecha/Hora (CDMX):</span>{' '}
                {new Date().toLocaleString('es-MX', { timeZone: CDMX_TZ })}
              </div>

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
                        Orden #{String(order.id).slice(0, 8)} — Mesa {order?.tables?.name || 'N/A'} (${Number(order.total_amount ?? 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Resumen de la cuenta */}
                {formData.order_id && (
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-gray-500">Total</div>
                      <div className="font-semibold">${Number(selectedOrderTotals.total).toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-gray-500">Pagado</div>
                      <div className="font-semibold">${Number(selectedOrderTotals.paid).toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-gray-500">Pendiente</div>
                      <div className="font-semibold">${Number(selectedOrderTotals.due).toFixed(2)}</div>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="amount" className="block text-gray-700 text-sm font-medium mb-2">Monto del Pago</label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ej: 350.00"
                    step="0.01"
                    min="0"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sugerencia: se precarga con el pendiente; puedes registrar pagos parciales.
                  </p>
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
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="transfer">Transferencia</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                {formData.payment_method === 'cash' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="tendered" className="block text-gray-700 text-sm font-medium mb-2">Monto Entregado</label>
                      <input
                        type="number"
                        id="tendered"
                        name="tendered"
                        value={formData.tendered}
                        onChange={handleInputChange}
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Ej: 500.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-2">Cambio</label>
                      <div className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50">
                        ${calcChange.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                <motion.button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={saving}
                >
                  {saving ? <LoadingSpinner /> : (currentPayment ? 'Guardar Cambios' : 'Registrar Pago')}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === MODAL: Confirmar impresión tras registrar pago === */}
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
                <h3 className="text-2xl font-bold text-gray-800">Imprimir ticket de la orden</h3>
              </div>

              <p className="text-gray-600 mb-6">
                ¿Deseas imprimir el ticket de caja de la orden asociada?
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
                    if (printPayment) printReceiptForPayment(printPayment);
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

      {/* === MODAL: HISTORIAL DE PAGOS === */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-3xl relative"
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
                <h3 className="text-2xl font-bold text-gray-800">Historial de pagos</h3>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1">Selecciona la fecha que deseas consultar</label>
                <input
                  type="date"
                  className="p-3 border rounded-lg"
                  value={selectedDate}
                  onChange={(e) => changeHistoryDate(e.target.value)}
                />
              </div>

              <div className="max-h-[60vh] overflow-auto border rounded-xl p-3">
                {historyLoading ? (
                  <div className="py-10"><LoadingSpinner /></div>
                ) : historyPayments.length === 0 ? (
                  <p className="text-gray-500 p-4">No hay pagos para esa fecha.</p>
                ) : (
                  <ul className="space-y-2">
                    {historyPayments.map((p) => {
                      const when = p[DATE_COL]
                        ? new Date(p[DATE_COL]).toLocaleString('es-MX', { timeZone: CDMX_TZ })
                        : '—';
                      const mesa = p?.orders?.tables?.name || 'N/A';
                      return (
                        <li
                          key={p.id}
                          className="p-3 rounded-lg border hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                          onClick={async () => {
                            setHistoryOpen(false);
                            await openPaymentDetails(p);
                          }}
                          title="Ver detalles del pago"
                        >
                          <div>
                            <div className="font-semibold">Orden #{String(p.order_id).slice(0,8)} — Mesa {mesa}</div>
                            <div className="text-sm text-gray-600">
                              {methodLabel(p.payment_method)} · ${Number(p.amount || 0).toFixed(2)} · {when}
                            </div>
                          </div>
                          <Receipt className="w-5 h-5 text-gray-400" />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === MODAL: DETALLE DE PAGO (desde Historial) === */}
      <AnimatePresence>
        {detailOpen && detailData && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-2xl relative"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            >
              <button
                onClick={closeDetails}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>

              <div className="mb-4">
                <h3 className="text-2xl font-bold text-gray-800">
                  Detalle — Orden #{String(detailData.orderDetail.id).slice(0,8)}
                </h3>
                <p className="text-sm text-gray-600">
                  {new Date(detailData.payment[DATE_COL]).toLocaleString('es-MX', { timeZone: CDMX_TZ })} (CDMX)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-gray-500">Mesa</div>
                  <div className="font-semibold">{detailData.orderDetail?.tables?.name || 'N/A'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-gray-500">Estado</div>
                  <div className="font-semibold">{statusLabel(detailData.orderDetail?.status)}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-gray-500">Método</div>
                  <div className="font-semibold">{methodLabel(detailData.payment?.payment_method)}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-gray-500">Monto</div>
                  <div className="font-semibold">${Number(detailData.payment?.amount || 0).toFixed(2)}</div>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-gray-100 font-semibold">Productos</div>
                <div className="p-4">
                  {(detailData.orderDetail?.order_items || []).length === 0 ? (
                    <p className="text-gray-500">No hay productos.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {detailData.orderDetail.order_items.map((it) => {
                        const qty = Number(it.quantity || 0);
                        const price = Number(it.price || 0);
                        const line = (qty * price).toFixed(2);
                        return (
                          <li key={it.id} className="flex justify-between">
                            <div>
                              <span className="font-medium">{it?.menu_items?.name || '—'}</span>
                              {it.notes ? <span className="text-gray-500 italic"> — {it.notes}</span> : null}
                              <span className="text-gray-600"> (x{qty})</span>
                            </div>
                            <div className="font-semibold">${line}</div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="px-4 py-2 bg-gray-50 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">${Number(detailData.orderDetail?.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100"
                  onClick={closeDetails}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => printReceiptForPayment(detailData.payment)}
                >
                  Imprimir ticket
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Cashier;
