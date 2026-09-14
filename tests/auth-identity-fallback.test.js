import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import { readFile, mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  IDENTITY_LOOKUP_DEADLINE_MS,
  UPLOAD_SCOPE,
  createAuthController,
  tokenSessionFilePath,
} = require("../electron/auth.cjs");

const ISSUER = "https://app.ludone.cz";
const CLIENT_ID = "desktop-identity-test";
const REGISTERED_CLIENT_ID = "desktop-registered-test";
const ACCESS_TOKEN = "test-access-token-nepatri-do-logu";
const AUTHORIZATION_CODE = "test-authorization-code-nepatri-do-logu";
const temporaryRoots = new Set();
const TOKEN_RESPONSE = Object.freeze({
  access_token: ACCESS_TOKEN,
  expires_in: 900,
  refresh_token: "refresh-ne-logovat",
  scope: "mcp:read",
  token_type: "Bearer",
});
const TOKEN_IDENTITY_SENTINEL = Object.freeze({
  email: "tokenova-identita@example.invalid",
  name: "Tokenová identita",
});
const MCP_RESPONSE = Object.freeze({
  jsonrpc: "2.0",
  id: 1,
  result: {
    content: [{
      type: "text",
      text: JSON.stringify({ pong: true, user: "dan@ludone.cz" }),
    }],
  },
});

function jsonResponse(value, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: vi.fn(async () => value),
  };
}

class CallbackLoopbackServer extends EventEmitter {
  constructor(handler) {
    super();
    this.handler = handler;
    this.listening = false;
  }

  address() {
    return { address: "127.0.0.1", family: "IPv4", port: 49721 };
  }

  close() {
    this.listening = false;
  }

  listen() {
    this.listening = true;
    queueMicrotask(() => this.emit("listening"));
  }

  deliverCode(authorizationUrl) {
    const state = new URL(authorizationUrl).searchParams.get("state");
    const response = { end: vi.fn(), writeHead: vi.fn() };
    this.handler({
      headers: { host: "127.0.0.1:49721" },
      method: "GET",
      url: `/callback?code=${encodeURIComponent(AUTHORIZATION_CODE)}&state=${encodeURIComponent(state)}`,
    }, response);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  }

  deliverError(authorizationUrl, error, errorDescription = "") {
    const state = new URL(authorizationUrl).searchParams.get("state");
    const response = { end: vi.fn(), writeHead: vi.fn() };
    const params = new URLSearchParams({ error, error_description: errorDescription, state });
    this.handler({
      headers: { host: "127.0.0.1:49721" },
      method: "GET",
      url: `/callback?${params.toString()}`,
    }, response);
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
  }
}

/**
 * @param {{
 *   appData?: string,
 *   clientId?: string | null,
 *   issuer?: string,
 *   scope?: string,
 *   identityEndpoint?: string,
 *   mcpHandler?: (input: string | URL, init: RequestInit) => Promise<{
 *     ok: boolean,
 *     status: number,
 *     json?: () => Promise<unknown>,
 *   }>,
 *   userinfoHandler?: (input: string | URL, init: RequestInit) => Promise<{
 *     ok: boolean,
 *     status: number,
 *     json?: () => Promise<unknown>,
 *   }>,
 *   tokenResponse?: Record<string, unknown>,
 *   tokenHandler?: (input: string | URL, init: RequestInit) => Promise<{
 *     ok: boolean,
 *     status: number,
 *     json?: () => Promise<unknown>,
 *   }>,
 * }} [options]
 */
async function createHarness(options = {}) {
  const {
    clientId = CLIENT_ID,
    issuer = ISSUER,
    scope,
    identityEndpoint,
    mcpHandler = async () => jsonResponse(MCP_RESPONSE),
    userinfoHandler = async () => jsonResponse({ sub: "42", email: "dan@ludone.cz", name: null }),
    tokenResponse = TOKEN_RESPONSE,
    tokenHandler = async () => jsonResponse(tokenResponse),
  } = options;
  const appData = options.appData ?? await mkdtemp(path.join(tmpdir(), "ludone-auth-identity-"));
  temporaryRoots.add(appData);
  let loopbackServer;
  let revocationCalls = 0;
  const logger = { log: vi.fn(), warn: vi.fn() };
  const fetchImpl = vi.fn(async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return jsonResponse({
        issuer,
        authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
        token_endpoint: `${issuer}/api/mcp/oauth/token`,
        registration_endpoint: `${issuer}/api/mcp/oauth/register`,
        revocation_endpoint: `${issuer}/api/mcp/oauth/revoke`,
        code_challenge_methods_supported: ["S256"],
      });
    }
    if (url.pathname === "/api/mcp/oauth/register") {
      return jsonResponse({ client_id: REGISTERED_CLIENT_ID });
    }
    if (url.pathname === "/api/mcp/oauth/token") {
      return tokenHandler(input, init);
    }
    if (url.pathname === "/api/mcp") {
      return mcpHandler(input, init);
    }
    if (url.pathname === "/api/mcp/oauth/userinfo") {
      return userinfoHandler(input, init);
    }
    if (url.pathname === "/api/mcp/oauth/revoke") {
      revocationCalls += 1;
      return { ok: true, status: 200 };
    }
    throw new Error(`Neočekávaný požadavek ${url.href}`);
  });
  const app = { getPath: vi.fn(() => appData) };
  const safeStorage = {
    decryptString: vi.fn((value) => value.toString("utf8")),
    encryptString: vi.fn((value) => Buffer.from(value, "utf8")),
    isEncryptionAvailable: vi.fn(() => true),
  };
  const shell = { openExternal: vi.fn(async (url = "") => url) };
  const controller = createAuthController({
    app,
    clientId,
    fetchImpl,
    issuer,
    logger,
    loopbackServerFactory(handler) {
      loopbackServer = new CallbackLoopbackServer(handler);
      return loopbackServer;
    },
    identityEndpoint,
    safeStorage,
    scope,
    shell,
  });

  return {
    app,
    controller,
    fetchImpl,
    getLoopbackServer: () => loopbackServer,
    logger,
    revocationCalls: () => revocationCalls,
    safeStorage,
    shell,
  };
}

async function completeLogin(harness) {
  const attempt = await harness.controller.start();
  harness.getLoopbackServer().deliverCode(attempt.authorizationUrl);
  return attempt.result;
}

async function readSession(harness) {
  return JSON.parse(await readFile(tokenSessionFilePath(harness.app), "utf8"));
}

function loggedText(logger) {
  return [...logger.log.mock.calls, ...logger.warn.mock.calls].flat().join("\n");
}

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all([...temporaryRoots].map((root) => rm(root, { force: true, recursive: true })));
  temporaryRoots.clear();
});

describe("znovupoužití uloženého OAuth klienta", () => {
  it("při druhém přihlášení použije uloženého klienta bez nové registrace", async () => {
    const first = await createHarness({ clientId: null });
    await expect(completeLogin(first)).resolves.toMatchObject({ ok: true });
    expect(first.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ))).toHaveLength(1);
    expect((await readSession(first)).clientId).toBe(REGISTERED_CLIENT_ID);

    const second = await createHarness({ clientId: null, appData: first.app.getPath() });
    await expect(completeLogin(second)).resolves.toMatchObject({ ok: true });

    expect(second.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ))).toHaveLength(0);
    expect(new URL(second.shell.openExternal.mock.calls[0][0]).searchParams.get("client_id"))
      .toBe(REGISTERED_CLIENT_ID);
    const tokenCall = second.fetchImpl.mock.calls.find(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/token"
    ));
    expect(new URLSearchParams(tokenCall?.[1]?.body).get("client_id")).toBe(REGISTERED_CLIENT_ID);
  });

  it.each([
    ["issuer", { issuer: "https://labs.ludone.cz", scope: "mcp:read" }],
    ["scope", { issuer: ISSUER, scope: "mcp:read mcp:draft" }],
  ])("při změně %s zaregistruje nového klienta", async (_name, options) => {
    const first = await createHarness();
    await expect(completeLogin(first)).resolves.toMatchObject({ ok: true });
    const second = await createHarness({
      ...options,
      clientId: null,
      appData: first.app.getPath(),
    });

    await expect(completeLogin(second)).resolves.toMatchObject({ ok: true });

    const registrationCalls = second.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ));
    expect(registrationCalls).toHaveLength(1);
    expect(registrationCalls[0][0]).toBe(`${options.issuer}/api/mcp/oauth/register`);
    expect(JSON.parse(registrationCalls[0][1].body).scope).toBe(options.scope);
    expect(new URL(second.shell.openExternal.mock.calls[0][0]).searchParams.get("client_id"))
      .toBe(REGISTERED_CLIENT_ID);
    expect((await readSession(second)).clientId).toBe(REGISTERED_CLIENT_ID);
  });

  it.each([
    ["issuer", "https://labs.ludone.cz"],
    ["resource", `${ISSUER}/api/jiny-resource`],
  ])("samotná neshoda uloženého %s stačí k nové registraci", async (field, value) => {
    const harness = await createHarness({ clientId: null });
    await expect(completeLogin(harness)).resolves.toMatchObject({ ok: true });
    const session = await readSession(harness);
    await writeFile(tokenSessionFilePath(harness.app), JSON.stringify({ ...session, [field]: value }));
    harness.fetchImpl.mockClear();

    await expect(completeLogin(harness)).resolves.toMatchObject({ ok: true });

    expect(harness.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ))).toHaveLength(1);
  });

  it.each([
    ["chybějící", null],
    ["prázdná", ""],
    ["poškozená", "{neplatny-json"],
    ["s neplatným schématem", "[]"],
  ])("session %s nebrání registraci a dokončení přihlášení", async (_name, stored) => {
    const harness = await createHarness({ clientId: null });
    if (stored !== null) {
      const destination = tokenSessionFilePath(harness.app);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, stored);
    }

    await expect(completeLogin(harness)).resolves.toMatchObject({ ok: true });

    expect(harness.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ))).toHaveLength(1);
    expect((await readSession(harness)).clientId).toBe(REGISTERED_CLIENT_ID);
  });

  it("chyba čtení uložené session nebrání registraci a dokončení přihlášení", async () => {
    const harness = await createHarness({ clientId: null });
    await expect(completeLogin(harness)).resolves.toMatchObject({ ok: true });
    harness.fetchImpl.mockClear();
    const read = vi.spyOn(fs, "readFile").mockRejectedValueOnce(
      Object.assign(new Error("Session nelze přečíst"), { code: "EACCES" }),
    );

    const attempt = await harness.controller.start();
    expect(read).toHaveBeenCalledWith(tokenSessionFilePath(harness.app));
    read.mockRestore();
    harness.getLoopbackServer().deliverCode(attempt.authorizationUrl);
    await expect(attempt.result).resolves.toMatchObject({ ok: true });

    expect(harness.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ))).toHaveLength(1);
  });

  it("chyba dešifrování session nebrání registraci a dokončení přihlášení", async () => {
    const harness = await createHarness({ clientId: null });
    await expect(completeLogin(harness)).resolves.toMatchObject({ ok: true });
    harness.fetchImpl.mockClear();
    harness.safeStorage.decryptString.mockImplementation(() => {
      throw new Error("Session nelze dešifrovat");
    });

    await expect(completeLogin(harness)).resolves.toMatchObject({ ok: true });

    expect(harness.safeStorage.decryptString).toHaveBeenCalled();
    expect(harness.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ))).toHaveLength(1);
  });

  it("options.clientId z prostředí přebije uloženého klienta bez registrace", async () => {
    const first = await createHarness({ clientId: null });
    await expect(completeLogin(first)).resolves.toMatchObject({ ok: true });
    const second = await createHarness({ clientId: CLIENT_ID, appData: first.app.getPath() });

    await expect(completeLogin(second)).resolves.toMatchObject({ ok: true });

    expect(second.safeStorage.decryptString).not.toHaveBeenCalled();
    expect(second.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ))).toHaveLength(0);
    expect(new URL(second.shell.openExternal.mock.calls[0][0]).searchParams.get("client_id"))
      .toBe(CLIENT_ID);
    expect((await readSession(second)).clientId).toBe(CLIENT_ID);
  });

  it("invalid_client zahodí jen cache starého klienta a další interaktivní login provede DCR", async () => {
    const first = await createHarness({ clientId: null });
    await expect(completeLogin(first)).resolves.toMatchObject({ ok: true });

    const rejected = await createHarness({
      appData: first.app.getPath(),
      clientId: null,
      tokenHandler: async () => jsonResponse(
        { error: "invalid_client", error_description: "citlivý popis se neukládá" },
        { ok: false, status: 401 },
      ),
    });
    await expect(completeLogin(rejected)).rejects.toThrow(/invalid_client/u);
    await expect(readFile(tokenSessionFilePath(rejected.app))).rejects.toMatchObject({ code: "ENOENT" });
    expect(rejected.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ))).toHaveLength(0);

    const recovered = await createHarness({ appData: first.app.getPath(), clientId: null });
    await expect(completeLogin(recovered)).resolves.toMatchObject({ ok: true });
    expect(recovered.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ))).toHaveLength(1);
  });

  it("invalid_client z autorizace přes loopback zneplatní stejnou cache jako token endpoint", async () => {
    const first = await createHarness({ clientId: null });
    await expect(completeLogin(first)).resolves.toMatchObject({ ok: true });

    const rejected = await createHarness({ appData: first.app.getPath(), clientId: null });
    const attempt = await rejected.controller.start();
    rejected.getLoopbackServer().deliverError(
      attempt.authorizationUrl,
      "invalid_client",
      "SENTINEL_CALLBACK_DESCRIPTION",
    );
    const captured = await attempt.result.catch((error) => error);

    expect(captured).toBeInstanceOf(Error);
    expect(captured.message).toContain("invalid_client");
    expect(captured.message).not.toContain("SENTINEL_CALLBACK_DESCRIPTION");
    await expect(readFile(tokenSessionFilePath(rejected.app))).rejects.toMatchObject({ code: "ENOENT" });

    const recovered = await createHarness({ appData: first.app.getPath(), clientId: null });
    await expect(completeLogin(recovered)).resolves.toMatchObject({ ok: true });
    expect(recovered.fetchImpl.mock.calls.filter(([input]) => (
      new URL(input).pathname === "/api/mcp/oauth/register"
    ))).toHaveLength(1);
  });

  it("neznámý body.error ani error_description nepropustí ze serveru do zprávy", async () => {
    const sentinelError = "SENTINEL_PRIVATE_OAUTH_ERROR";
    const sentinelDescription = "SENTINEL_PRIVATE_OAUTH_DESCRIPTION";
    const harness = await createHarness({
      tokenHandler: async () => jsonResponse({
        error: sentinelError,
        error_description: sentinelDescription,
      }, { ok: false, status: 400 }),
    });

    const captured = await completeLogin(harness).catch((error) => error);
    expect(captured).toBeInstanceOf(Error);
    expect(captured.message).toBe("Výměna autorizačního kódu selhal (HTTP 400)");
    expect(captured.message).not.toContain(sentinelError);
    expect(captured.message).not.toContain(sentinelDescription);
  });
});

describe("best-effort identita po OAuth přihlášení", () => {
  it("legacy větev bez resolveru dál přijme identitu z token response", async () => {
    const harness = await createHarness({
      tokenResponse: { ...TOKEN_RESPONSE, ...TOKEN_IDENTITY_SENTINEL },
      mcpHandler: async () => { throw new Error("MCP se při úplné tokenové identitě nemá volat"); },
    });

    await expect(completeLogin(harness)).resolves.toEqual({
      ok: true,
      user: TOKEN_IDENTITY_SENTINEL,
    });
    expect((await readSession(harness)).identity).toEqual(TOKEN_IDENTITY_SENTINEL);
    expect(harness.fetchImpl.mock.calls.filter(
      ([input]) => new URL(input).pathname === "/api/mcp",
    )).toHaveLength(0);
  });

  it("token bez identity přesto uloží jako úspěšnou session", async () => {
    const harness = await createHarness();

    await expect(completeLogin(harness)).resolves.toEqual({
      ok: true,
      user: { name: null, email: "dan@ludone.cz" },
    });
    const session = await readSession(harness);
    expect(session.identity).toEqual({ name: null, email: "dan@ludone.cz" });
  });

  it("získá e-mail přes přesné JSON-RPC volání ludone_ping a neloguje ani refresh token", async () => {
    const harness = await createHarness();

    await expect(completeLogin(harness)).resolves.toEqual({
      ok: true,
      user: { name: null, email: "dan@ludone.cz" },
    });
    const mcpCall = harness.fetchImpl.mock.calls.find(([input]) => new URL(input).pathname === "/api/mcp");
    expect(mcpCall?.[0]).toBe(`${ISSUER}/api/mcp`);
    expect(mcpCall?.[1]).toMatchObject({
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      redirect: "error",
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(mcpCall?.[1]?.body)).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "ludone_ping", arguments: {} },
    });
    expect(harness.revocationCalls()).toBe(0);
    expect(loggedText(harness.logger)).not.toContain(ACCESS_TOKEN);
    expect(loggedText(harness.logger)).not.toContain(TOKEN_RESPONSE.refresh_token);
    expect(loggedText(harness.logger)).not.toContain(AUTHORIZATION_CODE);
  });

  it("při chybě MCP uloží session s neznámou identitou", async () => {
    const harness = await createHarness({
      mcpHandler: async () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(completeLogin(harness)).resolves.toEqual({
      ok: true,
      user: { name: null, email: null },
    });
    const session = await readSession(harness);
    expect(session).toMatchObject({
      accessToken: ACCESS_TOKEN,
      identity: { name: null, email: null },
      refreshToken: TOKEN_RESPONSE.refresh_token,
    });
    expect(harness.revocationCalls()).toBe(0);
  });

  it("po deadline MCP požadavku přihlášení dokončí a požadavek abortuje", async () => {
    let mcpSignal;
    let announceMcpStarted;
    const mcpStarted = new Promise((resolve) => {
      announceMcpStarted = resolve;
    });
    const harness = await createHarness({
      mcpHandler: async (_input, init) => new Promise(() => {
        mcpSignal = init.signal;
        announceMcpStarted();
      }),
    });
    vi.useFakeTimers();
    expect(IDENTITY_LOOKUP_DEADLINE_MS).toBe(5_000);

    const pending = completeLogin(harness);
    let settled = false;
    pending.then(() => { settled = true; }, () => { settled = true; });
    await mcpStarted;
    await vi.advanceTimersByTimeAsync(IDENTITY_LOOKUP_DEADLINE_MS - 1);
    expect(settled).toBe(false);
    expect(mcpSignal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({
      ok: true,
      user: { name: null, email: null },
    });
    expect(mcpSignal.aborted).toBe(true);
    expect((await readSession(harness)).identity).toEqual({ name: null, email: null });
    expect(harness.revocationCalls()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("při nesmyslné MCP odpovědi zachová prázdné hodnoty jako null", async () => {
    const harness = await createHarness({
      tokenResponse: { ...TOKEN_RESPONSE, name: "", email: "" },
      mcpHandler: async () => jsonResponse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          content: [{ type: "text", text: JSON.stringify({ pong: true, user: 42 }) }],
        },
      }),
    });

    await expect(completeLogin(harness)).resolves.toEqual({
      ok: true,
      user: { name: null, email: null },
    });
    expect((await readSession(harness)).identity).toEqual({ name: null, email: null });
    expect(harness.revocationCalls()).toBe(0);
  });
});

describe("identita z userinfo endpointu (upload scope)", () => {
  const USERINFO = `${ISSUER}/api/mcp/oauth/userinfo`;

  it("vezme e-mail z userinfo a ludone_ping vůbec nezavolá", async () => {
    const harness = await createHarness({
      identityEndpoint: USERINFO,
      scope: UPLOAD_SCOPE,
      tokenResponse: { ...TOKEN_RESPONSE, ...TOKEN_IDENTITY_SENTINEL },
      userinfoHandler: async () => jsonResponse({ sub: "7", email: "upload@makemore.cz", name: "Up Loader" }),
      // Kdyby se přesto sáhlo na MCP, je to poplach: upload-only token tam nemá co dělat.
      mcpHandler: async () => { throw new Error("ludone_ping se u upload identity nesmí volat"); },
    });

    await expect(completeLogin(harness)).resolves.toEqual({
      ok: true,
      user: { name: "Up Loader", email: "upload@makemore.cz" },
    });
    // 🔴 Důkaz, že identita jde z userinfo, ne z MCP: na /api/mcp nepadl ŽÁDNÝ požadavek.
    const mcpCalls = harness.fetchImpl.mock.calls.filter(
      ([input]) => new URL(input).pathname === "/api/mcp",
    );
    expect(mcpCalls).toHaveLength(0);
    const userinfoCall = harness.fetchImpl.mock.calls.find(
      ([input]) => new URL(input).pathname === "/api/mcp/oauth/userinfo",
    );
    expect(userinfoCall?.[0]).toBe(USERINFO);
    expect(userinfoCall?.[1]).toMatchObject({
      headers: { accept: "application/json", authorization: `Bearer ${ACCESS_TOKEN}` },
      redirect: "error",
    });
    // GET = fetch default, tedy žádné method v options (server userinfo je GET).
    expect(userinfoCall?.[1]?.method).toBeUndefined();
    expect((await readSession(harness)).identity).toEqual({
      name: "Up Loader",
      email: "upload@makemore.cz",
    });
  });

  it("když userinfo spadne a token nemá MCP práva, login přežije s prázdnou identitou", async () => {
    const harness = await createHarness({
      identityEndpoint: USERINFO,
      scope: UPLOAD_SCOPE,
      tokenResponse: { ...TOKEN_RESPONSE, ...TOKEN_IDENTITY_SENTINEL },
      userinfoHandler: async () => jsonResponse({ error: "boom" }, { ok: false, status: 503 }),
      // Upload-only token na MCP: 403. Best-effort fallback nesmí shodit login.
      mcpHandler: async () => jsonResponse({ error: "insufficient_scope" }, { ok: false, status: 403 }),
    });

    await expect(completeLogin(harness)).resolves.toEqual({
      ok: true,
      user: { name: null, email: null },
    });
    expect((await readSession(harness)).identity).toEqual({ name: null, email: null });
    expect(harness.revocationCalls()).toBe(0);
    expect(harness.fetchImpl.mock.calls.filter(
      ([input]) => new URL(input).pathname === "/api/mcp",
    )).toHaveLength(0);
  });

  it.each([
    {
      expected: { email: "userinfo@example.invalid", name: null },
      label: "jméno",
      userinfo: { email: "userinfo@example.invalid" },
    },
    {
      expected: { email: null, name: "Userinfo identita" },
      label: "e-mail",
      userinfo: { name: "Userinfo identita" },
    },
  ])("částečný userinfo nedoplní $label z token response", async ({ expected, userinfo }) => {
    const harness = await createHarness({
      identityEndpoint: USERINFO,
      scope: UPLOAD_SCOPE,
      tokenResponse: { ...TOKEN_RESPONSE, ...TOKEN_IDENTITY_SENTINEL },
      userinfoHandler: async () => jsonResponse(userinfo),
    });

    await expect(completeLogin(harness)).resolves.toEqual({ ok: true, user: expected });
    expect((await readSession(harness)).identity).toEqual(expected);
    expect(harness.fetchImpl.mock.calls.filter(
      ([input]) => new URL(input).pathname === "/api/mcp",
    )).toHaveLength(0);
  });

  it("deadline userinfo uloží neznámou identitu, abortuje request a nevolá MCP", async () => {
    let userinfoSignal;
    let announceUserinfoStarted;
    const userinfoStarted = new Promise((resolve) => {
      announceUserinfoStarted = resolve;
    });
    const harness = await createHarness({
      identityEndpoint: USERINFO,
      scope: UPLOAD_SCOPE,
      tokenResponse: { ...TOKEN_RESPONSE, ...TOKEN_IDENTITY_SENTINEL },
      userinfoHandler: async (_input, init) => new Promise(() => {
        userinfoSignal = init.signal;
        announceUserinfoStarted();
      }),
    });
    vi.useFakeTimers();

    const pending = completeLogin(harness);
    await userinfoStarted;
    expect(userinfoSignal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(IDENTITY_LOOKUP_DEADLINE_MS);

    await expect(pending).resolves.toEqual({
      ok: true,
      user: { name: null, email: null },
    });
    expect(userinfoSignal.aborted).toBe(true);
    expect((await readSession(harness)).identity).toEqual({ name: null, email: null });
    expect(harness.fetchImpl.mock.calls.filter(
      ([input]) => new URL(input).pathname === "/api/mcp",
    )).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uloží e-mail z userinfo bytově beze změny (lokální část se nelowercasuje)", async () => {
    const harness = await createHarness({
      identityEndpoint: USERINFO,
      scope: UPLOAD_SCOPE,
      userinfoHandler: async () => jsonResponse({ sub: "9", email: "Dan.Jirotka@makemore.cz", name: null }),
      mcpHandler: async () => { throw new Error("MCP se nemá volat"); },
    });

    await expect(completeLogin(harness)).resolves.toMatchObject({ ok: true });
    // Otisk vlastníka (queue.cjs) lowercasuje jen doménu; kdybychom lokální část zmršili tady,
    // rozešel by se otisk mezi dvěma přihlášeními téhož člověka → falešný queue_owner_mismatch.
    expect((await readSession(harness)).identity.email).toBe("Dan.Jirotka@makemore.cz");
  });

  it("upload scope bez přesného userinfo endpointu odmítne před síťovým voláním", async () => {
    await expect(createHarness({
      identityEndpoint: `${ISSUER}/api/mcp/oauth/jiny-endpoint`,
      scope: UPLOAD_SCOPE,
    })).rejects.toThrow(/userinfo/u);
  });

  it("userinfo endpoint s MCP scope odmítne, aby se identity kontrakty nesmíchaly", async () => {
    await expect(createHarness({
      identityEndpoint: USERINFO,
      scope: "mcp:read",
    })).rejects.toThrow(/výhradně/u);
  });
});
