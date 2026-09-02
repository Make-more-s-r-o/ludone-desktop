/**
 * Kontrakt výpadku systémové stopy:
 * - `ended` je definitivní konec a hlásí se okamžitě;
 * - `mute` musí trvat souvisle dvě sekundy.
 *
 * Dvě sekundy odpovídají toleranci při úvodním ověření stopy v `audio-levels.js`.
 * Odfiltrují krátké přepnutí audio cesty, ale skutečný výpadek zůstane vidět
 * nejpozději do dvou sekund. Běžné ticho ve zvuku se tu vůbec nevyhodnocuje.
 */
export const SYSTEM_AUDIO_MUTE_GRACE_MS = 2_000;

/**
 * @param {MediaStreamTrack} track
 * @param {{
 *   onLost: (reason: "ended" | "muted") => void,
 *   onRecovered: () => void,
 * }} callbacks
 */
export function watchSystemAudioTrack(track, { onLost, onRecovered }) {
  let disposed = false;
  let lost = false;
  let muteTimeoutId = null;

  const clearMuteTimeout = () => {
    if (muteTimeoutId === null) return;
    window.clearTimeout(muteTimeoutId);
    muteTimeoutId = null;
  };

  const markLost = (reason) => {
    if (disposed || lost) return;
    lost = true;
    onLost(reason);
  };

  const handleEnded = () => {
    clearMuteTimeout();
    markLost("ended");
  };

  const handleMute = () => {
    if (track.readyState === "ended") {
      handleEnded();
      return;
    }
    // Opakovaný `mute` během stejného souvislého výpadku nesmí práh posunout.
    if (lost || muteTimeoutId !== null) return;
    muteTimeoutId = window.setTimeout(() => {
      muteTimeoutId = null;
      if (track.readyState === "ended") markLost("ended");
      else if (track.muted) markLost("muted");
    }, SYSTEM_AUDIO_MUTE_GRACE_MS);
  };

  const handleUnmute = () => {
    if (disposed || track.readyState !== "live" || track.muted) return;
    clearMuteTimeout();
    if (!lost) return;
    lost = false;
    onRecovered();
  };

  track.addEventListener("ended", handleEnded);
  track.addEventListener("mute", handleMute);
  track.addEventListener("unmute", handleUnmute);

  if (track.readyState === "ended") handleEnded();
  else if (track.muted) handleMute();

  return () => {
    disposed = true;
    clearMuteTimeout();
    track.removeEventListener("ended", handleEnded);
    track.removeEventListener("mute", handleMute);
    track.removeEventListener("unmute", handleUnmute);
  };
}
