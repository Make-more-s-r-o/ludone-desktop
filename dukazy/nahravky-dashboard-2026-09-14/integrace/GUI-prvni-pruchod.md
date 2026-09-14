---
kind: observation
ref: isolated-gui-first-pass
verdict: conditional
measuredAt: 2026-09-14T19:48:30Z
scope: [onboarding, desktop-window]
measuredFrom: [native-accessibility-tree, native-window-screenshot, isolated-process-log]
---

# První kontrola okna v izolovaném profilu

Spuštěn vývojový Electron s LUDONE_DATA_DIR v .runtime/gui-review a LUDONE_E2E=1. Produkční uživatelský adresář se nepoužil. Přes nativní UI byl vidět úvod verze 0.1.2 i finální obrazovka průvodce; tlačítko Otevřít můj panel nereagovalo. Následné čtení zdroje doložilo dvě oddělené věci: E2E fake auth vrací úspěch bez trvalé session, takže autoritativní kontrola správně vrací none; React zároveň převzal step=5 do nového reauthenticate režimu bez onComplete. Druhá chyba byla opravena oddělenými klíči komponent a nezávisle ověřena 12 testy v A1-onboarding-testy.log. Fake přihlášení ani produkční kontroly relace se neobcházely.

🟡 Pozorované úvodní UI není důkaz reálného přihlášení, nahrávání ani audia. CUA ohlásilo také změnu okna uživatelem, proto zde neuvádíme celý průchod jako automaticky reprodukovaný. Žádný repository ui-smoke/audio-smoke příkaz nebyl spuštěn. Testovací aplikace byla ukončena přes běžnou nabídku Quit. Nové funkce dashboardu vyžadují další UI přejímku po integraci T2–T5.
