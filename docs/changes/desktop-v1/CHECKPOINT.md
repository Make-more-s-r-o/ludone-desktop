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
