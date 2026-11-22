import { useParams, Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOrderSnapshotFromStorage, saveOrderSnapshotForTracking } from "@/lib/orderTrackingStorage";
import { extractOrderMetaFromItems } from "@/lib/orderPricing";
import {
  getOrderStageCopy,
  isActiveOrderStatus,
  ORDER_STAGE_SEQUENCE,
} from "@/lib/orderLifecycle";
import { formatPrice } from "@/lib/vibe";
import { menuItems } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";
import { useNotificationCenter } from "@/context/NotificationCenterContext";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChefHat,
  Clock,
  MessageSquare,
  MessageSquareHeart,
  PackageCheck,
  Phone,
  Plus,
  ReceiptText,
  Star,
  Utensils,
  WifiOff,
  Wine,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { notifyOrderStatusTransition } from "@/lib/orderStatusNotify";
import { extractDrinkLinesFromOrder } from "@/lib/anotherRound";
import { ArrivalCodeCard } from "@/components/ArrivalCodeCard";
import { OrderReviewSheet } from "@/components/OrderReviewSheet";
import { ReorderPreviewSheet } from "@/components/ReorderPreviewSheet";
import { OrderAnotherRoundSheet } from "@/components/OrderAnotherRoundSheet";
import { PrivateFeedbackSheet } from "@/components/PrivateFeedbackSheet";

const WHILE_WAIT_MENU_IDS = ["14", "12", "19"];

const orderTypeLabels: Record<string, string> = {
  preorder: "Pre-order",
  pickup: "Pickup",
  dinein: "Dine-in",
};

function formatOrderNumber(id: string): string {
  return `BB-${id.slice(0, 6).toUpperCase()}`;
}

function formatWindhoekTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      timeZone: "Africa/Windhoek",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

type StatusHistoryEntry = {
  id?: string;
  from_status?: string | null;
  to_status: string;
  created_at: string;
};

type TrackedOrderItem = {
  id?: string;
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
  dietary_notes?: string | null;
  guest_access_token?: string | null;
  payment_status?: string | null;
  eta_minutes?: number | null;
  eta_set_at?: string | null;
  created_at?: string;
  arrival_code?: string | null;
};

type DynamicRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data: StatusHistoryEntry[] | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
};

const OrderTrackingPage = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { setCurrentOrder, clearCurrentOrder, currentOrder } = useApp();
  const { openAssistant } = useRestaurantAssistant();
  const { openNotificationCenter, preferences, togglePushSubscription } = useNotificationCenter();
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [etaRemaining, setEtaRemaining] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [anotherRoundOpen, setAnotherRoundOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));

  const hasOrderDrinks = useMemo(
    () => extractDrinkLinesFromOrder(order?.items).length > 0,
    [order?.items],
  );

  useEffect(() => {
    if (searchParams.get("rate") === "1" && order?.status === "completed") {
      setReviewOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, order?.status]);

  const whileYouWaitItems = useMemo(
    () =>
      WHILE_WAIT_MENU_IDS.map((mid) => menuItems.find((m) => m.id === mid)).filter(
        (m): m is (typeof menuItems)[number] => m != null,
      ),
    [],
  );

  const hydrateOrder = useCallback(
    (
      raw: TrackedOrder | null,
      snap: ReturnType<typeof loadOrderSnapshotFromStorage>,
    ): TrackedOrder | null => {
      if (!raw) return snap;
      const embeddedMeta = extractOrderMetaFromItems(raw.items);
      return {
        ...raw,
        arrival_code: raw.arrival_code ?? snap?.arrival_code ?? null,
        table_number: raw.table_number ?? snap?.table_number ?? embeddedMeta.tableNumber ?? null,
        scheduled_time: snap?.scheduled_time ?? embeddedMeta.scheduledTime ?? null,
        guest_name: snap?.guest_name ?? embeddedMeta.guestName ?? null,
        dietary_notes: snap?.dietary_notes ?? embeddedMeta.dietaryNotes ?? null,
        guest_access_token: raw.guest_access_token ?? snap?.guest_access_token ?? null,
        payment_status: raw.payment_status ?? snap?.payment_status ?? "unpaid",
      };
    },
    [],
  );

  const refreshOrder = useCallback(async () => {
    if (!id) return;
    const snap = loadOrderSnapshotFromStorage(id);
    const dynamicClient = supabase as unknown as DynamicRpcClient;
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData?.session) {
      if (snap?.guest_access_token) {
        try {
          const { data: rpcData, error: rpcErr } = await dynamicClient.rpc("get_guest_order_status", {
            p_order_id: id,
            p_access_token: snap.guest_access_token,
          });
          if (!rpcErr && rpcData && typeof rpcData === "object") {
            const payload = rpcData as TrackedOrder & { history?: StatusHistoryEntry[] };
            setOrder(hydrateOrder(payload, snap));
            if (Array.isArray(payload.history)) setHistory(payload.history);
            setLoading(false);
            return;
          }
        } catch {
          /* fall back to last-known guest snapshot */
        }
      }
      setOrder(hydrateOrder(snap, snap));
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setOrder(hydrateOrder(data as TrackedOrder | null, snap));

    try {
      const { data: histRows, error: histErr } = await dynamicClient
        .from("order_status_history")
        .select("id, from_status, to_status, created_at")
        .eq("order_id", id)
        .order("created_at", { ascending: true });
      if (!histErr && Array.isArray(histRows)) {
        setHistory(histRows);
      }
    } catch {
      /* ignore if migration not yet deployed */
    }
    setLoading(false);
  }, [id, hydrateOrder]);

  useEffect(() => {
    if (!id) return;
    void refreshOrder();

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          const neu = payload.new as TrackedOrder;
          const oldRow = payload.old as { status?: string } | undefined;
          if (neu?.id && neu.status) {
            notifyOrderStatusTransition(neu.id, oldRow?.status, neu.status, neu.order_type);
          }
          const snap = loadOrderSnapshotFromStorage(id);
          setOrder(hydrateOrder(neu, snap));
          void refreshOrder();
        },
      )
      .subscribe();

    const handleOnline = () => {
      setIsOffline(false);
      void refreshOrder();
    };
    const handleOffline = () => setIsOffline(true);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshOrder();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    // Light polling fallback for guests with a secure guest_access_token while order is active
    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        const snap = loadOrderSnapshotFromStorage(id);
        if (snap?.guest_access_token && isActiveOrderStatus(snap.status)) {
          void refreshOrder();
        }
      }
    }, 20_000);

    return () => {
      clearInterval(poll);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [id, refreshOrder, hydrateOrder]);

  useEffect(() => {
    if (!order?.id) return;
    const snap = {
      id: String(order.id),
      items: order.items,
      total: Number(order.total) || 0,
      status: String(order.status ?? "pending"),
      order_type: order.order_type ?? undefined,
      table_number: order.table_number ?? null,
      scheduled_time: order.scheduled_time ?? null,
      guest_name: order.guest_name ?? null,
      dietary_notes: order.dietary_notes ?? null,
      guest_access_token: order.guest_access_token ?? null,
      payment_status: order.payment_status ?? null,
      eta_minutes: order.eta_minutes ?? null,
      eta_set_at: order.eta_set_at ?? null,
      created_at: order.created_at,
      arrival_code: order.arrival_code ?? null,
    };
    saveOrderSnapshotForTracking(snap);
    setCurrentOrder(snap);
  }, [order, setCurrentOrder]);

  useEffect(() => {
    if ((order?.status === "completed" || order?.status === "cancelled") && currentOrder?.id === id) {
      clearCurrentOrder();
    }
  }, [order?.status, currentOrder?.id, id, clearCurrentOrder]);

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

  const handleCustomerCancel = async () => {
    if (!order?.id || !user || order.status !== "pending" || cancelling) return;
    setCancelling(true);
    try {
      const rpc = supabase as unknown as DynamicRpcClient;
      const { data, error } = await rpc.rpc("cancel_own_pending_order", { p_order_id: order.id });
      if (error || !data) {
        toast.error("Please call +264 83 288 8000 so the kitchen can update or cancel your ticket.");
        return;
      }
      setOrder((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      toast.success("Order cancelled");
    } catch {
      toast.error("Please call +264 83 288 8000 so staff can assist with your order.");
    } finally {
      setCancelling(false);
    }
  };

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

  const isCancelled = order.status === "cancelled";
  const isCompleted = order.status === "completed";
  const isActive = isActiveOrderStatus(order.status);
  const currentIndex = Math.max(
    0,
    ORDER_STAGE_SEQUENCE.findIndex((s) => s === order.status),
  );
  const stageCopy = getOrderStageCopy(order.status ?? "pending", order.order_type);
  const progressPercent = stageCopy.progressPercent;
  const typeLabel = orderTypeLabels[order.order_type ?? ""] ?? "Order";
  const headline = stageCopy.headline;
  const subline = stageCopy.notificationMessage;
  const orderNumber = formatOrderNumber(String(order.id));
  const placedTime = order.created_at
    ? new Date(order.created_at).toLocaleString("en-GB", {
        timeZone: "Africa/Windhoek",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  const historyTimeByStatus = new Map<string, string>();
  for (const h of history) {
    if (h.to_status && h.created_at) {
      historyTimeByStatus.set(h.to_status, formatWindhoekTime(h.created_at));
    }
  }
  if (order.created_at && !historyTimeByStatus.has("pending")) {
    historyTimeByStatus.set("pending", formatWindhoekTime(order.created_at));
  }

  const stageItems = [
    { key: "pending", label: "Received", icon: Clock },
    { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
    { key: "preparing", label: "Preparing", icon: ChefHat },
    { key: "ready", label: "Ready", icon: PackageCheck },
    { key: "handover", label: order.order_type === "dinein" ? "To Table" : "Collection", icon: Utensils },
    { key: "completed", label: "Completed", icon: Star },
  ];

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openNotificationCenter}
              aria-label="Open notifications"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white transition-colors hover:bg-[#303030]"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="rounded-full border border-white/10 bg-[#242424] px-4 py-2 font-mono text-[13px] font-bold text-[#FF5A1F]">
              #{orderNumber}
            </span>
          </div>
        </header>

        {isOffline && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200"
          >
            <WifiOff className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <span>You are offline. Showing your last known status — live updates will resume automatically.</span>
          </div>
        )}

        {/* Status & Progress Card (real DB statuses including cancelled) */}
        <section
          className={
            "mt-6 rounded-[24px] border p-5 " +
            (isCancelled ? "border-red-500/35 bg-red-950/20" : "border-white/10 bg-[#242424]")
          }
          aria-label="Order status"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={"text-[12px] font-semibold uppercase tracking-[0.12em] " + (isCancelled ? "text-red-400" : "text-[#FF5A1F]")}>
                Order #{orderNumber}
              </p>
              <h1 className="mt-1 flex items-center gap-2 font-display text-[24px] font-extrabold tracking-[-0.03em] text-white">
                {isCancelled && <XCircle className="h-6 w-6 text-red-400" aria-hidden="true" />}
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

          {isCancelled ? (
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                to="/menu"
                className="inline-flex min-h-[46px] flex-1 items-center justify-center whitespace-nowrap rounded-full bg-[#FF5A1F] px-5 text-[14px] font-bold text-white hover:bg-[#E84D15]"
              >
                Order Again
              </Link>
              <a
                href="tel:+264832888000"
                className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-[#242424] px-5 text-[14px] font-semibold text-white hover:bg-[#303030]"
              >
                <Phone className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                Call Restaurant
              </a>
            </div>
          ) : (
            <>
              {isActive && etaRemaining !== null && order.status !== "ready" && order.status !== "handover" && (
                <p className="mt-3 rounded-xl bg-[#303030] px-3.5 py-2 text-[14px] font-semibold text-white">
                  Kitchen estimate: <span className="text-[#FF5A1F]">~{etaRemaining} min</span>
                </p>
              )}

              <div className="mt-5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#303030]">
                  <div
                    className="h-full rounded-full bg-[#FF5A1F] transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* 6-Stage Kitchen Progress Stepper */}
                <ol className="mt-4 grid grid-cols-3 gap-y-4 gap-x-2 sm:grid-cols-6">
                  {stageItems.map((step, i) => {
                    const done = i <= currentIndex;
                    const active = i === currentIndex;
                    const Icon = step.icon;
                    const ts = historyTimeByStatus.get(step.key);
                    return (
                      <li key={step.key} className="flex flex-col items-center gap-1 text-center">
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
                        {ts && done && (
                          <span className="text-[10px] tabular-nums text-[#A3A3A3]">{ts}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Explicit opt-in device alerts (never auto-prompted) */}
              {isActive && user && !preferences.push_enabled && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1B1B1B] px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white">Want instant kitchen alerts?</p>
                    <p className="text-[12px] text-[#A3A3A3]">Get notified as soon as your meal moves stages.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void togglePushSubscription(true)}
                    className="min-h-[40px] shrink-0 rounded-full bg-[#303030] px-3.5 text-[12px] font-bold text-white hover:bg-[#3A3A3A]"
                  >
                    Enable alerts
                  </button>
                </div>
              )}

              {/* Subtle completed meal prompt (connected to Phase 2 verified ratings) */}
              {isCompleted && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#FF5A1F]/30 bg-[#FF5A1F]/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-white">How was your meal?</p>
                    <p className="text-[12px] text-[#C4C4C4]">Share verified feedback on the dishes you ordered.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReviewOpen(true)}
                    className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-[#FF5A1F] px-4 text-[12px] font-bold text-white hover:bg-[#E84D15]"
                  >
                    <Star className="h-3.5 w-3.5" aria-hidden="true" />
                    Rate dishes
                  </button>
                </div>
              )}
            </>
          )}
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

          {order.dietary_notes && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
              <div>
                <p className="font-bold text-amber-300">Allergy / Dietary Note Sent to Kitchen</p>
                <p className="mt-0.5">{order.dietary_notes}</p>
              </div>
            </div>
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

          {!isCancelled && (
            <p className="mt-2.5 text-[13px] text-[#A3A3A3]">
              Show order #{orderNumber}
              {order.arrival_code ? ` or code ${order.arrival_code}` : ""} to staff on collection or at your table.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            {!isCancelled && hasOrderDrinks && (
              <button
                type="button"
                onClick={() => setAnotherRoundOpen(true)}
                className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#E84D15]"
              >
                <Wine className="h-4 w-4" aria-hidden="true" />
                Order Another Round
              </button>
            )}
            {isCompleted && (
              <button
                type="button"
                onClick={() => setReorderOpen(true)}
                className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-[#303030] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#3A3A3A]"
              >
                Order Again (Revalidate Prices)
              </button>
            )}
          </div>
        </section>

        {/* Private Feedback to Management */}
        <section className="mt-4 flex items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[#242424] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-white">Private dining feedback</p>
            <p className="text-[12px] text-[#A3A3A3]">Compliments, issues, or request a duty manager privately.</p>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-[#303030] px-3.5 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]"
          >
            <MessageSquareHeart className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Message
          </button>
        </section>

        {/* Corrections & Cancellation Support for Active Orders */}
        {isActive && (
          <section className="mt-4 rounded-[22px] border border-white/10 bg-[#242424] p-4" aria-label="Order changes or cancellation">
            <p className="text-[14px] font-bold text-white">Need to change or cancel your order?</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#A3A3A3]">
              Call the floor team immediately with reference <span className="font-mono font-semibold text-white">#{orderNumber}</span> before the grill fires your cuts.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="tel:+264832888000"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-[#303030] px-4 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]"
              >
                <Phone className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                +264 83 288 8000
              </a>
              <button
                type="button"
                onClick={openAssistant}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-[#303030] px-4 text-[13px] font-semibold text-white hover:bg-[#3A3A3A]"
              >
                <MessageSquare className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                Message staff
              </button>
              {user && order.status === "pending" && (
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => void handleCustomerCancel()}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-red-500/35 bg-red-500/10 px-4 text-[13px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  {cancelling ? "Cancelling…" : "Cancel pending order"}
                </button>
              )}
            </div>
          </section>
        )}

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

      <OrderReviewSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        orderId={String(order.id)}
        orderStatus={String(order.status ?? "pending")}
        orderItems={order.items}
        guestAccessToken={order.guest_access_token}
      />

      <ReorderPreviewSheet
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        orderNumber={orderNumber}
        orderItems={order.items}
      />

      <OrderAnotherRoundSheet
        open={anotherRoundOpen}
        onOpenChange={setAnotherRoundOpen}
        orderNumber={orderNumber}
        orderItems={order.items}
      />

      <PrivateFeedbackSheet
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        orderId={String(order.id)}
      />
    </div>
  );
};

export default OrderTrackingPage;
