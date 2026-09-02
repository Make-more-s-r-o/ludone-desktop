/**
 * Sestaví živý stereo derivát na jediné časové ose Web Audio.
 * Mikrofon je výhradně vstup 0 (levý), systémový zvuk vstup 1 (pravý).
 *
 * @param {MediaStreamTrack} microphoneTrack
 * @param {MediaStreamTrack} systemTrack
 * @param {{ AudioContext?: typeof AudioContext, MediaStream?: typeof MediaStream }} [dependencies]
 */
export async function createStereoCapture(
  microphoneTrack,
  systemTrack,
  dependencies = {},
) {
  const browserGlobals = /** @type {typeof globalThis & {
    webkitAudioContext?: typeof AudioContext,
  }} */ (globalThis);
  const AudioContextConstructor = dependencies.AudioContext
    ?? browserGlobals.AudioContext
    ?? browserGlobals.webkitAudioContext;
  const MediaStreamConstructor = dependencies.MediaStream ?? browserGlobals.MediaStream;
  if (!AudioContextConstructor || !MediaStreamConstructor) {
    throw new Error("Pro dvoukanálový export není dostupné Web Audio");
  }

  const context = new AudioContextConstructor();
  let microphoneSource;
  let systemSource;
  let merger;
  let systemDestination;
  try {
    if (context.state === "suspended") await context.resume();
    microphoneSource = context.createMediaStreamSource(
      new MediaStreamConstructor([microphoneTrack]),
    );
    systemSource = context.createMediaStreamSource(
      new MediaStreamConstructor([systemTrack]),
    );
    merger = context.createChannelMerger(2);
    const destination = context.createMediaStreamDestination();
    systemDestination = context.createMediaStreamDestination();
    destination.channelCount = 2;
    destination.channelCountMode = "explicit";
    destination.channelInterpretation = "speakers";
    systemDestination.channelCount = 2;
    systemDestination.channelCountMode = "explicit";
    systemDestination.channelInterpretation = "speakers";

    microphoneSource.connect(merger, 0, 0);
    systemSource.connect(merger, 0, 1);
    systemSource.connect(systemDestination);
    merger.connect(destination);

    const outputTracks = destination.stream.getAudioTracks();
    if (outputTracks.length !== 1) {
      throw new Error("Stereo derivát neposkytl právě jednu zvukovou stopu");
    }
    const settings = outputTracks[0].getSettings?.() ?? {};
    if (Number.isFinite(settings.channelCount) && settings.channelCount !== 2) {
      throw new Error(`Stereo derivát má ${settings.channelCount} kanálů místo dvou`);
    }
    if (systemDestination.stream.getAudioTracks().length !== 1) {
      throw new Error("Stabilní systémová větev neposkytla právě jednu zvukovou stopu");
    }

    let closed = false;
    return {
      stream: destination.stream,
      // MediaRecorder této stopy zůstává po celou session stejný. Když fyzická
      // systémová stopa skončí, destination dál zapisuje ticho a lze ji přepojit.
      systemStream: systemDestination.stream,
      format: {
        channels: 2,
        sampleRate: Number.isFinite(settings.sampleRate)
          ? settings.sampleRate
          : context.sampleRate,
      },
      async replaceSystemTrack(nextTrack) {
        if (closed) throw new Error("Zvukovou větev po uzavření nelze obnovit");
        if (
          nextTrack?.kind !== "audio"
          || nextTrack.readyState !== "live"
          || !nextTrack.enabled
          || nextTrack.muted
        ) {
          throw new Error("Nová systémová stopa není živá a dostupná");
        }
        if (context.state === "suspended") await context.resume();
        if (closed) throw new Error("Zvukovou větev po uzavření nelze obnovit");

        const nextSource = context.createMediaStreamSource(
          new MediaStreamConstructor([nextTrack]),
        );
        try {
          nextSource.connect(merger, 0, 1);
          nextSource.connect(systemDestination);
        } catch (error) {
          nextSource.disconnect();
          throw error;
        }
        const previousSource = systemSource;
        systemSource = nextSource;
        previousSource.disconnect();
      },
      async close() {
        if (closed) return;
        closed = true;
        microphoneSource.disconnect();
        systemSource.disconnect();
        merger.disconnect();
        await context.close();
      },
    };
  } catch (error) {
    microphoneSource?.disconnect();
    systemSource?.disconnect();
    merger?.disconnect();
    await context.close().catch(() => {});
    throw error;
  }
}
