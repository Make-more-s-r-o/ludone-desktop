"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const COMPANY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const FILE = "upload-company-defaults.json";

function validCompanyName(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 160
    && value.trim() === value && ![...value].some((character) => {
      const code = character.codePointAt(0);
      return code <= 31 || code === 127;
    });
}

function validCompanySubject(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256
    && value.trim() === value && ![...value].some((character) => {
      const code = character.codePointAt(0);
      return code <= 31 || code === 127;
    });
}

// E-mail lze po smazání účtu znovu přidělit; předvolbu proto vážeme na subject
// ověřený v userinfo. Starší relace bez něj nelze bezpečně připsat novému účtu.
function companyIdentity(session) {
  if (session?.scope !== "nahravky:upload" || !validCompanySubject(session.userinfoSubject)) return null;
  const email = typeof session.identity?.email === "string" ? session.identity.email.trim().normalize("NFC") : "";
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator === email.length - 1 || email.indexOf("@") !== separator || /\s/u.test(email)) return null;
  try {
    const issuer = new URL(session.issuer);
    if (issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.pathname !== "/"
      || issuer.search || issuer.hash || issuer.origin !== session.issuer
      || session.resource !== `${issuer.origin}/api/mcp`) return null;
    return { issuer: issuer.origin, subject: session.userinfoSubject };
  } catch {
    return null;
  }
}

async function readEntries(directory) {
  let contents;
  try {
    contents = await fs.promises.readFile(path.join(directory, FILE), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const value = JSON.parse(contents);
  if (!Array.isArray(value) || value.length > 1000) throw new Error("Neplatný soubor předvoleb firem");
  return value.filter((entry) => entry && typeof entry.issuer === "string"
    && validCompanySubject(entry.subject) && COMPANY_ID.test(entry.companyId ?? ""))
    .map(({ issuer, subject, companyId, companyName }) => ({ issuer, subject, companyId,
      ...(validCompanyName(companyName) ? { companyName } : {}) }));
}

async function readCompanyDefault(directory, session) {
  const identity = companyIdentity(session);
  if (!identity) return null;
  const entries = await readEntries(directory);
  const entry = entries.find((item) => item.issuer === identity.issuer && item.subject === identity.subject);
  return entry ? { companyId: entry.companyId, ...(entry.companyName ? { companyName: entry.companyName } : {}) } : null;
}

// Volající serializuje tento zápis se změnami šifrované relace.
async function writeCompanyDefault(directory, session, companyId) {
  const identity = companyIdentity(session);
  if (!identity || (companyId !== null && !COMPANY_ID.test(companyId ?? ""))) return;
  const entries = await readEntries(directory);
  const previous = entries.find((entry) => entry.issuer === identity.issuer && entry.subject === identity.subject);
  if (companyId === null && !previous) return;
  const next = entries.filter((entry) => entry.issuer !== identity.issuer || entry.subject !== identity.subject);
  if (companyId !== null) {
    const name = session.companyTabidooId === companyId && validCompanyName(session.companyTabidooName)
      ? session.companyTabidooName : previous?.companyId === companyId && validCompanyName(previous.companyName)
        ? previous.companyName : null;
    next.push({ ...identity, companyId, ...(name ? { companyName: name } : {}) });
  }
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.${FILE}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.promises.open(temporary, "wx", 0o600);
    await handle.writeFile(JSON.stringify(next));
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.promises.rename(temporary, path.join(directory, FILE));
    await fs.promises.chmod(path.join(directory, FILE), 0o600);
    handle = await fs.promises.open(directory, "r");
    await handle.sync();
    await handle.close();
    handle = undefined;
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.promises.unlink(temporary).catch(() => {});
    throw error;
  }
}

module.exports = { companyIdentity, readCompanyDefault, validCompanyName, validCompanySubject, writeCompanyDefault };
