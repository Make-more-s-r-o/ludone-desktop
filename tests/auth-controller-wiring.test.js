import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createAuthController: realCreateAuthController } = require("../electron/auth.cjs");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Funkce ${name} nebyla nalezena`);

  const openingParen = source.indexOf("(", start);
  let parenDepth = 0;
  let afterParams = -1;
  for (let index = openingParen; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        afterParams = index;
        break;
      }
    }
  }
  if (afterParams < 0) throw new Error(`Funkce ${name} nemá uzavřené parametry`);

  const openingBrace = source.indexOf("{", afterParams);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Funkce ${name} nemá uzavřené tělo`);
}

const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../electron/auth.cjs", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");
const AUTH_WIRING_APP_DATA = path.join(tmpdir(), `ludone-auth-wiring-${process.pid}`);

afterAll(async () => {
  await rm(AUTH_WIRING_APP_DATA, { recursive: true, force: true });
});

function compiledAuthWiring(createAuthController) {
  return Function(
    "createAuthController",
    `"use strict";
     ${functionSource(mainSource, "resolveAuthIssuer")}
     ${functionSource(mainSource, "resolveAuthClientId")}
     ${functionSource(mainSource, "createAuthBeginHandler")}
     return createAuthBeginHandler(createAuthController);`,
  )(createAuthController);
}

const fakeApp = { getPath: vi.fn(() => AUTH_WIRING_APP_DATA), isPackaged: false };
const fakeSafeStorage = { isEncryptionAvailable: vi.fn(() => true) };

function dependencies(overrides = {}) {
  return {
    app: fakeApp,
    // Platný clientId je v základu, aby testy měřily zapojení. Jeho NEPŘÍTOMNOST
    // má vlastní test níž — je to fail-closed cesta z rozhodnutí BD-N6.
    env: { LUDONE_OAUTH_CLIENT_ID: "klient-z-konfigurace" },
    isTestRun: false,
    logger: { log: vi.fn(), warn: vi.fn() },
    safeStorage: fakeSafeStorage,
    shell: { openExternal: vi.fn() },
    ...overrides,
  };
}

function successfulController(calls, user = { name: "Zkušební Účet", email: "zkouska@makemore.cz" }) {
  return (options) => {
    calls.push(options);
    return {
      async start() {
        return {
          authorizationUrl: `${options.issuer}/api/mcp/oauth/authorize`,
          cancel: vi.fn(),
          result: Promise.resolve({ ok: true, user }),
        };
      },
    };
  };
}

class FakeLoopbackServer extends EventEmitter {
  constructor() {
    super();
    this.listening = false;
  }

  address() {
    return { address: "127.0.0.1", family: "IPv4", port: 49721 };
  }

  close() {
    this.listening = false;
  }

  listen() {
    this.listening = true;
    queueMicrotask(() => this.emit("listening"));
  }
}

describe("zapojení skutečného OAuth controlleru", () => {
  it("KANÁREK: auth:begin zůstává za handleValidated jen pro panel", () => {
    expect(mainSource).toMatch(/handleValidated\(\s*"auth:begin",\s*\["panel"\]/);
  });

  it("produkční auth:begin neobsahuje atrapu", () => {
    expect(mainSource.split("mock-token-not-persisted").length - 1).toBe(0);
    expect(mainSource.split("Daniel Novák").length - 1).toBe(0);
  });

  it("importuje controller a safeStorage a vystavuje zrušení v preloadu", () => {
    expect(mainSource).toMatch(/\bsafeStorage\b/);
    expect(mainSource).toMatch(/require\("\.\/auth\.cjs"\)/);
    expect(mainSource).toMatch(/\bcreateAuthController\b/);
    expect(preloadSource).toMatch(/cancelAuth:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("auth:cancel"\)/);
  });

  it.each([
    [undefined, "https://app.ludone.cz", "klient-prod"],
    ["https://labs.ludone.cz", "https://labs.ludone.cz", "klient-labs"],
  ])("použije LUDONE_ORIGIN %s a clientId Z KONFIGURACE", async (origin, issuer, clientId) => {
    const calls = [];
    const env = { LUDONE_OAUTH_CLIENT_ID: clientId };
    if (origin) env.LUDONE_ORIGIN = origin;
    const handler = compiledAuthWiring(successfulController(calls))(dependencies({ env }));

    await expect(handler()).resolves.toEqual({
      ok: true,
      user: { name: "Zkušební Účet", email: "zkouska@makemore.cz" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ issuer, clientId, app: fakeApp, safeStorage: fakeSafeStorage });
    expect(calls[0].timeoutMs).toBeUndefined();
    expect(calls[0].scope).toBeUndefined();
    expect(calls[0].resource).toBeUndefined();
  });

  it.each([
    "http://app.ludone.cz",
    "https://app.ludone.cz?x=1",
    "https://a:b@app.ludone.cz",
    "https://app.ludone.cz#x",
    "https://app.ludone.cz/cesta",
    "https://app.ludone.cz:444",
    "https://jiny.example",
    "",
  ])("nedůvěryhodný origin %s selže bez controlleru", async (origin) => {
    const createController = vi.fn();
    const shell = { openExternal: vi.fn() };
    const handler = compiledAuthWiring(createController)(
      dependencies({
        env: {
          LUDONE_ORIGIN: origin,
          LUDONE_OAUTH_CLIENT_ID: "klient-pro-neduveryhodny-origin",
        },
        shell,
      }),
    );

    await expect(handler()).resolves.toEqual({ ok: false, duvod: "konfigurace" });
    expect(createController).not.toHaveBeenCalled();
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it("nepropustí technickou výjimku z factory", async () => {
    const handler = compiledAuthWiring(() => {
      throw new Error("E7 se smí autorizovat jen k MCP resource issueru; token nevydán");
    })(dependencies());

    const result = await handler();
    expect(result).toEqual({ ok: false, duvod: "konfigurace" });
    expect(JSON.stringify(result)).not.toMatch(/MCP|scope|token/i);
  });

  it.each([
    ["Přihlášení se v časovém limitu nevrátilo", "vyprselo"],
    ["OAuth odmítl přihlášení: access_denied", "odmitnuto"],
    ["Přihlášení bylo zrušeno", "odmitnuto"],
    ["Bezpečné úložiště systému není dostupné", "uloziste"],
    ["TypeError: fetch failed", "bez-site"],
    ["LuDone nevrátilo úplnou identitu uživatele", "neznama"],
  ])("přeloží chybu %s na %s", async (message, expectedReason) => {
    const handler = compiledAuthWiring(() => ({
      async start() {
        return {
          authorizationUrl: "https://app.ludone.cz/api/mcp/oauth/authorize",
          cancel: vi.fn(),
          result: Promise.reject(new Error(message)),
        };
      },
    }))(dependencies());

    await expect(handler()).resolves.toEqual({ ok: false, duvod: expectedReason });
  });

  it("při zrušení předá abort do pokusu controlleru", async () => {
    const cancel = vi.fn();
    const signalController = new AbortController();
    let rejectResult;
    const result = new Promise((resolve, reject) => {
      rejectResult = reject;
    });
    const handler = compiledAuthWiring(() => ({
      async start() {
        return {
          authorizationUrl: "https://app.ludone.cz/api/mcp/oauth/authorize",
          cancel: () => {
            cancel();
            rejectResult(new Error("Přihlášení bylo zrušeno"));
          },
          result,
        };
      },
    }))(dependencies());

    const pending = handler({ signal: signalController.signal });
    await vi.waitFor(() => expect(cancel).not.toHaveBeenCalled());
    signalController.abort();
    await expect(pending).resolves.toEqual({ ok: false, duvod: "odmitnuto" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("v nezabaleném E2E vrátí testovací identitu bez controlleru", async () => {
    const createController = vi.fn();
    const handler = compiledAuthWiring(createController)(dependencies({ isTestRun: true }));

    const result = await handler();
    expect(Object.keys(result).sort()).toEqual(["ok", "user"]);
    expect(createController).not.toHaveBeenCalled();
  });

  it("v zabaleném buildu E2E větev nikdy neobejde přihlášení", async () => {
    const calls = [];
    const handler = compiledAuthWiring(successfulController(calls))(
      dependencies({ app: { ...fakeApp, isPackaged: true }, isTestRun: true }),
    );

    await expect(handler()).resolves.toMatchObject({ ok: true });
    expect(calls).toHaveLength(1);
  });

  it("zapojený tok vždy předá clientId, takže DCR fallback není dosažitelný", async () => {
    const calls = [];
    const handler = compiledAuthWiring(successfulController(calls))(dependencies());

    await handler();
    expect(calls[0].clientId).toBe("klient-z-konfigurace");
    expect(authSource).toContain("registerPublicClient");
  });

  it("se skutečným controllerem nevolá registrační endpoint", async () => {
    const issuer = "https://app.ludone.cz";
    const requestedPaths = [];
    const fetchImpl = vi.fn(async (input) => {
      const url = new URL(input);
      requestedPaths.push(url.pathname);
      if (url.pathname === "/.well-known/oauth-authorization-server") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            issuer,
            authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
            token_endpoint: `${issuer}/api/mcp/oauth/token`,
            registration_endpoint: `${issuer}/api/mcp/oauth/register`,
            revocation_endpoint: `${issuer}/api/mcp/oauth/revoke`,
            code_challenge_methods_supported: ["S256"],
          }),
        };
      }
      throw new Error(`Neočekávaný požadavek ${url.href}`);
    });
    const controller = new AbortController();
    const createController = (options) => realCreateAuthController({
      ...options,
      fetchImpl,
      loopbackServerFactory: () => new FakeLoopbackServer(),
      timeoutMs: 100,
    });
    const handler = compiledAuthWiring(createController)(dependencies({
      shell: {
        openExternal: vi.fn(async () => {
          queueMicrotask(() => controller.abort());
        }),
      },
    }));

    await expect(handler({ signal: controller.signal })).resolves.toEqual({
      ok: false,
      duvod: "odmitnuto",
    });
    expect(requestedPaths).toEqual(["/.well-known/oauth-authorization-server"]);
    expect(requestedPaths).not.toContain("/api/mcp/oauth/register");
  });

  it("skutečný preflight úložiště je zapojený do důvodu uloziste", async () => {
    const fetchImpl = vi.fn();
    const shell = { openExternal: vi.fn() };
    const createController = (options) => realCreateAuthController({ ...options, fetchImpl });
    const handler = compiledAuthWiring(createController)(dependencies({
      safeStorage: { isEncryptionAvailable: vi.fn(() => false) },
      shell,
    }));

    await expect(handler()).resolves.toEqual({ ok: false, duvod: "uloziste" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(shell.openExternal).not.toHaveBeenCalled();
  });
});

describe("BD-N6: clientId se nehádá, chybí-li, přihlášení se NEPOKUSÍ", () => {
  it.each([
    ["chybí úplně", {}],
    ["je prázdný", { LUDONE_OAUTH_CLIENT_ID: "" }],
    ["jsou jen mezery", { LUDONE_OAUTH_CLIENT_ID: "   " }],
    ["není řetězec", { LUDONE_OAUTH_CLIENT_ID: 42 }],
  ])("když %s, vrátí důvod konfigurace a controller ani nevznikne", async (_popis, env) => {
    const calls = [];
    const handler = compiledAuthWiring(successfulController(calls))(dependencies({ env }));

    await expect(handler()).resolves.toEqual({ ok: false, duvod: "konfigurace" });
    // 🔴 Nula je tady to podstatné: nesmí se ani pokusit. Kdyby se controller vytvořil,
    // sáhne na síť a uživatel dostane serverovou chybu místo srozumitelné věty.
    expect(calls).toHaveLength(0);
  });

  it("v kódu není zadrátovaný žádný identifikátor klienta", () => {
    // Vykonavatel si dvě konkrétní ID vymyslel a zadrátoval, přestože serverový záznam
    // pro ně neexistuje. Tenhle kanárek hlídá, aby se to nevrátilo.
    expect(mainSource).not.toMatch(/ldmcp_oauth_client/);
    expect(mainSource).not.toMatch(/staticClientIds/);
    // Jediný zdroj je proměnná prostředí.
    expect(mainSource).toMatch(/LUDONE_OAUTH_CLIENT_ID/);
  });
});

describe("mapování chyb nesmí zaměnit vadu kódu za vadu konfigurace", () => {
  it("programátorská chyba se hlásí jako neznámá, ne jako konfigurace", async () => {
    // Doloženo naostro při psaní téhle story: harness zapomněl injektovat resolveAuthClientId
    // a `ReferenceError: resolveAuthClientId is not defined` se kvůli volnému podřetězci
    // `clientId` zařadil jako „konfigurace". Uživatel by dostal větu „doplní správce"
    // u chyby, kterou žádný správce neopraví — a mě to na minutu svedlo ze stopy.
    const handler = compiledAuthWiring(() => {
      throw new ReferenceError("resolveAuthClientId is not defined");
    })(dependencies());

    await expect(handler()).resolves.toEqual({ ok: false, duvod: "neznama" });
  });

  it("skutečně chybějící konfigurace se pořád hlásí jako konfigurace", () => {
    // Povinně zelený protějšek: zúžení nesmí zabít správné zařazení.
    expect(mainSource).toMatch(/přihlášení zatím není nastavené/);
  });
});
