# Jedna schůzka = jeden stereo soubor

> **23. 9. 2026 / D21:** Dan ponechal výběr formátu podle velikosti a účelu. Aktuální cíl
> je **WebM/Opus, 96 kb/s stereo**, nové živé audio bez další ztrátové konverze. Název tohoto
> dokumentu zůstává kvůli existujícím odkazům. Historické MP3 důkazy z 15. 9. nejsou důkazy
> nového formátu; finální přejímka se zopakuje pro WebM. Zbytek kontraktu D20 (jediný upload,
> identity, restart, owner/consent, bezpečné mazání, oba Macy) nadále platí.


Dan 15. 9. 2026 výslovně změnil výsledek: „na app.ludone jde jen jeden záznam ze schůzky“ a doplnil formát MP3. Toto zadání nahrazuje oddělené produkční uploady popsané v P1/P5 a NRD-01. Rozsah je schválený konverzací; žádný hookový approval se nevyrábí. Navazuje na existující tier L a odložený redesign (D10).

## NRD-09 — výsledek

- Nová schůzka se odesílá jako jediný WebM/Opus: mikrofon vlevo, systémový zvuk vpravo. Bez systémového zvuku zůstává pravý kanál tichý a metadata pravdivě uvádějí jen mikrofon.
- Aplikace zachová původní soubory. Použije existující průběžný stereo záznam na jediné časové ose, následně jej přibalený nástroj pouze přebalí bez změny Opus paketů. Převod ani upload nesmějí načíst celou hodinovou nahrávku do RAM.
- Výsledný WebM/Opus a jeho ověřitelná metadata se uloží trvale a atomicky před prvním síťovým INIT. Opakování použije stejné bajty, hash a identitu; jeden záznam má jedno serverové recordingId.
- Odeslání, restart, výběr firmy, vlastnictví, retry, ověření, otevření na webu a lokální koš respektují jediný odeslaný soubor. Consent a ochrany IPC se nemění.
- Staré kompletní záznamy bez zahájeného uploadu lze převést z původních stop, pokud jejich manifest poskytuje ověřené časové kotvy. Při nejistotě se upload zastaví s konkrétním důvodem. Neúplné záznamy se nevydávají za kompletní.
- Za možné zahájení se považuje také uložený company pin nebo historie pokusu bez odpovědi; samotná nulová ID nejsou důkazem nulového HTTP. Migrační zábrana přežije i reset vlastnictví. Rozpracované historické uploady se automaticky nepřevádějí na novou identitu; před dalším HTTP se bezpečně pozastaví. Již odeslané záznamy se zpětně nepřepisují ani nemažou. Žádný automatický návrat ke dvěma uploadům.
- Převod nevyžaduje Homebrew, PATH ani ruční instalaci. Balení pro oba Macy obsahuje odpovídající encoder a jeho licenční podklady; podpis musí zahrnout přibalený program.

## Kontext a konflikty

- `src/lib/stereo-recording.js`: mic→L/system→R a stabilní systémová větev již existují.
- `electron/main.cjs`: stereo dnes žije v temp, fronta se zakládá z originálů a export se po rozhodnutí maže.
- `electron/upload-client.cjs`: každý originál má vlastní INIT/recordingId; WebM je již v klientově MIME mapě.
- `src/lib/queue.js`, `electron/queue.cjs`, `electron/recordings-dashboard.cjs` a `electron/recording-verification.cjs`: očekávají per-track serverový stav. Nový formát musí být výslovně odlišený, nikoli maskovaný jako mikrofon.
- Read-only serverový checkout `LuDone/ludone-app`, `src/lib/nahravky/private-recording-storage.ts` přijímá `audio/webm` a příponu webm; `src/app/api/nahravky/uploads/route.test.ts` pokrývá WebM/Opus. Není to důkaz ostrého uploadu.

## Plán a vlastnictví

| Etapa | KDO | Výsledek | Závislost |
|---|---|---|---|
| T-S0 | Astra | Tento doplněk, packety, stav, docs-first PR | — |
| T-S1 | Sol runtime | Trvalý WebM/Opus, jedna identita, fronta a dashboard, regresní testy | T-S0 |
| T-S2 | Sol balení | Přibalený encoder pro arm64/x64, ověření balíčku a podklady | T-S0 |
| T-SR | Sol retence | Bezpečný úklid derivátů se sdíleným preflightem T-S1 | T-S0; API T-S1 |
| T-S3 | Astra + nezávislé Sol review | Integrace, brány, syntetický audio důkaz, PR a přejímka | T-S1, T-S2, T-SR |

Runtime a balení mají oddělené worktree a allowlisty. Root vlastní dokumentaci, integraci a commity. Nový release tag není součástí pověření D19 pro 0.1.3.

## Akceptace

1. Dva různé syntetické tóny dají WebM/Opus se dvěma kanály; každý tón je pouze ve správném kanálu, začátky a délka odpovídají vstupu. Celý WebM/Opus se dekóduje bez chyby. Syntetický důkaz není živý zvuk.
2. Produkční wiring proti mock serveru odešle jediný INIT/obsah/dokončení a správné `audio/webm`, název a capture metadata.
3. Pád po INIT, nový proces a opakování zachovají WebM/Opus, hash, company pin, session a recordingId; nevznikne druhý záznam.
4. Keep→restart→send, neúspěšný encoder, poškozený/vyměněný asset a neúplný záznam bezpečně zachovají originály; žádné síťové fallbacky na dvě stopy.
5. Verifier srovnává hash/velikost WebM/Opus a jedno serverové ID. Koš zahrnuje deriváty i sidecar a zachová dosavadní revizní/owner ochrany.
6. `npm run gates`, `npm run gates:clean`, `npm run build` a `bash scripts/akceptace/E6.sh`: doslovné logy a exit kódy. Stávající brány/skip baseline se neoslabují; změna očekávání testu je přípustná pouze tam, kde D20 přímo mění produktové chování, s odůvodněním v review.
7. Dan následně na Macu pořídí krátkou schůzku a ověří jeden řádek na webu, oba kanály a společný přepis. Produkční upload ani soukromé audio se agentem nespouští.

## Stav

🟡 Implementace se přizpůsobuje D21; dřívější MP3 důkazy zůstávají historické. Finální WebM přejímka čeká. Produkčně vydaná zůstává 0.1.3.
