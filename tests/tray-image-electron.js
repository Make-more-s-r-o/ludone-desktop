import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, nativeImage } from "electron";

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
const production = Function(
  "fs",
  "path",
  "nativeImage",
  "__dirname",
  `"use strict";
  ${mainSource.includes("function traySvg(") ? functionSource(mainSource, "traySvg") : ""}
  ${functionSource(mainSource, "trayIconName")}
  ${functionSource(mainSource, "trayImage")}
  return { trayIconName, trayImage };`,
)(fs, path, nativeImage, mainDirectory);

let failures = 0;

for (const state of production.trayIconName()) {
  try {
    const image = production.trayImage(state);
    const size = image.getSize();
    const pngLength = image.toPNG().length;
    const measurement = `MEASURE ${state}: isEmpty=${image.isEmpty()} getSize=${size.width}x${size.height} toPNG.length=${pngLength}`;
    outputLines.push(measurement);
    console.log(measurement);

    assert.equal(image.isEmpty(), false, "isEmpty() musí vrátit false");
    assert.ok(size.width > 0, "šířka musí být větší než nula");
    assert.ok(size.height > 0, "výška musí být větší než nula");
    assert.ok(pngLength > 0, "toPNG() musí vrátit data");
    const line = `PASS ${state}: isEmpty=false getSize=${size.width}x${size.height} toPNG.length=${pngLength}`;
    outputLines.push(line);
    console.log(line);
  } catch (error) {
    failures += 1;
    const line = `FAIL ${state}: ${error.message}`;
    outputLines.push(line);
    console.error(line);
  }
}

if (outputPath) fs.writeFileSync(outputPath, `${outputLines.join("\n")}\n`);
app.exit(failures === 0 ? 0 : 1);
