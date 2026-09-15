# Kontrakt výsledku — nahravky-dashboard

Kontrakt popisuje pozorovatelné výsledky schválené cesty „nahrát → rozhodnout → vidět lokální a serverový stav → provést jednotlivou akci“ a bezpečné vydání desktopu. Neurčuje nový backend ani nový archiv.

## Rozsah a bezpečný výchozí stav

- Nahrávka zůstává lokálně zachovaná, dokud uživatel nebo durable automatický snapshot výslovně nepovolí odeslání.
- Neznámý vlastník, neplatná relace, stale revize, poškozený manifest a aktivní cooldown končí bez mutace nebo requestu.
- Lokální, queue a serverový stav se nikdy neslijí do jednoho neurčitého „hotovo“.

## Aktéři a role

1. **Uživatel desktopu** — nahrává, volí uložení/odeslání, může potvrdit převzetí a jednotlivé lokální akce.
2. **LuDone Desktop** — drží citlivou identitu a cesty v main procesu, serializuje queue a rendereru ukazuje redigovaný stav.
3. **LuDone upload/web** — přijímá schválené stopy a vrací stav konkrétního známého ID; neposkytuje desktopový list.
4. **Dan jako release owner** — potvrzuje zálohu klíče, pushuje tag a provádí živou instalaci, login, audio a update přejímku.

## Hlavní journeys

### Nová nahrávka

1. Uživatel dokončí nahrávku; aplikace nejdřív durable uloží lokální soubory a queue položku bez souhlasu.
2. „Nechat na Macu“ zachová held položku i po restartu. „Uložit a odeslat“ schválí jen tuto položku a spustí chráněnou pumpu.
3. Automatika je snapshot na začátku nové session; její přepnutí nemění staré ani rozpracované položky.

### Přehled a server

1. Nastavení načte čerstvý lokální přehled queue, orphanů, ghostů a vadných manifestů bez sítě.
2. Cizí položku lze převzít jen potvrzeně a jednotlivě; claim vyčistí stará serverová ID a ponechá ji held.
3. „Ověřit v LuDone“ ručně načte nejvýše dvě známá per-track ID a zobrazí oba výsledky i čas; webový detail se otevře jen z trusted ID.

### Retry, reveal a koš

1. Send/retry znovu ověří vlastníka, relaci, queue/file revizi a společný 429 cooldown.
2. Reveal otevře složku pouze pro čerstvý trusted přímý soubor.
3. Smazání má default cancel, recheck po dialogu a přesouvá postradatelná lokální data do systémového koše; nikdy nemaže server.

### Vydání a update

1. Workflow po Danově tagu ověří zálohu klíče a konfiguraci, podepíše/notarizuje aplikaci a validuje balíčky.
2. Verzované artefakty vzniknou před feedem; `latest-mac.yml` se povýší poslední a výsledek se ověří přes veřejné HTTPS.
3. Updater ukáže vyšší verzi a odloží restart během nahrávání, ukládání nebo LuTrack aktivity.

## Inventář obrazovek a stavů

| Obrazovka / plocha | Povinné pozorovatelné varianty |
|---|---|
| Panel po dokončení nahrávky | název, „Uložit a odeslat“, „Nechat na Macu“, saved-local/queued/error |
| Nastavení → Nahrávky | loading, empty, queue/orphan/ghost/invalid, stale, per-track server výsledky, consent a bezpečné jednotlivé akce |
| Standalone reauthentication | login/expired a přímé otevření Nastavení bez sítě |
| Stav aktualizace | dostupná verze, stahování, staženo/odložený restart, chyba |

## Matice stavů

| Stav | Pozorovatelný výsledek a následný krok |
|---|---|
| `default` | Lokální přehled ukáže skutečné položky a jen povolené jednotlivé akce. |
| `pending/loading` | Načítání, upload, ověření i koš mají busy stav; dvojklik nevytvoří druhou operaci. |
| `empty/no-op` | Prázdný adresář má vlastní empty stav; held/cooldown/bez-ID vede k nule requestů. |
| `success` | Lokální uložení, potvrzený per-track server stav a nainstalovaná verze jsou označené odděleně. |
| `partial success` | Jedna stopa nebo část koše může uspět; UI uvede zbývající část bez tvrzení „hotovo“. |
| `recoverable error` | Síť/5xx nebo export po lokálním uložení zachová položku a nabídne bezpečný pozdější retry. |
| `fatal/unavailable` | Poškozená queue/manifest nebo neplatný target zastaví dotčenou akci a nezmizí jako empty. |
| `timeout/offline` | Stav zůstane lokální/queued; automatické opakování respektuje uložený termín a žádný polling dashboardu nevzniká. |
| `invalid input` | Title, ID, revize, cesta nebo serverová odpověď se odmítne bez syrových hodnot a bez mutace. |
| `conflict/concurrency` | Změna ownera/revize/session během dialogu či awaitu zahodí starý záměr a vyžádá refresh. |
| `forbidden/redacted` | Renderer nevidí token, owner fingerprint ani cesty; cizí položka nemá odeslání; lokální koš používá samostatnou kontrolu bezpečných souborů. |
| `disabled/degraded` | Bez auth zůstane lokální přehled a Nastavení; podpis/publish bez konfigurace nezačne. |
| `retry/rollback` | Retry je per item, 429 zachová attempts a release při selhání ponechá starý feed. |
| `archived/superseded` | Desktop nezakládá archiv; sent/odstraněná položka se znovu nevytvoří a starší feed je po povýšení nahrazený. |

## Matice oprávnění

| Aktér | Číst lokální stav | Odeslat / převzít | Smazat / otevřít | Vydat |
|---|---|---|---|---|
| Aktuální uživatel | redigovanou projekci | vlastní approved; cizí až po jednotlivém claimu | jen fresh trusted lokální položku | ne |
| Renderer | bezpečná data | pouze úzký záměr ID+revize | bez cesty a URL | ne |
| Main proces | trusted disk/store/auth | po všech current guardech | systémový koš/reveal po fresh rechecku | workflow pouze s konfigurací |
| Dan | uživatelské UI | stejné produktové právo | vlastní testovací data | tag a živá přejímka |

## Idempotence, souběh a degradace

- Stejná nahrávka/stopa zachovává stabilní identitu; idempotentní opakování INIT nevytvoří další serverovou nahrávku a partial progress přežije restart.
- Store mutace mají jedno pořadí. Dvojklik, změna ownera nebo stale revize skončí jedním vítězem a bezpečným refresh/no-op výsledkem.
- 429 blokuje vlastníka do autoritativního termínu bez spotřeby attempts; síť/5xx je retryable, auth/quota paused a neplatný vstup permanent nebo unavailable podle přesné třídy.
- Bez serveru funguje lokální přehled, uložení a reveal. Bez loginu nelze claim/send/verify, ale Nastavení zůstává dostupné.
- Bez release secrets, potvrzené zálohy nebo kompletních artefaktů se feed nepovýší. Starý veřejný feed zůstane autoritativní.

## Nevyřešené behaviorální body

Žádné produktové Q neblokuje implementaci. Provozní stopky jsou pouze podpisový backup, GitHub publish konfigurace, Danův tag a živé ověření. Formální design `approved.json` chybí, protože původní autorizace neproběhla přes masterplan hook; tento procesní fakt se zpětně nemění.
