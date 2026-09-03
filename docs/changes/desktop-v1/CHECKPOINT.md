# CHECKPOINT — LuDone Desktop

Poslední zápis: **2. 9. 2026, 23:20**. Dan spí, běh pokračuje bez něj.

## 🎉 CELÝ SCHVÁLENÝ DESIGN STOJÍ

**21 z 21 desktopových obrazovek je v `main`** (22. je serverová obrazovka souhlasu, ne naše).
Poslední tři dorazily dnes v noci: kontextové menu lišty, výpadek ostatního zvuku, běží obojí.

| | |
|---|---|
| `main` | **473 passed \| 6 skipped (479)**, čistý |
| otevřené PR | **0** — #25 až #34 smergované |
| CI | ✅ zelené, repozitář veřejný, hostované runnery zdarma |
| záložní runner | `danuv-mac`, registrovaný; cizí PR vyžadují schválení |

## ✅ Ověřeno naostro (Dan to viděl běžet)

- **Ikona v liště funguje.** Nebyla vidět proto, že Danova lišta byla plná. `getBounds()`
  přitom celou dobu hlásil nenulové rozměry — spor rozhodl až klik na hlášené souřadnice,
  který trefil aplikační menu. Z toho vznikl PR #33: aplikace už v takové situaci nemlčí.
- **Panel se otevře a odpovídá návrhu** — značka, stav přihlášení, řádek Nahrávání, patička.
- **`npm run gates:clean`** — brány nad čistým klonem, spuštěno a zelené.
- **Vlastní GitHub runner** na Danově Macu — job na něm proběhl zeleně.

## 🧪 Postaveno, ale nikdo to neviděl běžet

Prakticky všechno ostatní: export do stereo souboru · pojmenování schůzky · onboarding
včetně testu záznamu · adresa přihlášení · výpadek ostatního zvuku · kontextové menu ·
hláška při plné liště · přibalená písma.

## Rozdělaná práce

- **`orca/desktop-baleni`** — electron-builder + electron-updater. Job běžel při psaní
  tohohle zápisu; po doběhnutí commitnout, brány, sabotáže, PR.

## Co zbývá

1. Dotáhnout balení (běží).
2. 🟡 **Barva hlavního tlačítka** — panel má modrou dle návrhu, onboarding a nastavení
   zelenou na 8 místech. Rozhodnutí pro Dana, ne pro mě.
3. Podpis a notarizace — až bude Apple Developer.
4. Ruční ověření na Macu: plná lišta, výpadek zvuku odpojením sluchátek, přehrání
   stereo exportu.

## Čeká na Dana

- **Apple Developer** — na koho zapsat (Individual × firma; mezi nimi se nepřechází).
  Bez něj to jde, ale nepojedou automatické aktualizace ani trvalá oprávnění.
- **Barva hlavního tlačítka** v onboardingu a nastavení.

---

## 🛑 PŘESKOČENÉ TVRDÉ BRÁNY (3. 9. 2026, 00:10)

Běh je **nepřekročil ani neobešel** — přeskočil je a pokračoval po nezávislé větvi DAG.
Plné znění včetně doporučených variant je v `DAN-TODO.md`, sekce „TVRDÉ BLOCKERY".

| # | blocker | doporučení | co na něm viselo |
|---|---|---|---|
| **B1** | Apple Developer — na koho zapsat | **Organization** (firma), pokud má D-U-N-S; jinak Individual | podpis, notarizace, auto-update, trvalá oprávnění |
| **B2** | barva hlavního tlačítka (8 míst) | **sjednotit na modrou** dle panelu | nic — jednořádková změna v `src/styles.css` |

🔴 **Ani jeden neblokuje další vývoj.** Release workflow je hotový a fail-closed: bez pěti
tajemství **selže před spuštěním builderu**, takže nepodepsaná verze nemůže odejít omylem.

## Noc 2./3. 9. — co přibylo po půlnoci

- **PR #36** Nastavení ukazuje skutečný účet (byla tam atrapa „Daniel Novák").
- **PR #37** odesílací vrstva fronty proti změřenému serverovému kontraktu.
  🔴 **Nezapojená**: killswitch `false`, nic se neodesílá, endpointy nejsou živé.
- `main`: **535 passed | 6 skipped (541)**, nula otevřených PR, čistý strom.

### Nový blocker B4 — a je vážnější než ostatní

Desktop se k upload routám **nepřihlásí**: server je autentizuje browser session, desktop má
OAuth Bearer s MCP audience. Odesílání tedy nejde zapnout ani po nasazení migrací.
Předáno serverové session; detail v `DAN-TODO.md`.

### 🔴 Oprava: B4 nebyl blocker

Zapsal jsem „autentizace se nepotkává" jako blocker. **Byla to hranice fází, ne mezera** —
BD-N34 (moje vlastní rozhodnutí) říká, že ve fázi 1 nahrává **prohlížeč pod běžnou session**
a desktop jen uloží soubor a otevře stránku. Cookie session je tedy správně.

PR #37 je **klient pro fázi 2**: hotový, otestovaný, vypnutý. `DESKTOP_UPLOAD_ENABLED=false`
je správný stav, ne nedodělek. Detail a poznámka o scope v `DAN-TODO.md`.

⇒ Poučení: **než z něčeho udělám blocker, ověřím to proti vlastním zapsaným rozhodnutím.**
Tohle jsem měl najít sám v `decisions.md`, ne od kolegů.

## Noc dokončena — adversariální kolo nad celou nocí (PR #38)

Po smergování třinácti PR jsem pustil **review celé noční práce naráz**, protože každý PR
byl recenzovaný zvlášť a pod časovým tlakem. Našlo **tři vady v interakcích** a všechny tři
jsem si ověřil v kódu, než jsem na ně sáhl:

1. 🔴 **„Ukončit LuDone" zahodilo běžící nahrávku.** Vada z PR #33 (mého vlastního, z téže
   noci). Opraveno jedinou bránou v `before-quit` — platí pro menu, `Cmd+Q`, Dock i systémové
   ukončení — s lhůtou 15 s, aby aplikace šla vždycky vypnout.
2. **Aktualizace restartovala přes nepotvrzené pojmenování** a sebrala název i export.
3. **Adresa přihlášení se nezobrazila, když dorazila pozdě** (vada z mého PR #27).

`main`: **548 passed | 6 skipped (554)**, nula PR, nula worktrees, nula větví, čistý strom.

## Fronta práce po ránu 3. 9. (pořadí je záměrné)

1. ⚙ **běží** — šest cest ke ztrátě nahrávky (worktree `desktop-ztrata`). Až doběhne:
   commit, brány, sabotáže, PR, merge.
2. **Retence maže bez kontroly, kde ten soubor leží.** Ověřeno: `validateQueue`
   (`electron/queue.cjs`) kontroluje jen obal fronty — `schemaVersion` a že `items` je pole.
   Obsah položek ne, takže `trackFiles` může být cokoli. `retention.cjs:119` pak volá
   `unlink` na tu cestu **bez kontroly, že leží v adresáři nahrávek**.
   🔴 Nejde jen o útočníka (ten by potřeboval zápis do `userData`, tedy už mít účet) —
   **chrání to i před nehodou**: poškozený zápis fronty by nechal mazat nesmyslné cesty.
   Vzor opravy už v repu je: export používá `path.dirname(filePath) !== downloadsRoot`.
   ⚠️ Nelze dělat souběžně s bodem 1 — oba sahají na `retention.cjs`.
3. Chyby souborového systému jdou syrové do UI i logu (`main.cjs:1537`) — mohou nést
   absolutní cesty a název schůzky. Nízká závažnost, ale je to únik do míst, kde být nemá.
4. `scripts/schuzka-mereni.mjs` zapisuje nezredigovaný název schůzky a absolutní cesty
   do souborů určených k verzování.

**Čeká na Dana** (vše v `DAN-TODO.md`): expozice A/B/C · B5 Electron · B1 Apple Developer ·
B2 barva tlačítka · B3 allowlist · 15 minut ověření naostro.

## Fronta práce — aktualizováno 3. 9. dopoledne

1. ⏳ **PR #40** (šest cest ke ztrátě nahrávky, 589 testů) — čeká na bránu.
   🔴 **CI běží na vlastním runneru `danuv-mac`**, protože repozitář je zase privátní
   a hostované minuty jsou vyčerpané. Byl to předvídatelný důsledek návratu na privátní;
   přepnutí jsem ale udělal až po prvním červeném běhu, ne rovnou.
   ⚠️ Cena: **když je Danův Mac vypnutý, job čeká ve frontě**, nespadne.

2. **Syrové chyby souborového systému jdou do UI i logu** (`electron/main.cjs:1537`).
   `error.message` putuje do hlášky pro uživatele, `error.stack` do logu — a systémová
   chyba (`ENOSPC`, `EACCES`) nese **absolutní cestu, v níž je i název schůzky**.
   **Změřeno, co už hlídá test:** název schůzky v logu ano (`queue-wiring.test.js:1442`),
   **cestu ani hlášku pro uživatele nehlídá nic**.
   *Návrh opravy:* rozlišit vlastní vyhozené chyby (nesou bezpečné české věty) od
   systémových podle `error.code` a ty nahradit obecnou hláškou podle kódu.
   ⚠️ **Až po #40** — `main.cjs` je jeho hlavní soubor, paralelní větev by kolidovala.

3. ✅ **Hotovo:** únik absolutních cest a názvů v `dukazy/` (na `main`).

**Čeká na Dana** (`DAN-TODO.md`): expozice A/B/C · B5 Electron (7 verzí pozadu) ·
B1 Apple Developer · B2 barva tlačítka · B3 allowlist · 15 minut ověření naostro.
