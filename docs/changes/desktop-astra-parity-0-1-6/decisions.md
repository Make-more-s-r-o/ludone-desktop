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
