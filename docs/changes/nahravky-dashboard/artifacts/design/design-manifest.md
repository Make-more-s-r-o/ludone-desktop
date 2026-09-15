# Design manifest — doplnění existujícího UI nahrávek

**Stav:** zpětně popsán, bez hookového approval · **datum:** 14. 9. 2026 · **hlavní artefakt:** `outcome-contract.md`

**Věrnost:** L0 — zadání výslovně odložilo redesign a nepřidává novou kompozici, money obrazovku ani prvek design systému.

## Premisa a zdroje

- **Premisa:** Mění se pouze obsahové stavy a akce v existujícím panelu, Nastavení a update statusu.
- **Výsledek ověření:** `Settings.jsx` už má záložky Záznamy/Nahrávky a používá existující skupiny; panel už má RecordingCard, QueueCard a otevření Nastavení (`src/components/Settings.jsx:23-24`, `src/components/Settings.jsx:827-871`, `src/App.jsx:339-406`).
- **Produktové zdroje:** `intent.md`, `outcome-contract.md`, `spec.md`, rozhodnutí D1, D2, D10–D13.
- **Designové zdroje:** existující `src/styles.css` a komponenty; `design/` je mimo vlastnictví.

## Plochy a použité prvky

- **Panel po finish:** název a dvě explicitní volby uložení; L0 nad stávajícími `RecordingCard`, button a stavovou hláškou; nové prvky žádné; `approvalRequired: none`; dnešek `neměřeno`.
- **Nastavení → Nahrávky:** lokální/queue/server stavy a per-item akce; L0 nad stávajícími settings tab/group/row, button a alert/status; nové prvky žádné; `approvalRequired: none`; dnešek `neměřeno`.
- **Standalone reauthentication:** sekundární otevření Nastavení; L0 nad stávajícími `Onboarding` a button/link; nové prvky žádné; `approvalRequired: none`; dnešek `neměřeno`.
- **Panel aktualizace:** dostupná verze, průběh a odložený restart; L0 nad stávajícími status/progress prvky; nové prvky žádné; `approvalRequired: none`; dnešek `neměřeno`.

L0 návrh zachovává současné rozložení. Nevznikají varianty A/B/C, protože uživatel schválil konkrétní chování a odložil redesign; barevná či kompoziční alternativa by byla novým rozsahem.

## Matice pokrytí stavů

| Stav | Viditelný důkaz v L0 návrhu |
|---|---|
| `default` | Karta nahrávky s lokálním a queue stavem. |
| `pending/loading` | Text/disabled akce pro refresh, send, verify, save a trash. |
| `empty/no-op` | Samostatný prázdný přehled; held a cooldown neodesílají. |
| `success` | Saved local, sent, per-track match a nová verze odděleně. |
| `partial success` | Samostatné výsledky stop a `partial_failure` koše. |
| `recoverable error` | Bezpečný retry pro síť/5xx a uložená lokální položka. |
| `fatal/unavailable` | Poškozená queue/manifest jako chyba, ne empty. |
| `timeout/offline` | Lokální stav zůstane; žádný dashboard polling. |
| `invalid input` | Validace názvu/payloadu bez raw hodnot. |
| `conflict/concurrency` | Stale revize vyžádá refresh. |
| `forbidden/redacted` | Cizí položka a skryté cesty/token/fingerprint. |
| `disabled/degraded` | Nastavení dostupné bez loginu; send/verify vypnuté. |
| `retry/rollback` | Per-item retry a starý feed při release chybě. |
| `archived/superseded` | Žádný desktopový archiv; odstraněná/sent položka se neduplikuje. |

## Rozsah schválení a procesní mezera

Všechny obrazovky mají `approvalRequired: none`, protože nejde o novou kompozici, nový DS prvek ani money UI. Dan autorizoval funkční doplnění a rozhodnutím D10 výslovně odložil redesign. Tier-L harness přesto očekává `artifacts/design/approved.json`; původní běh nebyl založen hookem, takže soubor chybí. Agent jej nesmí zpětně vyrobit a tento manifest jej nenahrazuje. Zbývající C2 nález je pravdivé omezení procesu, ne nové produktové rozhodnutí ani popření již udělené autorizace.

## Implementační invarianty

- Použít existující komponenty, tokeny, focus a disabled/alert/status chování; žádný nový `:root` nebo designový systém.
- Lokální, queue a serverový stav pojmenovat zvlášť. Destruktivní akce má potvrzení s default cancel; citlivé hodnoty se nezobrazují.
- Root po T-05 porovná L0 popis s finálním UI a Dan provede skutečný Mac checklist v `OVERENI-NA-MACU.md`.

## Kontrolní checklist

- [x] Každá dotčená plocha má právě jeden řádek a věrnost L0.
- [x] Každá plocha uvádí uzavřenou hodnotu `approvalRequired`.
- [x] Všechny relevantní stavy outcome contractu mají textový důkaz.
- [x] Nevzniká variantní kompozice ani nový DS prvek.
- [x] Chybějící hookový `approved.json` je přiznaný a nebyl ručně vytvořen.
