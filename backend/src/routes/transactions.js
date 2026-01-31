const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const {
  uploadCSV,
  importTransactions,
  getAccounts,
  getTransactions,
  setInitialBalance,
  getBalanceEvolution,
  createTransaction,
  deleteTransaction,
  deleteAccountTransactions,
  updateTransactionType,
  updateTransactionLabel,
  updateTransactionAmount,
  getAnalytics,
  getRecurringTransactions,
  getSubscriptionSettings,
  updateSubscriptionSetting,
  updateSubscriptionCategory,
  renameAccount,
  toggleRecurring,
  dismissSubscription,
  restoreSubscription
} = require('../controllers/transactionController');

const router = express.Router();

// ============================================
// 🛡️ PROTECTION DDoS - Rate limiters spécifiques
// ============================================

// Rate limiter pour les uploads (coûteux en ressources)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads par 15 minutes
  message: { error: 'Trop d\'uploads', message: 'Veuillez attendre avant de réessayer' }
});

// Rate limiter pour les imports (opérations lourdes en BDD)
const importLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 imports par 5 minutes
  message: { error: 'Trop d\'imports', message: 'Veuillez attendre avant de réessayer' }
});

// Configure multer for file upload (memory storage, 10MB limit for PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB for PDFs
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/pdf'];
    const allowedExtensions = ['.csv', '.pdf'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and PDF files are allowed'));
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

// Upload CSV to analyze and extract accounts (with rate limit)
router.post('/upload', uploadLimiter, upload.single('file'), uploadCSV);

// Import transactions from parsed JSON data (with rate limit)
router.post('/import', importLimiter, importTransactions);

// Create manual transaction
router.post('/', createTransaction);

// Get user's accounts
router.get('/accounts', getAccounts);

// Get spending analytics
router.get('/analytics', getAnalytics);

// Get recurring transactions (subscriptions)
router.get('/recurring', getRecurringTransactions);

// Get subscription settings (shared/individual)
router.get('/subscriptions/settings', getSubscriptionSettings);

// Update subscription setting
router.put('/subscriptions/settings', updateSubscriptionSetting);

// Update subscription category (change category for all transactions of a subscription)
router.put('/subscriptions/category', updateSubscriptionCategory);

// Dismiss subscription (mark as not recurring / cancelled)
router.post('/subscriptions/dismiss', dismissSubscription);

// Restore a dismissed subscription
router.delete('/subscriptions/dismiss', restoreSubscription);

// Get transactions with filters
router.get('/', getTransactions);

// Delete a transaction
router.delete('/:id', deleteTransaction);

// Update transaction type
router.patch('/:id/type', updateTransactionType);

// Update transaction label
router.patch('/:id/label', updateTransactionLabel);

// Update transaction amount
router.patch('/:id/amount', updateTransactionAmount);

// Toggle recurring status
router.patch('/:id/recurring', toggleRecurring);

// Set initial balance for an account
router.put('/accounts/:accountId/balance', setInitialBalance);

// Rename an account
router.put('/accounts/:accountId/name', renameAccount);

// Get balance evolution for an account
router.get('/accounts/:accountId/evolution', getBalanceEvolution);

// Delete an account and all its transactions
router.delete('/accounts/:accountId', deleteAccountTransactions);

// Debug endpoint - get user info
router.get('/debug', async (req, res) => {
  const pool = require('../config/database');
  const userId = req.user.userId;
  
  try {
    const user = await pool.query('SELECT id, email, first_name FROM users WHERE id = $1', [userId]);
    const accounts = await pool.query('SELECT * FROM accounts WHERE user_id = $1', [userId]);
    const txCount = await pool.query('SELECT COUNT(*) as count FROM transactions WHERE user_id = $1', [userId]);
    const couple = await pool.query('SELECT * FROM couples WHERE user1_id = $1 OR user2_id = $1', [userId]);
    
    res.json({
      user: user.rows[0],
      accounts: accounts.rows,
      transactionCount: txCount.rows[0].count,
      couple: couple.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
