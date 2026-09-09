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
}

/**
 * @param {{
 *   appData?: string,
 *   clientId?: string | null,
 *   issuer?: string,
 *   scope?: string,
 *   mcpHandler?: (input: string | URL, init: RequestInit) => Promise<{
 *     ok: boolean,
 *     status: number,
 *     json?: () => Promise<unknown>,
 *   }>,
 *   tokenResponse?: Record<string, unknown>,
 * }} [options]
 */
async function createHarness(options = {}) {
  const {
    clientId = CLIENT_ID,
    issuer = ISSUER,
    scope,
    mcpHandler = async () => jsonResponse(MCP_RESPONSE),
    tokenResponse = TOKEN_RESPONSE,
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
      return jsonResponse(tokenResponse);
    }
    if (url.pathname === "/api/mcp") {
      return mcpHandler(input, init);
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
});

describe("best-effort identita po OAuth přihlášení", () => {
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
