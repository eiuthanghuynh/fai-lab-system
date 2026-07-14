const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticateToken, checkPermission } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

// All role management operations require ADMINISTRATOR permission
router.use(checkPermission('ADMINISTRATOR'));

router.get('/permissions', roleController.getPermissions);
router.get('/', roleController.getRoles);
router.post('/', roleController.createRole);
router.put('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);
router.patch('/:id/restore', roleController.restoreRole);

module.exports = router;
