const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  lineTotal: {
    type: Number,
    required: true,
  },
}, { _id: false });

const quoteSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: true,
      trim: true,
    },

    seats: {
      type: Number,
      required: true,
      min: 1,
    },

    lines: {
      type: [lineSchema],
      validate: {
        validator: function (val) {
          return val.length > 0;
        },
        message: 'At least one product line is required.',
      },
    },

    discountPct: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    annualCommitment: {
      type: Boolean,
      default: false,
    },

    calculation: {
      tier: { type: String, required: true },
      subtotal: { type: Number, required: true },
      discountAmount: { type: Number, required: true },
      total: { type: Number, required: true },
      approvalRequired: { type: Boolean, required: true },
      approvalReasons: [{ type: String }],
    },

    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected'],
      default: 'draft',
    },
  },
  {
    timestamps: true,
  }
);

const Quote = mongoose.model('Quote', quoteSchema);

module.exports = Quote;
