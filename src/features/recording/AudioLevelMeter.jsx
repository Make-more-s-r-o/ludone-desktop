import { forwardRef } from "react";

function normalizedPercent(percent) {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

/**
 * Aktualizuje jedinou vlastnost, která ovládá délku pruhu. Volající může
 * vzorkovat zvuk po animačních snímcích bez překreslování celé React karty.
 *
 * @param {HTMLSpanElement | null} fill
 * @param {number} percent
 * @param {"measured" | "unavailable"} [measurementState]
 */
export function updateAudioLevelMeter(fill, percent, measurementState = "measured") {
  if (!fill) return;
  const measuredWidth = `${normalizedPercent(percent)}%`;
  if (fill.style.getPropertyValue("--audio-level-measured") !== measuredWidth) {
    fill.style.setProperty("--audio-level-measured", measuredWidth);
  }
  const meter = fill.closest(".audio-level-meter");
  if (meter?.dataset.measurementState !== measurementState) {
    meter.dataset.measurementState = measurementState;
  }
}

/**
 * Sdílený pruh pro onboarding i panel. Stavy `lost` a `unavailable` jsou
 * úmyslně 2 %, aby nebyly zaměnitelné s naměřeným tichem živé stopy.
 */
export const AudioLevelMeter = forwardRef(function AudioLevelMeter({
  className = "",
  fillClassName = "",
  state = "silent",
}, fillRef) {
  return (
    <span
      className={`audio-level-meter${className ? ` ${className}` : ""}`}
      data-level-state={state}
      aria-hidden="true"
    >
      <span
        className={`audio-level-meter__fill${fillClassName ? ` ${fillClassName}` : ""}`}
        ref={fillRef}
      />
    </span>
  );
});
