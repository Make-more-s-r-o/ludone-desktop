---
kind: review
ref: c25ef2aae13aa50b4544ba68adb2c54cafd3e9d4
verdict: pass
measuredAt: 2026-09-14T22:56:05Z
scope: [NRD-07, NRD-01, NRD-06, T-A4]
measuredFrom: [nezávislé čtení výsledného diffu koordinátorem, vlastní npm run gates nad předaným stromem]
---

# Přejímka firmy a uploadu

🧪 Vlastní `npm run gates` koordinátora nad výsledným T-A4: **1503 PASS**, tři původní
skipy, 71 sad, exit 0. Doslovný výpis je v `root-gates.log`. Samostatná T-I1 upravuje
pouze renderer; společný čistý klon a CI následují po integraci obou částí.

| Průchod review | Výsledek |
|---|---|
| Správnost | Settings používá A3 selector a dva validované IPC kanály. Výběr sám nevolá frontu. Nový pin se zapisuje přes existující awaited durable progress před INIT. |
| Bezpečnost a oprávnění | Token zůstává v main; nabídka má main odvozeného žadatele, current session a settings-only guard. Atomický auth zápis kontroluje relaci i guard. Root nalezl mezeru při navigaci během čekání na CAS; samostatná epocha ji nyní uzavírá. |
| Kritické invarianty | Restart po mic INIT s globální firmou B zachová pin A i původní session obou stop. Legacy initialized bez pinu má 0 HTTP. Ruční zero-ID rebind prochází store serializací, revizemi a owner guardem; initialized firma a ID se nemění. Pozdní 403 nesmaže novější globální volbu. |
| Intent a specifikace | Finder má skutečný výběr firmy, staré nahrávky se tím neschválí. Save-decision vrací durable queued před dokončením pumpy; held zůstává lokální. Explicitní T2 claim dál resetuje celý server včetně pinu. |
| Plán a architektura | Využité stávající auth CAS, fronta, progress a Settings; žádný backend ani nový archiv. A4 převzalo hotspoty sekvenčně po T5/A3. |
| UI rozsah | Jen existující Nastavení, pevné vysvětlení chyb a odstranění dvou zastaralých textů. Redesign zůstává odložen dle D10. |
| Důkazy | První neúspěšné gates i reálné RED/GREEN sabotáže jsou zachované. Změny fixture mají konkrétní důvod; logout spy zachovává a rozšiřuje pořadové aserce. Root nevyvozuje živý výsledek z mocků. |
| Přehled | T-A4 označeno completed jako implementační task; funkce má nejvýš tests-green. Podpis, publikace a Mac přejímka zůstávají čekající. |

## Konkrétní integrační opravy

- Původní CI `ENOTEMPTY` vzniklo ukončením testu před startup pumpou. Harness nyní čeká
  na skutečný Promise store.pump; zachovává neblokující start, žádný sleep ani catch úklidu.
- Bezpečná projekce nyní vysvětluje neznámou firmu initialized nahrávky a odmítnutou firmu
  pevným textem. Raw server error se nezobrazuje.
- Ukládací IPC nečeká na celý upload. Regrese pozdrží pumpu, ověří odpověď queued
  po durable rozhodnutí a teprve potom pumpu dokončí.

## Proč to není chyba měřidla

Testy používají skutečný diskový store, main IPC a token-storage CAS tam, kde je právě
jejich integrace podstatná; síť zůstává mockovaná. Pin má kromě hodnoty také kontrolu
pořadí před HTTP a nulového HTTP při selhání zápisu. Sabotáže tyto kontroly rozbijí.
Navigační test přímo ověřuje guard předaný do pozdrženého CAS adapteru; samostatné
přijaté A3 testy měří tentýž synchronní guard uvnitř skutečné storage transakce.

⛔ Produkční login/upload, reálné audio, podepsaná instalace a update zůstávají neověřené.
