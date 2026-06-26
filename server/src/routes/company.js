const express = require('express');
const { body, validationResult } = require('express-validator');
const Company = require('../models/Company');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ── GET /api/company/profile ──────────────────────────────────────────────────
router.get('/profile', async (req, res, next) => {
  try {
    const company = await Company.findById(req.company._id).select('-driveToken -__v');
    res.status(200).json({ success: true, data: { company } });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /api/company/profile ────────────────────────────────────────────────
router.patch('/profile', restrictTo('owner', 'admin'), [
  body('name').optional().trim().notEmpty().withMessage('Company name cannot be empty'),
  body('phone').optional().trim(),
  body('address').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const allowed = ['name', 'phone', 'address'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update.' });
    }

    const company = await Company.findByIdAndUpdate(
      req.company._id,
      updates,
      { new: true, runValidators: true }
    ).select('-driveToken -__v');

    res.status(200).json({ success: true, data: { company }, message: 'Profile updated successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;