/**
 * Bank Sync Scheduler - API v3
 * Automatically syncs bank transactions for all users daily
 */

const pool = require('../config/database');
const bridgeService = require('../services/bridgeService');
const { classifyTransaction } = require('../utils/transactionClassifier');

/**
 * Sync transactions for all users with bank connections
 */
const syncAllUsers = async () => {
  console.log('🏦 Starting daily bank sync...');
  const startTime = Date.now();
  let totalUsers = 0;
  let totalTransactions = 0;
  let errors = 0;

  try {
    // Get all users with active bank connections
    const usersResult = await pool.query(`
      SELECT DISTINCT u.id, u.email, u.bridge_user_uuid
      FROM users u
      INNER JOIN bank_connections bc ON bc.user_id = u.id
      WHERE bc.status = 'active' AND u.bridge_user_uuid IS NOT NULL
    `);

    totalUsers = usersResult.rows.length;
    console.log(`📊 Found ${totalUsers} users with bank connections`);

    for (const user of usersResult.rows) {
      try {
        console.log(`🔄 Syncing user ${user.id} (${user.email})...`);
        
        const userUuid = user.bridge_user_uuid;
        
        // Get all items and refresh them
        const items = await bridgeService.getItems(userUuid);
        for (const item of items) {
          try {
            await bridgeService.refreshItem(item.id);
          } catch (err) {
            console.error(`  ⚠️ Error refreshing item ${item.id}:`, err.message);
          }
        }
        
        // Wait for Bridge to fetch new data
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Sync transactions
        const result = await syncTransactionsForUser(user.id, userUuid);
        totalTransactions += result.newTransactions;
        
        // Update connection status
        await pool.query(
          `UPDATE bank_connections SET last_sync_at = NOW(), last_sync_status = 'success' WHERE user_id = $1`,
          [user.id]
        );
        
        console.log(`  ✅ User ${user.id}: ${result.newTransactions} new transactions`);
      } catch (userError) {
        errors++;
        console.error(`  ❌ Error syncing user ${user.id}:`, userError.message);
        
        // Update connection status to error
        await pool.query(
          `UPDATE bank_connections SET last_sync_status = 'error' WHERE user_id = $1`,
          [user.id]
        );
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Daily bank sync completed in ${duration}s`);
    console.log(`   Users: ${totalUsers}, New transactions: ${totalTransactions}, Errors: ${errors}`);
    
    return { totalUsers, totalTransactions, errors, duration };
  } catch (error) {
    console.error('❌ Fatal error in daily bank sync:', error);
    throw error;
  }
};

/**
 * Sync transactions for a specific user
 */
const syncTransactionsForUser = async (userId, userUuid) => {
  let newTransactions = 0;
  
  try {
    // Get all enabled bank accounts for this user
    const bankAccounts = await pool.query(
      `SELECT ba.id, ba.bridge_account_id, ba.account_id, ba.last_sync_at
       FROM bank_accounts ba
       WHERE ba.user_id = $1 AND ba.is_enabled = true AND ba.account_id IS NOT NULL`,
      [userId]
    );
    
    // Get all transactions from Bridge for this user
    const allTransactions = await bridgeService.getTransactions(userUuid);
    
    // Create a map of bridge_account_id -> account_id
    const accountMap = {};
    for (const ba of bankAccounts.rows) {
      accountMap[ba.bridge_account_id] = ba.account_id;
    }
    
    for (const tx of allTransactions) {
      // Check if this transaction belongs to one of our accounts
      const accountId = accountMap[tx.account_id];
      if (!accountId) continue;
      
      // Check if transaction already exists
      const existing = await pool.query(
        'SELECT id FROM transactions WHERE bridge_transaction_id = $1',
        [tx.id.toString()]
      );
      
      if (existing.rows.length === 0) {
        // Classify the transaction
        const classification = classifyTransaction(tx.description || tx.raw_description || 'Transaction');
        
        // Insert new transaction
        await pool.query(
          `INSERT INTO transactions (user_id, account_id, amount, date, label, category, transaction_type, is_shared, bridge_transaction_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)`,
          [
            userId,
            accountId,
            tx.amount,
            tx.date,
            tx.description || tx.raw_description || 'Transaction',
            classification.category,
            tx.amount < 0 ? 'expense' : 'income',
            tx.id.toString()
          ]
        );
        
        newTransactions++;
      }
    }
    
    // Update last sync for all bank accounts
    await pool.query(
      'UPDATE bank_accounts SET last_sync_at = NOW() WHERE user_id = $1',
      [userId]
    );
    
    return { newTransactions };
  } catch (error) {
    console.error('syncTransactionsForUser error:', error);
    return { newTransactions: 0, error: error.message };
  }
};

module.exports = {
  syncAllUsers,
  syncTransactionsForUser
};
