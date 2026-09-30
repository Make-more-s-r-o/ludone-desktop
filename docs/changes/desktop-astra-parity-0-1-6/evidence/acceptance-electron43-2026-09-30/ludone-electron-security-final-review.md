---
kind: review
ref: desktop-astra-parity-0-1-6-electron43
verdict: "🧪 zelené testy"
measuredAt: 2026-09-30T00:05:00Z
scope: [nezávislé review nebo report příslušného diffu]
measuredFrom:
  - posouzený produkční diff nebo skutečné Electron snímky podle textu reportu
  - uložené doslovné testové výpisy a E2E diagnostika podle textu reportu
---

# Nezávislé read-only review pinu Electron 43.7.6

**30. 9. 2026 · větev `fix/desktop-electron-security`**

## Verdikt

V aktuálním diffu `package.json` + `package-lock.json` nevidím P1/P2 regresi. Pin `electron` je v manifestu, lock root i uzlu balíčku přesně `43.7.6`; produkt zůstává `0.1.6`. Čtyři dříve otevřené high Electron advisories měly dotčené rozsahy `<41.10.4` / `<41.10.6`; nový pin je mimo všechny čtyři rozsahy. `git diff --check` prošel. Úplný `npm audit --json` uložený v `.runtime/acceptance-electron43-2026-09-30/audit.txt` už neobsahuje `electron` ani starý `extract-zip`; končí `EXIT_CODE=1` kvůli čtyřem souhrnným vývojovým balíčkům (1 high `undici`, 3 moderate Vitest větev). Samotný `npm audit --omit=dev` bych za důkaz bezpečnosti zabalené Electron binárky nepovažoval.

Nový balík Electron používá `@electron/get@5.1.0` a `@electron-internal/extract-zip@1.0.5`; starý `extract-zip@2.0.1` z lockfile zmizel. `electron`, `@electron/get` a nový extractor požadují Node `>=22.12.0`. Lokální Node je `v22.22.0`; `.github/workflows/ci.yml` a `release-macos.yml` používají `actions/setup-node@v4` s `node-version: 22`, který v aktuálním CI vybírá podporovaný Node 22.x. Repo nefixuje dolní patch verzi, takže při reprodukci mimo CI musí operátor použít nejméně 22.12.0.

Elektronická runtime binárka se balí do macOS aplikace i při `devDependency`; `build.files` dál zahrnuje jen `package.json`, `dist/**/*`, `electron/**/*`, `src/lib/**/*` a `src/pisma/**/*` plus uvedené extraResources. Diff neobsahuje změny `electron/main.cjs` ani `electron/preload.cjs`: všechna tři produkční okna zůstávají `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; `ludone:` má `corsEnabled: true`, nová okna a `<webview>` jsou odmítána a IPC sender guard, media permission a `setDisplayMediaRequestHandler` zůstávají ve zdroji stejné. To je kontrola konfigurace, nikoli důkaz fungujícího zvukového zachytávání v Electron 43.

**Před publikací stále potřebné:** dokončit lokální spuštění nové Electron binárky, `npm run gates`, build/balicí kontrolu a lidské `ui-smoke`/`audio-smoke` na skutečném Macu. Změna major verze může ovlivnit macOS capture a podpisový workflow; tato read-only kontrola jejich funkčnost neověřila. Aktualizace závislosti odstranila konkrétní čtyři Electron high z uzamčeného rozsahu, ale nedokládá celkovou absenci zranitelností.

Původní dotazy `gh api` a `npm audit --json` neměly vlastní archivované JSON soubory; zůstaly jen ve výstupu nástrojů. Původní souhrn je v `/private/tmp/ludone-dependency-release-review.md`. Nový archivovaný audit je `.runtime/acceptance-electron43-2026-09-30/audit.txt`.
