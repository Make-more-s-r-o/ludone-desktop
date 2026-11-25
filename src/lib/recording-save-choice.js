export const RECORDING_SAVE_CHOICE_STORAGE_KEY = "ludone.desktop.recording-save-choice";

/** Bezpečné volby po zastavení nahrávky; Smazat se záměrně nikdy neukládá ani nepředvybírá. */
export const SAVE_CHOICES = Object.freeze(["keep", "send", "send-transcribe"]);
export const DEFAULT_SAVE_CHOICE = "send";

export function getRecordingSaveChoicePreference() {
  try {
    const stored = window.localStorage?.getItem(RECORDING_SAVE_CHOICE_STORAGE_KEY);
    return SAVE_CHOICES.includes(stored) ? stored : DEFAULT_SAVE_CHOICE;
  } catch {
    return DEFAULT_SAVE_CHOICE;
  }
}

/** @param {"keep" | "send" | "send-transcribe"} choice */
export function persistRecordingSaveChoicePreference(choice) {
  if (!SAVE_CHOICES.includes(choice)) throw new TypeError("Neznámá volba uložení nahrávky.");
  try {
    window.localStorage.setItem(RECORDING_SAVE_CHOICE_STORAGE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}
