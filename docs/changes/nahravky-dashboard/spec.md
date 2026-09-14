# Specifikace — dokončení nahrávek (`nahravky-dashboard`)

Stav: schválený rozsah běhu, realizace probíhá · datum: 14. 9. 2026.

Podrobné provozní a bezpečnostní požadavky určuje schválené [zadání](ZADANI-PRO-CODEX.md). Novější rozhodnutí jsou v [decisions.md](decisions.md). Tento dokument z něj vybírá stabilní funkce a pozorovatelnou akceptaci; nerozšiřuje produkt.

## Cíle

1. Uchovat po restartu pravdivý stav každé stopy nahrávky a umožnit bezpečné pokračování.
2. Dát uživateli v existujícím Nastavení přehled lokálních a ověřených serverových stavů a jednotlivé bezpečné akce.
3. Připravit podepsanou a notarizovanou aplikaci, atomický update feed a viditelnou informaci o dostupné aktualizaci.

## Non-goals

- Backendové změny, serverový seznam nahrávek, nový desktopový archiv a LuTrack.
- Redesign, zásahy do `design/`, nové knihovny bez potřeby a automatické připsání cizí nahrávky.
- Automatické odeslání starých nahrávek po zapnutí nové volby.
- Agentní nahrávání reálného zvuku, ostré přihlášení, tag nebo veřejné vydání.

## Feature katalog

### NRD-01 — úplná a obnovitelná fronta

Umožní uživateli pokračovat po restartu bez ztráty identity a výsledku kterékoli zvukové stopy.

### NRD-02 — výslovné převzetí

Umožní přihlášenému uživateli potvrzeně převzít jednu aktuální lokální nahrávku bez změny ostatních položek.

### NRD-03 — lokální přehled

Umožní uživateli rozlišit položky fronty, osiřelé soubory, chybějící soubory a poškozená data na Macu.

### NRD-04 — porovnání serveru

Umožní uživateli výslovně ověřit známá serverová ID obou stop a rozlišit síťovou, přihlašovací, limitní a datovou chybu.

### NRD-05 — odeslání podle volby

Umožní uživateli po každém novém záznamu zvolit odeslání nebo ponechání na Macu a nastavit automatiku jen pro budoucí záznamy.

### NRD-06 — akce nad záznamem

Umožní uživateli nad jednou čerstvou položkou opakovat odeslání, potvrzeně mazat, otevřít složku nebo existující webový detail.

### NRD-07 — produkční přihlášení

Umožní aplikaci spuštěné z Finderu získat správný upload scope a bezpečně obnovit odmítnutou klientskou relaci.

### NRD-08 — vydání a update

Umožní uživateli obdržet ověřenou aktualizaci z existujícího feedu a vidět, že je připravená k instalaci.

## Doménový model a pravidla

### Identity

- Lokální ID nahrávky zůstává stabilní při převzetí, retry i restartu.
- Otisk vlastníka vzniká pouze v hlavním procesu z aktuální platné relace správného issuer/resource/scope; renderer jej neposílá ani nevidí.
- Serverová ID a session patří jednotlivým stopám a nesmějí se zaměnit mezi vlastníky nebo položkami.

### Nezávislé stavy

- Lokální existence, stav fronty a ověření na serveru jsou tři oddělené skutečnosti.
- Výsledek mikrofonní a systémové stopy je nezávislý; částečný úspěch se nezobrazí jako úplný.
- Stav kódu, testů, zveřejnění a živého ověření vydání se vede odděleně.

### Oprávnění a citlivá data

- Bez platného přihlášení nelze převzít ani odeslat položku; lokální přehled přitom nesmí spustit síťový request.
- Každý nový IPC kanál používá existující kontrolu očekávaného lokálního okna.
- Renderer ani reporty nedostanou absolutní cestu, token, privátní klíč nebo otisk vlastníka.
- Podpisové a publikační hodnoty zůstávají pouze v GitHub Secrets/Variables; jejich hodnoty se nečtou ani nezapisují do repozitáře.

### Souběh, retry a recovery

- Mutace fronty probíhají v jediné serializaci; upload do ní nesmí znovu vstoupit.
- Převzetí a destruktivní akce validují ID i revizi čerstvého snímku.
- `429` neubírá pokus položce a společné `Retry-After` zastaví pumpu bez individuální retry bouře.
- Zapnutí automatického odesílání nemění consent starších položek.
- Release publikuje verzované soubory před feedem; feed se povýší až jako poslední atomický krok.

## Akceptační scénáře

### NRD-01

#### AC-01.1 — restart po částečném uploadu

**Given** jedna ze dvou stop má potvrzené serverové ID a druhá čeká
**When** aplikace obnoví frontu po restartu
**Then** zachová obě lokální identity, potvrzené ID i session a pokračuje jen chybějící stopou.

### NRD-02

#### AC-02.1 — potvrzené převzetí

**Given** platná relace, čekající položka jiného vlastníka a její aktuální revize
**When** uživatel viditelně potvrdí převzetí
**Then** změní se jen tato položka, stará serverová ID se vyčistí a upload se sám nespustí.

#### AC-02.2 — zastaralý nebo změněný záměr

**Given** se během potvrzení změní účet, relace, položka nebo její revize
**When** hlavní proces záměr provádí
**Then** zápis odmítne a renderer může načíst nový bezpečný snímek.

### NRD-03

#### AC-03.1 — neúplná lokální data

**Given** fronta, osiřelý soubor, chybějící soubor a poškozený manifest
**When** uživatel otevře Nahrávky
**Then** každý případ má vlastní pravdivý stav a poškození nevypadá jako prázdný seznam.

### NRD-04

#### AC-04.1 — výslovné serverové ověření

**Given** položka se známými ID obou stop
**When** uživatel zvolí ověření
**Then** hlavní proces použije pouze read-only GET a UI samostatně ukáže shodu, 404, 429, chybu přihlášení nebo sítě.

### NRD-05

#### AC-05.1 — consent nové nahrávky

**Given** uživatel zastaví novou nahrávku
**When** vybere „Nechat na Macu“
**Then** položka nevstoupí do upload pumpy ani po restartu.

#### AC-05.2 — automatika bez retroaktivity

**Given** ve frontě existují starší položky bez souhlasu
**When** uživatel zapne automatické odesílání
**Then** automatika platí jen pro později vytvořené nahrávky.

### NRD-06

#### AC-06.1 — bezpečná akce nad položkou

**Given** aktuální bezpečná projekce jedné nahrávky
**When** uživatel zvolí retry, smazání, složku nebo web
**Then** akce cílí tutéž čerstvou položku, smazání vyžádá potvrzení a web použije známé ID.

### NRD-07

#### AC-07.1 — přihlášení z Finderu

**Given** aplikace byla spuštěna bez shellových proměnných
**When** uživatel dokončí OAuth tok
**Then** relace má správný issuer/resource/upload scope a odmítnutý klient neznovupoužije starý refresh token.

### NRD-08

#### AC-08.1 — atomické vydání

**Given** podepsané artefakty prošly validací a vzdálená konfigurace je úplná
**When** release workflow publikuje verzi
**Then** verzované DMG, ZIP a blockmapy vzniknou před `latest-mac.yml` a selhání nepředstírá úspěch.

#### AC-08.2 — viditelná aktualizace

**Given** veřejný feed nabízí vyšší ověřenou verzi
**When** aplikace dokončí kontrolu aktualizace
**Then** uživatel vidí dostupnou aktualizaci a restart respektuje právě probíhající nahrávání nebo časovač.

## Odložený rozsah

- Serverový archiv, vyhledávání a historie v desktopu.
- Redesign Nastavení a jiných existujících obrazovek.
- Windows a mobilní aplikace.

## Otevřené otázky a provozní stopky

Produktová Q tento běh neblokuje. Veřejné vydání čeká na nastavení publikačních GitHub Secrets/Variables, potvrzení zálohy podpisového klíče ve firemním správci hesel, přijetí implementace, Danův tag a skutečný test instalace a aktualizace.

## Konflikty, které specifikace řeší nahlas

- Historický `desktop-v1` označoval automatický sync jako odložený a endpointy za neživé. Schválený běh z 14. 9. a read-only ověřený serverový kontrakt tuto hranici pro současnou změnu nahrazují.
- Historický plán uváděl čekání na Apple Developer Program a neveřejný GitHub. Dnešní doložený stav je veřejný repozitář s existujícími názvy podpisových secrets; nový signed/notarized build, záloha klíče a veřejné vydání však stále ověřené nejsou.
- Starý stav spojoval „kód existuje“, „testy prošly“ a „je vydáno“. Aktuální přehled drží delivery, exposure a verification odděleně.
