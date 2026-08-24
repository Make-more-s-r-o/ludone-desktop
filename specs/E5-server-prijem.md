# E5 — Serverová cesta: příjem nahrávky na app.ludone.cz (ludone-app, Next.js App Router)

> Vzniklo 24. 8. 2026 z ultracode analýzy. Master plán: [`../PLAN.md`](../PLAN.md).

## Cíl

Desktopová aplikace nahraje dvě stopy jednoho sezení (mikrofon + systém, hodinové audio 40–120 MB) na app.ludone.cz tak, že: upload je chunked/resumable a nezávislý na neznámém nginx stropu, server nikdy nedrží celý soubor v paměti, týž soubor podruhé nezaloží druhý záznam, WebM bez celkové délky se remuxem opraví bez dotyku jediného bajtu zvuku, originál zůstává archivní, a RBAC (modul-gate × company-scope) je default-deny od prvního commitu. Vykonavatel: Codex gpt-5.6-sol; diff povinně přes Claude Opus review (nová veřejná plocha + RBAC povrch + zápis dat).

## Kroky

### 1. 🔴 BLOKUJÍCÍ: změřit skutečný nginx strop a timeouty na hostu (dělá Dan/Claude přes SSH, NE Codex — nemá přístup k hostu)

Konfigurace žije ve dvou místech a mohou se lišit: git kopie je v SOUSEDNÍM repu /Users/dan/Dev/ClaudeCode/LuDone/data-warehouse/server/nginx/ (nginx.conf ř.18 `client_max_body_size 50m` v http bloku; conf.d/19-app.conf = vhost app.ludone.cz, NEMÁ vlastní client_max_body_size, má `proxy_read_timeout 60s`, `proxy_buffering off`, `limit_req zone=app_prod burst=50 nodelay`; conf.d/09-app-prod-zone.conf = `rate=30r/s`), zatímco běžící konfigurace je v kontejneru makemore-nginx pod /opt/makemore-data/nginx/. deploy.sh scp-uje jen 17-labs.conf a ssl-labs.conf, takže 19-app.conf a nginx.conf se na host dostávají jinou cestou a mohou driftovat.

PŘESNÉ PŘÍKAZY (`nginx -T` vypíše efektivní konfiguraci VČETNĚ include — jediné pravdivé měřidlo):

ssh root@23.88.61.12 'docker exec makemore-nginx nginx -v; docker exec makemore-nginx nginx -T 2>/dev/null | grep -nE "server_name|client_max_body_size|client_body_timeout|client_body_buffer_size|client_body_temp_path|proxy_request_buffering|proxy_read_timeout|proxy_send_timeout|send_timeout|limit_req"'

ssh root@23.88.61.12 'df -h /opt/ludone-uploads-prod /opt/ludone-uploads /var/lib/docker; ls -la /opt/ludone-uploads-prod'

OSTRÉ MĚŘENÍ stropu (nečíst, změřit — nginx uřízne tělo dřív, než dojde k aplikaci, takže i neexistující cesta rozliší strop od průchodu; 404 = nginx to pustil, 413 = uříznuto):
  head -c 12000000  /dev/urandom > /tmp/p12.bin
  head -c 60000000  /dev/urandom > /tmp/p60.bin
  head -c 140000000 /dev/urandom > /tmp/p140.bin
  for f in /tmp/p12.bin /tmp/p60.bin /tmp/p140.bin; do echo -n "$f -> "; curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' -X POST https://app.ludone.cz/__body-size-probe -H 'Content-Type: application/octet-stream' --data-binary @"$f"; done

Výsledek zapsat do reportu jako naměřená čísla (client_max_body_size, proxy_read_timeout, client_body_timeout, request buffering on/off, volné místo). Návrh chunků 8 MiB je zvolený tak, aby prošel i pod nejpřísnějším realistickým stropem — měření slouží k potvrzení, ne k volbě velikosti.

**Hotovo když:** V reportu jsou naměřené hodnoty client_max_body_size / proxy_read_timeout / client_body_timeout / proxy_request_buffering pro server_name app.ludone.cz z výstupu `nginx -T` na běžícím kontejneru, tři HTTP kódy z probe (12/60/140 MB) a volné místo na /opt/ludone-uploads-prod. Pokud změřený strop < 8 MiB, je založena změna 19-app.conf v repu data-warehouse; jinak se nginx NEMĚNÍ.

### 2. DB: schéma `nahravky` — SQL migrace + rollback

Vytvořit sql/200-nahravky-schema.sql a sql/200-rollback-nahravky-schema.sql (poslední obsazené číslo v sql/ je 199-lufak-chat-notifications.sql). Struktura a styl přesně dle sql/194-lufak-private-storage.sql: BEGIN; ... COMMIT;, `CREATE SCHEMA IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` u constraintů, GRANT blok přes `FOREACH role_name IN ARRAY ARRAY['ludata_user','ludone_prod_app']` s `CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles ...)`.

nahravky.sessions (kotva pro E7 kalendář, aby se pak nemuselo migrovat):
  id uuid PK DEFAULT gen_random_uuid(), title text, started_at timestamptz, ended_at timestamptz,
  company_tabidoo_id text NOT NULL, company_name text,
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, deleted_by text,
  CONSTRAINT nahravky_sessions_delete_audit_ck CHECK ((deleted_at IS NULL)=(deleted_by IS NULL))

nahravky.recordings (sloupce mapované na vzor inventory.item_attachments ze sql/80-inventory-attachments.sql + lufak.document_files):
  id uuid PK DEFAULT gen_random_uuid()   -- generuje aplikace přes randomUUID() UŽ PŘI INITU, je součástí storage_key
  session_id uuid NOT NULL REFERENCES nahravky.sessions(id)
  track text NOT NULL CHECK (track IN ('mic','system'))
  storage_key text NOT NULL              -- relativní pod UPLOAD_DIR: nahravky/{id}/{sha256}.webm
  normalized_storage_key text            -- výstup remuxu, NULL dokud neproběhne; originál se NIKDY nepřepisuje
  mime text NOT NULL CHECK (mime IN ('audio/webm','audio/ogg','audio/mp4'))
  size_bytes bigint NOT NULL CHECK (size_bytes > 0)   -- 🔴 bigint, NE integer jako item_attachments
  declared_bytes bigint NOT NULL
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$')
  duration_ms integer
  duration_source text CHECK (duration_source IN ('client','ffprobe'))
  state text NOT NULL DEFAULT 'uploading' CHECK (state IN ('uploading','stored','normalized','failed'))
  normalized_at timestamptz, normalize_error text
  company_tabidoo_id text NOT NULL, company_name text   -- identita firmy = GUID; název je jen popisek (ludone-data)
  uploaded_by text NOT NULL              -- 'user:<dbId>' — stejný tvar jako ownerId v /api/lufak/uploads
  client_upload_id text NOT NULL         -- '<sessionId>:<track>' od klienta, klíč idempotence initu
  device_label text, started_at timestamptz, ended_at timestamptz
  row_version integer NOT NULL DEFAULT 1
  created_at/updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, deleted_by text

nahravky.upload_chunks:
  recording_id uuid NOT NULL REFERENCES nahravky.recordings(id) ON DELETE RESTRICT,
  idx integer NOT NULL CHECK (idx >= 0), size_bytes integer NOT NULL CHECK (size_bytes > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recording_id, idx)

Indexy (všechny partial WHERE deleted_at IS NULL, jako v inventory i lufak):
  UNIQUE (uploaded_by, client_upload_id) WHERE deleted_at IS NULL     -- idempotence initu + resume
  UNIQUE (uploaded_by, sha256) WHERE deleted_at IS NULL AND state <> 'uploading'  -- týž soubor dvakrát = jeden záznam
  UNIQUE (session_id, track) WHERE deleted_at IS NULL                  -- dvě stopy jednoho sezení, ne tři
  UNIQUE (storage_key) WHERE deleted_at IS NULL                        -- vzor lufak_document_files_storage_key_active_uq
  INDEX (company_tabidoo_id, created_at DESC) WHERE deleted_at IS NULL
  INDEX (state, created_at) WHERE deleted_at IS NULL AND state IN ('stored','failed')  -- fronta normalizace

GRANT: USAGE ON SCHEMA nahravky + SELECT, INSERT, UPDATE na obě tabulky pro ludata_user a ludone_prod_app. 🔴 ŽÁDNÉ DELETE na recordings (soft-delete only); DELETE na upload_chunks POVOLIT — části se po finalizaci fyzicky mažou, nejsou to uživatelská data.

Rollback soubor: DROP INDEX/TABLE v opačném pořadí + DROP SCHEMA nahravky (bez CASCADE, ať se pozná zbytek).

**Hotovo když:** `psql -f sql/200-nahravky-schema.sql` proběhne na čisté lokální DB i podruhé beze změny (idempotence), rollback soubor DB vrátí do původního stavu, a `\d+ nahravky.recordings` ukazuje všech 6 indexů a všechny CHECK constrainty.

### 3. DB: Drizzle definice zrcadlící migraci

Vytvořit src/db/nahravky-schema.ts přesně stylem src/db/inventory-schema.ts (hlavičkový komentář „Mirror sql/200-nahravky-schema.sql — při změně schematu nutno upravit OBOJÍ"):

import { bigint, index, integer, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"; import { sql } from "drizzle-orm";
export const nahravkySchema = pgSchema("nahravky");
export const NAHRAVKA_TRACKS = ["mic","system"] as const;
export const NAHRAVKA_STATES = ["uploading","stored","normalized","failed"] as const;
export const nahravkySessions = nahravkySchema.table("sessions", {...});
export const nahravkyRecordings = nahravkySchema.table("recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => nahravkySessions.id),
  track: text("track").$type<NahravkaTrack>().notNull(),
  storageKey: text("storage_key").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),   // 🔴 mode:"number", ne bigint JS typ
  ...
}, (t) => [ uniqueIndex("nahravky_recordings_client_upload_uq").on(t.uploadedBy, t.clientUploadId).where(sql`deleted_at IS NULL`), ... ]);
export type Recording = typeof nahravkyRecordings.$inferSelect; export type NewRecording = typeof nahravkyRecordings.$inferInsert;

Vzor partial unique indexu s .where(sql`deleted_at IS NULL`) je v src/db/inventory-schema.ts ř. 514–518.

**Hotovo když:** `pnpm exec tsc --noEmit` projde a jednoduchý integrační test (vzor src/db/__tests__/) načte řádek přes Drizzle ze schématu vytvořeného migrací z kroku 2 — tj. názvy sloupců v TS a v SQL se prokazatelně shodují.

### 4. Úložiště: streamová obdoba private-file-storage (NOVÝ soubor, LuFak se NESMÍ upravovat)

Vytvořit src/lib/nahravky/private-recording-storage.ts. Vzor je /Users/dan/Dev/ClaudeCode/LuDone/ludone-app/src/lib/lufak/private-file-storage.ts — ale KOPÍRUJE se vzor, NE import: LuFak soubor je pod sabotážními branami (`pnpm lufak:sabotage`) a jeho úprava shodí cizí gates.

PŘEVZÍT BEZE ZMĚNY (jen přepsat regex a limity):
  • STORAGE_KEY_PATTERN + parse/resolve dvojici → path-traversal guard: zákaz `\\`, `path.posix.normalize(key) !== key`, `resolved.startsWith(root + path.sep)` (LuFak ř. 168–195)
  • assertDirectoryInsidePrivateRoot() — realpath obou kořenů, chrání proti symlinku podstrčenému do volume (LuFak ř. 197–216)
  • atomický zápis: open(temp,"wx",0o600) → sync() → link(temp, cíl) → chmod 0o600, unlink(temp) ve finally, `created` flag a úklid POUZE vlastního blobu (LuFak ř. 240–300 včetně komentáře o EEXIST adopci)
  • čtení přes O_RDONLY | O_NOFOLLOW + isFile() (LuFak ř. 310–330)
  • mkdir(root,{recursive:true,mode:0o700}) pro kořen i adresář

MUSÍ SE ROZŠÍŘIT (a proč):
  1. 🔴 API je dnes `bytes: Uint8Array` a uvnitř `handle.writeFile(bytes)` / `handle.readFile()` — celý soubor v RAM. Při 120 MB × N souběžných uploadů to položí kontejner (limit 512 M labs / 768 M prod, docker-compose.yml + docker-compose.prod.yml). Nové API: `storeRecordingFromStream({ recordingId, source: Readable, expectedSha256, expectedBytes })` — pipeline `source → createHash('sha256') → createWriteStream(temp)`, `await fh.sync()`, pak link. Paměť konstantní (64 KiB blok).
  2. Limity: LUFAK_PRIVATE_FILE_MAX_BYTES = 10 MiB → `NAHRAVKA_MAX_BYTES = 512 * 1024 * 1024` a `CHUNK_MAX_BYTES = 8 * 1024 * 1024`.
  3. MIME sniff: detectPrivateInvoiceMime() zná jen PDF/JPEG/PNG/WebP. Nová `detectRecordingMime(head: Uint8Array)` nad PRVNÍMI 64 bajty (ne nad celým souborem): WebM/Matroska = `1A 45 DF A3`; Ogg = `4F 67 67 53` ("OggS"); MP4/M4A = bajty 4..7 == `66 74 79 70` ("ftyp"). Neznámý kontejner → 415.
  4. validateStoredBytes() čte celý soubor do paměti → nahradit `verifyStoredRecording(storageKey, expectedSha256, expectedBytes)` = stream + hash.
  5. Přidat `openRecordingStream(storageKey, { start, end })` vracející ReadStream pro HTTP Range (přehrávání v prohlížeči v E9).
  6. Klíč a prefix: STORAGE_KEY_PATTERN = `^nahravky/<uuid>/<sha256>\\.(webm|ogg|m4a)$`.

🔴 ROZHODNUTÍ K POTVRZENÍ (odchylka od zadání): zadání říká prefix `uploads/nahravky/`, jenže UPLOAD_DIR je už `/app/uploads` (Dockerfile, docker-compose.yml `UPLOAD_DIR=/app/uploads`), takže doslovné znění dá cestu `/app/uploads/uploads/nahravky/…` — dvojité `uploads` bez užitku. Sousedé používají jednoúrovňový prefix: `lufak/`, `inventory/`, `pos/`, `internal-invoicing/`, `odvody/`. Navrhuji `nahravky/` → `/app/uploads/nahravky/{recordingId}/{sha256}.webm`. Pokud Dan trvá na doslovném zadání, změní se jen regex a konstanta.

🔴 Blob leží pod {recordingId}/, NE pod holým hashem — přesně jako LuFak `lufak/{documentId}/{sha}.pdf`. Dedup přes obsah napříč uživateli by znamenal, že druhý uživatel dostane cizí soubor.

**Hotovo když:** Unit testy (vzor souborů *.test.ts vedle zdroje): (a) uložení 150 MB streamu proběhne a `process.memoryUsage().heapUsed` naroste o < 20 MB; (b) storageKey s `../`, `..\\`, dvojitým lomítkem a symlinkem mimo root je odmítnut chybou `invalid_storage_key`; (c) dvojí uložení téhož obsahu vrátí `created:false` a existující blob nepoškodí; (d) soubor s hlavičkou PDF je odmítnut jako `unsupported_mime`.

### 5. Upload endpoint: chunked/resumable kontrakt (4 routy)

Všechny routy mají `export const runtime = "nodejs"` + `export const dynamic = "force-dynamic"` (vzor src/app/api/mcp/route.ts ř. 18–19) a JSDoc blok `@funkce nahravky/api-… @popis … @stav zive` (vzor /api/lufak/uploads/route.ts ř. 45–49, jinak spadne `pnpm funkce:check`).

🔴 Upload NESMÍ jít přes Server Action (default body limit 1 MB) ani přes `request.formData()` / `file.arrayBuffer()` — to je právě ta vada vzoru /api/lufak/uploads.

(1) POST /api/nahravky/uploads — INIT
  Tělo JSON: { sessionId (uuid), track: 'mic'|'system', declaredMime, declaredBytes, sha256 (celého souboru, spočítal klient), chunkSize, chunkCount, startedAt, endedAt, companyTabidooId, deviceLabel }
  Server: RBAC (krok 7) → validace → advisory lock `pg_advisory_xact_lock(hashtextextended('nahravka-init:'||ownerId||':'||clientUploadId, 0))` (vzor /api/lufak/uploads/route.ts ř. 139–145) → SELECT na (uploaded_by, client_upload_id).
    • existuje → 200 { recordingId, state, receivedChunks: number[], missing: number[], idempotent: true }  ⇒ RESUME
    • neexistuje → randomUUID() + INSERT recordings state='uploading' → 201 { recordingId, chunkSize, idempotent: false }
  clientUploadId = `${sessionId}:${track}` — dvě stopy jednoho sezení jsou dva nezávislé uploady se společným session_id.

(2) PUT /api/nahravky/uploads/{recordingId}/casti/{index} — JEDNA ČÁST
  Tělo = syrové bajty, Content-Type: application/octet-stream. Povinné hlavičky: Content-Length (chybí → 411, jako LuFak ř. 56–62) a X-Chunk-Sha256 (hex).
  Strop: Content-Length > CHUNK_MAX_BYTES (8 MiB) → 413 PŘED čtením těla. Poslední část smí být menší.
  Čtení: `Readable.fromWeb(request.body)` → hash + zápis do `nahravky/_incoming/{recordingId}/{index}.part` přes temp+rename; při překročení stropu za běhu stream destroy → 413 (do RAM se nikdy nedostane víc než jeden 64 KiB blok).
  Neshoda hashe → 422 `chunk_hash_mismatch`, part soubor se smaže, klient část pošle znovu.
  Zápis do DB: INSERT INTO nahravky.upload_chunks ... ON CONFLICT (recording_id, idx) DO NOTHING ⇒ opakované poslání téže části je no-op (idempotence na úrovni části; PUT je idempotentní i sémanticky, proto PUT a ne POST).
  Odpověď 200 { received: n, missing: number[] }.

(3) GET /api/nahravky/uploads/{recordingId} — STAV (pro resume po pádu klienta)
  200 { state, receivedChunks, missing, declaredBytes, sha256 }.

(4) POST /api/nahravky/uploads/{recordingId}/dokoncit — FINALIZACE
  Tělo { chunkCount, sha256 }. V jedné DB transakci pod `pg_advisory_xact_lock(hashtextextended('nahravka-finalize:'||recordingId, 0))`:
    a) všechny části 0..chunkCount-1 v DB i na disku, součet size == declared_bytes; jinak 409 `incomplete` + missing
    b) slití v pořadí do temp streamem (konstantní paměť) + průběžný sha256 celku
    c) sha256 != deklarovaný → 422 `sha256_mismatch`, state zůstane 'uploading', části zůstanou (klient přepošle vadné)
    d) detectRecordingMime() nad prvními 64 B slitého souboru → neznámé = 415, deklarovaný MIME musí sedět na sniffnutý
    e) storeRecordingFromStream() → hard-link na nahravky/{recordingId}/{sha256}.webm
    f) UPDATE recordings SET storage_key, mime, size_bytes, sha256, state='stored', row_version = row_version + 1
    g) při konfliktu na UNIQUE (uploaded_by, sha256) → vrátit existující recordingId, { idempotent: true }, a čerstvě slitý blob smazat POUZE pokud ho vytvořil tenhle pokus (`created === true`) — přesně ta past, kterou LuFak řeší v ř. 213–220
  Po COMMITu: DELETE upload_chunks + rm -rf `_incoming/{recordingId}/`, a fire-and-forget `void normalizeRecording(recordingId)` (krok 6).
  Odpověď 201 { recordingId, state: 'stored', sizeBytes, sha256, durationMs: null }.

Jak se pozná dokončení: klient považuje stopu za doručenou teprve po odpovědi z /dokoncit se `state !== 'uploading'`. Délka je k dispozici až po přechodu na 'normalized'.

Úklid: cron endpoint smaže `_incoming/*` a recordings ve stavu 'uploading' starší 24 h (soft-delete řádku, tvrdé smazání částí).

**Hotovo když:** curl skript v scripts/ (nebo route.test.ts vedle každé routy, vzor src/app/api/lufak/uploads/route.test.ts) prokáže: 120 MB soubor projde init→15 chunků→finalize; přerušení uprostřed a opakovaný init vrátí missing a upload dojede; poslání téže části dvakrát nezaloží nic navíc; celý běh podruhé se stejným clientUploadId vrátí týž recordingId s idempotent:true; `docker stats` během uploadu neukáže nárůst RSS o velikost souboru.

### 6. Krok při příjmu: ffmpeg remux (oprava chybějící celkové délky) — ffmpeg v image CHYBÍ

🔴 OVĚŘENO: Dockerfile runner stage má jen `RUN apk add --no-cache curl` a v celém repu (mimo node_modules) není jediná zmínka o ffmpeg/ffprobe. Bez zásahu skončí spawn na ENOENT.

(a) Dockerfile: `RUN apk add --no-cache curl ffmpeg` (alpine balíček `ffmpeg` nese i `ffprobe`; +~90 MB image). Sidecar kontejner je zbytečná složitost.

(b) KDE se spouští — NIKDY uvnitř HTTP handleru. `19-app.conf` má `proxy_read_timeout 60s`; synchronní remux hodinové stopy by u pomalého disku vrátil klientovi 504, i kdyby normalizace dopadla dobře. Dvě cesty, obě povinné:
   • okamžitě po commitu finalizace: `void normalizeRecording(id).catch(...)` — odpověď klientovi už odešla
   • src/app/api/cron/nahravky-normalize/route.ts (vzor sousedů v src/app/api/cron/*, autorizace přes src/lib/cron-auth.ts, zápis do deploy/crontab.prod) — bere řádky `state='stored'` starší 5 minut. Bez toho by restart kontejneru uprostřed remuxu nechal stopu navždy bez délky.

(c) PŘESNÝ PŘÍKAZ (src/lib/nahravky/normalize.ts, `spawn` z node:child_process):
   ffmpeg -nostdin -hide_banner -loglevel error -i <orig> -map 0:a -c copy -f webm <temp>
   ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 <temp>
   • `-c copy` = remux, nikoli re-encode → nemění se ani jeden bajt zvukových paketů, přepisuje se jen kontejner (Segment Info / Duration / Cues)
   • `-map 0:a` explicitně — bez něj může ffmpeg protáhnout i datovou stopu a rozejít velikost
   • `-nostdin` povinné, jinak ffmpeg spuštěný z Node spolkne stdin procesu
   • timeout 180 s + kill('SIGKILL'), stderr do normalize_error (zkrácené na 2000 znaků)

(d) VÝSTUP: temp jde do `nahravky/{recordingId}/.norm-<uuid>.tmp` (uvnitř volume, ne do /tmp kontejneru — ten je efemérní), pak hash + atomický link na `nahravky/{recordingId}/{sha256_norm}.webm`, a UPDATE recordings SET normalized_storage_key, duration_ms, duration_source='ffprobe', normalized_at=now(), state='normalized', row_version=row_version+1.

(e) 🔴 ORIGINÁL ZŮSTÁVÁ ARCHIVNÍ: `storage_key` se nikdy nepřepisuje ani nemaže. Selhání → state='failed' + normalize_error, originál je pořád stažitelný a přepis (E9) může jet z něj.

(f) Killswitch src/lib/nahravky/flags.ts dle vzoru src/lib/lufak/flags.ts: `isNahravkyNormalizeEnabled()` = `(process.env.NAHRAVKY_NORMALIZE_ENABLED ?? "false") === "true"` (fail-closed) a `isNahravkyUploadEnabled()` (upload endpoint při OFF vrací 503 `storage_disabled, retryable:true`, jako LuFak ř. 82–88).

**Hotovo když:** Nad reálnou 60min stopou z E0/E3: `ffprobe … <originál>` vrátí N/A nebo 0, `ffprobe … <normalizovaný>` vrátí hodnotu v rozmezí 3600 ± 2 s; a `ffmpeg -v error -i <orig> -map 0:a -c:a copy -f data - | shasum -a 256` == totéž nad normalizovaným (identický otisk syrových zvukových paketů).

### 7. RBAC od dne 1 — modul-gate × company-scope, plus registrace modulu v DB

Slug modulu: `nahravky` (rbacId `nahravky`), admin submodul `nahravky-admin` — přesně vzor `lufak` / `lufak-admin` v src/config/modules.ts ř. 369–392 (Module { id, label:"Nahrávky", icon, path:"/nahravky", rbacId:"nahravky", submodules:[...] }).

KAŽDÁ routa pod /api/nahravky/** začíná stejnými pěti kroky — doslova jako /api/lufak/uploads/route.ts ř. 51–90:
  1. const user = await getSessionUser();  // @/lib/session — !user → 401 {ok:false, code:"unauthorized"}
  2. if (!checkModuleAccess(user, "nahravky")) → 403 {code:"forbidden"}   // @/lib/rbac, default-deny: prázdné allowedModules = DENY
  3. const companyScope = await resolveEffectiveCompanyScope(user);       // @/lib/rbac-scope
     if (companyScope !== null && companyScope.length === 0) → 403 {code:"scope_empty"}
  4. const resolved = await resolveCompanyReadScope(companyScope, { purpose: "authz", source: "nahravky.upload" });  // @/lib/companies/read-scope
     if (resolved.degraded) → 503 {code:"scope_unavailable"}   // registr dole ≠ pustit vše (fail-closed)
  5. 🔴 KROK NAVÍC, který LuFak upload nemá (nezná při uploadu firmu): cílová firma nahrávky musí být ve scope.
     companyScope === null (admin/wildcard) NEBO resolved.ids.includes(body.companyTabidooId) → jinak 403 {code:"company_out_of_scope"}.
     Porovnává se GUID (`company_tabidoo_id`), NIKDY název — název se mění (23. 7. 2026 sedm firem naráz).

🔴 Kontrola se opakuje u KAŽDÉHO requestu, ne jen u initu: chunk / finalize / GET / download načítají řádek přes `WHERE id = $1 AND uploaded_by = $ownerId AND deleted_at IS NULL` A ZNOVU ověří company-scope. Bez toho by k cizí nahrávce stačilo uhodnout recordingId.

Registrace modulu v DB — sql/201-nahravky-module-policies.sql (+ rollback), doslova dle vzoru sql/193-lufak-module-policies.sql včetně prerequisite bloku a verify bloku:
  INSERT INTO ludata.module_policies (module_id, allowed_roles, display_order, is_protected, default_scope_level, enabled_envs, updated_by)
  VALUES ('nahravky', ARRAY[]::text[], …, false, 'lead', ARRAY['labs']::text[], '201-nahravky-module-policies.sql'),
         ('nahravky-admin', …, 'all', ARRAY['labs']::text[], …)
  ON CONFLICT (module_id) DO NOTHING;
  + INSERT do ludata.menu_module_placements (group_key 'operations').
🔴 enabled_envs = ARRAY['labs'], NIKDY rovnou 'prod' — při aktivním policy enginu je i admin env-gated (viz komentář v src/lib/rbac.ts ř. 44–50), takže na prodě modul prostě neexistuje, dokud se nepromuje zvlášť.

DESKTOPOVÁ IDENTITA (D1, OAuth 2.1 + PKCE) — hranice E5/E6: endpoint musí přijmout dvě identity, NextAuth cookie (web) i Bearer access token (desktop). Infrastruktura už stojí: src/mcp/http/auth.ts::authenticateBearer (ř. 102+, rozlišuje `ldmcp_oauth_<env>_v1_` a statické tokeny), OAuth server v src/mcp/oauth/ (authorize/token/register/revoke) a src/mcp/oauth/config.ts::MCP_OAUTH_SCOPES = ["mcp:read","mcp:draft"].
  E5 dodá POUZE kontrakt: src/lib/nahravky/actor.ts → `resolveUploadActor(request): Promise<UploadActor|null>`, kde UploadActor = { dbId, email, role, allowedModules, deniedModules, moduleGateActive, allowedCompanies } — tvar, který bere checkModuleAccess i resolveEffectiveCompanyScope. Implementace větve cookie hotová v E5; větev Bearer + nový scope `nahravky:write` doplní E6. Dokud E6 nedojede, E5 testuje z prohlížeče a Bearer větev vrací 401.
  🔴 Toto je JEDINÝ sdílený soubor obou souběžných worktrees — dohodnout ho jako první, jinak vzniknou dvě verze.

**Hotovo když:** e2e/nahravky-rbac.spec.ts (viz měřítko) prochází zeleně proti labs a v kódu neexistuje route pod /api/nahravky/, která by neprošla `pnpm exec grep -c getSessionUser` kontrolou — každá má všech pět kroků.

### 8. Infrastruktura hostu: adresáře uploads a práva

deploy.sh ř. ~46 zakládá jen `mkdir -p /opt/ludone-uploads/{pos,internal-invoicing,odvody} && chown -R 1001:65533` — a to POUZE pro labs. Prod jede z /opt/ludone-uploads-prod (docker-compose.prod.yml) a ten se v žádném skriptu nezakládá. První prod upload by spadl na ENOENT/EACCES (v kontejneru běží uživatel `nextjs`, UID 1001).
  • deploy.sh: doplnit `nahravky` do seznamu adresářů
  • na hostu ručně jednou: `ssh root@23.88.61.12 'mkdir -p /opt/ludone-uploads-prod/nahravky /opt/ludone-uploads/nahravky && chown -R 1001:65533 /opt/ludone-uploads-prod/nahravky /opt/ludone-uploads/nahravky && df -h /opt/ludone-uploads-prod'`
  • Kapacita: 2 stopy × ~60 MB × počet schůzek. Před spuštěním změřit volné místo (VPS už jednou měl plný disk — viz runbook tabidoo-dlt) a přidat alert, až volné místo klesne pod 20 %.

**Hotovo když:** `ssh root@23.88.61.12 'ls -lan /opt/ludone-uploads-prod/nahravky /opt/ludone-uploads/nahravky'` ukáže vlastníka 1001 na obou, a testovací zápis z kontejneru (`docker exec makemore-ludone-app sh -c 'touch /app/uploads/nahravky/.probe && rm /app/uploads/nahravky/.probe'`) projde bez chyby.

### 9. Brány repa — aby to prošlo Test gate a prod deployem

• `pnpm funkce` + `pnpm funkce:check` — každá nová routa potřebuje JSDoc `@funkce nahravky/api-…`, `@popis …`, `@stav zive` (vzor /api/lufak/uploads/route.ts ř. 45–49)
• `pnpm routes:table` + `pnpm routes:table:check` — regenerovat tabulku rout
• `pnpm ds:gate:changed` — jen pokud vznikne .tsx (v E5 nemusí; UI je E9)
• `pnpm test:unit` — testy vedle každého nového modulu, vzor src/app/api/lufak/uploads/route.test.ts
• MCP surface: modul zatím MCP tooly nemá → do commit message přesně marker `[mcp-exempt:nahravky]` + důvod VEDLE markeru (AGENTS.md ř. 377 — volný text ZA dvojtečkou gate ignoruje)
• 🔴 MIGRACE NA OBĚ DB PŘED MERGEM: `PGPASSWORD=… scripts/db-migrate.sh --db labs_app --host … --user … --env labs sql/200-nahravky-schema.sql sql/201-nahravky-module-policies.sql` a totéž `--db ludone_prod --user ludone_prod_app --env prod`. Fail-closed migration-ledger brána v .github/workflows/deploy-prod.yml běží PŘED buildem — nenamigrovaná sql/NNN prod deploy zastaví a produkce tiše zůstane na starším buildu.

**Hotovo když:** `pnpm funkce:check && pnpm routes:table:check && pnpm test:unit` je zelené lokálně, required checks na PR jsou zelené, a `SELECT filename FROM ops.applied_migrations WHERE filename LIKE '200-%' OR filename LIKE '201-%'` vrací obě migrace na labs_app i na ludone_prod.

### 10. Ostré ověření druhým účtem (ne čtením kódu) + předání do E9/E6

Vytvořit e2e/nahravky-rbac.spec.ts. Persony jsou už naseedované: scripts/ds-migration/seed-rbac-personas.mjs; helper pro izolovaný kontext přes test-user provider je hotový v e2e/hr2-rbac-personas.spec.ts ř. 32–58 (`contextFor(browser, email)` → POST /api/auth/callback/test-user s csrfToken, kontrola cookie `authjs.session-token`) — zkopírovat.
Čtyři případy, všechny přes API (u API routes je to opravdu 403; gotcha „Next 16 redirect() vrací 200" se týká jen stránek):
  1. persona BEZ `nahravky` v allowed_modules → POST /api/nahravky/uploads = 403 {code:"forbidden"}
  2. persona S modulem, ale company-scope jiné firmy → init s cizím companyTabidooId = 403 {code:"company_out_of_scope"}
  3. táž persona → PUT /api/nahravky/uploads/{cizí id}/casti/0 = 404 nebo 403 (nikdy 200/201)
  4. admin persona p0 → celý happy path 201/200
Spuštění: `PLAYWRIGHT_BASE_URL=https://labs.ludone.cz TEST_USER_PASSWORD=… pnpm exec playwright test e2e/nahravky-rbac.spec.ts`
Předání: zapsat do reportu naměřenou délku z ffprobe, oba otisky zvuku, RSS z docker stats a čtyři HTTP kódy z RBAC testu — s označením ✅ ověřeno naostro. Kontrakt src/lib/nahravky/actor.ts poslat do worktree E6 hned, jak vznikne (ne až na konci).

**Hotovo když:** Playwright report ukazuje 4/4 zelené případy proti labs.ludone.cz, běh je spuštěný pod DVĚMA různými účty (v logu jsou dvě různé e-mailové adresy person), a v reportu je vypsaný konkrétní HTTP kód a `code` z těla odpovědi pro každý DENY případ.

## Měřítko etapy

Etapa je hotová, když tenhle sled projde na labs.ludone.cz a jeho výstupy jsou vypsané v reportu jako naměřená čísla (ne tvrzení):

1) Nahrání reálné 60min stopy z E0/E3 (nikoli generovaného ticha):
   RID=$(curl -sS -X POST https://labs.ludone.cz/api/nahravky/uploads -H 'Content-Type: application/json' -b cookies.txt -d @init.json | jq -r .recordingId)
   split -b 8388608 -d nahravka.webm part-
   for f in part-*; do i=${f#part-}; curl -sS -X PUT "https://labs.ludone.cz/api/nahravky/uploads/$RID/casti/$((10#$i))" -b cookies.txt -H 'Content-Type: application/octet-stream' -H "X-Chunk-Sha256: $(shasum -a 256 $f | cut -d' ' -f1)" --data-binary @$f -o /dev/null -w "$i %{http_code}\n"; done
   curl -sS -X POST "https://labs.ludone.cz/api/nahravky/uploads/$RID/dokoncit" -b cookies.txt -H 'Content-Type: application/json' -d "{\"chunkCount\":$(ls part-* | wc -l),\"sha256\":\"$(shasum -a 256 nahravka.webm | cut -d' ' -f1)\"}"
   ⇒ všechny části 200, finalize 201, `state` přejde na 'normalized' do 5 minut.

2) Délka: ssh root@23.88.61.12 "docker exec makemore-ludone-app ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 /app/uploads/<normalized_storage_key>" vrátí 3600 ± 2 s, zatímco totéž nad `storage_key` (originál) vrátí N/A nebo 0.

3) Bitová shoda zvuku: `ffmpeg -v error -i <orig> -map 0:a -c:a copy -f data - | shasum -a 256` == `ffmpeg -v error -i <normalized> -map 0:a -c:a copy -f data - | shasum -a 256` (shodné otisky syrových zvukových paketů). Kontrolně `shasum -a 256` originálu na disku == `recordings.sha256` == hash spočítaný klientem.

4) Idempotence: druhý běh bodu 1 se stejným clientUploadId vrátí týž recordingId s `idempotent: true` a `SELECT count(*) FROM nahravky.recordings WHERE session_id=… AND deleted_at IS NULL` = 2 (mic + system), ne 3 a víc.

5) Paměť: během bodu 1 běží `ssh root@23.88.61.12 'docker stats --no-stream makemore-ludone-app'` každých 10 s — MEM USAGE nesmí vyskočit o velikost nahrávaného souboru (limit 512 M labs).

6) 403 DRUHÝM ÚČTEM: `PLAYWRIGHT_BASE_URL=https://labs.ludone.cz TEST_USER_PASSWORD=… pnpm exec playwright test e2e/nahravky-rbac.spec.ts` — 4/4 zelené, v logu dvě různé persony, u obou DENY případů vypsaný HTTP 403 a `code` (`forbidden`, `company_out_of_scope`).

## Dotčené soubory

- `sql/200-nahravky-schema.sql (nový)`
- `sql/200-rollback-nahravky-schema.sql (nový)`
- `sql/201-nahravky-module-policies.sql (nový, vzor sql/193-lufak-module-policies.sql)`
- `sql/201-rollback-nahravky-module-policies.sql (nový)`
- `src/db/nahravky-schema.ts (nový, vzor src/db/inventory-schema.ts ř. 492–519)`
- `src/lib/nahravky/private-recording-storage.ts (nový, vzor src/lib/lufak/private-file-storage.ts — kopírovat, NEupravovat originál)`
- `src/lib/nahravky/flags.ts (nový, vzor src/lib/lufak/flags.ts)`
- `src/lib/nahravky/normalize.ts (nový — ffmpeg remux + ffprobe)`
- `src/lib/nahravky/actor.ts (nový — sjednocení cookie session a Bearer, SDÍLENÝ KONTRAKT s worktree E6)`
- `src/app/api/nahravky/uploads/route.ts (nový — POST init)`
- `src/app/api/nahravky/uploads/[recordingId]/route.ts (nový — GET stav pro resume)`
- `src/app/api/nahravky/uploads/[recordingId]/casti/[index]/route.ts (nový — PUT část)`
- `src/app/api/nahravky/uploads/[recordingId]/dokoncit/route.ts (nový — POST finalizace)`
- `src/app/api/cron/nahravky-normalize/route.ts (nový — záchranná fronta normalizace)`
- `route.test.ts vedle každé ze čtyř rout (vzor src/app/api/lufak/uploads/route.test.ts)`
- `src/lib/nahravky/private-recording-storage.test.ts (nový)`
- `e2e/nahravky-rbac.spec.ts (nový, vzor e2e/hr2-rbac-personas.spec.ts)`
- `src/config/modules.ts (změna — modul `nahravky` + `nahravky-admin`, vzor ř. 369–392)`
- `Dockerfile (změna — `RUN apk add --no-cache curl ffmpeg` v runner stage)`
- `deploy.sh (změna — doplnit `nahravky` do mkdir seznamu uploads adresářů)`
- `deploy/crontab.prod (změna — spouštění /api/cron/nahravky-normalize)`
- `docs/launch/INFRA-PLAN.md (změna — nový uploads podadresář + kapacita disku)`
- `/Users/dan/Dev/ClaudeCode/LuDone/data-warehouse/server/nginx/conf.d/19-app.conf (změna POUZE pokud měření v kroku 1 ukáže strop < 8 MiB nebo příliš krátký client_body_timeout)`

## Pasti — co tuhle etapu shodí

- 🔴 Zkopírovat vzor /api/lufak/uploads včetně `await request.formData()` a `await file.arrayBuffer()` — ten drží celý soubor v RAM. U 120 MB × více souběžných uploadů kontejner (limit 512 M labs / 768 M prod) padne na OOM a Docker ho restartuje uprostřed uploadu; vypadá to jako výpadek sítě. Tělo se MUSÍ číst streamem z `request.body`.
- 🔴 Poslat upload přes Server Action — Next.js má na Server Actions default body limit 1 MB a v next.config.ts není zvednutý. Upload jde výhradně přes route handler s `runtime = "nodejs"`.
- 🔴 Dedup přes obsah bez uživatele: unique index jen na `sha256` (místo `(uploaded_by, sha256)`) by druhému uživateli vrátil cizí recordingId a s ním přístup k cizí nahrávce — cross-company leak nahrané schůzky. Blob musí navíc ležet pod `{recordingId}/`, ne pod holým hashem (přesně proto má LuFak klíč `lufak/{documentId}/{sha}.pdf`).
- 🔴 `size_bytes integer` opsané z inventory.item_attachments — u audia to projde, ale je to zbytečná mina se stropem 2 GB. `bigint`.
- 🔴 Prod adresář /opt/ludone-uploads-prod/nahravky neexistuje: deploy.sh zakládá jen labs /opt/ludone-uploads/{pos,internal-invoicing,odvody}. První prod upload spadne na ENOENT/EACCES (kontejner běží jako UID 1001). Založit a chown 1001:65533 na OBOU cestách.
- 🔴 Migrace jen na labs: fail-closed migration-ledger brána v deploy-prod.yml běží PŘED buildem, prod deploy zastaví a produkce tiše zůstane na starším buildu (do #monitoring přijde alert). scripts/db-migrate.sh na obě DB PŘED mergem.
- 🔴 Seed modulu s `enabled_envs = ARRAY['prod']` napoprvé — modul se objeví na produkci dřív, než ho kdokoli viděl běžet. Seed jde jako ARRAY['labs'], promote je samostatné rozhodnutí.
- 🔴 Číst nginx konfiguraci z gitu místo z hostu: deploy.sh scp-uje jen 17-labs.conf a ssl-labs.conf, takže 19-app.conf a nginx.conf se na host dostávají jinou cestou a mohou být rozejité. Jediné pravdivé měřidlo je `nginx -T` na běžícím kontejneru makemore-nginx.
- nginx má `proxy_request_buffering` defaultně ON (19-app.conf ho nevypíná) → celé tělo se nejdřív ukládá do client_body_temp na disk a teprve pak jde do Node. U jednoprůchodového 120 MB uploadu to znamená dvojí zápis a riziko došlého místa; u 8 MiB chunků je to neškodné. Další důvod pro chunky.
- `limit_req zone=app_prod rate=30r/s burst=50 nodelay` (09-app-prod-zone.conf): klient, který vystřelí části paralelně bez pauzy, dostane 503 od nginxu, ne od aplikace — a bude to vypadat jako pád uploadu. Části posílat sériově (max 2 souběžně) a na 503 exponenciální backoff.
- 🔴 Spustit ffmpeg synchronně uvnitř POST /dokoncit — `proxy_read_timeout 60s` na 19-app.conf vrátí klientovi 504, i když normalizace dopadne dobře, a klient bude soubor posílat znovu. Normalizace vždy až PO odeslané odpovědi.
- `ffmpeg -c copy` bez `-map 0:a` může protáhnout do výstupu i jinou stopu → test bitové shody selže a bude to vypadat jako vada zvuku. Bez `-nostdin` navíc ffmpeg spuštěný z Node spolkne stdin procesu.
- ffmpeg v Docker image NENÍ (runner stage má jen `apk add curl`) a v repu na něj není jediná zmínka → `spawn ENOENT`. Po přidání běží jako UID 1001, takže temp musí ležet pod /app/uploads (volume), ne v efemérním /tmp kontejneru.
- Sáhnout do src/lib/lufak/private-file-storage.ts (např. „jen zvednu limit") — soubor je pod sabotážními branami `pnpm lufak:sabotage` a `scripts/check-lufak-quarantine-unreachable.mjs`; shodí to cizí gates. Nová vrstva je samostatný soubor.
- `_incoming` bez úklidu zaplní disk VPS (už se to jednou stalo, viz runbook tabidoo-dlt). Cron mazání rozpracovaných uploadů starších 24 h je součást etapy, ne follow-up.
- Ověřit RBAC jen při INITU a u dalších requestů věřit recordingId — pak k cizí nahrávce stačí uhodnout UUID. Modul-gate i company-scope se kontrolují u KAŽDÉHO requestu, včetně chunku a GETu.
- Napsat src/lib/nahravky/actor.ts ve dvou worktrees zároveň (E5 i E6) — je to jediný sdílený soubor souběžných etap. Kontrakt dohodnout jako první věc, jinak vzniknou dvě neslučitelné verze OAuth identity.
- Nová routa bez `@funkce` anotace nebo bez regenerované tabulky rout shodí Test gate (`pnpm funkce:check`, `pnpm routes:table:check`), a chybějící marker `[mcp-exempt:nahravky]` v commit message shodí MCP surface bránu — volný text za dvojtečkou gate ignoruje.
