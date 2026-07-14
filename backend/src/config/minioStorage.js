const { minioClient, MINIO_BUCKET } = require('./minioClient');
const path = require('path');

function MinioStorage(opts) {
  this.getBucket = opts.bucket || function(req, file, cb) { cb(null, MINIO_BUCKET); };
}

MinioStorage.prototype._handleFile = function _handleFile(req, file, cb) {
  this.getBucket(req, file, (err, bucket) => {
    if (err) return cb(err);
    
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    
    // Stream directly to MinIO
    minioClient.putObject(bucket, filename, file.stream, undefined, {
      'Content-Type': file.mimetype
    }, (err, etag) => {
      if (err) return cb(err);
      
      // Pass back info to multer so req.file is populated
      cb(null, {
        bucket: bucket,
        filename: filename,
        originalname: file.originalname,
        mimetype: file.mimetype
      });
    });
  });
};

MinioStorage.prototype._removeFile = function _removeFile(req, file, cb) {
  minioClient.removeObject(file.bucket, file.filename, cb);
};

module.exports = function(opts) {
  return new MinioStorage(opts || {});
};
