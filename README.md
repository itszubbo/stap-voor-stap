# Stap voor Stap

Een eerste Nederlandstalige webapp als hulpmiddel voor dagstructuur, taken opdelen en rust/hulp vinden. De app is ontworpen met eenvoudige taal, duidelijke knoppen, grote klikvlakken en een rustige vormgeving.

> Dit is een eerste prototype. Het is geen zorginstrument en vervangt geen begeleiding. Laat mensen met LVB en autisme, naasten en begeleiders de app testen en meebeslissen over verbeteringen. Behoeften verschillen per persoon.

## Wat zit erin?

- **Vandaag:** takenlijst, zelf taken toevoegen en voortgang zien.
- **Mijn stappen:** voorbeeldtaken met kleine stappen; eigen taken en stappen toevoegen, afvinken en verwijderen.
- **Rust & hulp:** eenvoudige pauze-ideeën, een voorbeeldzin om hulp te vragen en een optionele gevoelskeuze.
- **Instellingen:** tekst groter/kleiner maken en rustige weergave aanzetten.
- **Privacy:** geen account, analytics of externe API. Gegevens worden in `localStorage` van de browser op het apparaat opgeslagen.
- **PWA/offline:** na het eerste bezoek via een webserver kunnen de bestanden gecachet worden en kan de app offline openen.

## Lokaal starten

Je kunt `index.html` openen in een browser. Voor de offline-functie en installatie als webapp is een lokale webserver nodig. Bijvoorbeeld met Python:

```bash
python -m http.server 8000
```

Open daarna <http://localhost:8000>.

## Publiceren met GitHub Pages

1. Maak op GitHub een nieuwe repository aan, bijvoorbeeld `stap-voor-stap`.
2. Upload alle bestanden uit deze map naar de hoofdmap van de repository.
3. Open **Settings → Pages**.
4. Kies bij **Build and deployment** voor **Deploy from a branch**.
5. Kies de branch `main` en map `/(root)`, en sla op.
6. GitHub Pages toont daarna de website-link bij de Pages-instellingen.

## Belangrijke aandachtspunten vóór gebruik

- Test de teksten, pictogrammen, kleuren en stappen met de mensen voor wie de app bedoeld is.
- Controleer de toegankelijkheid met toetsenbord, schermlezer en vergroting.
- Bespreek met gebruikers welke gegevens lokaal bewaard mogen worden en hoe wissen werkt.
- Gebruik geen echte persoonsgegevens in screenshots of testdata.
- De voorbeeldstappen zijn suggesties; pas ze aan op de persoon en de situatie.

## Bestanden

- `index.html` – pagina's en inhoud
- `styles.css` – opmaak en responsive ontwerp
- `app.js` – interactie en lokale opslag
- `manifest.webmanifest` – instellingen voor installatie als webapp
- `service-worker.js` – cache voor offline gebruik
- `icon.svg` – app-icoon
