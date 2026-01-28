const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const { register, login, setup2FA, verify2FA, loginWith2FA, forgotPassword, resetPassword } = require('../controllers/authController');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests', message: 'Please try again later' }
});

// Limiter plus strict pour les demandes de réinitialisation
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // Max 5 demandes par heure
  message: { error: 'Trop de demandes', message: 'Veuillez réessayer plus tard' }
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/login/2fa', authLimiter, loginWith2FA);
router.post('/2fa/setup', authenticateToken, setup2FA);
router.post('/2fa/verify', authenticateToken, verify2FA);

// Routes de réinitialisation de mot de passe
router.post('/forgot-password', resetLimiter, forgotPassword);
router.post('/reset-password', resetLimiter, resetPassword);

module.exports = router;
