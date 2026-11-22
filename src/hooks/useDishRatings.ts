import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DishRatingSummary } from "@/lib/reviews";

let cachedRatings: Map<string, DishRatingSummary> = new Map();
let hasFetched = false;
let inflight: Promise<Map<string, DishRatingSummary>> | null = null;

type DynamicViewClient = {
  from: (view: string) => {
    select: (cols: string) => Promise<{
      data: DishRatingSummary[] | null;
      error: { code?: string; message?: string } | null;
    }>;
  };
};

async function fetchRatingSummaries(): Promise<Map<string, DishRatingSummary>> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const db = supabase as unknown as DynamicViewClient;
      const { data, error } = await db
        .from("menu_item_rating_summary")
        .select("menu_item_id, avg_rating, review_count");
      if (error || !Array.isArray(data)) {
        hasFetched = true;
        return cachedRatings;
      }
      const next = new Map<string, DishRatingSummary>();
      for (const row of data) {
        if (row.menu_item_id && Number(row.review_count) > 0) {
          next.set(row.menu_item_id, {
            menu_item_id: row.menu_item_id,
            avg_rating: Number(row.avg_rating),
            review_count: Number(row.review_count),
          });
        }
      }
      cachedRatings = next;
      hasFetched = true;
      return cachedRatings;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function invalidateDishRatingsCache() {
  hasFetched = false;
}

/** Returns genuine verified ratings keyed by menu_item_id; never invents placeholder ratings. */
export function useDishRatings() {
  const [ratings, setRatings] = useState<Map<string, DishRatingSummary>>(() => cachedRatings);

  useEffect(() => {
    let alive = true;
    if (!hasFetched) {
      void fetchRatingSummaries().then((map) => {
        if (alive) setRatings(new Map(map));
      });
    } else if (cachedRatings.size !== ratings.size) {
      setRatings(new Map(cachedRatings));
    }
    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return ratings;
}
