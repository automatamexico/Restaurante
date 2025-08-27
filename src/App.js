import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tables from './pages/Tables';
import Menu from './pages/Menu';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import Cashier from './pages/Cashier';
import Inventory from './pages/Inventory';
import Users from './pages/Users';
import Login from './pages/Login'; // Importar el componente de Login

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} /> {/* Ruta para el login */}
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/tables" element={<Layout><Tables /></Layout>} />
        <Route path="/menu" element={<Layout><Menu /></Layout>} />
        <Route path="/orders" element={<Layout><Orders /></Layout>} />
        <Route path="/kitchen" element={<Layout><Kitchen /></Layout>} />
        <Route path="/cashier" element={<Layout><Cashier /></Layout>} />
        <Route path="/inventory" element={<Layout><Inventory /></Layout>} />
        <Route path="/users" element={<Layout><Users /></Layout>} />
        {/* Aquí irán más rutas a medida que construyas tu imperio */}
      </Routes>
    </Router>
  );
}