const prisma = require('../config/db');
const { emailQueue, connection: redis } = require('../config/queue');
const { getWeek } = require('date-fns');
const { cleanupOrphanedAttachments } = require('../utils/attachmentHelper');
const { minioClient, minioClientPublic, MINIO_BUCKET } = require('../config/minioClient');
const fs = require('fs').promises;

const getRequests = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 25, 
      search,
      model_no,
      project_name,
      stage,
      status,
      request_date_from,
      request_date_to,
      sort_by = 'created_at',
      sort_desc = 'true'
    } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      is_active: true
    };

    if (!req.user.permissions || (!req.user.permissions.includes('INSPECT_LAB') && !req.user.permissions.includes('ASSIGN_LAB') && !req.user.permissions.includes('MANAGE_REQUEST_LIST'))) {
      // If user is just a requester, they only see their own
      where.requestor_id = req.user.id;
    }

    if (search) {
      where.OR = [
        { test_no: { contains: search, mode: 'insensitive' } },
        { model_no: { contains: search, mode: 'insensitive' } },
        { project_name: { contains: search, mode: 'insensitive' } },
        { product_sn: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (model_no) where.model_no = { contains: model_no, mode: 'insensitive' };
    if (project_name) where.project_name = { contains: project_name, mode: 'insensitive' };
    if (stage) where.stage = stage;
    if (status) where.status = status;

    if (request_date_from || request_date_to) {
      where.request_date = {};
      if (request_date_from) where.request_date.gte = new Date(request_date_from);
      if (request_date_to) {
        const toDate = new Date(request_date_to);
        toDate.setHours(23, 59, 59, 999);
        where.request_date.lte = toDate;
      }
    }

    const orderBy = {};
    const direction = sort_desc === 'true' ? 'desc' : 'asc';
    if (sort_by === 'requestor_id') {
      orderBy.requestor = { full_name: direction };
    } else {
      orderBy[sort_by] = direction;
    }

    const cacheKey = `lab_requests:${JSON.stringify(req.query)}:${req.user.id}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const requests = await prisma.labRequest.findMany({
      where,
      orderBy,
      skip,
      take: limitNumber,
      include: {
        requestor: {
          select: { id: true, full_name: true }
        },
        approver: {
          select: { full_name: true }
        },
        inspector: {
          select: { id: true, full_name: true }
        },
        workOrders: {
          where: { is_active: true },
          include: {
            technician: {
              select: { full_name: true }
            }
          }
        }
      }
    });

    const total = await prisma.labRequest.count({ where });

    const responseData = {
      success: true,
      data: requests,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber)
    };

    await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 300); // 5 mins cache

    res.json(responseData);
  } catch (error) {
    console.error('getRequests error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.labRequest.findUnique({
      where: { id: parseInt(id) },
      include: {
        requestor: {
          select: { full_name: true, username: true }
        },
        inspector: {
          select: { id: true, full_name: true }
        },
        workOrders: {
          where: { is_active: true },
          include: {
            technician: {
              select: { id: true, full_name: true }
            }
          }
        }
      }
    });

    if (!request || !request.is_active) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    // Attachments
    const attachments = await prisma.requestAttachment.findMany({
      where: {
        request_id: request.id,
        request_type: 'LAB',
        is_active: true
      }
    });

    // We can also generate presigned urls here if using Minio, but let's just return basic for now
    res.json({
      success: true,
      data: {
        ...request,
        attachments
      }
    });
  } catch (error) {
    console.error('getRequestById error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const generateTestNo = async () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const datePrefix = `LAB${year}${month}${day}-`;

  const lastRequest = await prisma.labRequest.findFirst({
    where: {
      test_no: {
        startsWith: datePrefix
      }
    },
    orderBy: {
      test_no: 'desc'
    }
  });

  if (lastRequest && lastRequest.test_no) {
    const lastNum = parseInt(lastRequest.test_no.split('-')[1], 10);
    const newNum = String(lastNum + 1).padStart(4, '0');
    return `${datePrefix}${newNum}`;
  } else {
    return `${datePrefix}0001`;
  }
};

const saveDraft = async (req, res) => {
  try {
    const {
      id,
      model_no,
      model_description,
      quantity,
      product_sn,
      project_name,
      revision,
      stage,
      file_ids = [],
      idempotency_key,
      priority,
      priority_reason
    } = req.body;

    const parsedQuantity = quantity ? parseInt(quantity) : 1;
    if (parsedQuantity < 1 || parsedQuantity > 20) {
      return res.status(400).json({ error: 'error.sample_qty_lab_bounds' });
    }

    // Idempotency Check using Redis for Draft
    if (idempotency_key) {
      const redisKey = `idempotency:draft:${idempotency_key}`;
      const existingRequestId = await redis.get(redisKey);
      if (existingRequestId) {
        const existingRequest = await prisma.labRequest.findUnique({
          where: { id: parseInt(existingRequestId) }
        });
        return res.json({ success: true, data: existingRequest, duplicated: true });
      }
    }

    let request;
    const requestData = {
      model_no: model_no || '',
      model_description: model_description || '',
      quantity: parsedQuantity,
      product_sn: product_sn || '',
      project_name: project_name || '',
      revision: revision || '',
      stage: stage || '',
      request_date: new Date(),
      status: 'Draft',
      requestor: { connect: { id: req.user.id } },
      priority: priority || null,
      priority_reason: priority_reason || null,
      week_no: getWeek(new Date())
    };

    if (id) {
      request = await prisma.labRequest.update({
        where: { id: parseInt(id) },
        data: requestData
      });
    } else {
      request = await prisma.labRequest.create({
        data: requestData
      });
    }

    if (file_ids.length > 0) {
      await prisma.requestAttachment.updateMany({
        where: {
          id: { in: file_ids.map(fid => parseInt(fid)) },
          request_type: 'LAB'
        },
        data: {
          request_id: request.id
        }
      });
    }

    if (id) {
      const keptFileIds = file_ids.map(fid => parseInt(fid));
      await cleanupOrphanedAttachments(id, 'LAB', keptFileIds);
    }

    const keys = await redis.keys('lab_requests:*');
    if (keys.length > 0) await redis.del(keys);

    if (global.io) {
      if (id) {
        global.io.emit('lab-request-updated', request);
      } else {
        global.io.emit('lab-request-created', request);
      }
    }

    if (idempotency_key) {
      const redisKey = `idempotency:draft:${idempotency_key}`;
      await redis.set(redisKey, request.id.toString(), 'EX', 600);
    }

    res.json({ success: true, data: request });
  } catch (error) {
    console.error('saveDraft error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const submitRequest = async (req, res) => {
  try {
    const {
      id,
      model_no,
      model_description,
      quantity,
      product_sn,
      project_name,
      revision,
      stage,
      file_ids = [],
      idempotency_key,
      priority,
      priority_reason
    } = req.body;

    if (!model_no || !quantity || !model_description || !product_sn || !project_name || !revision) {
      return res.status(400).json({ error: 'error.required_field' });
    }

    const parsedQuantity = quantity ? parseInt(quantity) : 1;
    if (parsedQuantity < 1 || parsedQuantity > 20) {
      return res.status(400).json({ error: 'error.sample_qty_lab_bounds' });
    }
    
    if (stage && stage.startsWith('Prototype')) {
      const parts = stage.split(' ');
      if (parts.length > 1) {
        const protoNum = parseInt(parts[1]);
        if (isNaN(protoNum) || protoNum < 1 || protoNum > 20) {
          return res.status(400).json({ error: 'error.sample_qty_lab_bounds' });
        }
      } else {
         return res.status(400).json({ error: 'error.sample_qty_lab_bounds' }); // missing number
      }
    }

    // Idempotency Check using Redis
    if (idempotency_key) {
      const redisKey = `idempotency:${idempotency_key}`;
      const existingRequestId = await redis.get(redisKey);
      if (existingRequestId) {
        const existingRequest = await prisma.labRequest.findUnique({
          where: { id: parseInt(existingRequestId) }
        });
        return res.json({ success: true, data: existingRequest, duplicated: true });
      }
    }

    const requestData = {
      model_no,
      model_description: model_description || '',
      quantity: parsedQuantity,
      product_sn: product_sn || '',
      project_name: project_name || '',
      revision: revision || '',
      stage: stage || '',
      request_date: new Date(),
      status: 'Backlog',
      idempotency_key,
      requestor: { connect: { id: req.user.id } },
      priority: priority || null,
      priority_reason: priority_reason || null,
      week_no: getWeek(new Date())
    };

    let request;
    if (id) {
      // Edit mode (if it was draft or we allow editing)
      const existingDraft = await prisma.labRequest.findUnique({ where: { id: parseInt(id) } });
      const test_no = existingDraft.test_no || await generateTestNo();
      request = await prisma.labRequest.update({
        where: { id: parseInt(id) },
        data: {
          ...requestData,
          test_no
        }
      });
    } else {
      const test_no = await generateTestNo();
      request = await prisma.labRequest.create({
        data: {
          ...requestData,
          test_no
        }
      });
    }

    if (file_ids.length > 0) {
      await prisma.requestAttachment.updateMany({
        where: {
          id: { in: file_ids.map(fid => parseInt(fid)) },
          request_type: 'LAB'
        },
        data: {
          request_id: request.id
        }
      });
    }

    if (id) {
      const keptFileIds = file_ids.map(fid => parseInt(fid));
      await cleanupOrphanedAttachments(id, 'LAB', keptFileIds);
    }

    // Save idempotency key to Redis (expire in 10 minutes)
    if (idempotency_key) {
      const redisKey = `idempotency:${idempotency_key}`;
      await redis.set(redisKey, request.id.toString(), 'EX', 600);
    }

    // Add Notification Job to BullMQ Queue
    await emailQueue.add('labRequestCreated', {
      requestId: request.id,
      email: req.user.email || 'unknown@domain.com',
      requestor: req.user.full_name || 'System User'
    });

    if (global.io) {
      global.io.emit('lab-request-created', request);
    }
    
    // Clear cache
    const keys = await redis.keys('lab_requests:*');
    if (keys.length > 0) await redis.del(keys);

    res.json({ success: true, data: request });
  } catch (error) {
    console.error('submitRequest error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const assignRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, priority_reason, inspector_id } = req.body;

    if (!priority || !inspector_id) {
      return res.status(400).json({ error: 'Priority and inspector_id are required for assignment' });
    }

    if (priority === 'Urgent' && (!priority_reason || priority_reason.trim() === '')) {
      return res.status(400).json({ error: 'Priority reason is required for Urgent priority' });
    }

    const updatedRequest = await prisma.labRequest.update({
      where: { id: parseInt(id) },
      data: {
        inspector: { connect: { id: parseInt(inspector_id) } },
        priority,
        priority_reason,
        status: 'Assigned' // Status moves to Assigned once prioritised and ready for WO creation
      }
    });

    if (global.io) {
      global.io.emit('lab-request-updated', updatedRequest);
    }

    // Clear cache
    const keys = await redis.keys('lab_requests:*');
    if (keys.length > 0) await redis.del(keys);

    res.json({ success: true, data: updatedRequest });
  } catch (err) {
    console.error('assignRequest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const attachments = [];
    for (const file of req.files) {
      const att = await prisma.requestAttachment.create({
        data: {
          request_id: 0, // temp placeholder
          request_type: 'LAB',
          file_name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
          file_url: file.filename
        }
      });
      attachments.push(att);
    }

    res.json({ files: attachments });
  } catch (error) {
    console.error('uploadFiles error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const deleteDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.labRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const isRequestor = request.requestor_id === req.user.id;
    const isManager = req.user.permissions && req.user.permissions.includes('MANAGE_REQUEST_LIST');

    if (!isRequestor && !isManager) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    if (!isManager && request.status !== 'Draft') {
      return res.status(400).json({ error: 'Only drafts can be permanently deleted.' });
    }

    const attachments = await prisma.requestAttachment.findMany({
      where: { request_id: request.id, request_type: 'LAB' }
    });

    await prisma.$transaction([
      prisma.requestAttachment.deleteMany({
        where: { request_id: request.id, request_type: 'LAB' }
      }),
      prisma.labWorkOrder.deleteMany({
        where: { lab_request_id: request.id }
      }),
      prisma.labRequest.delete({
        where: { id: request.id }
      })
    ]);

    for (const att of attachments) {
      if (att.file_url) {
        try {
          await minioClient.removeObject(MINIO_BUCKET, att.file_url);
        } catch (err) {
          console.error(`[MinIO] Failed to delete object: ${att.file_url}`, err.message);
        }
      }
    }

    if (global.io && request.status !== 'Draft') {
      global.io.emit('lab-request-deleted', parseInt(id));
    }

    const keys = await redis.keys('lab_requests:*');
    if (keys.length > 0) await redis.del(keys);

    res.json({ success: true, message: 'Draft deleted successfully.' });
  } catch (error) {
    console.error('deleteDraft error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getInspectors = async (req, res) => {
  try {
    const inspectors = await prisma.user.findMany({
      where: {
        is_active: true,
        roles: {
          some: {
            role: {
              is_active: true,
              permissions: {
                some: {
                  is_active: true,
                  permission: {
                    name: 'INSPECT_LAB',
                    is_active: true
                  }
                }
              }
            }
          }
        }
      },
      select: {
        id: true,
        full_name: true,
        username: true
      }
    });
    res.json({ success: true, data: inspectors });
  } catch (err) {
    console.error('getInspectors error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  getRequests,
  getRequestById,
  saveDraft,
  submitRequest,
  assignRequest,
  getInspectors,
  uploadFiles,
  deleteDraft
};
