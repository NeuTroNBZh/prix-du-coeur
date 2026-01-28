const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied',
      message: 'No token provided' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log('Auth OK - userId:', decoded.userId, 'email:', decoded.email);
    next();
  } catch (err) {
    console.error('Auth failed:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please login again' 
      });
    }
    return res.status(403).json({ 
      error: 'Invalid token',
      message: 'Token verification failed' 
    });
  }
};

module.exports = { authenticateToken };
