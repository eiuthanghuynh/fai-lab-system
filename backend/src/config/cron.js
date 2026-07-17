const cron = require('node-cron');
const prisma = require('./db');

const initCronJobs = () => {
  // Cleanup orphaned attachments daily at 02:00 AM (Vietnam time)
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('[MinIO] Running daily orphan cleanup task...');
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const orphans = await prisma.requestAttachment.findMany({
        where: {
          request_id: 0,
          created_at: { lt: twentyFourHoursAgo }
        }
      });

      if (orphans.length > 0) {
        const { minioClient, MINIO_BUCKET } = require('./minioClient');
        const fileUrls = orphans.map(o => o.file_url);
        await minioClient.removeObjects(MINIO_BUCKET, fileUrls).catch(e => console.error('[MinIO] MinIO bulk cleanup error:', e));
        
        await prisma.requestAttachment.deleteMany({
          where: { id: { in: orphans.map(o => o.id) } }
        });
        console.log(`[MinIO] Successfully cleaned up ${orphans.length} orphaned files.`);
      } else {
        console.log(`[MinIO] Successfully cleaned up 0 orphaned files.`);
      }

      // Cleanup orphaned Report Attachments
      const reportOrphans = await prisma.reportAttachment.findMany({
        where: {
          request_id: 0,
          created_at: { lt: twentyFourHoursAgo }
        }
      });
      if (reportOrphans.length > 0) {
        const { minioClient, MINIO_BUCKET } = require('./minioClient');
        const fileUrls = reportOrphans.map(o => o.file_url);
        await minioClient.removeObjects(MINIO_BUCKET, fileUrls).catch(e => console.error('[MinIO] MinIO bulk cleanup error (Reports):', e));
        
        await prisma.reportAttachment.deleteMany({
          where: { id: { in: reportOrphans.map(o => o.id) } }
        });
        console.log(`[MinIO] Successfully cleaned up ${reportOrphans.length} orphaned report attachments.`);
      }

      // Cleanup orphaned Lab Work Order Images
      const imageOrphans = await prisma.labWorkOrderImage.findMany({
        where: {
          lab_work_order_id: 0,
          created_at: { lt: twentyFourHoursAgo }
        }
      });
      if (imageOrphans.length > 0) {
        const { minioClient, MINIO_BUCKET } = require('./minioClient');
        const fileUrls = imageOrphans.map(o => o.image_url);
        await minioClient.removeObjects(MINIO_BUCKET, fileUrls).catch(e => console.error('[MinIO] MinIO bulk cleanup error (Images):', e));
        
        await prisma.labWorkOrderImage.deleteMany({
          where: { id: { in: imageOrphans.map(o => o.id) } }
        });
        console.log(`[MinIO] Successfully cleaned up ${imageOrphans.length} orphaned work order images.`);
      }
    } catch (err) {
      console.error('[MinIO] Error running orphan cleanup task:', err);
    }
  });
};

module.exports = initCronJobs;
