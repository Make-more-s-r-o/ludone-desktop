# LuDone Desktop

Spouštěč na Macu pro LuDone. Nahrává schůzky a měří čas; všechno ostatní (archiv, přepis,
vyhodnocení, dashboardy) žije v app.ludone.cz.

Stav: prototyp. Nic z toho zatím není určené k rozdání lidem.

## Lokální spuštění

```sh
npm install --cache .npm-cache --no-audit --no-fund
npm run build
LUDONE_DATA_DIR="$PWD/.runtime" npm start
```

Prototyp je menu-bar aplikace bez ikony v Docku. Při vývoji se panel otevře po startu;
po zavření jej znovu otevře ikona LuDone v horní liště.

## Ověření

Souhrnná lokální brána spustí lint, kontrolu typů a unit testy:

```sh
npm run gates
```

Jednotlivé části lze spustit přes `npm run lint`, `npm run typecheck` a
`npm run test:unit`. GUI a zvukové smoke testy vyžadují skutečný Mac, příslušná
oprávnění a ruční postup popsaný v repozitáři; nejsou součástí běžné CI brány.
