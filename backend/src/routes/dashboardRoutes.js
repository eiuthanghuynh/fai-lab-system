const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, checkPermission } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

// Requires VIEW_DASHBOARD permission
router.get('/stats', checkPermission('VIEW_DASHBOARD'), dashboardController.getDashboardStats);

module.exports = router;
