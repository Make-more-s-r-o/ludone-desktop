# Skeptická revize 6

**Adversariální čtení návrhu sekce.** Zadání znělo najít, čím se dá
tvrzení obejít nebo v čem lže — ne schválit.

---

## A. Co je v pořádku (přeověřeno v kódu)

Většina čísel má zdroj a sedí. Ověřeno v `/Users/dan/Dev/ClaudeCode/ludone-desktop`:

- **Prahy L1** sedí do posledního čísla: `schuzka-mereni.mjs` — 5 % (ř. 46), 6 dB (58), 0,18 (70), 20 s / 4 repliky (74–75), 3 % (78). Citace `46,58,70,74-78` je **správná**. Gongy 0,875 nad prahem 0,18 jsou doložené v kódu (ř. 64–66) i v `dukazy/meridlo-schuzka-overeni-2026-09-01/README.md`. `NEPRŮKAZNÉ` končí `exit 1` (ř. 311, 431).
- `powerMonitor`/`powerSaveBlocker` v `electron/` a `src/` opravdu nejsou. `electron/ikony/src` je prázdný. `release/LuDone Desktop.app/Contents/MacOS/Electron` ✓. Electron 37.3.1 ✓. `~/Library/Application Support/LuDone Desktop/` bez `nahravky` ✓.
- `LUDONE_DATA_DIR` (170–191), `createFromDataURL` (251), manifest `complete`+`sha256` (582–632), `incomplete` (516, 654), pořadí chunku (563), mock token (681–692), `audio:"loopback"` (420), `RecordingCard.jsx:8` a `:145` — všechno sedí. 128 000 b/s × 7 200 s = 115,2 MB ✓.
- `askForMediaAccess` umí jen `microphone`/`camera` — potvrzeno v dokumentaci Electronu. `npm run gates` = `lint && typecheck && test:unit`, takže pravidlo 7 platí.
- Chybějící pátý stav ikony je doložený: `trayIconName` (220–229) má čtyři větve a `default → signed-out`.

**Špatné citace k opravě:** L1 `meet-mereni.mjs:60-64` → ve skutečnosti **50, 51, 54**. L4 „soubory `0600` (`main.cjs:479-480`)" → `0o600` je na **435**, 480 je jen adresář `0700`. L10 `PANEL_HEIGHT` je **ř. 28** (27 je `PANEL_WIDTH`). L7 `#2f9e44` je fill pro **recording** (~211), tracking má `#75d38c` (~214).

---

## B. Jak se to dá obejít nebo jak to lže

**1. 🔴 Pravidlo 2 a pravidlo 3 se navzájem vylučují.** Aplikace spuštěná z Finderu **nemůže dostat `LUDONE_DATA_DIR`** — `open` proměnné nepředává. Buď se spouští z Finderu a ostrá data se špiní, nebo se spouští z terminálu, což pravidlo 2 zakazuje. *Oprava:* vyjmenovat schůdné cesty (`launchctl setenv` před spuštěním GUI, nebo `LSEnvironment` v zabaleném `Info.plist`) a **do zápisu povinně napsat, která se použila**.

**2. 🔴 L11 je dnes zaručeně zelené, a to dvakrát.** `setAppLogsPath` běží **jen** ve větvi pod `LUDONE_DATA_DIR` (`main.cjs:186-190`) → žádný log. A appka z Finderu nemá stdout → není co greppovat. Výsledek: nula nálezů, ✅, nic ověřeno. Autor fail-open zmiňuje, ale „počet řádků" ho neuzavře. *Oprava:* (a) minimální počet řádků + povinný **kanárek** — v logu musí být vidět aspoň jeden očekávaný záznam (`[recording] Uloženo:`); když tam není, výsledek je ⛔ NEMĚŘENO, ne ✅; (b) grep, který nenajde ani kanárka, je rozbitý grep.

**3. L11 nevidí renderer.** Celé nahrávání i přihlášení běží v `src/features/recording/RecordingCard.jsx`, jehož `console.*` do stdout hlavního procesu neteče. Mock přihlášení vrací natvrdo e-mail `daniel@ludone.cz` (`main.cjs:689-691`) — kdyby ho panel vypsal, L11 ho nezachytí. *Oprava:* přidat DevTools console (nebo `--enable-logging`) jako povinný zdroj.

**4. L11 nekryje Danovo pravidlo celé.** „Identifikátory jen jako GUID", ale cesty nesou **uživatelské jméno macOS** (`/Users/<jméno>/…`) a grep na ně není. Doplnit čtvrtou třídu.

**5. 🔴 Pravidlo 5 si protiřečí s `.gitignore` — a je to ta nejdražší past.** Pravidlo říká „ukázky zůstávají v `dukazy/`". `.gitignore` má schválně `!dukazy/**` a v gitu **už leží čtyři `.webm`/`.aiff`**. L1 běh 4 vyrábí `ukazka-systemove-stopy.m4a` **ze skutečné schůzky s cizí protistranou** → skončí v historii repa. Dan přitom zvažuje zveřejnění repa na GitHubu kvůli distribuci; z historie to nesmažeš. *Oprava:* tvrdý řádek — do `dukazy/` jen `vysledek.json` + `README.md`; zvuk ze skutečných schůzek **nikdy do gitu**, a přidat `dukazy/**/*.{m4a,webm,wav,aiff}` vedle výjimky na `.DS_Store`. Bez toho je pravidlo 5 přání, ne požadavek.

**6. L1 běhy 2 a 3 se dají splnit nicneděláním.** „Běh 2 = FAIL, a to je správně" splní i nespuštěný Meet. Běh 3 („rozdíl pod 0,3") splní i dvě nulové korelace. Kontrolní běh, který projde bez práce, nedokazuje, že měřidlo umí říct „ne". *Oprava:* číselné pozitivní podmínky — běh 2 musí mít v **mikrofonní** stopě řeč a nenulové RMS obou stop; běh 3 musí mít **obě** korelace nad 0,8 a rozdíl pod 0,3.

**7. L1 nevynucuje jeden build.** ⚠️ mluví jen o změně verze Electronu, jenže ad-hoc podpis (`scripts/package-mac.mjs:84`, `--sign -`) mění identitu appky **při každém buildu** — to už `docs/ux/cesta-uzivatele-2026-09-01.md` uvádí jako důvod, proč se Keychain ptá znovu. *Oprava:* u každého ze čtyř běhů povinně commit + `sha256` zabaleného `.app`; když se liší, výsledek je ⛔. A doplnit, že běhy 1–4 se nahrávají **zabalenou** aplikací (dnes to L1 nikde neříká a L4 přiznává, že se s balenou nikdy nenahrávalo).

**8. L2 krok 5 je měřidlo, které nemůže selhat.** `requestSingleInstanceLock` (197–200) druhou instanci ukončí a `second-instance` (716–722) ukáže panel té první. Dvě instance nastat nemůžou → `ps aux | grep` vrátí vždy jednu. Popsaný „druhý příznak selhání" je navíc opačný: druhé spuštění **panel otevře**, čímž se neviditelná ikona sama zamaskuje. *Oprava:* krok 5 přepsat na „spusť podruhé z Finderu a zapiš, jestli se otevřel panel".

**9. L2 tvrdí, že ikona je šablonová — v kódu není.** `setTemplateImage` se nevolá nikde; `trayImage` navíc dělá `resize({18,18})`, což `docs/ux/cesta-uzivatele-2026-09-01.md:94` označuje za mimo doporučené velikosti (naměřeno `tray.getBounds().width=16` místo 32). „Stav nese tvar, ne barva" je dnes přání. *Oprava:* do „co má vyjít" dát měřitelné — `isEmpty()===false`, 16×16 + @2x, `setTemplateImage(true)` **zůstane** platné, a dva snímky (světlá + tmavá lišta).

**10. „Do 5 s" nemůže změřit ten, kdo ví, kde ikona je.** Buď jednorázově na člověku, který appku nikdy neviděl (zapsat kdo), nebo lhůtu vypustit a měřit „našel / nenašel bez nápovědy". V předpokladech je to přiznané, v textu scénáře ne.

**11. 🔴 L3 krok 4 čeká chování, které Electron dokumentuje opačně.** Dokumentace `askForMediaAccess`: *„If access is denied and later changed through System Preferences, the app must be restarted for new permissions to take effect."* L3 jako úspěch žádá návrat **bez restartu**. Scénář tedy zapíše jako vadu aplikace zdokumentované chování platformy. *Oprava:* rozdělit — (a) panel po návratu správně **zobrazí** stav z `getMediaAccessStatus('screen')` (to bez restartu jít má); (b) že se **zachycení rozjede** bez restartu, je nezměřené a zapisuje se jako zjištění, ne jako pass/fail.

**12. L5 má vnitřní rozpor v tolerancích.** „± 5 %" na každou stopu povolí mezi stopami rozdíl až ~10 %, ale „jak se pozná selhání" i `schuzka-mereni.mjs:78` mluví o **3 %**. Scénář tedy může projít v podobě, kterou měřidlo A6 odmítne. *Oprava:* jedna brána — rozdíl mezi stopami pod 3 % (zdroj: kód); odchylka od délky hovoru zvlášť jako informace.

**13. L5 velikost a RSS jsou brány, které shodí zdravou nahrávku.** `audioBitsPerSecond` je pro `MediaRecorder` **žádost**, ne záruka, a Opus při tichu utáhne tok — 115 MB je horní odhad. RSS „+50 %" nad jediným procesem nic neznamená, Chromium má paměť v helperech. Obojí nechat jako pozorování, ne kritérium.

**14. 🔴 L6 varianta (a) stojí na nepodloženém předpokladu.** Dokumentace Electronu popisuje `prevent-app-suspension` jako blokaci *nečinnostního* uspání („keeps the system active but allows the screen to turn off") — o zavření víka nemluví. Že by aplikace clamshell sleep přebila, **jsem nedoložil ani v dokumentaci, ani v repu**. Scénář, který si dvě varianty volí předem, si může vybrat tu neexistující. *Oprava:* (a) přeformulovat na clamshell na napájení s externím displejem, nebo ji škrtnout a přidat třetí variantu „ověřeno, že to nejde, a proč". Navíc dnešní běh nemůže dopadnout ani jako (b) — bez `powerMonitor` se `finalizeRecordingSession` nezavolá vůbec.

**15. L7 narazí na test, který opačný stav zamyká.** `tests/tray-authority.test.js` tvrdí „neznámý stav → signed-out"; pátý stav ho rozbije. Do L7 patří věta, že se ten test **rozšiřuje, ne měkčí** (DoD §3 bod 4). Vedle toho: ten test čte `main.cjs` jako text a funkci si znovu vyrábí `Function()`em — je to test nad **kopií logiky**, jedna ze čtyř tříd lhavých bran, které tenhle projekt už zaplatil.

**16. L8 nepočítá s víc renderery.** Panel i okno Nastavení jsou samostatné `Electron Helper (Renderer)`. Kdo zabije ten druhý, dostane falešně zelený výsledek. Zapsat PID panelu před zabitím.

**17. L9 dnes nemá co měřit a scénář to říká jen v poznámce pod čarou.** `electron/queue.cjs` má 69 řádků (načíst/uložit JSON), `auth.cjs` jen `begin()`. Do B8/B9 je celý scénář ⛔ a nesmí se pouštět „na zkoušku", jinak vznikne zápis „fronta v pořádku", který neznamená nic. **Zdroj pro „30 dní" existuje a chybí u něj citace:** `docs/ux/cesta-uzivatele-2026-09-01.md`, momenty M26 a M27 (absolutní TTL 30 dnů, access 15 minut).

**18. L10 se dá z odhadu udělat měření hned.** Aplikace `workArea` už čte (`main.cjs:273-276`). Přidat krok „vypiš `screen.getPrimaryDisplay().workArea` a z něj spočítej přetečení" — pak ≈775 px nemusí být odhad.

**19. 🔴 Celá sekce nemá nic, co by lež zachytilo.** Pravidlo 7 je pravdivé, ale znamená, že jediná obrana proti napsání ✅ je poctivost pisatele — přesně to, co u měřidla A6 selhalo. *Oprava, která stojí půl dne:* rejstřík `dukazy/live/index.json` (ID, commit, `sha256` .app, datum, výsledek, cesty k artefaktům) + krátký skript v `npm run gates`, který spadne, když je v dokumentu ✅ u ID, ke kterému rejstřík nemá záznam s artefakty. Brána nekontroluje chování (to nejde), ale **existenci důkazu** — a to jde.

---

## C. Co chybí úplně

- **🔴 B10 / sdílené zařízení `zasedacka@makemore.cz`.** Dan ho výslovně dal do v1, spec §2 i `plan.md` mu dávají vlastní etapu — a je to typicky živý scénář (u jednoho Macu se vystřídají tři lidé; komu se přiřadí nahrávka; co s frontou při střídání). V sekci není ani řádek. **Největší díra.**
- **R19 / retence 7 dní (B11).** Nevratné mazání dat, dnes podle `docs/ux/inventar-povrchu-2026-09-01.md:47` jen hodnota v `localStorage`. Chybí scénář „nastav 24 h, ověř, že se smaže jen odeslané a jen po lhůtě".
- **DSK-F014 / M20 připomínky.** Notifikace jsou čistě živá věc (vlastní TCC souhlas, Do Not Disturb, Focus) a v L3 chybí i to oprávnění.
- **R5 — aktualizace se nenabídne během nahrávání.** Spec §10 odkládá obrazovky, ale samotné pravidlo je živě ověřitelné.
- **Prázdný stav „nemáš dnes alokaci" a přečerpaný projekt (R6/R7).** V L7 jsou schované jako podmínka pro vykonavatele, ne jako ověřovaný stav; spec §6 je vede jako dva chybějící stavy panelu.
- **Odebraný z firmy** (spec §2, `KONTRAKT.md:94` `403 access_revoked`) — přestat nabízet, **nemazat** lokální soubory. Scénář není.
- **Ikona v Docku jako volba (M18/DSK-F016).** `app.dock.hide()` je natvrdo (`main.cjs:~727`) a `LSUIElement=YES` v `Info.plist` — přepínač v Nastavení bez restartu fungovat nemůže. Ani scénář, ani poznámka.
- **Danovo rozhodnutí o distribuci (veřejný GitHub + aktualizace).** Sekce ho nezohledňuje nikde, přitom se přímo dotýká pravidla 5 — viz bod B5.

Sources: [Electron powerSaveBlocker](https://github.com/electron/electron/blob/main/docs/api/power-save-blocker.md) · [Electron systemPreferences](https://github.com/electron/electron/blob/main/docs/api/system-preferences.md) · [Electron desktopCapturer](https://github.com/electron/electron/blob/main/docs/api/desktop-capturer.md)