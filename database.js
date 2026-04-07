const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'housing.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY,
    phone TEXT DEFAULT '',
    region TEXT DEFAULT 'maastricht',
    radius INTEGER DEFAULT 35,
    budget_min INTEGER DEFAULT 0,
    budget_max INTEGER DEFAULT 500000,
    min_rooms INTEGER DEFAULT 1,
    min_surface INTEGER DEFAULT 0,
    property_types TEXT DEFAULT '["huis","appartement"]',
    check_interval INTEGER DEFAULT 15,
    active INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS makelaars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    website TEXT UNIQUE NOT NULL,
    listings_url TEXT DEFAULT '',
    parser TEXT DEFAULT 'generic',
    city TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    last_scraped TEXT,
    discovered_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS seen_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id TEXT UNIQUE NOT NULL,
    url TEXT,
    title TEXT,
    price INTEGER,
    address TEXT,
    rooms INTEGER,
    surface INTEGER,
    agent TEXT,
    image_url TEXT,
    source TEXT DEFAULT '',
    found_at TEXT DEFAULT CURRENT_TIMESTAMP,
    notified INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO preferences (id, phone, region) VALUES (1, '', 'maastricht');
`);

module.exports = {
  getPreferences() {
    const prefs = db.prepare('SELECT * FROM preferences WHERE id = 1').get();
    if (prefs) {
      prefs.property_types = JSON.parse(prefs.property_types || '[]');
    }
    return prefs;
  },

  savePreferences(data) {
    db.prepare(`
      UPDATE preferences SET
        phone = ?,
        region = ?,
        radius = ?,
        budget_min = ?,
        budget_max = ?,
        min_rooms = ?,
        min_surface = ?,
        property_types = ?,
        check_interval = ?,
        active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      data.phone || '',
      data.region || 'maastricht',
      Number(data.radius) || 35,
      Number(data.budget_min) || 0,
      Number(data.budget_max) || 500000,
      Number(data.min_rooms) || 1,
      Number(data.min_surface) || 0,
      JSON.stringify(data.property_types || []),
      Number(data.check_interval) || 15,
      data.active ? 1 : 0
    );
  },

  isListingSeen(listingId) {
    return !!db.prepare('SELECT id FROM seen_listings WHERE listing_id = ?').get(listingId);
  },

  saveListing(listing) {
    return db.prepare(`
      INSERT OR IGNORE INTO seen_listings
        (listing_id, url, title, price, address, rooms, surface, agent, image_url, source, notified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      listing.id,
      listing.url,
      listing.title,
      listing.price,
      listing.address,
      listing.rooms,
      listing.surface,
      listing.agent,
      listing.imageUrl || '',
      listing.source || '',
      listing.notified ? 1 : 0
    );
  },

  getRecentListings(limit = 30) {
    return db.prepare('SELECT * FROM seen_listings ORDER BY found_at DESC LIMIT ?').all(limit);
  },

  getMakelaars() {
    return db.prepare('SELECT * FROM makelaars ORDER BY name').all();
  },

  upsertMakelaar(m) {
    db.prepare(`
      INSERT INTO makelaars (name, website, listings_url, parser, city)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(website) DO UPDATE SET
        name = excluded.name,
        listings_url = CASE WHEN excluded.listings_url != '' THEN excluded.listings_url ELSE listings_url END,
        parser = CASE WHEN excluded.parser != 'generic' THEN excluded.parser ELSE parser END,
        city = excluded.city
    `).run(m.name, m.website, m.listings_url || '', m.parser || 'generic', m.city || '');
  },

  deleteMakelaar(id) {
    db.prepare('DELETE FROM makelaars WHERE id = ?').run(id);
  },

  updateMakelaarScraped(id) {
    db.prepare('UPDATE makelaars SET last_scraped = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  toggleMakelaar(id, active) {
    db.prepare('UPDATE makelaars SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  },

  getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM seen_listings').get();
    const notified = db.prepare('SELECT COUNT(*) as count FROM seen_listings WHERE notified = 1').get();
    const today = db.prepare("SELECT COUNT(*) as count FROM seen_listings WHERE date(found_at) = date('now')").get();
    return { total: total.count, notified: notified.count, today: today.count };
  }
};
