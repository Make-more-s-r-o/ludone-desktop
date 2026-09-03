import * as React from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { App } from "../src/App.jsx";
import { queueFooterStatus } from "../src/lib/panel.js";

const USER = { name: "Dan Jirotka", email: "dan@ludone.cz" };
const onboardingAudioFrames = new WeakMap();
const RENDERER_STYLES = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

const ONBOARDING_CONTENT_HEIGHTS = {
  // JSDOM nemá layout engine. Vkládáme proto jen deterministickou intrinsic výšku
  // obsahu; rozmístění do řádků a měřený report se dál odvozují ze skutečného CSS a DOM.
  "auth-step": 276,
  "auth-waiting-step": 342,
  "permission-step": 408,
  "welcome-step": 430,
};

function installOnboardingGeometry(view) {
  const style = view.document.createElement("style");
  style.textContent = RENDERER_STYLES;
  view.document.head.append(style);

  const frames = new Map();
  let nextFrameId = 1;
  view.requestAnimationFrame = (callback) => {
    const id = nextFrameId;
    nextFrameId += 1;
    frames.set(id, callback);
    return id;
  };
  view.cancelAnimationFrame = (id) => frames.delete(id);

  const originalRect = view.HTMLElement.prototype.getBoundingClientRect;
  const naturalHeight = (element) => {
    if (element.classList.contains("onboarding__topbar")) return 58;
    if (element.classList.contains("step-track")) return 3;
    for (const [className, height] of Object.entries(ONBOARDING_CONTENT_HEIGHTS)) {
      if (element.classList.contains(className)) return height;
    }
    return 0;
  };
  const layoutFor = (surface) => {
    const tracks = view.getComputedStyle(surface).gridTemplateRows
      .match(/minmax\([^)]*\)|-?\d+(?:\.\d+)?px/g) || [];
    const placements = new Map();
    const occupiedRows = new Set();
    let nextAutoRow = 0;

    for (const child of surface.children) {
      const explicitRow = Number.parseInt(view.getComputedStyle(child).gridRowStart, 10);
      let row = Number.isInteger(explicitRow) && explicitRow > 0 ? explicitRow - 1 : null;
      if (row === null) {
        while (occupiedRows.has(nextAutoRow)) nextAutoRow += 1;
        row = nextAutoRow;
        nextAutoRow += 1;
      }
      placements.set(child, row);
      occupiedRows.add(row);
    }

    const rowHeights = tracks.map((track, row) => {
      const fixedHeight = track.endsWith("px") ? Number.parseFloat(track) : null;
      if (fixedHeight !== null) return fixedHeight;
      return Math.max(0, ...[...placements.entries()]
        .filter(([, childRow]) => childRow === row)
        .map(([child]) => naturalHeight(child)));
    });
    // JSDOM neumí dopočítat šířku shorthand borderu s CSS proměnnou; Chromium ano.
    const borderTop = Number.parseFloat(view.getComputedStyle(surface).borderTopWidth) || 1;
    const borderBottom = Number.parseFloat(view.getComputedStyle(surface).borderBottomWidth) || 1;
    return { borderBottom, borderTop, placements, rowHeights };
  };
  const contentMetrics = (content) => {
    const surface = content.closest(".onboarding.window-surface");
    if (!surface) return null;
    const layout = layoutFor(surface);
    const row = layout.placements.get(content);
    if (!Number.isInteger(row)) return null;
    const top = layout.borderTop + layout.rowHeights
      .slice(0, row)
      .reduce((sum, height) => sum + height, 0);
    const scrollHeight = naturalHeight(content);
    return {
      clientHeight: layout.rowHeights[row] || 0,
      requiredPanelHeight: top + scrollHeight + layout.borderBottom,
      scrollHeight,
      top,
    };
  };

  Object.defineProperty(view.HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      if (this.matches(".onboarding__content")) {
        return contentMetrics(this)?.clientHeight || 0;
      }
      return 0;
    },
  });
  Object.defineProperty(view.HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      if (this.matches(".onboarding__content")) return naturalHeight(this);
      return 0;
    },
  });
  view.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (
      this.matches(".onboarding.window-surface")
      && this.style.height === "auto"
      && this.style.maxHeight === "none"
    ) {
      const layout = layoutFor(this);
      const height = layout.borderTop
        + layout.rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0)
        + layout.borderBottom;
      return new view.DOMRect(0, 0, 366, height);
    }
    if (this.matches(".onboarding__content")) {
      const metrics = contentMetrics(this);
      return new view.DOMRect(0, metrics?.top || 0, 366, metrics?.clientHeight || 0);
    }
    if (this.matches(".auth-step > .button--wide")) {
      const content = this.closest(".onboarding__content");
      const metrics = contentMetrics(content);
      const bottom = (metrics?.top || 0) + (metrics?.scrollHeight || 0) - 25;
      const height = Number.parseFloat(view.getComputedStyle(this).minHeight) || 46;
      return new view.DOMRect(28, bottom - height, 310, height);
    }
    return originalRect.call(this);
  };

  return {
    async flush() {
      await React.act(async () => {
        await Promise.resolve();
        while (frames.size > 0) {
          const callbacks = [...frames.values()];
          frames.clear();
          callbacks.forEach((callback) => callback(view.performance.now()));
          await Promise.resolve();
        }
      });
    },
    state(surface, reportHeight) {
      const content = surface.querySelector(".onboarding__content");
      const button = content?.querySelector(":scope > .button--wide");
      const metrics = content ? contentMetrics(content) : null;
      const reportedHeight = reportHeight.mock.lastCall?.[0] || 0;
      return {
        buttonFits: Boolean(button) && button.getBoundingClientRect().bottom <= reportedHeight,
        clientHeight: content?.clientHeight || 0,
        contentFits: (content?.scrollHeight || 0) <= (content?.clientHeight || 0),
        reportCoversContent: reportedHeight === metrics?.requiredPanelHeight,
        reportedHeight,
        requiredPanelHeight: metrics?.requiredPanelHeight || 0,
        scrollHeight: content?.scrollHeight || 0,
      };
    },
  };
}

function installPassingOnboardingAudio(view) {
  const frames = new Map();
  let nextFrameId = 1;
  onboardingAudioFrames.set(view, frames);
  view.requestAnimationFrame = (callback) => {
    const id = nextFrameId;
    nextFrameId += 1;
    frames.set(id, callback);
    return id;
  };
  view.cancelAnimationFrame = (id) => frames.delete(id);
  const microphoneTrack = Object.assign(new view.EventTarget(), {
    enabled: true,
    kind: "audio",
    label: "Testovací mikrofon",
    muted: false,
    readyState: "live",
    stop: vi.fn(),
  });
  const systemTrack = Object.assign(new view.EventTarget(), {
    enabled: true,
    kind: "audio",
    label: "Testovací systémový zvuk",
    muted: false,
    readyState: "live",
    stop: vi.fn(),
  });
  const videoTrack = Object.assign(new view.EventTarget(), {
    enabled: true,
    kind: "video",
    label: "Testovací obraz",
    muted: false,
    readyState: "live",
    stop: vi.fn(),
  });
  const microphoneStream = {
    getAudioTracks: () => [microphoneTrack],
    getTracks: () => [microphoneTrack],
    getVideoTracks: () => [],
  };
  const systemStream = {
    getAudioTracks: () => [systemTrack],
    getTracks: () => [systemTrack, videoTrack],
    getVideoTracks: () => [videoTrack],
  };
  Object.defineProperty(view.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getDisplayMedia: vi.fn().mockResolvedValue(systemStream),
      getUserMedia: vi.fn().mockResolvedValue(microphoneStream),
    },
  });
  Object.defineProperty(view, "isSecureContext", { configurable: true, value: true });
  view.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
  }));

  class PassingAudioContext {
    constructor() {
      this.destination = {};
      this.state = "running";
    }

    close() {
      this.state = "closed";
      return Promise.resolve();
    }

    createAnalyser() {
      return {
        fftSize: 0,
        smoothingTimeConstant: 0,
        disconnect: vi.fn(),
        getFloatTimeDomainData(target) {
          for (let index = 0; index < target.length; index += 1) {
            target[index] = index % 2 === 0 ? 0.25 : -0.25;
          }
        },
      };
    }

    createMediaStreamSource() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    }

    resume() {
      return Promise.resolve();
    }
  }
  Object.defineProperty(view, "AudioContext", {
    configurable: true,
    value: PassingAudioContext,
  });
}

async function renderInteractivePanel(listQueue, options = {}) {
  const {
    configureWindow = () => {},
    onboardingComplete = true,
    ludone = {},
    storedUser = USER,
  } = options;
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  if (onboardingComplete) {
    dom.window.localStorage.setItem("ludone.prototype.onboarding-complete", "true");
    dom.window.localStorage.setItem("ludone.panel.authenticated-user", JSON.stringify(storedUser));
  }
  Object.defineProperty(dom.window, "ludone", {
    value: {
      hasAuthSession: vi.fn().mockResolvedValue(true),
      listQueue,
      openSettings: vi.fn(),
      reportTrayFacts: vi.fn(),
      runtime: { resetOnboarding: false },
      ...ludone,
    },
  });
  installPassingOnboardingAudio(dom.window);
  configureWindow(dom.window);

  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("navigator", dom.window.navigator);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("AudioContext", dom.window.AudioContext);
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

async function continueThroughRecordingTest(panel, click) {
  const continueButton = panel.document.querySelector('[data-testid="recording-test-continue"]');
  const frames = onboardingAudioFrames.get(panel.document.defaultView);
  for (let attempt = 0; attempt < 10 && continueButton?.disabled; attempt += 1) {
    await React.act(async () => Promise.resolve());
    const next = frames?.entries().next().value;
    if (next) {
      const [id, callback] = next;
      frames.delete(id);
      await React.act(async () => callback(panel.document.defaultView.performance.now()));
    }
  }
  expect(continueButton?.disabled).toBe(false);
  await click(continueButton);
}

describe("schválený klidový panel", () => {
  it("obsahuje právě dva sbalené akční řádky a žádnou třetí agendu", async () => {
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]));
    try {
      const content = [...panel.document.querySelector(".panel-scroll").children];
      const rows = [...panel.document.querySelectorAll('[data-testid="idle-action-row"]')];

      expect(content).toHaveLength(2);
      expect(content).toEqual(rows);
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.querySelector("strong")?.textContent)).toEqual([
        "Nahrávání",
        "LuTrack",
      ]);
      expect(panel.document.querySelector(".global-status")).toBeNull();
      expect(panel.document.querySelector(".account-summary")).toBeNull();
      expect(panel.document.querySelector(".panel-close")).toBeNull();
    } finally {
      await panel.cleanup();
    }
  });

  it("po startu ověří uloženou session a v hlavičce ukáže přihlášený stav", async () => {
    const hasAuthSession = vi.fn().mockResolvedValue(true);
    const reportTrayFacts = vi.fn();
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      ludone: { hasAuthSession, reportTrayFacts },
    });

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector(".panel-header small")?.dataset.authState)
          .toBe("signed-in");
      });
      const header = panel.document.querySelector(".panel-header");
      expect(header.textContent).toContain("LuDone");
      expect(header.textContent).not.toContain("Dan Jirotka");
      expect(header.querySelector("small")?.textContent.trim()).not.toBe("");
      expect(header.querySelector('svg[viewBox="0 0 22 22"]')).not.toBeNull();
      expect(hasAuthSession).toHaveBeenCalledOnce();
      expect(reportTrayFacts).toHaveBeenCalledExactlyOnceWith({
        signedIn: true,
        systemAudioLost: false,
        tracking: false,
      });
    } finally {
      await panel.cleanup();
    }
  });

  it("bez uložené session nezobrazí identitu z pouhé localStorage jako přihlášenou", async () => {
    const reportTrayFacts = vi.fn();
    const hasAuthSession = vi.fn().mockResolvedValue(false);
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      ludone: { hasAuthSession, reportTrayFacts },
    });

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector(".auth-step h1")?.textContent.trim())
          .toBe("Nejsi připojený");
      });
      expect(panel.document.body.textContent).not.toContain("Dan Jirotka");
      expect(panel.document.body.textContent).toContain("Přihlásit v prohlížeči");
      expect(hasAuthSession).toHaveBeenCalledOnce();
      expect(reportTrayFacts).toHaveBeenCalledExactlyOnceWith({
        signedIn: false,
        systemAudioLost: false,
        tracking: false,
      });
    } finally {
      await panel.cleanup();
    }
  });

  it("přihlášený a nepřihlášený stav jsou viditelně odlišné bez vazby na formulaci", async () => {
    const visibleState = async (hasSession) => {
      const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
        ludone: { hasAuthSession: vi.fn().mockResolvedValue(hasSession) },
      });
      try {
        if (hasSession) {
          await vi.waitFor(() => {
            expect(panel.document.querySelector(".panel-header small")?.dataset.authState)
              .toBe("signed-in");
          });
          return panel.document.querySelector(".panel-header small")?.textContent.trim();
        }
        await vi.waitFor(() => {
          expect(panel.document.querySelector(".auth-step h1")?.textContent.trim())
            .toBe("Nejsi připojený");
        });
        return panel.document.querySelector(".auth-step h1")?.textContent.trim();
      } finally {
        await panel.cleanup();
      }
    };

    const signedInText = await visibleState(true);
    const signedOutText = await visibleState(false);
    expect(signedInText).toBeTruthy();
    expect(signedOutText).toBeTruthy();
    expect(signedInText).not.toBe(signedOutText);
  });

  it("při odmítnutém dotazu na session skončí viditelně jako nepřihlášený", async () => {
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      ludone: {
        hasAuthSession: vi.fn().mockRejectedValue(new Error("Úložiště neodpovídá")),
      },
    });

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector(".auth-step h1")?.textContent.trim())
          .toBe("Nejsi připojený");
      });
      expect(panel.document.body.textContent).toContain("Přihlásit v prohlížeči");
    } finally {
      await panel.cleanup();
    }
  });

  it("po právě úspěšném OAuth přepne hlavičku do přihlášeného stavu", async () => {
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
      await continueThroughRecordingTest(panel, click);
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Otevřít můj panel")));

      expect(panel.document.querySelector(".panel-header small")?.dataset.authState)
        .toBe("signed-in");
      expect(panel.document.querySelector(".panel-header")?.textContent).toContain("Dan Jirotka");
    } finally {
      await panel.cleanup();
    }
  });

  it("úspěšnou session bez identity po OAuth nepovažuje za odhlášenou", async () => {
    let finishSessionCheck;
    const sessionCheck = new Promise((resolve) => { finishSessionCheck = resolve; });
    const reportTrayFacts = vi.fn();
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      onboardingComplete: false,
      ludone: {
        beginAuth: vi.fn().mockResolvedValue({ ok: true, user: { name: null, email: null } }),
        hasAuthSession: vi.fn(() => sessionCheck),
        reportTrayFacts,
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
      await continueThroughRecordingTest(panel, click);
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Otevřít můj panel")));
      finishSessionCheck(false);
      await React.act(async () => Promise.resolve());

      expect(panel.document.querySelector(".panel-header small")?.dataset.authState)
        .toBe("signed-in");
      expect(reportTrayFacts).toHaveBeenCalledExactlyOnceWith({
        signedIn: true,
        systemAudioLost: false,
        tracking: false,
      });
    } finally {
      await panel.cleanup();
    }
  });

  it("po právě úspěšném OAuth bez jména použije skutečný e-mail", async () => {
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      onboardingComplete: false,
      ludone: {
        beginAuth: vi.fn().mockResolvedValue({
          ok: true,
          user: { name: null, email: "dan@ludone.cz" },
        }),
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
      await continueThroughRecordingTest(panel, click);
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Otevřít můj panel")));

      expect(panel.document.querySelector(".panel-header small")?.dataset.authState)
        .toBe("signed-in");
      expect(panel.document.querySelector(".panel-header")?.textContent).toContain("dan@ludone.cz");
      expect(panel.document.querySelector(".panel-header")?.textContent).not.toContain("undefined");
    } finally {
      await panel.cleanup();
    }
  });

  it("bez denních dat nevyrenderuje žádný souhrn ani náhradní nulu", async () => {
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]));
    try {
      expect(panel.document.querySelector('[data-testid="recording-daily-summary"]')).toBeNull();
      expect(panel.document.querySelector('[data-testid="tracking-daily-summary"]')).toBeNull();
      expect(panel.document.querySelectorAll(".idle-feature-row__copy small")).toHaveLength(0);
      expect(panel.document.querySelector(".panel-scroll").textContent).not.toContain("Dnes");
    } finally {
      await panel.cleanup();
    }
  });

  it("má textové Nastavení a zachovává kontrakt selektorů ui-smoke", async () => {
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]));
    try {
      const recordingButton = panel.document.querySelector('[aria-label="Spustit nahrávání"]');
      const trackingButton = panel.document.querySelector('[aria-label="Spustit LuTrack"]');
      const project = panel.document.querySelector(".tracking-card select");
      const description = panel.document.querySelector(".tracking-card input");
      const settings = panel.document.querySelector('[aria-label="Otevřít nastavení"]');

      expect(recordingButton.querySelector('[aria-hidden="true"]').textContent).toBe("Nahrát");
      expect(recordingButton.textContent).toContain("Spustit nahrávání");
      expect(trackingButton.textContent).toBe("Spustit");
      expect(trackingButton.getAttribute("role")).toBe("switch");
      expect(project.closest(".tracking-controls").hidden).toBe(true);
      expect(description.closest(".description-field").hidden).toBe(true);
      expect(settings.textContent).toBe("Nastavení");
    } finally {
      await panel.cleanup();
    }
  });

  it("dokud fronta nevrátí ověřená data, patička její souhrn vynechá", async () => {
    const interactivePanel = await renderInteractivePanel(undefined);

    try {
      expect(queueFooterStatus(undefined)).toBeNull();
      expect(queueFooterStatus([{ state: "neznamy" }])).toBeNull();
      expect(interactivePanel.document.querySelector('[data-testid="queue-status"]')).toBeNull();
    } finally {
      await interactivePanel.cleanup();
    }
  });

  it("samé běžné čekající položky zobrazí jako dnes", async () => {
    const listQueue = vi.fn().mockResolvedValue([
      { state: "ceka" },
      { state: "ceka" },
      { state: "odeslano" },
    ]);
    const panel = await renderInteractivePanel(listQueue);

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
          .toBe("2 čekají");
      });
      expect(listQueue).toHaveBeenCalledTimes(1);
    } finally {
      await panel.cleanup();
    }
  });

  it("ukáže lidský zásah a nezapočítá ho mezi běžně čekající položky", async () => {
    const listQueue = vi.fn().mockResolvedValue([
      { state: "ceka", requiresHumanAction: true },
      { state: "ceka" },
    ]);
    const panel = await renderInteractivePanel(listQueue);

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
          .toBe("1 čeká · 1 čeká na potvrzení");
      });
      const status = panel.document.querySelector('[data-testid="queue-status"]');
      expect(status).not.toBeNull();
      expect(status.textContent).not.toContain("2 čekají");
    } finally {
      await panel.cleanup();
    }
  });

  it("klik na čekající patičku otevře obrazovku fronty se skutečnými souhrny", async () => {
    const megabyte = 1024 * 1024;
    const nextAttemptAt = Date.now() + 2 * 60 * 1_000;
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([
      {
        id: "cekajici-nahravka",
        kind: "recording",
        lastFailureReason: "Síť není dostupná",
        nextAttemptAt,
        sizeBytes: 412 * megabyte,
        state: "ceka",
      },
    ]), {
      configureWindow(domWindow) {
        const style = domWindow.document.createElement("style");
        style.textContent = RENDERER_STYLES;
        domWindow.document.head.append(style);
      },
      ludone: { retryQueue: vi.fn() },
    });

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
          .toBe("1 čeká");
      });
      expect(panel.document.querySelector('[data-testid="queue-screen"]')).toBeNull();

      const footer = panel.document.querySelector('[data-testid="queue-status"]');
      await React.act(async () => {
        footer.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      });

      const screen = panel.document.querySelector('[data-testid="queue-screen"]');
      expect(screen?.querySelector("h2")?.textContent).toBe("Čeká fronta");
      expect(screen.hidden).toBe(false);
      expect(panel.document.defaultView.getComputedStyle(screen).display).not.toBe("none");
      expect(screen.closest(".panel-scroll")).not.toBeNull();
      expect(panel.document.defaultView.getComputedStyle(screen.closest(".panel-scroll")).overflowY)
        .toBe("auto");
      expect(screen?.textContent).toContain("Nic se neztratilo, jen to zatím neodešlo.");
      expect(screen?.textContent).toContain("1 čeká na odeslání");
      expect(screen?.textContent).toContain("412 MB · další pokus za 2 min");
      expect(screen?.querySelector('button[data-action="retry-queue"]')?.textContent)
        .toBe("Zkusit teď");
      expect(panel.document.querySelectorAll('[data-testid="idle-action-row"]')).toHaveLength(2);
    } finally {
      await panel.cleanup();
    }
  });

  it("Zkusit teď vyvolá skutečný retry a po jeho dokončení obnoví data", async () => {
    let finishRetry;
    const retryFinished = new Promise((resolve) => { finishRetry = resolve; });
    const retryQueue = vi.fn(() => retryFinished);
    const listQueue = vi.fn()
      .mockResolvedValueOnce([{
        id: "cekajici-nahravka",
        kind: "recording",
        lastFailureReason: "Síť není dostupná",
        nextAttemptAt: Date.now() + 60_000,
        sizeBytes: 1024,
        state: "ceka",
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValue([{
        id: "pozdejsi-nahravka",
        kind: "recording",
        nextAttemptAt: Date.now() + 60_000,
        sizeBytes: 2048,
        state: "ceka",
      }]);
    const panel = await renderInteractivePanel(listQueue, {
      configureWindow(domWindow) {
        Object.defineProperty(domWindow.document, "visibilityState", {
          configurable: true,
          value: "visible",
        });
      },
      ludone: { retryQueue },
    });

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
          .toBe("1 čeká");
      });
      const footer = panel.document.querySelector('[data-testid="queue-status"]');
      await React.act(async () => {
        footer.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      });
      const retry = panel.document.querySelector('button[data-action="retry-queue"]');
      await React.act(async () => {
        retry.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
      });

      expect(retryQueue).toHaveBeenCalledOnce();
      expect(retry.disabled).toBe(true);
      const readsBeforeCompletion = listQueue.mock.calls.length;

      await React.act(async () => {
        finishRetry({ outcome: "sent" });
        await retryFinished;
      });
      await vi.waitFor(() => {
        expect(listQueue.mock.calls.length).toBeGreaterThan(readsBeforeCompletion);
      });
      expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
        .toBe("Vše odesláno");
      expect(panel.document.querySelector('[data-testid="queue-screen"]')).toBeNull();

      await React.act(async () => {
        panel.document.dispatchEvent(new panel.document.defaultView.Event("visibilitychange"));
        await Promise.resolve();
      });
      await vi.waitFor(() => {
        expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
          .toBe("1 čeká");
      });
      expect(panel.document.querySelector('[data-testid="queue-status"]')?.getAttribute("aria-expanded"))
        .toBe("false");
      expect(panel.document.querySelector('[data-testid="queue-screen"]')).toBeNull();
    } finally {
      await panel.cleanup();
    }
  });

  it("čekání na vlastníka je od běžného čekání viditelně oddělené a retry ho nenabízí", async () => {
    const retryQueue = vi.fn().mockResolvedValue({ outcome: "idle" });
    const ownerReason = "Nahrávka patří jinému účtu";
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([
      {
        id: "bezne-cekani",
        kind: "recording",
        lastFailureReason: "Síť není dostupná",
        nextAttemptAt: Date.now() + 2 * 60_000,
        sizeBytes: 10 * 1024 * 1024,
        state: "ceka",
      },
      {
        id: "ceka-na-vlastnika",
        kind: "recording",
        lastFailureReason: ownerReason,
        nextAttemptAt: null,
        requiresHumanAction: true,
        sizeBytes: 2 * 1024 * 1024,
        state: "ceka",
      },
    ]), { ludone: { retryQueue } });

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
          .toBe("1 čeká · 1 čeká na potvrzení");
      });
      const footer = panel.document.querySelector('[data-testid="queue-status"]');
      await React.act(async () => {
        footer.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      });

      const humanAction = panel.document.querySelector('[data-testid="queue-human-action"]');
      expect(humanAction?.getAttribute("role")).toBe("alert");
      expect(humanAction?.textContent).toContain("1 čeká na potvrzení vlastníka");
      expect(humanAction?.textContent).toContain(ownerReason);
      expect(humanAction?.textContent).toContain("2 MB");
      expect(humanAction?.querySelector("button")).toBeNull();
      const ordinary = panel.document.querySelector('[data-testid="queue-waiting-summary"]');
      expect(ordinary?.textContent).toContain("1 čeká na odeslání");
      expect(ordinary?.textContent).toContain("10 MB · další pokus za 2 min");
      expect(ordinary?.textContent).not.toContain(ownerReason);
      expect(panel.document.querySelector('[data-testid="queue-total-size"]')?.textContent)
        .toBe("12 MB celkem");
      expect(panel.document.querySelectorAll('button[data-action="retry-queue"]')).toHaveLength(1);
    } finally {
      await panel.cleanup();
    }
  });

  it("samotné čekání na vlastníka ukáže přesnou velikost, důvod a žádný retry", async () => {
    const retryQueue = vi.fn();
    const ownerReason = "Nahrávka patří jinému účtu";
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([{
      id: "ceka-na-vlastnika",
      kind: "recording",
      lastFailureReason: ownerReason,
      nextAttemptAt: null,
      requiresHumanAction: true,
      sizeBytes: 2 * 1024 * 1024,
      state: "ceka",
    }]), { ludone: { retryQueue } });

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
          .toBe("1 čeká na potvrzení");
      });
      const footer = panel.document.querySelector('[data-testid="queue-status"]');
      await React.act(async () => {
        footer.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      });

      const screen = panel.document.querySelector('[data-testid="queue-screen"]');
      expect(screen?.textContent).toContain("1 čeká na potvrzení vlastníka");
      expect(screen?.textContent).toContain("2 MB");
      expect(screen?.textContent).toContain(ownerReason);
      expect(screen?.querySelector('button[data-action="retry-queue"]')).toBeNull();
      expect(retryQueue).not.toHaveBeenCalled();
    } finally {
      await panel.cleanup();
    }
  });

  it("prázdnou frontu zobrazí jako Vše odesláno", async () => {
    const retryQueue = vi.fn();
    const openSettings = vi.fn();
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      ludone: { openSettings, retryQueue },
    });

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
          .toBe("Vše odesláno");
      });
      const footer = panel.document.querySelector('[data-testid="queue-status"]');
      expect(footer.tagName).toBe("DIV");
      footer.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      expect(panel.document.querySelector('[data-testid="queue-screen"]')).toBeNull();
      expect(panel.document.querySelectorAll('[data-testid="idle-action-row"]')).toHaveLength(2);
      expect(retryQueue).not.toHaveBeenCalled();

      const settings = panel.document.querySelector('[aria-label="Otevřít nastavení"]');
      await React.act(async () => {
        settings.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      });
      expect(openSettings).toHaveBeenCalledOnce();
    } finally {
      await panel.cleanup();
    }
  });

  it("viditelný panel přečte změnu background pumpy i během LuTracku", async () => {
    vi.useFakeTimers();
    const listQueue = vi.fn()
      .mockResolvedValueOnce([{ state: "ceka" }])
      .mockResolvedValue([{ state: "ceka", requiresHumanAction: true }]);
    let panel;

    try {
      panel = await renderInteractivePanel(listQueue, {
        configureWindow(domWindow) {
          Object.defineProperty(domWindow.document, "visibilityState", {
            configurable: true,
            value: "visible",
          });
        },
      });
      await React.act(async () => Promise.resolve());
      expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
        .toBe("1 čeká");

      const startTracking = panel.document.querySelector('[aria-label="Spustit LuTrack"]');
      await React.act(async () => {
        startTracking.dispatchEvent(new panel.document.defaultView.MouseEvent("click", {
          bubbles: true,
        }));
      });
      expect(panel.document.querySelector('[aria-label="Zastavit LuTrack"]')).not.toBeNull();

      await React.act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });

      expect(listQueue).toHaveBeenCalledTimes(2);
      expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
        .toBe("1 čeká na potvrzení");
    } finally {
      await panel?.cleanup();
      vi.useRealTimers();
    }
  });

  it("znovupřihlášení nahlásí výšku celého obsahu včetně tlačítka", async () => {
    const setPanelContentHeight = vi.fn().mockResolvedValue(undefined);
    let geometry;
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      configureWindow(domWindow) {
        geometry = installOnboardingGeometry(domWindow);
      },
      ludone: {
        hasAuthSession: vi.fn().mockResolvedValue(false),
        setPanelContentHeight,
      },
    });

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector(".auth-step h1")?.textContent.trim())
          .toBe("Nejsi připojený");
      });
      await geometry.flush();

      expect(geometry.state(
        panel.document.querySelector(".onboarding.window-surface"),
        setPanelContentHeight,
      )).toEqual({
        buttonFits: true,
        clientHeight: 276,
        contentFits: true,
        reportCoversContent: true,
        reportedHeight: 336,
        requiredPanelHeight: 336,
        scrollHeight: 276,
      });
    } finally {
      await panel.cleanup();
    }
  });

  it("běžný onboarding si zachová původní třířádkovou výšku bez přetečení", async () => {
    const setPanelContentHeight = vi.fn().mockResolvedValue(undefined);
    let geometry;
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      configureWindow(domWindow) {
        geometry = installOnboardingGeometry(domWindow);
      },
      onboardingComplete: false,
      ludone: { setPanelContentHeight },
    });

    try {
      await geometry.flush();

      expect(geometry.state(
        panel.document.querySelector(".onboarding.window-surface"),
        setPanelContentHeight,
      )).toEqual({
        buttonFits: true,
        clientHeight: 430,
        contentFits: true,
        reportCoversContent: true,
        reportedHeight: 493,
        requiredPanelHeight: 493,
        scrollHeight: 430,
      });
    } finally {
      await panel.cleanup();
    }
  });

  it("po přepnutí přihlašovacího stavu přepočítá nahlášenou výšku", async () => {
    const setPanelContentHeight = vi.fn().mockResolvedValue(undefined);
    const beginAuth = vi.fn(() => new Promise(() => {}));
    let geometry;
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      configureWindow(domWindow) {
        geometry = installOnboardingGeometry(domWindow);
      },
      ludone: {
        beginAuth,
        cancelAuth: vi.fn().mockResolvedValue(undefined),
        hasAuthSession: vi.fn().mockResolvedValue(false),
        setPanelContentHeight,
      },
    });

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector(".auth-step h1")?.textContent.trim())
          .toBe("Nejsi připojený");
      });
      await geometry.flush();

      const login = [...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Přihlásit v prohlížeči"));
      await React.act(async () => {
        login.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      });
      await geometry.flush();

      expect(beginAuth).toHaveBeenCalledOnce();
      expect(setPanelContentHeight.mock.calls.map(([height]) => height)).toEqual([336, 402]);
      expect(geometry.state(
        panel.document.querySelector(".onboarding.window-surface"),
        setPanelContentHeight,
      )).toMatchObject({
        clientHeight: 342,
        contentFits: true,
        reportCoversContent: true,
        reportedHeight: 402,
        scrollHeight: 342,
      });
    } finally {
      await panel.cleanup();
    }
  });

  it("opakované změření stejného renderu nespustí smyčku změn výšky", async () => {
    const animationFrames = [];
    const setPanelContentHeight = vi.fn().mockResolvedValue(240);
    let measuredHeight = 240;
    let measurementCount = 0;
    let originalRect;
    let scrollContainer;
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      configureWindow(domWindow) {
        originalRect = domWindow.HTMLElement.prototype.getBoundingClientRect;
        domWindow.requestAnimationFrame = (callback) => {
          animationFrames.push(callback);
          return animationFrames.length;
        };
        domWindow.cancelAnimationFrame = vi.fn();
        domWindow.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
          if (
            this.matches(".window-surface")
            && this.style.height === "auto"
            && this.style.maxHeight === "none"
          ) {
            measurementCount += 1;
            // Chromium může při dočasném auto-height oříznout scroll na začátek.
            if (scrollContainer) scrollContainer.scrollTop = 0;
            return { ...originalRect.call(this), height: measuredHeight };
          }
          return originalRect.call(this);
        };
      },
      ludone: { hasAuthSession: vi.fn().mockResolvedValue(true), setPanelContentHeight },
    });
    const domWindow = panel.document.defaultView;
    scrollContainer = panel.document.querySelector(".panel-scroll");
    const flushMeasurements = async () => {
      await React.act(async () => {
        await Promise.resolve();
        while (animationFrames.length > 0) animationFrames.shift()();
        await Promise.resolve();
        while (animationFrames.length > 0) animationFrames.shift()();
      });
    };

    try {
      scrollContainer.scrollTop = 37;
      await flushMeasurements();
      expect(setPanelContentHeight).toHaveBeenCalledExactlyOnceWith(240);
      expect(scrollContainer.scrollTop).toBe(37);

      const start = panel.document.querySelector('[aria-label="Spustit LuTrack"]');
      scrollContainer.scrollTop = 51;
      await React.act(async () => {
        start.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true }));
      });
      await flushMeasurements();

      expect(measurementCount).toBeGreaterThan(1);
      expect(setPanelContentHeight).toHaveBeenCalledTimes(1);
      expect(scrollContainer.scrollTop).toBe(51);

      measuredHeight = 310;
      const stop = panel.document.querySelector('[aria-label="Zastavit LuTrack"]');
      await React.act(async () => {
        stop.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true }));
      });
      await flushMeasurements();

      expect(setPanelContentHeight).toHaveBeenCalledTimes(2);
      expect(setPanelContentHeight).toHaveBeenLastCalledWith(310);
    } finally {
      domWindow.HTMLElement.prototype.getBoundingClientRect = originalRect;
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

  it("příkaz z kontextového menu spustí LuTrack bez otevírání panelové akce", async () => {
    let deliverCommand;
    const unsubscribe = vi.fn();
    const onTrayCommand = vi.fn((listener) => {
      deliverCommand = listener;
      return unsubscribe;
    });
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      ludone: {
        hasAuthSession: vi.fn().mockResolvedValue(true),
        onTrayCommand,
      },
    });

    try {
      await React.act(async () => deliverCommand("start-tracking"));

      expect(panel.document.querySelector('[aria-label="Zastavit LuTrack"]')).not.toBeNull();
      expect(onTrayCommand).toHaveBeenCalledOnce();
    } finally {
      await panel.cleanup();
    }
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("příkaz z kontextového menu LuTrack i ZASTAVÍ, nejen spustí", async () => {
    // 🔴 Položka „Zastavit měření času" posílá `stop-tracking`. Testy hlavního procesu
    // ověří, že se příkaz odeslal — ale ne, že na něj někdo zareagoval. Bez obsluhy
    // v rendereru by se položka tvářila funkčně a nedělala nic. Proto se to musí měřit
    // TADY, na straně, která příkaz přijímá.
    let deliverCommand;
    const onTrayCommand = vi.fn((listener) => {
      deliverCommand = listener;
      return vi.fn();
    });
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      ludone: {
        hasAuthSession: vi.fn().mockResolvedValue(true),
        onTrayCommand,
      },
    });

    try {
      await React.act(async () => deliverCommand("start-tracking"));
      expect(
        panel.document.querySelector('[aria-label="Zastavit LuTrack"]'),
        "LuTrack se měl rozeběhnout",
      ).not.toBeNull();

      await React.act(async () => deliverCommand("stop-tracking"));
      expect(
        panel.document.querySelector('[aria-label="Zastavit LuTrack"]'),
        "po stop-tracking už LuTrack nesmí běžet",
      ).toBeNull();
      expect(
        panel.document.querySelector('[aria-label="Spustit LuTrack"]'),
        "má být zpátky nabídka spuštění",
      ).not.toBeNull();
    } finally {
      await panel.cleanup();
    }
  });

  it("rychlou akci přijatou během onboardingu později samovolně nespustí", async () => {
    let deliverCommand;
    const onTrayCommand = vi.fn((listener) => {
      deliverCommand = listener;
      return vi.fn();
    });
    const panel = await renderInteractivePanel(vi.fn().mockResolvedValue([]), {
      onboardingComplete: false,
      ludone: {
        beginAuth: vi.fn().mockResolvedValue({ ok: true, user: USER }),
        onTrayCommand,
        requestPermission: vi.fn().mockResolvedValue({ status: "granted", granted: true }),
      },
    });
    const click = async (element) => React.act(async () => {
      element.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
    });

    try {
      await React.act(async () => deliverCommand("start-tracking"));
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Začít")));
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Přihlásit v prohlížeči")));
      for (const permissionButton of [...panel.document.querySelectorAll('[data-testid="permission-action"]')]) {
        await click(permissionButton);
      }
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Pokračovat")));
      await continueThroughRecordingTest(panel, click);
      await click([...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Otevřít můj panel")));

      expect(panel.document.querySelector('[aria-label="Spustit LuTrack"]')).not.toBeNull();
      expect(panel.document.querySelector('[aria-label="Zastavit LuTrack"]')).toBeNull();
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
