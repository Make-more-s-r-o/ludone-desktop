# Rozhodnutí — LuDone Desktop 0.1.6

## D1 — Implementovat celý schválený návrh Astra „Nit dne“

- **Kdo:** Dan, nejprve volbou Astra a následným výslovným pokynem implementovat návrh samostatně.
- **Volba:** Předělat skutečný desktopový tok tak, aby odpovídal celé variantě B; nejde jen o ikonu a vstup na stránku Nahrávky.
- **Důkaz:** `round2/variants/astra/manifest.json`, `FINALIZATION.md` a uživatelské zprávy z 23.–24. 9. 2026.

## D2 — LuTrack zůstává pouze připraveným placeholderem

- **Kdo:** Dan, pokynem „LuTrack ještě neexistuje… zatím teda neimplementuj“.
- **Volba:** Žádný lokální časovač, časové zápisy, synchronizace ani propojení s `app.ludone.cz`; UI musí pravdivě říct, že funkce není připravena.

## D3 — Produktová data nejsou data prototypu

- **Kdo:** Bezpečný výchozí stav vyplývající z účelu schválené makety a současných API.
- **Volba:** Ve skutečné aplikaci se zobrazují pouze dostupné lokální/frontové/serverem ověřené údaje. Demo jména, časové úseky ani úspěšné stavy se nepřebírají.

## D4 — Před dalším vydáním musí projít designová E2E brána

- **Kdo:** Dan, aktuálním výslovným pokynem.
- **Volba:** Ověřit skutečně sestavený desktopový renderer a klíčové cesty, uložit screenshoty a porovnat je se schváleným návrhem. Bez tohoto důkazu se nevytváří release tag ani publikace.

## D5 — Zachovat serverové a IPC hranice

- **Kdo:** Projektová bezpečnostní pravidla.
- **Volba:** Neměnit backend, LuTrack ani cizí `design/`; nepřidávat nové pravomoci rendereru. Jestli UI vyžaduje novou capability nebo API, zůstává dotčená část blokovaná a výsledek se nezamlčí.

## D6 — Před publikací opravit Electron runtime

- **Kdo:** Koordinátor, 30. 9. 2026, bezpečný technický výchozí stav v mandátu samostatně dokončit a vydat desktop.
- **Volba:** Připnout Electron na podporovanou stabilní verzi 43.7.6 místo 39.8.10. Řada 41 s opravami již má ukončenou podporu; nejnovější major 44 zvyšuje minimum na macOS 13, kdežto 43 zachovává stávající macOS 12. UI, nahrávací konfigurace a bezpečnostní hranice se nemění.
- **Důvod:** Čtyři zveřejněné high nálezy zasahují původní runtime, přestože je npm balíček vedený jako devDependency. Instalovaná aplikace binárku Electronu používá. Úplná nedosažitelnost nálezů nebyla dokázaná.
- **Zdroje:** [Electron 43.7.6](https://github.com/electron/electron/releases/tag/v43.7.6), [podpora](https://www.electronjs.org/docs/latest/tutorial/electron-timelines), [minimum macOS](https://www.electronjs.org/docs/latest/breaking-changes/#removed-macos-12-support), [popup sandbox](https://github.com/electron/electron/security/advisories/GHSA-hq2x-r82h-9wj4), [dědičnost sandboxu](https://github.com/electron/electron/security/advisories/GHSA-gr2m-v5gq-v685), [protokoly](https://github.com/electron/electron/security/advisories/GHSA-j84w-jfhq-vhvj), [webview worker](https://github.com/electron/electron/security/advisories/GHSA-9qh4-3jw8-366w).
- **Přejímka:** Zopakovat plné gates a oba Electron E2E běhy, nezávisle reviewovat diff a podepsané macOS balení. Tabulka známých minim v testu se rozšiřuje o doložený major, žádná assertion ani skip se nemění. Skutečný zvuk a instalaci nadále ověřuje Dan na svém Macu; stará měření nepotvrzují nový runtime.

## D7 — Prázdné přihlášení nesmí oslovovat Klíčenku

- **Kdo:** Koordinátor a Sol v izolovaném worktree, 30. 9. 2026; nezávislé security review bez P1/P2.
- **Volba:** Nejprve načíst šifrovaný soubor relace. ENOENT znamená nepřihlášený profil a vrací null. Jen existující blob vyžaduje původní kontrolu safeStorage a dešifrování; ostatní chyby zůstávají fail-closed.
- **Důvod:** Skutečný E2E nový unsigned Electron čekal v macOS Keychain i při profilu bez identity. Dva neúspěšné běhy a nativní profil zůstávají v důkazech. Test nesmí vyžadovat přístup k uživatelově Klíčence, když nemá co dešifrovat.
- **Mantinely:** Žádný mock Keychain, nové E2E oprávnění, změna timeoutu, formátu tokenů, šifrování, IPC nebo serveru. Logout a generation kontrola zůstávají. Devět nových testů ověřuje prázdný profil, existující blob a zamítnutí chybných stavů; celá existující queue-wiring sada prošla.

## D8 — Dále vylepšit schválenou Astru jako produkt

- **Kdo:** Dan, přímý pokyn 30. 9. 2026: „schválená astra ok, ale ještě vylepšit. Jako produktový designer z Notionu / apple / Plaud.“
- **Volba:** Samostatně provést úplný audit a implementovat kvalitativní dotažení nad schváleným základem. Hlavní priorita je srozumitelný panel, denní historie, funkční přechody, stavové a bezpečné akce; nejde o pixelovou neměnnost prototypu.
- **Mantinely:** Původní návrhy zachovat, značku a Opus ikony ponechat, backend a LuTrack nezapojovat. Osobní nahrávky, soukromé screenshoty a přihlášení se nepoužijí jako veřejná testovací data.
- **Ověření:** Úplný inventář ovladačů, původní gates/E2E, další regresní matice a nezávislé review; žádná falešná hook metadata.

## D9 — Firma a soukromí před uploadem (30. 9. 2026)

Dan požádal o zapamatovatelný výběr firmy a možnost firmu i viditelnost zvolit
pro jednotlivou nahrávku před uploadem. Nový kontrakt je v UPLOAD-PREFERENCES.md.
Původní návrh měl soukromý default; pozdější D11 mění pouze nové nahrávky
na firemní. Existující upload vazby se nepřepisují. Přímý mandát
rozšiřuje desktop o úzké per-recording IPC; backend se nemění. Formální hook
schválení se nevyrábí.

## Původní vizuální rozpor — uzavřen rozhodnutím D10

Historicky blokovalo publikaci; rozhodnutí D10 nyní dovoluje přesnou obnovu brány.
Nový panel dává nahrávání první místo a LuTrack je malý neaktivní řádek.
Původní nezměněná brána vyžaduje starý dominantní LuTrack hero a skončí FAIL.
Varianta A: potvrdit konkrétní dotažení z galerie a poté obnovit vizuální kontrakt
a jeho přesné testy; funkční a bezpečnostní podmínky zachovat.
Varianta B: vrátit pouze kompozici/hustotu pod původní vizuální kontrakt.
Nejde o výjimku z projektové brány; funkční a bezpečnostní podmínky zůstávají.

## D10 — Q1 → A · Potvrdit dotažení

- **Otázka:** Potvrdit dotaženou hierarchii a obnovit podle ní původní vizuální kontrakt před vydáním?
- **Volba Q1·A:** Potvrdit dotažení
- **Trade-off:** Nahrávání první a kompaktní neaktivní LuTrack; obnovit přesné vizuální testy při zachování funkčních kontrol.
- **Rozhodl:** Dan — výslovná odpověď v chatu 30. 9. 2026
- **Datum:** 2026-09-30

## D11 — Q3 → A · Firemní default nových

- **Otázka:** Nastavit Sdílená ve firmě jako default nových nahrávek s možností změny před uploadem?
- **Volba Q3·A:** Firemní default nových
- **Trade-off:** Před uploadem změna na Soukromá; staré položky zachovat.
- **Rozhodl:** Dan — přímé zadání v chatu 30. 9. 2026
- **Datum:** 2026-09-30

D10 potvrzuje snímky checkpointu 0dd87da a hierarchii Nahrát → Nahrávky → kompaktní
neaktivní LuTrack. Původní FAIL zůstává archivovaný, není přepsán na PASS. Aktualizace
geometrických predicates je změna schváleného produktu, nikoli vynechání měřidla.
D11 mění explicitní inicializaci pouze nových položek a nového stop-formu na company.
Starý soukromý fallback a již zahájená vazba zůstávají chráněné.
