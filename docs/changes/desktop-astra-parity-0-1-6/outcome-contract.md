# Kontrakt výsledku — LuDone Desktop 0.1.6

Jediný pracovní kontext má být srozumitelný od prvního otevření po dokončení nahrávky. Rychlá plocha slouží okamžiku, Můj den souvislostem, detail nahrávky rozhodnutí o jejím skutečném stavu a nastavení správě účtu, zdrojů, fronty a aktualizací. Vzhled vychází ze schválené Astry „Nit dne“; interakce vždy používají skutečné API desktopu.

## Rozsah a bezpečný výchozí stav

- Plochy: Teď/panel, Můj den, detail záznamu, Nastavení, onboarding/přihlášení, offline/recovery a aktualizace.
- Bezpečný výchozí stav: nahrávka zůstává na Macu, dokud uživatel výslovně nevybere odeslání; neznámý stav není označen jako úspěch.
- Návrh neopravňuje ke změně serveru, zapnutí LuTracku, automatickému uploadu starých souborů ani k falešným datům.

## Aktéři

1. **Přihlášený uživatel** — ovládá mikrofon/systémový zvuk, rozhoduje o odeslání a provádí povolené akce se svými lokálními nahrávkami.
2. **Desktopový renderer** — zobrazuje stav z hlavního procesu/API, žádné citlivé oprávnění nevytváří sám.
3. **LuDone backend** — autoritativně potvrzuje existující nahrávku a přijímá pouze již schválený upload tok.

## Hlavní journeys

### Záznam schůzky

1. Uživatel z lišty otevře „Teď“, vidí účet, spojení, připravenost zvukových zdrojů a neaktivní stav LuTracku.
2. Spustí záznam; aplikace zobrazuje skutečný stav mikrofonu i systémového zvuku.
3. Zastaví záznam a zvolí „Uložit a odeslat“ nebo „Nechat na Macu“; automatické odeslání se vztahuje jen na novou nahrávku a pouze dle uloženého nastavení.
4. Výsledek je viditelný v Můj den a detail ukazuje skutečný stav serveru či výslovně neověřený stav.

### Kontrola a oprava

1. Uživatel z Můj den otevře lokální nebo odeslanou nahrávku.
2. Detail zpřístupní pouze akce odpovídající jejímu stavu: odeslat, opakovat, ověřit, otevřít ve webu, ukázat ve Finderu či bezpečně přesunout do koše.
3. Při offline, expiraci přihlášení, limitu serveru nebo sporu vlastnictví se zobrazí přesný další krok; žádné tiché opakování ani falešné „hotovo“.

## Inventář obrazovek a stavů

| plocha | povinné stavy |
|---|---|
| Teď | idle, nahrávání, výpadek zdroje, potvrzení uložení, uloženo lokálně, čeká na odeslání |
| Můj den | skutečná lokální/ověřená data, prázdný den, načítání, chyba načtení; sekce práce viditelně připravená pro budoucí LuTrack, bez ovládání |
| Detail nahrávky | lokální, fronta, odeslaná neověřená, serverem ověřená, chyba/limit/vlastník, chybějící lokální soubor |
| Nastavení | účet, audio, nahrávky a retence, fronta, diagnostika, aktualizace; změna/obnovení stavu |
| Přihlášení | účet přihlášen, odhlášen, čeká na OAuth, vypršel; důvod a opakování viditelné |
| Aktualizace | dostupná, stahuje se, připravena, odložena, instalace čeká na dokončení nahrávání |

## Matice stavů

| stav | pozorovatelné chování |
|---|---|
| `default` | Teď nabízí začátek záznamu; Můj den zobrazuje jen reálné položky. |
| `pending/loading` | Viditelné načítání bez falešného počtu ani zeleného stavu. |
| `empty` | Přístupná zpráva; vysvětluje prázdná data, ne skryté položky. |
| `success` | Úspěch zobrazen až po potvrzení autoritativní vrstvy. |
| `partial success` | Lokální soubor zůstává dostupný, chybná část má samostatnou opravu. |
| `recoverable error` | Chyba má konkrétní další akci a zachována jsou původní data. |
| `fatal/unavailable` | Funkce je zablokována s důvodem; zbytek aplikace zůstává dostupný. |
| `timeout/offline` | Fronta zachová nahrávku a nabídne obnovení spojení/nový pokus. |
| `invalid input` | Pole ukáže problém před zápisem nebo odesláním. |
| `conflict/concurrency` | Dvojklik nevyvolá druhý zápis; změnu stavu řídí jediná autorita. |
| `forbidden/redacted` | Cizí vlastník ani neveřejná identita nejsou odhaleny. |
| `disabled/degraded` | LuTrack je viditelný, ale neinteraktivní a označený „Připravujeme“. |
| `retry/rollback` | Opakování použije existující idempotentní tok; selhání neodstraní lokální kopii. |
| `archived/superseded` | Předchozí koncept zůstává uložen; současná aplikace se řídí touto schválenou Astrou. |

## Oprávnění

| role | nahrávání | lokální akce | serverové akce | LuTrack |
|---|---|---|---|---|
| přihlášený vlastník | spustit/zastavit po oprávnění OS | ukázat, uložit, bezpečně smazat | odeslat/ověřit dle existujícího souhlasu | žádná |
| odhlášený uživatel | pouze stav a přihlášení | čtení zachovaných lokálních položek podle stávajících pravidel | zakázáno | žádná |
| renderer | pouze přes povolené IPC | pouze whitelisted akce | žádné přímé serverové tajemství | žádná |

## Opakování, souběh a degradace

- Dvojité kliknutí nesmí vytvořit druhý záznam ani druhý upload; stávající fronta a idempotence zůstávají zdrojem pravdy.
- Pád rendereru ani aplikace nesmí odstranit rozpracovaný soubor; po restartu se zobrazí skutečný stav obnovy.
- Bez sítě, po vypršení session nebo při serverovém limitu zůstává místní soubor dostupný a uživatel vidí důvod čekání.
- Neaktivní LuTrack nikdy nevytváří časový úsek, záznam ani požadavek.

## Nevyřešené body

Žádné behaviorální otázky neblokují implementaci. Pokud skutečná aplikace pro přesnou akci nemá podporované IPC/API, dokumentuje se jako omezení a nepředstírá se její dokončení.
