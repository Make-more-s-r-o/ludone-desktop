# Příprava další verze LuDone Desktop

Stav k 23. 9. 2026. Jde o doporučení rozsahu, ne o schválené číslo verze, vydání nebo změnu produktu. Tento worktree obsahuje jen návrh budoucího ovládání.

## Základ rozhodnutí

✅ Verze **0.1.4 je podepsaná, notarizovaná a veřejně vydaná** pro oba Macy; release workflow prošel 1554 testy se třemi původními skipy a veřejný feed uvádí 0.1.4 (`dukazy/vydani-0.1.4-2026-09-23/REPORT.md:16-33`). T0–T6 a NRD-01–09 jsou sloučené, ale souhrnná matice uvádí pouze `tests-green`, nikoli živé ověření jednotlivých funkcí (`docs/changes/nahravky-dashboard/progress/status.json:19-23,25-145`). ⛔ Skutečná aktualizace z nainstalované 0.1.3, schůzka, jeden webový záznam, oba kanály a společný přepis čekají na Dana (`dukazy/vydani-0.1.4-2026-09-23/REPORT.md:39-43`; `docs/changes/nahravky-dashboard/OVERENI-NA-MACU.md:84-94`). To je chybějící důkaz přejímky, nikoli samo o sobě doložená vada kódu.

LuTrack pro další verzi nemá hotovou produktovou cestu. V panelu běží pouze React demo (`src/features/tracking/TrackingCard.jsx:17-46,139-169`). Hlavní proces sice ukládá časovač a umožňuje start/přepnutí/stop/obnovu (`electron/tracking.cjs:205-235,291-325,348-514`), ale start vyžaduje projektový GUID a vypínač (`electron/tracking.cjs:348-351`). Lokální fronta přijme uzavřený čas (`electron/main.cjs:3379-3400`); síťový klient jej pozastaví (`electron/upload-client.cjs:1022-1027`). Strana `ludone-app` vlastní podobu budoucího kontraktu a podle jejího auditu dnes nemá výběr platných projektů ani zápis času (`docs/changes/desktop-v1/decisions.md:803-826`; `/Users/dan/Dev/ClaudeCode/LuDone/ludone-app/docs/changes/_archive/nahravky-v2/kontrakt-alokace-lutrack.md:14-37`).

## Doporučené pořadí, nejvýše pět kroků

1. **Přejmout 0.1.4 na skutečném Macu.** Dan provede krátký postup z `OVERENI-NA-MACU.md:84-94`. Teprve konkrétní selhání vytvoří opravu pro další vydání. Nic nenahrávat agentem.
2. **Vybrat podobu panelu a projít tento čtyřstavový LuTrack koncept.** `index.html` ukazuje připraveno, běh, pouze místní položky a nedostupnou serverovou cestu. Je to vstup pro rozhodnutí o ovládání, nikoli třetí soutěž vizuálních směrů. Vzhled drží společné tokeny LuDone DS; styl A/B ještě není vybraný.
3. **Specifikovat úzký klientský řez.** Pokud bude po výběru designu schválen, lze bez backendu zapojit kartu na existující `tracking:*` IPC, viditelně rozlišit vypnutý časovač, běh a rozhodnutí po restartu. Pro produktový Start je nutný skutečný povolený GUID projektu; fiktivní nabídku z prokliku nelze převzít do aplikace. Popis práce je třeba uchovat i v uzavřeném místním záznamu — dnes ho `electron/tracking.cjs:190-202` zahazuje.
4. **Připravit kontrakt s vlastníkem `ludone-app`, zatím bez změny backendu.** Potřebný je seznam projektů platných pro konkrétního člověka s rozhodnutím o vybratelnosti, identita záznamu proti duplicitě, zápis a výsledek odeslání. Dokument na straně aplikace označuje tvar odpovědi za návrh k ratifikaci (`kontrakt-alokace-lutrack.md:91-125`), nikoli existující endpoint. Money-path vyžaduje review nad diffem (`AGENTS.md:49-54`).
5. **Až po kontraktu řešit plný LuTrack.** Serverový denní souhrn, synchronizace, konflikty a skutečné vykázání se do nejbližší verze bez backendu neslibují. Dnešní odesílač vrací `time_upload_unavailable` (`electron/upload-client.cjs:1022-1027`); stránka `/lutrack` v `ludone-app` je stále placeholder (`/Users/dan/Dev/ClaudeCode/LuDone/ludone-app/src/app/(app)/lutrack/page.tsx:4-37`).

## Pravidlo pro komunikaci a ověření

Používat přesné stavy: ✅ ověřeno naostro pro publikaci 0.1.4; 🧪 zelené testy pro klientské chování NRD-09; ⛔ neověřeno pro instalaci, živý zvuk, produkční upload a přepis; ⚠️ upozornění pro nesoulad mezi demo kartou a skrytým místním časovačem. Žádný výsledek prokliku se nepřenáší na produkt. Historický masterplán je mimo repo jako nepřijatý draft a rozhodnutí M6 výslovně říká „žádný hook, žádný skill“ (`docs/behy/2026-09-01-masterplan-a-design.md:9-16,20-26`); nový LuTrack rozsah potřebuje vlastní záměr a rozhodnutí, ne domnělé schválení z tohoto HTML.
