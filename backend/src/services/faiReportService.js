const puppeteer = require('puppeteer');
const crypto = require('crypto');
const prisma = require('../config/db');
const { minioClient, minioClientPublic, MINIO_REPORT_BUCKET } = require('../config/minioClient');
const { cleanupOrphanedReportAttachments, getAttachmentUrl } = require('../utils/attachmentHelper');
const { format } = require('date-fns');

const formatDateStr = (date) => {
  if (!date) return '';
  try {
    return format(new Date(date), 'dd-MMM-yy');
  } catch (e) {
    return '';
  }
};

const generateFaiReportHtml = ({ faiRequest, reportData, technicianName, engineerApprover, displayFileName }) => {
  const {
    unit = '',
    sample_qty = faiRequest.sample_qty || '',
    lot_submission = [],
    shape_and_dimension = [],
    notes_check = [],
    comments = ''
  } = reportData || {};

  const partName = faiRequest.part_name || '';
  const partNumber = faiRequest.part_no || '';
  const supplierName = faiRequest.supplier?.name || faiRequest.supplier?.full_name || '';
  const rev = faiRequest.revision || '';
  const reportDate = formatDateStr(faiRequest.complete_date);
  
  const inspectionBy = technicianName || faiRequest.inspector?.full_name || '';
  const inspectionDate = formatDateStr(faiRequest.complete_date);
  
  const checkedBy = engineerApprover?.approver?.full_name || '';
  const checkedDate = formatDateStr(engineerApprover?.created_at);

  const actualNotesCheck = Array.isArray(notes_check) ? notes_check : [];
  const notesCheckRowCount = actualNotesCheck.length > 0 ? actualNotesCheck.length + 1 : 1; // +1 for Comments row

  // Chunk shape_and_dimension into pages of max 25 items, counting notes_check on the final page
  const chunkSize = 25;
  const dimensionChunks = [];
  let currentChunk = [];
  let currentCost = 0;

  for (let i = 0; i < shape_and_dimension.length; i++) {
    const item = shape_and_dimension[i];
    const rType = item.row_type || 'STANDARD';
    const itemCost = (rType === 'COATING_THICKNESS' || rType === 'RANGE') ? 2 : 1;

    if (currentCost + itemCost > chunkSize) {
      dimensionChunks.push(currentChunk);
      currentChunk = [item];
      currentCost = itemCost;
    } else {
      currentChunk.push(item);
      currentCost += itemCost;
    }
  }

  if (currentChunk.length > 0) {
    if (currentCost + notesCheckRowCount > chunkSize && currentChunk.length > 1) {
      const keepCount = Math.max(1, chunkSize - notesCheckRowCount);
      dimensionChunks.push(currentChunk.slice(0, keepCount));
      dimensionChunks.push(currentChunk.slice(keepCount));
    } else {
      dimensionChunks.push(currentChunk);
    }
  }

  if (dimensionChunks.length === 0) {
    dimensionChunks.push([]);
  }

  const totalPages = dimensionChunks.length;

  const renderMasterTable = (chunkItems, isLastPage) => `
    <table class="main-table">
      <colgroup>
        <col style="width: 5.6%;">
        <col style="width: 3%;">
        <col style="width: 13.4%;">
        <col style="width: 6%;">
        <col style="width: 6%;">
        <col style="width: 10%;">
        <col style="width: 7%;">
        <col style="width: 7%;">
        <col style="width: 7%;">
        <col style="width: 7%;">
        <col style="width: 7%;">
        <col style="width: 6%;">
        <col style="width: 12%;">
      </colgroup>
      <!-- 1. META TABLE HEADER ROWS -->
      <tbody>
        <tr>
          <td colspan="3" rowspan="2" class="bg-gray font-bold">Part Name</td>
          <td colspan="2" rowspan="2" style="font-weight: 500;">${partName}</td>
          <td colspan="8" class="bg-gray font-bold text-center">Lot Submission</td>
        </tr>
        <tr>
          <td colspan="8" style="padding: 0;">
            <table style="width: 100%; border-collapse: collapse; margin: 0; border: none;">
              <tr>
                ${[1, 2, 3, 4, 5].map(num => `
                  <td class="text-center" style="border-top: none; border-bottom: none; ${num === 1 ? 'border-left: none;' : ''} width: 10%; font-size: 11px;">${lot_submission.includes(num) ? '☑' : '☐'}</td>
                  <td class="text-center font-bold" style="border-top: none; border-bottom: none; ${num === 5 ? 'border-right: none;' : ''} width: 10%;">${num}</td>
                `).join('')}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td colspan="3" class="bg-gray font-bold">Part Number</td>
          <td colspan="2">${partNumber}</td>
          <td colspan="3" class="bg-gray font-bold text-center">Sample Qty(pcs)</td>
          <td colspan="2" class="text-center">${sample_qty}</td>
          <td colspan="2" class="bg-gray font-bold text-center">Date</td>
          <td class="text-center">${reportDate}</td>
        </tr>
        <tr>
          <td colspan="3" class="bg-gray font-bold">Supplier Name</td>
          <td colspan="2">${supplierName}</td>
          <td colspan="3" class="bg-gray font-bold text-center">Rev</td>
          <td colspan="2" class="text-center">${rev}</td>
          <td colspan="2" class="bg-gray font-bold text-center">Unit</td>
          <td class="text-center">${unit}</td>
        </tr>
      </tbody>

        <!-- 2. MAIN TABLE HEADER ROWS -->
        <tr class="bg-gray font-bold text-center text-xs">
          <td rowspan="2">Items</td>
          <td rowspan="2">No.</td>
          <td rowspan="2">Specifications</td>
          <td rowspan="2">-TOL</td>
          <td rowspan="2">+TOL</td>
          <td rowspan="2">Machine/Tool</td>
          <td colspan="5">Sample No.</td>
          <td rowspan="2">Result</td>
          <td rowspan="2">Remark</td>
        </tr>
        <tr class="bg-gray font-bold text-center text-xs">
          <td style="font-weight: bold;">#1</td>
          <td style="font-weight: bold;">#2</td>
          <td style="font-weight: bold;">#3</td>
          <td style="font-weight: bold;">#4</td>
          <td style="font-weight: bold;">#5</td>
        </tr>

      <!-- 3. SHAPE AND DIMENSION DATA ROWS -->
      <tbody>
        ${renderRows(chunkItems)}

        <!-- 4. NOTES CHECK & COMMENTS ROWS (Only on Last Page) -->
        ${isLastPage && actualNotesCheck.length > 0 ? actualNotesCheck.map((nc, i) => `
          <tr>
            ${i === 0 ? `<td rowspan="${actualNotesCheck.length}" class="side-title">Notes Check</td>` : ''}
            <td class="text-center font-semibold">${nc.no || (i + 1)}</td>
            <td class="text-center font-medium">${nc.check_item || ''}</td>
            <td colspan="10" class="text-center font-bold">${nc.result || ''}</td>
          </tr>
        `).join('') : ''}

        ${isLastPage ? `
          <tr>
            <td colspan="2" class="font-bold text-center">Comments:</td>
            <td colspan="11" class="text-center font-bold text-lg">${comments || ''}</td>
          </tr>
          <tr>
            <td colspan="2" class="font-bold text-center" style="font-size: 10px;">Inspection By:</td>
            <td colspan="2" class="text-center">${inspectionBy}</td>
            <td class="font-bold text-center" style="font-size: 10px;">Date:</td>
            <td>${inspectionDate}</td>
            <td class="font-bold text-center" style="font-size: 10px;">Checked by:</td>
            <td colspan="2" class="text-center">${checkedBy}</td>
            <td class="font-bold text-center" style="font-size: 10px;">Date:</td>
            <td colspan="2" class="text-center">${checkedDate}</td>
            <td class="text-right text-xs" style="font-size: 8px;">Form No.: QAPR0027-00-01</td>
          </tr>
        ` : ''}
      </tbody>
    </table>
  `;

  const renderStrikethroughCell = () => `<td></td>`;

  const renderRows = (chunkItems) => {
    const totalTrCount = chunkItems.reduce((acc, item) => {
      const rType = item.row_type || 'STANDARD';
      return acc + (rType === 'COATING_THICKNESS' || rType === 'RANGE' ? 2 : 1);
    }, 0);

    return chunkItems.map((item, idx) => {
      const itemNo = item.item_no || (idx + 1);
      const rowType = item.row_type || 'STANDARD';
      const sideTitleTd = idx === 0 ? `
        <td rowspan="${totalTrCount}" class="side-title">
          Shape and Dimension<br/>(Pls refer to XP DRW. attached)
        </td>
      ` : '';

      if (rowType === 'LIMITED_EQUIPMENT' || item.is_unmeasurable) {
        return `
          <tr>
            ${sideTitleTd}
            <td class="text-center font-semibold">${itemNo}</td>
            <td>${item.spec || ''}</td>
            <td colspan="2" class="text-center font-medium">${item.condition || ''}</td>
            <td colspan="6" class="text-center font-medium text-gray-700 bg-gray-50">
              ${item.remark_text || ''}
            </td>
            <td class="text-center font-bold">${item.result || ''}</td>
            <td>${item.remark || ''}</td>
          </tr>
        `;
      }

      if (rowType === 'COATING_THICKNESS' || rowType === 'RANGE') {
        // Range row with Min / Max sub-rows
        return `
          <tr>
            ${sideTitleTd}
            <td rowspan="2" class="text-center font-semibold">${itemNo}</td>
            <td rowspan="2">${item.spec || ''}</td>
            <td colspan="2" rowspan="2" class="text-center font-medium">${item.condition || ''}</td>
            <td rowspan="2" class="text-center">${item.machine || ''}</td>
            <!-- Sample Min row -->
            ${[1, 2, 3, 4, 5].map(sNum => {
              if (sNum > sample_qty) return renderStrikethroughCell();
              const sampleVal = item.samples?.find(s => s.sample_no === sNum);
              return `<td class="text-xs">${sampleVal?.min_val ?? sampleVal?.min ? 'Min:' + (sampleVal?.min_val ?? sampleVal?.min) : ''}</td>`;
            }).join('')}
            <td rowspan="2" class="text-center font-bold">${item.result || ''}</td>
            <td rowspan="2">${item.remark || ''}</td>
          </tr>
          <tr>
            <!-- Sample Max row -->
            ${[1, 2, 3, 4, 5].map(sNum => {
              if (sNum > sample_qty) return renderStrikethroughCell();
              const sampleVal = item.samples?.find(s => s.sample_no === sNum);
              return `<td class="text-xs">${sampleVal?.max_val ?? sampleVal?.max ? 'Max:' + (sampleVal?.max_val ?? sampleVal?.max) : ''}</td>`;
            }).join('')}
          </tr>
        `;
      }

      // Standard Row
      return `
        <tr>
          ${sideTitleTd}
          <td class="text-center font-semibold">${itemNo}</td>
          <td>${item.spec || ''}</td>
          <td class="text-center">${item.minus_tol || ''}</td>
          <td class="text-center">${item.plus_tol || ''}</td>
          <td class="text-center">${item.machine || ''}</td>
          ${[1, 2, 3, 4, 5].map(sNum => {
            if (sNum > sample_qty) return renderStrikethroughCell();
            const sampleVal = item.samples?.find(s => s.sample_no === sNum);
            const val = typeof sampleVal === 'object' ? (sampleVal?.val ?? sampleVal?.value ?? '') : (sampleVal ?? '');
            return `<td class="text-center">${val}</td>`;
          }).join('')}
          <td class="text-center font-bold">${item.result || ''}</td>
          <td>${item.remark || ''}</td>
        </tr>
      `;
    }).join('');
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${displayFileName || 'FAI Inspection Report'}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 8mm;
        }
        * {
          box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif;
        }
        body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: #000;
          font-size: 11px;
        }
        .page {
          width: 281mm;
          height: 190mm;
          max-height: 190mm;
          margin: 0 auto;
          page-break-after: always;
          page-break-inside: avoid;
          break-inside: avoid;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .page:last-child {
          page-break-after: auto;
        }
        .header-container {
          margin-top: 0;
          margin-bottom: 0;
          overflow: hidden;
        }
        .logo-company-group {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 100px;
          margin-top: 0;
          margin-bottom: 10px;
          overflow: hidden;
        }
        .logo-box {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -1px;
          line-height: 1;
        }
        .logo-xp {
          background: #000;
          color: #fff;
          padding: 2px 7px;
        }
        .logo-power {
          color: #000;
          margin-left: 2px;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #000;
        }
        .report-title {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          color: #000;
          margin-bottom: 4px;
        }
        .meta-table, .main-table, .signature-table, .notes-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          margin-bottom: 0;
        }
        .main-table, .notes-table, .signature-table {
          margin-top: -1px;
        }
        .meta-table td, .main-table th, .main-table td, .signature-table td, .notes-table td {
          border: 1px solid #000;
          padding: 3px 4px;
          font-size: 10.5px;
          text-align: center;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .bg-gray {
          background-color: transparent;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }
        .text-xs { font-size: 9.5px; }
        .text-lg { font-size: 14px; }
        .side-title {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          text-align: center;
          font-weight: bold;
          font-size: 9px;
          padding: 2px;
        }
        .table-wrapper {
          margin: 0;
        }
        .page-footer {
          display: flex;
          justify-content: flex-end;
          font-size: 9px;
          margin-top: 4px;
        }
      </style>
    </head>
    <body>
      ${dimensionChunks.map((chunk, pIndex) => `
        <div class="page">
          <div class="header-container">
            <div class="logo-company-group">
              <div class="logo-box">
                <span class="logo-xp">XP</span><span class="logo-power">Power</span>
              </div>
              <div class="company-name">
                XP Power (VietNam) Limited
              </div>
            </div>

            <div class="report-title">
              FAI - Material Sample Inspection Report
            </div>
          </div>

          <div class="table-wrapper">
            ${renderMasterTable(chunk, pIndex === totalPages - 1)}
          </div>

          <div class="page-footer">
            <span>Page ${pIndex + 1} of ${totalPages}</span>
          </div>
        </div>
      `).join('')}
    </body>
    </html>
  `;
};

const generateAndStoreFaiPdf = async (faiRequestId) => {
  const faiRequest = await prisma.faiRequest.findUnique({
    where: { id: parseInt(faiRequestId, 10) },
    include: {
      supplier: true,
      commodityPartRel: true,
      inspector: true,
      faiReport: true,
      approvalLogs: {
        where: { role: 'APPROVE_FAI_ENGINEER', action: 'Approved' },
        include: { approver: true },
        orderBy: { created_at: 'desc' },
        take: 1
      }
    }
  });

  if (!faiRequest) {
    throw new Error('FAI Request not found');
  }

  const reportData = faiRequest.faiReport?.report_data || {};
  const technicianName = faiRequest.inspector?.full_name || '';
  const engineerApprover = faiRequest.approvalLogs[0] || null;

  // Format user-facing file name
  const failTag = faiRequest.result === 'FAIL' ? ' FAIL' : '';
  const partNo = faiRequest.part_no || '';
  const commodityName = faiRequest.commodityPartRel?.name || '';
  const supplierName = faiRequest.supplier?.name || '';
  const rev = faiRequest.revision || '';
  const displayFileName = `FAI${failTag} REPORT ${partNo} ${commodityName}_${supplierName}_REV ${rev}.pdf`.replace(/\s+/g, ' ').trim();

  const htmlContent = generateFaiReportHtml({
    faiRequest,
    reportData,
    technicianName,
    engineerApprover,
    displayFileName
  });

  let browser;
  try {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfUint8 = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
    });

    await browser.close();

    const pdfBuffer = Buffer.from(pdfUint8);

    // Ensure MinIO report bucket exists
    const bucketExists = await minioClient.bucketExists(MINIO_REPORT_BUCKET);
    if (!bucketExists) {
      await minioClient.makeBucket(MINIO_REPORT_BUCKET);
    }

    // Upload to MinIO bucket 'reports'
    const fileName = `${crypto.randomUUID()}.pdf`;
    await minioClient.putObject(
      MINIO_REPORT_BUCKET,
      fileName,
      pdfBuffer,
      pdfBuffer.length,
      { 'Content-Type': 'application/pdf' }
    );

    // Get presigned URL with displayFileName attachment header
    const fileUrl = await getAttachmentUrl(fileName, MINIO_REPORT_BUCKET, displayFileName);

    // Clean up old report attachments for this FAI Request
    await cleanupOrphanedReportAttachments(faiRequest.id);

    // Save into report_attachments table (store UUID object key in file_url, formatted display name in file_name)
    const attachment = await prisma.reportAttachment.create({
      data: {
        parent_id: faiRequest.id,
        request_type: 'FAI',
        file_name: displayFileName,
        file_url: fileName,
        bucket_name: MINIO_REPORT_BUCKET
      }
    });

    return {
      attachment,
      fileUrl
    };
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
};

module.exports = {
  generateFaiReportHtml,
  generateAndStoreFaiPdf
};
