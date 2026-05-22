const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const morgan = require('morgan');
const engine = require('ejs-mate');

const webhookRoutes = require('./routes/webhook.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// View Engine
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security & Middlewares
app.use(helmet());
app.use(cors());

// Global Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Parse JSON with rawBody for signature verification
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Routes
app.use('/webhook', webhookRoutes);
app.use('/admin', adminRoutes);

// Health Check
app.get('/health', (req, res) => res.status(200).json({ status: 'UP' }));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Global Error]', err.stack);
    res.status(500).send('Internal Server Error');
});

module.exports = app;
