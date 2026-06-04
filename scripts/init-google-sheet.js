require('dotenv').config();
const { google } = require('googleapis');

const TIFFIN_ITEMS = [
  { name: 'Mini Lunch',  description: '3 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 140 },
  { name: 'Brunch',      description: '6 Roti, Sabji, 1/2 Dal, 1/2 Rice, Salad / Sweet / Namkeen / Farsan', price: 180 },
  { name: 'Full Lunch',  description: '6 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 220 },
  { name: 'Family Meal', description: '9 Roti, Sabji, Dal, Rice, Salad / Sweet / Namkeen / Farsan', price: 320 },
  { name: 'Choviar Special', description: 'Ragdo, 4 Kelawada, Dal Khichdi', price: 160 },
];

function fail(msg) { console.error(`\nERROR: ${msg}\n`); process.exit(1); }

function getEnvOrFail(key) {
  const value = process.env[key];
  if (!value || value.includes('your-') || value.includes('your_')) {
    fail(`${key} is missing or still using a placeholder value in .env`);
  }
  return value;
}

function normalizeSpreadsheetId(raw) {
  if (!raw) return '';
  const fromUrl = raw.trim().match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl) return fromUrl[1];
  return raw.trim().split('/')[0].split('?')[0];
}

async function main() {
  const clientEmail = getEnvOrFail('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey  = getEnvOrFail('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const drive  = google.drive({ version: 'v3', auth });

  // Use existing spreadsheet or create new one
  const providedId = process.env.SPREADSHEET_ID && !process.env.SPREADSHEET_ID.includes('your_')
    ? normalizeSpreadsheetId(process.env.SPREADSHEET_ID)
    : '';

  let spreadsheetId, spreadsheetUrl, createdNew = false;

  const requiredSheets = ['TomorrowMenu', 'CustomerData', 'Orders'];

  if (providedId) {
    spreadsheetId = providedId;
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    spreadsheetUrl = meta.data.spreadsheetUrl;
    const existingTitles = new Set((meta.data.sheets || []).map(s => s.properties.title));
    const addRequests = requiredSheets
      .filter(t => !existingTitles.has(t))
      .map(t => ({ addSheet: { properties: { title: t } } }));
    if (addRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests: addRequests } });
    }
  } else {
    const createRes = await sheets.spreadsheets.create({
      resource: {
        properties: { title: `JTS Tiffin Data ${new Date().toISOString().slice(0, 10)}` },
        sheets: requiredSheets.map(title => ({ properties: { title } })),
      },
      fields: 'spreadsheetId,spreadsheetUrl',
    });
    spreadsheetId  = createRes.data.spreadsheetId;
    spreadsheetUrl = createRes.data.spreadsheetUrl;
    createdNew     = true;
  }

  // ── Write headers and seed data ───────────────────────────────────────────
  const menuHeader = [['Item Name', 'Description', 'Price', 'Available', 'Category', 'Meta Key', 'Meta Value']];
  const menuRows   = TIFFIN_ITEMS.map(item => [item.name, item.description, item.price, 'Yes', item.name.includes('Choviar') ? 'Choviar' : 'Lunch']);

  const metadataRows = [
    ['sabji', 'Bhindi'],
    ['sweet', 'Aamras'],
    ['dal', 'Gujarati Dal'],
    ['farsan', 'Dhokla']
  ];
  
  // Append metadata to the right (columns F and G, rows 2-5)
  // We can just pad the menuRows or write them separately.
  // It's easier to write them separately.

  const customerHeader = [[
    'Name', 'Mobile', 'Wing/Flat', 'Building', 'Street', 'Landmark',
    'Locality', 'Pincode', 'Last Order Date',
  ]];

  const ordersHeader = [[
    'Order ID', 'Date', 'Time', 'Name', 'Phone', 'Address', 'Pincode',
    'Zone', 'Items Summary', 'Items JSON', 'Surcharge', 'Grand Total',
  ]];

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    resource: { ranges: ['TomorrowMenu!A:Z', 'CustomerData!A:Z', 'Orders!A:Z'] },
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'TomorrowMenu!A1:G1', values: menuHeader },
        { range: 'TomorrowMenu!A2:E',  values: menuRows   },
        { range: 'TomorrowMenu!F2:G5', values: metadataRows },
        { range: 'CustomerData!A1:I1', values: customerHeader },
        { range: 'Orders!A1:L1',       values: ordersHeader   },
      ],
    },
  });

  // ── Optional: share with personal Gmail ──────────────────────────────────
  const shareEmail = process.env.SHEET_SHARE_EMAIL;
  if (shareEmail && createdNew) {
    await drive.permissions.create({
      fileId: spreadsheetId,
      sendNotificationEmail: true,
      requestBody: { type: 'user', role: 'writer', emailAddress: shareEmail },
    });
    console.log(`\nSheet shared with: ${shareEmail}`);
  }

  console.log('\n✅ Google Sheet initialised successfully!');
  console.log(`SPREADSHEET_ID=${spreadsheetId}`);
  console.log(`URL: ${spreadsheetUrl}`);
  console.log('\nSheets created: TomorrowMenu, CustomerData, Orders');
  console.log('TomorrowMenu seeded with the 4 default tiffin items.');
  if (!createdNew) console.log('(Used existing spreadsheet — existing data cleared and re-seeded.)');
}

main().catch(err => {
  console.error('\nFailed to initialise spreadsheet:', err.message);
  process.exit(1);
});
