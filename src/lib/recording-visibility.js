export const RECORDING_VISIBILITY_STORAGE_KEY = "ludone.desktop.recording-visibility";

export function getRecordingVisibilityPreference() {
  try {
    return window.localStorage?.getItem(RECORDING_VISIBILITY_STORAGE_KEY) === "private" ? "private" : "company";
  } catch {
    return "company";
  }
}

/** @param {"private" | "company"} visibility */
export function persistRecordingVisibilityPreference(visibility) {
  if (visibility !== "private" && visibility !== "company") throw new TypeError("Neznámý přístup k nahrávce.");
  try {
    window.localStorage.setItem(RECORDING_VISIBILITY_STORAGE_KEY, visibility);
    return true;
  } catch {
    return false;
  }
}
