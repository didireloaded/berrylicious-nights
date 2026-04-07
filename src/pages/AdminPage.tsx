import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/vibe";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ShoppingBag,
  Megaphone,
  Plus,
  Trash2,
  Check,
  X,
  Clock,
  ChevronRight,
  LayoutDashboard,
  Flame,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { AdminMessagesPanel } from "@/components/admin/AdminMessagesPanel";
import { AdminArrivalVerify } from "@/components/admin/AdminArrivalVerify";
import { AdminWaitlistPanel } from "@/components/admin/AdminWaitlistPanel";
import { AdminMenuDisabledPanel } from "@/components/admin/AdminMenuDisabledPanel";
import { toast } from "sonner";
import {
  groupOrdersByKitchenStatus,
  estimatePrepMinutes,
  inferredPriority,
  kitchenLoadLevel,
  ordersPerMinuteLastWindow,
  buildDashboardHints,
  bookingsInNextMinutes,
  revenueTodayCompleted,
  getNextOrderStatus,
  aggregateShiftAnalytics,
  type AdminOrderLike,
} from "@/lib/adminDashboardIntel";
import { getPopularItems } from "@/services/analytics";

const statusColors: Record<string, string> = {
  confirmed: "bg-primary/20 text-primary",
  arrived: "bg-emerald-500/20 text-emerald-400",
  cancelled: "bg-destructive/20 text-destructive",
  pending: "bg-primary/20 text-primary",
  preparing: "bg-yellow-500/20 text-yellow-400",
  ready: "bg-green-500/20 text-green-400",
  completed: "bg-muted text-muted-foreground",
  seated: "bg-sky-500/20 text-sky-400",
};

const typeBadge: Record<string, string> = {
  preorder: "Pre-order",
  pickup: "Pickup",
  dinein: "Dine-in",
};

function isFreshPendingOrder(o: { status: string; created_at: string }) {
  if (o.status !== "pending") return false;
  const t = new Date(o.created_at).getTime();
  return Number.isFinite(t) && Date.now() - t < 5 * 60 * 1000;
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* no audio */
  }
}

function sortFifo(a: AdminOrderLike, b: AdminOrderLike) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

type AdminMainView = "kitchen" | "analytics" | "messages";

const AdminPage = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [mainView, setMainView] = useState<AdminMainView>("kitchen");
  const [bookings, setBookings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "",
    subtitle: "",
    type: "event",
    event_date: new Date().toISOString().split("T")[0],
    event_time: "21:00",
    available_slots_csv: "18:00,19:30,20:00,21:00",
  });
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const fetchBookings = useCallback(async () => {
    const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(80);
    setBookings(data ?? []);
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(80);
    setOrders(data ?? []);
  }, []);

  const fetchUpdates = useCallback(async () => {
    const { data } = await supabase.from("updates").select("*").order("created_at", { ascending: false });
    setUpdates(data ?? []);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    fetchBookings();
    fetchOrders();
    fetchUpdates();

    const channel = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchBookings())
      .on("postgres_changes", { event: "*", schema: "public", table: "updates" }, () => fetchUpdates())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, fetchBookings, fetchOrders, fetchUpdates]);

  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));
    if (!bootstrappedRef.current) {
      if (orders.length > 0) {
        bootstrappedRef.current = true;
        knownOrderIdsRef.current = ids;
      }
      return;
    }
    const prev = knownOrderIdsRef.current;
    for (const o of orders) {
      if (!prev.has(o.id) && o.status === "pending") {
        toast.success("New order received", { duration: 5000 });
        playAlertSound();
        break;
      }
    }
    knownOrderIdsRef.current = ids;
  }, [orders]);

  const updateBookingStatus = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status }).eq("id", id);
    toast.success(`Booking ${status}`);
    fetchBookings();
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    toast.success(`Order: ${status}`);
    fetchOrders();
  };

  const setOrderETA = async (id: string, minutes: number) => {
    await supabase
      .from("orders")
      .update({
        eta_minutes: minutes,
        eta_set_at: new Date().toISOString(),
      } as any)
      .eq("id", id);
    toast.success(`ETA set to ${minutes} min`);
    fetchOrders();
  };

  const addEvent = async () => {
    if (!newEvent.title.trim()) return;
    const slots = newEvent.available_slots_csv.split(/[\s,]+/).filter(Boolean);
    await supabase.from("updates").insert({
      title: newEvent.title.trim(),
      subtitle: newEvent.subtitle.trim() || null,
      type: newEvent.type,
      event_date: newEvent.event_date || null,
      event_time: newEvent.event_time.trim() || null,
      available_slots: slots,
      active: true,
    } as any);
    setNewEvent({
      title: "",
      subtitle: "",
      type: "event",
      event_date: new Date().toISOString().split("T")[0],
      event_time: "21:00",
      available_slots_csv: "18:00,19:30,20:00,21:00",
    });
    toast.success("Event added");
    fetchUpdates();
  };

  const toggleEvent = async (id: string, active: boolean) => {
    await supabase.from("updates").update({ active: !active }).eq("id", id);
    fetchUpdates();
  };

  const deleteEvent = async (id: string) => {
    await supabase.from("updates").delete().eq("id", id);
    toast.success("Event removed");
    fetchUpdates();
  };

  const grouped = useMemo(() => groupOrdersByKitchenStatus(orders as AdminOrderLike[]), [orders]);
  const activeCount = grouped.pending.length + grouped.preparing.length + grouped.ready.length;
  const load = kitchenLoadLevel(grouped.pending.length, grouped.preparing.length, grouped.ready.length);
  const opm = useMemo(() => ordersPerMinuteLastWindow(orders as AdminOrderLike[], 5), [orders]);
  const bookingsToday = useMemo(() => bookings.filter((b) => b.date === todayStr), [bookings, todayStr]);
  const bookingsNext10 = useMemo(
    () => bookingsInNextMinutes(bookings as { date: string; time: string; status?: string }[], new Date(), 10),
    [bookings],
  );
  const hints = useMemo(
    () => buildDashboardHints({ grouped, ordersPerMinute: opm, bookingsNextWindow: bookingsNext10 }),
    [grouped, opm, bookingsNext10],
  );
  const revenueToday = useMemo(() => revenueTodayCompleted(orders as AdminOrderLike[], todayStr), [orders, todayStr]);
  const shiftStats = useMemo(() => aggregateShiftAnalytics(orders as AdminOrderLike[]), [orders]);
  const popularLines = useMemo(() => getPopularItems(orders as { items?: { name?: string; qty?: number }[] }[]), [orders]);
  const eventsTonight = useMemo(
    () =>
      updates.filter((u) => u.active && (u.event_date === todayStr || !u.event_date)),
    [updates, todayStr],
  );

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const loadLabel =
    load === "high" ? "High" : load === "medium" ? "Medium" : "Low";
  const loadClass =
    load === "high"
      ? "text-destructive border-destructive/40 bg-destructive/10"
      : load === "medium"
        ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
        : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";

  const renderOrderDetail = (o: any, inDrawer: boolean) => (
    <div className={inDrawer ? "" : "animate-fade-in"}>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-display text-xl font-bold text-foreground">#{o.id.slice(0, 8)}</h2>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[o.status] ?? "bg-muted text-muted-foreground"}`}>
          {o.status}
        </span>
        {inferredPriority(o) === "high" && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-orange-400">Priority</span>
        )}
        {o.order_type && <span className="text-xs text-muted-foreground">{typeBadge[o.order_type]}</span>}
      </div>
      <p className="text-xs text-muted-foreground mb-1">
        Suggested prep ~{estimatePrepMinutes(o, activeCount)} min (queue-aware)
      </p>
      <p className="text-foreground font-semibold text-lg mb-1">{formatPrice(o.total)}</p>
      {o.arrival_code ? (
        <p className="font-mono text-sm font-bold text-primary tracking-wide mb-2">{o.arrival_code}</p>
      ) : null}
      {o.arrival_verified_at ? (
        <p className="text-[10px] text-muted-foreground mb-2">
          Pickup verified {new Date(o.arrival_verified_at).toLocaleString()}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs mb-4">{new Date(o.created_at).toLocaleString()}</p>
      <div className="space-y-2 mb-6">
        {Array.isArray(o.items) &&
          o.items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-foreground">
                {item.name} x {item.qty}
              </span>
              <span className="text-muted-foreground">{formatPrice(item.price * item.qty)}</span>
            </div>
          ))}
      </div>
      {o.status === "preparing" && (
        <details className="mb-4 group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Set ETA (optional)
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {[10, 15, 20, 30].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setOrderETA(o.id, mins)}
                className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-colors btn-press ${
                  o.eta_minutes === mins
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="h-3 w-3" />
                {mins}m
              </button>
            ))}
          </div>
        </details>
      )}
      {getNextOrderStatus(o.status) && (
        <button
          type="button"
          onClick={() => updateOrderStatus(o.id, getNextOrderStatus(o.status)!)}
          className="w-full rounded-xl bg-primary py-5 text-base font-bold text-primary-foreground btn-press shadow-lg shadow-primary/20"
        >
          Next step
        </button>
      )}
    </div>
  );

  const column = (title: string, list: AdminOrderLike[], tone: string) => (
    <div className={`rounded-xl border border-border bg-card/80 min-h-[200px] flex flex-col ${tone}`}>
      <div className="px-3 py-2 border-b border-border/80 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className="text-xs font-semibold text-foreground">{list.length}</span>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[min(52vh,420px)]">
        {list.length === 0 && <p className="text-muted-foreground text-xs text-center py-6">None</p>}
        {[...list].sort(sortFifo).map((o) => {
          const isSelected = o.id === selectedId;
          const urgent = isFreshPendingOrder(o);
          const high = inferredPriority(o) === "high";
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelectedId(o.id)}
              className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors btn-press ${
                isSelected ? "border-primary bg-primary/10" : "border-border bg-background/50 hover:border-primary/30"
              } ${urgent ? "ring-2 ring-inset ring-primary/60" : ""} ${high ? "ring-1 ring-orange-500/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-foreground">#{o.id.slice(0, 6)}</span>
                <span className="text-[10px] text-muted-foreground">{estimatePrepMinutes(o, activeCount)}m est.</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {Array.isArray(o.items) ? o.items.map((i: any) => i.name).join(", ") : "—"}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {o.order_type && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{typeBadge[o.order_type]}</span>
                )}
                <span className="text-[10px] text-primary font-semibold">{formatPrice(Number(o.total) || 0)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: "/admin" }} />;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen pb-safe-nav flex flex-col items-center justify-center px-6 text-center max-w-md mx-auto">
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Admin access</h1>
        <p className="text-muted-foreground text-sm mb-4">
          This account does not have the <span className="text-foreground font-medium">admin</span> role yet. After you
          sign in with the right user, run{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">supabase/manual/GRANT_ADMIN.sql</code> in the Supabase
          SQL Editor (or set <code className="text-xs bg-muted px-1 py-0.5 rounded">VITE_DEV_ADMIN_EMAILS</code> in{" "}
          <code className="text-xs">.env</code> during local dev).
        </p>
        <div className="flex flex-col gap-2 w-full">
          <button
            type="button"
            onClick={() => navigate("/auth", { state: { from: "/admin" } })}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold"
          >
            Sign in as admin
          </button>
          <Link to="/" className="text-sm text-primary font-medium">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-safe-nav bg-background">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-primary shrink-0" />
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground leading-tight">Operations</h1>
              <p className="text-xs text-muted-foreground">Live · {todayStr}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <div className="rounded-xl border border-border bg-card px-3 py-2 min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active orders</p>
              <p className="text-lg font-bold text-foreground">{activeCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2 min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Today revenue</p>
              <p className="text-lg font-bold text-primary">{formatPrice(revenueToday)}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2 min-w-[120px] ${loadClass}`}>
              <p className="text-[10px] uppercase tracking-wider opacity-80 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Kitchen load
              </p>
              <p className="text-lg font-bold">{loadLabel}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2 min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next 10 min</p>
              <p className="text-lg font-bold text-foreground">{bookingsNext10}</p>
              <p className="text-[9px] text-muted-foreground">bookings</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setMainView("kitchen"); setSelectedId(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mainView === "kitchen" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Kitchen
          </button>
          <button
            type="button"
            onClick={() => { setMainView("analytics"); setSelectedId(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mainView === "analytics" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
          <button
            type="button"
            onClick={() => { setMainView("messages"); setSelectedId(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mainView === "messages" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Messages
          </button>
        </div>

        {mainView === "messages" ? <AdminMessagesPanel /> : null}

        {mainView === "analytics" ? (
          <div className="rounded-xl border border-border bg-card p-6 max-w-xl">
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Shift snapshot</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Based on the last {orders.length} orders loaded in this session. Wire Supabase SQL or Edge Functions for
              full-day metrics.
            </p>
            <ul className="space-y-3 text-foreground">
              <li className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Orders in batch</span>
                <span className="font-bold">{shiftStats.totalOrders}</span>
              </li>
              <li className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Peak hour (batch)</span>
                <span className="font-bold">{shiftStats.peakHour}</span>
              </li>
              <li className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Top item (batch)</span>
                <span className="font-bold text-right max-w-[60%] truncate">{shiftStats.mostOrdered}</span>
              </li>
            </ul>
            {popularLines.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-2">Popular lines (loaded orders)</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {popularLines.map(([name, count]) => (
                    <li key={name}>
                      <span className="text-foreground font-medium">{name}</span>
                      <span className="text-muted-foreground"> · {count} in batch</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ) : null}

        {mainView === "kitchen" && (
          <div className="mb-4 space-y-4">
            <AdminArrivalVerify
              onVerified={() => {
                void fetchBookings();
                void fetchOrders();
              }}
            />
            <div className="flex flex-col xl:flex-row gap-4 xl:items-start">
              <AdminWaitlistPanel />
              <AdminMenuDisabledPanel />
            </div>
          </div>
        )}

        {/* Subtle hints (logic, not “AI” branding) */}
        {mainView === "kitchen" && hints.length > 0 && (
          <div className="mb-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 space-y-1">
            {hints.map((h, i) => (
              <p key={i} className="text-xs text-muted-foreground leading-snug">
                {h}
              </p>
            ))}
          </div>
        )}

        {/* Main: board + detail */}
        {mainView === "kitchen" ? (
        <div className="flex flex-col xl:flex-row gap-4 xl:items-start">
          <div className="flex-1 min-w-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {column("Pending", grouped.pending, "")}
              {column("Preparing", grouped.preparing, "")}
              {column("Ready", grouped.ready, "")}
            </div>

            {/* Bookings today */}
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Bookings today
                </h2>
                <span className="text-xs text-muted-foreground">{bookingsToday.length} total</span>
              </div>
              {bookingsToday.length === 0 ? (
                <p className="text-muted-foreground text-sm">No bookings for today.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                  {bookingsToday.map((b) => (
                    <div
                      key={b.id}
                      className="min-w-[220px] shrink-0 rounded-lg border border-border bg-background/80 p-3"
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {b.time} · {b.guests} guests
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {b.guest_name || "Guest"} {b.guest_phone ? `· ${b.guest_phone}` : ""}
                      </p>
                      {b.assigned_table_code ? (
                        <p className="mt-1 text-[11px] font-mono font-semibold text-foreground">Table {b.assigned_table_code}</p>
                      ) : null}
                      {b.arrival_code ? (
                        <p className="mt-1.5 font-mono text-sm font-bold text-primary tracking-wide">{b.arrival_code}</p>
                      ) : null}
                      {b.arrival_verified_at ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Checked in {new Date(b.arrival_verified_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      ) : null}
                      <span
                        className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          statusColors[b.status] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        {b.status}
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => updateBookingStatus(b.id, "confirmed")}
                          className="text-[10px] font-semibold text-primary hover:underline"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBookingStatus(b.id, "seated")}
                          className="text-[10px] font-semibold text-sky-400 hover:underline"
                        >
                          Seated
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBookingStatus(b.id, "cancelled")}
                          className="text-[10px] font-semibold text-destructive hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Events (tonight / active) */}
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-primary" />
                  Events &amp; specials
                </h2>
                <span className="text-xs text-muted-foreground">{eventsTonight.length} live tonight</span>
              </div>
              <div className="space-y-2 mb-4">
                {eventsTonight.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nothing flagged for tonight.</p>
                ) : (
                  eventsTonight.map((u) => (
                    <div key={u.id} className="flex items-start justify-between gap-2 rounded-lg border border-border/80 p-2.5">
                      <div className="min-w-0">
                        <span className="text-[10px] text-primary font-semibold uppercase">{u.type}</span>
                        <p className="text-sm font-semibold text-foreground truncate">{u.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.subtitle}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleEvent(u.id, u.active)}
                          className={`w-7 h-7 rounded flex items-center justify-center ${
                            u.active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {u.active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEvent(u.id)}
                          className="w-7 h-7 rounded bg-destructive/10 text-destructive flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <details className="group">
                <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1 [&::-webkit-details-marker]:hidden">
                  <Plus className="w-3.5 h-3.5" /> Add or edit full list
                </summary>
                <div className="mt-3 space-y-3 pt-3 border-t border-border">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      placeholder="Event title"
                      className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-foreground text-sm"
                    />
                    <input
                      type="text"
                      value={newEvent.subtitle}
                      onChange={(e) => setNewEvent({ ...newEvent, subtitle: e.target.value })}
                      placeholder="Subtitle"
                      className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-foreground text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={newEvent.event_date}
                      onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg py-2 px-2 text-sm [color-scheme:dark]"
                    />
                    <input
                      type="text"
                      value={newEvent.event_time}
                      onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })}
                      placeholder="21:00"
                      className="w-full bg-surface border border-border rounded-lg py-2 px-2 text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    value={newEvent.available_slots_csv}
                    onChange={(e) => setNewEvent({ ...newEvent, available_slots_csv: e.target.value })}
                    placeholder="Table times CSV"
                    className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addEvent}
                    className="bg-primary text-primary-foreground text-sm font-semibold py-2 px-4 rounded-lg"
                  >
                    Add event
                  </button>
                  {updates
                    .filter((u) => !eventsTonight.some((e) => e.id === u.id))
                    .map((u) => (
                      <div key={u.id} className="flex items-center justify-between text-xs border border-border/60 rounded-lg p-2">
                        <span className="truncate text-muted-foreground">{u.title}</span>
                        <div className="flex gap-1 shrink-0">
                          <button type="button" onClick={() => toggleEvent(u.id, u.active)} className="text-primary">
                            {u.active ? "Off" : "On"}
                          </button>
                          <button type="button" onClick={() => deleteEvent(u.id)} className="text-destructive">
                            Del
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </details>
            </section>

            {/* History */}
            <details className="rounded-xl border border-border bg-card/50 p-4">
              <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                All orders (history)
              </summary>
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-xs border-b border-border/50 py-2">
                    <span className="text-foreground">#{o.id.slice(0, 6)}</span>
                    <span className="text-muted-foreground">{o.status}</span>
                    <span className="text-primary font-medium">{formatPrice(o.total)}</span>
                    {getNextOrderStatus(o.status) && (
                      <button
                        type="button"
                        className="text-primary font-semibold"
                        onClick={() => updateOrderStatus(o.id, getNextOrderStatus(o.status)!)}
                      >
                        Advance
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Right: selected order */}
          <aside className="w-full xl:w-[320px] shrink-0 xl:sticky xl:top-4 self-start">
            <div className="rounded-xl border border-border bg-card p-4 min-h-[200px] hidden xl:block">
              {!selected ? (
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground text-sm py-12">
                  <ShoppingBag className="w-10 h-10 mb-2 opacity-40" />
                  Select an order for details and the next action.
                </div>
              ) : (
                renderOrderDetail(selected, false)
              )}
            </div>
          </aside>
        </div>
        ) : null}
      </div>

      {/* Mobile drawer */}
      {mainView === "kitchen" && selected && (
        <div className="xl:hidden fixed inset-0 z-50 bg-background/98 overflow-y-auto animate-fade-in">
          <div className="px-4 pt-4 pb-safe-nav max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-muted-foreground text-sm mb-4 flex items-center gap-1"
            >
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to board
            </button>
            {renderOrderDetail(selected, true)}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
