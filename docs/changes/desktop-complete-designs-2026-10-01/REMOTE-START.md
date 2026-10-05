# Vývoj F Osa na Macu mini — skutečný start

5. 10. 2026. Přímé pověření od Dana: „ok, schvaluju, můžeš to pustit ty? nebo ne musím já?“ Navazuje na posouzení celé F a posledních ikon. Schválení platí pro implementaci celé aplikace; finální publikace/tag čekají na review výsledku a výslovný pokyn k vydání.

## Aktuálně řízeno přímo z aplikace

✅ Dan následně výslovně schválil „Ano, obnov vývoj přes aplikaci“. Stejná session `01a10bb6-7d82-78e1-a715-400a8c287f01` byla obnovena přes Codex app server na dev-ludone, pojmenována **LuDone Desktop — F Osa na Macu mini** a otevřena v aplikaci (`navigated: true`). Není vytvořená druhá implementační kopie ani druhý zapisovatel v témže stromu. `wait_threads` potvrdil nový turn `01a10bc1-4982-70c3-a438-7e5231be67c4`, stav `active/inProgress` a skutečné načtení zachovaných změn. Agent nyní pokračuje na Sol 6.1 low; první úkol je instalace závislostí řádnou sandbox cestou a výchozí brány.

Původní CLI proces i runner byly šetrně zastavené při úpravě pracovního prostředí; oba jsou potvrzené ukončené, runtime výsledek `exit_code: 1`, konec `2026-10-05T11:03:50.097276+00:00`. Tento exit je přerušení vlastního procesu, nikoli výsledek akceptace aplikace. Rozpracované main/preload, tray assety a izolované UI/data práce zůstaly zachované. Hlavní produkční checkout je čistý.

⚠️ První pokus obnovit session přes app server automatická kontrola odmítla pro chybějící výslovné pověření k tomuto způsobu pokračování. Po výše uvedeném přímém Danově souhlasu stejná podporovaná akce prošla. Žádný zákaz se neobcházel.

**Pro dohled nyní používat `wait_threads`/`read_thread` pro uvedenou session a host.** Historické CLI PID a `events.jsonl` níže popisují první start; nejsou zdrojem aktuálního stavu obnoveného app běhu. Žádný další CLI resume nespouštět současně s aktivní app session.

## Skutečně spuštěno

✅ Existující SSH a přihlášený Codex CLI 0.160.0 na `dev-ludone`. Nová integrační větev `feat/desktop-osa` v `/Users/dev_ludone/Dev/ludone-desktop/.claude/worktrees/desktop-osa`, založená z `origin/main` `2dd73fb2821f81fad3d9087381c72fd4d127e927`. Přeneseny pouze podklady F a jejich důkazy z `docs/desktop-clarity-preview` `95ff0b2c7a6d92a6f92efe80f9a030fc57d240ea`. Produkční dokumentace vychází z dnešního main.

✅ Schválený start, pořadí práce a mandát jsou uložené v novém vzdáleném `docs/behy/desktop-osa-2026-10-05/START.md`, společně s aktualizovaným plánem a rozhodnutími v commitu `3fdca5c6031b9a970364fe6fccd43eda3dd88faf`.

✅ Codex byl skutečně spuštěn přes CLI na **gpt-6.1-sol**, reasoning **low**, s `--approve-for-me` a workspace sandboxem. Nepoužívá vypnutí sandboxu, heslo správce ani nově přenesené credentialy. Koordinátor může mít nejvýše dva další pracovníky; zapisovatelé musí být izolovaní. Main/preload a integrační shell vlastní jeden zapisovatel. Citlivé změny vyžadují nezávislé review.

| Provozní údaj | Hodnota při startu |
|---|---|
| Session ID | `01a10bb6-7d82-78e1-a715-400a8c287f01` |
| Runner PID | `83506` |
| Codex PID | `83508` |
| Runtime v integračním checkoutu | `.runtime/osa-vyvoj-2026-10-05/` |
| Výstup událostí | `events.jsonl` |
| Výsledek po ukončení | `result.json`, `final.txt` |
| Průběžný checkpoint | `docs/behy/desktop-osa-2026-10-05/STAV.md` |

Čtecí SSH kontrola potvrdila oba živé procesy a události se skutečnými příkazy: čtení zadání, plánu, současného `src/App.jsx` a dalších produkčních služeb. Agent již identifikoval rozdíl mezi současným druhým oknem nastavení a požadovaným panelem F. Nejde jen o uložený prompt nebo vrácené PID.

CLI běh není v app serveru načtený jako živý app chat; jeho přejímka proto používá skutečný proces a runtime události. Samotné `notLoaded/interrupted` v app inventáři nelze vydávat za zastavení živého CLI procesu. Pro navazující práci nejdřív zkontrolovat PID **i** události/výsledek, nespouštět druhého zapisovatele do téhož stromu.

## Další checkpoint

🟡 Ověřit výchozí brány, mapu návrh → skutečné služby a rozhraní komponent. Potom skutečný panel 420/460/440 px s navigací F a samostatný detail 860 × 580 px. Stop musí zůstat dosažitelný, main čas pokračovat při skrytém panelu a quit/update musí chránit záznam, finalizaci i rozhodnutí. UI/datové komponenty mohou vznikat souběžně v oddělených stromech; integrace postupně.

Celá implementace, commity, push, PR a příprava vydání patří do běhu. Backend ani LuTrack napojení ne. Mock není produkční API. Před vydáním skutečný Electron proklik a srovnání se schválenou F ve třech tématech, všechny funkce i citlivé souběhy; brány neoslabovat.

⛔ Produkční F, nativní tray a nové vydání nejsou startem ověřené. Zvuk má nejvýš 🧪 do fyzického ověření člověkem. Nainstalovaná aplikace se nezměnila. Tento start nevyžaduje od Dana ruční příkaz, nové heslo ani další stejné schválení.
