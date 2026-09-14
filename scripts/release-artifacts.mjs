import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const require = createRequire(import.meta.url);
const packageManifest = require(path.join(projectRoot, "package.json"));

function parseScalar(source) {
  const value = source.trim();
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  return value;
}

export function parseMacUpdateMetadata(source) {
  const metadata = { files: [] };
  let currentFile = null;

  for (const line of source.split(/\r?\n/)) {
    const fileStart = line.match(/^[ ]{2}- url:\s*(.+)$/);
    if (fileStart) {
      currentFile = { url: parseScalar(fileStart[1]) };
      metadata.files.push(currentFile);
      continue;
    }

    const fileProperty = line.match(/^[ ]{4}(sha512|size):\s*(.+)$/);
    if (fileProperty && currentFile) {
      currentFile[fileProperty[1]] = fileProperty[1] === "size"
        ? Number.parseInt(fileProperty[2], 10)
        : parseScalar(fileProperty[2]);
      continue;
    }

    const rootProperty = line.match(/^(version|path|sha512|releaseDate):\s*(.+)$/);
    if (rootProperty) {
      currentFile = null;
      metadata[rootProperty[1]] = parseScalar(rootProperty[2]);
    }
  }

  return metadata;
}

function artifactName(version, arch, extension) {
  return packageManifest.build.artifactName
    .replace("${version}", version)
    .replace("${arch}", arch)
    .replace("${ext}", extension);
}

export function expectedReleaseFileNames(version = packageManifest.version) {
  const packages = ["arm64", "x64"].flatMap((arch) => (
    ["dmg", "zip"].map((extension) => artifactName(version, arch, extension))
  ));
  return {
    metadata: "latest-mac.yml",
    packages,
    blockmaps: packages.map((name) => `${name}.blockmap`),
  };
}

async function regularFileInfo(filePath) {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${path.basename(filePath)} není běžný soubor`);
  }
  if (info.size <= 0) throw new Error(`${path.basename(filePath)} je prázdný`);
  return info;
}

async function digest(filePath, algorithm, encoding) {
  const content = await readFile(filePath);
  return createHash(algorithm).update(content).digest(encoding);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

export async function validateReleaseArtifacts(directory, { version = packageManifest.version } = {}) {
  const expected = expectedReleaseFileNames(version);
  const metadataPath = path.join(directory, expected.metadata);
  await regularFileInfo(metadataPath);
  const metadata = parseMacUpdateMetadata(await readFile(metadataPath, "utf8"));

  if (metadata.version !== version) {
    throw new Error(`latest-mac.yml má verzi ${metadata.version ?? "neuvedenou"}, očekáváno ${version}`);
  }
  if (!Array.isArray(metadata.files) || metadata.files.length !== expected.packages.length) {
    throw new Error(`latest-mac.yml musí obsahovat právě ${expected.packages.length} balíčky`);
  }

  const metadataNames = metadata.files.map((file) => file.url);
  if (JSON.stringify(sorted(metadataNames)) !== JSON.stringify(sorted(expected.packages))) {
    throw new Error(`latest-mac.yml odkazuje na jinou sadu balíčků: ${metadataNames.join(", ")}`);
  }

  const duplicateNames = metadataNames.filter((name, index) => metadataNames.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    throw new Error(`latest-mac.yml obsahuje duplicitní URL: ${duplicateNames.join(", ")}`);
  }

  const releaseDate = Date.parse(metadata.releaseDate);
  if (!Number.isFinite(releaseDate)) throw new Error("latest-mac.yml nemá platné releaseDate");

  const packageResults = [];
  for (const entry of metadata.files) {
    if (path.basename(entry.url) !== entry.url || entry.url.includes("\\") || entry.url.includes("%")) {
      throw new Error(`Neplatná relativní URL artefaktu: ${entry.url}`);
    }
    const filePath = path.join(directory, entry.url);
    const info = await regularFileInfo(filePath);
    if (!Number.isSafeInteger(entry.size) || entry.size !== info.size) {
      throw new Error(`${entry.url}: metadata uvádějí velikost ${entry.size}, soubor má ${info.size}`);
    }
    const sha512 = await digest(filePath, "sha512", "base64");
    if (entry.sha512 !== sha512) throw new Error(`${entry.url}: SHA-512 nesouhlasí s latest-mac.yml`);
    packageResults.push({ name: entry.url, size: info.size, sha512 });
  }

  if (!expected.packages.includes(metadata.path)) {
    throw new Error(`Kořenový path latest-mac.yml není očekávaný balíček: ${metadata.path}`);
  }
  const primary = packageResults.find(({ name }) => name === metadata.path);
  if (metadata.sha512 !== primary?.sha512) {
    throw new Error("Kořenový sha512 latest-mac.yml nesouhlasí s balíčkem z path");
  }

  for (const blockmap of expected.blockmaps) await regularFileInfo(path.join(directory, blockmap));

  const publishFiles = [expected.metadata, ...expected.packages, ...expected.blockmaps];
  const artifacts = [];
  for (const name of sorted(publishFiles)) {
    const filePath = path.join(directory, name);
    const info = await regularFileInfo(filePath);
    artifacts.push({ name, size: info.size, sha256: await digest(filePath, "sha256", "hex") });
  }

  return { version, artifacts, metadata };
}

export async function writeReleaseReviewFiles(directory, validation) {
  const manifestPath = path.join(directory, "release-manifest.json");
  const checksumsPath = path.join(directory, "SHA256SUMS");
  const manifest = {
    schemaVersion: 1,
    version: validation.version,
    artifacts: validation.artifacts,
    updateMetadata: validation.metadata,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await writeFile(
    checksumsPath,
    `${validation.artifacts.map(({ name, sha256 }) => `${sha256}  ${name}`).join("\n")}\n`,
    { mode: 0o600 },
  );
  return { checksumsPath, manifestPath };
}

function parseArguments(arguments_) {
  let directory = path.join(projectRoot, packageManifest.build.directories.output);
  let writeReviewFiles = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    if (arguments_[index] === "--directory" && arguments_[index + 1]) {
      directory = path.resolve(arguments_[index + 1]);
      index += 1;
    } else if (arguments_[index] === "--write-review-files") {
      writeReviewFiles = true;
    } else {
      throw new Error("Použití: node scripts/release-artifacts.mjs [--directory CESTA] [--write-review-files]");
    }
  }
  return { directory, writeReviewFiles };
}

async function main() {
  const { directory, writeReviewFiles } = parseArguments(process.argv.slice(2));
  const validation = await validateReleaseArtifacts(directory);
  console.log(`PASS latest-mac.yml: verze ${validation.version}, čtyři balíčky a jejich SHA-512`);
  console.log("PASS release artefakty: DMG + ZIP + blockmap pro arm64 a x64");
  if (writeReviewFiles) {
    await writeReleaseReviewFiles(directory, validation);
    console.log("PASS review soubory: release-manifest.json + SHA256SUMS");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`FAIL release artefakty: ${error.message}`);
    process.exitCode = 1;
  });
}
