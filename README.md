# 🍗 Asaba Chop & Grill - WhatsApp Ordering Bot

> **Built for Asaba Residents • Complete 20-Item Menu • Hostable on Render.com**

An automated WhatsApp food ordering chatbot and live management dashboard designed specifically for local food delivery in **Asaba, Delta State, Nigeria** (serving *Summit Road, Nnebisi, Okpanam, Anwai Road, Cable Point, and Infant Jesus*).

Built with **Node.js, Express, `whatsapp-web.js` (LocalAuth), QR Code generation, and Google Gemini AI fallback**.

---

## 🌟 Key Features

1. **WhatsApp Web Client (`whatsapp-web.js` v1.23.0)**:
   - Automated order intake and conversation flow.
   - Built-in session persistence with `LocalAuth` (saved in `./.wwebjs_auth`).
   - Group message safety: automatically ignores WhatsApp groups (`@g.us`) and broadcast status updates.
   - **Pause Bot Safety Toggle**: If the owner uses a personal WhatsApp number, you can toggle the bot off with one click from the dashboard to chat privately without bot interference.

2. **Full Asaba Chop & Grill Menu (20 Items)**:
   - **BBQ**: Chicken Suya, Asun, Croaker BBQ Fish + Chips, Ram Suya (10 sticks), Turkey Wings BBQ.
   - **Pepper Soup**: Chicken, Goat Meat, Catfish + Agidi, Assorted.
   - **Rice**: Jollof + Chicken, White Rice + Stew + Beef, Fried Rice + Chicken, Rice & Beans + Plantain + Fish.
   - **Local Delicacies**: Abacha + Ugba + Fish, Okpa + Coke, Banga Soup + Starch, Ofe Nsala + Pounded Yam.
   - **Drinks**: Coke 50cl, Malt / Fanta / Sprite, Water 75cl.

3. **Multi-Step Conversational Order Flow**:
   - Customer types `order 1` or `order 6 and 10`.
   - Bot asks: *"How many packs?"* (user replies e.g. `2`).
   - Bot asks: *"How spicy? Mild / Medium / Extra Hot? And do you need a drink?"*.
   - Bot asks: *"Delivery location in Asaba? Summit, Nnebisi, Okpanam, Anwai, Cable Point, Infant Jesus?"*.
   - Bot saves order with a short ID (`#A123`), calculates the total, records time, and returns full order confirmation with tracking instructions.

4. **Live Asaba Resident Dashboard**:
   - **Live QR Canvas**: Automatically polls `/api/qr` every 3 seconds to display the QR code for instant pairing.
   - **Bot Pause / Resume**: Instant toggle button for personal chat privacy.
   - **Live Orders Table**: Displays Order ID, Customer Phone, Items, Quantity, Spice level, Delivery Location, Total in ₦, and Time.
   - **Order Status Buttons (`New` ➔ `Cooking` ➔ `Ready` ➔ `Delivered`)**: When you click to update order status, the bot **automatically dispatches a WhatsApp notification** to the customer!
   - **Menu Availability Management**: Easily toggle any of the 20 items in or out of stock with immediate real-time effect.

5. **Google Gemini AI Fallback**:
   - If a customer asks a general question or greets the bot casually, Gemini AI responds hospitably with local Asaba context and friendly Nigerian Pidgin touch.

---

## 📁 Project Structure

```text
Chatbot_project/
├── data/
│   ├── menu.json         # Exact 20 Asaba Chop & Grill menu items & availability
│   └── orders.json       # Live persistent customer orders database
├── public/
│   ├── index.html        # Modern Asaba Resident Kitchen Dashboard
│   ├── style.css         # Dark theme with warm grill amber accents
│   └── app.js            # Real-time QR polling, live orders & status updater
├── src/
│   ├── bot.js            # Conversational bot logic, orders parser & safety filters
│   └── gemini.js         # Google Gemini AI wrapper with Asaba menu context
├── .env.example          # Environment variables template
├── .gitignore            # Protects credentials, session auth, and order data
├── Dockerfile            # Optimized Render.com container with pre-installed Chromium
├── index.js              # Express server & whatsapp-web.js client initialization
├── package.json          # Dependencies & Node engines configuration
├── render.yaml           # Blueprint file for Render 1-click deployment
└── README.md             # Complete user guide
```

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js (version 18 or higher recommended).
- Git installed on your system.

### Step 1: Install Dependencies
Open your terminal in the project directory:
```bash
npm install
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your details:
```env
# Optional: Get a free key from https://aistudio.google.com/
GEMINI_API_KEY=your_gemini_api_key_here

PORT=3000
```
*(If no Gemini API key is provided, the bot will still run smoothly and use friendly built-in responses).*

### Step 3: Start the Bot & Server
```bash
npm start
```

### Step 4: Link Your WhatsApp
1. Open your browser and go to: `http://localhost:3000`
2. Open WhatsApp on your mobile phone:
   - **Android**: Tap the 3 dots in the top right ➔ **Linked Devices** ➔ **Link a Device**.
   - **iPhone**: Tap **Settings** ➔ **Linked Devices** ➔ **Link a Device**.
3. Point your camera at the QR code displayed on the dashboard screen.
4. Once scanned, the status badge will switch to **"WhatsApp Connected"**!

---

## ☁️ How to Host Online on Render.com (Free Tier)

Render.com allows you to host this bot online 24/7. Because `whatsapp-web.js` uses Puppeteer (headless browser), we have provided both **Native Node** and **Docker** deployment configurations.

### Recommended Method: Deploy via Docker on Render

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Asaba Chop & Grill bot"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/asaba-chop-grill-bot.git
   git push -u origin main
   ```

2. **Create a Free Web Service on Render**:
   - Log in to [Render.com](https://render.com).
   - Click **New +** ➔ **Web Service**.
   - Connect your GitHub repository.
   - Choose **Docker** as the Runtime environment (Render will automatically detect the included `Dockerfile` which has Chromium pre-installed).
   - Set the instance type to **Free**.

3. **Set Environment Variables in Render Dashboard**:
   - `PORT`: `3000` (or `10000`)
   - `GEMINI_API_KEY`: *(Your Google AI Studio API key)*

4. **Deploy**:
   - Click **Create Web Service**.
   - Render will build the container and deploy the app.
   - Once live, click the URL provided by Render (e.g. `https://asaba-chop-grill-bot.onrender.com`).
   - Open your dashboard URL, scan the QR code using WhatsApp on your phone, and your bot is live online!

---

## 💬 WhatsApp Customer Commands

Customers in Asaba can send any of the following messages:

| Command | Action |
| :--- | :--- |
| `menu` or `hi` or `hello` | Displays the complete 20-item categorized menu with prices and delivery spots. |
| `bbq menu` | Shows only BBQ items (Suya, Asun, BBQ Fish, etc.). |
| `pepper soup menu` | Shows only Pepper Soup options (Catfish, Chicken, Goat meat, etc.). |
| `rice menu` | Shows Jollof, Fried Rice, White Rice, and Rice & Beans. |
| `local menu` | Shows Abacha, Okpa, Banga, and Ofe Nsala. |
| `drinks menu` | Shows soft drinks, malt, and bottled water. |
| `order 1` or `order 6 and 10` | Starts the multi-step ordering flow for Chicken Suya or Pepper Soup + Jollof. |
| `track` or `my order` | Checks the status of the customer's most recent order. |
| `pay` | Returns Opay account details and delivery fees for each Asaba neighborhood. |
| `cancel` | Cancels any active pending order so the user can start over. |

---

## 🛵 Asaba Delivery Coverage & Fees

- **Summit Road**: ₦500
- **Nnebisi Road**: ₦700
- **Okpanam Road**: ₦800
- **Anwai Road / Delsu Campus**: ₦600
- **Cable Point**: ₦700
- **Infant Jesus**: ₦600

Payment is accepted via **Bank Transfer to Opay (1234567890)** or **Cash / Transfer on Delivery**.

---

## 🛡️ Personal Chat & Privacy Protection

If you run this bot on your personal WhatsApp line:
- The bot will **never** reply to group messages.
- The bot will **never** reply to broadcast status updates.
- You can click the **Pause Bot** button on your dashboard anytime to stop automatic replies and chat normally.

---

## 📄 License
ISC © Asaba Chop & Grill
