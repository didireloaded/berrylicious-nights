import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeUpdateRow, type HomeUpdateRow } from "@/lib/eventBooking";
import { getWindhoekDateISO } from "@/lib/windhoekDate";

export const DEFAULT_BUTCHER_BLOCK_EVENTS: HomeUpdateRow[] = [
  {
    id: "event-ladies-night",
    title: "Ladies Night",
    subtitle:
      "Every Tuesday from 18:00 — Half price on a large selection of steaks & BOGO bubbles. Book a table for a lively evening.",
    type: "Weekly • Tuesdays",
    event_date: null,
    event_time: "18:00",
    available_slots: ["18:00", "19:30", "20:00", "21:00"],
    expires_at: null,
  },
  {
    id: "event-mens-night",
    title: "Men's Night",
    subtitle:
      "Every Wednesday from 18:00 — The equivalent of Ladies Night, but for the gents. Great steaks, great company.",
    type: "Weekly • Wednesdays",
    event_date: null,
    event_time: "18:00",
    available_slots: ["18:00", "19:30", "20:00", "21:00"],
    expires_at: null,
  },
  {
    id: "event-fathers-day",
    title: "Father's Day Feast",
    subtitle:
      "Third Sunday of June • All Day — Treat Dad to the ultimate steak experience. Special menu & a complimentary drink.",
    type: "Special",
    event_date: null,
    event_time: "12:30",
    available_slots: ["12:30", "18:00", "19:30", "20:00"],
    expires_at: null,
  },
];

const CACHE_TTL_MS = 60_000;
let cachedUpdates: HomeUpdateRow[] | null = null;
let cachedAt = 0;
let inflightPromise: Promise<HomeUpdateRow[]> | null = null;

function mergeEventsWithDefaults(dbRows: HomeUpdateRow[]): HomeUpdateRow[] {
  const seenTitles = new Set(DEFAULT_BUTCHER_BLOCK_EVENTS.map((e) => e.title.toLowerCase()));
  const extras = dbRows.filter((r) => !seenTitles.has(r.title.toLowerCase()));
  return [...DEFAULT_BUTCHER_BLOCK_EVENTS, ...extras];
}

async function loadActiveUpdates(): Promise<HomeUpdateRow[]> {
  if (inflightPromise) return inflightPromise;
  inflightPromise = (async () => {
    try {
      const today = getWindhoekDateISO();
      const { data } = await supabase
        .from("updates")
        .select("id, title, subtitle, type, event_date, event_time, available_slots, expires_at")
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .order("created_at", { ascending: false });
      const rows = (data ?? []).map((row) => normalizeUpdateRow(row as Record<string, unknown>));
      const resolved = mergeEventsWithDefaults(rows);
      cachedUpdates = resolved;
      cachedAt = Date.now();
      return resolved;
    } catch {
      cachedUpdates = DEFAULT_BUTCHER_BLOCK_EVENTS;
      cachedAt = Date.now();
      return DEFAULT_BUTCHER_BLOCK_EVENTS;
    } finally {
      inflightPromise = null;
    }
  })();
  return inflightPromise;
}

/** Active `updates` rows (events & specials) visible to guests. */
export function useActiveUpdates(): HomeUpdateRow[] {
  const [updates, setUpdates] = useState<HomeUpdateRow[]>(
    () => cachedUpdates ?? DEFAULT_BUTCHER_BLOCK_EVENTS,
  );

  useEffect(() => {
    let mounted = true;
    const isFresh = cachedUpdates !== null && Date.now() - cachedAt < CACHE_TTL_MS;

    if (!isFresh) {
      void loadActiveUpdates().then((rows) => {
        if (mounted) setUpdates(rows);
      });
    }

    return () => {
      mounted = false;
    };
  }, []);

  return updates;
}
