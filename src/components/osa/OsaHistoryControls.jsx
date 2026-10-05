const filters = [["all", "Vše"], ["local", "Na Macu"], ["waiting", "Čeká"], ["attention", "Pozornost"], ["sent", "V LuDone"]];
export function OsaHistoryControls({ query = {}, onChange, result = {}, placement = "all" }) {
  const change = (patch) => onChange?.({ ...patch, page: 1 });
  const page = result.page ?? query.page ?? 1;
  const pageCount = result.pageCount ?? 1;
  return <div className={`osa-history-controls osa-history-controls--${placement}`}>
    {placement !== "pagination" && <>
      <div className="osa-filter-bar">
        <label className="osa-search"><span className="sr-only">Hledat nahrávky</span><input type="search" placeholder="Hledat nahrávku…" value={query.search ?? ""} onChange={(event) => change({ search: event.target.value })} /></label>
        <label className="osa-period"><span className="sr-only">Období</span><select aria-label="Období" value={query.period ?? "180"} onChange={(event) => change({ period: event.target.value })}>
          <option value="today">Dnes</option><option value="7">7 dní</option><option value="30">30 dní</option><option value="180">180 dní</option><option value="all">Vše</option><option value="custom">Vlastní období</option>
        </select></label>
      </div>
      <div className="osa-status-filters" role="group" aria-label="Stav nahrávky">{filters.map(([value, label]) => <button type="button" key={value} aria-pressed={(query.filter ?? "all") === value} onClick={() => change({ filter: value })}>{label}</button>)}</div>
      {query.period === "custom" && <div className="osa-date-range"><label>Od<input type="date" value={query.from ?? ""} onChange={(event) => change({ from: event.target.value })} /></label><label>Do<input type="date" value={query.to ?? ""} min={query.from || undefined} onChange={(event) => change({ to: event.target.value })} /></label></div>}
    </>}
    {placement !== "filters" && <div className="osa-pagination" aria-label="Stránkování nahrávek">
      <span role="status">{result.total ?? 0} nahrávek · {page} / {pageCount}</span>
      <button type="button" disabled={page <= 1} onClick={() => onChange?.({ page: page - 1 })} aria-label="Předchozí stránka">‹</button>
      <button type="button" disabled={page >= pageCount} onClick={() => onChange?.({ page: page + 1 })} aria-label="Další stránka">›</button>
    </div>}
  </div>;
}
