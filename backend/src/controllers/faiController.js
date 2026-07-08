const fs = require('fs').promises;
const path = require('path');
const prisma = require('../config/db');
const { emailQueue } = require('../config/queue');
const { getWeek, startOfWeek, format } = require('date-fns');
const { connection: redis } = require('../config/queue');
const { minioClient, minioClientPublic, MINIO_BUCKET } = require('../config/minioClient');

async function getAttachmentUrl(att) {
  // Generate presigned URL valid for 1 hour using the public client
  // which hashes the signature with 'localhost'
  try {
    const url = await minioClientPublic.presignedGetObject(MINIO_BUCKET, att.file_url, 60 * 60);
    return url;
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    return att.file_url;
  }
}


const getRequests = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 25, 
      search,
      project_name,
      part_no,
      commodity_part,
      supplier_name,
      tracking_no,
      receive_date_from,
      receive_date_to,
      complete_date_from,
      complete_date_to,
      est_date_from,
      est_date_to,
      inspector_id,
      status,
      result,
      sort_by = 'created_at',
      sort_desc = 'true'
    } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      is_active: true
    };

    if (!req.user.permissions || !req.user.permissions.includes('MANAGE_REQUEST_LIST')) {
      where.requestor_id = req.user.id;
    }

    if (search) {
      where.OR = [
        { part_no: { contains: search, mode: 'insensitive' } },
        { part_name: { contains: search, mode: 'insensitive' } },
        { supplier_name: { contains: search, mode: 'insensitive' } },
        { tracking_no: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (project_name) {
      where.project_name = { contains: project_name, mode: 'insensitive' };
    }
    if (part_no) {
      where.part_no = { contains: part_no, mode: 'insensitive' };
    }
    if (commodity_part) {
      where.commodity_part = parseInt(commodity_part);
    }
    if (supplier_name) {
      where.supplier_name = { contains: supplier_name, mode: 'insensitive' };
    }
    if (tracking_no) {
      where.tracking_no = { contains: tracking_no, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }
    if (result) {
      where.result = result;
    }
    if (inspector_id) {
      where.inspector_id = parseInt(inspector_id);
    }

    // Date filters
    if (receive_date_from || receive_date_to) {
      where.receive_date = {};
      if (receive_date_from) where.receive_date.gte = new Date(receive_date_from);
      if (receive_date_to) {
        const toDate = new Date(receive_date_to);
        toDate.setHours(23, 59, 59, 999);
        where.receive_date.lte = toDate;
      }
    }
    if (complete_date_from || complete_date_to) {
      where.updated_at = {};
      if (complete_date_from) where.updated_at.gte = new Date(complete_date_from);
      if (complete_date_to) {
        const toDate = new Date(complete_date_to);
        toDate.setHours(23, 59, 59, 999);
        where.updated_at.lte = toDate;
      }
    }
    if (est_date_from || est_date_to) {
      where.estimated_date = {};
      if (est_date_from) where.estimated_date.gte = new Date(est_date_from);
      if (est_date_to) {
        const toDate = new Date(est_date_to);
        toDate.setHours(23, 59, 59, 999);
        where.estimated_date.lte = toDate;
      }
    }

    // Build order by
    const orderBy = {};
    const direction = sort_desc === 'true' ? 'desc' : 'asc';
    
    // Handle relation sorting
    if (sort_by === 'requestor_id') {
      orderBy.requestor = { full_name: direction };
    } else if (sort_by === 'inspector_id') {
      orderBy.inspector = { full_name: direction };
    } else if (sort_by === 'commodity_part') {
      orderBy.commodityPartRel = { name: direction };
    } else if (sort_by === 'fai_failure_mode') {
      orderBy.faiFailureModeRel = { issue: direction };
    } else {
      orderBy[sort_by] = direction;
    }

    // Fetch requests
    const requests = await prisma.faiRequest.findMany({
      where,
      orderBy,
      skip,
      take: limitNumber,
      include: {
        commodityPartRel: true,
        requestor: {
          select: { id: true, full_name: true }
        },
        inspector: {
          select: { id: true, full_name: true }
        }
      }
    });

    const total = await prisma.faiRequest.count({ where });

    // Fetch attachments for these requests
    const requestIds = requests.map(r => r.id);
    let attachments = [];
    if (requestIds.length > 0) {
      attachments = await prisma.requestAttachment.findMany({
        where: {
          request_id: { in: requestIds },
          request_type: 'FAI',
          is_active: true
        }
      });
    }

    // Map attachments to requests and generate URLs
    const mappedRequests = await Promise.all(requests.map(async req => {
      const reqAttachments = attachments.filter(att => att.request_id === req.id);
      const attsWithUrls = await Promise.all(reqAttachments.map(async att => ({
        ...att,
        file_url: await getAttachmentUrl(att)
      })));
      return {
        ...req,
        attachments: attsWithUrls
      };
    }));

    res.json({
      data: mappedRequests,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber)
    });
  } catch (error) {
    console.error('getRequests error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const attachments = [];
    for (const file of req.files) {
      await minioClient.fPutObject(MINIO_BUCKET, file.filename, file.path, {
        'Content-Type': file.mimetype
      });
      await fs.unlink(file.path);

      const att = await prisma.requestAttachment.create({
        data: {
          request_id: 0, // temp placeholder
          request_type: 'FAI',
          file_name: file.originalname,
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

const saveDraft = async (req, res) => {
  try {
    const {
      id,
      part_no,
      part_name,
      revision,
      supplier_name,
      address,
      commodity_part,
      part_type,
      reason_for_submission,
      submission_contents,
      file_ids = [],
      person_in_charge,
      tracking_no,
      sample_qty,
      submission_time,
      priority,
      failure_details,
      improvement_plan,
      project_name,
      idempotency_key
    } = req.body;

    // Idempotency Check using Redis for Draft
    if (idempotency_key) {
      const redisKey = `idempotency:draft:${idempotency_key}`;
      const existingRequestId = await redis.get(redisKey);
      if (existingRequestId) {
        const existingRequest = await prisma.faiRequest.findUnique({
          where: { id: parseInt(existingRequestId) }
        });
        return res.json({ success: true, data: existingRequest, duplicated: true });
      }
    }

    let request;
    const requestData = {
      part_no: part_no || '',
      part_name: part_name || '',
      revision: revision || '',
      supplier_name: supplier_name || '',
      address: address || '',
      commodity_part: commodity_part ? parseInt(commodity_part) : null,
      person_in_charge: person_in_charge || '',
      tracking_no: tracking_no || '',
      part_type: part_type || '',
      reason_for_submission: reason_for_submission || '',
      submission_contents: submission_contents || {},
      sample_qty: sample_qty ? parseInt(sample_qty) : 1,
      submission_time: submission_time ? parseInt(submission_time) : 1,
      priority: priority || null,
      failure_details: failure_details || null,
      improvement_plan: improvement_plan || null,
      week_no: getWeek(new Date()),
      project_name: project_name || 'FAI-PROJECT',
      form_data: req.body, // full backup
      status: 'Draft',
      requestor_id: req.user.id
    };

    if (id) {
      // Update existing draft
      request = await prisma.faiRequest.update({
        where: { id: parseInt(id) },
        data: requestData
      });
    } else {
      // Create new draft
      request = await prisma.faiRequest.create({
        data: requestData
      });
    }

    // Link attachments
    if (file_ids.length > 0) {
      await prisma.requestAttachment.updateMany({
        where: {
          id: { in: file_ids.map(fid => parseInt(fid)) },
          request_type: 'FAI'
        },
        data: {
          request_id: request.id
        }
      });
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
      part_no,
      part_name,
      revision,
      supplier_name,
      address,
      commodity_part,
      part_type,
      reason_for_submission,
      submission_contents,
      file_ids = [],
      idempotency_key,
      person_in_charge,
      tracking_no,
      sample_qty,
      submission_time,
      priority,
      failure_details,
      improvement_plan,
      project_name
    } = req.body;

    // 1. Validate required fields for final submission
    if (!project_name || !part_no || !part_name || !supplier_name || !revision || !address || !commodity_part || !person_in_charge) {
      return res.status(400).json({ error: 'Required fields are missing.' });
    }

    // 2. Idempotency Check using Redis
    if (idempotency_key) {
      const redisKey = `idempotency:${idempotency_key}`;
      const existingRequestId = await redis.get(redisKey);
      if (existingRequestId) {
        // Return existing request to prevent duplicate processing
        const existingRequest = await prisma.faiRequest.findUnique({
          where: { id: parseInt(existingRequestId) }
        });
        return res.json({ success: true, data: existingRequest, duplicated: true });
      }
    }

    let request;
    const requestData = {
      part_no,
      part_name,
      revision: revision || '',
      supplier_name,
      address: address || '',
      commodity_part: commodity_part ? parseInt(commodity_part) : null,
      person_in_charge: person_in_charge || '',
      tracking_no: tracking_no || '',
      part_type: part_type || '',
      reason_for_submission: reason_for_submission || '',
      submission_contents: submission_contents || {},
      sample_qty: sample_qty ? parseInt(sample_qty) : 1,
      submission_time: submission_time ? parseInt(submission_time) : 1,
      priority: priority || null,
      failure_details: failure_details || null,
      improvement_plan: improvement_plan || null,
      week_no: getWeek(new Date()),
      project_name: project_name,
      form_data: req.body,
      status: 'Backlog',
      idempotency_key,
      requestor_id: req.user.id
    };

    if (id) {
      // Update existing draft to submitted
      request = await prisma.faiRequest.update({
        where: { id: parseInt(id) },
        data: requestData
      });
    } else {
      // Create new request
      request = await prisma.faiRequest.create({
        data: requestData
      });
    }

    // Link attachments
    if (file_ids.length > 0) {
      await prisma.requestAttachment.updateMany({
        where: {
          id: { in: file_ids.map(fid => parseInt(fid)) },
          request_type: 'FAI'
        },
        data: {
          request_id: request.id
        }
      });
    }

    // 4. Save idempotency key to Redis (expire in 10 minutes)
    if (idempotency_key) {
      const redisKey = `idempotency:${idempotency_key}`;
      await redis.set(redisKey, request.id.toString(), 'EX', 600);
    }

    // 5. Add Notification Job to BullMQ Queue
    await emailQueue.add('faiRequestCreated', {
      requestId: request.id,
      email: req.user.email || 'unknown@domain.com',
      requestor: req.user.full_name || 'System User'
    });

    if (global.io) {
      global.io.emit('fai-request-created', request);
    }

    res.json({ success: true, data: request });
  } catch (error) {
    console.error('submitRequest error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.faiRequest.findUnique({
      where: { id: parseInt(id) },
      include: {
        requestor: {
          select: {
            full_name: true,
            username: true
          }
        },
        commodityPartRel: true
      }
    });

    if (!request || !request.is_active) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const isRequestor = request.requestor_id === req.user.id;
    const isManager = req.user.permissions && req.user.permissions.includes('MANAGE_REQUEST_LIST');

    if (!isRequestor && !isManager) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const attachments = await prisma.requestAttachment.findMany({
      where: {
        request_id: request.id,
        request_type: 'FAI',
        is_active: true
      }
    });

    const attsWithUrls = await Promise.all(attachments.map(async att => ({
      ...att,
      file_url: await getAttachmentUrl(att)
    })));

    res.json({
      success: true,
      data: {
        ...request,
        attachments: attsWithUrls
      }
    });
  } catch (error) {
    console.error('getRequestById error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const deleteDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.faiRequest.findUnique({
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

    // Fetch attachments before deleting database records
    const attachments = await prisma.requestAttachment.findMany({
      where: { request_id: request.id, request_type: 'FAI' }
    });

    // Permanently delete draft and attachments from database
    await prisma.$transaction([
      prisma.requestAttachment.deleteMany({
        where: { request_id: request.id, request_type: 'FAI' }
      }),
      prisma.faiRequest.delete({
        where: { id: request.id }
      })
    ]);

    // Delete corresponding files from MinIO
    for (const att of attachments) {
      if (att.file_url) {
        try {
          await minioClient.removeObject(MINIO_BUCKET, att.file_url);
          console.log(`[MinIO] Deleted draft attachment object: ${att.file_url}`);
        } catch (err) {
          console.error(`[MinIO] Failed to delete object: ${att.file_url}`, err.message);
        }
      }
    }

    if (global.io) {
      global.io.emit('fai-request-deleted', parseInt(id));
    }

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
            is_active: true,
            role: {
              is_active: true,
              permissions: {
                some: {
                  is_active: true,
                  permission: {
                    name: 'INSPECT_FAI',
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

const assignRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { inspector_id, priority } = req.body;

    // Optional: could add explicit permission check here if not handled by a middleware
    // We assume the frontend hides the button, but backend should ideally verify req.user has ASSIGN_FAI

    if (!inspector_id || !priority) {
      return res.status(400).json({ error: 'Missing inspector_id or priority' });
    }

    const updatedRequest = await prisma.faiRequest.update({
      where: { id: parseInt(id) },
      data: {
        inspector_id: parseInt(inspector_id),
        priority,
        status: 'Ongoing'
      }
    });

    if (global.io) {
      global.io.emit('fai-request-updated', updatedRequest);
    }

    res.json({ success: true, data: updatedRequest });
  } catch (err) {
    console.error('assignRequest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getRequests,
  getRequestById,
  saveDraft,
  submitRequest,
  uploadFiles,
  deleteDraft,
  getInspectors,
  assignRequest
};
