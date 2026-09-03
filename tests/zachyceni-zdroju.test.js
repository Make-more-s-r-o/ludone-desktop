// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureAudioSources } from "../src/lib/audio-levels.js";

// 🔴 PROČ TENHLE SOUBOR VZNIKL: `captureAudioSources()` rozhoduje, jestli se vůbec bude
// nahrávat — a do 3. 9. 2026 ho nespouštěl ani jeden test. Sabotáž „odmítnutý mikrofon
// už nepadá" tehdy prošla ZELENĚ, ačkoli by v produkci znamenala nahrávku bez zvuku,
// o které se uživatel dozví až z prázdného souboru.

function stopaAudio() {
  return {
    kind: "audio", readyState: "live", enabled: true,
    stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  };
}

function proud(stopy) {
  return {
    getAudioTracks: () => stopy,
    getVideoTracks: () => [],
    getTracks: () => stopy,
  };
}

function nastavZarizeni({ mikrofon, system }) {
  const puvodni = globalThis.navigator;
  const mediaDevices = {
    getUserMedia: mikrofon === null
      ? vi.fn().mockRejectedValue(new Error("Uživatel mikrofon odmítl"))
      : vi.fn().mockResolvedValue(mikrofon),
    getDisplayMedia: system === null
      ? vi.fn().mockRejectedValue(new Error("Uživatel záznam obrazovky odmítl"))
      : vi.fn().mockResolvedValue(system),
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { ...(puvodni ?? {}), mediaDevices },
  });
  // Bez zabezpečeného kontextu funkce spadne dřív, než se ke zdrojům vůbec dostane —
  // a její hláška obsahuje slovo „mikrofon", takže by test na odmítnutý mikrofon prošel
  // ZE ŠPATNÉHO DŮVODU. Zjištěno při psaní: první pokus byl zelený právě takhle.
  Object.defineProperty(globalThis.window, "isSecureContext", { configurable: true, value: true });
  return () => {
    if (puvodni === undefined) delete globalThis.navigator;
    else Object.defineProperty(globalThis, "navigator", { configurable: true, value: puvodni });
  };
}

let uklid = () => {};
afterEach(() => {
  uklid();
  uklid = () => {};
});

describe("zachycení zvukových zdrojů", () => {
  it("bez mikrofonu nahrávat NELZE — musí spadnout", async () => {
    // Mikrofon je jediný povinný zdroj. Kdyby jeho odmítnutí propadlo, uživatel by
    // spustil nahrávání, aplikace by tvářila, že běží, a nahrála by prázdno.
    uklid = nastavZarizeni({ mikrofon: null, system: proud([stopaAudio()]) });
    await expect(captureAudioSources()).rejects.toThrow(/Uživatel mikrofon odmítl/);
  });

  it("bez systémového zvuku nahrávání POKRAČUJE jednostopě", async () => {
    // Schválený návrh: „Můžeš povolit jen mikrofon. […] nahrávka bude jednostopá."
    const mikrofonniStopa = stopaAudio();
    uklid = nastavZarizeni({ mikrofon: proud([mikrofonniStopa]), system: null });

    const vysledek = await captureAudioSources();

    expect(vysledek.microphoneTrack, "mikrofonní stopa musí být k dispozici").toBe(mikrofonniStopa);
    expect(vysledek.systemTrack, "systémová stopa nesmí být předstíraná").toBeFalsy();
    expect(vysledek.systemAudioError, "důvod chybějícího systémového zvuku se nesmí ztratit")
      .toBeTruthy();
  });

  it("s oběma zdroji vrátí obě stopy", async () => {
    const mikrofonniStopa = stopaAudio();
    const systemovaStopa = stopaAudio();
    uklid = nastavZarizeni({
      mikrofon: proud([mikrofonniStopa]),
      system: proud([systemovaStopa]),
    });

    const vysledek = await captureAudioSources();

    expect(vysledek.microphoneTrack).toBe(mikrofonniStopa);
    expect(vysledek.systemTrack).toBe(systemovaStopa);
    expect(vysledek.systemAudioError).toBeFalsy();
  });
});
