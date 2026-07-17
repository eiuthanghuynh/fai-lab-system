const { minioClient, MINIO_REQUEST_BUCKET } = require('./minioClient');
const path = require('path');
const crypto = require('crypto');

function MinioStorage(opts) {
  this.getBucket = opts.bucket || function(req, file, cb) { cb(null, MINIO_REQUEST_BUCKET); };
  this.getKey = opts.key || function(req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = crypto.randomUUID() + ext;
    cb(null, filename);
  };
}

MinioStorage.prototype._handleFile = function _handleFile(req, file, cb) {
  this.getBucket(req, file, (err, bucket) => {
    if (err) return cb(err);
    
    this.getKey(req, file, (err, filename) => {
      if (err) return cb(err);

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
  });
};

MinioStorage.prototype._removeFile = function _removeFile(req, file, cb) {
  minioClient.removeObject(file.bucket, file.filename, cb);
};

module.exports = function(opts) {
  return new MinioStorage(opts || {});
};
