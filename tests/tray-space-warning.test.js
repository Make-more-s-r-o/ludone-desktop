import * as React from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { TraySpaceWarning } from "../src/components/TraySpaceWarning.jsx";

const mountedRoots = [];

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

async function renderWarning(enableDockIcon) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const narrowBridge = {
    enableDockIcon: vi.fn(enableDockIcon),
  };
  const fullBridge = {
    setDockVisible: vi.fn(),
  };
  Object.defineProperty(dom.window, "ludoneTraySpaceWarning", {
    configurable: true,
    value: narrowBridge,
  });
  // Plný bridge v testu schválně existuje: komponenta ho přesto nesmí použít.
  Object.defineProperty(dom.window, "ludone", {
    configurable: true,
    value: fullBridge,
  });

  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const root = createRoot(dom.window.document.querySelector("#root"));
  mountedRoots.push({ dom, root });
  await React.act(async () => {
    root.render(React.createElement(TraySpaceWarning));
  });

  return {
    document: dom.window.document,
    fullBridge,
    narrowBridge,
    view: dom.window,
  };
}

async function click(element, view) {
  await React.act(async () => {
    element.dispatchEvent(new view.MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const { dom, root } = mountedRoots.pop();
    await React.act(async () => root.unmount());
    dom.window.close();
  }
  vi.unstubAllGlobals();
});

describe("upozornění na ikonu, která se nevešla do lišty", () => {
  it("vykreslí samostatný přístupný stav a zachová obě původní rady", () => {
    vi.stubGlobal("React", React);
    try {
      const markup = renderToStaticMarkup(React.createElement(TraySpaceWarning));
      const dom = new JSDOM(markup);
      const document = dom.window.document;
      const warning = document.querySelector('[data-testid="tray-space-warning"]');

      expect(warning).not.toBeNull();
      expect(warning.tagName).toBe("MAIN");
      expect(warning.getAttribute("role")).toBeNull();
      expect(warning.getAttribute("aria-live")).toBeNull();
      expect(document.getElementById(warning.getAttribute("aria-labelledby")).textContent.trim())
        .not.toBe("");
      expect(warning.querySelector('[role="group"][aria-label]')).not.toBeNull();
      expect([...warning.querySelectorAll("[data-solution]")].map(
        (solution) => solution.textContent.trim(),
      )).toEqual([
        "Uvolni místo ukončením jiné aplikace, která má ikonu v horní liště.",
        "Nebo použij správce lišty, který schované ikony zpřístupní.",
      ]);
      expect(warning.querySelector('[data-testid="tray-space-warning-enable-dock"]')?.textContent)
        .toBe("Zapnout ikonu v Docku");
      expect(warning.querySelector("[autofocus]")).toBeNull();
      dom.window.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("po úspěchu zavolá jen úzkou akci bez payloadu a nahradí tlačítko potvrzením", async () => {
    const warning = await renderWarning(() => Promise.resolve(true));
    const button = warning.document.querySelector(
      '[data-testid="tray-space-warning-enable-dock"]',
    );
    expect(button, "Chybí záchranné tlačítko").not.toBeNull();

    await click(button, warning.view);

    expect(warning.narrowBridge.enableDockIcon).toHaveBeenCalledOnce();
    expect(warning.narrowBridge.enableDockIcon.mock.calls[0]).toEqual([]);
    expect(warning.fullBridge.setDockVisible).not.toHaveBeenCalled();
    expect(warning.document.querySelector(
      '[data-testid="tray-space-warning-enable-dock"]',
    )).toBeNull();
    expect(warning.document.querySelectorAll("button")).toHaveLength(0);
    const feedback = warning.document.querySelector(".tray-space-warning__dock-feedback");
    expect(feedback?.getAttribute("aria-live")).toBe("polite");
    expect(feedback?.getAttribute("aria-atomic")).toBe("true");
    expect(warning.document.querySelector(
      '[data-testid="tray-space-warning-dock-success"]',
    )?.textContent.trim()).toBe(
      "Ikona v Docku je zapnutá. LuDone teď najdeš i v Docku.",
    );
  });

  it("selhání hlavního procesu řekne uživateli a nechá aktivní možnost opakovat", async () => {
    const warning = await renderWarning(() => Promise.reject(new Error("Dock API selhalo")));
    const button = warning.document.querySelector(
      '[data-testid="tray-space-warning-enable-dock"]',
    );
    expect(button, "Chybí záchranné tlačítko").not.toBeNull();

    await click(button, warning.view);

    const error = warning.document.querySelector(
      '[data-testid="tray-space-warning-dock-error"]',
    );
    expect(error?.getAttribute("role")).toBe("alert");
    expect(error?.textContent.trim()).toBe(
      "Ikonu v Docku se nepodařilo zapnout. Zkus to prosím znovu.",
    );
    const retry = warning.document.querySelector(
      '[data-testid="tray-space-warning-enable-dock"]',
    );
    expect(retry?.textContent).toBe("Zapnout ikonu v Docku");
    expect(retry?.disabled).toBe(false);
  });

  it("během čekání pošle i po rychlém dvojkliku právě jeden požadavek", async () => {
    const pending = deferred();
    const warning = await renderWarning(() => pending.promise);
    const button = warning.document.querySelector(
      '[data-testid="tray-space-warning-enable-dock"]',
    );
    expect(button, "Chybí záchranné tlačítko").not.toBeNull();

    await React.act(async () => {
      button.dispatchEvent(new warning.view.MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new warning.view.MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(warning.narrowBridge.enableDockIcon).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("Zapínám ikonu v Docku…");

    await React.act(async () => {
      pending.resolve(true);
      await pending.promise;
    });
  });
});
