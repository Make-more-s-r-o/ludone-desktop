import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

export const PKCE_METHOD = "S256";

const VERIFIER_BYTES = 32;
const STATE_BYTES = 32;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

function requiredString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} musí být neprázdný řetězec`);
  }
  return value;
}

function randomBase64Url(randomSource, byteLength, name) {
  if (typeof randomSource !== "function") {
    throw new TypeError(`${name} vyžaduje zdroj náhodnosti`);
  }

  const bytes = randomSource(byteLength);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== byteLength) {
    throw new TypeError(`${name} musí dostat právě ${byteLength} náhodných bajtů`);
  }

  return Buffer.from(bytes).toString("base64url");
}

export function generateCodeVerifier(randomSource) {
  const verifier = randomBase64Url(randomSource, VERIFIER_BYTES, "code_verifier");
  if (!VERIFIER_PATTERN.test(verifier)) {
    throw new Error("Vygenerovaný code_verifier nesplňuje PKCE");
  }
  return verifier;
}

export function createCodeChallenge(verifier) {
  requiredString(verifier, "code_verifier");
  if (!VERIFIER_PATTERN.test(verifier)) {
    throw new TypeError("code_verifier musí mít 43–128 povolených znaků");
  }

  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function createPkce(randomSource) {
  const codeVerifier = generateCodeVerifier(randomSource);
  return {
    codeVerifier,
    codeChallenge: createCodeChallenge(codeVerifier),
    codeChallengeMethod: PKCE_METHOD,
  };
}

export function generateState(randomSource) {
  return randomBase64Url(randomSource, STATE_BYTES, "state");
}

export function verifyState(expectedState, returnedState) {
  if (
    typeof expectedState !== "string"
    || typeof returnedState !== "string"
    || expectedState.length === 0
    || returnedState.length === 0
    || expectedState.length !== returnedState.length
  ) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < expectedState.length; index += 1) {
    difference |= expectedState.charCodeAt(index) ^ returnedState.charCodeAt(index);
  }
  return difference === 0;
}

export function buildAuthorizationUrl({
  authorizationEndpoint,
  clientId,
  redirectUri,
  scope,
  state,
  codeChallenge,
  resource,
}) {
  const url = new URL(requiredString(authorizationEndpoint, "authorizationEndpoint"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", requiredString(clientId, "clientId"));
  url.searchParams.set("redirect_uri", requiredString(redirectUri, "redirectUri"));
  url.searchParams.set("scope", requiredString(scope, "scope"));
  url.searchParams.set("state", requiredString(state, "state"));
  url.searchParams.set("code_challenge", requiredString(codeChallenge, "codeChallenge"));
  url.searchParams.set("code_challenge_method", PKCE_METHOD);
  if (resource !== undefined) {
    url.searchParams.set("resource", requiredString(resource, "resource"));
  }
  return url;
}

export function buildTokenRequestBody({
  code,
  codeVerifier,
  redirectUri,
  clientId,
  resource,
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: requiredString(code, "code"),
    code_verifier: requiredString(codeVerifier, "codeVerifier"),
    redirect_uri: requiredString(redirectUri, "redirectUri"),
    client_id: requiredString(clientId, "clientId"),
  });
  if (resource !== undefined) {
    body.set("resource", requiredString(resource, "resource"));
  }
  return body;
}

export function buildRefreshTokenRequestBody({ refreshToken, clientId, resource }) {
  return new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: requiredString(refreshToken, "refreshToken"),
    client_id: requiredString(clientId, "clientId"),
    resource: requiredString(resource, "resource"),
  });
}
