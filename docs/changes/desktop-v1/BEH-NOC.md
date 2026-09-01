# Noční běh — LuDone Desktop v1

**Tohle je zadání, ne konverzace.** Běh se řídí tímhle souborem a soubory, na které odkazuje.
Compaction sežere konverzaci; tenhle dokument ne. Kdo ho čte s prázdným kontextem, má všechno.

---

## Cíl, měřitelně

**Z dvanácti stories `B1`–`B11` mít ráno co nejvíc hotových jako samostatné PR** — každá
s červeným testem viděným napřed, zelenými bránami a přečteným diffem.

Hotovo znamená na čtyřech osách (`spec.md` §3): `delivery: pr-open` · `exposure: disabled`
· `verification: tests-green`. **Nic nesmí ráno tvrdit `verified-live`** — to smí říct jen
člověk, který to viděl běžet.

⚠️ **Neúspěch není „málo stories".** Neúspěch je jedna story, která ráno vypadá hotově a není.

---

## Co je rozhodnuté a kde to leží

| Co | Soubor |
|---|---|
| Proč to děláme | [`intent.md`](intent.md) |
| Co se staví, 16 funkcí, 25 pravidel | [`spec.md`](spec.md) — **zmrazeno, neměnit** |
| Jak, DAG, vlastnictví bloků, PR rozpad | [`plan.md`](plan.md) — **zmrazeno, neměnit** |
| Rozhodnutí M1–M21, S1–S3, A/B/C | [`decisions.md`](decisions.md) |
| Serverový kontrakt (pro JINÝ repozitář) | [`../../server-modul/KONTRAKT.md`](../../server-modul/KONTRAKT.md) |
| Schválený design | `design/approved.json`, náhled `design/navrh/nahled.html` |
| Návrhy sekcí, které neprošly revizí | [`sekce-navrhy/`](sekce-navrhy/) — **nepoužívat jako zadání** |

🔴 **Spec a plán jsou zmrazené.** Když se ukáže, že je v nich chyba, **zapiš ji do
`DAN-TODO.md` a pokračuj po tom, co na ní nezávisí.** Neopravuj spec za pochodu — tím se
ztratí, že se rozhodnutí změnilo.

---

## Pořadí

```
vlna 1 (paralelně)   B1 ui-smoke  ·  B2 čísla B*/BD*  ·  B4 tři vady přihlášení
vlna 2               B3 tray autorita (po B1)  ──▶  B5 časovač do main
vlna 3               B6 výběr projektu · B7 fronta · B8 zapojit auth (po B4)
vlna 4               B9 odhlášení · B11 retence · B10 sdílené zařízení (návrh napřed)
```

**B5 pusť, jakmile je B3 hotová.** Visí na něm pět dalších stories; jeho odklad stojí víc
než jeho složitost.

**B12 se nepouští vůbec** — je to migrace v živé databázi 24 lidí a patří Danovi.

---

## Kdo co staví

**Výchozí vykonavatel je Codex** (`gpt-5.6-sol`), viditelně v Orce:

```
~/.claude/scripts/orca-codex.sh start "B5 časovač do hlavního procesu" "<zadání>"
```

**Claude si nechává B3 a B8** — B3 je architektonická změna, kterou spec fixuje, B8 je
bezpečnostní cesta. A **konsolidaci vždycky**: diff, brány, commit, PR čte a dělá Claude,
i u Codexovy práce.

🔴 **Codex ve worktree needituje git, edituje jen SOUBORY.** `git add`, `fetch`, `merge`,
`checkout` mu v sandboxu spadnou na `Operation not permitted` — index leží mimo pracovní
strom. Do každého zadání patří věta „NEDĚLEJ ŽÁDNOU git operaci"; commituje orchestrátor.

⚠️ **Jedna výjimka, ať si zadání neodporuje:** povolená je `git --no-pager status --porcelain`,
protože jen čte a nesahá na index. Bez té věty vykonavatel buď poruší zákaz, nebo vynechá
baseline — obojí je horší než výjimka napsaná rovnou.

🔴 **Po každém `--write` běhu je první akce `git add -A && git commit`**, teprve pak brány
a sabotáže. Sabotážní kolo končí `git checkout -- .` — nad necommitnutou prací by ji smazalo.

---

## Worktree

**Jeden strom = jeden zapisovatel.** Dva souběžné zapisovatelé si přepíší práci a důkaz
z takového běhu je neplatný, i když obě strany doběhnou „úspěšně".

```
orca worktree create --name desktop-b5 --display-name "Desktop: časovač do main"
```

Devět z dvanácti stories sahá do `electron/main.cjs`. Proto **vlastnictví bloku uvnitř
souboru**, vypsané v `plan.md` §2 výčtem. Zadání pro vykonavatele ten výčet **musí opsat** —
věta „nesahej na cizí" prohraje s prvním „tady to logicky patří taky".

---

## Výchozí stav bran — ZMĚŘENO 1. 9. 2026 ve 22:03

| Brána | Výsledek |
|---|---|
| `npm run lint` | ✅ EXIT=0 |
| `npm run typecheck` | ✅ EXIT=0 |
| `npm run test:unit` | ✅ **77 testů v 9 souborech, všechny zelené** |
| `ui-smoke` | 🔴 **ČERVENÁ** — a je to úkol B1 |

**Baseline je zelený.** Když ráno svítí červená mimo `ui-smoke`, **rozbil ji tenhle běh** —
není to zděděná vada a nehledej ji v historii.

🔴 Příčina červené `ui-smoke` je známá na řádek: `scripts/ui-smoke.mjs:301` klikne na tlačítko
**„Povolit"**, které v `src/components/Onboarding.jsx` po etapě E6 **neexistuje**. Sabotážní
skript se zachoval správně — odmítl měřit nad červeným baseline. B1 je tedy srovnání textů
kroků, ne výkop.

⚠️ `ui-smoke` je v CI vypnutý (`if: ${{ false }}`), protože potřebuje GUI a oprávnění, která
runner nemá komu potvrdit. **CI tuhle třídu regrese z principu nevidí** — proto ta ruční měření.

---

## Definition of Done

1. **Cílený test napřed, viděný červený ze správného důvodu.** Do PR jeho **doslovný výpis**.
2. `npm run lint`, `typecheck`, `test:unit` — všechny EXIT=0, **měřeno před rourou**.
3. **Sabotáž**, která prokazatelně chytá odstranění guardu, s doslovným výpisem.
4. Nejmíň jeden případ, který musí zůstat **zelený** (poměr 2–3 červené : 1 zelená).
5. Diff přečtený Claudem — u money a RBAC povinně.
6. PR nese **Feature ID** a čtyři osy po změně.

🔴 **Kritérium tvaru „nic už nejde zmáčknout" měří součet příčin, ne úspěch.**
Doloženo v B1 dnes v noci: kontrola „všechna oprávnění jsou potvrzená" se ptala na
`disabled === 2`, jenže `Onboarding.jsx:206` je `disabled={state.granted || state.disabled
|| permissionBusy}` — tlačítko je mrtvé při **udělení, odepření i čekání**. Brána by prošla
i na stroji, kde systém přístup ODEPŘEL. Opraveno dotazem na `.permission-row.is-granted`
(commit `0140911`), což je jediný stav znamenající udělení.

**Pravidlo pro každý test v tomhle běhu:** ptej se na stav, který znamená ÚSPĚCH, nikdy na
nepřítomnost akce. A do output contractu dej **počet viděných subjektů** („kolik pokusů /
tiků / řádků jsi napočítal"), ne jen „prošlo". **Nula viděných subjektů je nález, ne zelená.**

🔴 **Brána, která nic nenajde, není zelená — je nezměřená.** Grep bez kanárka, test nad kopií
logiky místo nad produkční funkcí, „neměřeno" vydávané za pass. Tenhle repozitář na tom
v srpnu stál devětkrát; `spec.md` §11 to popisuje.

---

## Co se v noci NESMÍ

- **Merge do `main`** čehokoli, co mění chování aplikace. Dokumenty ano, kód ne.
- **Zapojit frontu k serveru, který neexistuje** (S1 — server je jiný repozitář).
- **Pustit migraci B12.** Migrace na tabulku s existujícími překryvy selže; nejdřív měření.
- **Sahat na `design/**`** — je schválené.
- **Flipnout cizí vypínač.** Jen ten, který patří práci toho běhu.
- **Psát do Tabidoo.** Za všech okolností, i nepřímo.
- **Číst nebo vypisovat secrets** — `.env*`, `*.key`, `*.pem`, `~/.ssh`.
- **Commitnout zvuk ze skutečné schůzky** (`spec.md` R24).
- **Rozmrazit T1** (`fix/tray-prazdna-ikona`) bez Danova slova.
- **Pouštět `ui-smoke` v sandboxu** — potřebuje skutečné okno.

**Při selhání opravuj VADU, ne měřidlo, a nejvýš tři kola.** Zakázané „opravy": změkčení
testu, vypnutí brány, `--force`, `[skip ci]`. Po třetím neúspěchu **zastav, nech PR otevřený
a napiš, co přesně padá.**

---

## Na stopce se PŘESKAKUJE, nezastavuje

Narazí-li běh na rozhodnutí, které patří Danovi: **zapiš ho do `DAN-TODO.md`, napiš doporučený
default a pokračuj po tom, co na něm nezávisí.** Celý běh se zastaví jen tehdy, když bez toho
rozhodnutí není co dělat.

Stopky: ostrý zápis do Tabidoo · flip killswitche · produkční migrace · peníze · mazání dat
· secrets · externí komunikace.

🔴 **Každé rozhodnutí, které běh udělal za Dana, musí být ráno vypsané.** Tichý default je vada.

---

## Zápis

Po každé vlně `▪ CHECKPOINT n/4` — co hotovo, co padá, co přeskočeno.

Ráno plný report `━━━ REPORT · Desktop: noční běh ━━━` se sekcemi Problém · Zadání · Stav
vývoje · Stav nasazení · Otestováno · Otestuj ty · Další krok, plus **Rozhodl jsem sám**
a **Čeká na tebe**.

Značky v „Otestováno" povinně: ✅ ověřeno naostro · 🧪 zelené testy · ⛔ neověřeno.
**„Zelené testy" NENÍ „ověřeno".**

---

## Co čeká na Dana (nedělat za něj)

| Co | Proč |
|---|---|
| Změřit **A6** na skutečné schůzce | Potřebuje živý hovor. Měřidlo `scripts/schuzka-mereni.mjs` |
| **B12** migrace | Živá databáze 24 lidí |
| **A2** Apple Developer Program | Bez něj se nic nerozveze |
| **Pět edge funkcí LuTracku** bez ověřování volajícího | Cizí systém |
| Dostažení podkladů z Claude Designu | Potřebuje `/design-login` |
