import * as React from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { RecordingTestStep } from "../src/components/RecordingTestStep.jsx";
import { createStereoLevelSession } from "../src/lib/audio-levels.js";
import { createDiagnosticsSnapshot, formatDiagnosticsExport } from "../src/lib/diagnostics.js";

const mounted = [];
const UNKNOWN_LABELS = {
  microphone: "Mikrofon — název neznámý",
  system: "Ostatní zvuk — název neznámý",
};

function setup({ microphone = "USB mikrofon", system = "Systémový výstup", missing = "" } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const view = dom.window;
  const tracks = [microphone, system].map((label) => Object.assign(new view.EventTarget(), {
    label, kind: "audio", readyState: "live", enabled: true, muted: false, stop: vi.fn(),
  }));
  const streams = tracks.map((track, index) => {
    const availableTracks = missing === ["microphone", "system"][index] ? [] : [track];
    return {
      getAudioTracks: () => availableTracks,
      getTracks: () => availableTracks,
      getVideoTracks: () => [],
    };
  });
  Object.defineProperty(view, "isSecureContext", { value: true });
  Object.defineProperty(view.navigator, "mediaDevices", { value: {
    getUserMedia: vi.fn().mockResolvedValue(streams[0]),
    getDisplayMedia: vi.fn().mockResolvedValue(streams[1]),
  } });
  class FakeAudioContext {
    state = "running";
    async close() { this.state = "closed"; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() {
      return { fftSize: 256, smoothingTimeConstant: 0, disconnect() {},
        getFloatTimeDomainData: (buffer) => buffer.fill(0.02) };
    }
  }
  Object.defineProperty(view, "AudioContext", { value: FakeAudioContext });
  const frames = new Map();
  let frameId = 0;
  view.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);
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
    document: view.document,
    async render(promise) {
      await React.act(async () => root.render(React.createElement(RecordingTestStep, {
        sessionAttempt: { promise, cancel: vi.fn() },
        onPassed: vi.fn(), onRetry: vi.fn(), onSkipped: vi.fn(),
      })));
    },
    async frame() {
      await React.act(async () => {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(0));
      });
    },
  };
}

function expectNeutralDevice(panel, label) {
  const device = panel.document.querySelector(".recording-test-device");
  expect(device?.textContent).toBe(label);
  expect(device?.getAttributeNames()).toEqual(["class"]);
  expect(device?.className).toBe("recording-test-device");
  expect(panel.document.querySelector('[role="alert"]')).toBeNull();
}

afterEach(async () => {
  for (const { dom, root } of mounted.splice(0).reverse()) {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
  vi.unstubAllGlobals();
});

describe("název zvukového zařízení bez domýšlení hardwaru", () => {
  it("známá jména zachová včetně okolních mezer, bez hlášení nebo zvýraznění", async () => {
    const labels = { microphone: "  USB mikrofon Žluťoučký  ", system: "  Výstup č. 2  " };
    const panel = setup(labels);
    const promise = createStereoLevelSession();
    await panel.render(promise);
    const session = await promise;
    expect(session.labels).toEqual(labels);
    await panel.frame();
    expectNeutralDevice(panel, labels.microphone);
    expect(panel.document.querySelector("[data-recording-test-state]")?.dataset.recordingTestState)
      .toBe("testing");
  });

  it.each([
    { stav: "prázdný řetězec", label: "" },
    { stav: "jen mezery", label: "   " },
  ])("$stav: existující stopy mají neznámé jméno, bez modelu a bez chyby", async ({ label }) => {
    const panel = setup({ microphone: label, system: label });
    const promise = createStereoLevelSession();
    await panel.render(promise);
    const session = await promise;
    expect(panel.document.body.textContent).not.toContain("MacBook");
    expect(JSON.stringify(session.labels)).not.toContain("MacBook");
    expect(session.labels).toEqual(UNKNOWN_LABELS);
    for (let frame = 0; frame < 6; frame += 1) await panel.frame();
    expectNeutralDevice(panel, UNKNOWN_LABELS.microphone);
    expect(panel.document.querySelector("[data-recording-test-state]")?.dataset.recordingTestState)
      .toBe("testing");
    expect(panel.document.querySelector('[data-testid="recording-test-continue"]').disabled)
      .toBe(false);
  });

  it.each(["microphone", "system"])("chybějící stopa %s není zařízení s neznámým jménem", async (missing) => {
    const panel = setup({ microphone: "", system: "", missing });
    const promise = createStereoLevelSession();
    // Očekávání se připojí před vykreslením, aby odmítnutí nezůstalo neobsloužené.
    const rejected = expect(promise).rejects.toThrow("nalezeno 0");
    await panel.render(promise);
    await rejected;
    expect(panel.document.querySelector("[data-recording-test-state]")?.dataset.recordingTestState)
      .toBe("error");
    expect(panel.document.querySelector('[role="alert"]')?.textContent)
      .toBe("Zvuk se nepodařilo změřit. Zkus test znovu.");
    expect(panel.document.body.textContent).not.toContain("název neznámý");
    expect(panel.document.body.textContent).not.toContain("MacBook");
    expect(panel.document.querySelector('[data-testid="recording-test-continue"]').disabled)
      .toBe(true);
  });

  it("první vykreslení před získáním stop obsahuje jen obecný popisek", () => {
    const panel = setup();
    panel.document.querySelector("#root").innerHTML = renderToStaticMarkup(
      React.createElement(RecordingTestStep, {
        sessionAttempt: { promise: new Promise(() => {}), cancel: vi.fn() },
        onPassed: vi.fn(), onRetry: vi.fn(), onSkipped: vi.fn(),
      }),
    );
    expectNeutralDevice(panel, "Mikrofon");
    expect(panel.document.body.textContent).not.toContain("MacBook");
  });

  it("nový pokus resetuje předchozí změřené jméno na obecný popisek", async () => {
    const panel = setup({ microphone: "Původní mikrofon" });
    await panel.render(createStereoLevelSession());
    expectNeutralDevice(panel, "Původní mikrofon");
    await panel.render(new Promise(() => {}));
    expectNeutralDevice(panel, "Mikrofon");
    expect(panel.document.querySelector("[data-recording-test-state]")?.dataset.recordingTestState)
      .toBe("starting");
  });

  it("diagnostický export nepřebírá názvy stop ani při přidání do vstupu", async () => {
    const panel = setup();
    const promise = createStereoLevelSession();
    await panel.render(promise);
    const session = await promise;
    const input = {
      appVersion: "0.1.0", architecture: "arm64", microphoneStatus: "granted",
      systemAudioStatus: "granted", queueItems: [], labels: session.labels,
    };
    const snapshot = createDiagnosticsSnapshot(input);
    expect(Object.keys(snapshot).sort()).toEqual([
      "architecture", "permissions", "queue", "serverConnection", "version",
    ]);
    const exported = formatDiagnosticsExport({ ...snapshot, labels: session.labels });
    expect(exported).toBe(formatDiagnosticsExport(snapshot));
    expect(exported).toContain("Mikrofon: Povoleno\nOstatní zvuk: Povoleno\n");
    for (const label of Object.values(session.labels)) expect(exported).not.toContain(label);
  });
});
