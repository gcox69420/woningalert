// Ontdek makelaars in een regio
// Strategie: gecureerde lijst van Nederlandse makelaars per stad/provincie
// + automatische detectie van de aanbodspagina

const axios = require('axios');
const cheerio = require('cheerio');
const db = require('./database');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Gecureerde lijst van makelaars per stad ───────────────────────────────────
// Gebaseerd op NVM-leden. Voeg gerust meer steden toe via een PR!

const MAKELAARS_PER_STAD = {
  maastricht: [
    { name: 'Smeets Makelaardij',   website: 'https://www.smeetsmakelaardij.nl', listings_url: 'https://www.smeetsmakelaardij.nl/woningaanbod',          parser: 'smeets' },
    { name: 'AMH Makelaars',         website: 'https://amh-makelaars.nl',          listings_url: 'https://amh-makelaars.nl/woningaanbod/',                 parser: 'amh' },
    { name: 'Damen Makelaardij',     website: 'https://www.damen-og.nl',            listings_url: 'https://www.damen-og.nl/wonen/zoeken/heel-nederland/koop/maastricht/', parser: 'js' },
    { name: 'Tijs en Cyril',         website: 'https://www.tijsencyril.nl',         listings_url: 'https://www.tijsencyril.nl/woningen',                   parser: 'js' },
    { name: 'Pooters Makelaardij',   website: 'https://www.pooters-makelaardij.nl', listings_url: 'https://www.pooters-makelaardij.nl/nl/te-koop',         parser: 'js' },
    { name: 'TIM Vastgoed',          website: 'https://www.timvastgoed.nl',         listings_url: 'https://www.timvastgoed.nl/aanbod/woningaanbod/',        parser: 'js' },
  ],
  heerlen: [
    { name: 'Vierhuizen Makelaardij',  website: 'https://www.vierhuizen.nl',         listings_url: 'https://www.vierhuizen.nl/aanbod/koopwoningen/',        parser: 'realworks' },
    { name: 'Waltmann Makelaars',      website: 'https://www.waltmann.nl',           listings_url: 'https://www.waltmann.nl/wonen',                         parser: 'generic' },
  ],
  sittard: [
    { name: 'Hermans & Schutgens',     website: 'https://www.hermans-schutgens.nl',  listings_url: 'https://www.hermans-schutgens.nl/aanbod/koopwoningen/', parser: 'realworks' },
  ],
  roermond: [
    { name: 'Janssen Makelaardij',     website: 'https://www.janssenmakelaardij.nl', listings_url: 'https://www.janssenmakelaardij.nl/aanbod/koopwoningen/', parser: 'realworks' },
  ],
  amsterdam: [
    { name: 'Engel & Völkers Amsterdam', website: 'https://www.engelvoelkers.com',   listings_url: 'https://www.engelvoelkers.com/nl-nl/amsterdam/',         parser: 'generic' },
    { name: 'Broersma Makelaardij',    website: 'https://www.broersma.nl',           listings_url: 'https://www.broersma.nl/aanbod/koopwoningen/',           parser: 'realworks' },
    { name: 'Hoekstra en van Eck',     website: 'https://www.hev.nl',               listings_url: 'https://www.hev.nl/aanbod/koopwoningen/',               parser: 'realworks' },
  ],
  rotterdam: [
    { name: 'Rotsvast Rotterdam',      website: 'https://www.rotsvast.nl',           listings_url: 'https://www.rotsvast.nl/aanbod/koop/',                  parser: 'realworks' },
    { name: 'Meeùs Rotterdam',         website: 'https://www.meeus.com',             listings_url: 'https://www.meeus.com/aanbod/koop/',                    parser: 'realworks' },
  ],
  utrecht: [
    { name: 'De Groot Makelaardij',    website: 'https://www.degroothuis.nl',        listings_url: 'https://www.degroothuis.nl/aanbod/koopwoningen/',       parser: 'realworks' },
    { name: 'ERA Makelaars Utrecht',   website: 'https://www.eramakelaarsutrecht.nl', listings_url: 'https://www.eramakelaarsutrecht.nl/aanbod/koopwoningen/', parser: 'realworks' },
  ],
  eindhoven: [
    { name: 'Bos Makelaars',           website: 'https://www.bosmakelaars.nl',       listings_url: 'https://www.bosmakelaars.nl/aanbod/koopwoningen/',      parser: 'realworks' },
    { name: 'ERA Makelaars Eindhoven', website: 'https://www.era-eindhoven.nl',       listings_url: 'https://www.era-eindhoven.nl/aanbod/koopwoningen/',     parser: 'realworks' },
  ],
  den_haag: [
    { name: 'Valentijn Makelaardij',   website: 'https://www.valentijnmakelaardij.nl', listings_url: 'https://www.valentijnmakelaardij.nl/aanbod/koopwoningen/', parser: 'realworks' },
  ],
  groningen: [
    { name: 'Thuis in Groningen',      website: 'https://www.thuisingroningen.nl',   listings_url: 'https://www.thuisingroningen.nl/aanbod/koopwoningen/',  parser: 'realworks' },
  ],
  breda: [
    { name: 'Jansen Makelaardij',      website: 'https://www.jansenmakelaardij.nl',  listings_url: 'https://www.jansenmakelaardij.nl/aanbod/koopwoningen/', parser: 'realworks' },
  ],
  nijmegen: [
    { name: 'Van Wijk Makelaardij',    website: 'https://www.vanwijkmakelaardij.nl', listings_url: 'https://www.vanwijkmakelaardij.nl/aanbod/koopwoningen/', parser: 'realworks' },
  ],
};

// ── Veelgebruikte aanbod-paden per platform ───────────────────────────────────

const LISTING_PATHS = [
  '/aanbod/koopwoningen/',
  '/aanbod/koop/',
  '/aanbod/',
  '/woningaanbod/',
  '/te-koop/',
  '/koop/',
  '/koopwoningen/',
  '/wonen/',
];

// ── Detecteer aanbodspagina automatisch ──────────────────────────────────────

async function detectListingsUrl(website) {
  // Probeer bekende paden
  for (const path of LISTING_PATHS) {
    const url = `${website}${path}`;
    try {
      const res = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 8000 });
      const html = res.data;
      // Controleer of er woningen op staan
      const hasListings =
        html.includes('koopprijs') || html.includes('k.k.') || html.includes('v.o.n.') ||
        html.includes('object-list-item') || html.includes('woonopp') || html.includes('slaapkamer');
      const hasLinks = (html.match(/href="[^"]*\/(koop|object|woning|detail)\//g) || []).length > 2;
      if (hasListings || hasLinks) {
        const isRealworks = html.includes('realworks') || html.includes('object-list-item');
        return { listings_url: url, parser: isRealworks ? 'realworks' : 'generic' };
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
}

// ── Zoek stad in gecureerde lijst ─────────────────────────────────────────────

function getCuratedMakelaars(region) {
  const slug = region.toLowerCase().trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/'s-/g, '');

  // Exacte match
  if (MAKELAARS_PER_STAD[slug]) return MAKELAARS_PER_STAD[slug];

  // Gedeeltelijke match (bijv. "Den Haag" → "den_haag")
  const key = Object.keys(MAKELAARS_PER_STAD).find(k => slug.includes(k) || k.includes(slug));
  return key ? MAKELAARS_PER_STAD[key] : [];
}

// ── Hoofdfunctie ─────────────────────────────────────────────────────────────

async function discoverMakelaars(region = 'Maastricht') {
  console.log(`\n[Discover] Makelaars zoeken voor: ${region}`);

  const curated = getCuratedMakelaars(region);
  console.log(`[Discover] ${curated.length} makelaars gevonden in gecureerde lijst`);

  let added = 0;
  const results = [];

  for (const m of curated) {
    // Controleer of de makelaar al in de DB staat
    const existing = db.getMakelaars().find(e => e.website === m.website);

    let listingsUrl = m.listings_url;
    let parser = m.parser;

    // Als er geen bekende listings_url is, probeer automatisch te detecteren
    if (!listingsUrl) {
      console.log(`[Discover] Detecteer aanbodspagina voor ${m.name}...`);
      const detected = await detectListingsUrl(m.website);
      if (detected) {
        listingsUrl = detected.listings_url;
        parser = detected.parser;
      }
    }

    if (!listingsUrl) {
      console.log(`[Discover] Geen aanbodspagina gevonden voor ${m.name}`);
      continue;
    }

    if (!existing) {
      db.upsertMakelaar({ ...m, listings_url: listingsUrl, parser });
      added++;
    }

    results.push({ ...m, listings_url: listingsUrl, parser });
  }

  console.log(`[Discover] Klaar. ${added} nieuwe makelaars toegevoegd.`);
  return results;
}

// ── Detecteer onbekende makelaar op basis van website ────────────────────────
// Gebruikt wanneer een gebruiker zelf een website invult zonder listings_url

async function autoDetectMakelaar(website) {
  const name = new URL(website).hostname.replace('www.', '').split('.')[0];
  console.log(`[Discover] Auto-detect: ${website}`);
  const detected = await detectListingsUrl(website);
  if (detected) {
    return { name, website, ...detected };
  }
  return { name, website, listings_url: website, parser: 'js' };
}

module.exports = { discoverMakelaars, autoDetectMakelaar };
