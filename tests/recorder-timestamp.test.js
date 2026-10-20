import { describe, expect, it } from "vitest";
import { recorderEventTimestamp } from "../src/features/recording/recorder-timestamp.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("recorderEventTimestamp", () => {
  it("při spánku Macu počítá od současného nástěnného času", () => {
    const nowFake = Date.parse("2026-10-20T12:00:00.000Z");
    const fourDaysMs = 4 * DAY_MS;
    const timeOrigin = nowFake - fourDaysMs;
    const perfNow = 10 * 60 * 1000;
    const event = { timeStamp: perfNow - 2_000 };

    const result = recorderEventTimestamp(event, {
      now: () => nowFake,
      perfNow: () => perfNow,
    });
    const oldFormulaTimestamp = timeOrigin + event.timeStamp;

    expect(Date.parse(result)).toBe(nowFake - 2_000);
    // Starý vzorec by zaostal o čtyři dny minus deset minut po spánku.
    expect(nowFake - 2_000 - oldFormulaTimestamp).toBe(fourDaysMs - perfNow);
  });

  it("bez spánku odpovídá starému vzorci do 5 ms", () => {
    const nowFake = Date.parse("2026-10-20T12:00:00.000Z");
    const perfNow = 12_345;
    const timeOrigin = nowFake - perfNow;
    const event = { timeStamp: perfNow - 2_000 };

    const result = recorderEventTimestamp(event, {
      now: () => nowFake,
      perfNow: () => perfNow,
    });
    const oldFormulaTimestamp = timeOrigin + event.timeStamp;

    expect(Math.abs(Date.parse(result) - oldFormulaTimestamp)).toBeLessThanOrEqual(5);
  });

  it("při NaN timeStamp použije aktuální čas", () => {
    const nowFake = Date.parse("2026-10-20T12:00:00.000Z");

    const result = recorderEventTimestamp({ timeStamp: Number.NaN }, {
      now: () => nowFake,
      perfNow: () => 1_000,
    });

    expect(Date.parse(result)).toBe(nowFake);
  });

  it("vrací kanonický ISO řetězec", () => {
    const result = recorderEventTimestamp({ timeStamp: 8_000 }, {
      now: () => Date.parse("2026-10-20T12:00:00.000Z"),
      perfNow: () => 10_000,
    });

    expect(new Date(result).toISOString()).toBe(result);
  });
});
