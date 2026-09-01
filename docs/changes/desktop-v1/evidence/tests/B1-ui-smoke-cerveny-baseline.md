# B1 — doslovný červený výpis `ui-smoke` PŘED opravou

**Změřeno naostro** 1. 9. 2026 ve 22:18, orchestrátorem nočního běhu, na skutečném Macu
(macOS 26.4, Electron 37.3.1). **Ne v sandboxu** — `ui-smoke` potřebuje GUI a zabalenou
aplikaci, takže tenhle důkaz Codex vyrobit nemůže.

Je to doklad podle `plan.md` §3 bodu 1: *„Cílený test napřed a viděný červený ze správného
důvodu."*

## Jak se to měřilo

Přesně tak, jak to dělá `scripts/akceptace/E2-sabotaze.sh:51-66`:

```bash
npm run package:mac                       # → EXIT=0
env LUDONE_E2E=1 LUDONE_RESET_ONBOARDING=1 \
    LUDONE_E2E_HARD_STOP_MS=120000 LUDONE_DATA_DIR="$DATA_ROOT" \
    "release/LuDone Desktop.app/Contents/MacOS/Electron" \
    --remote-debugging-port=9333 &
node scripts/ui-smoke.mjs                 # → EXIT=1
```

## Doslovný výpis

```
Error: Klikací tlačítko s textem „Povolit“ nebylo nalezeno.
    at clickByText (file:///Users/dan/Dev/ClaudeCode/ludone-desktop/scripts/ui-smoke.mjs:151:26)
    at async file:///Users/dan/Dev/ClaudeCode/ludone-desktop/scripts/ui-smoke.mjs:301:5
UI_SMOKE_EXIT=1
```

## Co to dokazuje

1. **Premisa B1 platí do řádku.** Test opravdu padá na `ui-smoke.mjs:301`, opravdu kvůli
   tlačítku „Povolit", které v `src/components/Onboarding.jsx` po etapě E6 neexistuje.
2. **Červená je ze SPRÁVNÉHO důvodu** — chybějící selektor, ne rozbité prostředí. Balení
   proběhlo `EXIT=0`, aplikace nastartovala, CDP odpovědělo; selhal až klik.
3. **Proto sabotáže (b) a (c) v `E2-sabotaze.sh` nikdy neproběhly.** Skript odmítá měřit nad
   červeným baseline (`zelena_brana "ui-smoke před mutací"`), a to je **správné chování brány,
   ne vada**. Až bude B1 zelená, doběhnou samy.

## Co tenhle důkaz NEDOKAZUJE

- ⛔ Neříká nic o tom, jestli oprava funguje — ta v tu chvíli neexistovala.
- ⛔ Neměří chování zvukové brány. To je zablokované právě těmi neproběhlými sabotážemi.
- ⚠️ Aplikace běžela v režimu `LUDONE_E2E=1` s resetem onboardingu, tedy **ne** ve stavu,
  v jakém ji vidí člověk při běžném spuštění.
