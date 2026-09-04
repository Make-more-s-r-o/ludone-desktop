import { describe, expect, it } from "vitest";
import {
  SMOKE_SURFACE,
  buildSmokeReport,
  chooseInitialSmokeRoute,
  formatScreenshotList,
  formatSmokeReport,
  recognizeSmokeSurface,
  validateAuthWaitingUrl,
  validatePngScreenshot,
} from "../src/lib/ui-smoke.js";

const AUTH_CHECKS = [
  "auth-entry",
  "auth-waiting",
  "auth-url",
  "auth-copy",
  "auth-retry",
  "auth-cancel",
];
const AUTH_SCREENS = [
  "auth-entry",
  "auth-waiting",
  "auth-waiting-retry",
  "auth-entry-after-cancel",
  "auth-waiting-after-cancel-reentry",
  "auth-entry-final",
];
const PANEL_CHECKS = [
  "panel",
  "recording",
  "tracking",
  "settings-account",
  "settings-audio",
  "settings-recordings",
  "settings-diagnostics",
  "settings-restored",
  "panel-return",
];
const PANEL_SCREENS = [
  "panel-idle",
  "recording",
  "recording-and-tracking",
  "recording-naming-before-skip",
  "tracking-only",
  "panel-idle-after-tracking",
  "panel-configured",
  "configured-tracking",
  "panel-idle-after-configured-tracking",
  "quick-recording",
  "recording-naming-before-submit",
  "panel-after-submit",
  "settings-account",
  "settings-audio",
  "settings-audio-changed",
  "settings-recordings",
  "settings-recordings-changed",
  "settings-diagnostics",
  "settings-audio-restored",
  "settings-recordings-restored",
  "panel-final",
];

function screenArtifacts(names) {
  return names.map((name, index) => ({
    name,
    path: `.runtime/smoke/${String(index + 1).padStart(2, "0")}-${name}.png`,
  }));
}

function validAuthUrl(origin = "https://app.ludone.cz") {
  const url = new URL("/api/mcp/oauth/authorize", origin);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", "desktop-client");
  url.searchParams.set("redirect_uri", "http://127.0.0.1:43210/callback");
  url.searchParams.set("scope", "mcp:read");
  url.searchParams.set("state", "s".repeat(43));
  url.searchParams.set("code_challenge", "c".repeat(43));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", `${origin}/api/mcp`);
  return url;
}

describe("rozhodnutí ui-smoke podle skutečně viditelného povrchu", () => {
  it("přihlášený profil pozná podle panelu a pokračuje jeho ověřením", () => {
    const surface = recognizeSmokeSurface({
      authentication: false,
      authWaiting: false,
      checkingSession: false,
      panel: true,
      signedIn: true,
      welcome: false,
    });

    expect(surface).toBe(SMOKE_SURFACE.AUTHENTICATED_PANEL);
    expect(chooseInitialSmokeRoute(surface)).toBe("panel-and-settings");
  });

  it("nepřihlášený profil vede k hranici OAuth, ne rovnou do panelu", () => {
    const welcome = recognizeSmokeSurface({ welcome: true });
    const authentication = recognizeSmokeSurface({ authentication: true });
    const waiting = recognizeSmokeSurface({ authWaiting: true });

    expect(chooseInitialSmokeRoute(welcome)).toBe("onboarding-to-auth-boundary");
    expect(chooseInitialSmokeRoute(authentication)).toBe("onboarding-to-auth-boundary");
    expect(chooseInitialSmokeRoute(waiting)).toBe("auth-boundary");
  });

  it("přechodný ani rozporný DOM neprohlásí za přihlášený", () => {
    const checking = recognizeSmokeSurface({ checkingSession: true, panel: true });
    const contradictory = recognizeSmokeSurface({
      authentication: true,
      panel: true,
      signedIn: true,
    });

    expect(checking).toBe(SMOKE_SURFACE.CHECKING_SESSION);
    expect(chooseInitialSmokeRoute(checking)).toBe("wait-for-session");
    expect(contradictory).toBe(SMOKE_SURFACE.UNKNOWN);
    expect(chooseInitialSmokeRoute(contradictory)).toBe("unknown");
  });
});

describe("adresa na čekací obrazovce", () => {
  it("přijme úplný OAuth PKCE požadavek pro oba povolené LuDone originy", () => {
    for (const origin of ["https://app.ludone.cz", "https://labs.ludone.cz"]) {
      expect(validateAuthWaitingUrl(validAuthUrl(origin).href, origin)).toMatchObject({
        origin,
        pathname: "/api/mcp/oauth/authorize",
        redirectUri: "http://127.0.0.1:43210/callback",
        state: "s".repeat(43),
      });
    }
  });

  it("přijme kterékoli připuštěné prostředí, když dostane jejich seznam", () => {
    // Panel se na nastavené prostředí zeptat nesmí (auth:origin patří jen Nastavení),
    // takže brána dostává seznam prostředí, která aplikace vůbec připouští.
    const seznam = ["https://app.ludone.cz", "https://labs.ludone.cz"];
    for (const origin of seznam) {
      expect(validateAuthWaitingUrl(validAuthUrl(origin).href, seznam)).toMatchObject({ origin });
    }
  });

  it("se seznamem prostředí pořád odmítne adresu mimo něj", () => {
    const cizi = validAuthUrl("https://labs.ludone.cz");
    expect(() => validateAuthWaitingUrl(cizi.href, ["https://app.ludone.cz"]))
      .toThrow("není úplný OAuth PKCE požadavek pro LuDone");
    expect(() => validateAuthWaitingUrl(validAuthUrl().href, []))
      .toThrow("Očekávaný LuDone origin není platný.");
  });

  it("nedovolí, aby resource ukazoval do jiného prostředí než adresa sama", () => {
    // Se seznamem by mohl projít mix: adresa na labs a resource na produkci.
    const mix = validAuthUrl("https://labs.ludone.cz");
    mix.searchParams.set("resource", "https://app.ludone.cz/api/mcp");
    expect(() => validateAuthWaitingUrl(mix.href, ["https://app.ludone.cz", "https://labs.ludone.cz"]))
      .toThrow("není úplný OAuth PKCE požadavek pro LuDone");
  });

  it("odmítne nezabezpečený nebo cizí origin i prefixovanou cestu", () => {
    const http = validAuthUrl();
    http.protocol = "http:";
    const foreign = validAuthUrl("https://labs.ludone.cz");
    const prefixed = validAuthUrl();
    prefixed.pathname = "/prefix/api/mcp/oauth/authorize";

    expect(() => validateAuthWaitingUrl(http.href, "https://app.ludone.cz"))
      .toThrow("není úplný OAuth PKCE požadavek pro LuDone");
    expect(() => validateAuthWaitingUrl(foreign.href, "https://app.ludone.cz"))
      .toThrow("není úplný OAuth PKCE požadavek pro LuDone");
    expect(() => validateAuthWaitingUrl(prefixed.href, "https://app.ludone.cz"))
      .toThrow("není úplný OAuth PKCE požadavek pro LuDone");
  });

  it("odmítne chybějící nebo změněný bezpečnostní parametr", () => {
    const mutations = [
      { label: "chybějící resource", mutate: (url) => url.searchParams.delete("resource") },
      {
        label: "jiný response_type",
        mutate: (url) => url.searchParams.set("response_type", "token"),
      },
      { label: "jiný scope", mutate: (url) => url.searchParams.set("scope", "openid") },
      {
        label: "cizí resource",
        mutate: (url) => url.searchParams.set("resource", "https://evil.invalid/api/mcp"),
      },
      { label: "krátký state", mutate: (url) => url.searchParams.set("state", "kratky") },
      {
        label: "krátká challenge",
        mutate: (url) => url.searchParams.set("code_challenge", "kratka"),
      },
      {
        label: "jiná PKCE metoda",
        mutate: (url) => url.searchParams.set("code_challenge_method", "plain"),
      },
      {
        label: "duplicitní state",
        mutate: (url) => url.searchParams.append("state", "x".repeat(43)),
      },
      { label: "userinfo", mutate: (url) => { url.username = "uzivatel"; } },
      { label: "fragment", mutate: (url) => { url.hash = "unik"; } },
    ];

    for (const { label, mutate } of mutations) {
      const url = validAuthUrl();
      mutate(url);
      expect(() => validateAuthWaitingUrl(url.href, "https://app.ludone.cz"), label)
        .toThrow("není úplný OAuth PKCE požadavek pro LuDone");
    }
  });

  it("odmítne redirect mimo přesný dočasný loopback callback", () => {
    for (const redirect of [
      "https://127.0.0.1:43210/callback",
      "http://localhost:43210/callback",
      "http://127.0.0.1/callback",
      "http://127.0.0.1:0/callback",
      "http://127.0.0.1:43210/jinam",
    ]) {
      const url = validAuthUrl();
      url.searchParams.set("redirect_uri", redirect);
      expect(() => validateAuthWaitingUrl(url.href, "https://app.ludone.cz"))
        .toThrow("nemá platný loopback redirect_uri");
    }
  });
});

describe("pravdivý souhrn ui-smoke", () => {
  it("na konci neobsluhované části vrátí nenulový kód a doslovně vyjmenuje vše za OAuth", () => {
    const report = buildSmokeReport({
      outcome: "auth-boundary",
      screens: screenArtifacts(AUTH_SCREENS),
      verifiedChecks: AUTH_CHECKS,
    });

    expect(report).toMatchObject({
      complete: false,
      exitCode: 2,
      status: "manual-auth-required",
      unverified: [
        "obrazovka oprávnění",
        "test záznamu",
        "obrazovka Hotovo",
        "panel",
        "nastavení",
      ],
    });
    expect(formatSmokeReport(report)).toBe([
      "🟡 ui-smoke: dosažen konec neobsluhované části.",
      "Důvod: běh dosáhl čekací hranice OAuth; pokračování za ní vyžaduje člověka a nejde o Timeout.",
      "Ověřeno:",
      "- přihlašovací obrazovka",
      "- čekací obrazovka „Čekám na prohlížeč“",
      "- viditelná a úplná adresa přihlášení",
      "- Kopírovat zobrazenou adresu",
      "- Zkusit znovu s novým OAuth state",
      "- Zrušit, funkční nový pokus a čistý návrat k přihlášení",
      "Neověřeno (vyžaduje dokončené přihlášení člověkem):",
      "- obrazovka oprávnění",
      "- test záznamu",
      "- obrazovka Hotovo",
      "- panel",
      "- nastavení",
      "Výsledek: celý ui-smoke není ověřen; končím kódem 2.",
    ].join("\n"));
  });

  it("žádnou jednotlivou povinnou kontrolu ani snímek nelze vynechat", () => {
    for (const { outcome, checks, screenNames } of [
      { checks: AUTH_CHECKS, outcome: "auth-boundary", screenNames: AUTH_SCREENS },
      {
        checks: PANEL_CHECKS,
        outcome: "authenticated-profile",
        screenNames: PANEL_SCREENS,
      },
    ]) {
      for (const omitted of checks) {
        expect(() => buildSmokeReport({
          outcome,
          screens: screenArtifacts(screenNames),
          verifiedChecks: checks.filter((check) => check !== omitted),
        }), `vynechaná kontrola ${outcome}/${omitted}`).toThrow("chybí kontroly");
      }
      for (const omitted of screenNames) {
        expect(() => buildSmokeReport({
          outcome,
          screens: screenArtifacts(screenNames.filter((name) => name !== omitted)),
          verifiedChecks: checks,
        }), `vynechaný snímek ${outcome}/${omitted}`).toThrow("chybí snímky");
      }
    }
  });

  it("název každého snímku musí odpovídat jeho souboru", () => {
    const screens = screenArtifacts(AUTH_SCREENS);
    screens[2].path = ".runtime/smoke/03-jina-obrazovka.png";

    expect(() => buildSmokeReport({
      outcome: "auth-boundary",
      screens,
      verifiedChecks: AUTH_CHECKS,
    })).toThrow("nemá odpovídající název a cestu");
  });

  it("přihlášená větev smí skončit nulou jen s úplným panelem a nastavením", () => {
    const report = buildSmokeReport({
      outcome: "authenticated-profile",
      screens: screenArtifacts(PANEL_SCREENS),
      verifiedChecks: PANEL_CHECKS,
    });
    const output = formatSmokeReport(report);

    expect(report).toMatchObject({
      complete: true,
      exitCode: 0,
      notCovered: ["onboarding (přihlášený profil jej přeskočil)"],
      status: "authenticated-profile-complete",
      unverified: [],
    });
    expect(output).toContain("větev přihlášeného profilu dokončena");
    expect(output).toContain("- onboarding (přihlášený profil jej přeskočil)");
    expect(output).not.toContain("Neověřeno: nic");
    expect(output).not.toContain("celý průchod");
  });

  it("přijme jen neprázdné PNG a na konci vypíše každý jeho soubor", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

    expect(validatePngScreenshot(png)).toBe(9);
    expect(() => validatePngScreenshot(Uint8Array.from([0x89, 0x50, 0x4e])))
      .toThrow("CDP nevrátil platná PNG data snímku");
    expect(formatScreenshotList([
      ".runtime/smoke/01-welcome.png",
      ".runtime/smoke/02-auth.png",
    ])).toBe([
      "Snímky tohoto běhu:",
      "- .runtime/smoke/01-welcome.png",
      "- .runtime/smoke/02-auth.png",
    ].join("\n"));
  });
});
