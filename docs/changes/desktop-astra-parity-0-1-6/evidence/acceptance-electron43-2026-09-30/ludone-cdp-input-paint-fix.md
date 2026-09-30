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

# Synchronizace nativního CDP vstupu s vykreslením

Změněn pouze `scripts/astra-design-e2e.mjs` v worktree auth-empty-store. `clickByText` i `clickSelector` po scrollIntoView čekají dva requestAnimationFrame, poté měří rect a kontrolují elementFromPoint. Vstup stále používá skutečné CDP Input.dispatchMouseEvent mouseMoved/mousePressed/mouseReleased; žádné HTMLElement.click(), opakované kliknutí ani retry nebylo přidáno.

V restart/recovery scénáři se po fyzickém kliku nyní stávajícím waitFor čeká na stejnou požadovanou DOM podmínku details.open===true před asynchronním čtením snapshotu. Následující assertion !recovery.open i všechny ostatní assertions, PASS/FAIL a limity zůstávají beze změny.

Root trace `.runtime/acceptance-electron43-2026-09-30/detail-probe-trace.txt` doložil, že nativní click dopadl na předchozí SECTION.settings-group, přestože předchozí DOM hit-check vybral řádek Můj den. Úprava synchronizuje DOM/scroll s vykreslením; neopravuje renderer na základě neprokázané toggle hypotézy a žádný detail se programově neotvírá.

🧪 Statická kontrola `node --check scripts/astra-design-e2e.mjs` exit_code=0; `node_modules/.bin/eslint scripts/astra-design-e2e.mjs` exit_code=0 (oba bez výpisu).

⛔ Skutečný Electron E2E po této úpravě pracovník nespouštěl. Ověření provede root původní branou; tento report netvrdí vyřešený runtime průchod. Žádné GUI procesy, git zápisy, instalace ani jiné zdrojové změny v tomto běhu.
