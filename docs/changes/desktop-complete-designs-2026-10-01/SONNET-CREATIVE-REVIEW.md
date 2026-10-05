# Druhý průchod F · Osa a G · Příkaz

Autor: Sonnet 5.5, 2. 10. 2026. Jen makety. `app.js` ani původní návrhy jsem neměnil. Upravil jsem čtyři povolené soubory: `design/sonnet-f.css`, `design/sonnet-f-layout.js`, `design/sonnet-g.css`, `design/sonnet-g-layout.js`.

## Stav ověření

- ⛔ **Nic jsem nespustil v prohlížeči.** Je to jen čtení a psaní kódu. Žádné tvrzení o vzhledu, kontrastu, kontejnerových dotazech ani chování na kliknutí není ověřené. Vše níže čeká na browser QA koordinátora.
- ✅ **Skutečný skill jsem přečetl** (`references/frontend-design-skill.md`) a oba návrhy jsem proti němu zkontroloval.
- ✅ **`references/integration-app.js` jsem přečetl celý.** Hooky se volají na konci každého `render()`. `.content` se při každém renderu přestaví celé, proto jsou hooky idempotentní a nové uzly vznikají znovu.
- ⚠️ **Povinná čtení jsem nedokončil.** Přečetl jsem celý AGENTS.md, prvních 40 řádků ROZHODNUTI.md (včetně A14) a začátek DAN-TODO.md. PLAN.md jsem nečetl. Návrhový checkpoint na konci DAN-TODO.md jsem nenašel: soubor má přes 44 000 tokenů a stihl jsem jen dva úseky z jeho začátku. Pokud checkpoint obsahuje omezení, která tu chybí, je třeba je doplnit.

## Co jsem opravil

### Písmo (obě)
Nativní systémové písmo má přednost před starým výtvarným směrem. Do obou souborů jsem přidal `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui` na `body` a na `button, input, select, textarea`. Ovládací prvky tak nezdědí jiné písmo ze sdíleného CSS. Číslice jsou tabulární (`font-variant-numeric`).

F měla čas nahrávání v SF Mono. To je i podle skillu „šablonový" znak (monospace pro malé datové popisky), takže čas je teď v systémovém písmu s tabulárními číslicemi. Stará zmínka o SF Mono v plánu je tím překonaná.

### F: uzel nesmí naznačovat ověřený server
Příčina: `.badge.sent` znamená stav „Odesláno · neověřeno", ale CSS ho barvilo akcentem. Uzel řádku i stanice v detailu tak vypadaly jako potvrzené.
- Hook `verified()` přidá třídu `is-verified` jen badgi, jehož text začíná `V LuDone · ověřeno`. Text je zdroj pravdy.
- Uzel řádku „odesláno, neověřeno" je prázdný kroužek v šedé. Plný akcent má jen `is-verified`.
- Badge v řádku a v hlavičce detailu je u neověřeného neutrální (`surface-alt` s textovou barvou).
- Stanice v detailu mají `data-station`. Server: `ok-verified` jen při textu `Dokončeno · ověřeno`, `error` při „Na serveru nenalezeno", jinak `pending` (šedý kroužek). Mac: `error` při „chybí / není úplný / není k dispozici", jinak `ok`.
- Uzel ve frontě „běží" měl akcent (podobný zelené). Je teď v barvě textu, protože odesílání není výsledek.

### G: stejné riziko, i když ho brief jmenoval jen u F
G měla `.badge.sent` zelený (`--ok`) i u „Odesláno · neověřeno". Stejná oprava: v řádku a v hlavičce detailu je neutrální `--muted`, zelený je jen `is-verified`. Zelený zůstal u jiných `sent` badgí (např. „Povoleno" v nastavení), protože to jsou skutečně potvrzené fakty.

Počet čekajících ve frontě (`.g-count`) byl červený, ale čeká i vše bez chyby. Je teď v barvě textu.

### G: souhrn „komu a s jakým přístupem" u odeslání
Hook `summary()` vloží pod akce draftu jeden řádek. Čte `#target-company` a `#visibility` z DOM a nic nezapisuje do state. Formát je „**Uložit a odeslat: Ateliér Sever s.r.o. · Sdílená ve firmě.** Nechat na Macu nic neodešle." Bez vybrané firmy říká „firma není vybraná" a zčervená. Přístup se bere z textu existující volby, takže odpovídá `Soukromá · jen pro vás` i `Sdílená ve firmě`. Řádek se přepíše při každém renderu a app.js po změně selectu volá `render()`, takže zůstává aktuální. Obě původní selecty zůstaly viditelné, tlačítko „Nechat na Macu" také a `disabled` jsem nezměnil. Řádek má `aria-live="polite"`.

### G: historie při nahrávání
`facets()` dělalo `content.prepend(wrap)`, takže `g-lib` skončil před `live-strip`. Nově se vloží `strip.after(wrap)`, pokud strip existuje, takže strip zůstává prvním uzlem. Zároveň je `live-strip` v G i F `position: sticky; top: 0`. Zastavit je tedy viditelný i při posunu dlouhého seznamu. U F jsem musel nahradit průhledné pozadí stripu nepruhledným (`color-mix` s `--surface`), jinak by pod ním prosvítal obsah.

### F: akordeon v nastavení
Tlačítko každé části má `aria-expanded` (true jen u aktivní). `aria-current` zůstává. Aktivní tlačítko má `aria-controls` na `#f-settings-panel`. Šipka se otáčí podle `aria-expanded`, ne podle třídy. Obsah je jen jeden a nic se nekopíruje.

### Drobnosti
- **Fokus:** přidal jsem `:focus-visible` s outline v akcentu pro tlačítka, `summary`, inputy a selecty v obou návrzích.
- **Reduced motion:** přidal jsem pro přechod šipky v akordeonu F.
- **G `summary`:** přístupný název začíná viditelným titulkem, např. „Odesílání, 2 čeká. Přejít na jinou část LuDone". Původní `aria-label` viditelný text nezahrnoval.
- **F rail:** tlačítko Nahrávání má při nahrávání název „Nahrávání, právě se nahrává". Červená tečka byla jen vizuální.

## Svislá osa v F a její význam

Osa není sama o sobě nový UX, má tři konkrétní významy:
- **Současnost a minulost.** Na domovské obrazovce je nahrávání aktuální uzel nahoře a poslední schůzky jsou starší uzly pod ním. Při nahrávání se uzel plní červeně.
- **Mac a LuDone.** V detailu je osa vodorovná se dvěma stanicemi. Akce, které se týkají souboru (Finder, Koš), jsou u Macu. Odeslat a Ověřit jsou u LuDone.
- **Sled.** V onboardingu jsou kroky skutečně sekvence, ostatní osy číslování nepoužívají.

Zbytek (historie, fronta) je jen seznam v řádku. Svislá linka tam nese pořadí. Pokud by QA ukázala, že linka u fronty nic nevysvětluje, je to první kandidát na odstranění.

## Co plán sliboval a co je skutečně navrženo

Plán v odstavci o historii F slibuje **měsíční osu**. Renderer v app.js seskupuje **po dnech**: pro každé nové datum vloží `.day-heading` s plným datem (např. „1. října 2026"). Hook ani CSS tuto strukturu neměnily. Skutečné členění F:
- jeden uzel na den s datem jako nadpisem,
- pod ním řádky schůzek jako menší uzly,
- stránkování po 7 řádcích zůstává z app.js, takže jeden den se může rozdělit na dvě stránky.

Měsíční uzly neexistují. Poznámky (`SONNET-CREATIVE-NOTES.md`) už píšou „dny jako uzly" správně. PLAN.md a NOTES.md jsem neupravoval, protože nejsou mezi povolenými soubory. Zmínka o měsíční ose v plánu je proto nepravdivá a je třeba ji při slučování opravit.

## Kontrola proti skillu

- **Jedna výrazná myšlenka.** F má linku s uzly, G příkazový řádek. Ostatní je tiché. ✔
- **Typografie.** Systémové písmo, jedna rodina, hierarchie přes velikost a tloušťku. Žádné VŠECHNA VELKÁ ani zvýrazněné jediné slovo v nadpisu. ✔
- **Šablonové znaky.** Používám `·` ve větách z app.js (ten je sdílený, ne můj). `g-cap` popisky „Období" a „Stav" nad fazetami jsou pro historii funkční, přesto jde o „popisek nad obsahem". Ponechal jsem je, ale pokud by QA ukázala, že fazety jsou srozumitelné i bez nich, lze je odstranit.
- **Barva.** Teď nese stav jen tehdy, když to potvrzuje text. ✔
- **Pohyb.** Jediný autonomní pohyb je pulz uzlu při nahrávání v F, s ohledem na `prefers-reduced-motion`. ✔

## Co čeká na browser QA

1. **Specificita proti `menu.css` a `menu-integration.css`.** Hlavně nová pravidla pro písmo `body[…] :is(button, …)`, neutrální badge a `is-verified`.
2. **Sticky `live-strip`.** Záleží na tom, který prvek skutečně scrolluje (`.content` nebo jeho rodič) a jestli nemá `overflow` na předku. Ověřit F i G při nahrávání na stránkách Nahrávky a Odesílání a při posunu seznamu.
3. **Souhrn v G draftu.** Ověřit, že se po změně selectu aktualizuje (fokus se po `render()` může ztratit, to je chování app.js), jak vypadá při dlouhém názvu firmy a že se nevejde-li do 400 px, zalomí.
4. **Prázdný kroužek v F.** Ověřit, že se při 8 px a 2px okraji nezlije s linkou, a v tmavé i profesionální variantě.
5. **Akordeon F.** Chování `aria-expanded` a čtečka (VoiceOver). Při přepnutí části se celé nastavení vykreslí znovu, takže fokus se vrací na tlačítko jen pokud to app.js zařídí. Neověřeno.
6. **Kontrast** všech nových barev (`--muted` text v G, `--text` na `--surface-alt` v F) ve třech tématech.
7. **Detail v 400 px viewportu** a všech pět kroků onboardingu F (beze změny proti prvnímu průchodu, stále neověřeno).

## Co jsem záměrně nedělal

- Neměnil jsem app.js, původní návrhy A–E, PLAN.md, NOTES.md ani ostatní soubory.
- Nezavedl jsem nové texty mimo souhrn v G. Ten používá jen hodnoty existujících voleb a větu s významem tlačítek.
- Nepřidával jsem měsíční seskupení. Chce-li ho někdo, musí to udělat renderer v app.js, ne hook.
