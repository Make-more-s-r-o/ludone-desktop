import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { SettingsApp } from "../src/components/Settings.jsx";

const ORIGIN = "https://labs.ludone.cz";
const PRODUCTION_ORIGIN = "https://app.ludone.cz";
const DIAGNOSTICS = Object.freeze({
  version: "9.8.7",
  architecture: "Apple Silicon",
  permissions: {
    microphone: { status: "granted", label: "Povoleno" },
    systemAudio: { status: "denied", label: "Nepovoleno" },
  },
  serverConnection: {
    status: "last-success",
    label: "Naposledy v pořádku v 13:05",
    lastSuccessfulAt: "2026-09-03T11:05:00.000Z",
  },
  queue: { available: true, waiting: 2, sending: 1, failed: 0 },
});

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

async function renderSettings({
  confirmEnvironmentChange = /** @type {() => boolean} */ (() => true),
  deviceName = () => Promise.resolve("MacBook-Pro-Dan"),
  diagnostics = () => Promise.resolve(DIAGNOSTICS),
  dockVisible = () => Promise.resolve(false),
  exportDiagnostics = () => Promise.resolve({
    ok: true,
    fileName: "ludone-diagnostika-2026-09-03-130500.txt",
  }),
  identity = () => Promise.resolve({ name: "Ada Lovelace", email: "ada@ludone.cz" }),
  logout = () => Promise.resolve({ signedOutLocally: true, serverRevoked: true, reason: null }),
  openAtLogin = () => Promise.resolve(true),
  origin = () => Promise.resolve(ORIGIN),
  setAuthOrigin = (value) => Promise.resolve(value),
  switchAuthOrigin = /** @type {undefined | ((value: string) => Promise<{
    signedOutLocally: boolean,
    serverRevoked: boolean,
    reason: string | null,
    origin: string | null,
  }>)} */ (undefined),
  setDockVisible = (value) => Promise.resolve(value),
  setOpenAtLogin = (value) => Promise.resolve(value),
} = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  };
  const logoutMock = vi.fn(logout);
  const setAuthOriginMock = vi.fn(setAuthOrigin);
  const switchAuthOriginImplementation = switchAuthOrigin ?? (async (value) => {
    const result = await logoutMock();
    if (result?.signedOutLocally !== true) return { ...result, origin: null };
    const effectiveOrigin = await setAuthOriginMock(value);
    return { ...result, origin: effectiveOrigin };
  });
  const ludone = {
    beginAuth: vi.fn(),
    closeSettings: vi.fn(),
    getAuthIdentity: vi.fn(identity),
    getAuthOrigin: vi.fn(origin),
    getDeviceName: vi.fn(deviceName),
    getDiagnostics: vi.fn(diagnostics),
    getDockVisible: vi.fn(dockVisible),
    getOpenAtLogin: vi.fn(openAtLogin),
    exportDiagnostics: vi.fn(exportDiagnostics),
    logout: logoutMock,
    setAuthOrigin: setAuthOriginMock,
    switchAuthOrigin: vi.fn(switchAuthOriginImplementation),
    setDockVisible: vi.fn(setDockVisible),
    setOpenAtLogin: vi.fn(setOpenAtLogin),
  };
  Object.defineProperty(dom.window, "localStorage", {
    configurable: true,
    value: localStorage,
  });
  Object.defineProperty(dom.window, "ludone", {
    configurable: true,
    value: ludone,
  });
  Object.defineProperty(dom.window, "confirm", {
    configurable: true,
    value: vi.fn(confirmEnvironmentChange),
  });

  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const root = createRoot(dom.window.document.querySelector("#root"));
  await React.act(async () => {
    root.render(React.createElement(SettingsApp));
  });

  return {
    document: dom.window.document,
    localStorage,
    ludone,
    async cleanup() {
      await React.act(async () => root.unmount());
      dom.window.close();
    },
  };
}

function expectNoDesignFiction(settings) {
  expect(settings.document.body.textContent)
    .not.toMatch(/Daniel Novák|daniel@ludone\.cz|undefined|LuDone tým/u);
  expect(settings.ludone.beginAuth).not.toHaveBeenCalled();
  expect(settings.localStorage.setItem).not.toHaveBeenCalled();
}

async function expectAccountState(settings, expected) {
  await vi.waitFor(() => {
    expect(settings.document.querySelector('[data-testid="settings-account"]')?.dataset.authState)
      .toBe(expected);
  }, { timeout: 500 });
}

async function selectTab(settings, label) {
  const tab = [...settings.document.querySelectorAll('[role="tab"]')]
    .find((candidate) => candidate.textContent.trim() === label);
  expect(tab, `Záložka ${label} neexistuje`).toBeDefined();
  await React.act(async () => {
    tab.click();
    await Promise.resolve();
  });
  return tab;
}

function expectVisibleStatus(settings) {
  const status = settings.document.querySelector('[data-testid="settings-account-status"]');
  expect(status?.getAttribute("role")).toBe("status");
  expect(status?.textContent.trim()).toBeTruthy();
  expect(status?.querySelector("svg")).toBeNull();
  expect(settings.document.querySelector('[data-testid="settings-identity-name"]')).toBeNull();
  expect(settings.document.querySelector('[data-testid="settings-identity-email"]')).toBeNull();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("čtyři části Nastavení", () => {
  it("vykreslí přesně čtyři přístupné záložky a přepíná jejich obsah", async () => {
    const settings = await renderSettings();
    try {
      const tablist = settings.document.querySelector('[role="tablist"]');
      const tabs = [...settings.document.querySelectorAll('[role="tab"]')];
      expect(tablist?.getAttribute("aria-label")).toBe("Části nastavení");
      expect(tabs.map((tab) => tab.textContent.trim())).toEqual([
        "Účet",
        "Zvuk",
        "Záznamy",
        "Diagnostika",
      ]);
      expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
        "true",
        "false",
        "false",
        "false",
      ]);
      expect(settings.document.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);

      tabs[0].focus();
      await React.act(async () => {
        tabs[0].dispatchEvent(new settings.document.defaultView.KeyboardEvent("keydown", {
          bubbles: true,
          key: "ArrowRight",
        }));
        await Promise.resolve();
      });
      expect(settings.document.activeElement).toBe(tabs[1]);
      let panel = settings.document.querySelector('[role="tabpanel"]:not([hidden])');
      expect(panel?.textContent).toContain("Kdy nahrávat");
      expect(panel?.textContent).toContain("Co se děje se zvukem");
      expect(panel?.textContent).not.toContain("Ponechat na tomto Macu");

      await selectTab(settings, "Záznamy");
      panel = settings.document.querySelector('[role="tabpanel"]:not([hidden])');
      expect(panel?.textContent).toContain("Ponechat na tomto Macu");
      expect(panel?.textContent).toContain("2 čekají");

      await selectTab(settings, "Diagnostika");
      panel = settings.document.querySelector('[role="tabpanel"]:not([hidden])');
      expect(panel?.textContent).toContain("Verze");
      expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
        "false",
        "false",
        "false",
        "true",
      ]);
      expect(settings.document.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
    } finally {
      await settings.cleanup();
    }
  });

  it("v Účtu ukáže zařízení, dvě pevná prostředí a umí odhlásit tento Mac", async () => {
    const settings = await renderSettings();
    try {
      await expectAccountState(settings, "signed-in");
      await vi.waitFor(() => {
        expect(settings.document.querySelector('[data-testid="settings-device"]')?.textContent)
          .toBe("MacBook-Pro-Dan");
      });
      expect(settings.document.querySelector('[data-testid="settings-environment"]')?.textContent)
        .toContain("labs");
      const environmentSelect = settings.document.querySelector(
        'select[data-testid="settings-environment"]',
      );
      expect(environmentSelect?.value).toBe(ORIGIN);
      expect([...environmentSelect.options].map(({ textContent, value }) => ({
        label: textContent.trim(),
        value,
      }))).toEqual([
        { label: "produkce · app.ludone.cz", value: PRODUCTION_ORIGIN },
        { label: "labs · labs.ludone.cz", value: ORIGIN },
      ]);
      expect(environmentSelect?.getAttribute("aria-describedby"))
        .toBe("settings-environment-explanation");
      expect(settings.document.body.textContent).toContain(
        "Na produkci modul nahrávek schválně není. Na labs ho uvidí jen admin.",
      );
      expect(settings.document.body.textContent).toContain(
        "Prostředí se během dne často aktualizuje.",
      );

      const logoutButton = [...settings.document.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === "Odhlásit tento Mac");
      expect(logoutButton).not.toBeNull();
      await React.act(async () => {
        logoutButton.click();
        await Promise.resolve();
      });
      expect(settings.ludone.logout).toHaveBeenCalledOnce();
      expect(settings.ludone.logout.mock.calls[0]).toHaveLength(0);
    } finally {
      await settings.cleanup();
    }
  });

  it("přepnutí na labs nejdřív potvrdí a odhlásí, teprve potom změní origin", async () => {
    const order = [];
    const settings = await renderSettings({
      origin: () => Promise.resolve(PRODUCTION_ORIGIN),
      logout: async () => {
        order.push("auth:logout");
        return { signedOutLocally: true, serverRevoked: true, reason: null };
      },
      setAuthOrigin: async (origin) => {
        order.push(`auth:set-origin:${origin}`);
        return origin;
      },
    });
    try {
      await expectAccountState(settings, "signed-in");
      const select = settings.document.querySelector('select[data-testid="settings-environment"]');
      await vi.waitFor(() => expect(select?.value).toBe(PRODUCTION_ORIGIN));

      await React.act(async () => {
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        await Promise.resolve();
      });

      expect(settings.document.defaultView.confirm).toHaveBeenCalledOnce();
      expect(settings.document.defaultView.confirm.mock.calls[0][0]).toMatch(
        /Přepnout na labs[\s\S]*odhlásí z tohoto Macu[\s\S]*znovu přihlásit/u,
      );
      await vi.waitFor(() => expect(settings.ludone.setAuthOrigin).toHaveBeenCalledOnce());
      expect(order).toEqual([
        "auth:logout",
        `auth:set-origin:${ORIGIN}`,
      ]);
      expect(settings.ludone.logout.mock.calls[0]).toHaveLength(0);
      expect(settings.ludone.setAuthOrigin).toHaveBeenCalledExactlyOnceWith(ORIGIN);
      expect(select.value).toBe(ORIGIN);
      expect(settings.document.querySelector('[data-testid="settings-destination"]')?.dataset.origin)
        .toBe(ORIGIN);
      expect(settings.document.querySelector('[data-testid="settings-account"]')?.dataset.authState)
        .toBe("signed-out");
    } finally {
      await settings.cleanup();
    }
  });

  it("produkční přepnutí používá jedinou atomickou operaci", async () => {
    const switchAuthOrigin = vi.fn(async (origin) => ({
      signedOutLocally: true,
      serverRevoked: true,
      reason: null,
      origin,
    }));
    const settings = await renderSettings({
      origin: () => Promise.resolve(PRODUCTION_ORIGIN),
      switchAuthOrigin,
    });
    try {
      const select = settings.document.querySelector('select[data-testid="settings-environment"]');
      await vi.waitFor(() => expect(select?.value).toBe(PRODUCTION_ORIGIN));

      await React.act(async () => {
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        await Promise.resolve();
      });

      await vi.waitFor(() => {
        expect(settings.ludone.switchAuthOrigin).toHaveBeenCalledExactlyOnceWith(ORIGIN);
      });
      expect(settings.ludone.logout).not.toHaveBeenCalled();
      expect(settings.ludone.setAuthOrigin).not.toHaveBeenCalled();
      expect(select.value).toBe(ORIGIN);
    } finally {
      await settings.cleanup();
    }
  });

  it("bez potvrzení prostředí nezmění a ani neodhlásí", async () => {
    const settings = await renderSettings({
      confirmEnvironmentChange: () => false,
      origin: () => Promise.resolve(PRODUCTION_ORIGIN),
    });
    try {
      await expectAccountState(settings, "signed-in");
      const select = settings.document.querySelector('select[data-testid="settings-environment"]');
      await vi.waitFor(() => expect(select?.value).toBe(PRODUCTION_ORIGIN));

      await React.act(async () => {
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        await Promise.resolve();
      });

      expect(settings.document.defaultView.confirm).toHaveBeenCalledOnce();
      expect(settings.ludone.logout).not.toHaveBeenCalled();
      expect(settings.ludone.setAuthOrigin).not.toHaveBeenCalled();
      expect(select.value).toBe(PRODUCTION_ORIGIN);
    } finally {
      await settings.cleanup();
    }
  });

  it("neúspěšný logout znovu ověří souběžný falešný stav odhlášeno", async () => {
    const logoutGate = deferred();
    let identityCalls = 0;
    const settings = await renderSettings({
      identity: () => {
        identityCalls += 1;
        return Promise.resolve(identityCalls === 2
          ? null
          : { name: "Ada Lovelace", email: "ada@ludone.cz" });
      },
      logout: () => logoutGate.promise,
      origin: () => Promise.resolve(PRODUCTION_ORIGIN),
    });
    try {
      await expectAccountState(settings, "signed-in");
      const select = settings.document.querySelector('select[data-testid="settings-environment"]');
      await React.act(async () => {
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        await Promise.resolve();
      });
      await React.act(async () => {
        settings.document.defaultView.dispatchEvent(
          new settings.document.defaultView.Event("focus"),
        );
        await Promise.resolve();
      });
      await expectAccountState(settings, "signed-out");

      await React.act(async () => {
        logoutGate.resolve({ signedOutLocally: false, serverRevoked: false, reason: "offline" });
        await Promise.resolve();
      });

      await expectAccountState(settings, "signed-in");
      expect(settings.ludone.getAuthIdentity).toHaveBeenCalledTimes(3);
      expect(settings.ludone.setAuthOrigin).not.toHaveBeenCalled();
      expect(select.value).toBe(PRODUCTION_ORIGIN);
    } finally {
      await React.act(async () => {
        logoutGate.resolve({ signedOutLocally: false, serverRevoked: false, reason: "offline" });
        await Promise.resolve();
      });
      await settings.cleanup();
    }
  });

  it("neúspěšné lokální odhlášení nepřepne prostředí", async () => {
    const settings = await renderSettings({
      origin: () => Promise.resolve(PRODUCTION_ORIGIN),
      logout: () => Promise.resolve({
        signedOutLocally: false,
        serverRevoked: false,
        reason: "recording-active",
      }),
    });
    try {
      await expectAccountState(settings, "signed-in");
      const select = settings.document.querySelector('select[data-testid="settings-environment"]');
      await vi.waitFor(() => expect(select?.value).toBe(PRODUCTION_ORIGIN));

      await React.act(async () => {
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        await Promise.resolve();
      });

      await vi.waitFor(() => expect(settings.ludone.logout).toHaveBeenCalledOnce());
      expect(settings.ludone.setAuthOrigin).not.toHaveBeenCalled();
      expect(select.value).toBe(PRODUCTION_ORIGIN);
      await expectAccountState(settings, "signed-in");
      expect(settings.ludone.getAuthIdentity).toHaveBeenCalledTimes(2);
      expect(settings.document.body.textContent).toContain("Nejdřív ukonči nahrávání.");
    } finally {
      await settings.cleanup();
    }
  });

  it("odmítnutý logout netvrdí, že je Mac odhlášený", async () => {
    const settings = await renderSettings({
      origin: () => Promise.resolve(PRODUCTION_ORIGIN),
      logout: () => Promise.reject(new Error("IPC spojení skončilo")),
    });
    try {
      await expectAccountState(settings, "signed-in");
      const select = settings.document.querySelector('select[data-testid="settings-environment"]');
      await vi.waitFor(() => expect(select?.value).toBe(PRODUCTION_ORIGIN));

      await React.act(async () => {
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        await Promise.resolve();
      });

      await vi.waitFor(() => {
        expect(settings.document.querySelector('[data-testid="settings-environment-feedback"]')
          ?.textContent).toContain("Stav odhlášení není známý");
      });
      expect(settings.document.body.textContent).not.toContain(
        "Tento Mac je odhlášený, ale prostředí se nepodařilo změnit.",
      );
      expect(settings.ludone.setAuthOrigin).not.toHaveBeenCalled();
      expect(select.value).toBe(PRODUCTION_ORIGIN);
      await expectAccountState(settings, "signed-in");
      expect(settings.ludone.getAuthIdentity).toHaveBeenCalledTimes(2);
    } finally {
      await settings.cleanup();
    }
  });

  it("dvojitá změna před překreslením spustí jen jedno potvrzení a odhlášení", async () => {
    const logoutGate = deferred();
    const settings = await renderSettings({
      origin: () => Promise.resolve(PRODUCTION_ORIGIN),
      logout: () => logoutGate.promise,
    });
    try {
      const select = settings.document.querySelector('select[data-testid="settings-environment"]');
      await vi.waitFor(() => expect(select?.value).toBe(PRODUCTION_ORIGIN));

      await React.act(async () => {
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        await Promise.resolve();
      });

      expect(settings.document.defaultView.confirm).toHaveBeenCalledOnce();
      expect(settings.ludone.logout).toHaveBeenCalledOnce();
      await React.act(async () => {
        logoutGate.resolve({ signedOutLocally: true, serverRevoked: true, reason: null });
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(settings.ludone.setAuthOrigin).toHaveBeenCalledOnce());
    } finally {
      await React.act(async () => {
        logoutGate.resolve({ signedOutLocally: true, serverRevoked: true, reason: null });
        await Promise.resolve();
      });
      await settings.cleanup();
    }
  });

  it("během ručního odhlášení nespustí souběžné přepnutí prostředí", async () => {
    const logoutGate = deferred();
    const settings = await renderSettings({
      origin: () => Promise.resolve(PRODUCTION_ORIGIN),
      logout: () => logoutGate.promise,
    });
    try {
      const logoutButton = [...settings.document.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === "Odhlásit tento Mac");
      const select = settings.document.querySelector('select[data-testid="settings-environment"]');
      await vi.waitFor(() => expect(select?.value).toBe(PRODUCTION_ORIGIN));

      await React.act(async () => {
        logoutButton.click();
        await Promise.resolve();
      });
      await React.act(async () => {
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        await Promise.resolve();
      });

      expect(settings.ludone.logout).toHaveBeenCalledOnce();
      expect(settings.document.defaultView.confirm).not.toHaveBeenCalled();
      expect(settings.ludone.setAuthOrigin).not.toHaveBeenCalled();
      expect(select.disabled).toBe(true);
    } finally {
      await React.act(async () => {
        logoutGate.resolve({ signedOutLocally: true, serverRevoked: true, reason: null });
        await Promise.resolve();
      });
      await settings.cleanup();
    }
  });

  it("při LUDONE_ORIGIN override ukáže efektivní prostředí a změnu nehlásí jako úspěch", async () => {
    const settings = await renderSettings({
      origin: () => Promise.resolve(PRODUCTION_ORIGIN),
      setAuthOrigin: () => Promise.resolve(PRODUCTION_ORIGIN),
    });
    try {
      const select = settings.document.querySelector('select[data-testid="settings-environment"]');
      await vi.waitFor(() => expect(select?.value).toBe(PRODUCTION_ORIGIN));

      await React.act(async () => {
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        await Promise.resolve();
      });

      await vi.waitFor(() => {
        expect(settings.document.querySelector('[data-testid="settings-environment-feedback"]')
          ?.textContent).toContain("LUDONE_ORIGIN");
      });
      expect(select.value).toBe(PRODUCTION_ORIGIN);
      expect(settings.document.querySelector('[data-testid="settings-destination"]')?.dataset.origin)
        .toBe(PRODUCTION_ORIGIN);
      expect(settings.document.querySelector('[data-testid="settings-environment-feedback"]')
        ?.getAttribute("role")).toBe("alert");
    } finally {
      await settings.cleanup();
    }
  });

  it("pozdní odpověď identity po přepnutí nevrátí starý účet", async () => {
    const staleIdentity = deferred();
    let identityCalls = 0;
    const settings = await renderSettings({
      identity: () => {
        identityCalls += 1;
        return identityCalls === 1
          ? Promise.resolve({ name: "Ada Lovelace", email: "ada@ludone.cz" })
          : staleIdentity.promise;
      },
      origin: () => Promise.resolve(PRODUCTION_ORIGIN),
    });
    try {
      await expectAccountState(settings, "signed-in");
      await React.act(async () => {
        settings.document.defaultView.dispatchEvent(
          new settings.document.defaultView.Event("focus"),
        );
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(settings.ludone.getAuthIdentity).toHaveBeenCalledTimes(2));

      const select = settings.document.querySelector('select[data-testid="settings-environment"]');
      await React.act(async () => {
        select.value = ORIGIN;
        select.dispatchEvent(new settings.document.defaultView.Event("change", { bubbles: true }));
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(settings.ludone.setAuthOrigin).toHaveBeenCalledOnce());
      staleIdentity.resolve({ name: "Ada Lovelace", email: "ada@ludone.cz" });
      await React.act(async () => { await Promise.resolve(); });

      expect(settings.document.querySelector('[data-testid="settings-account"]')?.dataset.authState)
        .toBe("signed-out");
    } finally {
      staleIdentity.resolve(null);
      await settings.cleanup();
    }
  });

  it("v Diagnostice ukáže verzi, architekturu, oba stavy oprávnění a doložené spojení", async () => {
    const settings = await renderSettings();
    try {
      await selectTab(settings, "Diagnostika");
      await vi.waitFor(() => expect(settings.ludone.getDiagnostics).toHaveBeenCalledOnce());

      expect(settings.document.querySelector('[data-testid="diagnostics-version"]')?.textContent)
        .toBe("9.8.7");
      expect(settings.document.querySelector('[data-testid="diagnostics-architecture"]')?.textContent)
        .toBe("Apple Silicon");
      expect(settings.document.querySelector('[data-testid="diagnostics-microphone"]')?.textContent)
        .toBe("Povoleno");
      expect(settings.document.querySelector('[data-testid="diagnostics-microphone"]')?.dataset.status)
        .toBe("granted");
      expect(settings.document.querySelector('[data-testid="diagnostics-system-audio"]')?.textContent)
        .toBe("Nepovoleno");
      expect(settings.document.querySelector('[data-testid="diagnostics-system-audio"]')?.dataset.status)
        .toBe("denied");
      const serverText = settings.document.querySelector('[data-testid="diagnostics-server"]')
        ?.textContent;
      expect(serverText).toMatch(/^Poslední potvrzené odeslání: .*2026.*\d{2}:\d{2}$/u);
      expect(settings.document.querySelector('[data-testid="diagnostics-server"] svg')).toBeNull();
    } finally {
      await settings.cleanup();
    }
  });

  it("export spouští bez rendererového payloadu a nevykreslí podstrčená citlivá pole", async () => {
    const secretDiagnostics = {
      ...DIAGNOSTICS,
      accessToken: "Bearer TAJNY-TOKEN",
      meetingTitle: "TAJNÁ SCHŮZKA",
      filePath: "/Users/dan/Tajna-schuzka.webm",
      audio: "BASE64-ZVUK",
    };
    const settings = await renderSettings({ diagnostics: () => Promise.resolve(secretDiagnostics) });
    try {
      await selectTab(settings, "Diagnostika");
      await vi.waitFor(() => expect(settings.ludone.getDiagnostics).toHaveBeenCalledOnce());
      expect(settings.document.body.textContent).not.toMatch(
        /TAJNY-TOKEN|TAJNÁ SCHŮZKA|\/Users\/dan|BASE64-ZVUK/u,
      );

      const exportButton = [...settings.document.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === "Exportovat diagnostiku");
      expect(exportButton).not.toBeNull();
      await React.act(async () => {
        exportButton.click();
        await Promise.resolve();
      });

      expect(settings.ludone.exportDiagnostics).toHaveBeenCalledOnce();
      expect(settings.ludone.exportDiagnostics.mock.calls[0]).toHaveLength(0);
      await vi.waitFor(() => {
        expect(settings.document.body.textContent)
          .toContain("ludone-diagnostika-2026-09-03-130500.txt");
      });
      expect(settings.document.body.textContent).not.toContain("/Users/dan");
    } finally {
      await settings.cleanup();
    }
  });

  it("při vadných počtech fronty nevymýšlí nulu", async () => {
    const malformedDiagnostics = /** @type {any} */ ({
      ...DIAGNOSTICS,
      queue: { available: true, waiting: "2", sending: 0, failed: 0 },
    });
    const settings = await renderSettings({
      diagnostics: () => Promise.resolve(malformedDiagnostics),
    });
    try {
      await selectTab(settings, "Záznamy");
      await vi.waitFor(() => {
        expect(settings.document.querySelector('[data-testid="settings-queue-summary"]')?.textContent)
          .toContain("Stav fronty není dostupný");
      });
      expect(settings.document.body.textContent).not.toContain("Nic nečeká");
    } finally {
      await settings.cleanup();
    }
  });
});

describe("pravdivá identita v Nastavení", () => {
  it("vykreslí skutečné jméno, e-mail, odvozený avatar a nakonfigurovaný origin", async () => {
    const settings = await renderSettings();
    try {
      await expectAccountState(settings, "signed-in");
      await vi.waitFor(() => {
        expect(settings.document.querySelector('[data-testid="settings-destination"]')?.dataset.origin)
          .toBe(ORIGIN);
      });
      expect(settings.document.querySelector('[data-testid="settings-destination"] strong')?.textContent)
        .toBe(ORIGIN);

      expect(settings.document.querySelector('[data-testid="settings-identity-name"]')?.textContent)
        .toBe("Ada Lovelace");
      expect(settings.document.querySelector('[data-testid="settings-identity-email"]')?.textContent)
        .toBe("ada@ludone.cz");
      expect(settings.document.querySelector('[data-testid="settings-avatar"]')?.textContent)
        .toBe("AL");
      expect(settings.document.querySelector(".connected")).not.toBeNull();
      expect(settings.ludone.getAuthIdentity).toHaveBeenCalledOnce();
      expect(settings.ludone.getAuthOrigin).toHaveBeenCalledOnce();
      expect(settings.ludone.beginAuth).not.toHaveBeenCalled();
      expect(settings.localStorage.setItem).not.toHaveBeenCalled();
      expectNoDesignFiction(settings);
    } finally {
      await settings.cleanup();
    }
  });

  it("bez jména použije e-mail a avatar odvodí z něj", async () => {
    const settings = await renderSettings({
      identity: () => Promise.resolve({ name: null, email: "alice@example.cz" }),
    });
    try {
      await expectAccountState(settings, "signed-in");

      expect(settings.document.querySelector('[data-testid="settings-identity-name"]')?.textContent)
        .toBe("alice@example.cz");
      expect(settings.document.querySelector('[data-testid="settings-identity-email"]')).toBeNull();
      expect(settings.document.querySelector('[data-testid="settings-avatar"]')?.textContent)
        .toBe("A");
      expectNoDesignFiction(settings);
    } finally {
      await settings.cleanup();
    }
  });

  it("bez session ukáže nepřihlášený stav a nikdy připojení", async () => {
    const settings = await renderSettings({ identity: () => Promise.resolve(null) });
    try {
      await expectAccountState(settings, "signed-out");

      expectVisibleStatus(settings);
      expect(settings.document.querySelector(".connected")).toBeNull();
      expect(settings.document.querySelector('[data-testid="settings-avatar"]')).toBeNull();
      expectNoDesignFiction(settings);
    } finally {
      await settings.cleanup();
    }
  });

  it("chybu při čtení identity ukáže jako neznámý stav", async () => {
    const settings = await renderSettings({
      identity: () => Promise.reject(new Error("Úložiště identity neodpovídá")),
    });
    try {
      await expectAccountState(settings, "unknown");

      expectVisibleStatus(settings);
      expect(settings.document.querySelector(".connected")).toBeNull();
      expectNoDesignFiction(settings);
    } finally {
      await settings.cleanup();
    }
  });

  it("během čekání na identitu zůstane v neznámém stavu", async () => {
    const settings = await renderSettings({ identity: () => new Promise(() => {}) });
    try {
      await expectAccountState(settings, "unknown");

      expectVisibleStatus(settings);
      expect(settings.document.querySelector(".connected")).toBeNull();
      expectNoDesignFiction(settings);
    } finally {
      await settings.cleanup();
    }
  });

  it("chybu konfigurace cíle nepřekryje zadrátovanou adresou", async () => {
    const settings = await renderSettings({
      origin: () => Promise.reject(new Error("Neplatná konfigurace")),
    });
    try {
      await vi.waitFor(() => {
        expect(settings.document.querySelector('[data-testid="settings-destination"]')?.dataset.destinationState)
          .toBe("unknown");
      });

      expect(settings.document.querySelector('[data-testid="settings-destination"]')?.dataset.origin)
        .toBeUndefined();
      const visibleDestination = settings.document
        .querySelector('[data-testid="settings-destination"] strong')?.textContent.trim();
      expect(visibleDestination).toBeTruthy();
      expect(visibleDestination).not.toMatch(/^https?:/u);
      expectNoDesignFiction(settings);
    } finally {
      await settings.cleanup();
    }
  });

  it("doslovnou atrapu undefined nepoužije jako jméno", async () => {
    const settings = await renderSettings({
      identity: () => Promise.resolve({ name: "undefined", email: "alice@example.cz" }),
    });
    try {
      await expectAccountState(settings, "signed-in");

      expect(settings.document.querySelector('[data-testid="settings-identity-name"]')?.textContent)
        .toBe("alice@example.cz");
      expect(settings.document.querySelector('[data-testid="settings-identity-email"]')).toBeNull();
      expectNoDesignFiction(settings);
    } finally {
      await settings.cleanup();
    }
  });

  it("zjevně neplatný e-mail nestačí k tvrzení, že je účet připojený", async () => {
    const settings = await renderSettings({
      identity: () => Promise.resolve({ name: "Ada Lovelace", email: "neni-email" }),
    });
    try {
      await expectAccountState(settings, "unknown");

      expectVisibleStatus(settings);
      expect(settings.document.querySelector(".connected")).toBeNull();
      expectNoDesignFiction(settings);
    } finally {
      await settings.cleanup();
    }
  });

  it("po opětovném zaostření znovu ověří session a nenechá připojený starý účet", async () => {
    const identity = vi.fn()
      .mockResolvedValueOnce({ name: "Ada Lovelace", email: "ada@ludone.cz" })
      .mockResolvedValueOnce(null);
    const settings = await renderSettings({ identity });
    try {
      await expectAccountState(settings, "signed-in");

      await React.act(async () => {
        settings.document.defaultView.dispatchEvent(new settings.document.defaultView.Event("focus"));
      });
      await expectAccountState(settings, "signed-out");

      expect(settings.ludone.getAuthIdentity).toHaveBeenCalledTimes(2);
      expect(settings.document.querySelector(".connected")).toBeNull();
      expectNoDesignFiction(settings);
    } finally {
      await settings.cleanup();
    }
  });

  it("pomalejší stará odpověď nepřepíše novější stav session", async () => {
    const firstIdentity = deferred();
    const identity = vi.fn()
      .mockReturnValueOnce(firstIdentity.promise)
      .mockResolvedValueOnce(null);
    const settings = await renderSettings({ identity });
    try {
      await React.act(async () => {
        settings.document.defaultView.dispatchEvent(new settings.document.defaultView.Event("focus"));
      });
      await expectAccountState(settings, "signed-out");

      await React.act(async () => {
        firstIdentity.resolve({ name: "Starý účet", email: "stary@example.cz" });
        await Promise.resolve();
      });

      expect(settings.document.querySelector('[data-testid="settings-account"]')?.dataset.authState)
        .toBe("signed-out");
      expect(settings.document.body.textContent).not.toContain("Starý účet");
      expectNoDesignFiction(settings);
    } finally {
      await settings.cleanup();
    }
  });
});

describe("systémová nastavení", () => {
  const DOCK_LABEL = "Zobrazovat i ikonu v Docku";
  const LOGIN_LABEL = "Spouštět po přihlášení do systému";

  function switchByLabel(settings, label) {
    return settings.document.querySelector(`button[role="switch"][aria-label="${label}"]`);
  }

  it("vykreslí doslovné texty a načte oba skutečné stavy z hlavního procesu", async () => {
    const settings = await renderSettings({
      dockVisible: () => Promise.resolve(false),
      openAtLogin: () => Promise.resolve(true),
    });
    try {
      await vi.waitFor(() => {
        expect(switchByLabel(settings, DOCK_LABEL)?.getAttribute("aria-checked")).toBe("false");
        expect(switchByLabel(settings, LOGIN_LABEL)?.getAttribute("aria-checked")).toBe("true");
      });

      expect(settings.document.body.textContent).toContain(DOCK_LABEL);
      expect(settings.document.body.textContent).toContain(
        "Zapni, když se ti ikona v liště schovává za notch nebo za jinou aplikaci.",
      );
      expect(settings.document.body.textContent).toContain(LOGIN_LABEL);
      expect(settings.ludone.getDockVisible).toHaveBeenCalledOnce();
      expect(settings.ludone.getOpenAtLogin).toHaveBeenCalledOnce();
      expect(settings.localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      await settings.cleanup();
    }
  });

  it("vykreslí i opačnou kombinaci skutečných boolean stavů", async () => {
    const settings = await renderSettings({
      dockVisible: () => Promise.resolve(true),
      openAtLogin: () => Promise.resolve(false),
    });
    try {
      await vi.waitFor(() => {
        expect(switchByLabel(settings, DOCK_LABEL)?.getAttribute("aria-checked")).toBe("true");
        expect(switchByLabel(settings, LOGIN_LABEL)?.getAttribute("aria-checked")).toBe("false");
      });
      expect(settings.localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      await settings.cleanup();
    }
  });

  it("kliknutí oba přepínače uplatní hned přes boolean API bez kopie v localStorage", async () => {
    const settings = await renderSettings();
    try {
      await vi.waitFor(() => {
        expect(switchByLabel(settings, DOCK_LABEL)?.disabled).toBe(false);
        expect(switchByLabel(settings, LOGIN_LABEL)?.disabled).toBe(false);
      });

      await React.act(async () => {
        switchByLabel(settings, DOCK_LABEL).click();
        await Promise.resolve();
      });
      expect(settings.ludone.setDockVisible).toHaveBeenCalledWith(true);
      expect(settings.ludone.setDockVisible.mock.calls[0]).toHaveLength(1);
      expect(switchByLabel(settings, DOCK_LABEL).getAttribute("aria-checked")).toBe("true");

      await React.act(async () => {
        switchByLabel(settings, LOGIN_LABEL).click();
        await Promise.resolve();
      });
      expect(settings.ludone.setOpenAtLogin).toHaveBeenCalledWith(false);
      expect(settings.ludone.setOpenAtLogin.mock.calls[0]).toHaveLength(1);
      expect(switchByLabel(settings, LOGIN_LABEL).getAttribute("aria-checked")).toBe("false");
      expect(settings.localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      await settings.cleanup();
    }
  });
});
