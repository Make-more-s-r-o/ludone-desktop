"use strict";

const COMPANY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const OWNER_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const UPLOAD_SCOPE = "nahravky:upload";
const OFFER_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;

function failure(code) {
  return Object.assign(new Error(code), { code });
}

function requireGuard(guard) {
  if (typeof guard !== "function" || guard() !== true) throw failure("context_changed");
}

function hasControlCharacters(value) {
  return [...value].some((character) => {
    const code = character.codePointAt(0);
    return code <= 31 || code === 127;
  });
}

function validateContext(value) {
  if (
    !value || typeof value !== "object" || !value.storedSession
    || typeof value.issuer !== "string" || typeof value.resource !== "string"
    || value.scope !== UPLOAD_SCOPE || !OWNER_PATTERN.test(value.ownerFingerprint ?? "")
    || !Number.isSafeInteger(value.generation) || value.generation < 0
  ) throw failure("invalid_context");
  return value;
}

function validateOffer(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.companies) || value.companies.length > 100) {
    throw failure("invalid_offer");
  }
  const seen = new Set();
  const companies = value.companies.map((company) => {
    if (!company || typeof company !== "object") throw failure("invalid_offer");
    const { id, name } = company;
    if (!COMPANY_ID_PATTERN.test(id ?? "") || typeof name !== "string"
      || name.length < 1 || name.length > 160 || name.trim() !== name || hasControlCharacters(name)
      || seen.has(id)) throw failure("invalid_offer");
    seen.add(id);
    return Object.freeze({ id, name });
  });
  const defaultCompanyId = value.defaultCompanyId ?? null;
  if (defaultCompanyId !== null
    && (!COMPANY_ID_PATTERN.test(defaultCompanyId) || !seen.has(defaultCompanyId))) {
    throw failure("invalid_offer");
  }
  return { companies: Object.freeze(companies), defaultCompanyId };
}

function sameBinding(left, right) {
  return left.issuer === right.issuer && left.resource === right.resource
    && left.scope === right.scope && left.ownerFingerprint === right.ownerFingerprint
    && left.generation === right.generation;
}

function createUploadCompanySelectionController({
  readContext,
  isContextCurrent,
  fetchOffer,
  commitChoice,
  now = Date.now,
  randomUUID,
}) {
  for (const dependency of [readContext, isContextCurrent, fetchOffer, commitChoice, now, randomUUID]) {
    if (typeof dependency !== "function") throw new TypeError("Chybí závislost controlleru výběru firmy");
  }
  const snapshots = new Map();
  const loads = new Map();
  let epoch = 0;

  function validateRequest(requesterKey, guard) {
    if (typeof requesterKey !== "string" || requesterKey.length < 1 || requesterKey.length > 128) {
      throw failure("invalid_requester");
    }
    requireGuard(guard);
  }

  async function stillCurrent(context, guard, expectedEpoch) {
    requireGuard(guard);
    if (epoch !== expectedEpoch) throw failure("context_changed");
    const current = await isContextCurrent(context);
    requireGuard(guard);
    if (epoch !== expectedEpoch || current !== true) throw failure("context_changed");
  }

  async function timedFetch(context) {
    const abortController = new AbortController();
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        reject(failure("offer_timeout"));
      }, REQUEST_TIMEOUT_MS);
    });
    try {
      return await Promise.race([fetchOffer(context, { signal: abortController.signal }), timeout]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function load({ requesterKey, guard }) {
    validateRequest(requesterKey, guard);
    snapshots.delete(requesterKey);
    const expectedEpoch = epoch;
    const serial = (loads.get(requesterKey) ?? 0) + 1;
    loads.set(requesterKey, serial);
    const context = validateContext(await readContext());
    await stillCurrent(context, guard, expectedEpoch);
    const offer = validateOffer(await timedFetch(context));
    await stillCurrent(context, guard, expectedEpoch);
    if (loads.get(requesterKey) !== serial) throw failure("stale_offer");

    const selected = context.storedSession.companyTabidooId;
    const selectedCompanyId = COMPANY_ID_PATTERN.test(selected ?? "")
      && offer.companies.some(({ id }) => id === selected) ? selected : null;
    const offerToken = randomUUID();
    if (typeof offerToken !== "string" || offerToken.length < 16 || offerToken.length > 128) {
      throw failure("invalid_offer_token");
    }
    snapshots.set(requesterKey, {
      context,
      companies: offer.companies,
      offerToken,
      expiresAt: now() + OFFER_TTL_MS,
    });
    return { companies: offer.companies, selectedCompanyId, offerToken };
  }

  async function select({ requesterKey, offerToken, companyId, guard }) {
    validateRequest(requesterKey, guard);
    const snapshot = snapshots.get(requesterKey);
    if (!snapshot || snapshot.offerToken !== offerToken || now() >= snapshot.expiresAt
      || !COMPANY_ID_PATTERN.test(companyId ?? "")
      || !snapshot.companies.some(({ id }) => id === companyId)) throw failure("stale_offer");
    snapshots.delete(requesterKey);
    const expectedEpoch = epoch;
    const context = validateContext(await readContext());
    await stillCurrent(context, guard, expectedEpoch);
    if (!sameBinding(snapshot.context, context)) throw failure("context_changed");
    const freshOffer = validateOffer(await timedFetch(context));
    await stillCurrent(context, guard, expectedEpoch);
    if (!freshOffer.companies.some(({ id }) => id === companyId)) throw failure("company_removed");
    requireGuard(guard);
    const committed = await commitChoice({ context, companyId, guard });
    await stillCurrent(context, guard, expectedEpoch);
    if (committed !== true) throw failure("commit_rejected");
    return { saved: true, selectedCompanyId: companyId };
  }

  function invalidate() {
    epoch += 1;
    snapshots.clear();
    loads.clear();
  }

  return Object.freeze({ invalidate, load, select });
}

module.exports = { createUploadCompanySelectionController };
