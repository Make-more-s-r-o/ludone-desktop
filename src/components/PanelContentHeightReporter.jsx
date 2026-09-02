import { useEffect, useRef } from "react";

const OBSERVER_OPTIONS = {
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
};

function restoreInlineStyle(element, property, value) {
  if (value) element.style.setProperty(property, value);
  else element.style.removeProperty(property);
}

export function PanelContentHeightReporter({ children }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const reportHeight = window.ludone?.setPanelContentHeight;
    if (!container || typeof reportHeight !== "function") return undefined;

    let animationFrame = null;
    let lastReportedHeight = null;
    let observer;

    const measure = () => {
      animationFrame = null;
      const surface = container.firstElementChild;
      if (!(surface instanceof HTMLElement)) return;

      const scrollContainers = [
        surface,
        ...surface.querySelectorAll(".panel-scroll, .onboarding__content"),
      ];
      const scrollPositions = scrollContainers.map((element) => ({
        element,
        left: element.scrollLeft,
        top: element.scrollTop,
      }));

      // Běžně má surface výšku 100 % okna. Pro jediné měření proto odpojíme
      // observer a zjistíme její přirozenou výšku bez stropu současného viewportu.
      // Vlastní změny inline stylu se tak nikdy nevrátí jako další pozorování.
      observer.disconnect();
      const previousHeight = surface.style.getPropertyValue("height");
      const previousMaxHeight = surface.style.getPropertyValue("max-height");
      let measuredHeight;
      try {
        surface.style.setProperty("height", "auto");
        surface.style.setProperty("max-height", "none");
        measuredHeight = Math.ceil(surface.getBoundingClientRect().height);
      } finally {
        restoreInlineStyle(surface, "height", previousHeight);
        restoreInlineStyle(surface, "max-height", previousMaxHeight);
        // Auto-height může dočasně odstranit overflow a Chromium pak scroll
        // ořízne na nulu. Po návratu viewportu proto obnovíme přesné místo.
        scrollPositions.forEach(({ element, left, top }) => {
          element.scrollLeft = left;
          element.scrollTop = top;
        });
        observer.observe(container, OBSERVER_OPTIONS);
      }

      if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) return;
      if (measuredHeight === lastReportedHeight) return;
      // Deduplikaci zapisujeme před IPC. Ani pomalá odpověď hlavního procesu tak
      // nemůže rozjet více souběžných změn téže výšky.
      lastReportedHeight = measuredHeight;
      try {
        Promise.resolve(reportHeight(measuredHeight)).catch(() => {
          if (lastReportedHeight === measuredHeight) lastReportedHeight = null;
        });
      } catch {
        // Rozměr panelu je vylepšení zobrazení; selhání IPC nesmí shodit renderer.
        if (lastReportedHeight === measuredHeight) lastReportedHeight = null;
      }
    };

    const scheduleMeasurement = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(measure);
    };

    observer = new window.MutationObserver(scheduleMeasurement);
    observer.observe(container, OBSERVER_OPTIONS);
    scheduleMeasurement();

    return () => {
      observer.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div className="panel-content-height-reporter" ref={containerRef}>
      {children}
    </div>
  );
}
