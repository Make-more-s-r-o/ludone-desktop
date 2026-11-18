/**
 * Odstraní automatický český časový prefix jen pro zobrazení názvu nahrávky.
 * @param {unknown} title
 * @param {unknown} createdAt
 */
export function recordingDisplayTitle(title, createdAt) {
  const text = typeof title === "string" ? title.trim() : "";
  if (!text) return "Schůzka";
  const generated = text.match(/^(\d{1,2})\.\s*(ledna|února|března|dubna|května|června|července|srpna|září|října|listopadu|prosince)\s+(\d{4}),\s*(\d{1,2}):(\d{2})(?:\s*[-–—]\s*(.*))?$/iu);
  if (!generated || typeof createdAt !== "string" || !createdAt.trim()) return text;
  const start = new Date(createdAt);
  if (!Number.isFinite(start.getTime())) return text;
  const months = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
  const matchesStart = Number(generated[1]) === start.getDate()
    && generated[2].toLocaleLowerCase("cs") === months[start.getMonth()]
    && Number(generated[3]) === start.getFullYear()
    && Number(generated[4]) === start.getHours()
    && Number(generated[5]) === start.getMinutes();
  return matchesStart ? generated[6]?.trim() || "Schůzka" : text;
}
