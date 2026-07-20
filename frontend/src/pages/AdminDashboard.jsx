import { useState, useEffect } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import AdminLayout from '../components/AdminLayout';
import { apiFetch } from '../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalSales: 0, lowStockCount: 0 });
  const [loading, setLoading] = useState(true);
  const [revenueChartData, setRevenueChartData] = useState([]);
  const [stockChartData, setStockChartData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const productsRes = await apiFetch('/products');
      const products = productsRes.data || [];
      const lowStock = products.filter(p => p.stock_quantity <= (p.min_stock_threshold || 10));

      const txRes = await apiFetch('/pos/transactions');
      const transactions = txRes.data || [];
      const total = transactions.reduce((sum, tx) => sum + Number(tx.total_amount || 0), 0);

      setStats({
        totalSales: total,
        lowStockCount: lowStock.length
      });

      try {
        const revRes = await apiFetch('/ml/predict-revenue');
        const info = revRes.data || revRes;
        
        if (!info.message && info.historical_data && info.forecast_data) {
          const chartData = [];
          
          info.historical_data.forEach(item => {
             const d = new Date(item.date);
             chartData.push({
                dateObj: d,
                day: d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
                historical_revenue: Math.round(item.revenue_amount),
                forecast_revenue: null,
                forecast_range: null
             });
          });
          
          if (chartData.length > 0 && info.forecast_data.length > 0) {
             const lastHist = chartData[chartData.length - 1];
             lastHist.forecast_revenue = lastHist.historical_revenue;
             lastHist.forecast_range = [lastHist.historical_revenue, lastHist.historical_revenue];
          }

          info.forecast_data.forEach(item => {
             const d = new Date(item.date);
             chartData.push({
                dateObj: d,
                day: d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
                historical_revenue: null,
                forecast_revenue: Math.round(item.predicted_revenue),
                forecast_range: [Math.round(item.lower_bound), Math.round(item.upper_bound)]
             });
          });
          
          setRevenueChartData(chartData);
        }
      } catch (e) {
        console.error('Revenue predict error', e);
      }

      try {
        const allStockRes = await apiFetch('/ml/predict-all-stock');
        const allPredictions = allStockRes.data || [];
        const stockData = allPredictions
            .filter(p => p.predicted_out_of_stock_date)
            .map(p => ({
                name: p.product_name.substring(0, 15) + (p.product_name.length > 15 ? '...' : ''),
                days: Math.floor(p.remaining_days)
            }))
            .sort((a, b) => a.days - b.days)
            .slice(0, 10);
        setStockChartData(stockData);
      } catch (e) {
        console.error('All stock predict error', e);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <AdminLayout>
      <div className="fade-in">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Welcome to your store's control center.</p>
        
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading insights...</div>
        ) : (
          <>
          <div className="kpi-grid">
            <div className="kpi-card glass-panel" style={{ borderTop: '4px solid var(--accent-1)' }}>
              <div className="kpi-title">Total Sales (All Time)</div>
              <div className="kpi-value">{formatCurrency(stats.totalSales)}</div>
            </div>
            
            <div className="kpi-card glass-panel" style={{ borderTop: '4px solid var(--error-text)' }}>
              <div className="kpi-title">Low Stock Alerts</div>
              <div className="kpi-value" style={{ color: 'var(--error-text)' }}>
                {stats.lowStockCount} <span style={{ fontSize: '1rem', fontWeight: 500 }}>items</span>
              </div>
            </div>
            
            <div className="kpi-card glass-panel" style={{ borderTop: '4px solid var(--accent-3)' }}>
              <div className="kpi-title">AI Engine</div>
              <div className="kpi-value" style={{ fontSize: '1.25rem', color: 'var(--accent-3)' }}>
                Active & Forecasting
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Monitoring all eligible products (&ge; 7 days data)
              </div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
             {/* Revenue Chart */}
             <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-1)', fontSize: '1.25rem' }}>Projected Revenue (Next 7 Days)</h3>
                {revenueChartData.length > 0 ? (
                    <div style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={revenueChartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                          <XAxis dataKey="day" stroke="var(--text-muted)" />
                          <YAxis stroke="var(--text-muted)" width={85} tickFormatter={(val) => `Rp${val/1000}k`} />
                          <RechartsTooltip 
                             contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }} 
                             itemStyle={{ color: 'var(--text-main)' }}
                             formatter={(val, name) => {
                                if (Array.isArray(val)) {
                                   return [`Rp${val[0]} - Rp${val[1]}`, 'Confidence Interval'];
                                }
                                return [formatCurrency(val), name === 'historical_revenue' ? 'Historical' : 'Forecast'];
                             }}
                          />
                          <Area type="monotone" dataKey="forecast_range" fill="rgba(0,0,0,0.1)" stroke="none" />
                          <Line type="monotone" dataKey="historical_revenue" stroke="var(--text-main)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                          <Line type="monotone" dataKey="forecast_revenue" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                       Insufficient data for revenue projection.
                    </div>
                )}
             </div>

             {/* Stock Depletion Chart */}
             <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--error-text)', fontSize: '1.25rem' }}>Stock Depletion Forecast (Safe Days)</h3>
                {stockChartData.length > 0 ? (
                    <div style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stockChartData} layout="vertical" margin={{ left: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                          <XAxis type="number" stroke="var(--text-muted)" />
                          <YAxis dataKey="name" type="category" stroke="var(--text-muted)" width={100} tick={{ fontSize: 12 }} />
                          <RechartsTooltip contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }} cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(val) => [`${val} days`, 'Remaining']} />
                          <Bar dataKey="days" fill="var(--text-main)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                       No products with sufficient sales history (&ge; 7 days).
                    </div>
                )}
              </div>
           </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
