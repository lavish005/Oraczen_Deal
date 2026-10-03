/**
 * Quote.js - Mongoose Model
 *
 * This defines the shape of a quote document in MongoDB.
 *
 * KEY DESIGN DECISION: Product Snapshot
 * When we save a quote, we store a COPY (snapshot) of the product's name,
 * SKU, and price at the time of saving. This means even if a product is
 * later removed from catalog.json, the saved quote still shows the correct
 * product info. We never rely on the live catalog to display old quotes.
 *
 * KEY DESIGN DECISION: Backend calculates totals
 * We store the calculated results (subtotal, discountAmount, total, etc.)
 * directly on the quote. The frontend never sends these - the backend
 * always recalculates them before saving.
 */

const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// SUB-SCHEMA: A single product line on the quote
// ─────────────────────────────────────────────
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
}, { _id: false }); // _id: false means each line won't get its own MongoDB ID

// ─────────────────────────────────────────────
// MAIN SCHEMA: The full quote document
// ─────────────────────────────────────────────
const quoteSchema = new mongoose.Schema(
  {
    // Customer information
    customerName: {
      type: String,
      required: true,
      trim: true, // removes leading/trailing spaces automatically
    },

    // Number of seats (determines pricing tier)
    seats: {
      type: Number,
      required: true,
      min: 1,
    },

    // Array of product lines (each line is a lineSchema above)
    lines: {
      type: [lineSchema],
      validate: {
        // Custom validation: must have at least one product line
        validator: function (val) {
          return val.length > 0;
        },
        message: 'At least one product line is required.',
      },
    },

    // Discount percentage (0 = no discount, explicitly stored)
    discountPct: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Annual commitment flag (only affects approval logic, not price)
    annualCommitment: {
      type: Boolean,
      default: false,
    },

    // ─── Calculated results ───────────────────
    // These are always set by the backend, never by the frontend
    calculation: {
      tier: { type: String, required: true },          // e.g. "ENTERPRISE"
      subtotal: { type: Number, required: true },      // e.g. 10000
      discountAmount: { type: Number, required: true }, // e.g. 2000
      total: { type: Number, required: true },         // e.g. 8000
      approvalRequired: { type: Boolean, required: true },
      approvalReasons: [{ type: String }],             // array of reason codes
    },

    // ─── Status workflow ─────────────────────
    // Allowed values: draft, submitted, approved, rejected
    // Transitions are validated in the route handler, not here.
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected'],
      default: 'draft',
    },
  },
  {
    // timestamps: true automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

// Create the model from the schema.
// "Quote" is the model name; MongoDB will store documents in a "quotes" collection.
const Quote = mongoose.model('Quote', quoteSchema);

module.exports = Quote;
