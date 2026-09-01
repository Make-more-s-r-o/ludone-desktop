# Checkpoint nočního běhu

**Tenhle soubor se PŘEPISUJE po každé vlně, neroste.** Je to pojistka proti compaction:
kdo ho čte s prázdným kontextem, musí být schopen pokračovat, aniž by se ptal.

**Poslední zápis: 1. 9. 2026, 23:25.** Zadání běhu: [`BEH-NOC.md`](BEH-NOC.md).

🔴 **Režim od 23:15 (Danův pokyn): NEPTAT SE.** Bezpečné vratné defaulty rozhodni, zapiš do
`decisions.md`. Hard gate (produkce, DB, Tabidoo, killswitch, money/RBAC/design) fail-closed:
přeskoč **jen dotčený task**, zapiš blocker, jeď dál na všem nezávislém. **Celý běh nezastavuj,
dokud existuje bezpečná práce.** Mechanika primárně Codex, Claude koordinace a review.

---

## Vlna

`3 / 4` — B5 a B8 běží na Codexu souběžně, každá ve svém stromě.

## Hotovo — tři PR otevřené

| Story | PR | CI | Brány (měřil jsem já, před rourou) | Doloženo |
|---|---|---|---|---|
| **B1** `ui-smoke` | [#2](https://github.com/Make-more-s-r-o/ludone-desktop/pull/2) | 🟢 | lint 0 · tc 0 · **77/77** | červený baseline naostro + 4 sabotáže diferenciálně |
| **B4** tři vady přihlášení | [#3](https://github.com/Make-more-s-r-o/ludone-desktop/pull/3) | 🟢 | lint 0 · tc 0 · **86/86** (9 nových) | 3 doslovné červené výpisy + recept na sabotáže |
| **B3** autorita tray | [#4](https://github.com/Make-more-s-r-o/ludone-desktop/pull/4) | ⏳ | lint 0 · tc 0 · **98/98** (6 nových) | 4 sabotáže 3🔴:1🟢 + cílená sabotáž jediného přepočtu |

🔴 **Žádná netvrdí `verified-live`.** Osy: `delivery: pr-open` · `exposure` beze změny ·
`verification: tests-green`. To je 🧪, ne ✅.

## Běží právě teď

| Co | Kde | Jak poznat konec |
|---|---|---|
| **Codex B5** časovač do main | worktree `desktop-b5` (nad B3) | log `…/codex-1788295518.log`, hlídač na pozadí |
| **Codex B8** zapojit auth | worktree `desktop-b8` (nad B4) | log `…/codex-1788295853.log`, hlídač na pozadí |
| **Codex review B3** read-only | panel „🔎 Codex review: B3" | log `/tmp/beh-noc/b3-review.log` — 🔴 **odpověď je v LOGU, `-o` v read-only kleci nic nezapíše** |
| **Workflow review 3 PR** | 4 čočky → 2 skeptici na nález | task `w7j4w7yen`, notifikace sama |

🔴 **Log bez pohybu 20 minut = mrtvý job** bez ohledu na hlášený stav. Práce ale bývá hotová
na disku — než ho pustíš znovu, `git status` ve worktree.

## Přeskočeno / blokováno

| Co | Proč | Kam zapsáno |
|---|---|---|
| **B2** čísla `B*`/`BD*` | 377 odkazů, `LUDONE_E2E` obsahuje `E2`, sabotážní markery v produkčním kódu | `DAN-TODO.md` BD-N1 |
| **B4 vada (c), viditelná půlka** | `Onboarding.jsx` vlastní B1 | BD-N2, návrh story **B4b** |
| **Pátý stav `recording-tracking`** | ikony patří do **zmrazené T1** | BD-N5 / PR #4 |
| **Kalendář** (design ho ruší, `ui-smoke` ho vyžaduje) | user-visible změna bez packetu = hard gate | **O14**, vzniká story **B13** až PO B1 |
| **B12** migrace | živá DB 24 lidí | `BEH-NOC.md` |
| 🔴 **`ui-smoke` do zelené** | chybí systémové oprávnění **Nahrávání obrazovky** | `DAN-TODO.md`, čeká na Dana |

## Rozhodnutí koordinátora k B8 (23:20) — jsou v `decisions.md`

- **BD-N6:** registrace klienta **statická, `clientId` POVINNÝ, fail-closed**. DCR se nepoužije
  ani jako záloha — zrušila by Danovo rozhodnutí a má změřený pád (429 po 20 přihlášeních
  z jedné NAT IP). ⇒ **Přihlášení naostro nepůjde, dokud `clientId` neexistuje. To je záměr.**
- **BD-N7:** proměnná **`LUDONE_ORIGIN`** (existující konvence E6 §11), `LUDONE_ISSUER` zamítnuta
  jako změna kontraktu. Default `app.ludone.cz`, ⚠️ ale **všechna živá evidence míří na `labs`**
  ⇒ ověření naostro spouštět s `LUDONE_ORIGIN=https://labs.ludone.cz`.

## Kde co leží

| Worktree | Větev | Stav |
|---|---|---|
| `desktop-b1` | `orca/desktop-b1` | pushnuto, PR #2 |
| `desktop-b4` | `orca/desktop-b4` | pushnuto, PR #3 |
| `desktop-b3` | `orca/desktop-b3` | pushnuto, PR #4 |
| `desktop-b5` | `orca/desktop-b5` **nad b3** | Codex píše |
| `desktop-b8` | `orca/desktop-b8` **nad b4** | Codex píše |
| hlavní checkout | `main` | jen dokumenty |

🔴 Všechny worktrees mají `node_modules` jako **symlink** (Codexův sandbox nemá síť).
🔴 **V hlavním checkoutu NIKDY `git add -A`** — je v něm i souběžná session.

## Co se tenhle běh naučil a nesmí se zapomenout

1. 🔴 **Ke každému „umí to rozhodnout správně" patří druhá otázka „zeptá se toho někdo?"**
   B3 měla správné odvození stavu a **92 zelených testů**, a lišta by nahrávání neukázala nikdy —
   chyběl přepočet na pěti místech. Testy chování si obsluhu volaly samy.
2. 🔴 **Kritérium „nic se nestalo" má víc příčin.** B1: kontrola `disabled === 2` procházela
   i tehdy, když systém oprávnění **odepřel**. Sabotáž to vypsala doslova: `granted:0, disabled:2`.
3. **Strukturální test nad zdrojovým textem padá i na komentář** — hledej registraci
   (`"kanal"` v uvozovkách), ne zmínku.
4. **Zpětné apostrofy uvnitř template literálu ho ukončí** a shodí celý testovací soubor.
5. **`functionSource` musí přeskočit parametry závorkami** — funkce s rozbaleným parametrem
   má `{` už v hlavičce a naivní hledač vyřízne jen hlavičku.

## Další krok

1. Převzít **Codex review B3** (z logu) a **workflow review** tří PR → nálezy opravit na větvích.
2. Převzít **B5** a **B8**: commit HNED po doběhnutí, pak brány, pak sabotáže, pak PR.
3. Pak **B6 + B7** (obě po B5, jiné bloky `main.cjs`) a **B9** (po B8) na Codexe.
4. **B10** potřebuje návrh (sdílené zařízení `zasedacka@`) — návrh je koordinátorův.
5. **B11** až po B7.
