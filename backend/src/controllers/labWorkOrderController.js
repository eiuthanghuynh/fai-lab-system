const prisma = require('../config/db');
const { minioClient, MINIO_BUCKET } = require('../config/minioClient');
const { cleanupOrphanedAttachments } = require('../utils/attachmentHelper');
const fs = require('fs').promises;

const getByRequestId = async (req, res) => {
  try {
    const { requestId } = req.params;
    const workOrders = await prisma.labWorkOrder.findMany({
      where: {
        lab_request_id: parseInt(requestId),
        is_active: true
      },
      include: {
        technician: {
          select: { id: true, full_name: true }
        }
      }
    });

    res.json({ success: true, data: workOrders });
  } catch (err) {
    console.error('getByRequestId error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const createWorkOrder = async (req, res) => {
  try {
    const { requestId } = req.params;
    const {
      quantity,
      product_sn,
      item_test,
      procedure_condition,
      test_specification,
      remark,
      technician_id
    } = req.body;

    if (!item_test) {
      return res.status(400).json({ error: 'Item test is required.' });
    }

    // Auto-generate work_order_no
    const request = await prisma.labRequest.findUnique({
      where: { id: parseInt(requestId) },
      include: { workOrders: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Lab Request not found.' });
    }

    const nextIndex = request.workOrders.length + 1;
    const work_order_no = `${request.id}-${String(nextIndex).padStart(3, '0')}`; // e.g. 1-001

    const workOrder = await prisma.labWorkOrder.create({
      data: {
        work_order_no,
        lab_request_id: parseInt(requestId),
        quantity: quantity ? parseInt(quantity) : request.quantity,
        product_sn: product_sn || request.product_sn || '',
        item_test,
        procedure_condition: procedure_condition || '',
        test_specification: test_specification || '',
        remark: remark || '', // maps to Goal/Comments
        status: 'Backlog',
        technician_id: technician_id ? parseInt(technician_id) : req.user.id
      }
    });

    if (global.io) {
      global.io.emit('lab-work-order-created', workOrder);
    }

    const { connection: redis } = require('../config/queue');
    const keys = await redis.keys('lab_requests:*');
    if (keys.length > 0) await redis.del(keys);

    res.json({ success: true, data: workOrder });
  } catch (err) {
    console.error('createWorkOrder error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      test_result,
      failure_details,
      improvement_plan,
      remark,
      file_ids
    } = req.body;

    const data = {};
    if (status) data.status = status; // Backlog, Assigned, Ongoing, Completed
    if (test_result !== undefined) data.test_result = test_result; // PASS / FAIL
    if (failure_details !== undefined) data.failure_details = failure_details;
    if (improvement_plan !== undefined) data.improvement_plan = improvement_plan;
    if (remark !== undefined) data.remark = remark;

    const updated = await prisma.labWorkOrder.update({
      where: { id: parseInt(id) },
      data
    });

    if (file_ids && file_ids.length > 0) {
      await prisma.requestAttachment.updateMany({
        where: {
          id: { in: file_ids.map(fid => parseInt(fid)) },
          request_type: 'LAB_WORK_ORDER'
        },
        data: {
          request_id: updated.id
        }
      });
    }

    if (id) {
      const keptFileIds = file_ids ? file_ids.map(fid => parseInt(fid)) : [];
      await cleanupOrphanedAttachments(id, 'LAB_WORK_ORDER', keptFileIds);
    }

    if (global.io) {
      global.io.emit('lab-work-order-updated', updated);
    }

    const { connection: redis } = require('../config/queue');
    const keys = await redis.keys('lab_requests:*');
    if (keys.length > 0) await redis.del(keys);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const uploadWorkOrderFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const attachments = [];
    for (const file of req.files) {
      const att = await prisma.requestAttachment.create({
        data: {
          request_id: 0, // temp placeholder
          request_type: 'LAB_WORK_ORDER',
          file_name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
          file_url: file.filename
        }
      });
      attachments.push(att);
    }

    res.json({ files: attachments });
  } catch (error) {
    console.error('uploadWorkOrderFiles error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  getByRequestId,
  createWorkOrder,
  updateStatus,
  uploadWorkOrderFiles
};
