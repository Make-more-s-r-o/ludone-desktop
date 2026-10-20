import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { Onboarding } from "../src/components/Onboarding.jsx";

const AUTH_ERROR_STYLES = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

const REASONS = [
  ["vyprselo", "expired", "retry"],
  ["odmitnuto", "access", "switch-account"],
  ["uloziste", "storage", "retry"],
  // Vlastní stav místo obecného: důvod ZNÁME a uživateli ho říkáme. Akce zůstává
  // „retry" — ne proto, že pomůže, ale protože tahle obrazovka nahrazuje celý panel
  // a bez tlačítka by z ní nevedla cesta ven.
  ["konfigurace", "configuration", "retry"],
  ["bez-site", "offline", "retry"],
  ["neznama", "generic", "retry"],
];

const mountedRoots = [];

async function click(element, view) {
  await React.act(async () => {
    element.dispatchEvent(new view.MouseEvent("click", { bubbles: true }));
  });
}

async function renderAuthFailure(reason, nextResult, onboardingProps = {}) {
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
  const onboarding = React.createElement(Onboarding, {
    onAuthenticated: vi.fn(),
    onComplete: vi.fn(),
    ...onboardingProps,
  });
  await React.act(async () => {
    root.render(onboardingProps.sessionExpired
      ? React.createElement("div", { className: "osa-content" },
        onboarding,
        React.createElement("button", { type: "button", className: "button" }, "Nahrávat bez přihlášení"))
      : onboarding);
  });

  if (!onboardingProps.sessionExpired) {
    await click(dom.window.document.querySelector(".welcome-step .button--wide"), dom.window);
    await click(dom.window.document.querySelector(".auth-step .button--wide"), dom.window);
  }

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

  it("tlačítko každé obrazovky má tón, který styly znají", async () => {
    // `konfigurace` tón vůbec neměla, takže její tlačítko dostalo třídu
    // `--undefined`, kterou stylopis nedefinuje. Nikdo si toho nevšiml, protože
    // se to nijak neprojeví hláškou — jen tichým rozdílem vzhledu. Tenhle test
    // proto hlídá VŠECHNY obrazovky, ne tu jednu, co se zrovna opravila.
    const znameTony = ["primary", "quiet"];
    for (const [reason] of REASONS) {
      const panel = await renderAuthFailure(reason);
      const action = panel.document.querySelector('[data-testid="auth-error-action"]');
      const tony = [...action.classList].filter((t) => t.startsWith("auth-error-panel__action--"));

      expect(tony, reason).toHaveLength(1);
      expect(znameTony, reason).toContain(tony[0].replace("auth-error-panel__action--", ""));
    }
  });

  it("u chyby konfigurace řekne příčinu, a cestu ven přesto nechá", async () => {
    // Dřív se tenhle důvod ukázal jako obecné „Přihlášení se nepodařilo" a uživatel
    // opakoval něco, co nemohlo vyjít. Text teď říká pravdu — ale tlačítko ZŮSTÁVÁ:
    // obrazovka se vrací místo celého panelu, takže bez něj je z ní slepá ulička.
    const panel = await renderAuthFailure("konfigurace");
    const screen = panel.document.querySelector('[data-testid="auth-error-screen"]');
    const action = screen?.querySelector('[data-testid="auth-error-action"]');

    expect(screen?.textContent).toContain("Obrať se na správce aplikace");
    expect(screen?.textContent).toContain("opakování přihlášení to samo nespraví");
    expect(action, "cesta ven musí zůstat").not.toBeNull();
    expect(action?.disabled).toBe(false);
  });

  it("u chyby úložiště ukáže vlastní příčinu a radu místo generického opakování", async () => {
    const panel = await renderAuthFailure("uloziste");
    const screen = panel.document.querySelector('[data-testid="auth-error-screen"]');
    const message = screen?.querySelector('[data-testid="auth-error-message"]');
    const guidance = screen?.querySelector('[data-testid="auth-admin-guidance"]');
    const action = screen?.querySelector('[data-testid="auth-error-action"]');

    expect(screen?.querySelector("h1")?.textContent).toContain("nejde bezpečně uložit");
    expect(message?.textContent).toContain("Systémové úložiště není dostupné");
    expect(message?.textContent).not.toContain("Zkus to prosím znovu");
    expect(guidance?.textContent).toContain("Odemkni Klíčenku");
    expect(guidance?.textContent).toContain("obrať na správce aplikace");
    expect(guidance?.textContent).toContain("Samotné opakování přihlášení nepomůže");
    expect(action?.textContent).toBe("Zkusit znovu");
    expect(action?.disabled, "cesta ven po nápravě úložiště musí zůstat").toBe(false);
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

  it("vypršená relace nabízí viditelné přihlášení a verzi až pod akcí", async () => {
    const panel = await renderAuthFailure(undefined, undefined, { sessionExpired: true });
    const screen = panel.document.querySelector('[data-testid="auth-error-screen"]');
    const actions = screen?.querySelector('[data-testid="auth-error-actions"]');
    const signIn = screen?.querySelector('[data-testid="auth-error-action"]');
    const version = screen?.querySelector('[data-testid="application-version"]');
    const versionCard = screen?.querySelector(".application-update-status");

    expect(screen?.dataset.authErrorState).toBe("session-expired");
    expect(signIn?.tagName).toBe("BUTTON");
    expect(signIn?.textContent.trim()).toMatch(/^Přihlásit se/);
    expect(signIn?.disabled).toBe(false);
    expect(versionCard).not.toBeNull();
    expect(versionCard?.contains(signIn)).toBe(false);
    expect(version?.parentElement).toBe(versionCard);
    expect(actions?.nextElementSibling).toBe(versionCard);

    const style = panel.document.createElement("style");
    style.textContent = AUTH_ERROR_STYLES;
    panel.document.head.append(style);

    const expiredContent = panel.document.querySelector(
      '.osa-content:has(.auth-error-screen[data-auth-error-state="session-expired"])',
    );
    const continueWithoutSignIn = panel.document.querySelector(
      '.osa-content:has(.auth-error-screen[data-auth-error-state="session-expired"]) > .osa-onboarding + .button',
    );
    expect(expiredContent).not.toBeNull();
    expect(continueWithoutSignIn).not.toBeNull();
    expect(panel.view.getComputedStyle(expiredContent).display).toBe("flex");
    expect(["absolute", "fixed"]).not.toContain(
      panel.view.getComputedStyle(versionCard).position,
    );

    await click(signIn, panel.view);
    expect(panel.beginAuth).toHaveBeenCalledTimes(1);
  });

  it.each(["vyprselo", "odmitnuto", "uloziste", "bez-site", "neznama"])(
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
