const request = require('supertest');
const app = require('../index');

describe('GET /api/catalog', () => {
  test('returns 200 with products and discount_rules', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(res.body).toHaveProperty('discount_rules');
    expect(res.body).toHaveProperty('currency', 'USD');
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBeGreaterThan(0);
  });

  test('each product has sku, name, unit_price', async () => {
    const res = await request(app).get('/api/catalog');
    for (const product of res.body.products) {
      expect(product).toHaveProperty('sku');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('unit_price');
    }
  });
});

describe('POST /api/quotes/calculate', () => {

  function validPayload(overrides = {}) {
    return {
      customerName: 'Test Customer',
      seats: 50,
      lines: [{ sku: 'AGENT-CORE', quantity: 10 }],
      discountPct: 0,
      annualCommitment: false,
      ...overrides,
    };
  }

  test('valid request returns 200 with tier, subtotal, total, approvalRequired', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tier', 'ENTERPRISE');
    expect(res.body).toHaveProperty('subtotal');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('approvalRequired');
    expect(res.body).toHaveProperty('approvalReasons');
  });

  test('unknown SKU → 400 error', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({
        lines: [{ sku: 'INVALID-SKU', quantity: 1 }],
      }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown product SKU/i);
  });

  test('missing customerName → 400 error', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({ customerName: '   ' }));

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('seats = 0 → 400 error', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({ seats: 0 }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive integer/i);
  });

  test('negative seats → 400 error', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({ seats: -5 }));

    expect(res.status).toBe(400);
  });

  test('empty lines array → 400 error', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({ lines: [] }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/product line/i);
  });

  test('negative discount → 400 error', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({ discountPct: -5 }));

    expect(res.status).toBe(400);
  });

  test('discount exceeds tier max → 400 error', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({ seats: 5, discountPct: 15 }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/STARTER/);
  });

  test('correct calculation: Agent Core × 50, 20% discount, ENTERPRISE', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({
        seats: 50,
        lines: [{ sku: 'AGENT-CORE', quantity: 50 }],
        discountPct: 20,
      }));

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('ENTERPRISE');
    expect(res.body.subtotal).toBe(6000);
    expect(res.body.discountAmount).toBe(1200);
    expect(res.body.total).toBe(4800);
  });

  test('approval is triggered when discount > 15%', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({
        seats: 50,
        discountPct: 20,
        annualCommitment: false,
      }));

    expect(res.status).toBe(200);
    expect(res.body.approvalRequired).toBe(true);
    expect(res.body.approvalReasons).toContain('discount_above_15_percent');
  });

  test('annual commitment + discount > 10% → approval required', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({
        seats: 50,
        discountPct: 15,
        annualCommitment: true,
      }));

    expect(res.status).toBe(200);
    expect(res.body.approvalRequired).toBe(true);
    expect(res.body.approvalReasons).toContain('annual_commitment_discount_above_10_percent');
  });

  test('0% discount is explicitly represented — not omitted', async () => {
    const res = await request(app)
      .post('/api/quotes/calculate')
      .send(validPayload({ discountPct: 0 }));

    expect(res.status).toBe(200);
    expect(res.body.discountAmount).toBe(0);
  });
});

describe('GET /api/health', () => {
  test('returns status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
