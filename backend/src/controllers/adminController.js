const pool = require('../config/database');

/**
 * Get all users (admin only)
 */
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.is_admin,
        u.created_at,
        u.totp_enabled,
        u.country,
        u.city,
        u.region,
        c.id as couple_id,
        CASE 
          WHEN c.id IS NOT NULL THEN true 
          ELSE false 
        END as is_in_couple
      FROM users u
      LEFT JOIN couples c ON u.id = c.user1_id OR u.id = c.user2_id
      ORDER BY u.created_at DESC
    `);
    
    res.json({
      users: result.rows,
      total: result.rows.length
    });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch users'
    });
  }
};

/**
 * Get admin stats overview
 */
const getStats = async (req, res) => {
  try {
    // Total users
    const usersResult = await pool.query('SELECT COUNT(*) as total FROM users');
    const totalUsers = parseInt(usersResult.rows[0].total);
    
    // Users in couples
    const couplesResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as in_couple FROM (
        SELECT user1_id as user_id FROM couples
        UNION
        SELECT user2_id as user_id FROM couples
      ) as coupled_users
    `);
    const usersInCouple = parseInt(couplesResult.rows[0].in_couple);
    
    // Total couples
    const totalCouplesResult = await pool.query('SELECT COUNT(*) as total FROM couples');
    const totalCouples = parseInt(totalCouplesResult.rows[0].total);
    
    // Admin count
    const adminsResult = await pool.query('SELECT COUNT(*) as total FROM users WHERE is_admin = true');
    const totalAdmins = parseInt(adminsResult.rows[0].total);
    
    // Bank accounts by bank (most used banks)
    const banksResult = await pool.query(`
      SELECT 
        bank_name,
        COUNT(*) as count
      FROM accounts
      WHERE bank_name IS NOT NULL AND bank_name != ''
      GROUP BY bank_name
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Recent registrations (last 30 days)
    const recentUsersResult = await pool.query(`
      SELECT COUNT(*) as total 
      FROM users 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    const recentUsers = parseInt(recentUsersResult.rows[0].total);
    
    // Transactions stats
    const transactionsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as total_expenses,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income
      FROM transactions
    `);
    
    // 2FA adoption rate
    const twoFAResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE totp_enabled = true) as with_2fa,
        COUNT(*) as total
      FROM users
    `);
    
    // Location stats - users by country
    const locationResult = await pool.query(`
      SELECT 
        COALESCE(country, 'Non renseigné') as country,
        COUNT(*) as count
      FROM users
      GROUP BY country
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Users by city (top 10)
    const cityResult = await pool.query(`
      SELECT 
        COALESCE(city, 'Non renseigné') as city,
        COALESCE(country, '') as country,
        COUNT(*) as count
      FROM users
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city, country
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Age statistics
    const ageResult = await pool.query(`
      SELECT age_range, count FROM (
        SELECT 
          CASE 
            WHEN birth_date IS NULL THEN 'Non renseigné'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 18 THEN 'Moins de 18 ans'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) BETWEEN 18 AND 24 THEN '18-24 ans'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) BETWEEN 25 AND 34 THEN '25-34 ans'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) BETWEEN 35 AND 44 THEN '35-44 ans'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) BETWEEN 45 AND 54 THEN '45-54 ans'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) BETWEEN 55 AND 64 THEN '55-64 ans'
            ELSE '65 ans et plus'
          END as age_range,
          COUNT(*) as count
        FROM users
        GROUP BY 1
      ) sub
      ORDER BY 
        CASE age_range
          WHEN 'Moins de 18 ans' THEN 1
          WHEN '18-24 ans' THEN 2
          WHEN '25-34 ans' THEN 3
          WHEN '35-44 ans' THEN 4
          WHEN '45-54 ans' THEN 5
          WHEN '55-64 ans' THEN 6
          WHEN '65 ans et plus' THEN 7
          ELSE 8
        END
    `);
    
    // Average age
    const avgAgeResult = await pool.query(`
      SELECT ROUND(AVG(EXTRACT(YEAR FROM AGE(birth_date)))) as avg_age
      FROM users
      WHERE birth_date IS NOT NULL
    `);
    
    // Profession statistics
    const professionResult = await pool.query(`
      SELECT 
        COALESCE(profession, 'Non renseigné') as profession,
        COUNT(*) as count
      FROM users
      GROUP BY profession
      ORDER BY count DESC
      LIMIT 10
    `);
    
    res.json({
      users: {
        total: totalUsers,
        inCouple: usersInCouple,
        single: totalUsers - usersInCouple,
        couplePercentage: totalUsers > 0 ? Math.round((usersInCouple / totalUsers) * 100) : 0,
        recentRegistrations: recentUsers,
        admins: totalAdmins
      },
      couples: {
        total: totalCouples
      },
      banks: banksResult.rows.map(b => ({ account_name: b.bank_name, count: b.count })),
      transactions: {
        total: parseInt(transactionsResult.rows[0].total_transactions) || 0,
        totalExpenses: parseFloat(transactionsResult.rows[0].total_expenses) || 0,
        totalIncome: parseFloat(transactionsResult.rows[0].total_income) || 0
      },
      security: {
        twoFAEnabled: parseInt(twoFAResult.rows[0].with_2fa) || 0,
        twoFAPercentage: parseInt(twoFAResult.rows[0].total) > 0 
          ? Math.round((parseInt(twoFAResult.rows[0].with_2fa) / parseInt(twoFAResult.rows[0].total)) * 100) 
          : 0
      },
      locations: {
        byCountry: locationResult.rows,
        byCity: cityResult.rows
      },
      demographics: {
        byAge: ageResult.rows,
        averageAge: parseInt(avgAgeResult.rows[0].avg_age) || null,
        byProfession: professionResult.rows
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch stats'
    });
  }
};

/**
 * Toggle admin status for a user
 */
const toggleAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body;
    
    // Prevent self-demotion
    if (parseInt(userId) === req.user.userId && isAdmin === false) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'You cannot remove your own admin privileges'
      });
    }
    
    const result = await pool.query(
      'UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, email, is_admin',
      [isAdmin, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }
    
    res.json({
      message: `User ${isAdmin ? 'promoted to' : 'removed from'} admin`,
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Toggle admin error:', err);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to update admin status'
    });
  }
};

/**
 * Get user details (admin only)
 */
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.is_admin,
        u.created_at,
        u.updated_at,
        u.totp_enabled,
        c.id as couple_id
      FROM users u
      LEFT JOIN couples c ON u.id = c.user1_id OR u.id = c.user2_id
      WHERE u.id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }
    
    // Get user's bank accounts
    const accountsResult = await pool.query(`
      SELECT id, bank_name as account_name, 
             COALESCE(reference_balance, 0) as balance, 
             created_at
      FROM accounts
      WHERE user_id = $1
    `, [userId]);
    
    // Get transaction count
    const transactionsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE user_id = $1
    `, [userId]);
    
    res.json({
      user: result.rows[0],
      accounts: accountsResult.rows,
      transactionCount: parseInt(transactionsResult.rows[0].count)
    });
  } catch (err) {
    console.error('Get user details error:', err);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch user details'
    });
  }
};

/**
 * Delete a user and all their data (admin only)
 */
const deleteUser = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    
    // Prevent self-deletion
    if (parseInt(userId) === req.user.userId) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'You cannot delete your own account'
      });
    }
    
    // Check if user exists
    const userCheck = await client.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }
    
    const userEmail = userCheck.rows[0].email;
    
    await client.query('BEGIN');
    
    // Delete in order to respect foreign key constraints
    // 1. Delete AI classifications linked to user's transactions
    await client.query(`
      DELETE FROM ai_classifications 
      WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = $1)
    `, [userId]);
    
    // 2. Delete AI learning entries for user's transactions
    await client.query(`
      DELETE FROM ai_learning 
      WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = $1)
    `, [userId]);
    
    // 3. Delete subscription settings
    await client.query('DELETE FROM subscription_settings WHERE user_id = $1', [userId]);
    
    // 4. Delete transactions
    await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
    
    // 5. Delete accounts
    await client.query('DELETE FROM accounts WHERE user_id = $1', [userId]);
    
    // 6. Delete harmonizations where user is debtor or creditor
    await client.query('DELETE FROM harmonizations WHERE debtor_id = $1 OR creditor_id = $1', [userId]);
    
    // 7. Delete couples where user is part of
    await client.query('DELETE FROM couples WHERE user1_id = $1 OR user2_id = $1', [userId]);
    
    // 8. Delete couple invitations
    await client.query('DELETE FROM couple_invitations WHERE inviter_id = $1 OR invitee_id = $1', [userId]);
    
    // 9. Delete pending couple invitations
    await client.query('DELETE FROM pending_couple_invitations WHERE inviter_id = $1 OR invitee_email = $2', [userId, userEmail]);
    
    // 10. Delete user devices
    await client.query('DELETE FROM user_devices WHERE user_id = $1', [userId]);
    
    // 11. Delete password resets
    await client.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
    
    // 12. Delete logs
    await client.query('DELETE FROM logs WHERE user_id = $1', [userId]);
    
    // 12. Delete logs
    await client.query('DELETE FROM logs WHERE user_id = $1', [userId]);
    
    // 13. Finally delete the user
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    
    await client.query('COMMIT');
    
    console.log(`User ${userId} (${userEmail}) deleted by admin ${req.user.userId}`);
    
    res.json({
      message: 'User deleted successfully',
      deletedUserId: parseInt(userId),
      deletedEmail: userEmail
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', err);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to delete user'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getAllUsers,
  getStats,
  toggleAdmin,
  getUserDetails,
  deleteUser
};
