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
  LayoutDashboard,
  Flame,
  BarChart3,
  MessageSquare,
  UtensilsCrossed,
  ScanLine,
  ListOrdered,
  ChevronRight,
  Home,
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

/* ── Status badge colors ── */
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

/* ── Helpers ── */
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
  } catch { /* no audio */ }
}

function sortFifo(a: AdminOrderLike, b: AdminOrderLike) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function isFreshPendingOrder(o: { status: string; created_at: string }) {
  if (o.status !== "pending") return false;
  const t = new Date(o.created_at).getTime();
  return Number.isFinite(t) && Date.now() - t < 5 * 60 * 1000;
}

/* ── Tab definitions ── */
type AdminTab = "kitchen" | "bookings" | "events" | "analytics" | "messages" | "tools";

const TABS: { id: AdminTab; label: string; icon: typeof ShoppingBag }[] = [
  { id: "kitchen", label: "Kitchen", icon: ShoppingBag },
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "events", label: "Events", icon: Megaphone },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "tools", label: "Tools", icon: UtensilsCrossed },
];

/* ═══════════════════════════════════════════════════════════════════
   ADMIN PAGE
   ═══════════════════════════════════════════════════════════════════ */

const AdminPage = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("kitchen");
  const [bookings, setBookings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "", subtitle: "", type: "event",
    event_date: new Date().toISOString().split("T")[0],
    event_time: "21:00",
    available_slots_csv: "18:00,19:30,20:00,21:00",
  });
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  /* ── Fetchers ── */
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

  /* ── Realtime ── */
  useEffect(() => {
    if (!isAdmin) return;
    fetchBookings(); fetchOrders(); fetchUpdates();
    const channel = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchBookings())
      .on("postgres_changes", { event: "*", schema: "public", table: "updates" }, () => fetchUpdates())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, fetchBookings, fetchOrders, fetchUpdates]);

  /* ── New order alert ── */
  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));
    if (!bootstrappedRef.current) {
      if (orders.length > 0) { bootstrappedRef.current = true; knownOrderIdsRef.current = ids; }
      return;
    }
    for (const o of orders) {
      if (!knownOrderIdsRef.current.has(o.id) && o.status === "pending") {
        toast.success("🔔 New order received!", { duration: 5000 });
        playAlertSound();
        break;
      }
    }
    knownOrderIdsRef.current = ids;
  }, [orders]);

  /* ── Actions ── */
  const updateBookingStatus = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status }).eq("id", id);
    toast.success(`Booking ${status}`);
    fetchBookings();
  };
  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    toast.success(`Order → ${status}`);
    fetchOrders();
  };
  const setOrderETA = async (id: string, minutes: number) => {
    await supabase.from("orders").update({ eta_minutes: minutes, eta_set_at: new Date().toISOString() } as any).eq("id", id);
    toast.success(`ETA set to ${minutes} min`);
    fetchOrders();
  };
  const addEvent = async () => {
    if (!newEvent.title.trim()) return;
    const slots = newEvent.available_slots_csv.split(/[\s,]+/).filter(Boolean);
    await supabase.from("updates").insert({
      title: newEvent.title.trim(), subtitle: newEvent.subtitle.trim() || null,
      type: newEvent.type, event_date: newEvent.event_date || null,
      event_time: newEvent.event_time.trim() || null, available_slots: slots, active: true,
    } as any);
    setNewEvent({ title: "", subtitle: "", type: "event", event_date: new Date().toISOString().split("T")[0], event_time: "21:00", available_slots_csv: "18:00,19:30,20:00,21:00" });
    toast.success("Event added"); fetchUpdates();
  };
  const toggleEvent = async (id: string, active: boolean) => {
    await supabase.from("updates").update({ active: !active }).eq("id", id);
    fetchUpdates();
  };
  const deleteEvent = async (id: string) => {
    await supabase.from("updates").delete().eq("id", id);
    toast.success("Event removed"); fetchUpdates();
  };

  /* ── Computed ── */
  const grouped = useMemo(() => groupOrdersByKitchenStatus(orders as AdminOrderLike[]), [orders]);
  const activeCount = grouped.pending.length + grouped.preparing.length + grouped.ready.length;
  const load = kitchenLoadLevel(grouped.pending.length, grouped.preparing.length, grouped.ready.length);
  const opm = useMemo(() => ordersPerMinuteLastWindow(orders as AdminOrderLike[], 5), [orders]);
  const bookingsToday = useMemo(() => bookings.filter((b) => b.date === todayStr), [bookings, todayStr]);
  const bookingsNext10 = useMemo(() => bookingsInNextMinutes(bookings as any, new Date(), 10), [bookings]);
  const hints = useMemo(() => buildDashboardHints({ grouped, ordersPerMinute: opm, bookingsNextWindow: bookingsNext10 }), [grouped, opm, bookingsNext10]);
  const revenueToday = useMemo(() => revenueTodayCompleted(orders as AdminOrderLike[], todayStr), [orders, todayStr]);
  const shiftStats = useMemo(() => aggregateShiftAnalytics(orders as AdminOrderLike[]), [orders]);
  const popularLines = useMemo(() => getPopularItems(orders as any), [orders]);
  const eventsTonight = useMemo(() => updates.filter((u) => u.active && (u.event_date === todayStr || !u.event_date)), [updates, todayStr]);
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const loadLabel = load === "high" ? "High" : load === "medium" ? "Medium" : "Low";
  const loadColor = load === "high" ? "text-destructive" : load === "medium" ? "text-amber-400" : "text-emerald-400";

  /* ── Auth guards ── */
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace state={{ from: "/admin" }} />;
  if (!isAdmin) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center max-w-md mx-auto">
      <h1 className="font-display text-2xl font-bold text-foreground mb-2">Admin access required</h1>
      <p className="text-muted-foreground text-sm mb-4">This account doesn't have admin privileges.</p>
      <button onClick={() => navigate("/auth", { state: { from: "/admin" } })} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold btn-press">Sign in as admin</button>
      <Link to="/" className="text-sm text-primary font-medium mt-3">Back to home</Link>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-6 h-6 text-primary" />
              <div>
                <h1 className="font-display text-lg font-bold text-foreground leading-tight">Berrylicious Ops</h1>
                <p className="text-[10px] text-muted-foreground">Live · {todayStr}</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="hidden sm:flex items-center gap-3">
              <StatPill label="Orders" value={String(activeCount)} />
              <StatPill label="Revenue" value={formatPrice(revenueToday)} accent />
              <StatPill label="Load" value={loadLabel} className={loadColor} icon={<Flame className="w-3 h-3" />} />
              <StatPill label="Next 10m" value={`${bookingsNext10}`} sub="bookings" />
            </div>

            <Link to="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Home className="w-4 h-4" /> Exit
            </Link>
          </div>
        </div>
      </header>

      {/* ── TAB BAR ── */}
      <nav className="border-b border-border bg-card/50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2">
            {TABS.map((t) => {
              const active = tab === t.id;
              const count = t.id === "kitchen" ? activeCount
                : t.id === "bookings" ? bookingsToday.length
                : t.id === "events" ? eventsTonight.length
                : t.id === "messages" ? null
                : null;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setSelectedId(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap btn-press ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  <span>{t.label}</span>
                  {count !== null && count > 0 && (
                    <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
                      active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ── HINTS BAR ── */}
      {tab === "kitchen" && hints.length > 0 && (
        <div className="bg-muted/30 border-b border-border">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2 flex gap-4 overflow-x-auto scrollbar-hide">
            {hints.map((h, i) => (
              <p key={i} className="text-[11px] text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                {h}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">

          {/* KITCHEN TAB */}
          {tab === "kitchen" && (
            <div className="flex flex-col xl:flex-row gap-5">
              {/* Left: Kanban + detail */}
              <div className="flex-1 min-w-0 space-y-5">
                {/* Kanban board */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <KanbanColumn title="New" emoji="📋" orders={grouped.pending} activeCount={activeCount}
                    selectedId={selectedId} onSelect={setSelectedId} statusColor="border-t-primary" />
                  <KanbanColumn title="Preparing" emoji="👨‍🍳" orders={grouped.preparing} activeCount={activeCount}
                    selectedId={selectedId} onSelect={setSelectedId} statusColor="border-t-yellow-500" />
                  <KanbanColumn title="Ready" emoji="🔥" orders={grouped.ready} activeCount={activeCount}
                    selectedId={selectedId} onSelect={setSelectedId} statusColor="border-t-green-500" />
                </div>

                {/* Order history (collapsed) */}
                <details className="rounded-xl border border-border bg-card/50 overflow-hidden">
                  <summary className="px-4 py-3 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" /> All orders ({orders.length})
                  </summary>
                  <div className="px-4 pb-4 space-y-1 max-h-64 overflow-y-auto">
                    {orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between text-xs py-2 border-b border-border/40 last:border-0">
                        <span className="font-mono text-foreground">#{o.id.slice(0, 6)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[o.status] ?? "bg-muted text-muted-foreground"}`}>{o.status}</span>
                        <span className="text-primary font-semibold">{formatPrice(o.total)}</span>
                        {getNextOrderStatus(o.status) && (
                          <button onClick={() => updateOrderStatus(o.id, getNextOrderStatus(o.status)!)}
                            className="text-primary font-semibold hover:underline">Advance</button>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              {/* Right: detail panel */}
              <aside className="w-full xl:w-[340px] shrink-0 xl:sticky xl:top-20 self-start hidden xl:block">
                <div className="rounded-xl border border-border bg-card p-5 min-h-[240px]">
                  {!selected ? (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground text-sm py-16">
                      <ShoppingBag className="w-10 h-10 mb-3 opacity-30" />
                      <p>Select an order</p>
                      <p className="text-xs mt-1 opacity-70">Click a ticket for details + actions</p>
                    </div>
                  ) : (
                    <OrderDetailInline order={selected} activeCount={activeCount}
                      onStatusChange={updateOrderStatus} onSetETA={setOrderETA} />
                  )}
                </div>
              </aside>
            </div>
          )}

          {/* BOOKINGS TAB */}
          {tab === "bookings" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-foreground">Today's Bookings</h2>
                <span className="text-sm text-muted-foreground">{bookingsToday.length} bookings</span>
              </div>
              {bookingsToday.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No bookings for today</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {bookingsToday.map((b) => (
                    <div key={b.id} className="rounded-xl border border-border bg-card p-4 card-interactive">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-foreground font-semibold">{b.time} · {b.guests} guests</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{b.guest_name || "Guest"} {b.guest_phone ? `· ${b.guest_phone}` : ""}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[b.status] || "bg-muted text-muted-foreground"}`}>{b.status}</span>
                      </div>
                      {b.special_requests && <p className="text-xs text-muted-foreground italic mb-2">"{b.special_requests}"</p>}
                      {b.assigned_table_code && <p className="text-[11px] font-mono font-semibold text-foreground">Table {b.assigned_table_code}</p>}
                      {b.arrival_code && <p className="font-mono text-sm font-bold text-primary tracking-wide mt-1">{b.arrival_code}</p>}
                      {b.arrival_verified_at && <p className="text-[10px] text-muted-foreground">Checked in {new Date(b.arrival_verified_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                        <button onClick={() => updateBookingStatus(b.id, "confirmed")} className="text-[11px] font-semibold text-primary hover:underline btn-press">Confirm</button>
                        <button onClick={() => updateBookingStatus(b.id, "seated")} className="text-[11px] font-semibold text-sky-400 hover:underline btn-press">Seated</button>
                        <button onClick={() => updateBookingStatus(b.id, "cancelled")} className="text-[11px] font-semibold text-destructive hover:underline btn-press">Cancel</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All bookings */}
              {bookings.length > bookingsToday.length && (
                <details className="rounded-xl border border-border bg-card/50 overflow-hidden">
                  <summary className="px-4 py-3 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                    All bookings ({bookings.length})
                  </summary>
                  <div className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
                    {bookings.filter(b => b.date !== todayStr).map((b) => (
                      <div key={b.id} className="flex items-center justify-between text-xs py-2 border-b border-border/40">
                        <span className="text-foreground">{b.date} {b.time} · {b.guests}p</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[b.status] ?? "bg-muted text-muted-foreground"}`}>{b.status}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* EVENTS TAB */}
          {tab === "events" && (
            <div className="space-y-5 max-w-3xl">
              <h2 className="font-display text-xl font-semibold text-foreground">Events & Specials</h2>

              {/* Add new event */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" /> New event
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="text" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Event title" className="w-full bg-background border border-border rounded-lg py-2.5 px-3 text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <input type="text" value={newEvent.subtitle} onChange={(e) => setNewEvent({ ...newEvent, subtitle: e.target.value })}
                    placeholder="Subtitle" className="w-full bg-background border border-border rounded-lg py-2.5 px-3 text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <input type="date" value={newEvent.event_date} onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg py-2.5 px-3 text-sm [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <input type="text" value={newEvent.event_time} onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })}
                    placeholder="21:00" className="w-full bg-background border border-border rounded-lg py-2.5 px-3 text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="flex gap-2">
                  {["event", "special", "announcement"].map((t) => (
                    <button key={t} onClick={() => setNewEvent({ ...newEvent, type: t })}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors btn-press ${
                        newEvent.type === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
                      }`}>{t}</button>
                  ))}
                </div>
                <button onClick={addEvent} className="bg-primary text-primary-foreground text-sm font-semibold py-2.5 px-5 rounded-lg btn-press hover:opacity-90">Add event</button>
              </div>

              {/* Active events */}
              <div className="space-y-2">
                {updates.map((u) => (
                  <div key={u.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between card-interactive">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-primary font-bold uppercase tracking-wider">{u.type}</span>
                        {u.event_date && <span className="text-[10px] text-muted-foreground">{u.event_date}</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${u.active ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {u.active ? "Live" : "Off"}
                        </span>
                      </div>
                      <p className="text-foreground font-semibold">{u.title}</p>
                      {u.subtitle && <p className="text-sm text-muted-foreground">{u.subtitle}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-3">
                      <button onClick={() => toggleEvent(u.id, u.active)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors btn-press ${
                          u.active ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}>
                        {u.active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteEvent(u.id)}
                        className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors btn-press">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {updates.length === 0 && <p className="text-muted-foreground text-center py-12">No events yet</p>}
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {tab === "analytics" && (
            <div className="max-w-2xl space-y-5">
              <h2 className="font-display text-xl font-semibold text-foreground">Shift Analytics</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <AnalyticCard label="Total Orders" value={String(shiftStats.totalOrders)} />
                <AnalyticCard label="Peak Hour" value={shiftStats.peakHour} />
                <AnalyticCard label="Top Item" value={shiftStats.mostOrdered} />
              </div>

              {/* Mobile stats */}
              <div className="sm:hidden grid grid-cols-2 gap-3">
                <AnalyticCard label="Active" value={String(activeCount)} />
                <AnalyticCard label="Revenue" value={formatPrice(revenueToday)} accent />
              </div>

              {popularLines.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Popular items</h3>
                  <div className="space-y-2">
                    {popularLines.map(([name, count], i) => (
                      <div key={name} className="flex items-center justify-between text-sm">
                        <span className="text-foreground"><span className="text-muted-foreground mr-2">{i + 1}.</span>{name}</span>
                        <span className="text-muted-foreground font-mono">{count}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MESSAGES TAB */}
          {tab === "messages" && <AdminMessagesPanel />}

          {/* TOOLS TAB */}
          {tab === "tools" && (
            <div className="space-y-5 max-w-3xl">
              <h2 className="font-display text-xl font-semibold text-foreground">Admin Tools</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <AdminArrivalVerify onVerified={() => { fetchBookings(); fetchOrders(); }} />
                <AdminWaitlistPanel />
              </div>
              <AdminMenuDisabledPanel />
            </div>
          )}
        </div>
      </main>

      {/* Mobile order drawer */}
      {tab === "kitchen" && selected && (
        <div className="xl:hidden fixed inset-0 z-50 bg-background/98 overflow-y-auto animate-fade-in">
          <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
            <button onClick={() => setSelectedId(null)} className="text-sm text-primary font-medium mb-4 btn-press">← Back to board</button>
            <OrderDetailInline order={selected} activeCount={activeCount}
              onStatusChange={updateOrderStatus} onSetETA={setOrderETA} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS (inlined to keep admin self-contained)
   ═══════════════════════════════════════════════════════════════ */

function StatPill({ label, value, accent, className, icon, sub }: {
  label: string; value: string; accent?: boolean; className?: string; icon?: React.ReactNode; sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/80 px-3 py-1.5 min-w-[100px]">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-base font-bold ${accent ? "text-primary" : className || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground -mt-0.5">{sub}</p>}
    </div>
  );
}

function AnalyticCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold truncate ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function KanbanColumn({ title, emoji, orders, activeCount, selectedId, onSelect, statusColor }: {
  title: string; emoji: string; orders: AdminOrderLike[]; activeCount: number;
  selectedId: string | null; onSelect: (id: string) => void; statusColor: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card/80 flex flex-col border-t-2 ${statusColor}`}>
      <div className="px-3 py-2.5 border-b border-border/60 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <span>{emoji}</span> {title}
        </span>
        <span className="text-xs font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-full">{orders.length}</span>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[min(52vh,420px)]">
        {orders.length === 0 && <p className="text-muted-foreground text-xs text-center py-8 opacity-50">No orders</p>}
        {[...orders].sort(sortFifo).map((o) => {
          const isSelected = o.id === selectedId;
          const urgent = isFreshPendingOrder(o);
          const high = inferredPriority(o) === "high";
          return (
            <button key={o.id} type="button" onClick={() => onSelect(o.id)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all btn-press ${
                isSelected ? "border-primary bg-primary/10 shadow-sm shadow-primary/10" : "border-border bg-background/50 hover:border-primary/30"
              } ${urgent ? "ring-2 ring-inset ring-primary/60" : ""} ${high ? "ring-1 ring-orange-500/40" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground font-mono">#{o.id.slice(0, 6)}</span>
                <span className="text-[10px] text-muted-foreground">{estimatePrepMinutes(o, activeCount)}m</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-1">
                {Array.isArray(o.items) ? (o.items as any[]).map((i: any) => i.name).join(", ") : "—"}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                {(o as any).order_type && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{typeBadge[(o as any).order_type] || (o as any).order_type}</span>
                )}
                <span className="text-[10px] text-primary font-bold">{formatPrice(Number(o.total) || 0)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrderDetailInline({ order: o, activeCount, onStatusChange, onSetETA }: {
  order: any; activeCount: number;
  onStatusChange: (id: string, status: string) => void;
  onSetETA: (id: string, mins: number) => void;
}) {
  const nextStatus = getNextOrderStatus(o.status);
  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-display text-xl font-bold text-foreground">#{o.id.slice(0, 8)}</h2>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[o.status] ?? "bg-muted text-muted-foreground"}`}>{o.status}</span>
        {inferredPriority(o) === "high" && <span className="text-[10px] font-bold uppercase tracking-wide text-orange-400">Priority</span>}
        {o.order_type && <span className="text-xs text-muted-foreground">{typeBadge[o.order_type]}</span>}
      </div>

      {/* Meta */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Suggested prep ~{estimatePrepMinutes(o, activeCount)} min</p>
        <p>{new Date(o.created_at).toLocaleString()}</p>
      </div>

      {/* Total + codes */}
      <p className="text-foreground font-bold text-xl">{formatPrice(o.total)}</p>
      {o.arrival_code && <p className="font-mono text-sm font-bold text-primary tracking-wide">{o.arrival_code}</p>}
      {o.arrival_verified_at && <p className="text-[10px] text-muted-foreground">Verified {new Date(o.arrival_verified_at).toLocaleString()}</p>}

      {/* Items */}
      <div className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
        {Array.isArray(o.items) && o.items.map((item: any, i: number) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-foreground">{item.name} × {item.qty}</span>
            <span className="text-muted-foreground">{formatPrice(item.price * item.qty)}</span>
          </div>
        ))}
      </div>

      {/* ETA (preparing only) */}
      {o.status === "preparing" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Set ETA</p>
          <div className="flex gap-2">
            {[10, 15, 20, 30].map((mins) => (
              <button key={mins} onClick={() => onSetETA(o.id, mins)}
                className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-xs transition-colors btn-press ${
                  o.eta_minutes === mins ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}>
                <Clock className="h-3 w-3" />{mins}m
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Next step */}
      {nextStatus && (
        <button onClick={() => onStatusChange(o.id, nextStatus)}
          className="w-full rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground btn-press shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
          Move to {nextStatus} <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
