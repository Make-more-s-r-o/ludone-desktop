const CAPTURE_TIMEOUT_MS = 15_000;
const TRACK_UNMUTE_TIMEOUT_MS = 2_000;

export const LIVE_RMS_THRESHOLD = 0.01;
export const SILENT_RMS_THRESHOLD = 0.006;

function captureAbortedError() {
  return new DOMException("Zachytávání zvuku bylo ukončeno", "AbortError");
}

export function stopStreams(streams) {
  for (const stream of streams) {
    for (const track of stream.getTracks()) track.stop();
  }
}

function captureWithTimeout(capturePromise, label) {
  let timedOut = false;
  let timeoutId;
  const guardedCapture = capturePromise.then((stream) => {
    if (timedOut) {
      stopStreams([stream]);
      throw new DOMException(`${label} se vrátil až po timeoutu`, "TimeoutError");
    }
    return stream;
  });
  const timeout = new Promise((_resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      reject(new DOMException(
        `${label} nevrátil stream do ${CAPTURE_TIMEOUT_MS / 1_000} sekund`,
        "TimeoutError",
      ));
    }, CAPTURE_TIMEOUT_MS);
  });
  return Promise.race([guardedCapture, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function waitUntilUnmuted(track, label) {
  if (!track.muted) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      track.removeEventListener("unmute", handleUnmute);
      track.removeEventListener("ended", handleEnded);
    };
    const handleUnmute = () => {
      cleanup();
      resolve(undefined);
    };
    const handleEnded = () => {
      cleanup();
      reject(new Error(`${label} skončila ještě před začátkem nahrávání`));
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`${label} zůstává ztišená`));
    }, TRACK_UNMUTE_TIMEOUT_MS);
    track.addEventListener("unmute", handleUnmute, { once: true });
    track.addEventListener("ended", handleEnded, { once: true });
    if (!track.muted) handleUnmute();
    else if (track.readyState === "ended") handleEnded();
  });
}

async function checkedAudioTrack(stream, label) {
  const tracks = stream.getAudioTracks();
  if (tracks.length !== 1) {
    throw new Error(`${label} neposkytla právě jednu audio stopu (nalezeno ${tracks.length})`);
  }
  const [track] = tracks;
  if (track.kind !== "audio" || track.readyState !== "live" || !track.enabled) {
    throw new Error(`${label} neposkytla živou a povolenou audio stopu`);
  }
  await waitUntilUnmuted(track, label);
  if (track.readyState !== "live" || !track.enabled || track.muted) {
    throw new Error(`${label} není před startem použitelná`);
  }
  return track;
}

/**
 * Znovu získá jen systémovou stopu. Volá se z uživatelského gesta při obnově
 * výpadku; žádný nový IPC kanál k tomu není potřeba.
 *
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function captureSystemAudioSource({ signal } = {}) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Stránka nemá zabezpečený přístup k systémovému zvuku");
  }
  if (signal?.aborted) throw captureAbortedError();

  let stream = null;
  const stopOnAbort = () => {
    if (stream) stopStreams([stream]);
  };
  signal?.addEventListener("abort", stopOnAbort, { once: true });

  try {
    stream = await captureWithTimeout(
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }),
      "Systémový zvuk",
    );
    if (signal?.aborted) throw captureAbortedError();
    for (const videoTrack of stream.getVideoTracks()) videoTrack.stop();
    const systemTrack = await checkedAudioTrack(stream, "Systémový zvuk");
    if (signal?.aborted) throw captureAbortedError();
    return { systemStream: stream, systemTrack };
  } catch (error) {
    if (stream) stopStreams([stream]);
    throw error;
  } finally {
    signal?.removeEventListener("abort", stopOnAbort);
  }
}

/** @param {{ signal?: AbortSignal }} [options] */
export async function captureAudioSources({ signal } = {}) {
  if (
    !window.isSecureContext
    || !navigator.mediaDevices?.getUserMedia
  ) {
    throw new Error("Stránka nemá zabezpečený přístup k mikrofonu");
  }
  if (signal?.aborted) throw captureAbortedError();

  const acquiredStreams = [];
  const stopAcquiredStreams = () => stopStreams(acquiredStreams);
  signal?.addEventListener("abort", stopAcquiredStreams, { once: true });
  const rememberStream = (capturePromise) => capturePromise.then((stream) => {
    acquiredStreams.push(stream);
    if (signal?.aborted) {
      stopStreams([stream]);
      throw captureAbortedError();
    }
    return stream;
  });

  const microphonePromise = rememberStream(captureWithTimeout(navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  }), "Mikrofon"));
  const displayPromise = navigator.mediaDevices.getDisplayMedia
    ? rememberStream(captureWithTimeout(
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }),
      "Systémový zvuk",
    ).then((stream) => {
      for (const videoTrack of stream.getVideoTracks()) videoTrack.stop();
      return stream;
    }))
    : Promise.reject(new Error("Systémový zvuk není v tomto prostředí dostupný"));

  const [microphoneResult, displayResult] = await Promise.allSettled([
    microphonePromise,
    displayPromise,
  ]);
  if (signal?.aborted) {
    signal.removeEventListener("abort", stopAcquiredStreams);
    stopAcquiredStreams();
    throw captureAbortedError();
  }
  if (microphoneResult.status === "rejected") {
    signal?.removeEventListener("abort", stopAcquiredStreams);
    stopStreams(acquiredStreams);
    throw new Error(`mikrofon: ${microphoneResult.reason?.message || microphoneResult.reason}`);
  }

  try {
    const microphoneTrack = await checkedAudioTrack(microphoneResult.value, "Mikrofon");
    let systemAudioError = displayResult.status === "rejected"
      ? displayResult.reason
      : null;
    let systemStream = null;
    let systemTrack = null;
    if (displayResult.status === "fulfilled") {
      try {
        systemTrack = await checkedAudioTrack(displayResult.value, "Systémový zvuk");
        systemStream = displayResult.value;
      } catch (error) {
        systemAudioError = error;
        stopStreams([displayResult.value]);
        const rejectedStreamIndex = acquiredStreams.indexOf(displayResult.value);
        if (rejectedStreamIndex >= 0) acquiredStreams.splice(rejectedStreamIndex, 1);
      }
    }
    signal?.removeEventListener("abort", stopAcquiredStreams);
    if (signal?.aborted) {
      stopAcquiredStreams();
      throw captureAbortedError();
    }
    return {
      streams: acquiredStreams,
      microphoneStream: microphoneResult.value,
      microphoneTrack,
      systemAudioError,
      systemStream,
      systemTrack,
    };
  } catch (error) {
    signal?.removeEventListener("abort", stopAcquiredStreams);
    stopStreams(acquiredStreams);
    throw error;
  }
}

export function rmsToPercent(rms) {
  if (!Number.isFinite(rms) || rms <= 0.001) return 0;
  const decibels = 20 * Math.log10(rms);
  return Math.round(Math.min(100, Math.max(0, ((decibels + 60) / 60) * 100)));
}

function readRms(analyser, buffer) {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) sum += sample * sample;
  return Math.sqrt(sum / buffer.length);
}

function createLevelChannel(context, stream) {
  const tracks = stream.getAudioTracks();
  if (tracks.length !== 1) {
    throw new Error(`Zvukový měřák očekával jednu stopu, nalezeno ${tracks.length}`);
  }
  let source;
  let analyser;
  try {
    source = context.createMediaStreamSource(stream);
    analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.65;
    source.connect(analyser);
    return {
      analyser,
      buffer: new Float32Array(analyser.fftSize),
      source,
      track: tracks[0],
    };
  } catch (error) {
    disconnectLevelChannel({ analyser, source });
    throw error;
  }
}

function disconnectLevelChannel(channel) {
  if (!channel) return;
  try {
    channel.source?.disconnect();
  } catch {
    // Odpojený měřák nesmí ovlivnit nahrávací graf.
  }
  try {
    channel.analyser?.disconnect();
  } catch {
    // Odpojený měřák nesmí ovlivnit nahrávací graf.
  }
}

function readLevelChannel(channel, contextRunning) {
  if (!channel) {
    return {
      available: false,
      measured: false,
      percent: 0,
      rms: 0,
    };
  }
  const available = Boolean(
    channel.track.readyState === "live"
    && channel.track.enabled
    && !channel.track.muted,
  );
  if (!contextRunning) {
    return { available, measured: false, percent: 0, rms: 0 };
  }
  if (!available) {
    return {
      available: false,
      measured: true,
      percent: 0,
      rms: 0,
    };
  }
  try {
    const rms = readRms(channel.analyser, channel.buffer);
    return {
      available: true,
      measured: true,
      percent: rmsToPercent(rms),
      rms,
    };
  } catch {
    return {
      available: true,
      measured: false,
      percent: 0,
      rms: 0,
    };
  }
}

/**
 * Pasivní čtečka úrovně nad již existujícím Web Audio contextem. Její uzly
 * nejsou zapojené do destination, takže nemění žádnou ukládanou stopu.
 *
 * @param {AudioContext} context
 */
export function createAudioLevelMonitor(context) {
  const channels = {
    microphone: null,
    system: null,
  };
  let disposed = false;

  return {
    /**
     * Přepnutí je best-effort: selhání měřidla nesmí shodit nahrávání.
     *
     * @param {"microphone" | "system"} name
     * @param {MediaStream} stream
     */
    replaceSource(name, stream) {
      if (disposed) return false;
      let nextChannel;
      try {
        nextChannel = createLevelChannel(context, stream);
      } catch {
        return false;
      }
      const previousChannel = channels[name];
      channels[name] = nextChannel;
      disconnectLevelChannel(previousChannel);
      return true;
    },
    /** @param {"microphone" | "system"} name */
    clearSource(name) {
      const previousChannel = channels[name];
      channels[name] = null;
      disconnectLevelChannel(previousChannel);
    },
    readLevels() {
      return {
        microphone: readLevelChannel(channels.microphone, context.state === "running"),
        system: readLevelChannel(channels.system, context.state === "running"),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disconnectLevelChannel(channels.microphone);
      disconnectLevelChannel(channels.system);
      channels.microphone = null;
      channels.system = null;
    },
  };
}

/**
 * Založí jediný context a konstruktor, který jej předá existujícímu
 * nahrávacímu grafu přes jeho dependency-injection šev.
 */
export function createSharedAudioContext() {
  const browserGlobals = /** @type {typeof globalThis & {
    webkitAudioContext?: typeof AudioContext,
  }} */ (globalThis);
  const AudioContextConstructor = browserGlobals.AudioContext
    ?? browserGlobals.webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("Pro nahrávání a zvukový měřák není dostupné Web Audio");
  }
  const context = new AudioContextConstructor();
  function SharedAudioContext() {
    return context;
  }
  return {
    context,
    AudioContext: /** @type {typeof AudioContext} */ (
      /** @type {unknown} */ (SharedAudioContext)
    ),
  };
}

/** @param {{ signal?: AbortSignal }} [options] */
export async function createStereoLevelSession({ signal } = {}) {
  const capture = await captureAudioSources({ signal });
  if (!capture.systemStream || !capture.systemTrack) {
    stopStreams(capture.streams);
    throw capture.systemAudioError instanceof Error
      ? capture.systemAudioError
      : new Error("Systémový zvuk není pro zkoušku dostupný");
  }
  let context;
  let levelMonitor;
  const stopSetup = () => {
    levelMonitor?.dispose();
    stopStreams(capture.streams);
    if (context && context.state !== "closed") void context.close().catch(() => {});
  };
  signal?.addEventListener("abort", stopSetup, { once: true });
  try {
    if (signal?.aborted) throw captureAbortedError();
    context = new window.AudioContext();
    if (context.state === "suspended") {
      await context.resume();
    }
    if (signal?.aborted) throw captureAbortedError();
    if (context.state !== "running") {
      throw new Error("Zvukový context neběží; úroveň nelze změřit");
    }
    levelMonitor = createAudioLevelMonitor(context);
    if (
      !levelMonitor.replaceSource("microphone", capture.microphoneStream)
      || !levelMonitor.replaceSource("system", capture.systemStream)
    ) {
      throw new Error("Zvukové měřáky se nepodařilo připojit");
    }
    const activeTones = new Set();
    let closePromise = null;
    let session;

    function cleanupTone(tone) {
      if (!activeTones.delete(tone)) return;
      if (tone.oscillator) tone.oscillator.onended = null;
      try {
        tone.oscillator?.stop();
      } catch {
        // Po neúspěšném startu ještě nemusí být co zastavit.
      }
      for (const node of [tone.oscillator, tone.gain]) {
        try {
          node?.disconnect();
        } catch {
          // Selhání jednoho uzlu nesmí zabránit odpojení druhého.
        }
      }
    }

    const closeOnAbort = () => {
      if (session) void session.close().catch(() => {});
    };
    session = {
      labels: {
        microphone: capture.microphoneTrack.label.trim()
          ? capture.microphoneTrack.label
          : "Mikrofon — název neznámý",
        system: capture.systemTrack.label.trim()
          ? capture.systemTrack.label
          : "Ostatní zvuk — název neznámý",
      },
      readLevels() {
        return levelMonitor.readLevels();
      },
      async playTestSound() {
        if (closePromise) return;
        if (context.state === "suspended") await context.resume();
        // Zavření testu během resume je záměr; nesmí po něm vzniknout tón.
        if (closePromise) return;
        if (context.state !== "running") {
          throw new Error("Zvukový context neběží; tón nelze přehrát");
        }
        const tone = { gain: null, oscillator: null };
        activeTones.add(tone);
        try {
          const oscillator = context.createOscillator();
          tone.oscillator = oscillator;
          const gain = context.createGain();
          tone.gain = gain;
          oscillator.frequency.setValueAtTime(440, context.currentTime);
          gain.gain.setValueAtTime(0.12, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.onended = () => cleanupTone(tone);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.65);
        } catch (error) {
          cleanupTone(tone);
          throw error;
        }
      },
      close() {
        if (closePromise) return closePromise;
        closePromise = (async () => {
          signal?.removeEventListener("abort", closeOnAbort);
          for (const tone of [...activeTones]) cleanupTone(tone);
          levelMonitor.dispose();
          stopStreams(capture.streams);
          if (context.state !== "closed") await context.close();
        })();
        return closePromise;
      },
    };
    signal?.removeEventListener("abort", stopSetup);
    signal?.addEventListener("abort", closeOnAbort, { once: true });
    if (signal?.aborted) {
      await session.close();
      throw captureAbortedError();
    }
    return session;
  } catch (error) {
    signal?.removeEventListener("abort", stopSetup);
    levelMonitor?.dispose();
    stopStreams(capture.streams);
    if (context && context.state !== "closed") await context.close().catch(() => {});
    throw error;
  }
}
