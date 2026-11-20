/** Restaurant business dates use Windhoek time, not UTC or the visitor's time zone. */
export function getWindhoekDateISO(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Windhoek",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return [part("year"), part("month"), part("day")].join("-");
}
