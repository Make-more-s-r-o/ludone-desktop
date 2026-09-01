# Plan: LuDone Desktop v1

**Stav: ZMRAZENO 1. 9. 2026** po zodpovězení rozhodovacího balíku. Nadřazené: [`intent.md`](intent.md) · [`spec.md`](spec.md) · [`decisions.md`](decisions.md)

---

## 1. Architecture Spine

Fixuje jen to, v čem by se nezávislí implementátoři mohli rozejít. **Podřízené úkoly tato
rozhodnutí nesmějí předefinovat.**

### Hranice modulů

| Modul | Vlastní | Nesmí |
|---|---|---|
| `electron/main.cjs` | okno, tray, IPC, životní cyklus | rozhodovat o stavu podle rendereru |
| `electron/tracking.cjs` *(nový)* | stav časovače a jeho perzistence | volat server přímo |
| `electron/queue.cjs` | odchozí fronta obou typů položek | znát obsah nahrávky |
| `electron/auth.cjs` | přihlášení, obnova, odvolání | ukládat token jinam než přes `safeStorage` |
| `src/**` (renderer) | **jen zobrazení** | držet stav, který musí přežít pád |
| `src/lib/adapters/**` *(nový)* | překlad do backendu | obsahovat business pravidla |

### Kdo vlastní stav

🔴 **Stav, který musí přežít pád rendereru, vlastní hlavní proces.** Renderer hlásí fakta,
neurčuje stav. To ruší dnešní směr, kde renderer posílá tray svůj názor — a je to jediná
architektonická změna v tomhle plánu.

### Kontrakty

- Server: `POST /api/desktop/recordings`, chunky `PUT …/tracks/{kind}` s Content-Range.
- Čas: **přes adaptér** — rozhodnutí N1 zní „zatím nikam, později přes `app.ludone.cz`",
  takže v1 je implementace adaptéru lokální a serverová se doplní beze změny volajících.
- Identita projektu je **GUID**, nikdy název.

### Jak se vymáhá RBAC

Default-deny na třech osách. Desktop **žádnou z nich nevyhodnocuje sám** — ptá se serveru
a odpověď respektuje.

- v1 vidí každý **jen své vlastní** záznamy; **admin vidí vše** (B2).
- Odebraný z firmy: server data zachová a odepře přístup; desktop přestane odesílat i nabízet,
  **lokální soubory nemaže**.
- 🔴 **Sdílené zařízení `zasedacka@makemore.cz` je v rozsahu v1** (B1) — vlastní story B10.

### Jak se chrání peníze

1. Klient neposílá sazbu. Nikdy.
2. Klíč proti duplikaci vzniká **při startu** časovače.
3. Nabízí se jen projekty s platnou alokací a čerpáním pod 110 %.
4. **Zápis do Tabidoo přímo z desktopu je zakázaný** za všech okolností.

### Vypínače

Dva samostatné: `DESKTOP_UPLOAD_ENABLED` a `DESKTOP_TIME_ENABLED` (C2).
Oba **fail-closed** — chybějící hodnota znamená vypnuto, a to musí mít vlastní test.

### Co tenhle plán NEPOKRÝVÁ

🔴 **Serverovou stranu** (S1). Všech dvanáct stories je desktopových. `ludone-app` je jiný
repozitář s jinými branami a s merge do `main` jako deployem na produkci — patří mu vlastní
průchod masterplánem. Tenhle běh mu předá `docs/server-modul/KONTRAKT.md`.

🔴 **MCP nástroje** (S2) — věc aplikace.

### Rollback

Každá story je samostatně revertovatelná. Žádná migrace v1 (desktop nikam nepíše).

---

## 2. Task DAG

```
B1 ── ui-smoke ────┐
                   ├──▶ B3 tray autorita ──▶ B5 časovač v main ──▶ B7 fronta ⛔C2
B2 ── čísla B*/BD* ┘                              │
                                                  └──▶ B6 výběr projektu ⛔B1
B4 ── přihlášení: 3 vady ──▶ B8 zapojit auth ──▶ B9 odhlášení ⛔B2
```

| # | Úkol | Vykonavatel | Závisí | Blokuje |
|---|---|---|---|---|
| **B1** | Opravit `ui-smoke`, doběhnout sabotáže (b) a (c) | Codex | — | vše |
| **B2** | Přejmenovat běhová čísla na `B*`/`BD*` | Codex | — | plánování |
| **B3** | Přesun autority tray stavu do hlavního procesu | **Claude** | B1 | B5 |
| **B4** | Tři vady přihlášení: časy 5↔10 min, panel mizí, čekání bez konce | Codex | B1 | B8 |
| **B5** | Časovač do hlavního procesu, atomická perzistence | Codex | B3 | B6, B7 |
| **B6** | Výběr projektu z alokací přes adaptér | Codex | B5 | — |
| **B7** | Rozlišovač typu položky ve frontě + zapojení | Codex | B5 | — |
| **B8** | Zapojit `createAuthController` místo atrapy | **Claude** | B4 | B9 |
| **B9** | Odhlášení s odvoláním na serveru | Codex | B8 | — |
| **B10** | 🔴 **Sdílené zařízení** — rozlišit sdílený účet od osobního, přiřazení nahrávky člověku, fronta při střídání lidí | **Claude** návrh, Codex stavba | B8 | — |
| **B11** | Retence 7 dní + nastavení (B3) | Codex | B7 | — |
| **B12** | ⛔ **STOPKA** — zamknout v databázi jeden běžící časovač a zákaz překryvů (B4) | **Dan** | měření překryvů | skutečné napojení času |
| **T1** | Ikona v liště ❄️ **zmrazeno** | hotovo Codexem | — | ruční testování |

**Proč B3 a B8 drží Claude:** B3 je architektonická změna, kterou spec fixuje a která se dotýká
testu zamykajícího opačný směr. B8 je bezpečnostní cesta — masterplán §10 nechává security
na Claudovi.

### Rozvržení do worktrees

🔴 **Původní rozvržení bylo špatně a Codexovo vytěžení to odhalilo.** Devět z dvanácti stories
sahá do `electron/main.cjs`, osm do `electron/preload.cjs` — včetně obou řetězců, které měly
běžet paralelně. Samotná závislost v DAG tedy nestačí; rozhoduje, kdo píše do kterého souboru.

**B1, B2 a B4 paralelně** — ověřeno, že se nepřekrývají: B1 sahá jen do `scripts/ui-smoke.mjs`,
B2 do dokumentů, B4 do `electron/auth.cjs` a okolí.

**Všechno ostatní se sráží.** Řešení není serializovat celý zbytek — je to **vlastnictví bloku
uvnitř souboru**. V tomhle repozitáři to prokazatelně funguje: při běhu 25. 8. psaly tři etapy
souběžně do `electron/main.cjs` ze tří worktrees a **všechny čtyři merge proběhly bez jediného
konfliktu**, protože každá měla vlastnictví zadané jako výčet bloků, ne prózou.

| Story | Vlastní v `main.cjs` | Vlastní v `preload.cjs` |
|---|---|---|
| **B3** | `trayIconName`, `updateTray`, `deriveTrayState`, registrace tray | odebrat `setTrayState` |
| **B4** | `shouldHidePanelOnBlur` a jeho čítače | nic |
| **B5** | registrace `tracking:*` kanálů, hook na pád rendereru | přidat `tracking:*` |
| **B7** | zapojení fronty, `queue:*` kanály | přidat `queue:*` |
| **B8** | `auth:begin` a jeho okolí | `beginAuth` |
| **B9** | `auth:logout` | přidat `logout` |
| **B11** | nic | nic |

🔴 **Task packet musí vlastnictví zadat VÝČTEM, ne větou „nesahej na cizí".** Próza prohraje
s prvním „tady to logicky patří taky"; výčet umí vykonavatel použít jako filtr při každé editaci.

⚠️ **B2, B10 a B12 mají soubory neurčené** a nesmí se pouštět, dokud se neurčí: B2 potřebuje mapu
starých čísel na nová, B10 nejdřív návrh, B12 je Danova migrace mimo tenhle repozitář.

---

## 3. Definition of Done pro každou story

1. Cílený test **napřed** a viděný **červený** ze správného důvodu.
2. `npm run lint`, `typecheck`, `test:unit` — všechny EXIT=0, **měřeno před rourou**.
3. Sabotáž, která prokazatelně chytá odstranění guardu, s **doslovným výpisem**.
4. Nejméně jeden případ, který musí zůstat **zelený** (poměr 2–3 červené : 1 zelená).
5. Diff přečtený Claudem, u money a RBAC povinně.
6. PR odkazuje na Feature ID a tenhle plán.
7. **Bez produkce a bez merge** před Danovým finálním schválením.

## 4. Co se v noci nesmí

Zapojovat frontu k serveru, který neexistuje · sahat na `design/**` · flipovat cizí vypínače ·
psát do Tabidoo · pushovat do `main` · vyrábět výjimku z brány · pouštět `ui-smoke` v sandboxu.

🔴 **A pouštět migraci B12.** Dan ji schválil, ale je to zásah do živé databáze 24 lidí a
**migrace na tabulku s už existujícími překryvy selže**. Nejdřív měření, pak rozhodnutí co
s nalezenými řádky, teprve pak migrace — a ta patří Danovi, ne nočnímu běhu.
