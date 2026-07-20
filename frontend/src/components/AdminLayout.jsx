import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const menuItems = [
    { path: '/admin', label: 'Dashboard' },
    { path: '/admin/products', label: 'Products' },
    { path: '/admin/reports', label: 'Reports' },
    { path: '/admin/cashiers', label: 'Staff' },
    { path: '/pos', label: 'Cashier POS' },
  ];

  return (
    <div className="dashboard-layout fade-in">
      <div className="sidebar">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
          SME Control Center
        </h2>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <a 
              key={item.path}
              href="#"
              onClick={(e) => { e.preventDefault(); navigate(item.path); }}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <button 
          onClick={handleLogout} 
          className="btn btn-danger" 
          style={{ marginTop: 'auto' }}
        >
          Logout
        </button>
      </div>

      <div className="main-content glass-panel" style={{ margin: '1rem', borderRadius: '1.5rem' }}>
        {children}
      </div>
    </div>
  );
}
