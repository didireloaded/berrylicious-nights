import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyOrderStatusTransition } from "@/lib/orderStatusNotify";

/**
 * When signed in, listen for updates to this user's orders and notify on status transitions.
 * Works with Supabase Realtime when orders has REPLICA IDENTITY FULL (see migration).
 */
export function useCustomerOrderStatusNotifications(userId: string | null | undefined) {
  const seen = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`customer-orders-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string; status?: string };
          const oldRow = payload.old as { status?: string } | undefined;
          const id = row?.id;
          const next = row?.status;
          if (!id || !next) return;

          const prevFromPayload = oldRow?.status;
          const prevCached = seen.current.get(id);
          const prev = prevFromPayload ?? prevCached;

          seen.current.set(id, next);

          notifyOrderStatusTransition(id, prev, next);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
