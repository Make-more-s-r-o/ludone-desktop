# CHECKPOINT — LuDone Desktop, noční běh

Poslední zápis: **2. 9. 2026, 16:1x**. Píše se pro někoho s prázdným kontextem.

---

## 🔴 BĚH JE ZABLOKOVANÝ ZVENČÍ — CI se nespustí

GitHub Actions od **2. 9. 15:57** odmítá spustit job:

> The job was not started because recent account payments have failed or your spending
> limit needs to be increased.

Změřeno: 14:30 běh na `main` ještě prošel, v 15:57 už ne. Ověřeno dvěma běhy — trvalé.

**Důsledek: nic se nedá mergnout**, protože merge vyžaduje zelené required checks.
Merge s červenými checky by bylo obcházení brány, což je zakázané. Práce se proto
hromadí v otevřených PR — to je správný stav, ne zapomenutá věc.

**Odblokuje to jen Dan** (billing = peníze + cizí účet → stopka). Je to první položka
v `DAN-TODO.md`.

---

## Kde to stojí

| co | stav |
|---|---|
| `main` | `e4c09cd`, čistý, **422 testů** |
| PR **#25** — export schůzky do jednoho souboru | ✅ hotový, brány lokálně zelené, **čeká na CI** |
| Codex — onboarding (2 chybějící kroky) | ⚙ běží, worktree `desktop-onboarding` |
| worktree `desktop-export` | ⚠️ **NEuklizený schválně** — drží větev k PR #25 |

## PR #25 — co v něm je a proč je dobrý

Zadání znělo „slep dvě stopy do jednoho souboru se dvěma kanály" a varovalo, že se dva
nezávislé `MediaRecorder`y během hodinové schůzky rozejdou.

**Codex to nevyřešil, on to odstranil:** mikrofon a systém jdou do jednoho Web Audio grafu
(`createChannelMerger(2)`, mikrofon vlevo, systém vpravo) a nahrává je **jediný rekordér**.
Jeden rekordér = jedny hodiny ⇒ drift nemá kde vzniknout. Původní dvě stopy zůstávají
na disku, export je kopie.

🔴 **Kontrakt zůstal nevyplněný** — Codexův job umřel (log stál 46 minut) dřív, než ho
dopsal. Naměřený rozdíl startů tedy **od něj nemáme**; architekturu jsem posoudil sám
z diffu. Kdo na to naváže: `rozdilStartu` v `/tmp/beh-noc/export.log` je jen šablona.

### Sabotáže — a nález, který z nich vypadl

| # | co jsem odstranil | výsledek |
|---|---|---|
| S1 | kontrola dvou kanálů v hlavičce Opus | 🔴 správně červená |
| S2 | systém sveden do levého kanálu | 🔴 správně červená |
| S3 | strážce rozdílu startů stop | 🟢 **ZELENÁ = nález** |
| S4 | komentář, který vypadá jako kód | 🟢 podle očekávání |
| S5 | strážce rozdílu délek stop | 🔴 po dozbrojení |
| S6 | obě hranice stereo obalu | 🔴 po dozbrojení (2 testy) |

**Celá rodina časových bran šla odstranit, aniž si toho jediný test všiml.** Doplněny
čtyři testy (`tests/recording-export.test.js`), po nich S3, S5 i S6 červenají ze správného
důvodu. To je ta hodnota sabotážního kola — brána bez testu je jen komentář.

## 🔴 Past, do které jsem si sám spadl (ať do ní nespadne nástupce)

Přidal jsem ty čtyři testy a **nezacommitoval je**, pak jsem pustil další sabotáž, která
končí `git checkout -- .` — a testy zmizely. Poznal jsem to jen podle toho, že celkový
počet spadl zpátky na 428.

Skill říká „commitni Codexovu práci, než začneš sabotovat". Chybí tam druhá půlka:
**commitni i to, co jsi přidal ty.** `git checkout -- .` nerozlišuje autora.

⇒ Kontrola po každé sabotážní smyčce: **souhlasí celkový počet testů s tím před ní?**

---

## První příkazy po probuzení

```bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
gh run list --limit 3            # jede zase CI? kdyz ano, gh run rerun na #25
N=$(pgrep -f 'codex exec -C .*desktop-onboarding'|wc -l|tr -d ' ')
AGE=$(( $(date +%s) - $(stat -f %m /tmp/beh-noc/onboarding.log) ))
echo "codex: $N procesu, log pred ${AGE}s"
```

🔴 **Log, který stojí přes 20 minut, znamená mrtvý job bez ohledu na počet procesů.**
Dnes to tak bylo: 2 živé procesy, log 46 minut starý, a práce přitom hotová na disku.
Postup je pak vždycky stejný: zabít **jen svůj** job (`pkill -f "codex exec -C <cesta>"`,
nikdy holé `pkill -f codex` — to sedí i na Danovu desktopovou aplikaci ChatGPT),
`git add -A && git commit` HNED, teprve pak brány.

V kontraktu onboardingu hledej **`nemyVstup`** a **`blockery`**: když si Codex nevystačil
bez nového IPC kanálu, měl to napsat jako blocker a krok postavit bez něj.

## Co čeká na Dana

1. **Billing GitHubu** — bez toho se nic nemerguje (výš).
2. **Spustit aplikaci a podívat se na ikonu v liště** — oprava je v `main` (PR #24),
   ale nikdo ji neviděl běžet.
3. Chování při plné kvótě (odmítnout, nikdy nemazat samo) a že přepis musí umět
   diarizaci a češtinu.

## Co je ⛔ neověřeno

- **Stereo derivát nikdo neslyšel.** Že jsou kanály v hotovém souboru opravdu oddělené,
  potvrdí až přehrání skutečné nahrávky.
- `npm run test:audio` **nejde pustit lokálně** — chce zabalenou `.app` v `release/`.
  Je to ruční checkpoint na Macu, v sandboxu se nedožene.
- `ui-smoke` v sandboxu pouštět nesmím (mantinel běhu).
