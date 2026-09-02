# Návrh sekce: distribuce

**NEZMRAZENO.** Vzniklo 1. 9. 2026 ve workflow `doplneni-masterplanu`. Skeptická revize
leží v `revize-*.md` vedle a **našla v těchhle sekcích nepravdivá tvrzení** — do `spec.md`
ani `plan.md` se to proto nevkládá celé. Co z toho už platí, je v `spec.md` §11.

---

## 5. Deploy pořadí

Rozvoz dnes **neexistuje**. `scripts/package-mac.mjs` vyrobí složku `release/LuDone Desktop.app`, ad-hoc podepsanou (`codesign --force --deep --sign -`, `package-mac.mjs:83`) — bez DMG, bez ZIP, bez čísla verze v UI, bez updateru. Inventář to vede jako `E21` CHYBÍ, `E22` produkční podpis POPSÁNO a díry 1, 2, 13 a 16. Tahle sekce fixuje **pořadí a podmínky**, ne termín.

### 5.1 Co je zjištěné

**GitHub Releases jako místo ke stažení: ano, jde to.** Z veřejného repozitáře stáhne přílohu vydání kdokoli bez účtu. Jeden soubor smí mít **do 2 GiB**, na jedno vydání **až 1000 příloh**, a GitHub uvádí, že *„na celkovou velikost vydání ani na přenesená data limit není"* ([GitHub Docs — About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)). Electronový balík se do 2 GiB vejde s velkou rezervou — **naše konkrétní velikost je zatím nezměřená**, protože přenositelný artefakt neexistuje. Vedlejší efekt ve prospěch A2 (nulový paušál): GitHub Actions jsou na standardních runnerech pro **veřejné** repozitáře zdarma, kdežto v privátním se **macOS minuty odečítají 10×** ([GitHub Docs — Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)).

**Automatická aktualizace: jde, ale jen pro podepsanou aplikaci. Tohle je tvrdá závora.**

| Cesta | Co vyžaduje | Verdikt |
|---|---|---|
| `electron-updater` + provider `github` | ZIP target (jinak nevznikne `latest-mac.yml`), **podepsaná** aplikace | jediná reálná cesta, ale až po certifikátu |
| Vestavěný `autoUpdater` Electronu | totéž — stojí na Squirrel.Mac | totéž |
| Sparkle | vlastní **appcast** na naší URL + EdDSA klíč | ❌ appcast potřebuje server, a ten je mimo rozsah (S1) |
| Vlastní update server | server | ❌ mimo rozsah (S1) |

Doslovně: *„Your application must be signed for automatic updates on macOS. This is a requirement of `Squirrel.Mac`."* ([Electron — autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater)) a *„macOS application must be signed in order for auto updating to work"* + *„`zip` target for macOS is **required** for Squirrel.Mac, otherwise `latest-mac.yml` cannot be created"* ([electron-builder — Auto Update](https://www.electron.build/docs/features/auto-update/)). „Podepsaná" tady znamená **Developer ID**, což vyžaduje členství v Apple Developer Program a notarizaci ([Apple — Developer ID](https://developer.apple.com/support/developer-id)); poplatek je **99 USD ročně** ([Apple — Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)). Sparkle sice Developer ID uvádí jen jako *„if possible"* a umí EdDSA, ale jeho dokumentace **GitHub Releases vůbec nezmiňuje** a předpokládá appcast na vlastní doméně ([Sparkle — Documentation](https://sparkle-project.org/documentation/)).

**Nepodepsaná aplikace se aktualizovat nedá a rozbije se u toho víc než jen update:**

1. Update sám neproběhne (viz výše). Praktický projev je hlášení `Could not get code signature for running application`.
2. 🔴 **TCC oprávnění se ztratí při každé nové verzi.** Ad-hoc podpis nemá stabilní *designated requirement*, takže macOS nepozná, že verze N+1 je táž aplikace — odpověď Apple DTS: *„Ad hoc signed code does not include a stable DR, and thus macOS is unable to tell that version N+1 of your app is the 'same code' as version N."* ([Apple Developer Forums 795739](https://developer.apple.com/forums/thread/795739)). Pro nás to znamená, že **mikrofon i Záznam obrazovky se povolují znovu při každé aktualizaci** — a dnes jsou obě povinné (`Onboarding.jsx:216-223`).
3. 🔴 **Uložený token může přestat jít přečíst.** Electron u `safeStorage` píše: *„Without a valid, consistent code signature, macOS may be unable to tell that two builds of your unsigned app are 'the same app'"* ([Electron — Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)). Náš přístup k tokenu jde výhradně přes `safeStorage` (§1, `electron/auth.cjs`), takže nepodepsaná aktualizace může uživatele tiše odhlásit.
4. Bez podpisu je jediná „aktualizace" ruční: stáhnout novou verzi a přetáhnout ji přes starou.

**Co uvidí člověk, který si to stáhne.** Prohlížeč přilepí souboru `com.apple.quarantine` a Gatekeeper první spuštění zastaví. Na Sequoii už **neexistuje** starý zkratkový obchvat přes Ctrl-klik → Otevřít; místo něj jsou **tři dialogy**: pokus o spuštění a zamítnutí → Nastavení → Soukromí a zabezpečení → *Otevřít přesto* → druhé varování → ověření heslem ([Apple removes Control-click bypass](https://appleinsider.com/articles/24/08/06/apple-removes-control-click-option-for-skipping-gatekeeper-in-macos-sequoia), [Eclectic Light — Living with(out) notarization](https://eclecticlight.co/2024/10/01/living-without-notarization/)).

🔴 **AirDrop tohle NEOBCHÁZÍ.** *„AirDrop adds quarantine flags to all files transferred: apps, other executable code, command tools, archives, and documents"* a *„you can't work around this by sending them in a Zip archive"* ([Eclectic Light — AirDrop and quarantine flags](https://eclecticlight.co/2019/10/24/airdrop-and-quarantine-flags/)). AirDrop tedy **není** levnější varianta rozvozu — je to totéž s ručním doručováním. Rozdíl proti stažení je jediný: **lokálně sestavená kopie karanténní příznak nedostane**, protože ho lepí stahující aplikace. Proto fáze RZ1 níž nic z tohohle neřeší.

⚠️ **Nedoloženo, a rozhoduje to o proveditelnosti RZ2:** není jisté, jestli náš **ad-hoc podepsaný** balík skončí na průchodné cestě *„nelze ověřit → Otevřít přesto"*, nebo na hlášce *„je poškozený a nelze otevřít"*, u které tlačítko *Otevřít přesto* nenaskočí. Zdroje k tomuhle rozdílu jsou jen blogové, ne Apple. **Musí se změřit** (viz 5.5, měření RZ-M1).

**Veřejný repozitář u firemní aplikace:** problém to sám o sobě není, ale **odporuje už zapsanému rozhodnutí** („Neplatit GitHub Pro ani nezveřejňovat repo", `decisions.md`). Čistý smír je **oddělit vydání od zdrojáku**: zdrojový repozitář zůstane privátní a vznikne druhý, **veřejný, jen na vydání**. `electron-builder` má `owner` i `repo` jako explicitní volby s autodetekcí jen jako výchozí chování ([electron-builder — publish](https://www.electron.build/docs/publish/)), takže cíl vydání lze nasměrovat jinam; **že to funguje napříč repozitáři, jsem v dokumentaci doslova nenašel — ověří se prvním publikováním.** Opačná cesta, tedy privátní repozitář jako zdroj aktualizací, znamená rozdat **`GH_TOKEN` na 24 Maců**; vlastní dokumentace `electron-builder` ji označuje za *„only for very special cases — not intended and not suitable for all users"* a připomíná limit **5000 API dotazů na uživatele a hodinu, přičemž jedna kontrola aktualizace spotřebuje až 3** ([electron-builder — Auto Update](https://www.electron.build/docs/features/auto-update/)). ⇒ **Návrh: veřejný repozitář jen na vydání, zdroják privátní.**

### 5.2 RZ1 — jen u Dana

**Kanál:** žádný. `npm run package:mac` na Danově Macu, spuštění z `release/`. Karanténa nevzniká, Gatekeeper mlčí, certifikát není potřeba. **Aktualizace = přeložit znovu.**

Co musí být hotové, než tahle fáze platí za dokončenou:

- `DESKTOP_UPLOAD_ENABLED` i `DESKTOP_TIME_ENABLED` fail-closed (§1) — jinak se doma testuje něco jiného než to, co pojede dál.
- Změřené RZ-M2 a RZ-M3 (5.5): přežije po přebuildu udělené oprávnění a uložený token? Tohle je **jediná fáze, kde se to dá měřit zadarmo**, a odpověď určuje, jestli RZ2 vůbec dává smysl.
- V panelu viditelné číslo verze a datum buildu (dnes chybí, inventář `B10`). Bez toho se nepozná, kterou verzi člověk drží.
- `cz.ludone.desktop` se **nesmí měnit** — změna bundle id resetuje udělená oprávnění (komentář `package-mac.mjs:15`).

### 5.3 RZ2 — sdílení v týmu (párový experiment P1/P2 + zasedačka)

**Kanál:** návrh — jedno vydání ve veřejném repozitáři jen na vydání, artefakt **ZIP** (ne DMG; DMG přidává instalační krok, který v téhle fázi nic neřeší). Bez certifikátu, tedy **bez automatické aktualizace** a s ruční výměnou balíku.

Co pro to musí být hotové:

- **Přenositelný artefakt vůbec vzniknout musí.** Dnes vzniká složka, ne soubor. To je práce, ne konfigurace — buď se `package-mac.mjs` doplní o ZIP, nebo se přejde na `electron-builder`. **Návrh: přejít rovnou na `electron-builder`**, protože RZ3 ho stejně vyžaduje kvůli `latest-mac.yml`, a dvojí cesta k balíku znamená dvojí ladění podpisu. Při té příležitosti zmizí `codesign --deep`, které Apple pro podepisování nedoporučuje ([TN2206](https://developer.apple.com/library/archive/technotes/tn2206/_index.html)).
- **Změřená RZ-M1** — jestli protistrana skončí na *Otevřít přesto*, nebo na *poškozený*. Když vyjde druhá možnost, RZ2 bez certifikátu **není proveditelná** a padá rovnou na RZ3.
- **Česká instalační stránka s postupem přes Nastavení → Soukromí a zabezpečení**, včetně toho, že se po každé nové verzi znovu povolí mikrofon a Záznam obrazovky. Bez ní se to nedá dát ani dvěma lidem.
- **Sdílené zařízení `zasedacka@makemore.cz` (B10)** — dokud není hotové, nemá smysl balík do zasedačky posílat.
- Odinstalace popsaná jako postup: `Application Support`, `safeStorage`, TCC záznamy, neodeslané WebM (inventář, díra 16). U sdíleného Macu to není hygiena, ale ochrana nahrávek.

⛔ Co RZ2 **nesmí**: sloužit jako důvod ke koupi certifikátu. Rozhodnutí A2/E10 zní „nekupovat, dokud neproběhne P1/P2" — RZ2 je právě ten běh, ne jeho následek.

### 5.4 RZ3 — širší rozvoz (celý tým, ~24 lidí dle `intent.md`)

**Kanál:** návrh — veřejný repozitář jen na vydání + `electron-updater` s providerem `github`. Uživatel nepotřebuje účet ani token.

Vstupní podmínka, bez které se do RZ3 nedá vstoupit: **Dan koupil Apple Developer Program (99 USD ročně).** ⚠️ Tvrdé kritérium A2 zní „nulový **měsíční** paušál" — roční poplatek Apple do jeho písmene nespadá, ale opakující se platba to je. **Výklad A2 pro roční poplatek patří Danovi, ne mně.**

Co musí být hotové:

1. Developer ID Application certifikát, hardened runtime, **notarizace a stapling** ([Apple — Developer ID](https://developer.apple.com/support/developer-id)). Bez notarizace zůstane i podepsaná aplikace na Gatekeeperu.
2. Záloha `.p12` a hesla mimo repozitář (`DAN-TODO.md:144-178` to už popisuje).
3. `electron-builder` s targety **DMG + ZIP** — ZIP je povinný, jinak `latest-mac.yml` nevznikne.
4. **Vypnutá aktualizace během nahrávání a ukládání** — spec `R5` to už nařizuje; potřebuje guard a sabotáž, která jeho odstranění chytí. 🔴 Souvisí s Danovým požadavkem na **spolehlivé dvě hodiny nahrávky**: dvouhodinová schůzka je dvě hodiny, kdy se updater nesmí ozvat ani restartovat aplikaci.
5. **Návrh nového pravidla, ve specu zatím není:** odchozí fronta musí aktualizaci přežít stejně jako odhlášení (`R12`). Zatím to nikde nestojí.
6. Podepisování a notarizace v CI na macOS runneru — na veřejném repozitáři zdarma. Tajemství jdou do GitHub Secrets, nikdy do stromu.
7. **Rozhodnutí Dana o veřejném repozitáři na vydání** — mění zapsané „nezveřejňovat repo".

### 5.5 Co se musí změřit na skutečném Macu

| # | Měření | Jak | Co na tom visí |
|---|---|---|---|
| **RZ-M1** | Stáhnout ad-hoc podepsaný ZIP z GitHubu do prohlížeče a spustit na čistém účtu | zapsat **doslovné** znění dialogu a jestli se v Nastavení objeví *Otevřít přesto* | proveditelnost celé RZ2 bez certifikátu |
| **RZ-M2** | Udělit mikrofon + Záznam obrazovky, přeložit znovu (jiný cdhash), spustit | ptá se macOS znovu? | jak drahá je každá verze pro uživatele |
| **RZ-M3** | Přihlásit se, přeložit znovu, spustit | jde token ze `safeStorage` pořád přečíst? | jestli aktualizace odhlašuje |
| **RZ-M4** | Velikost hotového ZIP a DMG | `ls -lh` | jen kontrola proti 2 GiB (očekává se hluboko pod) |
| **RZ-M5** | *(až po certifikátu)* Publikovat vydání do **jiného** repozitáře než zdrojového a nechat klienta najít aktualizaci | jeden ostrý běh | jestli oddělení zdrojáku od vydání funguje |
| **RZ-M6** | *(až po certifikátu)* Doba obrátky notarizace | čas od odeslání po ticket | tempo vydávání |

**Rozhodnuté od stolu, měřit netřeba:** GitHub Releases jako místo ke stažení funguje · automatická aktualizace bez podpisu **nefunguje** a žádná varianta to neobejde · Sparkle vyžaduje vlastní appcast, tedy server mimo rozsah · AirDrop není obchvat Gatekeeperu · privátní repozitář jako zdroj aktualizací se zamítá kvůli `GH_TOKEN` na cizích Macích.

### 5.6 Co nesmí do veřejného repozitáře

Zveřejnění odkrývá **celou historii**, ne jen poslední stav — co tam jednou bylo, tam zůstane. Nikdy: Developer ID `.p12` a jeho heslo · app-specific password nebo App Store Connect API klíč pro notarizaci · `GH_TOKEN` · klíč pro přepis (rozhodnutí A3 ho stejně přesouvá do správy v `app.ludone.cz`, ne do kódu) · jakékoli tokeny do Tabidoo, backendu LuTracku a skladu · **zvukové vzorky a testovací nahrávky se skutečnými hlasy** · jména, e-maily a názvy schůzek v testovacích datech, fixtures i snímcích obrazovky · bezpečnostní nálezy `C4` (rozhodnutí M13 je drží mimo git — to platí dál).

Naopak problém **nejsou**: OAuth client id (veřejný klient s PKCE nemá tajemství), bundle id, TCC texty, ani doména `app.ludone.cz`.

🔴 **Diagnostický export přiložený k veřejnému hlášení chyby se řídí týmž pravidlem jako log:** žádný zvuk, token, e-mail ani název schůzky, identifikátory jen jako GUID. Veřejný repozitář znamená, že tohle pravidlo přestává být interní hygiena a stává se hranicí ven.

### 5.7 Otevřené pro Dana

| # | Otázka | Doporučený default |
|---|---|---|
| **RZ-D1** | Veřejný repozitář **jen na vydání**, zdroják privátní? Mění zapsané „nezveřejňovat repo" | **ano** — bez něj musí `GH_TOKEN` na 24 Maců |
| **RZ-D2** | Je roční 99 USD slučitelné s A2 („nulový měsíční paušál")? | výklad patří Danovi; **bez toho RZ3 neexistuje** |
| **RZ-D3** | Když RZ-M1 skončí na „poškozený", jde RZ2 přeskočit rovnou na RZ3? | **ano**, jinak zbývá jen ruční `xattr` v Terminálu — u 24 lidí neúnosné |

---

## Předpoklady, na kterých to stojí

- Fáze jsem pojmenoval RZ1/RZ2/RZ3, ne D1/D2/D3 — D1–D7 i E0–E10 podle decisions.md patří výhradně plánu a B*/BD* běhu, takže by vznikla kolize čísel.
- Sekci jsem očísloval jako „## 5." — plan.md dnes končí sekcí 4 („Co se v noci nesmí"). Pokud má Deploy pořadí stát jinde, číslo se musí posunout.
- Předpokládám, že párový experiment P1/P2 zmíněný v zadání = ten, na kterém podle A2/E10 visí koupě certifikátu, a že se dá odjet na dvou Macích bez širšího rozvozu.
- Předpokládám, že „~24 lidí" z intent.md je i cílový počet příjemců desktopu, ne jen počet lidí vykazujících čas.
- Že electron-builder umí publikovat do JINÉHO repozitáře, než ze kterého se staví, jsem v dokumentaci doslova nenašel — jen to, že owner a repo jsou explicitní volby s autodetekcí jako fallback. Zapsal jsem to jako měření RZ-M5, ne jako fakt.
- Rozdíl mezi hláškou „nelze ověřit → Otevřít přesto" a „je poškozený a nelze otevřít" u AD-HOC podepsané aplikace mají doložený jen blogové zdroje, ne Apple. Označil jsem to jako nedoložené a udělal z toho měření RZ-M1, protože na něm visí proveditelnost celé fáze RZ2.
- Velikost našeho artefaktu neznám — přenositelný balík dnes nevzniká (package-mac.mjs dělá jen složku). Do textu jsem napsal „nezměřeno", ne odhad.
- Tvrzení, že --deep je od macOS 13 deprecated, jsem doložit nedokázal (jen komunitní zdroje); v textu je proto jen Apple TN2206 a formulace „nedoporučuje".
- Sparkle jsem zamítl na základě toho, že jeho dokumentace předpokládá appcast na vlastní doméně a GitHub Releases nezmiňuje. Existenci komunitních Electron↔Sparkle můstků jsem neověřoval — pro nás je stejně blokující, že appcast potřebuje server, který je podle S1 mimo rozsah.

## Otázky na Dana

- Veřejný repozitář JEN na vydání, zdrojový kód zůstane privátní — souhlasíš? Mění to zapsané rozhodnutí „nezveřejňovat repo" z decisions.md. Bez veřejného kanálu musí být GH_TOKEN rozdaný na 24 Maců, což vlastní dokumentace electron-builderu odmítá jako nevhodné.
- Kritérium A2 zní „nulový MĚSÍČNÍ paušál". Apple Developer Program je 99 USD ROČNĚ. Spadá roční poplatek pod A2, nebo ne? Bez odpovědi neexistuje fáze RZ3 (žádná automatická aktualizace, protože ta bez podpisu na macOS nefunguje).
- Souhlasíš s přechodem z ručního scripts/package-mac.mjs na electron-builder už ve fázi RZ2? Fáze RZ3 ho vyžaduje kvůli latest-mac.yml, takže dvojí cesta k balíku znamená dvakrát ladit podpis.
- Když měření RZ-M1 ukáže, že ad-hoc podepsaná stažená aplikace končí na „je poškozený a nelze otevřít" (bez tlačítka Otevřít přesto), má se fáze RZ2 přeskočit a jít rovnou na certifikát? Jediná alternativa je ruční xattr v Terminálu u každého člověka.
- Máme do specu doplnit pravidlo, že odchozí fronta musí přežít aktualizaci aplikace (obdoba R12 pro odhlášení)? Dnes to nikde nestojí.
