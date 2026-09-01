# Návrh sekce: live-verification

**NEZMRAZENO.** Vzniklo 1. 9. 2026 ve workflow `doplneni-masterplanu`. Skeptická revize
leží v `revize-*.md` vedle a **našla v těchhle sekcích nepravdivá tvrzení** — do `spec.md`
ani `plan.md` se to proto nevkládá celé. Co z toho už platí, je v `spec.md` §11.

---

## 5. Live-verification scénáře

Tyhle scénáře **nejde ověřit testem**. Nikdo je nesmí odškrtnout z kódu ani z dokumentu —
musí je proklikat člověk na skutečném Macu.

Proč mají vlastní sekci: projekt už zaplatil za brány, které svítily zeleně nad nehotovou
prací, protože měřily přítomnost textu místo chování. Měřidlo A6 prohlásilo 1. 9. za funkční
zachycení nahrávku **tří gongů** a samo v odůvodnění napsalo „nese řeč po dobu 0:00"
(`dukazy/meridlo-schuzka-overeni-2026-09-01/README.md`). Zelený `npm run gates` proto o žádné
položce níž neříká nic.

### Pravidla pro celou sekci

1. **Značení výsledku je povinné:** ✅ ověřeno naostro (někdo to proklikal) · 🧪 zelené testy ·
   ⛔ neověřeno. **Sekci L nesplní 🧪 nikdy.** Neproklikaný scénář je ⛔, ne „asi v pořádku".
2. Běží se nad **zabalenou aplikací**: `npm run package:mac` → `release/LuDone Desktop.app`,
   spouštět **z Finderu**. Spuštění binárky z Terminálu může přiřadit oprávnění Terminálu místo
   aplikace — v tomhle repu **nezměřeno**, takže to nedělej.
3. Ostrá data se nešpiní: `LUDONE_DATA_DIR` přesměruje userData, session, cache i logy
   (`electron/main.cjs:170-190`).
4. Zápis do `dukazy/live/<ID>-<datum>/` (**návrh cesty**): kdo, kdy, commit, verze macOS, model
   Macu, výsledek, artefakty. **Nepřítomnost chyby není důkaz** — každý scénář musí vydat
   pozitivní artefakt (snímek, soubor, číslo).
5. 🔴 Do zápisu ani do logu **nikdy zvuk, token, e-mail ani název schůzky**. Identifikátory jen
   jako GUID. Zvukové ukázky zůstávají v `dukazy/`, nesdílejí se do Slacku ani do reportu.
6. V Aktivitě monitoru se aplikace jmenuje **Electron**, ne LuDone Desktop
   (`release/LuDone Desktop.app/Contents/MacOS/Electron`, změřeno 1. 9. 2026) — procesy hledej
   podle cesty, ne podle jména.
7. Live scénáře **nejsou součástí `npm run gates`** a do DoD §3 se nezapočítávají. Jsou to
   samostatné položky reportu.

| ID | Co ověřuje | Kdo | Pouští se po | Jak by dopadl dnes |
|---|---|---|---|---|
| **L1** | 🔴 **A6** — zachytí se druhá strana hovoru | Dan (běh 4); běhy 1–3 kdokoli se dvěma zařízeními | hned, nezávisí na DAG | nezměřeno — blokuje smysl celého projektu |
| **L2** | první spuštění a viditelnost ikony v liště | kdokoli | T1 | 🔴 selhal by |
| **L3** | obě oprávnění, každé zvlášť | kdokoli | ⛔ story v DAG **není** | selhal by |
| **L4** | nahrávka přes skutečný videohovor | kdokoli + druhý člověk | hned (`DSK-F007` hotové) | nad balenou aplikací neproběhl nikdy |
| **L5** | nahrávka spolehlivě do 2 hodin | kdokoli | L4 | neměřeno |
| **L6** | zavření notebooku uprostřed nahrávání | kdokoli | ⛔ story v DAG **není** | selhal by |
| **L7** | souběh obou agend a co ukáže ikona | kdokoli s platnou alokací; Dan na přečerpaný projekt | B3, B5, B6 | pátý stav ikony chybí |
| **L8** | pád rendereru při běžícím časovači | kdokoli | B3, B5 | časovač je atrapa v rendereru |
| **L9** | odhlášení a co se stane s frontou | kdokoli; **Dan** potvrdí revokaci na serveru | B8, B9 | přihlášení je atrapa |
| **L10** | panel na malé obrazovce (1280×800) | kdokoli | ⛔ story v DAG **není** | panel přeteče mimo plochu |
| **L11** | v logu není zvuk, token, e-mail ani název schůzky | kdokoli, nad daty z L1–L10 | po každém kole | aplikace nemá vlastní log |

🔴 **L3, L6 a L10 nemají v DAG §2 vlastníka.** Buď jim vznikne story, nebo zůstanou v reportu
jako ⛔ a Dan ví proč — tiše zmizet nesmějí.

---

### L1 — 🔴 Ověření vyřazovacího kritéria A6

**Kdo:** běhy 1–3 kdokoli, kdo má druhé zařízení a sluchátka. **Běh 4 Dan** — je to skutečná
schůzka se skutečnou protistranou a závěr rozhoduje o osudu projektu.
**Pouští se:** hned. Nezávisí na žádné story a blokuje smysl všeho ostatního
(`intent.md`: „Zatím nezměřeno").
**Měřidla:** `scripts/meet-mereni.mjs` (řízený pokus s referenčním souborem) a
`scripts/schuzka-mereni.mjs` (nad skutečnou schůzkou, bez reference). Obě si surová data
archivují sama do `dukazy/`.

**Kroky**

1. `node scripts/meet-mereni.mjs --priprav` — referenční soubor. Jeden už existuje:
   `dukazy/meet-2026-09-01/referencni.aiff` (ověřeno 1. 9.).
2. Nasadit **sluchátka**, referenci zkopírovat na druhé zařízení, založit Meet a připojit se
   z obou.
3. **Běh 1 — ostrý:** nahrávat v aplikaci, chvíli mlčet, na druhém zařízení pustit referenci
   (nejlépe „Sdílet obrazovku → sdílet i zvuk", ne z reproduktoru do mikrofonu), chvíli mlčet,
   ukončit. Vyhodnotit:
   `node scripts/meet-mereni.mjs --system <…> --mikrofon <…> --reference dukazy/meet-2026-09-01/referencni.aiff --nazev beh-1-ostry`
4. **Běh 2 — kontrola ticha:** 30 s, kdy druhá strana nehraje nic.
5. **Běh 3 — kontrola přeslechu:** bez sluchátek, zvuk z reproduktoru Macu.
6. **Běh 4 — skutečná schůzka:** běžný hovor ≥ 15 minut, kde druhá strana opravdu mluví, pak
   `node scripts/schuzka-mereni.mjs --system <…> --mikrofon <…> --nazev schuzka-<datum>`
   a **poslechnout** `ukazka-systemove-stopy.m4a`, kterou skript vyřízne.

**Co má vyjít**

- Běh 1: **PASS** na všech třech podmínkách — korelace obálky systémové stopy > 0,8, hlasitost
  systémové stopy nad −40 dB, rozdíl korelací systém−mikrofon > 0,3 (`meet-mereni.mjs:60-64`).
- Běh 2: korelace u nuly, tedy **FAIL — a to je správně**. Kontrolní běh dokazuje, že měřidlo
  umí říct „ne".
- Běh 3: vysoká korelace i na mikrofonu ⇒ rozdíl pod 0,3 a **FAIL z důvodu přeslechu** — taky
  správně. Dokazuje, že měřidlo přeslech pozná.
- Běh 4: závěr **FUNGUJE** — protistrana mluví ≥ 20 s ve ≥ 4 replikách a ≥ 5 % času, modulace
  systémové stopy nad 0,18, prosak do mikrofonu pod 6 dB, rozdíl délek stop pod 3 %
  (`schuzka-mereni.mjs:46,58,70,74-78`).

**Jak se pozná selhání**

- Běh 1 FAIL na korelaci systémové stopy = potlačení ozvěny protistranu odečetlo. **A6 padá
  a projekt se v současné podobě zastavuje.**
- Běh 2 s vysokou korelací nebo běh 3 s nízkou korelací na mikrofonu = **lže měřidlo**, ne
  aplikace. Do opravy měřidla neplatí ani běh 1.
- Běh 4: `NEPRŮKAZNÉ` **není úspěch** — skript končí `exit 1` právě proto, že to je
  nejpravděpodobnější výsledek a jako nula by prošel jakoukoli bránou.
- `FUNGUJE` bez poslechnuté ukázky taky není úspěch: **žádná automatická kontrola nerozliší řeč
  od opakovaného zvonění** — změřeno, řada gongů dala modulační index 0,875 při prahu 0,18.

**Důkaz:** čtyři složky v `dukazy/` (`vysledek.json` + `README.md` + surová data), do zápisu
odkaz na všechny čtyři. ✅ se smí napsat, jen když všechny čtyři běhy vyšly ve svých rolích.

⚠️ Systémový zvuk stojí na `audio: "loopback"` (`electron/main.cjs:420`), což Electron 37
dokumentuje jen pro Windows. **Po každé změně verze Electronu se L1 opakuje celý.**

---

### L2 — První spuštění a viditelnost ikony v liště

**Kdo:** kdokoli s Macem, který aplikaci ještě neměl. **Pouští se po:** T1.

**Kroky**

1. `npm run package:mac`, výsledek přesunout do `/Applications`.
2. Spustit dvojklikem **z Finderu**.
3. Nic dalšího nedělat — dívat se na lištu. Vyfotit ji (⌘⇧4).
4. Kliknout na ikonu.
5. `ps aux | grep "LuDone Desktop.app"` — kolik instancí běží.

**Co má vyjít:** v liště je ikona, kterou člověk najde bez nápovědy (návrh kritéria: **do 5 s**),
klik otevře panel pod ní a běží **jedna** instance. Stav nese tvar, ne barva — ikona je
šablonová.

**Jak se pozná selhání:** v liště je 16 px prázdna. Změřeno na Electronu 37.3.1 / macOS 26.4:
`trayImage()` staví ikonu z `data:image/svg+xml`, Chromium SVG nedekóduje a `nativeImage` je
prázdný (`isEmpty=true`, 0×0, `toPNG()` = 0 B). **Na dnešním `main` tenhle scénář selže:**
`electron/main.cjs:248-253` pořád volá `createFromDataURL` nad SVG a `electron/ikony/src` je
prázdný adresář (změřeno 1. 9. 2026) — přestože T1 je v DAG vedená jako hotová.
Druhý příznak selhání je **dvojí instance**: neviditelnou ikonu si člověk vyloží tak, že se
aplikace nespustila, a spustí ji znovu.

**Důkaz:** snímek lišty, počet instancí, model Macu (s notchem / bez) a poznámka, jestli běží
Bartender nebo podobný skrývač ikon.

---

### L3 — Udělení obou oprávnění, každého zvlášť

**Kdo:** kdokoli, na Macu, kde ještě udělená nejsou. Reset (**příkazy nezkoušené v tomhle repu**):
`tccutil reset Microphone cz.ludone.desktop` a `tccutil reset ScreenCapture cz.ludone.desktop`.
**Pouští se po:** story, která rozdělí obě oprávnění na nezávislá — ⛔ **v DAG dnes není**.

**Kroky**

1. Resetovat obě oprávnění, spustit aplikaci.
2. Povolit **jen mikrofon**, systémový zvuk **zamítnout**.
3. Zkusit spustit časovač a zkusit spustit nahrávání.
4. Povolit Nahrávání obrazovky v Nastavení systému, vrátit se do panelu **bez restartu aplikace**.
5. Spustit zkoušku zvuku v panelu.

**Co má vyjít:** po kroku 2 aplikace **funguje dál** — časovač jde spustit a nahrávání buď jede
jen s mikrofonem a řekne, že druhá strana chybí, nebo přesně řekne, proč nejde. Po kroku 4 panel
při dalším otevření ukáže nový stav sám (čte `getMediaAccessStatus('screen')` při každém otevření).
Zkouška ukáže, že do **obou** stop teče zvuk, dřív než člověk poprvé stiskne Nahrát.

**Jak se pozná selhání:** onboarding zamkne celou aplikaci, dokud nejsou obě oprávnění (dnešní
chování, `DSK-F006` „částečně, zamyká celou appku"); tlačítko „Povolit" u systémového zvuku, které
nic neudělá (`askForMediaAccess` umí jen mikrofon a kameru — screen ne); panel po návratu
z Nastavení systému drží starý stav; **panel se během systémového dialogu schová** (opraveno
commitem `04e87fc`, ověř, že se to nevrátilo).

**Důkaz:** série snímků nebo záznam obrazovky + zapsaný stav obou oprávnění po každém kroku.

⚠️ Každý nový balík je znovu podepsaný ad-hoc. `scripts/package-mac.mjs:14` upozorňuje, že změna
bundle id resetuje udělená oprávnění; jestli je resetuje i nový podpis téhož bundle id, **nikdo
neměřil**. Opakované dialogy proto samy o sobě nejsou selhání L3.

---

### L4 — Nahrávka přes skutečný videohovor

**Kdo:** kdokoli plus druhý člověk, který o nahrávání ví. **Pouští se:** hned (`DSK-F007` je
hotové a ověřené); pojmenování při stopu a zařazení do fronty až po B7.

**Kroky**

1. Hovor v Google Meetu, 45–60 minut, nahrávat od začátku.
2. Uprostřed jednou přepnout výstup (sluchátka → reproduktor a zpět).
3. Uprostřed jednou přehodit síť (Wi-Fi → hotspot).
4. Zastavit, potvrdit předvyplněný název.
5. Otevřít složku `~/Library/Application Support/LuDone Desktop/nahravky` a projít, co v ní je.

**Co má vyjít:** dvě WebM stopy, obě zhruba tak dlouhé jako hovor; manifest ve stavu `complete`
se `sha256` obou stop (`electron/main.cjs:582-632`); adresář `0700`, soubory `0600`
(`main.cjs:479-480`). Přepnutí výstupního zařízení ani výpadek sítě nahrávání nezastaví — a když
jedna stopa vypadne, druhá **pokračuje** a panel řekne **která** chybí (R3).

**Jak se pozná selhání:** zastaví se obě stopy, když vypadne jedna (dnešní vada R3); stopa je
kratší než hovor; manifest zůstal `incomplete`; `sha256` chybí; v adresáři jsou kusy místo dvou
souborů.

**Důkaz:** `ls -l` adresáře, manifest (bez názvu schůzky v zápisu), délky obou stop měřené
dekódováním.

🔴 Změřeno 1. 9. 2026: `~/Library/Application Support/LuDone Desktop/` existuje, ale podadresář
`nahravky` v něm **není** — s balenou aplikací se dosud nenahrávalo. Tenhle scénář nikdy neproběhl.

---

### L5 — Nahrávka spolehlivě do dvou hodin

**Kdo:** kdokoli. Nemusí to být schůzka: stačí Meet s druhým zařízením, ze kterého jde zvuk —
ale **musí** to jít přes skutečný hovor, jinak se neověřuje systémový zdroj.
**Pouští se po:** L4. Vychází z Danova rozhodnutí 1. 9.: nahrávka musí spolehlivě projít do
dvou hodin délky.

**Kroky**

1. Nahrávat **2 h 05 min** bez zásahu. Notebook napájený, obrazovka smí zhasnout.
2. Po 30, 60, 90 a 120 minutách otevřít panel a opsat běžící čas.
3. `ps -o rss= -p <PID hlavního procesu>` na startu, po 60 a po 120 minutách.
4. Po zastavení zkontrolovat délku obou stop **dekódováním** (`ffmpeg -i <soubor> -f null -`),
   ne z hlavičky — WebM z MediaRecorderu délku v hlavičce mít nemusí (**nezměřeno**).
5. `shasum -a 256` obou stop proti manifestu.

**Co má vyjít** (čísla dopočtená z kódu, **měřením potvrzená být musí**)

- obě stopy dlouhé 2 h ± 5 % (návrh tolerance);
- ≈ **115 MB na stopu**, ≈ 230 MB celkem — 128 kb/s × 7 200 s (`RecordingCard.jsx:145`);
- ≈ **7 200 chunků na stopu** při timeslice 1 s (`RecordingCard.jsx:8`), pořadí bez díry;
- manifest `complete`, obě `sha256` sedí;
- RSS hlavního procesu na konci nejvýš +50 % proti startu (**návrh prahu, nikde neměřeno**);
- panel po dvou hodinách ukazuje správný čas, ne 0 ani `NaN`.

**Jak se pozná selhání:** kterákoli stopa se zastaví dřív; v logu je chyba pořadí chunku
(`main.cjs:563` — díra v sekvenci nahrávání shodí); RSS roste lineárně; konec souboru nejde
přehrát; délka stop se liší o víc než 3 % (pak by na nich neplatilo ani měřidlo A6).

**Důkaz:** čtyři snímky panelu, `ls -l`, dvě `sha256`, tři čísla RSS, délky z dekódování.

---

### L6 — Zavření notebooku uprostřed nahrávání

**Kdo:** kdokoli. **Pouští se po:** story, která zavede `powerMonitor` a `powerSaveBlocker` —
⛔ **v DAG dnes není** a v kódu taky ne (`grep -rn "powerMonitor\|powerSaveBlocker" electron/ src/`
nevrací nic, změřeno 1. 9. 2026). Dnešní běh je baseline, ne brána.

**Kroky:** nahrávat 5 minut · zavřít víko na 20 minut · otevřít · počkat 2 minuty · zastavit.

**Co má vyjít — jedna ze dvou variant, ale rozhodnutá PŘED během, ne zjištěná po něm:**

- (a) nahrávání běželo dál, stopy mají ≈ 27 minut, protože po celou dobu držel
  `powerSaveBlocker('prevent-app-suspension')`; nebo
- (b) na `suspend` se obě stopy **korektně uzavřely** (manifest `complete`) a po probuzení panel
  řekne, co se stalo a kolik se uložilo — a **nerozjede se sám**, protože zdroje zvuku už nemusí
  existovat.

**Jak se pozná selhání:** stopy končí v okamžiku zavření víka a nikdo se to nedozví; manifest
zůstane `incomplete`; po probuzení panel tvrdí „nahrává se", ale rekordér je mrtvý; nahrávka
pokračuje, ale dvacet minut v ní je ticho, o kterém se člověk nikde nedočte.

**Důkaz:** délky stop, manifest, snímek panelu hned po probuzení.

---

### L7 — Souběh obou agend a co ukáže ikona

**Kdo:** kdokoli, kdo má dnes platnou alokaci na projekt (bez ní výběr nic nenabídne — R6).
**Dan** navíc pro ověření zašedlého projektu s čerpáním nad 110 % (R7) — takový projekt musí
někdo najít v datech. **Pouští se po:** B3, B5, B6.

**Kroky**

1. Spustit časovač na projektu.
2. Spustit nahrávání. Podívat se na ikonu **a** na tooltip.
3. Zastavit nahrávání a na nabídku „Zastavit i měření času?" odpovědět **ne** (nebo ji nechat
   zmizet samu — C1).
4. Ověřit, že časovač běží dál.
5. Za běhu přepnout projekt.
6. Zastavit časovač.

**Co má vyjít:** při souběhu ikona ukazuje **pátý stav** — ne „nahrává" se zamlčeným LuTrackem
a ne „nepřihlášeno". Vedle ikony nejvýš **jedno** číslo s pevnou šířkou, aby lišta neposkakovala.
Tooltip říká totéž co panel. Zastavení nahrávání časovač nezastaví (R4). Přepnutí projektu
časovač nezastaví (R11) a založí druhý záznam s vlastním klíčem, ne prodloužení prvního.

**Jak se pozná selhání:** ikona ukazuje jen jednu agendu (dnes má renderer prioritu nahrávání,
takže lištu o běžícím LuTracku zamlčí); panel se po zastavení nahrávání tiše překlopí na
„nepřihlášeno" (spec §6: pátý stav **chybí**); zelená `#2f9e44` z `traySvg` (`main.cjs:202-216`)
se v šablonové ikoně nezobrazí a stav zmizí úplně; přepnutí projektu časovač vynuluje.

**Důkaz:** čtyři snímky lišty — klid, jen nahrávání, jen čas, obojí — a k nim snímky tooltipu.

---

### L8 — Pád rendereru při běžícím časovači

**Kdo:** kdokoli. **Pouští se po:** B3 a B5.

**Kroky** (příkazy jsou **návrh**, na stroji nezkoušené)

1. Spustit časovač, nechat běžet 3 minuty.
2. Najít hlavní proces: `pgrep -f "LuDone Desktop.app/Contents/MacOS/Electron"`.
3. Vypsat jeho potomky (`pgrep -P <PID> -l`) a zabít toho s „Renderer" — helper se jmenuje
   `Electron Helper (Renderer)`, protože balíček helpery nepřejmenovává (změřeno 1. 9. 2026).
   **Nepoužívej `pkill -f "Electron Helper (Renderer)"`** — sestřelí renderery ostatních
   Electron aplikací.
4. Počkat 60 sekund, sledovat ikonu v liště.
5. Otevřít panel.
6. Totéž zopakovat s **běžícím nahráváním** místo časovače.

**Co má vyjít:** ikona po celou dobu ukazuje běžící časovač — autoritou stavu je hlavní proces
(B3). Panel se otevře s **běžícím** časovačem a časem, který zahrnuje i minutu bez rendereru.
Po zastavení je záznam **jeden a spojitý** a klíč proti duplikaci je pořád ten z okamžiku startu
(R10). U nahrávání vznikne manifest `incomplete` (`main.cjs:516, 654`) a po restartu se aplikace
zeptá, co s nedokončenou nahrávkou.

**Jak se pozná selhání:** časovač po pádu ukazuje nulu nebo začíná znovu; ikona v liště tvrdí
„nahrává se", i když nic neběží (dnešní chování — stav řídí renderer); vzniknou dva časové
záznamy; po restartu se o nedokončené nahrávce nikdo nedozví.

**Důkaz:** čas před pádem a po něm, tooltip ikony během výpadku, obsah perzistence časovače
před a po (soubor, který zavede B5), manifest z varianty s nahráváním.

---

### L9 — Odhlášení a co se stane s frontou

**Kdo:** kdokoli s LuDone účtem pro samotné odhlášení. **Dan** pro potvrzení, že relace
na `app.ludone.cz` opravdu skončila. **Pouští se po:** B8 a B9 — dnes je přihlášení atrapa
(`main.cjs:681-692` vrací mock token, který se nikam neukládá), takže není co ověřovat.

**Kroky**

1. Přihlásit se.
2. Pořídit dvě krátké nahrávky. Odesílání je vypnuté (`DESKTOP_UPLOAD_ENABLED`), takže zůstanou
   ve frontě.
3. Odhlásit se. Zapsat počet položek ve frontě a obsah adresáře `nahravky` **před** a **po**.
4. Přihlásit se znovu a zkontrolovat, že se nic neodešle dvakrát.
5. Zopakovat odhlášení s **vypnutou Wi-Fi**.

**Co má vyjít:** fronta má po odhlášení stejný počet položek (R12), lokální soubory zůstávají.
Pořadí je závazné — nejdřív odvolání na serveru, teprve pak smazání lokálního blobu (R13).
Pokusy se pauzují a nezapočítávají (R17). Po odhlášení bez sítě panel řekne **pravdu**: odvolat
se nepodařilo, plus „Zkusit odvolat teď" — tvrzení „přístup odvolán" by tam bylo lží na dalších
30 dní, protože refresh token tak dlouho žije.

**Jak se pozná selhání:** fronta je po odhlášení prázdná; soubory zmizely; panel hlásí „odvoláno",
i když request neodešel; po opětovném přihlášení se položky odešlou podruhé.

**Důkaz:** počty položek a `ls` adresáře před/po, snímek panelu po odhlášení bez sítě, Danovo
potvrzení, že relace na serveru zmizela.

⚠️ Že token na serveru **opravdu** umřel, dnes desktop nijak neukazuje. Dokud B9 nedá HTTP kód
revokace do diagnostiky, ověřuje L9 jen frontu a lokální stav — a to se musí v zápisu napsat,
ne vydávat za ověřenou revokaci.

---

### L10 — Panel na malé obrazovce

**Kdo:** kdokoli s Macem na 1280×800 (13" MacBook v odpovídajícím škálování nebo externí displej).
**Pouští se po:** story, která zavede zkracování panelu — ⛔ **v DAG dnes není**. Vychází
z Danova rozhodnutí 1. 9.: panel se zkrátí podle plochy, hlavička a patička zůstanou přilepené,
roluje prostředek.

**Kroky**

1. Přepnout rozlišení na 1280×800.
2. Otevřít panel v klidu; pak s oběma běžícími agendami; pak navíc s pruhem fronty a s výpadkem
   stopy — tedy v nejplnějším stavu, jaký umí nastat.
3. Projít panel klávesnicí (Tab) až na patičku.
4. Vyfotit **celou obrazovku**, ne jen panel.

**Co má vyjít:** panel se vejde do plochy. Dnešní `PANEL_HEIGHT = 792` (`main.cjs:26-27`) je
pevný; plocha po odečtení lišty vychází ≈ 775 px (**výpočet, ne měření na stroji**), takže panel
přetéká pod hranu. Hlavička i patička drží na místě, roluje jen prostředek, a každá akce —
včetně „Ukončit a uložit" — je dosažitelná myší i klávesnicí.

**Jak se pozná selhání:** spodek panelu je pod hranou obrazovky; ovládání jde vidět jen po
rolování celé stránky; panel se vysune nad lištu; text se zlomí do nečitelné šířky.

**Důkaz:** tři snímky celé obrazovky + hodnota `workArea` displeje ze diagnostiky.

---

### L11 — V logu není zvuk, token, e-mail ani název schůzky

**Kdo:** kdokoli. **Pouští se:** po každém kole live-verification, **nad logy z běhů L1–L10** —
nikdy nad prázdnou aplikací. Vychází z Danova rozhodnutí 1. 9.: do logu nikdy zvuk, token,
e-mail ani název schůzky; identifikátory jen jako GUID.

**Kroky**

1. Posbírat všechno, co běhy vyprodukovaly: výstup terminálu, případné soubory v `logs`,
   manifesty, obsah zápisu.
2. `grep -nE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'` — e-maily.
3. `grep -niE 'bearer|refresh_token|access_token|eyJ'` — tokeny.
4. Hledat **doslovný název schůzky**, který jsi při zastavení zadal — i v názvech souborů a cest.
5. Ověřit, že identifikátory jsou UUID (`clientRecordingId`) a GUID projektu.

**Co má vyjít:** nula nálezů ve všech třech třídách a identifikátory jako GUID. Počet
prohledaných řádků se zapisuje do zápisu.

**Jak se pozná selhání:** cokoli nalezeného. Opravuje se **zdroj logu**, ne log — přepsat log
a hlásit zeleno je falšování důkazu.

🔴 **Prázdný výstup grepu je i výsledek „aplikace nezalogovala vůbec nic".** Proto je součástí
zápisu počet řádků a proto se scénář pouští jen nad ostrým během — fail-open grep je jedna
z tříd lhavých bran, které tenhle projekt už zaplatil.

⚠️ Aplikace dnes **nemá vlastní log**: `app.setAppLogsPath` se volá jen ve větvi pod
`LUDONE_DATA_DIR` (`main.cjs:190`) a `application.log` v důkazech je přesměrovaný stdout
ze sabotážního skriptu (`scripts/akceptace/E2-sabotaze.sh:57`). Do doby, než vznikne skutečný
log a „Exportovat diagnostiku", běží L11 nad stdout a stderr.

---

## Předpoklady, na kterých to stojí

- Sekci jsem očísloval jako §5 (za '4. Co se v noci nesmí'). Jestli plan.md mezitím dostane další sekce od jiných autorů, číslo se musí posunout — obsah na něm nezávisí.
- Cesta pro zápis 'dukazy/live/<ID>-<datum>/' je můj návrh; repo dnes používá 'dukazy/<nazev>-<timestamp>' jen pro výstupy měřidel, konvence pro ruční běhy neexistuje.
- Prahy v L5 (délka ±5 %, RSS max +50 %) jsou návrh. Velikost ≈115 MB na stopu a ≈7 200 chunků jsou dopočtené z kódu (128 kb/s v RecordingCard.jsx:145, timeslice 1 s na řádku 8), ne změřené.
- Výška plochy ≈775 px na 1280×800 je výpočet (lišta ~25 px při 1×), na skutečném stroji jsem to neměřil. Vím jistě jen to, že PANEL_HEIGHT = 792 (main.cjs:26-27).
- Kritérium 'ikonu člověk najde do 5 s' v L2 je návrh — nikde v repu žádná lhůta pro viditelnost není.
- Příkazy 'tccutil reset ... cz.ludone.desktop' (L3) a postup na zabití rendereru přes pgrep -P (L8) jsou návrh, v tomhle repu nezkoušené. Ověřený je jen název helperu 'Electron Helper (Renderer)' a to, že hlavní binárka se jmenuje Electron.
- Předpokládám, že live scénáře nejsou součástí 'npm run gates' a nezapočítávají se do DoD §3 — plán to dnes nikde neříká, tak jsem to napsal jako pravidlo.
- L1 běh 4 předpokládám nad schůzkou, kde druhá strana o nahrávání ví (A1 riziko přijaté vědomě řeší právní rámec, ne zkušební běh).
- 'Do 2 hodin' čtu jako jednu souvislou nahrávku, ne součet za den.
- Že se při spuštění binárky z Terminálu přiřadí TCC souhlas Terminálu místo aplikace, je moje varování, ne měření — proto v pravidlech stojí 'spouštět z Finderu' a ne tvrzení o chování macOS.
- Že nový ad-hoc podpis téhož bundle id resetuje udělená oprávnění, je nezměřené; komentář v package-mac.mjs:14 mluví jen o změně bundle id.

## Otázky na Dana

- Tři scénáře (L3 rozdělená oprávnění, L6 chování při zavření víka, L10 zkracování panelu) nemají v DAG §2 žádnou story. Založit je jako B13–B15 v této vlně, nebo je vědomě odložit a nechat v reportu jako ⛔?
- L6: má nahrávání při zavření víka POKRAČOVAT (powerSaveBlocker), nebo se korektně UZAVŘÍT a po probuzení se zeptat? Obojí je obhajitelné, ale musí se rozhodnout před během — jinak se výsledek napasuje na to, co appka náhodou udělá.
- Kdo kromě tebe smí live scénáře odbavovat? Napsal jsem 'kdokoli z týmu' všude, kde stačí Mac, a tebe jen u L1 (běh 4, rozhoduje o projektu), L7 (přečerpaný projekt) a L9 (potvrzení revokace na serveru). Sedí to?
- L5: sedí prahy pro dvouhodinovou nahrávku (délka ±5 %, ≈115 MB na stopu, RSS max +50 %), nebo máš vlastní hranici, kdy to považuješ za selhání?
- Kam mají zápisy z live běhů? Navrhuju dukazy/live/<ID>-<datum>/, ať se nemíchají s tím, co si tam sypou měřidla sama.
- L9: stačí ti, co o revokaci řekne desktop, nebo chceš, aby součástí scénáře bylo tvoje ověření v app.ludone.cz, že relace opravdu zmizela? Dnes to desktop nijak neukazuje.
