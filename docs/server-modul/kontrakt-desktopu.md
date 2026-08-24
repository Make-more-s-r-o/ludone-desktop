# Kontrakt mezi desktopovou frontou a serverem

## Stav kontraktu

Jde o kontrakt pro budoucí serverový příjem, ne o tvrzení, že desktop dnes odesílá.
Fronta se staví odděleně a podle D4 zůstává síťové odesílání vypnuté.
Navíc dosavadní OAuth token nemá upload scope; server musí před aktivací kontraktu
vyřešit jednu z autorizačních variant v dokumentu `autentizace.md`.

Všechny odpovědi jsou JSON s `Content-Type: application/json` a identifikátorem požadavku
v `X-Request-Id`. Autorizovaná volání posílají `Authorization: Bearer <token>` a server
na každé routě znovu ověří vlastníka, modulový přístup a firemní scope.

## 1. Založení nebo obnovení uploadu

`POST /api/desktop/recordings`

Povinné hlavičky jsou `Authorization`, `Content-Type: application/json` a
`Idempotency-Key: <clientRecordingId>`.
Tělo obsahuje `clientRecordingId`, `manifestSha256`, `startedAt`, `endedAt`, klientský
`durationMs`, volitelný `projectId` a `calendarEventId` a přesně dvě položky `tracks`:
`{kind: "microphone"|"system", sizeBytes, sha256, mime}`.

Nový upload vrátí `201`:

```json
{
  "recordingId": "server-uuid",
  "state": "recorded",
  "idempotent": false,
  "uploadedBytes": { "microphone": 0, "system": 0 }
}
```

Opakování vrátí `200`, stejné `recordingId`, `idempotent: true` a skutečné offsety
obou stop. Desktop bere offset vždy ze serveru, nikoli ze svého odhadu v manifestu.

## 2. Odeslání části stopy

`PUT /api/desktop/recordings/{recordingId}/tracks/{kind}`

Tělo jsou syrové bajty jedné části. Hlavičky obsahují `Content-Type:
application/octet-stream`, `Content-Length`, `Content-Range: bytes A-B/total` a
`X-Chunk-Sha256`. Doporučená část má 8 MiB a klient posílá nejvýše dvě souběžná
volání; konkrétní serverový limit je součást nasazené konfigurace.
Server přijme bajty jen tehdy, když `A` odpovídá aktuálnímu uloženému offsetu.

Úspěch vrátí `200` s `{"kind":"microphone","uploadedBytes":8388608}`.
Stejná část se stejným hashem je idempotentní no-op.
Pokud spojení skončí uprostřed, server nepublikuje neúplnou temp část.
Po obnovení desktop zopakuje inicializační volání, převezme potvrzené offsety a
pokračuje od prvního nepotvrzeného bajtu; hodinová schůzka se dvěma stopami se neposílá
jako jediné tělo a server ji nikdy celou nedrží v paměti.

## 3. Dokončení

`POST /api/desktop/recordings/{recordingId}/complete`

Tělo zopakuje konečnou velikost a SHA-256 obou stop.
Server streamově přepočítá hashe a vrátí `201` nebo při opakování `200`:

```json
{
  "recordingId": "server-uuid",
  "state": "uploaded",
  "uploadedBytes": { "microphone": 62914560, "system": 73400320 }
}
```

Odpověď nečeká na remux ani přepis. Server po potvrzení atomicky označí obě stopy
za uložené a asynchronně je připraví k přepisu.
Opakování `complete` nesmí založit další práci ani další nahrávku.

## Idempotence

Klíč `clientRecordingId` vytváří desktop jako náhodné UUID ještě před vznikem
manifestu E4 a používá jej i jako `Idempotency-Key`.
Server garantuje unikátnost databázově na `(user_id, client_recording_id)`.
Při shodě klíče a shodě neměnných metadat vrátí existující záznam a jeho offsety.
Při shodě klíče, ale jiném manifest hash, druhu stopy, velikosti nebo hashi vrátí
`409 idempotency_conflict`; data nesloučí ani nepřepíše.
Obsahová deduplikace nikdy neprobíhá napříč uživateli.

## Chybové stavy a chování klienta

| HTTP | Kód | Chování fronty |
|---|---|---|
| 400 | `invalid_request` | Trvalá chyba manifestu; označit položku jako chybnou. |
| 401 | `unauthorized` | Jednou obnovit token; `invalid_grant` pozastaví frontu bez spotřeby pokusů. |
| 403 | `forbidden` / `company_out_of_scope` | Neopakovat automaticky; zachovat lokální data a zobrazit důvod. |
| 409 | `offset_mismatch` | Převzít `uploadedBytes` ze serveru a pokračovat; nepočítat jako pokus. |
| 409 | `idempotency_conflict` | Zastavit danou položku; vyžaduje diagnostiku, ne nové ID. |
| 411 | `length_required` | Chyba klienta; část znovu sestavit s délkou. |
| 413 | `payload_too_large` | Zmenšit část v mezích serverem oznámeného limitu. |
| 422 | `chunk_hash_mismatch` | Poslat danou část znovu; po třech neshodách zastavit jako chybu. |
| 429 | `rate_limited` | Respektovat `Retry-After`. |
| 500–599, 408, síť | `retryable` | Exponenciální backoff s jitterem, data zůstanou ve frontě. |
| 503 | `upload_disabled` | Serverový fail-closed; ponechat ve frontě a nezahlcovat server. |

## Killswitch `DESKTOP_UPLOAD_ENABLED`

| Hodnota | Význam | Povinné chování |
|---|---|---|
| `true` | Zapnuto | Pumpa smí po splnění autorizace provádět síťová volání. |
| `false` | Vypnuto | Nahrávky se zařazují, ale pumpa neotevře žádné upload spojení. |
| nenastaveno | Chybějící konfigurace | Chová se stejně jako `false` (fail-closed). |

Žádná jiná hodnota se nesmí pravdivostně vyhodnotit jako zapnutí.
Killswitch neříká, že je server autorizovaný: i při `true` musí existovat platný
upload scope a serverové povolení.

Při vypnutí se nové nahrávky hromadí v lokální frontě.
Doporučení je nemazat je automaticky jen kvůli vypnutému killswitchi; aplikace má
ukázat obsazené místo, varovat před tlakem na disk a nabídnout výslovný export nebo výmaz.
Maximální lokální stáří, kvóta a případné automatické mazání jsou k rozhodnutí
spolu s O3; toto doporučení není schválená retenční politika.

## Přepis — otevřený parametr O2

Poskytovatel ani způsob přepisu nejsou rozhodnuté.
Počet hodin audia za měsíc ovlivní cenu, kapacitu workerů, souběh, rate limits,
délku fronty, monitoring a rozhodnutí mezi spravovanou a vlastní infrastrukturou.
Limit délky nebo velikosti jednoho požadavku budoucího přepisovače určí, zda lze
remuxovanou hodinovou stopu předat celou, nebo ji server rozdělí na časové segmenty.
Segmentace pro přepis je serverová operace a je oddělena od 8MiB transportních částí;
ty řeší spolehlivý upload, ne sémantické dělení audia.
U dvou stop musí segmenty sdílet časovou osu a případný překryv, aby se po spojení
neztratila slova na hranici a zůstalo rozlišení mikrofonu od systémového zvuku.
Konkrétní maximální délka, velikost segmentu a poskytovatel se doplní až po rozhodnutí O2.
