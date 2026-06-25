const request = require('supertest');
const app = require('../../server');

describe('Customer Portal Endpoints', () => {
  const phone = '9999999999';

  describe('GET /api/orders/manage', () => {
    it('should reject invalid phone numbers', async () => {
      const res = await request(app).get('/api/orders/manage?phone=123');
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBe('Invalid phone number');
    });

    it('should return future orders for a valid phone number', async () => {
      // Insert a mock order explicitly for the year 2050
      if (app.MOCK_ORDERS) {
        app.MOCK_ORDERS.push({
          orderId: 'O-FUTURE',
          phone: phone,
          date: '30/12/2050',
          status: 'ACTIVE'
        });
      }

      // Now fetch it
      const res = await request(app).get(`/api/orders/manage?phone=${phone}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);
      
      // In mock mode, MOCK_ORDERS retains the pushed order, so we should see it
      expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
      expect(res.body.orders[0].status).not.toBe('CANCELLED');
    });
  });

  describe('PUT /api/orders/manage/:orderId', () => {
    it('should return 400 if phone is missing', async () => {
      const res = await request(app).put('/api/orders/manage/O-1234');
      expect(res.statusCode).toEqual(400);
    });

    it('should return 404 for non-existent order', async () => {
      const res = await request(app).put(`/api/orders/manage/NON_EXISTENT?phone=${phone}`);
      expect(res.statusCode).toEqual(404);
    });

    it('should successfully cancel an existing future order', async () => {
      // First fetch the orders to get a valid orderId
      const listRes = await request(app).get(`/api/orders/manage?phone=${phone}`);
      const orderToCancel = listRes.body.orders[0];
      
      expect(orderToCancel).toBeDefined();

      const res = await request(app).put(`/api/orders/manage/${orderToCancel.orderId}?phone=${phone}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Order cancelled successfully');

      // Verify it's gone/cancelled by re-fetching
      const updatedList = await request(app).get(`/api/orders/manage?phone=${phone}`);
      const stillExists = updatedList.body.orders.find(o => o.orderId === orderToCancel.orderId);
      expect(stillExists).toBeUndefined(); // Should be filtered out because status === CANCELLED
    });
  });
});
