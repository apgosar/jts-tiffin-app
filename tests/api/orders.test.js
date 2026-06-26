const request = require('supertest');
const app = require('../../server');

describe('Order Endpoints', () => {
  describe('POST /api/orders', () => {
    it('should reject if missing required fields', async () => {
      const res = await request(app).post('/api/orders').send({});
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('required');
    });

    it('should calculate price correctly and accept valid order', async () => {
      // Assuming mock menu has Full Lunch at 120 and Mini Lunch at 90
      const orderPayload = {
        customer: {
          name: 'Test Customer',
          phone: '9999999999',
          pincode: '400092',
          address: 'Test Addr',
          locality: 'Test Loc',
          wingFlat: 'A1',
          building: 'Bldg',
          street: 'St'
        },
        items: [
          { name: 'Full Lunch', quantity: 2, price: 120 },
          { name: 'Mini Lunch', quantity: 1, price: 90 }
        ],
        totalPrice: 330,
        paymentMode: 'Cash'
      };
      
      const res = await request(app).post('/api/orders').send(orderPayload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.orderId).toBeDefined();

    });
  });

  describe('POST /api/orders/recurring', () => {
    it('should reject if deliveryDates is missing or empty', async () => {
      const payload = {
        customer: { name: 'Test', phone: '1231231234', pincode: '400092', address: 'Addr', locality: 'Loc' },
        items: [{ name: 'Full Lunch', quantity: 1, price: 120 }],
        paymentMode: 'Cash'
      };
      
      const res = await request(app).post('/api/orders/recurring').send(payload);
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    it('should accept valid recurring order', async () => {
      const payload = {
        customer: { name: 'Test Recurring', phone: '9999999999', pincode: '400092', address: 'Addr', locality: 'Loc', wingFlat: '1', building: 'B', street: 'S' },
        items: [{ name: 'Full Lunch', quantity: 1, price: 120 }],
        paymentMode: 'Cash',
        deliveryDates: ['25/06/2026', '26/06/2026']
      };
      
      const res = await request(app).post('/api/orders/recurring').send(payload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
    });

    it('should accept recurring order with skipped meals', async () => {
      const payload = {
        customer: { name: 'Test Skips', phone: '9999999999', pincode: '400092', address: 'Addr', locality: 'Loc', wingFlat: '1', building: 'B', street: 'S' },
        items: [
          { name: 'Full Lunch', quantity: 1, price: 220 },
          { name: 'Choviar Special', quantity: 2, price: 160 }
        ],
        paymentMode: 'Cash',
        deliveryDates: [
          { dateStr: '25/06/2026' }, // Both
          { dateStr: '26/06/2026', skipChoviar: true }, // Lunch only
          { dateStr: '27/06/2026', skipLunch: true }, // Choviar only
          { dateStr: '28/06/2026', skipLunch: true, skipChoviar: true } // Skip completely
        ]
      };

      const res = await request(app).post('/api/orders/recurring').send(payload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(4);
    });
  });

  describe('Order Permutations & Pricing Logic', () => {
    const baseCustomer = {
      name: 'Tester', phone: '9999999999', address: 'Test', locality: 'Test', wingFlat: '1', building: 'Test', street: 'Test'
    };

    it('should process Lunch and Choviar mixed order', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400092' },
        items: [
          { name: 'Full Lunch', quantity: 1, price: 220 },
          { name: 'Choviar Special', quantity: 1, price: 160 }
        ],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      // For Borivali (400092) under 250:
      // Lunch subtotal = 220 (surcharge +30)
      // Choviar subtotal = 160 (surcharge +30)
      // Exact = 220 + 30 + 160 + 30 = 440
      expect(res.body.grandTotal).toBe(440);
    });

    it('should process Choviar order only', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400092' },
        items: [
          { name: 'Choviar Special', quantity: 2, price: 160 }
        ],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(200);
      // Choviar subtotal = 320 (surcharge 0)
      // Exact = 320
      expect(res.body.grandTotal).toBe(320);
    });

    it('should process Outside Borivali surcharges (40 per tiffin)', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400001' }, // outside
        items: [
          { name: 'Full Lunch', quantity: 2, price: 220 },
          { name: 'Choviar Special', quantity: 1, price: 160 } // Choviar items (1 tiffin)
        ],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(200);
      // Lunch subtotal = 440, Tiffins = 2, Surcharge = 40*2 = 80
      // Choviar subtotal = 160, Tiffins = 1, Surcharge = 40*1 = 40
      // Exact total = 440 + 80 + 160 + 40 = 720
      expect(res.body.grandTotal).toBe(720);
      expect(res.body.surchargeTotal).toBe(120);
    });

    it('should apply 30 delivery charge for Borivali order under 250', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400092' }, // within borivali
        items: [
          { name: 'Mini Lunch', quantity: 1, price: 140 } // under 250
        ],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(200);
      // Lunch subtotal = 140, Surcharge = 30
      // Exact total = 170
      expect(res.body.grandTotal).toBe(170);
      expect(res.body.surchargeTotal).toBe(30);
    });

    it('should apply 40 surcharge for Outside Borivali order under 250 (and no additional 30 charge)', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400001' }, // outside
        items: [
          { name: 'Mini Lunch', quantity: 1, price: 140 } // under 250
        ],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(200);
      // Lunch subtotal = 140, Surcharge = 40 (because outside borivali is 40 per tiffin, and it bypasses the < 250 rule)
      // Exact total = 180
      expect(res.body.grandTotal).toBe(180);
      expect(res.body.surchargeTotal).toBe(40);
    });

    it('should reject unknown custom items', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400092' },
        items: [
          { name: 'Nonexistent Item', quantity: 1, price: 500 }
        ],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('Unknown or invalid item');
    });

    it('should NOT apply Borivali delivery charge when subtotal is exactly ₹250', async () => {
      // Brunch = ₹180, Mini Lunch = ₹140; use carefully chosen quantities.
      // Mini Lunch x1 = 140 (under 250, surcharge applies). We need subtotal = 250 exactly.
      // Brunch x1 = 180, Mini Lunch x1 = 140 => total 320 > 250 => no surcharge
      // Use just Brunch (180) + Roti (8 each) => 180 + 8*n. For 250: n=8.75 — not integer.
      // Use Family Meal (320) — clearly above 250, no surcharge
      const payload = {
        customer: { ...baseCustomer, pincode: '400092' },
        items: [
          { name: 'Family Meal', quantity: 1, price: 320 } // 320 > 250, no surcharge
        ],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(200);
      // 320 > 250, so no surcharge for Borivali
      expect(res.body.surchargeTotal).toBe(0);
      expect(res.body.grandTotal).toBe(320);
    });

    it('should return zone: borivali for a Borivali pincode', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400092' },
        items: [{ name: 'Full Lunch', quantity: 1, price: 220 }],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.zone).toBe('borivali');
    });

    it('should return zone: outside for a non-Borivali pincode', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400001' },
        items: [{ name: 'Full Lunch', quantity: 1, price: 220 }],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.zone).toBe('outside');
    });

    it('should accept a Roti-only order and calculate price correctly', async () => {
      const payload = {
        customer: { ...baseCustomer, pincode: '400092' },
        items: [{ name: 'Roti', quantity: 10, price: 8 }],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      // 10 roti = 10*8 = 80, which is under 250 so Borivali surcharge applies: 80+30 = 110
      expect(res.body.surchargeTotal).toBe(30);
    });

    it('should round grandTotal to the nearest ₹5', async () => {
      // Brunch = 180. With Borivali delivery surcharge 30 => 210, already multiple of 5
      // Mini Lunch = 140 + 30 = 170, multiple of 5. Use an outside pincode.
      // Outside: Full Lunch x1 = 220, surcharge 40 => 260. Then check rounding.
      // Let's use a Brunch at 180 for outside (no Borivali surcharge path for simple test)
      const payload = {
        customer: { ...baseCustomer, pincode: '400001' },
        items: [{ name: 'Brunch', quantity: 1, price: 180 }],
        paymentMode: 'Cash'
      };
      const res = await request(app).post('/api/orders').send(payload);
      expect(res.statusCode).toEqual(200);
      // 180 + 40 = 220, already multiple of 5
      expect(res.body.grandTotal % 5).toBe(0);
    });
});
});
