import { supabase } from "@/integrations/supabase/client";
import { STANDARD_SLOT_TIMES } from "@/lib/bookingSlots";
import { parseRpcBookedTimes } from "@/lib/bookingRpc";

export type HomeUpdateRow = {
  id: string;
  title: string;
  subtitle: string | null;
  type: string;
  event_date: string | null;
  event_time: string | null;
  available_slots: string[] | null;
  expires_at: string | null;
};

export function parseAvailableSlots(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const out = raw.map((x) => String(x).trim()).filter(Boolean);
    return out.length ? out : null;
  }
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return parseAvailableSlots(p);
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeUpdateRow(row: Record<string, unknown>): HomeUpdateRow {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    subtitle: row.subtitle != null ? String(row.subtitle) : null,
    type: String(row.type ?? "event"),
    event_date: row.event_date != null ? String(row.event_date).split("T")[0] : null,
    event_time: row.event_time != null ? String(row.event_time) : null,
    available_slots: parseAvailableSlots(row.available_slots),
    expires_at: row.expires_at != null ? String(row.expires_at) : null,
  };
}

/** Event night: explicit event_date, else expires_at date, else today. */
export function resolveEventDate(ev: HomeUpdateRow): string {
  const today = new Date().toISOString().split("T")[0];
  if (ev.event_date?.trim()) return ev.event_date.trim();
  if (ev.expires_at?.trim()) return ev.expires_at.split("T")[0];
  return today;
}

export function resolveHeadlineTime(ev: HomeUpdateRow): string {
  const t = ev.event_time?.trim();
  if (t) return t;
  return "19:30";
}

export function resolveBaseSlots(ev: HomeUpdateRow): string[] {
  if (ev.available_slots?.length) return ev.available_slots;
  return [...STANDARD_SLOT_TIMES];
}

export async function fetchBookedTimesForDate(date: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("booked_table_times", { p_date: date });
  if (error) {
    console.warn("[eventBooking] booked_table_times:", error.message);
    return [];
  }
  return parseRpcBookedTimes(data);
}

/** Slots still open (no existing booking at that time on this date). */
export async function computeOpenSlotsForDate(
  date: string,
  candidates: string[],
): Promise<string[]> {
  const booked = await fetchBookedTimesForDate(date);
  return candidates.filter((t) => !booked.includes(t));
}

export type BookingNavState = {
  eventId?: string;
  suggestedDate?: string;
  suggestedTime?: string;
  suggestedGuests?: number;
  /** When set, booking screen only offers these times (event flow). */
  eventTimeSlots?: string[];
  /** From home crowd signal — copy only, e.g. “Almost full”. */
  tablesAlmostFull?: boolean;
};
