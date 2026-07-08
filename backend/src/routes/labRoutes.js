const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const labController = require('../controllers/labController');
const labWorkOrderController = require('../controllers/labWorkOrderController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 64 * 1024 * 1024 }
});

router.use(authenticateToken);

// Request endpoints
router.get('/requests', labController.getRequests);
router.get('/requests/:id', labController.getRequestById);
router.post('/requests/upload', upload.array('files'), labController.uploadFiles);
router.post('/requests/draft', labController.saveDraft);
router.post('/requests', labController.submitRequest);
router.delete('/requests/:id/draft', labController.deleteDraft);
router.post('/requests/:id/assign', labController.assignRequest);

// Work Order endpoints
router.get('/requests/:requestId/work-orders', labWorkOrderController.getByRequestId);
router.post('/requests/:requestId/work-orders', labWorkOrderController.createWorkOrder);
router.post('/work-orders/upload', upload.array('files'), labWorkOrderController.uploadWorkOrderFiles);
router.put('/work-orders/:id/status', labWorkOrderController.updateStatus);

module.exports = router;
