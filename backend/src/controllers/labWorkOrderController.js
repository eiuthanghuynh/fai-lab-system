const prisma = require('../config/db');
const { minioClient, MINIO_BUCKET } = require('../config/minioClient');
const { cleanupOrphanedAttachments, cleanupOrphanedReportAttachments, cleanupOrphanedWorkOrderImages, processUploads } = require('../utils/attachmentHelper');
const { clearDashboardCache } = require('../utils/redisHelper');
const fs = require('fs').promises;

const getByRequestId = async (req, res) => {
  {
    const { requestId } = req.params;
    
    // Check permission
    const request = await prisma.labRequest.findUnique({
      where: { id: parseInt(requestId) },
      select: { requestor_id: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Lab Request not found.' });
    }

    if (
      !req.user.permissions ||
      (!req.user.permissions.includes("INSPECT_LAB") &&
        !req.user.permissions.includes("ASSIGN_LAB") &&
        !req.user.permissions.includes("MANAGE_REQUEST_LIST"))
    ) {
      if (request.requestor_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    const workOrders = await prisma.labWorkOrder.findMany({
      where: {
        lab_request_id: parseInt(requestId),
        is_active: true
      },
      orderBy: {
        work_order_no: 'asc'
      },
      include: {
        technician: {
          select: { id: true, full_name: true }
        },
        itemTest: {
          select: { id: true, name: true }
        },
        images: {
          where: { is_active: true }
        }
      }
    });

    const reportAttachments = await prisma.reportAttachment.findMany({
      where: {
        request_type: 'LAB',
        parent_id: { in: workOrders.map(wo => wo.id) },
        is_active: true
      }
    });

    const { getAttachmentUrl } = require('../utils/attachmentHelper');

    const mappedWorkOrders = await Promise.all(workOrders.map(async (wo) => {
      const mappedImages = await Promise.all(wo.images.map(async (img) => {
        const presigned = await getAttachmentUrl(img.image_url, img.bucket_name);
        return { ...img, url: presigned };
      }));

      const raForWo = reportAttachments.filter(ra => ra.parent_id === wo.id);
      const mappedRa = await Promise.all(raForWo.map(async (ra) => {
        const presigned = await getAttachmentUrl(ra.file_url, ra.bucket_name, ra.file_name);
        return { ...ra, url: presigned };
      }));

      return {
        ...wo,
        images: mappedImages,
        reportAttachments: mappedRa
      };
    }));

    res.json({ success: true, data: mappedWorkOrders });
  }
};

/**
 * Helper to check if a field value has actually mutated.
 * Normalizes null, undefined, and empty string comparisons.
 */
const hasValueChanged = (newVal, oldVal) => {
  if (newVal === undefined) return false;
  const normalizedNew = (newVal === '' || newVal === undefined) ? null : newVal;
  const normalizedOld = (oldVal === '' || oldVal === undefined) ? null : oldVal;
  return normalizedNew !== normalizedOld;
};

const bulkSaveWorkOrders = async (req, res) => {
  const { requestId } = req.params;
  const { updates = [], keptImageIds = [], keptReportAttachmentIds = [] } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'updates must be a non-empty array.' });
  }

  const request = await prisma.labRequest.findUnique({
    where: { id: parseInt(requestId) }
  });
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  const hasAssignLab = req.user.permissions?.includes('ASSIGN_LAB');
  const hasInspectLab = req.user.permissions?.includes('INSPECT_LAB');

  if (!hasAssignLab && !hasInspectLab) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const existingWOs = await prisma.labWorkOrder.findMany({
    where: {
      lab_request_id: parseInt(requestId),
      is_active: true
    }
  });

  const existingWoMap = new Map(existingWOs.map(wo => [wo.id, wo]));

  // Field Mutation Guard: Validate only actual value mutations
  for (const update of updates) {
    const existing = existingWoMap.get(update.id);
    if (!existing) {
      return res.status(404).json({ error: `Work Order ${update.id} not found.` });
    }
    
    if (update.quantity !== undefined && update.quantity !== existing.quantity) {
       return res.status(403).json({ error: 'Changing quantity is not allowed after request submission.' });
    }
    
    const isOwner = existing.technician_id === req.user.id;
    
    // Check technician_id mutation
    const isMutatingTechnician = hasValueChanged(update.technician_id, existing.technician_id);
    if (isMutatingTechnician && !hasAssignLab) {
       return res.status(403).json({ error: 'Only ASSIGN_LAB can change assignee.' });
    }

    // Check test result mutations
    const isMutatingScalarResults = (
       hasValueChanged(update.product_sn, existing.product_sn) ||
       hasValueChanged(update.status, existing.status) ||
       hasValueChanged(update.test_result, existing.test_result) ||
       hasValueChanged(update.failure_details, existing.failure_details) ||
       hasValueChanged(update.improvement_plan, existing.improvement_plan)
    );

    const isMutatingImages = Array.isArray(update.images) && update.images.some(img => !img.parent_id);
    const isMutatingAttachments = Array.isArray(update.reportAttachments) && update.reportAttachments.some(att => !att.parent_id);

    const isMutatingResults = isMutatingScalarResults || isMutatingImages || isMutatingAttachments;

    if (isMutatingResults && !isOwner) {
       return res.status(403).json({ error: `You are not the assigned technician for Work Order ${existing.work_order_no}.` });
    }
  }

  const results = await prisma.$transaction(async (tx) => {
    const updatedIds = [];
    let anyAssigned = false;

    for (const update of updates) {
      const existing = existingWoMap.get(update.id);
      const updateData = {};

      const isMutatingTechnician = hasValueChanged(update.technician_id, existing.technician_id);
      if (hasAssignLab && isMutatingTechnician) {
         updateData.technician_id = update.technician_id;
         if (update.technician_id && (!update.status || update.status === 'Backlog')) {
            updateData.status = "Assigned";
            anyAssigned = true;
         } else if (!update.technician_id && existing.status === 'Assigned') {
            updateData.status = "Backlog";
         }
      }

      const isOwner = (updateData.technician_id !== undefined ? updateData.technician_id : existing.technician_id) === req.user.id;
      if (isOwner) {
         if (hasValueChanged(update.product_sn, existing.product_sn)) updateData.product_sn = update.product_sn;
         if (hasValueChanged(update.status, existing.status)) updateData.status = update.status;
         if (hasValueChanged(update.test_result, existing.test_result)) updateData.test_result = update.test_result;
         if (hasValueChanged(update.failure_details, existing.failure_details)) updateData.failure_details = update.failure_details;
         if (hasValueChanged(update.improvement_plan, existing.improvement_plan)) updateData.improvement_plan = update.improvement_plan;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.labWorkOrder.update({
          where: { id: update.id },
          data: updateData
        });
        updatedIds.push(update.id);
      }
      
      if (isOwner && update.images && update.images.length > 0) {
         const fileIds = update.images.map(img => img.id).filter(id => id);
         if (fileIds.length > 0) {
           await tx.labWorkOrderImage.updateMany({
             where: { id: { in: fileIds } },
             data: { parent_id: update.id }
           });
         }
      }
      if (isOwner && update.reportAttachments && update.reportAttachments.length > 0) {
         const fileIds = update.reportAttachments.map(img => img.id).filter(id => id);
         if (fileIds.length > 0) {
           await tx.reportAttachment.updateMany({
             where: { id: { in: fileIds } },
             data: { parent_id: update.id }
           });
         }
      }
    }
    
    // Check if we need to update the parent Request status
    const allWOs = await tx.labWorkOrder.findMany({ where: { lab_request_id: parseInt(requestId), is_active: true } });
    
    const hasAnyOngoingOrCompleted = allWOs.some(wo => wo.status === 'Ongoing' || wo.status === 'Completed');
    const allAssigned = allWOs.length > 0 && allWOs.every(wo => wo.technician_id !== null && wo.technician_id !== undefined);

    let newReqStatus = request.status;
    if (hasAnyOngoingOrCompleted) {
       newReqStatus = 'Ongoing';
    } else if (allAssigned && request.status === 'Backlog') {
       newReqStatus = 'Assigned';
    }

    if (newReqStatus !== request.status) {
       await tx.labRequest.update({
          where: { id: parseInt(requestId) },
          data: { status: newReqStatus }
       });
    }

    return { updatedIds };
  });

  const allWoIdsList = [...results.updatedIds];

  // Cleanup orphaned files outside transaction
  if (keptReportAttachmentIds) {
    await cleanupOrphanedReportAttachments(allWoIdsList, keptReportAttachmentIds);
  }
  
  // Clean images for all updated and created WOs + existing WOs
  if (keptImageIds) {
    const allActiveWOs = await prisma.labWorkOrder.findMany({
      where: { lab_request_id: parseInt(requestId) },
      select: { id: true }
    });
    const allWoIds = allActiveWOs.map(w => w.id);
    if (allWoIds.length > 0) {
      await cleanupOrphanedWorkOrderImages(allWoIds, keptImageIds);
    }
  }

  if (req.app.get('io')) {
    await clearDashboardCache('LAB');
    req.app.get('io').emit("lab_dashboard_updated");
  }

  res.json({ success: true, message: 'Work orders saved successfully.' });
};

const uploadWorkOrderFiles = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const { type } = req.body;
  if (!type) {
    return res.status(400).json({ error: 'File type is required.' });
  }

  let uploadedFiles;
  if (type === 'REPORT') {
    uploadedFiles = await processUploads(req.files, (file) => {
      return prisma.reportAttachment.create({
        data: {
          parent_id: null,
          request_type: 'LAB',
          file_name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
          file_url: file.filename || file.key,
          bucket_name: file.bucket
        }
      });
    }, 'file_url');
  } else if (type === 'FAILURE' || type === 'IMPROVEMENT') {
    uploadedFiles = await processUploads(req.files, (file) => {
      return prisma.labWorkOrderImage.create({
        data: {
          parent_id: null,
          image_url: file.filename,
          bucket_name: file.bucket,
          image_type: file.mimetype,
          image_category: type
        }
      });
    }, 'image_url', true);
  } else {
    return res.status(400).json({ error: 'Invalid file type.' });
  }

  res.json({ success: true, data: uploadedFiles });
};

module.exports = {
  getByRequestId,
  bulkSaveWorkOrders,
  uploadWorkOrderFiles
};
