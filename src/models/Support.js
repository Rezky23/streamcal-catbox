const mongoose = require('mongoose');

const supportSchema = new mongoose.Schema(
  {
    giftId: {
      type: String,
      index: true,
      sparse: true,
      default: null
    },
    transactionId: {
      type: String,
      index: true,
      sparse: true,
      default: null
    },
    username: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1000
    },
    paymentMethod: {
      type: String,
      enum: ['qris', 'gopay', 'dana', 'paypal'],
      default: 'qris'
    },
    paymentUrl: {
      type: String,
      default: ''
    },
    message: {
      type: String,
      maxlength: 200,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'reversed', 'on_hold'],
      default: 'pending',
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

supportSchema.index({ createdAt: -1 });

const Support = mongoose.model('Support', supportSchema);

module.exports = Support;
