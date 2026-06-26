const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String, required: [true, 'Company name is required'],
    trim: true, maxlength: [100, 'Company name cannot exceed 100 characters'],
  },
  email: { type: String, required: [true, 'Company email is required'], unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  logo: { type: String, default: null },
  plan: { type: String, enum: ['trial','starter','growth','enterprise'], default: 'trial' },
  planExpiresAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  isActive: { type: Boolean, default: true },
  driveRootFolderId: { type: String, default: null },
  driveToken: { type: Object, default: null },

  // ── AI provider configuration ──────────────────────────────────────────────
  aiConfig: {
    provider: { type: String, default: 'claude' },
    model:    { type: String, default: 'claude-haiku-4-5-20251001' },
    keys: {
      // select: false — API keys never returned in normal queries, must be explicitly requested
      claude: { type: String, default: null, select: false },
      gemini: { type: String, default: null, select: false },
      nvidia: { type: String, default: null, select: false },
      openai: { type: String, default: null, select: false },
    },
  },

  // ── Field worker upload token ──────────────────────────────────────────────
  uploadToken: { type: String, default: null, index: true },

  // ── Usage tracking ─────────────────────────────────────────────────────────
  usage: {
    reportsThisMonth: { type: Number, default: 0 },
    lastResetAt:      { type: Date,   default: Date.now },
  },
}, { timestamps: true });

companySchema.methods.resetMonthlyUsageIfNeeded = function () {
  const now = new Date(); const last = new Date(this.usage.lastResetAt);
  if (now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
    this.usage.reportsThisMonth = 0; this.usage.lastResetAt = now;
  }
};

companySchema.methods.canGenerateReport = function () {
  const limits = { trial: 400, starter: 150, growth: 200, enterprise: Infinity };
  return this.usage.reportsThisMonth < (limits[this.plan] || 0);
};

companySchema.methods.isPlanActive = function () {
  if (this.plan === 'enterprise') return true;
  return new Date() < new Date(this.planExpiresAt);
};

module.exports = mongoose.model('Company', companySchema);