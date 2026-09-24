# Stav běhu `desktop-astra-0-1-5`

**Aktualizováno 24. 9. 2026 po vydání.** Tento tier L je dodaný do distribuce. Strojový
průběh je v `progress/status.json`; důkaz vydání je v `evidence/release/release.md`.

## Vydání

| Položka | Stav |
|---|---|
| PR #149 | Sloučeno do `main` v commitu `46b313cc9a270f321e9c81b9cd8d61a7c06f7f9f`; CI `gates` prošly. |
| Tag `v0.1.5` | Pushnut na merge commit; spustil podepsané macOS workflow. |
| GitHub workflow `35941431564` | Úspěšně proběhly brány, sestavení Opus pro obě architektury, podpis, notarizace, publikace a kontrola feedu. |
| Veřejný updater feed | Nezávislý GET/HEAD: feed hlásí `0.1.5`; arm64 i x64 DMG, ZIP a blockmap soubory jsou dostupné. Stav ✅ pro publikaci. |
| Způsob distribuce | Stahování a aktualizace jsou na [stahnout.ludone.cz/desktop](https://stahnout.ludone.cz/desktop/); workflow nezakládá GitHub Release stránku. |

## Ověřeno automaticky

- `npm run gates`: 76 souborů, 1 557 testů prošlo, 3 přeskočené testy jsou přesně baseline; exit 0. Stav 🧪.
- `npm run build`: produkční sestavení rendereru prošlo, 55 modulů; exit 0. Stav 🧪.
- Nezávislé review opravilo oba nálezy v předání záložky Nastavení a následné úplné brány prošly. Stav 🧪.
- Podpis/notarizace a živá dostupnost distribučních souborů byly potvrzené vydávacím workflow a samostatným HTTP měřením. Stav ✅ pro vydání a feed.
- Samostatné výpisy testů T-01/T-02 a typecheck byly zachovány vedle reportů; jejich přesné kopie i původní feed snapshot jsou navíc v [`dukazy/desktop-astra-0-1-5`](../../../../dukazy/desktop-astra-0-1-5/README.md).

## Co ještě potřebuje Danův Mac

Přes aplikaci jsme kvůli nedostupnému Orca runtime nepořídili vizuální průchod. Na fyzickém
Macu zůstává 🟡 ověření aktualizačního proužku a oznámení, odložení, ruční instalace,
skutečného systémového zvuku a jednoho uploadu schůzky. Přesný krátký postup je v
[`OVERENI-NA-MACU.md`](OVERENI-NA-MACU.md). Automatické testy ani HTTP kontrola tyto kroky
nepotvrzují.

## Varování E5

Samostatná historická sonda `scripts/akceptace/E5.sh` naměřila 7 PASS a 1 FAIL: předpokládá,
že chybějící `DESKTOP_UPLOAD_ENABLED` vypne upload. Pozdější schválené D3/D11 dovolují
výslovně potvrzené ruční odeslání z Finderu bez shellových proměnných. Tato verze nemění
upload ani frontu; E5 ani produkční kód se kvůli výsledku neupravovaly. Rozpor je ⚠️ a před
budoucí změnou uploadu vyžaduje samostatné sladění.

## Rozhodnutí a rozsah

- [D1](decisions.md#d1--pro-015-použít-směr-astra-nit-dne): implementován vybraný směr Astra; oba klikací návrhy zůstávají uložené.
- [D2](decisions.md#d2--lutrack-zůstává-vypnutý-do-připravenosti-služby): LuTrack je pouze neaktivní placeholder. Časovač ani připojení na backend LuDone v tomto vydání nejsou.
- [D3](decisions.md#d3--zachovat-bezpečnostní-identitu-nastavení): zachované oprávnění a hash `#settings`.
- [D4](decisions.md#d4--verzi-015-připravit-a-vydat-desktopovým-workflow): podepsané vydání proběhlo stávajícím workflow.

Budoucí UX návrh LuTracku je zachovaný odděleně v
[`../../desktop-redesign-2026-09-23/lutrack/NEXT-RELEASE.md`](../../desktop-redesign-2026-09-23/lutrack/NEXT-RELEASE.md)
a v porovnání celé aplikace. Je to příprava pro případné navazující zadání, ne funkční
integrace ani schválený serverový kontrakt.
