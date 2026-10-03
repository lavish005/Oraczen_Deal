/**
 * quoteCalculator.test.js — Tests for the core business logic
 *
 * WHAT IS JEST?
 * Jest is a testing framework for JavaScript. You write test cases using:
 *   - describe(): groups related tests together
 *   - test() or it(): a single test case
 *   - expect(): what you expect the result to be
 *
 * HOW TO RUN THESE TESTS:
 *   cd server
 *   npm test
 *
 * These tests call the functions in quoteCalculator.js directly.
 * They do NOT need a running server or MongoDB connection.
 * This is called "unit testing" — testing one unit (function) in isolation.
 */

const {
  findTier,
  validateDiscount,
  calculateQuote,
  determineApproval,
  mergeLines,
  buildLines,
  calculateSubtotal,
  calculateTotals,
} = require('../services/quoteCalculator');

// ─────────────────────────────────────────────
// PRICING TIER TESTS
// ─────────────────────────────────────────────
describe('findTier — Pricing Tier Boundaries', () => {

  // Test 1
  test('9 seats → STARTER tier', () => {
    const tier = findTier(9);
    expect(tier.code).toBe('STARTER');
  });

  // Test 2
  test('10 seats → GROWTH tier (boundary: just above STARTER)', () => {
    const tier = findTier(10);
    expect(tier.code).toBe('GROWTH');
  });

  // Test 3
  test('49 seats → GROWTH tier (boundary: just below ENTERPRISE)', () => {
    const tier = findTier(49);
    expect(tier.code).toBe('GROWTH');
  });

  // Test 4
  test('50 seats → ENTERPRISE tier (boundary: first ENTERPRISE seat count)', () => {
    const tier = findTier(50);
    expect(tier.code).toBe('ENTERPRISE');
  });

  test('1 seat → STARTER tier (minimum seats)', () => {
    const tier = findTier(1);
    expect(tier.code).toBe('STARTER');
  });

  test('100 seats → ENTERPRISE tier', () => {
    const tier = findTier(100);
    expect(tier.code).toBe('ENTERPRISE');
  });

  test('max discount for STARTER is 10%', () => {
    const tier = findTier(5);
    expect(tier.max_discount_pct).toBe(10);
  });

  test('max discount for GROWTH is 20%', () => {
    const tier = findTier(20);
    expect(tier.max_discount_pct).toBe(20);
  });

  test('max discount for ENTERPRISE is 30%', () => {
    const tier = findTier(50);
    expect(tier.max_discount_pct).toBe(30);
  });
});

// ─────────────────────────────────────────────
// DISCOUNT VALIDATION TESTS
// ─────────────────────────────────────────────
describe('validateDiscount — Discount Ceiling Rules', () => {

  // Test 5
  test('STARTER + 11% discount → throws error (max is 10%)', () => {
    const tier = findTier(5); // STARTER

    // expect(...).toThrow() checks that the function throws an error
    expect(() => {
      validateDiscount(11, tier);
    }).toThrow('exceeds the STARTER tier maximum of 10%');
  });

  test('GROWTH + 21% discount → throws error (max is 20%)', () => {
    const tier = findTier(20); // GROWTH
    expect(() => {
      validateDiscount(21, tier);
    }).toThrow('exceeds the GROWTH tier maximum of 20%');
  });

  test('ENTERPRISE + 31% discount → throws error (max is 30%)', () => {
    const tier = findTier(50); // ENTERPRISE
    expect(() => {
      validateDiscount(31, tier);
    }).toThrow('exceeds the ENTERPRISE tier maximum of 30%');
  });

  test('STARTER + 10% discount → valid (at the limit, should not throw)', () => {
    const tier = findTier(5);
    // This should NOT throw — expect no error
    expect(() => {
      validateDiscount(10, tier);
    }).not.toThrow();
  });

  test('negative discount → throws error', () => {
    const tier = findTier(5);
    expect(() => {
      validateDiscount(-1, tier);
    }).toThrow('Discount cannot be negative');
  });

  test('0% discount → valid (zero is explicitly allowed)', () => {
    const tier = findTier(5);
    expect(() => {
      validateDiscount(0, tier);
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────
// APPROVAL LOGIC TESTS
// ─────────────────────────────────────────────
describe('determineApproval — Approval Rules', () => {

  // Test 6: discount > 15%
  test('discount of 16% → approval required (discount_above_15_percent)', () => {
    const result = determineApproval(16, 1000, false);
    expect(result.approvalRequired).toBe(true);
    expect(result.approvalReasons).toContain('discount_above_15_percent');
  });

  // Test 7: total > $25,000
  test('total of $26,000 → approval required (total_above_25000)', () => {
    const result = determineApproval(0, 26000, false);
    expect(result.approvalRequired).toBe(true);
    expect(result.approvalReasons).toContain('total_above_25000');
  });

  // Test 8: annual commitment + discount > 10%
  test('annual commitment + 11% discount → approval required (annual_commitment_discount_above_10_percent)', () => {
    const result = determineApproval(11, 5000, true);
    expect(result.approvalRequired).toBe(true);
    expect(result.approvalReasons).toContain('annual_commitment_discount_above_10_percent');
  });

  test('annual commitment + 10% discount → no approval required (exactly at limit)', () => {
    const result = determineApproval(10, 5000, true);
    expect(result.approvalRequired).toBe(false);
    expect(result.approvalReasons).not.toContain('annual_commitment_discount_above_10_percent');
  });

  test('no annual commitment + 10% discount + total $5000 → no approval required', () => {
    const result = determineApproval(10, 5000, false);
    expect(result.approvalRequired).toBe(false);
    expect(result.approvalReasons).toHaveLength(0);
  });

  test('multiple rules triggered → all reasons are returned', () => {
    // discount 16% (triggers rule 1) AND total $26,000 (triggers rule 2)
    const result = determineApproval(16, 26000, false);
    expect(result.approvalRequired).toBe(true);
    expect(result.approvalReasons).toContain('discount_above_15_percent');
    expect(result.approvalReasons).toContain('total_above_25000');
    expect(result.approvalReasons).toHaveLength(2);
  });

  test('all three rules triggered simultaneously', () => {
    // discount 20% (rule 1 + rule 3), total $30,000 (rule 2)
    const result = determineApproval(20, 30000, true);
    expect(result.approvalRequired).toBe(true);
    expect(result.approvalReasons).toContain('discount_above_15_percent');
    expect(result.approvalReasons).toContain('total_above_25000');
    expect(result.approvalReasons).toContain('annual_commitment_discount_above_10_percent');
    expect(result.approvalReasons).toHaveLength(3);
  });

  test('discount exactly 15% → no approval (boundary: > 15, not >=)', () => {
    const result = determineApproval(15, 5000, false);
    expect(result.approvalRequired).toBe(false);
  });

  test('total exactly $25,000 → no approval (boundary: > 25000, not >=)', () => {
    const result = determineApproval(0, 25000, false);
    expect(result.approvalRequired).toBe(false);
  });
});

// ─────────────────────────────────────────────
// DUPLICATE SKU MERGING
// ─────────────────────────────────────────────
describe('mergeLines — Duplicate SKU handling', () => {
  test('two lines with same SKU are merged by adding quantities', () => {
    const input = [
      { sku: 'AGENT-CORE', quantity: 5 },
      { sku: 'AGENT-CORE', quantity: 10 },
    ];
    const merged = mergeLines(input);
    expect(merged).toHaveLength(1);
    expect(merged[0].sku).toBe('AGENT-CORE');
    expect(merged[0].quantity).toBe(15); // 5 + 10
  });

  test('different SKUs are not merged', () => {
    const input = [
      { sku: 'AGENT-CORE', quantity: 5 },
      { sku: 'AGENT-ANALYTICS', quantity: 10 },
    ];
    const merged = mergeLines(input);
    expect(merged).toHaveLength(2);
  });

  test('single line is returned as-is', () => {
    const input = [{ sku: 'AGENT-CORE', quantity: 5 }];
    const merged = mergeLines(input);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(5);
  });
});

// ─────────────────────────────────────────────
// LINE CALCULATION
// ─────────────────────────────────────────────
describe('buildLines — Line total calculation', () => {

  test('Agent Core × 10 → line total = $1,200', () => {
    const lines = buildLines([{ sku: 'AGENT-CORE', quantity: 10 }]);
    expect(lines[0].lineTotal).toBe(1200); // 10 × $120
    expect(lines[0].unitPrice).toBe(120);
  });

  test('unknown SKU → throws error', () => {
    expect(() => {
      buildLines([{ sku: 'INVALID-SKU', quantity: 1 }]);
    }).toThrow('Unknown product SKU: INVALID-SKU');
  });

  test('quantity of 0 → throws error', () => {
    expect(() => {
      buildLines([{ sku: 'AGENT-CORE', quantity: 0 }]);
    }).toThrow('must be a positive integer');
  });

  test('stores productName and sku in the enriched line', () => {
    const lines = buildLines([{ sku: 'AGENT-CORE', quantity: 1 }]);
    expect(lines[0].productName).toBe('Agent Core');
    expect(lines[0].sku).toBe('AGENT-CORE');
  });
});

// ─────────────────────────────────────────────
// SUBTOTAL
// ─────────────────────────────────────────────
describe('calculateSubtotal', () => {
  test('sums all line totals correctly', () => {
    const lines = [
      { lineTotal: 1200 },
      { lineTotal: 800 },
    ];
    expect(calculateSubtotal(lines)).toBe(2000);
  });
});

// ─────────────────────────────────────────────
// TOTALS (discount + final)
// ─────────────────────────────────────────────
describe('calculateTotals — Discount and Final Total', () => {
  test('20% discount on $10,000 → discountAmount=$2,000, total=$8,000', () => {
    const result = calculateTotals(10000, 20);
    expect(result.discountAmount).toBe(2000);
    expect(result.total).toBe(8000);
  });

  test('0% discount → no discount amount, total equals subtotal', () => {
    const result = calculateTotals(5000, 0);
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(5000);
  });

  test('10% discount on $1,200 → discountAmount=$120, total=$1,080', () => {
    const result = calculateTotals(1200, 10);
    expect(result.discountAmount).toBe(120);
    expect(result.total).toBe(1080);
  });
});

// ─────────────────────────────────────────────
// FULL INTEGRATION: calculateQuote
// ─────────────────────────────────────────────
describe('calculateQuote — Full calculation pipeline', () => {

  test('basic quote: Agent Core × 50, 20% discount', () => {
    const result = calculateQuote({
      seats: 50,
      lines: [{ sku: 'AGENT-CORE', quantity: 50 }],
      discountPct: 20,
      annualCommitment: false,
    });

    expect(result.tier).toBe('ENTERPRISE');
    expect(result.subtotal).toBe(6000);          // 50 × $120
    expect(result.discountAmount).toBe(1200);    // 20% of $6,000
    expect(result.total).toBe(4800);
    expect(result.approvalRequired).toBe(true);  // discount > 15%
    expect(result.approvalReasons).toContain('discount_above_15_percent');
  });

  test('quote with two products: Agent Core + Agent Analytics', () => {
    const result = calculateQuote({
      seats: 50,
      lines: [
        { sku: 'AGENT-CORE', quantity: 50 },
        { sku: 'AGENT-ANALYTICS', quantity: 50 },
      ],
      discountPct: 0,
      annualCommitment: false,
    });

    // 50 × $120 + 50 × $80 = $6,000 + $4,000 = $10,000
    expect(result.subtotal).toBe(10000);
    expect(result.total).toBe(10000);
    expect(result.approvalRequired).toBe(false);
  });

  test('unknown SKU → throws error (backend rejects it)', () => {
    expect(() => {
      calculateQuote({
        seats: 10,
        lines: [{ sku: 'FAKE-PRODUCT', quantity: 1 }],
        discountPct: 0,
        annualCommitment: false,
      });
    }).toThrow('Unknown product SKU: FAKE-PRODUCT');
  });

  test('discount too high → throws error', () => {
    expect(() => {
      calculateQuote({
        seats: 5, // STARTER: max 10%
        lines: [{ sku: 'AGENT-CORE', quantity: 1 }],
        discountPct: 15, // 15 > 10 → invalid
        annualCommitment: false,
      });
    }).toThrow('exceeds the STARTER tier maximum of 10%');
  });

  test('Implementation fee (ONBOARDING) is included correctly', () => {
    const result = calculateQuote({
      seats: 10,
      lines: [{ sku: 'ONBOARDING', quantity: 1 }],
      discountPct: 0,
      annualCommitment: false,
    });

    expect(result.subtotal).toBe(2500); // ONBOARDING = $2,500
  });

  test('duplicate SKUs in input are merged before calculating', () => {
    const result = calculateQuote({
      seats: 10,
      lines: [
        { sku: 'AGENT-CORE', quantity: 5 },
        { sku: 'AGENT-CORE', quantity: 10 }, // same SKU — should be merged to 15
      ],
      discountPct: 0,
      annualCommitment: false,
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity).toBe(15);
    expect(result.subtotal).toBe(1800); // 15 × $120
  });

  test('result always contains tier, subtotal, discountAmount, total, approvalRequired, approvalReasons', () => {
    const result = calculateQuote({
      seats: 10,
      lines: [{ sku: 'AGENT-CORE', quantity: 1 }],
      discountPct: 0,
      annualCommitment: false,
    });

    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('subtotal');
    expect(result).toHaveProperty('discountAmount');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('approvalRequired');
    expect(result).toHaveProperty('approvalReasons');
    expect(Array.isArray(result.approvalReasons)).toBe(true);
  });
});
