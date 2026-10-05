import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const { deriveOsaTrayState } = createRequire(import.meta.url)("../electron/osa-tray.cjs");

describe("autorita stavů F", () => {
  it.each([false, true])("nahrávání převažuje nad auth/offline/ukládáním při signedIn=%s", (signedIn) => {
    const facts = { recording: true, signedIn, offline: true, saving: true, decision: true, attention: true, queueWaiting: true };
    expect(deriveOsaTrayState(facts)).toBe("recording");
    expect(deriveOsaTrayState({ ...facts, microphoneOnly: true })).toBe("recording-microphone-only");
    expect(deriveOsaTrayState({ ...facts, microphoneOnly: true, systemAudioLost: true })).toBe("recording-audio-lost");
  });
  it("ukládání a rozhodnutí nejsou překryté neplatnou session", () => {
    expect(deriveOsaTrayState({ saving: true, signedIn: false, decision: true })).toBe("saving");
    expect(deriveOsaTrayState({ saving: false, signedIn: false, decision: true })).toBe("decision");
    expect(deriveOsaTrayState({ signedIn: false })).toBe("signed-out");
  });
  it("offline vyžaduje skutečně čekající frontu", () => {
    expect(deriveOsaTrayState({ signedIn: true, offline: true })).toBe("idle");
    expect(deriveOsaTrayState({ signedIn: true, offline: true, queueWaiting: true, attention: true })).toBe("offline");
    expect(deriveOsaTrayState({ signedIn: true, attention: true, queueWaiting: true })).toBe("attention");
    expect(deriveOsaTrayState({ signedIn: true, queueWaiting: true })).toBe("queue-waiting");
  });
});
