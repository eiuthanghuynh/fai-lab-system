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

const MINIO_REQUEST_BUCKET = process.env.MINIO_REQUEST_BUCKET || 'requests';
const MINIO_REPORT_BUCKET = process.env.MINIO_REPORT_BUCKET || 'reports';

// Initialize buckets
const initializeBucket = async (bucketName) => {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName);
      console.log(`Bucket ${bucketName} created successfully.`);
      
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Action: ['s3:GetObject'],
            Effect: 'Allow',
            Principal: '*',
            Resource: [`arn:aws:s3:::${bucketName}/*`]
          }
        ]
      };
      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    }
  } catch (error) {
    console.error(`Error initializing bucket ${bucketName}:`, error);
  }
};

initializeBucket(MINIO_REQUEST_BUCKET);
initializeBucket(MINIO_REPORT_BUCKET);

module.exports = {
  minioClient,
  minioClientPublic,
  MINIO_REQUEST_BUCKET,
  MINIO_REPORT_BUCKET
};
