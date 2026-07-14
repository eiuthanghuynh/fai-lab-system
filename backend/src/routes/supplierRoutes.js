const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticateToken, checkPermission } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.get('/', supplierController.getAll);
router.post('/', checkPermission('ADMINISTRATOR'), supplierController.create);
router.put('/:id', checkPermission('ADMINISTRATOR'), supplierController.update);
router.delete('/:id', checkPermission('ADMINISTRATOR'), supplierController.delete);

module.exports = router;
