#!/usr/bin/env bash
# Akceptace E3. Každá podmínka hlásí vlastní PASS/FAIL a skript při chybě skončí 1.
chyby=0
preskoceno=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/e3-akceptace.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/e3-akceptace.out; chyby=$((chyby+1))
  fi
}

preskoc() {
  echo "SKIP  $1"
  preskoceno=$((preskoceno+1))
}

podpis_je_nakonfigurovany() {
  # Stejné proměnné i ořezání prázdných hodnot jako signingPlan() v package-mac.mjs.
  node <<'NODE'
const hasValue = (name) => typeof process.env[name] === "string"
  && process.env[name].trim().length > 0;
console.log((hasValue("CSC_LINK") && hasValue("CSC_KEY_PASSWORD")) || hasValue("CSC_NAME"));
NODE
}

balici_skript_ma_audio_popis() {
  test -s scripts/package-mac.mjs \
    && grep -Fq "NSAudioCaptureUsageDescription" scripts/package-mac.mjs
}

balici_skript_nema_prototypove_id() {
  local prototypove_id="cz.ludone.desktop."prototype
  test -s scripts/package-mac.mjs \
    && ! grep -Fq "$prototypove_id" scripts/package-mac.mjs
}

balene_src_moduly_existuji() {
  node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

const references = new Set();
for (const file of filesUnder("electron").filter((candidate) => candidate.endsWith(".cjs"))) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/path\.join\(([^)]*["']src["'][^)]*)\)/gs)) {
    const parts = [...match[1].matchAll(/["']([^"']+)["']/g)].map((part) => part[1]);
    const srcIndex = parts.indexOf("src");
    if (srcIndex >= 0) references.add(path.join(...parts.slice(srcIndex)));
  }
}

if (references.size === 0) {
  console.error("V electron/** nebyl odvozen žádný modul načítaný ze src/");
  process.exit(1);
}

const missing = [...references].filter((relativePath) => (
  !fs.existsSync(relativePath)
  || !fs.existsSync(path.join("release", "LuDone Desktop.app", "Contents", "Resources", "app", relativePath))
));
const packagePath = path.join("release", "LuDone Desktop.app", "Contents", "Resources", "app", "package.json");
if (!fs.existsSync(packagePath) || JSON.parse(fs.readFileSync(packagePath, "utf8")).type !== "module") {
  missing.push("package.json:type=module");
}
if (missing.length > 0) {
  console.error(`V bundlu chybí moduly nebo ESM režim: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Odvozené moduly v bundlu: ${[...references].sort().join(", ")}`);
NODE
}

zkontroluj "balicí skript obsahuje NSAudioCaptureUsageDescription" \
  balici_skript_ma_audio_popis
zkontroluj "balicí skript neobsahuje prototypové bundle id" \
  balici_skript_nema_prototypove_id
zkontroluj "unit test autority tray ikony je zelený" \
  npm run test:unit -- tray-authority
zkontroluj "unit test kontroly odesílatele IPC je zelený" \
  npm run test:unit -- ipc-sender-guard

bundle="release/LuDone Desktop.app"
plist="$bundle/Contents/Info.plist"
if test -d "$bundle"; then
  zkontroluj "release bundle existuje" test -d "$bundle"
  plist_release_plati() {
    test -s "$plist" || return 1
    /usr/bin/plutil -p "$plist" > /tmp/e3-plist.out 2>&1 || return 1
    grep -Fq '"NSAudioCaptureUsageDescription"' /tmp/e3-plist.out \
      && grep -Fq '"CFBundleIdentifier" => "cz.ludone.desktop"' /tmp/e3-plist.out
  }
  zkontroluj "release plist má audio popis a ostré bundle id" plist_release_plati
  podpis=$(podpis_je_nakonfigurovany) || podpis=chyba
  case "$podpis" in
    true)
      zkontroluj "release bundle má platný podpis (podepisování je nakonfigurované)" \
        /usr/bin/codesign --verify --deep --strict "$bundle"
      ;;
    false)
      preskoc "podpis release bundlu: podepisování není nakonfigurované (vyžaduje CSC_LINK + CSC_KEY_PASSWORD nebo CSC_NAME)"
      ;;
    *)
      zkontroluj "konfiguraci podepisování lze vyhodnotit" false
      ;;
  esac
  zkontroluj "všechny moduly načítané z electron/** přes src/ jsou v bundlu" \
    balene_src_moduly_existuji
else
  zkontroluj "release bundle existuje; spusť npm run package:mac" test -d "$bundle"
  preskoc "release plist: bundle chybí"
  preskoc "podpis release bundlu: bundle chybí"
  preskoc "moduly src/ v bundlu: bundle chybí"
fi

echo "---"
echo "chyb: $chyby; přeskočeno: $preskoceno"
exit $(( chyby > 0 ? 1 : 0 ))
