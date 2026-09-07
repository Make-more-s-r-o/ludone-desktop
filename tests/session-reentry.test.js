import * as React from "react";
import { readFileSync } from "node:fs";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { App } from "../src/App.jsx";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { SettingsApp } from "../src/components/Settings.jsx";

const USER = { name: "Ada Lovelace", email: "ada@ludone.cz" };
const PRODUCTION_ORIGIN = "https://app.ludone.cz";
const LABS_ORIGIN = "https://labs.ludone.cz";
const mounted = [];

function buttonWithText(document, text) {
  return [...document.querySelectorAll("button")]
    .find((button) => button.textContent.trim() === text);
}

async function click(element, view) {
  expect(element).toBeDefined();
  await React.act(async () => {
    element.dispatchEvent(new view.MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

/**
 * @param {{
 *   beginAuth?: () => Promise<{
 *     ok: boolean,
 *     duvod?: string,
 *     user?: { name: string, email: string },
 *   }>,
 *   beginAuthResult?: {
 *     ok: boolean,
 *     duvod?: string,
 *     user?: { name: string, email: string },
 *   },
 *   initialOrigin?: string,
 *   initialSession?: boolean,
 *   hasAuthSession?: () => Promise<boolean>,
 *   getAuthSessionState?: () => Promise<string>,
 *   switchAuthOrigin?: (nextOrigin: string) => Promise<{
 *     signedOutLocally: boolean,
 *     serverRevoked: boolean,
 *     reason: string | null,
 *     origin: string | null,
 *   }>,
 *   withSettings?: boolean,
 * }} [options]
 */
async function renderWindows({
  beginAuth: beginAuthImplementation,
  beginAuthResult = { ok: false, duvod: "bez-site" },
  hasAuthSession: hasAuthSessionImplementation,
  getAuthSessionState,
  initialOrigin = PRODUCTION_ORIGIN,
  initialSession = false,
  switchAuthOrigin: switchAuthOriginImplementation,
  withSettings = false,
} = {}) {
  const dom = new JSDOM(
    '<div id="panel-root"></div><div id="settings-root"></div>',
    { url: "https://ludone.test" },
  );
  dom.window.localStorage.setItem("ludone.prototype.onboarding-complete", "true");

  let authOrigin = initialOrigin;
  let sessionExists = initialSession;
  const authSessionSubscribers = new Set();
  const trayCommandSubscribers = new Set();
  const beginAuth = vi.fn(async () => {
    const result = beginAuthImplementation
      ? await beginAuthImplementation()
      : beginAuthResult;
    if (result?.ok === true) sessionExists = true;
    return result;
  });
  const logout = vi.fn(async () => {
    sessionExists = false;
    for (const subscriber of [...authSessionSubscribers]) subscriber();
    return { signedOutLocally: true, serverRevoked: true, reason: null };
  });
  const setAuthOrigin = vi.fn(async (nextOrigin) => {
    authOrigin = nextOrigin;
    return authOrigin;
  });
  const switchAuthOrigin = vi.fn(async (nextOrigin) => {
    if (switchAuthOriginImplementation) return switchAuthOriginImplementation(nextOrigin);
    sessionExists = false;
    authOrigin = nextOrigin;
    for (const subscriber of [...authSessionSubscribers]) subscriber();
    return {
      signedOutLocally: true,
      serverRevoked: true,
      reason: null,
      origin: authOrigin,
    };
  });
  const ludone = {
    ...(getAuthSessionState ? { getAuthSessionState } : {}),
    runtime: { resetOnboarding: false },
    beginAuth,
    cancelAuth: vi.fn().mockResolvedValue({ ok: true, cancelled: 1 }),
    pendingAuthUrl: vi.fn().mockResolvedValue(null),
    hasAuthSession: vi.fn(() => (
      hasAuthSessionImplementation ? hasAuthSessionImplementation() : Promise.resolve(sessionExists)
    )),
    onAuthSessionChanged: vi.fn((subscriber) => {
      authSessionSubscribers.add(subscriber);
      return () => authSessionSubscribers.delete(subscriber);
    }),
    reportTrayFacts: vi.fn(),
    onTrayCommand: vi.fn((subscriber) => {
      trayCommandSubscribers.add(subscriber);
      return () => trayCommandSubscribers.delete(subscriber);
    }),
    listQueue: vi.fn().mockResolvedValue([]),
    openSettings: vi.fn(),
    requestPermission: vi.fn(),
    getAuthIdentity: vi.fn(async () => (sessionExists ? USER : null)),
    getAuthOrigin: vi.fn(async () => authOrigin),
    setAuthOrigin,
    switchAuthOrigin,
    logout,
    getDeviceName: vi.fn().mockResolvedValue("MacBook-Test"),
    getDiagnostics: vi.fn().mockResolvedValue(null),
    getDockVisible: vi.fn().mockResolvedValue(false),
    setDockVisible: vi.fn(async (value) => value),
    getOpenAtLogin: vi.fn().mockResolvedValue(false),
    setOpenAtLogin: vi.fn(async (value) => value),
    exportDiagnostics: vi.fn(),
    closeSettings: vi.fn(),
  };
  Object.defineProperty(dom.window, "ludone", { configurable: true, value: ludone });
  Object.defineProperty(dom.window, "confirm", {
    configurable: true,
    value: vi.fn(() => true),
  });

  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("navigator", dom.window.navigator);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const panelRoot = createRoot(dom.window.document.querySelector("#panel-root"));
  const settingsRoot = withSettings
    ? createRoot(dom.window.document.querySelector("#settings-root"))
    : null;
  await React.act(async () => {
    panelRoot.render(React.createElement(App));
    settingsRoot?.render(React.createElement(SettingsApp));
  });

  const rendered = {
    document: dom.window.document,
    ludone,
    view: dom.window,
    emitTrayCommand(command) {
      for (const subscriber of [...trayCommandSubscribers]) subscriber(command);
    },
    async cleanup() {
      await React.act(async () => {
        panelRoot.unmount();
        settingsRoot?.unmount();
      });
      dom.window.close();
    },
  };
  mounted.push(rendered);
  return rendered;
}

async function waitForSignedIn(panel) {
  await vi.waitFor(() => {
    expect(panel.document.querySelector(".panel-header small")?.dataset.authState)
      .toBe("signed-in");
  });
}

async function waitForReauthentication(panel) {
  await vi.waitFor(() => {
    expect(panel.document.querySelector(".auth-step h1")?.textContent.trim())
      .toBe("Nejsi připojený");
  });
}

afterEach(async () => {
  while (mounted.length > 0) await mounted.pop().cleanup();
  vi.unstubAllGlobals();
});

describe("návrat do aplikace po ztrátě session", () => {
  it("po dokončeném onboardingu a bez session nabídne jediný přihlašovací krok", async () => {
    const panel = await renderWindows();

    await waitForReauthentication(panel);
    expect(panel.document.querySelector(".welcome-step")).toBeNull();
    expect(panel.document.querySelector(".permission-step")).toBeNull();
    expect(panel.document.querySelector(".step-count")).toBeNull();
    expect(panel.document.querySelector(".step-track")).toBeNull();
    expect(buttonWithText(panel.document, "Zpět")).toBeUndefined();
    const loginButton = buttonWithText(panel.document, "Přihlásit v prohlížeči");
    expect(loginButton, "odhlášený panel nemá cestu k přihlášení").toBeDefined();

    await click(loginButton, panel.view);
    expect(panel.ludone.beginAuth).toHaveBeenCalledOnce();
  });

  it.each([
    ["odhlášení v Nastavení", "logout"],
    ["přepnutí prostředí", "environment"],
  ])("po akci %s živý panel přestane tvrdit Přihlášeno", async (_label, action) => {
    const panel = await renderWindows({ initialSession: true, withSettings: true });
    await waitForSignedIn(panel);
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[data-testid="settings-account"]')?.dataset.authState)
        .toBe("signed-in");
    });

    if (action === "logout") {
      await click(buttonWithText(panel.document, "Odhlásit tento Mac"), panel.view);
    } else {
      const environment = panel.document.querySelector(
        'select[data-testid="settings-environment"]',
      );
      await vi.waitFor(() => expect(environment?.value).toBe(PRODUCTION_ORIGIN));
      await React.act(async () => {
        environment.value = LABS_ORIGIN;
        environment.dispatchEvent(new panel.view.Event("change", { bubbles: true }));
        await Promise.resolve();
      });
    }

    await waitForReauthentication(panel);
    expect(panel.document.querySelector('[data-auth-state="signed-in"]')).toBeNull();
    expect(panel.document.querySelector("#panel-root")?.textContent).not.toContain("Přihlášeno");
    expect(panel.ludone.hasAuthSession.mock.calls.length).toBeGreaterThan(1);
    if (action === "environment") {
      await vi.waitFor(() => {
        expect(panel.ludone.switchAuthOrigin).toHaveBeenCalledExactlyOnceWith(LABS_ORIGIN);
      });
    }
  });

  it("během první kontroly session nenabízí anonymní akce", async () => {
    const sessionCheck = new Promise(() => {});
    const panel = await renderWindows({ hasAuthSession: () => sessionCheck });

    expect(panel.document.querySelectorAll('[data-testid="idle-action-row"]')).toHaveLength(0);
    expect(panel.document.querySelector('[aria-label="Spustit nahrávání"]')).toBeNull();
    expect(panel.document.querySelector('[aria-label="Spustit LuTrack"]')).toBeNull();
  });

  it("příkaz z lišty během znovupřihlášení se po přihlášení neprovede opožděně", async () => {
    const panel = await renderWindows({
      beginAuthResult: { ok: true, user: USER },
    });
    await waitForReauthentication(panel);

    await React.act(async () => {
      panel.emitTrayCommand("start-tracking");
      await Promise.resolve();
    });
    await click(buttonWithText(panel.document, "Přihlásit v prohlížeči"), panel.view);
    await waitForSignedIn(panel);

    expect(panel.document.querySelector('[data-testid="tracking-running-state"]')).toBeNull();
    expect(panel.document.querySelector('[aria-label="Spustit LuTrack"]')).not.toBeNull();
  });

  it("starý příkaz z lišty se po odhlášení a novém přihlášení neopakuje", async () => {
    const panel = await renderWindows({
      beginAuthResult: { ok: true, user: USER },
      initialSession: true,
      withSettings: true,
    });
    await waitForSignedIn(panel);

    await React.act(async () => {
      panel.emitTrayCommand("start-tracking");
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[data-testid="tracking-running-state"]')).not.toBeNull();
    });
    await click(panel.document.querySelector('[aria-label="Zastavit LuTrack"]'), panel.view);
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[aria-label="Spustit LuTrack"]')).not.toBeNull();
    });

    await click(buttonWithText(panel.document, "Odhlásit tento Mac"), panel.view);
    await waitForReauthentication(panel);
    await click(buttonWithText(panel.document, "Přihlásit v prohlížeči"), panel.view);
    await waitForSignedIn(panel);

    expect(panel.document.querySelector('[data-testid="tracking-running-state"]')).toBeNull();
    expect(panel.document.querySelector('[aria-label="Spustit LuTrack"]')).not.toBeNull();
  });

  it("návrat fokusu během čekání nepřeruší rozpracované znovupřihlášení", async () => {
    /** @type {(result: {ok: boolean, user: typeof USER}) => void} */
    let finishAuth = () => {};
    const authPending = new Promise((resolve) => { finishAuth = resolve; });
    const panel = await renderWindows({ beginAuth: () => authPending });
    await waitForReauthentication(panel);
    expect(panel.ludone.hasAuthSession).toHaveBeenCalledOnce();

    await click(buttonWithText(panel.document, "Přihlásit v prohlížeči"), panel.view);
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[data-testid="auth-waiting-screen"]')).not.toBeNull();
    });
    await React.act(async () => {
      panel.view.dispatchEvent(new panel.view.Event("focus"));
      await Promise.resolve();
    });

    expect(panel.document.querySelector('[data-testid="auth-waiting-screen"]')).not.toBeNull();
    expect(panel.ludone.hasAuthSession).toHaveBeenCalledOnce();
    expect(panel.ludone.cancelAuth).not.toHaveBeenCalled();

    await React.act(async () => {
      finishAuth({ ok: true, user: USER });
      await authPending;
    });
    await waitForSignedIn(panel);
    expect(panel.ludone.cancelAuth).not.toHaveBeenCalled();
  });

  it("po znovupřihlášení vrátí funkční panel a neopakuje onboarding", async () => {
    const panel = await renderWindows({
      beginAuthResult: { ok: true, user: USER },
    });
    await waitForReauthentication(panel);

    await click(buttonWithText(panel.document, "Přihlásit v prohlížeči"), panel.view);
    await waitForSignedIn(panel);

    expect([...panel.document.querySelectorAll('[data-testid="idle-action-row"] strong')]
      .map((element) => element.textContent.trim())).toEqual(["Nahrávání", "LuTrack"]);
    expect(panel.document.querySelector(".onboarding")).toBeNull();
    expect(panel.document.querySelector(".permission-step")).toBeNull();
    expect(panel.ludone.requestPermission).not.toHaveBeenCalled();

    await click(panel.document.querySelector('[aria-label="Spustit LuTrack"]'), panel.view);
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[data-testid="tracking-running-state"]')).not.toBeNull();
    });
    await click(panel.document.querySelector('[aria-label="Zastavit LuTrack"]'), panel.view);
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[aria-label="Spustit LuTrack"]')).not.toBeNull();
    });
  });

  it("s platnou session zachová dosavadní panel beze změny", async () => {
    const panel = await renderWindows({ initialSession: true });
    await waitForSignedIn(panel);

    expect([...panel.document.querySelectorAll('[data-testid="idle-action-row"] strong')]
      .map((element) => element.textContent.trim())).toEqual(["Nahrávání", "LuTrack"]);
    expect(panel.document.querySelector(".onboarding")).toBeNull();
    expect(panel.ludone.beginAuth).not.toHaveBeenCalled();
  });
});

describe("oznámení změny session mezi okny", () => {
  it("otevřená okna zjistí vypršení bez změny fokusu a panel nabídne nové přihlášení", async () => {
    let state = "valid";
    const panel = await renderWindows({
      initialSession: true,
      withSettings: true,
      getAuthSessionState: async () => state,
      beginAuth: async () => {
        state = "valid";
        return { ok: true, user: USER };
      },
    });
    await waitForSignedIn(panel);
    state = "expired";
    // Interval běží v otevřených oknech; neposíláme focus ani oznámení z main.
    await React.act(async () => {
      await new Promise((resolve) => panel.view.setTimeout(resolve, 1_100));
    });
    expect(panel.document.querySelector('#panel-root [data-auth-state="signed-in"]')).toBeNull();
    expect(panel.document.querySelector('[data-testid="auth-error-message"]')?.textContent)
      .toContain("Platnost přihlášení skončila");
    expect(panel.document.querySelector('[data-testid="settings-account-status"]')?.textContent)
      .toBe("Přihlášení vypršelo");
    await click(buttonWithText(panel.document, "Přihlásit se znovu"), panel.view);
    await waitForSignedIn(panel);
    expect(panel.ludone.beginAuth).toHaveBeenCalledOnce();
    expect(panel.ludone.logout).not.toHaveBeenCalled();
    expect(panel.ludone.cancelAuth).not.toHaveBeenCalled();
  });

  it("používá existující validovaný session kanál jako probuzení bez dat", () => {
    const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
    const preloadSource = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");
    const logoutStart = mainSource.indexOf('handleValidated("auth:logout"');
    const logoutEnd = mainSource.indexOf('\nhandleValidated("permission:request"', logoutStart);
    const logoutBlock = mainSource.slice(logoutStart, logoutEnd);

    expect(preloadSource).toContain("onAuthSessionChanged");
    expect(preloadSource).toMatch(/ipcRenderer\.on\(AUTH_SESSION_STATUS_CHANNEL,/u);
    expect(mainSource).toMatch(
      /handleValidated\(AUTH_SESSION_STATUS_CHANNEL,\s*\["panel"\]/u,
    );
    expect(mainSource).toMatch(
      /runAuthSessionTransition[\s\S]*notifyPanelAuthSessionChanged\(\)[\s\S]*operation\(\)[\s\S]*notifyPanelAuthSessionChanged\(\)/u,
    );
    expect(logoutBlock).toContain("runAuthSessionTransition(executeAuthLogout)");
  });
});
