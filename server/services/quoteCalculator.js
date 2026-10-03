/**
 * quoteCalculator.js
 *
 * This file contains ALL the business rules for the Deal Desk Quote Simulator.
 * It is the single source of truth for:
 *   - Finding the pricing tier based on seat count
 *   - Validating the discount against the tier maximum
 *   - Calculating line totals, subtotal, discount amount, and final total
 *   - Determining whether approval is required and why
 *
 * WHY THIS FILE EXISTS:
 * The frontend (React) cannot be trusted to enforce business rules.
 * A user could bypass the frontend by sending raw HTTP requests.
 * By keeping all logic here on the backend, we guarantee correctness.
 *
 * MONEY ROUNDING DECISION:
 * We work in cents internally (integer math) to avoid JavaScript floating-point
 * errors. Example: $120.00 = 12000 cents.
 * We divide by 100 before returning values to the caller.
 * This way 0.1 + 0.2 = 0.30000000000004 is never a problem.
 */

const catalog = require('../catalog.json');

// ─────────────────────────────────────────────
// HELPER: Convert dollars to cents (integer)
// ─────────────────────────────────────────────
function toCents(dollars) {
  // Math.round handles any floating-point edge cases from the JSON
  return Math.round(dollars * 100);
}

// ─────────────────────────────────────────────
// HELPER: Convert cents back to dollars
// ─────────────────────────────────────────────
function toDollars(cents) {
  return cents / 100;
}

// ─────────────────────────────────────────────
// 1. FIND TIER
// Looks up which discount_rule applies for the given seat count.
// Returns the rule object, e.g. { code: "GROWTH", min_seats: 10, ... }
// ─────────────────────────────────────────────
function findTier(seats) {
  const rule = catalog.discount_rules.find(
    (r) => seats >= r.min_seats && seats <= r.max_seats
  );

  if (!rule) {
    // This should never happen given catalog covers 1-99999,
    // but we guard defensively.
    throw new Error(`No pricing tier found for ${seats} seats.`);
  }

  return rule;
}

// ─────────────────────────────────────────────
// 2. VALIDATE DISCOUNT
// Throws a descriptive error if the discount exceeds the tier maximum.
// ─────────────────────────────────────────────
function validateDiscount(discountPct, tier) {
  if (discountPct < 0) {
    throw new Error('Discount cannot be negative.');
  }

  if (discountPct > tier.max_discount_pct) {
    throw new Error(
      `Discount of ${discountPct}% exceeds the ${tier.code} tier maximum of ${tier.max_discount_pct}%.`
    );
  }
}

// ─────────────────────────────────────────────
// 3. FIND PRODUCT BY SKU
// Returns the product object from the catalog.
// Throws if the SKU does not exist.
// ─────────────────────────────────────────────
function findProduct(sku) {
  const product = catalog.products.find((p) => p.sku === sku);

  if (!product) {
    throw new Error(`Unknown product SKU: ${sku}`);
  }

  return product;
}

// ─────────────────────────────────────────────
// 4. DEDUPLICATE AND MERGE LINES
// If the same SKU appears more than once, combine quantities.
// Example: Agent Core x5 + Agent Core x10 -> Agent Core x15
// ─────────────────────────────────────────────
function mergeLines(lines) {
  const map = {}; // key = SKU, value = combined quantity

  for (const line of lines) {
    if (map[line.sku]) {
      map[line.sku] += line.quantity;
    } else {
      map[line.sku] = line.quantity;
    }
  }

  // Convert the map back to an array of { sku, quantity }
  return Object.entries(map).map(([sku, quantity]) => ({ sku, quantity }));
}

// ─────────────────────────────────────────────
// 5. BUILD LINE DETAILS
// For each { sku, quantity }, look up the catalog price and compute line_total.
// Returns enriched line objects that also contain productName, unitPrice, lineTotal.
// ─────────────────────────────────────────────
function buildLines(mergedLines) {
  return mergedLines.map((line) => {
    const product = findProduct(line.sku); // throws if SKU unknown

    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(
        `Quantity for ${line.sku} must be a positive integer.`
      );
    }

    // Work in cents to avoid floating-point errors
    const unitPriceCents = toCents(product.unit_price);
    const lineTotalCents = unitPriceCents * line.quantity;

    return {
      sku: product.sku,
      productName: product.name,
      quantity: line.quantity,
      unitPrice: toDollars(unitPriceCents),   // store as dollars for readability
      lineTotal: toDollars(lineTotalCents),
    };
  });
}

// ─────────────────────────────────────────────
// 6. CALCULATE SUBTOTAL
// Sum all line totals (in cents, then convert).
// ─────────────────────────────────────────────
function calculateSubtotal(enrichedLines) {
  const subtotalCents = enrichedLines.reduce((sum, line) => {
    return sum + toCents(line.lineTotal);
  }, 0);

  return toDollars(subtotalCents);
}

// ─────────────────────────────────────────────
// 7. CALCULATE DISCOUNT AMOUNT AND FINAL TOTAL
// discountAmount = subtotal x discountPct / 100
// total = subtotal - discountAmount
// ─────────────────────────────────────────────
function calculateTotals(subtotal, discountPct) {
  const subtotalCents = toCents(subtotal);

  // Integer math: multiply first, then divide
  // Math.round handles edge cases like 3.33333...
  const discountAmountCents = Math.round((subtotalCents * discountPct) / 100);
  const totalCents = subtotalCents - discountAmountCents;

  return {
    discountAmount: toDollars(discountAmountCents),
    total: toDollars(totalCents),
  };
}

// ─────────────────────────────────────────────
// 8. DETERMINE APPROVAL
// Returns { approvalRequired, approvalReasons }
//
// Rules:
//   Rule 1: discount > 15%
//   Rule 2: total > $25,000
//   Rule 3: annualCommitment = true AND discount > 10%
// ─────────────────────────────────────────────
function determineApproval(discountPct, total, annualCommitment) {
  const reasons = [];

  if (discountPct > 15) {
    reasons.push('discount_above_15_percent');
  }

  if (total > 25000) {
    reasons.push('total_above_25000');
  }

  if (annualCommitment && discountPct > 10) {
    reasons.push('annual_commitment_discount_above_10_percent');
  }

  return {
    approvalRequired: reasons.length > 0,
    approvalReasons: reasons,
  };
}

// ─────────────────────────────────────────────
// 9. MAIN CALCULATE FUNCTION
// This is the entry point called by route handlers.
// It runs the full calculation pipeline and returns a complete result.
// ─────────────────────────────────────────────
function calculateQuote(input) {
  const { seats, lines, discountPct, annualCommitment } = input;

  // Step 1: Find the tier for these seats
  const tier = findTier(seats);

  // Step 2: Validate the discount against the tier
  validateDiscount(discountPct, tier);

  // Step 3: Merge duplicate SKUs
  const mergedLines = mergeLines(lines);

  // Step 4: Enrich lines with catalog data (price, lineTotal)
  const enrichedLines = buildLines(mergedLines);

  // Step 5: Calculate subtotal
  const subtotal = calculateSubtotal(enrichedLines);

  // Step 6: Calculate discount amount and final total
  const { discountAmount, total } = calculateTotals(subtotal, discountPct);

  // Step 7: Determine approval
  const { approvalRequired, approvalReasons } = determineApproval(
    discountPct,
    total,
    annualCommitment
  );

  return {
    tier: tier.code,
    lines: enrichedLines,
    subtotal,
    discountAmount,
    total,
    approvalRequired,
    approvalReasons,
  };
}

// ─────────────────────────────────────────────
// EXPORTS
// We export individual helpers so tests can import and test them directly.
// ─────────────────────────────────────────────
module.exports = {
  calculateQuote,
  findTier,
  validateDiscount,
  findProduct,
  mergeLines,
  buildLines,
  calculateSubtotal,
  calculateTotals,
  determineApproval,
};
