import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, PlusCircle, Edit, Trash2, Tag, DollarSign, Image, Info, Search, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

const Menu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', category_id: '', image_url: '', is_available: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetchMenuAndCategories();
  }, []);

  const fetchMenuAndCategories = async () => {
    setLoading(true);
    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select(`
        *,
        categories (
          name
        )
      `)
      .order('name', { ascending: true });

    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (menuError) {
      console.error('Error fetching menu items:', menuError);
      setError('No pude traer los platos, ¿se los comieron todos?');
    } else {
      setMenuItems(menuData);
    }

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      setError(prev => prev + ' Y tampoco las categorías, ¡qué desastre!');
    } else {
      setCategories(categoriesData);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleAddEditItem = async (e) => {
    e.preventDefault();
    setLoading(true);
    let error;
    const itemToSave = {
      ...formData,
      price: parseFloat(formData.price),
      category_id: formData.category_id || null // Ensure category_id is null if empty
    };

    if (currentItem) {
      // Update
      const { error: updateError } = await supabase
        .from('menu_items')
        .update(itemToSave)
        .eq('id', currentItem.id);
      error = updateError;
    } else {
      // Add
      const { error: insertError } = await supabase
        .from('menu_items')
        .insert(itemToSave);
      error = insertError;
    }

    if (error) {
      console.error('Error saving menu item:', error);
      setError(`¡Ups! No pude guardar el plato. Error: ${error.message}`);
    } else {
      fetchMenuAndCategories();
      setIsModalOpen(false);
      setCurrentItem(null);
      setFormData({ name: '', description: '', price: '', category_id: '', image_url: '', is_available: true });
    }
    setLoading(false);
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este plato? ¡Podrías dejar a tus clientes con hambre!')) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting menu item:', error);
      setError('No pude borrar el plato. ¡Se resiste a desaparecer!');
    } else {
      fetchMenuAndCategories();
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setCurrentItem(null);
    setFormData({ name: '', description: '', price: '', category_id: categories.length > 0 ? categories[0].id : '', image_url: '', is_available: true });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setCurrentItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price,
      category_id: item.category_id,
      image_url: item.image_url || '',
      is_available: item.is_available
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentItem(null);
    setFormData({ name: '', description: '', price: '', category_id: '', image_url: '', is_available: true });
    setError(null);
  };

  const filteredItems = menuItems.filter(item =>
    (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterCategory === 'all' || item.category_id === filterCategory)
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
        Gestión del Menú
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
            placeholder="Buscar platos por nombre o descripción..."
            className="w-full p-3 pl-10 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        </div>
        <div className="w-full md:w-1/4">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
          >
            <option value="all">Todas las Categorías</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <motion.button
          onClick={openAddModal}
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl flex items-center space-x-2 transition-all duration-200 w-full md:w-auto justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <PlusCircle className="w-5 h-5" />
          <span>Agregar Plato</span>
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
              className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200 flex flex-col"
            >
              {item.image_url && (
                <img src={item.image_url} alt={item.name} className="w-full h-48 object-cover rounded-xl mb-4 shadow-md" />
              )}
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{item.name}</h3>
              <p className="text-gray-600 text-sm mb-3 flex items-center flex-grow">
                <Info className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                {item.description || 'Sin descripción, ¡un misterio culinario!'}
              </p>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 flex items-center">
                  <Tag className="w-4 h-4 mr-2" />
                  {item.categories ? item.categories.name : 'Sin Categoría'}
                </span>
                <span className="text-2xl font-bold text-green-600 flex items-center">
                  <DollarSign className="w-5 h-5 mr-1" />
                  {item.price.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-end space-x-3 mt-auto">
                <motion.button
                  onClick={() => openEditModal(item)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200"
                  title="Editar Plato"
                >
                  <Edit className="w-5 h-5" />
                </motion.button>
                <motion.button
                  onClick={() => handleDeleteItem(item.id)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200"
                  title="Eliminar Plato"
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
            <p>¡Vaya! No encontré ningún plato con esos criterios. ¿Quizás el chef está de vacaciones?</p>
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
                {currentItem ? 'Editar Plato' : 'Agregar Nuevo Plato'}
              </h3>
              <form onSubmit={handleAddEditItem} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-gray-700 text-sm font-medium mb-2">Nombre del Plato</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ej: Pizza Margarita"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-gray-700 text-sm font-medium mb-2">Descripción</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                    placeholder="Ej: Tomate, mozzarella fresca, albahaca y aceite de oliva."
                    rows="3"
                  ></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="price" className="block text-gray-700 text-sm font-medium mb-2">Precio</label>
                    <input
                      type="number"
                      id="price"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Ej: 15.99"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="category_id" className="block text-gray-700 text-sm font-medium mb-2">Categoría</label>
                    <select
                      id="category_id"
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleInputChange}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecciona una categoría</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="image_url" className="block text-gray-700 text-sm font-medium mb-2">URL de la Imagen (Opcional)</label>
                  <input
                    type="text"
                    id="image_url"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ej: https://ejemplo.com/pizza.jpg"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_available"
                    name="is_available"
                    checked={formData.is_available}
                    onChange={handleInputChange}
                    className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="is_available" className="ml-2 block text-gray-700 text-sm font-medium">Disponible</label>
                </div>
                <motion.button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner /> : (currentItem ? 'Guardar Cambios' : 'Agregar Plato')}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Menu;