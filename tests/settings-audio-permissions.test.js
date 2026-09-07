import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const distRoot = fileURLToPath(new URL("../dist", import.meta.url));
const appUrl = pathToFileURL(path.join(distRoot, "index.html")).toString();
const settingsUrl = `${appUrl}#settings`;

// Stejný způsob spuštění produkčních stráží jako v ipc-sender-guard.test.js.
function functionSource(name) {
  const start = mainSource.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Funkce ${name} nebyla nalezena`);
  const openingBrace = mainSource.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < mainSource.length; index += 1) {
    if (mainSource[index] === "{") depth += 1;
    if (mainSource[index] === "}") depth -= 1;
    if (depth === 0) return mainSource.slice(start, index + 1);
  }
  throw new Error(`Funkce ${name} nemá uzavřené tělo`);
}

function webContents(url) {
  return { mainFrame: { url }, isDestroyed: () => false, getURL: () => url };
}

function setup() {
  const panel = webContents(appUrl);
  const settings = webContents(settingsUrl);
  const source = { id: "screen:1", name: "Monitor" };
  const capturer = { getSources: vi.fn().mockResolvedValue([source]) };
  const defaultSession = {
    setPermissionCheckHandler: vi.fn(),
    setPermissionRequestHandler: vi.fn(),
    setDisplayMediaRequestHandler: vi.fn(),
  };
  const createHandlers = Function(
    "path", "fileURLToPath", "DIST_ROOT", "panelWindow", "settingsWindow",
    "session", "desktopCapturer", "console",
    `"use strict";
    const traySpaceWarningWindow = null;
    ${[
      "isTrustedAppUrl", "isTrustedWebContents", "isTrustedRecordingSender",
      "trustedSenderKind", "requireTrustedSender", "isAllowedMediaPermission",
      "isTrustedPanelFrame", "isTrustedSettingsAudioFrame", "installMediaHandlers",
    ].map(functionSource).join("\n")}
    installMediaHandlers();`,
  );
  createHandlers(path, fileURLToPath, distRoot, { webContents: panel }, { webContents: settings },
    { defaultSession }, capturer, { log: vi.fn(), error: vi.fn() });
  return {
    panel, settings, source, capturer,
    check: defaultSession.setPermissionCheckHandler.mock.calls[0][0],
    request: defaultSession.setPermissionRequestHandler.mock.calls[0][0],
    display: defaultSession.setDisplayMediaRequestHandler.mock.calls[0][0],
  };
}

describe("oprávnění sdílené zkoušky v Nastavení", () => {
  it.each([
    { permission: "media", mediaTypes: ["audio"] },
    { permission: "media", mediaTypes: [] },
    { permission: "display-capture", mediaTypes: [] },
  ])("důvěryhodná hlavní stránka Nastavení získá $permission / $mediaTypes", ({ permission, mediaTypes }) => {
    const handlers = setup();
    const details = { isMainFrame: true, requestingUrl: settingsUrl, mediaTypes };
    expect(handlers.check(handlers.settings, permission, "", details)).toBe(true);
    const callback = vi.fn();
    handlers.request(handlers.settings, permission, callback, details);
    expect(callback).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("systémový zvuk Nastavení používá stejný loopback jako panel", async () => {
    const handlers = setup();
    for (const sender of [handlers.settings, handlers.panel]) {
      const callback = vi.fn();
      await handlers.display({ frame: sender.mainFrame, audioRequested: true, videoRequested: true }, callback);
      expect(callback).toHaveBeenCalledExactlyOnceWith({ video: handlers.source, audio: "loopback" });
    }
    expect(handlers.capturer.getSources).toHaveBeenCalledTimes(2);
  });

  it.each([
    { reason: "podrám", details: { isMainFrame: false } },
    { reason: "cizí URL", details: { requestingUrl: "https://utocnik.example/" } },
    { reason: "kamera", details: { mediaTypes: ["video"] } },
    { reason: "mikrofon s kamerou", details: { mediaTypes: ["audio", "video"] } },
  ])("Nastavení nezíská oprávnění pro $reason", ({ details }) => {
    const handlers = setup();
    const request = { isMainFrame: true, requestingUrl: settingsUrl, mediaTypes: ["audio"], ...details };
    expect(handlers.check(handlers.settings, "media", "", request)).toBe(false);
    const callback = vi.fn();
    handlers.request(handlers.settings, "media", callback, request);
    expect(callback).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("cizí okno se stejnou URL Nastavení nezíská mikrofon ani loopback", async () => {
    const handlers = setup();
    const foreign = webContents(settingsUrl);
    expect(handlers.check(foreign, "media", "", {
      isMainFrame: true, requestingUrl: settingsUrl, mediaTypes: ["audio"],
    })).toBe(false);
    const callback = vi.fn();
    await handlers.display({ frame: foreign.mainFrame, audioRequested: true, videoRequested: true }, callback);
    expect(callback).toHaveBeenCalledExactlyOnceWith({});
    expect(handlers.capturer.getSources).not.toHaveBeenCalled();
  });

  it("podrám, cizí dokument a neúplná žádost Nastavení nezískají loopback", async () => {
    const handlers = setup();
    for (const request of [
      { frame: { url: settingsUrl }, audioRequested: true, videoRequested: true },
      { frame: handlers.settings.mainFrame, audioRequested: false, videoRequested: true },
      { frame: handlers.settings.mainFrame, audioRequested: true, videoRequested: false },
    ]) {
      const callback = vi.fn();
      await handlers.display(request, callback);
      expect(callback).toHaveBeenCalledExactlyOnceWith({});
    }
    handlers.settings.mainFrame.url = "https://utocnik.example/";
    const callback = vi.fn();
    await handlers.display({ frame: handlers.settings.mainFrame, audioRequested: true, videoRequested: true }, callback);
    expect(callback).toHaveBeenCalledExactlyOnceWith({});
    expect(handlers.capturer.getSources).not.toHaveBeenCalled();
  });

  it("Nastavení po navigaci mimo svůj dokument nezíská mikrofon ani loopback", async () => {
    const handlers = setup();
    handlers.settings.getURL = () => appUrl;
    handlers.settings.mainFrame.url = appUrl;
    expect(handlers.check(handlers.settings, "media", "", {
      isMainFrame: true, requestingUrl: appUrl, mediaTypes: ["audio"],
    })).toBe(false);
    const callback = vi.fn();
    await handlers.display({ frame: handlers.settings.mainFrame, audioRequested: true, videoRequested: true }, callback);
    expect(callback).toHaveBeenCalledExactlyOnceWith({});
    expect(handlers.capturer.getSources).not.toHaveBeenCalled();
  });
});
