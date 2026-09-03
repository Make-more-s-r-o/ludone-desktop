import * as React from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { App } from "../src/App.jsx";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { RecordingCard } from "../src/features/recording/RecordingCard.jsx";

const SESSION_ID = "session-test-1";

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
    startedAt: "2026-09-02T12:00:00.010Z",
    endedAt: "2026-09-02T12:30:00.020Z",
    trackStartDeltaMs: 25,
    files: {
      microphone: { name: "microphone.webm", size: 4 },
      system: { name: "system.webm", size: 6 },
    },
  };
}

const MICROPHONE_ONLY_TEXT = "Můžeš povolit jen mikrofon. Časovač poběží a nahrávka bude jednostopá — jen se dozvíš, že chybí druhá strana.";

/**
 * @param {{
 *   analyserError?: Error,
 *   deferBegin?: boolean,
 *   deferCapture?: boolean,
 *   deferRecovery?: boolean,
 *   displayError?: Error | DOMException,
 *   finishRecordingExportResult?: Record<string, unknown>,
 *   microphoneError?: Error | DOMException,
 *   renderApp?: boolean,
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
  const recoveryCapture = deferred();
  const beginRecordingAttempt = deferred();
  const getUserMedia = vi.fn(() => {
    if (options.microphoneError) return Promise.reject(options.microphoneError);
    return options.deferCapture ? microphoneCapture.promise : Promise.resolve(microphoneStream);
  });
  let displayCaptureCount = 0;
  const getDisplayMedia = vi.fn(() => {
    displayCaptureCount += 1;
    if (options.displayError) return Promise.reject(options.displayError);
    if (displayCaptureCount === 1) {
      return options.deferCapture ? displayCapture.promise : Promise.resolve(displayStream);
    }
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

  const ludone = {
    beginRecording: vi.fn(() => (
      options.deferBegin
        ? beginRecordingAttempt.promise
        : Promise.resolve({ sessionId: SESSION_ID })
    )),
    appendRecordingChunk: vi.fn().mockResolvedValue({ sequence: 0, bytes: 4 }),
    finishRecording: vi.fn((_sessionId, trackTimings) => {
      const result = recordingResult();
      if (!trackTimings?.system) delete result.files.system;
      return Promise.resolve(result);
    }),
    finishRecordingExport: vi.fn().mockResolvedValue(
      options.finishRecordingExportResult ?? { ok: true },
    ),
    confirmRecordingExportFailure: vi.fn().mockResolvedValue({ confirmed: true }),
    exportRecording: vi.fn().mockResolvedValue({
      ok: true,
      fileName: `LuDone-${SESSION_ID}.webm`,
    }),
    hasAuthSession: vi.fn().mockResolvedValue(true),
    listQueue: vi.fn().mockResolvedValue([]),
    openSettings: vi.fn(),
    reportTrayFacts: vi.fn(),
    runtime: { resetOnboarding: false },
  };
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
      this.connections = [];
      this.destinationCount = 0;
      this.sampleRate = 48_000;
      this.state = "running";
      this.close = vi.fn(async () => undefined);
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
      return {
        fftSize: 0,
        smoothingTimeConstant: 0,
        track: null,
        disconnect: vi.fn(),
        getFloatTimeDomainData: vi.fn(function getFloatTimeDomainData(target) {
          const amplitude = this.track === microphoneTrack
            ? levelAmplitudes.microphone
            : levelAmplitudes.system;
          for (let index = 0; index < target.length; index += 1) {
            target[index] = index % 2 === 0 ? amplitude : -amplitude;
          }
        }),
      };
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
      return Promise.resolve();
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
  if (options.renderApp) {
    dom.window.localStorage.setItem("ludone.prototype.onboarding-complete", "true");
  }
  await React.act(async () => {
    root.render(options.renderApp
      ? React.createElement(App)
      : React.createElement(RecordingCard, { onActivityChange, trayCommand }));
  });

  const phase = () => dom.window.document
    .querySelector("[data-recording-phase]")
    ?.getAttribute("data-recording-phase");
  const currentButton = () => dom.window.document.querySelector("[data-recording-phase] button");

  return {
    document: dom.window.document,
    getUserMedia,
    getDisplayMedia,
    ludone,
    recorders,
    audioContexts,
    microphoneTrack,
    replacementSystemTrack,
    systemOutputTrack,
    systemTrack,
    phase,
    currentButton,
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
    resolveBeginRecording() {
      beginRecordingAttempt.resolve({ sessionId: SESSION_ID });
    },
    resolveCapture() {
      microphoneCapture.resolve(microphoneStream);
      displayCapture.resolve(displayStream);
    },
    async setTrayCommand(command) {
      trayCommand = command;
      await React.act(async () => {
        root.render(options.renderApp
          ? React.createElement(App)
          : React.createElement(RecordingCard, { onActivityChange, trayCommand }));
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

describe("RecordingCard", () => {
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
      const quietMicrophone = Number.parseFloat(
        panel.document.defaultView.getComputedStyle(microphoneFill).width,
      );
      const quietSystem = Number.parseFloat(
        panel.document.defaultView.getComputedStyle(systemFill).width,
      );

      panel.setLevelAmplitudes({ microphone: 0.25, system: 0 });
      await panel.sampleLevels();
      const loudMicrophone = Number.parseFloat(
        panel.document.defaultView.getComputedStyle(microphoneFill).width,
      );
      const systemDuringLoudMicrophone = Number.parseFloat(
        panel.document.defaultView.getComputedStyle(systemFill).width,
      );

      panel.setLevelAmplitudes({ microphone: 0, system: 0.25 });
      await panel.sampleLevels();
      const microphoneDuringLoudSystem = Number.parseFloat(
        panel.document.defaultView.getComputedStyle(microphoneFill).width,
      );
      const loudSystem = Number.parseFloat(
        panel.document.defaultView.getComputedStyle(systemFill).width,
      );

      expect(loudMicrophone - quietMicrophone).toBeGreaterThan(40);
      expect(loudSystem - quietSystem).toBeGreaterThan(40);
      expect(systemDuringLoudMicrophone).toBeLessThanOrEqual(5);
      expect(microphoneDuringLoudSystem).toBeLessThanOrEqual(5);
      expect(quietMicrophone).toBeLessThanOrEqual(5);
      expect(quietSystem).toBeLessThanOrEqual(5);
      expect(panel.audioContexts).toHaveLength(1);

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

      expect(panel.phase()).toBe("recording");
      expect(panel.audioContexts).toHaveLength(1);
      expect(panel.recorders).toHaveLength(3);
      expect(panel.ludone.beginRecording).toHaveBeenCalledWith(["microphone", "system"]);

      await stopRecording(panel);
      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
      expect(panel.phase()).toBe("saved");
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

  it("jen s mikrofonem nahrává dál a varuje před spuštěním i během nahrávání", async () => {
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
          expect(panel.document.body.textContent).toContain(MICROPHONE_ONLY_TEXT);
        });
        panel.resolveCapture();
      });
      await panel.waitForPhase("recording");
      panel.setLevelAmplitudes({ microphone: 0.25, system: 0.25 });
      await panel.sampleLevels();

      const card = panel.document.querySelector('[aria-label="Nahrávání"]');
      expect(card?.getAttribute("data-system-audio-state")).toBe("unavailable");
      expect(card?.textContent).toContain(MICROPHONE_ONLY_TEXT);
      expect(card?.textContent).toContain("Nahrává se omezeně");
      const systemFill = card?.querySelector(
        '[data-testid="recording-source-system"] .recording-source__fill',
      );
      expect(Number.parseFloat(
        panel.document.defaultView.getComputedStyle(systemFill).width,
      )).toBe(2);
      expect(panel.ludone.beginRecording).toHaveBeenCalledWith(["microphone"]);
      expect(panel.recorders).toHaveLength(2);
      expect(panel.audioContexts).toHaveLength(1);
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
        "Porada / provozu",
      );
      const status = panel.document.querySelector('[data-recording-phase] [role="status"]');
      expect(status?.textContent?.trim().length).toBeGreaterThan(0);
      expect(status?.hidden).toBe(false);
    } finally {
      await panel.cleanup();
    }
  });

  it("přeskočení pojmenování neztratí dokončenou nahrávku a exportuje bez názvu", async () => {
    const panel = await renderRecordingCard();

    try {
      await startRecording(panel);
      await stopRecording(panel);

      const skip = panel.document.querySelector('[data-testid="skip-recording-name"]');
      await panel.click(skip);
      await panel.waitForPhase("idle");

      expect(panel.ludone.finishRecording).toHaveBeenCalledTimes(1);
      expect(panel.ludone.exportRecording).toHaveBeenCalledWith(SESSION_ID, "");
      const status = panel.document.querySelector('[data-recording-phase] [role="status"]');
      expect(status?.textContent?.trim().length).toBeGreaterThan(0);
      expect(status?.hidden).toBe(false);
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
        expect.any(String),
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
            "dvoukanálový soubor už z aplikace nevyexportujete",
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
      await panel.sampleLevels();
      const restoredSystemFill = card?.querySelector(
        '[data-testid="recording-source-system"] .recording-source__fill',
      );
      expect(Number.parseFloat(
        panel.document.defaultView.getComputedStyle(restoredSystemFill).width,
      )).toBeGreaterThan(40);

      await React.act(async () => {
        panel.replacementSystemTrack.readyState = "ended";
        panel.replacementSystemTrack.dispatchEvent(
          new panel.document.defaultView.Event("ended"),
        );
        await Promise.resolve();
      });
      expect(panel.document.querySelector('[data-testid="system-audio-outage"]')).not.toBeNull();

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
        signedIn: true,
        systemAudioLost: true,
        tracking: false,
      }));

      await panel.click(panel.document.querySelector('[data-testid="retry-system-audio"]'));
      await vi.waitFor(() => expect(panel.ludone.reportTrayFacts).toHaveBeenLastCalledWith({
        signedIn: true,
        systemAudioLost: false,
        tracking: false,
      }));

      await stopRecording(panel);
    } finally {
      await panel.cleanup();
    }
  });

  it("App při souběhu ponechá obě aktivní karty čitelné a samostatně ovladatelné", async () => {
    const panel = await renderRecordingCard({ renderApp: true });

    try {
      await startRecording(panel);
      await panel.click(panel.document.querySelector('[aria-label="Spustit LuTrack"]'));
      await React.act(async () => Promise.resolve());

      const scroll = panel.document.querySelector(".panel-scroll");
      const recordingState = panel.document.querySelector('[data-testid="recording-running-state"]');
      const trackingState = panel.document.querySelector('[data-testid="tracking-running-state"]');
      const recordingCard = recordingState?.closest('[aria-label="Nahrávání"]');
      const trackingCard = trackingState?.closest('[aria-label="LuTrack"]');

      expect(recordingState?.hidden).toBe(false);
      expect(trackingState?.hidden).toBe(false);
      expect(recordingCard?.parentElement).toBe(scroll);
      expect(trackingCard?.parentElement).toBe(scroll);
      expect(recordingCard?.getAttribute("data-layout")).toBe("compact");
      expect(trackingCard?.getAttribute("data-layout")).toBe("compact");
      expect(recordingCard?.querySelector('[data-testid="recording-source-microphone"]')).not.toBeNull();
      expect(recordingCard?.querySelector('[data-testid="recording-source-system"]')).not.toBeNull();
      expect(recordingCard?.querySelector('[data-testid="recording-stop"]')).not.toBeNull();
      expect(trackingCard?.querySelector('[data-testid="tracking-stop"]')).not.toBeNull();

      await panel.click(trackingCard?.querySelector('[data-testid="tracking-stop"]'));
      expect(panel.phase()).toBe("recording");
      expect(panel.ludone.finishRecording).not.toHaveBeenCalled();
      expect(panel.document.querySelector('[data-testid="tracking-running-state"]')).toBeNull();

      await stopRecording(panel);
    } finally {
      await panel.cleanup();
    }
  });
});
