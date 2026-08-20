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
