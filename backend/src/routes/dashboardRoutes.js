const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, checkAnyPermission } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

// Requires VIEW_DASHBOARD_FAI or VIEW_DASHBOARD_LAB permission
router.get('/stats', checkAnyPermission(['VIEW_DASHBOARD_FAI', 'VIEW_DASHBOARD_LAB']), dashboardController.getDashboardStats);

module.exports = router;
