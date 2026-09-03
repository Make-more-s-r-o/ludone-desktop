import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { Onboarding } from "../src/components/Onboarding.jsx";

const mountedPanels = [];

function deferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createTrack(view, kind, label) {
  return Object.assign(new view.EventTarget(), {
    enabled: true,
    kind,
    label,
    muted: false,
    readyState: "live",
    stop: vi.fn(),
  });
}

function audioSamples(amplitude, target) {
  for (let index = 0; index < target.length; index += 1) {
    target[index] = index % 2 === 0 ? amplitude : -amplitude;
  }
}

/**
 * @param {{
 *   beginAuth?: ReturnType<typeof vi.fn>,
 *   cancelAuth?: ReturnType<typeof vi.fn>,
 *   deferDisplayCapture?: boolean,
 *   microphoneAmplitude?: number,
 *   pendingAuthUrl?: import("vitest").Mock,
 *   rejectFirstDisplayCapture?: boolean,
 *   requestPermission?: ReturnType<typeof vi.fn>,
 *   systemAmplitude?: number,
 * }} [options]
 */
async function renderOnboarding(options = {}) {
  const {
    beginAuth = vi.fn().mockResolvedValue({
      ok: true,
      user: { name: "Testovací uživatel", email: "test@ludone.cz" },
    }),
    cancelAuth = vi.fn().mockResolvedValue({ ok: true, cancelled: 1 }),
    pendingAuthUrl = vi.fn().mockResolvedValue(null),
    deferDisplayCapture = false,
    microphoneAmplitude = 0,
    rejectFirstDisplayCapture = false,
    requestPermission = vi.fn().mockResolvedValue({
      granted: true,
      status: "granted",
    }),
    systemAmplitude = 0,
  } = options;
  const dom = new JSDOM('<div id="root"></div>', {
    pretendToBeVisual: true,
    url: "https://ludone.test",
  });
  const microphoneTrack = createTrack(dom.window, "audio", "Testovací mikrofon");
  const systemTrack = createTrack(dom.window, "audio", "Testovací systémový zvuk");
  const videoTrack = createTrack(dom.window, "video", "Testovací obraz");
  const microphoneStream = {
    source: "microphone",
    getAudioTracks: () => [microphoneTrack],
    getTracks: () => [microphoneTrack],
    getVideoTracks: () => [],
  };
  const systemStream = {
    source: "system",
    getAudioTracks: () => [systemTrack],
    getTracks: () => [systemTrack, videoTrack],
    getVideoTracks: () => [videoTrack],
  };
  const getUserMedia = vi.fn().mockResolvedValue(microphoneStream);
  const displayCapture = deferred();
  const getDisplayMedia = deferDisplayCapture
    ? vi.fn(() => displayCapture.promise)
    : rejectFirstDisplayCapture
      ? vi.fn()
        .mockRejectedValueOnce(new DOMException("Výběr byl zrušen", "NotAllowedError"))
        .mockResolvedValue(systemStream)
      : vi.fn().mockResolvedValue(systemStream);
  Object.defineProperty(dom.window.navigator, "mediaDevices", {
    configurable: true,
    value: { getDisplayMedia, getUserMedia },
  });
  Object.defineProperty(dom.window, "isSecureContext", {
    configurable: true,
    value: true,
  });

  const animationFrames = new Map();
  let nextAnimationFrame = 1;
  dom.window.requestAnimationFrame = vi.fn((callback) => {
    const id = nextAnimationFrame;
    nextAnimationFrame += 1;
    animationFrames.set(id, callback);
    return id;
  });
  dom.window.cancelAnimationFrame = vi.fn((id) => {
    animationFrames.delete(id);
  });

  const canvasContext = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
  };
  dom.window.HTMLCanvasElement.prototype.getContext = vi.fn(() => canvasContext);

  const audioContexts = [];
  class FakeAudioContext {
    constructor() {
      this.destination = {};
      this.state = "running";
      this.close = vi.fn(async () => {
        this.state = "closed";
      });
      this.resume = vi.fn(async () => {});
      audioContexts.push(this);
    }

    createAnalyser() {
      return {
        fftSize: 0,
        smoothingTimeConstant: 0,
        disconnect: vi.fn(),
        getFloatTimeDomainData(target) {
          const amplitude = this.source === "microphone"
            ? microphoneAmplitude
            : systemAmplitude;
          audioSamples(amplitude, target);
        },
      };
    }

    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }

    createMediaStreamSource(stream) {
      return {
        connect: vi.fn((analyser) => {
          analyser.source = stream.source;
        }),
        disconnect: vi.fn(),
      };
    }

    createOscillator() {
      return {
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }

    get currentTime() {
      return 0;
    }
  }
  Object.defineProperty(dom.window, "AudioContext", {
    configurable: true,
    value: FakeAudioContext,
  });

  const clipboardWrites = [];
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async (text) => { clipboardWrites.push(text); }) },
  });
  Object.defineProperty(dom.window, "ludone", {
    configurable: true,
    value: {
      beginAuth,
      cancelAuth,
      pendingAuthUrl,
      requestPermission,
    },
  });

  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("navigator", dom.window.navigator);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("HTMLCanvasElement", dom.window.HTMLCanvasElement);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const root = createRoot(dom.window.document.querySelector("#root"));
  await React.act(async () => {
    root.render(React.createElement(Onboarding, {
      onAuthenticated: vi.fn(),
      onComplete: vi.fn(),
    }));
  });
  let unmounted = false;
  let closed = false;
  const unmount = async () => {
    if (unmounted) return;
    unmounted = true;
    await React.act(async () => root.unmount());
  };
  const panel = {
    audioContexts,
    beginAuth,
    cancelAuth,
    clipboardWrites,
    document: dom.window.document,
    getDisplayMedia,
    getUserMedia,
    microphoneTrack,
    requestPermission,
    resolveDisplayCapture: () => displayCapture.resolve(systemStream),
    systemTrack,
    videoTrack,
    view: dom.window,
    async click(element) {
      if (!element) throw new Error("Test očekával dostupné tlačítko");
      await React.act(async () => {
        element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      });
    },
    async frame() {
      const next = animationFrames.entries().next().value;
      if (!next) throw new Error("Test očekával naplánovaný audio snímek");
      const [id, callback] = next;
      animationFrames.delete(id);
      await React.act(async () => callback(dom.window.performance.now()));
    },
    unmount,
    async cleanup() {
      await unmount();
      if (closed) return;
      closed = true;
      dom.window.close();
    },
  };
  mountedPanels.push(panel);
  return panel;
}

async function enterAuthentication(panel) {
  await panel.click(panel.document.querySelector(".welcome-step .button--wide"));
}

async function navigateToPermissions(panel) {
  await enterAuthentication(panel);
  await panel.click(panel.document.querySelector(".auth-step .button--wide"));
  await vi.waitFor(() => {
    expect(panel.document.querySelector(".permission-step")).not.toBeNull();
  });
}

async function navigateToRecordingTest(panel) {
  await navigateToPermissions(panel);
  for (const button of [...panel.document.querySelectorAll('[data-testid="permission-action"]')]) {
    await panel.click(button);
  }
  await panel.click(panel.document.querySelector(".permission-step > .button--wide"));
  await vi.waitFor(() => {
    expect(panel.getUserMedia).toHaveBeenCalledOnce();
    expect(panel.getDisplayMedia).toHaveBeenCalledOnce();
  });
}

async function enterRecordingTest(panel) {
  await navigateToRecordingTest(panel);
  for (let index = 0; index < LIVE_CONFIRMATION_TEST_FRAMES; index += 1) {
    await panel.frame();
  }
}

const LIVE_CONFIRMATION_TEST_FRAMES = 6;

afterEach(async () => {
  while (mountedPanels.length > 0) {
    await mountedPanels.pop().cleanup();
  }
  vi.unstubAllGlobals();
});

describe("dva chybějící kroky onboardingu", () => {
  it("během OAuth ukáže samostatné čekání a dovolí otevřít nový pokus", async () => {
    const firstAttempt = deferred();
    const secondAttempt = deferred();
    const beginAuth = vi.fn()
      .mockImplementationOnce(() => firstAttempt.promise)
      .mockImplementationOnce(() => secondAttempt.promise);
    const panel = await renderOnboarding({ beginAuth });

    await enterAuthentication(panel);
    await panel.click(panel.document.querySelector(".auth-step .button--wide"));

    const waiting = panel.document.querySelector('[data-testid="auth-waiting-screen"]');
    expect(waiting).not.toBeNull();
    expect(waiting.dataset.authWaitingState).toBe("waiting");
    expect(waiting.textContent.trim()).not.toBe("");
    expect(panel.document.querySelectorAll(".step-track span")).toHaveLength(6);
    expect(panel.document.querySelector('[data-testid="auth-waiting-countdown"]')).not.toBeNull();

    const retry = waiting.querySelector('[data-testid="auth-waiting-retry"]');
    expect(retry?.disabled).toBe(false);
    await panel.click(retry);
    expect(panel.cancelAuth).toHaveBeenCalledOnce();
    expect(panel.beginAuth).toHaveBeenCalledTimes(2);
    expect(panel.document.querySelector('[data-testid="auth-waiting-retry"]')?.disabled)
      .toBe(false);

    secondAttempt.resolve({
      ok: true,
      user: { name: "Nový pokus", email: "novy@ludone.cz" },
    });
    await React.act(async () => secondAttempt.promise);
    expect(panel.document.querySelector(".permission-step")).not.toBeNull();

    firstAttempt.resolve({ ok: false, duvod: "odmitnuto" });
    await React.act(async () => firstAttempt.promise);
    expect(panel.document.querySelector(".permission-step")).not.toBeNull();
    expect(panel.document.querySelector('[data-testid="auth-error-screen"]')).toBeNull();
  });

  it("po zavření čekacího kroku už opožděné zrušení neotevře nový OAuth", async () => {
    const authAttempt = deferred();
    const cancelAttempt = deferred();
    const beginAuth = vi.fn(() => authAttempt.promise);
    const cancelAuth = vi.fn(() => cancelAttempt.promise);
    const panel = await renderOnboarding({ beginAuth, cancelAuth });

    await enterAuthentication(panel);
    await panel.click(panel.document.querySelector(".auth-step .button--wide"));
    await panel.click(panel.document.querySelector('[data-testid="auth-waiting-retry"]'));
    await panel.unmount();
    cancelAttempt.resolve({ ok: true, cancelled: 1 });
    await React.act(async () => cancelAttempt.promise);
    await React.act(async () => Promise.resolve());

    expect(beginAuth).toHaveBeenCalledOnce();
  });

  it("odliší němý mikrofon od živého systémového zvuku", async () => {
    const panel = await renderOnboarding({
      microphoneAmplitude: 0,
      systemAmplitude: 0.25,
    });

    await enterRecordingTest(panel);

    const microphone = panel.document.querySelector('[data-testid="recording-level-microphone"]');
    const system = panel.document.querySelector('[data-testid="recording-level-system"]');
    expect(microphone?.dataset.signalState).toBe("silent");
    expect(system?.dataset.signalState).toBe("live");
    expect(Number(microphone?.dataset.level)).toBe(0);
    expect(Number(system?.dataset.level)).toBeGreaterThan(0);
    expect(panel.document.querySelector('[data-testid="recording-test-continue"]')?.disabled)
      .toBe(true);
    expect(panel.document.querySelector(".done-step")).toBeNull();
  });

  it("odliší němý systémový zvuk od živého mikrofonu", async () => {
    const panel = await renderOnboarding({
      microphoneAmplitude: 0.25,
      systemAmplitude: 0,
    });

    await enterRecordingTest(panel);

    const microphone = panel.document.querySelector('[data-testid="recording-level-microphone"]');
    const system = panel.document.querySelector('[data-testid="recording-level-system"]');
    expect(microphone?.dataset.signalState).toBe("live");
    expect(system?.dataset.signalState).toBe("silent");
    expect(Number(microphone?.dataset.level)).toBeGreaterThan(0);
    expect(Number(system?.dataset.level)).toBe(0);
    expect(panel.document.querySelector('[data-testid="recording-test-continue"]')?.disabled)
      .toBe(true);
    expect(panel.document.querySelector(".done-step")).toBeNull();
  });

  it("jediný živý snímek neoznačí test za dokončený", async () => {
    const panel = await renderOnboarding({
      microphoneAmplitude: 0.25,
      systemAmplitude: 0.25,
    });

    await navigateToRecordingTest(panel);
    await panel.frame();

    expect(panel.document.querySelector('[data-testid="recording-level-microphone"]')
      ?.dataset.signalState).toBe("live");
    expect(panel.document.querySelector('[data-testid="recording-level-system"]')
      ?.dataset.signalState).toBe("live");
    expect(panel.document.querySelector('[data-testid="recording-test-continue"]')?.disabled)
      .toBe(true);
    expect(panel.document.querySelector(".done-step")).toBeNull();
  });

  it("po ztrátě dříve slyšeného vstupu zruší úspěšný stav", async () => {
    const panel = await renderOnboarding({
      microphoneAmplitude: 0.25,
      systemAmplitude: 0.25,
    });

    await enterRecordingTest(panel);
    expect(panel.document.querySelector('[data-testid="recording-test-continue"]')?.disabled)
      .toBe(false);
    panel.microphoneTrack.readyState = "ended";
    await panel.frame();

    expect(panel.document.querySelector('[data-testid="recording-level-microphone"]')
      ?.dataset.signalState).toBe("silent");
    expect(panel.document.querySelector('[data-testid="recording-level-system"]')
      ?.dataset.signalState).toBe("live");
    expect(panel.document.querySelector('[data-testid="recording-test-continue"]')?.disabled)
      .toBe(true);
    expect(panel.document.querySelector('[data-testid="recording-test-retry"]')).not.toBeNull();
    expect(panel.document.querySelector(".done-step")).toBeNull();
  });

  it("po odmítnutém zachytávání nabídne nový pokus", async () => {
    const panel = await renderOnboarding({
      microphoneAmplitude: 0.25,
      rejectFirstDisplayCapture: true,
      systemAmplitude: 0.25,
    });

    await navigateToRecordingTest(panel);
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[data-testid="recording-test-screen"]')
        ?.dataset.recordingTestState).toBe("error");
    });
    const retry = panel.document.querySelector('[data-testid="recording-test-retry"]');
    expect(retry).not.toBeNull();
    await panel.click(retry);
    await vi.waitFor(() => expect(panel.getDisplayMedia).toHaveBeenCalledTimes(2));
    for (let index = 0; index < LIVE_CONFIRMATION_TEST_FRAMES; index += 1) {
      await panel.frame();
    }

    expect(panel.document.querySelector('[data-testid="recording-test-screen"]')
      ?.dataset.recordingTestState).toBe("testing");
    expect(panel.document.querySelector('[data-testid="recording-test-continue"]')?.disabled)
      .toBe(false);
  });

  it("při odchodu z testu zastaví obě stopy a zavře AudioContext", async () => {
    const panel = await renderOnboarding({
      microphoneAmplitude: 0.25,
      systemAmplitude: 0.25,
    });

    await enterRecordingTest(panel);
    const continueButton = panel.document.querySelector('[data-testid="recording-test-continue"]');
    expect(continueButton?.disabled).toBe(false);
    await panel.click(continueButton);

    expect(panel.document.querySelector(".done-step")?.dataset.recordingTestResult).toBe("passed");
    expect(panel.microphoneTrack.stop).toHaveBeenCalled();
    expect(panel.systemTrack.stop).toHaveBeenCalled();
    expect(panel.videoTrack.stop).toHaveBeenCalled();
    expect(panel.audioContexts).toHaveLength(1);
    expect(panel.audioContexts[0].close).toHaveBeenCalledOnce();
    expect(panel.audioContexts[0].state).toBe("closed");
  });

  it("uklidí získaný mikrofon i při odchodu během otevřeného systémového pickeru", async () => {
    const panel = await renderOnboarding({ deferDisplayCapture: true });

    await navigateToRecordingTest(panel);
    await React.act(async () => Promise.resolve());
    await panel.unmount();

    expect(panel.microphoneTrack.stop).toHaveBeenCalled();
    panel.resolveDisplayCapture();
    await React.act(async () => Promise.resolve());
    await React.act(async () => Promise.resolve());
    expect(panel.systemTrack.stop).toHaveBeenCalled();
    expect(panel.videoTrack.stop).toHaveBeenCalled();
    expect(panel.audioContexts).toHaveLength(0);
  });

  it("s povoleným mikrofonem pustí dál do jednostopého režimu", async () => {
    const requestPermission = vi.fn(async (permission) => (
      permission === "microphone"
        ? { granted: true, status: "granted" }
        : { granted: false, status: "denied", nextAction: "open-settings" }
    ));
    const panel = await renderOnboarding({ requestPermission });
    await navigateToPermissions(panel);
    for (const button of [...panel.document.querySelectorAll('[data-testid="permission-action"]')]) {
      await panel.click(button);
    }

    const permissionStep = panel.document.querySelector(".permission-step");
    const continueButton = permissionStep.querySelector(":scope > .button--wide");
    expect(continueButton.disabled).toBe(false);
    expect(permissionStep.textContent).toContain(
      "Můžeš povolit jen mikrofon. Časovač poběží a nahrávka bude jednostopá — jen se dozvíš, že chybí druhá strana.",
    );
    await panel.click(continueButton);

    const done = panel.document.querySelector(".done-step");
    expect(done).not.toBeNull();
    expect(done.dataset.verificationState).toBe("microphone-only");
    expect(done.textContent).toContain("nahrávka bude jednostopá");
    expect(done.textContent).not.toMatch(/Připraveno|Všechno je připravené/);
    expect(panel.getUserMedia).not.toHaveBeenCalled();
    expect(panel.getDisplayMedia).not.toHaveBeenCalled();
  });

  it("přeskočený test označí závěr jako neověřený", async () => {
    const panel = await renderOnboarding();
    await navigateToRecordingTest(panel);

    const skip = panel.document.querySelector('[data-testid="recording-test-skip"]');
    expect(skip).not.toBeNull();
    expect(skip.disabled).toBe(false);
    expect(panel.document.querySelector(".recording-test-hint")?.textContent)
      .toBe("Bez ní se nedá tvrdit, že to funguje.");
    await panel.click(skip);

    const done = panel.document.querySelector(".done-step");
    expect(done).not.toBeNull();
    expect(done.dataset.recordingTestResult).toBe("skipped");
    expect(done.dataset.verificationState).toBe("unverified");
    expect(done.textContent).toContain("Neověřeno");
    expect(done.textContent).toContain("Bez ní se nedá tvrdit, že to funguje.");
    expect(done.textContent).not.toMatch(/Připraveno|Všechno je připravené/);
  });

  it("neúspěšný test označí závěr jako neověřený", async () => {
    const panel = await renderOnboarding({ rejectFirstDisplayCapture: true });
    await navigateToRecordingTest(panel);
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[data-testid="recording-test-screen"]')
        ?.dataset.recordingTestState).toBe("error");
    });
    expect(panel.document.querySelector(".recording-test-hint")?.textContent)
      .toBe("Bez ní se nedá tvrdit, že to funguje.");
    await panel.click(panel.document.querySelector('[data-testid="recording-test-skip"]'));

    const done = panel.document.querySelector(".done-step");
    expect(done).not.toBeNull();
    expect(done.dataset.recordingTestResult).toBe("failed");
    expect(done.dataset.verificationState).toBe("unverified");
    expect(done.textContent).toContain("Neověřeno");
    expect(done.textContent).toContain("Bez ní se nedá tvrdit, že to funguje.");
    expect(done.textContent).not.toMatch(/Připraveno|Všechno je připravené/);
  });

  it("až po úspěšném testu obou kanálů ukáže Připraveno", async () => {
    const panel = await renderOnboarding({
      microphoneAmplitude: 0.25,
      systemAmplitude: 0.25,
    });
    await enterRecordingTest(panel);
    await panel.click(panel.document.querySelector('[data-testid="recording-test-continue"]'));

    const done = panel.document.querySelector(".done-step");
    expect(done.dataset.recordingTestResult).toBe("passed");
    expect(done.dataset.verificationState).toBe("both");
    expect(done.textContent).toContain("Připraveno");
    expect(done.textContent).toContain(
      "Oba kanály slyším. Panel najdeš pod ikonou v horní liště.",
    );
  });

  it("na čekací obrazovce ukáže adresu, kterou lze zkopírovat, když se prohlížeč neotevřel", async () => {
    const url = "https://app.ludone.cz/api/mcp/oauth/authorize?state=abc&code_challenge=xyz";
    const panel = await renderOnboarding({
      beginAuth: vi.fn(() => new Promise(() => {})),
      pendingAuthUrl: vi.fn().mockResolvedValue(url),
    });
    await enterAuthentication(panel);
    await panel.click(panel.document.querySelector(".auth-step .button--wide"));

    await vi.waitFor(() => {
      expect(panel.document.querySelector('[data-testid="auth-waiting-url"]')?.textContent)
        .toContain("app.ludone.cz");
    });

    // Adresa je jediná cesta dál, když se prohlížeč sám neotevře — proto musí jít zkopírovat.
    const copy = panel.document.querySelector('[data-testid="auth-waiting-copy"]');
    expect(copy).not.toBeNull();
    await panel.click(copy);
    expect(panel.clipboardWrites).toContain(url);
  });

  // TDD_OPRAVA_AUTH_URL_20260903: testy spouštějí polling po dobu konkrétního pokusu.
  it("doplní adresu přihlášení, i když ji hlavní proces zveřejní později", async () => {
    const url = "https://app.ludone.cz/api/mcp/oauth/authorize?state=pozde&code_challenge=xyz";
    const lateUrl = deferred();
    const pendingAuthUrl = vi.fn()
      .mockResolvedValueOnce(null)
      .mockImplementation(() => lateUrl.promise);
    const panel = await renderOnboarding({
      beginAuth: vi.fn(() => new Promise(() => {})),
      pendingAuthUrl,
    });
    await enterAuthentication(panel);
    await panel.click(panel.document.querySelector(".auth-step .button--wide"));

    await vi.waitFor(() => expect(pendingAuthUrl).toHaveBeenCalledOnce());
    expect(panel.document.querySelector('[data-testid="auth-waiting-url"]')).toBeNull();
    await vi.waitFor(
      () => expect(pendingAuthUrl.mock.calls.length).toBeGreaterThanOrEqual(2),
      { timeout: 800 },
    );

    await React.act(async () => {
      lateUrl.resolve(url);
      await lateUrl.promise;
    });
    expect(panel.document.querySelector('[data-testid="auth-waiting-url"]')?.textContent)
      .toBe(url);
  });

  it("po skončení pokusu přestane neznámou adresu znovu zjišťovat", async () => {
    const authAttempt = deferred();
    const pendingAuthUrl = vi.fn().mockResolvedValue(null);
    const panel = await renderOnboarding({
      beginAuth: vi.fn(() => authAttempt.promise),
      pendingAuthUrl,
    });
    await enterAuthentication(panel);
    await panel.click(panel.document.querySelector(".auth-step .button--wide"));
    await vi.waitFor(
      () => expect(pendingAuthUrl.mock.calls.length).toBeGreaterThanOrEqual(2),
      { timeout: 800 },
    );

    await React.act(async () => {
      authAttempt.resolve({ ok: false, duvod: "odmitnuto" });
      await authAttempt.promise;
    });
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[data-testid="auth-error-screen"]')).not.toBeNull();
    });
    const callsAfterAttempt = pendingAuthUrl.mock.calls.length;

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(pendingAuthUrl).toHaveBeenCalledTimes(callsAfterAttempt);
  });

  it("po skončení zahodí zobrazenou adresu a nepřenese ji do dalšího pokusu", async () => {
    const firstAttempt = deferred();
    const secondAttempt = deferred();
    const url = "https://app.ludone.cz/api/mcp/oauth/authorize?state=stary-pokus";
    const beginAuth = vi.fn()
      .mockImplementationOnce(() => firstAttempt.promise)
      .mockImplementationOnce(() => secondAttempt.promise);
    const pendingAuthUrl = vi.fn()
      .mockResolvedValueOnce(url)
      .mockResolvedValue(null);
    const panel = await renderOnboarding({ beginAuth, pendingAuthUrl });
    await enterAuthentication(panel);
    await panel.click(panel.document.querySelector(".auth-step .button--wide"));
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[data-testid="auth-waiting-url"]')?.textContent)
        .toBe(url);
    });

    await React.act(async () => {
      firstAttempt.resolve({ ok: false, duvod: "odmitnuto" });
      await firstAttempt.promise;
    });
    await vi.waitFor(() => {
      expect(panel.document.querySelector('[data-testid="auth-error-screen"]')).not.toBeNull();
    });
    await panel.click(panel.document.querySelector('[data-testid="auth-error-action"]'));
    await vi.waitFor(() => expect(beginAuth).toHaveBeenCalledTimes(2));

    expect(panel.document.querySelector('[data-testid="auth-waiting-screen"]')).not.toBeNull();
    expect(panel.document.querySelector('[data-testid="auth-waiting-url"]')).toBeNull();
  });
});
