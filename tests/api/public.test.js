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
      const res = await request(app).get('/api/customer/lookup?phone=9999999999');
      expect(res.statusCode).toEqual(200);
      expect(res.body.found).toBe(false);
      expect(res.body.profiles.length).toEqual(0);
    });
  });
});
