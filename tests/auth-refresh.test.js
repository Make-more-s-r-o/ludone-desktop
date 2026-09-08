import fs from "node:fs";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const authModul = require("../electron/auth.cjs");
const { REFRESH_DEADLINE_MS, tokenSessionFilePath } = authModul;
// Produkční podpis má výchozí hodnoty `globalThis.fetch` a `console`, takže si z nich
// typová brána odvodí plný `Response` i celou `Console`. Naši dvojníci jsou záměrně
// částeční — chceme měřit chování, ne stavět repliku prohlížečové odpovědi.
const refreshStoredAuthSession = /** @type {(args: any) => Promise<any>} */ (
  authModul.refreshStoredAuthSession
);

// Zapsaná kopie produkční konstanty: kdyby se strop tiše změnil, spadne tenhle test,
// ne až chování naostro. Stejný vzor drží tests/logout-safety.test.js u odhlášení.
const OCEKAVANY_STROP_MS = 5_000;

const ISSUER = "https://labs.ludone.cz";
const METADATA = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/api/mcp/oauth/authorize`,
  token_endpoint: `${ISSUER}/api/mcp/oauth/token`,
  registration_endpoint: `${ISSUER}/api/mcp/oauth/register`,
  revocation_endpoint: `${ISSUER}/api/mcp/oauth/revoke`,
  code_challenge_methods_supported: ["S256"],
};

// 🔴 Každý test MUSÍ dostat vlastní refresh token. Brzda na opakované selhání si
// pamatuje ten, který neprošel, a je modulová — sdílený řetězec by otrávil sousedy.
let poradiRelace = 0;
function vyprselaRelace(nazev) {
  poradiRelace += 1;
  return {
    v: 1,
    issuer: ISSUER,
    clientId: "desktop-client",
    resource: `${ISSUER}/api/mcp`,
    scope: "mcp:read",
    accessToken: `access-${nazev}-${poradiRelace}`,
    refreshToken: `refresh-${nazev}-${poradiRelace}`,
    tokenType: "Bearer",
    accessExpiresAt: Date.now() - 60_000,
    identity: { name: "Testovací Uživatel", email: "test@example.invalid" },
  };
}

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

function discoveryResponse() {
  return { ok: true, status: 200, json: async () => METADATA };
}

function tokenResponse(prepis = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      access_token: "novy-access",
      refresh_token: "novy-refresh",
      token_type: "Bearer",
      expires_in: 3600,
      ...prepis,
    }),
  };
}

function jeDiscovery(url) {
  return String(url).includes("/.well-known/");
}

async function vDocasnemAppData(run) {
  const appData = await mkdtemp(path.join(tmpdir(), "ludone-refresh-"));
  const app = {
    getPath(name) {
      if (name !== "appData") throw new Error(`Neočekávaná Electron cesta: ${name}`);
      return appData;
    },
  };
  try {
    return await run({ app });
  } finally {
    await rm(appData, { recursive: true, force: true });
  }
}

async function zapisRelaci(app, safeStorage, session) {
  const destination = tokenSessionFilePath(app);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, safeStorage.encryptString(JSON.stringify(session)), { mode: 0o600 });
  return destination;
}

async function relaceNaDisku(safeStorage, blobPath) {
  return JSON.parse(safeStorage.decryptString(await readFile(blobPath)));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("obnova access tokenu", () => {
  it("drží strop obnovy na pěti sekundách", () => {
    expect(REFRESH_DEADLINE_MS).toBe(OCEKAVANY_STROP_MS);
  });

  it("dva souběžní volající vyrobí jedinou výměnu tokenu", async () => {
    await vDocasnemAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const logger = fakeLogger();
      const session = vyprselaRelace("soubeh");
      const blobPath = await zapisRelaci(app, safeStorage, session);
      const fetchImpl = vi.fn(async (url) => (jeDiscovery(url) ? discoveryResponse() : tokenResponse()));

      // Strážce je synchronní, takže mezi těmito dvěma řádky není await-mezera,
      // kterou by druhý volající proklouzl do vlastního běhu.
      const prvni = refreshStoredAuthSession({ app, safeStorage, storedSession: session, fetchImpl, logger });
      const druhy = refreshStoredAuthSession({ app, safeStorage, storedSession: session, fetchImpl, logger });
      expect(druhy).toBe(prvni);

      const [a, b] = await Promise.all([prvni, druhy]);

      expect(a).toBe(b);
      expect(a.accessToken).toBe("novy-access");
      expect(a.refreshToken).toBe("novy-refresh");
      // Discovery + výměna = dvě volání. Bez sdílené brány by jich byly čtyři a server
      // by druhý pokus vyhodnotil jako znovupoužití — to je celé riziko R15.
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(await relaceNaDisku(safeStorage, blobPath)).toMatchObject({
        accessToken: "novy-access",
        refreshToken: "novy-refresh",
      });
    });
  });

  it("neúspěšná obnova vrátí null, uložené tokeny nechá na disku a nevyhodí výjimku", async () => {
    await vDocasnemAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const logger = fakeLogger();
      const session = vyprselaRelace("selhani");
      const blobPath = await zapisRelaci(app, safeStorage, session);
      const fetchImpl = vi.fn(async (url) => (jeDiscovery(url) ? discoveryResponse() : { ok: false, status: 401 }));

      const vysledek = await refreshStoredAuthSession({ app, safeStorage, storedSession: session, fetchImpl, logger });

      expect(vysledek).toBeNull();
      // 🔴 Jádro věci: výpadek sítě po probuzení nesmí zahodit refresh token,
      // který je pořád platný. Relace zůstane vypršelá, ne smazaná.
      expect(fs.existsSync(blobPath)).toBe(true);
      expect(await relaceNaDisku(safeStorage, blobPath)).toMatchObject({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
      expect(logger.warn).toHaveBeenCalledWith("[auth] Obnova relace selhala: reason=refresh-failed");
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(session.refreshToken);
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(session.accessToken);
    });
  });

  it("tentýž už neúspěšný refresh token se podruhé nezkouší", async () => {
    await vDocasnemAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const logger = fakeLogger();
      const session = vyprselaRelace("brzda");
      await zapisRelaci(app, safeStorage, session);
      const fetchImpl = vi.fn(async (url) => (jeDiscovery(url) ? discoveryResponse() : { ok: false, status: 400 }));

      expect(await refreshStoredAuthSession({ app, safeStorage, storedSession: session, fetchImpl, logger })).toBeNull();
      expect(fetchImpl).toHaveBeenCalledTimes(2);

      // Bez brzdy by každé čtení stavu relace vyrobilo další požadavek — z vypršené
      // relace by se stal nepřetržitý proud dotazů, dokud se člověk znovu nepřihlásí.
      expect(await refreshStoredAuthSession({ app, safeStorage, storedSession: session, fetchImpl, logger })).toBeNull();
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
  });

  it("po selhání zůstane brána volná pro jinou relaci", async () => {
    await vDocasnemAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const logger = fakeLogger();
      const spatna = vyprselaRelace("volna-brana-spatna");
      await zapisRelaci(app, safeStorage, spatna);
      const selhavajici = vi.fn(async (url) => {
        if (jeDiscovery(url)) return discoveryResponse();
        throw new Error("síť je pryč");
      });

      expect(await refreshStoredAuthSession({
        app, safeStorage, storedSession: spatna, fetchImpl: selhavajici, logger,
      })).toBeNull();

      // Kdyby se brána po výjimce neuvolnila, tenhle pokus by dostal starý slib
      // a nikdy by nesáhl na síť.
      const dobra = vyprselaRelace("volna-brana-dobra");
      await zapisRelaci(app, safeStorage, dobra);
      const uspesny = vi.fn(async (url) => (jeDiscovery(url) ? discoveryResponse() : tokenResponse()));

      const obnovena = await refreshStoredAuthSession({
        app, safeStorage, storedSession: dobra, fetchImpl: uspesny, logger,
      });

      expect(obnovena).not.toBeNull();
      expect(obnovena.accessToken).toBe("novy-access");
      expect(uspesny).toHaveBeenCalledTimes(2);
    });
  });

  it("bez refresh tokenu se o obnovu vůbec nepokusí", async () => {
    await vDocasnemAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const logger = fakeLogger();
      const session = { ...vyprselaRelace("bez-tokenu"), refreshToken: "" };
      const blobPath = await zapisRelaci(app, safeStorage, session);
      const fetchImpl = vi.fn();

      expect(await refreshStoredAuthSession({ app, safeStorage, storedSession: session, fetchImpl, logger })).toBeNull();

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(fs.existsSync(blobPath)).toBe(true);
    });
  });

  it("platnou relaci neobnovuje", async () => {
    await vDocasnemAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const logger = fakeLogger();
      const session = { ...vyprselaRelace("jeste-plati"), accessExpiresAt: Date.now() + 600_000 };
      await zapisRelaci(app, safeStorage, session);
      const fetchImpl = vi.fn();

      expect(await refreshStoredAuthSession({ app, safeStorage, storedSession: session, fetchImpl, logger })).toBeNull();

      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });

  it("odpověď bez nového refresh tokenu neuloží nic a relaci zachová", async () => {
    await vDocasnemAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const logger = fakeLogger();
      const session = vyprselaRelace("bez-rotace");
      const blobPath = await zapisRelaci(app, safeStorage, session);
      const fetchImpl = vi.fn(async (url) => (
        jeDiscovery(url) ? discoveryResponse() : tokenResponse({ refresh_token: undefined })
      ));

      expect(await refreshStoredAuthSession({ app, safeStorage, storedSession: session, fetchImpl, logger })).toBeNull();

      expect(await relaceNaDisku(safeStorage, blobPath)).toMatchObject({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
    });
  });

  it("opožděný čtenář s cizím snímkem relace neodešle použitý refresh token", async () => {
    await vDocasnemAppData(async ({ app }) => {
      const safeStorage = fakeSafeStorage();
      const logger = fakeLogger();
      const naDisku = vyprselaRelace("na-disku");
      await zapisRelaci(app, safeStorage, naDisku);
      // Snímek, který si volající odnesl PŘED cizí rotací — na disku už leží jiný.
      const zastaralySnimek = { ...naDisku, accessToken: "uz-neplatny", refreshToken: "uz-pouzity" };
      const fetchImpl = vi.fn(async (url) => (jeDiscovery(url) ? discoveryResponse() : tokenResponse()));

      const vysledek = await refreshStoredAuthSession({
        app, safeStorage, storedSession: zastaralySnimek, fetchImpl, logger,
      });

      // Vrátí se relace z disku, ale na síť se nesáhne: použitý token by server
      // vyhodnotil jako znovupoužití a revokoval celou rodinu.
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(vysledek).toMatchObject({ refreshToken: naDisku.refreshToken });
    });
  });
});
