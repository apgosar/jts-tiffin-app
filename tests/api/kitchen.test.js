const request = require('supertest');
const app = require('../../server');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: place orders for a specific future date and return them
// ─────────────────────────────────────────────────────────────────────────────
const FUTURE_DATE = '30/12/2050';

const customer = {
  name: 'Kitchen Tester',
  phone: '8123456789',
  pincode: '400092',
  address: 'Flat 2, Kitchen Block, Test St, Borivali',
  locality: 'Borivali West',
  wingFlat: 'B2',
  building: 'Kitchen Block',
  street: 'Test St',
};

async function placeOrder(items, overrideCustomer = {}) {
  return request(app).post('/api/orders').send({
    customer: { ...customer, ...overrideCustomer },
    items,
    paymentMode: 'Cash',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/kitchen — Validation
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/kitchen', () => {
  it('should return 400 if date parameter is missing', async () => {
    const res = await request(app)
      .get('/api/admin/kitchen')
      .set('x-admin-password', 'changeme');
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('date');
  });

  it('should return 401 without admin password header', async () => {
    const res = await request(app).get('/api/admin/kitchen?date=30/12/2050');
    expect(res.statusCode).toEqual(401);
  });

  it('should return a valid empty kitchen summary when no orders exist for the date', async () => {
    const res = await request(app)
      .get('/api/admin/kitchen?date=01/01/2099')
      .set('x-admin-password', 'changeme');
    expect(res.statusCode).toEqual(200);
    expect(res.body.orderCount).toEqual(0);
    expect(res.body.kitchenOrders).toEqual([]);
  });

  describe('Kitchen summary with known Lunch orders', () => {
    beforeAll(async () => {
      // Place 1 Full Lunch order to generate known component counts
      // Full Lunch = 6 Roti, 1 Sabji, 1 Dal, 1 Rice
      await placeOrder([
        { name: 'Full Lunch', quantity: 1, price: 220 },
      ]);
    });

    it('should count the Lunch orderCount correctly', async () => {
      const today = new Date();
      // Format date as DD/MM/YYYY in IST (server does the same thing)
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const todayStr = `${dd}/${mm}/${yyyy}`;

      const res = await request(app)
        .get(`/api/admin/kitchen?date=${todayStr}`)
        .set('x-admin-password', 'changeme');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('orderCount');
      expect(res.body).toHaveProperty('grandTotals');
      expect(res.body).toHaveProperty('kitchenOrders');
      expect(res.body.orderCount).toBeGreaterThanOrEqual(1);
      // 1 Full Lunch = 6 Roti
      expect(res.body.grandTotals.Roti).toBeGreaterThanOrEqual(6);
      expect(res.body.grandTotals.Dal).toBeGreaterThanOrEqual(1);
      expect(res.body.grandTotals.Rice).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Kitchen summary with Choviar orders', () => {
    it('should report choviarOrderCount correctly', async () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const todayStr = `${dd}/${mm}/${yyyy}`;

      // Place a Choviar-only order
      await placeOrder([
        { name: 'Choviar Special', quantity: 1, price: 160 },
      ]);

      const res = await request(app)
        .get(`/api/admin/kitchen?date=${todayStr}`)
        .set('x-admin-password', 'changeme');

      expect(res.statusCode).toEqual(200);
      expect(res.body.choviarOrderCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CANCELLED orders are excluded from kitchen summary', () => {
    it('should not count CANCELLED orders in the kitchen summary', async () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const todayStr = `${dd}/${mm}/${yyyy}`;

      // Get kitchen count before placing
      const before = await request(app)
        .get(`/api/admin/kitchen?date=${todayStr}`)
        .set('x-admin-password', 'changeme');
      const beforeCount = before.body.orderCount;

      // Place a new order then cancel it
      const orderRes = await placeOrder([{ name: 'Full Lunch', quantity: 1, price: 220 }]);
      expect(orderRes.body.success).toBe(true);
      const orderId = orderRes.body.orderId;

      // Cancel by forcing status update via batch delivery update (the only admin cancel mechanism)
      await request(app)
        .put('/api/admin/orders/delivery/batch')
        .set('x-admin-password', 'changeme')
        .send({ updates: [{ orderId: orderId, deliveryPerson: 'Driver1', routeOrder: 'CANCELLED' }] });

      // Kitchen should not include the cancelled order
      const after = await request(app)
        .get(`/api/admin/kitchen?date=${todayStr}`)
        .set('x-admin-password', 'changeme');

      expect(after.body.orderCount).toEqual(beforeCount);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRawComponents helper — tested indirectly through kitchen endpoint
// ─────────────────────────────────────────────────────────────────────────────
describe('Kitchen component counts via GET /api/admin/kitchen', () => {
  it('should correctly sum Roti for Mini Lunch (3 rotis per tiffin)', async () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    // Get current count first
    const before = await request(app)
      .get(`/api/admin/kitchen?date=${todayStr}`)
      .set('x-admin-password', 'changeme');
    const rotisBefore = before.body.grandTotals?.Roti || 0;

    // Place 2 x Mini Lunch = 6 rotis
    await placeOrder([{ name: 'Mini Lunch', quantity: 2, price: 140 }]);

    const after = await request(app)
      .get(`/api/admin/kitchen?date=${todayStr}`)
      .set('x-admin-password', 'changeme');

    expect(after.body.grandTotals.Roti).toEqual(rotisBefore + 6);
  });

  it('should correctly sum Roti for Family Meal (9 rotis per tiffin)', async () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    const before = await request(app)
      .get(`/api/admin/kitchen?date=${todayStr}`)
      .set('x-admin-password', 'changeme');
    const rotisBefore = before.body.grandTotals?.Roti || 0;

    // Place 1 x Family Meal = 9 rotis
    await placeOrder([{ name: 'Family Meal', quantity: 1, price: 320 }]);

    const after = await request(app)
      .get(`/api/admin/kitchen?date=${todayStr}`)
      .set('x-admin-password', 'changeme');

    expect(after.body.grandTotals.Roti).toEqual(rotisBefore + 9);
  });
});
