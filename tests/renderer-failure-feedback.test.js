import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { App } from "../src/App.jsx";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { QueueCard } from "../src/features/queue/QueueCard.jsx";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { Onboarding } from "../src/components/Onboarding.jsx";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { SettingsApp } from "../src/components/Settings.jsx";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { RecordingTestStep } from "../src/components/RecordingTestStep.jsx";
import { createAudioLevelMonitor, createStereoLevelSession } from "../src/lib/audio-levels.js";

const mounted = [];
const QUEUE_ERROR = "Stav fronty není dostupný. Počet čekajících záznamů není známý.";
const MEASUREMENT_ERROR = "Zvuk se nepodařilo změřit. Zkus test znovu.";
const TONE_ERROR = "Zkušební zvuk se nepodařilo přehrát. Zkus to znovu.";

function setup(ludone = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const view = dom.window;
  Object.defineProperty(view, "ludone", { value: {
    runtime: { resetOnboarding: false },
    hasAuthSession: vi.fn().mockResolvedValue(true),
    reportTrayFacts: vi.fn(),
    openSettings: vi.fn(),
    getDockVisible: vi.fn().mockResolvedValue(false),
    getOpenAtLogin: vi.fn().mockResolvedValue(false),
    setDockVisible: vi.fn(async (value) => value),
    setOpenAtLogin: vi.fn(async (value) => value),
    ...ludone,
  } });
  view.localStorage.setItem("ludone.prototype.onboarding-complete", "true");
  const frames = new Map();
  let frameId = 0;
  view.requestAnimationFrame = (callback) => {
    frameId += 1;
    frames.set(frameId, callback);
    return frameId;
  };
  view.cancelAnimationFrame = (id) => frames.delete(id);
  vi.stubGlobal("React", React);
  for (const name of ["window", "document", "navigator", "Node", "HTMLElement"]) {
    vi.stubGlobal(name, name === "window" ? view : view[name]);
  }
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(view.document.querySelector("#root"));
  mounted.push({ dom, root });
  return {
    view,
    document: view.document,
    async render(component, props = {}) {
      await React.act(async () => root.render(React.createElement(component, props)));
    },
    async frame() {
      await React.act(async () => {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(0));
      });
    },
    async refreshQueue() {
      await React.act(async () => {
        view.document.dispatchEvent(new view.Event("visibilitychange"));
      });
    },
  };
}

async function click(element) {
  expect(element).not.toBeNull();
  await React.act(async () => element.click());
}

function queueItem(state) {
  return { state, sizeBytes: 10, nextAttemptAt: null, requiresHumanAction: false,
    lastFailureReason: state === "selhalo" ? "Nahrávka trvale selhala." : null };
}

function installAudio(view, { initialState = "running", resumeFails = false } = {}) {
  const tracks = ["Mikrofon", "Ostatní zvuk"].map((label) => Object.assign(new view.EventTarget(), {
    label, kind: "audio", readyState: "live", enabled: true, muted: false, stop: vi.fn(),
  }));
  const streams = tracks.map((track) => ({
    getAudioTracks: () => [track], getTracks: () => [track], getVideoTracks: () => [],
  }));
  Object.defineProperty(view, "isSecureContext", { value: true });
  Object.defineProperty(view.navigator, "mediaDevices", { value: {
    getUserMedia: vi.fn().mockResolvedValue(streams[0]),
    getDisplayMedia: vi.fn().mockResolvedValue(streams[1]),
  } });
  const contexts = [];
  class FakeAudioContext {
    constructor() {
      this.state = initialState;
      this.currentTime = 0;
      this.destination = {};
      this.close = vi.fn(async () => { this.state = "closed"; });
      this.resume = vi.fn(async () => {
        if (resumeFails) throw new Error("resume selhalo");
        this.state = "running";
      });
      this.createOscillator = vi.fn(() => ({
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      }));
      this.createGain = vi.fn(() => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(), disconnect: vi.fn(),
      }));
      contexts.push(this);
    }
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
    createAnalyser() {
      return { fftSize: 256, smoothingTimeConstant: 0, disconnect: vi.fn(),
        getFloatTimeDomainData: (buffer) => buffer.fill(0) };
    }
  }
  Object.defineProperty(view, "AudioContext", { value: FakeAudioContext });
  return { contexts, tracks, streams };
}

async function renderAudio(panel, options = {}) {
  const audio = installAudio(panel.view, options);
  const sessionAttempt = { promise: createStereoLevelSession(), cancel: vi.fn() };
  await panel.render(RecordingTestStep, {
    sessionAttempt, onPassed: vi.fn(), onRetry: vi.fn(), onSkipped: vi.fn(),
  });
  await panel.frame();
  return { ...audio, sessionAttempt };
}

afterEach(async () => {
  for (const { dom, root } of mounted.splice(0).reverse()) {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
  vi.unstubAllGlobals();
});

describe("1 — neznámá fronta a legitimně prázdná fronta", () => {
  it.each(["odmítnuté čtení", "neplatná odpověď"])("oznámí %s v panelu", async (failure) => {
    const listQueue = failure === "odmítnuté čtení"
      ? vi.fn().mockRejectedValue(new Error("outgoing.json nejde přečíst"))
      : vi.fn().mockResolvedValue([{ state: "poškozeno" }]);
    const panel = setup({ listQueue });
    await panel.render(App);
    expect(panel.document.querySelector('[role="alert"]')?.textContent).toBe(QUEUE_ERROR);
    expect(panel.document.body.textContent).not.toContain("Vše odesláno");
  });

  it("po selhání a obnově na prázdnou frontu odstraní upozornění", async () => {
    const listQueue = vi.fn().mockRejectedValueOnce(new Error("čtení selhalo")).mockResolvedValue([]);
    const panel = setup({ listQueue });
    Object.defineProperty(panel.document, "visibilityState", { value: "visible" });
    await panel.render(App);
    expect(panel.document.body.textContent).toContain(QUEUE_ERROR);
    await panel.refreshQueue();
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
    expect(panel.document.body.textContent).toContain("Vše odesláno");
  });

  it("prázdná fronta zůstane bez výstrahy i bez karty", async () => {
    const panel = setup({ listQueue: vi.fn().mockResolvedValue([]) });
    await panel.render(App);
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
    expect(panel.document.querySelector('[data-testid="queue-screen"]')).toBeNull();
    expect(panel.document.body.textContent).toContain("Vše odesláno");
  });
});

describe("2 — záhlaví odpovídá položkám fronty", () => {
  it.each([false, true])("při trvalém selhání neslibuje zachování všeho; smíšená fronta %s", async (mixed) => {
    const panel = setup();
    await panel.render(QueueCard, { items: [queueItem("selhalo"), ...(mixed ? [queueItem("ceka")] : [])] });
    expect(panel.document.querySelector(".queue-card__heading")?.textContent)
      .toContain("Některé záznamy se nepodařilo odeslat.");
    expect(panel.document.body.textContent).not.toContain("Nic se neztratilo");
    expect(panel.document.querySelector('[role="alert"]')?.textContent).toContain("Nahrávka trvale selhala.");
  });

  it("čekání bez chyby nevyvolá varování a prázdná karta zmizí", async () => {
    const panel = setup();
    await panel.render(QueueCard, { items: [queueItem("ceka")] });
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
    expect(panel.document.body.textContent).not.toContain("nepodařilo");
    await panel.render(QueueCard, { items: [] });
    expect(panel.document.querySelector("#root")?.textContent).toBe("");
  });
});

describe("3 — naměřená nula a nedostupné měření", () => {
  it("odmítnuté resume oznámí v DOM místo naměřeného ticha", async () => {
    const panel = setup();
    const audio = await renderAudio(panel, { initialState: "suspended", resumeFails: true });
    expect(panel.document.querySelector('[role="alert"]')?.textContent).toBe(MEASUREMENT_ERROR);
    expect(panel.document.querySelector('[aria-label="Mikrofon: 0 %"]')).toBeNull();
    expect(audio.tracks.every((track) => track.stop.mock.calls.length > 0)).toBe(true);
  });

  it("skutečné ticho běžícího contextu naměří jako nulu bez chyby", async () => {
    const panel = setup();
    await renderAudio(panel);
    expect(panel.document.querySelector('[aria-label="Mikrofon: 0 %"]')).not.toBeNull();
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
    expect(panel.document.querySelector('[data-testid="recording-test-continue"]').disabled).toBe(true);
  });

  it("po úspěšném resume měří ticho bez chyby", async () => {
    const panel = setup();
    await renderAudio(panel, { initialState: "suspended" });
    expect(panel.document.querySelector('[aria-label="Mikrofon: 0 %"]')).not.toBeNull();
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
  });

  it("měřidlo za běhu rozliší zastavený context a skutečnou nulu", () => {
    const panel = setup();
    const { streams } = installAudio(panel.view);
    const context = new panel.view.AudioContext();
    const monitor = createAudioLevelMonitor(context);
    monitor.replaceSource("microphone", /** @type {MediaStream} */ (/** @type {unknown} */ (streams[0])));
    expect(monitor.readLevels().microphone).toMatchObject({ measured: true, rms: 0 });
    context.state = "suspended";
    expect(monitor.readLevels().microphone).toMatchObject({ available: true, measured: false });
    context.state = "running";
    expect(monitor.readLevels().microphone).toMatchObject({ measured: true, rms: 0 });
    monitor.dispose();
  });
});

describe("4 — konfigurace a úmyslné zrušení přihlášení", () => {

  it("před přihlášením i po jeho úmyslném zrušení zůstane bez chyby", async () => {
    let finishAuth;
    const panel = setup({
      beginAuth: vi.fn(() => new Promise((resolve) => { finishAuth = resolve; })),
      cancelAuth: vi.fn().mockResolvedValue({ ok: true, cancelled: 1 }),
    });
    await panel.render(Onboarding, { reauthenticate: true });
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
    await click(panel.document.querySelector(".auth-step .button--wide"));
    await click(panel.document.querySelector('[data-testid="auth-waiting-cancel"]'));
    await React.act(async () => finishAuth({ ok: false, duvod: "zruseno" }));
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
    expect(panel.document.querySelector(".auth-step .button--wide")).not.toBeNull();
  });
});

const SETTINGS = [
  ["setDockVisible", "Zobrazovat i ikonu v Docku", "Viditelnost ikony v Docku se nepodařilo změnit."],
  ["setOpenAtLogin", "Spouštět po přihlášení do systému", "Spouštění po přihlášení se nepodařilo změnit."],
];

describe("5 — neuložený přepínač a úmyslné vypnutí", () => {
  for (const [setter, label, message] of SETTINGS) {
    it.each(["výjimka", "neplatný výsledek", "opačný výsledek"])(`${label}: oznámí %s`, async (failure) => {
      const update = failure === "výjimka" ? vi.fn().mockRejectedValue(new Error("nativní chyba"))
        : vi.fn().mockResolvedValue(failure === "neplatný výsledek" ? null : false);
      const panel = setup({ [setter]: update });
      await panel.render(SettingsApp);
      const toggle = panel.document.querySelector(`[aria-label="${label}"]`);
      await click(toggle);
      expect(toggle.getAttribute("aria-checked")).toBe("false");
      expect(panel.document.querySelector(".settings-footer [role='alert']")?.textContent).toContain(message);
      expect(panel.document.querySelector(".settings-footer")?.textContent).not.toContain("Změny se ukládají automaticky");
      update.mockImplementation(async (value) => value);
      await click(toggle);
      expect(toggle.getAttribute("aria-checked")).toBe("true");
      expect(panel.document.querySelector(".settings-footer [role='alert']")).toBeNull();
    });

    it(`${label}: výchozí vypnutí i úspěšné zapnutí a vypnutí zůstanou tiché`, async () => {
      const panel = setup();
      await panel.render(SettingsApp);
      const toggle = panel.document.querySelector(`[aria-label="${label}"]`);
      expect(toggle.getAttribute("aria-checked")).toBe("false");
      expect(panel.document.querySelector('[role="alert"]')).toBeNull();
      await click(toggle);
      await click(toggle);
      expect(toggle.getAttribute("aria-checked")).toBe("false");
      expect(panel.document.querySelector('[role="alert"]')).toBeNull();
    });
  }
});

describe("6 — neúspěšný tón a test bez přehrávání", () => {
  it.each(["dokončení", "odmítnutí"])("%s tónu ze zavřeného pokusu neruší nový test", async (outcome) => {
    const panel = setup();
    const { contexts } = await renderAudio(panel);
    const oldContext = contexts[0];
    let finishResume;
    let rejectResume;
    oldContext.state = "suspended";
    oldContext.resume.mockImplementationOnce(() => new Promise((resolve, reject) => {
      finishResume = resolve;
      rejectResume = reject;
    }));
    await click([...panel.document.querySelectorAll("button")]
      .find((element) => element.textContent === "Přehrát zkušební zvuk"));
    await panel.render(RecordingTestStep, {
      sessionAttempt: { promise: createStereoLevelSession(), cancel: vi.fn() },
      onPassed: vi.fn(), onRetry: vi.fn(), onSkipped: vi.fn(),
    });
    await React.act(async () => {
      if (outcome === "dokončení") finishResume();
      else rejectResume(new Error("Zavřený context odmítl resume"));
    });
    await panel.frame();
    expect(oldContext.createOscillator).not.toHaveBeenCalled();
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
    expect(panel.document.querySelector('[aria-label="Mikrofon: 0 %"]')).not.toBeNull();
  });

  it.each(["gain", "start"])("při selhání %s odpojí i rozpracované uzly tónu", async (failure) => {
    const panel = setup();
    const { contexts } = await renderAudio(panel);
    const context = contexts[0];
    const oscillator = context.createOscillator();
    context.createOscillator.mockReturnValueOnce(oscillator);
    let gain;
    if (failure === "gain") {
      context.createGain.mockImplementationOnce(() => { throw new Error("gain selhal"); });
    } else {
      gain = context.createGain();
      context.createGain.mockReturnValueOnce(gain);
      oscillator.start.mockImplementationOnce(() => { throw new Error("start selhal"); });
    }
    await click([...panel.document.querySelectorAll("button")]
      .find((element) => element.textContent === "Přehrát zkušební zvuk"));
    expect(panel.document.querySelector('[role="alert"]')?.textContent).toBe(TONE_ERROR);
    expect(oscillator.disconnect).toHaveBeenCalledOnce();
    if (gain) expect(gain.disconnect).toHaveBeenCalledOnce();
  });

  it("resume bez běžícího contextu nevydává za přehrání tónu", async () => {
    const panel = setup();
    const { contexts } = await renderAudio(panel);
    contexts[0].state = "suspended";
    contexts[0].resume.mockImplementationOnce(async () => {});
    await click([...panel.document.querySelectorAll("button")]
      .find((element) => element.textContent === "Přehrát zkušební zvuk"));
    expect(panel.document.querySelector('[role="alert"]')?.textContent).toBe(TONE_ERROR);
    expect(contexts[0].createOscillator).not.toHaveBeenCalled();
  });

  it.each(["resume", "oscilátor", "start"])("oznámí selhání %s a dovolí další pokus", async (failure) => {
    const panel = setup();
    const { contexts } = await renderAudio(panel);
    const context = contexts[0];
    if (failure === "resume") {
      context.state = "suspended";
      context.resume.mockRejectedValueOnce(new Error("resume selhalo"));
    } else if (failure === "oscilátor") {
      context.createOscillator.mockImplementationOnce(() => { throw new Error("oscilátor selhal"); });
    } else {
      const oscillator = context.createOscillator();
      oscillator.start.mockImplementation(() => { throw new Error("start selhal"); });
      context.createOscillator.mockReturnValueOnce(oscillator);
    }
    const button = [...panel.document.querySelectorAll("button")]
      .find((element) => element.textContent === "Přehrát zkušební zvuk");
    await click(button);
    expect(panel.document.querySelector('[role="alert"]')?.textContent).toBe(TONE_ERROR);
    await click(button);
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
  });

  it("bez tónu a po úspěšném tónu nehlásí selhání ani nepotvrdí tichý mikrofon", async () => {
    const panel = setup();
    const { contexts } = await renderAudio(panel);
    expect(contexts[0].createOscillator).not.toHaveBeenCalled();
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
    await click([...panel.document.querySelectorAll("button")]
      .find((element) => element.textContent === "Přehrát zkušební zvuk"));
    await panel.frame();
    expect(panel.document.querySelector('[role="alert"]')).toBeNull();
    expect(panel.document.querySelector('[data-testid="recording-test-continue"]').disabled).toBe(true);
  });
});
