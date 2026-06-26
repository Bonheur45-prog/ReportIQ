const express  = require('express');
const multer   = require('multer');
const sharp    = require('sharp');
const { v4: uuidv4 } = require('uuid');
const Site     = require('../models/Site');
const Company  = require('../models/Company');
const { protect, restrictTo } = require('../middleware/auth');
const {
  getDriveClient,
  getSiteContents,
  findOrCreateFolder,
  uploadFileToDrive,
  appendNotesToDoc,
} = require('../services/driveService');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB — we compress before sending to Drive/Claude
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed.'));
  },
});

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
}

// ── Server-side compression — mirrors WhatsApp/client-side approach ────────────
// Acts as a safety net even if client compression was skipped
async function safeCompress(buffer, mimetype) {
  try {
    const MAX_PX    = 1600;
    const MAX_BYTES = 9 * 1024 * 1024; // 9MB — under Cloudinary's 10MB limit

    const compressed = await sharp(buffer)
      .rotate()  // auto-correct EXIF orientation (phone photos often rotated)
      .resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    // If still too large, compress harder
    if (compressed.length > MAX_BYTES) {
      const harder = await sharp(buffer)
        .rotate()
        .resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 60 })
        .toBuffer();
      return { buffer: harder, mimetype: 'image/jpeg' };
    }

    return { buffer: compressed, mimetype: 'image/jpeg' };
  } catch (err) {
    console.warn('Could not compress image:', err.message, '— using original');
    return { buffer, mimetype };
  }
}

// ── Detect expired/revoked Google token ──────────────────────────────────────
function isTokenExpired(error) {
  const msg = error?.message || error?.response?.data?.error || '';
  const desc = error?.response?.data?.error_description || '';
  return msg.includes('invalid_grant') || desc.includes('expired') || desc.includes('revoked');
}

// ── IMPORTANT: specific routes MUST come before /:token ───────────────────────

// ── POST /api/upload/token/generate ──────────────────────────────────────────
router.post('/token/generate', protect, restrictTo('owner', 'admin'), async (req, res, next) => {
  try {
    const token = uuidv4().replace(/-/g, '');
    await Company.findByIdAndUpdate(req.company._id, { uploadToken: token });
    res.status(200).json({
      success: true,
      data: { uploadToken: token },
      message: 'Upload link generated.',
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/upload/token/set-report-file ────────────────────────────────────
router.post('/token/set-report-file', protect, restrictTo('owner', 'admin'), async (req, res, next) => {
  try {
    const { siteId, reportFileId, reportFileMimeType } = req.body;
    if (!siteId || !reportFileId) {
      return res.status(400).json({ success: false, message: 'siteId and reportFileId are required.' });
    }
    const site = await Site.findOneAndUpdate(
      { _id: siteId, company: req.company._id },
      { reportFileId, reportFileMimeType: reportFileMimeType || 'application/vnd.google-apps.document' },
      { new: true }
    );
    if (!site) return res.status(404).json({ success: false, message: 'Site not found.' });
    res.status(200).json({ success: true, message: 'Report file linked.' });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/upload/:token ────────────────────────────────────────────────────
router.get('/:token', async (req, res, next) => {
  try {
    const company = await Company.findOne({ uploadToken: req.params.token })
      .select('name uploadToken');
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Invalid upload link. Please contact your site manager.',
      });
    }
    const sites = await Site.find({ company: company._id, status: 'active' })
      .select('name location')
      .sort({ name: 1 });
    res.status(200).json({
      success: true,
      data: {
        companyName: company.name,
        sites: sites.map(s => ({ id: s._id, name: s.name, location: s.location })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/upload/:token ───────────────────────────────────────────────────
router.post('/:token', upload.array('photos', 10), async (req, res, next) => {
  try {
    const { siteId, date, notes } = req.body;
    const photos = req.files || [];

    if (!siteId) return res.status(400).json({ success: false, message: 'Please select a site.' });
    if (!date)   return res.status(400).json({ success: false, message: 'Date is required.' });
    if (!notes || notes.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Please write at least a brief description.' });
    }

    const company = await Company.findOne({ uploadToken: req.params.token });
    if (!company) return res.status(404).json({ success: false, message: 'Invalid upload link.' });

    const site = await Site.findOne({ _id: siteId, company: company._id });
    if (!site)    return res.status(404).json({ success: false, message: 'Site not found.' });

    if (!company.driveToken) {
      return res.status(503).json({ success: false, message: 'Drive not connected. Contact your site manager.' });
    }
    if (!site.driveFolderId) {
      return res.status(503).json({ success: false, message: `Drive folder not configured for "${site.name}".` });
    }

    const drive         = getDriveClient(company.driveToken);
    const formattedDate = formatDate(date);

    // 1. Find or create dated folder
    const dateFolder   = await findOrCreateFolder(drive, formattedDate, site.driveFolderId);

    // 2. Find or create /images subfolder
    const imagesFolder = await findOrCreateFolder(drive, 'images', dateFolder.id);

    // 3. Compress and upload photos
    const uploadedPhotos = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const { buffer: compressed, mimetype: compressedType } = await safeCompress(photo.buffer, photo.mimetype);
      const fileName = `photo_${String(i + 1).padStart(2, '0')}_${Date.now()}.jpg`;
      await uploadFileToDrive(drive, compressed, fileName, compressedType, imagesFolder.id);
      uploadedPhotos.push(fileName);
    }

    // 4. Append notes — auto-detect report file if not linked yet
    let reportFileId   = site.reportFileId;
    let reportMimeType = site.reportFileMimeType;

    if (!reportFileId) {
      try {
        const contents = await getSiteContents(drive, site.driveFolderId);
        if (contents.reportFiles && contents.reportFiles.length > 0) {
          reportFileId   = contents.reportFiles[0].id;
          reportMimeType = contents.reportFiles[0].mimeType;
          await Site.findByIdAndUpdate(site._id, { reportFileId, reportFileMimeType: reportMimeType });
          console.log('Auto-detected report file:', reportFileId);
        }
      } catch (findErr) {
        console.error('Could not auto-detect report file:', findErr.message);
      }
    }

    if (reportFileId) {
      try {
        await appendNotesToDoc(drive, reportFileId, formattedDate, notes.trim());
        console.log('Notes appended successfully');
      } catch (docErr) {
        console.error('Could not append notes:', docErr.message);
      }
    } else {
      console.warn('No report file found for site:', site.name);
    }

    res.status(200).json({
      success: true,
      message: `Report submitted for ${site.name} on ${formattedDate}. ${uploadedPhotos.length} photo${uploadedPhotos.length !== 1 ? 's' : ''} uploaded.`,
      data: { date: formattedDate, photosUploaded: uploadedPhotos.length },
    });

  } catch (error) {
    console.error('Upload error:', error.message || error);

    // Give a specific message for expired Drive tokens
    if (isTokenExpired(error)) {
      return res.status(401).json({
        success: false,
        message: 'Google Drive connection has expired. Please ask your site manager to reconnect Drive in Settings.',
        code: 'DRIVE_TOKEN_EXPIRED',
      });
    }

    next(error);
  }
});

module.exports = router;