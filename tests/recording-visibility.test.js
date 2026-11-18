import { afterEach, expect, it, vi } from "vitest";
import {
  RECORDING_VISIBILITY_STORAGE_KEY,
  getRecordingVisibilityPreference,
  persistRecordingVisibilityPreference,
} from "../src/lib/recording-visibility.js";

afterEach(() => vi.unstubAllGlobals());

it.each([[null, "company"], ["private", "private"], ["company", "company"], ["jiná hodnota", "company"]])(
  "uložený přístup %s načte jako %s", (stored, expected) => {
    const getItem = vi.fn(() => stored);
    vi.stubGlobal("window", { localStorage: { getItem } });
    expect(getRecordingVisibilityPreference()).toBe(expected);
    expect(getItem).toHaveBeenCalledExactlyOnceWith(RECORDING_VISIBILITY_STORAGE_KEY);
  },
);

it("zapíše jen zvolený přístup a nové načtení vrátí poslední volbu", () => {
  let stored = null;
  const setItem = vi.fn((_key, value) => { stored = value; });
  vi.stubGlobal("window", { localStorage: { getItem: () => stored, setItem } });
  expect(persistRecordingVisibilityPreference("private")).toBe(true);
  expect(getRecordingVisibilityPreference()).toBe("private");
  expect(persistRecordingVisibilityPreference("company")).toBe(true);
  expect(getRecordingVisibilityPreference()).toBe("company");
  expect(setItem.mock.calls).toEqual([[RECORDING_VISIBILITY_STORAGE_KEY, "private"], [RECORDING_VISIBILITY_STORAGE_KEY, "company"]]);
});

it("nedostupné úložiště nezablokuje nahrávání a oznámí neúspěšný zápis", () => {
  vi.stubGlobal("window", { get localStorage() { throw new Error("úložiště není dostupné"); } });
  expect(getRecordingVisibilityPreference()).toBe("company");
  expect(persistRecordingVisibilityPreference("private")).toBe(false);
});

it("neplatný přístup se do úložiště nezapíše", () => {
  const setItem = vi.fn();
  vi.stubGlobal("window", { localStorage: { setItem } });
  expect(() => Reflect.apply(persistRecordingVisibilityPreference, null, ["jiná hodnota"])).toThrow(TypeError);
  expect(setItem).not.toHaveBeenCalled();
});
