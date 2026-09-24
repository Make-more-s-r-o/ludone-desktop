# Upřesnění ikony podle Dana a současného LuDone DS

23. 9. 2026, společné a shodné pro oba autory. Toto upřesnění má přednost před ikonovou částí původního briefu (zejména před odkazem na pulz nebo historický monogram).

Dan chce ikonu shodnou se zbytkem LuDone, případně s jemným rozlišením Desktopu. Katalog DS doporučuje dodané originály v `public/brand/`. Jako základ použijte přiložený **LuDone.svg**, případně původní iOS PNG pro náhled zaoblené ikony. Původní bílé geometrické tahy na černém podkladu zachovejte přesně; nepřekreslujte je jako pulz, novou značku nebo obecnou fajfku.

V obrazovce Identity nabídněte přinejmenším dvě porovnatelné možnosti: (1) původní ikona LuDone beze změny, označení „LuDone Desktop“ vedle; (2) tatáž značka s drobným desktopovým rozlišením, které nezhorší čitelnost. Doporučení mezi nimi zdůvodněte stručně. Není potřeba další velká designová větev ani generování bitmap nového loga.

Dock ikona je statická. Ikony horní lišty pro čas, nahrávání, obojí a pozornost řešte odděleně a ověřte čitelnost v malé velikosti. Stavy nesmí být rozlišeny jen barvou.

## Zdroje a rozpor

- Zdroj: `/Users/dan/Dev/ClaudeCode/LuDone/ludone-app/public/brand/`.
- Pravidlo originálů: `docs/design-system/public-brand.md` a katalog `src/app/(preview)/ds-preview/brand/assets.ts` ve stejném repozitáři.
- `public/brand/ludone-derivatives/` jsou historické návrhy, nikoliv doporučené současné logo.
- Aktuální webové `public/favicon.svg` a `src/components/ludone-logo.tsx` mají odlišnou modrou značku. Zaznamenáváme rozpor, ale v tomto návrhu vycházíme z dodaných originálů katalogu DS. Web ani jeho značku neměníme.
- Kopie souborů jsou v `shared-assets/brand/`; autoři si je mohou zkopírovat do vlastních `assets/`.

## SHA-256 zdrojů

- `LuDone.svg`: `dd15c49cb35f53b3d08e9a0b72ccb9378630df44493022557d82ac8a60d9f06a`
- `LuDone-icon-iOS-Default-1024x1024@1x.png`: `9c9572c4676fc721ceae4a46c7e7411273623209b2343828557d6050618a62fb`
- `LuDone_favicon_32px.png`: `96cd05a3dbea48da8fae3dcacb865f0c8a126ad0566a5365f77d065ab1d1782c`
- `LuDone_favicon_128px.png`: `051645ba22427c6b564235c22ec0b91e08ee18e07c9e32762fdbc9bf868e0e28`
