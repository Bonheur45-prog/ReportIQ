const express = require('express');
const Company = require('../models/Company');
const { protect } = require('../middleware/auth');
const {
  getAuthUrl,
  exchangeCodeForTokens,
  getDriveClient,
  listSiteFolders,
  getSiteContents,
} = require('../services/driveService');

const router = express.Router();
router.use(protect);

// ── GET /api/drive/auth-url ───────────────────────────────────────────────────
// Returns the Google OAuth URL for the frontend to open
router.get('/auth-url', (req, res) => {
  try {
    const url = getAuthUrl();
    res.status(200).json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate auth URL.' });
  }
});

// ── POST /api/drive/connect ───────────────────────────────────────────────────
// Exchanges auth code for tokens and saves to company
router.post('/connect', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Authorization code is required.' });
    }

    const tokens = await exchangeCodeForTokens(code);

    // Save tokens to company
    await Company.findByIdAndUpdate(req.company._id, { driveToken: tokens });

    res.status(200).json({ success: true, message: 'Google Drive connected successfully.' });
  } catch (error) {
    console.error('Drive connect error:', error.message);
    res.status(400).json({ success: false, message: 'Failed to connect Google Drive. Please try again.' });
  }
});

// ── DELETE /api/drive/disconnect ──────────────────────────────────────────────
router.delete('/disconnect', async (req, res, next) => {
  try {
    await Company.findByIdAndUpdate(req.company._id, {
      driveToken:        null,
      driveRootFolderId: null,
    });
    res.status(200).json({ success: true, message: 'Google Drive disconnected.' });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/drive/root-folder ───────────────────────────────────────────────
// Save the root folder ID for this company
router.post('/root-folder', async (req, res, next) => {
  try {
    const { rootFolderId } = req.body;
    if (!rootFolderId) {
      return res.status(400).json({ success: false, message: 'rootFolderId is required.' });
    }

    await Company.findByIdAndUpdate(req.company._id, { driveRootFolderId: rootFolderId });
    res.status(200).json({ success: true, message: 'Root folder saved.' });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/drive/sites ──────────────────────────────────────────────────────
// Lists site folders from Drive root
router.get('/sites', async (req, res, next) => {
  try {
    if (!req.company.driveToken) {
      return res.status(400).json({ success: false, message: 'Google Drive not connected.' });
    }
    if (!req.company.driveRootFolderId) {
      return res.status(400).json({ success: false, message: 'Root folder not configured.' });
    }

    const drive   = getDriveClient(req.company.driveToken);
    const folders = await listSiteFolders(drive, req.company.driveRootFolderId);

    res.status(200).json({ success: true, data: { folders }, folders });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/drive/sites/:folderId/contents ───────────────────────────────────
// Returns date folders + report files inside a site folder
router.get('/sites/:folderId/contents', async (req, res, next) => {
  try {
    if (!req.company.driveToken) {
      return res.status(400).json({ success: false, message: 'Google Drive not connected.' });
    }

    const drive    = getDriveClient(req.company.driveToken);
    const contents = await getSiteContents(drive, req.params.folderId);

    res.status(200).json({ success: true, data: contents, ...contents });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
