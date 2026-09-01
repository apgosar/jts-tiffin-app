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
if (!USE_MOCK && !process.env.FIREBASE_CREDENTIALS_PATH && process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
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
// Disable rate limiting in test mode to prevent 429s from rapid test calls
const noopMiddleware = (_req, _res, next) => next();
const orderLimiter    = process.env.NODE_ENV === 'test' ? noopMiddleware : rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false });
const adminLimiter    = process.env.NODE_ENV === 'test' ? noopMiddleware : rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const publicLimiter   = process.env.NODE_ENV === 'test' ? noopMiddleware : rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const lookupLimiter   = process.env.NODE_ENV === 'test' ? noopMiddleware : rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  standardHeaders: true, legacyHeaders: false }); // phone lookup: 10/15min

// ─── Mock data ────────────────────────────────────────────────────────────────
let MOCK_MENU = [
  { name: 'Mini Lunch',  description: '3 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 140, available: true, category: 'Lunch' },
  { name: 'Brunch',      description: '6 Roti, Sabji, 1/2 Dal, 1/2 Rice, Salad / Sweet / Namkeen / Farsan', price: 180, available: true, category: 'Lunch' },
  { name: 'Full Lunch',  description: '6 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 220, available: true, category: 'Lunch' },
  { name: 'Family Meal', description: '9 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 320, available: true, category: 'Lunch' },
  { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160, available: true, category: 'Choviar', qty: 4 },
];
let MOCK_METADATA = { 
  sabji: 'Bhindi', sweet: 'Aamras', dal: 'Gujarati Dal', farsan: 'Dhokla', 
  betaTesting: 'Yes',
  breadType: 'Roti',
  lunchCutoff: '05:00',
  choviarCutoff: '11:00',
  tiffinMatrix: {
    "Mini Lunch": { Roti: 3, Paratha: 3, Puri: 3, Namkeen: 1, Salad: 1, Farsan: 1, Sweet: 1 },
    "Brunch": { Roti: 6, Paratha: 4, Puri: 6, Namkeen: 1, Salad: 1, Farsan: 1, Sweet: 1 },
    "Full Lunch": { Roti: 6, Paratha: 4, Puri: 6, Namkeen: 1, Salad: 1, Farsan: 1, Sweet: 1 },
    "Family Meal": { Roti: 9, Paratha: 6, Puri: 9, Namkeen: 2, Salad: 2, Farsan: 2, Sweet: 2 }
  }
};

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

function computeServerPrice(itemObj, menuItems, metadata) {
  const itemName = itemObj.name || '';
  const clientCategory = itemObj.category;

  if (clientCategory === 'Choviar') {
    if (itemName === 'Full Choviar' || itemName === 'Choviar' || itemName === 'Choviar Special') {
      const choviarItems = (menuItems || []).filter(m => m.category === 'Choviar' && m.name !== 'Full Choviar' && m.name !== 'Choviar' && m.name !== 'Choviar Special');
      if (choviarItems.length > 0) {
        const exactPrice = choviarItems.reduce((sum, item) => {
          const qty = Number(item.qty) || 1;
          const rate = Number(item.price) || 0;
          return sum + (qty * rate);
        }, 0);
        const price = Math.round(exactPrice / 5) * 5;
        return { price, category: 'Choviar' };
      }
      return { price: 150, category: 'Choviar' };
    }

    const chItem = menuItems.find(m => m.category === 'Choviar' && m.name === itemName);
    if (chItem) return { price: chItem.price, category: 'Choviar' };
  }

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

  // Regular menu item (Lunch / Choviar fallback)
  const item = menuItems.find(m => m.name === itemName);
  if (item) return { price: item.price, category: item.category || 'Lunch' };

  if (itemName === 'Full Choviar' || itemName === 'Choviar' || itemName === 'Choviar Special' || itemName === 'Family Choviar') {
    const choviarItems = (menuItems || []).filter(m => m.category === 'Choviar' && m.name !== 'Full Choviar' && m.name !== 'Choviar' && m.name !== 'Choviar Special' && m.name !== 'Family Choviar');
    if (choviarItems.length > 0) {
      const exactPrice = choviarItems.reduce((sum, item) => {
        const qty = Number(item.qty) || 1;
        const rate = Number(item.price) || 0;
        return sum + (qty * rate);
      }, 0);
      if (itemName === 'Family Choviar') {
        const price = Math.round((exactPrice * 1.5) / 5) * 5;
        return { price, category: 'Choviar' };
      } else {
        const price = Math.round(exactPrice / 5) * 5;
        return { price, category: 'Choviar' };
      }
    }
    return { price: itemName === 'Family Choviar' ? 225 : 150, category: 'Choviar' }; // Fallback
  }
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
  const MAX_ITEM_TYPES   = 50;
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
    const serverData = computeServerPrice(item, menuItems, metadata);
    if (!serverData) {
      return res.status(400).json({ error: `Unknown or invalid item: "${item.name}"` });
    }
    validatedItems.push({ name: item.name, price: serverData.price, quantity: parseInt(item.quantity, 10), category: serverData.category });
  }

  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + (3600000 * 5.5));
  const istHour = istTime.getHours();

  const betaTesting = metadata.betaTesting === 'Yes';
  const lunchCutoff = parseInt(metadata.lunchCutoff?.split(':')[0] || '5', 10);
  const choviarCutoff = parseInt(metadata.choviarCutoff?.split(':')[0] || '11', 10);

  // Determine target date (delivery date)
  const deliveryTime = new Date(istTime);
  // Default rollover logic (to be replaced by liveMenuDate if needed, but for now stick to 19:00 rollover)
  if (istHour >= 19) {
    deliveryTime.setDate(deliveryTime.getDate() + 1);
  }
  deliveryTime.setHours(0, 0, 0, 0);
  
  if (!betaTesting) {
    const hasLunch = validatedItems.some(i => i.category !== 'Choviar');
    const hasChoviar = validatedItems.some(i => i.category === 'Choviar');

    if (hasLunch && metadata.lunchClosed === 'Yes') {
      return res.status(400).json({ error: 'Lunch orders are closed for tomorrow.' });
    }
    if (hasChoviar && metadata.choviarClosed === 'Yes') {
      return res.status(400).json({ error: 'Choviar orders are closed for tomorrow.' });
    }

    if (hasLunch) {
      const lunchCutoffHr = parseInt(metadata.lunchCutoff?.split(':')[0] || '5', 10);
      const lunchCutoffDay = metadata.lunchCutoffDay || 'Same Day';
      const lunchCutoffTime = new Date(deliveryTime);
      if (lunchCutoffDay === 'Previous Day') {
        lunchCutoffTime.setDate(lunchCutoffTime.getDate() - 1);
      }
      lunchCutoffTime.setHours(lunchCutoffHr, 0, 0, 0);

      if (istTime >= lunchCutoffTime) {
        return res.status(400).json({ error: `Lunch order cutoff (${lunchCutoffHr}:00 ${lunchCutoffDay === 'Previous Day' ? 'Yesterday' : 'Today'}) has passed for the selected delivery day.` });
      }
    }

    if (hasChoviar) {
      const choviarCutoffHr = parseInt(metadata.choviarCutoff?.split(':')[0] || '11', 10);
      const choviarCutoffDay = metadata.choviarCutoffDay || 'Same Day';
      const choviarCutoffTime = new Date(deliveryTime);
      if (choviarCutoffDay === 'Previous Day') {
        choviarCutoffTime.setDate(choviarCutoffTime.getDate() - 1);
      }
      choviarCutoffTime.setHours(choviarCutoffHr, 0, 0, 0);

      if (istTime >= choviarCutoffTime) {
        return res.status(400).json({ error: `Choviar order cutoff (${choviarCutoffHr}:00 ${choviarCutoffDay === 'Previous Day' ? 'Yesterday' : 'Today'}) has passed for the selected delivery day.` });
      }
    }
  }

  const zone = getZone(customer.pincode.trim());
  const subtotal = validatedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  
  const baseOrderId  = uuidv4().slice(0, 8).toUpperCase();
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
    const hasLunchMeal = lunchItems.some(i => ['Mini Lunch', 'Brunch', 'Full Lunch', 'Family Meal'].includes(i.name));
    const hasFullChoviar = choviarItems.some(i => ['Choviar Special', 'Full Choviar', 'Choviar', 'Family Choviar'].includes(i.name));
    
    if (lunchItems.length > 0 && !hasLunchMeal && lunchSubtotal < 250) lunchSurcharge = 30;
    if (choviarItems.length > 0 && !hasFullChoviar && choviarSubtotal < 250) choviarSurcharge = 30;
  }

  const exactLunchTotal = lunchItems.length > 0 ? lunchSubtotal + lunchSurcharge : 0;
  const exactChoviarTotal = choviarItems.length > 0 ? choviarSubtotal + choviarSurcharge : 0;

  const roundedLunchTotal = Math.round(exactLunchTotal / 5) * 5;
  const roundedChoviarTotal = Math.round(exactChoviarTotal / 5) * 5;

  const lunchRoundOff = roundedLunchTotal - exactLunchTotal;
  const choviarRoundOff = roundedChoviarTotal - exactChoviarTotal;

  const totalSurcharge = lunchSurcharge + choviarSurcharge;
  const grandTotalRounded = roundedLunchTotal + roundedChoviarTotal;

  const subOrders = [];
  
  if (lunchItems.length > 0) {
    subOrders.push({
      orderId: choviarItems.length > 0 ? `${baseOrderId}-L` : baseOrderId,
      items: lunchItems,
      subtotal: lunchSubtotal,
      surchargeTotal: lunchSurcharge,
      roundOffAmount: lunchRoundOff,
      grandTotal: roundedLunchTotal,
      category: 'Lunch'
    });
  }

  if (choviarItems.length > 0) {
    subOrders.push({
      orderId: lunchItems.length > 0 ? `${baseOrderId}-C` : baseOrderId,
      items: choviarItems,
      subtotal: choviarSubtotal,
      surchargeTotal: choviarSurcharge,
      roundOffAmount: choviarRoundOff,
      grandTotal: roundedChoviarTotal,
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
    instructions: (customer.instructions || '').trim(),
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

    return res.json({ success: true, orderId: baseOrderId, zone, surchargeTotal: totalSurcharge, grandTotal: grandTotalRounded, date });
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
        status: 'ACTIVE',
        category: sub.category
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
      grandTotal: grandTotalRounded,
      date
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
  if (!/^\d{6}$/.test(customer.pincode.trim())) {
    return res.status(400).json({ error: 'Invalid PINCODE' });
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
    const serverData = computeServerPrice(item, menuItems, metadata);
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
    const hasLunchMeal = lunchItems.some(i => ['Mini Lunch', 'Brunch', 'Full Lunch', 'Family Meal'].includes(i.name));
    const hasFullChoviar = choviarItems.some(i => ['Choviar Special', 'Full Choviar', 'Choviar', 'Family Choviar'].includes(i.name));
    
    if (lunchItems.length > 0 && !hasLunchMeal && lunchSubtotal < 250) lunchSurcharge = 30;
    if (choviarItems.length > 0 && !hasFullChoviar && choviarSubtotal < 250) choviarSurcharge = 30;
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
    instructions: (customer.instructions || '').trim(),
  };

  if (USE_MOCK) return res.json({ success: true, count: deliveryDates.length });

  try {
    const batch = db.batch();

    for (const d of deliveryDates) {
      const dateStr = typeof d === 'string' ? d : d.dateStr;
      
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istTime = new Date(utc + (3600000 * 5.5));
      istTime.setDate(istTime.getDate() + 1);
      const tomorrowStr = `${String(istTime.getDate()).padStart(2, '0')}/${String(istTime.getMonth() + 1).padStart(2, '0')}/${istTime.getFullYear()}`;
      
      let skipLunch = typeof d === 'object' ? d.skipLunch : false;
      let skipChoviar = typeof d === 'object' ? d.skipChoviar : false;

      if (dateStr === tomorrowStr) {
        if (metadata.lunchClosed === 'Yes') skipLunch = true;
        if (metadata.choviarClosed === 'Yes') skipChoviar = true;
      }

      const baseOrderId = uuidv4().slice(0, 8).toUpperCase();
      let roundOffApplied = false;

      if (lunchItems.length > 0 && !skipLunch) {
        const isFirst = !roundOffApplied;
        roundOffApplied = true;
        const subId = (choviarItems.length > 0 && !skipChoviar) ? `${baseOrderId}-L` : baseOrderId;
        batch.set(db.collection('orders').doc(subId), {
          orderId: subId, date: dateStr, time: '12:00', createdAt: FieldValue.serverTimestamp(),
          isRecurring: true,
          ...customerRecord, zone, items: lunchItems,
          itemsSummary: lunchItems.map(i => `${i.name}×${i.quantity}`).join(', '),
          surchargeTotal: lunchSurcharge, grandTotal: lunchSubtotal + lunchSurcharge + (isFirst ? roundOffAmount : 0),
          deliveryPerson: '', routeOrder: 9999, paymentReceived: false, paymentMethod: 'Cash', amountReceived: '', status: 'ACTIVE', category: 'Lunch'
        });
      }

      if (choviarItems.length > 0 && !skipChoviar) {
        const isFirst = !roundOffApplied;
        roundOffApplied = true;
        const subId = (lunchItems.length > 0 && !skipLunch) ? `${baseOrderId}-C` : baseOrderId;
        batch.set(db.collection('orders').doc(subId), {
          orderId: subId, date: dateStr, time: '12:00', createdAt: FieldValue.serverTimestamp(),
          isRecurring: true,
          ...customerRecord, zone, items: choviarItems,
          itemsSummary: choviarItems.map(i => `${i.name}×${i.quantity}`).join(', '),
          surchargeTotal: choviarSurcharge, grandTotal: choviarSubtotal + choviarSurcharge + (isFirst ? roundOffAmount : 0),
          deliveryPerson: '', routeOrder: 9999, paymentReceived: false, paymentMethod: 'Cash', amountReceived: '', status: 'ACTIVE', category: 'Choviar'
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

  // Helper to parse DD/MM/YYYY to a local midnight Date obj
  const parseDate = (dStr) => {
    const [day, month, year] = dStr.split('/');
    return new Date(year, month - 1, day);
  };

  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + (3600000 * 5.5));
  const istHour = istTime.getHours();
  const istTodayStr = `${String(istTime.getDate()).padStart(2, '0')}/${String(istTime.getMonth() + 1).padStart(2, '0')}/${istTime.getFullYear()}`;
  const todayDateObj = parseDate(istTodayStr);

  let metadata = MOCK_METADATA;

  if (USE_MOCK) {
    const orders = MOCK_ORDERS.filter(o => o.phone === queryPhone && o.status !== 'CANCELLED');
    const mappedOrders = [];
    
    const lunchCutoff = parseInt(metadata.lunchCutoff?.split(':')[0] || '5', 10);
    const choviarCutoff = parseInt(metadata.choviarCutoff?.split(':')[0] || '11', 10);
    const betaTesting = metadata.betaTesting === 'Yes';

    for (const o of orders) {
      const oDate = parseDate(o.date);
      if (oDate > todayDateObj) {
        mappedOrders.push({ ...o, id: o.orderId, canCancel: true, canEdit: true });
      } else if (oDate.getTime() === todayDateObj.getTime()) {
        let canModify = betaTesting;
        if (!betaTesting) {
          if (o.category === 'Lunch' && istHour < lunchCutoff) canModify = true;
          if (o.category === 'Choviar' && istHour < choviarCutoff) canModify = true;
        }
        mappedOrders.push({ ...o, id: o.orderId, canCancel: canModify, canEdit: canModify });
      }
    }
    return res.json({ success: true, orders: mappedOrders.sort((a, b) => parseDate(a.date) - parseDate(b.date)) });
  }

  try {
    const metaSnap = await db.collection('admin').doc('metadata').get();
    if (metaSnap.exists) metadata = metaSnap.data();
    
    const lunchCutoff = parseInt(metadata.lunchCutoff?.split(':')[0] || '5', 10);
    const choviarCutoff = parseInt(metadata.choviarCutoff?.split(':')[0] || '11', 10);
    const betaTesting = metadata.betaTesting === 'Yes';

    const snapshot = await db.collection('orders')
      .where('phone', '==', queryPhone)
      .get();
      
    const allOrders = snapshot.docs.map(doc => doc.data()).filter(o => o.status !== 'CANCELLED');
    const mappedOrders = [];
    
    for (const o of allOrders) {
      const oDate = parseDate(o.date);
      if (oDate > todayDateObj) {
        mappedOrders.push({ ...o, id: o.orderId, canCancel: true, canEdit: true });
      } else if (oDate.getTime() === todayDateObj.getTime()) {
        let canModify = betaTesting;
        if (!betaTesting) {
          if (o.category === 'Lunch' && istHour < lunchCutoff) canModify = true;
          if (o.category === 'Choviar' && istHour < choviarCutoff) canModify = true;
        }
        mappedOrders.push({ ...o, id: o.orderId, canCancel: canModify, canEdit: canModify });
      }
    }
    
    mappedOrders.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    res.json({ success: true, orders: mappedOrders });
  } catch (err) {
    console.error('Error fetching customer orders:', err.message);
    res.status(500).json({ error: 'Failed to fetch your orders.' });
  }
});

// DELETE /api/orders/manage/:orderId?phone=XXXXXXXXXX
app.delete('/api/orders/manage/:orderId', publicLimiter, async (req, res) => {
  const { phone } = req.query;
  const { orderId } = req.params;
  
  if (!phone || !orderId) {
    return res.status(400).json({ error: 'Phone number and Order ID required' });
  }

  const queryPhone = phone.trim();
  
  const parseDate = (dStr) => {
    const [day, month, year] = dStr.split('/');
    return new Date(year, month - 1, day);
  };

  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + (3600000 * 5.5));
  const istHour = istTime.getHours();
  const istTodayStr = `${String(istTime.getDate()).padStart(2, '0')}/${String(istTime.getMonth() + 1).padStart(2, '0')}/${istTime.getFullYear()}`;
  const todayDateObj = parseDate(istTodayStr);

  let metadata = MOCK_METADATA;

  if (USE_MOCK) {
    const order = MOCK_ORDERS.find(o => o.orderId === orderId && o.phone === queryPhone);
    if (!order) return res.status(404).json({ error: 'Order not found or unauthorized' });
    
    const lunchCutoff = parseInt(metadata.lunchCutoff?.split(':')[0] || '5', 10);
    const choviarCutoff = parseInt(metadata.choviarCutoff?.split(':')[0] || '11', 10);
    const betaTesting = metadata.betaTesting === 'Yes';

    const oDate = parseDate(order.date);
    if (oDate < todayDateObj) return res.status(400).json({ error: 'Cannot cancel past orders' });
    if (oDate.getTime() === todayDateObj.getTime() && !betaTesting) {
      if (order.category === 'Lunch' && istHour >= lunchCutoff) return res.status(400).json({ error: `Lunch order cutoff (${lunchCutoff} AM) has passed for today` });
      if (order.category === 'Choviar' && istHour >= choviarCutoff) return res.status(400).json({ error: `Choviar order cutoff (${choviarCutoff} AM) has passed for today` });
    }
    
    order.status = 'CANCELLED';
    return res.json({ success: true, message: 'Order cancelled successfully' });
  }

  try {
    const metaSnap = await db.collection('admin').doc('metadata').get();
    if (metaSnap.exists) metadata = metaSnap.data();

    const lunchCutoff = parseInt(metadata.lunchCutoff?.split(':')[0] || '5', 10);
    const choviarCutoff = parseInt(metadata.choviarCutoff?.split(':')[0] || '11', 10);
    const betaTesting = metadata.betaTesting === 'Yes';

    const orderRef = db.collection('orders').doc(orderId);
    const doc = await orderRef.get();
    
    if (!doc.exists) return res.status(404).json({ error: 'Order not found' });
    
    const orderData = doc.data();
    if (orderData.phone !== queryPhone) return res.status(403).json({ error: 'Unauthorized to cancel this order' });
    
    const oDate = parseDate(orderData.date);
    if (oDate < todayDateObj) return res.status(400).json({ error: 'Cannot cancel past orders' });
    if (oDate.getTime() === todayDateObj.getTime() && !betaTesting) {
      if (orderData.category === 'Lunch' && istHour >= lunchCutoff) return res.status(400).json({ error: `Lunch order cutoff (${lunchCutoff} AM) has passed for today` });
      if (orderData.category === 'Choviar' && istHour >= choviarCutoff) return res.status(400).json({ error: `Choviar order cutoff (${choviarCutoff} AM) has passed for today` });
    }

    await orderRef.update({ status: 'CANCELLED' });
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling order:', err.message);
    res.status(500).json({ error: 'Failed to cancel order.' });
  }
});

// PUT /api/orders/manage/:orderId?phone=XXXXXXXXXX
app.put('/api/orders/manage/:orderId', orderLimiter, async (req, res) => {
  const { phone } = req.query;
  const { orderId } = req.params;
  const { customer, items } = req.body;
  
  if (!phone || !orderId || !customer || !items) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const queryPhone = phone.trim();

  // Validate items
  const MAX_QTY_PER_ITEM = 20;
  const MAX_ROTI_QTY = 200;
  const MAX_ITEM_TYPES = 50;
  if (items.length > MAX_ITEM_TYPES) return res.status(400).json({ error: 'Too many items' });
  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    const limit = item.name === 'Roti' ? MAX_ROTI_QTY : MAX_QTY_PER_ITEM;
    if (!qty || qty < 1 || qty > limit) return res.status(400).json({ error: `Invalid quantity for ${item.name}` });
  }

  try {
    let orderRef;
    let orderData;
    
    if (USE_MOCK) {
      orderData = MOCK_ORDERS.find(o => o.orderId === orderId && o.phone === queryPhone);
    } else {
      orderRef = db.collection('orders').doc(orderId);
      const doc = await orderRef.get();
      if (doc.exists) orderData = doc.data();
    }
    
    if (!orderData) return res.status(404).json({ error: 'Order not found' });
    if (orderData.phone !== queryPhone) return res.status(403).json({ error: 'Unauthorized to edit this order' });
    
    const parseDate = (dStr) => {
      const [day, month, year] = dStr.split('/');
      return new Date(year, month - 1, day);
    };
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utc + (3600000 * 5.5));
    const istHour = istTime.getHours();
    const istTodayStr = `${String(istTime.getDate()).padStart(2, '0')}/${String(istTime.getMonth() + 1).padStart(2, '0')}/${istTime.getFullYear()}`;
    const todayDateObj = parseDate(istTodayStr);
    const oDate = parseDate(orderData.date);
    
    const result = await getMenuForPricing();
    const menuItems = result.menuItems;
    const metadata = result.metadata;
    
    const lunchCutoffHr = parseInt(metadata.lunchCutoff?.split(':')[0] || '5', 10);
    const lunchCutoffDay = metadata.lunchCutoffDay || 'Same Day';
    const choviarCutoffHr = parseInt(metadata.choviarCutoff?.split(':')[0] || '11', 10);
    const choviarCutoffDay = metadata.choviarCutoffDay || 'Same Day';
    const betaTesting = metadata.betaTesting === 'Yes';

    if (oDate < todayDateObj) return res.status(400).json({ error: 'Cannot edit past orders' });

    if (!betaTesting) {
      const deliveryTime = new Date(oDate);
      deliveryTime.setHours(0, 0, 0, 0);

      if (orderData.category === 'Lunch') {
        const lunchCutoffTime = new Date(deliveryTime);
        if (lunchCutoffDay === 'Previous Day') lunchCutoffTime.setDate(lunchCutoffTime.getDate() - 1);
        lunchCutoffTime.setHours(lunchCutoffHr, 0, 0, 0);

        if (istTime >= lunchCutoffTime) {
          return res.status(400).json({ error: `Lunch order cutoff (${lunchCutoffHr}:00 ${lunchCutoffDay === 'Previous Day' ? 'Yesterday' : 'Today'}) has passed for this order's delivery day` });
        }
      }

      if (orderData.category === 'Choviar') {
        const choviarCutoffTime = new Date(deliveryTime);
        if (choviarCutoffDay === 'Previous Day') choviarCutoffTime.setDate(choviarCutoffTime.getDate() - 1);
        choviarCutoffTime.setHours(choviarCutoffHr, 0, 0, 0);

        if (istTime >= choviarCutoffTime) {
          return res.status(400).json({ error: `Choviar order cutoff (${choviarCutoffHr}:00 ${choviarCutoffDay === 'Previous Day' ? 'Yesterday' : 'Today'}) has passed for this order's delivery day` });
        }
      }
    }
    
    const validatedItems = [];
    for (const item of items) {
      const serverData = computeServerPrice(item, menuItems, metadata);
      if (!serverData) return res.status(400).json({ error: `Unknown item: "${item.name}"` });
      
      if (serverData.category === 'Choviar' && orderData.category === 'Lunch') {
        return res.status(400).json({ error: 'Cannot add Choviar items to a Lunch order edit' });
      }
      if (serverData.category === 'Lunch' && orderData.category === 'Choviar') {
        return res.status(400).json({ error: 'Cannot add Lunch items to a Choviar order edit' });
      }
      
      validatedItems.push({ name: item.name, price: serverData.price, quantity: parseInt(item.quantity, 10), category: serverData.category });
    }

    if (validatedItems.length === 0) return res.status(400).json({ error: 'No valid items provided' });

    const zone = getZone(customer.pincode.trim());
    const subtotal = validatedItems.reduce((s, i) => s + i.price * i.quantity, 0);
    
    let surcharge = 0;
    if (zone === 'outside') {
      let tiffins = validatedItems.filter(i => i.name.includes('Lunch') || i.name.includes('Meal') || i.name.includes('Brunch') || i.name.includes('Choviar')).reduce((s, i) => s + i.quantity, 0);
      if (tiffins === 0) tiffins = 1;
      surcharge = 40 * tiffins;
    } else if (zone === 'borivali') {
      const hasMeal = validatedItems.some(i => ['Mini Lunch', 'Brunch', 'Full Lunch', 'Family Meal', 'Choviar Special', 'Full Choviar', 'Choviar', 'Family Choviar'].includes(i.name));
      if (!hasMeal && subtotal < 250) {
        surcharge = 30;
      }
    }

    const exactTotal = subtotal + surcharge;
    const grandTotalRounded = Math.round(exactTotal / 5) * 5;
    
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
      lastOrderDate: orderData.date,
      instructions: (customer.instructions || '').trim(),
    };

    const updatedData = {
      ...customerRecord,
      zone,
      items: validatedItems,
      itemsSummary: validatedItems.map(i => `${i.name}×${i.quantity}`).join(', '),
      surchargeTotal: surcharge,
      grandTotal: grandTotalRounded,
    };

    if (USE_MOCK) {
      Object.assign(orderData, updatedData);
    } else {
      await orderRef.update(updatedData);
    }
    
    res.json({ success: true, message: 'Order updated successfully', orderId, zone, surchargeTotal: surcharge, grandTotal: grandTotalRounded, date: orderData.date });
  } catch (err) {
    console.error('Error updating order:', err.message);
    res.status(500).json({ error: 'Failed to update order.' });
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
    let orders = snapshot.docs.map(doc => {
      let data = doc.data();
      if (data.createdAt && data.createdAt.toDate) {
        try {
          data.createdAtStr = data.createdAt.toDate().toLocaleString('en-IN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
          }).toUpperCase();
        } catch(e) {}
      }
      return data;
    });
    
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
      qty:         item.qty ? parseInt(item.qty, 10) : null,
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
      const docData = {
        name:        String(item.name || '').trim(),
        description: String(item.description || '').trim(),
        price:       parseFloat(item.price) || 0,
        available:   item.available !== false,
        category:    String(item.category || 'Lunch').trim(),
      };
      // Only persist qty when it is a positive integer (Choviar qty-per-order)
      if (item.qty && parseInt(item.qty, 10) > 0) {
        docData.qty = parseInt(item.qty, 10);
      }
      batch.set(docRef, docData);
    });

    // Update metadata
    if (metadata) {
      const metaRef = db.collection('metadata').doc('global');
      batch.set(metaRef, metadata);

      if (metadata.lunchClosed === 'Yes' || metadata.choviarClosed === 'Yes') {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const istTime = new Date(utc + (3600000 * 5.5));
        istTime.setDate(istTime.getDate() + 1);
        const tomorrowStr = `${String(istTime.getDate()).padStart(2, '0')}/${String(istTime.getMonth() + 1).padStart(2, '0')}/${istTime.getFullYear()}`;

        const ordersSnap = await db.collection('orders')
          .where('date', '==', tomorrowStr)
          .where('status', '==', 'ACTIVE')
          .get();
          
        ordersSnap.forEach(doc => {
          const order = doc.data();
          if (metadata.lunchClosed === 'Yes' && order.category === 'Lunch') {
             batch.update(doc.ref, { status: 'CANCELLED', cancelledAt: FieldValue.serverTimestamp(), cancelReason: 'Lunch Closed by Admin' });
          }
          if (metadata.choviarClosed === 'Yes' && order.category === 'Choviar') {
             batch.update(doc.ref, { status: 'CANCELLED', cancelledAt: FieldValue.serverTimestamp(), cancelReason: 'Choviar Closed by Admin' });
          }
        });
      }
    }

    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving menu:', err.message);
    res.status(500).json({ error: 'Failed to save menu.' });
  }
});

function getRawComponents(items, metadata) {
  const meta = metadata || MOCK_METADATA;
  const comp = { 
    Roti: 0, Paratha: 0, Puri: 0, 
    RotiPacks: [], ParathaPacks: [], PuriPacks: [],
    Sabji: 0, Dal: 0, Rice: 0, 
    SabjiFull: 0, SabjiHalf: 0,
    DalFull: 0, DalHalf: 0,
    RiceFull: 0, RiceHalf: 0,
    Sweet: 0, Farsan: 0, Namkeen: 0, Salad: 0, Tiffins: 0 
  };
  
  const sweetOn = meta.sweetAvailable === 'Yes';
  const farsanOn = meta.farsanAvailable === 'Yes';
  const namkeenOn = meta.namkeenAvailable === 'Yes';
  const saladOn = meta.saladAvailable === 'Yes';
  const breadType = meta.breadType || 'Roti';
  const matrix = meta.tiffinMatrix || MOCK_METADATA.tiffinMatrix;
  
  (items || []).forEach(item => {
    const n = (item.name || '').trim();
    const q = item.quantity || 0;
    
    // Tiffin processing
    let tiffinName = null;
    if (n === 'Mini Lunch') tiffinName = 'Mini Lunch';
    else if (n.toLowerCase().includes('brunch')) tiffinName = 'Brunch';
    else if (n.toLowerCase().includes('full lunch')) tiffinName = 'Full Lunch';
    else if (n === 'Family Meal') tiffinName = 'Family Meal';

    if (tiffinName) {
      const dbMatrix = matrix[tiffinName] || matrix['Full Lunch'];
      const defaultMatrix = MOCK_METADATA.tiffinMatrix[tiffinName] || MOCK_METADATA.tiffinMatrix['Full Lunch'];
      const tMatrix = { ...defaultMatrix, ...dbMatrix };
      
      comp.Tiffins += q;
      
      // Bread
      const bCount = tMatrix[breadType] || 0;
      if (bCount > 0) {
        comp[breadType] += bCount * q;
        for (let i = 0; i < q; i++) comp[`${breadType}Packs`].push(bCount);
      }

      // Fixed sides for tiffins
      if (tiffinName === 'Mini Lunch') {
        comp.SabjiHalf += q; comp.DalHalf += q; comp.RiceHalf += q;
      } else if (tiffinName === 'Brunch') {
        comp.SabjiFull += q; comp.DalHalf += q; comp.RiceHalf += q;
      } else if (tiffinName === 'Full Lunch') {
        comp.SabjiFull += q; comp.DalFull += q; comp.RiceFull += q;
      } else if (tiffinName === 'Family Meal') {
        comp.SabjiFull += q; comp.SabjiHalf += q;
        comp.DalFull += q; comp.DalHalf += q;
        comp.RiceFull += q; comp.RiceHalf += q;
      }
      // Addons
      if (sweetOn) comp.Sweet += (tMatrix.Sweet || 0) * q;
      if (farsanOn) comp.Farsan += (tMatrix.Farsan || 0) * q;
      if (namkeenOn) comp.Namkeen += (tMatrix.Namkeen || 0) * q;
      if (saladOn) comp.Salad += (tMatrix.Salad || 0) * q;
    } else {
      // Individual items
      if (n.toLowerCase() === breadType.toLowerCase()) {
        comp[breadType] += 1 * q;
        comp[`${breadType}Packs`].push(1 * q);
      } else if (n.toLowerCase().includes('sabji (half)')) {
        comp.SabjiHalf += q;
      } else if (n.toLowerCase().includes('sabji (full)')) {
        comp.SabjiFull += q;
      } else if (n.toLowerCase().includes('dal (half)')) {
        comp.DalHalf += q;
      } else if (n.toLowerCase().includes('dal (full)')) {
        comp.DalFull += q;
      } else if (n.toLowerCase().includes('rice (half)')) {
        comp.RiceHalf += q;
      } else if (n.toLowerCase().includes('rice (full)') || n.toLowerCase() === 'rice') {
        comp.RiceFull += q;
      } else if (n.toLowerCase().includes('sweet')) {
        comp.Sweet += 1 * q;
      } else if (n.toLowerCase().includes('farsan')) {
        comp.Farsan += 1 * q;
      }
    }
  });

  comp.Sabji = comp.SabjiFull + 0.5 * comp.SabjiHalf;
  comp.Dal = comp.DalFull + 0.5 * comp.DalHalf;
  comp.Rice = comp.RiceFull + 0.5 * comp.RiceHalf;

  const formatStr = (full, half) => {
     let parts = [];
     if (full > 0) parts.push(`${full}F`);
     if (half > 0) parts.push(`${half}H`);
     if (parts.length === 0) return 0;
     if (parts.length === 1 && full > 0) return full;
     return parts.join(' ');
  };
  comp.SabjiStr = formatStr(comp.SabjiFull, comp.SabjiHalf);
  comp.DalStr = formatStr(comp.DalFull, comp.DalHalf);
  comp.RiceStr = formatStr(comp.RiceFull, comp.RiceHalf);

  const formatPacks = (packs) => {
    if (packs.length === 0) return 0;
    if (packs.length === 1) return packs[0];
    return packs.join(' + ');
  };
  comp.RotiStr = formatPacks(comp.RotiPacks);
  comp.ParathaStr = formatPacks(comp.ParathaPacks);
  comp.PuriStr = formatPacks(comp.PuriPacks);

  return comp;
}

function computeSerialNumbers(orders, metadata) {
  const lunchMap = {};
  const choviarMap = {};

  const lunchOrders = [];
  const choviarOrders = [];

  orders.forEach(o => {
    if (o.status === 'CANCELLED') return;
    const lunchItems = (o.items || []).filter(i => i.category !== 'Choviar');
    const choviarItems = (o.items || []).filter(i => i.category === 'Choviar');
    
    if (lunchItems.length > 0) {
      const comp = getRawComponents(lunchItems, metadata);
      lunchOrders.push({ 
        orderId: o.orderId, 
        zone: o.zone || 'borivali', 
        routeOrder: typeof o.routeOrder === 'number' ? o.routeOrder : 9999, 
        Roti: comp.Roti || comp.Paratha || comp.Puri || 0 
      });
    }
    if (choviarItems.length > 0) {
      choviarOrders.push({ 
        orderId: o.orderId, 
        zone: o.zone || 'borivali', 
        routeOrder: typeof o.routeOrder === 'number' ? o.routeOrder : 9999 
      });
    }
  });

  const outsideLunch = lunchOrders.filter(o => o.zone === 'outside');
  const borivaliLunch = lunchOrders.filter(o => o.zone !== 'outside');
  
  outsideLunch.sort((a, b) => {
    if (a.Roti !== b.Roti) return a.Roti - b.Roti;
    return a.routeOrder - b.routeOrder;
  });
  
  borivaliLunch.sort((a, b) => {
    if (a.Roti !== b.Roti) return a.Roti - b.Roti;
    return a.routeOrder - b.routeOrder;
  });
  
  [...outsideLunch, ...borivaliLunch].forEach((o, idx) => {
    lunchMap[o.orderId] = idx + 1;
  });

  const outsideChoviar = choviarOrders.filter(o => o.zone === 'outside');
  const borivaliChoviar = choviarOrders.filter(o => o.zone !== 'outside');
  outsideChoviar.sort((a, b) => a.routeOrder - b.routeOrder);
  borivaliChoviar.sort((a, b) => a.routeOrder - b.routeOrder);
  [...outsideChoviar, ...borivaliChoviar].forEach((o, idx) => {
    choviarMap[o.orderId] = idx + 1;
  });

  return { lunchMap, choviarMap };
}


app.get('/api/admin/kitchen', adminLimiter, requireAdmin, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date parameter required (DD/MM/YYYY)' });

  let orders = [];
  let metadata = MOCK_METADATA;
  let menuItems = MOCK_MENU;

  if (USE_MOCK) {
    orders = MOCK_ORDERS.filter(o => o.date === date && o.status !== 'CANCELLED');
  } else {
    try {
      const snapshot = await db.collection('orders')
        .where('date', '==', date)
        .get();
      orders = snapshot.docs.map(doc => doc.data()).filter(o => o.status !== 'CANCELLED');
      
      const metaSnap = await db.collection('metadata').doc('global').get();
      if (metaSnap.exists) {
        metadata = metaSnap.data();
      }

      const menuSnap = await db.collection('menu').get();
      menuItems = menuSnap.docs.map(doc => doc.data());
    } catch (err) {
      console.error('Error fetching kitchen summary:', err.message);
      return res.status(500).json({ error: 'Failed to fetch kitchen summary.' });
    }
  }

  // Build a map of Choviar item name → qty-per-order from the menu definition
  // e.g. { 'Choviar Special': 4 } means each order unit = 4 pieces in the kitchen
  const choviarMenuQtyMap = {};
  (menuItems || []).forEach(m => {
    if (m.category === 'Choviar' && m.qty && Number(m.qty) > 0) {
      choviarMenuQtyMap[m.name] = Number(m.qty);
    }
  });

  const grandTotals = { Roti: 0, Sabji: 0, Dal: 0, Rice: 0, Sweet: 0, Farsan: 0 };
  const kitchenOrders = [];
  
  const choviarGrandTotals = {};
  const choviarKitchenOrders = [];

  const breadType = metadata.breadType || 'Roti';
  const packetSummary = {
    Dal: { Half: 0, Full: 0 },
    Rice: { Half: 0, Full: 0 },
    Sabji: { Half: 0, Full: 0 },
    Bread: {}
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
      grandTotals[breadType] = (grandTotals[breadType] || 0) + comp[breadType];
      grandTotals.Sabji += comp.Sabji;
      grandTotals.Dal += comp.Dal;
      grandTotals.Rice += comp.Rice;
      grandTotals.Sweet += comp.Sweet;
      grandTotals.Farsan += comp.Farsan;
      grandTotals.Namkeen = (grandTotals.Namkeen || 0) + comp.Namkeen;
      grandTotals.Salad = (grandTotals.Salad || 0) + comp.Salad;
      grandTotals.Tiffins = (grandTotals.Tiffins || 0) + comp.Tiffins;

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
          packetSummary.Bread['3'] = (packetSummary.Bread['3'] || 0) + q;
          packetSummary.Dal.Half += q; packetSummary.Rice.Half += q; packetSummary.Sabji.Half += q;
        } else if (n.toLowerCase().includes('brunch')) {
          const bQty = metadata?.tiffinMatrix?.Brunch?.[breadType] || 6;
          packetSummary.Bread[bQty] = (packetSummary.Bread[bQty] || 0) + q;
          packetSummary.Dal.Half += q; packetSummary.Rice.Half += q; packetSummary.Sabji.Full += q;
        } else if (n.toLowerCase().includes('full lunch')) {
          const bQty = metadata?.tiffinMatrix?.['Full Lunch']?.[breadType] || 6;
          packetSummary.Bread[bQty] = (packetSummary.Bread[bQty] || 0) + q;
          packetSummary.Dal.Full += q; packetSummary.Rice.Full += q; packetSummary.Sabji.Full += q;
        } else if (n === 'Family Meal') {
          const bQty = metadata?.tiffinMatrix?.['Family Meal']?.[breadType] || 9;
          packetSummary.Bread[bQty] = (packetSummary.Bread[bQty] || 0) + q;
          packetSummary.Dal.Full += q; packetSummary.Dal.Half += q;
          packetSummary.Rice.Full += q; packetSummary.Rice.Half += q;
          packetSummary.Sabji.Full += q; packetSummary.Sabji.Half += q;
        } else if (n.toLowerCase() === breadType.toLowerCase()) {
          packetSummary.Bread[q] = (packetSummary.Bread[q] || 0) + 1;
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
      const baseChoviarItems = (menuItems || []).filter(m => m.category === 'Choviar' && m.name !== 'Full Choviar' && m.name !== 'Choviar');
      
      choviarItems.forEach(item => {
        const n = (item.name || '').trim();
        const orderQty = item.quantity || 0;
        if (orderQty <= 0) return;

        if (n === 'Full Choviar' || n === 'Choviar' || n === 'Choviar Special' || n === 'Family Choviar') {
          baseChoviarItems.forEach(bm => {
             const bName = (bm.name || '').trim();
             let multiplier = choviarMenuQtyMap[bName] || 1;
             if (n === 'Family Choviar') {
                 multiplier *= 1.5;
             }
             const kitchenQty = orderQty * multiplier;
             comp[bName] = (comp[bName] || 0) + kitchenQty;
             choviarGrandTotals[bName] = (choviarGrandTotals[bName] || 0) + kitchenQty;
          });
        } else {
          // Custom order item: user specifies exact quantity. Do not multiply by menu qty.
          const kitchenQty = orderQty;

          comp[n] = (comp[n] || 0) + kitchenQty;
          choviarGrandTotals[n] = (choviarGrandTotals[n] || 0) + kitchenQty;
        }
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

  const { lunchMap, choviarMap } = computeSerialNumbers(orders, metadata);

  kitchenOrders.forEach(o => { o.serialNumber = lunchMap[o.orderId] || 0; });
  choviarKitchenOrders.forEach(o => { o.serialNumber = choviarMap[o.orderId] || 0; });

  // Sort according to serial number (which corresponds to outside first by roti, then borivali by sequence)
  kitchenOrders.sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0));
  choviarKitchenOrders.sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0));

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
// Removed Hindi translation logic as requested

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
    
    // Fetch metadata to compute serial numbers consistently
    let metadata = MOCK_METADATA;
    const metaSnap = await db.collection('metadata').doc('global').get();
    if (metaSnap.exists) {
      metadata = metaSnap.data();
    }
    
    const { lunchMap, choviarMap } = computeSerialNumbers(rows, metadata);

    const orders = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const deliveryPerson = row.deliveryPerson || '';
      
      if (deliveryPerson.trim().length > 0 && deliveryPerson.trim().toLowerCase() !== 'dabbawala') {
        let category = row.category;
        if (!category) {
          const items = row.items || [];
          if (items.length > 0) {
            const hasLunchItems = items.some(i => i.category !== 'Choviar');
            category = hasLunchItems ? 'Lunch' : 'Choviar';
          } else {
            category = row.orderId && row.orderId.endsWith('-C') ? 'Choviar' : 'Lunch';
          }
        }

        let serialNumber = 0;
        if (category === 'Lunch') serialNumber = lunchMap[row.orderId] || 0;
        else serialNumber = choviarMap[row.orderId] || 0;

        orders.push({
          orderId: row.orderId, // UUID instead of rowIndex
          name: row.name || '',
          phone: row.phone || '',
          address: row.address || '',
          amount: row.grandTotal || '0',
          deliveryPerson: deliveryPerson,
          routeOrder: typeof row.routeOrder === 'number' ? row.routeOrder : 9999,
          paymentReceived: !!row.paymentReceived,
          paymentMethod: row.paymentMethod || 'Cash',
          amountReceived: row.amountReceived || '',
          itemsSummary: row.itemsSummary || '',
          status: row.status || 'PENDING',
          category: category,
          serialNumber: serialNumber
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

app.put('/api/admin/orders/payment/batch', adminLimiter, requireAdmin, express.json(), async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates) || updates.length === 0) return res.status(400).json({ error: 'updates array required' });

  try {
    if (!USE_MOCK) {
      const batch = db.batch();
      updates.forEach(u => {
        const orderRef = db.collection('orders').doc(u.orderId);
        batch.update(orderRef, {
          paymentReceived: !!u.paymentReceived,
          paymentMethod: u.paymentMethod || 'Cash',
          amountReceived: u.amountReceived !== undefined ? String(u.amountReceived) : '',
          paymentDate: u.paymentDate || ''
        });
      });
      await batch.commit();
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error in batch payment:', err.message);
    res.status(500).json({ error: 'Failed to batch update payments' });
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
