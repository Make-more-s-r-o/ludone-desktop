# Varianta opus — „Jedna věc teď“

Návrh inspirovaný LuDone DS, ne canonical produkční komponenty. Fiktivní data, lokální simulace.
Otevření: `index.html?scenario=idle&theme=light` (bez buildu, bez sítě). Scénáře: `idle`, `recording`, `saved`,
`blocked-company`, `update` (panel 366 px) a `uploading`, `retry`, `settings`, `identity`, `detail` (okno 448 × 676).

## Nosná myšlenka

Panel v každé chvíli odpovídá jednou větou na otázku „co se děje“ a nabízí jednu hlavní akci.
Pod ní je vždy vidět, **kam** nahrávka odejde: firma a účet leží přímo v panelu, ne v Nastavení → Účet.
Chybějící firma se proto nedá přehlédnout a opravuje se na místě, kde člověk chce odeslat. Každá nahrávka
nese čtyřkrokovou stopu **Na Macu → Ve frontě → Odesláno → Ověřeno**, takže čtyři odlišné skutečnosti
nesplývají ani barvou, ani slovem. Zvukové zdroje jsou pojmenované podle toho, co znamenají
(„Tvůj hlas“, „Druhá strana hovoru“), stereo kanál je jen drobná značka L/R.

## Mapa: současná akce → nové místo

| 0.1.4 | Návrh |
|---|---|
| Nahrát | Panel, hlavní tlačítko pod stavem zdrojů |
| Běh obou zdrojů a čas | Panel: velký čas, dva řádky L/R s měřidlem a slovem „Slyším“ / „Přerušeno“ |
| Ztráta systémového zvuku, „Pokračovat“ | Panel: upozornění pod zdroji, „Zkusit obnovit“ + věta „nebo ukonči a ulož“ |
| Ukončit a uložit | Panel, hlavní tlačítko (drží se viditelné i při dlouhém obsahu) |
| Název po stopu, Uložit a odeslat / Nechat na Macu | Panel „Pojmenuj a pošli“: pole, cíl odeslání, dvě tlačítka s větou o výsledku pod každým |
| Firma (Nastavení → Účet) | Panel: řádek „Odešle se do …“ s „Změnit“; při chybějící firmě výběr přímo v panelu. Také Nastavení → Účet a firma |
| Stav fronty v patičce + karta fronty | Panel: sekce „Odesílání“ jen s tím, co běží nebo čeká na tebe, s přímou opravou (Obnovit přihlášení, Zkusit znovu, Vybrat firmu) |
| Nastavení → Nahrávky (lokální přehled) | Nastavení → Nahrávky (první záložka), stopa čtyř kroků u každé položky |
| Obnovit přehled | Nahrávky, vpravo v hlavičce seznamu |
| Uložit a odeslat / Zkusit znovu / Ověřit v LuDone / Otevřít v LuDone | Nahrávky, tlačítko podle stavu položky |
| Ukázat ve Finderu / Přesunout do koše | Nahrávky, „Další“ u položky; koš má potvrzení s názvem a údaji konkrétní nahrávky |
| Převzít pod svůj účet | Nahrávky, u položky jiného účtu; potvrzení jmenuje položku a říká, že převzetí neodesílá |
| Záznamy (retence) | Nahrávky → „Uchovávání na Macu“ (souvisí se stejnými soubory) |
| Přihlášení, Odhlásit tento Mac | Nastavení → Účet a firma |
| Dock, spouštění po přihlášení | Nastavení → Účet a firma → Tento Mac |
| Oprávnění, zdroje, zkouška zvuku | Nastavení → Zvuk |
| Automaticky odesílat nové nahrávky | Nastavení → Zvuk → Po uložení nahrávky |
| Diagnostika, export | Nastavení → Pokročilé |
| Prostředí produkce / labs | Nastavení → Pokročilé → Prostředí serveru (s potvrzením odhlášení) |
| Zkontrolovat aktualizace | Nastavení → Pokročilé → Aktualizace; nalezená verze → „Zobrazit nabídku“ → nabídka v panelu |
| Proužek aktualizace, Aktualizovat / Později | Panel nahoře; po „Později“ zůstane odkaz v patičce panelu |
| LuTrack karta | Jeden tichý řádek „LuTrack · ukázka“ s vysvětlením, že nic neukládá |
| Zavřít nastavení (vlastní křížek) | Nativní semafor okna (`titleBarStyle: hiddenInset`) + „Hotovo“ v patičce |
| Karta nahrávky v přehledu | Název nahrávky otevírá detail: místní kopie a stav v LuDone odděleně, akce podle stavu, návrat „Všechny nahrávky“ |

Pět záložek 0.1.4 je sloučeno do čtyř (Nahrávky · Účet a firma · Zvuk · Pokročilé); žádná akce nezmizela.

## macOS jako celek (dodatek)

- **Panel × okno.** Panel v liště nemá rám ani semafor a nese jen „co teď“. Okno Nastavení a detailu má nativní
  semafor vlevo nahoře a panelovou lištu záložek s ikonami jako nastavení aplikací v macOS; titulek je v titulkovém
  pruhu, hlavní akce nejsou schované za ozdobami. Kolečka semaforu jsou v prototypu jen zástupný obrázek; v aplikaci
  je kreslí systém (dnes je okno `frame: false`, návrh počítá s `hiddenInset`).
- **Ikona aplikace** (`assets/app-icon.svg`, `app-icon-small.svg`): dnešní pulz LuDone (`M4 18 L10 6 L14 14 L20 9`)
  na tmavém čtverci jako v současném `LuDone.icns`, nově s červenou tečkou nahrávání. Plochá, bez přechodů,
  zjednodušená verze pro 16 a 32 px. Tmavá/tónovaná varianta macOS a export ICNS nejsou součástí.
- **Ikona v liště** (`assets/tray-*.svg`, 18 × 18, šablona): klid = samotný pulz jako dnes; nahrávání = plný čtverec
  s vyříznutým pulzem; „potřebuje tě“ = pulz + trojúhelník; souběh s ukázkovým časovačem = plný čtverec + kroužek;
  odhlášeno = přeškrtnutí. Stav nese tvar, ne barva, takže platí na světlé i tmavé liště. Titulek s časem vedle ikony
  (`setTitle`) zůstává, jak je.
- **Detail** (`scenario=detail`, vstup kliknutím na název v Nahrávkách): název, datum, délka, velikost, cílová firma
  a účet, dva oddíly „Na tomto Macu“ a „V LuDone“, akce podle stavu (Ověřit / Otevřít v LuDone, Zkusit znovu,
  Převzít, Finder, koš s potvrzením). Žádný přepis ani přehrávač. Ukázka otevře „Týdenní domluvu“ ve stavu 42 %;
  simulací ji lze dokončit a ověřit.

## Inspirace a co z historických návrhů neplatí

- **Přebírám:** Danův vstup z 1. 9. — LuDone DS jako zdroj, Raycast (málo ovladačů, zřetelný focus), Notion (klidná
  hierarchie, postupné odkrývání — detail až po kliku). Plaud: nahrávání jako jasně dominantní krok. Z canvasů:
  ztráta stopy nahrávání nezastaví a hlásí se viditelně; fronta vždy říká důvod; „stav nikdy jen barvou“ (Lišta).
  Z návrhu `nahled.html`: panel 366, patička se stavem, název předvyplněný při stopu. Apple HIG: šablonová ikona lišty,
  mřížka ikony aplikace.
- **Neplatí a nevracím:** kalendář a blok „Dnes“, ⌘K / command palette, dashboardy, import, ruční předání na web
  („Připravit pro web“), funkční LuTrack s projekty a alokacemi, připomínky, barevně rozlišené ikony lišty,
  paleta Přístroj DS (modrofialová, tyrkys) a zaoblení 14 px — dnes platí LuDone DS s radiusem 0/2/4.
- Nesourodost značky v dnešním kódu (`LuDoneMark` má dvě podoby: „U + fajfka“ a pulz) řeším jednotně pulzem.

## Tři nejdůležitější UX změny

1. **Cíl odeslání je v panelu vždy vidět a opravuje se tam.** Chybějící firma zablokuje jen „Uložit a odeslat“,
   důvod je napsaný u tlačítka a výběr firmy je o řádek výš. Výběr firmu uloží, ale nic neodešle; odeslání je
   další výslovný klik. „Nechat na Macu“ zůstává dostupné.
2. **Čtyři stavy nahrávky jsou čtyři kroky jedné stopy.** „Odesláno“ a „Ověřeno“ nejsou stejné zelené fajfky;
   zablokovaný krok má přerušovanou linku, text a ikonu, ne jen barvu.
3. **Fronta v panelu ukazuje jen to, co vyžaduje pozornost, s opravou na místě.** Vypršelé přihlášení se obnoví
   tlačítkem v řádku, bez cesty do Nastavení. Klidové položky (jen na Macu, odeslané) panel nezahlcují.

## Co je simulace a co je nový návrh oproti 0.1.4

- Všechna data jsou fiktivní. Nic se nenahrává, neodesílá, nepřihlašuje, neotevírá ve Finderu ani v prohlížeči;
  místo toho se ukáže věta „Simulace: …“.
- Ovladače v přerušovaném rámečku („Simulace“) patří jen prototypu: výpadek zvuku z Macu, spuštění nahrávání
  u aktualizace (ukončit jde jen přes „Ukončit a uložit“) a stavy fronty (výpadek sítě, jiný účet, serverový limit). V produktu by nebyly.
- Verze 0.1.5 je ukázková nabídka, ne oznámení vydání. Jednorázové oznámení macOS prototyp nekreslí.
- Nové oproti 0.1.4: výběr firmy v panelu, sekce „Odesílání“ s přímou opravou, čtyřkroková stopa,
  sloučení Záznamů do Nahrávek a Diagnostiky s Prostředím do Pokročilých, pojmenování zdrojů podle významu.
- Automatické odesílání v návrhu po stopu přeskočí formulář a rovnou ukáže „Odesílá se“, jen když je vybraná
  firma (zapni v Nastavení → Zvuk a projdi Nahrát → Ukončit a uložit).
- Měřidla jsou animovaná smyčka, ne skutečná úroveň signálu. Segmenty měřidla a přerušovaná linka zablokovaného
  kroku používají CSS `repeating-linear-gradient` jako tvrdý vzor čárek, ne barevný přechod.
- Tokeny a fonty jsou lokální kopie společných podkladů v `assets/`; odkaz lze přepojit na `../../shared-assets/tokens.css`.

## Implementační náročnost a rizika

| Změna | Náročnost | Riziko |
|---|---|---|
| Nový panel (hierarchie, stav, cíl odeslání, sticky akce) | M | Panel hlásí výšku podle obsahu; sticky akce a vnitřní scroll je třeba sladit s `PanelContentHeightReporter`. |
| Výběr firmy v panelu | M | Dnešní výběr žije v Nastavení a načítá seznam ze serveru; panel potřebuje stejné IPC, stavy načítání/chyby a nesmí spustit odeslání starých položek. |
| Sekce „Odesílání“ s opravou v řádku | M | Stavy fronty se dnes skládají z `queue.js` a `recordings-dashboard.cjs`; mapování na krátké věty musí zůstat pravdivé (hlavně vlastnictví a limit). |
| Čtyřkroková stopa v Nahrávkách | S–M | „Ověřeno“ závisí na ručním ověření a jeho limitu; stopa nesmí ukázat ověřeno z lokální domněnky. |
| Sloučení záložek Nastavení | S | Pouze přesun; pozor na testy, které hledají původní názvy záložek. |
| Obnova systémového zvuku jako „Zkusit obnovit“ | S | Jen jiný text pro existující „Pokračovat“. |
| Okno s `hiddenInset` a lištou záložek | S–M | Dnešní okno je `frame: false` s vlastním křížkem; změna rámu mění tažení okna a testy okna. |
| Detail nahrávky | M | Nová obrazovka nad existujícími daty přehledu; žádná nová data, ale akce musí použít stejné kontroly aktuálnosti („neaktuální nahrávka“). |
| Nové ikony lišty a aplikace | S | Generátor `scripts/tray-ikony.mjs` a ICNS je potřeba přegenerovat; zachovat šablonové obrázky. |

Větší rozměr není potřeba; vše je navržené pro 366 px panel a okno 448 × 676.

## Ověření (pravdivý rozsah)

Stavy podle `AGENTS.md`: automatické kontroly v prohlížeči jsou 🧪 zelené testy, ne ✅ ověřeno naostro. Nikdo z lidí
prototyp zatím neproklikal a nic neběželo na skutečném Macu.

- 🧪 Prohlížeč Chromium přes Playwright, lokální statický server: všech 10 scénářů × 3 témata (panel 366 × 640,
  navíc 366 × 460 pro osm původních; okno 448 × 676). Bez vodorovného přetečení, bez chyb v konzoli, bez rozbitých
  obrázků, hlavní akce ve viewportu.
- 🧪 Detail: vstup kliknutím ze seznamu, dokončení odesílání (simulace) → Ověřit → Ověřeno → koš s potvrzením → návrat
  na seznam; tlačítko „Všechny nahrávky“ vrací fokus na položku.
- 🧪 Klikací tok: Nahrát → nahrávání → Ukončit a uložit → Uložit a odeslat → Odesláno; Nechat na Macu;
  výběr firmy v `blocked-company` (neodešle, pak odeslání); koš s potvrzením a Escape; Zkusit znovu;
  Obnovit přihlášení; zkouška zvuku.
- 🧪 Kontrakt: query parametry, `postMessage` od rodiče včetně `identity` a `detail` (neplatné hodnoty a zprávy od
  jiného zdroje ignoruje), oznámení `ludone-design:state` rodiči i při vlastní navigaci (zkontrolováno v iframe:
  identity → detail → Nahrávky → panel), `dataset.scenario` a `dataset.theme`.
- 🧪 Klávesnice: viditelný focus v pořadí Nastavení → Změnit → Nahrát → …; šipky v záložkách; Tab v dialogu.
- ⛔ Neověřeno: čtečka obrazovky, skutečné macOS okno a nativní rámeček, ikony na skutečné liště a v Docku
  (jen v prohlížeči), měření kontrastu nástrojem.
  Žádné živé audio ani produkční ověření — prototyp ho z principu nemá.
- 🧪 Oprava 23. 9. (kontrola koordinátora): Aktualizovat čeká na všechny běžící činnosti (nahrávání, ukládání
  nahrávky, ukázkový časovač LuTrack) a potvrzená aktualizace pokračuje až po jejich skončení. Simulace nahrávání
  už nejde vypnout přepínačem, jen tlačítkem „Ukončit a uložit“ s fází ukládání. Nastavení → Pokročilé →
  Zkontrolovat aktualizace nově nabízí „Zobrazit nabídku“; volba Aktualizovat / Později zůstává na člověku.
  Důkaz: `evidence/updates-review.txt` (12/12 PASS, EXIT=0) nad `evidence/updates-raw.json`; sabotáž s původním
  `app.js` obě vady reprodukovala (instalace přes běžící časovač, chybějící cesta k nabídce).
