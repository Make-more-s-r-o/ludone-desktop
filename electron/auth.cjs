const { randomBytes, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const LOOPBACK_HOST = "127.0.0.1";
const CALLBACK_PATH = "/callback";
const SERVER_PENDING_TTL_MS = 10 * 60 * 1000;
// Rezerva kryje plánování event loopu a doběh síťové odpovědi na hraně serverového TTL;
// bez ní mohou oba časovače vypršet prakticky současně a desktop zavřít port jako první.
const AUTH_TIMEOUT_RESERVE_MS = 30 * 1000;
const DEFAULT_TIMEOUT_MS = SERVER_PENDING_TTL_MS + AUTH_TIMEOUT_RESERVE_MS;
const REVOKE_TIMEOUT_MS = 5 * 1000;
const TOKEN_DIRECTORY = "auth";
const TOKEN_FILE = "oauth.enc";
const TOKEN_STORAGE_NAMESPACE = "cz.ludone.desktop";
const PROJECT_ROOT = path.resolve(__dirname, "..");
const MCP_SCOPES = new Set(["mcp:read", "mcp:draft"]);

let oauthLogicPromise;
let tokenStorageTransaction = Promise.resolve();

function loadOauthLogic() {
  if (!oauthLogicPromise) {
    const moduleUrl = pathToFileURL(path.join(__dirname, "..", "src", "lib", "oauth.js"));
    oauthLogicPromise = import(moduleUrl.href);
  }
  return oauthLogicPromise;
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} musí být neprázdný řetězec`);
  }
  return value;
}

function normalizedIssuer(value) {
  const url = new URL(requiredString(value, "issuer"));
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("OAuth issuer musí být čistá HTTPS adresa");
  }
  return url.href.replace(/\/$/, "");
}

function trustedRemoteEndpoint(value, issuer, name) {
  const endpoint = new URL(requiredString(value, name));
  if (
    endpoint.protocol !== "https:"
    || endpoint.origin !== new URL(issuer).origin
    || endpoint.username
    || endpoint.password
    || endpoint.hash
  ) {
    throw new Error(`${name} musí být HTTPS endpoint na originu issueru`);
  }
  return endpoint.href;
}

function validatedMcpScope(value) {
  const scope = requiredString(value, "scope");
  const requested = scope.split(/\s+/);
  if (requested.some((item) => !MCP_SCOPES.has(item))) {
    throw new Error("E7 smí žádat jen MCP scopy; scope pro odesílání není dostupný");
  }
  return requested.join(" ");
}

function resolveAuthTimeout(value) {
  const timeoutMs = value ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Časový limit přihlášení musí být kladné konečné číslo");
  }
  return timeoutMs;
}

async function jsonResponse(fetchImpl, url, options, label) {
  const response = await fetchImpl(url, options);
  if (!response.ok) {
    throw new Error(`${label} selhal (HTTP ${response.status})`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} nevrátil platný JSON`);
  }
}

async function discoverEndpoints(fetchImpl, issuer) {
  const metadataUrl = new URL("/.well-known/oauth-authorization-server", issuer).href;
  const metadata = await jsonResponse(fetchImpl, metadataUrl, {
    headers: { accept: "application/json" },
    redirect: "error",
  }, "OAuth discovery");

  if (metadata.issuer && normalizedIssuer(metadata.issuer) !== issuer) {
    throw new Error("OAuth discovery vrátil jiné issuer");
  }
  if (!metadata.code_challenge_methods_supported?.includes("S256")) {
    throw new Error("OAuth server nepodporuje povinné PKCE S256");
  }

  return {
    authorizationEndpoint: trustedRemoteEndpoint(
      metadata.authorization_endpoint,
      issuer,
      "authorization_endpoint",
    ),
    tokenEndpoint: trustedRemoteEndpoint(metadata.token_endpoint, issuer, "token_endpoint"),
    revocationEndpoint: metadata.revocation_endpoint === undefined
      ? null
      : trustedRemoteEndpoint(metadata.revocation_endpoint, issuer, "revocation_endpoint"),
    registrationEndpoint: trustedRemoteEndpoint(
      metadata.registration_endpoint,
      issuer,
      "registration_endpoint",
    ),
  };
}

function sendBrowserResponse(response, statusCode, message) {
  const body = `<!doctype html><meta charset="utf-8"><title>LuDone Desktop</title><p>${message}</p>`;
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    connection: "close",
    "content-length": Buffer.byteLength(body),
    "content-type": "text/html; charset=utf-8",
    pragma: "no-cache",
  });
  response.end(body);
}

async function createLoopbackListener(
  expectedState,
  verifyState,
  timeoutMs,
  createServer = http.createServer,
) {
  let settled = false;
  let cancelled = false;
  let server;
  let timer;
  let resolveCode;
  let rejectCode;

  const codePromise = new Promise((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const close = () => {
    if (timer) clearTimeout(timer);
    if (server?.listening) server.close();
  };

  const rejectPending = (error) => {
    if (settled) return false;
    settled = true;
    close();
    rejectCode(error);
    return true;
  };

  const cancel = () => {
    cancelled = true;
    return rejectPending(new Error("Přihlášení bylo zrušeno"));
  };

  server = createServer((request, response) => {
    const address = server.address();
    const expectedHost = `${LOOPBACK_HOST}:${address.port}`;
    if (request.method !== "GET" || request.headers.host !== expectedHost) {
      sendBrowserResponse(response, 404, "Požadavek nebyl přijat.");
      return;
    }

    const callbackUrl = new URL(request.url, `http://${expectedHost}`);
    if (callbackUrl.pathname !== CALLBACK_PATH) {
      sendBrowserResponse(response, 404, "Požadavek nebyl přijat.");
      return;
    }
    if (settled) {
      sendBrowserResponse(response, 409, "Přihlášení už bylo dokončeno.");
      return;
    }

    const returnedState = callbackUrl.searchParams.get("state");
    if (!verifyState(expectedState, returnedState)) {
      sendBrowserResponse(response, 400, "Přihlášení bylo odmítnuto kvůli neplatnému state.");
      return;
    }

    const oauthError = callbackUrl.searchParams.get("error");
    const code = callbackUrl.searchParams.get("code");
    settled = true;
    if (oauthError || !code) {
      sendBrowserResponse(response, 400, "Přihlášení nebylo dokončeno.");
      close();
      rejectCode(new Error(oauthError ? `OAuth odmítl přihlášení: ${oauthError}` : "Chybí autorizační kód"));
      return;
    }

    sendBrowserResponse(response, 200, "Hotovo, vraťte se do LuDone Desktop.");
    close();
    resolveCode(code);
  });

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
    server.listen(0, LOOPBACK_HOST);
  });

  server.on("error", (error) => {
    rejectPending(error);
  });

  timer = setTimeout(() => {
    rejectPending(new Error("Přihlášení se v časovém limitu nevrátilo"));
  }, resolveAuthTimeout(timeoutMs));
  timer.unref?.();

  const port = server.address().port;
  return {
    cancel,
    close,
    codePromise,
    isCancelled: () => cancelled,
    redirectUri: `http://${LOOPBACK_HOST}:${port}${CALLBACK_PATH}`,
  };
}

async function registerPublicClient(fetchImpl, endpoint, redirectUri, scope) {
  const registration = await jsonResponse(fetchImpl, endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    redirect: "error",
    body: JSON.stringify({
      client_name: "LuDone Desktop",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope,
    }),
  }, "Dynamická registrace OAuth klienta");

  return requiredString(registration.client_id, "client_id");
}

function normalizeIdentity(value) {
  const identity = value?.user ?? value?.identity ?? value?.account ?? value;
  const email = identity?.email;
  const name = identity?.name ?? identity?.displayName;
  if (typeof email !== "string" || email.length === 0 || typeof name !== "string" || name.length === 0) {
    throw new Error("LuDone nevrátilo úplnou identitu uživatele");
  }
  return { name, email };
}

async function resolveUserIdentity(options, fetchImpl, accessToken, tokenResponse, issuer) {
  if (typeof options.resolveIdentity === "function") {
    return normalizeIdentity(await options.resolveIdentity({ accessToken, issuer }));
  }
  if (options.identityEndpoint) {
    const endpoint = trustedRemoteEndpoint(options.identityEndpoint, issuer, "identityEndpoint");
    const result = await jsonResponse(fetchImpl, endpoint, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      redirect: "error",
    }, "Načtení identity uživatele");
    return normalizeIdentity(result);
  }
  return normalizeIdentity(tokenResponse);
}

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await fs.promises.open(directory, "r");
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === ""
    || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function physicalPotentialPath(value) {
  let existing = path.resolve(value);
  const missingParts = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    missingParts.unshift(path.basename(existing));
    existing = parent;
  }

  const realExisting = fs.realpathSync.native
    ? fs.realpathSync.native(existing)
    : fs.realpathSync(existing);
  return path.resolve(realExisting, ...missingParts);
}

function tokenStorageDirectory(app) {
  const appData = requiredString(app.getPath("appData"), "appData");
  const directory = path.resolve(appData, TOKEN_STORAGE_NAMESPACE, TOKEN_DIRECTORY);
  const projectRoots = [PROJECT_ROOT, physicalPotentialPath(PROJECT_ROOT)];
  const candidatePaths = [directory, physicalPotentialPath(directory)];

  if (projectRoots.some((root) => candidatePaths.some((candidate) => isPathInside(root, candidate)))) {
    throw new Error("Přihlašovací údaje se neuložily: cílové úložiště leží uvnitř repozitáře");
  }
  return directory;
}

function assertEncryptionAvailable(safeStorage) {
  let available = false;
  try {
    available = safeStorage?.isEncryptionAvailable?.() === true;
  } catch {
    available = false;
  }
  if (!available) {
    throw new Error("Bezpečné úložiště systému není dostupné; přihlašovací údaje se neuložily");
  }
}

async function prepareTokenStorage(app, safeStorage) {
  assertEncryptionAvailable(safeStorage);

  const directory = tokenStorageDirectory(app);
  const destination = path.join(directory, TOKEN_FILE);
  const probe = path.join(directory, `.${TOKEN_FILE}.${randomUUID()}.preflight`);
  let handle;
  try {
    await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.promises.chmod(directory, 0o700);
    handle = await fs.promises.open(probe, "wx", 0o600);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.promises.unlink(probe);
    await syncDirectory(directory);
  } catch (cause) {
    await handle?.close().catch(() => {});
    await fs.promises.unlink(probe).catch(() => {});
    throw new Error(
      "Bezpečné úložiště systému není dostupné: adresář přihlašovacích údajů nelze připravit",
      { cause },
    );
  }
  return Object.freeze({ directory, destination });
}

async function writeEncryptedSession(storage, encrypted) {
  const { directory, destination } = storage;
  const temporary = path.join(directory, `.${TOKEN_FILE}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.promises.open(temporary, "wx", 0o600);
    await handle.writeFile(encrypted);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.promises.rename(temporary, destination);
    await fs.promises.chmod(destination, 0o600);
    await syncDirectory(directory);
  } catch (error) {
    await handle?.close();
    await fs.promises.unlink(temporary).catch(() => {});
    throw error;
  }
}

async function persistEncryptedSession(safeStorage, session, storage) {
  assertEncryptionAvailable(safeStorage);
  const encrypted = safeStorage.encryptString(JSON.stringify(session));
  await writeEncryptedSession(storage, encrypted);
}

async function readEncryptedSession(storage) {
  try {
    return await fs.promises.readFile(storage.destination);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function removeEncryptedSession(storage) {
  try {
    await fs.promises.unlink(storage.destination);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await syncDirectory(storage.directory);
}

async function restoreEncryptedSession(storage, previousSession) {
  if (previousSession === null) {
    await removeEncryptedSession(storage);
    return;
  }
  await writeEncryptedSession(storage, previousSession);
}

async function withTokenStorageTransaction(task) {
  const previous = tokenStorageTransaction;
  let release;
  tokenStorageTransaction = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

function cancelledAuthError() {
  return new Error("Přihlášení bylo zrušeno");
}

async function revokeIssuedTokens(fetchImpl, revocationEndpoint, clientId, tokenResponse) {
  if (!revocationEndpoint) {
    throw new Error("OAuth discovery neposkytlo endpoint pro odvolání vydaného tokenu");
  }
  const refreshToken = typeof tokenResponse.refresh_token === "string"
    ? tokenResponse.refresh_token
    : null;
  const token = refreshToken ?? requiredString(tokenResponse.access_token, "access_token");
  const body = new URLSearchParams({
    client_id: clientId,
    token,
    token_type_hint: refreshToken ? "refresh_token" : "access_token",
  });
  const abortController = new AbortController();
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      abortController.abort();
      reject(new Error("Odvolání vydaného tokenu překročilo časový limit"));
    }, REVOKE_TIMEOUT_MS);
    timeout.unref?.();
  });
  let response;
  try {
    response = await Promise.race([
      fetchImpl(revocationEndpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        redirect: "error",
        body: body.toString(),
        signal: abortController.signal,
      }),
      deadline,
    ]);
  } finally {
    clearTimeout(timeout);
  }
  if (!response?.ok) {
    throw new Error(`Odvolání vydaného tokenu selhalo (HTTP ${response?.status ?? "neznámý"})`);
  }
}

async function rollbackIssuedSession(
  fetchImpl,
  revocationEndpoint,
  clientId,
  tokenResponse,
  storage,
  previousSession,
) {
  const failures = [];
  try {
    await revokeIssuedTokens(fetchImpl, revocationEndpoint, clientId, tokenResponse);
  } catch (error) {
    failures.push(error);
  }
  try {
    await restoreEncryptedSession(storage, previousSession);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Vydané přihlašovací údaje se nepodařilo bezpečně uklidit");
  }
}

function rollbackFailure(primaryError, rollbackError, cancelled) {
  const message = cancelled
    ? "Přihlášení bylo zrušeno, ale vydané přihlašovací údaje se nepodařilo bezpečně uklidit"
    : `${primaryError.message}; vydané přihlašovací údaje se nepodařilo bezpečně uklidit`;
  return new Error(message, {
    cause: new AggregateError([primaryError, rollbackError]),
  });
}

function createAuthController(options) {
  const issuer = normalizedIssuer(options.issuer);
  const scope = validatedMcpScope(options.scope ?? "mcp:read");
  const expectedResource = `${issuer}/api/mcp`;
  const resource = options.resource ?? expectedResource;
  const timeoutMs = resolveAuthTimeout(options.timeoutMs);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const randomSource = options.randomSource ?? randomBytes;
  const { app, safeStorage, shell } = options;

  if (typeof fetchImpl !== "function") throw new TypeError("Chybí fetch implementace");
  if (!app?.getPath || !safeStorage || !shell?.openExternal) {
    throw new TypeError("Chybí Electron app, safeStorage nebo shell");
  }
  if (resource !== expectedResource) {
    throw new Error("E7 se smí autorizovat jen k MCP resource issueru");
  }

  async function start() {
    let listener;
    try {
      const storage = await prepareTokenStorage(app, safeStorage);
      const oauth = await loadOauthLogic();
      const endpoints = await discoverEndpoints(fetchImpl, issuer);
      if (!endpoints.revocationEndpoint) {
        throw new Error("OAuth issuer neposkytuje endpoint pro bezpečné zrušení přihlášení");
      }
      const pkce = oauth.createPkce(randomSource);
      const state = oauth.generateState(randomSource);
      listener = await createLoopbackListener(
        state,
        oauth.verifyState,
        timeoutMs,
        options.loopbackServerFactory,
      );

      const clientId = options.clientId ?? await registerPublicClient(
        fetchImpl,
        endpoints.registrationEndpoint,
        listener.redirectUri,
        scope,
      );
      const authorizationUrl = oauth.buildAuthorizationUrl({
        authorizationEndpoint: endpoints.authorizationEndpoint,
        clientId,
        redirectUri: listener.redirectUri,
        scope,
        state,
        codeChallenge: pkce.codeChallenge,
        resource,
      });
      trustedRemoteEndpoint(authorizationUrl.href, issuer, "Autorizační URL");
      await shell.openExternal(authorizationUrl.href);

      const result = (async () => {
        try {
          const code = await listener.codePromise;
          if (listener.isCancelled()) throw cancelledAuthError();
          const tokenBody = oauth.buildTokenRequestBody({
            code,
            codeVerifier: pkce.codeVerifier,
            redirectUri: listener.redirectUri,
            clientId,
            resource,
          });
          const tokenResponse = await jsonResponse(fetchImpl, endpoints.tokenEndpoint, {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/x-www-form-urlencoded",
            },
            redirect: "error",
            body: tokenBody.toString(),
          }, "Výměna autorizačního kódu");
          let rollbackStarted = false;
          try {
            const accessToken = requiredString(tokenResponse.access_token, "access_token");
            const identity = await resolveUserIdentity(
              options,
              fetchImpl,
              accessToken,
              tokenResponse,
              issuer,
            );
            const expiresIn = Number(tokenResponse.expires_in);

            await withTokenStorageTransaction(async () => {
              const previousSession = await readEncryptedSession(storage);
              try {
                await persistEncryptedSession(safeStorage, {
                  v: 1,
                  issuer,
                  clientId,
                  resource,
                  scope,
                  accessToken,
                  refreshToken: typeof tokenResponse.refresh_token === "string"
                    ? tokenResponse.refresh_token
                    : null,
                  tokenType: typeof tokenResponse.token_type === "string" ? tokenResponse.token_type : "Bearer",
                  accessExpiresAt: Number.isFinite(expiresIn) ? Date.now() + expiresIn * 1000 : null,
                  identity,
                }, storage);
              } catch (error) {
                rollbackStarted = true;
                try {
                  await rollbackIssuedSession(
                    fetchImpl,
                    endpoints.revocationEndpoint,
                    clientId,
                    tokenResponse,
                    storage,
                    previousSession,
                  );
                } catch (cleanupError) {
                  throw rollbackFailure(error, cleanupError, listener.isCancelled());
                }
                throw listener.isCancelled() ? cancelledAuthError() : error;
              }

              if (listener.isCancelled()) {
                rollbackStarted = true;
                const cancellation = cancelledAuthError();
                try {
                  await rollbackIssuedSession(
                    fetchImpl,
                    endpoints.revocationEndpoint,
                    clientId,
                    tokenResponse,
                    storage,
                    previousSession,
                  );
                } catch (cleanupError) {
                  throw rollbackFailure(cancellation, cleanupError, true);
                }
                throw cancellation;
              }
            });
            return { ok: true, user: identity };
          } catch (error) {
            if (!rollbackStarted) {
              rollbackStarted = true;
              try {
                await revokeIssuedTokens(
                  fetchImpl,
                  endpoints.revocationEndpoint,
                  clientId,
                  tokenResponse,
                );
              } catch (cleanupError) {
                throw rollbackFailure(error, cleanupError, listener.isCancelled());
              }
            }
            if (listener.isCancelled() && !/zrušeno/i.test(error.message)) {
              throw cancelledAuthError();
            }
            throw error;
          }
        } finally {
          listener.close();
        }
      })();
      // Odmítnutí má vždy pozorovatele i v krátkém okně mezi návratem start() a
      // připojením rendereru; původní promise zůstává odmítnutá pro jeho await.
      result.catch(() => {});

      return Object.freeze({
        authorizationUrl: authorizationUrl.href,
        cancel: listener.cancel,
        result,
      });
    } catch (error) {
      if (listener) {
        listener.cancel();
        await listener.codePromise.catch(() => {});
      }
      throw error;
    }
  }

  return {
    async begin() {
      const attempt = await start();
      return attempt.result;
    },
    start,
  };
}

const PERMISSION_MEDIA_TYPES = new Map([
  ["microphone", "microphone"],
  ["system-audio", "screen"],
]);

const PERMISSION_SETTINGS_URLS = Object.freeze({
  microphone: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
  screen: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
});

function decidePermissionResult(requestedPermission, systemStatus) {
  const knownStatuses = new Set(["granted", "denied", "restricted", "not-determined"]);
  const status = knownStatuses.has(systemStatus) ? systemStatus : "unknown";
  const mediaType = PERMISSION_MEDIA_TYPES.get(requestedPermission);

  if (!mediaType) {
    return {
      permission: requestedPermission,
      status: "unknown",
      granted: false,
      nextAction: "none",
      settingsUrl: null,
    };
  }

  let nextAction = "none";
  if (status === "not-determined") {
    nextAction = mediaType === "microphone" ? "request" : "open-settings";
  } else if (status === "denied") {
    nextAction = "open-settings";
  }

  return {
    permission: requestedPermission,
    status,
    granted: status === "granted",
    nextAction,
    settingsUrl: nextAction === "open-settings" ? PERMISSION_SETTINGS_URLS[mediaType] : null,
  };
}

function createPermissionRequestHandler({ systemPreferences, shell, logger = console }) {
  if (!systemPreferences?.getMediaAccessStatus || !systemPreferences?.askForMediaAccess) {
    throw new TypeError("Chybí Electron systemPreferences pro kontrolu oprávnění");
  }
  if (!shell?.openExternal) throw new TypeError("Chybí Electron shell pro otevření Nastavení");

  return async function requestPermission(permission) {
    const mediaType = PERMISSION_MEDIA_TYPES.get(permission);
    if (!mediaType) return decidePermissionResult(permission);

    let status;
    try {
      status = systemPreferences.getMediaAccessStatus(mediaType);
    } catch (error) {
      logger.error(`[permissions] Stav oprávnění ${permission} se nepodařilo přečíst: ${error.message}`);
      return decidePermissionResult(permission);
    }

    let result = decidePermissionResult(permission, status);
    if (result.nextAction === "request") {
      try {
        await systemPreferences.askForMediaAccess("microphone");
        status = systemPreferences.getMediaAccessStatus("microphone");
        result = decidePermissionResult(permission, status);
      } catch (error) {
        logger.error(`[permissions] Žádost o mikrofon selhala: ${error.message}`);
        result = decidePermissionResult(permission);
      }
    } else if (result.nextAction === "open-settings") {
      try {
        await shell.openExternal(result.settingsUrl);
      } catch (error) {
        logger.error(`[permissions] Nastavení systému se nepodařilo otevřít: ${error.message}`);
      }
    }

    return result;
  };
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  createAuthController,
  createPermissionRequestHandler,
  decidePermissionResult,
  resolveAuthTimeout,
  tokenStorageDirectory,
};
