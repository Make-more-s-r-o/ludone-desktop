import { useEffect, useRef, useState } from "react";
import { MicIcon } from "../../components/Icons.jsx";
import { formatElapsed, useElapsedTime } from "../../hooks/useElapsedTime.js";
import {
  createAudioLevelMonitor,
  createSharedAudioContext,
  captureAudioSources,
  captureSystemAudioSource,
  stopStreams,
} from "../../lib/audio-levels.js";
import { countLabel } from "../../lib/count-label.js";
import { createStereoCapture } from "../../lib/stereo-recording.js";
import {
  AudioLevelMeter,
  updateAudioLevelMeter,
} from "./AudioLevelMeter.jsx";
import { createMicrophoneOnlyExportCapture } from "./microphone-only-capture.js";
import {
  MICROPHONE_ONLY_TEXT,
  MICROPHONE_REQUIRED_TEXT,
} from "./recording-copy.js";
import { watchSystemAudioTrack } from "./system-audio-health.js";

const RECORDER_EVENT_TIMEOUT_MS = 5_000;
const RECORDING_TIMESLICE_MS = 1_000;
// Shodné se serverem: String.length po trim(), tedy UTF-16 jednotky.
// Mění se současně na serveru i v electron/recording-export.cjs.
const MAX_UPLOAD_NAME_UTF16_UNITS = 500;
const QUIT_EXPORT_FAILURE_CONSEQUENCE = "LuDone zůstává otevřené. Pokud ho teď ukončíte, dvoukanálový soubor už z aplikace nevyexportujete.";

function describeError(error) {
  if (!error) return "neznámá chyba";
  return error.message || String(error);
}

function recorderOptions() {
  for (const mimeType of ["audio/webm;codecs=opus", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return { mimeType, audioBitsPerSecond: 128_000 };
    }
  }
  return undefined;
}

function recorderEventTimestamp(event) {
  const monotonicTimestamp = window.performance?.timeOrigin + event.timeStamp;
  const timestamp = Number.isFinite(monotonicTimestamp) ? monotonicTimestamp : Date.now();
  return new Date(timestamp).toISOString();
}

function createPersistentRecorder(recorder, sessionId, source, onFailure) {
  let nextSequence = 0;
  let writeQueue = Promise.resolve();
  let failure = null;
  let startCallSucceeded = false;
  let startSettled = false;
  let stoppedSettled = false;
  let startTimeoutId;
  let startedAt = null;
  let endedAt = null;
  let resolveStarted;
  let rejectStarted;
  let resolveStopped;
  const started = new Promise((resolve, reject) => {
    resolveStarted = resolve;
    rejectStarted = reject;
  });
  const stopped = new Promise((resolve) => {
    resolveStopped = resolve;
  });

  function reportFailure(error) {
    failure ??= error instanceof Error ? error : new Error(describeError(error));
    if (!startSettled) {
      startSettled = true;
      rejectStarted(failure);
    }
    onFailure(failure);
  }

  recorder.addEventListener("start", (event) => {
    window.clearTimeout(startTimeoutId);
    startSettled = true;
    startedAt = recorderEventTimestamp(event);
    resolveStarted(startedAt);
  }, { once: true });
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size === 0) return;
    const sequence = nextSequence;
    nextSequence += 1;
    writeQueue = writeQueue.then(async () => {
      const arrayBuffer = await event.data.arrayBuffer();
      await window.ludone.appendRecordingChunk(sessionId, source, sequence, arrayBuffer);
    }).catch(reportFailure);
  });
  recorder.addEventListener("error", (event) => {
    reportFailure(event.error || new Error(`${source}: MediaRecorder selhal`));
  });
  recorder.addEventListener("stop", (event) => {
    stoppedSettled = true;
    endedAt = recorderEventTimestamp(event);
    resolveStopped(endedAt);
  }, { once: true });

  return {
    source,
    recorder,
    start() {
      startTimeoutId = window.setTimeout(() => {
        reportFailure(new Error(`${source}: MediaRecorder nepotvrdil start`));
      }, RECORDER_EVENT_TIMEOUT_MS);
      try {
        recorder.start(RECORDING_TIMESLICE_MS);
        startCallSucceeded = true;
      } catch (error) {
        window.clearTimeout(startTimeoutId);
        throw error;
      }
      return started;
    },
    async stopAndFlush() {
      window.clearTimeout(startTimeoutId);
      if (recorder.state !== "inactive") recorder.stop();
      let stopError = null;
      if (startCallSucceeded && !stoppedSettled) {
        try {
          await Promise.race([
            stopped,
            new Promise((_resolve, reject) => window.setTimeout(
              () => reject(new Error(`${source}: MediaRecorder nepotvrdil zastavení`)),
              RECORDER_EVENT_TIMEOUT_MS,
            )),
          ]);
        } catch (error) {
          stopError = error;
        }
      }
      await writeQueue;
      if (failure) throw failure;
      if (stopError) throw stopError;
      if (!startedAt || !endedAt) {
        throw new Error(`${source}: chybí časová kotva startu nebo konce`);
      }
      return { startedAt, endedAt };
    },
  };
}

function savedMessage(result) {
  const { microphone, system } = result.files;
  if (!system) {
    return `Původní stopa zůstává místně: ${microphone.name} (${microphone.size} B).`;
  }
  return `Původní stopy zůstávají místně: ${microphone.name} (${microphone.size} B) a ${system.name} (${system.size} B).`;
}

function recordingDate(value, options) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("cs-CZ", options).format(date);
}

function suggestedRecordingName(startedAt) {
  const date = recordingDate(startedAt, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = recordingDate(startedAt, { hour: "2-digit", minute: "2-digit" });
  return date && time ? `${date}, ${time}` : "";
}

function durationLabel(startedAt, endedAt) {
  const durationMs = Date.parse(endedAt) - Date.parse(startedAt);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return countLabel(0, "sekunda", "sekundy", "sekund");
  }
  // Zaokrouhluje se PŘED rozhodnutím o jednotce: 59,6 s je po zaokrouhlení celá minuta,
  // a „60 sekund“ je tvar, který nikdo neřekne.
  const seconds = Math.round(durationMs / 1_000);
  if (seconds < 60) return countLabel(seconds, "sekunda", "sekundy", "sekund");
  const minutes = Math.round(durationMs / 60_000);
  return countLabel(minutes, "minuta", "minuty", "minut");
}

function formatRecordingElapsed(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const minutePart = String(minutes).padStart(2, "0");
  const secondPart = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${minutePart}:${secondPart}` : `${minutePart}:${secondPart}`;
}

function sizeLabel(files) {
  const bytes = Object.values(files ?? {}).reduce((total, file) => (
    total + (Number.isFinite(file?.size) ? file.size : 0)
  ), 0);
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${Math.round(bytes / 1_024)} kB`;
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(
    bytes / (1_024 * 1_024),
  )} MB`;
}

function savedRecordingMetadata(recording) {
  const date = recordingDate(recording.startedAt, { day: "numeric", month: "long" });
  const startedAt = recordingDate(recording.startedAt, { hour: "2-digit", minute: "2-digit" });
  const endedAt = recordingDate(recording.endedAt, { hour: "2-digit", minute: "2-digit" });
  return {
    interval: `${date}, ${startedAt}–${endedAt}`,
    summary: `${durationLabel(recording.startedAt, recording.endedAt)} · ${sizeLabel(recording.files)}`,
  };
}

export function RecordingCard({
  compact = false,
  onActivityChange,
  todaySummary = null,
  trayCommand = null,
}) {
  const [session, setSession] = useState({
    phase: "idle",
    recordingMode: null,
    startedAt: null,
    labels: null,
    systemAudioState: "inactive",
  });
  const [notice, setNotice] = useState(null);
  const [savedRecording, setSavedRecording] = useState(null);
  const [recordingName, setRecordingName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [quitExportFailure, setQuitExportFailure] = useState(null);
  const [recoveringSystemAudio, setRecoveringSystemAudio] = useState(false);
  const startInFlight = useRef(false);
  const stopRequestedDuringStart = useRef(false);
  const lastTrayCommandId = useRef(null);
  const microphoneMeterRef = useRef(null);
  const runtimeRef = useRef(null);
  const systemMeterRef = useRef(null);
  const isRecording = session.phase === "recording";
  const microphoneOnly = session.recordingMode === "microphone-only";
  const systemAudioLost = isRecording && session.systemAudioState === "lost";
  const systemSourceState = microphoneOnly ? "unavailable" : (systemAudioLost ? "lost" : "live");
  const elapsed = useElapsedTime(isRecording, session.startedAt);

  async function finishRuntime(runtime, initialError = null) {
    if (runtime.finishPromise) return runtime.finishPromise;
    runtime.closing = true;
    runtime.recoveryController?.abort();
    runtime.recoveryController = null;
    runtime.cleanupTrackListeners?.();
    runtime.cleanupTrackListeners = null;
    runtime.levelMonitor?.dispose();
    runtime.levelMonitor = null;
    setRecoveringSystemAudio(false);
    runtime.finishPromise = (async () => {
      // Oddělené recordery dostanou stop jako první; exportní derivát je obalí
      // na obou hranách. Jeho flush ale běží odděleně, takže uložení originálů
      // na export nikdy nečeká.
      const recorderResults = runtime.recorders.map((persistentRecorder) => (
        persistentRecorder.stopAndFlush()
      ));
      runtime.exportFinishPromise = runtime.exportRecorder.stopAndFlush()
        .then(async (timing) => {
          // Graf už po flushi nevyrábí žádná další data. Zavřeme ho před IPC,
          // aby visící hlavní proces nedržel AudioContext a jeho stopy při životě.
          await runtime.exportCapture.close().catch(() => {});
          return window.ludone.finishRecordingExport(runtime.sessionId, {
            succeeded: true,
            timing,
          });
        })
        .catch(async (error) => {
          await runtime.exportCapture.close().catch(() => {});
          return window.ludone.finishRecordingExport(runtime.sessionId, {
            succeeded: false,
            reason: describeError(error),
          }).catch(() => undefined);
        })
        .then((result) => {
          if (!result?.ok && result?.quitConfirmationRequired === true) {
            setQuitExportFailure({
              clientRecordingId: runtime.sessionId,
              message: result.message || "Dvoukanálový export se nepodařilo připravit.",
            });
          }
          return result;
        })
        .finally(() => runtime.exportCapture.close().catch(() => {}));

      setSession((current) => ({ ...current, phase: "stopping" }));
      const errors = initialError ? [initialError] : [];
      const settledRecorders = await Promise.allSettled(recorderResults);
      for (const result of settledRecorders) {
        if (result.status === "rejected") errors.push(result.reason);
      }

      let saved;
      try {
        const allRecordersFinished = settledRecorders.every(({ status }) => status === "fulfilled");
        const trackTimings = allRecordersFinished
          ? Object.fromEntries(settledRecorders.map((result, index) => [
            runtime.recorders[index].source,
            result.value,
          ]))
          : undefined;
        saved = await window.ludone.finishRecording(runtime.sessionId, trackTimings);
      } catch (error) {
        errors.push(error);
      } finally {
        stopStreams(runtime.streams);
        if (runtimeRef.current === runtime) runtimeRef.current = null;
        setSession({
          phase: "idle",
          recordingMode: null,
          startedAt: null,
          labels: null,
          systemAudioState: "inactive",
        });
      }

      if (errors.length > 0) {
        const savedSuffix = saved ? ` Dosud zapsané soubory zůstaly zachované: ${savedMessage(saved)}` : "";
        setNotice({
          type: "error",
          text: `Nahrávání bylo zastaveno kvůli chybě: ${describeError(errors[0])}.${savedSuffix}`,
        });
        if (saved) {
          setRecordingName(suggestedRecordingName(saved.startedAt));
          setSavedRecording(saved);
        }
      } else {
        setNotice(null);
        if (saved) {
          setRecordingName(suggestedRecordingName(saved.startedAt));
          setSavedRecording(saved);
        }
      }
      return saved;
    })();
    return runtime.finishPromise;
  }

  async function exportSavedRecording(name, openUploadPage) {
    if (!savedRecording || exporting) return;
    if (name.trim().length > MAX_UPLOAD_NAME_UTF16_UNITS) {
      setExportError("Název je příliš dlouhý. Zkraťte ho.");
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const result = await window.ludone.exportRecording(
        savedRecording.clientRecordingId,
        { recordingName: name, openUploadPage },
      );
      if (!result?.ok) throw new Error(result?.message || "Export se nepodařil");
      setSavedRecording(null);
      setRecordingName("");
      setQuitExportFailure(null);
      setNotice({
        type: "success",
        text: `Soubor ${result.fileName} je uložený ve Stažených.`,
      });
    } catch (error) {
      setExportError(describeError(error));
    } finally {
      setExporting(false);
    }
  }

  async function confirmQuitAfterExportFailure() {
    if (!quitExportFailure || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const result = await window.ludone.confirmRecordingExportFailure(
        quitExportFailure.clientRecordingId,
      );
      if (!result?.confirmed) {
        throw new Error("Ukončení zatím nelze potvrdit. Původní stopy se ještě ukládají.");
      }
    } catch (error) {
      setExportError(describeError(error));
    } finally {
      setExporting(false);
    }
  }

  function reportRuntimeFailure(error) {
    const runtime = runtimeRef.current;
    if (runtime && !runtime.closing) void finishRuntime(runtime, error);
  }

  function setRuntimeSystemAudioState(runtime, nextState) {
    runtime.systemAudioLost = nextState === "lost";
    if (runtimeRef.current !== runtime || runtime.closing) return;
    setSession((current) => (
      current.phase === "recording"
        ? { ...current, systemAudioState: nextState }
        : current
    ));
  }

  function watchRuntimeSystemTrack(runtime, track) {
    runtime.unwatchSystemTrack?.();
    runtime.unwatchSystemTrack = watchSystemAudioTrack(track, {
      onLost: () => setRuntimeSystemAudioState(runtime, "lost"),
      onRecovered: () => setRuntimeSystemAudioState(runtime, "live"),
    });
  }

  function isTrackAvailable(track) {
    return track?.readyState === "live" && track.enabled && !track.muted;
  }

  async function recoverSystemAudio() {
    const runtime = runtimeRef.current;
    if (!runtime || runtime.closing || runtime.recoveryController) return;

    const controller = new window.AbortController();
    runtime.recoveryController = controller;
    setRecoveringSystemAudio(true);
    let replacement = null;
    let adopted = false;

    try {
      replacement = await captureSystemAudioSource({ signal: controller.signal });
      if (runtimeRef.current !== runtime || runtime.closing) {
        stopStreams([replacement.systemStream]);
        return;
      }

      await runtime.stereoCapture.replaceSystemTrack(replacement.systemTrack);
      if (runtimeRef.current !== runtime || runtime.closing) {
        stopStreams([replacement.systemStream]);
        return;
      }

      const previousSystemStream = runtime.systemStream;
      runtime.unwatchSystemTrack?.();
      runtime.systemStream = replacement.systemStream;
      runtime.systemTrack = replacement.systemTrack;
      runtime.streams = runtime.streams
        .filter((stream) => stream !== previousSystemStream)
        .concat(replacement.systemStream);
      runtime.systemAudioLost = false;
      setRuntimeSystemAudioState(runtime, "live");
      watchRuntimeSystemTrack(runtime, replacement.systemTrack);
      adopted = true;
      stopStreams([previousSystemStream]);
    } catch (error) {
      if (replacement && !adopted) stopStreams([replacement.systemStream]);
      if (error?.name !== "AbortError") {
        // Původní stopa se mohla během otevřeného dialogu sama odmutovat.
        // Neúspěch náhradního výběru ji proto nesmí přepsat zpět na „ztracená“.
        setRuntimeSystemAudioState(
          runtime,
          isTrackAvailable(runtime.systemTrack) ? "live" : "lost",
        );
      }
    } finally {
      if (runtime.recoveryController === controller) runtime.recoveryController = null;
      if (runtimeRef.current === runtime && !runtime.closing) setRecoveringSystemAudio(false);
    }
  }

  async function start() {
    if (startInFlight.current || runtimeRef.current || session.phase !== "idle") return;
    startInFlight.current = true;
    stopRequestedDuringStart.current = false;
    setNotice(null);
    setSavedRecording(null);
    setRecordingName("");
    setExportError(null);
    setQuitExportFailure(null);
    setSession({
      phase: "checking",
      recordingMode: null,
      startedAt: null,
      labels: null,
      systemAudioState: "inactive",
    });
    let capture;
    let runtime;
    let stereoCapture;
    let exportCapture;
    let levelMonitor;
    let sharedAudioContext;

    try {
      capture = await captureAudioSources();
      const options = recorderOptions();
      const hasSystemAudio = Boolean(capture.systemStream && capture.systemTrack);
      const recordingMode = hasSystemAudio ? "two-track" : "microphone-only";
      sharedAudioContext = createSharedAudioContext();
      const audioDependencies = { AudioContext: sharedAudioContext.AudioContext };
      stereoCapture = hasSystemAudio
        ? await createStereoCapture(
          capture.microphoneTrack,
          capture.systemTrack,
          audioDependencies,
        )
        : null;
      exportCapture = stereoCapture
        ?? await createMicrophoneOnlyExportCapture(capture.microphoneTrack, audioDependencies);
      const microphoneRecordingStream = new MediaStream([capture.microphoneTrack]);
      const microphoneRecorder = new MediaRecorder(microphoneRecordingStream, options);
      const systemRecorder = hasSystemAudio
        ? new MediaRecorder(stereoCapture.systemStream, options)
        : null;
      levelMonitor = createAudioLevelMonitor(sharedAudioContext.context);
      levelMonitor.replaceSource("microphone", microphoneRecordingStream);
      if (systemRecorder) levelMonitor.replaceSource("system", stereoCapture.systemStream);
      const exportRecorder = new MediaRecorder(exportCapture.stream, options);
      const sources = hasSystemAudio ? ["microphone", "system"] : ["microphone"];
      const persistence = await window.ludone.beginRecording(sources);
      runtime = {
        sessionId: persistence.sessionId,
        recordingMode,
        streams: capture.streams,
        recorders: [],
        exportRecorder: null,
        exportFinishPromise: null,
        exportStartedAt: null,
        exportError: null,
        exportCapture,
        stereoCapture,
        levelMonitor,
        systemAudioLost: false,
        systemStream: capture.systemStream,
        systemTrack: capture.systemTrack,
        unwatchSystemTrack: null,
        recoveryController: null,
        cleanupTrackListeners: null,
        closing: false,
        finishPromise: null,
        readyForStop: false,
      };
      runtimeRef.current = runtime;
      runtime.recorders = [
        createPersistentRecorder(microphoneRecorder, runtime.sessionId, "microphone", reportRuntimeFailure),
        ...(systemRecorder
          ? [createPersistentRecorder(
            systemRecorder,
            runtime.sessionId,
            "system",
            reportRuntimeFailure,
          )]
          : []),
      ];
      runtime.exportRecorder = createPersistentRecorder(
        exportRecorder,
        runtime.sessionId,
        "stereo",
        (error) => {
          runtime.exportError ??= error;
        },
      );
      const requiredTracks = [[capture.microphoneTrack, "Mikrofonní stopa"]];
      if (capture.systemTrack) {
        requiredTracks.push([capture.systemTrack, "Systémová stopa"]);
      }
      for (const [track, label] of requiredTracks) {
        if (track.readyState !== "live" || !track.enabled || track.muted) {
          throw new Error(`${label} přestala být dostupná během přípravy`);
        }
      }

      const reportMicrophoneUnavailable = () => {
        if (!runtime.closing) {
          reportRuntimeFailure(new Error("Mikrofonní stopa neočekávaně přestala dodávat zvuk"));
        }
      };
      capture.microphoneTrack.addEventListener("ended", reportMicrophoneUnavailable, { once: true });
      capture.microphoneTrack.addEventListener("mute", reportMicrophoneUnavailable, { once: true });
      if (capture.systemTrack) watchRuntimeSystemTrack(runtime, capture.systemTrack);
      runtime.cleanupTrackListeners = () => {
        capture.microphoneTrack.removeEventListener("ended", reportMicrophoneUnavailable);
        capture.microphoneTrack.removeEventListener("mute", reportMicrophoneUnavailable);
        runtime.unwatchSystemTrack?.();
        runtime.unwatchSystemTrack = null;
      };
      if (
        capture.microphoneTrack.readyState !== "live"
        || !capture.microphoneTrack.enabled
        || capture.microphoneTrack.muted
      ) {
        throw new Error("Mikrofonní stopa přestala být dostupná těsně před startem");
      }
      // Stereo derivát startuje první a končí poslední. Obě oddělené stopy tak
      // leží uvnitř jedné společné exportní časové osy bez dopočítaného ticha.
      try {
        runtime.exportStartedAt = await runtime.exportRecorder.start();
      } catch (error) {
        runtime.exportError = error;
      }
      await Promise.all(runtime.recorders.map((persistentRecorder) => persistentRecorder.start()));
      runtime.readyForStop = true;
      if (runtime.closing) {
        await runtime.finishPromise;
        return;
      }
      // TDD_OPRAVA_QUIT_START_LATCH_20260903: hlavní proces může poslat stop už
      // během await beginRecording(). Pro čistou finalizaci jej provedeme hned,
      // jak mají všechny recordery platné startovní časové kotvy.
      if (stopRequestedDuringStart.current) {
        stopRequestedDuringStart.current = false;
        await finishRuntime(runtime);
        return;
      }
      setSession({
        phase: "recording",
        recordingMode,
        startedAt: Date.now(),
        labels: {
          microphone: capture.microphoneTrack.label || "Mikrofon",
          system: capture.systemTrack?.label || null,
        },
        systemAudioState: hasSystemAudio
          ? (runtime.systemAudioLost ? "lost" : "live")
          : "unavailable",
      });
    } catch (error) {
      if (runtime) {
        await finishRuntime(runtime, error);
      } else {
        if (capture) stopStreams(capture.streams);
        levelMonitor?.dispose();
        if (exportCapture) await exportCapture.close().catch(() => {});
        else if (sharedAudioContext && sharedAudioContext.context.state !== "closed") {
          await sharedAudioContext.context.close().catch(() => {});
        }
        setSession({
          phase: "idle",
          recordingMode: null,
          startedAt: null,
          labels: null,
          systemAudioState: "inactive",
        });
        setNotice({
          type: "error",
          text: `Nahrávání se nespustilo. ${MICROPHONE_REQUIRED_TEXT} ${describeError(error)}.`,
        });
      }
    } finally {
      stopRequestedDuringStart.current = false;
      startInFlight.current = false;
    }
  }

  function stop() {
    const runtime = runtimeRef.current;
    if (startInFlight.current && (!runtime || !runtime.readyForStop)) {
      stopRequestedDuringStart.current = true;
      return;
    }
    if (runtime && !runtime.closing) void finishRuntime(runtime);
  }

  useEffect(() => () => {
    const runtime = runtimeRef.current;
    runtime?.recoveryController?.abort();
    runtime?.cleanupTrackListeners?.();
    runtime?.levelMonitor?.dispose();
  }, []);

  useEffect(() => {
    if (!isRecording) return undefined;
    let disposed = false;
    let animationFrame = null;

    const presentLevel = (fill, label, level, sourceState = "live") => {
      const sourceIsLive = sourceState === "live";
      const measurementState = level.measured === false
        ? "unavailable"
        : "measured";
      const measuredPercent = sourceIsLive ? level.percent : 0;
      updateAudioLevelMeter(fill, measuredPercent, measurementState);
      const row = fill?.closest(".recording-source");
      if (!row) return;
      const percent = String(measuredPercent);
      if (row.dataset.level !== percent) row.dataset.level = percent;
      if (row.dataset.levelMonitorState !== measurementState) {
        row.dataset.levelMonitorState = measurementState;
      }
      const accessibleLevel = {
        lost: `${label}: stopa ztracena`,
        unavailable: `${label}: stopa nedostupná`,
      }[sourceState] ?? (measurementState === "unavailable"
        ? `${label}: měřidlo nedostupné`
        : `${label}: ${percent} %`);
      if (row.getAttribute("aria-label") !== accessibleLevel) {
        row.setAttribute("aria-label", accessibleLevel);
      }
    };

    const sample = () => {
      if (disposed) return;
      const runtime = runtimeRef.current;
      if (!runtime || runtime.closing) return;
      try {
        const levels = runtime.levelMonitor?.readLevels() ?? {
          microphone: { measured: false, percent: 0 },
          system: { measured: false, percent: 0 },
        };
        presentLevel(microphoneMeterRef.current, "Mikrofon", levels.microphone);
        presentLevel(
          systemMeterRef.current,
          "Ostatní zvuk",
          levels.system,
          session.systemAudioState,
        );
      } catch {
        presentLevel(
          microphoneMeterRef.current,
          "Mikrofon",
          { measured: false, percent: 0 },
        );
        presentLevel(
          systemMeterRef.current,
          "Ostatní zvuk",
          { measured: false, percent: 0 },
          session.systemAudioState,
        );
      } finally {
        if (!disposed) animationFrame = window.requestAnimationFrame(sample);
      }
    };

    animationFrame = window.requestAnimationFrame(sample);
    return () => {
      disposed = true;
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [isRecording, session.systemAudioState]);

  useEffect(() => {
    if (!trayCommand || trayCommand.id === lastTrayCommandId.current) return;
    lastTrayCommandId.current = trayCommand.id;
    if (trayCommand.name === "stop-recording") stop();
  }, [trayCommand]);

  useEffect(() => {
    onActivityChange({
      // Příprava i ukládání jsou aktivní fáze. `idle` se nahlásí až poté, co
      // finishRecording doběhne a hlavní proces stihne položku zařadit do fronty.
      active: session.phase !== "idle",
      systemAudioState: session.systemAudioState,
    });
  }, [onActivityChange, session.phase, session.systemAudioState]);

  const statusLabel = {
    idle: "Připraveno",
    checking: "Kontrola",
    stopping: "Ukládám",
  }[session.phase];
  const savedMetadata = savedRecording ? savedRecordingMetadata(savedRecording) : null;

  return (
    <section
      className={`feature-card recording-card${isRecording ? " is-active" : ""}${systemAudioLost || microphoneOnly ? " is-degraded" : ""}${session.phase === "idle" && !savedRecording ? " idle-feature-row" : ""}${session.phase === "idle" && !savedRecording && notice ? " has-notice" : ""}${savedRecording ? " recording-card--saved" : ""}`}
      data-recording-phase={savedRecording ? "saved" : session.phase}
      data-recording-mode={session.recordingMode ?? "inactive"}
      data-system-audio-state={isRecording
        ? (recoveringSystemAudio ? "recovering" : session.systemAudioState)
        : "inactive"}
      data-layout={compact && isRecording ? "compact" : "default"}
      data-microphone-label={session.labels?.microphone ?? ""}
      data-system-label={session.labels?.system ?? ""}
      data-testid={session.phase === "idle" && !savedRecording ? "idle-action-row" : undefined}
      aria-label="Nahrávání"
    >
      {savedRecording ? (
        <form
          className="recording-saved"
          aria-busy={exporting}
          onSubmit={(event) => {
            event.preventDefault();
            void exportSavedRecording(recordingName, true);
          }}
        >
          <div role="status" aria-live="polite">
            <h2>Nahrávka uložena</h2>
          </div>
          <div className="recording-saved__meta">
            <small>{savedMetadata.interval}</small>
            <small>{savedMetadata.summary}</small>
          </div>
          <label className="sr-only" htmlFor="recording-name">Název nahrávky</label>
          <input
            id="recording-name"
            className="recording-saved__name"
            data-testid="recording-name-input"
            name="recordingName"
            type="text"
            value={recordingName}
            autoFocus
            aria-describedby="recording-name-hint"
            aria-errormessage={quitExportFailure || exportError || notice?.type === "error"
              ? "recording-name-error"
              : undefined}
            aria-invalid={Boolean(quitExportFailure || exportError || notice?.type === "error")}
            onInput={(event) => {
              setRecordingName(event.currentTarget.value);
              setExportError(null);
            }}
          />
          <small id="recording-name-hint" className="recording-saved__hint">
            Můžeš přepsat teď nebo později v LuDone.
          </small>
          {quitExportFailure ? (
            <p
              id="recording-name-error"
              className="recording-saved__error recording-saved__error--quit"
              data-testid="quit-export-failure"
              role="alert"
            >
              {quitExportFailure.message} {QUIT_EXPORT_FAILURE_CONSEQUENCE}
              {exportError ? <><br />{exportError}</> : null}
            </p>
          ) : (exportError || notice?.type === "error") && (
            <p id="recording-name-error" className="recording-saved__error" role="alert">
              {exportError || notice.text}
            </p>
          )}
          {quitExportFailure ? (
            <button
              type="button"
              className="button button--wide recording-saved__quit"
              data-testid="confirm-quit-after-export-failure"
              disabled={exporting}
              onClick={() => void confirmQuitAfterExportFailure()}
            >
              Ukončit LuDone
            </button>
          ) : (
            <>
              <button
                type="submit"
                className="button button--primary button--wide"
                disabled={exporting}
              >
                Uložit a odeslat
              </button>
              <button
                type="button"
                className="recording-saved__skip"
                data-testid="skip-recording-name"
                disabled={exporting}
                onClick={() => exportSavedRecording("", false)}
              >
                Jen uložit
              </button>
            </>
          )}
        </form>
      ) : session.phase === "idle" ? (
        <>
          <span className="idle-feature-row__icon"><MicIcon variant="idle" /></span>
          <span className="idle-feature-row__copy">
            <strong>Nahrávání</strong>
            {notice ? (
              <small
                className={`idle-feature-row__notice idle-feature-row__notice--${notice.type}`}
                role={notice.type === "error" ? "alert" : "status"}
              >
                {notice.text}
              </small>
            ) : todaySummary && (
              <small data-testid="recording-daily-summary">{todaySummary}</small>
            )}
          </span>
          <button
            type="button"
            className="idle-feature-row__action"
            aria-label="Spustit nahrávání"
            onClick={() => start()}
          >
            <span aria-hidden="true">Nahrát</span>
            <span className="sr-only">Spustit nahrávání</span>
          </button>
        </>
      ) : !isRecording ? (
        <div className="feature-card__header">
          <span className="section-icon section-icon--recording"><MicIcon /></span>
          <div>
            <p className="eyebrow">Zachytit rozhovor</p>
            <h2>Nahrávání</h2>
          </div>
          <span className="status-chip">{statusLabel}</span>
        </div>
      ) : null}

      {session.phase === "checking" && (
        <div className="recording-progress" role="status">
          <p>Kontroluji mikrofon i systémový zvuk…</p>
          <small>{MICROPHONE_ONLY_TEXT}</small>
        </div>
      )}

      {isRecording && (
        <div className="recording-running">
          <div
            className={`activity-status activity-status--recording${systemAudioLost || microphoneOnly ? " is-degraded" : ""}`}
            data-testid="recording-running-state"
            role="status"
          >
            <span className="activity-status__dot" aria-hidden="true" />
            <span>{systemAudioLost || microphoneOnly ? "Nahrává se omezeně" : "Nahrává se"}</span>
          </div>
          <span className="sr-only" aria-hidden="true">Rychlá nahrávka</span>

          <p
            className="elapsed"
            data-panel-height-neutral="true"
            aria-live="polite"
          >
            {formatRecordingElapsed(elapsed)}
          </p>
          <span className="sr-only" aria-hidden="true">{formatElapsed(elapsed)}</span>

          <div
            className="recording-source"
            data-panel-height-neutral="true"
            data-source-state="live"
            data-testid="recording-source-microphone"
            title={`Mikrofon: ${session.labels.microphone}`}
          >
            <span className="recording-source__label">Mikrofon</span>
            <AudioLevelMeter
              className="recording-source__meter"
              fillClassName="recording-source__fill"
              ref={microphoneMeterRef}
              state="live"
            />
            {(systemAudioLost || microphoneOnly) && (
              <span className="recording-source__pill is-live">ok</span>
            )}
          </div>

          <div
            className="recording-source"
            data-panel-height-neutral="true"
            data-source-state={systemSourceState}
            data-testid="recording-source-system"
            title={microphoneOnly ? "Ostatní zvuk není dostupný" : `Ostatní zvuk: ${session.labels.system}`}
          >
            <span className="recording-source__label">Ostatní zvuk</span>
            <AudioLevelMeter
              className="recording-source__meter"
              fillClassName="recording-source__fill"
              ref={systemMeterRef}
              state={systemSourceState}
            />
            {(systemAudioLost || microphoneOnly) && (
              <span className="recording-source__pill is-lost">ticho</span>
            )}
          </div>
          {!systemAudioLost && !microphoneOnly && (
            <span className="sr-only" aria-hidden="true">Obě stopy ověřeny</span>
          )}

          {microphoneOnly && (
            <div className="recording-mode-note" role="status" aria-atomic="true">
              {MICROPHONE_ONLY_TEXT}
            </div>
          )}

          {systemAudioLost ? (
            <>
              <div
                className="recording-outage"
                data-testid="system-audio-outage"
                role="alert"
                aria-atomic="true"
              >
                <span>
                  <strong>Druhá strana hovoru se nenahrává.</strong>{" "}
                  Tvůj hlas ano. Pokračovat můžeš, ale ze schůzky bude jen půlka.
                </span>
              </div>
              <div className="recording-outage__actions">
                <button
                  type="button"
                  className="recording-outage__continue"
                  data-testid="retry-system-audio"
                  aria-busy={recoveringSystemAudio}
                  aria-label="Pokračovat – pokusit se obnovit ostatní zvuk"
                  disabled={recoveringSystemAudio}
                  onClick={() => recoverSystemAudio()}
                >
                  Pokračovat
                </button>
                <button
                  type="button"
                  className="recording-outage__stop"
                  data-testid="degraded-recording-stop"
                  onClick={stop}
                >
                  Ukončit
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="recording-running__stop"
              data-testid="recording-stop"
              onClick={stop}
            >
              Ukončit a uložit
            </button>
          )}
        </div>
      )}

      {session.phase === "stopping" && (
        <div className="recording-progress" role="status">
          <p>{microphoneOnly ? "Dokončuji nahrávku…" : "Dokončuji obě nahrávky…"}</p>
          <small>Čekám na poslední timeslice a potvrzení zápisu na disk.</small>
        </div>
      )}

    </section>
  );
}
