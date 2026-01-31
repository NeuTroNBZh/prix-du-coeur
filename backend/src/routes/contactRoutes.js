/**
 * Contact Routes
 * Public routes for contact form
 */

const express = require('express');
const router = express.Router();
const { submitContact } = require('../controllers/contactController');
const rateLimit = require('express-rate-limit');

// Rate limiting for contact form (5 requests per hour per IP)
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Trop de messages envoyés. Veuillez réessayer dans une heure.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/contact - Submit contact form
router.post('/', contactLimiter, submitContact);

module.exports = router;
