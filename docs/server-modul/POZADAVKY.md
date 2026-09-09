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
| P1 | **Postavit `stahnout.ludone.cz`** — vhost, kořen `/opt/makemore-data/stahnout/desktop/`, TLS certifikát pro tenhle název | serverová session | `nový` | Změřeno z desktopu 9. 9.: doména míří na `23.88.61.12`, ale server odpovídá certifikátem pro `data.ludone.cz` (SAN tenhle název neobsahuje), adresář `/opt/makemore-data/stahnout` **neexistuje** a v konfiguraci nginxu není o `stahnout` zmínka. TLS drží dockerový `makemore-nginx` + `makemore-certbot`. Detail v P1a. |
| P1a | Potvrdit, jestli smí desktopová session na ten stroj sahat, nebo to udělá serverová | serverová session | `nový` | Dan to schválil dopředu („vhost, kořen, scp stávajícím klíčem, TLS přes certbot"), ale ten nginx obsluhuje i produkční `data.ludone.cz`. Desktopová session do produkce sahat nechce naslepo. |
| P2 | **Přijmout `Authorization: Bearer` na uploadových routách** (nebo jinou cestu, která nevyžaduje druhé přihlášení) | serverová session | `nový` | Viz „Rozhodnutí, které visí" níž. Toto je nejlevnější cesta z pohledu uživatele: nemusí dělat nic navíc. |
| P3 | Poloha killswitche `isNahravkyUploadEnabled()` na labs i prod | serverová session | `nový` | Serverová session sama upozornila, že z repozitáře to určit nejde a první ostrý pokus může vrátit 503 `storage_disabled`. Desktop to už umí odlišit od přechodné chyby (PR #113), ale rád bych věděl polohu předem, ať ostrý test nezačne falešným poplachem. |

## Hotové a doložené

| # | Co | Kdo | Doložení |
|---|---|---|---|
| H1 | Nativní cesta posílá stejná fakta jako prohlížeč (`clientRecordingId` se stopou, `declaredCaptureSources`) | desktop | PR #110 |
| H2 | Nahrávka jen s mikrofonem se z desktopu odešle | desktop | PR #111. Do té doby padala **trvalou** chybou — serverová session data marně čekala. |
| H3 | Cesta ze stavu `selhalo` zpět do fronty | desktop | PR #112 |
| H4 | 503 se rozlišuje podle těla, ne podle statusu | desktop | PR #113. Serverová session doložila tři různé stavy pod jedním statusem. |
| H5 | Kontrakt přihlášení změřen (cookie, `dbId`, jednostopé nahrávky) | serverová session | Její zpráva 9. 9., cituje vlastní zdrojové soubory. Opravila přitom naši premisu: `session.user.id` neexistuje. |

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
