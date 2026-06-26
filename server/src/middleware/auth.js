const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Company = require('../models/Company');

// Verify JWT and attach user + company to request
const protect = async (req, res, next) => {
  try {
    // 1. Get token from Authorization header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
    }

    // 3. Check user still exists and is active
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User no longer exists or has been deactivated.' });
    }

    // 4. Check if password was changed after token was issued
    if (user.passwordChangedAfter(decoded.iat)) {
      return res.status(401).json({ success: false, message: 'Password recently changed. Please log in again.' });
    }

    // 5. Check company is still active and plan is valid
    const company = await Company.findById(user.company);
    if (!company || !company.isActive) {
      return res.status(403).json({ success: false, message: 'Your company account is inactive. Please contact support.' });
    }

    // 6. Reset monthly usage if needed
    company.resetMonthlyUsageIfNeeded();
    await company.save();

    // Attach to request for use in route handlers
    req.user    = user;
    req.company = company;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication error. Please try again.' });
  }
};

// Restrict to specific roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
