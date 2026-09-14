import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedReleaseFileNames, validateReleaseArtifacts } from "./release-artifacts.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageManifest = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${arguments_.join(" ")} selhal:\n${result.stderr || result.stdout}`);
  }
  return `${result.stdout}${result.stderr}`.trim();
}

function plistValue(appPath, key) {
  return run("plutil", ["-extract", key, "raw", "-o", "-", path.join(appPath, "Contents", "Info.plist")]);
}

async function verifyZip(zipPath, expectedArch) {
  const extractionRoot = await mkdtemp(path.join(tmpdir(), "ludone-release-verify-"));
  try {
    run("ditto", ["-x", "-k", zipPath, extractionRoot]);
    const appPath = path.join(extractionRoot, `${packageManifest.build.productName}.app`);
    if (plistValue(appPath, "CFBundleIdentifier") !== packageManifest.build.appId) {
      throw new Error(`${path.basename(zipPath)} obsahuje jiné bundle id`);
    }
    if (plistValue(appPath, "CFBundleShortVersionString") !== packageManifest.version) {
      throw new Error(`${path.basename(zipPath)} obsahuje jinou verzi aplikace`);
    }
    const executable = plistValue(appPath, "CFBundleExecutable");
    const architectures = run("lipo", ["-archs", path.join(appPath, "Contents", "MacOS", executable)]).split(/\s+/);
    if (architectures.length !== 1 || architectures[0] !== expectedArch) {
      throw new Error(`${path.basename(zipPath)} obsahuje architektury ${architectures.join(", ")}`);
    }
    run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
    const signature = run("codesign", ["--display", "--verbose=4", appPath]);
    if (!signature.includes("Authority=Developer ID Application:") || !/TeamIdentifier=\S+/.test(signature)) {
      throw new Error(`${path.basename(zipPath)} nemá podpis Developer ID Application`);
    }
    run("xcrun", ["stapler", "validate", appPath]);
    run("spctl", ["--assess", "--type", "exec", "--verbose=2", appPath]);
  } finally {
    await rm(extractionRoot, { recursive: true, force: true });
  }
}

async function main() {
  if (process.platform !== "darwin") throw new Error("Ověření podpisu a notarizace vyžaduje macOS");
  const directoryArgument = process.argv.indexOf("--directory");
  if (process.argv.length > 2 && (directoryArgument !== 2 || !process.argv[3] || process.argv.length !== 4)) {
    throw new Error("Použití: node scripts/verify-macos-release.mjs [--directory CESTA]");
  }
  const directory = directoryArgument === 2
    ? path.resolve(process.argv[3])
    : path.join(projectRoot, packageManifest.build.directories.output);
  await validateReleaseArtifacts(directory);
  const expected = expectedReleaseFileNames();

  for (const dmg of expected.packages.filter((name) => name.endsWith(".dmg"))) {
    const dmgPath = path.join(directory, dmg);
    run("hdiutil", ["verify", dmgPath]);
    run("xcrun", ["stapler", "validate", dmgPath]);
    run("spctl", ["--assess", "--type", "open", "--context", "context:primary-signature", "--verbose=2", dmgPath]);
    console.log(`PASS DMG podpis a notarizace: ${dmg}`);
  }

  for (const arch of ["arm64", "x64"]) {
    const zip = expected.packages.find((name) => name.endsWith(`-${arch}.zip`));
    await verifyZip(path.join(directory, zip), arch);
    console.log(`PASS ZIP aplikace, architektura, podpis a notarizace: ${zip}`);
  }
}

main().catch((error) => {
  console.error(`FAIL macOS release: ${error.message}`);
  process.exitCode = 1;
});
