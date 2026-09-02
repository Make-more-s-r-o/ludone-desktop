import * as React from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { App } from "../src/App.jsx";
import { queueFooterStatus } from "../src/lib/panel.js";

const USER = { name: "Dan Jirotka", email: "dan@ludone.cz" };

/** @param {{ name?: string, email?: string }} [storedUser] */
function renderIdlePanel(storedUser = USER) {
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", {
    localStorage: {
      getItem(key) {
        if (key === "ludone.prototype.onboarding-complete") return "true";
        if (key === "ludone.panel.authenticated-user") return JSON.stringify(storedUser);
        return null;
      },
    },
    ludone: { runtime: { resetOnboarding: false } },
  });

  try {
    const html = renderToStaticMarkup(React.createElement(App));
    return new JSDOM(html).window.document;
  } finally {
    vi.unstubAllGlobals();
  }
}

async function renderInteractivePanel(listQueue, options = {}) {
  const { onboardingComplete = true, ludone = {} } = options;
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  if (onboardingComplete) {
    dom.window.localStorage.setItem("ludone.prototype.onboarding-complete", "true");
    dom.window.localStorage.setItem("ludone.panel.authenticated-user", JSON.stringify(USER));
  }
  Object.defineProperty(dom.window, "ludone", {
    value: {
      listQueue,
      openSettings: vi.fn(),
      reportTrayFacts: vi.fn(),
      runtime: { resetOnboarding: false },
      ...ludone,
    },
  });

  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("navigator", dom.window.navigator);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const root = createRoot(dom.window.document.querySelector("#root"));
  await React.act(async () => {
    root.render(React.createElement(App));
  });

  return {
    document: dom.window.document,
    async cleanup() {
      await React.act(async () => root.unmount());
      dom.window.close();
      vi.unstubAllGlobals();
    },
  };
}

describe("schválený klidový panel", () => {
  it("obsahuje právě dva sbalené akční řádky a žádnou třetí agendu", () => {
    const document = renderIdlePanel();
    const content = [...document.querySelector(".panel-scroll").children];
    const rows = [...document.querySelectorAll('[data-testid="idle-action-row"]')];

    expect(content).toHaveLength(2);
    expect(content).toEqual(rows);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.querySelector("strong")?.textContent)).toEqual([
      "Nahrávání",
      "LuTrack",
    ]);
    expect(document.querySelector(".global-status")).toBeNull();
    expect(document.querySelector(".account-summary")).toBeNull();
    expect(document.querySelector(".panel-close")).toBeNull();
  });

  it("v hlavičce ukazuje LuDone, skutečné jméno a nepředstírá neověřené připojení", () => {
    const document = renderIdlePanel();
    const header = document.querySelector(".panel-header");

    expect(header.textContent).toContain("LuDone");
    expect(header.textContent).toContain("Dan Jirotka · připojení neověřeno");
    expect(header.textContent).not.toContain("Dan Jirotka · připojeno");
    expect(header.textContent).not.toContain("Připraveno");
    expect(header.querySelector('svg[viewBox="0 0 22 22"]')).not.toBeNull();
  });

  it("po právě úspěšném OAuth ukáže doslovný schválený stav připojení", async () => {
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      onboardingComplete: false,
      ludone: {
        beginAuth: vi.fn().mockResolvedValue({ ok: true, user: USER }),
        requestPermission: vi.fn().mockResolvedValue({ status: "granted", granted: true }),
      },
    });
    const click = async (element) => React.act(async () => {
      element.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
    });

    try {
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Začít")));
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Přihlásit v prohlížeči")));
      for (const permissionButton of [...panel.document.querySelectorAll('[data-testid="permission-action"]')]) {
        await click(permissionButton);
      }
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Pokračovat")));
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Otevřít můj panel")));

      expect(panel.document.querySelector(".panel-header")?.textContent)
        .toContain("Dan Jirotka · připojeno");
    } finally {
      await panel.cleanup();
    }
  });

  it("když server nezná jméno, v hlavičce bezpečně použije skutečný e-mail", () => {
    const document = renderIdlePanel({ email: "dan@ludone.cz" });

    expect(document.querySelector(".panel-header")?.textContent)
      .toContain("dan@ludone.cz · připojení neověřeno");
    expect(document.querySelector(".panel-header")?.textContent).not.toContain("undefined");
  });

  it("bez denních dat nevyrenderuje žádný souhrn ani náhradní nulu", () => {
    const document = renderIdlePanel();

    expect(document.querySelector('[data-testid="recording-daily-summary"]')).toBeNull();
    expect(document.querySelector('[data-testid="tracking-daily-summary"]')).toBeNull();
    expect(document.querySelectorAll(".idle-feature-row__copy small")).toHaveLength(0);
    expect(document.querySelector(".panel-scroll").textContent).not.toContain("Dnes");
  });

  it("má textové Nastavení a zachovává kontrakt selektorů ui-smoke", () => {
    const document = renderIdlePanel();
    const recordingButton = document.querySelector('[aria-label="Spustit nahrávání"]');
    const trackingButton = document.querySelector('[aria-label="Spustit LuTrack"]');
    const project = document.querySelector(".tracking-card select");
    const description = document.querySelector(".tracking-card input");
    const settings = document.querySelector('[aria-label="Otevřít nastavení"]');

    expect(recordingButton.querySelector('[aria-hidden="true"]').textContent).toBe("Nahrát");
    expect(recordingButton.textContent).toContain("Spustit nahrávání");
    expect(trackingButton.textContent).toBe("Spustit");
    expect(trackingButton.getAttribute("role")).toBe("switch");
    expect(project.closest(".tracking-controls").hidden).toBe(true);
    expect(description.closest(".description-field").hidden).toBe(true);
    expect(settings.textContent).toBe("Nastavení");
  });

  it("dokud fronta nevrátí ověřená data, patička její souhrn vynechá", async () => {
    const document = renderIdlePanel();
    const interactivePanel = await renderInteractivePanel(undefined);

    try {
      expect(queueFooterStatus(undefined)).toBeNull();
      expect(queueFooterStatus([{ state: "neznamy" }])).toBeNull();
      expect(document.querySelector('[data-testid="queue-status"]')).toBeNull();
      expect(interactivePanel.document.querySelector('[data-testid="queue-status"]')).toBeNull();
    } finally {
      await interactivePanel.cleanup();
    }
  });

  it("načte stav patičky ze skutečného listQueue mostu", async () => {
    const listQueue = vi.fn().mockResolvedValue([
      { state: "ceka" },
      { state: "ceka" },
      { state: "odeslano" },
    ]);
    const panel = await renderInteractivePanel(listQueue);

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
          .toContain("2 čekají");
      });
      expect(listQueue).toHaveBeenCalledTimes(1);
    } finally {
      await panel.cleanup();
    }
  });

  it("kompaktní LuTrack zachová funkční přechod do běžícího stavu", async () => {
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]));

    try {
      const start = panel.document.querySelector('[aria-label="Spustit LuTrack"]');
      await React.act(async () => {
        start.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      });

      const stop = panel.document.querySelector('[aria-label="Zastavit LuTrack"]');
      expect(stop).not.toBeNull();
      expect(panel.document.querySelector(".tracking-card select").disabled).toBe(true);
      expect(panel.document.querySelector(".tracking-controls").hidden).toBe(false);

      await React.act(async () => {
        stop.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      });
      const notice = panel.document.querySelector(".tracking-card .idle-feature-row__notice");
      expect(notice.textContent).toContain("uložení do LuTracku je ukázkové");
      expect(notice.classList.contains("sr-only")).toBe(false);
      expect(notice.closest(".idle-feature-row").classList.contains("has-notice")).toBe(true);
    } finally {
      await panel.cleanup();
    }
  });

  it("chybu startu nahrávání neskrývá před vidícím uživatelem", async () => {
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]));

    try {
      const start = panel.document.querySelector('[aria-label="Spustit nahrávání"]');
      await React.act(async () => {
        start.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      });
      await vi.waitFor(() => {
        expect(panel.document.querySelector(".recording-card [role=alert]")?.textContent)
          .toContain("Nahrávání se nespustilo");
      });
      const alert = panel.document.querySelector(".recording-card [role=alert]");
      expect(alert.classList.contains("sr-only")).toBe(false);
      expect(alert.hidden).toBe(false);
      expect(alert.closest(".idle-feature-row").classList.contains("has-notice")).toBe(true);
    } finally {
      await panel.cleanup();
    }
  });

  it("při chybě listQueue nevydává neověřený stav fronty", async () => {
    const panel = await renderInteractivePanel(vi.fn().mockRejectedValue(new Error("IPC selhalo")));

    try {
      await React.act(async () => Promise.resolve());
      expect(panel.document.querySelector('[data-testid="queue-status"]')).toBeNull();
    } finally {
      await panel.cleanup();
    }
  });
});

describe("pravdivý souhrn odchozí fronty", () => {
  it("prázdnou nebo celou odeslanou frontu popíše bez vymyšleného času", () => {
    expect(queueFooterStatus([])).toEqual({ text: "Vše odesláno", tone: "ok" });
    expect(queueFooterStatus([{ state: "odeslano" }])).toEqual({
      text: "Vše odesláno",
      tone: "ok",
    });
  });

  it("zobrazí skutečné čekající, odesílané a selhané položky", () => {
    expect(queueFooterStatus([
      { state: "odesila" },
      { state: "ceka" },
      { state: "ceka" },
      { state: "selhalo" },
      { state: "odeslano" },
    ])).toEqual({
      text: "Odesílá se · 2 čekají · 1 selhalo",
      tone: "error",
    });
  });
});
