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

/** @param {{ signal?: AbortSignal }} [options] */
export async function captureAudioSources({ signal } = {}) {
  if (
    !window.isSecureContext
    || !navigator.mediaDevices?.getUserMedia
    || !navigator.mediaDevices?.getDisplayMedia
  ) {
    throw new Error("Stránka nemá zabezpečený přístup k audio zařízením");
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
  const displayPromise = rememberStream(captureWithTimeout(
    navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }),
    "Systémový zvuk",
  ).then((stream) => {
    for (const videoTrack of stream.getVideoTracks()) videoTrack.stop();
    return stream;
  }));

  const [microphoneResult, displayResult] = await Promise.allSettled([
    microphonePromise,
    displayPromise,
  ]);
  if (signal?.aborted) {
    signal.removeEventListener("abort", stopAcquiredStreams);
    stopAcquiredStreams();
    throw captureAbortedError();
  }
  if (microphoneResult.status === "rejected" || displayResult.status === "rejected") {
    signal?.removeEventListener("abort", stopAcquiredStreams);
    stopStreams(acquiredStreams);
    const failures = [];
    if (microphoneResult.status === "rejected") {
      failures.push(`mikrofon: ${microphoneResult.reason?.message || microphoneResult.reason}`);
    }
    if (displayResult.status === "rejected") {
      failures.push(`systémový zvuk: ${displayResult.reason?.message || displayResult.reason}`);
    }
    throw new Error(failures.join("; "));
  }

  try {
    const [microphoneTrack, systemTrack] = await Promise.all([
      checkedAudioTrack(microphoneResult.value, "Mikrofon"),
      checkedAudioTrack(displayResult.value, "Systémový zvuk"),
    ]);
    signal?.removeEventListener("abort", stopAcquiredStreams);
    if (signal?.aborted) {
      stopAcquiredStreams();
      throw captureAbortedError();
    }
    return {
      streams: acquiredStreams,
      microphoneStream: microphoneResult.value,
      microphoneTrack,
      systemStream: displayResult.value,
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
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.65;
  source.connect(analyser);
  return {
    analyser,
    buffer: new Float32Array(analyser.fftSize),
    source,
  };
}

/** @param {{ signal?: AbortSignal }} [options] */
export async function createStereoLevelSession({ signal } = {}) {
  const capture = await captureAudioSources({ signal });
  let context;
  const stopSetup = () => {
    stopStreams(capture.streams);
    if (context && context.state !== "closed") void context.close().catch(() => {});
  };
  signal?.addEventListener("abort", stopSetup, { once: true });
  try {
    if (signal?.aborted) throw captureAbortedError();
    context = new window.AudioContext();
    if (context.state === "suspended") {
      await context.resume().catch(() => {});
    }
    if (signal?.aborted) throw captureAbortedError();
    const microphone = createLevelChannel(context, capture.microphoneStream);
    const system = createLevelChannel(context, capture.systemStream);
    const activeTones = new Set();
    let closePromise = null;
    let session;

    function cleanupTone(tone) {
      if (!activeTones.delete(tone)) return;
      tone.oscillator.disconnect();
      tone.gain.disconnect();
    }

    const closeOnAbort = () => {
      if (session) void session.close().catch(() => {});
    };
    session = {
      labels: {
        microphone: capture.microphoneTrack.label || "MacBook Pro — mikrofon",
        system: capture.systemTrack.label || "Ostatní zvuk",
      },
      readLevels() {
        const microphoneAvailable = capture.microphoneTrack.readyState === "live"
          && capture.microphoneTrack.enabled
          && !capture.microphoneTrack.muted;
        const systemAvailable = capture.systemTrack.readyState === "live"
          && capture.systemTrack.enabled
          && !capture.systemTrack.muted;
        const microphoneRms = microphoneAvailable
          ? readRms(microphone.analyser, microphone.buffer)
          : 0;
        const systemRms = systemAvailable ? readRms(system.analyser, system.buffer) : 0;
        return {
          microphone: {
            available: microphoneAvailable,
            percent: rmsToPercent(microphoneRms),
            rms: microphoneRms,
          },
          system: {
            available: systemAvailable,
            percent: rmsToPercent(systemRms),
            rms: systemRms,
          },
        };
      },
      async playTestSound() {
        if (closePromise) return;
        if (context.state === "suspended") await context.resume();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const tone = { gain, oscillator };
        activeTones.add(tone);
        oscillator.frequency.setValueAtTime(440, context.currentTime);
        gain.gain.setValueAtTime(0.12, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => cleanupTone(tone);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.65);
      },
      close() {
        if (closePromise) return closePromise;
        closePromise = (async () => {
          signal?.removeEventListener("abort", closeOnAbort);
          for (const tone of [...activeTones]) cleanupTone(tone);
          microphone.source.disconnect();
          microphone.analyser.disconnect();
          system.source.disconnect();
          system.analyser.disconnect();
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
    stopStreams(capture.streams);
    if (context && context.state !== "closed") await context.close().catch(() => {});
    throw error;
  }
}
