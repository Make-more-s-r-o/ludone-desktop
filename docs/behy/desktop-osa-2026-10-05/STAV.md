# Stav vývoje F Osa — 5. 10. 2026

🟡 Probíhá implementace na schválené `feat/desktop-osa`, základ `2dd73fb2821f81fad3d9087381c72fd4d127e927`, podklady `95ff0b2c7a6d92a6f92efe80f9a030fc57d240ea`, startovací commit `3fdca5c6`.

## Checkpoint 1 — inventář

- Stereo záznam, finální export a rozhodnutí vlastní `RecordingCard` a main recording sessions/export stages; UI je nutné ponechat namountované i při přepnutí stránky.
- Historie používá `recordings:list-local`; akce vyžadují UUID a revize souboru/fronty. Převzetí, retry, koš, Finder a vzdálené ověření mají skutečné služby. Firma a firemní přístup jsou implementované v 0.1.7.
- Nastavení dnes běží ve druhém okně. F je přesune do panelu; samostatné okno zůstane pro konkrétní detail. Ochrany originu, rámu a vlastníka zůstávají.
- ⛔ První `gates:clean` skončil při npm ci kvůli nepovolenému zápisu npm cache mimo sandbox. Výpis: `dukazy/desktop-osa-2026-10-05/baseline-gates.txt`. Opakování používá cache v /private/tmp.
- ⚠️ Git worktree add nedokáže zapsat sdílená metadata `/Users/dev_ludone/Dev/ludone-desktop/.git` (Operation not permitted). Nezvyšujeme oprávnění. Pracovníci mají samostatné lokální klony v povoleném stromu `.claude/worktrees/osa-ui` a `osa-data`, nikdo nezapisuje do integračních souborů.

⛔ F dosud není kompletní ani fyzicky ověřená. ui-smoke/audio-smoke čekají na člověka na skutečném Macu.

## Checkpoint 2 — integrovaná F

- Implementované skutečné stránky nahrávání / historie / odesílání / nastavení / aktualizace; nahrávací komponenta zůstává namountovaná. Nastavení v panelu, samostatný detail konkrétní nahrávky. LuTrack neaktivní.
- Hledání, období, filtry a stránkování nad skutečnými manifesty; nové bezpečné místní přehrávání s revizemi, kontrolou souboru a range streamem. Schválené tray masky a geometrie ovládacích ikon.
- Main řídí prioritu ikony, čas, uložení, rozhodnutí a obnovu rendereru. Stávající firma, firemní přístup, owner claim, retry a serverové ověření zachovány.
- 🧪 Nové jednotkové testy: 15/15, lint implementačních cest, typecheck a build: exit 0. Doslovné výpisy v `dukazy/desktop-osa-2026-10-05/osa-{unit,lint,typecheck,build}.txt`.
- 🧪 Reference návrhu: 72 snímků (24 stavů × 3 témata), exit 0. První Electron běhy ověřily navigaci, šířky, tři témata, skrytý panel a stop; nativní snímání nahrazuje nestabilní CDP snímání. Export vyžaduje připnutý encoder: sestaven existujícím skriptem ze zdrojů a hashů locku, exit 0.
- ⚠️ Původní `gates:clean` na vstupním commitu po instalaci závislostí selhává na 155 lint chybách ve verzovaných návrhových skriptech. Výchozí unit běh má reprodukovatelnost PNG generátoru na tomto Macu červenou. Integrační unit běh navíc odhaluje kontrakty Astra (druhé okno nastavení, původní DOM a původní stavy tray) i extrakční harness bez nových závislostí. Měřidla ani baseline nejsou upravena; tyto rozpory nejsou schválením redesignu prominuty.
- Nezávislé review auth/IPC/queue našlo a opravilo průběžné P2 (tooltip, refresh při exportu, rodič dialogu, výběr audio/MIME, FIFO race). Dodán regresní FIFO test; další finální review čeká.
- Rutinní sandboxové schválení zápisu Git metadat a síťových operací následně umožnilo cherry-picky a instalaci. Bez změny OS oprávnění, bez administrátorského hesla, bez čtení tajemství.

🟡 Implementace je integrovaná, probíhá rozšířená automatizovaná přejímka a příprava review. ⛔ Fyzický zvuk a ui-smoke/audio-smoke nebyly provedeny.

## Checkpoint 3 — review a předání

- 🧪 Poslední skutečný Electron běh: 45 samostatných PASS, exit 0. Tři témata × pět hlavních stránek; skutečná historie devíti manifestů na dvou stránkách, hledání, detail, audio dekodér, stop mimo home, main hodiny při skrytém panelu, výpadek systémového zvuku, místní uložení jednoho stereo derivátu, přehrání správného derivátu, zachování při crash a skutečný restart bez změny held souhlasu.
- 🧪 Scoped lint, typecheck a build PASS; F unit 15/15; core auth/queue/export/dashboard 385/385. Původní i F nativeImage PASS. Produkční závislosti: audit 0 zranitelností. Připnutý encoder pro oba Macy: check exit 0.
- 🧪 Nezávislé finální review citlivého diffu bez dalších konkrétních P1/P2. [Doslovný závěr](REVIEW.md).
- ⚠️ Celá původní unit sada: 201 FAIL / 1468 PASS / 3 původní skipy. Čistá brána nad `61840348`: 155 lint chyb návrhových podkladů (stejné jako výchozí stav). F akceptace včetně původních kontrol správně končí exit 1. [Konkrétní přechodové rozpory](ROZPOR-BRAN.md); měřidla a baseline beze změny.
- 72 referenčních snímků a finální skutečné Electron snímky jsou archivované v `dukazy/desktop-osa-2026-10-05/`. Pouze syntetické důkazy, žádné uživatelské profily nebo zvuk. Pomocné klony byly po bezpečné integraci a verzování důkazů odstraněné.
- 🟡 0.1.8 připravena pro existující podepsaný/notarizovaný workflow; samotné podepsané artefakty nebyly vytvořeny ani vydány. Klíče a produkční instalace nedotčené.
- ⛔ Fyzický zvuk, reálná serverová firma/upload/expirace, 24 skutečných situací ve všech tématech, více monitorů a instalace aktualizace nepřijaté. [Konkrétní krátká Mac přejímka](MAC-PREJIMKA.md).

🟡 Implementace předaná do draft review. Není vydaná ani označená jako kompletně zelená akceptace. Push a URL PR doplní závěrečný checkpoint.

## Checkpoint 4 — push a draft PR

✅ Větev pushnutá na origin a založen [draft PR #160](https://github.com/Make-more-s-r-o/ludone-desktop/pull/160). PR je připojený k této úloze. Nejde o merge ani vydání.

⚠️ Dodatečný úplný lockfile audit: 7 nálezů (3 high, 4 moderate) ve vývojových závislostech; produkční audit zůstává 0. GitHub při pushi zvlášť upozornil na 12 nálezů své výchozí větve. Tyto dvě sady nejsou totožný stav. Závislosti nebyly v rámci F měněny, pouze verze aplikace na 0.1.8. `audit-all.json` a exit 1 jsou uložené pro review; nepoužívá se force upgrade nebo změna testovací baseline.

🟡 K převzetí zbývá rozhodnutí o bezpečném přechodu bran, dependency review a fyzická přejímka dle `MAC-PREJIMKA.md`. Danovo schválení F/ikon a zahájení platí, znovu se nevyžaduje. Tag, main merge, publikace i produkční instalace čekají na další pověření.
