import { supabase } from "@/integrations/supabase/client";
import { parseRpcBookedTimes, parseRpcBookingCount } from "@/lib/bookingRpc";

export type CrowdLevel = "quiet" | "moderate" | "busy" | "unknown";

export type CrowdSnapshot = {
  level: CrowdLevel;
  label: string;
  hint: string;
  bookingCount: number;
  bookedSlotCount: number;
};

const QUIET_MAX = 2;
const MODERATE_MAX = 6;

function levelFromSignals(bookingCount: number, bookedSlots: number): CrowdLevel {
  const score = Math.max(bookingCount, bookedSlots * 2);
  if (score <= QUIET_MAX) return "quiet";
  if (score <= MODERATE_MAX) return "moderate";
  return "busy";
}

const LABELS: Record<CrowdLevel, string> = {
  quiet: "Quiet",
  moderate: "Moderate",
  busy: "Busy",
  unknown: "Status unavailable",
};

const HINTS: Record<CrowdLevel, string> = {
  quiet: "Walk-in friendly right now.",
  moderate: "Steady energy — book to lock your time.",
  busy: "Almost full tonight — grab a table.",
  unknown: "We can’t confirm how busy it is. Please check table availability.",
};

export async function fetchCrowdSnapshot(isoDate: string): Promise<CrowdSnapshot> {
  let bookingCount = 0;
  let bookedSlots = 0;

  const [countRes, slotsRes] = await Promise.all([
    (supabase as any).rpc("active_bookings_count", { p_date: isoDate }),
    (supabase as any).rpc("booked_table_times", { p_date: isoDate }),
  ]);

  if (countRes.error || slotsRes.error) {
    console.warn("[homeCrowd] availability unavailable", countRes.error ?? slotsRes.error);
    return { level: "unknown", label: LABELS.unknown, hint: HINTS.unknown, bookingCount: 0, bookedSlotCount: 0 };
  }
  bookingCount = parseRpcBookingCount(countRes.data);
  bookedSlots = parseRpcBookedTimes(slotsRes.data).length;

  const level = levelFromSignals(bookingCount, bookedSlots);

  return {
    level,
    label: LABELS[level],
    hint: HINTS[level],
    bookingCount,
    bookedSlotCount: bookedSlots,
  };
}
