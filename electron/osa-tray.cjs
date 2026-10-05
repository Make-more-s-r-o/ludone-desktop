// Stav F odvozuje jen main ze skutečných session, finalizace a fronty.
const OSA_TRAY_LABELS = Object.freeze({
  idle: "LuDone · Připraveno", recording: "LuDone · Nahrává se",
  "recording-audio-lost": "LuDone · Nahrává se · výpadek systémového zvuku",
  "recording-microphone-only": "LuDone · Nahrává se · jen mikrofon",
  saving: "LuDone · Ukládá se", decision: "LuDone · Čeká na uložení",
  "signed-out": "LuDone · Přihlásit se", offline: "LuDone · Odesílání čeká na připojení",
  attention: "LuDone · Odesílání vyžaduje pozornost", "queue-waiting": "LuDone · Čeká na odeslání",
});
function deriveOsaTrayState({ recording, systemAudioLost, microphoneOnly, saving, decision, signedIn, offline, attention, queueWaiting }) {
  if (recording && systemAudioLost) return "recording-audio-lost";
  if (recording && microphoneOnly) return "recording-microphone-only";
  if (recording) return "recording";
  if (saving) return "saving";
  if (decision) return "decision";
  if (!signedIn) return "signed-out";
  if (offline && queueWaiting) return "offline";
  if (attention) return "attention";
  if (queueWaiting) return "queue-waiting";
  return "idle";
}
module.exports = { deriveOsaTrayState, OSA_TRAY_LABELS };
