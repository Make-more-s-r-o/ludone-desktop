# Stav běhu — LuDone Desktop v1

**Napsáno 1. 9. 2026 před compaction.** Kdo tohle čte s prázdným kontextem, nepotřebuje původní
konverzaci. Čti odshora, je to seřazené podle toho, co potřebuješ dřív.

---

## Kde všechno leží

| Co | Kde |
|---|---|
| Artefakty změny | `docs/changes/desktop-v1/` — **vše je v `main`** (1. 9. 2026, 21:50) |
| Zadání nočního běhu | [`BEH-NOC.md`](BEH-NOC.md) — podle něj běh jede |
| Pracovní strom pro spec | ✅ zrušen, větev `orca/desktop-spec-plan` mergována a smazána |
| Zmrazená implementace T1 | větev `fix/tray-prazdna-ikona`, commit `ce2bea6` |
| Masterplán | `docs/MASTERPLAN.md` (na `main`) |
| Schválený design | `design/approved.json` + náhled `design/navrh/nahled.html` (na `main`) |
| Sjednocený kontrakt | `docs/server-modul/KONTRAKT.md` |

🔴 **Dva zapisovatelé nesmí sdílet strom.** Veškerý zápis jde do Orca worktree.

---

## Co doběhlo

| Úloha | Výsledek |
|---|---|
| **Codex — vytěžení podkladů** | ✅ `podklady-vytezene.md`; odhalil, že 9 z 12 stories sahá do `main.cjs` |
| **Workflow `doplneni-masterplanu`** | ⚠️ 12 z 13 agentů; třináctý se zasekl (20 min ticha) a byl zastaven |

🔴 **Skeptici našli v návrzích sekcí nepravdy**, takže se do zmrazeného specu **nevložily celé**.
Leží v [`sekce-navrhy/`](sekce-navrhy/) s revizemi vedle. Do `spec.md` §11 šlo pět pravidel,
která revizi přežila — mezi nimi dvě money (R21 časovač po pádu se ptá, R22 klíč přežije ztrátu
manifestu) a jedno nevratné (R24 zvuk ze schůzek nikdy do gitu).

---

## 🔴 Pořadí, které určil Dan

**Design je POSLEDNÍ.** Dostažení zbylých podkladů z Claude Designu (`SmerA/B/C.jsx`, referenční
návrhy, tokeny písma/tvaru/pohybu/mezer, ikony a loga) se dělá **až na konci**, ne teď.

Blokuje to autorizace — po přepnutí Claude účtu `DesignSync` vyžaduje `/design-login`, který
musí spustit Dan. **Nic to nezdržuje:** schválený návrh je kompletní v `design/navrh/`
(6 artboardů + náhled s 23 obrazovkami) a `design/canvas/` má 10 artboardů z 24. 8.

⚠️ Jediné, co chybí věcně: **tokeny mimo barvy**. Písmo, tvar, pohyb a mezery jsou opsané
z artboardů, ne ze zdroje — takže implementátor nemá kde vzít `--space-3` nebo poloměr z DS.
Doplnit při tom závěrečném stažení.

## Hotovo — masterplán je uzavřený

1. ✅ **Feature matrix na čtyři osy** — `spec.md` §3. Jeden sloupec „stav" je pryč.
2. ✅ **PR-sized rozpad** B1–B11 — `plan.md` §2b.
3. ✅ **Zadání nočního běhu** — `BEH-NOC.md`.
4. ✅ **Rozhodnutí za Dana i stopky** — `DAN-TODO.md`.
5. ⏭️ **Implementace v nové session** — prompt v `PROMPT-IMPLEMENTACE.md`.
6. ⏭️ **Úplně nakonec**: `/design-login` a dostažení zbylých podkladů z Claude Designu.

---

## Rozhodnutí, která platí

Plné znění v `decisions.md`. Nejdůležitější, ať se neztratí:

- **M4** — masterplán vyhrává; globální „dotáhni to sám až na prod" se v tomhle repu **ruší**.
- **M9/M10** — jedna aplikace, dvě agendy; desktopový LuTrack je **jen časovač**.
- **M15/M16** — **kalendář zrušen**, varianta Divergent s ním padla.
- **M17–M20** — klidová agenda jeden řádek · Dock vypnutý s přepínačem · pojmenování při stopu ·
  připomínky když neběží časovač.
- **S1** — **serverová strana není v rozsahu**; dostane vlastní průchod masterplánem v `ludone-app`.
- **S2** — **MCP řeší aplikace**, ne desktop.
- **A1** — nahrávat **kdykoli**, nečeká se na právní rámec (přijaté riziko).
- **B1** — každý vidí **jen svoje**, admin vše; **sdílené zařízení `zasedacka@makemore.cz` JE v v1**.
- **B4** — pravidla časovače **zamknout v databázi**, ale 🔴 **jako stopka**: migrace na tabulku
  s existujícími překryvy **selže**, takže nejdřív měření a pustí ji Dan.

### Rozhodnuté orchestrátorem, ne Danem

Kontrakt `/api/desktop/recordings` · **statická** registrace klienta · přejmenování běhových
čísel na `B*`/`BD*` · neplatit GitHub Pro.

---

## Co čeká na Dana

| Co | Proč to nejde za něj |
|---|---|
| **Změřit A6 na skutečné schůzce** | Potřebuje sluchátka a živý hovor. Měřidlo: `scripts/schuzka-mereni.mjs` |
| **B12 migrace** | Zásah do živé databáze 24 lidí |
| **Pustit Fable review** | Prompt v `PROMPT-FABLE.md` |
| 🔴 **Pět edge funkcí LuTracku bez ověřování volajícího** | Patří majiteli LuTracku, ne sem |

---

## Co se v tomhle běhu naučilo a nesmí se zapomenout

🔴 **Lifecycle proběhl v obráceném pořadí.** `intent.md` a `spec.md` vznikly zpětně, po designu
a po implementaci. T1 je proto zmrazená na větvi. Audit to vede jako O1–O9.

🔴 **Codexovu zelenou bránu je nutné přeměřit.** Tvrdil `lint EXIT=0`, ve skutečnosti byla 1.
Chyba byla orchestrátorova, ale tvrzení nepravdivé.

🔴 **Měřidlo ověřené jen vlastními scénáři lže.** `schuzka-mereni.mjs` v první verzi prohlásilo
tři gongy za funkční zachycení a samo napsalo „nese řeč po dobu 0:00". Odhalilo to až povinné
pole „čím se to dá oklamat" — skeptici našli šestnáct způsobů.

🔴 **Zachycení systémového zvuku stojí na cestě, kterou Chromium považuje za nepodporovanou.**
`IsSystemLoopbackCaptureSupported()` vrací na macOS 26.4 false. Plán B je `audiotee`
(Core Audio taps), architektura, na které stojí Plaud.

⚠️ **Slib z `intent.md` „nahrávka doputuje sama" v téhle vlně nelze splnit** — server není
v rozsahu. Vědomé, ne opomenutí.
