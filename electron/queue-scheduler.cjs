function createQueueScheduler({ now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout,
  readNextRetryAt, run }) {
  if (typeof readNextRetryAt !== "function" || typeof run !== "function") {
    throw new TypeError("Scheduler vyžaduje čtení termínu a pokus");
  }
  let timer = null;
  let stopped = false;
  let running = false;
  let generation = 0;
  async function refresh() {
    if (stopped || running) return;
    const ownGeneration = ++generation;
    const next = await readNextRetryAt();
    if (stopped || running || ownGeneration !== generation) return;
    if (!Number.isSafeInteger(next) || next <= 0) {
      if (timer) clearTimer(timer);
      timer = null;
      return;
    }
    // I shodný termín znovu armujeme: vlastní generation tohoto refreshu právě
    // zneplatnila callback předchozího timeru.
    if (timer) clearTimer(timer);
    timer = setTimer(() => {
      void fire(ownGeneration);
    }, Math.max(1, next - now()));
    timer.unref?.();
  }
  async function fire(timerGeneration) {
    if (stopped || running || timerGeneration !== generation) return;
    try {
      timer = null;
      running = true;
      const result = await run();
      running = false;
      if (stopped) return;
      if (["sent", "retry_scheduled", "rate_limited"].includes(result?.outcome)) {
        await refresh();
      }
    } catch {
      running = false;
      // Lifecycle nebo další výslovná akce může plán znovu obnovit; chyba nesmí
      // vytvořit unhandled rejection ani okamžitou smyčku.
    }
  }
  function stop() {
    stopped = true;
    generation += 1;
    if (timer) clearTimer(timer);
    timer = null;
  }
  return Object.freeze({ refresh, stop });
}

module.exports = { createQueueScheduler };
