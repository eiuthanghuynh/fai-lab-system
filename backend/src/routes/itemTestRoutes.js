const express = require('express');
const router = express.Router();
const itemTestController = require('../controllers/itemTestController');
const { authenticateToken, checkPermission } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

// Publicly readable for active users
router.get('/list', itemTestController.getActiveList);
router.get('/', itemTestController.getAll);
router.get('/:id', itemTestController.getById);

// Admin / specific permission required for modifying
router.post('/', checkPermission('ADMINISTRATOR'), itemTestController.create);
router.put('/:id', checkPermission('ADMINISTRATOR'), itemTestController.update);
router.delete('/:id', checkPermission('ADMINISTRATOR'), itemTestController.deleteItem);

module.exports = router;
