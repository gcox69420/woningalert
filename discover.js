// Ontdek makelaars in een regio via NVM.nl en VBO.nl
// NVM = Nederlandse Vereniging van Makelaars (grootste, ~4000 leden)
// VBO = Vereniging Bemiddeling Onroerend goed (tweede vereniging)

const axios = require('axios');
const cheerio = require('cheerio');
const db = require('./database');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'nl-NL,nl;q=0.9',
};

async function fetchPage(url) {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    return res.data;
  } catch (e) {
    console.error(`[Discover] Fout bij ophalen ${url}: ${e.message}`);
    return null;
  }
}

// ── NVM.nl ───────────────────────────────────────────────────────────────────

async function discoverNVM(region, radius) {
  const makelaars = [];
  const city = encodeURIComponent(region || 'Maastricht');

  // NVM heeft een zoekpagina per stad
  const urls = [
    `https://www.nvm.nl/makelaar/?straal=${radius}&plaats=${city}`,
    `https://www.nvm.nl/makelaar/limburg/maastricht/`,
  ];

  for (const url of urls) {
    console.log(`[Discover/NVM] ${url}`);
    const html = await fetchPage(url);
    if (!html) continue;

    const $ = cheerio.load(html);

    // NVM makelaar kaarten
    $('[class*="makelaar-item"], [class*="agent-item"], [class*="office-item"], .search-result').each((_, el) => {
      const $el = $(el);
      const name = $el.find('[class*="name"], h2, h3').first().text().trim();
      const website = $el.find('a[href*="http"]:not([href*="nvm.nl"])').attr('href') ||
                      $el.find('[class*="website"]').text().trim();
      const city = $el.find('[class*="city"], [class*="plaats"]').first().text().trim();

      if (name && website && website.startsWith('http')) {
        makelaars.push({ name, website: normalizeUrl(website), city });
      }
    });

    if (makelaars.length > 0) break;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[Discover/NVM] ${makelaars.length} makelaars gevonden`);
  return makelaars;
}

// ── VBO.nl ───────────────────────────────────────────────────────────────────

async function discoverVBO(region) {
  const makelaars = [];
  const city = encodeURIComponent(region || 'Maastricht');
  const url = `https://www.vbo.nl/zoek-een-makelaar/?stad=${city}`;

  console.log(`[Discover/VBO] ${url}`);
  const html = await fetchPage(url);
  if (!html) return makelaars;

  const $ = cheerio.load(html);

  $('[class*="makelaar"], [class*="member"], [class*="office"], .card').each((_, el) => {
    const $el = $(el);
    const name = $el.find('h2, h3, [class*="name"]').first().text().trim();
    const website = $el.find('a[href*="http"]:not([href*="vbo.nl"])').attr('href') || '';
    const city = $el.find('[class*="city"], [class*="plaats"]').first().text().trim();

    if (name && website && website.startsWith('http')) {
      makelaars.push({ name, website: normalizeUrl(website), city });
    }
  });

  console.log(`[Discover/VBO] ${makelaars.length} makelaars gevonden`);
  return makelaars;
}

// ── Bekende Maastricht-makelaars als fallback ─────────────────────────────────
// Hardcoded lijst van bekende makelaars in de regio als de scrapers niets vinden

function knownMakelaars() {
  return [
    { name: 'Smeets Makelaardij',         website: 'https://www.smeetsmakelaardij.nl', city: 'Maastricht' },
    { name: 'ERA Huis & Thuis',            website: 'https://www.erahuisenthuis.nl',    city: 'Maastricht' },
    { name: 'Hendriks Makelaardij',        website: 'https://www.hendriksmakelaardij.nl', city: 'Maastricht' },
    { name: 'Van Hoof Makelaars',          website: 'https://www.vanhoofmakelaars.nl',  city: 'Maastricht' },
    { name: 'Wonen Limburg',               website: 'https://www.wonenlimburg.nl',      city: 'Roermond' },
    { name: 'Quint Makelaardij',           website: 'https://www.quintmakelaardij.nl',  city: 'Maastricht' },
    { name: 'Delooz Makelaars',            website: 'https://www.delooz.nl',            city: 'Maastricht' },
    { name: 'Vestide',                     website: 'https://www.vestide.nl',           city: 'Eindhoven' },
    { name: 'Janssen & Hermans Makelaars', website: 'https://www.janssenhermans.nl',    city: 'Maastricht' },
    { name: 'Beerens Makelaars',           website: 'https://www.beerensmakelaars.nl',  city: 'Maastricht' },
  ];
}

// ── Normaliseer URL ───────────────────────────────────────────────────────────

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return url;
  }
}

// ── Dedupliceer op website ────────────────────────────────────────────────────

function deduplicateByWebsite(list) {
  const seen = new Set();
  return list.filter(m => {
    if (seen.has(m.website)) return false;
    seen.add(m.website);
    return true;
  });
}

// ── Hoofdfunctie ─────────────────────────────────────────────────────────────

async function discoverMakelaars(region = 'Maastricht', radius = 35) {
  console.log(`\n[Discover] Makelaars zoeken rondom ${region} (${radius} km)...`);

  const [nvm, vbo] = await Promise.all([
    discoverNVM(region, radius),
    discoverVBO(region),
  ]);

  let all = [...nvm, ...vbo];

  // Voeg bekende makelaars toe als fallback
  const known = knownMakelaars();
  all = [...all, ...known];

  const unique = deduplicateByWebsite(all);
  console.log(`[Discover] ${unique.length} unieke makelaars gevonden`);

  // Sla op in database
  let newCount = 0;
  for (const m of unique) {
    const existing = db.getMakelaars().find(e => e.website === m.website);
    if (!existing) {
      db.upsertMakelaar(m);
      newCount++;
    }
  }

  console.log(`[Discover] ${newCount} nieuwe makelaars opgeslagen`);
  return unique;
}

module.exports = { discoverMakelaars };
