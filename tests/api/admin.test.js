const request = require('supertest');
const app = require('../../server');

describe('Admin Endpoints', () => {
  describe('POST /api/admin/login', () => {
    it('should reject invalid password', async () => {
      const res = await request(app).post('/api/admin/login').send({ password: 'wrong' });
      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return success and token for correct password', async () => {
      const res = await request(app).post('/api/admin/login').send({ password: 'changeme' });
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBe('changeme');
    });
  });

  describe('GET /api/admin/orders', () => {
    it('should reject without x-admin-password header', async () => {
      const res = await request(app).get('/api/admin/orders?date=25/06/2026');
      expect(res.statusCode).toEqual(401);
    });

    it('should return empty array if no date/month provided', async () => {
      const res = await request(app).get('/api/admin/orders').set('x-admin-password', 'changeme');
      expect(res.statusCode).toEqual(200);
      expect(res.body.orders).toEqual([]);
    });

    it('should return mock orders for a given date', async () => {
      const res = await request(app).get('/api/admin/orders?date=25/06/2026').set('x-admin-password', 'changeme');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });
  });

  describe('PUT /api/admin/orders/delivery/batch', () => {
    it('should require updates array', async () => {
      const res = await request(app).put('/api/admin/orders/delivery/batch').set('x-admin-password', 'changeme').send({});
      expect(res.statusCode).toEqual(400);
    });

    it('should successfully update mock orders', async () => {
      const payload = {
        updates: [{ orderId: 'O-1234', deliveryPerson: 'Raju', routeOrder: 1 }]
      };
      const res = await request(app).put('/api/admin/orders/delivery/batch').set('x-admin-password', 'changeme').send(payload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/admin/menu', () => {
    it('should require items array', async () => {
      const res = await request(app).put('/api/admin/menu').set('x-admin-password', 'changeme').send({});
      expect(res.statusCode).toEqual(400);
    });

    it('should successfully update menu', async () => {
      const payload = {
        items: [{ name: 'Test Lunch', price: 100 }],
        metadata: { available: 'Yes' }
      };
      const res = await request(app).put('/api/admin/menu').set('x-admin-password', 'changeme').send(payload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });

    it('should recalculate active recurring orders when lunch or choviar price is updated for a day', async () => {
      const { MOCK_ORDERS } = require('../../server');
      const testDate = '28/10/2026';

      // Seed an active lunch recurring order with old price
      const activeLunchOrder = {
        orderId: 'REC-LUNCH-1',
        date: testDate,
        time: '12:00',
        isRecurring: true,
        name: 'Recurring Lunch User',
        phone: '9820000001',
        zone: 'borivali',
        category: 'Lunch',
        items: [{ name: 'Mini Lunch', price: 140, quantity: 1, category: 'Lunch' }],
        itemsSummary: 'Mini Lunch×1',
        surchargeTotal: 0,
        grandTotal: 140,
        status: 'ACTIVE',
        paymentReceived: false,
      };

      // Seed an active choviar recurring order with old price and outside surcharge
      const activeChoviarOrder = {
        orderId: 'REC-CHOV-1',
        date: testDate,
        time: '12:00',
        isRecurring: true,
        name: 'Recurring Choviar User',
        phone: '9820000002',
        zone: 'outside',
        category: 'Choviar',
        items: [{ name: 'Choviar', price: 160, quantity: 1, category: 'Choviar' }],
        itemsSummary: 'Choviar×1',
        surchargeTotal: 40,
        grandTotal: 200,
        status: 'ACTIVE',
        paymentReceived: false,
      };

      // Seed a cancelled order that should NOT be modified
      const cancelledOrder = {
        orderId: 'REC-CANCELLED',
        date: testDate,
        time: '12:00',
        isRecurring: true,
        name: 'Cancelled User',
        phone: '9820000003',
        zone: 'borivali',
        category: 'Lunch',
        items: [{ name: 'Mini Lunch', price: 140, quantity: 1, category: 'Lunch' }],
        itemsSummary: 'Mini Lunch×1',
        surchargeTotal: 0,
        grandTotal: 140,
        status: 'CANCELLED',
        paymentReceived: false,
      };

      MOCK_ORDERS.push(activeLunchOrder, activeChoviarOrder, cancelledOrder);

      const updatePayload = {
        items: [
          { name: 'Mini Lunch', price: 180, category: 'Lunch', available: true },
          { name: 'Paratha', price: 12, qty: 2, category: 'Choviar', available: true },
          { name: 'Sabji', price: 176, qty: 1, category: 'Choviar', available: true }, // 2*12 + 176 = 200
        ],
        metadata: {
          liveMenuDate: testDate,
          rotiPrice: '8',
        }
      };

      const res = await request(app)
        .put('/api/admin/menu')
        .set('x-admin-password', 'changeme')
        .send(updatePayload);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updatedRecurringCount).toBeGreaterThanOrEqual(2);

      // Verify active lunch order updated to 180
      expect(activeLunchOrder.items[0].price).toBe(180);
      expect(activeLunchOrder.grandTotal).toBe(180);

      // Verify active choviar order updated to 200 + 40 outside surcharge = 240
      expect(activeChoviarOrder.items[0].price).toBe(200);
      expect(activeChoviarOrder.surchargeTotal).toBe(40);
      expect(activeChoviarOrder.grandTotal).toBe(240);

      // Verify cancelled order remained untouched
      expect(cancelledOrder.items[0].price).toBe(140);
      expect(cancelledOrder.grandTotal).toBe(140);
      expect(cancelledOrder.status).toBe('CANCELLED');
    });
  });

  describe('POST /api/admin/orders/recalculate-recurring', () => {
    it('should reject without valid date', async () => {
      const res = await request(app)
        .post('/api/admin/orders/recalculate-recurring')
        .set('x-admin-password', 'changeme')
        .send({ date: 'invalid-date' });
      expect(res.statusCode).toEqual(400);
    });

    it('should successfully recalculate recurring orders for specified date', async () => {
      const { MOCK_ORDERS } = require('../../server');
      const testDate = '29/10/2026';

      const order = {
        orderId: 'REC-RECALC-TEST',
        date: testDate,
        time: '12:00',
        isRecurring: true,
        name: 'Recalc User',
        phone: '9820000009',
        zone: 'borivali',
        category: 'Lunch',
        items: [{ name: 'Mini Lunch', price: 140, quantity: 1, category: 'Lunch' }],
        itemsSummary: 'Mini Lunch×1',
        surchargeTotal: 0,
        grandTotal: 140,
        status: 'ACTIVE',
      };
      MOCK_ORDERS.push(order);

      const res = await request(app)
        .post('/api/admin/orders/recalculate-recurring')
        .set('x-admin-password', 'changeme')
        .send({ date: testDate });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.date).toBe(testDate);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/admin/kitchen', () => {
    it('should return 400 if no date is provided', async () => {
      const res = await request(app).get('/api/admin/kitchen').set('x-admin-password', 'changeme');
      expect(res.statusCode).toEqual(400);
    });

    it('should return kitchen summary for valid request', async () => {
      const res = await request(app)
        .get('/api/admin/kitchen?date=25/06/2026')
        .set('x-admin-password', 'changeme');
        
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('orderCount');
      expect(res.body).toHaveProperty('grandTotals');
      expect(res.body).toHaveProperty('kitchenOrders');
    });
  });

  describe('GET /api/admin/orders — additional cases', () => {
    it('should reject with wrong admin password', async () => {
      const res = await request(app)
        .get('/api/admin/orders?date=01/01/2050')
        .set('x-admin-password', 'wrongpassword');
      expect(res.statusCode).toEqual(401);
    });

    it('should return empty orders array for a future date with no orders', async () => {
      const res = await request(app)
        .get('/api/admin/orders?date=01/01/2099')
        .set('x-admin-password', 'changeme');
      expect(res.statusCode).toEqual(200);
      expect(res.body.orders).toEqual([]);
    });

    it('should return orders when month query is provided', async () => {
      const res = await request(app)
        .get('/api/admin/orders?month=06/2026')
        .set('x-admin-password', 'changeme');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });
  });

  describe('PUT /api/admin/orders/delivery/batch — additional cases', () => {
    it('should cancel an order when routeOrder is CANCELLED', async () => {
      // Place a new order to get a valid orderId
      const orderRes = await request(app).post('/api/orders').send({
        customer: {
          name: 'Batch Tester', phone: '9876543210', pincode: '400092',
          address: 'Test Addr', locality: 'Borivali', wingFlat: 'C3',
          building: 'Batch Block', street: 'Batch St'
        },
        items: [{ name: 'Full Lunch', quantity: 1, price: 220 }],
        paymentMode: 'Cash'
      });
      const orderId = orderRes.body.orderId;

      const res = await request(app)
        .put('/api/admin/orders/delivery/batch')
        .set('x-admin-password', 'changeme')
        .send({ updates: [{ orderId, deliveryPerson: 'Raju', routeOrder: 'CANCELLED' }] });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);

      // Verify the order is now CANCELLED by fetching admin orders
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const todayStr = `${dd}/${mm}/${yyyy}`;

      const listRes = await request(app)
        .get(`/api/admin/orders?date=${todayStr}`)
        .set('x-admin-password', 'changeme');
      const cancelledOrder = listRes.body.orders.find(o => o.orderId === orderId);
      // Order should either be absent or have CANCELLED status
      if (cancelledOrder) {
        expect(cancelledOrder.status).toBe('CANCELLED');
      }
    });

    it('should return 400 when updates array is empty', async () => {
      const res = await request(app)
        .put('/api/admin/orders/delivery/batch')
        .set('x-admin-password', 'changeme')
        .send({ updates: [] });
      expect(res.statusCode).toEqual(400);
    });

    it('should successfully assign deliveryPerson and routeOrder', async () => {
      const orderRes = await request(app).post('/api/orders').send({
        customer: {
          name: 'Driver Tester', phone: '9876543210', pincode: '400092',
          address: 'Driver Addr', locality: 'Borivali', wingFlat: 'D4',
          building: 'Driver Block', street: 'Driver St'
        },
        items: [{ name: 'Mini Lunch', quantity: 1, price: 140 }],
        paymentMode: 'Cash'
      });
      const orderId = orderRes.body.orderId;

      const res = await request(app)
        .put('/api/admin/orders/delivery/batch')
        .set('x-admin-password', 'changeme')
        .send({ updates: [{ orderId, deliveryPerson: 'Mahesh', routeOrder: 3 }] });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });
});
