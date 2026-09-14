import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  expectedReleaseFileNames,
  validateReleaseArtifacts,
  writeReleaseReviewFiles,
} from "../scripts/release-artifacts.mjs";

const temporaryRoots = new Set();
const require = createRequire(import.meta.url);
const packageManifest = require("../package.json");

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

function sha512(content) {
  return createHash("sha512").update(content).digest("base64");
}

async function releaseFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-release-artifacts-"));
  temporaryRoots.add(root);
  const expected = expectedReleaseFileNames();
  const entries = [];
  for (const name of expected.packages) {
    const content = Buffer.from(`balíček:${name}`);
    await writeFile(path.join(root, name), content);
    entries.push({ name, content });
  }
  for (const name of expected.blockmaps) {
    await writeFile(path.join(root, name), Buffer.from(`blockmap:${name}`));
  }
  const primary = entries.find(({ name }) => name.endsWith("-x64.zip"));
  const metadata = [
    `version: ${packageManifest.version}`,
    "files:",
    ...entries.flatMap(({ name, content }) => [
      `  - url: ${name}`,
      `    sha512: ${sha512(content)}`,
      `    size: ${content.length}`,
    ]),
    `path: ${primary.name}`,
    `sha512: ${sha512(primary.content)}`,
    "releaseDate: '2026-09-14T12:00:00.000Z'",
    "",
  ].join("\n");
  await writeFile(path.join(root, expected.metadata), metadata);
  return { entries, expected, root };
}

describe("release artefakty", () => {
  it("ověří úplnou sadu pro obě architektury a zapíše auditní hashe", async () => {
    const fixture = await releaseFixture();

    const validation = await validateReleaseArtifacts(fixture.root);
    expect(validation.version).toBe(packageManifest.version);
    expect(validation.artifacts.map(({ name }) => name).sort()).toEqual([
      fixture.expected.metadata,
      ...fixture.expected.packages,
      ...fixture.expected.blockmaps,
    ].sort());

    const { checksumsPath, manifestPath } = await writeReleaseReviewFiles(fixture.root, validation);
    const checksums = await readFile(checksumsPath, "utf8");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    expect(checksums.trim().split("\n")).toHaveLength(9);
    expect(manifest).toMatchObject({ schemaVersion: 1, version: packageManifest.version });
    expect(manifest.artifacts).toHaveLength(9);
  });

  it("odmítne balíček, jehož obsah nesouhlasí s updater metadaty", async () => {
    const fixture = await releaseFixture();
    await writeFile(path.join(fixture.root, fixture.entries[0].name), "změněný obsah");

    await expect(validateReleaseArtifacts(fixture.root)).rejects.toThrow(/velikost|SHA-512/);
  });

  it("odmítne neúplnou sadu blockmap", async () => {
    const fixture = await releaseFixture();
    await rm(path.join(fixture.root, fixture.expected.blockmaps[0]));

    await expect(validateReleaseArtifacts(fixture.root)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
