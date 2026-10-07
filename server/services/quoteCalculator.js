const catalog = require('../catalog.json');

function toCents(dollars) {
  return Math.round(dollars * 100);
}

function toDollars(cents) {
  return cents / 100;
}

function findTier(seats) {
  const rule = catalog.discount_rules.find(
    (r) => seats >= r.min_seats && seats <= r.max_seats
  );

  if (!rule) {
    throw new Error(`No pricing tier found for ${seats} seats.`);
  }

  return rule;
}

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

function findProduct(sku) {
  const product = catalog.products.find((p) => p.sku === sku);

  if (!product) {
    throw new Error(`Unknown product SKU: ${sku}`);
  }

  return product;
}

function mergeLines(lines) {
  const map = {};

  for (const line of lines) {
    if (map[line.sku]) {
      map[line.sku] += line.quantity;
    } else {
      map[line.sku] = line.quantity;
    }
  }

  return Object.entries(map).map(([sku, quantity]) => ({ sku, quantity }));
}

function buildLines(mergedLines) {
  return mergedLines.map((line) => {
    const product = findProduct(line.sku);

    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(
        `Quantity for ${line.sku} must be a positive integer.`
      );
    }

    const unitPriceCents = toCents(product.unit_price);
    const lineTotalCents = unitPriceCents * line.quantity;

    return {
      sku: product.sku,
      productName: product.name,
      quantity: line.quantity,
      unitPrice: toDollars(unitPriceCents),
      lineTotal: toDollars(lineTotalCents),
    };
  });
}

function calculateSubtotal(enrichedLines) {
  const subtotalCents = enrichedLines.reduce((sum, line) => {
    return sum + toCents(line.lineTotal);
  }, 0);

  return toDollars(subtotalCents);
}

function calculateTotals(subtotal, discountPct) {
  const subtotalCents = toCents(subtotal);

  const discountAmountCents = Math.round((subtotalCents * discountPct) / 100);
  const totalCents = subtotalCents - discountAmountCents;

  return {
    discountAmount: toDollars(discountAmountCents),
    total: toDollars(totalCents),
  };
}

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

function calculateQuote(input) {
  const { seats, lines, discountPct, annualCommitment } = input;

  const tier = findTier(seats);

  validateDiscount(discountPct, tier);

  const mergedLines = mergeLines(lines);

  const enrichedLines = buildLines(mergedLines);

  const subtotal = calculateSubtotal(enrichedLines);

  const { discountAmount, total } = calculateTotals(subtotal, discountPct);

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
