const crypto = require('crypto');
const pool = require('../config/database');
const ParserFactory = require('../utils/parsers/ParserFactory');
const CMBPdfParser = require('../utils/parsers/CMBPdfParser');

/**
 * Generate checksum for transaction to detect duplicates
 */
function generateChecksum(date, label, amount) {
  const data = `${date}|${label}|${amount}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Upload CSV or PDF and detect format + parse transactions
 * POST /api/transactions/upload
 */
const uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileName = req.file.originalname.toLowerCase();
    console.log('📤 File received:', req.file.originalname, '|', req.file.size, 'bytes');

    // Check if it's a PDF file
    if (fileName.endsWith('.pdf')) {
      console.log('📄 PDF file detected, using CMB parser');
      const result = await CMBPdfParser.parsePdf(req.file.buffer);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: 'PDF parsing failed',
          message: result.error 
        });
      }
      
      return res.status(200).json({
        message: 'PDF analyzed successfully',
        bank: result.bank,
        bankDisplay: result.bankDisplay,
        accounts: result.accounts,
        accountNumber: result.accounts.length > 0 ? result.accounts[0].number : null,
        transactions: result.transactions,
        fileSize: req.file.size,
        isPdf: true
      });
    }

    // CSV processing (existing logic)
    // Try UTF-8 first for Revolut, binary for CA (ISO-8859-1)
    let csvContent = req.file.buffer.toString('utf-8');
    let bankName = ParserFactory.detectBankName(csvContent);
    
    // If detected as CA or not detected, try binary encoding (for ISO-8859-1 files)
    if (bankName === 'credit_agricole' || !bankName) {
      const binaryContent = req.file.buffer.toString('binary');
      const binaryBankName = ParserFactory.detectBankName(binaryContent);
      if (binaryBankName) {
        csvContent = binaryContent;
        bankName = binaryBankName;
        console.log('📄 Using binary encoding for:', bankName);
      }
    }
    
    // Log first 200 chars for debugging
    console.log('📄 CSV Preview (first 200 chars):', csvContent.substring(0, 200));
    console.log('🏦 Bank detected:', bankName || 'NONE');
    
    // Extract available accounts
    const accounts = ParserFactory.extractAccounts(csvContent);
    console.log('💳 Accounts found:', accounts.length, accounts.map(a => a.number).join(', '));
    
    if (!bankName) {
      // Try with binary encoding as fallback
      csvContent = req.file.buffer.toString('binary');
      const retryBankName = ParserFactory.detectBankName(csvContent);
      console.log('🔄 Retry with binary encoding:', retryBankName || 'NONE');
      
      if (!retryBankName) {
        return res.status(400).json({ 
          error: 'Unsupported format',
          message: 'CSV format not recognized. Supported: Crédit Agricole, Revolut',
          preview: csvContent.substring(0, 200)
        });
      }
      
      return res.status(400).json({ 
        error: 'Unsupported format',
        message: 'CSV format not recognized. Supported: Crédit Agricole, Revolut' 
      });
    }

    // Parse ALL transactions (not filtered by account)
    console.log('🔄 Parsing transactions...');
    const transactions = await ParserFactory.parseTransactions(csvContent, null);
    console.log('✅ Parsed transactions:', transactions.length);

    res.status(200).json({
      message: 'CSV analyzed successfully',
      bank: bankName,
      accounts: accounts,
      accountNumber: accounts.length > 0 ? accounts[0].number : null,
      transactions: transactions,
      fileSize: req.file.size
    });
  } catch (err) {
    console.error('Upload CSV error:', err);
    res.status(500).json({ 
      error: 'Upload failed',
      message: err.message 
    });
  }
};

/**
 * Import transactions from parsed JSON data
 * POST /api/transactions/import
 */
const importTransactions = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { transactions, accountNumber, bank } = req.body;
    const userId = req.user.userId;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'No transactions provided' });
    }

    const bankName = bank || 'Unknown';
    const accountNum = accountNumber || 'default';

    await client.query('BEGIN');

    // Check if account exists, create if not
    let accountResult = await client.query(
      `SELECT id FROM accounts 
       WHERE user_id = $1 AND bank_name = $2 AND account_number = $3`,
      [userId, bankName, accountNum]
    );

    let accountId;
    if (accountResult.rows.length === 0) {
      // Create new account
      const newAccount = await client.query(
        `INSERT INTO accounts (user_id, bank_name, account_number, name)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId, bankName, accountNum, 'Compte Principal']
      );
      accountId = newAccount.rows[0].id;
    } else {
      accountId = accountResult.rows[0].id;
    }

    // Get user's couple_id
    const coupleResult = await client.query(
      `SELECT id FROM couples WHERE user1_id = $1 OR user2_id = $1 LIMIT 1`,
      [userId]
    );

    const coupleId = coupleResult.rows.length > 0 ? coupleResult.rows[0].id : null;

    // Insert transactions
    let inserted = 0;
    let duplicates = 0;

    for (const tx of transactions) {
      const checksum = generateChecksum(tx.date, tx.label, tx.amount);

      // Check for duplicate
      const duplicateCheck = await client.query(
        `SELECT id FROM transactions WHERE csv_checksum = $1`,
        [checksum]
      );

      if (duplicateCheck.rows.length > 0) {
        duplicates++;
        continue;
      }

      // Insert transaction
      await client.query(
        `INSERT INTO transactions 
         (couple_id, user_id, account_id, date, amount, label, category, csv_checksum)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [coupleId, userId, accountId, tx.date, tx.amount, tx.label, tx.category || 'Autre', checksum]
      );
      inserted++;
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Import successful',
      inserted,
      duplicates,
      total: transactions.length,
      accountId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import transactions error:', err);
    res.status(500).json({ 
      error: 'Import failed',
      message: err.message 
    });
  } finally {
    client.release();
  }
};

/**
 * Get user's accounts
 * GET /api/accounts
 */
const getAccounts = async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('Getting accounts for user:', userId);

    // Calculate balance = reference_balance + sum of transactions AFTER reference_date
    const result = await pool.query(
      `SELECT a.id, a.bank_name, a.account_number, a.name AS account_label, 
              a.reference_balance, a.reference_date, a.created_at,
              COUNT(t.id) as transaction_count,
              COALESCE(a.reference_balance, 0) + COALESCE(
                (SELECT SUM(amount) FROM transactions 
                 WHERE account_id = a.id AND date > a.reference_date), 0
              ) as balance
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id
       WHERE a.user_id = $1
       GROUP BY a.id
       ORDER BY a.created_at DESC`,
      [userId]
    );

    // Map to include balance as a proper field
    const accounts = result.rows.map(row => ({
      ...row,
      balance: parseFloat(row.balance) || 0
    }));

    console.log('Found accounts:', accounts.length);

    res.status(200).json({
      accounts: accounts
    });
  } catch (err) {
    console.error('Get accounts error:', err);
    res.status(500).json({ 
      error: 'Failed to retrieve accounts',
      message: err.message 
    });
  }
};

/**
 * Get transactions with filters
 * GET /api/transactions
 */
const getTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId, startDate, endDate, category, limit = 100 } = req.query;

    let query = `
      SELECT t.id, t.date, t.label, t.amount, t.category, t.type, 
             t.account_id, a.name AS account_label, a.bank_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.user_id = $1
    `;
    const params = [userId];
    let paramCount = 1;

    if (accountId) {
      paramCount++;
      query += ` AND t.account_id = $${paramCount}`;
      params.push(accountId);
    }

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

    if (category) {
      paramCount++;
      query += ` AND t.category = $${paramCount}`;
      params.push(category);
    }

    query += ` ORDER BY t.date DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.status(200).json({
      transactions: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ 
      error: 'Failed to retrieve transactions',
      message: err.message 
    });
  }
};

/**
 * Set reference balance for an account (solde à une date donnée)
 * PUT /api/accounts/:accountId/balance
 */
const setInitialBalance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;
    const { referenceBalance, referenceDate } = req.body;
    
    // Support legacy field names
    const balance = referenceBalance !== undefined ? referenceBalance : req.body.initialBalance;
    const date = referenceDate || req.body.balanceDate;

    if (balance === undefined) {
      return res.status(400).json({ error: 'Reference balance is required' });
    }

    // Check account ownership
    const accountCheck = await pool.query(
      'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (accountCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Update reference balance
    await pool.query(
      `UPDATE accounts 
       SET reference_balance = $1, reference_date = $2
       WHERE id = $3`,
      [balance, date || new Date(), accountId]
    );

    res.status(200).json({
      message: 'Reference balance updated',
      accountId,
      referenceBalance: balance,
      referenceDate: date || new Date()
    });
  } catch (err) {
    console.error('Set initial balance error:', err);
    res.status(500).json({ 
      error: 'Failed to update balance',
      message: err.message 
    });
  }
};

/**
 * Get account balance evolution
 * GET /api/accounts/:accountId/evolution
 * 
 * Calcul rétrospectif : si on connaît le solde à une date,
 * on peut calculer le solde à n'importe quelle autre date
 * - Avant la date de référence: on soustrait les transactions
 * - Après la date de référence: on ajoute les transactions
 */
const getBalanceEvolution = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;
    const { startDate, endDate } = req.query;

    // Get account with reference balance
    const accountResult = await pool.query(
      `SELECT id, reference_balance, reference_date, name, bank_name
       FROM accounts 
       WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountResult.rows[0];
    const knownBalance = parseFloat(account.reference_balance) || 0;
    const knownBalanceDate = account.reference_date ? new Date(account.reference_date) : new Date();

    // Get ALL transactions for this account (no date filter - we need all for proper calculation)
    let query = `
      SELECT date, SUM(amount) as daily_total
      FROM transactions
      WHERE account_id = $1 AND user_id = $2
      GROUP BY date
      ORDER BY date
    `;
    const params = [accountId, userId];

    const txResult = await pool.query(query, params);

    if (txResult.rows.length === 0) {
      // No transactions, just return the known balance
      return res.status(200).json({
        account: {
          id: account.id,
          name: account.name,
          bank: account.bank_name,
          referenceBalance: knownBalance,
          referenceDate: account.reference_date
        },
        evolution: [{
          date: knownBalanceDate.toISOString().split('T')[0],
          balance: knownBalance,
          change: 0,
          isReference: true
        }],
        currentBalance: knownBalance
      });
    }

    // Separate transactions before and after the reference date
    const txBefore = txResult.rows.filter(r => new Date(r.date) < knownBalanceDate);
    const txOnOrAfter = txResult.rows.filter(r => new Date(r.date) >= knownBalanceDate);

    // Calculate balance at the EARLIEST transaction date
    // Balance at earliest = knownBalance - sum of all transactions between earliest and knownBalanceDate
    const sumBefore = txBefore.reduce((sum, r) => sum + parseFloat(r.daily_total), 0);
    const earliestBalance = knownBalance - sumBefore;

    // Build evolution array
    const evolution = [];
    let runningBalance = earliestBalance;

    // Add all transactions in chronological order
    for (const row of txResult.rows) {
      runningBalance += parseFloat(row.daily_total);
      evolution.push({
        date: row.date,
        balance: Math.round(runningBalance * 100) / 100,
        change: parseFloat(row.daily_total)
      });
    }

    // Ensure the reference point is in the evolution
    const knownDateStr = knownBalanceDate.toISOString().split('T')[0];
    const knownDateExists = evolution.some(e => {
      const eDate = new Date(e.date).toISOString().split('T')[0];
      return eDate === knownDateStr;
    });
    
    if (!knownDateExists) {
      // Find where to insert the reference point
      // Calculate balance at reference date
      const txBeforeRef = txResult.rows.filter(r => new Date(r.date) < knownBalanceDate);
      const sumBeforeRef = txBeforeRef.reduce((sum, r) => sum + parseFloat(r.daily_total), 0);
      const balanceAtRef = earliestBalance + sumBeforeRef;
      
      evolution.push({
        date: knownDateStr,
        balance: Math.round(balanceAtRef * 100) / 100,
        change: 0,
        isReference: true
      });
      evolution.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Current balance is the last balance (most recent transaction)
    const currentBalance = evolution.length > 0 
      ? evolution[evolution.length - 1].balance 
      : knownBalance;

    // Apply date filters for display if provided
    let filteredEvolution = evolution;
    if (startDate) {
      filteredEvolution = filteredEvolution.filter(e => new Date(e.date) >= new Date(startDate));
    }
    if (endDate) {
      filteredEvolution = filteredEvolution.filter(e => new Date(e.date) <= new Date(endDate));
    }

    res.status(200).json({
      account: {
        id: account.id,
        name: account.name,
        bank: account.bank_name,
        referenceBalance: knownBalance,
        referenceDate: account.reference_date
      },
      evolution: filteredEvolution,
      currentBalance: currentBalance
    });
  } catch (err) {
    console.error('Get balance evolution error:', err);
    res.status(500).json({ 
      error: 'Failed to calculate evolution',
      message: err.message 
    });
  }
};

/**
 * Create a manual transaction
 * POST /api/transactions
 */
const createTransaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, label, category, date, type } = req.body;

    if (!amount || !label) {
      return res.status(400).json({ error: 'Amount and label are required' });
    }

    // Get user's couple
    const coupleResult = await pool.query(
      `SELECT id FROM couples WHERE user1_id = $1 OR user2_id = $1 LIMIT 1`,
      [userId]
    );

    const coupleId = coupleResult.rows.length > 0 ? coupleResult.rows[0].id : null;

    // Get or create default account
    let accountResult = await pool.query(
      `SELECT id FROM accounts WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    let accountId;
    if (accountResult.rows.length === 0) {
      const newAccount = await pool.query(
        `INSERT INTO accounts (user_id, bank_name, account_number, name)
         VALUES ($1, 'Manuel', 'manual', 'Dépenses manuelles')
         RETURNING id`,
        [userId]
      );
      accountId = newAccount.rows[0].id;
    } else {
      accountId = accountResult.rows[0].id;
    }

    // Insert transaction
    const result = await pool.query(
      `INSERT INTO transactions 
       (couple_id, user_id, account_id, date, amount, label, category, type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, date, amount, label, category, type`,
      [
        coupleId, 
        userId, 
        accountId, 
        date || new Date().toISOString().split('T')[0], 
        parseFloat(amount),
        label,
        category || 'Autre',
        type || 'individuelle'
      ]
    );

    res.status(201).json({
      message: 'Transaction created',
      transaction: result.rows[0]
    });
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ 
      error: 'Failed to create transaction',
      message: err.message 
    });
  }
};

/**
 * Delete a transaction
 * DELETE /api/transactions/:id
 */
const deleteTransaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Check ownership
    const check = await pool.query(
      `SELECT id FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await pool.query('DELETE FROM transactions WHERE id = $1', [id]);

    res.status(200).json({ message: 'Transaction deleted' });
  } catch (err) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ 
      error: 'Failed to delete transaction',
      message: err.message 
    });
  }
};

/**
 * Update transaction label
 * PATCH /api/transactions/:id/label
 */
const updateTransactionLabel = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { label } = req.body;

    if (!label || label.trim().length === 0) {
      return res.status(400).json({ error: 'Label is required' });
    }

    // Check ownership
    const check = await pool.query(
      `SELECT id FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await pool.query(
      `UPDATE transactions SET label = $1 WHERE id = $2`,
      [label.trim(), id]
    );

    res.status(200).json({ message: 'Label updated', label: label.trim() });
  } catch (err) {
    console.error('Update transaction label error:', err);
    res.status(500).json({ 
      error: 'Failed to update label',
      message: err.message 
    });
  }
};

/**
 * Update transaction amount
 * PATCH /api/transactions/:id/amount
 */
const updateTransactionAmount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { amount } = req.body;

    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check ownership - either direct owner or via couple
    const check = await pool.query(
      `SELECT t.id FROM transactions t
       LEFT JOIN couples c ON t.couple_id = c.id
       WHERE t.id = $1 AND (t.user_id = $2 OR c.user1_id = $2 OR c.user2_id = $2)`,
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await pool.query(
      `UPDATE transactions SET amount = $1 WHERE id = $2`,
      [parsedAmount, id]
    );

    res.status(200).json({ message: 'Amount updated', amount: parsedAmount });
  } catch (err) {
    console.error('Update transaction amount error:', err);
    res.status(500).json({ 
      error: 'Failed to update amount',
      message: err.message 
    });
  }
};

/**
 * Update transaction type (commune/individuelle)
 * PATCH /api/transactions/:id/type
 */
const updateTransactionType = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { type, ratio } = req.body;

    if (!type || !['commune', 'individuelle', 'abonnement'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    // Check ownership via couple
    const check = await pool.query(
      `SELECT t.id FROM transactions t
       JOIN couples c ON t.couple_id = c.id
       WHERE t.id = $1 AND (c.user1_id = $2 OR c.user2_id = $2)`,
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await pool.query(
      `UPDATE transactions SET type = $1, ratio = $2 WHERE id = $3`,
      [type, ratio || 0.5, id]
    );

    res.status(200).json({ message: 'Transaction updated' });
  } catch (err) {
    console.error('Update transaction type error:', err);
    res.status(500).json({ 
      error: 'Failed to update transaction',
      message: err.message 
    });
  }
};

/**
 * Get spending analytics
 * GET /api/transactions/analytics
 */
const getAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate, accountId } = req.query;

    let dateFilter = '';
    const params = [userId];
    let paramCount = 1;

    if (accountId) {
      paramCount++;
      dateFilter += ` AND account_id = $${paramCount}`;
      params.push(accountId);
    }

    if (startDate) {
      paramCount++;
      dateFilter += ` AND date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      dateFilter += ` AND date <= $${paramCount}`;
      params.push(endDate);
    }

    // Get spending by category (only expenses, so amount < 0, exclude Revenus and internal transfers)
    const categoryQuery = `
      SELECT category, 
             COUNT(*) as count,
             SUM(ABS(amount)) as total
      FROM transactions
      WHERE user_id = $1 AND amount < 0 AND category != 'Revenus' AND type != 'virement_interne' ${dateFilter}
      GROUP BY category
      ORDER BY total DESC
    `;
    const categoryResult = await pool.query(categoryQuery, params);

    // Get monthly spending (exclude Revenus and internal transfers)
    const monthlyQuery = `
      SELECT TO_CHAR(date, 'YYYY-MM') as month,
             SUM(ABS(amount)) as total,
             COUNT(*) as count
      FROM transactions
      WHERE user_id = $1 AND amount < 0 AND category != 'Revenus' AND type != 'virement_interne' ${dateFilter}
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `;
    const monthlyResult = await pool.query(monthlyQuery, params);

    // Get total spending (exclude Revenus and internal transfers)
    const totalQuery = `
      SELECT SUM(ABS(amount)) as total_spent,
             COUNT(*) as total_transactions
      FROM transactions
      WHERE user_id = $1 AND amount < 0 AND category != 'Revenus' AND type != 'virement_interne' ${dateFilter}
    `;
    const totalResult = await pool.query(totalQuery, params);

    // Get total income (positive amounts, exclude internal transfers)
    const incomeQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_income,
             COUNT(*) as income_count
      FROM transactions
      WHERE user_id = $1 AND amount > 0 AND type != 'virement_interne' ${dateFilter}
    `;
    const incomeResult = await pool.query(incomeQuery, params);

    // Build byCategory object for frontend
    const byCategory = {};
    categoryResult.rows.forEach(row => {
      byCategory[row.category] = -parseFloat(row.total); // Negative for expenses
    });

    res.status(200).json({
      byCategory: byCategory,
      byMonth: monthlyResult.rows,
      totals: totalResult.rows[0],
      totalExpenses: -parseFloat(totalResult.rows[0]?.total_spent || 0),
      totalIncome: parseFloat(incomeResult.rows[0]?.total_income || 0)
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ 
      error: 'Failed to get analytics',
      message: err.message 
    });
  }
};

/**
 * Detect recurring transactions (subscriptions)
 * GET /api/transactions/recurring
 */
const getRecurringTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find potential recurring transactions by grouping similar amounts and labels
    const query = `
      WITH transaction_groups AS (
        SELECT 
          label,
          ABS(amount) as abs_amount,
          category,
          ARRAY_AGG(date ORDER BY date) as dates,
          ARRAY_AGG(id ORDER BY date) as ids,
          COUNT(*) as occurrence_count,
          MIN(date) as first_date,
          MAX(date) as last_date
        FROM transactions
        WHERE user_id = $1 AND amount < 0
        GROUP BY label, ABS(amount), category
        HAVING COUNT(*) >= 2
      )
      SELECT 
        label,
        abs_amount as amount,
        category,
        occurrence_count,
        first_date,
        last_date,
        dates,
        ids,
        CASE 
          WHEN occurrence_count >= 2 THEN
            (last_date - first_date) / NULLIF(occurrence_count - 1, 0)
          ELSE NULL
        END as avg_interval_days
      FROM transaction_groups
      WHERE occurrence_count >= 2
      ORDER BY occurrence_count DESC, abs_amount DESC
    `;

    const result = await pool.query(query, [userId]);

    // Also get transactions categorized as "Abonnements" that might not be recurring yet
    const categoryQuery = `
      SELECT DISTINCT ON (label, ABS(amount))
        id,
        label,
        ABS(amount) as amount,
        category,
        date as last_date,
        date as first_date
      FROM transactions
      WHERE user_id = $1 
        AND amount < 0 
        AND category = 'Abonnements'
      ORDER BY label, ABS(amount), date DESC
    `;
    const categoryResult = await pool.query(categoryQuery, [userId]);

    // Process results to categorize by frequency
    const now = new Date();
    const twoMonthsAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000)); // 60 days ago
    
    const recurring = result.rows.map(row => {
      const avgDays = row.avg_interval_days;
      let frequency = 'irregular';
      let nextExpectedDate = null;
      const lastDate = new Date(row.last_date);

      if (avgDays) {
        // More flexible ranges to account for billing variations
        if (avgDays >= 25 && avgDays <= 35) {
          frequency = 'monthly';
        } else if (avgDays >= 6 && avgDays <= 8) {
          frequency = 'weekly';
        } else if (avgDays >= 85 && avgDays <= 100) {
          frequency = 'quarterly';
        } else if (avgDays >= 175 && avgDays <= 195) {
          frequency = 'semiannual';
        } else if (avgDays >= 350 && avgDays <= 380) {
          frequency = 'yearly';
        }

        // Calculate next expected date
        nextExpectedDate = new Date(lastDate.getTime() + (avgDays * 24 * 60 * 60 * 1000));
      }

      // Check if subscription is still active (last payment within 2 months for monthly, or appropriate window)
      let isActive = true;
      if (frequency === 'monthly' && lastDate < twoMonthsAgo) {
        isActive = false;
      } else if (frequency === 'weekly' && lastDate < new Date(now.getTime() - (21 * 24 * 60 * 60 * 1000))) {
        isActive = false; // 3 weeks without payment
      } else if (frequency === 'quarterly' && lastDate < new Date(now.getTime() - (120 * 24 * 60 * 60 * 1000))) {
        isActive = false; // 4 months without payment
      } else if (frequency === 'yearly' && lastDate < new Date(now.getTime() - (400 * 24 * 60 * 60 * 1000))) {
        isActive = false; // 13 months without payment
      }

      // Calculate average day of month
      const daysOfMonth = row.dates.map(d => new Date(d).getDate());
      const avgDayOfMonth = Math.round(daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length);

      return {
        label: row.label,
        amount: parseFloat(row.amount),
        category: row.category,
        occurrences: row.occurrence_count,
        frequency,
        avgIntervalDays: avgDays,
        avgDayOfMonth,
        firstDate: row.first_date,
        lastDate: row.last_date,
        nextExpected: nextExpectedDate,
        transactionIds: row.ids,
        isActive
      };
    });

    // Merge similar subscriptions (same label with slightly different amounts)
    // This handles cases like "Achat: Google Play" at 0.53€ and 0.54€
    const mergedRecurring = [];
    for (const sub of recurring) {
      // Find existing subscription with same label and similar amount (within 10% or 1€)
      const existing = mergedRecurring.find(m => {
        if (m.label !== sub.label) return false;
        const amountDiff = Math.abs(m.amount - sub.amount);
        const percentDiff = amountDiff / Math.max(m.amount, sub.amount);
        return percentDiff < 0.10 || amountDiff < 1.0;
      });
      
      if (existing) {
        // Merge: combine occurrences, use average amount, update dates
        existing.occurrences += sub.occurrences;
        existing.amount = (existing.amount * (existing.occurrences - sub.occurrences) + sub.amount * sub.occurrences) / existing.occurrences;
        existing.transactionIds = [...existing.transactionIds, ...sub.transactionIds];
        if (new Date(sub.lastDate) > new Date(existing.lastDate)) {
          existing.lastDate = sub.lastDate;
          existing.nextExpected = sub.nextExpected;
          existing.avgDayOfMonth = sub.avgDayOfMonth;
        }
        if (new Date(sub.firstDate) < new Date(existing.firstDate)) {
          existing.firstDate = sub.firstDate;
        }
        // Keep most active status
        if (sub.isActive) existing.isActive = true;
        // Keep best frequency
        if (sub.frequency !== 'irregular' && existing.frequency === 'irregular') {
          existing.frequency = sub.frequency;
        }
      } else {
        mergedRecurring.push({ ...sub });
      }
    }

    // Filter out inactive subscriptions and generic labels like "Virement émis"
    // AND only keep those in "Abonnements" category
    const activeRecurring = mergedRecurring.filter(r => {
      // Exclude generic labels that are not real subscriptions
      const genericLabels = ['virement émis', 'virement recu', 'virement reçu', 'virement vers', 'retrait', 'paiement'];
      const isGeneric = genericLabels.some(g => r.label.toLowerCase().includes(g));
      
      // Only include if category is "Abonnements" or null/undefined
      const isSubscriptionCategory = !r.category || r.category === 'Abonnements';
      
      return r.frequency !== 'irregular' && r.isActive && !isGeneric && isSubscriptionCategory;
    });

    // Process category-based subscriptions (single transactions categorized as Abonnements)
    const categorySubscriptions = categoryResult.rows
      .filter(row => {
        // Check if not already in recurring list (with tolerance for similar amounts)
        const alreadyInRecurring = mergedRecurring.some(r => {
          if (r.label !== row.label) return false;
          const amountDiff = Math.abs(r.amount - parseFloat(row.amount));
          const percentDiff = amountDiff / Math.max(r.amount, parseFloat(row.amount));
          return percentDiff < 0.10 || amountDiff < 1.0;
        });
        return !alreadyInRecurring;
      })
      .map(row => ({
        label: row.label,
        amount: parseFloat(row.amount),
        category: row.category,
        occurrences: 1,
        frequency: 'manual', // Manually categorized
        avgDayOfMonth: new Date(row.last_date).getDate(),
        firstDate: row.first_date,
        lastDate: row.last_date,
        nextExpected: null,
        transactionIds: [row.id],
        isActive: true,
        isCategoryBased: true
      }));

    // Get shared subscriptions from partner (subscriptions marked as shared at couple level)
    // These are subscriptions the partner has that are shared with the current user
    let partnerSharedSubscriptions = [];
    try {
      // Get couple for this user
      const coupleResult = await pool.query(
        `SELECT id, user1_id, user2_id FROM couples WHERE user1_id = $1 OR user2_id = $1 LIMIT 1`,
        [userId]
      );
      
      if (coupleResult.rows.length > 0) {
        const couple = coupleResult.rows[0];
        const partnerId = couple.user1_id === userId ? couple.user2_id : couple.user1_id;
        
        // Get subscription settings marked as shared where the payer is the partner
        const sharedQuery = `
          SELECT ss.label, ss.amount, ss.frequency, ss.payer_user_id, u.first_name as payer_name
          FROM subscription_settings ss
          LEFT JOIN users u ON ss.payer_user_id = u.id
          WHERE ss.couple_id = $1 
            AND ss.is_shared = true 
            AND ss.payer_user_id = $2
        `;
        const sharedResult = await pool.query(sharedQuery, [couple.id, partnerId]);
        
        // Convert to subscription format
        partnerSharedSubscriptions = sharedResult.rows.map(row => ({
          label: row.label,
          amount: parseFloat(row.amount),
          category: 'Abonnements',
          occurrences: 0,
          frequency: row.frequency || 'monthly',
          avgDayOfMonth: 15, // Default
          firstDate: null,
          lastDate: null,
          nextExpected: null,
          transactionIds: [],
          isActive: true,
          isFromPartner: true, // Flag to indicate this is from partner
          payerName: row.payer_name
        }));
      }
    } catch (partnerErr) {
      console.error('Error fetching partner subscriptions:', partnerErr);
    }

    // Merge partner subscriptions (avoid duplicates with own subscriptions)
    const allRecurring = [...activeRecurring, ...categorySubscriptions];
    
    // Final merge to remove any remaining duplicates with similar amounts
    const finalRecurring = [];
    for (const sub of allRecurring) {
      const existing = finalRecurring.find(m => {
        if (m.label !== sub.label) return false;
        const amountDiff = Math.abs(m.amount - sub.amount);
        const percentDiff = amountDiff / Math.max(m.amount, sub.amount);
        return percentDiff < 0.10 || amountDiff < 1.0;
      });
      
      if (existing) {
        // Keep the one with more occurrences or update with newer data
        if (sub.occurrences > existing.occurrences) {
          Object.assign(existing, sub);
        } else if (new Date(sub.lastDate) > new Date(existing.lastDate)) {
          existing.lastDate = sub.lastDate;
        }
      } else {
        finalRecurring.push({ ...sub });
      }
    }
    
    partnerSharedSubscriptions.forEach(ps => {
      const exists = finalRecurring.some(r => {
        if (r.label !== ps.label) return false;
        const amountDiff = Math.abs(r.amount - ps.amount);
        const percentDiff = amountDiff / Math.max(r.amount, ps.amount);
        return percentDiff < 0.10 || amountDiff < 1.0;
      });
      if (!exists) {
        finalRecurring.push(ps);
      }
    });

    res.status(200).json({
      recurring: finalRecurring,
      possibleRecurring: mergedRecurring.filter(r => r.frequency === 'irregular'),
      expiredSubscriptions: mergedRecurring.filter(r => r.frequency !== 'irregular' && !r.isActive)
    });
  } catch (err) {
    console.error('Get recurring transactions error:', err);
    res.status(500).json({ 
      error: 'Failed to detect recurring transactions',
      message: err.message 
    });
  }
};

/**
 * Delete all transactions for an account
 * DELETE /api/transactions/accounts/:accountId
 */
const deleteAccountTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;

    // Check ownership
    const check = await pool.query(
      `SELECT id, name FROM accounts WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Count transactions to delete
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM transactions WHERE account_id = $1 AND user_id = $2`,
      [accountId, userId]
    );
    const count = parseInt(countResult.rows[0].count);

    // Delete all transactions for this account
    await pool.query(
      `DELETE FROM transactions WHERE account_id = $1 AND user_id = $2`,
      [accountId, userId]
    );

    // Delete the account itself
    await pool.query(
      `DELETE FROM accounts WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );

    res.status(200).json({ 
      message: 'Account and transactions deleted',
      deletedTransactions: count,
      accountLabel: check.rows[0].name
    });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ 
      error: 'Failed to delete account',
      message: err.message 
    });
  }
};

/**
 * Get subscription settings for the couple
 * GET /api/transactions/subscriptions/settings
 * Both members of a couple see the same shared subscription settings
 */
const getSubscriptionSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get couple for this user
    const coupleResult = await pool.query(
      `SELECT id, user1_id, user2_id FROM couples WHERE user1_id = $1 OR user2_id = $1 LIMIT 1`,
      [userId]
    );
    
    if (coupleResult.rows.length === 0) {
      // No couple, return user-specific settings (fallback)
      const result = await pool.query(
        'SELECT * FROM subscription_settings WHERE user_id = $1',
        [userId]
      );
      return res.status(200).json({ settings: result.rows });
    }
    
    const couple = coupleResult.rows[0];
    
    // Get all subscription settings for this couple (shared between both members)
    const result = await pool.query(
      `SELECT ss.*, u.first_name as payer_name
       FROM subscription_settings ss
       LEFT JOIN users u ON ss.payer_user_id = u.id
       WHERE ss.couple_id = $1`,
      [couple.id]
    );
    
    res.status(200).json({ 
      settings: result.rows,
      currentUserId: userId
    });
  } catch (err) {
    console.error('Get subscription settings error:', err);
    res.status(500).json({ error: 'Failed to get subscription settings' });
  }
};

/**
 * Update subscription setting (shared/individual + frequency)
 * PUT /api/transactions/subscriptions/settings
 * Now works at couple level - both members see the same settings
 */
const updateSubscriptionSetting = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { label, amount, isShared, frequency } = req.body;
    
    // Get couple for this user
    const coupleResult = await pool.query(
      `SELECT id, user1_id, user2_id FROM couples WHERE user1_id = $1 OR user2_id = $1 LIMIT 1`,
      [userId]
    );
    
    if (coupleResult.rows.length === 0) {
      return res.status(400).json({ error: 'User is not part of a couple' });
    }
    
    const couple = coupleResult.rows[0];
    
    // Normalize values
    const normalizedIsShared = isShared === true || isShared === 'true';
    const normalizedFrequency = frequency || 'monthly';
    
    console.log('Saving subscription setting:', { coupleId: couple.id, label, amount, isShared: normalizedIsShared, frequency: normalizedFrequency, payerUserId: userId });
    
    // Upsert the setting at couple level
    // The payer_user_id is set to the user who makes the change (who has this subscription on their account)
    const result = await pool.query(`
      INSERT INTO subscription_settings (couple_id, user_id, payer_user_id, label, amount, is_shared, frequency, i_pay, updated_at)
      VALUES ($1, $2, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)
      ON CONFLICT (couple_id, label, amount) 
      DO UPDATE SET is_shared = $5, 
                    frequency = $6,
                    updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [couple.id, userId, label, Math.abs(amount), normalizedIsShared, normalizedFrequency]);
    
    console.log('Saved setting:', result.rows[0]);
    
    res.status(200).json({ setting: result.rows[0] });
  } catch (err) {
    console.error('Update subscription setting error:', err);
    res.status(500).json({ error: 'Failed to update subscription setting' });
  }
};

/**
 * Update category for all transactions of a subscription
 * PUT /api/transactions/subscriptions/category
 */
const updateSubscriptionCategory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionIds, category } = req.body;
    
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'Transaction IDs required' });
    }
    
    // Update category for all specified transactions
    const result = await pool.query(`
      UPDATE transactions 
      SET category = $1
      WHERE id = ANY($2::int[]) AND user_id = $3
      RETURNING id
    `, [category, transactionIds, userId]);
    
    res.status(200).json({ 
      updated: result.rowCount,
      message: `${result.rowCount} transaction(s) mise(s) à jour`
    });
  } catch (err) {
    console.error('Update subscription category error:', err);
    res.status(500).json({ error: 'Failed to update subscription category' });
  }
};

module.exports = {
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
  updateSubscriptionCategory
};
