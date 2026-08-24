const { randomBytes, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const LOOPBACK_HOST = "127.0.0.1";
const CALLBACK_PATH = "/callback";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const TOKEN_DIRECTORY = "auth";
const TOKEN_FILE = "oauth.enc";
const MCP_SCOPES = new Set(["mcp:read", "mcp:draft"]);

let oauthLogicPromise;

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

async function createLoopbackListener(expectedState, verifyState, timeoutMs) {
  let settled = false;
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

  server = http.createServer((request, response) => {
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
    if (!settled) {
      settled = true;
      rejectCode(error);
    }
    close();
  });

  timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    close();
    rejectCode(new Error("Přihlášení se v časovém limitu nevrátilo"));
  }, timeoutMs);
  timer.unref?.();

  const port = server.address().port;
  return {
    close,
    codePromise,
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

async function persistEncryptedSession(app, safeStorage, session) {
  if (!safeStorage?.isEncryptionAvailable?.()) {
    throw new Error("Bezpečné úložiště systému není dostupné; přihlašovací údaje se neuložily");
  }

  const directory = path.join(app.getPath("userData"), TOKEN_DIRECTORY);
  const destination = path.join(directory, TOKEN_FILE);
  const temporary = path.join(directory, `.${TOKEN_FILE}.${randomUUID()}.tmp`);
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.promises.chmod(directory, 0o700);

  const encrypted = safeStorage.encryptString(JSON.stringify(session));
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

function createAuthController(options) {
  const issuer = normalizedIssuer(options.issuer);
  const scope = validatedMcpScope(options.scope ?? "mcp:read");
  const expectedResource = `${issuer}/api/mcp`;
  const resource = options.resource ?? expectedResource;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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

  return {
    async begin() {
      const oauth = await loadOauthLogic();
      const endpoints = await discoverEndpoints(fetchImpl, issuer);
      const pkce = oauth.createPkce(randomSource);
      const state = oauth.generateState(randomSource);
      const listener = await createLoopbackListener(state, oauth.verifyState, timeoutMs);

      try {
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

        const code = await listener.codePromise;
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
        const accessToken = requiredString(tokenResponse.access_token, "access_token");
        const identity = await resolveUserIdentity(
          options,
          fetchImpl,
          accessToken,
          tokenResponse,
          issuer,
        );
        const expiresIn = Number(tokenResponse.expires_in);

        await persistEncryptedSession(app, safeStorage, {
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
        });

        return { ok: true, user: identity };
      } finally {
        listener.close();
      }
    },
  };
}

module.exports = { createAuthController };
