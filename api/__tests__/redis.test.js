const request = require('supertest');
const app = require('../index');
const cache = require('../utils/cache');
const supabase = require('../supabase');
const axios = require('axios');
const auth = require('../middleware/auth');

// Mock auth middleware so we don't need a real token
jest.mock('../middleware/auth', () => ({
    verifyToken: (req, res, next) => {
        req.user = { id: 'test-user', role: 'admin', store_id: 'test-store' };
        next();
    },
    requireRole: (roles) => (req, res, next) => next()
}));

// We'll mock the Supabase client and axios to simulate slow DB/Network calls
jest.mock('../supabase', () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn()
}));

jest.mock('axios');

// Mock the cache itself so we can control cache hit/miss without a real Redis server
jest.mock('../utils/cache', () => ({
    getCache: jest.fn(),
    setCache: jest.fn(),
    clearCache: jest.fn()
}));

const delay = (ms) => new Promise(res => setTimeout(res, ms));

describe('Redis Performance Testing', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Simulate slow database response for products (100ms)
        const mockSupabaseData = async () => {
            await delay(100); 
            return { data: [{ id: 1, name: 'Product A' }], error: null };
        };
        
        const chainable = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockImplementation(mockSupabaseData),
            single: jest.fn().mockImplementation(mockSupabaseData),
            then: function(resolve) {
                // If it's awaited without calling order or single (like eq was the last call)
                return mockSupabaseData().then(resolve);
            }
        };

        supabase.from.mockReturnValue(chainable);

        // Simulate slow ML service response for dashboard/revenue (200ms)
        axios.post.mockImplementation(async () => {
            await delay(200);
            return { data: { prediction: 1000 } };
        });
    });

    describe('Products Endpoint (GET /api/v1/products)', () => {
        it('Performance without Redis (Cache Miss)', async () => {
            cache.getCache.mockResolvedValue(null); // Simulate cache miss
            
            const start = performance.now();
            const response = await request(app).get('/api/v1/products');
            const end = performance.now();
            
            const duration = end - start;
            console.log(`Products without Redis: ${duration.toFixed(2)}ms`);
            if (response.status !== 200) console.log(response.body);
            
            expect(response.status).toBe(200);
            expect(cache.getCache).toHaveBeenCalled();
            expect(cache.setCache).toHaveBeenCalled();
            expect(duration).toBeGreaterThanOrEqual(50); // Relaxed timing due to environment
        });

        it('Performance with Redis (Cache Hit)', async () => {
            cache.getCache.mockResolvedValue([{ id: 1, name: 'Cached Product' }]); // Simulate cache hit
            
            const start = performance.now();
            const response = await request(app).get('/api/v1/products');
            const end = performance.now();
            
            const duration = end - start;
            console.log(`Products with Redis: ${duration.toFixed(2)}ms`);
            if (response.status !== 200) console.log(response.body);
            
            expect(response.status).toBe(200);
            expect(cache.getCache).toHaveBeenCalled();
            expect(cache.setCache).not.toHaveBeenCalled();
            expect(duration).toBeLessThan(50); // Should be very fast
        });
    });

    describe('Dashboard Endpoint (GET /api/v1/ml/predict-revenue)', () => {
        it('Performance without Redis (Cache Miss)', async () => {
            cache.getCache.mockResolvedValue(null);
            
            // For predict-revenue, we need it to return >7 items for history
            const mockHistoryData = async () => {
                await delay(100); 
                return { 
                    data: [
                        { created_at: '2023-01-01T00:00:00Z', total_amount: 100 },
                        { created_at: '2023-01-02T00:00:00Z', total_amount: 100 },
                        { created_at: '2023-01-03T00:00:00Z', total_amount: 100 },
                        { created_at: '2023-01-04T00:00:00Z', total_amount: 100 },
                        { created_at: '2023-01-05T00:00:00Z', total_amount: 100 },
                        { created_at: '2023-01-06T00:00:00Z', total_amount: 100 },
                        { created_at: '2023-01-07T00:00:00Z', total_amount: 100 }
                    ], 
                    error: null 
                };
            };
            
            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockImplementation(mockHistoryData),
                single: jest.fn().mockImplementation(mockHistoryData),
                then: function(resolve) {
                    return mockHistoryData().then(resolve);
                }
            });

            const start = performance.now();
            const response = await request(app).get('/api/v1/ml/predict-revenue');
            const end = performance.now();
            
            const duration = end - start;
            console.log(`Dashboard without Redis: ${duration.toFixed(2)}ms`);
            if (response.status !== 200) console.log(response.body);
            
            expect(response.status).toBe(200);
            expect(cache.getCache).toHaveBeenCalled();
            expect(cache.setCache).toHaveBeenCalled();
            expect(duration).toBeGreaterThanOrEqual(250); // 100ms DB + 200ms ML
        });

        it('Performance with Redis (Cache Hit)', async () => {
            cache.getCache.mockResolvedValue({ prediction: 5000 });
            
            const start = performance.now();
            const response = await request(app).get('/api/v1/ml/predict-revenue');
            const end = performance.now();
            
            const duration = end - start;
            console.log(`Dashboard with Redis: ${duration.toFixed(2)}ms`);
            
            expect(response.status).toBe(200);
            expect(cache.getCache).toHaveBeenCalled();
            expect(cache.setCache).not.toHaveBeenCalled();
            expect(duration).toBeLessThan(50); // fast because no DB/ML calls
        });
    });
});
