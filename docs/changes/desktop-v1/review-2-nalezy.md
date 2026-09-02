# Adversariální review druhé vlny — všech 15 potvrzených nálezů

**Spuštěno 2. 9. 2026**, 55 agentů, 5,6 M tokenů, pět čoček nad `b5`, `b7`, `b8`, `b9`, `b11`.
Každý nález ověřen **dvěma nezávislými skeptiky**; kdo neobstál, je dole.

**Potvrzeno 15 · vyvráceno 10.** Ověřovací kolo tedy pracovalo oběma směry.

🔴 **Tenhle soubor je záznam, ne plán.** Co je opravené, má u sebe odkaz na PR.

---

## 1. [P1] PR #7 (b7) — čočka `penize`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b7/electron/queue.cjs:193 (+ chybějící volání v /Users/dan/orca/workspaces/ludone-desktop/desktop-b7/electron/main.cjs)`

```
  return Object.freeze({ enqueueRecording, enqueueTimeEntry, list, pump, retry });
```

**Problém:** `enqueueTimeEntry` nemá v produkčním kódu žádného volajícího. `grep -rn enqueueTimeEntry src electron tests` vrací pouze definici (`src/lib/queue.js:182`), povinný název v kontrole modulu (`electron/queue.cjs:102`), samotnou metodu storu (`:144`, `:147`), export (`:193`) — a testy. `main.cjs` volá jen `getOutboundQueueStore().enqueueRecording(...)`. Uzavřené úseky času tedy zůstanou navěky v `cas/casovac.json` v poli `uzavrene` a do `queue/outgoing.json` se nikdy nedostanou. Story to sama přiznává v DAN-TODO bodech 13 a 14, ale PR se přitom jmenuje „odchozí fronta OBOU typů položek“ a dodává typ položky, který nikdo nevyrábí.

**Scénář selhání:** Uživatel odměří osm hodin, dá Stop. B5 atomicky uloží uzavřený úsek do `casovac.json` (to jsem ověřil, funguje). `outgoing.json` zůstane prázdný, `queue:list` nevrátí nic, startupová pumpa nemá co dělat a žádný kód nikdy `uzavrene` neprojde proti frontě. Čas je změřený, uložený a nikdy neodejde — a obě brány svítí zeleně, protože každý store má vlastní zelené testy a nikdo neměří ŠEV mezi nimi. To je přesně vzorec, na kterém tenhle repozitář v srpnu uklouzl (spec §3, poznámka ⁵ o `queue.js`, který nikdo neimportoval).

**Náprava:** Buď B5 v `runTrackingMutation` zařadí každý vrácený `closed` rovnou do fronty, nebo startupová pumpa udělá reconciliaci `uzavrene` × fronta podle `clientTimeEntryId`. Do doby, než to někdo VLASTNÍ, nesmí DSK-F011/F013 v matici §3 vylézt nad `coded` a v reportu se to nesmí popsat jako „fronta zvládá čas“. Pozor: `resolveRecovered("zahodit")` vrací taky `closed` (s nulou minut a důvodem `zahozeno-cl

---

## 2. [P1] PR #6 (b5) — čočka `penize`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b5/electron/tracking.cjs:127-130, :335, :495-501`

```
  if (endMilliseconds < startMilliseconds) {
    throw new TypeError("endedAt nesmí být dřív než startedAt");
  }

// :335 (stop)
      const endedAt = floorToMinute(now());

// :497 (resolveRecovered, větev "ukoncit")
        if (endedAtMilliseconds > now()) {
          throw new TypeError("endedAt nesmí být v budoucnosti");
        }
```

**Problém:** Délka úseku se počítá z `Date.now()` — z nástěnných hodin, ne z monotónního zdroje. Když se čas pohne ZPĚT (korekce NTP po probuzení se špatnou RTC, ruční přenastavení, změna času na stroji), `stop()` i `switchProject()` spadnou na výjimce a časovač zůstane ve stavu `bezi`. Restart nepomůže: po restartu je záznam `ceka-na-potvrzeni` a větev `ukoncit` vyžaduje současně `endedAt >= startedAt` A `endedAt <= now()`, což při pozadu jdoucích hodinách nelze splnit ani jedním údajem. Jediné průchozí rozhodnutí je `zahodit`.

**Scénář selhání:** ZMĚŘENO sondou. Start v 10:30, hodiny skočí na 09:30. `stop()` → „endedAt nesmí být dřív než startedAt“, stav zůstal `bezi`. `switchProject()` → táž výjimka. Po restartu procesu je stav `ceka-na-potvrzeni` a `resolveRecovered({decision:"ukoncit", endedAt:"…10:30…"})` → „endedAt nesmí být v budoucnosti“. Druhá sonda potvrdila, že projde jedině `zahodit`, a ta zapíše `minutes: 0, closedReason: zahozeno-clovekem`. Uživatel, který ráno spustil časovač a odpoledne mu stroj opravil čas, má na výběr: nezastavit ho vůbec, nebo o celou naměřenou práci přijít. Přesně to R21 zakazuje slovy „nikdy tiše nesmazat ani tiše nezapočítat“.

**Náprava:** Měřit délku monotónně (`performance.now()` / `process.hrtime.bigint()` s kotvou na nástěnný čas při startu) a nástěnné značky brát jen jako popisek. Minimálně: při skoku zpět neházet, ale `endedAt` uříznout na `max(startedAt, floor(now))`, zapsat anomálii do úseku a nechat `ukoncit` přijmout `endedAt >= startedAt` i tehdy, když nástěnné hodiny jdou pozadu.

---

## 3. [P1] PR #7 (b7) — čočka `penize`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b7/electron/main.cjs:830-846`

```
      const queued = await getOutboundQueueStore().enqueueRecording({
        manifest: recordingSession.manifest,
        manifestPath: recordingSession.manifestPath,
        trackPaths: Object.fromEntries(
          [...recordingSession.tracks].map(([source, track]) => [source, track.filePath]),
        ),
      });
      if (queued.added) {
        console.log(`[queue] Zařaz
```

**Problém:** Selhání zařazení do fronty se jen zaloguje. IPC `recording:finish` vrátí `result` jako úspěch, renderer ohlásí uloženou nahrávku a nikde nevznikne stopa, že položka do odchozí cesty nedorazila. Žádná reconciliace neexistuje: `pumpOutboundQueue()` na startu jen zpracovává NAČTENOU frontu, adresář `nahravky/` proti frontě nikdo neprojde. Odchozí cesta má tedy tichý otvor přesně v tom jediném okamžiku, kdy se do ní zapisuje.

**Scénář selhání:** Odvozeno ze čtení kódu (nespouštěl jsem to pod Electronem). Plný disk nebo EACCES na `queue/outgoing.json` právě ve chvíli, kdy uživatel ukončí schůzku: obě stopy i manifest jsou na disku (finalizace proběhla dřív), `enqueueRecording` hodí, catch to spolkne, uživatel vidí „uloženo“. Nahrávka se neodešle nikdy — ani po restartu, ani po kliku na „Zkusit teď“, protože ve frontě prostě není. B11 ji naštěstí nesmaže (`planRetention` maže jen `state === "odeslano"`), takže soubory přežijí — ale nikdo se o nich nedozví. Stejná díra se otevře, když `finalizeRecordingSession` odmítne: `.then()` se nespustí a zařazení tiše odpadne.

**Náprava:** Vrátit fakt o nezařazení v IPC výsledku a označit ho i na disku (stav v manifestu nebo sidecar vedle stop), aby to přežilo pád. Doplnit startupovou reconciliaci: projít manifesty v `nahravky/` a zařadit každý uzavřený manifest, který ve frontě chybí. Tatáž reconciliace mimochodem obsluhuje i R22 — když se ztratí manifest, je klíč proti duplikaci ztracený a obnova vyrobí nový.

---

## 4. [P1] PR #5 (b8), dopadá i na PR #8 (b9) — čočka `bezpecnost`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b9/electron/auth.cjs:154-162, 190-200 + /Users/dan/orca/workspaces/ludone-desktop/desktop-b8/electron/main.cjs:756-762`

```
const rejectPending = (error) => {
    if (settled) return false;
    settled = true;
    close();
    rejectCode(error);
    return true;
  };

  const cancel = () => rejectPending(new Error("Přihlášení bylo zrušeno"));

// ...a v obsluze callbacku o 30 řádků níž:
    settled = true;
    ...
    sendBrowserResponse(response, 200, "Hotovo, vraťte se do LuDone Desktop.");
    cl
```

**Problém:** Jakmile prohlížeč doručí kód na loopback, nastaví se settled = true. Od té chvíle je attempt.cancel() TICHÝ NO-OP: rejectPending vrátí false a nic neudělá. Výměna kódu za token, načtení identity i zápis zašifrované session ale běží dál v samostatné async funkci, kterou zrušení nesleduje. Kdo klikl na Zrušit, skončí přihlášený — s access i refresh tokenem na disku a s ok:true v rendereru. To je přesný opak fail-closed směru, který koordinátor určil v BD-N16 („když se přihlášení a odhlášení sejdou, vyhrává odhlášení; kdo klikl na odhlásit, nesmí skončit přihlášený"). Test „při zrušení předá abort do pokusu controlleru" tohle neuvidí: jeho falešný controller má cancel, který výsledek vždycky od

**Scénář selhání:** Ověřeno spuštěním proti skutečnému auth.cjs (probe-cancel.mjs, falešný loopback server a fetch, skutečný createAuthController): 1) prohlížeč se vrátí s ?code=…&state=… 2) uživatel klikne Zrušit, zavolá se attempt.cancel() 3) server pak vydá token. Výsledek: attempt.result se vyřeší {"ok":true,"user":{…}} a v oauth.enc leží {"access":"ZIVY-ACCESS-TOKEN","refresh":"ZIVY-REFRESH-TOKEN"}. Naostro to bude vypadat takhle: uživatel na půjčeném notebooku (scénář sdíleného zařízení, B10) usoudí, že se přihlášení zaseklo, klikne Zrušit, panel mu neřekne nic o session — a na disku zůstane platný refresh token cizí firmy. Dnes to nikdo nespustí, protože renderer cancelAuth nevolá, ale preload ho už vyst

**Náprava:** Zrušení musí platit i po doručení kódu: zavést druhý příznak (například cancelled), který cancel() nastaví vždy, a kontrolovat ho na dvou místech ve výsledkové async funkci — před výměnou kódu (pak kód vůbec neuplatňovat) a před persistEncryptedSession (pak session nezapisovat a už vydaný token poslat na revocation_endpoint, viz nález 4). Výsledek pokusu pak musí být odmítnutí, ne ok:true. POZOR: 

---

## 5. [P1] PR #5 (b8) — čočka `bezpecnost`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b8/electron/main.cjs:711-734 + /Users/dan/orca/workspaces/ludone-desktop/desktop-b8/tests/auth-controller-wiring.test.js:141-159`

```
  if (
    issuer.protocol !== "https:"
    || issuer.username
    || issuer.password
    || issuer.pathname !== "/"
    || issuer.search
    || issuer.hash
  ) {
    throw new Error("Adresa přihlášení musí být čistý HTTPS origin");
  }
  return issuer.origin;

// a test, který má tvrdit, že cizí origin neprojde:
  ])("nedůvěryhodný origin %s selže bez controlleru", async (orig
```

**Problém:** resolveAuthIssuer kontroluje tvar adresy, ale ne HOSTITELE — libovolný čistý HTTPS origin projde. Nebezpečnější je to, že to vypadá pokryté: test „nedůvěryhodný origin %s selže bez controlleru" má mezi sedmi případy i "https://jiny.example" a je zelený. Je zelený z jiného důvodu: dependencies({ env: { LUDONE_ORIGIN: origin } }) přepíše CELÝ objekt env, tedy zahodí i výchozí LUDONE_OAUTH_CLIENT_ID, a přihlášení pak spadne na chybějícím clientId, ne na cizím originu. Šest ze sedmi případů (http://, ?x=1, a:b@, #x, /cesta, prázdný řetězec) resolveAuthIssuer opravdu odmítne. Jediný případ, který měří důvěru k hostiteli — a jediný, o který jde při phishingu — neměří nic.

**Scénář selhání:** Ověřeno spuštěním (probe-issuer.mjs, funkce vytažené ze skutečného main.cjs stejnou metodou jako v testu). resolveAuthIssuer({LUDONE_ORIGIN:'https://ludone-login.attacker.tld'}) vrátí 'https://ludone-login.attacker.tld' bez výjimky, a s PŘÍTOMNÝM clientId proběhne celé přihlášení: controller se vytvoří s issuerem 'https://jiny.example' a handler vrátí {ok:true}. Naostro: kdokoli, kdo umí ovlivnit prostředí aplikace (LaunchAgent, wrapper skript, upravená .plist, spuštění z terminálu s exportem), přesměruje celý OAuth tok na svůj server — shell.openExternal otevře uživateli útočníkovu přihlašovací stránku, uživatel do ní napíše firemní heslo a token se vymění u útočníka. Recenzent, který se po

**Náprava:** Do resolveAuthIssuer přidat allowlist hostitelů — dnes stačí dva správcem
schválené hostitele, produkční a labs — a všechno ostatní odmítnout s důvodem konfigurace.
Přesné hodnoty bere nasazení z neveřejné konfigurace. V testu opravit režii: env skládat
jako { ...výchozí, LUDONE_ORIGIN: origin }, aby clientId zůstal přítomný, a k případu s
cizím hostitelem přidat protějšek, který dokládá, že povolený hostitel projde. Jinak
zůstane nefunkční brána.

---

## 6. [P1] PR #5 (b8), dopadá i na PR #8 (b9) — čočka `bezpecnost`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b9/electron/auth.cjs:565-589, 320-322, 357-362`

```
          const accessToken = requiredString(tokenResponse.access_token, "access_token");
          const identity = await resolveUserIdentity(...);
          const expiresIn = Number(tokenResponse.expires_in);

          await persistEncryptedSession(app, safeStorage, { ... });

// a uvnitř persistEncryptedSession, tedy AŽ PO vydání tokenu:
async function persistEncryptedSessi
```

**Problém:** Dostupnost šifrovaného úložiště se testuje až v okamžiku zápisu, tedy po výměně kódu za token. createAuthController přitom ověřuje jen to, že objekt safeStorage EXISTUJE (řádek 357-359), ne že umí šifrovat. Když zápis selže — nedostupný keychain, tokenStorageDirectory odmítne cíl uvnitř repozitáře, plný disk, chyba práv — vyhodí se výjimka, ale už vydaný access i refresh token se nikam nezapíše a NIKDY se neodvolá. Server má živou session, o které aplikace neví a kterou nemá čím zrušit. Že s tou cestou autoři počítají, je vidět v main.cjs: duvod „uloziste" je modelovaný stav, ne teoretická větev. Stejná díra je i při selhání resolveUserIdentity (chybějící jméno nebo e-mail v odpovědi tokenu)

**Scénář selhání:** Ověřeno spuštěním (probe-uloziste.mjs, skutečný createAuthController, safeStorage.isEncryptionAvailable() → false): fake server vydá ZIVY-ACCESS-TOKEN a ZIVY-REFRESH-TOKEN, pokus skončí odmítnutím „Bezpečné úložiště systému není dostupné", session soubor nevznikne a na /revoke nepřijde ani jeden požadavek. Naostro: uživatel se zamčeným keychainem (nebo dev s LUDONE_DATA_DIR mířícím do repozitáře) vidí českou hlášku, klikne na Přihlásit znovu, a znovu, a znovu — každý klik nechá na serveru další nezrušitelný refresh token s platností v řádu dnů. Po deseti pokusech má firma deset živých session na jednom zařízení a nikdo o nich neví.

**Náprava:** Dvě věci. Za prvé: safeStorage.isEncryptionAvailable() a tokenStorageDirectory(app) volat PŘED shell.openExternal, tedy dřív, než se vůbec otevře prohlížeč — fail-closed a bez vydaného tokenu. Za druhé: obalit část za výměnou kódu tak, aby při jakékoli chybě po získání tokenu proběhl pokus o odvolání na revocation_endpoint (B9 už tu funkci má, stačí ji sdílet). A při přepsání existující session od

---

## 7. [P1] PR #9 (b11) — čočka `mazani`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b11/electron/retention.cjs:141-147`

```
module.exports = {
  RETENTION_POLICIES,
  retentionMs,
  planRetention,
  applyRetention,
};
```

**Problém:** Modul nikdo nevolá. `grep -rn "retention\|retence"` po celém worktree najde mimo samotný `electron/retention.cjs` jen `tests/retention.test.js` a popisek v `src/components/Settings.jsx`. V `main.cjs` není import, není timer, není IPC. Plán to má zadané takhle (`plan.md:124`: „| **B11** | nic | nic |“ ve sloupcích „Vlastní v main.cjs / preload.cjs“), takže po mergi PR #9 retence pořád neběží — a R23 zní doslova „Retence musí v v1 opravdu běžet“. Prahy volného místa 2 GB / 5 GB, na které se R23 odvolává (`specs/E6:67`), ve scope nejsou vůbec (O-B11-7). Patnáct zelených testů měří kód, který produkt nikdy nespustí.

**Scénář selhání:** Uživatel nainstaluje build s PR #9, nahrává schůzky. Každá nahrávka zapíše dva `.webm` do `userData/nahravky` (main.cjs:519-530 otevírá skutečné soubory, `appendRecordingChunk` do nich píše). Nic je nikdy nesmaže. R23 sama vyčísluje důsledek: „aplikace po zhruba 38 hodinách schůzek přestane nahrávat“ — konkrétně `fs.promises.open(filePath, "wx", 0o600)` v `openRecordingTrack` selže na plném disku, `createRecordingSession` hodí a nahrávání se nespustí. Uživatel přitom v Nastavení vidí „7 dní po odeslání“, tedy zprávu, že se úklid děje.

**Náprava:** Rozhodnout O-B11-1 (kdo a v jaké story modul zapojí) dřív, než PR #9 spadne do mainu, nebo v PR uvést, že R23 zůstává nesplněné a proč. Při zapojení pozor na dvě věci: (a) volání musí projít stejným `serialize` řetězem jako `createOutboundQueueStore` (electron/queue.cjs:92-96), jinak commit `keptItems` ze staršího snapshotu přepíše mezitím zařazenou nahrávku — klasický lost update na frontě, kde t

---

## 8. [P1] PR #9 (b11) — čočka `mazani`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b11/src/components/Settings.jsx:17 + /Users/dan/orca/workspaces/ludone-desktop/desktop-b11/scripts/ui-smoke.mjs:247-259`

```
-  retention: "24 hodin po odeslání",
+  retention: "7 dní po odeslání",
...
    const select = document.querySelector('.settings-select select');
    select.value = '7 dní po odeslání';
    select.dispatchEvent(new Event('change', { bubbles: true }));
...
  if (values.auto !== "true" || values.ask !== "false" || values.retention !== "7 dní po odeslání") {
```

**Problém:** Tenhle diff sám změnil výchozí hodnotu na přesně tu, kterou ui-smoke nastavuje a pak kontroluje. Před diffem byl default „24 hodin po odeslání“, takže kontrola něco měřila; po diffu je `values.retention === "7 dní po odeslání"` pravda i tehdy, když výběr vůbec nefunguje. `<select>` je řízený (`value={settings.retention}`), takže když `onChange` nic neudělá, React vrátí do DOMu tutéž hodnotu a assert projde. Jediná ostrá kontrola jediného ovladače, kterým uživatel rozhoduje o smazání svých nahrávek, se změnila v tautologii. O-B11-13 to přiznává, ale tautologie jde do mainu.

**Scénář selhání:** Kdokoli později odstraní nebo rozbije `onChange={(event) => update("retention", event.target.value)}` (refaktor Nastavení, přechod na jiný stav, překlep v klíči) — `npm run ui-smoke` zůstane zelený, protože měří default proti defaultu. Uživatel si v Nastavení přepne na „Nemazat“, aplikace to zahodí a po zapojení retence smaže jeho nahrávky podle staré hodnoty. Zelená brána přitom celou dobu tvrdí, že Nastavení funguje.

**Náprava:** Ui-smoke otočit: nejdřív přečíst a assertovat výchozí stav (`retention === "7 dní po odeslání"`), pak nastavit JINOU hodnotu (`"30 dní po odeslání"`) a assertovat, že se propsala do selectu i do `localStorage['ludone.prototype.settings']`. Stejný vzor použít i pro obě toggle položky, ať default nemůže brány přebít podruhé.

---

## 9. [P1] PR #6 (b5) — časovač do hlavního procesu — čočka `brany`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b5/tests/tray-authority.test.js`

```
const source = functionSource(mainSource, "syncTrackingTray");
    expect(source).toContain("appState.trackingOwners.add(TRACKING_STORE_OWNER_ID)");
    expect(source).toContain("appState.trackingOwners.delete(TRACKING_STORE_OWNER_ID)");
    expect(source).toContain("refreshTray()");
```

**Problém:** Jediná kontrola, že se lišta po změně časovače přepočítá, je hledání tří podřetězců v TĚLE funkce. Nic funkci nespustí a nic neověří, že ji `runTrackingMutation` vůbec zavolá — druhý test v tom bloku hlídá jen to, že registrace kanálu obsahuje text `runTrackingMutation("start")`, ne že mutace sáhne na lištu.

**Scénář selhání:** Doloženo spuštěním nad kopií, obě sabotáže ZELENÉ 161/161: (a) smazal jsem řádek `syncTrackingTray(store);` z `runTrackingMutation` (main.cjs:830) — časovač běží, ikona v liště se nikdy nepřepne na „měří čas"; (b) prohodil jsem v `syncTrackingTray` větve `add`/`delete` — lišta svítí přesně obráceně, tedy „měří čas" právě když se neměří. Uživatel podle lišty pozná, jestli mu běží fakturovaný čas; obojí je money-cesta DSK-F011/F013.

**Náprava:** Behaviorální test: spustit `runTrackingMutation` nad podstrčeným `appState`/`refreshTray` a u start / switchProject / stop / resolveRecovered změřit obsah `trackingOwners` A počet volání `refreshTray`. Textovou asertaci nechat jen jako doplněk, ne jako jediné měřidlo.

---

## 10. [P1] PR #6 (b5) — časovač do hlavního procesu — čočka `brany`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b5/tests/tracking-timer.test.js`

```
describe("vypínač DESKTOP_TIME_ENABLED", () => {
  it.each([undefined, "false", "1"])(
    "pro hodnotu %s fail-closed zakáže všechny zapisující metody",
    async (timeEnabled) => {
      const filePath = await temporaryFile();
      const store = storeFor(filePath, { timeEnabled });
```

**Problém:** Fail-closed vypínač se měří výhradně nad HODNOTOU, kterou si test sám podstrčí do `createTrackingStore`. Místo, kde se vypínač v produkci opravdu čte (`main.cjs`, `timeEnabled: process.env.DESKTOP_TIME_ENABLED`), neměří žádný test. R18 přitom říká: „Oba fail-closed — chybějící hodnota znamená vypnuto a musí mít vlastní test."

**Scénář selhání:** Doloženo spuštěním: v `getTrackingStore` jsem nahradil `timeEnabled: process.env.DESKTOP_TIME_ENABLED` za `timeEnabled: "true"` — killswitch je natvrdo zapnutý bez ohledu na prostředí a všech 161 testů zůstalo zelených. Aplikace by měřila a ukládala čas i se stopkou S2 v poloze OFF; jakmile B7+ zapojí odesílání, tečou hodiny do mzdových nákladů bez Danova rozhodnutí.

**Náprava:** Přidat test, který načte `main.cjs` (stejnou cestou jako `ipc-sender-guard.test.js` přes `Function`/stub Electronu) nebo alespoň vyextrahuje `getTrackingStore` a ověří, že hodnota jde z `process.env.DESKTOP_TIME_ENABLED` a že při nenastavené proměnné je výsledek `disabled`.

---

## 11. [P2] PR #6 (b5) — časovač do hlavního procesu — čočka `brany`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b5/tests/tracking-timer.test.js`

```
const writer = functionSource(source, "writeStateAtomically");
    expect(writer).toContain("open(");
    expect(writer).toContain('"wx"');
    expect(writer).toContain(".sync()");
    expect(writer).toContain("rename(");
    expect(writer.indexOf("rename(")).toBeGreaterThan(writer.indexOf(".sync()"));
```

**Problém:** Trvanlivost zápisu money-souboru `casovac.json` je měřena jen pozicí podřetězců ve zdrojovém textu. Táž story v B7 kvůli tomu samému problému přidala do fronty BEHAVIORÁLNÍ test pořadí (`events` pole nad podstrčeným fs, viz DAN-TODO bod 5) — časovač zůstal na textu.

**Scénář selhání:** Dvě sabotáže, obě ZELENÉ 161/161: (a) smazal jsem celý blok fsyncu adresáře za `rename` — `rename` pak není trvanlivý a pád/výpadek napájení může uzavřený úsek ztratit; test projde, protože `indexOf(".sync()")` najde fsync dat, který je pořád před `rename`; (b) zakomentoval jsem `await handle.sync();` — text `.sync()` zůstal v komentáři na stejné pozici, takže i pořadová asertace prošla.

**Náprava:** Zkopírovat do `tracking-timer.test.js` vzor z `tests/queue.test.js` („atomický zápis fsyncne data i adresář") — podstrčit `fs.promises.open/rename` a asertovat pole událostí `["write:wx","sync:wx","close:wx","rename","sync:r","close:r"]`.

---

## 12. [P1] PR #7 (b7) — odchozí fronta obou typů položek — čočka `brany`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b7/tests/queue-wiring.test.js`

```
const finish = functionSource(mainSource, "finishRecordingAndEnqueue");
    expect(finish).toContain("ownedRecordingSession");
    expect(finish).toContain("finalizeRecordingSession");
    expect(finish).toContain("enqueueRecording");
    expect(finish.indexOf("enqueueRecording")).toBeGreaterThan(
      finish.indexOf("finalizeRecordingSession"),
    );
```

**Problém:** Celý soubor `queue-wiring.test.js` (6 testů) je strukturální čtení textu `main.cjs`. To, co je v názvu story — že dokončená nahrávka SKUTEČNĚ skončí ve frontě a že se fronta po startu SKUTEČNĚ rozjede — nespouští ani jeden test. Pomocník `functionSource` navíc kotví přes `indexOf`, takže stačí, aby se hledaná jména v textu vyskytla ve správném pořadí.

**Scénář selhání:** Dvě sabotáže, obě ZELENÉ 187/187: (a) obalil jsem tělo zařazení podmínkou `if (process.env.SABOTAZ_NIKDY === "1") { ... }` — žádná nahrávka se nikdy nedostane do fronty, přesto testy prošly, protože oba podřetězce v textu zůstaly ve správném pořadí; (b) zakomentoval jsem jediný budíček fronty `void pumpOutboundQueue();` v `app.whenReady()` — komentář uspokojí `expect(ready.slice(0, 1_500)).toContain("pumpOutboundQueue()")`, takže fronta se po startu nikdy nerozjede a testy jsou zelené.

**Náprava:** Načíst `main.cjs` s podstrčeným Electronem (vzor `ipc-sender-guard.test.js`), zavolat zaregistrovanou obsluhu `recording:finish` nad fake session a změřit, že se položka objevila v `queue:list`; pumpu po startu měřit počtem volání `processNext`, ne přítomností textu.

---

## 13. [P1] PR #7 (b7) — odchozí fronta obou typů položek — čočka `brany`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b7/electron/main.cjs`

```
function queueKillswitches() {
  return {
    DESKTOP_UPLOAD_ENABLED: process.env.DESKTOP_UPLOAD_ENABLED,
    DESKTOP_TIME_ENABLED: process.env.DESKTOP_TIME_ENABLED,
  };
}
```

**Problém:** Oba vypínače z R18 jsou v produkci přečtené na jediném místě a to místo neměří žádný test. `tests/queue.test.js` testuje `processNext` s hodnotami, které si sám vyrobí (`killswitches(ENABLED_SETTING)`), takže měří rozhodovací logiku, ne bránu.

**Scénář selhání:** Doloženo spuštěním: nahradil jsem obě hodnoty za `"true"` — obě stopky jsou natvrdo zapnuté bez ohledu na `.env` — a všech 187 testů zůstalo zelených. Dnes to nic neodešle jen proto, že `unavailableQueueSend` vždy hodí `paused`; jakmile přijde skutečná odesílací vrstva, je tenhle jeden řádek jediné, co dělí nahrávky a hodiny od serveru, a nikdo ho nehlídá.

**Náprava:** Test, který vyextrahuje/zavolá `queueKillswitches()` a ověří, že pro nenastavené i pro `"false"` proměnné vrací hodnoty vedoucí na `outcome: "disabled"`, a naopak že přepínač zapne jen přesný řetězec `"true"`.

---

## 14. [P1] PR #8 (b9, odhlášení) — čočka `plan`

**Kde:** `/Users/dan/orca/workspaces/ludone-desktop/desktop-b9/electron/main.cjs:833`

```
handleValidated("auth:logout", ["panel"], async () => {
  const result = await logoutAuthController.logout();
  if (result.signedOutLocally) {
    try {
      updateTray("signed-out");
    } catch (error) {
```

**Problém:** B9 křísí `updateTray(nextState)` — přesně tu funkci, kterou `decisions.md` O13 a `specs/E3` §3 přikazují odstranit („`updateTray(nextState)` **nahradit funkcí `refreshTray()` BEZ ARGUMENTU**", podmínka hotovo: „`grep -n 'updateTray' electron/main.cjs` nevrátí nic"). Na větvi b9 (stack main→b4→b8→b9) funkce ještě existuje, na větvi b3/b5 už ne — ověřeno grepem, `desktop-b5/electron/main.cjs` má jen `refreshTray()`. Zároveň je to editace mimo vlastnictví: `plan.md` §2 dává B9 v `main.cjs` blok `auth:logout`, lišta patří B3. PR přitom tvrdí `zmenenychSouboruMimoVlastnictvi: 0` a v úvodu slibuje „a lišta přejde do stavu ‚nepřihlášeno'". Kanárek B3 (`tests/tray-authority.test.js:159`) hlídá jen `

**Scénář selhání:** Sloučí se oba stacky do `main`. Git nehlásí konflikt (B3 maže definici jinde v souboru, B9 přidává volání v bloku `auth:logout`). Uživatel klikne Odhlásit: token se odvolá i smaže správně, ale `updateTray` už neexistuje ⇒ `ReferenceError`, který spolkne vlastní `try/catch` B9 a zaloguje ho jako „Stav ikony po odhlášení se nepodařilo změnit". Lišta zůstane viset na `idle`/`tracking`, protože `appState.signedIn` nikdo nepřepne na `false`. Test to nechytí: `tests/logout.test.js` si `updateTray` PODSTRKUJE jako parametr do `Function("require","app","safeStorage","handleValidated","updateTray","console", registration)` a pak tvrdí `expect(updateTray).toHaveBeenCalledWith("signed-out")` — měří vla

**Náprava:** V bloku `auth:logout` nastavit `appState.signedIn = false` a zavolat `refreshTray()` (blok patří B3 — dohodnout vlastnictví a zapsat ho jako BD-N, stejně jako BD-N8 zapsalo crash hooky). Test přepsat tak, aby identifikátor bral z produkčního `main.cjs`, ne z injektovaného argumentu; a doplnit do kanárku B3 i zákaz VOLÁNÍ `updateTray(`, ne jen definice.

---

## 15. [P2] PR #9 (b11, retence) — čočka `plan`

**Kde:** `PR #9 body (sekce „Čtyři osy") vs /Users/dan/Dev/ClaudeCode/ludone-desktop/docs/changes/desktop-v1/spec.md §3`

```
PR #9: „| delivery | `no-code` | **`pr-open`** |" a „| exposure | `disabled` | `disabled` |"
spec.md §3: „| `DSK-F015` | Nastavení: účet, zvuk, záznamy, připomínky, diagnostika | normal | approved | coded | labs | unverified |"
```

**Problém:** PR hlásí výchozí stav dvou os jinak, než ho má zmrazená matice: `delivery` je ve specu `coded` (ne `no-code`) a `exposure` je `labs` (ne `disabled`). Rozpor je i uvnitř téhož diffu — `DAN-TODO.md`, který PR přidává, v bodě **O-B11-10** píše: „Potvrdit, že `exposure` DSK-F015 zůstává `labs`, ne `disabled`. Matice má F015 už na `labs`." Vykonavatel si toho tedy všiml a tělo PR přesto tvrdí opak. Bod **O-B11-11** navíc zpochybňuje i samotné přiřazení funkce („Patří mazací mechanismus pod DSK-F015, nebo má vzniknout DSK-F017?"), takže Feature ID v hlavičce PR je nejisté.

**Scénář selhání:** Kdo bude po vlně srovnávat matici §3 podle os hlášených v PR, zapíše F015 zpátky na `no-code`/`disabled` — tedy o dva stupně dozadu proti tomu, co je v `main` (Nastavení běží v labs od dřívějška). Matice se čtyřmi osami tím začne lhát přesně tím způsobem, kvůli kterému §3 vznikla („v srpnu tu devět zelených bran hlásilo hotovou práci, která se nikdy nespustila"), jen opačným směrem.

**Náprava:** V PR opravit řádek `delivery` na `coded → pr-open` a `exposure` na `labs → labs`, nebo doložit, proč se má F015 v matici posunout dozadu. A rozhodnout O-B11-11: buď retenci vést pod F015, nebo založit `DSK-F017` — dnes je mazací mechanismus přiřazený k funkci „Nastavení", kterou nepopisuje.

---

## Nálezy, které skeptici VYVRÁTILI

Uvádím je schválně — ověřovací kolo, které jen potvrzuje, není ověřovací kolo.

- **PR #7 (b7)** — Tlačítko „Zkusit teď“ smaže `nextAttemptAt` VŠEM čekajícím položkám a hned jednu odešle — každý klik je tedy plnohodnotný pokus a exponenciální odstup (30 s zák
  - *proč vyvráceno:* VYVRÁCENO — mechanika je popsaná správně, ale scénář v PR #7 NELZE vyvolat: chybí obě jeho podmínky (tlačítko i síťový `send`), a část, kterou nález viní, není kód téhle story.

**1. Tlačítko „Zkusit teď" v aplikaci NEEXISTUJE.** `retryQueue: () => ipcRenderer.invoke("queue:retry")` je v `electron/p
- **PR #7 (b7)** — Stav `odesila` ani zvýšené `attempts` se NIKDY nedostanou na disk před voláním `send`. `processNext` si `sendingQueue` drží jen v paměti a `processOne` commituj
  - *proč vyvráceno:* POPIS KÓDU JE PRAVDIVÝ, ALE SCÉNÁŘ SELHÁNÍ V PR #7 NEEXISTUJE — nálezem popsaná cesta se v tomto diffu nedá vyvolat žádným vstupem.

CO SEDÍ. Mechanismus jsem nezávisle reprodukoval. `src/lib/queue.js:313-321` opravdu drží `sendingQueue` (s `attempts+1` a `state: "odesila"`) jen v paměti a `electron
- **PR #8 (b9), zdroj v PR #5 (b8)** — B9 správně udělalo revocation_endpoint VOLITELNÝM a v B9-odhlaseni.md:247 to i zdůvodnilo („povinný by rozbil begin() na serveru, který ho nevrací"). Stejný arg
  - *proč vyvráceno:* MECHANISMUS JE PRAVDIVÝ, ALE NÁLEZ JAKO P1 NEOBSTOJÍ — čtyři z jeho pěti nosných tvrzení jsem vyvrátil.

CO SE POTVRDILO (spustil jsem to, ne dočetl):
Probe proti skutečnému `discoverEndpoints` a `createLogoutController` z desktop-b9 vrátil přesně to, co nález popisuje:
  A) discovery HODILA: TypeEr
- **PR #8 (b9)** — Odvolá se jen JEDEN token. Když session má refresh token (běžný stav), access token se na revocation_endpoint nikdy nepošle — a přesto se vrátí serverRevoked: t
  - *proč vyvráceno:* VYVRÁCENO. Nález stojí a padá s větou „Pokud ji [kaskádu] server nedělá" a sám přiznává, že chování serveru nikdo neměřil. Změřil jsem ho — server kaskádu dělá, bezpodmínečně a v jedné transakci. Řetězec důkazů:

1) ŽIVĚ ZMĚŘENO — issuer je `https://app.ludone.cz` (`electron/main.cjs:712`) a jeho di
- **PR #9 (b11)** — Retence unlinkne přesně ten řetězec, který stojí v položce fronty. Neexistuje žádná kontrola, že cesta leží pod `userData/nahravky`: nic ji neresolvuje, neporov
  - *proč vyvráceno:* MECHANISMUS POTVRZEN, DOSAŽITELNOST VYVRÁCENA. Nález je jako P0 („kód jde do mainu bez guardu" + scénář „mění periodický úklid na smaž tenhle soubor") nepodložený, protože popsaná cesta v aplikaci NEEXISTUJE.

CO SEDÍ (ověřeno)
Citát je doslovný a `applyRetention` opravdu unlinkne libovolný řetězec.
- **PR #9 (b11)** — Retence prochází POLOŽKY FRONTY, ne adresář nahrávek. Do fronty se položka dostane jediným způsobem — přes `recording:finish` → `finishRecordingAndEnqueue` (jed
  - *proč vyvráceno:* MECHANISMUS SEDÍ, ZÁVĚR NE. Všechny citace jsem ověřil doslova: `planRetention` opravdu iteruje `Array.isArray(queue?.items) ? queue.items : []` (electron/retention.cjs:74), `enqueueRecording(` má v main.cjs jediný výskyt na řádku 832 uvnitř `finishRecordingAndEnqueue`, a `finalizeRecordingSession(s
- **PR #9 (b11)** — Volba retence žije v `localStorage` rendereru, ale mazat bude hlavní proces. Mezi nimi není žádný kanál: `preload.cjs` tenhle diff nemění a plán B11 vlastnictví
  - *proč vyvráceno:* VYVRÁCENO — scénář selhání není reprodukovatelný a jeho nosná technická premisa je nepravdivá.

**1) Premisa „jediné, co main dnes vidí, je natvrdo napsaná konstanta" je FALEŠNÁ.**
Hlavní proces nevidí ŽÁDNOU retenční hodnotu — ani konstantu, ani modul. Doslovný výpis importů `/Users/dan/orca/worksp
- **PR #7 (b7, fronta)** — B7 tiše předefinovala, co který vypínač kryje. `spec.md` §1 říká doslova „Desktop ukládá na disk a řadí do fronty, ale **odesílání zůstává za vypnutým `DESKTOP_
  - *proč vyvráceno:* VYVRÁCENO ze tří nezávislých směrů: zmrazený plán tohle přiřazení sám předepisuje, R18 je splněné doslova, a scénář selhání v kódu neexistuje.

**1) Zmrazený `plan.md` přiřazuje rozhodnutí C2 přímo story B7 — žádné nové BD-N nebylo potřeba.**
`docs/changes/desktop-v1/plan.md:76`, sekce §2 Task DAG:

- **PR #6 (b5, časovač do main)** — `decisions.md` BD-N8 o kanálu `tray:report-facts` říká: „🔴 **Je to DOČASNÝ stav.** Až přistane **B5** (časovač v hlavním procesu) a **B8** (skutečné přihlášení
  - *proč vyvráceno:* Mechanismus, který nález popisuje, v kódu existuje — ale jeho tři nosné závěry (že jde o odchylku B5, že to B5 zhoršila a že to B5 měla opravit) neobstojí.

**1) Renderer se atrapy nedotkl SCHVÁLNĚ — packet to B5 přímo ZAKAZUJE.** `b5.diff` sahá jen na `electron/main.cjs`, `electron/preload.cjs`, `e
- **PR #6 (b5, časovač do main)** — Změřeno z diffu: B5 přidává 491 řádků mimo `tests/` (418 + 66 + 7), tedy 2,2× odhad plánu a téměř dvojnásobek prahu, za kterým se podle §2b PR dělí. PR o rozsah
  - *proč vyvráceno:* Měření nálezu je správné, ale normativní závěr neobstojí.

OVĚŘENO JAKO PRAVDIVÉ: b5.diff přidává mimo tests/ 491 řádků (electron/tracking.cjs 418 + main.cjs 66 + preload.cjs 7), a to bez jediného smazaného řádku a bez přejmenování (`new file mode 100644`, žádný `similarity index`). Nezávisle potvrz
