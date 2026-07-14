const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const labController = require('../controllers/labController');
const labWorkOrderController = require('../controllers/labWorkOrderController');
const { authenticateToken, checkPermission } = require('../middlewares/authMiddleware');

const MinioStorage = require('../config/minioStorage');

const storage = MinioStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 128 * 1024 * 1024 }
});

router.use(authenticateToken);

// Request endpoints
router.get('/inspectors/list', labController.getInspectors);
router.get('/requests', labController.getRequests);
router.get('/requests/:id', labController.getRequestById);
router.post('/requests/upload', upload.array('files'), labController.uploadFiles);
router.post('/requests/draft', checkPermission('SUBMIT_LAB_REQUEST'), labController.saveDraft);
router.post('/requests', checkPermission('SUBMIT_LAB_REQUEST'), labController.submitRequest);
router.delete('/requests/:id/draft', checkPermission('SUBMIT_LAB_REQUEST'), labController.deleteDraft);
router.post('/requests/:id/assign', checkPermission('ASSIGN_LAB'), labController.assignRequest);

// Work Order endpoints
router.get('/requests/:requestId/work-orders', labWorkOrderController.getByRequestId);
router.post('/requests/:requestId/work-orders', labWorkOrderController.createWorkOrder);
router.post('/work-orders/upload', upload.array('files'), labWorkOrderController.uploadWorkOrderFiles);
router.put('/work-orders/:id/status', labWorkOrderController.updateStatus);

module.exports = router;
