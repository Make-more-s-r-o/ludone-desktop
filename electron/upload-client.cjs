const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { declaredCaptureSourcesFromManifest } = require("./recording-export.cjs");

const RECORDING_CHUNK_BYTES = 8 * 1024 * 1024;
const RECORDING_MAX_BYTES = 512 * 1024 * 1024;
const HASH_READ_BYTES = 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const RECORDING_TRACK_KINDS = Object.freeze(["microphone", "system"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const COMPANY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SAFE_SERVER_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;
const QUEUE_OWNER_FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const COMPLETE_UPLOAD_STATES = new Set(["normalized", "stored"]);

const PAUSED_CODES = new Set([
  // 🔴 Platný token, jen požádal o špatné oprávnění. NENÍ to vypršení: nové přihlášení
  // nepomůže, dokud aplikace nezažádá o `nahravky:upload`. Opakování je proto marné
  // a nesmí ubírat z rozpočtu pokusů — jinak nahrávka doputuje do „selhalo" kvůli chybě,
  // kterou opravuje vývojář, ne uživatel. Doloženo serverovou session 10. 9. 2026.
  "insufficient_scope",
  "quota_exceeded",
  "queue_owner_mismatch",
  "queue_owner_unknown",
  "session_missing",
  "session_not_found",
  "session_owner_unknown",
  "storage_disabled",
]);
const PERMANENT_CODES = new Set([
  "company_out_of_scope",
  "idempotency_conflict",
  "invalid_input",
  "session_forbidden",
  "sha256_mismatch",
  "too_large",
  "unsupported_content_type",
]);

class RecordingUploadError extends Error {
  /**
   * @param {string} message
   * @param {{
   *   code?: string,
   *   failureClass?: string,
   *   quota?: Readonly<Record<string, number>>,
   *   status?: number,
   * }} [options]
   */
  constructor(message, { code, failureClass, quota, status } = {}) {
    super(message);
    this.name = "RecordingUploadError";
    this.code = code ?? "upload_failed";
    this.failureClass = failureClass ?? "retryable";
    if (Number.isInteger(status)) this.status = status;
    if (quota) this.quota = quota;
  }
}

function failureClassForCode(code) {
  if (PAUSED_CODES.has(code)) return "paused";
  if (PERMANENT_CODES.has(code)) return "permanent";
  return "retryable";
}

function localError(code, message, failureClass = failureClassForCode(code)) {
  return new RecordingUploadError(message, { code, failureClass });
}

function safeServerCode(value) {
  if (typeof value === "string" && SAFE_SERVER_CODE_PATTERN.test(value)) return value;
  return "upload_failed";
}

function quotaNumbers(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const quota = {};
  for (const key of ["usedBytes", "quotaBytes", "wouldAddBytes"]) {
    if (Number.isFinite(payload[key])) quota[key] = payload[key];
  }
  return Object.keys(quota).length > 0 ? Object.freeze(quota) : undefined;
}

// 🔴 Stav odpovědi rozhoduje tam, kde kód neznáme. Doloženo serverovou session 8. 9. 2026:
// 403 posílá i pro stavy, které se mění (`forbidden`, `scope_empty` — prázdný firemní
// rozsah, vypnutý serverový přepínač). Dokud to padalo do `retryable`, každý pokus ubral
// z rozpočtu a po vyčerpání skončila nahrávka v `selhalo` — a odtud dnes cesta zpět nevede.
// `paused` pokus nespotřebuje, takže se položka dočká, až se stav na serveru změní.
// 401 řešíme zvlášť: znamená „tudy cesta nevede", ne „zkus to za chvíli".
// 🔴 A 503 nejsou tři jména jednoho stavu, ale tři různé stavy. Doloženo serverovou session
// 9. 9. 2026 v jejich kódu: `storage_disabled` je vypnutý přepínač (opakování nepomůže,
// dokud ho člověk nezapne), kdežto `storage_failed` a `scope_unavailable` jsou přechodné a
// opakovat se MAJÍ. Kdyby se rozhodovalo podle statusu, jedna z těch tří tříd by pokaždé
// dopadla špatně: buď by položka uvázla na přechodné chybě, nebo by donekonečna ubírala
// z rozpočtu pokusů kvůli vypnutému přepínači.
// ⚠️ Přechodnost si NEVYJMENOVÁVÁME sami — čteme ji z `retryable: true`, které server u té
// třídy posílá. Vlastní seznam kódů by zastaral tiše: nový přechodný kód by spadl mezi
// pozastavené a nikdo by se to nedozvěděl. Neznámý 503 je proto fail-closed „čeká na
// člověka": neznámý stav není totéž co „zkus to znovu".
// ⚠️ Rozlišuj ale dvě různá 503: „aplikace řekla kód, kterému nerozumím" (fail-closed) od
// „v těle není žádný kód" — to druhé typicky nemluví aplikace, ale proxy před ní, a takový
// výpadek je přechodný. Proto rozhoduje přítomnost kódu, ne jeho neznámost.
function failureClassForStatus(status, code, payload) {
  const podleKodu = failureClassForCode(code);
  if (podleKodu !== "retryable") return podleKodu;
  if (status === 401 || status === 403) return "paused";
  if (status === 503) {
    if (payload?.retryable === true) return "retryable";
    return typeof payload?.code === "string" ? "paused" : "retryable";
  }
  return podleKodu;
}

function serverError(status, payload) {
  const code = safeServerCode(payload?.code);
  return new RecordingUploadError(`${code} (HTTP ${status})`, {
    code,
    failureClass: failureClassForStatus(status, code, payload),
    quota: code === "quota_exceeded" ? quotaNumbers(payload) : undefined,
    status,
  });
}

function safeLog(logger, level, message) {
  try {
    logger?.[level]?.(message);
  } catch {
    // Diagnostika nesmí změnit výsledek uploadu.
  }
}

function normalizedOrigin(value) {
  let origin;
  try {
    origin = new URL(value);
  } catch {
    throw new TypeError("origin uploadu musí být platná URL");
  }
  if (
    origin.protocol !== "https:"
    || origin.username !== ""
    || origin.password !== ""
    || origin.pathname !== "/"
    || origin.search !== ""
    || origin.hash !== ""
  ) {
    throw new TypeError("origin uploadu musí být čistý HTTPS origin");
  }
  return origin.origin;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertUuid(value, fieldName) {
  if (!UUID_PATTERN.test(value)) {
    throw localError("invalid_input", `${fieldName} nemá platný formát UUID`, "permanent");
  }
}

function contentTypeForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".webm") return "audio/webm";
  if (extension === ".ogg" || extension === ".opus") return "audio/ogg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".mp4" || extension === ".m4a") return "audio/mp4";
  throw localError(
    "unsupported_content_type",
    "Formát souboru nahrávky server nepodporuje",
    "permanent",
  );
}

function titleForTrack(manifest, trackKind) {
  const fallbackDate = safeString(manifest.createdAt) || "bez data";
  const base = safeString(manifest.title) || `Nahrávka ${fallbackDate}`;
  const suffix = trackKind === "microphone" ? " – mikrofon" : " – systémový zvuk";
  return `${base.slice(0, Math.max(1, 500 - suffix.length))}${suffix}`;
}

function normalizedDate(value) {
  const text = safeString(value);
  if (text === "") return null;
  const date = new Date(text);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== text) {
    throw localError("invalid_input", "Čas nahrávky nemá platný ISO formát", "permanent");
  }
  return text;
}

function deterministicUuid(hexDigest) {
  const bytes = Buffer.from(hexDigest.slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function deriveUploadIdentity(clientRecordingId, trackKind, contentSha256) {
  const material = `${clientRecordingId}\0${trackKind}\0${contentSha256}`;
  const idempotencyKey = createHash("sha256").update(material, "utf8").digest("hex");
  const clientIdDigest = createHash("sha256")
    .update("LuDone desktop upload\0", "utf8")
    .update(material, "utf8")
    .digest("hex");
  return Object.freeze({
    clientRecordingId: deterministicUuid(clientIdDigest),
    idempotencyKey,
  });
}

async function readExact(handle, length, position) {
  const result = Buffer.allocUnsafe(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(result, offset, length - offset, position + offset);
    if (bytesRead === 0) {
      throw localError("sha256_mismatch", "Soubor se během uploadu změnil", "permanent");
    }
    offset += bytesRead;
  }
  return result;
}

async function hashFileByChunks(filePath, sizeBytes) {
  const fileHash = createHash("sha256");
  const chunkHashes = [];
  const handle = await fs.promises.open(filePath, "r");
  try {
    let position = 0;
    while (position < sizeBytes) {
      const chunkLength = Math.min(RECORDING_CHUNK_BYTES, sizeBytes - position);
      const chunkHash = createHash("sha256");
      let chunkOffset = 0;
      while (chunkOffset < chunkLength) {
        const readLength = Math.min(HASH_READ_BYTES, chunkLength - chunkOffset);
        const bytes = await readExact(handle, readLength, position + chunkOffset);
        fileHash.update(bytes);
        chunkHash.update(bytes);
        chunkOffset += bytes.length;
      }
      chunkHashes.push(chunkHash.digest("hex"));
      position += chunkLength;
    }
  } catch (error) {
    if (error instanceof RecordingUploadError) throw error;
    throw localError("invalid_input", "Soubor nahrávky nelze přečíst", "permanent");
  } finally {
    await handle.close().catch(() => {});
  }
  return Object.freeze({
    chunkHashes: Object.freeze(chunkHashes),
    sha256: fileHash.digest("hex"),
  });
}

async function readManifest(manifestPath) {
  try {
    const contents = await fs.promises.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(contents);
    if (!isPlainObject(manifest)) throw new TypeError("manifest není objekt");
    return manifest;
  } catch {
    throw localError("invalid_input", "Manifest nahrávky nelze přečíst", "permanent");
  }
}

async function statTrack(filePath, manifestTrack) {
  if (!isPlainObject(manifestTrack)) {
    throw localError("invalid_input", "Manifest neobsahuje obě stopy", "permanent");
  }
  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    throw localError("invalid_input", "Soubor nahrávky chybí nebo jej nelze číst", "permanent");
  }
  if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size <= 0) {
    throw localError("invalid_input", "Soubor nahrávky není platný", "permanent");
  }
  if (stat.size > RECORDING_MAX_BYTES) {
    throw localError("too_large", "Soubor nahrávky překračuje limit 512 MiB", "permanent");
  }
  if (manifestTrack.sizeBytes !== stat.size) {
    throw localError("sha256_mismatch", "Velikost souboru neodpovídá manifestu", "permanent");
  }
  const declaredSha256 = safeString(manifestTrack.sha256).toLowerCase();
  if (!SHA256_PATTERN.test(declaredSha256)) {
    throw localError("invalid_input", "Manifest neobsahuje platný SHA-256", "permanent");
  }
  return Object.freeze({
    contentType: contentTypeForFile(filePath),
    declaredSha256,
    filePath,
    manifestTrack,
    sizeBytes: stat.size,
  });
}

async function preflightRecording(item) {
  if (!isPlainObject(item) || (item.kind !== undefined && item.kind !== "recording")) {
    throw localError("invalid_input", "Položka není nahrávka", "permanent");
  }
  const clientRecordingId = safeString(item.clientRecordingId);
  assertUuid(clientRecordingId, "clientRecordingId");
  if (!isPlainObject(item.tracks) || safeString(item.manifestPath) === "") {
    throw localError("invalid_input", "Položka fronty nemá soubory nahrávky", "permanent");
  }
  const manifest = await readManifest(item.manifestPath);
  if (manifest.clientRecordingId !== clientRecordingId || manifest.state !== "complete") {
    throw localError("invalid_input", "Manifest neodpovídá položce fronty", "permanent");
  }

  // 🔴 Sada stop se odvozuje z POLOŽKY, ne z konstanty. Nahrávka bez povoleného systémového
  // zvuku má jedinou stopu, vzniká legitimně (electron/main.cjs createMicrophoneOnlyManifest)
  // a fronta ji zařadí vlastní větví (electron/queue.cjs enqueueMicrophoneOnlyRecording).
  // Kdyby se tu trvalo na obou stopách, taková nahrávka by skončila TRVALOU chybou a nikdy
  // by neodešla — tedy tichá ztráta celé nahrávky, ne jen jedné stopy.
  const trackKinds = RECORDING_TRACK_KINDS.filter(
    (trackKind) => safeString(item.tracks[trackKind]) !== "",
  );
  if (!trackKinds.includes("microphone")) {
    throw localError("invalid_input", "Položka fronty nemá mikrofonní stopu", "permanent");
  }
  // Fronta a manifest se musí shodnout na tom, kolik stop nahrávka má. Rozejít se můžou jen
  // ke škodě: jedna stopa by se tiše neodeslala. Proto je neshoda trvalá chyba, ne varování.
  const manifestKinds = RECORDING_TRACK_KINDS.filter(
    (trackKind) => isPlainObject(manifest.tracks?.[trackKind]),
  );
  if (manifestKinds.length !== trackKinds.length) {
    throw localError(
      "invalid_input",
      "Manifest a fronta se neshodují v počtu stop nahrávky",
      "permanent",
    );
  }

  // Limit všech stop se ověří dřív, než se načte token nebo odešle první init.
  const tracks = [];
  for (const trackKind of trackKinds) {
    const filePath = safeString(item.tracks[trackKind]);
    tracks.push({
      trackKind,
      ...await statTrack(filePath, manifest.tracks?.[trackKind]),
    });
  }

  for (const track of tracks) {
    const hashes = await hashFileByChunks(track.filePath, track.sizeBytes);
    if (hashes.sha256 !== track.declaredSha256) {
      throw localError("sha256_mismatch", "Otisk souboru neodpovídá manifestu", "permanent");
    }
    track.sha256 = hashes.sha256;
    track.chunkHashes = hashes.chunkHashes;
    track.chunkCount = hashes.chunkHashes.length;
    track.identity = deriveUploadIdentity(clientRecordingId, track.trackKind, hashes.sha256);
  }
  // 🔴 Server by shodný obsah sloučil do jedné nahrávky BEZ CHYBY: při dokončení hledá
  // duplikát podle dvojice (uživatel, otisk), druhou stopu označí za smazanou, její soubor
  // FYZICKY SMAŽE a vrátí 200 s `recordingId` té PRVNÍ. Doloženo serverovou session
  // 8. 9. 2026 v jejím kódu; mají na to i test, který přesně tohle očekává.
  // ⚠️ Podmínka na POČET stop není opatrnost navíc: nahrávka může mít jen mikrofon
  // (systémový zvuk nemusí být povolený) a `tracks[1]` by pak neexistovala.
  if (tracks.length > 1 && tracks[0].sha256 === tracks[1].sha256) {
    throw localError(
      "identical_tracks",
      "Mikrofonní a systémová stopa obsahují totéž, nejspíš ticho. "
        + "Odeslání by nezachovalo dvě samostatné stopy a opakování nepomůže.",
      "permanent",
    );
  }
  return Object.freeze({ clientRecordingId, manifest, tracks: Object.freeze(tracks) });
}

function normalizedOwnerFingerprint(value) {
  return typeof value === "string" && QUEUE_OWNER_FINGERPRINT_PATTERN.test(value)
    ? value
    : null;
}

function requireMatchingQueueOwner(item, context) {
  const itemOwner = normalizedOwnerFingerprint(item?.ownerFingerprint);
  if (itemOwner === null) {
    throw localError(
      "queue_owner_unknown",
      "Vlastník nahrávky není potvrzený; před odesláním je nutné potvrzení člověkem",
      "paused",
    );
  }
  const sessionOwner = normalizedOwnerFingerprint(context?.ownerFingerprint);
  if (sessionOwner === null) {
    throw localError(
      "session_owner_unknown",
      "Identitu aktuálního přihlášení nelze ověřit",
      "paused",
    );
  }
  if (sessionOwner !== itemOwner) {
    throw localError(
      "queue_owner_mismatch",
      "Nahrávka patří jinému účtu",
      "paused",
    );
  }
}

function normalizedContext(context, manifest, expectedOrigin, item) {
  if (!isPlainObject(context) || safeString(context.accessToken) === "") {
    throw localError("session_missing", "Pro upload chybí přihlášení", "paused");
  }
  if (context.issuer !== undefined && context.issuer !== expectedOrigin) {
    throw localError("session_not_found", "Přihlášení patří jinému serveru", "paused");
  }
  requireMatchingQueueOwner(item, context);
  const companyTabidooId = safeString(context.companyTabidooId)
    || safeString(manifest.companyTabidooId);
  if (!COMPANY_ID_PATTERN.test(companyTabidooId)) {
    // 🔴 Dva různé světy, které dřív splývaly do jedné hlášky — a ta hláška lhala.
    // Nedosáhli jsme na server (výpadek, přesměrování na přihlášení, chyba serveru):
    // firma NECHYBÍ, jen ji nemáme odkud vzít. Je to přechodné, takže opakovatelné —
    // a hlavně to nesmí zastavit celou frontu, jak to dělala pauza.
    if (safeString(context.companyReason) === "nabidku-se-nepodarilo-ziskat") {
      throw localError(
        "company_offer_unavailable",
        "Seznam firem se nepodařilo získat; zkontrolujte přihlášení a spojení",
        "retryable",
      );
    }
    // Nabídku jsme dostali, ale firma z ní nevyšla jednoznačně. Tohle opakování nespraví —
    // musí rozhodnout člověk, a musí se to v panelu ukázat, ne mlčky čekat.
    if (safeString(context.companyReason) !== "") {
      throw localError(
        "company_not_chosen",
        "Není vybraná firma, pod kterou se má nahrávka odeslat",
        "paused",
      );
    }
    throw localError(
      "upload_context_missing",
      "Pro upload chybí identifikátor firmy",
      "paused",
    );
  }
  const deviceLabel = safeString(context.deviceLabel) || null;
  return Object.freeze({
    accessToken: context.accessToken,
    companyTabidooId,
    deviceLabel,
  });
}

function safeJson(response) {
  return Promise.resolve()
    .then(() => response?.json?.())
    .then((payload) => (isPlainObject(payload) ? payload : {}))
    .catch(() => ({}));
}

function createRequester({ accessToken, fetchImpl, origin, requestTimeoutMs }) {
  /**
   * @param {string} pathname
   * @param {{
   *   body?: string | Buffer,
   *   headers?: Record<string, string>,
   *   method?: string,
   * }} [options]
   */
  return async function request(pathname, { body, headers = {}, method = "GET" } = {}) {
    const abortController = new AbortController();
    let timeoutId;
    const timeout = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        reject(localError("network_error", "Síťový požadavek uploadu vypršel", "retryable"));
      }, requestTimeoutMs);
      timeoutId.unref?.();
    });
    let exchange;
    try {
      exchange = await Promise.race([
        Promise.resolve(fetchImpl(new URL(pathname, origin).toString(), {
          body,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...headers,
          },
          method,
          redirect: "error",
          signal: abortController.signal,
        })).then(async (response) => ({
          payload: await safeJson(response),
          response,
        })),
        timeout,
      ]);
    } catch (error) {
      // 🔴 Tady býval prázdný `catch` a z každé síťové chyby zbylo jen „selhal“. Při prvním
      // ostrém odeslání jsem proto nepoznal přesměrování od TLS, od vypršení ani od odmítnutého
      // spojení — a musel jsem se ptát protistrany, co u nich v auditu vidí, místo abych si to
      // přečetl z vlastního logu. Příčina se proto doplňuje, ale ZÚŽENĚ: jen strojový kód nebo
      // název chyby, NIKDY celá zpráva — ta umí nést adresu i kus požadavku.
      const kod = typeof error?.code === "string"
        && /^[A-Za-z_][A-Za-z0-9_]{0,39}$/u.test(error.code)
        ? error.code
        : null;
      const nazev = typeof error?.name === "string" && /^[A-Za-z]{1,40}$/u.test(error.name)
        ? error.name
        : null;
      // 🔴 Node balí skutečnou síťovou příčinu do VNOŘENÉ chyby. Bez tohohle řádku zbude jen
      // „TypeError“ a odmítnuté spojení vypadá stejně jako vadné TLS nebo špatné DNS.
      const vnorenyKod = typeof error?.cause?.code === "string"
        && /^[A-Za-z_][A-Za-z0-9_]{0,39}$/u.test(error.cause.code)
        ? error.cause.code
        : null;
      // 🔴 Chromí síťová vrstva (`net.fetch`) nedává `code` ANI `cause` — jediné, co o příčině
      // řekne, je token `net::ERR_…` uvnitř zprávy. Změřeno naostro: zakázaná hlavička shodí
      // požadavek chybou `net::ERR_INVALID_ARGUMENT`, a bez tohohle řádku by z ní v logu zbylo
      // holé „Error". Vytahujeme proto JEN ten token: má pevný strojový tvar a neobsahuje
      // adresu, takže zbytek zprávy zůstává mimo log stejně jako dosud.
      const chromiumKod = String(error?.message ?? "").match(/net::ERR_[A-Z_]{1,40}/u)?.[0] ?? null;
      // Přesměrování pojmenujeme natvrdo: je to nejčastější tichá příčina (vypršelá session,
      // proxy, captive portal) a bez jména vypadá jako obyčejný výpadek sítě.
      const pricina = /redirect/iu.test(String(error?.message ?? ""))
        ? "server odpověděl přesměrováním, nejspíš na přihlášení"
        : kod ?? vnorenyKod ?? chromiumKod ?? nazev ?? "neznámá příčina";
      // Metoda a CESTA (ne celá adresa a nikdy ne zpráva chyby) říkají, který krok uploadu
      // spadl — bez toho se nepozná zahájení od posílání částí ani od dokončení.
      throw localError(
        "network_error",
        `Síťový požadavek uploadu selhal: ${pricina} [${method} ${pathname}]`,
        "retryable",
      );
    } finally {
      clearTimeout(timeoutId);
    }
    const { payload, response } = exchange;
    if (!response?.ok) throw serverError(response?.status, payload);
    return payload;
  };
}

function validatedRecordingId(payload) {
  const recordingId = safeString(payload?.recordingId);
  if (!UUID_PATTERN.test(recordingId)) {
    throw localError("invalid_response", "Server nevrátil recordingId", "retryable");
  }
  return recordingId;
}

function verifyRemoteIdentity(payload, track, sizeField) {
  const remoteSize = payload?.[sizeField];
  const remoteSha256 = safeString(payload?.sha256).toLowerCase();
  if (!Number.isSafeInteger(remoteSize) || !SHA256_PATTERN.test(remoteSha256)) {
    throw localError("invalid_response", "Server nepotvrdil velikost a otisk uploadu", "retryable");
  }
  if (remoteSize !== track.sizeBytes) {
    throw localError("idempotency_conflict", "Server pod klíčem eviduje jinou velikost", "permanent");
  }
  if (remoteSha256 !== track.sha256) {
    throw localError("idempotency_conflict", "Server pod klíčem eviduje jiný otisk", "permanent");
  }
}

function missingChunkIndexes(payload, chunkCount) {
  if (COMPLETE_UPLOAD_STATES.has(safeString(payload?.state).toLowerCase())) return [];
  let missing = payload?.missing;
  if (!Array.isArray(missing) && Array.isArray(payload?.receivedChunks)) {
    const received = new Set(payload.receivedChunks);
    missing = Array.from({ length: chunkCount }, (_, index) => index)
      .filter((index) => !received.has(index));
  }
  if (!Array.isArray(missing)) {
    return Array.from({ length: chunkCount }, (_, index) => index);
  }
  const unique = new Set();
  for (const index of missing) {
    if (!Number.isInteger(index) || index < 0 || index >= chunkCount) {
      throw localError("invalid_response", "Server vrátil neplatný seznam částí", "retryable");
    }
    unique.add(index);
  }
  return [...unique].sort((left, right) => left - right);
}

function initPayload(recording, track, context) {
  const startedAt = normalizedDate(track.manifestTrack.startedAt ?? recording.manifest.createdAt);
  const endedAt = normalizedDate(track.manifestTrack.endedAt ?? recording.manifest.closedAt);
  return {
    chunkCount: track.chunkCount,
    chunkSize: RECORDING_CHUNK_BYTES,
    // Server rozlišuje samostatné uploady podle stopy, ne jen podle schůzky.
    // Odvozené UUID zůstává interní; společný klíč by sloučil obě stopy do jedné.
    clientRecordingId: `${recording.manifest.clientRecordingId}:${track.trackKind}`,
    companyTabidooId: context.companyTabidooId,
    declaredBytes: track.sizeBytes,
    declaredCaptureSources: declaredCaptureSourcesFromManifest(recording.manifest),
    declaredMime: track.contentType,
    deviceLabel: context.deviceLabel,
    endedAt,
    sessionId: safeString(recording.manifest.sessionId) || null,
    sha256: track.sha256,
    startedAt,
    title: titleForTrack(recording.manifest, track.trackKind),
    visibility: recording.manifest.visibility === "company" ? "company" : "private",
  };
}

async function readChunk(track, index) {
  const position = index * RECORDING_CHUNK_BYTES;
  const length = Math.min(RECORDING_CHUNK_BYTES, track.sizeBytes - position);
  let handle;
  try {
    handle = await fs.promises.open(track.filePath, "r");
    const bytes = await readExact(handle, length, position);
    if (createHash("sha256").update(bytes).digest("hex") !== track.chunkHashes[index]) {
      throw localError("sha256_mismatch", "Soubor se během uploadu změnil", "permanent");
    }
    return bytes;
  } catch (error) {
    if (error instanceof RecordingUploadError) throw error;
    throw localError("sha256_mismatch", "Soubor se během uploadu změnil", "permanent");
  } finally {
    await handle?.close().catch(() => {});
  }
}

function logIdempotencyConflict(logger, recording, track) {
  safeLog(
    logger,
    "error",
    `[upload] idempotency_conflict: ${recording.clientRecordingId}/${track.trackKind}`,
  );
}

function verifyRemoteIdentityAndLog(payload, track, sizeField, logger, recording) {
  try {
    verifyRemoteIdentity(payload, track, sizeField);
  } catch (error) {
    if (error?.code === "idempotency_conflict") {
      logIdempotencyConflict(logger, recording, track);
    }
    throw error;
  }
}

async function uploadTrack({ context, logger, recording, request, track }) {
  const trackRequest = async (...args) => {
    try {
      return await request(...args);
    } catch (error) {
      if (error?.code === "idempotency_conflict") {
        logIdempotencyConflict(logger, recording, track);
      }
      throw error;
    }
  };
  const body = JSON.stringify(initPayload(recording, track, context));
  const initialized = await trackRequest("/api/nahravky/uploads", {
    body,
    // 🔴 ŽÁDNÁ ruční `Content-Length`. Odesíláme přes Electroní `net.fetch`, tedy chromí
    // síťový stack, a ten ji jako zakázanou hlavičku odmítne chybou `net::ERR_INVALID_ARGUMENT`
    // JEŠTĚ PŘED odesláním — požadavek se na síť vůbec nedostane. Přesně kvůli tomu první
    // ostré odeslání selhalo: serveru dorazil seznam firem (jde přes Node `fetch`, který je
    // shovívavý) a hned následující zahájení uploadu už ne. Délku si `fetch` spočítá sám.
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": track.identity.idempotencyKey,
    },
    method: "POST",
  });

  const recordingId = validatedRecordingId(initialized);
  const quotaWarning = initialized.quotaWarning === true;
  if (quotaWarning) {
    safeLog(
      logger,
      "warn",
      `[upload] quotaWarning=true: ${recording.clientRecordingId}/${track.trackKind}`,
    );
  }

  const status = await trackRequest(`/api/nahravky/uploads/${recordingId}`);
  verifyRemoteIdentityAndLog(status, track, "declaredBytes", logger, recording);
  if (COMPLETE_UPLOAD_STATES.has(safeString(status.state).toLowerCase())) {
    return Object.freeze({ quotaWarning, recordingId, track: track.trackKind });
  }

  // Záměrně sekvenční await v obyčejném for-of: proxy nesmí vidět souběžné části.
  for (const index of missingChunkIndexes(status, track.chunkCount)) {
    const bytes = await readChunk(track, index);
    await trackRequest(`/api/nahravky/uploads/${recordingId}/casti/${index}`, {
      body: bytes,
      // Bez ruční `Content-Length` — viz zahájení výš: chromí stack ji odmítne předem.
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Chunk-Sha256": track.chunkHashes[index],
      },
      method: "PUT",
    });
  }

  // Dokončení nemá tělo. Ruční `Content-Length: "0"` tu byla zbytečná a stejně zakázaná —
  // shodila by i tenhle krok, takže dokončení nebylo dosažitelné o nic víc než zahájení.
  const finalized = await trackRequest(`/api/nahravky/uploads/${recordingId}/dokoncit`, {
    method: "POST",
  });
  verifyRemoteIdentityAndLog(finalized, track, "sizeBytes", logger, recording);
  if (
    safeString(finalized.state).toLowerCase() !== "stored"
    || !UUID_PATTERN.test(safeString(finalized.recordingId))
  ) {
    throw localError("finalization_unconfirmed", "Server nepotvrdil dokončení uploadu", "retryable");
  }
  // 🔴 DRUHÁ, NEZÁVISLÁ OBRANA. Když server při dokončení najde nahrávku se shodným otiskem,
  // tuhle stopu SMAŽE a vrátí `recordingId` TÉ CIZÍ — přitom stav `stored` i platné UUID
  // sedí, takže kontrola výš projde. Jediné, co se rozejde, je identifikátor.
  // ⚠️ Upozornila na to serverová session; sami bychom to nepoznali, protože
  // `verifyRemoteIdentity` porovnává velikost a otisk, a ty u kolize SEDÍ.
  if (safeString(finalized.recordingId) !== recordingId) {
    throw localError(
      "recording_replaced",
      "Server přiřadil nahrávku k jinému záznamu, než který založil. "
        + "Tahle stopa by se neuložila samostatně a opakování nepomůže.",
      "permanent",
    );
  }
  return Object.freeze({ quotaWarning, recordingId, track: track.trackKind });
}

/**
 * @param {{
 *   fetchImpl: (input: string, options?: Record<string, any>) => Promise<any>,
 *   getUploadContext: () => Promise<any>,
 *   logger?: {
 *     error?: (message: string) => void,
 *     log?: (message: string) => void,
 *     warn?: (message: string) => void,
 *   },
 *   origin: string,
 *   requestTimeoutMs?: number,
 * }} options
 */
function createRecordingUploadSend({
  fetchImpl,
  getUploadContext,
  logger = console,
  origin,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl musí být funkce");
  if (typeof getUploadContext !== "function") {
    throw new TypeError("getUploadContext musí být funkce");
  }
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new TypeError("requestTimeoutMs musí být kladné celé číslo");
  }
  const uploadOrigin = normalizedOrigin(origin);

  return async function sendRecording(item) {
    if (item?.kind === "time") {
      throw localError(
        "time_upload_unavailable",
        "Odesílání času zatím není zapojené",
        "paused",
      );
    }
    const recording = await preflightRecording(item);
    let rawContext;
    try {
      rawContext = await getUploadContext();
    } catch {
      throw localError("session_missing", "Přihlášení pro upload nelze načíst", "paused");
    }
    const context = normalizedContext(rawContext, recording.manifest, uploadOrigin, item);
    const request = createRequester({
      accessToken: context.accessToken,
      fetchImpl,
      origin: uploadOrigin,
      requestTimeoutMs,
    });
    const uploads = [];
    let quotaWarning = false;
    for (const track of recording.tracks) {
      const uploaded = await uploadTrack({ context, logger, recording, request, track });
      uploads.push(uploaded);
      quotaWarning ||= uploaded.quotaWarning;
    }
    return Object.freeze({ completedUploads: uploads.length, quotaWarning, uploads });
  };
}

module.exports = {
  failureClassForStatus,
  RECORDING_CHUNK_BYTES,
  RECORDING_MAX_BYTES,
  RecordingUploadError,
  createRecordingUploadSend,
  deriveUploadIdentity,
  failureClassForCode,
};
