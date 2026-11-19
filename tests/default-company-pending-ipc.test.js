import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");
const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const session = { scope: "upload", identity: { email: "a@example.test" } };

/** @param {() => Promise<any>} [readSession] */
function mainHarness(readSession = async () => session) {
  const guardStart = mainSource.indexOf("function uploadCompanyGuard(");
  const guardEnd = mainSource.indexOf("\n// Převzetí je čistě lokální", guardStart);
  const handlerStart = mainSource.indexOf('handleValidated("upload-companies:default"');
  const handlerEnd = mainSource.indexOf('\nhandleValidated("upload-companies:list"', handlerStart);
  if ([guardStart, guardEnd, handlerStart, handlerEnd].some((position) => position < 0)) throw new Error("Chybí handler výchozí firmy");
  let handler;
  const context = {
    authSessionGeneration: 1, uploadCompanySelectionEpoch: 1, authAttemptsInFlight: 0,
    authLogoutsInFlight: 0, authOriginChangeInFlight: false, authSessionTransitionPromise: null,
    uploadCompanyIdentityBinding: null, UPLOAD_SCOPE: "upload",
    COMPANY_ID_PATTERN: /^[0-9a-f-]{36}$/u,
    handleValidated: (channel, roles, callback) => {
      expect(channel).toBe("upload-companies:default");
      expect(roles).toEqual(["panel", "settings"]);
      handler = callback;
    },
    requireNoPayload: (_channel, extra) => { if (extra.length) throw new Error("payload"); },
    requireTrustedSender: vi.fn(),
    readStoredAuthSession: vi.fn(readSession),
    normalizedIdentityPart: (value) => typeof value === "string" ? value.trim() : "",
    storedSessionMatchesCurrentAuth: (value) => Boolean(value && !value.mismatch),
    companyIdentity: () => null,
    validCompanyName: (value) => typeof value === "string" && value.length > 0,
    randomUUID: () => "11111111-1111-4111-8111-111111111111",
  };
  runInNewContext(`${mainSource.slice(guardStart, guardEnd)}\n${mainSource.slice(handlerStart, handlerEnd)}`, context);
  return { context, get: (...args) => handler(...args) };
}

function preloadFor(value) {
  let api;
  const electron = {
    contextBridge: { exposeInMainWorld: (_name, exposed) => { api = exposed; } },
    ipcRenderer: { invoke: vi.fn(async () => value), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
  };
  Function("require", `"use strict";\n${preloadSource}`)((name) => {
    if (name !== "electron") throw new Error("Neočekávaný modul");
    return electron;
  });
  return api;
}

describe("rozlišení nejisté výchozí firmy v IPC", () => {
  it("stabilní relace bez uložené firmy vrátí skutečně prázdnou volbu", async () => {
    const harness = mainHarness();
    await expect(harness.get({})).resolves.toEqual({ companyId: null });
    expect(harness.context.readStoredAuthSession).toHaveBeenCalledOnce();
  });

  it("nestabilní přihlášení před čtením vrátí pending bez čtení relace", async () => {
    const harness = mainHarness();
    harness.context.authAttemptsInFlight = 1;
    await expect(harness.get({})).resolves.toEqual({ companyId: null, pending: true });
    expect(harness.context.readStoredAuthSession).not.toHaveBeenCalled();
  });

  it.each(["authSessionGeneration", "uploadCompanySelectionEpoch"])("změna %s během čtení vrátí pending", async (field) => {
    let finish;
    const harness = mainHarness(() => new Promise((resolve) => { finish = resolve; }));
    const result = harness.get({});
    harness.context[field] += 1;
    finish({ ...session, companyTabidooId: COMPANY_ID });
    await expect(result).resolves.toEqual({ companyId: null, pending: true });
  });

  it.each([
    ["žádná relace", null],
    ["jiná identita", { ...session, mismatch: true }],
    ["jiný scope", { ...session, scope: "read" }],
    ["neplatný e-mail", { ...session, identity: { email: "neplatný" } }],
  ])("%s znamená pending, nikoli prázdnou volbu", async (_label, stored) => {
    const harness = mainHarness(async () => stored);
    await expect(harness.get({})).resolves.toEqual({ companyId: null, pending: true });
  });

  it("stabilní uloženou firmu vrací beze změny", async () => {
    const harness = mainHarness(async () => ({ ...session, companyTabidooId: COMPANY_ID, companyTabidooName: "Alfa" }));
    await expect(harness.get({})).resolves.toEqual({ companyId: COMPANY_ID, companyName: "Alfa" });
  });

  it("preload propustí pending a nepředá identityBinding jako součást volby", async () => {
    await expect(preloadFor({ companyId: null, pending: true }).getUploadCompanyDefault())
      .resolves.toEqual({ companyId: null, pending: true });
    await expect(preloadFor({ companyId: null, pending: true }).getUploadCompanyIdentity()).resolves.toBeNull();
  });

  it.each([
    { companyId: null, pending: "true" },
    { companyId: COMPANY_ID, pending: true },
    { companyId: null, pending: true, extra: "navíc" },
    // Nejistá odpověď nesmí nést vazbu identity (review #203, P3).
    { companyId: null, pending: true, identityBinding: "123e4567-e89b-42d3-a456-426614174000" },
  ])("preload odmítne neplatný pending %o", async (value) => {
    await expect(preloadFor(value).getUploadCompanyDefault()).rejects.toThrow(/výchozí firma/u);
  });
});
