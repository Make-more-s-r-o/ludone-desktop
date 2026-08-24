# Datový model serverového modulu

## Rozsah a invarianty

Tento dokument popisuje cílový model, nikoli dnes nasazenou implementaci.
Jedna položka `recordings` znamená jednu nahrávku jedné schůzky jednoho uživatele.
Desktop ale vytváří dva nezávislé soubory dvěma instancemi `MediaRecorder`:
stopu mikrofonu a stopu systémového zvuku.
Proto nejsou souborová pole zdvojena přímo v `recordings`; jsou v samostatné entitě
`recording_tracks`.
Tato normalizace dovolí každou stopu nahrávat, kontrolovat, opakovat a remuxovat zvlášť,
aniž by jedna neúspěšná stopa přepsala stav druhé.
Zároveň databáze vynutí nejvýše jednu stopu každého druhu na nahrávku.

## Entita `recordings`

| Pole | Typ / povinnost | Význam |
|---|---|---|
| `id` | UUID, primární klíč | Serverový identifikátor nahrávky. |
| `user_id` | povinný cizí klíč | Vlastník; je součástí autorizační i deduplikační hranice. |
| `client_recording_id` | UUID, povinný | Stabilní identifikátor vytvořený desktopem před zápisem manifestu. |
| `started_at` | timestamp s pásmem | Začátek podle manifestu desktopu. |
| `ended_at` | timestamp s pásmem, volitelný do uzavření | Konec nahrávání. |
| `client_duration_ms` | bigint | Nezáporný klientský odhad z inicializačního požadavku; slouží k časné validaci metadat a kapacitnímu odhadu, nikoli jako ověřená délka. |
| `duration_ms` | bigint, zpočátku volitelný | Ověřená délka po remuxu; nikdy se neplní klientským odhadem. |
| `processing_state` | enum | Stav celé dvojice stop podle tabulky přechodů níže. |
| `project_id` | cizí klíč, volitelný | Odkaz na projekt; lze doplnit i po pořízení nahrávky. |
| `calendar_event_id` | text / cizí klíč, volitelný | Schůzka z kalendáře; nahrávání bez kalendáře zůstává platné. |
| `manifest_sha256` | 64 hex znaků | Kontrolní součet kanonické podoby manifestu. |
| `total_size_bytes` | bigint | Součet ověřených velikostí obou původních stop. |
| `created_at`, `updated_at` | timestamp | Audit vzniku a poslední změny. |
| `failure_code`, `failure_detail` | volitelné | Strojový kód a bezpečně zkrácený popis poslední chyby. |
| `retention_expires_at`, `deleted_at` | volitelné | Pole závislá na budoucí retenční politice. |

Unikátní omezení `(user_id, client_recording_id)` je základ idempotence.
Stejné klientské ID jiného uživatele není shoda a nesmí odhalit cizí data.

## Entita `recording_tracks`

Každý řádek nese `id`, `recording_id`, `kind` (`microphone` nebo `system`),
`original_storage_key`, volitelný `remuxed_storage_key`, deklarovaný a zjištěný MIME typ,
`size_bytes`, `sha256`, stav uploadu, počet přijatých bajtů a ověřenou `duration_ms`.
Omezení `UNIQUE (recording_id, kind)` zabraňuje třetí nebo duplicitní stopě.
Nahrávka smí postoupit do stavu „připraveno k přepisu“ až tehdy, když existují
právě dva řádky, jeden pro každý druh, a u obou sedí velikost i SHA-256.
Originální objekt se remuxem nepřepisuje; je auditním vstupem a výstup má nový klíč.

## Manifest sezení

Entita `recording_manifests` uchovává `id`, `client_recording_id`, `user_id`,
`schema_version`, `created_at`, `closed_at`, klientský stav (`recording`, `complete`,
`incomplete`), časové značky obou stop a jejich deklarované názvy, velikosti a hashe.
Je serverovou kopií manifestu, který vzniká lokálně v etapě E4 ještě před prvním chunkem.
Kanonický manifest se povinně přenese v inicializačním požadavku spolu s
`manifestSha256`; server hash přepočítá z přijatého kanonického JSON a při neshodě
požadavek odmítne.
Volíme přenos při inicializaci, protože server tak v jediném idempotentním kroku získá
úplný obsah potřebný k založení i ověření manifestu.
Párování probíhá přes `(user_id, client_recording_id)`, nikdy jen podle názvu
souboru, časové blízkosti nebo kalendářové události.
Po prvním přijetí server založí `recordings` a manifest na něj odkazuje unikátním
`recording_id`; opakování se stejným obsahem vrací totéž párování.
Stejné ID s jiným hashem manifestu je konflikt, ne aktualizace naslepo.

## Stavy a povolené přechody

| Z | Do | Podmínka |
|---|---|---|
| `recorded` (nahráno) | `uploaded` (nahráno na server) | Obě stopy jsou kompletní a jejich velikost i SHA-256 byly ověřeny. |
| `recorded` | `failed` (chyba) | Upload je definitivně odmítnut nebo jsou lokální data nečitelná. |
| `uploaded` | `ready` (připraveno k přepisu) | Asynchronní remux obou stop uspěl a server zná jejich délku. |
| `uploaded` | `failed` | Selžala kontrola kontejneru, remux nebo uložení. |
| `ready` | `transcribed` (přepsáno) | Výsledek přepisu je atomicky uložen a svázán s nahrávkou. |
| `ready` | `failed` | Selhal přepis nebo uložení jeho výsledku. |
| `failed` | `uploaded` | Opakovaný upload opravil chybu příjmu; obě stopy jsou znovu ověřeny a čekají na remux. |
| `failed` | `ready` | Opakovaný remux po chybě remuxu uspěl bez nového uploadu a server ověřil délku obou stop. |
| `failed` | `transcribed` | Opakovaný přepis po chybě přepisu uspěl a výsledek je atomicky uložen. |

Jiné přechody jsou zakázané; `transcribed` je pro tento proces koncový stav.
`failure_code` uchovává fázi poslední chyby (`upload`, `remux` nebo `transcription`),
takže worker smí při opakování použít jen odpovídající přechod z `failed`.
Historii změn zapisuje append-only audit se starým a novým stavem, časem a důvodem.

## Remux a změřená vlastnost WebM

WebM vytvořené použitým `MediaRecorder` nemá v kontejneru celkovou délku:
`ffprobe` nad originálem vrací `N/A`.
Hlavička Opus je platná; dřívější tvrzení o její vadě bylo měřením vyvráceno.
Po `ffmpeg -c copy` vrátí `ffprobe` správnou délku a dekódovaný zvuk je bitově
totožný, takže jde o remux kontejneru, nikoli o překódování.
Remux proto proběhne na serveru asynchronně až po dokončení, uložení a kontrole hashe
každé stopy, ale před přechodem do `ready`.
Neprobíhá v HTTP požadavku: hodinová nahrávka nesmí držet odpověď a po restartu
musí práci bezpečně převzít serverová fronta.

## Retence — otevřený parametr O3

Délka retence ani právní pravidla zatím nejsou rozhodnuté.
Na O3 závisí výpočet `retention_expires_at`, doba uchování originálu, remuxu,
manifestu a přepisu, pravidla soft-delete a fyzického výmazu, zálohy i kapacitní plán.
Model musí umět právní blokaci výmazu a audit skutečného smazání, ale konkrétní
lhůty se nesmí zakódovat jako implicitní rozhodnutí.
