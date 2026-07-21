const prisma = require("../config/db");
const { emailQueue, connection: redis } = require("../config/queue");
const { getWeek } = require("date-fns");
const { cleanupOrphanedAttachments, getAttachmentUrl, processUploads } = require("../utils/attachmentHelper");
const { clearDashboardCache } = require("../utils/redisHelper");
const {
  minioClient,
  minioClientPublic,
  MINIO_BUCKET,
} = require("../config/minioClient");
const fs = require("fs").promises;

const getRequests = async (req, res) => {
  {
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
      sort_by = "created_at",
      sort_desc = "true",
    } = req.query;
    const { limitNumber, skip } = req.pagination;

    const where = {
      is_active: true,
    };

    if (
      !req.user.permissions ||
      (!req.user.permissions.includes("INSPECT_LAB") &&
        !req.user.permissions.includes("ASSIGN_LAB") &&
        !req.user.permissions.includes("MANAGE_REQUEST_LIST"))
    ) {
      // If user is just a requester, they only see their own
      where.requestor_id = req.user.id;
    }

    if (search) {
      where.OR = [
        { test_no: { contains: search, mode: "insensitive" } },
        { model_no: { contains: search, mode: "insensitive" } },
        { project_name: { contains: search, mode: "insensitive" } },
        { product_sn: { contains: search, mode: "insensitive" } },
      ];
    }

    if (model_no) where.model_no = { contains: model_no, mode: "insensitive" };
    if (project_name)
      where.project_name = { contains: project_name, mode: "insensitive" };
    if (stage) where.stage = stage;
    if (status) where.status = status;

    if (request_date_from || request_date_to) {
      where.request_date = {};
      if (request_date_from)
        where.request_date.gte = new Date(request_date_from);
      if (request_date_to) {
        const toDate = new Date(request_date_to);
        toDate.setHours(23, 59, 59, 999);
        where.request_date.lte = toDate;
      }
    }

    const orderBy = {};
    const direction = sort_desc === "true" ? "desc" : "asc";
    if (sort_by === "requestor_id") {
      orderBy.requestor = { full_name: direction };
    } else {
      orderBy[sort_by] = direction;
    }

    const requests = await prisma.labRequest.findMany({
      where,
      orderBy,
      skip,
      take: limitNumber,
      include: {
        requestor: {
          select: { id: true, full_name: true },
        },
        approver: {
          select: { full_name: true },
        },
        workOrders: {
          where: { is_active: true },
          include: {
            technician: {
              select: { full_name: true },
            },
            itemTest: {
              select: { name: true }
            }
          },
        },
      },
    });

    const total = await prisma.labRequest.count({ where });

    return res.paginate(requests, total);
  }
};

const getRequestById = async (req, res) => {
  {
    const { id } = req.params;
    const request = await prisma.labRequest.findUnique({
      where: { id: parseInt(id) },
      include: {
        requestor: {
          select: { full_name: true, username: true },
        },
        workOrders: {
          where: { is_active: true },
          include: {
            technician: {
              select: { id: true, full_name: true },
            },
            itemTest: {
              select: { id: true, name: true }
            }
          },
        },
        approvalLogs: {
          where: { is_active: true },
          include: {
            approver: {
              select: {
                id: true,
                full_name: true,
                roles: {
                  include: {
                    role: {
                      include: {
                        permissions: {
                          include: {
                            permission: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
    });

    if (!request || !request.is_active) {
      return res.status(404).json({ error: "Request not found." });
    }

    if (
      !req.user.permissions ||
      (!req.user.permissions.includes("INSPECT_LAB") &&
        !req.user.permissions.includes("ASSIGN_LAB") &&
        !req.user.permissions.includes("MANAGE_REQUEST_LIST") &&
        !req.user.permissions.includes("APPROVE_LAB_ENGINEER") &&
        !req.user.permissions.includes("APPROVE_LAB_MANAGER"))
    ) {
      if (request.requestor_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    // Attachments
    const attachments = await prisma.requestAttachment.findMany({
      where: {
        parent_id: request.id,
        request_type: "LAB",
        is_active: true,
      },
    });

    const attsWithUrls = await Promise.all(
      attachments.map(async (att) => ({
        ...att,
        file_url: await getAttachmentUrl(att.file_url),
      }))
    );

    res.json({
      success: true,
      data: {
        ...request,
        attachments: attsWithUrls,
      },
    });
  }
};

const generateTestNo = async () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const datePrefix = `LAB${year}${month}${day}-`;

  const lastRequest = await prisma.labRequest.findFirst({
    where: {
      test_no: {
        startsWith: datePrefix,
      },
    },
    orderBy: {
      test_no: "desc",
    },
  });

  if (lastRequest && lastRequest.test_no) {
    const lastNum = parseInt(lastRequest.test_no.split("-")[1], 10);
    const newNum = String(lastNum + 1).padStart(4, "0");
    return `${datePrefix}${newNum}`;
  } else {
    return `${datePrefix}0001`;
  }
};

const saveDraft = async (req, res) => {
  {
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
      priority_reason,
      workOrders = [],
    } = req.body;

    const parsedQuantity = quantity ? parseInt(quantity) : 1;
    if (parsedQuantity < 1 || parsedQuantity > 20) {
      return res.status(400).json({ error: "error.sample_qty_lab_bounds" });
    }

    // Work Orders Validation for Draft (Basic)
    if (!Array.isArray(workOrders)) {
      return res.status(400).json({ error: "workOrders must be an array" });
    }

    // Idempotency Check using Redis for Draft
    if (idempotency_key) {
      const redisKey = `idempotency:draft:${idempotency_key}`;
      const existingRequestId = await redis.get(redisKey);
      if (existingRequestId) {
        const existingRequest = await prisma.labRequest.findUnique({
          where: { id: parseInt(existingRequestId) },
        });
        return res.json({
          success: true,
          data: existingRequest,
          duplicated: true,
        });
      }
    }

    let request;
    const requestData = {
      model_no: model_no || "",
      model_description: model_description || "",
      quantity: parsedQuantity,
      product_sn: product_sn || "",
      project_name: project_name || "",
      revision: revision || "",
      stage: stage || "",
      request_date: new Date(),
      status: "Draft",
      requestor: { connect: { id: req.user.id } },
      priority: priority || null,
      priority_reason: priority_reason || null,
      week_no: getWeek(new Date()),
    };

    if (id) {
      // For editing draft, we will use a transaction to update the request and its work orders
      // First, find existing work orders to determine which to delete, update, or create
      const existingWOs = await prisma.labWorkOrder.findMany({ where: { lab_request_id: parseInt(id) } });
      const existingWOIds = existingWOs.map(wo => wo.id);
      const incomingIds = workOrders.filter(wo => wo.id).map(wo => wo.id);
      
      const idsToDelete = existingWOIds.filter(id => !incomingIds.includes(id));
      
      request = await prisma.$transaction(async (tx) => {
        const updatedReq = await tx.labRequest.update({
          where: { id: parseInt(id) },
          data: requestData,
        });

        if (idsToDelete.length > 0) {
          await tx.labWorkOrder.deleteMany({ where: { id: { in: idsToDelete } } });
        }

        for (let i = 0; i < workOrders.length; i++) {
          const wo = workOrders[i];
          const woData = {
            quantity: wo.quantity ? parseInt(wo.quantity) : 1,
            item_test_id: wo.item_test_id,
            procedure_condition: wo.procedure_condition || null,
            test_specification: wo.test_specification || null,
            remark: wo.remark || null,
          };

          if (wo.id) {
            await tx.labWorkOrder.update({
              where: { id: wo.id },
              data: woData,
            });
          } else {
            // Generate temporary work_order_no for draft
            const tempWoNo = `DRAFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await tx.labWorkOrder.create({
              data: {
                ...woData,
                work_order_no: tempWoNo,
                lab_request_id: parseInt(id),
                status: "Draft",
              },
            });
          }
        }
        return updatedReq;
      });
    } else {
      request = await prisma.$transaction(async (tx) => {
        const newReq = await tx.labRequest.create({
          data: requestData,
        });

        if (workOrders.length > 0) {
          const wosToCreate = workOrders.map((wo) => ({
            work_order_no: `DRAFT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            lab_request_id: newReq.id,
            quantity: wo.quantity ? parseInt(wo.quantity) : 1,
            item_test_id: wo.item_test_id,
            procedure_condition: wo.procedure_condition || null,
            test_specification: wo.test_specification || null,
            remark: wo.remark || null,
            status: "Draft",
          }));
          await tx.labWorkOrder.createMany({ data: wosToCreate });
        }
        return newReq;
      });
    }

    if (file_ids.length > 0) {
      await prisma.requestAttachment.updateMany({
        where: {
          id: { in: file_ids.map((fid) => parseInt(fid)) },
          request_type: "LAB",
        },
        data: {
          parent_id: request.id,
        },
      });
    }

    if (id) {
      const keptFileIds = file_ids.map((fid) => parseInt(fid));
      await cleanupOrphanedAttachments(id, "LAB", keptFileIds);
    }

    if (req.app.get('io') && !id) {
      req.app.get('io').emit("lab-request-created", request);
    }

    if (idempotency_key) {
      const redisKey = `idempotency:draft:${idempotency_key}`;
      await redis.set(redisKey, request.id.toString(), "EX", 600);
    }

    res.json({ success: true, data: request });
  }
};

const submitRequest = async (req, res) => {
  {
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
      priority_reason,
      workOrders = [],
    } = req.body;

    if (
      !model_no ||
      !quantity ||
      !model_description ||
      !product_sn ||
      !project_name ||
      !revision
    ) {
      return res.status(400).json({ error: "error.required_field" });
    }

    const parsedQuantity = quantity ? parseInt(quantity) : 1;
    if (parsedQuantity < 1 || parsedQuantity > 20) {
      return res.status(400).json({ error: "error.sample_qty_lab_bounds" });
    }

    if (!Array.isArray(workOrders) || workOrders.length === 0) {
      return res.status(400).json({ error: "At least one Work Order is required to submit a Request." });
    }

    if (workOrders.some(wo => !wo.item_test_id)) {
      return res.status(400).json({ error: "Item Test is required for all Work Orders." });
    }

    const totalWoQuantity = workOrders.reduce((acc, wo) => acc + (wo.quantity ? parseInt(wo.quantity) : 1), 0);
    if (totalWoQuantity !== parsedQuantity) {
      return res.status(400).json({ error: `Total Work Order quantity (${totalWoQuantity}) must exactly match Request quantity (${parsedQuantity}).` });
    }

    if (stage && stage.startsWith("Prototype")) {
      const parts = stage.split(" ");
      if (parts.length > 1) {
        const protoNum = parseInt(parts[1]);
        if (isNaN(protoNum) || protoNum < 1 || protoNum > 20) {
          return res.status(400).json({ error: "error.sample_qty_lab_bounds" });
        }
      } else {
        return res.status(400).json({ error: "error.sample_qty_lab_bounds" }); // missing number
      }
    }

    // Idempotency Check using Redis
    if (idempotency_key) {
      const redisKey = `idempotency:${idempotency_key}`;
      const existingRequestId = await redis.get(redisKey);
      if (existingRequestId) {
        const existingRequest = await prisma.labRequest.findUnique({
          where: { id: parseInt(existingRequestId) },
        });
        return res.json({
          success: true,
          data: existingRequest,
          duplicated: true,
        });
      }
    }

    const requestData = {
      model_no,
      model_description: model_description || "",
      quantity: parsedQuantity,
      product_sn: product_sn || "",
      project_name: project_name || "",
      revision: revision || "",
      stage: stage || "",
      request_date: new Date(),
      status: "Backlog",
      idempotency_key,
      requestor: { connect: { id: req.user.id } },
      priority: priority || null,
      priority_reason: priority_reason || null,
      week_no: getWeek(new Date()),
    };

    let request;
    request = await prisma.$transaction(async (tx) => {
      let finalTestNo;
      let reqId = parseInt(id);

      if (reqId) {
        // Edit mode
        const existingDraft = await tx.labRequest.findUnique({
          where: { id: reqId },
        });
        finalTestNo = existingDraft.test_no || (await generateTestNo());
        
        await tx.labRequest.update({
          where: { id: reqId },
          data: {
            ...requestData,
            test_no: finalTestNo,
          },
        });

        // Delete existing draft work orders first to replace with new ones cleanly
        // Or update them if IDs are provided
        const existingWOs = await tx.labWorkOrder.findMany({ where: { lab_request_id: reqId } });
        const existingWOIds = existingWOs.map(wo => wo.id);
        const incomingIds = workOrders.filter(wo => wo.id).map(wo => wo.id);
        const idsToDelete = existingWOIds.filter(wid => !incomingIds.includes(wid));
        
        if (idsToDelete.length > 0) {
          await tx.labWorkOrder.deleteMany({ where: { id: { in: idsToDelete } } });
        }

        for (let i = 0; i < workOrders.length; i++) {
          const wo = workOrders[i];
          const wo_no = `${finalTestNo}-${String(i + 1).padStart(4, '0')}`;
          const woData = {
            quantity: wo.quantity ? parseInt(wo.quantity) : 1,
            item_test_id: wo.item_test_id,
            procedure_condition: wo.procedure_condition || null,
            test_specification: wo.test_specification || null,
            remark: wo.remark || null,
            status: "Backlog",
            work_order_no: wo_no,
          };

          if (wo.id) {
            await tx.labWorkOrder.update({
              where: { id: wo.id },
              data: woData,
            });
          } else {
            await tx.labWorkOrder.create({
              data: {
                ...woData,
                lab_request_id: reqId,
              },
            });
          }
        }
      } else {
        // Create new
        finalTestNo = await generateTestNo();
        const newReq = await tx.labRequest.create({
          data: {
            ...requestData,
            test_no: finalTestNo,
          },
        });
        reqId = newReq.id;

        const wosToCreate = workOrders.map((wo, i) => ({
          work_order_no: `${finalTestNo}-${String(i + 1).padStart(4, '0')}`,
          lab_request_id: reqId,
          quantity: wo.quantity ? parseInt(wo.quantity) : 1,
          item_test_id: wo.item_test_id,
          procedure_condition: wo.procedure_condition || null,
          test_specification: wo.test_specification || null,
          remark: wo.remark || null,
          status: "Backlog",
        }));
        await tx.labWorkOrder.createMany({ data: wosToCreate });
      }

      return tx.labRequest.findUnique({ where: { id: reqId } });
    });

    if (file_ids.length > 0) {
      await prisma.requestAttachment.updateMany({
        where: {
          id: { in: file_ids.map((fid) => parseInt(fid)) },
          request_type: "LAB",
        },
        data: {
          parent_id: request.id,
        },
      });
    }

    if (id) {
      const keptFileIds = file_ids.map((fid) => parseInt(fid));
      await cleanupOrphanedAttachments(id, "LAB", keptFileIds);
    }

    // Save idempotency key to Redis (expire in 10 minutes)
    if (idempotency_key) {
      const redisKey = `idempotency:${idempotency_key}`;
      await redis.set(redisKey, request.id.toString(), "EX", 600);
    }

    if (req.app.get('io')) {
      await clearDashboardCache('LAB');
      req.app.get('io').emit("lab-request-created", request);
      req.app.get('io').emit("lab_dashboard_updated");
    }

    res.json({ success: true, data: request });
  }
};

const assignRequest = async (req, res) => {
  {
    const { id } = req.params;
    const { priority, priority_reason } = req.body;

    const request = await prisma.labRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.complete_date) {
      return res.status(400).json({ error: "Cannot modify a completed request." });
    }

    if (!priority) {
      return res.status(400).json({
        error: "Priority is required",
      });
    }

    if (
      priority === "Urgent" &&
      (!priority_reason || priority_reason.trim() === "")
    ) {
      return res
        .status(400)
        .json({ error: "Priority reason is required for Urgent priority" });
    }

    const updatedRequest = await prisma.labRequest.update({
      where: { id: parseInt(id) },
      data: {
        priority,
        priority_reason,
      },
    });


    if (req.app.get('io')) {
      await clearDashboardCache('LAB');
      req.app.get('io').emit("lab_dashboard_updated");
    }

    res.json({ success: true, data: updatedRequest });
  }
};

const uploadFiles = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded." });
  }

  const attachments = await processUploads(
    req.files,
    (file) => {
      return prisma.requestAttachment.create({
        data: {
          parent_id: null,
          request_type: "LAB",
          file_name: Buffer.from(file.originalname, "latin1").toString("utf8"),
          file_url: file.filename,
          bucket_name: file.bucket
        },
      });
    },
    "file_url"
  );
  res.json({ files: attachments });
};

const deleteDraft = async (req, res) => {
  {
    const { id } = req.params;
    const request = await prisma.labRequest.findUnique({
      where: { id: parseInt(id) },
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found." });
    }

    const isRequestor = request.requestor_id === req.user.id;
    const isManager =
      req.user.permissions &&
      req.user.permissions.includes("MANAGE_REQUEST_LIST");

    if (!isRequestor && !isManager) {
      return res.status(403).json({ error: "Permission denied." });
    }

    if (!isManager && request.status !== "Draft") {
      return res
        .status(400)
        .json({ error: "Only drafts can be permanently deleted." });
    }

    const attachments = await prisma.requestAttachment.findMany({
      where: { parent_id: request.id, request_type: "LAB" },
    });

    await prisma.$transaction([
      prisma.requestAttachment.updateMany({
        where: { parent_id: request.id, request_type: "LAB" },
        data: { parent_id: null },
      }),
      prisma.labWorkOrder.deleteMany({
        where: { lab_request_id: request.id },
      }),
      prisma.labRequest.delete({
        where: { id: request.id },
      }),
    ]);

    if (req.app.get('io') && request.status !== "Draft") {
      await clearDashboardCache('LAB');
      req.app.get('io').emit("lab-request-deleted", parseInt(id));
      req.app.get('io').emit("lab_dashboard_updated");
    }

    res.json({ success: true, message: "Draft deleted successfully." });
  }
};

const getInspectors = async (req, res) => {
  {
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
                    name: "INSPECT_LAB",
                    is_active: true,
                  },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        full_name: true,
        username: true,
      },
    });
    res.json({ success: true, data: inspectors });
  }
};

const startInspection = async (req, res) => {
  const { id } = req.params;
  const { estimated_date } = req.body;

  if (!estimated_date) {
    return res.status(400).json({ success: false, error: "Estimated complete date is required" });
  }

  const request = await prisma.labRequest.findUnique({
    where: { id: parseInt(id) }
  });

  if (!request) {
    return res.status(404).json({ success: false, error: "Request not found" });
  }

  if (request.complete_date) {
    return res.status(400).json({ success: false, error: "Cannot start inspection on a completed request." });
  }

  if (request.status !== "Assigned") {
    return res.status(400).json({ success: false, error: "Only Assigned requests can start inspection" });
  }

  const updatedRequest = await prisma.labRequest.update({
    where: { id: parseInt(id) },
    data: {
      status: "Ongoing",
      estimated_date: new Date(estimated_date),
    }
  });

  // Also update related work orders status to Ongoing
  await prisma.labWorkOrder.updateMany({
    where: { lab_request_id: parseInt(id), status: "Backlog" },
    data: { status: "Ongoing" }
  });


  if (req.app.get('io')) {
    await clearDashboardCache('LAB');
    req.app.get('io').emit("lab_dashboard_updated");
  }

  res.json({ success: true, data: updatedRequest });
};

const adjustSchedule = async (req, res) => {
  const { id } = req.params;
  const { estimated_date, sample_received_date, sample_return_date } = req.body;

  const hasInspectLab = req.user.permissions?.includes('INSPECT_LAB');
  if (!hasInspectLab) {
    return res.status(403).json({ success: false, error: 'Forbidden. Requires INSPECT_LAB permission.' });
  }

  const request = await prisma.labRequest.findUnique({
    where: { id: parseInt(id) },
    include: {
      workOrders: {
        where: { is_active: true }
      }
    }
  });

  if (!request) {
    return res.status(404).json({ success: false, error: "Request not found" });
  }

  if (request.complete_date) {
    return res.status(400).json({ success: false, error: "Cannot modify a completed request." });
  }

  const isAssignedTechnician = request.workOrders.some(wo => wo.technician_id === req.user.id);
  if (!isAssignedTechnician) {
    return res.status(403).json({ success: false, error: 'Forbidden. You are not an assigned technician for this request.' });
  }

  if (sample_received_date && sample_return_date) {
    const received = new Date(sample_received_date);
    const returned = new Date(sample_return_date);
    if (returned < received) {
      return res.status(400).json({ success: false, error: "Return date must be after receive date" });
    }
  }

  const updateData = {
    estimated_date: estimated_date ? new Date(estimated_date) : null,
    sample_received_date: sample_received_date ? new Date(sample_received_date) : null,
    sample_return_date: sample_return_date ? new Date(sample_return_date) : null
  };

  if (request.status === 'Assigned' && estimated_date) {
    updateData.status = 'Ongoing';
  }

  const updatedRequest = await prisma.labRequest.update({
    where: { id: parseInt(id) },
    data: updateData
  });

  if (req.app.get('io')) {
    await clearDashboardCache('LAB');
    req.app.get('io').emit("lab_dashboard_updated");
  }

  res.json({ success: true, data: updatedRequest });
};

const completeTesting = async (req, res) => {
  const { id } = req.params;

  const request = await prisma.labRequest.findUnique({
    where: { id: parseInt(id) },
    include: {
      workOrders: {
        where: { is_active: true }
      }
    }
  });

  if (!request) {
    return res.status(404).json({ success: false, error: "Request not found" });
  }

  if (request.complete_date) {
    return res.status(400).json({ success: false, error: "Testing has already been completed." });
  }

  const isAssignedTechnician = request.workOrders.some(wo => wo.technician_id === req.user.id);
  if (!isAssignedTechnician) {
    return res.status(403).json({ success: false, error: 'Forbidden. You are not an assigned technician for this request.' });
  }

  if (request.workOrders.length === 0) {
    return res.status(400).json({ success: false, error: "Cannot complete testing because this request has no Work Orders." });
  }

  const allClosedAndTested = request.workOrders.every(wo => wo.status === 'Closed' && wo.test_result);
  if (!allClosedAndTested) {
    return res.status(400).json({ 
      success: false, 
      error: "Không thể hoàn thành kiểm thử do tất cả Work Order chưa Closed và chưa có đủ kết quả kiểm thử, vui lòng kiểm tra lại" 
    });
  }

  const updatedRequest = await prisma.labRequest.update({
    where: { id: parseInt(id) },
    data: {
      complete_date: new Date()
    }
  });

  if (req.app.get('io')) {
    await clearDashboardCache('LAB');
    req.app.get('io').emit("lab_dashboard_updated");
  }

  res.json({ success: true, data: updatedRequest });
};

const approveRequest = async (req, res) => {
  const { id } = req.params;
  const { action, comment, role } = req.body;

  if (!action || !['Approved', 'Rejected'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Invalid action. Action must be Approved or Rejected.' });
  }

  if (action === 'Rejected' && (!comment || !comment.trim())) {
    return res.status(400).json({ success: false, error: 'Explanation is required when rejecting.' });
  }

  const userPermissions = req.user.permissions || [];
  const canApproveEngineer = userPermissions.includes('APPROVE_LAB_ENGINEER');
  const canApproveManager = userPermissions.includes('APPROVE_LAB_MANAGER');

  if (!canApproveEngineer && !canApproveManager) {
    return res.status(403).json({ success: false, error: 'Forbidden. You do not have approval permissions.' });
  }

  const request = await prisma.labRequest.findUnique({
    where: { id: parseInt(id) },
    include: {
      approvalLogs: {
        where: { is_active: true },
        include: {
          approver: {
            select: {
              id: true,
              roles: {
                include: {
                  role: {
                    include: {
                      permissions: {
                        include: {
                          permission: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!request || !request.is_active) {
    return res.status(404).json({ success: false, error: 'Request not found.' });
  }

  if (!request.complete_date) {
    return res.status(400).json({ success: false, error: 'Cannot approve request before testing is completed.' });
  }

  if (request.result === 'PASS' || request.result === 'FAIL') {
    return res.status(400).json({ success: false, error: 'Request has already been finalized.' });
  }

  // Helper to check if a specific permission was exercised in existing approval logs
  const checkRoleApproved = (roleName) => {
    return request.approvalLogs.some(log => log.role === roleName);
  };

  const engineerApproved = checkRoleApproved('APPROVE_LAB_ENGINEER');
  const managerApproved = checkRoleApproved('APPROVE_LAB_MANAGER');

  let targetRole = role;
  if (!targetRole) {
    if (canApproveEngineer && !engineerApproved) {
      targetRole = 'APPROVE_LAB_ENGINEER';
    } else if (canApproveManager && !managerApproved) {
      targetRole = 'APPROVE_LAB_MANAGER';
    }
  }

  if (!targetRole || !['APPROVE_LAB_ENGINEER', 'APPROVE_LAB_MANAGER'].includes(targetRole)) {
    return res.status(400).json({ success: false, error: 'Invalid or missing approval role.' });
  }

  if (targetRole === 'APPROVE_LAB_ENGINEER' && !canApproveEngineer) {
    return res.status(403).json({ success: false, error: 'Forbidden. You do not have Lab Engineer approval permission.' });
  }
  if (targetRole === 'APPROVE_LAB_MANAGER' && !canApproveManager) {
    return res.status(403).json({ success: false, error: 'Forbidden. You do not have Quality Manager approval permission.' });
  }

  if ((targetRole === 'APPROVE_LAB_ENGINEER' && engineerApproved) || (targetRole === 'APPROVE_LAB_MANAGER' && managerApproved)) {
    return res.status(400).json({ success: false, error: 'This role approval has already been submitted.' });
  }

  const newLog = await prisma.approvalLog.create({
    data: {
      lab_request_id: request.id,
      approver_id: req.user.id,
      role: targetRole,
      action,
      comment: comment ? comment.trim() : null
    }
  });

  let finalResult = null;
  if (action === 'Rejected') {
    finalResult = 'FAIL';
  } else {
    const isOtherApproved = targetRole === 'APPROVE_LAB_ENGINEER' ? managerApproved : engineerApproved;
    if (isOtherApproved) {
      finalResult = 'PASS';
    }
  }

  if (finalResult) {
    await prisma.labRequest.update({
      where: { id: request.id },
      data: { 
        result: finalResult,
        status: 'Closed'
      }
    });

    try {
      await emailQueue.add('sendLabApprovalResult', {
        requestId: request.id,
        testNo: request.test_no,
        requestorId: request.requestor_id,
        result: finalResult
      });
    } catch (emailErr) {
      console.error('Failed to enqueue lab approval email job:', emailErr);
    }
  }

  if (req.app.get('io')) {
    await clearDashboardCache('LAB');
    req.app.get('io').emit("lab_dashboard_updated", { requestId: request.id, result: finalResult });
  }

  res.json({
    success: true,
    data: {
      log: newLog,
      requestResult: finalResult
    }
  });
};

module.exports = {
  getRequests,
  getRequestById,
  saveDraft,
  submitRequest,
  assignRequest,
  getInspectors,
  uploadFiles,
  deleteDraft,
  startInspection,
  adjustSchedule,
  completeTesting,
  approveRequest,
};
