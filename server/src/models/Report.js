const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  url:       { type: String, required: true }, // Cloudinary URL
  publicId:  { type: String, required: true }, // Cloudinary public_id for deletion
  caption:   { type: String, default: '' },
  order:     { type: Number, default: 0 },
}, { _id: false });

const reportSchema = new mongoose.Schema({
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
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
  date: {
    type: String, // Store as string e.g. "08-06-2026" to match Drive folder names
    required: true,
  },
  // Raw notes as received from Drive
  rawNotes: {
    type: String,
    default: '',
  },
  // AI-generated professional text
  generatedText: {
    type: String,
    required: true,
  },
  // Photos stored on Cloudinary
  photos: [photoSchema],
  // Final DOCX file stored on Cloudinary
  docxUrl: {
    type: String,
    default: null,
  },
  docxPublicId: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['generated', 'reviewed', 'approved'],
    default: 'generated',
  },
  // AI model used (for future model switching)
  aiModel: {
    type: String,
    default: 'claude-haiku-4-5-20251001',
  },
  // Token usage for cost tracking
  tokenUsage: {
    inputTokens:  { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
});

// Index for fast queries by site + date
reportSchema.index({ site: 1, date: 1 });
reportSchema.index({ company: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
