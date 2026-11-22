import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChefHat, Clock3, PackageCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { TrackableOrderSnapshot } from "@/lib/orderTrackingStorage";

const headlines: Record<string, string> = {
  pending: "Order received",
  preparing: "Preparing your order",
  ready: "Ready for collection",
};

const progressByStatus: Record<string, number> = {
  pending: 28,
  preparing: 64,
  ready: 94,
};

const orderTypes: Record<string, string> = {
  pickup: "Pickup",
  preorder: "Pre-order",
  dinein: "Dine-in",
};

function computeEtaRemaining(etaMinutes: number | null | undefined, etaSetAt: string | null | undefined): number | null {
  if (typeof etaMinutes !== "number" || !etaSetAt) return null;
  const elapsed = Math.floor((Date.now() - new Date(etaSetAt).getTime()) / 60000);
  return Math.max(0, etaMinutes - elapsed);
}

/**
 * Compact status banner backed strictly by real Supabase order status or
 * last-known guest snapshot. Never fabricates drivers, ratings, or ETAs.
 */
export function ActiveOrderBanner() {
  const { currentOrder } = useApp();
  const { user } = useAuth();
  const [latest, setLatest] = useState<TrackableOrderSnapshot | null>(null);
  const [isLive, setIsLive] = useState(false);
  const currentOrderRef = useRef(currentOrder);
  currentOrderRef.current = currentOrder;
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

    if (user?.id) {
      void supabase
        .from("orders")
        .select("id,status,order_type,eta_minutes,eta_set_at")
        .eq("id", id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!alive) return;
          if (!error && data) {
            const snap = currentOrderRef.current;
            setLatest({
              id,
              status: String(data.status),
              order_type: data.order_type ?? undefined,
              total: snap?.total ?? 0,
              items: snap?.items ?? [],
              table_number: snap?.table_number ?? null,
              scheduled_time: snap?.scheduled_time ?? null,
              eta_minutes: data.eta_minutes,
              eta_set_at: data.eta_set_at,
            });
            setIsLive(true);
          }
        });
    }

    const channel = supabase
      .channel(`active-order-banner-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          if (!alive) return;
          const row = payload.new as {
            status?: string;
            order_type?: string;
            eta_minutes?: number;
            eta_set_at?: string;
          };
          if (!row.status) return;
          const snap = currentOrderRef.current;
          setLatest((prev) => ({
            id,
            status: row.status!,
            total: prev?.total ?? snap?.total ?? 0,
            items: prev?.items ?? snap?.items ?? [],
            table_number: prev?.table_number ?? snap?.table_number ?? null,
            scheduled_time: prev?.scheduled_time ?? snap?.scheduled_time ?? null,
            order_type: row.order_type ?? prev?.order_type ?? snap?.order_type,
            eta_minutes: row.eta_minutes ?? prev?.eta_minutes,
            eta_set_at: row.eta_set_at ?? prev?.eta_set_at,
          }));
          setIsLive(true);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [id, user?.id]);

  if (!currentOrder || !id) return null;
  const order = latest ?? currentOrder;
  if (!["pending", "preparing", "ready"].includes(order.status)) return null;

  const Icon = order.status === "ready" ? PackageCheck : order.status === "preparing" ? ChefHat : Clock3;
  const progress = progressByStatus[order.status] ?? 28;
  const etaRemaining = order.status === "ready" ? null : computeEtaRemaining(order.eta_minutes, order.eta_set_at);
  const serviceLabel =
    order.order_type === "dinein" && order.table_number
      ? `Dine-in · ${order.table_number}`
      : orderTypes[order.order_type ?? ""] ?? "Order";
  const orderCode = `BB-${id.slice(0, 6).toUpperCase()}`;

  return (
    <Link
      to={`/order/${id}`}
      aria-label={`Track order #${orderCode}. ${headlines[order.status]}`}
      className="mt-4 block overflow-hidden rounded-[22px] border border-white/10 bg-[#242424] p-4 text-white transition-colors hover:bg-[#2C2C2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
    >
      {/* Compact iOS horizontal status progress bar */}
      <div className="mb-3.5 h-1.5 w-full overflow-hidden rounded-full bg-[#303030]">
        <div
          className="h-full rounded-full bg-[#FF5A1F] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[15px] font-bold leading-snug text-white">
              {headlines[order.status]}
            </span>
            {etaRemaining !== null && (
              <span className="rounded-full bg-[#303030] px-2 py-0.5 text-[11px] font-semibold text-[#FF5A1F]">
                ~{etaRemaining} min est.
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[13px] text-[#A3A3A3]">
            {serviceLabel} · #{orderCode} · {isLive ? "Live" : "Last known"}
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#303030] text-white">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
