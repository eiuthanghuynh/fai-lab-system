const prisma = require('../config/db');
const { minioClient, MINIO_BUCKET } = require('../config/minioClient');
const { cleanupOrphanedAttachments, cleanupOrphanedReportAttachments, cleanupOrphanedWorkOrderImages, processUploads } = require('../utils/attachmentHelper');
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

const bulkSaveWorkOrders = async (req, res) => {
  const { requestId } = req.params;
  const { creates = [], updates = [], deletes = [], keptImageIds = [], keptReportAttachmentIds = [] } = req.body;

  const request = await prisma.labRequest.findUnique({
    where: { id: parseInt(requestId) }
  });
  
  if (!request) {
    return res.status(404).json({ error: 'Lab Request not found.' });
  }

  // The route middleware (checkPermission) ensures INSPECT_LAB.
  // Now verify ownership:
  if (request.inspector_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied. You are not the assigned inspector for this request.' });
  }

  // Validate Quantity constraints
  const existingWOs = await prisma.labWorkOrder.findMany({
    where: {
      lab_request_id: parseInt(requestId),
      is_active: true,
      id: { notIn: [...updates.map(u => u.id), ...deletes] }
    }
  });

  const existingQty = existingWOs.reduce((acc, wo) => acc + wo.quantity, 0);
  const createsQty = creates.reduce((acc, wo) => acc + (wo.quantity || 1), 0);
  const updatesQty = updates.reduce((acc, wo) => acc + (wo.quantity || 0), 0);
  const totalQty = existingQty + createsQty + updatesQty;

  if (totalQty > request.quantity) {
    return res.status(400).json({ error: `Total work order quantity (${totalQty}) cannot exceed request quantity (${request.quantity}).` });
  }

  // Validate item_test_id presence
  for (const wo of [...creates, ...updates]) {
    if (!wo.item_test_id) {
      return res.status(400).json({ error: `Work Order ${wo.work_order_no || wo.id} is missing an Item Test.` });
    }
  }

  const results = await prisma.$transaction(async (tx) => {
    // 1. Deletes
    if (deletes.length > 0) {
      // Find the work orders to get their IDs
      const wosToDelete = await tx.labWorkOrder.findMany({
        where: { id: { in: deletes }, lab_request_id: parseInt(requestId) },
        select: { id: true }
      });
      const idsToDelete = wosToDelete.map(wo => wo.id);
      
      if (idsToDelete.length > 0) {
        await tx.labWorkOrderImage.updateMany({
          where: { parent_id: { in: idsToDelete } },
          data: { parent_id: null }
        });
        await tx.reportAttachment.updateMany({
          where: { parent_id: { in: idsToDelete }, request_type: 'LAB' },
          data: { parent_id: null }
        });
        await tx.labWorkOrder.deleteMany({ where: { id: { in: idsToDelete } } });
      }
    }

    // 2. Updates
    const updatedIds = [];
    for (const update of updates) {
      await tx.labWorkOrder.update({
        where: { id: update.id },
        data: {
          quantity: update.quantity,
          product_sn: update.product_sn,
          item_test_id: update.item_test_id,
          procedure_condition: update.procedure_condition,
          test_specification: update.test_specification,
          remark: update.remark,
          status: update.status,
          test_result: update.test_result,
          failure_details: update.failure_details,
          improvement_plan: update.improvement_plan
        }
      });
      updatedIds.push(update.id);
      
      if (update.images && update.images.length > 0) {
         const fileIds = update.images.map(img => img.id).filter(id => id);
         if (fileIds.length > 0) {
           await tx.labWorkOrderImage.updateMany({
             where: { id: { in: fileIds } },
             data: { parent_id: update.id }
           });
         }
      }
      if (update.reportAttachments && update.reportAttachments.length > 0) {
         const fileIds = update.reportAttachments.map(img => img.id).filter(id => id);
         if (fileIds.length > 0) {
           await tx.reportAttachment.updateMany({
             where: { id: { in: fileIds } },
             data: { parent_id: update.id }
           });
         }
      }
    }

    // 3. Creates
    const createdIds = [];
    for (const create of creates) {
      const newWo = await tx.labWorkOrder.create({
        data: {
          work_order_no: create.work_order_no,
          lab_request_id: parseInt(requestId),
          quantity: create.quantity,
          product_sn: create.product_sn,
          item_test_id: create.item_test_id,
          procedure_condition: create.procedure_condition,
          test_specification: create.test_specification,
          remark: create.remark,
          status: create.status || 'Ongoing',
          test_result: create.test_result,
          failure_details: create.failure_details,
          improvement_plan: create.improvement_plan,
          technician_id: req.user.id
        }
      });
      createdIds.push(newWo.id);
      
      if (create.images && create.images.length > 0) {
         const fileIds = create.images.map(img => img.id).filter(id => id);
         if (fileIds.length > 0) {
           await tx.labWorkOrderImage.updateMany({
             where: { id: { in: fileIds } },
             data: { parent_id: newWo.id }
           });
         }
      }
      if (create.reportAttachments && create.reportAttachments.length > 0) {
         const fileIds = create.reportAttachments.map(img => img.id).filter(id => id);
         if (fileIds.length > 0) {
           await tx.reportAttachment.updateMany({
             where: { id: { in: fileIds } },
             data: { parent_id: newWo.id }
           });
         }
      }
    }

    // Report Attachments mapped per work order above
    return { updatedIds, createdIds };
  });

  const allWoIdsList = [...results.updatedIds, ...results.createdIds];

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
