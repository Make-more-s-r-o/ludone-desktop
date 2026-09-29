---
status: draft
approvedBy:
approvedAt:
sha:
approvedVia:
---

# Plán — LuDone Desktop 0.1.6: celý schválený směr Astra (`desktop-astra-parity-0-1-6`)

<!-- Značka pro schvalovací hook; schválení zapisuje pouze masterplan harness. -->
[masterplan:plan-approval:desktop-astra-parity-0-1-6]

`approvedVia` po schválení smí obsahovat pouze `hook` nebo `manual`.

## Kontext

Uživatel aktualizoval 0.1.5 a nahlásil, že skutečná aplikace neodpovídá vybrané plné variantě Astra. Manifest vydání potvrzuje omezený L1 výřez. Tato změna dokončuje skutečný desktopový uživatelský tok a před vydáním zavádí výslovnou E2E designovou bránu. LuTrack, server, webová aplikace a týmové funkce jsou mimo rozsah.

Závazné vstupy: `intent.md`, `project-context.md`, `discovery.md`, `outcome-contract.md`, `artifacts/design/design-manifest.md`, `artifacts/design/approved.json` a `spec.md`.

## Změřeno

| co | hodnota | čím |
|---|---|---|
| Verze aplikace | `0.1.6` | `package.json` |
| Panel | 400 CSS px pevná šířka | `electron/main.cjs` |
| Nastavení | 640×744 CSS px oddělené okno | `electron/main.cjs` |
| Schválená Astra | 400×700 panel, 640×744 větší plocha, 14 scénářů, 3 témata | `round2/variants/astra/manifest.json` |
| Zásadní odchylka | Nastavení/fronta existují, jednotná plocha „Můj den“ a shodný shell v aplikaci chybí | `src/App.jsx`, `Settings.jsx`, screenshot 24. 9. |
| Aktuální UI E2E | Electron E2E testuje hlavní tok i geometrii obrazovek a ukládá screenshoty; vizuální porovnání zůstává lidskou kontrolou | `scripts/astra-design-e2e.mjs`, `scripts/ui-smoke.mjs` |
| Závislosti | `node_modules` existuje v hlavním checkoutu; instalace se neplánuje | filesystem |

## Rozhodnutí zadavatele

| rozhodnutí | závazný obsah | dopad na plán |
|---|---|---|
| [D1](decisions.md#d1--implementovat-celý-schválený-návrh-astra-nit-dne) | Celá varianta Astra | L2 design parity přes všechny plochy. |
| [D2](decisions.md#d2--lutrack-zůstává-pouze-připraveným-placeholderem) | LuTrack zatím neimplementovat | Žádný časovač ani serverová synchronizace. |
| [D3](decisions.md#d3--produktová-data-nejsou-data-prototypu) | Skutečná data, ne demo | UI nepřebírá prototypové záznamy/stavy. |
| [D4](decisions.md#d4--před-dalším-vydáním-musí-projít-designová-e2e-brána) | E2E shoda před release | Bez zelené přejímky není tag ani publikace. |
| [D5](decisions.md#d5--zachovat-serverové-a-ipc-hranice) | Beze změny serveru a ochrany IPC | Security review všech změněných hranic. |

## Průběžný stav implementace (30. 9. 2026)

- 🧪 Shell, Teď, Můj den, detail místní nahrávky, Nastavení a témata jsou v pracovním stromě implementované. LuTrack zůstává vypnutý.
- 🧪 `npm run test:design:e2e`: 12 akceptačních skupin, 30 automatických podmínek a 5 dvojic screenshotů; geometrické kontroly čtyř ploch prošly. Nezávislé vizuální review po opravě Nastavení nenašlo problém P1/P2. Výpisy a snímky jsou v `evidence/e2e-2026-09-29/astra-layout-final/`.
- 🧪 `npm run gates`: lint, typecheck, 76 testovacích souborů, 1 567 PASS a 3 baseline skipy; exit kód 0.
- 🟡 Skutečné oprávnění mikrofonu, přihlášení, produkční upload, veřejný aktualizační feed a instalaci ještě neověřil člověk na Macu.
- ⚠️ Strojové schválení zůstává `draft`/`plan-approved`; tento odstavec je pouze lidsky čitelný průběžný záznam a nenahrazuje zápis přes masterplan harness.

## Architecture Spine

### Shell rychlého panelu a větší pracovní plochy

- **Odpovědnost:** Teď otevře rychlý panel; Můj den a Nastavení použijí větší plochu se stejnou značkou a navigační logikou.
- **Rozhraní:** Stávající `window.ludone` IPC; hash Nastavení zůstane `#settings`. Nová velikostní/route zpráva bude úzce validovaná a povolená jen pro důvěryhodné okno.
- **Invariant:** Hlavní proces zůstává autoritou pro pozici, velikost, focus a sender guard; operace nahrávání používají původní povolené IPC.
- **Bezpečné selhání:** Když rozšíření okna selže nebo není plocha dostupná, navigace otevře současné podporované Nastavení a obsah zůstane čitelný.

### Skutečná data dne a detailu

- **Odpovědnost:** Složit skutečné lokální/serverové položky do Astra stopy dne.
- **Rozhraní:** Existující queue snapshot, recording dashboard, status verifier a stávající akce.
- **Invariant:** Data se neodvozují z fiktivních příkladů; neověřený serverový stav se nevydává za ověřený; audio souhlas se nemění.
- **Bezpečné selhání:** Neznámá firma, vlastník, serverový stav nebo síť se zobrazí jako neověřeno/čeká s konkrétním důvodem.

### Designová E2E brána

- **Odpovědnost:** Ověřit sestavený renderer v Electronu a zachytit klíčové stavy podle schválené varianty.
- **Rozhraní:** Samostatný lokální test fixture/ovladač bez produkčních tokenů a bez uploadu; screenshoty Teď, Můj den, detail, Nastavení, offline/recovery, update a identity.
- **Invariant:** Test nesmí vyvolat skutečné nahrávání ani produkční zápis; scénáře a fixture jsou výlučně testovací.
- **Bezpečné selhání:** Chybějící screenshot, navigace, očekávaný stav nebo porovnání vrátí neúspěch a blokuje release.

## Dělba práce a DAG

| # | etapa | akceptační kritérium | KDO |
|---|---|---|---|
| T-01 | Zjištění, designový kontrakt a zachování schválené makety | Všechna rozhodnutí, odchylky a bezpečnostní hranice jsou explicitní; masterplan lint projde. | Codex koordinátor |
| T-02 | Sjednocený shell a navigace | Přechody Teď/Můj den/Nastavení, zachované role IPC, korektní velikost/pozice a přístupnost. | Codex — po T-01 |
| T-03 | Teď, záznam a uložení | Vzhled odpovídá Astrě; existující audio, názvy, „Uložit a odeslat“ a místní uložení fungují beze změny souhlasu. | Codex — po T-02 |
| T-04 | Můj den a detail | Reálné lokální a ověřené položky, skutečné stavy a akce; LuTrack zůstává neaktivní. | Codex — po T-03 |
| T-05 | Nastavení, onboarding, identita a update | Soudržná Astra kompozice a funkční stávající účet/audio/fronta/retence/diagnostika/updater. | Codex — po T-04 |
| T-06 | E2E designová přejímka | Electron E2E pořídí důkazy pro světlo/tmu a klíčové cesty; individuální PASS/FAIL a přímé vizuální review; bez produkčního uploadu. | Codex — po T-05 |
| T-07 | Review, release candidate a publikace | `npm run gates`, build, E2E, nezávislé review a podepsané workflow projdou; tag/publikace až po všech branách. | Codex koordinátor — po T-06 |

## Hotspot soubory

| soubor | vlastník | proč je hotspot |
|---|---|---|
| `src/App.jsx` | T-02/T-03 | Root renderer, panel, navigace a recording handoff. |
| `src/styles.css` | T-02–T-05 | Sdílené plochy a systém témat; jeden zapisovatel postupuje sekvenčně. |
| `electron/main.cjs` | T-02 | Okna, důvěryhodné odesílatele, sizing a focus. |
| `electron/preload.cjs` | T-02 | Úzká renderer capability API; měnit jen pokud je nezbytné. |
| `src/components/Settings.jsx` | T-02/T-05 | Uživatelovy povolení, účet a nastavení; zachovat hash guard. |
| `scripts/astra-design-e2e.mjs` | T-06 | Samostatná E2E brána a důkazy; nesmí oslabit `ui-smoke`. |

## Měřítko

1. Každý odkaz v Astra navigaci skončí na skutečné, čitelné ploše bez ztráty rozpracovaného záznamu.
2. Skutečné stavy lokálního/serverového záznamu, oprávnění a update odpovídají UI; žádné demo hodnoty se nepropíší do uživatelských dat.
3. E2E vytvoří screenshoty pro všechny kritické stránky ve světlém/tmavém tématu, přehled PASS/FAIL a viditelný diff proti Astra referenci.

## Pasti

- 🔴 **Rozšíření IPC plochy:** každá nová zpráva musí ověřit frame a sender role; stávající negativní testy guardu zůstávají povinné.
- ⚠️ **Demo UI vs. produkční data:** statická simulace prototypu nesmí uniknout do běžné aplikace ani screenshotu produktu.
- ⚠️ **E2E na Macu:** CI nemůže nahradit kontrolu skutečného okna a povolení; pokud prostředí GUI není dostupné, release zůstává čekající.

## Hranice autonomie

Běh **NESMÍ**:

- měnit backend, LuTrack, webovou aplikaci ani cizí `design/`;
- přidat fake timer, falešná data, upload bez výslovného souhlasu či novou serverovou capability;
- měnit/obcházet gate, vytvářet výjimku nebo baseline, vydat tag před E2E;
- zveřejnit secret nebo upravit podepisovací klíč.

## Definition of Done — ČÍM to ověřím

| # | etapa | ČÍM to ověřím |
|---|---|---|
| T-01 | Zjištění | `mp-lint` změny a kontrola schváleného Astra prototypu; žádné nevyřešené produktové otázky. |
| T-02 | Shell | `npm run gates`, IPC sender guard, navigační E2E v Electronu. |
| T-03 | Teď | `npm run gates`, stávající nahrávací testy, E2E capture idle/nahrávání/uložení. |
| T-04 | Den a detail | queue/dashboard testy, E2E lokální/odeslaný/error/offline, test nulového LuTrack zápisu. |
| T-05 | Nastavení | Settings/auth/update testy a E2E všech karet plus update banner. |
| T-06 | Design | Zelená designová E2E, doslovný log s exit kódem, screenshoty v `evidence/e2e-2026-09-29/astra-layout-final/` a nezávislé vizuální review; skutečné GUI omezení se přizná. |
| T-07 | Předání | `npm run gates`, `npm run build`, review diffu, CI a release workflow; bez zeleného T-06 se nepokračuje k tagu. |

## Odhad

Celkem 16–24 hodin čisté práce: T-01 1h, T-02 3–4h, T-03 2–3h, T-04 3–5h, T-05 2–4h, T-06 3–5h, T-07 2–3h. Zahrnuje implementaci, integraci a lokální kontroly; čekání na běh CI nebo fyzickou Mac přejímku může kalendářní čas prodloužit.
