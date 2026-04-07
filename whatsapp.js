const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

let client = null;
let status = 'disconnected'; // disconnected | qr | connecting | ready
let currentQrDataUrl = null;
let lastQrString = null;

function formatPrice(price) {
  if (!price) return 'Prijs onbekend';
  return `€ ${price.toLocaleString('nl-NL')} k.k.`;
}

function formatMessage(listing) {
  const lines = [
    `🏠 *Nieuwe woning in Maastricht!*`,
    ``,
    `📍 *${listing.address || listing.title || 'Adres onbekend'}*`,
    `💰 ${formatPrice(listing.price)}`,
  ];

  if (listing.rooms) lines.push(`🛏 ${listing.rooms} kamers`);
  if (listing.surface) lines.push(`📐 ${listing.surface} m²`);
  if (listing.agent) lines.push(`🏢 ${listing.agent}`);

  lines.push(``);
  lines.push(`🔗 ${listing.url}`);

  return lines.join('\n');
}

async function initWhatsApp() {
  if (client) return;

  console.log('[WhatsApp] Client starten...');
  status = 'connecting';

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  client.on('qr', async (qr) => {
    status = 'qr';
    lastQrString = qr;
    console.log('\n[WhatsApp] Scan deze QR-code met je telefoon:');
    qrcodeTerminal.generate(qr, { small: true });
    console.log('[WhatsApp] Of ga naar http://localhost:3000 om de QR-code te scannen.\n');

    try {
      currentQrDataUrl = await qrcode.toDataURL(qr);
    } catch (e) {
      console.error('[WhatsApp] QR generatie fout:', e.message);
    }
  });

  client.on('authenticated', () => {
    console.log('[WhatsApp] Geverifieerd!');
    status = 'connecting';
    currentQrDataUrl = null;
  });

  client.on('ready', () => {
    console.log('[WhatsApp] Klaar om berichten te sturen!');
    status = 'ready';
    currentQrDataUrl = null;
  });

  client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Authenticatie mislukt:', msg);
    status = 'disconnected';
    client = null;
  });

  client.on('disconnected', (reason) => {
    console.log('[WhatsApp] Verbinding verbroken:', reason);
    status = 'disconnected';
    client = null;
    currentQrDataUrl = null;
  });

  await client.initialize();
}

async function sendListing(phoneNumber, listing) {
  if (status !== 'ready' || !client) {
    console.log('[WhatsApp] Niet verbonden, bericht niet verstuurd.');
    return false;
  }

  try {
    // WhatsApp number format: 31612345678@c.us (no leading +)
    const chatId = phoneNumber.replace(/^\+/, '').replace(/\D/g, '') + '@c.us';
    const message = formatMessage(listing);
    await client.sendMessage(chatId, message);
    console.log(`[WhatsApp] Bericht verstuurd: ${listing.address || listing.id}`);
    return true;
  } catch (error) {
    console.error('[WhatsApp] Versturen mislukt:', error.message);
    return false;
  }
}

function getStatus() {
  return status;
}

function getQrDataUrl() {
  return currentQrDataUrl;
}

module.exports = { initWhatsApp, sendListing, getStatus, getQrDataUrl };
