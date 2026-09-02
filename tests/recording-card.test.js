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

/**
 * @param {{ deferCapture?: boolean, displayError?: Error | DOMException }} [options]
 */
async function renderRecordingCard(options = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
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
    finishRecordingExport: vi.fn().mockResolvedValue({ ok: true }),
    exportRecording: vi.fn().mockResolvedValue({
      ok: true,
      fileName: `LuDone-${SESSION_ID}.webm`,
    }),
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

  class FakeAudioContext {
    constructor() {
      this.sampleRate = 48_000;
      this.state = "running";
    }

    createMediaStreamSource() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    }

    createChannelMerger() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    }

    createMediaStreamDestination() {
      return {
        stream: new FakeMediaStream([stereoTrack]),
        channelCount: 2,
        channelCountMode: "explicit",
        channelInterpretation: "speakers",
      };
    }

    close() {
      return Promise.resolve();
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
  await React.act(async () => {
    root.render(React.createElement(RecordingCard, { onActivityChange, trayCommand }));
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
    async setTrayCommand(command) {
      trayCommand = command;
      await React.act(async () => {
        root.render(React.createElement(RecordingCard, { onActivityChange, trayCommand }));
      });
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
      expect(panel.recorders).toHaveLength(3);

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
});
