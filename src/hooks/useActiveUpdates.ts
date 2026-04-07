import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeUpdateRow, type HomeUpdateRow } from "@/lib/eventBooking";

/** Active `updates` rows (events & specials) visible to guests. */
export function useActiveUpdates(): HomeUpdateRow[] {
  const [updates, setUpdates] = useState<HomeUpdateRow[]>([]);

  useEffect(() => {
    const fetchUpdates = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("updates")
        .select("id, title, subtitle, type, event_date, event_time, available_slots, expires_at")
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .order("created_at", { ascending: false });
      setUpdates((data ?? []).map((row) => normalizeUpdateRow(row as Record<string, unknown>)));
    };
    void fetchUpdates();
  }, []);

  return updates;
}
