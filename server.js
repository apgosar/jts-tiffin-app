require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const path         = require('path');
const fs           = require('fs');
const { v4: uuidv4 } = require('uuid');
const rateLimit    = require('express-rate-limit');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const app = express();
app.set('trust proxy', 1); // needed when behind React dev proxy / reverse proxy

// ─── Security headers (helmet) ────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors());

// ─── Body size limit (prevents large-payload DoS) ────────────────────────────
app.use(express.json({ limit: '50kb' }));

// ─── Config ───────────────────────────────────────────────────────────────────
const USE_MOCK         = process.env.USE_MOCK_DATA === 'true';
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD || 'changeme';
if (ADMIN_PASSWORD === 'changeme') {
  console.warn('⚠️  WARNING: ADMIN_PASSWORD is set to the default "changeme". Set a strong password in .env before going live!');
}
const SURCHARGE_AMOUNT = parseInt(process.env.OUTSIDE_DELIVERY_SURCHARGE || '40', 10);

// Borivali pincodes: comma or space-separated list.
// Fail-safe: managed strictly via environment variables.
const BORIVALI_PINCODES = new Set(
  (process.env.BORIVALI_PINCODES || '')
    .split(/[,| \t]+/)
    .map(p => p.trim())
    .filter(Boolean)
);

// ─── Firebase Initialization ─────────────────────────────────────────────────
if (!USE_MOCK && !process.env.FIREBASE_CREDENTIALS_PATH && process.env.NODE_ENV !== 'production') {
  console.error('ERROR: FIREBASE_CREDENTIALS_PATH not set in .env');
  process.exit(1);
}

let db = null;
if (!USE_MOCK) {
  if (process.env.FIREBASE_CREDENTIALS_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } else if (process.env.FIREBASE_CREDENTIALS_PATH) {
    const credPath = path.resolve(process.env.FIREBASE_CREDENTIALS_PATH);
    if (fs.existsSync(credPath)) {
      const serviceAccount = require(credPath);
      initializeApp({
        credential: cert(serviceAccount)
      });
    } else {
      console.warn(`WARNING: FIREBASE_CREDENTIALS_PATH is set to ${credPath} but the file does not exist. Falling back to Application Default Credentials.`);
      initializeApp();
    }
  } else {
    // In Google Cloud Run (production), initialize without arguments to use Application Default Credentials
    initializeApp();
  }
  db = getFirestore();
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
const orderLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false });
const adminLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const publicLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const lookupLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  standardHeaders: true, legacyHeaders: false }); // phone lookup: 10/15min

// ─── Mock data ────────────────────────────────────────────────────────────────
let MOCK_MENU = [
  { name: 'Mini Lunch',  description: '3 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 140, available: true, category: 'Lunch' },
  { name: 'Brunch',      description: '6 Roti, Sabji, 1/2 Dal, 1/2 Rice, Salad / Sweet / Namkeen / Farsan', price: 180, available: true, category: 'Lunch' },
  { name: 'Full Lunch',  description: '6 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 220, available: true, category: 'Lunch' },
  { name: 'Family Meal', description: '9 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 320, available: true, category: 'Lunch' },
  { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160, available: true, category: 'Choviar' },
];
let MOCK_METADATA = { sabji: 'Bhindi', sweet: 'Aamras', dal: 'Gujarati Dal', farsan: 'Dhokla', betaTesting: 'Yes' };

let MOCK_ORDERS    = [];
let MOCK_CUSTOMERS = []; // [{ name, phone, wingFlat, building, street, landmark, locality, pincode, lastOrderDate }]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseJsonSafe(str, fallback = []) {
  try { return JSON.parse(str); } catch { return fallback; }
}

async function getMenuForPricing() {
  if (USE_MOCK) return { menuItems: MOCK_MENU, metadata: MOCK_METADATA };
  
  const menuSnap = await db.collection('menu').get();
  let menuItems = menuSnap.docs.map(doc => doc.data());
  
  // Sort menu items in specific order
  const orderList = ['Mini Lunch', 'Brunch', 'Full Lunch', 'Family Meal'];
  menuItems.sort((a, b) => {
    const idxA = orderList.indexOf(a.name);
    const idxB = orderList.indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
  
  const metaDoc = await db.collection('metadata').doc('global').get();
  const metadata = metaDoc.exists ? metaDoc.data() : {};
  
  return { menuItems, metadata };
}

function computeServerPrice(itemName, menuItems, metadata) {
  // "Roti"
  if (itemName === 'Roti') return { price: parseFloat(metadata.rotiPrice) || 8, category: 'Individual' };
  
  // Custom Order Items
  const sabjiNameHalf = metadata.sabji ? `Sabji (Half) - ${metadata.sabji}` : 'Sabji (Half)';
  const sabjiNameFull = metadata.sabji ? `Sabji (Full) - ${metadata.sabji}` : 'Sabji (Full)';
  const dalNameHalf = metadata.dal ? `Dal (Half) - ${metadata.dal}` : 'Dal (Half)';
  const dalNameFull = metadata.dal ? `Dal (Full) - ${metadata.dal}` : 'Dal (Full)';
  const riceNameHalf = metadata.rice ? `Rice (Half) - ${metadata.rice}` : 'Rice (Half)';
  const riceNameFull = metadata.rice ? `Rice (Full) - ${metadata.rice}` : 'Rice (Full)';
  const farsanName = metadata.farsan ? `Farsan - ${metadata.farsan}` : 'Farsan';
  const sweetName = metadata.sweet ? `Sweet - ${metadata.sweet}` : 'Sweet';

  if (itemName === sabjiNameHalf) return { price: parseFloat(metadata.sabjiHalfPrice) || 0, category: 'Individual' };
  if (itemName === sabjiNameFull) return { price: parseFloat(metadata.sabjiFullPrice) || 0, category: 'Individual' };
  if (itemName === dalNameHalf) return { price: parseFloat(metadata.dalHalfPrice) || 0, category: 'Individual' };
  if (itemName === dalNameFull) return { price: parseFloat(metadata.dalFullPrice) || 0, category: 'Individual' };
  if (itemName === riceNameHalf || itemName === `Rice (Half)`) return { price: parseFloat(metadata.riceHalfPrice) || 0, category: 'Individual' };
  if (itemName === riceNameFull || itemName === `Rice (Full)`) return { price: parseFloat(metadata.riceFullPrice) || 0, category: 'Individual' };
  if (itemName === `Rice`) return { price: parseFloat(metadata.ricePrice) || 0, category: 'Individual' };
  if (itemName === farsanName) return { price: parseFloat(metadata.farsanPrice) || 0, category: 'Individual' };
  if (itemName === sweetName) return { price: parseFloat(metadata.sweetPrice) || 0, category: 'Individual' };

  // Regular menu item (Lunch / Choviar)
  const item = menuItems.find(m => m.name === itemName);
  if (item) return { price: item.price, category: item.category || 'Lunch' };

  // Fallbacks for recurring orders where standard packages might not be in today's menu
  if (itemName === 'Full Choviar') return { price: 150, category: 'Choviar' }; // Estimated price
  
  return null;
}

function getZone(pincode) {
  // Fail-secure: If for some reason the set is empty, default to 'outside' to prevent loss.
  if (BORIVALI_PINCODES.size === 0) return 'outside';
  return BORIVALI_PINCODES.has(String(pincode).trim()) ? 'borivali' : 'outside';
}

function formatDate(date) {
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/menu
app.get('/api/menu', publicLimiter, async (req, res) => {
  if (USE_MOCK) return res.json({ menu: MOCK_MENU, metadata: MOCK_METADATA });
  try {
    const { menuItems, metadata } = await getMenuForPricing();
    res.json({ menu: menuItems, metadata });
  } catch (err) {
    console.error('Error fetching menu:', err.message);
    res.status(500).json({ error: 'Failed to fetch menu.' });
  }
});

// GET /api/check-pincode?pincode=XXXXXX
app.get('/api/check-pincode', publicLimiter, (req, res) => {
  const { pincode } = req.query;
  if (!pincode) return res.status(400).json({ error: 'Missing pincode' });
  res.json({ zone: getZone(pincode), surchargePerTiffin: SURCHARGE_AMOUNT });
});

// GET /api/customer/lookup?phone=XXXXXXXXXX
app.get('/api/customer/lookup', lookupLimiter, async (req, res) => {
  const { phone } = req.query;
  if (!phone || !/^[6-9]\d{9}$/.test(phone.trim())) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }
  const queryPhone = phone.trim();

  if (USE_MOCK) {
    const profiles = MOCK_CUSTOMERS.filter(c => c.phone === queryPhone);
    return res.json({ found: profiles.length > 0, profiles });
  }

  try {
    const customerDoc = await db.collection('customers').doc(queryPhone).get();
    if (customerDoc.exists) {
      return res.json({ found: true, profiles: [customerDoc.data()] });
    } else {
      return res.json({ found: false, profiles: [] });
    }
  } catch (err) {
    console.error('Error looking up customer:', err.message);
    res.status(500).json({ error: 'Failed to look up customer.' });
  }
});

// POST /api/orders
app.post('/api/orders', orderLimiter, async (req, res) => {
  const { customer, items } = req.body;

  if (!customer || !items) {
    return res.status(400).json({ error: 'Missing required fields: customer, items' });
  }
  const required = ['name', 'phone', 'wingFlat', 'building', 'street', 'locality', 'pincode', 'address'];
  for (const f of required) {
    if (!customer[f] || !String(customer[f]).trim()) {
      return res.status(400).json({ error: `Missing customer field: ${f}` });
    }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items in order' });
  }
  if (!/^\d{6}$/.test(customer.pincode.trim())) {
    return res.status(400).json({ error: 'Invalid PINCODE' });
  }

  const MAX_QTY_PER_ITEM = 20;
  const MAX_ROTI_QTY = 200;
  const MAX_ITEM_TYPES   = 6;
  if (items.length > MAX_ITEM_TYPES) {
    return res.status(400).json({ error: `Too many item types. Maximum ${MAX_ITEM_TYPES} allowed per order.` });
  }
  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    const limit = item.name === 'Roti' ? MAX_ROTI_QTY : MAX_QTY_PER_ITEM;
    if (!qty || qty < 1 || qty > limit) {
      return res.status(400).json({ error: `Invalid quantity for "${item.name}". Must be 1–${limit}.` });
    }
  }

  let menuItems, metadata;
  try {
    const result = await getMenuForPricing();
    menuItems = result.menuItems;
    metadata = result.metadata;
  } catch (err) {
    console.error('[INTERNAL] Failed to fetch menu for pricing:', err.message);
    return res.status(500).json({ error: 'Failed to validate order. Please try again.' });
  }

  const validatedItems = [];
  for (const item of items) {
    const serverData = computeServerPrice(item.name, menuItems, metadata);
    if (!serverData) {
      return res.status(400).json({ error: `Unknown or invalid item: "${item.name}"` });
    }
    validatedItems.push({ name: item.name, price: serverData.price, quantity: parseInt(item.quantity, 10), category: serverData.category });
  }

  const zone = getZone(customer.pincode.trim());
  const subtotal = validatedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  
  const baseOrderId  = uuidv4().slice(0, 8).toUpperCase();
  const now          = new Date();
  
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + (3600000 * 5.5));
  const deliveryTime = new Date(istTime);
  if (istTime.getHours() >= 19) {
    deliveryTime.setDate(deliveryTime.getDate() + 1);
  }
  const date = `${String(deliveryTime.getDate()).padStart(2, '0')}/${String(deliveryTime.getMonth() + 1).padStart(2, '0')}/${deliveryTime.getFullYear()}`;
  const time = formatTime(now);

  const lunchItems = validatedItems.filter(i => i.category !== 'Choviar');
  const choviarItems = validatedItems.filter(i => i.category === 'Choviar');

  const lunchSubtotal = lunchItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const choviarSubtotal = choviarItems.reduce((s, i) => s + i.price * i.quantity, 0);

  let lunchSurcharge = 0;
  let choviarSurcharge = 0;

  if (zone === 'outside') {
    let lunchOutsideTiffins = lunchItems.filter(i => i.name.includes('Lunch') || i.name.includes('Meal') || i.name.includes('Brunch')).reduce((s, i) => s + i.quantity, 0);
    if (lunchOutsideTiffins === 0 && lunchItems.length > 0) lunchOutsideTiffins = 1;
    
    let choviarOutsideTiffins = choviarItems.filter(i => i.name.includes('Choviar') || i.name.includes('Meal')).reduce((s, i) => s + i.quantity, 0);
    if (choviarOutsideTiffins === 0 && choviarItems.length > 0) choviarOutsideTiffins = 1;

    lunchSurcharge = lunchItems.length > 0 ? 40 * lunchOutsideTiffins : 0;
    choviarSurcharge = choviarItems.length > 0 ? 40 * choviarOutsideTiffins : 0;
  } else if (zone === 'borivali') {
    if (lunchItems.length > 0 && lunchSubtotal < 250) lunchSurcharge = 30;
    if (choviarItems.length > 0 && choviarSubtotal < 250) choviarSurcharge = 30;
  }

  const totalSurcharge = lunchSurcharge + choviarSurcharge;
  const exactTotal = subtotal + totalSurcharge;
  const grandTotalRounded = Math.round(exactTotal / 5) * 5;
  const roundOffAmount = grandTotalRounded - exactTotal;

  const subOrders = [];
  let roundOffApplied = false;
  
  if (lunchItems.length > 0) {
    const isFirst = !roundOffApplied;
    roundOffApplied = true;
    subOrders.push({
      orderId: choviarItems.length > 0 ? `${baseOrderId}-L` : baseOrderId,
      items: lunchItems,
      subtotal: lunchSubtotal,
      surchargeTotal: lunchSurcharge,
      roundOffAmount: isFirst ? roundOffAmount : 0,
      grandTotal: lunchSubtotal + lunchSurcharge + (isFirst ? roundOffAmount : 0),
      category: 'Lunch'
    });
  }

  if (choviarItems.length > 0) {
    const isFirst = !roundOffApplied;
    roundOffApplied = true;
    subOrders.push({
      orderId: lunchItems.length > 0 ? `${baseOrderId}-C` : baseOrderId,
      items: choviarItems,
      subtotal: choviarSubtotal,
      surchargeTotal: choviarSurcharge,
      roundOffAmount: isFirst ? roundOffAmount : 0,
      grandTotal: choviarSubtotal + choviarSurcharge + (isFirst ? roundOffAmount : 0),
      category: 'Choviar'
    });
  }

  const customerRecord = {
    name:     customer.name.trim(),
    phone:    customer.phone.trim(),
    wingFlat: customer.wingFlat.trim(),
    building: customer.building.trim(),
    street:   customer.street.trim(),
    landmark: (customer.landmark || '').trim(),
    locality: customer.locality.trim(),
    pincode:  customer.pincode.trim(),
    address:  customer.address.trim(),
    lastOrderDate: date,
  };

  if (USE_MOCK) {
    for (const sub of subOrders) {
      MOCK_ORDERS.push({
        orderId: sub.orderId, date, time,
        ...customerRecord,
        zone,
        items: sub.items,
        itemsSummary: sub.items.map(i => `${i.name}×${i.quantity}`).join(', '),
        surchargeTotal: sub.surchargeTotal,
        grandTotal: sub.grandTotal,
        deliveryPerson: '',
        routeOrder: 9999,
        paymentReceived: false,
        paymentMethod: 'Cash',
        amountReceived: '',
        status: 'ACTIVE'
      });
    }

    const existingIdx = MOCK_CUSTOMERS.findIndex(c => c.phone === customer.phone.trim());
    if (existingIdx >= 0) {
      MOCK_CUSTOMERS[existingIdx] = customerRecord;
    } else {
      MOCK_CUSTOMERS.push(customerRecord);
    }

    return res.json({ success: true, orderId: baseOrderId, zone, surchargeTotal: totalSurcharge, grandTotal: grandTotalRounded });
  }

  try {
    const batch = db.batch();

    for (const sub of subOrders) {
      const orderRef = db.collection('orders').doc(sub.orderId);
      batch.set(orderRef, {
        orderId: sub.orderId, date, time,
        createdAt: FieldValue.serverTimestamp(),
        ...customerRecord,
        zone,
        items: sub.items,
        itemsSummary: sub.items.map(i => `${i.name}×${i.quantity}`).join(', '),
        surchargeTotal: sub.surchargeTotal,
        grandTotal: sub.grandTotal,
        deliveryPerson: '',
        routeOrder: 9999,
        paymentReceived: false,
        paymentMethod: 'Cash',
        amountReceived: '',
        status: 'ACTIVE'
      });
    }

    const custRef = db.collection('customers').doc(customer.phone.trim());
    batch.set(custRef, customerRecord, { merge: true });

    await batch.commit();

    res.json({ 
      success: true, 
      orderId: baseOrderId, 
      zone, 
      surchargeTotal: totalSurcharge, 
      grandTotal: grandTotalRounded 
    });
  } catch (err) {
    console.error('Error writing order:', err.message);
    res.status(500).json({ error: 'Failed to place order. Please try again later.' });
  }
});

// POST /api/orders/recurring
app.post('/api/orders/recurring', orderLimiter, async (req, res) => {
  const { customer, items, deliveryDates } = req.body;

  if (!customer || !items || !deliveryDates || !Array.isArray(deliveryDates)) {
    return res.status(400).json({ error: 'Missing required fields: customer, items, deliveryDates' });
  }
  const required = ['name', 'phone', 'wingFlat', 'building', 'street', 'locality', 'pincode', 'address'];
  for (const f of required) {
    if (!customer[f] || !String(customer[f]).trim()) {
      return res.status(400).json({ error: `Missing customer field: ${f}` });
    }
  }

  let menuItems, metadata;
  try {
    const result = await getMenuForPricing();
    menuItems = result.menuItems;
    metadata = result.metadata;
  } catch (err) {
    return res.status(500).json({ error: 'Failed to validate order. Please try again.' });
  }

  const validatedItems = [];
  for (const item of items) {
    const serverData = computeServerPrice(item.name, menuItems, metadata);
    if (!serverData) return res.status(400).json({ error: `Unknown item: ${item.name}` });
    validatedItems.push({ name: item.name, price: serverData.price, quantity: parseInt(item.quantity, 10), category: serverData.category });
  }

  const zone = getZone(customer.pincode.trim());
  const subtotal = validatedItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const lunchItems = validatedItems.filter(i => i.category !== 'Choviar');
  const choviarItems = validatedItems.filter(i => i.category === 'Choviar');

  const lunchSubtotal = lunchItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const choviarSubtotal = choviarItems.reduce((s, i) => s + i.price * i.quantity, 0);

  let lunchSurcharge = 0;
  let choviarSurcharge = 0;

  if (zone === 'outside') {
    let lunchOutsideTiffins = lunchItems.filter(i => i.name.includes('Lunch') || i.name.includes('Meal') || i.name.includes('Brunch')).reduce((s, i) => s + i.quantity, 0);
    if (lunchOutsideTiffins === 0 && lunchItems.length > 0) lunchOutsideTiffins = 1;
    let choviarOutsideTiffins = choviarItems.filter(i => i.name.includes('Choviar') || i.name.includes('Meal')).reduce((s, i) => s + i.quantity, 0);
    if (choviarOutsideTiffins === 0 && choviarItems.length > 0) choviarOutsideTiffins = 1;

    lunchSurcharge = lunchItems.length > 0 ? 40 * lunchOutsideTiffins : 0;
    choviarSurcharge = choviarItems.length > 0 ? 40 * choviarOutsideTiffins : 0;
  } else if (zone === 'borivali') {
    if (lunchItems.length > 0 && lunchSubtotal < 250) lunchSurcharge = 30;
    if (choviarItems.length > 0 && choviarSubtotal < 250) choviarSurcharge = 30;
  }

  const totalSurcharge = lunchSurcharge + choviarSurcharge;
  const exactTotal = subtotal + totalSurcharge;
  const grandTotalRounded = Math.round(exactTotal / 5) * 5;
  const roundOffAmount = grandTotalRounded - exactTotal;

  const customerRecord = {
    name: customer.name.trim(), phone: customer.phone.trim(), wingFlat: customer.wingFlat.trim(),
    building: customer.building.trim(), street: customer.street.trim(), landmark: (customer.landmark || '').trim(),
    locality: customer.locality.trim(), pincode: customer.pincode.trim(), address: customer.address.trim(),
    lastOrderDate: deliveryDates[deliveryDates.length - 1] || formatDate(new Date()),
  };

  if (USE_MOCK) return res.json({ success: true, count: deliveryDates.length });

  try {
    const batch = db.batch();

    for (const d of deliveryDates) {
      const dateStr = typeof d === 'string' ? d : d.dateStr;
      const skipLunch = typeof d === 'object' ? d.skipLunch : false;
      const skipChoviar = typeof d === 'object' ? d.skipChoviar : false;

      const baseOrderId = uuidv4().slice(0, 8).toUpperCase();
      let roundOffApplied = false;

      if (lunchItems.length > 0 && !skipLunch) {
        const isFirst = !roundOffApplied;
        roundOffApplied = true;
        const subId = (choviarItems.length > 0 && !skipChoviar) ? `${baseOrderId}-L` : baseOrderId;
        batch.set(db.collection('orders').doc(subId), {
          orderId: subId, date: dateStr, time: '12:00', createdAt: FieldValue.serverTimestamp(),
          ...customerRecord, zone, items: lunchItems,
          itemsSummary: lunchItems.map(i => `${i.name}×${i.quantity}`).join(', '),
          surchargeTotal: lunchSurcharge, grandTotal: lunchSubtotal + lunchSurcharge + (isFirst ? roundOffAmount : 0),
          deliveryPerson: '', routeOrder: 9999, paymentReceived: false, paymentMethod: 'Cash', amountReceived: '', status: 'ACTIVE'
        });
      }

      if (choviarItems.length > 0 && !skipChoviar) {
        const isFirst = !roundOffApplied;
        roundOffApplied = true;
        const subId = (lunchItems.length > 0 && !skipLunch) ? `${baseOrderId}-C` : baseOrderId;
        batch.set(db.collection('orders').doc(subId), {
          orderId: subId, date: dateStr, time: '12:00', createdAt: FieldValue.serverTimestamp(),
          ...customerRecord, zone, items: choviarItems,
          itemsSummary: choviarItems.map(i => `${i.name}×${i.quantity}`).join(', '),
          surchargeTotal: choviarSurcharge, grandTotal: choviarSubtotal + choviarSurcharge + (isFirst ? roundOffAmount : 0),
          deliveryPerson: '', routeOrder: 9999, paymentReceived: false, paymentMethod: 'Cash', amountReceived: '', status: 'ACTIVE'
        });
      }
    }

    batch.set(db.collection('customers').doc(customer.phone.trim()), customerRecord, { merge: true });
    await batch.commit();
    res.json({ success: true, count: deliveryDates.length });
  } catch (err) {
    console.error('Error writing recurring order:', err.message);
    res.status(500).json({ error: 'Failed to place recurring order. Please try again later.' });
  }
});

// 📱 CUSTOMER PORTAL 📱
// GET /api/orders/manage?phone=XXXXXXXXXX
app.get('/api/orders/manage', publicLimiter, async (req, res) => {
  const { phone } = req.query;
  if (!phone || !/^[6-9]\d{9}$/.test(phone.trim())) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const queryPhone = phone.trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper to parse DD/MM/YYYY
  const parseDate = (dStr) => {
    const [day, month, year] = dStr.split('/');
    return new Date(year, month - 1, day);
  };

  if (USE_MOCK) {
    const orders = MOCK_ORDERS.filter(o => o.phone === queryPhone && o.status !== 'CANCELLED');
    const futureOrders = orders.filter(o => parseDate(o.date) > today);
    return res.json({ success: true, orders: futureOrders });
  }

  try {
    const snapshot = await db.collection('orders')
      .where('phone', '==', queryPhone)
      .get();
      
    const allOrders = snapshot.docs.map(doc => doc.data()).filter(o => o.status !== 'CANCELLED');
    // Only return future orders (after today)
    const futureOrders = allOrders.filter(o => parseDate(o.date) > today);
    
    // Sort by date ascending
    futureOrders.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    
    res.json({ success: true, orders: futureOrders });
  } catch (err) {
    console.error('Error fetching customer orders:', err.message);
    res.status(500).json({ error: 'Failed to fetch your orders.' });
  }
});

// PUT /api/orders/manage/:orderId?phone=XXXXXXXXXX
app.put('/api/orders/manage/:orderId', publicLimiter, async (req, res) => {
  const { phone } = req.query;
  const { orderId } = req.params;
  
  if (!phone || !orderId) {
    return res.status(400).json({ error: 'Phone number and Order ID required' });
  }

  const queryPhone = phone.trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseDate = (dStr) => {
    const [day, month, year] = dStr.split('/');
    return new Date(year, month - 1, day);
  };

  if (USE_MOCK) {
    const order = MOCK_ORDERS.find(o => o.orderId === orderId && o.phone === queryPhone);
    if (!order) return res.status(404).json({ error: 'Order not found or unauthorized' });
    if (parseDate(order.date) <= today) {
      return res.status(400).json({ error: 'Cannot cancel orders for today or past dates' });
    }
    order.status = 'CANCELLED';
    return res.json({ success: true, message: 'Order cancelled successfully' });
  }

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const doc = await orderRef.get();
    
    if (!doc.exists) return res.status(404).json({ error: 'Order not found' });
    
    const orderData = doc.data();
    if (orderData.phone !== queryPhone) return res.status(403).json({ error: 'Unauthorized to cancel this order' });
    
    if (parseDate(orderData.date) <= today) {
      return res.status(400).json({ error: 'Cannot cancel orders for today or past dates' });
    }

    await orderRef.update({ status: 'CANCELLED' });
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling order:', err.message);
    res.status(500).json({ error: 'Failed to cancel order.' });
  }
});

// 🛡️ ADMIN & AUTH 🛡️─────────────────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  const auth = req.headers['x-admin-password'];
  if (!auth || auth !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.post('/api/admin/login', adminLimiter, (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/admin/orders', adminLimiter, requireAdmin, async (req, res) => {
  const { date, month } = req.query;
  // If neither is provided (like the frontend's auth ping), just return empty orders.
  if (!date && !month) return res.json({ success: true, orders: [] });

  if (USE_MOCK) {
    const filtered = MOCK_ORDERS.filter(o => o.date === date);
    return res.json({ success: true, orders: filtered });
  }

  try {
    let snapshot;
    if (date) {
      snapshot = await db.collection('orders').where('date', '==', date).get();
    } else if (month) {
      // Month format is MM/YYYY from frontend
      // Orders store date as DD/MM/YYYY
      // We can query by simply fetching all and filtering, or prefix matching if we change schema.
      // For now, if someone wants a month view, we'll fetch all and filter in memory to keep it simple.
      snapshot = await db.collection('orders').get();
    }
    let orders = snapshot.docs.map(doc => doc.data());
    
    if (month) {
      orders = orders.filter(o => o.date && o.date.substring(3) === month);
    }
    orders.sort((a, b) => {
      // Primary sort by deliveryPerson
      if (a.deliveryPerson !== b.deliveryPerson) {
        if (!a.deliveryPerson) return 1;
        if (!b.deliveryPerson) return -1;
        return a.deliveryPerson.localeCompare(b.deliveryPerson);
      }
      // Secondary sort by routeOrder
      const rA = typeof a.routeOrder === 'number' ? a.routeOrder : 9999;
      const rB = typeof b.routeOrder === 'number' ? b.routeOrder : 9999;
      return rA - rB;
    });

    res.json({ success: true, orders });
  } catch (err) {
    console.error('Error fetching admin orders:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.put('/api/admin/orders/delivery/batch', adminLimiter, requireAdmin, express.json(), async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates) || updates.length === 0) return res.status(400).json({ error: 'updates array required' });

  if (USE_MOCK) {
    updates.forEach(u => {
      const o = MOCK_ORDERS.find(ord => ord.orderId === u.orderId);
      if (o) {
        o.deliveryPerson = u.deliveryPerson;
        o.routeOrder = u.routeOrder;
        if (u.routeOrder === 'CANCELLED') {
          o.status = 'CANCELLED';
        }
      }
    });
    return res.json({ success: true });
  }

  try {
    const batch = db.batch();
    updates.forEach(u => {
      const orderRef = db.collection('orders').doc(u.orderId);
      let updateData = {
        deliveryPerson: u.deliveryPerson,
        routeOrder: u.routeOrder === 'CANCELLED' ? 9999 : parseInt(u.routeOrder, 10) || 9999
      };
      if (u.routeOrder === 'CANCELLED') {
        updateData.status = 'CANCELLED';
      }
      batch.update(orderRef, updateData);
    });

    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    console.error('Error batch updating delivery:', err.message);
    res.status(500).json({ error: 'Failed to update delivery details.' });
  }
});

app.put('/api/admin/menu', adminLimiter, requireAdmin, async (req, res) => {
  const { items, metadata } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  if (USE_MOCK) {
    MOCK_MENU = items.map(item => ({
      name:        String(item.name || '').trim(),
      description: String(item.description || '').trim(),
      price:       parseFloat(item.price) || 0,
      available:   item.available !== false,
      category:    String(item.category || 'Lunch').trim(),
    }));
    if (metadata) MOCK_METADATA = { ...metadata };
    return res.json({ success: true });
  }

  try {
    const batch = db.batch();
    
    // Clear old menu docs
    const menuSnap = await db.collection('menu').get();
    menuSnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add new menu docs
    items.forEach(item => {
      const docRef = db.collection('menu').doc();
      batch.set(docRef, {
        name:        String(item.name || '').trim(),
        description: String(item.description || '').trim(),
        price:       parseFloat(item.price) || 0,
        available:   item.available !== false,
        category:    String(item.category || 'Lunch').trim(),
      });
    });

    // Update metadata
    if (metadata) {
      const metaRef = db.collection('metadata').doc('global');
      batch.set(metaRef, metadata);
    }

    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving menu:', err.message);
    res.status(500).json({ error: 'Failed to save menu.' });
  }
});

function getRawComponents(items, metadata = { sweetAvailable: 'Yes', farsanAvailable: 'Yes' }) {
  const comp = { Roti: 0, Sabji: 0, Dal: 0, Rice: 0, Sweet: 0, Farsan: 0 };
  
  const sweetOn = metadata.sweetAvailable === 'Yes';
  const farsanOn = metadata.farsanAvailable === 'Yes';
  
  (items || []).forEach(item => {
    const n = (item.name || '').trim();
    const q = item.quantity || 0;
    
    if (n === 'Mini Lunch') {
      comp.Roti += 3 * q; comp.Sabji += 0.5 * q; comp.Dal += 0.5 * q; comp.Rice += 0.5 * q; 
      if (sweetOn) comp.Sweet += 1 * q; 
      if (farsanOn) comp.Farsan += 1 * q;
    } else if (n.toLowerCase().includes('brunch')) {
      comp.Roti += 6 * q; comp.Sabji += 1 * q; comp.Dal += 0.5 * q; comp.Rice += 0.5 * q; 
      if (sweetOn) comp.Sweet += 1 * q; 
      if (farsanOn) comp.Farsan += 1 * q;
    } else if (n.toLowerCase().includes('full lunch')) {
      comp.Roti += 6 * q; comp.Sabji += 1 * q; comp.Dal += 1 * q; comp.Rice += 1 * q; 
      if (sweetOn) comp.Sweet += 1 * q; 
      if (farsanOn) comp.Farsan += 1 * q;
    } else if (n === 'Family Meal') {
      comp.Roti += 9 * q; comp.Sabji += 1.5 * q; comp.Dal += 1.5 * q; comp.Rice += 1.5 * q; 
      if (sweetOn) comp.Sweet += 1 * q; 
      if (farsanOn) comp.Farsan += 1 * q;
    } else if (n.toLowerCase() === 'roti') {
      comp.Roti += 1 * q;
    } else if (n.toLowerCase().includes('sabji (half)')) {
      comp.Sabji += 0.5 * q;
    } else if (n.toLowerCase().includes('sabji (full)')) {
      comp.Sabji += 1 * q;
    } else if (n.toLowerCase().includes('dal (half)')) {
      comp.Dal += 0.5 * q;
    } else if (n.toLowerCase().includes('dal (full)')) {
      comp.Dal += 1 * q;
    } else if (n === 'Rice (Half)') {
      comp.Rice += 0.5 * q;
    } else if (n === 'Rice (Full)' || n === 'Rice') {
      comp.Rice += 1 * q;
    } else if (n.toLowerCase().includes('sweet')) {
      comp.Sweet += 1 * q;
    } else if (n.toLowerCase().includes('farsan')) {
      comp.Farsan += 1 * q;
    }
  });
  return comp;
}

app.get('/api/admin/kitchen', adminLimiter, requireAdmin, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date parameter required (DD/MM/YYYY)' });

  let orders = [];
  let metadata = MOCK_METADATA;

  if (USE_MOCK) {
    orders = MOCK_ORDERS.filter(o => o.date === date && o.status !== 'CANCELLED');
  } else {
    try {
      const snapshot = await db.collection('orders')
        .where('date', '==', date)
        .get();
      orders = snapshot.docs.map(doc => doc.data()).filter(o => o.status !== 'CANCELLED');
      
      const metaSnap = await db.collection('admin').doc('metadata').get();
      if (metaSnap.exists) {
        metadata = metaSnap.data();
      }
    } catch (err) {
      console.error('Error fetching kitchen summary:', err.message);
      return res.status(500).json({ error: 'Failed to fetch kitchen summary.' });
    }
  }

  const grandTotals = { Roti: 0, Sabji: 0, Dal: 0, Rice: 0, Sweet: 0, Farsan: 0 };
  const kitchenOrders = [];
  
  const choviarGrandTotals = {};
  const choviarKitchenOrders = [];

  const packetSummary = {
    Dal: { Half: 0, Full: 0 },
    Rice: { Half: 0, Full: 0 },
    Sabji: { Half: 0, Full: 0 },
    Roti: {}
  };
  const outsideOrders = [];

  orders.forEach(order => {
    if (order.zone === 'outside' && order.status !== 'CANCELLED') {
      outsideOrders.push({
        name: order.name,
        locality: order.locality || '',
        itemsSummary: order.itemsSummary || ''
      });
    }

    const lunchItems = (order.items || []).filter(i => i.category !== 'Choviar');
    const choviarItems = (order.items || []).filter(i => i.category === 'Choviar');

    if (lunchItems.length > 0) {
      const comp = getRawComponents(lunchItems, metadata);
      grandTotals.Roti += comp.Roti;
      grandTotals.Sabji += comp.Sabji;
      grandTotals.Dal += comp.Dal;
      grandTotals.Rice += comp.Rice;
      grandTotals.Sweet += comp.Sweet;
      grandTotals.Farsan += comp.Farsan;

      kitchenOrders.push({
        orderId: order.orderId,
        name: order.name,
        deliveryPerson: order.deliveryPerson,
        routeOrder: order.routeOrder,
        zone: order.zone || 'borivali',
        locality: order.locality || '',
        ...comp
      });
      
      lunchItems.forEach(item => {
        const n = (item.name || '').trim();
        const q = item.quantity || 0;
        if (q <= 0) return;

        if (n === 'Mini Lunch') {
          packetSummary.Roti['3'] = (packetSummary.Roti['3'] || 0) + q;
          packetSummary.Dal.Half += q; packetSummary.Rice.Half += q; packetSummary.Sabji.Half += q;
        } else if (n.toLowerCase().includes('brunch')) {
          packetSummary.Roti['6'] = (packetSummary.Roti['6'] || 0) + q;
          packetSummary.Dal.Half += q; packetSummary.Rice.Half += q; packetSummary.Sabji.Full += q;
        } else if (n.toLowerCase().includes('full lunch')) {
          packetSummary.Roti['6'] = (packetSummary.Roti['6'] || 0) + q;
          packetSummary.Dal.Full += q; packetSummary.Rice.Full += q; packetSummary.Sabji.Full += q;
        } else if (n === 'Family Meal') {
          packetSummary.Roti['9'] = (packetSummary.Roti['9'] || 0) + q;
          packetSummary.Dal.Full += q; packetSummary.Dal.Half += q;
          packetSummary.Rice.Full += q; packetSummary.Rice.Half += q;
          packetSummary.Sabji.Full += q; packetSummary.Sabji.Half += q;
        } else if (n.toLowerCase() === 'roti') {
          packetSummary.Roti[q] = (packetSummary.Roti[q] || 0) + 1;
        } else if (n.startsWith('Sabji')) {
          if (n.includes('(Half)')) packetSummary.Sabji.Half += q;
          else packetSummary.Sabji.Full += q;
        } else if (n.startsWith('Dal')) {
          if (n.includes('(Half)')) packetSummary.Dal.Half += q;
          else packetSummary.Dal.Full += q;
        } else if (n.startsWith('Rice')) {
          if (n.includes('(Half)')) packetSummary.Rice.Half += q;
          else packetSummary.Rice.Full += q;
        }
      });
    }

    if (choviarItems.length > 0) {
      const comp = {};
      choviarItems.forEach(item => {
        const n = (item.name || '').trim();
        const q = item.quantity || 0;
        if (q <= 0) return;
        
        comp[n] = (comp[n] || 0) + q;
        choviarGrandTotals[n] = (choviarGrandTotals[n] || 0) + q;
      });

      choviarKitchenOrders.push({
        orderId: order.orderId,
        name: order.name,
        deliveryPerson: order.deliveryPerson,
        routeOrder: order.routeOrder,
        zone: order.zone || 'borivali',
        locality: order.locality || '',
        ...comp
      });
    }
  });

  kitchenOrders.sort((a, b) => a.routeOrder - b.routeOrder);
  choviarKitchenOrders.sort((a, b) => a.routeOrder - b.routeOrder);

  res.json({ 
    date, 
    orderCount: kitchenOrders.length, 
    grandTotals, 
    kitchenOrders, 
    packetSummary, 
    outsideOrders,
    choviarOrderCount: choviarKitchenOrders.length,
    choviarGrandTotals,
    choviarKitchenOrders
  });
});

// ─── Delivery Portal ─────────────────────────────────────────────────────────
const translationCache = new Map();
async function translateToHindi(text) {
  if (!text) return '';
  if (translationCache.has(text)) return translationCache.get(text);
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();
    let translated = '';
    if (data && data[0]) {
      data[0].forEach(part => {
        if (part[0]) translated += part[0];
      });
    }
    translationCache.set(text, translated);
    return translated;
  } catch (err) {
    console.error('Translation error:', err.message);
    return text;
  }
}

app.get('/api/delivery/orders', publicLimiter, async (req, res) => {
  try {
    const now = new Date();
    const today = formatDate(now);
    
    if (USE_MOCK) {
       return res.json({ success: true, orders: [] });
    }

    const snapshot = await db.collection('orders')
      .where('date', '==', today)
      .get();
      
    const rows = snapshot.docs.map(doc => doc.data()).filter(o => o.status !== 'CANCELLED');
    const orders = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const deliveryPerson = row.deliveryPerson || '';
      
      if (deliveryPerson.trim().length > 0) {
        const nameHi = await translateToHindi(row.name);
        const addressHi = await translateToHindi(row.address);
        
        orders.push({
          orderId: row.orderId, // UUID instead of rowIndex
          name: nameHi,
          phone: row.phone || '',
          address: addressHi,
          amount: row.grandTotal || '0',
          deliveryPerson: deliveryPerson,
          routeOrder: typeof row.routeOrder === 'number' ? row.routeOrder : 9999,
          paymentReceived: !!row.paymentReceived,
          paymentMethod: row.paymentMethod || 'Cash',
          amountReceived: row.amountReceived || ''
        });
      }
    }
    
    orders.sort((a, b) => a.routeOrder - b.routeOrder);
    res.json({ success: true, orders });
  } catch (err) {
    console.error('Error fetching delivery orders:', err.message);
    res.status(500).json({ error: 'Failed to fetch delivery orders' });
  }
});

app.put('/api/delivery/orders/payment', publicLimiter, express.json(), async (req, res) => {
  // Using orderId instead of rowIndex for lookup now!
  // Note: We're accepting rowIndex param for backward compatibility with frontend until frontend updates
  // BUT the frontend actually sends orderId along with payment fields. Let's rely on it.
  const { orderId, paymentReceived, paymentMethod, amountReceived } = req.body;
  
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  try {
    if (!USE_MOCK) {
      const orderRef = db.collection('orders').doc(orderId);
      await orderRef.update({
        paymentReceived: !!paymentReceived,
        paymentMethod: paymentMethod || 'Cash',
        amountReceived: amountReceived !== undefined ? String(amountReceived) : ''
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating payment:', err.message);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// ─── Serve React in production ────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const staticLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
  const buildPath = path.join(__dirname, 'client', 'build');

  // Cache static assets (JS, CSS, images) which have hashes for 1 year
  app.use('/static', express.static(path.join(buildPath, 'static'), { maxAge: '1y', immutable: true }));
  
  // Serve other files like manifest, favicon with a short cache
  // Intercept index.html to apply strict no-cache headers
  app.use(express.static(buildPath, { 
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.set({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
      }
    }
  }));

  // Client-side routing catch-all
  app.get('*', staticLimiter, (req, res) => {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\nJTS Tiffin App server running on port ${PORT} [mock=${USE_MOCK}]`);
    if (USE_MOCK) {
      console.log('Using mock data - no Firestore connection required.');
    }
    if (BORIVALI_PINCODES.size > 0) {
      console.log(`Borivali pincodes: ${[...BORIVALI_PINCODES].join(', ')}`);
    } else {
      console.log('No Borivali pincodes configured – all orders treated as Borivali (no surcharge).');
    }
  });
}

module.exports = app;
if (USE_MOCK) {
  module.exports.MOCK_ORDERS = MOCK_ORDERS;
}

app.get('/debug-mock', (req,res) => res.json(MOCK_ORDERS));
