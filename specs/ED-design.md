# ED — Designová větev LuDone Desktop (canvas do repa, sjednocení tokenů, dokreslení chybějících stavů před E5/E6)

> Vzniklo 24. 8. 2026 z ultracode analýzy. Master plán: [`../PLAN.md`](../PLAN.md).

## Cíl

Z dnešních pěti artboardů, které kreslí okno s archivem a dva výtvarné směry vedle sebe, udělat jediný závazný designový podklad pro menu-bar spouštěč: canvas přestěhovaný do `ludone-desktop`, směr B a okenní archiv archivované (ne smazané), tokeny navázané na existující projekt „LuDone Přístroj Design System" a dokreslené obrazovky, bez kterých se E5 (upload) a E6 (přihlášení + fronta) nedají postavit — fronta odesílání, OAuth přes prohlížeč, odmítnutá oprávnění, ztráta systémové stopy, pauza, souběh LuTracku s nahráváním. Výstupem je soupis stavů `design/STAVY.md`, který je smlouvou mezi artboardem a `data-state` v kódu, a strojová brána, která hlídá, že se ty dva nerozejdou.

## Kroky

### 1. Přestěhovat canvas do ludone-desktop a zjistit, že dnes není nikde zálohovaný

Zjištěno měřením: `/Users/dan/Dev/ClaudeCode/luplaud-vyzkum` JE git repo, ale nemá NIC commitnuté a nemá remote — `git status` hlásí `?? mockupy/` a `git ls-files mockupy` vrací prázdno. Mockupy tedy dnes existují v jediné kopii na disku. Postup: `mkdir -p /Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/archiv`; `cp /Users/dan/Dev/ClaudeCode/luplaud-vyzkum/mockupy/canvas.json /Users/dan/Dev/ClaudeCode/luplaud-vyzkum/mockupy/*.dc.html /Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/`; `ludone-desktop-mockupy.html` (2 295 063 B, generovaný publikační balík) NEkopírovat — místo něj do `design/README.md` napsat URL artifactu 452f2aed-cf23-471c-8bc3-52bbfb5140c5; do `.gitignore` přidat `design/canvas/*-mockupy.html`. Pak `git add design/ && git commit -m "Bring the design canvas into the app repo" && git push origin main`. Originál v luplaud-vyzkum NEMAZAT, dokud push neprojde. Kód appky leží na větvi `feat/kostra-appky` (main ho nemá), design jde přímo na `main` — nekolidují. Pracovní strom podle pravidla 1b: `orca worktree create --name design-canvas --display-name "Desktop: designová větev"`.

**Hotovo když:** `git -C /Users/dan/Dev/ClaudeCode/ludone-desktop ls-files design | wc -l` vrací aspoň 6 a `git log origin/main -1 --stat` ukazuje soubory z design/; `ludone-desktop-mockupy.html` v `git ls-files` NENÍ.

### 2. Archivovat směr B — rozhodnutím A14 mrtvý, ale nemazat

Odpověď na otázku 6: ARCHIVOVAT, ne smazat. Důvod: `MacHlavni.dc.html` je jediný doklad, proč A14 padlo tak, jak padlo; po smazání je z rozhodnutí názor a někdo ho za tři měsíce otevře znovu. `git mv design/canvas/MacHlavni.dc.html design/canvas/archiv/`. V `design/canvas/canvas.json` smazat jeho položku z pole `artboards` a přepsat anotaci `poznamka-smery` (dnes nabízí oba směry jako rovnocenné) na jednu větu: „Směr A platí od 20. 8. (A14). Směr B je v archiv/ jako doklad, ne jako volba." Zároveň `Lista.dc.html` obsahuje směr B v pravém sloupci (`class="sys"`, `backdrop-filter: blur(50px)`, systémová modrá `#0A84FF`) — ten sloupec vyříznout do `archiv/Lista-smerB.dc.html` a levý sloupec (směr A) přejmenovat na `Lista-a-ikona.dc.html`. Do `design/canvas/archiv/README.md` zapsat co, kdy a proč (A14, 20. 8. 2026).

**Hotovo když:** `grep -c '\"file\"' design/canvas/canvas.json` odpovídá počtu artboardů mimo archiv; `grep -rl '0A84FF\|backdrop-filter' design/canvas --include=*.dc.html` vrací pouze soubory v `archiv/`.

### 3. Vyřadit Main.dc.html a TmavyRezim.dc.html jako desktopovou specifikaci — kreslí archiv, který podle A11/A12 do aplikace nepatří

Oba artboardy kreslí okno 1080×700 se sidebarem („Moduly / Záznamy 53 / Čas / Úkoly"), polem „Hledat v zápisech…" a seznamem starých nahrávek se stavy „Čeká na potvrzení / V hubu / Přepisuje se". To je přesně to, co A11 („aplikace je spouštěč, ne platforma") a A12 („dnešní schůzky ANO, archiv nahrávek NE") z aplikace vyloučily. Kód je v tomhle správně: `electron/main.cjs` staví panel 366×792 bez rámu (`PANEL_WIDTH = 366`, `PANEL_HEIGHT = 792`, `frame: false`) a žádný seznam záznamů ani hledání nemá. `git mv design/canvas/Main.dc.html design/canvas/TmavyRezim.dc.html design/canvas/archiv/web-archiv/` a do `archiv/web-archiv/README.md` napsat, že popisují MODUL na app.ludone.cz (archiv, hledání, potvrzování zápisů), ne desktopovou appku — až se bude navrhovat web, začne se odsud. Roli „hlavní obrazovka aplikace" přebírá nový `Panel.dc.html` z kroku 7.

**Hotovo když:** V `design/canvas/` (mimo archiv) není žádný artboard širší než 1200 px a `grep -ri 'Hledat v zápisech\|Odesláno do hubu' design/canvas --include=*.dc.html` vrací jen cesty pod `archiv/`.

### 4. Rozhodnout design system: nezakládat třetí projekt, přisadit desktop k „LuDone Přístroj Design System"

Odpověď na otázku 4, podložená výpisem z DesignSync. Existují dva kandidáti: `86e837a2-306f-40fc-b261-e0545547994e` „LuDone Design System" (updatedAt 2026-04-27, čtyři měsíce ležící) a `c5ee8498-bd71-466b-8e3e-3c264ae6d7f3` „LuDone Přístroj Design System" (updatedAt 2026-08-05, obsahuje `tokens/colors.css`, `tokens/fonts.css`, `tokens/shape.css`, `foundations/base.css`, 20+ komponent v JSX, `assets/logo/lutrack-mark.svg` a — což je klíčové — už dnes odděluje kit od tokenů přes `ui_kits/ludone-app/**`). DOPORUČENÍ: nezakládat nový projekt, ale přidat do Přístroje sourozence `ui_kits/ludone-desktop/**` + `tokens/desktop.css`. Důvod: tokeny (barvy, písmo, tvar, mřížka) mají jediné místo, komponenty se stejně nesdílí a oddělí je adresář — přesně jak to dnes funguje pro ludone-app. Dvě paralelní DS projekty by se rozešly během měsíce a nikdo by nepoznal, který je pravda. Postup: `DesignSync get_project` na c5ee8498 (ověřit `type: PROJECT_TYPE_DESIGN_SYSTEM` a `canEdit`), pak `list_files`, `finalize_plan` s writes `ui_kits/ludone-desktop/**` a `tokens/desktop.css`, teprve pak `write_files`. Do starého projektu 86e837a2 NEZAPISOVAT.

**Hotovo když:** `DesignSync list_files` na c5ee8498 vrací cesty pod `ui_kits/ludone-desktop/` a `tokens/desktop.css`; projekt 86e837a2 zůstává beze změny (`updatedAt` se nezměnilo).

### 5. Sjednotit tokeny — tři nekompatibilní palety a čtyři sady písem dnes žijí vedle sebe

Naměřený rozpor: (a) ludone-app DS v3.0 má primary modrou `oklch(0.55 0.2 260)`, písmo Brockmann + Public Sans; (b) Přístroj DS `tokens/colors.css` má akcent indigo `--accent: oklch(0.48 0.16 268)`, neutrály s nádechem (hue 260–266) a písmo Instrument Sans + IBM Plex Sans + IBM Plex Mono; (c) mockup má zelenou `#1B7A43` a Schibsted Grotesk + Public Sans; (d) kód `src/styles.css` má `--green: oklch(0.5 0.17 145)`, neutrály s NULOVOU chromou (`oklch(0.16 0 0)`) a nadpisy v `ui-rounded`. A14 přitom velí „vlastní písmo a zelený akcent". Řešení: `design/tokeny/ludone-desktop.css` importuje neutrální rampu, tvar a mřížku z Přístroje beze změny a PŘEBIJE jen tři věci — `--accent` (zelená), `--font-display`, `--font-ui`. Zelenou zapsat do OKLCH a doměřit kontrast na `--surface-card` (mockupová `#1B7A43` na bílé dává ~4,9:1, na tmavém pozadí kódu propadá — pro tmavý režim je potřeba světlejší varianta, viz `--green-bright`, kterou kód už má). Zelená se do sdíleného `tokens/colors.css` NEPŘIDÁVÁ, jinak přebarví i `ui_kits/ludone-app`. Pak přepsat blok `:root` v `src/styles.css` (dnes 27 vlastních proměnných) tak, aby jména odpovídala Přístroji (`--surface-card`, `--text-muted`, `--border-hairline`, `--state-wait`…), ne dnešním vlastním (`--card`, `--muted-foreground`, `--border`).

**Hotovo když:** `src/styles.css` neobsahuje jediný hex ani oklch literál mimo `:root` blok a jména proměnných se shodují s `tokens/colors.css` Přístroje (ověřit `comm -13` nad seřazenými seznamy jmen).

### 6. Zavést písmo do balíčku — appka dnes vypadá jako směr B, který A14 zabil

Naměřeno: `src/styles.css:3` deklaruje `font-family: "Public Sans", -apple-system, …`, ale v repu není žádné `@font-face`, žádný soubor `.woff2`, žádný adresář `public/` a `index.html` má CSP `default-src 'self'` — takže Google Fonts se nenačtou a Public Sans se nikdy nepoužije. Aplikace se dnes vykresluje v San Franciscu, tedy nativním systémovým písmem — to je přesně směr B. Kdo posuzuje vzhled ze screenshotů v `.runtime/smoke/`, posuzuje něco jiného, než co je naspecifikované. Kroky: stáhnout latin + latin-ext `.woff2` (Public Sans pro text, display font podle rozhodnutí D-A), uložit do `src/fonts/`, přidat `@font-face` s `font-display: block` a `unicode-range` pro latin-ext (česká diakritika), do CSP doplnit `font-src 'self'`, a nadpisové pravidlo na `src/styles.css:86` (`font-family: ui-rounded, …`) přepsat na `var(--font-display)`.

**Hotovo když:** V běžící appce vrátí `getComputedStyle(document.querySelector('h1')).fontFamily` deklarovaný display font a `document.fonts.check('16px "Public Sans"')` je `true`; v konzoli není ani jedna chyba CSP.

### 7. Sepsat rozdíl mockup × kód do design/STAVY.md a udělat z něj smlouvu

Odpověď na otázku 1, položkově. V MOCKUPU a v kódu CHYBÍ: (1) sloupcový ukazatel hlasitosti (20 sloupců v `Lista.dc.html`) — kód nemá žádnou zpětnou vazbu o hladině, jen text „Obě stopy ověřeny"; (2) tlačítko pauzy vedle „Ukončit a zpracovat" — `RecordingCard.jsx` `MediaRecorder.pause()` vůbec nevolá, umí jen stop; (3) dva zdrojové čipy „Mikrofon" / „Systém"; (4) hlavička kontextu „Google Meet · Týdenní schůzka" — kód bere titulek jen z mockovaného kalendáře, detekci aplikace nemá; (5) systémové upozornění „Začíná schůzka — Nahrát / Teď ne" — v `electron/main.cjs` není `Notification` použito ani jednou; (6) čas 24:18 přímo v liště vedle ikony — `Tray` je jen ikona 18×18 bez titulku; (7) světlý režim a okenní rám s trojicí koleček — kód je natvrdo tmavý (`color-scheme: dark`, `<meta name="color-scheme" content="dark">`, žádné `prefers-color-scheme`); (8) tři karty nastavení (Obecné/Nahrávání/Účet) — `Settings.jsx` je jedno rolovací okno 448×676; (9) kalendář označený „volitelné" — `Onboarding.jsx` má `disabled={!allGranted}`, tedy všechna tři oprávnění POVINNĚ; (10) jméno „Dan Jirotka / DJ" × kód má natvrdo „Daniel Novák / daniel@ludone.cz / DN". V KÓDU a v mockupu chybí: (a) celý čtyřkrokový onboarding (Vítejte / Přihlášení / Oprávnění / Hotovo) včetně schématu 1-2-3 a náhledu stavů ikony; (b) fáze `checking` („Kontroluji mikrofon i systémový zvuk…"); (c) fáze `stopping` („Dokončuji obě nahrávky…"); (d) chybová hláška se skutečným technickým textem („mikrofon: …; systémový zvuk: …"); (e) úspěšná hláška „Uloženo místně: <soubor> (<B>)… Odeslání zůstává vypnuté."; (f) celá karta LuTracku (výběr projektu, popis, přepínač Start/Stop); (g) prázdný den v kalendáři; (h) stavový čip v hlavičce panelu (Nepřihlášeno / Připraveno / Nahrává / LuTrack běží); (i) čtyři varianty tray ikony jako SVG; (j) rozměry — kód 366×792 a 448×676, mockup 1080×700 a karta 336 px. Zapsat každý stav do `design/STAVY.md` jako řádek `id | kde | artboard | data-state v kódu` s identifikátory typu `rec.checking`, `rec.recording`, `rec.paused`, `rec.stopping`, `rec.error`, `queue.waiting`, `auth.browser-wait`, `perm.denied.mic`.

**Hotovo když:** `design/STAVY.md` má aspoň 40 řádků a každý řádek má vyplněné všechny čtyři sloupce (žádný `—` ve sloupci artboard).

### 8. Dokreslit stavy nahrávání, ztrátu systémové stopy a odmítnutá oprávnění — blok před E2/E3

Odpověď na otázku 2, první polovina. Tři nové artboardy, každý 1180×880, panelové výřezy 366 px: (A) `Nahravani.dc.html` — pět stavů: kontrola obou stop / nahrává (s ukazatelem hladiny a časem) / pozastaveno / ukládám / start selhal s konkrétním technickým řádkem. (B) `Ztrata-stopy.dc.html` — dnešní kód při `ended` nebo `mute` na kterékoli stopě zavolá `reportRuntimeFailure` a CELÉ nahrávání ukončí (`RecordingCard.jsx`, posluchače `track.addEventListener("ended"/"mute")`). Navrhnout tři stavy: spadla systémová stopa (banner + volba „Pokračovat jen s mikrofonem" × „Ukončit a uložit"), spadl mikrofon, spadlo obojí — a v každém ukázat, kolik minut je už bezpečně na disku. (C) `Opravneni.dc.html` — dnešní mock `ipcMain.handle("permission:request")` v `electron/main.cjs` VŽDY vrací `{ granted: true }`, takže odmítnutí nikdo nikdy neviděl. Nakreslit: před dotazem / odmítnut mikrofon / odmítnut systémový zvuk / odmítnut kalendář (degradace, ne cihla) / částečně povoleno / povoleno, ale zařízení zmizelo. U odmítnutí NESMÍ být tlačítko „Povolit" — macOS po odmítnutí systémový dialog znovu nikdy nezobrazí; správný prvek je „Otevřít Nastavení systému" mířící na `x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone`. Do textů opravit lež: systémový zvuk se v kódu bere přes `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`, takže macOS se ptá na ZÁZNAM OBRAZOVKY — mockup i onboarding dnes slibují dialog „Systémový zvuk", který uživatel neuvidí.

**Hotovo když:** Všechny tři artboardy jsou v `canvas.json`, každý stav z nich má řádek v `STAVY.md` a v `Opravneni.dc.html` se nevyskytuje slovo „Povolit" v odmítnutém stavu.

### 9. Dokreslit frontu odesílání a přihlášení přes prohlížeč — tvrdá podmínka startu E5 a E6

Odpověď na otázku 2, druhá polovina, a odpověď na otázku 5 v části „co musí být PŘED E6". (D) `Fronta.dc.html` — sedm stavů položky a jeden souhrn: čeká (offline) / odesílá se s procenty / odesláno / selhalo s důvodem / další pokus za 2 min s odpočtem / vzdáno po N pokusech s ručním „Zkusit znovu" / token vypršel uprostřed fronty; plus patička panelu se souhrnem („3 čekají · 1 selhalo") a prázdná fronta. Bez tohohle artboardu nemá E5 co implementovat na straně UI a E6 nemá kam frontu vykreslit. Dnes kód frontu neřeší vůbec — `finishRecording` jen zapíše soubory a hláška končí větou „Odeslání zůstává vypnuté." (E) `Prihlaseni.dc.html` (přepracovaná levá polovina dnešního `Nastaveni.dc.html`) — OAuth 2.1 + PKCE s loopback redirectem podle D1: výzva k přihlášení / otevírám prohlížeč / čekám na návrat s tlačítkem Zrušit a s časovým limitem / návrat selhal (uživatel zavřel okno) / stav neodpovídá (`state` mismatch, tedy pokus o podvržení) / přihlášen jiný účet, než čí je fronta / odhlášen s neprázdnou frontou. Nakreslit i stránku, kterou uvidí PROHLÍŽEČ po úspěšném callbacku („Hotovo, tohle okno můžeš zavřít") — patří k E5, ale je součástí toho samého zážitku. Dnešní `ipcMain.handle("auth:begin")` je 650ms `setTimeout` vracející `mock-token-not-persisted`, takže žádný z těch stavů zatím nikdo nenavrhl.

**Hotovo když:** Oba artboardy jsou v `canvas.json`, Dan je odsouhlasil, a zadání pro E5 i E6 na ně odkazují jménem souboru — bez toho odsouhlasení se E5 a E6 nespouští.

### 10. Dokreslit panel, lištu a souběh LuTracku s nahráváním

(F) `Panel.dc.html` nahrazuje vyřazený `Main.dc.html`: panel 366×792 ve třech stavech — přihlášený s dnešními schůzkami, prázdný den, nepřihlášený. (G) `Lista-a-ikona.dc.html` — sedm stavů ikony v liště (nepřihlášeno, klid, nahrává, pozastaveno, LuTrack běží, nahrává + LuTrack, fronta selhala) plus kontextové menu po pravém kliku a upozornění „Začíná schůzka". Kód má dnes jen ČTYŘI stavy (`signed-out`, `idle`, `recording`, `tracking` v `App.jsx`) a `useMemo` v `App.jsx` dává nahrávání přednost — když běží obojí, lišta zamlčí, že běží časovač. (H) `LuTrack.dc.html` — časovač sám, souběh s nahráváním (dva časy v jednom panelu, dva různé významy), volba projektu a popisu, zastavení. Zodpovědět v návrhu otázku, kterou kód dnes neřeší: zastaví se časovač, když se zastaví nahrávání? Dnešní `TrackingCard.jsx` o nahrávání neví vůbec.

**Hotovo když:** `Lista-a-ikona.dc.html` obsahuje sedm variant ikony a `STAVY.md` má pro každou z nich řádek s odpovídajícím `trayState` v `App.jsx` (dnes chybí tři).

### 11. Postavit bránu, která hlídá, že se artboard a kód nerozejdou

Nový `scripts/design-gate.mjs` + `"design:gate": "node scripts/design-gate.mjs"` v `package.json`. Tři kontroly: (1) každé `id` z `design/STAVY.md` se vyskytuje v aspoň jednom `design/canvas/*.dc.html` a zároveň v `src/**` jako `data-state="<id>"`; (2) `src/styles.css` neobsahuje hex ani `oklch(` mimo blok `:root`; (3) každý `"file"` v `canvas.json` na disku existuje a žádný nemíří do `archiv/`. Brána běží ručně a jako pre-commit hook. Zároveň v `src/` doplnit chybějící `data-state` atributy — `RecordingCard.jsx` už má `data-recording-phase`, ten přejmenovat na `data-state` s prefixem `rec.`.

**Hotovo když:** `npm run design:gate` skončí s návratovým kódem 0 a vypíše řádek „stavů: N, bez artboardu: 0, bez kódu: 0, hex mimo tokeny: 0".

### 12. Vypsat rozhodnutí, která design nemůže udělat za Dana, a určit pořadí zbytku

Do `DAN-TODO.md` a do tabulky D v `ROZHODNUTI.md` zapsat šest stopek, na které se PŘESKAKUJE (běh pokračuje na tom, co na nich nezávisí): D-A písmo nadpisů — Schibsted Grotesk z mockupu × Instrument Sans z Přístroje × licencovaný Brockmann z ludone-app (Přístroj Brockmann záměrně nepoužívá, viz `tokens/fonts.css`); D-B světlý režim, tmavý, nebo oba — kód umí jen tmavý, mockup jen světlý, a Dan má v systému zapnutý tmavý s omezenou průhledností; D-C zelená jako akcent desktopu vedle indigové v Přístroji, a zda se vůbec smí objevit ve sdílených tokenech; D-D chování při ztrátě systémové stopy (dnešní tvrdý stop × pokračovat jen s mikrofonem); D-E pauza ano/ne; D-F kalendář v onboardingu povinný (dnešní kód) × volitelný (mockup). Pořadí zbytku, odpověď na otázku 5: PŘED E5/E6 musí být hotové kroky 5, 6, 8 a 9 (tokeny, písmo, stavy nahrávání, oprávnění, fronta, přihlášení) — E5 i E6 by se jinak kreslily dvakrát; kroky 7, 10 a 11 běží souběžně s nimi; AŽ PO E6 přijde kalendář (artboardy pro E7: rozpoznaná schůzka, odpočet před automatickým startem, konflikt dvou schůzek), plný LuTrack (E8: denní souhrn, oprava záznamu, projekty z Tabidoo) a dodělané nastavení s účtem (E9). Návrh výsledného vzhledu a funkcí se pak dělá v Claude Design nad `ui_kits/ludone-desktop/**`, ne ručně v repu.

**Hotovo když:** Šest položek D-A…D-F je v `DAN-TODO.md` s datem a odkazem na artboard, kterého se týkají; v `ROZHODNUTI.md` přibyl řádek za každé rozhodnutí, které designová větev udělala bez Dana.

## Měřítko etapy

Tři měřitelné podmínky naráz: (1) `cd /Users/dan/Dev/ClaudeCode/ludone-desktop && npm run design:gate` skončí návratovým kódem 0 a vypíše „stavů: N, bez artboardu: 0, bez kódu: 0, hex mimo tokeny: 0"; (2) `git ls-files design | wc -l` vrací aspoň 16 a `grep -rl '0A84FF\|backdrop-filter\|Hledat v zápisech' design/canvas --include=*.dc.html` vrací výhradně cesty pod `design/canvas/archiv/`; (3) canvas publikovaný na PŮVODNÍ adresu 452f2aed-cf23-471c-8bc3-52bbfb5140c5 obsahuje devět artboardů (Panel, Nahravani, Ztrata-stopy, Fronta, Prihlaseni, Opravneni, LuTrack, Lista-a-ikona, Nastaveni), ani jeden ze směru B, a Dan u něj odsouhlasil `Fronta.dc.html` a `Prihlaseni.dc.html` — bez tohoto souhlasu se E5 ani E6 nespouští.

## Dotčené soubory

- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/README.md (nový — proč canvas žije tady, URL artifactu, jak se publikuje)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/STAVY.md (nový — soupis stavů, smlouva mezi artboardem a data-state v kódu)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/tokeny/ludone-desktop.css (nový — přebíjí --accent, --font-display, --font-ui nad tokeny Přístroje)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/canvas.json (přenesený z luplaud-vyzkum, přepsaný seznam artboardů i anotace)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/Panel.dc.html (nový — nahrazuje vyřazený Main.dc.html)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/Nahravani.dc.html (nový)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/Ztrata-stopy.dc.html (nový)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/Fronta.dc.html (nový — blokuje E5)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/Prihlaseni.dc.html (nový — blokuje E6)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/Opravneni.dc.html (nový)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/LuTrack.dc.html (nový)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/Lista-a-ikona.dc.html (ze směru A dnešního Lista.dc.html, sedm stavů ikony)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/Nastaveni.dc.html (přenesený, rozdělený na tři karty, rozměr 448×676)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/archiv/MacHlavni.dc.html (archivovaný směr B — A14)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/archiv/Lista-smerB.dc.html (vyříznutý pravý sloupec dnešní Lista.dc.html)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/archiv/web-archiv/Main.dc.html (podklad pro modul na app.ludone.cz, ne pro appku)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/archiv/web-archiv/TmavyRezim.dc.html`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/design/canvas/archiv/README.md (co je archivované, kdy a proč)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/.gitignore (výjimka na generovaný design/canvas/*-mockupy.html)`
- `src/styles.css (dnes v .claude/worktrees/kostra/, po E0 v kořeni — přepis bloku :root na jména tokenů Přístroje, nadpisy z ui-rounded na var(--font-display))`
- `src/fonts/*.woff2 (nové — latin + latin-ext, dnes v repu není jediný soubor písma)`
- `index.html (doplnit font-src 'self' do CSP, dnes default-src 'self' blokuje i lokální cestu k fontům přes @import)`
- `src/features/recording/RecordingCard.jsx (data-recording-phase → data-state s prefixem rec.)`
- `src/components/Onboarding.jsx (stav odmítnutého oprávnění, kalendář jako volitelný podle D-F)`
- `scripts/design-gate.mjs (nový) + package.json (skript design:gate)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/ROZHODNUTI.md (tabulka D — rozhodnutí udělaná bez Dana)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/DAN-TODO.md (stopky D-A…D-F)`
- `DesignSync projekt c5ee8498-bd71-466b-8e3e-3c264ae6d7f3: ui_kits/ludone-desktop/** a tokens/desktop.css (nové)`

## Pasti — co tuhle etapu shodí

- Mockupy dnes existují v JEDINÉ kopii. `luplaud-vyzkum` je sice git repo, ale nemá nic commitnuté a nemá remote — `git ls-files mockupy` vrací prázdno. Dokud neprojde push do `ludone-desktop`, nesmí se v luplaud-vyzkum nic mazat ani přesouvat.
- Artboardy `.dc.html` odkazují na `./support.js`, který v adresáři NENÍ — dodává ho běhové prostředí Claude Design při publikaci. Kdo je otevře přes `file://`, uvidí prázdno a nahlásí je jako rozbité, i když v pořádku jsou.
- Canvas se edituje v PUBLIKOVANÉM artifactu. Kdo přepíše lokální soubory a publikuje na novou adresu, tiše zahodí Danovy ruční úpravy — vždycky publikovat na 452f2aed-cf23-471c-8bc3-52bbfb5140c5 a před editací si publikovanou verzi přečíst.
- Public Sans se v appce nikdy nenačte (žádné @font-face, žádný .woff2, CSP default-src 'self'), takže se dnes vykresluje San Francisco — tedy směr B, který A14 zabil. Kdo posoudí vzhled ze screenshotů v .runtime/smoke/, posuzuje jiný produkt, než jaký je naspecifikovaný.
- Zelená patří DESKTOPU, ne sdíleným tokenům. Zapsat ji do `tokens/colors.css` Přístroje znamená přebarvit i `ui_kits/ludone-app`, kde je akcent indigo `oklch(0.48 0.16 268)`. Override patří výhradně do `tokens/desktop.css`.
- Mockupová zelená `#1B7A43` je laděná na světlé pozadí `#FAFAFA`. Na tmavém pozadí kódu (`oklch(0.16 0 0)`) propadne kontrastem — tmavý režim potřebuje vlastní světlejší odstín, ne tentýž hex.
- macOS po odmítnutí oprávnění systémový dialog už NIKDY znovu nezobrazí. Tlačítko „Povolit" v odmítnutém stavu je mrtvé tlačítko — musí vést do Nastavení systému. Dnešní mock `permission:request` vrací vždy `{ granted: true }`, takže tuhle větev nikdo nikdy neviděl.
- Systémový zvuk jde přes `getDisplayMedia`, takže macOS se ptá na ZÁZNAM OBRAZOVKY. Mockup i onboarding slibují dialog „Systémový zvuk" — uživatel uvidí něco jiného, lekne se a odmítne. Texty se musí opravit dřív, než je někdo napíše do kódu.
- Pauza je v mockupu nakreslená, v kódu neexistuje. Se dvěma nezávislými `MediaRecorder` se nesynchronní pauza projeví jako trvalý posun mezi stopami — návrh pauzy musí říct, co se děje s druhou stopou, jinak vznikne přepis, kde si lidé skáčou do řeči.
- Fronta navržená dřív, než E5 určí formát chunku a chování retry, se překreslí dvakrát. Artboard `Fronta.dc.html` proto musí vzniknout ve stejném kole jako zadání pro E5, ne po něm — a E5 na něj musí odkazovat jménem souboru.
- Onboarding dnes vyžaduje všechna tři oprávnění (`disabled={!allGranted}`). Když uživatel odmítne kalendář, který je v mockupu označený jako „volitelné", zůstane appka viset na třetím kroku a je z ní cihla.
- Kód appky NENÍ na `main` — leží na větvi `feat/kostra-appky` v ignorovaném worktree `.claude/worktrees/kostra`. Kdo bude editovat `src/styles.css` z kořene repa, bude editovat soubor, který tam ještě není.
- Dvě zapisující session v jednom stromu si přepisují práci. Designová větev musí mít vlastní worktree — E5 a E6 podle D3 běží souběžně ve dvou dalších.
