import { describe, it, expect, vi, afterEach } from "vitest";
import { createRequire } from "node:module";
const { createDetailCloseGuard } = createRequire(import.meta.url)("../electron/detail-close.cjs");
afterEach(() => vi.useRealTimers());
function setup(decision = "save") {
  const proceed = vi.fn();
  const requestSave = vi.fn();
  const choose = vi.fn().mockResolvedValue(decision);
  return { guard: createDetailCloseGuard({ choose, requestSave }), choose, requestSave, proceed };
}
describe("rozhodnutí o neuloženém detailu", () => {
  it("čistý detail pokračuje bez dotazu", async () => {
    const x = setup(); await x.guard.request(x.proceed);
    expect(x.proceed).toHaveBeenCalledOnce(); expect(x.choose).not.toHaveBeenCalled();
  });
  it("Zůstat zachová změny a dovolí nové rozhodnutí", async () => {
    const x = setup("stay"); x.guard.setDirty(true);
    await x.guard.request(x.proceed); await x.guard.request(x.proceed);
    expect(x.choose).toHaveBeenCalledTimes(2); expect(x.proceed).not.toHaveBeenCalled(); expect(x.guard.dirty).toBe(true);
  });
  it("Zahodit nezavolá zápis ani upload", async () => {
    const x = setup("discard"); x.guard.setDirty(true); await x.guard.request(x.proceed);
    expect(x.proceed).toHaveBeenCalledOnce(); expect(x.requestSave).not.toHaveBeenCalled(); expect(x.guard.dirty).toBe(false);
  });
  it("Uložit čeká na přesný nonce a úspěšný CAS zápis", async () => {
    const x = setup(); x.guard.setDirty(true); await x.guard.request(x.proceed);
    expect(x.proceed).not.toHaveBeenCalled(); const id = x.requestSave.mock.calls[0][0];
    expect(() => x.guard.saved("cizí", true)).toThrow();
    x.guard.setDirty(false); x.guard.saved(id, true); expect(x.proceed).toHaveBeenCalledOnce();
    expect(() => x.guard.saved(id, true)).toThrow();
  });
  it("chybový zápis nepropustí zavření", async () => {
    const x = setup(); x.guard.setDirty(true); await x.guard.request(x.proceed);
    x.guard.saved(x.requestSave.mock.calls[0][0], false); expect(x.proceed).not.toHaveBeenCalled();
    await x.guard.request(x.proceed); expect(x.choose).toHaveBeenCalledTimes(2);
  });
  it("ani kladné ACK nepropustí nový dirty stav", async () => {
    const x = setup(); x.guard.setDirty(true); await x.guard.request(x.proceed);
    x.guard.saved(x.requestSave.mock.calls[0][0], true); expect(x.proceed).not.toHaveBeenCalled();
  });
  it("změna formuláře během dialogu zneplatní staré rozhodnutí", async () => {
    const x = setup("discard"); let resolve; x.choose.mockImplementation(() => new Promise(r => { resolve = r; }));
    x.guard.setDirty(true); const waiting = x.guard.request(x.proceed);
    x.guard.setDirty(true); resolve("discard"); await waiting;
    expect(x.proceed).not.toHaveBeenCalled(); expect(x.guard.dirty).toBe(true);
  });
  it("timeout nebo pád rendereru uvolní čekání a odmítne staré ACK", async () => {
    vi.useFakeTimers(); const x = setup(); x.guard.setDirty(true); await x.guard.request(x.proceed);
    const first = x.requestSave.mock.calls[0][0]; vi.advanceTimersByTime(30000);
    expect(x.guard.dirty).toBe(true); expect(() => x.guard.saved(first, true)).toThrow();
    await x.guard.request(x.proceed); expect(x.choose).toHaveBeenCalledTimes(2);
    x.guard.cancel(); await x.guard.request(x.proceed); expect(x.choose).toHaveBeenCalledTimes(3);
  });
});
