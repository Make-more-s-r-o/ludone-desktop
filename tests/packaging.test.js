import { spawnSync } from "node:child_process";
import { chmod, lstat, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const packageManifest = require("../package.json");
const packageScriptPath = fileURLToPath(new URL("../scripts/package-mac.mjs", import.meta.url));
const temporaryRoots = new Set();
const SIGNING_VARIABLES = [
  "CSC_LINK",
  "CSC_KEY_PASSWORD",
  "CSC_NAME",
  "APPLE_API_KEY",
  "APPLE_API_KEY_ID",
  "APPLE_API_ISSUER",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
  "APPLE_KEYCHAIN",
  "APPLE_KEYCHAIN_PROFILE",
];

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

function cleanEnvironment(overrides = {}) {
  const environment = { ...process.env };
  for (const name of SIGNING_VARIABLES) delete environment[name];
  return { ...environment, ...overrides };
}

async function fakeBuilder() {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-fake-builder-"));
  temporaryRoots.add(root);
  const executable = path.join(root, "electron-builder-stub.mjs");
  const capturePath = path.join(root, "capture.json");
  await writeFile(executable, `#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const args = process.argv.slice(2);
await writeFile(process.env.LUDONE_BUILDER_CAPTURE, JSON.stringify({
  args,
  environment: {
    CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY,
    CSC_LINK: process.env.CSC_LINK,
    CSC_KEY_PASSWORD: process.env.CSC_KEY_PASSWORD,
  },
}));
const outputName = process.arch === "arm64" ? "mac-arm64" : "mac";
await mkdir(path.join(
  process.env.LUDONE_PACKAGE_OUTPUT_DIR,
  outputName,
  "LuDone Desktop.app",
), { recursive: true });
`);
  await chmod(executable, 0o700);
  return { capturePath, executable, root };
}

async function runPackage(environment = {}, arguments_ = []) {
  const fake = await fakeBuilder();
  const outputRoot = path.join(fake.root, "release");
  const result = spawnSync(process.execPath, [packageScriptPath, ...arguments_], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    env: cleanEnvironment({
      LUDONE_BUILDER_CAPTURE: fake.capturePath,
      LUDONE_BUILDER_EXECUTABLE: fake.executable,
      LUDONE_PACKAGE_OUTPUT_DIR: outputRoot,
      ...environment,
    }),
  });
  const capture = result.status === 0
    ? JSON.parse(await readFile(fake.capturePath, "utf8"))
    : null;
  return { ...fake, capture, outputRoot, result };
}

describe("kontrakt electron-builderu", () => {
  // Spouští balicí skript jako PODPROCES; 5 s je málo, jakmile na stroji běží cokoli
  // dalšího. Aserce beze změny, mění se jen přiznaná cena.
  it("bez podpisových proměnných provede nepodepsaný build plán a nespadne", async () => {
    const { capture, outputRoot, result } = await runPackage();

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("NEPODEPSANÝ");
    expect(result.stderr).toContain("CSC_LINK");
    expect(result.stderr).toContain("CSC_KEY_PASSWORD");
    expect(capture.args).toContain("--config.mac.identity=null");
    expect(capture.args).toContain("--config.mac.hardenedRuntime=false");
    expect(capture.args).toContain("--config.mac.notarize=false");
    expect(capture.environment).toEqual({ CSC_IDENTITY_AUTO_DISCOVERY: "false" });

    const builtDirectory = process.arch === "arm64" ? "mac-arm64" : "mac";
    const compatibilityApp = path.join(outputRoot, "LuDone Desktop.app");
    expect((await lstat(compatibilityApp)).isSymbolicLink()).toBe(true);
    expect(path.resolve(outputRoot, await readlink(compatibilityApp))).toBe(path.join(
      outputRoot,
      builtDirectory,
      "LuDone Desktop.app",
    ));
  }, 30_000);

  it("úplná tajemství zapnou podpis a notarizaci, ale nikdy se nevypíší", async () => {
    const secrets = {
      CSC_LINK: "CERTIFIKAT-SENTINEL",
      CSC_KEY_PASSWORD: "HESLO-SENTINEL",
      APPLE_API_KEY: "APPLE-KLIC-SENTINEL",
      APPLE_API_KEY_ID: "APPLE-ID-SENTINEL",
      APPLE_API_ISSUER: "APPLE-ISSUER-SENTINEL",
    };
    const { capture, result } = await runPackage(secrets, ["--publish", "always"]);

    expect(result.status, result.stderr).toBe(0);
    expect(capture.args).toEqual(expect.arrayContaining(["--publish", "always"]));
    expect(capture.args).not.toContain("--config.mac.identity=null");
    expect(capture.args).not.toContain("--config.mac.hardenedRuntime=false");
    expect(capture.args).not.toContain("--config.mac.notarize=false");
    expect(capture.args).toContain("--config.forceCodeSigning=true");
    for (const secret of Object.values(secrets)) {
      expect(`${result.stdout}\n${result.stderr}`).not.toContain(secret);
    }
  });

  // Spouští balicí skript jako PODPROCES; 5 s je málo, jakmile na stroji běží cokoli
  // dalšího. Aserce beze změny, mění se jen přiznaná cena.
  it("nepodepsaný plán nikdy nepublikuje release", async () => {
    const { capturePath, result } = await runPackage({}, ["--publish", "always"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("publikovat");
    await expect(readFile(capturePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  }, 30_000);

  it("drží identitu, oba formáty, obě architektury a veřejný GitHub feed", () => {
    const config = packageManifest.build;

    expect(config.appId).toBe("cz.ludone.desktop");
    expect(config.productName).toBe("LuDone Desktop");
    expect(config.mac.target).toEqual([
      { target: "dmg", arch: ["arm64", "x64"] },
      { target: "zip", arch: ["arm64", "x64"] },
    ]);
    expect(config.publish).toEqual([{
      provider: "github",
      owner: "Make-more-s-r-o",
      repo: "ludone-desktop",
      private: false,
      releaseType: "release",
    }]);
  });

  it("drží název balíčku bez mezery, protože aktualizace selhává tiše", () => {
    const config = packageManifest.build;

    // 🔴 Jméno souboru NENÍ kosmetika. `latest-mac.yml` si z něj skládá adresu, ze které
    // si aplikace stahuje aktualizaci. Mezera by musela projít jako `%20` a je to jediný
    // znak, který dělí „funguje" od 404 — a ta 404 se neprojeví tady, ale u uživatele,
    // kterému aktualizace tiše přestane chodit a nikdo se ho nezeptá.
    // `productName` mezeru schválně SI PONECHÁVÁ: to je název, který člověk vidí v Docku,
    // kdežto `artifactName` je adresa. Proto se ta dvě jména od 8. 9. 2026 rozcházejí.
    expect(config.artifactName).not.toMatch(/\s/);
    expect(config.artifactName).toBe("LuDone-Desktop-${version}-${arch}.${ext}");
    expect(config.productName).toBe("LuDone Desktop");
  });

  it("balí jen runtime allowlist včetně zdrojů písem", () => {
    const config = packageManifest.build;

    expect(config.asar).toBe(false);
    // Tenhle klíč electron-builder NEZNÁ a celý build na něm padá s „unknown property".
    // Test ho dřív vyžadoval, takže hlídal, aby balení zůstalo rozbité; teď hlídá opak.
    expect(Object.hasOwn(config, "allowMissingDependencies")).toBe(false);
    expect(packageManifest.author, "electron-builder autora vyžaduje").toBeTruthy();
    expect(config.files).toEqual([
      "package.json",
      "dist/**/*",
      "electron/**/*",
      "src/lib/**/*",
      "src/pisma/**/*",
    ]);
    expect(config.files).toContain("src/pisma/**/*");
    expect(config.files.some((pattern) => /^(tests|docs|design)(?:\/|$)/.test(pattern))).toBe(false);
    expect(config.files).not.toContain("**/*");
  });
});
