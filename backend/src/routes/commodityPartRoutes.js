const express = require('express');
const router = express.Router();
const controller = require('../controllers/commodityPartController');
const { authenticateToken, checkPermission } = require('../middlewares/authMiddleware');

router.use(authenticateToken);
// Require MANAGE_ROLES (or equivalent admin permission)
// router.use(checkPermission('MANAGE_ROLES'));

router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
