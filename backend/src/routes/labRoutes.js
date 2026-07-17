const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const labController = require('../controllers/labController');
const labWorkOrderController = require('../controllers/labWorkOrderController');
const { authenticateToken, checkPermission } = require('../middlewares/authMiddleware');

const MinioStorage = require('../config/minioStorage');

const { MINIO_REQUEST_BUCKET, MINIO_REPORT_BUCKET } = require('../config/minioClient');

const requestStorage = MinioStorage({
  bucket: function(req, file, cb) { cb(null, MINIO_REQUEST_BUCKET); }
});

const reportStorage = MinioStorage({
  bucket: function(req, file, cb) { cb(null, MINIO_REPORT_BUCKET); }
});

const uploadRequests = multer({
  storage: requestStorage,
  limits: { fileSize: 128 * 1024 * 1024 }
});

const uploadReports = multer({
  storage: reportStorage,
  limits: { fileSize: 128 * 1024 * 1024 }
});

router.use(authenticateToken);

// Request endpoints
router.get('/inspectors/list', labController.getInspectors);
router.get('/requests', labController.getRequests);
router.get('/requests/:id', labController.getRequestById);
router.post('/requests/upload', uploadRequests.array('files'), labController.uploadFiles);
router.post('/requests/draft', checkPermission('SUBMIT_LAB_REQUEST'), labController.saveDraft);
router.post('/requests', checkPermission('SUBMIT_LAB_REQUEST'), labController.submitRequest);
router.delete('/requests/:id/draft', checkPermission('SUBMIT_LAB_REQUEST'), labController.deleteDraft);
router.post('/requests/:id/assign', checkPermission('ASSIGN_LAB'), labController.assignRequest);
router.post('/requests/:id/start-inspection', checkPermission('INSPECT_LAB'), labController.startInspection);
router.put('/requests/:id/schedule', checkPermission('INSPECT_LAB'), labController.adjustSchedule);

// Work Order endpoints
router.get('/requests/:requestId/work-orders', labWorkOrderController.getByRequestId);
router.post('/requests/:requestId/work-orders/bulk', checkPermission('INSPECT_LAB'), labWorkOrderController.bulkSaveWorkOrders);
router.post('/work-orders/upload', checkPermission('INSPECT_LAB'), uploadReports.array('files'), labWorkOrderController.uploadWorkOrderFiles);

module.exports = router;
