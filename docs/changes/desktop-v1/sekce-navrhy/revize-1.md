# Skeptická revize 1

**Adversariální čtení návrhu sekce.** Zadání znělo najít, čím se dá
tvrzení obejít nebo v čem lže — ne schválit.

---

## Verdikt

Sekce je věcně nejpoctivější kus celého balíku — pět z pěti externích citací sedí doslova a nedoložené věci jsou označené. Ale jako **požadavek** je skoro celá nevymahatelná: je to popis toho, co se má stát, ne brána, kterou by šlo porušit a někdo by si toho všiml. A jedna z jejích dvou hlavních opor (argument „veřejné repo = Actions zdarma") si protiřečí s jejím vlastním doporučením.

---

## A. Co obstálo (ověřeno proti primárním zdrojům, doslova)

| Tvrzení | Stav |
|---|---|
| „Your application must be signed for automatic updates on macOS. This is a requirement of Squirrel.Mac." | ✅ doslova na electronjs.org/docs/latest/api/auto-updater |
| „macOS application must be signed in order for auto updating to work." + „zip target for macOS is required for Squirrel.Mac, otherwise `latest-mac.yml` cannot be created" | ✅ doslova na electron.build/docs/features/auto-update |
| „Private GitHub provider only for very special cases — not intended and not suitable for all users." + „rate limit of 5000 requests per user per hour. An update check uses up to 3 requests per check." | ✅ doslova, tamtéž |
| „Each file included in a release must be under 2 GiB." · „Up to 1000 release assets…" · „There is no limit on the total size of a release, nor bandwidth usage." | ✅ doslova, GitHub Docs *About releases* |
| „Ad hoc signed code does not include a stable DR, and thus macOS is unable to tell that version N+1 of your app is the 'same code' as version N." | ✅ doslova, Apple DTS (Quinn), forum 795739 — a vlákno je **přímo o ztrátě Screen Recording po aktualizaci**, což je náš případ |
| 99 USD ročně | ✅ doslova na developer.apple.com/help/account/membership/program-enrollment — pozor, na `support/developer-id` cena **není**, tam patří jen požadavek členství a notarizace |
| Sequoia ruší Ctrl-klik obchvat, náhrada přes Nastavení → Soukromí a zabezpečení | ✅ v podstatě potvrzeno (AppleInsider, MacRumors, Cult of Mac) |
| Ověření v repu: `getVersion` **nikde** v `electron/` ani `src/` · `package.json` version `0.1.0` · žádný updater · `codesign` až po `plutil` (správné pořadí) | ✅ |

Dobré taky: RZ-M1 je označené jako neměřené a je na něm správně zavěšená proveditelnost RZ2. To je poctivé.

---

## B. Čísla a citace, které neobstály

**B1 — „macOS minuty se v privátním repu odečítají 10×" je jediné číslo bez zdroje.** Citovaná stránka *Actions runner pricing* multiplikátor **neobsahuje**; obsahuje jen sazby za minutu (macOS 0,062 USD/min, macOS 12-core 0,077 USD/min). Ani *About billing for GitHub Actions* žádnou „10×" formulaci nemá — GitHub od jazyka multiplikátorů odešel k ceně za minutu. Co doložit **jde** doslova: *„GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners."*
**Oprava:** větu o 10× smazat, nechat citaci o zdarma pro veřejná repa a doplnit skutečnou sazbu. (Viz ale D1 — ten argument stejně padá.)

**B2 — off-by-one v kotvě, na které stojí celá první věta sekce.** `codesign --force --deep --sign -` je `/Users/dan/Dev/ClaudeCode/ludone-desktop/scripts/package-mac.mjs:84`. Řádek 83 je `plutil -replace LSUIElement`. Chyba je zděděná z inventáře (vede ji u A1 i E22) — opravit na obou místech, jinak si ji zdědí i další dokument.

**B3 — safeStorage: závěr je silnější než zdroj.** Electron docs říkají, že bez konzistentního podpisu **Keychain po každé aktualizaci znovu vyskakuje s dotazem** — což je opak „tiše". A náš kód se tiše degradovat nemůže: `persistEncryptedSession` při nedostupném `safeStorage` **vyhodí výjimku** (`/Users/dan/Dev/ClaudeCode/ludone-desktop/electron/auth.cjs:296-298`).
**Oprava formulace:** „po aktualizaci se může znovu ptát systémový Keychain; když se čtení nepovede, přihlášení je pryč — ale ohlásí se to chybou, ne mlčky."

**B4 — „tři dialogy + ověření heslem"** je jen blogový detail (Eclectic Light), podán bez hedge, zatímco slabší tvrzení o ad-hoc/„poškozený" hedge má. Sjednotit: buď obojí označit, nebo obojí poslat do RZ-M1 (ta hlášku stejně měří).

**B5 — DMG+ZIP jako „konfigurace, kterou je třeba udělat"**: výchozí target electron-builderu pro macOS **už je** `dmg+zip`. Práce je opačná — nesmí se ZIP vypnout. Přeformulovat, jinak to v RZ3 vypadá na krok, který tam není.

---

## C. Jak se to dá splnit formálně a nesplnit věcně

**C1 — Fáze nemají bránu, majitele ani artefakt.** „Co musí být hotové, než tahle fáze platí za dokončenou" je odrážkový seznam, který nikdo neodškrtává a nikde nebydlí. Někdo pošle balík do zasedačky bez hotového B10 a **žádná věta v dokumentu se tím nestane nepravdivou**.
*Oprava:* každá fáze = jeden soubor `docs/rozvoz/RZ<n>.md` s vlepenými doslovnými výstupy měření; a od RZ2 výš pravidlo, že **jediný povolený zdroj publikovaného artefaktu je běh CI z otagovaného commitu** — ruční build z notebooku se publikovat nesmí. Bez toho je „pořadí" jen doporučení.

**C2 — Měření RZ-M1..M6 nemají tvar výsledku ani expiraci.** „Zapsat doslovné znění dialogu" — kam? Měření, které nekončí souborem, je vzpomínka. A RZ-M2/M3 změřené jednou zůstanou „změřené" navždy, i když TCC chování je věc verze macOS.
*Oprava:* sloupce `soubor · datum · verze macOS · verdikt`, a pravidlo: **měření staršího majoru macOS neplatí**, musí se zopakovat.

**C3 — §5.6 „Co nesmí do veřejného repozitáře" je přání, ne požadavek.** Nic si porušení nevšimne, a sekce si sama správně říká, že zveřejnění odkrývá **celou historii** — tedy že nevratný okamžik je **první publikace**, ne pozdější commit. A přesně pro ten okamžik tam žádný krok není.
*Oprava, která z přání dělá strukturální nemožnost:* repozitář na vydání se zakládá **prázdný, bez zdrojové historie** — nese jen tagy a přílohy. Co tam nikdy nebylo, se nedá odkrýt. Doplnit navíc: (a) před zveřejněním čehokoli projet `git log -p --all` skenerem tajemství a výsledek vlepit do RZ-souboru; (b) secret-scan v CI publikačního repa.

**C4 — Pravidlo o diagnostickém exportu hlídá funkci, která neexistuje.** Diagnostika je v inventáři `B10 CHYBÍ`. Dnes ho tedy nikdo porušit nemůže, a až se postaví, nic si porušení nevšimne.
*Oprava:* pojmenovat měřidlo. Unit test nad fixturou, která **schválně obsahuje token, e-mail a název schůzky**, tvrdí, že se v exportu ani v logu neobjeví žádný z nich a že identifikátory mají tvar GUID; plus sabotáž, která odstraní redakci a musí test rozsvítit červeně. Bez toho je Danův požadavek na logy v této sekci jen citace.

**C5 — R5 („aktualizace se nikdy nenabídne během nahrávání") jde splnit doslova a přesto rozbít dvouhodinovou nahrávku.** `electron-updater` má ve výchozím stavu `autoDownload = true` a `autoInstallOnAppQuit = true` — nic se „nenabídne", a přesto se na pozadí stáhne balík a při ukončení se nainstaluje, klidně nad neodeslanou frontou.
*Oprava — přepsat na to, co je vymahatelné:* během nahrávání a ukládání se **nevolá `checkForUpdates`**, `autoDownload` je `false` a `quitAndInstall` je zablokované; instalace se nesmí spustit, dokud fronta není prázdná. A body 4 a 5 z RZ3 (guard + „fronta přežije aktualizaci") **patří do `spec.md` §4 jako R21/R22**, ne do plánu — jinak je příští audit najde znovu jako chybějící.

**C6 — „`cz.ludone.desktop` se nesmí měnit" je komentář, ne brána.** Jeden `sed` v `package-mac.mjs:15` a všem testerům tiše zmizí udělená oprávnění; build i běh projdou.
*Oprava:* třířádkový test `BUNDLE_ID === "cz.ludone.desktop"`. Nejlevnější brána v celé sekci.

**C7 — „viditelné číslo verze a datum buildu" se kontroluje okem.** Ověřeno, že dnes chybí úplně (`getVersion` nikde, verze `0.1.0`). Ruční string v UI ale projde stejně dobře jako správný — a pak lže po každém buildu.
*Oprava:* panel musí zobrazovat `app.getVersion()` (ne literál) a razítko buildu generuje `package-mac.mjs`; `ui-smoke` to tvrdí.

**C8 — RZ-M5 je zavěšené za certifikátem, ale rozhoduje o RZ-D1, které se dělá před RZ2.** Rozdělit: **M5a** = publikace ZIPu do *cizího* repa (měřitelné hned, zdarma, bez certifikátu) · **M5b** = klient tam najde aktualizaci (až po certifikátu). Jinak se rozhoduje o rozdělení rep dřív, než se ověří, že rozdělení funguje.

---

## D. Vnitřní rozpory

**D1 — nejzávažnější: argument o Actions zdarma neplatí pro vlastní doporučení sekce.** 5.1 používá „veřejná repa mají Actions zdarma" jako bod ve prospěch A2 a o dva odstavce dál doporučuje **zdroják nechat privátní**. Jenže minuty se účtují repu, ve kterém workflow **běží** — tedy privátnímu. Build a notarizace tak zdarma nejsou. Buď se argument škrtne, nebo se musí říct, že se v publikačním repu buildí i podepisuje (a pak je otázka, co tam vlastně je za zdroj — a rozbíjí se to o C3).

**D2 — kolize čísel, které se autor chtěl vyhnout.** V jedné sekci je `B10` dvakrát ve dvou významech: 5.2 „inventář `B10`" = *O aplikaci/diagnostika*, 5.3 „Sdílené zařízení (B10)" = *story B10 z `plan.md`*. Přesně ta kolize, kvůli které vznikla řada RZ*. Rozlišit `inv-B10` vs `plan-B10`.

**D3 — „dnes jsou obě oprávnění povinná" použito jako trvalý fakt.** Sedí to na kód (`/Users/dan/Dev/ClaudeCode/ludone-desktop/src/components/Onboarding.jsx:216-223`, `disabled={!allGranted}`), ale `spec.md` §6 to vede jako **vadu** („částečné povolení funguje dál · 🔴 zamyká celou appku") a `DAN-TODO.md` D-F to má rozhodnuté opačně. Sekce tedy staví cenu aktualizace na stavu, který se má opravit. Přeformulovat na „znovu se povolí to, co uživatel povolil".

**D4 — RZ2 ⛔ vs. RZ-D2 bez lhůty.** „RZ2 nesmí být důvodem ke koupi certifikátu" a zároveň „bez rozhodnutí o 99 USD RZ3 neexistuje". Dvě pravidla proti sobě a nic je nerozsekne. Doplnit: RZ-D2 se předkládá Danovi **spolu s výsledkem RZ-M1**, jinak běh stojí.

---

## E. Co v sekci chybí úplně

**E1 — architektura a minimální macOS.** Sekce se hlásí k díře 1, ale její polovinu nechává prázdnou. Změřeno v repu: `node_modules/electron/dist/Electron.app/Contents/MacOS/Electron` je **`Mach-O 64-bit executable arm64`** — dnešní skript tedy vyrábí balík pro architekturu stroje, na kterém se staví, a člověk s Intel Macem nedostane nic. `LSMinimumSystemVersion` je **11.0**, zděděné ze šablony Electronu, nikdy nerozhodnuté. Do sekce patří tři řádky: universal vs. arm64-only, minimální macOS, a čí Macy tým vlastně má (neznám).

**E2 — přesun do `/Aplikace` a odkud se to spouští.** Instalační stránka v 5.3 ho nezmiňuje; inventář díra 2 ho vede jako chybějící. Spuštění ZIPu rovnou z `~/Stažené` je u karanténovaného balíku jiný případ než z `/Aplikace` (translokace) — u nás **neověřeno**, patří do RZ-M1 jako druhá otázka.

**E3 — návrat na předchozí verzi.** Sekce se jmenuje „Deploy pořadí" a rollback nemá žádný. `plan.md` §1 slibuje revertovatelnost po story, u rozvozu to bez toho neplatí. Jedna věta: starší vydání se z publikačního repa **nemažou** a instalační stránka nese odkaz na poslední fungující.

**E4 — co se stane s rozdělanou prací při výměně balíku.** Testeři se budou ptát první. `userData` výměna `.app` nesahá, fronta i nahrávky přežijí — ale nikde to nestojí, takže to nikdo neví.

**E5 — kdo je při RZ2 příjemce a co se od něj čeká.** „Párový experiment P1/P2" se nikde v `intent.md`/`decisions.md` nedefinuje (A2/E10 ho jen zmiňují). Sekce na něm staví celou fázi, aniž by řekla, co P1/P2 měří a kdo rozhodne, že dopadl.

**E6 — `xattr` jako fallback (RZ-D3) bez varování.** Návod pro 24 lidí na „spusť v Terminálu `xattr -d com.apple.quarantine`" je přesně ten postup, proti kterému Apple ten Ctrl-klik obchvat v Sequoii rušil. Jestli to zůstane jako fallback, musí u něj být věta, že se tím tým učí obcházet Gatekeeper — to zesiluje doporučení „přeskoč na RZ3", ne oslabuje.

---

## Tři nejlevnější změny s největším účinkem

1. **Publikační repo se zakládá prázdné, bez zdrojové historie** — z §5.6 se ze seznamu přání stane vlastnost, kterou nejde porušit.
2. **Test na `BUNDLE_ID` + test redakce diagnostického exportu nad fixturou s tokenem, e-mailem a názvem schůzky** — dvě pravidla, která dnes nikdo nehlídá, za pár řádků.
3. **Přepsat R5 z „nenabídne se" na „`autoDownload=false`, žádné `checkForUpdates`, `quitAndInstall` zablokované, dokud běží nahrávání nebo je fronta neprázdná"** — a přesunout to do `spec.md`, ne nechat v plánu.