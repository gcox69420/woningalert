# WoningAlert 🏠

Ontvang direct een WhatsApp-bericht zodra een makelaar een nieuwe woning online zet — voordat het op Funda verschijnt.

De tool scrapt makelaarssites rechtstreeks, slaat geziene woningen lokaal op en stuurt je een bericht bij elke nieuwe listing die binnen je voorkeuren valt.

![screenshot](https://i.imgur.com/placeholder.png)

---

## Hoe het werkt

1. Je voegt makelaarwebsites toe via de webinterface
2. De tool checkt elke X minuten of er nieuwe woningen zijn
3. Bij een nieuwe woning krijg je direct een WhatsApp-bericht met adres, prijs, oppervlak en link

---

## Vereisten

- [Node.js](https://nodejs.org) v18 of hoger
- Een smartphone met WhatsApp
- macOS, Linux of Windows met WSL

---

## Installatie

```bash
# 1. Download de code
git clone https://github.com/jouwgebruikersnaam/woningalert.git
cd woningalert

# 2. Installeer dependencies
npm install

# 3. Start de app
node server.js
```

Open daarna **http://localhost:3000** in je browser.

---

## WhatsApp koppelen

Bij de eerste keer opstarten zie je een QR-code op http://localhost:3000.

1. Open WhatsApp op je telefoon
2. Ga naar **Instellingen → Gekoppelde apparaten → Apparaat koppelen**
3. Scan de QR-code

De verbinding wordt lokaal opgeslagen — je hoeft dit maar één keer te doen.

---

## Makelaars toevoegen

Ga naar het tabblad **Makelaars** en voeg makelaars toe via het formulier:

| Veld | Uitleg |
|------|--------|
| **Naam** | Naam van de makelaar |
| **URL aanbodspagina** | De directe link naar de pagina met koopwoningen |
| **Type** | Laat op "Automatisch" staan, tenzij de pagina niet werkt |

### Voorbeelden van goede URLs

```
https://www.smeetsmakelaardij.nl/woningaanbod
https://www.jouwmakelaar.nl/aanbod/koopwoningen/
https://www.jouwmakelaar.nl/te-koop/
```

**Tip:** De meeste makelaars (NVM-leden) gebruiken Realworks als CMS. Kies dan "Realworks (~60% NVM)" als type. Als je twijfelt, laat "Automatisch" staan.

### Realworks makelaars herkennen

Ga naar de aanbodspagina van de makelaar. Klik rechtermuisknop → Paginabron bekijken. Als je het woord `realworks` ziet staan, kies dan **Realworks** als type.

---

## Voorkeuren instellen

Via het formulier links stel je in:

- **WhatsApp nummer** — jouw nummer inclusief landcode (bijv. `+31612345678`)
- **Budget min/max** — woningen buiten dit bereik worden gefilterd
- **Min. kamers / oppervlak** — optionele filters
- **Check interval** — hoe vaak de makelaars gecheckt worden (standaard 15 min)

---

## De app altijd laten draaien

### Optie 1: pm2 (aanbevolen)

```bash
npm install -g pm2
pm2 start server.js --name woningalert
pm2 startup   # volg de instructies die verschijnen
pm2 save
```

De app herstart nu automatisch na een reboot.

### Optie 2: VPS

Zet de code op een goedkope VPS (bijv. [Hetzner CX22](https://www.hetzner.com), ~€4/maand) en gebruik pm2. Dan draait hij 24/7, ook als je laptop uit is.

---

## Eigen regio instellen

De tool werkt voor **elke regio in Nederland** — je voegt gewoon de makelaars uit jouw regio toe. Zoek op Google naar `makelaars [jouwstad] NVM` en voeg de aanbodspagina's toe.

---

## Veelgestelde vragen

**De pagina laadt wel maar er worden geen listings gevonden**
→ De site gebruikt waarschijnlijk JavaScript om listings te laden. Kies "JavaScript-pagina" als type.

**Ik krijg een foutmelding bij WhatsApp**
→ Verwijder de map `.wwebjs_auth` en koppel WhatsApp opnieuw.

**Kan ik meerdere makelaars tegelijk toevoegen?**
→ Ja, voeg ze één voor één toe via de UI. Ze worden allemaal elke scan gecheckt.

---

## Bijdragen

Pull requests zijn welkom! Heb je een parser voor een specifiek makelaar-CMS? Voeg hem toe aan `scraper.js` en maak een PR.

---

## Licentie

MIT — gratis te gebruiken en aan te passen.
