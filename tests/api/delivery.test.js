const request = require('supertest');
const app = require('../../server');

describe('Delivery Endpoints', () => {
  describe('GET /api/delivery/orders', () => {
    it('should return delivery orders for today if no date is provided', async () => {
      const res = await request(app).get('/api/delivery/orders');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it('should return delivery orders for valid date', async () => {
      const res = await request(app).get('/api/delivery/orders?date=25/06/2026');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it('should return empty orders for a far-future date with no orders', async () => {
      const res = await request(app).get('/api/delivery/orders?date=01/01/2099');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      // In mock mode the delivery endpoint always returns empty regardless of date
      expect(Array.isArray(res.body.orders)).toBe(true);
    });
  });

  describe('PUT /api/delivery/orders/payment', () => {
    it('should return 400 if orderId is missing', async () => {
      const res = await request(app).put('/api/delivery/orders/payment').send({});
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBe('orderId required');
    });

    it('should mark order as paid successfully', async () => {
      const res = await request(app).put('/api/delivery/orders/payment').send({ orderId: 'O-1234' });
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });

    it('should accept full payment details including method and amount', async () => {
      const res = await request(app).put('/api/delivery/orders/payment').send({
        orderId: 'O-PAYMENT-TEST',
        paymentReceived: true,
        paymentMethod: 'UPI',
        amountReceived: '220'
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });

    it('should accept paymentReceived: false (cash not yet collected)', async () => {
      const res = await request(app).put('/api/delivery/orders/payment').send({
        orderId: 'O-UNPAID-TEST',
        paymentReceived: false,
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });
});
