import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { ReorderPreviewSheet } from "@/components/ReorderPreviewSheet";
import { PreviousOrderCard, type PreviousOrderSummary } from "@/components/PreviousOrderCard";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";

export function MyOrdersSection() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PreviousOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reorderTarget, setReorderTarget] = useState<PreviousOrderSummary | null>(null);

  const loadOrders = useCallback(async () => {
    setLoadError(false);
    if (user?.id) {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(25);
        if (error) {
          setLoadError(true);
          setOrders([]);
        } else {
          setOrders((data ?? []) as PreviousOrderSummary[]);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const parsed = JSON.parse(localStorage.getItem("berrylicious-orders") || "[]");
      setOrders(Array.isArray(parsed) ? (parsed.slice().reverse() as PreviousOrderSummary[]) : []);
    } catch {
      setOrders([]);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  return (
    <section aria-labelledby="my-orders-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="my-orders-heading" className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
          My Orders
        </h2>
      </div>

      {loading ? (
        <p className="py-4 text-[14px] text-[#A3A3A3]">Loading your orders…</p>
      ) : loadError ? (
        <FeatureAvailabilityState
          compact
          status="error"
          title="Couldn't load order history"
          description="Your previous Butcher Block orders could not be loaded right now."
          primaryAction={{ label: "Try again", onClick: () => void loadOrders() }}
        />
      ) : orders.length === 0 ? (
        <div className="rounded-[22px] border border-white/10 bg-[#242424] p-5">
          <p className="text-[15px] font-bold text-white">No past orders yet</p>
          <p className="mt-1 text-[14px] leading-relaxed text-[#A3A3A3]">
            Receipts and one-tap reorder options will appear here once you place an order at Butcher Block.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <PreviousOrderCard
              key={order.id}
              order={order}
              onReorder={(target) => setReorderTarget(target)}
            />
          ))}
        </div>
      )}

      {reorderTarget && (
        <ReorderPreviewSheet
          open={Boolean(reorderTarget)}
          onOpenChange={(open) => {
            if (!open) setReorderTarget(null);
          }}
          orderNumber={`BB-${String(reorderTarget.id).slice(0, 6).toUpperCase()}`}
          orderItems={reorderTarget.items}
        />
      )}
    </section>
  );
}
