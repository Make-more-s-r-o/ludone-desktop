/**
 * Odstraní automatický český časový prefix jen pro zobrazení názvu nahrávky.
 * @param {unknown} title
 */
export function recordingDisplayTitle(title) {
  const text = typeof title === "string" ? title.trim() : "";
  if (!text) return "Schůzka";
  const generated = text.match(/^(?:\d{1,2}\.\s*(?:ledna|února|března|dubna|května|června|července|srpna|září|října|listopadu|prosince)\s+\d{4},\s*\d{1,2}:\d{2})(?:\s*[-–—]\s*(.*))?$/iu);
  return generated ? generated[1]?.trim() || "Schůzka" : text;
}
