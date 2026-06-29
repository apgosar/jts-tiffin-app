const request = require('supertest');
const app = require('../../server');

// Base valid order payload to mutate in individual tests
const baseCustomer = {
  name: 'Test User',
  phone: '9999999999',
  pincode: '400092',
  address: 'Flat 1, Test Building, Test Street, Test Locality',
  locality: 'Test Locality',
  wingFlat: 'A1',
  building: 'Test Building',
  street: 'Test Street',
};

const baseItem = { name: 'Full Lunch', quantity: 1, price: 220 };

// ─────────────────────────────────────────────────────────
// POST /api/orders — Customer field validation
// ─────────────────────────────────────────────────────────
describe('POST /api/orders — Customer Field Validation', () => {
  const requiredFields = ['name', 'phone', 'wingFlat', 'building', 'street', 'locality', 'pincode', 'address'];

  requiredFields.forEach(field => {
    it(`should return 400 when required customer field "${field}" is missing`, async () => {
      const customer = { ...baseCustomer };
      delete customer[field];

      const res = await request(app).post('/api/orders').send({
        customer,
        items: [baseItem],
        paymentMode: 'Cash',
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain(field);
    });

    it(`should return 400 when required customer field "${field}" is blank/whitespace`, async () => {
      const customer = { ...baseCustomer, [field]: '   ' };

      const res = await request(app).post('/api/orders').send({
        customer,
        items: [baseItem],
        paymentMode: 'Cash',
      });

      expect(res.statusCode).toEqual(400);
    });
  });

  it('should return 400 when customer object is missing entirely', async () => {
    const res = await request(app).post('/api/orders').send({
      items: [baseItem],
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('required');
  });

  it('should return 400 when items array is missing', async () => {
    const res = await request(app).post('/api/orders').send({
      customer: baseCustomer,
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('required');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/orders — Pincode validation
// ─────────────────────────────────────────────────────────
describe('POST /api/orders — Pincode Format Validation', () => {
  it('should return 400 for a 5-digit pincode', async () => {
    const res = await request(app).post('/api/orders').send({
      customer: { ...baseCustomer, pincode: '12345' },
      items: [baseItem],
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('PINCODE');
  });

  it('should return 400 for a 7-digit pincode', async () => {
    const res = await request(app).post('/api/orders').send({
      customer: { ...baseCustomer, pincode: '4000921' },
      items: [baseItem],
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('PINCODE');
  });

  it('should return 400 for a non-numeric pincode', async () => {
    const res = await request(app).post('/api/orders').send({
      customer: { ...baseCustomer, pincode: 'ABCDEF' },
      items: [baseItem],
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('PINCODE');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/orders — Item quantity validation
// ─────────────────────────────────────────────────────────
describe('POST /api/orders — Item Quantity Validation', () => {
  it('should return 400 when quantity is 0', async () => {
    const res = await request(app).post('/api/orders').send({
      customer: baseCustomer,
      items: [{ name: 'Full Lunch', quantity: 0, price: 220 }],
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('Invalid quantity');
  });

  it('should return 400 when quantity exceeds max (21 for regular items)', async () => {
    const res = await request(app).post('/api/orders').send({
      customer: baseCustomer,
      items: [{ name: 'Full Lunch', quantity: 21, price: 220 }],
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('Invalid quantity');
  });

  it('should return 400 when Roti quantity exceeds 200', async () => {
    const res = await request(app).post('/api/orders').send({
      customer: baseCustomer,
      items: [{ name: 'Roti', quantity: 201, price: 8 }],
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('Invalid quantity');
  });

  it('should accept Roti quantity exactly at max (200)', async () => {
    const res = await request(app).post('/api/orders').send({
      customer: baseCustomer,
      items: [{ name: 'Roti', quantity: 200, price: 8 }],
      paymentMode: 'Cash',
    });
    // Should succeed (not a 400) — Roti at exactly 200 is allowed
    expect(res.statusCode).not.toEqual(400);
  });

  it('should return 400 when items array is empty', async () => {
    const res = await request(app).post('/api/orders').send({
      customer: baseCustomer,
      items: [],
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('No items');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/orders — Item count limits
// ─────────────────────────────────────────────────────────
describe('POST /api/orders — Item Type Limit Validation', () => {
  it('should return 400 when more than 50 item types are submitted', async () => {
    const items = Array.from({ length: 51 }).map(() => ({ name: 'Full Lunch', quantity: 1, price: 220 }));
    const res = await request(app).post('/api/orders').send({
      customer: baseCustomer,
      items: items,
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('Too many item types');
  });

  it('should accept exactly 50 item types', async () => {
    const items = Array.from({ length: 50 }).map(() => ({ name: 'Full Lunch', quantity: 1, price: 220 }));
    const res = await request(app).post('/api/orders').send({
      customer: baseCustomer,
      items: items,
      paymentMode: 'Cash',
    });
    expect(res.statusCode).not.toEqual(400);
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/orders/recurring — Validation
// ─────────────────────────────────────────────────────────
describe('POST /api/orders/recurring — Validation', () => {
  const recurringRequiredFields = ['name', 'phone', 'wingFlat', 'building', 'street', 'locality', 'pincode', 'address'];

  recurringRequiredFields.forEach(field => {
    it(`should return 400 when required customer field "${field}" is missing`, async () => {
      const customer = { ...baseCustomer };
      delete customer[field];

      const res = await request(app).post('/api/orders/recurring').send({
        customer,
        items: [baseItem],
        deliveryDates: ['30/12/2050'],
        paymentMode: 'Cash',
      });

      expect(res.statusCode).toEqual(400);
    });
  });

  it('should return 400 when deliveryDates is missing', async () => {
    const res = await request(app).post('/api/orders/recurring').send({
      customer: baseCustomer,
      items: [baseItem],
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('Missing required fields');
  });

  it('should return 400 when deliveryDates is not an array', async () => {
    const res = await request(app).post('/api/orders/recurring').send({
      customer: baseCustomer,
      items: [baseItem],
      deliveryDates: '30/12/2050',
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('Missing required fields');
  });

  it('should return 400 for unknown item name in recurring order', async () => {
    const res = await request(app).post('/api/orders/recurring').send({
      customer: baseCustomer,
      items: [{ name: 'Ghost Item', quantity: 1, price: 100 }],
      deliveryDates: ['30/12/2050'],
      paymentMode: 'Cash',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('Unknown item');
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/orders/manage — Phone validation
// ─────────────────────────────────────────────────────────
describe('GET /api/orders/manage — Phone Validation', () => {
  it('should return 400 for phone starting with digit < 6', async () => {
    const res = await request(app).get('/api/orders/manage?phone=5999999999');
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toBe('Invalid phone number');
  });

  it('should return 400 for phone starting with digit 1', async () => {
    const res = await request(app).get('/api/orders/manage?phone=1234567890');
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toBe('Invalid phone number');
  });

  it('should return 400 for missing phone query param', async () => {
    const res = await request(app).get('/api/orders/manage');
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toBe('Invalid phone number');
  });

  it('should accept phone starting with 6', async () => {
    const res = await request(app).get('/api/orders/manage?phone=6000000000');
    expect(res.statusCode).toEqual(200);
  });

  it('should accept phone starting with 9', async () => {
    const res = await request(app).get('/api/orders/manage?phone=9000000000');
    expect(res.statusCode).toEqual(200);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /api/orders/manage — Cancel validation
// ─────────────────────────────────────────────────────────
describe('DELETE /api/orders/manage — Cancel Validation', () => {
  it('should return 400 when phone is missing in cancel request', async () => {
    const res = await request(app).delete('/api/orders/manage/SOME_ORDER_ID');
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('required');
  });

  it('should return 404 when the phone does not own any matching order', async () => {
    // Use a phone number that has no orders at all — should return 404
    const cancelRes = await request(app).delete('/api/orders/manage/NONEXISTENT_ORDER?phone=8888888888');
    expect(cancelRes.statusCode).toBe(404);
  });
});
