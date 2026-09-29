// Úplnost matice a izolace jsou součástí brány; prázdný report není úspěch.
export const REQUIRED_STATE_SCENARIOS = Object.freeze([
  "day-loading", "day-empty", "day-error-retry", "detail-local", "detail-queued",
  "detail-sent", "detail-verified", "detail-error", "detail-limit", "detail-owner",
  "detail-missing", "detail-verify-error", "auth-signed-in", "auth-expired",
  "auth-oauth-pending-cancel", "update-available", "update-downloading", "update-install-waits",
]);

export function stateAcceptanceExitCode(results, networkAttempts) {
  if (!Array.isArray(results) || results.length !== REQUIRED_STATE_SCENARIOS.length || networkAttempts !== 0) return 1;
  const seen = new Set();
  for (const row of results) {
    if (!row || row.status !== "PASS" || row.fixtureOnly !== true
      || !REQUIRED_STATE_SCENARIOS.includes(row.name) || seen.has(row.name)
      || typeof row.screenshot !== "string" || !row.screenshot.endsWith(".png")) return 1;
    seen.add(row.name);
  }
  return 0;
}
