// Test script — draai met: node test-scraper.js
// Laat zien hoeveel listings gevonden worden zonder WhatsApp te sturen

const { scrapeListings } = require('./scraper');

const testPrefs = {
  region: 'maastricht',
  radius: 35,
  budget_min: 0,
  budget_max: 600000,
  min_rooms: 1,
  min_surface: 0,
};

console.log('=== Scraper test ===');
console.log('Voorkeuren:', testPrefs);
console.log('');

scrapeListings(testPrefs).then(listings => {
  console.log(`\n=== Resultaat: ${listings.length} listings ===\n`);
  listings.slice(0, 10).forEach((l, i) => {
    console.log(`${i + 1}. ${l.address || l.title || '–'}`);
    console.log(`   💰 ${l.price ? '€ ' + l.price.toLocaleString('nl-NL') : 'prijs onbekend'} | ${l.rooms || '?'} kamers | ${l.surface || '?'} m²`);
    console.log(`   🏢 ${l.agent || '–'} (${l.source})`);
    console.log(`   🔗 ${l.url}`);
    console.log('');
  });

  if (listings.length > 10) {
    console.log(`... en nog ${listings.length - 10} meer`);
  }

  process.exit(0);
}).catch(e => {
  console.error('Fout:', e.message);
  process.exit(1);
});
