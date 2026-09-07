import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const STAVY = [
  "signed-out",
  "idle",
  "recording",
  "tracking",
  "recording-tracking",
  "queue-waiting",
  "recording-audio-lost",
  "recording-microphone-only",
];
const MOTIVY = ["dark", "light"];
const VARIANTY = ["", "@2x"];
const PNG_PODPIS = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const KOREN_REPA = fileURLToPath(new URL("../", import.meta.url));
const ADRESAR_IKON = path.join(KOREN_REPA, "electron", "ikony");
const GENERATOR = path.join(KOREN_REPA, "scripts", "tray-ikony.mjs");
const GENERATOR_SOURCE = readFileSync(GENERATOR, "utf8");

const BARVY = {
  dark: {
    "signed-out": [0x77, 0x7c, 0x84],
    idle: [0xe4, 0xe6, 0xea],
    recording: [0xf9, 0x8b, 0x71],
    tracking: [0x5c, 0xce, 0xb7],
    wait: [0xed, 0xb1, 0x54],
    lista: [0x04, 0x06, 0x09],
  },
  light: {
    "signed-out": [0x86, 0x8b, 0x93],
    idle: [0x1c, 0x20, 0x2a],
    recording: [0xa8, 0x38, 0x25],
    tracking: [0x00, 0x69, 0x58],
    wait: [0x94, 0x5a, 0x00],
    lista: [0xe6, 0xe4, 0xe1],
  },
};

const NAVRHOVE_OKLCH = [
  "oklch(0.585 0.014 262)",
  "oklch(0.925 0.005 262)",
  "oklch(0.75 0.14 34)",
  "oklch(0.78 0.11 178)",
  "oklch(0.8 0.13 76)",
  "oklch(0.12 0.01 262)",
  "oklch(0.635 0.013 260)",
  "oklch(0.245 0.019 266)",
  "oklch(0.5 0.15 32)",
  "oklch(0.46 0.1 178)",
  "oklch(0.52 0.12 70)",
  "oklch(0.92 0.005 85)",
];

function cestaIkony(adresar, motiv, stav, varianta = "") {
  return path.join(adresar, `${motiv}-${stav}${varianta}.png`);
}

function rozmeryPng(soubor) {
  const obsah = readFileSync(soubor);
  expect(obsah.subarray(12, 16).toString("ascii"), `${soubor} nemá IHDR na prvním místě`)
    .toBe("IHDR");
  return {
    width: obsah.readUInt32BE(16),
    height: obsah.readUInt32BE(20),
  };
}

function dekodujPng(soubor) {
  const obsah = readFileSync(soubor);
  let offset = PNG_PODPIS.length;
  let width;
  let height;
  const idat = [];

  while (offset < obsah.length) {
    const delka = obsah.readUInt32BE(offset);
    const typ = obsah.subarray(offset + 4, offset + 8).toString("ascii");
    const data = obsah.subarray(offset + 8, offset + 8 + delka);
    if (typ === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    }
    if (typ === "IDAT") idat.push(data);
    offset += 12 + delka;
  }

  if (!width || !height || idat.length === 0) throw new Error(`Neúplný PNG ${soubor}`);
  const raw = inflateSync(Buffer.concat(idat));
  const radek = 1 + width * 4;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const zacatek = y * radek;
    if (raw[zacatek] !== 0) throw new Error(`PNG ${soubor} nepoužívá filtr 0`);
    raw.copy(rgba, y * width * 4, zacatek + 1, zacatek + radek);
  }

  return {
    height,
    rgba,
    width,
    pixel(x, y) {
      const start = (y * width + x) * 4;
      return [...rgba.subarray(start, start + 4)];
    },
  };
}

function obsahujeBarvu(obrazek, barva) {
  for (let offset = 0; offset < obrazek.rgba.length; offset += 4) {
    if (
      obrazek.rgba[offset + 3] > 0
      && obrazek.rgba[offset] === barva[0]
      && obrazek.rgba[offset + 1] === barva[1]
      && obrazek.rgba[offset + 2] === barva[2]
    ) return true;
  }
  return false;
}

function barevnaVzdalenost(pixel, barva) {
  return Math.hypot(
    pixel[0] - barva[0],
    pixel[1] - barva[1],
    pixel[2] - barva[2],
  );
}

function hash(soubor) {
  return createHash("sha256").update(readFileSync(soubor)).digest("hex");
}

function hashAlfy(soubor) {
  const { rgba } = dekodujPng(soubor);
  const alfa = Buffer.alloc(rgba.length / 4);
  for (let index = 0; index < alfa.length; index += 1) alfa[index] = rgba[index * 4 + 3];
  return createHash("sha256").update(alfa).digest("hex");
}

function alfa(soubor) {
  const { rgba } = dekodujPng(soubor);
  return Buffer.from(rgba.filter((_hodnota, index) => index % 4 === 3));
}

describe("ikony v liště", () => {
  it("adresář obsahuje právě třicet dva očekávaných PNG s platným podpisem", () => {
    const ocekavane = MOTIVY.flatMap((motiv) => STAVY.flatMap((stav) => (
      VARIANTY.map((varianta) => `${motiv}-${stav}${varianta}.png`)
    ))).sort();
    const skutecne = readdirSync(ADRESAR_IKON).filter((nazev) => nazev.endsWith(".png")).sort();
    expect(skutecne).toEqual(ocekavane);

    for (const motiv of MOTIVY) {
      for (const stav of STAVY) {
        for (const varianta of VARIANTY) {
          const soubor = cestaIkony(ADRESAR_IKON, motiv, stav, varianta);
          expect(existsSync(soubor), `Chybí ${path.basename(soubor)}`).toBe(true);
          expect(readFileSync(soubor).subarray(0, PNG_PODPIS.length)).toEqual(PNG_PODPIS);
        }
      }
    }
  });

  it("každá @2x varianta má přesně dvojnásobné rozměry z IHDR", () => {
    for (const motiv of MOTIVY) {
      for (const stav of STAVY) {
        const zaklad = rozmeryPng(cestaIkony(ADRESAR_IKON, motiv, stav));
        const retina = rozmeryPng(cestaIkony(ADRESAR_IKON, motiv, stav, "@2x"));
        expect(zaklad, `${motiv}-${stav} nemá rozměr 18 × 18`).toEqual({
          width: 18,
          height: 18,
        });
        expect(retina, `${motiv}-${stav}@2x nemá dvojnásobné rozměry`).toEqual({
          width: 36,
          height: 36,
        });
      }
    }
  });

  it("v každém motivu a rozlišení má všech osm stavů jiný obraz", () => {
    for (const motiv of MOTIVY) {
      for (const varianta of VARIANTY) {
        const hashe = STAVY.map((stav) => (
          hash(cestaIkony(ADRESAR_IKON, motiv, stav, varianta))
        ));
        expect(new Set(hashe).size, `Stavy ${motiv} ${varianta || "1x"} nejsou odlišné`)
          .toBe(STAVY.length);

        const hasheAlfy = STAVY.map((stav) => (
          hashAlfy(cestaIkony(ADRESAR_IKON, motiv, stav, varianta))
        ));
        expect(
          new Set(hasheAlfy).size,
          `Stavy ${motiv} ${varianta || "1x"} závisejí jen na barvě`,
        ).toBe(STAVY.length);
      }
    }
  });

  it("šablonové stavy mají neprázdnou, částečně průhlednou a na motivu nezávislou alfu", () => {
    for (const stav of STAVY) {
      for (const varianta of VARIANTY) {
        const tmava = alfa(cestaIkony(ADRESAR_IKON, "dark", stav, varianta));
        const svetla = alfa(cestaIkony(ADRESAR_IKON, "light", stav, varianta));
        expect(tmava.equals(svetla), `${stav}${varianta} mění alfa masku podle motivu`)
          .toBe(true);
        expect(tmava.some((hodnota) => hodnota > 0), `${stav}${varianta} má prázdnou alfu`)
          .toBe(true);
        expect(tmava.some((hodnota) => hodnota === 0), `${stav}${varianta} nemá průhledné okolí`)
          .toBe(true);
      }
    }
  });

  it("jednostopé nahrávání má tichý půlodznak odlišný od plného nahrávání i výpadku", () => {
    for (const motiv of MOTIVY) {
      for (const varianta of VARIANTY) {
        const soubor = cestaIkony(ADRESAR_IKON, motiv, "recording-microphone-only", varianta);
        for (const jinyStav of ["recording", "recording-audio-lost"]) {
          expect(hashAlfy(soubor)).not.toBe(hashAlfy(
            cestaIkony(ADRESAR_IKON, motiv, jinyStav, varianta),
          ));
        }
        const obrazek = dekodujPng(soubor);
        expect(obsahujeBarvu(obrazek, BARVY[motiv]["signed-out"])).toBe(true);
      }
      const obrazek = dekodujPng(
        cestaIkony(ADRESAR_IKON, motiv, "recording-microphone-only", "@2x"),
      );
      // Celý pulz jako při nahrávání, odznak vlevo subtle, vpravo průhledný.
      expect(obrazek.pixel(29, 15)[3]).toBeGreaterThan(192);
      expect(obrazek.pixel(26, 27)).toEqual([...BARVY[motiv]["signed-out"], 255]);
      expect(obrazek.pixel(30, 27)[3]).toBe(0);
    }
  });

  it("stavové tvary zachovávají přeškrtnutí, tečku, prstýnek, dvojtečku i přerušený pulz", () => {
    const obrazky = Object.fromEntries(STAVY.map((stav) => [
      stav,
      dekodujPng(cestaIkony(ADRESAR_IKON, "dark", stav, "@2x")),
    ]));
    const kryti = (stav, x, y) => obrazky[stav].pixel(x, y)[3];

    // Přeškrtnutí přidává tah mimo samotný pulz.
    expect(kryti("signed-out", 30, 4)).toBeGreaterThan(128);
    expect(kryti("idle", 30, 4)).toBe(0);
    // Nahrávání má plnou tečku, čas a souběh průhledný střed prstýnku.
    expect(kryti("recording", 28, 27)).toBeGreaterThan(192);
    expect(kryti("tracking", 28, 27)).toBeLessThan(32);
    expect(kryti("recording-tracking", 28, 27)).toBeLessThan(32);
    // Čekající fronta má dvě oddělená plná jádra a průhlednou mezeru.
    expect(kryti("queue-waiting", 26, 27)).toBeGreaterThan(192);
    expect(kryti("queue-waiting", 28, 27)).toBeLessThan(32);
    expect(kryti("queue-waiting", 31, 27)).toBeGreaterThan(192);
    // Při ztrátě zvuku schází poslední úsek pulzu, odznak ale zůstává plný.
    expect(kryti("recording", 29, 15)).toBeGreaterThan(192);
    expect(kryti("recording-audio-lost", 29, 15)).toBe(0);
    expect(kryti("recording-audio-lost", 28, 27)).toBeGreaterThan(192);
  });

  it("používá doslovné OKLCH barvy a převod se propíše do viditelných pixelů", () => {
    for (const hodnota of NAVRHOVE_OKLCH) expect(GENERATOR_SOURCE).toContain(hodnota);

    for (const motiv of MOTIVY) {
      const barvy = BARVY[motiv];
      for (const varianta of VARIANTY) {
        for (const stav of ["signed-out", "idle", "recording", "tracking"]) {
          const obrazek = dekodujPng(cestaIkony(ADRESAR_IKON, motiv, stav, varianta));
          const popis = `${motiv}-${stav}${varianta}`;
          expect(obsahujeBarvu(obrazek, barvy[stav]), `${popis} nemá barvu z návrhu`)
            .toBe(true);
        }
        const soubeh = dekodujPng(
          cestaIkony(ADRESAR_IKON, motiv, "recording-tracking", varianta),
        );
        expect(obsahujeBarvu(soubeh, barvy.recording)).toBe(true);
        expect(obsahujeBarvu(soubeh, barvy.tracking)).toBe(true);
        const fronta = dekodujPng(
          cestaIkony(ADRESAR_IKON, motiv, "queue-waiting", varianta),
        );
        const vypadek = dekodujPng(
          cestaIkony(ADRESAR_IKON, motiv, "recording-audio-lost", varianta),
        );
        expect(obsahujeBarvu(fronta, barvy.wait)).toBe(true);
        expect(obsahujeBarvu(vypadek, barvy.wait)).toBe(true);
        expect(obsahujeBarvu(vypadek, barvy.recording)).toBe(true);
      }
    }
  });

  it("nahrávání i souběh mají vpravo dole odznak s oddělujícím obrysem", () => {
    for (const motiv of MOTIVY) {
      const barvy = BARVY[motiv];
      const idle = dekodujPng(cestaIkony(ADRESAR_IKON, motiv, "idle", "@2x"));
      const recording = dekodujPng(cestaIkony(ADRESAR_IKON, motiv, "recording", "@2x"));
      const tracking = dekodujPng(cestaIkony(ADRESAR_IKON, motiv, "tracking", "@2x"));
      const soubeh = dekodujPng(
        cestaIkony(ADRESAR_IKON, motiv, "recording-tracking", "@2x"),
      );
      const stred = [28, 27];
      const idleStred = idle.pixel(...stred);
      const recordingStred = recording.pixel(...stred);
      const trackingStred = tracking.pixel(...stred);
      const soubehStred = soubeh.pixel(...stred);

      expect(idleStred[3]).toBeLessThan(32);
      expect(recordingStred[3]).toBeGreaterThan(192);
      expect(soubehStred[3]).toBeLessThan(32);
      expect(trackingStred[3]).toBeLessThan(recordingStred[3]);
      expect(obsahujeBarvu(recording, barvy.lista)).toBe(true);
      expect(obsahujeBarvu(soubeh, barvy.lista)).toBe(true);
      expect(obsahujeBarvu(recording, barvy.recording)).toBe(true);
      expect(obsahujeBarvu(soubeh, barvy.tracking)).toBe(true);
      expect(recording.pixel(31, 27)).toEqual([...barvy.recording, 255]);
      expect(soubeh.pixel(31, 27)).toEqual([...barvy.tracking, 255]);
      expect(recording.pixel(33, 27)).toEqual([...barvy.lista, 255]);
      expect(soubeh.pixel(33, 27)).toEqual([...barvy.lista, 255]);
      expect(recording.pixel(35, 27)[3]).toBe(0);
      expect(soubeh.pixel(35, 27)[3]).toBe(0);
      expect(barevnaVzdalenost(recordingStred, barvy.recording))
        .toBeLessThan(barevnaVzdalenost(recordingStred, barvy.tracking));
    }
  });

  it("generátor opakovaně vyrobí přesně bajty uložené v repozitáři", () => {
    expect(existsSync(GENERATOR), "Chybí reprodukovatelný generátor scripts/tray-ikony.mjs")
      .toBe(true);

    const docasnyKoren = mkdtempSync(path.join(tmpdir(), "ludone-tray-ikony-"));
    const prvniBeh = path.join(docasnyKoren, "prvni");
    const druhyBeh = path.join(docasnyKoren, "druhy");

    try {
      execFileSync(process.execPath, [GENERATOR, "--output", prvniBeh]);
      execFileSync(process.execPath, [GENERATOR, "--output", druhyBeh]);

      for (const motiv of MOTIVY) {
        for (const stav of STAVY) {
          for (const varianta of VARIANTY) {
            const nazev = `${motiv}-${stav}${varianta}.png`;
            const ulozene = readFileSync(path.join(ADRESAR_IKON, nazev));
            const prvni = readFileSync(path.join(prvniBeh, nazev));
            const druhe = readFileSync(path.join(druhyBeh, nazev));
            expect(prvni.equals(ulozene), `${nazev} se liší od výstupu generátoru`)
              .toBe(true);
            expect(druhe.equals(prvni), `${nazev} není mezi dvěma běhy deterministická`)
              .toBe(true);
          }
        }
      }
    } finally {
      rmSync(docasnyKoren, { recursive: true, force: true });
    }
  });
});
