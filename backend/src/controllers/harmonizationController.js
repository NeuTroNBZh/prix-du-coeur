const pool = require('../config/database');
const {
  calculateBalance,
  calculateHarmonization,
  calculateCategoryBreakdown
} = require('../services/calculationEngine');

/**
 * Get harmonization report for a couple
 * GET /api/harmonization
 */
const getHarmonization = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    // Validate dates if provided
    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({ error: 'Invalid startDate format (YYYY-MM-DD)' });
    }
    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({ error: 'Invalid endDate format (YYYY-MM-DD)' });
    }

    // Get user's couple
    const coupleResult = await pool.query(
      `SELECT c.id, c.user1_id, c.user2_id,
              u1.first_name as user1_first_name, u1.last_name as user1_last_name,
              u2.first_name as user2_first_name, u2.last_name as user2_last_name
       FROM couples c
       JOIN users u1 ON c.user1_id = u1.id
       JOIN users u2 ON c.user2_id = u2.id
       WHERE c.user1_id = $1 OR c.user2_id = $1
       LIMIT 1`,
      [userId]
    );

    if (coupleResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No couple found',
        message: 'You need to be part of a couple to view harmonization' 
      });
    }

    const couple = coupleResult.rows[0];
    const user1Id = couple.user1_id;
    const user2Id = couple.user2_id;

    // Get last settlement timestamp to only count transactions since then
    const lastSettlement = await pool.query(
      `SELECT settled_at FROM harmonizations 
       WHERE couple_id = $1 
       ORDER BY settled_at DESC 
       LIMIT 1`,
      [couple.id]
    );
    
    const lastSettlementTimestamp = lastSettlement.rows.length > 0 
      ? lastSettlement.rows[0].settled_at 
      : null;

    // Build transaction query - only transactions since last settlement
    // We use created_at if available, otherwise compare date + tolerance
    let query = `
      SELECT t.id, t.amount, t.user_id, t.type, t.ratio, t.category, t.date, t.label, 
             COALESCE(t.created_at, t.date::timestamp) as tx_timestamp
      FROM transactions t
      WHERE t.couple_id = $1
    `;
    const params = [couple.id];
    let paramCount = 1;

    // Filter by last settlement timestamp (exact moment)
    if (lastSettlementTimestamp && !startDate) {
      paramCount++;
      query += ` AND COALESCE(t.created_at, t.date::timestamp) > $${paramCount}`;
      params.push(lastSettlementTimestamp);
    }

    // User-provided date range overrides
    if (startDate) {
      paramCount++;
      query += ` AND t.date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND t.date <= $${paramCount}`;
      params.push(endDate);
    }

    query += ' ORDER BY t.date DESC';

    const txResult = await pool.query(query, params);
    const transactions = txResult.rows;

    // Calculate balance
    const balance = calculateBalance(transactions, user1Id, user2Id);

    // Calculate harmonization
    const user1Info = {
      id: user1Id,
      firstName: couple.user1_first_name || 'User 1',
      lastName: couple.user1_last_name || ''
    };
    const user2Info = {
      id: user2Id,
      firstName: couple.user2_first_name || 'User 2',
      lastName: couple.user2_last_name || ''
    };

    const harmonization = calculateHarmonization(balance, user1Info, user2Info);

    // Calculate category breakdown
    const categoryBreakdown = calculateCategoryBreakdown(transactions);

    // Filter common expenses (commune/abonnement) by payer for display
    // Include shared expenses (negative) AND shared revenues (positive)
    // Exclude individual and internal transfers
    const communeTransactions = transactions.filter(tx => 
      tx.type !== 'individuelle' && tx.type !== 'virement_interne'
    );
    
    const user1Transactions = communeTransactions
      .filter(tx => tx.user_id === user1Id)
      .map(tx => ({
        id: tx.id,
        date: tx.date,
        label: tx.label,
        amount: tx.amount,
        category: tx.category,
        type: tx.type,
        ratio: tx.ratio,
        isRevenue: parseFloat(tx.amount) > 0
      }));
    
    const user2Transactions = communeTransactions
      .filter(tx => tx.user_id === user2Id)
      .map(tx => ({
        id: tx.id,
        date: tx.date,
        label: tx.label,
        amount: tx.amount,
        category: tx.category,
        type: tx.type,
        ratio: tx.ratio,
        isRevenue: parseFloat(tx.amount) > 0
      }));

    res.status(200).json({
      couple: {
        id: couple.id,
        user1: user1Info,
        user2: user2Info
      },
      period: {
        startDate: startDate || 'all',
        endDate: endDate || 'all',
        transactionCount: transactions.length
      },
      balance: {
        user1: balance.user1,
        user2: balance.user2,
        netBalance: balance.netBalance
      },
      harmonization,
      categoryBreakdown,
      // Transactions communes par membre
      user1Transactions,
      user2Transactions
    });
  } catch (err) {
    console.error('Get harmonization error:', err);
    res.status(500).json({ 
      error: 'Failed to calculate harmonization',
      message: err.message 
    });
  }
};

/**
 * Update transaction type (commune/individuelle/abonnement)
 * PATCH /api/transactions/:id/type
 */
const updateTransactionType = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, ratio } = req.body;
    const userId = req.user.userId;

    // Validate type
    const validTypes = ['commune', 'individuelle', 'abonnement', 'virement_interne'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type',
        message: 'Type must be: commune, individuelle, or abonnement' 
      });
    }

    // Validate ratio if provided
    if (ratio !== undefined && (ratio < 0 || ratio > 1)) {
      return res.status(400).json({ 
        error: 'Invalid ratio',
        message: 'Ratio must be between 0 and 1' 
      });
    }

    // Verify user owns this transaction
    const verifyResult = await pool.query(
      `SELECT t.id FROM transactions t
       JOIN couples c ON t.couple_id = c.id
       WHERE t.id = $1 AND (c.user1_id = $2 OR c.user2_id = $2)`,
      [id, userId]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update transaction
    const updateResult = await pool.query(
      `UPDATE transactions 
       SET type = $1, ratio = COALESCE($2, ratio), updated_at = NOW()
       WHERE id = $3
       RETURNING id, type, ratio`,
      [type, ratio, id]
    );

    res.status(200).json({
      message: 'Transaction updated',
      transaction: updateResult.rows[0]
    });
  } catch (err) {
    console.error('Update transaction type error:', err);
    res.status(500).json({ 
      error: 'Failed to update transaction',
      message: err.message 
    });
  }
};

/**
 * Record a settlement (mark as paid)
 * POST /api/harmonization/settle
 */
const settleUp = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, note } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Get couple
    const coupleResult = await pool.query(
      `SELECT id, user1_id, user2_id FROM couples 
       WHERE user1_id = $1 OR user2_id = $1 LIMIT 1`,
      [userId]
    );

    if (coupleResult.rows.length === 0) {
      return res.status(404).json({ error: 'No couple found' });
    }

    const couple = coupleResult.rows[0];

    // Record in harmonizations table
    const result = await pool.query(
      `INSERT INTO harmonizations (couple_id, amount, settled_by, note, settled_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, amount, settled_at`,
      [couple.id, amount, userId, note || null]
    );

    res.status(201).json({
      message: 'Settlement recorded',
      settlement: result.rows[0]
    });
  } catch (err) {
    console.error('Settle up error:', err);
    res.status(500).json({ 
      error: 'Failed to record settlement',
      message: err.message 
    });
  }
};

/**
 * Get settlement history
 * GET /api/harmonization/history
 */
const getSettlementHistory = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get couple
    const coupleResult = await pool.query(
      `SELECT id FROM couples WHERE user1_id = $1 OR user2_id = $1 LIMIT 1`,
      [userId]
    );

    if (coupleResult.rows.length === 0) {
      return res.status(404).json({ error: 'No couple found' });
    }

    const result = await pool.query(
      `SELECT h.id, h.amount, h.note, h.settled_at, 
              COALESCE(u.first_name, 'Utilisateur') as settled_by_name
       FROM harmonizations h
       LEFT JOIN users u ON h.settled_by = u.id
       WHERE h.couple_id = $1
       ORDER BY h.settled_at DESC
       LIMIT 50`,
      [coupleResult.rows[0].id]
    );

    res.status(200).json({
      settlements: result.rows
    });
  } catch (err) {
    console.error('Get settlement history error:', err);
    res.status(500).json({ 
      error: 'Failed to get settlement history',
      message: err.message 
    });
  }
};

/**
 * Delete a settlement (annuler une régularisation)
 * DELETE /api/harmonization/settle/:id
 */
const deleteSettlement = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Check ownership via couple
    const check = await pool.query(
      `SELECT h.id FROM harmonizations h
       JOIN couples c ON h.couple_id = c.id
       WHERE h.id = $1 AND (c.user1_id = $2 OR c.user2_id = $2)`,
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    await pool.query('DELETE FROM harmonizations WHERE id = $1', [id]);

    res.status(200).json({ message: 'Settlement deleted' });
  } catch (err) {
    console.error('Delete settlement error:', err);
    res.status(500).json({ 
      error: 'Failed to delete settlement',
      message: err.message 
    });
  }
};

// Helper function
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

module.exports = {
  getHarmonization,
  updateTransactionType,
  settleUp,
  getSettlementHistory,
  deleteSettlement
};
