const request = require('supertest');
const app = require('../../server');

describe('Public Endpoints', () => {
  describe('GET /api/menu', () => {
    it('should return the menu array and metadata object', async () => {
      const res = await request(app).get('/api/menu');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('menu');
      expect(res.body).toHaveProperty('metadata');
      expect(Array.isArray(res.body.menu)).toBe(true);
      expect(typeof res.body.metadata).toBe('object');
    });
  });

  describe('GET /api/check-pincode', () => {
    it('should return 400 if no pincode is provided', async () => {
      const res = await request(app).get('/api/check-pincode');
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBe('Missing pincode');
    });

    it('should return zone for Borivali pincodes', async () => {
      const res = await request(app).get('/api/check-pincode?pincode=400092');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('zone');
      expect(res.body).toHaveProperty('surchargePerTiffin');
    });

    it('should return zone for non-Borivali pincodes', async () => {
      const res = await request(app).get('/api/check-pincode?pincode=400001');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('zone');
    });
  });

  describe('GET /api/customer/lookup', () => {
    it('should return 400 if no phone is provided', async () => {
      const res = await request(app).get('/api/customer/lookup');
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBe('Invalid phone number');
    });

    it('should return customer details if phone exists in mock data', async () => {
      const res = await request(app).get('/api/customer/lookup?phone=9876543210');
      expect(res.statusCode).toEqual(200);
      if (res.body.found) {
        expect(res.body.profiles[0]).toHaveProperty('name');
        expect(res.body.profiles[0]).toHaveProperty('address');
        expect(res.body.profiles[0]).toHaveProperty('locality');
      }
    });

    it('should return empty if phone does not exist', async () => {
      const res = await request(app).get('/api/customer/lookup?phone=6000000000');
      expect(res.statusCode).toEqual(200);
      expect(res.body.found).toBe(false);
      expect(res.body.profiles.length).toEqual(0);
    });

    it('should find a customer after they place an order', async () => {
      const uniquePhone = '7111111111';

      // Place an order to register the customer in mock
      await request(app).post('/api/orders').send({
        customer: {
          name: 'Lookup Test Customer',
          phone: uniquePhone,
          pincode: '400092',
          address: '5, Lookup Block, Test St, Borivali',
          locality: 'Borivali West',
          wingFlat: 'L1',
          building: 'Lookup Block',
          street: 'Test St',
        },
        items: [{ name: 'Mini Lunch', quantity: 1, price: 140 }],
        paymentMode: 'Cash',
      });

      // Now look them up
      const res = await request(app).get(`/api/customer/lookup?phone=${uniquePhone}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.found).toBe(true);
      expect(res.body.profiles[0].name).toBe('Lookup Test Customer');
      expect(res.body.profiles[0].phone).toBe(uniquePhone);
    });
  });

  describe('GET /api/check-pincode — Zone & Surcharge Details', () => {
    it('should return zone borivali for a Borivali pincode', async () => {
      const res = await request(app).get('/api/check-pincode?pincode=400092');
      expect(res.statusCode).toEqual(200);
      expect(res.body.zone).toBe('borivali');
    });

    it('should return zone outside for a non-Borivali pincode', async () => {
      const res = await request(app).get('/api/check-pincode?pincode=400001');
      expect(res.statusCode).toEqual(200);
      expect(res.body.zone).toBe('outside');
    });

    it('should return surchargePerTiffin of 40 (the configured outside surcharge)', async () => {
      const res = await request(app).get('/api/check-pincode?pincode=400001');
      expect(res.statusCode).toEqual(200);
      expect(res.body.surchargePerTiffin).toBe(40);
    });
  });

  describe('GET /api/menu — Menu Item Field Checks', () => {
    it('should return menu items each with name, price, and category fields', async () => {
      const res = await request(app).get('/api/menu');
      expect(res.statusCode).toEqual(200);
      expect(res.body.menu.length).toBeGreaterThan(0);
      res.body.menu.forEach(item => {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('price');
        expect(item).toHaveProperty('category');
        expect(typeof item.price).toBe('number');
        expect(item.price).toBeGreaterThan(0);
      });
    });

    it('should return metadata object with expected fields', async () => {
      const res = await request(app).get('/api/menu');
      expect(res.statusCode).toEqual(200);
      expect(typeof res.body.metadata).toBe('object');
      // Mock metadata has sabji and sweet fields
      expect(res.body.metadata).toHaveProperty('sabji');
      expect(res.body.metadata).toHaveProperty('sweet');
    });
  });
});
