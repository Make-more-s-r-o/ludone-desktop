# Specifikace — desktop-astra-parity-0-1-6

**Stav:** směr Astra je schválený; implementace a lokální ověření proběhly v pracovním stromě. Kanonický masterplan zůstává kvůli chybějícímu harnessu ve stavu draft · **datum:** 30. 9. 2026.

## Cíle

1. Přenést celý schválený Astra shell a jeho hlavní cesty do skutečného Electron rendereru.
2. Zachovat skutečnou funkčnost nahrávání, fronty, serverového ověřování, nastavení a updateru.
3. Přidat designovou E2E bránu, která zaznamená klíčové obrazovky reálného rendereru, zkontroluje obsah/interakce a poskytne obrazové důkazy k přímému porovnání.

## Non-goals

- LuTrack, lokální časovač, synchronizace pracovních úseků a serverová změna.
- Fiktivní firemní/záznamová data nebo falešné „ověřeno“ stavy v produkční aplikaci.
- Nová oprávnění IPC, automatické odesílání starších nahrávek, změna upload API či bezpečnostních bran.
- Změna dosud schváleného vizuálního směru Astra.

## Feature katalog

### DESKTOP-ASTRA-PARITY-0-1-6-01 — Kompletní Astra desktopový tok

Umožní Danovi používat Teď, Můj den, detail a Nastavení jako jeden skutečný desktopový produkt, zachovat existující tok nahrávek a před vydáním porovnat běžící Electron UI se schválenou Astrou.

## Akceptační scénáře

#### AC-01.1 — Navigace v aplikaci

**Given** je otevřený přihlášený panel LuDone Desktop<br>
**When** uživatel zvolí „Můj den“ nebo „Nastavení“ a vrátí se do „Teď“<br>
**Then** přejde na odpovídající skutečnou plochu se stejnou značkou, navigací a tématem a panel se umístí bez oříznutí.

#### AC-01.2 — Uložení a odeslání záznamu

**Given** je nahrávání zastavené a stereo export dokončený<br>
**When** uživatel zvolí odeslání nebo pouze místní uložení<br>
**Then** použije se současný souhlasný tok a detail ukáže skutečný výsledek; žádný test ani render nevykreslí serverem nepotvrzený úspěch.

#### AC-01.3 — Stopa dne

**Given** fronta obsahuje lokální a odeslané záznamy<br>
**When** uživatel otevře „Můj den“ a detail položky<br>
**Then** vidí skutečné položky a dostupné akce; sekce LuTracku neumožní spuštění ani nevytvoří pracovní minuty.

#### AC-01.4 — Uvolňovací brána

**Given** produkční build sestavený ze změny<br>
**When** se spustí designová E2E přejímka v podporovaném Mac prostředí<br>
**Then** projdou samostatné kontroly hlavních ploch, navigace a stavů, uloží se screenshoty Teď/Můj den/detail/Nastavení/update a průchod se porovná s původním Astra prototypem; neúspěch blokuje tag a publikaci.

## Doménové invarianty

- `server.recordingId`, vlastník, fronta a výsledek ověření zůstávají autoritativní; renderer je nepřepisuje.
- Místní kopie záznamu zůstává dostupná, dokud současná retenční pravidla dovolují její odstranění.
- Jedna nahrávka schůzky je jeden výsledný stereo soubor. Přepis a analýza patří do webové aplikace.
- Ztráta sítě nebo identity nikdy neznamená úspěšné odeslání.
- LuTrack nemá žádnou uživatelskou akci, která by mohla zahájit měření či zápis.

## Otevřené otázky a rozhodovací defaulty

### Q1 — Obnova vizuálního kontraktu před vydáním

Blokuje publikaci další desktopové verze. Konkrétní dotažení a původní nezměněný
FAIL jsou v galerii checkpointu; nezávislé T-12/T-13 pokračují. Rozhodnutí člověka
je v decisions.md, žádná výjimka dosud nebyla udělena.

## Konflikty řešené nahlas

- **Astra prototyp × LuTrack bez funkční služby:** vzhled se zachová, časovač a demo data se nepřenášejí.
- **Předchozí scope 0.1.5 × dnešní očekávání:** starý manifest popisoval jen L1 výřez; tato nová změna přijímá celý dříve schválený L2 směr a před release vyžaduje novou E2E přejímku.

### F2 — Produktové dotažení po živém auditu

Umožní Danovi používat klidný panel, přehled dne a pravdivý detail nad skutečnou
historií bez chyb skrytých záložek. Kontrakt a přejímka jsou v `PRODUCT-POLISH.md`.
Given dlouhá historie a čekající fronta; When otevřu Teď, Můj den, detail a Nastavení;
Then nahrávání zůstane hlavní akcí, dny se neslijí, diagnostika se načte a všechny
povolené akce mají bezpečný dokončitelný tok ve třech tématech.

### F3 — Firma a viditelnost před uploadem

Umožní zobrazit uloženou výchozí firmu a bezpečně vybrat firmu a viditelnost
pro jeden nový či držený soubor podle UPLOAD-PREFERENCES.md. Private je default,
progress a serverová vazba zamčené; CAS/owner/origin a čerstvá nabídka povinné.

#### AC-03.1 — Zapamatovatelný default
Given platná identita s uloženou firmou, When znovu otevřu Nastavení, Then vidím
skutečnou uloženou volbu a odlišenou neuloženou změnu i chybu načtení.

#### AC-03.2 — Nastavení jedné nahrávky
Given nový či držený soubor bez progress, When zvolím firmu a viditelnost, Then se
preference uloží před souhlasem a nezmění default ani nespustí samy upload.

#### AC-03.3 — Závody a restart
Given uložená volba, When restart nebo změna účtu/originu/revize, Then platná volba
přežije restart; cizí či stale změna se odmítne a progress se nikdy nepřepíše.

#### AC-03.4 — Klientský protokol
Given per-recording volba, When první upload, Then stávající create request
nese přesnou zvolenou firmu a private/company; staré soukromé payloady platí dál.

Otevřená Q1 blokuje publikaci. Obnova vizuálního kontraktu vyžaduje člověka;
nezávislá implementace F3 pokračuje a původní brány se kvůli výsledku nemění.
