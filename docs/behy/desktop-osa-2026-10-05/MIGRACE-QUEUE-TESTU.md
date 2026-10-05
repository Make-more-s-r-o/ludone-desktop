# Rovnocenná migrace frontových kontrol na F

Dan dne 5. 10. výslovně schválil rovnocenný přechod na F. Zachováno všech 293 původních případů tohoto souboru; žádný skip ani baseline. Nezávislé review zachytilo a odstranilo oslabení počtu přepínacích událostí: kontrola znovu měří přesně jednu.

| Původní kontrola | Rovnocenná F kontrola |
|---|---|
| Druhé settings okno a změna tabů | Stejná ověřená událost v existujícím panelu, bez dalšího okna; skutečný detail má vlastní UUID okno |
| Panel jako nepovolený settings sender | Samostatné cizí BrowserWindow se stejným původem, které není vlastněným panelem ani detailem; podřízené rámce a payloady beze změny |
| Výška/monitor a šířka 400 | Stejné ořezání výšky, pozice a pořadí resize/přilepení se schválenou F šířkou 420 |
| Aktivní LuTrack a kombinovaná maska | Neaktivní LuTrack neovlivní skutečné nahrávání; F maska používá stejná template/retina/bajtová měření ve všech tématech |
| Nová místní nahrávka ihned čeká na upload | Skutečný held záznam zůstává místní; persistovaná schválená čekající fronta má stále queue-waiting již před recovery |
| Verze v home | Verze je přítomná na skutečné stránce Aktualizace, dostupné jedním rail kliknutím; stavové kontrolky a onboarding zachované |
| Expirace a přihlášení v Astra dialogu | Stejné skutečné IPC a šifrovaný soubor, viditelná F expirace a explicitní přihlášení; soubor zůstává nezměněný |

🧪 293/293 PASS. Výstup celé sady: `dukazy/desktop-osa-2026-10-05/osa-full-after-migration.json`. Kladné služby settings zůstávají a panelové seznamy/skupiny se skutečně volají. Scoped owner, CAS revize, payload whitelist, nulové síťové vedlejší efekty, update/quit/finalizace zůstávají testované.
