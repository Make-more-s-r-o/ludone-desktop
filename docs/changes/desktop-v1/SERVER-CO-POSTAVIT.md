# Serverová strana: co postavit v `ludone-app`

**Pro Dana, 2. 9. 2026.** Ptal ses, jestli už víme přesně, co budeme potřebovat, nebo se to
ještě může měnit. **Odpověď: ze tří čtvrtin je to hotové a stabilní, jedna věc je otevřená
a jedna se ještě vůbec nezačala.**

---

## Rychlá orientace

| část | stav | kde |
|---|---|---|
| **Příjem nahrávky** | ✅ **specifikováno**, 329 řádků, 10 kroků | [`specs/E5-server-prijem.md`](../../../specs/E5-server-prijem.md) |
| **Tvar dat, která desktop pošle** | ✅ **hotový a zmrazený** — `schemaVersion: 1` | níž v §2 |
| **Jak se desktop autentizuje** | 🔴 **NEVYŘEŠENO** — chybí scope | níž v §3 |
| **Příjem naměřeného času** | ⏸️ **MIMO ROZSAH** — odloženo, kontrakt určí aplikace (BD-N38) | níž v §4 |

---

## 1. Co už je hotové: `specs/E5-server-prijem.md`

Napsané 24. 8., deset kroků: SQL migrace a rollback · Drizzle definice · streamové úložiště
· **chunked/resumable upload (4 routy)** · ffmpeg remux kvůli chybějící délce ve WebM ·
RBAC default-deny od prvního commitu · adresáře a práva na hostu · brány repa · ostré ověření
druhým účtem.

**Tuhle část neotvírej znovu** — je promyšlená a odpovídá tomu, co desktop dělá.

✅ **Krok 1 UŽ NENÍ BLOCKER — změřeno 2. 9. 2026.** SSH přístup funguje;
konkrétní cíl, účet a název kontejneru proxy jsou v neveřejné provozní dokumentaci.
Měření proběhlo na stroji obsluhujícím `app.ludone.cz`.

```
client_max_body_size 50m        ← efektivní globální konfigurace
app.ludone.cz to NEPŘEPISUJE    ← produkční vhost nemá vlastní limit
```

🔴 **Hodinová stopa má 40–120 MB, strop je 50 MB.** Upload v jednom kuse spadne. Buď drž
kousky pod 50 MB, nebo pro ten endpoint limit zvyš — a **změř, že to platí**, ne že to je
v konfiguraci. Sousední interní vhost už streamovaný upload řeší
(`proxy_request_buffering off`); jeho umístění je v neveřejné provozní dokumentaci.

## 2. Tvar dat: zmrazený, spolehni se na něj

Obojí vzniká v `src/lib/queue.js` a je pokryté testy. **Tohle se nezmění.**

**Nahrávka** (`kind: "recording"`): `clientRecordingId` (GUID, idempotenční klíč) ·
`manifest` · dvě stopy `microphone` + `system`.

**Naměřený čas** (`kind: "time-entry"`):

```
clientTimeEntryId : GUID   — idempotenční klíč, vzniká na desktopu při STARTU měření
projectId         : GUID   — Tabidoo id projektu
startedAt         : ISO 8601 řetězec
endedAt           : ISO 8601 řetězec
```

🔴 **Desktop NIKDY neposílá sazbu.** `enqueueTimeEntry` má tvrdou kontrolu: jakékoli pole,
jehož název obsahuje `rate` nebo `sazb`, **shodí zápis výjimkou**. Peníze počítá server, ne
klient — a je to vynucené kódem, ne domluvou. **Stejnou kontrolu doporučuju na serveru**:
přijde-li sazba, je to chyba klienta, ne vstup.

⚠️ **Idempotence je na `clientRecordingId` / `clientTimeEntryId`.** Desktop opakuje odeslání
při každém selhání sítě, takže **server musí týž GUID podruhé odmítnout nebo vrátit původní
záznam** — nikdy nezaložit druhý. U času to znamená dvojí vykázání, tedy peníze.

## 3. 🔴 OTEVŘENÉ: jak se desktop autentizuje

**Tohle je jediná věc, která se ještě může změnit, a je potřeba ji rozhodnout dřív než kód.**

Změřeno naživo 2. 9. proti produkci — server zná **jen dva scopy**:

```
scopes_supported: ["mcp:read", "mcp:draft"]
```

**Ani jeden neumožňuje nahrát soubor nebo zapsat čas.** Desktop dnes žádá `mcp:read`, dostane
token — a s ním nemá právo odeslat vůbec nic. Proto může frontu jen plnit, ne vyprazdňovat.

**Tři cesty, doporučuju A:**

| | jak | pro | proti |
|---|---|---|---|
| **A** nový scope `mcp:upload` ⭐ | přidat do `scopes_supported`, endpointy ho vyžadují | drží se stávající OAuth vrstvy, kterou už umíme; souhlas řekne člověku pravdu („aplikace bude smět nahrávat") | klient se musí přeregistrovat s novým scope |
| **B** rozšířit `mcp:draft` | žádná změna registrace | `mcp:draft` dnes znamená „připravit návrh ke schválení" — přidat pod něj nahrávání souborů je matoucí a rozšiřuje práva tiše |
| **C** jiná cesta mimo OAuth | vlastní klíč zařízení | obchází celý mechanismus souhlasu, který už funguje — **nedoporučuju** |

⚠️ **U varianty A počítej s tím, že se změní i souhlasová obrazovka.** Audit našel, že už dnes
`mcp:read` dovoluje tři mutace, ale obrazovka souhlasu mluví jen o čtení — text a skutečnost
se rozcházejí. Při přidávání scope je to dobrá příležitost to srovnat.

## 4. ⏸️ ODLOŽENO: příjem naměřeného času — a kontrakt určí APLIKACE

🔴 **Rozhodnutí BD-N38 (2. 9. odpoledne): LuTrack se na serveru zatím NEŘEŠÍ.**
A až na něj dojde, **tvar dat určí `ludone-app`, ne desktop.**

⚠️ **Oprava dřívějšího tvrzení v tomhle dokumentu:** §2 psalo, že tvar `time-entry` je
„zmrazený, spolehni se na něj". **Neplatí.** Byl to popis toho, co desktop dnes umí, ne
závazný kontrakt — a Dan rozhodl, že směr má být opačný.

Zbytek téhle sekce je tedy **jen popis současného stavu desktopu**, ne zadání. Neřiď se jím.

---

### (původní popis, už není zadáním)

`E5` řeší **jen nahrávky** — slovo LuTrack ani „časový záznam" v něm nepadne ani jednou
(změřeno: 0 výskytů).

Desktop přitom čas do fronty **už zařazuje** (mergnuto dnes v PR #15). Chybí tedy protistrana:
endpoint, který položku `kind: "time-entry"` přijme a založí výkaz.

**Je to výrazně menší úkol než nahrávky** — žádné streamování, žádný remux, jen malý JSON.
Ale platí u něj přísnější pravidlo: **je to money cesta.** Dvakrát přijatý `clientTimeEntryId`
= dvakrát vykázaný čas = špatně vyúčtovaný projekt.

## 5. Pořadí, které doporučuju

1. **Rozhodnout scope (§3)** — bez toho nemá smysl psát endpointy, protože nebude čím se k nim
   přihlásit.
2. **Změřit nginx strop na hostu (E5 krok 1)** — jediná věc, kterou nezvládne nikdo jiný.
3. **Postavit příjem času (§4)** — malý, rychlý, a odemkne celou časovou agendu.
4. **Postavit příjem nahrávek podle E5** — největší kus, ale nejlíp popsaný.

**Proč čas před nahrávkami:** je desetkrát menší, desktop ho už umí posílat, a dá se na něm
ověřit celý řetěz (scope → token → idempotence → zápis) na datech, která se vejdou do jednoho
JSONu. Až bude fungovat, nahrávky přidají jen velikost, ne novou nejistotu.

## 6. Co se NEZMĚNÍ, i kdyby se cokoli jiného hnulo

- tvar položek fronty (`schemaVersion: 1`) a jejich idempotenční klíče
- že desktop **neposílá sazby ani peněžní hodnoty**
- že desktop **opakuje odesílání** a server musí být idempotentní
- že se přihlašuje **OAuth 2.1 + PKCE (S256)** proti `app.ludone.cz` — ověřeno naostro,
  token uložený zašifrovaně přes `safeStorage`

---

**Zdroje, ze kterých tenhle dokument vznikl** — všechno měřené 2. 9. 2026, ne odhadované:
živý dotaz na `/.well-known/oauth-authorization-server` · audit `ludone-app/src/mcp/oauth/**`
(read-only) · `src/lib/queue.js` · `specs/E5-server-prijem.md` · dvě skutečná přihlášení
proti produkci.
