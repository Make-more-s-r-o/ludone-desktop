import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { SettingsApp } from "../src/components/Settings.jsx";

const ORIGIN = "https://labs.ludone.cz";

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

async function renderSettings({
  dockVisible = () => Promise.resolve(false),
  identity = () => Promise.resolve({ name: "Ada Lovelace", email: "ada@ludone.cz" }),
  openAtLogin = () => Promise.resolve(true),
  origin = () => Promise.resolve(ORIGIN),
  setDockVisible = (value) => Promise.resolve(value),
  setOpenAtLogin = (value) => Promise.resolve(value),
} = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  };
  const ludone = {
    beginAuth: vi.fn(),
    closeSettings: vi.fn(),
    getAuthIdentity: vi.fn(identity),
    getAuthOrigin: vi.fn(origin),
    getDockVisible: vi.fn(dockVisible),
    getOpenAtLogin: vi.fn(openAtLogin),
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
