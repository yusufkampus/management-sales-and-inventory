const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { verifyToken, requireRole } = require('../middleware/auth');

// All user management routes require admin role
router.use(verifyToken);
router.use(requireRole(['admin']));

// GET /api/v1/users/cashiers - Get list of cashiers for this store
router.get('/cashiers', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, email, is_active, created_at')
            .eq('store_id', req.user.store_id)
            .eq('role', 'cashier')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/v1/users/cashiers - Create a new cashier
router.post('/cashiers', async (req, res) => {
    try {
        const { full_name, email, password } = req.body;
        
        if (!full_name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // 1. Create user in Supabase Auth (using admin role key provided by the supabase instance in api/supabase.js)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (authError) {
            return res.status(400).json({ success: false, message: authError.message });
        }

        const userId = authData.user.id;

        // 2. Insert public profile
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .insert([{
                id: userId,
                store_id: req.user.store_id, // ensure they belong to the admin's store
                role: 'cashier',
                full_name,
                email,
                is_active: true
            }])
            .select()
            .single();

        if (profileError) {
            // Rollback auth creation ideally, but for now we just throw
            throw profileError;
        }

        res.status(201).json({ success: true, message: 'Cashier created successfully', data: profile });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/v1/users/cashiers/:id - Update cashier
router.put('/cashiers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, password } = req.body;
        
        // Update Supabase Auth if email or password is provided
        const authUpdate = {};
        if (email) authUpdate.email = email;
        if (password) authUpdate.password = password;

        if (Object.keys(authUpdate).length > 0) {
            const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdate);
            if (authError) return res.status(400).json({ success: false, message: authError.message });
        }

        // Update public profile
        const profileUpdate = {};
        if (full_name) profileUpdate.full_name = full_name;
        if (email) profileUpdate.email = email;

        if (Object.keys(profileUpdate).length > 0) {
            const { data, error } = await supabase
                .from('users')
                .update(profileUpdate)
                .eq('id', id)
                .eq('store_id', req.user.store_id)
                .select()
                .single();
            if (error) throw error;
        }

        res.json({ success: true, message: 'Cashier updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/v1/users/cashiers/:id - Deactivate cashier
router.delete('/cashiers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Soft delete: set is_active to false
        const { data, error } = await supabase
            .from('users')
            .update({ is_active: false })
            .eq('id', id)
            .eq('store_id', req.user.store_id)
            .eq('role', 'cashier')
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, message: 'Cashier deactivated', data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
