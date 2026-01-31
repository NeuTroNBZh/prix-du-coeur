const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const adminController = require('../controllers/adminController');

// All routes require authentication AND admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// Get all users
router.get('/users', adminController.getAllUsers);

// Get user details
router.get('/users/:userId', adminController.getUserDetails);

// Toggle admin status
router.patch('/users/:userId/admin', adminController.toggleAdmin);

// Delete a user
router.delete('/users/:userId', adminController.deleteUser);

// Get stats overview
router.get('/stats', adminController.getStats);

module.exports = router;
