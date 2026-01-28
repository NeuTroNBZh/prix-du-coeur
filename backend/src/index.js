require('dotenv').config();
console.log('✅ Dotenv loaded');
const express = require('express');
console.log('✅ Express loaded');
const helmet = require('helmet');
console.log('✅ Helmet loaded');
const cors = require('cors');
console.log('✅ CORS loaded');
const authRoutes = require('./routes/auth');
console.log('✅ Auth routes loaded');
const transactionRoutes = require('./routes/transactions');
console.log('✅ Transaction routes loaded');
const harmonizationRoutes = require('./routes/harmonization');
console.log('✅ Harmonization routes loaded');
const coupleRoutes = require('./routes/couple');
console.log('✅ Couple routes loaded');
const classificationRoutes = require('./routes/classification');
console.log('✅ Classification routes loaded');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

// Parse CORS origins (comma-separated)
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

console.log('🔐 CORS Origins autorisées:', corsOrigins);

app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (curl, mobile apps)
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.log('❌ CORS bloqué pour:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Prix du coeur API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Prix du coeur API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      transactions: '/api/transactions/*',
      harmonization: '/api/harmonization/*'
    }
  });
});

// Routes
console.log('🔧 Mounting /api/auth routes...');
app.use('/api/auth', authRoutes);
console.log('✅ /api/auth routes mounted');

console.log('🔧 Mounting /api/transactions routes...');
app.use('/api/transactions', transactionRoutes);
console.log('✅ /api/transactions routes mounted');

console.log('🔧 Mounting /api/harmonization routes...');
app.use('/api/harmonization', harmonizationRoutes);
console.log('✅ /api/harmonization routes mounted');

console.log('🔧 Mounting /api/couple routes...');
app.use('/api/couple', coupleRoutes);
console.log('✅ /api/couple routes mounted');

console.log('🔧 Mounting /api/classify routes...');
app.use('/api/classify', classificationRoutes);
console.log('✅ /api/classify routes mounted');

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
