const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getHarmonization,
  updateTransactionType,
  settleUp,
  getSettlementHistory,
  deleteSettlement
} = require('../controllers/harmonizationController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get harmonization report for couple
// GET /api/harmonization?startDate=2026-01-01&endDate=2026-01-31
router.get('/', getHarmonization);

// Record a settlement
// POST /api/harmonization/settle
router.post('/settle', settleUp);

// Delete a settlement (annuler régularisation)
// DELETE /api/harmonization/settle/:id
router.delete('/settle/:id', deleteSettlement);

// Get settlement history
// GET /api/harmonization/history
router.get('/history', getSettlementHistory);

// Update transaction type (in transaction routes but related)
// PATCH /api/harmonization/transaction/:id/type
router.patch('/transaction/:id/type', updateTransactionType);

module.exports = router;
