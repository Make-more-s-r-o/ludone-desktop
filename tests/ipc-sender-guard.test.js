import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Funkce ${name} nebyla nalezena`);

  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Funkce ${name} nemá uzavřené tělo`);
}

const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const distRoot = path.resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const trustedUrl = pathToFileURL(path.join(distRoot, "index.html")).toString();
const createGuard = Function(
  "path",
  "fileURLToPath",
  "DIST_ROOT",
  `"use strict";
  ${functionSource(mainSource, "isTrustedAppUrl")}
  ${functionSource(mainSource, "isTrustedWebContents")}
  ${functionSource(mainSource, "isTrustedRecordingSender")}
  return isTrustedRecordingSender;`,
);
const isTrustedRecordingSender = createGuard(path, fileURLToPath, distRoot);

function createWebContents(url = trustedUrl, destroyed = false) {
  const mainFrame = {};
  return {
    mainFrame,
    isDestroyed: () => destroyed,
    getURL: () => url,
  };
}

describe("ochrana odesílatele nahrávacího IPC", () => {
  it("povolí očekávané okno a jeho hlavní rám", () => {
    const expected = createWebContents();
    expect(isTrustedRecordingSender(
      { sender: expected, senderFrame: expected.mainFrame },
      expected,
    )).toBe(true);
  });

  it("odmítne jiné webContents", () => {
    const expected = createWebContents();
    const foreign = createWebContents();
    expect(isTrustedRecordingSender(
      { sender: foreign, senderFrame: foreign.mainFrame },
      expected,
    )).toBe(false);
  });

  it("odmítne iframe očekávaného okna", () => {
    const expected = createWebContents();
    expect(isTrustedRecordingSender(
      { sender: expected, senderFrame: {} },
      expected,
    )).toBe(false);
  });

  it("odmítne zničené webContents bez výjimky", () => {
    const destroyed = createWebContents(trustedUrl, true);
    expect(() => isTrustedRecordingSender(
      { sender: destroyed, senderFrame: destroyed.mainFrame },
      destroyed,
    )).not.toThrow();
    expect(isTrustedRecordingSender(
      { sender: destroyed, senderFrame: destroyed.mainFrame },
      destroyed,
    )).toBe(false);
  });

  it("odmítne souborovou URL, která jen začíná povolenou cestou", () => {
    const malicious = createWebContents(`${trustedUrl}.evil`);
    expect(isTrustedRecordingSender(
      { sender: malicious, senderFrame: malicious.mainFrame },
      malicious,
    )).toBe(false);
  });

  it("odmítne HTTPS doménu, která jen začíná povoleným názvem", () => {
    const malicious = createWebContents("https://app.ludone.cz.utocnik.cz");
    expect(isTrustedRecordingSender(
      { sender: malicious, senderFrame: malicious.mainFrame },
      malicious,
    )).toBe(false);
  });

  it("produkční guard používá otestovanou čistou kontrolu", () => {
    expect(functionSource(mainSource, "requireTrustedRecordingSender")).toContain(
      "isTrustedRecordingSender(event, panelWindow?.webContents)",
    );
  });
});
