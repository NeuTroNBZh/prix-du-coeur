/**
 * Classification Routes
 * Routes pour la classification IA des transactions
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  classifyTransactions,
  correctClassification,
  getIAHealth,
  getClassificationStats,
  getLearningEntries,
  deleteLearningEntries
} = require('../controllers/classificationController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/classify - Classify transactions with AI
router.post('/', classifyTransactions);

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
