import { DEFAULT_COMPANY_MAX_RETRIES, DEFAULT_COMPANY_RETRY_DELAY_MS, RecordingUploadPreferences, freshRecordingUploadPreferences, readRecordingDefaultCompany, uploadCompanyErrorMessage, verifiedRecordingDefaultCompany } from "../../components/UploadCompanySelector.jsx";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { OsaIcon } from "../../components/osa/OsaIcon.jsx";
import { ArchiveIcon, MicIcon, SettingsIcon, VolumeIcon } from "../../components/Icons.jsx";
import { formatElapsed, useElapsedTime } from "../../hooks/useElapsedTime.js";
import {
  createAudioLevelMonitor,
  createSharedAudioContext,
  captureAudioSources,
  captureSystemAudioSource,
  stopStreams,
} from "../../lib/audio-levels.js";
import { countLabel } from "../../lib/count-label.js";
import { recordingSizeText } from "../../lib/format-size.js";
import { getRecordingVisibilityPreference, persistRecordingVisibilityPreference } from "../../lib/recording-visibility.js";
import { createStereoCapture } from "../../lib/stereo-recording.js";
import {
  AudioLevelMeter,
  updateAudioLevelMeter,
} from "./AudioLevelMeter.jsx";
import { createMicrophoneOnlyExportCapture } from "./microphone-only-capture.js";
import {
  MICROPHONE_REQUIRED_TEXT,
  RECORDING_MICROPHONE_ONLY_TEXT,
  microphoneOnlyReason,
  savedRecordingAge,
} from "./recording-copy.js";
import { recorderEventTimestamp } from "./recorder-timestamp.js";
import { watchSystemAudioTrack } from "./system-audio-health.js";
import { recordingDeletionFailureMessage } from "./deletion-message.js";

const RECORDER_EVENT_TIMEOUT_MS = 5_000;
const RECORDING_TIMESLICE_MS = 1_000;
const SAVED_AGE_REFRESH_MS = 60_000;
const LOCAL_SAVE_NOTICE_MS = 10_000;
// Shodné se serverem: String.length po trim(), tedy UTF-16 jednotky.
// Mění se současně na serveru i v electron/recording-export.cjs.
const MAX_UPLOAD_NAME_UTF16_UNITS = 500;
const QUIT_EXPORT_FAILURE_CONSEQUENCE = "LuDone zůstává otevřené. Originály i rozpracovaný stereo soubor zůstanou na Macu a převod můžete zopakovat po dalším spuštění.";

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
  const tracks = Object.values(files ?? {}).filter((file) => Number.isFinite(file?.size));
  // Smíchaný master vzniká až po uložení originálů, takže tady jeho velikost neznáme.
  // Ukazujeme proto jen součet místních původních stop a říkáme, co to je.
  const text = recordingSizeText({
    uploadBytes: null,
    originalsBytes: tracks.reduce((total, file) => total + file.size, 0),
    originalsCount: tracks.length,
  });
  return text ?? "velikost neznámá";
}

function savedRecordingMetadata(recording, now) {
  const startedAtDate = new Date(recording.startedAt);
  const currentDate = new Date(now);
  const dateOptions = { day: "numeric", month: "long" };
  if (Number.isFinite(startedAtDate.getTime())
    && Number.isFinite(currentDate.getTime())
    && startedAtDate.getFullYear() !== currentDate.getFullYear()) {
    dateOptions.year = "numeric";
  }
  const date = recordingDate(recording.startedAt, dateOptions);
  const startedAt = recordingDate(recording.startedAt, { hour: "2-digit", minute: "2-digit" });
  const endedAt = recordingDate(recording.endedAt, { hour: "2-digit", minute: "2-digit" });
  const age = savedRecordingAge(recording.endedAt, currentDate);
  return {
    stale: age.stale,
    interval: `${date}, ${startedAt}–${endedAt}${age.stale ? ` · ${age.label}` : ""}`,
    summary: `${durationLabel(recording.startedAt, recording.endedAt)} · ${sizeLabel(recording.files)}`,
  };
}

export const RecordingCard = forwardRef(function RecordingCard({
  canSend = true,
  compact = false,
  onActivityChange,
  onOpenSources,
  todaySummary = null,
  trayCommand = null,
}, ref) {
  const [session, setSession] = useState({
    phase: "idle",
    recordingMode: null,
    startedAt: null,
    labels: null,
    systemAudioState: "inactive",
  });
  const [notice, setNotice] = useState(null);
  const [savedRecording, setSavedRecording] = useState(null);
  const [savedAgeNow, setSavedAgeNow] = useState(() => Date.now());
  const [recordingName, setRecordingName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [autoResolvingCompany, setAutoResolvingCompany] = useState(false);
  const [copyExporting, setCopyExporting] = useState(false);
  const [recordingVisibility, setRecordingVisibility] = useState(getRecordingVisibilityPreference);
  const [visibilityStored, setVisibilityStored] = useState(true);
  const [defaultCompany, setDefaultCompany] = useState({ state: "loading", identityKey: null, company: null });
  const [defaultCompanyRefresh, setDefaultCompanyRefresh] = useState(0);
  const [uploadPreferences, setUploadPreferences] = useState(null);
  const [uploadPreferencesReason, setUploadPreferencesReason] = useState(null);
  const [pickerInitial, setPickerInitial] = useState(null);
  const [pickerInitialCompanyPromise, setPickerInitialCompanyPromise] = useState(null);
  const [pickerRefresh, setPickerRefresh] = useState(0);
  const [pickerOwner, setPickerOwner] = useState(null);
  const [verifiedUploadIdentity, setVerifiedUploadIdentity] = useState(null);
  const [uploadIdentityError, setUploadIdentityError] = useState(null);
  const [copyExportNotice, setCopyExportNotice] = useState(null);
  const savedRecordingRef = useRef(savedRecording);
  savedRecordingRef.current = savedRecording;
  const copyExportOperation = useRef(null);
  const copyExportGeneration = useRef(0);
  const copyExportLifecycle = useRef(0);
  const cardMounted = useRef(true);
  const uploadAuthGeneration = useRef(0);
  const identityRequest = useRef(0);
  const lastUploadIdentity = useRef(null);
  const pickerOwnerSerial = useRef(0);
  const uploadIdentityVerified = useRef(false);
  const recordingChoices = useRef(null);
  const defaultCompanyRequest = useRef(null);
  const defaultCompanyIdle = useRef(true);
  defaultCompanyIdle.current = session.phase === "idle" && !savedRecording && !exporting;
  const canSendRef = useRef(canSend);
  canSendRef.current = canSend;
  const refreshUploadIdentity = useCallback(() => {
    const request = ++identityRequest.current;
    uploadIdentityVerified.current = false;
    setVerifiedUploadIdentity(null);
    setUploadPreferences(null);
    setUploadIdentityError(null);
    if (!canSendRef.current) {
      setUploadIdentityError("Účet nelze ověřit. Obnov přihlášení.");
      return;
    }
    if (typeof window.ludone?.getAuthIdentity !== "function" || typeof window.ludone?.getAuthOrigin !== "function") {
      setUploadIdentityError("Ověření účtu není v této aplikaci dostupné.");
      return;
    }
    Promise.resolve().then(() => Promise.all([window.ludone.getAuthIdentity(), window.ludone.getAuthOrigin(),
      typeof window.ludone.getUploadCompanyIdentity === "function" ? window.ludone.getUploadCompanyIdentity() : null]))
      .then(([identity, origin, binding]) => {
        if (identityRequest.current !== request || !canSendRef.current) return;
        const email = typeof identity?.email === "string" ? identity.email.trim() : "";
        if (!/^[^\s@]+@[^\s@]+$/u.test(email)) {
          setUploadIdentityError("Účet se nepodařilo ověřit: chybí platný e-mail.");
          return;
        }
        if (typeof origin !== "string" || !origin) {
          setUploadIdentityError("Účet se nepodařilo ověřit: chybí adresa prostředí.");
          return;
        }
        // Bez ověřeného subjectu nelze rozpracovanou volbu bezpečně převést přes změnu relace.
        const key = typeof binding === "string" ? binding : `unbound:${request}`;
        if (lastUploadIdentity.current !== key) {
          lastUploadIdentity.current = key;
          setPickerInitial(recordingChoices.current ? { visibility: recordingChoices.current.visibility } : null);
          setPickerInitialCompanyPromise(null);
          setPickerOwner({ key, serial: ++pickerOwnerSerial.current });
        }
        uploadIdentityVerified.current = true;
        setVerifiedUploadIdentity(key);
      }).catch((error) => {
        if (identityRequest.current === request) {
          setUploadIdentityError(typeof error?.message === "string"
            && /(?:^|: )Uložená session neobsahuje ověřitelnou identitu$/u.test(error.message)
            ? "Přihlášení nemá ověřený e-mail. Přihlas se znovu v Nastavení."
            : `Účet se nepodařilo ověřit. ${uploadCompanyErrorMessage(error)}`);
        }
      });
  }, []);
  useEffect(() => {
    refreshUploadIdentity();
    return () => { identityRequest.current += 1; };
  }, [canSend, refreshUploadIdentity]);
  useEffect(() => window.ludone?.onAuthSessionChanged?.(() => {
    uploadAuthGeneration.current += 1;
    refreshUploadIdentity();
    if (defaultCompanyIdle.current) {
      setDefaultCompany({ state: "loading", identityKey: null, company: null });
      setDefaultCompanyRefresh((value) => value + 1);
    }
  }), [refreshUploadIdentity]);
  useEffect(() => {
    const refresh = () => {
      if (!defaultCompanyIdle.current) return;
      setDefaultCompany({ state: "loading", identityKey: null, company: null });
      setDefaultCompanyRefresh((value) => value + 1);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => {
    let active = true;
    if (!defaultCompanyIdle.current) return () => { active = false; };
    if (!canSend || !verifiedUploadIdentity) {
      setDefaultCompany({ state: canSend && !uploadIdentityError ? "loading" : "unavailable", identityKey: null, company: null });
      return () => { active = false; };
    }
    const identityKey = verifiedUploadIdentity;
    const authGeneration = uploadAuthGeneration.current;
    let timer = null;
    let request = null;
    const isCurrent = () => active && defaultCompanyIdle.current && authGeneration === uploadAuthGeneration.current;
    const checkDefault = (retries) => {
      if (!isCurrent()) return;
      const savedPromise = readRecordingDefaultCompany();
      request = { identityKey, storedPromise: savedPromise.then((company) => company?.pending ? null : company).catch(() => null) };
      const currentRequest = request;
      defaultCompanyRequest.current = currentRequest;
      setDefaultCompany({ state: "loading", identityKey, company: null });
      currentRequest.storedPromise.then((company) => {
        if (!active || !company || authGeneration !== uploadAuthGeneration.current) return;
        if (defaultCompanyIdle.current) {
          setDefaultCompany((current) => current.identityKey === identityKey && current.state === "loading"
            ? { ...current, company } : current);
        }
        const choice = recordingChoices.current;
        if (choice?.defaultRequest === currentRequest && uploadIdentityVerified.current
          && choice.identityKey === lastUploadIdentity.current && choice.authGeneration === uploadAuthGeneration.current) {
          choice.company = company;
        }
      });
      verifiedRecordingDefaultCompany(savedPromise, isCurrent).then((company) => {
        if (!isCurrent()) return;
        if (company?.pending) {
          if (retries < DEFAULT_COMPANY_MAX_RETRIES) {
            timer = window.setTimeout(() => checkDefault(retries + 1), DEFAULT_COMPANY_RETRY_DELAY_MS);
          } else setDefaultCompany({ state: "unavailable", identityKey, company: null });
          return;
        }
        setDefaultCompany({ state: company ? "ready" : "empty", identityKey, company });
      }).catch(() => {
        if (isCurrent()) setDefaultCompany({ state: "unavailable", identityKey, company: null });
      });
    };
    checkDefault(0);
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
      if (defaultCompanyRequest.current === request) defaultCompanyRequest.current = null;
    };
  }, [canSend, verifiedUploadIdentity, uploadIdentityError, defaultCompanyRefresh, session.phase, savedRecording, exporting]);
  const [exportError, setExportError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [quitExportFailure, setQuitExportFailure] = useState(null);
  const [recoveringSystemAudio, setRecoveringSystemAudio] = useState(false);
  const [readyForStop, setReadyForStop] = useState(false);
  const startInFlight = useRef(false);
  const startOperationRef = useRef(null);
  const stopRequestedDuringStart = useRef(false);
  const lastTrayCommandId = useRef(null);
  const microphoneMeterRef = useRef(null);
  const runtimeRef = useRef(null);
  const systemMeterRef = useRef(null);
  const isRecording = session.phase === "recording";
  const microphoneOnly = session.recordingMode === "microphone-only";
  const systemAudioLost = isRecording && session.systemAudioState === "lost";
  const systemAudioStarting = isRecording && session.systemAudioState === "starting";
  const systemSourceState = microphoneOnly ? "unavailable"
    : (systemAudioLost ? "lost" : (systemAudioStarting ? "starting" : "live"));
  const elapsed = useElapsedTime(isRecording, session.startedAt);
  const [systemAudioPermission, setSystemAudioPermission] = useState(null);

  // Stav oprávnění se čte teprve tehdy, když nahrávka opravdu vyšla jednostopá — dřív
  // není co vysvětlovat a dotaz by jen běžel nazmar. Selhání čtení nesmí kartu shodit:
  // bez odpovědi zůstane obecný text, tedy dnešní chování.
  useEffect(() => {
    if (!microphoneOnly || typeof window.ludone?.getPermissionStatus !== "function") {
      return undefined;
    }
    let active = true;
    window.ludone.getPermissionStatus("system-audio").then(
      (result) => { if (active) setSystemAudioPermission(result); },
      () => { if (active) setSystemAudioPermission(null); },
    );
    return () => { active = false; };
  }, [microphoneOnly]);

  useEffect(() => {
    if (!savedRecording) return undefined;
    const intervalId = window.setInterval(() => setSavedAgeNow(Date.now()), SAVED_AGE_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [savedRecording]);

  useEffect(() => {
    if (!notice?.dismissAfter) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice((current) => (current === notice ? null : current));
    }, notice.dismissAfter);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const microphoneOnlyNote = microphoneOnly
    ? microphoneOnlyReason({
      permission: systemAudioPermission,
      error: session.systemAudioError,
    })
    : null;

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

      if (saved && recordingChoices.current) {
        const choice = recordingChoices.current;
        const sameIdentity = uploadIdentityVerified.current && choice.identityKey === lastUploadIdentity.current;
        const company = sameIdentity ? choice.company : null;
        setPickerInitial({ visibility: choice.visibility, ...(company ?? {}) });
        setPickerInitialCompanyPromise(sameIdentity ? choice.defaultRequest?.storedPromise ?? null : null);
      }
      if (errors.length > 0) {
        const savedSuffix = saved ? ` Dosud zapsané soubory zůstaly zachované: ${savedMessage(saved)}` : "";
        setNotice({
          type: "error",
          text: `Nahrávání bylo zastaveno kvůli chybě: ${describeError(errors[0])}.${savedSuffix}`,
        });
        if (saved) {
          setRecordingName(suggestedRecordingName(saved.startedAt));
          setSavedAgeNow(Date.now());
          setSavedRecording(saved);
        }
      } else {
        setNotice(null);
        if (saved) {
          setRecordingName(suggestedRecordingName(saved.startedAt));
          setSavedAgeNow(Date.now());
          setSavedRecording(saved);
        }
      }
      if (saved?.automaticUpload === true) {
        const defaultName = suggestedRecordingName(saved.startedAt);
        await exportSavedRecording(saved, defaultName, "send");
      }
      return saved;
    })();
    return runtime.finishPromise;
  }

  async function exportSavedRecording(recording, name, decision, manual = false) {
    const supportsPreferences = typeof window.ludone?.listUploadCompanies === "function";
    if (manual && decision === "send" && supportsPreferences && (!uploadIdentityVerified.current || !uploadPreferences)) {
      setExportError("Před odesláním ověř a vyber cílovou firmu.");
      return;
    }
    if (!recording || exporting) return;
    if (decision === "send" && !canSend) return;
    if (name.trim().length > MAX_UPLOAD_NAME_UTF16_UNITS) {
      setExportError("Název je příliš dlouhý. Zkraťte ho.");
      return;
    }
    defaultCompanyIdle.current = false;
    setExporting(true);
    setExportError(null);
    const generation = uploadAuthGeneration.current;
    const uploadIdentity = lastUploadIdentity.current;
    const autoSelectCompany = !manual && decision === "send" && recording.automaticUpload === true
      && typeof window.ludone?.getUploadCompanyDefault === "function" && supportsPreferences;
    if (autoSelectCompany) setAutoResolvingCompany(true);
    try {
      let freshPreferences = manual && uploadPreferences
        ? await freshRecordingUploadPreferences(uploadPreferences).catch((error) => {
          if (decision === "keep") return null;
          throw error;
        }) : null;
      if (autoSelectCompany) {
        const choice = recordingChoices.current;
        // Je-li identita ze startu známá, nesmí se změnit; jinak vlastníka ověří hlavní proces.
        if (choice && (!uploadIdentityVerified.current || (choice.identityKey && choice.identityKey !== lastUploadIdentity.current)
          || choice.authGeneration !== uploadAuthGeneration.current)) throw new Error("identity_changed");
        const savedDefault = await window.ludone.getUploadCompanyDefault();
        if (!savedDefault?.companyId) throw new Error("Vyber cílovou firmu. Výchozí firmu se nepodařilo určit.");
        freshPreferences = await freshRecordingUploadPreferences({ companyId: savedDefault.companyId, visibility: choice?.visibility ?? "company" });
      }
      if (autoSelectCompany && (!canSendRef.current || !uploadIdentityVerified.current
        || uploadIdentity !== lastUploadIdentity.current)) throw new Error("identity_changed");
      if (generation !== uploadAuthGeneration.current) throw new Error("Přihlášení se změnilo. Ověř volby znovu.");
      const modernDecision = window.ludone.saveRecordingDecision;
      const result = typeof modernDecision === "function"
        ? await modernDecision(recording.clientRecordingId, { recordingName: name, decision, ...(freshPreferences ? { uploadPreferences: freshPreferences } : {}) })
        : await window.ludone.exportRecording(recording.clientRecordingId, {
          recordingName: name, openUploadPage: decision === "send",
        });
      if (!result?.ok) throw new Error(result?.message || "Export se nepodařil");
      setSavedRecording(null);
      setPickerInitial(null);
      setPickerInitialCompanyPromise(null);
      setUploadPreferences(null);
      recordingChoices.current = null;
      setRecordingName("");
      setQuitExportFailure(null);
      const deliveryDetail = result.outcome === "queued"
        ? "Nahrávka čeká ve frontě k odeslání."
        : result.outcome === "saved_local"
          ? "Nahrávka zůstala jen na tomto Macu a nebyla zařazena k odeslání."
          : "";
      const modernOutcome = typeof modernDecision === "function";
      const outcomeText = result.outcome === "saved_local"
        ? "Nahrávka zůstala jen na tomto Macu a nebyla zařazena k odeslání."
        : result.outcome === "queued"
          ? "Uloženo na Macu. Nahrávka čeká ve frontě k odeslání."
          : result.outcome === "sent"
            ? "Uloženo a odesláno."
            : "Nahrávka byla uložena na Macu. Stav odeslání není potvrzený.";
      setNotice({
        type: "success",
        text: `${outcomeText}${modernOutcome && manual && decision === "keep" && supportsPreferences && !freshPreferences
          ? " Volby pro odeslání nastavíš v detailu nahrávky." : ""}`,
        openRecordings: modernOutcome || Boolean(deliveryDetail),
        dismissAfter: result.outcome === "saved_local" ? LOCAL_SAVE_NOTICE_MS : null,
      });
    } catch (error) {
      setExportError(autoSelectCompany && error?.message !== "Vyber cílovou firmu. Výchozí firmu se nepodařilo určit."
        ? `Automatické odeslání se nespustilo. ${uploadCompanyErrorMessage(error)}` : describeError(error));
      if (manual && supportsPreferences && generation === uploadAuthGeneration.current
        && uploadIdentityVerified.current && uploadIdentity === lastUploadIdentity.current) {
        setPickerInitial(uploadPreferences);
        setPickerRefresh((value) => value + 1);
      }
    } finally {
      if (autoSelectCompany) setAutoResolvingCompany(false);
      setExporting(false);
    }
  }

  async function exportSavedRecordingCopy(recording, name) {
    if (!recording || copyExporting || typeof window.ludone?.exportRecordingCopy !== "function") return;
    if (name.trim().length > MAX_UPLOAD_NAME_UTF16_UNITS) {
      setExportError("Název je příliš dlouhý. Zkraťte ho.");
      return;
    }
    const operation = {
      clientRecordingId: recording.clientRecordingId,
      generation: ++copyExportGeneration.current,
      lifecycle: copyExportLifecycle.current,
      authGeneration: uploadAuthGeneration.current,
    };
    copyExportOperation.current = operation;
    setCopyExporting(true);
    setCopyExportNotice(null);
    const isCurrent = () => cardMounted.current
      && copyExportOperation.current === operation
      && copyExportGeneration.current === operation.generation
      && copyExportLifecycle.current === operation.lifecycle
      && uploadAuthGeneration.current === operation.authGeneration
      && savedRecordingRef.current?.clientRecordingId === operation.clientRecordingId;
    try {
      const result = await window.ludone.exportRecordingCopy(recording.clientRecordingId, {
        recordingName: name,
      });
      if (isCurrent()) {
        if (!result?.ok) throw new Error(result?.message || "Export kopie se nepodařil");
        setCopyExportNotice({
          clientRecordingId: recording.clientRecordingId,
          text: `Kopie ${result.fileName} je uložená ve Stažených.`,
        });
      }
    } catch (error) {
      if (isCurrent()) setExportError(describeError(error));
    } finally {
      if (copyExportOperation.current === operation) {
        copyExportOperation.current = null;
        if (cardMounted.current) setCopyExporting(false);
      }
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

  async function deleteStoppedRecording() {
    if (!savedRecording || deleting || typeof window.ludone?.listLocalRecordings !== "function") return;
    setDeleting(true);
    setExportError(null);
    try {
      const snapshot = await window.ludone.listLocalRecordings();
      const item = snapshot?.items?.find((candidate) => candidate.id === savedRecording.clientRecordingId);
      if (item?.uploadLocked) throw new Error("Odesílání už začalo; nahrávku nelze smazat");
      if (item?.state === "odesila") throw new Error("Nahrávka se právě odesílá");
      if (!item?.allowedActions?.delete || !item.fileRevision) {
        throw new Error("Stav nahrávky nelze ověřit; smazání není dostupné");
      }
      const result = await window.ludone.deleteRecording({
        id: item.id, queueRev: item.revision, fileRev: item.fileRevision,
      });
      if (result?.outcome === "cancelled") return;
      if (result?.outcome !== "deleted") {
        setExportError(recordingDeletionFailureMessage(result));
        return;
      }
      setSavedRecording(null);
      setPickerInitial(null);
      setPickerInitialCompanyPromise(null);
      setUploadPreferences(null);
      recordingChoices.current = null;
      setDeleteConfirm(false);
      setNotice({ type: "success", text: "Nahrávka byla smazána z tohoto Macu." });
    } catch (error) {
      setExportError(recordingDeletionFailureMessage(error));
    } finally {
      setDeleting(false);
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
        ? { ...current, systemAudioState: nextState === "live" && !runtime.systemRecorderStarted
          ? "starting" : nextState }
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
    defaultCompanyIdle.current = false;
    const defaultRequest = defaultCompanyRequest.current?.identityKey === verifiedUploadIdentity
      ? defaultCompanyRequest.current : null;
    recordingChoices.current = {
      visibility: recordingVisibility,
      identityKey: verifiedUploadIdentity,
      authGeneration: uploadAuthGeneration.current,
      defaultRequest,
      company: verifiedUploadIdentity && defaultCompany.identityKey === verifiedUploadIdentity
        ? defaultCompany.company : null,
    };
    startInFlight.current = true;
    const operation = { controller: new window.AbortController(), capture: null, committed: false };
    startOperationRef.current = operation;
    stopRequestedDuringStart.current = false;
    setReadyForStop(false);
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
      systemAudioError: null,
      startStep: "checking",
    });
    let capture;
    let runtime;
    let stereoCapture;
    let exportCapture;
    let levelMonitor;
    let sharedAudioContext;

    try {
      capture = await captureAudioSources({ signal: operation.controller.signal });
      operation.capture = capture;
      if (operation.controller.signal.aborted) throw new DOMException("Příprava byla zrušena", "AbortError");
      const options = recorderOptions();
      const hasSystemAudio = Boolean(capture.systemStream && capture.systemTrack);
      const recordingMode = hasSystemAudio ? "two-track" : "microphone-only";
      sharedAudioContext = createSharedAudioContext();
      const { context } = sharedAudioContext;
      // Příprava grafu může čekat na resume() neomezeně dlouho, proto při
      // zrušení zavíráme kontext přímo a nečekáme na dokončení přípravy.
      operation.controller.signal.addEventListener("abort", () => {
        if (context.state !== "closed") void context.close().catch(() => {});
      }, { once: true });
      const audioDependencies = { AudioContext: sharedAudioContext.AudioContext };
      stereoCapture = hasSystemAudio
        ? await createStereoCapture(
          capture.microphoneTrack,
          capture.systemTrack,
          audioDependencies,
        )
        : null;
      if (operation.controller.signal.aborted) throw new DOMException("Příprava byla zrušena", "AbortError");
      exportCapture = stereoCapture
        ?? await createMicrophoneOnlyExportCapture(capture.microphoneTrack, audioDependencies);
      if (operation.controller.signal.aborted) throw new DOMException("Příprava byla zrušena", "AbortError");
      const microphoneRecordingStream = new MediaStream([capture.microphoneTrack]);
      const microphoneRecorder = new MediaRecorder(microphoneRecordingStream, options);
      const systemRecorder = hasSystemAudio
        ? new MediaRecorder(stereoCapture.systemStream, options)
        : null;
      levelMonitor = createAudioLevelMonitor(sharedAudioContext.context);
      levelMonitor.replaceSource("microphone", microphoneRecordingStream);
      if (systemRecorder) levelMonitor.replaceSource("system", stereoCapture.systemStream);
      const exportRecorder = new MediaRecorder(exportCapture.stream, { ...options, audioBitsPerSecond: 96_000 });
      const sources = hasSystemAudio ? ["microphone", "system"] : ["microphone"];
      // Po předání hlavnímu procesu už neexistuje storno rozpracované session.
      // Zrušení proto nabízíme po celou kontrolu zdrojů, před tímto předáním.
      operation.committed = true;
      setSession((current) => ({ ...current, startStep: "starting" }));
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
        systemRecorderStarted: false,
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
      const showRecordingStarted = () => {
        if (runtime.closing || stopRequestedDuringStart.current) return;
        setSession((current) => (current.phase === "recording" ? current : {
          phase: "recording",
          recordingMode,
          startedAt: Date.now(),
          labels: {
            microphone: capture.microphoneTrack.label || "Mikrofon",
            system: capture.systemTrack?.label || null,
          },
          systemAudioState: hasSystemAudio
            ? (runtime.systemAudioLost ? "lost" : (runtime.systemRecorderStarted ? "live" : "starting"))
            : "unavailable",
          systemAudioError: hasSystemAudio ? null : (capture.systemAudioError ?? null),
        }));
      };
      exportRecorder.addEventListener("start", showRecordingStarted, { once: true });
      microphoneRecorder.addEventListener("start", showRecordingStarted, { once: true });
      systemRecorder?.addEventListener("start", () => {
        runtime.systemRecorderStarted = true;
        if (!runtime.closing) setRuntimeSystemAudioState(runtime, runtime.systemAudioLost ? "lost" : "live");
      }, { once: true });
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
      setReadyForStop(true);
    } catch (error) {
      if (runtime) {
        await finishRuntime(runtime, error);
      } else {
        if (capture) stopStreams(capture.streams);
        levelMonitor?.dispose();
        if (exportCapture || stereoCapture) await (exportCapture ?? stereoCapture).close().catch(() => {});
        else if (sharedAudioContext && sharedAudioContext.context.state !== "closed") {
          await sharedAudioContext.context.close().catch(() => {});
        }
        if (operation.controller.signal.aborted) return;
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
      if (startOperationRef.current === operation) {
        startOperationRef.current = null;
        stopRequestedDuringStart.current = false;
        startInFlight.current = false;
      }
    }
  }

  function cancelRecordingCheck() {
    const operation = startOperationRef.current;
    if (!operation || operation.committed) return;
    operation.controller.abort();
    if (operation.capture) stopStreams(operation.capture.streams);
    startOperationRef.current = null;
    startInFlight.current = false;
    stopRequestedDuringStart.current = false;
    setSession({
      phase: "idle",
      recordingMode: null,
      startedAt: null,
      labels: null,
      systemAudioState: "inactive",
    });
  }

  function stop() {
    const runtime = runtimeRef.current;
    if (startInFlight.current && (!runtime || !runtime.readyForStop)) {
      stopRequestedDuringStart.current = true;
      return;
    }
    if (runtime && !runtime.closing) void finishRuntime(runtime);
  }

  useImperativeHandle(ref, () => ({ start, stop }));

  useEffect(() => {
    cardMounted.current = true;
    return () => {
      cardMounted.current = false;
      copyExportLifecycle.current += 1;
      const operation = startOperationRef.current;
      if (operation && !operation.committed) {
        operation.controller.abort();
        if (operation.capture) stopStreams(operation.capture.streams);
      }
      const runtime = runtimeRef.current;
      runtime?.recoveryController?.abort();
      runtime?.cleanupTrackListeners?.();
      runtime?.levelMonitor?.dispose();
    };
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
        starting: `${label}: spouští se`,
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
      phase: session.phase,
      pendingSave: savedRecording !== null,
      readyForStop,
      startedAt: session.startedAt,
      systemAudioState: session.systemAudioState,
    });
  }, [onActivityChange, readyForStop, savedRecording, session.phase, session.systemAudioState, session.startedAt]);

  const statusLabel = {
    idle: "Připraveno",
    checking: "Kontrola",
    stopping: "Ukládám",
  }[session.phase];
  const savedMetadata = savedRecording ? savedRecordingMetadata(savedRecording, savedAgeNow) : null;
  const visibleDefaultCompany = canSend && verifiedUploadIdentity && defaultCompany.identityKey === verifiedUploadIdentity
    ? defaultCompany : { state: canSend && !uploadIdentityError ? "loading" : "unavailable", company: null };
  const companyLabel = visibleDefaultCompany.state === "ready" ? `Cílová firma: ${visibleDefaultCompany.company.companyName}`
    : visibleDefaultCompany.state === "empty" ? "Firma není vybraná"
      : visibleDefaultCompany.state === "loading" ? "Ověřuji cílovou firmu…" : "Firmu nelze ověřit";
  const sendDisabledReason = exporting ? "Probíhá ukládání nahrávky."
    : !canSend ? "Přihlášení není dostupné. Obnov ho v Nastavení."
      : typeof window.ludone?.listUploadCompanies === "function" && !verifiedUploadIdentity
        ? (uploadIdentityError || "Ověřuji přihlášení pro odeslání.")
        : typeof window.ludone?.listUploadCompanies === "function" && !uploadPreferences
          ? (uploadPreferencesReason || "Ověřuji cílovou firmu.") : null;

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
            void exportSavedRecording(savedRecording, recordingName, "send", true);
          }}
        >
          <div role="status" aria-live="polite">
            <p className="eyebrow recording-saved__stopped">
              {savedMetadata.stale ? "Nahrávka čeká na odeslání" : "Zvuk bezpečně zastaven"}
            </p>
            <h2>Kam s nahrávkou?</h2>
            <span className="sr-only">Nahrávka uložena</span>
          </div>
          <div className="recording-saved__meta">
            <small>{savedMetadata.interval}</small>
            <div className="recording-saved__format"><ArchiveIcon /> Jedna nahrávka schůzky · stereo WebM/Opus</div>
            <small>{savedMetadata.summary}</small>
          </div>
          <label htmlFor="recording-name">Název nahrávky</label>
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
              copyExportGeneration.current += 1;
              setExportError(null);
              setCopyExportNotice(null);
            }}
          />
          {typeof window.ludone?.listUploadCompanies === "function" && pickerOwner && <div hidden={!canSend || verifiedUploadIdentity !== pickerOwner.key}>
            <RecordingUploadPreferences key={`${savedRecording.clientRecordingId}:${pickerOwner.serial}`}
              identityKey={pickerOwner.key} defaultVisibility="company"
              disabled={!canSend || verifiedUploadIdentity !== pickerOwner.key || autoResolvingCompany} busy={exporting}
              initialValue={pickerInitial} initialCompanyPromise={pickerInitialCompanyPromise} refreshToken={pickerRefresh}
              onStatusChange={setUploadPreferencesReason}
              onChange={(value) => setUploadPreferences(value)} />
          </div>}
          {typeof window.ludone?.listUploadCompanies === "function" && (!canSend || !verifiedUploadIdentity)
            && (uploadIdentityError ? <>
              <p role="alert">{uploadIdentityError}</p>
              <button type="button" className="button button--small" disabled={!canSend} onClick={refreshUploadIdentity}>Zkusit znovu</button>
            </> : <p role="status">Ověřuji účet pro výběr cílové firmy.</p>)}
          <small id="recording-name-hint" className="recording-saved__hint">
            Nahrávka už je místně zachovaná. Odesílání začne jen tvou volbou.
          </small>
          {copyExportNotice?.clientRecordingId === savedRecording.clientRecordingId && (
            <p className="recording-saved__hint" data-testid="recording-copy-export-status" role="status">
              {copyExportNotice.text}
            </p>
          )}
          {deleteConfirm && (
            <div role="alertdialog" aria-label="Potvrdit smazání">
              <p>Opravdu smazat? Nahrávka se smaže z tohoto Macu a nejde vrátit.</p>
              <button type="button" className="button button--small recording-action--delete"
                data-testid="confirm-delete-recording" disabled={deleting} onClick={() => void deleteStoppedRecording()}>Smazat nahrávku</button>
              <button type="button" className="button button--small" disabled={deleting}
                onClick={() => setDeleteConfirm(false)}>Zrušit</button>
            </div>
          )}
          {!canSend && <p className="recording-saved__hint">Před odesláním obnov přihlášení. Na Macu lze nahrávku nechat i bez něj.</p>}
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
            <div className="recording-saved__actions">
              <button
                type="submit"
                className="button button--primary button--wide"
                disabled={Boolean(sendDisabledReason)}
                aria-describedby={sendDisabledReason ? "recording-send-disabled-reason" : undefined}
              >
                Uložit a odeslat
              </button>
              {sendDisabledReason && <p id="recording-send-disabled-reason" className="recording-saved__hint" role="status">{sendDisabledReason}</p>}
              <button
                type="button"
                className="button button--wide recording-saved__skip"
                data-testid="skip-recording-name"
                disabled={exporting}
                onClick={() => exportSavedRecording(savedRecording, recordingName, "keep", true)}
              >
                Nechat na Macu
              </button>
              {typeof window.ludone?.exportRecordingCopy === "function" && (
                <button type="button" className="button button--wide recording-action--copy"
                  data-testid="export-recording-copy" disabled={copyExporting}
                  onClick={() => void exportSavedRecordingCopy(savedRecording, recordingName)}>
                  Exportovat kopii…
                </button>
              )}
              <button type="button" className="button button--wide recording-action--delete"
                data-testid="delete-recording" disabled={exporting || deleting || typeof window.ludone?.deleteRecording !== "function"}
                onClick={() => setDeleteConfirm(true)}>Smazat nahrávku</button>
            </div>
          )}
        </form>
      ) : session.phase === "idle" ? (
        <>
          <span className="idle-feature-row__icon"><MicIcon variant="idle" /></span>
          <span className="idle-feature-row__copy">
            <strong>Připraveno k nahrávání</strong>
            {notice ? (
              <small
                className={`idle-feature-row__notice idle-feature-row__notice--${notice.type}`}
                role={notice.type === "error" ? "alert" : "status"}
              >
                {notice.text}
                {notice.openRecordings && (
                  <button type="button" className="recording-notice__next"
                    onClick={() => window.ludone.openSettings("recordingQueue")}>
                    Otevřít nahrávky
                  </button>
                )}
              </small>
            ) : todaySummary ? (
              <small data-testid="recording-daily-summary">{todaySummary}</small>
            ) : (
              <span className="osa-source-plan"><span><OsaIcon name="record" size={18} /> Mikrofon</span><span><OsaIcon name="sound" size={18} /> Zvuk schůzky</span></span>
            )}
          </span>
          <div className="recording-card__visibility" role="group" aria-label="Přístup k nové nahrávce">
            {[{ value: "private", label: "Soukromá" }, { value: "company", label: "Firemní" }].map(({ value, label }) => (
              <button key={value} type="button" data-testid={`recording-visibility-${value}`}
                aria-pressed={recordingVisibility === value}
                onClick={() => {
                  setRecordingVisibility(value);
                  setVisibilityStored(persistRecordingVisibilityPreference(value));
                }}>{label}</button>
            ))}
          </div>
          {!visibilityStored && <small className="recording-card__preference-warning" role="status">Volbu se na tomto Macu nepodařilo zapamatovat.</small>}
          <div className="recording-card__company" data-testid="recording-default-company">
            <span>{companyLabel}</span>
            <button type="button" data-testid="recording-default-company-change"
              onClick={() => window.ludone.openSettings("account")}>
              {visibleDefaultCompany.state === "empty" ? "Vybrat" : "Změnit"}
            </button>
          </div>
          <button
            type="button"
            className="idle-feature-row__action"
            aria-label="Spustit nahrávání"
            onClick={() => start()}
          >
            <span aria-hidden="true"><OsaIcon name="start" size={16} /> Nahrávat schůzku</span>
            <span className="sr-only">Spustit nahrávání</span>
          </button>
          <div className="recording-card__idle-footer">
            <button type="button" className="osa-audio-check" onClick={onOpenSources} disabled={typeof onOpenSources !== "function"}><OsaIcon name="sound" size={18} /> Zkouška zvuku</button>
            <button
              type="button"
              className="recording-card__sources"
              onClick={onOpenSources}
              aria-label="Zdroje zvuku"
              title="Otevřít nastavení zvuku"
              disabled={typeof onOpenSources !== "function"}
            >
              <SettingsIcon />
            </button>
          </div>
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
        <div className="recording-progress">
          <div role="status" aria-live="polite">
            <p><span className="recording-progress__spinner" aria-hidden="true" /> {session.startStep === "starting" ? "Spouštím nahrávání…" : "Připravuji nahrávání…"}</p>
            <small>{session.startStep === "starting" ? "Zvuk je připravený, spouštím záznam." : "Ověřuji mikrofon a zvuk z počítače."}</small>
          </div>
          {session.startStep !== "starting" && (
            <button type="button" className="button button--small recording-progress__cancel"
              data-testid="cancel-recording-check" onClick={cancelRecordingCheck}>Zrušit</button>
          )}
        </div>
      )}

      {isRecording && (
        <div className="recording-running">
          {/* Odečítač dostává stav „Nahrává se“ a názvy obou zdrojů níže.
              AudioLevelMeter je dekorativní (aria-hidden). Samostatné potvrzení
              stop vynecháváme: jejich přítomnost nedokládá ověření zvuku. */}
          <div className="recording-running__statusline">
            <div
              className={`activity-status activity-status--recording${systemAudioLost || microphoneOnly ? " is-degraded" : ""}`}
              data-testid="recording-running-state"
              role="status"
            >
              <span className="activity-status__dot" aria-hidden="true" />
              <span>{systemAudioLost || microphoneOnly ? "Nahrává se omezeně" : "Nahrává se"}</span>
            </div>
            <button
              type="button"
              className="recording-running__sources"
              data-testid="recording-open-sources"
              onClick={onOpenSources}
              disabled={typeof onOpenSources !== "function"}
            >
              <SettingsIcon />
              Zdroje
            </button>
          </div>
          <p className="recording-running__title">Nahrávání schůzky</p>
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
            <span className="recording-source__label">
              <MicIcon />
              <span>Mikrofon</span>
            </span>
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
            <span className="recording-source__label">
              <VolumeIcon />
              <span>Ostatní zvuk</span>
            </span>
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
          <p className="recording-running__format">Výsledkem bude jedna stereo nahrávka.</p>
          {systemAudioStarting && <p role="status">Spouštím zvuk z počítače…</p>}
          {microphoneOnly && (
            <div className="recording-mode-note" role="status" aria-atomic="true">
              {RECORDING_MICROPHONE_ONLY_TEXT} {microphoneOnlyNote}
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
                  disabled={!readyForStop}
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
              disabled={!readyForStop}
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
});
