import { supabase } from "@/integrations/supabase/client";
import { parseRpcBookedTimes, parseRpcBookingCount } from "@/lib/bookingRpc";

export type CrowdLevel = "quiet" | "moderate" | "busy";

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
};

const HINTS: Record<CrowdLevel, string> = {
  quiet: "Walk-in friendly right now.",
  moderate: "Steady energy — book to lock your time.",
  busy: "Almost full tonight — grab a table.",
};

export async function fetchCrowdSnapshot(isoDate: string): Promise<CrowdSnapshot> {
  let bookingCount = 0;
  let bookedSlots = 0;

  const [countRes, slotsRes] = await Promise.all([
    (supabase as any).rpc("active_bookings_count", { p_date: isoDate }),
    (supabase as any).rpc("booked_table_times", { p_date: isoDate }),
  ]);

  if (countRes.error) {
    console.warn("[homeCrowd] active_bookings_count:", countRes.error.message);
  } else {
    bookingCount = parseRpcBookingCount(countRes.data);
  }
  if (slotsRes.error) {
    console.warn("[homeCrowd] booked_table_times:", slotsRes.error.message);
  } else {
    bookedSlots = parseRpcBookedTimes(slotsRes.data).length;
  }

  const level = levelFromSignals(bookingCount, bookedSlots);

  return {
    level,
    label: LABELS[level],
    hint: HINTS[level],
    bookingCount,
    bookedSlotCount: bookedSlots,
  };
}
