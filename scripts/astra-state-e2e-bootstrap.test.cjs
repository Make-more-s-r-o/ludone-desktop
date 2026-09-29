/* global __dirname */
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "astra-state-e2e-bootstrap.cjs"), "utf8");
function bootstrap(output, rejectReady = false) {
  const calls = [], timers = [];
  const app = { setPath: (...args) => calls.push(["setPath", ...args]), on: (...args) => calls.push(["on", ...args]),
    whenReady: () => rejectReady ? Promise.reject(new Error("ready failed")) : new Promise(() => {}), exit: code => calls.push(["exit", code]) };
  const context = { require: name => name === "electron" ? { app } : name === "node:fs" ? { mkdirSync: (...args) => calls.push(["mkdir", ...args]) } : require(name),
    process: { argv: ["electron", "script", output] }, __dirname, console: { log() {}, error() {} },
    setTimeout: (callback, milliseconds) => { timers.push({ callback, milliseconds }); return 1; }, clearTimeout: () => calls.push(["clearTimeout"]) };
  vm.runInNewContext(source, context);
  return { calls, timers };
}
test("bootstrap odmítne chybějící i relativní profil", () => {
  for (const value of [undefined, "relative"]) assert.throws(() => bootstrap(value), /absolutní izolovanou/);
});
test("profil je izolovaný ještě před čekáním na Electron ready", () => {
  const { calls, timers } = bootstrap("/tmp/astra-test-only");
  assert.equal(calls[0][0], "mkdir");
  assert.deepEqual(calls[1], ["setPath", "userData", "/tmp/astra-test-only/isolated-user-data"]);
  assert.equal(calls[2][0], "on"); assert.equal(calls[2][1], "window-all-closed");
  assert.equal(timers[0].milliseconds, 30000);
});
test("chybějící ready nemůže skončit zeleně", () => {
  const { calls, timers } = bootstrap("/tmp/astra-test-only"); timers[0].callback();
  assert.deepEqual(calls.at(-1), ["exit", 1]);
});
test("selhání ready vrátí exit1 a uklidí watchdog", async () => {
  const { calls } = bootstrap("/tmp/astra-test-only", true);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(calls.slice(-2), [["clearTimeout"], ["exit", 1]]);
});
