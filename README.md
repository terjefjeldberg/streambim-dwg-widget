# DWG-widget for StreamBIM

2D-visning av én eller flere DWG-filer sammen i samme modellrom. Widgeten bruker automatisk prosjektet den er aktivert i. Prosjekt-ID og StreamBIM-region hentes fra den aktive vertstilkoblingen.

## Kjør lokalt

Node.js 22 eller nyere anbefales.

```powershell
npm install
npm run dev
```

Åpne http://127.0.0.1:5173 og velg **Koble til StreamBIM**. Lim inn prosjektets StreamBIM-nettadresse når du blir bedt om det. Et eget StreamBIM-vindu bruker innloggingen din. Hold det åpent mens widgeten brukes. Lokale DWG- og DXF-filer kan også legges til uten StreamBIM.

Velg ønskede filer og trykk **Åpne valgte sammen**. Filene legges over hverandre med sine opprinnelige XY-koordinater. Tegninger med ulike koordinatsystemer blir ikke automatisk justert. **Tilpass alle** viser alle synlige filer. Hver fil kan skjules og fjernes separat. Nye valg legges til den eksisterende visningen. Originalfarger kan slås på; ellers brukes én farge per tegning.

## Bygg og drift

### GitHub Pages og StreamBIM-konfigurasjon

GitHub Actions bygger widgeten og publiserer **innholdet i `dist/`** til GitHub Pages. Velg **GitHub Actions** som publiseringskilde i Pages-innstillingene. Publisering direkte fra rotmappen på `main` leverer utviklingskoden og gir et tomt vindu.

Bruk `streambim-widget.config.json` som konfigurasjon. `messageKey` er ikke nødvendig for denne widgeten, siden den bruker StreamBIMs aktive innlogging og ikke en egen OIDC-innlogging.

GitHub Pages kan levere brukergrensesnittet og hente dokumentlisten gjennom StreamBIMs widget-API. DWG-filene må enten være tilgjengelige med CORS fra StreamBIM eller hentes gjennom en filserver. GitHub Pages kjører ikke Node-serveren i dette repositoriet.

### Filserver med Cloudflare Workers

Worker-koden ligger i `cloudflare/worker.mjs`. Den videresender filene som en strøm og bruker ingen database eller fillagring. Den tar bare imot lesekall til validerte StreamBIM-dokumentstier. Ingen StreamBIM-innloggingstoken eller cookies sendes til Workeren. Midlertidige signerte fillenker behandles av Workeren; logging av forespørsler er slått av i konfigurasjonen.

Publiser på en Cloudflare-konto med Workers aktivert:

```powershell
npx wrangler login
npx wrangler deploy --config cloudflare/wrangler.jsonc
```

`WIDGET_ALLOWED_ORIGINS` angir hvilke widget-nettsteder som får hente filer. Standardverdien i konfigurasjonen er `https://terjefjeldberg.github.io`. Den må endres hvis widgeten flyttes.

Når Workeren er publisert, legg **den faktiske Worker-adressen** inn som `fileServer` i widgetens `rootUrl`, for eksempel `https://terjefjeldberg.github.io/streambim-dwg-widget/?fileServer=` etterfulgt av URL-kodet HTTPS-adresse. Alternativt kan GitHub-repositoriets Actions-variabel `VITE_FILE_SERVER` settes til Worker-adressen, og widgeten bygges på nytt. Ikke legg tokens i konfigurasjonen.

### Alternativ: Node-server

```powershell
npm run build
npm start
```

Serveren leverer `dist/` på port 4173. Sett `PORT` og eventuelt `HOST` i driftsmiljøet. Legg HTTPS og eventuell organisasjonsinnlogging foran serveren ved publisering. Hele `dist/`, `server/`, `src/project-context.mjs`, `package.json` og låsefilen skal leveres sammen. Ikke bruk bare statisk hosting: serveren trengs for nedlasting av signerte StreamBIM-filer uten CORS-problemer.

Den ferdige HTTPS-adressen må registreres/godkjennes som widget i StreamBIM og aktiveres i ønskede prosjekter. Samme widget-adresse kan gjenbrukes i flere prosjekter. Inne i StreamBIM kobler widgeten seg automatisk til foreldrevinduet med det offisielle `streambim-widget-api`. Brukeren må ha lesetilgang til dokumentene. Koden endrer ikke prosjektets dokumenter eller innstillinger.

## Integrasjon og personvern

- Dokumentlisten hentes sidevis fra `/project-{aktiv-prosjekt-ID}/api/v1/v2/documents`, også fra undermapper. DWG-filene filtreres lokalt, og slettede dokumenter utelates.
- Ny midlertidig nedlastingslenke hentes ved åpning. Filer hentes gjennom en server med validert StreamBIM-region, aktiv prosjekt-ID og begrenset dokumentsti. Ingen innloggingstoken eller nettleser-cookies sendes til denne serveren. Filene strømmes og lagres ikke på disk av serveren.
- CAD-tolkning skjer i nettleseren med LibreDWG WebAssembly. Tegninger sendes ikke til CAD-tjenester. Fonter kan hentes fra MLightCADs offentlige fontsamling, og UI-fonter fra Google Fonts. For isolert drift kan fontene leveres lokalt.
- Serverens filrute krever gyldige signerte nedlastingslenker fra StreamBIM. Den avviser andre domener, prosjektstier som ikke samsvarer med valgt prosjekt, og andre API-endepunkter. Den er ikke en generell proxy. Ikke logg query-strengen: den kan inneholde midlertidige nedlastingstokener.

## Viewer og begrensninger

[MLightCAD](https://github.com/mlightcad/cad-viewer) brukes sammen med [LibreDWG-konverteren](https://github.com/mlightcad/libredwg-converter). LibreDWG er GPL-3.0-or-later; pakken er derfor merket GPL-3.0-or-later. Bevar tredjepartslisenser og gjør tilsvarende kildekode tilgjengelig ved distribusjon. Se `THIRD_PARTY_NOTICES.md`.

Hver fil tolkes fullt som et eget skrivebeskyttet dokument. Vi samler ferdig konvertert modellgeometri i én visningsscene for å unngå at viewerens enklere overlay-funksjon utelater INSERT-blokker og mål. Kildedokumentene beholdes i minnet gjennom nettleserøkten, også når de fjernes fra visningen, slik at delte grafikkressurser ikke frigis for tidlig. Fjernede filer gjenbrukes ved ny åpning. Last siden på nytt for å frigjøre hele tegningsbufferen. Dette gir høyere minnebruk ved mange store filer. Samvisningen bruker versjonsbundne THREE-scenegrensesnitt og må testes ved oppgradering av MLightCAD.

Kun modellrommet vises i samvisningen. Eksterne DWG-referanser, manglende SHX-fonter, proxyobjekter og enkelte DWG-entiteter kan kreve ekstra støtte. Identiske filnavn i ulike mapper holdes adskilt gjennom dokument-ID. Originale DWG-enheter og koordinater beholdes uten automatisk enhetskonvertering eller georeferering.

## Kontroller

```powershell
npm test
npm run build
```

Testene dekker prosjektvalg på tvers av prosjekter og regioner, sidevis innhenting, duplikater, slettede filer, DWG-filtrering og nedlastingslenker. Visuell kontroll med reelle prosjektfiler skal gjentas ved vieweroppgraderinger.



