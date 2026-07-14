const express = require('express');
const router = express.Router();
const controller = require('../controllers/commodityPartController');
const { authenticateToken, checkPermission } = require('../middlewares/authMiddleware');

router.use(authenticateToken);
router.get('/', controller.getAll);
router.post('/', checkPermission('ADMINISTRATOR'), controller.create);
router.put('/:id', checkPermission('ADMINISTRATOR'), controller.update);
router.delete('/:id', checkPermission('ADMINISTRATOR'), controller.delete);

module.exports = router;
