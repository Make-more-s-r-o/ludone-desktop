import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, nativeImage, nativeTheme } from "electron";

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Funkce ${name} nebyla nalezena`);

  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Funkce ${name} nemá uzavřené tělo`);
}

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const mainPath = path.resolve(testDirectory, "../electron/main.cjs");
const mainDirectory = path.dirname(mainPath);
const mainSource = fs.readFileSync(mainPath, "utf8");
const outputPath = process.env.LUDONE_TRAY_TEST_OUTPUT;
const outputLines = [];
const VSECHNY_STAVY = [
  "signed-out",
  "idle",
  "recording",
  "tracking",
  "recording-tracking",
  "queue-waiting",
  "recording-audio-lost",
];
const SABLONOVE_STAVY = new Set(["signed-out", "idle", "queue-waiting"]);
const production = Function(
  "fs",
  "path",
  "nativeImage",
  "nativeTheme",
  "__dirname",
  `"use strict";
  ${mainSource.includes("function traySvg(") ? functionSource(mainSource, "traySvg") : ""}
  ${functionSource(mainSource, "trayIconName")}
  ${functionSource(mainSource, "currentTrayIconTheme")}
  ${functionSource(mainSource, "trayIconVariant")}
  ${functionSource(mainSource, "trayImage")}
  return { trayIconName, trayIconVariant, trayImage };`,
)(fs, path, nativeImage, nativeTheme, mainDirectory);

let failures = 0;

assert.deepEqual(
  production.trayIconName(),
  VSECHNY_STAVY,
  "Electron test musí projít přes přesný úplný výčet stavů lišty",
);

for (const theme of ["dark", "light"]) {
  for (const state of VSECHNY_STAVY) {
    try {
      const image = production.trayImage(state, theme);
      const size = image.getSize();
      const pngLength = image.toPNG().length;
      const expectedTemplate = SABLONOVE_STAVY.has(state);
      const expectedTheme = expectedTemplate ? "dark" : theme;
      const expectedImage = nativeImage.createFromBuffer(fs.readFileSync(path.join(
        mainDirectory,
        "ikony",
        `${expectedTheme}-${state}.png`,
      )), { scaleFactor: 1 });
      const measurement = `MEASURE ${theme}-${state}: isEmpty=${image.isEmpty()} `
        + `template=${image.isTemplateImage()} getSize=${size.width}x${size.height} `
        + `toPNG.length=${pngLength}`;
      outputLines.push(measurement);
      console.log(measurement);

      assert.equal(image.isEmpty(), false, "isEmpty() musí vrátit false");
      assert.equal(
        image.isTemplateImage(),
        expectedTemplate,
        expectedTemplate
          ? "neutrální ikona musí být template image"
          : "aktivní ikona nesmí být template image",
      );
      assert.ok(size.width > 0, "šířka musí být větší než nula");
      assert.ok(size.height > 0, "výška musí být větší než nula");
      assert.ok(pngLength > 0, "toPNG() musí vrátit data");
      assert.equal(
        image.toPNG({ scaleFactor: 1 }).equals(expectedImage.toPNG({ scaleFactor: 1 })),
        true,
        "obrázek musí zachovat očekávaný stav a barevnou sadu",
      );
      const line = `PASS ${theme}-${state}: isEmpty=false template=${expectedTemplate} `
        + `getSize=${size.width}x${size.height} toPNG.length=${pngLength}`;
      outputLines.push(line);
      console.log(line);
    } catch (error) {
      failures += 1;
      const line = `FAIL ${theme}-${state}: ${error.message}`;
      outputLines.push(line);
      console.error(line);
    }
  }
}

for (const state of VSECHNY_STAVY) {
  try {
    const dark = production.trayImage(state, "dark");
    const light = production.trayImage(state, "light");
    const samePixels = dark.toPNG().equals(light.toPNG());
    if (SABLONOVE_STAVY.has(state)) {
      assert.equal(samePixels, true, "šablonový stav nesmí mít co přepínat");
    } else {
      assert.equal(samePixels, false, "aktivní stav musí přepnout barevnou sadu");
    }
    const line = `PASS theme-switch-${state}: samePixels=${samePixels}`;
    outputLines.push(line);
    console.log(line);
  } catch (error) {
    failures += 1;
    const line = `FAIL theme-switch-${state}: ${error.message}`;
    outputLines.push(line);
    console.error(line);
  }
}

if (outputPath) fs.writeFileSync(outputPath, `${outputLines.join("\n")}\n`);
app.exit(failures === 0 ? 0 : 1);
