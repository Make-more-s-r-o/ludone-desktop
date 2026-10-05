import { describe, expect, it } from "vitest";
import { osaRecordingStatus, osaRecordingNode, osaQueueCount, selectOsaRecordings } from "../src/lib/osa-recordings.js";

const row = (id, createdAt, extra = {}) => ({ id, createdAt, title: "Porada", ...extra });

describe("F Osa skutečný seznam", () => {
  it("projde všechny položky přes stránky po sedmi a omezí neplatnou stránku", () => {
    const items = Array.from({ length: 23 }, (_, i) => row(String(i).padStart(2, "0"), new Date(2026, 9, 5, 12, i).toISOString()));
    const all = [1, 2, 3, 4].flatMap(page => selectOsaRecordings(items, { page }).items);
    expect(all).toHaveLength(23);
    expect(new Set(all.map(item => item.id)).size).toBe(23);
    expect(selectOsaRecordings(items, { page: 900 }).page).toBe(4);
    expect(selectOsaRecordings(items, { page: NaN }).page).toBe(1);
    expect(items[0].id).toBe("00");
  });
  it("hledá bez české diakritiky i ve skutečné firmě", () => {
    const items = [row("a", null, { title: "Příští schůzka" }), row("b", null, { uploadPreferences: { companyName: "Žlutý kůň" } })];
    expect(selectOsaRecordings(items, { search: "PRISTI" }).items.map(i => i.id)).toEqual(["a"]);
    expect(selectOsaRecordings(items, { search: "zluty kun" }).items.map(i => i.id)).toEqual(["b"]);
  });
  it("vlastní rozsah zahrne celý místní den a neznámá data jen v celém archivu", () => {
    const items = [row("start", new Date(2026, 9, 25, 0).toISOString()), row("end", new Date(2026, 9, 25, 23, 59, 59, 999).toISOString()), row("next", new Date(2026, 9, 26, 0).toISOString()), row("unknown", "bad")];
    expect(selectOsaRecordings(items, { period: "custom", from: "2026-10-25", to: "2026-10-25" }).items.map(i => i.id)).toEqual(["end", "start"]);
    expect(selectOsaRecordings(items).total).toBe(4);
  });
  it("posledních sedm kalendářních dnů přežije změnu letního času", () => {
    const now = new Date(2026, 2, 30, 12);
    const items = [row("yes", new Date(2026, 2, 24, 0).toISOString()), row("no", new Date(2026, 2, 23, 23, 59).toISOString()), row("future", new Date(2026, 2, 31, 0).toISOString())];
    expect(selectOsaRecordings(items, { period: "7" }, now).items.map(i => i.id)).toEqual(["yes"]);
  });
  it("odmítne obrácený i neexistující rozsah jasnou chybou", () => {
    for (const [from, to] of [["2026-02-30", "2026-03-01"], ["2026-10-06", "2026-10-05"], ["", "bad"]]) {
      const result = selectOsaRecordings([row("a", "2026-10-05")], { period: "custom", from, to });
      expect(result.error).toContain("platné datum");
      expect(result.total).toBe(0);
    }
  });
  it("rozlišuje odeslané, pozornost, odložené a čekající bez změny autority", () => {
    const items = [row("sent", null, { state: "odeslano", blockReason: "old" }), row("attention", null, { state: "ceka", requiresHumanAction: true }), row("local", null, { state: "ceka", uploadIntent: "held" }), row("waiting", null, { state: "odesila" })];
    for (const item of items) {
      expect(osaRecordingStatus(item)).toBe(item.id);
      expect(selectOsaRecordings(items, { status: item.id }).items).toEqual([item]);
    }
  });
  it("řadí shodná data stabilně podle ID a seskupí místní dny", () => {
    const items = [row("b", "2026-10-05"), row("a", "2026-10-05"), row("c", null)];
    const result = selectOsaRecordings(items);
    expect(result.items.map(i => i.id)).toEqual(["a", "b", "c"]);
    expect(result.groups.map(g => [g.key, g.items.length])).toEqual([["2026-10-05", 2], ["unknown", 1]]);
  });
});


describe("F uzly a fronta", () => {
  it("odliší odesláno bez serverové odpovědi od čerstvě ověřeného", () => {
    const sent = { state: "odeslano", ownership: "current", localState: "complete-audio" };
    expect(osaRecordingNode(sent)).toBe("unverified");
    expect(osaRecordingNode(sent, true)).toBe("verified");
    expect(osaRecordingNode({ ...sent, recordingInProgress: true }, true)).toBe("recording");
  });
  it("chyba i čekání na vlastníka jsou v badge, held není schválení uploadu", () => {
    const items = [
      { state: "ceka", uploadIntent: "held" },
      { state: "ceka", uploadIntent: "approved" },
      { state: "selhalo" },
      { state: "ceka", uploadIntent: "held", requiresHumanAction: true },
      { state: "odeslano" },
    ];
    expect(osaQueueCount(items)).toBe(3);
    expect(osaRecordingNode(items[0])).toBe("local");
    expect(osaRecordingNode(items[1])).toBe("pending");
    expect(osaRecordingNode(items[2])).toBe("error");
    expect(osaRecordingNode(items[3])).toBe("error");
  });
});
