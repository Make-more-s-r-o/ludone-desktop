---
status: approved
approvedBy: "Dan (výslovný pokyn: samostatně implementovat vybraný Astra směr a vydat 0.1.5; aktualizace pouze zpřesňuje již schválený rozsah a důkazy)"
approvedAt: 2026-09-24T00:34:48Z
sha: bfec9869ecd197a5ca9e419ed4333e99a3b7b33ac6e8423ec2b1bd9d4ac9abce
approvedVia: manual
---

# Plán — LuDone Desktop 0.1.5: Astra Nit dne (`desktop-astra-0-1-5`)

[masterplan:plan-approval:desktop-astra-0-1-5]

## Kontext

Výchozí LuDone Desktop 0.1.4 už umí nahrávat, uchovávat nahrávky lokálně, odesílat je do `app.ludone.cz` a kontrolovat aktualizace. Dan zvolil Astra směr a požádal o samostatnou přípravu další verze. LuTrack zatím není funkční a výslovně není v rozsahu integrace.

Závazné vstupy: `intent.md`, `project-context.md`, `outcome-contract.md`, `decisions.md`, `spec.md`, `artifacts/design/design-manifest.md` a `artifacts/design/approved.json`.

## Změřeno

| co | hodnota | čím |
|---|---|---|
| Výchozí verze | `0.1.4` | `package.json` a git tag `v0.1.4` |
| IPC oprávnění okna Nastavení | systémový zvuk přijímá jen přes hash `#settings` | `electron/main.cjs` a `tests/ipc-sender-guard.test.js` |
| Plné projektové brány | 76 souborů; 1 557 PASS, 3 baseline skipy | `npm run gates`; doslovný výpis je v `evidence/tests/npm-gates.log` |
| Produkční sestavení rendereru | PASS | `npm run build`; doslovný výpis je v `evidence/tests/npm-build.log` |

## Rozhodnutí zadavatele

| rozhodnutí | závazný obsah | dopad na plán |
|---|---|---|
| [D1](decisions.md#d1--pro-015-použít-směr-astra-nit-dne) | Směr Astra, zachovat oba návrhy | Malé cílené úpravy desktopu bez přestavby všech funkcí. |
| [D2](decisions.md#d2--lutrack-zůstává-vypnutý-do-připravenosti-služby) | LuTrack nepřipojovat | V panelu jen nepoužitelný a pravdivý stav. |
| [D3](decisions.md#d3--zachovat-bezpečnostní-identitu-nastavení) | `#settings` zachovat, předat záložku query parametrem | Rozšířit testy trasování i bezpečnostních kontrol. |
| [D4](decisions.md#d4--verzi-015-připravit-a-vydat-desktopovým-workflow) | Vydat `0.1.5` přes zavedený workflow | Po merge a zeleném CI pushnout tag a sledovat release. |

## Architecture Spine

### Okno Nastavení

- **Odpovědnost:** Jedno skutečné okno Nastavení vlastní volbu aktivní záložky.
- **Rozhraní:** Panel zavolá `openSettings("recordingQueue")`; při startu se použije `?settingsTab=recordingQueue`, u již otevřeného okna validovaná událost IPC.
- **Invariant:** Hash zůstává `#settings`; renderer nepředává libovolný název záložky a dashboard zůstává jediným zdrojem stavu nahrávek.
- **Bezpečné selhání:** Neznámý tab se odmítne bez vytvoření dalšího okna; nepodařený IPC požadavek nezmění stav nahrávky.

### Budoucí LuTrack

- **Odpovědnost:** UI pravdivě označí nepřipravenou funkci.
- **Rozhraní:** `TrackingCard` dostane `disabled` a neprovádí časové ani síťové akce.
- **Invariant:** V této verzi se neukládá ani neposílá čas a nevytváří se náhražkový timer.
- **Bezpečné selhání:** LuTrack zůstane nedostupný a uživatel může dál používat nahrávání.

### Značka a tray

- **Odpovědnost:** Aplikace i lišta používají čitelnou značku LuDone a rozlišují stav pozornosti.
- **Rozhraní:** Oficiální `src/assets/LuDone.svg`; tray PNG generuje `scripts/tray-ikony.mjs`.
- **Invariant:** Původní tvar značky zůstává; ztráta zvuku má samostatný viditelný znak.
- **Bezpečné selhání:** Neúspěšný generátor nebo obrazový test zastaví vydání.

## Dělba práce

| # | etapa | akceptační kritérium | KDO |
|---|---|---|---|
| T-01 | Značka, přístup k Nahrávkám a šířka panelu | Navigace vede na reálný dashboard; IPC bezpečnostní testy zůstávají zelené. | Codex — integrační větev |
| T-02 | Pravdivý stav LuTracku | Disabled karta neposkytuje start, nepřidá čas a zachová ostatní systémové akce. | Codex — po T-01 |
| T-03 | Review, brány a vydání 0.1.5 | Plné `npm run gates`, build/akceptace, diff review, PR a zelené CI; signed release workflow po merge/tagu. | Codex — po T-01 a T-02 |

## Hotspot soubory

| soubor | vlastník | proč je hotspot |
|---|---|---|
| `electron/main.cjs` | T-01 | Hlavní proces a IPC hranice oken. |
| `electron/preload.cjs` | T-01 | Úzké API vystavené rendereru. |
| `src/components/Settings.jsx` | T-01 | Navigace účtu, oprávnění a nahrávek. |
| `src/features/tracking/TrackingCard.jsx` | T-02 | Riziko falešného zápisu času. |
| `scripts/tray-ikony.mjs` | T-01 | Všechny stavové ikony a jejich automatické brány. |

Každý soubor mění právě jeden task; změny jsou v jednom worktree a pořadí určuje DAG.

## Měřítko

1. Přímá navigace do Nahrávek projde testem rendereru i hlavního procesu; parametr záložky neobejde sender guard.
2. LuTrack není možné omylem spustit a nevytvoří časový záznam ani po tray požadavku.
3. Přesný release `0.1.5` projde projektovými branami; živé audio/upload/update zůstávají do testu uživatelem označeny 🟡.

## Pasti

- 🔴 **Hash pro audio oprávnění:** alternativní route v hash by uzamkla systémový zvuk Nastavení — ověřit testy sender guard a přímou URL.
- ⚠️ **Generované ikony mohou být rozmazané nebo ztratit stav při převodu:** spustit `npm run ikony` a obrazové testy.
- ⚠️ **Plný GitHub release závisí na pracovním podpisovém klíči a secrets:** zelený CI před tagem; výsledný podpis a veřejný update ověřit po spuštění workflow.

## Hranice autonomie

Běh NESMÍ:

- měnit backend, serverový kontrakt, web LuDone, repo LuTrack nebo cizí `design/`;
- vytvářet funkční lokální časovač jako náhradu LuTracku;
- oslabit testy, IPC guardy, akceptační brány nebo vytvořit novou výjimku/baseline;
- označit skutečný zvuk, upload, instalaci či aktualizaci za ověřené bez fyzického průchodu na Macu.

Uživatelský příkaz výslovně povoluje implementaci, průběžné commity, PR a vydání přes existující workflow. Live test schůzky zůstává na Danovi.

## Definition of Done po etapách — ČÍM to ověřím

| # | etapa | ČÍM to ověřím |
|---|---|---|
| T-01 | Značka a navigace | `npm run gates`; `npx vitest run tests/settings.test.js tests/queue-wiring.test.js tests/ipc-sender-guard.test.js`; očekávání: přímé otevření Nahrávek a platný `#settings`; výstup v `evidence/tests/`. |
| T-02 | LuTrack placeholder | `npx vitest run tests/tracking-card.test.js tests/queue-wiring.test.js`; očekávání: disabled state a žádné volání časovače; výstup v `evidence/tests/`. |
| T-03 | Review a release | Úplné gates + GitHub CI + release run a read-only kontrola feedu; signed package; odkazy a výpisy pod `evidence/`. Ověření zvuku na Macu zůstává čekající. |

## Rollback

Vratitelný rollback: revert commit 0.1.5 a vrátit distribuci na poslední podepsanou 0.1.4; nepřepisovat veřejný feed ručně. Změny backendu ani schématu nevznikají.
