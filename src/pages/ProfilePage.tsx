import {
  User,
  Gift,
  Clock,
  CalendarDays,
  CalendarHeart,
  LogOut,
  ChevronRight,
  Shield,
  Info,
  Instagram,
  MapPin,
  MessageSquare,
  Heart,
  Wine,
  Check,
  UtensilsCrossed,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAboutSheet } from "@/context/AboutSheetContext";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";
import { formatPrice } from "@/lib/vibe";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useFavorites } from "@/hooks/useFavorites";
import { menuItems } from "@/data/menu";
import { supabase } from "@/integrations/supabase/client";
import { requestOrderNotificationPermission } from "@/lib/orderStatusNotify";
import { useEffect, useMemo, useState } from "react";

type OrderRow = {
  id?: string;
  items?: { name?: string; qty?: number }[];
  total?: number;
  status?: string;
  order_type?: string;
  arrival_code?: string | null;
  created_at?: string;
  createdAt?: string;
};

type BookingRow = {
  id?: string;
  guests?: number;
  date?: string;
  time?: string;
  status?: string;
  eventTitle?: string;
  arrival_code?: string;
  reservation_number?: string;
  assigned_table_code?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function readLocal(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

const ProfilePage = () => {
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { openAbout } = useAboutSheet();
  const { openAssistant } = useRestaurantAssistant();
  const { currentOrder, currentBooking } = useApp();
  const { favoriteIds } = useFavorites();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [guestNameInput, setGuestNameInput] = useState(() => readLocal("butcher-block-guest-name"));
  const [guestPhoneInput, setGuestPhoneInput] = useState(() => readLocal("butcher-block-guest-phone"));
  const [savedGuestName, setSavedGuestName] = useState(() => readLocal("butcher-block-guest-name"));
  const [savedNotice, setSavedNotice] = useState(false);

  const displayName =
    profile?.display_name || user?.user_metadata?.full_name || savedGuestName || "Guest";
  const totalVisits = profile?.total_visits || 0;
  const totalOrders = profile?.total_orders || orders.length;
  const loyaltyPoints = profile?.loyalty_points ?? 0;
  const loyaltyTarget = 5;
  const loyaltyPercent = Math.min((totalVisits / loyaltyTarget) * 100, 100);

  const savedFavorites = useMemo(
    () =>
      favoriteIds
        .map((id) => menuItems.find((item) => item.id === id))
        .filter((item): item is (typeof menuItems)[number] => item != null),
    [favoriteIds],
  );

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
      try {
        setOrders(JSON.parse(localStorage.getItem("berrylicious-orders") || "[]").reverse() as OrderRow[]);
        setBookings(JSON.parse(localStorage.getItem("berrylicious-bookings") || "[]").reverse() as BookingRow[]);
      } catch {
        setOrders([]);
        setBookings([]);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user || typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    void requestOrderNotificationPermission();
  }, [user]);

  const handleSaveGuestProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = guestNameInput.trim();
    const cleanedPhone = guestPhoneInput.trim();
    try {
      if (cleanedName) localStorage.setItem("butcher-block-guest-name", cleanedName);
      else localStorage.removeItem("butcher-block-guest-name");
      if (cleanedPhone) localStorage.setItem("butcher-block-guest-phone", cleanedPhone);
      else localStorage.removeItem("butcher-block-guest-phone");
    } catch {
      /* ignore storage errors */
    }
    setSavedGuestName(cleanedName);
    setSavedNotice(true);
    toast.success("Profile details saved");
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/home");
  };

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

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#121212] text-[#A3A3A3]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#FF5A1F] border-t-transparent" />
        <p className="text-[14px]">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#121212] pb-32 text-white lg:pb-16">
      <div className="mx-auto max-w-[560px] px-5 pt-[max(24px,env(safe-area-inset-top,0px))] sm:px-6 lg:max-w-3xl lg:pt-8">
        {/* Profile Header */}
        <header className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#303030] text-[20px] font-bold text-[#FF5A1F]">
            {user || savedGuestName ? initials(displayName) : <User className="h-7 w-7 text-[#A3A3A3]" aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[24px] font-extrabold tracking-[-0.03em] text-white">
              {displayName}
            </h1>
            {user?.email ? (
              <p className="truncate text-[14px] text-[#A3A3A3]">{user.email}</p>
            ) : (
              <p className="text-[14px] text-[#A3A3A3]">Butcher Block Steakhouse · Windhoek</p>
            )}
          </div>
          {!user && (
            <Link
              to="/auth"
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-[#FF5A1F] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#E84D15]"
            >
              Sign in
            </Link>
          )}
        </header>

        {user && (
          <div className="mt-6 grid grid-cols-3 gap-2.5 rounded-[22px] border border-white/10 bg-[#242424] p-4 text-center">
            <div>
              <p className="text-[20px] font-extrabold tabular-nums text-white">{totalVisits}</p>
              <p className="text-[12px] font-medium text-[#A3A3A3]">Visits</p>
            </div>
            <div className="border-x border-white/10">
              <p className="text-[20px] font-extrabold tabular-nums text-white">{totalOrders}</p>
              <p className="text-[12px] font-medium text-[#A3A3A3]">Orders</p>
            </div>
            <div>
              <p className="text-[20px] font-extrabold tabular-nums text-[#FF5A1F]">{loyaltyPoints}</p>
              <p className="text-[12px] font-medium text-[#A3A3A3]">Points</p>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-6">
          {/* Guest details form (when not signed in) */}
          {!user && (
            <section className="rounded-[22px] border border-white/10 bg-[#242424] p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-white">Your details</h2>
                <Link to="/auth" className="text-[13px] font-semibold text-[#FF5A1F] hover:underline">
                  Sync across devices
                </Link>
              </div>
              <form onSubmit={handleSaveGuestProfile} className="mt-3.5 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="profile-guest-name" className="mb-1 block text-[13px] text-[#A3A3A3]">
                      Display name
                    </label>
                    <input
                      id="profile-guest-name"
                      type="text"
                      value={guestNameInput}
                      onChange={(e) => setGuestNameInput(e.target.value)}
                      placeholder="Enter your name"
                      className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-guest-phone" className="mb-1 block text-[13px] text-[#A3A3A3]">
                      Phone number
                    </label>
                    <input
                      id="profile-guest-phone"
                      type="tel"
                      value={guestPhoneInput}
                      onChange={(e) => setGuestPhoneInput(e.target.value)}
                      placeholder="+264 81 000 0000"
                      className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] text-[14px] font-bold text-white transition-colors hover:bg-[#E84D15]"
                >
                  {savedNotice ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" /> Saved
                    </>
                  ) : (
                    "Save profile details"
                  )}
                </button>
              </form>
            </section>
          )}

          {/* Active order / booking right now */}
          {(orderLive || bookingTonight) && (
            <section className="space-y-2.5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                Right Now
              </h2>
              {orderLive && currentOrder && (
                <Link
                  to={`/order/${currentOrder.id}`}
                  className="flex items-center justify-between gap-3 rounded-[20px] border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-[#FF5A1F]">
                      Order #BB-{String(currentOrder.id).slice(0, 6).toUpperCase()}
                    </p>
                    <p className="text-[13px] text-[#A3A3A3]">Status: {String(currentOrder.status)} · tap for receipt</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                </Link>
              )}
              {bookingTonight && currentBooking && (
                <Link
                  to="/booking/success"
                  state={currentBooking}
                  className="flex items-center justify-between gap-3 rounded-[20px] border border-white/15 bg-[#242424] px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-white">Table Tonight</p>
                    <p className="text-[13px] text-[#A3A3A3]">
                      {currentBooking.time} · {currentBooking.guests} guests
                      {currentBooking.arrival_code ? ` · #${currentBooking.arrival_code}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#A3A3A3]" aria-hidden="true" />
                </Link>
              )}
            </section>
          )}

          {/* Quick Navigation Grid */}
          <section aria-labelledby="explore-heading">
            <h2 id="explore-heading" className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
              Explore
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/menu"
                className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-[#242424] p-3.5 transition-colors hover:bg-[#303030]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5A1F]/15 text-[#FF5A1F]">
                  <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white">Food Menu</p>
                  <p className="text-[12px] text-[#A3A3A3]">Steaks &amp; grill</p>
                </div>
              </Link>
              <Link
                to="/drinks"
                className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-[#242424] p-3.5 transition-colors hover:bg-[#303030]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5A1F]/15 text-[#FF5A1F]">
                  <Wine className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white">Wine &amp; Drinks</p>
                  <p className="text-[12px] text-[#A3A3A3]">Cellar &amp; bar</p>
                </div>
              </Link>
              <Link
                to="/events"
                className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-[#242424] p-3.5 transition-colors hover:bg-[#303030]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5A1F]/15 text-[#FF5A1F]">
                  <CalendarHeart className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white">Events</p>
                  <p className="text-[12px] text-[#A3A3A3]">Weekly nights</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={openAssistant}
                className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-[#242424] p-3.5 text-left transition-colors hover:bg-[#303030]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5A1F]/15 text-[#FF5A1F]">
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white">Ask Us</p>
                  <p className="text-[12px] text-[#A3A3A3]">AI assistant</p>
                </div>
              </button>
            </div>
          </section>

          {/* Saved Favourites (real persisted items) */}
          {savedFavorites.length > 0 && (
            <section aria-labelledby="saved-favs-heading">
              <h2 id="saved-favs-heading" className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                <Heart className="h-3.5 w-3.5 fill-[#FF5A1F] text-[#FF5A1F]" aria-hidden="true" />
                Saved Favourites ({savedFavorites.length})
              </h2>
              <div className="divide-y divide-white/10 overflow-hidden rounded-[22px] border border-white/10 bg-[#242424]">
                {savedFavorites.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    to={`/menu/${item.id}`}
                    className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#303030]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-white">{item.name}</p>
                      <p className="text-[12px] text-[#A3A3A3]">{item.category}</p>
                    </div>
                    <span className="shrink-0 text-[14px] font-bold tabular-nums text-[#FF5A1F]">
                      {item.priceLabel ?? formatPrice(item.price)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Signed-in rewards */}
          {user && (
            <section className="rounded-[22px] border border-white/10 bg-[#242424] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF5A1F]/15 text-[#FF5A1F]">
                  <Gift className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-[16px] font-bold text-white">Rewards</h2>
                  <p className="text-[13px] text-[#A3A3A3]">{loyaltyPoints} pts earned</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-[#A3A3A3]">Visits toward complimentary drink</span>
                  <span className="font-bold text-white">
                    {totalVisits} / {loyaltyTarget}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#303030]">
                  <div className="h-full rounded-full bg-[#FF5A1F]" style={{ width: `${loyaltyPercent}%` }} />
                </div>
              </div>
            </section>
          )}

          {/* Reservations */}
          {bookings.length > 0 && (
            <section aria-labelledby="profile-bookings-heading">
              <h2 id="profile-bookings-heading" className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                Reservations
              </h2>
              <div className="divide-y divide-white/10 overflow-hidden rounded-[22px] border border-white/10 bg-[#242424]">
                {bookings.slice(0, 6).map((b, i) => {
                  const resNo =
                    b.arrival_code ||
                    b.reservation_number ||
                    (b.id ? `BB-${String(b.id).slice(0, 6).toUpperCase()}` : null);
                  return (
                    <Link
                      key={b.id || String(i)}
                      to="/booking/success"
                      state={{
                        id: b.id,
                        date: b.date,
                        time: b.time,
                        guests: b.guests,
                        eventTitle: b.eventTitle,
                        arrival_code: resNo ?? undefined,
                        assigned_table_code: b.assigned_table_code,
                      }}
                      className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[#303030]"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-white">
                          {b.eventTitle ? `${b.eventTitle} · ` : ""}
                          {b.guests} guests · {b.time}
                        </p>
                        <p className="mt-0.5 text-[13px] text-[#A3A3A3]">
                          {b.date}
                          {resNo ? ` · #${resNo}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#303030] px-2.5 py-1 text-[11px] font-bold uppercase text-[#FF5A1F]">
                        {b.status || "Booked"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Order Receipts */}
          {orders.length > 0 && (
            <section aria-labelledby="profile-orders-heading">
              <h2 id="profile-orders-heading" className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                Order Receipts
              </h2>
              <div className="space-y-2">
                {orders.map((o, i) => (
                  <div
                    key={o.id || String(i)}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#242424] px-4 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-white">
                        {Array.isArray(o.items) ? o.items.map((x) => x.name).filter(Boolean).join(", ") || "Order" : "Order"}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#A3A3A3]">
                        {o.id ? `#BB-${String(o.id).slice(0, 6).toUpperCase()} · ` : ""}
                        {new Date(o.created_at || o.createdAt || "").toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[14px] font-bold tabular-nums text-[#FF5A1F]">
                        {formatPrice(Number(o.total))}
                      </span>
                      {o.id && (
                        <Link to={`/order/${o.id}`} className="text-[13px] font-semibold text-white hover:text-[#FF5A1F]">
                          Receipt
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Restaurant Details & Account Links */}
          <section aria-labelledby="restaurant-info-heading">
            <h2 id="restaurant-info-heading" className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
              Butcher Block Windhoek
            </h2>
            <div className="divide-y divide-white/10 overflow-hidden rounded-[22px] border border-white/10 bg-[#242424]">
              <div className="flex items-start gap-3 px-4 py-3.5 text-[14px] text-[#C4C4C4]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                <span>Am Weinberg Estate, 13 Jan Jonker Road, Klein Windhoek</span>
              </div>
              <div className="flex items-start gap-3 px-4 py-3.5 text-[14px] text-[#C4C4C4]">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                <span>Mon–Sat: 11:30 – 22:00 · Sun: 11:30 – 21:00</span>
              </div>
              <a
                href="https://www.instagram.com/butcherblocknamibia/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[52px] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#303030]"
              >
                <Instagram className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                <span className="flex-1 text-[14px] font-semibold text-white">@butcherblocknamibia</span>
                <ChevronRight className="h-4 w-4 text-[#A3A3A3]" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={openAbout}
                className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#303030]"
              >
                <Info className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                <span className="flex-1 text-[14px] font-semibold text-white">About, contact &amp; map</span>
                <ChevronRight className="h-4 w-4 text-[#A3A3A3]" aria-hidden="true" />
              </button>
              <Link
                to="/booking"
                className="flex min-h-[52px] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#303030]"
              >
                <CalendarDays className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                <span className="flex-1 text-[14px] font-semibold text-white">Reserve a Table</span>
                <ChevronRight className="h-4 w-4 text-[#A3A3A3]" aria-hidden="true" />
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex min-h-[52px] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#303030]"
                >
                  <Shield className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                  <span className="flex-1 text-[14px] font-semibold text-white">Admin Console</span>
                  <ChevronRight className="h-4 w-4 text-[#A3A3A3]" aria-hidden="true" />
                </Link>
              )}
            </div>
          </section>

          {user && (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-[#242424] text-[14px] font-semibold text-[#A3A3A3] transition-colors hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
