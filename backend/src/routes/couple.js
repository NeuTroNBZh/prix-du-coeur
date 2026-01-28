const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getCoupleStatus,
  invitePartner,
  acceptInvitation,
  leaveCouple
} = require('../controllers/coupleController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get couple status
router.get('/', getCoupleStatus);

// Invite a partner
router.post('/invite', invitePartner);

// Accept invitation
router.post('/accept', acceptInvitation);

// Leave couple
router.delete('/leave', leaveCouple);

module.exports = router;
