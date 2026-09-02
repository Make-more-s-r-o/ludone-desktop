# Běh 1. 9. 2026 — adopce masterplánu a první designové kolo

**Soběstačný záznam.** Kdo tohle čte večer nebo za měsíc, nepotřebuje původní konverzaci.

---

## Proč běh vznikl

Dan chtěl změnit způsob vývoje na nový **masterplán** (`~/Downloads/LUDONE_MASTERPLAN_BOOTSTRAP.md`,
verze 0.2-draft) — design-first lifecycle s tvrdými branami: intent → discovery → UX contract →
Claude Design → **approval gate** → spec → plan → implementace → PR → deploy.

🔴 **Masterplán NENÍ v repu.** Leží v `~/Downloads` a je to nepřijatý draft. Všechny „rozpory
s masterplánem" jsou tedy rozpory repa s draftem, ne dvou verzovaných dokumentů.

---

## Co se rozhodlo (M1–M13)

Pět kol otázek. **Po schválení patří do `ROZHODNUTI.md`; zatím tam nejsou.**

| # | Rozhodnutí | Kdo |
|---|---|---|
| M1 | Masterplán platí pro **LuDone Desktop**; brief pro modul do `ludone-app` až na konci | Dan |
| M2 | **Řez = co je na `main`.** Mergnuté zůstává, první nedokončená práce jde přes `docs/changes/<id>/` | Dan |
| M3 | Design gate stojí na Claude Design | Dan |
| M4 | **Masterplán vyhrává všude.** Globální „dotáhni to sám až na prod bez ptaní" (20. 8.) se **v tomhle repu ruší** | Dan |
| M5 | Rozsah = dotáhnout LuPlaud až po E10, plná náhrada Plaudu | Dan |
| M6 | Vynucení: jen dokument + AGENTS.md. **Žádný hook, žádný skill** — „zatím jen testujeme" | Dan |
| M7 | Worktrees = Orca `~/orca/workspaces/`, AGENTS.md se opraví | Dan |
| M8 | Úklid stromu i oprava `ui-smoke` před startem — ⚠️ korigováno, viz níž | Dan + korekce |
| M9 | Desktop = **jedna aplikace, dvě agendy** (nahrávání schůzek + vykazování času) | Dan |
| M10 | Desktopový LuTrack = **jen časovač**. Přehled, Management i Admin zůstávají na `app.ludone.cz` | Dan |
| M11 | 🟡 **ODLOŽENO:** osud živého LuTracku. „nevím, nechci rozhodnout teď" | Dan |
| M12 | Vzhled = **LuDone DS (Přístroj)**. Z LuTracku jen logika a názvosloví | Dan |
| M13 | Bezpečnostní nálezy C4 expedovány do `LuDone/DAN-TODO.md` — **zapsáno, NECOMMITNUTO** | Dan |

**Rozhodnutí, která Dan nechal na mně** (řekl „je mi jedno" nebo „nerozumím"):

- **Serverový kontrakt = `/api/desktop/recordings`** — hotová fronta stojí na něm; druhá varianta
  (`/api/nahravky/uploads` ze `specs/E5`) by znamenala přepsat frontu i její testy.
- **Statická registrace klienta**, ne dynamická. Jediná varianta, kde jde přístup odvolat jedním
  UPDATE. Pozor: dnešní kód dělá DCR (`electron/auth.cjs:203-222`) a vynucuje ji i brána `E7.sh:49`.
- **Přejmenovat běhová čísla** na `B1–B8` a rozhodnutí běhu na `BD1–BD7`.
- **Neplatit GitHub Pro ani nezveřejňovat repo.** Bránu drží orchestrátor + sedm bran do CI.
- **Kalendář z první verze vyhodit** (Dan sám nadhodil: „možná je to zbytečný"). Nahrávku
  identifikuje datum, čas a poznámka; navrhuju k tomu název aplikace nebo záložky, ze které šel zvuk.

---

## Co běh doopravdy zjistil

Tři read-only discovery workflow (41 agentů, 6,4 M tokenů) + jeden Codex běh. Plné výstupy:
`docs/ux/inventar-povrchu-2026-09-01.md`.

### 🔴 Projekt je výrazně méně hotový, než `PLAN.md` tvrdí

**Z deseti etap E0–E10 není hotová doslova ani jedna.** Devět akceptačních bran přitom svítí
zeleně a 77 testů projde — jenže:

- **Brány měří text, ne chování.** Killswitch se hlídá třemi grepy nad testem (zakomentovaný
  assert projde, `E5.sh:13-19`); `E4.sh:14-16` grepuje NÁZEV testu, takže vyprázdněné tělo nevidí.
  Čtyři z deseti testů čtou `electron/main.cjs` jako řetězec.
- **Fronta i přihlášení jsou mrtvý kód.** `grep "lib/queue|queue.cjs" src/ electron/` → jen
  definice. `createAuthController` (`auth.cjs:325`) nemá volajícího; `main.cjs:681-691` vrací
  `token: "mock-token-not-persisted"` a `user: "Daniel Novák"`.
- **`ui-smoke` je na `main` červený** — `scripts/ui-smoke.mjs:301` klikne na „Povolit", které E6
  z `Onboarding.jsx` odstranila. Proto se sabotáže (b) a (c) nikdy nespustily.
- **Trojí kolize identifikátorů:** etapy `E*`, brány `E*.sh` a rozhodnutí `D*` znamenají tři různé
  věci. `specs/E5` = serverový příjem × `E5.sh` = odchozí fronta. Zelený `E5.sh` svádí uzavřít
  plánovou E5 — 3–4,5 ČD práce bez řádku kódu.

### 🔴 Časovač je money-path

LuTrack **není modul `ludone-app`** (tam je 54řádkový placeholder). Je to samostatná PWA na
`ludone.cz/time-tracking` s vlastním backendem pro identitu, data, práva a business pravidla
i 27 edge funkcí sypajících do Tabidoo.

Hodiny tečou přes **interní týdenní agregát** do Tabidoo a přes sklad zpátky do
`ludone-app`, kde jsou zdrojem pravdy o mzdových nákladech projektů v HR, táborech, rozpočtech i CFO.

⚠️ **Duplicitní zápis času se neprojeví jako viditelný duplikát — tiše navýší hodiny.** Proto musí
desktop generovat klíč proti duplikaci už při startu časovače.

Dobrá zpráva: **sazbu klient nikdy neposílá**, dosazuje ji databázový trigger z alokace. Desktop si
na peníze nesáhne ani omylem.

⚠️ Lokální klon `ludone-insight` je **274 commitů pozadu**; ani `origin/main` není důkaz o produkci.

### 🔴 Bezpečnostní nález mimo rozsah

Pět edge funkcí LuTracku má `verify_jwt = false` bez náhradní kontroly — mimo jiné
`tabidoo-sync-weekly-summaries` a `auto-stop-timers`. Kdokoli se znalostí project refu (v gitu
natvrdo) je může spustit zvenčí. **Ověřeno v repu, ne naostro.** Patří majiteli LuTracku.

---

## Co v repu přibylo

| Cesta | Co to je | Commit |
|---|---|---|
| `design/canvas/` | 10 artboardů z 24. 8. — do té chvíle **netrackované a neignorované** | `394ad14` |
| `scripts/meet-mereni.mjs` | Měřidlo pro vyřazovací kritérium A6 | `394ad14` |
| `dukazy/meridlo-meet-overeni-2026-09-01/` | Důkaz, že to měřidlo umí zčervenat i zezelenat | `394ad14` |
| `design/navrh/` | Tři směry panelu + lišta, klikací | `7c6472d` |
| `design/zadani/` | Záloha závazného briefu z Claude Designu | `fbba46f` |
| `docs/ux/inventar-povrchu-2026-09-01.md` | Inventář povrchu od Codexu | `fbba46f` |

### Měřidlo A6 — jak se používá

```
node scripts/meet-mereni.mjs --priprav
```

Vyrobí referenční nahrávku (28,5 s, český hlas) a vypíše postup. Měření má **tři běhy**:
ostrý, kontrola ticha, kontrola přeslechu.

**Měří obálku energie po 10 ms rámcích, ne vzorky** — přes Meet jde zvuk překódovaný Opusem
a zpožděný, takže vzorková korelace by vyšla nízká i při úspěchu a vyrobila falešný poplach na
vyřazovacím kritériu projektu.

Ověřeno na třech syntetických scénářích: úspěch 0,9983 → PASS · AEC odečetlo hlas 0,0696 → FAIL ·
**přeslech: systém 0,9983 ale mikrofon 0,9974 → FAIL**. Ten třetí je ten důležitý — vypadá jako
úspěch a odhalí ho jen porovnání s mikrofonem.

Referenční soubor je připravený: `dukazy/meet-2026-09-01/referencni.aiff`.

---

## 🔴 Ztráta přístupu k Claude Designu (odpoledne 1. 9.)

Dan přepnul Claude účet. Tím zmizel přístup k projektu **„LuDone Přístroj Design System"**
(`c5ee8498-bd71-466b-8e3e-3c264ae6d7f3`), kde leží závazné zadání, tokeny a UI kit se směry
A/B1/B2/C. Zmizely i oba artefakty vydané ten den.

**Zálohováno do `design/zadani/`** (brief, kit README, barevné tokeny). Nezálohovalo se:
`SmerA/B/C.jsx`, tři referenční návrhy, `porovnani-navrhu.html`, zbytek tokenů
(písmo, tvar, pohyb, mezery).

**Dan se večer přihlásí zpět.** Až se tak stane, stojí za to dotáhnout zbytek zálohy.

---

## Kde běh skončil

Designový canvas je vydaný pod novým účtem:
**https://claude.ai/code/artifact/88609f77-b817-4d3f-99b6-1ea0af8f4f75**

Tři směry panelu 366×792, klikací (chipy nad artboardem přepínají stav), v tokenech Přístroj DS:

- **Conservative** — tři karty v plné výšce, jako dnes. Tweak „počet schůzek" na 4 ukáže, proč se
  to neuživí: obsahová plocha je 670 px, dnes zabráno 529, volných 141.
- **Strong-fit ★** — klidová agenda je jeden řádek, běžící se rozbalí. Řeší rozpočet strukturou.
- **Divergent** — jedna časová osa dne, obě agendy jako slovesa na ní.
- **Lišta** — osm stavů ikony, z toho **čtyři v kódu nejsou**, a jsou to právě ty, které nastanou,
  když je panel zavřený a něco je špatně.

**Dan si směr ještě nevybral.**

---

## Co dělat dál

1. **Vybrat směr panelu** — bez toho se nedá zmrazit spec.
2. **Rozhodnout N1: kam desktop píše hodiny** — přímo do backendu LuTracku pod RLS (hotová cesta, ale
   roznese klíč po noteboocích a přidá třetího zapisovatele tam, kde jedinečnost hlídá jen klient),
   nebo přes tenký endpoint na `app.ludone.cz`. Blokuje přihlašovací obrazovku, tvar položky fronty
   i zpracování chyb.
3. **Změřit Meet** (Danova věc, druhé zařízení + sluchátka).
4. **Dodělat fázi 0:** opravit `ui-smoke`, smazat `feat/kostra-appky` a `origin/docs/plan-2026-08-24`,
   archivovat `feat/zvuk-dukaz` (🔴 **není mergnutá**, drží 680 řádků nástroje, kterým se pořídil
   zvukový důkaz — data v `main` jsou, kostra ne).
5. **Revize `PLAN.md`** — dnes tvrdí věci, které kód už opravil (chybějící
   `NSAudioCaptureUsageDescription`, „na main není ani řádek kódu", vyvrácený nález o systémovém
   zvuku). Kdo se řídí dnešním plánem, opravuje opravené.

## Co běželo a nedoběhlo

Workflow **`mac-experience-vyzkum`** (6 dimenzí: konvence macOS, referenční aplikace, identifikace
nahrávky bez kalendáře, přihlášení očima uživatele, notarizace a aktualizace, úplná cesta uživatele).
Při pauze pořád běželo. Výsledek se hledá v adresáři úloh session `8587ed88`; když tam není,
skript workflow je uložený a dá se spustit znovu.

---

# DODATEK — design schválen 1. 9. 2026 večer

🔴 **Toto je masterplánový DESIGN APPROVAL GATE.** Artefakt: `design/approved.json`.
Dan schválil návrh větou „za mě teda schváleno" nad statickou stránkou `design/navrh/nahled.html`,
která pokrývá 22 obrazovek a 11 stavů. Tím je **implementace user-visible částí odemčená**.

## Rozhodnutí M15–M19

| # | Rozhodnutí | Kdo |
|---|---|---|
| M15 | **Kalendář se ruší.** Sekce „Dnešní schůzky" mizí z panelu. Nahrávku identifikuje datum, čas, délka a **projekt z LuTracku**, plus textové pole při stopu | Dan nadhodil, Claude doložil |
| M16 | **Varianta Divergent se ruší** — stála na časové ose dne, tedy na rušeném kalendáři | Claude, Dan potvrdil |
| M17 | **Hustota panelu: klidová agenda je jeden řádek**, rozbalí se jen běžící | Claude (Dan: „rozhodni") |
| M18 | **Ikona v Docku výchozí vypnutá, s přepínačem v Nastavení** | Claude (Dan: „rozhodni"), Dan potvrdil |
| M19 | **Pojmenování při stopu:** předvyplněný název + čas od–do, editovatelné; **čas se ukládá zvlášť** jako údaj o nahrávce, takže přepsání názvu ho nezruší | Dan |
| M20 | **NOVÉ — připomínky.** Ve zvolené dny a hodiny přijde oznámení, když neběží časovač (jako Toggl). Nikdy během nahrávání. Nastavitelné: dny, od–do, jak často | Dan |

## Co se ztrácí a nemá náhradu

**Seznam účastníků schůzky.** Nenese ho název okna ani zvukové API — jediný zdroj byl kalendář.
Filtrovat „schůzky s klientem X" půjde jen přes ručně zvolený projekt. Doloženo měřením:
`DesktopCapturerSource` má pět polí a obě konferenční okna se jmenovala doslova „Google Meet".

## Vyvrácený vlastní návrh

Navrhoval jsem identifikovat nahrávku podle názvu okna nebo záložky. **Změřeno a nefunguje** —
titulky nesou jméno nástroje, ne schůzky. Do specu se to nesmí dostat.

## Kde to stojí

Design schválen ⇒ podle masterplánu následuje **spec.md** (zmrazit chování) a pak **plan.md**.
Noční běh T1–T4 (`docs/behy/2026-09-01-nocni-beh-zadani.md`) na spec nečeká — opravuje změřené
vady a je spustitelný kdykoli.
