import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type DisabledRow = { menu_item_id: string };

type UntypedTableQuery = {
  from: (table: string) => {
    select: (columns: string) => Promise<{
      data: DisabledRow[] | null;
      error: { message: string } | null;
    }>;
  };
};

let cachedDisabledIds: Set<string> = new Set();
let hasLoadedCache = false;
let inflightRefresh: Promise<Set<string>> | null = null;
const listeners = new Set<(next: Set<string>) => void>();
let sharedChannel: ReturnType<typeof supabase.channel> | null = null;

function ensureRealtimeSubscription() {
  if (sharedChannel) return;
  sharedChannel = supabase
    .channel("menu_item_disabled_shared")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "menu_item_disabled" },
      () => {
        void fetchDisabledMenuIds();
      },
    )
    .subscribe();
}

function releaseRealtimeSubscriptionIfIdle() {
  if (listeners.size === 0 && sharedChannel) {
    const ch = sharedChannel;
    sharedChannel = null;
    void supabase.removeChannel(ch);
  }
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

async function fetchDisabledMenuIds(): Promise<Set<string>> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    try {
      const client = supabase as unknown as UntypedTableQuery;
      const { data, error } = await client.from("menu_item_disabled").select("menu_item_id");
      if (error) {
        console.warn("[useMenuAvailability]", error.message);
        return cachedDisabledIds;
      }
      const next = new Set((data ?? []).map((r) => String(r.menu_item_id)));
      hasLoadedCache = true;
      if (!setsEqual(cachedDisabledIds, next)) {
        cachedDisabledIds = next;
        for (const listener of listeners) {
          listener(cachedDisabledIds);
        }
      }
      return cachedDisabledIds;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

export function useMenuAvailability() {
  const [disabledIds, setDisabledIds] = useState<Set<string>>(() => cachedDisabledIds);

  const refresh = useCallback(async (): Promise<Set<string>> => {
    const next = await fetchDisabledMenuIds();
    setDisabledIds((prev) => (setsEqual(prev, next) ? prev : next));
    return next;
  }, []);

  useEffect(() => {
    const listener = (next: Set<string>) => {
      setDisabledIds((prev) => (setsEqual(prev, next) ? prev : next));
    };
    listeners.add(listener);

    if (!hasLoadedCache) {
      void refresh();
    } else if (!setsEqual(disabledIds, cachedDisabledIds)) {
      setDisabledIds(cachedDisabledIds);
    }

    ensureRealtimeSubscription();

    return () => {
      listeners.delete(listener);
      releaseRealtimeSubscriptionIfIdle();
    };
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const isUnavailable = useCallback((menuItemId: string) => disabledIds.has(menuItemId), [disabledIds]);

  return useMemo(
    () => ({
      disabledIds,
      isUnavailable,
      refresh,
    }),
    [disabledIds, isUnavailable, refresh],
  );
}
