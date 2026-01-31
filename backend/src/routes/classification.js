/**
 * Classification Routes
 * Routes pour la classification IA des transactions
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const {
  classifyTransactions,
  correctClassification,
  getIAHealth,
  getClassificationStats,
  getLearningEntries,
  deleteLearningEntries,
  reclassifyTransactions,
  resetForReclassification
} = require('../controllers/classificationController');

const router = express.Router();

// ============================================
// 🛡️ PROTECTION DDoS - Rate limiter pour l'IA
// ============================================
// Les appels à l'API Mistral sont coûteux, on limite strictement
const classifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 classifications par 5 minutes
  message: { 
    success: false,
    error: { 
      message: 'Trop de requêtes IA. Veuillez attendre quelques minutes.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

// POST /api/classify - Classify transactions with AI (rate limited)
router.post('/', classifyLimiter, classifyTransactions);

// POST /api/classify/reclassify - Force reclassify transactions (rate limited)
router.post('/reclassify', classifyLimiter, reclassifyTransactions);

// POST /api/classify/reset-for-reclassify - Reset transactions as unclassified (no rate limit, doesn't call AI)
router.post('/reset-for-reclassify', resetForReclassification);

// GET /api/classify/health - Check AI service status
router.get('/health', getIAHealth);

// GET /api/classify/stats - Get classification statistics
router.get('/stats', getClassificationStats);

// PATCH /api/classify/:id - Correct a transaction classification
router.patch('/:id', correctClassification);

// GET /api/classify/learning - Get AI learning entries
router.get('/learning', getLearningEntries);

// DELETE /api/classify/learning - Delete AI learning entries
router.delete('/learning', deleteLearningEntries);

module.exports = router;
