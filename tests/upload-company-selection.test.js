import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createUploadCompanySelectionController } = require("../electron/upload-company-selection.cjs");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const OWNER = `sha256:${"a".repeat(64)}`;
const context = (changes = {}) => ({
  issuer: "https://labs.ludone.cz",
  resource: "https://labs.ludone.cz/api/mcp",
  scope: "nahravky:upload",
  ownerFingerprint: OWNER,
  generation: 7,
  storedSession: { accessToken: "secret", companyTabidooId: null },
  ...changes,
});
const offer = (companies = [{ id: A, name: "Alfa" }], defaultCompanyId = null) => ({
  companies, defaultCompanyId,
});

function harness(overrides = {}) {
  let currentContext = context();
  let clock = 1_000;
  const fetchOffer = vi.fn(async () => offer());
  const commitChoice = vi.fn(async () => true);
  const dependencies = {
    readContext: vi.fn(async () => currentContext),
    isContextCurrent: vi.fn(async (candidate) => candidate === currentContext),
    fetchOffer,
    commitChoice,
    now: () => clock,
    randomUUID: vi.fn(() => "offer-token-0000000000000001"),
    ...overrides,
  };
  const controller = createUploadCompanySelectionController(dependencies);
  return {
    controller, fetchOffer: dependencies.fetchOffer, commitChoice: dependencies.commitChoice,
    setContext: (value) => { currentContext = value; },
    tick: (ms) => { clock += ms; },
  };
}

describe("controller výběru upload firmy", () => {
  it.each([
    [[], null],
    [[{ id: A, name: "Alfa" }], null],
    [[{ id: A, name: "Alfa" }, { id: B, name: "Beta" }], B],
  ])("vrátí bezpečnou nabídku bez automatické volby", async (companies, selected) => {
    const h = harness({
      readContext: vi.fn(async () => context({ storedSession: { companyTabidooId: selected } })),
      isContextCurrent: vi.fn(async () => true),
      fetchOffer: vi.fn(async () => offer(companies)),
    });
    const result = await h.controller.load({ requesterKey: "settings", guard: () => true });
    expect(result.companies).toEqual(companies);
    expect(result.selectedCompanyId).toBe(selected);
    expect(h.commitChoice).not.toHaveBeenCalled();
  });

  it.each([
    [offer([{ id: "bad", name: "Alfa" }])],
    [offer([{ id: A, name: "Alfa" }, { id: A, name: "Duplikát" }])],
    [offer([{ id: A, name: "" }])],
    [offer([{ id: A, name: "Alfa" }], B)],
  ])("odmítne vadnou nabídku jako chybu", async (payload) => {
    const h = harness({ fetchOffer: vi.fn(async () => payload) });
    await expect(h.controller.load({ requesterKey: "settings", guard: () => true }))
      .rejects.toMatchObject({ code: "invalid_offer" });
  });

  it("odmítne stale token, jiného requestera a vypršelou nabídku bez commitu", async () => {
    const h = harness();
    const loaded = await h.controller.load({ requesterKey: "settings", guard: () => true });
    await expect(h.controller.select({
      requesterKey: "settings", offerToken: "forged-token-0000000", companyId: A, guard: () => true,
    })).rejects.toMatchObject({ code: "stale_offer" });
    await expect(h.controller.select({
      requesterKey: "other", offerToken: loaded.offerToken, companyId: A, guard: () => true,
    })).rejects.toMatchObject({ code: "stale_offer" });
    h.tick(60_000);
    await expect(h.controller.select({
      requesterKey: "settings", offerToken: loaded.offerToken, companyId: A, guard: () => true,
    })).rejects.toMatchObject({ code: "stale_offer" });
    expect(h.commitChoice).not.toHaveBeenCalled();
  });

  it("platný výběr znovu ověří nabídku a commitne přesné ID jednou", async () => {
    const h = harness();
    const loaded = await h.controller.load({ requesterKey: "settings", guard: () => true });
    const args = { requesterKey: "settings", offerToken: loaded.offerToken, companyId: A, guard: () => true };
    const [first, second] = await Promise.allSettled([
      h.controller.select(args), h.controller.select(args),
    ]);
    expect(first.status).toBe("fulfilled");
    expect(second.status).toBe("rejected");
    expect(h.fetchOffer).toHaveBeenCalledTimes(2);
    expect(h.commitChoice).toHaveBeenCalledTimes(1);
    expect(h.commitChoice).toHaveBeenCalledWith(expect.objectContaining({ companyId: A }));
  });

  it("🔴 necommitne firmu odebranou z nové nabídky", async () => {
    const h = harness({
      fetchOffer: vi.fn()
        .mockResolvedValueOnce(offer([{ id: A, name: "Alfa" }]))
        .mockResolvedValueOnce(offer([{ id: B, name: "Beta" }])),
    });
    const loaded = await h.controller.load({ requesterKey: "settings", guard: () => true });
    await expect(h.controller.select({
      requesterKey: "settings", offerToken: loaded.offerToken, companyId: A, guard: () => true,
    })).rejects.toMatchObject({ code: "company_removed" });
    expect(h.commitChoice).not.toHaveBeenCalled();
  });

  it("po změně auth během čekání ani po invalidate neuloží nabídku", async () => {
    let resolveFetch;
    const pending = new Promise((resolve) => { resolveFetch = resolve; });
    const h = harness({ fetchOffer: vi.fn(() => pending) });
    const loading = h.controller.load({ requesterKey: "settings", guard: () => true });
    await vi.waitFor(() => expect(h.fetchOffer).toHaveBeenCalledTimes(1));
    h.controller.invalidate();
    resolveFetch(offer());
    await expect(loading).rejects.toMatchObject({ code: "context_changed" });
  });

  it("odmítne změněný owner/generation a guard=false", async () => {
    const h = harness();
    const loaded = await h.controller.load({ requesterKey: "settings", guard: () => true });
    h.setContext(context({ generation: 8 }));
    await expect(h.controller.select({
      requesterKey: "settings", offerToken: loaded.offerToken, companyId: A, guard: () => true,
    })).rejects.toMatchObject({ code: "context_changed" });
    await expect(h.controller.load({ requesterKey: "settings", guard: () => false }))
      .rejects.toMatchObject({ code: "context_changed" });
    expect(h.commitChoice).not.toHaveBeenCalled();
  });
});
