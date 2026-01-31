const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const { avatarUpload, handleMulterError } = require('../services/uploadService');
const { 
  register, 
  login, 
  setup2FA, 
  verify2FA, 
  loginWith2FA, 
  forgotPassword, 
  resetPassword,
  getProfile,
  updateProfile,
  uploadProfilePicture,
  changePassword,
  disable2FA,
  verifyEmail,
  resendVerificationEmail,
  resendVerificationEmailPublic,
  enableEmail2FA,
  get2FAStatus,
  checkEmailVerified,
  deleteAccount
} = require('../controllers/authController');

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

// Routes de profil utilisateur
router.get('/profile', authenticateToken, getProfile);
router.patch('/profile', authenticateToken, updateProfile);
router.post('/profile/avatar', authenticateToken, avatarUpload.single('avatar'), handleMulterError, uploadProfilePicture);
router.post('/change-password', authenticateToken, changePassword);
router.post('/2fa/disable', authenticateToken, disable2FA);

// Email verification routes
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', authenticateToken, resendVerificationEmail);
router.post('/resend-verification-public', resetLimiter, resendVerificationEmailPublic);
router.post('/check-email-verified', checkEmailVerified);

// 2FA management routes
router.get('/2fa/status', authenticateToken, get2FAStatus);
router.post('/2fa/enable-email', authenticateToken, enableEmail2FA);

// Account deletion
router.delete('/account', authenticateToken, deleteAccount);

module.exports = router;
