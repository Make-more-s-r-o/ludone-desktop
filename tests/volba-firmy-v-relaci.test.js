import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  tokenSessionFilePath,
  updateStoredAuthSessionCompany,
} = require("../electron/auth.cjs");

const FIRMA = "11111111-1111-4111-8111-111111111111";
const JINA_FIRMA = "22222222-2222-4222-8222-222222222222";
const koreny = new Set();

/** safeStorage v testu jen prochází textem — zajímá nás obsah relace, ne šifra. */
const safeStorage = {
  decryptString: (value) => value.toString("utf8"),
  encryptString: (value) => Buffer.from(value, "utf8"),
  isEncryptionAvailable: () => true,
};

const relace = (prepis = {}) => ({
  v: 1,
  issuer: "https://labs.ludone.cz",
  clientId: "desktop-test",
  resource: "https://labs.ludone.cz/api/mcp",
  scope: "nahravky:upload",
  accessToken: "token-nepatri-do-logu",
  refreshToken: "refresh-nepatri-do-logu",
  tokenType: "Bearer",
  accessExpiresAt: Date.now() + 900_000,
  identity: { name: "Zkouška", email: "zkouska@makemore.cz" },
  ...prepis,
});

async function harness(ulozenaRelace = relace()) {
  const appData = await mkdtemp(path.join(tmpdir(), "ludone-volba-firmy-"));
  koreny.add(appData);
  const app = { getPath: vi.fn(() => appData) };
  const cesta = tokenSessionFilePath(app);
  await mkdir(path.dirname(cesta), { recursive: true });
  if (ulozenaRelace !== null) {
    await writeFile(cesta, safeStorage.encryptString(JSON.stringify(ulozenaRelace)));
  }
  return {
    app,
    precti: async () => JSON.parse((await readFile(cesta)).toString("utf8")),
  };
}

afterEach(async () => {
  await Promise.all([...koreny].map((koren) => rm(koren, { force: true, recursive: true })));
  koreny.clear();
});

describe("uložení vybrané firmy do přihlašovací relace", () => {
  it("zapíše firmu a ostatní pole relace nechá být", async () => {
    const puvodni = relace();
    const { app, precti } = await harness(puvodni);

    const vysledek = await updateStoredAuthSessionCompany({
      app,
      safeStorage,
      companyTabidooId: FIRMA,
      storedSession: puvodni,
    });

    expect(vysledek).toMatchObject({ companyTabidooId: FIRMA });
    const naDisku = await precti();
    expect(naDisku.companyTabidooId).toBe(FIRMA);
    // Tokeny ani identita se zápisem firmy nesmí ztratit.
    expect(naDisku).toMatchObject({
      accessToken: puvodni.accessToken,
      refreshToken: puvodni.refreshToken,
      identity: puvodni.identity,
      v: 1,
    });
  });

  it("🔴 nepřepíše relaci, do které se mezitím přihlásil někdo jiný", async () => {
    // Volající četl relaci účtu A, ale na disku je mezitím účet B. Zapsat do ní firmu
    // vybranou pro A by znamenalo odeslat cizí schůzky pod cizí firmu.
    const cizi = relace({ clientId: "jiny-klient" });
    const { app, precti } = await harness(cizi);

    const vysledek = await updateStoredAuthSessionCompany({
      app,
      safeStorage,
      companyTabidooId: FIRMA,
      storedSession: relace(),
    });

    expect(vysledek).toBeNull();
    expect(await precti()).not.toHaveProperty("companyTabidooId");
  });

  it("nepřepíše relaci z jiného prostředí", async () => {
    const produkcni = relace({
      issuer: "https://app.ludone.cz",
      resource: "https://app.ludone.cz/api/mcp",
    });
    const { app, precti } = await harness(produkcni);

    await expect(updateStoredAuthSessionCompany({
      app,
      safeStorage,
      companyTabidooId: FIRMA,
      storedSession: relace(),
    })).resolves.toBeNull();
    expect(await precti()).not.toHaveProperty("companyTabidooId");
  });

  it("po odhlášení se volba nikam nezapíše", async () => {
    const { app } = await harness(null);

    await expect(updateStoredAuthSessionCompany({
      app,
      safeStorage,
      companyTabidooId: FIRMA,
      storedSession: relace(),
    })).resolves.toBeNull();
  });

  it.each(["", "nesmysl", "11111111-1111-4111-8111-11111111111", null, 42])(
    "odmítne neplatný identifikátor firmy (%s) a nic nezapíše",
    async (spatna) => {
      const puvodni = relace();
      const { app, precti } = await harness(puvodni);

      await expect(updateStoredAuthSessionCompany({
        app,
        safeStorage,
        companyTabidooId: spatna,
        storedSession: puvodni,
      })).rejects.toThrow("GUID");
      expect(await precti()).not.toHaveProperty("companyTabidooId");
    },
  );

  it("volbu firmy lze přepsat novou volbou", async () => {
    const puvodni = relace({ companyTabidooId: FIRMA });
    const { app, precti } = await harness(puvodni);

    await updateStoredAuthSessionCompany({
      app,
      safeStorage,
      companyTabidooId: JINA_FIRMA,
      storedSession: puvodni,
    });

    expect((await precti()).companyTabidooId).toBe(JINA_FIRMA);
  });
});
