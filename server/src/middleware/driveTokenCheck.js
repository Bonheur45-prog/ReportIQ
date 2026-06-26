// Middleware helper — detects expired Google Drive tokens
// and returns a clear message instead of a generic 500

function isExpiredToken(error) {
  const msg  = error?.message || '';
  const data = error?.response?.data || {};
  return (
    msg.includes('invalid_grant') ||
    data.error === 'invalid_grant' ||
    (data.error_description || '').includes('expired') ||
    (data.error_description || '').includes('revoked')
  );
}

function handleDriveError(error, res, next) {
  if (isExpiredToken(error)) {
    return res.status(401).json({
      success: false,
      message: 'Google Drive connection has expired. Please reconnect Drive in Settings.',
      code: 'DRIVE_TOKEN_EXPIRED',
    });
  }
  next(error);
}

module.exports = { isExpiredToken, handleDriveError };