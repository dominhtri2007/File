import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import AdminDashboard from './pages/AdminDashboard';
import CustomerPortal from './pages/CustomerPortal';
import CrackPortal from './pages/CrackPortal';
import ServicesPortal from './pages/ServicesPortal';
import GuidePage from './pages/GuidePage';

const PrivateRoute = ({ children, requireAdmin }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) return <Navigate to="/login" />;
  if (requireAdmin && role !== 'admin') return <Navigate to="/customer" replace />;

  return children;
};

function App() {
  return (
    <Router>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          <Route path="/" element={
            <PrivateRoute>
              <Navigate to="/customer" replace />
            </PrivateRoute>
          } />
          
          <Route path="/customer" element={
            <PrivateRoute>
              <CustomerPortal />
            </PrivateRoute>
          } />

          <Route path="/crack" element={
            <PrivateRoute>
              <CrackPortal />
            </PrivateRoute>
          } />

          <Route path="/services" element={
            <PrivateRoute>
              <ServicesPortal />
            </PrivateRoute>
          } />

          <Route path="/guide" element={
            <PrivateRoute>
              <GuidePage />
            </PrivateRoute>
          } />
          
          <Route path="/admin" element={
            <PrivateRoute requireAdmin={true}>
              <AdminDashboard />
            </PrivateRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
