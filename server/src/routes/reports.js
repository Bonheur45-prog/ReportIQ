const express  = require('express');
const mammoth  = require('mammoth');
const { body, query, validationResult } = require('express-validator');

const Report   = require('../models/Report');
const Site     = require('../models/Site');
const Company  = require('../models/Company');

const { protect, restrictTo }      = require('../middleware/auth');
const { AppError }                 = require('../middleware/errorHandler');
const { generateReportEntry }      = require('../services/aiService');
const { generateDocx }             = require('../services/docxService');
const { uploadPhoto, uploadDocx, deleteFiles } = require('../services/cloudinaryService');
const {
  getDriveClient,
  getSiteContents,
  downloadFile,
  getPhotosFromDateFolder,
  findDateFolder,
  parseEntriesByDate,
} = require('../services/driveService');

const router = express.Router();
router.use(protect);

// ── POST /api/reports/generate ────────────────────────────────────────────────
// Core endpoint — generates report entries from Drive data
router.post('/generate', restrictTo('owner', 'admin'), [
  body('siteId').notEmpty().withMessage('siteId is required'),
  body('reportFileId').notEmpty().withMessage('reportFileId is required'),
  body('reportFileMimeType').notEmpty().withMessage('reportFileMimeType is required'),
  body('selectedDates').isArray({ min: 1, max: 7 }).withMessage('Select between 1 and 7 dates'),
  body('maxPhotos').isInt({ min: 1, max: 10 }).withMessage('maxPhotos must be between 1 and 10'),
], async (req, res, next) => {
  // Use SSE for streaming progress to the client
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const log = (message, data = {}) => {
    res.write(`data: ${JSON.stringify({ message, ...data })}\n\n`);
  };

  try {
    // 1. Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log('error', { error: errors.array()[0].msg });
      return res.end();
    }

    const { siteId, reportFileId, reportFileMimeType, selectedDates, maxPhotos } = req.body;

    // 2. Verify site belongs to this company
    const site = await Site.findOne({ _id: siteId, company: req.company._id });
    if (!site) {
      log('error', { error: 'Site not found.' });
      return res.end();
    }

    // 3. Check plan limits
    req.company.resetMonthlyUsageIfNeeded();
    if (!req.company.isPlanActive()) {
      log('error', { error: 'Your plan has expired. Please renew your subscription.' });
      return res.end();
    }
    if (!req.company.canGenerateReport()) {
      log('error', { error: 'You have reached your monthly report limit. Please upgrade your plan.' });
      return res.end();
    }

    // 4. Check Drive is connected
    if (!req.company.driveToken) {
      log('error', { error: 'Google Drive is not connected. Please connect it in Settings.' });
      return res.end();
    }

    // 5. Connect to Drive
    log('Connecting to Google Drive...');
    const drive = getDriveClient(req.company.driveToken);

    // 6. Download and parse raw report
    log('Reading raw report...');
    const reportBuffer       = await downloadFile(drive, reportFileId, reportFileMimeType);
    const { value: rawText } = await mammoth.extractRawText({ buffer: reportBuffer });

    // 7. Parse entries for selected dates
    const entries = parseEntriesByDate(rawText, selectedDates);
    if (entries.length === 0) {
      log('error', { error: 'No matching entries found for the selected dates in the raw report.' });
      return res.end();
    }

    // 8. Get date folders for this site
    const { dateFolders } = await getSiteContents(drive, site.driveFolderId);

    // 9. Process each entry
    const generatedEntries = [];
    let   totalInputTokens  = 0;
    let   totalOutputTokens = 0;

    for (const entry of entries) {
      log(`Processing ${entry.date}...`);

      // Find matching date folder
      const dateFolder    = findDateFolder(dateFolders, entry.date);
      const photoDataList = [];

      if (dateFolder) {
        log(`Loading photos for ${entry.date}...`);
        const photoFiles = await getPhotosFromDateFolder(drive, dateFolder.id, maxPhotos);

        for (const photoFile of photoFiles) {
          const buf = await downloadFile(drive, photoFile.id, photoFile.mimeType);
          photoDataList.push({
            buffer:   buf,
            base64:   buf.toString('base64'),
            mimeType: photoFile.mimeType,
            name:     photoFile.name,
          });
        }
      }

      // Generate AI entry
      log(`Generating AI entry for ${entry.date}...`);
      // Load company with AI keys for provider selection
      const companyWithKeys = await Company.findById(req.company._id)
        .select('aiConfig.provider aiConfig.model aiConfig.keys');

      const aiResult = await generateReportEntry(
        site.name,
        entry.date,
        entry.rawText,
        photoDataList,
        companyWithKeys?.aiConfig
      );

      totalInputTokens  += aiResult.inputTokens;
      totalOutputTokens += aiResult.outputTokens;

      // Upload photos to Cloudinary
      log(`Saving photos for ${entry.date}...`);
      const savedPhotos = [];
      for (let i = 0; i < photoDataList.length; i++) {
        const photo    = photoDataList[i];
        const uploaded = await uploadPhoto(photo.buffer, {
          folder:   `reportiq/${req.company._id}/${siteId}/${entry.date}`,
          publicId: `photo_${i + 1}`,
        });
        savedPhotos.push({
          url:      uploaded.url,
          publicId: uploaded.publicId,
          caption:  `Image ${i + 1}`,
          order:    i,
        });
      }

      generatedEntries.push({
        date:          entry.date,
        rawNotes:      entry.rawText,
        formattedText: aiResult.text,
        photos:        savedPhotos,
        // For DOCX generation — include buffers temporarily
        _photoBuffers: photoDataList.map((p, i) => ({
          buffer:   p.buffer,
          name:     p.name,
          mimeType: p.mimeType,
        })),
        inputTokens:  aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
      });
    }

    // 10. Generate DOCX
    log('Building DOCX file...');
    const docxEntries = generatedEntries.map(e => ({
      date:          e.date,
      formattedText: e.formattedText,
      photos:        e._photoBuffers,
    }));
    const docxBuffer = await generateDocx(site.name, docxEntries);

    // 11. Upload DOCX to Cloudinary
    log('Saving DOCX...');
    const dateRange    = `${selectedDates[0]}_to_${selectedDates[selectedDates.length - 1]}`;
    const uploadedDocx = await uploadDocx(docxBuffer, {
      folder:   `reportiq/${req.company._id}/${siteId}/documents`,
      publicId: `report_${dateRange}_${Date.now()}`,
    });

    // 12. Save each entry to MongoDB
    log('Saving reports to database...');
    const savedReports = [];
    for (const entry of generatedEntries) {
      const report = await Report.create({
        site:          siteId,
        company:       req.company._id,
        createdBy:     req.user._id,
        date:          entry.date,
        rawNotes:      entry.rawNotes,
        generatedText: entry.formattedText,
        photos:        entry.photos,
        docxUrl:       uploadedDocx.url,
        docxPublicId:  uploadedDocx.publicId,
        tokenUsage: {
          inputTokens:  entry.inputTokens,
          outputTokens: entry.outputTokens,
        },
      });
      savedReports.push(report._id);
    }

    // 13. Update site stats
    await Site.findByIdAndUpdate(siteId, {
      $inc: { 'stats.totalReports': generatedEntries.length },
      'stats.lastReportAt': new Date(),
    });

    // 14. Update company usage
    req.company.usage.reportsThisMonth += generatedEntries.length;
    await req.company.save();

    // 15. Done — send result ID (client fetches full result separately)
    log('done', {
      reportIds:    savedReports,
      docxUrl:      uploadedDocx.url,
      entriesCount: generatedEntries.length,
      tokenUsage: {
        input:  totalInputTokens,
        output: totalOutputTokens,
      },
    });
    res.end();

  } catch (error) {
    console.error('Report generation error:', error);
    log('error', { error: error.message || 'Generation failed. Please try again.' });
    res.end();
  }
});

// ── GET /api/reports ──────────────────────────────────────────────────────────
// List reports — filterable by site, date range, status
router.get('/', async (req, res, next) => {
  try {
    const { siteId, from, to, status, page = 1, limit = 20 } = req.query;

    const filter = { company: req.company._id };
    if (siteId)  filter.site   = siteId;
    if (status)  filter.status = status;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to)   filter.date.$lte = to;
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Report.countDocuments(filter);

    const reports = await Report.find(filter)
      .populate('site', 'name location')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-rawNotes -generatedText'); // Exclude heavy fields from list view

    res.status(200).json({
      success: true,
      data: {
        reports,
        total,
        page:    parseInt(page),
        pages:   Math.ceil(total / parseInt(limit)),
      },
      reports,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/reports/:id ──────────────────────────────────────────────────────
// Get full report with generated text and photos
router.get('/:id', async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, company: req.company._id })
      .populate('site', 'name location')
      .populate('createdBy', 'name');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    res.status(200).json({ success: true, data: { report }, report });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /api/reports/:id/status ─────────────────────────────────────────────
// Update report status (generated → reviewed → approved)
router.patch('/:id/status', restrictTo('owner', 'admin'), [
  body('status').isIn(['generated', 'reviewed', 'approved']).withMessage('Invalid status'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const report = await Report.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      { status: req.body.status },
      { new: true }
    );

    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    res.status(200).json({ success: true, data: { report }, report });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /api/reports/:id ───────────────────────────────────────────────────
router.delete('/:id', restrictTo('owner'), async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, company: req.company._id });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });

    // Delete photos from Cloudinary
    const photoPublicIds = report.photos.map(p => p.publicId).filter(Boolean);
    if (photoPublicIds.length > 0) await deleteFiles(photoPublicIds, 'image');

    // Delete DOCX from Cloudinary
    if (report.docxPublicId) await deleteFiles([report.docxPublicId], 'raw');

    // Update site stats
    await Site.findByIdAndUpdate(report.site, {
      $inc: { 'stats.totalReports': -1 },
    });

    await report.deleteOne();
    res.status(200).json({ success: true, message: 'Report deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
