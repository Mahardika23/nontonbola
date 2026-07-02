const MONTHS = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "2026-07-19" -> "Jul 19"
export function formatShortDate(date: string | null): string {
  if (!date) return "";
  const [, m, d] = date.split("-").map(Number);
  return `${MONTHS[m] ?? ""} ${d}`.trim();
}
