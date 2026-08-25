import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const sourceApp = path.join(projectRoot, "node_modules", "electron", "dist", "Electron.app");
const releaseDir = path.join(projectRoot, "release");
const outputApp = path.join(releaseDir, "LuDone Desktop.app");
const resourcesDir = path.join(outputApp, "Contents", "Resources");
const bundledAppDir = path.join(resourcesDir, "app");
const infoPlist = path.join(outputApp, "Contents", "Info.plist");
// Změna bundle id resetuje dříve udělená oprávnění macOS.
const BUNDLE_ID = "cz.ludone.desktop";

await mkdir(releaseDir, { recursive: true });
await rm(outputApp, { recursive: true, force: true });
await cp(sourceApp, outputApp, { recursive: true, verbatimSymlinks: true });

await mkdir(bundledAppDir, { recursive: true });
await cp(path.join(projectRoot, "dist"), path.join(bundledAppDir, "dist"), { recursive: true });
await cp(path.join(projectRoot, "electron"), path.join(bundledAppDir, "electron"), {
  recursive: true,
});
await mkdir(path.join(bundledAppDir, "src"), { recursive: true });
await cp(path.join(projectRoot, "src", "lib"), path.join(bundledAppDir, "src", "lib"), {
  recursive: true,
});

const sourcePackage = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
if (sourcePackage.type !== "module") {
  throw new Error("Balíček musí zachovat type=module pro ESM moduly v src/lib");
}
const bundledPackage = {
  name: sourcePackage.name,
  productName: "LuDone Desktop",
  version: sourcePackage.version,
  description: sourcePackage.description,
  main: sourcePackage.main,
  type: sourcePackage.type,
};
await writeFile(
  path.join(bundledAppDir, "package.json"),
  `${JSON.stringify(bundledPackage, null, 2)}\n`,
);

execFileSync("/usr/bin/plutil", [
  "-replace",
  "CFBundleDisplayName",
  "-string",
  "LuDone Desktop",
  infoPlist,
]);
execFileSync("/usr/bin/plutil", [
  "-replace",
  "CFBundleName",
  "-string",
  "LuDone Desktop",
  infoPlist,
]);
execFileSync("/usr/bin/plutil", [
  "-replace",
  "CFBundleIdentifier",
  "-string",
  BUNDLE_ID,
  infoPlist,
]);
execFileSync("/usr/bin/plutil", [
  "-replace",
  "NSMicrophoneUsageDescription",
  "-string",
  "LuDone potřebuje mikrofon pro oddělenou nahrávku vašeho hlasu.",
  infoPlist,
]);
execFileSync("/usr/bin/plutil", [
  "-replace",
  "NSAudioCaptureUsageDescription",
  "-string",
  "LuDone zachytává zvuk z ostatních aplikací, aby v nahrávce schůzky byla slyšet i druhá strana.",
  infoPlist,
]);
execFileSync("/usr/bin/plutil", ["-replace", "LSUIElement", "-bool", "YES", infoPlist]);
execFileSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", outputApp]);
console.log(`${outputApp} (lokální ad-hoc podepsaný prototyp)`);
