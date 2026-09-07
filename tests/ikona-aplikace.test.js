import { execFileSync } from "node:child_process";
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const KOREN = fileURLToPath(new URL("../", import.meta.url));
const GENERATOR = path.join(KOREN, "scripts/tray-ikony.mjs");
const MANIFEST = JSON.parse(readFileSync(path.join(KOREN, "package.json"), "utf8"));
const VELIKOSTI = [16, 32, 128, 256, 512];
const PNG_PODPIS = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function dekodujPng(obsah) {
  expect(obsah.subarray(0, 8)).toEqual(PNG_PODPIS);
  const sirka = obsah.readUInt32BE(16);
  const vyska = obsah.readUInt32BE(20);
  expect(sirka).toBeGreaterThan(0);
  expect(vyska).toBeGreaterThan(0);
  expect([...obsah.subarray(24, 29)]).toEqual([8, 6, 0, 0, 0]);
  const idat = [];
  for (let offset = 8; offset < obsah.length;) {
    const delka = obsah.readUInt32BE(offset);
    const typ = obsah.subarray(offset + 4, offset + 8).toString("ascii");
    if (typ === "IDAT") idat.push(obsah.subarray(offset + 8, offset + 8 + delka));
    offset += 12 + delka;
  }
  const data = inflateSync(Buffer.concat(idat));
  const radek = 1 + sirka * 4;
  expect(data.length).toBe(radek * vyska);
  for (let y = 0; y < vyska; y += 1) expect(data[y * radek]).toBe(0);
  return {
    sirka,
    vyska,
    pixel(x, y) {
      const offset = y * radek + 1 + x * 4;
      return [...data.subarray(offset, offset + 4)];
    },
  };
}

function castiIcns(obsah) {
  expect(obsah.subarray(0, 4).toString("ascii")).toBe("icns");
  expect(obsah.readUInt32BE(4)).toBe(obsah.length);
  const casti = new Map();
  for (let offset = 8; offset < obsah.length;) {
    const typ = obsah.subarray(offset, offset + 4).toString("ascii");
    const delka = obsah.readUInt32BE(offset + 4);
    expect(delka).toBeGreaterThan(8);
    expect(offset + delka).toBeLessThanOrEqual(obsah.length);
    expect(casti.has(typ)).toBe(false);
    casti.set(typ, obsah.subarray(offset + 8, offset + delka));
    offset += delka;
  }
  return casti;
}

function generuj(skript, cil, aplikace = true) {
  execFileSync(process.execPath, [skript, ...(aplikace ? ["--app"] : []), "--output", cil]);
}

describe("ikona aplikace", () => {
  it("build.mac.icon ukazuje na existující neprázdnou sadu ICNS", () => {
    expect(MANIFEST.build.mac.icon, "Chybí build.mac.icon").toBeTypeOf("string");
    expect(MANIFEST.build.mac.icon.length).toBeGreaterThan(0);
    const soubor = path.resolve(KOREN, MANIFEST.build.mac.icon);
    // Ikona je artefakt balení, ne verzovaný soubor (viz `.gitignore`) — na čistém
    // checkoutu tedy NEEXISTUJE a test se na ni nesmí jen zeptat. Vyrobíme si ji stejnou
    // cestou, jakou ji vyrábí balení; teprve pak má smysl tvrdit něco o jejím obsahu.
    // 🔴 Bez tohohle kroku test procházel jen na stroji, kde už ikona ležela z dřívějška.
    if (!existsSync(soubor)) generuj(GENERATOR, path.dirname(soubor));
    expect(existsSync(soubor), `Chybí ${soubor} ani po vygenerování`).toBe(true);
    const casti = castiIcns(readFileSync(soubor));
    const ocekavane = {
      icp4: 16, icp5: 32, ic07: 128, ic08: 256, ic09: 512,
      ic11: 32, ic12: 64, ic13: 256, ic14: 512, ic10: 1024,
    };
    expect([...casti.keys()].sort()).toEqual(Object.keys(ocekavane).sort());
    for (const [typ, rozmer] of Object.entries(ocekavane)) {
      const obrazek = dekodujPng(casti.get(typ));
      expect([obrazek.sirka, obrazek.vyska], typ).toEqual([rozmer, rozmer]);
      // Střed podkladu je neprůhledný, vnější rohy průhledné.
      expect(obrazek.pixel(rozmer / 2, rozmer / 2)[3], typ).toBe(255);
      expect(obrazek.pixel(0, 0)[3], typ).toBe(0);
      expect(obrazek.pixel(rozmer - 1, rozmer - 1)[3], typ).toBe(0);
      let svetlyGlyf = 0;
      let tmavyPodklad = 0;
      for (let y = 0; y < rozmer; y += 1) {
        for (let x = 0; x < rozmer; x += 1) {
          const pixel = obrazek.pixel(x, y);
          if (pixel.join(",") === "228,230,234,255") svetlyGlyf += 1;
          if (pixel.join(",") === "4,6,9,255") tmavyPodklad += 1;
        }
      }
      expect(svetlyGlyf, `${typ}: chybí neprůhledný glyf dark.text`).toBeGreaterThan(0);
      expect(tmavyPodklad, `${typ}: chybí podklad dark.listaPozadi`)
        .toBeGreaterThan(rozmer * rozmer / 2);
    }
  });

    // Spouští generátor jako PODPROCES; výchozích 5 s na to nestačí, jakmile na stroji
  // běží cokoli dalšího — a falešná červená je horší než přiznaná cena.
  // Aserce se nemění, mění se jen strop.
  it("generátor vytváří všech deset PNG a reprodukovatelné ICNS", () => {
    const koren = mkdtempSync(path.join(tmpdir(), "ludone-app-ikona-"));
    try {
      const prvni = path.join(koren, "prvni");
      const druhy = path.join(koren, "druhy");
      generuj(GENERATOR, prvni);
      generuj(GENERATOR, druhy);
      const nazvy = VELIKOSTI.flatMap((velikost) => [
        `icon_${velikost}x${velikost}.png`,
        `icon_${velikost}x${velikost}@2x.png`,
      ]).sort();
      expect(readdirSync(path.join(prvni, "LuDone.iconset")).sort()).toEqual(nazvy);
      const icns = readFileSync(path.join(prvni, "LuDone.icns"));
      expect(icns.equals(readFileSync(path.join(druhy, "LuDone.icns"))))
        .toBe(true);
      const vlozene = [...castiIcns(icns).values()];
      for (const velikost of VELIKOSTI) {
        for (const nasobek of [1, 2]) {
          const nazev = `icon_${velikost}x${velikost}${nasobek === 2 ? "@2x" : ""}.png`;
          const png = readFileSync(path.join(prvni, "LuDone.iconset", nazev));
          const obrazek = dekodujPng(png);
          expect([obrazek.sirka, obrazek.vyska])
            .toEqual([velikost * nasobek, velikost * nasobek]);
          expect(vlozene.some((data) => data.equals(png)), `${nazev} není v ICNS`).toBe(true);
        }
      }
    } finally {
      rmSync(koren, { recursive: true, force: true });
    }
  }, 30_000);

  // 🔴 Vlastní strop: tenhle test spouští generátor OSMKRÁT (základ + tři mutace, pokaždé
  // ikona aplikace i sada lišty). Sám doběhne za ~2,3 s, ale v plné sadě na zatíženém
  // stroji přesáhne výchozích 5 s a vyprší — což vypadá jako vada produktu, a není.
  // Aserce zůstávají beze změny; mění se jen přiznaná cena.
  it("změna sdílených bodů, šířky i plátna mění glyf aplikace i lišty", () => {
    const koren = mkdtempSync(path.join(tmpdir(), "ludone-app-geometrie-"));
    const zdroj = readFileSync(GENERATOR, "utf8");
    const mutace = [
      { vzor: /const PULZ = \[[\s\S]*?\n\];/, nahrada: "const PULZ = [[6, 12], [18, 12]];" },
      { vzor: /const SIRKA_PULZU = [\d.]+;/, nahrada: "const SIRKA_PULZU = 4.4;" },
      { vzor: /const PLATNO = [\d.]+;/, nahrada: "const PLATNO = 30;" },
    ];
    try {
      const puvodni = path.join(koren, "puvodni");
      generuj(GENERATOR, puvodni);
      generuj(GENERATOR, puvodni, false);
      for (const [index, { vzor, nahrada }] of mutace.entries()) {
        const upraveny = zdroj.replace(vzor, nahrada);
        expect(upraveny, `Mutace ${index} nenašla sdílenou konstantu`).not.toBe(zdroj);
        const skript = path.join(koren, `mutace-${index}.mjs`);
        const cil = path.join(koren, `mutace-${index}`);
        writeFileSync(skript, upraveny);
        generuj(skript, cil);
        generuj(skript, cil, false);
        for (const nazev of ["dark-idle@2x.png", "LuDone.iconset/icon_128x128.png"]) {
          expect(
            readFileSync(path.join(cil, nazev)).equals(readFileSync(path.join(puvodni, nazev))),
            `Mutace ${index} se neprojevila v ${nazev}; geometrie se nesdílí`,
          ).toBe(false);
        }
      }
    } finally {
      rmSync(koren, { recursive: true, force: true });
    }
  }, 30_000);

    // Spouští generátor jako PODPROCES; výchozích 5 s na to nestačí, jakmile na stroji
  // běží cokoli dalšího — a falešná červená je horší než přiznaná cena.
  // Aserce se nemění, mění se jen strop.
  it("balení vytvoří chybějící ikonu dříve, než spustí electron-builder", () => {
    const koren = mkdtempSync(path.join(tmpdir(), "ludone-app-baleni-"));
    try {
      mkdirSync(path.join(koren, "scripts"));
      for (const nazev of ["tray-ikony.mjs", "package-mac.mjs"]) {
        writeFileSync(path.join(koren, "scripts", nazev), readFileSync(path.join(KOREN, "scripts", nazev)));
      }
      writeFileSync(path.join(koren, "package.json"), JSON.stringify(MANIFEST));
      const builder = path.join(koren, "builder.mjs");
      writeFileSync(builder, `#!/usr/bin/env node
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const ikona = readFileSync(manifest.build.mac.icon);
if (ikona.subarray(0, 4).toString("ascii") !== "icns") throw new Error("Chybí platné ICNS před balením");
mkdirSync(path.join("release", process.arch === "arm64" ? "mac-arm64" : "mac", "LuDone Desktop.app"), { recursive: true });
`);
      chmodSync(builder, 0o700);
      const ikona = path.join(koren, MANIFEST.build.mac.icon);
      expect(existsSync(ikona)).toBe(false);
      const env = Object.fromEntries(Object.entries(process.env).filter(([nazev]) => (
        !/^(CSC_|APPLE_|LUDONE_PACKAGE_OUTPUT_DIR$)/.test(nazev)
      )));
      execFileSync(process.execPath, [path.join(koren, "scripts/package-mac.mjs")], {
        env: { ...env, LUDONE_BUILDER_EXECUTABLE: builder },
        stdio: "pipe",
      });
      expect(castiIcns(readFileSync(ikona)).size).toBe(10);
    } finally {
      rmSync(koren, { recursive: true, force: true });
    }
  }, 30_000);
});
