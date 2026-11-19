import { describe, expect, it } from "vitest";
import { recordingDeliveryStatus } from "../src/lib/recording-delivery-status.js";
import { osaRecordingNode, osaRecordingStatus } from "../src/lib/osa-recordings.js";

const base = {
  state: "ceka", source: "queue", uploadIntent: "approved", ownership: "current",
  localState: "complete-audio", requiresHumanAction: false, blockReason: null,
  actions: { claim: { allowed: false, reason: null }, send: { allowed: false, reason: null }, retry: { allowed: false, reason: null } },
};

describe("společný stav odeslání nahrávky", () => {
  it.each([
    [{ ...base, uploadIntent: "held", actions: { send: { allowed: true, reason: null } } }, "local", "Jen na Macu", "send"],
    [base, "waiting", "Čeká na odeslání", null],
    [{ ...base, state: "odesila" }, "waiting", "Odesílá se…", null],
    [{ ...base, state: "odeslano" }, "sent", "Odesláno", null],
    [{ ...base, state: "selhalo", actions: { retry: { allowed: true, reason: null } } }, "attention", "Neodešlo — důvod nezjištěn", "retry"],
    [{ ...base, requiresHumanAction: true, blockReason: "company_not_chosen", actions: { retry: { allowed: true, reason: null } } }, "attention", "Neodešlo — chybí vybraná firma", "company"],
    [{ ...base, requiresHumanAction: true, blockReason: "insufficient_scope", actions: { retry: { allowed: true, reason: null } } }, "attention", "Neodešlo — přihlášení nemá oprávnění k odeslání", "login"],
    [{ ...base, ownership: "other", actions: { claim: { allowed: true, reason: null } } }, "attention", "Neodešlo — nahrávka patří jinému účtu", "claim"],
    [{ ...base, ownership: "unknown", actions: { claim: { allowed: true, reason: null } } }, "attention", "Neodešlo — vlastník nahrávky není potvrzený", "claim"],
  ])("stav %# odpovídá i tečce a navrhuje povolenou akci", (item, tone, label, action) => {
    const status = recordingDeliveryStatus(item);
    expect(status).toMatchObject({ tone, label, action: action ? { type: action } : null });
    expect(osaRecordingStatus(item)).toBe(tone);
    if (tone === "attention") expect(osaRecordingNode(item)).toBe("error");
  });

  it("po ověření uvádí LuDone, samotné odeslání neoznačí za ověřené", () => {
    const item = { ...base, state: "odeslano" };
    expect(recordingDeliveryStatus(item).label).toBe("Odesláno");
    expect(recordingDeliveryStatus(item, { verified: true }).label).toBe("V LuDone ✓");
    expect(recordingDeliveryStatus(base, { verified: true }).label).toBe("V LuDone ✓");
    expect(osaRecordingNode(base, true)).toBe("verified");
  });

  it("čekajícímu automatickému opakování ukáže místní čas bez starého důvodu selhání", () => {
    // Budoucí termín: prošlý termín se jako další pokus nevypisuje (review #201 k4).
    const nextAttemptAt = new Date(2099, 10, 19, 14, 5).getTime();
    const status = recordingDeliveryStatus({ ...base, nextAttemptAt, lastFailureReason: "network_error" });
    expect(status.tone).toBe("waiting");
    expect(status.label).toBe("Čeká na odeslání · další pokus v 14:05");
  });

  it("po převzetí výslovně čeká na novou volbu odeslání", () => {
    const item = { ...base, uploadIntent: "held", requiresHumanAction: true,
      blockReason: "Převzatá nahrávka čeká na volbu odeslání", actions: { send: { allowed: true, reason: null } } };
    expect(recordingDeliveryStatus(item)).toMatchObject({ tone: "local", label: "Jen na Macu", action: { type: "send" } });
    expect(osaRecordingStatus(item)).toBe("local");
    expect(recordingDeliveryStatus(item, { authState: "expired" }).label).toBe("Jen na Macu");
  });

  it("neznámý důvod neprozradí interní text a nenabízí nepovolené opakování", () => {
    const item = { ...base, state: "selhalo", blockReason: "/soukrome/tajny-soubor", actions: {} };
    expect(recordingDeliveryStatus(item)).toMatchObject({ label: "Neodešlo — důvod nezjištěn", action: null });
  });

  it("neplete HTTP 401 se skutečně vypršelou relací", () => {
    const item = { ...base, requiresHumanAction: true, blockReason: "unauthorized", actions: { retry: { allowed: true, reason: null } } };
    const status = recordingDeliveryStatus(item);
    expect(status.label).toBe("Neodešlo — server odmítl odeslání");
    expect(status.action?.type).toBe("retry");
  });

  it.each([
    ["unauthorized (HTTP 401)", "server odmítl odeslání", "retry"],
    ["insufficient_scope (HTTP 403)", "přihlášení nemá oprávnění k odeslání", "login"],
    ["Není vybraná firma, pod kterou se má nahrávka odeslat", "chybí vybraná firma", "company"],
    ["Rozpracovaná nahrávka nemá bezpečně uloženou firmu; otevřete Nastavení", "u nahrávky nelze určit firmu", null],
    ["Uložená firma nahrávky není platná", "u nahrávky nelze určit firmu", null],
    ["Pro upload chybí přihlášení", "chybí přihlášení", "login"],
    ["Síťový požadavek uploadu vypršel", "spojení se serverem se nepodařilo", "retry"],
  ])("známý skutečně ukládaný důvod %s přeloží bez kódu", (blockReason, reason, action) => {
    const status = recordingDeliveryStatus({ ...base, requiresHumanAction: true, blockReason, actions: { retry: { allowed: true, reason: null } } });
    expect(status.label).toBe(`Neodešlo — ${reason}`);
    expect(status.action?.type ?? null).toBe(action);
  });

  it("pro neúplný zvuk neukazuje čekání ani nepovolenou akci", () => {
    const item = { ...base, localState: "missing-audio", actions: {} };
    expect(recordingDeliveryStatus(item)).toMatchObject({ tone: "attention", label: "Neodešlo — zvukové soubory chybí", action: null });
    expect(osaRecordingNode(item)).toBe("error");
  });

  it("u neúplného osiřelého záznamu netvrdí neznámý výsledek odeslání", () => {
    const item = { ...base, source: "orphan", state: "orphan", ownership: "unavailable",
      localState: "missing-audio", actions: {} };
    expect(recordingDeliveryStatus(item)).toMatchObject({ tone: "attention", label: "Problém — zvukové soubory chybí", action: null });
  });

  it("neznámý stav neoznačí jen podle výchozího souhlasu jako uložený na Macu", () => {
    const item = { ...base, state: "unknown", uploadIntent: "held" };
    expect(recordingDeliveryStatus(item)).toMatchObject({ tone: "attention", label: "Stav odeslání není známý", action: null });
    expect(osaRecordingNode(item)).toBe("error");
  });
});

describe("regrese druhého kola", () => {
  it.each(["ceka", "selhalo"])("úplné ověření má přednost před lokálním stavem %s", (state) => {
    const item = { ...base, state };
    expect(recordingDeliveryStatus(item, { verified: true })).toMatchObject({ tone: "sent", label: "V LuDone ✓", action: null });
    expect(osaRecordingNode(item, true, "sent")).toBe("verified");
  });

  it.each(["unknown", "other"])("zdravé held s vlastníkem %s zůstane na Macu", (ownership) => {
    const item = { ...base, uploadIntent: "held", ownership, actions: { claim: { allowed: true, reason: null } } };
    expect(recordingDeliveryStatus(item)).toMatchObject({ tone: "local", label: "Jen na Macu" });
  });

  it.each([
    ["insufficient_scope", "přihlášení nemá oprávnění k odeslání", "login"],
    ["company_not_chosen", "chybí vybraná firma", "company"],
  ])("část zvuku chybí a současně zůstane vidět blokace %s", (blockReason, reason, action) => {
    const status = recordingDeliveryStatus({ ...base, localState: "partial-audio", requiresHumanAction: true, blockReason });
    expect(status.label).toContain("část zvuku chybí");
    expect(status.label).toContain(reason);
    expect(status.action?.type).toBe(action);
  });

  it("vypnutý transport vysvětlí pod tlačítkem", () => {
    expect(recordingDeliveryStatus({ ...base, sendingDisabledReason: "odesílání je vypnuté",
      actions: { retry: { allowed: false, reason: "Odesílání je vypnuté." } } }))
      .toMatchObject({ tone: "attention", label: "Neodešlo — odesílání je vypnuté", disabledReason: "Odesílání je vypnuté." });
  });

  it("timeout a neověřené přihlášení nevyvozují příčinu", () => {
    expect(recordingDeliveryStatus({ ...base, state: "selhalo", blockReason: "Síťový požadavek uploadu vypršel" }).label)
      .toBe("Neodešlo — spojení se serverem se nepodařilo");
    expect(recordingDeliveryStatus({ ...base, state: "selhalo", blockReason: "Přihlášení pro upload nelze načíst" }).label)
      .toBe("Neodešlo — přihlášení nelze ověřit");
  });

  it("převzetí neslibuje odeslání", () => {
    const status = recordingDeliveryStatus({ ...base, ownership: "other", actions: { claim: { allowed: true, reason: null } } });
    expect(status.action?.label).toBe("Převzít nahrávku");
  });
});

it("R6 zdravé záznamy bez potvrzeného vlastníka nezvyšují počet Odesílání", async () => {
  const { osaQueueCount } = await import("../src/lib/osa-recordings.js");
  const held = ["other", "unknown"].map((ownership) => ({ ...base, uploadIntent: "held", ownership }));
  expect(osaQueueCount(held)).toBe(0);
});

it.each(["expired", "signed-out"])("K6 poškozený osiřelý záznam při stavu %s nenabízí přihlášení", (authState) => {
  const item = { ...base, source: "orphan", state: "orphan", ownership: "unavailable",
    localState: "missing-audio", actions: {} };
  expect(recordingDeliveryStatus(item, { authState })).toMatchObject({
    tone: "attention", label: "Problém — zvukové soubory chybí", action: null,
  });
});

it.each(["network_error", "Síťový požadavek uploadu selhal: citlivá adresa [POST /upload]"])(
  "K3 síťovou chybu %s přeloží bez vnitřních údajů", (blockReason) => {
    const status = recordingDeliveryStatus({ ...base, state: "selhalo", blockReason, actions: { retry: { allowed: true, reason: null } } });
    expect(status.label).toBe("Neodešlo — spojení se serverem se nepodařilo");
    expect(status.action?.type).toBe("retry");
  },
);

describe("review #201 kolo 4", () => {
  it("přihlášenému s povoleným opakováním nenabídne přihlášení kvůli historickému důvodu", () => {
    const status = recordingDeliveryStatus({ state: "ceka", uploadIntent: "approved", ownership: "current",
      localState: "complete-audio", requiresHumanAction: true, blockReason: "Identitu aktuálního přihlášení nelze ověřit",
      actions: { retry: { allowed: true, reason: null }, send: { allowed: false, reason: null }, claim: { allowed: false, reason: null } } },
    { authState: "signed-in" });
    expect(status.action?.type).toBe("retry");
  });

  it("limit 429 je známý důvod, ne důvod nezjištěn", () => {
    const status = recordingDeliveryStatus({ state: "ceka", uploadIntent: "approved", ownership: "current",
      localState: "complete-audio", blockReason: "Server dočasně omezil odesílání.",
      actions: { retry: { allowed: false, reason: null }, send: { allowed: false, reason: null }, claim: { allowed: false, reason: null } } },
    { authState: "signed-in" });
    expect(status.label).toContain("server dočasně omezil odesílání");
    expect(status.label).not.toContain("důvod nezjištěn");
  });

  it("prošlý termín dalšího pokusu se nevypisuje jako budoucí opakování", () => {
    const status = recordingDeliveryStatus({ state: "ceka", uploadIntent: "approved", ownership: "current",
      localState: "complete-audio", nextAttemptAt: Date.now() - 60_000,
      actions: { retry: { allowed: false, reason: null }, send: { allowed: false, reason: null }, claim: { allowed: false, reason: null } } },
    { authState: "signed-in" });
    expect(status.label).not.toContain("další pokus v");
  });
});
