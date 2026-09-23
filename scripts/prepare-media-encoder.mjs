import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, chmod, cp, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceBundleMode = path.basename(scriptDirectory) === "sources";
const projectRoot = sourceBundleMode ? scriptDirectory : path.resolve(scriptDirectory, "..");
const lockPath = path.join(scriptDirectory, "media-encoder-lock.json");
const runtimeRoot = path.join(projectRoot, ".runtime", "media-encoder");

export function parseArguments(arguments_) {
  let requestedArch = "all";
  let force = false;
  let check = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    if (arguments_[index] === "--arch" && arguments_[index + 1]) {
      requestedArch = arguments_[index + 1];
      index += 1;
    } else if (arguments_[index] === "--force") {
      force = true;
    } else if (arguments_[index] === "--check") {
      check = true;
    } else {
      throw new Error("Použití: node scripts/prepare-media-encoder.mjs [--arch arm64|x64|all] [--force|--check]");
    }
  }
  if (!["arm64", "x64", "all"].includes(requestedArch)) {
    throw new Error(`Nepodporovaná architektura: ${requestedArch}`);
  }
  if (force && check) throw new Error("Volby --force a --check nelze kombinovat");
  return { architectures: requestedArch === "all" ? ["arm64", "x64"] : [requestedArch], check, force };
}

export async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

// Build nejprve dostane ad-hoc podpis, takže následný Developer ID podpis pouze
// vymění blob a velikosti __LINKEDIT/LC_CODE_SIGNATURE. Po normalizaci těchto tří
// velikostí hash dál kryje Mach-O header, load commands a celý obsah před blobem.
export async function machOCanonicalSha256(filePath) {
  const content = Buffer.from(await readFile(filePath));
  if (content.length < 32 || content.readUInt32LE(0) !== 0xfeedfacf) {
    throw new Error("Media encoder není tenký 64bitový Mach-O soubor");
  }
  const commandCount = content.readUInt32LE(16);
  const commandsSize = content.readUInt32LE(20);
  if (commandCount <= 0 || commandCount > 1_024 || 32 + commandsSize > content.length) {
    throw new Error("Media encoder má neplatnou tabulku Mach-O load commands");
  }
  let offset = 32;
  let signatureOffset;
  for (let index = 0; index < commandCount; index += 1) {
    if (offset + 8 > 32 + commandsSize) throw new Error("Mach-O load command přesahuje hlavičku");
    const command = content.readUInt32LE(offset);
    const commandSize = content.readUInt32LE(offset + 4);
    if (commandSize < 8 || offset + commandSize > 32 + commandsSize) {
      throw new Error("Mach-O load command má neplatnou velikost");
    }
    if (command === 0x19 && commandSize >= 72) {
      const segmentName = content.toString("ascii", offset + 8, offset + 24).replace(/\0.*$/, "");
      if (segmentName === "__LINKEDIT") {
        content.fill(0, offset + 32, offset + 40);
        content.fill(0, offset + 48, offset + 56);
      }
    } else if (command === 0x1d && commandSize >= 16) {
      if (signatureOffset !== undefined) throw new Error("Mach-O obsahuje více podpisových commandů");
      signatureOffset = content.readUInt32LE(offset + 8);
      content.fill(0, offset + 12, offset + 16);
    }
    offset += commandSize;
  }
  if (signatureOffset === undefined || signatureOffset < 32 + commandsSize || signatureOffset > content.length) {
    throw new Error("Mach-O neobsahuje platný LC_CODE_SIGNATURE");
  }
  return createHash("sha256").update(content.subarray(0, signatureOffset)).digest("hex");
}

async function downloadVerified(dependency, destination, { fetchImpl = fetch } = {}) {
  try {
    if (await sha256(destination) === dependency.sha256) return;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const temporaryPath = `${destination}.download`;
  await rm(temporaryPath, { force: true });
  const response = await fetchImpl(dependency.url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Stažení ${path.basename(destination)} selhalo: HTTP ${response.status}`);
  }
  await pipeline(
    Readable.fromWeb(/** @type {any} */ (response.body)),
    createWriteStream(temporaryPath, { mode: 0o600 }),
  );
  const actual = await sha256(temporaryPath);
  if (actual !== dependency.sha256) {
    await rm(temporaryPath, { force: true });
    throw new Error(`${path.basename(destination)} má SHA-256 ${actual}, očekáváno ${dependency.sha256}`);
  }
  await cp(temporaryPath, destination);
  await rm(temporaryPath, { force: true });
}

export function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} ukončil signál ${signal}`));
      else if (code !== 0) reject(new Error(`${command} skončil s kódem ${code}`));
      else resolve(undefined);
    });
  });
}

function runCapture(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, arguments_, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} ukončil signál ${signal}`));
      else if (code !== 0) reject(new Error(`${command} skončil s kódem ${code}: ${stderr.trim()}`));
      else resolve(stdout.trim());
    });
  });
}

function target(arch) {
  return arch === "arm64"
    ? { clangArch: "arm64", ffmpegArch: "aarch64", host: "aarch64-apple-darwin" }
    : { clangArch: "x86_64", ffmpegArch: "x86_64", host: "x86_64-apple-darwin" };
}

export function ffmpegConfigureArguments({ arch, opusPrefix, deploymentTarget }) {
  const targetInfo = target(arch);
  const commonFlags = `-arch ${targetInfo.clangArch} -mmacosx-version-min=${deploymentTarget}`;
  return [
    "--prefix=/media-encoder",
    "--target-os=darwin",
    `--arch=${targetInfo.ffmpegArch}`,
    "--cc=clang",
    "--enable-cross-compile",
    "--disable-autodetect",
    "--disable-everything",
    "--disable-shared",
    "--enable-static",
    "--enable-small",
    "--disable-debug",
    "--disable-doc",
    "--disable-network",
    "--disable-avdevice",
    "--disable-swscale",
    "--disable-postproc",
    "--disable-ffplay",
    "--disable-ffprobe",
    "--disable-asm",
    "--enable-ffmpeg",
    "--enable-libopus",
    "--enable-decoder=opus",
    "--enable-encoder=libopus",
    "--enable-demuxer=matroska",
    "--enable-muxer=webm",
    "--enable-parser=opus",
    "--enable-protocol=file,pipe",
    "--enable-filter=aformat,aresample,adelay,apad,atrim,asetpts,join,pan,anullsrc,abuffer,abuffersink",
    `--extra-cflags=${commonFlags} -I${opusPrefix}/include/opus`,
    `--extra-ldflags=${commonFlags} -L${opusPrefix}/lib`,
  ];
}

async function buildArchitecture({ arch, lock, sourcesRoot, workRoot, outputRoot, jobs }) {
  const targetInfo = target(arch);
  const deploymentTarget = lock.deploymentTarget;
  const environment = {
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    LC_ALL: "C",
    LANG: "C",
    TZ: "UTC",
    ZERO_AR_DATE: "1",
    SOURCE_DATE_EPOCH: "1781913600",
    MACOSX_DEPLOYMENT_TARGET: deploymentTarget,
    CC: "clang",
  };
  const buildRoot = path.join(workRoot, arch);
  const opusSource = path.join(buildRoot, `opus-${lock.opus.version}`);
  const ffmpegSource = path.join(buildRoot, `ffmpeg-${lock.ffmpeg.version}`);
  const opusBuild = path.join(buildRoot, "opus-build");
  const opusPrefix = path.join(buildRoot, "opus-prefix");
  const ffmpegBuild = path.join(buildRoot, "ffmpeg-build");
  await rm(buildRoot, { recursive: true, force: true });
  await mkdir(buildRoot, { recursive: true });
  environment.TMPDIR = path.join(buildRoot, "tmp");
  await mkdir(environment.TMPDIR, { mode: 0o700 });
  await run("tar", ["-xf", path.join(sourcesRoot, `opus-${lock.opus.version}.tar.gz`), "-C", buildRoot], { env: environment });
  await run("tar", ["-xf", path.join(sourcesRoot, `ffmpeg-${lock.ffmpeg.version}.tar.xz`), "-C", buildRoot], { env: environment });
  await mkdir(opusBuild);
  const compileFlags = `-O2 -arch ${targetInfo.clangArch} -mmacosx-version-min=${deploymentTarget} -fno-common`;
  await run(path.join(opusSource, "configure"), [
    `--prefix=${opusPrefix}`,
    `--host=${targetInfo.host}`,
    "--disable-shared",
    "--enable-static",
    "--disable-extra-programs",
    "--disable-doc",
  ], { cwd: opusBuild, env: { ...environment, CFLAGS: compileFlags, LDFLAGS: compileFlags } });
  await run("make", [`-j${jobs}`], { cwd: opusBuild, env: environment });
  await run("make", ["install"], { cwd: opusBuild, env: environment });
  await mkdir(ffmpegBuild);
  // FFmpeg vyžaduje pkg-config jen pro explicitně zapnutý libopus. Vlastní úzký
  // adaptér čte právě tento staticky sestavený prefix a nepotřebuje Homebrew.
  const pkgConfigDirectory = path.join(buildRoot, "pkg-config-bin");
  await mkdir(pkgConfigDirectory);
  const pkgConfig = path.join(pkgConfigDirectory, "pkg-config");
  await writeFile(pkgConfig, `#!/bin/sh
case " $* " in
  *" --version "*) printf '1.0.0\\n'; exit 0 ;;
esac
case " $* " in *" opus "*|*" opus >= "*) ;; *) exit 1 ;; esac
case " $* " in
  *" --exists "*) exit 0 ;;
  *" --cflags-only-I "*|*" --cflags "*) printf '%s\\n' "-I$OPUS_PREFIX/include/opus" ;;
  *" --libs "*) printf '%s\\n' "-L$OPUS_PREFIX/lib -lopus" ;;
  *" --variable=includedir "*) printf '%s\\n' "$OPUS_PREFIX/include" ;;
  *) exit 1 ;;
esac
`, { mode: 0o700 });
  const configureArguments = ffmpegConfigureArguments({
    arch,
    opusPrefix: path.relative(ffmpegBuild, opusPrefix),
    deploymentTarget,
  });
  await run(path.join(ffmpegSource, "configure"), configureArguments, { cwd: ffmpegBuild,
    env: { ...environment, PATH: `${pkgConfigDirectory}:${environment.PATH}`, OPUS_PREFIX: opusPrefix } });
  await run("make", [`-j${jobs}`, "ffmpeg"], { cwd: ffmpegBuild, env: environment });
  const destination = path.join(outputRoot, `darwin-${arch}`);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(path.join(ffmpegBuild, "ffmpeg"), path.join(destination, "ffmpeg"));
  await chmod(path.join(destination, "ffmpeg"), 0o755);
  await run("codesign", [
    "--force",
    "--sign", "-",
    "--timestamp=none",
    "--options", "runtime",
    "--identifier", "cz.ludone.desktop.media-encoder",
    path.join(destination, "ffmpeg"),
  ], { env: environment });
  const manifest = {
    schemaVersion: 1,
    arch,
    deploymentTarget,
    ffmpeg: { version: lock.ffmpeg.version, sha256: lock.ffmpeg.sha256 },
    opus: { version: lock.opus.version, sha256: lock.opus.sha256 },
    configureArguments,
    binarySha256: await sha256(path.join(destination, "ffmpeg")),
    machOCanonicalSha256: await machOCanonicalSha256(path.join(destination, "ffmpeg")),
  };
  await writeFile(path.join(destination, "BUILD.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function verifyPreparedArchitecture({ arch, lock, versionRoot }) {
  const directory = path.join(versionRoot, `darwin-${arch}`);
  const binary = path.join(directory, "ffmpeg");
  const info = await lstat(binary);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o111) === 0) {
    throw new Error(`${arch}: ffmpeg není spustitelný běžný soubor`);
  }
  const manifest = JSON.parse(await readFile(path.join(directory, "BUILD.json"), "utf8"));
  if (manifest.arch !== arch
    || manifest.ffmpeg?.version !== lock.ffmpeg.version
    || manifest.ffmpeg?.sha256 !== lock.ffmpeg.sha256
    || manifest.opus?.version !== lock.opus.version
    || manifest.opus?.sha256 !== lock.opus.sha256) {
    throw new Error(`${arch}: BUILD.json neodpovídá připnutým zdrojům`);
  }
  const actualHash = await sha256(binary);
  if (manifest.binarySha256 !== actualHash) throw new Error(`${arch}: SHA-256 binárky nesouhlasí s BUILD.json`);
  const canonicalHash = await machOCanonicalSha256(binary);
  if (manifest.machOCanonicalSha256 !== canonicalHash) {
    throw new Error(`${arch}: kanonický Mach-O SHA-256 nesouhlasí s BUILD.json`);
  }
  await runCapture("codesign", ["--verify", "--strict", binary], {
    env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LC_ALL: "C" },
  });
  const architectures = (await runCapture("lipo", ["-archs", binary], {
    env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LC_ALL: "C" },
  })).split(/\s+/);
  const expected = arch === "x64" ? "x86_64" : "arm64";
  if (architectures.length !== 1 || architectures[0] !== expected) {
    throw new Error(`${arch}: binárka obsahuje architektury ${architectures.join(", ")}`);
  }
  return { binary, binarySha256: actualHash, canonicalSha256: canonicalHash, manifest };
}

export async function verifyNativeSignatureInvariance(binary) {
  const proofRoot = await mkdtemp(path.join(tmpdir(), "ludone-encoder-signature-"));
  const copy = path.join(proofRoot, "ffmpeg");
  try {
    await cp(binary, copy);
    const before = await sha256(copy);
    const canonical = await machOCanonicalSha256(copy);
    await run("codesign", ["--force", "--sign", "-", "--timestamp=none", "--options", "runtime",
      "--identifier", "cz.ludone.desktop.media-encoder.resign-proof-with-longer-identifier", copy], {
      env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LC_ALL: "C", TMPDIR: proofRoot },
    });
    if (await sha256(copy) === before || await machOCanonicalSha256(copy) !== canonical) {
      throw new Error("Kanonický Mach-O SHA-256 se změnil při skutečném opakovaném podpisu");
    }
  } finally {
    await rm(proofRoot, { recursive: true, force: true });
  }
}

async function verifyPreparedSources({ lock, sourcesRoot }) {
  for (const dependency of [lock.ffmpeg, lock.opus]) {
    const archive = path.join(sourcesRoot, path.basename(new URL(dependency.url).pathname));
    if (await sha256(archive) !== dependency.sha256) {
      throw new Error(`${path.basename(archive)} má nesprávný SHA-256`);
    }
  }
  for (const name of ["README.md", "LICENSE.txt", "media-encoder-lock.json", "prepare-media-encoder.mjs"]) {
    const info = await lstat(path.join(sourcesRoot, name));
    if (!info.isFile() || info.isSymbolicLink() || info.size <= 0) {
      throw new Error(`Zdrojový bundle postrádá běžný soubor ${name}`);
    }
  }
  for (const oldArchive of ["lame-3.100.tar.gz", "opus-1.5.2.tar.gz"]) {
    try {
      await lstat(path.join(sourcesRoot, oldArchive));
      throw new Error(`Zdrojový bundle stále obsahuje nepoužívaný archiv ${oldArchive}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  if (!sourceBundleMode) {
    const originals = new Map([
      ["README.md", path.join(projectRoot, "build", "media-encoder", "README.md")],
      ["LICENSE.txt", path.join(projectRoot, "build", "media-encoder", "LICENSE.txt")],
      ["media-encoder-lock.json", lockPath],
      ["prepare-media-encoder.mjs", fileURLToPath(import.meta.url)],
    ]);
    for (const [name, original] of originals) {
      if (await sha256(path.join(sourcesRoot, name)) !== await sha256(original)) {
        throw new Error(`Zdrojový bundle obsahuje zastaralý ${name}`);
      }
    }
  }
}

/** @param {{architectures?: string[], check?: boolean, force?: boolean}} [options] */
export async function prepareMediaEncoder(options = {}) {
  const { architectures, check = false, force = false } = options;
  if (process.platform !== "darwin") throw new Error("Media encoder lze sestavit jen na macOS");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  const selected = architectures ?? ["arm64", "x64"];
  const versionRoot = path.join(runtimeRoot, `ffmpeg-${lock.ffmpeg.version}`);
  const sourcesRoot = sourceBundleMode ? scriptDirectory : path.join(versionRoot, "sources");
  if (check) {
    await verifyPreparedSources({ lock, sourcesRoot });
    for (const arch of selected) {
      const { binary } = await verifyPreparedArchitecture({ arch, lock, versionRoot });
      await verifyNativeSignatureInvariance(binary);
    }
    console.log(`[encoder] PASS: zdroje a binárky ${selected.join(", ")} odpovídají locku, hashi a architektuře.`);
    return;
  }
  const workRoot = path.join(versionRoot, "work");
  await mkdir(sourcesRoot, { recursive: true });
  const ffmpegArchive = path.join(sourcesRoot, `ffmpeg-${lock.ffmpeg.version}.tar.xz`);
  const opusArchive = path.join(sourcesRoot, `opus-${lock.opus.version}.tar.gz`);
  await downloadVerified(lock.ffmpeg, ffmpegArchive);
  await downloadVerified(lock.opus, opusArchive);
  await rm(path.join(sourcesRoot, "lame-3.100.tar.gz"), { force: true });
  await rm(path.join(sourcesRoot, "opus-1.5.2.tar.gz"), { force: true });
  if (!sourceBundleMode) {
    await cp(lockPath, path.join(sourcesRoot, "media-encoder-lock.json"));
    await cp(path.join(projectRoot, "build", "media-encoder", "README.md"), path.join(sourcesRoot, "README.md"));
    await cp(path.join(projectRoot, "build", "media-encoder", "LICENSE.txt"), path.join(sourcesRoot, "LICENSE.txt"));
    await cp(fileURLToPath(import.meta.url), path.join(sourcesRoot, "prepare-media-encoder.mjs"));
  }
  const jobs = Math.max(1, Number(process.env.LUDONE_ENCODER_JOBS) || 4);
  for (const arch of selected) {
    const binary = path.join(versionRoot, `darwin-${arch}`, "ffmpeg");
    if (!force) {
      try {
        await access(binary);
        await verifyPreparedArchitecture({ arch, lock, versionRoot });
        console.log(`[encoder] ${arch}: existující binárka odpovídá locku; --force ji sestaví znovu.`);
        continue;
      } catch (error) {
        console.warn(`[encoder] ${arch}: cache nelze použít (${error.message}); sestavuji znovu.`);
      }
    }
    console.log(`[encoder] ${arch}: sestavuji FFmpeg ${lock.ffmpeg.version} + Opus ${lock.opus.version}.`);
    await buildArchitecture({ arch, lock, sourcesRoot, workRoot, outputRoot: versionRoot, jobs });
    await verifyPreparedArchitecture({ arch, lock, versionRoot });
  }
  console.log(`[encoder] Hotovo: ${versionRoot}`);
}

async function main() {
  await prepareMediaEncoder(parseArguments(process.argv.slice(2)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`[encoder] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
