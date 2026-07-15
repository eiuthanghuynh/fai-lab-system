const Minio = require('minio');

const useSSL = process.env.MINIO_USE_SSL === 'true';
const port = process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : undefined;

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port,
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY
});

const minioClientPublic = new Minio.Client({
  endPoint: process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT || 'localhost',
  port,
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  region: process.env.MINIO_REGION || 'us-east-1'
});

const MINIO_BUCKET = process.env.MINIO_BUCKET;

module.exports = {
  minioClient,
  minioClientPublic,
  MINIO_BUCKET
};
