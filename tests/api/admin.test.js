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
});
