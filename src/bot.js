/**
 * Asaba Chop & Grill - WhatsApp Bot Logic
 * Specially designed for Asaba residents ordering food delivery in Asaba, Delta State.
 */
const fs = require('fs');
const path = require('path');
const { getGeminiReply } = require('./gemini');

// In-memory state for multi-step order flow
// Format: pendingOrders[senderPhone] = { items: [...], qty: 1, spicy: '', location: '', step: 'qty' }
const pendingOrders = {};

const MENU_FILE = path.join(__dirname, '../data/menu.json');
const ORDERS_FILE = path.join(__dirname, '../data/orders.json');

/**
 * Helper to safely read menu items
 */
function getMenu() {
  try {
    if (!fs.existsSync(MENU_FILE)) return [];
    const data = fs.readFileSync(MENU_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading menu.json:', err.message);
    return [];
  }
}

/**
 * Helper to safely read existing orders
 */
function getOrders() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    const data = fs.readFileSync(ORDERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading orders.json:', err.message);
    return [];
  }
}

/**
 * Helper to safely save orders
 */
function saveOrders(orders) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving orders.json:', err.message);
  }
}

/**
 * Generate full menu string formatted for WhatsApp
 */
function getFullMenuText() {
  return `🍗 *ASABA CHOP & GRILL - For Asaba Residents*
We deliver hot food across Asaba!

-- *BBQ* --
1. Chicken Suya Full - N5000
2. Asun - N4000
3. BBQ Fish + Chips - N6500
4. Ram Suya 10 sticks - N3500
5. Turkey BBQ 2pcs - N4500

-- *PEPPER SOUP* --
6. Chicken Pepper Soup - N3500
7. Goat Meat Pepper Soup - N4000
8. Catfish + Agidi - N5000
9. Assorted Pepper Soup - N4500

-- *RICE* --
10. Jollof + Chicken - N2800
11. White Rice + Stew + Beef - N2500
12. Fried Rice + Chicken - N3000
13. Rice & Beans + Plantain - N2200

-- *LOCAL* --
14. Abacha + Fish - N1800
15. Okpa + Coke - N1200
16. Banga + Starch - N3000
17. Ofe Nsala - N3500

-- *DRINKS* --
18. Coke - N400
19. Malt/Fanta/Sprite - N400
20. Water - N300

*How to order:* 'order 1' or 'order 6 and 10' 
Or type *'bbq menu'* / *'pepper soup menu'* / *'rice menu'* / *'drinks menu'* / *'local menu'* / *'soup menu'* for filtered menu.
*Delivery:* Summit, Nnebisi, Okpanam, Anwai, Cable, Infant Jesus`;
}

/**
 * Filtered menu text based on category
 */
function getFilteredMenuText(categoryName) {
  const menu = getMenu();
  const filtered = menu.filter(item => item.category.toLowerCase().includes(categoryName.toLowerCase()));
  
  if (filtered.length === 0) {
    return `No items found under ${categoryName}. Type *menu* to see all items!`;
  }

  let text = `🍗 *ASABA CHOP & GRILL - ${categoryName.toUpperCase()} MENU*\n\n`;
  filtered.forEach(item => {
    const status = item.available ? '' : ' _(Currently Sold Out)_';
    text += `${item.id}. ${item.name} - N${item.price}${status}\n`;
  });

  text += `\n*How to order:* Type 'order ${filtered[0].id}' to order now!\n*Delivery:* Summit, Nnebisi, Okpanam, Anwai, Cable Point, Infant Jesus`;
  return text;
}

/**
 * Main message handler for incoming WhatsApp messages
 * @param {object} message - WhatsApp Web message object
 * @param {object} client - WhatsApp client instance
 */
async function handleMessage(message, client) {
  try {
    // 1. SAFETY CHECKS
    // If bot is paused by owner from dashboard, don't reply
    if (global.botPaused) {
      console.log('Bot is paused by owner. Message ignored.');
      return;
    }

    // Ignore self messages
    if (message.fromMe) return;

    // Ignore WhatsApp groups (@g.us) and status broadcasts
    const from = message.from;
    if (!from || from.includes('@g.us') || from.includes('status@broadcast') || from.endsWith('@broadcast')) {
      return;
    }

    const rawBody = (message.body || '').trim();
    if (!rawBody) return;

    const lowerBody = rawBody.toLowerCase();
    console.log(`[WhatsApp] From: ${from} | Message: "${rawBody}"`);

    // 2. CANCEL / RESET ACTIVE ORDER FLOW
    if (lowerBody === 'cancel' || lowerBody === 'reset' || lowerBody === 'stop') {
      if (pendingOrders[from]) {
        delete pendingOrders[from];
        await message.reply('❌ Your pending order has been cancelled. You can type *menu* whenever you are ready to order again!');
        return;
      }
    }

    // 3. CHECK MULTI-STEP ORDER FLOW FOR USER
    if (pendingOrders[from]) {
      const orderState = pendingOrders[from];

      // STEP 1: QUANTITY
      if (orderState.step === 'qty') {
        // Extract first positive integer from message
        const match = rawBody.match(/\d+/);
        let qty = match ? parseInt(match[0], 10) : 0;

        if (isNaN(qty) || qty <= 0) {
          // Check common word numbers
          if (lowerBody.includes('one')) qty = 1;
          else if (lowerBody.includes('two')) qty = 2;
          else if (lowerBody.includes('three')) qty = 3;
          else if (lowerBody.includes('four')) qty = 4;
          else if (lowerBody.includes('five')) qty = 5;
        }

        if (!qty || qty <= 0) {
          await message.reply('Please reply with a valid number for packs (e.g. *1*, *2*, or *3* packs), or type *cancel* to exit.');
          return;
        }

        orderState.qty = qty;
        orderState.step = 'spicy';

        await message.reply('🌶️ *How spicy?* Mild / Medium / Extra Hot?\nAnd do you need a cold drink with your order?');
        return;
      }

      // STEP 2: SPICE LEVEL & DRINK NOTE
      if (orderState.step === 'spicy') {
        orderState.spicy = rawBody;
        orderState.step = 'location';

        await message.reply('📍 *Delivery location in Asaba?*\nOptions: Summit Road, Nnebisi, Okpanam, Anwai, Cable Point, or Infant Jesus? (You can add your street name & house number)');
        return;
      }

      // STEP 3: LOCATION & FINAL CONFIRMATION
      if (orderState.step === 'location') {
        orderState.location = rawBody;

        // Calculate total amount
        const itemTotal = orderState.items.reduce((acc, curr) => acc + (curr.price || 0), 0);
        const grandTotal = itemTotal * orderState.qty;

        // Generate short random order ID: A + 3 random digits
        const randomNum = Math.floor(100 + Math.random() * 900);
        const orderId = `A${randomNum}`;

        const itemNames = orderState.items.map(i => i.name).join(' + ');

        // Save order to orders.json
        const newOrder = {
          id: orderId,
          phone: from,
          customerPhone: from.replace('@c.us', ''),
          items: orderState.items,
          itemsSummary: itemNames,
          qty: orderState.qty,
          spicy: orderState.spicy,
          location: orderState.location,
          total: grandTotal,
          time: new Date().toISOString(),
          status: 'New'
        };

        const allOrders = getOrders();
        allOrders.unshift(newOrder); // newest first
        saveOrders(allOrders);

        // Clear user pending order
        delete pendingOrders[from];

        const confirmationMsg = `✅ *Order #${orderId} confirmed for Asaba delivery!*
━━━━━━━━━━━━━━━━━━
🍛 *Items:* ${itemNames}
📦 *Packs:* ${newOrder.qty}
🌶️ *Spice/Notes:* ${newOrder.spicy}
💰 *Total:* N${grandTotal.toLocaleString()}
📍 *Location:* ${newOrder.location}
━━━━━━━━━━━━━━━━━━
🛵 *Rider go call you in 20mins.*
Pay on delivery or bank transfer. Type *'my order'* to track or *'pay'* for account details.`;

        await message.reply(confirmationMsg);
        return;
      }
    }

    // 4. MENU COMMANDS (hi / hello / menu)
    if (
      lowerBody === 'hi' ||
      lowerBody === 'hello' ||
      lowerBody === 'menu' ||
      lowerBody === 'hey' ||
      lowerBody === 'start' ||
      lowerBody === 'food'
    ) {
      await message.reply(getFullMenuText());
      return;
    }

    // 5. FILTERED MENUS
    if (lowerBody.includes('bbq menu') || lowerBody === 'bbq') {
      await message.reply(getFilteredMenuText('BBQ'));
      return;
    }
    if (lowerBody.includes('pepper soup menu') || lowerBody === 'pepper soup') {
      await message.reply(getFilteredMenuText('Pepper Soup'));
      return;
    }
    if (lowerBody.includes('rice menu') || lowerBody === 'rice') {
      await message.reply(getFilteredMenuText('Rice'));
      return;
    }
    if (lowerBody.includes('local menu') || lowerBody === 'local') {
      await message.reply(getFilteredMenuText('Local'));
      return;
    }
    if (lowerBody.includes('drinks menu') || lowerBody.includes('drink menu') || lowerBody === 'drinks') {
      await message.reply(getFilteredMenuText('Drink'));
      return;
    }
    if (lowerBody.includes('soup menu') || lowerBody === 'soup') {
      await message.reply(getFilteredMenuText('Soup'));
      return;
    }

    // 6. ORDER PARSING: if body starts with "order"
    if (lowerBody.startsWith('order')) {
      const menu = getMenu();
      
      // Extract all numbers mentioned in message (e.g. "order 1", "order 6 and 10", "order 3, 18")
      const matches = rawBody.match(/\b\d+\b/g);
      
      if (!matches || matches.length === 0) {
        await message.reply(`To place an order, please include the menu number.\nExample: *order 1* for Chicken Suya or *order 6 and 10* for Chicken Pepper Soup + Jollof Rice.\n\nType *menu* to see all numbers 1 - 20.`);
        return;
      }

      const selectedIds = [...new Set(matches.map(n => parseInt(n, 10)))];
      const validItems = [];
      const outOfStockItems = [];
      const invalidIds = [];

      for (const id of selectedIds) {
        const item = menu.find(m => m.id === id);
        if (!item) {
          invalidIds.push(id);
        } else if (!item.available) {
          outOfStockItems.push(item.name);
        } else {
          validItems.push(item);
        }
      }

      if (invalidIds.length > 0 && validItems.length === 0) {
        await message.reply(`Items #${invalidIds.join(', ')} do not exist on our menu (1 to 20). Type *menu* to check valid item numbers!`);
        return;
      }

      if (outOfStockItems.length > 0) {
        await message.reply(`Sorry! *${outOfStockItems.join(', ')}* is currently sold out today. Please choose another item or check *menu*.`);
        return;
      }

      if (validItems.length === 0) {
        await message.reply(`No valid menu item found in your order. Type *menu* to see what is cooking!`);
        return;
      }

      // Store pending order state
      const itemNames = validItems.map(i => i.name).join(' & ');
      pendingOrders[from] = {
        items: validItems,
        step: 'qty'
      };

      await message.reply(`How many packs for *${itemNames}*? Reply with number e.g 2 (or type *cancel* anytime).`);
      return;
    }

    // 7. TRACK ORDER: "my order" or "track"
    if (lowerBody.includes('my order') || lowerBody === 'track' || lowerBody.startsWith('track order')) {
      const allOrders = getOrders();
      // Match orders by phone
      const customerOrders = allOrders.filter(o => o.phone === from || (o.customerPhone && from.includes(o.customerPhone)));

      if (customerOrders.length === 0) {
        await message.reply(`🔍 You do not have any active orders right now.\nReady for lunch or dinner? Type *menu* to view our Asaba specials!`);
        return;
      }

      const latest = customerOrders[0];
      const orderDate = new Date(latest.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let statusEmoji = '🍳';
      if (latest.status === 'Cooking') statusEmoji = '🔥';
      if (latest.status === 'Ready') statusEmoji = '🥡';
      if (latest.status === 'Delivered') statusEmoji = '✅';

      const trackText = `📦 *Your Latest Order Details:*
━━━━━━━━━━━━━━━━━━
🆔 *Order ID:* #${latest.id}
🍛 *Items:* ${latest.itemsSummary} (${latest.qty} packs)
📊 *Status:* ${statusEmoji} *${latest.status.toUpperCase()}*
💰 *Total:* N${latest.total.toLocaleString()}
📍 *Destination:* ${latest.location}
🕒 *Time Placed:* ${orderDate}
━━━━━━━━━━━━━━━━━━
_Questions or special instructions? Just chat us here._`;

      await message.reply(trackText);
      return;
    }

    // 8. PAYMENT INFO: "pay" / "payment" / "bank"
    if (lowerBody === 'pay' || lowerBody.includes('payment') || lowerBody.includes('account number') || lowerBody.includes('bank')) {
      const payText = `💳 *Payment Details - Asaba Chop & Grill*
━━━━━━━━━━━━━━━━━━
🏦 *Bank:* Opay
🔢 *Account Number:* 1234567890
👤 *Account Name:* Asaba Chop & Grill

*Delivery Fees:*
• Summit Road: N500
• Nnebisi Road: N700
• Okpanam: N800
• Anwai Road: N600
• Cable Point: N700
• Infant Jesus: N600

_Please send a screenshot or transaction receipt here once done._ 
You can also choose *Pay on Delivery* with cash or transfer to the dispatch rider.`;

      await message.reply(payText);
      return;
    }

    // 9. GEMINI AI FALLBACK
    console.log(`[Gemini AI] Routing message to Gemini assistant: "${rawBody}"`);
    const aiReply = await getGeminiReply(rawBody, from);
    await message.reply(aiReply);

  } catch (error) {
    console.error('Error handling message in bot.js:', error);
    try {
      await message.reply('Sorry, our kitchen bot had a slight hiccup! Please type *menu* to order or check your order.');
    } catch (e) {
      // ignore
    }
  }
}

module.exports = {
  handleMessage,
  pendingOrders
};
