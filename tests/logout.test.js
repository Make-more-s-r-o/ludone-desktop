import fs, { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  createAuthController,
  createLogoutController,
  discoverEndpoints,
  tokenSessionFilePath,
} = require("../electron/auth.cjs");
const { saveQueueAtomically } = require("../electron/queue.cjs");

const ISSUER = "https://labs.ludone.cz";
const METADATA = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/api/mcp/oauth/authorize`,
  token_endpoint: `${ISSUER}/api/mcp/oauth/token`,
  registration_endpoint: `${ISSUER}/api/mcp/oauth/register`,
  revocation_endpoint: `${ISSUER}/api/mcp/oauth/revoke`,
  code_challenge_methods_supported: ["S256"],
};
const SESSION = {
  v: 1,
  issuer: ISSUER,
  clientId: "desktop-client",
  resource: `${ISSUER}/api/mcp`,
  scope: "mcp:read",
  accessToken: "fake-access",
  refreshToken: "fake-refresh",
  tokenType: "Bearer",
  accessExpiresAt: 1_800_000_000_000,
  identity: { name: "Testovací Uživatel", email: "test@example.invalid" },
};

const authSource = readFileSync(new URL("../electron/auth.cjs", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");

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

function discoveryResponse(metadata = METADATA) {
  return { ok: true, status: 200, json: async () => metadata };
}

function metadataWithoutRevocation() {
  const metadata = { ...METADATA };
  Reflect.deleteProperty(metadata, "revocation_endpoint");
  return metadata;
}

function createController(app, safeStorage, fetchImpl, logger = fakeLogger()) {
  return createLogoutController({
    app,
    safeStorage,
    fetchImpl,
    logger,
  });
}

async function inTemporaryAppData(run) {
  const appData = await mkdtemp(path.join(tmpdir(), "ludone-logout-"));
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

async function writeSession(app, safeStorage, overrides = {}) {
  const blobPath = tokenSessionFilePath(app);
  const session = { ...SESSION, ...overrides };
  await mkdir(path.dirname(blobPath), { recursive: true, mode: 0o700 });
  await writeFile(blobPath, safeStorage.encryptString(JSON.stringify(session)), { mode: 0o600 });
  return { blobPath, session };
}

async function fileSnapshot(root) {
  const snapshot = new Map();

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        snapshot.set(path.relative(root, absolute), await readFile(absolute));
      }
    }
  }

  await visit(root);
  return snapshot;
}

function successfulFetch(steps = []) {
  return vi.fn(async (url, init = {}) => {
    steps.push({ url: String(url), init });
    if (String(url).includes("/.well-known/")) return discoveryResponse();
    return { ok: true, status: 200 };
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OAuth discovery pro odhlášení", () => {
  it("vrátí revocation_endpoint ověřený proti originu issueru", async () => {
    const endpoints = await discoverEndpoints(async () => discoveryResponse(), ISSUER);

    expect(endpoints.revocationEndpoint).toBe(METADATA.revocation_endpoint);
  });

  it("nevyžaduje revocation_endpoint po serveru, který ho nenabízí", async () => {
    const endpoints = await discoverEndpoints(
      async () => discoveryResponse(metadataWithoutRevocation()),
      ISSUER,
    );

    expect(endpoints.revocationEndpoint).toBeUndefined();
    expect(endpoints.authorizationEndpoint).toBe(METADATA.authorization_endpoint);
  });

  it("odmítne revocation_endpoint na cizím originu", async () => {
    await expect(discoverEndpoints(
      async () => discoveryResponse({
        ...METADATA,
        revocation_endpoint: "https://example.invalid/oauth/revoke",
      }),
      ISSUER,
    )).rejects.toThrow(/originu issueru/);
  });
});

describe("odhlášení", () => {
  it("kanárkem doloží token lokálně i na fake serveru a odvolá ho před smazáním", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const logger = fakeLogger();
      const { blobPath } = await writeSession(app, safeStorage);
      const validServerTokens = new Set([SESSION.refreshToken, SESSION.accessToken]);
      const steps = [];

      expect(fs.existsSync(blobPath)).toBe(true);
      const storedBeforeLogout = JSON.parse(safeStorage.decryptString(await readFile(blobPath)));
      expect(storedBeforeLogout.refreshToken).toBe("fake-refresh");
      expect(validServerTokens.has("fake-refresh")).toBe(true);
      expect(validServerTokens.has("fake-access")).toBe(true);

      const fetchImpl = vi.fn(async (url, init = {}) => {
        steps.push({
          url: String(url),
          init,
          blobExists: fs.existsSync(blobPath),
        });
        if (String(url).includes("/.well-known/")) return discoveryResponse();

        const body = new URLSearchParams(String(init.body));
        const presentedToken = body.get("token");
        expect(validServerTokens.has(presentedToken)).toBe(true);
        validServerTokens.clear();
        return { ok: true, status: 200 };
      });
      const controller = createController(app, safeStorage, fetchImpl, logger);

      const result = await controller.logout();

      expect(steps).toHaveLength(2);
      expect(steps[0].url).toBe(`${ISSUER}/.well-known/oauth-authorization-server`);
      expect(steps[1].url).toBe(METADATA.revocation_endpoint);
      expect(steps.map(({ blobExists }) => blobExists)).toEqual([true, true]);
      expect(steps[1].init).toMatchObject({
        method: "POST",
        redirect: "error",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const body = new URLSearchParams(String(steps[1].init.body));
      expect(Object.fromEntries(body)).toEqual({
        client_id: SESSION.clientId,
        token: SESSION.refreshToken,
        token_type_hint: "refresh_token",
      });
      expect(result).toEqual({
        signedOutLocally: true,
        serverRevoked: true,
        reason: null,
      });
      expect(Object.keys(result).sort()).toEqual([
        "reason",
        "serverRevoked",
        "signedOutLocally",
      ]);
      expect(fs.existsSync(blobPath)).toBe(false);
      expect(validServerTokens.has("fake-refresh")).toBe(false);
      expect(validServerTokens.has("fake-access")).toBe(false);
      expect(JSON.stringify({ result, logs: logger.log.mock.calls })).not.toMatch(
        /fake-refresh|fake-access|desktop-client|test@example\.invalid/,
      );
    });
  });

  it("bez refresh tokenu odvolá access token se správným hintem", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const { blobPath } = await writeSession(app, safeStorage, { refreshToken: null });
      const steps = [];
      const controller = createController(app, safeStorage, successfulFetch(steps));

      const result = await controller.logout();

      const body = new URLSearchParams(String(steps[1].init.body));
      expect(body.get("token")).toBe("fake-access");
      expect(body.get("token_type_hint")).toBe("access_token");
      expect(result.serverRevoked).toBe(true);
      expect(fs.existsSync(blobPath)).toBe(false);
    });
  });

  it("bez sítě při discovery nerejectne, nelže o revokaci a lokálně smaže", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const { blobPath } = await writeSession(app, safeStorage);
      const fetchImpl = vi.fn(async () => {
        throw new Error("fetch failed");
      });
      const logger = fakeLogger();
      const controller = createController(app, safeStorage, fetchImpl, logger);

      await expect(controller.logout()).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "offline",
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fs.existsSync(blobPath)).toBe(false);
      expect(logger.warn).toHaveBeenCalledOnce();
      expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(
        /fake-refresh|fake-access|desktop-client|test@example\.invalid/,
      );
    });
  });

  it("bez sítě při revoke nerejectne a blob smaže až po pokusu", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const { blobPath } = await writeSession(app, safeStorage);
      const fetchImpl = vi.fn(async (url) => {
        if (String(url).includes("/.well-known/")) return discoveryResponse();
        expect(fs.existsSync(blobPath)).toBe(true);
        throw new Error("fetch failed");
      });
      const controller = createController(app, safeStorage, fetchImpl);

      await expect(controller.logout()).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "offline",
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(fs.existsSync(blobPath)).toBe(false);
    });
  });

  it("HTTP chybu popíše jako hodnotu a přesto lokálně smaže", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const { blobPath } = await writeSession(app, safeStorage);
      const fetchImpl = vi.fn(async (url) => (
        String(url).includes("/.well-known/")
          ? discoveryResponse()
          : { ok: false, status: 403 }
      ));
      const controller = createController(app, safeStorage, fetchImpl);

      await expect(controller.logout()).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "http-403",
      });
      expect(fs.existsSync(blobPath)).toBe(false);
    });
  });

  it("chybějící revocation endpoint nefabrikuje a lokálně smaže", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const { blobPath } = await writeSession(app, safeStorage);
      const fetchImpl = vi.fn(async () => discoveryResponse(metadataWithoutRevocation()));
      const controller = createController(app, safeStorage, fetchImpl);

      await expect(controller.logout()).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "no-revocation-endpoint",
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fs.existsSync(blobPath)).toBe(false);
    });
  });

  it("druhé odhlášení už token znovu neposílá", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      await writeSession(app, safeStorage);
      const fetchImpl = successfulFetch();
      const controller = createController(app, safeStorage, fetchImpl);

      expect((await controller.logout()).serverRevoked).toBe(true);
      await expect(controller.logout()).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "no-token",
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
  });

  it("nedostupné safeStorage označí pravdivě a nečitelný blob odstraní", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const writer = fakeSafeStorage();
      const { blobPath } = await writeSession(app, writer);
      const unavailableSafeStorage = {
        isEncryptionAvailable: () => false,
        decryptString: vi.fn(),
      };
      const fetchImpl = vi.fn();
      const controller = createController(app, unavailableSafeStorage, fetchImpl);

      await expect(controller.logout()).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "unreadable-session",
      });
      expect(unavailableSafeStorage.decryptString).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(fs.existsSync(blobPath)).toBe(false);
    });
  });

  it("vadný šifrovaný obsah nerejectne a lokálně ho odstraní", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const blobPath = tokenSessionFilePath(app);
      await mkdir(path.dirname(blobPath), { recursive: true });
      await writeFile(blobPath, Buffer.from("not-json", "utf8"));
      const fetchImpl = vi.fn();
      const controller = createController(app, safeStorage, fetchImpl);

      await expect(controller.logout()).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "unreadable-session",
      });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(fs.existsSync(blobPath)).toBe(false);
    });
  });

  it("neúspěšné smazání nikdy nevydává za lokální odhlášení", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const { blobPath } = await writeSession(app, safeStorage);
      const unlinkError = Object.assign(new Error("permission denied"), { code: "EACCES" });
      const unlink = vi.spyOn(fs.promises, "unlink").mockRejectedValueOnce(unlinkError);
      const controller = createController(app, safeStorage, successfulFetch());
      try {
        await expect(controller.logout()).resolves.toEqual({
          signedOutLocally: false,
          serverRevoked: true,
          reason: "local-delete-failed",
        });
        expect(fs.existsSync(blobPath)).toBe(true);
      } finally {
        unlink.mockRestore();
      }
    });
  });

  it("oba produkční controllery bez fetch override session bez tokenů neposílají", async () => {
    await inTemporaryAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const { blobPath } = await writeSession(app, safeStorage, {
        accessToken: null,
        refreshToken: null,
      });

      const logoutController = createLogoutController({
        app,
        safeStorage,
        logger: fakeLogger(),
      });
      await expect(logoutController.logout()).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "no-token",
      });
      expect(fs.existsSync(blobPath)).toBe(false);

      await writeSession(app, safeStorage, { accessToken: null, refreshToken: null });
      const authController = createAuthController({
        issuer: ISSUER,
        app,
        safeStorage,
        shell: { openExternal: async () => {} },
        logger: fakeLogger(),
      });

      await expect(authController.logout()).resolves.toEqual({
        signedOutLocally: true,
        serverRevoked: false,
        reason: "no-token",
      });
      expect(fs.existsSync(blobPath)).toBe(false);
    });
  });

  it("nesmaže nic jiného v jmenném prostoru aplikace", async () => {
    await inTemporaryAppData(async ({ app, appData }) => {
      const safeStorage = fakeSafeStorage();
      const { blobPath } = await writeSession(app, safeStorage);
      const namespace = path.join(appData, "cz.ludone.desktop");
      const queuePath = path.join(namespace, "queue", "outgoing.json");
      const recordingPath = path.join(namespace, "nahravky", "x.bin");
      await saveQueueAtomically(queuePath, { schemaVersion: 1, items: [] });
      await mkdir(path.dirname(recordingPath), { recursive: true });
      await writeFile(recordingPath, Buffer.from("firemní-data", "utf8"));
      const before = await fileSnapshot(namespace);

      expect(before.has("auth/oauth.enc")).toBe(true);
      await createController(app, safeStorage, successfulFetch()).logout();
      const after = await fileSnapshot(namespace);

      const removed = [...before.keys()].filter((file) => !after.has(file));
      expect(removed).toEqual(["auth/oauth.enc"]);
      for (const [file, contents] of after) {
        expect(contents).toEqual(before.get(file));
      }
      expect(fs.existsSync(blobPath)).toBe(false);
    });
  });

  it("auth modul o frontě neví", () => {
    expect(authSource).not.toMatch(/queue|fronta|outgoing/i);
  });

  it("IPC vrací výsledek beze změny a preload nevynáší token", async () => {
    const start = mainSource.indexOf(
      'const { createLogoutController } = require("./auth.cjs");',
    );
    const end = mainSource.indexOf("const requestPermission", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const registration = mainSource.slice(start, end);

    expect(registration).toContain(
      'const { createLogoutController } = require("./auth.cjs");',
    );
    expect(registration).toContain('handleValidated("auth:logout", ["panel"]');
    expect(registration).toContain("logoutAuthController.logout()");
    expect(registration).toContain("return result");
    expect(registration).not.toMatch(/\b(?:accessToken|refreshToken|clientId|identity|token)\b|\.{3}/);
    expect(preloadSource).toContain('logout: () => ipcRenderer.invoke("auth:logout")');

    /** @type {Readonly<{
     * signedOutLocally: boolean,
     * serverRevoked: boolean,
     * reason: string | null,
     * }>} */
    const sentinel = Object.freeze({
      signedOutLocally: true,
      serverRevoked: false,
      reason: "offline",
    });
    const logout = vi.fn(async () => sentinel);
    const updateTray = vi.fn();
    const app = {};
    const safeStorage = {};
    const logger = { error: vi.fn() };
    const createLogoutController = vi.fn(() => ({ logout }));
    const requireModule = vi.fn(() => ({ createLogoutController }));
    const captured = {};
    const handleValidated = (channel, allowedKinds, handler) => {
      Object.assign(captured, { channel, allowedKinds, handler });
    };
    Function(
      "require",
      "app",
      "safeStorage",
      "handleValidated",
      "updateTray",
      "console",
      `"use strict"; ${registration}`,
    )(
      requireModule,
      app,
      safeStorage,
      handleValidated,
      updateTray,
      logger,
    );

    expect(requireModule).toHaveBeenCalledWith("./auth.cjs");
    expect(createLogoutController).toHaveBeenCalledWith({ app, safeStorage, logger });
    expect(captured).toMatchObject({ channel: "auth:logout", allowedKinds: ["panel"] });
    const returned = await captured.handler();
    expect(returned).toBe(sentinel);
    expect(logout).toHaveBeenCalledOnce();
    expect(updateTray).toHaveBeenCalledWith("signed-out");

    const localFailure = Object.freeze({
      signedOutLocally: false,
      serverRevoked: true,
      reason: "local-delete-failed",
    });
    logout.mockResolvedValueOnce(localFailure);
    expect(await captured.handler()).toBe(localFailure);
    expect(updateTray).toHaveBeenCalledOnce();
  });
});
