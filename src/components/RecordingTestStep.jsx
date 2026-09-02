import { useEffect, useRef, useState } from "react";
import {
  LIVE_RMS_THRESHOLD,
  SILENT_RMS_THRESHOLD,
} from "../lib/audio-levels.js";

const LIVE_CONFIRMATION_FRAMES = 6;
const INITIAL_SIGNAL = Object.freeze({ heard: false, liveFrames: 0, state: "checking" });

function initialSignals() {
  return {
    microphone: { ...INITIAL_SIGNAL },
    system: { ...INITIAL_SIGNAL },
  };
}

function nextSignal(previous, rms, available, allowCertification = true) {
  if (!available) return { heard: false, liveFrames: 0, state: "silent" };
  const isLive = previous.state === "live"
    ? rms >= SILENT_RMS_THRESHOLD
    : rms >= LIVE_RMS_THRESHOLD;
  const liveFrames = isLive && allowCertification ? previous.liveFrames + 1 : 0;
  return {
    heard: previous.heard || liveFrames >= LIVE_CONFIRMATION_FRAMES,
    liveFrames,
    state: isLive ? "live" : "silent",
  };
}

function drawLevel(canvas, percent, isLive, colors) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = isLive ? colors.live : colors.silent;
  context.fillRect(0, 0, Math.round(canvas.width * (percent / 100)), canvas.height);
}

function LevelRow({ canvasRef, label, rowRef, signal, testId }) {
  return (
    <div
      className="recording-test-level"
      data-panel-height-neutral="true"
      data-signal-state={signal.state}
      data-testid={testId}
      ref={rowRef}
    >
      <span className="recording-test-level__label">{label}</span>
      <span className="recording-test-level__meter" aria-hidden="true">
        <canvas ref={canvasRef} width="180" height="8" />
      </span>
      <span className={`recording-test-level__status is-${signal.state}`}>
        {signal.state === "live" ? "slyším" : "ticho"}
      </span>
    </div>
  );
}

export function RecordingTestStep({ onPassed, onRetry, sessionAttempt , onSkipped}) {
  const [captureState, setCaptureState] = useState("starting");
  const [labels, setLabels] = useState({
    microphone: "MacBook Pro — mikrofon",
    system: "Ostatní zvuk",
  });
  const [signals, setSignals] = useState({
    microphone: INITIAL_SIGNAL,
    system: INITIAL_SIGNAL,
  });
  const microphoneCanvasRef = useRef(null);
  const microphoneRowRef = useRef(null);
  const meterColorsRef = useRef(null);
  const sessionRef = useRef(null);
  const signalsRef = useRef(initialSignals());
  const suppressMicrophoneUntilRef = useRef(0);
  const systemCanvasRef = useRef(null);
  const systemRowRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let animationFrame = null;
    const freshSignals = initialSignals();
    sessionRef.current = null;
    signalsRef.current = freshSignals;
    suppressMicrophoneUntilRef.current = 0;
    setCaptureState("starting");
    setLabels({
      microphone: "MacBook Pro — mikrofon",
      system: "Ostatní zvuk",
    });
    setSignals(freshSignals);

    sessionAttempt.promise.then((session) => {
      if (disposed) {
        void session.close().catch(() => {});
        return;
      }
      sessionRef.current = session;
      setLabels(session.labels);
      setCaptureState("testing");

      const sample = () => {
        if (disposed) return;
        const levels = session.readLevels();
        const now = window.performance.now();
        if (!meterColorsRef.current) {
          const styles = window.getComputedStyle(document.documentElement);
          meterColorsRef.current = {
            live: styles.getPropertyValue("--green-bright").trim() || "#34a853",
            silent: styles.getPropertyValue("--muted-foreground").trim() || "#888888",
          };
        }
        for (const [name, refs] of [
          ["microphone", {
            canvas: microphoneCanvasRef,
            label: "Mikrofon",
            row: microphoneRowRef,
          }],
          ["system", {
            canvas: systemCanvasRef,
            label: "Ostatní zvuk",
            row: systemRowRef,
          }],
        ]) {
          const level = levels[name];
          const row = refs.row.current;
          if (row) {
            const percent = String(level.percent);
            const accessibleLevel = `${refs.label}: ${percent} %`;
            if (row.dataset.level !== percent) row.dataset.level = percent;
            if (row.getAttribute("aria-label") !== accessibleLevel) {
              row.setAttribute("aria-label", accessibleLevel);
            }
          }
          drawLevel(
            refs.canvas.current,
            level.percent,
            level.available && level.rms >= LIVE_RMS_THRESHOLD,
            meterColorsRef.current,
          );
        }
        const current = signalsRef.current;
        const microphone = nextSignal(
          current.microphone,
          levels.microphone.rms,
          levels.microphone.available,
          now >= suppressMicrophoneUntilRef.current,
        );
        const system = nextSignal(
          current.system,
          levels.system.rms,
          levels.system.available,
        );
        signalsRef.current = { microphone, system };
        if (
          microphone.heard !== current.microphone.heard
          || microphone.state !== current.microphone.state
          || system.heard !== current.system.heard
          || system.state !== current.system.state
        ) {
          setSignals(signalsRef.current);
        }
        if (!levels.microphone.available || !levels.system.available) {
          setCaptureState("error");
          void session.close().catch(() => {});
          return;
        }
        animationFrame = window.requestAnimationFrame(sample);
      };
      animationFrame = window.requestAnimationFrame(sample);
    }).catch(() => {
      if (disposed) return;
      setCaptureState("error");
      signalsRef.current = {
        microphone: { heard: false, liveFrames: 0, state: "silent" },
        system: { heard: false, liveFrames: 0, state: "silent" },
      };
      setSignals(signalsRef.current);
    });

    return () => {
      disposed = true;
      sessionAttempt.cancel();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void session.close().catch(() => {});
    };
  }, [sessionAttempt]);

  const bothHeard = signals.microphone.heard && signals.system.heard;

  async function playTestSound() {
    const session = sessionRef.current;
    if (!session) return;
    // Zvuk z reproduktoru může přeslechnout mikrofon. Během tónu proto může
    // mikrofonní měřák žít, ale tento pohyb sám o sobě test mikrofonu nesplní.
    suppressMicrophoneUntilRef.current = window.performance.now() + 1_000;
    await session.playTestSound().catch(() => {});
  }

  return (
    <section
      className="onboarding__content recording-test-step"
      data-recording-test-state={captureState}
      data-testid="recording-test-screen"
    >
      <h1>Test záznamu</h1>
      <p className="lead">
        Řekni něco nahlas a pusť si libovolný zvuk. Oba měřáky se musí hýbat.
      </p>

      <div className="recording-test-levels">
        <LevelRow
          canvasRef={microphoneCanvasRef}
          label="Mikrofon"
          rowRef={microphoneRowRef}
          signal={signals.microphone}
          testId="recording-level-microphone"
        />
        <LevelRow
          canvasRef={systemCanvasRef}
          label="Ostatní zvuk"
          rowRef={systemRowRef}
          signal={signals.system}
          testId="recording-level-system"
        />
      </div>

      <div className="recording-test-device">{labels.microphone}</div>
      {captureState === "error" ? (
        <button
          type="button"
          className="button button--wide"
          data-testid="recording-test-retry"
          onClick={onRetry}
        >
          Zkusit znovu
        </button>
      ) : (
        <button
          type="button"
          className="button button--wide"
          disabled={captureState !== "testing"}
          onClick={playTestSound}
        >
          Přehrát zkušební zvuk
        </button>
      )}
      <button
        type="button"
        className="button button--primary button--wide"
        data-testid="recording-test-continue"
        disabled={captureState !== "testing" || !bothHeard}
        onClick={onPassed}
      >
        Pokračovat
      </button>
      <button
        type="button"
        className="text-button"
        data-testid="recording-test-skip"
        onClick={onSkipped}
      >
        Pokračovat bez testu
      </button>
      <p className="recording-test-hint">Pokračovat půjde, až uslyším oba kanály.</p>
    </section>
  );
}
