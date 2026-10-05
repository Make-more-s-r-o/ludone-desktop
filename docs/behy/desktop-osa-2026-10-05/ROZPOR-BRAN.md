> Historický checkpoint. Závěrečné vyřešení po výslovném schválení F je v [aktuálním mapování](ROZPORY-BRAN.md).

# Původní brány a F Osa

⚠️ F akceptace není výjimka ani nová baseline. Všechny původní testy, ESLint konfigurace, skipy a CI jsou beze změny. Redesign schválený Danem nepromíjí jejich selhání. PR zůstává draft pro review; merge a vydání vyžadují vyřešení tohoto přechodu.

## Výchozí stav a současný výsledek

- Čistá původní brána nad vstupním commitem `3fdca5c6` po instalaci závislostí: 155 lint chyb v přenesených návrhových skriptech (`document`, browser globals a původní generator). Stejných 155 chyb má čistá brána nad `61840348`. Není přidána ESLint výjimka ani upraven návrhový zdroj.
- Výchozí unit běh před UI integrací (včetně 7 nových čistých adapter testů): 1660 PASS, 1 FAIL, 3 původní skipy. FAIL je bajtová reprodukovatelnost původního PNG generátoru na tomto Macu. Původní PNG zůstávají beze změny; původní nativní tray-image test stále projde.
- Poslední kompletní unit běh: 1468 PASS, 201 FAIL, 3 původní skipy; 71 zelených a 10 červených souborů. Žádný skip ani baseline nebyl přidán.
- Doplňková `node scripts/akceptace/F-Osa.mjs`: samostatně PASS scoped lint, typecheck, 15 F unit testů, build, původní nativeImage, F nativeImage a izolovaný Electron. Samostatně FAIL původní lint a celá unit sada. Celkový exit 1 je správný a nesmí být prezentován jako zelená akceptace.

## Co je nutné při přechodu zachovat

| Červená oblast | Konkrétní změněný kontrakt | Rovnocenné podmínky F / další review |
|---|---|---|
| tray-authority (43) | Extrakční harness sestavuje původní funkce bez nového F modulu/finalizace; očekává původní stavy | Main priorita recording/loss/microphone-only/saving/decision před neplatnou session; nové čisté priority + skutečný main čas při skrytém panelu, výpadek a crash v Electronu. Při migraci harnessu zachovat všechny ownership assertiony. |
| queue-wiring (91) | Harness po otevření nastavení vyžaduje druhé BrowserWindow; F nastavuje stejný panel. Část kontrol vyžaduje výhradně roli settings. | Přenést stejná auth generation, CAS, claim, retry, idempotence, delete a sender/frame assertions na panel nebo skutečný UUID detail; nerozšiřovat na cizí okna/rámce. Nezávislé review kontroluje současné guards. |
| ipc-sender-guard (3), diagnostics (2) | Přesný zdrojový assertion settings-only proti F panel/settings | Rozšířit legitimní roli bez oslabení kontroly identity webContents, hlavního rámu a URL. Dosavadní pozitivní/negativní guards v zelených testech zůstaly. |
| idle-panel (37), session-reentry (11), renderer-feedback (4) | Starý Astra DOM, menu a navigace, hlavička identity | Testovat stejné auth/feedback přechody přes F onboarding/rail/účet; žádná identita z localStorage, žádný úspěch po odmítnutém IPC. Skutečný serverový účet/expirace ještě fyzicky nepřijaté. |
| settings (3), recording-card (6) | Původní tab a přesná textová/source skladba | Zachovat skutečné nastavení, audio test a chyby; nastavení audio nyní 10/10 PASS. Pět sekcí a nahrávání při navigaci mají nativní F test. |
| tray-ikony (1) | Výchozí byte-for-byte generátor na tomto Macu | Zaznamenat důvod reprodukovatelnosti bez přepsání baseline. Původní i nové nativní masky PASS; fyzická systémová lišta čeká. |

Podrobný doslovný výpis každé podmínky a exit kód: `dukazy/desktop-osa-2026-10-05/akceptace/`. Průběžný výpis s 2603 lint chybami navíc procházel vlastní pomocné klony; po jejich bezpečném odstranění je finální počet opět 155. Není to změna měřidla.

🟡 Člověk rozhodne další vlastnictví migrace těchto testovacích kontraktů. V tomto běhu se žádné původní měřidlo neupravuje ani neobchází. Podpis/vydání čeká.
