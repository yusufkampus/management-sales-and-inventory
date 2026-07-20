import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../api';
import { supabase } from '../supabase';

export default function Reports() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [selectedTx, setSelectedTx] = useState(null);

  const [cashiers, setCashiers] = useState({});
  const [products, setProducts] = useState({});

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const [txRes, productsRes, cashiersRes, { data: usersData }] = await Promise.all([
        apiFetch('/pos/transactions'),
        apiFetch('/products'),
        apiFetch('/users/cashiers'),
        supabase.from('users').select('id, full_name')
      ]);
      
      const cashierMap = {};
      
      if (cashiersRes.data) {
        cashiersRes.data.forEach(c => {
          cashierMap[c.id] = c.full_name;
        });
      }

      if (usersData) {
        usersData.forEach(c => {
          cashierMap[c.id] = c.full_name;
        });
      }
      
      setCashiers(cashierMap);

      const productMap = {};
      if (productsRes.data) {
        productsRes.data.forEach(p => {
          productMap[p.id] = p.name;
        });
      }
      setProducts(productMap);
      
      setTransactions(txRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <AdminLayout>
      <div className="fade-in">
        <h1 className="page-title">Sales Reports</h1>
        <p className="page-subtitle">View and analyze your transaction history</p>

        {error && <div className="error-message">{error}</div>}

        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.875rem' }}>Start Date</label>
            <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.875rem' }}>End Date</label>
            <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear Filter</button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading reports...</div>
        ) : (
          <div className="table-container glass-panel" style={{ padding: '1.5rem' }}>
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Transaction ID</th>
                  <th>Total Items</th>
                  <th>Total Amount</th>
                  <th>Cashier</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.filter(tx => {
                  if (!startDate && !endDate) return true;
                  const txDate = new Date(tx.created_at).setHours(0,0,0,0);
                  const start = startDate ? new Date(startDate).setHours(0,0,0,0) : -Infinity;
                  const end = endDate ? new Date(endDate).setHours(23,59,59,999) : Infinity;
                  return txDate >= start && txDate <= end;
                }).length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found for the selected dates.</td>
                  </tr>
                ) : (
                  transactions.filter(tx => {
                    if (!startDate && !endDate) return true;
                    const txDate = new Date(tx.created_at).setHours(0,0,0,0);
                    const start = startDate ? new Date(startDate).setHours(0,0,0,0) : -Infinity;
                    const end = endDate ? new Date(endDate).setHours(23,59,59,999) : Infinity;
                    return txDate >= start && txDate <= end;
                  }).map(tx => {
                    const totalItems = tx.transaction_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                    return (
                      <tr key={tx.id}>
                        <td style={{ color: 'var(--text-muted)' }}>{formatDate(tx.created_at)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{tx.id.substring(0, 8)}...</td>
                        <td>{totalItems} items</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-3)' }}>{formatCurrency(tx.total_amount)}</td>
                        <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{cashiers[tx.cashier_id] || tx.cashier_id.substring(0, 8)}</td>
                        <td>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                            onClick={() => setSelectedTx(tx)}
                          >
                            View
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

      {/* Modal for Transaction Details */}
      {selectedTx && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setSelectedTx(null)}>
          <div style={{
            backgroundColor: 'var(--bg-color)',
            padding: '1.5rem 2rem',
            width: '90%',
            maxWidth: '550px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--panel-border)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Playfair Display', fontSize: '1.4rem', marginBottom: '1rem' }}>Transaction Details</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <div>
                <strong>Transaction ID:</strong><br />
                <span style={{ fontFamily: 'monospace' }}>{selectedTx.id}</span>
              </div>
              <div>
                <strong>Date & Time:</strong><br />
                {formatDate(selectedTx.created_at)}
              </div>
              <div>
                <strong>Cashier:</strong><br />
                <span style={{ fontWeight: 500 }}>{cashiers[selectedTx.cashier_id] || selectedTx.cashier_id}</span>
              </div>
              <div>
                <strong>Total Amount:</strong><br />
                <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1rem' }}>{formatCurrency(selectedTx.total_amount)}</span>
              </div>
            </div>
            
            <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purchased Items</h3>
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ paddingBottom: '0.4rem' }}>Item</th>
                    <th style={{ paddingBottom: '0.4rem', textAlign: 'center' }}>Qty</th>
                    <th style={{ paddingBottom: '0.4rem', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTx.transaction_items?.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--panel-border)' }}>
                      <td style={{ padding: '0.5rem 0' }}>{item.product_name || products[item.product_id] || `Product ID: ${item.product_id.substring(0,8)}`}</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <button className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }} onClick={() => setSelectedTx(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
