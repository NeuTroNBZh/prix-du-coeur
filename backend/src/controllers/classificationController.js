/**
 * Classification Controller
 * Gestion de la classification IA des transactions
 */

const pool = require('../config/database');
const { isValidId } = require('../utils/validation');
const { 
  classifyTransactionsBatch, 
  classifyTransaction, 
  checkAPIHealth 
} = require('../services/mistralClient');
const { decrypt, decryptTransactions } = require('../services/encryptionService');

/**
 * Get learning context from user's past corrections
 */
const getLearningContext = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT label, corrected_type as type, corrected_category as category
       FROM ai_learning
       WHERE user_id = $1 AND should_learn = true
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    // Decrypt labels before returning for AI context
    return decryptTransactions(result.rows);
  } catch (error) {
    // Table might not exist yet, return empty context
    console.log('Learning context not available:', error.message);
    return [];
  }
};

/**
 * Classify multiple transactions
 * POST /api/classify
 * Body: { transactionIds: [1, 2, 3] } or { all: true } for unclassified
 */
const classifyTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionIds, all } = req.body;

    // Get transactions to classify
    let query;
    let params;

    if (all) {
      // Get all unclassified transactions (no ai_confidence set)
      query = `
        SELECT id, label, amount, date
        FROM transactions
        WHERE user_id = $1 AND (ai_confidence IS NULL OR ai_confidence = 0)
        ORDER BY date DESC
        LIMIT 100
      `;
      params = [userId];
    } else if (transactionIds && transactionIds.length > 0) {
      query = `
        SELECT id, label, amount, date
        FROM transactions
        WHERE user_id = $1 AND id = ANY($2)
        ORDER BY date DESC
      `;
      params = [userId, transactionIds];
    } else {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Provide transactionIds or set all: true',
          code: 'MISSING_PARAMS'
        }
      });
    }

    const transactionsResult = await pool.query(query, params);
    // Decrypt labels before classification
    const transactions = decryptTransactions(transactionsResult.rows);

    if (transactions.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          classified: 0,
          message: 'No transactions to classify'
        }
      });
    }

    // Get user info for internal transfer detection
    const userResult = await pool.query(
      'SELECT first_name, last_name, is_in_couple FROM users WHERE id = $1',
      [userId]
    );
    const userInfo = userResult.rows[0] ? {
      firstName: userResult.rows[0].first_name,
      lastName: userResult.rows[0].last_name,
      isInCouple: userResult.rows[0].is_in_couple !== false // default true for backwards compat
    } : null;

    // Get learning context for better classification
    const learningContext = await getLearningContext(userId);

    // Classify transactions with Mistral (pass user info for internal transfer detection)
    const classifications = await classifyTransactionsBatch(transactions, learningContext, userInfo);

    // Update transactions with classifications
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const classification of classifications) {
        await client.query(
          `UPDATE transactions
           SET type = $1,
               category = $2,
               ai_confidence = $3,
               ai_reasoning = $4,
               is_recurring = $5,
               classified_at = NOW()
           WHERE id = $6 AND user_id = $7`,
          [
            classification.type,
            classification.category,
            classification.confidence,
            classification.reasoning,
            classification.isRecurring || false,
            classification.transactionId,
            userId
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.status(200).json({
      success: true,
      data: {
        classified: classifications.length,
        classifications: classifications,
        learningContextUsed: learningContext.length
      }
    });

  } catch (error) {
    console.error('Classification error:', error);
    
    // Check if it's an API key issue
    if (error.message.includes('not configured')) {
      return res.status(503).json({
        success: false,
        error: {
          message: 'Service IA non configuré. Veuillez configurer la clé API Mistral.',
          code: 'IA_NOT_CONFIGURED'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Erreur lors de la classification',
        code: 'CLASSIFICATION_ERROR',
        details: error.message
      }
    });
  }
};

/**
 * Correct a transaction classification (manual override)
 * PATCH /api/transactions/:id/classify
 * Body: { type, category, shouldLearn: true }
 */
const correctClassification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { type, category, ratio, shouldLearn = true } = req.body;

    // Validate ID parameter
    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'ID de transaction invalide',
          code: 'INVALID_ID'
        }
      });
    }

    // Validate type
    const validTypes = ['commune', 'individuelle', 'abonnement', 'virement_interne'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Type invalide. Valeurs acceptées: ${validTypes.join(', ')}`,
          code: 'INVALID_TYPE'
        }
      });
    }

    // Get original transaction
    const txResult = await pool.query(
      `SELECT id, label, amount, type as original_type, category as original_category, ai_confidence
       FROM transactions
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (txResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Transaction non trouvée',
          code: 'TRANSACTION_NOT_FOUND'
        }
      });
    }

    const transaction = txResult.rows[0];

    // Update transaction with corrected classification
    // Validate ratio if provided (0 to 1)
    let validRatio = null;
    if (ratio !== undefined && ratio !== null) {
      validRatio = Math.max(0, Math.min(1, parseFloat(ratio)));
    }

    await pool.query(
      `UPDATE transactions
       SET type = $1,
           category = $2,
           ratio = COALESCE($3, ratio),
           ai_confidence = 100,
           ai_reasoning = 'Corrigé manuellement par l''utilisateur',
           classified_at = NOW()
       WHERE id = $4`,
      [type, category || transaction.original_category, validRatio, id]
    );

    // Save to learning table if user wants IA to learn
    if (shouldLearn) {
      try {
        await pool.query(
          `INSERT INTO ai_learning (user_id, transaction_id, label, original_type, original_category, corrected_type, corrected_category, should_learn)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT (transaction_id) DO UPDATE
           SET corrected_type = $6,
               corrected_category = $7,
               should_learn = true,
               updated_at = NOW()`,
          [
            userId,
            id,
            transaction.label,
            transaction.original_type,
            transaction.original_category,
            type,
            category || transaction.original_category
          ]
        );
      } catch (learnError) {
        console.log('Could not save to learning table:', learnError.message);
        // Continue anyway - the correction was saved
      }
    }

    res.status(200).json({
      success: true,
      data: {
        transactionId: id,
        type,
        category: category || transaction.original_category,
        learned: shouldLearn
      }
    });

  } catch (error) {
    console.error('Correct classification error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Erreur lors de la correction',
        code: 'CORRECTION_ERROR',
        details: error.message
      }
    });
  }
};

/**
 * Get IA health status
 * GET /api/classify/health
 */
const getIAHealth = async (req, res) => {
  try {
    const health = await checkAPIHealth();
    
    res.status(200).json({
      success: true,
      data: {
        mistralAvailable: health.available,
        error: health.error,
        model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
        configured: process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY !== 'votre_cle_mistral_gratuite'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Erreur lors de la vérification',
        code: 'HEALTH_CHECK_ERROR'
      }
    });
  }
};

/**
 * Get classification statistics
 * GET /api/classify/stats
 */
const getClassificationStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const stats = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE ai_confidence IS NOT NULL AND ai_confidence > 0) as classified,
         COUNT(*) FILTER (WHERE ai_confidence IS NULL OR ai_confidence = 0) as unclassified,
         AVG(ai_confidence) FILTER (WHERE ai_confidence IS NOT NULL AND ai_confidence > 0) as avg_confidence,
         COUNT(*) as total
       FROM transactions
       WHERE user_id = $1`,
      [userId]
    );

    const learningCount = await pool.query(
      `SELECT COUNT(*) as count FROM ai_learning WHERE user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [{ count: 0 }] }));

    res.status(200).json({
      success: true,
      data: {
        totalTransactions: parseInt(stats.rows[0].total),
        classified: parseInt(stats.rows[0].classified),
        unclassified: parseInt(stats.rows[0].unclassified),
        avgConfidence: Math.round(parseFloat(stats.rows[0].avg_confidence) || 0),
        learningEntries: parseInt(learningCount.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Erreur lors de la récupération des stats',
        code: 'STATS_ERROR'
      }
    });
  }
};

/**
 * Get AI learning entries for the user
 * GET /api/classify/learning
 */
const getLearningEntries = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, label, original_type, original_category, corrected_type, corrected_category, created_at
       FROM ai_learning
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    // Decrypt labels before returning to client
    const decryptedEntries = decryptTransactions(result.rows);

    res.status(200).json({
      success: true,
      data: {
        entries: decryptedEntries,
        total: decryptedEntries.length
      }
    });
  } catch (error) {
    console.error('Get learning entries error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Erreur lors de la récupération des données',
        code: 'LEARNING_FETCH_ERROR'
      }
    });
  }
};

/**
 * Delete AI learning entries
 * DELETE /api/classify/learning
 * Body: { ids: [1, 2, 3] } for specific or { all: true } for all
 */
const deleteLearningEntries = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ids, all } = req.body;

    let result;
    if (all) {
      result = await pool.query(
        'DELETE FROM ai_learning WHERE user_id = $1 RETURNING id',
        [userId]
      );
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      result = await pool.query(
        'DELETE FROM ai_learning WHERE user_id = $1 AND id = ANY($2) RETURNING id',
        [userId, ids]
      );
    } else {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Spécifiez les IDs ou all: true',
          code: 'MISSING_PARAMS'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        deleted: result.rowCount,
        message: `${result.rowCount} entrée(s) supprimée(s)`
      }
    });
  } catch (error) {
    console.error('Delete learning entries error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Erreur lors de la suppression',
        code: 'LEARNING_DELETE_ERROR'
      }
    });
  }
};

/**
 * Reclassify transactions (force re-classification even if already classified)
 * POST /api/classify/reclassify
 * Body: { mode: 'all' | 'last100' | 'last200' | 'last300' | 'last500' }
 */
const reclassifyTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mode = 'all' } = req.body;

    // Determine limit based on mode
    let limit = null;
    if (mode === 'last100') limit = 100;
    else if (mode === 'last200') limit = 200;
    else if (mode === 'last300') limit = 300;
    else if (mode === 'last500') limit = 500;

    // First count total transactions
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM transactions WHERE user_id = $1',
      [userId]
    );
    const totalTransactions = parseInt(countResult.rows[0].count);

    // Build query based on mode
    let query = `
      SELECT id, label, amount, date
      FROM transactions
      WHERE user_id = $1
      ORDER BY date DESC
    `;
    
    if (limit) {
      // Cannot exceed total transactions
      const effectiveLimit = Math.min(limit, totalTransactions);
      query += ` LIMIT ${effectiveLimit}`;
    }

    const transactionsResult = await pool.query(query, [userId]);
    // Decrypt labels before classification
    const transactions = decryptTransactions(transactionsResult.rows);

    if (transactions.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          reclassified: 0,
          message: 'Aucune transaction à reclassifier'
        }
      });
    }

    // Get user info
    const userResult = await pool.query(
      'SELECT first_name, last_name, is_in_couple FROM users WHERE id = $1',
      [userId]
    );
    const userInfo = userResult.rows[0] ? {
      firstName: userResult.rows[0].first_name,
      lastName: userResult.rows[0].last_name,
      isInCouple: userResult.rows[0].is_in_couple !== false
    } : null;

    // Get learning context
    const learningContext = await getLearningContext(userId);

    // Classify in batches of 50 to avoid API timeouts
    const batchSize = 50;
    let totalClassified = 0;
    const allClassifications = [];

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const classifications = await classifyTransactionsBatch(batch, learningContext, userInfo);
      allClassifications.push(...classifications);
    }

    // Update transactions
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const classification of allClassifications) {
        await client.query(
          `UPDATE transactions
           SET type = $1,
               category = $2,
               ai_confidence = $3,
               ai_reasoning = $4,
               is_recurring = $5,
               classified_at = NOW()
           WHERE id = $6 AND user_id = $7`,
          [
            classification.type,
            classification.category,
            classification.confidence,
            classification.reasoning,
            classification.isRecurring || false,
            classification.transactionId,
            userId
          ]
        );
        totalClassified++;
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.status(200).json({
      success: true,
      data: {
        reclassified: totalClassified,
        totalTransactions: totalTransactions,
        mode: mode,
        message: `${totalClassified} transaction(s) reclassifiée(s)`
      }
    });

  } catch (error) {
    console.error('Reclassification error:', error);
    
    if (error.message.includes('not configured')) {
      return res.status(503).json({
        success: false,
        error: {
          message: 'Service IA non configuré',
          code: 'IA_NOT_CONFIGURED'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Erreur lors de la reclassification',
        code: 'RECLASSIFICATION_ERROR',
        details: error.message
      }
    });
  }
};

/**
 * Reset transactions for reclassification (mark as unclassified)
 * This allows users to then use the regular classify button multiple times
 * POST /api/classify/reset-for-reclassify
 * Body: { mode: 'last100' | 'last200' | 'last300' | 'last500' | 'all' }
 */
const resetForReclassification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mode = 'last100' } = req.body;

    // Determine limit based on mode
    let limit = null;
    if (mode === 'last100') limit = 100;
    else if (mode === 'last200') limit = 200;
    else if (mode === 'last300') limit = 300;
    else if (mode === 'last500') limit = 500;
    // 'all' = no limit

    // Build query to get transaction IDs to reset
    let query = `
      SELECT id FROM transactions
      WHERE user_id = $1
      ORDER BY date DESC
    `;
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const transactionsResult = await pool.query(query, [userId]);
    const transactionIds = transactionsResult.rows.map(r => r.id);

    if (transactionIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          reset: 0,
          message: 'Aucune transaction à réinitialiser'
        }
      });
    }

    // Reset ai_confidence to 0 for these transactions
    const updateResult = await pool.query(
      `UPDATE transactions 
       SET ai_confidence = 0, 
           ai_reasoning = NULL,
           classified_at = NULL
       WHERE id = ANY($1) AND user_id = $2`,
      [transactionIds, userId]
    );

    res.status(200).json({
      success: true,
      data: {
        reset: updateResult.rowCount,
        message: `${updateResult.rowCount} transaction(s) marquée(s) comme à classifier. Utilisez le bouton "Classifier" pour les traiter.`
      }
    });

  } catch (error) {
    console.error('Reset for reclassification error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Erreur lors de la réinitialisation',
        code: 'RESET_ERROR',
        details: error.message
      }
    });
  }
};

module.exports = {
  classifyTransactions,
  correctClassification,
  getIAHealth,
  getClassificationStats,
  getLearningEntries,
  deleteLearningEntries,
  reclassifyTransactions,
  resetForReclassification
};
