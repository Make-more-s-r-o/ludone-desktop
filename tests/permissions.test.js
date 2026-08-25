import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  createPermissionRequestHandler,
  decidePermissionResult,
  tokenStorageDirectory,
} = require("../electron/auth.cjs");

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

describe("rozhodnutí podle skutečného stavu oprávnění macOS", () => {
  it("považuje granted za udělené a nic dalšího nedělá", () => {
    const result = decidePermissionResult("microphone", "granted");

    expect(result).toMatchObject({ status: "granted", granted: true, nextAction: "none" });
  });

  it("považuje denied za neudělené a posílá do Nastavení", () => {
    const result = decidePermissionResult("system-audio", "denied");

    expect(result).toMatchObject({ status: "denied", granted: false, nextAction: "open-settings" });
    expect(result.settingsUrl).toContain("Privacy_ScreenCapture");
  });

  it("u dosud neurčeného mikrofonu žádá macOS o oprávnění", () => {
    const result = decidePermissionResult("microphone", "not-determined");

    expect(result).toMatchObject({
      status: "not-determined",
      granted: false,
      nextAction: "request",
    });
  });

  it("u dosud neurčeného systémového zvuku posílá člověka do Nastavení", () => {
    const result = decidePermissionResult("system-audio", "not-determined");

    expect(result).toMatchObject({
      status: "not-determined",
      granted: false,
      nextAction: "open-settings",
    });
    expect(result.settingsUrl).toContain("Privacy_ScreenCapture");
  });

  it("považuje restricted za neudělené a nevyvolává další akci", () => {
    const result = decidePermissionResult("microphone", "restricted");

    expect(result).toMatchObject({ status: "restricted", granted: false, nextAction: "none" });
  });

  it("neznámý stav odmítne fail-closed", () => {
    const result = decidePermissionResult("microphone", "future-status");

    expect(result).toMatchObject({ status: "unknown", granted: false, nextAction: "none" });
  });

  it("chybějící stav odmítne fail-closed", () => {
    const result = decidePermissionResult("system-audio");

    expect(result).toMatchObject({ status: "unknown", granted: false, nextAction: "none" });
  });

  it("nepodporovaný typ oprávnění odmítne bez ohledu na stav", () => {
    const result = decidePermissionResult("calendar", "granted");

    expect(result).toMatchObject({
      permission: "calendar",
      status: "unknown",
      granted: false,
      nextAction: "none",
    });
  });

  it.each(["constructor", "__proto__"])(
    "zděděný klíč %s nepovažuje za podporované oprávnění",
    (permission) => {
      expect(decidePermissionResult(permission, "granted")).toMatchObject({
        permission,
        status: "unknown",
        granted: false,
        nextAction: "none",
      });
    },
  );

  it("produkční handler při denied z macOS nevrátí granted", async () => {
    const systemPreferences = {
      askForMediaAccess: vi.fn(),
      getMediaAccessStatus: vi.fn(() => "denied"),
    };
    const shell = { openExternal: vi.fn(async () => {}) };
    const requestPermission = createPermissionRequestHandler({ systemPreferences, shell });

    const result = await requestPermission("microphone");

    expect(result).toMatchObject({ status: "denied", granted: false });
    expect(systemPreferences.getMediaAccessStatus).toHaveBeenCalledWith("microphone");
    expect(systemPreferences.askForMediaAccess).not.toHaveBeenCalled();
    expect(shell.openExternal).toHaveBeenCalledWith(result.settingsUrl);
  });

  it("produkční handler po žádosti znovu přečte skutečný stav macOS", async () => {
    const systemPreferences = {
      askForMediaAccess: vi.fn(async () => true),
      getMediaAccessStatus: vi.fn()
        .mockReturnValueOnce("not-determined")
        .mockReturnValueOnce("denied"),
    };
    const shell = { openExternal: vi.fn(async () => {}) };
    const requestPermission = createPermissionRequestHandler({ systemPreferences, shell });

    const result = await requestPermission("microphone");

    expect(result).toMatchObject({ status: "denied", granted: false });
    expect(systemPreferences.askForMediaAccess).toHaveBeenCalledWith("microphone");
    expect(systemPreferences.getMediaAccessStatus).toHaveBeenCalledTimes(2);
  });
});

describe("úložiště přihlašovacích údajů", () => {
  it("používá systémové appData nezávislé na přesměrovaném userData", () => {
    const appData = path.join(path.dirname(projectRoot), "system-app-data");
    const app = { getPath: vi.fn(() => appData) };

    expect(tokenStorageDirectory(app)).toBe(
      path.join(appData, "cz.ludone.desktop", "auth"),
    );
    expect(app.getPath).toHaveBeenCalledWith("appData");
    expect(app.getPath).not.toHaveBeenCalledWith("userData");
  });

  it("odmítne cílovou cestu uvnitř repozitáře", () => {
    const app = { getPath: vi.fn(() => path.join(projectRoot, ".runtime")) };

    expect(() => tokenStorageDirectory(app)).toThrow(/uvnitř repozitáře/);
  });
});
