const request = require('supertest');
const app = require('../../server');

describe('Customer Billing Endpoints', () => {
  const phone = '9876543210';

  describe('GET /api/customer/billing', () => {
    it('should reject invalid phone numbers', async () => {
      const res = await request(app).get('/api/customer/billing?phone=123');
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBe('Invalid phone number');
    });

    it('should reject missing phone query param', async () => {
      const res = await request(app).get('/api/customer/billing');
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBe('Invalid phone number');
    });

    it('should return billing orders with payment status for a valid phone number', async () => {
      if (app.MOCK_ORDERS) {
        app.MOCK_ORDERS.push(
          {
            orderId: 'O-BILL-1',
            phone: phone,
            date: '15/09/2026',
            category: 'Lunch',
            itemsSummary: 'Full Lunch x 1',
            grandTotal: 150,
            paymentReceived: true,
            paymentMethod: 'UPI',
            amountReceived: '150',
            paymentDate: '15/09/2026',
            status: 'ACTIVE'
          },
          {
            orderId: 'O-BILL-2',
            phone: phone,
            date: '20/09/2026',
            category: 'Lunch',
            itemsSummary: 'Mini Lunch x 1',
            grandTotal: 120,
            paymentReceived: false,
            status: 'ACTIVE'
          },
          {
            orderId: 'O-BILL-CANCELLED',
            phone: phone,
            date: '18/09/2026',
            category: 'Lunch',
            itemsSummary: 'Cancelled Order',
            grandTotal: 150,
            paymentReceived: false,
            status: 'CANCELLED'
          }
        );
      }

      const res = await request(app).get(`/api/customer/billing?phone=${phone}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);

      // Verify cancelled order is excluded
      const cancelled = res.body.orders.find(o => o.orderId === 'O-BILL-CANCELLED');
      expect(cancelled).toBeUndefined();

      // Verify active orders are present
      const paidOrder = res.body.orders.find(o => o.orderId === 'O-BILL-1');
      expect(paidOrder).toBeDefined();
      expect(paidOrder.paymentReceived).toBe(true);
      expect(paidOrder.paid).toBe(150);
      expect(paidOrder.outstanding).toBe(0);

      const unpaidOrder = res.body.orders.find(o => o.orderId === 'O-BILL-2');
      expect(unpaidOrder).toBeDefined();
      expect(unpaidOrder.paymentReceived).toBe(false);
      expect(unpaidOrder.paid).toBe(0);
      expect(unpaidOrder.outstanding).toBe(120);
    });
  });
});
