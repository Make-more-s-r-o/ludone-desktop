import fs from "node:fs";
import { EventEmitter } from "node:events";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  LOGOUT_DISCOVERY_DEADLINE_MS,
  LOGOUT_REVOKE_DEADLINE_MS,
  createAuthController,
  createAuthSessionCoordinator,
  createLogoutController,
  initializeTokenStorage,
  tokenSessionFilePath,
} = require("../electron/auth.cjs");

const EXPECTED_DISCOVERY_DEADLINE_MS = 5_000;
const EXPECTED_REVOKE_DEADLINE_MS = 5_000;
const ISSUER = "https://labs.ludone.cz";
const METADATA = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/api/mcp/oauth/authorize`,
  token_endpoint: `${ISSUER}/api/mcp/oauth/token`,
  registration_endpoint: `${ISSUER}/api/mcp/oauth/register`,
  revocation_endpoint: `${ISSUER}/api/mcp/oauth/revoke`,
  code_challenge_methods_supported: ["S256"],
};
const OLD_SESSION = {
  v: 1,
  issuer: ISSUER,
  clientId: "desktop-client",
  resource: `${ISSUER}/api/mcp`,
  scope: "mcp:read",
  accessToken: "old-access",
  refreshToken: "old-refresh",
  tokenType: "Bearer",
  accessExpiresAt: 1_800_000_000_000,
  identity: { name: "Původní Uživatel", email: "old@example.invalid" },
};
const NEW_TOKEN_RESPONSE = {
  access_token: "fresh-access",
  refresh_token: "fresh-refresh",
  token_type: "Bearer",
  expires_in: 900,
  name: "Nový Uživatel",
  email: "new@example.invalid",
};
const ORPHAN_NAME = ".oauth.enc.00000000-0000-4000-8000-000000000000.tmp";

function fakeSafeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value, "utf8"),
    decryptString: (value) => value.toString("utf8"),
  };
}

function fakeLogger() {
  return { log: vi.fn(), warn: vi.fn() };
}

function jsonResponse(value) {
  return { ok: true, status: 200, json: async () => value };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function inTemporaryAppData(run) {
  const appData = await mkdtemp(path.join(tmpdir(), "ludone-logout-safety-"));
  const app = {
    getPath(name) {
      if (name !== "appData") throw new Error(`Neočekávaná Electron cesta: ${name}`);
      return appData;
    },
  };
  try {
    return await run({ app, appData });
  } finally {
    await rm(appData, { recursive: true, force: true });
  }
}

async function writeSession(app, safeStorage, session = OLD_SESSION) {
  const destination = tokenSessionFilePath(app);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, safeStorage.encryptString(JSON.stringify(session)), { mode: 0o600 });
  return destination;
}

class ControlledLoopbackServer extends EventEmitter {
  constructor(handler) {
    super();
    this.handler = handler;
    this.listening = false;
    this.close = vi.fn(() => {
      this.listening = false;
    });
  }

  address() {
    return { address: "127.0.0.1", family: "IPv4", port: 49721 };
  }

  listen() {
    this.listening = true;
    queueMicrotask(() => this.emit("listening"));
  }

  deliverCode(state) {
    const response = { writeHead: vi.fn(), end: vi.fn() };
    this.handler({
      method: "GET",
      headers: { host: "127.0.0.1:49721" },
      url: `/callback?state=${encodeURIComponent(state)}&code=fresh-code`,
    }, response);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  }
}

function createLoginHarness({ app, coordinator, fetchImpl, safeStorage }) {
  let loopbackServer;
  const controller = createAuthController({
    issuer: ISSUER,
    clientId: OLD_SESSION.clientId,
    app,
    coordinator,
    fetchImpl,
    loopbackServerFactory(handler) {
      loopbackServer = new ControlledLoopbackServer(handler);
      return loopbackServer;
    },
    safeStorage,
    logger: fakeLogger(),
    shell: { openExternal: vi.fn(async () => {}) },
  });

  return {
    async deliverToken() {
      const attempt = await controller.start();
      const state = new URL(attempt.authorizationUrl).searchParams.get("state");
      expect(state).toBeTruthy();
      loopbackServer.deliverCode(state);
      return { result: attempt.result };
    },
  };
}

function neverSettlingOperation(init) {
  return new Promise(() => {
    init?.signal?.addEventListener("abort", () => {}, { once: true });
  });
}

async function settleAtDeadline(pending, timeoutMs, wasAborted) {
  await vi.advanceTimersByTimeAsync(timeoutMs);
  const abortedOnTime = wasAborted();
  const result = await pending;
  return { abortedOnTime, result };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("jeden fail-closed zámek přihlášení a odhlášení", () => {
  it("odhlášení začne první a přihlášení uprostřed získaný token odvolá místo uložení", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const coordinator = createAuthSessionCoordinator();
      const blobPath = await writeSession(app, safeStorage);
      const oldRevokeResponse = deferred();
      const issuedTokens = new Set([OLD_SESSION.refreshToken]);
      const revokedTokens = [];
      let tokenRequests = 0;

      const fetchImpl = vi.fn(async (input, init = {}) => {
        const url = new URL(input);
        if (url.pathname === "/.well-known/oauth-authorization-server") {
          return jsonResponse(METADATA);
        }
        if (url.pathname === "/api/mcp/oauth/token") {
          tokenRequests += 1;
          issuedTokens.add(NEW_TOKEN_RESPONSE.refresh_token);
          return jsonResponse(NEW_TOKEN_RESPONSE);
        }
        if (url.pathname === "/api/mcp/oauth/revoke") {
          const token = new URLSearchParams(String(init.body)).get("token");
          expect(issuedTokens.has(token)).toBe(true);
          revokedTokens.push(token);
          if (token === OLD_SESSION.refreshToken) {
            await oldRevokeResponse.promise;
          }
          issuedTokens.delete(token);
          return { ok: true, status: 200 };
        }
        throw new Error(`Neočekávaný požadavek ${url.href}`);
      });
      const logoutController = createLogoutController({
        app,
        coordinator,
        safeStorage,
        fetchImpl,
        logger: fakeLogger(),
      });
      const login = createLoginHarness({ app, coordinator, fetchImpl, safeStorage });

      const logoutResult = logoutController.logout();
      await vi.waitFor(() => expect(revokedTokens).toEqual([OLD_SESSION.refreshToken]));
      const { result: loginResult } = await login.deliverToken();
      await vi.waitFor(() => expect(tokenRequests).toBe(1));

      expect(fs.existsSync(blobPath)).toBe(true);
      oldRevokeResponse.resolve();

      await expect(logoutResult).resolves.toMatchObject({
        signedOutLocally: true,
        serverRevoked: true,
      });
      await expect(loginResult).rejects.toThrow(/zrušeno.*odhlášením/i);
      expect(revokedTokens).toEqual([OLD_SESSION.refreshToken, NEW_TOKEN_RESPONSE.refresh_token]);
      expect(issuedTokens.size).toBe(0);
      expect(fs.existsSync(blobPath)).toBe(false);
    });
  });

  it("přihlášení začne první a odhlášení uprostřed pozdější token odvolá místo uložení", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const coordinator = createAuthSessionCoordinator();
      const tokenResponse = deferred();
      const issuedTokens = new Set();
      const revokedTokens = [];
      let tokenRequested = false;

      const fetchImpl = vi.fn(async (input, init = {}) => {
        const url = new URL(input);
        if (url.pathname === "/.well-known/oauth-authorization-server") {
          return jsonResponse(METADATA);
        }
        if (url.pathname === "/api/mcp/oauth/token") {
          tokenRequested = true;
          const response = await tokenResponse.promise;
          issuedTokens.add(NEW_TOKEN_RESPONSE.refresh_token);
          return response;
        }
        if (url.pathname === "/api/mcp/oauth/revoke") {
          const token = new URLSearchParams(String(init.body)).get("token");
          expect(issuedTokens.has(token)).toBe(true);
          revokedTokens.push(token);
          issuedTokens.delete(token);
          return { ok: true, status: 200 };
        }
        throw new Error(`Neočekávaný požadavek ${url.href}`);
      });
      const login = createLoginHarness({ app, coordinator, fetchImpl, safeStorage });
      const logoutController = createLogoutController({
        app,
        coordinator,
        safeStorage,
        fetchImpl,
        logger: fakeLogger(),
      });

      const { result: loginResult } = await login.deliverToken();
      await vi.waitFor(() => expect(tokenRequested).toBe(true));
      const logoutResult = logoutController.logout();

      await expect(logoutResult).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "no-token",
      });
      tokenResponse.resolve(jsonResponse(NEW_TOKEN_RESPONSE));

      await expect(loginResult).rejects.toThrow(/zrušeno.*odhlášením/i);
      expect(revokedTokens).toEqual([NEW_TOKEN_RESPONSE.refresh_token]);
      expect(issuedTokens.size).toBe(0);
      expect(fs.existsSync(tokenSessionFilePath(app))).toBe(false);
    });
  });

  it("odhlášení vyvolané během fyzického persistu přebije i výsledek loginu", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const coordinator = createAuthSessionCoordinator();
      const renameStarted = deferred();
      const allowRename = deferred();
      const revokedTokens = [];
      const originalRename = fs.promises.rename.bind(fs.promises);
      const rename = vi.spyOn(fs.promises, "rename").mockImplementation(async (...args) => {
        renameStarted.resolve();
        await allowRename.promise;
        return originalRename(...args);
      });
      try {
        const fetchImpl = vi.fn(async (input, init = {}) => {
          const url = new URL(input);
          if (url.pathname === "/.well-known/oauth-authorization-server") {
            return jsonResponse(METADATA);
          }
          if (url.pathname === "/api/mcp/oauth/token") {
            return jsonResponse(NEW_TOKEN_RESPONSE);
          }
          if (url.pathname === "/api/mcp/oauth/revoke") {
            revokedTokens.push(new URLSearchParams(String(init.body)).get("token"));
            return { ok: true, status: 200 };
          }
          throw new Error(`Neočekávaný požadavek ${url.href}`);
        });
        const login = createLoginHarness({ app, coordinator, fetchImpl, safeStorage });
        const logoutController = createLogoutController({
          app,
          coordinator,
          safeStorage,
          fetchImpl,
          logger: fakeLogger(),
        });

        const { result: loginResult } = await login.deliverToken();
        await renameStarted.promise;
        const logoutResult = logoutController.logout();
        allowRename.resolve();

        const [loginSettlement, logoutSettlement] = await Promise.allSettled([
          loginResult,
          logoutResult,
        ]);
        expect(loginSettlement.status).toBe("rejected");
        if (loginSettlement.status === "rejected") {
          expect(loginSettlement.reason).toEqual(
            expect.objectContaining({ message: expect.stringMatching(/zrušeno.*odhlášením/i) }),
          );
        }
        expect(logoutSettlement).toEqual(expect.objectContaining({
          status: "fulfilled",
          value: expect.objectContaining({ signedOutLocally: true, serverRevoked: true }),
        }));
        expect(revokedTokens).toEqual([NEW_TOKEN_RESPONSE.refresh_token]);
        expect(fs.existsSync(tokenSessionFilePath(app))).toBe(false);
      } finally {
        allowRename.resolve();
        rename.mockRestore();
      }
    });
  });

  it("po chybě persistu během odhlášení odvolá čerstvý token přímo z paměti", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const coordinator = createAuthSessionCoordinator();
      const renameStarted = deferred();
      const failRename = deferred();
      const revokedTokens = [];
      const rename = vi.spyOn(fs.promises, "rename").mockImplementation(async () => {
        renameStarted.resolve();
        await failRename.promise;
        throw Object.assign(new Error("disk write failed"), { code: "EIO" });
      });
      try {
        const fetchImpl = vi.fn(async (input, init = {}) => {
          const url = new URL(input);
          if (url.pathname === "/.well-known/oauth-authorization-server") {
            return jsonResponse(METADATA);
          }
          if (url.pathname === "/api/mcp/oauth/token") {
            return jsonResponse(NEW_TOKEN_RESPONSE);
          }
          if (url.pathname === "/api/mcp/oauth/revoke") {
            revokedTokens.push(new URLSearchParams(String(init.body)).get("token"));
            return { ok: true, status: 200 };
          }
          throw new Error(`Neočekávaný požadavek ${url.href}`);
        });
        const login = createLoginHarness({ app, coordinator, fetchImpl, safeStorage });
        const logoutController = createLogoutController({
          app,
          coordinator,
          safeStorage,
          fetchImpl,
          logger: fakeLogger(),
        });

        const { result: loginResult } = await login.deliverToken();
        await renameStarted.promise;
        const logoutResult = logoutController.logout();
        failRename.resolve();

        await expect(loginResult).rejects.toThrow(/zrušeno.*odhlášením/i);
        await expect(logoutResult).resolves.toEqual({
          signedOutLocally: true,
          serverRevoked: false,
          reason: "no-token",
        });
        expect(revokedTokens).toEqual([NEW_TOKEN_RESPONSE.refresh_token]);
        expect(fs.existsSync(tokenSessionFilePath(app))).toBe(false);
      } finally {
        failRename.resolve();
        rename.mockRestore();
      }
    });
  });

  it("přihlášení zahájené až po dokončeném odhlášení se smí uložit", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const coordinator = createAuthSessionCoordinator();
      const fetchImpl = vi.fn(async (input) => {
        const url = new URL(input);
        if (url.pathname === "/.well-known/oauth-authorization-server") {
          return jsonResponse(METADATA);
        }
        if (url.pathname === "/api/mcp/oauth/token") {
          return jsonResponse(NEW_TOKEN_RESPONSE);
        }
        throw new Error(`Neočekávaný požadavek ${url.href}`);
      });
      const logoutController = createLogoutController({
        app,
        coordinator,
        safeStorage,
        fetchImpl,
        logger: fakeLogger(),
      });

      await expect(logoutController.logout()).resolves.toMatchObject({
        signedOutLocally: true,
        serverRevoked: false,
      });
      const login = createLoginHarness({ app, coordinator, fetchImpl, safeStorage });
      const { result } = await login.deliverToken();

      await expect(result).resolves.toEqual({
        ok: true,
        user: { name: NEW_TOKEN_RESPONSE.name, email: NEW_TOKEN_RESPONSE.email },
      });
      const stored = JSON.parse(safeStorage.decryptString(
        await readFile(tokenSessionFilePath(app)),
      ));
      expect(stored.refreshToken).toBe(NEW_TOKEN_RESPONSE.refresh_token);
    });
  });
});

describe("deadline odhlášení", () => {
  it("zaseknutý discovery fetch po deadline pokračuje lokálním smazáním", async () => {
    vi.useFakeTimers();
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const blobPath = await writeSession(app, safeStorage);
      const requestStarted = deferred();
      let requestSignal;
      const fetchImpl = vi.fn(async (_input, init = {}) => {
        requestSignal = init.signal;
        requestStarted.resolve();
        return neverSettlingOperation(init);
      });
      const pending = createLogoutController({
        app,
        safeStorage,
        fetchImpl,
        logger: fakeLogger(),
      }).logout();

      await requestStarted.promise;
      await vi.advanceTimersByTimeAsync(EXPECTED_DISCOVERY_DEADLINE_MS - 1);
      expect(fs.existsSync(blobPath)).toBe(true);
      const { abortedOnTime, result } = await settleAtDeadline(
        pending,
        1,
        () => requestSignal?.aborted === true,
      );

      expect(LOGOUT_DISCOVERY_DEADLINE_MS).toBe(EXPECTED_DISCOVERY_DEADLINE_MS);
      expect(abortedOnTime).toBe(true);
      expect(requestSignal?.aborted).toBe(true);
      expect(result).toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "timeout",
      });
      expect(fs.existsSync(blobPath)).toBe(false);
      expect(fetchImpl).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("zaseknuté JSON tělo discovery podléhá stejnému deadline", async () => {
    vi.useFakeTimers();
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const blobPath = await writeSession(app, safeStorage);
      const jsonStarted = deferred();
      let requestSignal;
      const fetchImpl = vi.fn(async (_input, init = {}) => {
        requestSignal = init.signal;
        return {
          ok: true,
          status: 200,
          json: () => {
            jsonStarted.resolve();
            return neverSettlingOperation(init);
          },
        };
      });
      const pending = createLogoutController({
        app,
        safeStorage,
        fetchImpl,
        logger: fakeLogger(),
      }).logout();

      await jsonStarted.promise;
      const { abortedOnTime, result } = await settleAtDeadline(
        pending,
        EXPECTED_DISCOVERY_DEADLINE_MS,
        () => requestSignal?.aborted === true,
      );

      expect(abortedOnTime).toBe(true);
      expect(requestSignal?.aborted).toBe(true);
      expect(result).toMatchObject({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "timeout",
      });
      expect(fs.existsSync(blobPath)).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("zaseknutý revoke po deadline nepotvrdí server a pokračuje lokálním smazáním", async () => {
    vi.useFakeTimers();
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const blobPath = await writeSession(app, safeStorage);
      const revokeStarted = deferred();
      let revokeSignal;
      const fetchImpl = vi.fn(async (input, init = {}) => {
        const url = new URL(input);
        if (url.pathname === "/.well-known/oauth-authorization-server") {
          return jsonResponse(METADATA);
        }
        revokeSignal = init.signal;
        revokeStarted.resolve();
        return neverSettlingOperation(init);
      });
      const pending = createLogoutController({
        app,
        safeStorage,
        fetchImpl,
        logger: fakeLogger(),
      }).logout();

      await revokeStarted.promise;
      await vi.advanceTimersByTimeAsync(EXPECTED_REVOKE_DEADLINE_MS - 1);
      expect(fs.existsSync(blobPath)).toBe(true);
      const { abortedOnTime, result } = await settleAtDeadline(
        pending,
        1,
        () => revokeSignal?.aborted === true,
      );

      expect(LOGOUT_REVOKE_DEADLINE_MS).toBe(EXPECTED_REVOKE_DEADLINE_MS);
      expect(abortedOnTime).toBe(true);
      expect(revokeSignal?.aborted).toBe(true);
      expect(result).toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "timeout",
      });
      expect(fs.existsSync(blobPath)).toBe(false);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("úspěšná discovery a revoke zruší oba deadline časovače bez pozdějšího abortu", async () => {
    vi.useFakeTimers();
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      await writeSession(app, safeStorage);
      const signals = [];
      const fetchImpl = vi.fn(async (input, init = {}) => {
        signals.push(init.signal);
        return new URL(input).pathname === "/.well-known/oauth-authorization-server"
          ? jsonResponse(METADATA)
          : { ok: true, status: 200 };
      });

      await expect(createLogoutController({
        app,
        safeStorage,
        fetchImpl,
        logger: fakeLogger(),
      }).logout()).resolves.toMatchObject({
        signedOutLocally: true,
        serverRevoked: true,
      });

      expect(signals).toHaveLength(2);
      expect(signals.every((signal) => signal?.aborted === false)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(
        EXPECTED_DISCOVERY_DEADLINE_MS + EXPECTED_REVOKE_DEADLINE_MS,
      );
      expect(signals.every((signal) => signal?.aborted === false)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});

describe("úklid osiřelých session tempů", () => {
  it("kanárkem smaže jen vlastní UUID temp a skutečný oauth.enc zachová beze změny", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const blobPath = await writeSession(app, safeStorage);
      const directory = path.dirname(blobPath);
      const orphanPath = path.join(directory, ORPHAN_NAME);
      const lookalikes = [
        ".oauth.enc.not-a-uuid.tmp",
        ".oauth.enc.00000000-0000-1000-8000-000000000000.tmp",
        ".oauth.enc.00000000-0000-4000-7000-000000000000.tmp",
        ".OAUTH.ENC.66666666-6666-4666-8666-666666666666.TMP",
        `${ORPHAN_NAME}.bak`,
        "oauth.enc.unrelated.tmp",
      ];
      const matchingDirectory = path.join(
        directory,
        ".oauth.enc.11111111-1111-4111-8111-111111111111.tmp",
      );
      const matchingSymlink = path.join(
        directory,
        ".oauth.enc.22222222-2222-4222-8222-222222222222.tmp",
      );
      await writeFile(orphanPath, Buffer.from("osiřelá-session", "utf8"), { mode: 0o600 });
      for (const name of lookalikes) {
        await writeFile(path.join(directory, name), Buffer.from(name, "utf8"), { mode: 0o600 });
      }
      await mkdir(matchingDirectory);
      await fs.promises.symlink(blobPath, matchingSymlink);
      const sessionBefore = await readFile(blobPath);

      expect(fs.existsSync(orphanPath)).toBe(true);
      expect(await readFile(orphanPath, "utf8")).toBe("osiřelá-session");
      expect(fs.existsSync(blobPath)).toBe(true);

      await initializeTokenStorage(app);

      expect(fs.existsSync(orphanPath)).toBe(false);
      expect(await readFile(blobPath)).toEqual(sessionBefore);
      expect(fs.lstatSync(matchingDirectory).isDirectory()).toBe(true);
      expect(fs.lstatSync(matchingSymlink).isSymbolicLink()).toBe(true);
      for (const name of lookalikes) {
        expect(fs.existsSync(path.join(directory, name))).toBe(true);
      }

      const liveTemp = path.join(
        directory,
        ".oauth.enc.33333333-3333-4333-8333-333333333333.tmp",
      );
      await writeFile(liveTemp, Buffer.from("živý-zápis", "utf8"), { mode: 0o600 });
      await initializeTokenStorage(app);
      expect(fs.existsSync(liveTemp)).toBe(true);
    });
  });

  it("produkční logout bez override uklidí temp při prvním přístupu", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const directory = path.dirname(tokenSessionFilePath(app));
      const orphanPath = path.join(directory, ORPHAN_NAME);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(orphanPath, Buffer.from("kanárek", "utf8"), { mode: 0o600 });
      expect(fs.existsSync(orphanPath)).toBe(true);

      const controller = createLogoutController({
        app,
        safeStorage,
        logger: fakeLogger(),
      });

      await expect(controller.logout()).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "no-token",
      });
      expect(fs.existsSync(orphanPath)).toBe(false);
    });
  });

  it("selhání prvního úklidu nerejectne logout ani nelže o lokálním odhlášení", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const readdirError = Object.assign(new Error("permission denied"), { code: "EACCES" });
      const readdir = vi.spyOn(fs.promises, "readdir").mockRejectedValueOnce(readdirError);
      try {
        const controller = createLogoutController({
          app,
          safeStorage,
          logger: fakeLogger(),
        });

        await expect(controller.logout()).resolves.toEqual({
          signedOutLocally: false,
          serverRevoked: false,
          reason: "local-delete-failed",
        });
      } finally {
        readdir.mockRestore();
      }
    });
  });

  it("částečný úklid pokračuje dalšími soubory a po chybě jej lze zopakovat", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const directory = path.dirname(tokenSessionFilePath(app));
      const failingPath = path.join(
        directory,
        ".oauth.enc.44444444-4444-4444-8444-444444444444.tmp",
      );
      const removablePath = path.join(
        directory,
        ".oauth.enc.55555555-5555-4555-8555-555555555555.tmp",
      );
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(failingPath, Buffer.from("první", "utf8"), { mode: 0o600 });
      await writeFile(removablePath, Buffer.from("druhý", "utf8"), { mode: 0o600 });
      const originalReaddir = fs.promises.readdir.bind(fs.promises);
      const originalUnlink = fs.promises.unlink.bind(fs.promises);
      const readdir = vi.spyOn(fs.promises, "readdir").mockImplementationOnce(
        async (...args) => {
          const entries = await originalReaddir(...args);
          return entries.sort((left, right) => {
            if (left.name === path.basename(failingPath)) return -1;
            if (right.name === path.basename(failingPath)) return 1;
            return 0;
          });
        },
      );
      const unlink = vi.spyOn(fs.promises, "unlink").mockImplementation(async (candidate) => {
        if (candidate === failingPath) {
          throw Object.assign(new Error("permission denied"), { code: "EACCES" });
        }
        return originalUnlink(candidate);
      });
      try {
        await expect(initializeTokenStorage(app)).rejects.toMatchObject({ code: "EACCES" });
        expect(unlink.mock.calls[0]?.[0]).toBe(failingPath);
        expect(fs.existsSync(failingPath)).toBe(true);
        expect(fs.existsSync(removablePath)).toBe(false);
      } finally {
        readdir.mockRestore();
        unlink.mockRestore();
      }

      await expect(initializeTokenStorage(app)).resolves.toBeUndefined();
      expect(fs.existsSync(failingPath)).toBe(false);
    });
  });
});
