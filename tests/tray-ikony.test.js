import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STAVY = ["signed-out", "idle", "recording", "tracking"];
const VARIANTY = ["", "@2x"];
const PNG_PODPIS = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const KOREN_REPA = fileURLToPath(new URL("../", import.meta.url));
const ADRESAR_IKON = path.join(KOREN_REPA, "electron", "ikony");
const GENERATOR = path.join(KOREN_REPA, "scripts", "tray-ikony.mjs");

function cestaIkony(adresar, stav, varianta = "") {
  return path.join(adresar, `${stav}${varianta}.png`);
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

function hash(soubor) {
  return createHash("sha256").update(readFileSync(soubor)).digest("hex");
}

describe("ikony v liště", () => {
  it("všech osm souborů existuje a má podpis PNG", () => {
    for (const stav of STAVY) {
      for (const varianta of VARIANTY) {
        const soubor = cestaIkony(ADRESAR_IKON, stav, varianta);
        expect(existsSync(soubor), `Chybí ${path.basename(soubor)}`).toBe(true);
        expect(readFileSync(soubor).subarray(0, PNG_PODPIS.length)).toEqual(PNG_PODPIS);
      }
    }
  });

  it("každá @2x varianta má přesně dvojnásobné rozměry z IHDR", () => {
    for (const stav of STAVY) {
      const zaklad = rozmeryPng(cestaIkony(ADRESAR_IKON, stav));
      const retina = rozmeryPng(cestaIkony(ADRESAR_IKON, stav, "@2x"));
      expect(retina, `${stav}@2x nemá dvojnásobné rozměry`).toEqual({
        width: zaklad.width * 2,
        height: zaklad.height * 2,
      });
    }
  });

  it("v každém rozlišení mají všechny čtyři stavy jiný obsah", () => {
    for (const varianta of VARIANTY) {
      const hashe = STAVY.map((stav) => hash(cestaIkony(ADRESAR_IKON, stav, varianta)));
      expect(new Set(hashe).size, `Stavy ${varianta || "1x"} nejsou všechny odlišné`)
        .toBe(STAVY.length);
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

      for (const stav of STAVY) {
        for (const varianta of VARIANTY) {
          const nazev = `${stav}${varianta}.png`;
          const ulozene = readFileSync(path.join(ADRESAR_IKON, nazev));
          const prvni = readFileSync(path.join(prvniBeh, nazev));
          const druhe = readFileSync(path.join(druhyBeh, nazev));
          expect(prvni.equals(ulozene), `${nazev} se liší od výstupu generátoru`).toBe(true);
          expect(druhe.equals(prvni), `${nazev} není mezi dvěma běhy deterministická`).toBe(true);
        }
      }
    } finally {
      rmSync(docasnyKoren, { recursive: true, force: true });
    }
  });
});
