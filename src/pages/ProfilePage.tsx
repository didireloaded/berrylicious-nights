import {
  User,
  Gift,
  Clock,
  CalendarDays,
  LogOut,
  ChevronRight,
  Shield,
  Info,
  Sparkles,
  Package,
  Instagram,
  Compass,
  MapPin,
  PartyPopper,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAboutSheet } from "@/context/AboutSheetContext";
import { formatPrice } from "@/lib/vibe";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { requestOrderNotificationPermission } from "@/lib/orderStatusNotify";
import { useEffect, useMemo, useState } from "react";

type OrderRow = {
  id?: string;
  items?: { name?: string; qty?: number }[];
  total?: number;
  status?: string;
  created_at?: string;
  createdAt?: string;
};

type BookingRow = {
  id?: string;
  guests?: number;
  date?: string;
  time?: string;
  status?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ProfilePage = () => {
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { openAbout } = useAboutSheet();
  const { currentOrder, currentBooking } = useApp();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);

  const displayName = profile?.display_name || user?.user_metadata?.full_name || "Guest";
  const totalVisits = profile?.total_visits || 0;
  const totalOrders = profile?.total_orders || 0;
  const loyaltyPoints = profile?.loyalty_points ?? 0;
  const loyaltyTarget = 5;
  const loyaltyPercent = Math.min((totalVisits / loyaltyTarget) * 100, 100);

  useEffect(() => {
    if (user) {
      void supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }) => setOrders((data ?? []) as OrderRow[]));
      void supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }) => setBookings((data ?? []) as BookingRow[]));
    } else {
      setOrders(JSON.parse(localStorage.getItem("berrylicious-orders") || "[]").reverse() as OrderRow[]);
      setBookings(JSON.parse(localStorage.getItem("berrylicious-bookings") || "[]").reverse() as BookingRow[]);
    }
  }, [user]);

  useEffect(() => {
    if (!user || typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    void requestOrderNotificationPermission();
  }, [user]);

  const lastOrder = orders[0];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const orderLine = useMemo(() => {
    if (!lastOrder?.items?.length) return "Your last order";
    return lastOrder.items.map((i) => `${i.name ?? "Item"} × ${i.qty ?? 1}`).join(", ");
  }, [lastOrder]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const orderLive =
    !!currentOrder &&
    currentOrder.status !== "completed" &&
    ["pending", "preparing", "ready"].includes(String(currentOrder.status));
  const bookingTonight =
    !!currentBooking &&
    currentBooking.date === todayStr &&
    typeof currentBooking.guests === "number" &&
    currentBooking.guests > 0;

  const milestoneLabel = useMemo(() => {
    if (totalVisits >= 12) return "House favourite";
    if (totalVisits >= 4) return "Regular";
    if (totalVisits >= 1) return "On the list";
    return null;
  }, [totalVisits]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-safe-nav max-w-lg mx-auto">
      {/* Profile hero */}
      <div className="relative overflow-hidden px-6 pt-8 pb-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/12 via-primary/5 to-transparent" />
        <div className="pointer-events-none absolute -top-24 right-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-2xl font-bold text-primary ring-4 ring-background shadow-xl">
              {user ? initials(displayName) : <User className="h-10 w-10 text-primary" strokeWidth={1.75} />}
            </div>
            {user && (
              <span
                className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background"
                title="Signed in"
                aria-hidden
              />
            )}
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{displayName}</h1>
          {user?.email && <p className="mt-1 max-w-[280px] truncate text-sm text-muted-foreground">{user.email}</p>}
          {user?.created_at && (
            <p className="mt-1.5 text-[11px] text-muted-foreground/90">
              Member since{" "}
              {new Date(user.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </p>
          )}
          {!user && <p className="mt-1 text-sm text-muted-foreground">Sign in to save orders, bookings & rewards</p>}
          {user && milestoneLabel && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1">
              <PartyPopper className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-primary">{milestoneLabel}</span>
            </div>
          )}

          {user && (
            <div className="mt-6 grid w-full max-w-sm grid-cols-3 gap-2 rounded-2xl border border-border/80 bg-card/80 p-3 shadow-sm backdrop-blur-sm">
              <div className="text-center">
                <p className="font-display text-xl font-bold text-foreground">{totalVisits}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Visits</p>
              </div>
              <div className="border-x border-border/60 text-center">
                <p className="font-display text-xl font-bold text-foreground">{totalOrders}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Orders</p>
              </div>
              <div className="text-center">
                <p className="font-display text-xl font-bold text-primary">{loyaltyPoints}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Points</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 px-6 -mt-2">
        {!user && (
          <Link
            to="/auth"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 btn-press"
          >
            Sign in or create account
          </Link>
        )}

        {user && (
          <div className="flex gap-2">
            <Link
              to="/booking"
              className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-border bg-card py-3 text-center btn-press hover:border-primary/40"
            >
              <CalendarDays className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Book</span>
            </Link>
            <Link
              to="/menu"
              className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-border bg-card py-3 text-center btn-press hover:border-primary/40"
            >
              <Package className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Order</span>
            </Link>
            <Link
              to="/plan"
              className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-border bg-card py-3 text-center btn-press hover:border-primary/40"
            >
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Plan</span>
            </Link>
          </div>
        )}

        {user && (orderLive || bookingTonight) && (
          <section className="space-y-2">
            <h2 className="px-0.5 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Right now
            </h2>
            {orderLive && currentOrder && (
              <Link
                to={`/order/${currentOrder.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3.5 transition-colors hover:bg-primary/15"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary">Order in progress</p>
                  <p className="text-xs text-muted-foreground">Status: {String(currentOrder.status)} · tap to track</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
              </Link>
            )}
            {bookingTonight && currentBooking && (
              <Link
                to="/booking/success"
                state={currentBooking}
                className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 transition-colors hover:bg-emerald-500/15"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-200">Table tonight</p>
                  <p className="text-xs text-muted-foreground">
                    {currentBooking.time} · {currentBooking.guests} guests · arrival &amp; details
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-300" />
              </Link>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-3 px-0.5 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Explore
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/plan"
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary/35"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Plan my night</p>
                <p className="text-[10px] text-muted-foreground">Time, vibe, pre-order</p>
              </div>
            </Link>
            <Link
              to="/plan?tab=events"
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary/35"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Compass className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Host an event</p>
                <p className="text-[10px] text-muted-foreground">Package &amp; price estimate</p>
              </div>
            </Link>
            <Link
              to="/menu"
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary/35"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Full menu</p>
                <p className="text-[10px] text-muted-foreground">Drinks &amp; plates</p>
              </div>
            </Link>
            <Link
              to="/booking"
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary/35"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Reserve</p>
                <p className="text-[10px] text-muted-foreground">Pick date &amp; time</p>
              </div>
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-border/80 bg-gradient-to-br from-card to-background/60 p-4">
          <h2 className="font-display text-sm font-semibold text-foreground">While you&apos;re here</h2>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted-foreground">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Ask about terrace tables when the weather plays along — same menu, open-air energy.
            </li>
            <li className="flex gap-2">
              <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Mention dietary needs when you book; the pass can usually flex with a heads-up.
            </li>
            <li className="flex gap-2">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Fridays fill fast after 19:00 — a reservation beats the queue.
            </li>
          </ul>
        </section>

        {user && (
          <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-foreground">Rewards</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {loyaltyPoints} pts · +more when orders complete
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-muted-foreground">Visits toward free drink</span>
                <span className="font-semibold text-foreground">
                  {totalVisits} / {loyaltyTarget}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background/80">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${loyaltyPercent}%` }}
                />
              </div>
              {loyaltyPercent >= 100 && (
                <p className="mt-3 text-sm font-semibold text-primary">You’ve earned a free drink — show staff your profile.</p>
              )}
            </div>
          </section>
        )}

        {lastOrder && (
          <section>
            <h2 className="mb-3 px-0.5 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Recent activity
            </h2>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Last order</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground line-clamp-2">{orderLine}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatPrice(Number(lastOrder.total))} ·{" "}
                {new Date(lastOrder.created_at || lastOrder.createdAt || "").toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </p>
              <Link
                to="/menu"
                className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:opacity-90"
              >
                Order again <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}

        {bookings.length > 0 && (
          <section>
            <h2 className="mb-3 px-0.5 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Bookings
            </h2>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {bookings.slice(0, 4).map((b, i) => (
                <div key={b.id || String(i)} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {b.guests} guests · {b.time}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.date
                        ? new Date(b.date + "T12:00:00").toLocaleDateString(undefined, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      b.status === "confirmed" || b.status === "arrived"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {b.status || "booked"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {orders.length > 0 && (
          <section>
            <h2 className="mb-3 px-0.5 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Order history
            </h2>
            <div className="space-y-2">
              {orders.map((o, i) => (
                <div
                  key={o.id || String(i)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/50 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {Array.isArray(o.items) ? o.items.map((x) => x.name).filter(Boolean).join(", ") || "Order" : "Order"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(o.created_at || o.createdAt || "").toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-bold text-primary">{formatPrice(Number(o.total))}</span>
                    {o.id && o.status && o.status !== "completed" && (
                      <Link to={`/order/${o.id}`} className="text-[11px] font-semibold text-primary hover:underline">
                        Track
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 px-0.5 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Account
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            <a
              href="https://instagram.com/berrylicious__restaurant"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/30 active:bg-muted/50"
            >
              <Instagram className="h-5 w-5 shrink-0 text-pink-400" />
              <span className="flex-1 text-sm font-medium text-foreground">Instagram</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </a>
            <button
              type="button"
              onClick={() => openAbout()}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 active:bg-muted/50"
            >
              <Info className="h-5 w-5 text-primary shrink-0" />
              <span className="flex-1 text-sm font-medium text-foreground">About &amp; hours</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/30 active:bg-muted/50"
              >
                <Shield className="h-5 w-5 text-primary shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">Admin</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            )}
          </div>
        </section>

        {user && (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive btn-press"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        )}

        <p className="pb-4 text-center text-[11px] text-muted-foreground">Berrylicious · Profile</p>
      </div>
    </div>
  );
};

export default ProfilePage;
