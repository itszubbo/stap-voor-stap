# Stap voor Stap

Een eerste Nederlandstalige webapp als hulpmiddel voor dagstructuur, taken opdelen en rust/hulp vinden. De app is ontworpen met eenvoudige taal, duidelijke knoppen, grote klikvlakken en een rustige vormgeving.

> Dit is een eerste prototype. Het is geen zorginstrument en vervangt geen begeleiding. Laat mensen met LVB en autisme, naasten en begeleiders de app testen en meebeslissen over verbeteringen. Behoeften verschillen per persoon.

## Wat zit erin?

- **Vandaag:** takenlijst, zelf taken toevoegen en voortgang zien.
- **Week & agenda:** afspraken per dag plannen, pictogrammen kiezen, items afvinken en naar een andere week bladeren.
- **Visueel dagrooster:** afspraken verschijnen automatisch in grote blokken voor ochtend, middag en avond; je kunt ook eigen tijdblokken toevoegen, afvinken en laten voorlezen.
- **Mijn stappen:** voorbeeldtaken met kleine stappen; eigen taken en stappen toevoegen, afvinken en verwijderen.
- **Rust & hulp:** eenvoudige pauze-ideeën, een voorbeeldzin om hulp te vragen en een optionele gevoelskeuze.
- **Instellingen:** tekst groter/kleiner maken en rustige weergave aanzetten.
- **Voorlezen:** de dagplanning, losse stappen en weekagenda laten uitspreken met de stem van het apparaat of de browser; stoppen kan met dezelfde knop.
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
4. Kies bij **Build and deployment** voor **GitHub Actions**.
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

## Android-app bouwen

De repository kan ook een installeerbare Android-app (APK) bouwen met Capacitor 8.

- Bij iedere push naar `main` start GitHub Actions automatisch de workflow **Bouw Android APK**.
- Open het tabblad **Actions**, kies de nieuwste run van **Bouw Android APK** en download het artifact **Stap-voor-Stap-Android-APK**.
- Pak het ZIP-bestand uit en open `app-debug.apk` op een Android-telefoon.
- Android kan vragen om installatie vanuit deze bron toe te staan. Sta dit alleen toe voor het bestand dat je zelf uit deze repository hebt gedownload.

Dit is een debug-/test-APK voor installatie buiten de Play Store. Voor publicatie in Google Play is later een ondertekende release-app (AAB) en een Play Console-account nodig.

### Zelf lokaal bouwen

Installeer Node.js 22 of hoger, Android Studio en de Android SDK. Voer daarna uit:

```bash
npm install
npm run build:web
npx cap add android
npx cap sync android
npx cap open android
```

Open het Android-project in Android Studio om het op een toestel te testen of een releaseversie te maken.


## Herinneringen op Android

- Bij een afspraak kun je kiezen voor 5, 10, 15 of 30 minuten vooraf.
- De Android-app gebruikt lokale meldingen op het toestel. Er is geen meldingenserver nodig.
- De meldingen zijn prikkelarm: zonder trillen en zonder exacte-alarmtoestemming. Android kan een melding daardoor iets later tonen.
- De app vraagt toestemming voor meldingen wanneer je de eerste herinnering instelt.
- Op de website kun je afspraken plannen; echte toestelmeldingen zijn beschikbaar in de Android-app.
- Als je een afspraak afvinkt of verwijdert, wordt de geplande melding geannuleerd.

De GitHub Pages-workflow bouwt de webbestanden en meldingenmodule. De Android-workflow bouwt dezelfde bestanden in de APK.
