# Stap voor Stap

Een eerste Nederlandstalige webapp als hulpmiddel voor dagstructuur, taken opdelen en rust/hulp vinden. De app is ontworpen met eenvoudige taal, duidelijke knoppen, grote klikvlakken en een rustige vormgeving.

> Dit is een eerste prototype. Het is geen zorginstrument en vervangt geen begeleiding. Laat mensen met LVB en autisme, naasten en begeleiders de app testen en meebeslissen over verbeteringen. Behoeften verschillen per persoon.

## Wat zit erin?

- **Vandaag:** takenlijst, zelf taken toevoegen en voortgang zien.
- **Week & agenda:** afspraken per dag plannen, pictogrammen kiezen, items afvinken en naar een andere week bladeren.
- **Visueel dagrooster:** afspraken verschijnen automatisch in grote blokken voor ochtend, middag en avond; je kunt ook eigen tijdblokken toevoegen, afvinken en laten voorlezen.
- **Vaste activiteiten:** activiteiten kunnen iedere week op één of meer gekozen dagen terugkomen; iedere dag kun je de uitvoering apart afvinken.
- **Herinneringen voor vaste activiteiten:** kies 5, 10, 15 of 30 minuten vooraf. Android zet meldingen voor de komende week klaar en werkt dit venster bij wanneer de app wordt geopend. Toestemming voor meldingen is nodig.
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


### Herinneringen voor vaste activiteiten

- Een vaste activiteit kan een melding krijgen op de gekozen weekdagen.
- Je kunt kiezen voor 5, 10, 15 of 30 minuten vooraf. Hiervoor is een begintijd verplicht.
- De Android-app plant meldingen lokaal op het toestel; er is geen meldingenserver nodig.
- De komende week wordt klaargezet. Wanneer je de app opent, wordt de planning weer een week vooruit bijgewerkt.
- Meldingen zijn zonder trillen en zonder exacte-alarmtoestemming. Android kan een melding soms iets later tonen.
- Als je een vaste activiteit verwijdert of een uitvoering afvinkt, wordt de bijbehorende melding geannuleerd.


### Rustige timer

- Op de pagina Vandaag kun je kiezen voor 5, 10, 15 of 30 minuten.
- De timer heeft grote knoppen voor starten, pauzeren en opnieuw beginnen.
- De timer onthoudt de resterende tijd wanneer je de app sluit en later weer opent.
- In de Android-app kan een lokale melding worden ingesteld wanneer de timer afloopt. Hiervoor is toestemming voor meldingen nodig; Android kan meldingen soms iets later tonen.
- Op de website loopt de teller zolang de pagina open is. Er is daar geen telefoonmelding.


### Afspraken aanpassen

- In de weekagenda staat bij iedere losse afspraak een knop om deze aan te passen.
- Je kunt de dag, tijd, naam, soort activiteit en herinnering wijzigen.
- Bij het opslaan wordt de oude herinnering verwijderd en, als je dat kiest, de nieuwe herinnering klaargezet.
- Vaste activiteiten die iedere week terugkomen beheer je apart bij het onderdeel vaste activiteiten.


### Vaste activiteiten aanpassen

- Bij elke vaste activiteit staat nu een potloodknop om deze te wijzigen.
- Je kunt de naam, tijd, pictogram, herinnering en weekdagen aanpassen.
- De bestaande activiteit blijft behouden; de herinneringen worden opnieuw ingesteld.
- Afvinkjes blijven staan voor dagen waarop de activiteit nog steeds terugkomt. Afvinkjes voor verwijderde weekdagen worden opgeruimd.
- Met Annuleren sluit je het aanpassen zonder wijzigingen op te slaan.


### Tijdblokken aanpassen

- In het dagrooster kun je een zelf toegevoegd tijdblok met het potloodje aanpassen.
- Je kunt de dag, begin- en eindtijd, naam en pictogram wijzigen.
- De bestaande afvinkstatus blijft behouden.
- Met Annuleren sluit je de bewerking zonder wijzigingen op te slaan.


### Herinneringen bij tijdblokken

- Zelf toegevoegde tijdblokken kunnen een melding krijgen 5, 10, 15 of 30 minuten vooraf.
- Een begintijd is verplicht; datum, tijd en titel worden gebruikt voor de melding.
- De melding wordt bijgewerkt wanneer een tijdblok wordt aangepast.
- Als je een tijdblok afvinkt of verwijdert, wordt de bijbehorende melding geannuleerd.
- Op de website wordt de keuze getoond; echte toestelmeldingen werken in de Android-app.


### Weekoverzicht afdrukken

- In **Week & agenda** staat een knop **Print weekoverzicht**.
- De afdruk toont alle zeven dagen van de gekozen week, met afspraken en vaste activiteiten.
- Menu's, invoervelden en bewerkknoppen worden niet afgedrukt.
- In de browser kun je het overzicht afdrukken of bij de printerkeuze opslaan als PDF.
- Deze functie is bedoeld voor de website in een browser; de knop wordt in de Android-app verborgen.


### Weekoverzicht afdrukken

- Open **Week & agenda** en kies **Print weekoverzicht**.
- De afdruk toont alle zeven dagen van de gekozen week, inclusief vaste activiteiten en eigen afspraken.
- De afdruk is rustig opgemaakt op A4 en laat bewerkknoppen weg.
- In het afdrukscherm van de browser kun je ook **Opslaan als PDF** kiezen.
- De printfunctie is bedoeld voor de website in een browser. In de Android-app is afdrukken afhankelijk van de ondersteuning van het apparaat.


### Reservekopie bewaren en terugzetten

- Bij **Instellingen → Reservekopie** kun je een bestand maken met je taken, stappen, afspraken, vaste activiteiten, tijdblokken en instellingen.
- Op de website wordt een JSON-bestand gedownload. In de Android-app opent het deelvenster van je telefoon zodat je het bestand kunt bewaren, bijvoorbeeld in Bestanden of Drive.
- Met **Zet reservekopie terug** kun je zo'n bestand later kiezen. De huidige planning wordt dan vervangen.
- Een reservekopie bevat persoonlijke planningsgegevens. Bewaar en deel het bestand zorgvuldig.
- De reservekopie wordt niet naar de server van Stap voor Stap gestuurd.
- Herinneringen op de telefoon worden na het terugzetten opnieuw klaargezet als meldingen zijn toegestaan.


### Extra informatie bij afspraken en tijdblokken

- Bij een losse afspraak of een eigen tijdblok kun je korte extra informatie opschrijven, bijvoorbeeld wat je moet meenemen of waar je moet zijn.
- De notitie staat bij de activiteit in de weekagenda, het dagrooster en de dagweergave.
- De notitie kan ook worden voorgelezen met de voorleesknoppen.
- Je kunt de notitie later aanpassen. De tekst blijft op dit apparaat opgeslagen en wordt meegenomen in een reservekopie.
