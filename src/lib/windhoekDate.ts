const windhoekDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Windhoek",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Restaurant business dates use Windhoek time, not UTC or the visitor's time zone. */
export function getWindhoekDateISO(date: Date = new Date()): string {
  const parts = windhoekDateFormatter.formatToParts(date);
  let year = "";
  let month = "";
  let day = "";
  for (const p of parts) {
    if (p.type === "year") year = p.value;
    else if (p.type === "month") month = p.value;
    else if (p.type === "day") day = p.value;
  }
  return `${year}-${month}-${day}`;
}
