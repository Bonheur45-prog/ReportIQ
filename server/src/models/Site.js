const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Site name is required'],
    trim: true,
    maxlength: [100, 'Site name cannot exceed 100 characters'],
  },
  location: {
    type: String,
    trim: true,
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Google Drive folder ID for this site's raw reports and photos
  driveFolderId: {
    type: String,
    default: null,
  },

  // ID of the raw report Google Doc inside the Drive folder
  reportFileId: {
    type: String,
    default: null,
  },
  reportFileMimeType: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'on_hold'],
    default: 'active',
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  // Stats for dashboard display
  stats: {
    totalReports: { type: Number, default: 0 },
    lastReportAt: { type: Date, default: null },
  },
}, {
  timestamps: true,
});

// Compound index: a company can't have two sites with the same name
siteSchema.index({ name: 1, company: 1 }, { unique: true });

module.exports = mongoose.model('Site', siteSchema);