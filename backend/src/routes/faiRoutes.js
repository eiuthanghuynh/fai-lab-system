const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const faiController = require('../controllers/faiController');
const { authenticateToken, checkPermission } = require('../middlewares/authMiddleware');

const MinioStorage = require('../config/minioStorage');

// Multer Storage Configuration
const storage = MinioStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 128 * 1024 * 1024 } // 128MB limit
});

router.use(authenticateToken);

const faiReportController = require('../controllers/faiReportController');

router.get('/', faiController.getRequests);
router.get('/inspectors/list', faiController.getInspectors);
router.get('/:id', faiController.getRequestById);
router.get('/:id/report', faiReportController.getReport);
router.delete('/:id', checkPermission('SUBMIT_FAI_REQUEST'), faiController.deleteDraft);
router.post('/upload', upload.array('files'), faiController.uploadFiles);
router.post('/draft', checkPermission('SUBMIT_FAI_REQUEST'), faiController.saveDraft);
router.post('/', checkPermission('SUBMIT_FAI_REQUEST'), faiController.submitRequest);
router.post('/:id/assign', checkPermission('ASSIGN_FAI'), faiController.assignRequest);
router.post('/:id/report/draft', checkPermission('INSPECT_FAI'), faiReportController.saveDraftReport);
router.post('/:id/report/submit', checkPermission('INSPECT_FAI'), faiReportController.submitReport);
router.post('/:id/report/export-pdf', faiReportController.exportPdf);

module.exports = router;
