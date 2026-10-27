/**
 * Asaba Chop & Grill - Dashboard Client Application
 * Real-time QR polling, live orders table, WhatsApp customer status notification,
 * and menu availability management.
 */

// Global state
let currentOrders = [];
let currentMenu = [];
let currentCategoryFilter = 'all';
let currentSearchQuery = '';
let currentOrderFilter = 'all';
let isBotPaused = false;
let isBotReady = false;
let lastQrString = null;
let soundEnabled = true;
let previousOrderCount = -1;

// DOM Elements
const qrCanvas = document.getElementById('qrCanvas');
const qrLoadingState = document.getElementById('qrLoadingState');
const qrConnectedState = document.getElementById('qrConnectedState');

const botConnectionBadge = document.getElementById('botConnectionBadge');
const botStatusText = document.getElementById('botStatusText');
const botPauseBadge = document.getElementById('botPauseBadge');
const botPauseText = document.getElementById('botPauseText');
const toggleBotBtn = document.getElementById('toggleBotBtn');
const toggleBotBtnText = document.getElementById('toggleBotBtnText');

const statTotalOrders = document.getElementById('statTotalOrders');
const statActiveOrders = document.getElementById('statActiveOrders');
const statDeliveredOrders = document.getElementById('statDeliveredOrders');
const statTotalSales = document.getElementById('statTotalSales');
const orderCountBadge = document.getElementById('orderCountBadge');

const ordersTableBody = document.getElementById('ordersTableBody');
const menuTableBody = document.getElementById('menuTableBody');
const menuSearchInput = document.getElementById('menuSearchInput');
const liveClock = document.getElementById('liveClock');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  startLiveClock();
  
  // Initial data fetches
  fetchQrStatus();
  fetchMenu();
  fetchOrders();

  // Periodic polling:
  // QR status every 3 seconds
  setInterval(fetchQrStatus, 3000);
  // Orders & Menu every 4 seconds
  setInterval(fetchOrders, 4000);
});

/**
 * Setup UI Event Listeners
 */
function setupEventListeners() {
  // Toggle Bot Pause/Resume
  toggleBotBtn.addEventListener('click', handleToggleBot);

  // Menu Search
  menuSearchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.toLowerCase().trim();
    renderMenu();
  });

  // Menu Category Filter Pills
  const catPills = document.querySelectorAll('#menuCategoryPills .filter-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategoryFilter = pill.getAttribute('data-category');
      renderMenu();
    });
  });

  // Order Status Filter Pills
  const orderPills = document.querySelectorAll('#orderFilterPills .filter-pill');
  orderPills.forEach(pill => {
    pill.addEventListener('click', () => {
      orderPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentOrderFilter = pill.getAttribute('data-filter');
      renderOrders();
    });
  });

  // Simulate Order Button
  const simulateBtn = document.getElementById('simulateOrderBtn');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', handleSimulateOrder);
  }

  // Sound Toggle Button
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundBtn.innerHTML = soundEnabled 
        ? '<i class="fa-solid fa-volume-high"></i> Sound: ON' 
        : '<i class="fa-solid fa-volume-xmark"></i> Sound: OFF';
      showToast(`Audio alerts turned ${soundEnabled ? 'ON' : 'OFF'}`, 'info');
      if (soundEnabled) playChime();
    });
  }
}

/**
 * Live Clock for Asaba local time
 */
function startLiveClock() {
  function updateTime() {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString([], { hour12: false });
  }
  updateTime();
  setInterval(updateTime, 1000);
}

/**
 * Poll QR code and connection status from /api/qr
 */
async function fetchQrStatus() {
  try {
    const res = await fetch('/api/qr');
    if (!res.ok) return;
    const data = await res.json();

    isBotReady = Boolean(data.ready);
    isBotPaused = Boolean(data.paused);

    // Update Bot Pause UI
    updatePauseUI(isBotPaused);

    // Update WhatsApp Connection UI
    if (isBotReady) {
      botConnectionBadge.className = 'status-pill status-connected';
      botStatusText.textContent = 'WhatsApp Connected';
      
      qrLoadingState.classList.add('hidden');
      qrCanvas.classList.add('hidden');
      qrConnectedState.classList.remove('hidden');
      lastQrString = null;
    } else if (data.qr) {
      botConnectionBadge.className = 'status-pill status-pending';
      botStatusText.textContent = 'Scan QR Needed';

      qrLoadingState.classList.add('hidden');
      qrConnectedState.classList.add('hidden');
      qrCanvas.classList.remove('hidden');

      // Re-render QR only if changed
      if (data.qr !== lastQrString) {
        lastQrString = data.qr;
        if (window.QRCode) {
          QRCode.toCanvas(qrCanvas, data.qr, {
            width: 220,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' }
          }, (err) => {
            if (err) console.error('QRCode rendering error:', err);
          });
        }
      }
    } else {
      // Waiting for QR or initializing
      botConnectionBadge.className = 'status-pill status-disconnected';
      botStatusText.textContent = 'Initializing WhatsApp...';
      
      qrCanvas.classList.add('hidden');
      qrConnectedState.classList.add('hidden');
      qrLoadingState.classList.remove('hidden');
    }

  } catch (err) {
    console.warn('QR poll error:', err.message);
  }
}

/**
 * Update UI according to bot pause state
 */
function updatePauseUI(paused) {
  if (paused) {
    botPauseBadge.className = 'status-pill status-paused';
    botPauseText.textContent = 'Bot Paused (Safe)';
    toggleBotBtn.className = 'btn btn-danger';
    toggleBotBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Resume Bot</span>';
  } else {
    botPauseBadge.className = 'status-pill status-active';
    botPauseText.textContent = 'Bot Active';
    toggleBotBtn.className = 'btn btn-warning';
    toggleBotBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Pause Bot</span>';
  }
}

/**
 * Handle Owner toggle for Pause / Resume
 */
async function handleToggleBot() {
  try {
    const res = await fetch('/api/toggle', { method: 'POST' });
    const data = await res.json();
    isBotPaused = data.paused;
    updatePauseUI(isBotPaused);

    if (isBotPaused) {
      showToast('Bot auto-reply paused. Personal WhatsApp chats are safe.', 'info');
    } else {
      showToast('Bot resumed! Taking orders automatically.', 'success');
    }
  } catch (err) {
    showToast('Failed to toggle bot status', 'error');
  }
}

/**
 * Fetch 20-item menu from /api/menu
 */
async function fetchMenu() {
  try {
    const res = await fetch('/api/menu');
    if (!res.ok) return;
    currentMenu = await res.json();
    renderMenu();
  } catch (err) {
    console.error('Fetch menu failed:', err);
  }
}

/**
 * Render Menu Table with Category Filter & Search
 */
function renderMenu() {
  if (!currentMenu || currentMenu.length === 0) {
    menuTableBody.innerHTML = `<tr><td colspan="6" class="empty-table-cell">Loading menu items...</td></tr>`;
    return;
  }

  let filtered = currentMenu.filter(item => {
    const matchesCategory = currentCategoryFilter === 'all' || 
      item.category.toLowerCase() === currentCategoryFilter.toLowerCase();
    
    const matchesSearch = !currentSearchQuery || 
      item.name.toLowerCase().includes(currentSearchQuery) ||
      item.category.toLowerCase().includes(currentSearchQuery) ||
      String(item.id).includes(currentSearchQuery);

    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    menuTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-table-cell">
          <div class="empty-state">
            <i class="fa-solid fa-utensils"></i>
            <p>No menu items match your search.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  menuTableBody.innerHTML = filtered.map(item => {
    return `
      <tr>
        <td><strong>#${item.id}</strong></td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(item.name)}</div>
          ${item.desc ? `<small style="color: var(--text-dim); font-size: 0.76rem;">${escapeHtml(item.desc)}</small>` : ''}
        </td>
        <td>
          <span class="category-badge">${escapeHtml(item.category)}</span>
        </td>
        <td>
          <span style="font-weight: 700; color: #fff;">₦${item.price.toLocaleString()}</span>
        </td>
        <td>
          <span class="badge-stock ${item.available ? 'badge-available' : 'badge-soldout'}">
            ${item.available ? '● Available' : '○ Sold Out'}
          </span>
        </td>
        <td style="text-align: center;">
          <label class="toggle-switch" title="Toggle availability">
            <input type="checkbox" ${item.available ? 'checked' : ''} onchange="toggleItemAvailability(${item.id})">
            <span class="toggle-slider"></span>
          </label>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Toggle menu item availability
 */
window.toggleItemAvailability = async function(itemId) {
  try {
    const res = await fetch(`/api/menu/toggle/${itemId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      // Update local state
      const idx = currentMenu.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        currentMenu[idx] = data.item;
        renderMenu();
        const statusWord = data.item.available ? 'available' : 'marked SOLD OUT';
        showToast(`${data.item.name} is now ${statusWord}!`, 'success');
      }
    }
  } catch (err) {
    showToast('Failed to toggle item availability', 'error');
  }
};

/**
 * Web Audio API synthesizer for kitchen chime (No external audio file needed)
 */
function playChime() {
  if (!soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Pleasant dual-tone bell chime
    const playTone = (freq, time, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + duration);
    };

    const now = ctx.currentTime;
    playTone(587.33, now, 0.4);       // D5
    playTone(880.00, now + 0.15, 0.6); // A5
  } catch (e) {
    // Audio context may require user interaction first
  }
}

/**
 * Simulate an incoming order from Asaba resident
 */
async function handleSimulateOrder() {
  try {
    const res = await fetch('/api/orders/simulate', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Simulated Order #${data.order.id} added for ${data.order.location}!`, 'success');
      await fetchOrders();
      playChime();
    }
  } catch (err) {
    showToast('Failed to simulate order', 'error');
  }
}

/**
 * Fetch live customer orders from /api/orders
 */
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) return;
    const orders = await res.json();
    
    // Detect new orders and chime
    if (previousOrderCount !== -1 && orders.length > previousOrderCount) {
      playChime();
      const newest = orders[0];
      showToast(`🔔 New Order #${newest.id} from ${newest.location}!`, 'success');
    }
    previousOrderCount = orders.length;

    currentOrders = orders;
    updateStats(orders);
    renderOrders();
  } catch (err) {
    console.error('Fetch orders failed:', err);
  }
}

/**
 * Update Header Summary Statistics
 */
function updateStats(orders) {
  const total = orders.length;
  const active = orders.filter(o => o.status === 'New' || o.status === 'Cooking' || o.status === 'Ready').length;
  const delivered = orders.filter(o => o.status === 'Delivered').length;
  const sales = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  statTotalOrders.textContent = total;
  statActiveOrders.textContent = active;
  statDeliveredOrders.textContent = delivered;
  statTotalSales.textContent = `₦${sales.toLocaleString()}`;
  orderCountBadge.textContent = `${total} ${total === 1 ? 'Order' : 'Orders'}`;
}

/**
 * Render Orders Table
 */
function renderOrders() {
  if (!currentOrders || currentOrders.length === 0) {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-table-cell">
          <div class="empty-state">
            <i class="fa-solid fa-receipt"></i>
            <p>No orders yet today.</p>
            <small>When customers in Asaba WhatsApp the bot with <em>"order 1"</em>, orders will instantly appear here!</small>
          </div>
        </td>
      </tr>`;
    return;
  }

  let filtered = currentOrders;
  if (currentOrderFilter !== 'all') {
    filtered = currentOrders.filter(o => o.status.toLowerCase() === currentOrderFilter.toLowerCase());
  }

  if (filtered.length === 0) {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-table-cell">
          <div class="empty-state">
            <i class="fa-solid fa-filter"></i>
            <p>No orders with status "${currentOrderFilter}".</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  ordersTableBody.innerHTML = filtered.map(order => {
    const cleanPhone = (order.customerPhone || order.phone || '').replace('@c.us', '');
    const timeFormatted = order.time ? new Date(order.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
    
    return `
      <tr>
        <td>
          <span class="order-id-badge">#${escapeHtml(order.id)}</span>
        </td>
        <td>
          <div class="customer-phone">
            <i class="fa-brands fa-whatsapp phone-icon"></i>
            <span>${escapeHtml(cleanPhone)}</span>
          </div>
        </td>
        <td>
          <div class="items-tag">${escapeHtml(order.itemsSummary || 'Food items')}</div>
        </td>
        <td>
          <span style="font-weight: 700;">${order.qty || 1} pack</span>
        </td>
        <td>
          <span style="font-size: 0.82rem; color: #cbd5e1;">${escapeHtml(order.spicy || 'Standard')}</span>
        </td>
        <td>
          <span class="location-tag">
            <i class="fa-solid fa-location-dot text-amber"></i>
            ${escapeHtml(order.location || 'Asaba')}
          </span>
        </td>
        <td>
          <span class="total-amount">₦${(order.total || 0).toLocaleString()}</span>
        </td>
        <td>
          <span style="font-size: 0.8rem; color: var(--text-dim);">${timeFormatted}</span>
        </td>
        <td>
          <!-- Status buttons: New -> Cooking -> Ready -> Delivered -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <div class="status-btn-group">
              <button 
                class="status-step-btn ${order.status === 'New' ? 'current-new' : ''}" 
                onclick="updateOrderStatus('${order.id}', 'New')"
                title="Set to New">
                New
              </button>
              <button 
                class="status-step-btn ${order.status === 'Cooking' ? 'current-cooking' : ''}" 
                onclick="updateOrderStatus('${order.id}', 'Cooking')"
                title="Set to Cooking & notify WhatsApp">
                Cooking
              </button>
              <button 
                class="status-step-btn ${order.status === 'Ready' ? 'current-ready' : ''}" 
                onclick="updateOrderStatus('${order.id}', 'Ready')"
                title="Set to Ready & notify WhatsApp">
                Ready
              </button>
              <button 
                class="status-step-btn ${order.status === 'Delivered' ? 'current-delivered' : ''}" 
                onclick="updateOrderStatus('${order.id}', 'Delivered')"
                title="Set to Delivered & notify WhatsApp">
                Delivered
              </button>
            </div>
            <button class="status-step-btn" style="background: rgba(255, 255, 255, 0.05); padding: 5px 8px;" onclick="printOrderTicket('${order.id}')" title="Print kitchen receipt / dispatch slip">
              <i class="fa-solid fa-print"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Print dispatch slip / kitchen ticket
 */
window.printOrderTicket = function(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order) return;

  const printWindow = window.open('', '_blank', 'width=420,height=600');
  const printDoc = printWindow.document;

  const cleanPhone = (order.customerPhone || order.phone || '').replace('@c.us', '');
  const dateStr = order.time ? new Date(order.time).toLocaleString() : new Date().toLocaleString();

  printDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dispatch Ticket #${order.id} - Asaba Chop & Grill</title>
      <style>
        body { font-family: monospace; font-size: 13px; margin: 20px; line-height: 1.4; color: #000; }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        .title { font-size: 16px; font-weight: bold; }
        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .total { font-size: 15px; font-weight: bold; }
        .badge { border: 1px solid #000; padding: 2px 6px; display: inline-block; font-weight: bold; }
      </style>
    </head>
    <body onload="window.print();">
      <div class="center">
        <div class="title">ASABA CHOP & GRILL</div>
        <div>Kitchen & Dispatch Order Slip</div>
        <div>Asaba, Delta State</div>
        <div class="divider"></div>
        <div class="badge">ORDER #${order.id}</div>
      </div>
      <div class="divider"></div>
      <div class="row"><span>Date:</span> <span>${dateStr}</span></div>
      <div class="row"><span>Customer:</span> <span>${cleanPhone}</span></div>
      <div class="row"><span>Status:</span> <span>${order.status.toUpperCase()}</span></div>
      <div class="divider"></div>
      <div><strong>ITEMS ORDERED:</strong></div>
      <div style="margin: 6px 0;">${order.itemsSummary || 'Food items'}</div>
      <div class="row"><span>Packs:</span> <span>${order.qty || 1} pack</span></div>
      <div class="row"><span>Spice / Notes:</span> <span>${order.spicy || 'Standard'}</span></div>
      <div class="divider"></div>
      <div><strong>DELIVERY DESTINATION:</strong></div>
      <div style="font-size: 14px; font-weight: bold; margin: 4px 0;">${order.location}</div>
      <div class="divider"></div>
      <div class="row total">
        <span>TOTAL TO COLLECT:</span>
        <span>₦${(order.total || 0).toLocaleString()}</span>
      </div>
      <div class="divider"></div>
      <div class="center">
        <small>Payment: Cash / Transfer to Rider<br>Thank you for choosing Asaba Chop & Grill!</small>
      </div>
    </body>
    </html>
  `);
  printDoc.close();
};

/**
 * Update Order Status and send WhatsApp message to customer automatically
 */
window.updateOrderStatus = async function(orderId, newStatus) {
  try {
    const res = await fetch('/api/orders/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, newStatus })
    });

    const data = await res.json();
    if (data.success) {
      // Update local state
      const idx = currentOrders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        currentOrders[idx] = data.order;
        renderOrders();
        updateStats(currentOrders);
      }

      const notifyMsg = data.customerNotified 
        ? 'Customer automatically notified on WhatsApp!' 
        : '(Bot offline or customer phone missing)';
      
      showToast(`Order #${orderId} marked as ${newStatus}! ${notifyMsg}`, 'success');
    } else {
      showToast(data.error || 'Failed to update order', 'error');
    }
  } catch (err) {
    showToast('Failed to update order status', 'error');
  }
};

/**
 * Toast Notification system
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <div>${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Simple HTML escape utility
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
