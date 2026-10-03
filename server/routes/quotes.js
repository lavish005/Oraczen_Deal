/**
 * quotes.js - All routes for /api/quotes
 *
 * Routes defined here:
 *   POST   /api/quotes/calculate  - Preview calculation without saving
 *   POST   /api/quotes            - Save a new quote to MongoDB
 *   GET    /api/quotes            - Get all saved quotes (list view)
 *   GET    /api/quotes/:id        - Get a single saved quote (detail view)
 *   PATCH  /api/quotes/:id/status - Change quote status (draft->submitted etc)
 *
 * IMPORTANT: The calculate endpoint is defined BEFORE /:id routes.
 * Express matches routes in order. If we put GET /:id first,
 * it would try to find a quote with id="calculate" which is wrong.
 */

const express = require('express');
const router = express.Router();
const Quote = require('../models/Quote');
const { calculateQuote } = require('../services/quoteCalculator');

// ─────────────────────────────────────────────
// HELPER: Validate the request body fields that are common
// to both calculate and save. Returns an error string or null.
// ─────────────────────────────────────────────
function validateInput(body) {
  const { customerName, seats, lines, discountPct } = body;

  // Customer name: required and must not be blank spaces
  if (!customerName || typeof customerName !== 'string' || customerName.trim() === '') {
    return 'Customer name is required and cannot be empty.';
  }

  // Seats: must be a positive integer
  if (
    seats === undefined ||
    seats === null ||
    !Number.isInteger(Number(seats)) ||
    Number(seats) <= 0
  ) {
    return 'Seats must be a positive integer.';
  }

  // Lines: must be a non-empty array
  if (!Array.isArray(lines) || lines.length === 0) {
    return 'At least one product line is required.';
  }

  // Each line must have a SKU and a positive integer quantity
  for (const line of lines) {
    if (!line.sku || typeof line.sku !== 'string') {
      return 'Each product line must have a valid SKU.';
    }
    if (
      line.quantity === undefined ||
      !Number.isInteger(Number(line.quantity)) ||
      Number(line.quantity) <= 0
    ) {
      return `Quantity for SKU "${line.sku}" must be a positive integer.`;
    }
  }

  // Discount: must be a number >= 0
  if (discountPct === undefined || discountPct === null || isNaN(Number(discountPct)) || Number(discountPct) < 0) {
    return 'Discount must be a number (0 or greater).';
  }

  return null; // null means no error
}

// ─────────────────────────────────────────────
// POST /api/quotes/calculate
// Calculates a quote preview WITHOUT saving to MongoDB.
// The frontend calls this to show the live quote preview.
// ─────────────────────────────────────────────
router.post('/calculate', (req, res) => {
  // Validate the request body
  const validationError = validateInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { seats, lines, discountPct, annualCommitment } = req.body;

  try {
    // Run the business logic (in quoteCalculator.js)
    const result = calculateQuote({
      seats: Number(seats),
      // Ensure quantities are integers
      lines: lines.map((l) => ({ sku: l.sku, quantity: Number(l.quantity) })),
      discountPct: Number(discountPct),
      annualCommitment: Boolean(annualCommitment),
    });

    return res.json(result);
  } catch (err) {
    // Business logic errors (unknown SKU, discount too high, etc.)
    return res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/quotes
// Saves a new quote to MongoDB.
// The backend recalculates EVERYTHING - we never trust frontend totals.
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  // Validate input
  const validationError = validateInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { customerName, seats, lines, discountPct, annualCommitment } = req.body;

  try {
    // Run the calculation (backend is the authority)
    const result = calculateQuote({
      seats: Number(seats),
      lines: lines.map((l) => ({ sku: l.sku, quantity: Number(l.quantity) })),
      discountPct: Number(discountPct),
      annualCommitment: Boolean(annualCommitment),
    });

    // Build the quote document to save
    const quote = new Quote({
      customerName: customerName.trim(),
      seats: Number(seats),
      lines: result.lines, // enriched lines with product snapshot
      discountPct: Number(discountPct),
      annualCommitment: Boolean(annualCommitment),
      calculation: {
        tier: result.tier,
        subtotal: result.subtotal,
        discountAmount: result.discountAmount,
        total: result.total,
        approvalRequired: result.approvalRequired,
        approvalReasons: result.approvalReasons,
      },
      status: 'draft', // new quotes always start as draft
    });

    // Save to MongoDB
    const savedQuote = await quote.save();

    // Return the saved quote (with its MongoDB _id)
    return res.status(201).json(savedQuote);
  } catch (err) {
    // Business logic errors (unknown SKU, discount too high, etc.)
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/quotes
// Returns a list of all saved quotes.
// Only returns the fields needed for the list view (not full detail).
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // .select() picks only the fields we want for the list view
    // The minus sign before a field name means "exclude it"
    const quotes = await Quote.find()
      .select('customerName seats calculation.tier calculation.total status createdAt')
      .sort({ createdAt: -1 }); // newest first

    return res.json(quotes);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch quotes.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/quotes/:id
// Returns a single quote with full detail.
// :id is a MongoDB document ID (24-character hex string).
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found.' });
    }

    return res.json(quote);
  } catch (err) {
    // If the id format is invalid, MongoDB throws a CastError
    return res.status(404).json({ error: 'Quote not found.' });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/quotes/:id/status
// Changes the status of a saved quote.
// Only allowed transitions are enforced here.
// ─────────────────────────────────────────────

// This object defines what transitions are allowed.
// Key = current status, Value = array of statuses you can move TO
const ALLOWED_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: [],    // terminal state - no transitions allowed
  rejected: [],   // terminal state - no transitions allowed
};

router.patch('/:id/status', async (req, res) => {
  const { status: newStatus } = req.body;

  // Validate the requested status is a valid value
  const validStatuses = ['draft', 'submitted', 'approved', 'rejected'];
  if (!newStatus || !validStatuses.includes(newStatus)) {
    return res.status(400).json({
      error: `Status must be one of: ${validStatuses.join(', ')}.`,
    });
  }

  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found.' });
    }

    const currentStatus = quote.status;

    // Check if the transition is allowed
    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      return res.status(400).json({
        error: `Cannot change status from ${currentStatus} to ${newStatus}.`,
      });
    }

    // Apply the new status and save
    quote.status = newStatus;
    const updatedQuote = await quote.save();

    return res.json(updatedQuote);
  } catch (err) {
    return res.status(404).json({ error: 'Quote not found.' });
  }
});

module.exports = router;
