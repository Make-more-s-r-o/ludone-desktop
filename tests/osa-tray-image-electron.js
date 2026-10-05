import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, nativeImage } from "electron";
import { createRequire } from "node:module";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { OSA_TRAY_LABELS } = createRequire(import.meta.url)("../electron/osa-tray.cjs");
// nativeImage lze měřit před ready; top-level await by blokoval start ESM.
let failures = 0;
for (const state of Object.keys(OSA_TRAY_LABELS)) {
  try {
    const image = nativeImage.createFromBuffer(fs.readFileSync(path.join(root, "electron/osa-ikony", `${state}.png`)), { scaleFactor: 1 });
    image.addRepresentation({ scaleFactor: 2, buffer: fs.readFileSync(path.join(root, "electron/osa-ikony", `${state}@2x.png`)) });
    image.setTemplateImage(true);
    assert.deepEqual(image.getSize(), { width: 18, height: 18 });
    assert.equal(image.isEmpty(), false);
    assert.equal(image.isTemplateImage(), true);
    assert.deepEqual(image.getScaleFactors(), [1, 2]);
    const retina = nativeImage.createFromBuffer(image.toPNG({ scaleFactor: 2 }));
    assert.deepEqual(retina.getSize(), { width: 36, height: 36 });
    console.log(`PASS ${state}: 18/36 px, template, obě reprezentace`);
  } catch (error) { failures++; console.error(`FAIL ${state}: ${error.message}`); }
}
app.exit(failures ? 1 : 0);
