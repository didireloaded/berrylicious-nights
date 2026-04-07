import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMenuAvailability() {
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from("menu_item_disabled").select("menu_item_id");
    if (error) {
      console.warn("[useMenuAvailability]", error.message);
      return;
    }
    setDisabledIds(new Set((data ?? []).map((r) => r.menu_item_id as string)));
  }, []);

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel("menu_item_disabled")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_item_disabled" },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [refresh]);

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
