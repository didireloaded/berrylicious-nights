import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOrderSnapshotFromStorage } from "@/lib/orderTrackingStorage";
import { formatPrice } from "@/lib/vibe";
import { menuItems } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { useApp } from "@/context/AppContext";
import { ArrowLeft, Clock, CheckCircle2, ChefHat, PackageCheck, Plus, ReceiptText } from "lucide-react";
import { notifyOrderStatusTransition, requestOrderNotificationPermission } from "@/lib/orderStatusNotify";
import { ArrivalCodeCard } from "@/components/ArrivalCodeCard";

const statusSteps = [
  { key: "pending", label: "Order received", icon: Clock },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready", icon: PackageCheck },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const statusHeadline: Record<string, string> = {
  pending: "Order received",
  preparing: "Preparing your order",
  ready: "Ready for collection",
  completed: "Order completed",
};

const statusSubline: Record<string, string> = {
  pending: "The Butcher Block kitchen has received your ticket.",
  preparing: "The grill and kitchen team are preparing your dishes.",
  ready: "Your order is ready — collect at the counter or watch for your server.",
  completed: "Thank you for dining with Butcher Block Steakhouse.",
};

const WHILE_WAIT_MENU_IDS = ["14", "12", "19"];

const orderTypeLabels: Record<string, string> = {
  preorder: "Pre-order",
  pickup: "Pickup",
  dinein: "Dine-in",
};

function formatOrderNumber(id: string): string {
  return `BB-${id.slice(0, 6).toUpperCase()}`;
}

type TrackedOrderItem = {
  name?: string;
  qty?: number;
  price?: number;
  weight?: string;
  doneness?: string;
  side?: string;
  sauces?: string[];
};

type TrackedOrder = {
  id: string;
  items?: TrackedOrderItem[] | unknown;
  total?: number;
  status?: string;
  order_type?: string | null;
  table_number?: string | null;
  scheduled_time?: string | null;
  guest_name?: string | null;
  eta_minutes?: number | null;
  eta_set_at?: string | null;
  created_at?: string;
  arrival_code?: string | null;
};

const OrderTrackingPage = () => {
  const { id } = useParams();
  const { addItem } = useCart();
  const { setCurrentOrder, clearCurrentOrder, currentOrder } = useApp();
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [etaRemaining, setEtaRemaining] = useState<number | null>(null);

  const whileYouWaitItems = useMemo(
    () =>
      WHILE_WAIT_MENU_IDS.map((mid) => menuItems.find((m) => m.id === mid)).filter(
        (m): m is (typeof menuItems)[number] => m != null,
      ),
    [],
  );

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      const snap = loadOrderSnapshotFromStorage(id);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session && snap) {
        setOrder(snap);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      const row = data
        ? {
            ...data,
            arrival_code: (data as { arrival_code?: string }).arrival_code ?? snap?.arrival_code,
            table_number: snap?.table_number ?? null,
            scheduled_time: snap?.scheduled_time ?? null,
            guest_name: snap?.guest_name ?? null,
          }
        : snap;
      setOrder(row);
      setLoading(false);
    };
    void fetchOrder();

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          const neu = payload.new as TrackedOrder;
          const oldRow = payload.old as { status?: string } | undefined;
          if (neu?.id && neu.status) {
            notifyOrderStatusTransition(neu.id, oldRow?.status, neu.status);
          }
          const snap = loadOrderSnapshotFromStorage(id);
          setOrder({
            ...neu,
            table_number: snap?.table_number ?? null,
            scheduled_time: snap?.scheduled_time ?? null,
            guest_name: snap?.guest_name ?? null,
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (!order?.id) return;
    setCurrentOrder({
      id: String(order.id),
      items: order.items,
      total: Number(order.total) || 0,
      status: String(order.status ?? "pending"),
      order_type: order.order_type ?? undefined,
      table_number: order.table_number ?? null,
      scheduled_time: order.scheduled_time ?? null,
      guest_name: order.guest_name ?? null,
      eta_minutes: order.eta_minutes ?? null,
      eta_set_at: order.eta_set_at ?? null,
      created_at: order.created_at,
      arrival_code: order.arrival_code ?? null,
    });
  }, [order, setCurrentOrder]);

  useEffect(() => {
    if (order?.status === "completed" && currentOrder?.id === id) {
      clearCurrentOrder();
    }
  }, [order?.status, currentOrder?.id, id, clearCurrentOrder]);

  useEffect(() => {
    if (!id || typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem("berrylicious-order-notify-asked")) return;
    sessionStorage.setItem("berrylicious-order-notify-asked", "1");
    void requestOrderNotificationPermission();
  }, [id]);

  useEffect(() => {
    if (!order?.eta_minutes || !order?.eta_set_at) {
      setEtaRemaining(null);
      return;
    }
    const calc = () => {
      const elapsed = Math.floor((Date.now() - new Date(order.eta_set_at!).getTime()) / 60000);
      setEtaRemaining(Math.max(0, order.eta_minutes! - elapsed));
    };
    calc();
    const iv = setInterval(calc, 30_000);
    return () => clearInterval(iv);
  }, [order?.eta_minutes, order?.eta_set_at]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#121212] px-6 text-center text-[14px] text-[#A3A3A3]">
        Loading your order receipt…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#121212] px-6 text-center text-white">
        <p className="text-[18px] font-bold">Order not found</p>
        <Link
          to="/home"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-[#FF5A1F] px-6 text-[14px] font-bold text-white"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const currentIndex = Math.max(0, statusSteps.findIndex((s) => s.key === order.status));
  const progressPercent = Math.round(((currentIndex + 1) / statusSteps.length) * 100);
  const typeLabel = orderTypeLabels[order.order_type ?? ""] ?? "Order";
  const headline = statusHeadline[order.status ?? "pending"] ?? statusHeadline.pending;
  const subline = statusSubline[order.status ?? "pending"] ?? statusSubline.pending;
  const isActive = order.status !== "completed";
  const orderNumber = formatOrderNumber(String(order.id));
  const placedTime = order.created_at
    ? new Date(order.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "";

  const fulfillmentSummary =
    order.order_type === "dinein" && order.table_number
      ? `Dine-in · ${order.table_number}`
      : order.scheduled_time
        ? `${typeLabel} · ${order.scheduled_time}`
        : typeLabel;

  return (
    <div className="min-h-dvh bg-[#121212] pb-32 text-white lg:pb-16">
      <div className="mx-auto max-w-[560px] px-5 pt-[max(20px,env(safe-area-inset-top,0px))] sm:px-6 lg:max-w-2xl lg:pt-8">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <Link
            to="/home"
            aria-label="Back to Home"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <span className="rounded-full border border-white/10 bg-[#242424] px-4 py-2 font-mono text-[13px] font-bold text-[#FF5A1F]">
            #{orderNumber}
          </span>
        </header>

        {/* Compact Status & Progress Card (real statuses only — zero fake drivers/delivery) */}
        <section className="mt-6 rounded-[24px] border border-white/10 bg-[#242424] p-5" aria-label="Order status">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#FF5A1F]">
                Order #{orderNumber}
              </p>
              <h1 className="mt-1 font-display text-[24px] font-extrabold tracking-[-0.03em] text-white">
                {headline}
              </h1>
              <p className="mt-1 text-[14px] text-[#A3A3A3]">{subline}</p>
              <p className="mt-2 text-[13px] font-medium text-white/80">
                {fulfillmentSummary}
                {order.guest_name ? ` · ${order.guest_name}` : ""}
              </p>
            </div>
            {isActive && (
              <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FF5A1F]/15 px-3 py-1 text-[12px] font-bold text-[#FF5A1F]">
                <span className="h-2 w-2 rounded-full bg-[#FF5A1F] animate-pulse-dot" aria-hidden="true" />
                Live
              </span>
            )}
          </div>

          {/* Genuine kitchen ETA only when explicitly provided by staff */}
          {isActive && etaRemaining !== null && order.status !== "ready" && (
            <p className="mt-3 rounded-xl bg-[#303030] px-3.5 py-2 text-[14px] font-semibold text-white">
              Estimated prep time remaining: <span className="text-[#FF5A1F]">~{etaRemaining} min</span>
            </p>
          )}

          {/* Horizontal progress track */}
          <div className="mt-5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#303030]">
              <div
                className="h-full rounded-full bg-[#FF5A1F] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-4 gap-1">
              {statusSteps.map((step, i) => {
                const done = i <= currentIndex;
                const active = i === currentIndex;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-1.5 text-center">
                    <span
                      className={
                        "flex h-9 w-9 items-center justify-center rounded-full transition-colors " +
                        (active
                          ? "bg-[#FF5A1F] text-white"
                          : done
                            ? "bg-[#FF5A1F]/25 text-[#FF5A1F]"
                            : "bg-[#303030] text-[#737373]")
                      }
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className={"text-[11px] font-semibold leading-tight " + (done ? "text-white" : "text-[#737373]")}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Arrival/Collection QR Code */}
        {order.arrival_code && isActive && (
          <div className="mt-4">
            <ArrivalCodeCard
              code={order.arrival_code}
              orderCreatedAt={order.created_at}
              className="rounded-[24px] border-white/10 bg-[#242424]"
            />
          </div>
        )}

        {/* Always-open Itemized Order Receipt */}
        <section
          className="mt-4 rounded-[24px] border border-white/10 bg-[#242424] p-5"
          aria-labelledby="receipt-heading"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />
              <h2 id="receipt-heading" className="text-[16px] font-bold text-white">
                Order receipt
              </h2>
            </div>
            <span className="font-mono text-[13px] font-bold text-[#FF5A1F]">#{orderNumber}</span>
          </div>

          {placedTime && (
            <p className="mt-3 text-[13px] text-[#A3A3A3]">
              Placed {placedTime} · {fulfillmentSummary}
            </p>
          )}

          <div className="mt-4 space-y-3">
            {Array.isArray(order.items) &&
              (order.items as TrackedOrderItem[]).map((item, i) => {
                const qty = Number(item.qty ?? 1);
                const lineTotal = Number(item.price ?? 0) * qty;
                const mods = [
                  item.weight,
                  item.doneness,
                  item.side ? `Side: ${item.side}` : null,
                  Array.isArray(item.sauces) && item.sauces.length > 0 ? `Sauce: ${item.sauces.join(", ")}` : null,
                ].filter(Boolean);
                return (
                  <div key={i} className="flex items-start justify-between gap-3 text-[14px]">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">
                        {qty}× {item.name}
                      </p>
                      {mods.length > 0 && (
                        <p className="mt-0.5 text-[13px] text-[#A3A3A3]">{mods.join(" · ")}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-white">
                      {formatPrice(lineTotal)}
                    </span>
                  </div>
                );
              })}
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
            <span className="text-[15px] font-bold text-white">Total</span>
            <span className="text-[20px] font-extrabold tabular-nums text-[#FF5A1F]">
              {formatPrice(Number(order.total))}
            </span>
          </div>

          <p className="mt-2.5 text-[13px] text-[#A3A3A3]">
            Show order #{orderNumber}
            {order.arrival_code ? ` or code ${order.arrival_code}` : ""} to staff on collection or at your table.
          </p>
        </section>

        {/* Quick add while waiting */}
        {isActive && whileYouWaitItems.length > 0 && (
          <section className="mt-6 rounded-[24px] border border-white/10 bg-[#242424] p-5" aria-label="Add drinks or desserts">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[16px] font-bold text-white">Add while you wait</h2>
              <Link to="/drinks" className="text-[13px] font-semibold text-[#FF5A1F] hover:text-white">
                All drinks
              </Link>
            </div>
            <div className="mt-3.5 space-y-2.5">
              {whileYouWaitItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1B1B1B] px-3 py-2.5"
                >
                  <img
                    src={item.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    decoding="async"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-white">{item.name}</p>
                    <p className="text-[13px] font-bold tabular-nums text-[#FF5A1F]">{formatPrice(item.price)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addItem(item)}
                    aria-label={`Add ${item.name}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF5A1F] text-white transition-colors hover:bg-[#E84D15]"
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default OrderTrackingPage;
