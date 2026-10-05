export async function installSyntheticAudioCapture(client, { microphoneOnly = false } = {}) {
  const installed = await client.evaluate(`(() => {
    const devices = navigator.mediaDevices;
    if (!devices || typeof AudioContext !== 'function' || typeof MediaStream !== 'function') return false;
    const sources = [];
    function toneStream(frequency, withVideo) {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.05;
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();
      const tracks = [...destination.stream.getAudioTracks()];
      if (withVideo) {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        tracks.push(...canvas.captureStream(1).getVideoTracks());
      }
      sources.push({ context, oscillator, tracks, withVideo });
      return new MediaStream(tracks);
    }
    Object.defineProperty(devices, 'getUserMedia', {
      configurable: true,
      value: async (constraints) => {
        if (!constraints?.audio || constraints.video !== false) {
          throw new TypeError('E2E očekávalo jen syntetický mikrofon.');
        }
        return toneStream(440, false);
      },
    });
    Object.defineProperty(devices, 'getDisplayMedia', {
      configurable: true,
      value: async (constraints) => {
        if (constraints?.audio !== true || constraints.video !== true) {
          throw new TypeError('E2E očekávalo syntetický systémový zvuk.');
        }
        if (${JSON.stringify(microphoneOnly)}) throw new DOMException('Syntetický systémový kanál není dostupný', 'NotAllowedError');
        return toneStream(880, true);
      },
    });
    window.__ludoneE2ESyntheticAudio = {
      sourceCount: () => sources.length,
      loseSystemTrack: () => {
        const source = sources.find((item) => item.withVideo);
        const track = source?.tracks.find((item) => item.kind === 'audio');
        if (!track) return false;
        track.stop();
        // MediaStreamTrack.stop() sám událost ended nevyvolává. Fixtura
        // výslovně simuluje stejnou událost jako odebraný systémový zdroj OS.
        track.dispatchEvent(new Event('ended'));
        return true;
      },
      close: async () => {
        for (const source of sources) {
          try { source.oscillator.stop(); } catch { /* Může už být ukončená. */ }
          await source.context.close().catch(() => {});
        }
      },
    };
    return true;
  })()`);
  if (!installed) throw new Error("Nepodařilo se připravit syntetický, lokální zvukový zdroj.");
}

