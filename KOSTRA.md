# KOSTRA — ověřený nález

## Výsledek v jedné větě

Vznikla tmavá, dockless menu-bar kostra LuDone Desktop se čtyřmi stavy ikony, onboardingem,
dnešními schůzkami, samostatným nahráváním, samostatným LuTrackem a malým oknem nastavení.
Finální lokální `.app` jsem opravdu spustil a automatizovaně proklikal; zvuk, kalendář, OAuth a
serverové ukládání jsou záměrně předstírané.

## Co jsem skutečně spustil a jak

- Produkční renderer sestavil Vite a lokální bundle vytvořil skript `npm run package:mac`.
- Testoval jsem přímo `release/LuDone Desktop.app/Contents/MacOS/Electron`, ne jen statické HTML.
- Finální běh provedl 52 kontrol nad viditelným Electron oknem. CDP posílal do skutečného DOM
  běžné události `.click()`, měnil skutečné formulářové prvky a po změnách četl renderer i stav
  hlavního Electron procesu přes IPC. DevTools port byl zapnutý jen argumentem testovacího běhu.
- Stejný celý průchod nejdřív prošel i nad zdrojovým runtime. Samostatný druhý běh ověřil
  čtyřmi kontrolami kalendář bez událostí.
- Uložil jsem devět retina PNG celého průchodu a jeden PNG prázdného kalendáře do ignorovaného
  `.runtime/smoke/`; vizuálně jsem zkontroloval onboarding, idle panel, souběh obou funkcí,
  nastavení i empty state.
- Poskytovatel desktopového ovládání našel skutečné okno 366 × 792 px, ale navzdory tomu, že
  macOS hlásil oprávnění jako udělené, odmítal accessibility akce. Proto je vlastní proklik
  proveden přes CDP, ne tvrzen jen podle kódu.
- Systémový status item nešlo fyzicky stisknout kurzorem: Computer Use menu bar nezpřístupňuje
  a System Events odmítl asistenční přístup. V E2E režimu jsem proto emitoval přímo registrovanou
  Electron událost `Tray` `click`; první událost skutečně skryla okno a druhá je znovu ukázala.
  Handler a účinek jsou tedy ověřené, fyzický kurzorový vstup do macOS lišty nikoli.

## Co jde skutečně proklikat

### První spuštění

1. Uvítání → **Začít**.
2. Přihlášení → **Přihlásit v prohlížeči** → simulovaný návrat callbacku.
3. Samostatně **Povolit** mikrofon, systémový zvuk a kalendář; každý řádek přejde do stavu
   **Povoleno** a pokračování se odemkne až po všech třech.
4. Hotovo → **Otevřít můj panel**.

Neexistuje vlastní formulář s heslem. Rozhraní mezi rendererem a main procesem už má hranici pro
budoucí browser OAuth adapter a callback/token.

### Panel a kalendář

- Panel se při prvním spuštění skutečně otevře pod tray ikonou a jde skrýt/znovu zobrazit přes
  její registrovanou click událost.
- Tři dnešní schůzky ukazují čas, název a vlastní **Nahrát**.
- Tlačítko první schůzky spustilo nahrávání s kontextem „Design review · Mobilní aplikace“;
  ostatní řádky se za běhu správně zamkly.
- Druhá fixture skutečně zobrazila „Dnešek je volný.“ a přátelský dovětek, bez jediného
  `.event-row` nebo prázdné tabulky.

### Nahrávání

- **Nahrát** u schůzky i velké **Spustit nahrávání** bez schůzky jsou samostatně ověřené vstupy.
- Za běhu je skutečně vidět rostoucí čas, název/„Rychlá nahrávka“ a zdroj
  „Mikrofon + systémový zvuk“.
- **Zastavit nahrávání** vrátí modul do idle a ukáže přesné potvrzení bez přidání archivu.
- Stav tray v main procesu skutečně přešel `signed-out → idle → recording` a zpět.

### LuTrack

- Výběr projektu byl změněn na „Web · klientská zóna“ a volitelný popis na
  „Příprava demo flow“.
- Toggle **Start/Stop** skutečně spouští a zastavuje rostoucí čas; za běhu uzamkne projekt i
  popis, po stopu zobrazí potvrzení.
- Ověřil jsem samostatný `tracking` tray stav i souběh s nahráváním. Oba časy běžely současně,
  zastavení nahrávání LuTrack nepřerušilo a zastavení LuTracku nahrávání nepřerušilo.
- Při souběhu má tray zvolenou prioritu `recording`; zadání pátý kombinovaný stav neurčilo.

### Nastavení

- Ozubené kolečko skutečně otevřelo druhé Electron okno 448 × 676 px.
- Toggle automatického nahrávání schůzek přešel `false → true` a dotaz u ostatních hovorů
  `true → false`.
- Retention select se změnil na „7 dní po odeslání“.
- Je vidět účet, připojení a cíl `app.ludone.cz · LuDone tým`; **Hotovo** okno skutečně zavřelo.
- Hodnoty nastavení a dokončený onboarding se opravdu ukládají lokálně do `localStorage`.

### Tray a Dock

- Main proces skutečně prošel všemi čtyřmi požadovanými stavy: `signed-out`, `idle`,
  `recording`, `tracking`. Stav se neodvozoval jen z textu panelu; smoke jej četl z main procesu.
- Každý stav nastavuje jiný SVG-derived nativní obrázek a tooltip. Ikony neblikají a nejsou emoji.
- Bundle má ověřené `LSUIElement = true` a main proces volá `app.dock.hide()`; aplikace tedy nemá
  běžnou Dock ikonu.
- Jak je uvedeno výše, fyzický kurzorový click přímo na status item není kvůli oprávněním
  testovacího nástroje potvrzený. Přesná Electron `click` událost a hide/show výsledek potvrzené jsou.

## Co je předstírané

- **OAuth:** tlačítko volá main-process adapter, čeká na něj a přijme objekt uživatele, callback
  a mock token. V testu se prohlížeč neotevřel a token se bezpečně nepersistuje. Main proces umí
  volitelně otevřít `app.ludone.cz`, ale skutečné autorizační URL, PKCE, deep link, refresh a
  Keychain nejsou implementované.
- **Oprávnění:** tři IPC požadavky vracejí po krátké prodlevě `granted`; macOS permission API se
  nevolá.
- **Zvuk:** nevzniká stream ani soubor, žádný upload ani mazání. Text zdroje, čas a ukončení jsou UI.
- **Kalendář:** tři schůzky i prázdný den jsou fixture; není provider, načítání, chyba, refresh ani
  timezone logika.
- **LuTrack:** timer běží opravdu v rendereru, ale seznam projektů je fixture a start/stop se
  neukládá na server.
- **Nastavení retention:** hodnota se lokálně uloží, ale žádný audio soubor podle ní neexistuje.
- **Účet a cíl:** Daniel Novák, e-mail, stav připojení a týmový prostor jsou ukázková data.
- **Nahrávací doporučení:** toggly mění hodnotu, ale bez kalendářního/audio adapteru nic automaticky
  nespouštějí.

## Rozdělení kódu a proč

### Společná část

- `electron/main.cjs` vlastní lifecycle, dockless panel, tray, samostatné settings okno, bezpečný
  `ludone://` protokol a IPC hranice pro auth/oprávnění.
- `electron/preload.cjs` je jediný malý most do sandboxovaného rendereru; `nodeIntegration` je
  vypnuté a `contextIsolation` zapnuté.
- `src/App.jsx` pouze skládá panel, uživatele a globální tray stav. Neimplementuje vnitřní logiku
  nahrávání ani LuTracku.
- `components/` drží onboarding, nastavení, SVG ikony a společný toggle; `hooks/` jen sdílené
  měření uběhlého času.

### Samostatné funkce

- `features/recording/RecordingCard.jsx` vlastní nahrávací session, kontext schůzky, start/stop,
  elapsed a potvrzení.
- `features/tracking/TrackingCard.jsx` vlastní projekt, popis, timer, start/stop a uzamčení vstupů.
- `features/calendar/TodayAgenda.jsx` pouze zobrazuje události a vysílá požadavek na nahrávání.

Recording, tracking a calendar se navzájem **neimportují**. Komunikují jen callbacky přes `App`;
společný rodič ví pouze, zda jsou moduly aktivní, aby složil tray stav. Recording nebo LuTrack lze
odebrat z `App` bez editace druhého modulu. Tohle záměrně odráží dvě rovnocenné funkce jednoho
spouštěče, ne hlavní produkt s přilepeným časovačem.

## Vzhled a design systém

- Dark-only prototyp používá přesné tmavé LuDone základy z `globals.css`: background
  `oklch(0.16 0 0)`, card `oklch(0.2 0 0)`, elevated `0.22/0.26`, border white/10 % a canonical
  zelenou `oklch(0.5 0.17 145)`.
- Plochy jsou plné; není použit blur ani vibrancy a `prefers-reduced-transparency` má explicitní
  plné fallbacky.
- Vnější radius je 26 px a hlavní vnitřní karty 18 px při osmipixelovém odsazení.
- Všechny ikony jsou SVG/vektorové tvary, nikdy emoji.
- **Brockmann není do prototypu přibalený**, jak zadání žádalo. Heading stack používá systémový
  `ui-rounded`/San Francisco fallback. Public Sans se také nestahuje po síti; pokud není lokálně,
  text přejde na systémový sans. Produkce má použít licencované self-hosted font soubory LuDone.

## Měření

Měřeno na macOS 26.4 arm64, Node 22.22.0, npm 10.9.4. Velikosti jsou z `du -sk`, tedy fyzická
velikost na disku; MiB = KiB / 1024.

| Co | Výsledek |
| --- | ---: |
| První `npm run build`, celý příkaz | **1,59 s** |
| První Vite build podle Vite | **341 ms** |
| `node_modules` | **305 628 KiB = 298,5 MiB** (`du -sh`: 298M) |
| Renderer `dist/` | **228 KiB** |
| Lokální `release/LuDone Desktop.app` | **282 016 KiB = 275,4 MiB** (`du -sh`: 275M) |
| Aplikační, build a smoke kód | **2 958 fyzických řádků** |

Do počtu řádků patří `electron/`, `scripts/`, `src/`, `index.html`, `package.json` a
`vite.config.js`; nepatří lockfile, README, tento nález ani generované artefakty. `.app` je lokální
nepodepsaný prototyp, ne DMG a ne notarizovaný distribuční build.

## Co v zadání chybělo nebo si odporovalo

1. Povinný POSTUP říká KOSTRA až po testu a commit až potom; MANTINELY současně říkají
   „commituj průběžně“. Uživatel navíc výslovně zopakoval commit až po nálezu. Řídím se tímto
   přísnějším pořadím a dělám jeden finální commit.
2. Čtyři tray stavy nemají kombinaci nahrávání + LuTrack, přesto mají být funkce nezávislé.
   Povolen je souběh a zvolena priorita `recording`.
3. „Nahrávání je předstírané“ se významově tluče s nastavením fyzické doby uchování zvuku.
   Nastavení je proto jen policy UI a výslovně to říká.
4. Chybí calendar provider, výběr kalendářů, timezone, refresh, denied/loading/error stav,
   překryvy schůzek a pravidla automatického startu.
5. Chybí definice audio zdrojů a chování při startu jiné schůzky během aktivního nahrávání.
6. LuTrack nemá zdroj projektů, povinnost projektu, API/persistence ani pravidlo pro editaci
   rozběhnuté session. V kostře jsou vstupy za běhu zamčené.
7. OAuth nemá autorizační URL, callback schéma, PKCE, bezpečné úložiště, expiry/refresh ani logout.
8. Není řečeno, zda lze pokračovat po zamítnutí permission a jak uživatele poslat do System Settings.
9. Nastavení nemá výchozí hodnoty, save/cancel politiku ani přesné retention možnosti; zvolil jsem
   autosave, `autoCalendar=false`, `askOther=true` a čtyři srozumitelné retention volby.
10. „Velikost hotové aplikace“ neurčuje `.app`, unpacked nebo installer. Měřím explicitně lokální
    unpacked `.app` a zvlášť renderer.
11. Dark mode je povinný a výchozí, ale není řečeno, zda musí existovat light mode. Kostra je
    záměrně dark-only.
12. Není popsána výška, menší displeje, multi-monitor umístění, klávesové ovládání ani fyzický
    macOS status-item UI test.

## Co bych navrhl jinak po vidění v pohybu

- **Rozhodnout kombinovaný tray stav.** Priorita nahrávání funguje a je bezpečná, ale split-ring
  ikona by mohla přiznat oba běhy bez páté barvy.
- **Nechat recording s červeným stavovým významem a zelenou pro start/LuTrack**, jak je teď;
  owner by měl potvrdit, že to má přednost před doslova jediným zeleným akcentem webového DS.
- **Výšku panelu počítat podle displeje a obsahu.** Fixních 792 px dává klidnou kompozici a má
  scroll fallback, ale na menším displeji by měl Electron dynamicky omezit výšku podle work area.
- **Prázdný den ponechat výrazný.** V pohybu je lepší než zmenšit kalendářní jádro na jednu větu;
  uživatel stále chápe, kde by schůzky byly.
- **OAuth, permissions, calendar, recorder a LuTrack definovat jako explicitní adaptéry se stejným
  IPC kontraktem**, který už kostra naznačuje. UI pak nemusí znát konkrétní providery.
- **Pro distribuci použít standardní Electron packaging, podpis, hardened runtime a notarizaci.**
  Ruční balicí skript záměrně vytváří jen měřitelnou lokální `.app` bez další těžké dependency.
- **Doplnit CI na skutečném Macu s povoleným Accessibility** pro fyzický klik na status item,
  screenshot menu lišty, positioning na více monitorech a ověření, že v Docku opravdu nic není.

## Co stále chybí

Skutečný OAuth/Keychain, nativní permissions, audio capture, calendar adapter, upload/retry,
LuTrack API, bezpečné ukládání tokenů, signing/notarizace, updater a fyzický status-item UI test.
Archiv, přepisy, hledání, grafy a výkazy nechybí — podle zadání patří do `app.ludone.cz`, ne sem.
