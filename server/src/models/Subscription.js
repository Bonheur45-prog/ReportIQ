const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  plan: {
    type: String,
    enum: ['starter', 'growth', 'enterprise'],
    required: true,
  },
  amount: {
    type: Number,
    required: true, // Amount in RWF
  },
  currency: {
    type: String,
    default: 'RWF',
  },
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed', 'cancelled'],
    default: 'pending',
  },
  // MTN MoMo transaction details
  momoTransactionId: {
    type: String,
    default: null,
  },
  momoReferenceId: {
    type: String,
    default: null, // UUID we generate to track the payment
  },
  payerPhone: {
    type: String,
    default: null,
  },
  startDate: {
    type: Date,
    default: null,
  },
  endDate: {
    type: Date,
    default: null,
  },
  // Full MoMo callback payload for debugging
  momoCallbackData: {
    type: Object,
    default: null,
  },
}, {
  timestamps: true,
});

subscriptionSchema.index({ company: 1, status: 1 });
subscriptionSchema.index({ momoReferenceId: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
