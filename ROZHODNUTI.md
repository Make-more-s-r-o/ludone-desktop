# Rozhodnutí — LuDone Desktop

Zápis z 19.–20. 8. 2026. Slouží k tomu, aby se nemuselo znovu rozhodovat to, co už rozhodnuté je.
Kdo na to naváže: **přečti tenhle soubor první.** Podklady jsou v `/Users/dan/Dev/ClaudeCode/luplaud-vyzkum/`.

## Co se staví a proč

Vlastní aplikace na macOS, která nahrazuje placený Plaud. Dan za něj nechce dál platit a chce mít
nahrávání schůzek pod kontrolou, s archivem pro celý tým.

---

## A. Rozhodnuto — neotvírat znovu

| # | Rozhodnutí | Řekl kdy | Poznámka |
|---|---|---|---|
| A1 | **Přestat platit za Plaud.** Není to cílový stav ani přechodně dlouho | 19. 8. | Migrace historie je řešitelná skriptem, `get_file` vrací surové MP3 |
| A2 | **Nulový měsíční paušál** je tvrdé kritérium | 19. 8. | Jednorázové platby a platba za spotřebu jsou v pořádku |
| A3 | **Vlastní práce se nepočítá do peněz.** Hotovost a čas se drží odděleně | 19. 8. | „mojí práci nepočítej“ |
| A4 | **Lokální přepis se nepoužije** — „nefunguje dobře“ | 19. 8. | Přepis běží v cloudu přes klíč, i když Parakeet v3 češtinu umí |
| A5 | **Žádný nový hardware.** Osobní schůzky a telefonáty přes diktafon v iPhonu | 19. 8. | Dnes 58 % objemu vzniká na krabičce — počítat s tím, že část přestane vznikat |
| A6 | **Google Meet v prohlížeči je vyřazovací kritérium** | 19. 8. | Musí se poznat a nahrát |
| A7 | **Archiv pohromadě pro celý tým**, ne jen pro Dana | 19. 8. | Proto samostatný modul na serveru, ne jednouživatelská licence |
| A8 | **Údržbu dělá Dan sám** s AI asistencí | 19. 8. | Otázka „kdo to bude udržovat“ je zodpovězená, neuvádět jako otevřenou |
| A9 | **Staví se vlastní aplikace**, nekonfiguruje se cizí | 20. 8. | „nelíbí se mi, že to nemůžu změnit a že budu používat osekané funkce“ |
| A10 | **Název: `LuDone Desktop`** | 20. 8. | Třetí věc vedle `app.ludone.cz` a `LuDone Hub`. Pracovní název `LuPlaud` zrušen — byl podle konkurence |
| A11 | **Aplikace je spouštěč, ne platforma** | 20. 8. | Archiv, přepisy, hledání a dashboardy patří do webu |
| A12 | **Dnešní schůzky z kalendáře v aplikaci ANO**, archiv nahrávek NE | 20. 8. | Aplikace má umět doporučit nahrávání |
| A13 | **LuTrack se připravuje od začátku**, styl Toggl | 20. 8. | Nahrávání a časovač jsou dvě rovnocenné funkce jednoho panelu |
| A14 | **Výtvarný směr A (LuDone)**, ne nativní macOS | 20. 8. | Vlastní písmo a zelený akcent, ne systémový vzhled |
| A15 | **Nový samostatný repozitář `ludone-desktop`** | 20. 8. | Ne podadresář v LuDone — appka má jiný životní cyklus než web |
| A16 | **Noční pokus dělá obojí** — důkaz zvuku i kostru, každé zvlášť | 20. 8. | Dva oddělené pracovní stromy |

## B. Rozhodnuto podmíněně — platí, dokud to měření nevyvrátí

| # | Rozhodnutí | Na čem stojí | Co ho otočí |
|---|---|---|---|
| B1 | ✅ **POTVRZENO 21. 8. měřením — Electron platí** | Systémový zvuk naměřen naostro: stopa `System audio`, ticho 996 B × se zvukem 43 339 B za 5 s. Bez jediného nového dialogu | Nic. Otázka je uzavřená |
| B1-puvodni | ~~Electron (podmíněně)~~ | Chromium má od verze 141 zachycení systémového zvuku i potlačení ozvěny vestavěné, přes týž Core Audio tap jako Anarlog | Když noční pokus ukáže, že to v Electronu nejde, nebo si to řekne o oprávnění „Záznam obrazovky“ místo „Systémový zvuk“ → **Tauri s převzatým jádrem z Anarlogu** |
| B5 | ✅ **Aplikace opravdu nahrává** (21. 8., commit `2bb09ce`) | Dvě oddělené stopy, měření ticho × zvuk: systém 1 351 B → 27 993 B (20,7×), potvrzeno i FFmpegem (−91 dB → −20 dB) | Nic |
| B6 | ⚠️ **WebM z nahrávání má vadnou hlavičku Opus a chybí celková délka** | Zjistil Codex při ověřování FFmpegem | Vyřešit před zpracováním na serveru — teď nevadí, u přepisu může |
| B2 | **Z Anarlogu převzít jediný modul** (ořezané rozpoznání schůzky) | Zbytek Chromium nahradí | Padá s B1 — při Tauri jich je potřeba deset |
| B3 | **Klíč k přepisu nikdy v aplikaci**, jde přes prostředníka na serveru | Desktopová aplikace běží na cizím stroji; klíč z ní jde vytáhnout | Nic. Tohle je bezpečnostní, ne technická volba |
| B4 | Odhad **5–8 dnů na první etapu**, 18–30 na plnou | Platí pro appku se seznamem a detailem | Po A11 (spouštěč) mají být **nižší** — přepočítává se |

## C. Čeká na Dana — neblokuje noční běh

| # | Otázka | Doporučení |
|---|---|---|
| C1 | **Apple Developer Program, 99 $/rok** ⚠️ **doporučení se 21. 8. ZMĚNILO — viz níž** | **Začít bez placení.** Měřením se ukázalo, že jde o dvě nezávislé věci, ne o jednu |
| C2 | **GitHub** — repo je zatím jen lokální | Založit, až bude co ukazovat |
| C3 | **Jedna aplikace, nebo dvě** (nahrávání × čas) | Codex to řeší; předběžně jedna |
| C4 | **Tři nálezy v `ludone-app`** — deaktivace neodvolá klíče (`consents.ts:129` bez volajícího), prázdný výběr nástrojů vydá plný klíč (`mcp/actions.ts:90`), rozsah firmy má jedinou větev (`business-roles.ts:166-181`) | Zapsat do `DAN-TODO.md` jako samostatný úkol. **Platí na produkci dnes**, s tímhle projektem nesouvisí |
| C5 | **Čtyři rozhodnutí z předchozího návrhu** — pilot, Anarlog Pro, práva vedoucího, denní soupis | Viz `2-navrh-luplaud.md` v Downloads |


### C1 podrobně — proč se doporučení změnilo (21. 8. 2026)

Původně jsem psal, že bez placeného programu se oprávnění resetují při každé aktualizaci a je to
tedy nutnost. **Dvě nezávislá měření na tomto Macu to vyvrátila** — problém se rozpadá na dvě věci,
které se řeší každá jinak:

| | Čeho se týká | Jak často bolí | Vyřeší vlastní certifikát zdarma? |
|---|---|---|---|
| **Gatekeeper** | první spuštění stažené aplikace | jednou na osobu | **NE** — chce notarizaci, ta je jen v placeném programu |
| **TCC (mikrofon, systémový zvuk)** | po každé aktualizaci aplikace | pořád | **ANO** |

**Naměřeno:** u vlastního certifikátu zůstal „designated requirement“ mezi dvěma sestaveními
s odlišným kódem **totožný** (`identifier … and certificate root = H"…"`); u ad-hoc podpisu byl
pokaždé jiný (`cdhash H"…"`). Ověřeno dvakrát nezávisle.

**Zavřené cestičky:** `spctl --add` na macOS 26 už neexistuje · globální vypnutí Gatekeeperu systém
nedovolí · ad-hoc podpis nejde ustálit ani přes `codesign -i` · certifikát se kolegům rozvážet
nemusí (je v podpisu) a **nemá** (firemní důvěryhodný kořen je klíč od všeho a nic tím nezískáš).

**Doporučení:** začít bez placení. Cena je čtyřkrokový dialog v Nastavení při **první** instalaci
na osobu. Zaplatit až ve chvíli, kdy se aplikace bude rozdávat mimo firmu, nebo kdy to začne stát
víc vysvětlování než dva tisíce ročně.

⚠️ **Zbývá ověřit:** celý průběh od konce do konce (udělit oprávnění → změnit kód → znovu podepsat
→ spustit → nehlásí se znovu). Měřil se mechanismus, ne celý řetěz. Je to test na deset minut.

## D. Mandát pro práci bez Dana (20. 8. 2026, 22:40)

Dan doslova: *„kdyžtak nějak volně pokračuj, mojí představu znáš. chci pak jen prostě schvalovat
důležité věci, ale researchi a testování můžeš dělat a orchestrovat beze mě.“*

**Smí se bez ptaní:** průzkum, měření, pokusy, mockupy, orchestrace Codexu, zápis nálezů, úklid
po sobě, aktualizace tohoto souboru.

**Musí se schválit:** cokoli, co stojí peníze (Apple Developer, placené služby), cokoli veřejného
(založení repozitáře na GitHubu, sdílení odkazů ven), cokoli, co sahá na produkci `ludone-app`
nebo na hub, a změna kteréhokoli rozhodnutí z tabulky A.

**Každé rozhodnutí udělané bez Dana se zapíše sem** do tabulky níž — ne jen do zprávy v chatu,
protože ta se ztratí.

| Kdy | Rozhodnutí | Proč tak |
|---|---|---|
| 20. 8. | Repozitář zatím jen lokálně, bez GitHubu | Není co ukazovat, dokud pokus neproběhne (spadá pod „musí se schválit“, proto odloženo) |
| 20. 8. | Dva oddělené pracovní stromy místo jednoho | Dva běhy v jednom stromu si přepisují soubory a výsledek pak vypadá jako důkaz, i když není |
| 20. 8. | Codex běží se sandboxem **a** sítí | Bez sítě by nenainstaloval Electron; bez sandboxu by neměl žádnou zeď. Ověřeno, že jde obojí |
| 20. 8. | Skill pro Electron se zatím nepíše | Až po pokusu, ať vzniká z doložených pastí, ne z domněnek |
| 21. 8. | Pokus se zvukem zopakován v Danově relaci, ne v sandboxu | Noční běh neměl audio zařízení vůbec; opakování to potvrdilo a rovnou zodpovědělo hlavní otázku |
| 21. 8. | Dočasná klíčenka pro test podpisu vytvořena a smazána | Zásah do seznamu klíčenek vrácen zpět a ověřen |
| 21. 8. | Doporučení u C1 otočeno na „začít bez placení“ | Měření ukázalo, že oprávnění drží i s vlastním certifikátem; placený program řeší jen Gatekeeper, což je jednorázová obtíž |
| 21. 8. | Zákaz zvyšování práv doplněn do všech zadání | Danovi vyskočil dialog na heslo správce; Codex ho neprokazatelně nezpůsobil, ale pravidlo chybělo |
| 21. 8. | Spuštěn třetí Codex běh: zapojit skutečné nahrávání do kostry | Zvuk je ověřený, kostra existuje — spojení je logický další krok |

---

## Kde co leží

| Co | Kde |
|---|---|
| Podklady a výstupy Codexu | `/Users/dan/Dev/ClaudeCode/luplaud-vyzkum/` (`STAV.md` má přehled) |
| Ke čtení pro Dana | `~/Downloads/ludone-nahravani-schuzek/` |
| Analýza „přestat platit za Plaud“ | claude.ai/code/artifact/fc04803c-a97b-4d31-8beb-5aa7386a00ce |
| Návrh modulu | claude.ai/code/artifact/a2548c3f-9888-4a76-a58a-c8861d1ba8dd |
| Vlastní appka — rozhodnutí o nástroji | claude.ai/code/artifact/603e58d1-a8fb-4ae2-9dc0-6d5481347dbf |
| Jak to postavit (technický podklad) | claude.ai/code/artifact/c1c53385-e8c5-462a-9898-c6018384b87a |
| Mockupy | claude.ai/code/artifact/452f2aed-cf23-471c-8bc3-52bbfb5140c5 |

## Co běží k 20. 8. 22:35

- **Codex A** — důkaz zvuku, větev `feat/zvuk-dukaz`, log `log-zvuk.log`, výstup `NALEZ.md`
- **Codex B** — kostra appky, větev `feat/kostra-appky`, log `log-kostra.log`, výstup `KOSTRA.md`
- **Šest větví researche** — inspirace z malých Mac appek, Toggl, závěry z tech stacku, popis pro
  netechnika, rizika vibecodingu, zadání pro mockupy

Detekce mrtvého běhu: `stat -f %m log-*.log`; ticho přes 20 minut = mrtvý, ne přemýšlející.
Stav procesu lže.

## Poznatky k nástrojům, které stály čas

1. **`--output-schema` odmítne schéma bez `additionalProperties: false` na KAŽDÉ úrovni.** První
   pokus na tom spadl během vteřin s HTTP 400.
2. **Sandbox jde mít i se sítí:** `-c 'sandbox_workspace_write.network_access=true'`. Ověřeno
   naostro (HTTP 200 na registry.npmjs.org). Není tedy nutné pouštět Codex bez ochrany.
3. **`timeout` na macOS neexistuje** (je to `gtimeout` z coreutils).
4. **`orca terminal create --worktree path:<cesta>`** vrátí `selector_not_found` i pro platný
   repozitář; prošlo `--worktree current` s `cd` uvnitř spouštěcího skriptu.
5. **`codex login status` lže** — hlásil „Not logged in“, zatímco `auth.json` měl platné tokeny.
6. 🔴 **Nedokončený `codex login` smaže existující platný token.** Ověřeno časově: v 21:58
   `~/.codex/auth.json` existoval, po spuštění loginu, který zůstal viset na potvrzení
   v prohlížeči, zmizel. Obchvat: `CODEX_HOME` na Orca účet.
