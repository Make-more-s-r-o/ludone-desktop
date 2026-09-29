export const THEME_STORAGE_KEY = "ludone.desktop.theme";

const THEMES = new Set(["light", "professional", "dark"]);

export function getThemePreference() {
  let stored = null;
  try {
    stored = window.localStorage?.getItem?.(THEME_STORAGE_KEY) ?? null;
  } catch {
    // Pokud macOS nebo testovací prostředí úložiště zakáže, použije se motiv systému.
  }
  return THEMES.has(stored) ? stored : "system";
}

function resolvedTheme(preference) {
  if (THEMES.has(preference)) return preference;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemePreference(preference = getThemePreference()) {
  const root = document.documentElement;
  if (!root) return;
  root.dataset.theme = resolvedTheme(preference);
  root.dataset.themePreference = preference;
}

export function persistThemePreference(preference) {
  if (!THEMES.has(preference)) throw new TypeError("Neznámé barevné téma.");
  try {
    window.localStorage?.setItem?.(THEME_STORAGE_KEY, preference);
  } catch {
    // Volba platí v aktuálním okně i bez možnosti trvalého uložení.
  }
  applyThemePreference(preference);
}

export function initializeTheme() {
  applyThemePreference();
  window.addEventListener?.("storage", (event) => {
    if (event.key === THEME_STORAGE_KEY) applyThemePreference();
  });
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (getThemePreference() === "system") applyThemePreference("system");
  });
}
