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

    it('should auto-cancel recurring lunch orders when lunch is closed for the day', async () => {
      const { MOCK_ORDERS } = require('../../server');
      const testDate = '30/10/2026';

      const lunchOrder = {
        orderId: 'REC-CLOSE-LUNCH',
        date: testDate,
        time: '12:00',
        isRecurring: true,
        name: 'Auto Cancel Lunch User',
        phone: '9820000010',
        zone: 'borivali',
        category: 'Lunch',
        items: [{ name: 'Mini Lunch', price: 140, quantity: 1, category: 'Lunch' }],
        itemsSummary: 'Mini Lunch×1',
        surchargeTotal: 0,
        grandTotal: 140,
        status: 'ACTIVE',
      };

      const choviarOrder = {
        orderId: 'REC-KEEP-CHOV',
        date: testDate,
        time: '12:00',
        isRecurring: true,
        name: 'Keep Choviar User',
        phone: '9820000011',
        zone: 'borivali',
        category: 'Choviar',
        items: [{ name: 'Choviar', price: 160, quantity: 1, category: 'Choviar' }],
        itemsSummary: 'Choviar×1',
        surchargeTotal: 0,
        grandTotal: 160,
        status: 'ACTIVE',
      };

      MOCK_ORDERS.push(lunchOrder, choviarOrder);

      const res = await request(app)
        .put('/api/admin/menu')
        .set('x-admin-password', 'changeme')
        .send({
          items: [
            { name: 'Mini Lunch', price: 140, category: 'Lunch' },
            { name: 'Choviar', price: 160, category: 'Choviar' }
          ],
          metadata: {
            liveMenuDate: testDate,
            lunchClosed: 'Yes',
            choviarClosed: 'No'
          }
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancelledRecurringCount).toBeGreaterThanOrEqual(1);

      expect(lunchOrder.status).toBe('CANCELLED');
      expect(lunchOrder.cancelledReason).toBe('Lunch closed by admin');
      expect(choviarOrder.status).toBe('ACTIVE');
    });

    it('should auto-cancel recurring choviar orders when choviar is closed for the day', async () => {
      const { MOCK_ORDERS } = require('../../server');
      const testDate = '31/10/2026';

      const lunchOrder = {
        orderId: 'REC-KEEP-LUNCH',
        date: testDate,
        time: '12:00',
        isRecurring: true,
        name: 'Keep Lunch User',
        phone: '9820000012',
        zone: 'borivali',
        category: 'Lunch',
        items: [{ name: 'Mini Lunch', price: 140, quantity: 1, category: 'Lunch' }],
        itemsSummary: 'Mini Lunch×1',
        surchargeTotal: 0,
        grandTotal: 140,
        status: 'ACTIVE',
      };

      const choviarOrder = {
        orderId: 'REC-CLOSE-CHOV',
        date: testDate,
        time: '12:00',
        isRecurring: true,
        name: 'Close Choviar User',
        phone: '9820000013',
        zone: 'borivali',
        category: 'Choviar',
        items: [{ name: 'Choviar', price: 160, quantity: 1, category: 'Choviar' }],
        itemsSummary: 'Choviar×1',
        surchargeTotal: 0,
        grandTotal: 160,
        status: 'ACTIVE',
      };

      MOCK_ORDERS.push(lunchOrder, choviarOrder);

      const res = await request(app)
        .put('/api/admin/menu')
        .set('x-admin-password', 'changeme')
        .send({
          items: [
            { name: 'Mini Lunch', price: 140, category: 'Lunch' },
            { name: 'Choviar', price: 160, category: 'Choviar' }
          ],
          metadata: {
            liveMenuDate: testDate,
            lunchClosed: 'No',
            choviarClosed: 'Yes'
          }
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cancelledRecurringCount).toBeGreaterThanOrEqual(1);

      expect(lunchOrder.status).toBe('ACTIVE');
      expect(choviarOrder.status).toBe('CANCELLED');
      expect(choviarOrder.cancelledReason).toBe('Choviar closed by admin');
    });

    it('should update custom recurring order item prices and reflect in GET /api/admin/orders', async () => {
      const { MOCK_ORDERS } = require('../../server');
      const testDate = '01/11/2026';

      const customOrder = {
        orderId: 'REC-CUSTOM-PRICE-TEST',
        date: testDate,
        time: '12:00',
        isRecurring: true,
        name: 'Custom Order User',
        phone: '9820000014',
        zone: 'borivali',
        category: 'Lunch',
        items: [
          { name: 'Sabji (Half) - Bhindi', price: 50, quantity: 2, category: 'Individual' },
          { name: 'Thepla', price: 10, quantity: 6, category: 'Individual' }
        ],
        itemsSummary: 'Sabji (Half) - Bhindi×2, Thepla×6',
        surchargeTotal: 30, // < 250 in borivali
        grandTotal: 190, // 100 + 60 + 30 = 190
        status: 'ACTIVE',
      };

      MOCK_ORDERS.push(customOrder);

      // Admin updates sabjiHalfPrice from 50 to 80, theplaPrice from 10 to 12, and sabji dish to Paneer
      const res = await request(app)
        .put('/api/admin/menu')
        .set('x-admin-password', 'changeme')
        .send({
          items: [{ name: 'Full Lunch', price: 150 }],
          targetDate: testDate,
          metadata: {
            liveMenuDate: testDate,
            sabji: 'Paneer',
            sabjiHalfPrice: '80',
            theplaPrice: '12'
          }
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);

      // Verify custom order prices updated: 2*80 + 6*12 = 160 + 72 = 232 + 30 surcharge = 262 -> rounded to 260
      expect(customOrder.items[0].price).toBe(80);
      expect(customOrder.items[0].name).toBe('Sabji (Half) - Paneer');
      expect(customOrder.items[1].price).toBe(12);
      expect(customOrder.grandTotal).toBe(260);

      // Verify GET /api/admin/orders returns the updated grandTotal and has no-cache headers
      const ordersRes = await request(app)
        .get(`/api/admin/orders?date=${testDate}`)
        .set('x-admin-password', 'changeme');

      expect(ordersRes.statusCode).toEqual(200);
      expect(ordersRes.headers['cache-control']).toContain('no-store');
      const foundOrder = ordersRes.body.orders.find(o => o.orderId === 'REC-CUSTOM-PRICE-TEST');
      expect(foundOrder).toBeDefined();
      expect(foundOrder.grandTotal).toBe(260);
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

  describe('Customer Management Endpoints', () => {
    it('GET /api/admin/customers should reject without admin auth', async () => {
      const res = await request(app).get('/api/admin/customers');
      expect(res.statusCode).toEqual(401);
    });

    it('GET /api/admin/customers should return customers and filter by search query', async () => {
      const allRes = await request(app)
        .get('/api/admin/customers')
        .set('x-admin-password', 'changeme');
      expect(allRes.statusCode).toEqual(200);
      expect(allRes.body.success).toBe(true);
      expect(Array.isArray(allRes.body.customers)).toBe(true);
      expect(allRes.body.customers.length).toBeGreaterThan(0);

      const sample = allRes.body.customers[0];
      const searchKey = sample.name.substring(0, 3);
      const res = await request(app)
        .get(`/api/admin/customers?search=${encodeURIComponent(searchKey)}`)
        .set('x-admin-password', 'changeme');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.customers)).toBe(true);
      expect(res.body.customers.some(c => c.phone === sample.phone)).toBe(true);
    });

    it('POST /api/admin/customers should reject invalid data', async () => {
      const res = await request(app)
        .post('/api/admin/customers')
        .set('x-admin-password', 'changeme')
        .send({ name: '' });
      expect(res.statusCode).toEqual(400);
    });

    it('POST /api/admin/customers should create customer with address profile', async () => {
      const payload = {
        name: 'Meena Mehta',
        phone: '9820011223',
        wingFlat: 'B-302',
        building: 'Sheetal Heights',
        street: 'Factory Lane',
        locality: 'Borivali West',
        pincode: '400092',
        instructions: 'Call before delivery'
      };
      const res = await request(app)
        .post('/api/admin/customers')
        .set('x-admin-password', 'changeme')
        .send(payload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.customer.name).toBe('Meena Mehta');
      expect(res.body.customer.addresses.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/admin/customers/:phone should update customer address', async () => {
      const updatePayload = {
        name: 'Meena M. Mehta',
        wingFlat: 'B-303',
        building: 'Sheetal Heights',
        street: 'Factory Lane',
        locality: 'Borivali West',
        pincode: '400092',
        addresses: [
          {
            id: 'addr_1',
            name: 'Home',
            wingFlat: 'B-303',
            building: 'Sheetal Heights',
            street: 'Factory Lane',
            locality: 'Borivali West',
            pincode: '400092',
            address: 'B-303, Sheetal Heights, Factory Lane, Borivali West – 400092',
            instructions: 'Ring doorbell twice',
            isDefault: true
          },
          {
            id: 'addr_2',
            name: 'Office',
            wingFlat: 'Shop 4',
            building: 'Market Plaza',
            street: 'Station Road',
            locality: 'Borivali West',
            pincode: '400092',
            address: 'Shop 4, Market Plaza, Station Road, Borivali West – 400092',
            instructions: 'Leave at counter',
            isDefault: false
          }
        ]
      };
      const res = await request(app)
        .put('/api/admin/customers/9820011223')
        .set('x-admin-password', 'changeme')
        .send(updatePayload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.customer.addresses.length).toBe(2);
    });
  });

  describe('Bulk Food Order Logging Endpoints', () => {
    it('POST /api/admin/orders/bulk should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/admin/orders/bulk')
        .set('x-admin-password', 'changeme')
        .send({});
      expect(res.statusCode).toEqual(400);
    });

    it('POST /api/admin/orders/bulk should reject orders exceeding 20 rows', async () => {
      const tooManyItems = Array.from({ length: 21 }, (_, idx) => ({
        name: `Item ${idx + 1}`,
        quantity: 2,
        price: 50
      }));
      const res = await request(app)
        .post('/api/admin/orders/bulk')
        .set('x-admin-password', 'changeme')
        .send({
          customer: { name: 'Bulk Client', phone: '9820099887', locality: 'Borivali' },
          date: '25/11/2026',
          items: tooManyItems
        });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('Maximum 20 items');
    });

    it('POST /api/admin/orders/bulk should log order and reflect in monthly billing', async () => {
      const bulkPayload = {
        customer: {
          name: 'Bulk Party Client',
          phone: '9820099887',
          wingFlat: 'Hall A',
          building: 'Jain Derasar Complex',
          street: 'Main Road',
          locality: 'Borivali West',
          pincode: '400092'
        },
        date: '25/11/2026',
        items: [
          { name: 'Khandvi (Plates)', quantity: 30, price: 60 },
          { name: 'Gujarati Dal (Litres)', quantity: 15, price: 120 },
          { name: 'Gulab Jamun (Pieces)', quantity: 60, price: 15 }
        ],
        notes: 'Deliver hot before 12:30 PM'
      };
      // Total: 30*60 (1800) + 15*120 (1800) + 60*15 (900) = 4500
      const res = await request(app)
        .post('/api/admin/orders/bulk')
        .set('x-admin-password', 'changeme')
        .send(bulkPayload);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order.grandTotal).toBe(4500);
      expect(res.body.order.category).toBe('Bulk Food');
      expect(res.body.order.isBulk).toBe(true);

      // Verify it appears in monthly orders query (11/2026) for Billing
      const billingRes = await request(app)
        .get('/api/admin/orders?month=11/2026')
        .set('x-admin-password', 'changeme');
      expect(billingRes.statusCode).toEqual(200);
      expect(billingRes.body.orders.some(o => o.orderId === res.body.orderId)).toBe(true);
    });
  });
});

