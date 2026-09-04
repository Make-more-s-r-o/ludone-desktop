/**
 * Vrátí český popisek počtu pro hranice 1, 2–4 a ostatní hodnoty.
 */
export function countLabel(count, singular, few, many) {
  if (count === 1) return `1 ${singular}`;
  if (count >= 2 && count <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}
