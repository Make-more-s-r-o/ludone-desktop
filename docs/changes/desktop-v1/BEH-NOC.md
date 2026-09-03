# BĚH NOC 3./4. 9. 2026 — LuDone Desktop

Psáno pro někoho s **prázdným kontextem**. Konverzaci sežere compaction, tenhle soubor ne.
Předchozí briéf (1. 9.) je uložený vedle jako `BEH-NOC-2026-09-01.md` — **je vyčerpaný**,
neřiď se jím.

## Výchozí stav — ZMĚŘENO 3. 9. 2026 v 18:40

| | |
|---|---|
| `main` | `fea2841`, **731 passed \| 3 skipped (734)** |
| brány | `npm run gates` = lint · typecheck · test:unit · **preskocene** |
| otevřené PR | 0 · worktrees 0 · větve `orca/*` 0 |
| Electron | **39.8.10**, minimum macOS 12 deklarované |
| dnes mergnuto | **20 PR (#41–#57)** |
| ověřeno naostro | 3 funkce, z toho 🔴 **stereo separace kanálů** (Dan přehrál soubor) |

## První příkazy po probuzení

```bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
git fetch -q origin main && git status --porcelain      # musí být prázdné
gh pr list                                               # musí být prázdné
gh api repos/Make-more-s-r-o/ludone-desktop/actions/runners --jq '.runners[].status'
uptime                                                   # 🔴 viz past níž
```

⚠️ **Runner musí být `online`.** Repozitář je privátní, hostované minuty vyčerpané,
CI běží **výhradně na Danově Macu**. Když Mac spí, job **čeká ve frontě** místo aby spadl —
nevypadá to jako chyba, ale nic se nezměří.

## Cíl, měřitelně

Ráno musí platit:
1. Lišta umí **všech osm stavů** ze schváleného návrhu, nebo je přesně zapsáno, proč ne.
2. Nahrávka pořízená odhlášeně jde **potvrdit a odeslat** vědomým klikem.
3. Adversariální kolo nad dneškem doběhlo a jeho nálezy jsou **buď opravené, nebo zapsané**.
4. `main` je zelený, PR nula, worktrees nula.

## Pořadí a KDO

| # | etapa | akceptační kritérium | kdo |
|---|---|---|---|
| ~~0~~ | ✅ **HOTOVO 3. 9. ve 19:40, PR #57** — patička dělí „čeká" a „čeká na potvrzení" | | |
| 1 | **Adversariální kolo nad dneškem** | seznam nálezů s `soubor:řádek`, každý ověřený | Codex (čtecí) |
| 2 | opravy potvrzených nálezů | sabotáž na každý | Codex + Claude konsolidace |
| 3 | **tři stavy lišty** (fronta · výpadek zvuku · bez spojení) | stav se v liště pozná; kontrakt faktů rozšířen vědomě | Codex |
| 4 | **potvrzení nahrávky bez vlastníka** | člověk ji vidí a může ji přiřadit sobě | Codex |
| 5 | úklid + CHECKPOINT | 0 PR, 0 worktrees, zápis | Claude |

**Etapa 1 má přednost.** 19 PR za den je hodně změn a dnes **jednu moji regresi našla až
vedlejší úloha**, ne já — hledat vlastní chyby je levnější než je ráno vysvětlovat.

## 🔴 Etapa 3 sahá na kontrakt, který hlídá 53 testů

`REPORTED_FACT_KEYS = ["signedIn", "tracking"]` je jediné, co brání tomu, aby renderer začal
**určovat stav** místo **hlásit skutečnost**. Tři chybějící stavy nové fakty potřebují:

| stav | co chybí | kde to dnes žije |
|---|---|---|
| čeká fronta | počet neodeslaných | hlavní proces frontu vlastní |
| **výpadek zvuku** | stav zvukové cesty | 🔴 **jen v rendereru**, `RecordingCard.jsx:214` |
| bez spojení | dostupnost sítě | nikde |

⚠️ **U každého faktu nejdřív změř, kdo je jeho autorita.** Když ji má hlavní proces,
kontrakt se nerozšiřuje vůbec. Rozšířit ho smíš jen tam, kde autoritou opravdu je renderer —
a v PR to zdůvodni. Návrh k tomu říká: *„je to právě chvíle, kdy je panel zavřený"*.

## ✅ ETAPA 0 JE HOTOVÁ (PR #57) — ponecháno jako doklad, co se řešilo

`src/lib/panel.js`, `queueFooterStatus()` počítá položky **jen podle `state`**
(`ceka` · `odesila` · `odeslano` · `selhalo`). Jenže PR #56 zavedl pauzy s důvody
`queue_owner_mismatch`, `queue_owner_unknown` a `session_owner_unknown` — a všechny
zůstávají ve stavu **`ceka`**.

⇒ **„Nahrávka patří jinému účtu" vypadá v panelu úplně stejně jako „čeká na odeslání".**
Uživatel se nikdy nedozví, že se ta nahrávka neodešle, dokud něco neudělá.

`reason` z `pump()` existuje (`electron/queue.cjs:801`), do panelu se ale nedostal.

**Vyřešeno:** patička dělí `1 čeká · 1 čeká na potvrzení`. Klasifikace je na **jediném místě**
(`failureCodeRequiresHumanAction`) a je **fail-closed** pro celou rodinu `*_owner_*` — nový
vlastnický důvod je raději vidět zbytečně než schovaný mezi čekajícími.

🔴 **Zbývá:** obrazovka, kde nahrávku bez vlastníka někdo **potvrdí a odešle**. Dnes ji jen
poctivě vidí, ale nemá s ní co dělat. To je etapa 4.

⚠️ **Návrh pro tenhle stav text NEMÁ** — má jen „čeká fronta". Použij nejbližší formulaci
z návrhu, **nevymýšlej nový slovník**, a do PR napiš, co jsi použil a proč. Když by to
znamenalo vymyslet novou obrazovku, **udělej jen to, aby počet nelhal**, a zbytek zapiš.

## 🔴 ZÁVAZNÉ ZÁVISLOSTI SERVEROVÉ STRANY — nerozbít

Potvrzeno serverovou session 3. 9. Předávková cesta je **živá a v produkci funguje**:

1. **Tvar adresy** `/nahravky/nahrat?clientRecordingId=…&startedAt=…&endedAt=…&nazev=…`.
   Kdyby se změnil, přestane fungovat **jediné dnes funkční propojení**.
2. **`clientRecordingId` musí zůstat UUID v1–5** (generujeme v4) a **stabilní přes
   opakování** — stojí na tom jejich idempotence.
3. 🔴 **Nikdy neposílat sazbu.** Whitelist `{ projectId, startedAt, endedAt }` to drží
   konstrukcí; kdyby se ta struktura rozšiřovala, tohle pravidlo nesmí povolit.

## 🛑 CO SE V NOCI NESTAVÍ, i když to spec popisuje

Sekce specu o **scope `mcp:upload`, výběru firmy, rozdělané frontě a dělbě odpovědnosti**
jsou **CÍL, ne stav**. Server ten scope **nezná** — existuje jen `mcp:read` a `mcp:draft`
a endpoint pro přímé odesílání neexistuje.

⇒ **Nedotýkat se toho ani za vypnutým killswitchem.** Kód proti neexistujícímu rozhraní
nikdo neověří a ráno vypadá hotově.

## 📦 DROBNÝ ÚKOL PRO SERVEROVOU SESSION (levný, udělej ho)

Vyrob **po jednom ukázkovém souboru z každého exportního režimu** — dvoustopý a jednostopý
s tichem vpravo — a ulož je tak, aby si je serverová session mohla vzít. Jejich přepisová
cesta byla dosud měřená **jen na souborech z Plaudu**, tedy na cizím formátu; náš skutečný
výstup nikdy neviděli.

🔴 **Zvuk ze skutečné schůzky se necommituje.** Vygeneruj syntetický (tón, šum, cokoli),
krátký. Jde o **formát**, ne o obsah.

## Past, která dnes stála 36 minut

Codexova úloha vypadala zamrzle. **Nebyla to vada Codexu:** `uptime` ukázal
**load average 143**, protože Spotlight indexoval `node_modules` z deseti worktree.

🔴 **Než z nehybného logu usoudíš na mrtvý job, spusť `uptime`.** A když je job mrtvý,
**podívej se do worktree — práce tam bývá hotová.** Dnes byla; převzal jsem ji, spustil
brány sám a diff přečetl bez opory o Codexovo hlášení, protože kontrakt nedopsal.

## Čtyři pravidla o branách, která tenhle den zaplatil

1. **Brána visící na detekci zapojení je fail-open.** `it.runIf(...)` porazil obyčejný
   refaktor a dva strážci tiše usnuli. Oprava detekce nestačí — **odeber podmínku**,
   když invariant na zapojení nezávisí.
2. **Assertion nad celým souborem skoro nic neměří.** Vyřízni blok funkce.
3. **Baseline musí být změřený stav, ne stav, jaký zrovna byl.**
4. **Data na kulaté hranici měří nejmíň.** 200 jednotek = přesně 100 emoji párů, takže
   i vadný ořez trefil hranici. Vol **lichá** data, hodnoty **těsně vedle** prahu.

⇒ Brána `npm run preskocene` je v `gates` i v CI: **přibude-li přeskočený test, gates spadnou.**
Když ji potřebuješ posunout, udělej to **vědomě** (`npm run preskocene:baseline`) a napiš proč.

## Co se v noci NESMÍ

Ostrý zápis do Tabidoo · flip killswitche (ani `LUFAK_*`, ani `OFFERS_*`) · produkční migrace ·
mazání dat · čtení secretů · commit zvuku ze skutečné schůzky · **rozmrazit `spec.md` nebo
`plan.md`** · sahat na `design/**` · pouštět `ui-smoke` v sandboxu · oslabit test · obejít bránu.

🔴 **Zakázané „opravy" při selhání:** změkčení testu, `it.skip`, vypnutí brány, zápis do
baseline kvůli průchodu, `--force`, `[skip ci]`. **Oprav VADU, ne měřidlo. Max tři kola**,
pak zastav, nech PR otevřený a napiš, co přesně padá.

## Na stopce se PŘESKAKUJE, nezastavuje

Odložitelné rozhodnutí → `DAN-TODO.md` s doporučeným defaultem, a jeď dál po nezávislé větvi.
Celý běh zastav jen tehdy, když bez toho rozhodnutí není co dělat.

🔴 **Každé rozhodnutí udělané za Dana musí být ráno vypsané.** Tichý default je vada.

## Co čeká na Dana — nedělat za něj

| co | stav |
|---|---|
| `spec.md` vede `DSK-F015` jako `merged`, ačkoli diagnostika do dneška neexistovala | 🔴 **zmrazený dokument, opravit smí jen Dan** |
| kontrakt fáze 2 (alokace, scope, endpoint) | čeká na serverovou session; **práh 110 % je hodnota, ne rozhraní — nesmí být u nás zadrátovaný** |
| co smí běžet před dokončeným onboardingem | produktové rozhodnutí |
| Apple Developer | Dan požádal 3. 9.; po schválení doplnit pět secrets |

## Delegace

Výchozí vykonavatel je **Codex**, viditelně v Orce:
`orca terminal create --worktree path:<wt> --title "<co to dělá>" --command "codex exec -C <wt> -s workspace-write …"`

🔴 **Jeden strom = jeden zapisovatel.** Paralelně jen úlohy s **oddělenými soubory** —
dnes se osvědčilo `src/**` × `electron/**`. Vlastnictví piš do zadání **výčtem**, věta
„nesahej na cizí" nestačí.

🔴 **Codex ve worktree needituje git**, jen soubory. Commituj po něm **hned** — sabotážní
kolo končí `git checkout` a nad necommitnutou prací by ji smazalo.

## Zápis

Po každé etapě `▪ CHECKPOINT n/N`, na konci plný report se sekcemi **Rozhodl jsem sám**
a **Čeká na tebe**. Značky povinně: ✅ ověřeno naostro · 🧪 zelené testy · ⛔ neověřeno.

🔴 **„Zelené testy" NENÍ „ověřeno".** Dnes to platilo třikrát: `stop-tracking`, který nikdo
neobsluhoval; Electron 39, který se v sandboxu vůbec nenainstaloval; a `captureAudioSources`,
který nespouštěl ani jeden test. Všechny tři byly zelené.
