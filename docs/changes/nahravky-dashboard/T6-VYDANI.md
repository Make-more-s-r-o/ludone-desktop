# T6 — příprava a ostré ověření vydání macOS

✅ **Vydání 0.1.2 proběhlo 15. 9. 2026**: [běh 34941430582](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/34941430582)
na `f789f49` prošel podpisem, notarizací, publikací a veřejnou kontrolou. Záloha klíče
je Danem potvrzená a následující jednorázová konfigurace už je nastavená.
Opravy pro 0.1.3 se ověřují samostatně; příprava verze není její publikace.

## Jednorázové nastavení GitHubu

Repo variables:

| název | význam |
|---|---|
| `MAC_SIGNING_KEY_BACKUP_CONFIRMED` | nastavit přesně na `true` až po ověření `.p12` ve firemním správci hesel |
| `DOWNLOAD_SSH_HOST` | SSH hostname serveru, bez uživatele a bez portu |
| `DOWNLOAD_SSH_PORT` | volitelné; prázdná hodnota znamená port 22 |
| `DOWNLOAD_SSH_USER` | existující účet s úzkým právem zápisu do download adresáře |
| `DOWNLOAD_SSH_PATH` | dnes přesně `/opt/makemore-data/nginx/hub/stahnout/desktop/` |

Repo secrets:

| název | význam |
|---|---|
| `DOWNLOAD_SSH_PRIVATE_KEY` | existující privátní klíč pro uvedený účet |
| `DOWNLOAD_SSH_KNOWN_HOSTS` | předem ověřený řádek host key; workflow ho samo ze sítě nezjišťuje |

Hodnoty tajemství nevkládat do issue, PR, terminálového argumentu ani dokumentace. Bezpečná cesta
je GitHub → Settings → Secrets and variables → Actions. Při použití `gh secret set` načíst obsah
ze souboru přes standardní vstup, například `gh secret set DOWNLOAD_SSH_PRIVATE_KEY < bezpečná-cesta`.
Workflow obsah tajemství nevypisuje.

Před nastavením potvrzovací variable je nutné ve správci hesel otevřít uložený `.p12`, ověřit,
že položka obsahuje i heslo, a na jiném důvěryhodném zařízení zkusit, že jde soubor z položky
získat. Pouhá existence `MAC_CSC_LINK` na GitHubu tuto podmínku nesplňuje.

## Co workflow udělá

1. Ověří shodu tagu s `package.json`, potvrzenou zálohu a úplnou release konfiguraci.
2. Spustí jedinou společnou bránu `npm run gates`.
3. Podepíše a notarizuje aplikaci, kterou vloží do DMG i ZIP pro `arm64` a `x64`.
4. Ověří bundle id `cz.ludone.desktop`, verzi, architekturu, Developer ID podpis, stapling,
   Gatekeeper a hashe v `latest-mac.yml`.
5. Uloží čtyři balíčky, čtyři blockmapy, updater metadata, manifest a `SHA256SUMS` jako
   GitHub Actions artifact na 30 dní.
6. Přenese feed přes `scp` s povinným `StrictHostKeyChecking=yes`, na serveru znovu ověří
   SHA-256 a zveřejní `latest-mac.yml` až jako poslední soubor.
7. Přes veřejné HTTPS porovná přesný obsah metadat s vydanou verzí a pomocí HEAD ověří
   dostupnost i velikost všech osmi balíčků a blockmap. Nesprávný cílový adresář tak
   nezůstane skrytý za úspěšným SSH přenosem.

Souběžná vydání jsou zamčená. Při chybě přenosu zůstává starý `latest-mac.yml`, takže klienti
nezačnou stahovat neúplnou sadu. Úspěch workflow znamená, že přenos i finální přejmenování prošly;
včetně veřejné dostupnosti; samotné vytvoření balíčků se za publikaci nevydává.

## Postup pro první instalaci a aktualizaci

Test používá dvě po sobě jdoucí verze: živou `0.1.1` a připravenou `0.1.2`. Bump je v commitu
`5259d57`; před tagem je nutné ověřit, že obsahuje také výsledky T0–T6.
Tag vždy vytváří a pushuje Dan.

1. Na testovacím Macu stáhni starší DMG pro správnou architekturu přes prohlížeč z
   `https://stahnout.ludone.cz/desktop/`. Přetažením nainstaluj aplikaci do `/Applications`.
2. Při prvním spuštění ověř, že Gatekeeper aplikaci přijme bez obcházení ochrany. V aplikaci
   zkontroluj zobrazenou verzi, přihlášení a uděl oprávnění k mikrofonu a systémovému zvuku.
3. Udělej krátkou zkušební nahrávku podle stávajícího lidského `audio-smoke` postupu. Tento krok
   provádí člověk na skutečném Macu; zelené unit testy ho nenahrazují.
4. Po sloučení ověř číslo `0.1.2` v `package.json` i `package-lock.json` a teprve potom vytvoř
   tag `v0.1.2`. Push tagu spustí workflow.
5. V Actions zkontroluj, že proběhly kontroly podpisu a notarizace, vznikl review artifact a krok
   „Publikace na stahnout.ludone.cz“ skončil úspěchem.
6. Z jiného připojení načti `latest-mac.yml`, ověř novou verzi a HTTP 200 pro všech osm uvedených
   souborů balíčků a blockmap. `latest-mac.yml` nesmí odkazovat na chybějící soubor.
7. Spusť starší nainstalovanou aplikaci. Updater kontroluje feed při startu a potom každých šest
   hodin. Po stažení panel hlásí „Nová verze … je stažená“. Pokud neběží nahrávání, ukládání ani
   LuTrack, aplikace se sama bezpečně restartuje; při aktivitě restart odloží a hlášku ponechá.
8. Po restartu ověř nové číslo verze, zachované přihlášení a to, že macOS znovu nežádá dříve
   udělená oprávnění. Nakonec zopakuj krátkou nahrávku obou stop.

Výsledek zapiš jako ✅ pouze tehdy, když projde stažení prohlížečem, první instalace, skutečná
nahrávka, automatický download, bezpečný restart a druhá skutečná nahrávka po aktualizaci.
Samostatně archivuj doslovné výstupy HTTP, `spctl`, verze aplikace a akceptačního příkazu.

Přechod `0.1.1 → 0.1.2` testuje příjem balíčku původním updaterem. Nová informace o dostupné
verzi a procentu stahování poběží až v `0.1.2`; její ostré ověření vyžaduje další schválenou
vyšší verzi. Tento běh kvůli tomu nepřepisuje feed ani nevytváří další tag. Podrobný protokol
je v [OVERENI-NA-MACU.md](OVERENI-NA-MACU.md).
