import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expectedReleaseFileNames, validateReleaseArtifacts } from "./release-artifacts.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageManifest = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));

export function runCommand(command, arguments_) {
  const result = spawnSync(command, arguments_, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${arguments_.join(" ")} selhal:\n${result.stderr || result.stdout}`);
  }
  return `${result.stdout}${result.stderr}`.trim();
}

function plistValue(appPath, key, run) {
  return run("plutil", ["-extract", key, "raw", "-o", "-", path.join(appPath, "Contents", "Info.plist")]);
}

function verifyApp(appPath, expectedArch, run) {
  if (plistValue(appPath, "CFBundleIdentifier", run) !== packageManifest.build.appId) {
    throw new Error(`${path.basename(appPath)} obsahuje jiné bundle id`);
  }
  if (plistValue(appPath, "CFBundleShortVersionString", run) !== packageManifest.version) {
    throw new Error(`${path.basename(appPath)} obsahuje jinou verzi aplikace`);
  }
  const executable = plistValue(appPath, "CFBundleExecutable", run);
  const architectures = run("lipo", ["-archs", path.join(appPath, "Contents", "MacOS", executable)]).split(/\s+/);
  const expectedMachArch = expectedArch === "x64" ? "x86_64" : expectedArch;
  if (architectures.length !== 1 || architectures[0] !== expectedMachArch) {
    throw new Error(`${path.basename(appPath)} obsahuje architektury ${architectures.join(", ")}`);
  }
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  const signature = run("codesign", ["--display", "--verbose=4", appPath]);
  if (!signature.includes("Authority=Developer ID Application:") || !/TeamIdentifier=\S+/.test(signature)) {
    throw new Error(`${path.basename(appPath)} nemá podpis Developer ID Application`);
  }
  run("xcrun", ["stapler", "validate", appPath]);
  run("spctl", ["--assess", "--type", "exec", "--verbose=2", appPath]);
}

async function verifyZip(zipPath, expectedArch, { makeTemp, remove, run }) {
  const extractionRoot = await makeTemp(path.join(tmpdir(), "ludone-release-zip-"));
  try {
    run("ditto", ["-x", "-k", zipPath, extractionRoot]);
    verifyApp(path.join(extractionRoot, `${packageManifest.build.productName}.app`), expectedArch, run);
  } finally {
    await remove(extractionRoot, { recursive: true, force: true });
  }
}

async function verifyDmg(dmgPath, expectedArch, { makeTemp, remove, run }) {
  const mountPoint = await makeTemp(path.join(tmpdir(), "ludone-release-dmg-"));
  let attached = false;
  try {
    run("hdiutil", ["verify", dmgPath]);
    run("hdiutil", ["attach", "-readonly", "-nobrowse", "-mountpoint", mountPoint, dmgPath]);
    attached = true;
    verifyApp(path.join(mountPoint, `${packageManifest.build.productName}.app`), expectedArch, run);
  } finally {
    try {
      if (attached) run("hdiutil", ["detach", mountPoint]);
    } finally {
      await remove(mountPoint, { recursive: true, force: true });
    }
  }
}

export async function verifyMacRelease(directory, dependencies = {}) {
  const platform = dependencies.platform ?? process.platform;
  if (platform !== "darwin") throw new Error("Ověření podpisu a notarizace vyžaduje macOS");
  const helpers = {
    makeTemp: dependencies.makeTemp ?? mkdtemp,
    remove: dependencies.remove ?? rm,
    run: dependencies.run ?? runCommand,
  };
  await validateReleaseArtifacts(directory);
  const expected = expectedReleaseFileNames();

  for (const arch of ["arm64", "x64"]) {
    const dmg = expected.packages.find((name) => name.endsWith(`-${arch}.dmg`));
    await verifyDmg(path.join(directory, dmg), arch, helpers);
    console.log(`PASS DMG obraz a vložená aplikace: ${dmg}`);
  }

  for (const arch of ["arm64", "x64"]) {
    const zip = expected.packages.find((name) => name.endsWith(`-${arch}.zip`));
    await verifyZip(path.join(directory, zip), arch, helpers);
    console.log(`PASS ZIP aplikace, architektura, podpis a notarizace: ${zip}`);
  }
}

function releaseDirectory(arguments_) {
  if (arguments_.length === 0) return path.join(projectRoot, packageManifest.build.directories.output);
  if (arguments_.length === 2 && arguments_[0] === "--directory") return path.resolve(arguments_[1]);
  throw new Error("Použití: node scripts/verify-macos-release.mjs [--directory CESTA]");
}

async function main() {
  await verifyMacRelease(releaseDirectory(process.argv.slice(2)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`FAIL macOS release: ${error.message}`);
    process.exitCode = 1;
  });
}
