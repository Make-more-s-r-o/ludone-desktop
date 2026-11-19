# Stav session „🖥 LuDone Desktop: opravy z prokliku“

Session na Dev_LuDone (Orca worktree `ludone-desktop-opravy`, terminál
`term_95205035-b628-40b2-bb1d-ebc74a85f74d`). Danova vlastní session, žádný koordinátor.
Založeno 18. 11. 2026. Tenhle soubor je zdroj pravdy pro budík; konverzaci sežere komprese.

## Cíl

Brát GitHub issues v `Make-more-s-r-o/ludone-desktop` se štítkem `proklik` (nálezy z Danova
prokliku nainstalované verze na MacBooku) a opravovat je až po sloučený PR.
Starší otevřené issues #167–#179 jen na Danův pokyn.

## Tok jedné opravy

1. Rozbor příčiny + komentář do issue „Řeší 🖥 opravy na Devu“.
2. Větev `fix/<oblast>-<popis>` z `origin/main` v Orca worktree `ludone-desktop-opravy`.
3. Implementace: Codex `gpt-6.1-terra`, effort `max`, `-s workspace-write`, viditelný panel přes
   `~/.claude/scripts/orca-codex.sh start …`. Jeden Codex zápis na worktree naráz.
4. Review: Codex `gpt-6.2-sol`, effort `max`, read-only, bez subagentů, na přesném SHA.
   Přihlášení, tokeny, fronta, IPC → navíc Claude review nad diffem.
5. PR „Fixes #N“ + co má Dan ověřit na MacBooku (kroky, očekávaný výsledek). Do té doby nejvýš 🧪.
6. Zelené CI → sloučit → smazat větev, zavřít vlastní Codex panely.

## Prostředí (ověřeno 18. 11. 2026)

- ✅ Lokální brány potřebují **oficiální** Node 24.19.0 (stejný jako CI z `.nvmrc`):
  `export PATH="$HOME/.local/node/node-v24.19.0-darwin-arm64/bin:$PATH"`.
  Staženo z nodejs.org, SHA256 ověřené. `tests/tray-ikony.test.js` s ním 9/9 PASS.
- ⚠️ Homebrew `node@24` (24.22.2) i výchozí Node 22.23.4 v tomtéž testu padají
  (`dark-signed-out.png … se liší od výstupu generátoru`). Nestačí tedy „nějaká 24“; jde
  o sestavení binárky, ne o verzi zlib (obě hlásí 1.2.12). Doplňuje issue #176.
- `npm ci` pod Node 24.19 je v Orca worktree hotové; npm 11 nespustil install skripty
  (bez binárky Electronu) — cílené unit testy to nepotřebují.
- ⚠️ V prostředí je `VITEST_MAX_WORKERS=6` (globální pravidlo uvádí 2). Nepřebíjím; lokálně
  pouštím jen jednotlivé soubory.
- Kanál otázek: `AGENTS.md` řádek „Komunikace s Danem“ neurčuje ⇒ chat této session +
  `otazka new --modul ludone-desktop … --pane term_95205035-b628-40b2-bb1d-ebc74a85f74d`.

## Fronta issues `proklik`

Pořadí: 1) #182+#183 → 2) #186 → 3) #185 → 4) #187 → 5) #184 (čeká na Danovu odpověď).

| Issue | Název | Stav | Větev / PR | Poznámka |
|---|---|---|---|---|
| #182 | Nová nahrávka nedostane výchozí firmu | ✅ vydáno v 0.1.12 (🧪, čeká na proklik Dana) | PR #189 → main 77c13cb | implementace hotová (terra max, 36 nových testů); review sol 6.2 běží; Claude review: 1× P2 |
| #183 | Detail: obnova smaže výběr firmy, scroll, dotaz | ✅ vydáno v 0.1.12 (🧪, čeká na proklik Dana) | PR #189 → main 77c13cb | — |
| #186 | Čerstvou nahrávku nejde smazat | ✅ vydáno v 0.1.12 (🧪, čeká na proklik Dana) | PR #192 → main 6cc6968 | hypotéza: čeká na `-stereo.webm`; překlep „vratit“ |
| #185 | Není poznat, že nahrává | ✅ vydáno v 0.1.12 (🧪, čeká na proklik Dana) | PR #193 → main abb364c |
| #194 | Nestabilní test z #189 + Zastavit v Nastavení | ✅ sloučeno | PR #195 → main fa5508b | zvuk ⇒ nejvýš 🧪, ověření Dan na Macu |
| #187 | UI drobnosti | ✅ zavřeno (PR #196 + #197) | main 1e8c143 | body 1/4/10 hotové jinde; 2/3 → #184 |
| #184 | Méně kliků: Soukromá/Firemní → Nahrávat | ✅ vydáno v 0.1.12 (🧪, čeká na proklik Dana) | PR #197 → main 1e8c143 | rozhodnuto Danem (níž); zapsat do `ROZHODNUTI.md` v PR |

## Danova rozhodnutí (chat, 18. 11. 2026 ~16:00)

- **#184 přepínač Soukromá / Firemní:** začíná na **poslední použité volbě**.
- **#184 samoodeslání po Ukončit: NE.** Schválení zůstává; firma a přístup předvyplněné,
  odeslání jedním klikem. (Issue text chtěl samoodeslání — Dan rozhodl jinak.)
- **Modely:** „co nejnovější modely, tedy 6.2 sol / terra 6.1“ ⇒ implementace `gpt-6.1-terra`
  max, review `gpt-6.2-sol` max; ani #187 nejde na lunu.
- **#176:** jen připsat zjištění (hotovo, komentář v issue).
- Otázka Q-20261118-144830-ludone-desktop-a6dd odpovězena v chatu a uzavřena.
- **Vydání (Dan, chat 18. 11.):** nová verze (0.1.12) **až po sloučení všech šesti** (#182–#187). Jednotlivé PR jen slučovat do `main`, nic netagovat. Až bude šestý sloučený, připravit vydání a před tagem/podpisem se Dana ještě jednou zeptat (brief: nic nevydávat bez Dana).

- **Vydání 0.1.12 schváleno (Dan, chat této session 19. 11. 2026 ~9:10: „ano, vydej 0.1.12“).** Otázka Q-20261118-211459-ludone-desktop-1c5e zodpovězena a uzavřena. PR #198 `chore(release)` (verze + české poznámky; zahrnuje i #179 z PR #180/#181), pak tag `v0.1.12` → workflow `release-macos.yml`.

### Rozbor #182 (čtení kódu, ⛔ neověřeno během)
- Výchozí firma je v šifrované session (`companyTabidooId`). Refresh ji zachová, **nové přihlášení
  zapíše session od nuly bez firmy** ⇒ každé přihlášení po vypršení ji smaže.
- `upload-companies:default` vrací `null`, když je přístupový token prošlý (Mac po uspání).
- Nastavení resetuje stav na `idle` při změně `identityKey` ⇒ „Načíst firmy“ bez reakce (hypotéza).

## Rozhodl jsem sám

- (Rozpor modelů brief × issues vyřešil Dan, viz výš.)

## Vlastní Codex panely

| Handle | Úkol | Log | Stav |
|---|---|---|---|
| `term_464c0a7a-dc84-430f-8acd-0f7648a5601a` | #182+#183 implementace, terra max | `~/.claude/runs/.codex-logy/2026-11-18/oprava-vychozi-firmy-182-183-1795013407939.log` | EXIT=0, převzato (commit 9e7ff6d) |
| `term_59f98bfa-ebd2-453d-94b1-c98fa597ef38` | #182+#183 review, sol 6.2 max read-only | `~/.claude/runs/.codex-logy/2026-11-18/review-182-183-1795015414005.log` | EXIT=0, VRÁTIT, zavřeno |
| `term_9b6ef6f7-1fd6-4283-95ce-eb1305b8d957` | #182+#183 kolo 2, terra max | `~/.claude/runs/.codex-logy/2026-11-18/oprava-182-183-kolo-2-1795016336579.log` | EXIT=0, převzato (a55b055), zavřeno |
| `term_5254fbdd-…` | #182+#183 review kola 2, sol 6.2 max | `~/.claude/runs/.codex-logy/2026-11-18/review-182-183-kolo-2-1795017783289.log` | EXIT=0, VRÁTIT, zavřeno |
| `term_6acb1378-5798-4644-9818-b4d90f13d544` | #182+#183 kolo 3, terra max | `~/.claude/runs/.codex-logy/2026-11-18/oprava-182-183-kolo-3-1795018834875.log` | EXIT=0, převzato (12ff68d), zavřeno |
| `term_3a0fbc37-…` | #182+#183 review kola 3, sol 6.2 max | `~/.claude/runs/.codex-logy/2026-11-18/review-182-183-kolo-3-1795020083994.log` | EXIT=0, VRÁTIT, zavřeno |
| `term_7bb5287a-…` | #182+#183 kolo 4 ZÚŽENÉ, terra max | `~/.claude/runs/.codex-logy/2026-11-18/oprava-182-183-kolo-4-uzke-1795021055694.log` | EXIT=0, převzato (b98fb9b), zavřeno |
| `term_01b4e1f8-…` | #182+#183 úzké review kola 4, sol 6.2 max | `~/.claude/runs/.codex-logy/2026-11-18/review-182-183-kolo-4-1795021925141.log` | EXIT=0, VRÁTIT (3× P2), zavřeno |
| `term_d4ef6115-…` | #182+#183 kolo 5 malé, terra max | `~/.claude/runs/.codex-logy/2026-11-18/oprava-182-183-kolo-5-male-1795022485279.log` | EXIT=0, převzato (7648ace), zavřeno |
| `term_ad1668cd-…` | #182+#183 review kola 5, sol 6.2 max | `~/.claude/runs/.codex-logy/2026-11-18/review-182-183-kolo-5-1795022963820.log` | EXIT=0, PŘIJMOUT S VÝHRADAMI, zavřeno |
| `term_b5ff4956-…` | #186 implementace, terra max | `~/.claude/runs/.codex-logy/2026-11-18/oprava-186-mazani-cerstve-nahravky-1795023485683.log` | EXIT=0, převzato (9e052e2), zavřeno |
| `term_098ef146-…` | #186 review, sol 6.2 max | `~/.claude/runs/.codex-logy/2026-11-18/review-186-1795024458180.log` | EXIT=0, VRÁTIT, zavřeno |
| `term_5bdea623-…` | #186 kolo 2 zjednodušení, terra max | `~/.claude/runs/.codex-logy/2026-11-18/oprava-186-kolo-2-zjednoduseni-1795025298562.log` | EXIT=0, převzato (512b719), zavřeno |
| `term_96beeffa-…` | #186 review kola 2, sol 6.2 max | `~/.claude/runs/.codex-logy/2026-11-18/review-186-kolo-2-1795025955758.log` | EXIT=0, PŘIJMOUT S VÝHRADAMI, zavřeno |
| `term_68c3d5cc-…` | #185 implementace, terra max | `~/.claude/runs/.codex-logy/2026-11-18/oprava-185-je-poznat-ze-nahrava-1795026502705.log` | EXIT=0, převzato (ebd50dc), zavřeno |
| `term_4f005b90-…` | #185 review, sol 6.2 max | `~/.claude/runs/.codex-logy/2026-11-18/review-185-1795027447587.log` | EXIT=0, VRÁTIT, zavřeno |
| `term_63849f58-…` | #185 kolo 2, terra max | `~/.claude/runs/.codex-logy/2026-11-18/oprava-185-kolo-2-1795027967839.log` | EXIT=0, převzato (777d5eb), zavřeno |
| `review 185 k2` | #185 review kola 2, sol 6.2 max | `~/.claude/runs/.codex-logy/2026-11-18/review-185-kolo-2-1795028418720.log` | EXIT=0, PŘIJMOUT S VÝHRADAMI |

Zadání: `scratchpad/packet-182-183.md` (session scratchpad).

## Deník tiků

- 18. 11. 2026 15:20 — start: pravidla přečtena, Node 24.19 ověřen, fronta `proklik` prázdná.
- 18. 11. 2026 15:50 — 6 nových issues (#182–#187), komentáře s rozborem, otázka k #184, Codex na #182+#183.
- 18. 11. 2026 16:22 — tik: žádné nové issues; Codex #182/#183 v závěru (13 změněných + 2 nové soubory, z toho 6 existujících testů ⇒ číst diff testů zvlášť), EXIT zatím ne.
- 18. 11. 2026 ~16:40 — Codex #182/#183 EXIT=0 (turn_context: gpt-6.1-terra / max), commit 9e7ff6d (15 souborů, +855/−89).
  Předvolba firmy v lokálním souboru `upload-company-defaults.json` (0600, bez tokenů), vázaná na issuer + `userinfo.sub`.
  Ověřeno: server `ludone-app` vrací `sub = String(dbUser.id)` (userinfo/route.ts:109) ⇒ stabilní. Staré session `sub` nemají ⇒ po aktualizaci jednou vybrat firmu.
  Claude review: úpravy existujících testů OK (záměrná změna H2 + zpřísnění); dešifrování staré session bezpečné (vrací null);
  **P2: poškozený `upload-company-defaults.json` ⇒ `writeCompanyDefault` vyhodí po uložení session ⇒ trvalá chyba ukládání** → opravné kolo.
- 18. 11. 2026 ~17:00 — review sol 6.2 max (turn_context ověřen, 0 subagentů): VRÁTIT, 5× P1 + 4× P2 → N1–N8 do kola 2
  (zadání scratchpad/packet-182-183-kolo2.md). Nezařazeno: „uploader bere firmu z relace bez čerstvé nabídky“ = chování
  i před změnou, server kontroluje při INIT ⇒ do PR jako známé omezení. Moje cílené testy na 9e7ff6d: auth-identity-fallback 38,
  upload-company-regression 15, recordings-dashboard 43, queue-wiring 351 — vše PASS (review je kvůli sandboxu pustit nemohlo).
  Větev pushnutá. kombinace: autor terra 6.1 max → reviewer sol 6.2 max, kolo 1 VRÁTIT.
- 18. 11. 2026 ~17:05 — zpráva 🛰 Orca koordinátora (msg_586ee4565a1f, handle 🛰 term_00e4043d-…): Dan odešel, pracovat samostatně, levně, Danovi jen nutné otázky kanálem projektu; Claude limity napjaté (makemore 96 %). ⇒ autonomní režim, rozhodnutí do „Rozhodl jsem sám“. Modely beze změny: Danova přímá odpověď v chatu (terra 6.1 impl., sol 6.2 review) má přednost před obecným vzkazem (ten pro těžší práci říká totéž). BrightSight zmrazen (netýká se).
- 18. 11. 2026 ~17:25 — kolo 2 EXIT=0 (terra 6.1 / max), commit a55b055 pushnutý (12 souborů, 28 nových testů, N1–N8 opraveny dle Codexu).
  Claude review auth diffu k2: OK (userinfo jen přes resolveUserIdentity/trustedRemoteEndpoint, sub jen při shodě e-mailu, token se neukládá; předvolba před relací + rollback).
  🧪 Moje cílené testy na a55b055: auth-identity-fallback 48, upload-company-regression 19, upload-company-storage-regression 3,
  recordings-dashboard 51, queue-wiring 354, settings 70, ipc-sender-guard 24 — vše PASS; eslint electron src EXIT 0. Review k2 (sol 6.2) běží.
- 18. 11. 2026 ~17:40 — review k2 (sol 6.2 max, 0 subagentů): VRÁTIT, 2× P1 + 8× P2. Do kola 3 (K1–K9, packet-182-183-kolo3.md):
  nezávislá obnova obou souborů, falešný konflikt u nahrávky bez firmy (častý případ!), regrese: místní smazání po odhlášení,
  převzetí voleb po stale_snapshot, firma účtu A ve formuláři po zastavení, expirace tokenu během userinfo, typ companyId, 2 slabé testy.
  Rozhodl jsem sám: P1 „znovupřidělený e-mail ⇒ stejný otisk vlastníka fronty“ = starší návrh fronty, mimo rozsah ⇒ issue #188 (bez štítku proklik).
  kombinace: terra 6.1 max → sol 6.2 max, kolo 2 VRÁTIT. Pojistka: další neúspěch = 3 kola po sobě ⇒ před kolem 4 nezávislá analýza příčiny jiným modelem.
- 18. 11. 2026 ~18:05 — kolo 3 EXIT=0 (terra 6.1 / max), commit 12ff68d pushnutý. identityBinding = náhodné UUID v procesu (ne sub) ⇒ OK.
  🧪 cílené testy na 12ff68d: 9 souborů, 691 PASS (= předpověď Codexu), eslint EXIT 0. Draft PR #189 (CI souběžně). Review k3 běží.
- 18. 11. 2026 17:50 — CI PR #189 (run 44350233531) FAIL v gates: typecheck, 11× TS chyba (JSDoc typ relace bez companyTabidooId/Name/userinfoSubject, statický import .jsx v testech, detailId/authBridge v typech helperů). Příčina: zadání zakazovalo tsc nad projektem. Výpis: scratchpad/ci-189-typecheck.txt. Oprava v dalším kole po verdiktu review k3 (review čte strom, teď nezapisovat).
- 18. 11. 2026 ~18:10 — review k3 (sol 6.2 max, 0 subagentů): VRÁTIT, 1× P1 (typecheck = CI) + 7× P2. **Třetí VRÁTIT po sobě ⇒ pojistka:**
  nezávislý rozbor příčiny (Claude Opus, jiný model než autor terra): nekonverguje, protože každé kolo přidá stavovou logiku a review
  na max najde další okrajové případy (diff ~2000 ř.). **Změna přístupu:** kolo 4 ZÚŽENÉ na T1 typecheck (P1), T2 skok scrollu
  (přímo #183), T3 falešné „uložení selhalo“ po fokusu (častý případ), T4 zaseknuté „Ověřuji účet“; povolen jeden běh tsc.
  Rozhodl jsem sám: zbylé 4 okrajové P2 (dvojitá chyba disku, availableCompanyIds, výsledek ověření po unknown, chybové kódy) ⇒ issue #190.
  Review 4 bude ověřovat jen T1–T4 + regrese. kombinace: terra 6.1 max → sol 6.2 max, kola 1–3 VRÁTIT.
- 18. 11. 2026 ~18:30 — kolo 4 EXIT=0 (terra 6.1 / max), b98fb9b pushnutý (6 souborů, +284/−19), bez @ts-* potlačení a beze změny jsconfig/package.json;
  Codex: tsc exit 0. 🧪 moje cílené: recordings-dashboard 60, recording-card 96, auth-identity-fallback 50 PASS. Úzké review k4 + CI #189 běží (hlídač čeká na obojí).
- 18. 11. 2026 ~18:45 — CI #189 na b98fb9b ZELENÉ (gates pass), MERGEABLE CLEAN. Úzké review k4 (sol 6.2 max): VRÁTIT 3× P2 (žádné P0/P1).
  Rozhodl jsem sám: E1 zmizení bloku Exportovat kopii při obnově (scroll u spodu = přesně scénář #183) + E2 hláška u chybějícího e-mailu
  → malé kolo 5; T3 vzácná souběžnost uložení × selhání snímku → #190 (bod 5). Po kole 5: krátké review jen E1/E2 a sloučit.
- 18. 11. 2026 ~18:55 — kolo 5 EXIT=0 (terra 6.1 / max), 7648ace pushnutý (4 soubory, +115/−8, 0× @ts-*, tsc exit 0 dle Codexu).
  Claude review podmínky exportu: přísnější (blok jen visibility:hidden + disabled během obnovy; exportCopy nově vyžaduje signed-in + shodu identity a epochy snímku). 🧪 recordings-dashboard 62, recording-card 98 PASS. Review k5 + CI běží.
- 18. 11. 2026 ~19:05 — review k5 (sol 6.2 max, 0 subagentů): PŘIJMOUT S VÝHRADAMI (1× P2 syntetický input na disabled poli → #190 bod 6).
  CI #189 gates PASS na přesném 7648ace. **PR #189 sloučen squash → main 77c13cb**, #182 a #183 zavřené (Fixes), komentáře s 5 kroky pro Dana.
  Větev fix/upload-company-default smazána lokálně i remote, panely zavřené.
  kombinace: autor gpt-6.1-terra max, reviewer gpt-6.2-sol max, 5 kol (VRÁTIT×4, pak PŘIJMOUT S VÝHRADAMI); odloženo #188, #190.
- 18. 11. 2026 ~19:05 — #186 start na fix/recording-delete-fresh z 77c13cb (Codex terra max; packet s povoleným 1× tsc).
- 18. 11. 2026 ~19:20 — #186 EXIT=0 (terra 6.1 / max), 9e052e2 pushnutý (10 souborů, 10 nových testů, tsc exit 0, 0× @ts-*).
  Příčina Danových 2 pokusů NEověřena; nejpravděpodobnější H1: nativní dialog „Přesunout do koše?“ má výchozí Zrušit ⇒ cancelled hlášeno jako selhání (opraveno).
  Dále: mazání počká na ukončení stereo převodu, partial_failure nese důvod, překlep vratit→vrátit.
  Claude review guardů: ochrana při odesílání zůstala; **moje P2: globální kontrola `.media-encoder-*` v adresáři nahrávek zablokuje mazání VŠECH nahrávek, když po pádu zůstane jeden dočasný soubor** → do opravného kola. Review sol běží.
- 18. 11. 2026 ~19:35 — review #186 (sol 6.2 max, 0 subagentů): VRÁTIT 3× P1 (vše v nové logice čekání na stereo převod) + 3× P2.
  Rozhodl jsem sám: čekání na převod z PR VYJMOUT (souběh nebyl prokázanou příčinou; test okamžitého smazání prošel i před opravou) →
  kolo 2 = R1 revert převodové logiky, R2 ponechat cancelled≠chyba/důvody/hlášky/překlep, R3 stejné důvody v přehledu, R4 zpřísnit test.
  Souběh převodu + obnova po částečném přesunu ⇒ issue #191 (bez štítku proklik).
- 18. 11. 2026 ~19:55 — #186 kolo 2 EXIT=0 (terra 6.1 / max), 512b719: převodová logika pryč (diff vs main 9 souborů +226/−18; main/queue jen texty + reason).
  🧪 recording-actions 21, queue-wiring 357, recordings-dashboard 69, recording-card 101, queue 153, ipc-sender-guard 24 PASS; eslint 0. Draft PR #192, review k2 + CI běží.
- 18. 11. 2026 ~20:05 — review #186 k2 (sol 6.2 max, 0 subagentů): PŘIJMOUT S VÝHRADAMI (1× P2 → #191). CI gates PASS na 512b719.
  **PR #192 sloučen squash → main 6cc6968**, #186 zavřené, komentář s kroky pro Dana; větev smazána lokálně i remote, panely zavřené.
  kombinace: autor gpt-6.1-terra max, reviewer gpt-6.2-sol max, 2 kola (VRÁTIT, pak PŘIJMOUT S VÝHRADAMI); odloženo #191.
- 18. 11. 2026 ~20:05 — #185 start na fix/recording-feedback z 6cc6968 (Codex terra max, packet scratchpad/packet-185.md).
- 18. 11. 2026 ~19:45 UTC — session obnovena hlídačem limitu (nový Claude účet); stav ze STAV.md, žádné zprávy.
- #185 EXIT=0 (terra 6.1 / max), ebd50dc pushnutý (4 soubory, 12 nových testů, tsc exit 0, 0× @ts-*). Zachytávání zvuku beze změny.
  H2 (ukazatel měří jinou stopu) NEpotvrzena ⇒ 0 % z kódu nevysvětlitelné, ověří Dan. Existující test „jen s mikrofonem“ záměrně upraven
  (varování až při skutečně chybějící stopě) — zkontrolováno, není oslaben. 🧪 recording-card 113 PASS. Draft PR #193, review + CI běží.
- Packet #187 připraven (scratchpad/packet-187.md): body U5–U9, U11. Rozhodl jsem sám: body 1 (#185), 4 (#186), 10 (#189) už hotové;
  body 2 a 3 (obrazovka Nahrávání: firma+přístup, důvod zašedlého tlačítka) přesouvám do #184, ať se nepíšou dvakrát.
- 18. 11. 2026 ~20:00 — review #185 (sol 6.2 max, 0 subagentů): VRÁTIT 1× P1 + 3× P2; CI #193 FAIL na tests/onboarding-missing-steps.test.js
  (= P1: sdílená konstanta MICROPHONE_ONLY_TEXT změněna i pro onboarding). Kolo 2: V1 vrátit konstantu + nová pro nahrávání,
  V2 zavřít AudioContext při zrušení, V3 Ukončit až po potvrzení rekordérů, V4 test odloženého startu.
- 18. 11. 2026 ~20:15 — #185 kolo 2 EXIT=0 (terra 6.1 / max), 777d5eb pushnutý (3 soubory): onboarding text vrácen (test onboardingu beze změny),
  nová konstanta pro nahrávání, AudioContext zavřen při zrušení, Ukončit až po potvrzení rekordérů, test odloženého startu (mutací ověřen).
  🧪 recording-card 117, onboarding-missing-steps 23 PASS; tsc exit 0 dle Codexu. Review k2 + CI běží.
- 18. 11. 2026 ~20:35 — review #185 k2 (sol 6.2 max, 0 subagentů): PŘIJMOUT S VÝHRADAMI (1× P2: Zastavit v Nastavení→Zdroje aktivní dřív).
  CI #193 na 777d5eb FAIL — ale na NESTABILNÍM testu z #189 (queue-wiring „poslední známý název i z prošlé relace“ sáhl na skutečný fetch),
  ne na #185. main CI zelené, lokálně 3/3 PASS. Rozhodl jsem sám: rerun failed jobu (měřidlo beze změny) + issue #194 (oprava příčiny
  flaky testu + P2 Zastavit) jako další krok po #185.
- 18. 11. 2026 ~20:45 — CI #193 rerun PASS na 777d5eb (potvrzen flaky test, ne vada #185). **PR #193 sloučen squash → main abb364c**, #185 zavřené,
  komentář s kroky pro Dana; větev smazána lokálně i remote, panely zavřené.
  kombinace: autor gpt-6.1-terra max, reviewer gpt-6.2-sol max, 2 kola (VRÁTIT, pak PŘIJMOUT S VÝHRADAMI → #194).
- 18. 11. 2026 ~20:45 — #194 start na fix/flaky-company-test z abb364c (Codex terra max, packet scratchpad/packet-194.md). Pak #187, #184.
- 18. 11. 2026 ~21:00 — #194 EXIT=0 (terra 6.1 / max), e2cd818 pushnutý (4 soubory). Příčina flaky testu: závod v testu — obnova fronty
  po runReady u prošlé relace spouští OAuth discovery, jen když čtení vlastníka nepředběhne zápis relace; handler síť nevolá ⇒ ne vada kódu.
  Test deterministický, pojistka fetch beze změny; F1 10/10 PASS. Zastavit v Nastavení až po readyForStop. 🧪 queue-wiring 357, recording-card 119.
  Draft PR #195, review + CI běží.
- 18. 11. 2026 ~21:10 — review #194 (sol 6.2 max): VRÁTIT 1× P2 (test nerozliší handler × fronta u sdíleného příslibu obnovy). CI PASS na e2cd818.
  Rozhodl jsem sám: sloučit (test jen zpevňuje proti main, nic neoslabuje; sousední test bez sítě dál platí) a P2 → #190 bod 7.
  **PR #195 sloučen squash → main fa5508b**, #194 zavřené; větev smazána, panely zavřené. kombinace: terra 6.1 max → sol 6.2 max, 1 kolo.
- 18. 11. 2026 ~21:10 — #187 start na fix/ui-polish z fa5508b (Codex terra max). Packet #184 připraven (scratchpad/packet-184.md):
  přepínač Soukromá/Firemní (poslední volba, první použití = Firemní jako dosud), řádek s firmou místo „Firmu zvolíte před odesláním“,
  předvyplněný formulář po Ukončit, BEZ samoodeslání, důvod zašedlého tlačítka. ROZHODNUTI.md zapíše orchestrátor v PR.
- 18. 11. 2026 ~21:30 — #187 EXIT=0 (terra 6.1 / max), a213445 pushnutý (9 souborů, nový tests/issue-187-ui.test.js, tsc exit 0).
  Změna očekávání pořadí v recordings-dashboard = U5 (záměr). 🧪 issue-187-ui 13, recordings-dashboard 69 PASS.
  Draft PR #196 (Refs #187 — zavře ho až PR #184, body 2/3), review + CI běží.
- 18. 11. 2026 ~21:20 — review #187 (sol 6.2 max, 0 subagentů): VRÁTIT 3× P2 (ořez ručně zadaného termínu v názvu, vyhledání „Schůzka“, dvojí popis Odesláno v detailu); CI #196 PASS na a213445. Malé kolo 2 (W1–W3) běží.
- 18. 11. 2026 ~21:50 — review #187 k2 (sol 6.2 max): VRÁTIT 2× P2 (hranice minuty: ořez podle času relace místo začátku stopy; hledání přes spojený řetězec). CI #196 na 13ab101 FAIL: tests/recordings-status.test.js čeká starý text „Odesláno podle stavu fronty“ (W3 ho záměrně změnil; ROZHODNUTI ho nepředepisuje). Kolo 3 (X1 upravit jen tuto aserci + zachovat/ověřit invariant „netvrdit neprovedené ověření“, X2 stejný čas začátku, X3 oddělené hledání) běží.
- 18. 11. 2026 ~22:00 — #187 kolo 3 EXIT=0 (terra 6.1 / max), e74c4a2 pushnutý: X1 aserce na nové znění + nová negativní kontrola „V LuDone ✓“ (invariant zpřísněn), X3 oddělené hledání. X2 (hranice minuty) neopraven — vyžaduje IPC projekci času stopy ⇒ #190 bod 8 (Rozhodl jsem sám). 🧪 recordings-status 2, issue-187-ui 21, recordings-dashboard 70. Review k3 + CI běží.
- 18. 11. 2026 ~22:10 — review #187 k3 (sol 6.2 max): PŘIJMOUT. CI PASS na e74c4a2. **PR #196 sloučen squash → main 5dd81c2** (Refs #187, issue
  zůstává otevřené kvůli bodům 2/3), komentář s kroky pro Dana; větev smazána, panely zavřené.
  kombinace: terra 6.1 max → sol 6.2 max, 3 kola (VRÁTIT ×2, PŘIJMOUT); odloženo #190 bod 8.
- 18. 11. 2026 ~22:10 — #184 start na fix/recording-fewer-clicks z 5dd81c2 (Codex terra max, packet scratchpad/packet-184.md).
- 18. 11. 2026 ~22:30 — #184 kolo 1 EXIT=0 (terra 6.1 / max), 1fd367f pushnutý (8 souborů, tsc exit 0): přepínač Soukromá/Firemní (localStorage, první použití Firemní), řádek s firmou → Nastavení, předvyplnění, ověření nabídky beze změny; 4 kliky vč. otevření panelu.
  **Claude kontrola: kolo 1 ODSTRANILO existující volitelný přepínač „Nové nahrávky odesílat automaticky“ a jeho cestu** — mimo Danovo rozhodnutí (to se týkalo nové cesty). Rozhodl jsem sám: vrátit přepínač i chování (výchozí vypnuto) → kolo 2 (Y1–Y3) běží.
- 18. 11. 2026 ~22:45 — #184 kolo 2 EXIT=0 (terra 6.1 / max), 3a6918a: přepínač automatického odesílání vrácen (Settings.jsx = main; původní testy
  vráceny + nový test přepínače). 🧪 settings 71, recording-card 141, recording-visibility 7. Orchestrátor zapsal **D24 do ROZHODNUTI.md** (1f695a6).
  Draft PR #197 (Fixes #184, Fixes #187), review + CI běží.
- 18. 11. 2026 ~23:00 — review #184 (sol 6.2 max, 0 subagentů): VRÁTIT 3× P1 (souběhy): Z1 automatika bere firmu ze startu (regrese vs main), Z2 fokus během odesílání zneplatní offerToken → stale_offer (týká se i cesty jedním klikem), Z3 start před ověřením účtu = falešná změna identity (regrese vs main). CI #197 PASS na 1f695a6. Kolo 3 (Z1–Z3, princip „kde main fungoval, vrátit jeho chování“) běží.
- 18. 11. 2026 ~23:15 — #184 kolo 3 EXIT=0 (terra 6.1 / max), 519473f pushnutý (3 soubory, bez electron/): Z1 firma až po Ukončit + čerstvý token, Z2 obnova firmy jen na klidové obrazovce, Z3 čekající ověření ≠ změna účtu. 🧪 recording-card 146, settings 71, upload-company-selection 18. Review k3 + CI běží.
- 18. 11. 2026 ~23:30 — review #184 k3 (sol 6.2 max): PŘIJMOUT. CI #197 na 519473f FAIL: (N1) recording-card „zastavení dokončí rozepsanou session“ 24≠25 — nestabilní i lokálně (1/6); (N2) queue-wiring K7 — pojistka fetch, stejný souběh jako #194 v dalším testu bloku (lokálně 6/6). Kolo 4 (N1 příčina + srovnání s main, N2 celý blok deterministicky jako #195) běží.
  ⚠️ Vlastní chyba: v dávce příkazů jsem spustil `git checkout -q origin/main --`, strom se odpojil na origin/main; ihned vráceno `git switch fix/recording-fewer-clicks`, strom byl čistý, nic se neztratilo (práce commitnutá a pushnutá).
- 18. 11. 2026 ~23:45 — #184 kolo 4 EXIT=0 (terra 6.1 / max), 3758d45 (jen testy, 2 soubory): N1 nezavedla #184 (nezávislé odečty skutečných hodin → 24/25 ms, totéž na main), test řídí obě hodiny, aserce 25 ms zachována, 15/15; N2 celý blok výchozí firmy deterministicky (7 testů), 10/10. Claude review diffu testů: žádná aserce neubyla. 🧪 recording-card 146, queue-wiring 357. Čeká se na CI.
- 18. 11. 2026 ~23:55 — CI #197 PASS na 3758d45. **PR #197 sloučen squash → main 1e8c143**; #184 zavřené (komentář s kroky), #187 zavřené
  (PR #196 + #197). Větev smazána lokálně i remote, panely zavřené, strom zpět na makerfaireczech/ludone-desktop-opravy = origin/main.
  kombinace #184: terra 6.1 max → sol 6.2 max, 4 kola (VRÁTIT ×2, PŘIJMOUT; kolo 4 jen testy po pádu CI).
  **Všech 6 proklik issues (#182–#187) sloučeno.** Otázka na vydání 0.1.12: Q-20261118-211459-ludone-desktop-1c5e (bez odpovědi nic nevydávám).
  Paměť: ludone-desktop-lokalni-brany-a-ci.md. Odložené follow-upy bez štítku proklik: #188, #190, #191.

## Souhrn kombinací
| Issue | PR | autor → reviewer | kola | verdikt |
|---|---|---|---|---|
| #182/#183 | #189 | terra 6.1 max → sol 6.2 max | 5 | PŘIJMOUT S VÝHRADAMI |
| #186 | #192 | terra 6.1 max → sol 6.2 max | 2 | PŘIJMOUT S VÝHRADAMI |
| #185 | #193 | terra 6.1 max → sol 6.2 max | 2 | PŘIJMOUT S VÝHRADAMI |
| #194 | #195 | terra 6.1 max → sol 6.2 max | 1 | VRÁTIT (P2) → sloučeno, P2 do #190 |
| #187 | #196 | terra 6.1 max → sol 6.2 max | 3 | PŘIJMOUT |
| #184 (+#187) | #197 | terra 6.1 max → sol 6.2 max | 4 | PŘIJMOUT |
- 18. 11. 2026 22:46 — tik: žádné nové proklik issues, žádné zprávy; Q k vydání 0.1.12 bez odpovědi (open). Nic nevydáno.
- 19. 11. 2026 ~9:10 — Dan schválil vydání 0.1.12. Založen PR #198 (ba89b2a), běží CI a Codex review sol 6.2 max read-only (panel term_78cb59d8). Bump verze a poznámky psal Claude sám (4 řádky, delegace by stála víc než práce).
- 19. 11. 2026 ~9:45–9:56 — PR #198 sloučen (1e79f4e, review sol 6.2 3 kola: VRATIT, VRATIT, PRIJMOUT_S_VYHRADAMI; vždy jen nepřesné věty poznámek, kód beze změny). Tag v0.1.12 → běh 44490096456 zrušen GitHubem: runner macos-14 nepodporován. PR #199 (macos-15) sloučen 5b842e2, tag v0.1.12 smazán a založen znovu na 5b842e2 (ze starého nic nevyšlo). Běh 44490583130: brány ✅, sestavení a podpis ✅, **notarizace ✗ HTTP 403 „A required agreement is missing or has expired“** (Apple Developer, tým UF7G4Y6FS6). Nic nepublikováno, uživatelé na 0.1.11. **Čeká na Dana: podepsat smlouvu v Apple Developer**, pak `gh run rerun 44490583130` (tag beze změny). Okrajový případ firmy ve stejném panelu připsán k #190.
- 19. 11. 2026 ~12:10–12:25 — Dan v chatu: smlouvu v Apple Developer podepsal. `gh run rerun 44490583130` (pokus 2): všechny kroky ✅ včetně notarizace, publikace a ověření feedu. **✅ LuDone Desktop 0.1.12 VYDÁNA** — https://stahnout.ludone.cz/desktop/latest-mac.yml hlásí `version: 0.1.12` (ověřeno curl). Otázka Q-20261119-085631 uzavřena. Opravy samotné dál 🧪 do Danova prokliku na Macu.
- 19. 11. 2026 13:44 — Dan (chat, snímek): na 0.1.12 krátce „Firma není vybraná“, pak se samo opravilo. Rozbor (⛔ čtení kódu): `upload-companies:default` vrací `companyId: null` i při přechodném stavu (obnova přihlášení) a panel to ukáže jako „empty“. Založeno #200 **bez** štítku proklik (čeká na Dana).
- 19. 11. 2026 13:50 — Dan (chat, snímek): stav nahrávky není jasný, klárku nejde zkusit znovu, „dej lokální session ať prokliká, pak levně opravit“. Založeno **#201 (proklik)** s briéfem pro MacBook (jen čtení + proklik → komentář do #201). Z Devu se na MacBook nedostanu (SSH nenastavené), session spouští Dan. Rozbor z kódu: štítek „Schváleno k odeslání · čeká ve frontě“ ignoruje blokaci (červená tečka), retry jen pro „selhalo“.
