const prisma = require('../config/db');
const { generateAndStoreFaiPdf } = require('../services/faiReportService');
const { clearDashboardCache } = require('../utils/redisHelper');
const { getAttachmentUrl } = require('../utils/attachmentHelper');

const getReport = async (req, res) => {
  const requestId = parseInt(req.params.id, 10);

  const faiRequest = await prisma.faiRequest.findUnique({
    where: { id: requestId },
    include: {
      faiReport: true
    }
  });

  if (!faiRequest) {
    return res.status(404).json({ message: 'FAI Request not found' });
  }

  const pdfAttachment = await prisma.reportAttachment.findFirst({
    where: {
      parent_id: requestId,
      request_type: 'FAI',
      is_active: true
    },
    orderBy: { created_at: 'desc' }
  });

  const pdfUrl = pdfAttachment
    ? await getAttachmentUrl(pdfAttachment.file_url, pdfAttachment.bucket_name, pdfAttachment.file_name)
    : null;

  res.json({
    data: {
      report_data: faiRequest.faiReport?.report_data || null,
      pdf_url: pdfUrl,
      file_name: pdfAttachment?.file_name || null,
      request_status: faiRequest.status,
      request_result: faiRequest.result
    }
  });
};

const saveDraftReport = async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const { report_data, result, failure_details, improvement_plan, fai_failure_mode } = req.body;

  if (!report_data) {
    return res.status(400).json({ message: 'report_data is required' });
  }

  const faiRequest = await prisma.faiRequest.findUnique({
    where: { id: requestId }
  });

  if (!faiRequest) {
    return res.status(404).json({ message: 'FAI Request not found' });
  }

  const overallResult = result || report_data.result || null;
  if (overallResult) {
    await prisma.faiRequest.update({
      where: { id: requestId },
      data: {
        result: overallResult,
        failure_details: overallResult === 'FAIL' ? (failure_details || report_data.failure_details || null) : null,
        improvement_plan: overallResult === 'FAIL' ? (improvement_plan || report_data.improvement_plan || null) : null,
        fai_failure_mode: overallResult === 'FAIL' ? (fai_failure_mode || report_data.fai_failure_mode || null) : null
      }
    });
  }

  const faiReport = await prisma.faiReport.upsert({
    where: { fai_request_id: requestId },
    update: {
      report_data,
      technician_id: req.user.id
    },
    create: {
      fai_request_id: requestId,
      report_data,
      technician_id: req.user.id
    }
  });

  res.json({
    message: 'Report draft saved successfully',
    data: faiReport
  });
};

const submitReport = async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const { report_data, result, failure_details, improvement_plan, fai_failure_mode } = req.body;

  if (!report_data) {
    return res.status(400).json({ message: 'report_data is required' });
  }

  const faiRequest = await prisma.faiRequest.findUnique({
    where: { id: requestId }
  });

  if (!faiRequest) {
    return res.status(404).json({ message: 'FAI Request not found' });
  }

  // Determine overall result if not provided
  let overallResult = result;
  if (!overallResult) {
    const shapeAndDim = report_data.shape_and_dimension || [];
    const hasFail = shapeAndDim.some(item => item.result === 'FAIL');
    overallResult = hasFail ? 'FAIL' : 'PASS';
  }

  // Update or Create FaiReport
  const faiReport = await prisma.faiReport.upsert({
    where: { fai_request_id: requestId },
    update: {
      report_data,
      technician_id: req.user.id
    },
    create: {
      fai_request_id: requestId,
      report_data,
      technician_id: req.user.id
    }
  });

  const failDetailsText = overallResult === 'FAIL' ? (failure_details || report_data?.failure_details || null) : null;
  const impPlanText = overallResult === 'FAIL' ? (improvement_plan || report_data?.improvement_plan || null) : null;
  const failureModeId = overallResult === 'FAIL' ? (fai_failure_mode ? parseInt(fai_failure_mode, 10) : (report_data?.fai_failure_mode ? parseInt(report_data.fai_failure_mode, 10) : null)) : null;

  // Update FaiRequest complete_date, result, failure_details, improvement_plan, fai_failure_mode
  await prisma.faiRequest.update({
    where: { id: requestId },
    data: {
      complete_date: new Date(),
      result: overallResult,
      failure_details: failDetailsText,
      improvement_plan: impPlanText,
      fai_failure_mode: failureModeId,
      status: 'Ongoing' // Waiting for approval flow
    }
  });

  // Generate PDF and upload to MinIO
  let pdfResult = null;
  try {
    pdfResult = await generateAndStoreFaiPdf(requestId);
  } catch (pdfErr) {
    console.error('Failed to generate PDF report:', pdfErr);
  }

  await clearDashboardCache();

  res.json({
    message: 'Report submitted successfully',
    data: {
      faiReport,
      result: overallResult,
      pdf_url: pdfResult?.fileUrl || null
    }
  });
};

const exportPdf = async (req, res) => {
  const requestId = parseInt(req.params.id, 10);

  try {
    const pdfResult = await generateAndStoreFaiPdf(requestId);
    res.json({
      message: 'PDF exported successfully',
      data: {
        pdf_url: pdfResult.fileUrl
      }
    });
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).json({ message: 'Failed to generate PDF report', error: err.message });
  }
};

module.exports = {
  getReport,
  saveDraftReport,
  submitReport,
  exportPdf
};
