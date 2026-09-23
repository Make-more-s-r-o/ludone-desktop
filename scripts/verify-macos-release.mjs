import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expectedReleaseFileNames, validateReleaseArtifacts } from "./release-artifacts.mjs";
import { machOCanonicalSha256 } from "./prepare-media-encoder.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageManifest = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const encoderLock = JSON.parse(await readFile(path.join(projectRoot, "scripts", "media-encoder-lock.json"), "utf8"));

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

function teamIdentifier(signature, label) {
  const match = signature.match(/(?:^|\n)TeamIdentifier=(\S+)/);
  if (!match) throw new Error(`${label} nemá TeamIdentifier`);
  return match[1];
}

async function fileDigest(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function regularExecutable(filePath) {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o111) === 0) {
    throw new Error("Přibalený media encoder není spustitelný běžný soubor");
  }
  await access(filePath, constants.X_OK);
}

export async function verifyBundledEncoder(appPath, expectedArch, appTeam, run = runCommand) {
  const resources = path.join(appPath, "Contents", "Resources", "media-encoder");
  const executable = path.join(resources, "ffmpeg");
  await regularExecutable(executable);
  const expectedMachArch = expectedArch === "x64" ? "x86_64" : expectedArch;
  const architectures = run("lipo", ["-archs", executable]).split(/\s+/);
  if (architectures.length !== 1 || architectures[0] !== expectedMachArch) {
    throw new Error(`Media encoder obsahuje architektury ${architectures.join(", ")}, očekáváno ${expectedMachArch}`);
  }
  const build = JSON.parse(await readFile(path.join(resources, "BUILD.json"), "utf8"));
  if (build.arch !== expectedArch
    || build.ffmpeg?.version !== encoderLock.ffmpeg.version
    || build.ffmpeg?.sha256 !== encoderLock.ffmpeg.sha256
    || build.opus?.version !== encoderLock.opus.version
    || build.opus?.sha256 !== encoderLock.opus.sha256) {
    throw new Error("BUILD.json media encoderu neodpovídá připnutým zdrojům a architektuře");
  }
  if (build.machOCanonicalSha256 !== await machOCanonicalSha256(executable)) {
    throw new Error("Kanonický Mach-O SHA-256 přibaleného media encoderu nesouhlasí s BUILD.json");
  }
  const configure = Array.isArray(build.configureArguments) ? build.configureArguments : [];
  for (const required of [
    "--disable-autodetect",
    "--disable-everything",
    "--enable-libopus",
    "--enable-decoder=opus",
    "--enable-encoder=libopus",
    "--enable-demuxer=matroska",
    "--enable-muxer=webm",
  ]) {
    if (!configure.includes(required)) throw new Error(`BUILD.json postrádá povinnou volbu ${required}`);
  }
  if (configure.some((value) => ["--enable-gpl", "--enable-nonfree", "--enable-version3"].includes(value))) {
    throw new Error("Media encoder má nepovolenou licenční konfiguraci");
  }
  const packagedLock = JSON.parse(await readFile(path.join(resources, "media-encoder-lock.json"), "utf8"));
  if (JSON.stringify(packagedLock) !== JSON.stringify(encoderLock)) {
    throw new Error("Přibalený media-encoder-lock.json nesouhlasí s releasem");
  }
  for (const dependency of [encoderLock.ffmpeg, encoderLock.opus]) {
    const archiveName = path.basename(new URL(dependency.url).pathname);
    const archivePath = path.join(resources, "sources", archiveName);
    if (await fileDigest(archivePath) !== dependency.sha256) {
      throw new Error(`${archiveName} v přiložených zdrojích má nesprávný SHA-256`);
    }
  }
  for (const notice of ["README.md", "LICENSE.txt"]) {
    const info = await lstat(path.join(resources, notice));
    if (!info.isFile() || info.isSymbolicLink() || info.size <= 0) {
      throw new Error(`Media encoder postrádá ${notice}`);
    }
  }
  const sourceFiles = new Map([
    ["README.md", path.join(projectRoot, "build", "media-encoder", "README.md")],
    ["LICENSE.txt", path.join(projectRoot, "build", "media-encoder", "LICENSE.txt")],
    ["media-encoder-lock.json", path.join(projectRoot, "scripts", "media-encoder-lock.json")],
    ["prepare-media-encoder.mjs", path.join(projectRoot, "scripts", "prepare-media-encoder.mjs")],
  ]);
  for (const [name, original] of sourceFiles) {
    const source = path.join(resources, "sources", name);
    const info = await lstat(source);
    if (!info.isFile() || info.isSymbolicLink() || info.size === 0
      || await fileDigest(source) !== await fileDigest(original)) {
      throw new Error(`Přibalený zdrojový soubor ${name} neodpovídá buildu`);
    }
  }
  for (const oldArchive of ["lame-3.100.tar.gz", "opus-1.5.2.tar.gz"]) {
    try {
      await lstat(path.join(resources, "sources", oldArchive));
      throw new Error(`Přibalené zdroje obsahují nepoužívaný archiv ${oldArchive}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  run("codesign", ["--verify", "--strict", "--verbose=2", executable]);
  const encoderSignature = run("codesign", ["--display", "--verbose=4", executable]);
  if (!encoderSignature.includes("Authority=Developer ID Application:")
    || teamIdentifier(encoderSignature, "Media encoder") !== appTeam) {
    throw new Error("Media encoder nemá Developer ID podpis stejného týmu jako aplikace");
  }
  const libraries = run("otool", ["-L", executable]).split(/\r?\n/).slice(1).map((line) => line.trim().split(/\s+/)[0]).filter(Boolean);
  const foreign = libraries.filter((library) => !library.startsWith("/usr/lib/")
    && !library.startsWith("/System/Library/Frameworks/"));
  if (foreign.length > 0) throw new Error(`Media encoder odkazuje na cizí dynamické knihovny: ${foreign.join(", ")}`);
  if ((expectedArch === "x64" ? process.arch === "x64" : process.arch === "arm64")) {
    const version = run(executable, ["-version"]).split(/\r?\n/, 1)[0];
    if (!version.startsWith(`ffmpeg version ${encoderLock.ffmpeg.version}`)) {
      throw new Error(`Media encoder hlásí jinou verzi: ${version}`);
    }
  }
}

async function verifyApp(appPath, expectedArch, run, verifyEncoder) {
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
  if (verifyEncoder) {
    await verifyEncoder(appPath, expectedArch, teamIdentifier(signature, path.basename(appPath)), run);
  }
  run("xcrun", ["stapler", "validate", appPath]);
  run("spctl", ["--assess", "--type", "exec", "--verbose=2", appPath]);
}

async function verifyZip(zipPath, expectedArch, { makeTemp, remove, run, verifyEncoder }) {
  const extractionRoot = await makeTemp(path.join(tmpdir(), "ludone-release-zip-"));
  try {
    run("ditto", ["-x", "-k", zipPath, extractionRoot]);
    await verifyApp(path.join(extractionRoot, `${packageManifest.build.productName}.app`), expectedArch, run, verifyEncoder);
  } finally {
    await remove(extractionRoot, { recursive: true, force: true });
  }
}

async function verifyDmg(dmgPath, expectedArch, { makeTemp, remove, run, verifyEncoder }) {
  const mountPoint = await makeTemp(path.join(tmpdir(), "ludone-release-dmg-"));
  let attached = false;
  try {
    run("hdiutil", ["verify", dmgPath]);
    run("hdiutil", ["attach", "-readonly", "-nobrowse", "-mountpoint", mountPoint, dmgPath]);
    attached = true;
    await verifyApp(path.join(mountPoint, `${packageManifest.build.productName}.app`), expectedArch, run, verifyEncoder);
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
    verifyEncoder: dependencies.verifyEncoder ?? verifyBundledEncoder,
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
