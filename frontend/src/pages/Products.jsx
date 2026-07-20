import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../api';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Umum',
    price: '',
    stock_quantity: '',
    min_stock_threshold: '10',
    image_base64: null
  });

  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/products');
      setProducts(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_base64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      if (editingId) {
        await apiFetch(`/products/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...formData,
            price: Number(formData.price),
            stock_quantity: Number(formData.stock_quantity),
            min_stock_threshold: Number(formData.min_stock_threshold)
          })
        });
      } else {
        await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify({
            ...formData,
            price: Number(formData.price),
            stock_quantity: Number(formData.stock_quantity),
            min_stock_threshold: Number(formData.min_stock_threshold)
          })
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', sku: '', category: 'Umum', price: '', stock_quantity: '', min_stock_threshold: '10', image_base64: null });
      fetchProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await apiFetch(`/products/${id}`, { method: 'DELETE' });
        fetchProducts();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleEdit = (product) => {
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: product.price,
      stock_quantity: product.stock_quantity,
      min_stock_threshold: product.min_stock_threshold,
      image_base64: product.image_url || null
    });
    setEditingId(product.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <AdminLayout>
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 className="page-title">Products Catalog</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>Manage your inventory items</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => {
              if (showForm) {
                 setShowForm(false);
                 setEditingId(null);
                 setFormData({ name: '', sku: '', category: 'Umum', price: '', stock_quantity: '', min_stock_threshold: '10', image_base64: null });
              } else {
                 setShowForm(true);
              }
            }}
          >
            {showForm ? 'Cancel' : '+ Add Product'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {showForm && (
          <div className="glass-panel fade-in" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>{editingId ? 'Edit Product' : 'Add New Product'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Product Image</label>
                  <input type="file" accept="image/*" className="form-input" onChange={handleImageChange} style={{ padding: '0.75rem' }} />
                  {formData.image_base64 && (
                    <div style={{ marginTop: '1rem', width: '100px', height: '100px', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
                      <img src={formData.image_base64} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <input type="text" name="name" className="form-input" required value={formData.name} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <input type="text" name="sku" className="form-input" required value={formData.sku} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input type="text" name="category" className="form-input" required value={formData.category} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Price (IDR)</label>
                  <input type="number" name="price" className="form-input" required min="0" value={formData.price} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Stock</label>
                  <input type="number" name="stock_quantity" className="form-input" required min="0" value={formData.stock_quantity} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Low Stock Threshold</label>
                  <input type="number" name="min_stock_threshold" className="form-input" required min="0" value={formData.min_stock_threshold} onChange={handleChange} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem', width: '200px' }} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Product'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading products...</div>
        ) : (
          <div className="table-container glass-panel" style={{ padding: '1.5rem' }}>
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No products found.</td>
                  </tr>
                ) : (
                  products.map(product => {
                    const isLowStock = product.stock_quantity <= product.min_stock_threshold;
                    return (
                      <tr key={product.id}>
                        <td>
                          <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span>📦</span>
                            )}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{product.sku}</td>
                        <td style={{ fontWeight: 500 }}>{product.name}</td>
                        <td>{formatCurrency(product.price)}</td>
                        <td style={{ fontWeight: 600, color: isLowStock ? 'var(--error-text)' : 'inherit' }}>
                          {product.stock_quantity}
                        </td>
                        <td>
                          {isLowStock ? (
                            <span className="badge badge-danger">Low Stock</span>
                          ) : (
                            <span className="badge badge-success">OK</span>
                          )}
                        </td>
                        <td style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', background: 'var(--accent-2)' }}
                            onClick={() => handleEdit(product)}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
                            onClick={() => handleDelete(product.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
