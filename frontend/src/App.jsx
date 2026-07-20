import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import CashierPOS from './pages/CashierPOS';
import Products from './pages/Products';
import Reports from './pages/Reports';
import Cashiers from './pages/Cashiers';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/products" element={<Products />} />
      <Route path="/admin/reports" element={<Reports />} />
      <Route path="/admin/cashiers" element={<Cashiers />} />
      <Route path="/pos" element={<CashierPOS />} />
      <Route path="*" element={<div style={{ padding: '2rem', color: 'var(--error-text)' }}>404 Not Found</div>} />
    </Routes>
  );
}

export default App;
