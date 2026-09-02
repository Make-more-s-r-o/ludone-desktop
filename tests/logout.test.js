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
  // 🔴 Produkce má DVA různé stromy a tenhle harness dřív znal jen jeden.
  // `app.setName("LuDone Desktop")` (main.cjs:210) posouvá `userData` na
  // `<appData>/LuDone Desktop`, kam B5/B7 ukládají časovač, frontu a nahrávky —
  // zatímco token leží v `<appData>/cz.ludone.desktop/auth`. Sourozenci, ne potomci.
  // Dokud harness na `userData` házel výjimku, nešlo změřit, jestli úklid při odhlášení
  // nesahá na data druhé linie.
  const userData = path.join(appData, "LuDone Desktop");
  const app = {
    getPath(name) {
      if (name === "appData") return appData;
      if (name === "userData") return userData;
      throw new Error(`Neočekávaná Electron cesta: ${name}`);
    },
  };
  try {
    return await run({ app, appData, userData });
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
    await inTemporaryAppData(async ({ app, appData, userData }) => {
      const safeStorage = fakeSafeStorage();
      const { blobPath } = await writeSession(app, safeStorage);
      // 🔴 Atrapy patří tam, kde produkce data OPRAVDU má. Dřív ležely pod
      // `cz.ludone.desktop/{queue,nahravky}`, což je cesta, kterou nikdo nepoužívá —
      // brána tak hlídala prázdný adresář a úklid skutečné fronty, časovače i nahrávek
      // by prošel zeleně. Cesty jsou opsané z main.cjs:584, :827 a :882.
      const queuePath = path.join(userData, "queue", "outgoing.json");
      const casovacPath = path.join(userData, "cas", "casovac.json");
      const recordingPath = path.join(userData, "nahravky", "x.webm");
      await saveQueueAtomically(queuePath, { schemaVersion: 1, items: [] });
      await mkdir(path.dirname(casovacPath), { recursive: true });
      await writeFile(casovacPath, Buffer.from('{"aktualni":null}', "utf8"));
      await mkdir(path.dirname(recordingPath), { recursive: true });
      await writeFile(recordingPath, Buffer.from("firemní-data", "utf8"));

      const before = await fileSnapshot(appData);

      // Pojistka: kdyby se atrapy položily vedle, snímek by je neobsahoval a test by
      // „nic nesmazáno" potvrdil nad prázdnem. Proto se jejich přítomnost tvrdí zvlášť.
      expect(before.has(path.join("cz.ludone.desktop", "auth", "oauth.enc"))).toBe(true);
      expect(before.has(path.join("LuDone Desktop", "queue", "outgoing.json"))).toBe(true);
      expect(before.has(path.join("LuDone Desktop", "cas", "casovac.json"))).toBe(true);
      expect(before.has(path.join("LuDone Desktop", "nahravky", "x.webm"))).toBe(true);

      await createController(app, safeStorage, successfulFetch()).logout();
      const after = await fileSnapshot(appData);

      const removed = [...before.keys()].filter((file) => !after.has(file));
      expect(
        removed,
        "odhlášení smí odebrat JEN token — cokoli dalšího je ztráta nahrávek nebo naměřeného času",
      ).toEqual([path.join("cz.ludone.desktop", "auth", "oauth.enc")]);
      for (const [file, contents] of after) {
        expect(contents).toEqual(before.get(file));
      }
      expect(fs.existsSync(blobPath)).toBe(false);
    });
  });

  it("auth modul o frontě neví", () => {
    // 🔴 Měří se KÓD, ne próza. Bez tohohle kroku shodí bránu obyčejný komentář,
    // který o frontě jen MLUVÍ — a to je falešná červená: nutí člověka přeformulovat
    // poznámku místo aby opravil kód. Odstraňují se jen CELOŘÁDKOVÉ komentáře; kdo maže
    // každé `//`, rozřízne i URL uvnitř řetězce.
    const authBezKomentaru = authSource
      .split("\n")
      .map((radek) => (radek.trim().startsWith("//") ? "" : radek))
      .join("\n");
    expect(authBezKomentaru).not.toMatch(/queue|fronta|outgoing/i);
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
    // Po B3 hlavní proces stav lišty NENASTAVUJE — mění fakt a nechá ho odvodit.
    // Vlastník nahrávky v `trackingOwners` je tu schválně: odhlášení ho nesmí smazat.
    const appState = { signedIn: true, trackingOwners: new Set(["nahravka-1"]) };
    // Zaznamenáváme fakt V OKAMŽIKU přepočtu. Bez toho by prošlo i pořadí
    // `refreshTray(); appState.signedIn = false;`, kde lišta počítá ze zastaralého faktu.
    const faktPriPrepoctu = [];
    const refreshTray = vi.fn(() => faktPriPrepoctu.push(appState.signedIn));
    const app = {};
    const safeStorage = {};
    const logger = { error: vi.fn() };
    const authSessionCoordinator = {};
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
      "appState",
      "refreshTray",
      "console",
      "authSessionCoordinator",
      "authSessionGeneration",
      "authLogoutsInFlight",
      `"use strict"; ${registration}`,
    )(
      requireModule,
      app,
      safeStorage,
      handleValidated,
      appState,
      refreshTray,
      logger,
      authSessionCoordinator,
      0,
      0,
    );

    expect(requireModule).toHaveBeenCalledWith("./auth.cjs");
    expect(createLogoutController).toHaveBeenCalledWith({
      app,
      coordinator: authSessionCoordinator,
      safeStorage,
      logger,
    });
    expect(captured).toMatchObject({ channel: "auth:logout", allowedKinds: ["panel"] });
    const returned = await captured.handler();
    expect(returned).toBe(sentinel);
    expect(logout).toHaveBeenCalledOnce();
    expect(appState.signedIn, "odhlášení musí změnit FAKT, ne ikonu").toBe(false);
    expect(refreshTray, "a nechat stav přepočítat").toHaveBeenCalledOnce();
    expect(faktPriPrepoctu, "přepočet musí přijít AŽ PO změně faktu").toEqual([false]);

    const localFailure = Object.freeze({
      signedOutLocally: false,
      serverRevoked: true,
      reason: "local-delete-failed",
    });
    logout.mockResolvedValueOnce(localFailure);
    appState.signedIn = true;
    expect(await captured.handler()).toBe(localFailure);
    expect(refreshTray, "neúspěšné místní odhlášení lištou nehýbe").toHaveBeenCalledOnce();
    expect(appState.signedIn, "a fakt nechává být").toBe(true);
    expect([...appState.trackingOwners], "nahrávka odhlášení nepřežila").toEqual(["nahravka-1"]);
  });
});

describe("stav lišty po odhlášení — kontrola, která se ozve, až přistane B3", () => {
  // 🔴 Tahle kontrola vznikla z nálezu nezávislého review a je záměrně napsaná tak,
  // aby NEMOHLA ZESTÁRNOUT.
  //
  // Situace: `auth:logout` volá `updateTray("signed-out")`. Na TÉHLE větvi je to v pořádku —
  // linie main→b4→b8→b9 story B3 neobsahuje, takže `updateTray` tu legitimně existuje.
  // Jenže B3 (`decisions.md` O13, `specs/E3` §3) tu funkci **maže** a nahrazuje ji
  // bezargumentovým `refreshTray()`; podmínka hotovo tam zní doslova
  // „grep -n 'updateTray' electron/main.cjs nevrátí nic".
  //
  // Kdyby tu stála jen poznámka „až přistane B3, opravit", nikdo by ji nečetl — brána je
  // zelená a poznámky se čtou, až když něco spadne. Proto se ptáme na SKUTEČNOST:
  // dokud `refreshTray` v souboru není, je zelená a nahlas říká, co neměří; jakmile
  // přistane, zčervená a řekne, co dopsat.
  const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const kodBezKomentaru = mainSource
    .split("\n")
    .map((radek) => (radek.trim().startsWith("//") ? "" : radek))
    .join("\n");

  function blokOdhlaseni() {
    const zacatek = kodBezKomentaru.indexOf('handleValidated("auth:logout"');
    expect(zacatek, "blok auth:logout se v main.cjs nenašel").toBeGreaterThan(-1);
    return kodBezKomentaru.slice(zacatek, zacatek + 900);
  }

  const b3Pristala = kodBezKomentaru.includes("function refreshTray(");

  it.runIf(!b3Pristala)("B3 tu zatím NENÍ — měříme jen, že se lišta po odhlášení vůbec přepne", () => {
    // Co se tímhle VĚDOMĚ NEMĚŘÍ: že se použije `refreshTray()`. Na téhle větvi
    // neexistuje, takže by to nešlo splnit ani kdyby chtěl.
    expect(blokOdhlaseni()).toMatch(/updateTray\(|refreshTray\(/);
    expect(kodBezKomentaru).toContain("function updateTray(");
  });

  it.runIf(b3Pristala)("B3 PŘISTÁLA — odhlášení musí hlásit fakt, ne nastavovat stav", () => {
    // Až sem test dojde, znamená to, že se obě linie potkaly. Od té chvíle je
    // `updateTray` zakázaný a odhlášení má nastavit fakt a nechat stav odvodit.
    const blok = blokOdhlaseni();
    expect(blok, "auth:logout pořád volá updateTray, které B3 ruší").not.toContain("updateTray(");
    expect(blok).toContain("appState.signedIn = false");
    expect(blok).toContain("refreshTray()");
    expect(kodBezKomentaru, "updateTray má po B3 zmizet úplně").not.toContain("function updateTray(");
  });

  it("jedna z těch dvou větví vždycky běží", () => {
    // Pojistka proti tomu, aby se obě podmínky minuly a nezměřilo se nic.
    expect(typeof b3Pristala).toBe("boolean");
  });
});
