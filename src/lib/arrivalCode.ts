/** Short readable codes for table / pickup check-in. */
export function generateArrivalCode(): string {
  const n = 1000 + Math.floor(Math.random() * 9000);
  return `BRY-${n}`;
}

/** Normalize user/staff input to `BRY-####` form. */
export function normalizeArrivalCodeInput(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return "";
  const compact = s.replace(/[^A-Z0-9]/g, "");
  const m = compact.match(/^BRY(\d{4})$/);
  if (m) return `BRY-${m[1]}`;
  const digitsOnly = s.replace(/\D/g, "");
  if (digitsOnly.length === 4) return `BRY-${digitsOnly}`;
  if (s.startsWith("BRY-") && /^BRY-\d{4}$/.test(s.slice(0, 8))) return s.slice(0, 8);
  return s;
}

/** End of validity: scheduled slot start + 2 hours (local date + time). */
export function bookingArrivalValidUntilMs(dateStr: string, timeStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm = 0] = timeStr.split(":").map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return start.getTime() + 2 * 60 * 60 * 1000;
}

export function isBookingArrivalCodeInWindow(dateStr: string, timeStr: string, now = Date.now()): boolean {
  return now <= bookingArrivalValidUntilMs(dateStr, timeStr);
}

/** Orders without a table time: valid for N hours from placement. */
export function orderArrivalValidUntilMs(createdAtIso: string, hoursAfter = 6): number {
  const t = new Date(createdAtIso).getTime();
  if (!Number.isFinite(t)) return Date.now();
  return t + hoursAfter * 60 * 60 * 1000;
}

export function isOrderArrivalCodeInWindow(createdAtIso: string, now = Date.now(), hoursAfter = 6): boolean {
  return now <= orderArrivalValidUntilMs(createdAtIso, hoursAfter);
}
