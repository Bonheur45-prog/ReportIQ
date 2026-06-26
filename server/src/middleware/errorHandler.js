// Central error handler — all errors in the app flow here via next(error)

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Something went wrong. Please try again.';

  // Log all errors in development, only 500s in production
  if (process.env.NODE_ENV === 'development') {
    console.error('ERROR:', err);
  } else if (statusCode === 500) {
    console.error('SERVER ERROR:', err);
  }

  // Mongoose duplicate key error (e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    message    = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
    statusCode = 409;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    message    = Object.values(err.errors).map(e => e.message).join('. ');
    statusCode = 400;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    message    = `Invalid ${err.path}: ${err.value}`;
    statusCode = 400;
  }

  // JWT errors (handled in auth middleware but catch here as fallback)
  if (err.name === 'JsonWebTokenError')  { message = 'Invalid token.';  statusCode = 401; }
  if (err.name === 'TokenExpiredError')  { message = 'Token expired.';  statusCode = 401; }

  res.status(statusCode).json({
    success: false,
    message,
    // Only send stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Helper to create errors with status codes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, AppError };
