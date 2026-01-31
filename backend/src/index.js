require('dotenv').config();
console.log('✅ Dotenv loaded');
const express = require('express');
console.log('✅ Express loaded');
const path = require('path');
console.log('✅ Path loaded');
const helmet = require('helmet');
console.log('✅ Helmet loaded');
const cors = require('cors');
console.log('✅ CORS loaded');
const rateLimit = require('express-rate-limit');
console.log('✅ Rate limit loaded');
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
const deviceRoutes = require('./routes/devices');
console.log('✅ Device routes loaded');
const adminRoutes = require('./routes/admin');
console.log('✅ Admin routes loaded');
const contactRoutes = require('./routes/contactRoutes');
console.log('✅ Contact routes loaded');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

// ============================================
// 🛡️ PROTECTION DDoS - Rate Limiting Global
// ============================================

// Rate limiter global pour toutes les routes API
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute par IP
  message: { 
    error: 'Too many requests', 
    message: 'Veuillez réessayer dans quelques instants',
    retryAfter: 60
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  skip: (req) => req.path === '/health' // Skip health checks
});

// Rate limiter strict pour les routes sensibles (uploads, classify)
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requêtes par minute
  message: { 
    error: 'Too many requests', 
    message: 'Limite atteinte pour cette action'
  }
});

// Appliquer le rate limiter global à toutes les routes /api/
app.use('/api/', globalLimiter);

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

// ============================================
// 🛡️ PROTECTION DDoS - Limites de payload
// ============================================
// Limite standard pour la plupart des requêtes (1MB)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Servir les fichiers statiques (avatars, uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

console.log('🔧 Mounting /api/devices routes...');
app.use('/api/devices', deviceRoutes);
console.log('✅ /api/devices routes mounted');

console.log('🔧 Mounting /api/admin routes...');
app.use('/api/admin', adminRoutes);
console.log('✅ /api/admin routes mounted');

console.log('🔧 Mounting /api/contact routes...');
app.use('/api/contact', contactRoutes);
console.log('✅ /api/contact routes mounted');

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
