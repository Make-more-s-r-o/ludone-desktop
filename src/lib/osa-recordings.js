export const OSA_PAGE_SIZE = 7;

function fold(value) {
  return String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("cs");
}

// Datum z formuláře je místní kalendářní den, nikoli půlnoc v UTC.
function calendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function itemDate(value) {
  if (value == null || value === "") return null;
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarDate(value) : new Date(value);
  return date && Number.isFinite(date.getTime()) ? date : null;
}

/** Prezentační filtr; neposkytuje oprávnění k žádné operaci fronty. */
export function osaRecordingStatus(item) {
  if (item.state === "odeslano") return "sent";
  if (item.requiresHumanAction || item.state === "selhalo" || item.blockReason || ["incomplete", "partial-audio", "missing-audio", "invalid-manifest", "unreadable"].includes(item.localState)) return "attention";
  if (item.uploadIntent === "held" || !item.state) return "local";
  return "waiting";
}

function dateKey(date) {
  if (!date) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Výběr z úplného skutečného seznamu bez změny vstupů. groups obsahuje pouze aktuální stránku.
 * @param {any[]} items
 * @param {{search?: string, period?: string, from?: string, to?: string, status?: string, filter?: string, page?: number}} query
 */
export function selectOsaRecordings(items, query = {}, now = new Date()) {
  query = query && typeof query === "object" ? query : {};
  const period = query.period ?? "all";
  let from = null;
  let until = null;
  let error = null;
  if (period === "custom") {
    from = calendarDate(query.from);
    const to = calendarDate(query.to);
    if (!from || !to || from > to) error = "Zadejte platné datum od a do; konec nesmí předcházet začátku.";
    else { until = new Date(to); until.setDate(until.getDate() + 1); }
  } else if (["today", "7", "30", "180"].includes(period)) {
    if (!Number.isFinite(now.getTime())) error = "Aktuální datum není platné.";
    else {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      until = new Date(from); until.setDate(until.getDate() + 1);
      from.setDate(from.getDate() - (period === "today" ? 0 : Number(period) - 1));
    }
  }
  const search = fold(query.search).trim();
  const requestedStatus = query.status ?? query.filter;
  const status = ["local", "waiting", "sent", "attention"].includes(requestedStatus) ? requestedStatus : "all";
  const selected = error ? [] : (Array.isArray(items) ? items : []).filter(item => item && typeof item === "object").map((item, index) => ({ item, index, date: itemDate(item.createdAt) })).filter(({ item, date }) => {
    if (from && (!date || date < from || date >= until)) return false;
    if (status !== "all" && osaRecordingStatus(item) !== status) return false;
    return !search || fold([item.title, item.companyName, item.company?.name, item.uploadPreferences?.companyName].filter(Boolean).join(" ")).includes(search);
  }).sort((a, b) => {
    const byDate = (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity);
    if (byDate && !Number.isNaN(byDate)) return byDate;
    const byId = String(a.item.id ?? "").localeCompare(String(b.item.id ?? ""), "en");
    return byId || a.index - b.index;
  });
  const total = selected.length;
  const pageCount = Math.max(1, Math.ceil(total / OSA_PAGE_SIZE));
  const requested = Number(query.page);
  const page = Math.min(pageCount, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1));
  const pageRows = selected.slice((page - 1) * OSA_PAGE_SIZE, page * OSA_PAGE_SIZE);
  const groups = [];
  for (const row of pageRows) {
    const key = dateKey(row.date);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) { group = { key, items: [] }; groups.push(group); }
    group.items.push(row.item);
  }
  return { items: pageRows.map(row => row.item), total, page, pageCount, pageSize: OSA_PAGE_SIZE, groups, error };
}

// Uzly nemají odvozovat serverové ověření ze samotného odeslání.
export function osaRecordingNode(item, verified = false) {
  if (item.recordingInProgress) return "recording";
  if (osaRecordingStatus(item) === "attention") return "error";
  if (verified) return "verified";
  if (item.state === "odeslano") return "unverified";
  if (osaRecordingStatus(item) === "waiting") return "pending";
  return "local";
}

export function osaQueueCount(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item && ["waiting", "attention"].includes(osaRecordingStatus(item))).length;
}
