import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOrderSnapshotFromStorage } from "@/lib/orderTrackingStorage";
import { formatPrice } from "@/lib/vibe";
import { menuItems } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { useApp } from "@/context/AppContext";
import { estimateETA } from "@/services/ai";
import heroImage from "@/assets/hero-restaurant.jpg";
import { ArrowLeft, Clock, CheckCircle2, ChefHat, Package, Plus } from "lucide-react";
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
  preparing: "Your food's on the stove",
  ready: "It's ready when you are",
  completed: "Enjoy every bite",
};

const statusSubline: Record<string, string> = {
  pending: "Hang tight — we’re lining everything up.",
  preparing: "Chef started your order — almost ready.",
  ready: "Almost there — head to the counter or your table when you’re ready.",
  completed: "Thanks for choosing Berrylicious tonight.",
};

const WHILE_WAIT_MENU_IDS = ["19", "14", "12"];

const orderTypeLabels: Record<string, string> = {
  preorder: "Pre-order",
  pickup: "Pickup",
  dinein: "Dine-in",
};

function getDetailedStatus(status: string, etaRemaining: number | null): string {
  if (status === "pending") return "Order received";
  if (status === "preparing") {
    if (etaRemaining !== null && etaRemaining >= 0 && etaRemaining <= 5) return "Almost ready";
    if (etaRemaining === null || etaRemaining > 5) return "Chef started your order";
    return "Chef started your order";
  }
  if (status === "ready") return "Ready for pickup";
  if (status === "completed") return "Enjoy — everything’s yours";
  return "Order received";
}

const OrderTrackingPage = () => {
  const { id } = useParams();
  const { addItem } = useCart();
  const { setCurrentOrder, clearCurrentOrder, currentOrder } = useApp();
  const [order, setOrder] = useState<any>(null);
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
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();
      const snap = loadOrderSnapshotFromStorage(id);
      const row = data
        ? { ...data, arrival_code: (data as { arrival_code?: string }).arrival_code ?? snap?.arrival_code }
        : snap;
      setOrder(row);
      setLoading(false);
    };
    fetchOrder();

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          const neu = payload.new as { id?: string; status?: string };
          const oldRow = payload.old as { status?: string } | undefined;
          if (neu?.id && neu.status) {
            notifyOrderStatusTransition(neu.id, oldRow?.status, neu.status);
          }
          setOrder(neu);
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
        One moment — pulling up your order…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-lg mb-4">Order not found</p>
        <Link to="/" className="text-primary font-semibold hover:opacity-80">Back to Home</Link>
      </div>
    );
  }

  const currentIndex = statusSteps.findIndex((s) => s.key === order.status);
  const progressPercent = Math.round((currentIndex / (statusSteps.length - 1)) * 100);
  const typeLabel = orderTypeLabels[order.order_type] ?? "Order";
  const headline = statusHeadline[order.status] ?? statusHeadline.pending;
  const subline = statusSubline[order.status] ?? statusSubline.pending;
  const detailedStatus = getDetailedStatus(order.status, etaRemaining);
  const isActive = order.status !== "completed";
  const lineItemCount = Array.isArray(order.items)
    ? (order.items as { qty?: number }[]).reduce((n, it) => n + (Number(it.qty) > 0 ? Number(it.qty) : 1), 0)
    : 0;
  const roughEtaHint = estimateETA(0, lineItemCount);

  return (
    <div className="min-h-screen relative">
      {/* Background image + overlay */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt=""
          className="w-full h-full object-cover"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
      </div>

      {/* Back button */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-20 w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center btn-press"
      >
        <ArrowLeft className="w-5 h-5 text-foreground" />
      </Link>

      {/* Glass panel — pinned to bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-panel-up pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="glass border-t border-white/10 rounded-t-3xl px-6 pt-6 pb-6 max-w-lg mx-auto">

          {/* Order meta row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-foreground font-display text-xl font-bold">
                Order #{order.id.slice(0, 8)}
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {formatPrice(Number(order.total))} · {typeLabel}
              </p>
            </div>
            {isActive && (
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse-dot" />
            )}
          </div>

          {/* Status — human headline + micro story */}
          <p className="text-foreground text-lg font-semibold leading-snug animate-fade-in">
            {headline}
          </p>
          <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed animate-fade-in">
            {subline}
          </p>
          <p className="text-foreground text-sm font-semibold mt-2.5 animate-fade-in">{detailedStatus}</p>
          {isActive && order.status !== "ready" && (
            <p className="text-muted-foreground text-xs mt-1.5">
              Typical prep from here ~{roughEtaHint} min (varies with the kitchen queue).
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

          {/* ETA */}
          {etaRemaining !== null && order.status !== "completed" && order.status !== "ready" && (
            <p className="text-primary text-2xl font-bold mt-3 animate-fade-in animate-eta-pulse">
              About {etaRemaining} min to go
            </p>
          )}

          {/* Stepper */}
          <div className="mt-6 mb-2">
            {/* Track */}
            <div className="relative h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Dots + labels */}
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

          {isActive && (
            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-sm font-semibold text-foreground">Add something while you wait</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/menu?category=Drinks"
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
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                We&apos;ll bundle these with your order when we can.
              </p>
              <div className="space-y-2">
                {whileYouWaitItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-background/20 px-3 py-2"
                  >
                    <img
                      src={item.image}
                      alt=""
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
                    <Link
                      to={`/menu/${item.id}`}
                      className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 w-10 text-center"
                    >
                      Menu
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Items — collapsible summary */}
          <details className="mt-4 group">
            <summary className="text-muted-foreground text-xs cursor-pointer hover:text-foreground transition-colors select-none">
              {Array.isArray(order.items) ? `${order.items.length} item${order.items.length > 1 ? "s" : ""}` : "Items"} — tap to view
            </summary>
            <div className="mt-3 space-y-1.5 animate-fade-in">
              {Array.isArray(order.items) &&
                order.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-foreground">{item.name} x {item.qty}</span>
                    <span className="text-muted-foreground">{formatPrice(item.price * item.qty)}</span>
                  </div>
                ))}
              <div className="border-t border-white/10 pt-2 flex justify-between font-semibold text-sm">
                <span className="text-foreground">Total</span>
                <span className="text-primary">{formatPrice(Number(order.total))}</span>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingPage;
