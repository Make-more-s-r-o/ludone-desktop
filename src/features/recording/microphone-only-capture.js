/**
 * Připraví exportní obal jednostopé nahrávky na stejném dvoukanálovém kontraktu
 * jako běžný export. Mikrofon vede výhradně vlevo; nezapojený pravý vstup je
 * digitální ticho. Nevzniká tím druhá původní stopa ani domnělý druhý mluvčí.
 *
 * @param {MediaStreamTrack} microphoneTrack
 * @param {{ AudioContext?: typeof AudioContext, MediaStream?: typeof MediaStream }} [dependencies]
 */
export async function createMicrophoneOnlyExportCapture(
  microphoneTrack,
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
    throw new Error("Pro export jednostopé nahrávky není dostupné Web Audio");
  }

  const context = new AudioContextConstructor();
  let microphoneSource;
  let merger;
  try {
    if (context.state === "suspended") await context.resume();
    microphoneSource = context.createMediaStreamSource(
      new MediaStreamConstructor([microphoneTrack]),
    );
    merger = context.createChannelMerger(2);
    const destination = context.createMediaStreamDestination();
    destination.channelCount = 2;
    destination.channelCountMode = "explicit";
    destination.channelInterpretation = "speakers";

    // Vstup 1 zůstává úmyslně nezapojený. Duplikovat mikrofon doprava by
    // předstíralo druhou stranu a zničilo význam zavedeného mapování kanálů.
    microphoneSource.connect(merger, 0, 0);
    merger.connect(destination);

    const outputTracks = destination.stream.getAudioTracks();
    if (outputTracks.length !== 1) {
      throw new Error("Jednostopý exportní obal neposkytl právě jednu zvukovou stopu");
    }
    const settings = outputTracks[0].getSettings?.() ?? {};
    if (Number.isFinite(settings.channelCount) && settings.channelCount !== 2) {
      throw new Error(`Jednostopý exportní obal má ${settings.channelCount} kanálů místo dvou`);
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
        merger.disconnect();
        await context.close();
      },
    };
  } catch (error) {
    microphoneSource?.disconnect();
    merger?.disconnect();
    await context.close().catch(() => {});
    throw error;
  }
}
