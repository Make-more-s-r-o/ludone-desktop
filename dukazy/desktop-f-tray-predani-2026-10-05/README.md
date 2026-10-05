# F Osa — systémové ikony a předání, 5. 10. 2026

Dan upřesnil hlavně ikony v horní systémové liště a požádal dokončit přípravu pro vývoj na Macu mini. Produkční implementace se v tomto běhu nespouští. Originální značka LuDone/Opus a celá vybraná F zůstávají zachované.

## Výsledky

🧪 [kontroly.txt](kontroly.txt): syntaxe sedmi souborů, samostatná akceptace návrhových souběhů, původní brand hash, aktuální zdroj kresby, manifest třiceti assetů, rozměry 18/36 px, monochromatické alfa masky a odlišnost všech stavů, `git diff --check`. Příkazy mají vlastní doslovný výpis a exit kód. Nejde o úpravu nebo náhradu produkčních testů.

🧪 [prokliky.json](prokliky.json): 20 kontrol galerie (deset stavů × světlá/tmavá lišta), všechny třicet rastrových obrázků načtené; 36 klíčových obrazovek F ve třech tématech bez přetékání, správné aktivní ikony a samostatné okno pouze pro detail. Galerie při 400 px a vložený panel při 362 px nepřetékají. Konkrétní mock tok: zavřít panel během nahrávání → čas/ikona nahrávání zůstává → otevřít → stop → saving → decision → změna názvu, firmy a soukromí → místní uložení. Po uložení ikona správně hlásí zbývající fiktivní problémy fronty.

Snímky: [náhled](horní-lišta-náhled.jpg), [všechny stavy](horní-lišta-všechny-stavy.jpg). Screenshot celého přehledu zobrazuje 18 px, Retina 2× a zvětšení; nejde o skutečnou systémovou tray.

✅ [remote-preflight.txt](remote-preflight.txt): čtecí SSH připojení na správný dev-ludone host, verze nástrojů, přihlášený Codex, Swift/macOS SDK a dostupnost desktopového repa z GitHubu. Počáteční sandboxové odmítnutí síťového připojení a problém PATH jsou uchované; další povolené čtecí kontroly prošly. Žádné tajemství se nečetlo ani nepřenášelo.

Nezávislé zdrojové review Sol: [review-sol.md](review-sol.md). Zjištěný P2 — předčasné tvrzení o schválení ikon v připraveném promptu — opraven podmínkou použití a odkazem na přímé zadání člověka. Žádný další P1/P2 v kódu nalezený. Review samo není GUI měření.

## Podklady a limity

[Kontrakt](../../docs/changes/desktop-complete-designs-2026-10-01/F-TRAY-KONTRAKT.md), [celé zadání](../../docs/changes/desktop-complete-designs-2026-10-01/IMPLEMENTACE-F.md), [předání](../../docs/changes/desktop-complete-designs-2026-10-01/PREDANI.md). Původní `sonnet-f.css`/`sonnet-f-layout.js` se v tomto průchodu neměnily; autorské podklady, všechny A–G a původní ikonová verze zůstávají verzované.

🟡 Posouzení této poslední sady ikon a pokyn začít implementaci. ⛔ F v nainstalované aplikaci, skutečný tray, GUI session Macu mini, oba zvukové kanály, OAuth/upload, Finder/koš a update se tímto náhledem neověřují. Připojení přes SSH neznamená fyzické ani zvukové ověření. Cloudové prostředí ani další běžící remote agent nebyly založené.
