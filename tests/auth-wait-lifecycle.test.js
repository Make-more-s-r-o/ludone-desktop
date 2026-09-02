import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createAuthController } = require("../electron/auth.cjs");

function jsonResult(value) {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => value),
  };
}

class FakeLoopbackServer extends EventEmitter {
  constructor() {
    super();
    this.listening = false;
    this.close = vi.fn(() => {
      this.listening = false;
    });
    this.listen = vi.fn(() => {
      this.listening = true;
      queueMicrotask(() => this.emit("listening"));
    });
  }

  address() {
    return { address: "127.0.0.1", family: "IPv4", port: 49721 };
  }
}

function loopbackServerFactory() {
  return new FakeLoopbackServer();
}

function testController({ timeoutMs = 100 } = {}) {
  const issuer = "https://app.ludone.cz";
  const fetchImpl = vi.fn(async (input) => {
    const url = new URL(input);
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return jsonResult({
        issuer,
        authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
        token_endpoint: `${issuer}/api/mcp/oauth/token`,
        registration_endpoint: `${issuer}/api/mcp/oauth/register`,
        code_challenge_methods_supported: ["S256"],
      });
    }
    if (url.pathname === "/api/mcp/oauth/register") {
      return jsonResult({ client_id: "desktop-test-client" });
    }
    throw new Error(`Neočekávaný požadavek ${url.href}`);
  });
  const shell = { openExternal: vi.fn(async (url = "") => url) };
  const controller = createAuthController({
    issuer,
    timeoutMs,
    fetchImpl,
    app: { getPath: vi.fn(() => "/tmp/ludone-auth-test") },
    loopbackServerFactory,
    safeStorage: {},
    shell,
  });
  return { controller, shell };
}

describe("životní cyklus čekání na přihlášení", () => {
  it("zpřístupní autorizační adresu a dovolí čekání zrušit", async () => {
    const { controller, shell } = testController();
    const attempt = await controller.start();

    expect(attempt.authorizationUrl).toBe(shell.openExternal.mock.calls[0][0]);
    expect(new URL(attempt.authorizationUrl).pathname).toBe("/api/mcp/oauth/authorize");

    attempt.cancel();
    await expect(attempt.result).rejects.toThrow(/zrušeno/);
  });

  it("po vypršení limitu samo ukončí čekání", async () => {
    const { controller } = testController({ timeoutMs: 20 });
    const attempt = await controller.start();

    await expect(attempt.result).rejects.toThrow(/časovém limitu/);
  });
});
