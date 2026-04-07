const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const db = require('./database');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function parsePrice(str) {
  if (!str) return 0;
  const n = parseInt(str.replace(/[^0-9]/g, ''));
  return n >= 50000 && n <= 5000000 ? n : 0;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Gedeelde browser instance ─────────────────────────────────────────────────

let browser = null;
async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browser;
}

// ── Smeets parser ─────────────────────────────────────────────────────────────

function parseSmeets(html, name, baseUrl) {
  const $ = cheerio.load(html);
  const listings = [];

  $('.property-container').each((_, el) => {
    const $el = $(el);
    if ($el.text().toLowerCase().includes('verkocht')) return;

    const href = $el.find('a[href*="/woningaanbod/"]').first().attr('href') || '';
    if (!href) return;

    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
    const id = 'smeets-' + href.split('/').filter(Boolean).pop();
    const address = $el.find('h2, h3').first().text().trim();
    const price = parsePrice($el.find('.property-price').text());
    const text = $el.text();
    const surface = parseInt(text.match(/Woonoppervlakte\s+(\d+)/i)?.[1] || '0');
    const rooms   = parseInt(text.match(/(\d+)\s*slaapkamer/i)?.[1] || text.match(/(\d+)\s*kamer/i)?.[1] || '0');

    listings.push({
      id, url: fullUrl, address, title: address, price, rooms, surface,
      agent: name, imageUrl: $el.find('img').first().attr('src') || '',
      source: new URL(baseUrl).hostname,
    });
  });

  return listings;
}

// ── AMH parser ────────────────────────────────────────────────────────────────

function parseAMH(html, name, baseUrl) {
  const $ = cheerio.load(html);
  const listings = [];
  const seen = new Set();

  $('a[href*="/woning/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || seen.has(href)) return;
    seen.add(href);

    const $item = $(el).parent('.item');
    const text = $item.text().replace(/\s+/g, ' ').trim();
    if (text.toLowerCase().includes('verkocht') || text.toLowerCase().includes('verhuurd')) return;

    const adresMatch = text.match(/([A-Z][a-záéíóú\w]+ ?[–-] ?[A-Z].+?(?=\s*€|\s*Status|\s*Perceel|\s*$))/);
    const address = adresMatch ? adresMatch[1].replace(/\s*[–-]\s*/, ' – ').trim() : '';
    const price = parsePrice(text.match(/(€[\s\d.,]+)/)?.[1] || '');
    const surface = parseInt(text.match(/Woonopp\.?\s*(\d+)/i)?.[1] || '0');
    const id = href.split('/').filter(Boolean).pop() || href;

    listings.push({
      id: `amh-${id}`,
      url: href.startsWith('http') ? href : `${baseUrl}${href}`,
      address, title: address, price, rooms: 0, surface,
      agent: name, imageUrl: $item.find('img').first().attr('src') || '',
      source: new URL(baseUrl).hostname,
    });
  });

  return listings;
}

// ── Realworks parser ──────────────────────────────────────────────────────────
// ~60% van NVM-makelaars gebruikt Realworks als CMS

function parseRealworks(html, name, baseUrl) {
  const $ = cheerio.load(html);
  const listings = [];

  $('article.object-list-item, li.object-list-item, [class*="object-list-item"]').each((_, el) => {
    const $el = $(el);
    const href = $el.find('a').first().attr('href') || '';
    if (!href) return;

    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
    const id = href.match(/\d{5,}/)?.[0] || href.split('/').filter(Boolean).pop();
    if (!id) return;

    const street  = $el.find('.object-street, [class*="object-street"]').text().trim();
    const city    = $el.find('.object-city,   [class*="object-city"]').text().trim();
    const address = [street, city].filter(Boolean).join(', ');
    const price   = parsePrice($el.find('.object-price, [class*="object-price"], [class*="koopprijs"]').text());
    const text    = $el.text();
    const surface = parseInt(text.match(/(\d+)\s*m²/)?.[1] || '0');
    const rooms   = parseInt(text.match(/(\d+)\s*(kamer|slaap)/i)?.[1] || '0');

    listings.push({
      id: `rw-${id}`, url: fullUrl, address, title: address, price, rooms, surface,
      agent: name, imageUrl: $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '',
      source: new URL(baseUrl).hostname,
    });
  });

  return listings;
}

// ── Generieke parser ──────────────────────────────────────────────────────────

function parseGeneric(html, name, baseUrl) {
  const $ = cheerio.load(html);
  const listings = [];
  const seen = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.match(/\/(koop|object|woning|huis|appartement)\//i)) return;
    if (seen.has(href)) return;
    seen.add(href);

    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
    const id = href.match(/\d{5,}/)?.[0] || href.split('/').filter(Boolean).pop();
    if (!id) return;

    const $card  = $(el).closest('article, li, [class*="item"], [class*="card"], [class*="object"]');
    const context = $card.length ? $card : $(el).parent();
    const text   = context.text().trim();
    const price  = parsePrice(context.find('[class*="price"], [class*="prijs"]').first().text() || text.match(/(€[\s\d.,]+)/)?.[1] || '');
    let address  = context.find('h2, h3, [class*="address"], [class*="adres"], [class*="title"]').first().text().trim();
    if (!address) {
      const slug = href.split('/').filter(Boolean).pop() || '';
      address = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    const surface = parseInt(text.match(/(\d+)\s*m²/)?.[1] || '0');
    const rooms   = parseInt(text.match(/(\d+)\s*(kamer|slaap)/i)?.[1] || '0');

    listings.push({
      id: `gen-${id}`, url: fullUrl, address, title: address, price, rooms, surface,
      agent: name, imageUrl: context.find('img').first().attr('src') || '',
      source: new URL(baseUrl).hostname,
    });
  });

  return listings;
}

// ── JS-rendered scraper (Puppeteer) ───────────────────────────────────────────

async function scrapeWithPuppeteer(url, name, baseUrl, parser) {
  console.log(`[JS] ${url}`);
  const b = await getBrowser();
  const page = await b.newPage();
  const listings = [];

  try {
    await page.setUserAgent(UA);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'nl-NL,nl;q=0.9' });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await Promise.race([
      page.waitForFunction(() => document.querySelectorAll('a[href*="/object/"], a[href*="/woning/"], a[href*="/koop/"]').length > 2, { timeout: 10000 }),
      delay(5000),
    ]).catch(() => {});

    const html = await page.content();
    const results = parseByType(html, name, baseUrl, parser);
    listings.push(...results);
    console.log(`[JS] ${name}: ${listings.length} listings`);
  } catch (e) {
    console.error(`[JS] ${name} fout: ${e.message}`);
  } finally {
    await page.close();
  }

  return listings;
}

// ── Dispatch naar juiste parser ───────────────────────────────────────────────

function parseByType(html, name, baseUrl, parser) {
  if (parser === 'smeets')    return parseSmeets(html, name, baseUrl);
  if (parser === 'amh')       return parseAMH(html, name, baseUrl);
  if (parser === 'realworks') return parseRealworks(html, name, baseUrl);
  return parseGeneric(html, name, baseUrl);
}

// ── Eén makelaar scrapen ──────────────────────────────────────────────────────

async function scrapeMakelaar(m) {
  const listingsUrl = m.listings_url || m.website;
  const baseUrl = new URL(listingsUrl).origin;

  try {
    if (m.parser === 'js') {
      return await scrapeWithPuppeteer(listingsUrl, m.name, baseUrl, 'generic');
    }

    const res = await axios.get(listingsUrl, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'nl-NL,nl;q=0.9' },
      timeout: 15000,
    });
    const listings = parseByType(res.data, m.name, baseUrl, m.parser || 'generic');
    console.log(`[Scraper] ${m.name}: ${listings.length} listings`);
    db.updateMakelaarScraped(m.id);
    return listings;
  } catch (e) {
    console.error(`[Scraper] ${m.name} fout: ${e.message}`);
    return [];
  }
}

// ── Filter ────────────────────────────────────────────────────────────────────

function meetsPreferences(listing, prefs) {
  if (prefs.budget_max && listing.price > 0 && listing.price > prefs.budget_max) return false;
  if (prefs.budget_min && listing.price > 0 && listing.price < prefs.budget_min) return false;
  if (prefs.min_rooms   && listing.rooms   > 0 && listing.rooms   < prefs.min_rooms)   return false;
  if (prefs.min_surface && listing.surface > 0 && listing.surface < prefs.min_surface) return false;
  return true;
}

function deduplicate(listings) {
  const seen = new Set();
  return listings.filter(l => {
    if (!l.id || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

// ── Hoofdfunctie ──────────────────────────────────────────────────────────────

async function scrapeListings(prefs) {
  const makelaars = db.getMakelaars().filter(m => m.active && m.listings_url);

  if (makelaars.length === 0) {
    console.log('[Scraper] Geen makelaars ingesteld. Voeg makelaars toe via de UI.');
    return [];
  }

  console.log(`\n[Scraper] ${makelaars.length} makelaars scrapen...`);
  const all = [];

  for (const makelaar of makelaars) {
    const listings = await scrapeMakelaar(makelaar);
    all.push(...listings);
    await delay(600);
  }

  const unique   = deduplicate(all);
  const filtered = unique.filter(l => meetsPreferences(l, prefs));
  console.log(`[Scraper] Totaal: ${all.length} → uniek: ${unique.length} → na filter: ${filtered.length}`);
  return filtered;
}

module.exports = { scrapeListings };
