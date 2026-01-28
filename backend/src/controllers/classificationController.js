/**
 * Classification Controller
 * Gestion de la classification IA des transactions
 */

const pool = require('../config/database');
const { 
  classifyTransactionsBatch, 
  classifyTransaction, 
  checkAPIHealth 
} = require('../services/mistralClient');

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
    return result.rows;
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
    const transactions = transactionsResult.rows;

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
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    const userInfo = userResult.rows[0] ? {
      firstName: userResult.rows[0].first_name,
      lastName: userResult.rows[0].last_name
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
               classified_at = NOW()
           WHERE id = $5 AND user_id = $6`,
          [
            classification.type,
            classification.category,
            classification.confidence,
            classification.reasoning,
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

    res.status(200).json({
      success: true,
      data: {
        entries: result.rows,
        total: result.rows.length
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

module.exports = {
  classifyTransactions,
  correctClassification,
  getIAHealth,
  getClassificationStats,
  getLearningEntries,
  deleteLearningEntries
};
