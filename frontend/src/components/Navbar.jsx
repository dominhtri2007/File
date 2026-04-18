import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Gamepad2, LogOut, Key, UserCircle, Download, LayoutList, FileText } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const username = localStorage.getItem('username');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    navigate('/login');
  };

  if (!token) return null;

  return (
    <nav style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '1rem 2rem',
      background: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--steam-blue)' }}>
          <Gamepad2 /> Steam Manager
        </h2>
        
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <NavLink to="/customer" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#ccc', textDecoration: 'none', padding: '0.5rem', borderRadius: '4px'}}>
             <Gamepad2 size={18} /> Game Bản Quyền
          </NavLink>
          
          <NavLink to="/crack" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#ccc', textDecoration: 'none', padding: '0.5rem', borderRadius: '4px'}}>
             <Download size={18} /> Game Crack
          </NavLink>
          
          <NavLink to="/services" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#ccc', textDecoration: 'none', padding: '0.5rem', borderRadius: '4px'}}>
             <LayoutList size={18} /> Dịch Vụ Khác
          </NavLink>
          
          <NavLink to="/guide" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#ccc', textDecoration: 'none', padding: '0.5rem', borderRadius: '4px'}}>
             <FileText size={18} /> Hướng Dẫn
          </NavLink>

          {role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--steam-green)', textDecoration: 'none', padding: '0.5rem', borderRadius: '4px', fontWeight: 'bold'}}>
              <Key size={18} /> Quản Trị Hệ Thống
            </NavLink>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCircle size={18} /> Xin chào, <strong style={{ color: '#fff' }}>{username}</strong>
        </span>
        <button onClick={handleLogout} className="btn" style={{ background: 'rgba(255, 0, 0, 0.2)', color: '#ffbaba', borderColor: 'transparent' }}>
          <LogOut size={16} /> Thoát
        </button>
      </div>
    </nav>
  );
}
