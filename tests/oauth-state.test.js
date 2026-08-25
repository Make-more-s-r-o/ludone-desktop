import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildAuthorizationUrl,
  buildTokenRequestBody,
  generateState,
  verifyState,
} from "../src/lib/oauth.js";

describe("OAuth state", () => {
  it("přijme totožný state", () => {
    expect(verifyState("stejny-state", "stejny-state")).toBe(true);
  });

  it("odmítne odlišný state", () => {
    expect(verifyState("ocekavany-state", "podvrzeny-state")).toBe(false);
  });

  it.each([undefined, "", null])("odmítne chybějící nebo prázdný state: %s", (returnedState) => {
    expect(verifyState("ocekavany-state", returnedState)).toBe(false);
  });

  it("odmítne shodu pouhého prefixu", () => {
    expect(verifyState("abc", "abcdef")).toBe(false);
  });

  it("generuje state výhradně z povinného zdroje náhodnosti", () => {
    expect(generateState((size) => Buffer.alloc(size, 0xa5))).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(() => generateState()).toThrow(/zdroj náhodnosti/);
  });

  it("generuje 50 různých state s 256 bity dodané náhodnosti", () => {
    const states = Array.from({ length: 50 }, () => generateState(randomBytes));

    expect(new Set(states)).toHaveLength(states.length);
    for (const state of states) {
      expect(Buffer.from(state, "base64url")).toHaveLength(32);
    }
  });
});

describe("OAuth požadavky", () => {
  it("sestaví autorizační URL s PKCE S256 a state", () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: "https://labs.ludone.cz/api/mcp/oauth/authorize",
      clientId: "desktop-client",
      redirectUri: "http://127.0.0.1:49152/callback",
      scope: "mcp:read",
      state: "ocekavany-state",
      codeChallenge: "challenge",
      resource: "https://labs.ludone.cz/api/mcp",
    });

    expect(url.origin).toBe("https://labs.ludone.cz");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "desktop-client",
      redirect_uri: "http://127.0.0.1:49152/callback",
      state: "ocekavany-state",
      code_challenge: "challenge",
      code_challenge_method: "S256",
    });
  });

  it("sestaví formulář výměny kódu bez klientského tajemství", () => {
    const body = buildTokenRequestBody({
      code: "authorization-code",
      codeVerifier: "verifier",
      redirectUri: "http://127.0.0.1:49152/callback",
      clientId: "desktop-client",
      resource: "https://labs.ludone.cz/api/mcp",
    });

    expect(Object.fromEntries(body)).toEqual({
      grant_type: "authorization_code",
      code: "authorization-code",
      code_verifier: "verifier",
      redirect_uri: "http://127.0.0.1:49152/callback",
      client_id: "desktop-client",
      resource: "https://labs.ludone.cz/api/mcp",
    });
    expect(body.has("client_secret")).toBe(false);
  });
});
