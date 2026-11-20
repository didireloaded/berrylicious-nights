import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChefHat, Clock3, PackageCheck, ShoppingBag } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import type { TrackableOrderSnapshot } from "@/lib/orderTrackingStorage";

const headlines: Record<string, string> = {
  pending: "Order received",
  preparing: "Your order is being prepared",
  ready: "Ready for collection",
};

const orderTypes: Record<string, string> = {
  pickup: "Pickup",
  preorder: "Pre-order",
  dinein: "Dine-in",
};

/** A real order update, not a fabricated driver notification or an unverified countdown. */
export function ActiveOrderBanner() {
  const { currentOrder } = useApp();
  const [latest, setLatest] = useState<TrackableOrderSnapshot | null>(null);
  const [isLive, setIsLive] = useState(false);
  const id = currentOrder?.id;

  useEffect(() => {
    if (!id) {
      setLatest(null);
      setIsLive(false);
      return;
    }
    let alive = true;
    setLatest(null);
    setIsLive(false);
    const fetch = async () => {
      const { data, error } = await supabase.from("orders").select("id,status,order_type,eta_minutes,eta_set_at").eq("id", id).maybeSingle();
      if (!alive) return;
      if (!error && data) {
        setLatest({ id, status: String(data.status), order_type: data.order_type ?? undefined, total: currentOrder?.total ?? 0, items: currentOrder?.items ?? [], eta_minutes: data.eta_minutes, eta_set_at: data.eta_set_at });
        setIsLive(true);
      }
    };
    void fetch();
    const channel = supabase.channel(`active-order-banner-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, (payload) => {
        if (!alive) return;
        const row = payload.new as { status?: string; order_type?: string; eta_minutes?: number; eta_set_at?: string };
        if (!row.status) return;
        setLatest(prev => ({
          id, status: row.status!,
          total: prev?.total ?? currentOrder?.total ?? 0,
          items: prev?.items ?? currentOrder?.items ?? [],
          order_type: row.order_type ?? prev?.order_type ?? currentOrder?.order_type,
          eta_minutes: row.eta_minutes ?? prev?.eta_minutes,
          eta_set_at: row.eta_set_at ?? prev?.eta_set_at,
        }));
        setIsLive(true);
      })
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [id]);

  if (!currentOrder || !id) return null;
  const order = latest ?? currentOrder;
  if (!["pending", "preparing", "ready"].includes(order.status)) return null;
  const Icon = order.status === "ready" ? PackageCheck : order.status === "preparing" ? ChefHat : Clock3;

  return (
    <Link to={`/order/${id}`} aria-label={`Track order. ${headlines[order.status]}`}
      className="relative z-30 mt-5 flex min-h-[92px] items-center gap-3 rounded-[24px] border border-white/15 bg-[#202020]/95 p-4 text-white shadow-[0_12px_35px_rgba(0,0,0,0.18)] transition-colors hover:bg-[#292929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#ff5a1f]/15 text-[#ff7d50]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#ff8057]">{isLive ? "Order update" : "Last known status"}</span>
        <span className="mt-1 block text-[15px] font-semibold leading-tight">{headlines[order.status]}</span>
        <span className="mt-1 block text-[12px] text-white/55">{orderTypes[order.order_type ?? ""] ?? "Order"} · #{id.slice(0, 8)}</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-white" aria-hidden="true" />
    </Link>
  );
}
