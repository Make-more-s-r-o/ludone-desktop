import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Doplňující F akceptace. Původní gates ani Astra assertions tím nejsou nahrazené.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "dukazy/desktop-osa-2026-10-05/akceptace");
mkdirSync(output, { recursive: true });
const checks = [
  ["lint-implementace", "npx", ["eslint", "src", "electron", "scripts/osa-design-e2e.mjs", "scripts/osa-reference-capture.mjs", "scripts/akceptace/F-Osa.mjs", "tests/osa-tray-image-electron.js"]],
  ["typecheck", "npm", ["run", "typecheck"]],
  ["unit-F", "npx", ["vitest", "run", "tests/osa-playback.test.js", "tests/osa-tray.test.js", "tests/osa-recordings.test.js"]],
  ["unit-vsechny-puvodni-i-nove", "npm", ["run", "test:unit"]],
  ["lint-puvodni-brana", "npm", ["run", "lint"]],
  ["build", "npm", ["run", "build"]],
  ["tray-image-puvodni", "npm", ["run", "test:tray-image"]],
  ["tray-image-F", path.join(root,"node_modules/.bin/electron"), ["tests/osa-tray-image-electron.js"]],
  ["Electron-F", "node", ["scripts/osa-design-e2e.mjs"]],
  ["Electron-F-24x3-auth-a-detail", "node", ["scripts/osa-auth-e2e.mjs"]],
];
let failures = 0;
for (const [label, command, args] of checks) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 20*1024*1024, timeout: 180_000 });
  writeFileSync(path.join(output, `${label}.txt`), `$ ${command} ${args.join(" ")}\n${result.stdout || ""}${result.stderr || ""}${result.error ? result.error.message + "\n" : ""}EXIT_CODE=${result.status}\n`);
  const passed = result.status === 0;
  console.log(`${passed ? "PASS" : "FAIL"} ${label} (exit ${result.status})`);
  if (!passed) failures++;
}
console.log(`Důkazy: ${output}`);
process.exitCode = failures ? 1 : 0;
