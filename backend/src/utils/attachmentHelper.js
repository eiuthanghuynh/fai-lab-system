const prisma = require('../config/db');
const { minioClient, MINIO_BUCKET } = require('../config/minioClient');

/**
 * Removes attachments from the database and MinIO that are no longer associated with a request.
 * 
 * @param {number} requestId - The ID of the request (e.g. FAI Request ID, Lab Request ID)
 * @param {string} requestType - The type of request ('FAI', 'LAB', 'LAB_WORK_ORDER')
 * @param {number[]} keptFileIds - Array of attachment IDs that should be kept
 */
const cleanupOrphanedAttachments = async (requestId, requestType, keptFileIds = []) => {
  if (!requestId) return;

  try {
    const removedAttachments = await prisma.requestAttachment.findMany({
      where: {
        request_id: parseInt(requestId),
        request_type: requestType,
        id: keptFileIds.length > 0 ? { notIn: keptFileIds } : undefined
      }
    });

    if (removedAttachments.length > 0) {
      const fileUrls = removedAttachments.map(att => att.file_url);
      await minioClient.removeObjects(MINIO_BUCKET, fileUrls).catch(e => console.error('MinIO bulk cleanup error:', e));

      await prisma.requestAttachment.deleteMany({
        where: { id: { in: removedAttachments.map(a => a.id) } }
      });
    }
  } catch (error) {
    console.error('Error cleaning up orphaned attachments:', error);
  }
};

module.exports = {
  cleanupOrphanedAttachments
};
