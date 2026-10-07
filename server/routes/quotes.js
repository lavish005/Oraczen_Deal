const express = require('express');
const router = express.Router();
const Quote = require('../models/Quote');
const { calculateQuote } = require('../services/quoteCalculator');

function validateInput(body) {
  const { customerName, seats, lines, discountPct } = body;

  if (!customerName || typeof customerName !== 'string' || customerName.trim() === '') {
    return 'Customer name is required and cannot be empty.';
  }

  if (
    seats === undefined ||
    seats === null ||
    !Number.isInteger(Number(seats)) ||
    Number(seats) <= 0
  ) {
    return 'Seats must be a positive integer.';
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    return 'At least one product line is required.';
  }

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

  if (discountPct === undefined || discountPct === null || isNaN(Number(discountPct)) || Number(discountPct) < 0) {
    return 'Discount must be a number (0 or greater).';
  }

  return null;
}

router.post('/calculate', (req, res) => {
  const validationError = validateInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { seats, lines, discountPct, annualCommitment } = req.body;

  try {
    const result = calculateQuote({
      seats: Number(seats),
      lines: lines.map((l) => ({ sku: l.sku, quantity: Number(l.quantity) })),
      discountPct: Number(discountPct),
      annualCommitment: Boolean(annualCommitment),
    });

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const validationError = validateInput(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { customerName, seats, lines, discountPct, annualCommitment } = req.body;

  try {
    const result = calculateQuote({
      seats: Number(seats),
      lines: lines.map((l) => ({ sku: l.sku, quantity: Number(l.quantity) })),
      discountPct: Number(discountPct),
      annualCommitment: Boolean(annualCommitment),
    });

    const quote = new Quote({
      customerName: customerName.trim(),
      seats: Number(seats),
      lines: result.lines,
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
      status: 'draft',
    });

    const savedQuote = await quote.save();

    return res.status(201).json(savedQuote);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const quotes = await Quote.find()
      .select('customerName seats calculation.tier calculation.total status createdAt')
      .sort({ createdAt: -1 });

    return res.json(quotes);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch quotes.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found.' });
    }

    return res.json(quote);
  } catch (err) {
    return res.status(404).json({ error: 'Quote not found.' });
  }
});

const ALLOWED_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: [],
  rejected: [],
};

router.patch('/:id/status', async (req, res) => {
  const { status: newStatus } = req.body;

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

    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      return res.status(400).json({
        error: `Cannot change status from ${currentStatus} to ${newStatus}.`,
      });
    }

    quote.status = newStatus;
    const updatedQuote = await quote.save();

    return res.json(updatedQuote);
  } catch (err) {
    return res.status(404).json({ error: 'Quote not found.' });
  }
});

module.exports = router;
