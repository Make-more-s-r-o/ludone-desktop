// Kontrola skutečného balíčku včetně úplnosti závislostí; nedokládá podpis ani živý zvuk.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { machOCanonicalSha256 } from "../prepare-media-encoder.mjs";

const [appArgument, architecture] = process.argv.slice(2);
assert(appArgument && ["arm64", "x64"].includes(architecture), "Použití: node scripts/akceptace/stereo-package.mjs <app> <arm64|x64>");
const resources = path.join(await realpath(appArgument), "Contents/Resources");
const application = path.join(resources, "app");
const visited = new Set();
let failures = 0;
async function check(label, operation) {
  try { await operation(); console.log(`PASS ${label}`); }
  catch (error) { failures += 1; console.log(`FAIL ${label}: ${error.message}`); }
}
async function dependencies(packageFile) {
  if (visited.has(packageFile)) return;
  visited.add(packageFile);
  const manifest = JSON.parse(await readFile(packageFile, "utf8"));
  const require = createRequire(packageFile);
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    const resolved = await realpath(require.resolve(name));
    assert(resolved.startsWith(`${application}${path.sep}`), `${name}: závislost leží mimo aplikaci`);
    let directory = path.dirname(resolved);
    while (directory.startsWith(`${application}${path.sep}`)) {
      const candidate = path.join(directory, "package.json");
      try {
        const dependency = JSON.parse(await readFile(candidate, "utf8"));
        if (dependency.name === name) { await dependencies(candidate); break; }
      } catch (error) { if (error.code !== "ENOENT") throw error; }
      directory = path.dirname(directory);
    }
    assert(directory.startsWith(`${application}${path.sep}`), `${name}: chybí popis závislosti`);
  }
}
await check("celý strom runtime závislostí je uvnitř aplikace", () => dependencies(path.join(application, "package.json")));
const encoder = path.join(resources, "media-encoder");
await check("správná architektura a nezměněný přibalený encoder", async () => {
  const executable = path.join(encoder, "ffmpeg");
  const build = JSON.parse(await readFile(path.join(encoder, "BUILD.json"), "utf8"));
  assert.equal(build.arch, architecture);
  assert.equal(execFileSync("lipo", ["-archs", executable], { encoding: "utf8" }).trim(), architecture === "x64" ? "x86_64" : "arm64");
  assert.equal(await machOCanonicalSha256(executable), build.machOCanonicalSha256);
});
await check("Opus a FFmpeg mají přiložené původní zdroje a licence", async () => {
  const lock = JSON.parse(await readFile(path.join(encoder, "media-encoder-lock.json"), "utf8"));
  for (const source of [lock.ffmpeg, lock.opus]) {
    const content = await readFile(path.join(encoder, "sources", path.basename(new URL(source.url).pathname)));
    assert.equal(createHash("sha256").update(content).digest("hex"), source.sha256);
  }
  assert((await readFile(path.join(encoder, "LICENSE.txt"))).length > 0);
  assert((await readFile(path.join(encoder, "README.md"))).length > 0);
});
console.log(`FAILURES=${failures}; kontrolovaných balíčků=${visited.size}; podpis a živá schůzka neověřeny`);
process.exitCode = failures === 0 ? 0 : 1;
