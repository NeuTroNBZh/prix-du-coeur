const crypto = require('crypto');
const pool = require('../config/database');
const ParserFactory = require('../utils/parsers/ParserFactory');
const PdfParserFactory = require('../utils/parsers/PdfParserFactory');
const { isValidId } = require('../utils/validation');
const { encrypt, decrypt, decryptTransactions, isEncrypted, hashLabel } = require('../services/encryptionService');

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
      console.log('📄 PDF file detected, auto-detecting bank...');
      const result = await PdfParserFactory.parsePdf(req.file.buffer);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: 'PDF parsing failed',
          message: result.error 
        });
      }
      
      const response = {
        message: 'PDF analyzed successfully',
        bank: result.bank,
        bankDisplay: result.bankDisplay,
        accounts: result.accounts,
        accountNumber: result.accounts.length > 0 ? result.accounts[0].number : null,
        transactions: result.transactions,
        fileSize: req.file.size,
        isPdf: true
      };
      
      console.log('📤 Sending response with', response.transactions?.length || 0, 'transactions');
      
      return res.status(200).json(response);
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

      // Encrypt sensitive data before storing
      const encryptedLabel = encrypt(tx.label);
      const labelHash = hashLabel(tx.label);

      // Insert transaction with encrypted label and hash for grouping
      await client.query(
        `INSERT INTO transactions 
         (couple_id, user_id, account_id, date, amount, label, label_hash, category, csv_checksum)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [coupleId, userId, accountId, tx.date, tx.amount, encryptedLabel, labelHash, tx.category || 'Autre', checksum]
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
      `SELECT a.id, a.bank_name, a.account_number, COALESCE(a.account_label, a.name) AS account_label, 
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
             t.account_id, COALESCE(a.account_label, a.name) AS account_label, a.bank_name
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

    // Decrypt labels before sending to client
    const decryptedTransactions = decryptTransactions(result.rows);

    res.status(200).json({
      transactions: decryptedTransactions,
      count: decryptedTransactions.length
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
    const { amount, label, category, date, type, isRecurring, accountId } = req.body;

    if (!amount || !label) {
      return res.status(400).json({ error: 'Amount and label are required' });
    }

    // Get user's couple
    const coupleResult = await pool.query(
      `SELECT id FROM couples WHERE user1_id = $1 OR user2_id = $1 LIMIT 1`,
      [userId]
    );

    const coupleId = coupleResult.rows.length > 0 ? coupleResult.rows[0].id : null;

    // Get account - use provided accountId or default to first account
    let finalAccountId;
    if (accountId) {
      // Verify the account belongs to this user
      const accountCheck = await pool.query(
        `SELECT id FROM accounts WHERE id = $1 AND user_id = $2`,
        [accountId, userId]
      );
      if (accountCheck.rows.length > 0) {
        finalAccountId = accountId;
      }
    }
    
    if (!finalAccountId) {
      // Get or create default account
      let accountResult = await pool.query(
        `SELECT id FROM accounts WHERE user_id = $1 LIMIT 1`,
        [userId]
      );

      if (accountResult.rows.length === 0) {
        const newAccount = await pool.query(
          `INSERT INTO accounts (user_id, bank_name, account_number, name)
           VALUES ($1, 'Manuel', 'manual', 'Dépenses manuelles')
           RETURNING id`,
          [userId]
        );
        finalAccountId = newAccount.rows[0].id;
      } else {
        finalAccountId = accountResult.rows[0].id;
      }
    }

    // Insert transaction with encrypted label and hash for grouping
    const encryptedLabel = encrypt(label);
    const labelHash = hashLabel(label);
    const result = await pool.query(
      `INSERT INTO transactions 
       (couple_id, user_id, account_id, date, amount, label, label_hash, category, type, is_recurring)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, date, amount, label, category, type, is_recurring`,
      [
        coupleId, 
        userId, 
        finalAccountId, 
        date || new Date().toISOString().split('T')[0], 
        parseFloat(amount),
        encryptedLabel,
        labelHash,
        category || 'Autre',
        type || 'individuelle',
        isRecurring || false
      ]
    );

    // Decrypt label before returning to client
    const transaction = result.rows[0];
    transaction.label = decrypt(transaction.label);

    res.status(201).json({
      message: 'Transaction created',
      transaction: transaction
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

    // Validate ID parameter to prevent injection
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }

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

    // Validate ID parameter
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }

    if (!label || label.trim().length === 0) {
      return res.status(400).json({ error: 'Label is required' });
    }

    // Sanitize label - limit length and remove potential XSS
    const sanitizedLabel = label.trim().substring(0, 500);

    // Check ownership
    const check = await pool.query(
      `SELECT id FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Encrypt the label and generate hash before storing
    const encryptedLabel = encrypt(sanitizedLabel);
    const labelHash = hashLabel(sanitizedLabel);

    await pool.query(
      `UPDATE transactions SET label = $1, label_hash = $2 WHERE id = $3`,
      [encryptedLabel, labelHash, id]
    );

    res.status(200).json({ message: 'Label updated', label: sanitizedLabel });
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

    // Validate ID parameter
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }

    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Validate amount range (reasonable limits)
    if (parsedAmount < -1000000 || parsedAmount > 1000000) {
      return res.status(400).json({ error: 'Amount out of valid range' });
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

    // Validate ID parameter
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }

    if (!type || !['commune', 'individuelle', 'abonnement', 'virement_interne'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    // Validate ratio if provided
    if (ratio !== undefined) {
      const parsedRatio = parseFloat(ratio);
      if (isNaN(parsedRatio) || parsedRatio < 0 || parsedRatio > 1) {
        return res.status(400).json({ error: 'Ratio must be between 0 and 1' });
      }
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

    // Build byCategory array for frontend (same format as filteredAnalytics)
    const byCategory = categoryResult.rows.map(row => ({
      category: row.category,
      total: parseFloat(row.total),
      count: parseInt(row.count)
    }));

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

    // Get ALL transactions marked as recurring (is_recurring = true)
    // This includes subscriptions, rent, school payments, etc.
    const allSubsQuery = `
      SELECT 
        id,
        label,
        ABS(amount) as amount,
        category,
        type,
        date,
        is_recurring
      FROM transactions
      WHERE user_id = $1 
        AND amount < 0 
        AND is_recurring = true
      ORDER BY date DESC
    `;
    const allSubsResult = await pool.query(allSubsQuery, [userId]);
    // Decrypt labels from subscription transactions
    const decryptedAllSubs = decryptTransactions(allSubsResult.rows);

    // Also get recurring by exact label match (old method, for non-subscription recurring)
    // Only include transactions where is_recurring is NOT explicitly set to false
    const exactMatchQuery = `
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
        WHERE user_id = $1 AND amount < 0 AND type != 'abonnement' AND category != 'Abonnements'
          AND (is_recurring IS NULL OR is_recurring = true)
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
    const exactMatchResult = await pool.query(exactMatchQuery, [userId]);

    // Get subscription settings to use user-configured frequency
    let subscriptionSettingsMap = {};
    let coupleId = null;
    try {
      const coupleResult = await pool.query(
        `SELECT id FROM couples WHERE user1_id = $1 OR user2_id = $1 LIMIT 1`,
        [userId]
      );
      if (coupleResult.rows.length > 0) {
        coupleId = coupleResult.rows[0].id;
        const settingsResult = await pool.query(
          `SELECT label, amount, frequency FROM subscription_settings WHERE couple_id = $1`,
          [coupleId]
        );
        settingsResult.rows.forEach(s => {
          const key = `${s.label}_${parseFloat(s.amount)}`;
          subscriptionSettingsMap[key] = s;
        });
      }
    } catch (e) {
      console.error('Error fetching subscription settings:', e);
    }

    // Helper to normalize label for grouping (remove variable parts like reference numbers)
    const normalizeLabel = (label) => {
      // Remove common variable suffixes (reference numbers, dates, etc.)
      let normalized = label
        // Date ranges: "24-09-2025 / 21-10-2025" at end
        .replace(/\s*\d{2}-\d{2}-\d{4}\s*\/\s*\d{2}-\d{2}-\d{4}$/i, '')
        // PayPal: "PRLV SEPA PAYPAL EUROPE S A R L 1047266057968" -> "PRLV SEPA PAYPAL EUROPE S A R L"
        .replace(/\s+\d{10,}.*$/i, '')  // Remove 10+ digit sequences at end (PayPal refs)
        // Basic Fit: "BASIC FIT FRANCE NO676006827-0152 2" -> "BASIC FIT FRANCE"
        .replace(/\s+NO\d+[-/]?\d*\s*\d*$/i, '')  // Remove "NO123456-0152 2" patterns
        // Amazon: "AMAZON EU SARL SUCCU D01-5206223-03" -> "AMAZON EU SARL SUCCU"
        .replace(/\s+[A-Z]\d{2}-\d+[-/]?\d*$/i, '')  // Remove "D01-12345-03" patterns
        // Pathé: "PATHE CINEPASS XST7PQ53CV39DJX3 PAT" -> "PATHE CINEPASS"
        .replace(/\s+[A-Z0-9]{12,}.*$/i, '')  // Remove 12+ char alphanumeric codes and what follows
        // General alphanumeric codes
        .replace(/\s+[A-Z0-9]{10,}$/i, '')  // Remove 10+ char alphanumeric codes at end
        // General number cleanup
        .replace(/\s+\d{6,}$/i, '')  // Remove 6+ digit numbers at end
        // Remove trailing spaces and numbers
        .trim()
        .replace(/\s+\d+\s*$/i, '')
        .trim();
      return normalized || label;
    };

    // Group subscription transactions by normalized label + similar amount
    const subsGroups = {};
    decryptedAllSubs.forEach(tx => {
      const normalizedLabel = normalizeLabel(tx.label);
      const amount = parseFloat(tx.amount);
      
      // Find existing group with similar label and amount (within 10% or 2€)
      let foundGroup = null;
      for (const key of Object.keys(subsGroups)) {
        const group = subsGroups[key];
        const labelMatch = group.normalizedLabel === normalizedLabel;
        const amountDiff = Math.abs(group.amount - amount);
        const percentDiff = amountDiff / Math.max(group.amount, amount);
        const amountMatch = percentDiff < 0.15 || amountDiff < 2.0;
        
        if (labelMatch && amountMatch) {
          foundGroup = key;
          break;
        }
      }
      
      if (foundGroup) {
        const group = subsGroups[foundGroup];
        group.transactions.push(tx);
        group.transactionIds.push(tx.id);
        // Update amount to average
        group.totalAmount += amount;
        group.amount = group.totalAmount / group.transactions.length;
        // Update dates
        const txDate = new Date(tx.date);
        if (txDate > new Date(group.lastDate)) {
          group.lastDate = tx.date;
          group.label = tx.label; // Use most recent label
        }
        if (txDate < new Date(group.firstDate)) {
          group.firstDate = tx.date;
        }
      } else {
        // Create new group
        const key = `${normalizedLabel}_${Math.round(amount)}`;
        subsGroups[key] = {
          label: tx.label,
          normalizedLabel,
          amount,
          totalAmount: amount,
          category: tx.category || 'Abonnements',
          transactions: [tx],
          transactionIds: [tx.id],
          firstDate: tx.date,
          lastDate: tx.date
        };
      }
    });

    // Helper to check if subscription is active based on frequency
    const checkIsActive = (lastDate, frequency) => {
      const now = new Date();
      const lastPayment = new Date(lastDate);
      const daysSinceLast = Math.floor((now - lastPayment) / (1000 * 60 * 60 * 24));
      
      switch (frequency) {
        case 'monthly':
        case 'manual':
          return daysSinceLast <= 60; // 2 months grace period
        case 'weekly':
          return daysSinceLast <= 21; // 3 weeks
        case 'quarterly':
          return daysSinceLast <= 120; // 4 months
        case 'semiannual':
          return daysSinceLast <= 210; // 7 months
        case 'yearly':
          return daysSinceLast <= 400; // 13 months
        default:
          return daysSinceLast <= 60;
      }
    };

    // Convert groups to subscription objects
    const subscriptionsFromType = Object.values(subsGroups).map(group => {
      const occurrences = group.transactions.length;
      const firstDate = new Date(group.firstDate);
      const lastDate = new Date(group.lastDate);
      
      // Detect frequency from occurrences
      let detectedFrequency = 'manual';
      if (occurrences >= 2) {
        const totalDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
        const avgDays = totalDays / (occurrences - 1);
        
        if (avgDays >= 25 && avgDays <= 35) detectedFrequency = 'monthly';
        else if (avgDays >= 6 && avgDays <= 8) detectedFrequency = 'weekly';
        else if (avgDays >= 85 && avgDays <= 100) detectedFrequency = 'quarterly';
        else if (avgDays >= 175 && avgDays <= 195) detectedFrequency = 'semiannual';
        else if (avgDays >= 350 && avgDays <= 380) detectedFrequency = 'yearly';
      }
      
      // Check for user-configured frequency
      const key = `${group.label}_${group.amount}`;
      const userSettings = subscriptionSettingsMap[key];
      const effectiveFrequency = userSettings?.frequency || detectedFrequency;
      
      // Calculate avg day of month
      const daysOfMonth = group.transactions.map(t => new Date(t.date).getDate());
      const avgDayOfMonth = Math.round(daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length);
      
      return {
        label: group.label,
        amount: parseFloat(group.amount.toFixed(2)),
        category: group.category,
        occurrences,
        frequency: effectiveFrequency,
        detectedFrequency,
        avgDayOfMonth,
        firstDate: group.firstDate,
        lastDate: group.lastDate,
        transactionIds: group.transactionIds,
        isActive: checkIsActive(group.lastDate, effectiveFrequency),
        isFromSubscriptionType: true
      };
    });

    // Process exact-match recurring (non-subscription type)
    const exactMatchRecurring = exactMatchResult.rows.map(row => {
      const avgDays = row.avg_interval_days;
      let detectedFrequency = 'irregular';
      let nextExpectedDate = null;
      const lastDate = new Date(row.last_date);

      if (avgDays) {
        if (avgDays >= 25 && avgDays <= 35) detectedFrequency = 'monthly';
        else if (avgDays >= 6 && avgDays <= 8) detectedFrequency = 'weekly';
        else if (avgDays >= 85 && avgDays <= 100) detectedFrequency = 'quarterly';
        else if (avgDays >= 175 && avgDays <= 195) detectedFrequency = 'semiannual';
        else if (avgDays >= 350 && avgDays <= 380) detectedFrequency = 'yearly';

        nextExpectedDate = new Date(lastDate.getTime() + (avgDays * 24 * 60 * 60 * 1000));
      }

      const key = `${row.label}_${parseFloat(row.amount)}`;
      const userSettings = subscriptionSettingsMap[key];
      const effectiveFrequency = userSettings?.frequency || detectedFrequency;
      const daysOfMonth = row.dates.map(d => new Date(d).getDate());
      const avgDayOfMonth = Math.round(daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length);

      return {
        label: row.label,
        amount: parseFloat(row.amount),
        category: row.category,
        occurrences: row.occurrence_count,
        frequency: effectiveFrequency,
        detectedFrequency,
        avgIntervalDays: avgDays,
        avgDayOfMonth,
        firstDate: row.first_date,
        lastDate: row.last_date,
        nextExpected: nextExpectedDate,
        transactionIds: row.ids,
        isActive: checkIsActive(row.last_date, effectiveFrequency)
      };
    });

    // Combine all subscriptions
    const allSubscriptions = [...subscriptionsFromType, ...exactMatchRecurring];

    // Filter: exclude generic labels
    const genericLabels = ['virement émis', 'virement recu', 'virement reçu', 'virement vers', 'retrait', 'paiement'];
    const filteredSubscriptions = allSubscriptions.filter(r => {
      const isGeneric = genericLabels.some(g => r.label.toLowerCase().includes(g));
      return !isGeneric;
    });

    // Separate active and inactive
    const activeRecurring = filteredSubscriptions.filter(r => r.isActive);
    const expiredSubscriptions = filteredSubscriptions.filter(r => !r.isActive);

    // Get shared subscriptions from partner
    let partnerSharedSubscriptions = [];
    try {
      if (coupleId) {
        const coupleResult = await pool.query(
          `SELECT user1_id, user2_id FROM couples WHERE id = $1`,
          [coupleId]
        );
        
        if (coupleResult.rows.length > 0) {
          const couple = coupleResult.rows[0];
          const partnerId = couple.user1_id === userId ? couple.user2_id : couple.user1_id;
          
          const sharedQuery = `
            SELECT ss.label, ss.amount, ss.frequency, ss.payer_user_id, u.first_name as payer_name
            FROM subscription_settings ss
            LEFT JOIN users u ON ss.payer_user_id = u.id
            WHERE ss.couple_id = $1 
              AND ss.is_shared = true 
              AND ss.payer_user_id = $2
          `;
          const sharedResult = await pool.query(sharedQuery, [coupleId, partnerId]);
          
          partnerSharedSubscriptions = sharedResult.rows.map(row => ({
            label: row.label,
            amount: parseFloat(row.amount),
            category: 'Abonnements',
            occurrences: 0,
            frequency: row.frequency || 'monthly',
            avgDayOfMonth: 15,
            firstDate: null,
            lastDate: null,
            nextExpected: null,
            transactionIds: [],
            isActive: true,
            isFromPartner: true,
            payerName: row.payer_name
          }));
        }
      }
    } catch (partnerErr) {
      console.error('Error fetching partner subscriptions:', partnerErr);
    }

    // Final merge to avoid duplicates
    const finalRecurring = [];
    for (const sub of activeRecurring) {
      const existing = finalRecurring.find(m => {
        const normalizedExisting = normalizeLabel(m.label);
        const normalizedSub = normalizeLabel(sub.label);
        if (normalizedExisting !== normalizedSub) return false;
        const amountDiff = Math.abs(m.amount - sub.amount);
        const percentDiff = amountDiff / Math.max(m.amount, sub.amount);
        return percentDiff < 0.15 || amountDiff < 2.0;
      });
      
      if (existing) {
        // Keep the one with more occurrences
        if (sub.occurrences > existing.occurrences) {
          Object.assign(existing, sub);
        } else if (new Date(sub.lastDate) > new Date(existing.lastDate)) {
          existing.lastDate = sub.lastDate;
        }
      } else {
        finalRecurring.push({ ...sub });
      }
    }
    
    // Add partner subscriptions (avoid duplicates)
    partnerSharedSubscriptions.forEach(ps => {
      const exists = finalRecurring.some(r => {
        const normalizedR = normalizeLabel(r.label);
        const normalizedPs = normalizeLabel(ps.label);
        if (normalizedR !== normalizedPs) return false;
        const amountDiff = Math.abs(r.amount - ps.amount);
        const percentDiff = amountDiff / Math.max(r.amount, ps.amount);
        return percentDiff < 0.15 || amountDiff < 2.0;
      });
      if (!exists) {
        finalRecurring.push(ps);
      }
    });

    res.status(200).json({
      recurring: finalRecurring,
      expiredSubscriptions: expiredSubscriptions,
      possibleRecurring: []
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

/**
 * Rename an account
 * PUT /api/transactions/accounts/:accountId/name
 */
const renameAccount = async (req, res) => {
  const userId = req.user.userId;
  const { accountId } = req.params;
  const { name } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE accounts SET account_label = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [name.trim(), accountId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ 
      message: 'Account renamed successfully',
      account: result.rows[0]
    });
  } catch (err) {
    console.error('Rename account error:', err);
    res.status(500).json({ error: 'Failed to rename account' });
  }
};

/**
 * Toggle is_recurring status of a transaction
 * PATCH /api/transactions/:id/recurring
 */
const toggleRecurring = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { isRecurring } = req.body;

    // Verify ownership and update
    const result = await pool.query(
      `UPDATE transactions 
       SET is_recurring = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, label, is_recurring`,
      [isRecurring, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Decrypt label before returning
    const transaction = result.rows[0];
    transaction.label = decrypt(transaction.label);

    res.status(200).json({
      message: 'Recurring status updated',
      transaction: transaction
    });
  } catch (err) {
    console.error('Toggle recurring error:', err);
    res.status(500).json({ error: 'Failed to update recurring status' });
  }
};

/**
 * Dismiss a subscription (mark all transactions with this label as NOT recurring)
 * POST /api/transactions/subscriptions/dismiss
 */
const dismissSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { label } = req.body;

    if (!label) {
      return res.status(400).json({ error: 'Label is required' });
    }

    // Use label_hash for matching instead of plain text comparison
    const labelHash = hashLabel(label);

    // Mark all transactions with this label_hash as NOT recurring
    const updateResult = await pool.query(
      `UPDATE transactions 
       SET is_recurring = false
       WHERE user_id = $1 AND label_hash = $2
       RETURNING id`,
      [userId, labelHash]
    );

    console.log(`Subscription dismissed: "${label}" for user ${userId}, ${updateResult.rowCount} transactions updated`);

    res.status(200).json({
      message: 'Marqué comme non récurrent',
      updatedTransactions: updateResult.rowCount,
      label: label
    });
  } catch (err) {
    console.error('Dismiss subscription error:', err);
    res.status(500).json({ error: 'Failed to dismiss subscription' });
  }
};

/**
 * Restore a subscription (mark all transactions with this label as recurring)
 * DELETE /api/transactions/subscriptions/dismiss
 */
const restoreSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { label } = req.body;

    if (!label) {
      return res.status(400).json({ error: 'Label is required' });
    }

    // Use label_hash for matching instead of plain text comparison
    const labelHash = hashLabel(label);

    // Mark all transactions with this label_hash as recurring again
    const updateResult = await pool.query(
      `UPDATE transactions 
       SET is_recurring = true
       WHERE user_id = $1 AND label_hash = $2
       RETURNING id`,
      [userId, labelHash]
    );

    console.log(`Subscription restored: "${label}" for user ${userId}, ${updateResult.rowCount} transactions updated`);

    res.status(200).json({
      message: 'Abonnement restauré',
      updatedTransactions: updateResult.rowCount,
      label: label
    });
  } catch (err) {
    console.error('Restore subscription error:', err);
    res.status(500).json({ error: 'Failed to restore subscription' });
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
  updateSubscriptionCategory,
  renameAccount,
  toggleRecurring,
  dismissSubscription,
  restoreSubscription
};
