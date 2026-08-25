# Etapa E6 — skutečná oprávnění místo atrapy

Worktree: **`/Users/dan/orca/workspaces/ludone-desktop/e6-opravneni`**, větev `orca/e6-opravneni`.
Společná pravidla: **přečti si `_spolecne.md` ve stejném adresáři jako tohle zadání.**

## 1. Co se staví
IPC `permission:request` přestane lhát. Dnes vrátí `{ granted: true }`, aniž by se
kohokoli zeptal; po téhle etapě vrací **skutečný stav od macOS** a odmítnuté oprávnění
pozná od uděleného.

## 2. Proč
`electron/main.cjs` (cca ř. 515–521):
```js
if (!supported.has(permission)) return { granted: false };
return { granted: true, permission };
```
🔴 **To je atrapa.** Uživatelské rozhraní si podle ní myslí, že oprávnění je udělené,
i když macOS ve skutečnosti nic neudělil — takže onboarding ukáže zelenou a nahrávání
pak selže někde úplně jinde, kde příčinu nikdo nespojí s oprávněním.

Pozor, **jinde v souboru skutečné zacházení s oprávněními JE** (cca ř. 285–289,
`setPermissionCheckHandler` a `setPermissionRequestHandler`). Ta atrapa je tedy o to
zrádnější, že soubor vypadá, jako by se oprávněními zabýval.

**Rozhoduje Záznam obrazovky, ne mikrofon** — loopback systémového zvuku jde přes
`getDisplayMedia`, tedy `kTCCServiceScreenCapture`. Mikrofon je druhá, samostatná osa.

## 3. Soubory, které VLASTNÍŠ
SMÍŠ MĚNIT (a jen tyhle):
```
electron/main.cjs            (🔴 JEN blok `permission:request` — NIC jiného)
src/components/Onboarding.jsx
tests/permissions.test.js    (nový)
scripts/akceptace/E6.sh      (nový)
```
NESMÍŠ MĚNIT — ani o řádek:
```
electron/main.cjs → tray, kontrola odesílatele IPC        ← vlastní E3 (běží SOUČASNĚ)
electron/main.cjs → cokoli kolem manifestu nahrávky       ← vlastní E4 (běží SOUČASNĚ)
src/App.jsx   electron/preload.cjs   scripts/package-mac.mjs   ← vlastní E3
src/lib/**   src/features/**   ostatní testy   ostatní brány
package.json  package-lock.json  .github/**  docs/**  specs/**  dukazy/**  design/
```
🔴 **`electron/main.cjs` sdílíš se dvěma etapami, které běží SOUČASNĚ** v jiných worktrees.
Sahej **jen na svůj jeden blok**. Cizí změny v souboru **NECH BÝT** a zapiš do `notes`.

## 4. Pořadí kroků
🔴 **Nejdřív soubory na disk, pak testy, teprve potom odpověď.**

**Krok 1 — skutečný stav oprávnění.** `permission:request` přepiš tak, aby se ptal macOS:
- stav čti přes `systemPreferences.getMediaAccessStatus(<typ>)` — vrací
  `not-determined` / `granted` / `denied` / `restricted`,
- o mikrofon se dá požádat (`systemPreferences.askForMediaAccess("microphone")`),
- 🔴 **o Záznam obrazovky požádat NELZE** — uživatele musíš poslat do Nastavení systému.
  Vrať proto stav, ze kterého rozhraní pozná, že **musí zasáhnout člověk**.
- 🔴 **Nevracej jen `granted: true/false`.** „Nemáš" má nejmíň tři různé příčiny, které se
  jinak slijí do jedné: *ještě se nikdo neptal* × *uživatel odmítl* × *zakázáno politikou*.
  Vrať i **stav** a **co má rozhraní udělat** (požádat / poslat do Nastavení / nic).
- Když ti `systemPreferences` pro daný typ nic neřekne, vrať stav „neznámo" —
  🔴 **nikdy nepředstírej `granted`.** Fail-closed.

**Krok 2 — `src/components/Onboarding.jsx`.** Ať zobrazí tři rozlišené stavy místo dvou
a u Záznamu obrazovky řekne, že to musí člověk zapnout v Nastavení systému.
⚠️ **Neměň vzhled** (rozhodnutí O1 — výtvarný směr je otevřený). Sahej na **chování
a texty**, ne na rozvržení, barvy ani typografii.

**Krok 3 — `tests/permissions.test.js`.** Čistá logika, žádný Electron.
🔴 Vytáhni rozhodovací část do **čisté funkce** (stav od systému → co se vrátí rozhraní)
a testuj tu. Povinné případy:
- `granted` ⇒ uděleno
- `denied` ⇒ **NEuděleno** a rozhraní má poslat do Nastavení
- `not-determined` pro mikrofon ⇒ **NEuděleno** a má se požádat
- `restricted` ⇒ NEuděleno
- **neznámý / chybějící stav ⇒ NEuděleno** (fail-closed)
- 🔴 **nepodporovaný typ oprávnění ⇒ NEuděleno**
🔴 U každého případu assertuj i to, **co se má stát dál** — samotné `granted: false` má
dvě různé příčiny (odmítnuto × ještě se neptal) a bez rozlišení měříš jejich sjednocení.

**Krok 4 — `scripts/akceptace/E6.sh`** ve tvaru PASS/FAIL (vzor `scripts/akceptace/E1b.sh`,
jen ho **čti**). Kontroluje aspoň:
- 🔴 `grep -c "granted: true" electron/main.cjs` = **0** (atrapa je pryč)
- unit testy `permissions` zelené
- `electron/main.cjs` obsahuje `getMediaAccessStatus`
🔴 Každou kontrolu tvaru „soubor NEOBSAHUJE X" napiš tak, aby **spadla i nad neexistujícím
souborem** (`test -s` napřed) — holé `! grep -q` nad chybějícím souborem projde.

## 5. Jak to otestuješ
```bash
npm run test:unit -- permissions > /tmp/p.out 2>&1; echo "EXIT=$?"; tail -25 /tmp/p.out
npm run gates > /tmp/g.out 2>&1; echo "GATES EXIT=$?"; tail -20 /tmp/g.out
bash scripts/akceptace/E6.sh > /tmp/e6.out 2>&1; echo "EXIT=$?"; cat /tmp/e6.out
grep -c "granted: true" electron/main.cjs    # musi byt 0
```

## 6. Důkaz hotovosti
`npm run gates` = **0**, `bash scripts/akceptace/E6.sh` = **0** s 0× FAIL,
`grep -c "granted: true" electron/main.cjs` = **0**.
Před odpovědí `git --no-pager status --porcelain` — když tam tvoje soubory nejsou,
**nejsi hotový a nesmíš odpovídat**.

## 7. Co NESMÍŠ (navíc ke společným)
- **spustit Electron nebo cokoli, co si řekne o oprávnění** — v sandboxu to nejde a dialog
  o oprávnění je přesně to, co se v autonomním běhu nesmí objevit
- předstírat `granted`, když stav neznáš
- měnit vzhled onboardingu (O1)

## 9. Output contract
```json
{
  "summary": "<co jsi udělal>",
  "premisaPlatila": true,
  "ocekavanePocty": {
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "vyskytuGrantedTrue": 0,
    "rozlisenychStavuOpravneni": 0,
    "zmenenychSouboruMimoVlastnictvi": 0
  },
  "dukaz": "<DOSLOVNÝ výpis testů, gates a E6.sh včetně EXIT=>",
  "commitMessage": "<anglicky, imperativ>",
  "notes": ["<co jsi nechal být, co nešlo ověřit>"]
}
```
🔴 `novychTestu` **> 0** · `rozlisenychStavuOpravneni` **>= 3** ·
`vyskytuGrantedTrue` a `zmenenychSouboruMimoVlastnictvi` musí být **0**.
