import { describe, expect, it, vi } from "vitest";
import uploadClient from "../electron/upload-client.cjs";
import verification from "../electron/recording-verification.cjs";

const { createRequester } = uploadClient;
const { createRecordingVerifier } = verification;
const ID = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
const ID2 = "11111111-1111-4111-8111-111111111111";
const OWNER = `sha256:${"a".repeat(64)}`;
const SHA = "b".repeat(64);
const ORIGIN = "https://labs.ludone.cz";

function response(status, payload, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: vi.fn(async () => payload),
  };
}

/** @param {Record<string, {recordingId: string | null, declaredBytes: number, sha256: string | null}>} tracks */
function target(tracks = {
  microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA },
  system: { recordingId: ID2, declaredBytes: 34, sha256: "c".repeat(64) },
}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    revision: `sha256:${"d".repeat(64)}`,
    ownerFingerprint: OWNER,
    tracks,
  };
}

function context(overrides = {}) {
  return {
    accessToken: "tajny-token",
    generation: 7,
    issuer: ORIGIN,
    ownerFingerprint: OWNER,
    resource: `${ORIGIN}/api/mcp`,
    scope: "nahravky:upload",
    ...overrides,
  };
}

function verifier(fetchImpl, overrides = {}) {
  const current = { value: true };
  return {
    current,
    instance: createRecordingVerifier({
      fetchImpl,
      getContext: vi.fn(async () => context()),
      isContextCurrent: vi.fn(() => current.value),
      now: () => Date.parse("2026-09-14T12:00:00.000Z"),
      ...overrides,
    }),
  };
}

describe("bezpečný HTTP requester", () => {
  it("posílá Bearer a redirect:error na přesnou relativní cestu", async () => {
    const fetchImpl = vi.fn(async () => response(200, { ok: true }));
    const request = createRequester({
      accessToken: "tajny-token", fetchImpl, origin: ORIGIN, requestTimeoutMs: 1_000,
    });
    await expect(request(`/api/nahravky/uploads/${ID}`)).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(`${ORIGIN}/api/nahravky/uploads/${ID}`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer tajny-token" }),
      redirect: "error",
    }));
  });

  it.each([
    "https://utocnik.test/api",
    "//utocnik.test/api",
    "/api/../admin",
    "/api?token=ven",
    "/api#cast",
  ])("odmítne nebezpečný target %s před fetch", async (pathname) => {
    const fetchImpl = vi.fn();
    const request = createRequester({
      accessToken: "token", fetchImpl, origin: ORIGIN, requestTimeoutMs: 1_000,
    });
    await expect(request(pathname)).rejects.toThrow(/cesta/ui);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["Authorization", "authorization", "Cookie", "cookie"])(
    "odmítne přepsání chráněné hlavičky %s",
    async (header) => {
      const fetchImpl = vi.fn();
      const request = createRequester({
        accessToken: "token", fetchImpl, origin: ORIGIN, requestTimeoutMs: 1_000,
      });
      await expect(request("/api", { headers: { [header]: "podvrh" } }))
        .rejects.toThrow(/hlavičku/u);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});

describe("ruční ověření nahrávky", () => {
  it("jediný stereo delivery ověří jedním GET podle jednoho serverového recordingId", async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(new URL(url).pathname).toBe(`/api/nahravky/uploads/${ID}`);
      return response(200, {
        state: "stored", missing: [], declaredBytes: 12, sha256: SHA,
      });
    });
    const { instance } = verifier(fetchImpl);
    const result = await instance.verify(target({
      delivery: { recordingId: ID, declaredBytes: 12, sha256: SHA },
    }));
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname)
      .toBe(`/api/nahravky/uploads/${ID}`);
    expect(result.tracks).toEqual({ delivery: { status: "complete", mismatchFields: [] } });
  });

  it("dual a single udělají přesně 2 a 1 GET a legacy bez ID nula", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const id = new URL(url).pathname.split("/").at(-1);
      return response(200, id === ID
        ? { state: "stored", missing: [], declaredBytes: 12, sha256: SHA.toUpperCase() }
        : { state: "normalized", missing: [], declaredBytes: 34, sha256: "c".repeat(64) });
    });
    const dual = verifier(fetchImpl).instance;
    await expect(dual.verify(target())).resolves.toMatchObject({
      tracks: { microphone: { status: "complete" }, system: { status: "complete" } },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    fetchImpl.mockClear();
    await verifier(fetchImpl).instance.verify(target({
      microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA },
    }));
    expect(fetchImpl).toHaveBeenCalledOnce();

    fetchImpl.mockClear();
    const legacy = await verifier(fetchImpl).instance.verify(target({
      microphone: { recordingId: null, declaredBytes: 12, sha256: SHA },
    }));
    expect(legacy.tracks.microphone.status).toBe("not_verified");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rozliší serverové stavy a bezpečné neshody", async () => {
    const payloads = [
      { state: "uploading", missing: [0], declaredBytes: 12, sha256: SHA },
      { state: "failed", missing: [], declaredBytes: 12, sha256: SHA },
      { state: "stored", missing: [], declaredBytes: 13, sha256: SHA },
      { state: "stored", missing: [], declaredBytes: 12, sha256: "e".repeat(64) },
      { state: "stored", missing: [0], declaredBytes: 12, sha256: SHA },
      { state: "stored", missing: [0, 0], declaredBytes: 12, sha256: SHA },
      { state: "stored", missing: [], declaredBytes: "12", sha256: SHA },
    ];
    const expected = [
      "incomplete", "server_failed", "mismatch", "mismatch", "mismatch",
      "invalid_response", "invalid_response",
    ];
    for (let index = 0; index < payloads.length; index += 1) {
      const fetchImpl = vi.fn(async () => response(200, payloads[index]));
      const result = await verifier(fetchImpl).instance.verify(target({
        microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA },
      }));
      expect(result.tracks.microphone.status).toBe(expected[index]);
    }
  });

  it("404, auth, síť a 429 jsou bezpečně odlišené; po 429 druhou stopu neposílá", async () => {
    for (const [status, expected] of [[404, "not_found_for_account"], [401, "auth_error"]]) {
      const fetchImpl = vi.fn(async () => response(status, { code: "chyba" }));
      const result = await verifier(fetchImpl).instance.verify(target({
        microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA },
      }));
      expect(result.tracks.microphone.status).toBe(expected);
    }
    const network = await verifier(vi.fn(async () => { throw new Error("offline"); })).instance
      .verify(target({ microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA } }));
    expect(network.tracks.microphone.status).toBe("network_error");

    const limitedFetch = vi.fn(async () => response(429, {}, { "retry-after": "120" }));
    const limited = verifier(limitedFetch).instance;
    const result = await limited.verify(target());
    expect(result.tracks.microphone.status).toBe("rate_limited");
    expect(result.tracks.system.status).toBe("rate_limited");
    expect(limitedFetch).toHaveBeenCalledOnce();
    limited.invalidate();
    await limited.verify(target());
    expect(limitedFetch).toHaveBeenCalledOnce();
  });

  it("cache 60 s, dedupe a atomický limit 30 GET fungují bez překročení", async () => {
    let now = 1_000_000;
    let finish;
    const fetchImpl = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const setup = verifier(fetchImpl, { now: () => now });
    const one = setup.instance.verify(target({ microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA } }));
    const two = setup.instance.verify(target({ microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA } }));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    finish(response(200, { state: "stored", missing: [], declaredBytes: 12, sha256: SHA }));
    await expect(Promise.all([one, two])).resolves.toHaveLength(2);
    await setup.instance.verify(target({ microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA } }));
    expect(fetchImpl).toHaveBeenCalledOnce();
    now += 60_001;
    finish = null;
    const third = setup.instance.verify(target({ microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA } }));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    finish(response(200, { state: "stored", missing: [], declaredBytes: 12, sha256: SHA }));
    await third;

    const rateFetch = vi.fn(async () => response(200, { state: "stored", missing: [], declaredBytes: 1, sha256: SHA }));
    const limited = verifier(rateFetch, { now: () => 10_000 }).instance;
    for (let index = 0; index < 15; index += 1) {
      await limited.verify(target({
        microphone: { recordingId: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`, declaredBytes: 1, sha256: SHA },
        system: { recordingId: `${String(index + 100).padStart(8, "0")}-1111-4111-8111-111111111111`, declaredBytes: 1, sha256: SHA },
      }));
    }
    await expect(limited.verify(target({
      microphone: { recordingId: "99999999-1111-4111-8111-111111111111", declaredBytes: 1, sha256: SHA },
    }))).resolves.toMatchObject({ tracks: { microphone: { status: "local_rate_limited" } } });
    expect(rateFetch).toHaveBeenCalledTimes(30);
  });

  it("invalid owner/scope/resource/token/current guard nepošlou žádný fetch", async () => {
    const variants = [
      context({ ownerFingerprint: `sha256:${"f".repeat(64)}` }),
      context({ scope: "mcp:read" }),
      context({ resource: `${ORIGIN}/jine` }),
      context({ accessToken: "" }),
    ];
    for (const candidate of variants) {
      const fetchImpl = vi.fn();
      const instance = verifier(fetchImpl, { getContext: vi.fn(async () => candidate) }).instance;
      await instance.verify(target());
      expect(fetchImpl).not.toHaveBeenCalled();
    }
    const fetchImpl = vi.fn();
    const guarded = verifier(fetchImpl, { isContextCurrent: vi.fn(() => false) }).instance;
    await expect(guarded.verify(target())).rejects.toMatchObject({ code: "context_changed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("změna účtu po awaitu a explicitní invalidate zahodí pending výsledek", async () => {
    let finish;
    const fetchImpl = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const setup = verifier(fetchImpl);
    const pending = setup.instance.verify(target({
      microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA },
    }));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    setup.current.value = false;
    setup.instance.invalidate();
    finish(response(200, { state: "stored", missing: [], declaredBytes: 12, sha256: SHA }));
    await expect(pending).rejects.toMatchObject({ code: "context_changed" });
  });

  it("změna účtu po síťovém awaitu zahodí výsledek i bez explicitní invalidace", async () => {
    let finish;
    const fetchImpl = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const setup = verifier(fetchImpl);
    const pending = setup.instance.verify(target({
      microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA },
    }));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    setup.current.value = false;
    finish(response(200, { state: "stored", missing: [], declaredBytes: 12, sha256: SHA }));
    await expect(pending).rejects.toMatchObject({ code: "context_changed" });
  });

  it("429 přijaté během logoutu zůstane pro stejného vlastníka i po invalidate", async () => {
    let finish;
    const fetchImpl = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const setup = verifier(fetchImpl);
    const pending = setup.instance.verify(target({
      microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA },
    }));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    setup.current.value = false;
    setup.instance.invalidate();
    finish(response(429, {}, { "retry-after": "120" }));
    await expect(pending).rejects.toMatchObject({ code: "context_changed" });
    setup.current.value = true;
    const afterLogin = await setup.instance.verify(target({
      microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA },
    }));
    expect(afterLogin.tracks.microphone.status).toBe("rate_limited");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("429 z paralelního řádku zastaví další dosud nezahájenou stopu stejného vlastníka", async () => {
    let finishFirst;
    const fetchImpl = vi.fn((url) => {
      if (String(url).endsWith(ID)) {
        return new Promise((resolve) => { finishFirst = resolve; });
      }
      return Promise.resolve(response(429, {}, { "retry-after": "120" }));
    });
    const setup = verifier(fetchImpl);
    const dual = setup.instance.verify(target());
    await vi.waitFor(() => expect(finishFirst).toBeTypeOf("function"));
    const other = setup.instance.verify(target({
      microphone: {
        recordingId: "33333333-3333-4333-8333-333333333333",
        declaredBytes: 12,
        sha256: SHA,
      },
    }));
    await expect(other).resolves.toMatchObject({ tracks: { microphone: { status: "rate_limited" } } });
    finishFirst(response(200, { state: "stored", missing: [], declaredBytes: 12, sha256: SHA }));
    const result = await dual;
    expect(result.tracks.microphone.status).toBe("complete");
    expect(result.tracks.system.status).toBe("rate_limited");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("cooldown zapsaný během await current guardu zastaví bezprostředně následující GET", async () => {
    let releaseGuard;
    let primaryGuardCalls = 0;
    const firstContext = context({ generation: 7 });
    const secondContext = context({ generation: 8 });
    const getContext = vi.fn()
      .mockResolvedValueOnce(firstContext)
      .mockResolvedValueOnce(secondContext);
    const isContextCurrent = vi.fn((candidate) => {
      if (candidate.generation !== 7) return true;
      primaryGuardCalls += 1;
      if (primaryGuardCalls !== 4) return true;
      return new Promise((resolve) => { releaseGuard = resolve; });
    });
    const fetchImpl = vi.fn(async (url) => (
      String(url).includes("33333333")
        ? response(429, {}, { "retry-after": "120" })
        : response(200, { state: "stored", missing: [], declaredBytes: 12, sha256: SHA })
    ));
    const instance = createRecordingVerifier({ fetchImpl, getContext, isContextCurrent, now: () => 1_000 });
    const dual = instance.verify(target({
      microphone: { recordingId: ID, declaredBytes: 12, sha256: SHA },
      system: { recordingId: ID2, declaredBytes: 12, sha256: SHA },
    }));
    await vi.waitFor(() => expect(releaseGuard).toBeTypeOf("function"));
    await instance.verify(target({
      microphone: {
        recordingId: "33333333-3333-4333-8333-333333333333",
        declaredBytes: 12,
        sha256: SHA,
      },
    }));
    releaseGuard(true);
    const result = await dual;
    expect(result.tracks.system.status).toBe("rate_limited");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
