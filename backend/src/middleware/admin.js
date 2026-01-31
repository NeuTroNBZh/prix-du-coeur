const pool = require('../config/database');

/**
 * Middleware to check if the authenticated user is an admin
 * Must be used after authenticateToken middleware
 */
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }
    
    if (!result.rows[0].is_admin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }
    
    req.user.isAdmin = true;
    next();
  } catch (err) {
    console.error('Admin check error:', err);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to verify admin status'
    });
  }
};

module.exports = { requireAdmin };
