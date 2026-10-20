export function recorderEventTimestamp(event, clock = {}) {
  const clockNow = typeof clock.now === "function" ? clock.now() : Date.now();
  const now = Number.isFinite(clockNow) && Number.isFinite(new Date(clockNow).getTime())
    ? clockNow
    : Date.now();
  const perfNow = typeof clock.perfNow === "function"
    ? clock.perfNow()
    : globalThis.performance?.now?.();
  const eventTimestamp = event?.timeStamp;
  const timestamp = now - (perfNow - eventTimestamp);
  const validTimestamp = Number.isFinite(perfNow)
    && Number.isFinite(eventTimestamp)
    && Number.isFinite(timestamp)
    && Number.isFinite(new Date(timestamp).getTime());

  return new Date(validTimestamp ? timestamp : now).toISOString();
}
