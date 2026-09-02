#!/usr/bin/env node
// Brány nad ČISTÝM klonem — náhrada za to jediné, co nám GitHub Actions dávaly navíc
// oproti `npm run gates`: nezávislost na tomhle pracovním stromu.
//
// Lokální běh totiž měří strom, ve kterém máš necommitnuté soubory, starý `node_modules`
// a klidně i symlink na cizí instalaci. Tenhle skript vyrobí klon toho, co je OPRAVDU
// v commitu, nainstaluje závislosti z `package-lock.json` a teprve tam pustí brány.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const revision = process.argv[2] || "HEAD";
const commit = execFileSync("git", ["rev-parse", revision], { cwd: repoRoot, encoding: "utf8" }).trim();

const workspace = mkdtempSync(path.join(tmpdir(), "ludone-gates-"));
const checkout = path.join(workspace, "repo");
let failed = null;

function step(label, file, args, options = {}) {
  process.stdout.write(`\n▶ ${label}\n`);
  execFileSync(file, args, { cwd: checkout, stdio: "inherit", ...options });
}

try {
  console.log(`Čistý klon ${commit.slice(0, 8)} → ${checkout}`);
  execFileSync("git", ["clone", "--quiet", "--no-local", "--shared", repoRoot, checkout]);
  execFileSync("git", ["checkout", "--quiet", commit], { cwd: checkout });

  step("npm ci", "npm", ["ci", "--no-audit", "--no-fund"]);
  step("brány (lint · typecheck · testy)", "npm", ["run", "gates"]);
  step("build", "npm", ["run", "build"]);
} catch (error) {
  failed = error;
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

if (failed) {
  console.error(`\n🔴 Brány nad čistým klonem ${commit.slice(0, 8)} SPADLY.`);
  process.exit(1);
}
console.log(`\n🟢 Brány nad čistým klonem ${commit.slice(0, 8)} prošly.`);
