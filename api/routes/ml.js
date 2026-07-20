const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { verifyToken, requireRole } = require('../middleware/auth');
const axios = require('axios'); // We need axios for internal calls
const { getCache, setCache } = require('../utils/cache');

// Admin only routes
router.use(verifyToken);
router.use(requireRole(['admin']));

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const INTERNAL_SECRET = process.env.INTERNAL_ML_SECRET || 'dev_secret_key';

// Helper to fetch sales history
const fetchSalesHistory = async (store_id, product_id) => {
    // Ideally we aggregate transaction_items grouped by date for this product.
    // For simplicity, we query transaction_items joined with transactions.
    const { data, error } = await supabase
        .from('transaction_items')
        .select(`
            quantity,
            transactions!inner(created_at, store_id)
        `)
        .eq('product_id', product_id)
        .eq('transactions.store_id', store_id);

    if (error) throw error;

    // Aggregate by date
    const dailyMap = {};
    for (const row of data) {
        const dateStr = row.transactions.created_at.split('T')[0];
        dailyMap[dateStr] = (dailyMap[dateStr] || 0) + row.quantity;
    }

    const history = Object.keys(dailyMap)
        .sort()
        .map(date => ({
            date: date,
            quantity_sold: dailyMap[date]
        }));
        
    return history;
};

// Helper to fetch revenue history
const fetchRevenueHistory = async (store_id) => {
    const { data, error } = await supabase
        .from('transactions')
        .select('created_at, total_amount')
        .eq('store_id', store_id);

    if (error) throw error;

    const dailyMap = {};
    for (const row of data) {
        const dateStr = row.created_at.split('T')[0];
        dailyMap[dateStr] = (dailyMap[dateStr] || 0) + Number(row.total_amount);
    }

    const history = Object.keys(dailyMap)
        .sort()
        .map(date => ({
            date: date,
            revenue_amount: dailyMap[date]
        }));
        
    return history;
};

// GET /api/v1/ml/predict-stock/:productId
router.get('/predict-stock/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const store_id = req.user.store_id;
        const cacheKey = `predict-stock:${store_id}:${productId}`;

        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached });
        }

        // Fetch current stock
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', productId)
            .eq('store_id', store_id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const history = await fetchSalesHistory(store_id, productId);

        // BR-13: short-circuit if < 7 days of data
        if (history.length < 7) {
            return res.json({
                success: true,
                message: 'insufficient_data',
                data: {
                    product_id: productId,
                    status: 'insufficient_data',
                    reason: 'Requires at least 7 days of sales history'
                }
            });
        }

        // Call FastAPI
        const response = await axios.post(`${ML_SERVICE_URL}/predict-stock`, {
            product_id: productId,
            current_stock: product.stock_quantity,
            sales_history: history
        }, {
            headers: {
                'X-Internal-Service-Key': INTERNAL_SECRET
            }
        });

        await setCache(cacheKey, response.data, 300); // 5 min cache
        res.json({ success: true, data: response.data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.response?.data || err.message });
    }
});

// GET /api/v1/ml/predict-demand/:productId
router.get('/predict-demand/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const store_id = req.user.store_id;
        const cacheKey = `predict-demand:${store_id}:${productId}`;

        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached });
        }

        const history = await fetchSalesHistory(store_id, productId);

        if (history.length < 7) {
            return res.json({
                success: true,
                message: 'insufficient_data',
                data: {
                    product_id: productId,
                    status: 'insufficient_data',
                    reason: 'Requires at least 7 days of sales history'
                }
            });
        }

        const response = await axios.post(`${ML_SERVICE_URL}/predict-demand`, {
            product_id: productId,
            sales_history: history
        }, {
            headers: {
                'X-Internal-Service-Key': INTERNAL_SECRET
            }
        });

        await setCache(cacheKey, response.data, 300);
        res.json({ success: true, data: response.data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.response?.data || err.message });
    }
});

// GET /api/v1/ml/predict-revenue
router.get('/predict-revenue', async (req, res) => {
    try {
        const store_id = req.user.store_id;
        const cacheKey = `predict-revenue:${store_id}`;

        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached });
        }

        const history = await fetchRevenueHistory(store_id);

        if (history.length < 7) {
            return res.json({
                success: true,
                message: 'insufficient_data',
                data: {
                    status: 'insufficient_data',
                    reason: 'Requires at least 7 days of revenue history'
                }
            });
        }

        const response = await axios.post(`${ML_SERVICE_URL}/predict-revenue`, {
            revenue_history: history
        }, {
            headers: {
                'X-Internal-Service-Key': INTERNAL_SECRET
            }
        });

        await setCache(cacheKey, response.data, 300); // cache for 5 min
        res.json({ success: true, data: response.data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.response?.data || err.message });
    }
});

// GET /api/v1/ml/predict-all-stock
router.get('/predict-all-stock', async (req, res) => {
    try {
        console.time('predict-all-stock');
        const store_id = req.user.store_id;
        const cacheKey = `predict-all-stock:${store_id}`;

        const cached = await getCache(cacheKey);
        if (cached) {
            console.timeEnd('predict-all-stock');
            return res.json({ success: true, data: cached });
        }

        // Fetch all products
        const { data: products, error: productError } = await supabase
            .from('products')
            .select('id, name, stock_quantity')
            .eq('store_id', store_id);

        if (productError) throw productError;

        const results = [];

        // For each product, fetch history and predict
        for (const product of products) {
            const history = await fetchSalesHistory(store_id, product.id);
            if (history.length >= 7) {
                try {
                    const response = await axios.post(`${ML_SERVICE_URL}/predict-stock`, {
                        product_id: product.id,
                        current_stock: product.stock_quantity,
                        sales_history: history
                    }, {
                        headers: {
                            'X-Internal-Service-Key': INTERNAL_SECRET
                        }
                    });
                    results.push({
                        ...response.data,
                        product_name: product.name,
                        current_stock: product.stock_quantity
                    });
                } catch (e) {
                    console.error('Failed to predict for', product.name, e.message);
                }
            }
        }

        await setCache(cacheKey, results, 300); // Cache for 5 min
        console.timeEnd('predict-all-stock');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
