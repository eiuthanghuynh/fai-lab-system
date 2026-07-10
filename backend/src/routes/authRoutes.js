const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const rateLimiter = require('../middlewares/rateLimitMiddleware');

// Rate limit: 5 attempts per 2 minutes for login
const loginLimiter = rateLimiter('login', 5, 2 * 60 * 1000, { incrementOnRequest: false });
// Rate limit: 3 attempts per hour for forgot password
const forgotPasswordLimiter = rateLimiter('forgot', 3, 2 * 60 * 1000);

router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.get('/me', authController.me);
router.get('/permissions', authenticateToken, authController.getCurrentPermissions);
router.post('/logout', authenticateToken, authController.logout);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-reset-token', authController.verifyResetToken);

module.exports = router;
