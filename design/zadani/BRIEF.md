# Funkční brief — autoritativní

> ZÁLOHA opsaná 1. 9. 2026 z Claude Designu, projekt „LuDone Přístroj Design System"
> (c5ee8498), cesta `ui_kits/ludone-desktop/reference/BRIEF.md`. Doslovně, beze změn.

> Zdroj: `luplaud-vyzkum/vystup/04-ekosystem-a-pocet-appek.md`, oddíl 6 „Zadání pro design" (20. 8. 2026).
> **Tohle je závazné zadání.** Vizuální návrhy ve složce `reference/` jsou podklad k porovnání, ne schválené zadání.

## 🔴 Závazná korekce (24. 8. 2026)

LuTrack a nahrávání jsou **dvě samostatné agendy s nezávislým životním cyklem**. Mohou sdílet shell,
kalendářní doporučení a projektový kontext, ale **nejsou jedna společná relace**.

Důsledek pro návrhy: Ekosystém i Hybrid v původní podobě modelovaly jednu relaci s jedním startem
a jedním stopem — to tahle korekce ruší. Návrh z první session agendy odděloval už dřív.

Další závazná pravidla: desktop je samostatná Electron aplikace a spouštěč, ne náhrada webového LuDone ·
archiv, přepisy, hledání a dashboardy zůstávají v app.ludone.cz · LuTrack dlouhodobě běží a během dne
mění projekt · nahrávání se zapíná jen pro vybrané schůzky · nahrávání má oddělený mikrofon a systémový
zvuk · Electron a zachycení obou stop jsou reálně ověřené · vizuální směr je LuDone DS, ne generický
macOS vzhled · primární je menu bar/kompaktní panel, plné okno slouží pro dnešní práci a nastavení.

---

## 6. Zadání pro design

### Vizuální a navigační základ

Navrhnout **macOS aplikaci LuDone**, ne web vložený do okna. Zachovat identitu LuDone a přenést
tokeny/komponentové principy, ne celý webový sidebar. Web má 240/64px skupinový sidebar a 56px
topbar. Desktop má respektovat prostor macOS traffic lights a umět compact sidebar, ale v první
verzi obsahuje jen:

```text
Dnes
Záznamy
────────
Nastavení
profil + stav spojení
```

Po vydání Času:

```text
Dnes
Záznamy
Čas
────────
Nastavení
profil + stav spojení
```

Nevykreslovat předem disabled „Čas již brzy". Designer má dodat budoucí variantu layoutu, ale
produkční app ji ukáže až s funkčním modulem. Všechny složité položky se otevírají v systémovém
prohlížeči přes viditelně označený externí odkaz.

Vycházet z LuDone design systému: Brockmann pro nadpisy, Public Sans pro text, sémantické OKLCH
tokeny, čtyřpixelový grid, malý radius, light/professional/dark témata a stavové komponenty.
Fonty pro desktop zabalit lokálně, aby shell nepotřeboval síť. Stav nikdy nesdělovat jen barvou;
počítat s klávesnicí, VoiceOver a reduced motion.

### Obrazovky a povinné prvky

#### 1. Přihlášení

- logo LuDone, název „LuDone pro Mac" a jedna věta, co aplikace dělá;
- primární tlačítko **Přihlásit přes app.ludone.cz** s vysvětlením, že se otevře prohlížeč;
- stav po návratu „Přihlašování dokončeno / vypršelo / účet nemá přístup";
- žádný vložený Google formulář, pole pro MCP token ani kopírování cookies;
- po přihlášení ukázat jméno, e-mail, prostředí a název registrovaného zařízení.

#### 2. První spuštění a oprávnění

- samostatné kroky **Mikrofon** a **Systémový zvuk**, každý se stavem Neověřeno / Povoleno /
  Zamítnuto a tlačítkem Otevřít nastavení;
- případný krok Záznam obrazovky až tehdy, pokud jej potvrdí fyzický Electron pokus; otevřeně
  napsat, že obraz se neukládá;
- závěrečný **Test záznamu** se dvěma pojmenovanými měřáky „Mikrofon" a „Ostatní zvuk", výběrem
  mikrofonu, přehráním zkoušky a výsledkem;
- nelze ukázat zelené „Připraveno", pokud jeden kanál nedává ověřené bloky.

#### 3. Dnes

- horní karta aktivního stavu: nahrávání a později samostatný timer; obě aktivity mohou běžet
  současně;
- sekce **Dnešní schůzky**: čas, název, účast/stav záznamu, tlačítko Nahrávat a Importovat audio;
- sekce **Moje práce**: maximálně pět karet s typem, názvem, stavem a „Otevřít v LuDone";
- sekce **Upozornění**: počet nepřečtených, tři až pět položek, označit vlastní jako přečtené;
- inline **Rychlý zápis** s volitelnou vazbou na schůzku/projekt a explicitním stavem synchronizace;
- footer se stavem serveru, počtem čekajících operací a poslední synchronizací;
- varianty normal, prázdný den, offline s cache a RBAC bez dostupného zdroje.

#### 4. Záznamy – seznam

- primární akce **Nahrávat** a sekundární **Importovat audio**;
- řádky/karty: název, datum/čas, délka, zdroj (schůzka/import), lokální stav, upload, serverové
  zpracování a vlastník;
- filtry alespoň Vše / Čeká místně / Odesílá se / Zpracovává se / Hotovo / Chyba;
- hledání jen nad serverovým kontraktem nebo jasně označenou lokální sadou, ne falešně nad celým
  archivem;
- akce Zkusit znovu, Ukázat ve Finderu a Otevřít v LuDone podle stavu.

#### 5. Aktivní nahrávání

- výrazný čas, název schůzky a zdroj spuštění (ručně/detekováno);
- dva živé měřáky se jmény, zvolená zařízení a rostoucí velikost místního souboru;
- jasné stavy `Starting`, `Capturing`, `Degraded`, `Finalizing`; ne jediný boolean „nahrávám";
- dominantní **Ukončit a uložit**, nebezpečné opuštění s potvrzením;
- degradace přesně řekne „chybí mikrofon" nebo „chybí ostatní zvuk" a nabídne volbu pokračovat
  jen po vědomém potvrzení;
- místo pro krátké poznámky ke schůzce, ale žádný plný editor přepisu.

#### 6. Detail záznamu a fronta

- lokální soubor, hash/velikost uživatelsky zjednodušeně, upload progress, další pokus a stav
  serveru Accepted / Přepis / Souhrn / Hotovo / Selhalo;
- název, účastníci pouze pokud je server vrátí, krátký serverový souhrn a **Otevřít celý zápis v
  LuDone**;
- retence: zda je originál ještě lokálně, kdy se smí odstranit, ruční smazání s potvrzením;
- recovery varianta po pádu a trvalá chyba bez ztráty souboru.

#### 7. Menu bar popover

- ikona mění stav bez spoléhání jen na barvu;
- idle: Nahrávat, Importovat audio, Otevřít LuDone;
- recording: délka, oba mini-měřáky, Ukončit a otevřít hlavní okno;
- později timer: projekt, elapsed, Stop / Nová činnost; recorder a timer jako dvě oddělené řádky;
- stav fronty, offline chyba a dostupná aktualizace;
- aktualizaci nikdy nenabídnout k instalaci během capture/finalizace.

#### 8. Nastavení a diagnostika

- Účet a zařízení: jméno/e-mail, prostředí, odhlásit tento Mac;
- Audio: mikrofon, test kanálů, AEC podle výsledku pokusu, odkazy na oprávnění;
- Záznamy: detekce schůzky, ignorované aplikace, lokální retence a umístění;
- Obecné: spustit po přihlášení, téma, oznámení, verze, kanál aktualizací;
- Diagnostika: architektura ARM/Intel, stavy oprávnění/capture/fronty/serveru, poslední redigované
  chyby a Export diagnostiky; nikdy audio, token, e-mail ani název schůzky v logu;
- budoucí přehled modulů ukáže pouze serverem povolené a skutečně implementované moduly.

#### 9. Budoucí Čas

- nahoře aktivní timer: projekt, popis, štítky, elapsed, zbývající alokace, Stop a Nová činnost;
- picker jen platných dnešních alokací, recent projects a návrhy popisu;
- dnešní řádky s časem, délkou, projektem, stavem sync/zámku a rychlou editací;
- ruční záznam jako sheet/dialog, upozornění na překryv a konflikt jiného zařízení;
- malý souhrn dne/týdne a externí odkaz na plný týdenní přehled;
- žádné management, sazby, cross-user admin, reopen, exporty ani Tabidoo opravny.

### Povinná sada stavů pro mockupy

Pro každou relevantní obrazovku dodat alespoň: loading, prázdno, offline, 401/session expired, 403
RBAC, opakovatelná serverová chyba, trvalá validační chyba a úspěch. Pro Záznamy navíc zamítnuté
oprávnění, jen jeden audio kanál, plný disk, přerušený upload, obnova po pádu a aktualizace čekající
na konec nahrávání. Pro Čas navíc konflikt aktivního timeru z jiného zařízení a zamčený týden.

### Co by se změnilo u dvou aplikací

Pokud se verdikt otočí, designer musí dodat dvě samostatné identity:

- **LuDone Záznamy**: Dnes jen schůzky/záznamy, audio onboarding, vlastní menu bar ikona;
- **LuDone Čas**: timer/dnešní čas, bez audio kroku a bez audio entitlementu, vlastní menu bar ikona;
- v obou zopakovat přihlášení zařízení, profil, nastavení, diagnostiku, About, update a offline stav;
- nevznikne společné Dnes ani jeden kombinovaný menu bar popover;
- deep linky a oznámení musejí jednoznačně otevřít správnou appku.

Právě tato opakovaná designová a provozní plocha je důvod, proč dvě aplikace dnes nedoporučuji.
