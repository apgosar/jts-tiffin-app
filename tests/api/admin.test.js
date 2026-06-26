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
