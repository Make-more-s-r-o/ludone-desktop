import * as React from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { savedRecordingAge } from "../src/features/recording/recording-copy.js";
const appModule = /** @type {Promise<{ App: React.ComponentType<any> }>} */
  (vi.importActual("../src/App.jsx"));
const recordingCardModule = /** @type {Promise<{ RecordingCard: React.ComponentType<any> }>} */
  (vi.importActual("../src/features/recording/RecordingCard.jsx"));
const { App } = await appModule;
const { RecordingCard } = await recordingCardModule;
const { createUploadCompanySelectionController } = createRequire(import.meta.url)("../electron/upload-company-selection.cjs");

// Zobrazení časů v kartě záměrně používá místní pásmo; připni ho pro tyto testy.
process.env.TZ = "Europe/Prague";

const SESSION_ID = "session-test-1";
const DEFAULT_RECORDING_NAME = "2. září 2026, 14:00";
const SMALL_WORK_AREA_HEIGHT = 400;
const PANEL_TOP_BELOW_TRAY = 26;
const PANEL_BOTTOM_MARGIN = 8;

function installSavedPanelGeometry(view) {
  const panelHeight = SMALL_WORK_AREA_HEIGHT - PANEL_TOP_BELOW_TRAY - PANEL_BOTTOM_MARGIN;
  const originalRect = view.HTMLElement.prototype.getBoundingClientRect;
  const intrinsicHeight = (element) => {
    if (element.matches(".queue-card")) return 174;
    if (element.matches(".recording-saved > [role=status]")) return 25;
    if (element.matches(".recording-saved__meta")) return 16;
    if (element.matches(".recording-saved__name")) return 40;
    if (element.matches(".recording-saved__hint")) return 16;
    if (element.matches('.recording-saved button[type="submit"]')) return 38;
    if (element.matches(".recording-saved__skip")) return 28;
    return 0;
  };
  const savedFormTop = () => {
    const queue = view.document.querySelector(".queue-card");
    const queueVisible = queue && view.getComputedStyle(queue).display !== "none";
    return 14 + (queueVisible ? intrinsicHeight(queue) + 11 : 0);
  };
  const savedChildTop = (element) => {
    const siblings = [...element.parentElement.children];
    const index = siblings.indexOf(element);
    return savedFormTop()
      + siblings.slice(0, index).reduce((sum, sibling) => sum + intrinsicHeight(sibling), 0)
      + (index * 10);
  };

  view.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.matches(".osa-shell")) {
      return new view.DOMRect(0, 0, 400, panelHeight);
    }
    if (this.matches('.recording-saved button[type="submit"], .recording-saved__skip')) {
      const top = savedChildTop(this);
      return new view.DOMRect(14, top, 338, intrinsicHeight(this));
    }
    return originalRect.call(this);
  };

  return () => {
    view.HTMLElement.prototype.getBoundingClientRect = originalRect;
  };
}

function liveMeterWidthPercent(fill) {
  const meterRule = [...(fill?.ownerDocument.styleSheets ?? [])]
    .flatMap((sheet) => [...sheet.cssRules])
    .find((rule) => rule.selectorText === ".audio-level-meter__fill");
  if (meterRule?.style.width !== "var(--audio-level-measured, 0%)") return Number.NaN;
  return Number.parseFloat(
    fill?.style.getPropertyValue("--audio-level-measured") ?? "NaN",
  );
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function recordingResult() {
  return {
    clientRecordingId: SESSION_ID,
    // Název používá místní čas uživatele; fixture proto začíná ve 14:00
    // i na CI v UTC. Přesná aserce názvu zůstává stejná v každém pásmu.
    startedAt: new Date(2026, 8, 2, 14, 0, 0, 10).toISOString(),
    endedAt: new Date(2026, 8, 2, 14, 30, 0, 20).toISOString(),
    trackStartDeltaMs: 25,
    files: {
      microphone: { name: "microphone.webm", size: 4 },
      system: { name: "system.webm", size: 6 },
    },
  };
}

const MICROPHONE_ONLY_TEXT = "Nahrává se jen mikrofon. Druhou stranu hovoru neuslyšíš.";

/**
 * @param {{
 *   analyserError?: Error,
 *   canSend?: boolean,
 *   deferBegin?: boolean,
 *   deferAudioResume?: boolean,
 *   deferCapture?: boolean,
 *   deferExportStart?: boolean,
 *   deferFirstCaptureOnly?: boolean,
 *   deferMicrophoneStart?: boolean,
 *   deferRecovery?: boolean,
 *   deferSystemStart?: boolean,
 *   displayError?: Error | DOMException,
 *   finishRecordingExportResult?: Record<string, unknown>,
 *   finishRecordingResult?: Record<string, unknown>,
 *   modernDecision?: boolean,
 *   modernDecisionOutcome?: "queued" | "saved_local",
 *   microphoneError?: Error | DOMException,
 *   ludoneOverrides?: Record<string, any>,
 *   queueItems?: Array<Record<string, unknown>>,
 *   recordingIds?: string[],
 *   renderApp?: boolean,
 *   storedVisibility?: string,
 *   storedSaveChoice?: string,
 * }} [options]
 */
async function renderRecordingCard(options = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const styles = dom.window.document.createElement("style");
  styles.textContent = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  dom.window.document.head.append(styles);
  // React načítáme před založením JSDOM, takže jeho historický fallback pro
  // input event čeká IE metody, které JSDOM nemá. No-op drží test u skutečného
  // `input` eventu bez změny produkčního chování nebo assercí.
  dom.window.HTMLElement.prototype.attachEvent = vi.fn();
  dom.window.HTMLElement.prototype.detachEvent = vi.fn();
  const microphoneTrack = Object.assign(new dom.window.EventTarget(), {
    kind: "audio",
    label: "Testovací mikrofon",
    readyState: "live",
    enabled: true,
    muted: false,
    stop: vi.fn(),
  });
  const systemTrack = Object.assign(new dom.window.EventTarget(), {
    kind: "audio",
    label: "Testovací systémový zvuk",
    readyState: "live",
    enabled: true,
    muted: false,
    stop: vi.fn(),
  });
  const replacementSystemTrack = Object.assign(new dom.window.EventTarget(), {
    kind: "audio",
    label: "Obnovený systémový zvuk",
    readyState: "live",
    enabled: true,
    muted: false,
    stop: vi.fn(),
  });
  const videoTrack = Object.assign(new dom.window.EventTarget(), {
    kind: "video",
    label: "Testovací obraz",
    readyState: "live",
    enabled: true,
    muted: false,
    stop: vi.fn(),
  });
  const stereoTrack = Object.assign(new dom.window.EventTarget(), {
    kind: "audio",
    label: "Testovací stereo derivát",
    readyState: "live",
    enabled: true,
    muted: false,
    stop: vi.fn(),
    getSettings: () => ({ channelCount: 2, sampleRate: 48_000 }),
  });
  const systemOutputTrack = Object.assign(new dom.window.EventTarget(), {
    kind: "audio",
    label: "Stabilní systémový zvuk",
    readyState: "live",
    enabled: true,
    muted: false,
    stop: vi.fn(),
    getSettings: () => ({ channelCount: 2, sampleRate: 48_000 }),
  });
  const microphoneStream = {
    getTracks: () => [microphoneTrack],
    getAudioTracks: () => [microphoneTrack],
    getVideoTracks: () => [],
  };
  const displayStream = {
    getTracks: () => [systemTrack, videoTrack],
    getAudioTracks: () => [systemTrack],
    getVideoTracks: () => [videoTrack],
  };
  const replacementVideoTrack = Object.assign(new dom.window.EventTarget(), {
    kind: "video",
    label: "Obnovený testovací obraz",
    readyState: "live",
    enabled: true,
    muted: false,
    stop: vi.fn(),
  });
  const replacementDisplayStream = {
    getTracks: () => [replacementSystemTrack, replacementVideoTrack],
    getAudioTracks: () => [replacementSystemTrack],
    getVideoTracks: () => [replacementVideoTrack],
  };
  const microphoneCapture = deferred();
  const displayCapture = deferred();
  const firstMicrophoneTrack = Object.assign(new dom.window.EventTarget(), {
    kind: "audio", label: "První mikrofon", readyState: "live", enabled: true, muted: false, stop: vi.fn(),
  });
  const firstSystemTrack = Object.assign(new dom.window.EventTarget(), {
    kind: "audio", label: "První systémový zvuk", readyState: "live", enabled: true, muted: false, stop: vi.fn(),
  });
  const firstMicrophoneStream = {
    getTracks: () => [firstMicrophoneTrack], getAudioTracks: () => [firstMicrophoneTrack], getVideoTracks: () => [],
  };
  const firstDisplayStream = {
    getTracks: () => [firstSystemTrack], getAudioTracks: () => [firstSystemTrack], getVideoTracks: () => [],
  };
  const recoveryCapture = deferred();
  const beginRecordingAttempt = deferred();
  const audioResumeAttempt = deferred();
  let recordingIdIndex = 0;
  let microphoneCaptureCount = 0;
  const getUserMedia = vi.fn(() => {
    microphoneCaptureCount += 1;
    if (options.microphoneError) return Promise.reject(options.microphoneError);
    return options.deferCapture || (options.deferFirstCaptureOnly && microphoneCaptureCount === 1)
      ? microphoneCapture.promise : Promise.resolve(microphoneStream);
  });
  let displayCaptureCount = 0;
  const getDisplayMedia = vi.fn(() => {
    displayCaptureCount += 1;
    if (options.displayError) return Promise.reject(options.displayError);
    if (displayCaptureCount === 1) {
      return options.deferCapture || options.deferFirstCaptureOnly
        ? displayCapture.promise : Promise.resolve(displayStream);
    }
    if (options.deferFirstCaptureOnly) return Promise.resolve(displayStream);
    if (options.deferRecovery) return recoveryCapture.promise;
    return Promise.resolve(replacementDisplayStream);
  });
  Object.defineProperty(dom.window.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia, getDisplayMedia },
  });
  Object.defineProperty(dom.window, "isSecureContext", {
    configurable: true,
    value: true,
  });

  const animationFrames = new Map();
  let nextAnimationFrameId = 1;
  dom.window.requestAnimationFrame = vi.fn((callback) => {
    const id = nextAnimationFrameId;
    nextAnimationFrameId += 1;
    animationFrames.set(id, callback);
    return id;
  });
  dom.window.cancelAnimationFrame = vi.fn((id) => {
    animationFrames.delete(id);
  });

  const levelAmplitudes = {
    microphone: 0,
    system: 0,
  };
  const levelReadFailures = {
    microphone: 0,
    system: 0,
  };

  const ludone = {
    beginRecording: vi.fn(() => {
      const sessionId = options.recordingIds?.[recordingIdIndex] ?? SESSION_ID;
      recordingIdIndex += 1;
      return options.deferBegin
        ? beginRecordingAttempt.promise
        : Promise.resolve({ sessionId });
    }),
    appendRecordingChunk: vi.fn().mockResolvedValue({ sequence: 0, bytes: 4 }),
    finishRecording: vi.fn((sessionId, trackTimings) => {
      const result = { ...recordingResult(), clientRecordingId: sessionId, ...options.finishRecordingResult };
      if (!trackTimings?.system) delete result.files.system;
      return Promise.resolve(result);
    }),
    listLocalRecordings: vi.fn().mockResolvedValue({ items: [{
      id: SESSION_ID,
      revision: `sha256:${"a".repeat(64)}`,
      fileRevision: `sha256:${"b".repeat(64)}`,
      allowedActions: { delete: true },
      uploadLocked: false,
    }] }),
    deleteRecording: vi.fn().mockResolvedValue({ outcome: "deleted" }),
    finishRecordingExport: vi.fn().mockResolvedValue(
      options.finishRecordingExportResult ?? { ok: true },
    ),
    confirmRecordingExportFailure: vi.fn().mockResolvedValue({ confirmed: true }),
    exportRecording: vi.fn().mockResolvedValue({
      ok: true,
      fileName: `LuDone-${SESSION_ID}.webm`,
    }),
    exportRecordingCopy: vi.fn().mockResolvedValue({
      ok: true,
      fileName: `LuDone-${SESSION_ID}.webm`,
    }),
    hasAuthSession: vi.fn().mockResolvedValue(true),
    listQueue: vi.fn().mockResolvedValue(options.queueItems ?? []),
    openSettings: vi.fn(),
    reportTrayFacts: vi.fn(),
    runtime: { resetOnboarding: false },
  };
  let accountSnapshot = { email: "a@example.test" };
  let accountBinding = "11111111-1111-4111-8111-111111111111";
  const accountListeners = new Set();
  ludone.getAuthIdentity = vi.fn(async () => accountSnapshot);
  ludone.getAuthOrigin = vi.fn(async () => "https://app.ludone.cz");
  ludone.getUploadCompanyIdentity = vi.fn(async () => accountBinding);
  ludone.onAuthSessionChanged = (callback) => { accountListeners.add(callback); return () => accountListeners.delete(callback); };
  Object.assign(ludone, options.ludoneOverrides);
  if (options.modernDecision) {
    ludone.saveRecordingDecision = vi.fn().mockResolvedValue({
      ok: true,
      fileName: `LuDone-${SESSION_ID}.webm`,
      outcome: options.modernDecisionOutcome ?? "queued",
    });
  }
  Object.defineProperty(dom.window, "ludone", { value: ludone });

  const recorders = [];
  class FakeMediaRecorder extends dom.window.EventTarget {
    static isTypeSupported() {
      return true;
    }

    constructor(stream, recorderOptions) {
      super();
      this.stream = stream;
      this.options = recorderOptions;
      this.state = "inactive";
      this.timeslice = null;
      this.index = recorders.length;
      recorders.push(this);
    }

    start(timeslice) {
      this.timeslice = timeslice;
      this.state = "recording";
      if (options.deferExportStart && this.index === 2) return;
      if (options.deferMicrophoneStart && this.index === 0) return;
      if (options.deferSystemStart && this.index === 1) return;
      this.emitStart();
    }

    emitStart() {
      const event = new dom.window.Event("start");
      const startTimestamps = [100, 125, 75];
      Object.defineProperty(event, "timeStamp", { value: startTimestamps[this.index] });
      /** @type {any} */ (this).dispatchEvent(event);
    }

    stop() {
      this.state = "inactive";
      const event = new dom.window.Event("stop");
      const stopTimestamps = [10_150, 10_175, 10_200];
      Object.defineProperty(event, "timeStamp", { value: stopTimestamps[this.index] });
      /** @type {any} */ (this).dispatchEvent(event);
    }

    emitChunk(data) {
      const event = new dom.window.Event("dataavailable");
      Object.defineProperty(event, "data", { value: data });
      /** @type {any} */ (this).dispatchEvent(event);
    }
  }

  class FakeMediaStream {
    constructor(tracks) {
      this.tracks = tracks;
    }

    getTracks() {
      return this.tracks;
    }

    getAudioTracks() {
      return this.tracks.filter((track) => track.kind === "audio");
    }
  }

  const audioContexts = [];
  class FakeAudioContext {
    constructor() {
      this.analysers = [];
      this.connections = [];
      this.destinationCount = 0;
      this.sampleRate = 48_000;
      this.state = options.deferAudioResume ? "suspended" : "running";
      this.close = vi.fn(async () => { this.state = "closed"; });
      audioContexts.push(this);
    }

    createMediaStreamSource(stream) {
      const [track] = stream.getAudioTracks();
      return {
        connect: vi.fn((target, output, input) => {
          if (typeof target?.getFloatTimeDomainData === "function") {
            target.track = track;
            return;
          }
          this.connections.push({ input, output, target, track });
        }),
        disconnect: vi.fn(),
      };
    }

    createAnalyser() {
      if (options.analyserError) throw options.analyserError;
      const analyser = {
        fftSize: 0,
        smoothingTimeConstant: 0,
        track: null,
        disconnect: vi.fn(),
        getFloatTimeDomainData: vi.fn(function getFloatTimeDomainData(target) {
          const source = this.track === microphoneTrack
            ? "microphone"
            : (this.track === systemOutputTrack ? "system" : null);
          if (source && levelReadFailures[source] > 0) {
            levelReadFailures[source] -= 1;
            throw new Error(`${source}: čtení analyzátoru selhalo`);
          }
          const amplitude = source ? levelAmplitudes[source] : 0;
          for (let index = 0; index < target.length; index += 1) {
            target[index] = index % 2 === 0 ? amplitude : -amplitude;
          }
        }),
      };
      this.analysers.push(analyser);
      return analyser;
    }

    createChannelMerger() {
      this.merger = { connect: vi.fn(), disconnect: vi.fn() };
      return this.merger;
    }

    createMediaStreamDestination() {
      const outputTrack = this.destinationCount === 0 ? stereoTrack : systemOutputTrack;
      this.destinationCount += 1;
      return {
        stream: new FakeMediaStream([outputTrack]),
        channelCount: 2,
        channelCountMode: "explicit",
        channelInterpretation: "speakers",
      };
    }

    resume() {
      return options.deferAudioResume
        ? audioResumeAttempt.promise.then(() => {
          if (this.state === "closed") throw new DOMException("Kontext byl uzavřen", "InvalidStateError");
          this.state = "running";
        })
        : Promise.resolve();
    }
  }

  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("navigator", dom.window.navigator);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  vi.stubGlobal("MediaStream", FakeMediaStream);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const root = createRoot(dom.window.document.querySelector("#root"));
  const onActivityChange = vi.fn();
  let trayCommand = null;
  let canSend = options.canSend;
  if (options.storedVisibility !== undefined) {
    dom.window.localStorage.setItem("ludone.desktop.recording-visibility", options.storedVisibility);
  }
  if (options.storedSaveChoice !== undefined) {
    dom.window.localStorage.setItem("ludone.desktop.recording-save-choice", options.storedSaveChoice);
  }
  if (options.renderApp) {
    dom.window.localStorage.setItem("ludone.prototype.onboarding-complete", "true");
  }
  await React.act(async () => {
    root.render(options.renderApp
      ? React.createElement(App)
      : React.createElement(RecordingCard, { onActivityChange, trayCommand, canSend }));
  });

  const phase = () => dom.window.document
    .querySelector("[data-recording-phase]")
    ?.getAttribute("data-recording-phase");
  const currentButton = () => {
    if (phase() === "recording") {
      return dom.window.document.querySelector(
        '[data-testid="recording-stop"], [data-testid="degraded-recording-stop"]',
      );
    }
    if (phase() === "idle") return dom.window.document.querySelector("[data-recording-phase] .idle-feature-row__action");
    return dom.window.document.querySelector("[data-recording-phase] button");
  };

  return {
    document: dom.window.document,
    getUserMedia,
    getDisplayMedia,
    ludone,
    recorders,
    audioContexts,
    microphoneTrack,
    firstMicrophoneTrack,
    firstSystemTrack,
    replacementSystemTrack,
    systemOutputTrack,
    systemTrack,
    videoTrack,
    phase,
    currentButton,
    setAccountBinding(value) { accountBinding = value; },
    async changeAccount(value) {
      await React.act(async () => { accountSnapshot = value; for (const callback of [...accountListeners]) callback(); });
    },
    async sampleLevels() {
      await React.act(async () => {
        const pendingFrames = [...animationFrames.values()];
        animationFrames.clear();
        for (const callback of pendingFrames) callback(dom.window.performance.now());
        await Promise.resolve();
      });
    },
    setLevelAmplitudes({ microphone, system }) {
      levelAmplitudes.microphone = microphone;
      levelAmplitudes.system = system;
    },
    failNextLevelRead(source) {
      levelReadFailures[source] += 1;
    },
    resolveBeginRecording() {
      beginRecordingAttempt.resolve({ sessionId: SESSION_ID });
    },
    resolveCapture() {
      microphoneCapture.resolve(options.deferFirstCaptureOnly ? firstMicrophoneStream : microphoneStream);
      displayCapture.resolve(options.deferFirstCaptureOnly ? firstDisplayStream : displayStream);
    },
    resolveMicrophoneCapture() {
      microphoneCapture.resolve(options.deferFirstCaptureOnly ? firstMicrophoneStream : microphoneStream);
    },
    resolveDisplayCapture() {
      displayCapture.resolve(options.deferFirstCaptureOnly ? firstDisplayStream : displayStream);
    },
    resolveSystemRecorderStart() {
      recorders[1].emitStart();
    },
    resolveExportRecorderStart() {
      recorders[2].emitStart();
    },
    resolveMicrophoneRecorderStart() {
      recorders[0].emitStart();
    },
    resolveAudioResume() {
      audioResumeAttempt.resolve(undefined);
    },
    async setTrayCommand(command) {
      trayCommand = command;
      await React.act(async () => {
        root.render(options.renderApp
          ? React.createElement(App)
          : React.createElement(RecordingCard, { onActivityChange, trayCommand, canSend }));
      });
    },
    async setCanSend(value) {
      canSend = value;
      await React.act(async () => {
        root.render(React.createElement(RecordingCard, { onActivityChange, trayCommand, canSend }));
      });
    },
    rejectRecovery(error) {
      recoveryCapture.reject(error);
    },
    async click(element) {
      if (!element) throw new Error("Test očekával dostupné tlačítko");
      await React.act(async () => {
        element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      });
    },
    async waitForPhase(expectedPhase) {
      await React.act(async () => {
        await vi.waitFor(() => expect(
          phase(),
          dom.window.document.body.textContent || "panel nemá text",
        ).toBe(expectedPhase));
      });
    },
    async unmount() {
      await React.act(async () => root.unmount());
    },
    async cleanup() {
      await React.act(async () => root.unmount());
      dom.window.close();
      vi.unstubAllGlobals();
    },
  };
}

async function startRecording(panel) {
  await panel.click(panel.currentButton());
  await panel.waitForPhase("recording");
}

async function stopRecording(panel) {
  await panel.click(panel.currentButton());
  await panel.waitForPhase("saved");
}

describe("zpětná vazba při startu nahrávání", () => {
  it("při kontrole vysvětluje právě probíhající krok a nevaruje před chybějícím zvukem", async () => {
    const panel = await renderRecordingCard({ deferCapture: true });
    try {
      await panel.click(panel.currentButton());
      expect(panel.phase()).toBe("checking");
      const progress = panel.document.querySelector(".recording-progress");
      expect(progress?.textContent).toContain("Připravuji nahrávání");
      expect(progress?.textContent).toContain("Ověřuji mikrofon a zvuk z počítače");
      expect(progress?.textContent).not.toContain("jen mikrofon");
      expect(panel.document.querySelector('[data-testid="cancel-recording-check"]')?.textContent)
        .toContain("Zrušit");
    } finally {
      await React.act(async () => { panel.resolveCapture(); });
      await panel.waitForPhase("recording");
      await stopRecording(panel);
      await panel.cleanup();
    }
  });

  it("zruší kontrolu, uvolní již získaný mikrofon i později vrácený zvuk a nevytvoří nahrávku", async () => {
    const panel = await renderRecordingCard({ deferCapture: true });
    try {
      await panel.click(panel.currentButton());
      await React.act(async () => { panel.resolveMicrophoneCapture(); await Promise.resolve(); });
      expect(panel.microphoneTrack.stop).not.toHaveBeenCalled();
      await panel.click(panel.document.querySelector('[data-testid="cancel-recording-check"]'));
      expect(panel.phase()).toBe("idle");
      expect(panel.microphoneTrack.stop).toHaveBeenCalled();
      await React.act(async () => { panel.resolveDisplayCapture(); await Promise.resolve(); });
      expect(panel.systemTrack.stop).toHaveBeenCalled();
      expect(panel.videoTrack.stop).toHaveBeenCalled();
      expect(panel.ludone.beginRecording).not.toHaveBeenCalled();
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();
      expect(panel.recorders).toHaveLength(0);
      expect(panel.phase()).toBe("idle");
    } finally {
      await React.act(async () => { panel.resolveCapture(); });
      await panel.cleanup();
    }
  });

  it("po zrušení dovolí další pokus a pozdní první dialog jej nepřepíše", async () => {
    const panel = await renderRecordingCard({ deferFirstCaptureOnly: true });
    try {
      await panel.click(panel.currentButton());
      await panel.click(panel.document.querySelector('[data-testid="cancel-recording-check"]'));
      expect(panel.phase()).toBe("idle");
      await startRecording(panel);
      await React.act(async () => { panel.resolveCapture(); await Promise.resolve(); });
      expect(panel.firstMicrophoneTrack.stop).toHaveBeenCalled();
      expect(panel.firstSystemTrack.stop).toHaveBeenCalled();
      expect(panel.microphoneTrack.stop).not.toHaveBeenCalled();
      expect(panel.systemTrack.stop).not.toHaveBeenCalled();
      expect(panel.ludone.beginRecording).toHaveBeenCalledTimes(1);
      expect(panel.phase()).toBe("recording");
      await stopRecording(panel);
    } finally {
      await React.act(async () => { panel.resolveCapture(); });
      await panel.cleanup();
    }
  });

  it("pozdní zrušený pokus nesmaže požadavek na zastavení dalšího startu", async () => {
    const panel = await renderRecordingCard({ deferFirstCaptureOnly: true, deferBegin: true });
    try {
      await panel.click(panel.currentButton());
      await panel.click(panel.document.querySelector('[data-testid="cancel-recording-check"]'));
      await panel.click(panel.currentButton());
      expect(panel.ludone.beginRecording).toHaveBeenCalledOnce();
      await panel.setTrayCommand({ id: 1, name: "stop-recording" });
      await React.act(async () => { panel.resolveCapture(); await Promise.resolve(); });
      expect(panel.firstMicrophoneTrack.stop).toHaveBeenCalled();
      expect(panel.firstSystemTrack.stop).toHaveBeenCalled();
      await React.act(async () => { panel.resolveBeginRecording(); });
      await panel.waitForPhase("saved");
      expect(panel.ludone.finishRecording).toHaveBeenCalledOnce();
      expect(panel.ludone.finishRecordingExport).toHaveBeenCalledOnce();
    } finally {
      await React.act(async () => { panel.resolveCapture(); panel.resolveBeginRecording(); });
      await panel.cleanup();
    }
  });

  it("při uzavření karty uvolní získané i později vrácené zdroje", async () => {
    const panel = await renderRecordingCard({ deferCapture: true });
    try {
      await panel.click(panel.currentButton());
      await React.act(async () => { panel.resolveMicrophoneCapture(); await Promise.resolve(); });
      await panel.unmount();
      expect(panel.microphoneTrack.stop).toHaveBeenCalled();
      await React.act(async () => { panel.resolveDisplayCapture(); await Promise.resolve(); });
      expect(panel.systemTrack.stop).toHaveBeenCalled();
      expect(panel.videoTrack.stop).toHaveBeenCalled();
      expect(panel.ludone.beginRecording).not.toHaveBeenCalled();
    } finally {
      await React.act(async () => { panel.resolveCapture(); });
      await panel.cleanup();
    }
  });

  it("zruší také čekání na přípravu zvukového grafu po získání obou zdrojů", async () => {
    const panel = await renderRecordingCard({ deferAudioResume: true });
    try {
      await panel.click(panel.currentButton());
      expect(panel.phase()).toBe("checking");
      expect(panel.audioContexts).toHaveLength(1);
      await panel.click(panel.document.querySelector('[data-testid="cancel-recording-check"]'));
      expect(panel.phase()).toBe("idle");
      expect(panel.microphoneTrack.stop).toHaveBeenCalled();
      expect(panel.systemTrack.stop).toHaveBeenCalled();
      expect(panel.audioContexts[0].close).toHaveBeenCalled();
      await React.act(async () => { panel.resolveAudioResume(); await Promise.resolve(); });
      expect(panel.ludone.beginRecording).not.toHaveBeenCalled();
      expect(panel.recorders).toHaveLength(0);
    } finally {
      await React.act(async () => { panel.resolveAudioResume(); });
      await panel.cleanup();
    }
  });

  it("při uzavření karty zavře čekající zvukový kontext i při jednostopé přípravě", async () => {
    const panel = await renderRecordingCard({
      deferAudioResume: true,
      displayError: new DOMException("Systémový zvuk není dostupný", "NotAllowedError"),
    });
    try {
      await panel.click(panel.currentButton());
      expect(panel.phase()).toBe("checking");
      expect(panel.audioContexts).toHaveLength(1);
      await panel.unmount();
      expect(panel.microphoneTrack.stop).toHaveBeenCalled();
      expect(panel.audioContexts[0].close).toHaveBeenCalled();
      expect(panel.ludone.beginRecording).not.toHaveBeenCalled();
    } finally {
      await React.act(async () => { panel.resolveAudioResume(); });
      await panel.cleanup();
    }
  });

  it("po dokončení kontroly ukáže předávané spuštění bez falešného storna", async () => {
    const panel = await renderRecordingCard({ deferBegin: true });
    try {
      await panel.click(panel.currentButton());
      expect(panel.ludone.beginRecording).toHaveBeenCalledOnce();
      expect(panel.document.body.textContent).toContain("Spouštím nahrávání");
      expect(panel.document.querySelector('[data-testid="cancel-recording-check"]')).toBeNull();
    } finally {
      await React.act(async () => { panel.resolveBeginRecording(); });
      await panel.waitForPhase("recording");
      await stopRecording(panel);
      await panel.cleanup();
    }
  });

  it("označí nahrávání po potvrzeném startu mikrofonu i když potvrzení druhé stopy ještě čeká", async () => {
    const panel = await renderRecordingCard({ deferSystemStart: true });
    try {
      await panel.click(panel.currentButton());
      expect(panel.phase()).toBe("recording");
      const status = panel.document.querySelector('[data-testid="recording-running-state"]');
      expect(status?.textContent).toMatch(/Nahrává se/i);
      expect(status?.querySelector(".activity-status__dot")).not.toBeNull();
      expect(panel.document.body.textContent).toContain("Spouštím zvuk z počítače");
      expect(panel.document.querySelector('[data-recording-phase]')?.getAttribute("data-system-audio-state"))
        .toBe("starting");
      await React.act(async () => { panel.resolveSystemRecorderStart(); });
      expect(panel.document.body.textContent).not.toContain("Spouštím zvuk z počítače");
      expect(panel.document.querySelector('[data-recording-phase]')?.getAttribute("data-system-audio-state"))
        .toBe("live");
    } finally {
      if (panel.phase() !== "recording" || panel.document.body.textContent.includes("Spouštím zvuk z počítače")) {
        await React.act(async () => { panel.resolveSystemRecorderStart(); });
      }
      await panel.waitForPhase("recording");
      await stopRecording(panel);
      await panel.cleanup();
    }
  });

  it("zůstane při přípravě až do první události start rekordéru", async () => {
    const panel = await renderRecordingCard({ deferExportStart: true });
    let exportStarted = false;
    try {
      await panel.click(panel.currentButton());
      expect(panel.recorders).toHaveLength(3);
      expect(panel.recorders[2].state).toBe("recording");
      expect(panel.phase()).toBe("checking");
      expect(panel.document.body.textContent).toContain("Spouštím nahrávání");
      expect(panel.document.querySelector('[data-testid="recording-running-state"]')).toBeNull();
      exportStarted = true;
      await React.act(async () => { panel.resolveExportRecorderStart(); });
      expect(panel.phase()).toBe("recording");
      expect(panel.document.querySelector('[data-testid="recording-running-state"]')?.textContent)
        .toMatch(/Nahrává se/i);
    } finally {
      if (!exportStarted) {
        await React.act(async () => { panel.resolveExportRecorderStart(); });
      }
      await panel.waitForPhase("recording");
      await stopRecording(panel);
      await panel.cleanup();
    }
  });

  it("stav nahrávání se objeví po startu stereo záznamu i při čekání na mikrofonní rekordér", async () => {
    const panel = await renderRecordingCard({ deferMicrophoneStart: true });
    try {
      await panel.click(panel.currentButton());
      expect(panel.recorders[2].state).toBe("recording");
      expect(panel.phase()).toBe("recording");
      expect(panel.document.querySelector('[data-testid="recording-running-state"]')?.textContent)
        .toMatch(/Nahrává se/i);
      expect(panel.currentButton().disabled).toBe(true);
      await React.act(async () => { panel.resolveMicrophoneRecorderStart(); });
      expect(panel.currentButton().disabled).toBe(false);
    } finally {
      await React.act(async () => { panel.resolveMicrophoneRecorderStart(); });
      await panel.waitForPhase("recording");
      await stopRecording(panel);
      await panel.cleanup();
    }
  });

  it("povolí zastavení až po potvrzení systémového rekordéru", async () => {
    const panel = await renderRecordingCard({ deferSystemStart: true });
    try {
      await panel.click(panel.currentButton());
      expect(panel.phase()).toBe("recording");
      const stopButton = panel.document.querySelector('[data-testid="recording-stop"]');
      expect(stopButton.disabled).toBe(true);
      await React.act(async () => { stopButton.click(); });
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();
      expect(panel.recorders[0].state).toBe("recording");
      await React.act(async () => { panel.resolveSystemRecorderStart(); });
      expect(stopButton.disabled).toBe(false);
      await panel.click(stopButton);
      expect(panel.recorders[0].state).toBe("inactive");
      await panel.waitForPhase("saved");
      expect(panel.ludone.finishRecording).toHaveBeenCalledOnce();
    } finally {
      if (panel.phase() === "recording") {
        await React.act(async () => { panel.resolveSystemRecorderStart(); });
        await stopRecording(panel);
      }
      await panel.cleanup();
    }
  });

  it.each([
    ["systémového", "deferSystemStart", "resolveSystemRecorderStart"],
    ["mikrofonního", "deferMicrophoneStart", "resolveMicrophoneRecorderStart"],
  ])("v nastavení zdrojů povolí Zastavit až po potvrzení %s rekordéru", async (_label, option, resolveStart) => {
    const panel = await renderRecordingCard({ renderApp: true, [option]: true });
    try {
      await panel.click(panel.currentButton());
      expect(panel.phase()).toBe("recording");
      await panel.click(panel.document.querySelector('[data-testid="recording-open-sources"]'));
      expect(panel.document.querySelector(".osa-shell").dataset.osaPage).toBe("settings");
      expect(panel.document.querySelector("#audio-settings-title")).not.toBeNull();
      const stopButton = panel.document.querySelector(".osa-live-strip button");
      expect(stopButton.disabled).toBe(true);
      await React.act(async () => { stopButton.click(); });
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();
      await React.act(async () => { panel[resolveStart](); });
      expect(stopButton.disabled).toBe(false);
      expect(panel.recorders[0].state).toBe("recording");
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();
      await React.act(async () => { stopButton.click(); });
      await panel.waitForPhase("saved");
      expect(panel.ludone.finishRecording).toHaveBeenCalledOnce();
    } finally {
      if (panel.phase() === "recording") {
        await React.act(async () => { panel[resolveStart](); });
        await stopRecording(panel);
      }
      await panel.cleanup();
    }
  });

  it("při výpadku během startu ponechá i náhradní zastavení vypnuté do potvrzení rekordérů", async () => {
    const panel = await renderRecordingCard({ deferSystemStart: true });
    try {
      await panel.click(panel.currentButton());
      await React.act(async () => {
        panel.systemTrack.readyState = "ended";
        panel.systemTrack.dispatchEvent(new panel.document.defaultView.Event("ended"));
      });
      const stopButton = panel.document.querySelector('[data-testid="degraded-recording-stop"]');
      expect(stopButton.disabled).toBe(true);
      await React.act(async () => { panel.resolveSystemRecorderStart(); });
      expect(stopButton.disabled).toBe(false);
      await panel.click(stopButton);
      await panel.waitForPhase("saved");
    } finally {
      if (panel.phase() === "recording") {
        await React.act(async () => { panel.resolveSystemRecorderStart(); });
        await stopRecording(panel);
      }
      await panel.cleanup();
    }
  });

  it("požadavek lišty na zastavení se během potvrzování druhé stopy neztratí", async () => {
    const panel = await renderRecordingCard({ deferSystemStart: true });
    try {
      await panel.click(panel.currentButton());
      expect(panel.phase()).toBe("recording");
      await panel.setTrayCommand({ id: 1, name: "stop-recording" });
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();
      await React.act(async () => { panel.resolveSystemRecorderStart(); });
      await panel.waitForPhase("saved");
      expect(panel.ludone.finishRecording).toHaveBeenCalledOnce();
      expect(panel.ludone.finishRecordingExport).toHaveBeenCalledOnce();
    } finally {
      await panel.cleanup();
    }
  });

  it("ukazatel reaguje i na tichý vstup a měří právě nahrávanou mikrofonní stopu", async () => {
    const panel = await renderRecordingCard();
    try {
      await startRecording(panel);
      panel.setLevelAmplitudes({ microphone: 0.003, system: 0 });
      await panel.sampleLevels();
      const fill = panel.document.querySelector('[data-testid="recording-source-microphone"] .recording-source__fill');
      expect(liveMeterWidthPercent(fill)).toBeGreaterThanOrEqual(15);
      expect(panel.audioContexts[0].analysers[0].track).toBe(panel.recorders[0].stream.getAudioTracks()[0]);
      expect(panel.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
        audio: expect.objectContaining({ echoCancellation: false, noiseSuppression: false, autoGainControl: false }),
      }));
      panel.setLevelAmplitudes({ microphone: 0, system: 0 });
      await panel.sampleLevels();
      expect(liveMeterWidthPercent(fill)).toBe(0);
      await stopRecording(panel);
    } finally { await panel.cleanup(); }
  });

  it("po místním uložení zobrazí stav jen krátce", async () => {
    const panel = await renderRecordingCard({ modernDecision: true, modernDecisionOutcome: "saved_local" });
    try {
      await startRecording(panel);
      await stopRecording(panel);
      const timers = vi.spyOn(panel.document.defaultView, "setTimeout");
      await panel.click(panel.document.querySelector('[data-testid="skip-recording-name"]'));
      await panel.waitForPhase("idle");
      expect(panel.document.body.textContent).toContain("Nahrávka zůstala jen na tomto Macu");
      const expiry = timers.mock.calls.find(([, delay]) => delay >= 5_000 && delay <= 15_000);
      expect(expiry).toBeDefined();
      await React.act(async () => {
        if (typeof expiry[0] === "function") expiry[0]();
      });
      expect(panel.document.body.textContent).not.toContain("Nahrávka zůstala jen na tomto Macu");
    } finally { await panel.cleanup(); }
  });
});

describe("produktové dotažení Teď", () => {
  it("aktivní Teď zůstane v panelu; den a nastavení mají vlastní cíl", async () => {
    const panel = await renderRecordingCard({ renderApp: true });
    try {
      const navigation = panel.document.querySelector(".osa-rail");
      await panel.click(navigation.querySelector('[data-page="home"]'));
      expect(panel.document.querySelector(".osa-shell").dataset.osaPage).toBe("home");
      await panel.click(navigation.querySelector('[data-page="library"]'));
      expect(panel.document.querySelector(".osa-shell").dataset.osaPage).toBe("library");
      await panel.click(navigation.querySelector('[data-page="settings"]'));
      expect(panel.document.querySelector(".osa-shell").dataset.osaPage).toBe("settings");
      expect(panel.document.querySelector(".osa-settings-sections")).not.toBeNull();
    } finally { await panel.cleanup(); }
  });

  it("velká fronta zůstává za nahráváním a odkaz otevře její přehled", async () => {
    const panel = await renderRecordingCard({ renderApp: true,
      queueItems: Array.from({ length: 30 }, (_, index) => ({
        id: `waiting-${index}`, kind: "recording", state: "selhalo",
        lastFailureReason: `Důvod ${index}`, sizeBytes: 100,
      })),
    });
    try {
      expect(panel.document.querySelector(".osa-shell").dataset.osaPage).toBe("home");
      expect(panel.document.querySelector(".queue-card")).toBeNull();
      await panel.click(panel.document.querySelector('.osa-rail [data-page="queue"]'));
      expect(panel.document.querySelector(".queue-card").textContent).toContain("Důvod 29");
      await panel.click(panel.document.querySelector('.osa-rail [data-page="library"]'));
      expect(panel.document.querySelector(".osa-shell").dataset.osaPage).toBe("library");
      expect(panel.ludone.beginRecording).not.toHaveBeenCalled();
    } finally { await panel.cleanup(); }
  });

  it.each(["queued", "saved_local", "sent", "unknown"])("moderní výsledek %s má lidské potvrzení a dosažitelný přehled", async (outcome) => {
    const panel = await renderRecordingCard({ modernDecision: true });
    panel.ludone.saveRecordingDecision.mockResolvedValueOnce({ ok: true,
      outcome, fileName: `LuDone-${SESSION_ID}.webm`,
    });
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await panel.click(panel.document.querySelector('button[type="submit"]'));
      await panel.waitForPhase("idle");
      const notice = panel.document.querySelector('[role="status"]');
      expect(notice.textContent).not.toContain(SESSION_ID);
      expect(notice.textContent).not.toContain("VLC");
      if (outcome === "sent") expect(notice.textContent).toContain("Uloženo a odesláno.");
      if (outcome === "unknown") expect(notice.textContent).toContain("Stav odeslání není potvrzený.");
      await panel.click(notice.querySelector("button"));
      expect(panel.ludone.openSettings).toHaveBeenLastCalledWith("recordingQueue");
    } finally { await panel.cleanup(); }
  });
});

describe("nahrávání při zneplatnění relace", () => {
  it.each(["expired", "none"])("stav %s ponechá Stop i lokální uložení, ale zavře odesílání", async (state) => {
    const panel = await renderRecordingCard({
      renderApp: true,
      queueItems: [{ id: "cekajici", kind: "recording", state: "ceka", nextAttemptAt: Date.now() + 60_000 }],
    });
    try {
      await panel.click(panel.document.querySelector('.osa-rail [data-page="queue"]'));
      expect(panel.document.querySelector('[data-testid="queue-screen"]')).not.toBeNull();
      await panel.click(panel.document.querySelector('.osa-rail [data-page="home"]'));
      await startRecording(panel);
      const card = panel.document.querySelector("[data-recording-phase]");
      // Starý boolean i nový stav říkají totéž. Test tak odhalí původní odmountování
      // skutečné RecordingCard; pouhá náhrada tlačítka atrapou nestačí.
      panel.ludone.hasAuthSession.mockResolvedValue(false);
      Object.assign(panel.ludone, { getAuthSessionState: vi.fn().mockResolvedValue(state) });
      await React.act(async () => {
        panel.document.defaultView.dispatchEvent(new panel.document.defaultView.Event("focus"));
      });
      expect(panel.document.querySelector('[data-testid="recording-stop"]')).not.toBeNull();
      expect(panel.document.querySelector("[data-recording-phase]")).toBe(card);
      expect(panel.document.querySelector('[data-auth-state="signed-in"]')).toBeNull();
      if (state === "expired") expect(panel.document.body.textContent).toContain("Přihlášení vypršelo");
      expect(panel.document.querySelector('[data-testid="queue-status"]')).toBeNull();
      await panel.click(panel.document.querySelector('.osa-rail [data-page="queue"]'));
      expect(panel.document.querySelector('[data-testid="queue-screen"]')).not.toBeNull();
      expect(panel.document.querySelector('button[data-action="retry-queue"]')).toBeNull();
      expect(panel.document.querySelector('.osa-live-strip button')?.disabled).toBe(false);
      expect(panel.document.querySelector("[data-recording-phase]")).toBe(card);
      expect(panel.document.querySelector('[aria-label="Spustit LuTrack"]')).toBeNull();
      await panel.click(panel.document.querySelector('.osa-rail [data-page="home"]'));
      await stopRecording(panel);
      expect(panel.ludone.finishRecording).toHaveBeenCalledOnce();
      const send = [...panel.document.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === "Uložit a odeslat");
      expect(!send || send.disabled).toBe(true);
      await panel.click(panel.document.querySelector('[data-testid="skip-recording-name"]'));
      expect(panel.ludone.exportRecording).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: DEFAULT_RECORDING_NAME, openUploadPage: false,
      });
    } finally {
      await panel.cleanup();
    }
  });
});

async function enterRecordingName(panel, name) {
  const input = panel.document.querySelector('[data-testid="recording-name-input"]');
  await React.act(async () => {
    input.value = name;
    input.dispatchEvent(new panel.document.defaultView.Event("input", { bubbles: true }));
  });
  return input;
}

describe("RecordingCard", () => {
  it("zrušení nativního koše ponechá formulář bez chybového upozornění", async () => {
    const panel = await renderRecordingCard();
    panel.ludone.deleteRecording.mockResolvedValueOnce({ outcome: "cancelled" });
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await panel.click(panel.document.querySelector('[data-testid="delete-recording"]'));
      await panel.click(panel.document.querySelector('[data-testid="confirm-delete-recording"]'));
      await vi.waitFor(() => expect(panel.ludone.deleteRecording).toHaveBeenCalledOnce());
      expect(panel.document.querySelector('[data-recording-phase="saved"]')).not.toBeNull();
      expect(panel.document.querySelector(".recording-saved__error")).toBeNull();
    } finally { await panel.cleanup(); }
  });

  it("částečný koš vysvětlí změněný soubor a nabídne opakování", async () => {
    const panel = await renderRecordingCard();
    panel.ludone.deleteRecording.mockResolvedValueOnce({ outcome: "partial_failure", reason: "file_changed" });
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await panel.click(panel.document.querySelector('[data-testid="delete-recording"]'));
      await panel.click(panel.document.querySelector('[data-testid="confirm-delete-recording"]'));
      await vi.waitFor(() => expect(panel.document.body.textContent).toMatch(/soubor se změnil/iu));
      expect(panel.document.body.textContent).toMatch(/zkus.+znovu/iu);
      expect(panel.document.querySelector('[data-recording-phase="saved"]')).not.toBeNull();
    } finally { await panel.cleanup(); }
  });

  it("chybu zahájeného odesílání zobrazí s dalším postupem", async () => {
    const panel = await renderRecordingCard();
    panel.ludone.deleteRecording.mockRejectedValueOnce(new Error("Odesílání už začalo; nahrávku nelze smazat"));
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await panel.click(panel.document.querySelector('[data-testid="delete-recording"]'));
      await panel.click(panel.document.querySelector('[data-testid="confirm-delete-recording"]'));
      await vi.waitFor(() => expect(panel.document.body.textContent).toMatch(/odesílání už začalo/iu));
      expect(panel.document.body.textContent).toMatch(/zkontroluj.+přehled/iu);
    } finally { await panel.cleanup(); }
  });

  it("maže zastavenou nahrávku až po potvrzení a úspěšné smazání skryje kartu", async () => {
    const view = await renderRecordingCard();
    try {
      await React.act(async () => view.currentButton().click());
      await vi.waitFor(() => expect(view.phase()).toBe("recording"));
      await stopRecording(view);
      await vi.waitFor(() => expect(view.document.querySelector('[data-testid="delete-recording"]')).not.toBeNull());
      await React.act(async () => view.document.querySelector('[data-testid="delete-recording"]').click());
      expect(view.ludone.deleteRecording).not.toHaveBeenCalled();
      await React.act(async () => view.document.querySelector('[data-testid="confirm-delete-recording"]').click());
      await vi.waitFor(() => expect(view.ludone.deleteRecording).toHaveBeenCalledOnce());
      expect(view.phase()).toBe("idle");
      expect(view.document.querySelector('[data-recording-phase="saved"]')).toBeNull();
    } finally { await view.cleanup(); }
  });

  it("zastavená karta nedovolí smazání při upload locku ze serverového stavu", async () => {
    const view = await renderRecordingCard();
    try {
      await React.act(async () => view.currentButton().click());
      await vi.waitFor(() => expect(view.phase()).toBe("recording"));
      await stopRecording(view);
      await vi.waitFor(() => expect(view.document.querySelector('[data-testid="delete-recording"]')).not.toBeNull());
      view.ludone.listLocalRecordings.mockResolvedValue({ items: [{
        id: SESSION_ID, revision: `sha256:${"a".repeat(64)}`, fileRevision: `sha256:${"b".repeat(64)}`,
        allowedActions: { delete: false }, uploadLocked: true,
      }] });
      await React.act(async () => view.document.querySelector('[data-testid="delete-recording"]').click());
      await React.act(async () => view.document.querySelector('[data-testid="confirm-delete-recording"]').click());
      await vi.waitFor(() => expect(view.document.body.textContent).toContain("Odesílání už začalo"));
      expect(view.ludone.deleteRecording).not.toHaveBeenCalled();
    } finally { await view.cleanup(); }
  });

  it.each([
    ["send", "Uložit a odeslat", 'button[type="submit"]'],
    ["keep", "Nechat na Macu", '[data-testid="skip-recording-name"]'],
  ])("volba %s zachová title a použije nový save-decision kontrakt", async (
    decision,
    label,
    selector,
  ) => {
    const panel = await renderRecordingCard({ modernDecision: true });
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await enterRecordingName(panel, "Porada výroby");
      const button = panel.document.querySelector(selector);
      expect(button.textContent.trim()).toBe(label);
      await panel.click(button);
      await panel.waitForPhase("idle");
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        decision,
        recordingName: "Porada výroby",
      });
      expect(panel.ludone.exportRecording).not.toHaveBeenCalled();
      expect(panel.ludone.exportRecordingCopy).not.toHaveBeenCalled();
    } finally {
      await panel.cleanup();
    }
  });

  it("automatický snapshot po finish spustí stejnou send cestu právě jednou", async () => {
    const panel = await renderRecordingCard({
      finishRecordingResult: { automaticUpload: true },
      modernDecision: true,
    });
    try {
      await startRecording(panel);
      await panel.click(panel.currentButton());
      await panel.waitForPhase("idle");
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        decision: "send",
        recordingName: DEFAULT_RECORDING_NAME,
      });
      expect(panel.ludone.exportRecordingCopy).not.toHaveBeenCalled();
    } finally {
      await panel.cleanup();
    }
  });

  it.each([
    ["send", true, 'button[type="submit"]'],
    ["keep", false, '[data-testid="skip-recording-name"]'],
  ])("starší renderer potvrzuje %s bez tvrzení o Stažených", async (decision, openUploadPage, selector) => {
    const panel = await renderRecordingCard();
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await enterRecordingName(panel, "Porada výroby");
      await panel.click(panel.document.querySelector(selector));
      await panel.waitForPhase("idle");

      expect(panel.ludone.exportRecording).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: "Porada výroby", openUploadPage,
      });
      expect(panel.ludone.exportRecordingCopy).not.toHaveBeenCalled();
      const status = panel.document.querySelector('[role="status"]')?.textContent ?? "";
      expect(status).toContain("Nahrávka byla uložena na Macu");
      expect(status).not.toContain("Stažených");
    } finally {
      await panel.cleanup();
    }
  });

  it("automatické odeslání přes starší most nevytvoří kopii ani neslibuje Stažené", async () => {
    const panel = await renderRecordingCard({ finishRecordingResult: { automaticUpload: true } });
    try {
      await startRecording(panel);
      await panel.click(panel.currentButton());
      await panel.waitForPhase("idle");

      expect(panel.ludone.exportRecording).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: DEFAULT_RECORDING_NAME,
        openUploadPage: true,
      });
      expect(panel.ludone.exportRecordingCopy).not.toHaveBeenCalled();
      const status = panel.document.querySelector('[role="status"]')?.textContent ?? "";
      expect(status).toContain("Nahrávka byla uložena na Macu");
      expect(status).not.toContain("Stažených");
    } finally {
      await panel.cleanup();
    }
  });

  it("výslovně exportuje kopii ve Stažených bez rozhodnutí o odeslání", async () => {
    const panel = await renderRecordingCard({ modernDecision: true });
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await enterRecordingName(panel, "Porada výroby");
      await panel.click(panel.document.querySelector('[data-testid="export-recording-copy"]'));

      expect(panel.ludone.exportRecordingCopy).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: "Porada výroby",
      });
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      expect(panel.ludone.exportRecording).not.toHaveBeenCalled();
      expect(panel.phase()).toBe("saved");
      expect(panel.document.querySelector('[data-testid="recording-copy-export-status"]')?.textContent)
        .toContain("Kopie LuDone-session-test-1.webm je uložená ve Stažených.");
    } finally {
      await panel.cleanup();
    }
  });

  it.each([
    ["keep", '[data-testid="skip-recording-name"]'],
    ["send", 'button[type="submit"]'],
  ])("čekající kopie nezablokuje rozhodnutí %s", async (_decision, selector) => {
    const copy = deferred();
    const panel = await renderRecordingCard({ modernDecision: true });
    panel.ludone.exportRecordingCopy.mockReturnValueOnce(copy.promise);
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await panel.click(panel.document.querySelector('[data-testid="export-recording-copy"]'));
      expect(panel.document.querySelector('[data-testid="export-recording-copy"]').disabled).toBe(true);
      expect(panel.document.querySelector(selector).disabled).toBe(false);

      await panel.click(panel.document.querySelector(selector));
      await vi.waitFor(() => expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledOnce());
      expect(panel.ludone.exportRecordingCopy).toHaveBeenCalledOnce();
      copy.resolve({ ok: true, fileName: `LuDone-${SESSION_ID}.webm` });
      await Promise.resolve();
    } finally {
      copy.resolve({ ok: true, fileName: `LuDone-${SESSION_ID}.webm` });
      await panel.cleanup();
    }
  });

  it("čekající kopie nezablokuje potvrzený koš", async () => {
    const copy = deferred();
    const panel = await renderRecordingCard();
    panel.ludone.exportRecordingCopy.mockReturnValueOnce(copy.promise);
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await panel.click(panel.document.querySelector('[data-testid="export-recording-copy"]'));
      const deleteButton = panel.document.querySelector('[data-testid="delete-recording"]');
      expect(deleteButton.disabled).toBe(false);
      await panel.click(deleteButton);
      await panel.click(panel.document.querySelector('[data-testid="confirm-delete-recording"]'));
      await vi.waitFor(() => expect(panel.ludone.deleteRecording).toHaveBeenCalledOnce());
      expect(panel.ludone.exportRecordingCopy).toHaveBeenCalledOnce();
      copy.resolve({ ok: true, fileName: `LuDone-${SESSION_ID}.webm` });
    } finally {
      copy.resolve({ ok: true, fileName: `LuDone-${SESSION_ID}.webm` });
      await panel.cleanup();
    }
  });

  it("po změně clientRecordingId nezobrazuje potvrzení kopie předchozí nahrávky", async () => {
    const panel = await renderRecordingCard({
      recordingIds: [SESSION_ID, "session-test-2"],
      modernDecision: true,
    });
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await enterRecordingName(panel, "První porada");
      await panel.click(panel.document.querySelector('[data-testid="export-recording-copy"]'));
      expect(panel.document.querySelector('[data-testid="recording-copy-export-status"]')?.textContent)
        .toContain("Kopie LuDone-session-test-1.webm je uložená ve Stažených.");
      await panel.click(panel.document.querySelector('[data-testid="skip-recording-name"]'));
      await panel.waitForPhase("idle");

      await panel.click(panel.document.querySelector('[aria-label="Spustit nahrávání"]'));
      await panel.waitForPhase("recording");
      await expect(panel.ludone.beginRecording.mock.results[1].value).resolves.toMatchObject({
        sessionId: "session-test-2",
      });
      await stopRecording(panel);

      expect(panel.ludone.beginRecording).toHaveBeenCalledTimes(2);
      expect(panel.document.querySelector('[data-testid="recording-copy-export-status"]')).toBeNull();
    } finally {
      await panel.cleanup();
    }
  });

  it.each(/** @type {const} */ ([
    ["queued", "Nahrávka čeká ve frontě k odeslání."],
    ["saved_local", "Nahrávka zůstala jen na tomto Macu a nebyla zařazena k odeslání."],
  ]))("výsledek %s po uložení popíše pravdivě stav odeslání", async (outcome, message) => {
    const panel = await renderRecordingCard({ modernDecision: true, modernDecisionOutcome: outcome });
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await enterRecordingName(panel, "Porada výroby");
      await panel.click(panel.document.querySelector('button[type="submit"]'));
      await panel.waitForPhase("idle");
      expect(panel.document.querySelector('[role="status"]')?.textContent).toContain(message);
      expect(panel.document.querySelector('[role="status"]')?.textContent)
        .not.toContain("ověřeno na serveru");
    } finally {
      await panel.cleanup();
    }
  });

  it.each(["ř".repeat(501), "a".repeat(501), `a${"😀".repeat(250)}`])(
    "501 jednotek odmítne u pole, zachová uloženou nahrávku a dovolí opravu (%#)",
    async (name) => {
      const panel = await renderRecordingCard();
      try {
        await startRecording(panel);
        await stopRecording(panel);
        const input = await enterRecordingName(panel, name);
        await panel.click(panel.document.querySelector('button[type="submit"]'));

        const error = panel.document.getElementById(input.getAttribute("aria-errormessage"));
        expect(error?.textContent).toBe("Název je příliš dlouhý. Zkraťte ho.");
        expect(error?.getAttribute("role")).toBe("alert");
        expect(error?.hidden).toBe(false);
        expect(error?.parentElement).toBe(input.parentElement);
        expect(input.getAttribute("aria-invalid")).toBe("true");
        expect(input.value).toBe(name);
        expect(panel.phase()).toBe("saved");
        expect(panel.document.querySelector('[role="status"]')?.textContent).toContain("Nahrávka uložena");
        expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
        expect(panel.ludone.exportRecording).not.toHaveBeenCalled();

        const corrected = "ř".repeat(500);
        await enterRecordingName(panel, corrected);
        expect(input.getAttribute("aria-invalid")).toBe("false");
        await panel.click(panel.document.querySelector('button[type="submit"]'));
        await panel.waitForPhase("idle");
        expect(panel.ludone.exportRecording).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
          recordingName: corrected, openUploadPage: true,
        });
        expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
      } finally {
        await panel.cleanup();
      }
    },
  );

  it.each(["ř".repeat(500), "😀".repeat(250), `  ${"ř".repeat(500)}  `, "", "   "])(
    "přijme nejvýš 500 jednotek po trim i prázdný název (%#)",
    async (name) => {
      const panel = await renderRecordingCard();
      try {
        await startRecording(panel);
        await stopRecording(panel);
        await enterRecordingName(panel, name);
        await panel.click(panel.document.querySelector('button[type="submit"]'));
        await panel.waitForPhase("idle");
        expect(panel.ludone.exportRecording).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
          recordingName: name, openUploadPage: true,
        });
      } finally {
        await panel.cleanup();
      }
    },
  );

  it("po odmítnutí dlouhého názvu dovolí Nechat na Macu s opraveným názvem", async () => {
    const panel = await renderRecordingCard();
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await enterRecordingName(panel, "ř".repeat(501));
      await panel.click(panel.document.querySelector('button[type="submit"]'));
      expect(panel.ludone.exportRecording).not.toHaveBeenCalled();
      await enterRecordingName(panel, "Lokální porada");
      await panel.click(panel.document.querySelector('[data-testid="skip-recording-name"]'));
      await panel.waitForPhase("idle");
      expect(panel.ludone.exportRecording).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: "Lokální porada", openUploadPage: false,
      });
    } finally {
      await panel.cleanup();
    }
  });

  it("při nahrávání ani s tichými stopami netvrdí, že jsou ověřeny", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      panel.setLevelAmplitudes({ microphone: 0, system: 0 });
      await panel.sampleLevels();

      // Kontrolujeme i skrytý text, aby se nepravdivé tvrzení nevrátilo do DOM.
      expect(panel.document.body.textContent).not.toMatch(/ověřen/iu);

      // Po odstranění hlášky zůstává odečítači stav nahrávání i názvy zdrojů.
      const status = panel.document.querySelector('[data-testid="recording-running-state"]');
      expect(status?.getAttribute("role")).toBe("status");
      expect(status?.textContent).toBe("Nahrává se");
      expect(status?.closest('[aria-hidden="true"]')).toBeNull();
      const labels = [...panel.document.querySelectorAll(".recording-source__label")];
      expect(labels.map((label) => label.textContent)).toEqual(["Mikrofon", "Ostatní zvuk"]);
      for (const label of labels) {
        expect(label.closest('[aria-hidden="true"]')).toBeNull();
      }

      await stopRecording(panel);
    } finally {
      await panel.cleanup();
    }
  });

  it("za běhu mění oba pruhy podle ticha a hlasitého vstupu", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      panel.setLevelAmplitudes({ microphone: 0, system: 0 });
      await panel.sampleLevels();

      const microphoneFill = panel.document.querySelector(
        '[data-testid="recording-source-microphone"] .recording-source__fill',
      );
      const systemFill = panel.document.querySelector(
        '[data-testid="recording-source-system"] .recording-source__fill',
      );
      expect(panel.document.defaultView.getComputedStyle(microphoneFill).width)
        .toBe("var(--audio-level-measured, 0%)");
      expect(panel.document.defaultView.getComputedStyle(systemFill).width)
        .toBe("var(--audio-level-measured, 0%)");
      const quietMicrophone = liveMeterWidthPercent(microphoneFill);
      const quietSystem = liveMeterWidthPercent(systemFill);

      panel.setLevelAmplitudes({ microphone: 0.25, system: 0 });
      await panel.sampleLevels();
      const loudMicrophone = liveMeterWidthPercent(microphoneFill);
      const systemDuringLoudMicrophone = liveMeterWidthPercent(systemFill);

      panel.setLevelAmplitudes({ microphone: 0, system: 0.25 });
      await panel.sampleLevels();
      const microphoneDuringLoudSystem = liveMeterWidthPercent(microphoneFill);
      const loudSystem = liveMeterWidthPercent(systemFill);

      expect(loudMicrophone - quietMicrophone).toBeGreaterThan(40);
      expect(loudSystem - quietSystem).toBeGreaterThan(40);
      expect(systemDuringLoudMicrophone).toBeLessThanOrEqual(5);
      expect(microphoneDuringLoudSystem).toBeLessThanOrEqual(5);
      expect(quietMicrophone).toBeLessThanOrEqual(5);
      expect(quietSystem).toBeLessThanOrEqual(5);
      expect(panel.audioContexts).toHaveLength(1);
      expect(panel.audioContexts[0].analysers.map(({ track }) => track)).toEqual([
        panel.recorders[0].stream.getAudioTracks()[0],
        panel.recorders[1].stream.getAudioTracks()[0],
      ]);

      await stopRecording(panel);
    } finally {
      await panel.cleanup();
    }
  });

  it("selhání měřidla nezasáhne do nahrávání ani uložení stop", async () => {
    const panel = await renderRecordingCard({
      analyserError: new Error("Analyser není dostupný"),
    });

    try {
      await startRecording(panel);
      await panel.sampleLevels();

      expect(panel.phase()).toBe("recording");
      expect(panel.audioContexts).toHaveLength(1);
      expect(panel.recorders).toHaveLength(3);
      expect(panel.recorders.map((recorder) => recorder.options.audioBitsPerSecond))
        .toEqual([128_000, 128_000, 96_000]);
      expect(panel.ludone.beginRecording).toHaveBeenCalledWith(["microphone", "system"]);
      for (const meter of panel.document.querySelectorAll(".audio-level-meter")) {
        expect(meter.dataset.measurementState).toBe("unavailable");
        expect(Number.parseFloat(
          panel.document.defaultView.getComputedStyle(
            meter.querySelector(".audio-level-meter__fill"),
          ).width,
        )).toBe(2);
      }

      await stopRecording(panel);
      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
      expect(panel.phase()).toBe("saved");
    } finally {
      await panel.cleanup();
    }
  });

  it("chyba při čtení měřidlo nenechá zamrzlé a nahrávání pokračuje", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      panel.setLevelAmplitudes({ microphone: 0.25, system: 0 });
      await panel.sampleLevels();
      const microphoneFill = panel.document.querySelector(
        '[data-testid="recording-source-microphone"] .recording-source__fill',
      );
      expect(liveMeterWidthPercent(microphoneFill)).toBeGreaterThan(40);

      panel.failNextLevelRead("microphone");
      await panel.sampleLevels();
      expect(microphoneFill.closest(".audio-level-meter")?.dataset.measurementState)
        .toBe("unavailable");
      expect(Number.parseFloat(
        panel.document.defaultView.getComputedStyle(microphoneFill).width,
      )).toBe(2);
      expect(panel.phase()).toBe("recording");
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();

      await panel.sampleLevels();
      expect(microphoneFill.closest(".audio-level-meter")?.dataset.measurementState)
        .toBe("measured");
      expect(liveMeterWidthPercent(microphoneFill)).toBeGreaterThan(40);

      await stopRecording(panel);
      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
    } finally {
      await panel.cleanup();
    }
  });

  it("při spuštění požádá o mikrofon i systémový zvuk", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);

      expect(panel.getUserMedia).toHaveBeenCalledTimes(1);
      expect(panel.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
        audio: expect.anything(),
      }));
      expect(panel.getDisplayMedia).toHaveBeenCalledTimes(1);
      expect(panel.getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({
        audio: expect.anything(),
      }));
      expect(panel.ludone.beginRecording).toHaveBeenCalledWith(["microphone", "system"]);
      expect(panel.recorders).toHaveLength(3);

      await stopRecording(panel);
    } finally {
      await panel.cleanup();
    }
  });

  it("jen s mikrofonem nahrává dál a po zjištění chybějícího zvuku varuje", async () => {
    const denied = new DOMException("Přístup zamítnut", "NotAllowedError");
    const panel = await renderRecordingCard({
      deferCapture: true,
      displayError: denied,
    });

    try {
      await panel.click(panel.currentButton());
      await React.act(async () => {
        await vi.waitFor(() => {
          expect(panel.phase()).toBe("checking");
          expect(panel.document.body.textContent).toContain("Ověřuji mikrofon a zvuk z počítače");
          expect(panel.document.body.textContent).not.toContain(MICROPHONE_ONLY_TEXT);
        });
        panel.resolveCapture();
      });
      await panel.waitForPhase("recording");
      panel.setLevelAmplitudes({ microphone: 0.25, system: 0.25 });
      await panel.sampleLevels();

      const card = panel.document.querySelector('[aria-label="Nahrávání"]');
      expect(card?.getAttribute("data-system-audio-state")).toBe("unavailable");
      expect(card?.textContent).toContain("Nahrává se omezeně");
      expect(card?.textContent).toContain(MICROPHONE_ONLY_TEXT);
      // 🔴 Během nahrávání se varuje KONKRÉTNĚ, ne obecným textem: dřív tu stálo totéž,
      // co u kontroly před startem, a člověk z toho nepoznal, že mu chybí povolení.
      // Nahrávání zvuku z jiných aplikací je samostatné oprávnění, ne Záznam obrazovky.
      expect(card?.textContent).toContain("samostatné povolení");
      expect(card?.textContent).toContain("oddělené od Záznamu obrazovky");
      // A důvod od systému se nesmí zahodit — právě jeho absence stála hodiny hádání.
      expect(card?.textContent).toContain("Přístup zamítnut");
      const systemFill = card?.querySelector(
        '[data-testid="recording-source-system"] .recording-source__fill',
      );
      const microphoneFill = card?.querySelector(
        '[data-testid="recording-source-microphone"] .recording-source__fill',
      );
      expect(liveMeterWidthPercent(microphoneFill)).toBeGreaterThan(40);
      expect(microphoneFill.closest(".audio-level-meter")?.dataset.measurementState)
        .toBe("measured");
      expect(Number.parseFloat(
        panel.document.defaultView.getComputedStyle(systemFill).width,
      )).toBe(2);
      expect(systemFill.closest(".audio-level-meter")?.dataset.measurementState)
        .toBe("unavailable");
      expect(panel.ludone.beginRecording).toHaveBeenCalledWith(["microphone"]);
      expect(panel.recorders).toHaveLength(2);
      expect(panel.audioContexts).toHaveLength(1);
      expect(panel.audioContexts[0].analysers.map(({ track }) => track)).toEqual([
        panel.recorders[0].stream.getAudioTracks()[0],
      ]);
      expect(panel.audioContexts[0].connections).toEqual([
        expect.objectContaining({
          input: 0,
          output: 0,
          target: panel.audioContexts[0].merger,
          track: panel.microphoneTrack,
        }),
      ]);

      await stopRecording(panel);
      expect(panel.ludone.finishRecording).toHaveBeenCalledWith(
        SESSION_ID,
        {
          microphone: expect.objectContaining({
            startedAt: expect.any(String),
            endedAt: expect.any(String),
          }),
        },
      );
      expect(panel.ludone.appendRecordingChunk.mock.calls.some(([, source]) => (
        source === "system"
      ))).toBe(false);
    } finally {
      await panel.cleanup();
    }
  });

  it("bez mikrofonu nahrávání nespustí a řekne proč", async () => {
    const denied = new DOMException("Přístup k mikrofonu zamítnut", "NotAllowedError");
    const panel = await renderRecordingCard({ microphoneError: denied });

    try {
      await panel.click(panel.currentButton());
      await React.act(async () => {
        await vi.waitFor(() => {
          const alert = panel.document.querySelector('[data-recording-phase] [role="alert"]');
          expect(alert?.textContent).toContain("Tvůj hlas. Bez něj nenahraješ nic.");
        });
      });

      expect(panel.phase()).toBe("idle");
      expect(panel.ludone.beginRecording).not.toHaveBeenCalled();
      expect(panel.getUserMedia).toHaveBeenCalledTimes(1);
      expect(panel.getDisplayMedia).toHaveBeenCalledTimes(1);
      const alert = panel.document.querySelector('[data-recording-phase] [role="alert"]');
      expect(alert?.textContent).toContain("Tvůj hlas. Bez něj nenahraješ nic.");
    } finally {
      await panel.cleanup();
    }
  });

  it("druhý klik během přípravy nespustí druhou nahrávku", async () => {
    const panel = await renderRecordingCard({ deferCapture: true });
    const startButton = panel.currentButton();

    try {
      await React.act(async () => {
        startButton.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
        expect(startButton.isConnected).toBe(true);
        startButton.dispatchEvent(new panel.document.defaultView.MouseEvent("click", { bubbles: true }));
      });

      expect(panel.getUserMedia).toHaveBeenCalledTimes(1);
      expect(panel.getDisplayMedia).toHaveBeenCalledTimes(1);
      expect(panel.ludone.beginRecording).not.toHaveBeenCalled();

      await React.act(async () => {
        panel.resolveCapture();
      });
      await panel.waitForPhase("recording");

      expect(panel.ludone.beginRecording).toHaveBeenCalledTimes(1);
      expect(panel.recorders).toHaveLength(3);
      await stopRecording(panel);
    } finally {
      await panel.cleanup();
    }
  });

  it("zastavení dokončí rozepsanou session", async () => {
    const panel = await renderRecordingCard();
    // Události rekordérů mají pevné časové značky; oba převodní časy musí mít
    // stejnou kotvu, jinak jejich nezávislé odečty kolísají o milisekundu.
    const wallClock = vi.spyOn(Date, "now").mockReturnValue(1_788_349_200_000);
    const monotonicClock = vi.spyOn(globalThis.performance, "now").mockReturnValue(1_000);

    try {
      await startRecording(panel);
      await stopRecording(panel);

      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
      expect(panel.ludone.finishRecording).toHaveBeenCalledWith(
        SESSION_ID,
        {
          microphone: expect.objectContaining({
            startedAt: expect.any(String),
            endedAt: expect.any(String),
          }),
          system: expect.objectContaining({
            startedAt: expect.any(String),
            endedAt: expect.any(String),
          }),
        },
      );
      const trackTimings = panel.ludone.finishRecording.mock.calls[0][1];
      expect(Math.abs(
        Date.parse(trackTimings.microphone.startedAt)
        - Date.parse(trackTimings.system.startedAt),
      )).toBe(25);
      expect(panel.phase()).toBe("saved");
    } finally {
      wallClock.mockRestore();
      monotonicClock.mockRestore();
      await panel.cleanup();
    }
  });

  it("příkaz z kontextového menu bezpečně dokončí rozepsanou session", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      await panel.setTrayCommand({ id: 1, name: "stop-recording" });
      await panel.waitForPhase("saved");

      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
    } finally {
      await panel.cleanup();
    }
  });

  // TDD_OPRAVA_QUIT_START_LATCH_20260903: stop doručený během beginRecording se neztratí.
  it("podrží stop příkaz, který dorazí během přípravy hlavní session", async () => {
    const panel = await renderRecordingCard({ deferBegin: true });

    try {
      await panel.click(panel.currentButton());
      await vi.waitFor(() => expect(panel.ludone.beginRecording).toHaveBeenCalledOnce());
      expect(panel.phase()).toBe("checking");

      await panel.setTrayCommand({ id: 1, name: "stop-recording" });
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();

      await React.act(async () => {
        panel.resolveBeginRecording();
        await Promise.resolve();
      });
      await panel.waitForPhase("saved");

      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
      expect(panel.ludone.finishRecordingExport).toHaveBeenCalledTimes(1);
      expect(panel.recorders).toHaveLength(3);
    } finally {
      await panel.cleanup();
    }
  });

  it("předá vyrobené chunky obou rekordérů do úložiště", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      const microphoneRecorder = panel.recorders.find(
        (recorder) => recorder.stream.getTracks()[0] === panel.microphoneTrack,
      );
      const systemRecorder = panel.recorders.find(
        (recorder) => recorder.stream.getTracks()[0] === panel.systemOutputTrack,
      );
      const microphoneData = new ArrayBuffer(4);
      const systemData = new ArrayBuffer(6);

      microphoneRecorder.emitChunk({
        size: microphoneData.byteLength,
        arrayBuffer: vi.fn().mockResolvedValue(microphoneData),
      });
      systemRecorder.emitChunk({
        size: systemData.byteLength,
        arrayBuffer: vi.fn().mockResolvedValue(systemData),
      });

      await vi.waitFor(() => expect(panel.ludone.appendRecordingChunk).toHaveBeenCalledTimes(2));
      expect(panel.ludone.appendRecordingChunk).toHaveBeenCalledWith(
        SESSION_ID,
        "microphone",
        0,
        microphoneData,
      );
      expect(panel.ludone.appendRecordingChunk).toHaveBeenCalledWith(
        SESSION_ID,
        "system",
        0,
        systemData,
      );

      await stopRecording(panel);
    } finally {
      await panel.cleanup();
    }
  });

  it("po uložení nabídne samostatné tlačítko Uložit a odeslat", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      await panel.click(panel.currentButton());
      await React.act(async () => {
        await vi.waitFor(() => {
          expect(panel.document.querySelector("[data-recording-phase]")?.textContent)
            .toContain("Nahrávka uložena");
          expect(panel.currentButton()?.textContent).toContain("Uložit a odeslat");
        });
      });
      expect(panel.ludone.exportRecording).not.toHaveBeenCalled();
    } finally {
      await panel.cleanup();
    }
  });

  it.each([
    { seconds: 0, expected: "0 sekund" },
    { seconds: 1, expected: "1 sekunda" },
    { seconds: 2, expected: "2 sekundy" },
    { seconds: 5, expected: "5 sekund" },
    { seconds: 8, expected: "8 sekund" },
    { seconds: 59, expected: "59 sekund" },
    // 59,6 s se zaokrouhlí na celou minutu. Kdyby o jednotce rozhodovala délka PŘED
    // zaokrouhlením, vypsalo by se „60 sekund“ — tvar, který nikdo neřekne.
    { seconds: 59.6, expected: "1 minuta" },
    { seconds: 60, expected: "1 minuta" },
    { seconds: 89, expected: "1 minuta" },
    { seconds: 90, expected: "2 minuty" },
    { seconds: 300, expected: "5 minut" },
  ])("po uložení $seconds s ukáže přesně $expected", async ({ seconds, expected }) => {
    const panel = await renderRecordingCard();
    const startedAt = "2026-09-02T12:00:00.000Z";
    panel.ludone.finishRecording.mockResolvedValue({
      ...recordingResult(),
      startedAt,
      endedAt: new Date(Date.parse(startedAt) + (seconds * 1_000)).toISOString(),
    });

    try {
      await startRecording(panel);
      await stopRecording(panel);

      expect(panel.document.querySelector(
        ".recording-saved__meta small:last-child",
      )?.textContent).toBe(`${expected} · původní stopy na Macu 10 B`);
    } finally {
      await panel.cleanup();
    }
  });

  it.each([
    { minutes: 59, stale: false },
    { minutes: 61, stale: true },
  ])("stáří po $minutes minutách je stale=$stale", ({ minutes, stale }) => {
    const endedAt = new Date("2026-10-16T17:48:00.000Z");
    const now = new Date(endedAt.getTime() + minutes * 60_000);

    expect(savedRecordingAge(endedAt, now).stale).toBe(stale);
  });

  it("stáří čtyř dnů má české skloňování", () => {
    expect(savedRecordingAge(
      "2026-10-16T17:48:00.000Z",
      "2026-10-20T17:48:00.000Z",
    )).toEqual({ stale: true, label: "před 4 dny" });
  });

  it("minuty a hodiny skloňuje v instrumentálu po slově před", () => {
    const endedAt = new Date("2026-10-16T17:48:00.000Z");

    expect(savedRecordingAge(endedAt, new Date(endedAt.getTime() + 2 * 60_000)).label)
      .toBe("před 2 minutami");
    expect(savedRecordingAge(endedAt, new Date(endedAt.getTime() + 2 * 60 * 60_000)).label)
      .toBe("před 2 hodinami");
  });

  it("čerstvá nahrávka zachová dosavadní text", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T18:47:00.000Z"));
    const panel = await renderRecordingCard({ finishRecordingResult: {
      startedAt: "2026-10-16T17:31:00.000Z",
      endedAt: "2026-10-16T17:48:00.000Z",
    } });

    try {
      await startRecording(panel);
      await stopRecording(panel);

      expect(panel.document.querySelector(".recording-saved__stopped")?.textContent.trim())
        .toBe("Zvuk bezpečně zastaven");
      expect(panel.document.querySelector(".recording-saved__meta small:first-child")?.textContent)
        .toBe("16. října, 19:31–19:48");
    } finally {
      await panel.cleanup();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("stará nahrávka ukáže čekání, stáří a rok při změně kalendářního roku", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-02T12:00:00.000Z"));
    const panel = await renderRecordingCard({ finishRecordingResult: {
      startedAt: "2026-12-31T10:00:00.000Z",
      endedAt: "2026-12-31T10:17:00.000Z",
    } });

    try {
      await startRecording(panel);
      await stopRecording(panel);

      expect(panel.document.querySelector(".recording-saved__stopped")?.textContent.trim())
        .toBe("Nahrávka čeká na odeslání");
      expect(panel.document.querySelector(".recording-saved__meta small:first-child")?.textContent)
        .toBe("31. prosince 2026, 11:00–11:17 · před 2 dny");
    } finally {
      await panel.cleanup();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("otevřený dialog přejde na starou nahrávku po překročení hodiny", async () => {
    vi.useFakeTimers();
    const endedAt = "2026-10-16T17:48:00.000Z";
    vi.setSystemTime(new Date(Date.parse(endedAt) + 59 * 60_000));
    const panel = await renderRecordingCard({ finishRecordingResult: {
      startedAt: "2026-10-16T17:31:00.000Z",
      endedAt,
    } });

    try {
      await startRecording(panel);
      await stopRecording(panel);
      expect(panel.document.querySelector(".recording-saved__stopped")?.textContent.trim())
        .toBe("Zvuk bezpečně zastaven");

      await React.act(async () => vi.advanceTimersByTimeAsync(60_001));

      expect(panel.document.querySelector(".recording-saved__stopped")?.textContent.trim())
        .toBe("Nahrávka čeká na odeslání");
      expect(panel.document.querySelector(".recording-saved__meta small:first-child")?.textContent)
        .toBe("16. října, 19:31–19:48 · před 1 hodinou");
    } finally {
      await panel.cleanup();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("UTC časy zobrazí v místním pásmu Europe/Prague", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T18:47:00.000Z"));
    const panel = await renderRecordingCard({ finishRecordingResult: {
      startedAt: "2026-10-16T17:31:00.000Z",
      endedAt: "2026-10-16T17:48:00.000Z",
    } });

    try {
      await startRecording(panel);
      await stopRecording(panel);

      expect(panel.document.querySelector(".recording-saved__meta small:first-child")?.textContent)
        .toBe("16. října, 19:31–19:48");
    } finally {
      await panel.cleanup();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("přechod z CEST na CET zachová dvě 02:30 a skutečnou délku 60 minut", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T02:00:00.000Z"));
    const startedAt = "2026-10-25T00:30:00.000Z";
    const endedAt = "2026-10-25T01:30:00.000Z";
    const panel = await renderRecordingCard({ finishRecordingResult: { startedAt, endedAt } });

    try {
      await startRecording(panel);
      await stopRecording(panel);

      expect(new Date(startedAt).getTimezoneOffset()).toBe(-120);
      expect(new Date(endedAt).getTimezoneOffset()).toBe(-60);
      expect(Date.parse(endedAt) - Date.parse(startedAt)).toBe(60 * 60_000);
      expect(panel.document.querySelector(".recording-saved__meta small:first-child")?.textContent)
        .toBe("25. října, 02:30–02:30");
      expect(panel.document.querySelector(".recording-saved__meta small:last-child")?.textContent)
        .toContain("60 minut");
    } finally {
      await panel.cleanup();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it.each([
    {
      description: "chybějící začátek",
      startedAt: undefined,
      endedAt: "2026-09-02T12:00:08.000Z",
    },
    {
      description: "nesmyslný konec",
      startedAt: "2026-09-02T12:00:00.000Z",
      endedAt: "není datum",
    },
  ])("neplatné datum ($description) nespadne ani nevypíše NaN", async ({
    startedAt,
    endedAt,
  }) => {
    const panel = await renderRecordingCard();
    panel.ludone.finishRecording.mockResolvedValue({
      ...recordingResult(),
      startedAt,
      endedAt,
    });

    try {
      await startRecording(panel);
      await stopRecording(panel);

      expect(panel.phase()).toBe("saved");
      expect(panel.document.querySelector(".recording-saved__meta")?.textContent)
        .not.toContain("NaN");
    } finally {
      await panel.cleanup();
    }
  });

  it("s rozbalenou frontou jsou po dokončení nahrávky obě akce dosažitelné na 400px ploše", async () => {
    const panel = await renderRecordingCard({
      queueItems: [{
        id: "cekajici-nahravka",
        kind: "recording",
        nextAttemptAt: Date.now() + 120_000,
        sizeBytes: 12 * 1024 * 1024,
        state: "ceka",
      }],
      renderApp: true,
    });
    const restoreGeometry = installSavedPanelGeometry(panel.document.defaultView);

    try {
      await vi.waitFor(() => {
        expect(panel.document.querySelector('.osa-rail [data-page="queue"] .osa-count')?.textContent).toBe("1");
      });
      await panel.click(panel.document.querySelector('.osa-rail [data-page="queue"]'));
      expect(panel.document.querySelector('[data-testid="queue-screen"]')).not.toBeNull();
      expect(panel.document.defaultView.getComputedStyle(
        panel.document.querySelector('[data-testid="queue-screen"]'),
      ).display).not.toBe("none");

      await panel.click(panel.document.querySelector('.osa-rail [data-page="home"]'));
      await startRecording(panel);
      await stopRecording(panel);

      const surfaceRect = panel.document.querySelector(".osa-shell")
        .getBoundingClientRect();
      expect(surfaceRect.height).toBe(366);
      const actions = [
        panel.document.querySelector('.recording-saved button[type="submit"]'),
        panel.document.querySelector('[data-testid="skip-recording-name"]'),
      ];
      for (const action of actions) {
        const actionRect = action.getBoundingClientRect();
        expect(actionRect.width).toBeGreaterThan(0);
        expect(actionRect.height).toBeGreaterThan(0);
        expect(actionRect.top).toBeGreaterThanOrEqual(surfaceRect.top);
        expect(actionRect.bottom).toBeLessThanOrEqual(surfaceRect.bottom);
      }

      await panel.click(panel.document.querySelector('[data-testid="skip-recording-name"]'));
      await panel.waitForPhase("idle");
      await panel.click(panel.document.querySelector('.osa-rail [data-page="queue"]'));
      expect(panel.document.querySelector('[data-testid="queue-screen"]')).not.toBeNull();
      expect(panel.ludone.exportRecording).toHaveBeenCalledWith(SESSION_ID, { recordingName: DEFAULT_RECORDING_NAME, openUploadPage: false });
    } finally {
      restoreGeometry();
      await panel.cleanup();
    }
  });

  it("pojmenování předvyplní datum a čas, fokusuje pole a předá změněný název", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      await stopRecording(panel);

      const input = panel.document.querySelector('[data-testid="recording-name-input"]');
      expect(input).toBeInstanceOf(panel.document.defaultView.HTMLInputElement);
      const savedStatus = panel.document.querySelector('[data-recording-phase="saved"] [role="status"]');
      expect(savedStatus?.textContent?.trim().length).toBeGreaterThan(0);
      expect(input.getAttribute("aria-describedby")).toContain("recording-name-hint");
      expect(input.value).toMatch(/2026/);
      expect(input.value).toMatch(/\d{1,2}:\d{2}/);
      expect(panel.document.activeElement).toBe(input);

      await React.act(async () => {
        input.value = "Porada / provozu";
        input.dispatchEvent(new panel.document.defaultView.Event("input", { bubbles: true }));
      });
      expect(input.value).toBe("Porada / provozu");
      await panel.click(panel.document.querySelector('button[type="submit"]'));
      await panel.waitForPhase("idle");

      expect(panel.ludone.exportRecording).toHaveBeenCalledWith(
        SESSION_ID,
        { recordingName: "Porada / provozu", openUploadPage: true },
      );
      const status = panel.document.querySelector('[data-recording-phase] [role="status"]');
      expect(status?.textContent?.trim().length).toBeGreaterThan(0);
      expect(status?.hidden).toBe(false);
    } finally {
      await panel.cleanup();
    }
  });

  it("Nechat na Macu neztratí dokončenou nahrávku a zachová název", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      await stopRecording(panel);

      const skip = panel.document.querySelector('[data-testid="skip-recording-name"]');
      await panel.click(skip);
      await panel.waitForPhase("idle");

      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
      expect(panel.ludone.exportRecording).toHaveBeenCalledWith(SESSION_ID, { recordingName: DEFAULT_RECORDING_NAME, openUploadPage: false });
      const status = panel.document.querySelector('[data-recording-phase] [role="status"]');
      expect(status?.textContent?.trim().length).toBeGreaterThan(0);
      expect(status?.hidden).toBe(false);
    } finally {
      await panel.cleanup();
    }
  });

  it.each([
    ["Nechat na Macu", '[data-testid="skip-recording-name"]', false],
    ["Uložit a odeslat", 'button[type="submit"]', true],
  ])("%s potvrdí místní uložení bez tvrzení o kopii ve Stažených", async (label, selector, openUploadPage) => {
    const panel = await renderRecordingCard();
    try {
      await startRecording(panel);
      await stopRecording(panel);
      const button = panel.document.querySelector(selector);
      expect(button.textContent.trim()).toBe(label);
      await panel.click(button);
      await panel.waitForPhase("idle");

      expect(panel.ludone.exportRecording).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: expect.any(String),
        openUploadPage,
      });
      expect(panel.ludone.exportRecordingCopy).not.toHaveBeenCalled();
      expect(panel.document.querySelector('[role="status"]')?.textContent)
        .toContain("Nahrávka byla uložena na Macu.");
      expect(panel.document.querySelector('[role="status"]')?.textContent)
        .not.toContain("Stažených");
    } finally {
      await panel.cleanup();
    }
  });

  it("při selhání otevření stránky uživateli řekne, že soubor je uložený", async () => {
    const panel = await renderRecordingCard();
    panel.ludone.exportRecording.mockResolvedValueOnce({
      ok: false,
      recordingExported: true,
      message: "Soubor je uložený ve Stažených, ale nahrávací stránku se nepodařilo otevřít. "
        + "Původní dvě stopy zůstaly uložené.",
    });
    try {
      await startRecording(panel);
      await stopRecording(panel);
      await panel.click(panel.document.querySelector('button[type="submit"]'));

      expect(panel.document.querySelector('[role="alert"]')?.textContent)
        .toContain("Soubor je uložený ve Stažených, ale nahrávací stránku se nepodařilo otevřít.");
      expect(panel.phase()).toBe("saved");
    } finally {
      await panel.cleanup();
    }
  });

  it("uložení původních stop nečeká na dokončení stereo exportu", async () => {
    const panel = await renderRecordingCard();
    panel.ludone.finishRecordingExport.mockImplementation(() => new Promise(() => {}));

    try {
      await startRecording(panel);
      await stopRecording(panel);

      expect(panel.phase()).toBe("saved");
      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
      expect(panel.ludone.finishRecordingExport).toHaveBeenCalledTimes(1);
      expect(panel.audioContexts[0].close).toHaveBeenCalledTimes(1);
      expect(panel.currentButton()?.textContent).toContain("Uložit a odeslat");
    } finally {
      await panel.cleanup();
    }
  });

  it("selhání exportu ponechá uloženou nahrávku i možnost pokus opakovat", async () => {
    const panel = await renderRecordingCard();
    panel.ludone.exportRecording.mockRejectedValueOnce(new Error("Disk je plný"));

    try {
      await startRecording(panel);
      await panel.click(panel.currentButton());
      await React.act(async () => {
        await vi.waitFor(() => expect(panel.currentButton()?.textContent).toContain("Uložit a odeslat"));
      });
      await panel.click(panel.currentButton());
      await React.act(async () => {
        await vi.waitFor(() => {
          const alert = panel.document.querySelector('[data-recording-phase] [role="alert"]');
          expect(alert?.textContent?.trim().length).toBeGreaterThan(0);
          expect(alert?.hidden).toBe(false);
          expect(panel.currentButton()?.textContent).toContain("Uložit a odeslat");
        });
      });

      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
      expect(panel.ludone.exportRecording).toHaveBeenCalledWith(
        SESSION_ID,
        { recordingName: expect.any(String), openUploadPage: true },
      );
    } finally {
      await panel.cleanup();
    }
  });

  it("při selhání přípravy exportu během quitu ukáže následek a ukončí až po potvrzení", async () => {
    const panel = await renderRecordingCard({
      finishRecordingExportResult: {
        ok: false,
        message: "Dvoukanálový export se nepodařilo připravit. Původní dvě stopy zůstaly uložené.",
        quitConfirmationRequired: true,
      },
    });

    try {
      await startRecording(panel);
      await stopRecording(panel);
      await React.act(async () => {
        await vi.waitFor(() => {
          const alert = panel.document.querySelector('[data-testid="quit-export-failure"]');
          expect(alert?.getAttribute("role")).toBe("alert");
          expect(alert?.textContent).toContain("Původní dvě stopy zůstaly uložené");
          expect(alert?.textContent).toContain(
            "Originály i rozpracovaný stereo soubor zůstanou na Macu",
          );
        });
      });

      expect(panel.ludone.confirmRecordingExportFailure).not.toHaveBeenCalled();
      const confirmButton = panel.document.querySelector(
        '[data-testid="confirm-quit-after-export-failure"]',
      );
      expect(confirmButton?.textContent).toContain("Ukončit LuDone");
      panel.ludone.confirmRecordingExportFailure.mockResolvedValueOnce({ confirmed: false });
      await panel.click(confirmButton);
      expect(panel.ludone.confirmRecordingExportFailure).toHaveBeenCalledExactlyOnceWith(
        SESSION_ID,
      );
      await React.act(async () => {
        await vi.waitFor(() => {
          expect(panel.document.querySelector('[data-testid="quit-export-failure"]')?.textContent)
            .toContain("Původní stopy se ještě ukládají");
        });
      });
      await panel.click(confirmButton);
      expect(panel.ludone.confirmRecordingExportFailure).toHaveBeenCalledTimes(2);
      expect(panel.ludone.exportRecording).not.toHaveBeenCalled();
    } finally {
      await panel.cleanup();
    }
  });

  it("selhání přípravy exportu mimo quit nezmění obrazovku uložené nahrávky", async () => {
    const panel = await renderRecordingCard({
      finishRecordingExportResult: {
        ok: false,
        message: "Dvoukanálový export se nepodařilo připravit. Původní dvě stopy zůstaly uložené.",
      },
    });

    try {
      await startRecording(panel);
      await stopRecording(panel);
      await React.act(async () => {
        await Promise.resolve();
      });

      expect(panel.phase()).toBe("saved");
      expect(panel.document.querySelector('[data-testid="quit-export-failure"]')).toBeNull();
      expect(panel.currentButton()?.textContent).toContain("Uložit a odeslat");
      expect(panel.ludone.confirmRecordingExportFailure).not.toHaveBeenCalled();
    } finally {
      await panel.cleanup();
    }
  });

  it("definitivní konec systémové stopy okamžitě zobrazí výpadek", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      panel.setLevelAmplitudes({ microphone: 0, system: 0.25 });
      await panel.sampleLevels();
      await React.act(async () => {
        panel.systemTrack.readyState = "ended";
        panel.systemTrack.dispatchEvent(new panel.document.defaultView.Event("ended"));
        await Promise.resolve();
      });
      await panel.sampleLevels();

      const card = panel.document.querySelector('[aria-label="Nahrávání"]');
      const outage = panel.document.querySelector('[data-testid="system-audio-outage"]');
      expect(card?.getAttribute("data-recording-phase")).toBe("recording");
      expect(card?.getAttribute("data-system-audio-state")).toBe("lost");
      expect(outage).not.toBeNull();
      expect(outage?.getAttribute("role")).toBe("alert");
      expect(outage?.hidden).toBe(false);
      const systemFill = card?.querySelector(
        '[data-testid="recording-source-system"] .recording-source__fill',
      );
      expect(Number.parseFloat(
        panel.document.defaultView.getComputedStyle(systemFill).width,
      )).toBe(2);
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();
    } finally {
      await panel.cleanup();
    }
  });

  it("krátké ztišení pod dvě sekundy nehlásí ztrátu stopy", async () => {
    vi.useFakeTimers();
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      await React.act(async () => {
        panel.systemTrack.muted = true;
        panel.systemTrack.dispatchEvent(new panel.document.defaultView.Event("mute"));
        await vi.advanceTimersByTimeAsync(1_999);
      });

      let card = panel.document.querySelector('[aria-label="Nahrávání"]');
      expect(card?.getAttribute("data-recording-phase")).toBe("recording");
      expect(card?.getAttribute("data-system-audio-state")).toBe("live");
      expect(panel.document.querySelector('[data-testid="system-audio-outage"]')).toBeNull();
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();

      await React.act(async () => {
        panel.systemTrack.muted = false;
        panel.systemTrack.dispatchEvent(new panel.document.defaultView.Event("unmute"));
        await vi.advanceTimersByTimeAsync(2_000);
      });

      card = panel.document.querySelector('[aria-label="Nahrávání"]');
      expect(card?.getAttribute("data-recording-phase")).toBe("recording");
      expect(card?.getAttribute("data-system-audio-state")).toBe("live");
      expect(panel.document.querySelector('[data-testid="system-audio-outage"]')).toBeNull();
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();
    } finally {
      await panel.cleanup();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("po potvrzeném výpadku mikrofon pokračuje a nahrávku lze uložit", async () => {
    vi.useFakeTimers();
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      await React.act(async () => {
        panel.systemTrack.muted = true;
        panel.systemTrack.dispatchEvent(new panel.document.defaultView.Event("mute"));
        await vi.advanceTimersByTimeAsync(2_000);
      });

      expect(panel.phase()).toBe("recording");
      expect(panel.document.querySelector('[data-testid="system-audio-outage"]')).not.toBeNull();
      expect(panel.recorders[0].state).toBe("recording");
      expect(panel.recorders[1].state).toBe("recording");
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();

      await panel.click(panel.document.querySelector('[data-testid="degraded-recording-stop"]'));
      await React.act(async () => Promise.resolve());

      expect(panel.phase()).toBe("saved");
      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
    } finally {
      await panel.cleanup();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("úspěšné obnovení vrátí systémovou stopu bez restartu nahrávání", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      panel.setLevelAmplitudes({ microphone: 0, system: 0.25 });
      await React.act(async () => {
        panel.systemTrack.readyState = "ended";
        panel.systemTrack.dispatchEvent(new panel.document.defaultView.Event("ended"));
        await Promise.resolve();
      });
      expect(panel.document.querySelector('[data-testid="system-audio-outage"]')).not.toBeNull();

      await panel.click(panel.document.querySelector('[data-testid="retry-system-audio"]'));
      await React.act(async () => Promise.resolve());

      const card = panel.document.querySelector('[aria-label="Nahrávání"]');
      expect(card?.getAttribute("data-recording-phase")).toBe("recording");
      expect(card?.getAttribute("data-system-audio-state")).toBe("live");
      expect(panel.document.querySelector('[data-testid="system-audio-outage"]')).toBeNull();
      expect(panel.getDisplayMedia).toHaveBeenCalledTimes(2);
      expect(panel.recorders).toHaveLength(3);
      expect(panel.ludone.beginRecording).toHaveBeenCalledTimes(1);
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();
      expect(panel.microphoneTrack.stop).not.toHaveBeenCalled();
      expect(panel.audioContexts).toHaveLength(1);
      await panel.sampleLevels();
      const microphoneFill = card?.querySelector(
        '[data-testid="recording-source-microphone"] .recording-source__fill',
      );
      const restoredSystemFill = card?.querySelector(
        '[data-testid="recording-source-system"] .recording-source__fill',
      );
      expect(liveMeterWidthPercent(microphoneFill)).toBeLessThanOrEqual(5);
      expect(liveMeterWidthPercent(restoredSystemFill)).toBeGreaterThan(40);

      await React.act(async () => {
        panel.replacementSystemTrack.readyState = "ended";
        panel.replacementSystemTrack.dispatchEvent(
          new panel.document.defaultView.Event("ended"),
        );
        await Promise.resolve();
      });
      await panel.sampleLevels();
      expect(panel.document.querySelector('[data-testid="system-audio-outage"]')).not.toBeNull();
      expect(Number.parseFloat(
        panel.document.defaultView.getComputedStyle(restoredSystemFill).width,
      )).toBe(2);

      await panel.click(panel.document.querySelector('[data-testid="degraded-recording-stop"]'));
      await panel.waitForPhase("saved");
    } finally {
      await panel.cleanup();
    }
  });

  it("samoobnovená původní stopa zůstane živá i po neúspěšném ručním pokusu", async () => {
    vi.useFakeTimers();
    const panel = await renderRecordingCard({ deferRecovery: true });

    try {
      await startRecording(panel);
      await React.act(async () => {
        panel.systemTrack.muted = true;
        panel.systemTrack.dispatchEvent(new panel.document.defaultView.Event("mute"));
        await vi.advanceTimersByTimeAsync(2_000);
      });
      expect(panel.document.querySelector('[data-testid="system-audio-outage"]')).not.toBeNull();

      await panel.click(panel.document.querySelector('[data-testid="retry-system-audio"]'));
      await React.act(async () => {
        panel.systemTrack.muted = false;
        panel.systemTrack.dispatchEvent(new panel.document.defaultView.Event("unmute"));
        await Promise.resolve();
      });
      expect(panel.document.querySelector('[data-testid="system-audio-outage"]')).toBeNull();

      await React.act(async () => {
        panel.rejectRecovery(new DOMException("Výběr zrušen", "NotAllowedError"));
        await Promise.resolve();
      });

      const card = panel.document.querySelector('[aria-label="Nahrávání"]');
      expect(card?.getAttribute("data-system-audio-state")).toBe("live");
      expect(panel.document.querySelector('[data-testid="system-audio-outage"]')).toBeNull();
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();

      await stopRecording(panel);
    } finally {
      await panel.cleanup();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("App hlásí výpadek systémového zvuku jako boolean a po obnově jej stáhne", async () => {
    const panel = await renderRecordingCard({ renderApp: true });

    try {
      await startRecording(panel);
      await vi.waitFor(() => expect(panel.ludone.reportTrayFacts).toHaveBeenLastCalledWith({
        panelActionsAvailable: true,
        signedIn: true,
        systemAudioLost: false,
        tracking: false,
      }));

      await React.act(async () => {
        panel.systemTrack.readyState = "ended";
        panel.systemTrack.dispatchEvent(new panel.document.defaultView.Event("ended"));
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(panel.ludone.reportTrayFacts).toHaveBeenLastCalledWith({
        panelActionsAvailable: true,
        signedIn: true,
        systemAudioLost: true,
        tracking: false,
      }));

      await panel.click(panel.document.querySelector('[data-testid="retry-system-audio"]'));
      await vi.waitFor(() => expect(panel.ludone.reportTrayFacts).toHaveBeenLastCalledWith({
        panelActionsAvailable: true,
        signedIn: true,
        systemAudioLost: false,
        tracking: false,
      }));

      await stopRecording(panel);
    } finally {
      await panel.cleanup();
    }
  });

  it("App ponechá připravovaný LuTrack neaktivní i během nahrávání", async () => {
    const panel = await renderRecordingCard({ renderApp: true });

    try {
      await startRecording(panel);

      const scroll = panel.document.querySelector('[aria-label="Nahrávání schůzky"]');
      const recordingState = panel.document.querySelector('[data-testid="recording-running-state"]');
      const recordingCard = recordingState?.closest('[aria-label="Nahrávání"]');
      const futureFeature = panel.document.querySelector(".osa-lutrack");

      expect(recordingState?.hidden).toBe(false);
      expect(recordingCard?.parentElement).toBe(scroll);
      expect(recordingCard?.getAttribute("data-layout")).toBe("default");
      expect(recordingCard?.querySelector('[data-testid="recording-source-microphone"]')).not.toBeNull();
      expect(recordingCard?.querySelector('[data-testid="recording-source-system"]')).not.toBeNull();
      expect(recordingCard?.querySelector('[data-testid="recording-stop"]')).not.toBeNull();
      expect(futureFeature).toBeNull();
      const preparingControls = [...panel.document.querySelectorAll(".osa-lutrack button, .osa-lutrack input, .osa-lutrack select")];
      expect(preparingControls).toHaveLength(0);
      expect(preparingControls.every((control) => control.disabled)).toBe(true);
      expect(panel.document.querySelector('[data-testid="tracking-running-state"]')).toBeNull();

      await stopRecording(panel);
    } finally {
      await panel.cleanup();
    }
  });
});

it("nový stopform uloží firmu a private override atomicky; account default nemění", async () => {
  const panel = await renderRecordingCard({ modernDecision: true });
  const companyId = "22222222-2222-4222-8222-222222222222";
  const token = "offer-token-0000000000000001";
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }], selectedCompanyId: companyId, offerToken: token }));
  panel.ludone.selectUploadCompany = vi.fn();
  try {
    await startRecording(panel); await stopRecording(panel);
    const visibility = panel.document.querySelector('[data-testid="recording-upload-visibility"]');
    expect(visibility.value).toBe("company");
    await React.act(async () => { visibility.value = "private"; visibility.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
    await panel.click(panel.document.querySelector('button[type="submit"]'));
    expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledWith(SESSION_ID, {
      recordingName: DEFAULT_RECORDING_NAME, decision: "send", uploadPreferences: { companyId, offerToken: token, visibility: "private" },
    });
    expect(panel.ludone.selectUploadCompany).not.toHaveBeenCalled();
  } finally { await panel.cleanup(); }
});

it("K5 stopform při neověřené identitě skryje volbu, stejnému účtu vrátí draft a jinému načte jeho default", async () => {
  const panel = await renderRecordingCard({ modernDecision: true });
  const first = "11111111-1111-4111-8111-111111111111";
  const draft = "22222222-2222-4222-8222-222222222222";
  const second = "33333333-3333-4333-8333-333333333333";
  let company = first;
  panel.ludone.getUploadCompanyDefault = vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Gama" }));
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: company === first
    ? [{ id: first, name: "Alfa" }, { id: draft, name: "Beta" }] : [{ id: second, name: "Gama" }],
    selectedCompanyId: company, offerToken: "offer-token-0000000000000001" }));
  try {
    await startRecording(panel); await stopRecording(panel);
    const select = panel.document.querySelector('[data-testid="recording-upload-company"]');
    expect(select.value).toBe(first);
    await React.act(async () => { select.value = draft; select.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
    let release; const pending = new Promise((resolve) => { release = resolve; });
    await panel.changeAccount(pending);
    expect(panel.document.querySelector('[data-testid="recording-upload-preferences"]').closest("[hidden]")).not.toBeNull();
    expect(panel.document.querySelector('button[type="submit"]').disabled).toBe(true);
    await React.act(async () => release({ email: "a@example.test" }));
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(draft);
    await panel.changeAccount(null);
    expect(panel.document.querySelector('[data-testid="recording-upload-preferences"]').closest("[hidden]")).not.toBeNull();
    company = second;
    panel.setAccountBinding("22222222-2222-4222-8222-222222222222");
    await panel.changeAccount({ email: "b@example.test" });
    expect(panel.document.body.textContent).not.toContain("Beta");
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(second);
    expect(panel.document.querySelector('button[type="submit"]').disabled).toBe(false);
    await panel.click(panel.document.querySelector('button[type="submit"]'));
    expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledWith(SESSION_ID,
      expect.objectContaining({ uploadPreferences: expect.objectContaining({ companyId: second }) }));
  } finally { await panel.cleanup(); }
});

it.each([
  "Uložená session neobsahuje ověřitelnou identitu",
  "Error invoking remote method 'auth:identity': Error: Uložená session neobsahuje ověřitelnou identitu",
])("E2 produkční chyba identity vysvětlí chybějící e-mail a vyzve k novému přihlášení: %s", async (message) => {
  const panel = await renderRecordingCard({ modernDecision: true });
  const companyId = "11111111-1111-4111-8111-111111111111";
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Alfa" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  try {
    await startRecording(panel); await stopRecording(panel);
    panel.ludone.getAuthIdentity.mockRejectedValueOnce(new Error(message));
    await panel.changeAccount({ email: "a@example.test" });
    const alert = [...panel.document.querySelectorAll('[role="alert"]')].find((element) => !element.closest("[hidden]"));
    expect(alert.textContent).toMatch(/e-mail/iu);
    expect(alert.textContent).toMatch(/přihlas se znovu.*Nastavení/iu);
    expect(alert.textContent).not.toContain("Důvod se nepodařilo zjistit");
    expect(panel.document.querySelector('button[type="submit"]').disabled).toBe(true);
  } finally { await panel.cleanup(); }
});

it.each(["chyba čtení", "neplatný e-mail"])("T4 %s nabídne opakování a zachová volbu jen stejnému účtu", async (failure) => {
  const panel = await renderRecordingCard({ modernDecision: true });
  const first = "11111111-1111-4111-8111-111111111111";
  const draft = "22222222-2222-4222-8222-222222222222";
  const second = "33333333-3333-4333-8333-333333333333";
  let company = first;
  panel.ludone.getUploadCompanyDefault = vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Gama" }));
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: company === first
    ? [{ id: first, name: "Alfa" }, { id: draft, name: "Beta" }] : [{ id: second, name: "Gama" }],
    selectedCompanyId: company, offerToken: "offer-token-0000000000000001" }));
  const failNextIdentity = () => {
    if (failure === "chyba čtení") panel.ludone.getAuthIdentity.mockRejectedValueOnce(new Error("offline"));
    else panel.ludone.getAuthIdentity.mockResolvedValueOnce({ email: "neplatný" });
  };
  try {
    await startRecording(panel); await stopRecording(panel);
    const select = panel.document.querySelector('[data-testid="recording-upload-company"]');
    await React.act(async () => { select.value = draft; select.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
    failNextIdentity();
    await panel.changeAccount({ email: "a@example.test" });
    expect(panel.document.body.textContent).not.toContain("Ověřuji účet pro výběr cílové firmy");
    const alert = [...panel.document.querySelectorAll('[role="alert"]')].find((element) => !element.closest("[hidden]"));
    expect(alert.textContent).toMatch(/účet|identit/iu);
    expect(alert.textContent).toMatch(failure === "chyba čtení" ? /Zkontroluj síť/u : /platný e-mail/u);
    expect(panel.document.querySelector('[data-testid="recording-upload-preferences"]').closest("[hidden]")).not.toBeNull();
    expect(panel.document.querySelector('button[type="submit"]').disabled).toBe(true);
    await panel.click([...panel.document.querySelectorAll("button")].find((button) => button.textContent.includes("Zkusit znovu")));
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(draft);
    expect(panel.document.querySelector('button[type="submit"]').disabled).toBe(false);

    failNextIdentity();
    company = second;
    panel.setAccountBinding("22222222-2222-4222-8222-222222222222");
    await panel.changeAccount({ email: "b@example.test" });
    expect(panel.document.querySelector('[data-testid="recording-upload-preferences"]').closest("[hidden]")).not.toBeNull();
    await panel.click([...panel.document.querySelectorAll("button")].find((button) => button.textContent.includes("Zkusit znovu")));
    expect(panel.document.body.textContent).not.toContain("Beta");
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(second);
    expect(panel.document.querySelector('button[type="submit"]').disabled).toBe(false);
  } finally { await panel.cleanup(); }
});

it("K5 stejný e-mail jiného subjectu neobnoví cizí draft", async () => {
  const panel = await renderRecordingCard({ modernDecision: true });
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  let company = first;
  panel.ludone.getUploadCompanyDefault = vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Beta" }));
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: company, name: company === first ? "Alfa" : "Beta" }],
    selectedCompanyId: company, offerToken: "offer-token-0000000000000001" }));
  try {
    await startRecording(panel); await stopRecording(panel);
    const visibility = panel.document.querySelector('[data-testid="recording-upload-visibility"]');
    await React.act(async () => { visibility.value = "private"; visibility.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
    company = second;
    panel.setAccountBinding("22222222-2222-4222-8222-222222222222");
    await panel.changeAccount({ email: "a@example.test" });
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(second);
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("company");
  } finally { await panel.cleanup(); }
});

it("K5 bez ověřeného subjectu se po změně relace draft nepřenese", async () => {
  const panel = await renderRecordingCard({ modernDecision: true });
  const companyId = "11111111-1111-4111-8111-111111111111";
  panel.setAccountBinding(null);
  await panel.changeAccount({ email: "a@example.test" });
  panel.ludone.getUploadCompanyDefault = vi.fn(async () => ({ companyId, companyName: "Alfa" }));
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Alfa" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  try {
    await startRecording(panel); await stopRecording(panel);
    const visibility = panel.document.querySelector('[data-testid="recording-upload-visibility"]');
    await React.act(async () => { visibility.value = "private"; visibility.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
    await panel.changeAccount({ email: "a@example.test" });
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("company");
  } finally { await panel.cleanup(); }
});

it("K5 pozdní chyba ukládání původního účtu nepředvyplní jeho firmu další nahrávce nového účtu", async () => {
  const panel = await renderRecordingCard({ modernDecision: true });
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  let company = first;
  const offerFor = (id) => ({ companies: [{ id, name: id === first ? "Alfa" : "Beta" }],
    selectedCompanyId: id, offerToken: "offer-token-0000000000000001" });
  panel.ludone.getUploadCompanyDefault = vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Beta" }));
  panel.ludone.listUploadCompanies = vi.fn(async () => offerFor(company));
  try {
    await startRecording(panel); await stopRecording(panel);
    const pending = deferred();
    panel.ludone.listUploadCompanies.mockImplementationOnce(() => pending.promise);
    await panel.click(panel.document.querySelector('button[type="submit"]'));
    company = second;
    panel.setAccountBinding("22222222-2222-4222-8222-222222222222");
    await panel.changeAccount({ email: "b@example.test" });
    await React.act(async () => pending.resolve(offerFor(first)));
    expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
    await panel.click(panel.document.querySelector('[data-testid="delete-recording"]'));
    await panel.click(panel.document.querySelector('[data-testid="confirm-delete-recording"]'));
    await startRecording(panel); await stopRecording(panel);
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(second);
    expect(panel.document.body.textContent).not.toContain("Alfa");
  } finally { await panel.cleanup(); }
});

it("K5 souběh nové identity a staré chyby neotevře nový formulář se starou firmou", async () => {
  const panel = await renderRecordingCard({ modernDecision: true });
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  let company = first;
  const offerFor = (id) => ({ companies: [{ id, name: id === first ? "Alfa" : "Beta" }],
    selectedCompanyId: id, offerToken: "offer-token-0000000000000001" });
  panel.ludone.getUploadCompanyDefault = vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Beta" }));
  panel.ludone.listUploadCompanies = vi.fn(async () => offerFor(company));
  try {
    await startRecording(panel); await stopRecording(panel);
    const oldOffer = deferred();
    panel.ludone.listUploadCompanies.mockImplementationOnce(() => oldOffer.promise);
    await panel.click(panel.document.querySelector('button[type="submit"]'));
    company = second;
    panel.setAccountBinding("22222222-2222-4222-8222-222222222222");
    const nextIdentity = deferred();
    await panel.changeAccount(nextIdentity.promise);
    await React.act(async () => {
      nextIdentity.resolve({ email: "b@example.test" });
      for (let index = 0; index < 10; index += 1) await Promise.resolve();
      oldOffer.resolve(offerFor(first));
    });
    expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(second);
    expect(panel.document.body.textContent).not.toContain("Alfa");
  } finally { await panel.cleanup(); }
});

it("automatické odeslání připne ověřenou výchozí firmu k nahrávce", async () => {
  const panel = await renderRecordingCard({ modernDecision: true, finishRecordingResult: { automaticUpload: true } });
  const companyId = "22222222-2222-4222-8222-222222222222";
  const offerToken = "offer-token-0000000000000001";
  panel.ludone.getUploadCompanyDefault = vi.fn(async () => ({ companyId }));
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }], selectedCompanyId: companyId, offerToken }));
  try {
    await startRecording(panel); await panel.click(panel.currentButton()); await panel.waitForPhase("idle");
    expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledWith(SESSION_ID, expect.objectContaining({
      decision: "send", uploadPreferences: { companyId, offerToken, visibility: "company" },
    }));
  } finally { await panel.cleanup(); }
});

it("automatické odeslání bez výchozí firmy ponechá rozhodnutí uživateli", async () => {
  const panel = await renderRecordingCard({ modernDecision: true, finishRecordingResult: { automaticUpload: true } });
  panel.ludone.getUploadCompanyDefault = vi.fn(async () => ({ companyId: null }));
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [], selectedCompanyId: null, offerToken: "offer-token-0000000000000001" }));
  try {
    await startRecording(panel); await stopRecording(panel);
    expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
    expect(panel.document.body.textContent).toMatch(/výchozí firm|cílovou firm/u);
  } finally { await panel.cleanup(); }
});
it("stopform bez nabídky odmítne send, ale ponechá místní uložení", async () => {
  const panel = await renderRecordingCard({ modernDecision: true });
  panel.ludone.listUploadCompanies = vi.fn(async () => { throw new Error("offline"); });
  try {
    await startRecording(panel); await stopRecording(panel);
    await panel.click(panel.document.querySelector('button[type="submit"]'));
    expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
    await panel.click(panel.document.querySelector('[data-testid="skip-recording-name"]'));
    expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledWith(SESSION_ID, { recordingName: DEFAULT_RECORDING_NAME, decision: "keep" });
  } finally { await panel.cleanup(); }
});
it("busy save chyba zachová private draft; nové kliknutí použije čerstvý token a private", async () => {
  const panel = await renderRecordingCard({ modernDecision: true });
  const companyId = "22222222-2222-4222-8222-222222222222";
  let serial = 0;
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }], selectedCompanyId: companyId, offerToken: `offer-token-00000000000000${++serial}` }));
  panel.ludone.saveRecordingDecision.mockRejectedValueOnce(new Error("stale_snapshot"));
  try {
    await startRecording(panel); await stopRecording(panel);
    const visibility = panel.document.querySelector('[data-testid="recording-upload-visibility"]');
    await React.act(async () => { visibility.value = "private"; visibility.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
    await panel.click(panel.document.querySelector('button[type="submit"]'));
    expect(panel.phase()).toBe("saved");
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
    expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledTimes(1);
    await panel.click(panel.document.querySelector('button[type="submit"]'));
    expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledTimes(2);
    const first = panel.ludone.saveRecordingDecision.mock.calls[0][1].uploadPreferences;
    const second = panel.ludone.saveRecordingDecision.mock.calls[1][1].uploadPreferences;
    expect(second.visibility).toBe("private"); expect(second.companyId).toBe(companyId);
    expect(second.offerToken).not.toBe(first.offerToken);
  } finally { await panel.cleanup(); }
});

describe("P184 předvolby nové nahrávky", () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  const offer = (selectedCompanyId = first, offerToken = "offer-token-0000000000000001") => ({
    companies: [{ id: first, name: "Alfa" }, { id: second, name: "Beta" }], selectedCompanyId, offerToken,
  });

  it("nabídne firemní výchozí přístup, přepnutí uloží a výběr firmy otevře účet", async () => {
    const panel = await renderRecordingCard({
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: first, companyName: "Alfa" })),
        listUploadCompanies: vi.fn(async () => offer()),
      },
    });
    try {
      const privateButton = panel.document.querySelector('[data-testid="recording-visibility-private"]');
      const companyButton = panel.document.querySelector('[data-testid="recording-visibility-company"]');
      expect(companyButton.getAttribute("aria-pressed")).toBe("true");
      expect(privateButton.getAttribute("aria-pressed")).toBe("false");
      expect(panel.document.querySelector('[data-testid="recording-default-company"]').textContent).toContain("Alfa");
      await panel.click(privateButton);
      expect(privateButton.getAttribute("aria-pressed")).toBe("true");
      expect(companyButton.getAttribute("aria-pressed")).toBe("false");
      expect(panel.document.defaultView.localStorage.getItem("ludone.desktop.recording-visibility")).toBe("private");
      await panel.click(panel.document.querySelector('[data-testid="recording-default-company-change"]'));
      expect(panel.ludone.openSettings).toHaveBeenCalledWith("account");
    } finally { await panel.cleanup(); }
  });

  it.each([["private", "private"], ["company", "company"], ["neplatná", "company"]])(
    "po otevření použije uloženou volbu %s nebo bezpečný výchozí přístup", async (storedVisibility, expected) => {
      const panel = await renderRecordingCard({ storedVisibility });
      try {
        expect(panel.document.querySelector(`[data-testid="recording-visibility-${expected}"]`).getAttribute("aria-pressed")).toBe("true");
      } finally { await panel.cleanup(); }
    },
  );

  it("při vypnutém automatickém odesílání předá volbu a firmu ze startu až po kliku", async () => {
    let company = first;
    let tokenNumber = 0;
    const list = vi.fn(async () => offer(company, `offer-token-${String(++tokenNumber).padStart(16, "0")}`));
    const panel = await renderRecordingCard({
      modernDecision: true,
      storedVisibility: "private",
      finishRecordingResult: { automaticUpload: false },
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Beta" })),
        listUploadCompanies: list,
      },
    });
    try {
      await startRecording(panel);
      company = second;
      await stopRecording(panel);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(first);
      expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
      const button = panel.document.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(false);
      const previousToken = tokenNumber;
      await panel.click(button);
      expect(tokenNumber).toBeGreaterThan(previousToken);
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: DEFAULT_RECORDING_NAME, decision: "send",
        uploadPreferences: { companyId: first, visibility: "private", offerToken: `offer-token-${String(previousToken + 1).padStart(16, "0")}` },
      });
    } finally { await panel.cleanup(); }
  });

  it("Z1 automatické odeslání použije aktuální výchozí firmu a přístup ze startu", async () => {
    let company = first;
    let tokenNumber = 0;
    const panel = await renderRecordingCard({
      modernDecision: true,
      storedVisibility: "private",
      finishRecordingResult: { automaticUpload: true },
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Beta" })),
        listUploadCompanies: vi.fn(async () => offer(company, `offer-token-${String(++tokenNumber).padStart(16, "0")}`)),
      },
    });
    try {
      await startRecording(panel);
      company = second;
      const readsBeforeStop = panel.ludone.getUploadCompanyDefault.mock.calls.length;
      const tokenBeforeStop = tokenNumber;
      await panel.click(panel.currentButton());
      await panel.waitForPhase("idle");
      expect(panel.ludone.getUploadCompanyDefault.mock.calls.length).toBeGreaterThan(readsBeforeStop);
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: DEFAULT_RECORDING_NAME,
        decision: "send",
        uploadPreferences: { companyId: second, visibility: "private", offerToken: `offer-token-${String(tokenBeforeStop + 1).padStart(16, "0")}` },
      });
    } finally { await panel.cleanup(); }
  });

  it("Z2 fokus během potvrzeného odeslání nezneplatní nabídku skutečného řadiče", async () => {
    const context = {
      issuer: "https://app.ludone.cz", resource: "https://app.ludone.cz/api/mcp",
      scope: "nahravky:upload", ownerFingerprint: `sha256:${"a".repeat(64)}`, generation: 1,
      storedSession: { companyTabidooId: first },
    };
    let tokenNumber = 0;
    const controller = createUploadCompanySelectionController({
      readContext: async () => context,
      isContextCurrent: async (candidate) => candidate === context,
      fetchOffer: async () => ({ companies: offer().companies, defaultCompanyId: first }),
      commitChoice: async () => true,
      randomUUID: () => `offer-token-${String(++tokenNumber).padStart(16, "0")}`,
    });
    const guard = () => true;
    const freshOffer = deferred();
    const resumeOffer = deferred();
    let pauseNextOffer = false;
    const listUploadCompanies = vi.fn(async () => {
      const loaded = await controller.load({ requesterKey: "panel", guard });
      if (pauseNextOffer) {
        pauseNextOffer = false;
        freshOffer.resolve(loaded);
        await resumeOffer.promise;
      }
      return loaded;
    });
    const panel = await renderRecordingCard({
      modernDecision: true, storedVisibility: "private",
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: first, companyName: "Alfa" })),
        listUploadCompanies,
      },
    });
    const commit = vi.fn(async () => ({ ok: true, outcome: "queued" }));
    panel.ludone.saveRecordingDecision.mockImplementation(async (_id, { uploadPreferences }) => controller.resolve({
      requesterKey: "panel", guard, ...uploadPreferences, commit,
    }));
    try {
      await startRecording(panel);
      let callsBeforeFocus = listUploadCompanies.mock.calls.length;
      await React.act(async () => panel.document.defaultView.dispatchEvent(new panel.document.defaultView.Event("focus")));
      expect(listUploadCompanies).toHaveBeenCalledTimes(callsBeforeFocus);
      await stopRecording(panel);
      callsBeforeFocus = listUploadCompanies.mock.calls.length;
      await React.act(async () => panel.document.defaultView.dispatchEvent(new panel.document.defaultView.Event("focus")));
      expect(listUploadCompanies).toHaveBeenCalledTimes(callsBeforeFocus);
      const callsBeforeSend = listUploadCompanies.mock.calls.length;
      pauseNextOffer = true;
      await panel.click(panel.document.querySelector('button[type="submit"]'));
      await freshOffer.promise;
      const pendingToken = `offer-token-${String(tokenNumber).padStart(16, "0")}`;
      expect(listUploadCompanies).toHaveBeenCalledTimes(callsBeforeSend + 1);
      await React.act(async () => panel.document.defaultView.dispatchEvent(new panel.document.defaultView.Event("focus")));
      expect(listUploadCompanies).toHaveBeenCalledTimes(callsBeforeSend + 1);
      await React.act(async () => resumeOffer.resolve());
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: DEFAULT_RECORDING_NAME, decision: "send",
        uploadPreferences: { companyId: first, visibility: "private", offerToken: pendingToken },
      });
      expect(commit).toHaveBeenCalledOnce();
      expect(panel.phase()).toBe("idle");
      expect(panel.document.body.textContent).not.toContain("Automatické odeslání se nespustilo");
    } finally { await panel.cleanup(); }
  });

  it("Z2 opožděná předvolba z klidové obrazovky po startu nespustí další nabídku", async () => {
    const pendingDefault = deferred();
    const listUploadCompanies = vi.fn(async () => offer());
    const panel = await renderRecordingCard({
      modernDecision: true,
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn().mockReturnValueOnce(pendingDefault.promise)
          .mockResolvedValue({ companyId: first, companyName: "Alfa" }),
        listUploadCompanies,
      },
    });
    try {
      await startRecording(panel); await stopRecording(panel);
      expect(listUploadCompanies).not.toHaveBeenCalled();
      await React.act(async () => pendingDefault.resolve({ companyId: first, companyName: "Alfa" }));
      expect(listUploadCompanies).toHaveBeenCalledOnce();
      expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(first);
      expect(panel.document.querySelector('button[type="submit"]').disabled).toBe(false);
    } finally { await panel.cleanup(); }
  });

  it("Z3 účet ověřený až po startu dovolí automatické odeslání téže nahrávky", async () => {
    const identity = deferred();
    const panel = await renderRecordingCard({
      modernDecision: true, storedVisibility: "private", finishRecordingResult: { automaticUpload: true },
      ludoneOverrides: {
        getAuthIdentity: vi.fn(() => identity.promise),
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: first, companyName: "Alfa" })),
        listUploadCompanies: vi.fn(async () => offer()),
      },
    });
    try {
      await startRecording(panel);
      await React.act(async () => identity.resolve({ email: "a@example.test" }));
      await panel.click(panel.currentButton());
      await panel.waitForPhase("idle");
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: DEFAULT_RECORDING_NAME, decision: "send",
        uploadPreferences: { companyId: first, visibility: "private", offerToken: "offer-token-0000000000000001" },
      });
    } finally { await panel.cleanup(); }
  });

  it("Z3 změna relace po startu při čekajícím ověření automatické odeslání zastaví", async () => {
    const identity = deferred();
    const panel = await renderRecordingCard({
      modernDecision: true, finishRecordingResult: { automaticUpload: true },
      ludoneOverrides: {
        getAuthIdentity: vi.fn().mockReturnValueOnce(identity.promise).mockResolvedValue({ email: "b@example.test" }),
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: second, companyName: "Beta" })),
        listUploadCompanies: vi.fn(async () => offer(second)),
      },
    });
    try {
      await startRecording(panel);
      panel.setAccountBinding(second);
      await panel.changeAccount({ email: "b@example.test" });
      await React.act(async () => identity.resolve({ email: "a@example.test" }));
      await stopRecording(panel);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      expect(panel.document.body.textContent).toContain("Automatické odeslání se nespustilo.");
    } finally { await panel.cleanup(); }
  });

  it("Z3 zamítnutí vlastníka hlavním procesem ponechá nahrávku uloženou", async () => {
    const identity = deferred();
    const panel = await renderRecordingCard({
      modernDecision: true, finishRecordingResult: { automaticUpload: true },
      ludoneOverrides: {
        getAuthIdentity: vi.fn(() => identity.promise),
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: first, companyName: "Alfa" })),
        listUploadCompanies: vi.fn(async () => offer()),
      },
    });
    panel.ludone.saveRecordingDecision.mockRejectedValueOnce(new Error("Nahrávka patří jinému účtu"));
    try {
      await startRecording(panel);
      await React.act(async () => identity.resolve({ email: "a@example.test" }));
      await stopRecording(panel);
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledOnce();
      expect(panel.document.body.textContent).toContain("Automatické odeslání se nespustilo.");
      expect(panel.document.querySelector('[data-testid="skip-recording-name"]')).not.toBeNull();
    } finally { await panel.cleanup(); }
  });

  it("neúspěšné automatické ověření firmy zobrazí důvod a ponechá formulář", async () => {
    const listUploadCompanies = vi.fn(async () => offer());
    const panel = await renderRecordingCard({
      modernDecision: true,
      finishRecordingResult: { automaticUpload: true },
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: first, companyName: "Alfa" })),
        listUploadCompanies,
      },
    });
    try {
      await startRecording(panel);
      listUploadCompanies.mockRejectedValue(new Error("offline"));
      await stopRecording(panel);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      expect(panel.document.body.textContent).toContain("Automatické odeslání se nespustilo.");
      expect(panel.document.body.textContent).toContain("Zkontroluj síť");
    } finally { await panel.cleanup(); }
  });

  it("automatické odeslání nezamění odebranou firmu za jinou", async () => {
    let removed = false;
    const panel = await renderRecordingCard({
      modernDecision: true,
      storedVisibility: "private",
      finishRecordingResult: { automaticUpload: true },
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: first, companyName: "Alfa" })),
        listUploadCompanies: vi.fn(async () => removed
          ? { companies: [{ id: second, name: "Beta" }], selectedCompanyId: second, offerToken: "offer-token-0000000000000002" }
          : offer()),
      },
    });
    try {
      await startRecording(panel);
      removed = true;
      await stopRecording(panel);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      expect(panel.document.body.textContent).toContain("Automatické odeslání se nespustilo.");
      expect(panel.document.body.textContent).toContain("Firma už není dostupná pro tento účet.");
      expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
    } finally { await panel.cleanup(); }
  });

  it("změna účtu během nahrávání zruší automatické odeslání s původní firmou", async () => {
    let company = first;
    const panel = await renderRecordingCard({
      modernDecision: true,
      finishRecordingResult: { automaticUpload: true },
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Beta" })),
        listUploadCompanies: vi.fn(async () => offer(company)),
      },
    });
    try {
      await startRecording(panel);
      company = second;
      panel.setAccountBinding(second);
      await panel.changeAccount({ email: "b@example.test" });
      await stopRecording(panel);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      expect(panel.document.body.textContent).toContain("Automatické odeslání se nespustilo.");
      expect(panel.document.body.textContent).toContain("přihlášení");
    } finally { await panel.cleanup(); }
  });

  it("změna účtu při čekání na nabídku zastaví automatické odeslání", async () => {
    const pendingOffer = deferred();
    let company = first;
    const listUploadCompanies = vi.fn().mockImplementation(async () => offer(company));
    const panel = await renderRecordingCard({
      modernDecision: true,
      finishRecordingResult: { automaticUpload: true },
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Beta" })),
        listUploadCompanies,
      },
    });
    try {
      await startRecording(panel);
      listUploadCompanies.mockReturnValueOnce(pendingOffer.promise);
      await stopRecording(panel);
      expect(panel.document.querySelector('button[type="submit"]').disabled).toBe(true);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      company = second;
      panel.setAccountBinding(second);
      await panel.changeAccount({ email: "b@example.test" });
      await React.act(async () => { pendingOffer.resolve(offer(first)); });
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      expect(panel.document.body.textContent).toContain("Automatické odeslání se nespustilo.");
    } finally { await panel.cleanup(); }
  });

  it("zneplatnění přihlášení při čekání na nabídku zastaví automatické odeslání", async () => {
    const pendingOffer = deferred();
    const listUploadCompanies = vi.fn().mockImplementation(async () => offer());
    const panel = await renderRecordingCard({
      modernDecision: true,
      finishRecordingResult: { automaticUpload: true },
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: first, companyName: "Alfa" })),
        listUploadCompanies,
      },
    });
    try {
      await startRecording(panel);
      listUploadCompanies.mockReturnValueOnce(pendingOffer.promise);
      await stopRecording(panel);
      await panel.setCanSend(false);
      await React.act(async () => { pendingOffer.resolve(offer()); });
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      expect(panel.document.body.textContent).toContain("Automatické odeslání se nespustilo.");
    } finally { await panel.cleanup(); }
  });

  it("bez firmy nahrává, po zastavení vysvětlí neaktivní tlačítko a nic neodešle", async () => {
    const panel = await renderRecordingCard({
      modernDecision: true,
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: null })),
        listUploadCompanies: vi.fn(async () => ({ companies: [], selectedCompanyId: null, offerToken: "offer-token-0000000000000001" })),
      },
    });
    try {
      expect(panel.document.querySelector('[data-testid="recording-default-company"]').textContent).toMatch(/firma.*není vybran/iu);
      await startRecording(panel); await stopRecording(panel);
      const button = panel.document.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(true);
      expect(button.nextElementSibling.textContent).toMatch(/vyber.*firm/iu);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
    } finally { await panel.cleanup(); }
  });

  it("výpadek nabídky nepředstírá ověřenou firmu a po stopu vysvětlí blokaci", async () => {
    const panel = await renderRecordingCard({
      modernDecision: true,
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: first, companyName: "Alfa" })),
        listUploadCompanies: vi.fn(async () => { throw new Error("offline"); }),
      },
    });
    try {
      expect(panel.document.querySelector('[data-testid="recording-default-company"]').textContent).toMatch(/nelze ověřit/iu);
      await startRecording(panel); await stopRecording(panel);
      const button = panel.document.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(true);
      expect(button.nextElementSibling.textContent).toMatch(/firm.*ověř|ověř.*firm/iu);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
    } finally { await panel.cleanup(); }
  });

  it("nepřihlášený účet nebrání nahrávání a vysvětlení je přímo pod odesláním", async () => {
    const panel = await renderRecordingCard({ canSend: false, modernDecision: true });
    try {
      expect(panel.document.querySelector('[data-testid="recording-default-company"]').textContent).toMatch(/nelze ověřit/iu);
      await startRecording(panel); await stopRecording(panel);
      const button = panel.document.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(true);
      expect(button.nextElementSibling.textContent).toMatch(/přihlášení.*obnov/iu);
      expect(button.getAttribute("aria-describedby")).toBe(button.nextElementSibling.id);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
    } finally { await panel.cleanup(); }
  });

  it("při selhání úložiště varuje a vybraný přístup použije alespoň pro tuto nahrávku", async () => {
    const panel = await renderRecordingCard({
      modernDecision: true,
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: first, companyName: "Alfa" })),
        listUploadCompanies: vi.fn(async () => offer()),
      },
    });
    try {
      Object.defineProperty(panel.document.defaultView, "localStorage", {
        configurable: true, get() { throw new Error("úložiště není dostupné"); },
      });
      await panel.click(panel.document.querySelector('[data-testid="recording-visibility-private"]'));
      expect(panel.document.body.textContent).toMatch(/volbu se.*nepodařilo zapamatovat/iu);
      await startRecording(panel); await stopRecording(panel);
      expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
    } finally { await panel.cleanup(); }
  });

  it("při změně účtu nezobrazí pozdní výchozí firmu předchozího účtu", async () => {
    const pending = deferred();
    const getDefault = vi.fn().mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ companyId: second, companyName: "Beta" });
    const panel = await renderRecordingCard({
      ludoneOverrides: { getUploadCompanyDefault: getDefault, listUploadCompanies: vi.fn(async () => offer(second)) },
    });
    try {
      panel.setAccountBinding(second);
      await panel.changeAccount({ email: "b@example.test" });
      await React.act(async () => pending.resolve({ companyId: first, companyName: "Alfa" }));
      const label = panel.document.querySelector('[data-testid="recording-default-company"]').textContent;
      expect(label).toContain("Beta");
      expect(label).not.toContain("Alfa");
    } finally { await panel.cleanup(); }
  });

  it("po návratu z nastavení znovu ověří změněnou výchozí firmu", async () => {
    let company = first;
    const panel = await renderRecordingCard({
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Beta" })),
        listUploadCompanies: vi.fn(async () => offer(company)),
      },
    });
    try {
      expect(panel.document.querySelector('[data-testid="recording-default-company"]').textContent).toContain("Alfa");
      await panel.click(panel.document.querySelector('[data-testid="recording-default-company-change"]'));
      company = second;
      await React.act(async () => panel.document.defaultView.dispatchEvent(new panel.document.defaultView.Event("focus")));
      expect(panel.document.querySelector('[data-testid="recording-default-company"]').textContent).toContain("Beta");
      expect(panel.document.querySelector('[data-testid="recording-default-company"]').textContent).not.toContain("Alfa");
    } finally { await panel.cleanup(); }
  });

  it("firmu načtenou před startem zachová i při pomalém ověření nabídky", async () => {
    let company = first;
    const initialOffer = deferred();
    const list = vi.fn().mockReturnValueOnce(initialOffer.promise).mockImplementation(async () => offer(second));
    const panel = await renderRecordingCard({
      modernDecision: true, storedVisibility: "private",
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Beta" })),
        listUploadCompanies: list,
      },
    });
    try {
      expect(panel.document.querySelector('[data-testid="recording-default-company"]').textContent).toMatch(/ověřuji/iu);
      await startRecording(panel);
      company = second;
      await stopRecording(panel);
      expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(first);
      expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      await React.act(async () => initialOffer.resolve(offer(first)));
    } finally { await panel.cleanup(); }
  });

  it("pomalé načtení výchozí firmy po startu nepřepíše předvolbu novější změnou", async () => {
    const pendingDefault = deferred();
    const getDefault = vi.fn().mockReturnValueOnce(pendingDefault.promise)
      .mockResolvedValue({ companyId: second, companyName: "Beta" });
    const panel = await renderRecordingCard({
      modernDecision: true, storedVisibility: "private",
      ludoneOverrides: { getUploadCompanyDefault: getDefault, listUploadCompanies: vi.fn(async () => offer(second)) },
    });
    try {
      await startRecording(panel); await stopRecording(panel);
      expect(panel.document.querySelector('button[type="submit"]').disabled).toBe(true);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      await React.act(async () => pendingDefault.resolve({ companyId: first, companyName: "Alfa" }));
      expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(first);
      expect(panel.document.querySelector('button[type="submit"]').disabled).toBe(false);
      expect(getDefault).toHaveBeenCalledTimes(1);
    } finally { await panel.cleanup(); }
  });

  it("pozdní předvolbu předchozího účtu nepřenese do nahrávky jiného účtu", async () => {
    const pendingDefault = deferred();
    const getDefault = vi.fn().mockReturnValueOnce(pendingDefault.promise)
      .mockResolvedValue({ companyId: second, companyName: "Beta" });
    const panel = await renderRecordingCard({
      modernDecision: true, storedVisibility: "private",
      ludoneOverrides: { getUploadCompanyDefault: getDefault, listUploadCompanies: vi.fn(async () => ({
        companies: [{ id: second, name: "Beta" }], selectedCompanyId: second, offerToken: "offer-token-0000000000000002",
      })) },
    });
    try {
      await startRecording(panel);
      panel.setAccountBinding(second);
      await panel.changeAccount({ email: "b@example.test" });
      await stopRecording(panel);
      await React.act(async () => pendingDefault.resolve({ companyId: first, companyName: "Alfa" }));
      expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(second);
      expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
      expect(panel.document.body.textContent).not.toContain("Alfa");
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
    } finally { await panel.cleanup(); }
  });

  it("změna účtu při nahrávání nepřenese firmu původního účtu do nového", async () => {
    let company = first;
    const panel = await renderRecordingCard({
      modernDecision: true, storedVisibility: "private",
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: company, companyName: company === first ? "Alfa" : "Beta" })),
        listUploadCompanies: vi.fn(async () => ({ companies: [{ id: company, name: company === first ? "Alfa" : "Beta" }],
          selectedCompanyId: company, offerToken: "offer-token-0000000000000001" })),
      },
    });
    try {
      await startRecording(panel);
      company = second;
      panel.setAccountBinding(second);
      await panel.changeAccount({ email: "b@example.test" });
      await stopRecording(panel);
      expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(second);
      expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
      expect(panel.document.body.textContent).not.toContain("Alfa");
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
    } finally { await panel.cleanup(); }
  });

  it("firma odebraná během nahrávání se sama nezamění za jinou a brání odeslání", async () => {
    let removed = false;
    const panel = await renderRecordingCard({
      modernDecision: true, storedVisibility: "private",
      ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: first, companyName: "Alfa" })),
        listUploadCompanies: vi.fn(async () => removed
          ? { companies: [{ id: second, name: "Beta" }], selectedCompanyId: second, offerToken: "offer-token-0000000000000002" }
          : offer()),
      },
    });
    try {
      await startRecording(panel);
      removed = true;
      await stopRecording(panel);
      const select = panel.document.querySelector('[data-testid="recording-upload-company"]');
      const button = panel.document.querySelector('button[type="submit"]');
      expect(select.value).toBe(first);
      expect(button.disabled).toBe(true);
      expect(button.nextElementSibling.textContent).toMatch(/firm.*nelze ověřit/iu);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      await React.act(async () => { select.value = second; select.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
      expect(button.disabled).toBe(false);
      await panel.click(button);
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        recordingName: DEFAULT_RECORDING_NAME, decision: "send",
        uploadPreferences: { companyId: second, visibility: "private", offerToken: "offer-token-0000000000000002" },
      });
    } finally { await panel.cleanup(); }
  });
});

describe("přechodná výchozí firma při obnově přihlášení", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const offer = { companies: [{ id: companyId, name: "Alfa" }], selectedCompanyId: companyId,
    offerToken: "offer-token-0000000000000001" };

  it("pending zůstává načítáním a událost obnovení načte a ověří firmu znovu", async () => {
    const getDefault = vi.fn().mockResolvedValueOnce({ companyId: null, pending: true })
      .mockResolvedValue({ companyId, companyName: "Alfa" });
    const list = vi.fn(async () => offer);
    const panel = await renderRecordingCard({ canSend: true, ludoneOverrides: { getUploadCompanyDefault: getDefault, listUploadCompanies: list } });
    try {
      expect(panel.document.querySelector('[data-testid="recording-default-company"]').textContent).toContain("Ověřuji cílovou firmu…");
      expect(panel.document.body.textContent).not.toContain("Firma není vybraná");
      expect(list).not.toHaveBeenCalled();
      await panel.changeAccount({ email: "a@example.test" });
      expect(getDefault).toHaveBeenCalledTimes(2);
      expect(list).toHaveBeenCalledOnce();
      expect(panel.document.querySelector('[data-testid="recording-default-company"]').textContent).toContain("Cílová firma: Alfa");
    } finally { await panel.cleanup(); }
  });

  it("časované opakování načte firmu i bez události přihlášení", async () => {
    vi.useFakeTimers();
    const getDefault = vi.fn().mockResolvedValueOnce({ companyId: null, pending: true })
      .mockResolvedValue({ companyId, companyName: "Alfa" });
    const list = vi.fn(async () => offer);
    const panel = await renderRecordingCard({ canSend: true, ludoneOverrides: { getUploadCompanyDefault: getDefault, listUploadCompanies: list } });
    try {
      await React.act(async () => vi.advanceTimersByTimeAsync(1_999));
      expect(getDefault).toHaveBeenCalledOnce();
      expect(list).not.toHaveBeenCalled();
      await React.act(async () => vi.advanceTimersByTimeAsync(1));
      expect(getDefault).toHaveBeenCalledTimes(2);
      expect(list).toHaveBeenCalledOnce();
      expect(panel.document.body.textContent).toContain("Cílová firma: Alfa");
    } finally { await panel.cleanup(); vi.clearAllTimers(); vi.useRealTimers(); }
  });

  it("po třech omezených opakováních ukáže nedostupnost a dál se nedotazuje", async () => {
    vi.useFakeTimers();
    const getDefault = vi.fn(async () => ({ companyId: null, pending: true }));
    const list = vi.fn(async () => offer);
    const panel = await renderRecordingCard({ canSend: true, ludoneOverrides: { getUploadCompanyDefault: getDefault, listUploadCompanies: list } });
    try {
      expect(panel.document.body.textContent).toContain("Ověřuji cílovou firmu…");
      await React.act(async () => vi.advanceTimersByTimeAsync(6_000));
      expect(getDefault).toHaveBeenCalledTimes(4);
      expect(list).not.toHaveBeenCalled();
      expect(panel.document.body.textContent).toContain("Firmu nelze ověřit");
      expect(panel.document.body.textContent).not.toContain("Firma není vybraná");
      await React.act(async () => vi.advanceTimersByTimeAsync(20_000));
      expect(getDefault).toHaveBeenCalledTimes(4);
    } finally { await panel.cleanup(); vi.clearAllTimers(); vi.useRealTimers(); }
  });

  it("skutečně neuloženou firmu zobrazí jako nevybranou bez opakování", async () => {
    vi.useFakeTimers();
    const getDefault = vi.fn(async () => ({ companyId: null }));
    const panel = await renderRecordingCard({ canSend: true, ludoneOverrides: { getUploadCompanyDefault: getDefault, listUploadCompanies: vi.fn(async () => offer) } });
    try {
      expect(panel.document.body.textContent).toContain("Firma není vybraná");
      await React.act(async () => vi.advanceTimersByTimeAsync(8_000));
      expect(getDefault).toHaveBeenCalledOnce();
    } finally { await panel.cleanup(); vi.clearAllTimers(); vi.useRealTimers(); }
  });

  it("opožděná původní odpověď po změně přihlášení nepřepíše nově ověřenou firmu", async () => {
    const oldRead = deferred();
    const getDefault = vi.fn().mockReturnValueOnce(oldRead.promise).mockResolvedValue({ companyId, companyName: "Alfa" });
    const panel = await renderRecordingCard({ canSend: true, ludoneOverrides: { getUploadCompanyDefault: getDefault, listUploadCompanies: vi.fn(async () => offer) } });
    try {
      await panel.changeAccount({ email: "a@example.test" });
      expect(panel.document.body.textContent).toContain("Cílová firma: Alfa");
      await React.act(async () => oldRead.resolve({ companyId: null }));
      expect(panel.document.body.textContent).toContain("Cílová firma: Alfa");
      expect(panel.document.body.textContent).not.toContain("Firma není vybraná");
    } finally { await panel.cleanup(); }
  });

  it("opuštění nečinné karty zruší naplánované opakování výchozí firmy", async () => {
    vi.useFakeTimers();
    const getDefault = vi.fn(async () => ({ companyId: null, pending: true }));
    const panel = await renderRecordingCard({ canSend: true, ludoneOverrides: {
      getUploadCompanyDefault: getDefault, listUploadCompanies: vi.fn(async () => offer),
    } });
    try {
      await startRecording(panel);
      await React.act(async () => vi.advanceTimersByTimeAsync(6_000));
      expect(getDefault).toHaveBeenCalledOnce();
    } finally { await panel.cleanup(); vi.clearAllTimers(); vi.useRealTimers(); }
  });

  it("pending při automatickém odeslání nikdy neodešle nahrávku bez firmy", async () => {
    const panel = await renderRecordingCard({ canSend: true, modernDecision: true,
      finishRecordingResult: { automaticUpload: true }, ludoneOverrides: {
        getUploadCompanyDefault: vi.fn(async () => ({ companyId: null, pending: true })),
        listUploadCompanies: vi.fn(async () => offer),
      } });
    try {
      await startRecording(panel); await stopRecording(panel);
      expect(panel.ludone.saveRecordingDecision).not.toHaveBeenCalled();
      expect(panel.document.body.textContent).toContain("Vyber cílovou firmu. Výchozí firmu se nepodařilo určit.");
    } finally { await panel.cleanup(); }
  });
});

describe("RecordingCard: čtyři volby po zastavení nahrávky", () => {
  const SAVE_CHOICE_KEY = "ludone.desktop.recording-save-choice";
  const primaryTestId = (panel) => panel.document.querySelector('.recording-saved__actions .button--primary')
    ?.getAttribute("data-testid");

  it("nabídne smazání, uložení na Macu, odeslání i odeslání s přepisem a bez paměti předvybere odeslání", async () => {
    const panel = await renderRecordingCard({ modernDecision: true });
    try {
      await startRecording(panel); await stopRecording(panel);
      const labels = [...panel.document.querySelectorAll(".recording-saved__actions button")]
        .map((button) => button.textContent.trim());
      expect(labels).toEqual(expect.arrayContaining([
        "Uložit a odeslat", "Uložit, odeslat a spustit přepis", "Nechat na Macu", "Smazat nahrávku",
      ]));
      expect(primaryTestId(panel)).toBe("save-send");
      expect(panel.document.querySelector('[data-testid="delete-recording"]').className).not.toContain("button--primary");
      expect(panel.document.querySelector('[data-testid="confirm-delete-recording"]')).toBeNull();
    } finally { await panel.cleanup(); }
  });

  it.each([["keep", "skip-recording-name"], ["send", "save-send"], ["send-transcribe", "save-send-transcribe"]])(
    "uloženou bezpečnou volbu %s předvybere jako hlavní akci", async (storedSaveChoice, testId) => {
      const panel = await renderRecordingCard({ modernDecision: true, storedSaveChoice });
      try {
        await startRecording(panel); await stopRecording(panel);
        expect(primaryTestId(panel)).toBe(testId);
        expect(panel.document.querySelector(`[data-testid="${testId}"]`).type).toBe("submit");
      } finally { await panel.cleanup(); }
    });

  it.each(["delete", "smazat", "neplatná"])("uložená hodnota %s nikdy nepředvybere Smazat", async (storedSaveChoice) => {
    const panel = await renderRecordingCard({ modernDecision: true, storedSaveChoice });
    try {
      await startRecording(panel); await stopRecording(panel);
      expect(primaryTestId(panel)).toBe("save-send");
      expect(panel.document.querySelector('[data-testid="delete-recording"]').type).toBe("button");
    } finally { await panel.cleanup(); }
  });

  it("Odeslat s přepisem pošle příznak jen u send, zapamatuje volbu a nahlásí zařazení přepisu", async () => {
    const panel = await renderRecordingCard({ modernDecision: true });
    try {
      await startRecording(panel); await stopRecording(panel);
      await enterRecordingName(panel, "Porada výroby");
      await panel.click(panel.document.querySelector('[data-testid="save-send-transcribe"]'));
      await panel.waitForPhase("idle");
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        decision: "send", recordingName: "Porada výroby", transcribeAfterUpload: true,
      });
      expect(panel.document.defaultView.localStorage.getItem(SAVE_CHOICE_KEY)).toBe("send-transcribe");
      expect(panel.document.body.textContent).toContain("Přepis se spustí po nahrání.");
    } finally { await panel.cleanup(); }
  });

  it("Nechat na Macu zapamatuje volbu a nikdy neposílá příznak přepisu", async () => {
    const panel = await renderRecordingCard({ modernDecision: true, storedSaveChoice: "send-transcribe" });
    try {
      await startRecording(panel); await stopRecording(panel);
      await panel.click(panel.document.querySelector('[data-testid="skip-recording-name"]'));
      await panel.waitForPhase("idle");
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        decision: "keep", recordingName: DEFAULT_RECORDING_NAME,
      });
      expect(panel.document.defaultView.localStorage.getItem(SAVE_CHOICE_KEY)).toBe("keep");
    } finally { await panel.cleanup(); }
  });

  it("Enter ve formuláři provede zapamatovanou volbu, ne jinou", async () => {
    const panel = await renderRecordingCard({ modernDecision: true, storedSaveChoice: "keep" });
    try {
      await startRecording(panel); await stopRecording(panel);
      await React.act(async () => panel.document.querySelector("form.recording-saved").requestSubmit());
      await panel.waitForPhase("idle");
      expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        decision: "keep", recordingName: DEFAULT_RECORDING_NAME,
      });
    } finally { await panel.cleanup(); }
  });

  it("Smazat nahrávku se nikdy nezapamatuje a vždy vyžaduje potvrzení", async () => {
    const panel = await renderRecordingCard({ modernDecision: true, storedSaveChoice: "keep" });
    try {
      await startRecording(panel); await stopRecording(panel);
      await panel.click(panel.document.querySelector('[data-testid="delete-recording"]'));
      expect(panel.ludone.deleteRecording).not.toHaveBeenCalled();
      expect(panel.document.querySelector('[role="alertdialog"]').textContent).toContain("Opravdu smazat?");
      expect(panel.document.defaultView.localStorage.getItem(SAVE_CHOICE_KEY)).toBe("keep");
      await panel.click(panel.document.querySelector('[data-testid="confirm-delete-recording"]'));
      await vi.waitFor(() => expect(panel.ludone.deleteRecording).toHaveBeenCalledOnce());
      expect(panel.document.defaultView.localStorage.getItem(SAVE_CHOICE_KEY)).toBe("keep");
    } finally { await panel.cleanup(); }
  });

  it("při selhání úložiště varuje a vybranou akci přesto provede", async () => {
    const panel = await renderRecordingCard({ modernDecision: true });
    try {
      await startRecording(panel); await stopRecording(panel);
      Object.defineProperty(panel.document.defaultView, "localStorage", {
        configurable: true, get() { throw new Error("úložiště není dostupné"); },
      });
      await panel.click(panel.document.querySelector('[data-testid="save-send-transcribe"]'));
      await vi.waitFor(() => expect(panel.ludone.saveRecordingDecision).toHaveBeenCalledOnce());
      expect(panel.ludone.saveRecordingDecision.mock.calls[0][1]).toMatchObject({ transcribeAfterUpload: true });
    } finally { await panel.cleanup(); }
  });

  it("bez přihlášení je odeslání s přepisem zakázané stejně jako odeslání, uložení na Macu zůstane", async () => {
    const panel = await renderRecordingCard({ canSend: false, modernDecision: true });
    try {
      await startRecording(panel); await stopRecording(panel);
      expect(panel.document.querySelector('[data-testid="save-send"]').disabled).toBe(true);
      expect(panel.document.querySelector('[data-testid="save-send-transcribe"]').disabled).toBe(true);
      expect(panel.document.querySelector('[data-testid="skip-recording-name"]').disabled).toBe(false);
    } finally { await panel.cleanup(); }
  });
});
