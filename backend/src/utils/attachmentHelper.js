const prisma = require('../config/db');
const { minioClient, minioClientPublic, MINIO_REQUEST_BUCKET } = require('../config/minioClient');

const removeByBucket = async (items, urlField = 'file_url') => {
  const byBucket = {};
  for (const item of items) {
    const bucket = item.bucket_name || MINIO_REQUEST_BUCKET;
    if (!byBucket[bucket]) byBucket[bucket] = [];
    byBucket[bucket].push(item[urlField]);
  }
  for (const bucket of Object.keys(byBucket)) {
    await minioClient.removeObjects(bucket, byBucket[bucket]).catch(e => console.error('MinIO bulk cleanup error:', e));
  }
};

/**
 * Removes attachments from the database and MinIO that are no longer associated with a request.
 */
const cleanupOrphanedAttachments = async (parentId, requestType, keptFileIds = []) => {
  if (!parentId) return;

  try {
    const removedAttachments = await prisma.requestAttachment.findMany({
      where: {
        parent_id: parseInt(parentId),
        request_type: requestType,
        id: keptFileIds.length > 0 ? { notIn: keptFileIds } : undefined
      }
    });

    if (removedAttachments.length > 0) {
      await prisma.requestAttachment.updateMany({
        where: { id: { in: removedAttachments.map(a => a.id) } },
        data: { parent_id: null }
      });
    }
  } catch (error) {
    console.error('Error cleaning up orphaned attachments:', error);
  }
};

const cleanupOrphanedReportAttachments = async (parentIds, keptFileIds = []) => {
  if (!parentIds) return;
  const ids = Array.isArray(parentIds) ? parentIds : [parseInt(parentIds)];
  try {
    const removedAttachments = await prisma.reportAttachment.findMany({
      where: {
        parent_id: { in: ids },
        id: keptFileIds.length > 0 ? { notIn: keptFileIds } : undefined
      }
    });

    if (removedAttachments.length > 0) {
      await prisma.reportAttachment.updateMany({
        where: { id: { in: removedAttachments.map(a => a.id) } },
        data: { parent_id: null }
      });
    }
  } catch (error) {
    console.error('Error cleaning up orphaned report attachments:', error);
  }
};

const cleanupOrphanedWorkOrderImages = async (workOrderIds, keptImageIds = []) => {
  if (!workOrderIds || workOrderIds.length === 0) return;
  try {
    const removedImages = await prisma.labWorkOrderImage.findMany({
      where: {
        parent_id: { in: workOrderIds },
        id: keptImageIds.length > 0 ? { notIn: keptImageIds } : undefined
      }
    });

    if (removedImages.length > 0) {
      await prisma.labWorkOrderImage.updateMany({
        where: { id: { in: removedImages.map(a => a.id) } },
        data: { parent_id: null }
      });
    }
  } catch (error) {
    console.error('Error cleaning up orphaned work order images:', error);
  }
};

/**
 * Gets a presigned URL for a given MinIO object URL
 */
const getAttachmentUrl = async (url, bucket = MINIO_REQUEST_BUCKET, originalName = null) => {
  if (!url) return url;
  try {
    let reqParams = {};
    if (originalName) {
      // url encode the filename to prevent header issues with non-ascii characters
      const encodedName = encodeURIComponent(originalName);
      reqParams['response-content-disposition'] = `inline; filename="${encodedName}"; filename*=UTF-8''${encodedName}`;
    }
    const presigned = await minioClientPublic.presignedGetObject(bucket, url, 60 * 60, reqParams);
    return presigned;
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    return url;
  }
};

/**
 * Generic file upload processor
 */
const processUploads = async (files, createDbRecord, urlField = 'file_url', returnFileName = false) => {
  if (!files || files.length === 0) {
    return [];
  }

  const attachments = [];
  for (const file of files) {
    const record = await createDbRecord(file);
    // Determine the original name. For images it might be absent or derived differently.
    const originalName = record.file_name || (returnFileName ? Buffer.from(file.originalname, 'latin1').toString('utf8') : null);
    const bucket = record.bucket_name || file.bucket || MINIO_REQUEST_BUCKET;
    const presignedUrl = await getAttachmentUrl(record[urlField], bucket, originalName);
    
    attachments.push({ 
      ...record, 
      [urlField]: presignedUrl, 
      url: presignedUrl,
      ...(returnFileName && !record.file_name && { file_name: originalName })
    });
  }

  return attachments;
};

module.exports = {
  cleanupOrphanedAttachments,
  cleanupOrphanedReportAttachments,
  cleanupOrphanedWorkOrderImages,
  getAttachmentUrl,
  processUploads
};
