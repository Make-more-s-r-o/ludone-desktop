# Stav běhu — LuDone Desktop v1

**Napsáno 1. 9. 2026 před compaction.** Kdo tohle čte s prázdným kontextem, nepotřebuje původní
konverzaci. Čti odshora, je to seřazené podle toho, co potřebuješ dřív.

---

## Kde všechno leží

| Co | Kde |
|---|---|
| Artefakty změny | `docs/changes/desktop-v1/` na větvi **`orca/desktop-spec-plan`** |
| Pracovní strom | `~/orca/workspaces/ludone-desktop/desktop-spec-plan` |
| Hlavní checkout | `/Users/dan/Dev/ClaudeCode/ludone-desktop` — **musí zůstat čistý**, nepsat do něj |
| Zmrazená implementace T1 | větev `fix/tray-prazdna-ikona`, commit `ce2bea6` |
| Masterplán | `docs/MASTERPLAN.md` (na `main`) |
| Schválený design | `design/approved.json` + náhled `design/navrh/nahled.html` (na `main`) |
| Sjednocený kontrakt | `docs/server-modul/KONTRAKT.md` |

🔴 **Dva zapisovatelé nesmí sdílet strom.** Veškerý zápis jde do Orca worktree.

---

## Co právě běží

| Úloha | Kde je výstup |
|---|---|
| **Codex — vytěžení podkladů** | `…/scratchpad/codex-vytezeni/vystup.md` · log `/var/folders/…/codex-1788289339.log` |
| **Workflow `doplneni-masterplanu`** | šest sekcí + šest skeptiků; výsledek přijde notifikací |
| **Hlídač** | background úloha čeká na `EXIT=` v Codexově logu |

Codex vytěžuje: inventář obrazovek z náhledu · datové modely z kódu · přesné soubory pro každou
story. Workflow píše: user journeys · information architecture · performance · responzivita ·
redaction · audit a observability · transakční hranice · concurrence · live-verification ·
**distribuce přes veřejný GitHub**.

---

## Co udělat, až obojí doběhne

1. **Zkonsolidovat bloky** do `spec.md` a `plan.md` — workflow je vrací hotové k vložení.
2. **Feature matrix na čtyři osy** (`scopeStatus`, `deliveryStatus`, `exposureStatus`,
   `verificationStatus`). 🔴 Dnešní tabulka má jeden sloupec „stav" — a masterplán §8 to
   výslovně zakazuje. Tenhle projekt už jednou stálo devět zelených bran nad nehotovou prací.
3. **PR-sized rozpad stories** B1–B12.
4. **Říct Danovi, že může pustit Fable** — prompt je v `PROMPT-FABLE.md` vedle tohohle souboru.
5. Teprve po Fable review a Danově schválení: implementace **v nové session**.

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
