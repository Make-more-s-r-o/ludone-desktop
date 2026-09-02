import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { RecordingCard } from "../src/features/recording/RecordingCard.jsx";

const SESSION_ID = "session-test-1";

function deferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function recordingResult() {
  return {
    files: {
      microphone: { name: "microphone.webm", size: 4 },
      system: { name: "system.webm", size: 6 },
    },
  };
}

/**
 * @param {{ deferCapture?: boolean, displayError?: Error | DOMException }} [options]
 */
async function renderRecordingCard(options = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
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
  const videoTrack = Object.assign(new dom.window.EventTarget(), {
    kind: "video",
    label: "Testovací obraz",
    readyState: "live",
    enabled: true,
    muted: false,
    stop: vi.fn(),
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
  const microphoneCapture = deferred();
  const displayCapture = deferred();
  const getUserMedia = vi.fn(() => (
    options.deferCapture ? microphoneCapture.promise : Promise.resolve(microphoneStream)
  ));
  const getDisplayMedia = vi.fn(() => {
    if (options.displayError) return Promise.reject(options.displayError);
    return options.deferCapture ? displayCapture.promise : Promise.resolve(displayStream);
  });
  Object.defineProperty(dom.window.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia, getDisplayMedia },
  });
  Object.defineProperty(dom.window, "isSecureContext", {
    configurable: true,
    value: true,
  });

  const ludone = {
    beginRecording: vi.fn().mockResolvedValue({ sessionId: SESSION_ID }),
    appendRecordingChunk: vi.fn().mockResolvedValue({ sequence: 0, bytes: 4 }),
    finishRecording: vi.fn().mockResolvedValue(recordingResult()),
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
      recorders.push(this);
    }

    start(timeslice) {
      this.timeslice = timeslice;
      this.state = "recording";
      /** @type {any} */ (this).dispatchEvent(new dom.window.Event("start"));
    }

    stop() {
      this.state = "inactive";
      /** @type {any} */ (this).dispatchEvent(new dom.window.Event("stop"));
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
  }

  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("navigator", dom.window.navigator);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  vi.stubGlobal("MediaStream", FakeMediaStream);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const root = createRoot(dom.window.document.querySelector("#root"));
  const onActivityChange = vi.fn();
  await React.act(async () => {
    root.render(React.createElement(RecordingCard, { onActivityChange }));
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
    microphoneTrack,
    systemTrack,
    phase,
    currentButton,
    resolveCapture() {
      microphoneCapture.resolve(microphoneStream);
      displayCapture.resolve(displayStream);
    },
    async click(element) {
      if (!element) throw new Error("Test očekával dostupné tlačítko");
      await React.act(async () => {
        element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      });
    },
    async waitForPhase(expectedPhase) {
      await React.act(async () => {
        await vi.waitFor(() => expect(phase()).toBe(expectedPhase));
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
  await panel.waitForPhase("idle");
}

describe("RecordingCard", () => {
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
      expect(panel.recorders).toHaveLength(2);

      await stopRecording(panel);
    } finally {
      await panel.cleanup();
    }
  });

  it("odmítnutí systémového zvuku ukáže jako chybu a vrátí se do klidu", async () => {
    const denied = new DOMException("Přístup zamítnut", "NotAllowedError");
    const panel = await renderRecordingCard({ displayError: denied });

    try {
      await panel.click(panel.currentButton());
      await React.act(async () => {
        await vi.waitFor(() => {
          const alert = panel.document.querySelector('[data-recording-phase] [role="alert"]');
          expect(alert).not.toBeNull();
          expect(alert?.textContent?.trim().length).toBeGreaterThan(0);
          expect(alert?.hidden).toBe(false);
        });
      });

      expect(panel.phase()).toBe("idle");
      expect(panel.document.querySelector('[data-recording-phase="recording"]')).toBeNull();
      expect(panel.ludone.beginRecording).not.toHaveBeenCalled();
      expect(panel.microphoneTrack.stop).toHaveBeenCalledTimes(1);
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
      expect(panel.recorders).toHaveLength(2);
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
      expect(panel.ludone.finishRecording).toHaveBeenCalledWith(SESSION_ID);
      expect(panel.phase()).toBe("idle");
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
        (recorder) => recorder.stream.getTracks()[0] === panel.systemTrack,
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
});
