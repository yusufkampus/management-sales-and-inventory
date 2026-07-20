const jwt = require('jsonwebtoken');
const supabase = require('../supabase');

// Supabase uses RS256 for its JWTs usually, but for validating via the backend,
// we can use the Supabase Admin client to get the user based on the token.
// A simpler way: parse the token and check with Supabase auth.

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Use Supabase Admin to verify token and get user
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ success: false, message: 'Unauthorized', error: error?.message });
        }

        // Fetch custom user profile to get role, store_id, and is_active
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('role, store_id, is_active')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(403).json({ success: false, message: 'User profile not found' });
        }

        if (!profile.is_active) {
            return res.status(403).json({ success: false, message: 'User account is inactive' });
        }

        // Attach user info to request
        req.user = {
            id: user.id,
            email: user.email,
            role: profile.role,
            store_id: profile.store_id
        };

        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Internal Server Error during auth' });
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Forbidden: Insufficient role' });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    requireRole
};
