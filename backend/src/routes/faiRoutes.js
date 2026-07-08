const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const faiController = require('../controllers/faiController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate safe unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 64 * 1024 * 1024 } // 64MB limit
});

router.use(authenticateToken);

router.get('/', faiController.getRequests);
router.get('/inspectors/list', faiController.getInspectors);
router.get('/:id', faiController.getRequestById);
router.delete('/:id', faiController.deleteDraft);
router.post('/upload', upload.array('files'), faiController.uploadFiles);
router.post('/draft', faiController.saveDraft);
router.post('/', faiController.submitRequest);
router.post('/:id/assign', faiController.assignRequest);

module.exports = router;
