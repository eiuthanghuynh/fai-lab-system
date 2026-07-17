const fs = require('fs').promises;
const path = require('path');
const prisma = require('../config/db');
const { emailQueue } = require('../config/queue');
const { getWeek, startOfWeek, format } = require('date-fns');
const { connection: redis } = require('../config/queue');
const { minioClient, minioClientPublic, MINIO_BUCKET } = require('../config/minioClient');
const { cleanupOrphanedAttachments, getAttachmentUrl, processUploads } = require('../utils/attachmentHelper');


const generateTestNo = async () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const datePrefix = `FAI${year}${month}${day}-`; // Use FAI prefix to distinguish from LAB if desired, or just same

  const lastRequest = await prisma.faiRequest.findFirst({
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

const getRequests = async (req, res) => {
  {
    const { 
      page = 1, 
      limit = 25, 
      search,
      project_name,
      part_no,
      commodity_part,
      supplier_id,
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
    const { limitNumber, skip } = req.pagination;

    const where = {
      is_active: true
    };

    if (!req.user.permissions || !req.user.permissions.includes('MANAGE_REQUEST_LIST')) {
      where.requestor_id = req.user.id;
    }

    if (search) {
      where.OR = [
        { test_no: { contains: search, mode: 'insensitive' } },
        { part_no: { contains: search, mode: 'insensitive' } },
        { part_name: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { tracking_no: { contains: search, mode: 'insensitive' } },
        { project_name: { contains: search, mode: 'insensitive' } }
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
    if (supplier_id) {
      where.supplier_id = parseInt(supplier_id);
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
        supplier: true,
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
          parent_id: { in: requestIds },
          request_type: 'FAI',
          is_active: true
        }
      });
    }

    // Map attachments to requests and generate URLs
    const mappedRequests = await Promise.all(requests.map(async req => {
      const reqAttachments = attachments.filter(att => att.parent_id === req.id);
      const attsWithUrls = await Promise.all(reqAttachments.map(async att => ({
        ...att,
        file_url: await getAttachmentUrl(att.file_url)
      })));
      return {
        ...req,
        attachments: attsWithUrls
      };
    }));

    return res.paginate(mappedRequests, total);
  }
};

const uploadFiles = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const attachments = await processUploads(req.files, (file) => {
    return prisma.requestAttachment.create({
      data: {
        parent_id: null,
        request_type: 'FAI',
        file_name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        file_url: file.filename,
        bucket_name: file.bucket
      }
    });
  });

  res.json({ files: attachments });
};

const saveDraft = async (req, res) => {
  {
    const {
      id,
      part_no,
      part_name,
      revision,
      supplier_id,
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

    const parsedSampleQty = sample_qty ? parseInt(sample_qty) : 3;
    if (parsedSampleQty < 3 || parsedSampleQty > 20) {
      return res.status(400).json({ error: 'error.sample_qty_fai_bounds' });
    }

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
      ...(supplier_id ? { supplier: { connect: { id: parseInt(supplier_id) } } } : {}),
      address: address || '',
      ...(commodity_part ? { commodityPartRel: { connect: { id: parseInt(commodity_part) } } } : {}),
      person_in_charge: person_in_charge || '',
      tracking_no: tracking_no || '',
      part_type: part_type || '',
      reason_for_submission: reason_for_submission || '',
      submission_contents: submission_contents || {},
      sample_qty: parsedSampleQty,
      submission_time: submission_time ? parseInt(submission_time) : 1,
      priority: priority || null,
      failure_details: failure_details || null,
      improvement_plan: improvement_plan || null,
      week_no: getWeek(new Date()),
      project_name: project_name,
      form_data: req.body,
      status: 'Draft',
      requestor: { connect: { id: req.user.id } }
    };

    if (id) {
      request = await prisma.faiRequest.update({
        where: { id: parseInt(id) },
        data: requestData
      });
    } else {
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
          parent_id: request.id
        }
      });
    }

    if (id) {
      const keptFileIds = file_ids.map(fid => parseInt(fid));
      await cleanupOrphanedAttachments(id, 'FAI', keptFileIds);
    }

    if (idempotency_key) {
      const redisKey = `idempotency:draft:${idempotency_key}`;
      await redis.set(redisKey, request.id.toString(), 'EX', 600);
    }

    res.json({ success: true, data: request });
  }
};

const submitRequest = async (req, res) => {
  {
    const {
      id,
      part_no,
      part_name,
      revision,
      supplier_id,
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
    if (!project_name || !part_no || !part_name || !supplier_id || !revision || !address || !commodity_part || !person_in_charge) {
      return res.status(400).json({ success: false, error: 'Missing required fields for submission.' });
    }

    const parsedSampleQty = sample_qty ? parseInt(sample_qty) : 3;
    if (parsedSampleQty < 3 || parsedSampleQty > 20) {
      return res.status(400).json({ error: 'error.sample_qty_fai_bounds' });
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
      ...(supplier_id ? { supplier: { connect: { id: parseInt(supplier_id) } } } : {}),
      address: address || '',
      ...(commodity_part ? { commodityPartRel: { connect: { id: parseInt(commodity_part) } } } : {}),
      person_in_charge: person_in_charge || '',
      tracking_no: tracking_no || '',
      part_type: part_type || '',
      reason_for_submission: reason_for_submission || '',
      submission_contents: submission_contents || {},
      sample_qty: parsedSampleQty,
      submission_time: submission_time ? parseInt(submission_time) : 1,
      priority: priority || null,
      failure_details: failure_details || null,
      improvement_plan: improvement_plan || null,
      week_no: getWeek(new Date()),
      project_name: project_name,
      form_data: req.body,
      status: 'Backlog',
      idempotency_key,
      requestor: { connect: { id: req.user.id } }
    };

    if (id) {
      // Update existing draft to submitted
      const existingDraft = await prisma.faiRequest.findUnique({ where: { id: parseInt(id) } });
      const test_no = existingDraft.test_no || (await generateTestNo());
      request = await prisma.faiRequest.update({
        where: { id: parseInt(id) },
        data: {
          ...requestData,
          test_no
        }
      });
    } else {
      const test_no = await generateTestNo();
      // Create new request
      request = await prisma.faiRequest.create({
        data: {
          ...requestData,
          test_no
        }
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
          parent_id: request.id
        }
      });
    }

    if (id) {
      const keptFileIds = file_ids.map(fid => parseInt(fid));
      await cleanupOrphanedAttachments(id, 'FAI', keptFileIds);
    }

    // 4. Save idempotency key to Redis (expire in 10 minutes)
    if (idempotency_key) {
      const redisKey = `idempotency:${idempotency_key}`;
      await redis.set(redisKey, request.id.toString(), 'EX', 600);
    }

    if (req.app.get('io')) {
      req.app.get('io').emit('fai-request-created', request);
      req.app.get('io').emit('fai_dashboard_updated');
    }

    res.json({ success: true, data: request });
  }
};

const getRequestById = async (req, res) => {
  {
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
        commodityPartRel: true,
        supplier: true
      }
    });

    if (!request || !request.is_active) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const isRequestor = request.requestor_id === req.user.id;
    const isManager = req.user.permissions && req.user.permissions.includes('MANAGE_REQUEST_LIST');

    if (!isRequestor && !isManager) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const attachments = await prisma.requestAttachment.findMany({
      where: {
        parent_id: request.id,
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
  }
};

const deleteDraft = async (req, res) => {
  {
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
      where: { parent_id: request.id, request_type: 'FAI' }
    });

    // Permanently delete draft and attachments from database
    await prisma.$transaction([
      prisma.requestAttachment.deleteMany({
        where: { parent_id: request.id, request_type: 'FAI' }
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

    if (req.app.get('io') && request.status !== 'Draft') {
      req.app.get('io').emit('fai-request-deleted', parseInt(id));
      req.app.get('io').emit('fai_dashboard_updated');
    }

    res.json({ success: true, message: 'Draft deleted successfully.' });
  }
};

const getInspectors = async (req, res) => {
  {
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
  }
};

const assignRequest = async (req, res) => {
  {
    const { id } = req.params;
    const { inspector_id, priority, priority_reason } = req.body;


    if (!inspector_id || !priority) {
      return res.status(400).json({ error: 'Missing inspector_id or priority' });
    }

    if (priority === 'Urgent' && (!priority_reason || priority_reason.trim() === '')) {
      return res.status(400).json({ error: 'Priority reason is required for Urgent priority' });
    }

    const updatedRequest = await prisma.faiRequest.update({
      where: { id: parseInt(id) },
      data: {
        inspector: { connect: { id: parseInt(inspector_id) } },
        priority,
        priority_reason,
        status: 'Ongoing'
      }
    });

    if (req.app.get('io')) {
      req.app.get('io').emit('fai-request-updated', updatedRequest);
      req.app.get('io').emit('fai_dashboard_updated');
    }

    res.json({ success: true, data: updatedRequest });
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
