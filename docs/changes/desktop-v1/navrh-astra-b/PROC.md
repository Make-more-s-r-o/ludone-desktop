# Proč takhle — Astra B

6. září 2026 · Alternativa k [Astře A](../navrh-astra/nahled.html), nikoli její další verze.
[Otevřít náhled](nahled.html). **34 stejných stavů:** 24 panelů/menu a 10 stavů ikony;
stejná čísla 01–24 a identifikátory umožňují přímé porovnání. Všechna data jsou ukázková.

## Co měním a kolik to stojí

Volím **dvě poloviny jedné plochy**: nahrávání vlevo, čas vpravo. Chci vyzkoušet, zda
člověk při souběhu rychleji porovná obě agendy vedle sebe. Není to změřený přínos.
Po stopu se plocha uvolní pro pojmenování; stav i zastavení běžícího času zůstanou nahoře.

| Rozhodnutí proti Astře A | Co uživatel získá | Co ztratí |
|---|---|---|
| Dva sloupce místo dvou agend nad sebou; bez opakovaného stavového pásu v hlavních stavech | Časy a tlačítka Stop jsou na stejné úrovni. Souběh nepřidá druhou kartu pod první. | Agenda má asi 154 bodů na obsah. Dlouhý projekt a výpadek zvuku vyžadují více řádků; při jednom běhu sousední sloupec zůstává řidší. |
| Velká proporční čísla s jednotkami; nahrávka `12 min / 41 s`, práce `0 h / 37 m` | Rozdíl mezi délkou nahrávky a pracovním časem je výslovný. | Ztratí se úspornost běžného zápisu `12:41`. Dvě řádky vyžadují delší pohled; čas zde není průběh dne ani kalendář. |
| Svislé segmenty hladiny místo vlnek | Levý a pravý kanál zůstanou vedle sebe i v půlce panelu. Šrafovaný nepřipojený systém vypadá jinak než přítomný zdroj bez signálu. | Stupnice je hrubší a drobnější. Neposkytuje historii, přesné dB ani důkaz správného záznamu. |
| Chladná bílá/grafit, oranžové nahrávání, fialový čas, Helvetica Neue; rovné hrany a dělicí čáry | Význam se opírá o sloupec, název a tvar. Méně vnořených rámečků, větší váha číslic. | Zmizí měkčí charakter první varianty. Tmavý motiv s výraznou hlavní akcí může víc přitahovat pozornost. Systémové písmo se vzdaluje písmům LuDone DS stejně jako v A. |
| Fronta nahoře; nastavení s levým rejstříkem | Neodeslané věci jsou blízko vstupu. Čtyři části nastavení mají vlastní svislou navigaci. | I prázdná fronta zabírá horní prostor. Rejstřík ubere 83 bodů obsahu nastavení; e-mail a diagnostika se častěji zalomí. |
| Jeden dělený znak lišty místo dvou volných kruhů | Ikona připomíná dvě poloviny panelu; oba běhy se čtou bez barvy. | Znak má 34 bodů, s odznakem 48 (A: 32/43). Je širší a pomlčka proti ručičkám se musí naučit. Přesný čas stále vyžaduje otevřít panel. |

## Co první návrh dělá líp

**Astra A lépe čte delší obsah.** Projekt i varování mají celou šířku. Význam hodinové
ikony je známější, vlnky jsou větší a samostatné nahrávání využívá prostor účelněji.
V nastavení se dlouhá hodnota vejde snáz. A bych volila při častých poruchách zvuku,
dlouhých názvech projektů nebo horším zraku; B stojí za zkoušku hlavně při souběhu.

Funkce nepřibývají: zůstává pojmenování při stopu, nabídka zastavit čas zvlášť,
fronta neodeslaných, ruční webové předání, oprávnění se zkouškou, čtyři části nastavení,
menu a náhradní přístup přes Dock/zkratku/Spotlight. Kalendář, archiv, hledání v záznamech,
přehledy a přepisy se nevracejí. Připomínky zůstávají odložené.

## Nejistoty a rozpory

- **[Spec](../spec.md) §8 versus [BD-N34](../decisions.md):** automatické doručení proti ručnímu předání. Podle zadání kreslím prohlížeč. Jak desktop získá potvrzení přijetí a začátek retence, podklady neuzavírají. Export frontu nevyprázdní.
- **C3/BD-N38 versus celé vykazování ve specu:** čas zůstává zkouškou na Macu. Pravidla projektů určí server (BD-N28); nevymýšlím nabídku ani alokace. Odhlášení za souběhu a vlastnictví čekajících položek při změně účtu zůstávají otevřené, stejně jako přiřazení na sdíleném zařízení.
- **M17 versus zadání alternativy:** měním rozvržení klidových řádků, ne rozsah funkcí. Spec §7 chce šablonovou ikonu, `Lista.dc.html` barvy; tady zachovávám tvarové rozlišení A. M pro zvolený mikrofon a ! pro výpadek mají stejný význam jako v A.
- **Ověřit s Danem:** rozeznání obou běhů a zastavení pouze nahrávání, také bez barev; dlouhé názvy, nejvyšší panel na malé ploše, dostupnost akcí při rolování, znak při 1×/2× a panel bez viditelné ikony. Desetisekundová nabídka z A zůstává návrhem, nikoli naměřeným prahem.

**Ověření:** 🧪 kontroly HTML a místních interakcí popisuje [OVERENI.txt](OVERENI.txt).
⛔ skutečné vykreslení, geometrie, zvuk a nativní chování na Macu neověřeno.
Samostatný Chrome se ukončil před snímkem. Projektový Electron se nespouštěl.
