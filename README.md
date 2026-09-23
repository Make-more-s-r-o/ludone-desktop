# LuDone Desktop

Spouštěč na Macu pro LuDone. Nahrává schůzky a měří čas; všechno ostatní (archiv, přepis,
vyhodnocení, dashboardy) žije v app.ludone.cz.

Aktuální vydání a hranice ověření popisuje [stav projektu](docs/changes/nahravky-dashboard/STAV.md).
Pro 0.1.4 se připravuje [jeden stereo WebM/Opus za schůzku](docs/changes/nahravky-dashboard/STEREO-MP3.md).

## Lokální spuštění

```sh
npm install --cache .npm-cache --no-audit --no-fund
npm run prepare:media-encoder
npm run build
LUDONE_DATA_DIR="$PWD/.runtime" npm start
```

Příprava encoderu vyžaduje macOS s již nainstalovanými Xcode Command Line Tools.
Sestaví připnuté zdroje pro Apple Silicon i Intel do ignorovaného `.runtime/media-encoder/`.
Vydaná aplikace má převodník přibalený, uživatel nic neinstaluje.
[Zdrojové a licenční podklady](build/media-encoder/README.md).

Aplikace je menu-bar aplikace bez ikony v Docku. Při vývoji se panel otevře po startu;
po zavření jej znovu otevře ikona LuDone v horní liště.

## Ověření

Souhrnná lokální brána spustí lint, kontrolu typů a unit testy:

```sh
npm run gates
```

Jednotlivé části lze spustit přes `npm run lint`, `npm run typecheck` a
`npm run test:unit`. GUI a zvukové smoke testy vyžadují skutečný Mac, příslušná
oprávnění a ruční postup popsaný v repozitáři; nejsou součástí běžné CI brány.

## Lokální balíček

Po přípravě encoderu lze spustit `npm run package:mac`. Bez podpisových údajů
vznikne výslovně nepodepsaný balíček. Publikační workflow provádí přípravu,
podpis, notarizaci a ověření samostatně; `npm run release:mac` odmítne neúplné
podpisové nastavení. Tajné hodnoty patří do GitHub Secrets.

Pro syntetické ověření MP3 lze spustit `node scripts/akceptace/stereo-audio.mjs`.
Tato vývojová kontrola potřebuje plný testovací `ffmpeg` a `ffprobe` v PATH;
vytváří pouze umělé tóny. Produkční aplikace PATH nepoužívá. Syntetické výsledky
nejsou náhradou živé přejímky mikrofonu a schůzky na Macu.

Lokální balení prováděj po vlastním `npm ci` v daném checkoutu. Dočasný symlink na cizí `node_modules` není podklad pro instalačku: builder může vynechat tranzitivní závislosti. Úplnost obou skutečných balíčků ověří například `node scripts/akceptace/stereo-package.mjs "release/mac-arm64/LuDone Desktop.app" arm64` a stejný příkaz pro `release/mac/LuDone Desktop.app` / `x64`. Tato kontrola nedokládá podpis, instalaci ani živý zvuk.
