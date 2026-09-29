/* global process, __dirname, console, setTimeout, clearTimeout */
// Izolovaný testovací entrypoint: ESM rendererový test se importuje až po ready.
const { app } = require("electron");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw new Error("Harness vyžaduje absolutní izolovanou složku výstupu");
const userData = path.join(output, "isolated-user-data");
mkdirSync(userData, { recursive: true });
app.setPath("userData", userData);
app.on("window-all-closed", () => {});
console.log("BOOTSTRAP čeká na Electron ready");
const timer = setTimeout(() => {
  console.error("FAIL bootstrap: Electron ready nepřišel do 30 sekund");
  app.exit(1);
}, 30000);
app.whenReady().then(() => {
  clearTimeout(timer);
  console.log("BOOTSTRAP READY");
  return import(pathToFileURL(path.join(__dirname, "astra-state-e2e.mjs")).href);
}).catch((error) => {
  clearTimeout(timer);
  console.error(error.stack || error.message);
  app.exit(1);
});
