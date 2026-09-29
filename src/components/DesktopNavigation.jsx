const DESTINATIONS = Object.freeze([
  { id: "now", label: "Teď" },
  { id: "day", label: "Můj den" },
  { id: "settings", label: "Nastavení" },
]);

export function DesktopNavigation({ active, onNavigate }) {
  return (
    <nav className="desktop-navigation" aria-label="Hlavní navigace LuDone Desktop">
      {DESTINATIONS.map((destination) => (
        <button
          key={destination.id}
          type="button"
          className={`desktop-navigation__item${destination.id === "settings" ? " desktop-navigation__item--end" : ""}`}
          aria-current={active === destination.id ? "page" : undefined}
          data-active={active === destination.id ? "true" : "false"}
          onClick={() => onNavigate(destination.id)}
        >
          {destination.label}
        </button>
      ))}
    </nav>
  );
}
