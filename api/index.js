const express = require('express'); // trigger restart 4
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

const productsRouter = require('./routes/products');
const posRouter = require('./routes/pos');
const mlRouter = require('./routes/ml');
const usersRouter = require('./routes/users');

// Basic Route
app.get('/api/v1/health', (req, res) => {
    res.json({ success: true, message: 'API is running' });
});

// Routes
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/pos', posRouter);
app.use('/api/v1/ml', mlRouter);
app.use('/api/v1/users', usersRouter);

// Start Server
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
