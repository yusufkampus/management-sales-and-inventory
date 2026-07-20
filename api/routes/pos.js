const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// POST /api/v1/pos/checkout - Create a new sale transaction (FR-07, FR-08, BR-08)
router.post('/checkout', async (req, res) => {
    try {
        const { items } = req.body; // format: [{ product_id: 'uuid', quantity: 2 }]
        
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Transaction must have at least one item' });
        }

        // Call the RPC function defined in Part 3 §3.6
        // This ensures atomic stock deduction and avoids race conditions.
        const { data: transactionId, error } = await supabase.rpc('fn_create_sale_transaction', {
            p_store_id: req.user.store_id,
            p_cashier_id: req.user.id,
            p_items: items
        });

        if (error) {
            // Handle HTTP 409 for stock issues per FR-08
            if (error.message.includes('INSUFFICIENT_STOCK') || error.message.includes('INVALID_QUANTITY') || error.message.includes('PRODUCT_NOT_FOUND')) {
                return res.status(409).json({ success: false, message: error.message });
            }
            throw error;
        }

        res.status(201).json({ success: true, message: 'Transaction successful', data: { transaction_id: transactionId } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Internal Server Error: ' + err.message });
    }
});

// GET /api/v1/pos/transactions - List transactions (History)
router.get('/transactions', async (req, res) => {
    try {
        let query = supabase
            .from('transactions')
            .select('*, transaction_items(*)')
            .eq('store_id', req.user.store_id)
            .order('created_at', { ascending: false });

        // If not admin, cashier can only see their own transactions
        if (req.user.role !== 'admin') {
            query = query.eq('cashier_id', req.user.id);
        }

        const { data, error } = await query.limit(50); // basic pagination

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
