const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { verifyToken, requireRole } = require('../middleware/auth');
const { getCache, setCache, clearCache } = require('../utils/cache');

// Apply auth middleware to all routes
router.use(verifyToken);

// GET /api/v1/products - List all active products for the store
router.get('/', async (req, res) => {
    try {
        const cacheKey = `products_${req.user.store_id}`;
        const cachedProducts = await getCache(cacheKey);
        
        if (cachedProducts) {
            return res.json({ success: true, data: cachedProducts });
        }

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('store_id', req.user.store_id)
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        
        await setCache(cacheKey, data, 300); // cache for 5 minutes
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/v1/products - Create a new product (Admin only)
router.post('/', requireRole(['admin']), async (req, res) => {
    try {
        let { name, sku, category, price, stock_quantity, min_stock_threshold, image_url, image_base64 } = req.body;
        
        // Handle Base64 Image Upload
        if (image_base64) {
            const matches = image_base64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, buffer, {
                        contentType: `image/${matches[1]}`
                    });
                    
                if (uploadError) {
                    console.error('Upload Error:', uploadError);
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from('product-images')
                        .getPublicUrl(fileName);
                    image_url = publicUrlData.publicUrl;
                }
            }
        }

        const { data, error } = await supabase
            .from('products')
            .insert([{
                store_id: req.user.store_id,
                name, sku, category, price, stock_quantity, min_stock_threshold, image_url
            }])
            .select()
            .single();

        if (error) throw error;

        // If stock_quantity > 0, log initial stock movement
        if (stock_quantity > 0) {
            await supabase.from('stock_movements').insert([{
                store_id: req.user.store_id,
                product_id: data.id,
                type: 'IN',
                quantity: stock_quantity,
                note: 'Initial stock',
                created_by: req.user.id
            }]);
        }

        // Invalidate cache
        await clearCache(`products_${req.user.store_id}`);

        res.status(201).json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// PUT /api/v1/products/:id - Update a product (Admin only)
router.put('/:id', requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        let { name, sku, category, price, stock_quantity, min_stock_threshold, image_url, image_base64 } = req.body;
        
        // Handle Base64 Image Upload
        if (image_base64) {
            const matches = image_base64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, buffer, {
                        contentType: `image/${matches[1]}`
                    });
                    
                if (uploadError) {
                    console.error('Upload Error:', uploadError);
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from('product-images')
                        .getPublicUrl(fileName);
                    image_url = publicUrlData.publicUrl;
                }
            }
        }

        const updateData = { name, sku, category, price, stock_quantity, min_stock_threshold };
        if (image_url) updateData.image_url = image_url;

        const { data, error } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', id)
            .eq('store_id', req.user.store_id)
            .select()
            .single();

        if (error) throw error;

        // Invalidate cache
        await clearCache(`products_${req.user.store_id}`);

        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// DELETE /api/v1/products/:id - Soft delete a product (Admin only)
router.delete('/:id', requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('products')
            .update({ is_active: false })
            .eq('id', id)
            .eq('store_id', req.user.store_id)
            .select()
            .single();

        if (error) throw error;

        // Invalidate cache
        await clearCache(`products_${req.user.store_id}`);

        res.json({ success: true, message: 'Product deleted successfully', data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

module.exports = router;
