import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarHeart,
  Clock,
  MapPin,
  MessageSquare,
  User,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import dishLamb from "@/assets/dish-lamb.jpg";
import { foodItems } from "@/data/menu";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useCart } from "@/context/CartContext";
import { useActiveUpdates } from "@/hooks/useActiveUpdates";
import { useAboutSheet } from "@/context/AboutSheetContext";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";
import { useNotificationCenter } from "@/context/NotificationCenterContext";
import { isActiveOrderStatus } from "@/lib/orderLifecycle";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import { ActiveOrderBanner } from "@/components/ActiveOrderBanner";
import { formatPrice } from "@/lib/vibe";
import { getWindhoekDateISO } from "@/lib/windhoekDate";
import type { HomeUpdateRow } from "@/lib/eventBooking";

const SIGNATURE_IDS = ["cc-ribeye", "6"];

function getWindhoekGreeting(): string {
  try {
    const hourStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Windhoek",
      hour: "2-digit",
      hour12: false,
    }).format(new Date());
    const hour = Number(hourStr);
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  } catch {
    return "Welcome";
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DashboardHomePage() {
  const { user, profile } = useAuth();
  const { currentOrder, currentBooking } = useApp();
  const { totalItems } = useCart();
  const updates = useActiveUpdates();
  const { openAbout } = useAboutSheet();
  const { openAssistant } = useRestaurantAssistant();
  const { unreadCount, backendAvailable: notifBackendAvailable, openNotificationCenter } = useNotificationCenter();
  const [selectedEvent, setSelectedEvent] = useState<HomeUpdateRow | null>(null);

  const savedGuestName =
    typeof localStorage !== "undefined" ? (localStorage.getItem("butcher-block-guest-name") || "").trim() : "";
  const verifiedName = (profile?.display_name || user?.user_metadata?.full_name || savedGuestName).trim();
  const firstName = verifiedName ? verifiedName.split(/\s+/)[0] : "";
  const greeting = firstName ? `${getWindhoekGreeting()}, ${firstName}` : "Butcher Block Steakhouse";

  const signatureDishes = useMemo(
    () =>
      SIGNATURE_IDS.map((id) => foodItems.find((item) => item.id === id)).filter(
        (item): item is (typeof foodItems)[number] => item != null,
      ),
    [],
  );

  const hasLiveOrder = Boolean(currentOrder && isActiveOrderStatus(currentOrder.status));
  const todayISO = getWindhoekDateISO();
  const upcomingBooking =
    currentBooking && currentBooking.date >= todayISO ? currentBooking : null;

  const verifiedUnreadCount = notifBackendAvailable ? unreadCount : 0;
  const hasNotificationDot = verifiedUnreadCount > 0 || hasLiveOrder;

  return (
    <div
      className={
        "min-h-dvh bg-[#121212] text-white lg:pb-16 " +
        (totalItems > 0 ? "pb-44" : "pb-28")
      }
    >
      <div className="mx-auto max-w-[560px] px-5 pt-[max(20px,env(safe-area-inset-top,0px))] sm:px-6 lg:max-w-5xl lg:px-8 lg:pt-8">
        {/* Compact iOS Greeting Header */}
        <header className="flex items-center justify-between gap-3">
          <Link
            to="/profile"
            aria-label={verifiedName ? `Open profile for ${verifiedName}` : "Open your profile"}
            className="group flex min-w-0 items-center gap-3 rounded-full pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#303030] text-[14px] font-bold text-white transition-colors group-hover:border-[#FF5A1F]">
              {verifiedName ? getInitials(verifiedName) : <User className="h-5 w-5 text-[#A3A3A3]" aria-hidden="true" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-snug text-white">
                {greeting}
              </span>
              <span className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-[#A3A3A3]">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                Am Weinberg Estate, Windhoek
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openNotificationCenter}
              aria-label={verifiedUnreadCount > 0 ? `Open notifications, ${verifiedUnreadCount} unread` : "Open notifications"}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              <Bell className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
              {verifiedUnreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF5A1F] px-1 text-[10px] font-bold text-white tabular-nums">
                  {verifiedUnreadCount > 9 ? "9+" : verifiedUnreadCount}
                </span>
              ) : hasNotificationDot ? (
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#FF5A1F]" aria-hidden="true" />
              ) : null}
            </button>
          </div>
        </header>

        {/* Active order dynamic banner (only shown when a real order is in progress) */}
        <ActiveOrderBanner />

        {/* Editorial Hero Composition matching Screen 02 */}
        <section className="bb-stagger bb-stagger-1 relative mt-6 overflow-hidden rounded-[26px] bg-[#121212] py-2 lg:mt-8 lg:grid lg:grid-cols-12 lg:items-center lg:gap-8">
          <div className="relative z-10 max-w-[62%] py-3 lg:col-span-6 lg:max-w-none lg:py-6">
            <h1 className="font-display text-[clamp(2.25rem,9.5vw,3rem)] font-extrabold leading-[1.03] tracking-[-0.045em] text-white lg:text-[3.4rem]">
              <span className="block">Premium</span>
              <span className="block text-[#FF5A1F]">Steaks</span>
              <span className="block">&amp; More</span>
            </h1>
            <p className="mt-3 text-[14px] font-medium text-[#A3A3A3] lg:text-[16px]">
              Grilled, Crafted, Served.
            </p>
          </div>

          {/* Seamless right-aligned steak photo sculpted into #121212 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -right-5 w-[56%] overflow-hidden lg:relative lg:right-0 lg:col-span-6 lg:h-[260px] lg:w-full lg:rounded-[26px]"
          >
            <img
              src={dishLamb}
              alt=""
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#121212] via-[#121212]/45 to-transparent lg:from-[#121212]/50 lg:via-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-[#121212]/60 lg:from-[#121212]/40 lg:to-transparent" />
          </div>
        </section>

        {/* 4 Compact Primary Actions matching approved reference */}
        <section className="bb-stagger bb-stagger-2 mt-5 grid grid-cols-4 gap-2.5 sm:gap-3 lg:mt-6" aria-label="Primary actions">
          <Link
            to="/menu"
            className="bb-press flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-[20px] bg-[#FF5A1F] px-2 py-3 text-center text-white hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <UtensilsCrossed className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            <span className="text-[12px] font-bold leading-tight sm:text-[13px]">Order Food</span>
          </Link>

          <Link
            to="/drinks"
            className="bb-press flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-[#242424] px-2 py-3 text-center text-white hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <Wine className="h-5 w-5 text-white/90" strokeWidth={1.9} aria-hidden="true" />
            <span className="text-[12px] font-semibold leading-tight text-white/90 sm:text-[13px]">Drinks</span>
          </Link>

          <Link
            to="/booking"
            className="bb-press flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-[#242424] px-2 py-3 text-center text-white hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <CalendarDays className="h-5 w-5 text-white/90" strokeWidth={1.9} aria-hidden="true" />
            <span className="text-[12px] font-semibold leading-tight text-white/90 sm:text-[13px]">Reserve a Table</span>
          </Link>

          <Link
            to="/events"
            className="bb-press flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-[#242424] px-2 py-3 text-center text-white hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <CalendarHeart className="h-5 w-5 text-white/90" strokeWidth={1.9} aria-hidden="true" />
            <span className="text-[12px] font-semibold leading-tight text-white/90 sm:text-[13px]">Events</span>
          </Link>
        </section>

        {/* House Signatures (real menu data — never a fabricated "Today's Special") */}
        <section className="bb-stagger bb-stagger-3 mt-8" aria-labelledby="house-signatures-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="house-signatures-heading" className="text-[20px] font-bold tracking-[-0.03em] text-white">
              House Signatures
            </h2>
            <Link
              to="/menu?category=Choice%20Cuts"
              className="text-[14px] font-semibold text-[#FF5A1F] hover:text-white focus-visible:outline-none focus-visible:underline"
            >
              See all
            </Link>
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {signatureDishes.map((dish) => {
              const weightLabel = dish.variations?.[0]?.size;
              const showWeightPrefix = Boolean(
                weightLabel && !dish.description.toLowerCase().startsWith(weightLabel.toLowerCase()),
              );
              return (
                <Link
                  key={dish.id}
                  to={`/menu/${dish.id}`}
                  className="bb-card-motion group flex items-center gap-3.5 rounded-[22px] border border-white/10 bg-[#242424] p-3 hover:bg-[#2C2C2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
                >
                  <img
                    src={dish.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="bb-ease-spring h-[84px] w-[96px] shrink-0 rounded-[16px] object-cover transition-transform duration-500 will-change-transform group-hover:scale-[1.04]"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[16px] font-bold tracking-[-0.02em] text-white">
                      {dish.name}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-[13px] text-[#A3A3A3]">
                      {showWeightPrefix ? `${weightLabel} · ` : ""}
                      {dish.description}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="text-[16px] font-bold tabular-nums text-[#FF5A1F]">
                        {formatPrice(dish.price)}
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF5A1F] text-white transition-transform group-hover:translate-x-0.5">
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Active Reservation (only rendered when user holds an upcoming reservation) */}
        {upcomingBooking && (
          <section className="mt-7" aria-labelledby="upcoming-booking-heading">
            <h2 id="upcoming-booking-heading" className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
              Your Upcoming Table
            </h2>
            <Link
              to="/booking/success"
              state={upcomingBooking}
              className="mt-2.5 flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#242424] px-4 py-3.5 transition-colors hover:bg-[#2C2C2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F]">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-white">
                    {upcomingBooking.date} · {upcomingBooking.time}
                  </p>
                  <p className="text-[13px] text-[#A3A3A3]">
                    {upcomingBooking.guests} {upcomingBooking.guests === 1 ? "guest" : "guests"}
                    {upcomingBooking.arrival_code ? ` · Ref #${upcomingBooking.arrival_code}` : ""}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#A3A3A3]" aria-hidden="true" />
            </Link>
          </section>
        )}

        {/* Active Events & Announcements (real data from useActiveUpdates) */}
        {updates.length > 0 && (
          <section className="mt-8" aria-labelledby="home-events-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="home-events-heading" className="text-[20px] font-bold tracking-[-0.03em] text-white">
                Upcoming Nights
              </h2>
              <Link
                to="/events"
                className="text-[14px] font-semibold text-[#FF5A1F] hover:text-white focus-visible:outline-none focus-visible:underline"
              >
                All events
              </Link>
            </div>

            <div className="mt-3 divide-y divide-white/10 rounded-[22px] border border-white/10 bg-[#242424] px-4">
              {updates.slice(0, 3).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  className="flex min-h-[64px] w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:text-[#FF5A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-white">{event.title}</p>
                    <p className="mt-0.5 truncate text-[13px] text-[#A3A3A3]">{event.type}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#A3A3A3]" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Restrained Concierge & Restaurant Hours Footer Row */}
        <section className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={openAssistant}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/10 bg-[#242424] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <MessageSquare className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Ask Butcher Block
          </button>

          <button
            type="button"
            onClick={openAbout}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-medium text-[#A3A3A3] transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            <Clock className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Hours &amp; location
          </button>
        </section>
      </div>

      <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
