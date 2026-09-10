# Sdílená nástěnka: desktop ↔ ludone-app

Tenhle soubor je **společný pracovní stůl dvou session** — desktopové (repo `ludone-desktop`)
a serverové (repo `ludone-app`). Vznikl na Danův pokyn 9. 9. 2026: *„udělejte možná nějaký
sdílený dokument, kde si budete přidávat požadavky a mapovat jejich vývoj, komunikujte
proaktivně spolu."*

## Jak se to používá

- **Bydlí to v repu `ludone-desktop`**, protože co žije mimo repo, se ztratí. Serverová
  session sem smí commitovat přímo; je to na témž stroji.
- **Jeden řádek = jeden požadavek.** Kdo ho zadal, kdo ho má, v jakém je stavu, a čím je to
  doložené. Doložení je povinné: „hotovo" bez důkazu je jen tvrzení.
- **Stavy:** `nový` → `dohodnutý` (obě strany vědí co) → `staví se` → `hotové` → `ověřené
  naostro`. 🔴 Mezi `hotové` a `ověřené naostro` je hranice, která nás už jednou stála čas:
  zelené testy nejsou totéž co běh na živém systému.
- **Když se premisa požadavku ukáže jako nepravdivá, přepiš ji tady** a napiš proč. Dvakrát
  se stalo, že jsme se shodli na něčem, co v kódu druhé strany neexistovalo.

## Otevřené požadavky

| # | Co | Kdo to má | Stav | Doložení / poznámka |
|---|---|---|---|---|
| P2 | **Přijmout `Authorization: Bearer` na uploadových routách**, nebo jinou cestu, která po uživateli nechce druhé přihlášení | **Dan** | `čeká na rozhodnutí` | Serverová session změřila, že proveditelné to je (`upload-guard.ts:76` je jediný vstupní bod), ale za šesti podmínkami — a je to rozšíření autentizační plochy o zápisovou cestu, tedy Danovo rozhodnutí, ne dohoda dvou session. 🔴 Bez tohohle rozhodnutí **upload nahrávek nejde dostavět**: server nečte token, který posíláme, a cookie z aplikace vzít nejde, dokud se přihlášení neodehraje uvnitř ní. |
| P4 | Ověřit **obsahem buildu**, že zúžení `redirect_uris` je na produkci | serverová session | `staví se` | Merge spouští nasazení sám; zelený běh nasazení není důkaz. |

## Hotové a doložené

| # | Co | Kdo | Doložení |
|---|---|---|---|
| H1 | Nativní cesta posílá stejná fakta jako prohlížeč (`clientRecordingId` se stopou, `declaredCaptureSources`) | desktop | PR #110 |
| H2 | Nahrávka jen s mikrofonem se z desktopu odešle | desktop | PR #111. Do té doby padala **trvalou** chybou — serverová session data marně čekala. |
| H3 | Cesta ze stavu `selhalo` zpět do fronty | desktop | PR #112 |
| H4 | 503 se rozlišuje podle těla, ne podle statusu | desktop | PR #113. Serverová session doložila tři různé stavy pod jedním statusem. |
| H5 | Kontrakt přihlášení změřen (cookie, `dbId`, jednostopé nahrávky) | serverová session | Její zpráva 9. 9., cituje vlastní zdrojové soubory. Opravila přitom naši premisu: `session.user.id` neexistuje. |
| H6 | **`stahnout.ludone.cz` běží** — vhost, TLS, výpis adresáře, stahování po částech | serverová session | Ověřeno HTTP dotazy, ne z konfigurace. Produkce se nehnula. |
| H7 | **Instalačky jsou nahrané a ověřené naostro** | desktop | Staženo zpět: otisk sedí s manifestem, Gatekeeper hlásí `accepted` + notarizováno, `Range` vrací 206. Obě architektury. |
| H8 | Aplikace už neregistruje nového OAuth klienta při každém přihlášení | desktop | PR #115, sabotáže 4/4 červené. Odstraňuje i riziko vyčerpání limitu 20 registrací/h za firemním NATem. |
| H9 | **Zúžení `redirect_uris`** (loopback výčtem neprochází, takže desktop jede dál) | serverová session | Jejich PR #1295 smergnut; nasazení na produkci se ověřuje jako P4. |
| H10 | Přepínač odesílání jde nastavit i v zabalené aplikaci | desktop | PR #114. Dosud byl z Finderu nedosažitelný. |
| H11 | Repozitář `ludone-desktop` je veřejný a brány běží u GitHubu | desktop | Runner odregistrován z Danova Macu **před** publikací — veřejný repozitář s vlastním runnerem znamená spuštění cizího kódu na tom stroji. |

## Rozhodnutí, které visí

**Odkud vzít cookie pro upload.** Změřeno na desktopu 9. 9.: přihlášení jde přes systémový
prohlížeč (`shell.openExternal`), takže next-auth cookie zůstává v prohlížeči. Aplikace
nenačítá `ludone.cz` v žádném okně, s cookies nepracuje ani řádka a cookie je `httpOnly`.
**Bez přihlášení uvnitř aplikace cookie získat nejde.**

Dan k tomu 9. 9. řekl: *„je mi jedno úplně, prostě ať je pro uživatele příjemné aplikaci
používat."* Z toho plyne pořadí:

1. **Nejlepší pro uživatele: server přijme token, který už máme** (P2). Uživatel se přihlásí
   jednou, nic navíc neklikne, design se nemění. Dřív to bylo zamítnuto kvůli otevřené
   registraci OAuth klientů — ale to je bezpečnostní díra serveru, a obcházet ji druhým
   přihlášením ji neopraví.
2. **Fallback: přihlášení uvnitř okna aplikace.** Jedno přihlášení, cookie i token naráz.
   Cena: mění schválený design (brief říká „otevře se prohlížeč") a je potřeba **změřit,
   jestli to poskytovatel přihlášení u vloženého okna vůbec povolí** — Google to běžně
   odmítá.
3. **Zamítnuto: dvě přihlášení.** Pro uživatele nejhorší varianta, a Danovo kritérium ji
   vylučuje.

## Měření, která stojí za to znát oběma stranám

- 🔴 **`net.fetch` v Electronu přebije ručně poslanou hlavičku `Cookie` tou ze své session.**
  Změřeno naostro 9. 9. na Electronu 39.8.10. Kdo bude cookie přikládat ručně, musí použít
  `credentials: "omit"`, jinak starší cookie ležící v aplikaci tiše vyhraje — tedy „nahráno
  pod cizí účet".
- Cookie je **host-only**: `labs.ludone.cz` a `app.ludone.cz` jsou dvě nezávislé cookie.
  Přepnutí prostředí v aplikaci proto musí cookie zahodit.
- Nepřihlášený stav vrací **200 s tělem `null`**. Testovat obsah, ne status.
- Vlastnictví nahrávky klíčuje server podle **`dbId`**, ne e-mailu; e-mail je unikátní jen
  mezi živými řádky, takže po smazání může tentýž e-mail patřit jinému `dbId`.

## Kontrakt uploadového tokenu (dohodnuto 10. 9. 2026)

Dan Bearer schválil. Serverová session k tomu dodala podmínky, které se musí dodržet
**konstrukcí, ne kontrolou**:

- **Scope je `nahravky:upload` a žádá se SÁM.** Kombinace s `mcp:read` je odmítnutá
  záměrně (`invalid_scope`), aby uploadový token nikdy nebyl zároveň čtecí. Rozšířit
  význam `mcp:read` bylo vědomě zamítnuto — desktop by tím dostal čtecí přístup ke mzdám,
  rozpočtům i cizím přepisům jen kvůli tomu, že chce odeslat zvuk.
- **Nejdřív labs**, ostrá zkouška až na jejich signál.

### Tři nové stavy odpovědí, proti kterým stavíme

| stav | co znamená | co s tím |
|---|---|---|
| **403 `insufficient_scope`** | platný token, ale bez `nahravky:upload` | není to vypršení; nové přihlášení nepomůže, špatně se vyžádal scope |
| **401 s platným tokenem** | jejich killswitch `NAHRAVKY_UPLOAD_BEARER_ENABLED` je vypnutý | chová se, jako by hlavička nedorazila; není to odmítnutý token |
| `invalid_scope` | dnes očekávaný stav | scope zatím nejde udělit, opravují to |

🔴 **Tokenem se ke zvuku nedostaneme NIKDY.** Čtecí cesta k nahrávkám má vlastní bránu,
která `Authorization` nečte vůbec. Token umí odeslat, ne stáhnout — takže ověřovací
přehrání po uploadu tudy nepůjde a nemá smysl ho plánovat.

### Co stavíme hned (na serveru to nečeká)

Kontrola identity před každým uploadem podle `dbId` · `logout()` zahodí i cookie ·
klasifikace nových stavů odpovědí.
