const { cloudinary } = require('../config/cloudinary');

// ── Upload a photo buffer to Cloudinary ───────────────────────────────────────
async function uploadPhoto(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:    options.folder    || 'reportiq/photos',
        public_id: options.publicId  || undefined,
        resource_type: 'image',
        transformation: [
          { width: 1200, crop: 'limit' }, // Cap at 1200px wide — saves storage
          { quality: 'auto:good' },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
}

// ── Upload a DOCX buffer to Cloudinary ────────────────────────────────────────
async function uploadDocx(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:        options.folder    || 'reportiq/documents',
        public_id:     options.publicId  || undefined,
        resource_type: 'raw', // Must be 'raw' for non-image files
        format:        'docx',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
}

// ── Delete a file from Cloudinary ─────────────────────────────────────────────
async function deleteFile(publicId, resourceType = 'image') {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    // Log but don't throw — deletion failure shouldn't break the app
    console.error('Cloudinary delete error:', error.message);
  }
}

// ── Delete multiple files ─────────────────────────────────────────────────────
async function deleteFiles(publicIds, resourceType = 'image') {
  await Promise.allSettled(publicIds.map(id => deleteFile(id, resourceType)));
}

module.exports = { uploadPhoto, uploadDocx, deleteFile, deleteFiles };
