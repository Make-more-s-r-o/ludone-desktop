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
    destination.channelCount = 2;
    destination.channelCountMode = "explicit";
    destination.channelInterpretation = "speakers";

    microphoneSource.connect(merger, 0, 0);
    systemSource.connect(merger, 0, 1);
    merger.connect(destination);

    const outputTracks = destination.stream.getAudioTracks();
    if (outputTracks.length !== 1) {
      throw new Error("Stereo derivát neposkytl právě jednu zvukovou stopu");
    }
    const settings = outputTracks[0].getSettings?.() ?? {};
    if (Number.isFinite(settings.channelCount) && settings.channelCount !== 2) {
      throw new Error(`Stereo derivát má ${settings.channelCount} kanálů místo dvou`);
    }

    let closed = false;
    return {
      stream: destination.stream,
      format: {
        channels: 2,
        sampleRate: Number.isFinite(settings.sampleRate)
          ? settings.sampleRate
          : context.sampleRate,
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
