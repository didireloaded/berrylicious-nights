import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/vibe";
import { Navigate } from "react-router-dom";
import { CalendarDays, ShoppingBag, Megaphone, Shield, Plus, Trash2, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

type Tab = "bookings" | "orders" | "kitchen" | "events";

const statusColors: Record<string, string> = {
  confirmed: "bg-primary/20 text-primary",
  cancelled: "bg-destructive/20 text-destructive",
  pending: "bg-primary/20 text-primary",
  preparing: "bg-yellow-500/20 text-yellow-400",
  ready: "bg-green-500/20 text-green-400",
  completed: "bg-muted text-muted-foreground",
};

const AdminPage = () => {
  const { user, isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("kitchen");
  const [bookings, setBookings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [newEvent, setNewEvent] = useState({ title: "", subtitle: "", type: "event" });
  const prevOrderCount = useRef(0);

  useEffect(() => {
    if (isAdmin) {
      fetchBookings();
      fetchOrders();
      fetchUpdates();

      // Subscribe to new orders in realtime
      const channel = supabase
        .channel("admin-orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => fetchOrders()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings" },
          () => fetchBookings()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin]);

  // Sound alert for new orders
  useEffect(() => {
    if (orders.length > prevOrderCount.current && prevOrderCount.current > 0) {
      toast.success("🔔 New order received!", { duration: 5000 });
      // Play sound if available
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRl9vT19teleHhYWFhBAAAAQBACAAIAACAAIAJAAA");
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch {}
    }
    prevOrderCount.current = orders.length;
  }, [orders.length]);

  const fetchBookings = async () => {
    const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(50);
    setBookings(data ?? []);
  };

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50);
    setOrders(data ?? []);
  };

  const fetchUpdates = async () => {
    const { data } = await supabase.from("updates").select("*").order("created_at", { ascending: false });
    setUpdates(data ?? []);
  };

  const updateBookingStatus = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status }).eq("id", id);
    toast.success(`Booking ${status}`);
    fetchBookings();
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    toast.success(`Order marked as ${status}`);
    fetchOrders();
  };

  const setOrderETA = async (id: string, minutes: number) => {
    await supabase.from("orders").update({
      eta_minutes: minutes,
      eta_set_at: new Date().toISOString(),
    } as any).eq("id", id);
    toast.success(`ETA set to ${minutes} min`);
    fetchOrders();
  };

  const addEvent = async () => {
    if (!newEvent.title.trim()) return;
    await supabase.from("updates").insert(newEvent);
    setNewEvent({ title: "", subtitle: "", type: "event" });
    toast.success("Event added 🎉");
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  // Kitchen view: split orders by status
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const readyOrders = orders.filter((o) => o.status === "ready");

  const tabs = [
    { id: "kitchen" as Tab, label: "Kitchen", icon: ShoppingBag, count: pendingOrders.length + preparingOrders.length },
    { id: "bookings" as Tab, label: "Bookings", icon: CalendarDays, count: bookings.length },
    { id: "orders" as Tab, label: "All Orders", icon: ShoppingBag, count: orders.length },
    { id: "events" as Tab, label: "Events", icon: Megaphone, count: updates.length },
  ];

  return (
    <div className="min-h-screen pb-24 px-6 pt-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            <span className="text-xs opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Kitchen View — 3 columns */}
      {tab === "kitchen" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pending */}
          <div>
            <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              📋 New <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
            </h3>
            <div className="space-y-3">
              {pendingOrders.map((o) => (
                <KitchenCard key={o.id} order={o} onStatusChange={updateOrderStatus} onSetETA={setOrderETA} />
              ))}
            </div>
          </div>

          {/* Preparing */}
          <div>
            <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              👨‍🍳 Preparing <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">{preparingOrders.length}</span>
            </h3>
            <div className="space-y-3">
              {preparingOrders.map((o) => (
                <KitchenCard key={o.id} order={o} onStatusChange={updateOrderStatus} onSetETA={setOrderETA} />
              ))}
            </div>
          </div>

          {/* Ready */}
          <div>
            <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              🔥 Ready <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">{readyOrders.length}</span>
            </h3>
            <div className="space-y-3">
              {readyOrders.map((o) => (
                <KitchenCard key={o.id} order={o} onStatusChange={updateOrderStatus} onSetETA={setOrderETA} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bookings */}
      {tab === "bookings" && (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-foreground font-semibold">
                    Table for {b.guests} • {b.date} at {b.time}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {b.guest_name || "Registered user"} {b.guest_phone && `• ${b.guest_phone}`}
                  </p>
                  {b.special_requests && <p className="text-muted-foreground text-xs mt-1 italic">"{b.special_requests}"</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[b.status] || "bg-muted text-muted-foreground"}`}>
                  {b.status}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => updateBookingStatus(b.id, "confirmed")} className="text-xs text-primary hover:underline">Confirm</button>
                <button onClick={() => updateBookingStatus(b.id, "cancelled")} className="text-xs text-destructive hover:underline">Cancel</button>
              </div>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-muted-foreground text-center py-8">No bookings yet</p>}
        </div>
      )}

      {/* All Orders */}
      {tab === "orders" && (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-foreground font-semibold">{formatPrice(o.total)}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {Array.isArray(o.items) ? o.items.map((i: any) => `${i.name} ×${i.qty}`).join(", ") : "Items"}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">{new Date(o.created_at).toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[o.status] || "bg-muted text-muted-foreground"}`}>
                  {o.status}
                </span>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {["pending", "preparing", "ready", "completed"].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateOrderStatus(o.id, s)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      o.status === s ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-muted-foreground text-center py-8">No orders yet</p>}
        </div>
      )}

      {/* Events */}
      {tab === "events" && (
        <div className="space-y-4">
          {/* Add new */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-foreground font-semibold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Add Event / Special
            </h3>
            <input
              type="text"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              placeholder="Event title"
              className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              value={newEvent.subtitle}
              onChange={(e) => setNewEvent({ ...newEvent, subtitle: e.target.value })}
              placeholder="Subtitle / details"
              className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              {["event", "special", "announcement"].map((t) => (
                <button
                  key={t}
                  onClick={() => setNewEvent({ ...newEvent, type: t })}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    newEvent.type === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={addEvent} className="bg-primary text-primary-foreground text-sm font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity">
              Add Event
            </button>
          </div>

          {/* List */}
          {updates.map((u) => (
            <div key={u.id} className="bg-card border border-border rounded-lg p-4 flex items-start justify-between">
              <div>
                <span className="text-xs text-primary font-semibold uppercase tracking-wider">{u.type}</span>
                <h3 className="text-foreground font-semibold mt-1">{u.title}</h3>
                <p className="text-muted-foreground text-sm">{u.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleEvent(u.id, u.active)}
                  className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                    u.active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                  }`}
                  title={u.active ? "Deactivate" : "Activate"}
                >
                  {u.active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </button>
                <button onClick={() => deleteEvent(u.id)} className="w-8 h-8 rounded bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Kitchen Card component
const KitchenCard = ({
  order,
  onStatusChange,
  onSetETA,
}: {
  order: any;
  onStatusChange: (id: string, status: string) => void;
  onSetETA: (id: string, minutes: number) => void;
}) => {
  const nextStatus: Record<string, string> = {
    pending: "preparing",
    preparing: "ready",
    ready: "completed",
  };

  const nextLabel: Record<string, string> = {
    pending: "Start →",
    preparing: "Ready →",
    ready: "Complete →",
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-foreground font-semibold text-sm">{formatPrice(order.total)}</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {Array.isArray(order.items) ? order.items.map((i: any) => `${i.name} ×${i.qty}`).join(", ") : "Items"}
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {/* ETA controls for preparing */}
      {order.status === "preparing" && (
        <div className="flex gap-1 mb-3">
          {[10, 15, 20, 30].map((mins) => (
            <button
              key={mins}
              onClick={() => onSetETA(order.id, mins)}
              className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                (order as any).eta_minutes === mins
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="w-3 h-3" />
              {mins}m
            </button>
          ))}
        </div>
      )}

      {nextStatus[order.status] && (
        <button
          onClick={() => onStatusChange(order.id, nextStatus[order.status])}
          className="w-full bg-primary text-primary-foreground text-sm font-semibold py-2 rounded-lg hover:opacity-90 transition-opacity active:scale-[0.97]"
        >
          {nextLabel[order.status]}
        </button>
      )}
    </div>
  );
};

export default AdminPage;
