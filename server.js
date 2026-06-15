require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const path         = require('path');
const { google }   = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const rateLimit    = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // needed when behind React dev proxy / reverse proxy

// ─── Security headers (helmet) ────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors());

// ─── Body size limit (prevents large-payload DoS) ────────────────────────────
app.use(express.json({ limit: '50kb' }));

// ─── Config ───────────────────────────────────────────────────────────────────
const SPREADSHEET_ID   = process.env.SPREADSHEET_ID;
const USE_MOCK         = process.env.USE_MOCK_DATA === 'true';
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD || 'changeme';
if (ADMIN_PASSWORD === 'changeme') {
  console.warn('⚠️  WARNING: ADMIN_PASSWORD is set to the default "changeme". Set a strong password in .env before going live!');
}
const SURCHARGE_AMOUNT = parseInt(process.env.OUTSIDE_DELIVERY_SURCHARGE || '40', 10);

// Borivali pincodes: comma or space-separated list. Empty = no surcharge for anyone.
const BORIVALI_PINCODES = new Set(
  (process.env.BORIVALI_PINCODES || '')
    .split(/[,| \t]+/)
    .map(p => p.trim())
    .filter(Boolean)
);

if (!USE_MOCK && !SPREADSHEET_ID) {
  console.error('ERROR: SPREADSHEET_ID not set. Use USE_MOCK_DATA=true or provide SPREADSHEET_ID.');
  process.exit(1);
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
const orderLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false });
const adminLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  standardHeaders: true, legacyHeaders: false }); // tightened from 100 → 10
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
let MOCK_METADATA = { sabji: 'Bhindi', sweet: 'Aamras', dal: 'Gujarati Dal', farsan: 'Dhokla' };

let MOCK_ORDERS    = [];
let MOCK_CUSTOMERS = []; // [{ name, phone, wingFlat, building, street, landmark, locality, pincode, lastOrderDate }]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function parseJsonSafe(str, fallback = []) {
  try { return JSON.parse(str); } catch { return fallback; }
}

/**
 * Fetch menu items and metadata for server-side price validation.
 * Returns { menuItems, metadata }.
 */
async function getMenuForPricing(sheets) {
  if (USE_MOCK) return { menuItems: MOCK_MENU, metadata: MOCK_METADATA };
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'TomorrowMenu!A2:G',
  });
  const rows = response.data.values || [];
  
  const menuItems = rows
    .filter(row => row[0])
    .map(row => ({
      name:      (row[0] || '').trim(),
      price:     parseFloat(row[2]) || 0,
      available: (row[3] || 'Yes').toLowerCase() !== 'no',
      category:  (row[4] || 'Lunch').trim(),
    }));

  const metadata = {};
  rows.forEach(row => {
    const key = (row[5] || '').trim();
    const val = (row[6] || '').trim();
    if (key) metadata[key] = val;
  });

  return { menuItems, metadata };
}

/**
 * Compute the authoritative server-side price for an order item name.
 * Returns null if the item is unrecognised (order should be rejected).
 */
function computeServerPrice(itemName, menuItems, metadata) {
  // "Roti"
  if (itemName === 'Roti') return { price: parseFloat(metadata.rotiPrice) || 8, category: 'Individual' };
  
  // Custom Order Items
  if (itemName === `Sabji (Half) - ${metadata.sabji || 'Sabji'}`) return { price: parseFloat(metadata.sabjiHalfPrice) || 0, category: 'Individual' };
  if (itemName === `Sabji (Full) - ${metadata.sabji || 'Sabji'}`) return { price: parseFloat(metadata.sabjiFullPrice) || 0, category: 'Individual' };
  if (itemName === `Dal (Half) - ${metadata.dal || 'Dal'}`) return { price: parseFloat(metadata.dalHalfPrice) || 0, category: 'Individual' };
  if (itemName === `Dal (Full) - ${metadata.dal || 'Dal'}`) return { price: parseFloat(metadata.dalFullPrice) || 0, category: 'Individual' };
  if (itemName === `Rice`) return { price: parseFloat(metadata.ricePrice) || 0, category: 'Individual' };
  if (itemName === `Farsan - ${metadata.farsan || 'Farsan'}`) return { price: parseFloat(metadata.farsanPrice) || 0, category: 'Individual' };
  if (itemName === `Sweet - ${metadata.sweet || 'Sweet'}`) return { price: parseFloat(metadata.sweetPrice) || 0, category: 'Individual' };

  // Regular menu item (Lunch / Choviar)
  const item = menuItems.find(m => m.name === itemName);
  return item ? { price: item.price, category: item.category || 'Lunch' } : null;
}

/** Determine zone based on pincode */
function getZone(pincode) {
  if (BORIVALI_PINCODES.size === 0) return 'borivali'; // No pincodes configured → everyone is Borivali
  return BORIVALI_PINCODES.has(String(pincode).trim()) ? 'borivali' : 'outside';
}

/** Format date as DD/MM/YYYY */
function formatDate(date) {
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Format time as HH:MM */
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
}

/** Sheet title for a specific date */
function dateSheetTitle(date) {
  const [day, month, year] = formatDate(date).split('/');
  return `Orders_${day}-${month}-${year}`;
}

/** Sheet title for a specific month */
function billingSheetTitle(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `Billing_${month}-${date.getFullYear()}`;
}

/**
 * Ensure a sheet with the given title exists; create it with headers if not.
 * Returns the sheetId.
 */
async function ensureSheet(sheets, spreadsheetId, title, headers) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const existing = (meta.data.sheets || []).find(s => s.properties.title === title);
  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests: [{ addSheet: { properties: { title } } }] },
    });
    if (headers && headers.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${title}'!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [headers] },
      });
    }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/menu
app.get('/api/menu', publicLimiter, async (req, res) => {
  if (USE_MOCK) return res.json({ menu: MOCK_MENU, metadata: MOCK_METADATA });
  try {
    const sheets   = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'TomorrowMenu!A2:G',
    });
    const rows = response.data.values || [];
    
    // Parse menu items (Cols A-E)
    const menu = rows
      .filter(row => row[0])
      .map(row => ({
        name:        (row[0] || '').trim(),
        description: (row[1] || '').trim(),
        price:       parseFloat(row[2]) || 0,
        available:   (row[3] || 'Yes').toLowerCase() !== 'no',
        category:    (row[4] || 'Lunch').trim(),
      }));

    // Parse metadata (Cols F-G)
    const metadata = {};
    rows.forEach(row => {
      const key = (row[5] || '').trim();
      const val = (row[6] || '').trim();
      if (key) metadata[key] = val;
    });

    res.json({ menu, metadata });
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
    const sheets   = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'CustomerData!A2:I',
    });
    const rows = response.data.values || [];
    const profiles = rows
      .filter(row => (row[1] || '').trim() === queryPhone)
      .map(row => ({
        name:     (row[0] || '').trim(),
        phone:    (row[1] || '').trim(),
        wingFlat: (row[2] || '').trim(),
        building: (row[3] || '').trim(),
        street:   (row[4] || '').trim(),
        landmark: (row[5] || '').trim(),
        locality: (row[6] || '').trim(),
        pincode:  (row[7] || '').trim(),
      }));
    res.json({ found: profiles.length > 0, profiles });
  } catch (err) {
    console.error('Error looking up customer:', err.message);
    res.status(500).json({ error: 'Failed to look up customer.' });
  }
});

// POST /api/orders
app.post('/api/orders', orderLimiter, async (req, res) => {
  const { customer, items } = req.body; // Note: we no longer trust client subtotal

  // ── Basic structure validation ────────────────────────────────────────────
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

  // ── Quantity caps (H-4) ───────────────────────────────────────────────────
  const MAX_QTY_PER_ITEM = 20;
  const MAX_ITEM_TYPES   = 6;
  if (items.length > MAX_ITEM_TYPES) {
    return res.status(400).json({ error: `Too many item types. Maximum ${MAX_ITEM_TYPES} allowed per order.` });
  }
  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    if (!qty || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return res.status(400).json({ error: `Invalid quantity for "${item.name}". Must be 1–${MAX_QTY_PER_ITEM}.` });
    }
  }

  // ── Server-side price validation (C-2) ───────────────────────────────────
  let menuItems, metadata;
  try {
    const sheetsForPricing = USE_MOCK ? null : getSheetsClient();
    const result = await getMenuForPricing(sheetsForPricing);
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

  // ── Zone + server-computed totals ────────────────────────────────────────
  const zone = getZone(customer.pincode.trim());
  const subtotal = validatedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  
  const baseOrderId  = uuidv4().slice(0, 8).toUpperCase();
  const now          = new Date();
  const date         = formatDate(now);
  const time         = formatTime(now);

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

  if (USE_MOCK) {
    for (const sub of subOrders) {
      MOCK_ORDERS.push({
        orderId: sub.orderId, date, time,
        name:    customer.name.trim(),
        phone:   customer.phone.trim(),
        address: customer.address.trim(),
        pincode: customer.pincode.trim(),
        zone,
        items: sub.items,
        itemsSummary: sub.items.map(i => `${i.name}×${i.quantity}`).join(', '),
        surchargeTotal: sub.surchargeTotal,
        grandTotal: sub.grandTotal,
        deliveryPerson: '',
        routeOrder: ''
      });
    }

    // Upsert customer
    const existingIdx = MOCK_CUSTOMERS.findIndex(
      c => c.phone === customer.phone.trim() && c.pincode === customer.pincode.trim()
    );
    const customerRecord = {
      name:     customer.name.trim(),
      phone:    customer.phone.trim(),
      wingFlat: customer.wingFlat.trim(),
      building: customer.building.trim(),
      street:   customer.street.trim(),
      landmark: (customer.landmark || '').trim(),
      locality: customer.locality.trim(),
      pincode:  customer.pincode.trim(),
      lastOrderDate: date,
    };
    if (existingIdx >= 0) {
      MOCK_CUSTOMERS[existingIdx] = customerRecord;
    } else {
      MOCK_CUSTOMERS.push(customerRecord);
    }

    return res.json({ success: true, orderId: baseOrderId, zone, surchargeTotal: totalSurcharge, grandTotal: subtotal + totalSurcharge });
  }

  // ── Real Google Sheets write ──────────────────────────────────────────────
  try {
    const sheets = getSheetsClient();
    
    const masterRows = [];
    const dateRows = [];
    const billingRows = [];

    for (const sub of subOrders) {
      const itemsJson = JSON.stringify(sub.items);
      const itemsSummary = sub.items.map(i => `${i.name}×${i.quantity}`).join(', ');

      // 1. Master row
      masterRows.push([
        sub.orderId, date, time,
        customer.name.trim(), customer.phone.trim(),
        customer.address.trim(), customer.pincode.trim(), zone,
        itemsSummary, itemsJson, sub.surchargeTotal, sub.grandTotal,
        '', '' // Delivery Person, Route Order
      ]);

      // 2. Date & Billing rows
      for (const item of sub.items) {
        dateRows.push([
          sub.orderId, time,
          customer.name.trim(), customer.phone.trim(),
          customer.address.trim(), customer.pincode.trim(), zone,
          item.name, item.quantity, item.price,
          0,
          item.price * item.quantity,
        ]);
        billingRows.push([
          date, sub.orderId,
          customer.name.trim(), customer.phone.trim(),
          item.name, item.quantity, item.price,
          0,
          item.price * item.quantity,
        ]);
      }
      
      if (sub.surchargeTotal > 0) {
        dateRows.push([
          sub.orderId, time,
          customer.name.trim(), customer.phone.trim(),
          customer.address.trim(), customer.pincode.trim(), zone,
          'Delivery Charge', 1, sub.surchargeTotal,
          0,
          sub.surchargeTotal,
        ]);
        billingRows.push([
          date, sub.orderId,
          customer.name.trim(), customer.phone.trim(),
          'Delivery Charge', 1, sub.surchargeTotal,
          0,
          sub.surchargeTotal,
        ]);
      }

      if (sub.roundOffAmount && sub.roundOffAmount !== 0) {
        dateRows.push([
          sub.orderId, time,
          customer.name.trim(), customer.phone.trim(),
          customer.address.trim(), customer.pincode.trim(), zone,
          'Round Off', 1, sub.roundOffAmount,
          0,
          sub.roundOffAmount,
        ]);
        billingRows.push([
          date, sub.orderId,
          customer.name.trim(), customer.phone.trim(),
          'Round Off', 1, sub.roundOffAmount,
          0,
          sub.roundOffAmount,
        ]);
      }
    }

    // 1. Append to Orders master
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A:N',
      valueInputOption: 'USER_ENTERED',
      resource: { values: masterRows },
    });

    // 2. Append to datewise sheet (Orders_DD-MM-YYYY)
    const dateTitle = dateSheetTitle(now);
    await ensureSheet(sheets, SPREADSHEET_ID, dateTitle, [
      'Order ID', 'Time', 'Name', 'Phone', 'Address', 'Pincode', 'Zone',
      'Item Name', 'Qty', 'Unit Price', 'Surcharge Per Item', 'Item Total',
    ]);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${dateTitle}'!A:L`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: dateRows },
    });

    // 3. Append to billing sheet (Billing_MM-YYYY)
    const billingTitle = billingSheetTitle(now);
    await ensureSheet(sheets, SPREADSHEET_ID, billingTitle, [
      'Date', 'Order ID', 'Name', 'Phone', 'Item', 'Qty', 'Unit Price', 'Surcharge', 'Total',
    ]);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${billingTitle}'!A:I`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: billingRows },
    });

    // 4. Upsert into CustomerData
    const custResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'CustomerData!A2:I',
    });
    const custRows = custResponse.data.values || [];
    const custMatchIdx = custRows.findIndex(
      row => (row[1] || '').trim() === customer.phone.trim() &&
             (row[7] || '').trim() === customer.pincode.trim()
    );
    const newCustRow = [
      customer.name.trim(), customer.phone.trim(),
      customer.wingFlat.trim(), customer.building.trim(),
      customer.street.trim(), (customer.landmark || '').trim(),
      customer.locality.trim(), customer.pincode.trim(), date,
    ];
    if (custMatchIdx >= 0) {
      // Update existing row's Last Order Date
      const sheetRow = custMatchIdx + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `CustomerData!A${sheetRow}:I${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newCustRow] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'CustomerData!A:I',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newCustRow] },
      });
    }

    res.json({ 
      success: true, 
      orderId: baseOrderId, 
      zone, 
      surchargeTotal: totalSurcharge, 
      grandTotal: grandTotalRounded 
    });
  } catch (err) {
    console.error('Error placing order:', err.message);
    res.status(500).json({ error: 'Failed to place order. Please try again.' });
  }
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  const pass = req.headers['x-admin-password'];
  if (!pass || pass !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/admin/orders
app.get('/api/admin/orders', adminLimiter, requireAdmin, async (req, res) => {
  const { date, month } = req.query;

  if (USE_MOCK) {
    let orders = [...MOCK_ORDERS];
    if (date)  orders = orders.filter(o => o.date === date);
    if (month) orders = orders.filter(o => (o.date || '').endsWith(month));
    return res.json({ orders });
  }

  try {
    const sheets   = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A2:N',
    });
    const rows = response.data.values || [];
    let orders = rows.map((row, idx) => ({
      rowIndex:       idx + 2,
      orderId:        row[0]  || '',
      date:           row[1]  || '',
      time:           row[2]  || '',
      name:           row[3]  || '',
      phone:          row[4]  || '',
      address:        row[5]  || '',
      pincode:        row[6]  || '',
      zone:           row[7]  || 'borivali',
      itemsSummary:   row[8]  || '',
      items:          parseJsonSafe(row[9]),
      surchargeTotal: parseFloat(row[10]) || 0,
      grandTotal:     parseFloat(row[11]) || 0,
      deliveryPerson: row[12] || '',
      routeOrder:     row[13] || '',
    }));

    if (date)  orders = orders.filter(o => o.date === date);
    if (month) orders = orders.filter(o => (o.date || '').endsWith(month));

    res.json({ orders });
  } catch (err) {
    console.error('Error fetching admin orders:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// PUT /api/admin/orders/delivery/batch
app.put('/api/admin/orders/delivery/batch', adminLimiter, requireAdmin, async (req, res) => {
  const { updates } = req.body; // Array of { orderId, deliveryPerson, routeOrder }
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.json({ success: true });
  }

  if (USE_MOCK) {
    for (const update of updates) {
      const order = MOCK_ORDERS.find(o => o.orderId === update.orderId);
      if (order) {
        order.deliveryPerson = update.deliveryPerson || '';
        order.routeOrder = update.routeOrder || '';
      }
    }
    return res.json({ success: true });
  }

  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A:A',
    });
    const rows = response.data.values || [];
    
    // Build array of update requests
    const data = [];
    for (const update of updates) {
      const rowIndex = rows.findIndex(row => row[0] === update.orderId);
      if (rowIndex !== -1) {
        const rowNum = rowIndex + 1;
        data.push({
          range: `Orders!M${rowNum}:N${rowNum}`,
          values: [[update.deliveryPerson || '', update.routeOrder || '']],
        });
      }
    }

    if (data.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: data
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error batch updating delivery:', err.message);
    res.status(500).json({ error: 'Failed to update delivery details.' });
  }
});

// PUT /api/admin/menu
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
    const sheets = getSheetsClient();
    // Clear existing data rows (keep header)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'TomorrowMenu!A2:G',
    });
    
    // Prepare metadata array
    const metaEntries = metadata ? Object.entries(metadata) : [];
    
    // Combine items (Cols A-E) and metadata (Cols F-G) into row arrays
    const maxRows = Math.max(items.length, metaEntries.length);
    const rows = [];
    
    for (let i = 0; i < maxRows; i++) {
      const item = items[i];
      const meta = metaEntries[i];
      
      const row = [
        item ? String(item.name || '').trim() : '',
        item ? String(item.description || '').trim() : '',
        item ? (parseFloat(item.price) || 0) : '',
        item ? (item.available !== false ? 'Yes' : 'No') : '',
        item ? String(item.category || 'Lunch').trim() : '',
        meta ? meta[0] : '', // Key
        meta ? meta[1] : '', // Value
      ];
      rows.push(row);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'TomorrowMenu!A2:G',
      valueInputOption: 'USER_ENTERED',
      resource: { values: rows },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving menu:', err.message);
    res.status(500).json({ error: 'Failed to save menu.' });
  }
});

function getRawComponents(items) {
  const comp = { Roti: 0, Sabji: 0, Dal: 0, Rice: 0, Sweet: 0, Farsan: 0 };
  
  (items || []).forEach(item => {
    const n = (item.name || '').toLowerCase();
    const q = item.quantity || 0;
    
    if (n.includes('mini lunch')) {
      comp.Roti += 3 * q; comp.Sabji += 1 * q; comp.Dal += 1 * q; comp.Rice += 1 * q; comp.Sweet += 1 * q; comp.Farsan += 1 * q;
    } else if (n.includes('brunch')) {
      comp.Roti += 6 * q; comp.Sabji += 1 * q; comp.Dal += 0.5 * q; comp.Rice += 0.5 * q; comp.Sweet += 1 * q; comp.Farsan += 1 * q;
    } else if (n.includes('full lunch')) {
      comp.Roti += 6 * q; comp.Sabji += 1 * q; comp.Dal += 1 * q; comp.Rice += 1 * q; comp.Sweet += 1 * q; comp.Farsan += 1 * q;
    } else if (n.includes('family meal')) {
      comp.Roti += 9 * q; comp.Sabji += 1.5 * q; comp.Dal += 1.5 * q; comp.Rice += 1 * q; comp.Sweet += 1 * q; comp.Farsan += 1 * q;
    } else if (n === 'roti') {
      comp.Roti += 1 * q;
    } else if (n.includes('sabji (half)')) {
      comp.Sabji += 0.5 * q;
    } else if (n.includes('sabji (full)')) {
      comp.Sabji += 1 * q;
    } else if (n.includes('dal (half)')) {
      comp.Dal += 0.5 * q;
    } else if (n.includes('dal (full)')) {
      comp.Dal += 1 * q;
    } else if (n === 'rice') {
      comp.Rice += 1 * q;
    } else if (n.includes('sweet')) {
      comp.Sweet += 1 * q;
    } else if (n.includes('farsan')) {
      comp.Farsan += 1 * q;
    }
  });
  return comp;
}

// GET /api/admin/kitchen?date=DD/MM/YYYY
app.get('/api/admin/kitchen', adminLimiter, requireAdmin, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date parameter required (DD/MM/YYYY)' });

  let orders = [];

  if (USE_MOCK) {
    orders = MOCK_ORDERS.filter(o => o.date === date);
  } else {
    try {
      const sheets   = getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Orders!A2:N',
      });
      const rows = (response.data.values || []).filter(row => (row[1] || '') === date);
      orders = rows.map(row => ({
        orderId: row[0],
        name: row[3] || '',
        zone:  row[7] || 'borivali',
        items: parseJsonSafe(row[9]),
        deliveryPerson: row[12] || 'Unassigned',
        routeOrder: parseInt(row[13], 10) || 9999
      }));
    } catch (err) {
      console.error('Error fetching kitchen summary:', err.message);
      return res.status(500).json({ error: 'Failed to fetch kitchen summary.' });
    }
  }

  const grandTotals = { Roti: 0, Sabji: 0, Dal: 0, Rice: 0, Sweet: 0, Farsan: 0 };
  const kitchenOrders = [];

  orders.forEach(order => {
    // Only process lunch orders for kitchen breakdown (ignore Choviar-only orders)
    const isChoviarOnly = order.items && order.items.length > 0 && order.items.every(i => i.category === 'Choviar');
    if (!isChoviarOnly) {
      const comp = getRawComponents(order.items);
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
        ...comp
      });
    }
  });

  kitchenOrders.sort((a, b) => a.routeOrder - b.routeOrder);

  res.json({ date, orderCount: kitchenOrders.length, grandTotals, kitchenOrders });
});

// ─── Delivery Portal ─────────────────────────────────────────────────────────

const translationCache = new Map();
async function translateToHindi(text) {
  if (!text) return '';
  if (translationCache.has(text)) return translationCache.get(text);
  try {
    // using dynamic import for native fetch if needed, but fetch is global in Node 18+
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

// GET /api/delivery/orders
app.get('/api/delivery/orders', publicLimiter, async (req, res) => {
  try {
    const now = new Date();
    const today = formatDate(now);
    
    if (USE_MOCK) {
       return res.json({ success: true, orders: [] });
    }

    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A2:P',
    });
    
    const rows = response.data.values || [];
    const orders = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const date = row[1] || '';
      const deliveryPerson = row[12] || '';
      const routeOrder = parseInt(row[13], 10) || 999;
      
      if (date === today && deliveryPerson.trim().length > 0) {
        const nameEn = row[3] || '';
        const phone = row[4] || '';
        const addressEn = row[5] || '';
        
        const nameHi = await translateToHindi(nameEn);
        const addressHi = await translateToHindi(addressEn);
        
        orders.push({
          rowIndex: i + 2,
          orderId: row[0],
          name: nameHi,
          phone: phone,
          address: addressHi,
          amount: row[11] || '0',
          deliveryPerson: deliveryPerson,
          routeOrder: routeOrder,
          paymentReceived: (row[14] || '').toLowerCase() === 'yes',
          paymentMethod: row[15] || 'Cash'
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

// PUT /api/delivery/orders/payment
app.put('/api/delivery/orders/payment', publicLimiter, express.json(), async (req, res) => {
  const { rowIndex, paymentReceived, paymentMethod } = req.body;
  if (!rowIndex) return res.status(400).json({ error: 'rowIndex required' });

  try {
    if (!USE_MOCK) {
      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Orders!O${rowIndex}:P${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[paymentReceived ? 'Yes' : 'No', paymentMethod || 'Cash']]
        }
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

  app.use('/static', express.static(path.join(buildPath, 'static'), { maxAge: '1y', immutable: true }));
  app.use(express.static(buildPath, { maxAge: '1h' }));
  app.get('*', staticLimiter, (req, res) => {
    res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\nJTS Tiffin App server running on port ${PORT} [mock=${USE_MOCK}]`);
  if (USE_MOCK) {
    console.log('Using mock data – no Google Sheets connection required.');
  }
  if (BORIVALI_PINCODES.size > 0) {
    console.log(`Borivali pincodes: ${[...BORIVALI_PINCODES].join(', ')}`);
  } else {
    console.log('No Borivali pincodes configured – all orders treated as Borivali (no surcharge).');
  }
});
