// Scrapt individuele makelaar-websites
// Detecteert automatisch het platform (Realworks, Kolibri, etc.)
// en past de juiste parser toe.

const axios = require('axios');
const cheerio = require('cheerio');
const db = require('./database');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'nl-NL,nl;q=0.9',
};

// Veelgebruikte paden naar het koopwoningen-aanbod per platform
const LISTING_PATHS = [
  '/aanbod/koopwoningen/',
  '/aanbod/koop/',
  '/aanbod/',
  '/woningaanbod/koop/',
  '/woningaanbod/',
  '/te-koop/',
  '/koop/',
  '/koopwoningen/',
  '/wonen/koop/',
];

async function fetchPage(url) {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 12000, responseType: 'text' });
    return res.data;
  } catch (e) {
    return null;
  }
}

// ── Platform detectie ─────────────────────────────────────────────────────────

function detectPlatform(html, baseUrl) {
  if (!html) return 'unknown';
  if (html.includes('realworks') || html.includes('Realworks')) return 'realworks';
  if (html.includes('kolibri') || html.includes('Kolibri')) return 'kolibri';
  if (html.includes('makelaarsuite') || html.includes('Makelaarsuite')) return 'makelaarsuite';
  if (html.includes('wp-content') || html.includes('wordpress')) return 'wordpress';
  return 'generic';
}

// ── Vind de juiste listings-pagina ───────────────────────────────────────────

async function findListingsUrl(baseUrl) {
  // Probeer de homepage eerst — soms staat er een link naar aanbod
  const homepage = await fetchPage(baseUrl);
  if (homepage) {
    const $ = cheerio.load(homepage);
    const aanbodLink = $('a[href*="aanbod"], a[href*="koop"], a[href*="te-koop"], a[href*="woningaanbod"]')
      .filter((_, el) => {
        const href = $(el).attr('href') || '';
        return !href.includes('huur') && !href.includes('rent');
      })
      .first().attr('href');

    if (aanbodLink) {
      const fullUrl = aanbodLink.startsWith('http') ? aanbodLink : `${baseUrl}${aanbodLink}`;
      console.log(`[MakelaarScraper] Aanbod link gevonden: ${fullUrl}`);
      return fullUrl;
    }
  }

  // Probeer bekende paden
  for (const path of LISTING_PATHS) {
    const url = `${baseUrl}${path}`;
    const html = await fetchPage(url);
    if (html && html.length > 5000) {
      // Check of er listing-achtige content op staat
      const hasListings =
        html.includes('koopprijs') ||
        html.includes('k.k.') ||
        html.includes('v.o.n.') ||
        html.includes('object') ||
        html.includes('woning');
      if (hasListings) {
        console.log(`[MakelaarScraper] Listings gevonden op: ${url}`);
        return url;
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return null;
}

// ── Realworks parser ──────────────────────────────────────────────────────────
// Realworks is het meest gebruikte CMS (~60% van NVM-makelaars)

function parseRealworks($, baseUrl) {
  const listings = [];

  $('article.object-list-item, li.object-list-item, [class*="object-list-item"], [class*="objecten-list-item"]').each((_, el) => {
    const $el = $(el);

    const linkEl = $el.find('a.object-image-link, a[class*="object-link"], a').first();
    const href = linkEl.attr('href') || '';
    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;

    const address = [
      $el.find('.object-street, [class*="object-street"]').text().trim(),
      $el.find('.object-city, [class*="object-city"]').text().trim(),
    ].filter(Boolean).join(', ');

    const priceText = $el.find('.object-price, [class*="object-price"], [class*="koopprijs"]').text().trim();
    const price = parsePrice(priceText);

    const surfaceText = $el.find('[class*="surface"], [class*="oppervlak"], [title*="Woonoppervlak"]').text();
    const roomsText = $el.find('[class*="rooms"], [class*="kamers"], [title*="kamers"], [title*="slaapkamer"]').text();

    const surface = parseInt(surfaceText.match(/(\d+)/)?.[1] || '0');
    const rooms = parseInt(roomsText.match(/(\d+)/)?.[1] || '0');

    const imageUrl = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
    const id = href.match(/\d{5,}/)?.[0] || href.split('/').filter(Boolean).pop() || '';

    if (!href || !id) return;
    listings.push({ id: `rw-${id}`, url: fullUrl, title: address, price, address, rooms, surface, agent: '', imageUrl });
  });

  return listings;
}

// ── Kolibri parser ────────────────────────────────────────────────────────────

function parseKolibri($, baseUrl) {
  const listings = [];

  $('[class*="property-item"], [class*="woning-item"], [class*="listing-item"]').each((_, el) => {
    const $el = $(el);
    const href = $el.find('a').first().attr('href') || '';
    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;

    const address = $el.find('[class*="address"], [class*="adres"], h2, h3').first().text().trim();
    const priceText = $el.find('[class*="price"], [class*="prijs"]').first().text().trim();
    const price = parsePrice(priceText);

    const text = $el.text();
    const surface = parseInt(text.match(/(\d+)\s*m²/)?.[1] || '0');
    const rooms = parseInt(text.match(/(\d+)\s*(kamer|slaap)/i)?.[1] || '0');
    const imageUrl = $el.find('img').first().attr('src') || '';
    const id = href.match(/\d{5,}/)?.[0] || href.split('/').filter(Boolean).pop() || '';

    if (!href || !id) return;
    listings.push({ id: `kol-${id}`, url: fullUrl, title: address, price, address, rooms, surface, agent: '', imageUrl });
  });

  return listings;
}

// ── Generieke parser ──────────────────────────────────────────────────────────
// Werkt voor sites zonder bekend platform

function parseGeneric($, baseUrl) {
  const listings = [];
  const seen = new Set();

  // Zoek op links met koop/woning/object in de URL
  $('a[href*="/koop/"], a[href*="/woning/"], a[href*="/object/"], a[href*="/huis-"], a[href*="/appartement-"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    if (!href || seen.has(href)) return;
    seen.add(href);

    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
    const id = href.match(/\d{5,}/)?.[0] || href.split('/').filter(Boolean).pop() || '';
    if (!id) return;

    // Zoek container rondom de link
    const $card = $el.closest('article, li, [class*="item"], [class*="card"], [class*="object"]');
    const context = $card.length ? $card : $el.parent();

    const text = context.text();
    const priceText = context.find('[class*="price"], [class*="prijs"]').first().text() ||
                      text.match(/(€[\s\d.,]+)/)?.[1] || '';
    const price = parsePrice(priceText);

    const address = context.find('h2, h3, [class*="address"], [class*="adres"]').first().text().trim() ||
                    $el.attr('title') || '';

    const surface = parseInt(text.match(/(\d+)\s*m²/)?.[1] || '0');
    const rooms = parseInt(text.match(/(\d+)\s*(kamer|slaap)/i)?.[1] || '0');
    const imageUrl = context.find('img').first().attr('src') || '';

    listings.push({ id: `gen-${id}`, url: fullUrl, title: address, price, address, rooms, surface, agent: '', imageUrl });
  });

  return listings;
}

// ── Prijs parser ──────────────────────────────────────────────────────────────

function parsePrice(str) {
  if (!str) return 0;
  const digits = str.replace(/[^0-9]/g, '');
  const num = parseInt(digits);
  // Sanity check: woningprijzen tussen 50k en 5M
  return num >= 50000 && num <= 5000000 ? num : 0;
}

// ── Scrape één makelaar ───────────────────────────────────────────────────────

async function scrapeMakelaar(makelaar) {
  const { website, name, platform: knownPlatform } = makelaar;
  console.log(`[MakelaarScraper] ${name} (${website})`);

  const listingsUrl = await findListingsUrl(website);
  if (!listingsUrl) {
    console.log(`[MakelaarScraper] Geen listings-pagina gevonden voor ${name}`);
    db.updateMakelaarScraped(website);
    return [];
  }

  const html = await fetchPage(listingsUrl);
  if (!html) {
    db.updateMakelaarScraped(website);
    return [];
  }

  const $ = cheerio.load(html);
  const platform = knownPlatform === 'unknown' ? detectPlatform(html, website) : knownPlatform;

  if (platform !== knownPlatform) {
    db.updateMakelaarPlatform(website, platform);
  }

  let listings = [];
  if (platform === 'realworks') listings = parseRealworks($, website);
  else if (platform === 'kolibri') listings = parseKolibri($, website);
  else listings = parseGeneric($, website);

  // Voeg makelaarsnaam toe als die niet in de listing zit
  listings = listings.map(l => ({ ...l, agent: l.agent || name, source: name }));

  console.log(`[MakelaarScraper] ${name}: ${listings.length} listings (platform: ${platform})`);
  db.updateMakelaarScraped(website);

  return listings;
}

// ── Scrape alle actieve makelaars ─────────────────────────────────────────────

async function scrapeAllMakelaars(prefs) {
  const makelaars = db.getMakelaars().filter(m => m.active);
  if (makelaars.length === 0) {
    console.log('[MakelaarScraper] Geen makelaars in database. Voer eerst ontdekking uit.');
    return [];
  }

  console.log(`[MakelaarScraper] ${makelaars.length} makelaars scrapen...`);
  const all = [];

  for (const makelaar of makelaars) {
    try {
      const listings = await scrapeMakelaar(makelaar);
      all.push(...listings);
    } catch (e) {
      console.error(`[MakelaarScraper] Fout bij ${makelaar.name}: ${e.message}`);
    }
    // Pauze tussen makelaars om niet te snel te gaan
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[MakelaarScraper] Totaal van alle makelaars: ${all.length} listings`);
  return all;
}

module.exports = { scrapeAllMakelaars, scrapeMakelaar };
