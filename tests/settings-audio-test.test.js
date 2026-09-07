import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { SettingsApp } from "../src/components/Settings.jsx";

const mounted = [];

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

async function renderSettingsAudio({ missing = "", pendingSystem = null } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const view = dom.window;
  const tracks = ["USB mikrofon", "Systémový zvuk", "Obrazovka"].map((label, index) => (
    Object.assign(new view.EventTarget(), {
      label,
      kind: index === 2 ? "video" : "audio",
      readyState: "live",
      enabled: true,
      muted: false,
      stop: vi.fn(function () { this.readyState = "ended"; }),
    })
  ));
  const stream = (audioTracks, videoTracks = []) => ({
    getAudioTracks: () => audioTracks,
    getVideoTracks: () => videoTracks,
    getTracks: () => [...audioTracks, ...videoTracks],
  });
  const microphoneStream = stream([tracks[0]]);
  const systemStream = stream(missing === "system" ? [] : [tracks[1]], [tracks[2]]);
  const mediaDevices = {
    getUserMedia: vi.fn().mockImplementation(() => missing === "microphone"
      ? Promise.reject(new Error("Mikrofon není povolený"))
      : Promise.resolve(microphoneStream)),
    getDisplayMedia: vi.fn().mockImplementation(() => pendingSystem ?? Promise.resolve(systemStream)),
  };
  const contexts = [];
  class FakeAudioContext {
    state = "running";
    close = vi.fn(async () => { this.state = "closed"; });
    constructor() { contexts.push(this); }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() {
      // Nulové vzorky nesmějí v Nastavení znamenat neexistující stopu ani úspěšné ověření.
      return { fftSize: 256, smoothingTimeConstant: 0, disconnect() {},
        getFloatTimeDomainData: (buffer) => buffer.fill(0) };
    }
  }
  Object.defineProperty(view, "isSecureContext", { value: true });
  Object.defineProperty(view.navigator, "mediaDevices", { value: mediaDevices });
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
  let unmounted = false;
  async function unmount() {
    if (unmounted) return;
    unmounted = true;
    await React.act(async () => root.unmount());
  }
  mounted.push({ dom, unmount });
  await React.act(async () => root.render(React.createElement(SettingsApp)));

  const button = (label) => [...view.document.querySelectorAll("button")]
    .find((candidate) => candidate.textContent.trim() === label);
  return {
    document: view.document,
    tracks,
    contexts,
    mediaDevices,
    systemStream,
    stream,
    frames,
    button,
    unmount,
    async click(label) {
      const target = button(label);
      expect(target, `Chybí tlačítko „${label}“`).toBeDefined();
      expect(target.closest("[hidden]"), `Tlačítko „${label}“ je skryté`).toBeNull();
      await React.act(async () => target.click());
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

function expectReleased(settings) {
  for (const track of settings.tracks) {
    expect(track.stop).toHaveBeenCalled();
    expect(track.readyState).toBe("ended");
  }
  for (const context of settings.contexts) {
    expect(context.close).toHaveBeenCalledOnce();
    expect(context.state).toBe("closed");
  }
  expect(settings.frames.size).toBe(0);
}

afterEach(async () => {
  for (const { dom, unmount } of mounted.splice(0).reverse()) {
    await unmount();
    dom.window.close();
  }
  vi.unstubAllGlobals();
});

describe("opakovaná zkouška zvuku v Nastavení", () => {
  it("karta Zvuk nabízí spuštění zkoušky", async () => {
    const settings = await renderSettingsAudio();
    await settings.click("Zvuk");
    const start = settings.button("Spustit zkoušku");
    expect(start, "Na kartě Zvuk chybí spuštění zkoušky").toBeDefined();
    expect(start.closest('[role="tabpanel"]').id).toBe("settings-panel-audio");
    expect(start.closest("[hidden]")).toBeNull();
    expect(start.closest(".settings-row")).not.toBeNull();
    expect(start.closest(".settings-group")).not.toBeNull();
    expect(start.disabled).toBe(false);
  });

  it("zkouška se nespustí sama při otevření Nastavení ani karty Zvuk", async () => {
    const settings = await renderSettingsAudio();
    expect(settings.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(settings.mediaDevices.getDisplayMedia).not.toHaveBeenCalled();
    await settings.click("Zvuk");
    await settings.frame();
    expect(settings.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(settings.mediaDevices.getDisplayMedia).not.toHaveBeenCalled();
    expect(settings.contexts).toHaveLength(0);
    expect(settings.document.querySelector('[data-testid="recording-test-screen"]')).toBeNull();
  });

  it("kliknutí spustí sdílená dvě měřidla a zastavení uvolní všechny stopy", async () => {
    const settings = await renderSettingsAudio();
    await settings.click("Zvuk");
    await settings.click("Spustit zkoušku");
    expect(settings.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
    expect(settings.mediaDevices.getDisplayMedia).toHaveBeenCalledOnce();
    await settings.frame();
    for (const source of ["microphone", "system"]) {
      const row = settings.document.querySelector(`[data-testid="recording-level-${source}"]`);
      expect(row).not.toBeNull();
      expect(row.dataset.levelMonitorState).toBe("measured");
      expect(row.dataset.level).toBe("0");
      expect(row.textContent).toContain("nahrává se");
    }
    const test = settings.document.querySelector('[data-testid="recording-test-screen"]');
    expect(test.textContent).not.toMatch(/ověřeno|Oba kanály slyším|Pokračovat/u);
    expect(settings.tracks[0].stop).not.toHaveBeenCalled();
    expect(settings.tracks[1].stop).not.toHaveBeenCalled();
    await settings.click("Zastavit zkoušku");
    expectReleased(settings);
    expect(settings.document.querySelector('[data-testid="recording-test-screen"]')).toBeNull();
    expect(settings.button("Spustit zkoušku")).toBeDefined();
  });

  it("po zastavení lze spustit novou zkoušku s nově získanými stopami", async () => {
    const settings = await renderSettingsAudio();
    await settings.click("Zvuk");
    await settings.click("Spustit zkoušku");
    await settings.click("Zastavit zkoušku");
    expectReleased(settings);
    const nextTracks = settings.tracks.map((track) => ({
      ...track,
      readyState: "live",
      stop: vi.fn(function () { this.readyState = "ended"; }),
    }));
    settings.mediaDevices.getUserMedia.mockResolvedValueOnce(settings.stream([nextTracks[0]]));
    settings.mediaDevices.getDisplayMedia.mockResolvedValueOnce(settings.stream([nextTracks[1]], [nextTracks[2]]));
    await settings.click("Spustit zkoušku");
    await settings.frame();
    expect(settings.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(settings.mediaDevices.getDisplayMedia).toHaveBeenCalledTimes(2);
    expect(settings.contexts).toHaveLength(2);
    expect(settings.contexts[1].state).toBe("running");
    await settings.click("Zastavit zkoušku");
    expectReleased(settings);
    for (const track of nextTracks) {
      expect(track.stop).toHaveBeenCalled();
      expect(track.readyState).toBe("ended");
    }
  });

  it("odchod z karty Zvuk uvolní stopy a návrat sám zkoušku nespustí", async () => {
    const settings = await renderSettingsAudio();
    await settings.click("Zvuk");
    await settings.click("Spustit zkoušku");
    await settings.click("Účet");
    expectReleased(settings);
    await settings.click("Zvuk");
    expect(settings.button("Spustit zkoušku")).toBeDefined();
    expect(settings.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  });

  it("odpojení Nastavení uvolní mikrofon i systémovou stopu", async () => {
    const settings = await renderSettingsAudio();
    await settings.click("Zvuk");
    await settings.click("Spustit zkoušku");
    await settings.unmount();
    expectReleased(settings);
  });

  it("ztráta stopy během zkoušky zastaví oba zdroje a ukáže chybu", async () => {
    const settings = await renderSettingsAudio();
    await settings.click("Zvuk");
    await settings.click("Spustit zkoušku");
    await settings.frame();
    settings.tracks[1].readyState = "ended";
    await settings.frame();
    expectReleased(settings);
    const test = settings.document.querySelector('[data-testid="recording-test-screen"]');
    expect(test.dataset.recordingTestState).toBe("error");
    expect(test.querySelector('[role="alert"]').textContent).toContain("Zkouška je zastavená");
    expect(test.textContent).not.toMatch(/nahrává se|ověřeno|slyším|ticho/u);
    for (const meter of test.querySelectorAll(".audio-level-meter")) {
      expect(meter.dataset.measurementState).toBe("unavailable");
    }
  });

  it("zastavení během získávání stop uvolní i opožděný systémový stream", async () => {
    const pending = deferred();
    const settings = await renderSettingsAudio({ pendingSystem: pending.promise });
    await settings.click("Zvuk");
    await settings.click("Spustit zkoušku");
    await settings.click("Zastavit zkoušku");
    expect(settings.tracks[0].readyState).toBe("ended");
    await React.act(async () => pending.resolve(settings.systemStream));
    expectReleased(settings);
    expect(settings.contexts).toHaveLength(0);
    expect(settings.button("Spustit zkoušku")).toBeDefined();
  });

  it.each(["microphone", "system"])("nezískaná stopa %s zobrazí chybu a uvolní získané stopy", async (missing) => {
    const settings = await renderSettingsAudio({ missing });
    await settings.click("Zvuk");
    await settings.click("Spustit zkoušku");
    const test = settings.document.querySelector('[data-testid="recording-test-screen"]');
    expect(test.dataset.recordingTestState).toBe("error");
    expect(test.querySelector('[role="alert"]').textContent).toContain("nepodařilo získat či změřit");
    expect(test.textContent).not.toMatch(/ověřeno|slyším|ticho|nahrává se/u);
    const acquired = missing === "microphone" ? [1, 2] : [0, 2];
    for (const index of acquired) expect(settings.tracks[index].readyState).toBe("ended");
    expect(settings.button("Zkusit znovu")).toBeDefined();
    await settings.click("Zastavit zkoušku");
    expect(settings.button("Spustit zkoušku")).toBeDefined();
  });
});
