// Plná serverová stanice vyžaduje skutečný výsledek ověření, samotné odeslání nestačí.
export function OsaStations({ mac, server }) {
  return <div className="osa-stations" aria-label="Uložení nahrávky">
    {[{ ...mac, title: mac?.title ?? "Na tomto Macu", location: "mac" }, { ...server, title: server?.title ?? "V LuDone", location: "server" }].map((station) =>
      <section key={station.location} className="osa-station" data-station={station.error ? "error" : station.location === "server" ? station.verified ? "verified" : "pending" : "local"}>
        <small>{station.title}</small><strong>{station.status}</strong>{station.description && <p>{station.description}</p>}
        {station.actions && <div className="osa-station__actions">{station.actions}</div>}
      </section>)}
  </div>;
}
