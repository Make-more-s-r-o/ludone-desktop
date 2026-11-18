import { spawn, execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { readCompanyDefault, writeCompanyDefault } = require("../electron/upload-company-default.cjs");
const companyId = "11111111-1111-4111-8111-111111111111";
const session = { issuer: "https://app.ludone.cz", resource: "https://app.ludone.cz/api/mcp",
  scope: "nahravky:upload", identity: { email: "a@example.test" }, userinfoSubject: "42" };
const roots = [];
async function directory() { const root = await mkdtemp(path.join(tmpdir(), "company-storage-")); roots.push(root); return root; }
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

it("N5 odmítne symlink a příliš velký soubor bez čtení cizí předvolby", async () => {
  const root = await directory();
  const file = path.join(root, "upload-company-defaults.json");
  const target = path.join(root, "cizi.json");
  await writeFile(target, JSON.stringify([{ issuer: session.issuer, subject: "42", companyId }]));
  await symlink(target, file);
  await expect(readCompanyDefault(root, session)).resolves.toBeNull();
  await fs.unlink(file);
  await writeFile(file, ` ${" ".repeat(256 * 1024)}[]`);
  await expect(readCompanyDefault(root, session)).resolves.toBeNull();
});

it("N5 čtení FIFO se neblokuje a vrátí prázdnou předvolbu", async () => {
  const root = await directory();
  execFileSync("mkfifo", [path.join(root, "upload-company-defaults.json")]);
  const modulePath = require.resolve("../electron/upload-company-default.cjs");
  const source = "const m=require(process.argv[1]);m.readCompanyDefault(process.argv[2],JSON.parse(process.argv[3])).then(v=>process.exit(v===null?0:2),()=>process.exit(3));";
  const child = spawn(process.execPath, ["-e", source, modulePath, root, JSON.stringify(session)], { stdio: "ignore" });
  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve("timeout"); }, 1000);
    child.once("exit", (code) => { clearTimeout(timer); resolve(code); });
  });
  expect(result).toBe(0);
});

it("N5 nastaví 0600 na otevřeném dočasném souboru před rename bez chmod cílové cesty", async () => {
  const root = await directory();
  const file = path.join(root, "upload-company-defaults.json");
  const rename = fs.rename.bind(fs); let temporaryMode;
  vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (String(to) === file) temporaryMode = (await fs.stat(from)).mode & 0o777;
    return rename(from, to);
  });
  const chmod = fs.chmod.bind(fs);
  vi.spyOn(fs, "chmod").mockImplementation(async (target, mode) => {
    if (String(target) === file) throw new Error("chmod podle cílové cesty");
    return chmod(target, mode);
  });
  await writeCompanyDefault(root, session, companyId);
  expect(temporaryMode).toBe(0o600);
  expect(JSON.parse(await readFile(file, "utf8"))[0].companyId).toBe(companyId);
});
