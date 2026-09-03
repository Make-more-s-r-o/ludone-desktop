import { useEffect, useRef, useState } from "react";
import {
  LIVE_RMS_THRESHOLD,
  SILENT_RMS_THRESHOLD,
} from "../lib/audio-levels.js";
import {
  AudioLevelMeter,
  updateAudioLevelMeter,
} from "../features/recording/AudioLevelMeter.jsx";

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

function LevelRow({ label, meterRef, rowRef, signal, testId }) {
  return (
    <div
      className="recording-test-level"
      data-panel-height-neutral="true"
      data-signal-state={signal.state}
      data-testid={testId}
      ref={rowRef}
    >
      <span className="recording-test-level__label">{label}</span>
      <AudioLevelMeter
        className="recording-test-level__meter"
        ref={meterRef}
        state={signal.state}
      />
      <span className={`recording-test-level__status is-${signal.state}`}>
        {signal.state === "live" ? "slyším" : "ticho"}
      </span>
    </div>
  );
}

export function RecordingTestStep({ onPassed, onRetry, sessionAttempt, onSkipped }) {
  const [captureState, setCaptureState] = useState("starting");
  const [labels, setLabels] = useState({
    microphone: "MacBook Pro — mikrofon",
    system: "Ostatní zvuk",
  });
  const [signals, setSignals] = useState({
    microphone: INITIAL_SIGNAL,
    system: INITIAL_SIGNAL,
  });
  const microphoneMeterRef = useRef(null);
  const microphoneRowRef = useRef(null);
  const sessionRef = useRef(null);
  const signalsRef = useRef(initialSignals());
  const suppressMicrophoneUntilRef = useRef(0);
  const systemMeterRef = useRef(null);
  const systemRowRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let animationFrame = null;
    const freshSignals = initialSignals();
    sessionRef.current = null;
    signalsRef.current = freshSignals;
    suppressMicrophoneUntilRef.current = 0;
    updateAudioLevelMeter(microphoneMeterRef.current, 0);
    updateAudioLevelMeter(systemMeterRef.current, 0);
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
        for (const [name, refs] of [
          ["microphone", {
            meter: microphoneMeterRef,
            label: "Mikrofon",
            row: microphoneRowRef,
          }],
          ["system", {
            meter: systemMeterRef,
            label: "Ostatní zvuk",
            row: systemRowRef,
          }],
        ]) {
          const level = levels[name];
          const row = refs.row.current;
          if (row) {
            const percent = String(level.percent);
            const measurementState = level.measured === false ? "unavailable" : "measured";
            const accessibleLevel = measurementState === "unavailable"
              ? `${refs.label}: měřidlo nedostupné`
              : `${refs.label}: ${percent} %`;
            if (row.dataset.level !== percent) row.dataset.level = percent;
            if (row.dataset.levelMonitorState !== measurementState) {
              row.dataset.levelMonitorState = measurementState;
            }
            if (row.getAttribute("aria-label") !== accessibleLevel) {
              row.setAttribute("aria-label", accessibleLevel);
            }
          }
          updateAudioLevelMeter(
            refs.meter.current,
            level.percent,
            level.measured === false ? "unavailable" : "measured",
          );
        }
        const current = signalsRef.current;
        const microphone = nextSignal(
          current.microphone,
          levels.microphone.rms,
          levels.microphone.available && levels.microphone.measured,
          now >= suppressMicrophoneUntilRef.current,
        );
        const system = nextSignal(
          current.system,
          levels.system.rms,
          levels.system.available && levels.system.measured,
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
        if (
          !levels.microphone.available
          || !levels.microphone.measured
          || !levels.system.available
          || !levels.system.measured
        ) {
          setCaptureState("error");
          void session.close().catch(() => {});
          return;
        }
        animationFrame = window.requestAnimationFrame(sample);
      };
      animationFrame = window.requestAnimationFrame(sample);
    }).catch(() => {
      if (disposed) return;
      updateAudioLevelMeter(microphoneMeterRef.current, 0, "unavailable");
      updateAudioLevelMeter(systemMeterRef.current, 0, "unavailable");
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
          label="Mikrofon"
          meterRef={microphoneMeterRef}
          rowRef={microphoneRowRef}
          signal={signals.microphone}
          testId="recording-level-microphone"
        />
        <LevelRow
          label="Ostatní zvuk"
          meterRef={systemMeterRef}
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
        onClick={() => onSkipped(captureState === "error" ? "failed" : "skipped")}
      >
        Pokračovat bez testu
      </button>
      <p className="recording-test-hint">
        {bothHeard
          ? "Oba kanály slyším."
          : "Bez ní se nedá tvrdit, že to funguje."}
      </p>
    </section>
  );
}
