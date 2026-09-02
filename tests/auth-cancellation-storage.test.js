import { EventEmitter } from "node:events";
import {
  access,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createAuthController } = require("../electron/auth.cjs");

const ISSUER = "https://app.ludone.cz";
const CLIENT_ID = "desktop-security-test";
const REVOCATION_ENDPOINT = `${ISSUER}/oauth/revoke-for-security-test`;
const temporaryRoots = new Set();

function jsonResult(value) {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => value),
  };
}

async function temporaryRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-auth-security-"));
  temporaryRoots.add(root);
  return root;
}

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

class CallbackLoopbackServer extends EventEmitter {
  constructor(requestHandler) {
    super();
    this.requestHandler = requestHandler;
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

  deliverCode(authorizationUrl, code = "authorization-code") {
    const state = new URL(authorizationUrl).searchParams.get("state");
    const response = {
      end: vi.fn(),
      writeHead: vi.fn(),
    };
    this.requestHandler({
      headers: { host: "127.0.0.1:49721" },
      method: "GET",
      url: `/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    }, response);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  }
}

/**
 * @param {{
 *   appData?: string,
 *   encryptString?: (value: string) => Buffer,
 *   revokeGate?: Promise<void>,
 *   revokeNeverSettles?: boolean,
 *   revocationEndpoint?: string | null,
 *   revokeStatus?: number,
 *   tokenLabel?: string,
 * }} [options]
 */
async function successfulHarness(options = {}) {
  const {
    appData: suppliedAppData,
    encryptString,
    revokeGate,
    revokeNeverSettles = false,
    revocationEndpoint = REVOCATION_ENDPOINT,
    revokeStatus = 200,
    tokenLabel = "default",
  } = options;
  const appData = suppliedAppData ?? await temporaryRoot();
  let loopbackServer;
  let blobExistedWhenRevoked = false;
  const requestedPaths = [];
  const fetchImpl = vi.fn(async (input, options) => {
    void options;
    const url = new URL(input);
    requestedPaths.push(url.pathname);
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      const metadata = {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/api/mcp/oauth/authorize`,
        token_endpoint: `${ISSUER}/api/mcp/oauth/token`,
        registration_endpoint: `${ISSUER}/api/mcp/oauth/register`,
        code_challenge_methods_supported: ["S256"],
      };
      if (revocationEndpoint !== null) metadata.revocation_endpoint = revocationEndpoint;
      return jsonResult(metadata);
    }
    if (url.pathname === "/api/mcp/oauth/token") {
      return jsonResult({
        access_token: `live-access-token-${tokenLabel}`,
        expires_in: 900,
        refresh_token: `live-refresh-token-${tokenLabel}`,
        token_type: "Bearer",
        user: { name: "Bezpečnostní Test", email: "security@ludone.cz" },
      });
    }
    if (url.href === revocationEndpoint) {
      if (revokeNeverSettles) return new Promise(() => {});
      await revokeGate;
      try {
        await access(path.join(appData, "cz.ludone.desktop", "auth", "oauth.enc"));
        blobExistedWhenRevoked = true;
      } catch {
        blobExistedWhenRevoked = false;
      }
      return { ok: revokeStatus >= 200 && revokeStatus < 300, status: revokeStatus };
    }
    throw new Error(`Neočekávaný požadavek ${url.href}`);
  });
  const safeStorage = {
    encryptString: vi.fn(encryptString ?? ((value) => Buffer.from(value, "utf8"))),
    isEncryptionAvailable: vi.fn(() => true),
  };
  const shell = { openExternal: vi.fn(async () => {}) };
  const controller = createAuthController({
    app: { getPath: vi.fn(() => appData) },
    clientId: CLIENT_ID,
    fetchImpl,
    issuer: ISSUER,
    loopbackServerFactory: (handler) => {
      loopbackServer = new CallbackLoopbackServer(handler);
      return loopbackServer;
    },
    safeStorage,
    shell,
  });

  return {
    appData,
    blobExistedWhenRevoked: () => blobExistedWhenRevoked,
    controller,
    fetchImpl,
    getLoopbackServer: () => loopbackServer,
    requestedPaths,
    safeStorage,
    shell,
  };
}

describe("zrušení skutečného OAuth controlleru", () => {
  it("po doručení kódu zruší pokus ještě před výměnou kódu za token", async () => {
    const harness = await successfulHarness();
    const attempt = await harness.controller.start();

    harness.getLoopbackServer().deliverCode(attempt.authorizationUrl);
    attempt.cancel();

    await expect(attempt.result).rejects.toThrow(/zrušeno/);
    expect(harness.requestedPaths).toEqual(["/.well-known/oauth-authorization-server"]);
    expect(harness.safeStorage.encryptString).not.toHaveBeenCalled();
    await expect(access(path.join(
      harness.appData,
      "cz.ludone.desktop",
      "auth",
      "oauth.enc",
    ))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("po zápisu session odvolá vydané tokeny, smaže soubor a neoznámí úspěch", async () => {
    let attempt;
    const harness = await successfulHarness({
      encryptString(value) {
        attempt.cancel();
        return Buffer.from(value, "utf8");
      },
    });
    attempt = await harness.controller.start();

    harness.getLoopbackServer().deliverCode(attempt.authorizationUrl);

    await expect(attempt.result).rejects.toThrow(/zrušeno/);
    expect(harness.requestedPaths).toEqual([
      "/.well-known/oauth-authorization-server",
      "/api/mcp/oauth/token",
      "/oauth/revoke-for-security-test",
    ]);
    const revokeCall = harness.fetchImpl.mock.calls.find(([input]) => (
      new URL(input).href === REVOCATION_ENDPOINT
    ));
    expect(revokeCall).toBeDefined();
    expect(harness.blobExistedWhenRevoked()).toBe(true);
    const revokeBody = new URLSearchParams(revokeCall?.[1]?.body);
    expect(revokeCall?.[1]).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      redirect: "error",
    });
    expect(revokeBody.get("client_id")).toBe(CLIENT_ID);
    expect(revokeBody.get("token")).toBe("live-refresh-token-default");
    expect(revokeBody.get("token_type_hint")).toBe("refresh_token");
    await expect(access(path.join(
      harness.appData,
      "cz.ludone.desktop",
      "auth",
      "oauth.enc",
    ))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("při zrušení nového pokusu obnoví předchozí zašifrovanou session", async () => {
    let attempt;
    const harness = await successfulHarness({
      encryptString(value) {
        attempt.cancel();
        return Buffer.from(value, "utf8");
      },
    });
    attempt = await harness.controller.start();
    const sessionPath = path.join(
      harness.appData,
      "cz.ludone.desktop",
      "auth",
      "oauth.enc",
    );
    const previousSession = Buffer.from("predchozi-zasifrovana-session", "utf8");
    await writeFile(sessionPath, previousSession);

    harness.getLoopbackServer().deliverCode(attempt.authorizationUrl);

    await expect(attempt.result).rejects.toThrow(/zrušeno/);
    await expect(readFile(sessionPath)).resolves.toEqual(previousSession);
  });

  it("po chybě persistence odvolá už vydané tokeny a nevytvoří session", async () => {
    const harness = await successfulHarness({
      encryptString() {
        throw new Error("šifrování po vydání tokenu selhalo");
      },
    });
    const attempt = await harness.controller.start();

    harness.getLoopbackServer().deliverCode(attempt.authorizationUrl);

    await expect(attempt.result).rejects.toThrow(/šifrování po vydání tokenu selhalo/);
    expect(harness.requestedPaths).toEqual([
      "/.well-known/oauth-authorization-server",
      "/api/mcp/oauth/token",
      "/oauth/revoke-for-security-test",
    ]);
    await expect(access(path.join(
      harness.appData,
      "cz.ludone.desktop",
      "auth",
      "oauth.enc",
    ))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("i při selhání revokace smaže novou session a nikdy neoznámí úspěch", async () => {
    let attempt;
    const harness = await successfulHarness({
      encryptString(value) {
        attempt.cancel();
        return Buffer.from(value, "utf8");
      },
      revokeStatus: 503,
    });
    attempt = await harness.controller.start();

    harness.getLoopbackServer().deliverCode(attempt.authorizationUrl);

    await expect(attempt.result).rejects.toThrow(/zrušeno.*nepodařilo bezpečně uklidit/);
    expect(harness.requestedPaths).toContain("/oauth/revoke-for-security-test");
    await expect(access(path.join(
      harness.appData,
      "cz.ludone.desktop",
      "auth",
      "oauth.enc",
    ))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("souběžný zrušený pokus nesmaže session úspěšného pokusu", async () => {
    const sharedAppData = await temporaryRoot();
    let releaseRevoke;
    const revokeGate = new Promise((resolve) => {
      releaseRevoke = resolve;
    });
    let cancelledAttempt;
    const cancelledHarness = await successfulHarness({
      appData: sharedAppData,
      encryptString(value) {
        cancelledAttempt.cancel();
        return Buffer.from(value, "utf8");
      },
      revokeGate,
      tokenLabel: "cancelled",
    });
    cancelledAttempt = await cancelledHarness.controller.start();
    cancelledHarness.getLoopbackServer().deliverCode(cancelledAttempt.authorizationUrl);
    let successfulAttempt;
    try {
      await vi.waitFor(() => {
        expect(cancelledHarness.requestedPaths).toContain("/oauth/revoke-for-security-test");
      });

      const successful = await successfulHarness({
        appData: sharedAppData,
        tokenLabel: "successful",
      });
      successfulAttempt = await successful.controller.start();
      successful.getLoopbackServer().deliverCode(successfulAttempt.authorizationUrl);
      await vi.waitFor(() => {
        expect(successful.requestedPaths).toContain("/api/mcp/oauth/token");
      });
    } finally {
      releaseRevoke();
    }
    await expect(cancelledAttempt.result).rejects.toThrow(/zrušeno/);
    await expect(successfulAttempt.result).resolves.toMatchObject({ ok: true });
    const stored = await readFile(path.join(
      sharedAppData,
      "cz.ludone.desktop",
      "auth",
      "oauth.enc",
    ), "utf8");
    expect(stored).toContain("live-access-token-successful");
    expect(stored).not.toContain("live-access-token-cancelled");
  });

  it("po deadline revokace smaže novou session a zrušení dokončí chybou", async () => {
    vi.useFakeTimers();
    let attempt;
    const harness = await successfulHarness({
      encryptString(value) {
        attempt.cancel();
        return Buffer.from(value, "utf8");
      },
      revokeNeverSettles: true,
    });
    attempt = await harness.controller.start();
    harness.getLoopbackServer().deliverCode(attempt.authorizationUrl);
    await vi.waitFor(() => {
      expect(harness.requestedPaths).toContain("/oauth/revoke-for-security-test");
    });

    const result = expect(attempt.result).rejects.toThrow(/zrušeno/);
    await vi.advanceTimersByTimeAsync(5_000);
    await result;
    await expect(access(path.join(
      harness.appData,
      "cz.ludone.desktop",
      "auth",
      "oauth.enc",
    ))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("preflight bezpečného úložiště", () => {
  it.each([
    ["chybějící", null],
    ["cizí", "https://jiny.example/oauth/revoke"],
  ])("odmítne %s revokační endpoint před otevřením prohlížeče", async (_label, endpoint) => {
    const harness = await successfulHarness({ revocationEndpoint: endpoint });

    await expect(harness.controller.start()).rejects.toThrow(/revocation_endpoint|endpoint pro bezpečné zrušení/);
    expect(harness.requestedPaths).toEqual(["/.well-known/oauth-authorization-server"]);
    expect(harness.shell.openExternal).not.toHaveBeenCalled();
  });

  it("odmítne nedostupné šifrování před sítí a před otevřením prohlížeče", async () => {
    const appData = await temporaryRoot();
    const fetchImpl = vi.fn();
    const shell = { openExternal: vi.fn() };
    const controller = createAuthController({
      app: { getPath: vi.fn(() => appData) },
      clientId: CLIENT_ID,
      fetchImpl,
      issuer: ISSUER,
      safeStorage: { isEncryptionAvailable: vi.fn(() => false) },
      shell,
    });

    let startError;
    let attempt;
    try {
      attempt = await controller.start();
    } catch (error) {
      startError = error;
    }
    attempt?.cancel();
    await attempt?.result.catch(() => {});

    expect(startError).toMatchObject({ message: expect.stringMatching(/Bezpečné úložiště/) });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it("odmítne nedostupný adresář tokenů před sítí a před otevřením prohlížeče", async () => {
    const root = await temporaryRoot();
    const appData = path.join(root, "app-data-je-soubor");
    await writeFile(appData, "nejde použít jako adresář", "utf8");
    const fetchImpl = vi.fn();
    const shell = { openExternal: vi.fn() };
    const controller = createAuthController({
      app: { getPath: vi.fn(() => appData) },
      clientId: CLIENT_ID,
      fetchImpl,
      issuer: ISSUER,
      safeStorage: { isEncryptionAvailable: vi.fn(() => true) },
      shell,
    });

    let startError;
    let attempt;
    try {
      attempt = await controller.start();
    } catch (error) {
      startError = error;
    }
    attempt?.cancel();
    await attempt?.result.catch(() => {});

    expect(startError).toMatchObject({
      message: expect.stringMatching(/Bezpečné úložiště.*adresář/),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(shell.openExternal).not.toHaveBeenCalled();
  });
});
