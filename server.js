const express = require('express');
const cron = require('node-cron');
const path = require('path');
const db = require('./database');
const { scrapeListings } = require('./scraper');
const { discoverMakelaars } = require('./discover');
const { initWhatsApp, sendListing, getStatus, getQrDataUrl } = require('./whatsapp');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API routes ──────────────────────────────────────────────────────────────

app.get('/api/preferences', (req, res) => {
  res.json(db.getPreferences());
});

app.post('/api/preferences', (req, res) => {
  try {
    db.savePreferences(req.body);
    scheduleScraper(); // herplan cron bij interval wijziging
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    whatsapp: getStatus(),
    qr: getQrDataUrl(),
    lastScan: global.lastScan || null,
    stats: db.getStats(),
  });
});

app.get('/api/listings', (req, res) => {
  res.json(db.getRecentListings(50));
});

app.post('/api/scan', async (req, res) => {
  res.json({ ok: true, message: 'Scan gestart...' });
  runScan();
});

app.get('/api/makelaars', (req, res) => {
  res.json(db.getMakelaars());
});

app.post('/api/makelaars/discover', async (req, res) => {
  res.json({ ok: true, message: 'Ontdekking gestart...' });
  const prefs = db.getPreferences();
  discoverMakelaars(prefs.region || 'Maastricht', prefs.radius || 35);
});

app.post('/api/makelaars', (req, res) => {
  try {
    const { name, website, listings_url, parser, city } = req.body;
    if (!name || !listings_url) return res.status(400).json({ error: 'name en listings_url zijn verplicht' });
    const base = new URL(listings_url).origin;
    db.upsertMakelaar({ name, website: website || base, listings_url, parser: parser || 'generic', city: city || '' });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch('/api/makelaars/:id', (req, res) => {
  const { active } = req.body;
  db.toggleMakelaar(req.params.id, active);
  res.json({ ok: true });
});

app.delete('/api/makelaars/:id', (req, res) => {
  db.deleteMakelaar(req.params.id);
  res.json({ ok: true });
});

// ── Scraper logica ───────────────────────────────────────────────────────────

async function runScan() {
  console.log('\n[Scan] Start scan...');
  global.lastScan = new Date().toISOString();

  const prefs = db.getPreferences();
  if (!prefs.active) {
    console.log('[Scan] Notificaties staan uit, scan overgeslagen.');
    return;
  }

  const listings = await scrapeListings(prefs);

  let newCount = 0;

  for (const listing of listings) {
    if (db.isListingSeen(listing.id)) continue;

    let notified = false;
    if (prefs.phone && getStatus() === 'ready') {
      notified = await sendListing(prefs.phone, listing);
    } else if (!prefs.phone) {
      console.log(`[Scan] Nieuw: ${listing.address || listing.id} — geen telefoonnummer ingesteld`);
    } else {
      console.log(`[Scan] Nieuw: ${listing.address || listing.id} — WhatsApp niet verbonden`);
    }

    db.saveListing({ ...listing, notified });
    newCount++;
  }

  console.log(`[Scan] Klaar. ${newCount} nieuwe listings ${newCount > 0 ? '✓' : ''}`);
}

// ── Cron scheduler ───────────────────────────────────────────────────────────

let cronJob = null;

function scheduleScraper() {
  if (cronJob) cronJob.stop();

  const prefs = db.getPreferences();
  const interval = Math.max(5, prefs.check_interval || 15); // minimaal 5 minuten
  const cronExpr = `*/${interval} * * * *`;

  console.log(`[Cron] Scraper ingepland: elke ${interval} minuten`);

  cronJob = cron.schedule(cronExpr, () => {
    runScan();
  });
}

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   Housing Notifier draait op         ║`);
  console.log(`║   http://localhost:${PORT}             ║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  scheduleScraper();
  initWhatsApp();
});
