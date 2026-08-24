import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createCodeChallenge,
  createPkce,
  generateCodeVerifier,
} from "../src/lib/oauth.js";

const KNOWN_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const KNOWN_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("PKCE S256", () => {
  it("počítá challenge jako base64url SHA-256 známého verifieru", () => {
    const independentlyCalculated = createHash("sha256")
      .update(KNOWN_VERIFIER, "ascii")
      .digest("base64url");

    expect(independentlyCalculated).toBe(KNOWN_CHALLENGE);
    expect(createCodeChallenge(KNOWN_VERIFIER)).toBe(KNOWN_CHALLENGE);
  });

  it("vrací base64url challenge bez znaků =, + a /", () => {
    expect(createCodeChallenge(KNOWN_VERIFIER)).not.toMatch(/[=+/]/);
  });

  it("generuje verifier povolené délky a abecedy z předaného zdroje náhodnosti", () => {
    const verifier = generateCodeVerifier((size) => Buffer.alloc(size, 0xfb));

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9._~-]+$/);
  });

  it("pro dva různé verifiery počítá dvě různé challenge", () => {
    const first = createPkce((size) => Buffer.alloc(size, 0x11));
    const second = createPkce((size) => Buffer.alloc(size, 0x22));

    expect(first.codeVerifier).not.toBe(second.codeVerifier);
    expect(first.codeChallenge).not.toBe(second.codeChallenge);
    expect(first.codeChallengeMethod).toBe("S256");
  });
});
