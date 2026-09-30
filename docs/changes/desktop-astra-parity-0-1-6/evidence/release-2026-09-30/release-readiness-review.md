---
kind: review
ref: d4428a1f67fe0aaa7171977f2ce83cd982981b18
verdict: "🧪 zelené testy"
measuredAt: 2026-09-30T00:17:00Z
scope: [nezávislé review připravenosti runtime a obnovy nevydaného tagu]
measuredFrom:
  - zdrojový diff efb58cc..d4428a1 a archivované testové výpisy
  - release workflow a lokální tag objekt; vzdálené ověření reviewer nemohl provést
---

# Read-only kontrola obnovení vydání 0.1.6

**Verdikt:** V cíleném zdrojovém diffu `efb58cc..d4428a1f67fe0aaa7171977f2ce83cd982981b18` nevidím novou P1/P2 regresi. Publikace zatím nemá hotovou bránu: CI `36649216434` podle zadání běží a fyzická Mac přejímka čeká na Dana. Stav GitHubu a vzdáleného tagu jsem nemohl nezávisle načíst, protože prostředí nedokázalo přeložit `api.github.com` ani `github.com`.

Zdrojová změna je omezená na pin Electronu `43.7.6` v `package.json`/locku, přesun čtení encrypted identity před dotaz na Keychain při prázdném profilu (`electron/main.cjs`), synchronizaci CDP hit-testu po scrollu a aserci otevření detailu (`scripts/astra-design-e2e.mjs`), nový auth test a mapu minima macOS 12 pro Electron 43. Release workflow je proti `efb58cc` beze změny: `setup-node` používá Node 22, potom `npm ci`, stejný `npm run gates`, sestavení médií, podpis/notarizace, archiv, publikace a ověření. Workflow se spouští při push tagu `v*` a má `cancel-in-progress: false`.

Verzovaný nový důkaz `evidence/acceptance-electron43-2026-09-30/` obsahuje `gates-final.txt` s exit 0 (78 souborů, 1 582 PASS, 3 původní skipy), dvě po sobě jdoucí skutečné Electron main/preload E2E s exit 0, 12 skupinami a 35 podmínkami, a oddělené stavové E2E 18/18. Screenshoty mají stav `CAPTURED`; nezávislé vizuální review přijímá 10 párů podmíněně, bez nároku na pixelovou shodu. Archiv zachovává původní selhání i full `npm audit` exit 1 pro devtoolchain (`undici`/Vitest); netvrdí fyzický zvuk, OAuth/upload ani instalaci. `git diff --check efb58cc..d4428a1` hlásí whitespace v archivovaném `gates.txt` a generovaném `progress/index.html`, nikoli ve zdrojovém diffu; jde o dokumentační hygienu, nikoli o P1/P2 runtime nález.

**Bezpečný retarget dosud nepublikovaného tagu:** lokální `v0.1.6` je anotovaný tag object `bc749378626eb01a2cf3bbd6e8a36f2d7bfe6ea6`, míří na commit `a6a12e863bf18075567f627ab14679112dc1678b`. Před jakoukoli změnou ověřit přímo vzdálený ref, stav runu `36645632382` (canceled před podpisem/publikací), absenci veřejné 0.1.6 verze/artefaktů a feed 0.1.5; publikovaný tag se nemění. Po zeleném CI a požadované lidské přejímce připravit anotovaný tag `v0.1.6` na přesném commitu `d4428a1`, a vzdálený ref vyměnit pouze s `--force-with-lease=refs/tags/v0.1.6:<ověřený starý object id>`. Pokud se vzdálený ref nebo publikační stav mezitím změní, zastavit. Nový tagový push spustí release workflow; vydání uzavřít až po podepsání/notarizaci, publikaci a ověření feedu/artefaktů v tomto runu.

Poznámka koordinátora po reportu: vzdálený ref, nepublikované soubory a CI byly nezávisle ověřeny příkazy v sousedních JSON výpisech. Tag míří na skutečný merge commit ba0adfe50eae12cf1d3dcb81e6b851ef351237d2. Fyzická Mac přejímka je podle původního zadání následný lidský krok, nikoli předstíraný automatický důkaz. Publikovaný tag se již nebude měnit.
