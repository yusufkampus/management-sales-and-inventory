import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../api';

export default function Cashiers() {
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    fetchCashiers();
  }, []);

  const fetchCashiers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/users/cashiers');
      setCashiers(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const payload = { ...formData };
      if (editingId && !payload.password) {
        delete payload.password;
      }
      if (editingId) {
        await apiFetch(`/users/cashiers/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/users/cashiers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ full_name: '', email: '', password: '' });
      fetchCashiers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (cashier) => {
    setFormData({
      full_name: cashier.full_name,
      email: cashier.email,
      password: ''
    });
    setEditingId(cashier.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this cashier account?')) {
      try {
        await apiFetch(`/users/cashiers/${id}`, { method: 'DELETE' });
        fetchCashiers();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  return (
    <AdminLayout>
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 className="page-title">Staff Management</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>Manage cashier accounts for your store</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => {
              if (showForm) {
                 setShowForm(false);
                 setEditingId(null);
                 setFormData({ full_name: '', email: '', password: '' });
              } else {
                 setShowForm(true);
              }
            }}
          >
            {showForm ? 'Cancel' : '+ Add Cashier'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {showForm && (
          <div className="glass-panel fade-in" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>{editingId ? 'Edit Cashier Account' : 'Create New Cashier Account'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', maxWidth: '400px' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" name="full_name" className="form-input" required value={formData.full_name} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address (for login)</label>
                  <input type="email" name="email" className="form-input" required value={formData.email} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password {editingId && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Leave blank to keep current)</span>}</label>
                  <input type="password" name="password" className="form-input" required={!editingId} minLength="6" value={formData.password} onChange={handleChange} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                {editingId ? 'Save Changes' : 'Create Account'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading staff data...</div>
        ) : (
          <div className="table-container glass-panel" style={{ padding: '1.5rem' }}>
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Joined Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cashiers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No cashiers found.</td>
                  </tr>
                ) : (
                  cashiers.map(cashier => (
                    <tr key={cashier.id}>
                      <td style={{ fontWeight: 500 }}>{cashier.full_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{cashier.email}</td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {new Date(cashier.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        {cashier.is_active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-danger">Inactive</span>
                        )}
                      </td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        {cashier.is_active && (
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', background: 'var(--accent-2)' }}
                            onClick={() => handleEdit(cashier)}
                          >
                            Edit
                          </button>
                        )}
                        {cashier.is_active && (
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
                            onClick={() => handleDelete(cashier.id)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
