const Minio = require('minio');
const dotenv = require('dotenv');

dotenv.config();

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
});

const minioClientPublic = new Minio.Client({
  endPoint: 'localhost', // Hardcode to localhost for frontend
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
  region: 'us-east-1' // Required to prevent network call
});

const MINIO_BUCKET = process.env.MINIO_BUCKET || 'requests';

module.exports = {
  minioClient,
  minioClientPublic,
  MINIO_BUCKET
};
