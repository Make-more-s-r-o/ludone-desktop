---
kind: verification
ref: 2bf1da4
verdict: "🧪 zelené testy"
measuredAt: 2026-09-30T19:25:00Z
scope: [desktop-product-polish, desktop-upload-preferences, candidate-0-1-7]
measuredFrom: [frozen-candidate-gates-and-electron-e2e, independent-security-and-visual-diff-review]
---

# Finální kandidát LuDone Desktop 0.1.7

🧪 Zdroj `2bf1da4`: schválený panel s nahráváním první a kompaktním neaktivním LuTrackem, členění dne, opravené nastavení a diagnostika. Výchozí firma se obnovuje; každá nahrávka má před odesláním vlastní firmu a přístup. Nové nahrávky začínají jako **Sdílená ve firmě**; historická chybějící volba zůstává **Soukromá**. Samotné uložení voleb nic neodesílá. Existující serverová vazba/progress zamyká změny, oprava403 bez progress vyžaduje novou explicitní volbu.

| Ověření | Výsledek a doslovný výpis |
|---|---|
| Plné gates | 78 souborů, 1 654 PASS, 3 původní skipy; lint/typecheck/preskocene a exit0. [Výpis](commands/final-frozen-candidate-gates.log) |
| Regrese E2E skriptů | 18 PASS, bez skipů, exit0. [Výpis](commands/final-script-regressions-visible-actions.log) |
| Skutečný Electron main/preload/renderer | 35/35 podmínek, 18 snímků a 10 dvojic s Astrou, exit0. [Výpis](commands/final-design-e2e-visible-actions.log), [report](design-final/report.json) |
| Stavová E2E | 18/18 PASS, blokovaná externí síť, 0 pokusů, exit0. [Výpis](commands/final-frozen-state-e2e.log), [report](states-final/report.json) |
| Produktový proklik | 41/41 PASS, 82 snímků v šířkách400/640, žádný detekovaný overflow/clipping, 0 pokusů o externí síť, exit0. [Výpis](commands/final-frozen-product-audit.log), [report](audit-final/report.json) |
| Nezávislé review | Core bezpečnost, UI a finální snímky bez zbývajícíP1/P2. [Nálezy a uzavření](independent-review.md) |

[Galerie skutečných finálních snímků](index.html). Rendererové fixture ověřují klikání a stavy, mají simulovaný preload/server. Main E2E používá skutečný main/preload a syntetické dva zdroje, obnovu po restartu a neporušené původní bajty nedokončené nahrávky; upload má vypnutý. Nejde o pixelovou shodu s demo daty ani produkční OAuth/upload.

## Zachované neúspěchy a opravy

První fullgates správně odmítly chybějící dva D9 kanály v přesném IPC inventáři. Doplněny pouze autorizované názvy a Settings-only kontrola; přesná rovnost, guardy a zákaz raw registrace zůstaly. První core review nalezlo tři skutečné bezpečnostní vady a UI review blokování retry v zamčeném detailu: RED/GREEN regrese jsou v reportech T-12/T-13.

`design-fail-save-layout/` dokládá skutečné přetečení obou akcí pod patičku. Kompaktní dvousloupcové selecty a menší mezery zachovávají celý obsah i dostupné Nechat na Macu. Následující FAIL zachytily výšku časové značky a kolizi CSS paddingu; obojí opravené ve zdroji. Patička nyní pravdivě rozlišuje explicitní uložení firmy/přístupu a aktivní filtr má čitelný počet.

Další FAIL doložily skrytí izolovaného panelu a pozastavení requestAnimationFrame macOS při occlusion. E2E před skutečným CDP kliknutím/snímkem aktivuje okno existujícím E2E-only tray bridge, čeká na viditelnost a již existující načtený stav filtru. Pouze testovací launch vypíná background throttling. Funkční refresh při focus, 8s CDP a 12s limity, native hit-test i původní aserce zůstaly. Nezávislé review změny měřidla potvrdilo synchronizaci bez oslabení podmínek.

`audit-first/` zachovává40/41: očekávání počtu company offers neoddělovalo oprávněný Settings selector od zamčeného detailu. Po synchronizaci uložené firmy se měří nová volání detailu; zákaz configure a nezměněný retry CAS jsou stále kontrolované. `audit-41-pass/` a `design-pass-filter-ready/` jsou mezikroky; finální zdroj dokládají jen složky s příponou `-final`.

## Převodník a omezení

Připravený arm64 FFmpeg6.1.6/Opus1.6.1 byl sestaven z připnutých zdrojů; [build](commands/encoder-build.log) exit0. Následný check ověřil zdroje, binární/kanonický hash, architekturu a podpis. Nainstalovaná aplikace ani její profil nebyly změněny. Sandboxová read-only kontrola podpisu instalovaného encoderu byla zopakovaná mimo sandbox s exit0; první výsledek se nevydával za vadu produkční binárky.

⛔ Fyzický mikrofon/systémový zvuk, skutečné produkční přihlášení/upload a instalace aktualizace kandidáta nejsou ověřené. 🟡 Podepsání/notarizace/publikace zatím čekají na vydávací workflow. [Krátká Mac přejímka](../../docs/changes/desktop-astra-parity-0-1-6/MAC-PREJIMKA.md).

V archivu nejsou osobní profily, skutečné zvukové soubory, tokeny či podpisové klíče. Původní runtime reporty jsou zachované doslovně; archive-location.txt převádí jejich absolutní runtime umístění na verzovaný archiv.
