import * as React from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { App } from "../src/App.jsx";
import { queueFooterStatus } from "../src/lib/panel.js";

const USER = { name: "Dan Jirotka", email: "dan@ludone.cz" };
const onboardingAudioFrames = new WeakMap();

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
      expect(reportTrayFacts).toHaveBeenCalledExactlyOnceWith({ signedIn: true, tracking: false });
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
        expect(panel.document.querySelector(".panel-header small")?.dataset.authState)
          .toBe("signed-out");
      });
      expect(panel.document.querySelector(".panel-header")?.textContent).not.toContain("Dan Jirotka");
      expect(panel.document.querySelector(".panel-header small")?.textContent.trim()).not.toBe("");
      expect(hasAuthSession).toHaveBeenCalledOnce();
      expect(reportTrayFacts).toHaveBeenCalledExactlyOnceWith({ signedIn: false, tracking: false });
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
        await vi.waitFor(() => {
          expect(panel.document.querySelector(".panel-header small")?.dataset.authState)
            .toBe(hasSession ? "signed-in" : "signed-out");
        });
        return panel.document.querySelector(".panel-header small")?.textContent.trim();
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
        expect(panel.document.querySelector(".panel-header small")?.dataset.authState)
          .toBe("signed-out");
      });
      expect(panel.document.querySelector(".panel-header small")?.textContent.trim()).not.toBe("");
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
      expect(reportTrayFacts).toHaveBeenCalledExactlyOnceWith({ signedIn: true, tracking: false });
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

  it("ukáže lidský zásah a nezapočítá ho mezi běžně čekající položky", async () => {
    const listQueue = vi.fn().mockResolvedValue([
      { state: "ceka", requiresHumanAction: true },
      { state: "ceka" },
    ]);
    const panel = await renderInteractivePanel(listQueue);

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector('[data-testid="queue-status"]')?.textContent)
          .toContain("1 čeká · 1 čeká na přihlášení");
      });
      const status = panel.document.querySelector('[data-testid="queue-status"]');
      expect(status).not.toBeNull();
      expect(status.textContent).not.toContain("2 čekají");
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
