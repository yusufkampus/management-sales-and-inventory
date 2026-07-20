const redis = require('redis');

// In-memory fallback map if Redis is unavailable
const memoryCache = new Map();
let redisClient = null;
let useRedis = false;

let hasLoggedError = false;

async function initCache() {
    try {
        const url = process.env.REDIS_URL || 'redis://localhost:6379';
        redisClient = redis.createClient({ 
            url,
            socket: {
                reconnectStrategy: false // Disable reconnects to prevent log spam if Redis is not installed
            }
        });

        redisClient.on('error', (err) => {
            if (!hasLoggedError) {
                console.warn('[Cache] Redis error, falling back to memory cache.');
                hasLoggedError = true;
            }
            useRedis = false;
        });

        redisClient.on('connect', () => {
            console.log('[Cache] Connected to Redis.');
            useRedis = true;
            hasLoggedError = false;
        });

        await redisClient.connect();
    } catch (e) {
        if (!hasLoggedError) {
            console.warn('[Cache] Could not connect to Redis, using in-memory cache.');
            hasLoggedError = true;
        }
        useRedis = false;
    }
}

initCache();

/**
 * Get item from cache
 * @param {string} key 
 * @returns {any} parsed JSON or null
 */
async function getCache(key) {
    if (useRedis && redisClient) {
        try {
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.warn('[Cache] Redis get error:', e.message);
        }
    }
    // Memory fallback
    const memItem = memoryCache.get(key);
    if (memItem) {
        if (Date.now() > memItem.expires) {
            memoryCache.delete(key);
            return null;
        }
        return memItem.data;
    }
    return null;
}

/**
 * Set item in cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds 
 */
async function setCache(key, value, ttlSeconds = 300) {
    if (useRedis && redisClient) {
        try {
            await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
            return;
        } catch (e) {
            console.warn('[Cache] Redis set error:', e.message);
        }
    }
    // Memory fallback
    memoryCache.set(key, {
        data: value,
        expires: Date.now() + (ttlSeconds * 1000)
    });
}
/**
 * Clear item from cache
 * @param {string} key 
 */
async function clearCache(key) {
    if (useRedis && redisClient) {
        try {
            await redisClient.del(key);
            return;
        } catch (e) {
            console.warn('[Cache] Redis del error:', e.message);
        }
    }
    // Memory fallback
    memoryCache.delete(key);
}

module.exports = {
    getCache,
    setCache,
    clearCache
};
