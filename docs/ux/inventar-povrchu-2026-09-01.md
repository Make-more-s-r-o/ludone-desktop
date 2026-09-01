# Úplný inventář uživatelského povrchu LuDone Desktop

## Shrnutí

LuDone Desktop dnes umí spustit dockless tray panel, provést čtyřkrokový onboarding, otevřít Nastavení a uložit dvě oddělené zvukové stopy na lokální disk. LuTrack žije jen v paměti rendereru; kalendář, účet a přihlášení jsou mock/fixtures. OAuth a fronta mají knihovny, ale hlavní proces je nepoužívá, takže se nic neodesílá. Aplikace má dvě pevná bezrámová okna, ale nemá vlastní aplikační menu, tray kontextové menu, globální zkratky, O aplikaci, diagnostiku ani viditelnou cestu k ukončení. Ikona zná čtyři logické stavy, při souběhu zatají LuTrack a její SVG cesta je v dokumentaci označena jako reálně prázdná. Oprávnění mikrofonu a Záznamu obrazovky se čtou ze systému, ale onboarding vyžaduje obě. Retenční volba se jen uloží do `localStorage`; žádný soubor nemaže. Offline fronta, vypršelé přihlášení, Finder, odhlášení a produkční podpis jsou popsané, nikoli implementované. Úplně chybí distribuce, systémové požadavky, updater, uživatelská verze, main-process crash UX a odinstalace.

## Inventář po oblastech A–F

| Položka | JE/POPSÁNO/CHYBÍ | Důkaz | Poznámka |
|---|---|---|---|
| **A1 — Spuštění, Dock, tray** | JE | `package.json:6-11`; `electron/main.cjs:724-732`; `electron/main.cjs:727`; `scripts/package-mac.mjs:83` | Start vytvoří tray a panel; `LSUIElement=YES` + `app.dock.hide()` odstraní Dock ikonu. |
| **A2 — První spuštění** | JE | `src/components/Onboarding.jsx:27-29,130-149,152-178,181-224,227-244`; `src/App.jsx:8-15` | Vítejte → Přihlášení → Oprávnění → Hotovo. Dokončení je v `localStorage`; auth i uživatel jsou mock. |
| **A3 — Ukončit / ⌘Q** | POPSÁNO | `design/canvas/Lista.dc.html:132-142` | Návrh pravého kliku má Ukončit; kód jen E2E `test:quit` (`electron/main.cjs:709-714`). Běžný close skrývá. |
| **A4 — Start po loginu** | CHYBÍ | `rg -n -i 'setLoginItemSettings\|openAtLogin\|spouští se po přihlášení' ROZHODNUTI.md PLAN.md DAN-TODO.md KOSTRA.md NAHRAVANI.md specs docs/server-modul docs/behy/2026-08-25-zadani design/canvas/*.dc.html design/navrh/*.dc.html electron src scripts/package-mac.mjs package.json index.html` → bez výstupu, `EXIT=1` | Není funkce ani rozhodnutí. |
| **A5 — Spánek/probuzení** | POPSÁNO | `specs/E6-prihlaseni-a-fronta.md:55-57` | Popsán suspend/resume uploadu. Main neimportuje `powerMonitor`; aktivní nahrávání/LuTrack nejsou definované. |
| **A6 — Pád rendereru** | JE | `electron/main.cjs:310-323,649-659` | Nahrávka se uzavře `incomplete`, chunky zůstanou. Obnova není v UI; tray může lhát, protože ho řídí renderer (`src/App.jsx:20-36`). |
| **A6 — Pád main procesu** | CHYBÍ | `rg -n -i 'pád hlavního procesu\|hlavní proces spadne\|main process.*(crash\|pád)' ROZHODNUTI.md PLAN.md DAN-TODO.md KOSTRA.md NAHRAVANI.md specs docs/server-modul docs/behy/2026-08-25-zadani design/canvas/*.dc.html design/navrh/*.dc.html electron src` → bez výstupu, `EXIT=1`; `rg -n 'uncaughtException\|unhandledRejection\|child-process-gone' electron src` → bez výstupu, `EXIT=1` | Bez restartu, crash UI a scan obnovy. |
| **B7 — Hlavní panel** | JE | `electron/main.cjs:27-28,282-308` | 366×792, pevný, bezrámový, bez fullscreen/min/max, se stínem, ne always-on-top. |
| **B7 — Stavy panelu** | JE | `src/App.jsx:56-103`; `TodayAgenda.jsx:26-53`; `RecordingCard.jsx:401-475`; `TrackingCard.jsx:31-75` | Onboarding/main; kalendář plný/prázdný; recording idle/checking/recording/stopping/success/error; LuTrack idle/running/stop. |
| **B7 — Nastavení okno** | JE | `electron/main.cjs:347-385` | 448×676, pevné, bezrámové, ne always-on-top. |
| **B8 — Aplikační menu** | CHYBÍ | `rg -n 'Menu\.setApplicationMenu\|setApplicationMenu' electron src scripts/package-mac.mjs package.json index.html` → bez výstupu, `EXIT=1` | Soubor/Úpravy/Zobrazení/Okno/Nápověda nejsou definované; Electron default nebyl ověřen. |
| **B9 — Tray context menu** | POPSÁNO | `design/canvas/Lista.dc.html:55-69,132-142` | Návrh má obě agendy, frontu, archiv, Nastavení, Ukončit. `rg -n 'tray\.setContextMenu\|setContextMenu' electron src` → bez výstupu, `EXIT=1`. |
| **B10 — Nastavení povrch** | JE | `src/App.jsx:94-100`; `src/components/Settings.jsx:36-114` | Dva policy toggly, retence, mock účet/cíl; autosave do `localStorage`. |
| **B10 — O aplikaci/diagnostika** | CHYBÍ | `rg -n 'O aplikaci\|Diagnostika' ROZHODNUTI.md PLAN.md DAN-TODO.md KOSTRA.md NAHRAVANI.md specs docs/server-modul docs/behy/2026-08-25-zadani design/canvas/*.dc.html design/navrh/*.dc.html electron src` → bez výstupu, `EXIT=1` | Není verze, logy ani diagnostický export. |
| **B11 — Skrytí panelu** | JE | `electron/main.cjs:232-245,328-343`; `src/App.jsx:67-73` | Klik vedle, close event i křížek skryjí; permission dialog/Nastavení blur dočasně blokují. |
| **B11 — Esc** | CHYBÍ | `rg -n -i 'Escape\|klávesou Esc' ROZHODNUTI.md PLAN.md DAN-TODO.md KOSTRA.md NAHRAVANI.md specs docs/server-modul docs/behy/2026-08-25-zadani design/canvas/*.dc.html design/navrh/*.dc.html electron src` → bez výstupu, `EXIT=1` | Bez handleru. |
| **C12 — Tray stavy** | JE | `electron/main.cjs:202-229,255-266` | signed-out/idle/recording/tracking. `specs/E3-vady-a-identita.md:11-13` dokládá prázdný SVG nativeImage; logika JE, pixely nejisté. |
| **C13 — Tray text** | JE | `electron/main.cjs:728-731` | `tray.setTitle("")`: titul je prázdný, stav jen v tooltipu. |
| **C14 — Souběh agend** | JE | `src/App.jsx:20-25`; `TrackingCard.jsx:15-29`; `RecordingCard.jsx:393-399` | Souběh funguje, ikona dá prioritu recording a LuTrack zatají; kombinace je jen návrh (`Lista.dc.html:125-130`). |
| **D15 — Globální zkratky** | POPSÁNO | `design/canvas/Lista.dc.html:132-142` | Návrh: ⌃⌥R, ⌃⌥T, ⌘,, ⌘Q. `rg -n 'globalShortcut' electron src` → bez výstupu, `EXIT=1`. |
| **D16 — Klávesnice/ARIA uvnitř** | JE | `src/styles.css:68-73`; `src/App.jsx:64-71`; `Toggle.jsx:1-14`; `TodayAgenda.jsx:40-47`; `TrackingCard.jsx:43-71`; `RecordingCard.jsx:426-470` | Nativní controls, focus ring, aria-label/live/status/alert. Focus trap, VoiceOver a fyzický tray neověřeny. |
| **D16 — Klávesový vstup do panelu** | POPSÁNO | `design/canvas/Lista.dc.html:132-142`; `KOSTRA.md:186-187` | Zkratky/menu jen v návrhu; bez myši není vstup ani Esc. |
| **D17 — Reduced motion** | JE | `src/styles.css:1337-1344` | Transition 0,01 ms, smooth scroll off. |
| **D17 — Color scheme** | POPSÁNO | `DAN-TODO.md:98-103`; `specs/ED-design.md:49` | Rozhodnuty oba režimy. Kód má dark natvrdo (`styles.css:1-3`, `index.html:10`); `rg -n 'prefers-color-scheme' electron src index.html` → bez výstupu, `EXIT=1`. |
| **E18 — Oznámení** | POPSÁNO | `design/canvas/Lista.dc.html:73-94` | Návrh schůzky s Nahrát/Teď ne. `rg -n 'Notification' electron src` → bez výstupu, `EXIT=1`. |
| **E19 — Lokální soubory** | JE | `electron/main.cjs:475-499,608-644`; `RecordingCard.jsx:240-243` | `userData/nahravky`, 2× WebM + manifest, adresář 0700, soubory 0600; UI vypíše jména/velikosti. |
| **E19 — Finder** | POPSÁNO | `specs/E6-prihlaseni-a-fronta.md:59-63` | Popsáno `shell.showItemInFolder`. `rg -n 'showItemInFolder\|shell\.openPath\|Finder' electron src` → bez výstupu, `EXIT=1`. |
| **E20 — Oprávnění** | JE | `electron/auth.cjs:420-498`; `electron/main.cjs:694-707`; `Onboarding.jsx:12-25,55-111`; `package-mac.mjs:69-83` | Mikrofon a Záznam obrazovky; UI zná granted/denied/restricted/unknown/not-determined. Obě jsou povinná; není restart/degraded mode. |
| **E21 — Aktualizace** | CHYBÍ | `rg -n -i 'autoUpdater\|Sparkle\|electron-updater\|aktualizace během nahrávání' ROZHODNUTI.md PLAN.md DAN-TODO.md KOSTRA.md NAHRAVANI.md specs docs/server-modul docs/behy/2026-08-25-zadani design/canvas/*.dc.html design/navrh/*.dc.html electron src scripts/package-mac.mjs package.json index.html` → bez výstupu, `EXIT=1` | Bez updateru, odložení a pravidla pro aktivní agendy. |
| **E22 — Lokální podpis** | JE | `scripts/package-mac.mjs:14-19,31-46,48-85` | Kopie Electron.app, id `cz.ludone.desktop`, TCC texty, LSUIElement, ad-hoc `codesign --deep --sign -`; bez installeru. |
| **E22 — Produkční podpis/notarizace** | POPSÁNO | `ROZHODNUTI.md:57-81`; `DAN-TODO.md:144-178`; `specs/E3-vady-a-identita.md:68-84` | Popsán certifikát, záloha .p12, helper identity a podpis zevnitř ven. Kód ani notarizace nejsou. |
| **F23 — Offline** | POPSÁNO | `design/canvas/Fronta.dc.html:98-135`; `docs/server-modul/kontrakt-desktopu.md:100-132` | Popsány waiting/sending/done/retry/failed/gave-up/reauth. Zapojení chybí: `rg -n 'enqueueRecording\|processNext\|loadQueue\|saveQueue' electron src --glob '!src/lib/queue.js' --glob '!electron/queue.cjs'` → bez výstupu, `EXIT=1`. |
| **F23 — Vypršelý login** | POPSÁNO | `docs/server-modul/autentizace.md:45-48,84-91`; `Fronta.dc.html:132-135` | invalid_grant má zastavit frontu. Aktuální auth je mock (`main.cjs:681-692`) a skutečný controller není importován. |
| **F23 — Plný disk dnes** | JE | `electron/main.cjs:560-578`; `RecordingCard.jsx:260-295,366-375` | Chyba zápisu zastaví nahrávání a zobrazí generický technický důvod; bez preflightu. |
| **F23 — Plný disk cílově** | POPSÁNO | `specs/E6-prihlaseni-a-fronta.md:65-69` | Popsán limit 2 GB volno / 5 GB data. `rg -n -i 'ENOSPC\|statfs\|disk free\|volné místo' electron src` → bez výstupu, `EXIT=1`. |
| **F24 — Odhlášení** | POPSÁNO | `docs/server-modul/autentizace.md:90-91`; `specs/E6-prihlaseni-a-fronta.md:59-69` | Má revokovat credentials a zachovat frontu. `rg -n -i 'auth:sign-out\|signOut\|logout\|Odhlásit' electron src` → bez výstupu, `EXIT=1`. |
| **F25 — Retence UI** | JE | `src/components/Settings.jsx:13-34,74-89` | Volby ihned/24 h/7/30 dní se jen uloží do localStorage; text UI odporuje skutečnému nahrávání. |
| **F25 — Skutečné mazání** | POPSÁNO | `specs/E6-prihlaseni-a-fronta.md:65-69`; `docs/server-modul/datovy-model.md:96-102` | Janitor je jen spec; WebM se dnes nemažou, právní O3 je otevřené. |

## Díry v cestě uživatele

1. **Před stažením:** není distribuční kanál, ověření artefaktu, minimální macOS/CPU/místo. `rg -n -i 'minimální.*macOS|minimum.*macOS|system requirements|systémové požadavky' ...` → bez výstupu, `EXIT=1`.
2. **Instalace:** není DMG/ZIP/installer, přesun do Aplikací ani upgrade; `KOSTRA.md:160-162` jen říká „ne DMG“. Gatekeeper má analýzu (`ROZHODNUTI.md:57-81`), ne instalační UX.
3. **První start může být neviditelný:** Dock není a tray obrázek je podle `specs/E3-vady-a-identita.md:11-13` prázdný; fallback chybí.
4. **OAuth bez sítě/zavřený browser:** dnes jen generic mock error; návrh timeout/cancel/state mismatch (`Prihlaseni.dc.html:94-139`) není zapojen.
5. **Denied permissions:** design dovoluje mic-only/LuTrack-only (`Opravneni.dc.html:115-136`), kód vyžaduje obě (`Onboarding.jsx:216-223`) a nenabízí pozdější restart.
6. **Po onboardingu UI lže:** pevný uživatel (`App.jsx:8-15`), datum/kalendář fixture (`TodayAgenda.jsx:3-7,21-22`) a falešné „Připojeno“ (`Settings.jsx:91-104`).
7. **Denní ovládání:** bez implementovaných zkratek, tray menu, Esc a běžného Ukončit je člověk závislý na myši a viditelné ikoně.
8. **Spánek/víko/síť:** aktuální lifecycle nahrávání a LuTracku není definovaný; powerMonitor je jen budoucí upload spec.
9. **Ztráta jedné stopy:** design pokračuje a třikrát varuje (`ZtrataStopy.dc.html:20-28,97-125`), kód zastaví obě (`RecordingCard.jsx:298-301,331-345`).
10. **Po nahrávce:** není upload, Finder, export, účinná retence, bezpečný výmaz ani retry.
11. **Main crash:** není crash handler, auto-restart ani uživatelský scan/obnova incomplete manifestů.
12. **Odebrání z firmy:** serverový kontrakt 403 zachová data (`kontrakt-desktopu.md:100-108`), desktop nemá UI ani pravidla pro lokální firemní audio.
13. **Update:** bez updateru, verze, release notes, odložení a ochrany aktivních agend. `rg -n 'getVersion|app\.getVersion|verze aplikace' electron src` → bez výstupu, `EXIT=1`.
14. **Sdílený Mac:** jiný LuDone účet je v návrhu, ne druhý macOS účet/předání. `rg -n -i 'více uživatel|shared Mac|sdílený Mac' ...` → bez výstupu, `EXIT=1`.
15. **Ztracené zařízení:** mode 0600 není šifrování v klidu; FileVault/remote wipe nejsou popsány. `rg -n -i 'šifrován|encrypt.*nahráv|FileVault' ...` → bez výstupu, `EXIT=1`.
16. **Odinstalace:** není postup ani osud Application Support, safeStorage, TCC, logů, manifestů a neodeslaných WebM. `rg -n -i 'odinstal|uninstall|smazání aplikace' ROZHODNUTI.md PLAN.md DAN-TODO.md KOSTRA.md NAHRAVANI.md specs docs/server-modul docs/behy/2026-08-25-zadani design/canvas/*.dc.html design/navrh/*.dc.html electron src scripts/package-mac.mjs package.json index.html` → bez výstupu, `EXIT=1`.

## Co jsem nemohl ověřit

- Externí závazný Claude Design projekt nebyl bez sítě dostupný; lokální export nemusí být poslední.
- Dle zadání jsem nespouštěl Electron, smoke testy ani akceptaci; neověřil jsem tray pixely, Dock, blur, Electron default menu, VoiceOver ani systémové dialogy.
- Bez sítě jsem neověřil živý OAuth, produkční identitu, 403, upload scope/frontu ani archiv.
- Neověřil jsem Gatekeeper, TCC po aktualizaci, stabilní podpis a notarizaci na čistém účtu.
- Neověřil jsem plný disk, spánek, audio zařízení, hodinový běh, pády ani restart; jde o statickou analýzu a starší důkazy.
- Výchozí status už obsahoval `?? design/navrh/`; je cizí a předexistující, nic jsem v něm nezměnil.
