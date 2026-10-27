/**
 * Asaba Chop & Grill - WhatsApp Bot & Management Server
 * Express Backend + whatsapp-web.js + Render.com compatible
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { handleMessage } = require('./src/bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Global state variables
global.qrCode = null;       // Raw QR code string or Data URL
global.qrDataUrl = null;    // Rendered QR image Data URL for browser
global.isReady = false;     // True when WhatsApp client is authenticated and ready
global.botPaused = false;   // Owner toggle to pause/resume auto-replying

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Paths to data files
const MENU_PATH = path.join(__dirname, 'data', 'menu.json');
const ORDERS_PATH = path.join(__dirname, 'data', 'orders.json');

// Ensure data files exist
if (!fs.existsSync(path.dirname(MENU_PATH))) {
  fs.mkdirSync(path.dirname(MENU_PATH), { recursive: true });
}
if (!fs.existsSync(ORDERS_PATH)) {
  fs.writeFileSync(ORDERS_PATH, JSON.stringify([], null, 2), 'utf8');
}

/**
 * Configure Puppeteer launch options
 * Render.com free tier is Linux and requires sandbox flags.
 */
const puppeteerArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
  '--single-process'

];

const puppeteerConfig = {
  headless: true,
  args: puppeteerArgs
};

// If custom Chromium executable path is specified (e.g. on Render Linux)
if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
} else if (process.platform === 'win32') {
  // Auto-detect installed Chrome or Edge on Windows
  const candidateWindowsPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const browserPath of candidateWindowsPaths) {
    if (fs.existsSync(browserPath)) {
      puppeteerConfig.executablePath = browserPath;
      console.log(`🧭 Auto-detected Windows browser for Puppeteer: ${browserPath}`);
      break;
    }
  }
} else if (process.platform === 'linux') {
  // Auto-detect installed Chromium on Linux
  const candidateLinuxPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome'
  ];
  for (const browserPath of candidateLinuxPaths) {
    if (fs.existsSync(browserPath)) {
      puppeteerConfig.executablePath = browserPath;
      console.log(`🧭 Auto-detected Linux Chromium for Puppeteer: ${browserPath}`);
      break;
    }
  }
}

console.log('🔄 Initializing WhatsApp Client for Asaba Chop & Grill...');

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth'
  }),
  puppeteer: puppeteerConfig
});

// Event: QR Code Received
client.on('qr', async (qr) => {
  global.qrCode = qr;
  global.isReady = false;
  console.log('📲 [WhatsApp] QR Code received! Scan it from WhatsApp > Linked Devices:');

  // Generate Data URL for direct HTML rendering
  try {
    global.qrDataUrl = await qrcode.toDataURL(qr);
  } catch (err) {
    console.error('Error generating QR DataURL:', err.message);
  }

  // Print small ascii QR to terminal if possible
  qrcode.toString(qr, { type: 'terminal', small: true }, (err, url) => {
    if (!err) console.log(url);
  });
});

// Event: Client Ready
client.on('ready', () => {
  global.isReady = true;
  global.qrCode = null;
  global.qrDataUrl = null;
  console.log('✅ [WhatsApp] Client is READY! Asaba Chop & Grill bot is actively taking orders.');
});

// Event: Authenticated
client.on('authenticated', () => {
  console.log('🔐 [WhatsApp] Authentication successful!');
});

// Event: Auth Failure
client.on('auth_failure', (msg) => {
  console.error('❌ [WhatsApp] Auth failure:', msg);
  global.isReady = false;
});

// Event: Disconnected
client.on('disconnected', (reason) => {
  console.warn('⚠️ [WhatsApp] Client disconnected:', reason);
  global.isReady = false;
  global.qrCode = null;
  global.qrDataUrl = null;
  // Attempt to re-initialize after delay
  setTimeout(() => {
    console.log('🔄 Re-initializing WhatsApp client...');
    client.initialize().catch(e => console.error('Re-init error:', e.message));
  }, 5000);
});

// Event: Incoming Message
client.on('message', async (msg) => {
  try {
    await handleMessage(msg, client);
  } catch (error) {
    console.error('Error in message listener:', error);
  }
});

// Initialize WhatsApp client
client.initialize().catch(err => {
  console.error('⚠️ WhatsApp client initialization error:', err.message);
  console.log('Server will continue running dashboard. WhatsApp will retry on connect.');
});

// ==========================================
// REST API ROUTES
// ==========================================

/**
 * GET /api/qr
 * Returns current QR string, dataUrl, readiness status, and bot pause state
 */
app.get('/api/qr', (req, res) => {
  res.json({
    qr: global.qrCode,
    qrDataUrl: global.qrDataUrl,
    ready: Boolean(global.isReady),
    paused: Boolean(global.botPaused)
  });
});

/**
 * GET /api/menu
 * Returns all menu items
 */
app.get('/api/menu', (req, res) => {
  try {
    if (!fs.existsSync(MENU_PATH)) {
      return res.json([]);
    }
    const data = JSON.parse(fs.readFileSync(MENU_PATH, 'utf8'));
    res.json(data);
  } catch (err) {
    console.error('Error fetching menu:', err.message);
    res.status(500).json({ error: 'Failed to read menu items' });
  }
});

/**
 * POST /api/menu/toggle/:id
 * Toggle an item's availability (in stock / out of stock)
 */
app.post('/api/menu/toggle/:id', (req, res) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (!fs.existsSync(MENU_PATH)) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    const menu = JSON.parse(fs.readFileSync(MENU_PATH, 'utf8'));
    const itemIndex = menu.findIndex(i => i.id === itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Toggle availability
    menu[itemIndex].available = !menu[itemIndex].available;
    fs.writeFileSync(MENU_PATH, JSON.stringify(menu, null, 2), 'utf8');

    res.json({
      success: true,
      item: menu[itemIndex]
    });
  } catch (err) {
    console.error('Error toggling menu item:', err.message);
    res.status(500).json({ error: 'Failed to toggle menu item' });
  }
});

/**
 * GET /api/orders
 * Returns all orders sorted newest first
 */
app.get('/api/orders', (req, res) => {
  try {
    if (!fs.existsSync(ORDERS_PATH)) {
      return res.json([]);
    }
    const orders = JSON.parse(fs.readFileSync(ORDERS_PATH, 'utf8'));
    res.json(orders);
  } catch (err) {
    console.error('Error reading orders:', err.message);
    res.status(500).json({ error: 'Failed to read orders' });
  }
});

/**
 * POST /api/orders/status (or /api/orders/:id/status)
 * Update status (New -> Cooking -> Ready -> Delivered)
 * AND automatically send WhatsApp notification to customer!
 */
app.post('/api/orders/status', async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;
    if (!orderId || !newStatus) {
      return res.status(400).json({ error: 'orderId and newStatus are required' });
    }

    if (!fs.existsSync(ORDERS_PATH)) {
      return res.status(404).json({ error: 'Orders file not found' });
    }

    const orders = JSON.parse(fs.readFileSync(ORDERS_PATH, 'utf8'));
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      return res.status(404).json({ error: `Order #${orderId} not found` });
    }

    const previousStatus = orders[orderIndex].status;
    orders[orderIndex].status = newStatus;
    orders[orderIndex].updatedAt = new Date().toISOString();

    fs.writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2), 'utf8');

    // Notify customer on WhatsApp if client is ready
    let customerNotified = false;
    const customerPhone = orders[orderIndex].phone;

    if (global.isReady && customerPhone) {
      let statusMessage = '';
      const itemsList = orders[orderIndex].itemsSummary || 'your meal';

      if (newStatus === 'Cooking') {
        statusMessage = `👨‍🍳 *Update for Order #${orderId}:*
Your food (*${itemsList}*) is now cooking hot on the grill in our Asaba kitchen! 🔥 We're preparing it fresh for you.`;
      } else if (newStatus === 'Ready') {
        statusMessage = `🥡 *Update for Order #${orderId}:*
Good news! Your order (*${itemsList}*) is packaged and ready. Our dispatch rider has picked it up and is heading towards *${orders[orderIndex].location}*! 🛵💨`;
      } else if (newStatus === 'Delivered') {
        statusMessage = `🎉 *Update for Order #${orderId}:*
Your order has been *DELIVERED*! 
Enjoy your meal and thank you for choosing *Asaba Chop & Grill*. Have a great day in Asaba! 🍗🥂
_To order again anytime, just say 'menu'._`;
      } else if (newStatus === 'New') {
        statusMessage = `ℹ️ *Update for Order #${orderId}:*
Your order status has been set to *New*. Kitchen team will begin preparation shortly.`;
      }

      if (statusMessage) {
        try {
          await client.sendMessage(customerPhone, statusMessage);
          customerNotified = true;
          console.log(`[WhatsApp Notification] Sent status '${newStatus}' for order #${orderId} to ${customerPhone}`);
        } catch (sendErr) {
          console.error(`Failed to send WhatsApp message to ${customerPhone}:`, sendErr.message);
        }
      }
    }

    res.json({
      success: true,
      order: orders[orderIndex],
      customerNotified
    });
  } catch (err) {
    console.error('Error updating order status:', err.message);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * POST /api/toggle
 * Toggle Pause/Resume bot for personal chat safety
 */
app.post('/api/toggle', (req, res) => {
  global.botPaused = !global.botPaused;
  console.log(`🤖 Bot Auto-Reply ${global.botPaused ? 'PAUSED' : 'RESUMED'} by dashboard.`);
  res.json({
    success: true,
    paused: global.botPaused
  });
});

/**
 * POST /api/orders/simulate
 * Useful for testing: simulates an incoming Asaba resident order
 */
app.post('/api/orders/simulate', (req, res) => {
  try {
    const locations = ['Summit Road', 'Nnebisi Road', 'Okpanam Road', 'Anwai Road', 'Cable Point', 'Infant Jesus'];
    const sampleItems = [
      [{ id: 1, name: 'Chicken Suya (Full Chicken)', price: 5000 }],
      [{ id: 3, name: 'BBQ Fish (Croaker) + Chips', price: 6500 }, { id: 18, name: 'Coke 50cl', price: 400 }],
      [{ id: 6, name: 'Chicken Pepper Soup', price: 3500 }, { id: 10, name: 'Jollof Rice + Chicken', price: 2800 }],
      [{ id: 2, name: 'Asun (Spicy Goat Meat)', price: 4000 }, { id: 19, name: 'Malt / Fanta / Sprite', price: 400 }],
      [{ id: 16, name: 'Banga Soup + Starch', price: 3000 }]
    ];
    const spiceLevels = ['Medium spicy', 'Extra Hot with onions', 'Mild spice', 'Normal spice + cold drink'];

    const chosenItems = sampleItems[Math.floor(Math.random() * sampleItems.length)];
    const chosenLoc = locations[Math.floor(Math.random() * locations.length)];
    const chosenSpice = spiceLevels[Math.floor(Math.random() * spiceLevels.length)];
    const qty = Math.floor(Math.random() * 2) + 1;
    const total = chosenItems.reduce((acc, curr) => acc + curr.price, 0) * qty;

    const orderId = `A${Math.floor(100 + Math.random() * 900)}`;
    const randomPhone = `23480${Math.floor(10000000 + Math.random() * 90000000)}`;

    const newOrder = {
      id: orderId,
      phone: `${randomPhone}@c.us`,
      customerPhone: randomPhone,
      items: chosenItems,
      itemsSummary: chosenItems.map(i => i.name).join(' + '),
      qty: qty,
      spicy: chosenSpice,
      location: chosenLoc,
      total: total,
      time: new Date().toISOString(),
      status: 'New'
    };

    const orders = fs.existsSync(ORDERS_PATH) ? JSON.parse(fs.readFileSync(ORDERS_PATH, 'utf8')) : [];
    orders.unshift(newOrder);
    fs.writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2), 'utf8');

    res.json({ success: true, order: newOrder });
  } catch (err) {
    console.error('Error simulating order:', err.message);
    res.status(500).json({ error: 'Failed to simulate order' });
  }
});

/**
 * Root Route: Serve Asaba Resident Dashboard
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express HTTP Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Asaba Chop & Grill server is running at http://localhost:${PORT}`);
  console.log(`📍 Serving Asaba Residents: Summit, Nnebisi, Okpanam, Anwai, Cable Point & Infant Jesus`);
});

// Export client and app for tests/scripts if needed
module.exports = { app, client };
