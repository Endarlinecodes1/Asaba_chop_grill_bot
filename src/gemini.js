/**
 * Gemini AI Helper for Asaba Chop & Grill Bot
 * Provides smart, conversational responses with Asaba local context & food menu knowledge.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

let genAI = null;
let model = null;

function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.warn('⚠️ GEMINI_API_KEY is not set. Bot will use default local responses.');
    return null;
  }
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash which is fast and cost-effective
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    return model;
  } catch (err) {
    console.error('Error initializing Gemini AI:', err.message);
    return null;
  }
}

/**
 * Generate fallback response using Gemini AI
 * @param {string} userMessage - Customer message from WhatsApp
 * @param {string} senderPhone - Customer WhatsApp ID
 * @returns {Promise<string>}
 */
async function getGeminiReply(userMessage, senderPhone = '') {
  try {
    if (!model) {
      model = initGemini();
    }

    if (!model) {
      return getLocalFallback();
    }

    // Load current menu to give Gemini full up-to-date awareness
    let menuContext = '';
    try {
      const menuPath = path.join(__dirname, '../data/menu.json');
      if (fs.existsSync(menuPath)) {
        const menuItems = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
        menuContext = menuItems
          .map(item => `- ID ${item.id}: ${item.name} (₦${item.price.toLocaleString()}) [${item.category}] - ${item.available ? 'Available' : 'Sold Out'}`)
          .join('\n');
      }
    } catch (e) {
      console.warn('Could not load menu for Gemini context:', e.message);
    }

    const systemPrompt = `You are the friendly WhatsApp Bot for "Asaba Chop & Grill", a popular food delivery kitchen in Asaba, Delta State, Nigeria.
You serve Asaba residents with hot BBQ, pepper soup, delicious Nigerian rice, local delicacies (Abacha, Okpa, Banga & Ofe Nsala), and cold drinks.

YOUR PERSONALITY & TONE:
- Warm, polite, hospitable, and energetic.
- Speak natural English blended with friendly Nigerian Pidgin English (e.g. "How far!", "E dey hot!", "No wahala", "Rider dey ready").
- Keep replies concise (2 to 4 sentences max) because this is WhatsApp.

KEY FACTS:
- Fast home and office delivery across Asaba:
  * Summit Road (₦500 delivery)
  * Nnebisi Road (₦700 delivery)
  * Okpanam Road (₦800 delivery)
  * Anwai Road / Delsu Campus (₦600 delivery)
  * Cable Point (₦700 delivery)
  * Infant Jesus (₦600 delivery)
- Payment: Pay on delivery or transfer to Opay 1234567890 (Asaba Chop & Grill).
- How customers order:
  * Type "menu" to see full menu.
  * Type "order [number]" (e.g. "order 1" or "order 6 and 10") to start an order.
  * Type "my order" or "track" to track active order.
  * Type "pay" for bank account details.

CURRENT MENU:
${menuContext}

INSTRUCTIONS:
- Answer the customer's question directly and helpfully.
- If they ask what to eat or how to order, tell them they can reply "menu" to see everything or type "order 1" (e.g. for Chicken Suya).
- Do not make up fake prices or fake locations outside Asaba.
- Keep it short, lively, and WhatsApp-friendly.`;

    const chatPrompt = `${systemPrompt}\n\nCustomer Message: "${userMessage}"\nYour WhatsApp Response:`;

    const result = await model.generateContent(chatPrompt);
    const response = await result.response;
    const text = response.text();

    if (text && text.trim()) {
      return text.trim();
    }
    return getLocalFallback();
  } catch (error) {
    console.error('Gemini API call failed:', error.message);
    return getLocalFallback();
  }
}

/**
 * Standard friendly fallback if Gemini is offline or rate limited
 */
function getLocalFallback() {
  return `👋 Welcome to *Asaba Chop & Grill*! 🍗🔥
We serve hot meals & BBQ across Asaba!

• Type *menu* to see our full 20-item menu
• Type *order 1* or *order 6 and 10* to place an order
• Type *track* or *my order* to check your food status
• Type *pay* for bank transfer details

_Delivery spots: Summit, Nnebisi, Okpanam, Anwai, Cable Point & Infant Jesus._`;
}

module.exports = {
  initGemini,
  getGeminiReply,
  getLocalFallback
};
