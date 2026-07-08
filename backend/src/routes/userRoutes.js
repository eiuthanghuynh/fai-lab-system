const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, checkPermission } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

// All user management operations require MANAGE_USERS permission
router.use(checkPermission('MANAGE_USERS'));

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.patch('/:id/restore', userController.restoreUser);

module.exports = router;
