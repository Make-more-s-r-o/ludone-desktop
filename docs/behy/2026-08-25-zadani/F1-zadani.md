# Opravné kolo F1 — nálezy z nezávislého review (kolo 1 ze 3)

Worktree: **`/Users/dan/orca/workspaces/ludone-desktop/f1-opravy`**, větev `orca/f1-opravy`.
Společná pravidla: **přečti si `_spolecne.md` ve stejném adresáři jako tohle zadání.**

## Co se děje
Tři nezávislí skeptici prošli etapy E2, E3, E6 a E7 a všichni vrátili **VRATIT**.
Orchestrátor jejich nálezy **přeměřil** a níž je jen to, co **potvrdil naostro** —
plus dva, které máš ověřit ty. Nálezy, které se nepotvrdily, tu nejsou.

🔴 **Opravuješ VADU, ne MĚŘIDLO.** U bran, které lžou, je oprava „ať brána měří pravdu",
ne „ať brána projde". Když po opravě brána zčervená na skutečné vadě, **je to správně** —
oprav tu vadu, nebo ji zapiš do `notes`, ale bránu nezeslabuj.

## Soubory, které VLASTNÍŠ
```
electron/main.cjs   electron/auth.cjs   scripts/package-mac.mjs
scripts/akceptace/E3.sh   scripts/akceptace/E6.sh   scripts/akceptace/E7.sh
tests/ipc-sender-guard.test.js   tests/permissions.test.js
```
NESMÍŠ MĚNIT: `src/lib/**` · `electron/queue.cjs` · `scripts/akceptace/{E1,E1b,E2,E4,E5,E8}.sh`
· `tests/{manifest,queue,pkce,oauth-state,tray-authority,recording-order-guard}.test.js`
· `docs/**` `specs/**` `dukazy/**` `design/**` `package.json` `.github/**`

---

## N1 — 🔴 Zabalená aplikace NEUMÍ načíst `src/lib` (POTVRZENO orchestrátorem)

`scripts/package-mac.mjs` kopíruje do bundlu **jen `dist/`, `electron/` a `package.json`**.
Ale `electron/main.cjs:21` dělá
`import(pathToFileURL(path.join(PROJECT_ROOT, "src", "lib", "manifest.js")))`
a `electron/auth.cjs:18` totéž pro `oauth.js`.

Doklad: `ls "release/LuDone Desktop.app/Contents/Resources/app"` → `dist electron package.json`,
**žádné `src`**. ⇒ V zabalené aplikaci **manifest ani přihlášení nenaskočí**.
Testy to nechytly, protože běží nad pracovním stromem, kde `src/lib` existuje.

**Oprava:** packager musí `src/lib` do bundlu dostat (a balený `package.json` musí umožnit
načtení ESM modulu — ověř, jestli `type` přenáší).
🔴 **A přidej kontrolu, která tuhle třídu chytí příště:** do `scripts/akceptace/E3.sh`
kontrolu, že **každý modul, který si `electron/**` načítá z `src/`, v bundlu existuje**.
Neptej se na konkrétní jméno souboru — odvoď seznam z kódu, ať kontrola nezestárne.
⚠️ Cesty se skládají z kousků (`path.join(..., "src", "lib", ...)`), takže `grep "src/lib"`
je nenajde. Právě proto to nikdo neviděl.

## N2 — 🔴 Osm z dvanácti IPC kanálů nekontroluje odesílatele (POTVRZENO)

`electron/main.cjs` má 12 kanálů (`ipcMain.on|handle`). Guard
`requireTrustedRecordingSender` volají **jen `recording:begin|append|finish`**.
Bez kontroly jsou: `tray:set-state`, `tray:get-state`, `test:click-tray`, `panel:hide`,
`settings:open`, `settings:close`, `auth:begin`, `permission:request`.

**Oprava:** ověř odesílatele **u všech** kanálů, které mění stav nebo něco spouštějí.
🔴 U `test:*` kanálů zvaž, jestli vůbec mají být v produkčním sestavení — když ano, musí
být za kontrolou stejně jako zbytek; když ne, napiš do `notes`, proč zůstávají.
🔴 Do `tests/ipc-sender-guard.test.js` přidej test, který **vyjmenuje kanály z kódu**
a ověří, že žádný nechráněný nepřibyl. Test na seznam, ne na jeden případ — jinak devátý
kanál přibude bez povšimnutí.

## N3 — 🔴 Guard je fail-open, když `senderFrame` chybí (POTVRZENO)

`electron/main.cjs:84-91`:
```js
&& (!event.senderFrame || event.senderFrame === sender.mainFrame)
```
Když `senderFrame` chybí nebo je `null`, podmínka je **true ⇒ přijato**. Guard tedy
propouští **právě ten stav, který neumí ověřit**.

**Oprava:** vyžaduj `senderFrame` (`event.senderFrame && event.senderFrame === sender.mainFrame`).
Chybějící údaj = **odmítnout**, ne přijmout. Doplň test na `senderFrame: null` i `undefined`.

## N4 — 🔴 `scripts/akceptace/E3.sh` hlásí PASS, když bundle NEEXISTUJE (POTVRZENO)

Změřeno: po odsunutí `release/` vypíše
`PASS release plist (podmíněná kontrola: bundle neexistuje)` a
`PASS podpis release bundlu (podmíněná kontrola: bundle neexistuje)`, celkem **EXIT=0**.
Brána tedy vydá zelenou nad **neexistujícím artefaktem**.
⚠️ Tuhle díru **zavinilo zadání E3** („dej je za podmínku, že bundle existuje"), ne worker.

**Oprava:** chybějící bundle **nesmí být PASS**. Buď třetí výsledek `SKIP`, který se
**započítá jinam než mezi úspěchy** a je v souhrnu vidět, nebo kontrola spadne s jasnou
hláškou „bundle chybí, spusť `npm run package:mac`". 🔴 **Zelená smí znamenat jen
„změřeno a v pořádku", nikdy „neměřeno".**

## N5 — ověř a oprav: `scripts/akceptace/E7.sh`, síťová větev

Reviewer tvrdí (ř. ~25), že **jakékoli selhání `curl` se vyhodnotí jako PASS „síť není
dostupná"** — tedy HTTP 500, chyba TLS, chybějící `curl` i neplatná metadata projdou.
🔴 **Nejdřív to ověř** (`sed -n` na ten úsek), a když to platí, oprav: rozliš
**„síť není dostupná"** (legitimní přeskočení, ale ne PASS) od **„služba odpověděla špatně"**
(selhání). `curl` vrací pro DNS **6**, pro HTTP chybu jiné kódy — nesluč je.

## N6 — ověř a oprav: `E7.sh` rozmnožuje nalezené tajemství

Reviewer tvrdí, že když scanner tajemství **něco najde**, zkopíruje celý řádek do
předvídatelného `/tmp/akc-e7.out` a vypíše ho do logu. To by znamenalo, že detekovaný
token skončí v logu a v `/tmp` — tedy přesně tam, kam nesmí.
🔴 Ověř a oprav tak, aby kontrola hlásila **kde** nález je (cesta a řádek), ale
**nevypisovala jeho hodnotu**.

## N7 — 🔴 Testy oprávnění netestují produkční handler

`tests/permissions.test.js` si vytahuje pomocný mapper **z textu zdrojáku** a produkční
handler `permission:request` nikdy nezavolá. `scripts/akceptace/E6.sh` se navíc spoléhá na
textový `grep`. ⇒ **Produkční kód může vracet falešné `granted` a všemi kontrolami projde.**

**Oprava:** vytáhni rozhodovací logiku do **skutečného exportovaného švu**, který volá
produkční handler i test — ať test měří tu funkci, která opravdu běží, ne její kopii
vyčtenou z textu. Pak doplň test, že **při stavu `denied` z macOS handler nevrátí `granted`**.
🔴 Ověření, že to teď měří: **dočasně** změň produkční větev tak, aby vracela `granted`
vždy, spusť test (musí **spadnout**), a **vrať to zpět**. Doslovný výpis obou běhů dej
do `dukaz`. Když nespadne, test pořád nic nehlídá.

---

## Jak to otestuješ
```bash
npm run gates > /tmp/f1-g.out 2>&1; echo "GATES EXIT=$?"; tail -20 /tmp/f1-g.out
npm run package:mac > /tmp/f1-p.out 2>&1; echo "PACKAGE EXIT=$?"
for g in E3 E6 E7; do bash scripts/akceptace/$g.sh > /tmp/f1-$g.out 2>&1; echo "$g EXIT=$?"; cat /tmp/f1-$g.out; done
ls "release/LuDone Desktop.app/Contents/Resources/app"     # musi obsahovat i src
```
🔴 Používej **vlastní** názvy dočasných souborů (`/tmp/f1-*`) — souběžné etapy si dřív
navzájem přepsaly `/tmp/g.out`.

## Důkaz hotovosti
`npm run gates` = 0 · `npm run package:mac` = 0 · brány `E3`, `E6`, `E7` = 0 ·
`src` je v bundlu · a u **N4** doslovný výpis `E3.sh` nad **odsunutým** `release/`
(musí být nenulový nebo aspoň zřetelně NE-zelený).
Před odpovědí `git --no-pager status --porcelain`.

## Output contract
```json
{
  "summary": "<co jsi opravil>",
  "premisaPlatila": true,
  "ocekavanePocty": {
    "opravenychNalezu": 0,
    "nepotvrzenychNalezu": 0,
    "nechranenychIpcKanalu": 0,
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "zmenenychSouboruMimoVlastnictvi": 0
  },
  "dukaz": "<DOSLOVNÝ výpis: gates, package:mac, E3/E6/E7, E3.sh bez bundlu, a RED/GREEN u N7>",
  "commitMessage": "<anglicky, imperativ>",
  "notes": ["<co se NEpotvrdilo a proč>", "<co jsi nechal být>"]
}
```
🔴 `nechranenychIpcKanalu` musí být **0** · `zmenenychSouboruMimoVlastnictvi` = **0** ·
`opravenychNalezu` **> 0** · když se nějaký nález **nepotvrdil**, napiš to do `notes`
a započítej do `nepotvrzenychNalezu` — **nevymýšlej si opravu neexistující vady**.
