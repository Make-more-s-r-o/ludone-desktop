# Druhé kolo — LuTrack a nahrávky jako jedna Mac aplikace

**Připraveno k výběru, 23. 9. 2026.** Dva klikatelné návrhy celého toku práce a schůzek. Původní autoři: A = Claude Opus 5.5, B = Astra. Závěrečné drobné opravy a sjednocení značky dokončili dva levnější Sol agenti. Jde o návrhy budoucí aplikace, nikoliv vydanou funkci.

[Otevřít porovnání](http://127.0.0.1:53289/round2/index.html?scenario=home&theme=light) · [Postup a rozdíly](VYBER.md) · [Ověření](../../../../dukazy/desktop-experience-2026-09-23/ROOT-REVIEW.md)

## Co je hotové

- **A — Dvě stopy:** práce a zvuk mají vlastní plochy; společné hledání projektu a popisu, rychlé opravy dnešního času.
- **B — Nit dne:** klidnější panel zvýrazní současnou činnost; při schůzce drží práci v kompaktním pásu, opravy výkazů předává webu.
- Oba mají souvislé ovládání, čtrnáct vstupních situací a tři témata: panel, den, detail, uložení/odeslání, opravu chyb, offline, obnovu, nastavení, aktualizaci, první použití a identitu.
- Ikony vycházejí z dodaných originálů LuDone DS. Je možné porovnat původní podobu a jemné označení Desktopu, samostatně stavy lišty.
- Porovnávač označuje autora, umí A/B/oba, reset situace, skutečné proporce panelů a oken. Při širších oknech je skládá pod sebe.

## Ověření a hranice

🧪 Syntaktické kontroly finálních souborů, shoda originálů značky, cílené review a proklik hlavních cest prošly. Astra má navíc doložený předchozí běh 42 kombinací a 51 kontrol; u Opusu se nedochoval závěrečný výpis původního kompletního běhu, proto ho nevydáváme za ověřený. Původní screenshoty před závěrečnými úpravami jsou historické. Aktuální podobu ukazuje živé HTML.

⛔ Tento běh neověřuje produkční zvuk, přihlášení, API, Finder, Dock ani skutečnou instalaci aktualizace. Všechna data a předání jsou simulovaná. Backend ani produktový kód se neměnily. 🟡 Výběr směru a rozsahu první implementace čeká na Dana.

## Podklady a další krok

[Společný brief](SHARED-BRIEF.md), [upřesnění](CLARIFICATIONS.md), [korekce ikony podle DS](ICON-ADDENDUM.md), [původ autorů](PROVENANCE.json). Podrobnosti: [Opus](variants/opus/NOTES.md) a [Astra](variants/astra/NOTES.md).

Současný LuTrack byl read-only pozorován na `ludone.cz/time-tracking` jako PWA. Starší placeholder v checkoutu nové `app.ludone.cz` neznamená, že tato PWA neexistuje. Před skutečnou desktopovou integrací je nutné ověřit její rozhraní a pravidla synchronizace. Volba návrhu sama neschvaluje nové funkce ani zásah do serveru.

Ukázky používají fiktivní data; osobní screenshot a živé pracovní údaje nejsou součástí podkladů. Fonty Brockmann jsou pouze lokální a mimo Git. Návrhy nejsou veřejně publikované.

## Opětovné spuštění místního náhledu

V kořeni tohoto izolovaného worktree spustit:

```sh
python3 -m http.server 53289 --bind 127.0.0.1 --directory docs/changes/desktop-redesign-2026-09-23
```

Potom otevřít výše uvedené porovnání. Přímé otevření přes `file:` není podporované porovnávačem, protože načítá manifesty. Samostatné prototypy jsou čisté HTML bez buildu.
