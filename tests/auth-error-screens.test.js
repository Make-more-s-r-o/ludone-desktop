import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { Onboarding } from "../src/components/Onboarding.jsx";

const REASONS = [
  ["vyprselo", "expired", "retry"],
  ["odmitnuto", "access", "switch-account"],
  ["uloziste", "generic", "retry"],
  ["konfigurace", "generic", "retry"],
  ["bez-site", "offline", "retry"],
  ["neznama", "generic", "retry"],
];

const mountedRoots = [];

async function click(element, view) {
  await React.act(async () => {
    element.dispatchEvent(new view.MouseEvent("click", { bubbles: true }));
  });
}

async function renderAuthFailure(reason, nextResult) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const beginAuth = vi.fn()
    .mockResolvedValueOnce({ ok: false, duvod: reason });
  if (nextResult) beginAuth.mockResolvedValueOnce(nextResult);

  Object.defineProperty(dom.window, "ludone", {
    value: { beginAuth },
  });

  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("navigator", dom.window.navigator);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const root = createRoot(dom.window.document.querySelector("#root"));
  mountedRoots.push({ dom, root });
  await React.act(async () => {
    root.render(React.createElement(Onboarding, {
      onAuthenticated: vi.fn(),
      onComplete: vi.fn(),
    }));
  });

  await click(dom.window.document.querySelector(".welcome-step .button--wide"), dom.window);
  await click(dom.window.document.querySelector(".auth-step .button--wide"), dom.window);

  return { beginAuth, document: dom.window.document, view: dom.window };
}

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const { dom, root } = mountedRoots.pop();
    await React.act(async () => root.unmount());
    dom.window.close();
  }
  vi.unstubAllGlobals();
});

describe("chybové obrazovky přihlášení", () => {
  it("žádný z šesti důvodů nenechá panel prázdný", async () => {
    for (const [reason, expectedState, expectedAction] of REASONS) {
      const panel = await renderAuthFailure(reason);
      const screen = panel.document.querySelector('[data-testid="auth-error-screen"]');
      const action = screen?.querySelector('[data-testid="auth-error-action"]');

      expect(screen, reason).not.toBeNull();
      expect(screen.dataset.authErrorState, reason).toBe(expectedState);
      expect(screen.querySelector('[data-testid="auth-error-message"]')?.textContent.trim(), reason)
        .toBeTruthy();
      expect(action?.dataset.authErrorActionKind, reason).toBe(expectedAction);
      expect(action?.disabled, reason).toBe(false);
    }
  });

  it("oznámí chybu bez ztráty hlavního landmarku a přesune fokus na akci", async () => {
    const panel = await renderAuthFailure("vyprselo");
    const screen = panel.document.querySelector('[data-testid="auth-error-screen"]');
    const announcement = panel.document.querySelector('[data-testid="auth-error-announcement"]');
    const action = panel.document.querySelector('[data-testid="auth-error-action"]');

    expect(screen.tagName).toBe("MAIN");
    expect(screen.getAttribute("role")).toBeNull();
    expect(announcement?.getAttribute("role")).toBe("alert");
    expect(announcement?.contains(action)).toBe(false);
    expect(panel.document.activeElement).toBe(action);
  });

  it("vypršení ukáže rozbalený seznam možných příčin", async () => {
    const panel = await renderAuthFailure("vyprselo");
    const details = panel.document.querySelector('[data-testid="auth-error-details"]');

    expect(details).not.toBeNull();
    expect(details.hidden).toBe(false);
    expect(details.querySelectorAll("li")).toHaveLength(3);
  });

  it("odmítnutý přístup ukáže samostatnou radu pro správce", async () => {
    const panel = await renderAuthFailure("odmitnuto");
    const guidance = panel.document.querySelector('[data-testid="auth-admin-guidance"]');

    expect(guidance?.textContent.trim()).toBeTruthy();
  });

  it("stav bez sítě výslovně zachová pokračování lokální práce", async () => {
    const panel = await renderAuthFailure("bez-site");
    const continuity = panel.document.querySelector('[data-testid="auth-offline-continuity"]');

    expect(continuity?.textContent.trim()).toBeTruthy();
  });

  it.each(["vyprselo", "odmitnuto", "bez-site", "neznama"])(
    "akce obrazovky %s znovu spustí existující přihlašovací tok",
    async (reason) => {
      const panel = await renderAuthFailure(reason, {
        ok: true,
        user: { name: "Testovací uživatel", email: "test@ludone.cz" },
      });

      await click(
        panel.document.querySelector('[data-testid="auth-error-action"]'),
        panel.view,
      );

      expect(panel.beginAuth).toHaveBeenCalledTimes(2);
      expect(panel.document.querySelector(".permission-step")).not.toBeNull();
    },
  );
});
