import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOrderSnapshotFromStorage } from "@/lib/orderTrackingStorage";
import { formatPrice } from "@/lib/vibe";
import { menuItems } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { useApp } from "@/context/AppContext";
import heroImage from "@/assets/hero-restaurant.jpg";
import { ArrowLeft, Clock, CheckCircle2, ChefHat, Package, Plus, ReceiptText } from "lucide-react";
import { notifyOrderStatusTransition, requestOrderNotificationPermission } from "@/lib/orderStatusNotify";
import { ArrivalCodeCard } from "@/components/ArrivalCodeCard";

const statusSteps = [
  { key: "pending", label: "We're on it", icon: Clock },
  { key: "preparing", label: "Chef started", icon: ChefHat },
  { key: "ready", label: "Almost ready", icon: Package },
  { key: "completed", label: "All yours", icon: CheckCircle2 },
];

const statusHeadline: Record<string, string> = {
  pending: "We've got your order",
  preparing: "Your order is on the grill",
  ready: "It's ready when you are",
  completed: "Enjoy every bite",
};

const statusSubline: Record<string, string> = {
  pending: "Hang tight — the kitchen has received your ticket.",
  preparing: "The kitchen is preparing your order. We will update you when it is ready.",
  ready: "Ready — head to the counter or watch for your server.",
  completed: "Thanks for dining with Butcher Block Steakhouse.",
};

const WHILE_WAIT_MENU_IDS = ["14", "12", "19"];

const orderTypeLabels: Record<string, string> = {
  preorder: "Pre-order",
  pickup: "Pickup",
  dinein: "Dine-in",
};

function getDetailedStatus(status: string, etaRemaining: number | null): string {
  if (status === "pending") return "Order received";
  if (status === "preparing") {
    if (etaRemaining !== null && etaRemaining >= 0 && etaRemaining <= 5) return "Almost ready";
    return "Chef started your order";
  }
  if (status === "ready") return "Ready";
  if (status === "completed") return "Completed";
  return "Order received";
}

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
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (!order?.id) return;
    setCurrentOrder({
      id: String(order.id),
      items: order.items,
      total: Number(order.total) || 0,
      status: String(order.status ?? "pending"),
      order_type: order.order_type,
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
      const elapsed = Math.floor((Date.now() - new Date(order.eta_set_at).getTime()) / 60000);
      setEtaRemaining(Math.max(0, order.eta_minutes - elapsed));
    };
    calc();
    const iv = setInterval(calc, 30_000);
    return () => clearInterval(iv);
  }, [order?.eta_minutes, order?.eta_set_at]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm px-6 text-center">
        One moment — pulling up your receipt…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-lg mb-4">Order not found</p>
        <Link to="/home" className="text-primary font-semibold hover:opacity-80">Back to Home</Link>
      </div>
    );
  }

  const currentIndex = Math.max(0, statusSteps.findIndex((s) => s.key === order.status));
  const progressPercent = Math.round((currentIndex / (statusSteps.length - 1)) * 100);
  const typeLabel = orderTypeLabels[order.order_type] ?? "Order";
  const headline = statusHeadline[order.status] ?? statusHeadline.pending;
  const subline = statusSubline[order.status] ?? statusSubline.pending;
  const detailedStatus = getDetailedStatus(order.status, etaRemaining);
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
    <div className="min-h-dvh relative flex flex-col justify-end">
      {/* Background image + overlay */}
      <div className="fixed inset-0 -z-10">
        <img
          src={heroImage}
          alt=""
          className="w-full h-full object-cover"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/45 via-background/75 to-background" />
      </div>

      {/* Back button */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top,0px))] pb-3 max-w-lg w-full mx-auto">
        <Link
          to="/home"
          aria-label="Back to Home"
          className="w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center btn-press"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <span className="rounded-full glass border border-white/15 px-3.5 py-1.5 text-xs font-bold tracking-wider text-foreground">
          #{orderNumber}
        </span>
      </div>

      {/* Glass panel */}
      <div className="relative z-10 mt-6 w-full animate-panel-up pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="glass border-t border-white/10 rounded-t-3xl px-6 pt-6 pb-8 max-w-lg mx-auto">

          {/* Order meta row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                Order Number
              </p>
              <p className="text-foreground font-display text-2xl font-bold tracking-tight mt-0.5">
                #{orderNumber}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                {fulfillmentSummary}
                {order.guest_name ? ` · ${order.guest_name}` : ""}
              </p>
            </div>
            {isActive && (
              <div className="mt-1 flex items-center gap-2 rounded-full border border-primary/35 bg-primary/15 px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
                <span className="text-[11px] font-semibold text-primary">{detailedStatus}</span>
              </div>
            )}
          </div>

          {/* Status — human headline + micro story */}
          <p className="text-foreground text-lg font-semibold leading-snug animate-fade-in">
            {headline}
          </p>
          <p className="text-muted-foreground text-sm mt-1 leading-relaxed animate-fade-in">
            {subline}
          </p>
          {isActive && etaRemaining !== null && order.status !== "ready" && (
            <p className="text-primary text-xl font-bold mt-2.5 animate-fade-in animate-eta-pulse">
              About {etaRemaining} min to go
            </p>
          )}

          {order.arrival_code && order.status !== "completed" && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-background/40 p-3">
              <ArrivalCodeCard
                code={order.arrival_code}
                orderCreatedAt={order.created_at}
                className="border-0 bg-transparent p-0 shadow-none"
              />
            </div>
          )}

          {/* Stepper */}
          <div className="mt-6 mb-5">
            <div className="relative h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-3">
              {statusSteps.map((step, i) => {
                const done = i <= currentIndex;
                const active = i === currentIndex;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-1" style={{ width: `${100 / statusSteps.length}%` }}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                        active
                          ? "bg-primary text-primary-foreground scale-110 ring-4 ring-primary/20"
                          : done
                            ? "bg-primary/80 text-primary-foreground"
                            : "bg-card border border-border text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[9px] font-medium text-center leading-tight ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Always-open Itemized Receipt */}
          <section className="mt-5 rounded-2xl border border-white/12 bg-background/55 p-4" aria-labelledby="receipt-heading">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 id="receipt-heading" className="text-sm font-bold text-foreground">Order receipt</h2>
              </div>
              <span className="font-mono text-xs font-semibold text-primary">#{orderNumber}</span>
            </div>

            {placedTime && (
              <p className="mt-2.5 text-[11px] text-muted-foreground">
                Placed {placedTime} · {fulfillmentSummary}
              </p>
            )}

            <div className="mt-3 space-y-2.5">
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
                    <div key={i} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {qty}× {item.name}
                        </p>
                        {mods.length > 0 && (
                          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                            {mods.join(" · ")}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-foreground">
                        {formatPrice(lineTotal)}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="mt-3.5 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="text-lg font-extrabold tabular-nums text-primary">{formatPrice(Number(order.total))}</span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Show order #{orderNumber}{order.arrival_code ? ` or code ${order.arrival_code}` : ""} to staff on collection or at your table.
            </p>
          </section>

          {isActive && (
            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-sm font-semibold text-foreground">Add something while you wait</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/drinks"
                  className="flex-1 min-w-[100px] rounded-xl border border-primary/45 bg-primary/12 py-2.5 text-center text-xs font-bold text-primary btn-press"
                >
                  Drinks
                </Link>
                <Link
                  to="/menu?category=Desserts"
                  className="flex-1 min-w-[100px] rounded-xl border border-white/15 bg-background/30 py-2.5 text-center text-xs font-bold text-foreground btn-press"
                >
                  Desserts
                </Link>
                <Link
                  to="/menu"
                  className="w-full rounded-xl border border-white/10 py-2 text-center text-[11px] font-semibold text-muted-foreground btn-press hover:text-foreground"
                >
                  View full menu
                </Link>
              </div>
            </div>
          )}

          {isActive && whileYouWaitItems.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quick adds
              </p>
              <div className="mt-2.5 space-y-2">
                {whileYouWaitItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-background/20 px-3 py-2"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-11 w-11 rounded-lg object-cover shrink-0"
                      decoding="async"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-primary font-semibold">{formatPrice(item.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addItem(item)}
                      className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground btn-press"
                      aria-label={`Add ${item.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingPage;
