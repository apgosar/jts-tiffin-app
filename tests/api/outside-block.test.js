const request = require('supertest');
const app = require('../../server');

describe('Outside Borivali Blocking (Dabbawala Mama Holiday)', () => {
  const baseCustomer = {
    name: 'Test Customer',
    phone: '9999999999',
    address: 'Flat 101, Test Bldg, Test Street, Test Locality',
    locality: 'Test Locality',
    wingFlat: '101',
    building: 'Test Bldg',
    street: 'Test Street'
  };

  const testBlockedDate = '25/12/2026';

  beforeAll(async () => {
    // Configure metadata with liveMenuDate and outsideBlockedDate
    await request(app)
      .put('/api/admin/menu')
      .set('x-admin-password', 'changeme')
      .send({
        items: [
          { name: 'Full Lunch', price: 220, category: 'Lunch', available: true },
          { name: 'Mini Lunch', price: 140, category: 'Lunch', available: true }
        ],
        metadata: {
          betaTesting: 'Yes',
          liveMenuDate: testBlockedDate,
          outsideBlockedDate: testBlockedDate
        }
      });
  });

  afterAll(async () => {
    // Clear outsideBlockedDate
    await request(app)
      .put('/api/admin/menu')
      .set('x-admin-password', 'changeme')
      .send({
        items: [
          { name: 'Full Lunch', price: 220, category: 'Lunch', available: true }
        ],
        metadata: {
          betaTesting: 'Yes',
          outsideBlockedDate: ''
        }
      });
  });

  describe('GET /api/check-pincode', () => {
    it('should report outsideBlocked=true for outside pincode on blocked date', async () => {
      const res = await request(app).get(`/api/check-pincode?pincode=400001&date=${encodeURIComponent(testBlockedDate)}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.zone).toBe('outside');
      expect(res.body.outsideBlocked).toBe(true);
    });

    it('should report outsideBlocked=false for Borivali pincode on blocked date', async () => {
      const res = await request(app).get(`/api/check-pincode?pincode=400092&date=${encodeURIComponent(testBlockedDate)}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.zone).toBe('borivali');
      expect(res.body.outsideBlocked).toBe(false);
    });

    it('should report outsideBlocked=false for outside pincode on a non-blocked date', async () => {
      const res = await request(app).get('/api/check-pincode?pincode=400001&date=01/01/2027');
      expect(res.statusCode).toBe(200);
      expect(res.body.zone).toBe('outside');
      expect(res.body.outsideBlocked).toBe(false);
    });
  });

  describe('POST /api/orders', () => {
    it('should block outside Borivali order on the blocked date with exact holiday message', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400001' }, // Outside Borivali
        items: [{ name: 'Full Lunch', quantity: 1, price: 220 }]
      };

      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Outside Borivali orders are closed because of Dabbawala Mama Holiday');
    });

    it('should allow Borivali order on the blocked date', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400092' }, // Borivali
        items: [{ name: 'Full Lunch', quantity: 1, price: 220 }]
      };

      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.zone).toBe('borivali');
    });
  });

  describe('POST /api/orders/recurring', () => {
    it('should block recurring outside order if blocked date is among deliveryDates', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400001' },
        items: [{ name: 'Full Lunch', quantity: 1, price: 220 }],
        deliveryDates: [
          { dateStr: '24/12/2026', skipLunch: false, skipChoviar: false },
          { dateStr: testBlockedDate, skipLunch: false, skipChoviar: false }
        ]
      };

      const res = await request(app).post('/api/orders/recurring').send(payload);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Outside Borivali orders are closed on 25/12/2026 because of Dabbawala Mama Holiday');
    });

    it('should allow recurring Borivali order even if blocked date is included', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400092' },
        items: [{ name: 'Full Lunch', quantity: 1, price: 220 }],
        deliveryDates: [
          { dateStr: testBlockedDate, skipLunch: false, skipChoviar: false }
        ]
      };

      const res = await request(app).post('/api/orders/recurring').send(payload);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
