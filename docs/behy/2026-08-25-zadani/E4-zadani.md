# Etapa E4 — manifest sezení a obnova po pádu

Worktree: **`/Users/dan/orca/workspaces/ludone-desktop/e4-manifest`**, větev `orca/e4-manifest`.
Společná pravidla: **přečti si `_spolecne.md` ve stejném adresáři jako tohle zadání.**

## 1. Co se staví
Každé nahrávání si na disk zapíše **manifest** — malý soubor, ze kterého jde po pádu
aplikace poznat, že nahrávka existovala, v jakém byla stavu a které stopy k ní patří.

## 2. Proč
Dnes po pádu **nezůstane nic, z čeho by šlo poznat, že nahrávka vůbec začala**. Soubory
stop na disku být můžou, ale nikdo neví, jestli jsou úplné, ke které schůzce patří ani
jestli se mají odeslat. Etapa **E5** (odchozí fronta) na tomhle manifestu stojí — bez něj
nemá co do fronty zařadit.

Serverová strana s tímhle manifestem **už počítá**: `docs/server-modul/datovy-model.md`
popisuje entitu `recording_manifests` a `docs/server-modul/kontrakt-desktopu.md` říká, že
se kanonický manifest posílá při inicializaci spolu s `manifestSha256`.
🔴 **Přečti si oba dokumenty dřív, než začneš** — pole musí sedět, jinak si desktop
a server nebudou rozumět. Když se dokument a tvoje implementace rozejdou, **řiď se
dokumentem** a rozdíl zapiš do `notes`.

## 3. Soubory, které VLASTNÍŠ
SMÍŠ MĚNIT (a jen tyhle):
```
src/lib/manifest.js          (nový — čistá logika, ŽÁDNÝ Electron)
electron/main.cjs            (🔴 JEN zápis manifestu při nahrávání — NIC jiného)
tests/manifest.test.js       (možná už existuje z etapy E2 — pak ho ROZŠIŘ, nemaž)
scripts/akceptace/E4.sh      (nový)
```
NESMÍŠ MĚNIT — ani o řádek:
```
electron/main.cjs → tray, kontrola odesílatele IPC      ← vlastní E3 (běží SOUČASNĚ)
electron/main.cjs → blok `permission:request`           ← vlastní E6 (běží SOUČASNĚ)
src/features/recording/RecordingCard.jsx                ← výslovně cizí
src/lib/queue.js  electron/queue.cjs  tests/queue.test.js   ← vlastní E5
src/App.jsx  electron/preload.cjs  scripts/package-mac.mjs  ← vlastní E3
ostatní testy a brány · package.json · package-lock.json · .github/**
docs/**  specs/**  dukazy/**  design/  AGENTS.md  ROZHODNUTI.md  PLAN.md  DAN-TODO.md
```
🔴 **`electron/main.cjs` sdílíš se dvěma etapami, které běží SOUČASNĚ.** Sahej jen na svůj
blok. Cizí změny **NECH BÝT** a zapiš do `notes`.
⚠️ **`tests/manifest.test.js` možná už založila etapa E2** jako kostru. Když ho najdeš,
**rozšiř ho** — nemaž cizí testy a nepřepisuj je.

## 4. Pořadí kroků
🔴 **Nejdřív soubory na disk, pak testy, teprve potom odpověď.**

**Krok 1 — `src/lib/manifest.js`.** Čistá logika, testovatelná bez Electronu:
- sestavení manifestu (`schemaVersion`, `clientRecordingId`, časy, stav, obě stopy),
- **kanonický JSON**: UTF-8 bez BOM, **rekurzivně lexikograficky seřazené klíče**, žádné
  nevýznamové mezery — přesně jak to popisuje `kontrakt-desktopu.md`, protože se z něj
  počítá `manifestSha256`,
- přechody stavu: `recording` → `complete` × `incomplete`,
- 🔴 **stav ber jako povinný argument, ne jako volitelný s defaultem.** Co nesmí mít
  default, patří do podpisu funkce — jinak si ho někdo časem domyslí.

**Krok 2 — zápis manifestu v `electron/main.cjs`.**
🔴 **Manifest musí na disku existovat DŘÍV, než dorazí první chunk.** To je celý smysl
etapy: po pádu *před* prvním chunkem musí zůstat manifest se stavem `nedokonceno`
(`incomplete`). Zapisuj ho tedy při **zahájení** sezení, ne na konci.
- zápis dělej **atomicky** (zápis do dočasného souboru + přejmenování), aby pád uprostřed
  zápisu nenechal na disku půlku souboru,
- při řádném ukončení stav aktualizuj na `complete`.

**Krok 3 — `tests/manifest.test.js`.** Povinné případy:
- 🔴 **po simulovaném pádu PŘED prvním chunkem manifest existuje a má stav `incomplete`**
  — tohle je akceptační kritérium etapy, bez něj etapa neexistuje,
- řádně ukončené sezení má `complete`,
- kanonický JSON má seřazené klíče a **stejný vstup dá stejný hash** (spočítej ho dvakrát),
- 🔴 **přeházené pořadí klíčů na vstupu dá TÝŽ hash** (to je smysl kanonizace),
- 🔴 **jiná hodnota dá JINÝ hash** (kdyby ne, hash nic nehlídá),
- obě stopy (`microphone`, `system`) jsou v manifestu, ani jedna nechybí.
⚠️ Pád simuluj tak, že prostě **nezavoláš** dokončovací krok — nespouštěj Electron.

**Krok 4 — `scripts/akceptace/E4.sh`** ve tvaru PASS/FAIL (vzor `scripts/akceptace/E1b.sh`,
jen ho **čti**). Kontroluje aspoň: unit testy `manifest` zelené · mezi nimi **jmenovitě**
test pádu před prvním chunkem · `src/lib/manifest.js` existuje a není prázdný.

## 5. Jak to otestuješ
```bash
npm run test:unit -- manifest > /tmp/m.out 2>&1; echo "EXIT=$?"; tail -30 /tmp/m.out
npm run gates > /tmp/g.out 2>&1; echo "GATES EXIT=$?"; tail -20 /tmp/g.out
bash scripts/akceptace/E4.sh > /tmp/e4.out 2>&1; echo "EXIT=$?"; cat /tmp/e4.out
```

## 6. Důkaz hotovosti
`npm run gates` = **0**, `bash scripts/akceptace/E4.sh` = **0** s 0× FAIL.
Před odpovědí `git --no-pager status --porcelain` — když tam tvoje soubory nejsou,
**nejsi hotový a nesmíš odpovídat**.

## 9. Output contract
```json
{
  "summary": "<co jsi udělal>",
  "premisaPlatila": true,
  "ocekavanePocty": {
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "poliManifestuShodnychSDokumentaci": 0,
    "zmenenychSouboruMimoVlastnictvi": 0
  },
  "dukaz": "<DOSLOVNÝ výpis testů, gates a E4.sh včetně EXIT=>",
  "commitMessage": "<anglicky, imperativ>",
  "notes": ["<rozdíly proti docs/server-modul/**, co jsi nechal být>"]
}
```
🔴 `novychTestu` **> 0** · `zmenenychSouboruMimoVlastnictvi` = **0**.
