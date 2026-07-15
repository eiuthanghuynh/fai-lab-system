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
    } catch (err) {
      console.error('[MinIO] Error running orphan cleanup task:', err);
    }
  });
};

module.exports = initCronJobs;
