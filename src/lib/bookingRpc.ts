/**
 * Normalizes Supabase RPC payloads for booking/crowd helpers.
 * Handles text[] from SQL, or { time: string }[] if a TABLE-returning RPC was used.
 */
export function parseRpcBookedTimes(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  if (data.length === 0) return [];
  const first = data[0];
  if (typeof first === "string") return (data as string[]).filter(Boolean);
  if (typeof first === "object" && first !== null && "time" in first) {
    return (data as { time: string }[])
      .map((r) => (r && typeof r.time === "string" ? r.time.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

export function parseRpcBookingCount(data: unknown): number {
  if (typeof data === "number" && Number.isFinite(data)) return Math.max(0, Math.floor(data));
  if (typeof data === "string") {
    const n = parseInt(data, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  }
  return 0;
}
