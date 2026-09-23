import { spawn } from "node:child_process";
import { access, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generujIkonuAplikace } from "./tray-ikony.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const require = createRequire(import.meta.url);
const packageManifest = require(path.join(projectRoot, "package.json"));
const builderConfig = packageManifest.build;
// Změna bundle id resetuje dříve udělená oprávnění macOS.
const BUNDLE_ID = "cz.ludone.desktop";

function hasValue(environment, name) {
  return typeof environment[name] === "string" && environment[name].trim().length > 0;
}

function signingPlan(source) {
  const environment = { ...source };
  const certificateVariables = ["CSC_LINK", "CSC_KEY_PASSWORD"];
  const linkedCertificateComplete = certificateVariables.every((name) => (
    hasValue(environment, name)
  ));
  const namedCertificatePresent = hasValue(environment, "CSC_NAME");
  const signingEnabled = linkedCertificateComplete || namedCertificatePresent;
  const apiVariables = ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];
  const appleIdVariables = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];
  const keychainVariables = ["APPLE_KEYCHAIN", "APPLE_KEYCHAIN_PROFILE"];
  const notaryGroups = [apiVariables, appleIdVariables, keychainVariables];
  const notarizationEnabled = signingEnabled
    && notaryGroups.some((group) => group.every((name) => hasValue(environment, name)));
  const configArguments = [];

  if (!signingEnabled) {
    const missing = certificateVariables.filter((name) => !hasValue(environment, name));
    console.warn(
      `[balení] NEPODEPSANÝ build: podpis a notarizace jsou vypnuté; chybí ${missing.join(", ")}.`,
    );
    // Ani částečná konfigurace nesmí builder svést k pokusu o import certifikátu.
    delete environment.CSC_LINK;
    delete environment.CSC_KEY_PASSWORD;
    environment.CSC_IDENTITY_AUTO_DISCOVERY = "false";
    configArguments.push(
      "--config.mac.identity=null",
      "--config.mac.hardenedRuntime=false",
      "--config.mac.notarize=false",
    );
  } else {
    // Chybný certifikát nesmí skončit jen varováním a publikováním nepodepsaného releasu.
    configArguments.push("--config.forceCodeSigning=true");
    if (!notarizationEnabled) {
      const attemptedGroup = notaryGroups.find((group) => (
        group.some((name) => hasValue(environment, name))
      )) ?? apiVariables;
      const missing = attemptedGroup.filter((name) => !hasValue(environment, name));
      console.warn(
        `[balení] Podpis je zapnutý, notarizace je vypnutá; chybí ${missing.join(", ")}.`,
      );
      configArguments.push("--config.mac.notarize=false");
    }
  }

  return { configArguments, environment, notarizationEnabled, signingEnabled };
}

function requestedBuildMode(arguments_) {
  if (arguments_.length === 0) return "package";
  if (arguments_.length === 1 && arguments_[0] === "--release") return "release";
  throw new Error("Použití: node scripts/package-mac.mjs [--release]");
}

function verifyConfig(config) {
  if (!config || config.appId !== BUNDLE_ID) {
    throw new Error(`Bundle id se nesmí změnit: očekáváno ${BUNDLE_ID}`);
  }
  if (!config.files?.includes("src/pisma/**/*")) {
    throw new Error("Konfigurace balení neobsahuje src/pisma/");
  }
  if (!config.mac?.extendInfo?.NSAudioCaptureUsageDescription) {
    throw new Error("Konfigurace balení neobsahuje NSAudioCaptureUsageDescription");
  }
  const encoderSource = ".runtime/media-encoder/ffmpeg-6.1.6/darwin-${arch}/ffmpeg";
  const encoderResource = config.extraResources?.find(({ from, to }) => (
    from === encoderSource && to === "media-encoder/ffmpeg"
  ));
  if (!encoderResource) {
    throw new Error("Konfigurace balení neobsahuje media encoder vybraný podle architektury");
  }
  if (!config.extraResources?.some(({ to }) => to === "media-encoder/sources")) {
    throw new Error("Konfigurace balení neobsahuje zdrojové podklady media encoderu");
  }
  if (!config.mac?.binaries?.includes("Contents/Resources/media-encoder/ffmpeg")) {
    throw new Error("Konfigurace podpisu neobsahuje přibalený media encoder");
  }
  const targets = new Map(config.mac.target?.map(({ target, arch }) => [target, arch]));
  for (const target of ["dmg", "zip"]) {
    if (JSON.stringify(targets.get(target)) !== JSON.stringify(["arm64", "x64"])) {
      throw new Error(`Cíl ${target} musí obsahovat arm64 i x64`);
    }
  }
}

function runBuilder({ arguments_, environment, executable }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      cwd: projectRoot,
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`electron-builder ukončil signál ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`electron-builder skončil s kódem ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function preserveAudioSmokePath(outputDirectory) {
  const outputName = process.arch === "arm64" ? "mac-arm64" : "mac";
  const builtApp = path.join(outputDirectory, outputName, "LuDone Desktop.app");
  const compatibilityApp = path.join(outputDirectory, "LuDone Desktop.app");
  await access(builtApp);
  await rm(compatibilityApp, { recursive: true, force: true });
  await symlink(path.relative(outputDirectory, builtApp), compatibilityApp);
  console.log(`[balení] Audio-smoke cesta: ${compatibilityApp} -> ${builtApp}`);
}

const buildMode = requestedBuildMode(process.argv.slice(2));
verifyConfig(builderConfig);
const outputDirectory = path.resolve(
  process.env.LUDONE_PACKAGE_OUTPUT_DIR
    || path.join(projectRoot, builderConfig.directories.output),
);
const executable = process.env.LUDONE_BUILDER_EXECUTABLE
  || path.join(projectRoot, "node_modules", ".bin", "electron-builder");
const plan = signingPlan(process.env);
if (buildMode === "release" && (!plan.signingEnabled || !plan.notarizationEnabled)) {
  throw new Error("Nepodepsaný nebo nenotarizovaný build nelze publikovat do update kanálu.");
}
// Generic provider nic nepřenáší. Režim `always` zde pouze přikáže electron-builderu
// vytvořit latest-mac.yml a blockmapy; skutečný přenos provádí až release workflow.
const builderPublishMode = buildMode === "release" ? "always" : "never";
const arguments_ = ["--mac", "--publish", builderPublishMode, ...plan.configArguments];
if (process.env.LUDONE_PACKAGE_OUTPUT_DIR) {
  arguments_.push(`--config.directories.output=${outputDirectory}`);
}

// Generujeme před každým balením i releasem: ikona tak nikdy nezůstane starší
// než sdílený glyf lišty a čistý checkout nepotřebuje verzovanou binární kopii.
generujIkonuAplikace(path.resolve(projectRoot, builderConfig.mac.icon));
await runBuilder({ arguments_, environment: plan.environment, executable });
await preserveAudioSmokePath(outputDirectory);
console.log(
  buildMode === "release"
    ? "[balení] Hotovo: podepsané release artefakty a update metadata jsou připravené; nic nebylo přeneseno."
    : "[balení] Hotovo: lokální DMG + ZIP pro arm64 a x64; nic nebylo přeneseno.",
);
