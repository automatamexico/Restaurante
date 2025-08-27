import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, PlusCircle, Edit, Trash2, Search, XCircle, Box, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

const Inventory = () => {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', unit: '', quantity: '', min_stock_level: '', supplier: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  const fetchInventoryItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching inventory items:', error);
      setError('No pude traer los ítems del inventario. ¿Se los llevaron los duendes?');
    } else {
      setInventoryItems(data);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddEditItem = async (e) => {
    e.preventDefault();
    setLoading(true);
    let error;
    const itemToSave = {
      ...formData,
      quantity: parseFloat(formData.quantity),
      min_stock_level: parseFloat(formData.min_stock_level),
    };

    if (currentItem) {
      // Update
      const { error: updateError } = await supabase
        .from('inventory')
        .update(itemToSave)
        .eq('id', currentItem.id);
      error = updateError;
    } else {
      // Add
      const { error: insertError } = await supabase
        .from('inventory')
        .insert(itemToSave);
      error = insertError;
    }

    if (error) {
      console.error('Error saving inventory item:', error);
      setError(`¡Ups! No pude guardar el ítem. Error: ${error.message}`);
    } else {
      fetchInventoryItems();
      setIsModalOpen(false);
      setCurrentItem(null);
      setFormData({ name: '', unit: '', quantity: '', min_stock_level: '', supplier: '' });
    }
    setLoading(false);
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este ítem del inventario? ¡Podrías quedarte sin ingredientes!')) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting inventory item:', error);
      setError('No pude borrar el ítem. ¡Se resiste a desaparecer!');
    } else {
      fetchInventoryItems();
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setCurrentItem(null);
    setFormData({ name: '', unit: '', quantity: '', min_stock_level: '', supplier: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setCurrentItem(item);
    setFormData({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      min_stock_level: item.min_stock_level,
      supplier: item.supplier || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentItem(null);
    setFormData({ name: '', unit: '', quantity: '', min_stock_level: '', supplier: '' });
    setError(null);
  };

  const filteredItems = inventoryItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatusColor = (item) => {
    if (item.quantity <= item.min_stock_level) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-green-100 text-green-800';
  };

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
        Gestión de Inventario
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
            placeholder="Buscar ítems por nombre, unidad o proveedor..."
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
          <span>Agregar Ítem</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200 flex flex-col justify-between transform hover:scale-105 transition-transform duration-300"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-bold text-gray-800">{item.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStockStatusColor(item)}`}>
                    Stock: {item.quantity} {item.unit}
                  </span>
                </div>
                <p className="text-gray-600 mb-2 flex items-center">
                  <Box className="w-4 h-4 mr-2 text-gray-500" />
                  Mínimo: {item.min_stock_level} {item.unit}
                </p>
                <p className="text-gray-600 flex items-center">
                  <User className="w-4 h-4 mr-2 text-gray-500" />
                  Proveedor: {item.supplier || 'N/A'}
                </p>
              </div>
              <div className="flex justify-end space-x-3 mt-4">
                <motion.button
                  onClick={() => openEditModal(item)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200"
                  title="Editar Ítem"
                >
                  <Edit className="w-5 h-5" />
                </motion.button>
                <motion.button
                  onClick={() => handleDeleteItem(item.id)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200"
                  title="Eliminar Ítem"
                >
                  <Trash2 className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {filteredItems.length === 0 && (
          <motion.div
            className="col-span-full text-center py-10 text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p>¡Vaya! No encontré ningún ítem con esos criterios. ¿Quizás se agotaron?</p>
          </motion.div>
        )}
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
                {currentItem ? 'Editar Ítem' : 'Agregar Nuevo Ítem'}
              </h3>
              <form onSubmit={handleAddEditItem} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-gray-700 text-sm font-medium mb-2">Nombre del Ítem</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ej: Harina de Trigo"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="unit" className="block text-gray-700 text-sm font-medium mb-2">Unidad de Medida</label>
                  <input
                    type="text"
                    id="unit"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ej: kg, litros, unidades"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="quantity" className="block text-gray-700 text-sm font-medium mb-2">Cantidad Actual</label>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Ej: 50"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="min_stock_level" className="block text-gray-700 text-sm font-medium mb-2">Nivel Mínimo de Stock</label>
                    <input
                      type="number"
                      id="min_stock_level"
                      name="min_stock_level"
                      value={formData.min_stock_level}
                      onChange={handleInputChange}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Ej: 10"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="supplier" className="block text-gray-700 text-sm font-medium mb-2">Proveedor (Opcional)</label>
                  <input
                    type="text"
                    id="supplier"
                    name="supplier"
                    value={formData.supplier}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ej: Distribuidora La Esquina"
                  />
                </div>
                <motion.button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner /> : (currentItem ? 'Guardar Cambios' : 'Agregar Ítem')}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;