# Kontext projektu — LuDone Desktop 0.1.5

Tento dokument je omezen na ověřené zdroje potřebné pro změnu. Řádky zkontroluj příkazem `nl -ba <soubor>` před sloučením, protože čísla se při úpravách mohou posunout.

| zjištění | zdroj |
|---|---|
| Pravidla repozitáře zakazují měnit backend, cizí `design/` a akceptační měřidla bez rozhodnutí; zvukové cesty se bez skutečného Macu označují nejvýš 🧪. | `AGENTS.md`, oddíly „Důkaz a stav ověření“, „Brány a testy“ a „Mapa repozitáře“ |
| Hlavní panel skutečně spouští nahrávání a nabízí cíl „Nahrávky“ přes okno Nastavení. | `src/App.jsx`, hlavní panel a odkazy v patičce |
| Přehled nahrávek je implementovaný v Nastavení a obsahuje lokální i serverové záznamy a jejich akce. | `src/components/Settings.jsx`, záložka `recordingQueue`; `src/features/recordings/RecordingsDashboard.jsx` |
| Nastavení dostává citlivé požadavky přes úzké IPC rozhraní a kontroluje, že odesílatel odpovídá známému oknu. | `electron/preload.cjs`, `openSettings` a `onSettingsTabRequested`; `electron/main.cjs`, `trustedSenderKind`, `isAllowedMediaPermission` a `isTrustedSettingsAudioFrame` |
| Okno Nastavení pro systémový zvuk očekává dokument `#settings`; jiný hash by mohl odebrat oprávnění zachycení zvuku. | `electron/main.cjs`, podmínky v `isAllowedMediaPermission` a `isTrustedSettingsAudioFrame`; testy `tests/ipc-sender-guard.test.js` |
| LuTrack UI již obsahovalo demonstrativní časovač; `disabled` v `TrackingCard` ho bezpečně skryje/zakáže bez ukládání času. | `src/features/tracking/TrackingCard.jsx`; `tests/tracking-card.test.js` |
| Oficiální značka je dodaná jako SVG v uloženém návrhu a zkopírovaná do desktopových assetů. | `docs/changes/desktop-redesign-2026-09-23/round2/shared-assets/brand/LuDone.svg`; `src/assets/LuDone.svg` |
| Přijatá varianta je Astra „Nit dne“. Oba klikací návrhy a starší důkazy zůstávají ve stejném dokumentačním stromu. | `docs/changes/desktop-redesign-2026-09-23/round2/VYBER.md`, `round2/variants/astra/` a `round2/variants/opus/` |
| Release pipeline a aktualizace jsou zavedené v předchozím vydání; nový podpis ani live update nelze vyvozovat z unit testů. | `docs/changes/nahravky-dashboard/T6-VYDANI.md`; `.github/workflows/release-macos.yml`; `package.json` |

## Povolený prostor změny

- Změna smí upravit pouze desktopové zdroje, desktopové testy a příslušnou dokumentaci v `docs/changes/` a hlavní desktopové rozcestníky.
- `docs/changes/desktop-redesign-2026-09-23/round2/` se zachová beze změny jako podklad pro možné pozdější přehodnocení návrhu.
- Projektové brány se spouštějí nezměněné: `npm run gates`, příslušné akceptační skripty a release workflow.
- Zvuk, přihlášení, upload ani produkční server nebyly touto změnou ověřeny naostro.
