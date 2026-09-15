import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = new URL("../scripts/publish-release-remote.sh", import.meta.url).pathname;
const temporaryRoots = new Set();

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function stagingFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-remote-publish-"));
  temporaryRoots.add(root);
  const publishPath = path.join(root, "desktop");
  const stagingName = ".incoming-test";
  const stagingPath = path.join(publishPath, stagingName);
  const files = ["LuDone-Desktop-test-arm64.zip", "latest-mac.yml"];
  await mkdir(stagingPath, { recursive: true });
  const contents = new Map([
    [files[0], Buffer.from("nový balíček")],
    [files[1], Buffer.from("version: test\n")],
  ]);
  for (const [name, content] of contents) await writeFile(path.join(stagingPath, name), content);
  await writeFile(
    path.join(stagingPath, "SHA256SUMS"),
    `${files.map((name) => `${sha256(contents.get(name))}  ${name}`).join("\n")}\n`,
  );
  return { contents, files, publishPath, stagingName, stagingPath };
}

describe("serverová část publikace", () => {
  it("při vadném hashi ponechá dosavadní feed beze změny", async () => {
    const fixture = await stagingFixture();
    await writeFile(path.join(fixture.publishPath, "latest-mac.yml"), "version: old\n");
    await writeFile(path.join(fixture.stagingPath, fixture.files[0]), "poškozený přenos");

    const result = spawnSync("sh", [scriptPath, fixture.publishPath, fixture.stagingName, ...fixture.files], {
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(await readFile(path.join(fixture.publishPath, "latest-mac.yml"), "utf8")).toBe("version: old\n");
    await expect(readFile(path.join(fixture.publishPath, fixture.files[0]))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("přesune verzované soubory před atomickou výměnou latest-mac.yml", async () => {
    const fixture = await stagingFixture();
    const tools = path.join(path.dirname(fixture.publishPath), "tools");
    const moveLog = path.join(path.dirname(fixture.publishPath), "move.log");
    await mkdir(tools);
    const mockMove = path.join(tools, "mv");
    await writeFile(mockMove, "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$MOVE_LOG\"\nexec /bin/mv \"$@\"\n");
    await chmod(mockMove, 0o700);

    const result = spawnSync("sh", [scriptPath, fixture.publishPath, fixture.stagingName, ...fixture.files], {
      encoding: "utf8",
      env: { ...process.env, MOVE_LOG: moveLog, PATH: `${tools}:/usr/bin:/bin:/sbin` },
    });

    expect(result.status, result.stderr).toBe(0);
    const moves = (await readFile(moveLog, "utf8")).trim().split("\n");
    expect(moves.at(-1)).toContain("latest-mac.yml");
    expect(moves[0]).toContain(fixture.files[0]);
    expect(await readFile(path.join(fixture.publishPath, fixture.files[0]))).toEqual(fixture.contents.get(fixture.files[0]));
    expect(await readFile(path.join(fixture.publishPath, "latest-mac.yml"), "utf8")).toBe("version: test\n");
  });
});
