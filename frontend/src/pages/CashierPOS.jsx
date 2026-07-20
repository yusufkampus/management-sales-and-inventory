import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { apiFetch } from '../api';

export default function CashierPOS() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [userRole, setUserRole] = useState('cashier');
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderTotal, setLastOrderTotal] = useState(0);

  useEffect(() => {
    fetchProducts();
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (data) {
        setUserRole(data.role);
      }
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/products');
      setProducts(res.data || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const addToCart = (product) => {
    setCart(currentCart => {
      const existing = currentCart.find(item => item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          alert('Not enough stock available');
          return currentCart;
        }
        return currentCart.map(item => 
          item.product_id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      if (product.stock_quantity <= 0) {
        alert('Product is out of stock');
        return currentCart;
      }
      return [...currentCart, { product_id: product.id, name: product.name, price: product.price, quantity: 1, stock: product.stock_quantity }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart(currentCart => {
      return currentCart.map(item => {
        if (item.product_id === productId) {
          const newQ = item.quantity + delta;
          if (newQ > item.stock) {
            alert('Cannot exceed available stock');
            return item;
          }
          if (newQ <= 0) return null;
          return { ...item, quantity: newQ };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    try {
      setIsProcessing(true);
      setMessage(null);
      
      const payload = {
        items: cart.map(c => ({ product_id: c.product_id, quantity: c.quantity }))
      };
      
      await apiFetch('/pos/checkout', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      setLastOrderTotal(total);
      setShowSuccessModal(true);
      fetchProducts(); // Refresh stock
      
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Checkout failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinishTransaction = () => {
    setCart([]);
    setShowSuccessModal(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="dashboard-layout fade-in">
      <div className="sidebar" style={{ width: '80px', alignItems: 'center', padding: '2rem 0' }}>
        <nav className="sidebar-nav" style={{ marginTop: 0 }}>
          {userRole === 'admin' ? (
            <button 
              onClick={() => navigate('/admin')} 
              style={{ width: '50px', height: '50px', background: 'var(--text-main)', color: 'var(--bg-color)', border: 'none', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
              title="Back to Admin Dashboard"
            >
              Admin
            </button>
          ) : (
            <div style={{ width: '50px', height: '50px', background: 'var(--text-main)', color: 'var(--bg-color)', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
               POS
            </div>
          )}
        </nav>
        
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={handleLogout} 
            style={{ background: 'transparent', border: 'none', color: 'var(--error-text)', cursor: 'pointer', padding: '1rem', transition: 'var(--transition)' }}
            title="Logout"
          >
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Exit</span>
          </button>
        </div>
      </div>

      <div className="main-content" style={{ display: 'flex', gap: '2rem', padding: '1rem', overflow: 'hidden' }}>
        
        <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h1 className="page-title" style={{ fontSize: '1.75rem' }}>New Sale</h1>
          <input 
            type="text" 
            className="form-input" 
            style={{ marginBottom: '2rem' }} 
            placeholder="Search products by name or SKU..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem', alignContent: 'start', paddingRight: '0.5rem' }}>
            {loading ? (
              <div style={{ color: 'var(--text-muted)' }}>Loading catalog...</div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No products found.</div>
            ) : (
              filteredProducts.map(product => (
                <div key={product.id} className="pos-product-card glass-panel" onClick={() => addToCart(product)}>
                  <div style={{ 
                    width: '100%', 
                    height: '120px', 
                    background: product.image_url ? `url(${product.image_url}) center/cover no-repeat` : 'rgba(255,255,255,0.03)',
                    borderRadius: '0.75rem', 
                    marginBottom: '1rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '2rem', 
                    border: product.image_url ? 'none' : '1px dashed var(--panel-border)' 
                  }}>
                    {!product.image_url && '📦'}
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>{product.name}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <span style={{ color: 'var(--accent-1)', fontSize: '0.9rem', fontWeight: 500 }}>{formatCurrency(product.price)}</span>
                    <span style={{ fontSize: '0.75rem', color: product.stock_quantity > 0 ? 'var(--text-muted)' : 'var(--error-text)' }}>
                      {product.stock_quantity} left
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="glass-panel" style={{ width: '380px', padding: '2rem', display: 'flex', flexDirection: 'column', borderRadius: '1.5rem', margin: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: 600 }}>Current Order</h2>
          
          {message && (
            <div className="fade-in" style={{ padding: '1rem', borderRadius: '0.75rem', marginBottom: '1rem', background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'var(--error-bg)', color: message.type === 'success' ? '#10b981' : 'var(--error-text)', border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'var(--error-border)'}` }}>
              {message.text}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {cart.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40%' }}>No items selected</p>
            ) : (
              cart.map(item => (
                <div key={item.product_id} className="pos-cart-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{item.name}</div>
                    <div style={{ color: 'var(--accent-1)', fontSize: '0.85rem' }}>{formatCurrency(item.price)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '0.5rem' }}>
                    <button onClick={() => updateQuantity(item.product_id, -1)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0.25rem 0.5rem' }}>-</button>
                    <span style={{ fontSize: '0.9rem', minWidth: '1.5rem', textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product_id, 1)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0.25rem 0.5rem' }}>+</button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--panel-border)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
              <span style={{ fontWeight: 500 }}>{formatCurrency(total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: 'var(--accent-1)' }}>{formatCurrency(total)}</span>
            </div>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', opacity: (cart.length === 0 || isProcessing) ? 0.6 : 1 }}
              onClick={checkout}
              disabled={cart.length === 0 || isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Charge Payment'}
            </button>
          </div>
        </div>
      </div>

      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="fade-in" style={{
            backgroundColor: 'var(--bg-color)',
            padding: '3rem',
            width: '90%',
            maxWidth: '400px',
            border: '1px solid var(--panel-border)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', border: '2px solid var(--text-main)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem'
            }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 300 }}>✓</span>
            </div>
            <h2 style={{ fontFamily: 'Playfair Display', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Payment Successful</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Total Amount: <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatCurrency(lastOrderTotal)}</span></p>
            
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}
              onClick={handleFinishTransaction}
            >
              Done / New Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
