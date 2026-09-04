export const SMOKE_SURFACE = Object.freeze({
  AUTHENTICATED_PANEL: "authenticated-panel",
  AUTHENTICATION: "authentication",
  AUTH_WAITING: "auth-waiting",
  CHECKING_SESSION: "checking-session",
  UNKNOWN: "unknown",
  WELCOME: "welcome",
});

const CHECK_LABELS = Object.freeze({
  "auth-cancel": "Zrušit, funkční nový pokus a čistý návrat k přihlášení",
  "auth-copy": "Kopírovat zobrazenou adresu",
  "auth-entry": "přihlašovací obrazovka",
  "auth-retry": "Zkusit znovu s novým OAuth state",
  "auth-url": "viditelná a úplná adresa přihlášení",
  "auth-waiting": "čekací obrazovka „Čekám na prohlížeč“",
  "panel-return": "návrat do panelu",
  panel: "přihlášený panel",
  recording: "nahrávání a pojmenování",
  "settings-account": "nastavení: Účet",
  "settings-audio": "nastavení: Zvuk",
  "settings-diagnostics": "nastavení: Diagnostika",
  "settings-recordings": "nastavení: Záznamy",
  "settings-restored": "změna a obnovení nastavení",
  tracking: "LuTrack včetně souběhu s nahráváním",
  welcome: "uvítací obrazovka",
});

const POST_AUTH_UNVERIFIED = Object.freeze([
  "obrazovka oprávnění",
  "test záznamu",
  "obrazovka Hotovo",
  "panel",
  "nastavení",
]);

const BRANCH_REQUIREMENTS = Object.freeze({
  "auth-boundary": Object.freeze({
    checks: Object.freeze([
      "auth-entry",
      "auth-waiting",
      "auth-url",
      "auth-copy",
      "auth-retry",
      "auth-cancel",
    ]),
    complete: false,
    exitCode: 2,
    notCovered: Object.freeze([]),
    screens: Object.freeze([
      "auth-entry",
      "auth-waiting",
      "auth-waiting-retry",
      "auth-entry-after-cancel",
      "auth-waiting-after-cancel-reentry",
      "auth-entry-final",
    ]),
    status: "manual-auth-required",
    unverified: POST_AUTH_UNVERIFIED,
  }),
  "authenticated-profile": Object.freeze({
    checks: Object.freeze([
      "panel",
      "recording",
      "tracking",
      "settings-account",
      "settings-audio",
      "settings-recordings",
      "settings-diagnostics",
      "settings-restored",
      "panel-return",
    ]),
    complete: true,
    exitCode: 0,
    notCovered: Object.freeze(["onboarding (přihlášený profil jej přeskočil)"]),
    screens: Object.freeze([
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
    ]),
    status: "authenticated-profile-complete",
    unverified: Object.freeze([]),
  }),
});

function listLines(items) {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- nic"];
}

function missingItems(required, actual) {
  const actualSet = new Set(actual);
  return required.filter((item) => !actualSet.has(item));
}

function requireCleanOrigin(value) {
  let origin;
  try {
    origin = new URL(value);
  } catch {
    throw new Error("Očekávaný LuDone origin není platný.");
  }
  if (
    origin.protocol !== "https:"
    || !["app.ludone.cz", "labs.ludone.cz"].includes(origin.host)
    || origin.username
    || origin.password
    || origin.pathname !== "/"
    || origin.search
    || origin.hash
  ) {
    throw new Error("Očekávaný LuDone origin není povolený čistý HTTPS origin.");
  }
  return origin.origin;
}

function requireLoopbackRedirect(value) {
  let redirect;
  try {
    redirect = new URL(value);
  } catch {
    throw new Error("Adresa na čekací obrazovce nemá platný loopback redirect_uri.");
  }
  const port = Number(redirect.port);
  if (
    redirect.protocol !== "http:"
    || redirect.hostname !== "127.0.0.1"
    || !Number.isSafeInteger(port)
    || port < 1
    || port > 65_535
    || redirect.pathname !== "/callback"
    || redirect.username
    || redirect.password
    || redirect.search
    || redirect.hash
  ) {
    throw new Error("Adresa na čekací obrazovce nemá platný loopback redirect_uri.");
  }
  return redirect.href;
}

export function validatePngScreenshot(value) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    !(value instanceof Uint8Array)
    || value.byteLength <= signature.length
    || signature.some((byte, index) => value[index] !== byte)
  ) {
    throw new Error("CDP nevrátil platná PNG data snímku.");
  }
  return value.byteLength;
}

export function recognizeSmokeSurface(markers = {}) {
  const candidates = [
    [markers.authWaiting === true, SMOKE_SURFACE.AUTH_WAITING],
    [markers.panel === true && markers.signedIn === true, SMOKE_SURFACE.AUTHENTICATED_PANEL],
    [markers.checkingSession === true, SMOKE_SURFACE.CHECKING_SESSION],
    [markers.welcome === true, SMOKE_SURFACE.WELCOME],
    [markers.authentication === true, SMOKE_SURFACE.AUTHENTICATION],
  ].filter(([matches]) => matches);
  return candidates.length === 1 ? candidates[0][1] : SMOKE_SURFACE.UNKNOWN;
}

export function chooseInitialSmokeRoute(surface) {
  if (surface === SMOKE_SURFACE.AUTHENTICATED_PANEL) return "panel-and-settings";
  if (surface === SMOKE_SURFACE.WELCOME || surface === SMOKE_SURFACE.AUTHENTICATION) {
    return "onboarding-to-auth-boundary";
  }
  if (surface === SMOKE_SURFACE.AUTH_WAITING) return "auth-boundary";
  if (surface === SMOKE_SURFACE.CHECKING_SESSION) return "wait-for-session";
  return "unknown";
}

export function validateAuthWaitingUrl(value, expectedOrigin) {
  const trustedOrigin = requireCleanOrigin(expectedOrigin);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Čekací obrazovka neukázala platnou adresu přihlášení.");
  }
  const required = [
    "response_type",
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
    "resource",
  ];
  if (
    url.origin !== trustedOrigin
    || url.username
    || url.password
    || url.pathname !== "/api/mcp/oauth/authorize"
    || url.hash
    || required.some((name) => url.searchParams.getAll(name).length !== 1)
    || url.searchParams.get("response_type") !== "code"
    || url.searchParams.get("scope") !== "mcp:read"
    || url.searchParams.get("code_challenge_method") !== "S256"
    || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("state") ?? "")
    || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("code_challenge") ?? "")
    || !url.searchParams.get("client_id")
    || url.searchParams.get("resource") !== `${trustedOrigin}/api/mcp`
  ) {
    throw new Error("Adresa na čekací obrazovce není úplný OAuth PKCE požadavek pro LuDone.");
  }
  const redirectUri = requireLoopbackRedirect(url.searchParams.get("redirect_uri"));
  return {
    href: url.href,
    origin: url.origin,
    pathname: url.pathname,
    redirectUri,
    state: url.searchParams.get("state"),
  };
}

export function buildSmokeReport({ outcome, screens = [], verifiedChecks = [] }) {
  if (!Object.hasOwn(BRANCH_REQUIREMENTS, outcome)) {
    throw new Error(`Neznámý výsledek ui-smoke: ${String(outcome)}`);
  }
  const requirements = BRANCH_REQUIREMENTS[outcome];

  const unknownChecks = verifiedChecks.filter((check) => !Object.hasOwn(CHECK_LABELS, check));
  if (unknownChecks.length > 0) {
    throw new Error(`ui-smoke dostal neznámé kontroly: ${unknownChecks.join(", ")}`);
  }
  const missingChecks = missingItems(requirements.checks, verifiedChecks);
  const capturedNames = screens.map((screen) => screen?.name);
  const missingScreens = missingItems(requirements.screens, capturedNames);
  const malformedScreens = screens.filter((screen) => (
    typeof screen?.name !== "string"
    || typeof screen?.path !== "string"
    || !screen.path.endsWith(`-${screen.name}.png`)
  ));
  if (missingChecks.length > 0 || missingScreens.length > 0 || malformedScreens.length > 0) {
    const details = [
      missingChecks.length > 0 ? `chybí kontroly: ${missingChecks.join(", ")}` : null,
      missingScreens.length > 0 ? `chybí snímky: ${missingScreens.join(", ")}` : null,
      malformedScreens.length > 0 ? "některý snímek nemá odpovídající název a cestu" : null,
    ].filter(Boolean);
    throw new Error(`ui-smoke nemůže uzavřít větev „${outcome}": ${details.join("; ")}.`);
  }

  return {
    complete: requirements.complete,
    exitCode: requirements.exitCode,
    notCovered: [...requirements.notCovered],
    screenshots: screens.map((screen) => screen.path),
    status: requirements.status,
    unattendedPartOk: outcome === "auth-boundary",
    unverified: [...requirements.unverified],
    verified: verifiedChecks.map((check) => CHECK_LABELS[check]),
  };
}

export function formatSmokeReport(report) {
  if (report.complete && report.unverified.length > 0) {
    throw new Error("Dokončená větev ui-smoke nesmí obsahovat neověřené povinné části.");
  }
  if (!report.complete) {
    return [
      "🟡 ui-smoke: dosažen konec neobsluhované části.",
      "Důvod: běh dosáhl čekací hranice OAuth; pokračování za ní vyžaduje člověka a nejde o Timeout.",
      "Ověřeno:",
      ...listLines(report.verified),
      "Neověřeno (vyžaduje dokončené přihlášení člověkem):",
      ...listLines(report.unverified),
      `Výsledek: celý ui-smoke není ověřen; končím kódem ${report.exitCode}.`,
    ].join("\n");
  }
  return [
    "✅ ui-smoke: větev přihlášeného profilu dokončena; panel a nastavení ověřeny.",
    "Ověřeno:",
    ...listLines(report.verified),
    "V tomto běhu neproběhlo:",
    ...listLines(report.notCovered),
    `Výsledek: ověřena větev přihlášeného profilu; končím kódem ${report.exitCode}.`,
  ].join("\n");
}

export function formatScreenshotList(screenshots) {
  return [
    "Snímky tohoto běhu:",
    ...listLines(screenshots),
  ].join("\n");
}
