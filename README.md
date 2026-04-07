# WoningAlert 🏠

> Ontvang een WhatsApp-bericht zodra een makelaar een nieuwe woning online zet — voordat het op Funda verschijnt.

De meeste woningen zijn al bezichtigd of zelfs verkocht tegen de tijd dat ze op Funda verschijnen. WoningAlert scrapt makelaarswebsites **direct**, zodat jij als eerste weet dat er een nieuwe woning beschikbaar is.

---

## Hoe het werkt

1. Je stelt je voorkeuren in (regio, budget, kamers)
2. De tool vindt automatisch makelaars in jouw regio
3. Elke X minuten worden de websites gecheckt op nieuwe woningen
4. Bij een nieuwe woning krijg jij **direct een WhatsApp-bericht** — lang voordat het op Funda staat

---

## Wat je krijgt

```
🏠 Nieuwe woning!

📍 Brusselseweg 343, Maastricht
💰 € 415.000 k.k.
📐 144 m²
🏢 Damen Makelaardij

🔗 https://www.damen-og.nl/wonen/object/...
```

---

## Vereisten

- [Node.js](https://nodejs.org) versie 18 of hoger
- Een smartphone met WhatsApp
- macOS, Linux of Windows (met WSL)

---

## Installatie

```bash
# 1. Download de code
git clone https://github.com/gcox69420/woningalert.git
cd woningalert

# 2. Installeer dependencies
npm install

# 3. Start de app
npm start
```

Open daarna **http://localhost:3000** in je browser.

---

## Instellen

### Stap 1 — WhatsApp koppelen

Bij de eerste keer opstarten verschijnt er een QR-code op http://localhost:3000.

1. Open WhatsApp op je telefoon
2. Ga naar **Instellingen → Gekoppelde apparaten → Apparaat koppelen**
3. Scan de QR-code

De sessie wordt lokaal opgeslagen. Je hoeft dit maar één keer te doen.

---

### Stap 2 — Voorkeuren instellen

Vul in het formulier in:

| Veld | Uitleg |
|------|--------|
| WhatsApp nummer | Jouw nummer met landcode, bijv. `+31612345678` |
| Regio | De stad als middelpunt, bijv. `Maastricht` |
| Radius | Straal in km rondom de regio |
| Budget min/max | Woningen buiten dit bereik worden gefilterd |
| Min. kamers | Optioneel minimum aantal kamers |
| Min. oppervlak | Optioneel minimum in m² |
| Check interval | Hoe vaak gecheckt wordt (standaard 15 min) |

---

### Stap 3 — Makelaars toevoegen

Ga naar het tabblad **Makelaars** en klik op **"Ontdek voor mijn regio"**.

De tool zoekt automatisch makelaars in jouw stad op. Staat jouw stad er niet bij? Voeg makelaars handmatig toe:

1. Ga naar de website van een makelaar in jouw regio
2. Navigeer naar hun pagina met koopwoningen
3. Kopieer die URL en plak hem in het formulier

**Voorbeelden van goede URLs:**
```
https://www.smeetsmakelaardij.nl/woningaanbod
https://www.jouwmakelaar.nl/aanbod/koopwoningen/
https://www.jouwmakelaar.nl/te-koop/
```

**Welk type kiezen?**
- **Automatisch** — werkt voor de meeste sites, goed startpunt
- **Realworks** — kies dit als je op de broncode van de site het woord `realworks` ziet staan. Ongeveer 60% van de NVM-makelaars gebruikt dit systeem.
- **JavaScript-pagina** — als de pagina leeg lijkt of geen woningen toont met "Automatisch"

---

## Momenteel ondersteunde regio's (automatisch detecteren)

| Regio | Stad |
|-------|------|
| Zuid-Limburg | Maastricht, Heerlen, Sittard |
| Noord-Brabant | Eindhoven, Breda |
| Zuid-Holland | Rotterdam |
| Utrecht | Utrecht |
| Noord-Holland | Amsterdam |
| Gelderland | Nijmegen |
| Groningen | Groningen |
| Zuid-Holland | Den Haag |

Staat jouw stad er niet bij? Voeg makelaars handmatig toe, of open een [issue](https://github.com/gcox69420/woningalert/issues) zodat we jouw regio kunnen toevoegen.

---

## De app altijd laten draaien

De app draait lokaal op je eigen computer. Zolang je laptop aan en verbonden is met internet, werkt hij. Wil je hem 24/7 laten draaien?

### Optie 1: pm2 (aanbevolen voor Mac/Linux)

```bash
# Installeer pm2
npm install -g pm2

# Start de app via pm2
pm2 start server.js --name woningalert

# Stel automatisch opstarten in bij reboot
pm2 startup
# Voer het commando uit dat pm2 je geeft, dan:
pm2 save
```

Handige pm2 commando's:
```bash
pm2 status              # is de app actief?
pm2 logs woningalert    # bekijk live logs
pm2 restart woningalert # herstart
pm2 stop woningalert    # stop
```

### Optie 2: VPS (altijd aan, ook als laptop dicht is)

Zet de code op een goedkope VPS zoals [Hetzner CX22](https://www.hetzner.com) (~€4/maand). Installeer Node.js, clone de repo, gebruik pm2 — en de app draait 24/7.

---

## Veelgestelde vragen

**Er worden geen listings gevonden**
Controleer of de URL die je hebt ingevuld direct naar de pagina met koopwoningen gaat. Probeer ook het type te wijzigen naar "JavaScript-pagina".

**WhatsApp geeft een foutmelding**
Verwijder de map `.wwebjs_auth` en koppel WhatsApp opnieuw via de QR-code.

**De app werkt niet na een herstart**
Gebruik pm2 (zie hierboven) zodat de app automatisch herstart.

**Kan ik meerdere regio's monitoren?**
Nog niet in één instantie, maar je kunt de app meerdere keren draaien op verschillende poorten.

---

## Bijdragen

Pull requests zijn welkom! Wil je jouw stad of provincie toevoegen aan de automatische detectie? Voeg hem toe in `discover.js` en maak een PR.

---

## Licentie

MIT — gratis te gebruiken, aan te passen en te delen.
