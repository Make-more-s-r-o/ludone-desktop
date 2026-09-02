import { useEffect, useRef, useState } from "react";
import { MicIcon, VolumeIcon } from "../../components/Icons.jsx";
import { formatElapsed, useElapsedTime } from "../../hooks/useElapsedTime.js";
import { captureAudioSources, stopStreams } from "../../lib/audio-levels.js";
import { createStereoCapture } from "../../lib/stereo-recording.js";

const RECORDER_EVENT_TIMEOUT_MS = 5_000;
const RECORDING_TIMESLICE_MS = 1_000;

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
  return `Původní stopy zůstávají místně: ${microphone.name} (${microphone.size} B) a ${system.name} (${system.size} B).`;
}

export function RecordingCard({ onActivityChange, todaySummary = null }) {
  const [session, setSession] = useState({
    phase: "idle",
    startedAt: null,
    labels: null,
  });
  const [notice, setNotice] = useState(null);
  const [savedRecording, setSavedRecording] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const startInFlight = useRef(false);
  const runtimeRef = useRef(null);
  const isRecording = session.phase === "recording";
  const elapsed = useElapsedTime(isRecording, session.startedAt);

  async function finishRuntime(runtime, initialError = null) {
    if (runtime.finishPromise) return runtime.finishPromise;
    runtime.closing = true;
    runtime.finishPromise = (async () => {
      // Originální recordery dostanou stop jako první; stereo derivát je obalí
      // na obou hranách. Jeho flush ale běží odděleně, takže uložení originálů
      // na export nikdy nečeká.
      const recorderResults = runtime.recorders.map((persistentRecorder) => (
        persistentRecorder.stopAndFlush()
      ));
      runtime.exportFinishPromise = runtime.exportRecorder.stopAndFlush()
        .then((timing) => window.ludone.finishRecordingExport(runtime.sessionId, {
          succeeded: true,
          timing,
        }))
        .catch((error) => window.ludone.finishRecordingExport(runtime.sessionId, {
          succeeded: false,
          reason: describeError(error),
        }).catch(() => undefined))
        .finally(() => runtime.stereoCapture.close().catch(() => {}));

      setSession((current) => ({ ...current, phase: "stopping" }));
      const errors = initialError ? [initialError] : [];
      const settledRecorders = await Promise.allSettled(recorderResults);
      for (const result of settledRecorders) {
        if (result.status === "rejected") errors.push(result.reason);
      }

      let saved;
      try {
        const [microphoneResult, systemResult] = settledRecorders;
        const trackTimings = microphoneResult.status === "fulfilled"
          && systemResult.status === "fulfilled"
          ? {
            microphone: microphoneResult.value,
            system: systemResult.value,
          }
          : undefined;
        saved = await window.ludone.finishRecording(runtime.sessionId, trackTimings);
      } catch (error) {
        errors.push(error);
      } finally {
        stopStreams(runtime.streams);
        if (runtimeRef.current === runtime) runtimeRef.current = null;
        setSession({ phase: "idle", startedAt: null, labels: null });
      }

      if (errors.length > 0) {
        const savedSuffix = saved ? ` Dosud zapsané soubory zůstaly zachované: ${savedMessage(saved)}` : "";
        setNotice({
          type: "error",
          text: `Nahrávání bylo zastaveno kvůli chybě: ${describeError(errors[0])}.${savedSuffix}`,
        });
        if (saved) setSavedRecording(saved);
      } else {
        setNotice(null);
        setSavedRecording(saved);
      }
      return saved;
    })();
    return runtime.finishPromise;
  }

  async function exportSavedRecording() {
    if (!savedRecording || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const result = await window.ludone.exportRecording(savedRecording.clientRecordingId);
      if (!result?.ok) throw new Error(result?.message || "Export se nepodařil");
      setSavedRecording(null);
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

  function reportRuntimeFailure(error) {
    const runtime = runtimeRef.current;
    if (runtime && !runtime.closing) void finishRuntime(runtime, error);
  }

  async function start() {
    if (startInFlight.current || runtimeRef.current || session.phase !== "idle") return;
    startInFlight.current = true;
    setNotice(null);
    setSavedRecording(null);
    setExportError(null);
    setSession({ phase: "checking", startedAt: null, labels: null });
    let capture;
    let runtime;
    let stereoCapture;

    try {
      capture = await captureAudioSources();
      const options = recorderOptions();
      stereoCapture = await createStereoCapture(
        capture.microphoneTrack,
        capture.systemTrack,
      );
      const microphoneRecorder = new MediaRecorder(
        new MediaStream([capture.microphoneTrack]),
        options,
      );
      const systemRecorder = new MediaRecorder(
        new MediaStream([capture.systemTrack]),
        options,
      );
      const exportRecorder = new MediaRecorder(stereoCapture.stream, options);
      const persistence = await window.ludone.beginRecording();
      runtime = {
        sessionId: persistence.sessionId,
        streams: capture.streams,
        recorders: [],
        exportRecorder: null,
        exportFinishPromise: null,
        exportStartedAt: null,
        exportError: null,
        stereoCapture,
        closing: false,
        finishPromise: null,
      };
      runtimeRef.current = runtime;
      runtime.recorders = [
        createPersistentRecorder(microphoneRecorder, runtime.sessionId, "microphone", reportRuntimeFailure),
        createPersistentRecorder(systemRecorder, runtime.sessionId, "system", reportRuntimeFailure),
      ];
      runtime.exportRecorder = createPersistentRecorder(
        exportRecorder,
        runtime.sessionId,
        "stereo",
        (error) => {
          runtime.exportError ??= error;
        },
      );
      for (const [track, label] of [
        [capture.microphoneTrack, "Mikrofonní stopa"],
        [capture.systemTrack, "Systémová stopa"],
      ]) {
        if (track.readyState !== "live" || !track.enabled || track.muted) {
          throw new Error(`${label} přestala být dostupná během přípravy`);
        }
        const reportUnavailable = () => {
          if (!runtime.closing) reportRuntimeFailure(new Error(`${label} neočekávaně přestala dodávat zvuk`));
        };
        track.addEventListener("ended", reportUnavailable, { once: true });
        track.addEventListener("mute", reportUnavailable, { once: true });
        if (track.readyState !== "live" || !track.enabled || track.muted) {
          throw new Error(`${label} přestala být dostupná těsně před startem`);
        }
      }
      // Stereo derivát startuje první a končí poslední. Obě originální stopy tak
      // leží uvnitř jedné společné exportní časové osy bez dopočítaného ticha.
      try {
        runtime.exportStartedAt = await runtime.exportRecorder.start();
      } catch (error) {
        runtime.exportError = error;
      }
      await Promise.all(runtime.recorders.map((persistentRecorder) => persistentRecorder.start()));
      if (runtime.closing) {
        await runtime.finishPromise;
        return;
      }
      setSession({
        phase: "recording",
        startedAt: Date.now(),
        labels: {
          microphone: capture.microphoneTrack.label || "Mikrofon",
          system: capture.systemTrack.label || "Systémový zvuk",
        },
      });
    } catch (error) {
      if (runtime) {
        await finishRuntime(runtime, error);
      } else {
        if (capture) stopStreams(capture.streams);
        if (stereoCapture) await stereoCapture.close().catch(() => {});
        setSession({ phase: "idle", startedAt: null, labels: null });
        setNotice({
          type: "error",
          text: `Nahrávání se nespustilo: ${describeError(error)}. Opravte přístup k oběma stopám před schůzkou.`,
        });
      }
    } finally {
      startInFlight.current = false;
    }
  }

  function stop() {
    const runtime = runtimeRef.current;
    if (runtime && !runtime.closing) void finishRuntime(runtime);
  }

  useEffect(() => {
    onActivityChange({
      // Příprava i ukládání jsou aktivní fáze. `idle` se nahlásí až poté, co
      // finishRecording doběhne a hlavní proces stihne položku zařadit do fronty.
      active: session.phase !== "idle",
    });
  }, [onActivityChange, session.phase]);

  const statusLabel = {
    idle: "Připraveno",
    checking: "Kontrola",
    recording: "Nahrává",
    stopping: "Ukládám",
  }[session.phase];

  return (
    <section
      className={`feature-card recording-card${isRecording ? " is-active" : ""}${session.phase === "idle" && !savedRecording ? " idle-feature-row" : ""}${session.phase === "idle" && !savedRecording && notice ? " has-notice" : ""}${savedRecording ? " recording-card--saved" : ""}`}
      data-recording-phase={savedRecording ? "saved" : session.phase}
      data-microphone-label={session.labels?.microphone ?? ""}
      data-system-label={session.labels?.system ?? ""}
      data-testid={session.phase === "idle" && !savedRecording ? "idle-action-row" : undefined}
      aria-label="Nahrávání"
    >
      {savedRecording ? (
        <div className="recording-saved">
          <div>
            <h2>Nahrávka uložena</h2>
            <small>{savedMessage(savedRecording)}</small>
          </div>
          {(exportError || notice?.type === "error") && (
            <p className="recording-saved__error" role="alert">
              {exportError || notice.text}
            </p>
          )}
          <button
            type="button"
            className="button button--primary button--wide"
            disabled={exporting}
            onClick={() => exportSavedRecording()}
          >
            Uložit a odeslat
          </button>
        </div>
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
      ) : (
        <div className="feature-card__header">
          <span className="section-icon section-icon--recording"><MicIcon /></span>
          <div>
            <p className="eyebrow">Zachytit rozhovor</p>
            <h2>Nahrávání</h2>
          </div>
          <span className={`status-chip${isRecording ? " status-chip--active" : ""}`}>
            {statusLabel}
          </span>
        </div>
      )}

      {session.phase === "checking" && (
        <div className="recording-progress" role="status">
          <p>Kontroluji mikrofon i systémový zvuk…</p>
          <small>Nahrávání a čas se spustí až po ověření obou živých stop.</small>
        </div>
      )}

      {isRecording && (
        <div className="recording-live">
          <div>
            <p className="live-context">Rychlá nahrávka</p>
            <p className="elapsed" aria-live="polite">{formatElapsed(elapsed)}</p>
          </div>
          <div
            className="source-line"
            title={`Mikrofon: ${session.labels.microphone} · systém: ${session.labels.system}`}
          >
            <VolumeIcon /> Obě stopy ověřeny
          </div>
          <button type="button" className="button button--stop button--wide" onClick={stop}>
            <span className="stop-square" /> Ukončit a uložit
          </button>
        </div>
      )}

      {session.phase === "stopping" && (
        <div className="recording-progress" role="status">
          <p>Dokončuji obě nahrávky…</p>
          <small>Čekám na poslední timeslice a potvrzení zápisu na disk.</small>
        </div>
      )}

    </section>
  );
}
