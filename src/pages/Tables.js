import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Table, PlusCircle, Edit, Trash2, CheckCircle, XCircle, MapPin, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

const Tables = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTable, setCurrentTable] = useState(null);
  const [formData, setFormData] = useState({ name: '', capacity: '', status: 'available', location: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching tables:', error);
      setError('No pude traer las mesas. ¿Están escondidas?');
    } else {
      setTables(data);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddEditTable = async (e) => {
    e.preventDefault();
    setLoading(true);
    let error;
    if (currentTable) {
      // Update
      const { error: updateError } = await supabase
        .from('tables')
        .update(formData)
        .eq('id', currentTable.id);
      error = updateError;
    } else {
      // Add
      const { error: insertError } = await supabase
        .from('tables')
        .insert(formData);
      error = insertError;
    }

    if (error) {
      console.error('Error saving table:', error);
      setError(`¡Ups! No pude guardar la mesa. Error: ${error.message}`);
    } else {
      fetchTables();
      setIsModalOpen(false);
      setCurrentTable(null);
      setFormData({ name: '', capacity: '', status: 'available', location: '' });
    }
    setLoading(false);
  };

  const handleDeleteTable = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta mesa? ¡Podrías dejar a alguien sin asiento!')) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting table:', error);
      setError('No pude borrar la mesa. ¡Se aferra a la vida!');
    } else {
      fetchTables();
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setCurrentTable(null);
    setFormData({ name: '', capacity: '', status: 'available', location: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (table) => {
    setCurrentTable(table);
    setFormData({ name: table.name, capacity: table.capacity, status: table.status, location: table.location });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentTable(null);
    setFormData({ name: '', capacity: '', status: 'available', location: '' });
    setError(null); // Clear error on close
  };

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    table.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    table.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'occupied': return 'bg-red-100 text-red-800';
      case 'reserved': return 'bg-blue-100 text-blue-800';
      case 'cleaning': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
        Gestión de Mesas
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
            placeholder="Buscar mesas por nombre, ubicación o estado..."
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
          <span>Agregar Nueva Mesa</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredTables.map((table, index) => (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200 flex flex-col justify-between transform hover:scale-105 transition-transform duration-300"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-bold text-gray-800">{table.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(table.status)}`}>
                    {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                  </span>
                </div>
                <p className="text-gray-600 mb-2">Capacidad: <span className="font-semibold">{table.capacity} personas</span></p>
                <p className="text-gray-600 flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                  {table.location || 'Sin especificar'}
                </p>
              </div>
              <div className="flex justify-end space-x-3 mt-4">
                <motion.button
                  onClick={() => openEditModal(table)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200"
                  title="Editar Mesa"
                >
                  <Edit className="w-5 h-5" />
                </motion.button>
                <motion.button
                  onClick={() => handleDeleteTable(table.id)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200"
                  title="Eliminar Mesa"
                >
                  <Trash2 className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {filteredTables.length === 0 && (
          <motion.div
            className="col-span-full text-center py-10 text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p>¡Vaya! No encontré ninguna mesa con esos criterios. ¿Quizás están de vacaciones?</p>
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
                {currentTable ? 'Editar Mesa' : 'Agregar Nueva Mesa'}
              </h3>
              <form onSubmit={handleAddEditTable} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-gray-700 text-sm font-medium mb-2">Nombre de la Mesa</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ej: Mesa VIP 1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="capacity" className="block text-gray-700 text-sm font-medium mb-2">Capacidad (personas)</label>
                  <input
                    type="number"
                    id="capacity"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ej: 4"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="status" className="block text-gray-700 text-sm font-medium mb-2">Estado</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="available">Disponible</option>
                    <option value="occupied">Ocupada</option>
                    <option value="reserved">Reservada</option>
                    <option value="cleaning">Limpieza</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="location" className="block text-gray-700 text-sm font-medium mb-2">Ubicación</label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ej: Salón Principal, Terraza"
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
                  {loading ? <LoadingSpinner /> : (currentTable ? 'Guardar Cambios' : 'Agregar Mesa')}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tables;