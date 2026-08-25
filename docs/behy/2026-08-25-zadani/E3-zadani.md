# Etapa E3 — doložené vady: tray, IPC, plist, bundle id

Worktree: **`/Users/dan/orca/workspaces/ludone-desktop/e3-vady`**, větev `orca/e3-vady`.
Společná pravidla: **přečti si `_spolecne.md` ve stejném adresáři jako tohle zadání.**

## 1. Co se staví
Čtyři doložené vady zabalené aplikace zmizí a **každou hlídá test nebo brána**:
chybějící `NSAudioCaptureUsageDescription` v plistu, prototypové bundle id,
neotestovaná autorita ikony v liště a neotestovaná kontrola odesílatele IPC.

## 2. Proč
- **`NSAudioCaptureUsageDescription` v plistu CHYBÍ** (ověřeno: `scripts/package-mac.mjs`
  má na ř. 61 `NSMicrophoneUsageDescription`, ale audio capture ne). Zachycení systémového
  zvuku jde přes `getDisplayMedia` ⇒ `kTCCServiceScreenCapture`; bez toho klíče macOS
  aplikaci u ostrého použití odmítne a nikdo nebude vědět proč.
- **Bundle id je `cz.ludone.desktop.prototype`** (`scripts/package-mac.mjs:56`).
  Rozhodnutí **D2** říká `cz.ludone.desktop`. Bundle id určuje, komu macOS přiděluje
  udělená oprávnění — po změně id se **oprávnění resetují**, takže čím dřív, tím líp.
- **Kontrola odesílatele IPC v kódu JE** (`electron/main.cjs`, cca ř. 74–83:
  `isTrustedWebContents`, porovnání `event.sender` a `event.senderFrame`), ale **nic ji
  netestuje**. Bezpečnostní kód bez testu je kód, který příště někdo omylem zjednoduší.
- **Autorita ikony v liště** (cca ř. 146–155, `updateTray`) taky není otestovaná.

## 3. Soubory, které VLASTNÍŠ
SMÍŠ MĚNIT (a jen tyhle):
```
electron/main.cjs            (JEN tray a kontrola odesílatele IPC — NIC jiného)
electron/preload.cjs
src/App.jsx
scripts/package-mac.mjs
tests/tray-authority.test.js
tests/ipc-sender-guard.test.js
scripts/akceptace/E3.sh      (nový)
```
NESMÍŠ MĚNIT — ani o řádek:
```
electron/main.cjs → blok `permission:request` (cca ř. 515–521)   ← vlastní E6
electron/main.cjs → cokoli kolem manifestu nahrávky              ← vlastní E4
src/features/**   src/components/**                              ← cizí
src/lib/**   tests/manifest.test.js   tests/queue.test.js   tests/permissions.test.js
scripts/akceptace/E1.sh  E1b.sh  E2.sh  E2-sabotaze.sh  E8.sh    ← cizí brány
package.json  package-lock.json  .github/**  docs/**  specs/**  dukazy/**  design/
AGENTS.md  ROZHODNUTI.md  PLAN.md  DAN-TODO.md
```
🔴 **`electron/main.cjs` sdílíš se dvěma dalšími etapami, které běží SOUČASNĚ** v jiných
worktrees. Sahej **jen na svoje dva bloky**. Když v souboru uvidíš změny, které jsi nedělal,
**NECH JE BÝT** a zapiš je do `notes`.

## 4. Pořadí kroků
🔴 **Nejdřív soubory na disk, pak testy, teprve potom odpověď.** JSON na konci je hlášení
o práci, která na disku UŽ JE — ne plán.

**Krok 1 — plist.** Do `scripts/package-mac.mjs` přidej `NSAudioCaptureUsageDescription`
s českým textem, který uživateli řekne, **proč** appka zachytává zvuk (ne „potřebujeme
přístup", ale k čemu to je). Vedle `NSMicrophoneUsageDescription`, stejným stylem.

**Krok 2 — bundle id.** `cz.ludone.desktop.prototype` → **`cz.ludone.desktop`**.
Projdi `grep -rn "cz.ludone.desktop.prototype"` a oprav **všechny** výskyty. Do komentáře
u konstanty napiš, že změna id **resetuje udělená oprávnění** — ať to příště nikoho
nepřekvapí.

**Krok 3 — `tests/tray-authority.test.js`.** Ověř pravidlo *„stav ikony v liště odpovídá
stavu nahrávání"*. Testuj **čistou logiku** — když je výběr ikony zapletený do Electronu,
vytáhni z něj čistou funkci (mapování stav → jméno ikony) a testuj tu; přesun čisté funkce
v rámci `electron/main.cjs` je povolený. Když to nejde bez Electronu, napiš `it.todo`
s popisem, co by bylo potřeba, a **do `notes` proč**.

**Krok 4 — `tests/ipc-sender-guard.test.js`.** Ověř, že zpráva od **cizího** odesílatele
se odmítne. Aspoň tyhle případy:
- odesílatel je očekávané okno ⇒ **projde**
- odesílatel je jiné `webContents` ⇒ **odmítnuto**
- `senderFrame` není hlavní rám (iframe) ⇒ **odmítnuto**
- `webContents` je zničené ⇒ **odmítnuto**, ne výjimka
- 🔴 URL, která jen *začíná* povoleným prefixem (např. `file:///…/app/dist/index.html.evil`
  nebo `https://app.ludone.cz.utocnik.cz`) ⇒ **odmítnuto**. Pokud dnešní kód takovou URL
  propustí, **je to nález**: oprav ho a napiš do `notes`, žes ho našel.

**Krok 5 — `scripts/akceptace/E3.sh`** ve tvaru PASS/FAIL za každou podmínku (vzor máš
v `scripts/akceptace/E1b.sh`, jen ho **čti**, neměň). Kontroluje aspoň:
- `scripts/package-mac.mjs` obsahuje `NSAudioCaptureUsageDescription`
- `scripts/package-mac.mjs` **neobsahuje** `cz.ludone.desktop.prototype`
  🔴 kontrolu napiš tak, aby **spadla i nad neexistujícím souborem** (`test -s` napřed) —
  holé `! grep -q` nad chybějícím souborem projde a brána je fail-open
- unit testy `tray-authority` a `ipc-sender-guard` jsou zelené
⚠️ `plutil -p` na release bundlu a `codesign --verify` do skriptu **dej**, ale za podmínku
„bundle existuje" — v sandboxu se nezabalí a bez ní by brána padala na nepřítomnosti buildu.

## 5. Jak to otestuješ
```bash
npm run test:unit -- tray-authority > /tmp/t1.out 2>&1; echo "EXIT=$?"; tail -20 /tmp/t1.out
npm run test:unit -- ipc-sender-guard > /tmp/t2.out 2>&1; echo "EXIT=$?"; tail -20 /tmp/t2.out
npm run gates > /tmp/g.out 2>&1; echo "GATES EXIT=$?"; tail -20 /tmp/g.out
bash scripts/akceptace/E3.sh > /tmp/e3.out 2>&1; echo "EXIT=$?"; cat /tmp/e3.out
node --check scripts/package-mac.mjs; echo "syntaxe: $?"
```

## 6. Důkaz hotovosti
`npm run gates` = **0** a `bash scripts/akceptace/E3.sh` = **0** s 0× FAIL.
Před odpovědí spusť `git --no-pager status --porcelain`. Když tam tvoje soubory nejsou,
**nejsi hotový a nesmíš odpovídat**.

## 9. Output contract
```json
{
  "summary": "<co jsi udělal>",
  "premisaPlatila": true,
  "ocekavanePocty": {
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "vyskytuPrototypBundleId": 0,
    "radkuZmenenychMimoMojeDvaBloky": 0,
    "zmenenychSouboruMimoVlastnictvi": 0
  },
  "dukaz": "<DOSLOVNÝ výpis testů, gates a E3.sh včetně EXIT=>",
  "commitMessage": "<anglicky, imperativ>",
  "notes": ["<nálezy, co jsi nechal být, co jsi nespustil a proč>"]
}
```
🔴 `novychTestu` **> 0** · `vyskytuPrototypBundleId`, `radkuZmenenychMimoMojeDvaBloky`
a `zmenenychSouboruMimoVlastnictvi` musí být **0** — spočítej si je, neodhaduj.
