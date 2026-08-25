# Etapa E2 — měřidlo, kterému se dá věřit

Worktree: **`/Users/dan/orca/workspaces/ludone-desktop/e2-meridlo`**, větev `orca/e2-meridlo`.
🔴 Na začátku si ověř `pwd`. Když nesedí, přepni se — cesta je absolutní schválně.
Píšeš **česky**. **NECOMMITUJEŠ** (commit dělá orchestrátor).

⚠️ **Co se změnilo od chvíle, kdy tohle zadání vzniklo** (etapa E1b mezitím doběhla):
kód aplikace **UŽ JE na `main`** a tvůj worktree z něj vychází. `electron/main.cjs`,
`src/**`, `scripts/package-mac.mjs` i `scripts/audio-smoke.mjs` tedy najdeš přímo
v kořeni — ne na cizí větvi. Ověřeno: čerstvý klon `main` projde `npm ci`,
`npm run build` i `npm run package:mac`, všechno **EXIT=0**.

## 1. Co se staví

Projekt dnes nemá **jediný automatický test, lint ani typecheck**. Na konci téhle etapy
musí `npm run gates` projít celý řetěz (lint → typecheck → unit testy) a vrátit **0**,
existovat CI workflow, které totéž pustí na GitHubu, a existovat `scripts/akceptace/E2.sh`
plus `scripts/akceptace/E2-sabotaze.sh`, který **doloží, že brána umí zčervenat**.

## 2. Proč

Bez měřidla nejde odlišit „funguje" od „nespadlo". Konkrétní doložený důvod, proč to není
formalita: běh z 24. 8. má stopu označenou jako **„silence" s velikostí 50 107 B** — tedy
tichý běh, do kterého se dostal cizí zvuk. Audio brána to **nepoznala a běh prohlásila za
platný**. Brána, která tohle propustí, měří vzduch.

## 3. Soubory, které VLASTNÍŠ

SMÍŠ MĚNIT (a jen tyhle):
```
eslint.config.js            (nový)
jsconfig.json               (nový)
vitest.config.js            (nový)
tests/**                    (nový adresář)
scripts/akceptace/E2.sh     (nový)
scripts/akceptace/E2-sabotaze.sh   (nový)
scripts/audio-smoke.mjs     (existuje — opravuješ bránu, viz krok 5)
.github/workflows/**        (nový)
package.json                (🔴 JEN pole "scripts" a "devDependencies", nic jiného)
```

NESMÍŠ MĚNIT — ani o řádek:
```
electron/**      src/**        ← E2 staví měřidlo, NEOPRAVUJE kód. Vady jsou etapa E3.
package-lock.json             ← generuje ho instalace, ne ty
AGENTS.md  ROZHODNUTI.md  PLAN.md  DAN-TODO.md  specs/**  docs/**  dukazy/**
scripts/akceptace/E1.sh  scripts/akceptace/E8.sh   ← cizí brány
design/                       ← cizí netrackovaná práce
```

🔴 **Kdyby lint nebo typecheck hlásil chyby v `src/**` nebo `electron/**`, NEOPRAVUJ JE.**
Nastav rozsah tak, aby brána byla zelená nad dnešním kódem (viz krok 2 a 3), a **počet
těch chyb napiš do `notes`** — je to zadání pro etapu E3, ne pro tebe.

Když v pracovním stromě najdeš změny mimo svůj výčet, NECH JE BÝT a zapiš je do `notes`.

## 4. Pořadí kroků

🔴 Nejdřív soubory na disk, pak testy, teprve potom odpověď.
JSON na konci je hlášení o práci, která na disku UŽ JE — ne plán.

**🔴 PROSTŘEDÍ, které musíš znát předem:**
- **Nemáš síť.** `npm install`, `npm ci` ani `curl` neprojdou (ověřeno: DNS selže, kód 6).
  🔴 **Balíčky UŽ JSOU nainstalované a UŽ JSOU v `package.json`** — doinstaloval je
  orchestrátor před tvým startem, protože ty na síť nedosáhneš. Konkrétně (ověřeno
  spuštěním `--version`):

  | balíček | verze |
  |---|---|
  | `vitest` + `@vitest/coverage-v8` | **3.2.7** |
  | `eslint` + `@eslint/js` | **9.39.5** |
  | `typescript` (`tsc`) | **7.0.2** |
  | `jsdom` | 29.1.1 |
  | `globals` | 17.11.0 |

  **`devDependencies` v `package.json` už tyhle položky obsahují — nepřidávej je znovu**
  a hlavně **NESPOUŠTĚJ `npm install`**: přepsal bys instalaci a bez sítě ji neopravíš.
  Pole `scripts` je pořád na tobě (krok 1). Když ti nějaký balíček chybí, **NEINSTALUJ** —
  zapiš to do `notes` a vystač si s tím, co je.
- Spouštěj přes lokální binárky: `./node_modules/.bin/vitest`, `./node_modules/.bin/eslint`,
  `./node_modules/.bin/tsc`. Přes `npm run <skript>` to funguje taky.
- macOS **nemá `timeout`** — nikde ho nepoužívej, vrací `EXIT=127`.

**Krok 1 — `package.json`, pole `scripts`.** Přidej (a nic existujícího nemaž):
```
"lint":      "eslint .",
"typecheck": "tsc --noEmit",
"test:unit": "vitest run",
"gates":     "npm run lint && npm run typecheck && npm run test:unit"
```
`test:unit` musí umět filtr — `npm run test:unit -- manifest` spustí jen soubory se
slovem `manifest` v názvu. Ověř to, až nějaký test existuje.

**Krok 2 — `eslint.config.js`** (flat config, ESLint 9).
Cíl je **zelená nad dnešním kódem, aniž bys ten kód měnil**. Prakticky:
- zapni doporučená pravidla (`@eslint/js` → `recommended`),
- nastav globals pro tři různá prostředí, protože se v repu míchají: Node (`electron/*.cjs`,
  `scripts/*.mjs`), prohlížeč (`src/**`) a testy,
- `src/**` je **JSX** — ověř, že parser JSX rozumí (`ecmaFeatures: { jsx: true }`),
- ignoruj `node_modules`, `dist`, `release`, `.runtime`, `design`,
- 🔴 pravidla, která by nad dnešním kódem červenala kvůli **stylu** (odsazení, uvozovky,
  délka řádku), **nezapínej** — brána má chytat vady, ne vkus. Kdo chce styl, přidá si ho
  později vědomě.
Pokud i tak něco červená, **vypni to konkrétní pravidlo a napiš do `notes` které a proč** —
nikdy neopravuj cizí kód.

**Krok 3 — `jsconfig.json` pro typecheck.**
`tsc --noEmit` nad JS projektem umí ověřit typy z JSDoc a chytit překlepy. Ale dnešní kód
kontrolou neprošel nikdy, takže by brána byla červená od prvního dne.
🔴 **Nastav proto `checkJs` jen na kód, který teprve vznikne** (`src/lib/**`, `tests/**`),
a `src/components/**`, `src/App.jsx`, `electron/**` a `scripts/**` z kontroly **vynech**.
Do `jsconfig.json` napiš **komentář, proč** je rozsah zúžený a kdy se má rozšířit.
Ověř, že `npm run typecheck` je zelený **a zároveň není prázdný** — musí opravdu něco
kontrolovat. Do `notes` napiš, kolik souborů kontroluje.

**Krok 4 — první testy** (`tests/**`, `vitest.config.js`).
🔴 Testuj **jen čistou logiku**, nic, co potřebuje Electron, GUI, zvuk nebo oprávnění.
Napiš aspoň tyhle dva, protože je vyžaduje etapa E3, a **musí být zelené už teď**:
- `tests/tray-authority.test.js` — ověří pravidlo „stav ikony v liště odpovídá stavu
  nahrávání". Když v `electron/main.cjs` najdeš logiku, která se z něj **nedá zavolat bez
  Electronu**, netestuj ji přes mock Electronu; místo toho **popiš v testu jako `it.todo`**,
  co bude potřeba, aby šla otestovat, a napiš to do `notes`. Falešný test nad mockem, který
  vrací pevnou hodnotu bez ohledu na vstup, je horší než žádný.
- `tests/ipc-sender-guard.test.js` — ověří, že IPC zpráva od **cizího** odesílatele se
  odmítne. Totéž pravidlo: když to bez Electronu nejde, `it.todo` + poznámka.

🔴 **Ke každému testu si polož otázku „kudy se to, co testuju, projeví do něčeho, co test
vidí?"** Když je odpověď „přes návratovou hodnotu mocku, který ji vrací natvrdo", ten test
nehlídá nic.

**Krok 5 — oprava audio brány `scripts/audio-smoke.mjs`.**
Doložená vada: běh označený jako „silence" měl **50 107 B** — do tichého běhu se dostal
cizí zvuk a brána ho **přijala jako platný**.
🔴 Správné chování: takový běh se **ZAHODÍ a zopakuje**, ne vyhlásí neúspěch. Tichý běh se
zvukem není důkaz, že appka nefunguje — je to důkaz, že měření bylo znečištěné.
Uprav bránu tak, aby:
- měla **práh** pro tichou stopu (odvoď ho z doložených čísel: čistý tichý běh měl
  jednotky stovek až ~1,4 kB, znečištěný 50 107 B — práh napiš do konstanty s komentářem,
  odkud se vzal),
- při překročení prahu běh **zahodila a zopakovala**, nejvýš Nkrát (zvol N, zdůvodni),
- po vyčerpání pokusů skončila **nenulovým kódem** s hláškou, která říká **proč**
  („měření bylo opakovaně znečištěné", ne „selhalo"),
- 🔴 **rozlišila tři různé výsledky**, které dnes splývají: měření v pořádku ×
  měření znečištěné × appka opravdu nenahrála. Kritérium tvaru „nic tam není" má vždycky
  aspoň dvě příčiny (záměr × selhání) a bez rozlišení měříš jejich sjednocení.
⚠️ **Bránu NESPOUŠTĚJ** — potřebuje zvuk a oprávnění, které v sandboxu nejsou. Napiš ji,
ověř `node --check scripts/audio-smoke.mjs`, a do `notes` napiš, že běh neproběhl.

**Krok 6 — CI** (`.github/workflows/ci.yml`).
Na `push` a `pull_request`: `npm ci` → `npm run gates` → `npm run build`.
🔴 `ui-smoke` a `audio-smoke` do CI **zařaď, ale vypnuté**, a **do souboru napiš proč** —
potřebují GUI, zvuk a oprávnění Záznam obrazovky, takže na runneru nepoběží a musí je
spustit člověk na svém Macu. Etapa, která by tvrdila, že je „ověřila", lže.

**Krok 7 — `scripts/akceptace/E2.sh`.** Tvar s PASS/FAIL za každou podmínku:
```bash
#!/usr/bin/env bash
chyby=0
zkontroluj() {
  local popis="$1"; shift
  if "$@" > /tmp/akc.out 2>&1; then echo "PASS  $popis"
  else echo "FAIL  $popis"; sed 's/^/      | /' /tmp/akc.out; chyby=$((chyby+1)); fi
}
# … kontroly …
echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
```
Kontroluje aspoň: `npm run lint` = 0 · `npm run typecheck` = 0 · `npm run test:unit` = 0 ·
existuje `.github/workflows/ci.yml` · `audio-smoke.mjs` projde `node --check` ·
`audio-smoke.mjs` obsahuje práh pro znečištěné měření · CI soubor obsahuje vysvětlení,
proč jsou smoke testy vypnuté.

**Krok 8 — `scripts/akceptace/E2-sabotaze.sh`.** 🔴 **Tohle je nejcennější část etapy.**
Sabotáž popsaná v komentáři nikoho nezajímá; skript ji musí **provést, změřit a uklidit**.
Závazné pořadí u každé sabotáže:
```
1) brána nad NEDOTČENÝM stromem musí být ZELENÁ, jinak STOP (neuklízej, neměř)
2) mutace → `grep -c` na vložený vzorec MUSÍ být > 0, jinak sabotáž MINULA a o bráně nevíš nic
3) spustit bránu → očekává se ČERVENÁ, doslovný výpis do logu
4) `git checkout HEAD -- <cesta>`   (HEAD, ne `--` samotné: to obnovuje z INDEXU)
5) brána znovu ZELENÁ, jinak zbyla půlka sabotáže v kódu
```
Skript připrav pro **tři** sabotáže, ale 🔴 **sám ho NESPOUŠTĚJ** — mutuje soubory, které
nevlastníš, a úklid `git checkout` ti sandbox nedovolí. Spustí ho orchestrátor.
Tři sabotáže:
| # | Mutace | Očekávání |
|---|---|---|
| a | odstranit kontrolu pořadí chunků v `appendRecordingChunk` (`electron/main.cjs`) | unit test **PADNE** |
| b | přejmenovat tlačítko „Zastavit nahrávání" (`src/**`) | `ui-smoke` **PADNE** |
| c | tichý běh, do kterého hraje zvuk | brána běh **ZAHODÍ a zopakuje** |
⚠️ Sabotáž **c** potřebuje zvuk ⇒ spustí ji člověk. Ve skriptu ji označ a nech ji
přeskočitelnou přepínačem.
🔴 U sabotáže **a** platí: když test **nezčervená**, jsou tři možné příčiny a musíš je
rozlišit — test je slabý × sabotáž minula cíl × invariant přežil. Rozliší je jedině to,
že si vypíšeš **co assert čte** před mutací a po ní. Do skriptu to vypisování zabuduj.

## 5. Jak to otestuješ

```bash
npm run gates > /tmp/gates.out 2>&1; echo "EXIT=$?"; tail -30 /tmp/gates.out
bash scripts/akceptace/E2.sh > /tmp/e2.out 2>&1; echo "EXIT=$?"; cat /tmp/e2.out
node --check scripts/audio-smoke.mjs; echo "syntaxe audio brany: $?"
bash -n scripts/akceptace/E2-sabotaze.sh; echo "syntaxe sabotazi: $?"
```
🔴 Exit kód měř **před rourou**, ne za `| tail`.

## 6. Důkaz hotovosti

`npm run gates` vrátí **0** a `bash scripts/akceptace/E2.sh` vrátí **0** s 0× FAIL.
Před odpovědí `git --no-pager status --porcelain` — když tam tvoje soubory nejsou,
nejsi hotový a nesmíš odpovídat.

## 7. Co NESMÍŠ

- sáhnout na `electron/**` nebo `src/**` — ani „drobnou opravu", ani kvůli zelené bráně
- vypnout pravidlo, aby brána prošla, aniž bys to napsal do `notes`
- spustit `npm install` / `npm ci` (nemáš síť a přepsal bys instalaci)
- spustit `audio-smoke` nebo `ui-smoke` (potřebují zvuk, GUI a oprávnění)
- spustit `E2-sabotaze.sh` (mutuje cizí soubory, neuklidíš po sobě)
- tvrdit, že něco funguje, když jsi to nespustil
- commitovat, pushovat, mergovat

## 8. Když si zadání odporuje se stavem repa

Nejmenší bezpečná varianta + rozpor do `notes`. Čísla a cesty jsou orientační — když
naměříš jiné, řiď se **měřením**. Zvlášť: když `appendRecordingChunk` nebo tlačítko
„Zastavit nahrávání" nenajdeš pod tím jménem, **najdi skutečné jméno** a napiš rozdíl.

## 9. Output contract

```json
{
  "summary": "<co jsi udělal>",
  "premisaPlatila": true,
  "ocekavanePocty": {
    "novychSouboru": 0,
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "souboruVTypecheckRozsahu": 0,
    "vypnutychLintPravidel": 0,
    "chybVSrcAElectronKtereJsemNEOPRAVIL": 0,
    "zmenenychSouboruMimoVlastnictvi": 0
  },
  "dukaz": "<DOSLOVNÝ výpis `npm run gates` a `scripts/akceptace/E2.sh` včetně EXIT=>",
  "commitMessage": "<anglicky>",
  "notes": ["<vypnutá pravidla a proč · co je it.todo a proč · co jsi nespustil>"]
}
```
🔴 `novychTestu` > 0 (nula znamená, že se nestalo nic) ·
`celkemTestuVeSpustenychSouborech` odečti ze skutečného běhu, neodhaduj ·
`zmenenychSouboruMimoVlastnictvi` = 0 ·
`chybVSrcAElectronKtereJsemNEOPRAVIL` — kolik nálezů jsi v cizím kódu viděl a nechal být.
