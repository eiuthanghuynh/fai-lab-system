const { Worker } = require('bullmq');
const { connection, cleanupQueue } = require('../config/queue');
const prisma = require('../config/db');
const { minioClient } = require('../config/minioClient');

const removeByBucket = async (items, urlField = 'file_url') => {
  const byBucket = {};
  for (const item of items) {
    const bucket = item.bucket_name || 'requests';
    if (!byBucket[bucket]) byBucket[bucket] = [];
    byBucket[bucket].push(item[urlField]);
  }
  for (const bucket of Object.keys(byBucket)) {
    await minioClient.removeObjects(bucket, byBucket[bucket]).catch(e => console.error('MinIO bulk cleanup error:', e));
  }
};

const cleanupProcessor = async (job) => {
  console.log(`[CleanupWorker] Processing job ${job.id}`);
  
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  // 1. Request attachments
  const orphanedRequests = await prisma.requestAttachment.findMany({
    where: { parent_id: null, created_at: { lt: yesterday } }
  });
  if (orphanedRequests.length > 0) {
    await removeByBucket(orphanedRequests);
    await prisma.requestAttachment.deleteMany({
      where: { id: { in: orphanedRequests.map(a => a.id) } }
    });
    console.log(`[CleanupWorker] Cleaned up ${orphanedRequests.length} orphaned request attachments.`);
  }

  // 2. Report attachments
  const orphanedReports = await prisma.reportAttachment.findMany({
    where: { parent_id: null, created_at: { lt: yesterday } }
  });
  if (orphanedReports.length > 0) {
    await removeByBucket(orphanedReports);
    await prisma.reportAttachment.deleteMany({
      where: { id: { in: orphanedReports.map(a => a.id) } }
    });
    console.log(`[CleanupWorker] Cleaned up ${orphanedReports.length} orphaned report attachments.`);
  }

  // 3. Lab Work Order Images
  const orphanedImages = await prisma.labWorkOrderImage.findMany({
    where: { parent_id: null, created_at: { lt: yesterday } }
  });
  if (orphanedImages.length > 0) {
    await removeByBucket(orphanedImages, 'image_url');
    await prisma.labWorkOrderImage.deleteMany({
      where: { id: { in: orphanedImages.map(a => a.id) } }
    });
    console.log(`[CleanupWorker] Cleaned up ${orphanedImages.length} orphaned lab work order images.`);
  }

  return { success: true };
};

const initCleanupWorker = async () => {
  const worker = new Worker('cleanupQueue', cleanupProcessor, { connection });

  worker.on('completed', (job) => {
    console.log(`[CleanupWorker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[CleanupWorker] Job ${job?.id} failed:`, err);
  });

  // Add the repeatable job (runs every day at midnight)
  await cleanupQueue.add('daily-cleanup', {}, {
    repeat: {
      pattern: '0 0 * * *'
    }
  });

  console.log('[CleanupWorker] Initialized and scheduled daily cleanup job');
};

module.exports = initCleanupWorker;
