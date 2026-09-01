# Noční běh 1./2. 9. 2026 — zadání

**Soběstačný briéf.** Vykonavatel: **Codex**. Konsolidace (diff, brány, commit) zůstává na Claude.

## Proč právě tyhle čtyři úkoly

Vybrané tak, aby **nečekaly na žádné Danovo rozhodnutí**. Všechno ostatní z plánu visí na výběru
směru panelu nebo na N1 (kam desktop píše hodiny) — to se do noci rozhodnout nedá.

Každý úkol opravuje **změřenou vadu**, ne domněnku. U každé je uvedeno, čím se změřila.

🔴 **Pořadí je závazné.** T1 a T2 musí být hotové dřív než cokoli dalšího: bez viditelné ikony
se nedá ověřit nic ručně, a bez zeleného `ui-smoke` nemá projekt měřidlo.

---

## T1 — Ikona v liště je prázdná *(P0, blokuje ruční ověření čehokoli)*

**Změřeno naostro** (macOS 26.4, Electron 37.3.1): `trayImage()` v `electron/main.cjs` staví ikonu
z `data:image/svg+xml`. **Chromium SVG v `nativeImage` nedekóduje** — výsledek je `isEmpty=true`,
rozměr `0×0`, `toPNG()` vrací **0 bajtů**. V liště je 16 px nicoty.

Protože aplikace nemá ikonu v Docku ani okno, **první spuštění je zcela neviditelné**. Člověk
usoudí, že se nespustila, a spustí ji znovu.

**Co udělat**
1. Vyrobit rastrové ikony pro všechny stavy, které `trayIconName` zná, plus `@2x` variantu.
   Šablonové ikony macOS jsou černobílé s průhledností; barva se řeší až `setTemplateImage(true)`.
2. Načíst je přes `nativeImage.createFromBuffer` (ne z `data:` URI) a **až na neprázdném obrázku**
   volat `setTemplateImage(true)` — na prázdném se příznak neudrží.
3. **Přidat bránu, která zčervená, když je ikona prázdná.** Tohle je jádro úkolu: vada byla
   neviditelná právě proto, že ji nic neměřilo. Test musí volat produkční `trayImage()` a ověřit
   `isEmpty() === false` a `getSize()` větší než nula pro **každý** stav ikony.

**Sabotáž, na které musí brána zčervenat:** vrať jeden stav zpět na `data:image/svg+xml`.
**Případ, který musí zůstat zelený:** stav, který ikonu záměrně nemá (pokud takový je) —
ať se z brány nestane přecitlivělá kontrola.

**Vlastnictví:** `electron/main.cjs` (jen funkce kolem tray ikony), nové soubory ikon,
nový test v `tests/`.

---

## T2 — `ui-smoke` je červený, takže sabotáže nikdy nedoběhly

`scripts/ui-smoke.mjs:301` klikne na tlačítko **„Povolit"**, které v `src/components/Onboarding.jsx`
po etapě E6 neexistuje (`grep -rn "Povolit" src/` → 0 shod). Smyčka na ř. 300 navíc čeká **tři**
oprávnění, zatímco onboarding má **dvě**.

Důsledek: `scripts/akceptace/E2-sabotaze.sh` zastaví na sabotáži (b) s hláškou
„nedotčená brána není zelená", takže sabotáže (b) i (c) **nikdy neproběhly** a chování zvukové
brány je nedoložené.

**Co udělat**
1. Projít **celý** `ui-smoke.mjs` a každý selektor i hledaný text ověřit proti skutečným
   komponentám v `src/`. Nejen ten jeden řádek — rozešlo se toho víc.
2. Tlačítkům v `Onboarding.jsx:202-211` dát **stabilní selektor** (`data-testid`), protože jejich
   popisek je stavově proměnlivý („Povoleno" / „Otevřít Nastavení" / „Omezeno systémem" /
   „Znovu ověřit" / „Požádat"). Test se nesmí chytat textu, který se mění.
3. Srovnat počet očekávaných oprávnění se skutečností.

⚠️ **`ui-smoke` potřebuje GUI a ostře udělená oprávnění — v kleci neběží.** Codex tedy opravu
napíše a nechá doložit **staticky** (grep, že hledané selektory v komponentách existují).
Živý běh spouští člověk. Do výstupu patří přesný příkaz, kterým se to má spustit.

**Vlastnictví:** `scripts/ui-smoke.mjs`, `src/components/Onboarding.jsx` (jen `data-testid`).

---

## T3 — Tři vady přihlášení, každá změřená

**(a) Nesedící časy vyrábějí duchy souhlasů.** Server drží žádost **10 minut**
(`ludone-app/src/mcp/oauth/authorize.ts:23`, `PENDING_TTL_MS`), desktop zavírá naslouchání po
**5** (`electron/auth.cjs:9`, `DEFAULT_TIMEOUT_MS`). Kdo se vrátí v sedmé minutě, dostane od
prohlížeče „nelze se připojit" — a **na serveru mu přitom vznikne souhlas, který nepatří k žádnému
zařízení** a nejde spárovat. Srovnat na 10 minut plus rezerva.

**(b) Panel se během přihlašování schová.** `shouldHidePanelOnBlur` má výjimku jen pro
`permissionPromptsInFlight` a `settingsVisible`. Chybí čítač pro běžící přihlášení —
**vzor je hotový v commitu `04e87fc`**, který touž vadu opravil pro dialog oprávnění.

**(c) Čekání nemá konec ani únik.** Dnes `authBusy ? "Čekám na prohlížeč…" : "Přihlásit"` —
žádný odpočet, žádné Zrušit, žádné zobrazení adresy k ručnímu zkopírování (pojistka pro případ,
kdy se okno otevře do pozadí nebo na druhou plochu).

**Vlastnictví:** `electron/auth.cjs`, `electron/main.cjs` (jen `shouldHidePanelOnBlur` a okolí),
`src/components/Onboarding.jsx`, testy.

🔴 **Nezapojuj `createAuthController`.** Ten je součástí etapy E6 a čeká na rozhodnutí N1
(kam desktop píše). Tady se opravují jen tyhle tři vady.

---

## T4 — Rozplést trojí číslování *(mechanické, ale odemyká plánování)*

Etapy `E*`, brány `E*.sh` i rozhodnutí `D*` znamenají **tři různé věci**:

| | `PLAN.md` | běh 25. 8. |
|---|---|---|
| E5 | serverový příjem nahrávky | odchozí fronta |
| E7 | kalendář | OAuth |
| E8 | LuTrack | dokumentace serverového modulu |

Zelený `scripts/akceptace/E5.sh` tedy svádí uzavřít plánovou E5 — 3–4,5 ČD serverové práce,
kde není řádek kódu.

**Co udělat:** přejmenovat **běhová** čísla na `B1`–`B8` a rozhodnutí běhu na `BD1`–`BD7`.
`E0`–`E10` a `D1`–`D7` zůstávají výhradně pro `PLAN.md` a `DAN-TODO.md`.

⚠️ **Tři z jedenácti merge commitů se nejmenují `Merge orca/e*`** (`8f36ef4`, `1ea5532`, `cc3d11c`),
takže je podle názvu nepoznáš. Přiřazení dělej podle obsahu, ne podle jména.

**Vlastnictví:** `scripts/akceptace/*.sh`, `docs/behy/2026-08-25-zadani/**`, odkazy v `PLAN.md`
a `DAN-TODO.md`. 🔴 **Nepřejmenovávej `specs/E*.md`** — ty patří k plánovému číslování a jsou správně.

---

## Mantinely pro celý běh

- **Zadání předávej cestou k souboru**, ne obsahem. `< /dev/null` v každém `codex exec`.
- `export GIT_PAGER=cat PAGER=cat`. **Žádný příkaz nesmí čekat na vstup.**
- **Jeden worktree = jeden zapisovatel.** T1–T4 jsou nezávislé; když poběží souběžně, každý
  ve vlastním worktree.
- 🔴 **Codex ve worktree needituje git, edituje jen SOUBORY.** Commit, merge i rebase dělá
  orchestrátor. Ve worktree padá i `git add` (`index.lock`, `Operation not permitted`).
- 🔴 **První akce orchestrátora po každém běhu je `git add -A && git commit`** — teprve pak
  brány a sabotáže. Sabotážní smyčka s `git checkout` by jinak Codexovu práci smazala.
- **Výjimku z brány (`*-exempt`, `skip`, baseline) Codex nepřidává sám.** Když si myslí, že je
  namístě, napíše proč do `notes` a rozhodne orchestrátor.
- **Sabotáže spouští orchestrátor**, ne Codex — v sandboxu po sobě neumí uklidit.

## Output contract

```json
{
  "summary": "<3 věty>",
  "premisaPlatila": true,
  "premisaPoznamka": "<čísla řádků a tvrzení ze zadání jsou orientační; co nesedělo, vypiš>",
  "ocekavanePocty": {
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "oslabenychTestu": 0,
    "pridanychVyjimekZBran": 0
  },
  "commitMessage": "<anglicky, tělo česky nemusí>",
  "notes": "<rozpory se stavem repa, co jsi nemohl ověřit, co má orchestrátor přeměřit>"
}
```

🔴 `novychTestu` **musí být větší než nula** — T1 i T2 přidávají měřidlo.
🔴 `oslabenychTestu` i `pridanychVyjimekZBran` **musí být nula**.
🔴 **Pořadí práce:** nejdřív soubory na disk, pak testy, teprve pak odpověď. Před odpovědí spusť
`git --no-pager status --porcelain` a ověř, že tam ty soubory opravdu jsou.

## Co se v noci NESMÍ dělat

- **Nezapojovat frontu ani `createAuthController`** — čeká na N1.
- **Nesahat na autoritu tray stavu** (přesun z rendereru do hlavního procesu). Je to
  architektonická změna, `tests/tray-authority.test.js:38-40` zamyká současný směr a
  `specs/E3-vady-a-identita.md:46` předepisuje opačný. **Ty dva si odporují na `main`** —
  rozhodnout to má člověk, ne noční běh.
- **Nekreslit nové obrazovky ani neměnit vzhled** — design čeká na Danův výběr směru.
- **Nesahat na `design/`** kromě čtení.
