import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { tokenSessionFilePath } = require("../electron/auth.cjs");
const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const start = main.indexOf("async function readStoredAuthSession()");
const end = main.indexOf("async function hasStoredAuthSession()", start);
if (start < 0 || end < 0) throw new Error("Chybí produkční čtečka identity");
const productionRead = main.slice(start, end);
const roots = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function harness() {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-auth-empty-"));
  roots.push(root);
  const app = { getPath: () => root };
  const safeStorage = { isEncryptionAvailable: vi.fn(() => true), decryptString: vi.fn(() => JSON.stringify({
    v: 1, issuer: "https://app.ludone.cz", clientId: "fixture-client", resource: "fixture-resource",
    scope: "fixture-scope", accessToken: "test-only-token",
  })) };
  const read = vi.fn(readFile);
  const context = { app, safeStorage, fs: { promises: { readFile: read } }, tokenSessionFilePath,
    authSessionGeneration: 0, authLogoutsInFlight: 0, URL };
  // Spouští se doslovné tělo produkční funkce s reálným filesystemem a sledovanými závislostmi.
  const readSession = runInNewContext(`${productionRead}\nreadStoredAuthSession`, context);
  return { root, tokenPath: tokenSessionFilePath(app), safeStorage, context, read, readSession };
}

async function storeBlob(test) {
  await mkdir(path.dirname(test.tokenPath), { recursive: true });
  const blob = Buffer.from("isolated-test-encrypted-blob");
  await writeFile(test.tokenPath, blob);
  return blob;
}

describe("prázdné úložiště identity před Keychain", () => {
  it.each([false, true])("chybějící soubor s existující složkou %s nevolá Keychain", async (directoryExists) => {
    const test = await harness();
    if (directoryExists) await mkdir(path.dirname(test.tokenPath), { recursive: true });
    test.safeStorage.isEncryptionAvailable.mockImplementation(() => { throw new Error("Keychain se nesmí oslovit"); });
    await expect(test.readSession()).resolves.toBeNull();
    expect(test.read).toHaveBeenCalledExactlyOnceWith(test.tokenPath);
    expect(test.safeStorage.isEncryptionAvailable).not.toHaveBeenCalled();
    expect(test.safeStorage.decryptString).not.toHaveBeenCalled();
  });

  it.each(["unavailable", "throws"])("existující blob a Keychain %s zůstávají fail-closed", async (failure) => {
    const test = await harness();
    const blob = await storeBlob(test);
    test.safeStorage.isEncryptionAvailable.mockImplementation(() => {
      if (failure === "throws") throw new Error("Tajná nativní chyba");
      return false;
    });
    await expect(test.readSession()).rejects.toThrow("Bezpečné úložiště identity není dostupné");
    expect(test.safeStorage.isEncryptionAvailable).toHaveBeenCalledOnce();
    expect(test.safeStorage.decryptString).not.toHaveBeenCalled();
    expect(await readFile(test.tokenPath)).toEqual(blob);
  });

  it("existující blob se čte před Keychain a dešifruje bez přepsání", async () => {
    const test = await harness();
    const blob = await storeBlob(test);
    await expect(test.readSession()).resolves.toMatchObject({ v: 1, issuer: "https://app.ludone.cz" });
    expect(test.read.mock.invocationCallOrder[0]).toBeLessThan(test.safeStorage.isEncryptionAvailable.mock.invocationCallOrder[0]);
    expect(test.safeStorage.decryptString).toHaveBeenCalledExactlyOnceWith(blob);
    expect(await readFile(test.tokenPath)).toEqual(blob);
  });

  it("chyba čtení odlišná od ENOENT zůstává fail-closed bez Keychain", async () => {
    const test = await harness();
    test.read.mockRejectedValue(Object.assign(new Error("filesystem"), { code: "EACCES" }));
    await expect(test.readSession()).rejects.toThrow("Uloženou identitu se nepodařilo načíst");
    expect(test.safeStorage.isEncryptionAvailable).not.toHaveBeenCalled();
  });

  it("selhání dešifrování ani neplatný formát nezaloží identitu", async () => {
    const test = await harness();
    await storeBlob(test);
    test.safeStorage.decryptString.mockImplementationOnce(() => { throw new Error("decrypt"); });
    await expect(test.readSession()).rejects.toThrow("Uloženou identitu se nepodařilo přečíst");
    test.safeStorage.decryptString.mockReturnValue("{}");
    await expect(test.readSession()).rejects.toThrow("Uložená session identity má neplatný formát");
  });

  it("probíhající logout nečte disk ani Keychain", async () => {
    const test = await harness();
    test.context.authLogoutsInFlight = 1;
    await expect(test.readSession()).resolves.toBeNull();
    expect(test.read).not.toHaveBeenCalled();
    expect(test.safeStorage.isEncryptionAvailable).not.toHaveBeenCalled();
  });

  it("změna generace při čtení nesmí vrátit starou identitu", async () => {
    const test = await harness();
    await storeBlob(test);
    const pending = test.readSession();
    test.context.authSessionGeneration += 1;
    await expect(pending).resolves.toBeNull();
  });
});
