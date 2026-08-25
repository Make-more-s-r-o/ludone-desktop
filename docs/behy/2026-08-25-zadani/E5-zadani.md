# Etapa E5 — odchozí fronta a killswitch

Worktree: **`/Users/dan/orca/workspaces/ludone-desktop/e5-fronta`**, větev `orca/e5-fronta`.
Společná pravidla: **přečti si `_spolecne.md` ve stejném adresáři jako tohle zadání.**

## 1. Co se staví
Hotová nahrávka se zařadí do **odchozí fronty**, která ji podrží, přežije restart
aplikace a umí opakovat neúspěšný pokus. **Odesílání samo zůstává vypnuté.**

## 2. Proč
Rozhodnutí **D4**: *fronta se postaví, odesílání zůstane za killswitchem, výchozí OFF.*
Dnes nahrávka po skončení **nikam nejde** — leží na disku a nikde není ani záznam, že
vznikla. Fronta je ta chybějící část mezi „nahráno" a „odesláno".

🔴 **Killswitch je `DESKTOP_UPLOAD_ENABLED` a jeho výchozí stav je VYPNUTO.**
Stopka **S2** říká, že ho **nesmíš zapnout** — ani v testu, ani v `.env.example`, ani
„dočasně, ať to jde vyzkoušet". Etapa je hotová právě tehdy, když fronta funguje
a **přesto nic neodešle**.

Kontrakt, který fronta musí respektovat, je popsaný v
`docs/server-modul/kontrakt-desktopu.md` (tři stavy killswitche, idempotence, offsety).
🔴 **Přečti si ho dřív, než začneš.** Když se rozejde s implementací, **řiď se dokumentem**
a rozdíl zapiš do `notes`.

Fronta staví na manifestu z etapy **E4** (`src/lib/manifest.js`) — **čti ho, neměň.**

## 3. Soubory, které VLASTNÍŠ
SMÍŠ MĚNIT (a jen tyhle):
```
src/lib/queue.js             (nový — čistá logika, ŽÁDNÝ Electron, ŽÁDNÁ síť)
electron/queue.cjs           (nový — trvalé uložení fronty)
tests/queue.test.js          (nový)
.env.example                 (killswitch, výchozí VYPNUTO)
scripts/akceptace/E5.sh      (nový)
```
NESMÍŠ MĚNIT — ani o řádek:
```
src/lib/manifest.js          ← 🔴 vlastní E4, jen ho ČTEŠ
electron/main.cjs            ← 🔴 VÝSLOVNĚ ZAKÁZÁNO (sdílí ho tři jiné etapy)
ostatní testy a brány · package.json · package-lock.json · .github/**
src/**  mimo `src/lib/queue.js`
docs/**  specs/**  dukazy/**  design/  AGENTS.md  ROZHODNUTI.md  PLAN.md  DAN-TODO.md
```
⚠️ Zapojení do `main.cjs` **NEDĚLEJ** — ten soubor nevlastníš. Do `notes` napiš přesně
jeden řádek, jak se má fronta zapojit.

## 4. Pořadí kroků
🔴 **Nejdřív soubory na disk, pak testy, teprve potom odpověď.**

**Krok 1 — `src/lib/queue.js`** (čistá logika):
- zařazení položky (odkaz na manifest a obě stopy), stavy `ceka` → `odesila` →
  `odeslano` × `selhalo`, počet pokusů, důvod posledního selhání,
- 🔴 **idempotence**: dvojí zařazení téže nahrávky (týž `clientRecordingId`) **nesmí**
  vyrobit dvě položky,
- opakování s **rostoucí prodlevou** a **stropem počtu pokusů**,
- 🔴 **killswitch ber jako povinný argument**, ne jako volitelný s defaultem ani jako
  čtení z prostředí uvnitř funkce. Co nesmí mít default, patří do podpisu — jinak si ho
  někdo časem domyslí a fronta začne odesílat.

**Krok 2 — `electron/queue.cjs`**: uložení fronty na disk tak, aby **přežila restart**;
zápis **atomicky** (dočasný soubor + přejmenování), ať pád nenechá půlku souboru.

**Krok 3 — `.env.example`**: `DESKTOP_UPLOAD_ENABLED=false` s komentářem, **proč** je
vypnuté a **kdo** ho smí zapnout (rozhodnutí D4 + stopka S2). 🔴 Nikde jinde v repu
tu hodnotu nenastavuj.

**Krok 4 — `tests/queue.test.js`.** Povinné případy:
- 🔴 **s NENASTAVENÝM `DESKTOP_UPLOAD_ENABLED`** (ne `false` — **smazaným**, `delete
  process.env.DESKTOP_UPLOAD_ENABLED`) fronta **nic neodešle**: assertuj
  `toHaveBeenCalledTimes(0)` na odesílací vrstvě. **Tohle je akceptační kritérium etapy.**
- s `"false"` neodešle nic — taky `toHaveBeenCalledTimes(0)`,
- s `"true"` odesílací vrstvu **zavolá** (odesílání je zamockované, **žádná skutečná síť**),
- dvojí zařazení téže nahrávky ⇒ **jedna položka** (idempotence),
- neúspěch ⇒ položka zůstane ve frontě a počet pokusů stoupne,
- po vyčerpání pokusů ⇒ stav `selhalo`, položka **nezmizí**,
- fronta uložená a načtená ze zápisu je **stejná** (přežije restart).

🔴 **Proč zrovna „nenastaveno" a ne jen obě polohy:** `it.each(["false","true"])` obojí
proměnnou **NASTAVÍ**, takže větev „chybí konfigurace" se nikdy neprovede — a to je přesně
stav, ve kterém aplikace dnes reálně je. Fail-closed default musí být otestovaný.
🔴 A **„nic se neodeslalo" má dvě příčiny** — *rozhodl jsem se neodeslat* × *spadl jsem*.
Assertuj i to, že se fronta chovala **záměrně**: vrátila důvod „odesílání je vypnuté",
ne výjimku.

**Krok 5 — `scripts/akceptace/E5.sh`** ve tvaru PASS/FAIL (vzor `scripts/akceptace/E1b.sh`).
Kontroluje aspoň: unit testy `queue` zelené · mezi nimi **jmenovitě** test s nenastaveným
killswitchem · `.env.example` obsahuje `DESKTOP_UPLOAD_ENABLED=false` · 🔴 **nikde v repu
není `DESKTOP_UPLOAD_ENABLED=true`** (kontrolu napiš fail-closed: `test -s` napřed).

## 5. Jak to otestuješ
```bash
npm run test:unit -- queue > /tmp/q.out 2>&1; echo "EXIT=$?"; tail -30 /tmp/q.out
npm run gates > /tmp/g.out 2>&1; echo "GATES EXIT=$?"; tail -20 /tmp/g.out
bash scripts/akceptace/E5.sh > /tmp/e5.out 2>&1; echo "EXIT=$?"; cat /tmp/e5.out
node --check electron/queue.cjs; echo "syntaxe: $?"
```

## 6. Důkaz hotovosti
`npm run gates` = **0**, `bash scripts/akceptace/E5.sh` = **0** s 0× FAIL.
Před odpovědí `git --no-pager status --porcelain` — když tam tvoje soubory nejsou,
**nejsi hotový a nesmíš odpovídat**.

## 7. Co NESMÍŠ (navíc ke společným)
- 🔴 **zapnout `DESKTOP_UPLOAD_ENABLED`** kdekoli (stopka S2) — ani dočasně
- poslat skutečný síťový požadavek (nemáš síť a stejně se to nesmí)
- sáhnout na `electron/main.cjs` nebo `src/lib/manifest.js`

## 9. Output contract
```json
{
  "summary": "<co jsi udělal>",
  "premisaPlatila": true,
  "ocekavanePocty": {
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "vyskytuKillswitchTrue": 0,
    "zmenenychSouboruMimoVlastnictvi": 0
  },
  "dukaz": "<DOSLOVNÝ výpis testů, gates a E5.sh včetně EXIT=>",
  "commitMessage": "<anglicky, imperativ>",
  "notes": ["<jak zapojit frontu do main.cjs — přesně jeden řádek>", "<rozdíly proti kontraktu>"]
}
```
🔴 `novychTestu` **> 0** · `vyskytuKillswitchTrue` a `zmenenychSouboruMimoVlastnictvi`
musí být **0**.
