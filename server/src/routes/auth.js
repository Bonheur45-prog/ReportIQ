const express   = require('express');
const jwt       = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User      = require('../models/User');
const Company   = require('../models/Company');
const { protect } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// ── Helper: sign JWT ──────────────────────────────────────────────────────────
const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ── Helper: send token response ───────────────────────────────────────────────
const sendTokenResponse = (user, company, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id:      user._id,
      name:    user.name,
      email:   user.email,
      role:    user.role,
    },
    company: {
      id:      company._id,
      name:    company.name,
      plan:    company.plan,
      planExpiresAt: company.planExpiresAt,
    },
  });
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Creates a new company + owner user in one step
router.post('/register', [
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('name').trim().notEmpty().withMessage('Your name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('phone').optional().trim(),
], async (req, res, next) => {
  try {
    // Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { companyName, name, email, password, phone } = req.body;

    // Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Create company first
    const company = await Company.create({
      name:  companyName,
      email: email,
      phone: phone || null,
    });

    // Create owner user
    const user = await User.create({
      name,
      email,
      password,
      role:    'owner',
      company: company._id,
    });

    sendTokenResponse(user, company, 201, res);

  } catch (error) {
    next(error);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    // Get user with password (select: false by default)
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Get company
    const company = await Company.findById(user.company);
    if (!company || !company.isActive) {
      return res.status(403).json({ success: false, message: 'Company account is inactive.' });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, company, 200, res);

  } catch (error) {
    next(error);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns current user + company info
router.get('/me', protect, async (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id:    req.user._id,
      name:  req.user.name,
      email: req.user.email,
      role:  req.user.role,
    },
    company: {
      id:              req.company._id,
      name:            req.company.name,
      plan:            req.company.plan,
      planExpiresAt:   req.company.planExpiresAt,
      isPlanActive:    req.company.isPlanActive(),
      usage:           req.company.usage,
      driveConnected:  !!req.company.driveToken,
      uploadToken:     req.company.uploadToken || null,
    },
  });
});

// ── POST /api/auth/change-password ────────────────────────────────────────────
router.post('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password          = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;