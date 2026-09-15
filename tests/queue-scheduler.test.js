import { afterEach, describe, expect, it, vi } from "vitest";
import schedulerModule from "../electron/queue-scheduler.cjs";

const { createQueueScheduler } = schedulerModule;

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("obnovitelný retry časovač nahrávek", () => {
  it("probudí právě jeden pokus v autoritativním termínu a přečte další termín", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const readNextRetryAt = vi.fn()
      .mockResolvedValueOnce(2_000)
      .mockResolvedValueOnce(null);
    const run = vi.fn().mockResolvedValue({ outcome: "sent" });
    const scheduler = createQueueScheduler({ readNextRetryAt, run });

    await scheduler.refresh();
    await vi.advanceTimersByTimeAsync(999);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(run).toHaveBeenCalledOnce();
    expect(readNextRetryAt).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stop během rozpracovaného čtení už nezaloží timer", async () => {
    vi.useFakeTimers();
    const read = deferred();
    const scheduler = createQueueScheduler({
      readNextRetryAt: () => read.promise,
      run: vi.fn(),
    });

    const refreshing = scheduler.refresh();
    scheduler.stop();
    read.resolve(Date.now() + 1_000);
    await refreshing;

    expect(vi.getTimerCount()).toBe(0);
  });

  it("starší souběžný refresh nepřepíše novější plán", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const first = deferred();
    const second = deferred();
    const run = vi.fn().mockResolvedValue({ outcome: "idle" });
    const readNextRetryAt = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const scheduler = createQueueScheduler({ readNextRetryAt, run });

    const firstRefresh = scheduler.refresh();
    const secondRefresh = scheduler.refresh();
    second.resolve(12_000);
    await secondRefresh;
    first.resolve(11_000);
    await firstRefresh;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledOnce();
  });

  it("dvojí refresh stejného termínu ponechá právě jedno skutečné probuzení", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(15_000);
    const readNextRetryAt = vi.fn().mockResolvedValue(16_000);
    const run = vi.fn().mockResolvedValue({ outcome: "idle" });
    const scheduler = createQueueScheduler({ readNextRetryAt, run });

    await scheduler.refresh();
    await scheduler.refresh();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledOnce();
  });

  it("zamítnutý run nezpůsobí unhandled rejection ani další timer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const run = vi.fn().mockRejectedValue(new Error("simulované selhání"));
    const scheduler = createQueueScheduler({
      readNextRetryAt: vi.fn().mockResolvedValue(20_001),
      run,
    });

    await scheduler.refresh();
    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    expect(run).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["idle", "disabled", "paused"])(
    "prošlý termín po výsledku %s nevytvoří milisekundovou smyčku",
    async (outcome) => {
      vi.useFakeTimers();
      vi.setSystemTime(30_000);
      const readNextRetryAt = vi.fn().mockResolvedValue(29_000);
      const run = vi.fn().mockResolvedValue({ outcome });
      const scheduler = createQueueScheduler({ readNextRetryAt, run });

      await scheduler.refresh();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(run).toHaveBeenCalledOnce();
      expect(readNextRetryAt).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
