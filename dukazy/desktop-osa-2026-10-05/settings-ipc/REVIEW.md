# Regrese lokální složky a přijatých zkratek

🧪 Sedm přidaných případů vykonává skutečný main a preload přes stávající harness. Žádný původní test ani assertion nebyl odstraněn či oslaben. Produkční soubory se v tomto běhu nemění.

- Vlastní panel i detail zobrazí pouze pevnou složku `userData/nahravky`.
- Oba kanály odmítnou cizí okno se stejným rámem, jiný rám se stejnou URL, chybějící/null rám a každý předaný payload včetně explicitního undefined; shell se nevolá.
- Skutečný symlink a skutečný soubor na místě složky jsou odmítnuty bez shellu; původní obsah cíle zůstává zachovaný.
- Zkratky odrážejí pouze úspěšné registrace, vracená pole mají úzký tvar a změna vrácených dat neovlivní další čtení.
- Skutečný preload zavolá oba skutečné handlery s jediným argumentem: názvem kanálu.

Akceptace: `targeted.txt` — 324 PASS / 0 FAIL, exit 0; `typecheck.txt` — exit 0; `lint.txt` — exit 0. Doslovné výpisy prvního běhu jsou v `*-first.txt`; následná oprava upravila pouze nové testy kvůli kanonické macOS cestě `/private/var` a typování pozorovaných mock volání.

⛔ Toto není fyzická přejímka Finderu, zvuku ani instalace aktualizace. Bezpečnostní review původního integračního diffu nezjistilo nový P1/P2; chybějící inventura nových kanálů byla v základním commitu již doplněna. Fixtura updateru musí dál zachovat produkční controller a použít pouze inertní adaptér.
